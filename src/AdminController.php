<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Media\PublicMediaApi;
use Flex\Menus\PublicMenuRenderer;
use Flex\Pages\{Page, PageRepository, PageService};
use Flex\Themes\{ThemeManager, ThemeResourceService};
use Psr\Http\Message\{ResponseInterface, ServerRequestInterface};

final readonly class AdminController
{
    public function __construct(
        private ResponseFactoryInterface $responses,
        private RequestInput $input,
        private PageService $pages,
        private PageRepository $repository,
        private ThemeManager $themes,
        private PublicMenuRenderer $menus,
        private ThemeResourceService $records,
        private PublicMediaApi $media,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $gateway = new PageGateway($this->repository, $this->pages);
        $store = new DocumentStore();
        $id = (int) ($arguments['id'] ?? 0);
        try {
            $page = $gateway->find($id);
            if (str_ends_with($request->getUri()->getPath(), '/frame')) {
                $template = $this->layout((string) ($request->getQueryParams()['template'] ?? ''), $page);

                return $this->responses->html((new LayoutFrame($this->themes, $this->repository, $this->menus, $this->records, $this->media))->render($page, $template), 200, ['Cache-Control' => 'no-store']);
            }
            if ($request->getMethod() === 'PUT') {
                return $this->json($this->save($store, $gateway, $page, $this->body($request)));
            }

            return $this->json($this->document($store, $page));
        } catch (\InvalidArgumentException $error) {
            $status = $error->getCode() >= 400 && $error->getCode() < 500 ? $error->getCode() : 422;

            return $this->json(['error' => ['message' => $error->getMessage()]], $status);
        }
    }

    /** @return array<string, mixed> */
    private function document(DocumentStore $store, Page $page): array
    {
        $html = (string) $page->getAttribute('content');
        $stored = $store->get((int) $page->getAttribute('id'));
        $hash = DocumentStore::hash($html);
        if ($stored === null) {
            $state = 'new';
            $elements = trim($html) === '' ? [] : [['id' => 'imported', 'type' => 'html', 'html' => $html]];
        } elseif ($stored['html_hash'] === $hash) {
            $state = 'current';
            $elements = $stored['elements'];
        } else {
            $state = 'changed';
            $elements = [['id' => 'imported', 'type' => 'html', 'html' => $html]];
        }

        return [
            'page' => [
                'id' => (int) $page->getAttribute('id'),
                'title' => (string) $page->getAttribute('title'),
                'layout' => $this->layout('', $page),
            ],
            'layouts' => $this->themes->pageTemplates(),
            'elements' => $elements,
            'defaults' => (new SettingsStore())->get(),
            'base_hash' => $hash,
            'state' => $state,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    private function save(DocumentStore $store, PageGateway $gateway, Page $page, array $body): array
    {
        $html = (string) $page->getAttribute('content');
        if (($body['force'] ?? false) !== true && ($body['base_hash'] ?? null) !== DocumentStore::hash($html)) {
            throw new \InvalidArgumentException('Страницата е променена на друго място, след като я отворихте. Презаредете или запишете върху промените.', 409);
        }
        if (!is_array($body['elements'] ?? null) || !array_is_list($body['elements'])) {
            throw new \InvalidArgumentException('Невалидно съдържание.', 422);
        }
        $compiler = new HtmlCompiler();
        $settings = new SettingsStore();
        $elements = $compiler->normalize($body['elements']);
        $defaults = is_array($body['defaults'] ?? null)
            ? $compiler->normalizeDefaults($body['defaults'])
            : $compiler->normalizeDefaults($settings->get());
        $previous = $compiler->normalizeDefaults($settings->get());
        if (is_array($body['defaults'] ?? null) && json_encode($defaults) !== json_encode($previous)) {
            $settings->save($defaults);
            (new SitePublisher($store, $gateway, $this->media))->republishExcept((int) $page->getAttribute('id'), $defaults);
        }
        $compiled = $compiler->compile($elements, fn(int $id): string => (string) ($this->media->get($id)['url'] ?? ''), $defaults);
        $layout = $this->layout(is_string($body['layout'] ?? null) ? $body['layout'] : '', $page);
        $existing = $store->get((int) $page->getAttribute('id'));
        $gateway->write($page, $compiled, $layout);
        $fresh = $gateway->find((int) $page->getAttribute('id'));
        $written = (string) $fresh->getAttribute('content');
        $store->save((int) $page->getAttribute('id'), $elements, $written, $existing === null ? $html : null);

        return $this->document($store, $fresh);
    }

    /** @return array<string, mixed> */
    private function body(ServerRequestInterface $request): array
    {
        $body = $this->input->all($request);

        return is_array($body) ? $body : [];
    }

    private function layout(string $requested, Page $page): string
    {
        $templates = $this->themes->pageTemplates();
        $ids = array_column($templates, 'id');
        if ($requested !== '' && in_array($requested, $ids, true)) {
            return $requested;
        }
        $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
        $current = is_string($settings['template'] ?? null) ? $settings['template'] : '';

        return in_array($current, $ids, true) ? $current : (string) ($ids[0] ?? 'default');
    }

    /** @param array<string, mixed> $payload */
    private function json(array $payload, int $status = 200): ResponseInterface
    {
        return $this->responses->json($payload, $status, ['Cache-Control' => 'no-store']);
    }
}
