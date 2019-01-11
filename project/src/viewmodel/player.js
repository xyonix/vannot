const { ceil } = Math;
const EventEmitter = require('events');
const { scaleLinear } = require('d3');
const { defer, clamp, spliceOut } = require('../util');

class VideoData {
  constructor(data) {
    // adjust video resolution based on the pixel aspect ratio.
    if (data.pixelAspectRatio != null) {
      if (data.pixelAspectRatio > 1) {
        data.width *= data.pixelAspectRatio;
      } else {
        data.height *= data.pixelAspectRatio;
      }

      // unset the PAR so it doesn't reapply in the future.
      delete data.pixelAspectRatio;
    }

    Object.assign(this, data, {
      start: data.start || 0,
      end: (data.start || 0) + data.duration
    });
  }

  clamp(frame) { return clamp(this.start, frame, this.end); }

  containsFrame(frame) { return (this.start <= frame) && (frame <= this.end); }
}

class Player {
  constructor($video, data) {
    this.data = data;
    this.video = new VideoData(data.video);
    this.videoObj = $video[0];
    this.events = new EventEmitter();

    this.range = [ this.video.start, this.video.end ];
    this.frame = 0;
    this.playing = false;
    this.selection = null;

    this._initialize($video);
    this.seek(this.video.start);
  }

  _initialize($video) {
    $video.attr('src', this.video.source);
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

    // if we are playing an excerpt, the video won't automatically stop, so
    // we have to manually stop it at the end timecode.
    if (value > this.video.end) this.seek(this.video.end);
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

  pause() { this.videoObj.pause(); }
  play() { this.videoObj.play(); }

  seek(frame) {
    this.pause();
    this.frame = clamp(this.video.start, frame, this.video.end);
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
          } else if ((x.start <= y.start) && (y.start <= x.end) && (x.end <= y.end)) { // (x  [y  )  ]
            y.start = x.start;
            spliceOut(x, segments);
          } else if ((y.start <= x.start) && (x.start <= y.end) && (y.end <= x.end)) { // [y  (x  ]  )
            y.end = x.end;
            spliceOut(x, segments);
          }
        }
      }
    }
    this.changedLabels();
  }

  // deletes all label segments within the selection. possibly if selection becomes multi-track
  // and/or works on object tracks, we will delete those too.
  removeSelection() {
    const selection = this.selection;
    if (selection == null) return;
    const segments = selection.target.segments;

    for (const segment of segments) {
      // first, do the two oddball cases:
      if ((selection.start <= segment.start) && (segment.end <= selection.end)) { // (sel [seg ] )
        spliceOut(segment, segments);
      } else if ((segment.start < selection.start) && (selection.end < segment.end)) { // [seg (sel ) ]
        segments.push({ start: selection.end, end: segment.end });
        segment.end = selection.start;
      } else {
        // now assess the truncation cases:
        if ((segment.start < selection.start) && (selection.start < segment.end)) // [seg (sel ] )
          segment.end = selection.start;
        if ((segment.start < selection.end) && (selection.end < segment.end)) // (sel [seg ) ]
          segment.start = selection.end;
      }
    }
    this.selection = null;
    this.changedLabels();
  }
}

module.exports = { Player };

