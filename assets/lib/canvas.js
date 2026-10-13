const CANVAS_STYLE = 'html,body{overflow-x:clip}.corp-main--builder{padding-top:0;padding-bottom:0}[data-flex-page-builder-slot]{min-height:8rem}.fpb-element,.fpb-section,.fpb-columns,.fpb-column{position:relative;outline:1px dashed transparent;outline-offset:4px}.fpb-section,.fpb-columns,.fpb-column{display:grid;gap:.75rem;margin:.4rem 0;outline-color:#cbd5e1;min-width:0}.fpb-section{padding-block:2rem}.fpb-section .fpb-section{margin-block:.5rem;padding-block:1.25rem}.fpb-section-wallpaper{position:absolute;inset:0;z-index:0;pointer-events:none;background-position:center;background-repeat:no-repeat}.fpb-section-wallpaper.fpb-pattern{background-repeat:repeat;background-size:128px}.fpb-section-overlay{position:absolute;inset:0;z-index:1;pointer-events:none}.fpb-section>:not(.fpb-section-wallpaper):not(.fpb-section-overlay){position:relative;z-index:2}.fpb-section-body>.fpb-element:first-child :is(h1,h2,h3,h4,h5,h6,p){margin-block-start:0}.fpb-section-body>.fpb-element:last-child :is(h1,h2,h3,h4,h5,h6,p){margin-block-end:0}.fpb-section.fpb-section--full{width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);margin-right:0}.fpb-section .fpb-section.fpb-section--full{width:100%;max-width:none;margin-inline:0}.fpb-section--boxed{box-sizing:border-box;width:100%;max-width:var(--corp-max-width,72rem);margin-inline:auto;padding-inline:var(--corp-gutter,clamp(1rem,4vw,2rem))}.fpb-is-hidden{opacity:.42;outline-color:#94a3b8}.fpb-section.fpb-is-hidden,.fpb-columns.fpb-is-hidden,.fpb-column.fpb-is-hidden{display:grid!important}.fpb-element.fpb-is-hidden{display:block!important}.fpb-is-hidden::after{content:"Скрита";position:absolute;z-index:4;top:.35rem;right:.45rem;padding:.15rem .4rem;border-radius:.25rem;background:#111827;color:#fff;font:600 .65rem/1.2 system-ui,sans-serif;pointer-events:none}.fpb-photo{position:relative;display:block;isolation:isolate;line-height:0}.fpb-photo img{display:block;width:100%;height:auto}.fpb-photo--grayscale img,.fpb-section-wallpaper.fpb-photo--grayscale,.fpb-section-wallpaper.fpb-photo--grayscale img{filter:grayscale(1)!important}.fpb-photo--tint::after,.fpb-section-wallpaper.fpb-photo--tint::after{content:"";position:absolute;inset:0;background:var(--fpb-tint,transparent);opacity:var(--fpb-tint-opacity,.4);mix-blend-mode:color;pointer-events:none}.fpb-element{cursor:pointer}.fpb-element.is-selected,.fpb-section.is-selected,.fpb-columns.is-selected,.fpb-column.is-selected{outline-color:#2563eb}.fpb-section-body,.fpb-column-body{display:grid;gap:1rem;min-height:4.5rem}.fpb-element>.fpb-drag,.fpb-section>.fpb-drag,.fpb-columns>.fpb-drag,.fpb-column>.fpb-drag{position:absolute;z-index:2;top:0;left:50%;width:1.7rem;height:.55rem;margin:0;padding:0;border:0;border-radius:999px;background:#2563eb;transform:translate(-50%,-80%);cursor:grab;opacity:0}.fpb-element:hover>.fpb-drag,.fpb-element.is-selected>.fpb-drag,.fpb-section:hover>.fpb-drag,.fpb-section.is-selected>.fpb-drag,.fpb-columns:hover>.fpb-drag,.fpb-columns.is-selected>.fpb-drag,.fpb-column:hover>.fpb-drag,.fpb-column.is-selected>.fpb-drag{opacity:1}.fpb-drag:active{cursor:grabbing}.fpb-drop-before{box-shadow:inset 0 3px 0 #2563eb}.fpb-drop-after{box-shadow:inset 0 -3px 0 #2563eb}.fpb-section-body.fpb-drop-inside,.fpb-column-body.fpb-drop-inside{outline:2px solid #2563eb}[contenteditable]{cursor:text}[contenteditable]:focus{outline:none}.fpb-empty{margin:0;padding:2.5rem 1rem;text-align:center;color:#6b7280}';

function caretOffset(root) {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.focusNode)) return 0;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(root);
  range.setEnd(selection.focusNode, selection.focusOffset);
  return range.toString().length;
}

function placeCaret(root, offset) {
  const doc = root.ownerDocument;
  const selection = doc.getSelection();
  if (!selection) return;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode();
  const range = doc.createRange();
  while (node) {
    if (remaining <= node.textContent.length) {
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= node.textContent.length;
    node = walker.nextNode();
  }
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function topNode(slot, node) {
  let current = node;
  while (current.parentElement && current.parentElement !== slot) current = current.parentElement;
  return current.parentElement === slot ? current : null;
}

function clearMarkers(slot) {
  slot.querySelectorAll('.fpb-drop-before, .fpb-drop-after, .fpb-drop-inside').forEach((node) => node.classList.remove('fpb-drop-before', 'fpb-drop-after', 'fpb-drop-inside'));
}

function placeIn(container, event, parentId, selector) {
  const nodes = [...container.querySelectorAll(selector)];
  const child = event.target.closest?.(selector.replace(':scope > ', ''));
  if (child && container.contains(child) && nodes.includes(child)) {
    const index = Math.max(0, nodes.indexOf(child));
    const rect = child.getBoundingClientRect();
    const after = event.clientY > rect.top + rect.height / 2;
    return {parentId, index: index + (after ? 1 : 0), marker: child, after, inside: false};
  }
  return {parentId, index: nodes.length, marker: container, after: true, inside: true};
}

function dropPlace(slot, event, dragging) {
  const kind = dragging || slot.dataset.dragging || '';
  const intoColumn = kind !== 'section' && kind !== 'columns' && kind !== 'column';
  const columnBody = intoColumn ? event.target.closest?.('.fpb-column-body') : null;
  if (columnBody && slot.contains(columnBody)) {
    return placeIn(columnBody, event, columnBody.parentElement?.getAttribute('data-fpb-id') || null, ':scope > .fpb-element');
  }
  const sectionBody = kind === 'column' ? null : event.target.closest?.('.fpb-section-body');
  if (sectionBody && slot.contains(sectionBody)) {
    return placeIn(sectionBody, event, sectionBody.parentElement?.getAttribute('data-fpb-id') || null, ':scope > .fpb-element, :scope > .fpb-columns, :scope > .fpb-section');
  }
  const nodes = [...slot.querySelectorAll(':scope > .fpb-element, :scope > .fpb-section, :scope > .fpb-columns')];
  const raw = event.target.closest?.('.fpb-element, .fpb-section, .fpb-columns');
  const target = raw && slot.contains(raw) ? topNode(slot, raw) : null;
  if (!target) return {parentId: null, index: nodes.length, marker: null, after: false, inside: false};
  const index = Math.max(0, nodes.indexOf(target));
  const rect = target.getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  return {parentId: null, index: index + (after ? 1 : 0), marker: target, after, inside: false};
}

function markDrop(slot, event, dragging) {
  clearMarkers(slot);
  const place = dropPlace(slot, event, dragging);
  if (!place.marker) return;
  place.marker.classList.add(place.inside ? 'fpb-drop-inside' : (place.after ? 'fpb-drop-after' : 'fpb-drop-before'));
}

function readPatch(element, editable) {
  const type = element.getAttribute('data-fpb-type');
  const textOf = (node) => node.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, '');
  if (type === 'list') return {items: [...element.querySelectorAll('li')].map((item) => textOf(item).slice(0, 500))};
  if (type === 'heading' || type === 'paragraph' || type === 'button') {
    const text = type === 'paragraph' ? textOf(editable) : textOf(editable).replace(/\n/g, ' ');
    return {text: text.slice(0, type === 'heading' ? 300 : type === 'button' ? 80 : 5000)};
  }
  return null;
}

function writePatch(element, patch) {
  if (patch.items) {
    [...element.querySelectorAll('li')].forEach((item, index) => {
      item.textContent = patch.items[index] || '';
    });
    return;
  }
  const editable = element.querySelector('[contenteditable]') || element;
  editable.textContent = patch.text || '';
}

function sameIds(markup, slot) {
  return (markup.match(/data-fpb-id="/g) || []).length === slot.querySelectorAll('[data-fpb-id]').length;
}

function markSelected(slot, selected) {
  slot.querySelectorAll('.is-selected').forEach((node) => node.classList.remove('is-selected'));
  const current = selected ? slot.querySelector('[data-fpb-id="' + CSS.escape(selected) + '"]') : null;
  current?.classList.add('is-selected');
}

function animMs(node, name, fallback) {
  const raw = node.ownerDocument.defaultView.getComputedStyle(node).getPropertyValue(name).trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  if (raw.endsWith('s') && !raw.endsWith('ms')) return Math.round(value * 1000);
  return Math.round(value);
}

function replayEntrance(node) {
  if (!node?.classList.contains('fpb-anim')) return;
  if (node._fpbAnimTimer) {
    clearTimeout(node._fpbAnimTimer);
    node._fpbAnimTimer = 0;
  }
  node.classList.remove('is-visible', 'fpb-anim-done');
  const previous = node.style.transition;
  node.style.transition = 'none';
  void node.offsetWidth;
  node.style.transition = previous;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      node.classList.add('is-visible');
      const wait = animMs(node, '--fpb-anim-duration', 600) + animMs(node, '--fpb-anim-delay', 0);
      node._fpbAnimTimer = setTimeout(() => {
        node.classList.add('fpb-anim-done');
        node._fpbAnimTimer = 0;
      }, Math.max(0, wait + 32));
    });
  });
}

export function createCanvas(host) {
  const {React} = host;
  const h = React.createElement;

  return function Canvas({frameHtml, markup, selected, motionPreview = '', onSelect, onInsert, onMove, onText, dragKind}) {
    const frame = React.useRef(null);
    const select = React.useRef(onSelect);
    const insert = React.useRef(onInsert);
    const move = React.useRef(onMove);
    const write = React.useRef(onText);
    const painting = React.useRef(false);
    const applying = React.useRef(false);
    const textUndo = React.useRef([]);
    const textRedo = React.useRef([]);
    const paintNow = React.useRef(() => {});
    const selectedRef = React.useRef(selected);
    const lastMotion = React.useRef('');
    select.current = onSelect;
    insert.current = onInsert;
    move.current = onMove;
    write.current = onText;
    selectedRef.current = selected;

    React.useEffect(() => {
      const node = frame.current;
      if (!node) return undefined;
      function bind() {
        const doc = node.contentDocument;
        const slot = doc?.querySelector('[data-flex-page-builder-slot]');
        if (!slot || slot.dataset.bound === '1') return;
        slot.dataset.bound = '1';
        doc.addEventListener('click', (event) => {
          const target = event.target.closest('[data-fpb-id]');
          select.current(target ? target.getAttribute('data-fpb-id') : null);
        });
        slot.addEventListener('beforeinput', (event) => {
          if (applying.current || String(event.inputType || '').startsWith('history')) return;
          const editable = event.target.closest('[contenteditable]');
          const element = editable?.closest('[data-fpb-id]');
          if (!element) return;
          const patch = readPatch(element, editable);
          if (!patch) return;
          const last = textUndo.current[textUndo.current.length - 1];
          if (last && last.id === element.id && JSON.stringify(last.patch) === JSON.stringify(patch)) return;
          textUndo.current.push({id: element.getAttribute('data-fpb-id'), patch});
          if (textUndo.current.length > 80) textUndo.current.shift();
          textRedo.current = [];
        });
        slot.addEventListener('keydown', (event) => {
          const type = event.target.closest('[data-fpb-id]')?.getAttribute('data-fpb-type');
          if (event.key === 'Enter' && (type === 'heading' || type === 'button' || type === 'list')) event.preventDefault();
          if (!(event.ctrlKey || event.metaKey)) return;
          const key = event.key.toLowerCase();
          if (key !== 'z' && key !== 'y') return;
          if (!event.target.closest('[contenteditable]')) return;
          event.preventDefault();
          event.stopPropagation();
          const undo = key === 'z' && !event.shiftKey;
          const from = undo ? textUndo : textRedo;
          const to = undo ? textRedo : textUndo;
          const step = from.current.pop();
          if (!step) return;
          const element = slot.querySelector('[data-fpb-id="' + CSS.escape(step.id) + '"]');
          if (!element) return;
          const current = readPatch(element, element.querySelector('[contenteditable]') || event.target);
          if (current) to.current.push({id: step.id, patch: current});
          applying.current = true;
          writePatch(element, step.patch);
          write.current(step.id, step.patch);
          applying.current = false;
        });
        slot.addEventListener('input', (event) => {
          const editable = event.target.closest('[contenteditable]');
          const element = editable?.closest('[data-fpb-id]');
          if (!element) return;
          const patch = readPatch(element, editable);
          if (patch) write.current(element.getAttribute('data-fpb-id'), patch);
        });
        slot.addEventListener('focusout', (event) => {
          if (painting.current) return;
          if (!event.target?.isConnected) return;
          if (!event.target.closest?.('[contenteditable]')) return;
          if (event.relatedTarget && slot.contains(event.relatedTarget) && event.relatedTarget.closest('[contenteditable]')) return;
          paintNow.current();
        });
        slot.addEventListener('dragstart', (event) => {
          const handle = event.target.closest?.('.fpb-drag');
          const element = handle?.closest('[data-fpb-id]');
          if (!element) return;
          const id = element.getAttribute('data-fpb-id') || '';
          slot.dataset.dragging = element.getAttribute('data-fpb-type') || '';
          event.dataTransfer.setData('application/x-fpb-id', id);
          event.dataTransfer.setData('text/plain', 'move:' + id);
          event.dataTransfer.effectAllowed = 'move';
        });
        slot.addEventListener('dragend', () => {
          delete slot.dataset.dragging;
          clearMarkers(slot);
        });
        slot.addEventListener('dragover', (event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          markDrop(slot, event, dragKind?.current || '');
        });
        slot.addEventListener('dragleave', (event) => {
          if (event.relatedTarget && slot.contains(event.relatedTarget)) return;
          clearMarkers(slot);
        });
        slot.addEventListener('drop', (event) => {
          event.preventDefault();
          const dragging = slot.dataset.dragging || dragKind?.current || '';
          const place = dropPlace(slot, event, dragging);
          delete slot.dataset.dragging;
          clearMarkers(slot);
          const plain = event.dataTransfer?.getData('text/plain') || '';
          const id = event.dataTransfer?.getData('application/x-fpb-id') || (plain.startsWith('move:') ? plain.slice(5) : '');
          if (id) {
            move.current(id, place.index, place.parentId);
            return;
          }
          const type = event.dataTransfer?.getData('application/x-fpb') || plain;
          if (type) insert.current(type, place.index, place.parentId);
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
        if (painting.current) return;
        const doc = node.contentDocument;
        const slot = doc?.querySelector('[data-flex-page-builder-slot]');
        if (!doc || !slot) return;
        painting.current = true;
        try {
          let style = doc.getElementById('fpb-canvas-style');
          if (!style) {
            style = doc.createElement('style');
            style.id = 'fpb-canvas-style';
            doc.head.appendChild(style);
          }
          if (style.textContent !== CANVAS_STYLE) style.textContent = CANVAS_STYLE;
          if (!doc.getElementById('fpb-patterns-css')) {
            const source = document.querySelector('link[rel="stylesheet"][href*="patterns.css"]');
            const link = doc.createElement('link');
            link.id = 'fpb-patterns-css';
            link.rel = 'stylesheet';
            link.href = source ? source.href : new URL('../patterns.css', import.meta.url).href;
            doc.head.appendChild(link);
          }
          if (!doc.getElementById('fpb-content-css')) {
            const source = document.querySelector('link[rel="stylesheet"][href*="content.css"]');
            const link = doc.createElement('link');
            link.id = 'fpb-content-css';
            link.rel = 'stylesheet';
            link.href = source ? source.href : new URL('../content.css', import.meta.url).href;
            doc.head.appendChild(link);
          }
          if (!doc.querySelector('base')) {
            const base = doc.createElement('base');
            base.href = location.origin + '/';
            doc.head.prepend(base);
          }
          const active = doc.activeElement;
          const editing = active && active.isConnected && slot.contains(active) && active.isContentEditable ? active : null;
          const editingId = editing?.closest('[data-fpb-id]')?.getAttribute('data-fpb-id') || '';
          if (editing && sameIds(markup, slot)) {
            markSelected(slot, selectedRef.current);
            return;
          }
          const editables = editing ? [...editing.closest('[data-fpb-id]').querySelectorAll('[contenteditable]')] : [];
          const editingIndex = editing ? editables.indexOf(editing) : -1;
          const offset = editing ? caretOffset(editing) : 0;
          slot.innerHTML = markup;
          if (editingId) {
            const next = [...(slot.querySelector('[data-fpb-id="' + CSS.escape(editingId) + '"]')?.querySelectorAll('[contenteditable]') || [])];
            const target = next[editingIndex] || next[0];
            if (target) {
              target.focus();
              placeCaret(target, offset);
            }
          }
        } finally {
          painting.current = false;
        }
      }
      paintNow.current = paint;
      node.addEventListener('load', paint);
      paint();
      return () => node.removeEventListener('load', paint);
    }, [markup, frameHtml]);

    React.useEffect(() => {
      if (!motionPreview) {
        lastMotion.current = '';
        return;
      }
      if (motionPreview === lastMotion.current) return;
      lastMotion.current = motionPreview;
      const run = () => {
        const slot = frame.current?.contentDocument?.querySelector('[data-flex-page-builder-slot]');
        const preview = selected
          ? slot?.querySelector('[data-fpb-id="' + CSS.escape(selected) + '"].fpb-anim')
          : null;
        if (preview) replayEntrance(preview);
      };
      // Wait one frame so markup paint (same render) can land first.
      requestAnimationFrame(run);
    }, [motionPreview, selected]);

    return h('iframe', {ref: frame, className: 'fpb-frame', title: 'Преглед на страницата'});
  };
}
