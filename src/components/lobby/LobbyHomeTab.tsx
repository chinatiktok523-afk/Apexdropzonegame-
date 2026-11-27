import React, { useRef, useState } from 'react';
import {
  Bike,
  CloudSun,
  Compass,
  Coins,
  Eye,
  Film,
  MapPin,
  Pause,
  Play,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BIKE_STYLES,
  SIMULATOR_POIS,
  type BikeStyleId,
  type LobbyViewMode,
  type TimeOfDayPhase,
  type WeatherKind,
} from '../../types';
import type { SimulatorProgress } from '../../game/offlineStorage';
import {
  MAIN_SCREEN_VIDEO_URL,
  TOTAL_WORLD_ZONES,
  type LobbyCopyDictionary,
} from '../../game/lobbyConfig';

interface LobbyHomeTabProps {
  simStartPoiId: string;
  simTimePhase: TimeOfDayPhase;
  simWeather: WeatherKind;
  simAutoCycle: boolean;
  simBikeStyle: BikeStyleId;
  simProgress: SimulatorProgress;
  previewMode: LobbyViewMode;
  copy: LobbyCopyDictionary;
  onChangePreviewMode: (mode: LobbyViewMode) => void;
  onSelectSimStartPoi: (poiId: string) => void;
  onSelectSimTimePhase: (phase: TimeOfDayPhase) => void;
  onSelectSimWeather: (weather: WeatherKind) => void;
  onToggleSimAutoCycle: () => void;
  onSelectSimBikeStyle: (style: BikeStyleId) => void;
  onDeploySimulator: () => void;
  onOpenWorldSelect: () => void;
}

const TIME_PHASES: { id: TimeOfDayPhase; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Noon' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'night', label: 'Night' },
];

const WEATHER_OPTIONS: { id: WeatherKind; label: string }[] = [
  { id: 'clear', label: 'Clear' },
  { id: 'cloudy', label: 'Cloudy' },
  { id: 'foggy', label: 'Foggy' },
  { id: 'rainy', label: 'Rainy' },
];

export const LobbyHomeTab: React.FC<LobbyHomeTabProps> = ({
  simStartPoiId,
  simTimePhase,
  simWeather,
  simAutoCycle,
  simBikeStyle,
  simProgress,
  previewMode,
  copy,
  onChangePreviewMode,
  onSelectSimStartPoi,
  onSelectSimTimePhase,
  onSelectSimWeather,
  onToggleSimAutoCycle,
  onSelectSimBikeStyle,
  onDeploySimulator,
  onOpenWorldSelect,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoPaused, setVideoPaused] = useState(false);

  const selectedPoi =
    simStartPoiId === 'saved_pos' && simProgress.hasSavedPosition
      ? {
          id: 'saved_pos',
          name: simProgress.lastDistrict || copy.savedWorldPos,
          subtitle: `X: ${Math.round(simProgress.lastX)} · Z: ${Math.round(simProgress.lastZ)}`,
          x: simProgress.lastX,
          z: simProgress.lastZ,
        }
      : (SIMULATOR_POIS.find((p) => p.id === simStartPoiId) ?? SIMULATOR_POIS[0]);

  const zonesExploredCount = Math.min(TOTAL_WORLD_ZONES, simProgress.visitedDistricts.length);
  const zonesPct = Math.round((zonesExploredCount / TOTAL_WORLD_ZONES) * 100);

  const toggleTheaterPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setVideoPaused(false);
    } else {
      v.pause();
      setVideoPaused(true);
    }
  };

  const toggleTheaterAudio = () => {
    const v = videoRef.current;
    const nextMuted = !videoMuted;
    setVideoMuted(nextMuted);
    if (v) {
      v.muted = nextMuted;
      if (!nextMuted && v.paused) {
        v.play().catch(() => {});
        setVideoPaused(false);
      }
    }
  };

  return (
    <div className="space-y-4 animate-liquid-tab">
      {/* Top Hero Banner Card */}
      <div className="liquid-glass-card liquid-prism-edge rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-[11px] font-semibold text-cyan-200 tracking-wide">
            <Compass className="w-3.5 h-3.5 text-cyan-300" />
            <span>UNIFIED MEGA-WORLD SIMULATOR</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {copy.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            {copy.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          {simProgress.hasSavedPosition && (
            <button
              type="button"
              onClick={() => {
                onSelectSimStartPoi('saved_pos');
                onDeploySimulator();
              }}
              className="liquid-glass-card px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold text-cyan-100 border-cyan-400/45 hover:border-cyan-300 cursor-pointer flex items-center gap-2"
            >
              <Play className="w-4 h-4 text-cyan-300 fill-cyan-300/30" />
              <span>{copy.continueExploration}</span>
            </button>
          )}
          <button
            type="button"
            data-testid="sim-lobby-launch-btn"
            onClick={onDeploySimulator}
            className="liquid-cta-orange px-5 sm:px-6 py-3 rounded-xl font-display text-base sm:text-lg font-bold text-slate-950 tracking-wide cursor-pointer flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{copy.enterWorld}</span>
          </button>
        </div>
      </div>

      {/* 4 Telemetry & Progress Glass Tiles */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-300">{copy.zonesExplored}</span>
            <span className="w-7 h-7 rounded-lg liquid-glass-icon-3d flex items-center justify-center text-cyan-300">
              <Compass className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold text-white tabular-nums">
            {zonesExploredCount} / {TOTAL_WORLD_ZONES}
          </div>
          <div className="h-1.5 rounded-full bg-slate-900/75 overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-orange-400 transition-all duration-300"
              style={{ width: `${Math.max(5, zonesPct)}%` }}
            />
          </div>
        </div>

        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-300">{copy.credits}</span>
            <span className="w-7 h-7 rounded-lg liquid-glass-icon-3d flex items-center justify-center text-amber-300">
              <Coins className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold text-amber-300 tabular-nums">
            {simProgress.credits.toLocaleString()}₡
          </div>
          <div className="text-[11px] text-slate-400">
            Spent {simProgress.totalSpentCredits.toLocaleString()}₡ in world shops
          </div>
        </div>

        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-300">{copy.savedWorldPos}</span>
            <span className="w-7 h-7 rounded-lg liquid-glass-icon-3d flex items-center justify-center text-emerald-300">
              <MapPin className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-sm font-bold text-white truncate">
            {simProgress.hasSavedPosition ? simProgress.lastDistrict : 'No Saved Spot Yet'}
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {simProgress.hasSavedPosition
              ? `Coords ${Math.round(simProgress.lastX)}, ${Math.round(simProgress.lastZ)}`
              : 'Auto-saves during exploration'}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenWorldSelect}
          className="liquid-glass-card rounded-2xl p-3.5 space-y-1.5 text-left cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-300">{copy.startingDistrict}</span>
            <span className="w-7 h-7 rounded-lg liquid-glass-icon-3d flex items-center justify-center text-orange-300 group-hover:scale-105 transition-transform">
              <Eye className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-sm font-bold text-orange-200 truncate">{selectedPoi.name}</div>
          <div className="text-[11px] text-cyan-300 font-medium">
            Tap to browse {SIMULATOR_POIS.length} locations →
          </div>
        </button>
      </div>

      {/* Interactive Split: Live 3D World Camera + Bike Customizer vs Main Screen Video Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left: Live 3D Preview Camera, Cyber Bike Paint & Atmosphere */}
        <div className="lg:col-span-7 liquid-glass-card rounded-2xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Bike className="w-4 h-4 text-cyan-300" />
                <span>Live 3D Preview & Cyber Bike</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Smoothly glide the background 3D camera between Courtyard, Bike View & City Flyover
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/55 p-1 rounded-xl border border-white/10">
              {(
                [
                  { id: 'overview', label: 'Courtyard' },
                  { id: 'bike', label: copy.bikeView },
                  { id: 'map', label: copy.cityFlyover },
                ] as const
              ).map((cam) => {
                const active = previewMode === cam.id;
                return (
                  <button
                    key={cam.id}
                    type="button"
                    data-testid={`preview-mode-${cam.id}`}
                    onClick={() => onChangePreviewMode(cam.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-cyan-500/80 to-sky-500/80 text-white shadow-[0_0_12px_rgba(56,189,248,0.45)]'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {cam.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cyber Bike Livery Swatches */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Cyber Superbike Coating</span>
              <span className="text-cyan-200 font-semibold">
                {BIKE_STYLES.find((b) => b.id === simBikeStyle)?.name}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {BIKE_STYLES.map((b) => {
                const active = simBikeStyle === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onSelectSimBikeStyle(b.id);
                      if (previewMode !== 'bike') {
                        onChangePreviewMode('bike');
                      }
                    }}
                    className={`px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      active
                        ? 'liquid-glass-card-active text-white'
                        : 'bg-slate-950/45 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/50 shadow-sm"
                      style={{ backgroundColor: b.swatchCss }}
                    />
                    <span className="text-[11px] font-semibold truncate">{b.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Environment Time & Weather */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <CloudSun className="w-3.5 h-3.5 text-amber-300" />
                  Time of Day
                </span>
                <button
                  type="button"
                  onClick={onToggleSimAutoCycle}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer border ${
                    simAutoCycle
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                      : 'bg-white/5 border-white/15 text-slate-400'
                  }`}
                >
                  <RotateCw className="w-2.5 h-2.5" />
                  {simAutoCycle ? 'Auto Cycle' : 'Locked'}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {TIME_PHASES.map((tp) => {
                  const active = simTimePhase === tp.id;
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => onSelectSimTimePhase(tp.id)}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-orange-500/25 border-orange-400/70 text-orange-100'
                          : 'bg-slate-950/45 border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      {tp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-300">Atmosphere Weather</div>
              <div className="grid grid-cols-4 gap-1.5">
                {WEATHER_OPTIONS.map((w) => {
                  const active = simWeather === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => onSelectSimWeather(w.id)}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-cyan-500/25 border-cyan-400/70 text-cyan-100'
                          : 'bg-slate-950/45 border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Main Screen Video Showcase Card */}
        <div className="lg:col-span-5 liquid-glass-card rounded-2xl p-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg liquid-glass-icon-3d flex items-center justify-center text-orange-300 shrink-0">
                <Film className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Main Screen Video</div>
                <div className="text-[11px] text-slate-400 truncate">
                  Syncs live on Mansion Hall TV & Supercar LCD
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggleTheaterPlay}
                aria-label={videoPaused ? 'Play main screen video' : 'Pause main screen video'}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white cursor-pointer"
              >
                {videoPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={toggleTheaterAudio}
                aria-label={videoMuted ? 'Unmute main screen video' : 'Mute main screen video'}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white cursor-pointer"
              >
                {videoMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-300" />}
              </button>
            </div>
          </div>

          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-cyan-400/30 bg-slate-950/80 shadow-inner">
            <video
              ref={videoRef}
              src={MAIN_SCREEN_VIDEO_URL}
              autoPlay
              loop
              muted={videoMuted}
              playsInline
              preload="auto"
              data-testid="main-screen-video-player"
              className="w-full h-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/92 via-slate-950/48 to-transparent px-3 py-1.5 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-cyan-200 tracking-wide drop-shadow">
                APEX BROADCAST STREAM
              </span>
              <span className="text-slate-200 tabular-nums drop-shadow">60 FPS · LOOP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
