import {createCanvas} from './canvas.js';
import {compile} from './compile.js';
import {createGlobalsPanel} from './globals.js';
import {createInspector} from './inspector.js';
import {
  blank,
  crumbName,
  eachElement,
  elementPath,
  findElement,
  insertInto,
  locate,
  PALETTE,
  PALETTE_GROUPS,
  panelOpen,
  patchElement,
  place,
  rememberPanel,
  removeElement,
  replaceElement,
  resizeColumns,
  WIDTHS,
} from './model.js';
import {BASE, parsePath} from './paths.js';
import {createStructureTree} from './structure.js';

export function createPage(host) {
  const {React, request, toast} = host;
  const C = host.components;
  const h = React.createElement;
  const Canvas = createCanvas(host);
  const Inspector = createInspector(host);
  const GlobalsPanel = createGlobalsPanel(host);
  const StructureTree = createStructureTree(host);
  const stylesheet = new URL('../builder.css', import.meta.url).href;

  function Editor({id, navigate}) {
    const [data, setData] = React.useState(null);
    const [elements, setElements] = React.useState([]);
    const [layout, setLayout] = React.useState('');
    const [selected, setSelected] = React.useState(null);
    const [frameHtml, setFrameHtml] = React.useState('');
    const [device, setDevice] = React.useState('desktop');
    const [failure, setFailure] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [conflict, setConflict] = React.useState(false);
    const [media, setMedia] = React.useState({});
    const [defaults, setDefaults] = React.useState({});
    const [leftTab, setLeftTab] = React.useState('elements');
    const [globalType, setGlobalType] = React.useState(null);
    const [panels, setPanels] = React.useState(() => ({palette: panelOpen('palette'), side: panelOpen('side')}));
    const changed = host.useWorkspaceChanged?.();
    const saved = host.useWorkspaceSaved?.();
    const baseHash = React.useRef('');
    const requestedMedia = React.useRef(new Set());
    const saveRef = React.useRef(() => {});
    const dragKind = React.useRef('');

    React.useEffect(() => {
      const abort = new AbortController();
      setFailure('');
      request(BASE + '/pages/' + id, 'GET', undefined, abort.signal)
        .then((payload) => {
          setData(payload);
          setElements(Array.isArray(payload.elements) ? payload.elements : []);
          setDefaults(payload.defaults && typeof payload.defaults === 'object' ? payload.defaults : {});
          setLayout(payload.page?.layout || payload.layouts?.[0]?.id || 'default');
          baseHash.current = payload.base_hash || '';
          setSelected(null);
        })
        .catch((error) => {
          if (!abort.signal.aborted) setFailure(error.message);
        });
      return () => abort.abort();
    }, [id]);

    React.useEffect(() => {
      if (!layout) return undefined;
      const abort = new AbortController();
      fetch(BASE + '/pages/' + id + '/frame?template=' + encodeURIComponent(layout), {credentials: 'include', cache: 'no-store', signal: abort.signal, headers: {Accept: 'text/html'}})
        .then((response) => response.ok ? response.text() : Promise.reject(new Error('Лейаутът не може да бъде показан.')))
        .then(setFrameHtml)
        .catch((error) => {
          if (error.name !== 'AbortError') setFailure(error.message);
        });
      return () => abort.abort();
    }, [id, layout]);

    React.useEffect(() => {
      const ids = [];
      eachElement(elements, (element) => {
        if (element.type === 'image' && element.media_id) ids.push(element.media_id);
        if (element.type === 'section' && element.wallpaper_id) ids.push(element.wallpaper_id);
      });
      if (defaults.section?.wallpaper_id) ids.push(defaults.section.wallpaper_id);
      ids.forEach((mediaId) => {
        if (!mediaId || requestedMedia.current.has(mediaId)) return;
        requestedMedia.current.add(mediaId);
        request('/api/admin/media/' + mediaId)
          .then((record) => setMedia((latest) => ({...latest, [mediaId]: record.url || record.thumbnail_url || ''})))
          .catch(() => setMedia((latest) => ({...latest, [mediaId]: ''})));
      });
    }, [elements, defaults]);

    function mark(next) {
      setElements(next);
      changed?.();
    }

    function insert(type, index, parentId) {
      if (!PALETTE.some((item) => item.type === type)) return;
      const element = blank(type);
      let parent = type === 'section' ? null : (parentId || null);
      let at = index;
      if (!Number.isInteger(at)) {
        const located = selected ? locate(elements, selected) : null;
        const current = located ? located.list[located.index] : null;
        if (type === 'section') {
          parent = null;
          at = located && !located.parentId ? located.index + 1 : elements.length;
        } else if (type === 'columns') {
          if (current?.type === 'section') {
            parent = current.id;
            at = (current.children || []).length;
          } else if (current?.type === 'column') {
            const row = locate(elements, located.parentId);
            parent = row?.parentId || null;
            at = row ? row.index + 1 : elements.length;
          } else if (current?.type === 'columns') {
            parent = located.parentId;
            at = located.index + 1;
          } else if (located) {
            parent = located.parentId;
            at = located.index + 1;
          } else {
            parent = null;
            at = elements.length;
          }
        } else if (current?.type === 'section' || current?.type === 'column') {
          parent = current.id;
          at = (current.children || []).length;
        } else if (current?.type === 'columns') {
          parent = (current.children[0] || {}).id || located.parentId;
          at = current.children[0] ? (current.children[0].children || []).length : located.index + 1;
        } else if (located) {
          parent = located.parentId;
          at = located.index + 1;
        } else {
          const lastSection = type === 'columns' ? [...elements].reverse().find((item) => item.type === 'section') : null;
          if (lastSection) {
            parent = lastSection.id;
            at = (lastSection.children || []).length;
          } else {
            parent = null;
            at = elements.length;
          }
        }
      }
      mark(insertInto(elements, element, parent, at));
      setSelected(element.id);
    }

    function addColumns(count) {
      const current = findElement(elements, selected);
      if (!current || current.type !== 'section') return;
      const row = resizeColumns(blank('columns'), count);
      mark(insertInto(elements, row, current.id, (current.children || []).length));
      setSelected(row.id);
    }

    function reorder(id, index, parentId) {
      const next = place(elements, id, parentId, index);
      if (next === elements) return;
      mark(next);
      setSelected(id);
    }

    function update(next) {
      mark(replaceElement(elements, next));
    }

    function editText(id, patch) {
      mark(patchElement(elements, id, patch));
    }

    function remove() {
      mark(removeElement(elements, selected));
      setSelected(null);
    }

    function togglePanel(key) {
      setPanels((latest) => {
        const next = {...latest, [key]: !latest[key]};
        rememberPanel(key, next[key]);
        return next;
      });
    }

    function panelToggle(key, hide, show) {
      const open = panels[key];
      const left = key === 'palette' ? open : !open;
      return h('button', {type: 'button', className: 'fpb-panel-toggle', 'aria-expanded': open, 'aria-label': open ? hide : show, onClick: () => togglePanel(key)},
        h('svg', {viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': 'true'},
          h('path', {d: left ? 'M14.5 6.5 8.5 12l6 5.5' : 'M9.5 6.5 15.5 12l-6 5.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round'})));
    }

    function move(step) {
      const located = locate(elements, selected);
      if (!located) return;
      const next = place(elements, selected, located.parentId, located.index + (step > 0 ? step + 1 : step));
      if (next !== elements) mark(next);
    }

    async function save(force) {
      setSaving(true);
      setFailure('');
      try {
        const payload = await request(BASE + '/pages/' + id, 'PUT', {elements, defaults, layout, base_hash: baseHash.current, force: force === true});
        setData(payload);
        setElements(Array.isArray(payload.elements) ? payload.elements : []);
        setDefaults(payload.defaults && typeof payload.defaults === 'object' ? payload.defaults : defaults);
        baseHash.current = payload.base_hash || '';
        setConflict(false);
        saved?.();
        toast?.success?.('Страницата е записана.');
      } catch (error) {
        if (String(error.message).includes('променена на друго място')) setConflict(true);
        else setFailure(error.message);
      } finally {
        setSaving(false);
      }
    }

    saveRef.current = () => save(false);
    React.useEffect(() => {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      function onKey(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          saveRef.current();
        }
      }
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = previous;
        window.removeEventListener('keydown', onKey);
      };
    }, []);

    if (!data && !failure) return h('div', {className: 'fpb-screen'}, h('p', {className: 'fpb-muted fpb-loading'}, 'Зареждане…'));
    if (!data) {
      return h('div', {className: 'fpb-screen'},
        h('div', {className: 'fpb-toolbar'}, h(C.Button, {type: 'button', variant: 'secondary', onClick: () => navigate('/pages')}, 'Затвори')),
        h('div', {className: 'react-form-error', role: 'alert'}, failure));
    }

    const current = findElement(elements, selected);
    const width = WIDTHS.find((item) => item.id === device)?.width || '100%';
    return h('div', {className: 'fpb-screen'},
      h('header', {className: 'fpb-toolbar'},
        h(C.Button, {type: 'button', variant: 'secondary', onClick: () => navigate('/pages/' + id + '/edit')}, 'Затвори'),
        h('div', {className: 'fpb-toolbar-title'},
          h('h1', null, data.page.title),
          h('p', null, 'Page Builder')),
        h('label', {className: 'fpb-layout'},
          h('span', null, 'Лейаут'),
          h('select', {value: layout, onChange: (event) => { setLayout(event.target.value); changed?.(); }},
            (data.layouts || []).map((item) => h('option', {key: item.id, value: item.id}, item.label)))),
        h('div', {className: 'fpb-devices', role: 'group', 'aria-label': 'Ширина на прегледа'},
          WIDTHS.map((item) => h('button', {key: item.id, type: 'button', className: item.id === device ? 'is-active' : '', onClick: () => setDevice(item.id)}, item.label))),
        h(C.LoadingButton, {type: 'button', loading: saving, onClick: () => save(false)}, 'Запази')),
      failure ? h('div', {className: 'react-form-error', role: 'alert'}, failure) : null,
      data.state === 'changed' ? h('div', {className: 'fpb-notice', role: 'status'}, 'Съдържанието е променено извън Page Builder. Записът ще го замести със сглобените елементи.') : null,
      h('div', {className: 'fpb-workspace' + (panels.palette ? '' : ' is-palette-closed') + (panels.side ? '' : ' is-side-closed')},
        h('aside', {className: 'fpb-palette' + (panels.palette ? '' : ' is-closed')},
          h('div', {className: 'fpb-panel-head'}, h('p', null, current ? 'Настройки' : (leftTab === 'globals' ? 'Глобални' : 'Елементи')), panelToggle('palette', current ? 'Скрий настройките' : 'Скрий панела', current ? 'Покажи настройките' : 'Покажи панела')),
          panels.palette && !current ? h('div', {className: 'fpb-tabs', role: 'tablist', 'aria-label': 'Ляв панел'},
            h('button', {type: 'button', role: 'tab', 'aria-selected': leftTab === 'elements', className: leftTab === 'elements' ? 'is-active' : '', onClick: () => setLeftTab('elements')}, 'Елементи'),
            h('button', {type: 'button', role: 'tab', 'aria-selected': leftTab === 'globals', className: leftTab === 'globals' ? 'is-active' : '', onClick: () => { setLeftTab('globals'); setGlobalType(null); }}, 'Глобални')) : null,
          panels.palette ? h('hr', {className: 'fpb-panel-rule'}) : null,
          panels.palette ? (current
            ? h(Inspector, {element: current, onChange: update, onRemove: remove, onMove: move, onAddColumns: addColumns})
            : leftTab === 'globals'
              ? h(GlobalsPanel, {defaults, selectedType: globalType, onSelectType: setGlobalType, onChange: (next) => { setDefaults(next); changed?.(); }})
              : h('div', {className: 'fpb-palette-list'}, PALETTE_GROUPS.map((group, index) => h('section', {key: group.id, className: 'fpb-palette-group'},
                index > 0 ? h('hr', {className: 'fpb-palette-rule'}) : null,
                h('h2', null, group.label),
                h('div', {className: 'fpb-palette-items'}, group.items.map((item) => h('button', {
                  key: item.type,
                  type: 'button',
                  draggable: true,
                  onDragStart: (event) => {
                    dragKind.current = item.type;
                    event.dataTransfer?.setData('application/x-fpb', item.type);
                    event.dataTransfer?.setData('text/plain', item.type);
                  },
                  onDragEnd: () => { dragKind.current = ''; },
                  onClick: () => insert(item.type),
                }, item.label))))))) : null),
        h('div', {className: 'fpb-canvas'},
          h('div', {className: 'fpb-stage', style: {width}},
            h(Canvas, {frameHtml, markup: compile(elements, selected, media, defaults), selected, onSelect: (id) => { setSelected(id); if (id) setLeftTab('elements'); }, onInsert: insert, onMove: reorder, onText: editText, dragKind}))),
        h('aside', {className: 'fpb-side' + (panels.side ? '' : ' is-closed')},
          h('div', {className: 'fpb-panel-head'}, h('p', null, 'Структура'), panelToggle('side', 'Скрий структурата', 'Покажи структурата')),
          panels.side ? h('hr', {className: 'fpb-panel-rule'}) : null,
          panels.side ? (elements.length ? h(StructureTree, {elements, selected, onSelect: setSelected, onMove: reorder}) : h('p', {className: 'fpb-muted'}, 'Няма елементи')) : null)),
      h('footer', {className: 'fpb-path'},
        h('nav', {className: 'fpb-crumbs', 'aria-label': 'Вложеност'},
          h('button', {type: 'button', className: selected ? '' : 'is-active', onClick: () => setSelected(null)}, 'Страница'),
          elementPath(elements, selected).flatMap((element, index, trail) => [
            h('span', {key: 'sep-' + element.id, 'aria-hidden': true}, '/'),
            h('button', {key: element.id, type: 'button', className: element.id === selected ? 'is-active' : '', onClick: () => setSelected(element.id)}, crumbName(element, trail)),
          ]))),
      h(C.ConfirmDialog, {
        open: conflict,
        title: 'Страницата е променена',
        message: 'Някой е записал страницата, след като я отворихте. Записът върху промените замества това съдържание.',
        confirmLabel: 'Запиши върху',
        onConfirm: () => save(true),
        onCancel: () => setConflict(false),
      }));
  }

  return function PageBuilderPage({path, navigate}) {
    const id = parsePath(path);
    if (!id) {
      return h('div', {className: 'fpb-intro'},
        h('h1', null, 'Page Builder'),
        h('p', null, 'Отворете страница от „Действия“ → „Отвори в Page Builder“.'),
        h(C.Button, {type: 'button', variant: 'secondary', onClick: () => navigate('/pages')}, 'Към страниците'));
    }
    return h(React.Fragment, null,
      h('link', {rel: 'stylesheet', href: stylesheet}),
      h(Editor, {id, navigate}));
  };
}
