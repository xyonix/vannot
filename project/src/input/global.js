const $ = require('jquery');

module.exports = ($app, data, player, canvas) => {
  // Instant tooltips:
  const $tooltip = $app.find('#vannot-tooltip');
  $app.on('mouseenter', '[title]', (event) => {
    const $target = $(event.target);
    const targetOffset = $target.offset();
    const targetWidth = $target.outerWidth();
    const text = $target.attr('title');

    $tooltip.removeClass('dropped mirrored');
    $tooltip.css('left', targetOffset.left + (targetWidth / 2));
    $tooltip.css('top', targetOffset.top);
    $tooltip.text(text);
    $tooltip.show();

    // detect if tooltip needs reflection because it has wrapped.
    if ($tooltip.height() > 20) {
      $tooltip.addClass('mirrored');
      $tooltip.css('left', 0); // move to left edge for full measurement.
      $tooltip.css('left', targetOffset.left + (targetWidth / 2) - $tooltip.width());
    }

    // detect if tooltip needs to be dropped because it is too close to the top.
    if (targetOffset.top < 25) {
      $tooltip.addClass('dropped');
      $tooltip.css('top', targetOffset.top + $target.outerHeight());
    }

    // strip the title off temporarily so the default tooltip does not show.
    $target.attr('title', '');
    $target.one('mouseleave click', () => {
      $target.attr('title', text);
      $tooltip.hide();
    });
  });

  // Set window properties:
  if (data.app != null) {
    if (data.app.title != null) document.title = data.app.title;
    if (data.app.favicon != null) {
      const $favicon = $('<link/>')
        .attr('type', 'image/x-icon')
        .attr('rel', 'shortcut icon')
        .attr('href', data.app.favicon);
      $('head').append($favicon);
    }
  }

  // Save data:
  $app.find('.vannot-save').on('click', () => { data.save(); });

  // Check for changes on unload:
  $(window).on('beforeunload', (event) => {
    if (data.changed())
      return 'It looks like you have made changes since your last save. Are you sure you wish to leave?';
  });
};

