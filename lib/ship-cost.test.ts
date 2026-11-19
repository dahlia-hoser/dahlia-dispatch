import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShipCost, shippingFor } from './ship-cost';

test('shipping notes become numbers', () => {
  assert.deepEqual(parseShipCost('$18, free over $250'), { flatCents: 1800, freeOverCents: 25000 });
  assert.deepEqual(parseShipCost('Free shipping over $150; $15 flat rate'), { flatCents: 1500, freeOverCents: 15000 });
  assert.deepEqual(parseShipCost('Free shipping'), { flatCents: 0, freeOverCents: null });
  assert.deepEqual(parseShipCost(null), { flatCents: null, freeOverCents: null });
  assert.equal(shippingFor('$18, free over $250', 26000), 0);
  assert.equal(shippingFor('$18, free over $250', 4000), 1800);
});
