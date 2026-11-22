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
