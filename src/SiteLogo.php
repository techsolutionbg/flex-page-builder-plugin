<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

use Flex\Media\PublicMediaApi;
use Illuminate\Database\Eloquent\Model;

/** Resolves the light and dark site logos configured in the active theme settings. */
final class SiteLogo
{
    /** @return array{light: string, dark: string} */
    public static function urls(PublicMediaApi $media): array
    {
        try {
            $db = Model::resolveConnection();
            if (!$db->getSchemaBuilder()->hasTable('extension_documents')) {
                return ['light' => '', 'dark' => ''];
            }
            $payload = json_decode((string) $db->table('extension_documents')
                ->where('plugin_id', 'flex/theme-content')
                ->where('document_key', 'theme-content:global')
                ->value('payload'), true);
            $site = $payload['sections']['site'] ?? null;
            if (!is_array($site)) {
                return ['light' => '', 'dark' => ''];
            }
            $urlFor = static function (mixed $value) use ($media): string {
                $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
                if (!is_int($id)) {
                    return '';
                }
                $record = $media->get($id);
                $url = $record['url'] ?? '';

                return is_string($url) ? $url : '';
            };
            $light = $urlFor($site['logo'] ?? null);
            $dark = $urlFor($site['logo_dark'] ?? null);
            $light = $light !== '' ? $light : $dark;
            $dark = $dark !== '' ? $dark : $light;

            return ['light' => $light, 'dark' => $dark];
        } catch (\Throwable) {
            return ['light' => '', 'dark' => ''];
        }
    }
}
