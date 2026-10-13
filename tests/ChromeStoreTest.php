<?php

declare(strict_types=1);

namespace Flex\Tests\PageBuilder;

use Flex\Configuration\ConfigurationRepository;
use Flex\Database\DatabaseManager;
use Flex\PageBuilder\{ChromeStore, DocumentStore, HtmlCompiler, ThemeChrome};
use PHPUnit\Framework\TestCase;

final class ChromeStoreTest extends TestCase
{
    private DatabaseManager $database;
    private ChromeStore $store;
    private DocumentStore $documents;

    protected function setUp(): void
    {
        require_once dirname(__DIR__) . '/src/HtmlCompiler.php';
        require_once dirname(__DIR__) . '/src/DocumentStore.php';
        require_once dirname(__DIR__) . '/src/ChromeStore.php';
        require_once dirname(__DIR__) . '/src/ThemeChrome.php';

        $config = new ConfigurationRepository([
            'database' => [
                'default' => 'sqlite',
                'connections' => [
                    'sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
                ],
            ],
        ]);
        $this->database = new DatabaseManager($config);
        $this->database->connection();
        $this->store = new ChromeStore($this->database->connection());
        $this->documents = new DocumentStore($this->database->connection());
        $this->store->install();
        $this->documents->install();
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
    }

    public function testItSavesAndLoadsChromeWithCompiledRoot(): void
    {
        $id = ChromeStore::newId();
        $compiler = new HtmlCompiler();
        $elements = $compiler->normalize([
            ['id' => 'h1', 'type' => 'heading', 'text' => 'Меню', 'level' => 2],
        ]);
        $html = $compiler->compile($elements, static fn(int $mediaId): string => '', [], null, [], 'header');
        $saved = $this->store->save($id, 'header', 'Основна шапка', $elements, $html);

        self::assertStringContainsString('fpb-root fpb-chrome fpb-chrome--header', $saved['html']);
        self::assertSame($html, $this->store->html($id));
    }

    public function testDocumentRoundTripsHeaderAndFooterIds(): void
    {
        $headerId = ChromeStore::newId();
        $footerId = ChromeStore::newId();
        $this->documents->save(12, [], '<div class="fpb-root"></div>', null, $headerId, $footerId);
        $loaded = $this->documents->get(12);
        self::assertSame($headerId, $loaded['header_id'] ?? null);
        self::assertSame($footerId, $loaded['footer_id'] ?? null);
    }

    public function testThemeChromeFallsBackToThemeForInvalidIds(): void
    {
        $chrome = new ThemeChrome($this->documents, $this->store);
        $data = $chrome->inject(['page' => ['id' => 1]]);
        self::assertNull($data['flex_builder_header']);
        self::assertNull($data['flex_builder_footer']);
    }
}
