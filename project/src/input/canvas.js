const $ = require('jquery');
const { round, min, abs, sign } = Math;
const { without, last, mean } = require('ramda');
const { normalizeBox, datum, clamp } = require('../util');

module.exports = ($app, player, canvas) => {

  const $document = $(document);

  ////////////////////////////////////////////////////////////////////////////////
  // INTERACTIONS
  // The possible interactions that can exist.

  ////////////////////////////////////////
  // Canvas interactions

  const dragBase = {
    test: ($elem, { shape, point }) => false,
    init: ($elem, { mouse }) => null,
    drag: (memo, mouse) => null,
    end: (memo, { mouse }) => null
  };
  const drag = (obj) => Object.assign({}, dragBase, obj);

  const byDelta = (obj) => Object.assign({}, obj, {
    init: ($elem, args) => ({
      inner: (typeof obj.init === 'function') ? obj.init($elem, args) : null,
      last: args.mouse
    }),
    drag: ({ inner, last }, now) => ({
      inner: obj.drag(inner, { dx: now.x - last.x, dy: now.y - last.y }) || inner,
      last: now
    }),
    end: ({ inner }) => { if (typeof obj.end === 'function') obj.end(inner); }
  });

  const dragLasso = drag({
    test: ($target) => $target.is('svg'),
    init: (_, { mouse }) => mouse,
    drag: (init, mouse) => { canvas.setLasso(normalizeBox([ init, mouse ])); },
    end: () => canvas.setLasso(null)
  });

  const dragPoints = drag(byDelta({
    test: ($target, { shape, point }) =>
      ((point != null) && canvas.selected.points.includes(point)) ||
      ((shape != null) && canvas.selected.wholeShapes.includes(shape)),
    init: (_, { keys }) => {
      // clone if applicable.
      if ((keys.duplicate) && (canvas.selected.partialShapes.length === 0))
        canvas.duplicateSelected();
    },
    drag: (_, { dx, dy }) => {
      canvas.selected.points.forEach((point) => {
        point.x += dx;
        point.y += dy;
      });
      canvas.changedPoints();
    }
  }));

  const dragPoint = drag(byDelta({
    test: ($target, { point }) => (canvas.selected.shape != null) && (point != null) &&
      canvas.selected.shape.points.includes(point),
    init: ($target) => datum($target),
    drag: (point, { dx, dy }) => {
      point.x += dx;
      point.y += dy;
      canvas.changedPoints();
    }
  }));

  const dragImplicitPoint = drag(byDelta({
    test: ($target) => $target.is('.implicitPoint'),
    init: ($target) => {
      const implied = datum($target);
      const idx = canvas.selected.shape.points.indexOf(implied.after);
      canvas.selected.shape.points.splice(idx + 1, 0, implied.coords);
      canvas.changedPoints();
      canvas.selectShape(canvas.selected.shape);
      return implied.coords;
    },
    drag: (point, { dx, dy }) => {
      point.x += dx;
      point.y += dy;
      canvas.changedPoints();
    }
  }));

  const pan = drag({
    test: () => (canvas.tool === 'pan'),
    init: () => {
      // we do this manually as we wish to operate in screen-space.
      let lastX, lastY;
      $document.on('mousemove.pan', ({ pageX, pageY }) => {
        if (lastX != null)
          canvas.pan = { x: canvas.pan.x + (pageX - lastX), y: canvas.pan.y + (pageY - lastY) };
        lastX = pageX;
        lastY = pageY;
      });
    },
    end: () => { $document.off('mousemove.pan'); }
  });

  // "down" refers to mousedown; we don't want to change the selection to a subset on
  // mousedown in case a drag is intended.
  const selectShapeDown = ($target, { shape, point, keys }) => {
    // don't reselect if the point is already part of some selection.
    if ((point != null) && canvas.selected.points.includes(point))
      return false;

    if (shape != null) {
      const isSelected = canvas.selected.wholeShapes.includes(shape);
      if (keys.select) {
        if (isSelected)
          canvas.selectedPoints = without(shape.points, canvas.selected.points);
        else
          canvas.selectedPoints = canvas.selected.points.concat(shape.points);
        return true;
      } else if (isSelected) {
        // if we are not toggling and we have already selected this shape do nothing.
        return false;
      } else {
        // otherwise select it.
        canvas.selectShape(shape);
        return true;
      }
    }
  };

  // whereas on neutral mouseup we definitely do.
  const selectShapeUp = ($target, { shape, keys }) => {
    if (!keys.select && (shape != null)) {
      canvas.selectShape(shape);
      return true;
    }
  };

  const selectPoint = ($target, { point }) => {
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

  const drawPoint = (_, { mouse }) => {
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
      [ pan, dragPoints, dragLasso ]
    ],
    drawing: [ [ pan, closeShape, drawPoint ] ],
    shapes: [
      [ selectShapeDown, deselect ],
      [ pan, dragImplicitPoint, dragPoint, dragPoints, dragLasso ],
    ],
    points: [
      [ selectShapeDown, deselect ],
      [ pan, dragPoints, dragLasso ]
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

    let mouse, downState, dragging;


    ////////////////////////////////////////////////////////////////////////////////
    // ACTION EXECUTION
    // Mousedown/up on the canvas initiates possible actions; check with the viewmodel
    // to see which should be allowed, then run that set.
    // Mousemove is processed a bit further below.

    // predetermine catch if we have a shape or point and provide that data for the test.
    const eventData = (event) => {
      const $target = $(event.target);
      const $shape = $target.closest('.trackingShape');
      const shape = ($shape.length > 0) ? datum($shape) : null;
      const point = $target.hasClass('shapePoint') ? datum($target) : null;
      const keys = { select: event.shiftKey, duplicate: (event.ctrlKey || event.altKey) };
      return [ $target, shape, point, keys ];
    };

    const $viewport = $app.find('.vannot-viewport');
    $viewport.on('mousedown', (event) => {
      downState = canvas.state;
      const [ $target, shape, point, keys ] = eventData(event);
      const dataArg = { mouse, keys, shape, point };

      // run all action sets for our state.
      for (const actionSets of mousedown[canvas.state]) {
        actionSets.some((action) => {
          if (typeof action === 'function') {
            return action($target, dataArg);
          } else if (action.test($target, dataArg) === true) {
            let memo;
            dragging = () => {
              if (dragging.dragged !== true) {
                dragging.dragged = true;
                memo = action.init($target, dataArg);
                $viewport.one('mouseup', () => action.end(memo, mouse));
              }
              memo = action.drag(memo, mouse) || memo;
            };
            return true;
          }
        });
      }
    });
    $viewport.on('mouseup', (event) => {
      const state = canvas.state;
      // only process mouseup actions if the state has not changed since mousedown, AND
      // if the user has not executed any dragging operations.
      if ((state === downState) && ((dragging == null) || (dragging.dragged !== true))) {
        const [ $target, shape, point, keys ] = eventData(event);
        const dataArg = { mouse, keys, shape, point };
        for (const actionSets of mouseup[state])
          actionSets.some((action) => action($target, dataArg));
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

    // Track whether we are holding the spacebar:
    $document.on('keydown', (event) => { if (event.which === 32) canvas.toolOverride = 'pan'; });
    $document.on('keyup', (event) => { if (event.which === 32) canvas.toolOverride = null; });

    // Update viewport size when window is resized (and set it immediately).
    const $video = $app.find('.vannot-viewport video');
    const viewportPadding = $viewport.width() - $video.width();
    const updateViewportSize = () => {
      canvas.viewportSize = {
        width: $viewport.width(),
        height: $viewport.height(),
        padding: viewportPadding
      };
    };
    $(window).on('resize', updateViewportSize);
    updateViewportSize();

    // Translates page-space mouse position to canvas-space.
    const projectMouse = (pageX, pageY, projection) => {
      const x = (pageX - (viewportPadding / 2) - projection.origin.x) * projection.factor;
      const y = (pageY - (viewportPadding / 2) - projection.origin.y) * projection.factor;
      return { x, y };
    };

    // Sets local/canvas mouse state give page coordinates.
    const processMouse = (pageX, pageY) => {
      canvas.mouse = mouse = projectMouse(pageX, pageY, canvas.projection);
      if (dragging != null) dragging(mouse);
    };
    $document.on('mousemove', ({ pageX, pageY }) => { processMouse(pageX, pageY); });


    ////////////////////////////////////////
    // Pan/zoom

    // we have to do a ton of work to normalize scroll delta between different browsers;
    // the reported delta can be anything from ~1 to ~1,000.
    const wheelSamples = []; // track the largest-rate samples.
    const factorRateCap = 1.3; // ideally we cap by rate (scalefactor/sec), but
    const factorTickCap = 0.1; // lacking enough samples we'll cap by per-event-fire instead.
    let lastSample; // we need the previous sample to compute deltas.

    const scaleSign = (x) => (x > 1) ? 1 : (x === 1) ? 0 : -1;
    let signLock; // we also pause momentarily at zoom sign-change.
    $viewport.on('mousewheel', (event) => {
      // deal with sample collection:
      const now = new Date();
      if (lastSample != null) {
        const deltaT = now - lastSample.at;
        if ((deltaT > 5) && (deltaT < 500) && (wheelSamples.length < 100))
          wheelSamples.push({ deltaT, rate: abs(event.deltaY / deltaT) });
      }
      lastSample = { at: now, deltaY: event.deltaY };

      // compute the desired scale change:
      const effectiveDelta = (wheelSamples.length < 2)
        ? (factorTickCap * sign(event.deltaY))
        : event.deltaY * factorRateCap / mean(wheelSamples.map((x) => x.rate * 1000)); // msec => sec

      // apply the scale change, with clamping and signlocking considerations:
      const currentScale = canvas.scale;
      const targetScale = clamp(0.5, currentScale + effectiveDelta, 3.5);
      const currentSign = scaleSign(currentScale);
      const targetSign = scaleSign(targetScale);
      if ((currentSign === targetSign) || ((currentSign === 0) && (signLock == null))) {
        // same-sign, we can always apply.
        canvas.scale = targetScale;
      } else if (signLock == null) {
        canvas.scale = 1;
        signLock = { sign: currentSign, at: now };
      } else if ((targetSign === signLock.sign) || ((now - signLock.at) > 500)) {
        canvas.scale = targetScale;
        signLock = null;
      }

      // finally, adjust our pan so that the relative mouse-position remains static:
      const scaled = projectMouse(event.pageX, event.pageY, canvas.projection);
      canvas.pan = {
        x: canvas.pan.x + (scaled.x - mouse.x) / canvas.projection.factor,
        y: canvas.pan.y + (scaled.y - mouse.y) / canvas.projection.factor
      };

      // and recalculate scaled mouse position:
      processMouse(event.pageX, event.pageY);
    });

    // Also handle the zoom toolbar:
    const $zoomSelect = $app.find('.vannot-video-zoom-edit');
    $zoomSelect.on('change', (event) => {
      canvas.scale = parseFloat($zoomSelect.val());
      $zoomSelect.blur(); // otherwise if you then try to spacebar to pan it reselects the dropdown.
    });
    // And the select/pan toolbuttons:
    $app.find('.vannot-select-mode').on('click', () => { canvas.tool = 'select'; });
    $app.find('.vannot-pan-mode').on('click', () => { canvas.tool = 'pan'; });


    ////////////////////////////////////////
    // Element inputs

    const $toolbar = $app.find('.vannot-toolbar');

    // Normal state:
    $app.find('.vannot-copy-last').on('click', () => {
      player.pause();
      canvas.copyLast();
    });
    $app.find('.vannot-draw-shape').on('click', () => {
      player.pause();
      canvas.startShape()
      canvas.tool = 'select';
    });

    // Drawing state:
    $app.find('.vannot-undo-draw').on('click', () => {
      if (canvas.wip.points.pop() != null)
        canvas.changedPoints();
    });
    $app.find('.vannot-complete').on('click', () => canvas.endShape());

    // Shapes state:
    $app.find('.vannot-object-select').on('change', (event) => {
      const objectId = parseInt($(event.target).find(':selected').attr('value'));
      if (Number.isNaN(objectId)) return;

      for (const shape of canvas.selected.wholeShapes)
        shape.objectId = objectId;
      canvas.changedShapes();
    });
    $app.find('.vannot-duplicate-shape').on('click', () => canvas.duplicateSelected(10));
    $app.find('.vannot-delete-shape').on('click', () =>
      canvas.selected.wholeShapes.forEach((shape) => canvas.removeShape(shape)));

    // Points state:
    $app.find('.vannot-delete-points').on('click', () => canvas.removePoints(canvas.selected.points));
    $app.find('.vannot-expand-selection').on('click', () => canvas.expandSelection());
  }
};

