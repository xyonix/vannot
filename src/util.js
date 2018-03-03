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
  const created = selection.enter().append(() => template.clone(true).node());
  return selection.merge(created);
};

// same thing, but initiates divs of a given class.
const instantiateDivs = (selection, className) => {
  const created = selection.enter().append('div').classed(className, true);
  return selection.merge(created);
};

const pct = (x) => `${x}%`;


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
const $document = $(document);
const draggable = (target, callback) => {
  $(target).on('mousedown', (event) => {
    if (event.button !== 0) return; // ignore right-click.

    event.preventDefault();
    let lastX = event.pageX;
    let lastY = event.pageY;

    $document.on('mousemove.draggable', (event) => {
      callback(event.pageX - lastX, event.pageY - lastY)
      lastX = event.pageX;
      lastY = event.pageY;
    });
    $document.one('mouseup', () => $document.off('mousemove.draggable'));
  });
};

module.exports = {
  clamp,
  getTemplate, instantiateTemplates, instantiateDivs, pct,
  pad, timecode, timecodePretty,
  draggable
};

