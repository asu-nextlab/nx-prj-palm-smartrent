-- DEV DATABASE ONLY. Never run this against the live (Lovable Cloud) database.
-- Breaks a deterministic handful of sample devices and backdates when they broke, and varies
-- device energy use and install years by apartment, so the maintenance list, apartment fix
-- lists and the priority, energy and device-age heatmaps have something to show.
-- Requires migration 0005 (devices.status_since). Safe to re-run.

-- 1. A spread of broken devices across all sample sites (~1 in 25 needs service, ~1 in 30 offline).
UPDATE public.devices SET status = 'needs service'
WHERE status = 'online' AND abs(hashtext(id::text)) % 25 = 0;
UPDATE public.devices SET status = 'offline'
WHERE status = 'online' AND abs(hashtext(id::text)) % 30 = 1;

-- 2. One Garden Court apartment with several broken devices (shows the per-apartment bonus).
UPDATE public.devices SET status = 'needs service'
WHERE object_name IN ('DEV_tv', 'DEV_lock', 'DEV_thermostat')
  AND unit_id = (SELECT id FROM public.units
                 WHERE site_id = '11111111-0000-0000-0000-000000000002' AND object_name = 'APT_4302');

-- 3. Backdate when each broken device broke (0-29 days ago). A separate statement because
--    the status trigger stamps status_since = now() whenever status itself changes.
UPDATE public.devices
SET status_since = now() - make_interval(days => abs(hashtext(id::text || ':since')) % 30, hours => 3)
WHERE status <> 'online';

-- 4. Vary energy use and install years by apartment (the seed gives every apartment the same
--    totals, so the energy and device-age heatmaps were flat). Sample sites and seeded device
--    kinds only; values come from fixed per-kind baselines, so re-running gives the same result.
--    Each apartment gets a usage factor (0.6-1.6x) and a fit-out year (2017-2025); its devices
--    vary a little around both.
UPDATE public.devices d
SET energy_kwh = round(
      (CASE regexp_replace(d.object_name, '_[0-9]+$', '')
         WHEN 'DEV_fridge' THEN 420 WHEN 'DEV_range' THEN 240 WHEN 'DEV_tv' THEN 90
         WHEN 'DEV_thermostat' THEN 12 WHEN 'DEV_lock' THEN 4 END)
      * (0.6 + (abs(hashtext(u.id::text || ':use')) % 101) / 100.0)
      * (0.9 + (abs(hashtext(d.id::text || ':use')) % 21) / 100.0)),
    install_year = least(2026, 2017 + abs(hashtext(u.id::text || ':year')) % 9 + abs(hashtext(d.id::text || ':year')) % 3)
FROM public.units u
WHERE d.unit_id = u.id
  AND u.site_id IN ('11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003')
  AND regexp_replace(d.object_name, '_[0-9]+$', '') IN ('DEV_fridge', 'DEV_range', 'DEV_tv', 'DEV_thermostat', 'DEV_lock');
