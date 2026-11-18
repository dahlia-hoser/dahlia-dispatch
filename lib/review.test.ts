import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from './db';
import { reviewCards, answer, undoAnswer } from './review';
import { loadAll, groupAll, search } from './catalogue';

test('review list: name yes/no, details, farm, undo', async () => {
  const t = db();
  const cards = await reviewCards();
  assert.equal(cards[0].kind, 'farm');
  const kinds = new Set(cards.map((c) => c.kind));
  assert.deepEqual([...kinds].sort(), ['details', 'farm', 'name']);

  // A listing waiting on "Bloomquist Allen"
  const lw = (await t.all('farms')).find((f) => f.code === 'LW')!;
  const [l] = await t.insert('listings', { farm_id: lw.id, product_key: 'x1', variety_id: null, title: 'Bloomquist Allen', url: null, price_cents: 2000, in_stock: true, kind: 'tuber', active: true, first_seen: new Date().toISOString(), last_changed: new Date().toISOString() });
  const nameCard = cards.find((c) => c.kind === 'name' && c.spelling === 'Bloomquist Allen')!;
  await answer(nameCard.id, { choice: 'yes' });
  const alan = (await t.where('varieties', { slug: 'bloomquist-alan' }))[0];
  assert.equal((await t.where('listings', { id: l.id }))[0].variety_id, alan.id);
  const g = search(groupAll(await loadAll()), { q: 'allen' });
  assert.equal(g[0].name, 'Bloomquist Alan');
  await undoAnswer(nameCard.id);
  assert.equal((await t.where('listings', { id: l.id }))[0].variety_id, null);
  assert.equal((await t.where('aliases', { alias: 'bloomquist allen' })).length, 0);

  // Now say "different flower"
  await answer(nameCard.id, { choice: 'no' });
  const sep = (await t.where('varieties', { slug: 'bloomquist-allen' }))[0];
  assert.ok(sep);
  assert.equal((await t.where('listings', { id: l.id }))[0].variety_id, sep.id);
  await undoAnswer(nameCard.id);
  assert.equal((await t.where('varieties', { slug: 'bloomquist-allen' })).length, 0);

  // Colour and form
  const d = cards.find((c) => c.kind === 'details') as Extract<(typeof cards)[number], { kind: 'details' }>;
  assert.ok(d, 'a colour question is on the list');
  await answer(d.id, { choice: 'save', colour1: 'Pink', colour2: 'Peach', form: 'Decorative' });
  let v = (await t.where('varieties', { slug: d.slug }))[0];
  assert.equal(v.colour2, 'Peach');
  assert.equal(v.status, 'Confirmed');
  await undoAnswer(d.id);
  v = (await t.where('varieties', { slug: d.slug }))[0];
  assert.equal(v.colour2, d.colour2);

  // Farm yes
  const f = cards.find((c) => c.kind === 'farm')!;
  const before = (await t.all('farms')).length;
  await answer(f.id, { choice: 'yes', site: 'blossomhill.ca' });
  const farms = await t.all('farms');
  assert.equal(farms.length, before + 1);
  assert.equal(farms.at(-1)!.site, 'https://blossomhill.ca');
  await undoAnswer(f.id);
  assert.equal((await t.all('farms')).length, before);

  // Later
  await answer(f.id, { choice: 'later' });
  assert.ok(!(await reviewCards()).some((c) => c.id === f.id));
});

import { hideNonDahlias } from './name-ops';
test('things that are not dahlias get hidden with their questions', async () => {
  const t = db();
  const ff = (await t.all('farms')).find((f) => f.code === 'FF')!;
  const [v] = await t.insert('varieties', { slug: 'agrostemma-corn-cockle', name: 'Agrostemma (Corn Cockle)', status: 'Suggested' });
  await t.insert('listings', { farm_id: ff.id, product_key: 'ag', variety_id: v.id, title: 'Agrostemma (Corn Cockle)', url: null, price_cents: 500, in_stock: true, kind: 'tuber', active: true, first_seen: new Date().toISOString(), last_changed: new Date().toISOString() });
  const [q] = await t.insert('review_items', { kind: 'details', status: 'open', data: { variety: v.slug } });
  assert.equal(await hideNonDahlias(t), 1);
  assert.equal((await t.where('varieties', { id: v.id }))[0].status, 'Not a dahlia');
  assert.equal((await t.where('review_items', { id: q.id }))[0].status, 'done');
  const groups = groupAll(await loadAll());
  assert.ok(!groups.some((g) => g.name.startsWith('Agrostemma')));
});

import { NameBook, reconcileNames } from './name-ops';
test('listings saved under a wrong name move to the right variety', async () => {
  const t = db();
  const tw = (await t.all('farms')).find((f) => f.code === 'TW')!;
  const [bad] = await t.insert('varieties', { slug: 'potted', name: 'Potted', status: 'Suggested' });
  await t.insert('aliases', { alias: 'potted', variety_id: bad.id, shown: null });
  await t.insert('review_items', { kind: 'details', status: 'open', data: { variety: 'potted', isNew: true } });
  const [l] = await t.insert('listings', { farm_id: tw.id, product_key: 'pot1', variety_id: bad.id, title: 'Dahlia - Potted - Labyrinth', url: null, price_cents: 2500, in_stock: true, kind: 'plant', active: true, first_seen: new Date().toISOString(), last_changed: new Date().toISOString() });
  const book = await new NameBook(t).load();
  const r = await reconcileNames(t, book, new Set(['labyrinth']));
  assert.ok(r.moved >= 1);
  const lab = (await t.where('varieties', { slug: 'labyrinth' }))[0];
  assert.equal((await t.where('listings', { id: l.id }))[0].variety_id, lab.id);
  assert.equal((await t.where('varieties', { slug: 'potted' })).length, 0);
  assert.ok(!(await t.where('review_items', { kind: 'details' })).some((x) => x.data?.variety === 'potted'));
});

import { applyTrustedDetails } from './name-ops';
test("a trusted farm's form label becomes the default", async () => {
  const t = db();
  const dg = (await t.all('farms')).find((f) => f.code === 'DG')!;
  const [v] = await t.insert('varieties', { slug: 'test-trust', name: 'Test Trust', form: 'Decorative', status: 'Suggested' });
  const [q] = await t.insert('review_items', { kind: 'details', status: 'open', data: { variety: 'test-trust', isNew: true } });
  await t.insert('listings', { farm_id: dg.id, product_key: 'tt1', variety_id: v.id, title: 'Test Trust Dahlia Tuber - TT', url: null, price_cents: 1000, in_stock: false, kind: 'tuber', active: true, first_seen: new Date().toISOString(), last_changed: new Date().toISOString() });
  const n = await applyTrustedDetails(t, dg as any, [{ key: 'tt1', title: 'Test Trust', hints: { tags: ['Ball'], text: '' } }], ['form']);
  assert.equal(n, 1);
  assert.equal((await t.where('varieties', { id: v.id }))[0].form, 'Ball');
  assert.equal((await t.where('review_items', { id: q.id }))[0].data.formFrom, 'Deva’s Gardens');
  await t.update('varieties', { id: v.id }, { status: 'Confirmed', form: 'Single' });
  assert.equal(await applyTrustedDetails(t, dg as any, [{ key: 'tt1', title: 'Test Trust', hints: { tags: ['Ball'], text: '' } }], ['form']), 0);
  // Confirmed plain Decorative gets narrowed, even when the label is far down the description.
  await t.update('varieties', { id: v.id }, { form: 'Decorative' });
  const long = 'Grown on our farm in Ontario. '.repeat(20) + 'Form: Informal Decorative.';
  assert.equal(await applyTrustedDetails(t, dg as any, [{ key: 'tt1', title: 'Test Trust', hints: { tags: [], text: long } }], ['form']), 1);
  assert.equal((await t.where('varieties', { id: v.id }))[0].form, 'Informal decorative');
  assert.equal((await t.where('varieties', { id: v.id }))[0].status, 'Confirmed');
});

import { buildAdsMap, applyAds } from '../checker/ads-import';
test('ADS lists fill and confirm', async () => {
  const t = db();
  const [v] = await t.insert('varieties', { slug: 'valley-rust-bucket', name: 'Valley Rust Bucket', status: 'Suggested', colour1: 'Red' });
  await t.insert('aliases', { alias: 'valley rust bucket', variety_id: v.id, shown: null });
  const [q] = await t.insert('review_items', { kind: 'details', status: 'open', data: { variety: 'valley-rust-bucket' } });
  const map = buildAdsMap([
    { name: 'VALLEY RUST BUCKET', code: '6111', form: 'Ball', colours: ['Orange'], canadian: false },
    { name: "CAITLIN'S JOY", code: '6113', form: 'Ball', colours: [], canadian: false },
  ]);
  const r = await applyAds(map, new Set(['caitlins-joy']));
  assert.ok(r.confirmed >= 1);
  const after = (await t.where('varieties', { id: v.id }))[0];
  assert.equal(after.colour1, 'Orange');
  assert.equal(after.form, 'Ball');
  assert.equal(after.status, 'Confirmed');
  assert.equal((await t.where('review_items', { id: q.id }))[0].status, 'done');
  // Owner's own colours kept: Caitlin's Joy stays Pink, gets confirmed with its form.
  const cj = (await t.where('varieties', { slug: 'caitlins-joy' }))[0];
  assert.equal(cj.colour1, 'Pink');
});

import { confirmWhenFarmsAgree } from './name-ops';
test('two farms agreeing confirms a colour', async () => {
  const t = db();
  const farms = await t.all('farms');
  const [v] = await t.insert('varieties', { slug: 'agree-test', name: 'Agree Test', status: 'Suggested' });
  const [q] = await t.insert('review_items', { kind: 'details', status: 'open', data: { variety: 'agree-test' } });
  const now = new Date().toISOString();
  for (const [i, desc] of ['A lovely soft pink ball dahlia.', 'Soft pink blooms, ball form.'].entries())
    await t.insert('listings', { farm_id: farms[i].id, product_key: `ag${i}`, variety_id: v.id, title: 'Agree Test', description: desc, url: null, price_cents: 900, in_stock: false, kind: 'tuber', active: true, first_seen: now, last_changed: now });
  assert.equal(await confirmWhenFarmsAgree(t), 1);
  const after = (await t.where('varieties', { id: v.id }))[0];
  assert.equal(after.colour1, 'Blush');
  assert.equal(after.form, 'Ball');
  assert.equal(after.status, 'Confirmed');
  assert.equal((await t.where('review_items', { id: q.id }))[0].status, 'done');
});
