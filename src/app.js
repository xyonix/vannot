window.tap = (x) => { console.log(x); return x; }; // for quick debug

const { select, scaleLinear } = require('d3');
const $ = require('jquery');

const { drawTicks, drawPlayhead, drawTracks } = require('./timeline');

const data = {
  video: { duration: 182970, fps: 30, height: 720, width: 1280 },
  objects: [{
    title: 'object a',
    color: '#07e4ff',
    trackpoints: [{
      frame: 2490,
      poly: [{ x: 200, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 500 }, { x: 200, y: 500 }]
    }, {
      frame: 4492,
      poly: [{ x: 100, y: 150 }, { x: 500, y: 150 }, { x: 200, y: 500 }, { x: 100, y: 500 }]
    }]
  }, {
    title: 'object b',
    color: '#ff2096',
    trackpoints: [{
      frame: 2490,
      poly: [{ x: 500, y: 600 }, { x: 700, y: 600 }, { x: 700, y: 700 }, { x: 500, y: 700 }]
    }, {
      frame: 4492,
      poly: [{ x: 400, y: 450 }, { x: 700, y: 450 }, { x: 500, y: 700 }, { x: 400, y: 700 }]
    }]
  }, {
    title: 'object c',
    color: '#ccb71a',
    trackpoints: []
  }]
};

const wrapper = select('#vannot');

const player = { playing: false, frame: 3000, range: [ 0, 182970 ], video: data.video };

const tickWrapper = wrapper.select('.vannot-ticks');
const objectWrapper = wrapper.select('.vannot-objects');
const playhead = wrapper.select('.vannot-playhead');

const updateModel = () => {
  player.scale = scaleLinear().domain(player.range).range([ 0, 100 ]);
};

const updateView = () => {
  drawTicks(player, tickWrapper);
  drawTracks(player, data.objects, objectWrapper);
  drawPlayhead(player, playhead);
};
updateModel();
updateView();

