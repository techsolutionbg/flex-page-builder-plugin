<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Extension\V1\{BootablePluginInterface, EventNames, ExtensionEventInterface, PageEvent, PluginContext, PluginInterface, UninstallablePluginInterface, UpdatablePluginInterface};

final class PageBuilderPlugin implements PluginInterface, BootablePluginInterface, UpdatablePluginInterface, UninstallablePluginInterface
{
    public function install(PluginContext $context): void
    {
        (new DocumentStore())->install();
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
        (new DocumentStore())->uninstall();
    }

    public function boot(PluginContext $context): void
    {
        $context->routes?->admin('GET', '/pages/{id:number}', AdminController::class, 'page');
        $context->routes?->admin('PUT', '/pages/{id:number}', AdminController::class, 'page-save');
        $context->routes?->admin('GET', '/pages/{id:number}/frame', AdminController::class, 'frame');

        $context->admin?->page('editor', 'Page Builder', 'assets/admin.js', false, ['group' => 'content', 'icon' => 'file-text', 'hidden' => true]);
        $context->admin?->extend('pages.list', 'table.row-action', 'open', 'assets/admin.js', ['export' => 'createPageAction']);
        $context->admin?->extend('page.editor.content', 'section.start', 'editor-link', 'assets/admin.js', ['export' => 'createEditorLink']);

        $context->api->listen(EventNames::PAGE_DELETED, static function (ExtensionEventInterface $event): void {
            if ($event instanceof PageEvent && is_int($event->page['id'] ?? null)) {
                (new DocumentStore())->delete($event->page['id']);
            }
        });
    }
}
