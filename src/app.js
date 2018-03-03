window.tap = (x) => { console.log(x); return x; }; // for quick debug

const { round } = Math;
const { select, scaleLinear } = require('d3');
const $ = require('jquery');
const { drawTimecode, drawTicks, drawPlayhead, drawRanger, drawTracks } = require('./timeline');
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
const ranger = wrapper.select('.vannot-ranger');

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
  drawRanger(player, ranger);
};
updateModel();
updateView();


////////////////////////////////////////////////////////////////////////////////
// INTERACTIVITY (eventually probably to be broken out into its own file)

////////////////////////////////////////
// > Playhead dragging

draggable(playhead.node(), (dx) => {
  const delta = (dx / player.width) * (player.range[1] - player.range[0]);
  player.frame = clamp(0, round(player.frame + delta), player.video.duration);
  drawPlayhead(player, playhead);
  drawTimecode(player, timecode);
});

////////////////////////////////////////
// > Ranger zooming

const minZoom = 1.5; // in seconds, on either side of the playhead.
const zoom = (frames) => {
  // by default assume equidistant adjustment:
  let leftk = 0.5, rightk = 0.5;

  // but if the playhead is in-view, zoom around it proportionally:
  const deadzone = minZoom * player.video.fps;
  if ((player.range[0] < (player.frame - deadzone)) && ((player.frame + deadzone) < player.range[1])) {
    const rangeDuration = player.range[1] - player.range[0];
    leftk = (player.frame - deadzone - player.range[0]) / rangeDuration;
    rightk = (player.range[1] - deadzone - player.frame) / rangeDuration;
    console.log(leftk, rightk);
  }

  // we know our proportions; apply.
  player.range[0] = clamp(0, player.range[0] + round(leftk * frames), player.frame - deadzone);
  player.range[1] = clamp(player.frame + deadzone, player.range[1] - round(rightk * frames), player.video.duration);

  // render things.
  updateModel();
  updateView();
};

const factorAdjust = 1.5;
draggable(wrapper.select('.vannot-ranger-start').node(), (dx) =>
  zoom(dx / player.width * factorAdjust * player.video.duration));
draggable(wrapper.select('.vannot-ranger-end').node(), (dx) =>
  zoom(-dx / player.width * factorAdjust * player.video.duration));

