const { select, line } = require('d3');
const { getTemplate, instantiateElems, pointsEqual, normalizeBox } = require('./util');

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
  const selectedPoints = canvas.selectedPoints;

  shapes.classed('wip', (shape) => (shape.wip === true));
  shapes.classed('selected', (shape) => (canvas.selectedShape === shape));
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
      .classed('selected', (point) => selectedPoints.includes(point))
      .attr('r', 2)
      .style('fill', color)
      .style('stroke', color)
      .attr('cx', (point) => point.x)
      .attr('cy', (point) => point.y);
  });
};

const wipPoint = select('#vannot .wipPoint');
const wipPath = select('#vannot .wipPath');
const drawWipSegment = (canvas, target) => {
  if (canvas.wipShape == null) return; // paranoia.
  wipPoint.attr('cx', canvas.mouse.x).attr('cy', canvas.mouse.y);
  const lastPoint = canvas.wipShape.points[canvas.wipShape.points.length - 1];
  if (lastPoint == null)
    wipPath.attr('d', null);
  else
    wipPath.attr('d', lineCalc([ lastPoint, canvas.mouse ]));
};

const drawSelectionBox = (canvas, target) => {
  const active = ((canvas.selectionBox != null) && !pointsEqual(canvas.selectionBox[0], canvas.selectionBox[1]));
  target.classed('active', active);

  if (active) {
    const box = normalizeBox(canvas.selectionBox);
    target
      .attr('x', box[0].x)
      .attr('y', box[0].y)
      .attr('width', box[1].x - box[0].x)
      .attr('height', box[1].y - box[0].y);
  }
};

const objectSelect = select('#vannot .vannot-object-select');
const updateCanvasChrome = (canvas, target) => {
  target.toggleClass('drawing', (canvas.state === 'drawing'));
  target.toggleClass('shape-select', (canvas.state === 'shape-select'));
  target.toggleClass('point-select', (canvas.state === 'point-select'));
  target.toggleClass('normal', (canvas.state == null));

  // update object select dropdown.
  const options = instantiateElems(objectSelect.selectAll('option').data(canvas.data.objects), 'option');
  options
    .attr('value', (object) => object.id)
    .text((object) => object.title);
  if (canvas.selectedShape != null) objectSelect.node().value = canvas.selectedShape.objectId;
};

module.exports = { setupSvg, drawShapes, drawWipSegment, drawSelectionBox, updateCanvasChrome };

