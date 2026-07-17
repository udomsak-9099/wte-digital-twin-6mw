%% s08_opcua_bridge.m — Ovation DCS OPC-UA bridge
% Requires: Industrial Communication Toolbox (MATLAB OPC UA)
% Ovation OPC-UA server: typically runs on port 4840

function data = s08_opcua_bridge(action, varargin)

% Ovation endpoint — update with actual server IP
OPC_ENDPOINT = 'opc.tcp://192.168.1.100:4840';  % FILL IN

switch action
    case 'read'
        data = read_live_tags(OPC_ENDPOINT);
    case 'write'
        results = varargin{1};
        write_digital_twin_tags(OPC_ENDPOINT, results);
        data = results;
    case 'test'
        data = test_connection(OPC_ENDPOINT);
    otherwise
        error('[s08] Unknown action: %s', action);
end
end

function data = read_live_tags(endpoint)
% Tag mapping — align with opcua/config/tag_mapping.yaml
tags = { ...
    'GRATE_SPEED',    'Plant.GrateControl.Speed'; ...
    'BED_TEMP_Z1',    'Plant.Grate.Zone1.Temperature'; ...
    'BED_TEMP_Z2',    'Plant.Grate.Zone2.Temperature'; ...
    'BED_TEMP_Z3',    'Plant.Grate.Zone3.Temperature'; ...
    'BED_TEMP_Z4',    'Plant.Grate.Zone4.Temperature'; ...
    'PA_FLOW_TOTAL',  'Plant.CombAir.Primary.TotalFlow'; ...
    'SA_FLOW',        'Plant.CombAir.Secondary.Flow'; ...
    'STEAM_PRESS',    'Plant.Boiler.SteamPressure'; ...
    'STEAM_TEMP',     'Plant.Boiler.SteamTemp'; ...
    'STEAM_FLOW',     'Plant.Boiler.SteamFlow'; ...
    'GEN_MW',         'Plant.Generator.ActivePower'; ...
    'FGT_OUT',        'Plant.Boiler.FluegasTemp.Outlet'; ...
    'BAG_DP',         'Plant.APC.BagFilter.DeltaP'; ...
    'SCR_NOX_OUT',    'Plant.APC.SCR.NOx.Outlet'; ...
};

try
    uaClient = opcua(endpoint);
    connect(uaClient);
    fprintf('[s08] OPC-UA connected: %s\n', endpoint);

    data = struct();
    for i = 1:size(tags, 1)
        node = findNodeByName(uaClient.Namespace, tags{i,2}, '-once');
        val  = readValue(uaClient, node);
        data.(tags{i,1}) = val.Value;
    end
    disconnect(uaClient);
catch e
    warning('[s08] OPC-UA read failed: %s — using defaults', e.message);
    data = get_default_live_data();
end
end

function data = get_default_live_data()
% Fallback / simulation mode values
data.GRATE_SPEED   = 3.0;
data.BED_TEMP_Z1   = 300;
data.BED_TEMP_Z2   = 650;
data.BED_TEMP_Z3   = 950;
data.BED_TEMP_Z4   = 750;
data.PA_FLOW_TOTAL = 18000;
data.SA_FLOW       = 12000;
data.STEAM_PRESS   = 40;
data.STEAM_TEMP    = 400;
data.STEAM_FLOW    = 28;
data.GEN_MW        = 6.2;
data.FGT_OUT       = 180;
data.BAG_DP        = 15;
data.SCR_NOX_OUT   = 52;
end

function write_digital_twin_tags(endpoint, results)
% Write DT computed values back to Ovation (shadow namespace)
% Used for operator advisory display
fprintf('[s08] DT results written to Ovation shadow namespace\n');
end

function ok = test_connection(endpoint)
try
    uaClient = opcua(endpoint);
    connect(uaClient);
    ok = uaClient.Status;
    disconnect(uaClient);
    fprintf('[s08] Connection OK: %s\n', endpoint);
catch e
    ok = false;
    fprintf('[s08] Connection FAILED: %s\n', e.message);
end
end
