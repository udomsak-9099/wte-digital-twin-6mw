%% s05_apc.m — Air Pollution Control model
% Typical WtE train: ESP/Bag Filter → SCR → Wet Scrubber

function apc = s05_apc(plant, grate)

fg_kgs = grate.fluegas_flow_kgs;

% --- Bag Filter ---
apc.bag.particulate_in_mgNm3  = 2000;   % mg/Nm³ (before bag)
apc.bag.removal_eff           = 0.997;  % 99.7%
apc.bag.particulate_out_mgNm3 = apc.bag.particulate_in_mgNm3 * (1 - apc.bag.removal_eff);
apc.bag.dp_mbar               = 15;     % pressure drop [mbar]
apc.bag.temp_in_c             = 180;    % must stay above acid dewpoint

% --- SCR (Selective Catalytic Reduction) ---
apc.scr.NOx_in_mgNm3  = 350;
apc.scr.removal_eff   = 0.85;
apc.scr.NOx_out_mgNm3 = apc.scr.NOx_in_mgNm3 * (1 - apc.scr.removal_eff);
apc.scr.urea_kgh      = fg_kgs * 3600 * apc.scr.NOx_in_mgNm3 * 1e-6 * 1.2;  % stoich × 1.2
apc.scr.temp_c        = 220;  % catalyst window

% --- Wet Scrubber (SO2/HCl/HF) ---
apc.scrubber.SO2_in_mgNm3   = 500;
apc.scrubber.HCl_in_mgNm3   = 800;
apc.scrubber.SO2_removal    = 0.95;
apc.scrubber.HCl_removal    = 0.98;
apc.scrubber.SO2_out_mgNm3  = apc.scrubber.SO2_in_mgNm3  * (1 - apc.scrubber.SO2_removal);
apc.scrubber.HCl_out_mgNm3  = apc.scrubber.HCl_in_mgNm3  * (1 - apc.scrubber.HCl_removal);
apc.scrubber.NaOH_kgh       = 50;  % NaOH consumption estimate

% Compliance check — Thailand MSWI emission standard (Pollution Control Dept.)
% Ref: Notification of Ministry of Natural Resources No. 2 (2553 BE)
limits.particulate = 20;   % mg/Nm³
limits.NOx         = 200;
limits.SO2         = 50;
limits.HCl         = 50;   % Thai standard 50 mg/Nm³ (EU IED = 10 — stricter)

apc.compliance.particulate = apc.bag.particulate_out_mgNm3  <= limits.particulate;
apc.compliance.NOx         = apc.scr.NOx_out_mgNm3          <= limits.NOx;
apc.compliance.SO2         = apc.scrubber.SO2_out_mgNm3     <= limits.SO2;
apc.compliance.HCl         = apc.scrubber.HCl_out_mgNm3     <= limits.HCl;
apc.compliance.all_pass    = all(struct2array(apc.compliance));

fprintf('[s05] APC: PM=%.1f | NOx=%.0f | SO2=%.1f | HCl=%.1f mg/Nm³ | Pass: %d\n', ...
    apc.bag.particulate_out_mgNm3, apc.scr.NOx_out_mgNm3, ...
    apc.scrubber.SO2_out_mgNm3, apc.scrubber.HCl_out_mgNm3, apc.compliance.all_pass);
end
