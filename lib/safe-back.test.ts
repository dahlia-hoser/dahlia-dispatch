import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeBack } from './safe-back';

test('only owner pages can be a back address', () => {
  assert.equal(safeBack('/admin/colours'), '/admin/colours');
  assert.equal(safeBack('/admin/check?colour=Bicolour'), '/admin/check?colour=Bicolour');
  assert.equal(safeBack('/admin/check?colour=Bicolour&saved=Maarn'), '/admin/check?colour=Bicolour');
  assert.equal(safeBack('https://evil.example'), null);
  assert.equal(safeBack('//evil.example/admin'), null);
  assert.equal(safeBack('/v/cornel'), null);
});
