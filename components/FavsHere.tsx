'use client';
// On a farm's page: which of this browser's favourites the farm has, in stock or not.
import { useFavs } from './Fav';
import { text, fill } from '../site-text';

export function FavsHere({ items }: { items: { slug: string; name: string; inStock: boolean }[] }) {
  const favs = new Set(useFavs());
  const mine = items.filter((i) => favs.has(i.slug));
  if (!mine.length) return null;
  const inStock = mine.filter((i) => i.inStock);
  const out = mine.length - inStock.length;
  return (
    <p className="favs-here">
      <span aria-hidden="true">♥ </span>
      {inStock.length > 0 && fill(inStock.length === 1 ? text.favsHereOne : text.favsHere, { n: inStock.length, names: inStock.map((i) => i.name).join(', ') })}
      {inStock.length > 0 && out > 0 && ' '}
      {out > 0 && fill(text.favsHereOut, { n: out })}
    </p>
  );
}
