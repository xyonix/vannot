const { select, line } = require('d3');
const { getTemplate, instantiateElems, last, pointsEqual, normalizeBox, queuer } = require('../util');

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
    const points = instantiateElems(select(this).selectAll('.shapePoint').data(shape.points), 'circle', 'shapePoint');
    points
      .classed('selected', (point) => selected.points.includes(point))
      .attr('r', 2)
      .style('fill', color)
      .style('stroke', color)
      .attr('cx', (point) => point.x)
      .attr('cy', (point) => point.y);
  });
};

const drawWipSegment = (canvas, wipPoint, wipPath) => {
  wipPoint.attr('cx', canvas.mouse.x).attr('cy', canvas.mouse.y);
  const lastPoint = last(canvas.wip.points);
  if (lastPoint == null)
    wipPath.attr('d', null);
  else
    wipPath.attr('d', lineCalc([ lastPoint, canvas.mouse ]));
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


////////////////////////////////////////////////////////////////////////////////
// RENDER SCHEDULER
// Ties into the Canvas viewmodel and schedules the appropriate drawing
// operations. Queues them up so rapid changes don't cause drawchurn.

const drawer = (app, player, canvas) => {
  const svg = app.select('svg');
  const shapeWrapper = svg.select('.shapes');
  const lasso = svg.select('.selectionBox');
  const wipPoint = svg.select('.wipPoint');
  const wipPath = svg.select('.wipPath');
  const objectSelect = app.select('.vannot-object-select');

  const draw = () => {
    const dirty = draw.dirty;
    draw.dirty = {};
    const state = canvas.state;

    if (dirty.selected)
      updateCanvasChrome(canvas, state, app);

    if (dirty.frame || dirty.selected || dirty.shapes || dirty.points)
      drawShapes(canvas, shapeWrapper); // TODO: more granular for more perf.

    if (dirty.selected || dirty.shapes)
      updateObjectSelect(canvas, objectSelect);

    if (dirty.lasso)
      drawLasso(canvas, lasso);

    if ((state === 'drawing') && dirty.mouse)
      drawWipSegment(canvas, wipPoint, wipPath);
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

  // set the svg viewbox and draw the frame to start.
  setupSvg(canvas, app.select('svg'));
  mark('frame');
};

module.exports = { reactor };

//module.exports = { setupSvg, drawShapes, drawWipSegment, drawSelectionBox, updateCanvasChrome };

