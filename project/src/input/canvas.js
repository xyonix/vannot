const $ = require('jquery');
const { round } = Math;
const { normalizeBox, datum } = require('../util');

module.exports = ($app, player, canvas) => {

  ////////////////////////////////////////////////////////////////////////////////
  // INTERACTIONS
  // The possible interactions that can exist.

  ////////////////////////////////////////
  // Canvas interactions

  const dragBase = {
    test: ($elem, shape, point) => false,
    init: ($elem, mouse) => null,
    drag: (memo, mouse) => null,
    end: (memo, mouse) => null
  };
  const drag = (obj) => Object.assign({}, dragBase, obj);

  const byDelta = (obj) => Object.assign({}, obj, {
    init: ($elem, mouse) => ({
      inner: (typeof obj.init === 'function') ? obj.init($elem) : null,
      last: mouse
    }),
    drag: ({ inner, last }, now) => ({
      inner: obj.drag(inner, { dx: now.x - last.x, dy: now.y - last.y }) || inner,
      last: now
    }),
    end: ({ inner }) => { if (typeof obj.end === 'function') obj.end(inner); }
  });

  const dragLasso = drag({
    test: ($target) => $target.is('svg'),
    init: (_, mouse) => mouse,
    drag: (init, mouse) => { canvas.setLasso(normalizeBox([ init, mouse ])); },
    end: () => canvas.setLasso(null)
  });

  const dragPoints = drag(byDelta({
    test: ($target, shape, point) =>
      ((point != null) && canvas.selected.points.includes(point)) ||
      ((shape != null) && canvas.selected.wholeShapes.includes(shape)),
    drag: (_, { dx, dy }) => {
      canvas.selected.points.forEach((point) => {
        point.x += dx;
        point.y += dy;
      });
      canvas.changedPoints();
    }
  }));

  const dragPoint = drag(byDelta({
    test: ($target, _, point) => (canvas.selected.shape != null) && (point != null) &&
      canvas.selected.shape.points.includes(point),
    init: ($target) => datum($target),
    drag: (point, { dx, dy }) => {
      point.x += dx;
      point.y += dy;
      canvas.changedPoints();
    }
  }));

  const selectShape = ($target, _, shape, point) => {
    // don't reselect if the point is already part of some selection.
    if ((point != null) && canvas.selected.points.includes(point))
      return false;

    if (shape != null) {
      canvas.selectShape(shape);
      return true;
    }
  };

  const deselect = ($target) => {
    if ($target.is('svg')) {
      canvas.deselect();
      return true;
    }
  };

  const drawPoint = (_, mouse) => {
    canvas.wip.points.push(mouse);
    canvas.changedPoints();
  };

  ////////////////////////////////////////////////////////////////////////////////
  // ACTIONS
  // Given application state, determines which actions are available.

  const actions = {
    normal: [
      [ selectShape, deselect ],
      [ dragPoints, dragLasso ]
    ],
    drawing: [ [ drawPoint ] ],
    shapes: [
      [ selectShape, deselect ],
      [ dragPoint, dragPoints, dragLasso ],
    ],
    points: [
      [ selectShape, deselect ],
      [ dragPoints, dragLasso ]
    ]
  };

  {
    ////////////////////////////////////////////////////////////////////////////////
    // LOCAL STATE
    // Mutable. Managed only by inputs below. Kept to an absolute minimum. Always
    // replace by reference, never write directly into.

    let dragging, viewportWidth, viewportHeight, mouse;


    ////////////////////////////////////////////////////////////////////////////////
    // ACTION EXECUTION
    // Mousedown on the canvas initiates possible actions; check with the viewmodel
    // to see which should be allowed, then run that set.

    const $viewport = $app.find('.vannot-viewport');
    $viewport.on('mousedown', (event) => {
      const $target = $(event.target);

      // predetermine catch if we have a shape or point and provide that data for the test.
      const point = $target.hasClass('shapePoint') ? datum($target) : null;
      const $shape = $target.closest('.trackingShape');
      const shape = ($shape.length > 0) ? datum($shape) : null;

      for (const actionSets of actions[canvas.state]) {
        actionSets.some((action) => {
          if (typeof action === 'function') {
            return action($target, mouse, shape, point);
          } else if (action.test($target, shape, point) === true) {
            let memo = action.init($target, mouse);
            dragging = () => { memo = action.drag(memo, mouse) || memo; };
            $viewport.one('mouseup', () => {
              action.end(memo, mouse);
              dragging = null;
            });
            return true;
          }
        });
      }
    });


    ////////////////////////////////////////////////////////////////////////////////
    // BINDINGS
    // Actual bindings into the docmuent to update local or model state.

    ////////////////////////////////////////
    // Global inputs

    // Update viewport size when window is resized (and set it immediately).
    const $video = $app.find('video');
    const viewportPadding = $viewport.width() - $video.width();
    const updateViewportSize = (width, height) => {
      viewportWidth = $viewport.width() - viewportPadding;
      viewportHeight = $viewport.height() - viewportPadding;
    };
    $(window).on('resize', updateViewportSize);
    updateViewportSize();

    // Translate mouse position to canvas-space, store for all handlers to use.
    $(document).on('mousemove', ({ pageX, pageY }) => {
      // figure out our scaling factor and origin.
      // first determine which the constraint side is, then calculate rendered video size.
      const videoRatio = player.video.width / player.video.height;
      const heightConstrained = (viewportWidth / viewportHeight) > videoRatio;
      const renderedWidth = heightConstrained ? (viewportHeight * videoRatio) : viewportWidth;
      const renderedHeight = heightConstrained ? viewportHeight : (viewportWidth / videoRatio);

      // now determine origin point in screenspace.
      const originX = heightConstrained ? round((viewportWidth / 2) - (renderedWidth / 2)) : 0;
      const originY = heightConstrained ? 0 : round((viewportHeight / 2) - (renderedHeight / 2));

      // get the delta, then transform into svg-space.
      const factor = heightConstrained ? (player.video.height / viewportHeight) : (player.video.width / viewportWidth);
      const x = (pageX - (viewportPadding / 2) - originX) * factor;
      const y = (pageY - (viewportPadding / 2) - originY) * factor;

      mouse = { x, y };
      canvas.mouse = mouse;
      if (dragging != null) dragging(mouse);
    });


    ////////////////////////////////////////
    // Element inputs

    const $toolbar = $app.find('.vannot-toolbar');

    $app.find('.vannot-copy-last').on('click', () => canvas.copyLast());

    $app.find('.vannot-draw-shape').on('click', () => canvas.startShape());
    $app.find('.vannot-undo-draw').on('click', () => {
      if (canvas.wipShape.points.pop() != null) {
        canvas.changedPoints();
        // wip segment
      }
    });
    $app.find('.vannot-complete').on('click', () => canvas.endShape());

    $app.find('.vannot-object-select').on('change', (event) => {
      canvas.selected.shape.objectId = parseInt($(event.target).find(':selected').attr('value'));
      canvas.changedShapes();
    });
    $app.find('.vannot-duplicate-shape').on('click', () => {
      const points = canvas.selected.shape.points.map(({ x, y }) => ({ x: x + 10, y: y + 10 }));
      const duplicate = Object.assign({}, canvas.selected.shape, { points });
      canvas.frameObj.shapes.push(duplicate);
      canvas.selectShape(duplicate);
    });
    $app.find('.vannot-delete-shape').on('click', () => canvas.removeShape(canvas.selected.shape));
  }
};

