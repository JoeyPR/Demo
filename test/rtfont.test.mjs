import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../js/rtfont.js', import.meta.url), 'utf8');
const window = { P: {} };
runInNewContext(source, { window });
const rtfont = window.P.rtfont;
const MARK = rtfont.marker;

test('RTFont numeric codes change color and strip formatting markers from visible text', () => {
  const parsed = rtfont.parse(MARK + '1' + 'icy' + MARK + '9' + 'sun');
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.map(({ text, code, rgb }) => ({ text, code, rgb })))),
    [
      { text: 'icy', code: '1', rgb: [173, 244, 255] },
      { text: 'sun', code: '9', rgb: [255, 238, 125] }
    ]);
  assert.equal(rtfont.strip(MARK + '1' + 'icy' + MARK + '9' + 'sun'), 'icysun');
});

test('RTFont supports the full player-usable color table from the supplied spec', () => {
  const expected = ['0','1','2','3','4','5','6','7','8','9','!','@','#','$','^','&','w','o','b','p','q','e','r','t','a','s','c'];
  assert.deepEqual([...Object.keys(rtfont.colors)], expected);
  assert.equal(Object.hasOwn(rtfont.colors, 'y'), false, 'the supplied spec marks y as not usable by players');
});

test('the convenience function accepts numeric and symbolic RTFont codes', () => {
  assert.equal(rtfont.color(2, 'Leaf'), MARK + '2Leaf');
  assert.equal(rtfont.color('$', 'Pale'), MARK + '$Pale');
  assert.equal(rtfont.color('y', 'Blocked'), 'Blocked');
});

test('visible length counts rendered characters, not color markers', () => {
  const input = MARK + '2' + 'Moss ' + MARK + '$' + 'Gold';
  assert.equal(rtfont.visibleLength(input), 9);
  assert.equal(rtfont.strip(rtfont.truncate(input, 7)), 'Moss Go');
  assert.equal(rtfont.visibleLength(rtfont.truncate(input, 7)), 7);
});

test('unknown backtick pairs are preserved as ordinary text', () => {
  const input = MARK + 'z' + 'plain';
  assert.equal(rtfont.strip(input), input);
  assert.equal(rtfont.hasCodes(input), false);
});

test('the markup parser is connected to both the global app and canvas nameplate', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const plate = readFileSync(new URL('../js/plate.js', import.meta.url), 'utf8');
  const customization = readFileSync(new URL('../js/customization.js', import.meta.url), 'utf8');
  assert.match(html, /js\/rtfont\.js/);
  assert.match(source, /root\.MutationObserver/);
  assert.match(plate, /P\.rtfont\.characters\(part\.formatText\)/);
  assert.match(plate, /formatText: rawName/);
  assert.match(customization, /growInput\.maxLength = 54/);
  assert.match(customization, /P\.rtfont\.truncate\(growInput\.value, 18\)/);
});
