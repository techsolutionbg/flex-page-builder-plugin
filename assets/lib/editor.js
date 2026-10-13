import {createCanvas} from './canvas.js';
import {chromeId, createChromePanel} from './chrome.js';
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
  sectionHolder,
  WIDTHS,
} from './model.js';
import {BASE, chromeListPath, parseChromePath, parsePath} from './paths.js';
import {createStructureTree} from './structure.js';

export function createPage(host) {
  const {React, request, toast} = host;
  const C = host.components;
  const h = React.createElement;
  const Canvas = createCanvas(host);
  const Inspector = createInspector(host);
  const GlobalsPanel = createGlobalsPanel(host);
  const ChromePanel = createChromePanel(host);
  const StructureTree = createStructureTree(host);
  const stylesheet = new URL('../builder.css', import.meta.url).href;
  const patternsStylesheet = new URL('../patterns.css', import.meta.url).href;

  function Editor({id, chromeId, navigate}) {
    const chromeOnly = Boolean(chromeId);
    const [data, setData] = React.useState(null);
    const [elements, setElements] = React.useState([]);
    const [layout, setLayout] = React.useState('');
    const [headerId, setHeaderId] = React.useState('');
    const [footerId, setFooterId] = React.useState('');
    const [headers, setHeaders] = React.useState([]);
    const [footers, setFooters] = React.useState([]);
    const [editingChrome, setEditingChrome] = React.useState(chromeOnly ? {id: chromeId, kind: 'header'} : null);
    const [chromeElements, setChromeElements] = React.useState([]);
    const [chromeName, setChromeName] = React.useState('');
    const [selected, setSelected] = React.useState(null);
    const [frameHtml, setFrameHtml] = React.useState('');
    const [device, setDevice] = React.useState('desktop');
    const [failure, setFailure] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [conflict, setConflict] = React.useState(false);
    const [media, setMedia] = React.useState({});
    const [defaults, setDefaults] = React.useState({});
    const [buttonStyles, setButtonStyles] = React.useState([]);
    const [leftTab, setLeftTab] = React.useState('elements');
    const [globalType, setGlobalType] = React.useState(null);
    const [globalStyleId, setGlobalStyleId] = React.useState(null);
    const [panels, setPanels] = React.useState(() => ({palette: panelOpen('palette'), side: panelOpen('side')}));
    const [animPreview, setAnimPreview] = React.useState(0);
    const changed = host.useWorkspaceChanged?.();
    const saved = host.useWorkspaceSaved?.();
    const baseHash = React.useRef('');
    const requestedMedia = React.useRef(new Set());
    const saveRef = React.useRef(() => {});
    const dragKind = React.useRef('');
    const activeElements = editingChrome ? chromeElements : elements;
    const setActiveElements = editingChrome ? setChromeElements : setElements;

    function applyChromeLists(payload) {
      setHeaders(Array.isArray(payload.headers) ? payload.headers : []);
      setFooters(Array.isArray(payload.footers) ? payload.footers : []);
    }

    async function refreshChromeLists() {
      const payload = await request(BASE + '/chrome', 'GET');
      applyChromeLists(payload);
    }

    React.useEffect(() => {
      if (chromeOnly) return undefined;
      const abort = new AbortController();
      setFailure('');
      setEditingChrome(null);
      request(BASE + '/pages/' + id, 'GET', undefined, abort.signal)
        .then((payload) => {
          setData(payload);
          setElements(Array.isArray(payload.elements) ? payload.elements : []);
          setDefaults(payload.defaults && typeof payload.defaults === 'object' ? payload.defaults : {});
          setButtonStyles(Array.isArray(payload.button_styles) ? payload.button_styles : []);
          setLayout(payload.page?.layout || payload.layouts?.[0]?.id || 'default');
          setHeaderId(payload.page?.header_id || '');
          setFooterId(payload.page?.footer_id || '');
          applyChromeLists(payload);
          baseHash.current = payload.base_hash || '';
          setSelected(null);
          setGlobalStyleId(null);
        })
        .catch((error) => {
          if (!abort.signal.aborted) setFailure(error.message);
        });
      return () => abort.abort();
    }, [id, chromeOnly]);

    React.useEffect(() => {
      if (!chromeOnly || !chromeId) return undefined;
      const abort = new AbortController();
      setFailure('');
      Promise.all([
        request(BASE + '/chrome/' + chromeId, 'GET', undefined, abort.signal),
        request(BASE + '/chrome', 'GET', undefined, abort.signal),
      ])
        .then(([item, lists]) => {
          setEditingChrome({id: item.id, kind: item.kind});
          setChromeName(item.name || '');
          setChromeElements(Array.isArray(item.elements) ? item.elements : []);
          setDefaults(lists.defaults && typeof lists.defaults === 'object' ? lists.defaults : {});
          setButtonStyles(Array.isArray(lists.button_styles) ? lists.button_styles : []);
          setLayout(lists.layouts?.[0]?.id || 'default');
          applyChromeLists(lists);
          setData({
            page: {id: 0, title: item.name || (item.kind === 'footer' ? 'Футър' : 'Шапка')},
            layouts: lists.layouts || [],
            state: 'current',
          });
          setSelected(null);
          setLeftTab('elements');
        })
        .catch((error) => {
          if (!abort.signal.aborted) setFailure(error.message);
        });
      return () => abort.abort();
    }, [chromeOnly, chromeId]);

    React.useEffect(() => {
      if (!layout) return undefined;
      const abort = new AbortController();
      const frameUrl = chromeOnly
        ? BASE + '/chrome/frame?template=' + encodeURIComponent(layout)
        : BASE + '/pages/' + id + '/frame?template=' + encodeURIComponent(layout);
      fetch(frameUrl, {credentials: 'include', cache: 'no-store', signal: abort.signal, headers: {Accept: 'text/html'}})
        .then((response) => response.ok ? response.text() : Promise.reject(new Error('Лейаутът не може да бъде показан.')))
        .then(setFrameHtml)
        .catch((error) => {
          if (error.name !== 'AbortError') setFailure(error.message);
        });
      return () => abort.abort();
    }, [id, layout, chromeOnly]);

    React.useEffect(() => {
      const ids = [];
      eachElement(activeElements, (element) => {
        if (element.type === 'image' && element.media_id) ids.push(element.media_id);
        if (element.type === 'section' && element.wallpaper_id) ids.push(element.wallpaper_id);
      });
      if (defaults.section?.wallpaper_id) ids.push(defaults.section.wallpaper_id);
      ids.forEach((mediaId) => {
        if (!mediaId || requestedMedia.current.has(mediaId)) return;
        requestedMedia.current.add(mediaId);
        request('/api/admin/media/' + mediaId)
          .then((record) => {
            const file = record && typeof record.media === 'object' && !Array.isArray(record.media) ? record.media : record;
            setMedia((latest) => ({...latest, [mediaId]: file?.url || file?.thumbnail_url || ''}));
          })
          .catch(() => setMedia((latest) => ({...latest, [mediaId]: ''})));
      });
    }, [activeElements, defaults]);

    function mark(next) {
      setActiveElements(next);
      changed?.();
    }

    function insert(type, index, parentId) {
      if (!PALETTE.some((item) => item.type === type)) return;
      const tree = activeElements;
      const element = blank(type);
      let parent = parentId || null;
      let at = index;
      if (type === 'section' && parent) parent = sectionHolder(tree, parent);
      if (!Number.isInteger(at)) {
        const located = selected ? locate(tree, selected) : null;
        const current = located ? located.list[located.index] : null;
        if (type === 'section') {
          if (current?.type === 'section') {
            parent = current.id;
            at = (current.children || []).length;
          } else if (located?.parentId) {
            parent = sectionHolder(tree, located.parentId);
            at = parent === located.parentId ? located.index + 1 : (findElement(tree, parent)?.children || []).length;
          } else {
            parent = null;
            at = located ? located.index + 1 : tree.length;
          }
        } else if (type === 'columns') {
          if (current?.type === 'section') {
            parent = current.id;
            at = (current.children || []).length;
          } else if (current?.type === 'column') {
            const row = locate(tree, located.parentId);
            parent = row?.parentId || null;
            at = row ? row.index + 1 : tree.length;
          } else if (current?.type === 'columns') {
            parent = located.parentId;
            at = located.index + 1;
          } else if (located) {
            parent = located.parentId;
            at = located.index + 1;
          } else {
            parent = null;
            at = tree.length;
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
          const lastSection = type === 'columns' ? [...tree].reverse().find((item) => item.type === 'section') : null;
          if (lastSection) {
            parent = lastSection.id;
            at = (lastSection.children || []).length;
          } else {
            parent = null;
            at = tree.length;
          }
        }
      }
      mark(insertInto(tree, element, parent, at));
      setSelected(element.id);
    }

    function addColumns(count) {
      const tree = activeElements;
      const current = findElement(tree, selected);
      if (!current || current.type !== 'section') return;
      const row = resizeColumns(blank('columns'), count);
      mark(insertInto(tree, row, current.id, (current.children || []).length));
      setSelected(row.id);
    }

    function reorder(id, index, parentId) {
      const tree = activeElements;
      const next = place(tree, id, parentId, index);
      if (next === tree) return;
      mark(next);
      setSelected(id);
    }

    function update(next) {
      mark(replaceElement(activeElements, next));
    }

    function editText(id, patch) {
      mark(patchElement(activeElements, id, patch));
    }

    function remove() {
      mark(removeElement(activeElements, selected));
      setSelected(null);
    }

    async function openChrome(item) {
      setFailure('');
      const payload = await request(BASE + '/chrome/' + item.id, 'GET');
      setEditingChrome({id: payload.id, kind: payload.kind});
      setChromeName(payload.name || '');
      setChromeElements(Array.isArray(payload.elements) ? payload.elements : []);
      setSelected(null);
      setLeftTab('elements');
    }

    async function createChrome(kind) {
      const id = chromeId();
      const name = kind === 'footer' ? 'Нов футър' : 'Нова шапка';
      await request(BASE + '/chrome/' + id, 'PUT', {kind, name, elements: []});
      await refreshChromeLists();
      await openChrome({id, kind, name});
      changed?.();
    }

    async function deleteChrome(item) {
      await request(BASE + '/chrome/' + item.id, 'DELETE');
      if (editingChrome?.id === item.id) {
        setEditingChrome(null);
        setChromeElements([]);
      }
      if (headerId === item.id) setHeaderId('');
      if (footerId === item.id) setFooterId('');
      await refreshChromeLists();
      changed?.();
    }

    function closeChromeEditor() {
      if (chromeOnly) {
        navigate(chromeListPath());
        return;
      }
      setEditingChrome(null);
      setChromeElements([]);
      setChromeName('');
      setSelected(null);
      setLeftTab('chrome');
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
      const tree = activeElements;
      const located = locate(tree, selected);
      if (!located) return;
      const next = place(tree, selected, located.parentId, located.index + (step > 0 ? step + 1 : step));
      if (next !== tree) mark(next);
    }

    async function save(force) {
      setSaving(true);
      setFailure('');
      try {
        if (editingChrome) {
          const payload = await request(BASE + '/chrome/' + editingChrome.id, 'PUT', {
            kind: editingChrome.kind,
            name: chromeName,
            elements: chromeElements,
          });
          setEditingChrome({id: payload.id, kind: payload.kind});
          setChromeName(payload.name || '');
          setChromeElements(Array.isArray(payload.elements) ? payload.elements : []);
          await refreshChromeLists();
          saved?.();
          toast?.success?.(editingChrome.kind === 'footer' ? 'Футърът е записан.' : 'Шапката е записана.');
          return;
        }
        const payload = await request(BASE + '/pages/' + id, 'PUT', {
          elements,
          defaults,
          button_styles: buttonStyles,
          layout,
          header_id: headerId || null,
          footer_id: footerId || null,
          base_hash: baseHash.current,
          force: force === true,
        });
        setData(payload);
        setElements(Array.isArray(payload.elements) ? payload.elements : []);
        setDefaults(payload.defaults && typeof payload.defaults === 'object' ? payload.defaults : defaults);
        setButtonStyles(Array.isArray(payload.button_styles) ? payload.button_styles : buttonStyles);
        setHeaderId(payload.page?.header_id || '');
        setFooterId(payload.page?.footer_id || '');
        applyChromeLists(payload);
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

    const current = findElement(activeElements, selected);
    const width = WIDTHS.find((item) => item.id === device)?.width || '100%';
    const pagePaths = Object.fromEntries((data.pages || []).map((page) => [page.id, {path: page.path || '#'}]));
    const motionPreview = current?.animation
      ? [current.id, current.animation, current.animation_duration ?? '', current.animation_delay ?? '', animPreview].join('|')
      : '';
    const panelTitle = current
      ? 'Настройки'
      : (editingChrome
        ? (editingChrome.kind === 'footer' ? 'Футър' : 'Шапка')
        : (leftTab === 'globals' ? 'Глобални' : (leftTab === 'chrome' ? 'Шапка/Футър' : 'Елементи')));

    function paletteBody() {
      if (current) {
        return h(React.Fragment, null,
          h('nav', {className: 'fpb-panel-crumbs', 'aria-label': 'Път към елемента'},
            h('button', {type: 'button', onClick: () => setSelected(null)}, editingChrome ? (editingChrome.kind === 'footer' ? 'Футър' : 'Шапка') : 'Елементи'),
            ...elementPath(activeElements, selected).flatMap((element, index, trail) => {
              const label = crumbName(element, trail);
              const isLast = index === trail.length - 1;
              return [
                h('span', {key: 'sep-' + element.id, 'aria-hidden': true}, '/'),
                isLast
                  ? h('span', {key: element.id, className: 'fpb-panel-crumb-current', 'aria-current': 'page'}, label)
                  : h('button', {key: element.id, type: 'button', onClick: () => setSelected(element.id)}, label),
              ];
            })),
          h(Inspector, {element: current, device, onDevice: setDevice, onChange: update, onRemove: remove, onMove: move, onAddColumns: addColumns, onPreviewAnimation: () => setAnimPreview((n) => n + 1), pages: data.pages || [], buttonStyles, defaults}));
      }
      if (!editingChrome && leftTab === 'globals') {
        return h(GlobalsPanel, {
          defaults,
          buttonStyles,
          selectedType: globalType,
          editingStyleId: globalStyleId,
          onSelectType: (type) => { setGlobalType(type); setGlobalStyleId(null); },
          onSelectStyle: setGlobalStyleId,
          device,
          onDevice: setDevice,
          onChangeDefaults: (next) => { setDefaults(next); changed?.(); },
          onChangeStyles: (next) => { setButtonStyles(next); changed?.(); },
        });
      }
      if (!editingChrome && leftTab === 'chrome') {
        return h(ChromePanel, {
          headers,
          footers,
          onRefresh: () => refreshChromeLists().catch((error) => setFailure(error.message)),
          onEdit: (item) => openChrome(item).catch((error) => setFailure(error.message)),
          onCreate: (kind) => createChrome(kind).catch((error) => setFailure(error.message)),
          onDelete: (item) => deleteChrome(item).catch((error) => setFailure(error.message)),
        });
      }
      return h('div', {className: 'fpb-palette-list'}, PALETTE_GROUPS.map((group, index) => h('section', {key: group.id, className: 'fpb-palette-group'},
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
        }, item.label))))));
    }

    return h('div', {className: 'fpb-screen'},
      h('header', {className: 'fpb-toolbar'},
        h(C.Button, {
          type: 'button',
          variant: 'secondary',
          onClick: () => editingChrome
            ? closeChromeEditor()
            : navigate('/pages/' + id + '/edit'),
        }, chromeOnly ? 'Към списъка' : (editingChrome ? 'Към страницата' : 'Затвори')),
        h('div', {className: 'fpb-toolbar-title'},
          h('h1', null, editingChrome ? (chromeName || (editingChrome.kind === 'footer' ? 'Футър' : 'Шапка')) : data.page.title),
          h('p', null, editingChrome ? 'Редакция на ' + (editingChrome.kind === 'footer' ? 'футър' : 'шапка') : 'Page Builder')),
        editingChrome
          ? h(React.Fragment, null,
            h('label', {className: 'fpb-layout'},
              h('span', null, 'Име'),
              h('input', {
                value: chromeName,
                onChange: (event) => { setChromeName(event.target.value); changed?.(); },
              })),
            chromeOnly
              ? h('label', {className: 'fpb-layout'},
                h('span', null, 'Лейаут'),
                h('select', {value: layout, onChange: (event) => { setLayout(event.target.value); changed?.(); }},
                  (data.layouts || []).map((item) => h('option', {key: item.id, value: item.id}, item.label))))
              : null)
          : h(React.Fragment, null,
            h('label', {className: 'fpb-layout'},
              h('span', null, 'Лейаут'),
              h('select', {value: layout, onChange: (event) => { setLayout(event.target.value); changed?.(); }},
                (data.layouts || []).map((item) => h('option', {key: item.id, value: item.id}, item.label)))),
            h('label', {className: 'fpb-layout'},
              h('span', null, 'Шапка'),
              h('select', {value: headerId, onChange: (event) => { setHeaderId(event.target.value); changed?.(); }},
                [h('option', {key: '', value: ''}, 'От темата'),
                  ...headers.map((item) => h('option', {key: item.id, value: item.id}, item.name || 'Шапка'))])),
            h('label', {className: 'fpb-layout'},
              h('span', null, 'Футър'),
              h('select', {value: footerId, onChange: (event) => { setFooterId(event.target.value); changed?.(); }},
                [h('option', {key: '', value: ''}, 'От темата'),
                  ...footers.map((item) => h('option', {key: item.id, value: item.id}, item.name || 'Футър'))]))),
        h('div', {className: 'fpb-devices', role: 'group', 'aria-label': 'Ширина на прегледа'},
          WIDTHS.map((item) => h('button', {key: item.id, type: 'button', className: item.id === device ? 'is-active' : '', onClick: () => setDevice(item.id)}, item.label))),
        h(C.LoadingButton, {type: 'button', loading: saving, onClick: () => save(false)}, 'Запази')),
      failure ? h('div', {className: 'react-form-error', role: 'alert'}, failure) : null,
      !editingChrome && data.state === 'changed' ? h('div', {className: 'fpb-notice', role: 'status'}, 'Съдържанието е променено извън Page Builder. Записът ще го замести със сглобените елементи.') : null,
      h('div', {className: 'fpb-workspace' + (panels.palette ? '' : ' is-palette-closed') + (panels.side ? '' : ' is-side-closed')},
        h('aside', {className: 'fpb-palette' + (panels.palette ? '' : ' is-closed')},
          h('div', {className: 'fpb-panel-head'}, h('p', null, panelTitle), panelToggle('palette', current ? 'Скрий настройките' : 'Скрий панела', current ? 'Покажи настройките' : 'Покажи панела')),
          panels.palette && !current && !editingChrome && !chromeOnly ? h('div', {className: 'fpb-tabs', role: 'tablist', 'aria-label': 'Ляв панел'},
            h('button', {type: 'button', role: 'tab', 'aria-selected': leftTab === 'elements', className: leftTab === 'elements' ? 'is-active' : '', onClick: () => setLeftTab('elements')}, 'Елементи'),
            h('button', {type: 'button', role: 'tab', 'aria-selected': leftTab === 'chrome', className: leftTab === 'chrome' ? 'is-active' : '', onClick: () => setLeftTab('chrome')}, 'Шапка/Футър'),
            h('button', {type: 'button', role: 'tab', 'aria-selected': leftTab === 'globals', className: leftTab === 'globals' ? 'is-active' : '', onClick: () => { setLeftTab('globals'); setGlobalType(null); setGlobalStyleId(null); }}, 'Глобални')) : null,
          panels.palette ? h('hr', {className: 'fpb-panel-rule'}) : null,
          panels.palette ? paletteBody() : null),
        h('div', {className: 'fpb-canvas'},
          h('div', {className: 'fpb-stage', style: {width}},
            h(Canvas, {frameHtml, markup: compile(activeElements, selected, media, defaults, pagePaths, buttonStyles), selected, motionPreview, onSelect: (nextId) => { setSelected(nextId); if (nextId) setLeftTab('elements'); }, onInsert: insert, onMove: reorder, onText: editText, dragKind}))),
        h('aside', {className: 'fpb-side' + (panels.side ? '' : ' is-closed')},
          h('div', {className: 'fpb-panel-head'}, h('p', null, 'Структура'), panelToggle('side', 'Скрий структурата', 'Покажи структурата')),
          panels.side ? h('hr', {className: 'fpb-panel-rule'}) : null,
          panels.side ? (activeElements.length ? h(StructureTree, {elements: activeElements, selected, onSelect: setSelected, onMove: reorder, device}) : h('p', {className: 'fpb-muted'}, 'Няма елементи')) : null)),
      h('footer', {className: 'fpb-path'},
        h('nav', {className: 'fpb-crumbs', 'aria-label': 'Вложеност'},
          h('button', {type: 'button', className: selected ? '' : 'is-active', onClick: () => setSelected(null)}, editingChrome ? (editingChrome.kind === 'footer' ? 'Футър' : 'Шапка') : 'Страница'),
          elementPath(activeElements, selected).flatMap((element, index, trail) => [
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
    const chromeRoute = parseChromePath(path);
    if (chromeRoute.view === 'edit' && chromeRoute.id) {
      return h(React.Fragment, null,
        h('link', {rel: 'stylesheet', href: stylesheet}),
        h('link', {rel: 'stylesheet', href: patternsStylesheet}),
        h(Editor, {chromeId: chromeRoute.id, navigate}));
    }
    const id = parsePath(path);
    if (!id) {
      return h('div', {className: 'fpb-intro'},
        h('h1', null, 'Page Builder'),
        h('p', null, 'Отворете страница от „Действия“ → „Отвори в Page Builder“, или шапка/футър от „Шапки и футери“.'),
        h(C.Button, {type: 'button', variant: 'secondary', onClick: () => navigate('/pages')}, 'Към страниците'));
    }
    return h(React.Fragment, null,
      h('link', {rel: 'stylesheet', href: stylesheet}),
      h('link', {rel: 'stylesheet', href: patternsStylesheet}),
      h(Editor, {id, navigate}));
  };
}
