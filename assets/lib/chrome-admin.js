import {chromeId} from './model.js';
import {createPage as createBuilderPage} from './editor.js';
import {BASE, chromeCreatePath, chromeEditPath, chromeListPath, parseChromePath} from './paths.js';

const KIND_LABEL = {header: 'Header', footer: 'Footer'};

export function createPage(host) {
  const {React, request, toast} = host;
  const C = host.components;
  const h = React.createElement;
  const t = host.i18n.t;
  const BuilderPage = createBuilderPage(host);

  function ChromeList({navigate}) {
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [failure, setFailure] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [confirm, setConfirm] = React.useState(null);
    const [search, setSearch] = React.useState('');
    const [kindFilter, setKindFilter] = React.useState('all');
    const [viewFilter, setViewFilter] = React.useState('active');

    async function load(view = viewFilter) {
      setFailure('');
      const payload = await request(BASE + '/chrome?view=' + encodeURIComponent(view), 'GET');
      setItems(Array.isArray(payload.items) ? payload.items : [
        ...(payload.headers || []),
        ...(payload.footers || []),
      ]);
    }

    React.useEffect(() => {
      let live = true;
      setLoading(true);
      load(viewFilter)
        .catch((error) => { if (live) setFailure(t(error.message)); })
        .finally(() => { if (live) setLoading(false); });
      return () => { live = false; };
    }, [viewFilter]);

    async function restore(item) {
      setBusy(true);
      setFailure('');
      try {
        await request(BASE + '/chrome/' + encodeURIComponent(item.id) + '/restore', 'POST', {});
        toast?.success?.(t('{kind} restored.', {kind: t(KIND_LABEL[item.kind] || 'Record')}));
        await load('trash');
      } catch (error) {
        setFailure(t(error.message));
        toast?.error?.(t(error.message));
      } finally {
        setBusy(false);
      }
    }

    async function confirmAction() {
      if (!confirm || busy) return;
      setBusy(true);
      setFailure('');
      try {
        const suffix = confirm.action === 'force' ? '/force' : '';
        await request(BASE + '/chrome/' + encodeURIComponent(confirm.item.id) + suffix, 'DELETE');
        toast?.success?.(t(confirm.action === 'force' ? 'Record permanently deleted.' : 'Record moved to the trash.'));
        await load(viewFilter);
      } catch (error) {
        setFailure(t(error.message));
        toast?.error?.(t(error.message));
      } finally {
        setBusy(false);
        setConfirm(null);
      }
    }

    const visibleItems = items.filter((item) =>
      (item.name || '').toLocaleLowerCase('bg').includes(search.trim().toLocaleLowerCase('bg'))
      && (kindFilter === 'all' || item.kind === kindFilter));

    const columns = [
      {key: 'name', label: t('Name'), sortable: true, render: (row) => viewFilter === 'active'
        ? h('button', {type: 'button', className: 'react-table-link', onClick: () => navigate(chromeEditPath(row.id)), 'aria-label': t('Open the builder for {name}', {name: row.name || t(KIND_LABEL[row.kind])})}, row.name || '—')
        : row.name || '—'},
      {key: 'kind', label: t('Type'), sortable: true, render: (row) => t(KIND_LABEL[row.kind] || row.kind)},
      {
        key: 'actions',
        label: t('Actions'),
        render: (row) => h(C.TableActionsMenu, null,
          viewFilter === 'active'
            ? h(React.Fragment, null,
              h(C.DropdownOption, {disabled: busy, onClick: () => navigate(chromeEditPath(row.id))}, t('Edit')),
              h(C.DropdownOption, {disabled: busy, onClick: () => setConfirm({action: 'trash', item: row})}, t('Move to trash')))
            : h(React.Fragment, null,
              h(C.DropdownOption, {disabled: busy, onClick: () => restore(row)}, t('Restore')),
              h(C.DropdownOption, {disabled: busy, onClick: () => setConfirm({action: 'force', item: row})}, t('Delete permanently')))),
      },
    ];

    return h(React.Fragment, null,
      h('div', {className: 'react-page-heading'},
        h('div', null,
          h('h1', null, t(viewFilter === 'trash' ? 'Trash' : 'Headers & Footers')),
          h('p', {className: 'fpb-muted'}, t(viewFilter === 'trash' ? 'Restore records or permanently delete them.' : 'Create a design and select it in the page Header or Footer settings.'))),
        h('div', {className: 'react-page-heading-actions'},
          viewFilter === 'active' ? h(C.Button, {type: 'button', onClick: () => navigate(chromeCreatePath())}, t('Add')) : null)),
      failure ? h('div', {className: 'react-form-error', role: 'alert'}, failure) : null,
      h(C.DataTable, {
        columns,
        data: visibleItems,
        rowKey: (row) => row.id,
        loading,
        filterStorageKey: 'page-builder-chrome',
        emptyMessage: failure
          ? t('Headers & Footers could not be loaded.')
          : search || kindFilter !== 'all'
            ? t('No headers or footers match these filters.')
            : viewFilter === 'trash' ? t('The trash is empty.') : t('No headers or footers have been created yet.'),
        toolbar: h(React.Fragment, null,
          h('label', {className: 'react-filter-field'},
            h('span', null, t('Search')),
            h('input', {value: search, placeholder: t('Name'), onChange: (event) => setSearch(event.target.value)})),
          h('label', {className: 'react-filter-field'},
            h('span', null, t('Type')),
            h(C.DropdownMenu, {
              ariaLabel: t('Filter by Header or Footer'),
              triggerClassName: 'react-filter-trigger',
              trigger: h(React.Fragment, null,
                h('span', null, kindFilter === 'all' ? t('All') : t(KIND_LABEL[kindFilter])),
                h(C.DropdownChevron)),
            },
              h(C.DropdownOption, {selected: kindFilter === 'all', onClick: () => setKindFilter('all')}, t('All')),
              h(C.DropdownOption, {selected: kindFilter === 'header', onClick: () => setKindFilter('header')}, t('Headers')),
              h(C.DropdownOption, {selected: kindFilter === 'footer', onClick: () => setKindFilter('footer')}, t('Footers')))),
          h('label', {className: 'react-filter-field'},
            h('span', null, t('View')),
            h(C.DropdownMenu, {
              ariaLabel: t('Library view'),
              triggerClassName: 'react-filter-trigger',
              trigger: h(React.Fragment, null,
                h('span', null, viewFilter === 'trash' ? t('Trash') : t('Active')),
                h(C.DropdownChevron)),
            },
              h(C.DropdownOption, {selected: viewFilter === 'active', onClick: () => setViewFilter('active')}, t('Active')),
              h(C.DropdownOption, {selected: viewFilter === 'trash', onClick: () => setViewFilter('trash')}, t('Trash'))))),
      }),
      h(C.ConfirmDialog, {
        open: Boolean(confirm),
        title: t(confirm?.action === 'force' ? 'Delete permanently' : 'Move to trash'),
        message: confirm
          ? confirm.action === 'force'
            ? t('“{name}” will be permanently deleted. Linked pages will use the theme Header and Footer.', {name: confirm.item.name || t(KIND_LABEL[confirm.item.kind])})
            : t('“{name}” will be moved to the trash. Linked pages will temporarily use the theme Header and Footer.', {name: confirm.item.name || t(KIND_LABEL[confirm.item.kind])})
          : '',
        confirmLabel: t(confirm?.action === 'force' ? 'Delete permanently' : 'Move to trash'),
        danger: true,
        busy,
        onConfirm: confirmAction,
        onCancel: () => { if (!busy) setConfirm(null); },
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
        const label = name.trim() || t(kind === 'footer' ? 'New Footer' : 'New Header');
        await request(BASE + '/chrome/' + id, 'PUT', {kind, name: label, elements: []});
        saved?.();
        toast?.success?.(t('{kind} created.', {kind: t(KIND_LABEL[kind])}));
        navigate(chromeEditPath(id));
      } catch (error) {
        setFailure(t(error.message));
        toast?.error?.(t(error.message));
      } finally {
        setBusy(false);
      }
    }

    return h(React.Fragment, null,
      h('div', {className: 'react-page-heading'},
        h('div', null,
          h('h1', null, t('New Header or Footer')),
          h('p', {className: 'fpb-muted'}, t('Choose a type, then open the design editor.'))),
        h('div', {className: 'react-page-heading-actions'},
          h(C.Button, {type: 'button', variant: 'secondary', onClick: () => navigate(chromeListPath())}, t('Back')))),
      failure ? h('div', {className: 'react-form-error', role: 'alert'}, failure) : null,
      h('form', {className: 'react-page-form', onSubmit: submit},
        h('section', {className: 'page-editor-basic-panel'},
          h('div', {className: 'page-editor-basic-panel-body'},
            h('div', {className: 'react-form-grid'},
              h('label', {className: 'react-form-field'},
                h('span', null, t('Type *')),
                h('select', {
                  value: kind,
                  onChange: (event) => { setKind(event.target.value); changed?.(); },
                },
                  h('option', {value: 'header'}, 'Header'),
                  h('option', {value: 'footer'}, 'Footer'))),
              h('label', {className: 'react-form-field'},
                h('span', null, t('Name')),
                h(C.Input, {
                  value: name,
                  placeholder: t(kind === 'footer' ? 'New Footer' : 'New Header'),
                  onChange: (event) => { setName(event.target.value); changed?.(); },
                }))))),
        h('div', {className: 'react-form-actions'},
          h(C.LoadingButton, {type: 'submit', loading: busy}, t('Create and edit')))));
  }

  return function ChromeAdminPage({path, navigate}) {
    host.i18n.useLocale();
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
