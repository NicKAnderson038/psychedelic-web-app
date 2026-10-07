'use strict';

/*
 * tests/repro-wrap-artifact.js — focused reproducer for a suspected drawing
 * defect in app.js.
 *
 * Suspected defect:
 *   updateParticle() stores p.px/p.py before integrating motion, then teleports
 *   p.x/p.y to the opposite edge when a particle leaves the +/-10px wrap margin
 *   (app.js lines ~177-181). drawParticle() then strokes a segment from the
 *   pre-teleport position to the post-teleport position (app.js lines ~186-193),
 *   so a wrapping particle paints a line spanning most of the canvas.
 *
 * This harness shims the DOM/canvas, runs many frames, and measures each
 * stroked segment's length. Legitimate motion is clamped to MAX_SPEED (18px),
 * so any segment longer than 100px is a teleport streak.
 *
 * Exit 1 if artifacts are found (defect reproduced); exit 0 if none are found.
 */

var path = require('path');

var LONG_SEGMENT_PX = 100;

var realDateNow = Date.now;
var clock = 1000000;
Date.now = function () { return clock; };

var strokeCount = 0;
var longCount = 0;
var firstArtifact = null;
var frameIndex = 0;
var maxLen = 0;

var currentFrom = null;

var ctx = {
  strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
  fillStyle: '', globalCompositeOperation: '',
  setTransform: function () {},
  beginPath: function () { currentFrom = null; },
  moveTo: function (x, y) { currentFrom = { x: x, y: y }; },
  lineTo: function (x, y) {
    if (!currentFrom) return;
    var dx = x - currentFrom.x;
    var dy = y - currentFrom.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > maxLen) maxLen = len;
    if (len > LONG_SEGMENT_PX) {
      longCount++;
      if (!firstArtifact) {
        firstArtifact = {
          frame: frameIndex,
          from: { x: currentFrom.x, y: currentFrom.y },
          to: { x: x, y: y },
          len: Math.round(len)
        };
      }
    }
  },
  stroke: function () { strokeCount++; },
  fillRect: function () {}
};

var canvas = {
  width: 0,
  height: 0,
  style: {},
  getContext: function (type) { return type === '2d' ? ctx : null; }
};

var hint = {
  classList: { add: function () {}, contains: function () { return false; } }
};

global.document = {
  getElementById: function (id) {
    if (id === 'scene') return canvas;
    if (id === 'hint') return hint;
    return null;
  }
};

global.window = Object.assign(new EventTarget(), {
  innerWidth: 800,
  innerHeight: 600,
  devicePixelRatio: 2
});

var rafCallback = null;
global.requestAnimationFrame = function (cb) { rafCallback = cb; return 1; };
global.performance = { now: function () { return Date.now(); } };

require(path.join(__dirname, '..', 'app.js'));

var FRAMES = 3000;
for (frameIndex = 0; frameIndex < FRAMES; frameIndex++) {
  clock += 16;
  if (typeof rafCallback !== 'function') break;
  rafCallback();
}

Date.now = realDateNow;

console.log('frames run:        ' + frameIndex);
console.log('stroke calls:      ' + strokeCount);
console.log('long segments >' + LONG_SEGMENT_PX + 'px: ' + longCount);
console.log('max segment (px):  ' + Math.round(maxLen));
if (firstArtifact) {
  console.log('first artifact at frame ' + firstArtifact.frame + ': ' +
    '(' + Math.round(firstArtifact.from.x) + ',' + Math.round(firstArtifact.from.y) + ') -> ' +
    '(' + Math.round(firstArtifact.to.x) + ',' + Math.round(firstArtifact.to.y) + ') len=' +
    firstArtifact.len + 'px (canvas 800x600 dpr2)');
  console.log('DEFECT REPRODUCED');
  process.exit(1);
}

console.log('NO ARTIFACT FOUND (inconclusive)');
process.exit(0);
