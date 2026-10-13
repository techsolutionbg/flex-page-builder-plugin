import {deviceView, elementLabel, findElement, isContainer, place, structureDrop} from './model.js';

function treeBoxes(root) {
  const map = new Map();
  root?.querySelectorAll('[data-fpb-row]').forEach((node) => {
    map.set(node.getAttribute('data-fpb-row'), node.getBoundingClientRect());
  });
  return map;
}

function playTreeFlip(root, before) {
  if (!root || !before?.size) return;
  root.querySelectorAll('[data-fpb-row]').forEach((node) => {
    const box = before.get(node.getAttribute('data-fpb-row'));
    if (!box) return;
    const now = node.getBoundingClientRect();
    const dx = box.left - now.left;
    const dy = box.top - now.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    node.style.transition = 'none';
    node.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    node.getBoundingClientRect();
    node.style.transition = 'transform 180ms ease';
    node.style.transform = '';
    const done = (event) => {
      if (event.propertyName && event.propertyName !== 'transform') return;
      node.style.transition = '';
      node.style.transform = '';
      node.removeEventListener('transitionend', done);
    };
    node.addEventListener('transitionend', done);
  });
}

function structureRows(h, elements, selected, onSelect, nested, draggingId, device) {
  return elements.map((element, index) => {
    const hidden = deviceView(element, device).hidden === true;
    return h('li', {
      key: element.id,
      'data-fpb-row': element.id,
    },
      !nested && index > 0 ? h('hr', {className: 'fpb-tree-rule'}) : null,
      h('button', {
        type: 'button',
        className: [element.id === selected ? 'is-active' : '', hidden ? 'is-hidden' : ''].filter(Boolean).join(' '),
        'data-fpb-id': element.id,
        onClick: () => onSelect(element.id),
      }, elementLabel(element, index), hidden ? h('span', {className: 'fpb-tree-hidden'}, 'скрита') : null),
      isContainer(element.type) && (element.children || []).length ? h('ul', null, structureRows(h, element.children, selected, onSelect, true, draggingId, device)) : null);
  });
}

export function createStructureTree(host) {
  const {React} = host;
  const h = React.createElement;

  return function StructureTree({elements, selected, onSelect, onMove, device = 'desktop'}) {
    const [preview, setPreview] = React.useState(null);
    const [draggingId, setDraggingId] = React.useState('');
    const origin = React.useRef(elements);
    const dest = React.useRef(null);
    const start = React.useRef(null);
    const live = React.useRef(false);
    const skipClick = React.useRef(false);
    const tree = React.useRef(null);
    const flip = React.useRef(null);

    function stop(commit) {
      const id = start.current?.id;
      const next = dest.current;
      start.current = null;
      dest.current = null;
      live.current = false;
      flip.current = treeBoxes(tree.current);
      setPreview(null);
      setDraggingId('');
      if (commit && id && next) onMove(id, next.index, next.parentId);
    }

    function aim(event) {
      const node = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.fpb-tree [data-fpb-id]');
      const targetId = node?.getAttribute('data-fpb-id');
      if (!targetId || !start.current) return null;
      const target = findElement(origin.current, targetId);
      if (!target) return null;
      const rect = node.getBoundingClientRect();
      const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
      const preferred = isContainer(target.type) && ratio >= 0.28 && ratio <= 0.72 ? 'inside' : (ratio < 0.5 ? 'before' : 'after');
      return structureDrop(origin.current, start.current.id, targetId, preferred)
        || structureDrop(origin.current, start.current.id, targetId, ratio < 0.5 ? 'before' : 'after');
    }

    function onPointerDown(event) {
      if (event.button !== 0) return;
      const id = event.target.closest?.('[data-fpb-id]')?.getAttribute('data-fpb-id');
      if (!id) return;
      origin.current = elements;
      start.current = {id, x: event.clientX, y: event.clientY};
      dest.current = null;
      live.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event) {
      if (!start.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      if (!live.current && dx * dx + dy * dy < 25) return;
      if (!live.current) {
        live.current = true;
        skipClick.current = true;
        setDraggingId(start.current.id);
      }
      event.preventDefault();
      const next = aim(event);
      if (!next || (dest.current && dest.current.parentId === next.parentId && dest.current.index === next.index)) return;
      dest.current = next;
      flip.current = treeBoxes(tree.current);
      setPreview(place(origin.current, start.current.id, next.parentId, next.index));
    }

    function onPointerUp() {
      if (!start.current) return;
      const id = start.current.id;
      const didDrag = live.current;
      stop(didDrag);
      if (!didDrag) onSelect(id);
    }

    React.useLayoutEffect(() => {
      playTreeFlip(tree.current, flip.current);
      flip.current = null;
    }, [preview]);

    React.useEffect(() => {
      if (!draggingId) return undefined;
      function onKey(event) {
        if (event.key === 'Escape') stop(false);
      }
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [draggingId]);

    return h('div', {
      ref: tree,
      className: 'fpb-tree' + (draggingId ? ' is-live' : ''),
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: () => stop(false),
      onClickCapture: (event) => {
        if (!skipClick.current) return;
        skipClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    }, h('ul', null, structureRows(h, preview || elements, selected, onSelect, false, draggingId, device)));
  };
}
