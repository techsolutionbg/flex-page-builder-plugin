import {applyDefaults, GRADIENTS} from './model.js';

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
  return 'url("' + String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
}

function wallpaperUrl(element, media) {
  const id = element?.wallpaper_id;
  if (!id || !media) return null;
  const url = media[id];
  if (!url || /^(javascript|data):/i.test(String(url).trim())) return null;
  return url;
}

function boxCss(element, media) {
  const parts = [];
  const wallpaper = wallpaperUrl(element, media);
  const gradient = gradientCss(element);
  const background = colorValue(element.background);
  const text = colorValue(element.color);
  const width = pxValue(element.border_width, 20);
  const border = colorValue(element.border_color);
  const radius = pxValue(element.radius, 80);
  const padding = pxValue(element.padding, 80);
  if (wallpaper) {
    if (background) parts.push('background-color:' + background);
    parts.push('background-image:' + cssUrl(wallpaper));
    parts.push('background-size:' + (element.wallpaper_fit === 'contain' ? 'contain' : 'cover'));
    parts.push('background-position:center');
    parts.push('background-repeat:no-repeat');
  } else if (gradient) parts.push('background:' + gradient);
  else if (background) parts.push('background:' + background);
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
  if (size !== null) parts.push('font-size:' + size + 'px');
  if (height !== null) parts.push('line-height:' + height);
  if (weight !== null) parts.push('font-weight:' + weight);
  if (element.type === 'button') {
    const box = boxCss(element);
    if (box) parts.push(box);
  }
  return parts.length ? ' style="' + parts.join(';') + '"' : '';
}

function wrapperStyle(element, media) {
  const parts = [];
  if (element.align === 'center' || element.align === 'right') parts.push('text-align:' + element.align);
  if (element.type !== 'button') {
    const box = boxCss(element, media);
    if (box) parts.push(box);
  }
  if (element.type === 'columns') {
    const count = Math.max(1, Math.min(6, (element.children || []).length || Number(element.columns) || 2));
    parts.push('grid-template-columns:repeat(' + count + ',minmax(0,1fr))');
  }
  return parts.length ? ' style="' + parts.join(';') + '"' : '';
}

function editableText(text, multiline) {
  if (!String(text || '').length) return '<br>';
  const escaped = escapeHtml(text);
  return multiline ? escaped.replace(/\n/g, '<br>') : escaped;
}

function dragHandle() {
  return '<button type="button" class="fpb-drag" draggable="true" aria-label="Премести"></button>';
}

function leafHtml(element, selected, media) {
  const selectedClass = element.id === selected ? ' is-selected' : '';
  let inner = '';
  if (element.type === 'heading') {
    const level = [1, 2, 3, 4, 5, 6].includes(Number(element.level)) ? Number(element.level) : 2;
    inner = '<h' + level + textStyle(element) + ' contenteditable="plaintext-only">' + editableText(element.text, false) + '</h' + level + '>';
  } else if (element.type === 'paragraph') {
    inner = '<p' + textStyle(element) + ' contenteditable="plaintext-only">' + editableText(element.text, true) + '</p>';
  } else if (element.type === 'image') {
    const url = media[element.media_id] || '';
    inner = url ? '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(element.alt) + '">' : '<p class="fpb-empty">Изберете изображение</p>';
  } else if (element.type === 'button') {
    inner = '<a class="fpb-button" href="' + escapeHtml(element.url || '#') + '"' + textStyle(element) + ' contenteditable="plaintext-only">' + editableText(element.text, false) + '</a>';
  } else if (element.type === 'list') {
    const tag = element.ordered ? 'ol' : 'ul';
    inner = '<' + tag + textStyle(element) + '>' + (element.items || []).map((item) => '<li contenteditable="plaintext-only">' + editableText(item, false) + '</li>').join('') + '</' + tag + '>';
  } else if (element.type === 'spacer') {
    inner = '<div class="fpb-spacer" style="height:' + Math.max(8, Math.min(160, Number(element.height) || 32)) + 'px"></div>';
  } else if (element.type === 'html') {
    inner = String(element.html || '');
  } else {
    inner = '<hr>';
  }
  return '<div class="fpb-element' + selectedClass + '" data-fpb-id="' + escapeHtml(element.id) + '" data-fpb-type="' + element.type + '"' + wrapperStyle(element, media) + '>' + dragHandle() + inner + '</div>';
}

function sectionHtml(element, selected, media) {
  const selectedClass = element.id === selected ? ' is-selected' : '';
  const wideClass = element.full_width ? ' fpb-section--full' : '';
  const children = element.children || [];
  const body = children.length
    ? children.map((child) => child.type === 'columns' ? columnsHtml(child, selected, media) : leafHtml(child, selected, media)).join('')
    : '<p class="fpb-empty">Пуснете елемент в секцията</p>';
  return '<div class="fpb-section' + selectedClass + wideClass + '" data-fpb-id="' + escapeHtml(element.id) + '" data-fpb-type="section"' + wrapperStyle(element, media) + '>' + dragHandle() + '<div class="fpb-section-body">' + body + '</div></div>';
}

function columnsHtml(element, selected, media) {
  const selectedClass = element.id === selected ? ' is-selected' : '';
  const cols = element.children || [];
  const cells = cols.map((column) => {
    const body = (column.children || []).length
      ? column.children.map((child) => leafHtml(child, selected, media)).join('')
      : '<p class="fpb-empty">Пуснете елемент</p>';
    return '<div class="fpb-column' + (column.id === selected ? ' is-selected' : '') + '" data-fpb-id="' + escapeHtml(column.id) + '" data-fpb-type="column"' + wrapperStyle(column, media) + '>' + dragHandle() + '<div class="fpb-column-body">' + body + '</div></div>';
  }).join('');
  return '<div class="fpb-columns' + selectedClass + '" data-fpb-id="' + escapeHtml(element.id) + '" data-fpb-type="columns"' + wrapperStyle(element, media) + '>' + dragHandle() + cells + '</div>';
}

export function compile(elements, selected, media, defaults) {
  const tree = applyDefaults(elements, defaults);
  if (!tree.length) {
    return '<p class="fpb-empty">Добавете секция или пуснете елемент тук.</p>';
  }
  return tree.map((element) => {
    if (element.type === 'section') return sectionHtml(element, selected, media);
    if (element.type === 'columns') return columnsHtml(element, selected, media);
    return leafHtml(element, selected, media);
  }).join('');
}
