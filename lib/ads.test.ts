import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAdsLine } from './ads';

test('reads Cream of the Crop lines (older layout)', () => {
  assert.deepEqual(parseAdsLine("CLYDE'S CHOICE 0003 AA FD OR 16 SM- 89* US"), { name: "CLYDE'S CHOICE", code: '0003', form: 'Formal decorative', colours: ['Orange'], canadian: false });
  assert.deepEqual(parseAdsLine('VALLEY RUST BUCKET 6111 MB BR 31 STH- 04* US'), { name: 'VALLEY RUST BUCKET', code: '6111', form: 'Ball', colours: ['Orange'], canadian: false });
  assert.deepEqual(parseAdsLine('CLARA HUSTON 0403 AA IC OR 24 H- 95* C'), { name: 'CLARA HUSTON', code: '0403', form: 'Cactus', colours: ['Orange'], canadian: true });
  assert.equal(parseAdsLine("CAITLIN'S JOY 6113 MB DB 18 21*")!.colours.length, 0);
  assert.equal(parseAdsLine('STILLWATER RASPBERRY 8013 PE DB 33 BRU- 04 US')!.form, 'Peony');
  assert.equal(parseAdsLine('IRISH GLOW 6206 P R 138 BOL- 12 US')!.form, 'Pompon');
  assert.equal(parseAdsLine('FANCY PANTS 9408 OT L 75 J ILR- 12 US')!.form, 'Orchid');
  assert.equal(parseAdsLine('**FORMAL DECORATIVE**'), null);
  assert.equal(parseAdsLine('The total number of awards for 2022 was 17,688.'), null);
});

test('reads the 2025 layout (number first)', () => {
  assert.deepEqual(parseAdsLine('2104 · CAFE AU LAIT · B · ID · PK · 30 · B · 1968 · H'), { name: 'CAFE AU LAIT', code: '2104', form: 'Informal decorative', colours: ['Pink'], canadian: false });
  assert.deepEqual(parseAdsLine('6011 CORNEL BRONZE BA BR 84 STP 2004 H'), { name: 'CORNEL BRONZE', code: '6011', form: 'Ball', colours: ['Orange'], canadian: false });
  assert.equal(parseAdsLine('4010 · CLEARVIEW BUTTERSCOTCH M · FD · LB · 48 · CDH · PAH- · 2016 · US')!.name, 'CLEARVIEW BUTTERSCOTCH');
  assert.equal(parseAdsLine('6015 · RIVER\'S YELLOW SNOW · BA · BI · 27 · KYN- · 2026 · US')!.colours[0], 'Bicolour');
  assert.equal(parseAdsLine('3210 · CONNIE TRISHONNIE · BB · SC · LB · 16 · YDC- · 2021 · C')!.canadian, true);
  assert.equal(parseAdsLine('9704 · LO - CLARA · MS · PK · 76 · LOB- · 2020 · US')!.name, 'LO - CLARA');
});
