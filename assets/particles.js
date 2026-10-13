(function () {
  if (window.__fpbParticles) {
    window.__fpbParticles.scan();
    return;
  }

  var KINDS = ['dots', 'links', 'bubbles', 'snow', 'stars'];
  var BASE_AREA = 1280 * 560;
  var LINK_DISTANCE = 120;
  var reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  var instances = [];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function rgb(hex) {
    var value = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex || '') ? hex.slice(1) : 'ffffff';
    if (value.length === 3) value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    return parseInt(value.slice(0, 2), 16) + ',' + parseInt(value.slice(2, 4), 16) + ',' + parseInt(value.slice(4, 6), 16);
  }

  function intAttr(node, name, fallback, min, max) {
    var value = parseInt(node.getAttribute(name) || '', 10);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  /** `anywhere` spreads the first batch over the box; respawns enter from an edge. */
  function spawn(kind, width, height, speed, anywhere) {
    var p = {x: rand(0, width), y: rand(0, height), r: 1, vx: 0, vy: 0, alpha: 1, phase: rand(0, Math.PI * 2), twinkle: 0};
    if (kind === 'dots' || kind === 'links') {
      var angle = rand(0, Math.PI * 2);
      var velocity = rand(0.15, 0.5) * speed;
      p.r = kind === 'dots' ? rand(1, 3.2) : rand(1, 2.2);
      p.vx = Math.cos(angle) * velocity;
      p.vy = Math.sin(angle) * velocity;
      p.alpha = rand(0.35, 0.9);
    } else if (kind === 'bubbles') {
      p.r = rand(4, 18);
      p.vx = rand(-0.12, 0.12) * speed;
      p.vy = -rand(0.3, 0.9) * speed;
      p.alpha = rand(0.2, 0.55);
      if (!anywhere) p.y = height + p.r + rand(0, height * 0.2);
    } else if (kind === 'snow') {
      p.r = rand(1, 3.5);
      p.vy = rand(0.3, 1) * speed;
      p.alpha = rand(0.45, 0.95);
      if (!anywhere) p.y = -p.r - rand(0, 20);
    } else {
      p.r = rand(0.5, 1.8);
      p.alpha = rand(0.3, 1);
      p.twinkle = rand(0.006, 0.03) * speed;
    }
    return p;
  }

  function step(kind, p, width, height, speed, dt) {
    if (kind === 'dots' || kind === 'links') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -10) p.x = width + 10;
      else if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      else if (p.y > height + 10) p.y = -10;
      return true;
    }
    if (kind === 'bubbles') {
      p.phase += 0.02 * dt;
      p.x += (p.vx + Math.sin(p.phase) * 0.25) * dt;
      p.y += p.vy * dt;
      return p.y > -p.r - 4;
    }
    if (kind === 'snow') {
      p.phase += 0.012 * dt;
      p.x += Math.sin(p.phase) * 0.45 * speed * dt;
      p.y += p.vy * dt;
      if (p.x < -10) p.x = width + 10;
      else if (p.x > width + 10) p.x = -10;
      return p.y < height + p.r + 4;
    }
    p.phase += p.twinkle * dt;
    return true;
  }

  function Instance(layer) {
    this.layer = layer;
    this.kind = KINDS.indexOf(layer.getAttribute('data-fpb-particles')) >= 0 ? layer.getAttribute('data-fpb-particles') : 'dots';
    this.color = rgb(layer.getAttribute('data-color'));
    this.density = intAttr(layer, 'data-density', 50, 10, 150);
    this.speed = intAttr(layer, 'data-speed', 3, 1, 10) / 3;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;
    this.width = 0;
    this.height = 0;
    this.items = [];
    this.pointer = null;
    this.visible = false;
    this.frame = 0;
    this.last = 0;
    layer.textContent = '';
    layer.appendChild(this.canvas);
    layer.__fpbParticles = this;

    var self = this;
    this.tick = function (now) {
      self.frame = 0;
      if (!self.layer.isConnected) {
        self.destroy();
        return;
      }
      var dt = self.last ? Math.min(3, (now - self.last) / 16.667) : 1;
      self.last = now;
      self.update(dt);
      self.draw();
      self.schedule();
    };
    this.onResize = function () {
      self.resize();
    };
    this.onPointer = function (event) {
      var box = self.canvas.getBoundingClientRect();
      self.pointer = {x: event.clientX - box.left, y: event.clientY - box.top};
    };
    this.onLeave = function () {
      self.pointer = null;
    };

    if (typeof ResizeObserver === 'function') {
      this.resizer = new ResizeObserver(this.onResize);
      this.resizer.observe(layer);
    } else {
      window.addEventListener('resize', this.onResize);
    }
    if (typeof IntersectionObserver === 'function') {
      this.watcher = new IntersectionObserver(function (entries) {
        self.visible = entries[entries.length - 1].isIntersecting;
        self.last = 0;
        self.schedule();
      });
      this.watcher.observe(layer);
    } else {
      this.visible = true;
    }
    if (this.kind === 'links' && layer.parentElement) {
      layer.parentElement.addEventListener('pointermove', this.onPointer);
      layer.parentElement.addEventListener('pointerleave', this.onLeave);
    }
    this.resize();
    this.schedule();
  }

  Instance.prototype.resize = function () {
    var width = this.layer.clientWidth;
    var height = this.layer.clientHeight;
    if (!width || !height) return;
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    var changed = width !== this.width || height !== this.height;
    this.width = width;
    this.height = height;
    if (changed) {
      var count = Math.max(5, Math.min(300, Math.round(this.density * (width * height) / BASE_AREA)));
      while (this.items.length > count) this.items.pop();
      while (this.items.length < count) this.items.push(spawn(this.kind, width, height, this.speed, true));
      this.items.forEach(function (p) {
        if (p.x > width) p.x = rand(0, width);
        if (p.y > height) p.y = rand(0, height);
      });
    }
    this.draw();
  };

  Instance.prototype.still = function () {
    return !!(reducedMotion && reducedMotion.matches);
  };

  Instance.prototype.schedule = function () {
    if (this.frame || !this.visible || this.still() || !this.layer.isConnected) return;
    var self = this;
    this.frame = requestAnimationFrame(function (now) {
      self.tick(now);
    });
  };

  Instance.prototype.update = function (dt) {
    for (var index = 0; index < this.items.length; index++) {
      if (!step(this.kind, this.items[index], this.width, this.height, this.speed, dt)) {
        this.items[index] = spawn(this.kind, this.width, this.height, this.speed, false);
      }
    }
  };

  Instance.prototype.draw = function () {
    var ctx = this.ctx;
    var color = this.color;
    var kind = this.kind;
    ctx.clearRect(0, 0, this.width, this.height);
    if (kind === 'links') this.drawLinks();
    for (var index = 0; index < this.items.length; index++) {
      var p = this.items[index];
      var alpha = kind === 'stars' ? p.alpha * (0.45 + 0.55 * Math.abs(Math.sin(p.phase))) : p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (kind === 'bubbles') {
        ctx.fillStyle = 'rgba(' + color + ',' + (alpha * 0.25).toFixed(3) + ')';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(' + color + ',' + alpha.toFixed(3) + ')';
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(' + color + ',' + alpha.toFixed(3) + ')';
        ctx.fill();
      }
    }
  };

  Instance.prototype.drawLinks = function () {
    var ctx = this.ctx;
    var items = this.items;
    var max = LINK_DISTANCE * LINK_DISTANCE;
    ctx.lineWidth = 1;
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        var dx = items[i].x - items[j].x;
        var dy = items[i].y - items[j].y;
        var distance = dx * dx + dy * dy;
        if (distance > max) continue;
        ctx.strokeStyle = 'rgba(' + this.color + ',' + ((1 - Math.sqrt(distance) / LINK_DISTANCE) * 0.45).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(items[i].x, items[i].y);
        ctx.lineTo(items[j].x, items[j].y);
        ctx.stroke();
      }
      if (this.pointer) {
        var px = items[i].x - this.pointer.x;
        var py = items[i].y - this.pointer.y;
        var reach = px * px + py * py;
        if (reach < max * 1.5) {
          ctx.strokeStyle = 'rgba(' + this.color + ',' + ((1 - Math.sqrt(reach / 1.5) / LINK_DISTANCE) * 0.6).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(items[i].x, items[i].y);
          ctx.lineTo(this.pointer.x, this.pointer.y);
          ctx.stroke();
        }
      }
    }
  };

  Instance.prototype.destroy = function () {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.resizer) this.resizer.disconnect();
    else window.removeEventListener('resize', this.onResize);
    if (this.watcher) this.watcher.disconnect();
    if (this.layer.parentElement) {
      this.layer.parentElement.removeEventListener('pointermove', this.onPointer);
      this.layer.parentElement.removeEventListener('pointerleave', this.onLeave);
    }
    this.layer.__fpbParticles = null;
    var at = instances.indexOf(this);
    if (at >= 0) instances.splice(at, 1);
  };

  function scan() {
    instances.slice().forEach(function (instance) {
      if (!instance.layer.isConnected) instance.destroy();
    });
    document.querySelectorAll('.fpb-section-particles[data-fpb-particles]').forEach(function (layer) {
      if (layer.__fpbParticles) return;
      var instance = new Instance(layer);
      if (instance.ctx) instances.push(instance);
    });
  }

  var pending = 0;
  function queueScan() {
    if (pending) return;
    pending = requestAnimationFrame(function () {
      pending = 0;
      scan();
    });
  }

  function boot() {
    scan();
    if (typeof MutationObserver === 'function') {
      new MutationObserver(queueScan).observe(document.documentElement, {childList: true, subtree: true});
    }
    if (reducedMotion && typeof reducedMotion.addEventListener === 'function') {
      reducedMotion.addEventListener('change', function () {
        instances.forEach(function (instance) {
          instance.schedule();
          instance.draw();
        });
      });
    }
  }

  window.__fpbParticles = {scan: scan};
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
