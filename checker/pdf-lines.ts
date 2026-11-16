// PDF -> lines of text, rebuilding table rows by grouping words that sit at the same height.
export async function pdfLines(data: Uint8Array): Promise<string[]> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as any[]) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 2) * 2; // words within 2 points share a row
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: it.transform[4], s: it.str });
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      lines.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((w) => w.s.trim()).join(' '));
    }
  }
  return lines;
}
