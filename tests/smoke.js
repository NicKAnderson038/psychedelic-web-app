'use strict';

/*
 * tests/smoke.js — dependency-free Node smoke test for app.js
 *
 * Loads and executes the browser IIFE in app.js by shimming the minimal
 * DOM/canvas surface it touches, then asserts that the app:
 *   1. initializes (canvas sized from window.innerWidth/innerHeight/DPR)
 *   2. animates (particles stroke during a frame)
 *   3. hides the hint after a synthetic pointer move
 *   4. keeps animating on subsequent frames
 *
 * Exits non-zero with a clear message on any assertion failure and prints
 * "SMOKE PASS" on success.
 */

var path = require('path');

var failures = [];

function fail(msg) {
  failures.push(msg);
  console.error('SMOKE FAIL: ' + msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
  return cond;
}

/* ---- controllable clock (performance.now => Date.now) ------------------ */
var realDateNow = Date.now;
var clock = 1000000;
Date.now = function () { return clock; };
function advanceClock(ms) { clock += ms; }

/* ---- fake 2D rendering context ---------------------------------------- */
var strokeCount = 0;
var fillRectCount = 0;

function makeContext() {
  return {
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    fillStyle: '',
    globalCompositeOperation: '',
    setTransform: function () {},
    beginPath: function () {},
    moveTo: function () {},
    lineTo: function () {},
    stroke: function () { strokeCount++; },
    fillRect: function () { fillRectCount++; }
  };
}

/* ---- fake canvas ------------------------------------------------------- */
var fakeCtx = makeContext();
var canvas = {
  width: 0,
  height: 0,
  style: {},
  getContext: function (type, opts) {
    // app.js requests ('2d', { alpha: false }) and bails if falsy.
    return type === '2d' ? fakeCtx : null;
  }
};

/* ---- fake #hint element ------------------------------------------------ */
var hintClasses = new Set();
var hint = {
  classList: {
    add: function (c) { hintClasses.add(c); },
    contains: function (c) { return hintClasses.has(c); }
  }
};

/* ---- fake document ----------------------------------------------------- */
global.document = {
  getElementById: function (id) {
    if (id === 'scene') return canvas;
    if (id === 'hint') return hint;
    return null;
  }
};

/* ---- fake window ------------------------------------------------------- */
// Node's EventTarget provides addEventListener/dispatchEvent. Augment with
// the geometry properties app.js reads during resize().
global.window = Object.assign(new EventTarget(), {
  innerWidth: 800,
  innerHeight: 600,
  devicePixelRatio: 2
});

/* ---- fake rAF: capture the callback, never auto-run -------------------- */
var rafCallback = null;
global.requestAnimationFrame = function (cb) {
  rafCallback = cb;
  return 1;
};

/* ---- fake performance -------------------------------------------------- */
global.performance = { now: function () { return Date.now(); } };

/* ---- synthetic pointer event ------------------------------------------ */
function PointerEventShim(type, props) {
  var e = new Event(type);
  Object.keys(props || {}).forEach(function (k) { e[k] = props[k]; });
  return e;
}

/* ---- execute the app --------------------------------------------------- */
var appPath = path.join(__dirname, '..', 'app.js');
require(appPath);

assert(typeof rafCallback === 'function', 'app.js did not schedule an animation frame on init');

/* app.js calls resize() before the first rAF: canvas should be sized. */
var expectedW = Math.round(800 * 2);
var expectedH = Math.round(600 * 2);
assert(canvas.width === expectedW,
  'canvas.width expected ' + expectedW + ' (innerWidth 800 * dpr 2), got ' + canvas.width);
assert(canvas.height === expectedH,
  'canvas.height expected ' + expectedH + ' (innerHeight 600 * dpr 2), got ' + canvas.height);
assert(canvas.style.width === '800px',
  'canvas.style.width expected "800px", got ' + JSON.stringify(canvas.style.width));
assert(canvas.style.height === '600px',
  'canvas.style.height expected "600px", got ' + JSON.stringify(canvas.style.height));

/* ---- run a few frames and assert drawing ------------------------------- */
function runFrame(advanceMs) {
  advanceClock(advanceMs);
  var cb = rafCallback;
  if (typeof cb !== 'function') {
    fail('no captured requestAnimationFrame callback to run');
    return false;
  }
  cb();
  return true;
}

strokeCount = 0;
fillRectCount = 0;
var frames = 3;
for (var i = 0; i < frames; i++) runFrame(16);

assert(strokeCount > 0,
  'expected particles to stroke during frames, but stroke() was called ' + strokeCount + ' times');
assert(fillRectCount === frames,
  'expected one translucent clear fillRect per frame (' + frames + '), got ' + fillRectCount);

/* ---- synthetic pointer move -> hint hidden ----------------------------- */
assert(!hintClasses.has('hidden'), 'hint should start visible (no "hidden" class)');

window.dispatchEvent(PointerEventShim('pointermove', {
  clientX: 100, clientY: 120, pointerType: 'mouse'
}));
window.dispatchEvent(PointerEventShim('pointermove', {
  clientX: 160, clientY: 180, pointerType: 'mouse'
}));

assert(hintClasses.has('hidden'),
  'expected hint to gain "hidden" class after pointermove, classes=' + JSON.stringify(Array.from(hintClasses)));

/* ---- keep animating after interaction ---------------------------------- */
strokeCount = 0;
runFrame(16);
runFrame(16);
assert(strokeCount > 0,
  'expected drawing to continue after interaction, but stroke() was called ' + strokeCount + ' times');

/* ---- result ------------------------------------------------------------ */
Date.now = realDateNow;

if (failures.length) {
  console.error('SMOKE FAIL: ' + failures.length + ' assertion(s) failed.');
  process.exit(1);
}

console.log('SMOKE PASS');
