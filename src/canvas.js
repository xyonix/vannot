const { select, line } = require('d3');
const { getTemplate, instantiateElems } = require('./util');

const lineCalc = line()
  .x((point) => point.x)
  .y((point) => point.y);

const drawShapes = (canvas, target) => {
  const shapesData = (canvas.currentFrameData == null) ? [] : (canvas.currentFrameData.shapes);
  const shapes = instantiateElems(target.selectAll('.trackingShape').data(shapesData), 'g', 'trackingShape');
  shapes.each(function(shape) {
    const object = canvas.data.objects.find((x) => x.id === shape.id);

    // populate our line first for stacking order.
    const polyline = instantiateElems(select(this).selectAll('.shapePath').data([ shape ]), 'path', 'shapePath');
    polyline
      .style('fill', (shape) => ((shape.wip === true) ? 'none' : object.color))
      .style('stroke', object.color)
      .attr('d', (shape) => {
        const path = lineCalc(shape.points);
        return (shape.wip === true) ? path : (path + 'z');
      });

    // populate our points.
    const points = instantiateElems(select(this).selectAll('.shapePoint').data(shape.points), 'circle', 'shapePoint');
    points
      .attr('r', 4)
      .style('fill', object.color)
      .attr('cx', (point) => point.x)
      .attr('cy', (point) => point.y);
  });
};

const drawWipSegment = (canvas, target) => {
};

module.exports = { drawShapes, drawWipSegment };

