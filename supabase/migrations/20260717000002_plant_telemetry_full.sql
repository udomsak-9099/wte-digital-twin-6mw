-- Migration 002: add full plant loop signals
-- Loops: Combustion, Boiler, Rankine/Turbine, Electrical, APC/CEMS, Wastewater, Ash

ALTER TABLE plant_telemetry

  -- Loop 1: Combustion & Grate (new columns)
  ADD COLUMN IF NOT EXISTS waste_feed_rate    float,  -- t/h  MSW feed rate
  ADD COLUMN IF NOT EXISTS furnace_temp_upper float,  -- °C   upper furnace / 2nd combustion chamber
  ADD COLUMN IF NOT EXISTS furnace_press      float,  -- Pa   furnace draft (negative)
  ADD COLUMN IF NOT EXISTS co_furnace         float,  -- mg/Nm³ CO in furnace
  ADD COLUMN IF NOT EXISTS fgt_furnace        float,  -- °C   furnace outlet flue gas temp
  ADD COLUMN IF NOT EXISTS pa_flow_total      float,  -- Nm³/h total primary air

  -- Loop 2: Boiler & Steam (new columns)
  ADD COLUMN IF NOT EXISTS drum_level         float,  -- mm   boiler drum water level
  ADD COLUMN IF NOT EXISTS fw_flow            float,  -- t/h  feedwater flow
  ADD COLUMN IF NOT EXISTS fw_temp            float,  -- °C   feedwater inlet temperature
  ADD COLUMN IF NOT EXISTS eco_out_temp       float,  -- °C   economizer outlet water temp
  ADD COLUMN IF NOT EXISTS attemp_spray_flow  float,  -- t/h  attemperator spray water

  -- Loop 3: Turbine & Rankine (new columns)
  ADD COLUMN IF NOT EXISTS turbine_speed      float,  -- rpm  turbine rotor speed
  ADD COLUMN IF NOT EXISTS condenser_press    float,  -- mbar absolute (vacuum)
  ADD COLUMN IF NOT EXISTS hotwell_level      float,  -- mm   condenser hotwell level
  ADD COLUMN IF NOT EXISTS cond_flow          float,  -- t/h  condensate flow
  ADD COLUMN IF NOT EXISTS deaerator_level    float,  -- mm   deaerator water level
  ADD COLUMN IF NOT EXISTS deaerator_press    float,  -- bar  deaerator pressure
  ADD COLUMN IF NOT EXISTS cw_in_temp         float,  -- °C   cooling water inlet
  ADD COLUMN IF NOT EXISTS cw_out_temp        float,  -- °C   cooling water outlet

  -- Loop 4: Electrical (new columns)
  ADD COLUMN IF NOT EXISTS gen_mvar           float,  -- MVAR reactive power
  ADD COLUMN IF NOT EXISTS gen_pf             float,  -- pu   power factor
  ADD COLUMN IF NOT EXISTS gen_voltage        float,  -- kV   generator terminal voltage
  ADD COLUMN IF NOT EXISTS gen_freq           float,  -- Hz   grid frequency
  ADD COLUMN IF NOT EXISTS aux_mw             float,  -- MW   auxiliary consumption
  ADD COLUMN IF NOT EXISTS net_mw             float,  -- MW   net export power

  -- Loop 5: APC / CEMS (new columns)
  ADD COLUMN IF NOT EXISTS id_fan_speed       float,  -- %    induced draft fan VFD
  ADD COLUMN IF NOT EXISTS pa_fan_speed       float,  -- %    primary air fan VFD
  ADD COLUMN IF NOT EXISTS sa_fan_speed       float,  -- %    secondary air fan VFD
  ADD COLUMN IF NOT EXISTS bag_temp           float,  -- °C   bag filter inlet gas temp
  ADD COLUMN IF NOT EXISTS scr_temp           float,  -- °C   SCR operating temperature
  ADD COLUMN IF NOT EXISTS nh3_injection      float,  -- kg/h urea/ammonia dosing
  ADD COLUMN IF NOT EXISTS lime_injection     float,  -- kg/h lime slurry injection
  ADD COLUMN IF NOT EXISTS ac_injection       float,  -- kg/h activated carbon injection
  ADD COLUMN IF NOT EXISTS stack_temp         float,  -- °C   stack exit temperature
  ADD COLUMN IF NOT EXISTS stack_flow         float,  -- kNm³/h normalized stack gas flow
  ADD COLUMN IF NOT EXISTS pm_cems            float,  -- mg/Nm³ PM at stack
  ADD COLUMN IF NOT EXISTS so2_cems           float,  -- mg/Nm³ SO2 at stack
  ADD COLUMN IF NOT EXISTS hcl_cems           float,  -- mg/Nm³ HCl at stack
  ADD COLUMN IF NOT EXISTS co_cems            float,  -- mg/Nm³ CO at stack

  -- Loop 6: Wastewater (new columns)
  ADD COLUMN IF NOT EXISTS ww_ph_in           float,  -- pH   raw leachate pH
  ADD COLUMN IF NOT EXISTS ww_cod_in          float,  -- mg/L raw leachate COD
  ADD COLUMN IF NOT EXISTS ww_do_mbr          float,  -- mg/L MBR dissolved oxygen
  ADD COLUMN IF NOT EXISTS ww_mlss_mbr        float,  -- mg/L MBR mixed liquor suspended solids
  ADD COLUMN IF NOT EXISTS ww_pc_ph           float,  -- pH   physical-chemical effluent pH
  ADD COLUMN IF NOT EXISTS ww_ro_press        float,  -- bar  RO feed pressure
  ADD COLUMN IF NOT EXISTS ww_ro_perm_tds     float,  -- mg/L RO permeate TDS
  ADD COLUMN IF NOT EXISTS ww_brine_flow      float,  -- m³/h RO concentrate / ZLD brine
  ADD COLUMN IF NOT EXISTS ww_evap_level      float,  -- %    ZLD evaporator level
  ADD COLUMN IF NOT EXISTS ww_effluent_ph     float,  -- pH   final effluent pH
  ADD COLUMN IF NOT EXISTS ww_effluent_cod    float,  -- mg/L final effluent COD

  -- Loop 7: Ash Handling (new columns)
  ADD COLUMN IF NOT EXISTS bottom_ash_rate    float,  -- t/h  bottom ash conveyor rate
  ADD COLUMN IF NOT EXISTS fly_ash_rate       float,  -- t/h  fly ash rate (bag filter)
  ADD COLUMN IF NOT EXISTS ash_temp           float;  -- °C   bottom ash quench temperature
