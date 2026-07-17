-- Lab samples: manual laboratory results (not time-series telemetry)
-- sample_type controls which parameter set is expected in the data JSONB

CREATE TABLE IF NOT EXISTS lab_samples (
  id           bigserial primary key,
  sampled_at   timestamptz not null,
  entered_at   timestamptz not null default now(),
  sample_type  text not null,   -- see types below
  sample_ref   text,            -- lab reference / batch number
  entered_by   text,
  data         jsonb not null default '{}',
  notes        text,
  flagged      boolean default false  -- out-of-spec flag
);

-- sample_type values:
--   'fuel'         MSW proximate + ultimate + LHV
--   'raw_water'    raw intake water quality
--   'boiler_drum'  boiler drum water chemistry
--   'bfw'          boiler feed water / condensate
--   'cooling'      cooling tower water chemistry
--   'stack_manual' manual stack gas / spot check
--   'bottom_ash'   bottom ash TCLP / metals
--   'fly_ash'      fly ash heavy metals / dioxins
--   'effluent'     final wastewater effluent discharge

CREATE INDEX IF NOT EXISTS idx_lab_sample_type_time
  ON lab_samples (sample_type, sampled_at DESC);

ALTER TABLE lab_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read lab"
  ON lab_samples FOR SELECT USING (true);

CREATE POLICY "service insert lab"
  ON lab_samples FOR INSERT WITH CHECK (true);

CREATE POLICY "service update lab"
  ON lab_samples FOR UPDATE USING (true);
