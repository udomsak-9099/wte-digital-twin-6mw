%% s03_boiler.m — Boiler / HRSG heat transfer model

function boiler = s03_boiler(plant, grate)

% Design parameters
P_steam = plant.steam_press_bar;  % bar
T_steam = plant.steam_temp_c;     % °C
T_fw    = 105;                    % feedwater temp [°C] — deaerator outlet

% Flue gas side
T_fg_in  = grate.fluegas_temp_c;  % °C (furnace exit)
T_fg_out = 180;                    % °C (economizer exit — above acid dewpoint)
fg_kgs   = grate.fluegas_flow_kgs;
Cp_fg    = 1.05;                   % kJ/(kg·K) average

% Heat available from flue gas [MW]
Q_fg_mw = fg_kgs * Cp_fg * (T_fg_in - T_fg_out) / 1000;

% Boiler efficiency
boiler.eta = 0.82;  % 82% — tune after heat loss survey
Q_useful_mw = Q_fg_mw * boiler.eta;

% Steam enthalpy (approximate — replace with REFPROP lookup)
h_steam_kJkg = 3215;   % kJ/kg at 40 bar, 400°C (superheated)
h_fw_kJkg    = 440;    % kJ/kg at 105°C (sat liquid)

% Steam generation rate
boiler.steam_kgs  = Q_useful_mw * 1000 / (h_steam_kJkg - h_fw_kJkg);
boiler.steam_th   = boiler.steam_kgs * 3.6;

% Outputs
boiler.steam_press_bar = P_steam;
boiler.steam_temp_c    = T_steam;
boiler.fg_temp_out_c   = T_fg_out;
boiler.Q_useful_mw     = Q_useful_mw;
boiler.h_steam_kJkg    = h_steam_kJkg;
boiler.h_fw_kJkg       = h_fw_kJkg;

fprintf('[s03] Steam: %.1f t/h @ %.0f bar / %.0f°C | Boiler η: %.0f%%\n', ...
    boiler.steam_th, P_steam, T_steam, boiler.eta*100);
end
