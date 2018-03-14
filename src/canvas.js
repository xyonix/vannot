const { select, line } = require('d3');
const { getTemplate, instantiateElems, boolAttr } = require('./util');

const lineCalc = line()
  .x((point) => point.x)
  .y((point) => point.y);

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

const objectSelect = select('#vannot .vannot-object-select');
const updateCanvasChrome = (canvas, target) => {
  target.toggleClass('drawing', (canvas.state === 'drawing'));
  target.toggleClass('shape-select', (canvas.state === 'shape-select'));
  target.toggleClass('normal', (canvas.state == null));

  // update object select dropdown.
  const objectOptions = [{ id: -1, title: 'Unassigned', color: '#aaa' }].concat(canvas.data.objects);
  const options = instantiateElems(objectSelect.selectAll('option').data(objectOptions), 'option');
  options
    .attr('value', (object) => object.id)
    .text((object) => object.title);
  if (canvas.selectedShape != null) objectSelect.node().value = canvas.selectedShape.objectId;
};

module.exports = { drawShapes, drawWipSegment, updateCanvasChrome };

