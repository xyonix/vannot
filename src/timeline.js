const { select } = require('d3');
const { instantiateTemplates, instantiateDivs } = require('./util');

// draws the collection of data-driven timeline row at the bottom of the screen.
const drawTracks = (data, timescale, target, template) => {
  const tracks = instantiateTemplates(target.selectAll('.vannot-track').data(data), template);

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

module.exports = { drawTracks, drawTrackpoints };

