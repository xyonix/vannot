window.tap = (x) => { console.log(x); return x; }; // for quick debug

const { round, trunc, abs } = Math;
const { select, scaleLinear } = require('d3');
const $ = require('jquery');
const { drawTimecode, drawTicks, drawPlayhead, drawRanger, drawTracks } = require('./timeline');
const { draggable, clamp } = require('./util');


////////////////////////////////////////////////////////////////////////////////
// DUMMY DATA

const data = {
  video: { duration: 182970, fps: 30, height: 720, width: 1280, source: '/assets/lttp.mp4' },
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
// PLAYER MODEL

const wrapper = select('#vannot');

const tickWrapper = wrapper.select('.vannot-ticks');
const objectWrapper = wrapper.select('.vannot-objects');
const playhead = wrapper.select('.vannot-playhead');
const timecode = wrapper.select('.vannot-timecode');
const ranger = wrapper.select('.vannot-ranger');

class Player {
  constructor(video) {
    this.video = video;
    this.range = [ 0, this.video.duration ];
    this.frame = 0;
    this.playing = false;

    this._initialize();
  }

  _initialize() {
    const updateWidth = () => (this.width = tickWrapper.node().clientWidth);
    $(window).on('resize', updateWidth);
    updateWidth();
  }

  get width() { return this._width; }
  set width(value) {
    if (value === this._width) return;
    this._width = value;
    drawTicks(this, tickWrapper);
    drawRanger(this, ranger);
  }

  get frame() { return this._frame; }
  set frame(value) {
    if (value === this._frame) return;
    this._frame = value;
    drawPlayhead(this, playhead);
    drawTimecode(this, timecode);
  }

  get range() { return this._range; }
  set range(value) {
    if (this._range && (value[0] === this._range[0]) && (value[1] === this._range[1])) return;
    this._range = value;
    this.scale = scaleLinear().domain(this.range).range([ 0, 1 ]);
    drawTicks(this, tickWrapper);
    drawTracks(this, data.objects, objectWrapper);
    drawPlayhead(this, playhead);
    drawRanger(this, ranger);
  }
}
const player = new Player(data.video);


////////////////////////////////////////////////////////////////////////////////
// INTERACTIVITY (eventually probably to be broken out into its own file)

////////////////////////////////////////
// > Playhead dragging

const scale = wrapper.select('.vannot-scale');
draggable(scale.node(), (dx) => {
  const dframes = trunc((dx / player.width) * (player.range[1] - player.range[0]));
  if (abs(dframes) < 1) return false; // if the delta was too small to move, don't swallow it.

  player.frame = clamp(0, player.frame + dframes, player.video.duration);
});
$(scale.node()).on('mousedown', (event) => {
  const $target = $(event.target);
  if ($target.is(playhead.node()) || ($target.closest('.vannot-playhead').length > 0))
    return; // do nothing if the playhead is directly clicked on (prevent microshifts).

  const frame = round(player.scale.invert(event.offsetX / player.width));
  player.frame = clamp(0, frame, player.video.duration);
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
    const left = clamp(0, player.range[0] + round(leftk * dframes), player.frame - deadzone);
    const right = clamp(player.frame + deadzone, player.range[1] - round(rightk * dframes), player.video.duration);
    player.range = [ left, right ];
  } else {
    // apply scaling equidistantly. compute one then the other to ensure clamping range.
    const edgeDeadzone = deadzone * 2; // double here: both sides of "playhead"
    const left = clamp(0, player.range[0] + round(0.5 * dframes), player.range[1] - edgeDeadzone);
    const right = clamp(left + edgeDeadzone, player.range[1] - round(0.5 * dframes), player.video.duration);
    player.range = [ left, right ];
  }
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

  player.range = [ player.range[0] + dframes, player.range[1] + dframes ];
});

