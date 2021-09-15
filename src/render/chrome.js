const $ = require('jquery');

// this is sad and impure but i can't think of a better way for now and it works:
let $app;
const attach = ($target) => { $app = $target; };

const notify = (message, type = 'info') => {
  const $message = $('<div/>').addClass('vannot-notify-message').addClass(`vannot-notify-message-${type}`);
  $message.text(message);
  $app.find('.vannot-notify').prepend($message);
  setTimeout((() => { $message.remove(); }), 6000);
};
// save some bare lambdas:
const thenNotify = (message, type) => () => notify(message, type);

module.exports = { attach, notify, thenNotify };

