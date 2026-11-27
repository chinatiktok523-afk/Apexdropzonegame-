import * as THREE from 'three';
import { GraphicsQuality, MapId, type VehicleSpawnSpec } from '../types';
import { buildUnifiedSimulatorArena } from './unifiedSimulatorArena';
import type { SimulatorNpcManager } from './simulatorNpcs';
import { MaterialLibrary } from './models';
import { ProceduralTextureSet } from './textures';

export type { VehicleSpawnSpec };

export type SurfaceType = 'concrete' | 'metal' | 'wood' | 'dirt' | 'water' | 'sand';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
  cosY: number;
  sinY: number;
  surface: SurfaceType;
}

export interface RampSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  axis: 'x' | 'z';
  startCoord: number;
  endCoord: number;
  startY: number;
  endY: number;
}

export interface CoverNode {
  x: number;
  y: number;
  z: number;
  coverCenterX: number;
  coverCenterZ: number;
  occupiedBy: number | null;
}

export interface BarrelActor {
  id: number;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  tiltGroup?: THREE.Group;
  position: THREE.Vector3;
  exploded: boolean;
  health: number;
  radius?: number;
  maxDamage?: number;
  isBigExplosion?: boolean;
  kind?: 'drum' | 'petrol_pump';
  // Tip/fall & gasoline leak + ignition trail simulation
  bulletHits?: number;
  fallen?: boolean;
  tiltAngle?: number;
  tiltDirX?: number;
  tiltDirZ?: number;
  velX?: number;
  velY?: number;
  velZ?: number;
  rollAngle?: number;
  colliderRemoved?: boolean;
  leaking?: boolean;
  leakDirX?: number;
  leakDirZ?: number;
  leakHeight?: number;
  puddleRadius?: number;
  puddlePos?: THREE.Vector3;
  ignited?: boolean;
  fireProgress?: number;
  holeMesh?: THREE.Mesh;
  streamMesh?: THREE.Mesh;
  puddleMesh?: THREE.Mesh;
  fireMesh?: THREE.Mesh;
}

export interface SupplyCrateActor {
  id: number;
  group: THREE.Group;
  beacon: THREE.Mesh;
  position: THREE.Vector3;
  active: boolean;
  respawnTimer: number;
}

export interface DoorwayTrigger {
  x: number;
  z: number;
  inwardDirX: number;
  inwardDirZ: number;
  width: number;
  label: string;
}

export interface MansionSeatSpot {
  id: string;
  label: string;
  kind: 'gaming_chair' | 'sofa';
  x: number;
  y: number;
  z: number;
  yaw: number;
  canRotateChair: boolean;
  chairGroup?: THREE.Object3D;
  seatTag?: string;
  syncPosition?: () => void;
  exitTarget?: () => { x: number; y: number; z: number; yaw?: number };
}

export interface WorldInteractable {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  category: 'door' | 'refuel' | 'shop' | 'dine' | 'bike' | 'seat' | 'dashboard' | 'transit_door';
  getLabel: () => string;
  trigger: (ctx: {
    healPlayer: (hp: number, stamina: number) => void;
    refuelNearbyVehicle: () => string | null;
    cycleBikeStyle: () => string;
    movePlayerTo?: (x: number, y: number, z: number, yaw?: number) => void;
    unlockShowroomCar?: (
      kind: import('../types').VehicleKind,
      cost: number,
      spawnX: number,
      spawnZ: number,
      label: string,
    ) => string;
  }) => string;
}

export interface DayNightVisualTargets {
  skyDomeMat?: THREE.MeshBasicMaterial;
  skyDomeGeo?: THREE.BufferGeometry;
  cloudMat?: THREE.MeshBasicMaterial;
  streetLampMats: THREE.MeshBasicMaterial[];
  windowEmissiveMats: Array<THREE.MeshStandardMaterial | THREE.MeshLambertMaterial>;
  nightGlowMats?: Array<{ mat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial; nightHex: number; dayHex: number; nightIntensity: number }>;
  lodDetailGroups: {
    group: THREE.Group;
    x: number;
    z: number;
    maxDist: number;
    y?: number;
    radius?: number;
    tier?: 'district' | 'detail';
  }[];
}

export interface SpeedBoostPad {
  x: number;
  y: number;
  z: number;
  radius: number;
  boostSpeed: number;
  dirX?: number;
  dirZ?: number;
  label?: string;
  cooldownSec: number;
}

export interface StuntScoreRing {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  points: number;
  mesh: THREE.Object3D;
  cooldownSec: number;
}

export interface RaceCheckpointGate {
  index: number;
  x: number;
  z: number;
  radius: number;
  mesh: THREE.Mesh;
}

export interface RealisticEnvironmentTargets {
  skyDome?: import('./realisticWorld').AtmosphericSkyDome;
  waters?: import('./realisticWorld').RealisticWaterSystem[];
  grass?: import('./realisticWorld').InstancedGrassSystem | null;
  terrainSplats?: import('./realisticWorld').SplatTerrainController[];
}

export interface BreakableGlassPane {
  mesh: THREE.Mesh;
  broken: boolean;
  respawnTimer: number;
  cracked?: boolean;
  crackTimer?: number;
  origMaterial?: THREE.Material | THREE.Material[];
}

let sharedEnvCrackedGlassMat: THREE.MeshStandardMaterial | null = null;
function getEnvCrackedGlassMaterial(): THREE.MeshStandardMaterial {
  if (sharedEnvCrackedGlassMat) return sharedEnvCrackedGlassMat;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(186, 230, 253, 0.36)';
    ctx.fillRect(0, 0, 256, 256);
    const drawWeb = (cx: number, cy: number, rays: number) => {
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.94)';
      ctx.lineWidth = 2.0;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + (i % 2) * 0.14;
        const len = 58 + ((i * 29) % 52);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a + 0.09) * len * 0.5, cy + Math.sin(a + 0.09) * len * 0.5);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.lineWidth = 1.3;
      [16, 32, 54].forEach((r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });
    };
    drawWeb(108, 122, 13);
    drawWeb(176, 84, 9);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedEnvCrackedGlassMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    map: tex,
    roughness: 0.38,
    metalness: 0.25,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  return sharedEnvCrackedGlassMat;
}

export function hitBreakableGlassPane(pane: BreakableGlassPane, damage = 25): 'cracked' | 'shattered' | 'none' {
  if (pane.broken) return 'none';
  if (!pane.cracked && damage < 55) {
    pane.cracked = true;
    pane.crackTimer = 5.0;
    if (!pane.origMaterial) pane.origMaterial = pane.mesh.material;
    pane.mesh.material = getEnvCrackedGlassMaterial();
    return 'cracked';
  }
  pane.broken = true;
  pane.cracked = false;
  pane.crackTimer = 0;
  pane.respawnTimer = 5.0;
  pane.mesh.visible = false;
  if (pane.origMaterial) {
    pane.mesh.material = pane.origMaterial;
  }
  return 'shattered';
}

export function stepBreakableGlassPanes(panes: BreakableGlassPane[], dt: number): number {
  let restored = 0;
  for (let i = 0; i < panes.length; i++) {
    const p = panes[i];
    if (p.cracked && !p.broken) {
      p.crackTimer = (p.crackTimer ?? 5.0) - dt;
      if ((p.crackTimer ?? 0) <= 0) {
        p.cracked = false;
        p.crackTimer = 0;
        if (p.origMaterial) p.mesh.material = p.origMaterial;
        restored++;
      }
      continue;
    }
    if (!p.broken) continue;
    p.respawnTimer -= dt;
    if (p.respawnTimer <= 0) {
      p.broken = false;
      p.cracked = false;
      p.crackTimer = 0;
      p.respawnTimer = 0;
      if (p.origMaterial) p.mesh.material = p.origMaterial;
      p.mesh.visible = true;
      restored++;
    }
  }
  return restored;
}

export interface BuiltArena {
  arenaGroup: THREE.Group;
  colliders: ColliderBox[];
  dynamicColliders?: ColliderBox[];
  ramps: RampSurface[];
  coverNodes: CoverNode[];
  doorways: DoorwayTrigger[];
  barrels: BarrelActor[];
  shootableEnv: THREE.Object3D[];
  breakableGlass?: BreakableGlassPane[];
  displays?: import('./digitalDisplays').DigitalDisplayManager;
  shootableScreens?: THREE.Mesh[];
  wildlifeProps?: import('./worldWildlifeProps').WorldWildlifeController;
  supplyCrates: SupplyCrateActor[];
  clouds: THREE.Group[];
  groundHeightAt: (x: number, z: number, currentY?: number) => number;
  playableRadius: number;
  zoneCenter: { x: number; z: number };
  mapBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  interiorSpawns?: { x: number; y: number; z: number }[];
  vehicleSpawns?: VehicleSpawnSpec[];
  interactables?: WorldInteractable[];
  mansionSeats?: MansionSeatSpot[];
  boostPads?: SpeedBoostPad[];
  stuntRings?: StuntScoreRing[];
  raceCheckpoints?: RaceCheckpointGate[];
  dayNightTargets?: DayNightVisualTargets;
  realisticTargets?: RealisticEnvironmentTargets;
  npcManager?: SimulatorNpcManager;
  smartCity?: import('./smartCityWorld').SmartCityWorldController;
  smartCityTransit?: import('./smartCityTransit').SmartCityTransitController;
  scienceDistrict?: import('./scienceDistrictWorld').ScienceDistrictController;
  worldStreaming?: import('./worldStreaming').WorldStreamingController;
  updateMansionPortals?: (
    playerX: number,
    playerZ: number,
    drivenX: number | null,
    drivenZ: number | null,
    dt: number,
    extraActors?: ReadonlyArray<{ x: number; z: number }>,
  ) => void;
  update?: (dt: number, elapsed: number, cameraPos?: THREE.Vector3 | null, quality?: GraphicsQuality) => void;
  dispose: () => void;
}

export function getGroundHeightFn(
  ramps: RampSurface[] = [],
): (x: number, z: number, currentY?: number) => number {
  return (x: number, z: number, currentY?: number) => {
    let base = 0;

    const inExpanded = x >= -146 && x <= 186 && Math.abs(z) <= 126;

    if (!inExpanded) {
      const dx = x < -146 ? -146 - x : x > 186 ? x - 186 : 0;
      const dz = Math.max(0, Math.abs(z) - 126);
      const edgeDist = Math.hypot(dx, dz);
      base = -Math.min(2.8, edgeDist * 0.14);
    }

    for (let i = 0; i < ramps.length; i++) {
      const r = ramps[i];
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        const coord = r.axis === 'x' ? x : z;
        const rawSpan = r.endCoord - r.startCoord;
        const t =
          Math.abs(rawSpan) < 0.001
            ? 0
            : THREE.MathUtils.clamp((coord - r.startCoord) / rawSpan, 0, 1);
        const rampY = THREE.MathUtils.lerp(r.startY, r.endY, t);
        if (currentY !== undefined && rampY > currentY + 1.15) continue;
        if (rampY > base) base = rampY;
      }
    }

    return base;
  };
}

export function addCollider(
  colliders: ColliderBox[],
  cx: number,
  baseY: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  rotY = 0,
  surface: SurfaceType = 'concrete',
) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const absCos = Math.abs(cosY);
  const absSin = Math.abs(sinY);
  const halfW = (w * absCos + d * absSin) * 0.5;
  const halfD = (w * absSin + d * absCos) * 0.5;
  colliders.push({
    minX: cx - halfW,
    maxX: cx + halfW,
    minY: baseY,
    maxY: baseY + h,
    minZ: cz - halfD,
    maxZ: cz + halfD,
    cx,
    cz,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY,
    cosY,
    sinY,
    surface,
  });
}

export function resolveVehicleBoxCollider(
  x: number,
  z: number,
  baseY: number,
  radius: number,
  height: number,
  c: ColliderBox,
  out: { x: number; z: number; hitNormalX: number; hitNormalZ: number; collided: boolean },
): boolean {
  if (baseY > c.maxY - 0.3 || baseY + height < c.minY) return false;
  if (x + radius <= c.minX || x - radius >= c.maxX || z + radius <= c.minZ || z - radius >= c.maxZ) {
    return false;
  }
  if (Math.abs(c.rotY) > 0.001) {
    const relX = x - c.cx;
    const relZ = z - c.cz;
    const lx = relX * c.cosY - relZ * c.sinY;
    const lz = relX * c.sinY + relZ * c.cosY;
    const closestX = Math.max(-c.halfW, Math.min(c.halfW, lx));
    const closestZ = Math.max(-c.halfD, Math.min(c.halfD, lz));
    const dx = lx - closestX;
    const dz = lz - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) return false;

    let pushLx = 0;
    let pushLz = 0;
    const dist = Math.sqrt(distSq);
    if (dist > 0.0001) {
      const push = radius - dist;
      pushLx = (dx / dist) * push;
      pushLz = (dz / dist) * push;
    } else {
      const penL = Math.abs(lx + c.halfW);
      const penR = Math.abs(c.halfW - lx);
      const penB = Math.abs(lz + c.halfD);
      const penF = Math.abs(c.halfD - lz);
      const minP = Math.min(penL, penR, penB, penF);
      if (minP === penL) pushLx = -(penL + radius);
      else if (minP === penR) pushLx = penR + radius;
      else if (minP === penB) pushLz = -(penB + radius);
      else pushLz = penF + radius;
    }
    const wxPush = pushLx * c.cosY + pushLz * c.sinY;
    const wzPush = -pushLx * c.sinY + pushLz * c.cosY;
    out.x = x + wxPush;
    out.z = z + wzPush;
    const wLen = Math.hypot(wxPush, wzPush) || 1;
    out.hitNormalX = wxPush / wLen;
    out.hitNormalZ = wzPush / wLen;
    out.collided = true;
    return true;
  }

  const pushL = x + radius - c.minX;
  const pushR = c.maxX - (x - radius);
  const pushU = z + radius - c.minZ;
  const pushD = c.maxZ - (z - radius);
  const minP = Math.min(pushL, pushR, pushU, pushD);
  if (minP === pushL) {
    out.x = c.minX - radius;
    out.z = z;
    out.hitNormalX = -1;
    out.hitNormalZ = 0;
  } else if (minP === pushR) {
    out.x = c.maxX + radius;
    out.z = z;
    out.hitNormalX = 1;
    out.hitNormalZ = 0;
  } else if (minP === pushU) {
    out.x = x;
    out.z = c.minZ - radius;
    out.hitNormalX = 0;
    out.hitNormalZ = -1;
  } else {
    out.x = x;
    out.z = c.maxZ + radius;
    out.hitNormalX = 0;
    out.hitNormalZ = 1;
  }
  out.collided = true;
  return true;
}

let sharedGasolineMats: {
  holeMat: THREE.MeshBasicMaterial;
  streamMat: THREE.MeshStandardMaterial;
  puddleMat: THREE.MeshStandardMaterial;
  fireMat: THREE.MeshBasicMaterial;
  holeGeo: THREE.CircleGeometry;
  streamGeo: THREE.CylinderGeometry;
  puddleGeo: THREE.CircleGeometry;
  fireGeo: THREE.SphereGeometry;
} | null = null;

function getSharedGasolineFX() {
  if (sharedGasolineMats) return sharedGasolineMats;
  sharedGasolineMats = {
    holeMat: new THREE.MeshBasicMaterial({ color: 0x090b0f, side: THREE.DoubleSide }),
    streamMat: new THREE.MeshStandardMaterial({
      color: 0x2a1f0e,
      emissive: 0x3b2a10,
      emissiveIntensity: 0.25,
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.88,
    }),
    puddleMat: new THREE.MeshStandardMaterial({
      color: 0x1a1510,
      roughness: 0.08,
      metalness: 0.65,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
    fireMat: new THREE.MeshBasicMaterial({
      color: 0xff6b1a,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
    holeGeo: new THREE.CircleGeometry(0.055, 10),
    streamGeo: new THREE.CylinderGeometry(0.022, 0.042, 1.0, 7),
    puddleGeo: new THREE.CircleGeometry(1.0, 16),
    fireGeo: new THREE.SphereGeometry(0.28, 10, 8),
  };
  sharedGasolineMats.puddleGeo.rotateX(-Math.PI * 0.5);
  return sharedGasolineMats;
}

export function buildExplosiveBarrel(
  id: number,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
  geoms: THREE.BufferGeometry[],
  extraMats: THREE.Material[],
): {
  group: THREE.Group;
  tiltGroup: THREE.Group;
  hitMesh: THREE.Mesh;
  holeMesh: THREE.Mesh;
  streamMesh: THREE.Mesh;
  puddleMesh: THREE.Mesh;
  fireMesh: THREE.Mesh;
} {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // Tilt pivot centered at barrel mid-height (y = 0.625) for natural tip/roll physics
  const tiltGroup = new THREE.Group();
  tiltGroup.position.y = 0.625;
  group.add(tiltGroup);

  const drumMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.45,
    metalness: 0.55,
  });
  extraMats.push(drumMat);

  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.55,
    metalness: 0.2,
  });
  extraMats.push(bandMat);

  const drumGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.25, 16);
  geoms.push(drumGeo);
  const drum = new THREE.Mesh(drumGeo, drumMat);
  drum.userData.barrelId = id;
  tiltGroup.add(drum);

  const bandGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.22, 16);
  geoms.push(bandGeo);
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.y = 0.095;
  band.userData.barrelId = id;
  tiltGroup.add(band);

  const hoopGeo = new THREE.TorusGeometry(0.455, 0.025, 6, 16);
  hoopGeo.rotateX(Math.PI / 2);
  geoms.push(hoopGeo);
  [-0.375, 0.375, 0.605].forEach((hy) => {
    const hoop = new THREE.Mesh(hoopGeo, mats.steelTrim);
    hoop.position.y = hy;
    tiltGroup.add(hoop);
  });

  const fx = getSharedGasolineFX();
  const holeMesh = new THREE.Mesh(fx.holeGeo, fx.holeMat);
  holeMesh.visible = false;
  tiltGroup.add(holeMesh);

  const streamMesh = new THREE.Mesh(fx.streamGeo, fx.streamMat);
  streamMesh.visible = false;
  group.add(streamMesh);

  const puddleMesh = new THREE.Mesh(fx.puddleGeo, fx.puddleMat);
  puddleMesh.visible = false;
  group.add(puddleMesh);

  const fireMesh = new THREE.Mesh(fx.fireGeo, fx.fireMat);
  fireMesh.visible = false;
  group.add(fireMesh);

  tiltGroup.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== holeMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return { group, tiltGroup, hitMesh: drum, holeMesh, streamMesh, puddleMesh, fireMesh };
}

export function buildArena(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
  _mapId: MapId = 'simulator_city',
  graphicsQuality: GraphicsQuality = 'medium',
): BuiltArena {
  return buildUnifiedSimulatorArena(scene, textures, mats, isSoftwareGl, graphicsQuality);
}
