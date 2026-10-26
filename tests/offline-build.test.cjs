'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {Script} = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = path => fs.readFileSync(path, 'utf8');

test('source JavaScript parses on Node and exposes the game API', () => {
 const code = read(path.join(root, 'src/game.js'));
 assert.ok(code.includes('window.StickLab='), 'explicit browser test hook missing');
 assert.doesNotThrow(() => new Script(code));
});

test('generated standalone is complete, inline, and free of required external runtime assets', () => {
 const html = read(path.join(root, 'index.html'));
 const css = read(path.join(root, 'src/style.css'));
 const js = read(path.join(root, 'src/game.js'));
 assert.match(html, /<canvas\s+id="canvas"/);
 assert.equal((html.match(/<canvas\b/g)||[]).length, 1);
 assert.ok(html.includes('<style>' + css + '</style>'));
 assert.ok(html.includes('<script>' + js + '</script>'));
 assert.doesNotMatch(html, /<script[^>]+src=/);
 assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/);
 assert.doesNotMatch(html, /https?:\/\//);
});

test('bundled page matches the authoring HTML with inlined source files', () => {
 const authoring = read(path.join(root, 'src/index.html'));
 const css = read(path.join(root, 'src/style.css'));
 const js = read(path.join(root, 'src/game.js'));
 const expected = authoring.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>')
  .replace('<script src="./game.js"></script>','<script>'+js+'</script>');
 assert.equal(read(path.join(root, 'index.html')), expected);
});
