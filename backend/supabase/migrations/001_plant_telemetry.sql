-- Migration 001: Plant telemetry time-series table
-- WtE Digital Twin 6.6 MW — Ovation DCS tags

CREATE EXTENSION IF NOT EXISTS timescaledb;  -- optional: use if Supabase supports it

CREATE TABLE IF NOT EXISTS plant_telemetry (
    ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Grate control
    grate_speed     FLOAT,          -- m/h
    bed_depth       FLOAT,          -- mm
    bed_temp_z1     FLOAT,          -- degC Zone 1 Drying
    bed_temp_z2     FLOAT,          -- degC Zone 2 Devolatilization
    bed_temp_z3     FLOAT,          -- degC Zone 3 Combustion
    bed_temp_z4     FLOAT,          -- degC Zone 4 Burnout

    -- Combustion air
    pa_flow_total   FLOAT,          -- Nm3/h
    pa_flow_z1      FLOAT,
    pa_flow_z2      FLOAT,
    pa_flow_z3      FLOAT,
    pa_flow_z4      FLOAT,
    sa_flow         FLOAT,          -- Nm3/h secondary air
    o2_furnace      FLOAT,          -- vol%

    -- Boiler / Steam
    steam_press     FLOAT,          -- bar
    steam_temp      FLOAT,          -- degC
    steam_flow      FLOAT,          -- t/h
    fgt_furnace     FLOAT,          -- degC furnace exit
    fgt_out         FLOAT,          -- degC economizer outlet

    -- Generator
    gen_mw          FLOAT,          -- MW net
    gen_mvar        FLOAT,
    gen_freq        FLOAT,          -- Hz

    -- APC
    bag_dp          FLOAT,          -- mbar
    scr_temp        FLOAT,          -- degC
    scr_nox_in      FLOAT,          -- mg/Nm3
    scr_nox_out     FLOAT,
    scrubber_ph     FLOAT,

    -- Wastewater
    ww_leachate_flow    FLOAT,      -- m3/h
    ww_mbr_perm_flow    FLOAT,
    ww_ro_recovery      FLOAT,      -- percent

    -- Digital Twin computed (written back from MATLAB)
    dt_thermal_mw       FLOAT,
    dt_cycle_eff_pct    FLOAT,
    dt_apc_pass         BOOLEAN,
    dt_ww_recovery_pct  FLOAT
);

-- Index for fast time-range queries
CREATE INDEX idx_plant_telemetry_ts ON plant_telemetry (ts DESC);

-- Row-level security
ALTER TABLE plant_telemetry ENABLE ROW LEVEL SECURITY;

-- View: latest snapshot
CREATE OR REPLACE VIEW plant_latest AS
SELECT DISTINCT ON (1) *
FROM plant_telemetry
ORDER BY ts DESC;

-- View: hourly averages
CREATE OR REPLACE VIEW plant_hourly AS
SELECT
    date_trunc('hour', ts) AS hour,
    AVG(gen_mw)         AS avg_gen_mw,
    AVG(steam_press)    AS avg_steam_press,
    AVG(steam_temp)     AS avg_steam_temp,
    AVG(grate_speed)    AS avg_grate_speed,
    AVG(o2_furnace)     AS avg_o2,
    AVG(scr_nox_out)    AS avg_nox_out,
    AVG(dt_cycle_eff_pct) AS avg_cycle_eff
FROM plant_telemetry
GROUP BY 1
ORDER BY 1 DESC;
