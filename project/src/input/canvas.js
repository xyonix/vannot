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

  // "down" refers to mousedown; we don't want to change the selection to a subset on
  // mousedown in case a drag is intended.
  const selectShapeDown = ($target, _, shape, point) => {
    // don't reselect if the point is already part of some selection.
    if ((point != null) && canvas.selected.points.includes(point))
      return false;

    if (shape != null) {
      // don't reselect if the shape is already part of some selection.
      // TODO: but on /mouseup/ the shape should probably be singly-selected, yes?
      if (canvas.selected.wholeShapes.includes(shape)) return;

      // otherwise select it.
      canvas.selectShape(shape);
      return true;
    }
  };

  // whereas on neutral mouseup we definitely do.
  const selectShapeUp = ($target, _, shape) => {
    if (shape != null) {
      canvas.selectShape(shape);
      return true;
    }
  };

  const selectPoint = ($target, _, __, point) => {
    if (point != null) {
      canvas.selectedPoints = [ point ];
      return true;
    }
  };

  const deselect = ($target) => {
    if ($target.is('svg')) {
      canvas.deselect();
      return true;
    }
  };

  const closeShape = ($target) => {
    if ($target.is('.wipCloser')) {
      canvas.endShape();
      return true;
    };
  };

  const drawPoint = (_, mouse) => {
    canvas.wip.points.push(mouse);
    canvas.changedPoints();
  };

  ////////////////////////////////////////////////////////////////////////////////
  // ACTIONS
  // Given application state, determines which actions are available.
  // Each state contains multiple action sets; within each set if an action
  // returns true the rest of the set is halted and the next set is run.

  // mousedown actions happen on every mousedown, and can possibly initiate drags.
  const mousedown = {
    normal: [
      [ selectShapeDown, deselect ],
      [ dragPoints, dragLasso ]
    ],
    drawing: [ [ closeShape, drawPoint ] ],
    shapes: [
      [ selectShapeDown, deselect ],
      [ dragPoint, dragPoints, dragLasso ],
    ],
    points: [
      [ selectShapeDown, deselect ],
      [ dragPoints, dragLasso ]
    ]
  };
  // mouseup operations occur only when a drag has not occurred.
  // we don't make a great deal of effort to ensure the mouse has not moved but there
  // are no cases yet that this is truly disruptive.
  const mouseup = {
    normal: [],
    drawing: [],
    shapes: [ [ selectPoint, selectShapeUp ] ],
    points: [ [ selectPoint ] ]
  };

  {
    ////////////////////////////////////////////////////////////////////////////////
    // LOCAL STATE
    // Mutable. Managed only by inputs below. Kept to an absolute minimum. Always
    // replace by reference, never write directly into.

    let mouse, dragging, viewportWidth, viewportHeight;


    ////////////////////////////////////////////////////////////////////////////////
    // ACTION EXECUTION
    // Mousedown/up on the canvas initiates possible actions; check with the viewmodel
    // to see which should be allowed, then run that set.
    // Mousemove is processed a bit further below.

    // predetermine catch if we have a shape or point and provide that data for the test.
    const findData = ($target) => {
      const $shape = $target.closest('.trackingShape');
      const shape = ($shape.length > 0) ? datum($shape) : null;
      const point = $target.hasClass('shapePoint') ? datum($target) : null;
      return [ shape, point ];
    };

    const $viewport = $app.find('.vannot-viewport');
    $viewport.on('mousedown', (event) => {
      const $target = $(event.target);
      const [ shape, point ] = findData($target);

      // run all action sets for our state.
      for (const actionSets of mousedown[canvas.state]) {
        actionSets.some((action) => {
          if (typeof action === 'function') {
            return action($target, mouse, shape, point);
          } else if (action.test($target, shape, point) === true) {
            let memo = action.init($target, mouse);
            dragging = () => {
              dragging.dragged = true;
              memo = action.drag(memo, mouse) || memo;
            };
            $viewport.one('mouseup', () => action.end(memo, mouse));
            return true;
          }
        });
      }
    });
    $viewport.on('mouseup', (event) => {
      if ((dragging == null) || (dragging.dragged !== true)) {
        const $target = $(event.target);
        const [ shape, point ] = findData($target);
        for (const actionSets of mouseup[canvas.state])
          actionSets.some((action) => action($target, mouse, shape, point));
      }

      // we wait until here to clear out the old drag so we know whether to process
      // the mouseup.
      if (dragging != null) dragging = null;
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
      if (canvas.wip.points.pop() != null)
        canvas.changedPoints();
    });
    $app.find('.vannot-complete').on('click', () => canvas.endShape());

    $app.find('.vannot-object-select').on('change', (event) => {
      const objectId = parseInt($(event.target).find(':selected').attr('value'));
      if (Number.isNaN(objectId)) return;

      for (const shape of canvas.selected.wholeShapes)
        shape.objectId = objectId;
      canvas.changedShapes();
    });
    $app.find('.vannot-duplicate-shape').on('click', () => {
      const duplicates = [];
      for (const shape of canvas.selected.wholeShapes) {
        const points = shape.points.map(({ x, y }) => ({ x: x + 10, y: y + 10 }));
        const duplicate = Object.assign({}, shape, { points });
        canvas.frameObj.shapes.push(duplicate);
        duplicates.push(duplicate);
      }
      canvas.selectShapes(duplicates);
      canvas.changedShapes();
    });
    $app.find('.vannot-delete-shape').on('click', () =>
      canvas.selected.wholeShapes.forEach((shape) => canvas.removeShape(shape)));
  }
};

