import {createInspector} from './inspector.js';
import {PALETTE, PALETTE_GROUPS} from './model.js';

export function createGlobalsPanel(host) {
  const {React} = host;
  const h = React.createElement;
  const Inspector = createInspector(host);

  return function GlobalsPanel({defaults, selectedType, onSelectType, onChange}) {
    const current = selectedType ? {type: selectedType, ...(defaults[selectedType] || {})} : null;
    return h('div', {className: 'fpb-globals'},
      h('p', {className: 'fpb-globals-note'}, 'Тези стойности важат за всички страници. Настройките на конкретния елемент ги презаписват.'),
      current
        ? h(React.Fragment, null,
          h('button', {type: 'button', className: 'fpb-globals-back', onClick: () => onSelectType(null)}, 'Всички елементи'),
          h('p', {className: 'fpb-globals-title'}, PALETTE.find((item) => item.type === selectedType)?.label || selectedType),
          h(Inspector, {
            mode: 'defaults',
            element: current,
            onChange: (next) => {
              const {type, ...style} = next;
              onChange({...defaults, [selectedType]: style});
            },
          }))
        : h('div', {className: 'fpb-palette-list'}, PALETTE_GROUPS.map((group, index) => h('section', {key: group.id, className: 'fpb-palette-group'},
          index > 0 ? h('hr', {className: 'fpb-palette-rule'}) : null,
          h('h2', null, group.label),
          h('div', {className: 'fpb-palette-items'}, group.items.map((item) => h('button', {
            key: item.type,
            type: 'button',
            className: defaults[item.type] && Object.keys(defaults[item.type]).length ? 'has-defaults' : '',
            onClick: () => onSelectType(item.type),
          }, item.label)))))));
  };
}
