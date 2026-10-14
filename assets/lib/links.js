import {editorPath} from './paths.js';

export function createPageAction() {
  return {
    label: 'Open in Page Builder',
    contentBuilder: 'flex/page-builder',
    onSelect(row, helpers) {
      if (row?.id) helpers?.navigate?.(editorPath(row.id));
    },
    visible: (row) => !row?.deleted_at,
  };
}

export function createEditorLink(host) {
  const h = host.React.createElement;
  const C = host.components;
  const t = host.i18n.t;
  return function PageBuilderLink({context, navigate}) {
    host.i18n.useLocale();
    const id = Number(context?.id);
    if (context?.type !== 'page' || !Number.isInteger(id) || id < 1) return null;
    return h(C.Button, {type: 'button', variant: 'secondary', onClick: () => navigate?.(editorPath(id))}, t('Open in Page Builder'));
  };
}
