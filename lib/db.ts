// One small way to read and write the tables, used by both the website and the checker.
// With Supabase keys set, it talks to Supabase. Without them it runs a "preview" copy in memory,
// filled from the files in data/, so the site can be looked at before the database exists.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { buildPreviewTables } from './preview-data';

export type Row = Record<string, any>;
export type Match = Record<string, string | number | boolean | null>;

export interface Tables {
  preview: boolean;
  all(table: string): Promise<Row[]>;
  where(table: string, match: Match): Promise<Row[]>;
  insert(table: string, rows: Row | Row[]): Promise<Row[]>;
  update(table: string, match: Match, patch: Row): Promise<void>;
  remove(table: string, match: Match): Promise<void>;
  removeIn(table: string, column: string, values: (string | number)[]): Promise<void>;
}

class SupabaseTables implements Tables {
  preview = false;
  constructor(private sb: SupabaseClient) {}
  async all(table: string) {
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb.from(table).select('*').order(primaryKey(table)).range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  }
  async where(table: string, match: Match) {
    const { data, error } = await this.sb.from(table).select('*').match(match as any);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  }
  async insert(table: string, rows: Row | Row[]) {
    const { data, error } = await this.sb.from(table).insert(rows).select('*');
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  }
  async update(table: string, match: Match, patch: Row) {
    const { error } = await this.sb.from(table).update(patch).match(match as any);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  async remove(table: string, match: Match) {
    const { error } = await this.sb.from(table).delete().match(match as any);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  async removeIn(table: string, column: string, values: (string | number)[]) {
    for (let i = 0; i < values.length; i += 200) {
      const { error } = await this.sb.from(table).delete().in(column, values.slice(i, i + 200));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }
}

function primaryKey(table: string) {
  return table === 'aliases' ? 'alias' : 'id';
}

const same = (row: Row, match: Match) => Object.entries(match).every(([k, v]) => row[k] === v);

class MemoryTables implements Tables {
  preview = true;
  private next = 100000;
  constructor(private t: Record<string, Row[]>) {}
  private rows(table: string) {
    return (this.t[table] ??= []);
  }
  async all(table: string) {
    return this.rows(table).map((r) => ({ ...r }));
  }
  async where(table: string, match: Match) {
    return this.rows(table).filter((r) => same(r, match)).map((r) => ({ ...r }));
  }
  async insert(table: string, rows: Row | Row[]) {
    const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({
      ...(table === 'aliases' ? {} : { id: this.next++ }),
      created_at: new Date().toISOString(),
      ...r,
    }));
    this.rows(table).push(...list);
    return list;
  }
  async update(table: string, match: Match, patch: Row) {
    for (const r of this.rows(table)) if (same(r, match)) Object.assign(r, patch);
  }
  async remove(table: string, match: Match) {
    this.t[table] = this.rows(table).filter((r) => !same(r, match));
  }
  async removeIn(table: string, column: string, values: (string | number)[]) {
    const set = new Set(values);
    this.t[table] = this.rows(table).filter((r) => !set.has(r[column]));
  }
}

let cached: Tables | null = null;

export function db(): Tables {
  if (cached) return cached;
  const url = cleanUrl(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (url && key) {
    cached = new SupabaseTables(createClient(url, key, { auth: { persistSession: false } }));
  } else {
    const g = globalThis as any;
    g.__dahliaPreview ??= new MemoryTables(buildPreviewTables());
    cached = g.__dahliaPreview as Tables;
  }
  return cached;
}

/** Forgive common copy-paste slips: spaces, a trailing slash, or the /rest/v1 ending. */
export function cleanUrl(u?: string) {
  if (!u) return u;
  return u.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}
