import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessDetails } from './guess';

test('guesses from tags first', () => {
  assert.deepEqual(guessDetails('X', { tags: ['Pink', 'Ball', 'Dahlia'], text: 'A lovely white flower' }), { colour1: 'Pink', colour2: null, form: 'Ball' });
});
test('guesses from description', () => {
  assert.deepEqual(guessDetails('X', { tags: [], text: 'Informal decorative with apricot petals fading to cream.' }), { colour1: 'Peach', colour2: 'Cream', form: 'Informal decorative' });
  assert.deepEqual(guessDetails('X', { tags: [], text: 'Beautiful soft pink waterlily.' }), { colour1: 'Blush', colour2: null, form: 'Waterlily' });
  assert.deepEqual(guessDetails('X', { tags: [], text: '' }), { colour1: null, colour2: null, form: null });
});

test('formal and informal decoratives are told apart (short forms too)', () => {
  const form = (tags: string[], text = '') => guessDetails('x', { tags, text }).form;
  assert.equal(form(['Informal Decorative']), 'Informal decorative');
  assert.equal(form(['Form: FD']), 'Formal decorative');
  assert.equal(form(['Dinnerplate']), 'Decorative');
  assert.equal(form([], 'Decorative (informal), blush'), 'Informal decorative');
  assert.equal(form([], 'Formal dec. in soft peach'), 'Formal decorative');
  assert.equal(form([], 'This listing is for a single tuber. Informal decorative, coral.'), 'Informal decorative');
  assert.equal(form([], 'Single blooms in bright red'), 'Single');
  assert.equal(form([], 'idle hands'), null);
});
