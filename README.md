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

## Running locally

Requires **Node.js v20+** (with npm) or **Bun**.

### 1. Clone and install

```sh
git clone <this-repository-url>
cd <repository-name>
npm install   # or: bun install
```

### 2. Environment variables

The project includes a `.env` file with the public backend settings (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`). These are publishable values; keep the file in the project root so the local app connects to the shared database, storage and sign-in.

### 3. Start the dev server

```sh
npm run dev   # or: bun run dev
```

Open the URL Vite prints (usually `http://localhost:8080`).

### 4. Signing in

Sign-in uses Google and is restricted to `@asu.edu` accounts. After signing in you are returned to `<your-local-origin>/auth`, so sign in with an ASU Google account while running locally.

## Credits

Built by ASU NEXT Lab, based on the SmartRent Apartment Explorer concept. Created with [Lovable](https://lovable.dev).
