<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Pages\Page;

/** Resolves builder header/footer HTML for a public page render. */
final class ThemeChrome
{
    public function __construct(
        private DocumentStore $documents = new DocumentStore(),
        private ChromeStore $chrome = new ChromeStore(),
    ) {}

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function inject(array $data): array
    {
        if (($data['flex_page_builder_chrome_preview'] ?? false) === true) {
            $data['flex_builder_header'] = null;
            $data['flex_builder_footer'] = null;

            return $data;
        }

        $page = $data['page'] ?? null;
        $pageId = null;
        if ($page instanceof Page) {
            $pageId = (int) $page->getAttribute('id');
        } elseif (is_array($page) && is_int($page['id'] ?? null)) {
            $pageId = $page['id'];
        } elseif (is_array($page) && is_numeric($page['id'] ?? null)) {
            $pageId = (int) $page['id'];
        }
        $headerId = null;
        $footerId = null;
        if ($pageId !== null && $pageId > 0) {
            $stored = $this->documents->get($pageId);
            $headerId = is_string($stored['header_id'] ?? null) ? $stored['header_id'] : null;
            $footerId = is_string($stored['footer_id'] ?? null) ? $stored['footer_id'] : null;
        }
        $data['flex_builder_header'] = $this->resolve($headerId, 'header');
        $data['flex_builder_footer'] = $this->resolve($footerId, 'footer');

        return $data;
    }

    private function resolve(?string $id, string $kind): ?string
    {
        if ($id === null || $id === '') {
            return null;
        }
        $item = $this->chrome->get($id);
        if ($item === null || $item['kind'] !== $kind) {
            return null;
        }
        $html = trim($item['html']);

        return $html === '' ? null : $html;
    }
}
