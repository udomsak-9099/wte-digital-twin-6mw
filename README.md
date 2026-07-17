# WtE Digital Twin — 6.6 MW Moving Grate + Ovation DCS

## Project Overview
Full-stack digital twin for a 6.6 MW moving-grate waste-to-energy plant
integrated with Emerson Ovation DCS via OPC-UA.

## Architecture
```
L0  Physical Plant  →  Moving Grate Furnace → Boiler → Turbine → 6.6 MW Generator
L1  Physics Model   →  MATLAB/Simulink (s00_ naming)
L2  AI/ML Layer     →  LSTM + NSGA-II + Copula DSS (Paper-21)
L3  Data Layer      →  Ovation OPC-UA → Supabase → MQTT
L4  Visualization   →  React Web + Expo Mobile
```

## Quick Start
See `docs/architecture/setup.md`

## Key Tags (Ovation)
See `opcua/config/tag_mapping.yaml`
