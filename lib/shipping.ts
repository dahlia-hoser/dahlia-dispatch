// Reading a farm's shipping page for: where it ships, when, what it costs, and pickup.
// These fill in only blanks; anything the owner typed on the Farms page is never overwritten.
const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|mars|avril|mai|juin';

export type ShippingInfo = { ships_to?: string; ship_window?: string; ship_cost?: string; pickup?: string };

export function extractShipping(raw: string): ShippingInfo {
  const text = raw.replace(/\s+/g, ' ');
  const lower = text.toLowerCase();
  const out: ShippingInfo = {};

  if (/(ship|shipping|livraison|expédi)[^.]{0,60}\b(anywhere in|across|throughout|within|partout au|à travers le) canada\b|canada[- ]wide|across canada|partout au canada/.test(lower)) out.ships_to = 'all';

  const costs: string[] = [];
  const flat = lower.match(/flat[- ]rate (?:shipping )?(?:of |is |fee of )?\$\s?(\d+(?:\.\d\d)?)/);
  if (flat) costs.push(`$${flat[1].replace(/\.00$/, '')} flat`);
  const free = lower.match(/free (?:shipping|livraison)[^.$]{0,40}?(?:over|above|of|plus de|à partir de|\$\s?\d+\+)\s*\$?\s?(\d+)/);
  if (free) costs.push(`free over $${free[1]}`);
  if (costs.length) out.ship_cost = costs.join(', ');

  const sentences = text.split(/(?<=[.!?])\s+/);
  const shipLine = sentences.find((s) => /\b(ship|shipping|shipped|expédi|livr)/i.test(s) && new RegExp(`\\b(early |mid-?|late )?(${MONTHS})\\b`, 'i').test(s) && /tuber|dahlia|order|commande|tubercule/i.test(s));
  if (shipLine) {
    const m = shipLine.match(new RegExp(`((?:early |mid-?|late )?(?:${MONTHS})(?:\\s+\\d{1,2})?(?:\\s*(?:-|–|to|and|or|through|à|et)\\s*(?:early |mid-?|late )?(?:${MONTHS})?\\s*\\d{0,2})?)`, 'i'));
    if (m) out.ship_window = m[1].trim().replace(/^\w/, (c) => c.toUpperCase());
  }

  if (/\b(farm|local|on[- ]farm|curbside|porch) pick-?\s?up\b|cueillette à la ferme|ramassage/.test(lower) && !/no (local )?pick-?\s?up|pick-?\s?up (is )?not available/.test(lower)) out.pickup = 'Pickup available';
  return out;
}

export const SHIPPING_PAGES = ['/policies/shipping-policy', '/pages/shipping', '/pages/shipping-policy', '/pages/faq', '/pages/faqs', '/shipping', '/faq', '/pages/dahlia-faq'];
