const ACTIVE_ELEMENTS = 'script,iframe,object,embed,form,input,select,textarea'
const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'del', 'em', 'i', 'img', 'ins', 'kbd',
  'label', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var',
])
const GROUP_ELEMENTS = new Set(['article', 'aside', 'div', 'figure', 'footer', 'header', 'main', 'nav', 'ol', 'section', 'ul'])

function hasActiveMarkup(document) {
  if (document.querySelector(ACTIVE_ELEMENTS)) return true
  if ([...document.querySelectorAll('meta[http-equiv]')].some((node) => node.httpEquiv.toLowerCase() === 'refresh')) return true
  return [...document.querySelectorAll('*')].some((node) =>
    node.localName.includes('-') || [...node.attributes].some((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      return name.startsWith('on') || name === 'srcdoc' ||
        (['href', 'src', 'action', 'formaction', 'xlink:href', 'srcset'].includes(name) && /^javascript\s*:/i.test(value))
    }))
}

function elementLabel(node) {
  const tag = node.tagName.toLowerCase()
  const identifier = node.getAttribute('aria-label') || node.id || node.getAttribute('class')
  const text = node.querySelector('h1,h2,h3,p')?.textContent || node.textContent || ''
  const summary = String(identifier || text).replace(/\s+/g, ' ').trim().slice(0, 42)
  return summary ? `${tag} — ${summary}` : tag
}

function escapeText(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function safePreview(html) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll(`${ACTIVE_ELEMENTS},meta[http-equiv="refresh"]`).forEach((node) => node.remove())
  for (const node of document.querySelectorAll('*')) {
    if (node.localName.includes('-')) {
      node.remove()
      continue
    }
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc' ||
        (['href', 'src', 'action', 'formaction', 'xlink:href', 'srcset'].includes(name) && /^javascript\s*:/i.test(attribute.value.trim()))) {
        node.removeAttribute(attribute.name)
      }
    }
  }
  const styles = [...document.head.children]
    .filter((node) => node.tagName.toLowerCase() === 'style' ||
      (node.tagName.toLowerCase() === 'link' && node.rel.toLowerCase().split(/\s+/).includes('stylesheet')))
    .map((node) => node.outerHTML)
    .join('')
  return styles + document.body.innerHTML
}

const EDITABLE_TEXT_TAGS = new Set([
  'a', 'b', 'blockquote', 'button', 'caption', 'dd', 'dt', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'i', 'label', 'li', 'p', 'small', 'span', 'strong', 'em', 'time',
])

/** Add editor-only controls to leaf text nodes; the original source stays untouched. */
export function editableHtmlPreview(html) {
  const document = new DOMParser().parseFromString(String(html || ''), 'text/html')
  for (const node of document.body.querySelectorAll('*')) {
    if (!EDITABLE_TEXT_TAGS.has(node.tagName.toLowerCase()) || node.children.length || !node.textContent.trim()) continue
    if (node.closest('svg,style,script,pre,code,[contenteditable]')) continue
    node.setAttribute('data-fpb-import-editable', 'true')
    node.setAttribute('contenteditable', 'plaintext-only')
  }
  return [...document.head.children]
    .filter((node) => node.tagName.toLowerCase() === 'style' ||
      (node.tagName.toLowerCase() === 'link' && node.rel.toLowerCase().split(/\s+/).includes('stylesheet')))
    .map((node) => node.outerHTML)
    .join('') + document.body.innerHTML
}

/** Decorate the original root node in the canvas without inserting layout-changing wrappers. */
export function nestedHtmlPreview(html, id, type = 'html') {
  const document = new DOMParser().parseFromString(String(html || ''), 'text/html')
  const root = document.body.firstElementChild
  if (root) {
    if (!root.classList.contains('fpb-element')) root.setAttribute('data-fpb-import-added-class', 'true')
    root.classList.add('fpb-element')
    for (const [name, value] of [['data-fpb-id', id], ['data-fpb-type', type]]) {
      if (root.hasAttribute(name)) root.setAttribute('data-fpb-import-original-' + name.slice(9), root.getAttribute(name))
      root.setAttribute(name, value)
    }
    root.setAttribute('data-fpb-nested-imported', 'true')
  }
  return [...document.head.children]
    .filter((node) => node.tagName.toLowerCase() === 'style' ||
      (node.tagName.toLowerCase() === 'link' && node.rel.toLowerCase().split(/\s+/).includes('stylesheet')))
    .map((node) => node.outerHTML)
    .join('') + document.body.innerHTML
}

function makeImportedNode(node, nextId, t, budget, depth = 0, reserved = false) {
  const id = `external-${nextId()}`
  const label = elementLabel(node)
  const childNodes = [...node.children].filter((child) => !['style', 'link', 'template'].includes(child.tagName.toLowerCase()))
  if (GROUP_ELEMENTS.has(node.tagName.toLowerCase()) && childNodes.length && depth < 8 && budget.remaining >= childNodes.length) {
    budget.remaining -= childNodes.length
    const children = childNodes.map((child) => makeImportedNode(child, nextId, t, budget, depth + 1, true))
    const clone = node.cloneNode(true)
    const cloneChildren = [...clone.children].filter((child) => !['style', 'link', 'template'].includes(child.tagName.toLowerCase()))
    cloneChildren.forEach((child) => child.replaceWith(node.ownerDocument.createComment('fpb-slot')))
    return {
      id,
      type: 'imported_group',
      html: clone.outerHTML,
      children,
      imported: true,
      name: t('Imported component: {label}', {label}),
    }
  }
  const html = node.outerHTML
  return {
    id,
    type: 'html',
    html,
    preview_html: editableHtmlPreview(html),
    imported: true,
    name: t('Imported component: {label}', {label}),
  }
}

function opaque(html, t) {
  return html.trim() ? [{
    id: 'imported',
    type: 'html',
    html,
    preview_html: safePreview(html),
    opaque_external: true,
    name: t('External HTML (kept as one block)'),
  }] : []
}

/** Split only passive HTML into top-level opaque blocks; active markup remains one block. */
export function importHtmlComponents(html, t = (source) => source) {
  const source = String(html || '')
  if (!source.trim()) return {elements: [], decomposed: false, blocked: false}

  const document = new DOMParser().parseFromString(source, 'text/html')
  if (/<\?(?:php|=)/i.test(source)) {
    return {
      elements: opaque(source, t),
      decomposed: false,
      blocked: true,
      notice: t('This content includes PHP source. Page Builder only receives rendered HTML, so it is kept intact.'),
    }
  }
  if (hasActiveMarkup(document)) {
    return {
      elements: opaque(source, t),
      decomposed: false,
      blocked: true,
      notice: t('This HTML contains scripts or active elements. It is kept as one block so its behavior is not changed.'),
    }
  }

  let prefix = [...document.head.children]
    .filter((node) => node.tagName.toLowerCase() === 'style' ||
      (node.tagName.toLowerCase() === 'link' && node.rel.toLowerCase().split(/\s+/).includes('stylesheet')))
    .map((node) => node.outerHTML)
    .join('')
  const parts = []
  let inlineIndex = -1
  const appendInline = (markup, label) => {
    if (inlineIndex >= 0) {
      parts[inlineIndex].html += markup
      return
    }
    parts.push({html: prefix + markup, label})
    prefix = ''
    inlineIndex = parts.length - 1
  }

  for (const node of document.body.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent.trim()) {
        if (parts.length) parts[parts.length - 1].html += node.textContent
        else prefix += node.textContent
        continue
      }
      appendInline(`<span>${escapeText(node.textContent)}</span>`, 'text')
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      if (node.nodeType === Node.COMMENT_NODE) {
        if (parts.length) parts[parts.length - 1].html += node.outerHTML || `<!--${node.textContent}-->`
        else prefix += `<!--${node.textContent}-->`
      }
      continue
    }
    const tag = node.tagName.toLowerCase()
    if (tag === 'main' && !node.textContent.trim() && !node.querySelector('img,svg,picture,video,canvas')) continue
    const markup = node.outerHTML
    if (INLINE_ELEMENTS.has(tag)) {
      appendInline(markup, elementLabel(node))
    } else {
      inlineIndex = -1
      parts.push({html: prefix + markup, label: elementLabel(node)})
      prefix = ''
    }
  }
  if (prefix.trim()) {
    if (parts.length) parts[parts.length - 1].html += prefix
    else parts.push({html: prefix, label: 'HTML'})
  }

  if (!parts.length) {
    return {
      elements: opaque(source, t),
      decomposed: false,
      blocked: true,
      notice: t('This HTML has no safely separable visual blocks. It is kept intact.'),
    }
  }
  if (parts.length > 200 || parts.some((part) => part.html.length > 200000)) {
    return {
      elements: opaque(source, t),
      decomposed: false,
      blocked: true,
      notice: t('This HTML is too large to split safely. It is kept as one block.'),
    }
  }

  let nextId = 0
  const takeId = () => ++nextId
  const budget = {remaining: Math.max(0, 200 - parts.length)}
  const elements = parts.map((part) => {
    const partDocument = new DOMParser().parseFromString(part.html, 'text/html')
    const roots = [...partDocument.body.children].filter((node) => !['style', 'link', 'template'].includes(node.tagName.toLowerCase()))
    if (roots.length !== 1 || INLINE_ELEMENTS.has(roots[0]?.tagName.toLowerCase())) {
      return {
        id: `external-${takeId()}`,
        type: 'html',
        html: part.html,
        preview_html: editableHtmlPreview(part.html),
        imported: true,
        name: t('Imported component: {label}', {label: part.label}),
      }
    }
    const styles = [...partDocument.head.children]
      .filter((node) => node.tagName.toLowerCase() === 'style' ||
        (node.tagName.toLowerCase() === 'link' && node.rel.toLowerCase().split(/\s+/).includes('stylesheet')))
      .map((node) => node.outerHTML).join('')
    const imported = makeImportedNode(roots[0], takeId, t, budget, 0, true)
    if (imported.type === 'imported_group') imported.html = styles + imported.html
    else {
      imported.html = styles + imported.html
      imported.preview_html = editableHtmlPreview(imported.html)
    }
    return imported
  })
  return {
    elements,
    decomposed: true,
    blocked: false,
    notice: t('Imported HTML is split into selectable blocks. You can edit eligible text while the original markup and design stay in place.'),
  }
}
