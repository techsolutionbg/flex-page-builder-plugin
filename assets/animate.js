(function () {
  function animMs(node, name, fallback) {
    var raw = getComputedStyle(node).getPropertyValue(name).trim();
    var value = parseFloat(raw);
    if (!Number.isFinite(value)) return fallback;
    if (raw.endsWith('s') && !raw.endsWith('ms')) return Math.round(value * 1000);
    return Math.round(value);
  }

  function finish(node) {
    node.classList.add('fpb-anim-done');
  }

  function reveal(node) {
    node.classList.remove('fpb-anim-done');
    node.classList.add('is-visible');
    var wait = animMs(node, '--fpb-anim-duration', 600) + animMs(node, '--fpb-anim-delay', 0);
    window.setTimeout(function () {
      finish(node);
    }, Math.max(0, wait + 32));
  }

  function watch(root) {
    var nodes = root.querySelectorAll('.fpb-anim:not(.is-visible)');
    if (!nodes.length) return;
    if (typeof IntersectionObserver !== 'function') {
      nodes.forEach(reveal);
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, {root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.12});
    nodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  function boot() {
    watch(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
