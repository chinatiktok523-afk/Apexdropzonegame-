import React, { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  CloudFog,
  CloudRain,
  Compass,
  Cpu,
  Crosshair,
  DoorClosed,
  DoorOpen,
  Eye,
  Layers,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Pause,
  RotateCcw,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  BIKE_STYLES,
  BikeStyleId,
  DEFAULT_HUD_CONTROL_LAYOUT,
  DEFAULT_HUD_SETTINGS,
  FireMode,
  GraphicsQuality,
  HudSettings,
  HudState,
  RETICLE_COLORS,
  ReticleColorId,
  SIMULATOR_POIS,
  SIM_SHOP_ITEMS,
  TimeOfDayPhase,
  VehicleInputState,
  WEAPON_ORDER,
  WEAPON_ZOOM_OPTIONS,
  WEAPONS,
  WeaponCategory,
  WeaponId,
  WeatherKind,
} from '../types';
import { HeadshotBanner } from './HeadshotBanner';
import { TacticalRadar } from './TacticalRadar';
import { WeaponArt } from './WeaponArt';
import { MansionControlsOverlay } from './MansionControlsOverlay';
import type { MansionCarDoorAction } from '../game/mansionSystems';

interface GameHUDProps {
  hud: HudState;
  hudSettings: HudSettings;
  reticleColor?: ReticleColorId;
  muted: boolean;
  wideLandscape: boolean;
  isFullscreen: boolean;
  onUpdateHudSettings: (next: HudSettings) => void;
  onCycleZoom: () => void;
  onToggleMute: () => void;
  onToggleWideLandscape: () => void;
  onToggleFullscreen: () => void;
  onTogglePerspective: () => void;
  onSwitchWeapon: (id: WeaponId) => void;
  onCycleFireMode: () => void;
  onReload: () => void;
  onPause: () => void;
  onTouchMove: (x: number, y: number) => void;
  onTouchLookDelta: (dx: number, dy: number) => void;
  onTouchFire: (firing: boolean) => void;
  onToggleAds: () => void;
  onToggleRunMode: () => void;
  onJump: () => void;
  onToggleCrouch: () => void;
  onSlide: () => void;
  onThrowGrenade: () => void;
  onBreach: () => void;
  onCyclePeek: () => void;
  onToggleVehicle: () => void;
  onCycleVehicleCamera?: () => void;
  onVehicleInput: (input: Partial<VehicleInputState>) => void;
  onSetSimulatorEnv?: (opts: {
    timePhase?: TimeOfDayPhase;
    weather?: WeatherKind;
    autoCycle?: boolean;
    bikeStyle?: BikeStyleId;
  }) => void;
  onInteract?: () => void;
  onTeleportPoi?: (x: number, z: number, label: string, viewYaw?: number) => void;
  onBuySimItem?: (itemId: string) => void;
  onUseSimItem?: (itemId: string) => void;
  onMansionCarRemote?: (action: MansionCarDoorAction) => void;
  onMansionToggleEngine?: () => void;
  onMansionToggleDoors?: () => void;
  onMansionToggleWindow?: (pane: 'FL' | 'FR' | 'RL' | 'RR' | 'ALL') => void;
  onMansionToggleHeadlights?: () => void;
  onVehicleBeepSos?: () => void;
  onTapWorldCanvas?: (clientX: number, clientY: number) => void;
  onOpenHudEditor?: () => void;
  showSmartCityDashboard?: boolean;
  onOpenSmartCityDashboard?: () => void;
  showScienceDistrictModal?: boolean;
  onOpenScienceDistrictModal?: () => void;
}

const COMPASS_MARKS = [
  { deg: 0, label: 'N' },
  { deg: 45, label: 'NE' },
  { deg: 90, label: 'E' },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S' },
  { deg: 225, label: 'SW' },
  { deg: 270, label: 'W' },
  { deg: 315, label: 'NW' },
];

function shortestAngleDiff(targetDeg: number, currentDeg: number): number {
  return ((targetDeg - currentDeg + 540) % 360) - 180;
}

function fireModeLabel(mode: FireMode, weaponId: WeaponId): string {
  if (mode === 'burst') return weaponId === 'shotgun' ? '2x BURST' : '3x BURST';
  if (mode === 'auto') return 'AUTO';
  return 'SEMI';
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  hudSettings,
  reticleColor = 'amber',
  muted,
  wideLandscape,
  isFullscreen,
  onUpdateHudSettings,
  onCycleZoom,
  onToggleMute,
  onToggleWideLandscape,
  onToggleFullscreen,
  onTogglePerspective,
  onSwitchWeapon,
  onCycleFireMode,
  onReload,
  onPause,
  onTouchMove,
  onTouchLookDelta,
  onTouchFire,
  onToggleAds,
  onToggleRunMode,
  onJump,
  onToggleCrouch,
  onSlide,
  onThrowGrenade,
  onBreach,
  onCyclePeek,
  onToggleVehicle,
  onCycleVehicleCamera,
  onVehicleInput,
  onSetSimulatorEnv,
  onInteract,
  onTeleportPoi,
  onBuySimItem,
  onUseSimItem,
  onMansionCarRemote,
  onMansionToggleEngine: _onMansionToggleEngine,
  onMansionToggleDoors,
  onMansionToggleWindow,
  onMansionToggleHeadlights,
  onVehicleBeepSos,
  onTapWorldCanvas,
  onOpenHudEditor,
  showSmartCityDashboard,
  onOpenSmartCityDashboard,
  showScienceDistrictModal,
  onOpenScienceDistrictModal,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showSimEnvDrawer, setShowSimEnvDrawer] = useState(false);
  const [showSimShopDrawer, setShowSimShopDrawer] = useState(false);
  const [showWeaponPicker, setShowWeaponPicker] = useState(false);
  const [weaponCatFilter, setWeaponCatFilter] = useState<'ALL' | WeaponCategory>('ALL');
  const lastArmedWeaponRef = useRef<WeaponId>('m4a1');
  if (hud.activeWeapon !== 'unarmed') {
    lastArmedWeaponRef.current = hud.activeWeapon;
  }
  const [steerVisual, setSteerVisual] = useState(0);
  const steerPointerRef = useRef<{ id: number; centerX: number } | null>(null);

  const movePointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    lastY: number;
    pushedForward: boolean;
    slideTriggered: boolean;
  } | null>(null);
  const aimPointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const [floatingStick, setFloatingStick] = useState<{
    active: boolean;
    baseX: number;
    baseY: number;
    knobX: number;
    knobY: number;
  }>({
    active: false,
    baseX: 0,
    baseY: 0,
    knobX: 0,
    knobY: 0,
  });

  const screenLayerRef = useRef<HTMLDivElement>(null);
  const onTouchMoveRef = useRef(onTouchMove);
  onTouchMoveRef.current = onTouchMove;

  useEffect(() => {
    const resetTouchOnWindowEnd = (ev: PointerEvent) => {
      if (movePointerRef.current && movePointerRef.current.id === ev.pointerId) {
        movePointerRef.current = null;
        setFloatingStick((prev) =>
          prev.active || prev.knobX !== 0 || prev.knobY !== 0
            ? { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0 }
            : prev,
        );
        onTouchMoveRef.current(0, 0);
      }
      if (aimPointerRef.current && aimPointerRef.current.id === ev.pointerId) {
        aimPointerRef.current = null;
      }
    };
    const handleBlur = () => {
      if (movePointerRef.current) {
        movePointerRef.current = null;
        setFloatingStick({ active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0 });
        onTouchMoveRef.current(0, 0);
      }
      aimPointerRef.current = null;
    };
    window.addEventListener('pointerup', resetTouchOnWindowEnd);
    window.addEventListener('pointercancel', resetTouchOnWindowEnd);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('pointerup', resetTouchOnWindowEnd);
      window.removeEventListener('pointercancel', resetTouchOnWindowEnd);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    movePointerRef.current = null;
    steerPointerRef.current = null;
    setSteerVisual((prev) => (prev === 0 ? prev : 0));
    setFloatingStick((prev) =>
      prev.active || prev.knobX !== 0 || prev.knobY !== 0
        ? { active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0 }
        : prev,
    );
    onTouchMoveRef.current(0, 0);
    if (hud.vehicle.inVehicle) {
      setShowWeaponPicker((prev) => (prev ? false : prev));
    }
  }, [hud.vehicle.inVehicle]);

  const spec = WEAPONS[hud.activeWeapon];
  const isUnarmed = hud.activeWeapon === 'unarmed';
  const mag = hud.ammoInMag[hud.activeWeapon];
  const reserve = hud.reserveAmmo[hud.activeWeapon];
  const isScoped = !isUnarmed && hud.isAds && !hud.isReloading;
  const canCycleZoom = !isUnarmed && (WEAPON_ZOOM_OPTIONS[hud.activeWeapon]?.length ?? 0) > 1;
  const canSwitchFireMode = !isUnarmed && hud.supportedFireModes.length > 1;
  const outOfAmmo = !isUnarmed && mag <= 0 && reserve <= 0;
  const rangeText = hud.aimDistance > 0 ? `${hud.aimDistance}m` : '---';

  const hudScale = hudSettings.hudScale;
  const hudOpacity = hudSettings.hudOpacity;
  const controlLayout = hudSettings.controlLayout || DEFAULT_HUD_CONTROL_LAYOUT;
  const reticleHex = RETICLE_COLORS.find((r) => r.id === reticleColor)?.hex || '#fbbf24';

  const crosshairGap = Math.round(
    Math.min(36, Math.max(4, hud.spreadAmount * 440)),
  );
  const crosshairBarLen = Math.round(
    Math.min(15, Math.max(9, 8.5 + crosshairGap * 0.16)),
  );

  const startMovePointer = (
    pointerId: number,
    originClientX: number,
    originClientY: number,
    baseLocalX: number,
    baseLocalY: number,
    initialKnobX = 0,
    initialKnobY = 0,
  ) => {
    try {
      screenLayerRef.current?.setPointerCapture(pointerId);
    } catch {
      // ignore if pointer capture is unavailable
    }
    const maxR = 48;
    movePointerRef.current = {
      id: pointerId,
      startX: originClientX,
      startY: originClientY,
      lastY: originClientY + initialKnobY,
      pushedForward: false,
      slideTriggered: false,
    };
    setFloatingStick({
      active: true,
      baseX: baseLocalX,
      baseY: baseLocalY,
      knobX: initialKnobX,
      knobY: initialKnobY,
    });
    onTouchMove(initialKnobX / maxR, -initialKnobY / maxR);
  };

  const handleScreenPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (showSettings || showWeaponPicker || showSimEnvDrawer || showSimShopDrawer) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    const moveOnRight = controlLayout.move.xPct > 55;
    const isMoveHorizontal = moveOnRight
      ? localX > rect.width * 0.58
      : localX < rect.width * 0.42;
    const isMoveZone = isMoveHorizontal && localY > rect.height * 0.35;

    const isSeatLockedSofa = Boolean(hud.seatedChair && !hud.seatedChair.canRotate);
    if (isMoveZone && !movePointerRef.current && !hud.vehicle.inVehicle && !hud.isBikeEjected && !isSeatLockedSofa) {
      startMovePointer(e.pointerId, e.clientX, e.clientY, localX, localY, 0, 0);
      return;
    }

    if (!aimPointerRef.current) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore if pointer capture is unavailable
      }
      aimPointerRef.current = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
      };
    }
  };

  const handleScreenPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (movePointerRef.current && movePointerRef.current.id === e.pointerId) {
      const dx = e.clientX - movePointerRef.current.startX;
      const dy = hud.seatedChair ? 0 : e.clientY - movePointerRef.current.startY;
      movePointerRef.current.lastY = e.clientY;

      const maxR = 48;
      const dist = Math.hypot(dx, dy);
      const scale = dist > maxR ? maxR / dist : 1;
      const kx = dx * scale;
      const ky = dy * scale;
      setFloatingStick((prev) => ({
        ...prev,
        knobX: kx,
        knobY: ky,
      }));
      onTouchMove(kx / maxR, hud.seatedChair ? 0 : -ky / maxR);
      return;
    }

    if (aimPointerRef.current && aimPointerRef.current.id === e.pointerId) {
      const dx = e.clientX - aimPointerRef.current.lastX;
      const dy = e.clientY - aimPointerRef.current.lastY;
      aimPointerRef.current.lastX = e.clientX;
      aimPointerRef.current.lastY = e.clientY;

      onTouchLookDelta(dx * 2.65, dy * 2.65);
    }
  };

  const handleScreenPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (movePointerRef.current && movePointerRef.current.id === e.pointerId) {
      movePointerRef.current = null;
      setFloatingStick((prev) => ({ ...prev, active: false, knobX: 0, knobY: 0 }));
      onTouchMove(0, 0);
      return;
    }

    if (aimPointerRef.current && aimPointerRef.current.id === e.pointerId) {
      const moved = Math.hypot(
        e.clientX - aimPointerRef.current.startX,
        e.clientY - aimPointerRef.current.startY,
      );
      aimPointerRef.current = null;
      if (moved < 9) {
        onTapWorldCanvas?.(e.clientX, e.clientY);
      }
    }
  };

  const showWalkOrChairStick = !hud.vehicle.inVehicle && !hud.isBikeEjected && (!hud.seatedChair || hud.seatedChair.canRotate);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Full-Screen Android Touch Drag-to-Aim & Thumbstick Movement Layer */}
      <div
        ref={screenLayerRef}
        className="absolute inset-0 z-0 pointer-events-auto touch-none"
        onPointerDown={handleScreenPointerDown}
        onPointerMove={handleScreenPointerMove}
        onPointerUp={handleScreenPointerUp}
        onPointerCancel={handleScreenPointerUp}
      />

      {/* Customizable Walk Stick Anchor (repurposed to Chair Rotate Stick when seated on gaming chair) */}
      {showWalkOrChairStick && (
        <div
          role="slider"
          aria-label={hud.seatedChair ? 'Rotate Chair Stick' : 'Walk Stick'}
          aria-valuenow={0}
          onPointerDown={(e) => {
            if (showSettings || movePointerRef.current) return;
            e.stopPropagation();
            e.preventDefault();
            const stickRect = e.currentTarget.getBoundingClientRect();
            const centerX = stickRect.left + stickRect.width / 2;
            const centerY = stickRect.top + stickRect.height / 2;
            const layerRect = screenLayerRef.current?.getBoundingClientRect();
            const baseLocalX = layerRect ? centerX - layerRect.left : centerX;
            const baseLocalY = layerRect ? centerY - layerRect.top : centerY;
            const dx = e.clientX - centerX;
            const dy = hud.seatedChair ? 0 : e.clientY - centerY;
            const maxR = 48;
            const dist = Math.hypot(dx, dy);
            const scale = dist > maxR ? maxR / dist : 1;
            const kx = dist > 6 ? dx * scale : 0;
            const ky = dist > 6 ? dy * scale : 0;
            startMovePointer(
              e.pointerId,
              centerX,
              centerY,
              baseLocalX,
              baseLocalY,
              kx,
              ky,
            );
          }}
          onPointerMove={handleScreenPointerMove}
          onPointerUp={handleScreenPointerUp}
          onPointerCancel={handleScreenPointerUp}
          className={`absolute z-20 touch-none w-[88px] h-[88px] rounded-full border-2 ${
            hud.seatedChair ? 'border-cyan-400/60 bg-cyan-950/35' : 'border-white/25 bg-zinc-950/35'
          } flex flex-col items-center justify-center shadow-lg ${
            floatingStick.active ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
          style={{
            left: `${controlLayout.move.xPct}%`,
            top: `${controlLayout.move.yPct}%`,
            transform: `translate(-50%, -50%) scale(${controlLayout.move.scale * hudScale})`,
            opacity: floatingStick.active ? 0 : hudOpacity * 0.92,
          }}
        >
          <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${
            hud.seatedChair
              ? 'bg-cyan-400/25 border-cyan-300/80 text-cyan-200'
              : 'bg-amber-400/25 border-amber-300/75 text-amber-300'
          }`}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <circle cx="12" cy="4.5" r="2" />
              <path d="M13.5 8h-3l-2 4.5 1.8.8 1-2.1v3.6l-2.8 5.2h2.2l2-3.8 1.9 3.8h2.2l-2.6-5.2v-3.5l1.6 1.9 1.6-1.3-2.9-3.9z" />
            </svg>
          </div>
          {hud.seatedChair && (
            <span className="mt-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-cyan-200">
              TURN CHAIR
            </span>
          )}
        </div>
      )}

      {/* Active Floating Movement / Chair Rotation Thumbstick Indicator (hidden while driving) */}
      {floatingStick.active && showWalkOrChairStick && (
        <div
          className={`absolute z-10 w-24 h-24 rounded-full border ${
            hud.seatedChair
              ? 'border-cyan-300/80 bg-cyan-950/40'
              : hud.runModeEnabled
                ? 'border-emerald-300/75 bg-emerald-950/35'
                : 'border-white/35 bg-zinc-950/40'
          } pointer-events-none flex items-center justify-center`}
          style={{
            left: floatingStick.baseX - 48,
            top: floatingStick.baseY - 48,
          }}
        >
          <div
            className={`w-10 h-10 rounded-full border border-white/70 flex items-center justify-center ${
              hud.seatedChair
                ? 'bg-cyan-400/95'
                : hud.runModeEnabled
                  ? 'bg-emerald-400/95'
                  : 'bg-amber-400/90'
            }`}
            style={{
              transform: `translate(${floatingStick.knobX}px, ${floatingStick.knobY}px)`,
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-zinc-950" fill="currentColor">
              <circle cx="12" cy="4.5" r="2" />
              <path d="M13.5 8h-3l-2 4.5 1.8.8 1-2.1v3.6l-2.8 5.2h2.2l2-3.8 1.9 3.8h2.2l-2.6-5.2v-3.5l1.6 1.9 1.6-1.3-2.9-3.9z" />
            </svg>
          </div>
        </div>
      )}

      {/* Damage Vignette */}
      {hud.damageFlash > 0.02 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle, transparent 48%, rgba(220, 38, 38, ${
              hud.damageFlash * 0.55
            }) 100%)`,
          }}
        />
      )}

      {/* Slow Recovery Subtle Edge Tint */}
      {hud.isRecoveringHealth && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, transparent 62%, rgba(16, 185, 129, 0.14) 100%)',
          }}
        />
      )}

      {/* Workable Per-Weapon Tactical Scope Overlays (Optical Lens for Sniper in 1st & 3rd Person) */}
      {isScoped && spec.scopeStyle === 'sniper' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Outer Scope Blackout Aperture with Optical Multi-Coated Lens Glass Tint */}
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at center, rgba(12, 34, 42, 0.09) 0%, rgba(18, 48, 56, 0.14) 24.5%, rgba(4, 7, 11, 0.72) 28.5%, rgba(3, 5, 8, 0.98) 34%)',
            }}
          />
          <svg
            viewBox="0 0 240 240"
            className="absolute w-[64vh] h-[64vh] max-w-[84vw] max-h-[84vw]"
          >
            <defs>
              <radialGradient id="sniper-lens-glare" cx="38%" cy="32%" r="65%">
                <stop offset="0%" stopColor="rgba(186, 230, 253, 0.12)" />
                <stop offset="45%" stopColor="rgba(56, 189, 248, 0.03)" />
                <stop offset="100%" stopColor="rgba(0, 0, 0, 0.25)" />
              </radialGradient>
            </defs>
            <circle cx="120" cy="120" r="113" fill="url(#sniper-lens-glare)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" />
            <circle cx="120" cy="120" r="108" fill="none" stroke="rgba(56,189,248,0.22)" strokeWidth="0.8" />
            {/* Thin illuminated crosshairs + heavy outer post stadia */}
            <line x1="10" y1="120" x2="112" y2="120" stroke="rgba(255,255,255,0.52)" strokeWidth="0.9" />
            <line x1="128" y1="120" x2="230" y2="120" stroke="rgba(255,255,255,0.52)" strokeWidth="0.9" />
            <line x1="120" y1="10" x2="120" y2="112" stroke="rgba(255,255,255,0.52)" strokeWidth="0.9" />
            <line x1="120" y1="128" x2="120" y2="230" stroke="rgba(255,255,255,0.52)" strokeWidth="0.9" />
            <line x1="10" y1="120" x2="48" y2="120" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
            <line x1="192" y1="120" x2="230" y2="120" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
            <line x1="120" y1="10" x2="120" y2="42" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
            <line x1="120" y1="192" x2="120" y2="230" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
            {[-45, -30, -15, 15, 30, 45].map((off) => (
              <g key={off}>
                <circle cx={120 + off} cy="120" r="1.45" fill="#fbbf24" fillOpacity="0.9" />
                <circle cx="120" cy={120 + off} r="1.45" fill="#fbbf24" fillOpacity="0.9" />
              </g>
            ))}
            {[15, 30, 45].map((off) => (
              <line
                key={`b-${off}`}
                x1={115}
                y1={120 + off}
                x2={125}
                y2={120 + off}
                stroke="rgba(251, 191, 36, 0.72)"
                strokeWidth="0.9"
              />
            ))}
            <circle cx="120" cy="120" r="1.9" fill="#ef4444" />
          </svg>
          {/* Optical Lens Rangefinder & Interactive 10x Zoom Selector */}
          <div className="absolute top-[19%] left-1/2 translate-x-14 sm:translate-x-20 flex items-center gap-1.5 pointer-events-auto">
            <div className="bg-zinc-950/90 border border-amber-400/45 rounded px-2 py-1 font-mono text-[10px] text-amber-300 tabular-nums shadow-lg">
              OPTIC {hud.activeZoomLabel} · {rangeText}
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCycleZoom();
              }}
              aria-label="Cycle Sniper Lens Magnification"
              className="touch-none min-h-[38px] px-3 py-1 rounded bg-sky-500/90 hover:bg-sky-400 active:scale-95 border border-sky-200 text-zinc-950 font-mono text-[10px] font-extrabold tracking-wide shadow-lg flex items-center gap-1"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>ZOOM {hud.activeZoomLabel}</span>
            </button>
          </div>
        </div>
      )}

      {isScoped && spec.scopeStyle === 'acog' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at center, rgba(16, 42, 46, 0.08) 0%, rgba(18, 44, 50, 0.14) 24%, rgba(4, 7, 11, 0.78) 29%, rgba(3, 5, 8, 0.96) 36%)',
            }}
          />
          <svg viewBox="0 0 220 220" className="absolute w-[58vh] h-[58vh] max-w-[80vw] max-h-[80vw]">
            <defs>
              <radialGradient id="acog-lens-glare" cx="38%" cy="32%" r="65%">
                <stop offset="0%" stopColor="rgba(167, 243, 208, 0.12)" />
                <stop offset="50%" stopColor="rgba(16, 185, 129, 0.03)" />
                <stop offset="100%" stopColor="rgba(0, 0, 0, 0.25)" />
              </radialGradient>
            </defs>
            <circle cx="110" cy="110" r="102" fill="url(#acog-lens-glare)" stroke="rgba(255,255,255,0.28)" strokeWidth="2.2" />
            <circle cx="110" cy="110" r="97" fill="none" stroke="rgba(16,185,129,0.26)" strokeWidth="1" />
            <path d="M103 115 L110 106 L117 115" fill="none" stroke={reticleHex} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="110" cy="110" r="1.8" fill={reticleHex} />
            <line x1="110" y1="117" x2="110" y2="174" stroke={reticleHex} strokeOpacity="0.75" strokeWidth="1.2" />
            {[126, 138, 150, 162].map((y, idx) => (
              <line key={y} x1={103 - idx * 2} y1={y} x2={117 + idx * 2} y2={y} stroke={reticleHex} strokeOpacity="0.8" strokeWidth="1.2" />
            ))}
            <line x1="20" y1="110" x2="86" y2="110" stroke="rgba(255,255,255,0.52)" strokeWidth="1.2" />
            <line x1="134" y1="110" x2="200" y2="110" stroke="rgba(255,255,255,0.52)" strokeWidth="1.2" />
            <line x1="20" y1="110" x2="48" y2="110" stroke="rgba(255,255,255,0.85)" strokeWidth="2.4" />
            <line x1="172" y1="110" x2="200" y2="110" stroke="rgba(255,255,255,0.85)" strokeWidth="2.4" />
          </svg>
          <div className="absolute top-[20%] left-1/2 translate-x-12 sm:translate-x-16 flex items-center gap-1.5 pointer-events-auto">
            <div className="bg-zinc-950/90 border border-amber-400/45 rounded px-2 py-1 font-mono text-[10px] text-amber-300 tabular-nums shadow-lg">
              ACOG {hud.activeZoomLabel} · {rangeText}
            </div>
            {canCycleZoom && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onCycleZoom();
                }}
                aria-label="Cycle Optic Magnification"
                className="touch-none min-h-[36px] px-2.5 py-1 rounded bg-sky-500/90 hover:bg-sky-400 active:scale-95 border border-sky-200 text-zinc-950 font-mono text-[10px] font-extrabold tracking-wide shadow-lg flex items-center gap-1"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>ZOOM {hud.activeZoomLabel}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {isScoped && spec.scopeStyle === 'holo' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at center, rgba(14, 38, 54, 0.06) 0%, rgba(14, 38, 54, 0.12) 25%, rgba(4, 7, 11, 0.68) 33%, rgba(3, 5, 8, 0.92) 48%)',
            }}
          />
          <div className="absolute relative w-60 h-48 sm:w-72 sm:h-56 border-[3px] border-zinc-800 rounded-2xl bg-sky-400/[0.06] shadow-[0_0_45px_rgba(56,189,248,0.2)] flex items-center justify-center ring-1 ring-white/20">
            <svg viewBox="0 0 120 120" className="w-32 h-32">
              <circle cx="60" cy="60" r="24" fill="none" stroke={reticleHex} strokeWidth="1.6" strokeDasharray="8 5" strokeOpacity="0.9" />
              <line x1="60" y1="26" x2="60" y2="38" stroke={reticleHex} strokeWidth="1.7" />
              <line x1="60" y1="82" x2="60" y2="94" stroke={reticleHex} strokeWidth="1.7" />
              <line x1="26" y1="60" x2="38" y2="60" stroke={reticleHex} strokeWidth="1.7" />
              <line x1="82" y1="60" x2="94" y2="60" stroke={reticleHex} strokeWidth="1.7" />
              <circle cx="60" cy="60" r="2.2" fill={reticleHex} />
            </svg>
            <div className="absolute -top-10 left-0 right-0 flex items-center justify-between gap-2 pointer-events-auto">
              <div className="bg-zinc-950/90 border border-cyan-400/40 rounded px-2 py-0.5 font-mono text-[10px] text-cyan-300 tabular-nums shadow">
                HOLO {hud.activeZoomLabel} · {rangeText}
              </div>
              {canCycleZoom && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onCycleZoom();
                  }}
                  aria-label="Cycle Holo Magnification"
                  className="touch-none min-h-[34px] px-2.5 py-0.5 rounded bg-sky-500/90 hover:bg-sky-400 active:scale-95 border border-sky-200 text-zinc-950 font-mono text-[10px] font-extrabold tracking-wide shadow flex items-center gap-1"
                >
                  <ZoomIn className="w-3 h-3" />
                  <span>ZOOM {hud.activeZoomLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isScoped && spec.scopeStyle === 'reflex' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at center, rgba(30, 24, 18, 0.05) 0%, rgba(16, 20, 28, 0.1) 24%, rgba(4, 7, 11, 0.62) 34%, rgba(3, 5, 8, 0.88) 52%)',
            }}
          />
          <div className="absolute w-52 h-40 sm:w-60 sm:h-46 rounded-t-[2.2rem] rounded-b-xl border-[3px] border-zinc-800 bg-amber-400/[0.04] shadow-[0_0_35px_rgba(251,191,36,0.14)] flex items-center justify-center ring-1 ring-white/20">
            <svg viewBox="0 0 100 100" className="w-24 h-24">
              <circle cx="50" cy="50" r="18" fill="none" stroke={reticleHex} strokeOpacity="0.55" strokeWidth="1.2" />
              <line x1="50" y1="26" x2="50" y2="38" stroke={reticleHex} strokeOpacity="0.7" strokeWidth="1.2" />
              <line x1="50" y1="62" x2="50" y2="74" stroke={reticleHex} strokeOpacity="0.7" strokeWidth="1.2" />
              <line x1="26" y1="50" x2="38" y2="50" stroke={reticleHex} strokeOpacity="0.7" strokeWidth="1.2" />
              <line x1="62" y1="50" x2="74" y2="50" stroke={reticleHex} strokeOpacity="0.7" strokeWidth="1.2" />
              <circle cx="50" cy="50" r="2.4" fill={reticleHex} />
            </svg>
            <div className="absolute bottom-1.5 right-2.5 bg-zinc-950/85 border border-white/15 rounded px-1.5 py-0.5 font-mono text-[9.5px] text-amber-200 tabular-nums">
              RMR {hud.activeZoomLabel} · {rangeText}
            </div>
          </div>
        </div>
      )}

      {isScoped && spec.scopeStyle === 'ghostring' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at center, transparent 24%, rgba(4, 7, 11, 0.68) 33%, rgba(3, 5, 8, 0.92) 48%)',
            }}
          />
          <svg viewBox="0 0 160 160" className="absolute w-[44vh] h-[44vh] max-w-[68vw] max-h-[68vw]">
            <circle cx="80" cy="80" r="62" fill="rgba(16, 185, 129, 0.04)" stroke="rgba(255,255,255,0.34)" strokeWidth="3.2" />
            <circle cx="80" cy="80" r="30" fill="none" stroke={reticleHex} strokeOpacity="0.75" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="80" y1="78" x2="80" y2="96" stroke={reticleHex} strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="80" cy="80" r="2.2" fill={reticleHex} />
          </svg>
          <div className="absolute top-[64%] font-mono text-[10px] text-emerald-300 bg-zinc-950/85 border border-emerald-400/35 px-2 py-0.5 rounded tabular-nums shadow">
            GHOST RING {hud.activeZoomLabel} · {rangeText}
          </div>
        </div>
      )}

      {isScoped && spec.scopeStyle === 'launcher' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at center, rgba(24, 18, 12, 0.08) 0%, transparent 31%, rgba(6, 9, 12, 0.86) 40%, rgba(4, 6, 9, 0.96) 100%)',
            }}
          />
          <svg
            viewBox="0 0 240 240"
            className="absolute w-[56vh] h-[56vh] max-w-[78vw] max-h-[78vw]"
          >
            <circle cx="120" cy="120" r="108" fill="none" stroke="rgba(251,146,60,0.45)" strokeWidth="2.2" />
            <circle cx="120" cy="120" r="38" fill="none" stroke="rgba(249,115,22,0.45)" strokeWidth="1.1" strokeDasharray="4 4" />
            <line x1="28" y1="120" x2="108" y2="120" stroke="rgba(255,255,255,0.65)" strokeWidth="1.1" />
            <line x1="132" y1="120" x2="212" y2="120" stroke="rgba(255,255,255,0.65)" strokeWidth="1.1" />
            <line x1="120" y1="90" x2="120" y2="205" stroke="rgba(251,146,60,0.8)" strokeWidth="1.2" />
            {[
              { y: 120, label: '20m', w: 12 },
              { y: 140, label: '40m', w: 10 },
              { y: 162, label: '60m', w: 8 },
              { y: 185, label: '80m', w: 6 },
            ].map((tick) => (
              <g key={tick.label}>
                <line
                  x1={120 - tick.w}
                  y1={tick.y}
                  x2={120 + tick.w}
                  y2={tick.y}
                  stroke="#fb923c"
                  strokeWidth="1.4"
                />
                <text
                  x={124 + tick.w}
                  y={tick.y + 3}
                  fill="#fdba74"
                  fontSize="7"
                  fontFamily="monospace"
                >
                  {tick.label}
                </text>
              </g>
            ))}
            <path d="M 38 112 Q 62 92 92 92" fill="none" stroke="rgba(251,146,60,0.55)" strokeWidth="1" />
            <circle cx="120" cy="120" r="2.2" fill="#f97316" />
          </svg>
          <div className="absolute top-[21%] left-1/2 translate-x-12 flex items-center gap-1.5 pointer-events-auto">
            <div className="bg-zinc-950/88 border border-orange-400/45 rounded px-2 py-1 font-mono text-[10px] space-y-0.5 tabular-nums">
              <div className="text-orange-300 font-bold">
                PGO-7 {hud.activeZoomLabel} · RNG {rangeText}
              </div>
              <div className={mag > 0 ? 'text-emerald-400' : 'text-red-400 font-bold'}>
                {mag > 0 ? 'WARHEAD ARMED · 10m BLAST' : 'TUBE EMPTY — RELOAD'}
              </div>
            </div>
            {canCycleZoom && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onCycleZoom();
                }}
                aria-label="Cycle Launcher Optic Magnification"
                className="touch-none min-h-[36px] px-2.5 py-1 rounded bg-orange-500/90 hover:bg-orange-400 active:scale-95 border border-orange-200 text-zinc-950 font-mono text-[10px] font-extrabold tracking-wide shadow-lg flex items-center gap-1"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>ZOOM {hud.activeZoomLabel}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top-Left: Compact Tactical Mini-Radar + Slim Score/Kills Bar */}
      <div
        className="absolute top-2 left-2 flex items-start gap-1.5 origin-top-left"
        style={{ transform: `scale(${hudScale})`, opacity: hudOpacity }}
      >
        {hudSettings.showRadar && <TacticalRadar hud={hud} />}

        <div className="flex flex-col gap-0.5">
          <div className="bg-zinc-950/90 border border-sky-400/35 rounded px-2 py-1 flex items-center gap-2 pointer-events-auto">
            <div>
              <div className="text-[7.5px] uppercase tracking-wider text-sky-300 leading-none">
                World Sim
              </div>
              <div className="font-mono text-[11px] sm:text-xs font-bold text-white tabular-nums leading-tight">
                {hud.clockLabel}
              </div>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div>
              <div className="text-[7.5px] uppercase tracking-wider text-zinc-400 leading-none">
                Time
              </div>
              <div className="font-mono text-[10px] sm:text-[11px] font-bold text-amber-300 uppercase leading-tight">
                {hud.timePhase}
              </div>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div>
              <div className="text-[7.5px] uppercase tracking-wider text-zinc-400 leading-none">
                Weather
              </div>
              <div className="font-mono text-[10px] sm:text-[11px] font-bold text-sky-300 uppercase leading-tight">
                {hud.weather}
              </div>
            </div>
            <button
              type="button"
              data-sim-env-toggle="true"
              onClick={() => {
                setShowSimShopDrawer(false);
                setShowSimEnvDrawer((v) => !v);
              }}
              className={`ml-0.5 px-2 py-1 rounded border text-[9px] font-mono font-bold transition-colors ${
                showSimEnvDrawer
                  ? 'bg-sky-400 text-zinc-950 border-sky-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-sky-400/45 text-sky-200'
              }`}
            >
              Env
            </button>
            <button
              type="button"
              data-testid="sim-shop-toggle"
              onClick={() => {
                setShowSimEnvDrawer(false);
                setShowSimShopDrawer((v) => !v);
              }}
              className={`px-2 py-1 rounded border text-[9px] font-mono font-bold flex items-center gap-1 transition-colors ${
                showSimShopDrawer
                  ? 'bg-amber-400 text-zinc-950 border-amber-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-amber-400/50 text-amber-200'
              }`}
            >
              <ShoppingBag className="w-2.5 h-2.5" />
              <span>Shop</span>
            </button>
            <button
              type="button"
              data-testid="smart-city-toggle"
              onClick={() => {
                setShowSimEnvDrawer(false);
                setShowSimShopDrawer(false);
                onOpenSmartCityDashboard?.();
              }}
              className={`px-2 py-1 rounded border text-[9px] font-mono font-bold flex items-center gap-1 transition-colors ${
                showSmartCityDashboard
                  ? 'bg-cyan-400 text-zinc-950 border-cyan-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-cyan-400/50 text-cyan-200'
              }`}
            >
              <Cpu className="w-2.5 h-2.5" />
              <span>Smart City</span>
            </button>
            <button
              type="button"
              data-testid="science-district-toggle"
              onClick={() => {
                setShowSimEnvDrawer(false);
                setShowSimShopDrawer(false);
                onOpenScienceDistrictModal?.();
              }}
              className={`px-2 py-1 rounded border text-[9px] font-mono font-bold flex items-center gap-1 transition-colors ${
                showScienceDistrictModal
                  ? 'bg-sky-400 text-zinc-950 border-sky-200'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-sky-400/50 text-sky-200'
              }`}
            >
              <Cpu className="w-2.5 h-2.5" />
              <span>Science Hub</span>
            </button>
          </div>
          <div className="bg-zinc-950/92 border border-emerald-400/35 rounded px-2 py-0.5 flex items-center gap-1.5 text-[9.5px] font-mono text-zinc-100 tabular-nums shadow">
            <span className="text-emerald-300 font-bold whitespace-nowrap">
              {hud.districtName || 'Unified Mega-World'}
            </span>
            <span className="text-zinc-500" aria-hidden="true">·</span>
            <span className="text-amber-300 font-bold whitespace-nowrap" data-testid="sim-credits-display">
              ₡ {hud.simCredits.toLocaleString()}
            </span>
            <span className="text-zinc-500" aria-hidden="true">·</span>
            <span className="text-sky-200 font-semibold whitespace-nowrap">
              {hud.simVisitedCount}/{SIMULATOR_POIS.length} Zones · {hud.simNpcCount || 220}+ NPCs
            </span>
          </div>
        </div>
      </div>

      {/* Top-Center: Slim Tactical Compass */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none">
        <div className="w-36 sm:w-44 h-4 bg-zinc-950/80 border border-white/12 rounded relative overflow-hidden flex items-center justify-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3.5px] border-r-[3.5px] border-t-[3.5px] border-l-transparent border-r-transparent border-t-amber-400" />

          {COMPASS_MARKS.map((mark) => {
            const diff = shortestAngleDiff(mark.deg, hud.headingDeg);
            if (Math.abs(diff) > 75) return null;
            const px = (diff / 75) * 76;
            return (
              <span
                key={mark.label}
                className={`absolute font-mono text-[8px] font-bold ${
                  mark.label === 'N' ? 'text-amber-400' : 'text-zinc-200'
                }`}
                style={{ transform: `translateX(${px}px)` }}
              >
                {mark.label}
              </span>
            );
          })}

          {hud.threats.map((t) => {
            const diff = shortestAngleDiff(t.angleDeg, hud.headingDeg);
            const clamped = Math.max(-72, Math.min(72, diff));
            const px = (clamped / 75) * 76;
            return (
              <div
                key={t.id}
                className="absolute bottom-0.5 w-1 h-1 rotate-45 bg-red-500"
                style={{
                  transform: `translateX(${px}px) rotate(45deg)`,
                  opacity: t.intensity,
                }}
              />
            );
          })}
        </div>

        {/* Simulator Interact Feedback */}
        {hud.interactFeedback && (
          <div className="bg-zinc-950/92 border border-emerald-400/60 rounded px-3 py-1 text-[10px] font-mono font-bold text-emerald-300 shadow-lg">
            {hud.interactFeedback}
          </div>
        )}
      </div>

      {/* World Simulator Live Environment Drawer (Time, Weather, Cyber Bike, Switch World) */}
      {hud.worldSystem === 'simulator' && showSimEnvDrawer && (
        <div
          data-testid="sim-env-drawer"
          className="absolute top-28 left-2 z-40 w-72 sm:w-80 bg-[#090e16]/95 border border-sky-400/40 rounded-lg p-3 shadow-2xl pointer-events-auto space-y-2.5"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-300" />
              <span>World Environment</span>
            </span>
            <button
              type="button"
              onClick={() => setShowSimEnvDrawer(false)}
              title="Close"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-zinc-300">
              <span className="font-medium">Time of Day ({hud.clockLabel})</span>
              <button
                type="button"
                onClick={() => onSetSimulatorEnv?.({ autoCycle: !hud.autoEnvCycle })}
                className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold ${
                  hud.autoEnvCycle
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                    : 'bg-zinc-900 border-white/15 text-zinc-400'
                }`}
              >
                Auto: {hud.autoEnvCycle ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { id: 'morning', label: 'Morn', icon: Sun },
                  { id: 'afternoon', label: 'Noon', icon: Sun },
                  { id: 'sunset', label: 'Dusk', icon: Sunset },
                  { id: 'night', label: 'Night', icon: Moon },
                ] as { id: TimeOfDayPhase; label: string; icon: React.FC<{ className?: string }> }[]
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-sim-time={t.id}
                    onClick={() => onSetSimulatorEnv?.({ timePhase: t.id })}
                    className={`py-1 px-1 rounded border text-[10px] font-mono flex items-center justify-center gap-1 transition-colors ${
                      hud.timePhase === t.id
                        ? 'bg-amber-400 text-zinc-950 border-amber-200 font-bold'
                        : 'bg-zinc-900 text-zinc-300 border-white/12 hover:border-white/30'
                    }`}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-zinc-300 font-medium">Weather</div>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { id: 'clear', label: 'Clear', icon: Sun },
                  { id: 'cloudy', label: 'Cloud', icon: Cloud },
                  { id: 'foggy', label: 'Fog', icon: CloudFog },
                  { id: 'rainy', label: 'Rain', icon: CloudRain },
                ] as { id: WeatherKind; label: string; icon: React.FC<{ className?: string }> }[]
              ).map((w) => {
                const Icon = w.icon;
                return (
                  <button
                    key={w.id}
                    type="button"
                    data-sim-weather={w.id}
                    onClick={() => onSetSimulatorEnv?.({ weather: w.id })}
                    className={`py-1 px-1 rounded border text-[10px] font-mono flex items-center justify-center gap-1 transition-colors ${
                      hud.weather === w.id
                        ? 'bg-sky-400 text-zinc-950 border-sky-200 font-bold'
                        : 'bg-zinc-900 text-zinc-300 border-white/12 hover:border-white/30'
                    }`}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    <span>{w.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-zinc-300 font-medium">Cyber Bike Theme</div>
            <div className="flex items-center gap-1">
              {BIKE_STYLES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  title={b.name}
                  onClick={() => onSetSimulatorEnv?.({ bikeStyle: b.id })}
                  className={`flex-1 py-1 rounded border flex items-center justify-center ${
                    hud.bikeStyle === b.id
                      ? 'bg-zinc-800 border-white'
                      : 'bg-zinc-900 border-white/12 hover:border-white/30'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: b.swatchCss }}
                  />
                </button>
              ))}
            </div>
          </div>

          {onTeleportPoi && (
            <div className="space-y-1">
              <div className="text-[10px] text-zinc-300 font-medium">Quick Travel District</div>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                {SIMULATOR_POIS.map((poi) => (
                  <button
                    key={poi.id}
                    type="button"
                    data-sim-poi={poi.id}
                    onClick={() => {
                      onTeleportPoi(poi.x, poi.z, poi.shortName || poi.name, poi.viewYaw);
                      setShowSimEnvDrawer(false);
                    }}
                    className="px-2 py-1.5 rounded bg-zinc-900 hover:bg-sky-500/25 border border-white/12 hover:border-sky-400/50 text-[10px] font-mono text-zinc-100 text-left leading-tight whitespace-nowrap transition-colors"
                  >
                    {poi.shortName || poi.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* World Simulator Offline City Shop & Gear Drawer */}
      {hud.worldSystem === 'simulator' && showSimShopDrawer && (
        <div
          data-testid="sim-shop-drawer"
          className="absolute top-28 left-2 z-40 w-80 sm:w-96 max-w-[94vw] bg-[#090e16]/96 border border-amber-400/45 rounded-lg p-3 shadow-2xl pointer-events-auto space-y-2.5 max-h-[72vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div>
              <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
                <span>City Mall &amp; Bistro Shop</span>
              </div>
              <div className="text-[10px] font-mono text-amber-300">
                Balance: ₡ {hud.simCredits.toLocaleString()} · Saved Offline
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSimShopDrawer(false)}
              title="Close Shop"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5">
            {SIM_SHOP_ITEMS.map((item) => {
              const owned = hud.simPurchasedItems[item.id] ?? 0;
              const canAfford = hud.simCredits >= item.price;
              return (
                <div
                  key={item.id}
                  data-shop-item={item.id}
                  className="p-2 rounded bg-zinc-950/90 border border-white/12 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{item.name}</span>
                      {owned > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/40 text-[9px] font-mono font-bold text-emerald-300">
                          x{owned}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 leading-snug">{item.description}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {owned > 0 && onUseSimItem && (
                      <button
                        type="button"
                        data-testid={`use-item-${item.id}`}
                        onClick={() => onUseSimItem(item.id)}
                        className="px-2 py-1 rounded bg-sky-500 hover:bg-sky-400 text-zinc-950 font-mono text-[10px] font-extrabold"
                      >
                        Use
                      </button>
                    )}
                    {onBuySimItem && (
                      <button
                        type="button"
                        data-testid={`buy-item-${item.id}`}
                        disabled={!canAfford}
                        onClick={() => onBuySimItem(item.id)}
                        className={`px-2 py-1 rounded font-mono text-[10px] font-extrabold transition-colors ${
                          canAfford
                            ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        Buy ₡{item.price}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* Live 3D Winning Celebration Overlay */}
      {hud.victoryCelebration && (
        <div className="absolute inset-x-0 top-14 z-30 flex flex-col items-center pointer-events-none px-4">
          <div className="bg-zinc-950/90 border-2 border-amber-400 rounded-lg px-6 py-3 shadow-2xl text-center animate-pulse">
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-300 font-bold">
              All {hud.targetKills} Hostiles Eliminated
            </div>
            <div className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-wide">
              MISSION VICTORY!
            </div>
            <div className="text-xs text-emerald-300 font-mono mt-0.5">
              Sector Secured · Score {hud.score.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Center Crosshair, Headshot Skull Banner & Hitmarker */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <HeadshotBanner
          seq={hud.headshotSeq}
          visible={hud.headshotSeq > 0 && hud.elapsedTime - hud.lastHeadshotAt < 1.3}
        />
        <div className="relative flex items-center justify-center">
          {!isScoped && (!hud.vehicle.inVehicle || hud.vehicle.hasMountedGun) && (
            <>
              <div
                className="absolute w-[2px] bg-white/95 shadow-sm transition-transform duration-75"
                style={{
                  height: `${crosshairBarLen}px`,
                  transform: `translateY(${-crosshairGap - crosshairBarLen * 0.5}px)`,
                }}
              />
              <div
                className="absolute w-[2px] bg-white/95 shadow-sm transition-transform duration-75"
                style={{
                  height: `${crosshairBarLen}px`,
                  transform: `translateY(${crosshairGap + crosshairBarLen * 0.5}px)`,
                }}
              />
              <div
                className="absolute h-[2px] bg-white/95 shadow-sm transition-transform duration-75"
                style={{
                  width: `${crosshairBarLen}px`,
                  transform: `translateX(${-crosshairGap - crosshairBarLen * 0.5}px)`,
                }}
              />
              <div
                className="absolute h-[2px] bg-white/95 shadow-sm transition-transform duration-75"
                style={{
                  width: `${crosshairBarLen}px`,
                  transform: `translateX(${crosshairGap + crosshairBarLen * 0.5}px)`,
                }}
              />
              {crosshairGap > 10 && (
                <>
                  <div
                    className="absolute w-1.5 h-[1.5px] bg-amber-300/75 rotate-45"
                    style={{
                      transform: `translate(${Math.round(crosshairGap * 0.78)}px, ${Math.round(crosshairGap * 0.78)}px) rotate(45deg)`,
                    }}
                  />
                  <div
                    className="absolute w-1.5 h-[1.5px] bg-amber-300/75 -rotate-45"
                    style={{
                      transform: `translate(${Math.round(-crosshairGap * 0.78)}px, ${Math.round(crosshairGap * 0.78)}px) rotate(-45deg)`,
                    }}
                  />
                  <div
                    className="absolute w-1.5 h-[1.5px] bg-amber-300/75 -rotate-45"
                    style={{
                      transform: `translate(${Math.round(crosshairGap * 0.78)}px, ${Math.round(-crosshairGap * 0.78)}px) rotate(-45deg)`,
                    }}
                  />
                  <div
                    className="absolute w-1.5 h-[1.5px] bg-amber-300/75 rotate-45"
                    style={{
                      transform: `translate(${Math.round(-crosshairGap * 0.78)}px, ${Math.round(-crosshairGap * 0.78)}px) rotate(45deg)`,
                    }}
                  />
                </>
              )}
              <div
                className="w-1.5 h-1.5 rounded-full shadow-sm"
                style={{ backgroundColor: reticleHex }}
              />
            </>
          )}

          {hud.hitMarker !== 'none' && (
            <div className="absolute w-7 h-7 flex items-center justify-center">
              <div
                className={`absolute w-5 h-[2px] rotate-45 ${
                  hud.hitMarker === 'kill'
                    ? 'bg-red-500'
                    : hud.hitMarker === 'head'
                      ? 'bg-amber-400'
                      : 'bg-white'
                }`}
              />
              <div
                className={`absolute w-5 h-[2px] -rotate-45 ${
                  hud.hitMarker === 'kill'
                    ? 'bg-red-500'
                    : hud.hitMarker === 'head'
                      ? 'bg-amber-400'
                      : 'bg-white'
                }`}
              />
            </div>
          )}

          {hud.isReloading && (
            <div className="absolute top-8 w-24 flex flex-col items-center gap-0.5">
              <div className="w-full h-1 bg-zinc-900/90 rounded overflow-hidden border border-white/15">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[9px] text-amber-300 tracking-wide">
                {hud.reloadStage || 'Reloading'}
              </span>
            </div>
          )}

          {!hud.isReloading && hud.smartCity?.aimTarget && (() => {
            const tgt = hud.smartCity.aimTarget;
            const hpPct = Math.max(0, Math.min(100, Math.round((tgt.hp / Math.max(1, tgt.maxHp)) * 100)));
            const stageColor =
              tgt.stage >= 5
                ? 'text-red-400 border-red-500/60'
                : tgt.stage >= 3
                  ? 'text-orange-300 border-orange-400/60'
                  : tgt.stage >= 1
                    ? 'text-amber-300 border-amber-400/60'
                    : 'text-cyan-300 border-cyan-400/55';
            const barColor =
              tgt.stage >= 4 ? 'bg-red-500' : tgt.stage >= 2 ? 'bg-orange-400' : 'bg-cyan-400';
            return (
              <div
                data-testid="smart-city-aim-target"
                className={`absolute top-9 w-52 px-2 py-1 rounded bg-zinc-950/90 border ${stageColor} flex flex-col gap-0.5 shadow-lg`}
              >
                <div className="flex items-center justify-between gap-1 text-[9px] font-mono leading-tight">
                  <span className="text-white font-bold truncate">{tgt.label}</span>
                  <span className="uppercase shrink-0 px-1 rounded bg-white/10">
                    {tgt.component.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded overflow-hidden">
                  <div className={`h-full ${barColor}`} style={{ width: `${hpPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[8.5px] font-mono tabular-nums">
                  <span className="text-zinc-300">
                    {tgt.hp}/{tgt.maxHp} HP
                  </span>
                  <span className="font-bold uppercase">{tgt.stageLabel}</span>
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      {/* Top-Right: Compact FPS, View & Utility Bar + Slim Kill Feed */}
      <div
        className="absolute top-2 right-2 flex flex-col items-end gap-1 origin-top-right"
        style={{ transform: `scale(${hudScale})`, opacity: hudOpacity }}
      >
        <div className="flex items-center gap-1 pointer-events-auto z-20">
          <div
            title="Live Frame Rate"
            className={`bg-zinc-950/85 border border-white/15 px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums ${
              hud.fps >= 45
                ? 'text-emerald-400'
                : hud.fps >= 28
                  ? 'text-amber-300'
                  : 'text-red-400'
            }`}
          >
            {hud.fps} FPS
          </div>
          <button
            type="button"
            onClick={onTogglePerspective}
            title="Switch 1st / 3rd Person View"
            className="bg-zinc-950/85 hover:bg-zinc-900 border border-white/15 px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-200 flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <Eye className="w-2.5 h-2.5 text-amber-400" />
            <span>{hud.perspective === 'first' ? '1st' : '3rd'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleWideLandscape}
            title="Toggle 16:9 Wide Landscape Framing"
            className={`border p-1 rounded transition-colors ${
              wideLandscape
                ? 'bg-sky-500/20 border-sky-400/60 text-sky-300'
                : 'bg-zinc-950/85 border-white/15 text-zinc-300'
            }`}
          >
            <Monitor className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            title="Fullscreen Landscape Mode"
            className="bg-zinc-950/85 hover:bg-zinc-900 border border-white/15 p-1 rounded text-zinc-200 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-2.5 h-2.5 text-amber-400" />
            ) : (
              <Maximize2 className="w-2.5 h-2.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            title="HUD Customization & Graphics"
            className={`border p-1 rounded transition-colors ${
              showSettings
                ? 'bg-amber-500 text-zinc-950 border-amber-300'
                : 'bg-zinc-950/85 hover:bg-zinc-900 border-white/15 text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            title="Toggle Audio"
            className="bg-zinc-950/85 hover:bg-zinc-900 border border-white/15 p-1 rounded text-zinc-200 transition-colors"
          >
            {muted ? (
              <VolumeX className="w-2.5 h-2.5 text-zinc-400" />
            ) : (
              <Volume2 className="w-2.5 h-2.5 text-amber-400" />
            )}
          </button>
          <button
            type="button"
            onClick={onPause}
            title="Pause"
            className="bg-zinc-950/85 hover:bg-zinc-900 border border-white/15 px-1.5 py-0.5 rounded text-[9px] text-zinc-200 flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <Pause className="w-2.5 h-2.5" />
            <span>Pause</span>
          </button>
        </div>

        {hud.worldSystem === 'simulator' && hud.wantedLevel > 0 && (
          <div
            data-testid="wanted-stars-hud"
            className={`bg-zinc-950/90 border rounded px-2 py-1 flex items-center gap-1.5 shadow-lg ${
              hud.wantedEvading
                ? 'border-sky-400/60 animate-pulse'
                : 'border-red-500/75'
            }`}
          >
            <span
              className={`text-[8.5px] font-mono font-extrabold tracking-wider ${
                hud.wantedEvading ? 'text-sky-300' : 'text-red-400'
              }`}
            >
              {hud.wantedEvading ? 'EVADING' : 'WANTED'}
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= hud.wantedLevel;
                return (
                  <Star
                    key={star}
                    className={`w-3.5 h-3.5 transition-all ${
                      active
                        ? hud.wantedEvading
                          ? 'text-amber-300 fill-amber-300 drop-shadow-[0_0_5px_rgba(251,191,36,0.75)]'
                          : 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.85)]'
                        : 'text-zinc-700 fill-zinc-900'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col items-end gap-0.5">
          {hud.killFeed.map((entry) => (
            <div
              key={entry.id}
              className="bg-zinc-950/82 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-zinc-100 flex items-center gap-1"
            >
              {entry.isHeadshot && <span className="text-amber-400 font-bold">HS</span>}
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* HUD Customization & Graphics Performance Drawer */}
      {showSettings && (
        <div className="absolute top-11 right-2 z-40 w-64 sm:w-72 bg-zinc-950/95 border border-white/20 rounded-lg p-3 shadow-2xl pointer-events-auto space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="text-xs font-bold text-white tracking-wide">
              HUD &amp; Performance
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUpdateHudSettings(DEFAULT_HUD_SETTINGS)}
                title="Reset HUD Defaults"
                className="p-1 rounded hover:bg-zinc-800 text-zinc-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                title="Close"
                className="p-1 rounded hover:bg-zinc-800 text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-zinc-300 font-medium">Graphics Quality</div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'low', label: 'Low' },
                  { id: 'medium', label: 'Medium' },
                  { id: 'high', label: 'High' },
                ] as { id: GraphicsQuality; label: string }[]
              ).map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() =>
                    onUpdateHudSettings({ ...hudSettings, graphicsQuality: q.id })
                  }
                  className={`py-1 px-1.5 rounded text-[10px] font-mono border transition-colors ${
                    hudSettings.graphicsQuality === q.id
                      ? 'bg-amber-500 text-zinc-950 border-amber-300 font-bold'
                      : 'bg-zinc-900 text-zinc-300 border-white/15 hover:border-white/30'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-0.5">
            <div className="flex justify-between text-[10px] text-zinc-300">
              <span>HUD Scale</span>
              <span className="font-mono text-amber-300">
                {Math.round(hudSettings.hudScale * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.75"
              max="1.25"
              step="0.05"
              value={hudSettings.hudScale}
              onChange={(e) =>
                onUpdateHudSettings({
                  ...hudSettings,
                  hudScale: Number(e.target.value),
                })
              }
              className="w-full accent-amber-400 h-1.5"
            />
          </label>

          <label className="block space-y-0.5">
            <div className="flex justify-between text-[10px] text-zinc-300">
              <span>HUD Opacity</span>
              <span className="font-mono text-amber-300">
                {Math.round(hudSettings.hudOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.45"
              max="1"
              step="0.05"
              value={hudSettings.hudOpacity}
              onChange={(e) =>
                onUpdateHudSettings({
                  ...hudSettings,
                  hudOpacity: Number(e.target.value),
                })
              }
              className="w-full accent-amber-400 h-1.5"
            />
          </label>

          <label className="block space-y-0.5">
            <div className="flex justify-between text-[10px] text-zinc-300">
              <span>Aim Sensitivity</span>
              <span className="font-mono text-amber-300">
                {hudSettings.lookSensitivity.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={hudSettings.lookSensitivity}
              onChange={(e) =>
                onUpdateHudSettings({
                  ...hudSettings,
                  lookSensitivity: Number(e.target.value),
                })
              }
              className="w-full accent-amber-400 h-1.5"
            />
          </label>

          <label className="block space-y-0.5">
            <div className="flex justify-between text-[10px] text-zinc-300">
              <span>Map Saturation</span>
              <span className="font-mono text-emerald-300 tabular-nums">
                {Math.round((hudSettings.mapSaturation ?? 1.35) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.8"
              step="0.05"
              value={hudSettings.mapSaturation ?? 1.35}
              onChange={(e) =>
                onUpdateHudSettings({
                  ...hudSettings,
                  mapSaturation: Number(e.target.value),
                })
              }
              className="w-full accent-emerald-400 h-1.5"
            />
          </label>



          <label className="block space-y-0.5">
            <div className="flex justify-between text-[10px] text-zinc-300">
              <span>SFX Volume</span>
              <span className="font-mono text-sky-300">
                {Math.round(hudSettings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(hudSettings.sfxVolume * 100)}
              onChange={(e) =>
                onUpdateHudSettings({
                  ...hudSettings,
                  sfxVolume: Number(e.target.value) / 100,
                })
              }
              className="w-full accent-sky-400 h-1.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[10px]">
            <button
              type="button"
              onClick={() =>
                onUpdateHudSettings({
                  ...hudSettings,
                  bloomEnabled: !hudSettings.bloomEnabled,
                })
              }
              className={`py-1 px-2 rounded border text-left font-medium ${
                hudSettings.bloomEnabled
                  ? 'bg-violet-500/20 border-violet-400/60 text-violet-200'
                  : 'bg-zinc-900 border-white/15 text-zinc-300'
              }`}
            >
              Bloom (High): {hudSettings.bloomEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateHudSettings({
                  ...hudSettings,
                  leftHanded: !hudSettings.leftHanded,
                })
              }
              className={`py-1 px-2 rounded border text-left font-medium ${
                hudSettings.leftHanded
                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                  : 'bg-zinc-900 border-white/15 text-zinc-300'
              }`}
            >
              Left-Hand: {hudSettings.leftHanded ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateHudSettings({
                  ...hudSettings,
                  autoSprint: !hudSettings.autoSprint,
                })
              }
              className={`py-1 px-2 rounded border text-left font-medium ${
                hudSettings.autoSprint
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                  : 'bg-zinc-900 border-white/15 text-zinc-300'
              }`}
            >
              Auto-Sprint: {hudSettings.autoSprint ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateHudSettings({
                  ...hudSettings,
                  showRadar: !hudSettings.showRadar,
                })
              }
              className={`py-1 px-2 rounded border text-left font-medium ${
                hudSettings.showRadar
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                  : 'bg-zinc-900 border-white/15 text-zinc-300'
              }`}
            >
              Radar: {hudSettings.showRadar ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className={`col-span-2 py-1 px-2 rounded border text-left font-medium ${
                muted
                  ? 'bg-red-500/20 border-red-400/60 text-red-200'
                  : 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
              }`}
            >
              Audio: {muted ? 'MUTED' : 'ON'}
            </button>
            {onOpenHudEditor && (
              <button
                type="button"
                data-testid="open-hud-layout-editor"
                onClick={() => {
                  setShowSettings(false);
                  onOpenHudEditor();
                }}
                className="col-span-2 py-1.5 px-2 rounded border border-sky-400/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-center"
              >
                Edit HUD Layout &amp; Drive Cam
              </button>
            )}
          </div>

          {onSetSimulatorEnv && (
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between text-[10px] text-zinc-300">
                <span>Atmosphere &amp; Time</span>
                <button
                  type="button"
                  onClick={() => onSetSimulatorEnv({ autoCycle: !hud.autoEnvCycle })}
                  className={`px-1.5 py-0.5 rounded border text-[9px] font-mono ${
                    hud.autoEnvCycle
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                      : 'bg-zinc-900 border-white/15 text-zinc-400'
                  }`}
                >
                  Auto: {hud.autoEnvCycle ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'morning', label: 'Morn' },
                    { id: 'afternoon', label: 'Noon' },
                    { id: 'sunset', label: 'Dusk' },
                    { id: 'night', label: 'Night' },
                  ] as { id: TimeOfDayPhase; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSetSimulatorEnv({ timePhase: t.id })}
                    className={`py-1 rounded border text-[9.5px] font-mono ${
                      hud.timePhase === t.id
                        ? 'bg-amber-400 text-zinc-950 border-amber-200 font-bold'
                        : 'bg-zinc-900 text-zinc-300 border-white/15 hover:border-white/30'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'clear', label: 'Clear' },
                    { id: 'cloudy', label: 'Cloud' },
                    { id: 'foggy', label: 'Fog' },
                    { id: 'rainy', label: 'Rain' },
                  ] as { id: WeatherKind; label: string }[]
                ).map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onSetSimulatorEnv({ weather: w.id })}
                    className={`py-1 rounded border text-[9.5px] font-mono ${
                      hud.weather === w.id
                        ? 'bg-sky-400 text-zinc-950 border-sky-200 font-bold'
                        : 'bg-zinc-900 text-zinc-300 border-white/15 hover:border-white/30'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contextual Doorway Breach Prompt */}
      {hud.nearDoorway && !hud.isBreaching && !hud.victoryCelebration && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onBreach();
            }}
            className="touch-none bg-zinc-950/90 hover:bg-amber-500 hover:text-zinc-950 border border-amber-400/70 text-amber-300 font-mono text-[10px] font-bold px-3 py-1.5 rounded shadow-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Breach Entry</span>
          </button>
        </div>
      )}

      {/* Seated Chair / Sofa Stand Up Prompt */}
      {hud.seatedChair && !hud.victoryCelebration && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            data-testid="seat-stand-up-btn"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onInteract?.();
            }}
            className="touch-none min-h-[40px] px-4 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 border-2 border-amber-200 text-zinc-950 font-mono text-[11px] font-extrabold shadow-xl transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>[E] Stand Up</span>
          </button>
          {hud.seatedChair.canRotate && (
            <span className="px-3 py-1.5 rounded-full bg-zinc-950/90 border border-cyan-400/50 text-cyan-200 font-mono text-[10px] font-semibold whitespace-nowrap">
              A/D or Stick: Rotate Chair
            </span>
          )}
        </div>
      )}

      {/* Contextual City Interactable Prompt (Openable Doors, Petrol Station, Shops, Hotel, Seating) */}
      {!hud.seatedChair && hud.nearbyInteractable && !hud.victoryCelebration && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            data-interact="true"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onInteract?.();
            }}
            className="touch-none min-h-[40px] px-4 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 active:scale-95 border-2 border-sky-200 text-zinc-950 font-mono text-[11px] font-extrabold shadow-xl transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>[E] {hud.nearbyInteractable.label}</span>
          </button>
          {(hud.nearbyInteractable.category === 'shop' ||
            hud.nearbyInteractable.category === 'dine') && (
            <button
              type="button"
              onClick={() => {
                setShowSimEnvDrawer(false);
                setShowSimShopDrawer(true);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 border-2 border-amber-200 text-zinc-950 font-mono text-[11px] font-extrabold shadow-xl transition-all flex items-center gap-1 whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Open Shop</span>
            </button>
          )}
        </div>
      )}

      {/* Nearby Science District Glass Approach Interface Trigger */}
      {!hud.seatedChair && !hud.nearbyInteractable && hud.scienceDistrict?.nearbyKind && !showScienceDistrictModal && !hud.victoryCelebration && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            data-testid="science-district-approach-btn"
            onClick={() => onOpenScienceDistrictModal?.()}
            className="min-h-[40px] px-4 py-1.5 rounded-lg border border-cyan-300/60 text-white font-medium text-xs shadow-xl transition-colors flex items-center gap-2 whitespace-nowrap"
            style={{ backgroundColor: 'rgba(8, 22, 46, 0.90)' }}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-300" />
            <span>{hud.scienceDistrict.nearbyLabel}</span>
          </button>
        </div>
      )}

      {/* Bottom-Left: Compact Health (with Slow Recovery Status), Armor, Cover/Stance & Stamina */}
      <div
        className="absolute bottom-2 left-2 w-32 sm:w-36 bg-zinc-950/85 border border-white/12 rounded px-1.5 py-1 space-y-0.5 origin-bottom-left"
        style={{ transform: `scale(${hudScale})`, opacity: hudOpacity }}
      >
        {(hud.isInCover || hud.isSliding || hud.isBreaching || hud.isThrowingGrenade) && (
          <div className="flex items-center justify-between gap-1 pb-0.5">
            <span className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-amber-300">
              {hud.isBreaching
                ? 'BREACH'
                : hud.isThrowingGrenade
                  ? 'FRAG'
                  : hud.isSliding
                    ? 'SLIDE'
                    : hud.coverPeekDir > 0
                      ? 'PEEK R'
                      : hud.coverPeekDir < 0
                        ? 'PEEK L'
                        : 'COVER'}
            </span>
            {hud.isInCover && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onCyclePeek();
                }}
                title="Cycle Cover Peek Left/Right"
                className="touch-none pointer-events-auto px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-[8px] font-mono font-bold text-sky-200 leading-none"
              >
                {hud.coverPeekDir === 0 ? 'PEEK' : hud.coverPeekDir > 0 ? 'PEEK L' : 'CENTER'}
              </button>
            )}
          </div>
        )}

        <div>
          <div className="flex justify-between items-center text-[9px] mb-0.5">
            <span className="text-zinc-300 font-medium leading-none">Armor</span>
            <span className="font-mono font-bold text-sky-400 tabular-nums leading-none">
              {hud.armor}/{hud.maxArmor}
            </span>
          </div>
          <div className="h-1 bg-zinc-900 rounded-sm overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all duration-150"
              style={{ width: `${(hud.armor / hud.maxArmor) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center text-[9px] mb-0.5">
            <div className="flex items-center gap-1 leading-none">
              <span className="text-zinc-300 font-medium">HP</span>
              {hud.isRecoveringHealth && (
                <span className="text-[8.5px] font-mono font-semibold text-emerald-400">
                  +Rec
                </span>
              )}
              {!hud.isRecoveringHealth && hud.recoveryCountdown > 0 && (
                <span className="text-[8.5px] font-mono text-zinc-400">
                  {hud.recoveryCountdown}s
                </span>
              )}
            </div>
            <span
              className={`font-mono font-bold tabular-nums leading-none ${
                hud.health <= 30
                  ? 'text-red-400'
                  : hud.isRecoveringHealth
                    ? 'text-emerald-300'
                    : 'text-emerald-400'
              }`}
            >
              {hud.health}/{hud.maxHealth}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-900 rounded-sm overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                hud.health <= 30
                  ? 'bg-red-500'
                  : hud.isRecoveringHealth
                    ? 'bg-emerald-400'
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${(hud.health / hud.maxHealth) * 100}%` }}
            />
          </div>
        </div>

        <div className="h-0.5 bg-zinc-900 rounded-sm overflow-hidden">
          <div className="h-full bg-amber-400/80" style={{ width: `${hud.stamina}%` }} />
        </div>
      </div>

      {/* Editable Driving Camera Mode Toggle (Inner / Near / Outer / Far / Action) */}
      {hud.vehicle.inVehicle && !hud.victoryCelebration && onCycleVehicleCamera && (
        <button
          type="button"
          data-testid="vehicle-camera-toggle"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onCycleVehicleCamera();
          }}
          aria-label="Switch Driving Camera View"
          title="Switch Driving Camera (Inner / Near / Outer / Far / Action)"
          style={{
            left: `${(controlLayout.camera ?? DEFAULT_HUD_CONTROL_LAYOUT.camera).xPct}%`,
            top: `${(controlLayout.camera ?? DEFAULT_HUD_CONTROL_LAYOUT.camera).yPct}%`,
            transform: `translate(-50%, -50%) scale(${(controlLayout.camera ?? DEFAULT_HUD_CONTROL_LAYOUT.camera).scale * hudScale})`,
            opacity: hudOpacity,
          }}
          className="absolute z-20 pointer-events-auto touch-none min-h-[38px] px-3 rounded-full border border-sky-300/75 bg-zinc-950/90 hover:bg-sky-500 hover:text-zinc-950 text-sky-200 font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-lg transition-colors whitespace-nowrap"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>CAM: {hud.vehicle.cameraMode.toUpperCase()}</span>
        </button>
      )}

      {/* Contextual Enter (Green Door) / Exit (Red Door) */}
      {(hud.vehicle.inVehicle || hud.vehicle.nearbyVehicleId || hud.vehicle.nearbyHijackVehicle) &&
        !hud.victoryCelebration && (
          <div
            className={`absolute ${
              hud.vehicle.inVehicle ? 'bottom-[172px] right-3' : 'bottom-[106px] right-2'
            } z-20 pointer-events-auto flex items-center gap-2 origin-bottom-right`}
            style={{ transform: `scale(${hudScale})`, opacity: hudOpacity }}
          >

            <button
              type="button"
              data-testid="vehicle-door-toggle"
              aria-label={
                hud.vehicle.inVehicle
                  ? `Exit ${hud.vehicle.vehicleName || 'Vehicle'}`
                  : hud.vehicle.nearbyHijackVehicle
                    ? `Drive ${hud.vehicle.nearbyHijackVehicle.name}`
                    : `Drive ${hud.vehicle.nearbyVehicleName || 'Vehicle'}`
              }
              title={
                hud.vehicle.inVehicle
                  ? `Exit ${hud.vehicle.vehicleName || 'Vehicle'} [E]`
                  : `Drive ${hud.vehicle.nearbyVehicleName || hud.vehicle.nearbyHijackVehicle?.name || 'Vehicle'} [E]`
              }
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleVehicle();
              }}
              className={`touch-none w-11 h-11 rounded-xl border-2 flex items-center justify-center shadow-lg active:scale-95 transition-transform ${
                hud.vehicle.inVehicle
                  ? 'bg-red-600/95 hover:bg-red-500 border-red-200 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 border-emerald-200 text-zinc-950'
              }`}
            >
              {hud.vehicle.inVehicle ? (
                <DoorOpen className="w-5 h-5" />
              ) : (
                <DoorClosed className="w-5 h-5" />
              )}
            </button>
          </div>
        )}

      {/* Mansion Exclusive Smart Car Remote Key, Entry Gate Notice & Cockpit Push-Button Controls */}
      <MansionControlsOverlay
        hud={hud}
        hudScale={hudScale}
        hudOpacity={hudOpacity}
        onCarRemote={(action) => onMansionCarRemote?.(action)}
        onToggleDoors={() => onMansionToggleDoors?.()}
        onToggleWindow={(pane) => onMansionToggleWindow?.(pane)}
        onToggleHeadlights={() => onMansionToggleHeadlights?.()}
        onVehicleInput={onVehicleInput}
      />

      {/* Android Touch Driving Overlay (shown when inside a vehicle) */}
      {hud.vehicle.inVehicle && (
        <>

          {/* Left Touch Steering Wheel */}
          <div className="absolute bottom-11 left-3 z-20 flex flex-col items-center gap-1 pointer-events-auto touch-none select-none">
            <div
              role="slider"
              aria-label="Vehicle Steering Wheel"
              aria-valuemin={-100}
              aria-valuemax={100}
              aria-valuenow={Math.round(steerVisual * 100)}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                const rect = e.currentTarget.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                steerPointerRef.current = { id: e.pointerId, centerX };
                const norm = Math.max(-1, Math.min(1, (e.clientX - centerX) / 48));
                setSteerVisual(norm);
                onVehicleInput({ steer: norm });
              }}
              onPointerMove={(e) => {
                if (!steerPointerRef.current || steerPointerRef.current.id !== e.pointerId) return;
                e.stopPropagation();
                const norm = Math.max(
                  -1,
                  Math.min(1, (e.clientX - steerPointerRef.current.centerX) / 48),
                );
                setSteerVisual(norm);
                onVehicleInput({ steer: norm });
              }}
              onPointerUp={(e) => {
                if (!steerPointerRef.current || steerPointerRef.current.id !== e.pointerId) return;
                e.stopPropagation();
                steerPointerRef.current = null;
                setSteerVisual(0);
                onVehicleInput({ steer: 0 });
              }}
              onPointerCancel={(e) => {
                if (!steerPointerRef.current || steerPointerRef.current.id !== e.pointerId) return;
                e.stopPropagation();
                steerPointerRef.current = null;
                setSteerVisual(0);
                onVehicleInput({ steer: 0 });
              }}
              className="touch-none w-28 h-28 rounded-full bg-zinc-950/70 border border-white/20 shadow-2xl flex items-center justify-center relative cursor-grab active:cursor-grabbing"
            >
              <svg
                viewBox="0 0 100 100"
                className="w-24 h-24 drop-shadow-md transition-transform duration-75"
                style={{ transform: `rotate(${Math.round(steerVisual * 110)}deg)` }}
              >
                {/* Outer wheel rim */}
                <circle
                  cx="50"
                  cy="50"
                  r="41"
                  fill="none"
                  stroke="#18181b"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="41"
                  fill="none"
                  stroke="#52525b"
                  strokeWidth="7.5"
                />
                {/* Top-dead-center racing stripe */}
                <path
                  d="M 45 9 A 41 41 0 0 1 55 9"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="8.5"
                  strokeLinecap="round"
                />
                {/* Spokes */}
                <line x1="12" y1="50" x2="36" y2="50" stroke="#71717a" strokeWidth="7" strokeLinecap="round" />
                <line x1="64" y1="50" x2="88" y2="50" stroke="#71717a" strokeWidth="7" strokeLinecap="round" />
                <line x1="50" y1="62" x2="50" y2="88" stroke="#71717a" strokeWidth="7" strokeLinecap="round" />
                {/* Center Hub */}
                <circle cx="50" cy="50" r="15" fill="#09090b" stroke="#f59e0b" strokeWidth="2.5" />
                <circle cx="50" cy="50" r="5" fill="#f59e0b" />
              </svg>
            </div>
            <span className="font-mono text-[9px] font-semibold tracking-wider text-zinc-300 bg-zinc-950/75 px-2 py-0.5 rounded border border-white/10">
              STEER
            </span>
          </div>

          {/* Right Throttle / Reverse / Beep SOS / Helicopter / Mounted HMG Pads */}
          <div className="absolute bottom-14 right-3 z-20 flex items-end gap-2.5 pointer-events-auto touch-none">
            <div className="flex flex-col items-end gap-2">
              {(hud.vehicle.vehicleKind === 'apex_heli' ||
                hud.vehicle.vehicleKind === 'future_heli' ||
                hud.vehicle.vehicleKind === 'future_drone' ||
                hud.vehicle.vehicleKind === 'future_flying_car') && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="heli-desc-btn"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture?.(e.pointerId);
                      onVehicleInput({ descend: true });
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      onVehicleInput({ descend: false });
                    }}
                    onPointerCancel={(e) => {
                      e.stopPropagation();
                      onVehicleInput({ descend: false });
                    }}
                    className="touch-none h-10 px-2.5 rounded-full bg-zinc-900/90 active:bg-sky-500 border border-sky-400/60 text-sky-200 font-mono text-[10px] font-extrabold shadow-lg select-none"
                  >
                    DESC
                  </button>
                  <button
                    type="button"
                    data-testid="heli-asc-btn"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture?.(e.pointerId);
                      onVehicleInput({ ascend: true });
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      onVehicleInput({ ascend: false });
                    }}
                    onPointerCancel={(e) => {
                      e.stopPropagation();
                      onVehicleInput({ ascend: false });
                    }}
                    className="touch-none h-10 px-2.5 rounded-full bg-sky-500/90 active:bg-sky-400 border border-sky-200 text-zinc-950 font-mono text-[10px] font-extrabold shadow-lg select-none"
                  >
                    ASCEND
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                {onVehicleBeepSos && (
                  <button
                    type="button"
                    data-testid="vehicle-beep-sos"
                    aria-label="Vehicle Beep and 3x SOS Light Flash"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onVehicleBeepSos();
                    }}
                    className="touch-none h-11 px-3 rounded-full bg-zinc-950/90 hover:bg-zinc-900 active:scale-95 border border-amber-400/65 text-amber-300 font-mono text-[10px] font-extrabold shadow-lg select-none"
                  >
                    BEEP [H]
                  </button>
                )}

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    onVehicleInput({ throttle: -1 });
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    onVehicleInput({ throttle: 0 });
                  }}
                  onPointerCancel={(e) => {
                    e.stopPropagation();
                    onVehicleInput({ throttle: 0 });
                  }}
                  className="touch-none w-14 h-14 rounded-full bg-red-600/90 active:bg-red-500 border-2 border-red-300 text-white font-mono text-[11px] font-extrabold flex items-center justify-center shadow-lg select-none"
                >
                  REV
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2.5">
              {hud.vehicle.hasMountedGun && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    onTouchFire(true);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    onTouchFire(false);
                  }}
                  onPointerCancel={(e) => {
                    e.stopPropagation();
                    onTouchFire(false);
                  }}
                  onPointerLeave={(e) => {
                    e.stopPropagation();
                    onTouchFire(false);
                  }}
                  aria-label="Fire Mounted Machine Gun"
                  className="touch-none w-16 h-16 rounded-full bg-red-600/95 active:bg-amber-400 active:text-zinc-950 border-2 border-amber-300 text-white font-mono text-[10px] font-extrabold flex flex-col items-center justify-center gap-0.5 shadow-xl select-none"
                >
                  <Crosshair className="w-5 h-5" />
                  <span>MG FIRE</span>
                </button>
              )}

              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  onVehicleInput({ throttle: 1 });
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onVehicleInput({ throttle: 0 });
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  onVehicleInput({ throttle: 0 });
                }}
                className="touch-none w-16 h-16 rounded-full bg-amber-500 active:bg-amber-400 border-2 border-amber-200 text-zinc-950 font-mono text-xs font-extrabold flex items-center justify-center shadow-lg select-none"
              >
                GAS
              </button>
            </div>
          </div>
        </>
      )}

      {/* Contextual Cover Peek / Optic Magnification Pills (on foot only) */}
      {!hud.vehicle.inVehicle && (hud.isInCover || hud.canCycleZoom) && (
        <div
          className="absolute bottom-[68px] right-2 z-20 flex items-center gap-1.5 pointer-events-auto origin-bottom-right"
          style={{ transform: `scale(${hudScale})`, opacity: hudOpacity }}
        >
          {hud.isInCover && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCyclePeek();
              }}
              aria-label="Cover Peek"
              title="Cover Peek Left/Right"
              className={`touch-none h-8 px-2.5 rounded-full border font-mono text-[9px] font-bold transition-colors ${
                hud.coverPeekDir !== 0
                  ? 'bg-sky-500 text-zinc-950 border-sky-300'
                  : 'bg-zinc-950/88 border-sky-400/50 text-sky-300'
              }`}
            >
              {hud.coverPeekDir > 0 ? 'PEEK R' : hud.coverPeekDir < 0 ? 'PEEK L' : 'PEEK'}
            </button>
          )}
          {hud.canCycleZoom && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCycleZoom();
              }}
              aria-label="Cycle Optic Zoom"
              title="Cycle Optic Zoom"
              className="touch-none h-8 px-2.5 rounded-full bg-zinc-950/88 hover:bg-zinc-900 border border-sky-400/50 text-sky-300 font-mono text-[9.5px] font-bold flex items-center gap-0.5 transition-colors"
            >
              <ZoomIn className="w-3 h-3" />
              <span>{hud.activeZoomLabel}</span>
            </button>
          )}
        </div>
      )}

      {/* Customizable Individual Android Touch Action Controls (hidden while driving; Run/Slide/Jump hidden while seated) */}
      {!hud.vehicle.inVehicle && !hud.isBikeEjected && (
        <>
      {!hud.seatedChair && (
      <button
        type="button"
        data-testid="run-mode-toggle"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggleRunMode();
        }}
        aria-pressed={hud.runModeEnabled}
        aria-label={hud.runModeEnabled ? 'Disable Running Mode (Walk Only)' : 'Enable Running Mode'}
        title={hud.runModeEnabled ? 'Running Enabled — Tap to Walk Only' : 'Walking Only — Tap to Run'}
        className={`touch-none absolute z-20 pointer-events-auto h-9 px-3 rounded-full border font-mono text-[10px] font-extrabold flex items-center gap-1.5 shadow-lg transition-all active:scale-95 ${
          hud.runModeEnabled
            ? 'bg-emerald-500 text-zinc-950 border-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.5)]'
            : 'bg-zinc-950/88 hover:bg-zinc-900 text-zinc-200 border-white/25'
        }`}
        style={{
          left: `${controlLayout.move.xPct}%`,
          top: `calc(${controlLayout.move.yPct}% - ${Math.round(78 * controlLayout.move.scale * hudScale)}px)`,
          transform: `translate(-50%, -50%) scale(${Math.max(0.85, controlLayout.move.scale * hudScale)})`,
          opacity: hudOpacity,
        }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
          <circle cx="15" cy="4.5" r="2" />
          <path d="M13.2 8.2l-3.4 1.3-1.8 3.2 1.7.9 1.3-2.2 1.6-.6-1.4 4.1-3.9 1.6-2.3 3.7 1.8 1.1 2-3.1 3.7-1.5 2.4 2.7-.5 3.6h2.1l.7-4.5-2.6-2.9 1.1-3.1 1.9 1.9 2.6-.5v-2l-2 .3-2.3-2.4c-.5-.6-1.3-.9-2.1-.6z" />
        </svg>
        <span>{hud.runModeEnabled ? 'RUN ON' : 'RUN'}</span>
      </button>
      )}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (hud.grenades > 0) onThrowGrenade();
        }}
        aria-label="Throw Frag Grenade"
        title="Throw Frag Grenade"
        disabled={hud.grenades <= 0}
        className={`touch-none absolute z-20 pointer-events-auto w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
          hud.grenades > 0
            ? 'bg-zinc-950/85 hover:bg-zinc-900 border-white/25 text-zinc-100'
            : 'bg-zinc-950/50 border-white/10 text-zinc-600'
        }`}
        style={{
          left: `${controlLayout.grenade.xPct}%`,
          top: `${controlLayout.grenade.yPct}%`,
          transform: `translate(-50%, -50%) scale(${controlLayout.grenade.scale * hudScale})`,
          opacity: hudOpacity,
        }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 5h6M10 3h4v2h-4zM15 5l2 2" strokeLinecap="round" />
          <ellipse cx="12" cy="14" rx="5.5" ry="6.5" fill="currentColor" fillOpacity="0.2" />
          <path d="M7 12h10M7 16h10M12 8v12" strokeWidth="1.4" />
        </svg>
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-zinc-950 font-mono text-[8px] font-bold flex items-center justify-center">
          {hud.grenades}
        </span>
      </button>

      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onReload();
        }}
        aria-label="Reload Weapon"
        title="Reload Weapon"
        className="touch-none absolute z-20 pointer-events-auto w-10 h-10 rounded-full bg-zinc-950/85 hover:bg-zinc-900 border border-white/25 text-zinc-100 flex items-center justify-center transition-colors"
        style={{
          left: `${controlLayout.reload.xPct}%`,
          top: `${controlLayout.reload.yPct}%`,
          transform: `translate(-50%, -50%) scale(${controlLayout.reload.scale * hudScale})`,
          opacity: hudOpacity,
        }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
          <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 8v8" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      {!hud.seatedChair && (
      <>
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onSlide();
        }}
        aria-label="Tactical Slide"
        title="Tactical Slide"
        className={`touch-none absolute z-20 pointer-events-auto w-10 h-10 rounded-full border flex items-center justify-center transition-transform active:scale-95 ${
          hud.isSliding
            ? 'bg-amber-500 text-zinc-950 border-amber-300'
            : 'bg-zinc-950/85 hover:bg-zinc-900 border-amber-400/45 text-amber-300'
        }`}
        style={{
          left: `${controlLayout.slide.xPct}%`,
          top: `${controlLayout.slide.yPct}%`,
          transform: `translate(-50%, -50%) scale(${controlLayout.slide.scale * hudScale})`,
          opacity: hudOpacity,
        }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
          <path d="M3 15h5M2 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="13.5" cy="7.5" r="2" fill="currentColor" />
          <path
            d="M11 11.5l3.2 1.8 4.8-.6M10.5 14l-3 3.5h5.2l2.6-2.5"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggleAds();
        }}
        aria-label="Aim Down Sights"
        title="Aim Down Sights"
        className={`touch-none absolute z-20 pointer-events-auto w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
          hud.isAds
            ? 'bg-sky-500 text-zinc-950 border-sky-300'
            : 'bg-zinc-950/85 hover:bg-zinc-900 text-zinc-100 border-white/25'
        }`}
        style={{
          left: `${controlLayout.ads.xPct}%`,
          top: `${controlLayout.ads.yPct}%`,
          transform: `translate(-50%, -50%) scale(${controlLayout.ads.scale * hudScale})`,
          opacity: hudOpacity,
        }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.9">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onJump();
        }}
        aria-label="Jump"
        title="Jump"
        className="touch-none absolute z-20 pointer-events-auto w-11 h-11 rounded-full bg-zinc-950/85 hover:bg-zinc-900 active:scale-95 border border-white/30 text-white flex items-center justify-center transition-transform"
        style={{
          left: `${controlLayout.jump.xPct}%`,
          top: `${controlLayout.jump.yPct}%`,
          transform: `translate(-50%, -50%) scale(${controlLayout.jump.scale * hudScale})`,
          opacity: hudOpacity,
        }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
          <path
            d="M7 8l5-4 5 4"
            stroke="#fbbf24"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="10.5" r="2" fill="currentColor" />
          <path
            d="M8.5 14.5l3.5-1.8 3.5 1.8M10.2 13.5l-1.5 4.8M13.8 13.5l1.8 4.2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      </>
      )}

      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onTouchFire(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          onTouchFire(false);
        }}
        onPointerLeave={() => onTouchFire(false)}
        onPointerCancel={() => onTouchFire(false)}
        aria-label="Fire Weapon"
        title="Hold to Fire"
        className="touch-none absolute z-20 pointer-events-auto w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 border-2 border-amber-200 text-zinc-950 shadow-lg flex items-center justify-center transition-transform"
        style={{
          left: `${controlLayout.fire.xPct}%`,
          top: `${controlLayout.fire.yPct}%`,
          transform: `translate(-50%, -50%) scale(${controlLayout.fire.scale * hudScale})`,
          opacity: hudOpacity,
        }}
      >
        <svg viewBox="0 0 28 28" className="w-5 h-5" fill="none">
          <path
            d="M14 3.5c1.8 2.2 2.6 4.4 2.6 7.5v9.5h-5.2V11c0-3.1.8-5.3 2.6-7.5z"
            fill="currentColor"
          />
          <rect x="11.4" y="21.8" width="5.2" height="2.2" rx="0.6" fill="currentColor" />
          <path
            d="M7 9.5c1.1 1.4 1.6 2.9 1.6 4.9v6.1H5.4v-6.1c0-2 .5-3.5 1.6-4.9z"
            fill="currentColor"
            fillOpacity="0.72"
          />
          <path
            d="M21 9.5c1.1 1.4 1.6 2.9 1.6 4.9v6.1h-3.2v-6.1c0-2 .5-3.5 1.6-4.9z"
            fill="currentColor"
            fillOpacity="0.72"
          />
        </svg>
      </button>

      {/* Bottom-Right: Gun Switch Button, Scope Zoom, Fire Mode & Ammo Counter */}
      <div
        className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 origin-bottom-right"
        style={{ transform: `scale(${hudScale})`, opacity: hudOpacity }}
      >
        <div className="bg-zinc-950/90 border border-white/15 rounded-lg px-2 py-1 flex items-center gap-2 shadow-lg">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              {hud.canCycleZoom && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onCycleZoom();
                  }}
                  title="Cycle Optic Magnification"
                  className="touch-none pointer-events-auto px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-sky-400/45 text-[9px] font-mono font-bold text-sky-300 leading-none"
                >
                  {hud.activeZoomLabel}
                </button>
              )}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onCycleFireMode();
                }}
                disabled={!canSwitchFireMode}
                title="Switch Fire Mode"
                className={`touch-none pointer-events-auto flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-mono font-bold transition-colors leading-none ${
                  hud.activeFireMode === 'burst'
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300'
                    : canSwitchFireMode
                      ? 'bg-zinc-900 hover:bg-zinc-800 border-white/25 text-amber-300'
                      : 'bg-zinc-900/60 border-white/10 text-zinc-400'
                }`}
              >
                {hud.activeFireMode === 'burst' && (
                  <svg viewBox="0 0 18 12" className="w-2.5 h-2" fill="currentColor">
                    <path d="M3 1c1 1.3 1.4 2.6 1.4 4.4V11H1.6V5.4C1.6 3.6 2 2.3 3 1z" />
                    <path d="M9 1c1 1.3 1.4 2.6 1.4 4.4V11H7.6V5.4C7.6 3.6 8 2.3 9 1z" />
                    <path d="M15 1c1 1.3 1.4 2.6 1.4 4.4V11h-2.8V5.4c0-1.8.4-3.1 1.4-4.4z" />
                  </svg>
                )}
                <span>{fireModeLabel(hud.activeFireMode, hud.activeWeapon)}</span>
              </button>
            </div>

            {!isUnarmed ? (
              <div className="font-mono text-base font-bold text-white tabular-nums leading-none">
                <span
                  className={
                    outOfAmmo
                      ? 'text-red-500'
                      : mag <= Math.ceil(spec.magSize * 0.25)
                        ? 'text-amber-400'
                        : 'text-white'
                  }
                >
                  {mag}
                </span>
                <span className="text-[10px] text-zinc-400 ml-0.5">/{reserve}</span>
              </div>
            ) : (
              <div className="font-mono text-xs font-bold text-emerald-300 tracking-wider leading-none">
                HANDS FREE
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSwitchWeapon(isUnarmed ? lastArmedWeaponRef.current : 'unarmed')}
            aria-label={isUnarmed ? 'Equip Weapon' : 'Empty Hands'}
            title={isUnarmed ? 'Switch Back to Weapon' : 'Switch to Empty Hands'}
            className={`pointer-events-auto min-h-[44px] px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
              isUnarmed
                ? 'bg-emerald-500 text-zinc-950 border-emerald-300'
                : 'bg-zinc-900 hover:bg-zinc-800 border-emerald-400/45 text-emerald-200'
            }`}
          >
            <WeaponArt weaponId="unarmed" className="w-6 h-5 shrink-0" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
              {isUnarmed ? 'Armed' : 'Hands'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowWeaponPicker((prev) => !prev)}
            aria-label="Gun Switch"
            title="Open Weapon Selection Menu"
            className={`pointer-events-auto min-h-[44px] px-2.5 py-1 rounded-md border flex items-center gap-2 transition-colors ${
              showWeaponPicker
                ? 'bg-amber-500 text-zinc-950 border-amber-300'
                : 'bg-zinc-900 hover:bg-zinc-800 border-amber-400/50 text-white'
            }`}
          >
            <WeaponArt weaponId={hud.activeWeapon} className="w-12 h-5 shrink-0" />
            <div className="flex flex-col items-start leading-none">
              <span className="text-[8px] font-mono uppercase tracking-wider opacity-75">
                Gun Switch
              </span>
              <span className="text-[11px] font-bold tracking-wide mt-0.5">
                {spec.shortName}
              </span>
            </div>
            <Layers className="w-3.5 h-3.5 shrink-0 opacity-85" />
          </button>
        </div>
      </div>

      {/* Weapon Selection Modal Drawer */}
      {showWeaponPicker && (
        <div className="absolute inset-0 z-40 pointer-events-auto bg-zinc-950/75 flex items-center justify-center p-3">
          <div className="w-full max-w-4xl bg-zinc-950/96 border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-zinc-900/80">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-white">
                    Weapon Selection Menu
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400">
                    Equipped: {spec.name} ({spec.caliber})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWeaponPicker(false)}
                aria-label="Close Weapon Menu"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/10 overflow-x-auto bg-zinc-900/40">
              {(
                [
                  'ALL',
                  'Unarmed',
                  'Assault Rifle',
                  'Battle Rifle',
                  'SMG / PDW',
                  'LMG',
                  'Sniper',
                  'Shotgun',
                  'Sidearm',
                  'Launcher',
                ] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setWeaponCatFilter(cat)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-md border text-[10px] font-mono font-bold whitespace-nowrap transition-colors ${
                    weaponCatFilter === cat
                      ? 'bg-amber-500 text-zinc-950 border-amber-300'
                      : 'bg-zinc-900/90 text-zinc-300 border-white/15 hover:border-white/35'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 overflow-y-auto">
              {WEAPON_ORDER.filter(
                (wid) => weaponCatFilter === 'ALL' || WEAPONS[wid].category === weaponCatFilter,
              ).map((wid) => {
                const w = WEAPONS[wid];
                const isActive = hud.activeWeapon === wid;
                const wMag = hud.ammoInMag[wid];
                const wRes = hud.reserveAmmo[wid];
                const empty = wid !== 'unarmed' && wMag + wRes <= 0;
                const dmgPct = Math.min(100, Math.round((w.damage / 110) * 100));
                return (
                  <button
                    key={wid}
                    type="button"
                    onClick={() => {
                      onSwitchWeapon(wid);
                      setShowWeaponPicker(false);
                    }}
                    className={`min-h-[96px] p-2 rounded-lg border text-left flex flex-col justify-between transition-all active:scale-[0.98] ${
                      isActive
                        ? 'bg-amber-500/18 border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]'
                        : empty
                          ? 'bg-zinc-900/60 border-red-500/25 opacity-65'
                          : 'bg-zinc-900/85 border-white/12 hover:border-white/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 truncate">
                        {w.category}
                      </span>
                      <span
                        className={`text-[9.5px] font-mono font-bold tabular-nums ${
                          empty ? 'text-red-400' : isActive ? 'text-amber-300' : 'text-zinc-200'
                        }`}
                      >
                        {wid === 'unarmed' ? 'FREE' : `${wMag}/${wRes}`}
                      </span>
                    </div>

                    <div className="my-1 flex items-center justify-center">
                      <WeaponArt weaponId={wid} className="w-full h-9" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white truncate">{w.shortName}</span>
                        {isActive && (
                          <span className="text-[8px] font-mono font-bold uppercase text-amber-300">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-mono text-zinc-400 truncate">
                        {w.caliber}
                      </div>
                      <div className="mt-1 h-1 w-full rounded bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${dmgPct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
