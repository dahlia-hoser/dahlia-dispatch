import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shoppingPlan, gamePlan } from './plan';

const farm = (id: number) => ({ id, code: 'F' + id, name: 'Farm ' + id } as any);
const row = (f: number, cents: number, avail = 'in') => ({ farm: farm(f), avail, label: '', isNew: false, listing: { id: f * 100 + cents, kind: 'tuber', price_cents: cents, title: 'x' } } as any);
const group = (slug: string, rows: any[]) => ({ key: slug, name: slug, aka: [], variety: { slug } as any, rows } as any);

test('fewest farms, then cheapest', () => {
  // Farm 1 has a,b,c. Farm 2 has c,d. Farm 3 has d only. Farm 4 has a,b,c,d but pricier.
  const groups = [
    group('a', [row(1, 1000), row(4, 1500)]),
    group('b', [row(1, 1000), row(4, 1500)]),
    group('c', [row(1, 1000), row(2, 800), row(4, 1500)]),
    group('d', [row(2, 900), row(3, 700), row(4, 1500)]),
    group('e', [row(2, 900, 'out')]), // not in stock: not part of the plan
  ];
  const plan = shoppingPlan(groups);
  assert.equal(plan.covered, 4);
  assert.equal(plan.stops.length, 1); // farm 4 has everything
  assert.equal(plan.stops[0].farm.id, 4);
});

test('two farms when no one farm has it all; each item bought where cheaper', () => {
  const groups = [
    group('a', [row(1, 1000)]),
    group('b', [row(2, 1200)]),
    group('c', [row(1, 1100), row(2, 900)]),
  ];
  const plan = shoppingPlan(groups);
  assert.deepEqual(plan.stops.map((s) => s.farm.id).sort(), [1, 2]);
  const at2 = plan.stops.find((s) => s.farm.id === 2)!;
  assert.deepEqual(at2.items.map((i) => i.slug).sort(), ['b', 'c']);
  assert.equal(at2.totalCents, 2100);
});

test('bulk lots and multi-packs are left out of the plan', () => {
  const r = (f: number, cents: number, title: string) => ({ ...row(f, cents), listing: { ...row(f, cents).listing, title } });
  const groups = [group('a', [r(1, 6000, 'Bulk Cornel')]), group('b', [r(2, 3000, 'Maarn (5 pack)'), r(3, 900, 'Maarn')])];
  const plan = shoppingPlan(groups);
  assert.equal(plan.covered, 1);
  assert.equal(plan.stops[0].farm.id, 3);
});

test('shipping counts: a cheaper plan with one more farm is offered', () => {
  const f = (id: number, ship: string) => ({ id, code: 'F' + id, name: 'Farm ' + id, ship_cost: ship } as any);
  const r = (farm: any, cents: number) => ({ farm, avail: 'in', label: '', isNew: false, listing: { id: farm.id * 1000 + cents, kind: 'tuber', price_cents: cents, title: 'x' } } as any);
  const big = f(1, '$60 flat'), a = f(2, 'Free shipping'), b = f(3, 'Free shipping');
  const groups = [group('a', [r(big, 1000), r(a, 1000)]), group('b', [r(big, 1000), r(b, 1000)])];
  const plan = shoppingPlan(groups);
  assert.equal(plan.stops.length, 1); // fewest farms: the big farm alone
  assert.equal(plan.totalCents, 2000 + 6000);
  assert.ok(plan.cheaper);
  assert.equal(plan.cheaper!.stops.length, 2);
  assert.equal(plan.cheaper!.savesCents, 6000);
});

test('close to free shipping gets a nudge', () => {
  const farm = { id: 9, code: 'F9', name: 'Farm 9', ship_cost: '$18, free over $100' } as any;
  const r = (cents: number) => ({ farm, avail: 'in', label: '', isNew: false, listing: { id: cents, kind: 'tuber', price_cents: cents, title: 'x' } } as any);
  const plan = shoppingPlan([group('a', [r(4000)]), group('b', [r(4000)])]);
  assert.equal(plan.stops[0].shippingCents, 1800);
  assert.equal(plan.stops[0].toFreeShippingCents, 2000);
});

test('game plan: sold-out favourites grouped by their next sale', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  const tw = { id: 1, code: 'TW', name: 'Twyla' } as any, lbb = { id: 2, code: 'LBB', name: 'Little Black Bird' } as any, x = { id: 3, code: 'X', name: 'No date' } as any;
  const r = (farm: any) => ({ farm, avail: 'out', label: '', isNew: false, listing: { id: farm.id, kind: 'tuber', price_cents: 1000, title: 'x' } } as any);
  const sales = [
    { id: 10, farm_id: 1, label: 'Preorder', starts_at: '2026-11-29T14:00:00Z', when_text: null, time_text: null, url: null, note: null },
    { id: 11, farm_id: 2, label: 'Tuber sale', starts_at: '2027-01-02T18:00:00Z', when_text: null, time_text: null, url: null, note: null },
  ] as any[];
  const groups = [group('a', [r(tw), r(lbb)]), group('b', [r(lbb)]), group('c', [r(tw)]), group('d', [r(x)])];
  const gp = gamePlan(groups, sales, now);
  assert.deepEqual(gp.stops.map((s) => [s.farm.code, s.names.map((n) => n.slug)]), [['TW', ['a', 'c']], ['LBB', ['b']]]);
  assert.deepEqual(gp.noDate.map((n) => n.slug), ['d']);
});
