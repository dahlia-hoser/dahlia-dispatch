// Status check: is the site connected to the database? Never shows the secret key itself.
import { createClient } from '@supabase/supabase-js';
import { cleanUrl } from '../../lib/db';

const TABLES = ['farms', 'varieties', 'aliases', 'listings', 'sale_events', 'review_items', 'farm_candidates', 'check_runs'];

function explain(msg: string): string {
  if (/invalid api key|jwt|unauthorized|401/i.test(msg)) return 'The secret key looks wrong. Copy it again from Supabase (Project Settings → API Keys → Secret keys) into SUPABASE_SECRET_KEY on Vercel, then redeploy.';
  if (/fetch failed|enotfound|getaddrinfo|invalid url|failed to parse/i.test(msg)) return 'The Project URL looks wrong. It should look like https://abcdxyz.supabase.co with nothing after .co. Fix SUPABASE_URL on Vercel, then redeploy.';
  if (/does not exist|could not find the table|schema cache/i.test(msg)) return 'The table is missing. Run schema.sql (then seed.sql) again in Supabase → SQL Editor.';
  if (/permission denied/i.test(msg)) return 'The key is not allowed to read this table. Run schema.sql again in Supabase (it gives the secret key access).';
  if (/paused|503/i.test(msg)) return 'The Supabase project may be paused. Open Supabase and click Restore project.';
  return 'Send this message to Claude.';
}

export default async function Status() {
  const url = cleanUrl(process.env.SUPABASE_URL) ?? '';
  const key = process.env.SUPABASE_SECRET_KEY ?? '';
  const lines: { label: string; ok: boolean; detail: string }[] = [];

  lines.push({ label: 'SUPABASE_URL is set', ok: !!url, detail: url ? url.replace(/^(https:\/\/.{4}).*(\.supabase\.co.*)$/, '$1…$2') : 'Missing. Add it on Vercel → Settings → Environment Variables, then redeploy.' });
  lines.push({
    label: 'SUPABASE_SECRET_KEY is set',
    ok: !!key,
    detail: key ? `${key.length} characters, starts with “${key.slice(0, 10)}…”${/^sb_publishable_|^eyJ.*anon/.test(key) ? ' — this looks like the public key, not the secret one' : ''}` : 'Missing. Add it on Vercel, then redeploy.',
  });
  lines.push({ label: 'SITE_PASSWORD is set', ok: !!process.env.SITE_PASSWORD, detail: process.env.SITE_PASSWORD ? 'Yes' : 'Missing: the site is not password-protected.' });

  if (url && key) {
    try {
      const sb = createClient(url.trim(), key.trim(), { auth: { persistSession: false } });
      for (const t of TABLES) {
        const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
        if (error) lines.push({ label: `Table ${t}`, ok: false, detail: `${error.message} ${error.code ?? ''} — ${explain(error.message + ' ' + (error.code ?? ''))}` });
        else lines.push({ label: `Table ${t}`, ok: true, detail: `${count ?? 0} rows` });
      }
    } catch (e: any) {
      const m = String(e?.message ?? e);
      lines.push({ label: 'Connecting to Supabase', ok: false, detail: `${m} — ${explain(m)}` });
    }
  }

  return (
    <>
      <h1 style={{ fontSize: 32 }}>Status check</h1>
      <table className="table">
        <tbody>
          {lines.map((l) => (
            <tr key={l.label}>
              <td>{l.ok ? '✅' : '❌'}</td>
              <td><b>{l.label}</b></td>
              <td className={l.ok ? '' : 'bad'}>{l.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
