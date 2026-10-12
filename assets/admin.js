// Flex Page Builder: a hidden admin screen that edits only the content between the theme layout's header and footer.
export const BASE = '/admin/plugins/flex/page-builder';

const PALETTE = [
  {type: 'heading', label: 'Заглавие'},
  {type: 'paragraph', label: 'Параграф'},
  {type: 'image', label: 'Изображение'},
  {type: 'button', label: 'Бутон'},
  {type: 'list', label: 'Списък'},
  {type: 'divider', label: 'Разделител'},
  {type: 'spacer', label: 'Отстъп'},
  {type: 'html', label: 'HTML'},
];

const WIDTHS = [
  {id: 'desktop', label: 'Бюро', width: '100%'},
  {id: 'tablet', label: 'Таблет', width: '768px'},
  {id: 'phone', label: 'Телефон', width: '390px'},
];

export function editorPath(id) {
  return '/extension-pages/flex-page-builder-editor/' + id + '/edit';
}

export function parsePath(path) {
  const match = /^\/extension-pages\/flex-page-builder-editor\/([1-9][0-9]{0,9})\/edit$/.exec(String(path ?? ''));
  return match ? Number(match[1]) : null;
}

function elementId() {
  return 'e' + Math.random().toString(36).slice(2, 10);
}

function blank(type) {
  const id = elementId();
  if (type === 'heading') return {id, type, level: 2, text: 'Заглавие'};
  if (type === 'paragraph') return {id, type, text: 'Текст на параграфа'};
  if (type === 'image') return {id, type, media_id: null, alt: ''};
  if (type === 'button') return {id, type, text: 'Научете повече', url: '/'};
  if (type === 'list') return {id, type, ordered: false, items: ['Първи ред', 'Втори ред']};
  if (type === 'spacer') return {id, type, height: 32};
  if (type === 'html') return {id, type, html: '<p>HTML</p>'};
  return {id, type: 'divider'};
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[char]));
}

function textSize(value) {
  if (value === null || value === '') return null;
  const size = Number(value);
  return Number.isInteger(size) ? Math.max(8, Math.min(160, size)) : null;
}

function sizeAttr(size) {
  const value = textSize(size);
  return value === null ? '' : ' style="font-size:' + value + 'px"';
}

function compile(elements, selected, media) {
  if (!elements.length) {
    return '<p class="fpb-empty">Пуснете елемент тук или го изберете отляво.</p>';
  }
  return elements.map((element) => {
    const selectedClass = element.id === selected ? ' is-selected' : '';
    let inner = '';
    if (element.type === 'heading') {
      const level = [1, 2, 3, 4, 5, 6].includes(Number(element.level)) ? Number(element.level) : 2;
      inner = '<h' + level + sizeAttr(element.size) + '>' + escapeHtml(element.text) + '</h' + level + '>';
    } else if (element.type === 'paragraph') {
      inner = '<p' + sizeAttr(element.size) + '>' + escapeHtml(element.text).replace(/\n/g, '<br>') + '</p>';
    } else if (element.type === 'image') {
      const url = media[element.media_id] || '';
      inner = url ? '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(element.alt) + '">' : '<p class="fpb-empty">Изберете изображение</p>';
    } else if (element.type === 'button') {
      inner = '<a class="fpb-button" href="' + escapeHtml(element.url || '#') + '"' + sizeAttr(element.size) + '>' + escapeHtml(element.text) + '</a>';
    } else if (element.type === 'list') {
      const tag = element.ordered ? 'ol' : 'ul';
      inner = '<' + tag + sizeAttr(element.size) + '>' + (element.items || []).map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</' + tag + '>';
    } else if (element.type === 'spacer') {
      inner = '<div class="fpb-spacer" style="height:' + Math.max(8, Math.min(160, Number(element.height) || 32)) + 'px"></div>';
    } else if (element.type === 'html') {
      inner = String(element.html || '');
    } else {
      inner = '<hr>';
    }
    return '<div class="fpb-element' + selectedClass + '" data-fpb-id="' + escapeHtml(element.id) + '">' + inner + '</div>';
  }).join('');
}

/** "Отвори в Page Builder" in the actions menu of every page. */
export function createPageAction() {
  return {
    label: 'Отвори в Page Builder',
    onSelect(row, helpers) {
      if (row?.id) helpers?.navigate?.(editorPath(row.id));
    },
    visible: (row) => !row?.deleted_at,
  };
}

/** "Отвори в Page Builder" at the start of the classic page editor. */
export function createEditorLink(host) {
  const h = host.React.createElement;
  const C = host.components;
  return function PageBuilderLink({context, navigate}) {
    const id = Number(context?.id);
    if (context?.type !== 'page' || !Number.isInteger(id) || id < 1) return null;
    return h('div', {className: 'fpb-editor-link'},
      h('span', null, 'Съдържанието между хедъра и футъра се подрежда в Page Builder. Хедърът и футърът идват от лейаута на темата.'),
      h(C.Button, {type: 'button', variant: 'secondary', onClick: () => navigate?.(editorPath(id))}, 'Отвори в Page Builder'));
  };
}

export function createPage(host) {
  const {React, request, toast} = host;
  const C = host.components;
  const h = React.createElement;

  function Canvas({frameHtml, markup, onSelect, onInsert}) {
    const frame = React.useRef(null);
    const select = React.useRef(onSelect);
    const insert = React.useRef(onInsert);
    select.current = onSelect;
    insert.current = onInsert;

    React.useEffect(() => {
      const node = frame.current;
      if (!node) return undefined;
      function bind() {
        const doc = node.contentDocument;
        const slot = doc?.querySelector('[data-flex-page-builder-slot]');
        if (!slot || slot.dataset.bound === '1') return;
        slot.dataset.bound = '1';
        slot.addEventListener('click', (event) => {
          const target = event.target.closest('[data-fpb-id]');
          select.current(target ? target.getAttribute('data-fpb-id') : null);
        });
        slot.addEventListener('dragover', (event) => event.preventDefault());
        slot.addEventListener('drop', (event) => {
          event.preventDefault();
          const type = event.dataTransfer?.getData('application/x-fpb') || event.dataTransfer?.getData('text/plain');
          if (type) insert.current(type);
        });
      }
      node.addEventListener('load', bind);
      return () => node.removeEventListener('load', bind);
    }, []);

    React.useEffect(() => {
      const node = frame.current;
      if (node && node.getAttribute('srcdoc') !== frameHtml) node.srcdoc = frameHtml;
    }, [frameHtml]);

    React.useEffect(() => {
      const node = frame.current;
      if (!node) return undefined;
      function paint() {
        const doc = node.contentDocument;
        const slot = doc?.querySelector('[data-flex-page-builder-slot]');
        if (!doc || !slot) return;
        if (!doc.getElementById('fpb-canvas-style')) {
          const style = doc.createElement('style');
          style.id = 'fpb-canvas-style';
          style.textContent = '[data-flex-page-builder-slot]{min-height:8rem}.fpb-element{outline:1px dashed transparent;outline-offset:4px;cursor:pointer}.fpb-element.is-selected{outline-color:#2563eb}.fpb-empty{margin:0;padding:2.5rem 1rem;text-align:center;color:#6b7280}';
          doc.head.appendChild(style);
        }
        slot.innerHTML = markup;
      }
      node.addEventListener('load', paint);
      paint();
      return () => node.removeEventListener('load', paint);
    }, [markup, frameHtml]);

    return h('iframe', {ref: frame, className: 'fpb-frame', title: 'Преглед на страницата'});
  }

  function Inspector({element, onChange, onRemove, onMove}) {
    if (!element) {
      return h('p', {className: 'fpb-muted'}, 'Изберете елемент от платното, за да промените текста, изображението или връзката му.');
    }
    const set = (patch) => onChange({...element, ...patch});
    const field = (label, child) => h('label', {className: 'fpb-field'}, h('span', null, label), child);
    const sizeField = field('Размер на текста (px)', h(C.Input, {type: 'number', min: 8, max: 160, value: element.size == null ? '' : String(element.size), placeholder: 'По подразбиране', onChange: (event) => set({size: event.target.value === '' ? null : Number(event.target.value)})}));
    const controls = [
      h('div', {className: 'fpb-inspector-actions', key: 'actions'},
        h(C.Button, {type: 'button', variant: 'secondary', onClick: () => onMove(-1)}, 'Нагоре'),
        h(C.Button, {type: 'button', variant: 'secondary', onClick: () => onMove(1)}, 'Надолу'),
        h(C.Button, {type: 'button', variant: 'secondary', onClick: onRemove}, 'Изтрий')),
    ];
    if (element.type === 'heading') {
      controls.push(field('Ниво', h('select', {value: String(element.level || 2), onChange: (event) => set({level: Number(event.target.value)})},
        [1, 2, 3, 4, 5, 6].map((level) => h('option', {key: level, value: String(level)}, 'H' + level)))));
      controls.push(field('Текст', h(C.Input, {value: element.text || '', onChange: (event) => set({text: event.target.value})})));
      controls.push(sizeField);
    } else if (element.type === 'paragraph' || element.type === 'html') {
      const key = element.type === 'html' ? 'html' : 'text';
      controls.push(field(element.type === 'html' ? 'HTML' : 'Текст', h(C.Textarea, {rows: 8, value: element[key] || '', onChange: (event) => set({[key]: event.target.value})})));
      if (element.type === 'paragraph') controls.push(sizeField);
    } else if (element.type === 'image') {
      controls.push(h(C.ImageField, {key: 'image', label: 'Изображение', value: element.media_id || null, onChange: (id) => set({media_id: id})}));
      controls.push(field('Алтернативен текст', h(C.Input, {value: element.alt || '', onChange: (event) => set({alt: event.target.value})})));
    } else if (element.type === 'button') {
      controls.push(field('Текст', h(C.Input, {value: element.text || '', onChange: (event) => set({text: event.target.value})})));
      controls.push(field('Адрес', h(C.Input, {value: element.url || '', onChange: (event) => set({url: event.target.value})})));
      controls.push(sizeField);
    } else if (element.type === 'list') {
      controls.push(h(C.CheckboxField, {key: 'ordered', checked: element.ordered === true, label: 'Номериран', onChange: (event) => set({ordered: event.target.checked})}));
      controls.push(field('Редове, по един на ред', h(C.Textarea, {rows: 6, value: (element.items || []).join('\n'), onChange: (event) => set({items: event.target.value.split('\n')})})));
      controls.push(sizeField);
    } else if (element.type === 'spacer') {
      controls.push(field('Височина (px)', h(C.Input, {type: 'number', min: 8, max: 160, value: String(element.height || 32), onChange: (event) => set({height: Number(event.target.value)})})));
    } else {
      controls.push(h('p', {className: 'fpb-muted', key: 'note'}, 'Разделителят няма настройки.'));
    }
    return h('div', {className: 'fpb-inspector'}, controls);
  }

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
    const changed = host.useWorkspaceChanged?.();
    const saved = host.useWorkspaceSaved?.();
    const baseHash = React.useRef('');
    const requestedMedia = React.useRef(new Set());
    const saveRef = React.useRef(() => {});

    React.useEffect(() => {
      const abort = new AbortController();
      setFailure('');
      request(BASE + '/pages/' + id, 'GET', undefined, abort.signal)
        .then((payload) => {
          setData(payload);
          setElements(Array.isArray(payload.elements) ? payload.elements : []);
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
      elements.forEach((element) => {
        const mediaId = element.type === 'image' ? element.media_id : null;
        if (!mediaId || requestedMedia.current.has(mediaId)) return;
        requestedMedia.current.add(mediaId);
        request('/api/admin/media/' + mediaId)
          .then((record) => setMedia((latest) => ({...latest, [mediaId]: record.url || record.thumbnail_url || ''})))
          .catch(() => setMedia((latest) => ({...latest, [mediaId]: ''})));
      });
    }, [elements]);

    function mark(next) {
      setElements(next);
      changed?.();
    }

    function insert(type) {
      if (!PALETTE.some((item) => item.type === type)) return;
      const element = blank(type);
      mark([...elements, element]);
      setSelected(element.id);
    }

    function update(next) {
      mark(elements.map((element) => element.id === next.id ? next : element));
    }

    function remove() {
      mark(elements.filter((element) => element.id !== selected));
      setSelected(null);
    }

    function move(step) {
      const index = elements.findIndex((element) => element.id === selected);
      const target = index + step;
      if (index < 0 || target < 0 || target >= elements.length) return;
      const next = elements.slice();
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      mark(next);
    }

    async function save(force) {
      setSaving(true);
      setFailure('');
      try {
        const payload = await request(BASE + '/pages/' + id, 'PUT', {elements, layout, base_hash: baseHash.current, force: force === true});
        setData(payload);
        setElements(Array.isArray(payload.elements) ? payload.elements : []);
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

    const current = elements.find((element) => element.id === selected) || null;
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
      h('div', {className: 'fpb-workspace'},
        h('aside', {className: 'fpb-palette'},
          h('p', null, 'Елементи'),
          PALETTE.map((item) => h('button', {
            key: item.type,
            type: 'button',
            draggable: true,
            onDragStart: (event) => {
              event.dataTransfer?.setData('application/x-fpb', item.type);
              event.dataTransfer?.setData('text/plain', item.type);
            },
            onClick: () => insert(item.type),
          }, item.label))),
        h('div', {className: 'fpb-canvas'},
          h('div', {className: 'fpb-stage', style: {width}},
            h(Canvas, {frameHtml, markup: compile(elements, selected, media), onSelect: setSelected, onInsert: insert}))),
        h('aside', {className: 'fpb-side'},
          h(Inspector, {element: current, onChange: update, onRemove: remove, onMove: move}))),
      h(C.ConfirmDialog, {
        open: conflict,
        title: 'Страницата е променена',
        message: 'Някой е записал страницата, след като я отворихте. Записът върху промените замества това съдържание.',
        confirmLabel: 'Запиши върху',
        onConfirm: () => save(true),
        onCancel: () => setConflict(false),
      }));
  }

  const stylesheet = new URL('./builder.css', import.meta.url).href;
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
