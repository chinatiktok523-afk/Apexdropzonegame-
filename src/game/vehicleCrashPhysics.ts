import * as THREE from 'three';

/**
 * Vehicle Crash Deformation & 3-Stage Hood Physics Controller
 * -----------------------------------------------------------
 * Lightweight, Android 60 FPS vehicle damage system supporting:
 *  1) One-shot Impact-Based Vertex Deformation clamped against restPositions
 *     (never runs per frame, never turns meshes inside out or clips the engine block).
 *  2) 3-Stage Damage Progression:
 *     - Stage 1 (Light Hit): Minor localized vertex denting + procedural scratch/scuff normalMap.
 *     - Stage 2 (Heavy Hit): Front hood latch breaks; lightweight spring-damper hinge at the
 *       windshield base makes the bonnet bounce/flap with vehicle speed and block interior view.
 *     - Stage 3 (Critical Hit): Rear windshield-base hinges snap; bonnet detaches into a pooled
 *       rigidbody that launches with vehicle momentum and despawns after 5.0 seconds.
 *  3) Zero-GC runtime updates & object pooling for detached bonnets.
 */

export const MAX_DEFORM_DEPTH = 0.28; // Hard cap (meters) preventing inside-out inversion / engine clipping
export const STAGE_1_DAMAGE_THRESHOLD = 18;
export const STAGE_2_DAMAGE_THRESHOLD = 48;
export const STAGE_3_DAMAGE_THRESHOLD = 82;
export const DETACHED_HOOD_DESPAWN_SEC = 5.0;
export const DETACHED_HOOD_POOL_SIZE = 12;

export type VehicleCrashStage = 0 | 1 | 2 | 3;

export interface DeformableMeshPart {
  mesh: THREE.Mesh;
  /** Original rest vertex XYZ coordinates so deformation depth is always strictly clamped */
  restPositions: Float32Array;
  /** Default front deformation radius (meters) */
  defaultRadius: number;
}

export interface VehicleCrashState {
  stage: VehicleCrashStage;
  damageAccum: number;
  hoodLatchBroken: boolean;
  hoodHingeBroken: boolean;
  /** Current hood opening angle (radians around windshield-base X hinge; negative tilts front edge up) */
  hoodAngle: number;
  /** Angular velocity of flapping hood (rad/s) */
  hoodVel: number;
  /** Pivot positioned strictly at the windshield base (-Z rear edge of hood) */
  hoodHingePivot: THREE.Group | null;
  /** Deformable hood mesh mounted inside hoodHingePivot */
  hoodMesh: THREE.Mesh | null;
  /** Dimensions used when spawning the pooled Stage-3 detached bonnet */
  hoodSize: [number, number, number];
  /** Per-vehicle paint material receiving the Stage-1 scratch/scuff normalMap */
  paintMaterial: THREE.MeshStandardMaterial | null;
  /** Front nose, bumper & hood deformable meshes */
  deformParts: DeformableMeshPart[];
}

export interface DetachedHoodSlot {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  vx: number;
  vy: number;
  vz: number;
  angVelX: number;
  angVelY: number;
  angVelZ: number;
  lifeLeft: number;
}

// Pre-allocated math scratch objects (zero heap allocations during collision/frame ticks)
const _invMatrix = new THREE.Matrix4();
const _invNormalMatrix = new THREE.Matrix3();
const _localImpactPt = new THREE.Vector3();
const _localImpactDir = new THREE.Vector3();
const _hoodWorldPos = new THREE.Vector3();
const _hoodWorldQuat = new THREE.Quaternion();
const _hoodScale = new THREE.Vector3();

let cachedScuffNormalMap: THREE.Texture | null = null;

/**
 * Generates and caches a procedural tangent-space scratch/scuff normal map texture.
 * Uses linear color space (`THREE.NoColorSpace`) as required for normal maps.
 * Includes a deterministic `DataTexture` fallback when executed outside a browser DOM (unit tests).
 */
export function getSharedScratchScuffNormalMap(): THREE.Texture {
  if (cachedScuffNormalMap) return cachedScuffNormalMap;

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Neutral tangent-space normal: RGB(128, 128, 255)
      ctx.fillStyle = 'rgb(128, 128, 255)';
      ctx.fillRect(0, 0, 256, 256);

      // Diagonal scrape ridges & micro-dents baked into normal channels
      for (let i = 0; i < 68; i++) {
        const x0 = (i * 47) % 256;
        const y0 = (i * 83) % 256;
        const len = 26 + ((i * 19) % 72);
        const ang = -0.35 + ((i % 7) - 3) * 0.14;
        const x1 = x0 + Math.cos(ang) * len;
        const y1 = y0 + Math.sin(ang) * len;

        // Upper bevel highlight normal
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(210, 95, 225, 0.78)' : 'rgba(65, 178, 225, 0.72)';
        ctx.lineWidth = 1.4 + (i % 3) * 0.7;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        // Adjacent shadow groove normal
        ctx.strokeStyle = 'rgba(85, 70, 215, 0.65)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x0 + 1.5, y0 + 2.0);
        ctx.lineTo(x1 + 1.5, y1 + 2.0);
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      cachedScuffNormalMap = tex;
      return tex;
    }
  }

  // Headless / Node unit test fallback DataTexture (tangent-space normal map)
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    const isScratch = (i + Math.floor(i / size)) % 5 === 0;
    data[idx] = isScratch ? 195 : 128;
    data[idx + 1] = isScratch ? 92 : 128;
    data[idx + 2] = 245;
    data[idx + 3] = 255;
  }
  const dt = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  dt.colorSpace = THREE.NoColorSpace;
  dt.wrapS = THREE.RepeatWrapping;
  dt.wrapT = THREE.RepeatWrapping;
  dt.needsUpdate = true;
  cachedScuffNormalMap = dt;
  return dt;
}

/**
 * Registers a mesh as impact-deformable and snapshots its rest vertex buffer.
 * Ensures the geometry is unique before cloning if needed.
 */
export function createDeformablePart(
  mesh: THREE.Mesh,
  defaultRadius = 0.95,
): DeformableMeshPart {
  const posAttr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const restPositions = new Float32Array(posAttr.array as ArrayLike<number>);
  return {
    mesh,
    restPositions,
    defaultRadius,
  };
}

/**
 * Creates a clean initial VehicleCrashState for a vehicle instance.
 */
export function createVehicleCrashState(opts: {
  hoodHingePivot?: THREE.Group | null;
  hoodMesh?: THREE.Mesh | null;
  hoodSize?: [number, number, number];
  paintMaterial?: THREE.MeshStandardMaterial | null;
  deformParts?: DeformableMeshPart[];
}): VehicleCrashState {
  return {
    stage: 0,
    damageAccum: 0,
    hoodLatchBroken: false,
    hoodHingeBroken: false,
    hoodAngle: 0,
    hoodVel: 0,
    hoodHingePivot: opts.hoodHingePivot ?? null,
    hoodMesh: opts.hoodMesh ?? null,
    hoodSize: opts.hoodSize ?? [1.75, 0.08, 1.4],
    paintMaterial: opts.paintMaterial ?? null,
    deformParts: opts.deformParts ?? [],
  };
}

/**
 * Applies a single collision-impulse dent to a deformable mesh part in LOCAL space.
 * Strictly caps vertex displacement from `restPositions` to `MAX_DEFORM_DEPTH` so
 * geometry never turns inside out or penetrates the recessed engine block.
 */
export function applyLocalImpactDeformation(
  part: DeformableMeshPart,
  localPoint: THREE.Vector3,
  localInwardDir: THREE.Vector3,
  forceScalar: number,
  radius = part.defaultRadius,
  maxDepth = MAX_DEFORM_DEPTH,
): number {
  const geom = part.mesh.geometry;
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!posAttr || radius <= 0.001 || forceScalar <= 0.001) return 0;

  const rSq = radius * radius;
  const arr = posAttr.array as Float32Array;
  const rest = part.restPositions;
  const count = posAttr.count;
  const maxDepthSq = maxDepth * maxDepth;
  const dirLen = localInwardDir.length() || 1;
  const dxDir = localInwardDir.x / dirLen;
  const dyDir = localInwardDir.y / dirLen;
  const dzDir = localInwardDir.z / dirLen;

  let modifiedCount = 0;
  let maxObservedDepth = 0;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const vx = arr[i3];
    const vy = arr[i3 + 1];
    const vz = arr[i3 + 2];

    const rx = vx - localPoint.x;
    const ry = vy - localPoint.y;
    const rz = vz - localPoint.z;
    const dSq = rx * rx + ry * ry + rz * rz;
    if (dSq >= rSq) continue;

    const dist = Math.sqrt(dSq);
    // Smooth cosine dent profile from center (1.0) to rim (0.0)
    const falloff = 0.5 * (1 + Math.cos((Math.PI * dist) / radius));
    const pushAmt = forceScalar * falloff;

    let nx = vx + dxDir * pushAmt;
    let ny = vy + dyDir * pushAmt;
    let nz = vz + dzDir * pushAmt;

    // Safeguard: Clamp total cumulative displacement relative to restPositions
    const ox = nx - rest[i3];
    const oy = ny - rest[i3 + 1];
    const oz = nz - rest[i3 + 2];
    const totalDispSq = ox * ox + oy * oy + oz * oz;
    if (totalDispSq > maxDepthSq) {
      const invScale = maxDepth / Math.sqrt(totalDispSq);
      nx = rest[i3] + ox * invScale;
      ny = rest[i3 + 1] + oy * invScale;
      nz = rest[i3 + 2] + oz * invScale;
      maxObservedDepth = Math.max(maxObservedDepth, maxDepth);
    } else {
      maxObservedDepth = Math.max(maxObservedDepth, Math.sqrt(totalDispSq));
    }

    arr[i3] = nx;
    arr[i3 + 1] = ny;
    arr[i3 + 2] = nz;
    modifiedCount++;
  }

  if (modifiedCount > 0) {
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
  }

  return maxObservedDepth;
}

/**
 * Pre-allocated pool of detached flying hoods (Android memory safeguard).
 * Avoids runtime allocations & guarantees deterministic 5.0s despawn.
 */
export class DetachedHoodPool {
  public readonly slots: DetachedHoodSlot[] = [];
  private readonly sharedGeo: THREE.BoxGeometry;

  constructor(private readonly scene: THREE.Scene, poolSize = DETACHED_HOOD_POOL_SIZE) {
    // Subdivided unit box scaled per-vehicle on spawn
    this.sharedGeo = new THREE.BoxGeometry(1, 1, 1, 4, 1, 4);
    for (let i = 0; i < poolSize; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1e222a,
        roughness: 0.28,
        metalness: 0.6,
        normalMap: getSharedScratchScuffNormalMap(),
        normalScale: new THREE.Vector2(0.75, 0.75),
      });
      const mesh = new THREE.Mesh(this.sharedGeo, mat);
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.slots.push({
        active: false,
        mesh,
        mat,
        vx: 0,
        vy: 0,
        vz: 0,
        angVelX: 0,
        angVelY: 0,
        angVelZ: 0,
        lifeLeft: 0,
      });
    }
  }

  /**
   * Launches a pooled detached bonnet with vehicle velocity & upward tumble momentum.
   * Automatically despawns after 5.0 seconds (`DETACHED_HOOD_DESPAWN_SEC`).
   */
  public spawn(
    worldPos: THREE.Vector3,
    worldQuat: THREE.Quaternion,
    size: [number, number, number],
    paintColorHex: number,
    vx: number,
    vy: number,
    vz: number,
  ): DetachedHoodSlot | null {
    // Recycle oldest slot if pool is full so zero allocations happen
    let slot = this.slots.find((s) => !s.active);
    if (!slot) {
      slot = this.slots.reduce((oldest, cur) => (cur.lifeLeft < oldest.lifeLeft ? cur : oldest), this.slots[0]);
    }
    if (!slot) return null;

    slot.active = true;
    slot.lifeLeft = DETACHED_HOOD_DESPAWN_SEC;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.angVelX = -4.8;
    slot.angVelY = 1.65;
    slot.angVelZ = 2.4;

    slot.mat.color.setHex(paintColorHex);
    slot.mesh.position.copy(worldPos);
    slot.mesh.quaternion.copy(worldQuat);
    slot.mesh.scale.set(size[0], size[1], size[2]);
    slot.mesh.visible = true;
    return slot;
  }

  /**
   * Lightweight pooled rigidbody step (gravity, ground bounce, 5.0s despawn).
   */
  public step(dt: number, groundHeightAt: (x: number, z: number, curY?: number) => number) {
    if (dt <= 0) return;
    const clampedDt = Math.min(dt, 0.05);
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (!s.active) continue;

      s.lifeLeft -= clampedDt;
      if (s.lifeLeft <= 0) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }

      s.vy -= 18.5 * clampedDt;
      s.mesh.position.x += s.vx * clampedDt;
      s.mesh.position.y += s.vy * clampedDt;
      s.mesh.position.z += s.vz * clampedDt;

      s.mesh.rotation.x += s.angVelX * clampedDt;
      s.mesh.rotation.y += s.angVelY * clampedDt;
      s.mesh.rotation.z += s.angVelZ * clampedDt;

      const gy = groundHeightAt(s.mesh.position.x, s.mesh.position.z, s.mesh.position.y);
      const minCenterY = gy + 0.08;
      if (s.mesh.position.y <= minCenterY) {
        s.mesh.position.y = minCenterY;
        if (s.vy < -1.8) {
          s.vy = -s.vy * 0.34;
        } else {
          s.vy = 0;
        }
        const damp = Math.max(0, 1 - 5.2 * clampedDt);
        s.vx *= damp;
        s.vz *= damp;
        s.angVelX *= damp;
        s.angVelY *= damp;
        s.angVelZ *= damp;
      }
    }
  }

  public clearAll() {
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].active = false;
      this.slots[i].mesh.visible = false;
      this.slots[i].lifeLeft = 0;
    }
  }

  public dispose() {
    this.clearAll();
    for (let i = 0; i < this.slots.length; i++) {
      this.scene.remove(this.slots[i].mesh);
      this.slots[i].mat.dispose();
    }
    this.sharedGeo.dispose();
    this.slots.length = 0;
  }
}

export interface CrashImpactSummary {
  stageChanged: boolean;
  newStage: VehicleCrashStage;
  detachedHood: boolean;
  shatterWindshield: boolean;
}

/**
 * Triggers a collision impact on a vehicle:
 * - Converts world impact point & direction into each deformable part's local coordinates ONCE.
 * - Advances 3-stage progression:
 *     Stage 1: Scratch/scuff normalMap + light vertex denting.
 *     Stage 2: Front hood latch breaks -> hinge flaps open from windshield base.
 *     Stage 3: Rear hinges snap -> bonnet detaches into DetachedHoodPool (5s despawn).
 */
export function applyVehicleCrashImpact(
  state: VehicleCrashState,
  worldImpactPoint: THREE.Vector3,
  worldImpactDir: THREE.Vector3,
  impactSpeedMs: number,
  vehicleVelocityWorld?: THREE.Vector3,
  detachedPool?: DetachedHoodPool | null,
): CrashImpactSummary {
  const prevStage = state.stage;
  // Scale damage sensibly from collision speed (8 m/s light bump .. 35 m/s critical crash)
  const damageDelta = Math.max(10, Math.min(58, impactSpeedMs * 1.95));
  state.damageAccum += damageDelta;

  let newStage: VehicleCrashStage = state.stage;
  if (state.damageAccum >= STAGE_3_DAMAGE_THRESHOLD) newStage = 3;
  else if (state.damageAccum >= STAGE_2_DAMAGE_THRESHOLD) newStage = 2;
  else if (state.damageAccum >= STAGE_1_DAMAGE_THRESHOLD) newStage = 1;
  state.stage = newStage;

  // Apply one-shot localized vertex deformation to front bumper & hood parts
  const dentForce = Math.min(0.14, Math.max(0.03, impactSpeedMs * 0.0042));
  for (let i = 0; i < state.deformParts.length; i++) {
    const part = state.deformParts[i];
    if (!part.mesh.visible) continue;
    part.mesh.updateWorldMatrix(true, false);
    _invMatrix.copy(part.mesh.matrixWorld).invert();
    _localImpactPt.copy(worldImpactPoint).applyMatrix4(_invMatrix);
    _invNormalMatrix.setFromMatrix4(_invMatrix);
    _localImpactDir.copy(worldImpactDir).applyMatrix3(_invNormalMatrix).normalize();
    applyLocalImpactDeformation(part, _localImpactPt, _localImpactDir, dentForce, part.defaultRadius, MAX_DEFORM_DEPTH);
  }

  // Stage 1: Attach scratch/scuff normal map onto paint material once
  if (newStage >= 1 && state.paintMaterial && !state.paintMaterial.normalMap) {
    state.paintMaterial.normalMap = getSharedScratchScuffNormalMap();
    state.paintMaterial.normalScale.set(0.65, 0.65);
    state.paintMaterial.roughness = Math.min(0.68, state.paintMaterial.roughness + 0.14);
    state.paintMaterial.needsUpdate = true;
  }

  // Stage 2: Break front hood latch -> jolt windshield-base hinge upward so it flaps
  if (newStage >= 2 && !state.hoodLatchBroken) {
    state.hoodLatchBroken = true;
    // Positive X rotation lifts the forward (-Z) bonnet tip upward from the windshield-base pivot
    state.hoodVel = Math.min(4.8, 1.8 + impactSpeedMs * 0.14);
    state.hoodAngle = Math.max(0.08, state.hoodAngle);
  }

  // Stage 3: Break rear windshield hinges -> detach hood rigidbody into object pool
  let detachedHood = false;
  if (newStage >= 3 && !state.hoodHingeBroken) {
    state.hoodHingeBroken = true;
    state.hoodLatchBroken = true;
    if (state.hoodMesh) {
      state.hoodMesh.updateWorldMatrix(true, false);
      state.hoodMesh.matrixWorld.decompose(_hoodWorldPos, _hoodWorldQuat, _hoodScale);
      state.hoodMesh.visible = false;
      detachedHood = true;

      if (detachedPool) {
        const vx = (vehicleVelocityWorld?.x ?? 0) * 0.55 + worldImpactDir.x * 2.8;
        const vy = 6.2 + Math.min(5.0, impactSpeedMs * 0.24);
        const vz = (vehicleVelocityWorld?.z ?? 0) * 0.55 + worldImpactDir.z * 2.8;
        const paintHex = state.paintMaterial ? state.paintMaterial.color.getHex() : 0x1e222a;
        detachedPool.spawn(_hoodWorldPos, _hoodWorldQuat, state.hoodSize, paintHex, vx, vy, vz);
      }
    }
  }

  return {
    stageChanged: newStage !== prevStage,
    newStage,
    detachedHood,
    shatterWindshield: newStage >= 2 && prevStage < 2,
  };
}

/**
 * Lightweight 1-DOF spring-damper hinge update for Stage-2 unlatched hoods.
 * Zero allocations; executes in O(1) time per vehicle.
 */
export function stepVehicleCrashPhysics(
  state: VehicleCrashState,
  speedMs: number,
  dt: number,
  elapsedSec?: number,
) {
  if (!state.hoodLatchBroken || state.hoodHingeBroken || !state.hoodHingePivot) return;
  const clampedDt = Math.min(dt, 0.05);
  if (clampedDt <= 0) return;

  // Higher forward airspeed pushes the unlatched hood wider open toward the windshield
  const absSpeed = Math.abs(speedMs);
  const speedRatio = Math.min(1, absSpeed / 28);
  const timeClock = elapsedSec !== undefined ? elapsedSec * 1000 : performance.now();
  const flutter = absSpeed > 2.5 ? Math.sin(timeClock * 0.022) * (0.04 + speedRatio * 0.14) : 0;
  // Positive X rotation lifts front (-Z) edge UP toward the driver's windshield
  const targetRestAngle = (0.14 + speedRatio * 0.72) + flutter;

  // Lightweight damped spring toward airflow rest angle
  const springK = 28.0;
  const damping = 5.4;
  const accel = (targetRestAngle - state.hoodAngle) * springK - state.hoodVel * damping;
  state.hoodVel += accel * clampedDt;
  state.hoodAngle += state.hoodVel * clampedDt;

  // Mechanical stop: closed (0.02 rad) to folded against windshield (+1.05 rad)
  if (state.hoodAngle < 0.02) {
    state.hoodAngle = 0.02;
    if (state.hoodVel < 0) state.hoodVel = -state.hoodVel * 0.25;
  } else if (state.hoodAngle > 1.05) {
    state.hoodAngle = 1.05;
    if (state.hoodVel > 0) state.hoodVel = -state.hoodVel * 0.3;
  }

  state.hoodHingePivot.rotation.x = state.hoodAngle;
}

/**
 * Restores a repaired vehicle back to factory pristine condition:
 * restores original vertex buffers, clears scratch normalMap, re-attaches/resets hood.
 */
export function resetVehicleCrashState(state: VehicleCrashState) {
  state.stage = 0;
  state.damageAccum = 0;
  state.hoodLatchBroken = false;
  state.hoodHingeBroken = false;
  state.hoodAngle = 0;
  state.hoodVel = 0;

  if (state.hoodHingePivot) {
    state.hoodHingePivot.rotation.x = 0;
  }
  if (state.hoodMesh) {
    state.hoodMesh.visible = true;
  }
  if (state.paintMaterial && state.paintMaterial.normalMap) {
    state.paintMaterial.normalMap = null;
    state.paintMaterial.needsUpdate = true;
  }
  for (let i = 0; i < state.deformParts.length; i++) {
    const part = state.deformParts[i];
    const posAttr = part.mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (posAttr) {
      const arr = posAttr.array as Float32Array;
      arr.set(part.restPositions);
      posAttr.needsUpdate = true;
      part.mesh.geometry.computeVertexNormals();
      part.mesh.geometry.computeBoundingSphere();
    }
  }
}
