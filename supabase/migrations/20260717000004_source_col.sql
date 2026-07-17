ALTER TABLE plant_telemetry
  ADD COLUMN IF NOT EXISTS source text default 'mock';
