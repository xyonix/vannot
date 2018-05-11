const { merge, omit, difference, fromPairs } = require('ramda');
const { capture } = require('../render/capture');
const { notify, thenNotify } = require('../render/chrome');
const { getQuerystringValue } = require('../util');
const deepEqual = require('deep-equal');

// eventually we will call this to actually perform the save operation. not public.
const doSave = (data) => {
  if (data.saveUrl != null)
    $.ajax({ method: 'POST', data: JSON.stringify(data), contentType: 'application/json', url: data.saveUrl,
      success: thenNotify('Data has been successfully saved!'),
      error: thenNotify('Something went wrong trying to save data. Please check your connection and try again.', 'error')
    });
  else
    localStorage.setItem('vannot', JSON.stringify(data));
};

// given a data blob and an array of frame ids to export, potentially does the frame
// capture on those frames, then executes the final save operation.
const save = (data, frames = []) => {
  notify('Saving, please wait.');
  const normalized = normalizeData(data); // run through this to clean empty frames.

  // if we have provisioned new frames and are server-based, we need to export those
  // frame images first. otherwise we immediately kick off the actual save operation.
  if ((data.saveUrl == null) || (frames.length === 0))
    doSave(normalized);
  else
    capture(data.video, frames, (imageData) => { doSave(merge(normalized, { imageData })); });
};

// sets a checkpoint in the data so we know which frame images we need to export; that
// checkpoint is recorded by way of setting the save() method on the data object. when
// that save is called, a diff is done to determine image save, then a new checkpoint is
// set.
// !! IMPURE !! mutates the data object; easiest way to handle consecutive saves.
const checkpoint = (data) => {
  // looks goofy but apparently the most performant way: http://jsben.ch/#/bWfk9
  const snapshot = JSON.parse(JSON.stringify(data));
  data.save = () => {
    const clean = omit([ 'save', 'changed' ], data); // strip temp data.
    const frames = difference(data.frames.map((x) => x.frame), snapshot.frames.map((x) => x.frame));
    save(clean, frames);
    checkpoint(data);
  };
  data.changed = () => {
    const clean = omit([ 'save', 'changed' ], data); // strip temp data. TODO: copy/pasta
    return !deepEqual(normalizeData(clean), normalizeData(snapshot));
  };
  return data;
};

// simply calls save with a request to export every annotated frame.
const exportAllFrames = (data) => save(data, data.frames.map((x) => x.frame));

// ensures that a given data object has certain required properties. mutates the object.
const normalizeData = (data) => {
  if (data._seqId == null) data._seqId = 0;
  if (data.objects == null) data.objects = [];
  if (!data.objects.some((object) => object.id === -1))
    data.objects.unshift({ id: -1, title: 'Unassigned', color: '#aaa', system: true });
  if (data.frames == null) data.frames = [];
  if (data.labels == null) data.labels = [];
  data.frames = data.frames.filter((frame) => frame.shapes.length > 0);
  return data;
};

// just fetches data and calls the callback with it.
const getData = (callback) => {
  const source = getQuerystringValue('data');
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

module.exports = { save, checkpoint, exportAllFrames, normalizeData, getData };

