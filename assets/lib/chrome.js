import {chromeId} from './model.js';

export function createChromePanel(host) {
  const {React} = host;
  const C = host.components;
  const h = React.createElement;

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
        }, 'Добави')),
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
            'aria-label': 'Изтрий',
            onClick: () => onDelete?.(item),
          }, '×'))))
        : h('p', {className: 'fpb-muted'}, 'Няма записани.'));

    return h('div', {className: 'fpb-globals'},
      h('p', {className: 'fpb-globals-note'}, 'Библиотеката е и в „Съдържание → Шапки и футери“. На страницата ги избирате от полетата Шапка / Футър (или от Настройки).'),
      section('Шапки', 'header', headers),
      section('Футери', 'footer', footers),
      onRefresh ? h('div', {className: 'fpb-inspector-actions'},
        h(C.Button, {type: 'button', variant: 'secondary', onClick: onRefresh}, 'Презареди списъка')) : null);
  };
}

export {chromeId};
