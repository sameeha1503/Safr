# Map operation and verification

The map now includes in-app turn guidance, route progress and estimated arrival, GPS filtering and route snapping, a draggable mobile planner, a high-contrast controls toggle, road evidence coverage, offline directions downloads, destination coordinate adjustment, focused transport/essentials filters, and expiring community road reports.

## Deployment

Apply `backend/supabase/migrations/20261025000000_road_reports.sql` in the Supabase SQL Editor before enabling reports. No new environment variables are needed. Without the table the report panel shows an unavailable state without breaking routing.

Reports are authenticated, limited to three per user per hour at database level, private until reviewed, and expire six hours after submission. Only a trusted operator using the SQL Editor or service role may approve or reject them. No client role has update access. Review the description and verify the location before approving; do not treat a visitor statement as an official closure.

```sql
select id, kind, detail, lat, lng, created_at, expires_at
from public.road_reports
where status = 'pending' and expires_at > now()
order by created_at;

-- Replace the UUID with the reviewed record. Use 'rejected' to reject it.
update public.road_reports set status = 'approved'
where id = '00000000-0000-0000-0000-000000000000'
and status = 'pending' and expires_at > now();
```

## Data and limitations

- Safety coverage means available OpenStreetMap tags. It is not a probability of safety, crime feed, live traffic feed, or official warning.
- Transport/essentials pins use the bundled OSM catalogue. Missing or unnamed facilities may not appear. No ferry timetable or service status is inferred.
- An adjusted pin is user-selected, not a verified entrance. Check access locally.
- Offline downloads are self-contained HTML directions and emergency contacts. They do not download tiles or support offline rerouting. Open the saved file before departure. Private travel files must be deleted by the user when no longer needed.
- The service worker no longer saves authenticated HTML. Upgrading removes old Safr caches. Static assets and the generic offline page remain cacheable.
- Navigation requires foreground browser GPS. Estimated arrival uses the original route duration, not live traffic. GPS at intersections or parallel roads can be ambiguous. Background navigation and voice guidance are not provided.
- Walking/cycling/scooter routes never silently fall back to a car route. Provider failures show an error.

## Manual verification

Test GPS permission granted/denied, weak GPS, repeated off-route movement, arrival, waypoint progress, and reroute failure on real Android/iOS devices. Verify switching destination/mode stops navigation. Test screen-reader controls, keyboard-only coordinate entry, mobile sheet drag/cancel, high contrast, and downloaded directions in airplane mode. After applying the migration, use two accounts to confirm pending reports are private, approved reports visible, expiry enforced and fourth submission within an hour rejected. No automated test should contact external APIs.
