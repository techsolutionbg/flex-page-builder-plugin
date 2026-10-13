<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

/** Turns the builder document into the HTML stored on the page. */
final class HtmlCompiler
{
    public const TYPES = ['section', 'columns', 'column', 'heading', 'paragraph', 'image', 'button', 'list', 'divider', 'spacer', 'html'];

    public const STYLE_KEYS = [
        'size', 'line_height', 'weight', 'align', 'level', 'height', 'full_width',
        'background', 'gradient', 'gradient_from', 'gradient_to', 'gradient_angle',
        'wallpaper_id', 'wallpaper_fit',
        'color', 'border_width', 'border_color', 'radius', 'padding',
        'padding_top', 'padding_right', 'padding_bottom', 'padding_left',
        'margin_top', 'margin_right', 'margin_bottom', 'margin_left',
    ];

    /**
     * @param list<mixed> $elements
     * @param callable(int): string $mediaUrl
     * @param array<string, array<string, mixed>> $defaults
     */
    public function compile(array $elements, callable $mediaUrl, array $defaults = []): string
    {
        $html = '';
        foreach ($this->withDefaults($this->normalize($elements), $defaults) as $element) {
            $html .= $this->element($element, $mediaUrl);
        }

        return $html === '' ? '' : '<div class="fpb-root">' . $html . '</div>';
    }

    /**
     * @param array<string, mixed> $defaults
     * @return array<string, array<string, mixed>>
     */
    public function normalizeDefaults(array $defaults): array
    {
        $clean = [];
        foreach (self::TYPES as $type) {
            if (!is_array($defaults[$type] ?? null)) {
                continue;
            }
            $raw = $defaults[$type];
            $style = self::appearance($raw);
            if (in_array($type, ['heading', 'paragraph', 'button', 'list'], true)) {
                $style += self::typography($raw);
            }
            if ($type === 'heading') {
                $level = (int) ($raw['level'] ?? 0);
                $style['level'] = in_array($level, [1, 2, 3, 4, 5, 6], true) ? $level : null;
            }
            if ($type === 'section') {
                $style['full_width'] = ($raw['full_width'] ?? null) === true ? true : null;
                $style += self::gradient($raw);
                $style += self::wallpaper($raw);
            }
            if ($type === 'spacer') {
                $height = filter_var($raw['height'] ?? null, FILTER_VALIDATE_INT);
                $style['height'] = is_int($height) ? max(8, min(160, $height)) : null;
            }
            $kept = [];
            foreach ($style as $key => $value) {
                if ($value !== null) {
                    $kept[$key] = $value;
                }
            }
            if ($kept !== []) {
                $clean[$type] = $kept;
            }
        }

        return $clean;
    }

    /**
     * @param list<array<string, mixed>> $elements
     * @param array<string, array<string, mixed>> $defaults
     * @return list<array<string, mixed>>
     */
    public function withDefaults(array $elements, array $defaults): array
    {
        return array_map(function (array $element) use ($defaults): array {
            $base = is_array($defaults[$element['type'] ?? ''] ?? null) ? $defaults[$element['type']] : [];
            foreach (self::STYLE_KEYS as $key) {
                if (($element[$key] ?? null) === null && array_key_exists($key, $base) && $base[$key] !== null) {
                    $element[$key] = $base[$key];
                }
            }
            if (is_array($element['children'] ?? null)) {
                $element['children'] = $this->withDefaults($element['children'], $defaults);
            }

            return $element;
        }, $elements);
    }

    /**
     * @param list<mixed> $elements
     * @return list<array<string, mixed>>
     */
    public function normalize(array $elements): array
    {
        if ($this->size($elements) > 200) {
            throw new \InvalidArgumentException('Страницата може да има до 200 елемента.', 422);
        }

        return $this->nodes($elements, 'root');
    }

    /** @param list<mixed> $elements */
    private function size(array $elements): int
    {
        $count = 0;
        foreach ($elements as $element) {
            if (!is_array($element)) {
                continue;
            }
            $count++;
            if (is_array($element['children'] ?? null)) {
                $count += $this->size($element['children']);
            }
        }

        return $count;
    }

    /**
     * @param list<mixed> $elements
     * @return list<array<string, mixed>>
     */
    private function nodes(array $elements, string $context): array
    {
        $normalized = [];
        foreach ($elements as $element) {
            if (!is_array($element) || !is_string($element['type'] ?? null) || !in_array($element['type'], self::TYPES, true)) {
                throw new \InvalidArgumentException('Невалиден елемент.', 422);
            }
            $id = is_string($element['id'] ?? null) && preg_match('/^[a-zA-Z0-9_-]{1,40}$/', $element['id']) === 1
                ? $element['id']
                : bin2hex(random_bytes(8));
            $type = $element['type'];
            if ($type === 'section') {
                if ($context !== 'root') {
                    throw new \InvalidArgumentException('Невалиден елемент.', 422);
                }
                $children = is_array($element['children'] ?? null) ? $element['children'] : [];
                $normalized[] = [
                    'id' => $id,
                    'type' => 'section',
                    'full_width' => ($element['full_width'] ?? null) === true ? true : (($element['full_width'] ?? null) === false ? false : null),
                    'children' => $this->nodes($children, 'section'),
                ] + self::appearance($element) + self::gradient($element) + self::wallpaper($element);
                continue;
            }
            if ($type === 'columns') {
                if ($context === 'column') {
                    throw new \InvalidArgumentException('Невалиден елемент.', 422);
                }
                $normalized[] = $this->columns($id, $element);
                continue;
            }
            if ($type === 'column') {
                if ($context !== 'columns') {
                    throw new \InvalidArgumentException('Невалиден елемент.', 422);
                }
                $children = is_array($element['children'] ?? null) ? $element['children'] : [];
                $normalized[] = ['id' => $id, 'type' => 'column', 'children' => $this->nodes($children, 'column')] + self::appearance($element);
                continue;
            }
            if ($context === 'columns') {
                throw new \InvalidArgumentException('Невалиден елемент.', 422);
            }
            $normalized[] = ['id' => $id] + $this->props($element);
        }

        return $normalized;
    }

    /** @param array<string, mixed> $element @return array<string, mixed> */
    private function columns(string $id, array $element): array
    {
        $raw = is_array($element['children'] ?? null) ? array_values($element['children']) : [];
        $count = (int) ($element['columns'] ?? 0);
        if ($count < 1 || $count > 6) {
            $found = count($raw);
            $count = $found >= 1 && $found <= 6 ? $found : 2;
        }
        $cols = [];
        for ($index = 0; $index < $count; $index++) {
            $child = $raw[$index] ?? ['type' => 'column', 'children' => []];
            if (!is_array($child) || ($child['type'] ?? '') !== 'column') {
                $child = ['type' => 'column', 'children' => []];
            }
            $cols[] = $child;
        }
        if (count($raw) > $count) {
            $extra = [];
            for ($index = $count; $index < count($raw); $index++) {
                if (($raw[$index]['type'] ?? '') === 'column' && is_array($raw[$index]['children'] ?? null)) {
                    $extra = array_merge($extra, $raw[$index]['children']);
                }
            }
            $cols[$count - 1]['children'] = array_merge(is_array($cols[$count - 1]['children'] ?? null) ? $cols[$count - 1]['children'] : [], $extra);
        }

        return ['id' => $id, 'type' => 'columns', 'columns' => $count, 'children' => $this->nodes($cols, 'columns')] + self::appearance($element);
    }

    /** @param array<string, mixed> $element @return array<string, mixed> */
    private function props(array $element): array
    {
        $type = $element['type'];
        $text = static fn(mixed $value, int $max): string => mb_substr(trim((string) $value), 0, $max);
        if ($type === 'heading') {
            $level = $element['level'] ?? null;
            $level = $level === null || $level === '' ? null : (int) $level;

            return ['type' => 'heading', 'level' => in_array($level, [1, 2, 3, 4, 5, 6], true) ? $level : null, 'text' => $text($element['text'] ?? '', 300)] + self::typography($element) + self::appearance($element);
        }
        if ($type === 'paragraph') {
            return ['type' => 'paragraph', 'text' => $text($element['text'] ?? '', 5000)] + self::typography($element) + self::appearance($element);
        }
        if ($type === 'image') {
            $mediaId = filter_var($element['media_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

            return ['type' => 'image', 'media_id' => is_int($mediaId) ? $mediaId : null, 'alt' => $text($element['alt'] ?? '', 190)] + self::appearance($element);
        }
        if ($type === 'button') {
            return ['type' => 'button', 'text' => $text($element['text'] ?? '', 80), 'url' => self::url($element['url'] ?? '')] + self::typography($element) + self::appearance($element);
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

            return ['type' => 'list', 'ordered' => ($element['ordered'] ?? false) === true, 'items' => $clean] + self::typography($element) + self::appearance($element);
        }
        if ($type === 'divider') {
            return ['type' => 'divider'] + self::appearance($element);
        }
        if ($type === 'spacer') {
            $height = filter_var($element['height'] ?? null, FILTER_VALIDATE_INT);

            return ['type' => 'spacer', 'height' => is_int($height) ? max(8, min(160, $height)) : null] + self::appearance($element);
        }

        return ['type' => 'html', 'html' => mb_substr((string) ($element['html'] ?? ''), 0, 20000)] + self::appearance($element);
    }

    /** @param array<string, mixed> $element */
    private function element(array $element, callable $mediaUrl): string
    {
        $id = htmlspecialchars((string) $element['id'], ENT_QUOTES, 'UTF-8');
        if ($element['type'] === 'section' || $element['type'] === 'columns' || $element['type'] === 'column') {
            $children = '';
            foreach ($element['children'] as $child) {
                $children .= $this->element($child, $mediaUrl);
            }
            $class = $element['type'] === 'section' ? 'fpb-section' : ($element['type'] === 'columns' ? 'fpb-columns' : 'fpb-column');
            if ($element['type'] === 'section' && ($element['full_width'] ?? false) === true) {
                $class .= ' fpb-section--full';
            }
            $tag = $element['type'] === 'section' ? 'section' : 'div';

            return '<' . $tag . ' class="' . $class . '" data-fpb-id="' . $id . '" data-fpb-type="' . $element['type'] . '"' . self::wrapperStyle($this->withWallpaper($element, $mediaUrl), $element['type'] === 'columns' ? (int) $element['columns'] : null) . '>' . $children . '</' . $tag . '>';
        }
        $open = '<div class="fpb-element" data-fpb-id="' . $id . '" data-fpb-type="' . $element['type'] . '"' . self::wrapperStyle($element) . '>';
        $inner = match ($element['type']) {
            'heading' => self::headingHtml($element),
            'paragraph' => '<p' . self::textStyle($element) . '>' . nl2br(self::escape((string) $element['text']), false) . '</p>',
            'image' => $this->image($element, $mediaUrl),
            'button' => '<a class="fpb-button" href="' . self::escape((string) $element['url']) . '"' . self::textStyle($element) . '>' . self::escape((string) $element['text']) . '</a>',
            'list' => $this->list($element),
            'divider' => '<hr>',
            'spacer' => '<div class="fpb-spacer" style="height:' . (is_int($element['height'] ?? null) ? $element['height'] : 32) . 'px"></div>',
            default => self::cleanHtml((string) $element['html']),
        };
        if ($inner === '') {
            return '';
        }

        return $open . $inner . '</div>';
    }

    /** @param array<string, mixed> $element */
    private static function headingHtml(array $element): string
    {
        $level = in_array($element['level'] ?? null, [1, 2, 3, 4, 5, 6], true) ? $element['level'] : 2;

        return '<h' . $level . self::textStyle($element) . '>' . self::escape((string) $element['text']) . '</h' . $level . '>';
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

        return '<' . $tag . self::textStyle($element) . '>' . $items . '</' . $tag . '>';
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

    /** @param array<string, mixed> $element @return array{size: ?int, line_height: ?string, weight: ?int, align: ?string} */
    private static function typography(array $element): array
    {
        return [
            'size' => self::textSize($element['size'] ?? null),
            'line_height' => self::lineHeight($element['line_height'] ?? null),
            'weight' => self::fontWeight($element['weight'] ?? null),
            'align' => self::align($element['align'] ?? null),
        ];
    }

    /** @param array<string, mixed> $element */
    private static function textStyle(array $element): string
    {
        $parts = [];
        if (is_int($element['size'] ?? null)) {
            $parts[] = 'font-size:' . $element['size'] . 'px';
        }
        if (is_string($element['line_height'] ?? null)) {
            $parts[] = 'line-height:' . $element['line_height'];
        }
        if (is_int($element['weight'] ?? null)) {
            $parts[] = 'font-weight:' . $element['weight'];
        }
        if (($element['type'] ?? '') === 'button') {
            $box = self::boxCss($element);
            if ($box !== '') {
                $parts[] = $box;
            }
        }

        return $parts === [] ? '' : ' style="' . implode(';', $parts) . '"';
    }

    /**
     * @param array<string, mixed> $element
     * @return array{
     *   background: ?string, color: ?string, border_width: ?int, border_color: ?string, radius: ?int,
     *   padding: ?int, padding_top: ?int, padding_right: ?int, padding_bottom: ?int, padding_left: ?int,
     *   margin_top: ?int, margin_right: ?int, margin_bottom: ?int, margin_left: ?int
     * }
     */
    private static function appearance(array $element): array
    {
        return [
            'background' => self::color($element['background'] ?? null),
            'color' => self::color($element['color'] ?? null),
            'border_width' => self::px($element['border_width'] ?? null, 20),
            'border_color' => self::color($element['border_color'] ?? null),
            'radius' => self::px($element['radius'] ?? null, 80),
            'padding' => self::px($element['padding'] ?? null, 80),
            'padding_top' => self::px($element['padding_top'] ?? null, 160),
            'padding_right' => self::px($element['padding_right'] ?? null, 160),
            'padding_bottom' => self::px($element['padding_bottom'] ?? null, 160),
            'padding_left' => self::px($element['padding_left'] ?? null, 160),
            'margin_top' => self::px($element['margin_top'] ?? null, 160),
            'margin_right' => self::px($element['margin_right'] ?? null, 160),
            'margin_bottom' => self::px($element['margin_bottom'] ?? null, 160),
            'margin_left' => self::px($element['margin_left'] ?? null, 160),
        ];
    }

    /** @param array<string, mixed> $element */
    private static function boxCss(array $element): string
    {
        $parts = [];
        $wallpaper = is_string($element['wallpaper_url'] ?? null) ? $element['wallpaper_url'] : null;
        $gradient = self::gradientCss($element);
        if ($wallpaper !== null) {
            if (is_string($element['background'] ?? null)) {
                $parts[] = 'background-color:' . $element['background'];
            }
            $parts[] = 'background-image:' . self::cssUrl($wallpaper);
            $parts[] = 'background-size:' . (($element['wallpaper_fit'] ?? null) === 'contain' ? 'contain' : 'cover');
            $parts[] = 'background-position:center';
            $parts[] = 'background-repeat:no-repeat';
        } elseif ($gradient !== null) {
            $parts[] = 'background:' . $gradient;
        } elseif (is_string($element['background'] ?? null)) {
            $parts[] = 'background:' . $element['background'];
        }
        if (is_string($element['color'] ?? null)) {
            $parts[] = 'color:' . $element['color'];
        }
        if (is_int($element['border_width'] ?? null) && $element['border_width'] > 0) {
            $parts[] = 'border:' . $element['border_width'] . 'px solid ' . (is_string($element['border_color'] ?? null) ? $element['border_color'] : '#111827');
        }
        if (is_int($element['radius'] ?? null)) {
            $parts[] = 'border-radius:' . $element['radius'] . 'px';
        }
        if (is_int($element['padding'] ?? null)) {
            $parts[] = 'padding:' . $element['padding'] . 'px';
        }
        foreach (['padding_top' => 'padding-top', 'padding_right' => 'padding-right', 'padding_bottom' => 'padding-bottom', 'padding_left' => 'padding-left', 'margin_top' => 'margin-top', 'margin_right' => 'margin-right', 'margin_bottom' => 'margin-bottom', 'margin_left' => 'margin-left'] as $key => $css) {
            if (is_int($element[$key] ?? null)) {
                $parts[] = $css . ':' . $element[$key] . 'px';
            }
        }

        return implode(';', $parts);
    }

    /** @param array<string, mixed> $element */
    private static function wrapperStyle(array $element, ?int $columns = null): string
    {
        $parts = [];
        if (($element['align'] ?? null) === 'center' || ($element['align'] ?? null) === 'right') {
            $parts[] = 'text-align:' . $element['align'];
        }
        if (($element['type'] ?? '') !== 'button') {
            $box = self::boxCss($element);
            if ($box !== '') {
                $parts[] = $box;
            }
        }
        if (is_int($columns) && $columns >= 1) {
            $parts[] = 'grid-template-columns:repeat(' . $columns . ',minmax(0,1fr))';
        }

        return $parts === [] ? '' : ' style="' . implode(';', $parts) . '"';
    }

    private const GRADIENTS = [
        'dusk' => 'linear-gradient(180deg,#1e1b4b,#7c3aed)',
        'sunset' => 'linear-gradient(135deg,#fb923c,#e11d48)',
        'ocean' => 'linear-gradient(160deg,#0ea5e9,#0369a1)',
        'forest' => 'linear-gradient(160deg,#166534,#052e16)',
        'sand' => 'linear-gradient(180deg,#fef3c7,#f59e0b)',
        'mist' => 'linear-gradient(180deg,#f8fafc,#94a3b8)',
        'night' => 'linear-gradient(180deg,#0f172a,#334155)',
        'rose' => 'linear-gradient(135deg,#fda4af,#be123c)',
    ];

    /**
     * @param array<string, mixed> $element
     * @return array{gradient: ?string, gradient_from: ?string, gradient_to: ?string, gradient_angle: ?int}
     */
    private static function gradient(array $element): array
    {
        $id = is_string($element['gradient'] ?? null) ? $element['gradient'] : null;
        if ($id !== 'custom' && !isset(self::GRADIENTS[$id])) {
            $id = null;
        }

        return [
            'gradient' => $id,
            'gradient_from' => self::color($element['gradient_from'] ?? null),
            'gradient_to' => self::color($element['gradient_to'] ?? null),
            'gradient_angle' => self::gradientAngle($element['gradient_angle'] ?? null),
        ];
    }

    /** @param array<string, mixed> $element */
    private static function gradientCss(array $element): ?string
    {
        $id = $element['gradient'] ?? null;
        if ($id === 'custom') {
            $from = is_string($element['gradient_from'] ?? null) ? $element['gradient_from'] : null;
            $to = is_string($element['gradient_to'] ?? null) ? $element['gradient_to'] : null;
            if ($from === null || $to === null) {
                return null;
            }
            $angle = is_int($element['gradient_angle'] ?? null) ? $element['gradient_angle'] : 180;

            return 'linear-gradient(' . $angle . 'deg,' . $from . ',' . $to . ')';
        }

        return is_string($id) && isset(self::GRADIENTS[$id]) ? self::GRADIENTS[$id] : null;
    }

    /**
     * @param array<string, mixed> $element
     * @return array{wallpaper_id: ?int, wallpaper_fit: ?string}
     */
    private static function wallpaper(array $element): array
    {
        $mediaId = filter_var($element['wallpaper_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        return [
            'wallpaper_id' => is_int($mediaId) ? $mediaId : null,
            'wallpaper_fit' => ($element['wallpaper_fit'] ?? null) === 'contain' ? 'contain' : (($element['wallpaper_fit'] ?? null) === 'cover' ? 'cover' : null),
        ];
    }

    /**
     * @param array<string, mixed> $element
     * @return array<string, mixed>
     */
    private function withWallpaper(array $element, callable $mediaUrl): array
    {
        $id = $element['wallpaper_id'] ?? null;
        if (!is_int($id)) {
            return $element;
        }
        $url = $mediaUrl($id);
        if (!is_string($url) || $url === '' || (!str_starts_with($url, '/') && preg_match('#^https?://#i', $url) !== 1)) {
            return $element;
        }
        $element['wallpaper_url'] = $url;

        return $element;
    }

    private static function cssUrl(string $url): string
    {
        return 'url("' . str_replace(['\\', '"'], ['\\\\', '\\"'], $url) . '")';
    }

    private static function gradientAngle(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $angle = filter_var($value, FILTER_VALIDATE_INT);
        if (!is_int($angle)) {
            return null;
        }

        return max(0, min(360, $angle));
    }

    private static function color(mixed $value): ?string
    {
        $color = strtolower(trim((string) $value));

        return preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/', $color) === 1 ? $color : null;
    }

    private static function px(mixed $value, int $max): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $number = filter_var($value, FILTER_VALIDATE_INT);
        if (!is_int($number)) {
            return null;
        }

        return max(0, min($max, $number));
    }

    private static function lineHeight(mixed $value): ?string
    {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return null;
        }
        $height = round((float) $value, 2);
        if ($height < 0.8 || $height > 3) {
            return null;
        }

        return rtrim(rtrim(number_format($height, 2, '.', ''), '0'), '.');
    }

    private static function fontWeight(mixed $value): ?int
    {
        $weight = filter_var($value, FILTER_VALIDATE_INT);

        return in_array($weight, [300, 400, 500, 600, 700, 800], true) ? $weight : null;
    }

    private static function align(mixed $value): ?string
    {
        return $value === 'center' || $value === 'right' ? $value : null;
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
}
