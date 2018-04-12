window.tap = (x) => { console.log(x); return x; }; // for quick debug
const $ = window.$ = window.jQuery = require('jquery');
const { select } = require('d3');
const { px } = require('./util');

// docready.
$(function() {

  ////////////////////////////////////////////////////////////////////////////////
  // DUMMY DATA

  const getData = () => {
    const saved = localStorage.getItem('vannot');
    return (saved != null) ? JSON.parse(saved) : {
      _seqId: 0,
      video: { duration: 125100, fps: 25, height: 1080, width: 1920, source: '/assets/sailing.mp4' },
      objects: [
        { id: -1, title: 'Unassigned', color: '#aaa', system: true },
        { id: 1, title: 'Port', color: '#07e4ff' },
        { id: 2, title: 'Starboard', color: '#ff2096' },
        { id: 3, title: 'Obstacle', color: '#ccb71a' }
      ],
      frames: []
    };
  };
  const data = getData();
  window.saveData = () => localStorage.setItem('vannot', JSON.stringify(data));

  const $app = $('#vannot .vannot-app');
  const app = select($app[0]);


  ////////////////////////////////////////////////////////////////////////////////
  // LAYOUT ADJUSTMENT

  const $tracks = $app.find('.vannot-tracks');
  const scrollWidth = $tracks[0].offsetWidth - $tracks[0].clientWidth;
  $app.find('.vannot-scale').css('right', px(scrollWidth));
  $app.find('.vannot-ranger').css('right', px(scrollWidth));


  ////////////////////////////////////////////////////////////////////////////////
  // APPLICATION

  const { Player } = require('./viewmodel/player');
  const player = new Player($app.find('video'), data);
  const { Canvas } = require('./viewmodel/canvas');
  const canvas = new Canvas(player, data);

  const playerInput = require('./input/player');
  playerInput($app, player, canvas);
  const canvasInput = require('./input/canvas');
  canvasInput($app, player, canvas);

  const playerRenderer = require('./render/player').reactor;
  playerRenderer(app, player, canvas);
  const canvasRenderer = require('./render/canvas').reactor;
  canvasRenderer(app, player, canvas);


  ////////////////////////////////////////////////////////////////////////////////
  // GLOBAL INTERACTION

  const $tooltip = $app.find('#vannot-tooltip');
  $app.on('mouseenter', '[title]', (event) => {
    const $target = $(event.target);
    const targetOffset = $target.offset();
    const targetWidth = $target.outerWidth();
    const text = $target.attr('title');

    $tooltip.removeClass('dropped mirrored');
    $tooltip.css('left', targetOffset.left + (targetWidth / 2));
    $tooltip.css('top', targetOffset.top);
    $tooltip.text(text);
    $tooltip.show();

    // detect if tooltip needs reflection because it has wrapped.
    if ($tooltip.height() > 20) {
      $tooltip.addClass('mirrored');
      $tooltip.css('left', 0); // move to left edge for full measurement.
      $tooltip.css('left', targetOffset.left + (targetWidth / 2) - $tooltip.width());
    }

    // detect if tooltip needs to be dropped because it is too close to the top.
    if (targetOffset.top < 25) {
      $tooltip.addClass('dropped');
      $tooltip.css('top', targetOffset.top + $target.outerHeight());
    }

    // strip the title off temporarily so the default tooltip does not show.
    $target.attr('title', '');
    $target.one('mouseleave', () => {
      $target.attr('title', text);
      $tooltip.hide();
    });
  });

});

