<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Extension\V1\{BootablePluginInterface, EventNames, ExtensionEventInterface, PageEvent, PluginContext, PluginInterface, UninstallablePluginInterface, UpdatablePluginInterface};
use Flex\Pages\Page;

final class PageBuilderPlugin implements PluginInterface, BootablePluginInterface, UpdatablePluginInterface, UninstallablePluginInterface
{
    public function install(PluginContext $context): void
    {
        (new DocumentStore())->install();
        (new SettingsStore())->install();
        (new ChromeStore())->install();
    }

    public function activate(PluginContext $context): void
    {
        $this->install($context);
    }

    public function update(PluginContext $context, string $fromVersion): void
    {
        $this->install($context);
    }

    public function deactivate(PluginContext $context): void {}

    public function uninstall(PluginContext $context): void
    {
        (new SettingsStore())->uninstall();
        (new ChromeStore())->uninstall();
        (new DocumentStore())->uninstall();
    }

    public function boot(PluginContext $context): void
    {
        // Idempotent: already-active installs get the chrome table without reactivating.
        (new ChromeStore())->install();
        $this->associateExistingDocuments();

        // Older builder versions escaped shortcode quotes while compiling HTML.
        // Decode only valid shortcode text inside the dedicated wrapper before other renderers run.
        $context->api->addFilter('public.content', static function (mixed $html): mixed {
            if (!is_string($html)) {
                return $html;
            }

            return preg_replace_callback('#(<div class="fpb-shortcode">)(.*?)(</div>)#s', static function (array $match): string {
                $shortcode = html_entity_decode($match[2], ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
                if (preg_match('/^(?:\[[a-zA-Z][a-zA-Z0-9_-]*(?:\s[^\[\]<>]*)?\]\s*)+$/D', $shortcode) !== 1) {
                    return $match[0];
                }

                return $match[1] . $shortcode . $match[3];
            }, $html) ?? $html;
        }, 1);

        $context->routes?->admin('GET', '/pages/{id:number}', AdminController::class, 'page');
        $context->routes?->admin('PUT', '/pages/{id:number}', AdminController::class, 'page-save');
        $context->routes?->admin('PUT', '/pages/{id:number}/chrome', AdminController::class, 'page-chrome');
        $context->routes?->admin('GET', '/pages/{id:number}/frame', AdminController::class, 'frame');
        $context->routes?->admin('GET', '/chrome', ChromeController::class, 'chrome-list');
        $context->routes?->admin('PUT', '/chrome', ChromeController::class, 'chrome-list-save');
        $context->routes?->admin('GET', '/chrome/frame', ChromeController::class, 'chrome-frame');
        $context->routes?->admin('POST', '/shortcode-preview', ChromeController::class, 'shortcode-preview');
        $context->routes?->admin('GET', '/chrome/{id}', ChromeController::class, 'chrome-get');
        $context->routes?->admin('PUT', '/chrome/{id}', ChromeController::class, 'chrome-save');
        $context->routes?->admin('DELETE', '/chrome/{id}', ChromeController::class, 'chrome-delete');
        $context->routes?->admin('POST', '/chrome/{id}/restore', ChromeController::class, 'chrome-restore');
        $context->routes?->admin('DELETE', '/chrome/{id}/force', ChromeController::class, 'chrome-force-delete');

        $context->admin?->page('chrome', 'Headers & Footers', 'assets/lib/chrome-admin.js', true, ['group' => 'content', 'icon' => 'file-text', 'order' => 20]);
        $context->admin?->page('editor', 'Page Builder', 'assets/admin.js', false, ['group' => 'content', 'icon' => 'file-text', 'hidden' => true]);
        // Row/editor entry points stay on links.js so a broken editor module cannot hide the buttons.
        $context->admin?->extend('pages.list', 'table.row-action', 'open', 'assets/lib/links.js', ['export' => 'createPageAction']);
        $context->admin?->panel('page.settings', 'chrome', 'Headers & Footers', 'assets/lib/page-chrome.js', [
            'export' => 'createPageChromePanel',
            'icon' => 'file-text',
            'order' => 30,
        ]);

        $context->api->addFilter('theme.render.data', static function (mixed $data): mixed {
            if (!is_array($data)) {
                return $data;
            }

            return (new ThemeChrome())->inject($data);
        });

        $context->api->listen(EventNames::PAGE_DELETED, static function (ExtensionEventInterface $event): void {
            if ($event instanceof PageEvent && is_int($event->page['id'] ?? null)) {
                (new DocumentStore())->delete($event->page['id']);
            }
        });
    }

    /** Mark documents created by earlier plugin versions so the standard page editor can identify them. */
    private function associateExistingDocuments(): void
    {
        $pageIds = (new DocumentStore())->pageIds();
        if ($pageIds === []) {
            return;
        }
        foreach (Page::query()->whereIn('id', $pageIds)->get() as $page) {
            $settings = is_array($page->getAttribute('settings')) ? $page->getAttribute('settings') : [];
            if (isset($settings['content_builder']) && $settings['content_builder'] !== '') {
                continue;
            }
            $settings['content_builder'] = 'flex/page-builder';
            $page->setAttribute('settings', $settings);
            $page->saveOrFail();
        }
    }
}
