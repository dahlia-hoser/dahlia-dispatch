import { test } from 'node:test';
import assert from 'node:assert/strict';
import { icsFor, googleCalendarLink, canAddToCalendar } from './ics';

test('calendar entries for a sale', () => {
  const s = { id: 7, farm_id: 1, label: 'Preorder', starts_at: '2026-11-29T14:00:00Z', when_text: null, time_text: null, url: 'https://twyla.example', note: null } as any;
  const f = { name: "Twyla's Flower Farm", site: 'https://twyla.example' } as any;
  const ics = icsFor(s, f);
  assert.match(ics, /DTSTART:20261129T140000Z/);
  assert.match(ics, /SUMMARY:Twyla's Flower Farm: Preorder opens/);
  assert.match(ics, /TRIGGER:-PT15M/);
  assert.match(googleCalendarLink(s, f), /dates=20261129T140000Z%2F20261129T150000Z/);
  assert.equal(canAddToCalendar(s, Date.parse('2026-11-21T00:00:00Z')), true);
  assert.equal(canAddToCalendar({ ...s, starts_at: null }), false);
});
