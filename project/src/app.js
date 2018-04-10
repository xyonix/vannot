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


  ////////////////////////////////////////////////////////////////////////////////
  // APPLICATION

  const $app = $('#vannot .vannot-app');
  const app = select($app[0]);

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
  // LAYOUT ADJUSTMENT

  const $tracks = $app.find('.vannot-tracks');
  const scrollWidth = $tracks[0].offsetWidth - $tracks[0].clientWidth;
  $app.find('.vannot-scale').css('right', px(scrollWidth));
  $app.find('.vannot-ranger').css('right', px(scrollWidth));
});

