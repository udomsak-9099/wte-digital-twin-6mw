%% s02_grate_zones.m — 4-zone moving grate bed model
% Zones: Drying → Devolatilization → Combustion → Burnout

function grate = s02_grate_zones(plant, comb)

nz = plant.n_grate_zones;  % 4 zones

% Zone length fractions (tune per design drawing)
zone_frac = [0.20, 0.25, 0.35, 0.20];  % must sum to 1

% Primary air split per zone (% of total primary air)
% Zone 3 gets most air for peak combustion
pa_split = [0.15, 0.20, 0.45, 0.20];

% Zone temperatures [°C] — typical moving grate profile
grate.zone_temp_c = [300, 650, 950, 750];

% Grate speed (m/h) — controlled via Ovation GRATE_SPEED tag
grate.speed_mh = 3.0;  % default; overridden by live OPC-UA in s08

% Residence time per zone [min]
grate_length_m = 8.0;  % total grate length (m) — fill in from drawing
grate.zone_length_m    = grate_length_m * zone_frac;
grate.residence_min    = (grate.zone_length_m / grate.speed_mh) * 60;

% Primary air per zone
total_pa_kgs = comb.air_total_kgs * 0.60;  % 60% primary / 40% secondary
grate.pa_zone_kgs = total_pa_kgs * pa_split;

% Secondary air (overfire)
grate.sa_kgs = comb.air_total_kgs * 0.40;

% Heat release per zone [MW]
grate.heat_zone_mw = comb.heat_release_mw * [0.05, 0.25, 0.55, 0.15];

% Bed depth [mm] — affects burnout quality
grate.bed_depth_mm = 400;  % nominal; sensor: BED_DEPTH tag

% Carbon conversion efficiency per zone
grate.carbon_conv = [0.10, 0.45, 0.90, 0.99];

% Outputs to boiler
grate.fluegas_temp_c = 950;  % furnace exit temp (above grate)
grate.fluegas_flow_kgs = comb.air_total_kgs + comb.feed_kgs - comb.bottom_ash_kgs;

fprintf('[s02] Grate: %.1f m/h | Zone temps: %d/%d/%d/%d °C | FG exit: %d °C\n', ...
    grate.speed_mh, grate.zone_temp_c(1), grate.zone_temp_c(2), ...
    grate.zone_temp_c(3), grate.zone_temp_c(4), grate.fluegas_temp_c);
end
