const { select } = require('d3');
const { floor, min, max, sqrt, pow } = Math;
const $ = require('jquery');


////////////////////////////////////////////////////////////////////////////////
// MATH HELPERS

const clamp = (min, x, max) => (x < min) ? min : (x > max) ? max : x;
const square = (x) => pow(x, 2);


////////////////////////////////////////////////////////////////////////////////
// ARRAY HELPERS

const last = (array) => array[array.length - 1];
const spliceOut = (elem, array) => {
  const idx = array.indexOf(elem);
  if (idx >= 0) array.splice(idx, 1);
};


////////////////////////////////////////////////////////////////////////////////
// FUNCTION HELPERS

const immediate = (f) => {
  f();
  return f;
};


////////////////////////////////////////////////////////////////////////////////
// D3 HELPERS

// fetch a template from the DOM.
const getTemplate = (name) => select(`#vannot-templates .vannot-${name}`);

// boilerplate reduction: instantiates missing selection data elements with the
// given template, returns the merged selection.
const instantiateTemplates = (selection, template) => {
  selection.exit().remove();
  const created = selection.enter().append(() => template.clone(true).node());
  return selection.merge(created);
};

// same thing, but initiates arbitrary elements of a given class.
const instantiateElems = (selection, tagName, className) => {
  selection.exit().remove();
  const created = selection.enter().append(tagName);
  if (className != null) created.classed(className, true);
  return selection.merge(created);
};

// and one last shortcut for the above to just make divs.
const instantiateDivs = (selection, className) => instantiateElems(selection, 'div', className);

const px = (x) => `${x}px`;
const pct = (x) => `${x * 100}%`;

// takes a jquery element and gets the d3 data out of it.
const datum = ($elem) => select($elem[0]).datum();


////////////////////////////////////////////////////////////////////////////////
// TIMECODE CONVERSIONS

const duration = {
  seconds: (frames, fps) => frames / fps,
  minutes: (frames, fps) => frames / fps / 60,
  hours: (frames, fps) => frames / fps / 60 / 60
};
const pad = (x) => (x < 10) ? `0${x}` : x;
const timecode = (frame, fps) => {
  const minute = fps * 60;
  const hour = minute * 60;
  return {
    hh: floor(frame / hour),
    mm: floor((frame % hour) / minute),
    ss: floor((frame % minute) / fps),
    frame: frame % fps
  };
}

const timecodePretty = (frame, fps, showFrames = false) => {
  const parts = timecode(frame, fps);

  let result = [];
  if (parts.hh > 0) result.push(parts.hh);
  result.push(parts.mm, parts.ss);
  result = result.map(pad).join(':');
  if (showFrames === true) result += `.${parts.frame}`;
  return result;
};


////////////////////////////////////////////////////////////////////////////////
// UI HELPERS

// assists with dragging tasks. does not actually manipulate the element; provides
// basic event tracking and maths for updating the model which then sets position.
//
// the callback is given (dx, dy) in pixels from the initial position.
const $document = $(document);
const initiateDrag = (event, callback, finishCallback) => { // given a mousedown event, immediately starts a drag.
  if (event.isDefaultPrevented()) return; // someone already handled this.
  if (event.button !== 0) return; // ignore right-click.

  event.preventDefault();
  const initX = event.pageX;
  const initY = event.pageY;

  let memo = undefined;
  $document.on('mousemove.draggable', (event) => {
    memo = callback(event.pageX - initX, event.pageY - initY, memo);
  });
  $document.one('mouseup', () => {
    $document.off('mousemove.draggable');
    if (typeof finishCallback === 'function') finishCallback(memo);
  });
};
const draggable = ($target, callback) => { // given a $target, starts dragging when mousedown on it.
  $target.on('mousedown', (event) => { initiateDrag(event, callback); });
};
// can be inserted around a callback to draggable to convert the reported dx, dy
// from being relative to the origin to being relative to the previous report.
const byDelta = (f) => {
  let lastx = 0, lasty = 0;
  return (x, y, { lastx = 0, lasty = 0 } = {}) => {
    f(x - lastx, y - lasty);
    return { lastx: x, lasty: y };
  };
};

const defer = (f) => setTimeout(f, 0);

const queuer = (callback) => {
  let scheduled = false;
  return () => {
    if (scheduled === true) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      callback();
    });
  };
};


////////////////////////////////////////////////////////////////////////////////
// POINT MATH

const pointsEqual = (a, b) => (a.x === b.x) && (a.y === b.y);
const distance = (a, b) => sqrt(square(a.x - b.x) + square(a.y - b.y));
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const digestPoint = (point) => `${point.x} ${point.y}`;

const normalizeBox = (box) => [
  { x: min(box[0].x, box[1].x), y: min(box[0].y, box[1].y) },
  { x: max(box[0].x, box[1].x), y: max(box[0].y, box[1].y) }
];
const withinBox = (box, point) => {
  const normalized = normalizeBox(box);
  return (normalized[0].x <= point.x) && (point.x <= normalized[1].x) &&
    (normalized[0].y <= point.y) && (point.y <= normalized[1].y);
};


////////////////////////////////////////////////////////////////////////////////
// MISC

const getQuerystringValue = (key) =>
  decodeURIComponent((new URL(window.location)).searchParams.get(key));


module.exports = {
  clamp,
  last, spliceOut,
  immediate,
  getTemplate, instantiateTemplates, instantiateElems, instantiateDivs, px, pct, datum,
  pad, timecode, timecodePretty,
  initiateDrag, draggable, byDelta, defer, queuer,
  pointsEqual, distance, midpoint, digestPoint,
  normalizeBox, withinBox,
  getQuerystringValue
};

