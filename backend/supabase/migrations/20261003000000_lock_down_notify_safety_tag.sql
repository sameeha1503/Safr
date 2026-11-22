REVOKE EXECUTE ON FUNCTION public.notify_safety_tag(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_safety_tag(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, JSONB) TO service_role;

DROP POLICY IF EXISTS "anyone can log a scan" ON public.safety_tag_scans;
REVOKE INSERT ON public.safety_tag_scans FROM anon;
