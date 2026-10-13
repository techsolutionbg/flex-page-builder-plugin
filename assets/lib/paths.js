export const BASE = '/admin/plugins/flex/page-builder';

export const CHROME_BASE = '/extension-pages/flex-page-builder-chrome';

export function editorPath(id) {
  return '/extension-pages/flex-page-builder-editor/' + id + '/edit';
}

export function chromeListPath() {
  return CHROME_BASE;
}

export function chromeCreatePath() {
  return CHROME_BASE + '/create';
}

export function chromeEditPath(id) {
  return CHROME_BASE + '/' + id + '/edit';
}

export function parsePath(path) {
  const match = /^\/extension-pages\/flex-page-builder-editor\/([1-9][0-9]{0,9})\/edit$/.exec(String(path ?? ''));
  return match ? Number(match[1]) : null;
}

export function parseChromePath(path) {
  const value = String(path ?? '');
  if (value === CHROME_BASE || value === CHROME_BASE + '/') {
    return {view: 'list'};
  }
  if (value === CHROME_BASE + '/create') {
    return {view: 'create'};
  }
  const match = /^\/extension-pages\/flex-page-builder-chrome\/(ch_[a-z0-9]{8})\/edit$/.exec(value);
  return match ? {view: 'edit', id: match[1]} : {view: 'list'};
}
