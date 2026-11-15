import { notFound } from 'next/navigation';
import { db } from '../../../../lib/db';
import { saveVariety } from '../../actions';
import { COLOURS, FORMS } from '../../../../lib/types';

export default async function EditVariety({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { slug } = await params;
  const { saved } = await searchParams;
  const t = db();
  const [v] = await t.where('varieties', { slug });
  if (!v) notFound();
  const aliases = (await t.where('aliases', { variety_id: v.id })).filter((a) => a.shown);

  const Pick = ({ name, options, value }: { name: string; options: string[]; value: string | null }) => (
    <select name={name} defaultValue={value ?? ''}>
      <option value="">Not set</option>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );

  return (
    <>
      <a className="back" href={`/v/${v.slug}`}>← Back to {v.name}</a>
      <h1 style={{ fontSize: 32 }}>Edit {v.name}</h1>
      {saved && <p className="saved">Saved.</p>}
      <form className="form" action={saveVariety}>
        <input type="hidden" name="id" value={v.id} />
        <label>Name<input name="name" defaultValue={v.name} required /></label>
        <label>Also sold as (one spelling per line)<textarea name="aka" rows={3} defaultValue={aliases.map((a) => a.shown).join('\n')} /></label>
        <div className="inline">
          <label>Colour 1<Pick name="colour1" options={COLOURS} value={v.colour1} /></label>
          <label>Colour 2<Pick name="colour2" options={COLOURS} value={v.colour2} /></label>
        </div>
        <label>Form<Pick name="form" options={FORMS} value={v.form} /></label>
        <label>Status<Pick name="status" options={['Suggested', 'Needs you', 'Confirmed', 'Not a dahlia']} value={v.status} /></label>
        <label>Private notes<textarea name="notes" rows={3} defaultValue={v.notes ?? ''} /></label>
        <div><button className="btn" type="submit">Save</button></div>
      </form>
    </>
  );
}
