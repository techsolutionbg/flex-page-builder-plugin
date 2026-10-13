export const PALETTE_GROUPS = [
  {id: 'layout', label: 'Структура', items: [
    {type: 'section', label: 'Секция'},
    {type: 'columns', label: 'Колони'},
  ]},
  {id: 'content', label: 'Съдържание', items: [
    {type: 'heading', label: 'Заглавие'},
    {type: 'paragraph', label: 'Параграф'},
    {type: 'list', label: 'Списък'},
    {type: 'image', label: 'Изображение'},
    {type: 'button', label: 'Бутон'},
  ]},
  {id: 'spacing', label: 'Оформление', items: [
    {type: 'divider', label: 'Разделител'},
    {type: 'spacer', label: 'Отстъп'},
  ]},
  {id: 'advanced', label: 'Други', items: [
    {type: 'html', label: 'HTML'},
  ]},
];

export const PALETTE = PALETTE_GROUPS.flatMap((group) => group.items);

export const STYLE_KEYS = [
  'size', 'line_height', 'weight', 'align', 'level', 'height', 'full_width', 'hidden',
  'background', 'gradient', 'gradient_from', 'gradient_to', 'gradient_angle',
  'wallpaper_id', 'wallpaper_fit', 'wallpaper_position', 'wallpaper_preset', 'overlay_color', 'overlay_opacity', 'image_filter', 'image_tint', 'image_tint_opacity',
  'particles', 'particles_color', 'particles_density', 'particles_speed',
  'shadow_color', 'shadow_x', 'shadow_y', 'shadow_blur', 'stroke_width', 'stroke_color',
  'letter_spacing', 'text_transform', 'italic',
  'hover_background', 'hover_color', 'hover_border_color',
  'animation', 'animation_duration', 'animation_delay', 'hover_animation',
  'color', 'border_width', 'border_color', 'radius', 'padding',
  'padding_top', 'padding_right', 'padding_bottom', 'padding_left',
  'margin_top', 'margin_right', 'margin_bottom', 'margin_left',
];

export const ENTRANCE_ANIMATIONS = [
  {id: 'fade', label: 'Избледняване'},
  {id: 'fade-up', label: 'От долу'},
  {id: 'fade-down', label: 'От горе'},
  {id: 'fade-left', label: 'От дясно'},
  {id: 'fade-right', label: 'От ляво'},
  {id: 'zoom-in', label: 'Увеличаване'},
];

export const HOVER_ANIMATIONS = [
  {id: 'lift', label: 'Повдигане'},
  {id: 'grow', label: 'Увеличаване'},
  {id: 'dim', label: 'Затъмняване'},
];

export const BREAKPOINTS = ['tablet', 'phone'];

export const PATTERNS = [
  {id: 'diagonal', label: 'Диагонал'},
  {id: 'zigzag', label: 'Зигзаг'},
  {id: 'arrows', label: 'Стрелки'},
  {id: 'checker', label: 'Шах'},
  {id: 'bricks', label: 'Тухли'},
  {id: 'bars', label: 'Ленти'},
  {id: 'waves', label: 'Вълни'},
  {id: 'hexagons', label: 'Шестоъгълници'},
  {id: 'diamonds', label: 'Ромбове'},
  {id: 'dots', label: 'Точки'},
  {id: 'links', label: 'Връзки'},
  {id: 'zebra', label: 'Зебра'},
];

export const PARTICLES = [
  {id: 'dots', label: 'Плаващи точки'},
  {id: 'links', label: 'Мрежа'},
  {id: 'bubbles', label: 'Мехурчета'},
  {id: 'snow', label: 'Сняг'},
  {id: 'stars', label: 'Звезди'},
];

export const GRADIENTS = [
  {id: 'dusk', label: 'Здрач', css: 'linear-gradient(180deg,#1e1b4b,#7c3aed)'},
  {id: 'sunset', label: 'Залез', css: 'linear-gradient(135deg,#fb923c,#e11d48)'},
  {id: 'ocean', label: 'Океан', css: 'linear-gradient(160deg,#0ea5e9,#0369a1)'},
  {id: 'forest', label: 'Гора', css: 'linear-gradient(160deg,#166534,#052e16)'},
  {id: 'sand', label: 'Пясък', css: 'linear-gradient(180deg,#fef3c7,#f59e0b)'},
  {id: 'mist', label: 'Мъгла', css: 'linear-gradient(180deg,#f8fafc,#94a3b8)'},
  {id: 'night', label: 'Нощ', css: 'linear-gradient(180deg,#0f172a,#334155)'},
  {id: 'rose', label: 'Роза', css: 'linear-gradient(135deg,#fda4af,#be123c)'},
];

export function buttonStyleId() {
  return 'bs_' + Math.random().toString(36).slice(2, 10);
}

export function chromeId() {
  let hex = '';
  while (hex.length < 8) hex += Math.random().toString(16).slice(2);
  return 'ch_' + hex.slice(0, 8);
}

/** Layers that fill missing style keys: named button design, then type defaults. */
export function styleLayers(element, defaults, buttonStyles) {
  const layers = [];
  if (!element) return layers;
  if (element.type === 'button' && element.button_style_id) {
    const style = (buttonStyles || []).find((item) => item && item.id === element.button_style_id);
    if (style) layers.push(style);
  }
  if (defaults && defaults[element.type]) layers.push(defaults[element.type]);
  return layers;
}

/** Values inherited from design/defaults for keys the element does not set locally. */
export function inheritedStyle(element, defaults, buttonStyles) {
  const layers = styleLayers(element, defaults, buttonStyles);
  const out = {};
  if (!element || !layers.length) return out;
  STYLE_KEYS.forEach((key) => {
    if (element[key] != null) return;
    for (const layer of layers) {
      if (layer[key] != null) {
        out[key] = layer[key];
        break;
      }
    }
  });
  return out;
}

export function hasStyleSource(element, key, defaults, buttonStyles) {
  if (!element || !key) return false;
  return styleLayers(element, defaults, buttonStyles).some((layer) => layer[key] != null);
}

export function applyDefaults(elements, defaults, buttonStyles) {
  return (elements || []).map((element) => {
    const layers = styleLayers(element, defaults, buttonStyles);
    const next = {...element};
    STYLE_KEYS.forEach((key) => {
      if (next[key] != null) return;
      for (const layer of layers) {
        if (layer[key] != null) {
          next[key] = layer[key];
          break;
        }
      }
    });
    BREAKPOINTS.forEach((device) => {
      const own = next[device] && typeof next[device] === 'object' ? {...next[device]} : {};
      layers.forEach((layer) => {
        const from = layer[device] && typeof layer[device] === 'object' ? layer[device] : {};
        Object.keys(from).forEach((key) => {
          if (own[key] == null && from[key] != null) own[key] = from[key];
        });
      });
      if (Object.keys(own).length) next[device] = own;
    });
    if (next.children) next.children = applyDefaults(next.children, defaults, buttonStyles);
    return next;
  });
}

export const WIDTHS = [
  {id: 'desktop', label: 'Бюро', width: '100%'},
  {id: 'tablet', label: 'Таблет', width: '768px'},
  {id: 'phone', label: 'Телефон', width: '390px'},
];

export function deviceView(element, device) {
  if (!element || device === 'desktop' || !element[device]) return element;
  return {...element, ...element[device]};
}

export function deviceHas(element, device, key) {
  return device !== 'desktop' && element?.[device] != null && element[device][key] != null;
}

export function devicePatch(element, device, patch) {
  if (device === 'desktop') return {...element, ...patch};
  const current = {...(element[device] || {})};
  Object.entries(patch).forEach(([key, value]) => {
    if (value == null) delete current[key];
    else current[key] = value;
  });
  return {...element, [device]: Object.keys(current).length ? current : null};
}

export function elementId() {
  return 'e' + Math.random().toString(36).slice(2, 10);
}

export function isContainer(type) {
  return type === 'section' || type === 'columns' || type === 'column';
}

export function emptyColumns(count) {
  return Array.from({length: count}, () => ({id: elementId(), type: 'column', children: []}));
}

export function resizeColumns(element, count) {
  const size = Math.max(1, Math.min(6, Number(count) || 2));
  const cols = (element.children || []).filter((child) => child.type === 'column');
  if (cols.length < size) {
    return {...element, columns: size, children: cols.concat(emptyColumns(size - cols.length))};
  }
  if (cols.length > size) {
    const keep = cols.slice(0, size).map((col, index) => index === size - 1
      ? {...col, children: (col.children || []).concat(...cols.slice(size).map((extra) => extra.children || []))}
      : col);
    return {...element, columns: size, children: keep};
  }
  return {...element, columns: size, children: cols};
}

export function blank(type) {
  const id = elementId();
  if (type === 'section') return {id, type, children: []};
  if (type === 'columns') return {id, type, columns: 2, children: emptyColumns(2)};
  if (type === 'heading') return {id, type, text: 'Заглавие'};
  if (type === 'paragraph') return {id, type, text: 'Текст на параграфа'};
  if (type === 'image') return {id, type, media_id: null, alt: ''};
  if (type === 'button') return {id, type, text: 'Научете повече', link_type: 'url', page_id: null, url: '/'};
  if (type === 'list') return {id, type, ordered: false, items: ['Първи ред', 'Втори ред']};
  if (type === 'spacer') return {id, type};
  if (type === 'html') return {id, type, html: '<p>HTML</p>'};
  return {id, type: 'divider'};
}

export function elementLabel(element, index) {
  const custom = String(element.name || '').replace(/\s+/g, ' ').trim();
  if (custom) return custom.slice(0, 60);
  if (element.type === 'column') return 'Колона ' + ((index || 0) + 1);
  if (element.type === 'columns') return 'Колони: ' + (element.children || []).length;
  if (element.type === 'section' && element.full_width) return 'Секция: цяла ширина';
  const name = PALETTE.find((item) => item.type === element.type)?.label || 'Елемент';
  const text = element.type === 'heading' || element.type === 'paragraph' || element.type === 'button' ? String(element.text || '').replace(/\s+/g, ' ').trim() : '';
  return text ? name + ': ' + text.slice(0, 42) : name;
}

export function crumbName(element, trail) {
  const custom = String(element.name || '').replace(/\s+/g, ' ').trim();
  if (custom) return custom.slice(0, 40);
  if (element.type === 'column') {
    const parent = trail[trail.indexOf(element) - 1];
    const index = (parent?.children || []).findIndex((child) => child.id === element.id);
    return 'Колона ' + (index < 0 ? 1 : index + 1);
  }
  if (element.type === 'columns') return 'Колони';
  return PALETTE.find((item) => item.type === element.type)?.label || 'Елемент';
}

export function panelOpen(key) {
  try {
    return localStorage.getItem('fpb-panel-' + key) !== '0';
  } catch {
    return true;
  }
}

export function rememberPanel(key, open) {
  try {
    localStorage.setItem('fpb-panel-' + key, open ? '1' : '0');
  } catch {
    return;
  }
}

export function findElement(elements, id) {
  for (const element of elements) {
    if (element.id === id) return element;
    if (isContainer(element.type)) {
      const child = findElement(element.children || [], id);
      if (child) return child;
    }
  }
  return null;
}

export function elementPath(elements, id, trail) {
  const walk = trail || [];
  for (const element of elements) {
    const next = walk.concat(element);
    if (element.id === id) return next;
    if (isContainer(element.type)) {
      const found = elementPath(element.children || [], id, next);
      if (found.length) return found;
    }
  }
  return [];
}

export function locate(elements, id, parentId) {
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (element.id === id) return {parentId: parentId || null, index, list: elements};
    if (isContainer(element.type)) {
      const nested = locate(element.children || [], id, element.id);
      if (nested) return nested;
    }
  }
  return null;
}

export function replaceElement(elements, next) {
  return elements.map((element) => {
    if (element.id === next.id) return next;
    if (isContainer(element.type)) return {...element, children: replaceElement(element.children || [], next)};
    return element;
  });
}

export function patchElement(elements, id, patch) {
  return elements.map((element) => {
    if (element.id === id) return {...element, ...patch};
    if (isContainer(element.type)) return {...element, children: patchElement(element.children || [], id, patch)};
    return element;
  });
}

export function removeElement(elements, id) {
  return elements.filter((element) => element.id !== id).map((element) => (
    isContainer(element.type) ? {...element, children: removeElement(element.children || [], id)} : element
  ));
}

export function sectionHolder(elements, parentId) {
  if (!parentId) return null;
  const holder = findElement(elements, parentId);
  if (holder?.type === 'section') return parentId;
  return elementPath(elements, parentId).reverse().find((item) => item.type === 'section')?.id || null;
}

export function insertInto(elements, node, parentId, index) {
  let parent = parentId || null;
  if (node.type === 'section') parent = sectionHolder(elements, parent);
  if (node.type === 'columns' && parent) {
    const holder = findElement(elements, parent);
    if (holder?.type !== 'section') parent = elementPath(elements, parent).find((item) => item.type === 'section')?.id || null;
  }
  if (node.type !== 'section' && node.type !== 'columns' && parent) {
    const holder = findElement(elements, parent);
    if (holder?.type === 'columns') parent = (holder.children[0] || {}).id || null;
  }
  if (!parent) {
    const next = elements.slice();
    next.splice(Math.max(0, Math.min(index, next.length)), 0, node);
    return next;
  }
  let found = false;
  const walk = (list) => list.map((element) => {
    if (element.id === parent && (element.type === 'section' || element.type === 'column')) {
      found = true;
      const children = (element.children || []).slice();
      children.splice(Math.max(0, Math.min(index, children.length)), 0, node);
      return {...element, children};
    }
    return isContainer(element.type) ? {...element, children: walk(element.children || [])} : element;
  });
  const next = walk(elements);
  if (found) return next;
  const fallback = elements.slice();
  fallback.splice(Math.max(0, Math.min(index, fallback.length)), 0, node);
  return fallback;
}

export function place(elements, id, parentId, index) {
  const located = locate(elements, id);
  if (!located) return elements;
  const moving = located.list[located.index];
  let targetParent = parentId || null;
  if (moving.type === 'section') {
    targetParent = sectionHolder(elements, targetParent);
    if (targetParent === id || elementPath(elements, targetParent).some((item) => item.id === id)) return elements;
  }
  if (moving.type === 'column') targetParent = located.parentId;
  if (moving.type === 'columns' && targetParent) {
    const holder = findElement(elements, targetParent);
    if (holder?.type !== 'section') targetParent = located.parentId;
  }
  if (moving.type !== 'section' && moving.type !== 'columns' && moving.type !== 'column' && targetParent) {
    const holder = findElement(elements, targetParent);
    if (holder?.type === 'columns') targetParent = (holder.children[0] || {}).id || null;
  }
  if (targetParent && !findElement(elements, targetParent)) return elements;
  const same = (located.parentId || null) === targetParent;
  let to = index;
  if (same && to > located.index) to -= 1;
  const max = same ? located.list.length - 1 : (targetParent ? (findElement(elements, targetParent).children || []).length : elements.length);
  to = Math.max(0, Math.min(to, max));
  if (same && to === located.index) return elements;
  return insertInto(removeElement(elements, id), moving, targetParent, to);
}

export function eachElement(elements, visit) {
  elements.forEach((element) => {
    visit(element);
    if (isContainer(element.type)) eachElement(element.children || [], visit);
  });
}

export function structureDrop(elements, movingId, targetId, where) {
  if (!movingId || !targetId || movingId === targetId) return null;
  const moving = findElement(elements, movingId);
  const target = findElement(elements, targetId);
  if (!moving || !target || elementPath(elements, targetId).some((item) => item.id === movingId)) return null;
  const targetAt = locate(elements, targetId);
  if (!targetAt) return null;
  if (moving.type === 'section') {
    if (where === 'inside') return target.type === 'section' ? {parentId: target.id, index: (target.children || []).length} : null;
    const parent = targetAt.parentId ? findElement(elements, targetAt.parentId) : null;
    if (parent && parent.type !== 'section') return null;
    return {parentId: targetAt.parentId, index: targetAt.index + (where === 'after' ? 1 : 0)};
  }
  if (moving.type === 'column') {
    const from = locate(elements, movingId);
    if (where === 'inside' || target.type !== 'column' || !from || from.parentId !== targetAt.parentId) return null;
    return {parentId: targetAt.parentId, index: targetAt.index + (where === 'after' ? 1 : 0)};
  }
  if (moving.type === 'columns') {
    if (where === 'inside') return target.type === 'section' ? {parentId: target.id, index: (target.children || []).length} : null;
    const parent = targetAt.parentId ? findElement(elements, targetAt.parentId) : null;
    if (parent && parent.type !== 'section') return null;
    return {parentId: targetAt.parentId, index: targetAt.index + (where === 'after' ? 1 : 0)};
  }
  if (where === 'inside') {
    if (target.type === 'section' || target.type === 'column') return {parentId: target.id, index: (target.children || []).length};
    if (target.type === 'columns' && target.children?.[0]) return {parentId: target.children[0].id, index: (target.children[0].children || []).length};
    return null;
  }
  const parent = targetAt.parentId ? findElement(elements, targetAt.parentId) : null;
  if (parent && parent.type !== 'section' && parent.type !== 'column') return null;
  return {parentId: targetAt.parentId, index: targetAt.index + (where === 'after' ? 1 : 0)};
}
