<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Media\PublicMediaApi;
use Flex\Menus\{PublicMenuApi, PublicMenuRenderer};
use Flex\Pages\{Page, PageRepository};
use Flex\Themes\{ThemeManager, ThemeResourceService};

/** Renders the theme layout with an empty content slot so the builder can fill only that region. */
final class LayoutFrame
{
    public function __construct(
        private ThemeManager $themes,
        private PageRepository $pages,
        private PublicMenuRenderer $menus,
        private ThemeResourceService $records,
        private ?PublicMediaApi $media,
    ) {}

    public function render(Page $page, string $template): string
    {
        $preview = clone $page;
        $preview->setAttribute('content', '');
        $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
        $settings['template'] = $template;
        $preview->setAttribute('settings', $settings);

        $publicPages = $this->pages->publicPageSet();
        $capabilities = $this->themes->capabilities();
        $menuData = $this->menus->forTheme($capabilities['theme'] ?? '', $publicPages, $capabilities['menu_locations']);
        $menuData['__flex_menu_api'] = new PublicMenuApi($this->menus, $publicPages);
        $menuData['__flex_media_api'] = $this->media;
        $menuData['__flex_theme_records'] = fn(string $resource): array => $this->records->published($resource);
        $menuData['featured_media'] = $this->media?->get((int) $page->getAttribute('featured_media_id')) ?? [];

        $html = $this->themes->render('page.twig', (new ThemeChrome())->inject([
            'page' => $preview,
            'page_public_path' => $publicPages->publicPath($page),
            'page_settings' => $settings,
            'head_tags' => '',
            'document_title' => (string) $page->getAttribute('title'),
            'navigation' => [],
            'flex_page_builder' => true,
        ] + $menuData));

        $guard = '<script>document.addEventListener("click",function(event){var link=event.target.closest&&event.target.closest("a");if(link)event.preventDefault();},true);</script>';

        return str_contains($html, '</body>') ? str_replace('</body>', $guard . '</body>', $html) : $html . $guard;
    }
}
