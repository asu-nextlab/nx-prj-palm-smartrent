# SmartRent Digital Twin Explorer

A learning platform for modelling **structured buildings** for use in a digital twin. Students and modellers build apartment communities in Blender or SketchUp, following a simple naming convention, then upload them to place on a real map and explore them in 3D.

The goal is to practise building models whose structure — **sites → buildings → apartments → devices** — can later be connected to live data such as occupancy, energy use, thermostat readings or smart-lock status.

Live site: https://smartrent.nextlab.bot

## Why structured models matter

A digital twin is only as useful as the structure behind it. A model that is just geometry can be looked at; a model where every apartment and device is a named, addressable object can be **linked to real-world data**. This project teaches that discipline:

- Every apartment is a separate object named `APT_<number>` (e.g. `APT_204`).
- Every device lives inside its apartment and is named `DEV_<kind>` (e.g. `DEV_fridge`, `DEV_thermostat`, `DEV_lock`).
- Site context (trees, roads, paths, equipment) can be included freely without these prefixes.
- Optional Blender custom properties (`beds`, `baths`, `area_sqft`, `floor`, `layout`) are exported as glTF extras and read automatically.

## What you can do

- **Geolocate a site** on OpenStreetMap and nudge it N/S/E/W in 1, 10 or 100 ft steps.
- **Upload a GLB/glTF** export; apartments and devices are detected and listed automatically.
- **Explore in 2D or 3D**, select apartments and devices, and step through floors with the floor navigator.
- **Edit apartment data** (beds, baths, floor area, rent, status) in a spreadsheet view.
- **Inspect devices** (type, model, install year, energy use, notes) — the hook point for future live data feeds.
- **Use the built-in modeller guide** and download a sample GLB to learn the conventions.

Sample communities with multiple buildings and layouts (studio to three-bedroom) are included. Their rent and device data is synthetic.

## Workflow for modellers

1. Model the site in Blender or SketchUp (metres, Y-up on export).
2. Name each apartment `APT_<number>` and nest its devices as `DEV_<kind>`.
3. Add optional custom properties for apartment details.
4. Export as `.glb` and upload it on the Sites page.
5. Place it on the map, then review and enrich data in the spreadsheet.

Uploaded GLBs are the source of geometry and structure; edits in the web app are stored in the database and do not modify the original file.

## Tech stack

- **TanStack Start** (React 19, file-based routing, server functions) on **Vite 7**
- **TypeScript** throughout
- **Tailwind CSS v4** with shadcn/ui components
- **Three.js** via React Three Fiber and Drei for 3D viewing and GLB parsing
- **OpenStreetMap** tiles for site geolocation
- **TanStack Query** for data loading and caching
- **Lovable Cloud** (Postgres database, auth and storage) — shared site data with row-level security; GLB files in a private storage bucket
- **Google sign-in**, restricted to `@asu.edu` accounts
- Deployed to an edge runtime (Cloudflare Workers)

## Development

Requires Node.js and npm (or Bun).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

The app runs at http://localhost:8080.

### Local development with a dev database

Signing in with ASU Google only works on the Lovable-hosted site, so a local copy can't log in to the live database. Instead, point your local copy at a separate dev Supabase project with its own email login. This also keeps test edits away from the live data.

**One-time setup per team (skip if someone already made the dev project):**

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run this line, then each file in `drizzle/migrations/` in order (`0000` → `0003`). This creates the tables, the ASU-only access rules and three sample sites.
   ```sql
   insert into storage.buckets (id, name, public) values ('models', 'models', false) on conflict (id) do nothing;
   ```
3. In **Authentication → Sign In / Providers**, keep **Email** enabled and turn **Confirm email** off, so dev accounts work without confirmation emails.

**Per developer:**

1. Copy `.env.local.example` to `.env.local` and fill in the dev project's URL, publishable key and project ID (**Project Settings → API Keys**). `.env.local` is git-ignored and overrides `.env`; don't edit `.env`, which belongs to Lovable.
2. Run `npm run dev` (restart it after changing `.env.local`).
3. On http://localhost:8080/auth, use the **Local dev login** box: enter your `@asu.edu` email and a new password (not your ASU password), then **Create account**. Next time use **Sign in**.

The dev login only appears when running locally with `VITE_DEV_LOGIN=true`; it never shows on the live site. Data in the dev project is separate: sites uploaded there don't appear on the live site and vice versa. Free projects pause after about a week without use; resume them from the Supabase dashboard.

## Credits

Built by ASU NEXT Lab, based on the SmartRent Apartment Explorer concept. Created with [Lovable](https://lovable.dev).
