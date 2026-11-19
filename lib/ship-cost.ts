// Turns a farm's shipping note ("$18, free over $250") into numbers the plan can add up.
export type ShipCost = { flatCents: number | null; freeOverCents: number | null };

const cents = (s: string) => Math.round(parseFloat(s.replace(/,/g, '')) * 100);

export function parseShipCost(text?: string | null): ShipCost {
  const t = (text ?? '').toLowerCase();
  const free = t.match(/free(?:\s+shipping)?\s+(?:on\s+orders\s+)?(?:over|above|on orders over|\+)\s*\$\s*([\d,]+(?:\.\d{1,2})?)/);
  // The flat rate is the first dollar amount that isn't the free-shipping threshold.
  let flat: number | null = null;
  for (const m of t.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)) {
    if (free && m.index! >= (free.index ?? 0) && m.index! <= (free.index ?? 0) + free[0].length) continue;
    flat = cents(m[1]);
    break;
  }
  if (flat == null && /free shipping|ships free/.test(t) && !free) flat = 0;
  return { flatCents: flat, freeOverCents: free ? cents(free[1]) : null };
}

/** Shipping for an order of this size, or null when the farm hasn't said. */
export function shippingFor(text: string | null | undefined, subtotalCents: number): number | null {
  const s = parseShipCost(text);
  if (s.freeOverCents != null && subtotalCents >= s.freeOverCents) return 0;
  return s.flatCents;
}
