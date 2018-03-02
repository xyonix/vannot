const { select } = require('d3');
const { floor } = Math;

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
const timecodePretty = (frame, fps, showFrames = false) => {
  let result = [];

  const minute = fps * 60;
  const hour = minute * 60;
  if (frame > hour) result.push(floor(frame / hour));
  result.push(floor((frame % hour) / minute));
  result.push(floor((frame % minute) / fps));
  result = result.map(pad).join(':');

  if (showFrames === true) result += `.${frame % fps}`;

  return result;
};

module.exports = {
  getTemplate, instantiateTemplates, instantiateDivs, pct,
  timecodePretty
};

