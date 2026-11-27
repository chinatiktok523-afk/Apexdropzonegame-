import React, { useState } from 'react';
import { AlertTriangle, LogOut, Play, RotateCcw } from 'lucide-react';
import { MAP_PRESETS, type GraphicsQuality, type LobbyLanguage, type MapId } from '../types';
import { getLobbyCopy } from '../game/lobbyConfig';

interface SimulatorPauseModalProps {
  simMapId: MapId;
  graphicsQuality: GraphicsQuality;
  language?: LobbyLanguage;
  onResume: () => void;
  onResetPosition: () => void;
  onExitToLobby: () => void;
}

export const SimulatorPauseModal: React.FC<SimulatorPauseModalProps> = ({
  simMapId,
  graphicsQuality,
  language,
  onResume,
  onResetPosition,
  onExitToLobby,
}) => {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const copy = getLobbyCopy(language);
  const isPerfLite = graphicsQuality === 'low';

  return (
    <div
      data-testid="simulator-pause-modal"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className={`fixed inset-0 z-30 bg-slate-950/50 ${
        isPerfLite ? 'glass-perf-lite' : 'backdrop-blur-[3px]'
      } flex items-center justify-center p-4 sm:p-6`}
    >
      <div className="w-full max-w-md liquid-glass-shell liquid-prism-edge animate-glass-modal rounded-3xl p-6 sm:p-7 space-y-5 border border-cyan-400/45 shadow-[0_24px_70px_rgba(0,0,0,0.65),0_0_40px_rgba(56,189,248,0.18)]">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-[11px] font-semibold text-cyan-200 tracking-wide">
            <span>WORLD SIMULATOR · {MAP_PRESETS[simMapId].name.split(':')[0].toUpperCase()}</span>
          </div>
          <h2 className="font-display text-3xl font-bold text-white tracking-tight pt-1">
            {copy.pauseTitle}
          </h2>
          <p className="text-xs text-slate-300">
            Your discovered districts, credits & exact world coordinates are auto-saved.
          </p>
        </div>

        {!confirmingReset ? (
          <div className="space-y-3">
            {/* Resume Exploration — Glowing Orange/Cyan Glass Button */}
            <button
              type="button"
              data-testid="pause-resume-btn"
              onClick={onResume}
              className="liquid-cta-orange w-full py-3.5 px-4 rounded-2xl flex items-center justify-center gap-3 font-display text-lg font-bold text-slate-950 cursor-pointer"
            >
              <span className="w-8 h-8 rounded-xl bg-slate-950/15 flex items-center justify-center">
                <Play className="w-4 h-4 fill-slate-950" />
              </span>
              <span>{copy.resumeExploration}</span>
            </button>

            {/* Reset World Position — Dark Glass Button (Asks confirmation) */}
            <button
              type="button"
              data-testid="pause-reset-btn"
              onClick={() => setConfirmingReset(true)}
              className="liquid-glass-card w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-3 text-sm font-semibold text-white hover:border-cyan-400/60 cursor-pointer"
            >
              <span className="w-8 h-8 rounded-xl liquid-glass-icon-3d flex items-center justify-center text-cyan-300">
                <RotateCcw className="w-4 h-4" />
              </span>
              <span>{copy.resetWorldPos}</span>
            </button>

            {/* Exit to Simulator Lobby — Subtle Red/Dark Glass Button */}
            <button
              type="button"
              data-testid="pause-exit-btn"
              onClick={onExitToLobby}
              className="w-full py-3 px-4 rounded-2xl bg-rose-950/35 hover:bg-rose-900/45 border border-rose-400/30 hover:border-rose-400/60 text-sm font-semibold text-rose-100 flex items-center justify-center gap-3 transition-all cursor-pointer"
            >
              <span className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-400/35 flex items-center justify-center text-rose-300">
                <LogOut className="w-4 h-4" />
              </span>
              <span>{copy.exitToLobby}</span>
            </button>
          </div>
        ) : (
          <div
            data-testid="pause-reset-confirmation"
            className="liquid-glass-card rounded-2xl p-4 border-amber-400/50 space-y-4"
          >
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">{copy.confirmResetTitle}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{copy.confirmResetBody}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="pause-reset-cancel-btn"
                onClick={() => setConfirmingReset(false)}
                className="liquid-glass-card py-2.5 px-3 rounded-xl text-xs font-semibold text-slate-200 cursor-pointer"
              >
                {copy.cancelAction}
              </button>
              <button
                type="button"
                data-testid="pause-reset-confirm-btn"
                onClick={() => {
                  setConfirmingReset(false);
                  onResetPosition();
                }}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-bold shadow-[0_0_18px_rgba(245,158,11,0.4)] cursor-pointer"
              >
                {copy.confirmResetAction}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
