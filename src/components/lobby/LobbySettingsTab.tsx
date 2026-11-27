import React from 'react';
import {
  Gamepad2,
  Languages,
  Maximize2,
  Minimize2,
  Music2,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { HudSettings, LobbyLanguage } from '../../types';
import {
  clampMusicVolume,
  saveStoredMusicVolume,
  type LobbyCopyDictionary,
} from '../../game/lobbyConfig';
import { soundEngine } from '../../game/audio';

interface LobbySettingsTabProps {
  hudSettings: HudSettings;
  musicVolume: number;
  isFullscreen: boolean;
  copy: LobbyCopyDictionary;
  onChangeMusicVolume: (vol: number) => void;
  onUpdateHudSettings: (updater: (prev: HudSettings) => HudSettings) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenHudEditor: () => void;
  onOpenGraphicsTab: () => void;
}

const LANGUAGES: { id: LobbyLanguage; label: string; native: string }[] = [
  { id: 'en', label: 'English', native: 'EN' },
  { id: 'es', label: 'Español', native: 'ES' },
  { id: 'fr', label: 'Français', native: 'FR' },
  { id: 'ar', label: 'العربية', native: 'AR' },
];

export const LobbySettingsTab: React.FC<LobbySettingsTabProps> = ({
  hudSettings,
  musicVolume,
  isFullscreen,
  copy,
  onChangeMusicVolume,
  onUpdateHudSettings,
  onToggleMute,
  onToggleFullscreen,
  onOpenHudEditor,
  onOpenGraphicsTab,
}) => {
  const activeLang: LobbyLanguage = hudSettings.language ?? 'en';

  const handleMusicChange = (val: number) => {
    const clamped = clampMusicVolume(val);
    saveStoredMusicVolume(clamped);
    soundEngine.setMusicVolume(clamped);
    onChangeMusicVolume(clamped);
  };

  return (
    <div className="space-y-4 animate-liquid-tab">
      <div className="liquid-glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-cyan-300" />
            <span>{copy.settingsTitle}</span>
          </h2>
          <p className="text-xs text-slate-300">
            Configure Audio mix, camera response, touch HUD ergonomics, and interface language.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenGraphicsTab}
          className="liquid-glass-card px-3.5 py-2 rounded-xl text-xs font-semibold text-orange-200 border-orange-400/40 hover:border-orange-300 flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-orange-300" />
          <span>Graphics Preferences →</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Audio & Music Card */}
        <div className="liquid-glass-card rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl liquid-glass-icon-3d flex items-center justify-center text-cyan-300">
                {hudSettings.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Audio & Sound Effects</h3>
                <p className="text-[11px] text-slate-400">Real-time SFX & Mansion Club DJ levels</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleMute}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                hudSettings.muted
                  ? 'bg-rose-500/25 border-rose-400/60 text-rose-200'
                  : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
              }`}
            >
              {hudSettings.muted ? 'Audio Muted' : 'Audio On'}
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200 font-medium">Master Sound Effects</span>
              <span className="text-cyan-300 font-bold tabular-nums">
                {Math.round(hudSettings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={hudSettings.sfxVolume}
              aria-label="Master SFX volume"
              onChange={(e) =>
                onUpdateHudSettings((prev) => ({
                  ...prev,
                  sfxVolume: Number(e.target.value),
                  muted: Number(e.target.value) === 0 ? true : false,
                }))
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200 font-medium flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5 text-orange-300" />
                Mansion Club DJ & Music
              </span>
              <span className="text-orange-300 font-bold tabular-nums">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicVolume}
              aria-label="Club music volume"
              onChange={(e) => handleMusicChange(Number(e.target.value))}
              className="w-full accent-orange-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Camera Sensitivity & Controls */}
        <div className="liquid-glass-card rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl liquid-glass-icon-3d flex items-center justify-center text-orange-300">
              <Gamepad2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Controls & Camera Sensitivity</h3>
              <p className="text-[11px] text-slate-400">Look speed, touch controls & ergonomics</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200 font-medium">Camera Look Sensitivity</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateHudSettings((prev) => ({
                      ...prev,
                      lookSensitivity: Math.max(0.5, Number((prev.lookSensitivity - 0.1).toFixed(2))),
                    }))
                  }
                  className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                >
                  -
                </button>
                <span className="w-12 text-center font-bold text-cyan-200 tabular-nums">
                  {hudSettings.lookSensitivity.toFixed(2)}x
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateHudSettings((prev) => ({
                      ...prev,
                      lookSensitivity: Math.min(3.0, Number((prev.lookSensitivity + 0.1).toFixed(2))),
                    }))
                  }
                  className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.05}
              value={hudSettings.lookSensitivity}
              aria-label="Camera look sensitivity"
              onChange={(e) =>
                onUpdateHudSettings((prev) => ({
                  ...prev,
                  lookSensitivity: Number(e.target.value),
                }))
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                onUpdateHudSettings((prev) => ({ ...prev, autoSprint: !prev.autoSprint }))
              }
              className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                hudSettings.autoSprint
                  ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-100'
                  : 'bg-slate-950/45 border-white/10 text-slate-400'
              }`}
            >
              Auto Sprint: {hudSettings.autoSprint ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateHudSettings((prev) => ({ ...prev, leftHanded: !prev.leftHanded }))
              }
              className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                hudSettings.leftHanded
                  ? 'bg-orange-500/25 border-orange-400/60 text-orange-100'
                  : 'bg-slate-950/45 border-white/10 text-slate-300'
              }`}
            >
              Left-Hand: {hudSettings.leftHanded ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateHudSettings((prev) => ({ ...prev, showRadar: !prev.showRadar }))
              }
              className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                hudSettings.showRadar
                  ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-100'
                  : 'bg-slate-950/45 border-white/10 text-slate-400'
              }`}
            >
              Radar: {hudSettings.showRadar ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenHudEditor}
              className="flex-1 py-2.5 px-3 rounded-xl liquid-glass-card border-cyan-400/45 text-xs font-semibold text-cyan-100 cursor-pointer"
            >
              Customize Touch HUD Layout
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="py-2.5 px-3.5 rounded-xl bg-slate-950/55 border border-white/15 hover:border-white/30 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" /> Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
                </>
              )}
            </button>
          </div>
        </div>

        {/* Interface Customization */}
        <div className="liquid-glass-card rounded-2xl p-4 space-y-3.5">
          <h3 className="text-sm font-bold text-white">Interface Customization</h3>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200">In-World HUD Scale</span>
              <span className="text-cyan-300 font-bold tabular-nums">
                {Math.round(hudSettings.hudScale * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.75}
              max={1.3}
              step={0.05}
              value={hudSettings.hudScale}
              aria-label="HUD Scale"
              onChange={(e) =>
                onUpdateHudSettings((prev) => ({ ...prev, hudScale: Number(e.target.value) }))
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200">HUD Glass Opacity</span>
              <span className="text-cyan-300 font-bold tabular-nums">
                {Math.round(hudSettings.hudOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.45}
              max={1}
              step={0.05}
              value={hudSettings.hudOpacity}
              aria-label="HUD Opacity"
              onChange={(e) =>
                onUpdateHudSettings((prev) => ({ ...prev, hudOpacity: Number(e.target.value) }))
              }
              className="w-full accent-orange-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Language Selector */}
        <div className="liquid-glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl liquid-glass-icon-3d flex items-center justify-center text-cyan-300">
              <Languages className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Interface Language</h3>
              <p className="text-[11px] text-slate-400">Switches Lobby & Pause Menu labels live</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LANGUAGES.map((lang) => {
              const active = activeLang === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  data-testid={`lang-${lang.id}`}
                  onClick={() =>
                    onUpdateHudSettings((prev) => ({ ...prev, language: lang.id }))
                  }
                  className={`py-2 px-3 rounded-xl border text-left transition-all cursor-pointer ${
                    active ? 'liquid-glass-card-active text-white' : 'bg-slate-950/50 border-white/10 text-slate-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-cyan-300">{lang.native}</div>
                  <div className="text-xs font-semibold truncate">{lang.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
