%% s00_run.m — Master runner for WtE 6.6 MW Digital Twin
% Moving grate + Ovation DCS
% Usage: s00_run()  or  s00_run('mode','sim','scenario','baseline')

function results = s00_run(varargin)

p = inputParser;
addParameter(p, 'mode',     'sim',      @ischar);  % 'sim' | 'live' | 'batch'
addParameter(p, 'scenario', 'baseline', @ischar);
addParameter(p, 'dt',       1,          @isnumeric); % time step [s]
addParameter(p, 'duration', 3600,       @isnumeric); % sim duration [s]
parse(p, varargin{:});
cfg = p.Results;

fprintf('[s00] WtE Digital Twin — mode: %s | scenario: %s\n', cfg.mode, cfg.scenario);

%% Load plant config
plant = load_plant_config(cfg.scenario);

%% Run model chain
comb   = s01_combustion(plant);
grate  = s02_grate_zones(plant, comb);
boiler = s03_boiler(plant, grate);
cycle  = s04_rankine(plant, boiler);
apc    = s05_apc(plant, grate);
ww     = s06_wastewater(plant);
elec   = s07_electrical(plant, cycle);

%% Aggregate results
results = struct( ...
    'combustion', comb, ...
    'grate',      grate, ...
    'boiler',     boiler, ...
    'cycle',      cycle, ...
    'apc',        apc, ...
    'wastewater', ww, ...
    'electrical', elec, ...
    'timestamp',  now, ...
    'scenario',   cfg.scenario ...
);

%% Export if live mode
if strcmp(cfg.mode, 'live')
    s08_opcua_bridge('write', results);
end

fprintf('[s00] Done — Net power: %.2f MW | Efficiency: %.1f%%\n', ...
    elec.net_mw, elec.efficiency_pct);
end

function plant = load_plant_config(scenario)
    cfg_file = fullfile(fileparts(mfilename('fullpath')), ...
        '..', 'data', 'input', sprintf('plant_%s.mat', scenario));
    if exist(cfg_file, 'file')
        plant = load(cfg_file);
    else
        plant = default_plant_config();
        warning('[s00] Using default config — create plant_%s.mat to override', scenario);
    end
end

function plant = default_plant_config()
    % Moving grate — baseline parameters
    plant.capacity_mw     = 6.6;
    plant.msw_feed_th     = 24;        % t/h MSW feed rate
    plant.msw_lhv_kcalkg  = 1800;      % kcal/kg (adjust per proximate analysis)
    plant.msw_moisture    = 0.45;      % 45% moisture
    plant.msw_ash         = 0.20;      % 20% ash
    plant.n_grate_zones   = 4;
    plant.steam_press_bar = 40;
    plant.steam_temp_c    = 400;
    plant.condenser_press = 0.08;      % bar
end
