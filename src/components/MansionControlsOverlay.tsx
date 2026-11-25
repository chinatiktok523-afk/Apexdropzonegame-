import React, { useState } from 'react';
import {
  CarFront,
  DoorOpen,
  KeyRound,
  Lightbulb,
  Lock,
  Minimize2,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import type { HudState, VehicleInputState } from '../types';
import type { MansionCarDoorAction } from '../game/mansionSystems';

interface MansionControlsOverlayProps {
  hud: HudState;
  hudScale: number;
  hudOpacity: number;
  onCarRemote: (action: MansionCarDoorAction) => void;
  onToggleDoors: () => void;
  onToggleWindow: (pane: 'FL' | 'FR' | 'RL' | 'RR' | 'ALL') => void;
  onToggleHeadlights: () => void;
  onVehicleInput?: (input: Partial<VehicleInputState>) => void;
}

export const MansionControlsOverlay: React.FC<MansionControlsOverlayProps> = ({
  hud,
  hudScale,
  hudOpacity,
  onCarRemote,
  onToggleDoors,
  onToggleWindow,
  onToggleHeadlights,
}) => {
  const [minimized, setMinimized] = useState(false);

  const mansion = hud.vehicle.mansion;
  if (!mansion) return null;

  const remote = !hud.vehicle.inVehicle ? mansion.nearbyRemote : null;
  const active = hud.vehicle.inVehicle ? mansion.active : null;
  const blockedReason = !hud.vehicle.inVehicle ? mansion.blockedReason : null;

  const anyWindowOpen = active
    ? active.windowOpenFL > 0.5 ||
      active.windowOpenFR > 0.5 ||
      active.windowOpenRL > 0.5 ||
      active.windowOpenRR > 0.5
    : false;

  return (
    <>
      {/* Blocked Entry Notice when trying to enter a locked/closed Mansion car */}
      {blockedReason && (
        <div
          role="status"
          data-testid="mansion-entry-blocked"
          className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-[#160b0e]/95 border border-amber-400/70 rounded-md px-3.5 py-2 flex items-center gap-2 shadow-xl"
        >
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-mono text-[11px] font-bold text-amber-100 whitespace-nowrap">
            {blockedReason}
          </span>
        </div>
      )}

      {/* Contextual Smart Car Remote Key (visible ONLY near an unoccupied Mansion car) */}
      {remote && (
        <aside
          aria-label="Smart Car Remote Key"
          data-testid="mansion-car-remote"
          className="absolute top-14 right-2 z-20 pointer-events-auto origin-top-right w-[238px] bg-[#090d16]/95 border border-amber-400/55 rounded-xl p-2.5 shadow-2xl space-y-2"
          style={{ transform: `scale(${hudScale})`, opacity: hudOpacity }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold text-white truncate">
                  {remote.vehicleName}
                </div>
                <div className="text-[9px] font-mono text-zinc-400 tabular-nums">
                  Smart Key Fob · {remote.distanceMeters.toFixed(1)}m
                </div>
              </div>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded font-mono text-[8.5px] font-extrabold uppercase border shrink-0 ${
                remote.locked
                  ? 'bg-red-500/20 border-red-400/60 text-red-200'
                  : 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
              }`}
            >
              {remote.locked ? 'LOCKED' : 'OPEN'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-testid="remote-unlock-open"
              aria-label="Unlock and Open Car Doors"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCarRemote('unlock_open');
              }}
              className="touch-none min-h-[36px] px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 border border-emerald-200 text-zinc-950 font-mono text-[10px] font-extrabold flex items-center justify-center gap-1 transition-transform"
            >
              <Unlock className="w-3.5 h-3.5 shrink-0" />
              <span>Unlock [K]</span>
            </button>
            <button
              type="button"
              data-testid="remote-lock-close"
              aria-label="Lock and Close Car Doors"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCarRemote('lock_close');
              }}
              className="touch-none min-h-[36px] px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-red-400/50 text-red-200 font-mono text-[10px] font-bold flex items-center justify-center gap-1 transition-transform"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Lock</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              data-testid="remote-flash"
              aria-label="Flash Car Headlights and Chirp"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCarRemote('flash');
              }}
              className="touch-none min-h-[30px] px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/45 text-amber-200 font-mono text-[9.5px] font-bold flex items-center gap-1"
            >
              <Lightbulb className="w-3 h-3" />
              <span>Flash / Beep</span>
            </button>
            <span className="text-[9px] font-mono text-zinc-400 truncate">
              {remote.locked ? 'Unlock to enter' : 'Press Door icon / [E]'}
            </span>
          </div>
        </aside>
      )}

      {/* In-Vehicle Mansion Cockpit Options (Collapsible to small dot for clear driving view) */}
      {active && minimized && (
        <button
          type="button"
          data-testid="mansion-panel-dot"
          aria-label="Expand Vehicle Options"
          title="Tap to reopen vehicle options"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setMinimized(false);
          }}
          style={{ transform: `scale(${hudScale})`, opacity: hudOpacity }}
          className="absolute top-14 right-2 z-20 pointer-events-auto touch-none w-9 h-9 rounded-full bg-[#090d16]/90 hover:bg-zinc-900 border-2 border-amber-400/80 shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        >
          <span
            className={`w-3.5 h-3.5 rounded-full shadow-inner ${
              active.engineRunning
                ? 'bg-emerald-400 shadow-emerald-300/80'
                : active.cranking
                  ? 'bg-amber-400 shadow-amber-300/80'
                  : 'bg-red-500 shadow-red-400/80'
            }`}
          />
        </button>
      )}

      {active && !minimized && (
        <aside
          aria-label="Mansion Vehicle Controls"
          data-testid="mansion-vehicle-panel"
          className="absolute top-14 right-2 z-20 pointer-events-auto origin-top-right bg-[#090d16]/94 border border-amber-400/45 rounded-xl p-2.5 shadow-2xl space-y-2 w-[214px]"
          style={{ transform: `scale(${hudScale})`, opacity: hudOpacity }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Read-only Engine Status Badge + Collapse-to-Dot Button (Engine controlled via 3D dash START / [I]) */}
          <div className="flex items-center justify-between gap-1.5">
            <div
              data-testid="mansion-engine-status"
              aria-label="Engine Status"
              className={`flex-1 min-h-[30px] px-2.5 py-1 rounded-md border font-mono text-[10px] font-extrabold tracking-wide flex items-center gap-1.5 ${
                active.engineRunning
                  ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-200'
                  : active.cranking
                    ? 'bg-amber-500/20 border-amber-300 text-amber-200'
                    : 'bg-red-500/15 border-red-400/60 text-red-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  active.engineRunning
                    ? 'bg-emerald-400'
                    : active.cranking
                      ? 'bg-amber-300'
                      : 'bg-red-400'
                }`}
              />
              <span className="truncate">
                {active.cranking
                  ? 'ENGINE CRANKING'
                  : active.engineRunning
                    ? 'ENGINE: ON'
                    : 'ENGINE: OFF'}
              </span>
            </div>
            <button
              type="button"
              data-testid="mansion-panel-minimize"
              aria-label="Minimize Vehicle Options to Dot"
              title="Minimize to dot"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setMinimized(true);
              }}
              className="touch-none w-8 h-[30px] rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/20 text-zinc-200 flex items-center justify-center active:scale-95"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {!active.engineRunning && !active.cranking && (
            <div className="text-[9px] font-mono text-amber-300 leading-tight text-center">
              Tap 3D Dash START button in car or press [I]
            </div>
          )}

          {/* Car Doors, Lights & Motorized Windows */}
          <div className="space-y-1.5 pt-1 border-t border-white/10">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="mansion-doors-toggle"
                aria-label={active.doorsOpen ? 'Close Vehicle Doors' : 'Open Vehicle Doors'}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleDoors();
                }}
                className={`touch-none min-h-[32px] px-2 rounded-md border font-mono text-[9.5px] font-bold flex items-center justify-center gap-1 ${
                  active.doorsOpen
                    ? 'bg-amber-400 text-zinc-950 border-amber-200'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/20'
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Doors [O]</span>
              </button>
              <button
                type="button"
                data-testid="mansion-lights-toggle"
                aria-label={active.headlightsOn ? 'Turn Headlights Off' : 'Turn Headlights On'}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleHeadlights();
                }}
                className={`touch-none min-h-[32px] px-2 rounded-md border font-mono text-[9.5px] font-bold flex items-center justify-center gap-1 ${
                  active.headlightsOn
                    ? 'bg-sky-400 text-zinc-950 border-sky-200'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/20'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                <span>Lights [L]</span>
              </button>
            </div>

            {/* Motorized Car Windows: All + Individual FL/FR/RL/RR */}
            <div className="space-y-1">
              <button
                type="button"
                data-testid="mansion-windows-all"
                aria-label={anyWindowOpen ? 'Raise All Windows' : 'Lower All Windows'}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleWindow('ALL');
                }}
                className={`touch-none w-full min-h-[30px] px-2 rounded-md border font-mono text-[9.5px] font-bold flex items-center justify-center gap-1 ${
                  anyWindowOpen
                    ? 'bg-cyan-500/25 border-cyan-300 text-cyan-200'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-zinc-200'
                }`}
              >
                <CarFront className="w-3.5 h-3.5 shrink-0" />
                <span>{anyWindowOpen ? 'Raise All Windows [U]' : 'Lower All Windows [U]'}</span>
              </button>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { key: 'FL', open: active.windowOpenFL > 0.5 },
                    { key: 'FR', open: active.windowOpenFR > 0.5 },
                    { key: 'RL', open: active.windowOpenRL > 0.5 },
                    { key: 'RR', open: active.windowOpenRR > 0.5 },
                  ] as const
                ).map((win) => (
                  <button
                    key={win.key}
                    type="button"
                    data-testid={`mansion-win-${win.key.toLowerCase()}`}
                    aria-label={`Toggle ${win.key} Window`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onToggleWindow(win.key);
                    }}
                    className={`touch-none min-h-[26px] rounded border font-mono text-[9px] font-bold ${
                      win.open
                        ? 'bg-cyan-400 text-zinc-950 border-cyan-200'
                        : 'bg-zinc-900 text-zinc-300 border-white/15 hover:border-white/35'
                    }`}
                  >
                    {win.key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
};
