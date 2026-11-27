import React from 'react';
import {
  Award,
  Clock,
  Cloud,
  CloudOff,
  Coins,
  Compass,
  Flag,
  LogIn,
  LogOut,
  MapPin,
  Shield,
  ShoppingBag,
  UserCircle2,
} from 'lucide-react';
import type { SimulatorProgress } from '../../game/offlineStorage';
import { BIKE_STYLES } from '../../types';
import { TOTAL_WORLD_ZONES, type LobbyCopyDictionary } from '../../game/lobbyConfig';

interface LobbyProfileTabProps {
  simProgress: SimulatorProgress;
  signedInUserName?: string | null;
  authBusy?: boolean;
  copy: LobbyCopyDictionary;
  onSignInGoogle?: () => void;
  onSignOut?: () => void;
  onSelectResumeSaved: () => void;
}

function formatExploreDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return `${mins}m ${secs}s`;
}

export const LobbyProfileTab: React.FC<LobbyProfileTabProps> = ({
  simProgress,
  signedInUserName,
  authBusy = false,
  copy,
  onSignInGoogle,
  onSignOut,
  onSelectResumeSaved,
}) => {
  const purchasedCount = (Object.values(simProgress.purchasedItems) as number[]).reduce(
    (sum: number, n: number) => sum + (Number.isFinite(n) ? n : 0),
    0,
  );
  const zonesExplored = Math.min(TOTAL_WORLD_ZONES, simProgress.visitedDistricts.length);
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  return (
    <div className="space-y-4 animate-liquid-tab">
      {/* Top Player Identity Banner */}
      <div className="liquid-glass-card liquid-prism-edge rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-2xl liquid-glass-icon-3d-active flex items-center justify-center shrink-0">
            <UserCircle2 className="w-9 h-9 text-cyan-200" />
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/35 text-[10px] font-bold text-cyan-200 mb-1">
              <Shield className="w-3 h-3" />
              <span>{signedInUserName ? 'CLOUD LINKED PROFILE' : 'LOCAL OFFLINE EXPLORER'}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
              {signedInUserName || 'Apex World Explorer'}
            </h2>
            <p className="text-xs text-slate-300">
              {copy.profileTitle} · Updated{' '}
              {simProgress.updatedAt > 0
                ? new Date(simProgress.updatedAt).toLocaleDateString()
                : 'Ready to explore'}
            </p>
          </div>
        </div>

        {/* Account Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {signedInUserName ? (
            <button
              type="button"
              disabled={authBusy}
              onClick={onSignOut}
              className="liquid-glass-card px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-200 border-rose-400/40 hover:border-rose-300 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          ) : (
            onSignInGoogle && (
              <button
                type="button"
                disabled={authBusy || !isOnline}
                onClick={onSignInGoogle}
                className="liquid-glass-card px-4 py-2.5 rounded-xl text-xs font-semibold text-cyan-100 border-cyan-400/45 hover:border-cyan-300 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4 text-cyan-300" />
                <span>{authBusy ? 'Connecting...' : 'Sign In with Google (Optional)'}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>{copy.credits}</span>
            <Coins className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-2xl font-bold text-amber-300 tabular-nums">
            {simProgress.credits.toLocaleString()}₡
          </div>
          <div className="text-[11px] text-slate-400">
            Total spent: {simProgress.totalSpentCredits.toLocaleString()}₡
          </div>
        </div>

        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>{copy.zonesExplored}</span>
            <Compass className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {zonesExplored} / {TOTAL_WORLD_ZONES}
          </div>
          <div className="text-[11px] text-slate-400">Seamless dual-coast mega-world</div>
        </div>

        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Explore Time</span>
            <Clock className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {formatExploreDuration(simProgress.totalExploreSeconds)}
          </div>
          <div className="text-[11px] text-slate-400">Persistent session telemetry</div>
        </div>

        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Stunts Cleared</span>
            <Award className="w-4 h-4 text-orange-300" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {simProgress.stuntsCompleted}
          </div>
          <div className="text-[11px] text-slate-400">Neon rings & sky ramps</div>
        </div>

        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Grand Prix Laps</span>
            <Flag className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {simProgress.racesCompleted}
          </div>
          <div className="text-[11px] text-slate-400">
            Best Lap: {simProgress.bestLapSec ? `${simProgress.bestLapSec}s` : '—'}
          </div>
        </div>

        <div className="liquid-glass-card rounded-2xl p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Shop Purchases</span>
            <ShoppingBag className="w-4 h-4 text-purple-300" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">{purchasedCount}</div>
          <div className="text-[11px] text-slate-400">Food, gear & vehicle kits</div>
        </div>
      </div>

      {/* Saved Progress & Explored Districts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="liquid-glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-300" />
              <span>{copy.savedWorldPos}</span>
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
              {isOnline && signedInUserName ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-cyan-300" /> Cloud + Offline Save
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-emerald-300" /> 100% Offline Saved
                </>
              )}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/55 border border-white/10 space-y-1.5">
            <div className="text-sm font-bold text-white">
              {simProgress.hasSavedPosition
                ? simProgress.lastDistrict
                : 'Apex Luxury Mansion (Default)'}
            </div>
            <div className="text-xs text-slate-300 tabular-nums">
              X: {Math.round(simProgress.lastX)} · Z: {Math.round(simProgress.lastZ)} · Bike:{' '}
              {BIKE_STYLES.find((b) => b.id === simProgress.bikeStyle)?.name ?? simProgress.bikeStyle}
            </div>
          </div>

          {simProgress.hasSavedPosition && (
            <button
              type="button"
              onClick={onSelectResumeSaved}
              className="liquid-cta-orange w-full py-2.5 rounded-xl font-display text-sm font-bold text-slate-950 cursor-pointer"
            >
              {copy.continueExploration}
            </button>
          )}
        </div>

        <div className="liquid-glass-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white">
            Discovered Districts ({simProgress.visitedDistricts.length})
          </h3>
          {simProgress.visitedDistricts.length === 0 ? (
            <div className="p-3 rounded-xl bg-slate-950/45 border border-white/10 text-xs text-slate-400">
              Enter the Mega-World and travel across cities, bridges & landmarks to record your discovered zones here.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto liquid-scroll pr-1">
              {simProgress.visitedDistricts.map((dist) => (
                <span
                  key={dist}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-[11px] font-medium text-cyan-100"
                >
                  {dist}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
