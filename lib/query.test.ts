import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLook, closeTo } from './query';

test('searches by look', () => {
  assert.deepEqual(parseLook('pink ball'), { colours: ['Pink'], forms: ['Ball'], dinnerplate: false, canadian: false, rest: '' });
  assert.deepEqual(parseLook('orange').colours, ['Orange']);
  assert.equal(parseLook('Dinnerplate dahlias').dinnerplate, true);
  assert.deepEqual(parseLook('pale pink formal decorative').forms, ['Formal decorative']);
  assert.deepEqual(parseLook('pale pink formal decorative').colours, ['Blush']);
  assert.equal(parseLook('Cafe au Lait').rest, 'cafe au lait');
});

test('close spellings', () => {
  assert.equal(closeTo('labirynth', 'Labyrinth'), true);
  assert.equal(closeTo('cafe au liat', 'Café au Lait'), true);
  assert.equal(closeTo('cornell', 'Cornel'), true);
  assert.equal(closeTo('kelgai', 'Kelgai Ann'), true);
  assert.equal(closeTo('maarn', 'Cornel'), false);
  assert.equal(closeTo('red', 'Rose'), false);
});
