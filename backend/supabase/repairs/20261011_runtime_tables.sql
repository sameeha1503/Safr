-- Apply in the intended Supabase SQL Editor. Atomic and repeatable; no data deletion.
BEGIN;

-- Source: 20261001210000_bucket_list_and_saved_routes.sql
-- 20261001210000_bucket_list_and_saved_routes.sql
-- Upgrades to public.saved_places and creation of public.saved_routes

-- 1. Upgrade public.saved_places table columns
ALTER TABLE public.saved_places
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'want' CHECK (status IN ('want', 'planned', 'visited')),
  ADD COLUMN IF NOT EXISTS visited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS planned_date DATE,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Refuse duplicates without deleting existing user data
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.saved_places GROUP BY user_id, lower(place_name) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate saved places need manual reconciliation before creating the unique index. No rows were deleted.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_places_user_place_name
  ON public.saved_places (user_id, lower(place_name));

CREATE INDEX IF NOT EXISTS idx_saved_places_user_created_at
  ON public.saved_places (user_id, created_at DESC);

-- Trigger for auto-updating updated_at on saved_places
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_saved_places_updated_at ON public.saved_places;
CREATE TRIGGER trigger_saved_places_updated_at
  BEFORE UPDATE ON public.saved_places
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Create public.saved_routes table
CREATE TABLE IF NOT EXISTS public.saved_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'car',
  origin JSONB NOT NULL,
  destination JSONB NOT NULL,
  waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_routes TO authenticated;
GRANT ALL ON public.saved_routes TO service_role;

-- Policies: Users can only see and manage their own saved routes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_routes' AND policyname = 'Users can manage their own saved routes'
  ) THEN
    CREATE POLICY "Users can manage their own saved routes"
      ON public.saved_routes
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_routes_user_created_at
  ON public.saved_routes (user_id, created_at DESC);


-- Source: 20261008000000_location_sharing.sql
CREATE TABLE IF NOT EXISTS public.location_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips ON DELETE CASCADE,
  traveller_id UUID NOT NULL REFERENCES public.travellers ON DELETE CASCADE,
  phone_number TEXT NOT NULL CHECK (phone_number ~ '^[0-9]{7,15}$'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired', 'blocked')) DEFAULT 'pending',
  invite_token_hash TEXT,
  invite_expires_at TIMESTAMPTZ,
  invite_used_at TIMESTAMPTZ,
  otp_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INT DEFAULT 0,
  otp_sends INT DEFAULT 0,
  otp_last_sent_at TIMESTAMPTZ,
  session_token_hash TEXT,
  share_expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_accuracy DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS location_links_traveller_active_idx ON public.location_links(traveller_id) WHERE status IN ('pending', 'accepted');

CREATE TABLE IF NOT EXISTS public.blocked_numbers (
  phone_hash TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.location_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID REFERENCES public.location_links ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('invited', 'otp_sent', 'otp_failed', 'accepted', 'declined', 'stopped', 'revoked', 'location_read', 'blocked')),
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.location_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.location_links FROM authenticated;
REVOKE ALL ON public.blocked_numbers FROM authenticated;
REVOKE ALL ON public.location_audit FROM authenticated;

GRANT ALL ON public.location_links TO service_role;
GRANT ALL ON public.blocked_numbers TO service_role;
GRANT ALL ON public.location_audit TO service_role;

CREATE OR REPLACE VIEW public.location_links_safe
WITH (security_invoker = true)
AS
SELECT
  id, owner_id, trip_id, traveller_id, phone_number, status,
  invite_expires_at, invite_used_at, share_expires_at, accepted_at,
  last_lat, last_lng, last_accuracy, last_seen_at, created_at
FROM public.location_links;

GRANT SELECT ON public.location_links_safe TO authenticated;

-- The invoker-security view needs underlying SELECT permission; the owner policy restricts rows.
GRANT SELECT ON public.location_links TO authenticated;

DROP POLICY IF EXISTS location_links_select_own ON public.location_links;
CREATE POLICY location_links_select_own
ON public.location_links
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());


-- Source: 20261012000000_place_cache.sql
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


-- Source: 20261012000100_crowd_reports.sql
CREATE TABLE IF NOT EXISTS public.crowd_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_key text NOT NULL,
  level text NOT NULL CHECK (level IN ('quiet','moderate','busy','packed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crowd_reports_place_created_idx ON public.crowd_reports(place_key, created_at DESC);
ALTER TABLE public.crowd_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crowd_reports_insert_own ON public.crowd_reports;
CREATE POLICY crowd_reports_insert_own ON public.crowd_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS crowd_reports_select_own ON public.crowd_reports;
CREATE POLICY crowd_reports_select_own ON public.crowd_reports FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT ON public.crowd_reports TO authenticated;
REVOKE UPDATE, DELETE ON public.crowd_reports FROM authenticated;
REVOKE ALL ON public.crowd_reports FROM anon;
GRANT ALL ON public.crowd_reports TO service_role;

-- Serialize submissions for a user/place to enforce cooldown across server processes
-- and direct authenticated inserts, rather than relying on a racy read-then-write.
CREATE OR REPLACE FUNCTION public.enforce_crowd_report_cooldown() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || ':' || NEW.place_key, 0));
  NEW.created_at := now();
  IF EXISTS (SELECT 1 FROM public.crowd_reports
    WHERE user_id = NEW.user_id AND place_key = NEW.place_key
      AND created_at > now() - interval '30 minutes') THEN
    RAISE EXCEPTION 'You can report this place once every 30 minutes.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crowd_report_cooldown ON public.crowd_reports;
CREATE TRIGGER crowd_report_cooldown BEFORE INSERT ON public.crowd_reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_crowd_report_cooldown();

NOTIFY pgrst, 'reload schema';
COMMIT;
