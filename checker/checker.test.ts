import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShopify, parseWoo } from './sources';
import { whyDue } from './schedule';
import { save, weeklyHousekeeping } from './save';
import { db } from '../lib/db';
import { NameBook } from '../lib/name-ops';

const shopify = [
  { id: 1, title: "Dahlia 'Maarn' Tuber", handle: 'maarn', product_type: 'Dahlia Tubers', tags: ['dahlia'], variants: [{ price: '10.00', available: false }] },
  { id: 2, title: 'Caitlyn’s Joy', handle: 'caitlyns-joy', product_type: 'Dahlia Tubers', tags: [], variants: [{ price: '12.00', available: true }, { price: '9.00', available: false }] },
  { id: 3, title: 'Gift Card', handle: 'gift-card', product_type: 'Gift Card', tags: [], variants: [{ price: '25.00', available: true }] },
  { id: 4, title: 'Brand New Seedling', handle: 'seedling', product_type: 'Dahlia Tubers', tags: [], variants: [{ price: '30.00', available: true }] },
  { id: 5, title: 'Alloway Candy - Rooted Cutting', handle: 'ac-cut', product_type: 'Dahlia Cuttings', tags: [], variants: [{ price: '8.00', available: true }] },
];

test('reads a Shopify product list', () => {
  const { items } = parseShopify(shopify, 'https://farm.ca/', null);
  assert.equal(items.length, 4);
  const maarn = items.find((i) => i.key === '1')!;
  assert.equal(maarn.url, 'https://farm.ca/products/maarn');
  assert.equal(maarn.price_cents, 1000);
  assert.equal(maarn.in_stock, false);
  const cj = items.find((i) => i.key === '2')!;
  assert.equal(cj.price_cents, 900);
  assert.equal(cj.in_stock, true);
  assert.equal(items.find((i) => i.key === '5')!.kind, 'cutting');
});

test('Shopify farm that never says "dahlia" keeps its products', () => {
  const { items } = parseShopify([{ id: 9, title: 'Isabel', handle: 'isabel', product_type: '', tags: [], variants: [{ price: '10', available: true }] }], 'https://x.ca', null);
  assert.equal(items.length, 1);
});

test('reads a WooCommerce product list', () => {
  const items = parseWoo([
    { id: 11, name: 'Cornel Bronze', permalink: 'https://pf.ca/p/cb', prices: { price: '1000', currency_code: 'CAD', currency_minor_unit: 2 }, is_in_stock: true, is_purchasable: true, categories: [{ name: 'Tubercules', slug: 'tubercules' }] },
    { id: 12, name: 'Senior&#8217;s Hope', permalink: 'https://pf.ca/p/sh', prices: { price: '1500', currency_code: 'CAD', currency_minor_unit: 2 }, is_in_stock: false, categories: [{ name: 'Dahlias', slug: 'dahlias' }] },
    { id: 13, name: 'Tote bag', permalink: 'https://pf.ca/p/t', prices: { price: '2000', currency_code: 'CAD', currency_minor_unit: 2 }, is_in_stock: true, categories: [{ name: 'Boutique', slug: 'boutique' }] },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].price_cents, 1000);
  assert.equal(items[1].title, 'Senior’s Hope');
  assert.equal(items[1].in_stock, false);
});

test('schedule', () => {
  const nov = Date.parse('2026-11-29T13:50:00Z');
  const farm = { id: 1, platform: 'shopify', site: 'x', active: true, last_checked_at: '2026-11-29T13:40:00Z' };
  const sales = [{ farm_id: 1, starts_at: '2026-11-29T14:00:00Z' }];
  assert.equal(whyDue(farm, sales, nov), 'sale day');
  assert.equal(whyDue(farm, [], nov), null);
  assert.equal(whyDue({ ...farm, last_checked_at: '2026-11-29T12:40:00Z' }, [], nov), 'hourly');
  const july = Date.parse('2026-07-10T12:00:00Z');
  assert.equal(whyDue({ ...farm, last_checked_at: '2026-07-10T02:00:00Z' }, [], july), null);
  assert.equal(whyDue({ ...farm, last_checked_at: '2026-07-09T02:00:00Z' }, [], july), 'daily');
  assert.equal(whyDue({ ...farm, platform: 'manual' }, [], nov, true), null);
});

test('saving listings: match, new variety, question, restock, removal', async () => {
  const t = db();
  const farm = (await t.all('farms')).find((f) => f.code === 'SV')!;
  const book = await new NameBook(t).load();
  const reviewBefore = (await t.all('review_items')).length;
  const { items } = parseShopify(shopify, farm.site, null);

  const n1 = await save(t, book, farm, items);
  assert.equal(n1, 4);
  const mine = await t.where('listings', { farm_id: farm.id });
  const varieties = await t.all('varieties');
  const slugOf = (id: number | null) => varieties.find((v) => v.id === id)?.slug ?? null;
  assert.equal(slugOf(mine.find((l) => l.product_key === '1')!.variety_id), 'maarn');
  assert.equal(slugOf(mine.find((l) => l.product_key === '2')!.variety_id), null, 'Caitlyn’s Joy waits for review');
  assert.equal(slugOf(mine.find((l) => l.product_key === '4')!.variety_id), 'brand-new-seedling', 'new variety gets a page');
  assert.equal(slugOf(mine.find((l) => l.product_key === '5')!.variety_id), 'alloway-candy');
  const reviewAfter = await t.all('review_items');
  assert.equal(reviewAfter.length, reviewBefore + 2);

  // Restock of Maarn, Brand New Seedling removed from the shop.
  const next = items.filter((i) => i.key !== '4').map((i) => (i.key === '1' ? { ...i, in_stock: true } : i));
  const n2 = await save(t, book, farm, next);
  assert.equal(n2, 2);
  const after = await t.where('listings', { farm_id: farm.id });
  assert.equal(after.find((l) => l.product_key === '1')!.in_stock, true);
  assert.equal(after.find((l) => l.product_key === '4')!.active, false);

  // Empty response from the shop is treated as a hiccup.
  assert.equal(await save(t, book, farm, []), 0);
});

test('weekly farm suggestions', async () => {
  const t = db();
  await weeklyHousekeeping(t, Date.now() + 8 * 86400000);
  const suggested = (await t.all('farm_candidates')).filter((c) => c.status === 'suggested');
  assert.equal(suggested.length, 6);
});

import { pickDahliaCollections } from './sources';
test('finds a farm’s dahlia collections', () => {
  assert.deepEqual(
    pickDahliaCollections([
      { handle: 'tubercules', title: 'Tous les tubercules' },
      { handle: 'nouveautes-2026', title: 'Nouveautés 2026' },
      { handle: 'tulip-bulbs', title: 'Tulip Bulbs' },
      { handle: 'dahlia-cuttings-collection', title: 'Dahlia Cuttings' },
      { handle: 'frontpage', title: 'Home page' },
    ]),
    ['tubercules', 'dahlia-cuttings-collection']
  );
});
