-- Migration 007: Electrical protection system
-- CB status, protection relay flags, transformer real-time monitoring

ALTER TABLE plant_telemetry

  -- ── Circuit Breaker Status (52 = AC CB, ANSI) ──────────────────────────
  ADD COLUMN IF NOT EXISTS cb_gen_closed      boolean,  -- 52G  Generator CB (True=Closed)
  ADD COLUMN IF NOT EXISTS cb_tx_hv_closed    boolean,  -- 52T  Transformer HV CB
  ADD COLUMN IF NOT EXISTS cb_ss_closed       boolean,  -- 52SS Station Service CB
  ADD COLUMN IF NOT EXISTS cb_f1_closed       boolean,  -- 52F1 Feeder 1 (APC/fans)
  ADD COLUMN IF NOT EXISTS cb_f2_closed       boolean,  -- 52F2 Feeder 2 (WW pumps)
  ADD COLUMN IF NOT EXISTS cb_f3_closed       boolean,  -- 52F3 Feeder 3 (cooling)
  ADD COLUMN IF NOT EXISTS cb_gen_spring      boolean,  -- 52G  spring charged
  ADD COLUMN IF NOT EXISTS cb_tx_hv_spring    boolean,  -- 52T  spring charged
  ADD COLUMN IF NOT EXISTS cb_gen_trips       int,      -- 52G  cumulative trip count
  ADD COLUMN IF NOT EXISTS cb_tx_hv_trips     int,      -- 52T  cumulative trip count

  -- ── Protection Relay Status (ANSI device numbers) ──────────────────────
  -- False=Normal, True=Pickup/Alarm/Trip
  ADD COLUMN IF NOT EXISTS relay_27_pu        boolean,  -- 27   Undervoltage (pickup)
  ADD COLUMN IF NOT EXISTS relay_59_pu        boolean,  -- 59   Overvoltage
  ADD COLUMN IF NOT EXISTS relay_81U_pu       boolean,  -- 81U  Underfrequency
  ADD COLUMN IF NOT EXISTS relay_81O_pu       boolean,  -- 81O  Overfrequency
  ADD COLUMN IF NOT EXISTS relay_51_pu        boolean,  -- 51   Time Overcurrent
  ADD COLUMN IF NOT EXISTS relay_50_pu        boolean,  -- 50   Instantaneous Overcurrent
  ADD COLUMN IF NOT EXISTS relay_87G_pu       boolean,  -- 87G  Generator Differential
  ADD COLUMN IF NOT EXISTS relay_87T_pu       boolean,  -- 87T  Transformer Differential
  ADD COLUMN IF NOT EXISTS relay_32_pu        boolean,  -- 32   Reverse Power
  ADD COLUMN IF NOT EXISTS relay_46_pu        boolean,  -- 46   Negative Sequence Overcurrent
  ADD COLUMN IF NOT EXISTS relay_40_pu        boolean,  -- 40   Loss of Excitation
  ADD COLUMN IF NOT EXISTS relay_64_pu        boolean,  -- 64   Ground Fault
  ADD COLUMN IF NOT EXISTS relay_49_pu        boolean,  -- 49   Machine Thermal (stator OT)

  -- Measured relay inputs (actual values feeding relay elements)
  ADD COLUMN IF NOT EXISTS relay_51_I1_A      float,    -- 51   Phase current I1 (A)
  ADD COLUMN IF NOT EXISTS relay_51_I2_A      float,    -- 51   Phase current I2
  ADD COLUMN IF NOT EXISTS relay_51_I3_A      float,    -- 51   Phase current I3
  ADD COLUMN IF NOT EXISTS relay_46_I2_pct    float,    -- 46   Negative sequence %
  ADD COLUMN IF NOT EXISTS relay_87G_diff_A   float,    -- 87G  Differential current (A)
  ADD COLUMN IF NOT EXISTS relay_87T_diff_A   float,    -- 87T  Differential current (A)

  -- ── Transformer Real-Time Monitoring ───────────────────────────────────
  ADD COLUMN IF NOT EXISTS tx_prim_voltage_kV  float,   -- kV   HV winding voltage
  ADD COLUMN IF NOT EXISTS tx_prim_current_A   float,   -- A    HV winding current
  ADD COLUMN IF NOT EXISTS tx_sec_voltage_kV   float,   -- kV   LV winding voltage
  ADD COLUMN IF NOT EXISTS tx_sec_current_A    float,   -- A    LV winding current
  ADD COLUMN IF NOT EXISTS tx_load_pct         float,   -- %    loading vs rated kVA
  ADD COLUMN IF NOT EXISTS tx_top_oil_temp     float,   -- °C   top oil temperature
  ADD COLUMN IF NOT EXISTS tx_winding_temp     float,   -- °C   winding hotspot (calculated)
  ADD COLUMN IF NOT EXISTS tx_ambient_temp     float,   -- °C   ambient temperature
  ADD COLUMN IF NOT EXISTS tx_tap_position     int,     -- -    OLTC tap (1-17 typical)
  ADD COLUMN IF NOT EXISTS tx_oil_level_pct    float,   -- %    conservator oil level
  ADD COLUMN IF NOT EXISTS tx_buchholz_alarm   boolean, -- -    Buchholz relay alarm
  ADD COLUMN IF NOT EXISTS tx_buchholz_trip    boolean, -- -    Buchholz relay trip
  ADD COLUMN IF NOT EXISTS tx_cool_fan1        boolean, -- -    cooling fan 1 running
  ADD COLUMN IF NOT EXISTS tx_cool_fan2        boolean, -- -    cooling fan 2 running
  ADD COLUMN IF NOT EXISTS tx_efficiency_pct   float;   -- %    transformer efficiency
