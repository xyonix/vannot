const { select, line } = require('d3');
const { getTemplate, instantiateElems } = require('./util');

const lineCalc = line()
  .x((point) => point.x)
  .y((point) => point.y);

const drawShapes = (canvas, target) => {
  const shapesData = (canvas.frameObj == null) ? [] : (canvas.frameObj.shapes);
  const shapes = instantiateElems(target.selectAll('.trackingShape').data(shapesData), 'g', 'trackingShape');

  shapes.classed('wip', (shape) => (shape.wip === true));
  shapes.each(function(shape) {
    const object = canvas.data.objects.find((x) => x.id === shape.id);

    // populate our line first for stacking order.
    const polyline = instantiateElems(select(this).selectAll('.shapePath').data([ shape ]), 'path', 'shapePath');
    polyline
      .style('fill', (shape) => ((object == null) ? 'none' : object.color))
      .style('stroke', (object != null) ? object.color : null)
      .attr('d', (shape) => {
        const path = lineCalc(shape.points);
        return (shape.wip === true) ? path : (path + 'z');
      });

    // populate our points.
    const points = instantiateElems(select(this).selectAll('.shapePoint').data(shape.points), 'circle', 'shapePoint');
    points
      .attr('r', 2)
      .style('fill', (object != null) ? object.color : null)
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
  if (lastPoint == null) return;
  wipPath.attr('d', lineCalc([ lastPoint, canvas.mouse ]));
};

module.exports = { drawShapes, drawWipSegment };

