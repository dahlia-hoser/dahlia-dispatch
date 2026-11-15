import { test } from 'node:test';
import assert from 'node:assert/strict';
import { introYear, isNewIntro, isCanadianBred, seasonYear } from './badges';

const nov2026 = Date.parse('2026-11-15T12:00:00Z');
test('season', () => assert.equal(seasonYear(nov2026), 2027));
test('intro years', () => {
  assert.equal(introYear("KA's Honeycomb - Cutting (2025 Release)", nov2026), 2025);
  assert.equal(introYear('New for 2027! A stunning ball.', nov2026), 2027);
  assert.equal(introYear('A 2026 introduction from Bloomquist.', nov2026), 2026);
  assert.equal(introYear('New introduction this year', nov2026), 2027);
  assert.equal(introYear('Introduced in 1998, a classic.', nov2026), 1998);
  assert.equal(introYear('Ships in April 2027.', nov2026), null);
  assert.equal(introYear('Nouveautés 2026', nov2026), 2026);
  assert.ok(isNewIntro(2026, nov2026));
  assert.ok(!isNewIntro(2024, nov2026));
});
test('Canadian-bred', () => {
  assert.ok(isCanadianBred('Ferncliff Copper', null));
  assert.ok(isCanadianBred('Ben Huston', null));
  assert.ok(isCanadianBred('Meadows Biddy-Bee', null));
  assert.ok(isCanadianBred("Viva's Pixie Dust", null));
  assert.ok(!isCanadianBred('Kenora Lisa', null));
  assert.ok(!isCanadianBred('Salish Twilight Girl', null));
  assert.ok(isCanadianBred('Kenora Lisa', true));
  assert.ok(!isCanadianBred('Ferncliff Copper', false));
});
