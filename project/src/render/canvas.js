const { select, line } = require('d3');
const { identity, uniq, merge, prop, flatten } = require('ramda');
const { round } = Math;
const { getTemplate, instantiateElems, last, pointsEqual, digestPoint, normalizeBox, expand, unionAll, queuer, px } = require('../util');

const lineCalc = line()
  .x((point) => point.x)
  .y((point) => point.y);

const setProjection = (canvas, videoWrapper, svg) => {
  // set transform on the video.
  videoWrapper.style('transform', `translate(${px(canvas.pan.x)}, ${px(canvas.pan.y)}) scale(${canvas.scale})`);
};

const drawShapes = (canvas, target) => {
  const shapesData = (canvas.frameObj == null) ? [] : (canvas.frameObj.shapes);
  const shapes = instantiateElems(target.selectAll('.trackingShape').data(shapesData), 'g', 'trackingShape');
  const selected = canvas.selected;

  shapes.classed('wip', (shape) => (shape.wip === true));
  shapes.classed('selected', (shape) => selected.wholeShapes.includes(shape));

  const sortScore = (shape) => selected.wholeShapes.includes(shape) ? shape.id : (-1 * shape.id);
  shapes.sort((a, b) => sortScore(a) - sortScore(b));

  shapes.each(function(shape) {
    const object = canvas.data.objects.find((object) => object.id === shape.objectId);
    const color = (object != null) ? object.color : null;

    // populate our line first for stacking order.
    const pathSelection = select(this).selectAll('.shapePath').data([ shape ], prop('id'));
    const polyline = instantiateElems(pathSelection, 'path', 'shapePath');
    polyline
      .style('fill', color)
      .style('stroke', color)
      .attr('d', (shape) => {
        const path = lineCalc(shape.points.map(canvas.projection.project));
        return (shape.wip === true) ? path : (path + 'z');
      });

    // populate our points.
    const points = instantiateElems(select(this).selectAll('.shapePoint').data(shape.points, digestPoint), 'circle', 'shapePoint');
    points
      .classed('selected', (point) => selected.points.includes(point))
      .attr('r', (point) => (selected.points.includes(point) ? 4 : 2))
      .style('fill', color)
      .attr('cx', (point) => canvas.projection.project.x(point.x))
      .attr('cy', (point) => canvas.projection.project.y(point.y));
  });
};

const drawImplicitPoints = (canvas, target) => {
  const points = instantiateElems(target.selectAll('.implicitPoint').data(canvas.implicitPoints.points,
    (implied) => digestPoint(implied.coords)), 'circle', 'implicitPoint');

  if (canvas.implicitPoints.object != null) {
    points
      .style('fill', canvas.implicitPoints.object.color)
      .attr('r', 4)
      .attr('cx', (implied) => canvas.projection.project.x(implied.coords.x))
      .attr('cy', (implied) => canvas.projection.project.y(implied.coords.y));
  }
};

const drawInstances = (canvas, target) => {
  // TODO: almost certainly move this polygon math elsewhere.
  const instanceIds = canvas.frameObj.shapes
    .filter((shape) => shape.instanceId != null)
    .map((shape) => shape.instanceId);
  const instanceOutlines = flatten(instanceIds.map((instanceId) => {
    const shapes = canvas.shapesInInstance(instanceId);
    const selected = shapes.some((shape) => canvas.selected.wholeShapes.includes(shape));
    const outlines = unionAll(shapes.map((shape) => expand(shape.points, 25)));
    const instanceClass = canvas.instanceClass(canvas.instance(instanceId).class);
    return outlines.map((points, idx) => ({ id: `${instanceId}-${idx}`, points, selected, instanceClass }));
  }));

  _drawInstanceOutlines(canvas, instanceOutlines, target.select('.instanceBases'));
  _drawInstanceOutlines(canvas, instanceOutlines, target.select('.instanceDashes'), true);
};

const _drawInstanceOutlines = (canvas, instanceOutlines, target, colorize = false) => {
  const outlineSelection = target.selectAll('.instanceOutline').data(instanceOutlines, prop('id'))
  const outlines = instantiateElems(outlineSelection, 'path', 'instanceOutline');
  outlines
    .classed('selected', prop('selected'))
    .attr('d', (outline) => lineCalc(outline.points.map(canvas.projection.project)) + 'z');
  if (colorize === true) {
    outlines.style('stroke', (outline) => {
      if ((outline.instanceClass == null) || (outline.instanceClass.color == null)) return '#aaa';
      else return outline.instanceClass.color;
    });
  }
};

const drawWipSegment = (canvas, wipPoint, wipPath) => {
  wipPoint
    .attr('cx', canvas.projection.project.x(canvas.mouse.x))
    .attr('cy', canvas.projection.project.y(canvas.mouse.y));

  const lastPoint = last(canvas.wip.points);
  if (lastPoint == null)
    wipPath.attr('d', null);
  else
    wipPath.attr('d', lineCalc([ lastPoint, canvas.mouse ].map(canvas.projection.project)));
};

const drawWipCloser = (canvas, wipCloser) => {
  if ((canvas.wip == null) || (canvas.wip.points.length === 0)) {
    wipCloser.classed('visible', false);
  } else {
    wipCloser.classed('visible', true);
    wipCloser
      .attr('cx', canvas.projection.project.x(canvas.wip.points[0].x))
      .attr('cy', canvas.projection.project.y(canvas.wip.points[0].y));
  }
};

const drawLasso = (canvas, target) => {
  const active = ((canvas.lasso != null) && !pointsEqual(canvas.lasso[0], canvas.lasso[1]));
  target.classed('active', active);

  if (active) {
    const box = normalizeBox(canvas.lasso);
    const topleft = canvas.projection.project(box[0]);
    const bottomright = canvas.projection.project(box[1]);
    target
      .attr('x', topleft.x)
      .attr('y', topleft.y)
      .attr('width', bottomright.x - topleft.x)
      .attr('height', bottomright.y - topleft.y);
  }
};

const updateCanvasChrome = (canvas, state, app) => {
  app.classed('normal', state === 'normal');
  app.classed('drawing', state === 'drawing');
  app.classed('shapes', state === 'shapes');
  app.classed('points', state == 'points');

  app.classed('tool-select', canvas.tool === 'select');
  app.classed('tool-pan', canvas.tool === 'pan');
};

const updateObjectSelect = (canvas, objectSelect) => {
  // do nothing if we are not visible:
  if (canvas.selected.partialShapes.length > 0) return;
  if (canvas.selected.wholeShapes.length === 0) return;

  // determine if we have mixed or consistent selection.
  const options = canvas.data.objects.slice();
  const consistentAssignment = canvas.selected.wholeShapes.every((shape) =>
    shape.objectId === canvas.selected.wholeShapes[0].objectId);
  if (consistentAssignment === false)
    options.unshift({ id: 'multiple', title: '(multiple objects)' });

  // update object select dropdown options.
  instantiateElems(objectSelect.selectAll('option').data(options), 'option')
    .attr('value', prop('id'))
    .text((object) => object.title);

  // update dropdown selected value.
  if (consistentAssignment === true)
    objectSelect.node().value = canvas.selected.wholeShapes[0].objectId;
  else
    objectSelect.node().value = 'multiple';
};

const updateToolbarCounts = (canvas, toolbar) => {
  if (canvas.state === 'shapes') {
    toolbar.select('.vannot-toolbar-shapes-count').text(canvas.selected.wholeShapes.length);
    toolbar.select('.vannot-toolbar-shapes-plural')
      .classed('visible', canvas.selected.wholeShapes.length > 1);
  } else if (canvas.state === 'points') {
    toolbar.select('.vannot-toolbar-points-count').text(canvas.selected.points.length);
    toolbar.select('.vannot-toolbar-points-plural')
      .classed('visible', canvas.selected.points.length > 1);

    const shapeCount = canvas.selected.wholeShapes.length + canvas.selected.partialShapes.length;
    toolbar.select('.vannot-toolbar-partial-count').text(shapeCount);
    toolbar.selectAll('.vannot-toolbar-partial-plural').classed('visible', shapeCount > 1);
  }
};

// TODO: should the visibility toggles below be done via a parent class+css instead?
//       that's more how we do it elsewhere.
const updateInstanceToolbar = (canvas, toolbar) => {
  if (canvas.state !== 'shapes') return;

  // set instance toolbar mode.
  toolbar.classed(`vannot-instance-mode-${canvas.instanceMode}`, true);

  // update label visibility/text.
  toolbar.selectAll('.vannot-toolbar-instance-status').classed('visible', false);
  if (canvas.selected.instances.length === 0) {
      toolbar.select('.vannot-toolbar-instance-none').classed('visible', true);
  } else if (canvas.selected.instances.length === 1) {
    if ((canvas.selected.instance != null) && (canvas.instanceMode !== 'none')) {
      toolbar.select('.vannot-toolbar-instance-class').classed('visible', true);
      for (const node of toolbar.selectAll('.vannot-instance-class').nodes())
        node.value = canvas.selected.instance.class || '';
    } else {
      toolbar.select('.vannot-toolbar-instance-assigned').classed('visible', true);
      toolbar.select('.vannot-toolbar-instance-count').text(
        canvas.shapesInInstance(canvas.selected.instances[0].id).length);
    }
  } else {
    toolbar.select('.vannot-toolbar-instance-mixed').classed('visible', true);
  }

  // update button visibility.
  const singleInstanceSelected = (canvas.selected.instances.length === 1) && !canvas.selected.instanceless;
  toolbar.select('.vannot-instance-form').classed('visible', (canvas.selected.instance == null));
  toolbar.select('.vannot-instance-break').classed('visible', singleInstanceSelected);
  toolbar.select('.vannot-instance-select').classed('visible', singleInstanceSelected &&
    (canvas.shapesInInstance(canvas.selected.instances[0].id).length !== canvas.selected.wholeShapes.length));
};

const updateInstanceList = (canvas, list) => {
  const fromInstances = canvas.data.instances.map((instance) => instance.class);
  const fromClasses = canvas.data.instanceClasses.map((ic) => ic.id);
  const instanceClasses = uniq(fromInstances.concat(fromClasses)).filter((id) => id != null);
  instantiateElems(list.selectAll('option').data(instanceClasses), 'option')
    .attr('value', identity)
    .sort();
};

const updateInstanceSelect = (canvas, select) => {
  const instanceClasses = canvas.data.instanceClasses.map((ic) => ({ id: ic.id, label: ic.id }));
  instanceClasses.unshift({ id: '', label: '(unassigned)' });
  instantiateElems(select.selectAll('option').data(instanceClasses), 'option')
    .attr('value', (x) => x.id)
    .text((x) => x.label);
};

const zoomStops = [ 0.5, 0.75, 1, 1.5, 2, 3, 4 ];
const updateZoomSelect = (canvas, zoomSelect) => {
  const options = zoomStops.includes(canvas.scale)
    ? zoomStops
    : zoomStops.concat([ canvas.scale ]).sort();
  instantiateElems(zoomSelect.selectAll('option').data(options), 'option')
    .attr('value', identity)
    .text((x) => round(x * 100) + '%');
  zoomSelect.node().value = canvas.scale;
};

const updateDragState = (canvas, app) => {
  const classes = app.attr('class').split(/ +/g);
  const newClass = (canvas.dragState == null) ? '' : ` dragstate-${canvas.dragState}`;
  app.attr('class', classes.filter((klass) =>
    !klass.startsWith('dragstate')).join(' ') + newClass);
};


////////////////////////////////////////////////////////////////////////////////
// RENDER SCHEDULER
// Ties into the Canvas viewmodel and schedules the appropriate drawing
// operations. Queues them up so rapid changes don't cause drawchurn.

const drawer = (app, player, canvas) => {
  const videoWrapper = app.select('.vannot-video');
  const svg = app.select('svg');
  const shapeWrapper = svg.select('.shapes');
  const implicitWrapper = svg.select('.implicitPoints');
  const lasso = svg.select('.selectionBox');
  const wipPath = svg.select('.wipPath');
  const wipPoint = svg.select('.wipPoint');
  const wipCloser = svg.select('.wipCloser');
  const toolbar = app.select('.vannot-toolbar');
  const objectSelect = toolbar.select('.vannot-object-select');
  const instanceDatalist = toolbar.select('#vannot-instance-list');
  const instanceSelect = toolbar.select('select.vannot-instance-class');
  const zoomSelect = app.select('.vannot-video-zoom-edit');

  const draw = () => {
    const dirty = draw.dirty;
    draw.dirty = {};
    const state = canvas.state;

    if (dirty.projection) {
      setProjection(canvas, videoWrapper, svg);
      updateZoomSelect(canvas, zoomSelect);
    }

    if (dirty.tool || dirty.selected)
      updateCanvasChrome(canvas, state, app);

    if (dirty.selected)
      updateToolbarCounts(canvas, toolbar);

    if (dirty.selected || dirty.instances)
      updateInstanceToolbar(canvas, toolbar);

    if (dirty.instances) {
      if (canvas.instanceMode === 'freeform')
        updateInstanceList(canvas, instanceDatalist);
      else if (canvas.instanceMode === 'preset')
        updateInstanceSelect(canvas, instanceSelect);
    }

    if (dirty.frame || dirty.projection || dirty.selected || dirty.objects || dirty.shapes || dirty.points)
      drawShapes(canvas, shapeWrapper); // TODO: more granular for more perf.

    if (dirty.frame || dirty.projection || dirty.selected || dirty.points || dirty.instances)
      drawInstances(canvas, svg);

    if (dirty.selected || dirty.objects || dirty.shapes)
      updateObjectSelect(canvas, objectSelect);

    if (dirty.lasso)
      drawLasso(canvas, lasso);

    if (state === 'drawing') {
      // TODO: for now always run both of these:
      // 1. when state initially transitions to drawing the leftover artifacts from the
      //    previous shape needs clearing out, so we must call once.
      // 2. wipsegment is already called every mousemove and wipcloser is dirt cheap.
      // eventually maybe something more elegant.
      drawWipSegment(canvas, wipPoint, wipPath);
      drawWipCloser(canvas, wipCloser);
    }

    if (dirty.selected || ((canvas.selected.shape != null) && dirty.mouse))
      drawImplicitPoints(canvas, implicitWrapper);

    if (dirty.mouse)
      updateDragState(canvas, app);
  };
  draw.dirty = {};
  return draw;
};
const reactor = (app, player, canvas) => {
  const draw = drawer(app, player, canvas);
  const queue = queuer(draw);
  const mark = (prop) => () => {
    queue();
    draw.dirty[prop] = true;
  };
  canvas.events.on('change.frame', mark('frame'));
  canvas.events.on('change.selected', mark('selected'));
  canvas.events.on('change.lasso', mark('lasso'));
  canvas.events.on('change.projection', mark('projection'));
  canvas.events.on('change.mouse', mark('mouse'));
  canvas.events.on('change.points', mark('points'));
  canvas.events.on('change.shapes', mark('shapes'));
  canvas.events.on('change.instances', mark('instances'));
  canvas.events.on('change.tool', mark('tool'));

  player.events.on('change.objects', mark('objects'));

  mark('frame')();
  mark('projection')();
  mark('instances')();
};

module.exports = { reactor };

//module.exports = { setupSvg, drawShapes, drawWipSegment, drawSelectionBox, updateCanvasChrome };

