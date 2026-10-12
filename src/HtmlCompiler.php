<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

/** Turns the builder document into the HTML stored on the page. */
final class HtmlCompiler
{
    public const TYPES = ['heading', 'paragraph', 'image', 'button', 'list', 'divider', 'spacer', 'html'];

    /**
     * @param list<mixed> $elements
     * @param callable(int): string $mediaUrl
     */
    public function compile(array $elements, callable $mediaUrl): string
    {
        $html = '';
        foreach ($this->normalize($elements) as $element) {
            $html .= $this->element($element, $mediaUrl);
        }

        return $html === '' ? '' : '<div class="fpb-root">' . $html . '</div>';
    }

    /**
     * @param list<mixed> $elements
     * @return list<array<string, mixed>>
     */
    public function normalize(array $elements): array
    {
        if (count($elements) > 200) {
            throw new \InvalidArgumentException('Страницата може да има до 200 елемента.', 422);
        }
        $normalized = [];
        foreach ($elements as $element) {
            if (!is_array($element) || !is_string($element['type'] ?? null) || !in_array($element['type'], self::TYPES, true)) {
                throw new \InvalidArgumentException('Невалиден елемент.', 422);
            }
            $id = is_string($element['id'] ?? null) && preg_match('/^[a-zA-Z0-9_-]{1,40}$/', $element['id']) === 1
                ? $element['id']
                : bin2hex(random_bytes(8));
            $normalized[] = ['id' => $id] + $this->props($element);
        }

        return $normalized;
    }

    /** @param array<string, mixed> $element @return array<string, mixed> */
    private function props(array $element): array
    {
        $type = $element['type'];
        $text = static fn(mixed $value, int $max): string => mb_substr(trim((string) $value), 0, $max);
        if ($type === 'heading') {
            $level = (int) ($element['level'] ?? 2);

            return ['type' => 'heading', 'level' => in_array($level, [1, 2, 3, 4, 5, 6], true) ? $level : 2, 'text' => $text($element['text'] ?? '', 300), 'size' => self::textSize($element['size'] ?? null)];
        }
        if ($type === 'paragraph') {
            return ['type' => 'paragraph', 'text' => $text($element['text'] ?? '', 5000), 'size' => self::textSize($element['size'] ?? null)];
        }
        if ($type === 'image') {
            $mediaId = filter_var($element['media_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

            return ['type' => 'image', 'media_id' => is_int($mediaId) ? $mediaId : null, 'alt' => $text($element['alt'] ?? '', 190)];
        }
        if ($type === 'button') {
            return ['type' => 'button', 'text' => $text($element['text'] ?? '', 80), 'url' => self::url($element['url'] ?? ''), 'size' => self::textSize($element['size'] ?? null)];
        }
        if ($type === 'list') {
            $items = is_array($element['items'] ?? null) ? $element['items'] : [];
            $clean = [];
            foreach (array_slice($items, 0, 50) as $item) {
                $line = $text($item, 500);
                if ($line !== '') {
                    $clean[] = $line;
                }
            }

            return ['type' => 'list', 'ordered' => ($element['ordered'] ?? false) === true, 'items' => $clean, 'size' => self::textSize($element['size'] ?? null)];
        }
        if ($type === 'divider') {
            return ['type' => 'divider'];
        }
        if ($type === 'spacer') {
            $height = (int) ($element['height'] ?? 32);

            return ['type' => 'spacer', 'height' => max(8, min(160, $height))];
        }

        return ['type' => 'html', 'html' => mb_substr((string) ($element['html'] ?? ''), 0, 20000)];
    }

    /** @param array<string, mixed> $element */
    private function element(array $element, callable $mediaUrl): string
    {
        $id = htmlspecialchars((string) $element['id'], ENT_QUOTES, 'UTF-8');
        $open = '<div class="fpb-element" data-fpb-id="' . $id . '" data-fpb-type="' . $element['type'] . '">';
        $inner = match ($element['type']) {
            'heading' => '<h' . $element['level'] . self::sizeAttr($element['size']) . '>' . self::escape((string) $element['text']) . '</h' . $element['level'] . '>',
            'paragraph' => '<p' . self::sizeAttr($element['size']) . '>' . nl2br(self::escape((string) $element['text']), false) . '</p>',
            'image' => $this->image($element, $mediaUrl),
            'button' => '<a class="fpb-button" href="' . self::escape((string) $element['url']) . '"' . self::sizeAttr($element['size']) . '>' . self::escape((string) $element['text']) . '</a>',
            'list' => $this->list($element),
            'divider' => '<hr>',
            'spacer' => '<div class="fpb-spacer" style="height:' . (int) $element['height'] . 'px"></div>',
            default => self::cleanHtml((string) $element['html']),
        };
        if ($inner === '') {
            return '';
        }

        return $open . $inner . '</div>';
    }

    /** @param array<string, mixed> $element */
    private function image(array $element, callable $mediaUrl): string
    {
        $mediaId = $element['media_id'];
        if (!is_int($mediaId)) {
            return '';
        }
        $url = $mediaUrl($mediaId);
        if (!is_string($url) || $url === '') {
            return '';
        }

        return '<img src="' . self::escape($url) . '" alt="' . self::escape((string) $element['alt']) . '">';
    }

    /** @param array<string, mixed> $element */
    private function list(array $element): string
    {
        $tag = $element['ordered'] === true ? 'ol' : 'ul';
        $items = '';
        foreach ($element['items'] as $item) {
            $items .= '<li>' . self::escape((string) $item) . '</li>';
        }

        return '<' . $tag . self::sizeAttr($element['size']) . '>' . $items . '</' . $tag . '>';
    }

    private static function url(mixed $value): string
    {
        $url = trim((string) $value);
        if ($url === '' || preg_match('/^\s*javascript:/i', $url) === 1) {
            return '#';
        }
        if (str_starts_with($url, '/') || str_starts_with($url, '#') || preg_match('#^https?://#i', $url) === 1) {
            return mb_substr($url, 0, 500);
        }

        return '#';
    }

    private static function cleanHtml(string $html): string
    {
        $html = preg_replace('#<(script|iframe|object|embed|form)\b[^>]*>.*?</\1>#is', '', $html) ?? '';
        $html = preg_replace('/\s+on\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html) ?? '';

        return preg_replace('/javascript\s*:/i', '', $html) ?? '';
    }

    private static function textSize(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $size = filter_var($value, FILTER_VALIDATE_INT);
        if (!is_int($size)) {
            return null;
        }

        return max(8, min(160, $size));
    }

    private static function sizeAttr(mixed $size): string
    {
        return is_int($size) ? ' style="font-size:' . $size . 'px"' : '';
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
}
