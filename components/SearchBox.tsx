'use client';
// Search box with a dropdown of matching varieties and farms as you type.
import { useMemo, useRef, useState } from 'react';
import type { Suggestion } from '../lib/catalogue';
import { text } from '../site-text';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'®™]/g, '').toLowerCase();

export function SearchBox({ items, initial, hidden }: { items: Suggestion[]; initial: string; hidden: Record<string, string> }) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const form = useRef<HTMLFormElement>(null);

  const list = useMemo(() => {
    const n = norm(q.trim());
    if (n.length < 1) return [] as { s: Suggestion; via: string | null }[];
    const score = (l: string) => {
      const x = norm(l);
      return x.startsWith(n) ? 0 : x.split(' ').some((w) => w.startsWith(n)) ? 1 : x.includes(n) ? 2 : 9;
    };
    const hits: { s: Suggestion; via: string | null; rank: number }[] = [];
    for (const s of items) {
      const own = score(s.label);
      let best = own, via: string | null = null;
      for (const a of s.alts) {
        const r = score(a);
        if (r < best) { best = r; via = a; }
      }
      if (best < 9) hits.push({ s, via, rank: best });
    }
    return hits.sort((a, b) => a.rank - b.rank || a.s.label.localeCompare(b.s.label)).slice(0, 8);
  }, [q, items]);

  const go = (s: Suggestion) => {
    window.location.href = s.href;
  };

  return (
    <form ref={form} role="search" className="search" action="/" method="get" onSubmit={(e) => {
      if (open && active >= 0 && list[active]) { e.preventDefault(); go(list[active].s); }
    }}>
      {Object.entries(hidden).map(([k, v]) => v && k !== 'q' && k !== 'farm' ? <input key={k} type="hidden" name={k} value={v} /> : null)}
      <div className="search-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B5557" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input
          name="q"
          type="text"
          role="combobox"
          aria-label={text.searchPlaceholder}
          aria-autocomplete="list"
          aria-expanded={open && list.length > 0}
          aria-controls="sugg"
          aria-activedescendant={active >= 0 ? `s${active}` : undefined}
          autoComplete="off"
          placeholder={text.searchPlaceholder}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, list.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
            else if (e.key === 'Escape') setOpen(false);
          }}
        />
        <button type="submit">{text.searchButton}</button>
      </div>
      {open && list.length > 0 && (
        <ul id="sugg" role="listbox" className="sugg">
          {list.map(({ s, via }, i) => (
            <li key={s.kind + s.label + s.href} id={`s${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); go(s); }} onMouseEnter={() => setActive(i)}>
              <span>
                <b>{s.label}</b>
                {s.kind === 'farm' && s.sub && <span className="sub">{s.sub}</span>}
                {via && <span className="sub">{text.suggestionAlsoSoldAs} {via}</span>}
              </span>
              <span className="kind">{s.kind === 'farm' ? text.suggestionFarm : text.suggestionVariety}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
