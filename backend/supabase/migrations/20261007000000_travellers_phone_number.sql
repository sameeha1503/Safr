ALTER TABLE public.travellers ADD COLUMN IF NOT EXISTS phone_number TEXT;

ALTER TABLE public.travellers
  ADD CONSTRAINT travellers_phone_number_format
  CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{7,15}$');

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

ALTER TABLE public.trips
  ADD CONSTRAINT trips_phone_number_format
  CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{7,15}$') NOT VALID;
