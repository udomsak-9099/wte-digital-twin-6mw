import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type PlantTelemetry = {
  ts: string
  // L1 Combustion
  waste_feed_rate: number
  grate_speed: number
  bed_temp_z1: number
  bed_temp_z2: number
  bed_temp_z3: number
  bed_temp_z4: number
  furnace_temp_upper: number
  fgt_furnace: number
  furnace_press: number
  co_furnace: number
  pa_flow_z1: number
  pa_flow_z2: number
  pa_flow_z3: number
  pa_flow_z4: number
  pa_flow_total: number
  sa_flow: number
  o2_furnace: number
  // L2 Boiler
  fw_temp: number
  eco_out_temp: number
  drum_level: number
  fw_flow: number
  steam_press: number
  steam_temp: number
  steam_flow: number
  fgt_out: number
  attemp_spray_flow: number
  // L3 Turbine
  turbine_speed: number
  condenser_press: number
  hotwell_level: number
  cond_flow: number
  deaerator_level: number
  deaerator_press: number
  cw_in_temp: number
  cw_out_temp: number
  // L4 Electrical
  gen_mw: number
  aux_mw: number
  net_mw: number
  gen_pf: number
  gen_mvar: number
  gen_voltage: number
  gen_freq: number
  // L5 APC
  id_fan_speed: number
  pa_fan_speed: number
  sa_fan_speed: number
  bag_temp: number
  bag_dp: number
  scr_temp: number
  scr_nox_in: number
  scr_nox_out: number
  nh3_injection: number
  scrubber_ph: number
  lime_injection: number
  ac_injection: number
  stack_temp: number
  stack_flow: number
  pm_cems: number
  so2_cems: number
  hcl_cems: number
  co_cems: number
  // L6 Wastewater
  ww_leachate_flow: number
  ww_ph_in: number
  ww_cod_in: number
  ww_do_mbr: number
  ww_mlss_mbr: number
  ww_mbr_perm_flow: number
  ww_pc_ph: number
  ww_ro_press: number
  ww_ro_recovery: number
  ww_ro_perm_tds: number
  ww_brine_flow: number
  ww_evap_level: number
  ww_effluent_ph: number
  ww_effluent_cod: number
  // L7 Ash
  bottom_ash_rate: number
  fly_ash_rate: number
  ash_temp: number
  // DT computed
  dt_cycle_eff_pct: number
  dt_apc_pass: boolean
  dt_net_mw: number
  dt_revenue_thb: number
  source: string
}
