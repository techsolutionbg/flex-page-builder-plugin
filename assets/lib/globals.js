import {createInspector} from './inspector.js';
import {buttonStyleId, PALETTE, PALETTE_GROUPS} from './model.js';

export function createGlobalsPanel(host) {
  const {React} = host;
  const C = host.components;
  const h = React.createElement;
  const t = host.i18n.t;
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
      const styleName = editingStyle.name || t('Design');
      return h('div', {className: 'fpb-globals'},
        h('nav', {className: 'fpb-panel-crumbs', 'aria-label': t('Global styles navigation')},
          h('button', {type: 'button', onClick: () => onSelectType(null)}, t('Global styles')),
          h('span', {'aria-hidden': true}, '/'),
          h('button', {type: 'button', onClick: () => { onSelectType('button'); onSelectStyle(null); }}, 'Button'),
          h('span', {'aria-hidden': true}, '/'),
          h('button', {type: 'button', onClick: () => onSelectStyle(null)}, t('Styles')),
          h('span', {'aria-hidden': true}, '/'),
          h('span', {className: 'fpb-panel-crumb-current', 'aria-current': 'page'}, styleName)),
        h('p', {className: 'fpb-globals-title'}, styleName),
        h('div', {className: 'fpb-style-name'},
          h('label', null,
            h('span', null, t('Name')),
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
              ? {id: editingStyle.id, name: editingStyle.name || t('Design'), ...style}
              : item)));
          },
        }));
    }

    if (!selectedType) {
      return h('div', {className: 'fpb-globals'},
        h('p', {className: 'fpb-globals-note'}, t('These values apply across all pages. Element settings override them.')),
        h('div', {className: 'fpb-palette-list'}, PALETTE_GROUPS.map((group, index) => h('section', {
          key: group.id,
          className: 'fpb-palette-group',
        },
        index > 0 ? h('hr', {className: 'fpb-palette-rule'}) : null,
        h('h2', null, t(group.label)),
        h('div', {className: 'fpb-palette-items'}, group.items.map((item) => h('button', {
          key: item.type,
          type: 'button',
          className: (defaults[item.type] && Object.keys(defaults[item.type]).length)
            || (item.type === 'button' && styles.length)
            ? 'has-defaults'
            : '',
          onClick: () => onSelectType(item.type),
        }, t(item.label))))))));
    }

    const current = {type: selectedType, ...(defaults[selectedType] || {})};
    const typeLabel = t(PALETTE.find((item) => item.type === selectedType)?.label || selectedType);
    return h('div', {className: 'fpb-globals'},
      h('nav', {className: 'fpb-panel-crumbs', 'aria-label': t('Global styles navigation')},
        h('button', {type: 'button', onClick: () => onSelectType(null)}, t('Global styles')),
        h('span', {'aria-hidden': true}, '/'),
        h('span', {className: 'fpb-panel-crumb-current', 'aria-current': 'page'}, typeLabel)),
      h('p', {className: 'fpb-globals-note'}, t('These values apply across all pages. Element settings override them.')),
      h('p', {className: 'fpb-globals-title'}, typeLabel),
      selectedType === 'button' ? h('div', {className: 'fpb-button-styles'},
        h('div', {className: 'fpb-button-styles-head'},
          h('p', {className: 'fpb-box-title'}, t('Styles')),
          h(C.Button, {
            type: 'button',
            variant: 'secondary',
            onClick: () => {
              const id = buttonStyleId();
              onChangeStyles([...styles, {id, name: t('New style')}]);
              onSelectStyle(id);
            },
          }, t('Add style'))),
        styles.length
          ? h('ul', {className: 'fpb-button-styles-list'}, styles.map((item) => h('li', {key: item.id},
            h('button', {
              type: 'button',
              className: 'fpb-button-style-item',
              onClick: () => onSelectStyle(item.id),
            }, item.name || t('Design')),
            h('button', {
              type: 'button',
              className: 'fpb-button-style-delete',
              'aria-label': t('Delete style'),
              onClick: () => onChangeStyles(styles.filter((style) => style.id !== item.id)),
            }, '×'))))
          : h('p', {className: 'fpb-muted'}, t('No saved styles yet.')),
        h('p', {className: 'fpb-muted'}, t('The settings below apply when a button has no style selected.'))) : null,
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
