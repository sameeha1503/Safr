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
