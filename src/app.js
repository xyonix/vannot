window.tap = (x) => { console.log(x); return x; }; // for quick debug

const { round } = Math;
const { select, scaleLinear } = require('d3');
const $ = require('jquery');
const { drawTimecode, drawTicks, drawPlayhead, drawTracks } = require('./timeline');
const { draggable, clamp } = require('./util');

////////////////////////////////////////////////////////////////////////////////
// DUMMY DATA

const data = {
  video: { duration: 182970, fps: 30, height: 720, width: 1280 },
  objects: [{
    title: 'object a',
    color: '#07e4ff',
    trackpoints: [{
      frame: 2490,
      poly: [{ x: 200, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 500 }, { x: 200, y: 500 }]
    }, {
      frame: 4492,
      poly: [{ x: 100, y: 150 }, { x: 500, y: 150 }, { x: 200, y: 500 }, { x: 100, y: 500 }]
    }]
  }, {
    title: 'object b',
    color: '#ff2096',
    trackpoints: [{
      frame: 2490,
      poly: [{ x: 500, y: 600 }, { x: 700, y: 600 }, { x: 700, y: 700 }, { x: 500, y: 700 }]
    }, {
      frame: 4492,
      poly: [{ x: 400, y: 450 }, { x: 700, y: 450 }, { x: 500, y: 700 }, { x: 400, y: 700 }]
    }]
  }, {
    title: 'object c',
    color: '#ccb71a',
    trackpoints: []
  }]
};

////////////////////////////////////////////////////////////////////////////////
// BASIC SETUP

const wrapper = select('#vannot');

const tickWrapper = wrapper.select('.vannot-ticks');
const objectWrapper = wrapper.select('.vannot-objects');
const playhead = wrapper.select('.vannot-playhead');
const timecode = wrapper.select('.vannot-timecode');

const player = {
  video: data.video, playing: false, frame: 3000, range: [ 0, 182970 ],
  width: tickWrapper.node().clientWidth
};
const updateModel = () => {
  player.scale = scaleLinear().domain(player.range).range([ 0, 100 ]);
};

const updateView = () => {
  drawTicks(player, tickWrapper);
  drawTracks(player, data.objects, objectWrapper);
  drawPlayhead(player, playhead);
  drawTimecode(player, timecode);
};
updateModel();
updateView();

////////////////////////////////////////////////////////////////////////////////
// INTERACTIVITY (eventually probably to be broken out into its own file)

draggable(playhead.node(), (dx) => {
  const delta = (dx / player.width) * (player.range[1] - player.range[0]);
  player.frame = clamp(0, round(player.frame + delta), player.video.duration);
  drawPlayhead(player, playhead);
  drawTimecode(player, timecode);
});

