CREATE TABLE IF NOT EXISTS public.place_cache (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS place_cache_expires_at_idx ON public.place_cache(expires_at);
ALTER TABLE public.place_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.place_cache FROM anon, authenticated;
GRANT ALL ON public.place_cache TO service_role;
-- No authenticated policies: cache reads/writes are service-role only.
