import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessDetails } from './guess';

test('guesses from tags first', () => {
  assert.deepEqual(guessDetails('X', { tags: ['Pink', 'Ball', 'Dahlia'], text: 'A lovely white flower' }), { colour1: 'Pink', colour2: null, form: 'Ball' });
});
test('guesses from description', () => {
  assert.deepEqual(guessDetails('X', { tags: [], text: 'Informal decorative with apricot petals fading to cream.' }), { colour1: 'Peach', colour2: 'Cream', form: 'Decorative' });
  assert.deepEqual(guessDetails('X', { tags: [], text: 'Beautiful soft pink waterlily.' }), { colour1: 'Blush', colour2: null, form: 'Waterlily' });
  assert.deepEqual(guessDetails('X', { tags: [], text: '' }), { colour1: null, colour2: null, form: null });
});
