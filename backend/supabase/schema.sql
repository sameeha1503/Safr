-- =============================================================================
-- Goa Guide Buddy (Safr) - Consolidated Supabase Schema
-- =============================================================================

-- 1. Profiles Table & Trigger
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'own profile'
  ) THEN
    CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- 2. Trips Table
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  travel_style TEXT NOT NULL DEFAULT 'solo',
  traveller_name TEXT NOT NULL,
  phone_number TEXT,
  destination TEXT NOT NULL,
  start_date DATE,
  days INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trips' AND policyname = 'own trips'
  ) THEN
    CREATE POLICY "own trips" ON public.trips FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Travellers Table
CREATE TABLE IF NOT EXISTS public.travellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  category TEXT NOT NULL DEFAULT 'adult',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travellers TO authenticated;
GRANT ALL ON public.travellers TO service_role;
ALTER TABLE public.travellers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'travellers' AND policyname = 'own travellers'
  ) THEN
    CREATE POLICY "own travellers" ON public.travellers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.travellers ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.travellers DROP CONSTRAINT IF EXISTS travellers_phone_number_format;
ALTER TABLE public.travellers ADD CONSTRAINT travellers_phone_number_format CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{7,15}$');
CREATE UNIQUE INDEX IF NOT EXISTS travellers_trip_phone_unique ON public.travellers (trip_id, phone_number) WHERE phone_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_traveller_phone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  _trip_phone TEXT;
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    SELECT phone_number INTO _trip_phone FROM public.trips WHERE id = NEW.trip_id;
    IF NEW.phone_number = _trip_phone THEN
      RAISE EXCEPTION 'Traveller phone number cannot match the trip owner phone number';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_traveller_phone_check ON public.travellers;
CREATE TRIGGER trigger_traveller_phone_check
  BEFORE INSERT OR UPDATE ON public.travellers
  FOR EACH ROW EXECUTE FUNCTION public.check_traveller_phone();

ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_phone_number_format;
ALTER TABLE public.trips ADD CONSTRAINT trips_phone_number_format CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{7,15}$') NOT VALID;


-- 4. Safety Tags Table
CREATE TABLE IF NOT EXISTS public.safety_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  person_name TEXT NOT NULL,
  person_age INTEGER,
  category TEXT NOT NULL DEFAULT 'kid',
  description TEXT,
  guardian_name TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  alt_phone TEXT,
  medical_notes TEXT,
  staying_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_tags TO authenticated;
GRANT ALL ON public.safety_tags TO service_role;
ALTER TABLE public.safety_tags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'safety_tags' AND policyname = 'own safety tags'
  ) THEN
    CREATE POLICY "own safety tags" ON public.safety_tags FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Itineraries Table
CREATE TABLE IF NOT EXISTS public.itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  place TEXT NOT NULL,
  hours INTEGER NOT NULL DEFAULT 6,
  interests TEXT[] NOT NULL DEFAULT '{}',
  pace TEXT NOT NULL DEFAULT 'balanced',
  plan JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itineraries TO authenticated;
GRANT ALL ON public.itineraries TO service_role;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'itineraries' AND policyname = 'own itineraries'
  ) THEN
    CREATE POLICY "own itineraries" ON public.itineraries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;



-- 7. SafeTag Scans & Privacy Functions
CREATE TABLE IF NOT EXISTS public.safety_tag_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safety_tag_id UUID NOT NULL REFERENCES public.safety_tags(id) ON DELETE CASCADE,
  finder_note TEXT,
  finder_contact TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  delivery_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.safety_tag_scans TO authenticated;
REVOKE INSERT ON public.safety_tag_scans FROM anon;
GRANT ALL ON public.safety_tag_scans TO service_role;
ALTER TABLE public.safety_tag_scans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'safety_tag_scans' AND policyname = 'owner reads own tag scans'
  ) THEN
    CREATE POLICY "owner reads own tag scans" ON public.safety_tag_scans
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.safety_tags t
          WHERE t.id = safety_tag_id AND t.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'safety_tag_scans' AND policyname = 'owner updates own tag scans'
  ) THEN
    CREATE POLICY "owner updates own tag scans" ON public.safety_tag_scans
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.safety_tags t
          WHERE t.id = safety_tag_id AND t.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.safety_tags t
          WHERE t.id = safety_tag_id AND t.user_id = auth.uid()
        )
      );
  END IF;

  DROP POLICY IF EXISTS "anyone can log a scan" ON public.safety_tag_scans;
END $$;

CREATE OR REPLACE FUNCTION public.check_safety_tag(_token TEXT)
RETURNS TABLE (
  tag_id UUID,
  category TEXT,
  is_active BOOLEAN
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.category, true
  FROM public.safety_tags t
  WHERE t.token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.check_safety_tag(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_safety_tag(
  _token TEXT,
  _finder_note TEXT DEFAULT NULL,
  _finder_contact TEXT DEFAULT NULL,
  _lat DOUBLE PRECISION DEFAULT NULL,
  _lng DOUBLE PRECISION DEFAULT NULL,
  _delivery_status JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tag RECORD;
  _scan_id UUID;
BEGIN
  SELECT id, person_name, token INTO _tag FROM public.safety_tags WHERE token = _token;
  IF _tag.id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.safety_tag_scans (
    safety_tag_id,
    finder_note,
    finder_contact,
    lat,
    lng,
    delivery_status
  ) VALUES (
    _tag.id,
    _finder_note,
    _finder_contact,
    _lat,
    _lng,
    COALESCE(_delivery_status, '{}'::jsonb)
  ) RETURNING id INTO _scan_id;

  RETURN jsonb_build_object(
    'scan_id', _scan_id,
    'tag_id', _tag.id,
    'person_name', _tag.person_name,
    'token', _tag.token
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_safety_tag(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_safety_tag(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) TO service_role;

-- 8. Saved Places Table
CREATE TABLE IF NOT EXISTS public.saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'sight',
  notes TEXT,
  image_url TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'want' CHECK (status IN ('want', 'planned', 'visited')),
  visited_at TIMESTAMPTZ,
  priority SMALLINT NOT NULL DEFAULT 0,
  planned_date DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_places_user_place_name
  ON public.saved_places (user_id, lower(place_name));

CREATE INDEX IF NOT EXISTS idx_saved_places_user_created_at
  ON public.saved_places (user_id, created_at DESC);

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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'saved_places' AND policyname = 'Users can manage their own saved places'
  ) THEN
    CREATE POLICY "Users can manage their own saved places"
      ON public.saved_places
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 8b. Saved Routes Table
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_routes TO authenticated;
GRANT ALL ON public.saved_routes TO service_role;
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_saved_routes_user_created_at
  ON public.saved_routes (user_id, created_at DESC);

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

-- 9. Age Category Validation Constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'safety_tags_age_category_check'
  ) THEN
    ALTER TABLE public.safety_tags ADD CONSTRAINT safety_tags_age_category_check CHECK (
      person_age IS NOT NULL AND person_age BETWEEN 0 AND 120 AND (
        (category = 'kid' AND person_age < 18) OR
        (category IN ('adult', 'member') AND person_age >= 18 AND person_age < 60) OR
        (category = 'senior' AND person_age >= 60)
      )
    ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'travellers_age_category_check'
  ) THEN
    ALTER TABLE public.travellers ADD CONSTRAINT travellers_age_category_check CHECK (
      age IS NOT NULL AND age BETWEEN 0 AND 120 AND (
        (category = 'kid' AND age < 18) OR
        (category = 'adult' AND age >= 18 AND age < 60) OR
        (category = 'senior' AND age >= 60)
      )
    ) NOT VALID;
  END IF;
END $$;

-- 10. Location Sharing
CREATE TABLE public.location_links (
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

CREATE TABLE public.blocked_numbers (
  phone_hash TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.location_audit (
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
GRANT SELECT ON public.location_links TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'location_links' AND policyname = 'location_links_select_own'
  ) THEN
    CREATE POLICY location_links_select_own 
    ON public.location_links 
    FOR SELECT 
    TO authenticated 
    USING (owner_id = auth.uid());
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS public.crowd_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_key text NOT NULL,
  level text NOT NULL CHECK (level IN ('quiet','moderate','busy','packed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crowd_reports_place_created_idx ON public.crowd_reports(place_key, created_at DESC);
ALTER TABLE public.crowd_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY crowd_reports_insert_own ON public.crowd_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
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
CREATE TRIGGER crowd_report_cooldown BEFORE INSERT ON public.crowd_reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_crowd_report_cooldown();

-- A failure replacing travellers must roll back the trip edit and deletion too.
CREATE OR REPLACE FUNCTION public.save_trip_with_travellers(
  _trip jsonb,
  _travellers jsonb,
  _trip_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  owner_id uuid := auth.uid();
  saved_id uuid;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to save your trip.';
  END IF;
  IF jsonb_typeof(_trip) IS DISTINCT FROM 'object'
     OR jsonb_typeof(_travellers) IS DISTINCT FROM 'array'
     OR jsonb_array_length(_travellers) > 50
     OR COALESCE(_trip->>'travel_style', '') NOT IN ('solo', 'group')
     OR COALESCE(btrim(_trip->>'traveller_name'), '') = ''
     OR COALESCE(btrim(_trip->>'destination'), '') = ''
     OR (_trip->>'days') IS NULL
     OR (_trip->>'days')::integer NOT BETWEEN 1 AND 365
     OR COALESCE(_trip->>'phone_number', '') !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'Check your trip details before saving.';
  END IF;
  IF _trip_id IS NOT NULL THEN
    SELECT id INTO saved_id FROM public.trips
      WHERE id = _trip_id AND user_id = owner_id FOR UPDATE;
    IF saved_id IS NULL THEN
      RAISE EXCEPTION 'Trip not found or access denied.';
    END IF;
    UPDATE public.trips SET
      travel_style = _trip->>'travel_style',
      traveller_name = btrim(_trip->>'traveller_name'),
      phone_number = _trip->>'phone_number',
      destination = btrim(_trip->>'destination'),
      start_date = NULLIF(_trip->>'start_date', '')::date,
      days = (_trip->>'days')::integer
    WHERE id = saved_id AND user_id = owner_id;
    DELETE FROM public.travellers WHERE trip_id = saved_id AND user_id = owner_id;
  ELSE
    INSERT INTO public.trips (user_id, travel_style, traveller_name, phone_number, destination, start_date, days)
    VALUES (owner_id, _trip->>'travel_style', btrim(_trip->>'traveller_name'), _trip->>'phone_number',
      btrim(_trip->>'destination'), NULLIF(_trip->>'start_date', '')::date, (_trip->>'days')::integer)
    RETURNING id INTO saved_id;
  END IF;
  IF _trip->>'travel_style' = 'group' THEN
    INSERT INTO public.travellers (user_id, trip_id, name, age, category, phone_number)
    SELECT owner_id, saved_id, btrim(person.name), person.age, person.category, person.phone_number
    FROM jsonb_to_recordset(_travellers) AS person(name text, age integer, category text, phone_number text);
  END IF;
  RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_trip_with_travellers(jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_trip_with_travellers(jsonb, jsonb, uuid) TO authenticated;

create table if not exists public.road_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null check (lat between 14.8 and 15.9),
  lng double precision not null check (lng between 73.6 and 74.4),
  kind text not null check (kind in ('closure','flooding','roadworks','obstruction')),
  detail text not null check (length(trim(detail)) between 10 and 300),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);
create index if not exists road_reports_active on public.road_reports(status, expires_at);
alter table public.road_reports enable row level security;
revoke all on public.road_reports from anon, authenticated;
grant select on public.road_reports to authenticated;
grant insert (user_id,lat,lng,kind,detail) on public.road_reports to authenticated;
create policy road_reports_read on public.road_reports for select to authenticated
using (expires_at > now() and (status = 'approved' or user_id = auth.uid()));
create policy road_reports_submit on public.road_reports for insert to authenticated
with check (user_id = auth.uid() and status = 'pending');

-- A transaction lock makes the quota hold across processes and concurrent requests.
create or replace function public.limit_road_reports() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 25));
  if (select count(*) from public.road_reports where user_id = new.user_id
      and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Please wait before submitting another road report.' using errcode = 'P0001';
  end if;
  new.status := 'pending';
  new.created_at := now();
  new.expires_at := now() + interval '6 hours';
  return new;
end;
$$;
create trigger road_reports_quota before insert on public.road_reports
for each row execute function public.limit_road_reports();


-- Companion tracking, shared meeting points and SOS (2026-10-18).
-- Requires 20261008000000_location_sharing.sql. No anonymous location/table access.
ALTER TABLE public.location_links ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE public.location_links ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE public.location_links ADD COLUMN IF NOT EXISTS last_battery double precision CHECK (last_battery BETWEEN 0 AND 100);
ALTER TABLE public.location_links ADD COLUMN IF NOT EXISTS sharing_paused boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS location_links_token_hash_idx ON public.location_links(invite_token_hash) WHERE invite_token_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.trip_meeting_points (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trip_id uuid NOT NULL REFERENCES public.trips ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
 title text NOT NULL DEFAULT 'Family Meeting Spot' CHECK (length(title) BETWEEN 1 AND 100), notes text CHECK (length(notes)<=500),
 lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90), lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(trip_id)
);
CREATE TABLE IF NOT EXISTS public.sos_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trip_id uuid NOT NULL REFERENCES public.trips ON DELETE CASCADE,
 triggered_by_type text NOT NULL CHECK (triggered_by_type IN ('guardian','companion')),
 triggered_by_id uuid NOT NULL, sender_name text NOT NULL CHECK (length(sender_name) BETWEEN 1 AND 100),
 lat double precision CHECK (lat BETWEEN -90 AND 90), lng double precision CHECK (lng BETWEEN -180 AND 180),
 accuracy double precision CHECK (accuracy BETWEEN 0 AND 100000),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','false_alarm')),
 created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
 CHECK ((lat IS NULL) = (lng IS NULL))
);
ALTER TABLE public.sos_incidents ADD COLUMN IF NOT EXISTS delivery_summary text CHECK (length(delivery_summary)<=500);
CREATE INDEX IF NOT EXISTS sos_incidents_trip_idx ON public.sos_incidents(trip_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sos_incidents_one_active_actor ON public.sos_incidents(trip_id, triggered_by_id) WHERE status='active';
ALTER TABLE public.trip_meeting_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trip_meeting_points, public.sos_incidents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.trip_meeting_points, public.sos_incidents TO authenticated;
GRANT ALL ON public.trip_meeting_points, public.sos_incidents TO service_role;
DROP POLICY IF EXISTS meeting_owner_read ON public.trip_meeting_points;
CREATE POLICY meeting_owner_read ON public.trip_meeting_points FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id=trip_id AND t.user_id=auth.uid()));
DROP POLICY IF EXISTS sos_owner_read ON public.sos_incidents;
CREATE POLICY sos_owner_read ON public.sos_incidents FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id=trip_id AND t.user_id=auth.uid()));
-- Guardians can receive only their trip's private server broadcasts. No client INSERT policy.
DROP POLICY IF EXISTS guardian_tracking_receive ON realtime.messages;
CREATE POLICY guardian_tracking_receive ON realtime.messages FOR SELECT TO authenticated
 USING (extension='broadcast' AND EXISTS (SELECT 1 FROM public.trips t WHERE t.user_id=auth.uid() AND realtime.topic()='trip_tracking_'||t.id::text));

-- Restrictive guards remain effective if a deployment has unrelated broad policies.
DROP POLICY IF EXISTS guardian_tracking_isolation ON realtime.messages;
CREATE POLICY guardian_tracking_isolation ON realtime.messages AS RESTRICTIVE FOR SELECT TO anon, authenticated
 USING (NOT starts_with(realtime.topic(), 'trip_tracking_') OR EXISTS (SELECT 1 FROM public.trips t WHERE t.user_id=auth.uid() AND realtime.topic()='trip_tracking_'||t.id::text));
DROP POLICY IF EXISTS tracking_server_publish_only ON realtime.messages;
CREATE POLICY tracking_server_publish_only ON realtime.messages AS RESTRICTIVE FOR INSERT TO anon, authenticated
 WITH CHECK (NOT starts_with(realtime.topic(), 'trip_tracking_'));
DROP POLICY IF EXISTS meeting_owner_isolation ON public.trip_meeting_points;
CREATE POLICY meeting_owner_isolation ON public.trip_meeting_points AS RESTRICTIVE FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id=trip_id AND t.user_id=auth.uid()));
DROP POLICY IF EXISTS sos_owner_isolation ON public.sos_incidents;
CREATE POLICY sos_owner_isolation ON public.sos_incidents AS RESTRICTIVE FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id=trip_id AND t.user_id=auth.uid()));

-- Old snapshots are no longer readable through the public table/view after expiry or stop.
DROP POLICY IF EXISTS active_location_owner_read ON public.location_links;
CREATE POLICY active_location_owner_read ON public.location_links AS RESTRICTIVE FOR SELECT TO anon, authenticated
 USING (owner_id=auth.uid() AND status IN ('pending','accepted') AND invite_expires_at>now() AND share_expires_at>now());

-- Preserve companion IDs so ordinary trip edits do not cascade-delete active invitations.
CREATE OR REPLACE FUNCTION public.save_trip_with_travellers(
  _trip jsonb,
  _travellers jsonb,
  _trip_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  owner_id uuid := auth.uid();
  saved_id uuid;
  person record;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to save your trip.';
  END IF;
  IF jsonb_typeof(_trip) IS DISTINCT FROM 'object'
     OR jsonb_typeof(_travellers) IS DISTINCT FROM 'array'
     OR jsonb_array_length(_travellers) > 50
     OR COALESCE(_trip->>'travel_style', '') NOT IN ('solo', 'group')
     OR COALESCE(btrim(_trip->>'traveller_name'), '') = ''
     OR COALESCE(btrim(_trip->>'destination'), '') = ''
     OR (_trip->>'days') IS NULL
     OR (_trip->>'days')::integer NOT BETWEEN 1 AND 365
     OR COALESCE(_trip->>'phone_number', '') !~ '^[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'Check your trip details before saving.';
  END IF;
  IF _trip_id IS NOT NULL THEN
    SELECT id INTO saved_id FROM public.trips
      WHERE id = _trip_id AND user_id = owner_id FOR UPDATE;
    IF saved_id IS NULL THEN
      RAISE EXCEPTION 'Trip not found or access denied.';
    END IF;
    UPDATE public.trips SET
      travel_style = _trip->>'travel_style',
      traveller_name = btrim(_trip->>'traveller_name'),
      phone_number = _trip->>'phone_number',
      destination = btrim(_trip->>'destination'),
      start_date = NULLIF(_trip->>'start_date', '')::date,
      days = (_trip->>'days')::integer
    WHERE id = saved_id AND user_id = owner_id;
  ELSE
    INSERT INTO public.trips (user_id, travel_style, traveller_name, phone_number, destination, start_date, days)
    VALUES (owner_id, _trip->>'travel_style', btrim(_trip->>'traveller_name'), _trip->>'phone_number',
      btrim(_trip->>'destination'), NULLIF(_trip->>'start_date', '')::date, (_trip->>'days')::integer)
    RETURNING id INTO saved_id;
  END IF;
  IF _trip->>'travel_style' = 'group' THEN
    IF EXISTS (SELECT 1 FROM jsonb_to_recordset(_travellers) AS p(id uuid, name text)
      LEFT JOIN public.travellers t ON t.id=p.id AND t.trip_id=saved_id AND t.user_id=owner_id
      WHERE (p.id IS NOT NULL AND t.id IS NULL) OR COALESCE(btrim(p.name), '')='') THEN
      RAISE EXCEPTION 'Invalid companion or companion belongs to another trip.';
    END IF;
    IF EXISTS (SELECT p.id FROM jsonb_to_recordset(_travellers) AS p(id uuid)
      WHERE p.id IS NOT NULL GROUP BY p.id HAVING count(*)>1) THEN
      RAISE EXCEPTION 'Duplicate companion.';
    END IF;
    DELETE FROM public.travellers t WHERE t.trip_id=saved_id AND t.user_id=owner_id
      AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(_travellers) AS p(id uuid) WHERE p.id=t.id);
    -- Clearing numbers inside the transaction permits swaps without transient unique conflicts.
    UPDATE public.travellers SET phone_number=NULL WHERE trip_id=saved_id AND user_id=owner_id;
    FOR person IN SELECT * FROM jsonb_to_recordset(_travellers) AS p(id uuid, name text, age integer, category text, phone_number text) LOOP
      IF person.id IS NULL THEN
        INSERT INTO public.travellers(user_id,trip_id,name,age,category,phone_number)
        VALUES(owner_id,saved_id,btrim(person.name),person.age,person.category,person.phone_number);
      ELSE
        UPDATE public.travellers SET name=btrim(person.name),age=person.age,category=person.category,phone_number=person.phone_number
          WHERE id=person.id AND trip_id=saved_id AND user_id=owner_id;
      END IF;
    END LOOP;
  ELSE
    DELETE FROM public.travellers WHERE trip_id=saved_id AND user_id=owner_id;
  END IF;
  RETURN saved_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_trip_with_travellers(jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_trip_with_travellers(jsonb, jsonb, uuid) TO authenticated;
