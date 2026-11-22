-- Guardians were missing the base UPDATE privilege needed to resolve their own alerts.
grant update (is_resolved, resolved_at) on public.safety_tag_scans to authenticated;
