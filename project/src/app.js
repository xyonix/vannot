window.tap = (x) => { console.log(x); return x; }; // for quick debug
const $ = window.$ = window.jQuery = require('jquery');
const { select } = require('d3');
const { compose } = require('ramda');
const { px, getQuerystringValue } = require('./util');

// docready.
$(function() {

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

  const run = (data) => {
    const { Player } = require('./viewmodel/player');
    const player = new Player($app.find('video'), data);
    const { Canvas } = require('./viewmodel/canvas');
    const canvas = new Canvas(player, data);

    const globalInteractions = require('./input/global');
    globalInteractions($app, player, canvas);

    const playerInput = require('./input/player');
    playerInput($app, player, canvas);
    const canvasInput = require('./input/canvas');
    canvasInput($app, player, canvas);

    const playerRenderer = require('./render/player').reactor;
    playerRenderer(app, player, canvas);
    const canvasRenderer = require('./render/canvas').reactor;
    canvasRenderer(app, player, canvas);
  };


  ////////////////////////////////////////////////////////////////////////////////
  // LOAD/STORE DATA

  // actually fetch our data and wire together our data handlers/reactors.
  const { getData, checkpoint, dataSaver, normalizeData, exportAllFrames } = require('./viewmodel/io');
  if (getQuerystringValue('mode') === 'export')
    getData(compose(exportAllFrames, normalizeData));
  else
    getData(compose(run, checkpoint, normalizeData));
});

