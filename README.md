# The Hosers' Dahlia Dispatch

Dahlia tuber prices, stock and sale dates from small Canadian growers, all in one place. This is a private beta.

- **Setup steps:** see [SETUP.md](SETUP.md)
- **Change the site's wording:** [site-text.ts](site-text.ts)

## How it fits together

- **Website:** Next.js on Vercel (`app/`, `components/`). The whole site is password-protected (`middleware.ts`) and hidden from search engines.
- **Database:** Supabase (`supabase/schema.sql`, `supabase/seed.sql`). The seed file is built from `data/*.json` with `npx tsx scripts/make-seed.ts`.
- **Stock checker:** `checker/`, run every 10 minutes by `.github/workflows/check-farms.yml`. Each run only reads farms that are due (see `checker/schedule.ts`).
  - It reads Shopify `/products.json` and the WooCommerce Store API.
  - It matches names through the `aliases` table. Unsure matches become review-list questions.
  - Unknown names get a new variety page straight away.
- **Preview mode:** without Supabase keys, the site runs on an in-memory copy of `data/`.

## Commands

```
npm install
npm run dev              # site at http://localhost:3000 (preview mode without keys)
npm test                 # name matching, shop reading, schedule, review list
npm run check-farms      # needs SUPABASE_URL and SUPABASE_SECRET_KEY
```
