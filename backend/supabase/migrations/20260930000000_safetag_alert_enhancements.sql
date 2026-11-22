-- Migration: SafeTag Alert Enhancements & Fixes
-- 1. Add location, delivery status, and resolution columns to safety_tag_scans
ALTER TABLE public.safety_tag_scans
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 2. RLS policy to allow tag owners to update scan resolution status
DO $$ BEGIN
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
END $$;

-- 3. Re-create notify_safety_tag function as VOLATILE so INSERT statements succeed
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

GRANT EXECUTE ON FUNCTION public.notify_safety_tag(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) TO anon, authenticated, service_role;
