import React, { useEffect, useState } from 'react';
import { Crosshair, Globe2, Smartphone } from 'lucide-react';
import { LoadProgress } from '../types';

interface LoadingScreenProps {
  loadProgress: LoadProgress;
  isFadingOut: boolean;
}

const LOADING_POSTER_IMG = './assets/aistudio/23332-50kb_a46294ed.jpeg';

const LOADING_TIPS = [
  'Explore the living Open-World Simulator across East Island, West City, Bay Downtown & Central Districts.',
  'Drive 5 Cyber Superbike styles, hypercars & 4x4s with 3-stage crash deformation & Action Camera.',
  'Step inside the Waterfront Resort Hotel, Grand Atrium Mall, Hospital, Offices & Petrol Station.',
  'Dynamic Morning, Afternoon, Sunset & Night cycles activate city streetlights and illuminated windows.',
  'Push forward smoothly on the movement zone to Auto-Sprint, or cycle driving views with [C] / CAM.',
  'Everything runs 100% locally offline with 60 FPS smooth graphics presets in the HUD settings drawer.',
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  loadProgress,
  isFadingOut,
}) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % LOADING_TIPS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  const pct = Math.max(0, Math.min(100, Math.round(loadProgress.progress)));

  return (
    <div
      data-testid="loading-screen"
      className={`fixed inset-0 z-50 bg-[#05070c] flex flex-col justify-between overflow-hidden transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient Blurred Background Fill + Animated Full-Frame Poster */}
      {!imgError ? (
        <div className="absolute inset-0 overflow-hidden bg-[#060911]">
          {/* Deep ambient fill behind poster so tall or widescreen screens never have flat black bars */}
          <img
            src={LOADING_POSTER_IMG}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center scale-110 opacity-40 blur-xl select-none pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#04070e]/70 via-[#04070e]/25 to-[#04070e]/90 pointer-events-none" />

          {/* Crisp Framed Animated Main Poster */}
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6 pb-28 sm:pb-32 pt-14 sm:pt-16">
            <div className="relative h-full max-h-[680px] aspect-square max-w-full rounded-xl overflow-hidden border-2 border-amber-400/55 shadow-[0_0_60px_rgba(245,158,11,0.22)] bg-[#090d16]">
              <img
                src={LOADING_POSTER_IMG}
                alt="Apex Dropzone — Open World Simulator Poster"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover object-center animate-poster-drift select-none"
              />
              {/* Animated light sheen across poster */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-poster-sheen"
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, #1e293b 0%, #0b0f17 65%, #05070b 100%)',
          }}
        />
      )}

      {/* Top Brand Header Bar */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 pt-3 sm:pt-4 pb-3 bg-gradient-to-b from-[#04070e]/95 via-[#04070e]/70 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-amber-500/20 border border-amber-400/55 flex items-center justify-center">
            <Crosshair className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="font-display text-lg sm:text-2xl font-extrabold tracking-wider text-white uppercase leading-none">
              Apex Dropzone
            </div>
            <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300 mt-0.5">
              Open-World City &amp; Driving Simulator
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/90 border border-sky-400/35 text-[10px] font-mono text-sky-200">
            <Globe2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Offline Open-World Ready</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-950/90 border border-white/15 text-[10px] font-mono text-zinc-200">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Touch &amp; Desktop</span>
          </div>
        </div>
      </div>

      {/* Bottom Animated Loading Dock */}
      <div className="relative z-10 w-full px-4 sm:px-8 pb-4 sm:pb-6 pt-10 bg-gradient-to-t from-[#04070e] via-[#04070e]/95 to-transparent">
        <div className="max-w-4xl mx-auto space-y-2.5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.18em] text-amber-400 font-bold">
                {loadProgress.stage}
              </div>
              <div className="text-xs sm:text-sm text-zinc-200 truncate">
                {loadProgress.detail}
              </div>
            </div>

            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white tabular-nums shrink-0 leading-none">
              {pct}
              <span className="text-amber-400 text-lg sm:text-xl ml-0.5">%</span>
            </div>
          </div>

          <div className="relative h-2.5 sm:h-3 w-full rounded-full bg-zinc-900/95 border border-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-sky-400 transition-[width] duration-200 ease-out relative"
              style={{ width: `${pct}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-7 bg-white/55 blur-[2px]" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-0.5 text-[11px] sm:text-xs text-zinc-300">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold shrink-0">
                World Intel
              </span>
              <span className="truncate sm:whitespace-normal">{LOADING_TIPS[tipIndex]}</span>
            </div>
            <span className="font-mono text-[10px] text-zinc-400 shrink-0 hidden sm:inline">
              Unified Mega-World Simulator
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
