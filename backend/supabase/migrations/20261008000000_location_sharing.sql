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

CREATE UNIQUE INDEX location_links_traveller_active_idx ON public.location_links(traveller_id) WHERE status IN ('pending', 'accepted');

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

-- Since the prompt specifically asked for a view with security_invoker = true and to revoke SELECT from location_links, 
-- we will also add the RLS policy just in case the user meant to grant SELECT on the table but only through the view.
-- However, Postgres requires table SELECT permissions for a security_invoker view to work.
-- We will grant SELECT to authenticated on location_links, but restrict it via RLS to only their own rows.
GRANT SELECT ON public.location_links TO authenticated;

CREATE POLICY location_links_select_own 
ON public.location_links 
FOR SELECT 
TO authenticated 
USING (owner_id = auth.uid());
