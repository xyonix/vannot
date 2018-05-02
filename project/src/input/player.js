const $ = require('jquery');
const { round, trunc, abs, random, min, max } = Math;
const tcolor = require('tinycolor2');
const { clamp, initiateDrag, draggable, byDelta, normalizeBox, datum, spliceOut, defer } = require('../util');

module.exports = ($app, player, canvas) => {

  const $video = $app.find('video');
  const videoObj = $video[0];
  const $document = $(document);
  const $objectWrapper = $app.find('.vannot-objects');

  ////////////////////////////////////////
  // Global inputs

  const $ticks = $app.find('.vannot-ticks');
  const updateTimelineWidth = () => { player.timelineWidth = $ticks.width(); };
  $(window).on('resize', updateTimelineWidth);
  updateTimelineWidth();

  ////////////////////////////////////////
  // Video Adjustments

  const adjustments = { brightness: 1, greyscale: 0 };
  const applyAdjustments = () => {
    $video.css('filter', `brightness(${adjustments.brightness}) grayscale(${adjustments.greyscale})`);
  };
  $app.find('.vannot-video-brightness-edit').on('change', (event) => {
    adjustments.brightness = parseFloat($(event.target).val());
    applyAdjustments();
  });
  $app.find('.vannot-video-chromatic-edit').on('change', (event) => {
    adjustments.greyscale = parseFloat($(event.target).val());
    applyAdjustments();
  });

  ////////////////////////////////////////
  // Controls

  const tryseek = (f) => () => {
    const frame = f();
    if (frame != null) player.seek(frame.frame);
  };
  const relseek = (x) => () => player.seek(player.frame + x);
  $app.find('.vannot-keyback').on('click', tryseek(() => player.prevFrame));
  $app.find('.vannot-leapback').on('click', relseek(-5));
  $app.find('.vannot-skipback').on('click', relseek(-1));
  $app.find('.vannot-playpause').on('click', () => (player.playing ? videoObj.pause() : videoObj.play()));
  $app.find('.vannot-skipforward').on('click', relseek(1));
  $app.find('.vannot-leapforward').on('click', relseek(5));
  $app.find('.vannot-keyforward').on('click', tryseek(() => player.nextFrame));

  ////////////////////////////////////////
  // Track properties

  $app.on('input', '.vannot-track-title-edit', (event) => {
    const $input = $(event.target);
    const text = $input.val();
    $input.next().text(text);
    datum($input.closest('.vannot-track')).title = text;
    player.changedObjects();
  });

  const colorChange = (event, color) => {
    const $target = $(event.target);
    datum($target.closest('.vannot-track')).color = color.toHexString();
    if ($target.closest('.vannot-objects').length > 0)
      player.changedObjects();
    else
      player.changedLabels();
  };
  $app.on('dragstop.spectrum', '.vannot-track-color-edit', colorChange);
  $app.on('change.spectrum', '.vannot-track-color-edit', colorChange);
  $app.on('hide.spectrum', '.vannot-track-color-edit', colorChange);

  $app.on('click', '.vannot-track-remove', (event) => {
    const $button = $(event.target);
    if ($button.hasClass('confirm')) {
      const track = datum($button.closest('.vannot-track'));
      if ($button.closest('.vannot-objects').length > 0) {
        spliceOut(track, player.data.objects);
        player.changedObjects();
      } else {
        spliceOut(track, player.data.labels);
        player.changedLabels();
      }
    } else {
      $button.addClass('confirm');
      defer(() => { $document.one('click', () => { $button.removeClass('confirm'); }) });
    }
  });

  ////////////////////////////////////////
  // Trackpoints

  $app.find('.vannot-object-new').on('click', () => {
    player.data.objects.push({
      id: player.data._seqId++,
      title: 'New object',
      color: tcolor.fromRatio({ h: random(), s: 1, v: 1 }).toHexString()
    });
    player.changedObjects();
  });

  $objectWrapper.on('click', '.vannot-track-point', (event) => {
    const $point = $(event.target);
    const frameObj = datum($point);
    const object = datum($point.closest('.vannot-track'));
    player.seek(frameObj.frame);
    canvas.selectShapes(frameObj.shapes.filter((shape) => shape.objectId === object.id));
  });

  ////////////////////////////////////////
  // Tracklabels

  $app.find('.vannot-label-new').on('click', () => {
    player.data.labels.push({
      id: player.data._seqId++,
      title: 'New label',
      color: tcolor.fromRatio({ h: random(), s: 1, v: 0.8 }).toHexString(),
      segments: []
    });
    player.changedLabels();
  });

  // DRAG HELPERS:
  const snapThreshold = 4; // px, in either direction.
  const snapToPlayhead = (frame) => {
    const dPx = abs(player.scale(frame) - player.scale(player.frame)) * player.timelineWidth;
    return (dPx < snapThreshold) ? player.frame : frame;
  };

  // TODO: this handler is pretty overloaded, but i couldn't figure out how to extricate it cleanly.
  $app.find('.vannot-labels').on('mousedown', '.vannot-track-timeline', (event) => {
    if (event.isDefaultPrevented()) return; // someone already handled this.
    if (event.button !== 0) return; // ignore right-click.
    player.selection = null;

    const $target = $(event.target);
    const $track = $target.closest('.vannot-track');
    const initiateX = event.pageX - $track.find('.vannot-track-header').outerWidth();
    const initiateFrame = snapToPlayhead(round(player.scale.invert(initiateX / player.timelineWidth)));

    // TODO: not sure about this inline function syntax.
    const label = datum($track);
    let dragTarget, finalize, anchorFrame;
    if ($target.is('.vannot-track-segment-handle')) {
      // Segment drag handle:
      dragTarget = datum($target.closest('.vannot-track-segment'));
      anchorFrame = $target.is('.handle-left') ? dragTarget.end : dragTarget.start;
      finalize = () => {
        player.mergeSegments();
      };
    } else if ($target.is('.vannot-track-segment')) {
      // Mid-segment section:
      dragTarget = player.selection = { target: label, start: initiateFrame, end: initiateFrame };
      finalize = () => {
        if (player.selection.start === player.selection.end) {
          const segment = datum($target);
          player.selection = { target: label, start: segment.start, end: segment.end };
        }
      }
    } else {
      // Blank timeline:
      dragTarget = { start: initiateFrame, end: initiateFrame };
      label.segments.push(dragTarget);
      finalize = () => {
        if (dragTarget.start === dragTarget.end) {
          spliceOut(dragTarget, label.segments);
          player.changedLabels();
        } else {
          player.mergeSegments();
        }
      }
    }

    // start the drag; call finalize on done.
    if (anchorFrame == null) anchorFrame = initiateFrame;
    initiateDrag(event, (dx) => {
      const dframes = round((dx / player.timelineWidth) * (player.range[1] - player.range[0])); // TODO: copypasta from below.
      const currentFrame = snapToPlayhead(initiateFrame + dframes);
      dragTarget.start = min(anchorFrame, currentFrame);
      dragTarget.end = max(anchorFrame, currentFrame);
      player.changedLabels();
    }, finalize);
  });

  ////////////////////////////////////////
  // Playhead dragging

  const $scale = $app.find('.vannot-scale');
  $scale.on('mousedown', (event) => {
    // do nothing if the playhead is directly clicked on (prevent microshifts):
    if ($(event.target).is('.vannot-playhead')) return;
    player.seek(round(player.scale.invert(event.offsetX / player.timelineWidth)));
  });
  draggable($scale, (dx, _, originFrame = player.frame) => {
    const dframes = trunc((dx / player.timelineWidth) * (player.range[1] - player.range[0]));
    player.seek(originFrame + dframes);
    return originFrame;
  });

  ////////////////////////////////////////
  // Ranger zooming

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
  draggable($app.find('.vannot-ranger-start'), byDelta((dx) =>
    zoom(dx / player.timelineWidth * factorAdjust * player.video.duration)));
  draggable($app.find('.vannot-ranger-end'), byDelta((dx) =>
    zoom(-dx / player.timelineWidth * factorAdjust * player.video.duration)));

  ////////////////////////////////////////
  // > Ranger panning

  draggable($app.find('.vannot-ranger-fill'), byDelta((dx) => {
    let dframes = round(dx / player.timelineWidth * player.video.duration);
    if ((player.range[1] + dframes) >= player.video.duration)
      dframes = player.video.duration - player.range[1];
    else if ((player.range[0] + dframes) <= 0)
      dframes = -player.range[0];

    player.range = [ player.range[0] + dframes, player.range[1] + dframes ];
  }));

};

