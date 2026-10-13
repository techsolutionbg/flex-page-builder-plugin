import {createInspector} from './inspector.js';
import {buttonStyleId, PALETTE, PALETTE_GROUPS} from './model.js';

export function createGlobalsPanel(host) {
  const {React} = host;
  const C = host.components;
  const h = React.createElement;
  const Inspector = createInspector(host);

  return function GlobalsPanel({
    defaults,
    buttonStyles,
    selectedType,
    editingStyleId,
    onSelectType,
    onSelectStyle,
    onChangeDefaults,
    onChangeStyles,
    device,
    onDevice,
  }) {
    const styles = Array.isArray(buttonStyles) ? buttonStyles : [];
    const editingStyle = selectedType === 'button' && editingStyleId
      ? styles.find((item) => item.id === editingStyleId)
      : null;

    if (editingStyle) {
      const current = {type: 'button', ...editingStyle};
      const styleName = editingStyle.name || 'Дизайн';
      return h('div', {className: 'fpb-globals'},
        h('nav', {className: 'fpb-panel-crumbs', 'aria-label': 'Навигация в глобалните'},
          h('button', {type: 'button', onClick: () => onSelectType(null)}, 'Глобални'),
          h('span', {'aria-hidden': true}, '/'),
          h('button', {type: 'button', onClick: () => { onSelectType('button'); onSelectStyle(null); }}, 'Бутон'),
          h('span', {'aria-hidden': true}, '/'),
          h('button', {type: 'button', onClick: () => onSelectStyle(null)}, 'Дизайни'),
          h('span', {'aria-hidden': true}, '/'),
          h('span', {className: 'fpb-panel-crumb-current', 'aria-current': 'page'}, styleName)),
        h('p', {className: 'fpb-globals-title'}, styleName),
        h('div', {className: 'fpb-style-name'},
          h('label', null,
            h('span', null, 'Име'),
            h(C.Input, {
              value: editingStyle.name || '',
              onChange: (event) => {
                const name = event.target.value;
                onChangeStyles(styles.map((item) => (item.id === editingStyle.id ? {...item, name} : item)));
              },
            }))),
        h(Inspector, {
          mode: 'defaults',
          device,
          onDevice,
          element: current,
          onChange: (next) => {
            const {type, name, id, button_style_id, text, url, link_type, page_id, ...style} = next;
            onChangeStyles(styles.map((item) => (item.id === editingStyle.id
              ? {id: editingStyle.id, name: editingStyle.name || 'Дизайн', ...style}
              : item)));
          },
        }));
    }

    if (!selectedType) {
      return h('div', {className: 'fpb-globals'},
        h('p', {className: 'fpb-globals-note'}, 'Тези стойности важат за всички страници. Настройките на конкретния елемент ги презаписват.'),
        h('div', {className: 'fpb-palette-list'}, PALETTE_GROUPS.map((group, index) => h('section', {
          key: group.id,
          className: 'fpb-palette-group',
        },
        index > 0 ? h('hr', {className: 'fpb-palette-rule'}) : null,
        h('h2', null, group.label),
        h('div', {className: 'fpb-palette-items'}, group.items.map((item) => h('button', {
          key: item.type,
          type: 'button',
          className: (defaults[item.type] && Object.keys(defaults[item.type]).length)
            || (item.type === 'button' && styles.length)
            ? 'has-defaults'
            : '',
          onClick: () => onSelectType(item.type),
        }, item.label)))))));
    }

    const current = {type: selectedType, ...(defaults[selectedType] || {})};
    const typeLabel = PALETTE.find((item) => item.type === selectedType)?.label || selectedType;
    return h('div', {className: 'fpb-globals'},
      h('nav', {className: 'fpb-panel-crumbs', 'aria-label': 'Навигация в глобалните'},
        h('button', {type: 'button', onClick: () => onSelectType(null)}, 'Глобални'),
        h('span', {'aria-hidden': true}, '/'),
        h('span', {className: 'fpb-panel-crumb-current', 'aria-current': 'page'}, typeLabel)),
      h('p', {className: 'fpb-globals-note'}, 'Тези стойности важат за всички страници. Настройките на конкретния елемент ги презаписват.'),
      h('p', {className: 'fpb-globals-title'}, typeLabel),
      selectedType === 'button' ? h('div', {className: 'fpb-button-styles'},
        h('div', {className: 'fpb-button-styles-head'},
          h('p', {className: 'fpb-box-title'}, 'Дизайни'),
          h(C.Button, {
            type: 'button',
            variant: 'secondary',
            onClick: () => {
              const id = buttonStyleId();
              onChangeStyles([...styles, {id, name: 'Нов дизайн'}]);
              onSelectStyle(id);
            },
          }, 'Добави')),
        styles.length
          ? h('ul', {className: 'fpb-button-styles-list'}, styles.map((item) => h('li', {key: item.id},
            h('button', {
              type: 'button',
              className: 'fpb-button-style-item',
              onClick: () => onSelectStyle(item.id),
            }, item.name || 'Дизайн'),
            h('button', {
              type: 'button',
              className: 'fpb-button-style-delete',
              'aria-label': 'Изтрий дизайна',
              onClick: () => onChangeStyles(styles.filter((style) => style.id !== item.id)),
            }, '×'))))
          : h('p', {className: 'fpb-muted'}, 'Няма запазени дизайни.'),
        h('p', {className: 'fpb-muted'}, 'По-долу са стойностите по подразбиране, когато бутонът няма избран дизайн.')) : null,
      h(Inspector, {
        mode: 'defaults',
        device,
        onDevice,
        element: current,
        onChange: (next) => {
          const {type, ...style} = next;
          onChangeDefaults({...defaults, [selectedType]: style});
        },
      }));
  };
}
