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
