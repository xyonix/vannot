window.tap = (x) => { console.log(x); return x; }; // for quick debug

const { round, trunc, abs } = Math;
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

const scale = wrapper.select('.vannot-scale');
draggable(scale.node(), (dx) => {
  const dframes = trunc((dx / player.width) * (player.range[1] - player.range[0]));
  if (abs(dframes) < 1) return false; // if the delta was too small to move, don't swallow it.

  player.frame = clamp(0, player.frame + dframes, player.video.duration);
  drawPlayhead(player, playhead);
  drawTimecode(player, timecode);
});
$(scale.node()).on('mousedown', (event) => {
  const $target = $(event.target);
  if ($target.is(playhead.node()) || ($target.closest('.vannot-playhead').length > 0))
    return; // do nothing if the playhead is directly clicked on (prevent microshifts).

  const frame = round(player.scale.invert(event.offsetX / player.width) * 100);
  player.frame = clamp(0, frame, player.video.duration);
  drawPlayhead(player, playhead);
  drawTimecode(player, timecode);
});

////////////////////////////////////////
// > Ranger zooming

const minZoom = 1.5; // in seconds, on either side of the playhead.
const zoom = (dframes) => {
  const deadzone = minZoom * player.video.fps;
  if ((player.range[0] < (player.frame - deadzone)) && ((player.frame + deadzone) < player.range[1])) {
    // if the playhead is in-view, zoom around it proportionally:
    const rangeDuration = player.range[1] - player.range[0];
    let leftk = (player.frame - deadzone - player.range[0]) / rangeDuration;
    let rightk = (player.range[1] - deadzone - player.frame) / rangeDuration;

    // if zooming out and one side is clamped, put everything on the other side.
    if (dframes < 0) {
      if (player.range[0] === 0) rightk = 1;
      if (player.range[1] === player.video.duration) leftk = 1;
    }

    // we know our proportions; apply.
    player.range[0] = clamp(0, player.range[0] + round(leftk * dframes), player.frame - deadzone);
    player.range[1] = clamp(player.frame + deadzone, player.range[1] - round(rightk * dframes), player.video.duration);
  } else {
    // apply scaling equidistantly.
    const edgeDeadzone = deadzone * 2; // double here: both sides of "playhead"
    player.range[0] = clamp(0, player.range[0] + round(0.5 * dframes), player.range[1] - edgeDeadzone);
    player.range[1] = clamp(player.range[0] + edgeDeadzone, player.range[1] - round(0.5 * dframes), player.video.duration);
  }

  // render things.
  updateModel();
  updateView();
};

const factorAdjust = 1.5;
draggable(wrapper.select('.vannot-ranger-start').node(), (dx) =>
  zoom(dx / player.width * factorAdjust * player.video.duration));
draggable(wrapper.select('.vannot-ranger-end').node(), (dx) =>
  zoom(-dx / player.width * factorAdjust * player.video.duration));

////////////////////////////////////////
// > Ranger panning

draggable(wrapper.select('.vannot-ranger-fill').node(), (dx) => {
  let dframes = round(dx / player.width * player.video.duration);
  if ((player.range[1] + dframes) >= player.video.duration)
    dframes = player.video.duration - player.range[1];
  else if ((player.range[0] + dframes) <= 0)
    dframes = -player.range[0];

  player.range[0] += dframes;
  player.range[1] += dframes;

  // render things.
  updateModel();
  updateView();
});

