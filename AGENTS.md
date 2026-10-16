<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Digital twin models: apartments are scene objects named `APT_<number>` and devices are descendants named `DEV_<kind>`; both the built-in sample sites (src/lib/twin/build.ts) and uploaded GLBs use this one convention so picking, ingest and the spreadsheet share a single code path.
- Site data (sites, buildings, units, devices) lives in the shared backend database and is shared by every signed-in team member; GLB files go in the private `models` storage bucket.
- Google 2D imagery and 3D city tiles use a team-only server function that hands the browser a referrer-restricted Google Map Tiles key; the 3D tiles are clipped by an auto box around the model so scanned buildings don't overlap ours.
- Viewer picking uses a dedicated selection layer and a shared visibility/gesture module; floor cutaways span all buildings, keeping hidden geometry and camera drags out of selection without changing table focus.
