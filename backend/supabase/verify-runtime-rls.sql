-- Read-only metadata inspection. Empty anonymous reads do not prove RLS.
WITH expected(name) AS (VALUES
 ('profiles'), ('trips'), ('travellers'), ('safety_tags'), ('itineraries'),
 ('emergency_contacts'), ('safety_tag_scans'), ('saved_places'), ('saved_routes'),
 ('location_links'), ('blocked_numbers'), ('location_audit'), ('place_cache'), ('crowd_reports')
)
SELECT expected.name, c.oid IS NOT NULL AS exists, c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
FROM expected LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || expected.name);
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
SELECT relname, reloptions FROM pg_class WHERE oid = to_regclass('public.location_links_safe');
-- Also test authenticated user A cannot read/update user B's rows. Use disposable test accounts.
