<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Extensions\FrontendExtensionAssets;
use Flex\Http\RequestInput;
use Flex\Media\PublicMediaApi;
use Flex\Menus\PublicMenuRenderer;
use Flex\Pages\{Page, PageRepository};
use Flex\Themes\{ThemeManager, ThemeResourceService};
use Psr\Http\Message\{ResponseInterface, ServerRequestInterface};

final readonly class ChromeController
{
    public function __construct(
        private ResponseFactoryInterface $responses,
        private RequestInput $input,
        private PublicMediaApi $media,
        private PageLinks $links,
        private ThemeManager $themes,
        private PageRepository $pages,
        private PublicMenuRenderer $menus,
        private ThemeResourceService $records,
        private ExtensionApiInterface $extensionApi,
        private FrontendExtensionAssets $frontendAssets,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $store = new ChromeStore();
        $id = (string) ($arguments['id'] ?? '');
        $path = $request->getUri()->getPath();
        try {
            if (str_ends_with($path, '/frame')) {
                return $this->responses->html($this->frame((string) ($request->getQueryParams()['template'] ?? '')), 200, ['Cache-Control' => 'no-store']);
            }
            if (str_ends_with($path, '/shortcode-preview') && $request->getMethod() === 'POST') {
                $body = $this->body($request);
                $shortcode = trim((string) ($body['shortcode'] ?? ''));
                if (mb_strlen($shortcode) > 1000 || preg_match('/^(?:\[[a-zA-Z][a-zA-Z0-9_-]*(?:\s[^\[\]<>]*)?\]\s*)+$/', $shortcode) !== 1) {
                    throw new \InvalidArgumentException('Въведете валиден кратък код.', 422);
                }
                $pageId = filter_var($body['page_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
                $page = is_int($pageId) ? $this->pages->find($pageId) : null;
                $context = ['request' => $request];
                if ($page !== null) {
                    $context['page'] = $page->toPublicArray();
                }
                $html = $this->extensionApi->applyFilters('public.content', $shortcode, $context);

                return $this->json([
                    'html' => is_string($html) ? $html : $shortcode,
                    'rendered' => is_string($html) && $html !== $shortcode,
                    'styles' => $this->frontendAssets->publicStyles(),
                ]);
            }
            if ($id === '') {
                if ($request->getMethod() === 'PUT') {
                    return $this->json($this->replaceLibrary($store, $this->body($request)));
                }

                $view = ($request->getQueryParams()['view'] ?? 'active') === 'trash' ? 'trash' : 'active';
                $compiler = new HtmlCompiler();
                $loaded = (new SettingsStore())->load();

                return $this->json([
                    'headers' => $store->list('header'),
                    'footers' => $store->list('footer'),
                    'items' => $store->list(null, $view),
                    'layouts' => $this->themes->pageTemplates(),
                    'defaults' => $compiler->normalizeDefaults($loaded['defaults']),
                    'button_styles' => $compiler->normalizeButtonStyles($loaded['button_styles']),
                    'site_logos' => SiteLogo::urls($this->media),
                ]);
            }
            if ($request->getMethod() === 'POST' && str_ends_with($path, '/restore')) {
                if (!$store->restore($id)) {
                    throw new \InvalidArgumentException('Записът не е намерен в кошчето.', 404);
                }

                return $this->json(['ok' => true]);
            }
            if ($request->getMethod() === 'DELETE' && str_ends_with($path, '/force')) {
                if (!$store->forceDelete($id)) {
                    throw new \InvalidArgumentException('Окончателно се изтрива само запис от кошчето.', 404);
                }

                return $this->json(['ok' => true]);
            }
            if ($request->getMethod() === 'PUT') {
                return $this->json($this->saveOne($store, $id, $this->body($request)));
            }
            if ($request->getMethod() === 'DELETE') {
                if (!$store->trash($id)) {
                    throw new \InvalidArgumentException('Записът не е намерен.', 404);
                }

                return $this->json(['ok' => true]);
            }
            $item = $store->get($id);
            if ($item === null) {
                throw new \InvalidArgumentException('Header/Footer не е намерен.', 404);
            }

            return $this->json($item);
        } catch (\InvalidArgumentException $error) {
            $status = $error->getCode() >= 400 && $error->getCode() < 500 ? (int) $error->getCode() : 422;

            return $this->json(['error' => ['message' => $error->getMessage()]], $status);
        }
    }

    /**
     * @param array<string, mixed> $body
     * @return array{headers: list<array{id: string, kind: string, name: string}>, footers: list<array{id: string, kind: string, name: string}>}
     */
    private function replaceLibrary(ChromeStore $store, array $body): array
    {
        // Metadata-only sync is not used in v1; keep GET list shape for clients.
        return [
            'headers' => $store->list('header'),
            'footers' => $store->list('footer'),
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array{id: string, kind: string, name: string, elements: list<array<string, mixed>>, html: string, html_hash: string}
     */
    private function saveOne(ChromeStore $store, string $id, array $body): array
    {
        $kind = is_string($body['kind'] ?? null) ? $body['kind'] : '';
        if (!in_array($kind, ChromeStore::KINDS, true)) {
            throw new \InvalidArgumentException('Невалиден тип.', 422);
        }
        if (!is_array($body['elements'] ?? null) || !array_is_list($body['elements'])) {
            throw new \InvalidArgumentException('Невалидно съдържание.', 422);
        }
        $name = is_string($body['name'] ?? null) ? $body['name'] : '';
        $compiler = new HtmlCompiler();
        $settings = (new SettingsStore())->load();
        $elements = $compiler->normalize($body['elements']);
        $defaults = $compiler->normalizeDefaults($settings['defaults']);
        $buttonStyles = $compiler->normalizeButtonStyles($settings['button_styles']);
        $html = $compiler->compile(
            $elements,
            fn(int $mediaId): string => (string) ($this->media->get($mediaId)['url'] ?? ''),
            $defaults,
            fn(int $pageId): string => $this->links->url($pageId),
            $buttonStyles,
            $kind,
            SiteLogo::urls($this->media),
        );

        return $store->save($id, $kind, $name, $elements, $html);
    }

    /** @return array<string, mixed> */
    private function body(ServerRequestInterface $request): array
    {
        $body = $this->input->all($request);

        return is_array($body) ? $body : [];
    }

    private function frame(string $requested): string
    {
        $page = Page::query()->orderBy('id')->first();
        if (!$page instanceof Page) {
            throw new \InvalidArgumentException('Няма страница за преглед на лейаута. Създайте поне една страница.', 422);
        }
        $templates = $this->themes->pageTemplates();
        $ids = array_column($templates, 'id');
        $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
        $current = is_string($settings['template'] ?? null) ? $settings['template'] : '';
        $template = $requested !== '' && in_array($requested, $ids, true)
            ? $requested
            : (in_array($current, $ids, true) ? $current : (string) ($ids[0] ?? 'default'));

        return (new LayoutFrame($this->themes, $this->pages, $this->menus, $this->records, $this->media))->render($page, $template, true);
    }

    /** @param array<string, mixed> $payload */
    private function json(array $payload, int $status = 200): ResponseInterface
    {
        return $this->responses->json($payload, $status, ['Cache-Control' => 'no-store']);
    }
}
