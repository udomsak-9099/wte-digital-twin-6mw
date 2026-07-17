# Setup Guide — WtE Digital Twin 6.6 MW

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| MATLAB | R2023b+ | Physics models (s00–s08) |
| Industrial Communication Toolbox | latest | OPC-UA client in MATLAB |
| Python | 3.11+ | OPC-UA bridge poller |
| Node.js | 20+ | Frontend + API |
| Supabase CLI | latest | DB migrations |

## Phase 1: MATLAB Physics Model

1. Open MATLAB, add `matlab/core/` to path
2. Fill `matlab/data/input/plant_baseline.mat` with actual plant design data
3. Run: `results = s00_run('mode','sim','scenario','baseline')`
4. Verify output matches design intent

## Phase 2: Ovation OPC-UA Connection

1. Get OPC-UA server IP from Ovation Engineering Workstation
2. Update `opcua/config/tag_mapping.yaml` → `server.host`
3. Confirm node IDs from Ovation OPC Browser
4. Test: `s08_opcua_bridge('test')` in MATLAB
5. Start Python poller: `cd opcua/bridge && python opcua_poller.py`

## Phase 3: Supabase Setup

1. Create project at supabase.com
2. Copy `.env.example` → `.env` and fill credentials
3. Run migration: `supabase db push` or paste `001_plant_telemetry.sql` in SQL Editor
4. Verify `plant_telemetry` table created

## Phase 4: AI/ML (TBD)

- `ai/predictive/` — LSTM for predictive maintenance
- `ai/optimizer/` — NSGA-II dispatch optimization
- `ai/dss/` — Copula-based AI-DSS (Paper-21 integration)

## Phase 5: Frontend (TBD)

- `frontend/web/` — React dashboard with live P&ID
- `frontend/mobile/` — Expo app for mobile monitoring

## Key Files

| File | Purpose |
|------|---------|
| `matlab/core/s00_run.m` | Master runner — start here |
| `opcua/config/tag_mapping.yaml` | All Ovation tags |
| `opcua/bridge/opcua_poller.py` | Live OPC-UA → Supabase |
| `backend/supabase/migrations/001_plant_telemetry.sql` | DB schema |
| `config/.env.example` | Environment template |
