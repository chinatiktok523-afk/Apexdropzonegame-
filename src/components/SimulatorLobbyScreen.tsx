import React from 'react';
import {
  Bike,
  Cloud,
  CloudFog,
  CloudRain,
  Compass,
  Eye,
  LogIn,
  LogOut,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Play,
  Plus,
  SlidersHorizontal,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SimulatorProgress } from '../game/offlineStorage';
import {
  BIKE_STYLES,
  BikeStyleId,
  GraphicsQuality,
  HudSettings,
  SIMULATOR_POIS,
  TimeOfDayPhase,
  WeatherKind,
} from '../types';

interface SimulatorLobbyScreenProps {
  simStartPoiId: string;
  simTimePhase: TimeOfDayPhase;
  simWeather: WeatherKind;
  simAutoCycle: boolean;
  simBikeStyle: BikeStyleId;
  simProgress: SimulatorProgress;
  hudSettings: HudSettings;
  muted: boolean;
  isFullscreen: boolean;
  onSelectSimStartPoi: (poiId: string) => void;
  onSelectSimTimePhase: (phase: TimeOfDayPhase) => void;
  onSelectSimWeather: (weather: WeatherKind) => void;
  onToggleSimAutoCycle: () => void;
  onSelectSimBikeStyle: (style: BikeStyleId) => void;
  onUpdateHudSettings: (next: HudSettings) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenHudEditor: () => void;
  onDeploySimulator: () => void;
  signedInUserName?: string | null;
  authBusy?: boolean;
  onSignInGoogle?: () => void;
  onSignOut?: () => void;
}

const TIME_OPTIONS: {
  id: TimeOfDayPhase;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'morning', label: 'Morning', icon: Sun },
  { id: 'afternoon', label: 'Afternoon', icon: Sun },
  { id: 'sunset', label: 'Sunset', icon: Sunset },
  { id: 'night', label: 'Night', icon: Moon },
];

const WEATHER_OPTIONS: {
  id: WeatherKind;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'clear', label: 'Clear', icon: Sun },
  { id: 'cloudy', label: 'Cloudy', icon: Cloud },
  { id: 'foggy', label: 'Foggy', icon: CloudFog },
  { id: 'rainy', label: 'Rainy', icon: CloudRain },
];

const GRAPHICS_OPTIONS: { id: GraphicsQuality; label: string; detail: string }[] = [
  { id: 'low', label: '60 FPS Smooth', detail: 'Best frame rate for mobile & laptops' },
  { id: 'medium', label: 'Balanced', detail: 'Crisp shadows & high view distance' },
  { id: 'high', label: 'Ultra Detail', detail: 'Maximum textures & optional bloom' },
];

const SATURATION_PRESETS = [
  { label: 'Natural', value: 1.0 },
  { label: 'Vibrant', value: 1.38 },
  { label: 'Vivid', value: 1.65 },
];

export const SimulatorLobbyScreen: React.FC<SimulatorLobbyScreenProps> = ({
  simStartPoiId,
  simTimePhase,
  simWeather,
  simAutoCycle,
  simBikeStyle,
  simProgress,
  hudSettings,
  muted,
  isFullscreen,
  onSelectSimStartPoi,
  onSelectSimTimePhase,
  onSelectSimWeather,
  onToggleSimAutoCycle,
  onSelectSimBikeStyle,
  onUpdateHudSettings,
  onToggleMute,
  onToggleFullscreen,
  onOpenHudEditor,
  onDeploySimulator,
  signedInUserName = null,
  authBusy = false,
  onSignInGoogle,
  onSignOut,
}) => {
  const selectedPoi =
    simStartPoiId === 'saved_pos' && simProgress.hasSavedPosition
      ? {
          id: 'saved_pos',
          name: `Saved Position · ${simProgress.lastDistrict || 'Mega-World'}`,
          subtitle: `Resume at (${Math.round(simProgress.lastX)}, ${Math.round(simProgress.lastZ)})`,
        }
      : SIMULATOR_POIS.find((p) => p.id === simStartPoiId) || SIMULATOR_POIS[0];

  const adjustSensitivity = (delta: number) => {
    const next = Math.round(Math.min(3.0, Math.max(0.5, hudSettings.lookSensitivity + delta)) * 10) / 10;
    onUpdateHudSettings({ ...hudSettings, lookSensitivity: next });
  };

  const saturationPct = Math.round((hudSettings.mapSaturation ?? 1.38) * 100);
  const selectedBike = BIKE_STYLES.find((b) => b.id === simBikeStyle) || BIKE_STYLES[0];

  return (
    <div
      data-testid="simulator-lobby-screen"
      className="fixed inset-0 z-30 bg-[#050910] text-zinc-100 flex flex-col overflow-hidden select-none"
    >
      {/* Top 3-Zone Header Bar */}
      <header className="w-full border-b border-white/10 bg-[#080e18] px-4 sm:px-6 py-3 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-white truncate">
                World Simulator Lobby
              </h1>
              <p className="text-xs text-zinc-400 truncate tabular-nums">
                Unified Mega-World · {simProgress.visitedDistricts.length}/21 Zones Explored ·{' '}
                {simProgress.credits.toLocaleString()} Credits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSignInGoogle && onSignOut && (
              signedInUserName ? (
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={onSignOut}
                  title={`Signed in as ${signedInUserName} — Click to sign out`}
                  className="min-h-[42px] px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/45 text-xs font-semibold text-emerald-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 max-w-[170px]"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span className="truncate">{signedInUserName}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={onSignInGoogle}
                  className="min-h-[42px] px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{authBusy ? 'Signing In...' : 'Sign In'}</span>
                </button>
              )
            )}
            <button
              type="button"
              onClick={onToggleMute}
              className={`min-h-[42px] px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                muted
                  ? 'bg-red-500/15 border-red-400/45 text-red-200'
                  : 'bg-zinc-900 border-white/15 text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{muted ? 'Muted' : 'Audio On'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="min-h-[42px] px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
            <button
              type="button"
              data-testid="sim-lobby-launch-btn"
              onClick={onDeploySimulator}
              className="min-h-[44px] px-5 rounded-lg bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-zinc-950 font-display text-sm sm:text-base font-extrabold tracking-wide flex items-center gap-2 transition-colors shadow-lg whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Enter World</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Two-Column Configuration Workspace */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (7 cols): Play Position, Time, Weather, Modern Bike */}
          <section className="lg:col-span-7 space-y-5">
            {/* Play / Spawn Position */}
            <div className="rounded-xl border border-white/10 bg-[#0b121e] p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-sky-400" />
                    <span>Play Position &amp; Starting District</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">{selectedPoi.subtitle}</p>
                </div>
                <span className="text-xs font-mono text-sky-300 font-semibold tabular-nums">
                  {selectedPoi.name}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {simProgress.hasSavedPosition && (
                  <button
                    type="button"
                    onClick={() => onSelectSimStartPoi('saved_pos')}
                    className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition-colors ${
                      simStartPoiId === 'saved_pos'
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-300 font-bold'
                        : 'bg-[#070c14] text-emerald-300 border-emerald-500/40 hover:border-emerald-400'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">Resume Saved Spot</div>
                    <div
                      className={`text-[10.5px] truncate tabular-nums ${
                        simStartPoiId === 'saved_pos' ? 'text-emerald-950' : 'text-zinc-400'
                      }`}
                    >
                      {simProgress.lastDistrict || 'Last Location'}
                    </div>
                  </button>
                )}

                {SIMULATOR_POIS.map((poi) => {
                  const active = simStartPoiId === poi.id;
                  return (
                    <button
                      key={poi.id}
                      type="button"
                      onClick={() => onSelectSimStartPoi(poi.id)}
                      className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition-colors ${
                        active
                          ? 'bg-sky-500 text-zinc-950 border-sky-300 font-bold'
                          : 'bg-[#070c14] text-zinc-200 border-white/10 hover:border-sky-400/50'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">
                        {poi.shortName || poi.name}
                      </div>
                      <div
                        className={`text-[10.5px] truncate tabular-nums ${
                          active ? 'text-sky-950' : 'text-zinc-400'
                        }`}
                      >
                        ({poi.x}, {poi.z})
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day / Night Time & Weather */}
            <div className="rounded-xl border border-white/10 bg-[#0b121e] p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span>Day / Night Time &amp; Weather</span>
                </h2>
                <button
                  type="button"
                  onClick={onToggleSimAutoCycle}
                  className={`min-h-[36px] px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                    simAutoCycle
                      ? 'bg-emerald-500/20 border-emerald-400/55 text-emerald-200'
                      : 'bg-zinc-900 border-white/15 text-zinc-300'
                  }`}
                >
                  Auto Day Cycle: {simAutoCycle ? 'On' : 'Off'}
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-zinc-300">Time of Day</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIME_OPTIONS.map((t) => {
                    const Icon = t.icon;
                    const active = simTimePhase === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectSimTimePhase(t.id)}
                        className={`min-h-[44px] px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-amber-400 text-zinc-950 border-amber-200 font-bold'
                            : 'bg-[#070c14] text-zinc-200 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-zinc-300">Weather Atmosphere</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WEATHER_OPTIONS.map((w) => {
                    const Icon = w.icon;
                    const active = simWeather === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => onSelectSimWeather(w.id)}
                        className={`min-h-[44px] px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-sky-400 text-zinc-950 border-sky-200 font-bold'
                            : 'bg-[#070c14] text-zinc-200 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{w.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modern Cyber Bike & Vehicle Preset */}
            <div className="rounded-xl border border-white/10 bg-[#0b121e] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Bike className="w-4 h-4 text-emerald-400" />
                  <span>Modern Cyber Bike Finish</span>
                </h2>
                <span className="text-xs text-zinc-300 font-medium">{selectedBike.name}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {BIKE_STYLES.map((b) => {
                  const active = simBikeStyle === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onSelectSimBikeStyle(b.id)}
                      className={`min-h-[44px] px-2.5 py-2 rounded-lg border flex items-center gap-2 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-zinc-900 border-white text-white font-bold'
                          : 'bg-[#070c14] border-white/10 text-zinc-300 hover:border-white/30'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded shrink-0 border border-white/30"
                        style={{ backgroundColor: b.swatchCss }}
                      />
                      <span className="truncate">{b.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right Column (5 cols): Audio, Map Saturation, Screen Sensitivity, Performance */}
          <section className="lg:col-span-5 space-y-5">
            {/* Audio & Sound System */}
            <div className="rounded-xl border border-white/10 bg-[#0b121e] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-sky-400" />
                  <span>Audio &amp; Sound</span>
                </h2>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`min-h-[36px] px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                    muted
                      ? 'bg-red-500/20 border-red-400/50 text-red-200'
                      : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  }`}
                >
                  {muted ? 'Sound Off' : 'Sound Active'}
                </button>
              </div>

              <label className="block space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>Sound Effects Volume</span>
                  <span className="font-mono font-bold text-sky-300 tabular-nums">
                    {Math.round(hudSettings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(hudSettings.sfxVolume * 100)}
                  onChange={(e) =>
                    onUpdateHudSettings({
                      ...hudSettings,
                      sfxVolume: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-sky-400 h-2"
                />
              </label>
            </div>

            {/* Screen Sensitivity (Up & Down) + Controls */}
            <div className="rounded-xl border border-white/10 bg-[#0b121e] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span>Screen Sensitivity &amp; Touch</span>
                </h2>
                <span className="font-mono text-sm font-bold text-amber-300 tabular-nums">
                  {hudSettings.lookSensitivity.toFixed(1)}x
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease Screen Sensitivity"
                  onClick={() => adjustSensitivity(-0.1)}
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-[#070c14] hover:bg-zinc-800 border border-white/15 text-zinc-100 flex items-center justify-center transition-colors shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={hudSettings.lookSensitivity}
                  onChange={(e) =>
                    onUpdateHudSettings({
                      ...hudSettings,
                      lookSensitivity: Number(e.target.value),
                    })
                  }
                  className="flex-1 accent-amber-400 h-2"
                />
                <button
                  type="button"
                  aria-label="Increase Screen Sensitivity"
                  onClick={() => adjustSensitivity(0.1)}
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-[#070c14] hover:bg-zinc-800 border border-white/15 text-zinc-100 flex items-center justify-center transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateHudSettings({
                      ...hudSettings,
                      autoSprint: !hudSettings.autoSprint,
                    })
                  }
                  className={`min-h-[42px] px-3 rounded-lg border text-xs font-semibold transition-colors ${
                    hudSettings.autoSprint
                      ? 'bg-emerald-500/20 border-emerald-400/55 text-emerald-200'
                      : 'bg-[#070c14] border-white/10 text-zinc-300'
                  }`}
                >
                  Auto Sprint: {hudSettings.autoSprint ? 'On' : 'Off'}
                </button>
                <button
                  type="button"
                  onClick={onOpenHudEditor}
                  className="min-h-[42px] px-3 rounded-lg bg-[#070c14] hover:bg-zinc-900 border border-white/15 text-xs font-semibold text-zinc-200 transition-colors"
                >
                  Edit Touch Layout
                </button>
              </div>
            </div>

            {/* Map Saturation & Graphics Quality */}
            <div className="rounded-xl border border-white/10 bg-[#0b121e] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Map Saturation &amp; Quality</span>
                </h2>
                <span className="font-mono text-sm font-bold text-emerald-300 tabular-nums">
                  {saturationPct}%
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="0.8"
                  max="1.8"
                  step="0.05"
                  value={hudSettings.mapSaturation ?? 1.38}
                  onChange={(e) =>
                    onUpdateHudSettings({
                      ...hudSettings,
                      mapSaturation: Number(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-400 h-2"
                />
                <div className="grid grid-cols-3 gap-2">
                  {SATURATION_PRESETS.map((preset) => {
                    const active =
                      Math.abs((hudSettings.mapSaturation ?? 1.38) - preset.value) < 0.04;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          onUpdateHudSettings({
                            ...hudSettings,
                            mapSaturation: preset.value,
                          })
                        }
                        className={`min-h-[38px] px-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-emerald-500 text-zinc-950 border-emerald-300 font-bold'
                            : 'bg-[#070c14] text-zinc-300 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="text-xs font-medium text-zinc-300">Graphics Performance</div>
                <div className="grid grid-cols-3 gap-2">
                  {GRAPHICS_OPTIONS.map((g) => {
                    const active = hudSettings.graphicsQuality === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() =>
                          onUpdateHudSettings({
                            ...hudSettings,
                            graphicsQuality: g.id,
                          })
                        }
                        className={`min-h-[40px] px-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-sky-500 text-zinc-950 border-sky-300 font-bold'
                            : 'bg-[#070c14] text-zinc-300 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-400">
                  {GRAPHICS_OPTIONS.find((g) => g.id === hudSettings.graphicsQuality)?.detail}
                </p>
              </div>
            </div>

            {/* Bottom Full-Width Launch Action */}
            <button
              type="button"
              onClick={onDeploySimulator}
              className="w-full min-h-[52px] px-6 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-zinc-950 font-display text-lg font-extrabold tracking-wide flex items-center justify-center gap-2 transition-colors shadow-xl"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start World Simulator</span>
            </button>
          </section>
        </div>
      </main>
    </div>
  );
};
