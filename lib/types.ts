export type Farm = {
  id: number;
  code: string;
  name: string;
  place: string | null;
  province: string | null;
  site: string | null;
  platform: 'shopify' | 'woocommerce' | 'manual' | 'unknown' | string;
  collection: string | null;
  active: boolean;
  last_checked_at: string | null;
  last_error: string | null;
};

export type Variety = {
  id: number;
  slug: string;
  name: string;
  colour1: string | null;
  colour2: string | null;
  form: string | null;
  status: string;
  notes: string | null;
};

export type Alias = { alias: string; variety_id: number; shown: string | null };

export type Listing = {
  id: number;
  farm_id: number;
  product_key: string;
  variety_id: number | null;
  title: string;
  url: string | null;
  price_cents: number | null;
  currency: string | null;
  in_stock: boolean;
  kind: string;
  active: boolean;
  first_seen: string;
  last_changed: string;
};

export type SaleEvent = {
  id: number;
  farm_id: number;
  label: string | null;
  starts_at: string | null;
  when_text: string | null;
  time_text: string | null;
  url: string | null;
  note: string | null;
};

export type ReviewItem = {
  id: number;
  kind: 'name' | 'details' | 'farm' | 'feedback';
  status: 'open' | 'later' | 'done';
  data: any;
  created_at: string;
};

export type Candidate = {
  id: number;
  name: string;
  place: string | null;
  province: string | null;
  site: string | null;
  platform: string | null;
  status: string;
};

export type AllData = {
  farms: Farm[];
  varieties: Variety[];
  aliases: Alias[];
  listings: Listing[];
  sales: SaleEvent[];
  pending?: { spelling: string; slug: string }[];
};

export const COLOURS = ['White', 'Cream', 'Yellow', 'Orange', 'Peach', 'Pink', 'Blush', 'Red', 'Burgundy', 'Purple', 'Lavender'];
export const FORMS = ['Ball', 'Pompon', 'Waterlily', 'Decorative', 'Cactus', 'Semi-cactus', 'Anemone', 'Collarette', 'Single', 'Stellar', 'Novelty', 'Orchid', 'Peony', 'Bicolour', 'Laciniated'];
export const PROVINCES = ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL'];
