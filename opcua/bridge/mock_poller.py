"""
mock_poller.py — Simulates Ovation DCS data for all plant control loops
Replaces opcua_poller.py until the real plant OPC-UA IP is available.

Loops covered:
  L1  Combustion & Grate      (7 zones, air splits, CO, draft)
  L2  Boiler & Steam          (drum level, feedwater, attemperator)
  L3  Turbine & Rankine       (speed, condenser, deaerator, cooling water)
  L4  Electrical              (MW, MVAR, PF, voltage, frequency, net export)
  L5  APC / CEMS              (fans, bag filter, SCR, scrubber, stack CEMS)
  L6  Wastewater Treatment    (leachate, MBR, PC, RO, ZLD, effluent)
  L7  Ash Handling            (bottom ash, fly ash, quench temp)

Usage:
    cd <project_root>
    .venv/bin/python opcua/bridge/mock_poller.py
"""

import asyncio
import math
import random
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent.parent / "config" / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_S", "5"))

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

t = 0  # elapsed seconds


def noise(scale=1.0) -> float:
    return random.gauss(0, scale)


def simulate_plant(t: int) -> dict:
    # Daily sinusoidal load variation ±8% over 24 h
    day = math.sin(2 * math.pi * t / 86400)
    hour = math.sin(2 * math.pi * t / 3600)
    half_hour = math.sin(2 * math.pi * t / 1800)

    # ── L1 Combustion & Grate ─────────────────────────────────────────────
    waste_feed_rate    = 3.2 + 0.25 * day + noise(0.04)       # t/h MSW
    grate_speed        = 3.0 + 0.4 * hour + noise(0.05)       # m/h
    bed_temp_z1        = 295 + 15 * day + noise(3)             # °C Drying
    bed_temp_z2        = 640 + 20 * day + noise(5)             # °C Devolatilization
    bed_temp_z3        = 940 + 25 * day + noise(8)             # °C Combustion
    bed_temp_z4        = 740 + 15 * day + noise(5)             # °C Burnout
    furnace_temp_upper = 920 + 18 * day + noise(6)             # °C 2nd combustion chamber
    fgt_furnace        = 945 + 20 * day + noise(5)             # °C furnace exit FG
    furnace_press      = -80 + 5 * day + noise(2)              # Pa draft (negative)
    co_furnace         = 55 + 15 * day + noise(5)              # mg/Nm³ CO
    pa_total           = 18500 + 1200 * day + noise(50)        # Nm³/h total PA
    pa_flow_z1         = pa_total * 0.15
    pa_flow_z2         = pa_total * 0.20
    pa_flow_z3         = pa_total * 0.45
    pa_flow_z4         = pa_total * 0.20
    sa_flow            = 12000 + 800 * day + noise(30)         # Nm³/h SA
    o2_furnace         = 9.2 - 0.8 * day + noise(0.2)         # % O2

    # ── L2 Boiler & Steam ─────────────────────────────────────────────────
    fw_temp           = 105 + 3 * day + noise(0.5)             # °C feedwater inlet
    eco_out_temp      = 215 + 5 * day + noise(1)               # °C economizer outlet
    drum_level        = 0 + 8 * half_hour + noise(2)           # mm deviation from NWL
    fw_flow           = 28.2 + 1.5 * day + noise(0.2)          # t/h feedwater
    steam_press       = 39.5 + 1.2 * day + noise(0.15)         # bar
    steam_temp        = 398 + 4 * day + noise(1.0)             # °C
    steam_flow        = 27.5 + 1.5 * day + noise(0.2)          # t/h
    fgt_out           = 178 + 5 * day + noise(2)               # °C economizer exit FG
    attemp_spray_flow = 0.8 + 0.3 * day + noise(0.05)          # t/h attemperator spray

    # ── L3 Turbine & Rankine ──────────────────────────────────────────────
    turbine_speed   = 3000 + noise(0.5)                        # rpm (50 Hz, 2-pole)
    condenser_press = 80 + 5 * day + noise(1.5)                # mbar absolute
    hotwell_level   = 450 + 20 * half_hour + noise(5)          # mm
    cond_flow       = 26.8 + 1.4 * day + noise(0.2)            # t/h condensate
    deaerator_level = 800 + 30 * hour + noise(8)               # mm
    deaerator_press = 1.2 + 0.05 * day + noise(0.02)           # bar
    cw_in_temp      = 32 + 3 * day + noise(0.3)                # °C cooling water in
    cw_out_temp     = cw_in_temp + 8.5 + 0.5 * day + noise(0.2)  # °C cooling water out

    # ── L4 Electrical ─────────────────────────────────────────────────────
    gen_mw      = max(0, 6.3 + 0.5 * day + noise(0.05))       # MW gross
    aux_mw      = 0.35 + 0.02 * day + noise(0.005)            # MW auxiliary
    net_mw      = max(0, gen_mw - aux_mw)                     # MW net export
    gen_pf      = 0.92 + 0.02 * day + noise(0.003)            # power factor
    gen_mvar    = gen_mw * math.tan(math.acos(max(0.01, min(0.999, gen_pf)))) + noise(0.02)
    gen_voltage = 11.0 + 0.05 * day + noise(0.01)             # kV terminal
    gen_freq    = 50.0 + noise(0.01)                          # Hz

    # ── L4b Electrical Protection System ──────────────────────────────────
    # CB status — all normally closed during operation
    cb_gen_closed   = True
    cb_tx_hv_closed = True
    cb_ss_closed    = True
    cb_f1_closed    = True
    cb_f2_closed    = True
    cb_f3_closed    = True
    cb_gen_spring   = True
    cb_tx_hv_spring = True
    cb_gen_trips    = 3      # cumulative since commissioning
    cb_tx_hv_trips  = 1

    # Phase currents (A) — generator rated ~330 A at 11 kV, 6.6 MW, 0.92 pf
    rated_I = gen_mw * 1e6 / (math.sqrt(3) * gen_voltage * 1e3 * gen_pf)
    I1 = rated_I + noise(0.5)
    I2 = rated_I + noise(0.5)
    I3 = rated_I + noise(0.5)
    I2_neg_seq_pct = abs(noise(0.3)) + 0.5   # % negative sequence (should be <1%)
    diff_G = abs(noise(0.05))                 # A differential current (should be ~0)
    diff_T = abs(noise(0.04))

    # Relay status — all normal (False = no pickup)
    relay_27_pu  = gen_voltage < 9.5
    relay_59_pu  = gen_voltage > 12.5
    relay_81U_pu = gen_freq < 49.0
    relay_81O_pu = gen_freq > 51.0
    relay_51_pu  = max(I1, I2, I3) > 400
    relay_50_pu  = max(I1, I2, I3) > 600
    relay_87G_pu = diff_G > 0.5
    relay_87T_pu = diff_T > 0.5
    relay_32_pu  = gen_mw < 0
    relay_46_pu  = I2_neg_seq_pct > 3.0
    relay_40_pu  = gen_mvar < -0.5
    relay_64_pu  = False
    relay_49_pu  = False

    # Transformer monitoring (11 kV / 22 kV GSU, 10 MVA rated)
    tx_load_pct       = gen_mw / 10.0 * 100 + noise(0.3)      # % of 10 MVA
    tx_prim_voltage   = gen_voltage                            # kV (LV side = generator)
    tx_prim_current   = rated_I + noise(0.3)                   # A LV winding
    tx_sec_voltage    = 22.0 * (1 + 0.01 * day) + noise(0.05) # kV HV side (grid)
    tx_sec_current    = tx_prim_current * (gen_voltage / 22.0) # A HV winding (approx)
    tx_top_oil_temp   = 55 + 15 * (tx_load_pct/100) + day * 5 + noise(0.5)
    tx_winding_temp   = tx_top_oil_temp + 25 * (tx_load_pct/100)**2 + noise(0.5)
    tx_ambient_temp   = 33 + 3 * day + noise(0.3)
    tx_tap_position   = 9   # center tap (1-17), adjusted by OLTC
    tx_oil_level_pct  = 78 + 2 * day + noise(0.5)
    tx_buchholz_alarm = False
    tx_buchholz_trip  = False
    tx_cool_fan1      = tx_top_oil_temp > 65
    tx_cool_fan2      = tx_top_oil_temp > 75
    tx_efficiency_pct = 99.2 - 0.05 * (tx_load_pct/100)**2 + noise(0.01)

    # ── L5 APC / CEMS ────────────────────────────────────────────────────
    id_fan_speed    = 72 + 5 * day + noise(0.5)               # %
    pa_fan_speed    = 65 + 4 * day + noise(0.4)               # %
    sa_fan_speed    = 55 + 3 * day + noise(0.3)               # %
    bag_temp        = 155 + 5 * day + noise(1.5)              # °C bag filter inlet
    bag_dp          = 14.5 + 2 * math.sin(2 * math.pi * t / 7200) + noise(0.3)  # mbar (cleaning cycle)
    scr_temp        = 220 + 5 * day + noise(2)                # °C SCR reactor
    scr_nox_in      = 345 + 20 * day + noise(5)               # mg/Nm³
    scr_nox_out     = scr_nox_in * 0.15 + noise(2)            # mg/Nm³ (85% removal)
    nh3_injection   = scr_nox_in * 0.0018 + noise(0.0003)     # kg/h urea equiv
    scrubber_ph     = 7.2 + 0.3 * half_hour + noise(0.05)     # pH
    lime_injection  = 12 + 2 * day + noise(0.3)               # kg/h
    ac_injection    = 2.5 + 0.3 * day + noise(0.05)           # kg/h activated carbon
    stack_temp      = 68 + 4 * day + noise(1)                 # °C stack exit
    stack_flow      = 42 + 3 * day + noise(0.5)               # kNm³/h
    pm_cems         = 4.5 + 1 * day + noise(0.3)              # mg/Nm³ (limit 20)
    so2_cems        = 18 + 4 * day + noise(1)                 # mg/Nm³ (limit 50)
    hcl_cems        = 12 + 3 * day + noise(0.8)               # mg/Nm³ (limit 50)
    co_cems         = 38 + 8 * day + noise(2)                 # mg/Nm³ (limit 100)

    # ── L6 Wastewater Treatment ───────────────────────────────────────────
    ww_leachate_flow  = 5.0 + 0.5 * day + noise(0.1)          # m³/h
    ww_ph_in          = 8.5 + 0.5 * day + noise(0.1)          # pH raw leachate
    ww_cod_in         = 4200 + 300 * day + noise(50)           # mg/L raw COD
    ww_do_mbr         = 2.8 + 0.4 * day + noise(0.05)         # mg/L dissolved O2
    ww_mlss_mbr       = 8500 + 300 * day + noise(100)          # mg/L MLSS
    ww_mbr_perm_flow  = 4.2 + 0.4 * day + noise(0.08)         # m³/h
    ww_pc_ph          = 7.0 + 0.2 * day + noise(0.05)         # pH after PC
    ww_ro_press       = 12 + 0.5 * day + noise(0.1)           # bar RO feed
    ww_ro_recovery    = 90.5 + 1.5 * day + noise(0.2)         # %
    ww_ro_perm_tds    = 45 + 5 * day + noise(1)               # mg/L permeate TDS
    ww_brine_flow     = ww_mbr_perm_flow * (1 - ww_ro_recovery / 100)
    ww_evap_level     = 55 + 10 * half_hour + noise(1)        # % ZLD evaporator
    ww_effluent_ph    = 7.2 + 0.1 * day + noise(0.03)         # pH final effluent
    ww_effluent_cod   = 28 + 5 * day + noise(1.5)             # mg/L final COD

    # ── L7 Ash Handling ───────────────────────────────────────────────────
    bottom_ash_rate = waste_feed_rate * 0.20 + noise(0.02)    # t/h (~20% of feed)
    fly_ash_rate    = waste_feed_rate * 0.04 + noise(0.005)   # t/h (~4% collected in bag filter)
    ash_temp        = 65 + 10 * day + noise(2)                # °C quenched bottom ash

    # ── L8 Make-up Water Treatment (Raw → UF → RO → EDI → BFW / CT) ─────
    mw_raw_flow      = 12.0 + 1.5 * day + noise(0.2)          # m³/h raw intake
    mw_raw_turbidity = 18 + 8 * day + noise(1.5)              # NTU
    mw_raw_tds       = 380 + 30 * day + noise(5)              # mg/L
    mw_raw_ph        = 7.4 + 0.3 * day + noise(0.05)          # pH

    mw_clf_level     = 2.8 + 0.2 * half_hour + noise(0.05)    # m clarifier level
    mw_sf_dp         = 25 + 8 * math.sin(2*math.pi*t/10800) + noise(0.5)  # kPa sand filter ΔP
    mw_sf_turbidity  = 1.2 + 0.3 * day + noise(0.1)           # NTU post-sand filter

    mw_uf_feed_press = 1.8 + 0.1 * day + noise(0.02)          # bar UF feed
    mw_uf_tmp        = 0.35 + 0.05 * day + noise(0.005)       # bar TMP
    mw_uf_perm_flow  = 10.5 + 1.0 * day + noise(0.15)         # m³/h UF permeate
    mw_uf_turbidity  = 0.08 + 0.02 * day + noise(0.005)       # NTU (SDI <3 for RO)

    mw_ro_feed_press = 12.5 + 0.5 * day + noise(0.1)          # bar RO HP pump
    mw_ro_perm_flow  = 7.5 + 0.6 * day + noise(0.1)           # m³/h
    mw_ro_recovery   = 72 + 2 * day + noise(0.3)              # %
    mw_ro_conductivity = 28 + 5 * day + noise(0.8)            # µS/cm permeate
    mw_ro_brine_flow = mw_uf_perm_flow * (1 - mw_ro_recovery/100)

    mw_edi_feed_cond = mw_ro_conductivity + noise(0.5)         # µS/cm (same as RO permeate)
    mw_edi_prod_cond = 0.055 + 0.01 * day + noise(0.003)      # µS/cm (target <0.1 µS/cm)
    mw_edi_prod_flow = mw_ro_perm_flow * 0.90 + noise(0.05)   # m³/h (~90% of RO permeate)
    mw_edi_current   = 3.8 + 0.3 * day + noise(0.05)          # A DC current

    mw_di_tank_level  = 72 + 12 * half_hour + noise(1.5)      # % DI storage tank
    mw_bfw_tank_level = 65 + 10 * hour + noise(1.2)           # % BFW tank
    mw_bfw_conductivity = 0.8 + 0.1 * day + noise(0.02)       # µS/cm (after chemical dosing)
    mw_bfw_ph         = 9.2 + 0.1 * day + noise(0.02)         # pH (ammonia dosing)
    mw_bfw_do         = 7 + 2 * day + noise(0.5)              # ppb dissolved O2 (after deaerator)
    mw_bfw_silica     = 15 + 3 * day + noise(0.5)             # ppb silica

    ct_makeup_flow   = 3.5 + 0.4 * day + noise(0.08)          # m³/h CT make-up
    ct_basin_level   = 2.2 + 0.15 * half_hour + noise(0.03)   # m CT basin level
    ct_blowdown      = 0.35 + 0.05 * day + noise(0.01)        # m³/h blowdown
    ct_coc           = ct_makeup_flow / max(ct_blowdown, 0.1)  # cycles of concentration
    ct_approach_temp = 5.5 + 1.0 * day + noise(0.2)           # °C approach (cold water - wet bulb)
    ct_range_temp    = cw_out_temp - cw_in_temp                # °C hot-cold ΔT

    # ── DT Computed ───────────────────────────────────────────────────────
    dt_cycle_eff_pct = net_mw / (waste_feed_rate * 1800 / 860) * 100  # thermal → electric
    dt_apc_pass = (
        scr_nox_out < 200 and pm_cems < 20 and so2_cems < 50
        and hcl_cems < 50 and co_cems < 100 and bag_dp < 25
    )
    dt_revenue_thb = net_mw * 4.24 * 1000  # THB/hr (4.24 THB/kWh VSPP)

    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        # L1 Combustion
        "waste_feed_rate":    round(waste_feed_rate, 3),
        "grate_speed":        round(grate_speed, 3),
        "bed_temp_z1":        round(bed_temp_z1, 1),
        "bed_temp_z2":        round(bed_temp_z2, 1),
        "bed_temp_z3":        round(bed_temp_z3, 1),
        "bed_temp_z4":        round(bed_temp_z4, 1),
        "furnace_temp_upper": round(furnace_temp_upper, 1),
        "fgt_furnace":        round(fgt_furnace, 1),
        "furnace_press":      round(furnace_press, 1),
        "co_furnace":         round(co_furnace, 1),
        "pa_flow_z1":         round(pa_flow_z1, 0),
        "pa_flow_z2":         round(pa_flow_z2, 0),
        "pa_flow_z3":         round(pa_flow_z3, 0),
        "pa_flow_z4":         round(pa_flow_z4, 0),
        "pa_flow_total":      round(pa_total, 1),
        "sa_flow":            round(sa_flow, 1),
        "o2_furnace":         round(o2_furnace, 2),
        # L2 Boiler
        "fw_temp":            round(fw_temp, 1),
        "eco_out_temp":       round(eco_out_temp, 1),
        "drum_level":         round(drum_level, 1),
        "fw_flow":            round(fw_flow, 2),
        "steam_press":        round(steam_press, 2),
        "steam_temp":         round(steam_temp, 1),
        "steam_flow":         round(steam_flow, 2),
        "fgt_out":            round(fgt_out, 1),
        "attemp_spray_flow":  round(attemp_spray_flow, 3),
        # L3 Turbine
        "turbine_speed":      round(turbine_speed, 1),
        "condenser_press":    round(condenser_press, 1),
        "hotwell_level":      round(hotwell_level, 1),
        "cond_flow":          round(cond_flow, 2),
        "deaerator_level":    round(deaerator_level, 1),
        "deaerator_press":    round(deaerator_press, 3),
        "cw_in_temp":         round(cw_in_temp, 1),
        "cw_out_temp":        round(cw_out_temp, 1),
        # L4 Electrical
        "gen_mw":             round(gen_mw, 3),
        "aux_mw":             round(aux_mw, 3),
        "net_mw":             round(net_mw, 3),
        "gen_pf":             round(gen_pf, 3),
        "gen_mvar":           round(gen_mvar, 3),
        "gen_voltage":        round(gen_voltage, 2),
        "gen_freq":           round(gen_freq, 3),
        # L4b Electrical Protection
        "cb_gen_closed":      cb_gen_closed,
        "cb_tx_hv_closed":    cb_tx_hv_closed,
        "cb_ss_closed":       cb_ss_closed,
        "cb_f1_closed":       cb_f1_closed,
        "cb_f2_closed":       cb_f2_closed,
        "cb_f3_closed":       cb_f3_closed,
        "cb_gen_spring":      cb_gen_spring,
        "cb_tx_hv_spring":    cb_tx_hv_spring,
        "cb_gen_trips":       cb_gen_trips,
        "cb_tx_hv_trips":     cb_tx_hv_trips,
        "relay_27_pu":        relay_27_pu,
        "relay_59_pu":        relay_59_pu,
        "relay_81U_pu":       relay_81U_pu,
        "relay_81O_pu":       relay_81O_pu,
        "relay_51_pu":        relay_51_pu,
        "relay_50_pu":        relay_50_pu,
        "relay_87G_pu":       relay_87G_pu,
        "relay_87T_pu":       relay_87T_pu,
        "relay_32_pu":        relay_32_pu,
        "relay_46_pu":        relay_46_pu,
        "relay_40_pu":        relay_40_pu,
        "relay_64_pu":        relay_64_pu,
        "relay_49_pu":        relay_49_pu,
        "relay_51_I1_A":      round(I1, 1),
        "relay_51_I2_A":      round(I2, 1),
        "relay_51_I3_A":      round(I3, 1),
        "relay_46_I2_pct":    round(I2_neg_seq_pct, 2),
        "relay_87G_diff_A":   round(diff_G, 3),
        "relay_87T_diff_A":   round(diff_T, 3),
        "tx_prim_voltage_kV": round(tx_prim_voltage, 2),
        "tx_prim_current_A":  round(tx_prim_current, 1),
        "tx_sec_voltage_kV":  round(tx_sec_voltage, 2),
        "tx_sec_current_A":   round(tx_sec_current, 2),
        "tx_load_pct":        round(tx_load_pct, 1),
        "tx_top_oil_temp":    round(tx_top_oil_temp, 1),
        "tx_winding_temp":    round(tx_winding_temp, 1),
        "tx_ambient_temp":    round(tx_ambient_temp, 1),
        "tx_tap_position":    tx_tap_position,
        "tx_oil_level_pct":   round(tx_oil_level_pct, 1),
        "tx_buchholz_alarm":  tx_buchholz_alarm,
        "tx_buchholz_trip":   tx_buchholz_trip,
        "tx_cool_fan1":       tx_cool_fan1,
        "tx_cool_fan2":       tx_cool_fan2,
        "tx_efficiency_pct":  round(tx_efficiency_pct, 3),
        # L5 APC
        "id_fan_speed":       round(id_fan_speed, 1),
        "pa_fan_speed":       round(pa_fan_speed, 1),
        "sa_fan_speed":       round(sa_fan_speed, 1),
        "bag_temp":           round(bag_temp, 1),
        "bag_dp":             round(bag_dp, 2),
        "scr_temp":           round(scr_temp, 1),
        "scr_nox_in":         round(scr_nox_in, 1),
        "scr_nox_out":        round(scr_nox_out, 1),
        "nh3_injection":      round(nh3_injection, 4),
        "scrubber_ph":        round(scrubber_ph, 2),
        "lime_injection":     round(lime_injection, 2),
        "ac_injection":       round(ac_injection, 3),
        "stack_temp":         round(stack_temp, 1),
        "stack_flow":         round(stack_flow, 2),
        "pm_cems":            round(pm_cems, 2),
        "so2_cems":           round(so2_cems, 1),
        "hcl_cems":           round(hcl_cems, 1),
        "co_cems":            round(co_cems, 1),
        # L6 Wastewater
        "ww_leachate_flow":   round(ww_leachate_flow, 2),
        "ww_ph_in":           round(ww_ph_in, 2),
        "ww_cod_in":          round(ww_cod_in, 0),
        "ww_do_mbr":          round(ww_do_mbr, 2),
        "ww_mlss_mbr":        round(ww_mlss_mbr, 0),
        "ww_mbr_perm_flow":   round(ww_mbr_perm_flow, 2),
        "ww_pc_ph":           round(ww_pc_ph, 2),
        "ww_ro_press":        round(ww_ro_press, 2),
        "ww_ro_recovery":     round(ww_ro_recovery, 1),
        "ww_ro_perm_tds":     round(ww_ro_perm_tds, 1),
        "ww_brine_flow":      round(ww_brine_flow, 3),
        "ww_evap_level":      round(ww_evap_level, 1),
        "ww_effluent_ph":     round(ww_effluent_ph, 2),
        "ww_effluent_cod":    round(ww_effluent_cod, 1),
        # L7 Ash
        "bottom_ash_rate":    round(bottom_ash_rate, 3),
        "fly_ash_rate":       round(fly_ash_rate, 4),
        "ash_temp":           round(ash_temp, 1),
        # L8 Make-up Water Treatment
        "mw_raw_flow":        round(mw_raw_flow, 2),
        "mw_raw_turbidity":   round(mw_raw_turbidity, 1),
        "mw_raw_tds":         round(mw_raw_tds, 0),
        "mw_raw_ph":          round(mw_raw_ph, 2),
        "mw_clf_level":       round(mw_clf_level, 2),
        "mw_sf_dp":           round(mw_sf_dp, 1),
        "mw_sf_turbidity":    round(mw_sf_turbidity, 2),
        "mw_uf_feed_press":   round(mw_uf_feed_press, 2),
        "mw_uf_tmp":          round(mw_uf_tmp, 3),
        "mw_uf_perm_flow":    round(mw_uf_perm_flow, 2),
        "mw_uf_turbidity":    round(mw_uf_turbidity, 3),
        "mw_ro_feed_press":   round(mw_ro_feed_press, 2),
        "mw_ro_perm_flow":    round(mw_ro_perm_flow, 2),
        "mw_ro_recovery":     round(mw_ro_recovery, 1),
        "mw_ro_conductivity": round(mw_ro_conductivity, 1),
        "mw_ro_brine_flow":   round(mw_ro_brine_flow, 3),
        "mw_edi_feed_cond":   round(mw_edi_feed_cond, 1),
        "mw_edi_prod_cond":   round(mw_edi_prod_cond, 4),
        "mw_edi_prod_flow":   round(mw_edi_prod_flow, 2),
        "mw_edi_current":     round(mw_edi_current, 2),
        "mw_di_tank_level":   round(mw_di_tank_level, 1),
        "mw_bfw_tank_level":  round(mw_bfw_tank_level, 1),
        "mw_bfw_conductivity":round(mw_bfw_conductivity, 3),
        "mw_bfw_ph":          round(mw_bfw_ph, 2),
        "mw_bfw_do":          round(mw_bfw_do, 1),
        "mw_bfw_silica":      round(mw_bfw_silica, 1),
        "ct_makeup_flow":     round(ct_makeup_flow, 2),
        "ct_basin_level":     round(ct_basin_level, 2),
        "ct_blowdown":        round(ct_blowdown, 3),
        "ct_coc":             round(ct_coc, 1),
        "ct_approach_temp":   round(ct_approach_temp, 1),
        "ct_range_temp":      round(ct_range_temp, 1),
        # DT computed
        "dt_cycle_eff_pct":   round(dt_cycle_eff_pct, 2),
        "dt_apc_pass":        dt_apc_pass,
        "dt_net_mw":          round(net_mw, 3),
        "dt_revenue_thb":     round(dt_revenue_thb, 0),
        "source":             "mock",
    }


async def main():
    global t
    print(f"[mock_poller] Starting — interval: {POLL_INTERVAL}s  |  7 control loops")
    print(f"[mock_poller] Supabase: {SUPABASE_URL}")
    print("[mock_poller] Press Ctrl+C to stop\n")

    while True:
        row = simulate_plant(t)
        try:
            supabase.table("plant_telemetry").insert(row).execute()
            print(
                f"[{row['ts'][11:19]}]  "
                f"FEED={row['waste_feed_rate']:.2f}t/h  "
                f"GEN={row['gen_mw']:.2f}MW(net {row['net_mw']:.2f})  "
                f"Z3={row['bed_temp_z3']:.0f}°C  "
                f"NOx={row['scr_nox_out']:.0f}mg  "
                f"APC={'✓' if row['dt_apc_pass'] else '✗'}"
            )
        except Exception as e:
            print(f"[ERROR] {e}", file=sys.stderr)

        t += POLL_INTERVAL
        await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
