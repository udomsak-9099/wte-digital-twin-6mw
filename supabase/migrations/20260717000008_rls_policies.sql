-- Row Level Security policies for WtE Digital Twin
-- ANON key: SELECT only (dashboard read)
-- SERVICE key: full access (poller + API write)

-- ── plant_telemetry ──────────────────────────────────────────────────────────
alter table plant_telemetry enable row level security;

-- anyone with anon key can read
create policy "anon_read_telemetry"
  on plant_telemetry for select
  using (true);

-- only service role can insert/update
create policy "service_write_telemetry"
  on plant_telemetry for insert
  with check (auth.role() = 'service_role');

-- ── lab_samples ──────────────────────────────────────────────────────────────
alter table lab_samples enable row level security;

create policy "anon_read_lab"
  on lab_samples for select
  using (true);

create policy "service_write_lab"
  on lab_samples for insert
  with check (auth.role() = 'service_role');

create policy "service_update_lab"
  on lab_samples for update
  using (auth.role() = 'service_role');

-- ── Index for time-series queries ────────────────────────────────────────────
create index if not exists idx_telemetry_created_at
  on plant_telemetry (created_at desc);

create index if not exists idx_lab_created_at
  on lab_samples (created_at desc);

create index if not exists idx_lab_type
  on lab_samples (sample_type);
