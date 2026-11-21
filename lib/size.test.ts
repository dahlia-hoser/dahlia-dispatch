import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDinnerplate } from './size';

test('dinnerplate is spotted by word or bloom size', () => {
  assert.equal(isDinnerplate('Café au Lait Dinnerplate Dahlia'), true);
  assert.equal(isDinnerplate('Bloom Size: 8-10"'), true);
  assert.equal(isDinnerplate('Giant blooms up to 10 inches'), true);
  assert.equal(isDinnerplate('Bloom size: 4" · Plant height: 4\''), false);
  assert.equal(isDinnerplate('Small informal decorative'), false);
});
