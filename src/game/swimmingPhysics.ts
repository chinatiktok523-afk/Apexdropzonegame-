/**
 * Pure deterministic physics helpers for:
 * 1. Dynamic deep swimming pool & water buoyancy/diving/climb-out locomotion
 * 2. Speed-dependent exhaust silencer backfire flame colors (blue -> yellow -> red)
 * 3. Solid 2D OBB player-vs-parked-vehicle collision resolution
 */

export const MANSION_POOL_BOUNDS = {
  minX: 20,
  maxX: 52,
  minZ: -310,
  maxZ: -274,
  waterY: 0.25,
  deckY: 0.34,
} as const;

/**
 * Returns the sunken tiled floor Y inside the Mansion infinity pool (`-1.15m` shallow west entry
 * down to `-2.85m` deep east plunge), or `null` when `(x, z)` is outside the pool basin.
 */
export function getMansionPoolBedDepth(x: number, z: number): number | null {
  const { minX, maxX, minZ, maxZ } = MANSION_POOL_BOUNDS;
  if (x < minX || x > maxX || z < minZ || z > maxZ) return null;
  // Shallow shelf x=20..25 (-1.15m), sloped drop x=25..34 (-1.15m -> -2.85m), deep end x=34..52 (-2.85m)
  if (x <= 25) return -1.15;
  if (x >= 34) return -2.85;
  const t = (x - 25) / (34 - 25);
  return -1.15 + t * (-2.85 - -1.15);
}

export function isInsideMansionPool(x: number, z: number, margin = 0): boolean {
  const { minX, maxX, minZ, maxZ } = MANSION_POOL_BOUNDS;
  return x >= minX - margin && x <= maxX + margin && z >= minZ - margin && z <= maxZ + margin;
}

export interface SwimPhysicsState {
  y: number;
  vx: number;
  vy: number;
  vz: number;
  isSwimming: boolean;
}

export interface SwimPhysicsInput {
  moveDirX: number;
  moveDirZ: number;
  sprint: boolean;
  ascend: boolean;
  dive: boolean;
  floorY: number;
  waterY: number | null;
  nearPoolRim: boolean;
}

export interface SwimPhysicsStepResult {
  enteredWater: boolean;
  exitedWater: boolean;
  isUnderwater: boolean;
  climbOutTriggered: boolean;
  waterDepth: number;
}

/**
 * Advances vertical buoyancy, swim drag, diving & surface/rim climb-out cleanly without allocations.
 */
export function stepSwimmingPhysics(
  state: SwimPhysicsState,
  input: SwimPhysicsInput,
  dt: number,
): SwimPhysicsStepResult {
  const waterY = input.waterY;
  const waterDepth = waterY !== null ? Math.max(0, waterY - input.floorY) : 0;
  const canFloat = waterY !== null && waterDepth >= 0.85 && state.y <= waterY + 0.18;

  if (!canFloat || waterY === null) {
    const exitedWater = state.isSwimming;
    state.isSwimming = false;
    return {
      enteredWater: false,
      exitedWater,
      isUnderwater: false,
      climbOutTriggered: false,
      waterDepth,
    };
  }

  const enteredWater = !state.isSwimming;
  state.isSwimming = true;

  const swimSpeed = input.sprint ? 5.6 : 3.6;
  const targetVx = input.moveDirX * swimSpeed;
  const targetVz = input.moveDirZ * swimSpeed;
  const blend = Math.min(1, dt * 6.5);
  state.vx += (targetVx - state.vx) * blend;
  state.vz += (targetVz - state.vz) * blend;

  // Target surface chest-in-water float height (~1.12m below waterY so head/shoulders stay clearly above water)
  const floatAnchorY = Math.max(input.floorY + 0.05, waterY - 1.12);

  let climbOutTriggered = false;
  if (input.ascend) {
    if (input.nearPoolRim && state.y >= floatAnchorY - 0.35) {
      // Hop neatly up onto pool deck coping
      state.vy = 6.2;
      state.isSwimming = false;
      climbOutTriggered = true;
    } else {
      state.vy += (3.8 - state.vy) * Math.min(1, dt * 7.5);
    }
  } else if (input.dive) {
    state.vy += (-3.4 - state.vy) * Math.min(1, dt * 7.5);
  } else {
    // Natural buoyant spring toward surface waterline + gentle wave bobbing
    const offset = floatAnchorY - state.y;
    const springVel = Math.max(-2.8, Math.min(3.4, offset * 5.2));
    state.vy += (springVel - state.vy) * Math.min(1, dt * 5.5);
  }

  state.y += state.vy * dt;

  // Clamp within sunken basin floor and waterline surface unless climbing out
  if (!climbOutTriggered) {
    if (state.y < input.floorY + 0.05) {
      state.y = input.floorY + 0.05;
      if (state.vy < 0) state.vy = 0;
    }
    if (state.y > floatAnchorY + 0.14) {
      state.y = floatAnchorY + 0.14;
      if (state.vy > 0) state.vy = 0;
    }
  }

  const eyeY = state.y + 1.52;
  return {
    enteredWater,
    exitedWater: false,
    isUnderwater: eyeY < waterY,
    climbOutTriggered,
    waterDepth,
  };
}

/**
 * Returns exhaust silencer backfire flame hex color based on current vehicle speed:
 * - Low speed  (< 65 km/h): Electric Blue   (0x38bdf8)
 * - Mid speed  (65..114 km/h): Solar Yellow (0xfacc15)
 * - High speed (>= 115 km/h): Blazing Red   (0xef4444)
 */
export function getExhaustBackfireColorHex(speedKmh: number): number {
  const spd = Math.abs(speedKmh);
  if (spd < 65) return 0x38bdf8;
  if (spd < 115) return 0xfacc15;
  return 0xef4444;
}

/**
 * Pushes player `(px, py, pz)` smoothly outside a solid rotated vehicle OBB so the player cannot walk through cars.
 */
export function resolvePlayerAgainstVehicle(
  px: number,
  py: number,
  pz: number,
  playerRadius: number,
  playerHeight: number,
  vx: number,
  vy: number,
  vz: number,
  vYaw: number,
  bodyW: number,
  bodyL: number,
  bodyH = 1.95,
): { x: number; z: number; collided: boolean } {
  // Ignore when above/below vehicle vertical envelope so player can climb onto car roof if standing above
  if (py + playerHeight <= vy + 0.05 || py >= vy + bodyH - 0.18) {
    return { x: px, z: pz, collided: false };
  }

  const halfW = bodyW * 0.5 + 0.06;
  const halfL = bodyL * 0.5 + 0.06;
  const relX = px - vx;
  const relZ = pz - vz;

  // Quick broadphase circle skip
  const maxR = Math.hypot(halfW, halfL) + playerRadius;
  if (relX * relX + relZ * relZ > maxR * maxR) {
    return { x: px, z: pz, collided: false };
  }

  const cosY = Math.cos(vYaw);
  const sinY = Math.sin(vYaw);
  // Rotate world offset into vehicle local space (yaw rotates around +Y: inverse rotates by -yaw)
  const lx = relX * cosY - relZ * sinY;
  const lz = relX * sinY + relZ * cosY;

  const clampedX = Math.max(-halfW, Math.min(halfW, lx));
  const clampedZ = Math.max(-halfL, Math.min(halfL, lz));
  const dx = lx - clampedX;
  const dz = lz - clampedZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= playerRadius * playerRadius) {
    return { x: px, z: pz, collided: false };
  }

  let pushLx = 0;
  let pushLz = 0;
  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const push = playerRadius - dist;
    pushLx = (dx / dist) * push;
    pushLz = (dz / dist) * push;
  } else {
    const penL = Math.abs(lx + halfW);
    const penR = Math.abs(halfW - lx);
    const penF = Math.abs(lz + halfL);
    const penB = Math.abs(halfL - lz);
    const minP = Math.min(penL, penR, penF, penB);
    if (minP === penL) pushLx = -(penL + playerRadius);
    else if (minP === penR) pushLx = penR + playerRadius;
    else if (minP === penF) pushLz = -(penF + playerRadius);
    else pushLz = penB + playerRadius;
  }

  return {
    x: px + (pushLx * cosY + pushLz * sinY),
    z: pz + (-pushLx * sinY + pushLz * cosY),
    collided: true,
  };
}
