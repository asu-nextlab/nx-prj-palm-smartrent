ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS elevation double precision NOT NULL DEFAULT 0;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS tiles_height double precision NOT NULL DEFAULT 0;