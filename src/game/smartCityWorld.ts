import * as THREE from 'three';
import { addCollider, type ColliderBox, type WorldInteractable } from './arena';
import { registerBreakableGlass, type CityPalette, type SimWorldBuildContext } from './buildingsAndTransit';
import { createPropPbrMaterials, PropMeshAssembler, addRoadMarkingsBatch } from './urbanProps';
import { stepProximityPortal } from './mansionSystems';
import {
  getStageLabel,
  stepDroneCrashPhysics,
  type BulletHitOutcome,
  type DestructibleEntityState,
  type SmartCityComponentKind,
  type SmartCityTargetKind,
} from './smartCityDestruction';
import {
  SmartCityDestructionEffectsPool,
  tagDestructibleMesh,
  type SmartCityHitTargetMeta,
} from './smartCityDestructionVisuals';
import { soundEngine } from './audio';
import {
  applySmartCityCommand,
  createInitialSmartCityState,
  damageSmartCityTarget,
  DRONE_FLEET_CATALOG,
  getStageStatusTag,
  repairAllSmartCityUnits,
  ROBOT_ROLE_CATALOG,
  SMART_CITY_CONTROL_TERMINALS,
  SMART_CITY_DOME,
  SMART_CITY_GATES,
  SMART_CITY_REPAIR_STATIONS,
  SMART_CITY_SINGLE_ROAD_POINTS,
  stepSmartCityState,
  type RobotRoleSpec,
  type SmartCityCommand,
  type SmartCityGateSpec,
  type SmartCitySimulationState,
} from './smartCitySystems';

export interface SmartCityAimTargetInfo {
  label: string;
  kind: SmartCityTargetKind;
  hp: number;
  maxHp: number;
  stage: number;
  stageLabel: string;
  component: string;
}

export interface SmartCityBulletImpactResult {
  hit: boolean;
  outcome?: BulletHitOutcome;
  kind?: SmartCityTargetKind;
  component?: SmartCityComponentKind;
  label?: string;
}

export interface SmartCityWorldController {
  root: THREE.Group;
  getState: () => SmartCitySimulationState;
  getShootableMeshes: () => THREE.Object3D[];
  getAimTargetInfo: (obj: THREE.Object3D | null | undefined) => SmartCityAimTargetInfo | null;
  handleBulletHit: (
    obj: THREE.Object3D,
    point: THREE.Vector3,
    normal: THREE.Vector3,
    rayDir: THREE.Vector3,
    weaponId: string,
    baseDamage: number,
  ) => SmartCityBulletImpactResult;
  handleExplosion: (center: THREE.Vector3, radius: number, maxDamage: number) => boolean;
  repairAll: () => number;
  applyCommand: (cmd: SmartCityCommand) => void;
  update: (
    dt: number,
    elapsed: number,
    nightFactor: number,
    daylightFactor: number,
    playerPos: THREE.Vector3,
    vehiclePos?: THREE.Vector3 | null,
    cameraPos?: THREE.Vector3 | null,
    extraActors?: ReadonlyArray<{ x: number; z: number }>,
  ) => void;
  dispose: () => void;
}

interface AnimatedRobotVisual {
  root: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  accMat: THREE.MeshStandardMaterial;
  baseColorHex: number;
  baseAccentHex: number;
  torsoGroup?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  head?: THREE.Object3D;
  toolBoom?: THREE.Object3D;
  sensorMount?: THREE.Object3D;
  armorPlates?: THREE.Object3D;
  sprayCone?: THREE.Mesh;
  collapseProgress: number;
  collapseDir: number;
}

interface AnimatedDroneVisual {
  root: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  stripeMat: THREE.MeshStandardMaterial;
  rotors: THREE.Object3D[];
  camPod?: THREE.Object3D;
  mistCone?: THREE.Mesh;
}

interface AutonomousFieldMachine {
  idIndex: number;
  root: THREE.Group;
  waypoints: ReadonlyArray<{ x: number; z: number }>;
  speed: number;
  segIdx: number;
  progress: number;
  headerRoller?: THREE.Object3D;
  toolArm?: THREE.Object3D;
  wheelMeshes: THREE.Object3D[];
}

interface AutonomousCityShuttle {
  idIndex: number;
  root: THREE.Group;
  waypoints: ReadonlyArray<{ x: number; z: number }>;
  forward: boolean;
  speed: number;
  segIdx: number;
  progress: number;
  wheelMeshes: THREE.Object3D[];
}

interface RoboticArmUnit {
  idIndex: number;
  pivot: THREE.Object3D;
  headTip?: THREE.Object3D;
  basePhase: number;
}

interface DomeGateRuntime {
  spec: SmartCityGateSpec;
  leftLeaf: THREE.Group;
  rightLeaf: THREE.Group;
  leftPiston: THREE.Mesh;
  rightPiston: THREE.Mesh;
  ledBarMat: THREE.MeshBasicMaterial;
  leftCollider: ColliderBox;
  rightCollider: ColliderBox;
  openProgress: number;
  prevTargetOpen: 0 | 1;
}

function addBox(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  opts?: { rotY?: number; rotX?: number; rotZ?: number; castShadow?: boolean },
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  if (opts?.rotY) m.rotation.y = opts.rotY;
  if (opts?.rotX) m.rotation.x = opts.rotX;
  if (opts?.rotZ) m.rotation.z = opts.rotZ;
  m.castShadow = opts?.castShadow ?? false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function makeSignTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  accentHex: string,
  w = 512,
  h = 128,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  c.fillStyle = bgHex;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = accentHex;
  c.lineWidth = 6;
  c.strokeRect(4, 4, w - 8, h - 8);
  c.textAlign = 'center';
  c.fillStyle = '#ffffff';
  c.font = `bold ${h > 100 ? 34 : 24}px sans-serif`;
  c.fillText(title, w * 0.5, h * 0.48);
  c.fillStyle = accentHex;
  c.font = `bold ${h > 100 ? 18 : 14}px monospace`;
  c.fillText(subtitle, w * 0.5, h * 0.78);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMeterTexture(valueStr: string, unitStr: string, textHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#071018';
  c.fillRect(0, 0, 128, 64);
  c.strokeStyle = textHex;
  c.lineWidth = 3;
  c.strokeRect(2, 2, 124, 60);
  c.textAlign = 'center';
  c.fillStyle = textHex;
  c.font = 'bold 30px monospace';
  c.fillText(valueStr, 64, 38);
  c.fillStyle = '#94a3b8';
  c.font = 'bold 11px monospace';
  c.fillText(unitStr, 64, 54);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMarbleVeinedTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#f3f5f8';
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = 'rgba(148, 163, 184, 0.34)';
  c.lineWidth = 2.5;
  for (let i = 0; i < 14; i++) {
    c.beginPath();
    c.moveTo(0, (i * 22) % 256);
    c.bezierCurveTo(80, ((i * 37) % 240) + 8, 175, ((i * 53) % 240) + 8, 256, ((i * 19 + 40) % 256));
    c.stroke();
  }
  c.strokeStyle = 'rgba(203, 213, 225, 0.45)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {
    c.beginPath();
    c.moveTo((i * 29) % 256, 0);
    c.bezierCurveTo((i * 41) % 256, 90, (i * 67) % 256, 170, (i * 33) % 256, 256);
    c.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const _tmpV0 = new THREE.Vector3();
const _tmpV1 = new THREE.Vector3();
const _tmpMid = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();
const _upY = new THREE.Vector3(0, 1, 0);
const _tmpDummy = new THREE.Object3D();

export function buildSmartCityWorld(
  ctx: SimWorldBuildContext,
  cityPal: CityPalette,
  groundHeightAt: (x: number, z: number, y?: number) => number,
  onOpenDashboard?: (terminalLabel: string) => void,
): SmartCityWorldController {
  const state = createInitialSmartCityState();
  const root = new THREE.Group();
  root.name = 'SmartCityGlassDomeMegaProjectRoot';
  ctx.arenaGroup.add(root);
  ctx.lodDetailGroups.push({
    group: root,
    x: SMART_CITY_DOME.centerX,
    y: 36,
    z: SMART_CITY_DOME.centerZ,
    radius: 175,
    maxDist: 480,
    tier: 'district',
  });

  const localGeos: THREE.BufferGeometry[] = [];
  const localMats: THREE.Material[] = [];
  const localTexs: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    localGeos.push(g);
    ctx.geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    localMats.push(m);
    ctx.materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    localTexs.push(t);
    return t;
  };

  // Pooled 3D particle/debris/bullet-mark destruction FX engine
  const effectsPool = new SmartCityDestructionEffectsPool(root, groundHeightAt);
  const shootableMeshes: THREE.Object3D[] = [];

  // Shared PBR Materials
  const boxGeo = cityPal.boxGeo;
  const cylGeo = cityPal.cylGeo;
  const sphereGeo = trackGeo(new THREE.SphereGeometry(0.5, 10, 8));
  const coneGeo = trackGeo(new THREE.ConeGeometry(0.5, 1.0, 10));

  const whiteRobotMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.35 }));
  const darkJointMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.65 }));
  const cyanGlowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x06b6d4, emissiveIntensity: 1.5, roughness: 0.2 }),
  );
  const purpleGrowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe879f9, emissive: 0xc026d3, emissiveIntensity: 1.4, roughness: 0.25 }),
  );
  const solarPanelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f2744, roughness: 0.18, metalness: 0.72 }),
  );
  const solarFrameMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.32, metalness: 0.7 }),
  );
  const greenhouseGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.12,
      metalness: 0.18,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
    }),
  );
  const hydroTankMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.42, metalness: 0.25 }));
  const pvcPipeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.15 }));
  const soilMulchMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.92 }));
  const sprayMistMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  const tomatoRedMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.38 }));
  const cropLeafMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.62 }));
  const lettuceDeepMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 }));
  const wheatGoldMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.72 }));
  const woodCrateMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 }));
  const metalAlloyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.32, metalness: 0.78 }));
  const yellowBotMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.45 }));
  const securityBeaconMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 1.4, roughness: 0.2 }),
  );
  const factoryBeltMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 }));
  const repairPadGlowMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 1.35, roughness: 0.22 }),
  );
  const streetLampBulbMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xe0f2fe }));
  ctx.streetLampMats.push(streetLampBulbMat);
  const smartGlassFacadeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x164e63,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.28,
      roughness: 0.28,
      metalness: 0.58,
    }),
  );
  ctx.windowEmissiveMats.push(smartGlassFacadeMat);

  // =========================================================================
  // 1. ONE CONTINUOUS EXPLORATION ROAD (Garage -> Wall Opening -> Gate 1 -> Dome Tour -> Gate 2 -> Outer Nature)
  // =========================================================================
  const roadPts = SMART_CITY_SINGLE_ROAD_POINTS;
  const scMarkings: Parameters<typeof addRoadMarkingsBatch>[1] = [];
  const lampPb = new PropMeshAssembler();

  for (let i = 0; i < roadPts.length - 1; i++) {
    const a = roadPts[i];
    const b = roadPts[i + 1];
    const cx = (a.x + b.x) * 0.5;
    const cz = (a.z + b.z) * 0.5;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);

    // Raised paved pedestrian shoulder slab, side curbs & elevated obsidian asphalt single exploration road (top Y = 0.22m)
    addBox(root, boxGeo, cityPal.concreteDeck, cx, 0.04, cz, 13.4, 0.24, len + 4.4, { rotY: yaw });
    addBox(root, boxGeo, cityPal.slateAsphalt, cx, 0.09, cz, 9.8, 0.26, len + 2.8, { rotY: yaw });

    // Raised crisp side curbs framing both sides of the elevated connecting road
    const nxCurb = Math.cos(yaw);
    const nzCurb = -Math.sin(yaw);
    addBox(root, boxGeo, cityPal.whiteMarble, cx - nxCurb * 5.15, 0.17, cz - nzCurb * 5.15, 0.42, 0.14, len + 1.4, { rotY: yaw });
    addBox(root, boxGeo, cityPal.whiteMarble, cx + nxCurb * 5.15, 0.17, cz + nzCurb * 5.15, 0.42, 0.14, len + 1.4, { rotY: yaw });

    // Rounded joint disc at every bend so the single exploration road flows seamlessly without gaps
    addBox(root, cylGeo, cityPal.concreteDeck, b.x, 0.042, b.z, 13.6, 0.24, 13.6);
    addBox(root, cylGeo, cityPal.slateAsphalt, b.x, 0.092, b.z, 10.2, 0.26, 10.2);

    scMarkings.push({
      kind: 'dash_line',
      x1: a.x,
      z1: a.z,
      x2: b.x,
      z2: b.z,
      color: i === 0 || i >= roadPts.length - 2 ? 0x38bdf8 : 0xfacc15,
    });

    // Sleek LED Streetlights along road shoulder outside the Mansion wall & gate openings
    if (len > 18) {
      const steps = Math.max(1, Math.floor(len / 28));
      const nx = Math.cos(yaw);
      const nz = -Math.sin(yaw);
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const lx = a.x + dx * t + nx * 6.0;
        const lz = a.z + dz * t + nz * 6.0;
        lampPb.addCylinder(0.1, 0.14, 5.8, 8, lx, 2.9, lz, 0x334155, 'glossy');
        lampPb.addBox(lx - nx * 0.75, 5.8, lz - nz * 0.75, 1.55, 0.12, 0.18, 0x334155, 'glossy', yaw);
        addBox(root, boxGeo, streetLampBulbMat, lx - nx * 1.25, 5.7, lz - nz * 1.25, 0.75, 0.1, 0.34, { rotY: yaw });
      }
    }
  }
  scMarkings.push({ kind: 'crosswalk', x: -107.2, z: -447.8, rotY: 0.392 });
  scMarkings.push({ kind: 'crosswalk', x: -146, z: -648, rotY: 0 });
  addRoadMarkingsBatch(root, scMarkings, groundHeightAt, ctx.geometries, ctx.materials);

  const lampPropMats = createPropPbrMaterials(false);
  const lampBuilt = lampPb.compile(lampPropMats, { castShadow: false, receiveShadow: true });
  root.add(lampBuilt.group);
  ctx.geometries.push(...lampBuilt.geometries);
  ctx.materials.push(...lampPropMats.all, ...lampBuilt.materials);

  // Consolidating Dome Central Plaza Floor Deck (subtle modern architectural circle pad under city center)
  addBox(root, cylGeo, cityPal.concreteDeck, SMART_CITY_DOME.centerX, -0.055, SMART_CITY_DOME.centerZ, 128, 0.12, 128);

  // =========================================================================
  // 2. BIGGEST GEODESIC GLASS & SOLAR DOME + CURVED ENTRY ARCHES + LARGE SLENDER 3D WHITE MARBLE ARCHES
  // =========================================================================
  {
    const dcX = SMART_CITY_DOME.centerX;
    const dcZ = SMART_CITY_DOME.centerZ;
    const domeR = SMART_CITY_DOME.radius; // 116m
    const domeH = SMART_CITY_DOME.height; // 74m
    const hScale = domeH / domeR;

    const domeGroup = new THREE.Group();
    domeGroup.position.set(dcX, 0, dcZ);
    root.add(domeGroup);

    // Reference geodesic sphere subdivided into crisp triangles + Pentagonal Solar Clusters
    const icoRaw = new THREE.IcosahedronGeometry(domeR, 3);
    const ico = icoRaw.index ? icoRaw.toNonIndexed() : icoRaw;
    const pos = ico.attributes.position;

    // 12 canonical icosahedron vertices normalized to pick pentagonal solar panel star clusters
    const pentRef = new THREE.IcosahedronGeometry(1, 0);
    const pentPosAttr = pentRef.attributes.position;
    const pentNodes: THREE.Vector3[] = [];
    for (let i = 0; i < pentPosAttr.count; i++) {
      const p = new THREE.Vector3(pentPosAttr.getX(i), pentPosAttr.getY(i), pentPosAttr.getZ(i)).normalize();
      if (p.y > 0.12 && !pentNodes.some((q) => q.distanceToSquared(p) < 0.01)) {
        pentNodes.push(p);
      }
    }
    pentRef.dispose();

    const glassVerts: number[] = [];
    const solarVerts: number[] = [];
    const edgeSet = new Set<string>();
    const edgePairs: Array<[THREE.Vector3, THREE.Vector3]> = [];

    const registerEdge = (p1: THREE.Vector3, p2: THREE.Vector3) => {
      const k1 = `${p1.x.toFixed(1)},${p1.y.toFixed(1)},${p1.z.toFixed(1)}`;
      const k2 = `${p2.x.toFixed(1)},${p2.y.toFixed(1)},${p2.z.toFixed(1)}`;
      const key = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edgePairs.push([p1.clone(), p2.clone()]);
      }
    };

    const g1LocalX = SMART_CITY_GATES[0].x - dcX;
    const g1LocalZ = SMART_CITY_GATES[0].z - dcZ;
    const g2LocalX = SMART_CITY_GATES[1].x - dcX;
    const g2LocalZ = SMART_CITY_GATES[1].z - dcZ;

    const unitDir = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      const a = new THREE.Vector3(pos.getX(i), pos.getY(i) * hScale, pos.getZ(i));
      const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1) * hScale, pos.getZ(i + 1));
      const c = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2) * hScale, pos.getZ(i + 2));

      if (a.y < -4 || b.y < -4 || c.y < -4) continue;
      if (a.y < 0) a.y = 0;
      if (b.y < 0) b.y = 0;
      if (c.y < 0) c.y = 0;

      const cx = (a.x + b.x + c.x) / 3;
      const cy = (a.y + b.y + c.y) / 3;
      const cz = (a.z + b.z + c.z) / 3;
      if (cy < 0.25 && a.y < 0.3 && b.y < 0.3 && c.y < 0.3) continue;

      // Cut clean portal openings matching Gate 1 & Gate 2 inner doorway + marquee clearance
      if (cy < 13.0) {
        if (Math.hypot(cx - g1LocalX, cz - g1LocalZ) < 15.0 || Math.hypot(cx - g2LocalX, cz - g2LocalZ) < 15.0) {
          continue;
        }
      }

      registerEdge(a, b);
      registerEdge(b, c);
      registerEdge(c, a);

      unitDir.set(cx, cy / hScale, cz).normalize();
      let isSolarCluster = false;
      for (let p = 0; p < pentNodes.length; p++) {
        if (unitDir.angleTo(pentNodes[p]) < 0.25) {
          isSolarCluster = true;
          break;
        }
      }
      // Subtle lower diamond solar accents matching geodesic photo
      if (!isSolarCluster && cy > 14 && cy < 48 && Math.abs(Math.sin(Math.atan2(cz, cx) * 5)) > 0.91) {
        isSolarCluster = true;
      }

      const target = isSolarCluster ? solarVerts : glassVerts;
      target.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
    if (ico !== icoRaw) icoRaw.dispose();
    ico.dispose();

    // Clear architectural glass triangles (depthWrite: false to preserve interior sky/terrain visibility!)
    const glassGeo = trackGeo(new THREE.BufferGeometry());
    glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(glassVerts, 3));
    glassGeo.computeVertexNormals();
    const domeGlassMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xcbeeff,
        roughness: 0.12,
        metalness: 0.28,
        opacity: 0.24,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const domeGlassMesh = new THREE.Mesh(glassGeo, domeGlassMat);
    domeGlassMesh.renderOrder = 4;
    domeGroup.add(domeGlassMesh);

    // Pentagonal Blue Photovoltaic Solar Glass Panels embedded inside the dome
    const solarDomeGeo = trackGeo(new THREE.BufferGeometry());
    solarDomeGeo.setAttribute('position', new THREE.Float32BufferAttribute(solarVerts, 3));
    solarDomeGeo.computeVertexNormals();
    const domeSolarMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e4b85,
        emissive: 0x0f2f5c,
        emissiveIntensity: 0.36,
        roughness: 0.16,
        metalness: 0.65,
        side: THREE.DoubleSide,
      }),
    );
    const domeSolarMesh = new THREE.Mesh(solarDomeGeo, domeSolarMat);
    domeGroup.add(domeSolarMesh);

    // Instanced 3D Silver-Aluminum Geodesic Lattice Struts
    const strutBaseGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 1, 6));
    const strutMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xdbe3ec, roughness: 0.28, metalness: 0.75 }),
    );
    const strutInst = new THREE.InstancedMesh(strutBaseGeo, strutMat, edgePairs.length);
    const qStrut = new THREE.Quaternion();
    for (let i = 0; i < edgePairs.length; i++) {
      const [eA, eB] = edgePairs[i];
      _tmpMid.addVectors(eA, eB).multiplyScalar(0.5);
      _tmpDir.subVectors(eB, eA);
      const len = _tmpDir.length();
      if (len < 0.05) continue;
      _tmpDir.divideScalar(len);
      qStrut.setFromUnitVectors(_upY, _tmpDir);
      _tmpDummy.position.copy(_tmpMid);
      _tmpDummy.quaternion.copy(qStrut);
      _tmpDummy.scale.set(1, len, 1);
      _tmpDummy.updateMatrix();
      strutInst.setMatrixAt(i, _tmpDummy.matrix);
    }
    strutInst.instanceMatrix.needsUpdate = true;
    domeGroup.add(strutInst);

    // Continuous Solid Concrete Perimeter Wall Ring & Dome Base Arches + Colliders (zero gaps beside gates)
    const baseRimConcreteMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.62, metalness: 0.15 }),
    );
    const rimCount = 48;
    for (let s = 0; s < rimCount; s++) {
      const theta = (s / rimCount) * Math.PI * 2;
      const rx = Math.cos(theta) * domeR;
      const rz = Math.sin(theta) * domeR;
      const wx = dcX + rx;
      const wz = dcZ + rz;

      // Keep Gate 1 & Gate 2 doorways completely clear of perimeter rim segments (wing walls bridge out to +-24.5m)
      const dGate1 = Math.hypot(wx - SMART_CITY_GATES[0].x, wz - SMART_CITY_GATES[0].z);
      const dGate2 = Math.hypot(wx - SMART_CITY_GATES[1].x, wz - SMART_CITY_GATES[1].z);
      if (dGate1 < 18.0 || dGate2 < 18.0) continue;

      const rotY = Math.atan2(rx, rz);
      const segLen = (Math.PI * 2 * domeR) / rimCount + 1.8;

      // Tall solid concrete perimeter security & retaining wall + upper glazed header band
      addBox(domeGroup, boxGeo, baseRimConcreteMat, rx, 2.9, rz, segLen, 5.8, 1.8, { rotY });
      addBox(domeGroup, boxGeo, cyanGlowMat, rx, 5.88, rz, segLen, 0.14, 1.9, { rotY });
      if (s % 4 === 0 && dGate1 > 19.5 && dGate2 > 19.5) {
        addBox(domeGroup, cylGeo, baseRimConcreteMat, rx * 1.01, 4.4, rz * 1.01, 2.2, 8.8, 2.2);
      }
      addCollider(ctx.colliders, wx, 0, wz, segLen, 8.0, 2.0, rotY);
    }

    // =========================================================================
    // LARGE, SLENDER-WIDTH (1.05m) SCULPTED 3D WHITE MARBLE ARCHES OVER GLASS DOME
    // =========================================================================
    const marbleTex = trackTex(makeMarbleVeinedTexture());
    const marbleArchMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: marbleTex,
        color: 0xfafbfc,
        roughness: 0.24,
        metalness: 0.14,
      }),
    );
    const marbleGoldInlayMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.78,
      }),
    );

    const buildSlenderMarbleRib = (pts: THREE.Vector3[], widthMeters: number, depthMeters: number) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const segs = 40;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs;
        const t1 = (k + 1) / segs;
        curve.getPoint(t0, _tmpV0);
        curve.getPoint(t1, _tmpV1);
        _tmpMid.addVectors(_tmpV0, _tmpV1).multiplyScalar(0.5);
        _tmpDir.subVectors(_tmpV1, _tmpV0);
        const segLen = _tmpDir.length();
        if (segLen < 0.1) continue;
        _tmpDir.divideScalar(segLen);

        // Box cross-section gives exact tall-span, slender-width (widthMeters) 3D marble rib look!
        const rib = new THREE.Mesh(boxGeo, marbleArchMat);
        rib.position.copy(_tmpMid);
        rib.scale.set(widthMeters, segLen + 0.18, depthMeters);
        rib.quaternion.setFromUnitVectors(_upY, _tmpDir);
        domeGroup.add(rib);

        // Subtle slender gold inlay rib on the outer spine
        const goldSpine = new THREE.Mesh(boxGeo, marbleGoldInlayMat);
        goldSpine.position.copy(_tmpMid).addScaledVector(_tmpMid.clone().set(_tmpMid.x, 0, _tmpMid.z).normalize(), 0.04);
        goldSpine.position.y += 0.12;
        goldSpine.scale.set(widthMeters * 0.22, segLen + 0.12, depthMeters + 0.14);
        goldSpine.quaternion.copy(rib.quaternion);
        domeGroup.add(goldSpine);
      }
    };

    // 12 Full Meridian Arches sweeping cleanly over the glass dome (`width = 1.05m`, slender yet towering!)
    const archCount = 6; // 6 full diameters = 12 sweeping half-arches (30° spacing)
    for (let aIdx = 0; aIdx < archCount; aIdx++) {
      const phi = (aIdx / archCount) * Math.PI + 0.19;
      const archPts: THREE.Vector3[] = [];
      const steps = 28;
      for (let s = 0; s <= steps; s++) {
        const u = (s / steps) * Math.PI; // 0 (one side rim) -> PI/2 (apex) -> PI (opposite rim)
        const rad = Math.cos(u) * (domeR + 1.25);
        const lx = Math.cos(phi) * rad;
        const lz = Math.sin(phi) * rad;
        let y = Math.sin(u) * (domeH + 1.45);
        // Arch smoothly over Dome Gates 1 & 2 and their marquee LED screens so ribs never pierce portals
        const wx = dcX + lx;
        const wz = dcZ + lz;
        const dG1 = Math.hypot(wx - SMART_CITY_GATES[0].x, wz - SMART_CITY_GATES[0].z);
        const dG2 = Math.hypot(wx - SMART_CITY_GATES[1].x, wz - SMART_CITY_GATES[1].z);
        if ((dG1 < 22.0 || dG2 < 22.0) && y < 18.5) {
          y = 18.5;
        }
        archPts.push(new THREE.Vector3(lx, Math.max(0.2, y), lz));
      }
      buildSlenderMarbleRib(archPts, 1.05, 1.95);
    }

    // 4 Upper Diagonal Filigree Marble Rib Rings & Apex Oculus Ring
    for (let dIdx = 0; dIdx < 4; dIdx++) {
      const startAngle = (dIdx / 4) * Math.PI * 2 + 0.42;
      const diagPts: THREE.Vector3[] = [];
      for (let s = 0; s <= 18; s++) {
        const t = s / 18;
        const elev = 0.28 + t * (Math.PI - 0.56);
        const ang = startAngle + t * 0.95;
        const horiz = Math.cos(elev) * (domeR + 1.05);
        const lx = Math.cos(ang) * horiz;
        const lz = Math.sin(ang) * horiz;
        let y = Math.max(12, Math.sin(elev) * (domeH + 1.15));
        const wx = dcX + lx;
        const wz = dcZ + lz;
        const dG1 = Math.hypot(wx - SMART_CITY_GATES[0].x, wz - SMART_CITY_GATES[0].z);
        const dG2 = Math.hypot(wx - SMART_CITY_GATES[1].x, wz - SMART_CITY_GATES[1].z);
        if ((dG1 < 22.0 || dG2 < 22.0) && y < 18.5) {
          y = 18.5;
        }
        diagPts.push(new THREE.Vector3(lx, y, lz));
      }
      buildSlenderMarbleRib(diagPts, 0.85, 1.45);
    }

    // Crown Oculus Marble Ring at the top apex of the Dome
    const oculusGeo = trackGeo(new THREE.TorusGeometry(14.5, 0.58, 8, 36));
    const oculusMesh = new THREE.Mesh(oculusGeo, marbleArchMat);
    oculusMesh.rotation.x = Math.PI * 0.5;
    oculusMesh.position.set(0, domeH + 0.35, 0);
    domeGroup.add(oculusMesh);
  }

  // =========================================================================
  // 3. TWO REFERENCE-STYLED AUTOMATIC SLIDING GATES ON THE GLASS DOME
  //    + MODERN DOME LED SCREEN ("SMART CITY — developed by AFTAB BALOCH DADU")
  // =========================================================================
  const portalConcDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b424c, roughness: 0.72, metalness: 0.14 }));
  const portalSoffitMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x4b535e, roughness: 0.65, metalness: 0.18 }));
  const gateLouverCharcoalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.38, metalness: 0.68 }));
  const gateFrameSteelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e242c, roughness: 0.35, metalness: 0.78 }));
  const warmLedStripMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffebb8 }));
  const actuatorSteelMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.24, metalness: 0.85 }));

  const domeGates: DomeGateRuntime[] = SMART_CITY_GATES.map((spec) => {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(spec.x, 0, spec.z);
    gateGroup.rotation.y = spec.yaw;
    root.add(gateGroup);

    // Outer Architectural Dark-Grey Concrete Portal Arch Frame (matching reference gate)
    const portalW = 20.4;
    const portalH = 7.6;
    const portalD = 2.6;
    const legW = 2.0;

    // Left & Right Main Concrete Portal Pillars + Top Concrete Lintel Beam
    addBox(gateGroup, boxGeo, portalConcDarkMat, -portalW * 0.5 + legW * 0.5, portalH * 0.5, 0, legW, portalH, portalD);
    addBox(gateGroup, boxGeo, portalConcDarkMat, portalW * 0.5 - legW * 0.5, portalH * 0.5, 0, legW, portalH, portalD);
    addBox(gateGroup, boxGeo, portalConcDarkMat, 0, portalH - 0.65, 0, portalW, 1.3, portalD + 0.15);

    // Continuous Warm Perimeter LED Light Strip inside concrete portal legs & lintel soffit
    const innerSpan = portalW - legW * 2;
    addBox(gateGroup, boxGeo, warmLedStripMat, -innerSpan * 0.5 + 0.08, (portalH - 1.3) * 0.5, portalD * 0.42, 0.14, portalH - 1.3, 0.14);
    addBox(gateGroup, boxGeo, warmLedStripMat, innerSpan * 0.5 - 0.08, (portalH - 1.3) * 0.5, portalD * 0.42, 0.14, portalH - 1.3, 0.14);
    addBox(gateGroup, boxGeo, warmLedStripMat, 0, portalH - 1.32, portalD * 0.42, innerSpan, 0.14, 0.14);
    // 4 Ceiling downlight spots
    [-5.2, -1.8, 1.8, 5.2].forEach((sx) => {
      addBox(gateGroup, cylGeo, warmLedStripMat, sx, portalH - 1.33, 0, 0.36, 0.05, 0.36);
    });

    // Left & Right Low Protruding Concrete Actuator Plinths with Warm Under-Glow + Silver Drive Motors
    [-innerSpan * 0.5 - 0.85, innerSpan * 0.5 + 0.85].forEach((px, pIdx) => {
      const sign = pIdx === 0 ? 1 : -1;
      addBox(gateGroup, boxGeo, portalSoffitMat, px + sign * 2.1, 0.42, 1.85, 4.6, 0.48, 1.75);
      addBox(gateGroup, boxGeo, warmLedStripMat, px + sign * 2.1, 0.14, 1.85, 4.45, 0.12, 1.62);
      // Silver Drive Motor Housing on plinth
      addBox(gateGroup, boxGeo, actuatorSteelMat, px + sign * 0.85, 0.92, 1.65, 0.65, 0.62, 0.55);
    });

    // Telescoping Horizontal Hydraulic Piston Rods attached to actuator housings
    const leftPiston = addBox(gateGroup, cylGeo, actuatorSteelMat, -5.6, 0.9, 1.05, 0.09, 3.6, 0.09, { rotZ: Math.PI * 0.5 });
    const rightPiston = addBox(gateGroup, cylGeo, actuatorSteelMat, 5.6, 0.9, 1.05, 0.09, 3.6, 0.09, { rotZ: Math.PI * 0.5 });

    // Glowing Smart Keypad Intercom Column on inner left pillar
    addBox(gateGroup, boxGeo, darkJointMat, -innerSpan * 0.5 + 0.52, 2.2, 1.15, 0.42, 1.05, 0.25);
    const keypadMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    addBox(gateGroup, boxGeo, keypadMat, -innerSpan * 0.5 + 0.52, 2.35, 1.29, 0.26, 0.52, 0.04);

    // Dual Horizontal-Louvered Charcoal Sliding Leaves with Crisp Horizontal Cyan-White Center LED Light Bar
    const ledBarMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xe0f7ff }));
    const buildGateLeaf = (isLeft: boolean): THREE.Group => {
      const leaf = new THREE.Group();
      const sign = isLeft ? -1 : 1;
      leaf.position.set(sign * 4.05, 0, 0.18);
      // Outer charcoal steel border frame + main panel
      addBox(leaf, boxGeo, gateLouverCharcoalMat, 0, 2.65, 0, 8.05, 4.85, 0.22);
      addBox(leaf, boxGeo, gateFrameSteelMat, 0, 5.05, 0, 8.12, 0.18, 0.28);
      addBox(leaf, boxGeo, gateFrameSteelMat, 0, 0.24, 0, 8.12, 0.22, 0.28);
      // 4 Horizontal Architectural Louver Seam Channels across gate leaf
      [1.15, 2.05, 3.35, 4.25].forEach((ly) => {
        addBox(leaf, boxGeo, gateFrameSteelMat, 0, ly, 0, 7.95, 0.08, 0.26);
      });
      // Signature Glowing Cyan-White Horizontal Light Bar (front + back faces!)
      addBox(leaf, boxGeo, ledBarMat, 0, 2.7, 0.14, 7.75, 0.16, 0.05);
      addBox(leaf, boxGeo, ledBarMat, 0, 2.7, -0.14, 7.75, 0.16, 0.05);
      gateGroup.add(leaf);
      return leaf;
    };

    const leftLeaf = buildGateLeaf(true);
    const rightLeaf = buildGateLeaf(false);

    // Hollow Dome Junction Concrete Arch Collar connecting gate piers flush to Dome shell (zero blocking doorway slab!)
    addBox(gateGroup, boxGeo, portalConcDarkMat, -portalW * 0.5 + legW * 0.5, portalH * 0.5, -1.65, legW + 0.8, portalH + 0.5, 1.5);
    addBox(gateGroup, boxGeo, portalConcDarkMat, portalW * 0.5 - legW * 0.5, portalH * 0.5, -1.65, legW + 0.8, portalH + 0.5, 1.5);
    addBox(gateGroup, boxGeo, portalConcDarkMat, 0, portalH - 0.35, -1.65, portalW + 1.8, 1.5, 1.5);

    // Solid Gate Portal Pillar Colliders + Left/Right Perimeter Wing Walls (zero open gap beside either gate!)
    const gateCos = Math.cos(spec.yaw);
    const gateSin = Math.sin(spec.yaw);
    const toWorldGate = (lx: number, lz: number) => ({
      wx: spec.x + lx * gateCos + lz * gateSin,
      wz: spec.z - lx * gateSin + lz * gateCos,
    });
    [-portalW * 0.5 + legW * 0.5, portalW * 0.5 - legW * 0.5].forEach((px) => {
      const pWorld = toWorldGate(px, 0);
      addCollider(ctx.colliders, pWorld.wx, 0, pWorld.wz, legW + 0.6, portalH, portalD + 0.8, spec.yaw, 'concrete');
    });
    [-1, 1].forEach((sideSign) => {
      const wingCenterLocalX = sideSign * (portalW * 0.5 + 7.2);
      const wingCenterLocalZ = -1.45;
      const wingYawOffset = -sideSign * 0.13;
      addBox(gateGroup, boxGeo, portalConcDarkMat, wingCenterLocalX, 3.8, wingCenterLocalZ, 15.2, 7.6, 2.2, { rotY: wingYawOffset });
      addBox(gateGroup, boxGeo, cyanGlowMat, wingCenterLocalX, 6.2, wingCenterLocalZ + 1.15, 14.4, 0.14, 0.08, { rotY: wingYawOffset });
      const wWorld = toWorldGate(wingCenterLocalX, wingCenterLocalZ);
      addCollider(ctx.colliders, wWorld.wx, 0, wWorld.wz, 15.4, 7.8, 2.4, spec.yaw + wingYawOffset, 'concrete');
    });

    // Dynamic OBB Leaf Colliders so both Player & Vehicles collide solidly with closed/moving doors!
    const dynCols = ctx.dynamicColliders ?? ctx.colliders;
    const leftLeafStart = toWorldGate(-4.05, 0.18);
    addCollider(dynCols, leftLeafStart.wx, 0, leftLeafStart.wz, 8.15, 6.2, 0.95, spec.yaw, 'metal');
    const leftCollider = dynCols[dynCols.length - 1];
    const rightLeafStart = toWorldGate(4.05, 0.18);
    addCollider(dynCols, rightLeafStart.wx, 0, rightLeafStart.wz, 8.15, 6.2, 0.95, spec.yaw, 'metal');
    const rightCollider = dynCols[dynCols.length - 1];

    // MODERN ILLUMINATED DOME MARQUEE LED SCREEN ("SMART CITY — developed by AFTAB BALOCH DADU")
    const bannerMat = ctx.displays.createDisplayMaterial('smart_city_dome_banner', {
      title: SMART_CITY_DOME.titleText,
      subtitle: SMART_CITY_DOME.subtitleText,
      width: 1024,
      height: 256,
      intervalSec: 0.22,
    }).material;
    // Sleek dark titanium screen bezel mounted prominently on Glass Dome directly above each gate!
    addBox(gateGroup, boxGeo, darkJointMat, 0, 12.2, 0.4, 24.8, 6.6, 0.65);
    addBox(gateGroup, boxGeo, cyanGlowMat, 0, 12.2, 0.44, 25.1, 6.85, 0.35);
    const screenPlane = addBox(gateGroup, boxGeo, bannerMat, 0, 12.2, 0.78, 24.0, 6.0, 0.08);
    // Also duplicate reverse face inside dome so screen reads from inside as well
    addBox(gateGroup, boxGeo, bannerMat, 0, 12.2, 0.02, 24.0, 6.0, 0.08);
    void screenPlane;

    return {
      spec,
      leftLeaf,
      rightLeaf,
      leftPiston,
      rightPiston,
      ledBarMat,
      leftCollider,
      rightCollider,
      openProgress: 0,
      prevTargetOpen: 0,
    };
  });

  // =========================================================================
  // 4. DYNAMIC IN-WORLD ANIMATED CHARTS BILLBOARDS INSIDE SMART DOME
  // =========================================================================
  [
    { x: -120, y: 3.6, z: -454, rotY: 0.42, title: 'DOME ENERGY & AG YIELD', sub: 'SOLAR + WIND + FARM' },
    { x: -131, y: 3.8, z: -514, rotY: 0.35, title: '30 ROBOTS · 18 DRONES LIVE', sub: 'REAL-TIME ANALYTICS' },
    { x: -82, y: 3.6, z: -532, rotY: -1.1, title: 'AUTONOMOUS GRID METRICS', sub: 'AFTAB BALOCH DADU' },
  ].forEach((ch) => {
    const cMat = ctx.displays.createDisplayMaterial('smart_city_charts', {
      title: ch.title,
      subtitle: ch.sub,
      width: 512,
      height: 256,
      intervalSec: 0.35,
    }).material;
    addBox(root, cylGeo, darkJointMat, ch.x, 1.4, ch.z, 0.45, 2.8, 0.45);
    addBox(root, boxGeo, darkJointMat, ch.x, ch.y, ch.z, 7.6, 4.0, 0.36, { rotY: ch.rotY });
    addBox(root, boxGeo, cyanGlowMat, ch.x, ch.y, ch.z, 7.8, 4.18, 0.22, { rotY: ch.rotY });
    addBox(root, boxGeo, cMat, ch.x + Math.sin(ch.rotY) * 0.2, ch.y, ch.z + Math.cos(ch.rotY) * 0.2, 7.2, 3.6, 0.06, { rotY: ch.rotY });
    addCollider(ctx.colliders, ch.x, 0, ch.z, 1.2, 3.0, 1.2);
  });

  // =========================================================================
  // 5. ZONE A: AI AUTOMATED FARMING & 2 SOLAR GLASS GREENHOUSES (Consolidated SW Dome)
  // =========================================================================
  const buildGlassGreenhouse = (cx: number, cz: number, label: string) => {
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    root.add(g);

    const W = 22;
    const D = 20;
    const wallH = 4.4;
    const roofPeakH = 6.8;

    addBox(g, boxGeo, cityPal.concreteDeck, 0, 0.06, 0, W + 2.4, 0.12, D + 2.4);

    [-W * 0.5, W * 0.5].forEach((wx) => {
      registerBreakableGlass(ctx, addBox(g, boxGeo, greenhouseGlassMat, wx, wallH * 0.5, 0, 0.14, wallH, D));
      addCollider(ctx.colliders, cx + wx, 0, cz, 0.35, wallH, D);
      for (let pz = -D * 0.5; pz <= D * 0.5; pz += 5.0) {
        addBox(g, boxGeo, darkJointMat, wx, wallH * 0.5, pz, 0.24, wallH, 0.24);
      }
    });
    registerBreakableGlass(ctx, addBox(g, boxGeo, greenhouseGlassMat, 0, wallH * 0.5, -D * 0.5, W, wallH, 0.14));
    addCollider(ctx.colliders, cx, 0, cz - D * 0.5, W, wallH, 0.35);

    // Wide Open 6m South Walk-in Doorway
    [-7.1, 7.1].forEach((wx) => {
      registerBreakableGlass(ctx, addBox(g, boxGeo, greenhouseGlassMat, wx, wallH * 0.5, D * 0.5, 7.8, wallH, 0.14));
      addCollider(ctx.colliders, cx + wx, 0, cz + D * 0.5, 7.8, wallH, 0.35);
    });
    addBox(g, boxGeo, darkJointMat, -3.1, wallH * 0.5, D * 0.5, 0.26, wallH, 0.26);
    addBox(g, boxGeo, darkJointMat, 3.1, wallH * 0.5, D * 0.5, 0.26, wallH, 0.26);
    addBox(g, boxGeo, darkJointMat, 0, wallH - 0.18, D * 0.5, W, 0.36, 0.3);

    const slopeTilt = Math.atan2(roofPeakH - wallH, W * 0.5);
    const slopeLen = Math.hypot(W * 0.5, roofPeakH - wallH) + 0.5;
    addBox(g, boxGeo, greenhouseGlassMat, -W * 0.25, (wallH + roofPeakH) * 0.5, 0, slopeLen, 0.12, D, { rotZ: slopeTilt });
    addBox(g, boxGeo, greenhouseGlassMat, W * 0.25, (wallH + roofPeakH) * 0.5, 0, slopeLen, 0.12, D, { rotZ: -slopeTilt });
    for (let sz = -7.5; sz <= 7.5; sz += 4.5) {
      addBox(g, boxGeo, solarPanelMat, -W * 0.28, (wallH + roofPeakH) * 0.5 + 0.24, sz, 6.8, 0.12, 3.2, { rotZ: slopeTilt });
      addBox(g, boxGeo, solarPanelMat, W * 0.28, (wallH + roofPeakH) * 0.5 + 0.24, sz, 6.8, 0.12, 3.2, { rotZ: -slopeTilt });
    }
    addBox(g, boxGeo, darkJointMat, 0, wallH + 1.05, D * 0.5 - 0.05, 1.8, 1.8, 0.36);
    const fanHub = new THREE.Group();
    fanHub.position.set(0, wallH + 1.05, D * 0.5 + 0.18);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(boxGeo, solarFrameMat);
      blade.scale.set(0.22, 1.35, 0.06);
      blade.rotation.z = (b / 4) * Math.PI;
      fanHub.add(blade);
    }
    g.add(fanHub);

    const signTex = trackTex(makeSignTexture(label, 'SOLAR AI GREENHOUSE · HYDROPONIC', '#071c22', '#22d3ee'));
    const signMat = trackMat(new THREE.MeshBasicMaterial({ map: signTex }));
    addBox(g, boxGeo, signMat, 0, wallH + 0.12, D * 0.5 + 0.24, 6.4, 0.9, 0.12);

    const interiorDetail = new THREE.Group();
    g.add(interiorDetail);
    ctx.lodDetailGroups.push({ group: interiorDetail, x: cx, z: cz, maxDist: 95 });

    [-6.0, 0, 6.0].forEach((bx, rowIdx) => {
      if (bx !== 0) {
        addBox(interiorDetail, boxGeo, solarFrameMat, bx, 0.72, -1.2, 3.0, 0.18, 12.2);
        addBox(interiorDetail, boxGeo, soilMulchMat, bx, 0.85, -1.2, 2.7, 0.1, 11.8);
        addBox(interiorDetail, boxGeo, darkJointMat, bx, 3.15, -1.2, 0.6, 0.14, 11.0);
        addBox(interiorDetail, boxGeo, purpleGrowMat, bx, 3.06, -1.2, 0.44, 0.08, 10.6);
        for (let lz = -6.2; lz <= 3.6; lz += 1.4) {
          for (let lx = -0.8; lx <= 0.8; lx += 0.8) {
            const head = new THREE.Mesh(sphereGeo, rowIdx % 2 === 0 ? lettuceDeepMat : cropLeafMat);
            head.position.set(bx + lx, 1.06, lz);
            head.scale.set(0.64, 0.46, 0.64);
            interiorDetail.add(head);
          }
        }
      } else {
        [-2.2, 2.2].forEach((tx) => {
          addBox(interiorDetail, boxGeo, whiteRobotMat, tx, 0.45, -5.2, 1.0, 0.5, 7.6);
          for (let vz = -8.2; vz <= -2.2; vz += 1.55) {
            addBox(interiorDetail, boxGeo, cropLeafMat, tx, 1.8, vz, 0.5, 2.3, 0.5);
            addBox(interiorDetail, sphereGeo, tomatoRedMat, tx - 0.26, 1.5, vz + 0.14, 0.22, 0.22, 0.22);
            addBox(interiorDetail, sphereGeo, tomatoRedMat, tx + 0.26, 1.9, vz - 0.12, 0.22, 0.22, 0.22);
          }
        });
      }
    });

    addBox(interiorDetail, cylGeo, hydroTankMat, 8.8, 1.45, -5.0, 2.1, 2.6, 2.1);
    addBox(interiorDetail, boxGeo, cyanGlowMat, 7.72, 1.55, -5.0, 0.08, 0.68, 0.52);
    addBox(interiorDetail, cylGeo, pvcPipeMat, 7.3, 2.0, -3.6, 0.16, 2.4, 0.16, { rotX: Math.PI * 0.5 });

    const ghDisplayMat = ctx.displays.createDisplayMaterial('smart_farm_telemetry', {
      title: `${label} · AI SENSORS`,
      subtitle: 'DRIP AUTO · OPTIMAL',
      intervalSec: 0.7,
    }).material;
    addBox(g, boxGeo, darkJointMat, 0, 0.65, 13.5, 0.24, 1.3, 0.24);
    addBox(g, boxGeo, ghDisplayMat, 0, 1.36, 13.5, 1.65, 1.05, 0.12, { rotX: -0.45 });

    addBox(interiorDetail, boxGeo, woodCrateMat, -4.0, 0.35, 6.8, 1.25, 0.68, 0.9);
    addBox(interiorDetail, sphereGeo, tomatoRedMat, -4.2, 0.76, 6.7, 0.32, 0.26, 0.32);

    ctx.updaters.push((dt) => {
      fanHub.rotation.z += dt * 7.2;
    });
  };

  buildGlassGreenhouse(-154, -456, 'SOLAR GREENHOUSE A');
  buildGlassGreenhouse(-186, -478, 'SOLAR GREENHOUSE B');

  // Consolidated Multi-Crop Agricultural Field Beds inside SW Dome
  const mulchBedCoords: Array<{ x: number; z: number; len: number; kind: 'lettuce' | 'wheat' | 'tomato' }> = [];
  for (let row = -3; row <= 3; row++) {
    const rx = -208 + row * 4.1;
    mulchBedCoords.push({ x: rx, z: -512, len: 24, kind: row % 2 === 0 ? 'lettuce' : 'tomato' });
    mulchBedCoords.push({ x: rx + 6, z: -538, len: 22, kind: row % 2 === 0 ? 'wheat' : 'lettuce' });
  }
  mulchBedCoords.forEach((b) => {
    addBox(root, boxGeo, soilMulchMat, b.x, 0.09, b.z, 1.35, 0.18, b.len);
  });

  const cropTransforms: Array<{ x: number; y: number; z: number; kind: 'lettuce' | 'wheat' | 'tomato' }> = [];
  mulchBedCoords.forEach((b) => {
    for (let pz = -b.len * 0.42; pz <= b.len * 0.42; pz += 3.6) {
      cropTransforms.push({ x: b.x, y: 0.24, z: b.z + pz, kind: b.kind });
    }
  });
  const lettucePts = cropTransforms.filter((c) => c.kind === 'lettuce');
  const wheatPts = cropTransforms.filter((c) => c.kind === 'wheat');
  const tomatoPts = cropTransforms.filter((c) => c.kind === 'tomato');
  const lettuceInst = new THREE.InstancedMesh(sphereGeo, lettuceDeepMat, lettucePts.length);
  const wheatInst = new THREE.InstancedMesh(coneGeo, wheatGoldMat, wheatPts.length);
  const tomatoInst = new THREE.InstancedMesh(boxGeo, cropLeafMat, tomatoPts.length);
  const tomatoFruitInst = new THREE.InstancedMesh(sphereGeo, tomatoRedMat, tomatoPts.length);
  root.add(lettuceInst, wheatInst, tomatoInst, tomatoFruitInst);

  const cropDummy = new THREE.Object3D();
  const updateCropGrowthVisuals = (growthStage: number) => {
    const gScale = 0.45 + growthStage * 0.72;
    for (let i = 0; i < lettucePts.length; i++) {
      const p = lettucePts[i];
      cropDummy.position.set(p.x, p.y + 0.12 * gScale, p.z);
      cropDummy.rotation.set(0, i * 0.6, 0);
      cropDummy.scale.set(0.95 * gScale, 0.62 * gScale, 0.95 * gScale);
      cropDummy.updateMatrix();
      lettuceInst.setMatrixAt(i, cropDummy.matrix);
    }
    lettuceInst.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < wheatPts.length; i++) {
      const p = wheatPts[i];
      cropDummy.position.set(p.x, p.y + 0.45 * gScale, p.z);
      cropDummy.rotation.set(0, i * 0.4, 0);
      cropDummy.scale.set(0.75, 1.15 * gScale, 0.75);
      cropDummy.updateMatrix();
      wheatInst.setMatrixAt(i, cropDummy.matrix);
    }
    wheatInst.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < tomatoPts.length; i++) {
      const p = tomatoPts[i];
      cropDummy.position.set(p.x, p.y + 0.55 * gScale, p.z);
      cropDummy.rotation.set(0, 0, 0);
      cropDummy.scale.set(0.65, 1.3 * gScale, 0.65);
      cropDummy.updateMatrix();
      tomatoInst.setMatrixAt(i, cropDummy.matrix);
      cropDummy.position.set(p.x + 0.25, p.y + 0.72 * gScale, p.z);
      cropDummy.scale.set(0.24 * gScale, 0.24 * gScale, 0.24 * gScale);
      cropDummy.updateMatrix();
      tomatoFruitInst.setMatrixAt(i, cropDummy.matrix);
    }
    tomatoInst.instanceMatrix.needsUpdate = true;
    tomatoFruitInst.instanceMatrix.needsUpdate = true;
  };
  updateCropGrowthVisuals(state.cropGrowthStage);

  // Solar Field Irrigation Tower (-196, -508)
  const irrTowerGroup = new THREE.Group();
  irrTowerGroup.position.set(-196, 0, -508);
  root.add(irrTowerGroup);
  addBox(irrTowerGroup, cylGeo, solarFrameMat, 0, 2.2, 0, 0.35, 4.4, 0.35);
  addBox(irrTowerGroup, boxGeo, solarPanelMat, 0, 4.6, 0, 3.6, 0.14, 2.4, { rotX: 0.42 });
  addBox(irrTowerGroup, boxGeo, darkJointMat, 0, 3.6, 0.3, 1.0, 0.75, 0.45);
  addBox(irrTowerGroup, cylGeo, cyanGlowMat, 0.45, 2.3, 0.55, 0.85, 1.1, 0.85);
  const irrSprayCone = new THREE.Mesh(coneGeo, sprayMistMat);
  irrSprayCone.position.set(-2.6, 1.1, 0);
  irrSprayCone.scale.set(5.4, 3.2, 3.8);
  irrSprayCone.rotation.z = -Math.PI * 0.34;
  irrTowerGroup.add(irrSprayCone);
  addCollider(ctx.colliders, -196, 0, -508, 1.2, 4.6, 1.2);

  // Solar Drip Controller (-168, -482)
  const dripGroup = new THREE.Group();
  dripGroup.position.set(-168, 0, -482);
  root.add(dripGroup);
  addBox(dripGroup, cylGeo, solarFrameMat, 0, 1.2, 0, 0.22, 2.4, 0.22);
  addBox(dripGroup, boxGeo, solarPanelMat, 0, 2.45, 0, 1.65, 0.1, 1.2, { rotX: 0.42 });
  const meter5000Mat = trackMat(new THREE.MeshBasicMaterial({ map: trackTex(makeMeterTexture('5000', 'SOLAR mW', '#22c55e')) }));
  const meter500Mat = trackMat(new THREE.MeshBasicMaterial({ map: trackTex(makeMeterTexture('500', 'LPM FLOW', '#22d3ee')) }));
  addBox(dripGroup, boxGeo, whiteRobotMat, 0, 1.82, 0.18, 0.65, 0.42, 0.24);
  addBox(dripGroup, boxGeo, meter5000Mat, 0, 1.82, 0.31, 0.58, 0.34, 0.02);
  addBox(dripGroup, boxGeo, hydroTankMat, 0, 1.24, 0.18, 0.72, 0.48, 0.28);
  addBox(dripGroup, boxGeo, meter500Mat, 0, 1.24, 0.33, 0.62, 0.38, 0.02);
  addBox(dripGroup, cylGeo, pvcPipeMat, 0, 0.42, 0, 0.16, 18, 0.16, { rotX: Math.PI * 0.5 });
  const dripJets: THREE.Mesh[] = [];
  for (let dz = -7.5; dz <= 7.5; dz += 3.0) {
    addBox(dripGroup, boxGeo, darkJointMat, 0.28, 0.38, dz, 0.38, 0.12, 0.18);
    const jet = new THREE.Mesh(cylGeo, sprayMistMat);
    jet.position.set(0.45, 0.2, dz);
    jet.scale.set(0.08, 0.38, 0.08);
    dripGroup.add(jet);
    dripJets.push(jet);
  }

  // =========================================================================
  // 6. ZONE B: VERTICAL HYDROPONICS "AI FARM" LAB + SKY-TOWERS + AQUA RECYCLE (West/NW Inside Dome)
  // =========================================================================
  {
    const cx = -216;
    const cz = -562;
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    root.add(g);
    const W = 24;
    const D = 24;
    const H = 6.2;

    addBox(g, boxGeo, cityPal.concreteDeck, 0, 0.06, 0, W + 2.4, 0.12, D + 2.4);
    addBox(g, boxGeo, whiteRobotMat, 0, H + 0.2, 0, W + 1.0, 0.4, D + 1.0);
    addBox(g, boxGeo, solarPanelMat, 0, H + 0.5, 0, W - 3, 0.12, D - 3);
    [-W * 0.5, W * 0.5].forEach((wx) => {
      registerBreakableGlass(ctx, addBox(g, boxGeo, greenhouseGlassMat, wx, H * 0.5, 0, 0.18, H, D));
      addCollider(ctx.colliders, cx + wx, 0, cz, 0.4, H, D);
    });
    addBox(g, boxGeo, cityPal.facadePanel, 0, H * 0.5, -D * 0.5, W, H, 0.32);
    addCollider(ctx.colliders, cx, 0, cz - D * 0.5, W, H, 0.45);
    [-7.6, 7.6].forEach((wx) => {
      registerBreakableGlass(ctx, addBox(g, boxGeo, greenhouseGlassMat, wx, H * 0.5, D * 0.5, 8.8, H, 0.18));
      addCollider(ctx.colliders, cx + wx, 0, cz + D * 0.5, 8.8, H, 0.4);
    });

    const aiFarmSign = trackMat(
      new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture('AI FARM', 'VERTICAL HYDROPONICS & SOIL LAB', '#04121d', '#22d3ee')) }),
    );
    addBox(g, boxGeo, aiFarmSign, 0, H - 0.75, D * 0.5 + 0.22, 8.2, 1.4, 0.16);

    const labInterior = new THREE.Group();
    g.add(labInterior);
    ctx.lodDetailGroups.push({ group: labInterior, x: cx, z: cz, maxDist: 95 });

    [-7.5, 7.5].forEach((rx) => {
      addBox(labInterior, boxGeo, whiteRobotMat, rx, 0.45, -3.2, 3.0, 0.9, 9.6);
      addBox(labInterior, boxGeo, cyanGlowMat, rx, 0.45, 1.65, 1.3, 0.4, 0.08);
      for (let tier = 0; tier < 4; tier++) {
        const ty = 1.15 + tier * 0.95;
        addBox(labInterior, boxGeo, whiteRobotMat, rx, ty, -3.2, 2.6, 0.14, 9.4);
        addBox(labInterior, boxGeo, cropLeafMat, rx, ty + 0.24, -3.2, 2.2, 0.34, 8.8);
        addBox(labInterior, boxGeo, purpleGrowMat, rx, ty + 0.68, -3.2, 2.0, 0.08, 8.8);
      }
    });
    [-3.2, 0, 3.2].forEach((tx) => {
      addBox(labInterior, cylGeo, greenhouseGlassMat, tx, 2.6, -7.8, 1.35, 4.8, 1.35);
      addBox(labInterior, cylGeo, cyanGlowMat, tx, 2.6, -7.8, 0.35, 4.6, 0.35);
      for (let py = 0.8; py <= 4.4; py += 0.9) {
        addBox(labInterior, sphereGeo, lettuceDeepMat, tx - 0.62, py, -7.8, 0.4, 0.34, 0.4);
        addBox(labInterior, sphereGeo, cropLeafMat, tx + 0.62, py + 0.35, -7.8, 0.4, 0.34, 0.4);
      }
    });
  }

  // External Vertical Sky-Towers inside Dome (h <= 22m -> ~28m ceiling clearance)
  [
    { x: -198, z: -592, h: 22 },
    { x: -214, z: -608, h: 18 },
    { x: -186, z: -606, h: 20 },
  ].forEach((vt) => {
    addBox(root, cylGeo, cityPal.concreteDeck, vt.x, 0.5, vt.z, 8.2, 1.0, 8.2);
    addBox(root, cylGeo, greenhouseGlassMat, vt.x, vt.h * 0.5, vt.z, 6.8, vt.h, 6.8);
    addBox(root, cylGeo, cyanGlowMat, vt.x, vt.h * 0.5, vt.z, 1.4, vt.h - 1, 1.4);
    for (let ringY = 3; ringY < vt.h - 2; ringY += 3.5) {
      addBox(root, cylGeo, whiteRobotMat, vt.x, ringY, vt.z, 7.2, 0.35, 7.2);
      addBox(root, cylGeo, cropLeafMat, vt.x, ringY + 0.65, vt.z, 6.0, 0.95, 6.0);
    }
    addBox(root, cylGeo, solarPanelMat, vt.x, vt.h + 0.25, vt.z, 7.4, 0.35, 7.4);
    addCollider(ctx.colliders, vt.x, 0, vt.z, 7.6, vt.h, 7.6);
  });

  // Aqua Water Purification & Recycling Hub (-182, -626) inside NW Dome
  {
    const cx = -182;
    const cz = -626;
    addBox(root, boxGeo, cityPal.concreteDeck, cx, 0.12, cz, 30, 0.24, 20);
    [-8, 8].forEach((ox) => {
      addBox(root, cylGeo, metalAlloyMat, cx + ox, 4.6, cz - 4.5, 6.2, 9.2, 6.2);
      addBox(root, cylGeo, cyanGlowMat, cx + ox, 8.6, cz - 4.5, 6.5, 0.4, 6.5);
      addCollider(ctx.colliders, cx + ox, 0, cz - 4.5, 6.5, 9.2, 6.5);
    });
    addBox(root, boxGeo, darkJointMat, cx, 0.8, cz + 4.5, 20, 1.6, 8);
    addBox(root, boxGeo, cyanGlowMat, cx, 1.52, cz + 4.5, 18.4, 0.16, 6.6);
    addCollider(ctx.colliders, cx, 0, cz + 4.5, 20, 1.6, 8);
    const waterSign = trackMat(
      new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture('AQUA RECYCLE HUB', '94% CLOSED-LOOP PURIFICATION', '#06202a', '#38bdf8')) }),
    );
    addBox(root, boxGeo, waterSign, cx, 6.5, cz - 1.2, 10, 1.8, 0.2);
  }

  // =========================================================================
  // 7. ZONE C: NEXUS HQ TOWER, ROBOTICS LAB, UNIVERSITY, MALL, RESIDENCES & ECO PARK (Central/East Dome)
  // =========================================================================
  // Eco Park & Fountain (-98, -482) right inside Gate 1 plaza!
  {
    const px = -98;
    const pz = -482;
    addBox(root, boxGeo, lettuceDeepMat, px, 0.04, pz, 28, 0.08, 22);
    addBox(root, boxGeo, cityPal.concreteDeck, px, 0.09, pz, 9, 0.1, 20);
    addBox(root, cylGeo, cityPal.whiteMarble, px, 0.42, pz, 6.4, 0.65, 6.4);
    addBox(root, cylGeo, cyanGlowMat, px, 0.78, pz, 5.4, 0.16, 5.4);
    const fountainJet = addBox(root, cylGeo, sprayMistMat, px, 2.0, pz, 0.8, 2.6, 0.8);
    addCollider(ctx.colliders, px, 0, pz, 6.6, 1.2, 6.6);
    ctx.updaters.push((_dt, elapsed) => {
      const s = 0.88 + Math.sin(elapsed * 4.5) * 0.14;
      fountainJet.scale.set(0.8, 2.4 * s, 0.8);
    });
  }

  // Nexus AI Corp HQ Glass Skyscraper (-108, -512, 42m tall under 64m dome ceiling!)
  {
    const cx = -108;
    const cz = -512;
    addBox(root, boxGeo, cityPal.concreteDeck, cx, 0.1, cz, 26, 0.2, 24);
    addBox(root, boxGeo, smartGlassFacadeMat, cx, 14, cz, 19, 28, 17);
    addBox(root, boxGeo, smartGlassFacadeMat, cx, 33, cz, 13, 12, 12);
    addBox(root, boxGeo, cityPal.whiteMarble, cx, 39.4, cz, 14, 0.7, 13);
    addBox(root, boxGeo, solarPanelMat, cx, 39.85, cz, 11.5, 0.22, 10.5);
    addBox(root, cylGeo, cyanGlowMat, cx, 42.4, cz, 0.55, 5.5, 0.55);
    for (let fy = 4; fy <= 27; fy += 3.6) {
      addBox(root, boxGeo, darkJointMat, cx, fy, cz, 19.3, 0.36, 17.3);
    }
    [-9.6, 9.6].forEach((rx) => {
      addBox(root, boxGeo, cyanGlowMat, cx + rx, 14, cz, 0.32, 28, 0.55);
    });
    const hqSign = trackMat(
      new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture('NEXUS AI CORP HQ', 'QUANTUM CORE · SMART CITY', '#071121', '#38bdf8')) }),
    );
    addBox(root, boxGeo, hqSign, cx, 6.4, cz + 8.7, 12, 2.0, 0.2);
    addCollider(ctx.colliders, cx, 0, cz, 19.4, 40, 17.4);
  }

  // Walk-in AI & Robotics Research Lab (-126, -562)
  const destructibleArms: RoboticArmUnit[] = [];
  {
    const cx = -126;
    const cz = -562;
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    root.add(g);
    const W = 26;
    const D = 22;
    const H = 6.6;

    addBox(g, boxGeo, cityPal.concreteDeck, 0, 0.06, 0, W + 2, 0.12, D + 2);
    addBox(g, boxGeo, whiteRobotMat, 0, H + 0.2, 0, W + 0.8, 0.4, D + 0.8);
    addBox(g, boxGeo, solarPanelMat, 0, H + 0.46, 0, W - 4, 0.12, D - 4);
    [-W * 0.5, W * 0.5].forEach((wx) => {
      registerBreakableGlass(ctx, addBox(g, boxGeo, greenhouseGlassMat, wx, H * 0.5, 0, 0.2, H, D));
      addCollider(ctx.colliders, cx + wx, 0, cz, 0.45, H, D);
    });
    addBox(g, boxGeo, cityPal.facadePanel, 0, H * 0.5, -D * 0.5, W, H, 0.35);
    addCollider(ctx.colliders, cx, 0, cz - D * 0.5, W, H, 0.5);
    [-8.0, 8.0].forEach((wx) => {
      registerBreakableGlass(ctx, addBox(g, boxGeo, greenhouseGlassMat, wx, H * 0.5, D * 0.5, 10.0, H, 0.2));
      addCollider(ctx.colliders, cx + wx, 0, cz + D * 0.5, 10.0, H, 0.45);
    });
    const labSign = trackMat(
      new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture('AI & ROBOTICS LAB', 'NEURAL RESEARCH · PROTOTYPE BAY', '#091224', '#22d3ee')) }),
    );
    addBox(g, boxGeo, labSign, 0, H - 0.85, D * 0.5 + 0.24, 9.0, 1.4, 0.16);

    const labDetail = new THREE.Group();
    g.add(labDetail);
    ctx.lodDetailGroups.push({ group: labDetail, x: cx, z: cz, maxDist: 95 });

    addBox(labDetail, cylGeo, darkJointMat, 0, 0.45, -1.5, 3.4, 0.9, 3.4);
    addBox(labDetail, cylGeo, cyanGlowMat, 0, 0.92, -1.5, 3.2, 0.08, 3.2);
    const labPivot = new THREE.Group();
    labPivot.position.set(0, 1.0, -1.5);
    tagDestructibleMesh(addBox(labPivot, boxGeo, whiteRobotMat, 0, 1.1, 0, 0.45, 2.2, 0.45), 'machine', 2, 'tool_arm', 'metal', shootableMeshes);
    tagDestructibleMesh(addBox(labPivot, boxGeo, whiteRobotMat, 0.8, 2.1, 0, 1.8, 0.36, 0.36), 'machine', 2, 'tool_arm', 'metal', shootableMeshes);
    const labTip = addBox(labPivot, boxGeo, cyanGlowMat, 1.75, 2.1, 0, 0.35, 0.35, 0.35);
    tagDestructibleMesh(labTip, 'machine', 2, 'sensor', 'composite', shootableMeshes);
    labDetail.add(labPivot);
    destructibleArms.push({ idIndex: 2, pivot: labPivot, headTip: labTip, basePhase: 0 });

    [-8.5, 8.5].forEach((rx) => {
      for (let rz = -6; rz <= 3; rz += 3.2) {
        addBox(labDetail, boxGeo, darkJointMat, rx, 1.5, rz, 1.3, 3.0, 1.6);
        addBox(labDetail, boxGeo, cyanGlowMat, rx + (rx < 0 ? 0.68 : -0.68), 1.6, rz, 0.05, 2.1, 0.9);
      }
    });
    const labMonitorMat = ctx.displays.createDisplayMaterial('city_billboard', {
      title: 'ROBOTICS NEURAL CORE',
      subtitle: '30 AGENTS SYNCHRONIZED',
      accentHex: '#22d3ee',
      lockTitle: true,
      intervalSec: 0.9,
    }).material;
    addBox(labDetail, boxGeo, labMonitorMat, 0, 2.4, -D * 0.5 + 0.4, 8.6, 3.0, 0.14);
  }

  // Eco Residences Tower (-80, -490) & Smart Commercial Mall (-92, -568)
  [
    { x: -80, z: -490, w: 22, h: 22, d: 18, label: 'ECO RESIDENCES', accent: '#10b981' },
    { x: -92, z: -568, w: 26, h: 13, d: 18, label: 'SMART COMMERCIAL MALL', accent: '#ec4899' },
  ].forEach((b) => {
    addBox(root, boxGeo, cityPal.concreteDeck, b.x, 0.1, b.z, b.w + 3, 0.2, b.d + 3);
    addBox(root, boxGeo, cityPal.whiteMarble, b.x, b.h * 0.5, b.z, b.w, b.h, b.d);
    addBox(root, boxGeo, smartGlassFacadeMat, b.x, b.h * 0.5, b.z, b.w - 2.0, b.h - 2, b.d + 0.25);
    for (let ty = 6; ty < b.h; ty += 6) {
      addBox(root, boxGeo, lettuceDeepMat, b.x, ty, b.z, b.w + 1.2, 0.42, b.d + 1.2);
    }
    addBox(root, boxGeo, solarPanelMat, b.x, b.h + 0.28, b.z, b.w - 3, 0.2, b.d - 3);
    const sMat = trackMat(new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture(b.label, 'SMART CITY DISTRICT', '#0a1220', b.accent)) }));
    addBox(root, boxGeo, sMat, b.x, 4.4, b.z + b.d * 0.5 + 0.25, 9.5, 1.8, 0.16);
    addCollider(ctx.colliders, b.x, 0, b.z, b.w + 0.5, b.h, b.d + 0.5);
  });

  // Apex Tech University & Science Sub-Dome (-90, -536)
  {
    const ux = -90;
    const uz = -536;
    addBox(root, boxGeo, cityPal.concreteDeck, ux, 0.1, uz, 28, 0.2, 22);
    addBox(root, boxGeo, cityPal.whiteMarble, ux - 9, 5.5, uz, 8, 11, 16);
    addBox(root, boxGeo, cityPal.whiteMarble, ux + 9, 5.5, uz, 8, 11, 16);
    addBox(root, sphereGeo, greenhouseGlassMat, ux, 2.5, uz, 12, 11, 12);
    addBox(root, cylGeo, cyanGlowMat, ux, 0.5, uz, 12.4, 0.35, 12.4);
    const uniSign = trackMat(
      new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture('APEX TECH UNIVERSITY', 'AI · AGTECH · ROBOTICS', '#081726', '#38bdf8')) }),
    );
    addBox(root, boxGeo, uniSign, ux, 8.2, uz + 8.4, 10, 1.8, 0.18);
    addCollider(ctx.colliders, ux - 9, 0, uz, 8.2, 11, 16.2);
    addCollider(ctx.colliders, ux + 9, 0, uz, 8.2, 11, 16.2);
    addCollider(ctx.colliders, ux, 0, uz, 10.5, 8, 10.5);
  }

  // =========================================================================
  // 8. ZONE D: SMART ROBOTICS FACTORY, WAREHOUSE & AI RECYCLING (North Inside Dome)
  // =========================================================================
  const conveyorCrates: THREE.Mesh[] = [];
  {
    const cx = -120;
    const cz = -600;
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    root.add(g);
    const W = 32;
    const D = 22;
    const H = 8.0;

    addBox(g, boxGeo, cityPal.concreteDeck, 0, 0.06, 0, W + 3, 0.12, D + 3);
    addBox(g, boxGeo, metalAlloyMat, 0, H + 0.3, 0, W + 1.2, 0.55, D + 1.2);
    addBox(g, boxGeo, solarPanelMat, 0, H + 0.68, 0, W - 4, 0.16, D - 4);
    [-W * 0.5, W * 0.5].forEach((wx) => {
      addBox(g, boxGeo, cityPal.facadePanel, wx, H * 0.5, 0, 0.5, H, D);
      addCollider(ctx.colliders, cx + wx, 0, cz, 0.65, H, D);
    });
    addBox(g, boxGeo, cityPal.facadePanel, 0, H * 0.5, -D * 0.5, W, H, 0.5);
    addCollider(ctx.colliders, cx, 0, cz - D * 0.5, W, H, 0.65);
    [-10.5, 10.5].forEach((wx) => {
      addBox(g, boxGeo, cityPal.facadePanel, wx, H * 0.5, D * 0.5, 11, H, 0.5);
      addCollider(ctx.colliders, cx + wx, 0, cz + D * 0.5, 11, H, 0.65);
    });
    const facSign = trackMat(
      new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture('SMART ROBOTICS FACTORY', 'AUTOMATED ASSEMBLY & LOGISTICS', '#111827', '#f59e0b')) }),
    );
    addBox(g, boxGeo, facSign, 0, H - 1.0, D * 0.5 + 0.32, 11.0, 1.6, 0.18);

    addBox(g, boxGeo, factoryBeltMat, 0, 0.85, -1.2, 24, 0.5, 2.0);
    for (let c = 0; c < 4; c++) {
      const crate = addBox(g, boxGeo, yellowBotMat, -10 + c * 6.2, 1.52, -1.2, 1.35, 0.85, 1.15);
      conveyorCrates.push(crate);
    }
    [-7.5, -2.5, 2.5, 7.5].forEach((ax, idx) => {
      const mIndex = 3 + idx; // MACHINE_SPECS[3..6] = factory_arm_0..3
      const armBase = new THREE.Group();
      armBase.position.set(ax, 0.4, idx % 2 === 0 ? -3.8 : 1.2);
      tagDestructibleMesh(addBox(armBase, cylGeo, darkJointMat, 0, 0.6, 0, 1.05, 1.2, 1.05), 'machine', mIndex, 'chassis', 'metal', shootableMeshes);
      const armSeg = new THREE.Group();
      armSeg.position.set(0, 1.2, 0);
      tagDestructibleMesh(addBox(armSeg, boxGeo, yellowBotMat, 0, 1.0, 0, 0.4, 2.0, 0.4), 'machine', mIndex, 'tool_arm', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(armSeg, boxGeo, whiteRobotMat, 0, 1.9, idx % 2 === 0 ? 0.8 : -0.8, 0.3, 0.3, 1.6), 'machine', mIndex, 'tool_arm', 'metal', shootableMeshes);
      const tip = addBox(armSeg, boxGeo, cyanGlowMat, 0, 1.85, idx % 2 === 0 ? 1.65 : -1.65, 0.26, 0.26, 0.26);
      tagDestructibleMesh(tip, 'machine', mIndex, 'sensor', 'composite', shootableMeshes);
      armBase.add(armSeg);
      g.add(armBase);
      destructibleArms.push({ idIndex: mIndex, pivot: armSeg, headTip: tip, basePhase: idx * 1.3 });
    });
  }

  // Smart Warehouse (-86, -592) & AI Recycling Plant (-114, -626)
  [
    { x: -86, z: -592, w: 24, h: 10, d: 20, title: 'SMART LOGISTICS WAREHOUSE', sub: 'AGV PALLET BAY', acc: '#f59e0b' },
    { x: -114, z: -626, w: 24, h: 9, d: 18, title: 'AI RECYCLING & RECOVERY', sub: 'ZERO-WASTE SORTING', acc: '#22c55e' },
  ].forEach((b) => {
    addBox(root, boxGeo, cityPal.concreteDeck, b.x, 0.08, b.z, b.w + 3, 0.16, b.d + 3);
    addBox(root, boxGeo, cityPal.facadePanel, b.x, b.h * 0.5, b.z, b.w, b.h, b.d);
    addBox(root, boxGeo, solarPanelMat, b.x, b.h + 0.24, b.z, b.w - 3, 0.16, b.d - 3);
    const sMat = trackMat(new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture(b.title, b.sub, '#0b1420', b.acc)) }));
    addBox(root, boxGeo, sMat, b.x, b.h - 1.8, b.z + b.d * 0.5 + 0.2, 10, 1.7, 0.16);
    addCollider(ctx.colliders, b.x, 0, b.z, b.w + 0.5, b.h, b.d + 0.5);
  });

  // =========================================================================
  // 9. ZONE E: DRONE CONTROL TOWER, CHARGING PADS, SOLAR ARRAY & 8 WIND TURBINES (East Dome)
  // =========================================================================
  const droneRadarRotor = new THREE.Group();
  {
    const tx = -58;
    const tz = -520;
    addBox(root, boxGeo, cityPal.concreteDeck, tx, 0.1, tz, 34, 0.2, 62);
    addBox(root, cylGeo, whiteRobotMat, tx, 11.5, tz, 5.4, 23, 5.4);
    addBox(root, cylGeo, smartGlassFacadeMat, tx, 24.5, tz, 9.6, 3.2, 9.6);
    addBox(root, cylGeo, darkJointMat, tx, 26.3, tz, 10.2, 0.55, 10.2);
    droneRadarRotor.position.set(tx, 27.8, tz);
    addBox(droneRadarRotor, boxGeo, whiteRobotMat, 0, 0, 0, 4.6, 0.55, 0.7);
    addBox(droneRadarRotor, boxGeo, cyanGlowMat, 0, 0.45, 0, 2.0, 0.32, 0.32);
    root.add(droneRadarRotor);
    const towerSign = trackMat(
      new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture('DRONE CONTROL HUB', '18 AUTONOMOUS UAVs · CHARGING BAY', '#071422', '#38bdf8')) }),
    );
    addBox(root, boxGeo, towerSign, tx, 7.6, tz + 3.0, 8.6, 1.8, 0.18);
    addCollider(ctx.colliders, tx, 0, tz, 6.0, 25, 6.0);

    const uniquePads = new Map<string, { x: number; z: number }>();
    DRONE_FLEET_CATALOG.forEach((d) => {
      uniquePads.set(`${d.padX}_${d.padZ}`, { x: d.padX, z: d.padZ });
    });
    uniquePads.forEach((p) => {
      addBox(root, cylGeo, darkJointMat, p.x, 0.18, p.z, 4.8, 0.18, 4.8);
      addBox(root, cylGeo, cyanGlowMat, p.x, 0.28, p.z, 3.6, 0.06, 3.6);
    });
  }

  // Solar PV Farm inside East-NE Dome
  {
    const solarCoords: Array<{ x: number; z: number }> = [];
    for (let sx = -76; sx <= -54; sx += 9.5) {
      for (let sz = -598; sz <= -574; sz += 7.5) {
        solarCoords.push({ x: sx, z: sz });
      }
    }
    const pvPostInst = new THREE.InstancedMesh(cylGeo, solarFrameMat, solarCoords.length);
    const pvPanelInst = new THREE.InstancedMesh(boxGeo, solarPanelMat, solarCoords.length);
    const sDummy = new THREE.Object3D();
    solarCoords.forEach((sc, idx) => {
      sDummy.position.set(sc.x, 0.85, sc.z);
      sDummy.rotation.set(0, 0, 0);
      sDummy.scale.set(0.24, 1.7, 0.24);
      sDummy.updateMatrix();
      pvPostInst.setMatrixAt(idx, sDummy.matrix);

      sDummy.position.set(sc.x, 1.78, sc.z);
      sDummy.rotation.set(0.45, 0, 0);
      sDummy.scale.set(6.0, 0.14, 3.4);
      sDummy.updateMatrix();
      pvPanelInst.setMatrixAt(idx, sDummy.matrix);
    });
    pvPostInst.instanceMatrix.needsUpdate = true;
    pvPanelInst.instanceMatrix.needsUpdate = true;
    root.add(pvPostInst, pvPanelInst);
  }

  // 8 Wind Turbines (19m mast + 6.8m blades = 25.8m max apex -> well inside 44-55m dome glass curve!)
  const turbineRotors: THREE.Group[] = [];
  [
    [-58, -482],
    [-48, -514],
    [-50, -562],
    [-68, -608],
    [-82, -456],
    [-228, -522],
    [-226, -578],
    [-196, -634],
  ].forEach(([wx, wz], idx) => {
    addBox(root, cylGeo, whiteRobotMat, wx, 9.5, wz, 1.1, 19, 1.1);
    addBox(root, boxGeo, whiteRobotMat, wx, 19.1, wz + 0.45, 1.4, 1.4, 2.8);
    const rotor = new THREE.Group();
    rotor.position.set(wx, 19.1, wz + 2.0);
    rotor.rotation.z = idx * 0.7;
    for (let b = 0; b < 3; b++) {
      const arm = new THREE.Group();
      arm.rotation.z = (b / 3) * Math.PI * 2;
      addBox(arm, boxGeo, whiteRobotMat, 0, 3.4, 0, 0.34, 6.8, 0.14);
      rotor.add(arm);
    }
    root.add(rotor);
    turbineRotors.push(rotor);
    addCollider(ctx.colliders, wx, 0, wz, 1.8, 14, 1.8);
  });

  // =========================================================================
  // 10. INTERACTIVE CONTROL TERMINALS ([E] DASHBOARD) & 2 REPAIR & RESTORATION BAYS ([E])
  // =========================================================================
  const termMat = ctx.displays.createDisplayMaterial('smart_farm_telemetry', {
    title: 'SMART CITY AI COMMAND',
    subtitle: 'PRESS [E] TO MANAGE',
    intervalSec: 0.7,
  }).material;

  SMART_CITY_CONTROL_TERMINALS.forEach((term) => {
    addBox(root, boxGeo, darkJointMat, term.x, 0.65, term.z, 0.65, 1.3, 0.45);
    addBox(root, boxGeo, termMat, term.x, 1.55, term.z + 0.12, 1.35, 0.92, 0.14, { rotX: -0.25 });
    const interactable: WorldInteractable = {
      id: term.id,
      x: term.x,
      y: term.y,
      z: term.z,
      radius: 4.0,
      category: 'dashboard',
      getLabel: () => `Open Smart City AI Dashboard (${term.label})`,
      trigger: () => {
        onOpenDashboard?.(term.label);
        return `Opened ${term.label}`;
      },
    };
    ctx.interactables.push(interactable);
  });

  const restoreAllVisuals = (): number => {
    const fixed = repairAllSmartCityUnits(state);
    effectsPool.clearAllMarksAndDebris();
    for (let i = 0; i < robotVisuals.length; i++) {
      const v = robotVisuals[i];
      v.root.rotation.set(0, state.robots[i].yaw, 0);
      v.root.position.set(state.robots[i].x, 0.06, state.robots[i].z);
      v.collapseProgress = 0;
      v.bodyMat.color.setHex(v.baseColorHex);
      v.accMat.color.setHex(v.baseAccentHex);
      v.accMat.emissive.setHex(v.baseAccentHex);
      v.accMat.emissiveIntensity = 0.75;
      if (v.head) v.head.visible = true;
      if (v.leftArm) v.leftArm.visible = true;
      if (v.rightArm) v.rightArm.visible = true;
      if (v.leftLeg) v.leftLeg.visible = true;
      if (v.rightLeg) v.rightLeg.visible = true;
      if (v.toolBoom) v.toolBoom.visible = true;
      if (v.sensorMount) v.sensorMount.visible = true;
      if (v.armorPlates) v.armorPlates.visible = true;
    }
    for (let i = 0; i < droneVisuals.length; i++) {
      const dv = droneVisuals[i];
      const dr = state.drones[i];
      dv.root.position.set(dr.x, dr.y, dr.z);
      dv.root.rotation.set(0, dr.yaw, 0);
      for (let r = 0; r < dv.rotors.length; r++) dv.rotors[r].visible = true;
      if (dv.camPod) dv.camPod.visible = true;
      dv.stripeMat.emissiveIntensity = 1.4;
    }
    for (let i = 0; i < fieldMachines.length; i++) {
      const fm = fieldMachines[i];
      if (fm.headerRoller) fm.headerRoller.visible = true;
      if (fm.toolArm) fm.toolArm.visible = true;
      for (let w = 0; w < fm.wheelMeshes.length; w++) fm.wheelMeshes[w].visible = true;
    }
    return fixed;
  };

  SMART_CITY_REPAIR_STATIONS.forEach((st) => {
    addBox(root, cylGeo, darkJointMat, st.x, 0.12, st.z, 4.6, 0.24, 4.6);
    addBox(root, cylGeo, repairPadGlowMat, st.x, 0.25, st.z, 3.8, 0.06, 3.8);
    addBox(root, boxGeo, darkJointMat, st.x, 1.15, st.z - 2.35, 2.7, 2.3, 0.36);
    const repSign = trackMat(
      new THREE.MeshBasicMaterial({ map: trackTex(makeSignTexture('BOT REPAIR BAY', 'PRESS [E] RESTORE ALL UNITS', '#04221a', '#34d399')) }),
    );
    addBox(root, boxGeo, repSign, st.x, 1.45, st.z - 2.13, 2.45, 1.15, 0.06);
    addBox(root, boxGeo, repSign, st.x, 1.45, st.z - 2.57, 2.45, 1.15, 0.06);
    ctx.interactables.push({
      id: st.id,
      x: st.x,
      y: st.y,
      z: st.z,
      radius: 4.8,
      category: 'refuel',
      getLabel: () => `Repair & Restore All Robots, Drones & Machines (${st.label})`,
      trigger: () => {
        const count = restoreAllVisuals();
        soundEngine.playRepairWeld();
        return count > 0
          ? `Restored ${count} damaged Smart City units & cleared debris!`
          : 'All 30 Robots, 18 Drones & 10 Machines already at 100% integrity!';
      },
    });
  });

  // =========================================================================
  // 11. ALL 30 LIVING DESTRUCTIBLE & COMPONENT-TAGGED ROBOTS
  // =========================================================================
  const buildRobotVisual = (spec: RobotRoleSpec, robotIdx: number): AnimatedRobotVisual => {
    const g = new THREE.Group();
    const p0 = spec.waypoints[0];
    g.position.set(p0.x, 0, p0.z);
    root.add(g);

    const bodyMat = trackMat(new THREE.MeshStandardMaterial({ color: spec.bodyHex, roughness: 0.28, metalness: 0.38 }));
    const accMat = trackMat(
      new THREE.MeshStandardMaterial({ color: spec.accentHex, emissive: spec.accentHex, emissiveIntensity: 0.75, roughness: 0.25 }),
    );

    if (spec.visualKind === 'humanoid' || spec.visualKind === 'assistant') {
      const isCute = spec.visualKind === 'assistant';
      const sc = isCute ? 0.85 : 1.0;
      const head = new THREE.Group();
      head.position.set(0, 1.48 * sc, 0);
      tagDestructibleMesh(addBox(head, sphereGeo, bodyMat, 0, 0, 0, 0.42 * sc, 0.36 * sc, 0.38 * sc), 'robot', robotIdx, 'head', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(head, boxGeo, darkJointMat, 0, 0, 0.16 * sc, 0.32 * sc, 0.2 * sc, 0.08 * sc), 'robot', robotIdx, 'camera', 'glass', shootableMeshes);
      tagDestructibleMesh(addBox(head, sphereGeo, accMat, -0.08 * sc, 0.02 * sc, 0.21 * sc, 0.09 * sc, 0.09 * sc, 0.04 * sc), 'robot', robotIdx, 'sensor', 'glass', shootableMeshes);
      tagDestructibleMesh(addBox(head, sphereGeo, accMat, 0.08 * sc, 0.02 * sc, 0.21 * sc, 0.09 * sc, 0.09 * sc, 0.04 * sc), 'robot', robotIdx, 'sensor', 'glass', shootableMeshes);
      if (isCute) {
        tagDestructibleMesh(addBox(head, cylGeo, darkJointMat, 0.22, 0.22, 0, 0.03, 0.28, 0.03), 'robot', robotIdx, 'sensor', 'metal', shootableMeshes);
        tagDestructibleMesh(addBox(head, sphereGeo, tomatoRedMat, 0.22, 0.36, 0, 0.08, 0.08, 0.08), 'robot', robotIdx, 'sensor', 'glass', shootableMeshes);
      }
      g.add(head);

      const torsoGroup = new THREE.Group();
      tagDestructibleMesh(addBox(torsoGroup, boxGeo, bodyMat, 0, 1.02 * sc, 0, 0.44 * sc, 0.56 * sc, 0.26 * sc), 'robot', robotIdx, 'torso', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(torsoGroup, cylGeo, accMat, 0, 1.08 * sc, 0.14 * sc, 0.16 * sc, 0.04, 0.16 * sc, { rotX: Math.PI * 0.5 }), 'robot', robotIdx, 'battery', 'composite', shootableMeshes);
      const armorPlates = new THREE.Group();
      tagDestructibleMesh(addBox(armorPlates, boxGeo, darkJointMat, 0, 1.06 * sc, -0.14 * sc, 0.36 * sc, 0.38 * sc, 0.08 * sc), 'robot', robotIdx, 'armor', 'metal', shootableMeshes);
      torsoGroup.add(armorPlates);
      g.add(torsoGroup);

      const leftArm = new THREE.Group();
      leftArm.position.set(-0.28 * sc, 1.24 * sc, 0);
      tagDestructibleMesh(addBox(leftArm, boxGeo, bodyMat, 0, -0.26 * sc, 0, 0.13 * sc, 0.48 * sc, 0.13 * sc), 'robot', robotIdx, 'arm_l', 'metal', shootableMeshes);
      g.add(leftArm);

      const rightArm = new THREE.Group();
      rightArm.position.set(0.28 * sc, 1.24 * sc, 0);
      tagDestructibleMesh(addBox(rightArm, boxGeo, bodyMat, 0, -0.26 * sc, 0, 0.13 * sc, 0.48 * sc, 0.13 * sc), 'robot', robotIdx, 'arm_r', 'metal', shootableMeshes);
      g.add(rightArm);

      const leftLeg = new THREE.Group();
      leftLeg.position.set(-0.12 * sc, 0.72 * sc, 0);
      tagDestructibleMesh(addBox(leftLeg, boxGeo, bodyMat, 0, -0.35 * sc, 0, 0.15 * sc, 0.68 * sc, 0.16 * sc), 'robot', robotIdx, 'leg_l', 'metal', shootableMeshes);
      g.add(leftLeg);

      const rightLeg = new THREE.Group();
      rightLeg.position.set(0.12 * sc, 0.72 * sc, 0);
      tagDestructibleMesh(addBox(rightLeg, boxGeo, bodyMat, 0, -0.35 * sc, 0, 0.15 * sc, 0.68 * sc, 0.16 * sc), 'robot', robotIdx, 'leg_r', 'metal', shootableMeshes);
      g.add(rightLeg);

      return {
        root: g,
        bodyMat,
        accMat,
        baseColorHex: spec.bodyHex,
        baseAccentHex: spec.accentHex,
        torsoGroup,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        head,
        armorPlates,
        collapseProgress: 0,
        collapseDir: robotIdx % 2 === 0 ? 1 : -1,
      };
    }

    if (spec.visualKind === 'rover_arm') {
      tagDestructibleMesh(addBox(g, boxGeo, bodyMat, 0, 0.42, 0, 0.9, 0.58, 1.25), 'robot', robotIdx, 'chassis', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(g, boxGeo, accMat, 0, 0.28, 0.63, 0.85, 0.1, 0.06), 'robot', robotIdx, 'battery', 'composite', shootableMeshes);
      const armorPlates = new THREE.Group();
      tagDestructibleMesh(addBox(armorPlates, boxGeo, darkJointMat, 0, 0.68, -0.32, 0.72, 0.16, 0.44), 'robot', robotIdx, 'armor', 'metal', shootableMeshes);
      g.add(armorPlates);

      const wheelsGroup = new THREE.Group();
      [
        [-0.48, 0.45],
        [0.48, 0.45],
        [-0.48, -0.45],
        [0.48, -0.45],
      ].forEach(([wx, wz]) => {
        tagDestructibleMesh(addBox(wheelsGroup, cylGeo, darkJointMat, wx, 0.18, wz, 0.36, 0.14, 0.36, { rotZ: Math.PI * 0.5 }), 'robot', robotIdx, 'wheel', 'rubber', shootableMeshes);
      });
      g.add(wheelsGroup);

      const toolBoom = new THREE.Group();
      toolBoom.position.set(0, 0.72, 0.15);
      tagDestructibleMesh(addBox(toolBoom, boxGeo, bodyMat, 0, 0.45, 0, 0.18, 0.9, 0.18), 'robot', robotIdx, 'tool_arm', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(toolBoom, boxGeo, bodyMat, 0, 0.92, 0.42, 0.16, 0.16, 0.85), 'robot', robotIdx, 'tool_arm', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(toolBoom, cylGeo, accMat, 0, 0.86, 0.88, 0.18, 0.18, 0.18), 'robot', robotIdx, 'sensor', 'glass', shootableMeshes);
      let sprayCone: THREE.Mesh | undefined;
      if (spec.id === 'watering_robot' || spec.id === 'gardening_robot') {
        sprayCone = new THREE.Mesh(coneGeo, sprayMistMat);
        sprayCone.position.set(0, 0.4, 1.05);
        sprayCone.scale.set(0.85, 0.95, 0.85);
        sprayCone.rotation.x = Math.PI * 0.12;
        toolBoom.add(sprayCone);
      }
      g.add(toolBoom);
      return {
        root: g,
        bodyMat,
        accMat,
        baseColorHex: spec.bodyHex,
        baseAccentHex: spec.accentHex,
        toolBoom,
        armorPlates,
        leftLeg: wheelsGroup,
        sprayCone,
        collapseProgress: 0,
        collapseDir: robotIdx % 2 === 0 ? 1 : -1,
      };
    }

    if (spec.visualKind === 'rover_camera') {
      tagDestructibleMesh(addBox(g, boxGeo, bodyMat, 0, 0.38, 0, 0.78, 0.46, 1.05), 'robot', robotIdx, 'chassis', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(g, boxGeo, darkJointMat, 0, 0.42, 0.54, 0.64, 0.34, 0.06), 'robot', robotIdx, 'armor', 'composite', shootableMeshes);
      [
        [-0.45, 0.38],
        [0.45, 0.38],
        [-0.45, -0.38],
        [0.45, -0.38],
      ].forEach(([wx, wz]) => {
        tagDestructibleMesh(addBox(g, cylGeo, darkJointMat, wx, 0.18, wz, 0.36, 0.14, 0.36, { rotZ: Math.PI * 0.5 }), 'robot', robotIdx, 'wheel', 'rubber', shootableMeshes);
      });
      const head = new THREE.Group();
      head.position.set(0, 0.62, 0.15);
      tagDestructibleMesh(addBox(head, cylGeo, darkJointMat, 0, 0.25, 0, 0.1, 0.5, 0.1), 'robot', robotIdx, 'sensor', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(head, boxGeo, bodyMat, 0, 0.52, 0, 0.48, 0.22, 0.22), 'robot', robotIdx, 'head', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(head, sphereGeo, accMat, -0.14, 0.52, 0.12, 0.09, 0.09, 0.06), 'robot', robotIdx, 'camera', 'glass', shootableMeshes);
      tagDestructibleMesh(addBox(head, sphereGeo, accMat, 0.14, 0.52, 0.12, 0.09, 0.09, 0.06), 'robot', robotIdx, 'camera', 'glass', shootableMeshes);
      g.add(head);
      return {
        root: g,
        bodyMat,
        accMat,
        baseColorHex: spec.bodyHex,
        baseAccentHex: spec.accentHex,
        head,
        collapseProgress: 0,
        collapseDir: robotIdx % 2 === 0 ? 1 : -1,
      };
    }

    const isHeavy = spec.visualKind === 'heavy_loader';
    tagDestructibleMesh(addBox(g, boxGeo, bodyMat, 0, isHeavy ? 0.55 : 0.42, 0, isHeavy ? 1.35 : 0.92, isHeavy ? 0.75 : 0.58, isHeavy ? 1.8 : 1.25), 'robot', robotIdx, 'chassis', 'metal', shootableMeshes);
    const sensorMount = new THREE.Group();
    tagDestructibleMesh(addBox(sensorMount, boxGeo, accMat, 0, isHeavy ? 0.96 : 0.74, 0, isHeavy ? 1.05 : 0.72, 0.14, isHeavy ? 1.25 : 0.85), 'robot', robotIdx, 'sensor', 'composite', shootableMeshes);
    g.add(sensorMount);
    const toolBoom = new THREE.Group();
    if (isHeavy) {
      toolBoom.position.set(0, 0.65, 0.92);
      tagDestructibleMesh(addBox(toolBoom, boxGeo, darkJointMat, -0.4, 0, 0.35, 0.14, 0.12, 0.75), 'robot', robotIdx, 'tool_arm', 'metal', shootableMeshes);
      tagDestructibleMesh(addBox(toolBoom, boxGeo, darkJointMat, 0.4, 0, 0.35, 0.14, 0.12, 0.75), 'robot', robotIdx, 'tool_arm', 'metal', shootableMeshes);
      g.add(toolBoom);
    }
    return {
      root: g,
      bodyMat,
      accMat,
      baseColorHex: spec.bodyHex,
      baseAccentHex: spec.accentHex,
      sensorMount,
      toolBoom: isHeavy ? toolBoom : undefined,
      collapseProgress: 0,
      collapseDir: robotIdx % 2 === 0 ? 1 : -1,
    };
  };

  const robotVisuals = ROBOT_ROLE_CATALOG.map((spec, idx) => buildRobotVisual(spec, idx));

  // =========================================================================
  // 12. ALL 18 AUTONOMOUS DESTRUCTIBLE & CRASHABLE DRONES
  // =========================================================================
  const rotorBlurGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 0.014, 14));
  const rotorBlurMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const droneVisuals: AnimatedDroneVisual[] = DRONE_FLEET_CATALOG.map((d, dIdx) => {
    const dg = new THREE.Group();
    root.add(dg);

    const bodyCol = d.style === 'security_dark' ? darkJointMat : whiteRobotMat;
    const stripeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: d.style === 'security_dark' ? 0x38bdf8 : d.style === 'phantom_cam' ? 0xef4444 : 0x22d3ee,
        emissive: d.style === 'security_dark' ? 0x0ea5e9 : d.style === 'phantom_cam' ? 0xdc2626 : 0x06b6d4,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      }),
    );

    tagDestructibleMesh(addBox(dg, boxGeo, bodyCol, 0, 0.18, 0, 0.68, 0.26, 0.88), 'drone', dIdx, 'chassis', 'composite', shootableMeshes);
    tagDestructibleMesh(addBox(dg, boxGeo, stripeMat, 0, 0.33, 0, 0.44, 0.08, 0.44), 'drone', dIdx, 'battery', 'composite', shootableMeshes);
    let camPod: THREE.Object3D | undefined;
    if (d.style === 'sprayer_white') {
      camPod = addBox(dg, boxGeo, bodyCol, 0, -0.05, 0, 0.44, 0.26, 0.52);
      tagDestructibleMesh(camPod, 'drone', dIdx, 'motor', 'metal', shootableMeshes);
    } else if (d.style === 'phantom_cam') {
      camPod = addBox(dg, sphereGeo, darkJointMat, 0, -0.1, 0.12, 0.24, 0.24, 0.28);
      tagDestructibleMesh(camPod, 'drone', dIdx, 'camera', 'glass', shootableMeshes);
    } else if (d.style === 'cargo_white') {
      camPod = addBox(dg, boxGeo, woodCrateMat, 0, -0.12, 0, 0.5, 0.26, 0.5);
      tagDestructibleMesh(camPod, 'drone', dIdx, 'battery', 'composite', shootableMeshes);
    }

    const rotors: THREE.Object3D[] = [];
    [
      [-0.68, 0.68],
      [0.68, 0.68],
      [-0.68, -0.68],
      [0.68, -0.68],
    ].forEach(([rx, rz], rIdx) => {
      tagDestructibleMesh(
        addBox(dg, boxGeo, darkJointMat, rx * 0.5, 0.2, rz * 0.5, 0.92, 0.07, 0.09, { rotY: Math.atan2(rx, rz) }),
        'drone',
        dIdx,
        'motor',
        'metal',
        shootableMeshes,
      );
      const rHub = new THREE.Group();
      rHub.position.set(rx, 0.29, rz);
      const compName = (`rotor_${rIdx}`) as SmartCityComponentKind;
      tagDestructibleMesh(addBox(rHub, boxGeo, metalAlloyMat, 0, 0, 0, 0.92, 0.035, 0.11), 'drone', dIdx, compName, 'composite', shootableMeshes);
      tagDestructibleMesh(addBox(rHub, boxGeo, metalAlloyMat, 0, 0, 0, 0.11, 0.035, 0.92), 'drone', dIdx, compName, 'composite', shootableMeshes);
      addBox(rHub, cylGeo, stripeMat, 0, 0.03, 0, 0.14, 0.05, 0.14);
      const blurDisc = new THREE.Mesh(rotorBlurGeo, rotorBlurMat);
      blurDisc.renderOrder = 3;
      rHub.add(blurDisc);
      dg.add(rHub);
      rotors.push(rHub);
    });

    let mistCone: THREE.Mesh | undefined;
    if (d.hasMist) {
      mistCone = new THREE.Mesh(coneGeo, sprayMistMat);
      mistCone.position.set(0, -1.35, 0);
      mistCone.scale.set(2.2, 2.5, 2.2);
      dg.add(mistCone);
    }

    return { root: dg, bodyMat: bodyCol, stripeMat, rotors, camPod, mistCone };
  });

  // =========================================================================
  // 13. AUTONOMOUS FIELD TRACTOR, HARVESTER & 3 ELECTRIC CITY SHUTTLES (Destructible Machinery)
  // =========================================================================
  const fieldMachines: AutonomousFieldMachine[] = [
    {
      // MACHINE_SPECS[0]: tractor_1
      idIndex: 0,
      root: new THREE.Group(),
      waypoints: [
        { x: -194, z: -498 },
        { x: -222, z: -498 },
        { x: -222, z: -544 },
        { x: -194, z: -544 },
      ],
      speed: 4.1,
      segIdx: 0,
      progress: 0,
      wheelMeshes: [],
    },
    {
      // MACHINE_SPECS[1]: harvester_1
      idIndex: 1,
      root: new THREE.Group(),
      waypoints: [
        { x: -214, z: -522 },
        { x: -190, z: -522 },
        { x: -190, z: -552 },
        { x: -214, z: -552 },
      ],
      speed: 3.8,
      segIdx: 1,
      progress: 0.25,
      wheelMeshes: [],
    },
  ];
  {
    const tg = fieldMachines[0].root;
    tagDestructibleMesh(addBox(tg, boxGeo, lettuceDeepMat, 0, 1.15, 0, 1.9, 1.35, 3.4), 'machine', 0, 'chassis', 'metal', shootableMeshes);
    tagDestructibleMesh(addBox(tg, boxGeo, greenhouseGlassMat, 0, 2.15, -0.35, 1.6, 1.0, 1.5), 'machine', 0, 'cab', 'glass', shootableMeshes);
    const wheels0 = [
      addBox(tg, cylGeo, darkJointMat, -1.05, 0.68, -1.0, 1.35, 0.45, 1.35, { rotZ: Math.PI * 0.5 }),
      addBox(tg, cylGeo, darkJointMat, 1.05, 0.68, -1.0, 1.35, 0.45, 1.35, { rotZ: Math.PI * 0.5 }),
      addBox(tg, cylGeo, darkJointMat, -0.95, 0.45, 1.15, 0.9, 0.35, 0.9, { rotZ: Math.PI * 0.5 }),
      addBox(tg, cylGeo, darkJointMat, 0.95, 0.45, 1.15, 0.9, 0.35, 0.9, { rotZ: Math.PI * 0.5 }),
    ];
    wheels0.forEach((w) => tagDestructibleMesh(w, 'machine', 0, 'wheel', 'rubber', shootableMeshes));
    fieldMachines[0].wheelMeshes.push(...wheels0);
    root.add(tg);

    const hg = fieldMachines[1].root;
    tagDestructibleMesh(addBox(hg, boxGeo, yellowBotMat, 0, 1.45, 0, 2.4, 1.85, 4.2), 'machine', 1, 'chassis', 'metal', shootableMeshes);
    tagDestructibleMesh(addBox(hg, boxGeo, greenhouseGlassMat, 0, 2.6, 1.1, 1.9, 1.1, 1.4), 'machine', 1, 'cab', 'glass', shootableMeshes);
    const roller = addBox(hg, cylGeo, tomatoRedMat, 0, 0.65, 2.6, 0.72, 3.4, 0.72, { rotZ: Math.PI * 0.5 });
    tagDestructibleMesh(roller, 'machine', 1, 'roller', 'metal', shootableMeshes);
    fieldMachines[1].headerRoller = roller;
    root.add(hg);
  }

  // 3 Autonomous Electric City Shuttles gliding along the Dome Exploration Loop (MACHINE_SPECS[7..9])
  const domeShuttlePath = SMART_CITY_SINGLE_ROAD_POINTS.slice(3, 10); // Gate 1 -> serpentine interior -> Gate 2
  const shuttles: AutonomousCityShuttle[] = [0, 1, 2].map((idx) => {
    const mIndex = 7 + idx;
    const sg = new THREE.Group();
    tagDestructibleMesh(addBox(sg, boxGeo, whiteRobotMat, 0, 1.25, 0, 2.35, 1.95, 6.0), 'machine', mIndex, 'chassis', 'metal', shootableMeshes);
    tagDestructibleMesh(addBox(sg, boxGeo, darkJointMat, 0, 1.55, 0, 2.42, 0.92, 5.1), 'machine', mIndex, 'chassis', 'metal', shootableMeshes);
    tagDestructibleMesh(addBox(sg, boxGeo, smartGlassFacadeMat, 0, 1.55, 0, 2.45, 0.74, 4.8), 'machine', mIndex, 'cab', 'glass', shootableMeshes);
    tagDestructibleMesh(addBox(sg, boxGeo, solarFrameMat, 0, 2.32, 0, 1.45, 0.2, 3.4), 'machine', mIndex, 'battery', 'composite', shootableMeshes);
    tagDestructibleMesh(addBox(sg, cylGeo, cyanGlowMat, 0, 2.48, 1.1, 0.34, 0.16, 0.34), 'machine', mIndex, 'sensor', 'glass', shootableMeshes);
    addBox(sg, boxGeo, cyanGlowMat, 0, 0.38, 0, 2.42, 0.12, 6.04);
    addBox(sg, boxGeo, cyanGlowMat, 0, 0.78, 3.03, 2.0, 0.14, 0.08);
    addBox(sg, boxGeo, tomatoRedMat, 0, 0.78, -3.03, 2.0, 0.14, 0.08);
    const wheels: THREE.Object3D[] = [];
    [
      [-1.12, 1.95],
      [1.12, 1.95],
      [-1.12, -1.95],
      [1.12, -1.95],
    ].forEach(([wx, wz]) => {
      const wm = addBox(sg, cylGeo, darkJointMat, wx, 0.42, wz, 0.8, 0.28, 0.8, { rotZ: Math.PI * 0.5 });
      tagDestructibleMesh(wm, 'machine', mIndex, 'wheel', 'rubber', shootableMeshes);
      wheels.push(wm);
    });
    root.add(sg);
    return {
      idIndex: mIndex,
      root: sg,
      waypoints: domeShuttlePath,
      forward: idx % 2 === 0,
      speed: 7.5,
      segIdx: idx * 2,
      progress: 0.2,
      wheelMeshes: wheels,
    };
  });

  // =========================================================================
  // 14. DESTRUCTION APPLY & EXPLOSION HANDLERS
  // =========================================================================
  const syncEntityDetachedParts = (kind: SmartCityTargetKind, index: number, newlyDetached: SmartCityComponentKind[]) => {
    if (newlyDetached.length === 0) return;

    if (kind === 'robot') {
      const rVis = robotVisuals[index];
      const ag = state.robots[index];
      if (!rVis || !ag) return;
      for (let i = 0; i < newlyDetached.length; i++) {
        const comp = newlyDetached[i];
        let hidden = false;
        if (comp === 'head' && rVis.head && rVis.head.visible) {
          rVis.head.visible = false;
          hidden = true;
        } else if (comp === 'arm_l' && rVis.leftArm && rVis.leftArm.visible) {
          rVis.leftArm.visible = false;
          hidden = true;
        } else if (comp === 'arm_r' && rVis.rightArm && rVis.rightArm.visible) {
          rVis.rightArm.visible = false;
          hidden = true;
        } else if (comp === 'leg_l' && rVis.leftLeg && rVis.leftLeg.visible) {
          rVis.leftLeg.visible = false;
          hidden = true;
        } else if (comp === 'leg_r' && rVis.rightLeg && rVis.rightLeg.visible) {
          rVis.rightLeg.visible = false;
          hidden = true;
        } else if (comp === 'tool_arm' && rVis.toolBoom && rVis.toolBoom.visible) {
          rVis.toolBoom.visible = false;
          hidden = true;
        } else if ((comp === 'sensor' || comp === 'camera') && rVis.sensorMount && rVis.sensorMount.visible) {
          rVis.sensorMount.visible = false;
          hidden = true;
        } else if (comp === 'armor' && rVis.armorPlates && rVis.armorPlates.visible) {
          rVis.armorPlates.visible = false;
          hidden = true;
        }
        if (hidden || comp === 'armor' || comp === 'sensor') {
          effectsPool.spawnDetachedDebris(ag.x, 1.05, ag.z, comp, rVis.baseColorHex, 1.0);
        }
      }
    } else if (kind === 'drone') {
      const dVis = droneVisuals[index];
      const dr = state.drones[index];
      if (!dVis || !dr) return;
      for (let i = 0; i < newlyDetached.length; i++) {
        const comp = newlyDetached[i];
        if (comp.startsWith('rotor_')) {
          const rIdx = Number(comp.slice(-1));
          const rotor = dVis.rotors[rIdx];
          if (rotor && rotor.visible) {
            rotor.visible = false;
            effectsPool.spawnDetachedDebris(dr.x, dr.y, dr.z, comp, 0xcbd5e1, 1.15);
          }
        } else if ((comp === 'camera' || comp === 'motor' || comp === 'battery') && dVis.camPod && dVis.camPod.visible) {
          dVis.camPod.visible = false;
          effectsPool.spawnDetachedDebris(dr.x, dr.y, dr.z, comp, 0x334155, 0.9);
        }
      }
    } else if (kind === 'machine') {
      if (index === 0 || index === 1) {
        const fm = fieldMachines[index];
        const pos = fm.root.position;
        for (let i = 0; i < newlyDetached.length; i++) {
          const comp = newlyDetached[i];
          if (comp === 'roller' && fm.headerRoller && fm.headerRoller.visible) {
            fm.headerRoller.visible = false;
          }
          effectsPool.spawnDetachedDebris(pos.x, pos.y + 1.1, pos.z, comp, 0xf59e0b, 1.1);
        }
      } else {
        const worldPos = new THREE.Vector3();
        if (index >= 2 && index <= 6) {
          const arm = destructibleArms.find((a) => a.idIndex === index);
          arm?.pivot.getWorldPosition(worldPos);
        } else {
          const sh = shuttles[index - 7];
          if (sh) worldPos.copy(sh.root.position);
        }
        for (let i = 0; i < newlyDetached.length; i++) {
          effectsPool.spawnDetachedDebris(worldPos.x, worldPos.y + 1.0, worldPos.z, newlyDetached[i], 0x94a3b8, 1.0);
        }
      }
    }
  };

  const getEntityState = (kind: SmartCityTargetKind, index: number): DestructibleEntityState | null => {
    if (kind === 'robot') return state.robots[index]?.damage ?? null;
    if (kind === 'drone') return state.drones[index]?.damage ?? null;
    if (kind === 'machine') return state.machines[index] ?? null;
    return null;
  };

  const handleBulletHit = (
    obj: THREE.Object3D,
    point: THREE.Vector3,
    normal: THREE.Vector3,
    rayDir: THREE.Vector3,
    weaponId: string,
    baseDamage: number,
  ): SmartCityBulletImpactResult => {
    const meta = obj.userData.scTarget as SmartCityHitTargetMeta | undefined;
    if (!meta) return { hit: false };

    const outcome = damageSmartCityTarget(
      state,
      meta.kind,
      meta.index,
      weaponId,
      baseDamage,
      meta.component,
      rayDir.x,
      rayDir.z,
    );
    if (!outcome) return { hit: false };

    const dist = 12; // Proximity scaled impact SFX
    soundEngine.playMetallicImpact(meta.material, dist);
    effectsPool.spawnMaterialImpact(
      point,
      normal,
      meta.material,
      outcome.profile.sparkCount,
      outcome.profile.shrapnelCount,
      outcome.profile.particleScale,
      outcome.profile.craterScale,
      obj,
    );

    if (outcome.stageChanged || outcome.componentBroken) {
      soundEngine.playElectricSpark(outcome.newlyDestroyed || outcome.componentBroken, dist);
    }
    if (outcome.newlyDetached.length > 0) {
      soundEngine.playPartSnap(dist);
      syncEntityDetachedParts(meta.kind, meta.index, outcome.newlyDetached);
    }
    if (outcome.newlyDestroyed) {
      effectsPool.spawnSmokePuff(point.x, point.y + 0.4, point.z, 1.0);
    }

    const ent = getEntityState(meta.kind, meta.index);
    return {
      hit: true,
      outcome,
      kind: meta.kind,
      component: meta.component,
      label: ent?.label,
    };
  };

  const handleExplosion = (center: THREE.Vector3, radius: number, maxDamage: number): boolean => {
    let anyHit = false;
    const radSq = radius * radius;
    const checkApply = (
      kind: SmartCityTargetKind,
      idx: number,
      ex: number,
      ey: number,
      ez: number,
    ) => {
      const dx = ex - center.x;
      const dy = ey - center.y;
      const dz = ez - center.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq > radSq) return;
      const d = Math.sqrt(dSq);
      const falloff = Math.max(0.25, 1 - d / radius);
      const out = damageSmartCityTarget(
        state,
        kind,
        idx,
        'rocket',
        Math.round(maxDamage * falloff),
        'chassis',
        dx,
        dz,
      );
      if (out) {
        anyHit = true;
        if (out.newlyDetached.length > 0) {
          syncEntityDetachedParts(kind, idx, out.newlyDetached);
        }
        effectsPool.spawnSmokePuff(ex, ey + 0.4, ez, 0.95);
      }
    };

    for (let i = 0; i < state.robots.length; i++) {
      checkApply('robot', i, state.robots[i].x, 0.9, state.robots[i].z);
    }
    for (let i = 0; i < state.drones.length; i++) {
      checkApply('drone', i, state.drones[i].x, state.drones[i].y, state.drones[i].z);
    }
    for (let m = 0; m < fieldMachines.length; m++) {
      const pos = fieldMachines[m].root.position;
      checkApply('machine', fieldMachines[m].idIndex, pos.x, pos.y + 1.0, pos.z);
    }
    for (let s = 0; s < shuttles.length; s++) {
      const pos = shuttles[s].root.position;
      checkApply('machine', shuttles[s].idIndex, pos.x, pos.y + 1.0, pos.z);
    }
    return anyHit;
  };

  const getAimTargetInfo = (obj: THREE.Object3D | null | undefined): SmartCityAimTargetInfo | null => {
    if (!obj) return null;
    const meta = obj.userData.scTarget as SmartCityHitTargetMeta | undefined;
    if (!meta) return null;
    const ent = getEntityState(meta.kind, meta.index);
    if (!ent) return null;
    return {
      label: ent.label,
      kind: meta.kind,
      hp: ent.hp,
      maxHp: ent.maxHp,
      stage: ent.stage,
      stageLabel: ent.stage === 0 ? getStageStatusTag(0) : getStageLabel(ent.stage),
      component: meta.component.replace(/_/g, ' ').toUpperCase(),
    };
  };

  // =========================================================================
  // 15. CONTINUOUS SHUTTLE / FIELD MACHINE HELPERS & UPDATE LOOP
  // =========================================================================
  const stepShuttleAlongSingleRoad = (
    s: AutonomousCityShuttle,
    dt: number,
    allShuttles: ReadonlyArray<AutonomousCityShuttle>,
  ) => {
    const pts = s.waypoints;
    if (pts.length < 2) return;
    const p0 = pts[s.segIdx];
    const nextIdx = s.forward ? s.segIdx + 1 : s.segIdx - 1;
    if (nextIdx < 0 || nextIdx >= pts.length) {
      s.forward = !s.forward;
      s.progress = 0;
      return;
    }
    const p1 = pts[nextIdx];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const dist = Math.hypot(dx, dz) || 1;
    const fx = dx / dist;
    const fz = dz / dist;
    // Right-hand lane normal perpendicular to direction of travel (+2.25m separates oncoming lanes cleanly)
    const rx = -fz;
    const rz = fx;
    const laneOffset = 2.25;

    // Headway yield check so two shuttles in the same lane or tight corner never overlap/pass through each other
    let throttle = 1;
    const curX = p0.x + dx * s.progress + rx * laneOffset;
    const curZ = p0.z + dz * s.progress + rz * laneOffset;
    for (let o = 0; o < allShuttles.length; o++) {
      const other = allShuttles[o];
      if (other === s) continue;
      const ox = other.root.position.x - curX;
      const oz = other.root.position.z - curZ;
      const fwdGap = ox * fx + oz * fz;
      const latGap = Math.abs(ox * rx + oz * rz);
      if (fwdGap > 0.2 && fwdGap < 11.5 && latGap < 3.1) {
        const clamped = Math.max(0, (fwdGap - 6.8) / 4.7);
        if (clamped < throttle) throttle = clamped;
      }
    }

    const advance = (s.speed * throttle * dt) / dist;
    s.progress += advance;
    if (s.progress >= 1) {
      s.segIdx = nextIdx;
      s.progress = 0;
      return;
    }
    s.root.position.set(p0.x + dx * s.progress + rx * laneOffset, 0.08, p0.z + dz * s.progress + rz * laneOffset);
    s.root.rotation.y = Math.atan2(dx, dz);
    const wheelDelta = (s.speed * throttle * dt) / 0.4;
    for (let w = 0; w < s.wheelMeshes.length; w++) {
      s.wheelMeshes[w].rotation.x += wheelDelta;
    }
  };

  const stepWaypointVehicle = (
    v: { root: THREE.Group; waypoints: ReadonlyArray<{ x: number; z: number }>; speed: number; segIdx: number; progress: number },
    dt: number,
  ) => {
    const p0 = v.waypoints[v.segIdx];
    const nextIdx = (v.segIdx + 1) % v.waypoints.length;
    const p1 = v.waypoints[nextIdx];
    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;
    const dist = Math.hypot(dx, dz) || 1;
    v.progress += (v.speed * dt) / dist;
    if (v.progress >= 1) {
      v.segIdx = nextIdx;
      v.progress -= Math.floor(v.progress);
    }
    const cur = v.waypoints[v.segIdx];
    const nxt = v.waypoints[(v.segIdx + 1) % v.waypoints.length];
    const ndx = nxt.x - cur.x;
    const ndz = nxt.z - cur.z;
    v.root.position.set(cur.x + ndx * v.progress, 0.08, cur.z + ndz * v.progress);
    v.root.rotation.y = Math.atan2(ndx, ndz);
  };

  let lastGrowthVis = state.cropGrowthStage;
  let smokePulseAccum = 0;
  const tmpArmWorld = new THREE.Vector3();

  return {
    root,
    getState: () => state,
    getShootableMeshes: () => shootableMeshes,
    getAimTargetInfo,
    handleBulletHit,
    handleExplosion,
    repairAll: restoreAllVisuals,
    applyCommand: (cmd: SmartCityCommand) => {
      if (cmd.type === 'repair_all') {
        restoreAllVisuals();
      } else {
        applySmartCityCommand(state, cmd);
      }
      updateCropGrowthVisuals(state.cropGrowthStage);
      lastGrowthVis = state.cropGrowthStage;
    },
    update: (
      dt: number,
      elapsed: number,
      nightFactor: number,
      daylightFactor: number,
      playerPos: THREE.Vector3,
      vehiclePos?: THREE.Vector3 | null,
      cameraPos?: THREE.Vector3 | null,
      extraActors?: ReadonlyArray<{ x: number; z: number }>,
    ) => {
      stepSmartCityState(state, dt, daylightFactor);

      const camX = cameraPos?.x ?? playerPos.x;
      const camZ = cameraPos?.z ?? playerPos.z;
      const camDomeDistSq =
        (camX - SMART_CITY_DOME.centerX) * (camX - SMART_CITY_DOME.centerX) +
        (camZ - SMART_CITY_DOME.centerZ) * (camZ - SMART_CITY_DOME.centerZ);

      // Update Both Dome Automatic Sliding Gates whenever player, driven vehicle, or transit bus is nearby
      for (let gIdx = 0; gIdx < domeGates.length; gIdx++) {
        const dg = domeGates[gIdx];
        let minDist = Math.hypot(playerPos.x - dg.spec.x, playerPos.z - dg.spec.z);
        if (vehiclePos) {
          const vd = Math.hypot(vehiclePos.x - dg.spec.x, vehiclePos.z - dg.spec.z);
          if (vd < minDist) minDist = vd;
        }
        if (extraActors) {
          for (let ei = 0; ei < extraActors.length; ei++) {
            const ed = Math.hypot(extraActors[ei].x - dg.spec.x, extraActors[ei].z - dg.spec.z);
            if (ed < minDist) minDist = ed;
          }
        }
        const gateRes = stepProximityPortal(
          dg.openProgress,
          minDist,
          dg.spec.openRadius,
          dg.spec.closeRadius,
          dt,
          2.1,
          1.4,
        );
        if (gateRes.targetOpen !== dg.prevTargetOpen) {
          dg.prevTargetOpen = gateRes.targetOpen;
          if (minDist < 42) {
            soundEngine.playGateChime(gateRes.targetOpen === 1, minDist);
          }
        }
        dg.openProgress = gateRes.open;
        const slideOffset = dg.openProgress * 7.2;
        const leftLocalX = -4.05 - slideOffset;
        const rightLocalX = 4.05 + slideOffset;
        dg.leftLeaf.position.x = leftLocalX;
        dg.rightLeaf.position.x = rightLocalX;
        const pistonLen = Math.max(1.2, 3.6 - dg.openProgress * 2.2);
        dg.leftPiston.scale.y = pistonLen;
        dg.leftPiston.position.x = -5.6 - dg.openProgress * 1.1;
        dg.rightPiston.scale.y = pistonLen;
        dg.rightPiston.position.x = 5.6 + dg.openProgress * 1.1;

        // Sync rotated OBB leaf colliders smoothly so closed/opening doors block ALL vehicles & player!
        const cosY = Math.cos(dg.spec.yaw);
        const sinY = Math.sin(dg.spec.yaw);
        const leafActive = dg.openProgress < 0.85;
        const updateLeafCol = (col: ColliderBox, lx: number) => {
          const cx = dg.spec.x + lx * cosY + 0.18 * sinY;
          const cz = dg.spec.z - lx * sinY + 0.18 * cosY;
          const extX = Math.abs(col.halfW * cosY) + Math.abs(col.halfD * sinY);
          const extZ = Math.abs(col.halfW * sinY) + Math.abs(col.halfD * cosY);
          col.cx = cx;
          col.cz = cz;
          col.minX = cx - extX;
          col.maxX = cx + extX;
          col.minZ = cz - extZ;
          col.maxZ = cz + extZ;
          col.maxY = leafActive ? 6.2 : -100;
        };
        updateLeafCol(dg.leftCollider, leftLocalX);
        updateLeafCol(dg.rightCollider, rightLocalX);
        dg.ledBarMat.color.setHex(dg.openProgress > 0.35 ? 0x67e8f9 : 0xe0f7ff);
      }

      // Skip all heavy visual/particle/robot/drone matrix updates when culled/far away
      if (!root.visible || camDomeDistSq > 400 * 400) {
        return;
      }

      effectsPool.update(dt, camX, camZ);

      smokePulseAccum += dt;
      const emitSmokeTick = smokePulseAccum >= 0.24;
      if (emitSmokeTick) smokePulseAccum = 0;

      if (state.securityAlert) {
        const flash = Math.sin(elapsed * 11) > 0;
        securityBeaconMat.color.setHex(flash ? 0xef4444 : 0x38bdf8);
        securityBeaconMat.emissive.setHex(flash ? 0xdc2626 : 0x0ea5e9);
      } else {
        securityBeaconMat.color.setHex(0x38bdf8);
        securityBeaconMat.emissive.setHex(0x0ea5e9);
      }

      if (Math.abs(state.cropGrowthStage - lastGrowthVis) > 0.02) {
        updateCropGrowthVisuals(state.cropGrowthStage);
        lastGrowthVis = state.cropGrowthStage;
      }

      const irrActive = state.irrigationMode !== 'conserve';
      irrSprayCone.visible = irrActive;
      if (irrActive) {
        const pulse = state.irrigationMode === 'boost' ? 1.25 : 0.95;
        irrSprayCone.scale.set(5.4 * pulse, 3.2 * pulse, 3.8 * pulse);
        irrTowerGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.45;
      }
      for (let j = 0; j < dripJets.length; j++) {
        dripJets[j].visible = irrActive;
        dripJets[j].scale.y = 0.28 + Math.abs(Math.sin(elapsed * 6 + j)) * 0.18;
      }

      for (let w = 0; w < turbineRotors.length; w++) {
        turbineRotors[w].rotation.z += dt * (1.55 + (w % 3) * 0.12);
      }
      droneRadarRotor.rotation.y += dt * 1.4;

      if (state.factoryActive) {
        for (let c = 0; c < conveyorCrates.length; c++) {
          const crate = conveyorCrates[c];
          crate.position.x += dt * 2.8;
          if (crate.position.x > 11.5) crate.position.x = -11.5;
        }
      }

      for (let a = 0; a < destructibleArms.length; a++) {
        const arm = destructibleArms[a];
        const mState = state.machines[arm.idIndex];
        if (mState && mState.disabled) {
          arm.pivot.rotation.z = 0.42;
          if (emitSmokeTick && mState.wreckAgeSec < 32) {
            arm.pivot.getWorldPosition(tmpArmWorld);
            effectsPool.spawnSmokePuff(tmpArmWorld.x, tmpArmWorld.y + 0.6, tmpArmWorld.z, 0.65);
          }
        } else if (a === 0 || state.factoryActive) {
          const speed = a === 0 ? (state.researchBoost ? 2.4 : 1.1) : 2.6;
          if (a === 0) arm.pivot.rotation.y = Math.sin(elapsed * speed) * 0.95;
          else arm.pivot.rotation.x = Math.sin(elapsed * speed + arm.basePhase) * 0.35;
          arm.pivot.rotation.z = 0;
        }
      }

      // Step all 30 Robots with 5-Stage Destruction, Flinch & Ragdoll Collapse
      for (let i = 0; i < state.robots.length; i++) {
        const ag = state.robots[i];
        const vis = robotVisuals[i];
        const dmg = ag.damage;

        vis.root.position.set(ag.x, 0.06, ag.z);
        vis.root.rotation.y = ag.yaw;

        // Progressive material darkening & light flicker/shutoff
        if (dmg.stage >= 2) {
          const charShade = dmg.stage === 2 ? 0.85 : dmg.stage === 3 ? 0.68 : 0.48;
          vis.bodyMat.color.setHex(vis.baseColorHex).multiplyScalar(charShade);
        }
        if (dmg.lightsOff) {
          vis.accMat.emissiveIntensity = 0;
        } else if (dmg.lightsFlicker) {
          vis.accMat.emissiveIntensity = Math.sin(elapsed * 26 + i) > 0.1 ? 0.85 : 0.05;
        } else {
          vis.accMat.emissiveIntensity = 0.75;
        }

        // Ongoing smoke emission for stages 2..5 (before cleanup cap)
        if (emitSmokeTick && dmg.smokeIntensity > 0.25 && dmg.wreckAgeSec < 36) {
          if (Math.random() < dmg.smokeIntensity * 0.65) {
            effectsPool.spawnSmokePuff(ag.x, 1.05, ag.z, dmg.smokeIntensity);
          }
        }

        // Stage 4/5: Ragdoll Ground Collapse Animation
        if (dmg.disabled) {
          vis.collapseProgress = Math.min(1, vis.collapseProgress + dt * 3.4);
          const cp = vis.collapseProgress;
          vis.root.rotation.x = cp * (Math.PI * 0.46) * vis.collapseDir;
          vis.root.rotation.z = cp * 0.32 * vis.collapseDir;
          vis.root.position.y = Math.max(0.06, 0.22 - cp * 0.14);
          if (vis.sprayCone) vis.sprayCone.visible = false;
          continue;
        }

        // Bullet hit recoil flinch + Stage 3 abnormal balance lean/limp
        const flinchTilt =
          dmg.flinchTimer > 0 ? Math.sin((dmg.flinchTimer / 0.24) * Math.PI) * dmg.flinchStrength * 0.35 : 0;
        const limpRoll =
          dmg.limpAmplitude > 0.05 ? Math.sin(ag.workPhase * 1.9) * dmg.limpAmplitude * 0.22 : 0;
        vis.root.rotation.x = -flinchTilt;
        vis.root.rotation.z = limpRoll;

        if (!ag.active) continue;
        const swing = Math.sin(ag.workPhase * 1.8) * (0.45 + dmg.limpAmplitude * 0.25);
        if (vis.leftLeg) vis.leftLeg.rotation.x = swing;
        if (vis.rightLeg) vis.rightLeg.rotation.x = -swing;
        if (vis.leftArm) vis.leftArm.rotation.x = -swing * 0.85;
        if (vis.rightArm) {
          vis.rightArm.rotation.x =
            ROBOT_ROLE_CATALOG[i].visualKind === 'assistant'
              ? -2.2 + Math.sin(elapsed * 5) * 0.25
              : swing * 0.85;
        }
        if (vis.head) vis.head.rotation.y = Math.sin(ag.workPhase * 0.6) * 0.32;
        if (vis.toolBoom) vis.toolBoom.rotation.x = Math.sin(ag.workPhase * 1.2) * 0.22;
        if (vis.sprayCone) vis.sprayCone.visible = irrActive && dmg.stage < 2;
      }

      // Step all 18 Autonomous Drones with Rotor Failure, Instability & Crash Physics
      for (let i = 0; i < state.drones.length; i++) {
        const dr = state.drones[i];
        const dVis = droneVisuals[i];
        const dmg = dr.damage;

        if (dmg.droneFlightState === 'crashing') {
          const groundY = groundHeightAt(dr.x, dr.z, dr.y);
          const crashStep = stepDroneCrashPhysics(dr.damage, dr.x, dr.y, dr.z, groundY, dt);
          dr.x = crashStep.x;
          dr.y = crashStep.y;
          dr.z = crashStep.z;
          dr.yaw += dmg.crashSpinRate * dt;
          dVis.root.position.set(dr.x, dr.y, dr.z);
          dVis.root.rotation.set(dmg.crashTiltX, dr.yaw, dmg.crashTiltZ);

          if (emitSmokeTick) {
            effectsPool.spawnSmokePuff(dr.x, dr.y, dr.z, 0.85);
          }

          if (crashStep.impactedGround) {
            const dPlayer = Math.hypot(dr.x - playerPos.x, dr.z - playerPos.z);
            soundEngine.playDroneCrash(dPlayer);
            effectsPool.spawnMaterialImpact(
              new THREE.Vector3(dr.x, dr.y, dr.z),
              new THREE.Vector3(0, 1, 0),
              'metal',
              18,
              12,
              1.45,
              0.3,
              null,
            );
            effectsPool.spawnSmokePuff(dr.x, dr.y + 0.3, dr.z, 1.0);
            for (let r = 0; r < dVis.rotors.length; r++) {
              if (dVis.rotors[r].visible) {
                dVis.rotors[r].visible = false;
                effectsPool.spawnDetachedDebris(dr.x, dr.y + 0.25, dr.z, (`rotor_${r}`) as SmartCityComponentKind, 0xcbd5e1, 1.45);
              }
            }
            if (dVis.camPod && dVis.camPod.visible) {
              dVis.camPod.visible = false;
              effectsPool.spawnDetachedDebris(dr.x, dr.y + 0.2, dr.z, 'camera', 0x334155, 1.2);
            }
          }
        } else if (dmg.droneFlightState === 'crashed') {
          dVis.root.position.set(dr.x, dr.y, dr.z);
          if (emitSmokeTick && dmg.wreckAgeSec < 36) {
            effectsPool.spawnSmokePuff(dr.x, dr.y + 0.2, dr.z, 0.72);
          }
        } else {
          dVis.root.position.set(dr.x, dr.y, dr.z);
          dVis.root.rotation.y = dr.yaw;
          const wobbleRot =
            dmg.droneFlightState === 'wobbling' ? Math.sin(elapsed * 9.5 + i) * 0.38 : 0;
          dVis.root.rotation.x = (dr.deployFactor > 0.25 ? 0.14 : 0) + wobbleRot * 0.5;
          dVis.root.rotation.z = wobbleRot;
          if (emitSmokeTick && dmg.smokeIntensity > 0.25) {
            effectsPool.spawnSmokePuff(dr.x, dr.y, dr.z, dmg.smokeIntensity);
          }
        }

        if (dmg.lightsOff) dVis.stripeMat.emissiveIntensity = 0;
        else if (dmg.lightsFlicker) dVis.stripeMat.emissiveIntensity = Math.sin(elapsed * 24 + i) > 0 ? 1.4 : 0.1;
        else dVis.stripeMat.emissiveIntensity = 1.4;

        const baseSpin = dr.deployFactor > 0.04 && dmg.droneFlightState !== 'crashed' ? dt * 36 : 0;
        for (let r = 0; r < dVis.rotors.length; r++) {
          if (!dmg.brokenRotors[r] && dVis.rotors[r].visible) {
            dVis.rotors[r].rotation.y += baseSpin * (r % 2 === 0 ? 1 : -1);
          }
        }
        if (dVis.mistCone) dVis.mistCone.visible = dr.spraying;
      }

      // Autonomous Field Tractors / Harvesters & Electric Shuttles (Halt + Smoke if Disabled)
      for (let m = 0; m < fieldMachines.length; m++) {
        const fm = fieldMachines[m];
        const mState = state.machines[fm.idIndex];
        if (mState && mState.disabled) {
          if (emitSmokeTick && mState.wreckAgeSec < 36) {
            effectsPool.spawnSmokePuff(fm.root.position.x, 1.5, fm.root.position.z, 0.85);
          }
          continue;
        }
        const speedMul = mState ? mState.speedMultiplier : 1;
        stepWaypointVehicle(fm, dt * speedMul);
        if (fm.headerRoller && fm.headerRoller.visible) {
          fm.headerRoller.rotation.x += dt * 6 * speedMul;
        }
      }
      for (let s = 0; s < shuttles.length; s++) {
        const sh = shuttles[s];
        const mState = state.machines[sh.idIndex];
        if (mState && mState.disabled) {
          if (emitSmokeTick && mState.wreckAgeSec < 36) {
            effectsPool.spawnSmokePuff(sh.root.position.x, 1.5, sh.root.position.z, 0.85);
          }
          continue;
        }
        const speedMul = mState ? mState.speedMultiplier : 1;
        stepShuttleAlongSingleRoad(sh, dt * speedMul, shuttles);
      }

      smartGlassFacadeMat.emissiveIntensity = 0.28 + nightFactor * 0.65;
    },
    dispose: () => {
      effectsPool.dispose();
      localTexs.forEach((t) => t.dispose());
      void localGeos;
      void localMats;
    },
  };
}
