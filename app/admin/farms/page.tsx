import { db } from '../../../lib/db';
import { ago } from '../../../lib/catalogue';
import { saveFarm } from '../actions';
import type { Farm } from '../../../lib/types';
import { PROVINCES } from '../../../lib/types';

export default async function Farms({ searchParams }: { searchParams: Promise<{ saved?: string; edit?: string }> }) {
  const { saved, edit } = await searchParams;
  const t = db();
  const [farms, listings, runs] = await Promise.all([t.all('farms'), t.all('listings'), t.all('check_runs')]);
  (farms as Farm[]).sort((a, b) => a.name.localeCompare(b.name));
  const count = (id: number) => listings.filter((l) => l.farm_id === id && l.active).length;
  const lastRun = runs.sort((a, b) => b.id - a.id)[0];
  const editing = (farms as Farm[]).find((f) => String(f.id) === edit);

  return (
    <>
      <a className="back" href="/admin">← Review list</a>
      <h1 style={{ fontSize: 32 }}>Farms</h1>
      {saved && <p className="saved">Saved.</p>}
      <p className="note">
        Last checker run: {lastRun ? `${ago(lastRun.ran_at)} — ${lastRun.checked} farms, ${lastRun.changes} changes, ${lastRun.errors} problems. ${lastRun.summary ?? ''}` : 'not yet'}
      </p>

      {editing && (
        <form className="card form" action={saveFarm}>
          <h2>Edit {editing.name}</h2>
          <input type="hidden" name="id" value={editing.id} />
          <label>Name<input name="name" defaultValue={editing.name} required /></label>
          <label>Place<input name="place" defaultValue={editing.place ?? ''} /></label>
          <label>Province
            <select name="province" defaultValue={editing.province ?? ''}>
              <option value="">Not set</option>
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label>Shop web address<input name="site" defaultValue={editing.site ?? ''} placeholder="https://farmname.ca" /></label>
          <label>Shop type
            <select name="platform" defaultValue={editing.platform}>
              <option value="unknown">Not sure (the checker will try to find out)</option>
              <option value="shopify">Shopify</option>
              <option value="woocommerce">WooCommerce</option>
              <option value="manual">Price list only (not checked)</option>
            </select>
          </label>
          <label>Shopify collection (optional, e.g. dahlia-tubers)<input name="collection" defaultValue={editing.collection ?? ''} /></label>
          <label className="inline" style={{ flexDirection: 'row' }}><input type="checkbox" name="active" defaultChecked={editing.active} /> Check this farm</label>
          <div className="inline"><button className="btn" type="submit">Save</button><a href="/admin/farms">Cancel</a></div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr><th>Farm</th><th>Shop type</th><th>Listings</th><th>Last checked</th><th>Problem</th><th></th></tr>
        </thead>
        <tbody>
          {(farms as Farm[]).map((f) => (
            <tr key={f.id}>
              <td><b>{f.name}</b><br /><span className="note">{f.place}</span></td>
              <td>{f.active ? f.platform : 'off'}</td>
              <td>{count(f.id)}</td>
              <td>{ago(f.last_checked_at)}</td>
              <td className={f.last_error ? 'bad' : ''}>{f.last_error ?? ''}</td>
              <td><a href={`/admin/farms?edit=${f.id}`}>Edit</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
