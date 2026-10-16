import {applyDefaults, GRADIENTS, PARTICLES, PATTERNS} from './model.js';
import {nestedHtmlPreview} from './import-html.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[char]));
}

function textSize(value) {
  if (value === null || value === '') return null;
  const size = Number(value);
  return Number.isInteger(size) ? Math.max(8, Math.min(160, size)) : null;
}

function lineHeight(value) {
  if (value === null || value === '') return null;
  const height = Number(value);
  if (!Number.isFinite(height)) return null;
  const rounded = Math.round(height * 100) / 100;
  return rounded >= 0.8 && rounded <= 3 ? String(rounded) : null;
}

function fontWeight(value) {
  const weight = Number(value);
  return [300, 400, 500, 600, 700, 800].includes(weight) ? weight : null;
}

function fontFamily(value) {
  const families = {
    system: 'system-ui, sans-serif',
    arial: 'Arial, Helvetica, sans-serif',
    georgia: 'Georgia, serif',
    trebuchet: "'Trebuchet MS', sans-serif",
    verdana: 'Verdana, Geneva, sans-serif',
    monospace: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  };
  return Object.hasOwn(families, value) ? families[value] : null;
}

export function colorValue(value) {
  const color = String(value || '').trim().toLowerCase();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(color) ? color : null;
}

export function gradientCss(element) {
  const id = element?.gradient;
  if (id === 'custom') {
    const from = colorValue(element.gradient_from);
    const to = colorValue(element.gradient_to);
    if (!from || !to) return null;
    const raw = Number(element.gradient_angle);
    const angle = Number.isInteger(raw) ? Math.max(0, Math.min(360, raw)) : 180;
    return 'linear-gradient(' + angle + 'deg,' + from + ',' + to + ')';
  }
  return GRADIENTS.find((item) => item.id === id)?.css || null;
}

function pxValue(value, max) {
  if (value === null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(0, Math.min(max, number)) : null;
}

function signedPx(value, max) {
  if (value === null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(-max, Math.min(max, number)) : null;
}

function textShadowCss(element) {
  const color = colorValue(element?.shadow_color);
  if (!color) return null;
  const x = signedPx(element.shadow_x, 40) ?? 0;
  const y = signedPx(element.shadow_y, 40) ?? 2;
  const blur = pxValue(element.shadow_blur, 40) ?? 8;
  return x + 'px ' + y + 'px ' + blur + 'px ' + color;
}

function textEffectsCss(element) {
  const parts = [];
  const shadow = textShadowCss(element);
  if (shadow) parts.push('text-shadow:' + shadow);
  const spacing = signedPx(element.letter_spacing, 20);
  if (spacing !== null) parts.push('letter-spacing:' + spacing + 'px');
  const wordSpacing = signedPx(element.word_spacing, 40);
  if (wordSpacing !== null) parts.push('word-spacing:' + wordSpacing + 'px');
  if (element.text_transform === 'uppercase' || element.text_transform === 'lowercase' || element.text_transform === 'capitalize' || element.text_transform === 'none') {
    parts.push('text-transform:' + element.text_transform);
  }
  if (element.italic === true) parts.push('font-style:italic');
  else if (element.italic === false) parts.push('font-style:normal');
  if (['none', 'underline', 'line-through', 'overline'].includes(element.text_decoration)) parts.push('text-decoration-line:' + element.text_decoration);
  if (['solid', 'double', 'dotted', 'dashed', 'wavy'].includes(element.decoration_style)) parts.push('text-decoration-style:' + element.decoration_style);
  const decorationColor = colorValue(element.decoration_color);
  if (decorationColor) parts.push('text-decoration-color:' + decorationColor);
  const decorationThickness = pxValue(element.decoration_thickness, 8);
  if (decorationThickness !== null) parts.push('text-decoration-thickness:' + decorationThickness + 'px');
  const stroke = pxValue(element.stroke_width, 8);
  if (stroke) {
    parts.push('-webkit-text-stroke:' + stroke + 'px ' + (colorValue(element.stroke_color) || '#111827'));
    parts.push('paint-order:stroke fill');
  }
  return parts;
}

const BOX_SIDES = [
  ['padding_top', 'padding-top'],
  ['padding_right', 'padding-right'],
  ['padding_bottom', 'padding-bottom'],
  ['padding_left', 'padding-left'],
  ['margin_top', 'margin-top'],
  ['margin_right', 'margin-right'],
  ['margin_bottom', 'margin-bottom'],
  ['margin_left', 'margin-left'],
];

function cssUrl(url) {
  // Single quotes so the value is safe inside a double-quoted HTML style="…" attribute.
  const safe = String(url).replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
  return 'url(\'' + safe + '\')';
}

function absoluteUrl(url) {
  const value = String(url || '').trim();
  if (!value || /^(javascript|data):/i.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/') && typeof location !== 'undefined' && location.origin) return location.origin + value;
  return value;
}

function wallpaperUrl(element, media) {
  const id = Number(element?.wallpaper_id);
  if (!Number.isInteger(id) || id < 1) return null;
  const known = media && (media[id] || media[String(id)]);
  return absoluteUrl(known) || absoluteUrl('/media-files/' + id + '/original');
}

function wallpaperPreset(element) {
  return PATTERNS.some((item) => item.id === element?.wallpaper_preset) ? element.wallpaper_preset : null;
}

const WALLPAPER_POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

export function wallpaperPositionCss(position) {
  switch (position) {
    case 'top-left': return 'left top';
    case 'top-center': return 'center top';
    case 'top-right': return 'right top';
    case 'center-left': return 'left center';
    case 'center-right': return 'right center';
    case 'bottom-left': return 'left bottom';
    case 'bottom-center': return 'center bottom';
    case 'bottom-right': return 'right bottom';
    default: return 'center';
  }
}

function wallpaperLayer(element, media) {
  const url = wallpaperUrl(element, media);
  const preset = url ? null : wallpaperPreset(element);
  if (!url && !preset) return '';
  const extras = [
    preset ? ' fpb-pattern fpb-pattern-' + preset : '',
    element.image_filter === 'grayscale' ? ' fpb-photo--grayscale' : '',
    hasTint(element) ? ' fpb-photo--tint' : '',
  ].join('');
  if (url) {
    const fit = element.wallpaper_fit === 'contain' ? 'contain' : 'cover';
    const position = wallpaperPositionCss(WALLPAPER_POSITIONS.includes(element.wallpaper_position) ? element.wallpaper_position : null);
    // CSS background only — progressive <img> scans wash out light text over the fallback.
    const fallback = colorValue(element?.background) || '#0f172a';
    return '<div class="fpb-section-wallpaper' + extras + '" style="position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;background-color:' + fallback + ';background-image:' + cssUrl(url) + ';background-size:' + fit + ';background-position:' + position + ';background-repeat:no-repeat' + photoVars(element, false) + '" aria-hidden="true"></div>';
  }
  return '<div class="fpb-section-wallpaper' + extras + '" style="position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none' + photoVars(element, false) + '" aria-hidden="true"></div>';
}

export function overlayCss(element) {
  const color = colorValue(element?.overlay_color);
  if (!color) return null;
  const raw = Number(element.overlay_opacity);
  const pct = Number.isInteger(raw) ? Math.max(0, Math.min(100, raw)) : 40;
  if (pct <= 0) return null;
  const hex = color.length === 4 ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3] : color;
  const alpha = Math.round(pct) / 100;
  return 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',' + alpha + ')';
}

function hasTint(element) {
  return !!(colorValue(element?.image_tint) || colorValue(element?.tablet?.image_tint) || colorValue(element?.phone?.image_tint));
}

function imageFilterCss(element) {
  const filters = [];
  if (element?.image_filter === 'grayscale') filters.push('grayscale(1)');
  [
    ['image_brightness', 200, '%', 'brightness'],
    ['image_contrast', 200, '%', 'contrast'],
    ['image_saturation', 300, '%', 'saturate'],
  ].forEach(([key, max, suffix, name]) => {
    const value = Number(element?.[key]);
    if (element?.[key] != null && Number.isFinite(value)) filters.push(name + '(' + Math.max(0, Math.min(max, value)) + suffix + ')');
  });
  const blur = Number(element?.image_blur);
  if (element?.image_blur != null && Number.isFinite(blur)) filters.push('blur(' + Math.max(0, Math.min(20, blur)) + 'px)');
  return filters.join(' ') || 'none';
}

function photoClass(element) {
  return 'fpb-photo' + (element.image_filter === 'grayscale' ? ' fpb-photo--grayscale' : '') + (hasTint(element) ? ' fpb-photo--tint' : '');
}

function photoVars(element, wrap) {
  const declarations = ['--fpb-image-filter:' + imageFilterCss(element)];
  if (hasTint(element)) {
    const tint = colorValue(element.image_tint) || 'transparent';
    const raw = Number(element.image_tint_opacity);
    const pct = Number.isInteger(raw) ? Math.max(0, Math.min(100, raw)) : 40;
    declarations.push('--fpb-tint:' + tint, '--fpb-tint-opacity:' + (pct / 100));
  }
  const css = declarations.join(';');
  return wrap === false ? ';' + css : ' style="' + css + '"';
}

function hasOverlay(element) {
  return !!(overlayCss(element) || overlayCss(element?.tablet) || overlayCss(element?.phone));
}

function overlayLayer(element) {
  if (element?.type !== 'section' || !hasOverlay(element)) return '';
  return '<div class="fpb-section-overlay" style="position:absolute;inset:0;z-index:1;pointer-events:none;background:' + (overlayCss(element) || 'transparent') + '" aria-hidden="true"></div>';
}

function particlesLayer(element) {
  if (element?.type !== 'section' || !PARTICLES.some((item) => item.id === element.particles)) return '';
  const color = colorValue(element.particles_color) || '#ffffff';
  const density = Math.max(10, pxValue(element.particles_density, 150) ?? 50);
  const speed = Math.max(1, pxValue(element.particles_speed, 10) ?? 3);
  return '<div class="fpb-section-particles" data-fpb-particles="' + element.particles + '" data-color="' + color + '" data-density="' + density + '" data-speed="' + speed + '" style="position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;border-radius:inherit" aria-hidden="true"></div>';
}

function boxCss(element, media) {
  const parts = [];
  const wallpaper = wallpaperUrl(element, media) || wallpaperPreset(element);
  const gradient = gradientCss(element);
  const background = colorValue(element.background);
  const text = colorValue(element.color);
  const width = pxValue(element.border_width, 20);
  const border = colorValue(element.border_color);
  const radius = pxValue(element.radius, 80);
  const padding = pxValue(element.padding, 80);
  if (wallpaper) {
    parts.push('position:relative');
    parts.push('overflow:hidden');
    parts.push('min-height:16rem');
    if (background) parts.push('background-color:' + background);
  } else if (gradient) parts.push('background:' + gradient);
  else if (background) parts.push('background:' + background);
  if (hasOverlay(element) && !wallpaper) parts.push('position:relative');
  if (text) parts.push('color:' + text);
  if (width) parts.push('border:' + width + 'px solid ' + (border || '#111827'));
  if (radius !== null) parts.push('border-radius:' + radius + 'px');
  if (padding !== null) parts.push('padding:' + padding + 'px');
  BOX_SIDES.forEach(([key, css]) => {
    const value = pxValue(element[key], 160);
    if (value !== null) parts.push(css + ':' + value + 'px');
  });
  return parts.join(';');
}

function textStyle(element) {
  const parts = [];
  const size = textSize(element.size);
  const height = lineHeight(element.line_height);
  const weight = fontWeight(element.weight);
  const family = fontFamily(element.font_family);
  if (size !== null) parts.push('font-size:' + size + 'px');
  if (height !== null) parts.push('line-height:' + height);
  if (weight !== null) parts.push('font-weight:' + weight);
  if (family) parts.push('font-family:' + family);
  const color = colorValue(element.color);
  if (color) parts.push('color:' + color);
  if (element.type === 'list' && ['disc', 'circle', 'square', 'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'].includes(element.marker_style)) {
    parts.push('list-style-type:' + element.marker_style);
  }
  textEffectsCss(element).forEach((part) => parts.push(part));
  if (element.type === 'button') {
    const box = boxCss(element);
    if (box) parts.push(box);
  }
  return parts.length ? ' style="' + parts.join(';') + '"' : '';
}

function motionClass(element) {
  const parts = [];
  const entrance = ['fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'zoom-in'];
  const hover = ['lift', 'grow', 'dim'];
  if (entrance.includes(element.animation)) {
    // Builder shows the settled state; preview replay strips these and re-runs.
    parts.push('fpb-anim', 'fpb-anim--' + element.animation, 'is-visible', 'fpb-anim-done');
  }
  if (hover.includes(element.hover_animation)) {
    parts.push('fpb-hover', 'fpb-hover--' + element.hover_animation);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

function wrapperStyle(element, media) {
  const parts = [];
  if (element.type === 'menu') {
    parts.push('display:flex', 'width:100%', 'min-height:100%');
    parts.push('justify-content:' + ({center: 'center', right: 'flex-end'}[element.menu_horizontal_align] || 'flex-start'));
    parts.push('align-items:' + ({center: 'center', bottom: 'flex-end'}[element.menu_vertical_align] || 'flex-start'));
  }
  const family = fontFamily(element.font_family);
  if (family) parts.push('font-family:' + family);
  if (Number.isInteger(element.text_width)) parts.push('width:min(100%,' + Math.max(120, Math.min(1600, element.text_width)) + 'px)');
  if (['start', 'center', 'end'].includes(element.vertical_align)) parts.push('align-self:' + element.vertical_align);
  const textColor = colorValue(element.color);
  if (textColor) parts.push('color:' + textColor);
  textEffectsCss(element).forEach((part) => parts.push(part));
  if (element.align === 'center' || element.align === 'right') parts.push('text-align:' + element.align);
  if (element.type !== 'button') {
    const box = boxCss(element, media);
    if (box) parts.push(box);
  }
  if (element.type === 'columns') {
    const count = Math.max(1, Math.min(200, (element.children || []).length || Number(element.columns) || 2));
    const widths = Array.isArray(element.column_widths) && element.column_widths.length === count
      && element.column_widths.every((width) => Number.isFinite(Number(width)) && Number(width) >= 0.1 && Number(width) <= 99.9)
      ? element.column_widths : null;
    parts.push('grid-template-columns:' + (widths ? widths.map((width) => 'minmax(0,' + Number(width) + 'fr)').join(' ') : 'repeat(' + count + ',minmax(0,1fr))'));
  }
  if (['fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'zoom-in'].includes(element.animation)) {
    const duration = Math.max(100, Math.min(3000, Number(element.animation_duration) || 600));
    const delay = Math.max(0, Math.min(3000, Number(element.animation_delay) || 0));
    parts.push('--fpb-anim-duration:' + duration + 'ms');
    parts.push('--fpb-anim-delay:' + delay + 'ms');
  }
  return parts.length ? ' style="' + parts.join(';') + '"' : '';
}

function editableText(text, multiline) {
  if (!String(text || '').length) return '<br>';
  const escaped = escapeHtml(text);
  return multiline ? escaped.replace(/\n/g, '<br>') : escaped;
}

function dragHandle(t) {
  return '<button type="button" class="fpb-drag" draggable="true" aria-label="' + escapeHtml(t('Move element')) + '"></button>';
}

function hiddenClass(element) {
  return element.hidden ? ' fpb-is-hidden' : '';
}

function overrideRules(element, over) {
  if (!over || !element?.id) return '';
  const sel = '[data-fpb-id="' + escapeHtml(element.id) + '"]';
  const boxSel = element.type === 'button' ? sel + ' .fpb-button' : sel;
  const descendants = sel + ' :is(h1,h2,h3,h4,h5,h6,p,a,ul,ol)';
  const textSel = element.type === 'html' || element.type === 'shortcode' ? sel + ',' + descendants : descendants;
  const rules = [];
  const box = [];
  const background = colorValue(over.background);
  const textColor = colorValue(over.color);
  const width = pxValue(over.border_width, 20);
  const border = colorValue(over.border_color);
  const radius = pxValue(over.radius, 80);
  const padding = pxValue(over.padding, 80);
  if (background) box.push('background:' + background + '!important');
  if (textColor) box.push('color:' + textColor + '!important');
  if (width) box.push('border:' + width + 'px solid ' + (border || '#111827') + '!important');
  if (radius !== null) box.push('border-radius:' + radius + 'px!important');
  if (padding !== null) box.push('padding:' + padding + 'px!important');
  BOX_SIDES.forEach(([key, css]) => {
    const value = pxValue(over[key], 160);
    if (value !== null) box.push(css + ':' + value + 'px!important');
  });
  if (box.length) rules.push(boxSel + '{' + box.join(';') + '}');
  const text = [];
  const family = fontFamily(over.font_family);
  const size = textSize(over.size);
  const height = lineHeight(over.line_height);
  const weight = fontWeight(over.weight);
  if (family) text.push('font-family:' + family + '!important');
  const overColor = colorValue(over.color);
  if (overColor) text.push('color:' + overColor + '!important');
  if (size !== null) text.push('font-size:' + size + 'px!important');
  if (height !== null) text.push('line-height:' + height + '!important');
  if (weight !== null) text.push('font-weight:' + weight + '!important');
  if (over.shadow_color != null || over.shadow_x != null || over.shadow_y != null || over.shadow_blur != null) {
    const shadow = textShadowCss({
      shadow_color: over.shadow_color ?? element.shadow_color,
      shadow_x: over.shadow_x ?? element.shadow_x,
      shadow_y: over.shadow_y ?? element.shadow_y,
      shadow_blur: over.shadow_blur ?? element.shadow_blur,
    });
    text.push('text-shadow:' + (shadow || 'none') + '!important');
  }
  const spacing = signedPx(over.letter_spacing, 20);
  if (spacing !== null) text.push('letter-spacing:' + spacing + 'px!important');
  const wordSpacing = signedPx(over.word_spacing, 40);
  if (wordSpacing !== null) text.push('word-spacing:' + wordSpacing + 'px!important');
  if (over.text_transform === 'uppercase' || over.text_transform === 'lowercase' || over.text_transform === 'capitalize' || over.text_transform === 'none') {
    text.push('text-transform:' + over.text_transform + '!important');
  }
  if (over.italic === true) text.push('font-style:italic!important');
  else if (over.italic === false) text.push('font-style:normal!important');
  if (['none', 'underline', 'line-through', 'overline'].includes(over.text_decoration)) text.push('text-decoration-line:' + over.text_decoration + '!important');
  if (['solid', 'double', 'dotted', 'dashed', 'wavy'].includes(over.decoration_style)) text.push('text-decoration-style:' + over.decoration_style + '!important');
  const decorationColor = colorValue(over.decoration_color);
  if (decorationColor) text.push('text-decoration-color:' + decorationColor + '!important');
  const decorationThickness = pxValue(over.decoration_thickness, 8);
  if (decorationThickness !== null) text.push('text-decoration-thickness:' + decorationThickness + 'px!important');
  if (over.stroke_width != null || over.stroke_color != null) {
    const stroke = pxValue(over.stroke_width ?? element.stroke_width, 8);
    if (stroke) text.push('-webkit-text-stroke:' + stroke + 'px ' + (colorValue(over.stroke_color ?? element.stroke_color) || '#111827') + '!important');
    else text.push('-webkit-text-stroke:0!important');
  }
  if (text.length) rules.push(textSel + '{' + text.join(';') + '}');
  if (over.align === 'center' || over.align === 'right' || over.align === 'left') {
    rules.push(sel + '{text-align:' + over.align + '!important}');
  }
  if (Number.isInteger(over.text_width)) rules.push(sel + '{width:min(100%,' + Math.max(120, Math.min(1600, over.text_width)) + 'px)!important}');
  if (['start', 'center', 'end'].includes(over.vertical_align)) rules.push(sel + '{align-self:' + over.vertical_align + '!important}');
  const markerColor = colorValue(over.marker_color);
  if (markerColor) rules.push(sel + ' li::marker{color:' + markerColor + '!important}');
  if (Number.isInteger(over.list_spacing)) rules.push(sel + ' li+li{margin-block-start:' + Math.max(0, Math.min(64, over.list_spacing)) + 'px!important}');
  if (['disc', 'circle', 'square', 'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'].includes(over.marker_style)) {
    rules.push(sel + ' :is(ul,ol){list-style-type:' + over.marker_style + '!important}');
  }
  if (Number.isInteger(over.height)) rules.push(sel + ' .fpb-spacer{height:' + Math.max(8, Math.min(160, over.height)) + 'px!important}');
  const columnCount = Number.isInteger(over.columns) && over.columns >= 1 && over.columns <= 200
    ? over.columns : Math.max(1, Math.min(200, (element.children || []).length || Number(element.columns) || 2));
  if ((Number.isInteger(over.columns) && over.columns >= 1 && over.columns <= 200) || Array.isArray(over.column_widths)) {
    const widths = Array.isArray(over.column_widths) && over.column_widths.length === columnCount
      && over.column_widths.every((width) => Number.isFinite(Number(width)) && Number(width) >= 0.1 && Number(width) <= 99.9)
      ? over.column_widths : null;
    rules.push(sel + '{grid-template-columns:' + (widths ? widths.map((width) => 'minmax(0,' + Number(width) + 'fr)').join(' ') : 'repeat(' + columnCount + ',minmax(0,1fr))') + '!important}');
  }
  if (over.hidden === true) rules.push(sel + '{opacity:.42!important;outline-color:#94a3b8!important}');
  else if (over.hidden === false) {
    rules.push(sel + '{opacity:1!important}');
  }
  if (over.full_width === true) {
    rules.push(sel + '{width:100vw!important;max-width:100vw!important;margin-inline:calc(50% - 50vw)!important}');
  } else if (over.full_width === false) {
    rules.push(sel + '{width:100%!important;max-width:var(--corp-max-width,72rem)!important;margin-inline:auto!important}');
  }
  if (over.overlay_color != null || over.overlay_opacity != null) {
    const css = overlayCss({
      overlay_color: over.overlay_color ?? element.overlay_color,
      overlay_opacity: over.overlay_opacity ?? element.overlay_opacity,
    }) || 'transparent';
    rules.push(sel + '>.fpb-section-overlay{background:' + css + '!important}');
  }
  if (['image_filter', 'image_brightness', 'image_contrast', 'image_saturation', 'image_blur'].some((key) => over[key] != null)) {
    const filter = imageFilterCss({...element, ...over});
    const target = element.type === 'section' ? sel + '>.fpb-section-wallpaper' : sel + ' .fpb-photo';
    rules.push(target + '{--fpb-image-filter:' + filter + '!important}');
  }
  if (over.image_tint != null || over.image_tint_opacity != null) {
    const tint = colorValue(over.image_tint ?? element.image_tint) || 'transparent';
    const raw = Number(over.image_tint_opacity ?? element.image_tint_opacity);
    const pct = Number.isInteger(raw) ? Math.max(0, Math.min(100, raw)) : 40;
    const target = element.type === 'section' ? sel + '>.fpb-section-wallpaper' : sel + ' .fpb-photo';
    rules.push(target + '{--fpb-tint:' + tint + ';--fpb-tint-opacity:' + (pct / 100) + '}');
  }
  return rules.join('');
}

function hoverRules(element) {
  if (element?.type !== 'button' || !element?.id) return '';
  const parts = [];
  const background = colorValue(element.hover_background);
  const text = colorValue(element.hover_color);
  const border = colorValue(element.hover_border_color);
  if (background) parts.push('background:' + background);
  if (text) parts.push('color:' + text);
  if (border) parts.push('border-color:' + border);
  if (!parts.length) return '';
  const sel = '[data-fpb-id="' + escapeHtml(element.id) + '"] .fpb-button';
  return sel + '{transition:background-color .2s ease,color .2s ease,border-color .2s ease}'
    + sel + ':hover{' + parts.join(';') + '}';
}

function menuHoverRules(element) {
  if (element?.type !== 'menu' || !element?.id) return '';
  const selector = '[data-fpb-id="' + escapeHtml(element.id) + '"] .theme-menu a';
  const parts = [];
  [
    ['menu_hover_color', 'color'],
    ['menu_hover_background', 'background-color'],
    ['menu_hover_border_color', 'border-color'],
    ['menu_hover_decoration_color', 'text-decoration-color'],
  ].forEach(([key, property]) => {
    const value = colorValue(element[key]);
    if (value) parts.push(property + ':' + value);
  });
  if (['none', 'underline', 'overline', 'line-through'].includes(element.menu_hover_decoration)) {
    parts.push('text-decoration:' + element.menu_hover_decoration);
  }
  const thickness = pxValue(element.menu_hover_decoration_thickness, 8);
  if (thickness !== null) parts.push('text-decoration-thickness:' + Math.max(1, thickness) + 'px');
  const radius = pxValue(element.menu_hover_radius, 32);
  if (radius !== null) parts.push('border-radius:' + radius + 'px');
  if (element.menu_hover_transform === 'lift') parts.push('transform:translateY(-2px)');
  if (element.menu_hover_transform === 'grow') parts.push('transform:scale(1.04)');
  if (!parts.length) return '';
  const duration = pxValue(element.menu_hover_duration, 1000) ?? 200;
  const base = ['lift', 'grow'].includes(element.menu_hover_transform) ? 'display:inline-block;' : '';
  const transition = selector + '{' + base + 'transition:color ' + duration + 'ms ease,background-color ' + duration + 'ms ease,border-color ' + duration + 'ms ease,border-radius ' + duration + 'ms ease,text-decoration-color ' + duration + 'ms ease,transform ' + duration + 'ms ease}';
  const interactive = selector + ':hover,' + selector + ':focus-visible';
  const reducedMotion = '@media (prefers-reduced-motion: reduce){' + selector + '{transition:none}'
    + (['lift', 'grow'].includes(element.menu_hover_transform) ? interactive + '{transform:none}' : '') + '}';
  return transition + interactive + '{' + parts.join(';') + '}' + reducedMotion;
}

function collectDocumentCss(elements, hover, tablet, phone) {
  (elements || []).forEach((element) => {
    const h = hoverRules(element);
    const mh = menuHoverRules(element);
    const list = listStyleRules(element);
    const t = overrideRules(element, element.tablet);
    const p = overrideRules(element, element.phone);
    if (h) hover.push(h);
    if (mh) hover.push(mh);
    if (list) hover.push(list);
    if (t) tablet.push(t);
    if (p) phone.push(p);
    if (element.children) collectDocumentCss(element.children, hover, tablet, phone);
  });
}

function listStyleRules(element) {
  if (element?.type !== 'list' || !element.id) return '';
  const sel = '[data-fpb-id="' + escapeHtml(element.id) + '"]';
  const rules = [];
  const color = colorValue(element.marker_color);
  if (color) rules.push(sel + ' li::marker{color:' + color + '}');
  if (Number.isInteger(element.list_spacing)) rules.push(sel + ' li+li{margin-block-start:' + Math.max(0, Math.min(64, element.list_spacing)) + 'px}');
  return rules.join('');
}

function documentStyle(elements) {
  const hover = [];
  const tablet = [];
  const phone = [];
  collectDocumentCss(elements, hover, tablet, phone);
  let css = hover.join('');
  if (tablet.length) css += '@media (max-width:1023px){' + tablet.join('') + '}';
  if (phone.length) css += '@media (max-width:639px){' + phone.join('') + '}';
  return css ? '<style class="fpb-responsive">' + css + '</style>' : '';
}

function buttonHref(element, pages) {
  if (element?.link_type === 'page') {
    const id = Number(element.page_id);
    if (!Number.isInteger(id) || id < 1) return '#';
    const known = pages && (pages[id] || pages[String(id)]);
    return known?.path || '#';
  }
  const url = String(element?.url || '').trim();
  if (!url || /^\s*javascript:/i.test(url)) return '#';
  if (url.startsWith('/') || url.startsWith('#') || /^https?:\/\//i.test(url)) return url.slice(0, 500);
  return '#';
}

function menuItemsHtml(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const label = escapeHtml(item?.label || '');
    const url = escapeHtml(item?.url || '#');
    const target = item?.new_tab ? ' target="_blank" rel="noopener noreferrer"' : '';
    const children = Array.isArray(item?.children) && item.children.length
      ? '<ul class="theme-menu">' + menuItemsHtml(item.children) + '</ul>'
      : '';
    return '<li><a href="' + url + '"' + target + '>' + label + '</a>' + children + '</li>';
  }).join('');
}

function menuPreview(element, menus, t) {
  const menu = (Array.isArray(menus) ? menus : []).find((item) => item?.slug === element.menu_slug);
  const horizontal = element.menu_layout === 'horizontal';
  const baseStyle = textStyle(element).replace(/^ style="/, '').replace(/"$/, '');
  const layout = horizontal
    ? 'display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:1rem;list-style:none;margin:0;padding:0;width:max-content;max-width:100%'
    : 'display:flex;flex-direction:column;gap:.5rem;list-style:none;margin:0;padding:0;width:max-content;max-width:100%';
  const style = [layout, baseStyle].filter(Boolean).join(';');
  const layoutStyle = style ? ' style="' + style + '"' : '';
  if (!menu) return '<p class="fpb-empty">' + escapeHtml(t('Select a menu from the active theme.')) + '</p>';
  if (!Array.isArray(menu.items) || menu.items.length === 0) {
    return '<p class="fpb-empty">' + escapeHtml(menu.name || t('Menu')) + ': ' + escapeHtml(t('No menu items.')) + '</p>';
  }
  return '<ul class="theme-menu fpb-menu-preview"' + layoutStyle + '>' + menuItemsHtml(menu.items) + '</ul>';
}

function leafHtml(element, selected, media, pages, menus, t) {
  const selectedClass = (element.id === selected ? ' is-selected' : '') + hiddenClass(element);
  let inner = '';
  if (element.type === 'heading') {
    const level = [1, 2, 3, 4, 5, 6].includes(Number(element.level)) ? Number(element.level) : 2;
    inner = '<h' + level + textStyle(element) + ' contenteditable="plaintext-only">' + editableText(element.text, false) + '</h' + level + '>';
  } else if (element.type === 'paragraph') {
    inner = '<p' + textStyle(element) + ' contenteditable="plaintext-only">' + editableText(element.text, true) + '</p>';
  } else if (element.type === 'image') {
    if (element.site_logo) {
      const logos = media.site_logo || {};
      const variant = element.site_logo_variant === 'dark' ? 'dark' : 'light';
      const url = logos[variant] || logos[variant === 'dark' ? 'light' : 'dark'] || '';
      const image = url ? '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(element.alt) + '">' : '';
      inner = image ? '<span class="' + photoClass(element) + '"' + photoVars(element) + '>' + image + '</span>' : '<p class="fpb-empty">' + escapeHtml(t('No logo is set in Theme Settings.')) + '</p>';
    } else {
      const url = media[element.media_id] || '';
      inner = url ? '<span class="' + photoClass(element) + '"' + photoVars(element) + '><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(element.alt) + '"></span>' : '<p class="fpb-empty">' + escapeHtml(t('Choose an image')) + '</p>';
    }
  } else if (element.type === 'button') {
    inner = '<a class="fpb-button" href="' + escapeHtml(buttonHref(element, pages)) + '"' + textStyle(element) + ' contenteditable="plaintext-only">' + editableText(element.text, false) + '</a>';
  } else if (element.type === 'list') {
    const tag = element.ordered ? 'ol' : 'ul';
    inner = '<' + tag + textStyle(element) + '>' + (element.items || []).map((item) => '<li contenteditable="plaintext-only">' + editableText(item, false) + '</li>').join('') + '</' + tag + '>';
  } else if (element.type === 'spacer') {
    inner = '<div class="fpb-spacer" style="height:' + Math.max(8, Math.min(160, Number(element.height) || 32)) + 'px"></div>';
  } else if (element.type === 'html') {
    inner = String(element.preview_html ?? element.html ?? '');
  } else if (element.type === 'shortcode') {
    const shortcode = String(element.shortcode || '');
    inner = '<div class="fpb-shortcode-preview" data-fpb-shortcode="' + escapeHtml(shortcode) + '">' + (shortcode ? escapeHtml(shortcode) : '<span class="fpb-muted">' + escapeHtml(t('Enter a shortcode')) + '</span>') + '</div>';
  } else if (element.type === 'menu') {
    inner = menuPreview(element, menus, t);
  } else {
    inner = '<hr>';
  }
  return '<div class="fpb-element' + selectedClass + motionClass(element) + '" data-fpb-id="' + escapeHtml(element.id) + '" data-fpb-type="' + element.type + '"' + wrapperStyle(element, media) + '>' + dragHandle(t) + inner + '</div>';
}

function importedGroupHtml(element, selected, media, pages, menus, t) {
  const children = (element.children || []).map((child) => {
    if (child.type === 'imported_group') return importedGroupHtml(child, selected, media, pages, menus, t);
    if (child.type === 'html') return nestedHtmlPreview(child.preview_html ?? child.html ?? '', child.id, 'html');
    return leafHtml(child, selected, media, pages, menus, t);
  });
  let index = 0;
  let html = String(element.html || '').replace(/<!--\s*fpb-slot\s*-->/g, () => children[index++] || '');
  if (index < children.length) {
    const extra = children.slice(index).join('');
    html = html.replace(/<\/([a-z][a-z0-9:-]*)\s*>\s*$/i, extra + '</$1>');
  }
  return nestedHtmlPreview(html, element.id, 'imported_group');
}

function sectionHtml(element, selected, media, pages, menus, t) {
  const selectedClass = (element.id === selected ? ' is-selected' : '') + hiddenClass(element) + motionClass(element);
  const wideClass = element.full_width ? ' fpb-section--full' : ' fpb-section--boxed';
  const children = element.children || [];
  const body = children.length
    ? children.map((child) => child.type === 'section' ? sectionHtml(child, selected, media, pages, menus, t) : child.type === 'columns' ? columnsHtml(child, selected, media, pages, menus, t) : leafHtml(child, selected, media, pages, menus, t)).join('')
    : '<p class="fpb-empty">' + escapeHtml(t('Drop an element into the section.')) + '</p>';
  return '<div class="fpb-section' + selectedClass + wideClass + '" data-fpb-id="' + escapeHtml(element.id) + '" data-fpb-type="section"' + wrapperStyle(element, media) + '>' + dragHandle(t) + wallpaperLayer(element, media) + overlayLayer(element) + particlesLayer(element) + '<div class="fpb-section-body">' + body + '</div></div>';
}

function columnsHtml(element, selected, media, pages, menus, t) {
  const selectedClass = (element.id === selected ? ' is-selected' : '') + hiddenClass(element) + motionClass(element);
  const cols = element.children || [];
  const cells = cols.map((column) => {
    const body = (column.children || []).length
      ? column.children.map((child) => leafHtml(child, selected, media, pages, menus, t)).join('')
      : '<p class="fpb-empty">' + escapeHtml(t('Drop an element here.')) + '</p>';
    const index = cols.indexOf(column);
    const resizeHandle = index < cols.length - 1
      ? '<button class="fpb-column-resize" type="button" data-fpb-columns-id="' + escapeHtml(element.id) + '" data-fpb-boundary="' + index + '" aria-label="' + escapeHtml(t('Resize columns')) + '" title="' + escapeHtml(t('Drag to resize columns')) + '"></button>'
      : '';
    return '<div class="fpb-column' + (column.id === selected ? ' is-selected' : '') + hiddenClass(column) + motionClass(column) + '" data-fpb-id="' + escapeHtml(column.id) + '" data-fpb-type="column"' + wrapperStyle(column, media) + '>' + dragHandle(t) + '<div class="fpb-column-body">' + body + '</div>' + resizeHandle + '</div>';
  }).join('');
  return '<div class="fpb-columns' + selectedClass + '" data-fpb-id="' + escapeHtml(element.id) + '" data-fpb-type="columns"' + wrapperStyle(element, media) + '>' + dragHandle(t) + cells + '</div>';
}

export function compile(elements, selected, media, defaults, pages, buttonStyles, menus = [], t = (source) => source) {
  const tree = applyDefaults(elements, defaults, buttonStyles);
  if (!tree.length) {
    return '<p class="fpb-empty">' + escapeHtml(t('Add a section or drop an element here.')) + '</p>';
  }
  return tree.map((element) => {
    if (element.type === 'imported_group') return importedGroupHtml(element, selected, media, pages, menus, t);
    if (element.type === 'section') return sectionHtml(element, selected, media, pages, menus, t);
    if (element.type === 'columns') return columnsHtml(element, selected, media, pages, menus, t);
    return leafHtml(element, selected, media, pages, menus, t);
  }).join('') + documentStyle(tree);
}
