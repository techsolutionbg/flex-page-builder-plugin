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
        private PageLinks $links,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $gateway = new PageGateway($this->repository, $this->pages);
        $store = new DocumentStore();
        $chrome = new ChromeStore();
        $id = (int) ($arguments['id'] ?? 0);
        try {
            $page = $gateway->find($id);
            $path = $request->getUri()->getPath();
            if (str_ends_with($path, '/frame')) {
                $template = $this->layout((string) ($request->getQueryParams()['template'] ?? ''), $page);

                return $this->responses->html((new LayoutFrame($this->themes, $this->repository, $this->menus, $this->records, $this->media))->render($page, $template), 200, ['Cache-Control' => 'no-store']);
            }
            if (str_ends_with($path, '/chrome') && $request->getMethod() === 'PUT') {
                return $this->json($this->assignChrome($store, $chrome, $page, $this->body($request)));
            }
            if ($request->getMethod() === 'PUT') {
                return $this->json($this->save($store, $chrome, $gateway, $page, $this->body($request)));
            }

            return $this->json($this->document($store, $chrome, $page));
        } catch (\InvalidArgumentException $error) {
            $status = $error->getCode() >= 400 && $error->getCode() < 500 ? $error->getCode() : 422;

            return $this->json(['error' => ['message' => $error->getMessage()]], $status);
        }
    }

    /** @return array<string, mixed> */
    private function document(DocumentStore $store, ChromeStore $chrome, Page $page): array
    {
        $html = (string) $page->getAttribute('content');
        $stored = $store->get((int) $page->getAttribute('id'));
        $hash = DocumentStore::hash($html);
        if ($stored === null) {
            $state = 'new';
            $elements = trim($html) === '' ? [] : [['id' => 'imported', 'type' => 'html', 'html' => $html]];
            $headerId = null;
            $footerId = null;
        } elseif ($stored['html_hash'] === $hash) {
            $state = 'current';
            $elements = $stored['elements'];
            $headerId = $stored['header_id'];
            $footerId = $stored['footer_id'];
        } else {
            $state = 'changed';
            $elements = trim($html) === '' ? [] : [['id' => 'imported', 'type' => 'html', 'html' => $html]];
            $headerId = $stored['header_id'];
            $footerId = $stored['footer_id'];
        }
        $compiler = new HtmlCompiler();
        $loaded = (new SettingsStore())->load();
        $capabilities = $this->themes->capabilities();

        return [
            'page' => [
                'id' => (int) $page->getAttribute('id'),
                'title' => (string) $page->getAttribute('title'),
                'layout' => $this->layout('', $page),
                'header_id' => $headerId,
                'footer_id' => $footerId,
            ],
            'layouts' => $this->themes->pageTemplates(),
            'headers' => $chrome->list('header'),
            'footers' => $chrome->list('footer'),
            'pages' => $this->links->options(),
            'menus' => $this->menus->optionsForTheme($capabilities['theme'] ?? '', $this->repository->publicPageSet()),
            'elements' => $elements,
            'defaults' => $compiler->normalizeDefaults($loaded['defaults']),
            'button_styles' => $compiler->normalizeButtonStyles($loaded['button_styles']),
            'allow_html_import' => $loaded['allow_html_import'],
            'site_logos' => SiteLogo::urls($this->media),
            'base_hash' => $hash,
            'state' => $state,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    private function save(DocumentStore $store, ChromeStore $chrome, PageGateway $gateway, Page $page, array $body): array
    {
        $html = (string) $page->getAttribute('content');
        if (($body['force'] ?? false) !== true && ($body['base_hash'] ?? null) !== DocumentStore::hash($html)) {
            throw new \InvalidArgumentException('The page was changed elsewhere after you opened it. Reload the page or overwrite the changes.', 409);
        }
        if (!is_array($body['elements'] ?? null) || !array_is_list($body['elements'])) {
            throw new \InvalidArgumentException('Invalid content.', 422);
        }
        $compiler = new HtmlCompiler();
        $settings = new SettingsStore();
        $loaded = $settings->load();
        $elements = $compiler->normalize($body['elements']);
        if ($this->hasOpaqueExternalHtml($elements)) {
            throw new \InvalidArgumentException('Remove the unsupported external HTML block before saving.', 422);
        }
        $defaults = is_array($body['defaults'] ?? null)
            ? $compiler->normalizeDefaults($body['defaults'])
            : $compiler->normalizeDefaults($loaded['defaults']);
        $buttonStyles = is_array($body['button_styles'] ?? null)
            ? $compiler->normalizeButtonStyles($body['button_styles'])
            : $compiler->normalizeButtonStyles($loaded['button_styles']);
        $previousDefaults = $compiler->normalizeDefaults($loaded['defaults']);
        $previousStyles = $compiler->normalizeButtonStyles($loaded['button_styles']);
        $defaultsTouched = is_array($body['defaults'] ?? null);
        $stylesTouched = is_array($body['button_styles'] ?? null);
        $settingsChanged = ($defaultsTouched && json_encode($defaults) !== json_encode($previousDefaults))
            || ($stylesTouched && json_encode($buttonStyles) !== json_encode($previousStyles));
        if ($settingsChanged) {
            $settings->save($defaults, $buttonStyles, $loaded['allow_html_import']);
            (new SitePublisher($store, $gateway, $this->media, $this->links))->republishExcept(
                (int) $page->getAttribute('id'),
                $defaults,
                $buttonStyles,
            );
        }
        $compiled = $compiler->compile(
            $elements,
            fn(int $mediaId): string => (string) ($this->media->get($mediaId)['url'] ?? ''),
            $defaults,
            fn(int $pageId): string => $this->links->url($pageId),
            $buttonStyles,
            null,
            SiteLogo::urls($this->media),
        );
        $layout = $this->layout(is_string($body['layout'] ?? null) ? $body['layout'] : '', $page);
        $headerId = $this->resolveChromeId($chrome, $body['header_id'] ?? null, 'header');
        $footerId = $this->resolveChromeId($chrome, $body['footer_id'] ?? null, 'footer');
        $existing = $store->get((int) $page->getAttribute('id'));
        $gateway->write($page, $compiled, $layout);
        $fresh = $gateway->find((int) $page->getAttribute('id'));
        $written = (string) $fresh->getAttribute('content');
        $store->save((int) $page->getAttribute('id'), $elements, $written, $existing === null ? $html : null, $headerId, $footerId, true);

        return $this->document($store, $chrome, $fresh);
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    private function assignChrome(DocumentStore $store, ChromeStore $chrome, Page $page, array $body): array
    {
        $headerId = $this->resolveChromeId($chrome, $body['header_id'] ?? null, 'header');
        $footerId = $this->resolveChromeId($chrome, $body['footer_id'] ?? null, 'footer');
        $html = (string) $page->getAttribute('content');
        $store->assignChrome((int) $page->getAttribute('id'), $html, $headerId, $footerId);

        return $this->document($store, $chrome, $page);
    }

    private function resolveChromeId(ChromeStore $chrome, mixed $value, string $kind): ?string
    {
        $id = DocumentStore::chromeId($value);
        if ($id === null) {
            return null;
        }
        $item = $chrome->get($id);
        if ($item === null || $item['kind'] !== $kind) {
            return null;
        }

        return $id;
    }

    /** @param list<array<string, mixed>> $elements */
    private function hasOpaqueExternalHtml(array $elements): bool
    {
        foreach ($elements as $element) {
            if (($element['opaque_external'] ?? false) === true) {
                return true;
            }
            if (is_array($element['children'] ?? null) && $this->hasOpaqueExternalHtml($element['children'])) {
                return true;
            }
        }

        return false;
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
