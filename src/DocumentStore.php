<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Extension\V1\Time;
use Illuminate\Database\{Connection, Eloquent\Model, Schema\Blueprint};

/** The element document for one page. The theme layout stays on the page; this is only the content tree. */
final class DocumentStore
{
    public const MAX_BYTES = 1_000_000;

    private Connection $db;

    public function __construct(?Connection $db = null)
    {
        $this->db = $db ?? Model::resolveConnection();
    }

    public function install(): void
    {
        $schema = $this->db->getSchemaBuilder();
        if ($schema->hasTable('flex_page_builder_documents')) {
            return;
        }
        $schema->create('flex_page_builder_documents', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('page_id')->unique();
            $table->longText('document');
            $table->char('html_hash', 64);
            $table->longText('source_html')->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function uninstall(): void
    {
        $this->db->getSchemaBuilder()->dropIfExists('flex_page_builder_documents');
    }

    /**
     * @return array{
     *   elements: list<array<string, mixed>>,
     *   header_id: ?string,
     *   footer_id: ?string,
     *   html_hash: string,
     *   has_source: bool
     * }|null
     */
    public function get(int $pageId): ?array
    {
        $row = $this->db->table('flex_page_builder_documents')->where('page_id', $pageId)->first();
        if ($row === null) {
            return null;
        }
        $document = json_decode((string) $row->document, true);
        $elements = is_array($document) && is_array($document['elements'] ?? null) ? $document['elements'] : [];

        return [
            'elements' => array_is_list($elements) ? $elements : [],
            'header_id' => self::chromeId($document['header_id'] ?? null),
            'footer_id' => self::chromeId($document['footer_id'] ?? null),
            'html_hash' => (string) $row->html_hash,
            'has_source' => $row->source_html !== null,
        ];
    }

    /**
     * @param list<array<string, mixed>> $elements
     */
    public function save(
        int $pageId,
        array $elements,
        string $html,
        ?string $sourceHtml,
        ?string $headerId = null,
        ?string $footerId = null,
    ): void {
        $payload = [
            'elements' => $elements,
            'header_id' => self::chromeId($headerId),
            'footer_id' => self::chromeId($footerId),
        ];
        $encoded = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if (strlen($encoded) > self::MAX_BYTES) {
            throw new \InvalidArgumentException('The document is too large.', 422);
        }
        $existing = $this->db->table('flex_page_builder_documents')->where('page_id', $pageId)->first();
        $values = [
            'document' => $encoded,
            'html_hash' => self::hash($html),
            'updated_at' => Time::now(),
        ];
        if ($existing === null) {
            $this->db->table('flex_page_builder_documents')->insert($values + [
                'page_id' => $pageId,
                'source_html' => $sourceHtml,
            ]);

            return;
        }
        $this->db->table('flex_page_builder_documents')->where('id', $existing->id)->update($values);
    }

    /** Update only header/footer assignment; keep elements and match the page HTML hash. */
    public function assignChrome(int $pageId, string $html, ?string $headerId, ?string $footerId): void
    {
        $existing = $this->get($pageId);
        $this->save(
            $pageId,
            $existing['elements'] ?? [],
            $html,
            $existing === null ? $html : null,
            $headerId,
            $footerId,
        );
    }

    public function delete(int $pageId): void
    {
        $this->db->table('flex_page_builder_documents')->where('page_id', $pageId)->delete();
    }

    /** @return list<int> */
    public function pageIds(): array
    {
        return array_values(array_map('intval', $this->db->table('flex_page_builder_documents')->pluck('page_id')->all()));
    }

    public static function hash(string $html): string
    {
        return hash('sha256', str_replace("\r\n", "\n", $html));
    }

    public static function chromeId(mixed $value): ?string
    {
        if (!is_string($value) || $value === '') {
            return null;
        }

        return preg_match('/^ch_[a-z0-9]{8}$/', $value) === 1 ? $value : null;
    }
}
