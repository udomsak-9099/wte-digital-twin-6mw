-- Predictive Maintenance alerts table
create table if not exists pm_alerts (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  equipment   text        not null,   -- turbine | boiler | transformer
  signal      text        not null,
  value       double precision,
  severity    text        not null,   -- warning | critical
  type        text        not null,   -- lstm_anomaly | limit
  message     text        not null,
  acknowledged boolean    not null default false,
  ack_at      timestamptz
);

-- Index for dashboard queries
create index if not exists idx_pm_created_at   on pm_alerts (created_at desc);
create index if not exists idx_pm_equipment    on pm_alerts (equipment);
create index if not exists idx_pm_severity     on pm_alerts (severity);
create index if not exists idx_pm_unacked      on pm_alerts (acknowledged) where acknowledged = false;

-- RLS
alter table pm_alerts enable row level security;

create policy "anon_read_pm"
  on pm_alerts for select using (true);

create policy "service_write_pm"
  on pm_alerts for insert
  with check (auth.role() = 'service_role');

create policy "service_ack_pm"
  on pm_alerts for update
  using (auth.role() = 'service_role');
