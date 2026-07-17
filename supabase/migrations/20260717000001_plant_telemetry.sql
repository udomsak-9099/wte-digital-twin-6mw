-- WtE Digital Twin 6.6 MW — plant_telemetry table
-- Paste ทั้งหมดนี้ใน Supabase SQL Editor แล้วกด Run

CREATE TABLE IF NOT EXISTS plant_telemetry (
    ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    grate_speed     FLOAT,
    bed_depth       FLOAT,
    bed_temp_z1     FLOAT,
    bed_temp_z2     FLOAT,
    bed_temp_z3     FLOAT,
    bed_temp_z4     FLOAT,
    pa_flow_total   FLOAT,
    pa_flow_z1      FLOAT,
    pa_flow_z2      FLOAT,
    pa_flow_z3      FLOAT,
    pa_flow_z4      FLOAT,
    sa_flow         FLOAT,
    o2_furnace      FLOAT,
    steam_press     FLOAT,
    steam_temp      FLOAT,
    steam_flow      FLOAT,
    fgt_furnace     FLOAT,
    fgt_out         FLOAT,
    gen_mw          FLOAT,
    gen_mvar        FLOAT,
    gen_freq        FLOAT,
    bag_dp          FLOAT,
    scr_temp        FLOAT,
    scr_nox_in      FLOAT,
    scr_nox_out     FLOAT,
    scrubber_ph     FLOAT,
    ww_leachate_flow    FLOAT,
    ww_mbr_perm_flow    FLOAT,
    ww_ro_recovery      FLOAT,
    dt_thermal_mw       FLOAT,
    dt_cycle_eff_pct    FLOAT,
    dt_apc_pass         BOOLEAN,
    dt_ww_recovery_pct  FLOAT
);

CREATE INDEX IF NOT EXISTS idx_plant_telemetry_ts ON plant_telemetry (ts DESC);

ALTER TABLE plant_telemetry ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW plant_latest AS
SELECT DISTINCT ON (1) * FROM plant_telemetry ORDER BY ts DESC;

CREATE OR REPLACE VIEW plant_hourly AS
SELECT
    date_trunc('hour', ts) AS hour,
    AVG(gen_mw)            AS avg_gen_mw,
    AVG(steam_press)       AS avg_steam_press,
    AVG(steam_temp)        AS avg_steam_temp,
    AVG(grate_speed)       AS avg_grate_speed,
    AVG(o2_furnace)        AS avg_o2,
    AVG(scr_nox_out)       AS avg_nox_out,
    AVG(dt_cycle_eff_pct)  AS avg_cycle_eff
FROM plant_telemetry
GROUP BY 1
ORDER BY 1 DESC;
