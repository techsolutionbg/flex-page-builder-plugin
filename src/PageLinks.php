<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Pages\{HomePageResolver, Page, PageRepository};

/** Resolves public paths for page links inside compiled builder HTML. */
final readonly class PageLinks
{
    public function __construct(
        private PageRepository $pages,
        private HomePageResolver $home,
    ) {}

    /** @return list<array{id: int, title: string, path: string}> */
    public function options(): array
    {
        $homeId = $this->homeId();
        $out = [];
        foreach ($this->pages->all() as $page) {
            if (!$page instanceof Page || $page->getAttribute('deleted_at') !== null) {
                continue;
            }
            $id = (int) $page->getKey();
            $out[] = [
                'id' => $id,
                'title' => (string) $page->getAttribute('title'),
                'path' => $this->pathFor($page, $homeId),
            ];
        }
        usort($out, static fn(array $a, array $b): int => strcmp($a['title'], $b['title']));

        return $out;
    }

    public function url(int $id): string
    {
        $page = $this->pages->find($id);
        if (!$page instanceof Page || $page->getAttribute('deleted_at') !== null) {
            return '';
        }

        return $this->pathFor($page, $this->homeId());
    }

    private function homeId(): int
    {
        $home = $this->home->resolve($this->pages->publicPageSet());

        return $home instanceof Page ? (int) $home->getKey() : 0;
    }

    private function pathFor(Page $page, int $homeId): string
    {
        $id = (int) $page->getKey();
        if ($homeId > 0 && $id === $homeId) {
            return '/';
        }
        $path = trim($this->pages->publicPath($page), '/');

        return $path === '' ? '/' : '/' . $path;
    }
}
