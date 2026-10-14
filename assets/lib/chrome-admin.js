import {chromeId} from './model.js';
import {createPage as createBuilderPage} from './editor.js';
import {BASE, chromeCreatePath, chromeEditPath, chromeListPath, parseChromePath} from './paths.js';

const KIND_LABEL = {header: 'Header', footer: 'Footer'};

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
        .catch((error) => { if (live) setFailure(error.message); })
        .finally(() => { if (live) setLoading(false); });
      return () => { live = false; };
    }, [viewFilter]);

    async function restore(item) {
      setBusy(true);
      setFailure('');
      try {
        await request(BASE + '/chrome/' + encodeURIComponent(item.id) + '/restore', 'POST', {});
        toast?.success?.((KIND_LABEL[item.kind] || 'Записът') + ' е възстановен.');
        await load('trash');
      } catch (error) {
        setFailure(error.message);
        toast?.error?.(error.message);
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
        toast?.success?.(confirm.action === 'force' ? 'Записът е изтрит завинаги.' : 'Записът е преместен в кошчето.');
        await load(viewFilter);
      } catch (error) {
        setFailure(error.message);
        toast?.error?.(error.message);
      } finally {
        setBusy(false);
        setConfirm(null);
      }
    }

    const visibleItems = items.filter((item) =>
      (item.name || '').toLocaleLowerCase('bg').includes(search.trim().toLocaleLowerCase('bg'))
      && (kindFilter === 'all' || item.kind === kindFilter));

    const columns = [
      {key: 'name', label: 'Име', sortable: true, render: (row) => row.name || '—'},
      {key: 'kind', label: 'Тип', sortable: true, render: (row) => KIND_LABEL[row.kind] || row.kind},
      {
        key: 'actions',
        label: 'Действия',
        render: (row) => h(C.TableActionsMenu, null,
          viewFilter === 'active'
            ? h(React.Fragment, null,
              h(C.DropdownOption, {disabled: busy, onClick: () => navigate(chromeEditPath(row.id))}, 'Редактирай'),
              h(C.DropdownOption, {disabled: busy, onClick: () => setConfirm({action: 'trash', item: row})}, 'Премести в кошчето'))
            : h(React.Fragment, null,
              h(C.DropdownOption, {disabled: busy, onClick: () => restore(row)}, 'Възстанови'),
              h(C.DropdownOption, {disabled: busy, onClick: () => setConfirm({action: 'force', item: row})}, 'Изтрий завинаги'))),
      },
    ];

    return h(React.Fragment, null,
      h('div', {className: 'react-page-heading'},
        h('div', null,
          h('h1', null, viewFilter === 'trash' ? 'Кошче' : 'Headers & Footers'),
          h('p', {className: 'fpb-muted'}, viewFilter === 'trash' ? 'Възстановете записи или ги изтрийте завинаги.' : 'Създайте дизайн и го изберете от полетата Header / Footer на страницата.')),
        h('div', {className: 'react-page-heading-actions'},
          viewFilter === 'active' ? h(C.Button, {type: 'button', onClick: () => navigate(chromeCreatePath())}, 'Добави') : null)),
      failure ? h('div', {className: 'react-form-error', role: 'alert'}, failure) : null,
      h(C.DataTable, {
        columns,
        data: visibleItems,
        rowKey: (row) => row.id,
        loading,
        filterStorageKey: 'page-builder-chrome',
        emptyMessage: failure
          ? 'Headers & Footers не са заредени.'
          : search || kindFilter !== 'all'
            ? 'Няма headers или footers, отговарящи на филтрите.'
            : viewFilter === 'trash' ? 'Кошчето е празно.' : 'Няма записани headers или footers.',
        toolbar: h(React.Fragment, null,
          h('label', {className: 'react-filter-field'},
            h('span', null, 'Търсене'),
            h('input', {value: search, placeholder: 'Име', onChange: (event) => setSearch(event.target.value)})),
          h('label', {className: 'react-filter-field'},
            h('span', null, 'Тип'),
            h(C.DropdownMenu, {
              ariaLabel: 'Тип Header или Footer',
              triggerClassName: 'react-filter-trigger',
              trigger: h(React.Fragment, null,
                h('span', null, kindFilter === 'all' ? 'Всички' : KIND_LABEL[kindFilter]),
                h(C.DropdownChevron)),
            },
              h(C.DropdownOption, {selected: kindFilter === 'all', onClick: () => setKindFilter('all')}, 'Всички'),
              h(C.DropdownOption, {selected: kindFilter === 'header', onClick: () => setKindFilter('header')}, 'Headers'),
              h(C.DropdownOption, {selected: kindFilter === 'footer', onClick: () => setKindFilter('footer')}, 'Footers'))),
          h('label', {className: 'react-filter-field'},
            h('span', null, 'Изглед'),
            h(C.DropdownMenu, {
              ariaLabel: 'Изглед на библиотеката',
              triggerClassName: 'react-filter-trigger',
              trigger: h(React.Fragment, null,
                h('span', null, viewFilter === 'trash' ? 'Кошче' : 'Активни'),
                h(C.DropdownChevron)),
            },
              h(C.DropdownOption, {selected: viewFilter === 'active', onClick: () => setViewFilter('active')}, 'Активни'),
              h(C.DropdownOption, {selected: viewFilter === 'trash', onClick: () => setViewFilter('trash')}, 'Кошче')))),
      }),
      h(C.ConfirmDialog, {
        open: Boolean(confirm),
        title: confirm?.action === 'force' ? 'Окончателно изтриване' : 'Преместване в кошчето',
        message: confirm
          ? confirm.action === 'force'
            ? '„' + (confirm.item.name || KIND_LABEL[confirm.item.kind]) + '“ ще бъде изтрит завинаги. Свързаните страници ще използват Header/Footer от темата.'
            : '„' + (confirm.item.name || KIND_LABEL[confirm.item.kind]) + '“ ще бъде преместен в кошчето. Свързаните страници временно ще използват Header/Footer от темата.'
          : '',
        confirmLabel: confirm?.action === 'force' ? 'Изтрий завинаги' : 'В кошчето',
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
        const label = name.trim() || (kind === 'footer' ? 'Нов Footer' : 'Нов Header');
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
          h('h1', null, 'Нов Header или Footer'),
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
                  h('option', {value: 'header'}, 'Header'),
                  h('option', {value: 'footer'}, 'Footer'))),
              h('label', {className: 'react-form-field'},
                h('span', null, 'Име'),
                h(C.Input, {
                  value: name,
                  placeholder: kind === 'footer' ? 'Нов Footer' : 'Нов Header',
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
