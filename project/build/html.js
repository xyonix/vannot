const { readFileSync } = require('fs');
const jquery = require('jquery');
const { JSDOM } = require('jsdom');

const timestamp = '?' + (new Date()).getTime().toString();
const input = readFileSync(process.argv[2]);
const dom = new JSDOM(input);
const $ = jquery(dom.window);

$('link[rel=stylesheet]').each((_, link) => {
  const $link = $(link);
  $link.prop('href', $link.prop('href') + timestamp);
});

$('script').each((_, script) => {
  const $script = $(script);
  $script.prop('src', $script.prop('src') + timestamp);
});

process.stdout.write(dom.serialize());

