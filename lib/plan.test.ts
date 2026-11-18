import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shoppingPlan } from './plan';

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
