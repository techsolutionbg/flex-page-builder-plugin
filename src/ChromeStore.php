<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Extension\V1\Time;
use Illuminate\Database\{Connection, Eloquent\Model, Schema\Blueprint};

/** Named header/footer builder documents shared across pages. */
final class ChromeStore
{
    public const MAX_BYTES = 1_000_000;

    public const KINDS = ['header', 'footer'];

    private Connection $db;

    public function __construct(?Connection $db = null)
    {
        $this->db = $db ?? Model::resolveConnection();
    }

    public function install(): void
    {
        $schema = $this->db->getSchemaBuilder();
        if ($schema->hasTable('flex_page_builder_chrome')) {
            if (!$schema->hasColumn('flex_page_builder_chrome', 'deleted_at')) {
                $schema->table('flex_page_builder_chrome', static function (Blueprint $table): void {
                    $table->timestamp('deleted_at')->nullable();
                });
            }

            return;
        }
        $schema->create('flex_page_builder_chrome', static function (Blueprint $table): void {
            $table->string('id', 32)->primary();
            $table->string('kind', 16);
            $table->string('name', 80);
            $table->longText('document');
            $table->longText('html');
            $table->char('html_hash', 64);
            $table->timestamp('updated_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->index('kind');
            $table->index('deleted_at');
        });
    }

    public function uninstall(): void
    {
        $this->db->getSchemaBuilder()->dropIfExists('flex_page_builder_chrome');
    }

    public static function newId(): string
    {
        return 'ch_' . bin2hex(random_bytes(4));
    }

    /** @return list<array{id: string, kind: string, name: string}> */
    public function list(?string $kind = null, string $view = 'active'): array
    {
        $query = $this->db->table('flex_page_builder_chrome')->orderBy('name')->orderBy('id');
        $view === 'trash' ? $query->whereNotNull('deleted_at') : $query->whereNull('deleted_at');
        if ($kind !== null && in_array($kind, self::KINDS, true)) {
            $query->where('kind', $kind);
        }
        $out = [];
        foreach ($query->get(['id', 'kind', 'name']) as $row) {
            $out[] = [
                'id' => (string) $row->id,
                'kind' => (string) $row->kind,
                'name' => (string) $row->name,
            ];
        }

        return $out;
    }

    /**
     * @return array{
     *   id: string,
     *   kind: string,
     *   name: string,
     *   elements: list<array<string, mixed>>,
     *   html: string,
     *   html_hash: string
     * }|null
     */
    public function get(string $id): ?array
    {
        if (!$this->validId($id)) {
            return null;
        }
        $row = $this->db->table('flex_page_builder_chrome')->where('id', $id)->whereNull('deleted_at')->first();
        if ($row === null) {
            return null;
        }
        $document = json_decode((string) $row->document, true);
        $elements = is_array($document) && is_array($document['elements'] ?? null) ? $document['elements'] : [];

        return [
            'id' => (string) $row->id,
            'kind' => (string) $row->kind,
            'name' => (string) $row->name,
            'elements' => array_is_list($elements) ? $elements : [],
            'html' => (string) $row->html,
            'html_hash' => (string) $row->html_hash,
        ];
    }

    public function html(string $id): ?string
    {
        $item = $this->get($id);
        if ($item === null) {
            return null;
        }
        $html = trim($item['html']);

        return $html === '' ? null : $html;
    }

    /**
     * @param list<array<string, mixed>> $elements
     * @return array{id: string, kind: string, name: string, elements: list<array<string, mixed>>, html: string, html_hash: string}
     */
    public function save(string $id, string $kind, string $name, array $elements, string $html): array
    {
        if (!$this->validId($id)) {
            throw new \InvalidArgumentException('Невалиден идентификатор.', 422);
        }
        if (!in_array($kind, self::KINDS, true)) {
            throw new \InvalidArgumentException('Невалиден тип.', 422);
        }
        $name = trim(mb_substr($name, 0, 80));
        if ($name === '') {
            $name = $kind === 'footer' ? 'Footer' : 'Header';
        }
        $encoded = json_encode(['elements' => $elements], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if (strlen($encoded) > self::MAX_BYTES) {
            throw new \InvalidArgumentException('Документът е твърде голям.', 422);
        }
        $hash = DocumentStore::hash($html);
        $values = [
            'kind' => $kind,
            'name' => $name,
            'document' => $encoded,
            'html' => $html,
            'html_hash' => $hash,
            'updated_at' => Time::now(),
        ];
        $existing = $this->db->table('flex_page_builder_chrome')->where('id', $id)->first(['deleted_at']);
        if ($existing !== null && $existing->deleted_at !== null) {
            throw new \InvalidArgumentException('Записът е в кошчето. Възстановете го преди редактиране.', 409);
        }
        if ($existing !== null) {
            $this->db->table('flex_page_builder_chrome')->where('id', $id)->update($values);
        } else {
            $this->db->table('flex_page_builder_chrome')->insert($values + ['id' => $id]);
        }

        return [
            'id' => $id,
            'kind' => $kind,
            'name' => $name,
            'elements' => $elements,
            'html' => $html,
            'html_hash' => $hash,
        ];
    }

    public function trash(string $id): bool
    {
        if (!$this->validId($id)) {
            return false;
        }

        return $this->db->table('flex_page_builder_chrome')
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->update(['deleted_at' => Time::now()]) > 0;
    }

    public function restore(string $id): bool
    {
        if (!$this->validId($id)) {
            return false;
        }

        return $this->db->table('flex_page_builder_chrome')
            ->where('id', $id)
            ->whereNotNull('deleted_at')
            ->update(['deleted_at' => null, 'updated_at' => Time::now()]) > 0;
    }

    public function forceDelete(string $id): bool
    {
        if (!$this->validId($id)) {
            return false;
        }

        return $this->db->table('flex_page_builder_chrome')
            ->where('id', $id)
            ->whereNotNull('deleted_at')
            ->delete() > 0;
    }

    public function validId(string $id): bool
    {
        return (bool) preg_match('/^ch_[a-z0-9]{8}$/', $id);
    }
}
