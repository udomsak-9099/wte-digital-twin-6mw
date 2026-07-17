# ⚡ WtE Digital Twin — 6.6 MW Moving Grate

Real-time Digital Twin for a 6.6 MW Municipal Solid Waste (MSW) to Energy plant with Emerson Ovation DCS.

**🌐 Live Dashboard → https://web-seven-livid-89.vercel.app**  
**🐙 GitHub → https://github.com/udomsak-9099/wte-digital-twin-6mw**

---

## 📐 Plant Specs

| Item | Spec |
|---|---|
| Technology | Moving Grate Incineration |
| Gross Capacity | 6.6 MW |
| Net Export (VSPP) | ~6.0 MW @ 4.24 THB/kWh |
| DCS | Emerson Ovation |
| Fuel | MSW ~110 t/day |
| Steam | 40 bar / 400 °C |
| Emission Standard | Thailand PCD MSWI |

---

## 🏗️ Architecture

```
Physical Plant  →  Moving Grate → Boiler → Turbine → 6.6 MW Generator
                         ↓
Emerson Ovation DCS  (OPC-UA bridge → mock_poller.py in dev)
                         ↓
Supabase PostgreSQL  (plant_telemetry + lab_samples)
                         ↓
React Dashboard  (Vite + TypeScript → Vercel)
                         ↓
FastAPI Backend  (MATLAB simulation trigger) ← [roadmap]
```

---

## 🗂️ Project Structure

```
wte-digital-twin-6mw/
│
├── frontend/web/              # React + Vite + TypeScript dashboard
│   ├── src/
│   │   ├── App.tsx            # Main app — all tabs & components
│   │   ├── supabaseClient.ts  # Supabase client + PlantTelemetry type
│   │   └── index.css
│   ├── vite.config.ts
│   └── package.json
│
├── opcua/bridge/
│   ├── mock_poller.py         # Simulates Ovation DCS → Supabase every 5s
│   └── seed_lab.py            # Seeds lab_samples with realistic demo data
│
├── supabase/migrations/       # PostgreSQL schema (run via Supabase CLI)
│   ├── 20260717000001_plant_telemetry.sql
│   ├── 20260717000002_plant_telemetry_full.sql   # 80+ columns, 8 loops
│   ├── 20260717000003_dt_computed_cols.sql
│   ├── 20260717000004_source_col.sql
│   ├── 20260717000005_water_treatment.sql        # UF→RO→EDI→BFW
│   ├── 20260717000006_lab_samples.sql            # JSONB lab results
│   └── 20260717000007_electrical_protection.sql  # CB, relay, transformer
│
├── config/                    # .env files (NOT committed — ask team lead)
└── pyproject.toml             # Python dependencies
```

---

## 🖥️ Dashboard Tabs

| Tab | Content |
|---|---|
| **Overview** | KPI cards: Power, Fuel LHV, Moisture, Steam, CEMS compliance |
| **Combustion** | Fuel quality panel (proximate + ultimate + LHV + composition bar), grate zones, air control |
| **Boiler** | Drum level, feedwater, steam P/T/F, economizer temp |
| **Turbine** | Speed, condenser, hotwell, deaerator, cooling water |
| **Electrical** | Generator output, CB status (52G/T/SS/F1-F3), ANSI relay table (13 devices), transformer monitoring + DGA link |
| **APC / CEMS** | Bag filter, SCR NOx, scrubber, stack — Thai PCD gauges with warn/danger lines |
| **Water Tx** | Raw→Clarifier→Sand Filter→UF→RO→EDI→BFW + Cooling Tower |
| **Wastewater** | Leachate inlet→MBR→polishing→RO→ZLD evaporator |
| **Ash** | Bottom ash (~20% feed), fly ash (~4% feed), daily estimates |
| **Lab** | 10 sample types incl. Transformer DGA with Duval Triangle (IEC 60599) |

---

## 🚀 Getting Started (New Contributor)

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.11
- Supabase CLI: `brew install supabase/tap/supabase`
- Git + SSH key added to GitHub

### 1. Clone
```bash
git clone git@github.com:udomsak-9099/wte-digital-twin-6mw.git
cd wte-digital-twin-6mw
```

### 2. Environment files
**Ask team lead for the actual keys — never commit `.env` files.**

Create `config/.env`:
```env
SUPABASE_URL=https://uksgobdrcwarxbsqbawx.supabase.co
SUPABASE_SERVICE_KEY=<ask team lead>
SUPABASE_ANON_KEY=<ask team lead>
```

Create `frontend/web/.env.local`:
```env
VITE_SUPABASE_URL=https://uksgobdrcwarxbsqbawx.supabase.co
VITE_SUPABASE_ANON_KEY=<ask team lead>
```

### 3. Install & run frontend
```bash
cd frontend/web
npm install
npm run dev        # opens http://localhost:5110
```

### 4. Run mock DCS poller (simulates live sensor data)
Open a second terminal:
```bash
pip install supabase python-dotenv
python opcua/bridge/mock_poller.py
```
Dashboard will show live data every 5 seconds.

### 5. Seed demo lab data (first time only)
```bash
python opcua/bridge/seed_lab.py
```

---

## 🌿 Git Workflow

```bash
# Before starting any work — always pull latest
git pull origin main

# Create your own branch
git checkout -b feature/your-feature-name

# Code → commit → push
git add .
git commit -m "feat: describe what you built"
git push origin feature/your-feature-name

# Open Pull Request on GitHub → team review → merge
```

### Branch naming convention
| Type | Format | Example |
|---|---|---|
| New feature | `feature/xxx` | `feature/turbine-trend-chart` |
| Bug fix | `fix/xxx` | `fix/relay-pickup-display` |
| DB migration | `migration/xxx` | `migration/add-vibration-column` |
| Docs | `docs/xxx` | `docs/opcua-setup` |

### Commit message format
```
feat:     new feature or tab
fix:      bug fix
refactor: restructure without changing behavior
chore:    config, deps, tooling
docs:     documentation only
```

---

## 🗄️ Database

**Supabase project:** `uksgobdrcwarxbsqbawx` (Singapore region)

### Run migrations (first time or after pulling new migrations)
```bash
supabase link --project-ref uksgobdrcwarxbsqbawx
supabase db push
```

### Tables
| Table | Description |
|---|---|
| `plant_telemetry` | Time-series DCS data — 80+ columns, inserted every 5s |
| `lab_samples` | Manual lab results — JSONB `data` column, 10 sample types |

### Adding a new sensor column
1. Create a new migration file: `supabase/migrations/YYYYMMDD_description.sql`
2. Run `supabase db push`
3. Add the field to `PlantTelemetry` type in `supabaseClient.ts`
4. Add to `mock_poller.py` simulation
5. Display in the relevant tab in `App.tsx`

---

## 📡 Control Loops (8 loops)

| Loop | Key Signals |
|---|---|
| L1 Combustion | waste_feed_rate, bed_temp_z1-z4, o2_furnace, co_furnace, pa/sa_flow |
| L2 Boiler | drum_level, steam_press/temp/flow, fw_flow, eco_out_temp |
| L3 Turbine | turbine_speed, condenser_press, hotwell_level, deaerator_press |
| L4 Electrical | gen_mw, net_mw, gen_pf, gen_voltage, gen_freq |
| L4b Protection | cb_*_closed, relay_*_pu, tx_top_oil/winding_temp, tx_tap_position |
| L5 APC/CEMS | pm/so2/hcl/co_cems, nh3_injection, bag_dp, scr_nox_out |
| L6 Wastewater | ww_do_mbr, ww_mlss_mbr, ww_ro_recovery, ww_effluent_cod |
| L7 Ash | bottom_ash_rate, fly_ash_rate, ash_temp |
| L8 Water Tx | mw_uf_tmp, mw_ro_conductivity, mw_edi_prod_cond, mw_bfw_do |

---

## 🌐 Deploy to Vercel

```bash
cd frontend/web
npm run build                      # TypeScript compile + bundle
npx vercel deploy --prod --yes     # push to production
```

Live URL: **https://web-seven-livid-89.vercel.app**

---

## 🛡️ Thailand PCD Emission Limits (MSWI)

| Pollutant | Limit | CEMS Tag |
|---|---|---|
| PM | ≤ 20 mg/Nm³ | pm_cems |
| NOx | ≤ 200 mg/Nm³ | scr_nox_out |
| SO₂ | ≤ 50 mg/Nm³ | so2_cems |
| HCl | ≤ 50 mg/Nm³ | hcl_cems |
| CO | ≤ 100 mg/Nm³ | co_cems |
| Dioxins | ≤ 0.1 ng TEQ/Nm³ | (lab, stack_manual) |

---

## ✅ Roadmap

- [x] React dashboard — 10 tabs, all plant loops
- [x] Supabase real-time telemetry (80+ signals)
- [x] Mock DCS poller — 8 control loops
- [x] Fuel quality panel — proximate + ultimate + LHV + composition bar
- [x] Lab module — 10 sample types + Transformer DGA with Duval Triangle
- [x] Electrical protection — CB status, ANSI relay table, transformer monitoring
- [x] Make-up water treatment — UF→RO→EDI→BFW + Cooling Tower
- [x] Vercel production deployment
- [x] GitHub repository
- [ ] FastAPI backend — MATLAB simulation trigger endpoint
- [ ] OPC-UA bridge — live connection to Emerson Ovation
- [ ] Predictive maintenance module (LSTM)
- [ ] Paper-21 AI-DSS integration (copula joint-risk)
- [ ] Mobile app (Expo)

---

## 👥 Team

| Role | Name |
|---|---|
| Project Lead | Udomsak Kaewsiri (UTCC + LAWI Engineering) |

*Add your name here when you join!*
