'use strict';
// Build a self-contained HTML file without requiring any browser dependencies.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/game.js'), 'utf8');
const styleTag = '<link rel="stylesheet" href="./style.css">';
const gameTag = '<script src="./game.js"></script>';
function replaceOnce(source, needle, replacement) {
  if (source.split(needle).length !== 2) throw Error('Expected exactly one source reference: ' + needle);
  return source.replace(needle, replacement);
}
const embeddedStyle = replaceOnce(html, styleTag, '<style>' + css + '</style>');
const bundled = replaceOnce(embeddedStyle, gameTag, '<script>' + js + '</script>');
const dest = path.join(root, 'index.html');
const tmp = dest + '.tmp';
fs.writeFileSync(tmp, bundled);
fs.renameSync(tmp, dest);
console.log('Generated offline index.html (' + Buffer.byteLength(bundled) + ' bytes)');
