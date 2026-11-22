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

-- 2. Deduplicate existing rows before creating unique index
DELETE FROM public.saved_places a
USING public.saved_places b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND lower(a.place_name) = lower(b.place_name);

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
