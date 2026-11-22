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
  await t.update('varieties', { id: v.id }, { status: 'Confirmed', form: 'Anemone' });
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

import { shopVerdict } from './canada';
import { pauseIfNotCanadian } from '../checker/canada-check';
test('Canada-only: shops that say they are elsewhere get paused', async () => {
  assert.equal(shopVerdict('CA', 'CAD'), 'canadian');
  assert.equal(shopVerdict('US', 'USD'), 'not');
  assert.equal(shopVerdict(null, 'USD'), 'not');
  assert.equal(shopVerdict(null, null), 'unknown');
  const t = db();
  const [farm] = await t.insert('farms', { code: 'F999', name: 'Ocean State Dahlias', place: 'Providence, RI', province: null, site: 'https://example-ri.com', platform: 'woocommerce', active: true });
  await t.insert('listings', { farm_id: farm.id, product_key: 'ri1', variety_id: null, title: 'Cafe au Lait', url: null, price_cents: 1200, in_stock: true, kind: 'tuber', active: true, first_seen: new Date().toISOString(), last_changed: new Date().toISOString() });
  const products = [{ key: 'ri1', title: 'Cafe au Lait', url: '', price_cents: 1200, currency: 'USD', in_stock: true, kind: 'tuber' as const }];
  assert.equal(await pauseIfNotCanadian(t, farm, 'woocommerce', products), true);
  assert.equal((await t.where('farms', { id: farm.id }))[0].active, false);
  assert.equal((await t.where('listings', { farm_id: farm.id }))[0].active, false);
  assert.equal((await t.where('review_items', { kind: 'feedback' })).filter((r) => r.data?.pausedFarm === farm.id).length, 1);
  const cad = [{ ...products[0], currency: 'CAD' }];
  assert.equal(await pauseIfNotCanadian(t, { ...farm, active: true }, 'woocommerce', cad), false);
});

import { blockFarms, applyFormSplits } from './name-ops';
test('blocked farms are hidden and decorative splits apply', async () => {
  const t = db();
  const [f] = await t.insert('farms', { code: 'F998', name: 'Petal and Stem Farm', place: null, province: null, site: 'https://ps.example', platform: 'shopify', active: true });
  await t.insert('listings', { farm_id: f.id, product_key: 'ps1', variety_id: null, title: 'Maarn', url: null, price_cents: 1000, in_stock: true, kind: 'tuber', active: true, first_seen: new Date().toISOString(), last_changed: new Date().toISOString() });
  assert.ok((await blockFarms(t, [{ name: 'Petal & Stem Farm' }])) >= 1);
  assert.equal((await t.where('farms', { id: f.id }))[0].active, false);
  assert.equal((await t.where('listings', { farm_id: f.id }))[0].active, false);
  const [v] = await t.insert('varieties', { slug: 'split-me', name: 'Split Me', form: 'Decorative', status: 'Confirmed' });
  const [w] = await t.insert('varieties', { slug: 'leave-me', name: 'Leave Me', form: 'Ball', status: 'Suggested' });
  assert.equal(await applyFormSplits(t, [{ slug: 'split-me', form: 'Formal decorative' }, { slug: 'leave-me', form: 'Informal decorative' }]), 1);
  assert.equal((await t.where('varieties', { id: v.id }))[0].form, 'Formal decorative');
  assert.equal((await t.where('varieties', { id: w.id }))[0].form, 'Ball');
});

import { NameBook as NB2 } from './name-ops';
import { groupAll as groupAll2, loadAll as loadAll2, suggestions as sugg2 } from './catalogue';
test('an unlinked "Bulk Cornel" joins Cornel instead of making a second Cornel', async () => {
  const t = db();
  const farm = (await t.all('farms')).find((f) => f.code === 'HS')!;
  await t.insert('listings', { farm_id: farm.id, product_key: 'bulk-cornel', variety_id: null, title: 'Bulk Cornel', url: null, price_cents: 6000, in_stock: true, kind: 'tuber', active: true, first_seen: new Date().toISOString(), last_changed: new Date().toISOString() });
  const count = async () => sugg2(await loadAll2(), groupAll2(await loadAll2())).filter((s) => s.kind === 'variety' && s.label === 'Cornel').length;
  assert.equal(await count(), 1); // shown once even before it's linked
  const book = await new NB2(t).load();
  await reconcileNames(t, book, new Set());
  const [l] = await t.where('listings', { product_key: 'bulk-cornel' });
  assert.ok(l.variety_id);
  assert.equal(await count(), 1);
});

import { syncFarmSources } from './name-ops';
test('a price-list farm switches to reading its shop', async () => {
  const t = db();
  const [f] = await t.insert('farms', { code: 'ZZ', name: 'Test Meadows', place: null, province: 'ON', site: 'https://tm.example', platform: 'manual', active: true });
  await t.insert('listings', { farm_id: f.id, product_key: 'manual-x', variety_id: null, title: 'X', url: null, price_cents: 800, in_stock: false, kind: 'tuber', active: true, first_seen: new Date().toISOString(), last_changed: new Date().toISOString() });
  assert.deepEqual(await syncFarmSources(t, [{ code: 'ZZ', platform: 'wix' }]), ['Test Meadows']);
  assert.equal((await t.where('farms', { id: f.id }))[0].platform, 'wix');
  assert.equal((await t.where('listings', { farm_id: f.id }))[0].active, false);
  assert.deepEqual(await syncFarmSources(t, [{ code: 'ZZ', platform: 'wix' }]), []);
});

test('a farm added to the list gets added to the database once', async () => {
  const t = db();
  const entry = { code: 'AR9', name: 'Test Rosa Florals', place: 'Squamish, BC', province: 'BC', site: 'https://shop.example', platform: 'shopify' };
  assert.deepEqual(await syncFarmSources(t, [entry]), ['Test Rosa Florals']);
  assert.equal((await t.where('farms', { code: 'AR9' })).length, 1);
  assert.deepEqual(await syncFarmSources(t, [entry]), []);
});

import { applyFormFixes } from './name-ops';
test('owner form fixes win once, by loose name', async () => {
  const t = db();
  const [v] = await t.insert('varieties', { slug: 'creme-de-cognac', name: 'Creme de Cognac', form: 'Ball', status: 'Confirmed' });
  assert.equal(await applyFormFixes(t, [{ name: 'Crème de Cognac', form: 'Informal decorative' }]), 1);
  assert.equal((await t.where('varieties', { id: v.id }))[0].form, 'Informal decorative');
  assert.equal((await t.where('varieties', { id: v.id }))[0].status, 'Confirmed');
  await t.update('varieties', { id: v.id }, { form: 'Peony' }); // changed later on the site
  assert.equal(await applyFormFixes(t, [{ name: 'Crème de Cognac', form: 'Informal decorative' }]), 0);
  assert.equal((await t.where('varieties', { id: v.id }))[0].form, 'Peony');
});

test('visitor suggestions: approve applies and confirms, undo restores, deny changes nothing', async () => {
  const t = db();
  const [v] = await t.insert('varieties', { slug: 'suggest-me', name: 'Suggest Me', colour1: 'Pink', colour2: null, form: 'Ball', status: 'Suggested' });
  const [s1] = await t.insert('review_items', { kind: 'suggestion', status: 'open', data: { variety: 'suggest-me', colour1: 'Orange', colour2: 'Bicolour', form: 'Formal decorative', note: 'Clearly orange' } });
  await answer(s1.id, { choice: 'yes' } as any);
  let [now] = await t.where('varieties', { id: v.id });
  assert.deepEqual([now.colour1, now.colour2, now.form, now.status], ['Bicolour', 'Orange', 'Formal decorative', 'Confirmed']);
  await undoAnswer(s1.id);
  [now] = await t.where('varieties', { id: v.id });
  assert.deepEqual([now.colour1, now.form, now.status], ['Pink', 'Ball', 'Suggested']);
  const [s2] = await t.insert('review_items', { kind: 'suggestion', status: 'open', data: { variety: 'suggest-me', colour1: 'Red', colour2: null, form: null, note: null } });
  await answer(s2.id, { choice: 'no' } as any);
  [now] = await t.where('varieties', { id: v.id });
  assert.equal(now.colour1, 'Pink');
});

import { search as search2, groupAll as groupAll3, loadAll as loadAll3 } from './catalogue';
test('search by look and close spellings', async () => {
  const g = groupAll3(await loadAll3());
  const orange = search2(g, { q: 'orange' });
  assert.equal(orange.how, 'look');
  assert.ok(orange.length > 0 && orange.every((x) => x.variety?.colour1 === 'Orange' || x.variety?.colour2 === 'Orange' || /orange/i.test(x.name)));
  const typo = search2(g, { q: 'cafe au liat' });
  assert.equal(typo.how, 'close');
  assert.equal(typo[0].name, 'Café au Lait');
  assert.equal(search2(g, { q: 'Cornel Bronze' }).length, 1);
});

import { mergeVarieties, markNotDahlias, renameVarieties, unmergeVarieties } from './name-ops';
test('merging a duplicate spelling moves listings, remembers the spelling, removes the old entry', async () => {
  const t = db();
  const [good] = await t.insert('varieties', { slug: 'karma-choc-x', name: 'Karma Choc X', form: null, status: 'Confirmed' });
  const [dupe] = await t.insert('varieties', { slug: 'karma-chocolate-x', name: 'Karma Chocolate X', form: 'Waterlily', status: 'Suggested' });
  const [l] = await t.insert('listings', { farm_id: 1, product_key: 'kcx', title: 'Karma Chocolate X', variety_id: dupe.id, active: true });
  assert.equal(await mergeVarieties(t, [{ from: 'Karma Chocolate X', into: 'Karma Choc X' }]), 1);
  assert.equal((await t.where('listings', { id: l.id }))[0].variety_id, good.id);
  assert.equal((await t.where('varieties', { id: dupe.id })).length, 0);
  assert.equal((await t.where('varieties', { id: good.id }))[0].form, 'Waterlily');
  assert.ok((await t.where('aliases', { variety_id: good.id })).length >= 1);
  assert.equal(await mergeVarieties(t, [{ from: 'Karma Chocolate X', into: 'Karma Choc X' }]), 0);
});

test('not-a-dahlia list and spelling fixes', async () => {
  const t = db();
  const [v] = await t.insert('varieties', { slug: 'stazon-ink-x', name: 'StazOn Ink X', status: 'Suggested' });
  assert.equal(await markNotDahlias(t, ['StazOn Ink X']), 1);
  assert.equal((await t.where('varieties', { id: v.id }))[0].status, 'Not a dahlia');
  const [w] = await t.insert('varieties', { slug: 'chimicum-x', name: 'Chimicum X', status: 'Suggested' });
  assert.equal(await renameVarieties(t, [{ from: 'Chimicum X', to: 'Chimacum X' }]), 1);
  assert.equal((await t.where('varieties', { id: w.id }))[0].name, 'Chimacum X');
});

test('merging two spellings that look alike loosely (Natalie/Nathalie)', async () => {
  const t = db();
  const [good] = await t.insert('varieties', { slug: 'sweet-nathalie-x', name: 'Sweet Nathalie X', status: 'Confirmed' });
  const [dupe] = await t.insert('varieties', { slug: 'sweet-natalie-x', name: 'Sweet Natalie X', status: 'Suggested' });
  assert.equal(await mergeVarieties(t, [{ from: 'Sweet Natalie X', into: 'Sweet Nathalie X' }]), 1);
  assert.equal((await t.where('varieties', { id: dupe.id })).length, 0);
  assert.equal((await t.where('varieties', { id: good.id })).length, 1);
});

test('KA varieties lead with the flower name; the KA spelling shows as also sold as, and still finds it', async () => {
  const t = db();
  const [v] = await t.insert('varieties', { slug: 'kas-cinder-rose-x', name: "KA's Cinder Rose X", status: 'Confirmed' });
  await t.insert('aliases', { alias: 'cinder rose x', variety_id: v.id, shown: 'Cinder Rose X' });
  const [f] = await t.insert('farms', { code: 'KAX', name: 'KA Test Farm', place: 'Here', province: 'BC', active: true });
  await t.insert('listings', { farm_id: f.id, product_key: 'kax1', title: "KA's Cinder Rose X", variety_id: v.id, active: true, kind: 'tuber', in_stock: true, first_seen: new Date().toISOString() });
  const groups = groupAll(await loadAll());
  const g = groups.find((x) => x.variety?.id === v.id)!;
  assert.equal(g.name, 'Cinder Rose X');
  assert.deepEqual(g.aka, ["KA's Cinder Rose X"]);
  assert.ok(search(groups, { q: "ka's cinder rose x" }).some((x) => x.variety?.id === v.id));
});

test('fill-only farms fill blanks and never replace', async () => {
  const t = db();
  const [f] = await t.insert('farms', { code: 'MMX', name: 'Fill Farm', active: true });
  const [a] = await t.insert('varieties', { slug: 'blank-one-x', name: 'Blank One X', status: 'Suggested', form: null, colour1: null, colour2: null });
  const [b] = await t.insert('varieties', { slug: 'set-one-x', name: 'Set One X', status: 'Suggested', form: 'Ball', colour1: 'Red', colour2: null });
  await t.insert('listings', { farm_id: f.id, product_key: 'a', title: 'Blank One X', variety_id: a.id, active: true });
  await t.insert('listings', { farm_id: f.id, product_key: 'b', title: 'Set One X', variety_id: b.id, active: true });
  const text = 'A lovely waterlily with bright pink petals.';
  await applyTrustedDetails(t, f as any, [{ key: 'a', title: 'Blank One X', hints: { tags: [], text } }, { key: 'b', title: 'Set One X', hints: { tags: [], text } }], ['form', 'colour1', 'colour2'], { onlyBlank: true });
  const A = (await t.where('varieties', { id: a.id }))[0], B = (await t.where('varieties', { id: b.id }))[0];
  assert.equal(A.form, 'Waterlily');
  assert.equal(A.colour1, 'Pink');
  assert.equal(B.form, 'Ball');
  assert.equal(B.colour1, 'Red');
  assert.equal(A.status, 'Suggested');
});

test('undoing a same-flower answer gives the other spelling its own page again', async () => {
  const t = db();
  const [m] = await t.insert('varieties', { slug: 'connie-marion-x', name: 'Connie Marion X', status: 'Confirmed' });
  await t.insert('aliases', { alias: 'connie marion x', variety_id: m.id, shown: null });
  await t.insert('aliases', { alias: 'connie marilyn x', variety_id: m.id, shown: 'Connie Marilyn X' });
  await t.insert('listings', { farm_id: 1, product_key: 'cm1', title: 'Connie Marion X', variety_id: m.id, active: true });
  const [l2] = await t.insert('listings', { farm_id: 1, product_key: 'cm2', title: 'Dahlia Connie Marilyn X', variety_id: m.id, active: true });
  assert.equal(await unmergeVarieties(t, [{ name: 'Connie Marilyn X', from: 'Connie Marion X' }]), 1);
  const own = (await t.all('varieties')).find((v) => v.name === 'Connie Marilyn X')!;
  assert.ok(own);
  assert.equal((await t.where('listings', { id: l2.id }))[0].variety_id, own.id);
  assert.equal((await t.where('aliases', { alias: 'connie marilyn x' }))[0].variety_id, own.id);
  assert.equal(await unmergeVarieties(t, [{ name: 'Connie Marilyn X', from: 'Connie Marion X' }]), 0);
});
