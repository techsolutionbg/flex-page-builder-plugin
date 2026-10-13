import {colorValue, gradientCss} from './compile.js';
import {GRADIENTS, resizeColumns} from './model.js';

export function createInspector(host) {
  const {React} = host;
  const C = host.components;
  const h = React.createElement;

  return function Inspector({element, onChange, onRemove, onMove, onAddColumns, mode}) {
    const defaults = mode === 'defaults';
    if (!element) {
      return h('p', {className: 'fpb-muted'}, defaults
        ? 'Изберете тип елемент, за да зададете вид по подразбиране за всички страници.'
        : 'Изберете елемент от платното, за да промените текста, изображението или връзката му.');
    }
    const set = (patch) => onChange({...element, ...patch});
    const field = (label, child) => h('label', {className: 'fpb-field'}, h('span', null, label), child);
    const sizeField = field('Размер на текста (px)', h(C.Input, {type: 'number', min: 8, max: 160, value: element.size == null ? '' : String(element.size), placeholder: 'По подразбиране', onChange: (event) => set({size: event.target.value === '' ? null : Number(event.target.value)})}));
    const lineField = field('Междуредие', h(C.Input, {type: 'number', min: 0.8, max: 3, step: 0.1, value: element.line_height == null ? '' : String(element.line_height), placeholder: 'По подразбиране', onChange: (event) => set({line_height: event.target.value === '' ? null : Number(event.target.value)})}));
    const weightField = field('Дебелина', h('select', {value: element.weight == null ? '' : String(element.weight), onChange: (event) => set({weight: event.target.value === '' ? null : Number(event.target.value)})},
      [h('option', {value: ''}, 'По подразбиране'), ...[300, 400, 500, 600, 700, 800].map((weight) => h('option', {key: weight, value: String(weight)}, String(weight)))]));
    const align = element.align === 'center' || element.align === 'right' ? element.align : 'left';
    const alignField = h('div', {className: 'fpb-align', role: 'group', 'aria-label': 'Подравняване'},
      [['left', 'Ляво', 'M4 6h16M4 12h10M4 18h16'], ['center', 'Център', 'M4 6h16M7 12h10M4 18h16'], ['right', 'Дясно', 'M4 6h16M10 12h10M4 18h16']].map(([value, label, path]) => h('button', {
        key: value,
        type: 'button',
        className: align === value ? 'is-active' : '',
        'aria-label': label,
        'aria-pressed': align === value,
        onClick: () => set({align: value === 'left' ? null : value}),
      }, h('svg', {viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true'}, h('path', {d: path, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round'})))));
    const content = [];
    const typography = [];
    if (element.type === 'heading') {
      content.push(field('Ниво', h('select', {value: element.level == null ? '' : String(element.level), onChange: (event) => set({level: event.target.value === '' ? null : Number(event.target.value)})},
        [h('option', {value: ''}, 'По подразбиране'), ...[1, 2, 3, 4, 5, 6].map((level) => h('option', {key: level, value: String(level)}, 'H' + level))])));
      if (!defaults) content.push(field('Текст', h(C.Input, {value: element.text || '', onChange: (event) => set({text: event.target.value})})));
      typography.push(sizeField, lineField, weightField, alignField);
    } else if (element.type === 'paragraph' || element.type === 'html') {
      const key = element.type === 'html' ? 'html' : 'text';
      if (!defaults) content.push(field(element.type === 'html' ? 'HTML' : 'Текст', h(C.Textarea, {rows: 5, value: element[key] || '', onChange: (event) => set({[key]: event.target.value})})));
      if (element.type === 'paragraph') typography.push(sizeField, lineField, weightField, alignField);
    } else if (element.type === 'image') {
      if (!defaults) {
        content.push(h(C.ImageField, {key: 'image', label: 'Изображение', value: element.media_id || null, onChange: (id) => set({media_id: id})}));
        content.push(field('Алтернативен текст', h(C.Input, {value: element.alt || '', onChange: (event) => set({alt: event.target.value})})));
      }
    } else if (element.type === 'button') {
      if (!defaults) {
        content.push(field('Текст', h(C.Input, {value: element.text || '', onChange: (event) => set({text: event.target.value})})));
        content.push(field('Адрес', h(C.Input, {value: element.url || '', onChange: (event) => set({url: event.target.value})})));
      }
      typography.push(sizeField, lineField, weightField, alignField);
    } else if (element.type === 'list') {
      if (!defaults) {
        content.push(h(C.CheckboxField, {key: 'ordered', checked: element.ordered === true, label: 'Номериран', onChange: (event) => set({ordered: event.target.checked})}));
        content.push(field('Редове, по един на ред', h(C.Textarea, {rows: 4, value: (element.items || []).join('\n'), onChange: (event) => set({items: event.target.value.split('\n')})})));
      }
      typography.push(sizeField, lineField, weightField, alignField);
    } else if (element.type === 'spacer') {
      content.push(field('Височина (px)', h(C.Input, {type: 'number', min: 8, max: 160, value: element.height == null ? '' : String(element.height), placeholder: defaults ? 'Няма' : '32', onChange: (event) => set({height: event.target.value === '' ? null : Number(event.target.value)})})));
    } else if (element.type === 'section') {
      content.push(h(C.CheckboxField, {key: 'full_width', checked: element.full_width === true, label: 'Цяла ширина на страницата', onChange: (event) => set({full_width: defaults ? (event.target.checked ? true : null) : event.target.checked})}));
      if (!defaults) content.push(field('Добави колони', h('div', {className: 'fpb-columns-pick', role: 'group', 'aria-label': 'Добави колони'},
        [1, 2, 3, 4, 5, 6].map((value) => h('button', {key: value, type: 'button', onClick: () => onAddColumns?.(value)}, String(value))))));
    } else if (element.type === 'columns' && !defaults) {
      const count = (element.children || []).length || element.columns || 2;
      content.push(h('div', {className: 'fpb-columns-pick', key: 'columns', role: 'group', 'aria-label': 'Брой колони'},
        [1, 2, 3, 4, 5, 6].map((value) => h('button', {
          key: value,
          type: 'button',
          className: count === value ? 'is-active' : '',
          'aria-pressed': count === value,
          onClick: () => onChange(resizeColumns(element, value)),
        }, String(value)))));
    }
    const appearance = [];
    if (element.type !== 'html') {
      const colorField = (label, key) => h('div', {className: 'fpb-color', key},
        h('span', null, label),
        h('input', {type: 'color', value: colorValue(element[key]) || '#ffffff', 'aria-label': label, onChange: (event) => set({[key]: event.target.value})}),
        colorValue(element[key]) ? h('button', {type: 'button', onClick: () => set({[key]: null})}, 'Без') : null);
      const numberField = (label, key, max) => field(label, h(C.Input, {type: 'number', min: 0, max, value: element[key] == null ? '' : String(element[key]), placeholder: 'По подразбиране', onChange: (event) => set({[key]: event.target.value === '' ? null : Number(event.target.value)})}));
      appearance.push(colorField('Заден фон', 'background'));
      if (element.type === 'section') {
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
            colorField('От', 'gradient_from'),
            colorField('До', 'gradient_to'),
            field('Ъгъл (°)', h(C.Input, {type: 'number', min: 0, max: 360, value: element.gradient_angle == null ? '' : String(element.gradient_angle), placeholder: '180', onChange: (event) => set({gradient_angle: event.target.value === '' ? null : Number(event.target.value)})})),
            current ? h('div', {className: 'fpb-gradients-preview', style: {background: current}, 'aria-hidden': true}) : null) : null));
        appearance.push(h(C.ImageField, {
          key: 'wallpaper',
          label: 'Тапет',
          value: element.wallpaper_id || null,
          onChange: (id) => set({wallpaper_id: id}),
          emptyLabel: 'Избери тапет',
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
        }
      }
      appearance.push(
        colorField('Цвят на текста', 'color'),
        numberField('Граница (px)', 'border_width', 20),
        colorField('Цвят на границата', 'border_color'),
        numberField('Ръбове (px)', 'radius', 80),
      );
    }
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
          value: element[key] == null ? '' : String(element[key]),
          placeholder: '—',
          'aria-label': title + ' ' + label,
          onChange: (event) => set({[key]: event.target.value === '' ? null : Number(event.target.value)}),
        }));
      })));
    const spacing = [boxGroup('Padding', 'padding'), boxGroup('Margin', 'margin')];
    const sections = [
      defaults ? null : ['Позиция', [h('div', {className: 'fpb-inspector-actions', key: 'actions'},
        h(C.Button, {type: 'button', variant: 'secondary', onClick: () => onMove(-1)}, 'Нагоре'),
        h(C.Button, {type: 'button', variant: 'secondary', onClick: () => onMove(1)}, 'Надолу'),
        h(C.Button, {type: 'button', variant: 'secondary', onClick: onRemove}, 'Изтрий'))]],
      ['Съдържание', content],
      ['Текст', typography],
      ['Отстъп', spacing],
      ['Вид', appearance],
    ].filter((entry) => entry && entry[1].length);
    return h('div', {className: 'fpb-inspector'}, sections.map(([title, fields], index) => h('section', {className: 'fpb-section', key: title},
      index > 0 ? h('hr', {className: 'fpb-inspector-rule'}) : null,
      h('h2', null, title),
      fields)));
  };
}
