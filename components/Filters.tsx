'use client';
import { text } from '../site-text';
import { COLOURS, FORMS, PROVINCES } from '../lib/types';

type F = { q?: string; farm?: string; avail?: string; form?: string; colour?: string; prov?: string; get?: string; only?: string };

export function Filters({ f, farmName }: { f: F; farmName?: string }) {
  const submit = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.submit();
  const any = f.avail || f.form || f.colour || f.prov || f.farm || f.get || f.only;
  const count = [f.avail, f.form, f.colour, f.prov, f.get, f.only].filter(Boolean).length;
  return (
    <form className="filters-wrap" action="/" method="get">
      {f.q && <input type="hidden" name="q" value={f.q} />}
      {f.farm && <input type="hidden" name="farm" value={f.farm} />}
      <details className="filters-box" open={count > 0}>
        <summary className="btn ghost">
          {text.filtersButton}
          {count > 0 && <span className="count">{count}</span>}
        </summary>
        <div className="filters">
      <label>
        {text.filterAvailability}
        <select name="avail" defaultValue={f.avail ?? ''} onChange={submit}>
          <option value="">{text.availAll}</option>
          <option value="in">{text.availInStock}</option>
          <option value="out">{text.availNotAvailable}</option>
          <option value="soon">{text.availComingSoon}</option>
          <option value="list">{text.availPriceList}</option>
        </select>
      </label>
      <label>
        {text.filterForm}
        <select name="form" defaultValue={f.form ?? ''} onChange={submit}>
          <option value="">{text.filterAny}</option>
          {FORMS.map((x) => <option key={x} value={x}>{x === 'Decorative' ? text.formDecorativeAny : x}</option>)}
        </select>
      </label>
      <label>
        {text.filterColour}
        <select name="colour" defaultValue={f.colour ?? ''} onChange={submit}>
          <option value="">{text.filterAny}</option>
          {COLOURS.map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>
        {text.filterProvince}
        <select name="prov" defaultValue={f.prov ?? ''} onChange={submit}>
          <option value="">{text.filterAny}</option>
          {PROVINCES.map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>
        {text.filterGetIn}
        <select name="get" defaultValue={f.get ?? ''} onChange={submit}>
          <option value="">{text.filterAny}</option>
          {PROVINCES.map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>
        {text.filterOnly}
        <select name="only" defaultValue={f.only ?? ''} onChange={submit}>
          <option value="">{text.filterAny}</option>
          <option value="new">{text.onlyNew}</option>
          <option value="canadian">{text.onlyCanadian}</option>
          <option value="pickup">{text.onlyPickup}</option>
          <option value="packs">{text.onlyPacks}</option>
        </select>
      </label>
      <noscript><button className="btn ghost" type="submit">{text.searchButton}</button></noscript>
        </div>
      </details>
      {farmName && <span className="chip soft">{farmName}</span>}
      {any && <a className="clear" href={f.q ? `/?q=${encodeURIComponent(f.q)}` : '/'}>{text.clearFilters}</a>}
    </form>
  );
}
