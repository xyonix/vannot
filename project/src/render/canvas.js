const { select, line } = require('d3');
const { getTemplate, instantiateElems, last, pointsEqual, digestPoint, normalizeBox, queuer } = require('../util');

const lineCalc = line()
  .x((point) => point.x)
  .y((point) => point.y);

const setupSvg = (canvas, target) => {
  const { width, height } = canvas.data.video;
  target.attr('viewBox', `0 0 ${width} ${height}`);
};

const drawShapes = (canvas, target) => {
  const shapesData = (canvas.frameObj == null) ? [] : (canvas.frameObj.shapes);
  const shapes = instantiateElems(target.selectAll('.trackingShape').data(shapesData), 'g', 'trackingShape');
  const selected = canvas.selected;

  shapes.classed('wip', (shape) => (shape.wip === true));
  shapes.classed('selected', (shape) => selected.wholeShapes.includes(shape));
  shapes.each(function(shape) {
    const object = canvas.data.objects.find((object) => object.id === shape.objectId);
    const color = (object != null) ? object.color : null;

    // populate our line first for stacking order.
    const pathSelection = select(this).selectAll('.shapePath').data([ shape ], (shape) => shape.id);
    const polyline = instantiateElems(pathSelection, 'path', 'shapePath');
    polyline
      .style('fill', color)
      .style('stroke', color)
      .attr('d', (shape) => {
        const path = lineCalc(shape.points);
        return (shape.wip === true) ? path : (path + 'z');
      });

    // populate our points.
    const points = instantiateElems(select(this).selectAll('.shapePoint').data(shape.points, digestPoint), 'circle', 'shapePoint');
    points
      .classed('selected', (point) => selected.points.includes(point))
      .attr('r', (point) => (selected.points.includes(point) ? 8 : 2))
      .style('fill', color)
      .attr('cx', (point) => point.x)
      .attr('cy', (point) => point.y);
  });
};

const drawImplicitPoints = (canvas, target) => {
  const points = instantiateElems(target.selectAll('.implicitPoint').data(canvas.implicitPoints.points,
    (implied) => digestPoint(implied.coords)), 'circle', 'implicitPoint');

  if (canvas.implicitPoints.object != null) {
    points
      .style('fill', canvas.implicitPoints.object.color)
      .attr('r', 8)
      .attr('cx', (implied) => implied.coords.x)
      .attr('cy', (implied) => implied.coords.y);
  }
};

const drawWipSegment = (canvas, wipPoint, wipPath) => {
  wipPoint.attr('cx', canvas.mouse.x).attr('cy', canvas.mouse.y);
  const lastPoint = last(canvas.wip.points);
  if (lastPoint == null)
    wipPath.attr('d', null);
  else
    wipPath.attr('d', lineCalc([ lastPoint, canvas.mouse ]));
};

const drawWipCloser = (canvas, wipCloser) => {
  if ((canvas.wip == null) || (canvas.wip.points.length === 0)) {
    wipCloser.classed('visible', false);
  } else {
    wipCloser.classed('visible', true);
    wipCloser.attr('cx', canvas.wip.points[0].x).attr('cy', canvas.wip.points[0].y);
  }
};

const drawLasso = (canvas, target) => {
  const active = ((canvas.lasso != null) && !pointsEqual(canvas.lasso[0], canvas.lasso[1]));
  target.classed('active', active);

  if (active) {
    const box = normalizeBox(canvas.lasso);
    target
      .attr('x', box[0].x)
      .attr('y', box[0].y)
      .attr('width', box[1].x - box[0].x)
      .attr('height', box[1].y - box[0].y);
  }
};

const updateCanvasChrome = (canvas, state, app) => {
  app.classed('normal', state === 'normal');
  app.classed('drawing', state === 'drawing');
  app.classed('shapes', state === 'shapes');
  app.classed('points', state == 'points');
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
    .attr('value', (object) => object.id)
    .text((object) => object.title);

  // update dropdown selected value.
  if (consistentAssignment === true)
    objectSelect.node().value = canvas.selected.wholeShapes[0].objectId;
  else
    objectSelect.node().value = 'multiple';
};

const updateToolbarCounts = (canvas, toolbar) => {
  if (canvas.state === 'shapes')
    toolbar.select('.vannot-toolbar-shapes-plural')
      .classed('visible', canvas.selected.wholeShapes.length > 1);
  if (canvas.state === 'points') {
    toolbar.select('.vannot-toolbar-points-count').text(canvas.selected.points.length);
    toolbar.select('.vannot-toolbar-points-plural')
      .classed('visible', canvas.selected.points.length > 1);
  }
};


////////////////////////////////////////////////////////////////////////////////
// RENDER SCHEDULER
// Ties into the Canvas viewmodel and schedules the appropriate drawing
// operations. Queues them up so rapid changes don't cause drawchurn.

const drawer = (app, player, canvas) => {
  const svg = app.select('svg');
  const shapeWrapper = svg.select('.shapes');
  const implicitWrapper = svg.select('.implicitPoints');
  const lasso = svg.select('.selectionBox');
  const wipPath = svg.select('.wipPath');
  const wipPoint = svg.select('.wipPoint');
  const wipCloser = svg.select('.wipCloser');
  const toolbar = app.select('.vannot-toolbar');
  const objectSelect = toolbar.select('.vannot-object-select');

  const draw = () => {
    const dirty = draw.dirty;
    draw.dirty = {};
    const state = canvas.state;

    if (dirty.selected) {
      updateCanvasChrome(canvas, state, app);
      updateToolbarCounts(canvas, toolbar);
    }

    if (dirty.frame || dirty.selected || dirty.objects || dirty.shapes || dirty.points)
      drawShapes(canvas, shapeWrapper); // TODO: more granular for more perf.

    if (dirty.selected || dirty.shapes)
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
  canvas.events.on('change.mouse', mark('mouse'));
  canvas.events.on('change.points', mark('points'));
  canvas.events.on('change.shapes', mark('shapes'));
  player.events.on('change.objects', mark('objects'));

  // set the svg viewbox and draw the frame to start.
  setupSvg(canvas, app.select('svg'));
  mark('frame');
};

module.exports = { reactor };

//module.exports = { setupSvg, drawShapes, drawWipSegment, drawSelectionBox, updateCanvasChrome };

