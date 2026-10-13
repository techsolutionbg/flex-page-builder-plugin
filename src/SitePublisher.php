<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Media\PublicMediaApi;

/** Rebuilds saved page HTML from the stored documents and the current global defaults. */
final class SitePublisher
{
    public function __construct(
        private DocumentStore $documents,
        private PageGateway $gateway,
        private PublicMediaApi $media,
        private PageLinks $links,
    ) {}

    /**
     * @param array<string, array<string, mixed>> $defaults
     * @param list<array<string, mixed>> $buttonStyles
     */
    public function republishExcept(int $exceptId, array $defaults, array $buttonStyles = []): void
    {
        $compiler = new HtmlCompiler();
        foreach ($this->documents->pageIds() as $pageId) {
            if ($pageId === $exceptId) {
                continue;
            }
            $stored = $this->documents->get($pageId);
            if ($stored === null) {
                continue;
            }
            try {
                $page = $this->gateway->find($pageId);
            } catch (\InvalidArgumentException) {
                continue;
            }
            $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
            $template = is_string($settings['template'] ?? null) ? $settings['template'] : 'default';
            $html = $compiler->compile(
                $stored['elements'],
                fn(int $id): string => (string) ($this->media->get($id)['url'] ?? ''),
                $defaults,
                fn(int $id): string => $this->links->url($id),
                $buttonStyles,
            );
            $this->gateway->write($page, $html, $template);
            $fresh = $this->gateway->find($pageId);
            $this->documents->save($pageId, $stored['elements'], (string) $fresh->getAttribute('content'), null);
        }
    }
}
