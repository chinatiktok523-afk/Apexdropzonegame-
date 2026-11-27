import { useMemo, useState } from 'react';
import { Atom, Building2, Compass, Cpu, FlaskConical, Layers, LogOut, Play, Sparkles, X } from 'lucide-react';
import {
  FUTURE_LAB_DEPARTMENTS,
  SCIENCE_DOMES_CATALOG,
  type ScienceDomeId,
  type ScienceLabDepartmentId,
} from '../game/scienceDistrictSystems';
import type { ScienceDistrictHudState } from '../types';

export type ScienceDistrictUiCommand =
  | { type: 'enter_future_lab' }
  | { type: 'enter_museum' }
  | { type: 'enter_dome'; domeId: ScienceDomeId }
  | { type: 'exit_building' }
  | { type: 'explore_department'; deptId: ScienceLabDepartmentId }
  | { type: 'toggle_dome_boost'; domeId: ScienceDomeId }
  | { type: 'toggle_lab_robots' }
  | { type: 'toggle_lab_overdrive' }
  | { type: 'set_elevator_floor'; floor: 1 | 2 | 3 };

interface ScienceDistrictModalProps {
  scienceDistrict: ScienceDistrictHudState;
  onCommand: (cmd: ScienceDistrictUiCommand) => void;
  onClose: () => void;
}

type ModalSection = 'future_lab' | 'science_museum' | 'domes';

export function ScienceDistrictModal({
  scienceDistrict,
  onCommand,
  onClose,
}: ScienceDistrictModalProps) {
  const initialSection: ModalSection =
    scienceDistrict.nearbyKind === 'dome' || scienceDistrict.activeBuilding.startsWith('dome_')
      ? 'domes'
      : scienceDistrict.nearbyKind === 'science_museum' || scienceDistrict.activeBuilding === 'science_museum'
        ? 'science_museum'
        : 'future_lab';

  const [section, setSection] = useState<ModalSection>(initialSection);
  const [selectedDomeId, setSelectedDomeId] = useState<ScienceDomeId>(
    scienceDistrict.nearbyDomeId ??
      (scienceDistrict.activeBuilding.startsWith('dome_')
        ? (scienceDistrict.activeBuilding as ScienceDomeId)
        : 'dome_1_space'),
  );
  const [showResearchProjects, setShowResearchProjects] = useState(false);

  const selectedDome = useMemo(
    () => SCIENCE_DOMES_CATALOG.find((d) => d.id === selectedDomeId) ?? SCIENCE_DOMES_CATALOG[0],
    [selectedDomeId],
  );
  const activeDept = useMemo(
    () =>
      FUTURE_LAB_DEPARTMENTS.find((d) => d.id === scienceDistrict.activeLabDept) ??
      FUTURE_LAB_DEPARTMENTS[0],
    [scienceDistrict.activeLabDept],
  );

  return (
    <div
      data-testid="science-district-modal"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 pointer-events-auto"
      style={{ backgroundColor: 'rgba(4, 10, 22, 0.72)' }}
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-xl border border-cyan-400/45 shadow-2xl overflow-hidden text-slate-100"
        style={{ backgroundColor: 'rgba(8, 19, 40, 0.94)' }}
      >
        {/* Top Scientific Navigation Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-cyan-400/25">
          <div className="flex items-center gap-2.5 min-w-0">
            <Atom className="w-5 h-5 text-cyan-300 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold tracking-wide text-white truncate">
                Futuristic Science & Exhibition District
              </h2>
              <p className="text-[11px] font-mono text-cyan-300/80 truncate">
                Future Lab · Science Museum · 8 Animated Glass Domes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSection('future_lab')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                section === 'future_lab'
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'bg-slate-900/90 text-slate-300 border border-white/10 hover:text-white'
              }`}
            >
              Future Lab
            </button>
            <button
              type="button"
              onClick={() => setSection('science_museum')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                section === 'science_museum'
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'bg-slate-900/90 text-slate-300 border border-white/10 hover:text-white'
              }`}
            >
              Science Museum
            </button>
            <button
              type="button"
              onClick={() => setSection('domes')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                section === 'domes'
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'bg-slate-900/90 text-slate-300 border border-white/10 hover:text-white'
              }`}
            >
              8 Glass Domes
            </button>
            <button
              type="button"
              aria-label="Close Science Interface"
              onClick={onClose}
              className="ml-1 p-1.5 rounded-md bg-slate-900/90 border border-white/15 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Workspace Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {section === 'future_lab' && (
            <div className="space-y-4">
              {/* Primary Future Lab Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onCommand({ type: 'enter_future_lab' });
                    onClose();
                  }}
                  className="px-3 py-2.5 rounded-lg bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-cyan-300 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">ENTER FUTURE LAB</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCommand({ type: 'explore_department', deptId: 'robotics_lab' });
                    onClose();
                  }}
                  className="px-3 py-2.5 rounded-lg bg-slate-900 border border-cyan-400/45 text-cyan-200 font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">EXPLORE ROBOTICS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCommand({ type: 'explore_department', deptId: 'space_lab' });
                    onClose();
                  }}
                  className="px-3 py-2.5 rounded-lg bg-slate-900 border border-cyan-400/45 text-cyan-200 font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
                >
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">EXPLORE SPACE TECHNOLOGY</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowResearchProjects((v) => !v)}
                  className={`px-3 py-2.5 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 border transition-colors ${
                    showResearchProjects
                      ? 'bg-sky-400/20 border-sky-300 text-white'
                      : 'bg-slate-900 border-white/15 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">VIEW RESEARCH PROJECTS</span>
                </button>
              </div>

              {/* Glass Elevator & Facility Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-white/10 bg-slate-950/65">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-300" />
                  <span className="text-xs font-medium text-slate-200">Glass Elevator</span>
                  {([1, 2, 3] as const).map((fl) => (
                    <button
                      key={fl}
                      type="button"
                      onClick={() => onCommand({ type: 'set_elevator_floor', floor: fl })}
                      className={`px-2.5 py-1 rounded text-xs font-mono tabular-nums ${
                        scienceDistrict.elevatorFloor === fl
                          ? 'bg-cyan-400 text-slate-950 font-bold'
                          : 'bg-slate-900 border border-white/15 text-slate-300 hover:text-white'
                      }`}
                    >
                      {fl}F
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onCommand({ type: 'toggle_lab_robots' })}
                    className={`px-3 py-1.5 rounded text-xs font-medium border ${
                      scienceDistrict.labRobotsActive
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-slate-900 border-white/15 text-slate-300'
                    }`}
                  >
                    Robots: {scienceDistrict.labRobotsActive ? 'Active' : 'Docked'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCommand({ type: 'toggle_lab_overdrive' })}
                    className={`px-3 py-1.5 rounded text-xs font-medium border ${
                      scienceDistrict.labEnergyOverdrive
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                        : 'bg-slate-900 border-white/15 text-slate-300'
                    }`}
                  >
                    Reactor Mode: {scienceDistrict.labEnergyOverdrive ? 'Overdrive' : 'Standard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCommand({ type: 'exit_building' });
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded text-xs font-medium bg-slate-900 border border-white/15 text-slate-200 hover:bg-slate-800 flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Exit Building</span>
                  </button>
                </div>
              </div>

              {/* Active Department Highlight */}
              {showResearchProjects && (
                <div className="p-3.5 rounded-lg border border-cyan-400/35 bg-slate-900/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      {activeDept.index}. {activeDept.name}
                    </h3>
                    <span className="text-xs font-mono text-cyan-300">
                      Floor {activeDept.floor}F · Lead: {activeDept.leadScientist}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{activeDept.summary}</p>
                  <div className="flex flex-wrap gap-4 pt-1 text-xs font-mono tabular-nums text-slate-200">
                    <span>Project: {activeDept.activeProject}</span>
                    {activeDept.metrics.map((m) => (
                      <span key={m.label}>
                        {m.label}: <strong className="text-cyan-300">{m.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* All 10 Research Laboratories Directory */}
              <div>
                <h3 className="text-xs font-medium text-slate-400 mb-2">
                  10 Interactive Future Lab Departments
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FUTURE_LAB_DEPARTMENTS.map((dept) => {
                    const isSelected = dept.id === scienceDistrict.activeLabDept;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => {
                          onCommand({ type: 'explore_department', deptId: dept.id });
                          onClose();
                        }}
                        className={`text-left p-2.5 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-400/60'
                            : 'bg-slate-950/60 border-white/10 hover:border-cyan-400/35'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {dept.index}. {dept.name}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-cyan-300 shrink-0">
                            {dept.floor}F
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {dept.activeProject} · {dept.leadScientist}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {section === 'science_museum' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onCommand({ type: 'enter_museum' });
                    onClose();
                  }}
                  className="px-3 py-2.5 rounded-lg bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-cyan-300"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>ENTER SCIENCE MUSEUM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSection('domes')}
                  className="px-3 py-2.5 rounded-lg bg-slate-900 border border-cyan-400/45 text-cyan-200 font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-slate-800"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>EXPLORE EXHIBITIONS</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCommand({ type: 'toggle_dome_boost', domeId: selectedDome.id })}
                  className="px-3 py-2.5 rounded-lg bg-slate-900 border border-white/15 text-slate-100 font-medium text-xs flex items-center justify-center gap-1.5 hover:bg-slate-800"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>INTERACT WITH DISPLAYS</span>
                </button>
              </div>

              <div className="p-3.5 rounded-lg border border-white/10 bg-slate-950/65 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Grand Museum Rotunda & Skybridge</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Includes the Grand Entrance Lobby, Visitor Information Desk, T-Rex Fossil Rotunda, 8 Hall Alcoves & 2F Glass Skybridge to Future Lab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onCommand({ type: 'exit_building' });
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-slate-900 border border-white/15 text-slate-200 hover:bg-slate-800 flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit Building</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SCIENCE_DOMES_CATALOG.map((dome) => (
                  <button
                    key={dome.id}
                    type="button"
                    onClick={() => {
                      setSelectedDomeId(dome.id);
                      setSection('domes');
                    }}
                    className="text-left p-2.5 rounded-lg border border-white/10 bg-slate-950/60 hover:border-cyan-400/45 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">{dome.title}</span>
                      <span className="text-[11px] font-mono text-cyan-300">Open Dome</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {dome.highlights.join(' · ')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {section === 'domes' && (
            <div className="space-y-4">
              {/* Dome Selector Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SCIENCE_DOMES_CATALOG.map((d) => {
                  const active = d.id === selectedDome.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDomeId(d.id)}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        active
                          ? 'bg-cyan-400/20 border-cyan-300 text-white'
                          : 'bg-slate-950/65 border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="text-[10px] font-mono text-cyan-300">DOME {d.index}</div>
                      <div className="text-xs font-semibold truncate">{d.shortTitle}</div>
                    </button>
                  );
                })}
              </div>

              {/* Active Dome Information & Interaction Panel */}
              <div className="p-4 rounded-xl border border-cyan-400/35 bg-slate-950/75 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">{selectedDome.title}</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      {selectedDome.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onCommand({ type: 'enter_dome', domeId: selectedDome.id });
                        onClose();
                      }}
                      className="px-3.5 py-2 rounded-lg bg-cyan-400 text-slate-950 font-semibold text-xs hover:bg-cyan-300"
                    >
                      ENTER DOME
                    </button>
                    <button
                      type="button"
                      onClick={() => onCommand({ type: 'toggle_dome_boost', domeId: selectedDome.id })}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                        scienceDistrict.boostedDomes[selectedDome.id]
                          ? 'bg-amber-400/20 border-amber-300 text-amber-200'
                          : 'bg-slate-900 border-cyan-400/40 text-cyan-200 hover:bg-slate-800'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>
                        {scienceDistrict.boostedDomes[selectedDome.id] ? 'ANIMATION BOOSTED' : 'ACTIVATE ANIMATION'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onCommand({ type: 'exit_building' });
                        onClose();
                      }}
                      className="px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-slate-200 text-xs hover:bg-slate-800"
                    >
                      EXIT DOME
                    </button>
                  </div>
                </div>

                {/* Exhibits & Scientific Telemetry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  <div>
                    <div className="text-[11px] font-medium text-slate-400 mb-1">Featured Animated Exhibits</div>
                    <div className="text-xs text-slate-200 leading-relaxed">
                      {selectedDome.highlights.join(' · ')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-slate-400 mb-1">Exhibition Specifications</div>
                    <div className="flex flex-wrap gap-4 text-xs font-mono tabular-nums text-cyan-300">
                      {selectedDome.telemetryFacts.map((tf) => (
                        <span key={tf.label}>
                          <span className="text-slate-400">{tf.label}:</span> {tf.value}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
