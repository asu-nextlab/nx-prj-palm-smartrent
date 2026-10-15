-- When each device's status last changed, so open issues (offline / needs service)
-- can be prioritised by how long they've been open. Kept up to date by a trigger,
-- so edits from the web app and future live data feeds both stamp it.
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS status_since timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.devices_touch_status_since()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_since := now();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS devices_status_since ON public.devices;
CREATE TRIGGER devices_status_since
  BEFORE UPDATE OF status ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.devices_touch_status_since();
