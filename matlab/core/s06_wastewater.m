%% s06_wastewater.m — Wastewater treatment model (TRC WW PhD)
% 12 streams / 3 trains / near-ZLD configuration

function ww = s06_wastewater(plant)

% --- Stream definitions (12 streams) ---
% Indexes: 1=MSW leachate, 2=Scrubber blowdown, 3=Boiler blowdown,
%          4=Cooling tower blowdown, 5=Floor drain, 6=Ash quench,
%          7=RO reject 1, 8=RO reject 2, 9=MBR effluent,
%          10=Condensate polisher regen, 11=Neutralization, 12=ZLD brine
streams = struct();
streams.names = {'MSW Leachate','Scrubber BD','Boiler BD','CT BD', ...
    'Floor Drain','Ash Quench','RO Reject 1','RO Reject 2', ...
    'MBR Effluent','CP Regen','Neutralization','ZLD Brine'};
streams.flow_m3h  = [5.0, 2.0, 0.5, 3.0, 1.0, 1.5, 1.2, 0.6, 4.0, 0.3, 0.8, 0.2];
streams.COD_mgL   = [8000,200,50,300,500,1500,800,2000,80,50,200,5000];
streams.TDS_mgL   = [5000,8000,2000,4000,1000,3000,15000,25000,500,2000,3000,60000];
streams.pH        = [6.5,4.0,8.5,8.0,7.0,9.0,7.0,7.0,7.2,5.0,7.0,7.5];

ww.streams = streams;
ww.n_streams = length(streams.names);

% --- 3-Train configuration ---
% Train A: Biological (MBR)
% Train B: Physical-Chemical (Coagulation/Floc + DAF)
% Train C: ZLD (RO + EVAP/CRYS)
ww.trains = struct();
ww.trains.A.name = 'MBR Biological';
ww.trains.A.inlet_streams = [1, 5, 6];
ww.trains.A.flow_m3h = sum(streams.flow_m3h([1,5,6]));
ww.trains.A.COD_removal = 0.95;

ww.trains.B.name = 'Physical-Chemical';
ww.trains.B.inlet_streams = [2, 3, 4];
ww.trains.B.flow_m3h = sum(streams.flow_m3h([2,3,4]));
ww.trains.B.TDS_removal = 0.30;

ww.trains.C.name = 'ZLD (RO + Evap)';
ww.trains.C.inlet_streams = [7, 8, 9, 10, 11];
ww.trains.C.flow_m3h = sum(streams.flow_m3h([7,8,9,10,11]));
ww.trains.C.recovery = 0.90;

% --- ZLD performance ---
total_in_m3h  = sum(streams.flow_m3h);
brine_m3h     = streams.flow_m3h(12);
ww.recovery_pct = (1 - brine_m3h / total_in_m3h) * 100;
ww.is_near_ZLD  = ww.recovery_pct >= 90;

ww.total_flow_m3h = total_in_m3h;
ww.brine_m3h      = brine_m3h;

fprintf('[s06] WW: %.1f m³/h in | %.1f%% recovery | Near-ZLD: %d\n', ...
    total_in_m3h, ww.recovery_pct, ww.is_near_ZLD);
end
