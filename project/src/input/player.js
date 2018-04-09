const $ = require('jquery');
const { round, trunc } = Math;
const { clamp, draggable, byDelta, normalizeBox, datum } = require('../util');

module.exports = ($app, player, canvas) => {

  const videoObj = $app.find('video')[0];
  const $objectWrapper = $app.find('.vannot-objects');

  ////////////////////////////////////////
  // Global inputs

  const $ticks = $app.find('.vannot-ticks');
  const updateTimelineWidth = () => { player.timelineWidth = $ticks.width(); };
  $(window).on('resize', updateTimelineWidth);
  updateTimelineWidth();

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
  const colorChange = (event, color) => {
    datum($(event.target).closest('.vannot-track')).color = color.toHexString();
    player.changedObjects();
  };
  $app.on('dragstop.spectrum', '.vannot-track-color-edit', colorChange);
  $app.on('change.spectrum', '.vannot-track-color-edit', colorChange);

  ////////////////////////////////////////
  // Trackpoints

  $objectWrapper.on('click', '.vannot-track-point', (event) => {
    const $point = $(event.target);
    const frameObj = datum($point);
    const object = datum($point.closest('.vannot-track'));
    player.seek(frameObj.frame);
    canvas.selectShapes(frameObj.shapes.filter((shape) => shape.objectId === object.id));
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

