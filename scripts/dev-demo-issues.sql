-- DEV DATABASE ONLY. Never run this against the live (Lovable Cloud) database.
-- Breaks a deterministic handful of sample devices and backdates when they broke, so the
-- maintenance list, apartment fix lists and priority heatmap have something to show.
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
