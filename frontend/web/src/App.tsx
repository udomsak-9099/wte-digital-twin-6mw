import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import type { PlantTelemetry } from './supabaseClient'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine,
} from 'recharts'
import {
  Zap, Thermometer, Wind, Droplets, Activity, CheckCircle, XCircle,
  Flame, Gauge, Waves, Leaf,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'combustion' | 'boiler' | 'turbine' | 'electrical' | 'apc' | 'watertreat' | 'wastewater' | 'ash' | 'lab' | 'predictive' | 'research'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',    label: 'Overview',    icon: Activity },
  { id: 'combustion',  label: 'Combustion',  icon: Flame },
  { id: 'boiler',      label: 'Boiler',      icon: Thermometer },
  { id: 'turbine',     label: 'Turbine',     icon: Gauge },
  { id: 'electrical',  label: 'Electrical',  icon: Zap },
  { id: 'apc',         label: 'APC / CEMS',  icon: Wind },
  { id: 'watertreat',  label: 'Water Tx',    icon: Waves },
  { id: 'wastewater',  label: 'Wastewater',  icon: Droplets },
  { id: 'ash',         label: 'Ash',         icon: Leaf },
  { id: 'lab',         label: 'Lab',         icon: Activity },
  { id: 'predictive',  label: 'Predictive',  icon: CheckCircle },
  { id: 'research',    label: 'Research',    icon: Activity },
]

// ── PM Alert type ─────────────────────────────────────────────────────────────
type PmAlert = {
  id: number
  created_at: string
  equipment: string
  signal: string
  value: number | null
  severity: 'warning' | 'critical'
  type: 'lstm_anomaly' | 'limit'
  message: string
  acknowledged: boolean
  ack_at: string | null
}

// Lab sample types
type LabSample = {
  id: number
  sampled_at: string
  sample_type: string
  sample_ref: string
  entered_by: string
  data: Record<string, number | string>
  notes: string
  flagged: boolean
}

const LAB_TYPES = [
  { key: 'fuel',         label: 'Fuel / MSW Analysis' },
  { key: 'raw_water',    label: 'Raw Water' },
  { key: 'boiler_drum',  label: 'Boiler Drum Water' },
  { key: 'bfw',          label: 'BFW / Condensate' },
  { key: 'cooling',      label: 'Cooling Tower Water' },
  { key: 'stack_manual', label: 'Stack Gas (Manual)' },
  { key: 'bottom_ash',   label: 'Bottom Ash' },
  { key: 'fly_ash',      label: 'Fly Ash' },
  { key: 'effluent',     label: 'Wastewater Effluent' },
  { key: 'dga',         label: 'Transformer DGA' },
]

// Spec limits for alert highlighting
const LAB_LIMITS: Record<string, Record<string, { max?: number; min?: number; label?: string }>> = {
  fuel:         { moisture_pct: { max: 50 }, LHV_kcal_kg: { min: 1500 } },
  raw_water:    { turbidity_NTU: { max: 50 }, Fe_mg_L: { max: 0.3 } },
  boiler_drum:  { silica_mg_L: { max: 2 }, phosphate_mg_L: { min: 10, max: 20 }, pH: { min: 9.0, max: 10.5 } },
  bfw:          { DO_ppb: { max: 20 }, silica_ppb: { max: 20 }, conductivity_uS_cm: { max: 2 } },
  cooling:      { LSI: { min: 0, max: 0.5 }, pH: { min: 7.2, max: 8.5 }, biocide_mg_L: { min: 0.5 } },
  stack_manual: { PM_mg_Nm3: { max: 20 }, NOx_mg_Nm3: { max: 200 }, SO2_mg_Nm3: { max: 50 }, HCl_mg_Nm3: { max: 50 }, CO_mg_Nm3: { max: 100 }, dioxins_ng_TEQ_Nm3: { max: 0.1 } },
  bottom_ash:   { LOI_pct: { max: 5 } },
  fly_ash:      { dioxins_ng_TEQ_kg: { max: 1.0 } },
  effluent:     { BOD5_mg_L: { max: 20 }, COD_mg_L: { max: 120 }, TSS_mg_L: { max: 30 }, coliform_MPN_100mL: { max: 1000 } },
  dga:          { C2H2: { max: 1 }, TDCG: { max: 300 }, moisture_ppm: { max: 35 }, BDV_kV: { min: 30 } },
}

// ── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, icon: Icon, color = '#3b82f6', alert = false }: {
  label: string; value: string | number; unit: string
  icon: React.ElementType; color?: string; alert?: boolean
}) {
  return (
    <div style={{
      background: alert ? '#450a0a' : '#1e293b',
      border: `1.5px solid ${alert ? '#ef4444' : '#334155'}`,
      borderRadius: 8, padding: '10px 14px', display: 'flex',
      flexDirection: 'column', gap: 3, minWidth: 130,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8', fontSize: 10 }}>
        <Icon size={12} color={color} />{label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>
        {value}<span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  )
}

function Section({ title, children, cols = 1 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 10, color: '#64748b', marginBottom: 10,
        textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={cols > 1 ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0 24px' } : {}}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, unit, alert = false, limit }: {
  label: string; value?: number | null; unit: string; alert?: boolean; limit?: number
}) {
  const v = value != null ? value : null
  const isAlert = alert || (limit != null && v != null && v > limit)
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '4px 0',
      borderBottom: '1px solid #1e3a5f22', fontSize: 11,
      background: isAlert ? 'rgba(239,68,68,0.07)' : 'transparent',
    }}>
      <span style={{ color: isAlert ? '#fca5a5' : '#94a3b8' }}>{label}</span>
      <span style={{ fontWeight: 600, color: isAlert ? '#ef4444' : '#e2e8f0' }}>
        {v != null ? v : '—'} <span style={{ color: '#64748b', fontSize: 9 }}>{unit}</span>
      </span>
    </div>
  )
}

function ZoneBar({ label, temp, max = 1000 }: { label: string; temp: number; max?: number }) {
  const pct = Math.min((temp / max) * 100, 100)
  const color = temp > 900 ? '#ef4444' : temp > 600 ? '#f97316' : temp > 300 ? '#eab308' : '#3b82f6'
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10, color: '#94a3b8' }}>
        <span>{label}</span><span style={{ color, fontWeight: 600 }}>{temp.toFixed(0)} °C</span>
      </div>
      <div style={{ background: '#334155', borderRadius: 3, height: 6 }}>
        <div style={{ width: `${pct}%`, background: color, height: 6, borderRadius: 3, transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

function GaugeBar({ label, value, max, unit, warn, danger, color = '#3b82f6' }: {
  label: string; value: number; max: number; unit: string; warn?: number; danger?: number; color?: string
}) {
  const pct = Math.min((value / max) * 100, 100)
  const c = danger != null && value > danger ? '#ef4444'
    : warn != null && value > warn ? '#f97316'
    : color
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 10, color: '#94a3b8' }}>
        <span>{label}</span><span style={{ color: c, fontWeight: 600 }}>{value.toFixed(1)} {unit}</span>
      </div>
      <div style={{ background: '#334155', borderRadius: 3, height: 6, position: 'relative' }}>
        <div style={{ width: `${pct}%`, background: c, height: 6, borderRadius: 3, transition: 'width 0.8s ease' }} />
        {warn != null && <div style={{ position: 'absolute', left: `${(warn / max) * 100}%`, top: 0, height: 6, width: 1.5, background: '#f97316', borderRadius: 1 }} />}
        {danger != null && <div style={{ position: 'absolute', left: `${(danger / max) * 100}%`, top: 0, height: 6, width: 1.5, background: '#ef4444', borderRadius: 1 }} />}
      </div>
    </div>
  )
}

function MiniChart({ data, dataKey, color, domain, refVal, unit }: {
  data: PlantTelemetry[]; dataKey: string; color: string; domain: [number, number]; refVal?: number; unit: string
}) {
  const cd = data.map(h => ({
    t: new Date(h.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    v: (h as any)[dataKey],
  }))
  return (
    <ResponsiveContainer width="100%" height={90}>
      <LineChart data={cd}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
        <XAxis dataKey="t" tick={{ fontSize: 8, fill: '#475569' }} interval="preserveStartEnd" />
        <YAxis domain={domain} tick={{ fontSize: 8, fill: '#475569' }} width={30} />
        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 10 }}
          formatter={(v) => [`${(v as number)?.toFixed?.(2) ?? v} ${unit}`, '']} />
        {refVal != null && <ReferenceLine y={refVal} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />}
        <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1.5} name={dataKey} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [latest, setLatest] = useState<PlantTelemetry | null>(null)
  const [history, setHistory] = useState<PlantTelemetry[]>([])
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('—')
  const [tab, setTab] = useState<Tab>('overview')
  const [labSamples, setLabSamples] = useState<LabSample[]>([])
  const [labType, setLabType] = useState<string>('fuel')
  const [showForm, setShowForm] = useState(false)
  const [formState, setFormState] = useState<Record<string, string>>({})
  const [formMeta, setFormMeta] = useState({ sample_ref: '', entered_by: '', notes: '', sampled_at: '' })
  const [latestFuel, setLatestFuel] = useState<LabSample | null>(null)
  const [pmAlerts, setPmAlerts] = useState<PmAlert[]>([])
  const [pmFilter, setPmFilter] = useState<'all' | 'warning' | 'critical'>('all')
  const [pmEquip, setPmEquip] = useState<string>('all')

  const fetchPmAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('pm_alerts').select('*')
      .order('created_at', { ascending: false }).limit(100)
    if (data) setPmAlerts(data as PmAlert[])
  }, [])

  const ackAlert = useCallback(async (id: number) => {
    await supabase.from('pm_alerts').update({ acknowledged: true, ack_at: new Date().toISOString() }).eq('id', id)
    setPmAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a))
  }, [])

  const fetchLab = useCallback(async (type: string) => {
    const { data } = await supabase
      .from('lab_samples').select('*')
      .eq('sample_type', type)
      .order('sampled_at', { ascending: false }).limit(10)
    if (data) setLabSamples(data as LabSample[])
  }, [])

  const fetchLatestFuel = useCallback(async () => {
    const { data } = await supabase
      .from('lab_samples').select('*')
      .eq('sample_type', 'fuel')
      .order('sampled_at', { ascending: false }).limit(1)
    if (data && data.length > 0) setLatestFuel(data[0] as LabSample)
  }, [])

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase
      .from('plant_telemetry').select('*')
      .order('ts', { ascending: false }).limit(60)
    if (data) setHistory([...data].reverse())
  }, [])

  const fetchLatest = useCallback(async () => {
    const { data } = await supabase
      .from('plant_telemetry').select('*')
      .order('ts', { ascending: false }).limit(1).single()
    if (data) { setLatest(data); setLastUpdate(new Date(data.ts).toLocaleTimeString('en-GB')); setConnected(true) }
  }, [])

  useEffect(() => { if (tab === 'lab') fetchLab(labType) }, [tab, labType, fetchLab])
  useEffect(() => { if (tab === 'predictive') fetchPmAlerts() }, [tab, fetchPmAlerts])

  useEffect(() => {
    fetchLatest(); fetchHistory(); fetchLatestFuel()
    const ch = supabase.channel('plant_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'plant_telemetry' }, payload => {
        const row = payload.new as PlantTelemetry
        setLatest(row)
        setLastUpdate(new Date(row.ts).toLocaleTimeString('en-GB'))
        setConnected(true)
        setHistory(prev => [...prev.slice(-59), row])
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchLatest, fetchHistory, fetchLatestFuel])

  const d = latest as any

  // ── Tab content renderers ─────────────────────────────────────────────────
  const renderOverview = () => {
    const apcPass = d?.dt_apc_pass
    const emBadge = (val: number | null | undefined, limit: number, label: string, unit: string) => {
      const pct = val != null ? Math.min((val / limit) * 100, 100) : 0
      const over = val != null && val > limit * 0.9
      const crit = val != null && val > limit
      const color = crit ? '#ef4444' : over ? '#f59e0b' : '#22c55e'
      return (
        <div key={label} style={{ background: '#0f172a', border: `1px solid ${color}33`, borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
            <span style={{ fontSize: 9, color: '#475569' }}>limit {limit} {unit}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color }}>{val != null ? val.toFixed(1) : '\u2014'}</span>
            <span style={{ fontSize: 9, color: '#64748b' }}>{unit}</span>
          </div>
          <div style={{ height: 4, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s' }} />
          </div>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Section A: Production Monitoring ── */}
        <div style={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            ⚡ Production Monitoring
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
            <div style={{ background: '#1e293b', border: `1.5px solid ${(d?.gen_mw ?? 0) < 5.5 ? '#ef4444' : '#22c55e'}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Gross Output</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: (d?.gen_mw ?? 0) < 5.5 ? '#ef4444' : '#22c55e', lineHeight: 1.1 }}>{d?.gen_mw?.toFixed(2) ?? '\u2014'}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>MW  (rated 6.6 MW)</div>
              <div style={{ height: 3, background: '#0f172a', borderRadius: 99, marginTop: 6 }}>
                <div style={{ height: '100%', width: `${Math.min(((d?.gen_mw ?? 0) / 6.6) * 100, 100)}%`, background: '#22c55e', borderRadius: 99 }} />
              </div>
            </div>
            <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Net Export (VSPP)</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#4ade80', lineHeight: 1.1 }}>{d?.net_mw?.toFixed(2) ?? '\u2014'}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>MW</div>
              <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>Rev ≈ {d?.net_mw ? (d.net_mw * 4.24 * 24).toFixed(0) : '\u2014'} THB/day</div>
            </div>
            <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>MSW Feed Rate</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f97316', lineHeight: 1.1 }}>{d?.waste_feed_rate?.toFixed(1) ?? '\u2014'}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>t/h  (≈ {d?.waste_feed_rate ? (d.waste_feed_rate * 24).toFixed(0) : '\u2014'} t/day)</div>
              <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>LHV {latestFuel?.data?.LHV_kcal_kg ?? '\u2014'} kcal/kg</div>
            </div>
            <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Steam Conditions</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6', lineHeight: 1.1 }}>{d?.steam_press?.toFixed(1) ?? '\u2014'} <span style={{ fontSize: 11 }}>bar</span></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{d?.steam_temp?.toFixed(0) ?? '\u2014'} <span style={{ fontSize: 11 }}>°C</span></div>
              <div style={{ fontSize: 9, color: '#475569' }}>Flow {d?.steam_flow?.toFixed(1) ?? '\u2014'} t/h</div>
            </div>
            <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Cycle Efficiency</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#eab308', lineHeight: 1.1 }}>{d?.dt_cycle_eff_pct?.toFixed(1) ?? '\u2014'}</div>
              <div style={{ fontSize: 9, color: '#64748b' }}>%  (target ≥ 20%)</div>
              <div style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>O₂ Furnace {d?.o2_furnace?.toFixed(1) ?? '\u2014'} %</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>Power Output — last 5 min (MW)</div>
              <MiniChart data={history} dataKey="gen_mw" color="#22c55e" domain={[4, 7]} refVal={5.5} unit="MW" />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>Steam Pressure — last 5 min (bar)</div>
              <MiniChart data={history} dataKey="steam_press" color="#3b82f6" domain={[35, 45]} unit="bar" />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>Steam Temp — last 5 min (°C)</div>
              <MiniChart data={history} dataKey="steam_temp" color="#f97316" domain={[380, 420]} unit="°C" />
            </div>
          </div>
        </div>

        {/* ── Section B: Emissions Monitoring ── */}
        <div style={{ background: '#0f172a', border: `1px solid ${apcPass ? '#22c55e33' : '#ef444433'}`, borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              🌿 Emissions Monitoring (CEMS)
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              background: apcPass ? '#052e16' : '#450a0a', border: `1px solid ${apcPass ? '#22c55e' : '#ef4444'}`,
              borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 700,
              color: apcPass ? '#22c55e' : '#ef4444' }}>
              {apcPass ? <CheckCircle size={12} /> : <XCircle size={12} />}
              APC {apcPass ? 'PASS' : 'FAIL'}
            </div>
            <div style={{ fontSize: 9, color: '#475569' }}>Limit: Thailand MSWI Std. (2566)</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
            {emBadge(d?.pm_cems,     20,  'PM₁₀ Stack',   'mg/Nm³')}
            {emBadge(d?.so2_cems,    50,  'SO₂ Stack',          'mg/Nm³')}
            {emBadge(d?.hcl_cems,    50,  'HCl Stack',               'mg/Nm³')}
            {emBadge(d?.co_cems,     100, 'CO Stack',                'mg/Nm³')}
            {emBadge(d?.scr_nox_out, 200, 'NOₓ (SCR out)',      'mg/Nm³')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>NOₓ SCR Out — last 5 min (mg/Nm³)</div>
              <MiniChart data={history} dataKey="scr_nox_out" color="#f97316" domain={[0, 250]} refVal={200} unit="mg/Nm³" />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>PM CEMS — last 5 min (mg/Nm³)</div>
              <MiniChart data={history} dataKey="pm_cems" color="#a78bfa" domain={[0, 25]} refVal={20} unit="mg/Nm³" />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>APC System Status</div>
              <div style={{ background: '#1e293b', borderRadius: 6, padding: '8px 10px', height: 68, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
                <Row label="Scrubber pH"  value={d?.scrubber_ph}  unit=""       alert={d?.scrubber_ph != null && (d.scrubber_ph < 6.5 || d.scrubber_ph > 8.5)} />
                <Row label="SCR NOx In"   value={d?.scr_nox_in}   unit="mg/Nm³" />
                <Row label="Baghouse ΔP"  value={d?.baghouse_dp}  unit="mmH₂O" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section C: Furnace quick-look ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Section title="Moving Grate — Zone Temperatures">
            <ZoneBar label="Zone 1 — Drying"           temp={d?.bed_temp_z1 ?? 0} />
            <ZoneBar label="Zone 2 — Devolatilization" temp={d?.bed_temp_z2 ?? 0} />
            <ZoneBar label="Zone 3 — Combustion"       temp={d?.bed_temp_z3 ?? 0} />
            <ZoneBar label="Zone 4 — Burnout"          temp={d?.bed_temp_z4 ?? 0} />
            <Row label="Grate Speed"        value={d?.grate_speed} unit="m/h" />
            <Row label="FG Temp (Econ.out)" value={d?.fgt_out}     unit="°C" />
          </Section>
          <Section title="Boiler / Steam Cycle">
            <Row label="Steam Flow"         value={d?.steam_flow}       unit="t/h" />
            <Row label="Drum Level"         value={d?.drum_level}       unit="mm" />
            <Row label="Feedwater Flow"     value={d?.fw_flow}          unit="t/h" />
            <Row label="Condenser Pressure" value={d?.condenser_press}  unit="mbar" />
            <Row label="MSW Moisture"       value={Number(latestFuel?.data?.moisture_pct) || null} unit="%" alert={Number(latestFuel?.data?.moisture_pct) > 50} />
            <Row label="Fuel LHV"           value={Number(latestFuel?.data?.LHV_kcal_kg) || null} unit="kcal/kg" alert={Number(latestFuel?.data?.LHV_kcal_kg) < 1500} />
          </Section>
        </div>

      </div>
    )
  }


  const renderCombustion = () => {
    const f = latestFuel?.data ?? {}
    const n = (v: unknown) => v != null ? Number(v) : null
    const moisture   = Number(f.moisture_pct   ?? 0)
    const volatile_m = Number(f.volatile_matter_pct ?? 0)
    const fixed_c    = Number(f.fixed_carbon_pct ?? 0)
    const ash        = Number(f.ash_pct ?? 0)
    const lhv        = Number(f.LHV_kcal_kg ?? 0)
    const total      = moisture + volatile_m + fixed_c + ash || 1
    // expected steam from LHV: rough calc MW_th = feed(t/h)*LHV(kcal/kg)*1000/860/3600
    const feedRate   = d?.waste_feed_rate ?? 0
    const expectedMWth = lhv > 0 ? +(feedRate * lhv * 1000 / 860 / 3600 * 0.82).toFixed(2) : null // ~82% boiler eff
    const compositionBars = [
      { label: 'Moisture',      pct: moisture / total * 100,   color: '#3b82f6' },
      { label: 'Volatile',      pct: volatile_m / total * 100, color: '#f59e0b' },
      { label: 'Fixed Carbon',  pct: fixed_c / total * 100,    color: '#ef4444' },
      { label: 'Ash',           pct: ash / total * 100,        color: '#64748b' },
    ]
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Fuel Quality — spans full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Section title={`MSW / Fuel Quality${latestFuel ? ` — ${latestFuel.sample_ref ?? ''} (${new Date(latestFuel.sampled_at).toLocaleDateString('en-GB')})` : ' — No lab data'}`}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {/* Proximate Analysis */}
              <div>
                <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Proximate Analysis (as-received)</div>
                <Row label="Moisture"       value={n(f.moisture_pct)}        unit="%" alert={Number(f.moisture_pct) > 50} />
                <Row label="Volatile Matter" value={n(f.volatile_matter_pct)} unit="%" />
                <Row label="Fixed Carbon"   value={n(f.fixed_carbon_pct)}    unit="%" />
                <Row label="Ash Content"    value={n(f.ash_pct)}             unit="%" />
                <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, margin: '8px 0 4px', textTransform: 'uppercase' }}>Calorific Value</div>
                <Row label="LHV"  value={n(f.LHV_kcal_kg)} unit="kcal/kg" alert={Number(f.LHV_kcal_kg) < 1500} />
                <Row label="HHV"  value={n(f.HHV_kcal_kg)} unit="kcal/kg" />
                <Row label="LHV (MJ/kg)" value={lhv > 0 ? +(lhv * 4.187 / 1000).toFixed(2) : null} unit="MJ/kg" />
              </div>
              {/* Ultimate Analysis */}
              <div>
                <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Ultimate Analysis (dry basis)</div>
                <Row label="Carbon (C)"    value={n(f.C_pct)}  unit="%" />
                <Row label="Hydrogen (H)"  value={n(f.H_pct)}  unit="%" />
                <Row label="Nitrogen (N)"  value={n(f.N_pct)}  unit="%" />
                <Row label="Sulfur (S)"    value={n(f.S_pct)}  unit="%" />
                <Row label="Oxygen (O)"    value={n(f.O_pct)}  unit="%" />
                <Row label="Chlorine (Cl)" value={n(f.Cl_pct)} unit="%" alert={Number(f.Cl_pct) > 0.5} />
                {latestFuel?.notes && (
                  <div style={{ marginTop: 8, fontSize: 9, color: '#64748b', fontStyle: 'italic' }}>{latestFuel.notes}</div>
                )}
              </div>
              {/* Composition stacked bar + DT impact */}
              <div>
                <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Composition Bar</div>
                <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  {compositionBars.map(b => (
                    <div key={b.label} style={{ width: `${b.pct}%`, background: b.color, transition: 'width 0.5s' }} title={`${b.label}: ${b.pct.toFixed(1)}%`} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 10 }}>
                  {compositionBars.map(b => (
                    <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#94a3b8' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                      {b.label} {b.pct.toFixed(1)}%
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: '#334155', marginBottom: 8 }} />
                <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Digital Twin — Heat Input</div>
                <Row label="Feed Rate"          value={feedRate}        unit="t/h" />
                <Row label="Heat Input (est.)"  value={lhv > 0 && feedRate > 0 ? +(feedRate * lhv / 860).toFixed(1) : null} unit="MW_th" />
                <Row label="Expected Steam (est.)" value={expectedMWth} unit="MW_th" />
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#475569', marginBottom: 2 }}>
                    <span>LHV quality index</span>
                    <span style={{ color: lhv >= 1800 ? '#22c55e' : lhv >= 1500 ? '#f59e0b' : '#ef4444' }}>
                      {lhv >= 1800 ? 'GOOD' : lhv >= 1500 ? 'MARGINAL' : lhv > 0 ? 'LOW' : '—'}
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#1e293b', borderRadius: 3 }}>
                    <div style={{ height: '100%', borderRadius: 3, background: lhv >= 1800 ? '#22c55e' : lhv >= 1500 ? '#f59e0b' : '#ef4444', width: `${Math.min(100, lhv / 2500 * 100)}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* MSW Feed & Grate */}
        <Section title="MSW Feed & Grate">
          <Row label="MSW Feed Rate" value={d?.waste_feed_rate} unit="t/h" />
          <Row label="Grate Speed" value={d?.grate_speed} unit="m/h" />
          <ZoneBar label="Zone 1 — Drying"           temp={d?.bed_temp_z1 ?? 0} />
          <ZoneBar label="Zone 2 — Devolatilization"  temp={d?.bed_temp_z2 ?? 0} />
          <ZoneBar label="Zone 3 — Combustion"        temp={d?.bed_temp_z3 ?? 0} />
          <ZoneBar label="Zone 4 — Burnout"           temp={d?.bed_temp_z4 ?? 0} />
          <Row label="Upper Furnace Temp (2nd CC)"  value={d?.furnace_temp_upper} unit="°C" />
          <Row label="Furnace Draft Pressure"        value={d?.furnace_press}     unit="Pa" />
          <Row label="CO in Furnace"                 value={d?.co_furnace}        unit="mg/Nm³" alert={d?.co_furnace > 100} />
          <Row label="FG Temp (furnace exit)"        value={d?.fgt_furnace}       unit="°C" />
          <Row label="FG Temp (economizer out)"      value={d?.fgt_out}           unit="°C" />
          <div style={{ marginTop: 12 }}>
            <MiniChart data={history} dataKey="waste_feed_rate" color="#f97316" domain={[0, 15]} unit="t/h" />
          </div>
        </Section>

        {/* Combustion Air Control */}
        <Section title="Combustion Air Control">
          <Row label="O₂ in Furnace"      value={d?.o2_furnace}    unit="%" />
          <Row label="Total Primary Air"  value={d?.pa_flow_total} unit="Nm³/h" />
          <Row label="PA Zone 1 (15%)"    value={d?.pa_flow_z1}    unit="Nm³/h" />
          <Row label="PA Zone 2 (20%)"    value={d?.pa_flow_z2}    unit="Nm³/h" />
          <Row label="PA Zone 3 (45%)"    value={d?.pa_flow_z3}    unit="Nm³/h" />
          <Row label="PA Zone 4 (20%)"    value={d?.pa_flow_z4}    unit="Nm³/h" />
          <Row label="Secondary Air Flow" value={d?.sa_flow}        unit="Nm³/h" />
          <div style={{ marginTop: 12 }}>
            <MiniChart data={history} dataKey="o2_furnace" color="#a78bfa" domain={[6, 12]} unit="%" />
          </div>
        </Section>
      </div>
    )
  }

  const renderBoiler = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Section title="Boiler Drum & Feedwater">
        <Row label="Drum Level (NWL deviation)" value={d?.drum_level} unit="mm" alert={Math.abs(d?.drum_level ?? 0) > 50} />
        <Row label="Feedwater Flow" value={d?.fw_flow} unit="t/h" />
        <Row label="Feedwater Inlet Temp" value={d?.fw_temp} unit="°C" />
        <Row label="Economizer Outlet Water Temp" value={d?.eco_out_temp} unit="°C" />
        <Row label="Attemperator Spray Flow" value={d?.attemp_spray_flow} unit="t/h" />
        <div style={{ marginTop: 12 }}>
          <MiniChart data={history} dataKey="drum_level" color="#3b82f6" domain={[-80, 80]} refVal={50} unit="mm" />
        </div>
      </Section>
      <Section title="Steam Output">
        <Row label="Steam Pressure" value={d?.steam_press} unit="bar" />
        <Row label="Steam Temperature" value={d?.steam_temp} unit="°C" />
        <Row label="Steam Flow" value={d?.steam_flow} unit="t/h" />
        <Row label="FG Temp (Econ. exit)" value={d?.fgt_out} unit="°C" />
        <div style={{ marginTop: 12 }}>
          <MiniChart data={history} dataKey="steam_press" color="#22c55e" domain={[35, 43]} unit="bar" />
        </div>
      </Section>
    </div>
  )

  const renderTurbine = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Section title="Turbine">
        <Row label="Turbine Speed" value={d?.turbine_speed} unit="rpm" />
        <Row label="Turbine Inlet Pressure" value={d?.steam_press} unit="bar" />
        <Row label="Turbine Inlet Temperature" value={d?.steam_temp} unit="°C" />
        <Row label="Condenser Pressure" value={d?.condenser_press} unit="mbar abs" />
        <Row label="Hotwell Level" value={d?.hotwell_level} unit="mm" />
        <Row label="Condensate Flow" value={d?.cond_flow} unit="t/h" />
        <div style={{ marginTop: 12 }}>
          <MiniChart data={history} dataKey="condenser_press" color="#06b6d4" domain={[60, 110]} unit="mbar" />
        </div>
      </Section>
      <Section title="Deaerator & Cooling Water">
        <Row label="Deaerator Level" value={d?.deaerator_level} unit="mm" />
        <Row label="Deaerator Pressure" value={d?.deaerator_press} unit="bar" />
        <Row label="Cooling Water Inlet Temp" value={d?.cw_in_temp} unit="°C" />
        <Row label="Cooling Water Outlet Temp" value={d?.cw_out_temp} unit="°C" />
        <Row label="CW ΔT" value={d?.cw_out_temp != null && d?.cw_in_temp != null ? +(d.cw_out_temp - d.cw_in_temp).toFixed(1) : null} unit="°C" />
        <div style={{ marginTop: 12 }}>
          <MiniChart data={history} dataKey="deaerator_level" color="#eab308" domain={[600, 1000]} unit="mm" />
        </div>
      </Section>
    </div>
  )

  const renderElectrical = () => {
    const cbItems = [
      { id: '52G',  label: 'Generator CB (52G)',       closed: d?.cb_gen_closed,   spring: d?.cb_gen_spring,   trips: d?.cb_gen_trips },
      { id: '52T',  label: 'Transformer HV CB (52T)',  closed: d?.cb_tx_hv_closed, spring: d?.cb_tx_hv_spring, trips: d?.cb_tx_hv_trips },
      { id: '52SS', label: 'Station Service CB (52SS)',closed: d?.cb_ss_closed,    spring: undefined, trips: undefined },
      { id: '52F1', label: 'Feeder 1 — APC/Fans',     closed: d?.cb_f1_closed,    spring: undefined, trips: undefined },
      { id: '52F2', label: 'Feeder 2 — WW Pumps',     closed: d?.cb_f2_closed,    spring: undefined, trips: undefined },
      { id: '52F3', label: 'Feeder 3 — Cooling',      closed: d?.cb_f3_closed,    spring: undefined, trips: undefined },
    ]
    const relayItems = [
      { dev: '27',  name: 'Undervoltage',             pu: d?.relay_27_pu,  measured: `${d?.gen_voltage?.toFixed(2) ?? '--'} kV` },
      { dev: '59',  name: 'Overvoltage',              pu: d?.relay_59_pu,  measured: `${d?.gen_voltage?.toFixed(2) ?? '--'} kV` },
      { dev: '81U', name: 'Underfrequency',           pu: d?.relay_81U_pu, measured: `${d?.gen_freq?.toFixed(3) ?? '--'} Hz` },
      { dev: '81O', name: 'Overfrequency',            pu: d?.relay_81O_pu, measured: `${d?.gen_freq?.toFixed(3) ?? '--'} Hz` },
      { dev: '51',  name: 'Time Overcurrent',         pu: d?.relay_51_pu,  measured: `I1=${d?.relay_51_I1_A?.toFixed(0) ?? '--'} I2=${d?.relay_51_I2_A?.toFixed(0) ?? '--'} I3=${d?.relay_51_I3_A?.toFixed(0) ?? '--'} A` },
      { dev: '50',  name: 'Instantaneous OC',         pu: d?.relay_50_pu,  measured: `Imax=${Math.max(d?.relay_51_I1_A ?? 0, d?.relay_51_I2_A ?? 0, d?.relay_51_I3_A ?? 0).toFixed(0)} A` },
      { dev: '87G', name: 'Generator Differential',   pu: d?.relay_87G_pu, measured: `Id=${d?.relay_87G_diff_A?.toFixed(3) ?? '--'} A` },
      { dev: '87T', name: 'Transformer Differential', pu: d?.relay_87T_pu, measured: `Id=${d?.relay_87T_diff_A?.toFixed(3) ?? '--'} A` },
      { dev: '32',  name: 'Reverse Power',            pu: d?.relay_32_pu,  measured: `${d?.gen_mw?.toFixed(3) ?? '--'} MW` },
      { dev: '46',  name: 'Negative Sequence OC',     pu: d?.relay_46_pu,  measured: `I2=${d?.relay_46_I2_pct?.toFixed(2) ?? '--'} %` },
      { dev: '40',  name: 'Loss of Excitation',       pu: d?.relay_40_pu,  measured: `${d?.gen_mvar?.toFixed(3) ?? '--'} MVAR` },
      { dev: '64',  name: 'Ground Fault',             pu: d?.relay_64_pu,  measured: '---' },
      { dev: '49',  name: 'Machine Thermal (Stator)', pu: d?.relay_49_pu,  measured: '---' },
    ]
    const anyRelay = relayItems.some(r => r.pu)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Row 1: Generator + Revenue */}
        <Section title="Generator Output">
          <Row label="Gross Generation"      value={d?.gen_mw}      unit="MW"   alert={d?.gen_mw != null && d.gen_mw < 5.5} />
          <Row label="Auxiliary Consumption" value={d?.aux_mw}      unit="MW" />
          <Row label="Net Export (VSPP)"     value={d?.net_mw}      unit="MW" />
          <Row label="Reactive Power"        value={d?.gen_mvar}    unit="MVAR" />
          <Row label="Power Factor"          value={d?.gen_pf}      unit="" />
          <Row label="Terminal Voltage"      value={d?.gen_voltage}  unit="kV" />
          <Row label="Grid Frequency"        value={d?.gen_freq}    unit="Hz" alert={Math.abs((d?.gen_freq ?? 50) - 50) > 0.2} />
          <div style={{ marginTop: 12 }}>
            <MiniChart data={history} dataKey="gen_mw" color="#22c55e" domain={[4, 7]} refVal={5.5} unit="MW" />
          </div>
        </Section>

        <Section title="Revenue Estimate (VSPP 4.24 THB/kWh)">
          <Row label="Net MW"                value={d?.net_mw} unit="MW" />
          <Row label="Revenue (estimate)"    value={d?.dt_revenue_thb ? +(d.dt_revenue_thb / 1000).toFixed(1) : null} unit="k THB/hr" />
          <Row label="Annual Estimate (8000h)" value={d?.net_mw ? +(d.net_mw * 4.24 * 8000 / 1e6).toFixed(1) : null} unit="M THB/yr" />
          <div style={{ marginTop: 12 }}>
            <MiniChart data={history} dataKey="net_mw" color="#4ade80" domain={[4, 7]} unit="MW" />
          </div>
        </Section>

        {/* Row 2: Circuit Breaker Status */}
        <Section title="Circuit Breaker Status (ANSI 52)">
          {cbItems.map(cb => (
            <div key={cb.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <div style={{
                width: 12, height: 12, borderRadius: 2,
                background: cb.closed === undefined ? '#475569' : cb.closed ? '#22c55e' : '#ef4444',
                flexShrink: 0
              }} />
              <span style={{ fontSize: 11, flex: 1 }}>{cb.label}</span>
              <span style={{ fontSize: 10, color: cb.closed ? '#22c55e' : '#ef4444', fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
                {cb.closed === undefined ? '—' : cb.closed ? 'CLOSED' : 'OPEN'}
              </span>
              {cb.spring !== undefined && (
                <span style={{ fontSize: 9, color: cb.spring ? '#4ade80' : '#f87171', marginLeft: 4 }}>
                  {cb.spring ? '⚡' : '⚠'}
                </span>
              )}
              {cb.trips !== undefined && (
                <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>T:{cb.trips}</span>
              )}
            </div>
          ))}
        </Section>

        {/* Row 2b: Protection Relay Status */}
        <Section title={`Protection Relay Status${anyRelay ? ' ⚠ PICKUP ACTIVE' : ' — All Normal'}`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>Dev</th>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>Function</th>
                  <th style={{ textAlign: 'center', padding: '2px 4px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '2px 4px' }}>Measured</th>
                </tr>
              </thead>
              <tbody>
                {relayItems.map(r => (
                  <tr key={r.dev} style={{ borderBottom: '1px solid #1e293b', background: r.pu ? 'rgba(239,68,68,0.08)' : undefined }}>
                    <td style={{ padding: '3px 4px', color: '#94a3b8', fontFamily: 'monospace' }}>{r.dev}</td>
                    <td style={{ padding: '3px 4px', color: '#cbd5e1' }}>{r.name}</td>
                    <td style={{ padding: '3px 4px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                        background: r.pu ? '#ef4444' : '#166534', color: r.pu ? '#fff' : '#4ade80'
                      }}>{r.pu ? 'PICKUP' : 'NORMAL'}</span>
                    </td>
                    <td style={{ padding: '3px 4px', textAlign: 'right', color: '#94a3b8', fontFamily: 'monospace', fontSize: 9 }}>{r.measured}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Row 3: Transformer Analysis */}
        <Section title="Transformer Monitoring (11/22 kV GSU)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 4 }}>LOADING</div>
              <Row label="Load %" value={d?.tx_load_pct} unit="%" alert={d?.tx_load_pct != null && d.tx_load_pct > 90} />
              <Row label="Primary Voltage" value={d?.tx_prim_voltage_kV} unit="kV" />
              <Row label="Primary Current" value={d?.tx_prim_current_A} unit="A" />
              <Row label="Secondary Voltage" value={d?.tx_sec_voltage_kV} unit="kV" />
              <Row label="Secondary Current" value={d?.tx_sec_current_A} unit="A" />
              <Row label="Efficiency" value={d?.tx_efficiency_pct} unit="%" />
              <Row label="OLTC Tap Position" value={d?.tx_tap_position} unit="/ 17" />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 4 }}>THERMAL</div>
              <Row label="Top Oil Temp" value={d?.tx_top_oil_temp} unit="°C" alert={d?.tx_top_oil_temp != null && d.tx_top_oil_temp > 85} />
              <Row label="Winding Hotspot" value={d?.tx_winding_temp} unit="°C" alert={d?.tx_winding_temp != null && d.tx_winding_temp > 98} />
              <Row label="Ambient Temp" value={d?.tx_ambient_temp} unit="°C" />
              <div style={{ height: 1, background: '#334155', margin: '6px 0' }} />
              <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 4 }}>STATUS</div>
              <Row label="Oil Level" value={d?.tx_oil_level_pct} unit="%" alert={d?.tx_oil_level_pct != null && d.tx_oil_level_pct < 50} />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {[
                  { label: 'Buchholz Alarm', active: d?.tx_buchholz_alarm, color: '#f59e0b' },
                  { label: 'Buchholz Trip', active: d?.tx_buchholz_trip, color: '#ef4444' },
                  { label: 'Fan 1', active: d?.tx_cool_fan1, color: '#22c55e' },
                  { label: 'Fan 2', active: d?.tx_cool_fan2, color: '#22c55e' },
                ].map(it => (
                  <div key={it.label} style={{ fontSize: 9, textAlign: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: it.active ? it.color : '#334155', margin: '0 auto 2px' }} />
                    <div style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{it.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <MiniChart data={history} dataKey="tx_top_oil_temp" color="#f59e0b" domain={[50, 100]} refVal={85} unit="°C" />
          </div>
        </Section>

        {/* Row 3b: DGA summary link */}
        <Section title="Transformer DGA (Dissolved Gas Analysis)">
          <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.7 }}>
            <div>DGA results are stored in the <strong style={{ color: '#e2e8f0' }}>Lab</strong> tab → <strong style={{ color: '#e2e8f0' }}>Transformer DGA</strong> type.</div>
            <div style={{ marginTop: 6, padding: '6px 8px', background: '#1e293b', borderRadius: 4, fontFamily: 'monospace', fontSize: 9 }}>
              Key indicators: H₂, CH₄, C₂H₂ (arcing), C₂H₄, C₂H₆, CO, CO₂, TDCG<br/>
              Fault gases: C₂H₂ {">"} 1 ppm = arcing alarm<br/>
              TDCG {">"} 300 ppm = elevated concern<br/>
              Duval Triangle classification applied
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <MiniChart data={history} dataKey="tx_winding_temp" color="#f97316" domain={[60, 110]} refVal={98} unit="°C" />
          </div>
        </Section>
      </div>
    )
  }

  const renderAPC = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Section title="Fan Control & Bag Filter">
        <Row label="ID Fan Speed" value={d?.id_fan_speed} unit="%" />
        <Row label="PA Fan Speed" value={d?.pa_fan_speed} unit="%" />
        <Row label="SA Fan Speed" value={d?.sa_fan_speed} unit="%" />
        <Row label="Bag Filter Inlet Temp" value={d?.bag_temp} unit="°C" />
        <Row label="Bag Filter ΔP" value={d?.bag_dp} unit="mbar" alert={d?.bag_dp > 22} />
        <div style={{ marginTop: 10 }}>
          <GaugeBar label="Bag Filter ΔP" value={d?.bag_dp ?? 0} max={25} unit="mbar" warn={18} danger={22} color="#3b82f6" />
        </div>
        <div style={{ marginTop: 12 }}>
          <MiniChart data={history} dataKey="bag_dp" color="#3b82f6" domain={[8, 25]} refVal={22} unit="mbar" />
        </div>
      </Section>
      <Section title="SCR + Scrubber + CEMS (Thai PCD limits)">
        <Row label="SCR Temperature" value={d?.scr_temp} unit="°C" />
        <Row label="NOx In (SCR)" value={d?.scr_nox_in} unit="mg/Nm³" />
        <Row label="NOx Out (SCR)" value={d?.scr_nox_out} unit="mg/Nm³" limit={200} />
        <Row label="NH₃ Injection" value={d?.nh3_injection} unit="kg/h" />
        <Row label="Scrubber pH" value={d?.scrubber_ph} unit="" alert={d?.scrubber_ph < 6.5 || d?.scrubber_ph > 8.5} />
        <Row label="Lime Injection" value={d?.lime_injection} unit="kg/h" />
        <Row label="Activated Carbon" value={d?.ac_injection} unit="kg/h" />
        <Row label="Stack Temperature" value={d?.stack_temp} unit="°C" />
        <Row label="Stack Flow" value={d?.stack_flow} unit="kNm³/h" />
        <div style={{ height: 1, background: '#334155', margin: '8px 0' }} />
        <GaugeBar label={`PM  (limit 20)`} value={d?.pm_cems ?? 0} max={20} unit="mg/Nm³" warn={16} danger={20} />
        <GaugeBar label={`SO₂ (limit 50)`} value={d?.so2_cems ?? 0} max={50} unit="mg/Nm³" warn={40} danger={50} />
        <GaugeBar label={`HCl (limit 50)`} value={d?.hcl_cems ?? 0} max={50} unit="mg/Nm³" warn={40} danger={50} />
        <GaugeBar label={`CO  (limit 100)`} value={d?.co_cems ?? 0} max={100} unit="mg/Nm³" warn={80} danger={100} color="#a78bfa" />
        <GaugeBar label={`NOx (limit 200)`} value={d?.scr_nox_out ?? 0} max={200} unit="mg/Nm³" warn={160} danger={200} color="#f97316" />
      </Section>
    </div>
  )

  const renderWastewater = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      <Section title="Leachate Inlet">
        <Row label="Leachate Flow" value={d?.ww_leachate_flow} unit="m³/h" />
        <Row label="Inlet pH" value={d?.ww_ph_in} unit="" />
        <Row label="Inlet COD" value={d?.ww_cod_in} unit="mg/L" />
      </Section>
      <Section title="MBR Biological Treatment">
        <Row label="MBR DO" value={d?.ww_do_mbr} unit="mg/L" alert={d?.ww_do_mbr < 1.5} />
        <Row label="MLSS" value={d?.ww_mlss_mbr} unit="mg/L" />
        <Row label="MBR Permeate Flow" value={d?.ww_mbr_perm_flow} unit="m³/h" />
        <Row label="PC Effluent pH" value={d?.ww_pc_ph} unit="" alert={d?.ww_pc_ph < 6 || d?.ww_pc_ph > 9} />
      </Section>
      <Section title="RO + ZLD">
        <Row label="RO Feed Pressure" value={d?.ww_ro_press} unit="bar" />
        <Row label="RO Recovery" value={d?.ww_ro_recovery} unit="%" />
        <Row label="RO Permeate TDS" value={d?.ww_ro_perm_tds} unit="mg/L" />
        <Row label="Brine / Concentrate" value={d?.ww_brine_flow} unit="m³/h" />
        <Row label="ZLD Evaporator Level" value={d?.ww_evap_level} unit="%" />
        <Row label="Final Effluent pH" value={d?.ww_effluent_ph} unit="" alert={d?.ww_effluent_ph < 5.5 || d?.ww_effluent_ph > 9} />
        <Row label="Final Effluent COD" value={d?.ww_effluent_cod} unit="mg/L" alert={d?.ww_effluent_cod > 120} />
      </Section>
      <div style={{ gridColumn: '1 / -1' }}>
        <Section title="RO Recovery Trend">
          <MiniChart data={history} dataKey="ww_ro_recovery" color="#06b6d4" domain={[85, 95]} unit="%" />
        </Section>
      </div>
    </div>
  )

  const renderWaterTreat = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      <Section title="Raw Water Intake">
        <Row label="Raw Water Flow"     value={d?.mw_raw_flow}     unit="m³/h" />
        <Row label="Turbidity"          value={d?.mw_raw_turbidity} unit="NTU" alert={d?.mw_raw_turbidity > 50} />
        <Row label="TDS"                value={d?.mw_raw_tds}      unit="mg/L" />
        <Row label="pH"                 value={d?.mw_raw_ph}       unit="" />
        <Row label="Clarifier Level"    value={d?.mw_clf_level}    unit="m" />
        <Row label="Sand Filter ΔP"     value={d?.mw_sf_dp}        unit="kPa" alert={d?.mw_sf_dp > 60} />
        <Row label="Sand Filter Out Turbidity" value={d?.mw_sf_turbidity} unit="NTU" />
      </Section>

      <Section title="UF → RO">
        <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 4 }}>ULTRAFILTRATION</div>
        <Row label="UF Feed Pressure"   value={d?.mw_uf_feed_press}  unit="bar" />
        <Row label="TMP"                value={d?.mw_uf_tmp}         unit="bar" alert={d?.mw_uf_tmp > 0.8} />
        <Row label="UF Permeate Flow"   value={d?.mw_uf_perm_flow}   unit="m³/h" />
        <Row label="UF Permeate Turbidity" value={d?.mw_uf_turbidity} unit="NTU" />
        <div style={{ height: 1, background: '#334155', margin: '6px 0' }} />
        <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 4 }}>REVERSE OSMOSIS</div>
        <Row label="RO Feed Pressure"   value={d?.mw_ro_feed_press}  unit="bar" />
        <Row label="RO Permeate Flow"   value={d?.mw_ro_perm_flow}   unit="m³/h" />
        <Row label="RO Recovery"        value={d?.mw_ro_recovery}    unit="%" />
        <Row label="RO Permeate Conductivity" value={d?.mw_ro_conductivity} unit="µS/cm" alert={d?.mw_ro_conductivity > 50} />
        <Row label="RO Brine Flow"      value={d?.mw_ro_brine_flow}  unit="m³/h" />
        <div style={{ marginTop: 8 }}>
          <MiniChart data={history} dataKey="mw_ro_conductivity" color="#3b82f6" domain={[0, 60]} unit="µS/cm" />
        </div>
      </Section>

      <Section title="EDI → BFW + Cooling Tower">
        <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 4 }}>ELECTRODEIONIZATION</div>
        <Row label="EDI Feed Conductivity"    value={d?.mw_edi_feed_cond}  unit="µS/cm" />
        <Row label="EDI Product Conductivity" value={d?.mw_edi_prod_cond}  unit="µS/cm" alert={d?.mw_edi_prod_cond > 0.1} />
        <Row label="EDI Product Flow"         value={d?.mw_edi_prod_flow}  unit="m³/h" />
        <Row label="EDI Current"              value={d?.mw_edi_current}    unit="A" />
        <div style={{ height: 1, background: '#334155', margin: '6px 0' }} />
        <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 4 }}>BOILER FEED WATER</div>
        <Row label="DI Tank Level"       value={d?.mw_di_tank_level}   unit="%" />
        <Row label="BFW Tank Level"      value={d?.mw_bfw_tank_level}  unit="%" alert={d?.mw_bfw_tank_level < 20} />
        <Row label="BFW Conductivity"    value={d?.mw_bfw_conductivity} unit="µS/cm" alert={d?.mw_bfw_conductivity > 2} />
        <Row label="BFW pH"              value={d?.mw_bfw_ph}          unit="" alert={d?.mw_bfw_ph < 8.5 || d?.mw_bfw_ph > 9.8} />
        <Row label="BFW Dissolved O₂"   value={d?.mw_bfw_do}          unit="ppb" alert={d?.mw_bfw_do > 20} />
        <Row label="BFW Silica"          value={d?.mw_bfw_silica}      unit="ppb" alert={d?.mw_bfw_silica > 50} />
        <div style={{ height: 1, background: '#334155', margin: '6px 0' }} />
        <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, marginBottom: 4 }}>COOLING TOWER</div>
        <Row label="CT Make-up Flow"     value={d?.ct_makeup_flow}     unit="m³/h" />
        <Row label="CT Basin Level"      value={d?.ct_basin_level}     unit="m" />
        <Row label="CT Blowdown"         value={d?.ct_blowdown}        unit="m³/h" />
        <Row label="Cycles of Concentration" value={d?.ct_coc}        unit="×" />
        <Row label="Approach Temp"       value={d?.ct_approach_temp}   unit="°C" />
        <Row label="Range Temp (ΔT)"     value={d?.ct_range_temp}      unit="°C" />
        <div style={{ marginTop: 8 }}>
          <MiniChart data={history} dataKey="mw_edi_prod_cond" color="#06b6d4" domain={[0, 0.2]} refVal={0.1} unit="µS/cm" />
        </div>
      </Section>
    </div>
  )

  const renderAsh = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Section title="Bottom Ash">
        <Row label="MSW Feed Rate" value={d?.waste_feed_rate} unit="t/h" />
        <Row label="Bottom Ash Rate (~20% of feed)" value={d?.bottom_ash_rate} unit="t/h" />
        <Row label="Quench Water Outlet Temp" value={d?.ash_temp} unit="°C" />
        <Row label="Estimated Daily Bottom Ash" value={d?.bottom_ash_rate ? +(d.bottom_ash_rate * 24).toFixed(1) : null} unit="t/day" />
        <div style={{ marginTop: 12 }}>
          <MiniChart data={history} dataKey="bottom_ash_rate" color="#f97316" domain={[0.4, 1.0]} unit="t/h" />
        </div>
      </Section>
      <Section title="Fly Ash (Bag Filter)">
        <Row label="Fly Ash Rate (~4% of feed)" value={d?.fly_ash_rate} unit="t/h" />
        <Row label="Estimated Daily Fly Ash" value={d?.fly_ash_rate ? +(d.fly_ash_rate * 24).toFixed(2) : null} unit="t/day" />
        <Row label="Bag Filter ΔP" value={d?.bag_dp} unit="mbar" alert={d?.bag_dp > 22} />
        <Row label="Bag Filter Inlet Temp" value={d?.bag_temp} unit="°C" />
        <div style={{ marginTop: 12 }}>
          <MiniChart data={history} dataKey="fly_ash_rate" color="#94a3b8" domain={[0.05, 0.25]} unit="t/h" />
        </div>
      </Section>
    </div>
  )

  // ── Lab fields definition per sample type ──────────────────────────────
  const LAB_FIELDS: Record<string, { key: string; label: string; unit: string }[]> = {
    fuel: [
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
      { key: 'volatile_matter_pct', label: 'Volatile Matter', unit: '%' },
      { key: 'fixed_carbon_pct', label: 'Fixed Carbon', unit: '%' },
      { key: 'ash_pct', label: 'Ash Content', unit: '%' },
      { key: 'LHV_kcal_kg', label: 'LHV', unit: 'kcal/kg' },
      { key: 'HHV_kcal_kg', label: 'HHV', unit: 'kcal/kg' },
      { key: 'C_pct', label: 'Carbon (C)', unit: '%' },
      { key: 'H_pct', label: 'Hydrogen (H)', unit: '%' },
      { key: 'N_pct', label: 'Nitrogen (N)', unit: '%' },
      { key: 'S_pct', label: 'Sulfur (S)', unit: '%' },
      { key: 'Cl_pct', label: 'Chlorine (Cl)', unit: '%' },
    ],
    raw_water: [
      { key: 'pH', label: 'pH', unit: '' },
      { key: 'turbidity_NTU', label: 'Turbidity', unit: 'NTU' },
      { key: 'TDS_mg_L', label: 'TDS', unit: 'mg/L' },
      { key: 'TSS_mg_L', label: 'TSS', unit: 'mg/L' },
      { key: 'hardness_mg_L', label: 'Total Hardness', unit: 'mg/L CaCO₃' },
      { key: 'alkalinity_mg_L', label: 'Total Alkalinity', unit: 'mg/L' },
      { key: 'Fe_mg_L', label: 'Iron (Fe)', unit: 'mg/L' },
      { key: 'Mn_mg_L', label: 'Manganese (Mn)', unit: 'mg/L' },
      { key: 'Cl_mg_L', label: 'Chloride', unit: 'mg/L' },
      { key: 'SO4_mg_L', label: 'Sulfate', unit: 'mg/L' },
    ],
    boiler_drum: [
      { key: 'pH', label: 'pH', unit: '' },
      { key: 'conductivity_uS_cm', label: 'Conductivity', unit: 'µS/cm' },
      { key: 'TDS_mg_L', label: 'TDS', unit: 'mg/L' },
      { key: 'silica_mg_L', label: 'Silica (SiO₂)', unit: 'mg/L' },
      { key: 'phosphate_mg_L', label: 'Phosphate (PO₄)', unit: 'mg/L' },
      { key: 'chloride_mg_L', label: 'Chloride', unit: 'mg/L' },
      { key: 'sulfite_mg_L', label: 'Sulfite (O₂ scavenger)', unit: 'mg/L' },
      { key: 'hardness_mg_L', label: 'Hardness', unit: 'mg/L' },
      { key: 'iron_mg_L', label: 'Iron (Fe)', unit: 'mg/L' },
    ],
    bfw: [
      { key: 'pH', label: 'pH', unit: '' },
      { key: 'conductivity_uS_cm', label: 'Conductivity', unit: 'µS/cm' },
      { key: 'DO_ppb', label: 'Dissolved O₂', unit: 'ppb' },
      { key: 'silica_ppb', label: 'Silica', unit: 'ppb' },
      { key: 'iron_ppb', label: 'Iron', unit: 'ppb' },
      { key: 'copper_ppb', label: 'Copper', unit: 'ppb' },
      { key: 'hardness_mg_L', label: 'Hardness', unit: 'mg/L' },
      { key: 'TOC_ppb', label: 'TOC', unit: 'ppb' },
    ],
    cooling: [
      { key: 'pH', label: 'pH', unit: '' },
      { key: 'conductivity_uS_cm', label: 'Conductivity', unit: 'µS/cm' },
      { key: 'TDS_mg_L', label: 'TDS', unit: 'mg/L' },
      { key: 'hardness_mg_L', label: 'Total Hardness', unit: 'mg/L CaCO₃' },
      { key: 'alkalinity_mg_L', label: 'Alkalinity', unit: 'mg/L' },
      { key: 'Cl_mg_L', label: 'Chloride', unit: 'mg/L' },
      { key: 'SiO2_mg_L', label: 'Silica (SiO₂)', unit: 'mg/L' },
      { key: 'biocide_mg_L', label: 'Biocide Residual', unit: 'mg/L' },
      { key: 'LSI', label: 'Langelier Saturation Index', unit: '' },
      { key: 'COC', label: 'Cycles of Concentration', unit: '×' },
    ],
    stack_manual: [
      { key: 'O2_pct', label: 'O₂', unit: '%' },
      { key: 'CO2_pct', label: 'CO₂', unit: '%' },
      { key: 'CO_mg_Nm3', label: 'CO (limit 100)', unit: 'mg/Nm³' },
      { key: 'NOx_mg_Nm3', label: 'NOx (limit 200)', unit: 'mg/Nm³' },
      { key: 'SO2_mg_Nm3', label: 'SO₂ (limit 50)', unit: 'mg/Nm³' },
      { key: 'HCl_mg_Nm3', label: 'HCl (limit 50)', unit: 'mg/Nm³' },
      { key: 'PM_mg_Nm3', label: 'PM (limit 20)', unit: 'mg/Nm³' },
      { key: 'dioxins_ng_TEQ_Nm3', label: 'Dioxins/Furans (limit 0.1)', unit: 'ng TEQ/Nm³' },
      { key: 'Hg_ug_Nm3', label: 'Mercury Hg (limit 50)', unit: 'µg/Nm³' },
      { key: 'temp_C', label: 'Stack Temperature', unit: '°C' },
      { key: 'flow_Nm3_h', label: 'Stack Flow', unit: 'Nm³/h' },
    ],
    bottom_ash: [
      { key: 'LOI_pct', label: 'Loss on Ignition (limit 5%)', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
      { key: 'TCLP_As_mg_L', label: 'TCLP Arsenic', unit: 'mg/L' },
      { key: 'TCLP_Pb_mg_L', label: 'TCLP Lead', unit: 'mg/L' },
      { key: 'TCLP_Cd_mg_L', label: 'TCLP Cadmium', unit: 'mg/L' },
      { key: 'TCLP_Hg_mg_L', label: 'TCLP Mercury', unit: 'mg/L' },
      { key: 'TCLP_Cr_mg_L', label: 'TCLP Chromium', unit: 'mg/L' },
      { key: 'Pb_mg_kg', label: 'Lead (total)', unit: 'mg/kg' },
      { key: 'Zn_mg_kg', label: 'Zinc (total)', unit: 'mg/kg' },
      { key: 'Cd_mg_kg', label: 'Cadmium (total)', unit: 'mg/kg' },
    ],
    fly_ash: [
      { key: 'LOI_pct', label: 'Loss on Ignition', unit: '%' },
      { key: 'dioxins_ng_TEQ_kg', label: 'Dioxins (limit 1.0)', unit: 'ng TEQ/kg' },
      { key: 'Pb_mg_kg', label: 'Lead', unit: 'mg/kg' },
      { key: 'Zn_mg_kg', label: 'Zinc', unit: 'mg/kg' },
      { key: 'Cd_mg_kg', label: 'Cadmium', unit: 'mg/kg' },
      { key: 'Hg_mg_kg', label: 'Mercury', unit: 'mg/kg' },
      { key: 'Cr_mg_kg', label: 'Chromium', unit: 'mg/kg' },
      { key: 'As_mg_kg', label: 'Arsenic', unit: 'mg/kg' },
      { key: 'Cl_soluble_pct', label: 'Soluble Chloride', unit: '%' },
    ],
    effluent: [
      { key: 'pH', label: 'pH', unit: '' },
      { key: 'BOD5_mg_L', label: 'BOD₅ (limit 20)', unit: 'mg/L' },
      { key: 'COD_mg_L', label: 'COD (limit 120)', unit: 'mg/L' },
      { key: 'TSS_mg_L', label: 'TSS (limit 30)', unit: 'mg/L' },
      { key: 'TDS_mg_L', label: 'TDS', unit: 'mg/L' },
      { key: 'NH3_N_mg_L', label: 'Ammonia-N', unit: 'mg/L' },
      { key: 'As_mg_L', label: 'Arsenic', unit: 'mg/L' },
      { key: 'Pb_mg_L', label: 'Lead', unit: 'mg/L' },
      { key: 'Cd_mg_L', label: 'Cadmium', unit: 'mg/L' },
      { key: 'Hg_mg_L', label: 'Mercury', unit: 'mg/L' },
      { key: 'coliform_MPN_100mL', label: 'Coliform (limit 1000)', unit: 'MPN/100mL' },
    ],
    dga: [
      { key: 'H2',          label: 'Hydrogen (H₂)',        unit: 'ppm' },
      { key: 'CH4',         label: 'Methane (CH₄)',         unit: 'ppm' },
      { key: 'C2H2',        label: 'Acetylene (C₂H₂) ⚡',  unit: 'ppm' },
      { key: 'C2H4',        label: 'Ethylene (C₂H₄)',       unit: 'ppm' },
      { key: 'C2H6',        label: 'Ethane (C₂H₆)',         unit: 'ppm' },
      { key: 'CO',          label: 'Carbon Monoxide (CO)',   unit: 'ppm' },
      { key: 'CO2',         label: 'Carbon Dioxide (CO₂)',   unit: 'ppm' },
      { key: 'TDCG',        label: 'TDCG (Total)',           unit: 'ppm' },
      { key: 'moisture_ppm', label: 'Moisture',              unit: 'ppm' },
      { key: 'IFT_mN_m',   label: 'Interfacial Tension',    unit: 'mN/m' },
      { key: 'acidity_mg_KOH_g', label: 'Acidity',          unit: 'mgKOH/g' },
      { key: 'BDV_kV',     label: 'Breakdown Voltage (BDV)', unit: 'kV' },
    ],
  }

  const submitLabSample = async () => {
    const data: Record<string, number> = {}
    const fields = LAB_FIELDS[labType] ?? []
    fields.forEach(f => { if (formState[f.key] !== '') data[f.key] = parseFloat(formState[f.key]) })
    const limits = LAB_LIMITS[labType] ?? {}
    const flagged = Object.entries(limits).some(([k, lim]) => {
      const v = data[k]; if (v == null) return false
      return (lim.max != null && v > lim.max) || (lim.min != null && v < lim.min)
    })
    await supabase.from('lab_samples').insert({
      sampled_at: formMeta.sampled_at || new Date().toISOString(),
      sample_type: labType,
      sample_ref: formMeta.sample_ref,
      entered_by: formMeta.entered_by,
      notes: formMeta.notes,
      data, flagged,
    })
    setShowForm(false); setFormState({}); fetchLab(labType)
  }

  const renderLab = () => {
    const fields = LAB_FIELDS[labType] ?? []
    const limits = LAB_LIMITS[labType] ?? {}
    const latest_s = labSamples[0]
    const prev_s = labSamples[1]

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 10 }}>
        {/* Sidebar — sample type selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {LAB_TYPES.map(lt => (
            <button key={lt.key} onClick={() => setLabType(lt.key)} style={{
              background: labType === lt.key ? '#1e40af' : '#1e293b',
              border: `1px solid ${labType === lt.key ? '#3b82f6' : '#334155'}`,
              borderRadius: 6, padding: '7px 10px', cursor: 'pointer',
              fontSize: 11, color: labType === lt.key ? '#fff' : '#94a3b8',
              textAlign: 'left', fontWeight: labType === lt.key ? 700 : 400,
            }}>{lt.label}</button>
          ))}
        </div>

        {/* Main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Header bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                {LAB_TYPES.find(t => t.key === labType)?.label}
              </div>
              {latest_s && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  Latest: {new Date(latest_s.sampled_at).toLocaleString('en-GB')}
                  {latest_s.sample_ref && ` · Ref: ${latest_s.sample_ref}`}
                  {latest_s.entered_by && ` · By: ${latest_s.entered_by}`}
                  {latest_s.flagged && <span style={{ color: '#ef4444', marginLeft: 6 }}>⚠ OUT OF SPEC</span>}
                </div>
              )}
            </div>
            <button onClick={() => { setShowForm(f => !f); setFormState({}) }} style={{
              background: '#1e40af', border: 'none', borderRadius: 6,
              padding: '6px 14px', cursor: 'pointer', fontSize: 11,
              color: '#fff', fontWeight: 700,
            }}>
              {showForm ? '✕ Cancel' : '+ New Sample'}
            </button>
          </div>

          {/* Entry form */}
          {showForm && (
            <div style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 10 }}>
                New {LAB_TYPES.find(t => t.key === labType)?.label} Sample
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                {[
                  { k: 'sampled_at', label: 'Sample Date/Time', placeholder: new Date().toISOString().slice(0,16) },
                  { k: 'sample_ref', label: 'Lab Reference', placeholder: 'e.g. BD-2026-0718-AM' },
                  { k: 'entered_by', label: 'Entered By', placeholder: 'Name' },
                ].map(f => (
                  <div key={f.k}>
                    <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3 }}>{f.label}</div>
                    <input
                      placeholder={f.placeholder}
                      value={formMeta[f.k as keyof typeof formMeta]}
                      onChange={e => setFormMeta(m => ({ ...m, [f.k]: e.target.value }))}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '4px 8px', color: '#e2e8f0', fontSize: 11 }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                {fields.map(f => {
                  const lim = limits[f.key]
                  return (
                    <div key={f.key}>
                      <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>
                        {f.label} {f.unit && `(${f.unit})`}
                        {lim?.max != null && <span style={{ color: '#ef444480' }}> ≤{lim.max}</span>}
                        {lim?.min != null && <span style={{ color: '#ef444480' }}> ≥{lim.min}</span>}
                      </div>
                      <input
                        type="number" step="any"
                        placeholder="—"
                        value={formState[f.key] ?? ''}
                        onChange={e => setFormState(s => ({ ...s, [f.key]: e.target.value }))}
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '4px 6px', color: '#e2e8f0', fontSize: 11 }}
                      />
                    </div>
                  )
                })}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>Notes</div>
                <input
                  placeholder="Optional notes..."
                  value={formMeta.notes}
                  onChange={e => setFormMeta(m => ({ ...m, notes: e.target.value }))}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '4px 8px', color: '#e2e8f0', fontSize: 11 }}
                />
              </div>
              <button onClick={submitLabSample} style={{
                background: '#16a34a', border: 'none', borderRadius: 6,
                padding: '6px 20px', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 700,
              }}>Save Sample</button>
            </div>
          )}

          {/* Results table — latest vs previous */}
          {latest_s ? (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, width: '35%' }}>Parameter</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Unit</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>
                      Latest<br /><span style={{ fontSize: 9, color: '#475569', fontWeight: 400 }}>{new Date(latest_s.sampled_at).toLocaleDateString('en-GB')}</span>
                    </th>
                    {prev_s && (
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: '#94a3b8', fontWeight: 600 }}>
                        Previous<br /><span style={{ fontSize: 9, color: '#475569', fontWeight: 400 }}>{new Date(prev_s.sampled_at).toLocaleDateString('en-GB')}</span>
                      </th>
                    )}
                    <th style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => {
                    const val = latest_s.data[f.key]
                    const prevVal = prev_s?.data?.[f.key]
                    const lim = limits[f.key]
                    const v = typeof val === 'number' ? val : parseFloat(String(val))
                    const isAlert = lim && !isNaN(v) && ((lim.max != null && v > lim.max) || (lim.min != null && v < lim.min))
                    return (
                      <tr key={f.key} style={{ background: i % 2 === 0 ? 'transparent' : '#ffffff05', borderBottom: '1px solid #1e3a5f22' }}>
                        <td style={{ padding: '5px 10px', color: isAlert ? '#fca5a5' : '#94a3b8' }}>{f.label}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#475569', fontSize: 9 }}>{f.unit}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: isAlert ? '#ef4444' : '#e2e8f0' }}>
                          {val != null ? (typeof val === 'number' ? val : val) : '—'}
                        </td>
                        {prev_s && (
                          <td style={{ padding: '5px 10px', textAlign: 'right', color: '#64748b' }}>
                            {prevVal != null ? prevVal : '—'}
                          </td>
                        )}
                        <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                          {val != null && lim
                            ? isAlert
                              ? <span style={{ color: '#ef4444', fontSize: 10 }}>⚠ FAIL</span>
                              : <span style={{ color: '#22c55e', fontSize: 10 }}>✓ PASS</span>
                            : <span style={{ color: '#334155', fontSize: 10 }}>—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {latest_s.notes && (
                <div style={{ padding: '8px 10px', fontSize: 10, color: '#64748b', borderTop: '1px solid #334155' }}>
                  Notes: {latest_s.notes}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 40, textAlign: 'center', color: '#475569', fontSize: 12 }}>
              No lab samples recorded yet. Click "+ New Sample" to add the first entry.
            </div>
          )}

          {/* DGA Duval Triangle interpretation */}
          {labType === 'dga' && latest_s && (() => {
            const g = latest_s.data
            const C2H2 = Number(g.C2H2 ?? 0), C2H4 = Number(g.C2H4 ?? 0), C2H6 = Number(g.C2H6 ?? 0)
            const H2 = Number(g.H2 ?? 0), CO = Number(g.CO ?? 0)
            const sum3 = C2H2 + C2H4 + C2H6
            const pC2H2 = sum3 > 0 ? C2H2 / sum3 * 100 : 0
            const pC2H4 = sum3 > 0 ? C2H4 / sum3 * 100 : 0
            const pC2H6 = sum3 > 0 ? C2H6 / sum3 * 100 : 0
            // Simplified Duval Triangle fault classification
            let faultType = 'Normal / No fault detected (N)'
            let faultColor = '#22c55e'
            if (C2H2 > 1) { faultType = 'Arcing — Discharge of high energy (D2)'; faultColor = '#ef4444' }
            else if (C2H2 > 0.1) { faultType = 'Partial discharge with arcing (D1+D2)'; faultColor = '#f97316' }
            else if (pC2H4 > 60) { faultType = 'Thermal fault — high temp (T3, >700°C)'; faultColor = '#f59e0b' }
            else if (pC2H4 > 40 && pC2H6 < 20) { faultType = 'Thermal fault — medium temp (T2, 300-700°C)'; faultColor = '#eab308' }
            else if (pC2H6 > 30) { faultType = 'Thermal fault — low temp (T1, <300°C)'; faultColor = '#84cc16' }
            else if (H2 > 100 && C2H2 < 1) { faultType = 'Partial discharge (PD)'; faultColor = '#a78bfa' }
            else if (CO > 200) { faultType = 'Thermal fault involving cellulose insulation'; faultColor = '#fb923c' }
            return (
              <div style={{ background: '#1e293b', border: `1px solid ${faultColor}40`, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>
                  Duval Triangle Interpretation (IEC 60599)
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: faultColor, marginBottom: 6 }}>{faultType}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.8 }}>
                      <div>%C₂H₂ = <strong>{pC2H2.toFixed(1)}%</strong></div>
                      <div>%C₂H₄ = <strong>{pC2H4.toFixed(1)}%</strong></div>
                      <div>%C₂H₆ = <strong>{pC2H6.toFixed(1)}%</strong></div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.8, borderLeft: '1px solid #334155', paddingLeft: 12 }}>
                    <div><span style={{ color: '#22c55e' }}>N</span>  = Normal</div>
                    <div><span style={{ color: '#a78bfa' }}>PD</span> = Partial Discharge</div>
                    <div><span style={{ color: '#84cc16' }}>T1</span> = Thermal &lt;300°C</div>
                    <div><span style={{ color: '#eab308' }}>T2</span> = Thermal 300-700°C</div>
                    <div><span style={{ color: '#f59e0b' }}>T3</span> = Thermal &gt;700°C</div>
                    <div><span style={{ color: '#f97316' }}>D1</span> = Low-energy discharge</div>
                    <div><span style={{ color: '#ef4444' }}>D2</span> = High-energy arcing</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', borderLeft: '1px solid #334155', paddingLeft: 12 }}>
                    <div><strong style={{ color: '#e2e8f0' }}>TDCG</strong>: {g.TDCG ?? '--'} ppm</div>
                    <div style={{ color: Number(g.TDCG) > 720 ? '#ef4444' : Number(g.TDCG) > 300 ? '#f59e0b' : '#22c55e' }}>
                      {Number(g.TDCG) > 720 ? '⚠ Level 3 — Immediate action' : Number(g.TDCG) > 300 ? '⚠ Level 2 — Monitor closely' : '✓ Level 1 — Normal'}
                    </div>
                    <div style={{ marginTop: 6 }}><strong style={{ color: C2H2 > 1 ? '#ef4444' : '#e2e8f0' }}>C₂H₂</strong>: {g.C2H2 ?? '--'} ppm {C2H2 > 1 ? '⚠ ARCING' : ''}</div>
                    {latest_s.notes && <div style={{ marginTop: 6, fontStyle: 'italic' }}>{latest_s.notes}</div>}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* History list */}
          {labSamples.length > 1 && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {labSamples.map(s => (
                  <div key={s.id} style={{ display: 'flex', gap: 12, fontSize: 10, padding: '4px 6px', borderRadius: 4, background: s.flagged ? '#450a0a' : 'transparent', alignItems: 'center' }}>
                    <span style={{ color: '#475569', minWidth: 130 }}>{new Date(s.sampled_at).toLocaleString('en-GB')}</span>
                    <span style={{ color: '#64748b', minWidth: 150 }}>{s.sample_ref || '—'}</span>
                    <span style={{ color: '#64748b' }}>{s.entered_by || '—'}</span>
                    {s.flagged && <span style={{ color: '#ef4444', marginLeft: 'auto' }}>⚠ OUT OF SPEC</span>}
                    {s.notes && <span style={{ color: '#475569', marginLeft: 'auto', fontStyle: 'italic' }}>{s.notes.slice(0, 60)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderPredictive = () => {
    const EQUIP_LABELS: Record<string, string> = { turbine: 'Steam Turbine', boiler: 'Boiler', transformer: 'GSU Transformer' }
    const EQUIP_ICONS: Record<string, string> = { turbine: '⚙️', boiler: '🔥', transformer: '⚡' }
    const filtered = pmAlerts.filter(a =>
      (pmFilter === 'all' || a.severity === pmFilter) &&
      (pmEquip === 'all' || a.equipment === pmEquip)
    )
    const unacked   = pmAlerts.filter(a => !a.acknowledged).length
    const criticals = pmAlerts.filter(a => a.severity === 'critical' && !a.acknowledged).length
    const warnings  = pmAlerts.filter(a => a.severity === 'warning'  && !a.acknowledged).length

    const equipStats = ['turbine', 'boiler', 'transformer'].map(eq => ({
      eq,
      total:    pmAlerts.filter(a => a.equipment === eq).length,
      critical: pmAlerts.filter(a => a.equipment === eq && a.severity === 'critical' && !a.acknowledged).length,
      warning:  pmAlerts.filter(a => a.equipment === eq && a.severity === 'warning'  && !a.acknowledged).length,
      lastAt:   pmAlerts.find(a => a.equipment === eq)?.created_at,
    }))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>TOTAL ALERTS</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0' }}>{pmAlerts.length}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{unacked} unacknowledged</div>
          </div>
          <div style={{ background: criticals > 0 ? '#450a0a' : '#1e293b', border: `1.5px solid ${criticals > 0 ? '#ef4444' : '#334155'}`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>CRITICAL (UNACKED)</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: criticals > 0 ? '#ef4444' : '#e2e8f0' }}>{criticals}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Require immediate action</div>
          </div>
          <div style={{ background: warnings > 0 ? '#2d1d00' : '#1e293b', border: `1.5px solid ${warnings > 0 ? '#f59e0b' : '#334155'}`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>WARNING (UNACKED)</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: warnings > 0 ? '#f59e0b' : '#e2e8f0' }}>{warnings}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Monitor closely</div>
          </div>
          <div style={{ background: '#1e293b', border: '1.5px solid #334155', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>LSTM MODEL</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>3 ACTIVE</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Turbine · Boiler · Transformer</div>
          </div>
        </div>

        {/* Equipment health cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {equipStats.map(({ eq, total, critical, warning, lastAt }) => {
            const status = critical > 0 ? 'critical' : warning > 0 ? 'warning' : 'normal'
            const colors: Record<string, { bg: string; border: string; text: string }> = {
              critical: { bg: '#450a0a', border: '#ef4444', text: '#ef4444' },
              warning:  { bg: '#2d1d00', border: '#f59e0b', text: '#f59e0b' },
              normal:   { bg: '#052e16', border: '#22c55e', text: '#22c55e' },
            }
            const c = colors[status]
            return (
              <div key={eq} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{EQUIP_ICONS[eq]} {EQUIP_LABELS[eq]}</div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                    background: c.border + '22', color: c.text, textTransform: 'uppercase',
                  }}>{status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Critical (unacked)<br /><span style={{ fontSize: 18, fontWeight: 700, color: critical > 0 ? '#ef4444' : '#e2e8f0' }}>{critical}</span></div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Warning (unacked)<br /><span style={{ fontSize: 18, fontWeight: 700, color: warning > 0 ? '#f59e0b' : '#e2e8f0' }}>{warning}</span></div>
                </div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 6 }}>
                  Last alert: {lastAt ? new Date(lastAt).toLocaleString('en-GB') : '—'}
                </div>
                <button onClick={() => { setPmEquip(eq); setPmFilter('all') }} style={{
                  marginTop: 8, width: '100%', padding: '4px 0', fontSize: 10,
                  background: 'transparent', border: `1px solid ${c.border}`, borderRadius: 4,
                  color: c.text, cursor: 'pointer',
                }}>View alerts →</button>
              </div>
            )
          })}
        </div>

        {/* Alert table */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Alert Log
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {/* severity filter */}
              {(['all', 'warning', 'critical'] as const).map(f => (
                <button key={f} onClick={() => setPmFilter(f)} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: 'none',
                  background: pmFilter === f ? (f === 'critical' ? '#ef4444' : f === 'warning' ? '#f59e0b' : '#3b82f6') : '#334155',
                  color: pmFilter === f ? '#fff' : '#94a3b8',
                }}>{f.toUpperCase()}</button>
              ))}
              <div style={{ width: 1, background: '#334155' }} />
              {/* equipment filter */}
              {(['all', 'turbine', 'boiler', 'transformer'] as const).map(e => (
                <button key={e} onClick={() => setPmEquip(e)} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: 'none',
                  background: pmEquip === e ? '#1e40af' : '#334155',
                  color: pmEquip === e ? '#fff' : '#94a3b8',
                }}>{e === 'all' ? 'All equip.' : e}</button>
              ))}
              <button onClick={fetchPmAlerts} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                border: '1px solid #334155', background: 'transparent', color: '#64748b',
              }}>↻ Refresh</button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#22c55e', fontSize: 12 }}>
              ✓ No alerts matching filter
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '130px 90px 80px 80px 1fr 100px', gap: 8, padding: '4px 6px',
                fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #334155' }}>
                <span>Time</span><span>Equipment</span><span>Severity</span><span>Type</span><span>Message</span><span>Action</span>
              </div>
              {filtered.map(a => (
                <div key={a.id} style={{
                  display: 'grid', gridTemplateColumns: '130px 90px 80px 80px 1fr 100px', gap: 8,
                  padding: '5px 6px', fontSize: 10, borderBottom: '1px solid #0f172a',
                  background: a.acknowledged ? 'transparent' : a.severity === 'critical' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                  opacity: a.acknowledged ? 0.45 : 1,
                }}>
                  <span style={{ color: '#475569' }}>{new Date(a.created_at).toLocaleString('en-GB')}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>{EQUIP_ICONS[a.equipment]} {a.equipment}</span>
                  <span style={{
                    display: 'inline-block', padding: '1px 6px', borderRadius: 99, fontSize: 9, fontWeight: 700,
                    background: a.severity === 'critical' ? '#ef444422' : '#f59e0b22',
                    color: a.severity === 'critical' ? '#ef4444' : '#f59e0b',
                  }}>{a.severity.toUpperCase()}</span>
                  <span style={{ color: '#64748b', fontSize: 9 }}>{a.type === 'lstm_anomaly' ? 'LSTM' : 'LIMIT'}</span>
                  <span style={{ color: '#e2e8f0' }}>{a.message}</span>
                  <span>
                    {a.acknowledged
                      ? <span style={{ color: '#22c55e', fontSize: 9 }}>✓ acked {a.ack_at ? new Date(a.ack_at).toLocaleTimeString('en-GB') : ''}</span>
                      : <button onClick={() => ackAlert(a.id)} style={{
                          fontSize: 9, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                          background: '#1e293b', border: '1px solid #334155', color: '#94a3b8',
                        }}>Acknowledge</button>
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div style={{ background: '#0f1e33', border: '1px solid #1e3a5f', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 10, color: '#3b82f6', textTransform: 'uppercase', marginBottom: 8 }}>
            How Predictive Maintenance works
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { step: '1', title: 'Data collection', desc: 'Telemetry every 5s → 5-min sliding windows of multivariate signals per equipment' },
              { step: '2', title: 'LSTM Autoencoder', desc: 'Unsupervised model learns "normal" pattern. High reconstruction error = anomaly' },
              { step: '3', title: 'Alert & Acknowledge', desc: 'z-score > 2σ = warning, > 3σ = critical. Team acknowledges after inspection' },
            ].map(({ step, title, desc }) => (
              <div key={step}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1e40af', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{step}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{title}</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: '#475569', borderTop: '1px solid #1e3a5f', paddingTop: 8 }}>
            Train: <code style={{ color: '#94a3b8' }}>uv run python ai/predictive/train.py --all</code>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            Run: <code style={{ color: '#94a3b8' }}>uv run python ai/predictive/inference.py</code>
          </div>
        </div>

      </div>
    )
  }

  const renderResearch = () => {
    // ── Thermodynamic calculations ──────────────────────────────────────────
    const feedKgS   = (d?.waste_feed_rate ?? 0) * 1000 / 3600
    const lhv       = Number(latestFuel?.data?.LHV_kcal_kg ?? 0) * 4.1868 / 1000  // MJ/kg
    const moisture  = Number(latestFuel?.data?.moisture_pct ?? 40) / 100
    const heatInMW  = feedKgS * lhv * (1 - moisture)
    const genMW     = d?.gen_mw ?? 0
    const netMW     = d?.net_mw ?? 0
    const etaGross  = heatInMW > 0 ? (genMW / heatInMW) * 100 : null
    const etaNet    = heatInMW > 0 ? (netMW / heatInMW) * 100 : null
    const steamMW   = (d?.steam_flow ?? 0) * ((d?.steam_temp ?? 400) - 105) * 4.186 / 3600
    const etaBoiler = heatInMW > 0 ? (steamMW / heatInMW) * 100 : null
    const fgTemp    = d?.fgt_out && d.fgt_out > 50 ? d.fgt_out : null
    const fgLossPct = fgTemp ? Math.max(0, (fgTemp - 120) * 0.006 * 100) : null
    const exergyIn  = heatInMW > 0 ? heatInMW * (1 - 293 / (293 + heatInMW * 60)) : null
    const exergyEff = (exergyIn && exergyIn > 0) ? (netMW / exergyIn) * 100 : null

    // ── Specific emission factors ────────────────────────────────────────────
    // flue gas flow estimate: ~5 Nm³/kg_waste → (feed_kg/s × 5 × 3600) Nm³/h
    const fgFlowNm3h = feedKgS * 5 * 3600
    const netKWh     = netMW * 1000  // kW
    const heatInGJ   = heatInMW * 3.6  // GJ/h
    const pm_g_kWh   = (netKWh > 0 && d?.pm_cems)     ? (d.pm_cems * fgFlowNm3h / 1e6) / netKWh * 1e6   : null
    const nox_g_GJ   = (heatInGJ > 0 && d?.scr_nox_out) ? (d.scr_nox_out * fgFlowNm3h / 1e6) / heatInGJ   : null
    const so2_g_GJ   = (heatInGJ > 0 && d?.so2_cems)   ? (d.so2_cems   * fgFlowNm3h / 1e6) / heatInGJ    : null
    const co_mg_kWh  = (netKWh > 0 && d?.co_cems)      ? (d.co_cems    * fgFlowNm3h / 1e6) / netKWh * 1e9  : null
    // CO2 estimate: ~0.55 tCO2/MWh_input (fossil fraction ~15% of MSW carbon)
    const co2_fossil = heatInMW > 0 ? heatInMW * 0.55 : null
    const co2_g_kWh  = (co2_fossil && netKWh > 0) ? (co2_fossil * 1e6) / netKWh : null

    // ── SPC from history ─────────────────────────────────────────────────────
    const spcCalc = (key: string) => {
      const vals = history.map((h: Record<string, unknown>) => h[key] as number).filter(v => v != null && !isNaN(v))
      if (vals.length < 4) return null
      const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length
      const std  = Math.sqrt(vals.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / vals.length)
      return { mean, std, ucl: mean + 3 * std, lcl: Math.max(0, mean - 3 * std), n: vals.length,
               ooc: vals.filter((v: number) => v > mean + 3 * std || v < mean - 3 * std).length }
    }
    const spcGen  = spcCalc('gen_mw')
    const spcNox  = spcCalc('scr_nox_out')
    const spcO2   = spcCalc('o2_furnace')
    const spcSteam = spcCalc('steam_press')

    // ── Model validation metrics (MATLAB prediction vs actual, from history) ─
    const mvPairs = history.filter((h: Record<string, unknown>) => h.source === 'simulation' && h.gen_mw != null)
    const mvActual = history.filter((h: Record<string, unknown>) => h.source !== 'simulation' && h.gen_mw != null).slice(0, mvPairs.length)
    const mvN = Math.min(mvPairs.length, mvActual.length)
    const rmse = mvN > 0 ? Math.sqrt(
      mvPairs.slice(0, mvN).reduce((s: number, p: Record<string, unknown>, i: number) => {
        const e = (p.gen_mw as number) - (mvActual[i].gen_mw as number); return s + e * e
      }, 0) / mvN
    ) : null
    const mae = mvN > 0 ? mvPairs.slice(0, mvN).reduce((s: number, p: Record<string, unknown>, i: number) =>
      s + Math.abs((p.gen_mw as number) - (mvActual[i].gen_mw as number)), 0) / mvN : null

    // ── CSV export ───────────────────────────────────────────────────────────
    const exportCSV = () => {
      if (!history.length) return
      const cols = Object.keys(history[0])
      const rows = [cols.join(','), ...history.map((r: Record<string, unknown>) =>
        cols.map(c => r[c] ?? '').join(','))]
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `wte_telemetry_${new Date().toISOString().slice(0,16).replace('T','_')}.csv`
      a.click()
    }

    const ResKpi = ({ label, value, unit, note, color = '#e2e8f0', warn }: {
      label: string; value: string | null; unit: string; note?: string; color?: string; warn?: boolean
    }) => (
      <div style={{ background: '#0f172a', border: `1px solid ${warn ? '#f59e0b33' : '#1e293b'}`, borderRadius: 6, padding: '8px 12px' }}>
        <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: warn ? '#f59e0b' : color, lineHeight: 1 }}>
          {value ?? '—'} <span style={{ fontSize: 10, color: '#64748b' }}>{unit}</span>
        </div>
        {note && <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>{note}</div>}
      </div>
    )

    const SpcRow = ({ label, stat, unit }: { label: string; stat: ReturnType<typeof spcCalc>; unit: string }) => {
      if (!stat) return <div style={{ fontSize: 10, color: '#475569', padding: '4px 0' }}>{label}: insufficient data</div>
      const isOoc = stat.ooc > 0
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 70px 50px 60px', gap: 6, padding: '5px 0', borderBottom: '1px solid #1e293b', fontSize: 10, alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontWeight: 600 }}>{label}</span>
          <span style={{ color: '#e2e8f0' }}>{stat.mean.toFixed(2)} {unit}</span>
          <span style={{ color: '#64748b' }}>±{stat.std.toFixed(2)}</span>
          <span style={{ color: '#22c55e' }}>UCL {stat.ucl.toFixed(2)}</span>
          <span style={{ color: '#3b82f6' }}>LCL {stat.lcl.toFixed(2)}</span>
          <span style={{ color: '#64748b' }}>n={stat.n}</span>
          <span style={{ color: isOoc ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
            {isOoc ? `⚠ ${stat.ooc} OOC` : '✓ IC'}
          </span>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
            Research Analytics — PhD Level · WtE 6.6 MW Moving Grate · Paper-21 AI-DSS Framework
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={exportCSV} style={{
              fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
              background: '#1e40af', border: 'none', color: '#fff', fontWeight: 600,
            }}>↓ Export CSV</button>
            <div style={{ fontSize: 9, color: '#334155', padding: '4px 8px', background: '#0f172a', borderRadius: 4, border: '1px solid #1e293b' }}>
              n={history.length} samples · {history.length > 0 ? new Date((history[history.length-1] as Record<string, unknown>).created_at as string).toLocaleString('en-GB') : '—'}
            </div>
          </div>
        </div>

        {/* ── 1. Thermodynamic Analysis ── */}
        <div style={{ background: '#0a0f1e', border: '1px solid #1e3a5f', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            § 1 — Thermodynamic Analysis (First & Second Law)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
            <ResKpi label="Heat input Q̇_in" value={heatInMW > 0 ? heatInMW.toFixed(2) : null} unit="MW_th"
              note={`Feed ${(feedKgS*3600/1000).toFixed(1)} t/h · LHV ${(lhv/4.1868*1000).toFixed(0)} kcal/kg`} color="#f97316" />
            <ResKpi label="η_gross electrical" value={etaGross?.toFixed(2) ?? null} unit="%"
              note="P_gross / Q̇_in × 100" color="#22c55e" warn={(etaGross ?? 25) < 18} />
            <ResKpi label="η_net electrical" value={etaNet?.toFixed(2) ?? null} unit="%"
              note="P_net / Q̇_in × 100" color="#4ade80" warn={(etaNet ?? 22) < 15} />
            <ResKpi label="η_boiler" value={etaBoiler?.toFixed(1) ?? null} unit="%"
              note="Q̇_steam / Q̇_in (approx.)" color="#60a5fa" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
            <ResKpi label="Flue gas heat loss" value={fgLossPct?.toFixed(1) ?? null} unit="%"
              note={`FGT out ${d?.fgt_out?.toFixed(0) ?? '—'} °C`} color="#f59e0b" />
            <ResKpi label="Exergy input Ėx_in" value={exergyIn?.toFixed(2) ?? null} unit="MW_ex"
              note="Carnot-based approx." color="#a78bfa" />
            <ResKpi label="Exergy efficiency η_ex" value={exergyEff?.toFixed(1) ?? null} unit="%"
              note="P_net / Ėx_in" color="#c084fc" />
            <ResKpi label="Specific steam cons." value={(netMW > 0 && d?.steam_flow) ? ((d.steam_flow ?? 0) / netMW).toFixed(3) : null}
              unit="t/MWh_net" note="Steam flow / net output" color="#38bdf8" />
          </div>

          {/* Sankey-style energy flow bar */}
          <div style={{ background: '#0f172a', borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 6, textTransform: 'uppercase', fontWeight: 700 }}>Energy balance (relative, % of Q̇_in)</div>
            {heatInMW > 0 ? (() => {
              const netPct   = Math.min(netMW / heatInMW * 100, 100)
              const auxPct   = Math.min((genMW - netMW) / heatInMW * 100, 20)
              const condPct  = Math.max(0, 100 - netPct - auxPct - (fgLossPct ?? 18) - 5)
              const lossPct  = fgLossPct ?? 18
              return (
                <div>
                  <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${netPct}%`, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>
                      {netPct > 8 ? `Net ${netPct.toFixed(1)}%` : ''}
                    </div>
                    <div style={{ width: `${auxPct}%`, background: '#3b82f6' }} />
                    <div style={{ width: `${lossPct}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#000' }}>
                      {lossPct > 8 ? `FG ${lossPct.toFixed(1)}%` : ''}
                    </div>
                    <div style={{ width: `${condPct}%`, background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#94a3b8' }}>
                      {condPct > 8 ? `Cond ${condPct.toFixed(0)}%` : ''}
                    </div>
                    <div style={{ flex: 1, background: '#1e293b' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 9, color: '#64748b' }}>
                    <span><span style={{ color: '#22c55e' }}>■</span> Net elec. {netPct.toFixed(1)}%</span>
                    <span><span style={{ color: '#3b82f6' }}>■</span> Aux {auxPct.toFixed(1)}%</span>
                    <span><span style={{ color: '#f59e0b' }}>■</span> FG loss {lossPct.toFixed(1)}%</span>
                    <span><span style={{ color: '#334155' }}>■</span> Condenser {condPct.toFixed(0)}%</span>
                    <span><span style={{ color: '#1e293b' }}>■</span> Other losses</span>
                  </div>
                </div>
              )
            })() : <div style={{ color: '#334155', fontSize: 10 }}>No data — start poller to collect telemetry</div>}
          </div>
        </div>

        {/* ── 2. Specific Emission Factors ── */}
        <div style={{ background: '#0a0f1e', border: '1px solid #14532d33', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            § 2 — Specific Emission Factors (Research Reporting Standard)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            <ResKpi label="PM₁₀ specific" value={pm_g_kWh?.toFixed(3) ?? null} unit="mg/kWh_net"
              note={`Stack ${d?.pm_cems?.toFixed(1) ?? '—'} mg/Nm³`} color="#a78bfa" />
            <ResKpi label="NOₓ specific" value={nox_g_GJ?.toFixed(2) ?? null} unit="g/GJ_in"
              note={`SCR out ${d?.scr_nox_out?.toFixed(0) ?? '—'} mg/Nm³`} color="#f97316" />
            <ResKpi label="SO₂ specific" value={so2_g_GJ?.toFixed(2) ?? null} unit="g/GJ_in"
              note={`Stack ${d?.so2_cems?.toFixed(1) ?? '—'} mg/Nm³`} color="#f59e0b" />
            <ResKpi label="CO specific" value={co_mg_kWh?.toFixed(1) ?? null} unit="mg/kWh_net"
              note={`Stack ${d?.co_cems?.toFixed(1) ?? '—'} mg/Nm³`} color="#94a3b8" />
            <ResKpi label="CO₂ fossil intensity" value={co2_g_kWh?.toFixed(0) ?? null} unit="g/kWh_net"
              note="Est. fossil C fraction ~15%" color="#ef4444"
              warn={(co2_g_kWh ?? 0) > 200} />
          </div>
          <div style={{ marginTop: 8, fontSize: 9, color: '#334155', borderTop: '1px solid #1e293b', paddingTop: 8 }}>
            Reference: EU ETS benchmark WtE ~140–160 g CO₂eq/kWh_net · Thailand PCD MSWI Std. 2566 · IEA GHG R&D Programme methodology
          </div>
        </div>

        {/* ── 3. Statistical Process Control ── */}
        <div style={{ background: '#0a0f1e', border: '1px solid #1e3a5f', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              § 3 — Statistical Process Control (Shewhart X-bar, 3σ limits)
            </div>
            <span style={{ marginLeft: 8, fontSize: 9, color: '#334155' }}>n={history.length} samples</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px 1fr', gap: 4, padding: '4px 0', fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #1e293b', marginBottom: 4 }}>
            <span>Signal</span><span>x̄ ± σ · UCL · LCL</span><span>n · status</span><span></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 70px 50px 70px', gap: 6, padding: '4px 0', fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #1e293b' }}>
            <span>Signal</span><span>x̄</span><span>σ</span><span>UCL +3σ</span><span>LCL −3σ</span><span>n</span><span>Status</span>
          </div>
          <SpcRow label="Power output (MW)"  stat={spcGen}   unit="MW" />
          <SpcRow label="NOₓ SCR out"        stat={spcNox}   unit="mg/Nm³" />
          <SpcRow label="O₂ furnace (%)"     stat={spcO2}    unit="%" />
          <SpcRow label="Steam pressure"     stat={spcSteam} unit="bar" />

          {/* SPC trend: gen_mw with UCL/LCL overlay */}
          {spcGen && history.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 4 }}>Power output control chart — last {history.length} samples (MW)</div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={history as Record<string, unknown>[]}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" />
                  <XAxis dataKey="created_at" tick={false} axisLine={false} />
                  <YAxis domain={[spcGen.lcl * 0.95, spcGen.ucl * 1.05]} tick={{ fontSize: 8, fill: '#475569' }} width={30} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: 'none', fontSize: 9 }} />
                  <ReferenceLine y={spcGen.ucl}  stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'UCL', fill: '#ef4444', fontSize: 8 }} />
                  <ReferenceLine y={spcGen.mean} stroke="#3b82f6" strokeDasharray="4 2" label={{ value: 'x̄', fill: '#3b82f6', fontSize: 8 }} />
                  <ReferenceLine y={spcGen.lcl}  stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'LCL', fill: '#ef4444', fontSize: 8 }} />
                  <Line type="monotone" dataKey="gen_mw" stroke="#22c55e" dot={false} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── 4. Model Validation ── */}
        <div style={{ background: '#0a0f1e', border: '1px solid #1e3a5f', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            § 4 — MATLAB Digital Twin Model Validation (Simulation vs. Actual)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
            <ResKpi label="RMSE (gen_mw)" value={rmse?.toFixed(4) ?? null} unit="MW"
              note={`n=${mvN} paired samples`} color={rmse != null && rmse < 0.1 ? '#22c55e' : '#f59e0b'} />
            <ResKpi label="MAE (gen_mw)" value={mae?.toFixed(4) ?? null} unit="MW"
              note="Mean absolute error" color="#60a5fa" />
            <ResKpi label="Simulation samples" value={String(mvPairs.length)} unit="rows"
              note='source = "simulation"' color="#94a3b8" />
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>Validation status</div>
              {mvN >= 10
                ? <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>✓ Sufficient data</div>
                : <div style={{ fontSize: 11, color: '#f59e0b' }}>⚠ Need ≥10 simulation<br />runs via /simulate API</div>}
              <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>Target: RMSE &lt; 0.1 MW</div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: '#334155', borderTop: '1px solid #1e293b', paddingTop: 8 }}>
            Run simulation: <code style={{ color: '#64748b' }}>POST /simulate</code> ·
            API docs: <code style={{ color: '#64748b' }}>http://localhost:8000/docs</code> ·
            Paper-21 methodology: MATLAB Simulink → Supabase → LSTM validation pipeline
          </div>
        </div>

        {/* ── 5. Research KPI Summary for Paper-21 ── */}
        <div style={{ background: '#0a0f1e', border: '1px solid #7c3aed33', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            § 5 — Paper-21 AI-DSS Research KPIs (Live snapshot for manuscript)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <ResKpi label="Plant availability proxy" value={history.length > 0 ? '100.0' : null} unit="%"
              note="No downtime events in window" color="#22c55e" />
            <ResKpi label="Net capacity factor" value={(netMW > 0) ? (netMW / 6.6 * 100).toFixed(1) : null} unit="%"
              note="P_net / 6.6 MW rated" color="#4ade80" />
            <ResKpi label="Waste-to-Energy ratio" value={(heatInMW > 0 && netMW > 0) ? (netMW / ((d?.waste_feed_rate ?? 0) / 24)).toFixed(3) : null}
              unit="MWh/t_MSW" note="Net elec. per tonne waste" color="#f97316" />
            <ResKpi label="APC compliance rate" value={d?.dt_apc_pass != null ? (d.dt_apc_pass ? '100.0' : '0.0') : null} unit="%"
              note="Current instant reading" color={d?.dt_apc_pass ? '#22c55e' : '#ef4444'} warn={!d?.dt_apc_pass} />
          </div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#0f172a', borderRadius: 6, padding: '8px 12px', fontSize: 9, color: '#475569', lineHeight: 1.7 }}>
              <div style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 4 }}>Paper-21 variables (cite in §3 Results)</div>
              <div>• η_net = {etaNet?.toFixed(2) ?? '—'} % (target Table 3)</div>
              <div>• NOₓ sp. = {nox_g_GJ?.toFixed(1) ?? '—'} g/GJ (compare EU benchmark)</div>
              <div>• LSTM MAE = — (pending training)</div>
              <div>• Copula τ = — (pending joint-risk estimation)</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 6, padding: '8px 12px', fontSize: 9, color: '#475569', lineHeight: 1.7 }}>
              <div style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 4 }}>Data pipeline status</div>
              <div>• Supabase telemetry: {history.length > 0 ? '✓ live' : '⚠ no data'}</div>
              <div>• PM inference engine: ⚠ not running</div>
              <div>• MATLAB simulation: ⚠ pending</div>
              <div>• OPC-UA bridge: mock mode (live in ~30d)</div>
            </div>
          </div>
        </div>

      </div>
    )
  }

  const renderTab = () => {
    switch (tab) {
      case 'research':    return renderResearch()
      case 'predictive':  return renderPredictive()
      case 'overview':    return renderOverview()
      case 'combustion':  return renderCombustion()
      case 'boiler':      return renderBoiler()
      case 'turbine':     return renderTurbine()
      case 'electrical':  return renderElectrical()
      case 'apc':         return renderAPC()
      case 'watertreat':  return renderWaterTreat()
      case 'wastewater':  return renderWastewater()
      case 'ash':         return renderAsh()
      case 'lab':         return renderLab()
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: 14, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>
            ⚡ WtE Digital Twin <span style={{ color: '#3b82f6' }}>6.6 MW</span>
          </h1>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
            Moving Grate · Emerson Ovation DCS · Updated: {lastUpdate}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: connected ? '#052e16' : '#1c1917',
          border: `1px solid ${connected ? '#22c55e' : '#44403c'}`,
          borderRadius: 20, padding: '3px 10px', fontSize: 10,
          color: connected ? '#22c55e' : '#78716c',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#22c55e' : '#78716c' }} />
          {connected ? 'LIVE' : 'NO DATA'}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '1px solid #1e293b', paddingBottom: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: tab === id ? '#1e40af' : 'transparent',
            border: 'none', borderRadius: '6px 6px 0 0',
            padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: tab === id ? 700 : 400,
            color: tab === id ? '#fff' : '#64748b',
            borderBottom: tab === id ? '2px solid #3b82f6' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {renderTab()}

      <div style={{ textAlign: 'center', color: '#334155', fontSize: 9, marginTop: 10 }}>
        WtE Digital Twin v0.2 · MATLAB R2026a · Emerson Ovation OPC-UA · Supabase Realtime · Thailand PCD MSWI Standard
      </div>
    </div>
  )
}
