%% s01_combustion.m — Stoichiometry + LHV calculation
% Moving grate MSW combustion model

function comb = s01_combustion(plant)

% Proximate analysis (as-received basis)
moisture = plant.msw_moisture;
ash      = plant.msw_ash;
VS       = 1 - moisture - ash;  % volatile solids

% Ultimate analysis estimate from LHV (Dulong formula inverse)
% Adjust when lab analysis is available
LHV_kcalkg = plant.msw_lhv_kcalkg;
LHV_MJkg   = LHV_kcalkg * 4.1868 / 1000;

% Stoichiometric air requirement (kg air / kg MSW)
% Theoretical: ~1.5 kg O2/kg combustible → ~6.5 kg air/kg combustible
alpha_stoich = 5.8 * VS;  % approximate for MSW

% Excess air (typical moving grate: 80–120%)
EA = 1.0;  % 100% excess air — tune per zone
comb.air_ratio = 1 + EA;
comb.air_specific_kgkg = alpha_stoich * comb.air_ratio;

% Total air flow
feed_kgs = plant.msw_feed_th * 1000 / 3600;  % kg/s
comb.air_total_kgs = feed_kgs * comb.air_specific_kgkg;

% Flue gas composition (vol %)
comb.fluegas.CO2  = 0.10;
comb.fluegas.H2O  = 0.12;
comb.fluegas.O2   = 0.09;   % residual O2 at 100% EA
comb.fluegas.N2   = 0.69;
comb.fluegas.SO2  = 150e-6; % ppm → fraction (placeholder)

% Heat release rate
comb.heat_release_mw = feed_kgs * LHV_MJkg;  % MW (thermal)
comb.LHV_MJkg = LHV_MJkg;
comb.feed_kgs = feed_kgs;

% Ash/slag output
comb.bottom_ash_kgs  = feed_kgs * ash * 0.80;  % 80% bottom ash
comb.fly_ash_kgs     = feed_kgs * ash * 0.20;  % 20% fly ash to APC

fprintf('[s01] Thermal input: %.2f MW | Air ratio: %.2f | Flue O2: %.1f%%\n', ...
    comb.heat_release_mw, comb.air_ratio, comb.fluegas.O2*100);
end
