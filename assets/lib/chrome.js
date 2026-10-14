import {chromeId} from './model.js';

export function createChromePanel(host) {
  const {React} = host;
  const C = host.components;
  const h = React.createElement;
  const t = host.i18n.t;

  return function ChromePanel({
    headers = [],
    footers = [],
    onRefresh,
    onEdit,
    onCreate,
    onDelete,
  }) {
    const section = (title, kind, items) => h('section', {key: kind, className: 'fpb-button-styles'},
      h('div', {className: 'fpb-button-styles-head'},
        h('p', {className: 'fpb-box-title'}, title),
        h(C.Button, {
          type: 'button',
          variant: 'secondary',
          onClick: () => onCreate?.(kind),
        }, t('Add'))),
      items.length
        ? h('ul', {className: 'fpb-button-styles-list'}, items.map((item) => h('li', {key: item.id},
          h('button', {
            type: 'button',
            className: 'fpb-button-style-item',
            onClick: () => onEdit?.(item),
          }, item.name || title),
          h('button', {
            type: 'button',
            className: 'fpb-button-style-delete',
            'aria-label': t('Delete'),
            onClick: () => onDelete?.(item),
          }, '×'))))
        : h('p', {className: 'fpb-muted'}, t('Nothing saved yet.')));

    return h('div', {className: 'fpb-globals'},
      h('p', {className: 'fpb-globals-note'}, t('Manage this library under “Content → Headers & Footers”. Choose a Header or Footer on the page or in its settings.')),
      section(t('Headers'), 'header', headers),
      section(t('Footers'), 'footer', footers),
      onRefresh ? h('div', {className: 'fpb-inspector-actions'},
        h(C.Button, {type: 'button', variant: 'secondary', onClick: onRefresh}, t('Refresh list'))) : null);
  };
}

export {chromeId};
