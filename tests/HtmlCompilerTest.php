<?php

declare(strict_types=1);

namespace Flex\Tests\PageBuilder;

use Flex\PageBuilder\HtmlCompiler;
use PHPUnit\Framework\TestCase;

final class HtmlCompilerTest extends TestCase
{
    private HtmlCompiler $compiler;

    protected function setUp(): void
    {
        require_once dirname(__DIR__) . '/src/HtmlCompiler.php';
        $this->compiler = new HtmlCompiler();
    }

    public function testItCompilesEscapedContentInsideTheBuilderRoot(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'title', 'type' => 'heading', 'level' => 6, 'text' => '<script>', 'size' => 14],
            ['id' => 'link', 'type' => 'button', 'text' => 'Напред', 'url' => 'javascript:alert(1)'],
            ['id' => 'gap', 'type' => 'spacer', 'height' => 24],
        ], static fn(int $id): string => '/media/' . $id);

        self::assertStringStartsWith('<div class="fpb-root">', $html);
        self::assertStringContainsString('<h6 style="font-size:14px">&lt;script&gt;</h6>', $html);
        self::assertStringContainsString('href="#"', $html);
        self::assertStringContainsString('height:24px', $html);
        self::assertStringNotContainsString('<script>', $html);
    }

    public function testItDropsUnsafeMarkupFromTheHtmlElement(): void
    {
        $html = $this->compiler->compile([
            ['type' => 'html', 'html' => '<p onclick="evil()">Текст</p><script>alert(1)</script>'],
        ], static fn(int $id): string => '');

        self::assertStringContainsString('<p>Текст</p>', $html);
        self::assertStringNotContainsString('onclick', $html);
        self::assertStringNotContainsString('<script>', $html);
    }

    public function testItOmitsAnImageWithoutAPublicAddress(): void
    {
        $html = $this->compiler->compile([
            ['id' => 'photo', 'type' => 'image', 'media_id' => 4, 'alt' => 'Лого'],
        ], static fn(int $id): string => '');

        self::assertStringNotContainsString('<img', $html);
        self::assertSame('', $html);
    }
}
