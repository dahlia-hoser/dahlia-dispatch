import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractShipping } from './shipping';

test('reads shipping pages', () => {
  assert.deepEqual(
    extractShipping('We ship anywhere in Canada. Shipping is a flat rate of $18, free shipping on orders over $250. Dahlia tubers ship mid-April to May, weather permitting. Farm pickup is available.'),
    { ships_to: 'all', ship_cost: '$18 flat, free over $250', ship_window: 'Mid-April to May', pickup: 'Pickup available' }
  );
  assert.deepEqual(extractShipping('Sorry, no pickup. We only ship within BC.'), {});
  assert.equal(extractShipping('Tuber orders will be shipped in late April.').ship_window, 'Late April');
});
