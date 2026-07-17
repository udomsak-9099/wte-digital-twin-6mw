%% s07_electrical.m — Generator + PPA dispatch model

function elec = s07_electrical(plant, cycle)

elec.gross_mw      = cycle.P_gross_mw;
elec.net_mw        = cycle.P_net_mw;
elec.efficiency_pct = (cycle.P_net_mw / plant.capacity_mw) * 100;
elec.capacity_factor = cycle.P_net_mw / plant.capacity_mw;

% PPA dispatch (VSPP Thailand — 6.6 MW < 10 MW threshold)
elec.ppa.tariff_thb_kwh = 4.24;    % VSPP adder rate (update per PPA)
elec.ppa.contracted_mw  = 6.0;
elec.ppa.curtailment_mw = max(0, elec.net_mw - elec.ppa.contracted_mw);

% Revenue estimate (annual)
hours_yr = 8000;  % operating hours/year
elec.revenue_thb_yr = elec.net_mw * 1000 * elec.ppa.tariff_thb_kwh * hours_yr;

fprintf('[s07] Net: %.2f MW | CF: %.1f%% | Revenue: %.1f M THB/yr\n', ...
    elec.net_mw, elec.capacity_factor*100, elec.revenue_thb_yr/1e6);
end
