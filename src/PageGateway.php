<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Pages\{Page, PageRepository, PageService};
use Flex\Pages\Exception\{PageNotFound, PageValidationFailed};

/** Reads a page and writes builder HTML and the chosen theme layout back through the page service. */
final class PageGateway
{
    public function __construct(private PageRepository $pages, private PageService $service) {}

    public function find(int $id): Page
    {
        $page = $this->pages->find($id);
        if (!$page instanceof Page || $page->getAttribute('deleted_at') !== null) {
            throw new \InvalidArgumentException('Страницата не е намерена.', 404);
        }

        return $page;
    }

    public function write(Page $page, string $html, string $template): void
    {
        $id = (int) $page->getAttribute('id');
        $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
        $settings['content_builder'] = 'flex/page-builder';
        $settings['template'] = $template;
        try {
            $currentSettings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
            if (($currentSettings['content_builder'] ?? null) !== 'flex/page-builder'
                || (string) ($settings['template'] ?? '') !== (string) ($currentSettings['template'] ?? '')) {
                $this->service->updateSettings($id, $settings);
            }
            if ($html !== (string) $page->getAttribute('content')) {
                $this->service->update($id, [
                    'title' => (string) $page->getAttribute('title'),
                    'slug' => (string) $page->getAttribute('slug'),
                    'content' => $html,
                    'blocks' => is_array($page->getAttribute('blocks')) ? $page->getAttribute('blocks') : [],
                    'status' => (string) $page->getAttribute('status'),
                    'parent_id' => $page->getAttribute('parent_id'),
                    'featured_media_id' => $page->getAttribute('featured_media_id'),
                ]);
            }
        } catch (PageValidationFailed $error) {
            throw new \InvalidArgumentException($error->getMessage(), 422);
        } catch (PageNotFound) {
            throw new \InvalidArgumentException('Страницата не е намерена.', 404);
        }
    }
}
