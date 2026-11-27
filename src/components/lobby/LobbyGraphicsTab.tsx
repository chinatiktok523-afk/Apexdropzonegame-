import React from 'react';
import { Eye, Layers, Palette, RotateCcw, Sparkles, Sun } from 'lucide-react';
import type {
  GraphicsQuality,
  HudSettings,
  QualityTierOption,
  ShadowQualityOption,
} from '../../types';
import {
  QUALITY_PRESET_CARDS,
  SATURATION_PRESETS,
  buildPresetGraphicsPatch,
  resolveGraphicsProfile,
  type LobbyCopyDictionary,
} from '../../game/lobbyConfig';

interface LobbyGraphicsTabProps {
  hudSettings: HudSettings;
  copy: LobbyCopyDictionary;
  onUpdateHudSettings: (updater: (prev: HudSettings) => HudSettings) => void;
}

const THREE_TIER_OPTIONS: { id: QualityTierOption; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

const SHADOW_OPTIONS: { id: ShadowQualityOption; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Med' },
  { id: 'high', label: 'High' },
];

const REFLECTION_OPTIONS: { id: 'off' | 'low' | 'high'; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'low', label: 'Standard' },
  { id: 'high', label: 'Studio PBR' },
];

export const LobbyGraphicsTab: React.FC<LobbyGraphicsTabProps> = ({
  hudSettings,
  copy,
  onUpdateHudSettings,
}) => {
  const gfx = resolveGraphicsProfile(hudSettings, false);

  const applyPreset = (quality: GraphicsQuality) => {
    const patch = buildPresetGraphicsPatch(quality);
    onUpdateHudSettings((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="space-y-4 animate-liquid-tab">
      {/* Header */}
      <div className="liquid-glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-300" />
            <span>{copy.graphicsTitle}</span>
          </h2>
          <p className="text-xs text-slate-300">
            Changes apply immediately to the live 3D city behind the glass panel.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onUpdateHudSettings((prev) => ({
              ...prev,
              ...buildPresetGraphicsPatch('high'),
              mapSaturation: 1.38,
            }))
          }
          className="liquid-glass-card px-3.5 py-2 rounded-xl text-xs font-semibold text-cyan-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restore Ultra Defaults</span>
        </button>
      </div>

      {/* Graphics Quality Tiers: 60 FPS Smooth / Balanced / Ultra Detail */}
      <div className="liquid-glass-card liquid-prism-edge rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-300" />
            <span>Master Graphics Performance Preset</span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
            Active: {QUALITY_PRESET_CARDS.find((c) => c.id === gfx.preset)?.title}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {QUALITY_PRESET_CARDS.map((card) => {
            const active = gfx.preset === card.id;
            return (
              <button
                key={card.id}
                type="button"
                data-testid={`graphics-preset-${card.id}`}
                onClick={() => applyPreset(card.id)}
                className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer space-y-1.5 ${
                  active ? 'liquid-glass-card liquid-glass-card-active' : 'liquid-glass-card'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">{card.title}</span>
                  {active && (
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#38bdf8]" />
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">{card.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Color Saturation Presets + Custom Slider */}
      <div className="liquid-glass-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-orange-300" />
            <span>Map Color Saturation</span>
          </div>
          <span className="text-xs font-bold text-cyan-200 tabular-nums">
            {gfx.mapSaturation.toFixed(2)}x
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {SATURATION_PRESETS.map((sat) => {
            const active = Math.abs(gfx.mapSaturation - sat.value) < 0.04;
            return (
              <button
                key={sat.id}
                type="button"
                data-testid={`sat-preset-${sat.id}`}
                onClick={() =>
                  onUpdateHudSettings((prev) => ({ ...prev, mapSaturation: sat.value }))
                }
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  active
                    ? 'liquid-glass-card-active text-white'
                    : 'bg-slate-950/50 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {sat.label} ({sat.value.toFixed(2)})
              </button>
            );
          })}
        </div>

        <div className="space-y-1 pt-1">
          <input
            type="range"
            min={0.8}
            max={1.8}
            step={0.02}
            value={gfx.mapSaturation}
            aria-label="Custom map saturation"
            onChange={(e) =>
              onUpdateHudSettings((prev) => ({
                ...prev,
                mapSaturation: Number(e.target.value),
              }))
            }
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
            <span>0.80 Natural</span>
            <span>1.38 Vibrant</span>
            <span>1.80 Maximum</span>
          </div>
        </div>
      </div>

      {/* Granular Rendering Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Map Quality */}
        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span>Map & Geometry Detail</span>
            <span className="text-cyan-300 uppercase">{gfx.mapQuality}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {THREE_TIER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onUpdateHudSettings((prev) => ({ ...prev, mapQuality: opt.id }))
                }
                className={`py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  gfx.mapQuality === opt.id
                    ? 'bg-cyan-500/25 border-cyan-400/70 text-cyan-100'
                    : 'bg-slate-950/45 border-white/10 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Texture Quality */}
        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span>Surface Texture Quality</span>
            <span className="text-cyan-300 uppercase">{gfx.textureQuality}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {THREE_TIER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onUpdateHudSettings((prev) => ({ ...prev, textureQuality: opt.id }))
                }
                className={`py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  gfx.textureQuality === opt.id
                    ? 'bg-cyan-500/25 border-cyan-400/70 text-cyan-100'
                    : 'bg-slate-950/45 border-white/10 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shadow Quality */}
        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span>Real-Time Shadow Quality</span>
            <span className="text-orange-300 uppercase">{gfx.shadowQuality}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {SHADOW_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onUpdateHudSettings((prev) => ({ ...prev, shadowQuality: opt.id }))
                }
                className={`py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  gfx.shadowQuality === opt.id
                    ? 'bg-orange-500/25 border-orange-400/70 text-orange-100'
                    : 'bg-slate-950/45 border-white/10 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lighting Quality */}
        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-300" />
              Lighting & Neon Rim Lights
            </span>
            <span className="text-cyan-300 uppercase">{gfx.lightingQuality}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {THREE_TIER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onUpdateHudSettings((prev) => ({ ...prev, lightingQuality: opt.id }))
                }
                className={`py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  gfx.lightingQuality === opt.id
                    ? 'bg-cyan-500/25 border-cyan-400/70 text-cyan-100'
                    : 'bg-slate-950/45 border-white/10 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reflection Quality */}
        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span>Reflections & Metallic IBL</span>
            <span className="text-cyan-300 uppercase">{gfx.reflectionQuality}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {REFLECTION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onUpdateHudSettings((prev) => ({ ...prev, reflectionQuality: opt.id }))
                }
                className={`py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                  gfx.reflectionQuality === opt.id
                    ? 'bg-cyan-500/25 border-cyan-400/70 text-cyan-100'
                    : 'bg-slate-950/45 border-white/10 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Draw Distance & Bloom */}
        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-300" />
              Draw Distance & Bloom
            </span>
            <span className="text-cyan-200 tabular-nums">
              {Math.round(gfx.drawDistance * 100)}% Range
            </span>
          </div>

          <input
            type="range"
            min={0.6}
            max={1.4}
            step={0.05}
            value={gfx.drawDistance}
            aria-label="Draw distance"
            onChange={(e) =>
              onUpdateHudSettings((prev) => ({
                ...prev,
                drawDistance: Number(e.target.value),
              }))
            }
            className="w-full accent-orange-400 cursor-pointer"
          />

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-slate-300">HDR Unreal Bloom Glow</span>
            <button
              type="button"
              onClick={() =>
                onUpdateHudSettings((prev) => ({
                  ...prev,
                  bloomEnabled: !gfx.bloomEnabled,
                }))
              }
              className={`px-3 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                gfx.bloomEnabled
                  ? 'bg-cyan-500/25 border-cyan-400/70 text-cyan-100'
                  : 'bg-slate-950/50 border-white/15 text-slate-400'
              }`}
            >
              {gfx.bloomEnabled ? 'ENABLED' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
