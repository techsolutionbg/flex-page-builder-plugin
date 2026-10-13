export const BASE = '/admin/plugins/flex/page-builder';

export function editorPath(id) {
  return '/extension-pages/flex-page-builder-editor/' + id + '/edit';
}

export function parsePath(path) {
  const match = /^\/extension-pages\/flex-page-builder-editor\/([1-9][0-9]{0,9})\/edit$/.exec(String(path ?? ''));
  return match ? Number(match[1]) : null;
}
