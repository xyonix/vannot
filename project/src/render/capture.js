const $ = require('jquery');
const { immediate } = require('../util');
const { notify } = require('./chrome');

const capture = (video, frames, callback) => {
  const canvas = document.createElement('canvas');
  canvas.width = video.width;
  canvas.height = video.height;
  const context = canvas.getContext('2d');
  const videoElem = document.createElement('video');
  videoElem.src = video.source;

  const queue = frames.slice();
  const wait = (done) => {
    const inner = () => { if (videoElem.readyState === 4) done(); else enqueue(); };
    const enqueue = immediate(() => { setTimeout(inner, 150); });
  };

  const result = {};
  const process = immediate(() => {
    const frame = queue.pop();
    wait(() => {
      context.drawImage(videoElem, 0, 0);
      result[frame] = canvas.toDataURL('image/jpeg');
      notify(`Exported frame ${frames.length - queue.length} of ${frames.length}.`);

      if (queue.length === 0)
        callback(result);
      else
        process();
    });
    videoElem.currentTime = frame / video.fps;
  });
};

module.exports = { capture };

