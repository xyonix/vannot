window.tap = (x) => { console.log(x); return x; }; // for quick debug

const { round, trunc, abs, ceil } = Math;
const { select, scaleLinear } = require('d3');
const $ = require('jquery');
window.$ = $;
const { drawShapeList } = require('./shape-list');
const { drawTimecode, drawTicks, drawPlayhead, drawRanger, drawObjectTracks } = require('./timeline');
const { drawShapes, drawWipSegment, updateCanvasChrome } = require('./canvas');
const { draggable, initiateCanvasDrag, clamp, defer } = require('./util');


// docready.
$(function() {

////////////////////////////////////////////////////////////////////////////////
// DUMMY DATA

const data = {
  _seqId: 4,
  video: { duration: 182970, fps: 30, height: 720, width: 1280, source: '/assets/lttp.mp4' },
  objects: [
    { id: 1, title: 'Link', color: '#07e4ff' },
    { id: 2, title: 'Enemy', color: '#ff2096' },
    { id: 3, title: 'Obstacle', color: '#ccb71a' }
  ],
  frames: [{
    frame: 2490,
    shapes: [{
      id: 1, objectId: 1, points: [{ x: 200, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 500 }, { x: 200, y: 500 }]
    }, {
      id: 2, objectId: 2, points: [{ x: 500, y: 600 }, { x: 700, y: 600 }, { x: 700, y: 700 }, { x: 500, y: 700 }]
    }]
  }, {
    frame: 4492,
    shapes: [{
      id: 3, objectId: 1, points: [{ x: 100, y: 150 }, { x: 500, y: 150 }, { x: 200, y: 500 }, { x: 100, y: 500 }]
    }]
  }]
};


////////////////////////////////////////////////////////////////////////////////
// PLAYER VIEWMODEL

const wrapper = select('#vannot');
const $wrapper = $('#vannot');

const leftWrapper = wrapper.select('.vannot-player-left');
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
      drawShapeList(data, this, leftWrapper);
      $wrapper.trigger('frameChange', this._frame);
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
// CANVAS VIEWMODEL

const $canvasWrapper = $('#vannot .vannot-canvas');
const svg = wrapper.select('svg');
const $svg = $(svg.node());
const $player = $('#vannot .vannot-player');

class Canvas {
  constructor(player, data) {
    this.player = player;
    this.data = data;
    this._initialize();
  }

  _initialize() {
    const updateFrame = () => {
      this.frameObj = this.data.frames.find((x) => x.frame === this.player.frame);
    };
    $wrapper.on('frameChange', updateFrame);
    updateFrame();
  };

  get selectedPoints() { return (this.selectedShape != null) ? this.selectedShape.points : this._selectedPoints; }

  get frameObj() { return this._frameObj; }
  set frameObj(frameObj) {
    this._frameObj = frameObj;
    drawShapes(this, svg);
  };

  draw() {
    drawShapes(this, svg);
    updateCanvasChrome(this, $player);
  };

  ensureFrameObj() {
    if (this._frameObj == null) {
      this.frameObj = { frame: this.player.frame, shapes: [] };
      this.data.frames.push(this.frameObj);
    }
  }

  startShape() {
    this.state = 'drawing';
    this.wipShape = { id: this.data._seqId++, objectId: -1, points: [], wip: true };
    this.selectedShape = this.wipShape;
    this.ensureFrameObj();
    this.frameObj.shapes.push(this.wipShape);
    this.draw();
    drawWipSegment(this, svg);
  }
  completeShape() {
    delete this.wipShape.wip;
    this.wipShape = null;
    this.state = 'shape-select';
    this.draw();
  }

  selectShape(shape) {
    if (this.selectedShape === shape) return;
    this.state = 'shape-select';
    this.selectedShape = shape;
    this.draw();
  }

  removeShape(shape) {
    const shapes = this.frameObj.shapes;
    const index = shapes.indexOf(shape);
    if (index < 0) return;
    shapes.splice(index, 1);
    if (shape === this.selectedShape)
      this.deselect();
    else
      this.draw();
  }

  deselect() {
    this.state = null;
    this.selectedShape = null;
    this.draw();
  }
}
const canvas = new Canvas(player, data);


////////////////////////////////////////////////////////////////////////////////
// INTERACTIVITY (eventually probably to be broken out into its own file)

////////////////////////////////////////
// > Drawing

// the canvas object will trigger all the things to go to draw mode; just ask.
$('#vannot .vannot-draw-shape').on('click', () => { canvas.startShape() });

// ugly but much better for perf:
const playerPadding = 40;
let playerWidth = $player.width() - playerPadding, playerHeight = $player.height() - playerPadding;
$(window).on('resize', () => {
  playerWidth = $player.width() - playerPadding;
  playerHeight = $player.height() - playerPadding;
});

// actually allow clicking on the entire canvas area. this means we have to do some
// scuzzy measurement and math to figure out origin but it makes drawing much easier
// in some cases.
$(document).on('mousemove', (event) => {
  // figure out our scaling factor and origin.
  // first determine which the constraint side is, then calculate rendered video size.
  const videoRatio = player.video.width / player.video.height;
  const heightConstrained = (playerWidth / playerHeight) > videoRatio;
  const renderedWidth = heightConstrained ? (playerHeight * videoRatio) : playerWidth;
  const renderedHeight = heightConstrained ? playerHeight : (playerWidth / videoRatio);

  // now determine origin point in screenspace.
  const originX = heightConstrained ? round((playerWidth / 2) - (renderedWidth / 2)) : 0;
  const originY = heightConstrained ? 0 : round((playerHeight / 2) - (renderedHeight / 2));

  // get the delta, then transform into svg-space.
  const { pageX, pageY } = event;
  const factor = heightConstrained ? (player.video.height / playerHeight) : (player.video.width / playerWidth);
  const x = (pageX - (playerPadding / 2) - originX) * factor;
  const y = (pageY - (playerPadding / 2) - originY) * factor;

  // save and notify.
  canvas.mouse = { x, y };
  $player.trigger('canvas-mouse-update');
});
$wrapper.on('mousemove', '.vannot-player.drawing', (event) => {
  drawWipSegment(canvas, svg);
});

// mousedown helpers:
const tryMousedownPath = (target) => {
  if (target.tagName === 'path') {
    canvas.selectShape(select(event.target).datum());
    initiateCanvasDrag(canvas);
    return true;
  } else {
    return false;
  }
};

// on mousedown, walk through possible interactions in decreasing priority.
$wrapper.on('mousedown', '.vannot-player.normal', (event) => {
  if (tryMousedownPath(event.target)) return;
});
$wrapper.on('mousedown', '.vannot-player.drawing', (event) => {
  if (canvas.wipShape == null) return;
  canvas.wipShape.points.push(Object.assign({}, canvas.mouse));
  canvas.draw();
});
$wrapper.on('mousedown', '.vannot-player.shape-select', (event) => {
  if (tryMousedownPath(event.target)) return;
  if (event.target === svg.node()) return canvas.deselect();
});

////////////////////////////////////////
// > Toolbar

// a cute trick to make the complete shape button complete the shape.
const completeButton = $('#vannot .vannot-complete');
completeButton.on('mouseover', () => {
  if (canvas.state !== 'drawing') return; // paranoia.
  if (canvas.wipShape.points.length === 0) return;
  canvas.mouse = Object.assign({}, canvas.wipShape.points[0]);
  drawWipSegment(canvas, svg);
});

// but of course complete the shape when clicked.
completeButton.on('click', () => { canvas.completeShape() });

// wire up drawing undo.
$('#vannot .vannot-undo-draw').on('click', () => {
  if (canvas.wipShape.points.pop() != null) {
    canvas.draw();
    drawWipSegment(canvas, svg);
  }
});

$('#vannot .vannot-object-select').on('change', (event) => {
  if (canvas.selectedShape == null) return; // paranoia.
  canvas.selectedShape.objectId = parseInt($(event.target).find(':selected').attr('value'));
  canvas.draw();
  drawObjectTracks(player, data, objectWrapper);
});

$('#vannot .vannot-duplicate-shape').on('click', (event) => {
  if (canvas.selectedShape == null) return; // paranoia.
  const points = canvas.selectedShape.points.map(({ x, y }) => ({ x: x + 10, y: y + 10 }));
  const duplicate = Object.assign({}, canvas.selectedShape, { points });
  canvas.frameObj.shapes.push(duplicate);
  canvas.selectShape(duplicate);
});

$('#vannot .vannot-delete-shape').on('click', (event) => {
  if (canvas.selectedShape == null) return; // paranoia.
  canvas.removeShape(canvas.selectedShape);
});

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

});

