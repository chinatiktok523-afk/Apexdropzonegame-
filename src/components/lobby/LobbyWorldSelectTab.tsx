import React, { useMemo, useState } from 'react';
import { Check, Compass, Crosshair, MapPin, Navigation, Play, Search } from 'lucide-react';
import { SIMULATOR_POIS, type DronePoi } from '../../types';
import type { SimulatorProgress } from '../../game/offlineStorage';
import type { LobbyCopyDictionary } from '../../game/lobbyConfig';

interface LobbyWorldSelectTabProps {
  simStartPoiId: string;
  simProgress: SimulatorProgress;
  copy: LobbyCopyDictionary;
  onSelectSimStartPoi: (poiId: string) => void;
  onPreviewWorldLocation: (x: number, z: number) => void;
  onDeploySimulator: () => void;
}

type KindFilter = 'all' | DronePoi['kind'];

export const LobbyWorldSelectTab: React.FC<LobbyWorldSelectTabProps> = ({
  simStartPoiId,
  simProgress,
  copy,
  onSelectSimStartPoi,
  onPreviewWorldLocation,
  onDeploySimulator,
}) => {
  const [filterKind, setFilterKind] = useState<KindFilter>('all');
  const [query, setQuery] = useState('');
  const [focusedPoiId, setFocusedPoiId] = useState<string>(simStartPoiId);

  const filteredPois = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SIMULATOR_POIS.filter((poi) => {
      if (filterKind !== 'all' && poi.kind !== filterKind) return false;
      if (!q) return true;
      return (
        poi.name.toLowerCase().includes(q) ||
        poi.subtitle.toLowerCase().includes(q) ||
        (poi.shortName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [filterKind, query]);

  const focusedPoi = useMemo(() => {
    if (focusedPoiId === 'saved_pos' && simProgress.hasSavedPosition) {
      return {
        id: 'saved_pos',
        name: simProgress.lastDistrict || copy.savedWorldPos,
        subtitle: `Saved explorer coordinates (${Math.round(simProgress.lastX)}, ${Math.round(simProgress.lastZ)})`,
        x: simProgress.lastX,
        z: simProgress.lastZ,
        kind: 'base' as const,
      };
    }
    return SIMULATOR_POIS.find((p) => p.id === focusedPoiId) ?? SIMULATOR_POIS[0];
  }, [focusedPoiId, simProgress, copy.savedWorldPos]);

  const handleCardInspect = (id: string, x: number, z: number) => {
    setFocusedPoiId(id);
    onPreviewWorldLocation(x, z);
  };

  const handleConfirmStartPosition = () => {
    onSelectSimStartPoi(focusedPoi.id);
    onPreviewWorldLocation(focusedPoi.x, focusedPoi.z);
  };

  const isFocusedSelected = simStartPoiId === focusedPoi.id;

  return (
    <div className="space-y-4 animate-liquid-tab">
      {/* Header & Search Filter */}
      <div className="liquid-glass-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-300" />
              <span>{copy.tabs.world} · {SIMULATOR_POIS.length} Starting Districts</span>
            </h2>
            <p className="text-xs text-slate-300">
              Select any landmark to fly the 3D camera live over its skyline, then confirm your spawn point.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search districts..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/60 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400/70"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All (${SIMULATOR_POIS.length})` },
              { id: 'base', label: 'HQs & Estates' },
              { id: 'town', label: 'Cities & Malls' },
              { id: 'landmark', label: 'Landmarks & Tracks' },
              { id: 'depot', label: 'Stations & Utilities' },
            ] as const
          ).map((f) => {
            const active = filterKind === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterKind(f.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-cyan-500/25 border-cyan-400/70 text-cyan-100'
                    : 'bg-slate-950/45 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Focused District Action Bar */}
      <div className="liquid-glass-card liquid-prism-edge rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-cyan-300 font-semibold">
            <Crosshair className="w-3.5 h-3.5" />
            <span>LIVE 3D FLYOVER TARGET</span>
            <span className="text-slate-400 tabular-nums">
              X: {Math.round(focusedPoi.x)} · Z: {Math.round(focusedPoi.z)}
            </span>
          </div>
          <div className="text-base sm:text-lg font-bold text-white truncate">{focusedPoi.name}</div>
          <div className="text-xs text-slate-300 truncate">{focusedPoi.subtitle}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            data-testid="select-starting-position-btn"
            onClick={handleConfirmStartPosition}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer flex items-center gap-2 ${
              isFocusedSelected
                ? 'bg-emerald-500/25 border-emerald-400/70 text-emerald-100'
                : 'liquid-glass-card border-cyan-400/50 text-cyan-100 hover:border-cyan-300'
            }`}
          >
            {isFocusedSelected ? (
              <Check className="w-4 h-4 text-emerald-300" />
            ) : (
              <Navigation className="w-4 h-4 text-cyan-300" />
            )}
            <span>
              {isFocusedSelected ? copy.selectedStartingPos : copy.selectStartingPos}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectSimStartPoi(focusedPoi.id);
              onDeploySimulator();
            }}
            className="liquid-cta-orange px-4 py-2.5 rounded-xl font-display text-sm sm:text-base font-bold text-slate-950 cursor-pointer flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{copy.enterWorld}</span>
          </button>
        </div>
      </div>

      {/* Location Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {simProgress.hasSavedPosition && (
          <button
            type="button"
            data-testid="poi-card-saved_pos"
            onClick={() =>
              handleCardInspect('saved_pos', simProgress.lastX, simProgress.lastZ)
            }
            className={`text-left rounded-2xl p-3.5 transition-all cursor-pointer space-y-2 ${
              focusedPoiId === 'saved_pos' || simStartPoiId === 'saved_pos'
                ? 'liquid-glass-card liquid-glass-card-active'
                : 'liquid-glass-card border-emerald-400/35'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-xl liquid-glass-icon-3d-active flex items-center justify-center text-emerald-300 shrink-0">
                  <MapPin className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-200 truncate">
                    {copy.resumeSavedSpot}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {simProgress.lastDistrict}
                  </div>
                </div>
              </div>
              {simStartPoiId === 'saved_pos' && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/50 text-[10px] font-bold text-emerald-200 shrink-0">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              Coords X: {Math.round(simProgress.lastX)} · Z: {Math.round(simProgress.lastZ)}
            </div>
          </button>
        )}

        {filteredPois.map((poi) => {
          const isFocused = focusedPoiId === poi.id;
          const isSelected = simStartPoiId === poi.id;
          const isVisited = simProgress.visitedDistricts.some((d) =>
            d.toLowerCase().includes((poi.shortName ?? poi.name).toLowerCase().slice(0, 6)),
          );
          return (
            <button
              key={poi.id}
              type="button"
              data-testid={`poi-card-${poi.id}`}
              onClick={() => handleCardInspect(poi.id, poi.x, poi.z)}
              className={`text-left rounded-2xl p-3.5 transition-all cursor-pointer space-y-2 ${
                isFocused || isSelected
                  ? 'liquid-glass-card liquid-glass-card-active'
                  : 'liquid-glass-card'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isFocused || isSelected
                        ? 'liquid-glass-icon-3d-active text-cyan-200'
                        : 'liquid-glass-icon-3d text-slate-200'
                    }`}
                  >
                    <Navigation className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{poi.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-cyan-300/80 font-semibold">
                      {poi.kind} · X {Math.round(poi.x)}, Z {Math.round(poi.z)}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <span className="px-2 py-0.5 rounded-md bg-orange-500/25 border border-orange-400/60 text-[10px] font-bold text-orange-200 shrink-0">
                    SPAWN
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug">
                {poi.subtitle}
              </p>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span className="tabular-nums">
                  {poi.shortName ?? poi.name}
                </span>
                {isVisited && (
                  <span className="text-emerald-300 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Explored
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
