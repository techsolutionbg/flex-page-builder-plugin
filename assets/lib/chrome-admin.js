import {chromeId} from './model.js';
import {createPage as createBuilderPage} from './editor.js';
import {BASE, chromeCreatePath, chromeEditPath, chromeListPath, parseChromePath} from './paths.js';

const KIND_LABEL = {header: 'Шапка', footer: 'Футър'};

export function createPage(host) {
  const {React, request, toast} = host;
  const C = host.components;
  const h = React.createElement;
  const BuilderPage = createBuilderPage(host);

  function ChromeList({navigate}) {
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [failure, setFailure] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [confirm, setConfirm] = React.useState(null);

    async function load() {
      setFailure('');
      const payload = await request(BASE + '/chrome', 'GET');
      setItems(Array.isArray(payload.items) ? payload.items : [
        ...(payload.headers || []),
        ...(payload.footers || []),
      ]);
    }

    React.useEffect(() => {
      let live = true;
      load()
        .catch((error) => { if (live) setFailure(error.message); })
        .finally(() => { if (live) setLoading(false); });
      return () => { live = false; };
    }, []);

    async function remove(item) {
      setBusy(true);
      setFailure('');
      try {
        await request(BASE + '/chrome/' + item.id, 'DELETE');
        toast?.success?.((KIND_LABEL[item.kind] || 'Записът') + ' е изтрит.');
        await load();
      } catch (error) {
        setFailure(error.message);
        toast?.error?.(error.message);
      } finally {
        setBusy(false);
        setConfirm(null);
      }
    }

    const columns = [
      {key: 'name', label: 'Име', render: (row) => row.name || '—'},
      {key: 'kind', label: 'Тип', render: (row) => KIND_LABEL[row.kind] || row.kind},
      {
        key: 'actions',
        label: 'Действия',
        render: (row) => h('div', {className: 'react-table-actions'},
          h(C.Button, {type: 'button', variant: 'secondary', disabled: busy, onClick: () => navigate(chromeEditPath(row.id))}, 'Редактирай'),
          h(C.Button, {type: 'button', variant: 'secondary', disabled: busy, onClick: () => setConfirm(row)}, 'Изтрий')),
      },
    ];

    return h(React.Fragment, null,
      h('div', {className: 'react-page-heading'},
        h('div', null,
          h('h1', null, 'Шапки и футери'),
          h('p', {className: 'fpb-muted'}, 'Създайте дизайн и го изберете от полетата Шапка / Футър на страницата.')),
        h('div', {className: 'react-page-heading-actions'},
          h(C.Button, {type: 'button', onClick: () => navigate(chromeCreatePath())}, 'Добави'))),
      failure ? h('div', {className: 'react-form-error', role: 'alert'}, failure) : null,
      h(C.DataTable, {
        columns,
        data: items,
        rowKey: (row) => row.id,
        loading,
        emptyMessage: 'Няма записани шапки или футери.',
      }),
      h(C.ConfirmDialog, {
        open: Boolean(confirm),
        title: 'Изтриване',
        message: confirm ? 'Изтриване на „' + (confirm.name || KIND_LABEL[confirm.kind]) + '“? Страниците с този избор ще минат към chrome на темата.' : '',
        confirmLabel: 'Изтрий',
        onConfirm: () => confirm && remove(confirm),
        onCancel: () => setConfirm(null),
      }));
  }

  function ChromeCreate({navigate}) {
    const [kind, setKind] = React.useState('header');
    const [name, setName] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [failure, setFailure] = React.useState('');
    const changed = host.useWorkspaceChanged?.();
    const saved = host.useWorkspaceSaved?.();

    async function submit(event) {
      event.preventDefault();
      setBusy(true);
      setFailure('');
      try {
        const id = chromeId();
        const label = name.trim() || (kind === 'footer' ? 'Нов футър' : 'Нова шапка');
        await request(BASE + '/chrome/' + id, 'PUT', {kind, name: label, elements: []});
        saved?.();
        toast?.success?.(KIND_LABEL[kind] + ' е създаден(а).');
        navigate(chromeEditPath(id));
      } catch (error) {
        setFailure(error.message);
        toast?.error?.(error.message);
      } finally {
        setBusy(false);
      }
    }

    return h(React.Fragment, null,
      h('div', {className: 'react-page-heading'},
        h('div', null,
          h('h1', null, 'Нова шапка или футър'),
          h('p', {className: 'fpb-muted'}, 'Изберете типа, после отворете редактора за дизайна.')),
        h('div', {className: 'react-page-heading-actions'},
          h(C.Button, {type: 'button', variant: 'secondary', onClick: () => navigate(chromeListPath())}, 'Назад'))),
      failure ? h('div', {className: 'react-form-error', role: 'alert'}, failure) : null,
      h('form', {className: 'react-page-form', onSubmit: submit},
        h('section', {className: 'page-editor-basic-panel'},
          h('div', {className: 'page-editor-basic-panel-body'},
            h('div', {className: 'react-form-grid'},
              h('label', {className: 'react-form-field'},
                h('span', null, 'Тип *'),
                h('select', {
                  value: kind,
                  onChange: (event) => { setKind(event.target.value); changed?.(); },
                },
                  h('option', {value: 'header'}, 'Шапка (header)'),
                  h('option', {value: 'footer'}, 'Футър (footer)'))),
              h('label', {className: 'react-form-field'},
                h('span', null, 'Име'),
                h(C.Input, {
                  value: name,
                  placeholder: kind === 'footer' ? 'Нов футър' : 'Нова шапка',
                  onChange: (event) => { setName(event.target.value); changed?.(); },
                }))))),
        h('div', {className: 'react-form-actions'},
          h(C.LoadingButton, {type: 'submit', loading: busy}, 'Създай и редактирай'))));
  }

  return function ChromeAdminPage({path, navigate}) {
    const route = parseChromePath(path);
    if (route.view === 'create') {
      return h(ChromeCreate, {navigate});
    }
    if (route.view === 'edit' && route.id) {
      return h(BuilderPage, {path, navigate});
    }
    return h(ChromeList, {navigate});
  };
}
