<?php

declare(strict_types=1);

namespace Flex\PageBuilder;

/** Turns the builder document into the HTML stored on the page. */
final class HtmlCompiler
{
    public const TYPES = ['section', 'columns', 'column', 'heading', 'paragraph', 'image', 'button', 'list', 'divider', 'spacer', 'html'];

    public const STYLE_KEYS = [
        'size', 'line_height', 'weight', 'align', 'level', 'height', 'full_width', 'hidden',
        'background', 'gradient', 'gradient_from', 'gradient_to', 'gradient_angle',
        'wallpaper_id', 'wallpaper_fit', 'wallpaper_position', 'wallpaper_preset', 'overlay_color', 'overlay_opacity', 'image_filter', 'image_tint', 'image_tint_opacity',
        'shadow_color', 'shadow_x', 'shadow_y', 'shadow_blur', 'stroke_width', 'stroke_color',
        'letter_spacing', 'text_transform', 'italic',
        'hover_background', 'hover_color', 'hover_border_color',
        'color', 'border_width', 'border_color', 'radius', 'padding',
        'padding_top', 'padding_right', 'padding_bottom', 'padding_left',
        'margin_top', 'margin_right', 'margin_bottom', 'margin_left',
    ];

    /**
     * @param list<mixed> $elements
     * @param callable(int): string $mediaUrl
     * @param array<string, array<string, mixed>> $defaults
     * @param callable(int): string|null $pageUrl
     */
    public function compile(array $elements, callable $mediaUrl, array $defaults = [], ?callable $pageUrl = null): string
    {
        $html = '';
        $tree = $this->withDefaults($this->normalize($elements), $defaults);
        foreach ($tree as $element) {
            $html .= $this->element($element, $mediaUrl, false, $pageUrl);
        }

        return $html === '' ? '' : '<div class="fpb-root">' . $html . $this->documentCss($tree) . '</div>';
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
                $style += self::textEffects($raw);
            }
            if ($type === 'button') {
                $style += self::hover($raw);
            }
            if ($type === 'heading') {
                $level = (int) ($raw['level'] ?? 0);
                $style['level'] = in_array($level, [1, 2, 3, 4, 5, 6], true) ? $level : null;
            }
            if ($type === 'section') {
                $style['full_width'] = ($raw['full_width'] ?? null) === true ? true : null;
                $style += self::gradient($raw);
                $style += self::wallpaper($raw);
                $style += self::overlay($raw);
                $style += self::imageFilter($raw);
                $style += self::imageTint($raw);
            }
            if ($type === 'image') {
                $style += self::imageFilter($raw);
                $style += self::imageTint($raw);
            }
            if ($type === 'spacer') {
                $height = filter_var($raw['height'] ?? null, FILTER_VALIDATE_INT);
                $style['height'] = is_int($height) ? max(8, min(160, $height)) : null;
            }
            $style += self::visibility($raw);
            $style += self::breakpoints($raw, $type);
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
            foreach (['tablet', 'phone'] as $device) {
                $from = is_array($base[$device] ?? null) ? $base[$device] : [];
                $own = is_array($element[$device] ?? null) ? $element[$device] : [];
                foreach ($from as $key => $value) {
                    if ($value !== null && ($own[$key] ?? null) === null) {
                        $own[$key] = $value;
                    }
                }
                if ($own !== []) {
                    $element[$device] = $own;
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
                if ($context !== 'root' && $context !== 'section') {
                    throw new \InvalidArgumentException('Невалиден елемент.', 422);
                }
                $children = is_array($element['children'] ?? null) ? $element['children'] : [];
                $normalized[] = [
                    'id' => $id,
                    'type' => 'section',
                    'full_width' => ($element['full_width'] ?? null) === true ? true : (($element['full_width'] ?? null) === false ? false : null),
                    'children' => $this->nodes($children, 'section'),
                ] + self::appearance($element) + self::gradient($element) + self::wallpaper($element) + self::overlay($element) + self::imageFilter($element) + self::imageTint($element) + self::label($element) + self::visibility($element) + self::breakpoints($element, 'section');
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
                $normalized[] = ['id' => $id, 'type' => 'column', 'children' => $this->nodes($children, 'column')] + self::appearance($element) + self::label($element) + self::visibility($element) + self::breakpoints($element, 'column');
                continue;
            }
            if ($context === 'columns') {
                throw new \InvalidArgumentException('Невалиден елемент.', 422);
            }
            $normalized[] = ['id' => $id] + $this->props($element) + self::label($element) + self::visibility($element) + self::breakpoints($element, $type);
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

        return ['id' => $id, 'type' => 'columns', 'columns' => $count, 'children' => $this->nodes($cols, 'columns')] + self::appearance($element) + self::label($element) + self::visibility($element) + self::breakpoints($element, 'columns');
    }

    /** @param array<string, mixed> $element @return array<string, mixed> */
    private function props(array $element): array
    {
        $type = $element['type'];
        $text = static fn(mixed $value, int $max): string => mb_substr(trim((string) $value), 0, $max);
        if ($type === 'heading') {
            $level = $element['level'] ?? null;
            $level = $level === null || $level === '' ? null : (int) $level;

            return ['type' => 'heading', 'level' => in_array($level, [1, 2, 3, 4, 5, 6], true) ? $level : null, 'text' => $text($element['text'] ?? '', 300)] + self::typography($element) + self::textEffects($element) + self::appearance($element);
        }
        if ($type === 'paragraph') {
            return ['type' => 'paragraph', 'text' => $text($element['text'] ?? '', 5000)] + self::typography($element) + self::textEffects($element) + self::appearance($element);
        }
        if ($type === 'image') {
            $mediaId = filter_var($element['media_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

            return ['type' => 'image', 'media_id' => is_int($mediaId) ? $mediaId : null, 'alt' => $text($element['alt'] ?? '', 190)] + self::appearance($element) + self::imageFilter($element) + self::imageTint($element);
        }
        if ($type === 'button') {
            return ['type' => 'button', 'text' => $text($element['text'] ?? '', 80)] + self::buttonLink($element) + self::typography($element) + self::textEffects($element) + self::appearance($element) + self::hover($element);
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

            return ['type' => 'list', 'ordered' => ($element['ordered'] ?? false) === true, 'items' => $clean] + self::typography($element) + self::textEffects($element) + self::appearance($element);
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
    /** @param callable(int): string|null $pageUrl */
    private function element(array $element, callable $mediaUrl, bool $insideSection = false, ?callable $pageUrl = null): string
    {
        $id = htmlspecialchars((string) $element['id'], ENT_QUOTES, 'UTF-8');
        if ($element['type'] === 'section' || $element['type'] === 'columns' || $element['type'] === 'column') {
            $children = '';
            foreach ($element['children'] as $child) {
                $children .= $this->element($child, $mediaUrl, $element['type'] === 'section' || $insideSection, $pageUrl);
            }
            $class = $element['type'] === 'section' ? 'fpb-section' : ($element['type'] === 'columns' ? 'fpb-columns' : 'fpb-column');
            if ($element['type'] === 'section' && ($element['full_width'] ?? false) === true) {
                $class .= ' fpb-section--full';
            } elseif ($element['type'] === 'section' && $insideSection) {
                $class .= ' fpb-section--boxed';
            }
            if (($element['hidden'] ?? false) === true) {
                $class .= ' fpb-is-hidden';
            }
            $tag = $element['type'] === 'section' ? 'section' : 'div';
            $styled = $this->withWallpaper($element, $mediaUrl);

            return '<' . $tag . ' class="' . $class . '" data-fpb-id="' . $id . '" data-fpb-type="' . $element['type'] . '"' . self::wrapperStyle($styled, $element['type'] === 'columns' ? (int) $element['columns'] : null) . '>' . self::wallpaperLayer($styled) . self::overlayLayer($styled) . $children . '</' . $tag . '>';
        }
        $open = '<div class="fpb-element' . (($element['hidden'] ?? false) === true ? ' fpb-is-hidden' : '') . '" data-fpb-id="' . $id . '" data-fpb-type="' . $element['type'] . '"' . self::wrapperStyle($element) . '>';
        $inner = match ($element['type']) {
            'heading' => self::headingHtml($element),
            'paragraph' => '<p' . self::textStyle($element) . '>' . nl2br(self::escape((string) $element['text']), false) . '</p>',
            'image' => $this->image($element, $mediaUrl),
            'button' => '<a class="fpb-button" href="' . self::escape(self::buttonHref($element, $pageUrl)) . '"' . self::textStyle($element) . '>' . self::escape((string) $element['text']) . '</a>',
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

        return '<span class="' . self::photoClass($element) . '"' . self::photoVars($element) . '><img src="' . self::escape($url) . '" alt="' . self::escape((string) $element['alt']) . '"></span>';
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

    /**
     * @param array<string, mixed> $element
     * @return array{link_type: string, page_id: ?int, url: string}
     */
    private static function buttonLink(array $element): array
    {
        $linkType = ($element['link_type'] ?? null) === 'page' ? 'page' : 'url';
        $pageId = filter_var($element['page_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        return [
            'link_type' => $linkType,
            'page_id' => $linkType === 'page' && is_int($pageId) ? $pageId : null,
            'url' => $linkType === 'url' ? self::url($element['url'] ?? '') : '#',
        ];
    }

    /** @param array<string, mixed> $element @param callable(int): string|null $pageUrl */
    private static function buttonHref(array $element, ?callable $pageUrl): string
    {
        if (($element['link_type'] ?? 'url') === 'page') {
            $id = $element['page_id'] ?? null;
            if (!is_int($id) || $pageUrl === null) {
                return '#';
            }
            $url = $pageUrl($id);

            return is_string($url) && $url !== '' ? self::url($url) : '#';
        }

        return self::url($element['url'] ?? '');
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

    /**
     * @param array<string, mixed> $element
     * @return array<string, mixed>
     */
    private static function textEffects(array $element, bool $breakpoint = false): array
    {
        $transform = $element['text_transform'] ?? null;
        $italic = $element['italic'] ?? null;

        return [
            'shadow_color' => self::color($element['shadow_color'] ?? null),
            'shadow_x' => self::signedPx($element['shadow_x'] ?? null, 40),
            'shadow_y' => self::signedPx($element['shadow_y'] ?? null, 40),
            'shadow_blur' => self::px($element['shadow_blur'] ?? null, 40),
            'stroke_width' => self::px($element['stroke_width'] ?? null, 8),
            'stroke_color' => self::color($element['stroke_color'] ?? null),
            'letter_spacing' => self::signedPx($element['letter_spacing'] ?? null, 20),
            'text_transform' => in_array($transform, ['uppercase', 'lowercase', 'capitalize'], true)
                ? $transform
                : ($breakpoint && $transform === 'none' ? 'none' : null),
            'italic' => $italic === true ? true : ($breakpoint && $italic === false ? false : null),
        ];
    }

    /**
     * @param array<string, mixed> $element
     * @return list<string>
     */
    private static function textEffectsCss(array $element): array
    {
        $parts = [];
        $shadow = self::textShadowCss($element);
        if ($shadow !== null) {
            $parts[] = 'text-shadow:' . $shadow;
        }
        if (is_int($element['letter_spacing'] ?? null)) {
            $parts[] = 'letter-spacing:' . $element['letter_spacing'] . 'px';
        }
        $transform = $element['text_transform'] ?? null;
        if (in_array($transform, ['uppercase', 'lowercase', 'capitalize', 'none'], true)) {
            $parts[] = 'text-transform:' . $transform;
        }
        if (($element['italic'] ?? null) === true) {
            $parts[] = 'font-style:italic';
        } elseif (($element['italic'] ?? null) === false) {
            $parts[] = 'font-style:normal';
        }
        $stroke = is_int($element['stroke_width'] ?? null) ? $element['stroke_width'] : null;
        if ($stroke !== null && $stroke > 0) {
            $parts[] = '-webkit-text-stroke:' . $stroke . 'px ' . (is_string($element['stroke_color'] ?? null) ? $element['stroke_color'] : '#111827');
            $parts[] = 'paint-order:stroke fill';
        }

        return $parts;
    }

    /** @param array<string, mixed> $element */
    private static function textShadowCss(array $element): ?string
    {
        $color = self::color($element['shadow_color'] ?? null);
        if ($color === null) {
            return null;
        }
        $x = is_int($element['shadow_x'] ?? null) ? $element['shadow_x'] : 0;
        $y = is_int($element['shadow_y'] ?? null) ? $element['shadow_y'] : 2;
        $blur = is_int($element['shadow_blur'] ?? null) ? $element['shadow_blur'] : 8;

        return $x . 'px ' . $y . 'px ' . $blur . 'px ' . $color;
    }

    private static function signedPx(mixed $value, int $max): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $number = filter_var($value, FILTER_VALIDATE_INT);
        if (!is_int($number)) {
            return null;
        }

        return max(-$max, min($max, $number));
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
        foreach (self::textEffectsCss($element) as $part) {
            $parts[] = $part;
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

    /**
     * @param array<string, mixed> $element
     * @return array{hover_background: ?string, hover_color: ?string, hover_border_color: ?string}
     */
    private static function hover(array $element): array
    {
        return [
            'hover_background' => self::color($element['hover_background'] ?? null),
            'hover_color' => self::color($element['hover_color'] ?? null),
            'hover_border_color' => self::color($element['hover_border_color'] ?? null),
        ];
    }

    /** @param array<string, mixed> $element */
    private static function hoverRules(string $id, array $element): string
    {
        if (($element['type'] ?? '') !== 'button') {
            return '';
        }
        $parts = [];
        if (is_string($element['hover_background'] ?? null)) {
            $parts[] = 'background:' . $element['hover_background'];
        }
        if (is_string($element['hover_color'] ?? null)) {
            $parts[] = 'color:' . $element['hover_color'];
        }
        if (is_string($element['hover_border_color'] ?? null)) {
            $parts[] = 'border-color:' . $element['hover_border_color'];
        }
        if ($parts === []) {
            return '';
        }
        $sel = '[data-fpb-id="' . htmlspecialchars($id, ENT_QUOTES, 'UTF-8') . '"] .fpb-button';

        return $sel . '{transition:background-color .2s ease,color .2s ease,border-color .2s ease}'
            . $sel . ':hover{' . implode(';', $parts) . '}';
    }

    /** @param array<string, mixed> $element */
    private static function boxCss(array $element): string
    {
        $parts = [];
        $wallpaper = is_string($element['wallpaper_url'] ?? null) ? $element['wallpaper_url'] : null;
        $preset = self::patternId($element['wallpaper_preset'] ?? null);
        $gradient = self::gradientCss($element);
        $overlay = self::hasOverlay($element);
        if ($wallpaper !== null || $preset !== null) {
            $parts[] = 'position:relative';
            $parts[] = 'overflow:hidden';
            $parts[] = 'min-height:16rem';
            // Fallback while a wallpaper image is still loading (avoids invisible light text on white).
            $parts[] = 'background-color:' . (is_string($element['background'] ?? null) ? $element['background'] : '#0f172a');
        } elseif ($gradient !== null) {
            $parts[] = 'background:' . $gradient;
        } elseif (is_string($element['background'] ?? null)) {
            $parts[] = 'background:' . $element['background'];
        }
        if ($overlay && $wallpaper === null && $preset === null) {
            $parts[] = 'position:relative';
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

    /** @param array<string, mixed> $element @return array{name: ?string} */
    private static function label(array $element): array
    {
        $name = is_string($element['name'] ?? null) ? trim($element['name']) : '';

        return ['name' => $name === '' ? null : mb_substr($name, 0, 80)];
    }

    /** @var list<string> */
    private const WALLPAPER_POSITIONS = [
        'top-left', 'top-center', 'top-right',
        'center-left', 'center', 'center-right',
        'bottom-left', 'bottom-center', 'bottom-right',
    ];

    /**
     * @param array<string, mixed> $element
     * @return array{wallpaper_id: ?int, wallpaper_fit: ?string, wallpaper_position: ?string, wallpaper_preset: ?string}
     */
    private static function wallpaper(array $element): array
    {
        $mediaId = filter_var($element['wallpaper_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $position = is_string($element['wallpaper_position'] ?? null) ? $element['wallpaper_position'] : null;

        return [
            'wallpaper_id' => is_int($mediaId) ? $mediaId : null,
            'wallpaper_fit' => ($element['wallpaper_fit'] ?? null) === 'contain' ? 'contain' : (($element['wallpaper_fit'] ?? null) === 'cover' ? 'cover' : null),
            'wallpaper_position' => $position !== null && in_array($position, self::WALLPAPER_POSITIONS, true) && $position !== 'center' ? $position : null,
            'wallpaper_preset' => self::patternId($element['wallpaper_preset'] ?? null),
        ];
    }

    private static function wallpaperPositionCss(?string $position): string
    {
        return match ($position) {
            'top-left' => 'left top',
            'top-center' => 'center top',
            'top-right' => 'right top',
            'center-left' => 'left center',
            'center-right' => 'right center',
            'bottom-left' => 'left bottom',
            'bottom-center' => 'center bottom',
            'bottom-right' => 'right bottom',
            default => 'center',
        };
    }

    private const PATTERNS = ['diagonal', 'zigzag', 'arrows', 'checker', 'bricks', 'bars', 'waves', 'hexagons', 'diamonds', 'dots', 'links', 'zebra'];

    private static function patternId(mixed $value): ?string
    {
        return is_string($value) && in_array($value, self::PATTERNS, true) ? $value : null;
    }

    /**
     * @param array<string, mixed> $element
     * @return array{image_filter: ?string}
     */
    private static function imageFilter(array $element, bool $breakpoint = false): array
    {
        $value = $element['image_filter'] ?? null;
        if ($value === 'grayscale') {
            return ['image_filter' => 'grayscale'];
        }
        if ($breakpoint && $value === 'color') {
            return ['image_filter' => 'color'];
        }

        return ['image_filter' => null];
    }

    /**
     * @param array<string, mixed> $element
     * @return array{image_tint: ?string, image_tint_opacity: ?int}
     */
    private static function imageTint(array $element): array
    {
        return [
            'image_tint' => self::color($element['image_tint'] ?? null),
            'image_tint_opacity' => self::overlayOpacity($element['image_tint_opacity'] ?? null),
        ];
    }

    /** @param array<string, mixed> $element */
    private static function hasTint(array $element): bool
    {
        if (self::color($element['image_tint'] ?? null) !== null) {
            return true;
        }
        foreach (['tablet', 'phone'] as $device) {
            if (is_array($element[$device] ?? null) && self::color($element[$device]['image_tint'] ?? null) !== null) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $element */
    private static function photoClass(array $element): string
    {
        $class = 'fpb-photo';
        if (($element['image_filter'] ?? null) === 'grayscale') {
            $class .= ' fpb-photo--grayscale';
        }
        if (self::hasTint($element)) {
            $class .= ' fpb-photo--tint';
        }

        return $class;
    }

    /** @param array<string, mixed> $element */
    private static function photoVars(array $element, bool $wrap = true): string
    {
        if (!self::hasTint($element)) {
            return '';
        }
        $tint = self::color($element['image_tint'] ?? null) ?? 'transparent';
        $pct = self::overlayOpacity($element['image_tint_opacity'] ?? null) ?? 40;
        $alpha = rtrim(rtrim(number_format($pct / 100, 2, '.', ''), '0'), '.');
        $css = '--fpb-tint:' . $tint . ';--fpb-tint-opacity:' . ($alpha === '' ? '0' : $alpha);

        return $wrap ? ' style="' . $css . '"' : $css;
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
        // Single quotes so the value is safe inside a double-quoted HTML style="…" attribute.
        return "url('" . str_replace(['\\', "'"], ['\\\\', "\\'"], $url) . "')";
    }

    /** @param array<string, mixed> $element */
    private static function wallpaperLayer(array $element): string
    {
        if (($element['type'] ?? '') !== 'section') {
            return '';
        }
        $url = is_string($element['wallpaper_url'] ?? null) ? $element['wallpaper_url'] : null;
        $preset = $url === null ? self::patternId($element['wallpaper_preset'] ?? null) : null;
        if ($url === null && $preset === null) {
            return '';
        }
        $class = 'fpb-section-wallpaper';
        if ($preset !== null) {
            $class .= ' fpb-pattern fpb-pattern-' . $preset;
        }
        if (($element['image_filter'] ?? null) === 'grayscale') {
            $class .= ' fpb-photo--grayscale';
        }
        if (self::hasTint($element)) {
            $class .= ' fpb-photo--tint';
        }
        $vars = self::photoVars($element, false);
        if ($url !== null) {
            $fit = ($element['wallpaper_fit'] ?? null) === 'contain' ? 'contain' : 'cover';
            $position = self::wallpaperPositionCss(is_string($element['wallpaper_position'] ?? null) ? $element['wallpaper_position'] : null);
            // CSS background only — a progressive <img> paints washed-out scans over the
            // section fallback and hides light text until the full decode finishes.
            $fallback = is_string($element['background'] ?? null) ? $element['background'] : '#0f172a';

            return '<div class="' . $class . '" style="position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;background-color:' . self::escape($fallback) . ';background-image:' . self::cssUrl($url) . ';background-size:' . $fit . ';background-position:' . $position . ';background-repeat:no-repeat' . ($vars !== '' ? ';' . $vars : '') . '" aria-hidden="true"></div>';
        }

        return '<div class="' . $class . '" style="position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none' . ($vars !== '' ? ';' . $vars : '') . '" aria-hidden="true"></div>';
    }

    /**
     * @param array<string, mixed> $element
     * @return array{overlay_color: ?string, overlay_opacity: ?int}
     */
    private static function overlay(array $element): array
    {
        return [
            'overlay_color' => self::color($element['overlay_color'] ?? null),
            'overlay_opacity' => self::overlayOpacity($element['overlay_opacity'] ?? null),
        ];
    }

    private static function overlayOpacity(mixed $value): ?int
    {
        $opacity = filter_var($value, FILTER_VALIDATE_INT);

        return is_int($opacity) ? max(0, min(100, $opacity)) : null;
    }

    /** @param array<string, mixed> $element */
    private static function overlayCss(array $element): ?string
    {
        $color = self::color($element['overlay_color'] ?? null);
        if ($color === null) {
            return null;
        }
        $pct = self::overlayOpacity($element['overlay_opacity'] ?? null) ?? 40;
        if ($pct <= 0) {
            return null;
        }
        if (strlen($color) === 4) {
            $color = '#' . $color[1] . $color[1] . $color[2] . $color[2] . $color[3] . $color[3];
        }
        $alpha = rtrim(rtrim(number_format($pct / 100, 2, '.', ''), '0'), '.');

        return 'rgba(' . hexdec(substr($color, 1, 2)) . ',' . hexdec(substr($color, 3, 2)) . ',' . hexdec(substr($color, 5, 2)) . ',' . ($alpha === '' ? '0' : $alpha) . ')';
    }

    /** @param array<string, mixed> $element */
    private static function hasOverlay(array $element): bool
    {
        if (self::overlayCss($element) !== null) {
            return true;
        }
        foreach (['tablet', 'phone'] as $device) {
            if (is_array($element[$device] ?? null) && self::overlayCss($element[$device]) !== null) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $element */
    private static function overlayLayer(array $element): string
    {
        if (($element['type'] ?? '') !== 'section' || !self::hasOverlay($element)) {
            return '';
        }

        return '<div class="fpb-section-overlay" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:' . (self::overlayCss($element) ?? 'transparent') . '" aria-hidden="true"></div>';
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

    /** @param array<string, mixed> $element @return array{hidden: ?true} */
    private static function visibility(array $element): array
    {
        return ['hidden' => ($element['hidden'] ?? null) === true ? true : null];
    }

    /**
     * @param array<string, mixed> $element
     * @return array<string, array<string, mixed>>
     */
    private static function breakpoints(array $element, string $type): array
    {
        $out = [];
        foreach (['tablet', 'phone'] as $device) {
            $raw = is_array($element[$device] ?? null) ? $element[$device] : [];
            $style = self::appearance($raw);
            if (in_array($type, ['heading', 'paragraph', 'button', 'list'], true)) {
                $style += self::typography($raw);
                $style += self::textEffects($raw, true);
                if (($raw['align'] ?? null) === 'left') {
                    $style['align'] = 'left';
                }
            }
            if ($type === 'section') {
                $style['full_width'] = ($raw['full_width'] ?? null) === true ? true : (($raw['full_width'] ?? null) === false ? false : null);
                $style += self::overlay($raw);
                $style += self::imageFilter($raw, true);
                $style += self::imageTint($raw);
            }
            if ($type === 'image') {
                $style += self::imageFilter($raw, true);
                $style += self::imageTint($raw);
            }
            if ($type === 'spacer') {
                $height = filter_var($raw['height'] ?? null, FILTER_VALIDATE_INT);
                $style['height'] = is_int($height) ? max(8, min(160, $height)) : null;
            }
            if ($type === 'columns') {
                $count = filter_var($raw['columns'] ?? null, FILTER_VALIDATE_INT);
                $style['columns'] = is_int($count) && $count >= 1 && $count <= 6 ? $count : null;
            }
            if (($raw['hidden'] ?? null) === true) {
                $style['hidden'] = true;
            } elseif (($raw['hidden'] ?? null) === false) {
                $style['hidden'] = false;
            }
            $kept = [];
            foreach ($style as $key => $value) {
                if ($value !== null) {
                    $kept[$key] = $value;
                }
            }
            if ($kept !== []) {
                $out[$device] = $kept;
            }
        }

        return $out;
    }

    /** @param list<array<string, mixed>> $elements */
    private function documentCss(array $elements): string
    {
        $hover = [];
        $tablet = [];
        $phone = [];
        $this->collectDocumentCss($elements, $hover, $tablet, $phone);
        $css = implode('', $hover);
        if ($tablet !== []) {
            $css .= '@media (max-width:1023px){' . implode('', $tablet) . '}';
        }
        if ($phone !== []) {
            $css .= '@media (max-width:639px){' . implode('', $phone) . '}';
        }

        return $css === '' ? '' : '<style class="fpb-responsive">' . $css . '</style>';
    }

    /**
     * @param list<array<string, mixed>> $elements
     * @param list<string> $hover
     * @param list<string> $tablet
     * @param list<string> $phone
     */
    private function collectDocumentCss(array $elements, array &$hover, array &$tablet, array &$phone): void
    {
        foreach ($elements as $element) {
            $id = is_string($element['id'] ?? null) ? $element['id'] : '';
            if ($id !== '') {
                $hoverRule = self::hoverRules($id, $element);
                if ($hoverRule !== '') {
                    $hover[] = $hoverRule;
                }
                $tabletRule = self::overrideRules($id, $element, is_array($element['tablet'] ?? null) ? $element['tablet'] : []);
                $phoneRule = self::overrideRules($id, $element, is_array($element['phone'] ?? null) ? $element['phone'] : []);
                if ($tabletRule !== '') {
                    $tablet[] = $tabletRule;
                }
                if ($phoneRule !== '') {
                    $phone[] = $phoneRule;
                }
            }
            if (is_array($element['children'] ?? null)) {
                $this->collectDocumentCss($element['children'], $hover, $tablet, $phone);
            }
        }
    }

    /**
     * @param array<string, mixed> $element
     * @param array<string, mixed> $over
     */
    private static function overrideRules(string $id, array $element, array $over): string
    {
        if ($over === []) {
            return '';
        }
        $sel = '[data-fpb-id="' . htmlspecialchars($id, ENT_QUOTES, 'UTF-8') . '"]';
        $type = $element['type'] ?? '';
        $boxSel = $type === 'button' ? $sel . ' .fpb-button' : $sel;
        $textSel = $sel . ' :is(h1,h2,h3,h4,h5,h6,p,a,ul,ol)';
        $rules = [];
        $box = [];
        if (is_string($over['background'] ?? null)) {
            $box[] = 'background:' . $over['background'] . '!important';
        }
        if (is_string($over['color'] ?? null)) {
            $box[] = 'color:' . $over['color'] . '!important';
        }
        if (is_int($over['border_width'] ?? null) && $over['border_width'] > 0) {
            $box[] = 'border:' . $over['border_width'] . 'px solid ' . (is_string($over['border_color'] ?? null) ? $over['border_color'] : '#111827') . '!important';
        }
        if (is_int($over['radius'] ?? null)) {
            $box[] = 'border-radius:' . $over['radius'] . 'px!important';
        }
        if (is_int($over['padding'] ?? null)) {
            $box[] = 'padding:' . $over['padding'] . 'px!important';
        }
        foreach (['padding_top' => 'padding-top', 'padding_right' => 'padding-right', 'padding_bottom' => 'padding-bottom', 'padding_left' => 'padding-left', 'margin_top' => 'margin-top', 'margin_right' => 'margin-right', 'margin_bottom' => 'margin-bottom', 'margin_left' => 'margin-left'] as $key => $css) {
            if (is_int($over[$key] ?? null)) {
                $box[] = $css . ':' . $over[$key] . 'px!important';
            }
        }
        if ($box !== []) {
            $rules[] = $boxSel . '{' . implode(';', $box) . '}';
        }
        $text = [];
        if (is_int($over['size'] ?? null)) {
            $text[] = 'font-size:' . $over['size'] . 'px!important';
        }
        if (is_string($over['line_height'] ?? null)) {
            $text[] = 'line-height:' . $over['line_height'] . '!important';
        }
        if (is_int($over['weight'] ?? null)) {
            $text[] = 'font-weight:' . $over['weight'] . '!important';
        }
        if (array_key_exists('shadow_color', $over) || array_key_exists('shadow_x', $over) || array_key_exists('shadow_y', $over) || array_key_exists('shadow_blur', $over)) {
            $shadow = self::textShadowCss([
                'shadow_color' => $over['shadow_color'] ?? $element['shadow_color'] ?? null,
                'shadow_x' => $over['shadow_x'] ?? $element['shadow_x'] ?? null,
                'shadow_y' => $over['shadow_y'] ?? $element['shadow_y'] ?? null,
                'shadow_blur' => $over['shadow_blur'] ?? $element['shadow_blur'] ?? null,
            ]);
            $text[] = 'text-shadow:' . ($shadow ?? 'none') . '!important';
        }
        if (is_int($over['letter_spacing'] ?? null)) {
            $text[] = 'letter-spacing:' . $over['letter_spacing'] . 'px!important';
        }
        if (in_array($over['text_transform'] ?? null, ['uppercase', 'lowercase', 'capitalize', 'none'], true)) {
            $text[] = 'text-transform:' . $over['text_transform'] . '!important';
        }
        if (($over['italic'] ?? null) === true) {
            $text[] = 'font-style:italic!important';
        } elseif (($over['italic'] ?? null) === false) {
            $text[] = 'font-style:normal!important';
        }
        if (array_key_exists('stroke_width', $over) || array_key_exists('stroke_color', $over)) {
            $stroke = is_int($over['stroke_width'] ?? $element['stroke_width'] ?? null) ? ($over['stroke_width'] ?? $element['stroke_width']) : 0;
            if ($stroke > 0) {
                $text[] = '-webkit-text-stroke:' . $stroke . 'px ' . (is_string($over['stroke_color'] ?? $element['stroke_color'] ?? null) ? ($over['stroke_color'] ?? $element['stroke_color']) : '#111827') . '!important';
            } else {
                $text[] = '-webkit-text-stroke:0!important';
            }
        }
        if ($text !== []) {
            $rules[] = $textSel . '{' . implode(';', $text) . '}';
        }
        if (($over['align'] ?? null) === 'center' || ($over['align'] ?? null) === 'right' || ($over['align'] ?? null) === 'left') {
            $rules[] = $sel . '{text-align:' . $over['align'] . '!important}';
        }
        if (is_int($over['height'] ?? null)) {
            $rules[] = $sel . ' .fpb-spacer{height:' . $over['height'] . 'px!important}';
        }
        if (is_int($over['columns'] ?? null)) {
            $rules[] = $sel . '{grid-template-columns:repeat(' . $over['columns'] . ',minmax(0,1fr))!important}';
        }
        if (($over['hidden'] ?? null) === true) {
            $rules[] = $sel . '{display:none!important}';
        } elseif (($over['hidden'] ?? null) === false) {
            $display = in_array($type, ['section', 'columns', 'column'], true) ? 'grid' : 'block';
            $rules[] = $sel . '{display:' . $display . '!important}';
        }
        if (array_key_exists('full_width', $over)) {
            if ($over['full_width'] === true) {
                $rules[] = $sel . '{width:100vw!important;max-width:100vw!important;margin-inline:calc(50% - 50vw)!important}';
            } elseif ($over['full_width'] === false) {
                $rules[] = $sel . '{width:100%!important;max-width:var(--corp-max-width,72rem)!important;margin-inline:auto!important}';
            }
        }
        if (array_key_exists('overlay_color', $over) || array_key_exists('overlay_opacity', $over)) {
            $css = self::overlayCss([
                'overlay_color' => $over['overlay_color'] ?? $element['overlay_color'] ?? null,
                'overlay_opacity' => $over['overlay_opacity'] ?? $element['overlay_opacity'] ?? null,
            ]) ?? 'transparent';
            $rules[] = $sel . '>.fpb-section-overlay{background:' . $css . '!important}';
        }
        if (array_key_exists('image_filter', $over)) {
            $filter = ($over['image_filter'] ?? null) === 'grayscale' ? 'grayscale(1)' : 'none';
            if ($type === 'section') {
                $rules[] = $sel . '>.fpb-section-wallpaper,' . $sel . '>.fpb-section-wallpaper img{filter:' . $filter . '!important}';
            } else {
                $rules[] = $sel . ' img{filter:' . $filter . '!important}';
            }
        }
        if (array_key_exists('image_tint', $over) || array_key_exists('image_tint_opacity', $over)) {
            $tint = self::color($over['image_tint'] ?? $element['image_tint'] ?? null) ?? 'transparent';
            $pct = self::overlayOpacity($over['image_tint_opacity'] ?? $element['image_tint_opacity'] ?? null) ?? 40;
            $alpha = rtrim(rtrim(number_format($pct / 100, 2, '.', ''), '0'), '.');
            $target = $type === 'section' ? $sel . '>.fpb-section-wallpaper' : $sel . ' .fpb-photo';
            $rules[] = $target . '{--fpb-tint:' . $tint . ';--fpb-tint-opacity:' . ($alpha === '' ? '0' : $alpha) . '}';
        }

        return implode('', $rules);
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
}
