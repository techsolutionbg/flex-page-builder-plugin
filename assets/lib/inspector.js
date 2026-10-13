import {colorValue, gradientCss} from './compile.js';
import {deviceHas, devicePatch, deviceView, elementLabel, ENTRANCE_ANIMATIONS, GRADIENTS, hasStyleSource, HOVER_ANIMATIONS, inheritedStyle, PARTICLES, PATTERNS, resizeColumns, WIDTHS} from './model.js';

export function createInspector(host) {
  const {React} = host;
  const C = host.components;
  const h = React.createElement;

  return function Inspector({element, onChange, onRemove, onMove, onAddColumns, onPreviewAnimation, mode, device = 'desktop', onDevice, pages = [], buttonStyles = [], defaults: typeDefaults = {}}) {
    const [collapsed, setCollapsed] = React.useState(() => {
      try {
        const stored = JSON.parse(sessionStorage.getItem('fpb-inspector-collapsed') || '{}');
        return stored && typeof stored === 'object' ? stored : {};
      } catch {
        return {};
      }
    });
    const toggleSection = (title) => {
      setCollapsed((current) => {
        const next = {...current, [title]: !current[title]};
        sessionStorage.setItem('fpb-inspector-collapsed', JSON.stringify(next));
        return next;
      });
    };
    const isDefaults = mode === 'defaults';
    if (!element) {
      return h('p', {className: 'fpb-muted'}, isDefaults
        ? 'Изберете тип елемент, за да зададете вид по подразбиране за всички страници.'
        : 'Изберете елемент от платното, за да промените текста, изображението или връзката му.');
    }
    const view = deviceView(element, device);
    const desktop = device === 'desktop';
    const inherited = isDefaults ? {} : inheritedStyle(element, typeDefaults, buttonStyles);
    const fromDesign = !isDefaults && element.type === 'button' && !!element.button_style_id;
    const inheritLabel = !desktop ? 'От бюро' : (fromDesign ? 'От дизайна' : 'По подразбиране');
    const set = (patch) => onChange({...element, ...patch});
    const setStyle = (patch) => onChange(devicePatch(element, device, patch));
    const isOverridden = (key) => {
      if (!key) return false;
      if (deviceHas(element, device, key)) return true;
      if (!desktop || isDefaults) return false;
      return view[key] != null && hasStyleSource(element, key, typeDefaults, buttonStyles);
    };
    const placeholderFor = (key, fallback) => {
      if (view[key] != null) return fallback || inheritLabel;
      if (inherited[key] != null) return String(inherited[key]);
      return fallback || inheritLabel;
    };
    const displayValue = (key) => (view[key] != null ? view[key] : inherited[key]);
    const field = (label, child, key) => {
      const over = key && isOverridden(key);
      return h('label', {className: 'fpb-field' + (over ? ' is-override' : '')},
        h('span', null, label, over ? h('button', {type: 'button', className: 'fpb-inherit', onClick: (event) => { event.preventDefault(); setStyle({[key]: null}); }}, 'Наследи') : null),
        child);
    };
    const sizeField = field('Размер на текста (px)', h(C.Input, {type: 'number', min: 8, max: 160, value: view.size == null ? '' : String(view.size), placeholder: placeholderFor('size'), onChange: (event) => setStyle({size: event.target.value === '' ? null : Number(event.target.value)})}), 'size');
    const lineField = field('Междуредие', h(C.Input, {type: 'number', min: 0.8, max: 3, step: 0.1, value: view.line_height == null ? '' : String(view.line_height), placeholder: placeholderFor('line_height'), onChange: (event) => setStyle({line_height: event.target.value === '' ? null : Number(event.target.value)})}), 'line_height');
    const weightField = field('Дебелина', h('select', {value: view.weight == null ? '' : String(view.weight), onChange: (event) => setStyle({weight: event.target.value === '' ? null : Number(event.target.value)})},
      [h('option', {value: ''}, inherited.weight != null ? inheritLabel + ' (' + inherited.weight + ')' : inheritLabel), ...[300, 400, 500, 600, 700, 800].map((weight) => h('option', {key: weight, value: String(weight)}, String(weight)))]), 'weight');
    const alignEffective = displayValue('align');
    const align = alignEffective === 'center' || alignEffective === 'right' ? alignEffective : 'left';
    const alignField = h('div', {className: 'fpb-align' + (isOverridden('align') ? ' is-override' : ''), role: 'group', 'aria-label': 'Подравняване'},
      [['left', 'Ляво', 'M4 6h16M4 12h10M4 18h16'], ['center', 'Център', 'M4 6h16M7 12h10M4 18h16'], ['right', 'Дясно', 'M4 6h16M10 12h10M4 18h16']].map(([value, label, path]) => h('button', {
        key: value,
        type: 'button',
        className: align === value ? 'is-active' : '',
        'aria-label': label,
        'aria-pressed': align === value,
        onClick: () => setStyle({align: desktop ? (value === 'left' ? null : value) : value}),
      }, h('svg', {viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true'}, h('path', {d: path, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round'})))),
      isOverridden('align') ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({align: null})}, 'Наследи') : null);
    const content = [];
    const typography = [];
    if (element.type === 'heading') {
      if (desktop) content.push(field('Ниво', h('select', {value: element.level == null ? '' : String(element.level), onChange: (event) => set({level: event.target.value === '' ? null : Number(event.target.value)})},
        [h('option', {value: ''}, 'По подразбиране'), ...[1, 2, 3, 4, 5, 6].map((level) => h('option', {key: level, value: String(level)}, 'H' + level))])));
      if (!isDefaults) content.push(field('Текст', h(C.Input, {value: element.text || '', onChange: (event) => set({text: event.target.value})})));
      typography.push(sizeField, lineField, weightField, alignField);
    } else if (element.type === 'paragraph' || element.type === 'html') {
      const key = element.type === 'html' ? 'html' : 'text';
      if (!isDefaults) content.push(field(element.type === 'html' ? 'HTML' : 'Текст', h(C.Textarea, {rows: 5, value: element[key] || '', onChange: (event) => set({[key]: event.target.value})})));
      if (element.type === 'paragraph') typography.push(sizeField, lineField, weightField, alignField);
    } else if (element.type === 'image') {
      if (!isDefaults) {
        content.push(h(C.ImageField, {key: 'image', label: 'Изображение', value: element.media_id || null, onChange: (id) => set({media_id: id})}));
        content.push(field('Алтернативен текст', h(C.Input, {value: element.alt || '', onChange: (event) => set({alt: event.target.value})})));
      }
      content.push(h('div', {className: 'fpb-columns-pick' + (deviceHas(element, device, 'image_filter') ? ' is-override' : ''), key: 'image_filter', role: 'group', 'aria-label': 'Цвят на изображението'},
        [['color', 'Цветна'], ['grayscale', 'Черно-бяла']].map(([value, label]) => h('button', {
          key: value,
          type: 'button',
          className: (view.image_filter || 'color') === value ? 'is-active' : '',
          'aria-pressed': (view.image_filter || 'color') === value,
          onClick: () => setStyle({image_filter: desktop ? (value === 'color' ? null : value) : value}),
        }, label)),
        deviceHas(element, device, 'image_filter') ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({image_filter: null})}, 'Наследи') : null));
      const tintOver = deviceHas(element, device, 'image_tint') || deviceHas(element, device, 'image_tint_opacity');
      content.push(h('div', {className: 'fpb-color' + (tintOver ? ' is-override' : ''), key: 'image_tint'},
        h('span', null, 'Цветен филтър', tintOver ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({image_tint: null, image_tint_opacity: null})}, 'Наследи') : null),
        h('input', {
          type: 'color',
          value: colorValue(view.image_tint) || '#7c3aed',
          'aria-label': 'Цветен филтър',
          onChange: (event) => setStyle({
            image_tint: event.target.value,
            image_tint_opacity: view.image_tint_opacity == null ? 40 : view.image_tint_opacity,
          }),
        }),
        colorValue(view.image_tint) ? h('button', {type: 'button', onClick: () => setStyle({image_tint: null, image_tint_opacity: null})}, desktop ? 'Без' : 'Наследи') : null));
      if (view.image_tint) {
        content.push(field('Плътност на филтъра (%)', h(C.Input, {
          type: 'number',
          min: 0,
          max: 100,
          value: view.image_tint_opacity == null ? '' : String(view.image_tint_opacity),
          placeholder: desktop ? '40' : inheritLabel,
          onChange: (event) => setStyle({image_tint_opacity: event.target.value === '' ? null : Number(event.target.value)}),
        }), 'image_tint_opacity'));
      }
    } else if (element.type === 'button') {
      if (!isDefaults) {
        const linkType = element.link_type === 'page' ? 'page' : 'url';
        content.push(field('Текст', h(C.Input, {value: element.text || '', onChange: (event) => set({text: event.target.value})})));
        if (buttonStyles.length) {
          content.push(field('Дизайн', h('select', {
            value: element.button_style_id || '',
            onChange: (event) => set({button_style_id: event.target.value === '' ? null : event.target.value}),
          }, [
            h('option', {key: '', value: ''}, 'Без / Собствен'),
            ...buttonStyles.map((style) => h('option', {key: style.id, value: style.id}, style.name || 'Дизайн')),
          ])));
        }
        content.push(h('div', {className: 'fpb-columns-pick', key: 'link_type', role: 'group', 'aria-label': 'Тип на връзката'},
          [['page', 'Страница'], ['url', 'Собствен линк']].map(([value, label]) => h('button', {
            key: value,
            type: 'button',
            className: linkType === value ? 'is-active' : '',
            'aria-pressed': linkType === value,
            onClick: () => set(value === 'page'
              ? {link_type: 'page', url: '#', page_id: element.page_id || null}
              : {link_type: 'url', page_id: null, url: element.url && element.url !== '#' ? element.url : '/'}),
          }, label))));
        if (linkType === 'page') {
          content.push(field('Страница', h('select', {
            value: element.page_id ? String(element.page_id) : '',
            onChange: (event) => set({page_id: event.target.value === '' ? null : Number(event.target.value), link_type: 'page'}),
          },
            [h('option', {key: '', value: ''}, 'Избери страница'),
              ...pages.map((page) => h('option', {key: page.id, value: String(page.id)}, page.title + (page.path ? ' (' + page.path + ')' : '')))])));
        } else {
          content.push(field('Адрес', h(C.Input, {
            value: element.url || '',
            placeholder: '/kontakt или https://…',
            onChange: (event) => set({url: event.target.value, link_type: 'url', page_id: null}),
          })));
        }
      }
      typography.push(sizeField, lineField, weightField, alignField);
    } else if (element.type === 'list') {
      if (!isDefaults) {
        content.push(h(C.CheckboxField, {key: 'ordered', checked: element.ordered === true, label: 'Номериран', onChange: (event) => set({ordered: event.target.checked})}));
        content.push(field('Редове, по един на ред', h(C.Textarea, {rows: 4, value: (element.items || []).join('\n'), onChange: (event) => set({items: event.target.value.split('\n')})})));
      }
      typography.push(sizeField, lineField, weightField, alignField);
    } else if (element.type === 'spacer') {
      content.push(field('Височина (px)', h(C.Input, {type: 'number', min: 8, max: 160, value: view.height == null ? '' : String(view.height), placeholder: isDefaults ? inheritLabel : (desktop ? '32' : inheritLabel), onChange: (event) => setStyle({height: event.target.value === '' ? null : Number(event.target.value)})}), 'height'));
    } else if (element.type === 'section') {
      const hidden = view.hidden === true;
      content.push(h('div', {className: 'fpb-columns-pick' + (deviceHas(element, device, 'hidden') ? ' is-override' : ''), key: 'hidden', role: 'group', 'aria-label': 'Видимост'},
        [['show', 'Покажи'], ['hide', 'Скрий']].map(([value, label]) => h('button', {
          key: value,
          type: 'button',
          className: (hidden ? 'hide' : 'show') === value ? 'is-active' : '',
          'aria-pressed': (hidden ? 'hide' : 'show') === value,
          onClick: () => {
            if (desktop) {
              setStyle({hidden: value === 'hide' ? true : null});
              return;
            }
            if (value === 'hide') setStyle({hidden: element.hidden === true ? null : true});
            else setStyle({hidden: element.hidden === true ? false : null});
          },
        }, label)),
        deviceHas(element, device, 'hidden') ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({hidden: null})}, 'Наследи') : null));
      if (hidden && !isDefaults) {
        content.push(h('p', {key: 'hidden-note', className: 'fpb-muted'}, 'Секцията остава видима тук, но не се показва на сайта.'));
      }
      content.push(h(C.CheckboxField, {
        key: 'full_width',
        checked: view.full_width === true,
        label: 'Цяла ширина на страницата',
        onChange: (event) => {
          if (desktop) {
            setStyle({full_width: isDefaults ? (event.target.checked ? true : null) : event.target.checked});
            return;
          }
          setStyle({full_width: event.target.checked ? (element.full_width === true ? null : true) : (element.full_width === true ? false : null)});
        },
      }));
      if (!isDefaults && desktop) content.push(field('Добави колони', h('div', {className: 'fpb-columns-pick', role: 'group', 'aria-label': 'Добави колони'},
        [1, 2, 3, 4, 5, 6].map((value) => h('button', {key: value, type: 'button', onClick: () => onAddColumns?.(value)}, String(value))))));
    } else if (element.type === 'columns' && !isDefaults) {
      const count = (element.children || []).length || element.columns || 2;
      const active = desktop ? count : (Number(view.columns) || count);
      content.push(h('div', {className: 'fpb-columns-pick' + (deviceHas(element, device, 'columns') ? ' is-override' : ''), key: 'columns', role: 'group', 'aria-label': 'Брой колони'},
        [1, 2, 3, 4, 5, 6].map((value) => h('button', {
          key: value,
          type: 'button',
          className: active === value ? 'is-active' : '',
          'aria-pressed': active === value,
          onClick: () => desktop ? onChange(resizeColumns(element, value)) : setStyle({columns: value}),
        }, String(value))),
        deviceHas(element, device, 'columns') ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({columns: null})}, 'Наследи') : null));
    }
    if (typography.length) {
      const transform = view.text_transform === 'uppercase' || view.text_transform === 'lowercase' || view.text_transform === 'capitalize' ? view.text_transform : 'none';
      typography.push(
        h(C.CheckboxField, {
          key: 'italic',
          checked: view.italic === true,
          label: 'Курсив',
          onChange: (event) => {
            if (desktop) {
              setStyle({italic: event.target.checked ? true : null});
              return;
            }
            if (event.target.checked) setStyle({italic: element.italic === true ? null : true});
            else setStyle({italic: element.italic === true ? false : null});
          },
        }),
        h('div', {className: 'fpb-columns-pick' + (deviceHas(element, device, 'text_transform') ? ' is-override' : ''), key: 'text_transform', role: 'group', 'aria-label': 'Трансформация на текста'},
          [['none', 'Обикновен'], ['uppercase', 'ГЛАВНИ'], ['lowercase', 'малки'], ['capitalize', 'Първа']].map(([value, label]) => h('button', {
            key: value,
            type: 'button',
            className: transform === value ? 'is-active' : '',
            'aria-pressed': transform === value,
            onClick: () => setStyle({text_transform: desktop ? (value === 'none' ? null : value) : value}),
          }, label)),
          deviceHas(element, device, 'text_transform') ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({text_transform: null})}, 'Наследи') : null),
        field('Разредка (px)', h(C.Input, {type: 'number', min: -20, max: 20, value: view.letter_spacing == null ? '' : String(view.letter_spacing), placeholder: placeholderFor('letter_spacing'), onChange: (event) => setStyle({letter_spacing: event.target.value === '' ? null : Number(event.target.value)})}), 'letter_spacing'),
        h('div', {className: 'fpb-color' + (deviceHas(element, device, 'shadow_color') ? ' is-override' : ''), key: 'shadow_color'},
          h('span', null, 'Сянка', deviceHas(element, device, 'shadow_color') ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({shadow_color: null, shadow_x: null, shadow_y: null, shadow_blur: null})}, 'Наследи') : null),
          h('input', {
            type: 'color',
            value: colorValue(view.shadow_color) || '#111827',
            'aria-label': 'Сянка',
            onChange: (event) => setStyle({
              shadow_color: event.target.value,
              shadow_x: view.shadow_x == null ? 0 : view.shadow_x,
              shadow_y: view.shadow_y == null ? 2 : view.shadow_y,
              shadow_blur: view.shadow_blur == null ? 8 : view.shadow_blur,
            }),
          }),
          colorValue(view.shadow_color) ? h('button', {type: 'button', onClick: () => setStyle({shadow_color: null, shadow_x: null, shadow_y: null, shadow_blur: null})}, desktop ? 'Без' : 'Наследи') : null),
      );
      if (view.shadow_color) {
        typography.push(
          field('Сянка X (px)', h(C.Input, {type: 'number', min: -40, max: 40, value: view.shadow_x == null ? '' : String(view.shadow_x), placeholder: '0', onChange: (event) => setStyle({shadow_x: event.target.value === '' ? null : Number(event.target.value)})}), 'shadow_x'),
          field('Сянка Y (px)', h(C.Input, {type: 'number', min: -40, max: 40, value: view.shadow_y == null ? '' : String(view.shadow_y), placeholder: '2', onChange: (event) => setStyle({shadow_y: event.target.value === '' ? null : Number(event.target.value)})}), 'shadow_y'),
          field('Размазване (px)', h(C.Input, {type: 'number', min: 0, max: 40, value: view.shadow_blur == null ? '' : String(view.shadow_blur), placeholder: '8', onChange: (event) => setStyle({shadow_blur: event.target.value === '' ? null : Number(event.target.value)})}), 'shadow_blur'),
        );
      }
      typography.push(field('Контур (px)', h(C.Input, {type: 'number', min: 0, max: 8, value: view.stroke_width == null ? '' : String(view.stroke_width), placeholder: placeholderFor('stroke_width'), onChange: (event) => setStyle({stroke_width: event.target.value === '' ? null : Number(event.target.value)})}), 'stroke_width'));
      if (displayValue('stroke_width')) {
        const strokeLocal = colorValue(view.stroke_color);
        const strokeFrom = colorValue(inherited.stroke_color);
        typography.push(h('div', {className: 'fpb-color' + (isOverridden('stroke_color') ? ' is-override' : ''), key: 'stroke_color'},
          h('span', null, 'Цвят на контура', isOverridden('stroke_color') ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({stroke_color: null})}, 'Наследи') : null),
          h('input', {
            type: 'color',
            value: strokeLocal || strokeFrom || '#111827',
            'aria-label': 'Цвят на контура',
            onChange: (event) => {
              const next = event.target.value;
              if (!strokeLocal && strokeFrom && strokeFrom.toLowerCase() === next.toLowerCase()) return;
              setStyle({stroke_color: next});
            },
          }),
          strokeLocal ? h('button', {type: 'button', onClick: () => setStyle({stroke_color: null})}, desktop ? (isOverridden('stroke_color') ? 'Наследи' : 'Без') : 'Наследи') : null));
      }
    }
    if (element.type !== 'section') {
      const hidden = view.hidden === true;
      content.push(h(C.CheckboxField, {
        key: 'hidden',
        checked: hidden,
        label: 'Скрий на това устройство',
        onChange: (event) => {
          if (desktop) {
            setStyle({hidden: event.target.checked ? true : null});
            return;
          }
          if (event.target.checked) setStyle({hidden: element.hidden === true ? null : true});
          else setStyle({hidden: element.hidden === true ? false : null});
        },
      }));
    }
    const appearance = [];
    const hover = [];
    if (element.type !== 'html') {
      const colorField = (label, key, shared) => {
        const source = shared ? element : view;
        const write = shared ? set : setStyle;
        const local = colorValue(source[key]);
        const fromLayer = shared ? null : colorValue(inherited[key]);
        const shown = local || fromLayer || '#ffffff';
        const over = !shared && isOverridden(key);
        return h('div', {className: 'fpb-color' + (over ? ' is-override' : ''), key},
          h('span', null, label, over ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => write({[key]: null})}, 'Наследи') : null),
          h('input', {
            type: 'color',
            value: shown,
            'aria-label': label,
            onChange: (event) => {
              const next = event.target.value;
              if (!local && fromLayer && fromLayer.toLowerCase() === next.toLowerCase()) return;
              write({[key]: next});
            },
          }),
          local ? h('button', {type: 'button', onClick: () => write({[key]: null})}, shared || desktop ? (over ? 'Наследи' : 'Без') : 'Наследи') : null);
      };
      const numberField = (label, key, max) => field(label, h(C.Input, {type: 'number', min: 0, max, value: view[key] == null ? '' : String(view[key]), placeholder: placeholderFor(key), onChange: (event) => setStyle({[key]: event.target.value === '' ? null : Number(event.target.value)})}), key);
      appearance.push(colorField('Заден фон', 'background'));
      if (element.type === 'section' && desktop) {
        const current = gradientCss(element);
        appearance.push(h('div', {className: 'fpb-gradients', key: 'gradient'},
          h('span', null, 'Градиент'),
          h('div', {className: 'fpb-gradients-swatches', role: 'group', 'aria-label': 'Градиент'},
            GRADIENTS.map((item) => h('button', {
              key: item.id,
              type: 'button',
              className: element.gradient === item.id ? 'is-active' : '',
              title: item.label,
              'aria-label': item.label,
              'aria-pressed': element.gradient === item.id,
              style: {background: item.css},
              onClick: () => set({gradient: item.id}),
            })),
            h('button', {
              type: 'button',
              className: 'is-custom' + (element.gradient === 'custom' ? ' is-active' : ''),
              'aria-pressed': element.gradient === 'custom',
              onClick: () => set({
                gradient: 'custom',
                gradient_from: element.gradient_from || '#1e293b',
                gradient_to: element.gradient_to || '#0f172a',
                gradient_angle: element.gradient_angle ?? 180,
              }),
            }, 'Собствен'),
            element.gradient ? h('button', {type: 'button', className: 'is-clear', onClick: () => set({gradient: null, gradient_from: null, gradient_to: null, gradient_angle: null})}, 'Без') : null),
          element.gradient === 'custom' ? h('div', {className: 'fpb-gradients-custom'},
            colorField('От', 'gradient_from', true),
            colorField('До', 'gradient_to', true),
            field('Ъгъл (°)', h(C.Input, {type: 'number', min: 0, max: 360, value: element.gradient_angle == null ? '' : String(element.gradient_angle), placeholder: '180', onChange: (event) => set({gradient_angle: event.target.value === '' ? null : Number(event.target.value)})})),
            current ? h('div', {className: 'fpb-gradients-preview', style: {background: current}, 'aria-hidden': true}) : null) : null));
        appearance.push(h('div', {className: 'fpb-gradients', key: 'patterns'},
          h('span', null, 'Шарка'),
          h('div', {className: 'fpb-gradients-swatches fpb-pattern-swatches', role: 'group', 'aria-label': 'Шарка'},
            PATTERNS.map((item) => h('button', {
              key: item.id,
              type: 'button',
              className: 'fpb-pattern-swatch fpb-pattern-' + item.id + (element.wallpaper_preset === item.id ? ' is-active' : ''),
              title: item.label,
              'aria-label': item.label,
              'aria-pressed': element.wallpaper_preset === item.id,
              onClick: () => set({wallpaper_preset: item.id, wallpaper_id: null}),
            })),
            element.wallpaper_preset ? h('button', {type: 'button', className: 'is-clear', onClick: () => set({wallpaper_preset: null})}, 'Без') : null)));
        appearance.push(h(C.ImageField, {
          key: 'wallpaper',
          label: 'Собствен тапет',
          value: element.wallpaper_id || null,
          onChange: (id) => set({wallpaper_id: id, wallpaper_preset: id ? null : element.wallpaper_preset}),
          emptyLabel: 'Избери снимка',
          description: 'Замества шарката. Показва се върху задния фон и градиента.',
        }));
        if (element.wallpaper_id) {
          appearance.push(h('div', {className: 'fpb-columns-pick', key: 'wallpaper_fit', role: 'group', 'aria-label': 'Покриване на тапета'},
            [['cover', 'Запълни'], ['contain', 'Побери']].map(([value, label]) => h('button', {
              key: value,
              type: 'button',
              className: (element.wallpaper_fit || 'cover') === value ? 'is-active' : '',
              'aria-pressed': (element.wallpaper_fit || 'cover') === value,
              onClick: () => set({wallpaper_fit: value === 'cover' ? null : value}),
            }, label))));
          const position = element.wallpaper_position || 'center';
          appearance.push(h('div', {className: 'fpb-wallpaper-position', key: 'wallpaper_position'},
            h('span', null, 'Позиция на изображението'),
            h('div', {className: 'fpb-position-pick', role: 'group', 'aria-label': 'Позиция на изображението'},
              [
                ['top-left', 'Горе ляво'],
                ['top-center', 'Горе'],
                ['top-right', 'Горе дясно'],
                ['center-left', 'Ляво'],
                ['center', 'Център'],
                ['center-right', 'Дясно'],
                ['bottom-left', 'Долу ляво'],
                ['bottom-center', 'Долу'],
                ['bottom-right', 'Долу дясно'],
              ].map(([value, label]) => h('button', {
                key: value,
                type: 'button',
                className: position === value ? 'is-active' : '',
                title: label,
                'aria-label': label,
                'aria-pressed': position === value,
                onClick: () => set({wallpaper_position: value === 'center' ? null : value}),
              }, h('span', {'aria-hidden': true}))))));
        }
      }
      if (element.type === 'section' && (element.wallpaper_id || element.wallpaper_preset || isDefaults)) {
        appearance.push(h('div', {className: 'fpb-columns-pick' + (deviceHas(element, device, 'image_filter') ? ' is-override' : ''), key: 'image_filter', role: 'group', 'aria-label': 'Цвят на тапета'},
          [['color', 'Цветна'], ['grayscale', 'Черно-бяла']].map(([value, label]) => h('button', {
            key: value,
            type: 'button',
            className: (view.image_filter || 'color') === value ? 'is-active' : '',
            'aria-pressed': (view.image_filter || 'color') === value,
            onClick: () => setStyle({image_filter: desktop ? (value === 'color' ? null : value) : value}),
          }, label)),
          deviceHas(element, device, 'image_filter') ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({image_filter: null})}, 'Наследи') : null));
        const wallpaperTint = deviceHas(element, device, 'image_tint') || deviceHas(element, device, 'image_tint_opacity');
        appearance.push(h('div', {className: 'fpb-color' + (wallpaperTint ? ' is-override' : ''), key: 'image_tint'},
          h('span', null, 'Цветен филтър', wallpaperTint ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({image_tint: null, image_tint_opacity: null})}, 'Наследи') : null),
          h('input', {
            type: 'color',
            value: colorValue(view.image_tint) || '#7c3aed',
            'aria-label': 'Цветен филтър',
            onChange: (event) => setStyle({
              image_tint: event.target.value,
              image_tint_opacity: view.image_tint_opacity == null ? 40 : view.image_tint_opacity,
            }),
          }),
          colorValue(view.image_tint) ? h('button', {type: 'button', onClick: () => setStyle({image_tint: null, image_tint_opacity: null})}, desktop ? 'Без' : 'Наследи') : null));
        if (view.image_tint) {
          appearance.push(field('Плътност на филтъра (%)', h(C.Input, {
            type: 'number',
            min: 0,
            max: 100,
            value: view.image_tint_opacity == null ? '' : String(view.image_tint_opacity),
            placeholder: desktop ? '40' : inheritLabel,
            onChange: (event) => setStyle({image_tint_opacity: event.target.value === '' ? null : Number(event.target.value)}),
          }), 'image_tint_opacity'));
        }
      }
      if (element.type === 'section') {
        const overColor = deviceHas(element, device, 'overlay_color') || deviceHas(element, device, 'overlay_opacity');
        appearance.push(h('div', {className: 'fpb-color' + (overColor ? ' is-override' : ''), key: 'overlay'},
          h('span', null, 'Overlay', overColor ? h('button', {type: 'button', className: 'fpb-inherit', onClick: () => setStyle({overlay_color: null, overlay_opacity: null})}, 'Наследи') : null),
          h('input', {
            type: 'color',
            value: colorValue(view.overlay_color) || '#000000',
            'aria-label': 'Overlay',
            onChange: (event) => setStyle({
              overlay_color: event.target.value,
              overlay_opacity: view.overlay_opacity == null ? 40 : view.overlay_opacity,
            }),
          }),
          colorValue(view.overlay_color) ? h('button', {type: 'button', onClick: () => setStyle({overlay_color: null, overlay_opacity: null})}, desktop ? 'Без' : 'Наследи') : null));
        if (view.overlay_color) {
          appearance.push(field('Плътност на overlay (%)', h(C.Input, {
            type: 'number',
            min: 0,
            max: 100,
            value: view.overlay_opacity == null ? '' : String(view.overlay_opacity),
            placeholder: desktop ? '40' : inheritLabel,
            onChange: (event) => setStyle({overlay_opacity: event.target.value === '' ? null : Number(event.target.value)}),
          }), 'overlay_opacity'));
        }
      }
      appearance.push(
        colorField('Цвят на текста', 'color'),
        numberField('Граница (px)', 'border_width', 20),
        colorField('Цвят на границата', 'border_color'),
        numberField('Ръбове (px)', 'radius', 80),
      );
      if (element.type === 'button') {
        hover.push(
          colorField('Заден фон', 'hover_background'),
          colorField('Цвят на текста', 'hover_color'),
          colorField('Цвят на границата', 'hover_border_color'),
        );
      }
    }
    const particles = [];
    if (element.type === 'section' && desktop) {
      const effect = element.particles || null;
      particles.push(field('Ефект', h('select', {
        value: effect || '',
        onChange: (event) => set(event.target.value === ''
          ? {particles: null, particles_color: null, particles_density: null, particles_speed: null}
          : {particles: event.target.value}),
      },
        [h('option', {value: ''}, inherited.particles
          ? inheritLabel + ' (' + (PARTICLES.find((item) => item.id === inherited.particles)?.label || inherited.particles) + ')'
          : 'Без'),
          ...PARTICLES.map((item) => h('option', {key: item.id, value: item.id}, item.label))])));
      if (effect) {
        particles.push(
          h('div', {className: 'fpb-color', key: 'particles_color'},
            h('span', null, 'Цвят на частиците'),
            h('input', {
              type: 'color',
              value: colorValue(element.particles_color) || '#ffffff',
              'aria-label': 'Цвят на частиците',
              onChange: (event) => set({particles_color: event.target.value}),
            }),
            colorValue(element.particles_color) ? h('button', {type: 'button', onClick: () => set({particles_color: null})}, 'Бял') : null),
          field('Плътност (10–150)', h(C.Input, {
            type: 'number',
            min: 10,
            max: 150,
            value: element.particles_density == null ? '' : String(element.particles_density),
            placeholder: '50',
            onChange: (event) => set({particles_density: event.target.value === '' ? null : Number(event.target.value)}),
          })),
          field('Скорост (1–10)', h(C.Input, {
            type: 'number',
            min: 1,
            max: 10,
            value: element.particles_speed == null ? '' : String(element.particles_speed),
            placeholder: '3',
            onChange: (event) => set({particles_speed: event.target.value === '' ? null : Number(event.target.value)}),
          })),
        );
      }
    }
    const animEffective = displayValue('animation');
    const animation = [
      field('Вход', h('select', {
        value: view.animation == null ? '' : String(view.animation),
        onChange: (event) => {
          const value = event.target.value === '' ? null : event.target.value;
          setStyle(value == null
            ? {animation: null, animation_duration: null, animation_delay: null}
            : {animation: value});
        },
      },
        [h('option', {value: ''}, inherited.animation
          ? inheritLabel + ' (' + (ENTRANCE_ANIMATIONS.find((item) => item.id === inherited.animation)?.label || inherited.animation) + ')'
          : 'Без'),
          ...ENTRANCE_ANIMATIONS.map((item) => h('option', {key: item.id, value: item.id}, item.label))]), 'animation'),
    ];
    if (animEffective) {
      animation.push(
        field('Продължителност (ms)', h(C.Input, {
          type: 'number',
          min: 100,
          max: 3000,
          value: view.animation_duration == null ? '' : String(view.animation_duration),
          placeholder: placeholderFor('animation_duration', '600'),
          onChange: (event) => setStyle({animation_duration: event.target.value === '' ? null : Number(event.target.value)}),
        }), 'animation_duration'),
        field('Закъснение (ms)', h(C.Input, {
          type: 'number',
          min: 0,
          max: 3000,
          value: view.animation_delay == null ? '' : String(view.animation_delay),
          placeholder: placeholderFor('animation_delay', '0'),
          onChange: (event) => setStyle({animation_delay: event.target.value === '' ? null : Number(event.target.value)}),
        }), 'animation_delay'),
      );
      if (!isDefaults && onPreviewAnimation) {
        animation.push(
          h('div', {className: 'fpb-inspector-actions', key: 'anim-preview'},
            h(C.Button, {type: 'button', variant: 'secondary', onClick: onPreviewAnimation}, 'Преглед')),
        );
      }
    }
    animation.push(
      field('Hover', h('select', {
        value: view.hover_animation == null ? '' : String(view.hover_animation),
        onChange: (event) => setStyle({hover_animation: event.target.value === '' ? null : event.target.value}),
      },
        [h('option', {value: ''}, inherited.hover_animation
          ? inheritLabel + ' (' + (HOVER_ANIMATIONS.find((item) => item.id === inherited.hover_animation)?.label || inherited.hover_animation) + ')'
          : 'Без'),
          ...HOVER_ANIMATIONS.map((item) => h('option', {key: item.id, value: item.id}, item.label))]), 'hover_animation'),
    );
    const boxSides = [
      ['top', 'Горе'],
      ['right', 'Дясно'],
      ['bottom', 'Долу'],
      ['left', 'Ляво'],
    ];
    const boxGroup = (title, prefix) => h('div', {className: 'fpb-box', key: prefix},
      h('p', {className: 'fpb-box-title'}, title),
      h('div', {className: 'fpb-box-sides'}, boxSides.map(([side, label]) => {
        const key = prefix + '_' + side;
        return field(label, h(C.Input, {
          type: 'number',
          min: 0,
          max: 160,
          value: view[key] == null ? '' : String(view[key]),
          placeholder: desktop ? '—' : inheritLabel,
          'aria-label': title + ' ' + label,
          onChange: (event) => setStyle({[key]: event.target.value === '' ? null : Number(event.target.value)}),
        }), key);
      })));
    const spacing = [boxGroup('Padding', 'padding'), boxGroup('Margin', 'margin')];
    const sections = [
      isDefaults ? null : ['Позиция', [
        field('Име в структурата', h(C.Input, {
          value: element.name || '',
          placeholder: elementLabel({...element, name: null}),
          onChange: (event) => set({name: event.target.value.trim() === '' ? null : event.target.value}),
        })),
        h('div', {className: 'fpb-inspector-actions', key: 'actions'},
        h(C.Button, {type: 'button', variant: 'secondary', onClick: () => onMove(-1)}, 'Нагоре'),
        h(C.Button, {type: 'button', variant: 'secondary', onClick: () => onMove(1)}, 'Надолу'),
        h(C.Button, {type: 'button', variant: 'secondary', onClick: onRemove}, 'Изтрий')),
      ]],
      ['Съдържание', content],
      ['Текст', typography],
      ['Отстъп', spacing],
      ['Вид', appearance],
      ['Частици', particles],
      ['Анимация', animation],
      hover.length ? ['Hover', hover] : null,
    ].filter((entry) => entry && entry[1].length);
    const deviceLabel = WIDTHS.find((item) => item.id === device)?.label || 'Бюро';
    return h('div', {className: 'fpb-inspector'},
      h('div', {className: 'fpb-inspector-device'},
        h('div', {className: 'fpb-devices', role: 'group', 'aria-label': 'Устройство'},
          WIDTHS.map((item) => h('button', {
            key: item.id,
            type: 'button',
            className: item.id === device ? 'is-active' : '',
            onClick: () => onDevice?.(item.id),
          }, item.label))),
        desktop ? null : h('p', {className: 'fpb-device-note'}, 'Промените важат само за „' + deviceLabel + '“. Празно поле остава както на бюро.')),
      sections.map(([title, fields]) => {
        const closed = collapsed[title] === true;
        return h('section', {className: 'fpb-section' + (closed ? ' is-collapsed' : ''), key: title},
          h('button', {
            type: 'button',
            className: 'fpb-section-toggle',
            'aria-expanded': !closed,
            onClick: () => toggleSection(title),
          },
            h('span', {className: 'fpb-section-toggle-label'}, title),
            h('span', {className: 'fpb-section-chevron', 'aria-hidden': true},
              h('svg', {viewBox: '0 0 24 24', width: 14, height: 14},
                h('path', {d: 'M9 6l6 6-6 6', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'})))),
          h('div', {className: 'fpb-section-body', 'aria-hidden': closed},
            h('div', {className: 'fpb-section-clip'},
              h('div', {className: 'fpb-section-body-inner'}, fields))));
      }));
  };
}
