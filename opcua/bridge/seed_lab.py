"""
seed_lab.py — Seed lab_samples table with realistic sample data for all types.
Run once to populate demo data; safe to re-run (inserts new rows each time).

Usage:
    cd <project_root>
    .venv/bin/python opcua/bridge/seed_lab.py
"""

import os, sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent.parent / "config" / ".env")
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

now = datetime.now(timezone.utc)

def ts(hours_ago: float) -> str:
    return (now - timedelta(hours=hours_ago)).isoformat()

SAMPLES = [
    # ── Fuel / MSW Analysis (proximate + ultimate + LHV) ──────────────────
    {
        "sampled_at": ts(2), "sample_type": "fuel",
        "sample_ref": "FUEL-2026-0717-A", "entered_by": "Lab Technician",
        "data": {
            # Proximate analysis (as-received)
            "moisture_pct":         42.5,
            "volatile_matter_pct":  32.8,
            "fixed_carbon_pct":     6.2,
            "ash_pct":              18.5,
            # Ultimate analysis (dry basis)
            "C_pct":  28.4,
            "H_pct":  3.9,
            "N_pct":  0.8,
            "S_pct":  0.15,
            "O_pct":  18.1,
            "Cl_pct": 0.45,
            # Calorific value
            "LHV_kcal_kg":  1820,
            "HHV_kcal_kg":  2150,
        },
        "notes": "Mixed municipal solid waste, batch 17/07",
    },
    {
        "sampled_at": ts(26), "sample_type": "fuel",
        "sample_ref": "FUEL-2026-0716-B", "entered_by": "Lab Technician",
        "data": {
            "moisture_pct": 44.1, "volatile_matter_pct": 31.5,
            "fixed_carbon_pct": 5.8, "ash_pct": 18.6,
            "C_pct": 27.2, "H_pct": 3.7, "N_pct": 0.75, "S_pct": 0.12,
            "O_pct": 17.8, "Cl_pct": 0.38,
            "LHV_kcal_kg": 1780, "HHV_kcal_kg": 2100,
        },
        "notes": "Mixed MSW — higher moisture than spec",
    },

    # ── Raw Water ──────────────────────────────────────────────────────────
    {
        "sampled_at": ts(4), "sample_type": "raw_water",
        "sample_ref": "RW-2026-0717-AM", "entered_by": "Lab Technician",
        "data": {
            "pH":               7.5,
            "turbidity_NTU":    22.4,
            "TDS_mg_L":         385,
            "TSS_mg_L":         38,
            "hardness_mg_L":    185,   # as CaCO3
            "alkalinity_mg_L":  145,
            "Fe_mg_L":          0.42,
            "Mn_mg_L":          0.08,
            "Cl_mg_L":          62,
            "SO4_mg_L":         48,
            "NO3_mg_L":         5.2,
        },
    },
    {
        "sampled_at": ts(16), "sample_type": "raw_water",
        "sample_ref": "RW-2026-0716-PM", "entered_by": "Lab Technician",
        "data": {
            "pH": 7.3, "turbidity_NTU": 28.1, "TDS_mg_L": 392,
            "TSS_mg_L": 45, "hardness_mg_L": 188, "alkalinity_mg_L": 148,
            "Fe_mg_L": 0.55, "Mn_mg_L": 0.10, "Cl_mg_L": 65, "SO4_mg_L": 52,
        },
    },

    # ── Boiler Drum Water ──────────────────────────────────────────────────
    {
        "sampled_at": ts(3), "sample_type": "boiler_drum",
        "sample_ref": "BD-2026-0717-AM", "entered_by": "Lab Technician",
        "data": {
            "pH":                9.5,
            "conductivity_uS_cm": 185,
            "TDS_mg_L":          125,
            "silica_mg_L":       0.8,
            "phosphate_mg_L":    12.5,   # target 10-20 mg/L
            "chloride_mg_L":     8.2,
            "sulfite_mg_L":      25,     # oxygen scavenger residual
            "hardness_mg_L":     0.0,    # should be 0 (fully softened)
            "iron_mg_L":         0.05,
            "sodium_mg_L":       42,
        },
        "notes": "All parameters within ASME guidelines",
    },
    {
        "sampled_at": ts(15), "sample_type": "boiler_drum",
        "sample_ref": "BD-2026-0716-PM", "entered_by": "Lab Technician",
        "data": {
            "pH": 9.3, "conductivity_uS_cm": 198, "TDS_mg_L": 135,
            "silica_mg_L": 1.1, "phosphate_mg_L": 10.8,
            "chloride_mg_L": 9.5, "sulfite_mg_L": 18, "hardness_mg_L": 0.0,
        },
        "flagged": True,
        "notes": "Silica slightly elevated — increase blowdown",
    },

    # ── Boiler Feed Water / Condensate ────────────────────────────────────
    {
        "sampled_at": ts(4), "sample_type": "bfw",
        "sample_ref": "BFW-2026-0717-AM", "entered_by": "Lab Technician",
        "data": {
            "pH":                  9.2,
            "conductivity_uS_cm":  0.82,
            "DO_ppb":              8,       # dissolved oxygen (target <20 ppb)
            "silica_ppb":          12,      # target <20 ppb
            "iron_ppb":            5,
            "copper_ppb":          2,
            "hardness_mg_L":       0.0,
            "sodium_ppb":          18,
            "TOC_ppb":             85,
        },
        "notes": "BFW quality within spec",
    },

    # ── Cooling Tower Water ────────────────────────────────────────────────
    {
        "sampled_at": ts(5), "sample_type": "cooling",
        "sample_ref": "CT-2026-0717-AM", "entered_by": "Lab Technician",
        "data": {
            "pH":                7.8,
            "conductivity_uS_cm": 1850,
            "TDS_mg_L":          1250,
            "hardness_mg_L":     920,   # as CaCO3
            "alkalinity_mg_L":   680,
            "Cl_mg_L":           285,
            "SO4_mg_L":          240,
            "Fe_mg_L":           0.12,
            "Mn_mg_L":           0.03,
            "SiO2_mg_L":         35,
            "biocide_mg_L":      0.8,   # oxidizing biocide residual
            "LSI":               0.35,  # Langelier Saturation Index (target 0-0.5)
            "COC":               5.2,   # cycles of concentration
        },
        "notes": "LSI within target range — scaling risk low",
    },

    # ── Stack Gas Manual Spot Check ────────────────────────────────────────
    {
        "sampled_at": ts(6), "sample_type": "stack_manual",
        "sample_ref": "STK-2026-0717-08H", "entered_by": "Environmental Engineer",
        "data": {
            "O2_pct":           10.2,
            "CO2_pct":          9.8,
            "CO_mg_Nm3":        42,      # limit 100 mg/Nm³ Thai PCD
            "NOx_mg_Nm3":       55,      # limit 200
            "SO2_mg_Nm3":       19,      # limit 50
            "HCl_mg_Nm3":       13,      # limit 50
            "PM_mg_Nm3":        4.8,     # limit 20
            "dioxins_ng_TEQ_Nm3": 0.08, # limit 0.1 ng TEQ/Nm³ Thai PCD
            "Hg_ug_Nm3":        18,      # limit 50 µg/Nm³
            "Cd_Tl_ug_Nm3":     8,
            "flow_Nm3_h":       42500,
            "temp_C":           68.5,
            "moisture_pct":     12.8,
        },
        "notes": "All parameters within Thai PCD MSWI standard",
    },

    # ── Bottom Ash ─────────────────────────────────────────────────────────
    {
        "sampled_at": ts(8), "sample_type": "bottom_ash",
        "sample_ref": "BA-2026-0717-A", "entered_by": "Lab Technician",
        "data": {
            "LOI_pct":      2.8,    # loss on ignition (target <5%)
            "moisture_pct": 18.5,   # after quenching
            # TCLP (toxicity characteristic leaching) mg/L
            "TCLP_As_mg_L":  0.012,
            "TCLP_Pb_mg_L":  0.18,
            "TCLP_Cd_mg_L":  0.005,
            "TCLP_Hg_mg_L":  0.0008,
            "TCLP_Cr_mg_L":  0.045,
            # Total metals mg/kg
            "Pb_mg_kg":    620,
            "Zn_mg_kg":   3850,
            "Cu_mg_kg":    480,
            "Cd_mg_kg":     12,
            "Cr_mg_kg":    145,
        },
        "notes": "LOI within spec. TCLP all below Thai hazardous waste thresholds.",
    },

    # ── Fly Ash ────────────────────────────────────────────────────────────
    {
        "sampled_at": ts(8), "sample_type": "fly_ash",
        "sample_ref": "FA-2026-0717-A", "entered_by": "Lab Technician",
        "data": {
            "LOI_pct":          1.5,
            # Total metals mg/kg dry
            "Pb_mg_kg":        4200,
            "Zn_mg_kg":       28000,
            "Cu_mg_kg":         850,
            "Cd_mg_kg":          85,
            "Hg_mg_kg":           1.8,
            "Cr_mg_kg":          420,
            "Ni_mg_kg":          180,
            "As_mg_kg":           28,
            # Dioxins (PCDD/F)
            "dioxins_ng_TEQ_kg": 0.85,  # Thai HW threshold <1.0
            # Solubility
            "Cl_soluble_pct":    8.2,
            "SO4_soluble_pct":   2.4,
        },
        "flagged": False,
        "notes": "Fly ash classified as hazardous waste — secure landfill required",
    },

    # ── Wastewater Final Effluent ──────────────────────────────────────────
    {
        "sampled_at": ts(5), "sample_type": "effluent",
        "sample_ref": "EFF-2026-0717-AM", "entered_by": "Lab Technician",
        "data": {
            "pH":           7.3,
            "BOD5_mg_L":    12,      # Thai std: ≤20
            "COD_mg_L":     28,      # Thai std: ≤120
            "TSS_mg_L":     8,       # Thai std: ≤30
            "TDS_mg_L":     850,
            "NH3_N_mg_L":   4.5,
            "TKN_mg_L":     8.2,
            "TP_mg_L":      1.8,
            "As_mg_L":      0.0008,
            "Pb_mg_L":      0.0012,
            "Cd_mg_L":      0.00015,
            "Hg_mg_L":      0.00002,
            "Cr_total_mg_L":0.0028,
            "Cr6_mg_L":     0.00,
            "Ni_mg_L":      0.0045,
            "coliform_MPN_100mL": 420,  # Thai std: ≤1000
            "oil_grease_mg_L":    3.2,
        },
        "notes": "All parameters within Thai Wastewater Effluent Standard (Type 4)",
    },
]

def main():
    print(f"Seeding {len(SAMPLES)} lab samples...")
    for s in SAMPLES:
        try:
            r = sb.table("lab_samples").insert(s).execute()
            print(f"  ✓ {s['sample_type']:15s}  {s.get('sample_ref','')}")
        except Exception as e:
            print(f"  ✗ {s['sample_type']:15s}  ERROR: {e}")
    print("Done.")

if __name__ == "__main__":
    main()
