/**
 * Pure deterministic systems for the Apex Luxury 4-Level Mansion Estate,
 * proximity-sensor automatic gates/doors, smart car remote key, door-gated vehicle entry,
 * motorized car windows, and physical dashboard engine ignition.
 *
 * Kept strictly pure (zero DOM, zero Three.js, zero React) so it runs seamlessly in unit tests
 * and inside the 60fps Three.js game loop with zero GC allocations.
 */

import { getSmartCitySurfaceOffsetY, isInSmartCityZone } from './smartCitySystems';

export const MANSION_FLOOR_HEIGHT = 5.8;
export const MANSION_LEVEL_2_Y = 5.8;
export const MANSION_LEVEL_3_Y = 11.6;
export const MANSION_ROOF_Y = 17.4;

export const MANSION_PLOT_BOUNDS = {
  minX: -88,
  maxX: 88,
  minZ: -435,
  maxZ: -245,
} as const;

export const MANSION_BUILDING_BOUNDS = {
  minX: -44,
  maxX: 44,
  minZ: -388,
  maxZ: -324,
} as const;

export const MANSION_GARAGE_BOUNDS = {
  minX: -76,
  maxX: -46,
  minZ: -378,
  maxZ: -318,
} as const;

export const MANSION_DEFAULT_SPAWN = {
  id: 'sim_mansion',
  name: 'Apex Luxury Mansion',
  shortName: 'Luxury Mansion',
  subtitle: '4-Level Private Estate, Supercar Showroom & 3F DJ Party Club',
  x: 0,
  z: -274,
  viewYaw: 0, // Faces north (0 rad = -Z) directly toward the fountain, pool, showroom & 4-level mansion facade
} as const;

export type MansionCarDoorAction = 'unlock_open' | 'lock_close' | 'flash';

export interface MansionVehicleControlState {
  isMansionExclusive: boolean;
  isHelicopter: boolean;
  locked: boolean;
  engineRunning: boolean;
  engineStartTimer: number; // countdown during ignition crank before full run
  doorTargetL: number; // 0 = closed, 1 = open
  doorTargetR: number;
  doorOpenL: number;
  doorOpenR: number;
  windowTargetFL: number; // 0 = up (closed), 1 = down (open)
  windowTargetFR: number;
  windowTargetRL: number;
  windowTargetRR: number;
  windowOpenFL: number;
  windowOpenFR: number;
  windowOpenRL: number;
  windowOpenRR: number;
  headlightsOn: boolean;
  hazardFlashTimer: number;
  sosFlashTimer: number;
  rotorRpm: number;
}

export interface AxisCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export const MANSION_HELIPAD_COORDS = {
  id: 'mansion_helipad_pad',
  x: -24,
  z: -370,
  yaw: 0.4,
  deckY: MANSION_ROOF_Y + 0.22,
  label: 'Mansion 4F Rooftop Helipad',
} as const;

export const MANSION_HELIPAD_2_COORDS = {
  id: 'mansion_helipad_pad_2',
  x: 33,
  z: -377,
  yaw: -0.35,
  deckY: MANSION_ROOF_Y + 0.22,
  label: 'Mansion 4F East VIP Helipad',
} as const;

export const SPACEPORT_HELIPAD_COORDS = {
  id: 'spaceport_helipad_pad',
  x: -945,
  z: -225,
  yaw: 0.35,
  deckY: 0.30,
  label: 'Spaceport Helipad',
} as const;

export interface HelipadSpec {
  id: string;
  x: number;
  z: number;
  yaw: number;
  deckY: number;
  label: string;
}

export const HELICOPTER_PADS: readonly HelipadSpec[] = [
  MANSION_HELIPAD_COORDS,
  MANSION_HELIPAD_2_COORDS,
  SPACEPORT_HELIPAD_COORDS,
];

export function createDefaultMansionVehicleState(
  isMansionExclusive: boolean,
  isHelicopter = false,
): MansionVehicleControlState {
  return {
    isMansionExclusive,
    isHelicopter,
    locked: isMansionExclusive,
    engineRunning: !isMansionExclusive,
    engineStartTimer: 0,
    doorTargetL: 0,
    doorTargetR: 0,
    doorOpenL: 0,
    doorOpenR: 0,
    windowTargetFL: 0,
    windowTargetFR: 0,
    windowTargetRL: 0,
    windowTargetRR: 0,
    windowOpenFL: 0,
    windowOpenFR: 0,
    windowOpenRL: 0,
    windowOpenRR: 0,
    headlightsOn: !isMansionExclusive,
    hazardFlashTimer: 0,
    sosFlashTimer: 0,
    rotorRpm: 0,
  };
}

/** True if (x, z) is inside the private mansion estate compound (plus optional padding). */
export function isInsideMansionProperty(x: number, z: number, pad = 0): boolean {
  return (
    x >= MANSION_PLOT_BOUNDS.minX - pad &&
    x <= MANSION_PLOT_BOUNDS.maxX + pad &&
    z >= MANSION_PLOT_BOUNDS.minZ - pad &&
    z <= MANSION_PLOT_BOUNDS.maxZ + pad
  );
}

/** True when ground terrain bulge in the north & Smart City expansion must stay flat at y = 0. */
export function shouldFlattenNorthExpansion(x: number, z: number): boolean {
  if (x >= -142 && x <= 142 && z <= -205 && z >= -465) return true;
  if (x >= -268 && x <= 540 && z <= -264 && z >= -790) return true;
  return false;
}

/** Returns true if a horizon mountain peak / northern boulder would overlap the mansion or Smart City expansion. */
export function overlapsMansionHorizonCorridor(x: number, z: number): boolean {
  if (z >= -110) return false;
  if (x >= -135 && x <= 135 && z >= -465) return true;
  if (z <= -238 && z >= -850 && x >= -295 && x <= 575) return true;
  return isInSmartCityZone(x, z);
}

/**
 * Elevated architectural surface top-Y for paved roads, showroom floor, marble plinths, and helipads
 * so vehicle tires & helicopter skids sit flush on top of visual slabs without sinking.
 */
export function getVehicleSurfaceOffsetY(x: number, z: number, refY?: number): number {
  // Mansion 6 showroom marble plinths (top Y = 0.20)
  const plinthCoords: ReadonlyArray<[number, number]> = [
    [-69, -334],
    [-53, -334],
    [-69, -350],
    [-53, -350],
    [-69, -366],
    [-53, -366],
  ];
  for (let i = 0; i < plinthCoords.length; i++) {
    const [bx, bz] = plinthCoords[i];
    if (Math.abs(x - bx) <= 2.75 && Math.abs(z - bz) <= 4.15) {
      return 0.2;
    }
  }
  // Mansion 4F rooftop helipads only apply at rooftop altitude (prevents pulling ground vehicles up!)
  if (
    (refY === undefined || refY >= MANSION_ROOF_Y - 2.5) &&
    Math.hypot(x - MANSION_HELIPAD_COORDS.x, z - MANSION_HELIPAD_COORDS.z) <= 8.8
  ) {
    return MANSION_HELIPAD_COORDS.deckY;
  }
  if (
    (refY === undefined || refY >= MANSION_ROOF_Y - 2.5) &&
    Math.hypot(x - MANSION_HELIPAD_2_COORDS.x, z - MANSION_HELIPAD_2_COORDS.z) <= 7.6
  ) {
    return MANSION_HELIPAD_2_COORDS.deckY;
  }
  if (Math.hypot(x - SPACEPORT_HELIPAD_COORDS.x, z - SPACEPORT_HELIPAD_COORDS.z) <= 11.8) {
    return SPACEPORT_HELIPAD_COORDS.deckY;
  }
  // Mansion showroom floor & grand foyer promenade (top Y = 0.12)
  if (x >= -77 && x <= -45 && z >= -379 && z <= -317) return 0.12;
  if (x >= -46 && x <= 46 && z >= -326 && z <= -310) return 0.12;
  // Mansion west forecourt & showroom apron (top Y = 0.10)
  if (x >= -76 && x <= -8 && z >= -317 && z <= -293) return 0.1;
  // Mansion fountain plaza (top Y = 0.095)
  if (x >= -17 && x <= 17 && z >= -302 && z <= -274) return 0.095;
  // Mansion marble arrival driveway (top Y = 0.085)
  if (x >= -7 && x <= 7 && z >= -323 && z <= -245) return 0.085;
  // Mansion boulevard spur (top Y = 0.05)
  if (x >= -8 && x <= 8 && z >= -248 && z <= -205) return 0.05;

  // Central City N/S paved avenues (top Y = 0.094)
  if (
    z >= -265 &&
    z <= 265 &&
    (Math.abs(x - -140) <= 7.2 || Math.abs(x) <= 7.2 || Math.abs(x - 140) <= 7.2)
  ) {
    return 0.094;
  }
  // Central City E/W paved avenues (top Y = 0.078)
  if (
    x >= -268 &&
    x <= 220 &&
    (Math.abs(z - -140) <= 7.2 || Math.abs(z) <= 7.2 || Math.abs(z - 140) <= 7.2)
  ) {
    return 0.078;
  }
  // Outer collector ring ±208
  if (
    (Math.abs(Math.abs(x) - 208) <= 5.6 && Math.abs(z) <= 214) ||
    (Math.abs(Math.abs(z) - 208) <= 5.6 && Math.abs(x) <= 214)
  ) {
    return 0.085;
  }
  // Smart City avenues & walk-in facility aprons
  const smartCityY = getSmartCitySurfaceOffsetY(x, z);
  if (smartCityY > 0) return smartCityY;

  return 0;
}

/**
 * Smooth proximity-sensor door/gate state machine with hysteresis:
 * - Opens smoothly when player or driven vehicle enters `openRadius`
 * - Closes smoothly when distance exceeds `closeRadius`
 */
export function stepProximityPortal(
  currentOpen: number,
  distanceMeters: number,
  openRadius: number,
  closeRadius: number,
  dt: number,
  openSpeed = 1.45,
  closeSpeed = 1.15,
): { open: number; targetOpen: 0 | 1; colliderActive: boolean } {
  const shouldOpen = currentOpen > 0.2 ? distanceMeters <= closeRadius : distanceMeters <= openRadius;
  const target: 0 | 1 = shouldOpen ? 1 : 0;
  let next = currentOpen;
  if (target === 1 && next < 1) {
    next = Math.min(1, next + dt * openSpeed);
  } else if (target === 0 && next > 0) {
    next = Math.max(0, next - dt * closeSpeed);
  }
  return {
    open: next,
    targetOpen: target,
    colliderActive: next < 0.62,
  };
}

/** Car Remote Key HUD appears ONLY when walking near an unoccupied mansion car. */
export function canShowCarRemote(
  state: Pick<MansionVehicleControlState, 'isMansionExclusive' | 'isHelicopter'>,
  hasDriver: boolean,
  destroyed: boolean,
  distanceMeters: number,
  maxDistance = 8.5,
): boolean {
  if (destroyed || hasDriver) return false;
  if (!state.isMansionExclusive || state.isHelicopter) return false;
  return distanceMeters <= maxDistance;
}

/**
 * Door-state vehicle entry rule:
 * - Standard world cars can always be entered directly.
 * - Mansion supercars/SUVs require unlocking and opening the door first (`!locked && doorOpenL >= 0.55`).
 */
export function canEnterMansionVehicle(
  state: Pick<MansionVehicleControlState, 'isMansionExclusive' | 'isHelicopter' | 'locked' | 'doorOpenL'>,
): { allowed: boolean; reason: 'ok' | 'locked' | 'door_closed' } {
  if (!state.isMansionExclusive || state.isHelicopter) {
    return { allowed: true, reason: 'ok' };
  }
  if (state.locked) {
    return { allowed: false, reason: 'locked' };
  }
  if (state.doorOpenL < 0.55) {
    return { allowed: false, reason: 'door_closed' };
  }
  return { allowed: true, reason: 'ok' };
}

export const SOS_FLASH_DURATION_SEC = 1.5;

/** Triggers 3 crisp SOS front + rear light flashes and turns lights OFF afterward. */
export function triggerSosLightFlash(state: MansionVehicleControlState) {
  state.sosFlashTimer = SOS_FLASH_DURATION_SEC;
  state.headlightsOn = false;
}

/** Evaluates whether the 3-pulse SOS flash is active and whether lights are lit at the current instant. */
export function getSosPulseState(
  sosFlashTimer: number,
): { active: boolean; lit: boolean } {
  if (sosFlashTimer <= 0) return { active: false, lit: false };
  const elapsed = SOS_FLASH_DURATION_SEC - sosFlashTimer;
  // 3 clean flashes: [0..0.22], [0.44..0.66], [0.88..1.10], followed by OFF tail [1.10..1.50]
  const lit =
    (elapsed >= 0 && elapsed < 0.22) ||
    (elapsed >= 0.44 && elapsed < 0.66) ||
    (elapsed >= 0.88 && elapsed < 1.1);
  return { active: true, lit };
}

/** Applies smart Car Remote Key button actions to a mansion car's targets. */
export function applyCarRemoteAction(
  state: MansionVehicleControlState,
  action: MansionCarDoorAction,
): { unlocked: boolean; open: boolean; flashed: boolean } {
  if (!state.isMansionExclusive || state.isHelicopter) {
    if (action === 'flash') {
      triggerSosLightFlash(state);
      return { unlocked: !state.locked, open: state.doorOpenL > 0.5, flashed: true };
    }
    return { unlocked: !state.locked, open: state.doorOpenL > 0.5, flashed: false };
  }
  if (action === 'unlock_open') {
    state.locked = false;
    state.doorTargetL = 1;
    state.doorTargetR = 1;
    state.headlightsOn = true;
    state.sosFlashTimer = 0;
    state.hazardFlashTimer = 0.7;
    return { unlocked: true, open: true, flashed: true };
  }
  if (action === 'lock_close') {
    state.locked = true;
    state.doorTargetL = 0;
    state.doorTargetR = 0;
    state.headlightsOn = false;
    state.sosFlashTimer = 0;
    state.hazardFlashTimer = 0.5;
    return { unlocked: false, open: false, flashed: true };
  }
  triggerSosLightFlash(state);
  return { unlocked: !state.locked, open: state.doorTargetL > 0.5, flashed: true };
}

/** Toggles engine ignition via physical 3D cockpit button or [I] ignition switch. */
export function toggleVehicleEngineIgnition(state: MansionVehicleControlState): boolean {
  if (state.engineRunning || state.engineStartTimer > 0) {
    state.engineRunning = false;
    state.engineStartTimer = 0;
    state.headlightsOn = false;
    return false;
  }
  state.engineStartTimer = 1.05;
  state.headlightsOn = true;
  return true;
}

export function canVehicleMove(
  state: Pick<MansionVehicleControlState, 'isMansionExclusive' | 'engineRunning'>,
): boolean {
  if (!state.isMansionExclusive) return true;
  return state.engineRunning;
}

/** Advances door swing/scissor/gullwing, power window glass travel, SOS flash, and ignition crank. */
export function stepMansionVehicleMechanisms(state: MansionVehicleControlState, dt: number) {
  const doorRate = 5.4;
  const winRate = 3.2;

  state.doorOpenL += (state.doorTargetL - state.doorOpenL) * Math.min(1, dt * doorRate);
  if (Math.abs(state.doorTargetL - state.doorOpenL) < 0.005) state.doorOpenL = state.doorTargetL;

  state.doorOpenR += (state.doorTargetR - state.doorOpenR) * Math.min(1, dt * doorRate);
  if (Math.abs(state.doorTargetR - state.doorOpenR) < 0.005) state.doorOpenR = state.doorTargetR;

  const stepWin = (cur: number, tgt: number) => {
    const next = cur + (tgt - cur) * Math.min(1, dt * winRate);
    return Math.abs(tgt - next) < 0.005 ? tgt : next;
  };
  state.windowOpenFL = stepWin(state.windowOpenFL, state.windowTargetFL);
  state.windowOpenFR = stepWin(state.windowOpenFR, state.windowTargetFR);
  state.windowOpenRL = stepWin(state.windowOpenRL, state.windowTargetRL);
  state.windowOpenRR = stepWin(state.windowOpenRR, state.windowTargetRR);

  if (state.hazardFlashTimer > 0) {
    state.hazardFlashTimer = Math.max(0, state.hazardFlashTimer - dt);
  }
  if (state.sosFlashTimer > 0) {
    state.sosFlashTimer = Math.max(0, state.sosFlashTimer - dt);
    if (state.sosFlashTimer === 0) {
      state.headlightsOn = false;
    }
  }

  if (state.engineStartTimer > 0) {
    state.engineStartTimer = Math.max(0, state.engineStartTimer - dt);
    if (state.engineStartTimer === 0) {
      state.engineRunning = true;
    }
  }
}

export interface HelipadTrackerState {
  vacatedAtSec: Record<string, number | null>;
}

/**
 * Automatically respawns a fresh helicopter at a pad exactly 10 seconds after the pad's
 * helicopter is taken (driven away or moved > 8m from the pad).
 */
export function stepHelicopterPadRespawn(
  pads: readonly HelipadSpec[],
  activeHelis: ReadonlyArray<{ x: number; z: number; hasDriver: boolean; destroyed: boolean }>,
  tracker: HelipadTrackerState,
  dt: number,
  respawnDelaySec = 10.0,
): HelipadSpec[] {
  const ready: HelipadSpec[] = [];
  for (let i = 0; i < pads.length; i++) {
    const pad = pads[i];
    const hasIdleHeliOnPad = activeHelis.some(
      (h) => !h.destroyed && !h.hasDriver && Math.hypot(h.x - pad.x, h.z - pad.z) <= 8.0,
    );
    if (hasIdleHeliOnPad) {
      tracker.vacatedAtSec[pad.id] = null;
      continue;
    }
    const elapsed = (tracker.vacatedAtSec[pad.id] ?? 0) + Math.max(0, dt);
    if (elapsed >= respawnDelaySec) {
      tracker.vacatedAtSec[pad.id] = null;
      ready.push(pad);
    } else {
      tracker.vacatedAtSec[pad.id] = elapsed;
    }
  }
  return ready;
}

export interface EngineAudioProfile {
  sampleKey:
    | 'mansion_engine_1'
    | 'mansion_engine_2'
    | 'mansion_engine_3'
    | 'mansion_engine_tokyo'
    | 'helicopter_rotor';
  baseFreqHz: number;
  subRatio: number;
  idleGain: number;
  throttleGainBoost: number;
  idleRate: number;
  throttleRateBoost: number;
  filterBaseHz: number;
}

export function getEngineAudioProfile(vehicleKind: string): EngineAudioProfile {
  switch (vehicleKind) {
    case 'mansion_hyper_scissor':
    case 'revuelto_red':
    case 'lambo_blue_hyper':
      return {
        sampleKey: 'mansion_engine_1',
        baseFreqHz: 56,
        subRatio: 0.5,
        idleGain: 0.024,
        throttleGainBoost: 0.24,
        idleRate: 0.82,
        throttleRateBoost: 0.72,
        filterBaseHz: 240,
      };
    case 'mansion_ev_gt':
    case 'vision_silver':
    case 'gullwing_coupe':
      return {
        sampleKey: 'mansion_engine_tokyo',
        baseFreqHz: 68,
        subRatio: 0.5,
        idleGain: 0.02,
        throttleGainBoost: 0.22,
        idleRate: 0.88,
        throttleRateBoost: 0.78,
        filterBaseHz: 290,
      };
    case 'mansion_hummer_gold':
    case 'mansion_escalade_gull':
    case 'range_black_suv':
    case 'thar_black_4x4':
    case 'cyber_pickup':
    case 'cyber_gold':
      return {
        sampleKey: 'mansion_engine_2',
        baseFreqHz: 38,
        subRatio: 0.5,
        idleGain: 0.026,
        throttleGainBoost: 0.25,
        idleRate: 0.72,
        throttleRateBoost: 0.58,
        filterBaseHz: 155,
      };
    case 'mansion_escalade_dragon':
    case 'mansion_range_marble':
    case 'challenger_scissor':
    case 'stealth_hyper':
    case 'terzo_silver':
    case 'rolls_copper_gt':
      return {
        sampleKey: 'mansion_engine_3',
        baseFreqHz: 44,
        subRatio: 0.5,
        idleGain: 0.024,
        throttleGainBoost: 0.24,
        idleRate: 0.78,
        throttleRateBoost: 0.66,
        filterBaseHz: 185,
      };
    case 'apex_heli':
      return {
        sampleKey: 'helicopter_rotor',
        baseFreqHz: 32,
        subRatio: 0.45,
        idleGain: 0.045,
        throttleGainBoost: 0.24,
        idleRate: 0.88,
        throttleRateBoost: 0.36,
        filterBaseHz: 260,
      };
    default:
      return {
        sampleKey: 'mansion_engine_1',
        baseFreqHz: 50,
        subRatio: 0.5,
        idleGain: 0.022,
        throttleGainBoost: 0.22,
        idleRate: 0.8,
        throttleRateBoost: 0.65,
        filterBaseHz: 205,
      };
  }
}

/** Computes distinct, throttle-modulated engine loop targets (very low idle when stopped, dynamic intensity on gas). */
export function computeEngineAudioTargets(
  vehicleKind: string,
  speedKmh: number,
  throttle: number,
  airborne = false,
): {
  oscHz: number;
  subHz: number;
  filterHz: number;
  synthGain: number;
  sampleGain: number;
  playbackRate: number;
} {
  const prof = getEngineAudioProfile(vehicleKind);
  const absSpeed = Math.abs(speedKmh);
  const absThrottle = Math.max(0, Math.min(1, Math.abs(throttle)));
  const stoppedIdle = absSpeed < 1.8 && absThrottle < 0.05 && !airborne;

  const gasDrive = stoppedIdle ? 0 : Math.max(absThrottle, Math.min(0.65, absSpeed / 120));
  const speedFrac = Math.min(1, absSpeed / 145);

  const synthGain = stoppedIdle
    ? prof.idleGain * 0.65
    : prof.idleGain + gasDrive * 0.068 + speedFrac * 0.028;
  const sampleGain = stoppedIdle
    ? prof.idleGain * 1.15
    : prof.idleGain * 1.4 + absThrottle * prof.throttleGainBoost + speedFrac * 0.12;
  const playbackRate =
    prof.idleRate + absThrottle * prof.throttleRateBoost * 0.55 + speedFrac * prof.throttleRateBoost * 0.55;
  const oscHz = prof.baseFreqHz + absThrottle * 46 + speedFrac * 62 + (airborne ? 12 : 0);
  const filterHz = prof.filterBaseHz + absThrottle * 380 + absSpeed * 5.2;

  return {
    oscHz,
    subHz: oscHz * prof.subRatio,
    filterHz,
    synthGain,
    sampleGain,
    playbackRate,
  };
}

/**
 * Scales wire LED cross-sectional width/thickness by 10x for distant visibility while preserving strip length.
 */
export function computeWireLedScale(
  w: number,
  h: number,
  d: number,
): { w: number; h: number; d: number } {
  const scaleAxis = (val: number, maxAlongSpan: number): number => {
    if (val >= maxAlongSpan * 0.95 && val > 0.35) return val; // Preserve span length unchanged
    if (val <= 0.14) return val * 10;
    if (val <= 0.45) return val * 2.5;
    return val;
  };
  const maxSpan = Math.max(w, h, d);
  return {
    w: scaleAxis(w, maxSpan),
    h: scaleAxis(h, maxSpan),
    d: scaleAxis(d, maxSpan),
  };
}

/**
 * Computes source crop rectangle (`sx, sy, sw, sh`) for aspect-preserving cover fit (no trimming, no stretching).
 */
export function computeVideoCoverCrop(
  videoW: number,
  videoH: number,
  targetW: number,
  targetH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (videoW <= 0 || videoH <= 0 || targetW <= 0 || targetH <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, videoW), sh: Math.max(1, videoH) };
  }
  const srcAspect = videoW / videoH;
  const dstAspect = targetW / targetH;
  if (Math.abs(srcAspect - dstAspect) < 0.001) {
    return { sx: 0, sy: 0, sw: videoW, sh: videoH };
  }
  if (srcAspect > dstAspect) {
    // Source wider than target: crop left/right cleanly
    const sw = videoH * dstAspect;
    const sx = (videoW - sw) * 0.5;
    return { sx, sy: 0, sw, sh: videoH };
  }
  // Source taller than target (e.g. portrait video on landscape cinema/monitor): crop top/bottom cleanly
  const sh = videoW / dstAspect;
  const sy = (videoH - sh) * 0.5;
  return { sx: 0, sy, sw: videoW, sh };
}

/** Advances sequential video playlist index in a continuous endless loop. */
export function stepPlaylistIndex(currentIndex: number, totalItems: number): number {
  if (totalItems <= 1) return 0;
  return (Math.max(0, Math.floor(currentIndex)) + 1) % totalItems;
}

/** Computes spatial low-volume capped gain for world/car screens. */
export function computeScreenAudioGain(
  distanceMeters: number,
  maxRangeMeters: number,
  volumeCap = 0.14,
  muted = false,
): number {
  if (muted || volumeCap <= 0 || maxRangeMeters <= 0 || distanceMeters >= maxRangeMeters) return 0;
  const frac = Math.max(0, 1 - distanceMeters / maxRangeMeters);
  return Number((volumeCap * frac * frac).toFixed(4));
}

/** Rotates seated gaming chair smoothly in place (horizontal input only, zero translation). */
export function stepSeatedChairYaw(
  currentYaw: number,
  turnInputX: number,
  dt: number,
  turnSpeedRadPerSec = 2.1,
): number {
  if (Math.abs(turnInputX) <= 0.04 || dt <= 0) return currentYaw;
  return currentYaw - turnInputX * turnSpeedRadPerSec * dt;
}

/**
 * Cohesive Main Hall Lounge coordinates placing the Curved Luxury Sofa, Coffee Table,
 * and Giant Fluted-Walnut HDR TV Wall at a realistic ~7.25m home-cinema distance.
 */
export const MAIN_HALL_LOUNGE_LAYOUT = {
  sofaArcCenterX: 4.05,
  sofaZ: -341.0,
  sofaArcRadius: 4.4,
  sofaCenterSeatX: -0.35,
  sofaNorthSeatX: 0.8,
  sofaNorthSeatZ: -344.2,
  rugX: 3.2,
  rugZ: -341.0,
  coffeeTableX: 3.55,
  coffeeTableZ: -341.0,
  tvScreenX: 6.9,
  tvBezelX: 7.04,
  tvSlatsX: 7.12,
  tvMediaWallX: 7.4,
  tvInteractX: 5.5,
  tvZ: -341.0,
} as const;

export type VideoRotationDeg = 0 | 90 | -90 | 180;

/** Looks up per-video rotation override (supporting substring keys for relative/full URLs). */
export function getVideoRotationForUrl(
  url: string | null | undefined,
  overrides?: Record<string, VideoRotationDeg>,
): VideoRotationDeg {
  if (!url || !overrides) return 0;
  if (overrides[url] !== undefined) return overrides[url];
  for (const [pattern, deg] of Object.entries(overrides)) {
    if (pattern && url.includes(pattern)) return deg;
  }
  return 0;
}

/**
 * Computes draw dimensions & radians for aspect-preserving cover fit when a source video
 * needs 90/-90/180 orientation correction before rendering onto a display canvas.
 */
export function computeRotatedVideoDraw(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  rotateDeg: VideoRotationDeg = 0,
): { visW: number; visH: number; drawW: number; drawH: number; rad: number } {
  const safeSrcW = Math.max(1, srcW);
  const safeSrcH = Math.max(1, srcH);
  const safeDstW = Math.max(1, dstW);
  const safeDstH = Math.max(1, dstH);
  const swapped = rotateDeg === 90 || rotateDeg === -90;
  const visW = swapped ? safeSrcH : safeSrcW;
  const visH = swapped ? safeSrcW : safeSrcH;
  const scale = Math.max(safeDstW / visW, safeDstH / visH);
  return {
    visW,
    visH,
    drawW: safeSrcW * scale,
    drawH: safeSrcH * scale,
    rad: (rotateDeg * Math.PI) / 180,
  };
}

/** Advances DJ track index continuously in sequential order without trimming. */
export function stepDjTrackIndex(current: number, totalTracks = 2): number {
  if (totalTracks <= 1) return 0;
  return (Math.max(0, Math.floor(current)) + 1) % totalTracks;
}


