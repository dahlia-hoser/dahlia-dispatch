// Dinnerplate is a bloom size (about 8 inches and up), not a form.
const WORDS = /dinner\s?-?plates?|\bgiant\b|\bAA\b(?=\s*(?:size|class|bloom|$|[,.;)]))/i;
// "8-10\" blooms", "10 inch", "9–11 in." (not feet: 4' plant height)
const INCHES = /(\d{1,2})(?:\s*(?:-|–|to)\s*(\d{1,2}))?\s*(?:"|”|''|in\b|in\.|inch(?:es)?)/gi;

export function isDinnerplate(text: string): boolean {
  if (!text) return false;
  if (WORDS.test(text)) return true;
  for (const m of text.matchAll(INCHES)) {
    const big = Math.max(Number(m[1]), Number(m[2] ?? 0));
    if (big >= 8 && big <= 16) return true;
  }
  return false;
}
