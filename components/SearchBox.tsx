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
    if (n.length < 1) return [];
    const starts: Suggestion[] = [], contains: Suggestion[] = [];
    for (const s of items) {
      const l = norm(s.label);
      if (l.startsWith(n) || l.split(' ').some((w) => w.startsWith(n))) starts.push(s);
      else if (l.includes(n)) contains.push(s);
    }
    return [...starts, ...contains].slice(0, 8);
  }, [q, items]);

  const go = (s: Suggestion) => {
    window.location.href = s.href;
  };

  return (
    <form ref={form} role="search" className="search" action="/" method="get" onSubmit={(e) => {
      if (open && active >= 0 && list[active]) { e.preventDefault(); go(list[active]); }
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
          {list.map((s, i) => (
            <li key={s.kind + s.label + s.href} id={`s${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); go(s); }} onMouseEnter={() => setActive(i)}>
              <span>
                <b>{s.label}</b>
                {s.sub && <span className="sub">{s.kind === 'variety' ? `${text.suggestionAlsoSoldAs} ${s.sub}` : s.sub}</span>}
              </span>
              <span className="kind">{s.kind === 'farm' ? text.suggestionFarm : text.suggestionVariety}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
