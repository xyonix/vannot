const { ceil } = Math;
const { select } = require('d3');
const { getTemplate, instantiateTemplates, instantiateDivs, pct, timecodePretty } = require('./util');


////////////////////////////////////////////////////////////////////////////////
// TICK SCALE

// given start, end in frames, fps, and width in pixels, creates an array of
// frame datapoints { frame: #, major: bool } to presented as ticks. 
const minorThreshold = 4; // smallest pixel distance between minor ticks.
const majorThreshold = 80; // smallest pixel distance between major ticks.
const tickScales = [
  1, // framescale
  60, 2 * 60, 5 * 60, 15 * 60, 30 * 60, // second scales
  60 * 60, 2 * 60 * 60, 5 * 60 * 60, 15 * 60 * 60, 30 * 60 * 60 // minute scales
];
const generateTicks = ([ start, end ], fps, width) => {
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

const tickTemplate = getTemplate('tick');
const drawTicks = (player, target) => {
  const ticksData = generateTicks(player.range, player.video.fps, target.node().clientWidth);
  const ticks = instantiateTemplates(target.selectAll('.vannot-tick').data(ticksData), tickTemplate);

  ticks.style('left', (tick) => pct(player.scale(tick.frame)));
  ticks.classed('vannot-tick-major', (tick) => tick.major);
  ticks.filter((tick) => tick.major).select('span')
    .text((tick) => timecodePretty(tick.frame, player.video.fps));

  ticks.exit().remove();
};

const drawPlayhead = (player, target) => {
  // TODO: centralize:
  const scaled = player.scale(player.frame);
  const inRange = (scaled >= 0) && (scaled <= 100);
  target.classed('hide', !inRange);
  if (inRange === true) target.style('left', pct(scaled));
};


////////////////////////////////////////////////////////////////////////////////
// DATA TRACKS

// draws the collection of data-driven timeline row at the bottom of the screen.
const trackTemplate = getTemplate('track');
const drawTracks = (player, tracksData, target) => {
  const tracks = instantiateTemplates(target.selectAll('.vannot-track').data(tracksData), trackTemplate);

  tracks.select('.vannot-track-title').text((track) => track.title);
  tracks.select('.vannot-track-color').style('background-color', (track) => track.color);
  tracks.select('.vannot-track-points').each(subdrawTrackpoints(player.scale));

  tracks.exit().remove();
};

// draws the collection of trackpoints within a timeline.
const drawTrackpoints = (track, pointsData, timescale, target) => {
  const points = instantiateDivs(target.selectAll('.vannot-track-point').data(pointsData), 'vannot-track-point');

  points.style('left', (point) => pct(timescale(point.frame)));
  points.style('background-color', track.color);

  points.exit().remove();
};
// convenience function to currying+pulling apart an each call into the standard draw call:
const subdrawTrackpoints = (timescale) => function(track) {
  return drawTrackpoints(track, track.trackpoints, timescale, select(this));
};


module.exports = { drawTicks, drawPlayhead, drawTracks, drawTrackpoints };

