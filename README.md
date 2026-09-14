# Breywhites — website + studio admin

- `src/site` public website (home, work, private price pages `/p/:slug`)
- `src/admin` studio admin (`/admin`): enquiries, price links, quotes, invoices, payments, calendar, photos, packages, settings
- `src/lib` data layer: `supa.ts` (Supabase over fetch), `store/` (live + on-device preview store), `docs.ts` (JPG/PDF quotes & invoices)
- `supabase/schema.sql` full database: tables, row level security, triggers (numbering, payments → status → booked dates), price-link functions, starter data
- `public/` static files copied into the build (starter photos in `demo/`, `_headers`, `robots.txt`)

Build (needs Bun and `bun install`):

    bun scripts/build.ts            # → dist/  upload to Cloudflare Pages, fill dist/config.js
    bun scripts/build.ts --preview  # → preview/  sample-data build with hash routes

With empty `config.js` values the site runs on sample data kept in the browser.
