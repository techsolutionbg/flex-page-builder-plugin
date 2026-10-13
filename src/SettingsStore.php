<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Extension\V1\Time;
use Illuminate\Database\{Connection, Eloquent\Model, Schema\Blueprint};

/** Site-wide defaults and named button designs, shared by every page. */
final class SettingsStore
{
    private Connection $db;

    public function __construct(?Connection $db = null)
    {
        $this->db = $db ?? Model::resolveConnection();
    }

    public function install(): void
    {
        $schema = $this->db->getSchemaBuilder();
        if ($schema->hasTable('flex_page_builder_settings')) {
            return;
        }
        $schema->create('flex_page_builder_settings', static function (Blueprint $table): void {
            $table->increments('id');
            $table->longText('document');
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function uninstall(): void
    {
        $this->db->getSchemaBuilder()->dropIfExists('flex_page_builder_settings');
    }

    /**
     * @return array{
     *   defaults: array<string, array<string, mixed>>,
     *   button_styles: list<array<string, mixed>>
     * }
     */
    public function load(): array
    {
        $this->install();
        $row = $this->db->table('flex_page_builder_settings')->where('id', 1)->first();
        if ($row === null) {
            return ['defaults' => [], 'button_styles' => []];
        }
        $document = json_decode((string) $row->document, true);
        if (!is_array($document)) {
            return ['defaults' => [], 'button_styles' => []];
        }
        $defaults = is_array($document['defaults'] ?? null) ? $document['defaults'] : [];
        $styles = is_array($document['button_styles'] ?? null) ? $document['button_styles'] : [];

        return [
            'defaults' => is_array($defaults) ? $defaults : [],
            'button_styles' => array_is_list($styles) ? $styles : [],
        ];
    }

    /** @return array<string, array<string, mixed>> */
    public function get(): array
    {
        return $this->load()['defaults'];
    }

    /** @return list<array<string, mixed>> */
    public function buttonStyles(): array
    {
        return $this->load()['button_styles'];
    }

    /**
     * @param array<string, array<string, mixed>> $defaults
     * @param list<array<string, mixed>> $buttonStyles
     */
    public function save(array $defaults, array $buttonStyles = []): void
    {
        $this->install();
        $encoded = json_encode([
            'defaults' => $defaults,
            'button_styles' => $buttonStyles,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        $values = ['document' => $encoded, 'updated_at' => Time::now()];
        if ($this->db->table('flex_page_builder_settings')->where('id', 1)->exists()) {
            $this->db->table('flex_page_builder_settings')->where('id', 1)->update($values);

            return;
        }
        $this->db->table('flex_page_builder_settings')->insert($values + ['id' => 1]);
    }
}
