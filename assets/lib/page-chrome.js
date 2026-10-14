import {BASE} from './paths.js';

/** Header/footer selects on the classic page editor (page.settings panel). */
export function createPageChromePanel(host) {
  const {React, request, toast} = host;
  const C = host.components;
  const h = React.createElement;

  return function PageChromePanel({context}) {
    const pageId = Number(context?.id);
    const [headerId, setHeaderId] = React.useState('');
    const [footerId, setFooterId] = React.useState('');
    const [headers, setHeaders] = React.useState([]);
    const [footers, setFooters] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [failure, setFailure] = React.useState('');
    const changed = host.useWorkspaceChanged?.();
    const saved = host.useWorkspaceSaved?.();

    React.useEffect(() => {
      if (!Number.isInteger(pageId) || pageId < 1) {
        setLoading(false);
        return;
      }
      let live = true;
      setLoading(true);
      request(BASE + '/pages/' + pageId, 'GET')
        .then((payload) => {
          if (!live) return;
          setHeaderId(payload.page?.header_id || '');
          setFooterId(payload.page?.footer_id || '');
          setHeaders(Array.isArray(payload.headers) ? payload.headers : []);
          setFooters(Array.isArray(payload.footers) ? payload.footers : []);
        })
        .catch((error) => { if (live) setFailure(error.message); })
        .finally(() => { if (live) setLoading(false); });
      return () => { live = false; };
    }, [pageId]);

    async function save() {
      if (!Number.isInteger(pageId) || pageId < 1) return;
      setSaving(true);
      setFailure('');
      try {
        const payload = await request(BASE + '/pages/' + pageId + '/chrome', 'PUT', {
          header_id: headerId || null,
          footer_id: footerId || null,
        });
        setHeaderId(payload.page?.header_id || '');
        setFooterId(payload.page?.footer_id || '');
        setHeaders(Array.isArray(payload.headers) ? payload.headers : []);
        setFooters(Array.isArray(payload.footers) ? payload.footers : []);
        saved?.();
        toast?.success?.('Header и Footer са записани.');
      } catch (error) {
        setFailure(error.message);
        toast?.error?.(error.message);
      } finally {
        setSaving(false);
      }
    }

    if (!Number.isInteger(pageId) || pageId < 1) {
      return h('p', {className: 'fpb-muted'}, 'Запазете страницата, за да изберете Header и Footer.');
    }
    if (loading) {
      return h('p', {className: 'fpb-muted'}, 'Зареждане…');
    }

    return h('div', {className: 'react-form-grid'},
      failure ? h('div', {className: 'react-form-error', role: 'alert'}, failure) : null,
      h('p', {className: 'fpb-globals-note'}, 'Празно поле ползва chrome на активната тема. Дизайните се управляват от „Headers & Footers“.'),
      h('label', {className: 'react-form-field'},
        h('span', null, 'Header'),
        h('select', {
          value: headerId,
          onChange: (event) => { setHeaderId(event.target.value); changed?.(); },
        },
          h('option', {value: ''}, 'От темата'),
          ...headers.map((item) => h('option', {key: item.id, value: item.id}, item.name || 'Header')))),
      h('label', {className: 'react-form-field'},
        h('span', null, 'Footer'),
        h('select', {
          value: footerId,
          onChange: (event) => { setFooterId(event.target.value); changed?.(); },
        },
          h('option', {value: ''}, 'От темата'),
          ...footers.map((item) => h('option', {key: item.id, value: item.id}, item.name || 'Footer')))),
      h('div', {className: 'react-form-actions'},
        h(C.LoadingButton, {type: 'button', loading: saving, onClick: save}, 'Запази Header/Footer')));
  };
}
