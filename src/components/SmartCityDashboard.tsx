import { useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Cpu,
  Droplets,
  Factory,
  FlaskConical,
  MapPin,
  Plane,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Sun,
  Users,
  Wind,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type { HudState } from '../types';
import {
  DRONE_FLEET_CATALOG,
  getStageStatusTag,
  ROBOT_ROLE_CATALOG,
  SMART_CITY_DOME,
  SMART_CITY_POIS,
  type SmartCityCommand,
} from '../game/smartCitySystems';
import type { DestructionStage } from '../game/smartCityDestruction';

interface SmartCityDashboardProps {
  smartCity: NonNullable<HudState['smartCity']>;
  onCommand: (cmd: SmartCityCommand) => void;
  onTeleportPoi: (x: number, z: number, label: string, yaw?: number) => void;
  onClose: () => void;
}

export function SmartCityDashboard({
  smartCity,
  onCommand,
  onTeleportPoi,
  onClose,
}: SmartCityDashboardProps) {
  const [tab, setTab] = useState<'overview' | 'roster'>('overview');
  const t = smartCity.telemetry;
  const totalAffected =
    t.robotsDamaged + t.robotsDestroyed + t.dronesDamaged + t.dronesDestroyed + t.machinesDamaged;
  const charts = smartCity.charts;

  return (
    <div
      data-testid="smart-city-dashboard"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-black/75 pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-[#090f1a] border border-cyan-500/40 rounded-lg shadow-2xl text-zinc-100 flex flex-col">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10 bg-[#0d1626] sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-cyan-500/15 border border-cyan-400/45 flex items-center justify-center text-cyan-300">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-white leading-tight">
                {SMART_CITY_DOME.titleText} · {SMART_CITY_DOME.subtitleText}
              </h2>
              <p className="text-[11px] font-mono text-cyan-300/90 leading-tight">
                Glass-Domed Metropolis · {t.robotsTotal} Autonomous Robots · {t.dronesTotal} AI Drones · {t.machinesTotal} Machines
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="repair-all-fleet"
              onClick={() => onCommand({ type: 'repair_all' })}
              className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold border flex items-center gap-1.5 transition-colors ${
                totalAffected > 0
                  ? 'bg-emerald-400 hover:bg-emerald-300 text-zinc-950 border-emerald-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border-emerald-500/35'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Repair &amp; Restore All{totalAffected > 0 ? ` (${totalAffected})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setTab('overview')}
              className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold border transition-colors ${
                tab === 'overview'
                  ? 'bg-cyan-400 text-zinc-950 border-cyan-200'
                  : 'bg-zinc-900 text-zinc-300 border-white/15 hover:bg-zinc-800'
              }`}
            >
              Overview &amp; Charts
            </button>
            <button
              type="button"
              onClick={() => setTab('roster')}
              className={`px-2.5 py-1.5 rounded text-xs font-mono font-bold border transition-colors ${
                tab === 'roster'
                  ? 'bg-cyan-400 text-zinc-950 border-cyan-200'
                  : 'bg-zinc-900 text-zinc-300 border-white/15 hover:bg-zinc-800'
              }`}
            >
              {t.robotsTotal} Robots &amp; {t.dronesTotal} Drones
            </button>
            <button
              type="button"
              data-testid="smart-city-close"
              aria-label="Close Smart City Dashboard"
              onClick={onClose}
              className="ml-1 p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {tab === 'overview' ? (
          <div className="p-4 space-y-4">
            {/* 10 Live Telemetry Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <MetricCard
                icon={<Bot className="w-3.5 h-3.5 text-cyan-300" />}
                label="Robots Operating"
                value={`${t.robotsOperating}/${t.robotsTotal}`}
                sub={
                  t.robotsDestroyed > 0 || t.robotsDamaged > 0
                    ? `${t.robotsDamaged} Dmg · ${t.robotsDestroyed} Wrecked`
                    : `Mode: ${smartCity.robotWorkMode.toUpperCase()}`
                }
                accent={t.robotsDestroyed > 0 ? 'border-rose-500/55' : 'border-cyan-500/35'}
              />
              <MetricCard
                icon={<Plane className="w-3.5 h-3.5 text-sky-300" />}
                label="Active Drones"
                value={`${t.activeDrones}/${t.dronesTotal}`}
                sub={
                  t.dronesDestroyed > 0 || t.dronesDamaged > 0
                    ? `${t.dronesDamaged} Dmg · ${t.dronesDestroyed} Crashed`
                    : `Fleet: ${smartCity.droneFleetMode.toUpperCase()}`
                }
                accent={t.dronesDestroyed > 0 ? 'border-rose-500/55' : 'border-sky-500/35'}
              />
              <MetricCard
                icon={<Sprout className="w-3.5 h-3.5 text-emerald-300" />}
                label="Farm Production"
                value={`${t.farmingProductionTons} t`}
                sub={`${t.harvestedCrates} crates harvested`}
                accent="border-emerald-500/35"
              />
              <MetricCard
                icon={<Activity className="w-3.5 h-3.5 text-lime-300" />}
                label="Crop Health"
                value={`${t.cropHealthPct}%`}
                sub={`Moisture ${t.soilMoisturePct}%`}
                accent="border-lime-500/35"
              />
              <MetricCard
                icon={<Droplets className="w-3.5 h-3.5 text-teal-300" />}
                label="Water Flow"
                value={`${t.waterConsumptionLpm} L/m`}
                sub={`${t.waterRecycledPct}% Closed Recycle`}
                accent="border-teal-500/35"
              />
              <MetricCard
                icon={<Zap className="w-3.5 h-3.5 text-amber-300" />}
                label="Power Grid"
                value={`${t.electricityTotalMw} MW`}
                sub={`Demand ${t.electricityDemandMw} MW`}
                accent="border-amber-500/35"
              />
              <MetricCard
                icon={<Sun className="w-3.5 h-3.5 text-yellow-300" />}
                label="Solar + Wind"
                value={`${t.electricitySolarMw} + ${t.electricityWindMw}`}
                sub="MW Clean Generation"
                accent="border-yellow-500/30"
              />
              <MetricCard
                icon={<Factory className="w-3.5 h-3.5 text-orange-300" />}
                label="Factory & Machines"
                value={`${t.factoryProductionUnits}`}
                sub={
                  t.machinesDamaged > 0
                    ? `${t.machinesDamaged}/${t.machinesTotal} Machines Damaged`
                    : smartCity.factoryActive
                      ? 'Assembly Active'
                      : 'Assembly Paused'
                }
                accent={t.machinesDamaged > 0 ? 'border-orange-500/60' : 'border-orange-500/35'}
              />
              <MetricCard
                icon={<Users className="w-3.5 h-3.5 text-indigo-300" />}
                label="City Population"
                value={t.cityPopulation.toLocaleString()}
                sub="Residents & Engineers"
                accent="border-indigo-500/35"
              />
              <MetricCard
                icon={
                  smartCity.securityAlert || t.securityStatus === 'HIGH ALERT' ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  )
                }
                label="City Security"
                value={t.securityStatus}
                sub={`${t.securityCoveragePct}% Sentinel Net`}
                accent={
                  smartCity.securityAlert || t.securityStatus === 'HIGH ALERT'
                    ? 'border-rose-500/60'
                    : 'border-emerald-500/35'
                }
              />
            </div>

            {/* Live Dynamic SVG Charts Panel */}
            {charts && (
              <div
                data-testid="smart-city-dynamic-charts"
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                <div className="bg-[#0d1626] border border-cyan-500/30 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" />
                      Live Power Grid &amp; District Performance Bars
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                      Integrity {charts.fleetIntegrityPct}%
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {charts.energySeries.map((bar) => (
                      <div key={bar.label} className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="w-20 text-zinc-300 shrink-0">{bar.label}</span>
                        <div className="flex-1 h-2.5 bg-zinc-900 rounded overflow-hidden border border-white/10">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${Math.max(4, Math.min(100, Math.round((bar.valueMw / Math.max(1, bar.maxMw)) * 100)))}%`,
                              backgroundColor: bar.hex,
                            }}
                          />
                        </div>
                        <span className="w-12 text-right text-white tabular-nums shrink-0">
                          {bar.valueMw} MW
                        </span>
                      </div>
                    ))}
                    {charts.districtBars.map((bar) => (
                      <div key={bar.label} className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="w-20 text-zinc-400 shrink-0">{bar.label}</span>
                        <div className="flex-1 h-2 bg-zinc-900 rounded overflow-hidden border border-white/10">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${Math.max(4, Math.min(100, bar.pct))}%`,
                              backgroundColor: bar.hex,
                            }}
                          />
                        </div>
                        <span className="w-12 text-right text-zinc-200 tabular-nums shrink-0">
                          {bar.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0d1626] border border-emerald-500/30 rounded-md p-3 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider">
                      Real-Time Telemetry &amp; Fleet Integrity Waveform
                    </span>
                    <span className="text-[11px] font-mono text-emerald-300 font-bold tabular-nums">
                      {charts.fleetIntegrityPct}% HEALTHY
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 330 110"
                    className="w-full h-28 bg-zinc-950/70 rounded border border-white/10"
                  >
                    <line x1="0" y1="28" x2="330" y2="28" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1="55" x2="330" y2="55" stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1="82" x2="330" y2="82" stroke="#1e293b" strokeDasharray="3 3" />
                    <polyline
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={charts.trendPoints
                        .map((v, idx) => `${idx * 30},${Math.round(98 - v * 84)}`)
                        .join(' ')}
                    />
                    {charts.trendPoints.map((v, idx) => (
                      <circle
                        key={idx}
                        cx={idx * 30}
                        cy={Math.round(98 - v * 84)}
                        r="3"
                        fill="#4ade80"
                      />
                    ))}
                  </svg>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Single Exploration Road + Dual Dome Gates Online</span>
                    <span>
                      {t.robotsOperating}/{t.robotsTotal} Robots · {t.activeDrones}/{t.dronesTotal} Drones
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Ag Irrigation & Harvest Controls */}
              <div className="bg-[#0d1626] border border-white/10 rounded-md p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider">
                    AI Farming &amp; Irrigation Controls
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                    Soil {t.soilMoisturePct}% · {t.waterConsumptionLpm} L/min
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['auto', 'boost', 'conserve'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`irr-${mode}`}
                      onClick={() => onCommand({ type: 'set_irrigation', mode })}
                      className={`px-3 py-1.5 rounded text-xs font-mono font-bold border uppercase transition-colors ${
                        smartCity.irrigationMode === mode
                          ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                  <button
                    type="button"
                    data-testid="trigger-harvest"
                    onClick={() => onCommand({ type: 'trigger_harvest' })}
                    className="ml-auto px-3 py-1.5 rounded text-xs font-mono font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-amber-200"
                  >
                    Trigger Harvest (+24 Crates)
                  </button>
                </div>
              </div>

              {/* Autonomous Drone Fleet Controls */}
              <div className="bg-[#0d1626] border border-white/10 rounded-md p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-sky-300 uppercase tracking-wider">
                    Autonomous Drone Network
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                    Airborne {t.activeDrones} / {t.dronesTotal}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['active', 'Deploy All'],
                      ['patrol', 'Security Patrol'],
                      ['recall', 'Recall to Pads'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`drone-${mode}`}
                      onClick={() => onCommand({ type: 'set_drones', mode })}
                      className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-colors ${
                        smartCity.droneFleetMode === mode
                          ? 'bg-sky-400 text-zinc-950 border-sky-200'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Robot Fleet Mode */}
              <div className="bg-[#0d1626] border border-white/10 rounded-md p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                    {t.robotsTotal}-Robot Workforce Directive
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                    Active {t.robotsOperating} / {t.robotsTotal}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['standard', 'overdrive', 'eco'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`robot-${mode}`}
                      onClick={() => onCommand({ type: 'set_robots', mode })}
                      className={`px-3 py-1.5 rounded text-xs font-mono font-bold border uppercase transition-colors ${
                        smartCity.robotWorkMode === mode
                          ? 'bg-cyan-400 text-zinc-950 border-cyan-200'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Factory, Security & AI Research Toggles */}
              <div className="bg-[#0d1626] border border-white/10 rounded-md p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                    Industry, Security &amp; Research Lab
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 tabular-nums flex items-center gap-1">
                    <FlaskConical className="w-3 h-3 text-purple-300" />
                    {t.researchProgressPct}% ({t.researchProjectsActive} Ops)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-testid="toggle-factory"
                    onClick={() => onCommand({ type: 'toggle_factory' })}
                    className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-colors ${
                      smartCity.factoryActive
                        ? 'bg-orange-400 text-zinc-950 border-orange-200'
                        : 'bg-zinc-900 text-zinc-300 border-white/15'
                    }`}
                  >
                    Factory: {smartCity.factoryActive ? 'RUNNING' : 'PAUSED'}
                  </button>
                  <button
                    type="button"
                    data-testid="toggle-security"
                    onClick={() => onCommand({ type: 'toggle_security' })}
                    className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-colors ${
                      smartCity.securityAlert
                        ? 'bg-rose-500 text-white border-rose-300'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                    }`}
                  >
                    Security: {smartCity.securityAlert ? 'ALERT' : 'NOMINAL'}
                  </button>
                  <button
                    type="button"
                    data-testid="toggle-research"
                    onClick={() => onCommand({ type: 'toggle_research_boost' })}
                    className={`px-3 py-1.5 rounded text-xs font-mono font-bold border transition-colors ${
                      smartCity.researchBoost
                        ? 'bg-purple-400 text-zinc-950 border-purple-200'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                    }`}
                  >
                    AI Lab: {smartCity.researchBoost ? 'BOOSTED' : 'STANDARD'}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick-Travel Smart City Zones */}
            <div className="bg-[#0d1626] border border-white/10 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                  Quick-Travel Across Domed Smart City &amp; Mansion
                </span>
                <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                  <Wind className="w-3 h-3 text-cyan-300" /> Clean Grid Surplus +{Math.max(0, t.electricityTotalMw - t.electricityDemandMw)} MW
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SMART_CITY_POIS.map((poi) => (
                  <button
                    key={poi.id}
                    type="button"
                    onClick={() => {
                      onTeleportPoi(poi.x, poi.z, poi.name, poi.viewYaw);
                      onClose();
                    }}
                    className="text-left p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-cyan-400/50 transition-colors"
                  >
                    <div className="text-xs font-bold text-cyan-200 truncate">{poi.shortName}</div>
                    <div className="text-[10px] text-zinc-400 truncate">{poi.subtitle}</div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    onTeleportPoi(0, -255, 'Apex Luxury Mansion Courtyard', 0);
                    onClose();
                  }}
                  className="text-left p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-amber-400/35 hover:border-amber-400 transition-colors"
                >
                  <div className="text-xs font-bold text-amber-300 truncate">Mansion &amp; Garage</div>
                  <div className="text-[10px] text-zinc-400 truncate">Return to Estate Courtyard</div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider mb-2">
                {t.robotsTotal} Specialized Autonomous Robot Agents
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROBOT_ROLE_CATALOG.map((r, idx) => {
                  const stage = (smartCity.robotStages?.[idx] ?? 0) as DestructionStage;
                  const statusLabel = getStageStatusTag(stage);
                  const badgeClass =
                    stage >= 4
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : stage >= 1
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                  return (
                    <div
                      key={r.id}
                      className="p-2 rounded bg-[#0d1626] border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {r.index}. {r.label}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 uppercase">{r.sector}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 ${badgeClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-mono font-bold text-sky-300 uppercase tracking-wider mb-2">
                {t.dronesTotal} Autonomous Drones Across 7 Archetypes
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DRONE_FLEET_CATALOG.map((d, idx) => {
                  const stage = (smartCity.droneStages?.[idx] ?? 0) as DestructionStage;
                  const badgeLabel =
                    stage >= 5
                      ? 'CRASHED'
                      : stage >= 1
                        ? `STAGE ${stage}`
                        : smartCity.droneFleetMode === 'recall'
                          ? 'PAD'
                          : 'AIR';
                  const badgeColor =
                    stage >= 4
                      ? 'text-red-300'
                      : stage >= 1
                        ? 'text-amber-300'
                        : 'text-zinc-400';
                  return (
                    <div
                      key={d.id}
                      className="p-2 rounded bg-[#0d1626] border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{d.label}</div>
                        <div className="text-[10px] font-mono text-sky-300 truncate">
                          {d.archetype.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono font-bold shrink-0 ${badgeColor}`}>
                        {badgeLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className={`bg-[#0d1626] border ${accent} rounded-md p-2.5`}>
      <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-zinc-400 uppercase">
        <span className="truncate">{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-base sm:text-lg font-mono font-bold text-white tabular-nums leading-tight">
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-mono text-zinc-400 truncate">{sub}</div>
    </div>
  );
}
