%% s04_rankine.m — Condensing Rankine cycle (steam turbine + generator)

function cycle = s04_rankine(plant, boiler)

% Turbine
h1 = boiler.h_steam_kJkg;   % turbine inlet (superheated)
P_cond = plant.condenser_press;  % bar (e.g. 0.08 bar)

% Condenser saturation (approximate)
T_sat_c = 41.5;  % °C at 0.08 bar
h2s_kJkg = 2085; % isentropic exit enthalpy
eta_is   = 0.82; % isentropic efficiency

h2 = h1 - eta_is * (h1 - h2s_kJkg);  % actual exit enthalpy

% Turbine work
cycle.W_turbine_kJkg = h1 - h2;
cycle.W_turbine_mw   = boiler.steam_kgs * cycle.W_turbine_kJkg / 1000;

% Condensate
h3 = 174;  % kJ/kg — saturated liquid at condenser pressure

% Pump work (small)
cycle.W_pump_kJkg = (boiler.steam_press_bar - P_cond) * 100 / 950;  % approx
cycle.W_pump_mw   = boiler.steam_kgs * cycle.W_pump_kJkg / 1000;

% Net cycle output
cycle.W_net_mw    = cycle.W_turbine_mw - cycle.W_pump_mw;

% Generator
eta_gen = 0.97;
cycle.P_gross_mw  = cycle.W_net_mw * eta_gen;

% Auxiliary power (fans, pumps, controls)
P_aux_mw = 0.35;  % MW — typical for this size

% Net electrical output
cycle.P_net_mw    = cycle.P_gross_mw - P_aux_mw;
cycle.P_target_mw = plant.capacity_mw;

% Cycle efficiency (electrical/thermal)
cycle.eta_cycle   = cycle.P_net_mw / (boiler.steam_kgs * (h1 - boiler.h_fw_kJkg) / 1000);

% Condenser heat rejection
cycle.Q_cond_mw   = boiler.steam_kgs * (h2 - h3) / 1000;

fprintf('[s04] Turbine: %.2f MW | Net: %.2f MW (target %.1f MW) | η_cycle: %.1f%%\n', ...
    cycle.W_turbine_mw, cycle.P_net_mw, cycle.P_target_mw, cycle.eta_cycle*100);
end
