-- Migration: Add disable/re-enable support for safety_tags
-- 1. Add is_active and disabled_at columns to safety_tags
ALTER TABLE public.safety_tags
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

-- 2. Update check_safety_tag function to return actual is_active status
CREATE OR REPLACE FUNCTION public.check_safety_tag(_token TEXT)
RETURNS TABLE (
  tag_id UUID,
  category TEXT,
  is_active BOOLEAN
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.category, t.is_active
  FROM public.safety_tags t
  WHERE t.token = _token;
$$;

GRANT EXECUTE ON FUNCTION public.check_safety_tag(TEXT) TO anon, authenticated;

-- 3. Update notify_safety_tag to only process scans for active tags
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
  SELECT id, person_name, token INTO _tag FROM public.safety_tags WHERE token = _token AND is_active = true;
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
