const { ceil } = Math;
const { select, scaleLinear } = require('d3');
const { getTemplate, instantiateTemplates, instantiateDivs, pct, pad, timecode } = require('./util');


////////////////////////////////////////////////////////////////////////////////
// ENTRYPOINT

const drawShapeList = (data, player, target) => {
  const frameData = data.frames.find((frame) => frame.frame === player.frame);
  target.classed('has-frame', (frameData != null));
};


module.exports = { drawShapeList };

