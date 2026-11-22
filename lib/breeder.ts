// Varieties from the breeder known as KA lead with the flower's own name ("Cinder Rose"),
// with the KA's spelling underneath as "Also sold as", the same way Maarn / Sylvia works.
const KA = /^\s*KA(?:['’]s)?\s+/; // capital KA only, so names like "Karma" are left alone

export function isKa(name: string): boolean {
  return KA.test(name);
}

/** "KA's Cinder Rose" → "Cinder Rose". Other names come back unchanged. */
export function withoutKa(name: string): string {
  return name.replace(KA, '').trim();
}
