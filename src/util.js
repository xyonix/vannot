const { select } = require('d3');
const { floor } = Math;
const $ = require('jquery');


////////////////////////////////////////////////////////////////////////////////
// MATH HELPERS

const clamp = (min, x, max) => (x < min) ? min : (x > max) ? max : x;


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

const boolAttr = (bool) => (bool === true) ? 'true' : null;

const pct = (x) => `${x * 100}%`;


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
// the callback is given (dx, dy) in pixels from the last reported position. it
// may return false if the interval was too small to react to, in which case the
// following deltas will still be from the last known anchor.
const $document = $(document);
const draggable = (target, callback) => {
  $(target).on('mousedown', (event) => {
    if (event.isDefaultPrevented()) return; // someone already handled this.
    if (event.button !== 0) return; // ignore right-click.

    event.preventDefault();
    let lastX = event.pageX;
    let lastY = event.pageY;

    $document.on('mousemove.draggable', (event) => {
      if (callback(event.pageX - lastX, event.pageY - lastY) !== false) {
        lastX = event.pageX;
        lastY = event.pageY;
      }
    });
    $document.one('mouseup', () => $document.off('mousemove.draggable'));
  });
};

const defer = (f) => setTimeout(f, 0);

module.exports = {
  clamp,
  getTemplate, instantiateTemplates, instantiateElems, instantiateDivs, boolAttr, pct,
  pad, timecode, timecodePretty,
  draggable, defer
};

