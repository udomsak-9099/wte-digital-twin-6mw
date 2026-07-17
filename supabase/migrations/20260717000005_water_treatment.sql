-- Migration 005: Make-up water treatment loop
-- Raw Water → Clarifier → Sand Filter → UF → RO → EDI → BFW tank / Cooling Tower

ALTER TABLE plant_telemetry

  -- Raw Water Intake
  ADD COLUMN IF NOT EXISTS mw_raw_flow         float,  -- m³/h  raw water flow
  ADD COLUMN IF NOT EXISTS mw_raw_turbidity    float,  -- NTU   raw water turbidity
  ADD COLUMN IF NOT EXISTS mw_raw_tds          float,  -- mg/L  raw water TDS
  ADD COLUMN IF NOT EXISTS mw_raw_ph           float,  -- pH

  -- Clarifier + Sand Filter
  ADD COLUMN IF NOT EXISTS mw_clf_level        float,  -- m     clarifier water level
  ADD COLUMN IF NOT EXISTS mw_sf_dp            float,  -- kPa   sand filter ΔP
  ADD COLUMN IF NOT EXISTS mw_sf_turbidity     float,  -- NTU   sand filter outlet turbidity

  -- UF (Ultrafiltration)
  ADD COLUMN IF NOT EXISTS mw_uf_feed_press    float,  -- bar   UF feed pressure
  ADD COLUMN IF NOT EXISTS mw_uf_tmp           float,  -- bar   transmembrane pressure
  ADD COLUMN IF NOT EXISTS mw_uf_perm_flow     float,  -- m³/h  UF permeate flow
  ADD COLUMN IF NOT EXISTS mw_uf_turbidity     float,  -- NTU   UF permeate turbidity (SDI proxy)

  -- RO (Reverse Osmosis) — boiler make-up
  ADD COLUMN IF NOT EXISTS mw_ro_feed_press    float,  -- bar   RO feed pressure
  ADD COLUMN IF NOT EXISTS mw_ro_perm_flow     float,  -- m³/h  RO permeate flow
  ADD COLUMN IF NOT EXISTS mw_ro_recovery      float,  -- %     RO recovery
  ADD COLUMN IF NOT EXISTS mw_ro_conductivity  float,  -- µS/cm RO permeate conductivity
  ADD COLUMN IF NOT EXISTS mw_ro_brine_flow    float,  -- m³/h  RO concentrate

  -- EDI (Electrodeionization)
  ADD COLUMN IF NOT EXISTS mw_edi_feed_cond    float,  -- µS/cm EDI feed conductivity
  ADD COLUMN IF NOT EXISTS mw_edi_prod_cond    float,  -- µS/cm EDI product conductivity (target <0.1)
  ADD COLUMN IF NOT EXISTS mw_edi_prod_flow    float,  -- m³/h  EDI product flow
  ADD COLUMN IF NOT EXISTS mw_edi_current      float,  -- A     EDI DC current

  -- DI Water Storage → Boiler Feed Water
  ADD COLUMN IF NOT EXISTS mw_di_tank_level    float,  -- %     DI tank level
  ADD COLUMN IF NOT EXISTS mw_bfw_tank_level   float,  -- %     BFW storage tank level
  ADD COLUMN IF NOT EXISTS mw_bfw_conductivity float,  -- µS/cm BFW conductivity
  ADD COLUMN IF NOT EXISTS mw_bfw_ph           float,  -- pH    BFW pH (dosing control)
  ADD COLUMN IF NOT EXISTS mw_bfw_do           float,  -- ppb   BFW dissolved oxygen
  ADD COLUMN IF NOT EXISTS mw_bfw_silica       float,  -- ppb   BFW silica

  -- Cooling Tower
  ADD COLUMN IF NOT EXISTS ct_makeup_flow      float,  -- m³/h  CT make-up water flow
  ADD COLUMN IF NOT EXISTS ct_basin_level      float,  -- m     CT basin water level
  ADD COLUMN IF NOT EXISTS ct_blowdown         float,  -- m³/h  CT blowdown flow
  ADD COLUMN IF NOT EXISTS ct_coc              float,  -- -     cycles of concentration
  ADD COLUMN IF NOT EXISTS ct_approach_temp    float,  -- °C    CT approach temperature
  ADD COLUMN IF NOT EXISTS ct_range_temp       float;  -- °C    CT range (hot-cold ΔT)
