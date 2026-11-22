create table if not exists public.road_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null check (lat between 14.8 and 15.9),
  lng double precision not null check (lng between 73.6 and 74.4),
  kind text not null check (kind in ('closure','flooding','roadworks','obstruction')),
  detail text not null check (length(trim(detail)) between 10 and 300),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);
create index if not exists road_reports_active on public.road_reports(status, expires_at);
alter table public.road_reports enable row level security;
revoke all on public.road_reports from anon, authenticated;
grant select on public.road_reports to authenticated;
grant insert (user_id,lat,lng,kind,detail) on public.road_reports to authenticated;
create policy road_reports_read on public.road_reports for select to authenticated
using (expires_at > now() and (status = 'approved' or user_id = auth.uid()));
create policy road_reports_submit on public.road_reports for insert to authenticated
with check (user_id = auth.uid() and status = 'pending');

-- A transaction lock makes the quota hold across processes and concurrent requests.
create or replace function public.limit_road_reports() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 25));
  if (select count(*) from public.road_reports where user_id = new.user_id
      and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Please wait before submitting another road report.' using errcode = 'P0001';
  end if;
  new.status := 'pending';
  new.created_at := now();
  new.expires_at := now() + interval '6 hours';
  return new;
end;
$$;
create trigger road_reports_quota before insert on public.road_reports
for each row execute function public.limit_road_reports();
