const { ceil } = Math;
const { select } = require('d3');
const { instantiateTemplates, instantiateDivs, timecodePretty } = require('./util');

// given start, end in frames, fps, and width in pixels, creates an array of
// frame datapoints { frame: #, major: bool } to presented as ticks. 
const minorThreshold = 4; // smallest pixel distance between minor ticks.
const majorThreshold = 80; // smallest pixel distance between major ticks.
const tickScales = [
  1, // framescale
  60, 2 * 60, 5 * 60, 15 * 60, 30 * 60, // second scales
  60 * 60, 2 * 60 * 60, 5 * 60 * 60, 15 * 60 * 60, 30 * 60 * 60 // minute scales
];
const generateTicks = (start, end, fps, width) => {
  const duration = (end - start);

  // fallback to progressively larger scales. determine our first tick.
  const minorInterval = tickScales.find((scale) => (width / duration * scale) > minorThreshold);
  const first = ceil(start / minorInterval) * minorInterval;

  // determine major tick spacing.
  let majorInterval = minorInterval;
  while ((width / duration * majorInterval) < majorThreshold) majorInterval += minorInterval;

  // generate ticks.
  let frame = first;
  const result = [];
  while (frame < end) {
    result.push({ frame, major: ((frame % majorInterval) === 0) });
    frame += minorInterval;
  }
  return result;
};

const drawTicks = (ticksData, timescale, fps, target, template) => {
  const ticks = instantiateTemplates(target.selectAll('.vannot-tick').data(ticksData), template);
  
  ticks.style('left', (tick) => timescale(tick.frame));
  ticks.classed('vannot-tick-major', (tick) => tick.major);
  ticks.select('span').text((tick) => timecodePretty(tick.frame, fps)); // TODO/PERF: don't bother w/ minor ticks.

  ticks.exit().remove();
};

// draws the collection of data-driven timeline row at the bottom of the screen.
const drawTracks = (tracksData, timescale, target, template) => {
  const tracks = instantiateTemplates(target.selectAll('.vannot-track').data(tracksData), template);

  tracks.select('.vannot-track-title').text((track) => track.title);
  tracks.select('.vannot-track-color').style('background-color', (track) => track.color);
  tracks.select('.vannot-track-points').each(subdrawTrackpoints(timescale));

  tracks.exit().remove();
};

// draws the collection of trackpoints within a timeline.
const drawTrackpoints = (track, pointsData, timescale, target) => {
  const points = instantiateDivs(target.selectAll('.vannot-track-point').data(pointsData), 'vannot-track-point');

  points.style('left', (point) => timescale(point.frame));
  points.style('background-color', track.color);

  points.exit().remove();
};
// convenience function to currying+pulling apart an each call into the standard draw call:
const subdrawTrackpoints = (timescale) => function(track) {
  return drawTrackpoints(track, track.trackpoints, timescale, select(this));
};

module.exports = { generateTicks, drawTicks, drawTracks, drawTrackpoints };

