import React, { useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import {
  CustomizableControlId,
  DEFAULT_HUD_CONTROL_LAYOUT,
  HudControlLayout,
  HudControlPlacement,
} from '../types';

interface HudLayoutEditorProps {
  layout: HudControlLayout;
  onSave: (nextLayout: HudControlLayout) => void;
  onClose: () => void;
}

interface ControlMeta {
  id: CustomizableControlId;
  label: string;
  baseSizePx: number;
  accent: 'amber' | 'sky' | 'zinc';
}

const CONTROLS: ControlMeta[] = [
  { id: 'move', label: 'Walk Stick', baseSizePx: 88, accent: 'sky' },
  { id: 'fire', label: 'Fire Bullet', baseSizePx: 52, accent: 'amber' },
  { id: 'jump', label: 'Jump', baseSizePx: 40, accent: 'zinc' },
  { id: 'ads', label: 'ADS Scope', baseSizePx: 38, accent: 'sky' },
  { id: 'grenade', label: 'Frag Bomb', baseSizePx: 36, accent: 'amber' },
  { id: 'reload', label: 'Reload', baseSizePx: 36, accent: 'zinc' },
  { id: 'slide', label: 'Slide', baseSizePx: 36, accent: 'amber' },
  { id: 'camera', label: 'Drive Cam', baseSizePx: 42, accent: 'sky' },
];

const CLAW_PRESET: HudControlLayout = {
  move: { xPct: 14, yPct: 68, scale: 1.05 },
  fire: { xPct: 86, yPct: 28, scale: 1.15 },
  ads: { xPct: 74, yPct: 30, scale: 1.0 },
  jump: { xPct: 88, yPct: 74, scale: 1.05 },
  slide: { xPct: 79, yPct: 76, scale: 1.0 },
  crouch: { xPct: 71, yPct: 78, scale: 0.95 },
  grenade: { xPct: 24, yPct: 32, scale: 0.95 },
  reload: { xPct: 88, yPct: 54, scale: 1.0 },
  camera: { xPct: 72, yPct: 68, scale: 1.0 },
};

const LEFT_HAND_PRESET: HudControlLayout = {
  move: { xPct: 86, yPct: 70, scale: 1.0 },
  fire: { xPct: 12, yPct: 72, scale: 1.1 },
  jump: { xPct: 21, yPct: 75, scale: 1.0 },
  ads: { xPct: 28, yPct: 68, scale: 0.95 },
  grenade: { xPct: 28, yPct: 54, scale: 0.95 },
  reload: { xPct: 21, yPct: 56, scale: 0.95 },
  slide: { xPct: 14, yPct: 54, scale: 0.95 },
  crouch: { xPct: 8, yPct: 58, scale: 0.95 },
  camera: { xPct: 26, yPct: 72, scale: 1.0 },
};

function cloneLayout(src: HudControlLayout): HudControlLayout {
  return {
    move: { ...src.move },
    fire: { ...src.fire },
    jump: { ...src.jump },
    ads: { ...src.ads },
    grenade: { ...src.grenade },
    reload: { ...src.reload },
    slide: { ...src.slide },
    crouch: { ...src.crouch },
    camera: { ...(src.camera ?? DEFAULT_HUD_CONTROL_LAYOUT.camera) },
  };
}

function renderControlGlyph(id: CustomizableControlId) {
  if (id === 'move') {
    return (
      <div className="w-10 h-10 rounded-full bg-amber-400/25 border border-amber-300/70 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-300" fill="currentColor">
          <circle cx="12" cy="4.5" r="2" />
          <path d="M13.5 8h-3l-2 4.5 1.8.8 1-2.1v3.6l-2.8 5.2h2.2l2-3.8 1.9 3.8h2.2l-2.6-5.2v-3.5l1.6 1.9 1.6-1.3-2.9-3.9z" />
        </svg>
      </div>
    );
  }
  if (id === 'fire') {
    return (
      <svg viewBox="0 0 28 28" className="w-5 h-5" fill="none">
        <path
          d="M14 3.5c1.8 2.2 2.6 4.4 2.6 7.5v9.5h-5.2V11c0-3.1.8-5.3 2.6-7.5z"
          fill="currentColor"
        />
        <rect x="11.4" y="21.8" width="5.2" height="2.2" rx="0.6" fill="currentColor" />
      </svg>
    );
  }
  if (id === 'jump') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
        <path d="M7 8l5-4 5 4" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="10.5" r="2" fill="currentColor" />
        <path
          d="M8.5 14.5l3.5-1.8 3.5 1.8M10.2 13.5l-1.5 4.8M13.8 13.5l1.8 4.2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === 'ads') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'grenade') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 5h6M10 3h4v2h-4zM15 5l2 2" strokeLinecap="round" />
        <ellipse cx="12" cy="14" rx="5.5" ry="6.5" fill="currentColor" fillOpacity="0.25" />
        <path d="M7 12h10M7 16h10M12 8v12" strokeWidth="1.4" />
      </svg>
    );
  }
  if (id === 'reload') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
        <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === 'slide') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
        <path d="M3 15h5M2 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="13.5" cy="7.5" r="2" fill="currentColor" />
        <path d="M11 11.5l3.2 1.8 4.8-.6M10.5 14l-3 3.5h5.2l2.6-2.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'camera') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
        <circle cx="12" cy="12" r="2.8" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <circle cx="13" cy="6" r="2.2" />
      <path d="M11 9.5c-1.2 0-2.2.8-2.6 1.9l-1.4 3.6h3l1.1-2.4 2.1 1.7v4.7h2.4v-5.8l-2.3-2.1.7-1.6H11z" />
    </svg>
  );
}

export const HudLayoutEditor: React.FC<HudLayoutEditorProps> = ({ layout, onSave, onClose }) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<HudControlLayout>(() => cloneLayout(layout));
  const [selectedId, setSelectedId] = useState<CustomizableControlId>('fire');
  const dragRef = useRef<{
    id: CustomizableControlId;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPlacement: HudControlPlacement;
  } | null>(null);

  const selectedMeta = CONTROLS.find((c) => c.id === selectedId) || CONTROLS[0];
  const selectedPlacement = draft[selectedId];

  const handleControlPointerDown = (
    id: CustomizableControlId,
    e: React.PointerEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    setSelectedId(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if pointer capture is unavailable
    }
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPlacement: { ...draft[id] },
    };
  };

  const handleControlPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || drag.pointerId !== e.pointerId) return;

    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dxPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startClientY) / rect.height) * 100;

    const nextX = Math.round(Math.min(94, Math.max(6, drag.startPlacement.xPct + dxPct)) * 10) / 10;
    const nextY = Math.round(Math.min(93, Math.max(18, drag.startPlacement.yPct + dyPct)) * 10) / 10;

    setDraft((prev) => ({
      ...prev,
      [drag.id]: {
        ...prev[drag.id],
        xPct: nextX,
        yPct: nextY,
      },
    }));
  };

  const handleControlPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#05070b]/92 backdrop-blur-sm flex flex-col">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#0b1017] border-b border-amber-500/25">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-display text-lg sm:text-xl font-bold text-white leading-tight">
              Touch HUD Layout Editor
            </div>
            <div className="text-[11px] text-zinc-400">
              Drag any icon to reposition · Tap to resize
            </div>
          </div>
        </div>

        {/* Selected Control Size Slider */}
        <div className="flex items-center gap-2.5 bg-zinc-900/90 border border-white/15 rounded-md px-3 py-1.5">
          <span className="text-xs font-semibold text-amber-400 whitespace-nowrap">
            {selectedMeta.label}
          </span>
          <span className="text-[11px] text-zinc-400 font-mono">Size</span>
          <input
            type="range"
            min="0.65"
            max="1.75"
            step="0.05"
            value={selectedPlacement.scale}
            onChange={(e) => {
              const scale = Number(e.target.value);
              setDraft((prev) => ({
                ...prev,
                [selectedId]: { ...prev[selectedId], scale },
              }));
            }}
            className="w-24 sm:w-32 accent-amber-400 h-1.5"
          />
          <span className="font-mono text-xs font-bold text-white w-10 text-right tabular-nums">
            {Math.round(selectedPlacement.scale * 100)}%
          </span>
        </div>

        {/* Presets & Save */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setDraft(cloneLayout(DEFAULT_HUD_CONTROL_LAYOUT))}
            className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs text-zinc-200 whitespace-nowrap"
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => setDraft(cloneLayout(CLAW_PRESET))}
            className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs text-zinc-200 whitespace-nowrap"
          >
            4-Finger Claw
          </button>
          <button
            type="button"
            onClick={() => setDraft(cloneLayout(LEFT_HAND_PRESET))}
            className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs text-zinc-200 whitespace-nowrap"
          >
            Left-Handed
          </button>
          <button
            type="button"
            onClick={() => setDraft(cloneLayout(DEFAULT_HUD_CONTROL_LAYOUT))}
            title="Reset Layout"
            className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs text-zinc-300 flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            onClick={() => onSave(cloneLayout(draft))}
            className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display text-sm font-extrabold flex items-center gap-1 whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            <span>Save HUD</span>
          </button>
        </div>
      </div>

      {/* Interactive 16:9 Combat Stage Preview */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <div
          ref={stageRef}
          className="relative w-full h-full max-w-[1100px] max-h-[620px] rounded-lg border border-amber-500/30 bg-[#080d14]/70 overflow-hidden shadow-2xl touch-none"
        >
          {/* Subtle Alignment Grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)',
              backgroundSize: '10% 10%',
            }}
          />

          {/* Reference Mock Combat HUD Safe Zones */}
          <div className="absolute top-2 left-2 w-24 h-16 rounded border border-white/15 bg-zinc-950/60 flex items-center justify-center text-[10px] font-mono text-zinc-400 pointer-events-none">
            RADAR
          </div>
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-36 h-4 rounded border border-white/15 bg-zinc-950/60 flex items-center justify-center text-[9px] font-mono text-zinc-400 pointer-events-none">
            COMPASS
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-3 h-3 rounded-full border border-amber-400/50" />
          </div>
          <div className="absolute bottom-2 left-2 w-32 h-11 rounded border border-white/15 bg-zinc-950/60 flex items-center justify-center text-[10px] font-mono text-zinc-400 pointer-events-none">
            ARMOR / HP
          </div>
          <div className="absolute bottom-2 right-2 w-40 h-11 rounded border border-white/15 bg-zinc-950/60 flex items-center justify-center text-[10px] font-mono text-zinc-400 pointer-events-none">
            WEAPONS / AMMO
          </div>

          {/* Draggable Touch Controls */}
          {CONTROLS.map((ctrl) => {
            const p = draft[ctrl.id];
            const selected = selectedId === ctrl.id;
            const ringStyle =
              ctrl.id === 'fire'
                ? 'bg-amber-500/90 text-zinc-950 border-amber-200'
                : ctrl.id === 'move'
                  ? 'bg-zinc-950/75 text-white border-white/35'
                  : ctrl.accent === 'sky'
                    ? 'bg-zinc-950/85 text-sky-300 border-sky-400/55'
                    : ctrl.accent === 'amber'
                      ? 'bg-zinc-950/85 text-amber-300 border-amber-400/55'
                      : 'bg-zinc-950/85 text-white border-white/30';

            return (
              <button
                key={ctrl.id}
                type="button"
                onPointerDown={(e) => handleControlPointerDown(ctrl.id, e)}
                onPointerMove={handleControlPointerMove}
                onPointerUp={handleControlPointerUp}
                onPointerCancel={handleControlPointerUp}
                className={`absolute rounded-full border-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none ${ringStyle} ${
                  selected ? 'ring-4 ring-amber-400/60 z-20' : 'z-10'
                }`}
                style={{
                  left: `${p.xPct}%`,
                  top: `${p.yPct}%`,
                  width: ctrl.baseSizePx,
                  height: ctrl.baseSizePx,
                  transform: `translate(-50%, -50%) scale(${p.scale})`,
                }}
              >
                {renderControlGlyph(ctrl.id)}
                <span className="absolute -bottom-5 px-1.5 py-0.5 rounded bg-zinc-950/90 border border-white/15 text-[9px] font-mono font-bold text-white whitespace-nowrap pointer-events-none">
                  {ctrl.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
