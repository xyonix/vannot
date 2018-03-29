const { ceil } = Math;
const EventEmitter = require('events');
const { scaleLinear } = require('d3');
const { defer, clamp } = require('../util');

class Player {
  constructor($video, data) {
    this.data = data;
    this.video = data.video;
    this.videoObj = $video[0];
    this.events = new EventEmitter();

    this.range = [ 0, this.video.duration ];
    this.frame = 0;
    this.playing = false;

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
}

module.exports = { Player };

