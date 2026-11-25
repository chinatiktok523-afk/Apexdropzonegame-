/**
 * Pure deterministic destruction, component damage, weapon balancing, crash physics,
 * and repair systems for the Futuristic AI Smart City robots, drones & autonomous machinery.
 *
 * Strictly zero Three.js / DOM / React dependencies so all progression stages, weapon
 * damage scaling, drone instability curves, and repair transitions run at 60fps and pass
 * fast node:test assertions.
 */

export type DestructionStage = 0 | 1 | 2 | 3 | 4 | 5;

export type SmartCityTargetKind = 'robot' | 'drone' | 'machine';

export type SmartCityComponentKind =
  | 'chassis'
  | 'head'
  | 'torso'
  | 'arm_l'
  | 'arm_r'
  | 'leg_l'
  | 'leg_r'
  | 'camera'
  | 'sensor'
  | 'motor'
  | 'rotor_0'
  | 'rotor_1'
  | 'rotor_2'
  | 'rotor_3'
  | 'battery'
  | 'wheel'
  | 'cab'
  | 'roller'
  | 'tool_arm'
  | 'armor';

export type SmartCityMaterialKind = 'metal' | 'glass' | 'composite' | 'rubber';

export interface WeaponDestructionProfile {
  weaponCategory: 'pistol' | 'smg' | 'rifle' | 'shotgun' | 'sniper' | 'heavy' | 'rocket';
  damageMultiplier: number;
  componentDamageMultiplier: number;
  sparkCount: number;
  shrapnelCount: number;
  particleScale: number;
  knockbackImpulse: number;
  craterScale: number;
}

export interface DestructibleEntityState {
  id: string;
  label: string;
  kind: SmartCityTargetKind;
  archetype: string;
  hp: number;
  maxHp: number;
  stage: DestructionStage;
  destroyed: boolean;
  disabled: boolean;
  speedMultiplier: number;
  limpAmplitude: number;
  smokeIntensity: number; // 0..1
  sparkIntensity: number; // 0..1
  lightsFlicker: boolean;
  lightsOff: boolean;
  flinchTimer: number;
  flinchDirX: number;
  flinchDirZ: number;
  flinchStrength: number;
  hitCount: number;
  lastHitComponent: SmartCityComponentKind;
  wreckAgeSec: number;
  componentHp: Record<string, number>;
  componentMaxHp: Record<string, number>;
  detachedComponents: SmartCityComponentKind[];
  // Drone crash simulation state
  droneFlightState: 'flying' | 'wobbling' | 'crashing' | 'crashed';
  crashVelX: number;
  crashVelY: number;
  crashVelZ: number;
  crashSpinRate: number;
  crashTiltX: number;
  crashTiltZ: number;
  brokenRotors: [boolean, boolean, boolean, boolean];
}

export interface BulletHitOutcome {
  appliedDamage: number;
  previousStage: DestructionStage;
  newStage: DestructionStage;
  stageChanged: boolean;
  newlyDetached: SmartCityComponentKind[];
  newlyDestroyed: boolean;
  justStartedCrashing: boolean;
  componentBroken: boolean;
  profile: WeaponDestructionProfile;
}

export function getWeaponDestructionProfile(
  weaponId: string,
): WeaponDestructionProfile {
  switch (weaponId) {
    case 'pistol':
      return {
        weaponCategory: 'pistol',
        damageMultiplier: 0.72,
        componentDamageMultiplier: 0.85,
        sparkCount: 5,
        shrapnelCount: 3,
        particleScale: 0.75,
        knockbackImpulse: 2.6,
        craterScale: 0.13,
      };
    case 'smg':
      return {
        weaponCategory: 'smg',
        damageMultiplier: 0.85,
        componentDamageMultiplier: 0.95,
        sparkCount: 6,
        shrapnelCount: 4,
        particleScale: 0.88,
        knockbackImpulse: 3.1,
        craterScale: 0.15,
      };
    case 'shotgun':
      return {
        weaponCategory: 'shotgun',
        damageMultiplier: 1.25,
        componentDamageMultiplier: 1.4,
        sparkCount: 11,
        shrapnelCount: 8,
        particleScale: 1.25,
        knockbackImpulse: 7.4,
        craterScale: 0.24,
      };
    case 'sniper':
      return {
        weaponCategory: 'sniper',
        damageMultiplier: 1.75,
        componentDamageMultiplier: 1.9,
        sparkCount: 15,
        shrapnelCount: 10,
        particleScale: 1.45,
        knockbackImpulse: 9.5,
        craterScale: 0.28,
      };
    case 'm249':
      return {
        weaponCategory: 'heavy',
        damageMultiplier: 1.32,
        componentDamageMultiplier: 1.45,
        sparkCount: 11,
        shrapnelCount: 7,
        particleScale: 1.22,
        knockbackImpulse: 6.4,
        craterScale: 0.22,
      };
    case 'rocket':
      return {
        weaponCategory: 'rocket',
        damageMultiplier: 2.25,
        componentDamageMultiplier: 2.5,
        sparkCount: 22,
        shrapnelCount: 16,
        particleScale: 1.85,
        knockbackImpulse: 14.5,
        craterScale: 0.36,
      };
    default:
      // rifles / ak47 / carbine / etc.
      return {
        weaponCategory: 'rifle',
        damageMultiplier: 1.05,
        componentDamageMultiplier: 1.15,
        sparkCount: 8,
        shrapnelCount: 5,
        particleScale: 1.0,
        knockbackImpulse: 4.4,
        craterScale: 0.18,
      };
  }
}

export function getComponentDamageMultiplier(component: SmartCityComponentKind): number {
  switch (component) {
    case 'head':
    case 'camera':
    case 'sensor':
      return 1.48;
    case 'battery':
    case 'motor':
      return 1.4;
    case 'rotor_0':
    case 'rotor_1':
    case 'rotor_2':
    case 'rotor_3':
      return 1.32;
    case 'arm_l':
    case 'arm_r':
    case 'leg_l':
    case 'leg_r':
    case 'tool_arm':
    case 'roller':
      return 1.15;
    case 'wheel':
    case 'cab':
      return 1.1;
    default:
      return 1.0;
  }
}

export function computeDestructionStage(hp: number, maxHp: number): DestructionStage {
  if (hp <= 0) return 5;
  const ratio = hp / Math.max(1, maxHp);
  if (ratio >= 0.999) return 0;
  if (ratio >= 0.75) return 1;
  if (ratio >= 0.5) return 2;
  if (ratio >= 0.25) return 3;
  return 4;
}

export function getStageLabel(stage: DestructionStage): string {
  switch (stage) {
    case 0:
      return 'INTACT';
    case 1:
      return 'MINOR DMG';
    case 2:
      return 'MODERATE DMG';
    case 3:
      return 'HEAVY DMG';
    case 4:
      return 'CRITICAL';
    case 5:
      return 'DESTROYED';
  }
}

function buildComponentPools(
  kind: SmartCityTargetKind,
  maxHp: number,
): Record<string, number> {
  if (kind === 'drone') {
    return {
      chassis: Math.round(maxHp * 0.75),
      rotor_0: Math.round(maxHp * 0.28),
      rotor_1: Math.round(maxHp * 0.28),
      rotor_2: Math.round(maxHp * 0.28),
      rotor_3: Math.round(maxHp * 0.28),
      camera: Math.round(maxHp * 0.3),
      battery: Math.round(maxHp * 0.35),
      motor: Math.round(maxHp * 0.35),
    };
  }
  if (kind === 'machine') {
    return {
      chassis: Math.round(maxHp * 0.85),
      cab: Math.round(maxHp * 0.4),
      wheel: Math.round(maxHp * 0.32),
      roller: Math.round(maxHp * 0.42),
      tool_arm: Math.round(maxHp * 0.4),
      sensor: Math.round(maxHp * 0.28),
      battery: Math.round(maxHp * 0.45),
    };
  }
  return {
    torso: Math.round(maxHp * 0.75),
    chassis: Math.round(maxHp * 0.75),
    head: Math.round(maxHp * 0.34),
    arm_l: Math.round(maxHp * 0.3),
    arm_r: Math.round(maxHp * 0.3),
    leg_l: Math.round(maxHp * 0.35),
    leg_r: Math.round(maxHp * 0.35),
    tool_arm: Math.round(maxHp * 0.36),
    camera: Math.round(maxHp * 0.25),
    sensor: Math.round(maxHp * 0.25),
    armor: Math.round(maxHp * 0.4),
    wheel: Math.round(maxHp * 0.3),
    battery: Math.round(maxHp * 0.35),
  };
}

export function createDestructibleEntity(
  id: string,
  label: string,
  kind: SmartCityTargetKind,
  archetype: string,
  maxHp: number,
): DestructibleEntityState {
  const compMax = buildComponentPools(kind, maxHp);
  return {
    id,
    label,
    kind,
    archetype,
    hp: maxHp,
    maxHp,
    stage: 0,
    destroyed: false,
    disabled: false,
    speedMultiplier: 1,
    limpAmplitude: 0,
    smokeIntensity: 0,
    sparkIntensity: 0,
    lightsFlicker: false,
    lightsOff: false,
    flinchTimer: 0,
    flinchDirX: 0,
    flinchDirZ: 1,
    flinchStrength: 0,
    hitCount: 0,
    lastHitComponent: 'chassis',
    wreckAgeSec: 0,
    componentHp: { ...compMax },
    componentMaxHp: { ...compMax },
    detachedComponents: [],
    droneFlightState: 'flying',
    crashVelX: 0,
    crashVelY: 0,
    crashVelZ: 0,
    crashSpinRate: 0,
    crashTiltX: 0,
    crashTiltZ: 0,
    brokenRotors: [false, false, false, false],
  };
}

function syncStageEffects(entity: DestructibleEntityState): void {
  const stage = entity.stage;
  if (stage === 0) {
    entity.speedMultiplier = 1;
    entity.limpAmplitude = 0;
    entity.smokeIntensity = 0;
    entity.sparkIntensity = 0;
    entity.lightsFlicker = false;
    entity.lightsOff = false;
    entity.disabled = false;
    entity.destroyed = false;
    return;
  }

  if (stage === 1) {
    entity.speedMultiplier = 0.94;
    entity.limpAmplitude = 0.08;
    entity.smokeIntensity = 0.08;
    entity.sparkIntensity = 0.25;
    entity.lightsFlicker = false;
    entity.lightsOff = false;
    entity.disabled = false;
  } else if (stage === 2) {
    entity.speedMultiplier = 0.66;
    entity.limpAmplitude = 0.25;
    entity.smokeIntensity = 0.38;
    entity.sparkIntensity = 0.45;
    entity.lightsFlicker = true;
    entity.lightsOff = false;
    entity.disabled = false;
  } else if (stage === 3) {
    entity.speedMultiplier = 0.36;
    entity.limpAmplitude = 0.65;
    entity.smokeIntensity = 0.72;
    entity.sparkIntensity = 0.8;
    entity.lightsFlicker = true;
    entity.lightsOff = false;
    entity.disabled = entity.kind === 'machine';
  } else if (stage === 4) {
    entity.speedMultiplier = 0;
    entity.limpAmplitude = 1.0;
    entity.smokeIntensity = 0.92;
    entity.sparkIntensity = 0.95;
    entity.lightsFlicker = true;
    entity.lightsOff = true;
    entity.disabled = true;
  } else {
    entity.speedMultiplier = 0;
    entity.limpAmplitude = 1.0;
    entity.smokeIntensity = 1.0;
    entity.sparkIntensity = 0.6;
    entity.lightsFlicker = false;
    entity.lightsOff = true;
    entity.disabled = true;
    entity.destroyed = true;
  }

  // Leg or wheel damage intensifies robot slowdown/limp even in stages 1-3
  if (
    entity.kind === 'robot' &&
    !entity.disabled &&
    (entity.detachedComponents.includes('leg_l') ||
      entity.detachedComponents.includes('leg_r') ||
      entity.detachedComponents.includes('wheel'))
  ) {
    entity.speedMultiplier = Math.min(entity.speedMultiplier, 0.34);
    entity.limpAmplitude = Math.max(entity.limpAmplitude, 0.75);
  }
}

function maybeDetach(
  entity: DestructibleEntityState,
  comp: SmartCityComponentKind,
  out: SmartCityComponentKind[],
): void {
  if (entity.detachedComponents.includes(comp)) return;
  entity.detachedComponents.push(comp);
  out.push(comp);
}

export function applyBulletDamage(
  entity: DestructibleEntityState,
  weaponId: string,
  baseDamage: number,
  component: SmartCityComponentKind,
  dirX = 0,
  dirZ = 1,
): BulletHitOutcome {
  const profile = getWeaponDestructionProfile(weaponId);
  const compMul = getComponentDamageMultiplier(component);
  const appliedDamage = Math.max(
    4,
    Math.round(baseDamage * profile.damageMultiplier * compMul),
  );
  const previousStage = entity.stage;
  const prevFlightState = entity.droneFlightState;
  const newlyDetached: SmartCityComponentKind[] = [];
  let componentBroken = false;

  if (!entity.destroyed) {
    entity.hp = Math.max(0, entity.hp - appliedDamage);
    entity.hitCount += 1;
    entity.lastHitComponent = component;
    entity.flinchTimer = 0.24;
    const dLen = Math.hypot(dirX, dirZ) || 1;
    entity.flinchDirX = dirX / dLen;
    entity.flinchDirZ = dirZ / dLen;
    entity.flinchStrength = Math.min(1.0, profile.knockbackImpulse / 9.0);

    if (component in entity.componentHp) {
      const prevCompHp = entity.componentHp[component];
      if (prevCompHp > 0) {
        const compDmg = Math.round(appliedDamage * profile.componentDamageMultiplier);
        entity.componentHp[component] = Math.max(0, prevCompHp - compDmg);
        if (entity.componentHp[component] === 0) {
          componentBroken = true;
          if (component !== 'chassis' && component !== 'torso') {
            maybeDetach(entity, component, newlyDetached);
          }
        }
      }
    }

    entity.stage = computeDestructionStage(entity.hp, entity.maxHp);

    // Stage-driven progressive detachments for dramatic realism
    if (entity.kind === 'robot') {
      if (entity.stage >= 3) {
        maybeDetach(entity, 'sensor', newlyDetached);
        maybeDetach(entity, 'armor', newlyDetached);
      }
      if (entity.stage >= 4) {
        maybeDetach(entity, 'arm_r', newlyDetached);
        maybeDetach(entity, 'tool_arm', newlyDetached);
      }
      if (entity.stage === 5) {
        maybeDetach(entity, 'head', newlyDetached);
        maybeDetach(entity, 'arm_l', newlyDetached);
        maybeDetach(entity, 'leg_l', newlyDetached);
        maybeDetach(entity, 'leg_r', newlyDetached);
      }
    } else if (entity.kind === 'drone') {
      if (component === 'rotor_0') entity.brokenRotors[0] = true;
      if (component === 'rotor_1') entity.brokenRotors[1] = true;
      if (component === 'rotor_2') entity.brokenRotors[2] = true;
      if (component === 'rotor_3') entity.brokenRotors[3] = true;

      if (entity.stage >= 2 && !entity.brokenRotors.some(Boolean)) {
        entity.brokenRotors[0] = true;
        maybeDetach(entity, 'rotor_0', newlyDetached);
      }
      if (entity.stage >= 3) {
        const brokenCount = entity.brokenRotors.filter(Boolean).length;
        if (brokenCount < 2) {
          const nextIdx = entity.brokenRotors.findIndex((b) => !b);
          if (nextIdx >= 0) {
            entity.brokenRotors[nextIdx] = true;
            maybeDetach(entity, (`rotor_${nextIdx}`) as SmartCityComponentKind, newlyDetached);
          }
        }
      }

      const brokenTotal = entity.brokenRotors.filter(Boolean).length;
      if (entity.hp <= 0 || brokenTotal >= 2 || entity.stage >= 4) {
        if (entity.droneFlightState !== 'crashing' && entity.droneFlightState !== 'crashed') {
          entity.droneFlightState = 'crashing';
          const spinSign = entity.hitCount % 2 === 0 ? 1 : -1;
          // Archetype-specific crash dynamics
          if (entity.archetype === 'security_surveillance') {
            entity.crashSpinRate = spinSign * 11.5;
            entity.crashVelX = entity.flinchDirX * 3.8;
            entity.crashVelZ = entity.flinchDirZ * 3.8;
          } else if (entity.archetype === 'delivery_drone') {
            entity.crashSpinRate = spinSign * 4.5;
            entity.crashVelX = entity.flinchDirX * 5.2;
            entity.crashVelZ = entity.flinchDirZ * 5.2;
          } else if (entity.archetype === 'ag_spraying' || entity.archetype === 'seed_distribution') {
            entity.crashSpinRate = spinSign * 6.8;
            entity.crashVelX = entity.flinchDirX * 4.2;
            entity.crashVelZ = entity.flinchDirZ * 4.2;
          } else {
            entity.crashSpinRate = spinSign * 8.4;
            entity.crashVelX = entity.flinchDirX * 3.2;
            entity.crashVelZ = entity.flinchDirZ * 3.2;
          }
          entity.crashVelY = Math.min(entity.crashVelY, -1.8);
        }
      } else if (entity.stage >= 2 || brokenTotal === 1) {
        if (entity.droneFlightState === 'flying') {
          entity.droneFlightState = 'wobbling';
        }
      }

      if (entity.hp === 0) {
        maybeDetach(entity, 'camera', newlyDetached);
        maybeDetach(entity, 'battery', newlyDetached);
      }
    } else if (entity.kind === 'machine') {
      if (entity.stage >= 3) {
        maybeDetach(entity, 'sensor', newlyDetached);
      }
      if (entity.stage >= 4) {
        maybeDetach(entity, 'tool_arm', newlyDetached);
      }
      if (entity.stage === 5) {
        maybeDetach(entity, 'wheel', newlyDetached);
        maybeDetach(entity, 'roller', newlyDetached);
      }
    }

    syncStageEffects(entity);
  }

  return {
    appliedDamage,
    previousStage,
    newStage: entity.stage,
    stageChanged: entity.stage !== previousStage,
    newlyDetached,
    newlyDestroyed: previousStage < 5 && entity.stage === 5,
    justStartedCrashing:
      prevFlightState !== 'crashing' && entity.droneFlightState === 'crashing',
    componentBroken,
    profile,
  };
}

export function stepDroneCrashPhysics(
  entity: DestructibleEntityState,
  curX: number,
  curY: number,
  curZ: number,
  groundY: number,
  dt: number,
): { x: number; y: number; z: number; impactedGround: boolean } {
  if (entity.droneFlightState !== 'crashing') {
    return { x: curX, y: curY, z: curZ, impactedGround: false };
  }
  const gravity = entity.archetype === 'delivery_drone' ? 14.5 : 11.8;
  entity.crashVelY -= gravity * dt;
  const nx = curX + entity.crashVelX * dt;
  const ny = curY + entity.crashVelY * dt;
  const nz = curZ + entity.crashVelZ * dt;
  entity.crashTiltX += dt * 2.4;
  entity.crashTiltZ += dt * 3.1;

  if (ny <= groundY + 0.36) {
    entity.droneFlightState = 'crashed';
    entity.hp = 0;
    entity.stage = 5;
    entity.brokenRotors = [true, true, true, true];
    syncStageEffects(entity);
    return { x: nx, y: groundY + 0.34, z: nz, impactedGround: true };
  }
  return { x: nx, y: ny, z: nz, impactedGround: false };
}

export function repairDestructibleEntity(entity: DestructibleEntityState): void {
  entity.hp = entity.maxHp;
  entity.stage = 0;
  entity.destroyed = false;
  entity.disabled = false;
  entity.speedMultiplier = 1;
  entity.limpAmplitude = 0;
  entity.smokeIntensity = 0;
  entity.sparkIntensity = 0;
  entity.lightsFlicker = false;
  entity.lightsOff = false;
  entity.flinchTimer = 0;
  entity.flinchStrength = 0;
  entity.hitCount = 0;
  entity.wreckAgeSec = 0;
  entity.detachedComponents = [];
  entity.droneFlightState = 'flying';
  entity.crashVelX = 0;
  entity.crashVelY = 0;
  entity.crashVelZ = 0;
  entity.crashSpinRate = 0;
  entity.crashTiltX = 0;
  entity.crashTiltZ = 0;
  entity.brokenRotors = [false, false, false, false];
  for (const key of Object.keys(entity.componentMaxHp)) {
    entity.componentHp[key] = entity.componentMaxHp[key];
  }
}

export function shouldStepDestructionPhysics(
  entityX: number,
  entityZ: number,
  cameraX: number,
  cameraZ: number,
  maxDist = 175,
): boolean {
  const dx = entityX - cameraX;
  const dz = entityZ - cameraZ;
  return dx * dx + dz * dz <= maxDist * maxDist;
}
