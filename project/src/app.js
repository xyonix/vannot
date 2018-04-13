window.tap = (x) => { console.log(x); return x; }; // for quick debug
const $ = window.$ = window.jQuery = require('jquery');
const { select } = require('d3');
const { compose } = require('ramda');
const { px } = require('./util');

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

  // ensures that a given data object has certain required properties. mutates the object.
  const normalizeData = (data) => {
    if (data._seqId == null) data._seqId = 0;
    if (data.objects == null) data.objects = [];
    if (!data.objects.some((object) => object.id === -1))
      data.objects.unshift({ id: -1, title: 'Unassigned', color: '#aaa', system: true });
    if (data.frames == null) data.frames = [];
    return data;
  };
  const getData = (callback) => {
    const source = decodeURIComponent((new URL(window.location)).searchParams.get('data'));
    if (source === 'local') {
      const stored = localStorage.getItem('vannot');
      if (stored != null) callback(JSON.parse(stored));
    } else {
      try {
        const requestPath = new URL(source, window.location.origin);
        $.get(requestPath, callback);
      } catch(ex) {
        console.error('given data parameter is not a valid url!');
      }
    }
  };
  getData(compose(run, normalizeData));

});

