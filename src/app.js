window.tap = (x) => { console.log(x); return x; }; // for quick debug

const { round, trunc, abs, ceil } = Math;
const { select, scaleLinear } = require('d3');
const $ = require('jquery');
const { drawTimecode, drawTicks, drawPlayhead, drawRanger, drawObjectTracks } = require('./timeline');
const { draggable, clamp, defer } = require('./util');


////////////////////////////////////////////////////////////////////////////////
// DUMMY DATA

const data = {
  video: { duration: 182970, fps: 30, height: 720, width: 1280, source: '/assets/lttp.mp4' },
  objects: [
    { id: 1, title: 'object a', color: '#07e4ff' },
    { id: 2, title: 'object b', color: '#ff2096' },
    { id: 3, title: 'object c', color: '#ccb71a' }
  ],
  frames: [{
    frame: 2490,
    shapes: [{
      id: 1, poly: [{ x: 200, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 500 }, { x: 200, y: 500 }]
    }, {
      id: 2, poly: [{ x: 500, y: 600 }, { x: 700, y: 600 }, { x: 700, y: 700 }, { x: 500, y: 700 }]
    }]
  }, {
    frame: 4492,
    shapes: [{
      id: 1, poly: [{ x: 100, y: 150 }, { x: 500, y: 150 }, { x: 200, y: 500 }, { x: 100, y: 500 }]
    }]
  }]
};


////////////////////////////////////////////////////////////////////////////////
// PLAYER MODEL

const wrapper = select('#vannot');
const $video = $('#vannot video');
const videoObj = $video.get(0);

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
    // browser width.
    const updateWidth = () => (this.width = tickWrapper.node().clientWidth);
    $(window).on('resize', updateWidth);
    updateWidth();

    // video.
    $video.attr('src', data.video.source);
    $video.on('playing', () => this.playing = true);
    $video.on('pause', () => this.playing = false);

    let lastTimecode = 0;
    $video.on('timeupdate', () => {
      if (videoObj.currentTime !== lastTimecode) {
        lastTimecode = videoObj.currentTime;
        this.frame = ceil(lastTimecode * this.video.fps);
      }
    });
  }

  seek(frame) {
    videoObj.pause();
    this.frame = frame;
    videoObj.currentTime = this.frame / this.video.fps;
  }

  get playing() { return this._playing; }
  set playing(value) {
    if (value === this._playing) return;
    videoObj.currentTime = this.frame / this.video.fps; // ensure quantized frozen frame;
    this._playing = value;
    wrapper.classed('playing', value);
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
    defer(() => { // defer work to get as many updates as possible.
      drawTimecode(this, timecode);
      drawPlayhead(this, playhead);
    });
  }

  get range() { return this._range; }
  set range(value) {
    if (this._range && (value[0] === this._range[0]) && (value[1] === this._range[1])) return;
    this._range = value;
    this.scale = scaleLinear().domain(this.range).range([ 0, 1 ]);
    drawTicks(this, tickWrapper);
    drawObjectTracks(this, data, objectWrapper);
    drawPlayhead(this, playhead);
    drawRanger(this, ranger);
  }
}
const player = new Player(data.video);


////////////////////////////////////////////////////////////////////////////////
// INTERACTIVITY (eventually probably to be broken out into its own file)

////////////////////////////////////////
// > Controls

const relseek = (x) => () => player.seek(player.frame + x);
$('#vannot .vannot-leapback').on('click', relseek(-5));
$('#vannot .vannot-skipback').on('click', relseek(-1));
$('#vannot .vannot-playpause').on('click', () => (player.playing ? videoObj.pause() : videoObj.play()));
$('#vannot .vannot-skipforward').on('click', relseek(1));
$('#vannot .vannot-leapforward').on('click', relseek(5));

////////////////////////////////////////
// > Playhead dragging

const scale = wrapper.select('.vannot-scale');
draggable(scale.node(), (dx) => {
  const dframes = trunc((dx / player.width) * (player.range[1] - player.range[0]));
  if (abs(dframes) < 1) return false; // if the delta was too small to move, don't swallow it.

  player.seek(clamp(0, player.frame + dframes, player.video.duration));
});
$(scale.node()).on('mousedown', (event) => {
  const $target = $(event.target);
  if ($target.is(playhead.node()) || ($target.closest('.vannot-playhead').length > 0))
    return; // do nothing if the playhead is directly clicked on (prevent microshifts).

  const frame = round(player.scale.invert(event.offsetX / player.width));
  player.seek(clamp(0, frame, player.video.duration));
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

