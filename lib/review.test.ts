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
  const d = cards.find((c) => c.kind === 'details' && c.slug === 'american-dawn')!;
  await answer(d.id, { choice: 'save', colour1: 'Pink', colour2: 'Peach', form: 'Decorative' });
  let v = (await t.where('varieties', { slug: 'american-dawn' }))[0];
  assert.equal(v.colour2, 'Peach');
  assert.equal(v.status, 'Confirmed');
  await undoAnswer(d.id);
  v = (await t.where('varieties', { slug: 'american-dawn' }))[0];
  assert.equal(v.colour2, null);

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
