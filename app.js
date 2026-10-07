/* Psychedelic pointer field.
 * Dependency-free 2D canvas particle system.
 * Moving a mouse or dragging a finger swirls and recolors the field.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('scene');
  var hint = document.getElementById('hint');
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  var DPR_CAP = 2;
  var PARTICLE_MIN = 260;
  var PARTICLE_MAX = 900;
  var AREA_PER_PARTICLE = 2400; // tuned so a laptop screen gets ~600 particles
  var SWIRL_RADIUS = 220;       // px of pointer influence
  var MAX_SPEED = 18;           // px/frame clamp, keeps motion stable
  var FRICTION = 0.955;
  var FADE_ALPHA = 0.07;        // translucent clear => trails build up

  var dpr = 1;
  var width = 0;
  var height = 0;
  var particles = [];

  var pointer = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    down: false,
    seen: false
  };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function targetCount() {
    return Math.round(clamp((width * height) / AREA_PER_PARTICLE, PARTICLE_MIN, PARTICLE_MAX));
  }

  function makeParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      px: 0,
      py: 0,
      vx: rand(-0.2, 0.2),
      vy: rand(-0.2, 0.2),
      hue: Math.random() * 360,
      hueSpeed: rand(10, 34),
      size: rand(1.1, 3.4),
      drift: rand(0.6, 1.5),
      phase: Math.random() * Math.PI * 2
    };
  }

  function syncParticleCount() {
    var want = targetCount();
    while (particles.length < want) particles.push(makeParticle());
    if (particles.length > want) particles.length = want;
  }

  function resize() {
    dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    syncParticleCount();
  }

  function hideHint() {
    if (hint && !hint.classList.contains('hidden')) {
      hint.classList.add('hidden');
    }
  }

  function markInteraction() {
    if (!pointer.seen) pointer.seen = true;
    hideHint();
  }

  function readPointer(e) {
    var x = e.clientX;
    var y = e.clientY;
    if (pointer.seen) {
      // Accumulate movement between frames; speed drives swirl strength.
      pointer.vx += x - pointer.x;
      pointer.vy += y - pointer.y;
    } else {
      pointer.x = x;
      pointer.y = y;
    }
    pointer.x = x;
    pointer.y = y;
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch') e.preventDefault();
    readPointer(e);
    markInteraction();
  }

  function onPointerDown(e) {
    if (e.pointerType === 'touch') e.preventDefault();
    pointer.down = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.vx = 0;
    pointer.vy = 0;
    markInteraction();
  }

  function onPointerUp() {
    pointer.down = false;
  }

  function onTouchScroll(e) {
    // Block page scrolling / pinch so drags paint instead of pan.
    e.preventDefault();
  }

  function updateParticle(p, dt, speed, t) {
    // Gentle organic drift keeps the field alive with no input.
    p.vx += Math.cos(t * 0.00035 + p.phase) * 0.03 * p.drift;
    p.vy += Math.sin(t * 0.00045 + p.phase * 1.3) * 0.03 * p.drift;

    if (pointer.seen) {
      var dx = p.x - pointer.x;
      var dy = p.y - pointer.y;
      var d2 = dx * dx + dy * dy;
      if (d2 < SWIRL_RADIUS * SWIRL_RADIUS) {
        var d = Math.sqrt(d2) + 0.0001;
        var falloff = 1 - d / SWIRL_RADIUS;
        falloff *= falloff;

        // Tangential force -> churn/swirl around the pointer.
        var swirl = (0.7 + speed * 0.05) * falloff;
        p.vx += (-dy / d) * swirl;
        p.vy += (dx / d) * swirl;

        // Push in the direction the pointer is travelling.
        p.vx += pointer.vx * 0.035 * falloff;
        p.vy += pointer.vy * 0.035 * falloff;
      }
    }

    p.vx *= FRICTION;
    p.vy *= FRICTION;

    var sp = Math.hypot(p.vx, p.vy);
    if (sp > MAX_SPEED) {
      var scale = MAX_SPEED / sp;
      p.vx *= scale;
      p.vy *= scale;
    }

    p.px = p.x;
    p.py = p.y;
    p.x += p.vx;
    p.y += p.vy;

    // Wrap so particles recirculate forever (no unbounded growth).
    if (p.x < -10) { p.x = width + 10; p.px = p.x; }
    else if (p.x > width + 10) { p.x = -10; p.px = p.x; }
    if (p.y < -10) { p.y = height + 10; p.py = p.y; }
    else if (p.y > height + 10) { p.y = -10; p.py = p.y; }

    p.hue = (p.hue + p.hueSpeed * dt) % 360;
  }

  function drawParticle(p, alpha) {
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = 'hsla(' + p.hue.toFixed(1) + ', 100%, 58%, ' + alpha + ')';
    ctx.lineWidth = p.size;
    ctx.stroke();
  }

  function frame() {
    requestAnimationFrame(frame);

    var now = performance.now();
    var dt = clamp((now - frame.last) / 1000, 0, 0.05) || 0.016;
    frame.last = now;

    var speed = Math.hypot(pointer.vx, pointer.vy);
    // Boost alpha slightly while actively swirling so strokes read clearly.
    var alpha = clamp(0.22 + speed * 0.01, 0.22, 0.55);

    // Translucent clear leaves trails that slowly fade and recolor.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, ' + FADE_ALPHA + ')';
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      updateParticle(p, dt, speed, now);
      drawParticle(p, alpha);
    }

    // Decay accumulated pointer velocity between frames.
    pointer.vx *= 0.82;
    pointer.vy *= 0.82;
  }
  frame.last = performance.now();

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', resize, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  window.addEventListener('touchstart', onTouchScroll, { passive: false });
  window.addEventListener('touchmove', onTouchScroll, { passive: false });

  resize();
  requestAnimationFrame(frame);
})();
