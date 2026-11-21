import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, varietyNameFromTitle, matchName, kindFromTitle, slugify, isBulk } from './names';

test('normalize strips accents, symbols, apostrophes', () => {
  assert.equal(normalize('Café au Lait'), 'cafe au lait');
  assert.equal(normalize('KA’s® Champagne'), 'kas champagne');
  assert.equal(normalize("Senior's Hope"), 'seniors hope');
  assert.equal(slugify('Apple Blossom (Double)'), 'apple-blossom-double');
});

test('variety name from farm titles', () => {
  assert.equal(varietyNameFromTitle("Dahlia 'Café au Lait' – Tuber"), 'Café au Lait');
  assert.equal(varietyNameFromTitle('Cornel Bronze Dahlia Tuber'), 'Cornel Bronze');
  assert.equal(varietyNameFromTitle('Alloway Candy - Rooted Cutting'), 'Alloway Candy');
  assert.equal(varietyNameFromTitle('Dahlia Maarn (Pre-order)'), 'Maarn');
  assert.equal(varietyNameFromTitle('Apple Blossom (Double)'), 'Apple Blossom (Double)');
  assert.equal(varietyNameFromTitle('Tubercule de dahlia Isabel'), 'Isabel');
});

test('kinds', () => {
  assert.equal(kindFromTitle('Alloway Candy - Rooted Cutting'), 'cutting');
  assert.equal(kindFromTitle('Gift Card'), 'other');
  assert.equal(kindFromTitle('Heirloom Mum Cutting'), 'other');
  assert.equal(kindFromTitle('Maarn'), 'tuber');
});

test('matching', () => {
  const a = new Map<string, number>([
    ['maarn', 1], ['sylvia', 1], ['cornel', 2], ['cornel bronze', 3], ['apple blossom', 4], ['caitlins joy', 5], ['bloomquist alan', 6],
  ]);
  assert.deepEqual(matchName('MAARN', a), { kind: 'exact', varietyId: 1 });
  assert.deepEqual(matchName('Appleblossom', a), { kind: 'exact', varietyId: 4 });
  assert.deepEqual(matchName('Caitlyn’s Joy', a), { kind: 'close', varietyId: 5, alias: 'caitlins joy' });
  assert.deepEqual(matchName('Bloomquist Allen', a), { kind: 'close', varietyId: 6, alias: 'bloomquist alan' });
  assert.equal(matchName('Cornel Red', a).kind, 'close');
  assert.equal(matchName('Brown Sugar', a).kind, 'new');
  assert.equal(matchName('Isabel', a).kind, 'new');
});

test('real farm titles from the first run', () => {
  const cases: [string, string][] = [
    ['Dahlia - Alloway Candy', 'Alloway Candy'],
    ['Salmon Runner Dahlia Tuber - *Not Sold Out* SALE COMING IN MARCH OF 2027', 'Salmon Runner'],
    ["Linda's Baby Dahlia Tuber -  *Not Sold Out* SALE COMING IN MARCH OF 2027", "Linda's Baby"],
    ["Peaches N' Cream Dahlia Tuber - *Not Sold Out* SALE COMING IN MARCH OF 2027", "Peaches N' Cream"],
    ['Black Magic - BLMG (5 Pack)', 'Black Magic'],
    ['AC Dark Horse - ACDH', 'AC Dark Horse'],
    ['CB Tanya - CBTN (', 'CB Tanya'],
    ['Apple Blossom - LIMIT ONE', 'Apple Blossom'],
    ['Bishop of Oxford Dhalia - BOX', 'Bishop of Oxford'],
    ['Svartnäsets® Nougat Dahlia Tuber', 'Svartnäsets Nougat'],
    ['Orange Globe Dahlia Tube', 'Orange Globe'],
    ['Dahlia BJ\'s Dusty Rose', "BJ's Dusty Rose"],
    ['L.A.T.E Dahlia Tuber - *Not Sold Out* SALE COMING IN MARCH OF 2027', 'L.A.T.E'],
    ['20th Ave & Baker Rd.', '20th Ave & Baker Rd.'],
  ];
  for (const [t, want] of cases) assert.equal(varietyNameFromTitle(t), want, t);
});

test('not dahlias', () => {
  for (const t of ['10 Tulip Bulbs- Verona Sunrise', '10 Corms - Ranunculus Amadine White', 'Floral snips', 'Floral Snip Holster', 'Vinyl Dahlia Tags', 'Terra Flora Soilworks x Five Acres Premium Vermicompost (1L bag)', 'Terra Flora Organics BioBloom 1-9-5 Bloom Fertilizer (1kg bag)', '"Support Your Local Farmer" Dahlia May Zip Up Hoodie in Cream', ])
    assert.equal(kindFromTitle(t), 'other', t);
  for (const t of ['Black Magic - BLMG (5 Pack)', 'Boom Boom White - BOOM', 'Dahlia Creamy', 'Bloomquist Compare - Limit One'])
    assert.notEqual(kindFromTitle(t), 'other', t);
});

test('avenue = ave', () => {
  const a = new Map<string, number>([['20th avenue softer peach', 7]]);
  assert.deepEqual(matchName('20th Ave Softer Peach', a), { kind: 'exact', varietyId: 7 });
});

test('second batch of real titles', () => {
  assert.equal(kindFromTitle('Dahlia - Valley Rust Bucket'), 'tuber');
  assert.equal(kindFromTitle('Zundert Mystery Fox Tuber'), 'tuber');
  assert.equal(kindFromTitle('Dahlia Mystery Tuber 3 Pack'), 'mix');
  assert.equal(kindFromTitle('Tulipe ‘Brisbane’'), 'other');
  assert.equal(varietyNameFromTitle('Café Au Lait, Limit 1'), 'Café Au Lait');
  assert.equal(varietyNameFromTitle('Sylvia / Maarn'), 'Sylvia');
  assert.equal(varietyNameFromTitle('Cafe Au Lait Mini (aka Jolene)'), 'Cafe Au Lait Mini');
  assert.equal(varietyNameFromTitle('Bracken Rose (US)'), 'Bracken Rose');
  assert.equal(varietyNameFromTitle('Café Au Lait (Rose)'), 'Café Au Lait (Rose)');
});

test('third batch', () => {
  assert.equal(varietyNameFromTitle('Dahlia ‘Petra’s Wedding’'), 'Petra’s Wedding');
  assert.equal(varietyNameFromTitle("Lark's Ebbe Dahila"), "Lark's Ebbe");
  assert.equal(varietyNameFromTitle('Quiet Splendour ￼'), 'Quiet Splendour');
  assert.equal(kindFromTitle('All White Dahlia Kit'), 'mix');
  assert.equal(varietyNameFromTitle('Dahlia ‘Platinum Blonde’'), 'Platinum Blonde');
});

import { sameEnough } from './names';
test('small spelling slips merge on their own, real differences still ask', () => {
  for (const [a, b] of [['Golden Sceptre', 'Golden Scepter'], ['Sweet Sane', 'Sweet Sanne'], ['Camano Buz', 'Camano Buzz'], ['Clearview Debby', 'Clearview Debbie'], ["Gabbie's Wish", "Gabby's Wish"], ['Quiet Splendour', 'Quiet Splendor'], ['KA Champagne', 'KA’s Champagne'], ['Pineland Princess', 'Pinelands Princess'], ['Natalie G', 'Nathalie G'], ['20th Ave Softer Peach', '20th Avenue Softer Peach']])
    assert.ok(sameEnough(a, b), `${a} = ${b}`);
  for (const [a, b] of [['Bloomquist Crave', 'Bloomquist Dave'], ['Van Isle Bold', 'Van Isle Blood'], ['Cafe au Lait Rose', 'Cafe au Lait'], ['Cornel', 'Cornel Bronze'], ['Bloomquist Jean', 'Bloomquist Alan'], ['Rose Toscano', 'Rose Toscana'], ['Boom Boom White', 'Boom Boom Yellow'], ['Sandia Molly', 'Sandia Holly']])
    assert.ok(!sameEnough(a, b), `${a} != ${b}`);
});

test('other flowers and farm extras are not dahlias', () => {
  for (const t of ['Agrostemma (Corn Cockle)', 'Breadseed Poppy', 'Cosmos', 'Delphinium', 'Earl Grey Gladiolus', 'Larkspur', 'Orlaya White Finch', 'Zinnia', 'Bunny Tails', 'Chinese Forget-Me-Not', 'Chocolate Lace Flower', 'Clarkia', 'Lavatera', 'Mignonette', "Queen Anne's Lace", 'Soapwort', 'Pivoine ‘Coral Charm’', 'Anemone ‘Mauve’', 'A Full Season of Hard Scrabble - 2027', 'Blooms & Brews: August Edition (London)', 'Holiday Centerpieces Preorder'])
    assert.equal(kindFromTitle(t), 'other', t);
  for (const t of ['Lupin Chris Tuber', 'Lavender Perfection', 'Skipley Spot of Gold', 'Irish Gnome Tuber', 'Jabberbox', 'Verkist Cosmic', 'Bees’ Choice Anemone'])
    assert.notEqual(kindFromTitle(t), 'other', t);
  assert.equal(varietyNameFromTitle('Dahli Ferncliff Thunder'), 'Ferncliff Thunder');
});

test('potted plants', () => {
  assert.equal(varietyNameFromTitle('Dahlia - Potted - Café au Lait'), 'Café au Lait');
  assert.equal(varietyNameFromTitle('Potted Dahlia - Bishop of Llandaff'), 'Bishop of Llandaff');
  assert.equal(varietyNameFromTitle('Café au Lait - Potted Plant'), 'Café au Lait');
  assert.equal(varietyNameFromTitle('Labyrinth - 1 Gallon Pot'), 'Labyrinth');
  assert.equal(kindFromTitle('Dahlia - Potted - Café au Lait'), 'plant');
  assert.equal(kindFromTitle('Café au Lait'), 'tuber');
});

import { packSize } from './names';
test('multi-packs', () => {
  assert.equal(packSize('Black Magic - BLMG (5 Pack)'), 5);
  assert.equal(packSize('Café au Lait 3-pack'), 3);
  assert.equal(packSize('Labyrinth - Pack of 3'), 3);
  assert.equal(packSize('Maarn x3'), 3);
  assert.equal(packSize('Jowey Winnie - 3 tubers'), 3);
  assert.equal(packSize('Ten-pack Thomas Edison'), 10);
  assert.equal(packSize('Maarn'), 1);
  assert.equal(packSize('20th Ave & Baker Rd.'), 1);
  assert.equal(packSize('Single tuber'), 1);
});

test('pack words leave the name', () => {
  assert.equal(varietyNameFromTitle('Café au Lait 3-pack'), 'Café au Lait');
  assert.equal(varietyNameFromTitle('Maarn x3'), 'Maarn');
  assert.equal(varietyNameFromTitle('Labyrinth - Pack of 3'), 'Labyrinth');
  assert.equal(varietyNameFromTitle('Ten-pack Thomas Edison'), 'Thomas Edison');
  assert.equal(varietyNameFromTitle('Jowey Winnie - 3 tubers'), 'Jowey Winnie');
});

import { isRoulette } from './names';
test('mixed and mystery packs', () => {
  for (const t of ['5-pack MYSTERY GRAB BAG', '10 PACK mix', 'A Value Pack (Named) - 10', 'Bulk DIY Bucket of : Custom Colour Palette', 'Burgundy/White Noid', '5 PACK mix (Autumn Colors)', 'Five Acres Collection - five pack of tubers', 'Ensemble de dahlias mystères', 'Pastel Dahlia Bundle'])
    assert.equal(kindFromTitle(t), 'mix', t);
  for (const t of ['Zundert Mystery Fox Tuber', 'Mystery Day', 'Mystique', 'Sweet Surprise', 'Maarn'])
    assert.notEqual(kindFromTitle(t), 'mix', t);
  assert.ok(isRoulette('5-pack MYSTERY GRAB BAG'));
  assert.ok(isRoulette('Burgundy/White Noid'));
  assert.ok(!isRoulette('5 PACK mix (Autumn Colors)'));
});

test('bulk packs of one variety are tubers, not mixes', () => {
  assert.equal(varietyNameFromTitle('Bulk Nicholas'), 'Nicholas');
  assert.equal(kindFromTitle('Bulk Nicholas', '', []), 'tuber');
  assert.equal(isBulk('Bulk Nicholas'), true);
  assert.equal(packSize('Bulk Cafe au Lait (5 pack)'), 5);
  assert.equal(kindFromTitle('Bulk DIY Bucket of : Custom Colour Palette', '', []), 'mix');
  assert.equal(kindFromTitle('Bulk Dahlia Tubers', '', []), 'mix');
});

test('colour-themed favourites packs are mixes, not varieties', () => {
  for (const t of ['Bulk Orange Favourites', 'Orange Favourites', 'Bulk - Orange Favourite', "Farmer's Favourites"]) assert.equal(kindFromTitle(t, '', []), 'mix', t);
  assert.equal(kindFromTitle('Bulk Nicholas', '', []), 'tuber');
});

test('emoji and flags are not part of a name', () => {
  assert.equal(varietyNameFromTitle('Letterkenny Wayne 🇨🇦'), 'Letterkenny Wayne');
  assert.equal(varietyNameFromTitle('🇨🇦 Ferncliff Copper'), 'Ferncliff Copper');
  assert.equal(varietyNameFromTitle('Rock Run Ashley ⭐️ NEW'), 'Rock Run Ashley');
  assert.equal(varietyNameFromTitle('Brand New Seedling'), 'Brand New Seedling');
});

test('buckets of cut flowers are not dahlias', () => {
  assert.equal(kindFromTitle('Growers Choice Bulk Flower Buckets', '', []), 'other');
  assert.equal(kindFromTitle('Bulk Flower Bucket', '', []), 'other');
  assert.equal(kindFromTitle('Bucket of Blooms', '', []), 'other');
  assert.equal(kindFromTitle("Grower's Choice Dahlia Tubers", '', []), 'mix');
  assert.equal(kindFromTitle('Bulk Nicholas', '', []), 'tuber');
});

test('anemone flowers are not dahlias, anemone dahlias are', () => {
  assert.equal(kindFromTitle('Anemone Carmel White', '', []), 'other');
  assert.equal(kindFromTitle('Anemone Mistral Plus Blue', '', []), 'other');
  assert.equal(kindFromTitle('Anemone Dahlia Blue Bayou', '', []), 'tuber');
  assert.equal(kindFromTitle('Blue Bayou (Anemone)', '', []), 'tuber');
  assert.equal(kindFromTitle('Anemone-flowered Dahlia Totally Tangerine', '', []), 'tuber');
});

test('wreaths and other holiday decor are not dahlias', () => {
  for (const t of ['Dried Flower Wreath', 'Fresh Evergreen Wreath', 'Wreaths', 'Dahlia Wreath', 'Winter Garland', 'Holiday Centrepiece', 'Cedar Swag']) assert.equal(kindFromTitle(t, '', []), 'other', t);
  assert.equal(kindFromTitle('Café au Lait', '', []), 'tuber');
});

test('arches, rentals and garden supplies are not dahlias', () => {
  for (const t of ['Wedding Arch Rental', 'Flower Arch', 'Garden Arches', 'Metal Obelisk', 'Dahlia Stakes', 'Plant Support Rings', 'Gift Basket', 'Trellis Netting', 'Rental: Flower Wall']) assert.equal(kindFromTitle(t, '', []), 'other', t);
  assert.equal(kindFromTitle('Archduke Joseph', '', []), 'tuber');
});

test('category placeholders are not dahlias', () => {
  for (const t of ['Water Lily Varieties', 'Ball Varieties', 'Pompon Dahlias', 'Dinnerplate Dahlias']) assert.equal(kindFromTitle(t, '', []), 'other', t);
  for (const t of ['Kelgai Ann', 'Cornel', 'Mystique']) assert.equal(kindFromTitle(t, '', []), 'tuber', t);
});

test('daffodils and other spring bulbs are not dahlias', () => {
  for (const t of ['Daffodil Pink Charm', 'Narcissus Tete-a-Tete', 'Jonquil Mix', 'Hyacinth Blue Jacket']) assert.equal(kindFromTitle(t, '', []), 'other', t);
  assert.equal(kindFromTitle('Pink Charm', '', ['Daffodils', 'Spring']), 'other');
  assert.equal(kindFromTitle('Pink Charm', '', ['Daffodils', 'Dahlia']), 'tuber'); // says dahlia too: keep
  assert.equal(kindFromTitle('Café au Lait', '', ['Peach', 'Dinnerplate']), 'tuber');
});
