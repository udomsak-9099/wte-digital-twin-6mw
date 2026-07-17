ALTER TABLE plant_telemetry
  ADD COLUMN IF NOT EXISTS dt_net_mw      float,
  ADD COLUMN IF NOT EXISTS dt_revenue_thb float;
