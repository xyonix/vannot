const { ceil } = Math;
const EventEmitter = require('events');
const { scaleLinear } = require('d3');
const { defer, clamp, spliceOut } = require('../util');

class Player {
  constructor($video, data) {
    this.data = data;
    this.video = data.video;
    this.videoObj = $video[0];
    this.events = new EventEmitter();

    this.range = [ 0, this.video.duration ];
    this.frame = 0;
    this.playing = false;
    this.selection = null;

    this._initialize($video);
  }

  _initialize($video) {
    $video.attr('src', this.data.video.source);
    $video.on('playing', () => this.playing = true);
    $video.on('pause', () => this.playing = false);

    let lastTimecode = 0;
    $video.on('timeupdate', () => {
      lastTimecode = this.videoObj.currentTime;
      // defer work for greater update resolution.
      defer(() => { this.frame = ceil(lastTimecode * this.video.fps); });
    });
  }

  get playing() { return this._playing; }
  set playing(value) {
    if (value === this._playing) return;
    if (value === false) this.videoObj.currentTime = this.frame / this.video.fps; // ensure quantized frozen frame;
    this._playing = value;
    this.events.emit('change.playing');
  }

  get frame() { return this._frame; }
  set frame(value) {
    if (value === this._frame) return;
    this._frame = value;
    this.events.emit('change.frame', this._frame);
  }

  get range() { return this._range; }
  set range(value) {
    if (this._range && (value[0] === this._range[0]) && (value[1] === this._range[1])) return;
    this._range = value;
    this.events.emit('change.range');
  }

  get timelineWidth() { return this._timelineWidth; }
  set timelineWidth(value) {
    if (value === this._timelineWidth) return;
    this._timelineWidth = value;
    this.events.emit('change.range');
  }

  // range selection on the timeline:
  get selection() { return this._selection; }
  set selection(value) {
    if (value == null)
      this._selection = { target: null }; // always have a .target property present.
    else
      this._selection = value;
    this.events.emit('change.selection');
  }

  // and if anybody changes object or label properties they need to tell us manually.
  changedObjects() { this.events.emit('change.objects'); }
  changedLabels() { this.events.emit('change.labels'); }


  ////////////////////////////////////////
  // CALCULATED STATE

  get scale() { return scaleLinear().domain(this.range).range([ 0, 1 ]); }

  get prevFrame() {
    return this.data.frames.reduce(((closest, candidate) =>
      (candidate.frame < this.frame) && ((closest == null) || (candidate.frame > closest.frame))
        ? candidate : closest), null);
  }
  get nextFrame() { // TODO: copypasta
    return this.data.frames.reduce(((closest, candidate) =>
      (candidate.frame > this.frame) && ((closest == null) || (candidate.frame < closest.frame))
        ? candidate : closest), null);
  }


  ////////////////////////////////////////
  // MANIPULATORS

  seek(frame) {
    this.videoObj.pause();
    this.frame = clamp(0, frame, this.video.duration);
    this.videoObj.currentTime = this.frame / this.video.fps;
  }

  mergeSegments() {
    for (const label of this.data.labels) {
      const segments = label.segments;
      const queue = segments.slice(0);
      while (queue.length > 0) {
        const x = queue.pop();
        for (const y of segments) {
          if (x === y) {
            continue;
          } else if ((y.start <= x.start) && (x.end <= y.end)) { // [y  (x  )  ]
            spliceOut(x, segments);
          } else if ((x.start <= y.start) && (y.start < x.end) && (x.end <= y.end)) { // (x  [y  )  ]
            y.start = x.start;
            spliceOut(x, segments);
          } else if ((y.start <= x.start) && (x.start < y.end) && (y.end <= x.end)) { // [y  (x  ]  )
            y.end = x.end;
            spliceOut(x, segments);
          }
        }
      }
    }
    this.changedLabels();
  }
}

module.exports = { Player };

