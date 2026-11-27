import React, { useCallback, useRef, useState } from 'react';
import {
  Bike,
  Coins,
  Compass,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Play,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { SimulatorProgress } from '../game/offlineStorage';
import {
  BIKE_STYLES,
  type BikeStyleId,
  type HudSettings,
  type LobbyViewMode,
  type TimeOfDayPhase,
  type WeatherKind,
} from '../types';
import {
  getLobbyCopy,
  loadStoredMusicVolume,
  type LobbyTabId,
} from '../game/lobbyConfig';
import { LobbyNavDock } from './lobby/LobbyNavDock';
import { LobbyHomeTab } from './lobby/LobbyHomeTab';
import { LobbyWorldSelectTab } from './lobby/LobbyWorldSelectTab';
import { LobbyGraphicsTab } from './lobby/LobbyGraphicsTab';
import { LobbySettingsTab } from './lobby/LobbySettingsTab';
import { LobbyProfileTab } from './lobby/LobbyProfileTab';

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
  onChangeLobbyViewMode?: (mode: LobbyViewMode) => void;
  onPreviewWorldCoords?: (x: number, z: number) => void;
  onLobbyCameraDrag?: (dx: number, dy: number) => void;
  onLobbyCameraZoom?: (delta: number) => void;
  signedInUserName?: string | null;
  authBusy?: boolean;
  onSignInGoogle?: () => void;
  onSignOut?: () => void;
}

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
  onChangeLobbyViewMode,
  onPreviewWorldCoords,
  onLobbyCameraDrag,
  onLobbyCameraZoom,
  signedInUserName,
  authBusy = false,
  onSignInGoogle,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<LobbyTabId>('home');
  const [previewMode, setPreviewMode] = useState<LobbyViewMode>('overview');
  const [peek3dWorld, setPeek3dWorld] = useState(false);
  const [musicVolume, setMusicVolume] = useState<number>(() => loadStoredMusicVolume());
  const dragPtrRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const copy = getLobbyCopy(hudSettings.language);
  const isPerfLite = hudSettings.graphicsQuality === 'low';

  const applyHudUpdate = useCallback(
    (updater: (prev: HudSettings) => HudSettings) => {
      onUpdateHudSettings(updater(hudSettings));
    },
    [hudSettings, onUpdateHudSettings],
  );

  const handlePreviewModeChange = useCallback(
    (mode: LobbyViewMode, autoOpenShowroom = false) => {
      setPreviewMode(mode);
      onChangeLobbyViewMode?.(mode);
      if (mode === 'bike') {
        setPeek3dWorld(true);
      } else if (mode === 'overview') {
        setPeek3dWorld(false);
      } else if (autoOpenShowroom && activeTab !== 'world') {
        setPeek3dWorld(true);
      }
    },
    [activeTab, onChangeLobbyViewMode],
  );

  const handleSelectTab = useCallback(
    (tab: LobbyTabId) => {
      setActiveTab(tab);
      setPeek3dWorld(false);
      if (tab === 'world' && previewMode !== 'map') {
        setPreviewMode('map');
        onChangeLobbyViewMode?.('map');
      } else if (tab === 'home' && previewMode === 'map') {
        setPreviewMode('overview');
        onChangeLobbyViewMode?.('overview');
      }
    },
    [previewMode, onChangeLobbyViewMode],
  );

  const handlePreviewLocation = useCallback(
    (x: number, z: number) => {
      setPreviewMode('map');
      onChangeLobbyViewMode?.('map');
      onPreviewWorldCoords?.(x, z);
    },
    [onChangeLobbyViewMode, onPreviewWorldCoords],
  );

  const handleBgPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    dragPtrRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleBgPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = dragPtrRef.current;
    if (!ptr || ptr.id !== e.pointerId) return;
    const dx = e.clientX - ptr.x;
    const dy = e.clientY - ptr.y;
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    onLobbyCameraDrag?.(dx, dy);
  };

  const handleBgPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPtrRef.current?.id === e.pointerId) {
      dragPtrRef.current = null;
    }
  };

  return (
    <div
      data-testid="simulator-lobby-screen"
      dir={hudSettings.language === 'ar' ? 'rtl' : 'ltr'}
      onPointerDown={handleBgPointerDown}
      onPointerMove={handleBgPointerMove}
      onPointerUp={handleBgPointerUp}
      onPointerCancel={handleBgPointerUp}
      onWheel={(e) => {
        if (e.target === e.currentTarget) {
          onLobbyCameraZoom?.(e.deltaY > 0 ? 0.1 : -0.1);
        }
      }}
      className={`fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-4 lg:p-5 overflow-hidden bg-gradient-to-b from-slate-950/35 via-transparent to-slate-950/55 ${
        isPerfLite ? 'glass-perf-lite' : ''
      }`}
    >
      {/* Top Floating 3D Glass OS Status & Camera Preview Bar */}
      <header className="w-full max-w-[1280px] mx-auto liquid-glass-shell liquid-prism-edge rounded-2xl px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl liquid-glass-icon-3d-active flex items-center justify-center text-cyan-200 shrink-0">
            <Compass className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-white truncate">
              {copy.title}
            </div>
            <div className="text-[10px] text-cyan-300/85 truncate hidden sm:block">
              Drag open background to orbit live 3D world
            </div>
          </div>
        </div>

        {/* Center Camera Preview Mode Toggle (Bike View vs City Flyover) */}
        <div className="flex items-center gap-1.5 bg-slate-950/55 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            data-testid="topbar-bike-view-btn"
            onClick={() => handlePreviewModeChange('bike', true)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              previewMode === 'bike'
                ? 'bg-gradient-to-r from-orange-500/85 to-amber-500/85 text-slate-950 shadow-[0_0_12px_rgba(249,115,22,0.45)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            <span>{copy.bikeView}</span>
          </button>

          <button
            type="button"
            data-testid="topbar-city-flyover-btn"
            onClick={() => handlePreviewModeChange('map', true)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              previewMode === 'map'
                ? 'bg-gradient-to-r from-cyan-500/85 to-sky-500/85 text-white shadow-[0_0_12px_rgba(56,189,248,0.45)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{copy.cityFlyover}</span>
          </button>

          {(previewMode === 'bike' || previewMode === 'map') && (
            <div className="flex items-center gap-0.5 pl-1 border-l border-white/10">
              <button
                type="button"
                aria-label="Zoom in 3D preview"
                onClick={() => onLobbyCameraZoom?.(-0.14)}
                className="w-6 h-6 rounded-md hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Zoom out 3D preview"
                onClick={() => onLobbyCameraZoom?.(0.14)}
                className="w-6 h-6 rounded-md hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Utility Pill Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/35 text-xs font-bold text-amber-200 tabular-nums">
            <Coins className="w-3.5 h-3.5 text-amber-300" />
            <span>{simProgress.credits.toLocaleString()}₡</span>
          </div>

          <button
            type="button"
            onClick={() => setPeek3dWorld((v) => !v)}
            title={peek3dWorld ? 'Show Lobby Panel' : 'Inspect Live 3D World'}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-semibold text-cyan-100 flex items-center gap-1 cursor-pointer"
          >
            {peek3dWorld ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{peek3dWorld ? 'Show UI' : '3D View'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area: Sidebar + Transparent Frosted Glass Content Viewport */}
      {!peek3dWorld ? (
        <div className="flex-1 min-h-0 w-full max-w-[1280px] mx-auto my-2.5 sm:my-3.5 flex flex-col md:flex-row gap-3.5">
          {/* Desktop Vertical Sidebar */}
          <div className="hidden md:flex shrink-0">
            <LobbyNavDock activeTab={activeTab} onSelectTab={handleSelectTab} copy={copy} />
          </div>

          {/* Active Tab Content Panel (Single Shared Glass Blur Shell) */}
          <main className="flex-1 min-w-0 min-h-0 liquid-glass-shell liquid-prism-edge rounded-3xl p-3.5 sm:p-5 overflow-y-auto liquid-scroll">
            {activeTab === 'home' && (
              <LobbyHomeTab
                simStartPoiId={simStartPoiId}
                simTimePhase={simTimePhase}
                simWeather={simWeather}
                simAutoCycle={simAutoCycle}
                simBikeStyle={simBikeStyle}
                simProgress={simProgress}
                previewMode={previewMode}
                copy={copy}
                onChangePreviewMode={(mode) => handlePreviewModeChange(mode, true)}
                onSelectSimStartPoi={onSelectSimStartPoi}
                onSelectSimTimePhase={onSelectSimTimePhase}
                onSelectSimWeather={onSelectSimWeather}
                onToggleSimAutoCycle={onToggleSimAutoCycle}
                onSelectSimBikeStyle={onSelectSimBikeStyle}
                onDeploySimulator={onDeploySimulator}
                onOpenWorldSelect={() => handleSelectTab('world')}
              />
            )}

            {activeTab === 'world' && (
              <LobbyWorldSelectTab
                simStartPoiId={simStartPoiId}
                simProgress={simProgress}
                copy={copy}
                onSelectSimStartPoi={onSelectSimStartPoi}
                onPreviewWorldLocation={handlePreviewLocation}
                onDeploySimulator={onDeploySimulator}
              />
            )}

            {activeTab === 'graphics' && (
              <LobbyGraphicsTab
                hudSettings={hudSettings}
                copy={copy}
                onUpdateHudSettings={applyHudUpdate}
              />
            )}

            {activeTab === 'settings' && (
              <LobbySettingsTab
                hudSettings={hudSettings}
                musicVolume={musicVolume}
                isFullscreen={isFullscreen}
                copy={copy}
                onChangeMusicVolume={setMusicVolume}
                onUpdateHudSettings={applyHudUpdate}
                onToggleMute={onToggleMute}
                onToggleFullscreen={onToggleFullscreen}
                onOpenHudEditor={onOpenHudEditor}
                onOpenGraphicsTab={() => handleSelectTab('graphics')}
              />
            )}

            {activeTab === 'profile' && (
              <LobbyProfileTab
                simProgress={simProgress}
                signedInUserName={signedInUserName}
                authBusy={authBusy}
                copy={copy}
                onSignInGoogle={onSignInGoogle}
                onSignOut={onSignOut}
                onSelectResumeSaved={() => {
                  onSelectSimStartPoi('saved_pos');
                  onDeploySimulator();
                }}
              />
            )}
          </main>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-end items-center pb-2 sm:pb-3 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[920px] liquid-glass-shell liquid-prism-edge rounded-2xl px-3.5 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-glass-modal">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-cyan-200 tracking-wide">
                  {previewMode === 'bike'
                    ? `Cyber Bike Showcase · ${BIKE_STYLES.find((b) => b.id === simBikeStyle)?.name}`
                    : previewMode === 'map'
                      ? 'Live Mega-World Aerial Flyover'
                      : 'Live Courtyard 3D Preview'}
                </span>
                <span className="text-[10px] text-slate-300 hidden sm:inline">
                  Drag anywhere to orbit 360° · Scroll to zoom
                </span>
              </div>

              {previewMode === 'bike' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {BIKE_STYLES.map((b) => {
                    const active = simBikeStyle === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onSelectSimBikeStyle(b.id)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                          active
                            ? 'liquid-glass-card-active text-white'
                            : 'bg-slate-950/50 border-white/15 text-slate-300 hover:border-white/30'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-white/60"
                          style={{ backgroundColor: b.swatchCss }}
                        />
                        <span>{b.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="show-dashboard-btn"
                onClick={() => {
                  setPeek3dWorld(false);
                  if (previewMode === 'bike') {
                    setPreviewMode('overview');
                    onChangeLobbyViewMode?.('overview');
                  }
                }}
                className="liquid-glass-card px-3.5 py-2.5 rounded-xl text-xs font-semibold text-cyan-100 border-cyan-400/45 hover:border-cyan-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4 text-cyan-300" />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                data-testid="sim-lobby-launch-btn"
                onClick={onDeploySimulator}
                className="liquid-cta-orange px-5 py-2.5 rounded-xl font-display text-sm sm:text-base font-bold text-slate-950 flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{copy.enterWorld}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Liquid Glass Dock Navigation */}
      <div className="w-full max-w-[1280px] mx-auto shrink-0 md:hidden">
        <LobbyNavDock activeTab={activeTab} onSelectTab={handleSelectTab} copy={copy} />
      </div>
    </div>
  );
};
