import * as THREE from 'three';
import { addCollider, type ColliderBox, type WorldInteractable } from './arena';
import { addStairSideGuardColliders, type CityPalette, type SimWorldBuildContext } from './buildingsAndTransit';
import {
  computePolylineLength2D,
  computeTrainStationCycle,
  sampleClosedPolyline2D,
  SMART_CITY_BUS_ROUTES,
  SMART_CITY_TRAIN_STATION,
  SMART_CITY_TRAIN_TRACK_POINTS,
  type ScienceBusRouteSpec,
} from './smartCitySystems';

export interface SmartCityTransitController {
  root: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    nightFactor: number,
    playerPos: THREE.Vector3,
    cameraPos: THREE.Vector3 | null | undefined,
    groundHeightAt: (x: number, z: number, currentY?: number) => number,
  ) => void;
  getGateActors: () => ReadonlyArray<{ x: number; z: number }>;
  getWalkableDeckY: (x: number, z: number, curY: number) => number | null;
  consumePlayerCarryDelta: (playerPos: THREE.Vector3, outDelta: THREE.Vector3) => boolean;
  dispose: () => void;
}

// Pre-allocated scratch math helpers (zero per-frame GC allocations)
const _busSample = { x: 0, z: 0, yaw: 0 };
const _splinePos = new THREE.Vector3();
const _splineNext = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _sideVec = new THREE.Vector3();
const _upVec = new THREE.Vector3();
const _rotMat = new THREE.Matrix4();
const _relScratch = new THREE.Vector3();
const _invPrevQuat = new THREE.Quaternion();
const _deltaLocalScratch = new THREE.Vector3();

function createTransitCollider(target: ColliderBox[], surface: 'metal' | 'concrete' = 'metal'): ColliderBox {
  const c: ColliderBox = {
    minX: 0,
    maxX: 0,
    minY: -200,
    maxY: -100,
    minZ: 0,
    maxZ: 0,
    cx: 0,
    cz: 0,
    halfW: 0.5,
    halfD: 0.5,
    rotY: 0,
    cosY: 1,
    sinY: 0,
    surface,
  };
  target.push(c);
  return c;
}

function syncOBBCollider(
  col: ColliderBox,
  rootX: number,
  rootY: number,
  rootZ: number,
  rotY: number,
  lx: number,
  lz: number,
  w: number,
  h: number,
  d: number,
  active: boolean,
) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cx = rootX + lx * cosY + lz * sinY;
  const cz = rootZ - lx * sinY + lz * cosY;
  const halfW = w * 0.5;
  const halfD = d * 0.5;
  const absCos = Math.abs(cosY);
  const absSin = Math.abs(sinY);
  const extX = halfW * absCos + halfD * absSin;
  const extZ = halfW * absSin + halfD * absCos;
  col.cx = cx;
  col.cz = cz;
  col.halfW = halfW;
  col.halfD = halfD;
  col.rotY = rotY;
  col.cosY = cosY;
  col.sinY = sinY;
  col.minX = cx - extX;
  col.maxX = cx + extX;
  col.minZ = cz - extZ;
  col.maxZ = cz + extZ;
  col.minY = active ? rootY : -200;
  col.maxY = active ? rootY + h : -100;
}

interface AnimatedPassengerRig {
  kind: 'scientist' | 'robot';
  root: THREE.Group;
  head: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftArm: THREE.Object3D;
  baseY: number;
  phase: number;
}

interface AutonomousBusRuntime {
  spec: ScienceBusRouteSpec;
  root: THREE.Group;
  totalLen: number;
  distanceMeters: number;
  currentSpeed: number;
  wheels: THREE.Object3D[];
  doorFront: THREE.Object3D;
  doorRear: THREE.Object3D;
  doorOpen: number;
  passengers: AnimatedPassengerRig[];
  holoScreens: THREE.Object3D[];
  interactable: WorldInteractable;
  posX: number;
  posY: number;
  posZ: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  prevYaw: number;
  yaw: number;
  playerBoarded: boolean;
  colliders: {
    leftWall: ColliderBox;
    rightFwdWall: ColliderBox;
    rightRearWall: ColliderBox;
    frontWall: ColliderBox;
    rearWall: ColliderBox;
    doorBlocker: ColliderBox;
  };
}

interface TrainCoachRuntime {
  root: THREE.Group;
  offsetMeters: number;
  doorLeftFront?: THREE.Object3D;
  doorLeftRear?: THREE.Object3D;
  doorRightFront?: THREE.Object3D;
  doorRightRear?: THREE.Object3D;
  passengers: AnimatedPassengerRig[];
  holoScreens: THREE.Object3D[];
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  prevQuat: THREE.Quaternion;
  sideAxis: THREE.Vector3;
  upAxis: THREE.Vector3;
  fwdAxis: THREE.Vector3;
  yaw: number;
  colliders: {
    leftFwdWall: ColliderBox;
    leftRearWall: ColliderBox;
    rightFwdWall: ColliderBox;
    rightRearWall: ColliderBox;
    frontLeftWall: ColliderBox;
    frontRightWall: ColliderBox;
    rearLeftWall: ColliderBox;
    rearRightWall: ColliderBox;
    leftDoorBlocker: ColliderBox;
    rightDoorBlocker: ColliderBox;
  };
}

function createTransitBannerTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  accentHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, 502, 118);

    ctx.fillStyle = accentHex;
    ctx.font = 'bold 31px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 56);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(subtitle, 256, 94);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHologramTexture(title: string, accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(8, 28, 48, 0.88)';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 152);
    ctx.fillStyle = accentHex;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(title, 18, 30);

    // Neural node circle + data bars
    ctx.beginPath();
    ctx.arc(64, 96, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(64, 96, 18, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? accentHex : '#38bdf8';
      ctx.fillRect(122, 54 + i * 19, 45 + ((i * 29) % 68), 10);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBookShelfTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(0, 0, 256, 256);
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#e2e8f0', '#06b6d4', '#a855f7', '#fb7185'];
    for (let row = 0; row < 4; row++) {
      const yTop = 10 + row * 62;
      ctx.fillStyle = '#3e2412';
      ctx.fillRect(6, yTop + 46, 244, 10);
      let xCur = 12;
      let idx = row * 7;
      while (xCur < 232) {
        const bw = 9 + ((idx * 5) % 9);
        const bh = 32 + ((idx * 11) % 13);
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fillRect(xCur, yTop + (46 - bh), bw, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(xCur + 1, yTop + (46 - bh) + 5, bw - 2, 3);
        xCur += bw + 2;
        idx++;
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function updateStationStatusCanvas(
  canvas: HTMLCanvasElement,
  tex: THREE.CanvasTexture,
  stopped: boolean,
  countdownSec: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#071324';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = stopped ? '#34d399' : '#38bdf8';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEXUS DOME SKY-TRAIN STATION', canvas.width / 2, 42);

  ctx.fillStyle = stopped ? '#34d399' : '#fbbf24';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(
    stopped ? `BOARDING NOW (${countdownSec}s) — [E] ENTER` : `NEXT TRAIN IN ${countdownSec}s`,
    canvas.width / 2,
    84,
  );

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText('ROUTE: DOME STATION -> GLASS DOME CROWN (79m) -> LOOP', canvas.width / 2, 114);
  tex.needsUpdate = true;
}

export function buildSmartCityTransit(
  ctx: SimWorldBuildContext,
  cityPal: CityPalette,
  groundHeightAt: (x: number, z: number, currentY?: number) => number,
): SmartCityTransitController {
  const root = new THREE.Group();
  root.name = 'smart_city_transit';
  ctx.arenaGroup.add(root);

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
    t.anisotropy = Math.min(8, ctx.textures?.facadeGlassGrid?.anisotropy ?? 4);
    localTexs.push(t);
    return t;
  };

  const boxGeo = cityPal.boxGeo;
  const cylGeo = cityPal.cylGeo;
  const sphereGeo = trackGeo(new THREE.SphereGeometry(0.5, 14, 12));

  // Shared high-craft transit PBR materials
  const bodyWhiteMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.24, metalness: 0.42 }));
  const silverFrameMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.26, metalness: 0.72 }));
  const charcoalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.54, metalness: 0.35 }));
  const tireMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.88, metalness: 0.06 }));
  const rimMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xdbe3ee, roughness: 0.2, metalness: 0.86 }));
  const woodFloorMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x9b6b43, roughness: 0.62, metalness: 0.04 }));
  const solarMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f2744, roughness: 0.18, metalness: 0.78 }));
  const seatWhiteMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.44, metalness: 0.08 }));
  const seatNavyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.56, metalness: 0.06 }));

  // Ultra-clear optical panoramic glass so interior library, seats, scientists, and robots shine cleanly
  const clearCabinGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdcf4ff,
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      side: THREE.DoubleSide,
      clearcoat: 1.0,
    }),
  );
  const darkTintNoseGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: THREE.DoubleSide,
      clearcoat: 1.0,
    }),
  );

  // Illuminated LED & scientist outfit materials
  const cyanLedMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const warmCeilingLedMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfff8e6 }));
  const amberRailMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  const headLightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const tailLightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const coatMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.05 }));
  const shirtCollarMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.55, metalness: 0.05 }));
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf3cbb0, roughness: 0.62, metalness: 0.02 }));
  const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.68, metalness: 0.08 }));
  const maskMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.02 }));
  const stethoscopeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.32, metalness: 0.45 }));

  const bookMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: trackTex(createBookShelfTexture()),
      roughness: 0.72,
      metalness: 0.04,
    }),
  );
  const holoMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: trackTex(createHologramTexture('AI RESEARCH MATRIX', '#22d3ee')),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const addBox = (
    parent: THREE.Object3D,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rot?: { rx?: number; ry?: number; rz?: number },
  ): THREE.Mesh => {
    const m = new THREE.Mesh(boxGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    if (rot?.rx) m.rotation.x = rot.rx;
    if (rot?.ry) m.rotation.y = rot.ry;
    if (rot?.rz) m.rotation.z = rot.rz;
    parent.add(m);
    return m;
  };

  // Builds a seated white-coat scientist (mask + blue stethoscope) or standing/floating inside assistant robot
  const buildPassengerRig = (
    parent: THREE.Object3D,
    kind: 'scientist' | 'robot',
    x: number,
    y: number,
    z: number,
    rotY: number,
    phase: number,
  ): AnimatedPassengerRig => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);

    if (kind === 'scientist') {
      // Seated thighs & lower legs
      addBox(g, charcoalMat, -0.1, 0.34, 0.16, 0.13, 0.12, 0.38);
      addBox(g, charcoalMat, 0.1, 0.34, 0.16, 0.13, 0.12, 0.38);
      addBox(g, charcoalMat, -0.1, 0.14, 0.34, 0.12, 0.36, 0.12);
      addBox(g, charcoalMat, 0.1, 0.14, 0.34, 0.12, 0.36, 0.12);
      // White lab coat torso + blue inner shirt + blue stethoscope + clipboard
      addBox(g, coatMat, 0, 0.62, 0, 0.42, 0.56, 0.24);
      addBox(g, shirtCollarMat, 0, 0.82, 0.11, 0.14, 0.16, 0.04);
      addBox(g, stethoscopeMat, -0.11, 0.78, 0.13, 0.04, 0.24, 0.04);
      addBox(g, stethoscopeMat, 0.11, 0.78, 0.13, 0.04, 0.24, 0.04);
      addBox(g, stethoscopeMat, 0, 0.66, 0.13, 0.24, 0.04, 0.04);

      const head = new THREE.Group();
      head.position.set(0, 1.03, 0.02);
      const cranium = new THREE.Mesh(sphereGeo, skinMat);
      cranium.scale.set(0.22, 0.25, 0.23);
      head.add(cranium);
      // Hair crown & bangs
      addBox(head, hairMat, 0, 0.09, -0.02, 0.23, 0.13, 0.24);
      // Medical surgical mask
      addBox(head, maskMat, 0, -0.04, 0.1, 0.18, 0.11, 0.06);
      g.add(head);

      const leftArm = new THREE.Group();
      leftArm.position.set(-0.24, 0.84, 0);
      addBox(leftArm, coatMat, 0, -0.14, 0.14, 0.1, 0.12, 0.34);
      g.add(leftArm);

      const rightArm = new THREE.Group();
      rightArm.position.set(0.24, 0.84, 0);
      addBox(rightArm, coatMat, 0, -0.14, 0.14, 0.1, 0.12, 0.34);
      // Research tablet in right hand
      addBox(rightArm, charcoalMat, -0.1, -0.15, 0.34, 0.22, 0.02, 0.16);
      addBox(rightArm, cyanLedMat, -0.1, -0.135, 0.34, 0.18, 0.01, 0.12);
      g.add(rightArm);

      return { kind, root: g, head, leftArm, rightArm, baseY: y, phase };
    }

    // Modern interior research assistant robot
    const baseCyl = new THREE.Mesh(cylGeo, bodyWhiteMat);
    baseCyl.position.set(0, 0.16, 0);
    baseCyl.scale.set(0.36, 0.32, 0.36);
    g.add(baseCyl);
    addBox(g, cyanLedMat, 0, 0.26, 0, 0.39, 0.04, 0.39);
    addBox(g, bodyWhiteMat, 0, 0.62, 0, 0.34, 0.56, 0.26);
    addBox(g, cyanLedMat, 0, 0.66, 0.14, 0.16, 0.12, 0.03);

    const head = new THREE.Group();
    head.position.set(0, 1.06, 0);
    addBox(head, bodyWhiteMat, 0, 0, 0, 0.3, 0.24, 0.26);
    addBox(head, charcoalMat, 0, 0, 0.135, 0.24, 0.14, 0.03);
    addBox(head, cyanLedMat, -0.06, 0.01, 0.152, 0.06, 0.04, 0.02);
    addBox(head, cyanLedMat, 0.06, 0.01, 0.152, 0.06, 0.04, 0.02);
    g.add(head);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.22, 0.82, 0);
    addBox(leftArm, silverFrameMat, 0, -0.16, 0.04, 0.08, 0.34, 0.08);
    g.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.22, 0.82, 0);
    addBox(rightArm, silverFrameMat, 0, -0.16, 0.08, 0.08, 0.34, 0.08);
    g.add(rightArm);

    return { kind, root: g, head, leftArm, rightArm, baseY: y, phase };
  };

  // =========================================================================
  // 1. 3 AUTONOMOUS PANORAMIC GLASS SCIENCE & LIBRARY BUSES
  // =========================================================================
  const buses: AutonomousBusRuntime[] = [];

  const buildScienceBus = (spec: ScienceBusRouteSpec, idx: number): AutonomousBusRuntime => {
    const busGroup = new THREE.Group();
    busGroup.name = spec.id;
    root.add(busGroup);

    const W = 3.1;
    const L = 12.6;
    const deckY = 0.45;
    const roofY = 3.38;
    const wheels: THREE.Object3D[] = [];
    const passengers: AnimatedPassengerRig[] = [];
    const holoScreens: THREE.Object3D[] = [];

    // Lower composite chassis skirt + non-overlapping wooden interior cabin floor (clean Z-buffer gap)
    addBox(busGroup, charcoalMat, 0, 0.24, 0, W - 0.14, 0.14, L - 0.24);
    addBox(busGroup, bodyWhiteMat, 0, 0.36, 0, W, 0.12, L - 0.1);
    addBox(busGroup, woodFloorMat, 0, 0.48, 0, W - 0.26, 0.06, L - 0.55);

    // Lower cyan LED contour strips on nose, tail, and sides
    addBox(busGroup, cyanLedMat, 0, 0.36, -L * 0.5 - 0.02, W - 0.3, 0.06, 0.05);
    addBox(busGroup, cyanLedMat, 0, 0.36, L * 0.5 + 0.02, W - 0.3, 0.06, 0.05);
    [-W * 0.5 - 0.01, W * 0.5 + 0.01].forEach((sx) => {
      addBox(busGroup, cyanLedMat, sx, 0.36, 0, 0.05, 0.06, L - 0.6);
    });

    // Headlights & red taillights
    [-0.95, 0.95].forEach((lx) => {
      addBox(busGroup, headLightMat, lx, 0.48, -L * 0.5 - 0.04, 0.52, 0.1, 0.05);
      addBox(busGroup, tailLightMat, lx, 0.48, L * 0.5 + 0.04, 0.52, 0.1, 0.05);
    });

    // 4 Realistic rotating wheels w/ silver metallic hubcaps & recessed arches
    const wheelCoords: Array<[number, number]> = [
      [-1.44, -3.75],
      [1.44, -3.75],
      [-1.44, 3.75],
      [1.44, 3.75],
    ];
    wheelCoords.forEach(([wx, wz]) => {
      const wPivot = new THREE.Group();
      wPivot.position.set(wx, 0.54, wz);
      const tire = new THREE.Mesh(cylGeo, tireMat);
      tire.rotation.z = Math.PI * 0.5;
      tire.scale.set(1.06, 0.34, 1.06);
      const rim = new THREE.Mesh(cylGeo, rimMat);
      rim.rotation.z = Math.PI * 0.5;
      rim.scale.set(0.62, 0.36, 0.62);
      const spoke = addBox(wPivot, charcoalMat, 0, 0, 0, 0.37, 0.52, 0.08);
      void spoke;
      wPivot.add(tire, rim);
      busGroup.add(wPivot);
      wheels.push(wPivot);
    });

    // Slim corner & mid pillars framing the crystal-clear panoramic glass cabin (leave right doorway z in [-1.5..+1.5] open!)
    const pillarZ = [-L * 0.5 + 0.18, -1.65, 1.65, L * 0.5 - 0.18];
    pillarZ.forEach((pz) => {
      addBox(busGroup, charcoalMat, -W * 0.5 + 0.09, 1.94, pz, 0.16, 2.86, 0.22);
      addBox(busGroup, charcoalMat, W * 0.5 - 0.09, 1.94, pz, 0.16, 2.86, 0.22);
    });
    // Vertical glowing cyan corner light accent tubes
    [-W * 0.5 + 0.02, W * 0.5 - 0.02].forEach((sx) => {
      addBox(busGroup, cyanLedMat, sx, 1.92, -L * 0.5 + 0.08, 0.05, 2.85, 0.05);
      addBox(busGroup, cyanLedMat, sx, 1.92, L * 0.5 - 0.08, 0.05, 2.85, 0.05);
    });

    // Upper Roof Shell made of white/charcoal composite WITH glass skylights + rooftop solar PV array!
    // Outer roof beams (front, rear, left rim, right rim) leaving big open skylights down the center
    addBox(busGroup, bodyWhiteMat, 0, roofY, -L * 0.5 + 1.15, W, 0.26, 2.3);
    addBox(busGroup, bodyWhiteMat, 0, roofY, L * 0.5 - 1.15, W, 0.26, 2.3);
    addBox(busGroup, charcoalMat, -W * 0.5 + 0.24, roofY, 0, 0.48, 0.24, L - 4.4);
    addBox(busGroup, charcoalMat, W * 0.5 - 0.24, roofY, 0, 0.48, 0.24, L - 4.4);
    // Cross-ribs + 2 clear glass skylights in the roof so you can watch out skyward
    addBox(busGroup, charcoalMat, 0, roofY, 0, W - 0.6, 0.18, 0.28);
    const roofGlass1 = new THREE.Mesh(boxGeo, clearCabinGlassMat);
    roofGlass1.position.set(0, roofY + 0.02, -1.95);
    roofGlass1.scale.set(W - 0.96, 0.06, 3.5);
    const roofGlass2 = new THREE.Mesh(boxGeo, clearCabinGlassMat);
    roofGlass2.position.set(0, roofY + 0.02, 1.95);
    roofGlass2.scale.set(W - 0.96, 0.06, 3.5);
    roofGlass1.renderOrder = 4;
    roofGlass2.renderOrder = 4;
    busGroup.add(roofGlass1, roofGlass2);

    // Rooftop angled Solar Panel Canopy flanking the skylights (matching reference fc3e96b3)
    addBox(busGroup, silverFrameMat, -0.92, roofY + 0.22, -3.1, 0.08, 0.24, 0.08);
    addBox(busGroup, silverFrameMat, 0.92, roofY + 0.22, -3.1, 0.08, 0.24, 0.08);
    addBox(busGroup, silverFrameMat, -0.92, roofY + 0.22, 3.1, 0.08, 0.24, 0.08);
    addBox(busGroup, silverFrameMat, 0.92, roofY + 0.22, 3.1, 0.08, 0.24, 0.08);
    addBox(busGroup, solarMat, 0, roofY + 0.36, -3.4, W - 0.55, 0.07, 2.2, { rx: 0.08 });
    addBox(busGroup, solarMat, 0, roofY + 0.36, 3.4, W - 0.55, 0.07, 2.2, { rx: 0.08 });

    // Front & Rear LED Destination Marquee Signs ("SMART SCIENCE & LIBRARY BUS")
    const signMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: trackTex(
          createTransitBannerTexture(
            `SCIENCE & LIBRARY BUS 0${idx + 1}`,
            'AUTONOMOUS RESEARCH · PRESS [E] TO RIDE',
            '#09182c',
            '#22d3ee',
          ),
        ),
      }),
    );
    addBox(busGroup, signMat, 0, roofY - 0.02, -L * 0.5 - 0.03, 2.45, 0.32, 0.06);
    addBox(busGroup, signMat, 0, roofY - 0.02, L * 0.5 + 0.03, 2.45, 0.32, 0.06);

    // Illuminated Interior Warm Ceiling LED Light Loop
    addBox(busGroup, warmCeilingLedMat, -0.82, roofY - 0.14, 0, 0.12, 0.05, L - 2.4);
    addBox(busGroup, warmCeilingLedMat, 0.82, roofY - 0.14, 0, 0.12, 0.05, L - 2.4);
    addBox(busGroup, warmCeilingLedMat, 0, roofY - 0.14, -L * 0.5 + 1.2, 1.76, 0.05, 0.12);
    addBox(busGroup, warmCeilingLedMat, 0, roofY - 0.14, L * 0.5 - 1.2, 1.76, 0.05, 0.12);
    addBox(busGroup, cyanLedMat, 0, roofY - 0.14, 0, 0.08, 0.04, L - 3.2);

    // Interior Book Library Shelves (left wall + rear wall colorful book cases!)
    addBox(busGroup, bookMat, -W * 0.5 + 0.36, deckY + 1.25, -3.1, 0.36, 2.2, 2.4);
    addBox(busGroup, bookMat, -W * 0.5 + 0.36, deckY + 1.25, 2.9, 0.36, 2.2, 2.4);
    addBox(busGroup, bookMat, 0, deckY + 1.25, L * 0.5 - 0.48, 2.2, 2.15, 0.36);

    // Central Illuminated Research Table + Holographic Screens
    addBox(busGroup, bodyWhiteMat, -0.35, deckY + 0.42, -0.2, 0.9, 0.72, 2.6);
    addBox(busGroup, cyanLedMat, -0.35, deckY + 0.79, -0.2, 0.92, 0.04, 2.62);
    for (let h = 0; h < 2; h++) {
      const holo = addBox(busGroup, holoMat, -0.35, deckY + 1.22, -0.85 + h * 1.3, 0.75, 0.48, 0.04, { ry: 0.25 });
      holoScreens.push(holo);
    }

    // Modern Curved Pod Seats along right & left cabin
    const podLocations: Array<{ x: number; z: number; ry: number }> = [
      { x: 0.85, z: -4.2, ry: -Math.PI * 0.5 },
      { x: 0.85, z: -2.7, ry: -Math.PI * 0.5 },
      { x: 0.85, z: 2.5, ry: -Math.PI * 0.5 },
      { x: 0.85, z: 4.0, ry: -Math.PI * 0.5 },
      { x: -0.9, z: -0.9, ry: Math.PI * 0.5 },
      { x: -0.9, z: 0.6, ry: Math.PI * 0.5 },
    ];
    podLocations.forEach((p) => {
      addBox(busGroup, seatWhiteMat, p.x, deckY + 0.26, p.z, 0.64, 0.44, 0.64, { ry: p.ry });
      const backX = p.x - Math.sin(p.ry) * 0.26;
      const backZ = p.z - Math.cos(p.ry) * 0.26;
      addBox(busGroup, seatNavyMat, backX, deckY + 0.68, backZ, 0.6, 0.66, 0.16, { ry: p.ry });
    });

    // 4 Dynamic Animated Seated White-Coat Scientists inside bus
    passengers.push(
      buildPassengerRig(busGroup, 'scientist', 0.82, deckY + 0.14, -4.2, -Math.PI * 0.5, 0.4),
      buildPassengerRig(busGroup, 'scientist', 0.82, deckY + 0.14, -2.7, -Math.PI * 0.5, 1.7),
      buildPassengerRig(busGroup, 'scientist', -0.86, deckY + 0.14, -0.9, Math.PI * 0.5, 2.9),
      buildPassengerRig(busGroup, 'scientist', 0.82, deckY + 0.14, 4.0, -Math.PI * 0.5, 4.1),
    );
    // 2 Inside Assistant Robots tending book library & holographic table
    passengers.push(
      buildPassengerRig(busGroup, 'robot', -0.78, deckY + 0.05, 1.3, 0.4, 0.9),
      buildPassengerRig(busGroup, 'robot', 0.25, deckY + 0.05, -3.5, Math.PI * 0.85, 2.3),
    );

    // Full Clear Glass Middle Shell (front, rear, left wall, right non-door sections) + Twin Sliding Doors!
    const addGlassPanel = (px: number, py: number, pz: number, gw: number, gh: number, gd: number) => {
      const m = new THREE.Mesh(boxGeo, clearCabinGlassMat);
      m.position.set(px, py, pz);
      m.scale.set(gw, gh, gd);
      m.renderOrder = 3;
      busGroup.add(m);
      return m;
    };
    addGlassPanel(0, 1.9, -L * 0.5 + 0.06, W - 0.26, 2.75, 0.06); // Front full panoramic glass
    addGlassPanel(0, 1.9, L * 0.5 - 0.06, W - 0.26, 2.75, 0.06); // Rear full panoramic glass
    addGlassPanel(-W * 0.5 + 0.06, 1.9, 0, 0.06, 2.75, L - 0.36); // Full clear Left Side Glass
    addGlassPanel(W * 0.5 - 0.06, 1.9, -3.85, 0.06, 2.75, 4.3); // Right Forward Glass
    addGlassPanel(W * 0.5 - 0.06, 1.9, 3.85, 0.06, 2.75, 4.3); // Right Rear Glass

    // Twin Automatic Sliding Glass Doors on right curb side (z in [-1.55 .. +1.55])
    const doorFront = new THREE.Group();
    doorFront.position.set(W * 0.5 - 0.04, 1.88, -0.78);
    const dfGlass = new THREE.Mesh(boxGeo, clearCabinGlassMat);
    dfGlass.scale.set(0.06, 2.72, 1.5);
    dfGlass.renderOrder = 4;
    doorFront.add(dfGlass);
    addBox(doorFront, cyanLedMat, 0.02, 0, 0.73, 0.08, 2.72, 0.05);
    busGroup.add(doorFront);

    const doorRear = new THREE.Group();
    doorRear.position.set(W * 0.5 - 0.04, 1.88, 0.78);
    const drGlass = new THREE.Mesh(boxGeo, clearCabinGlassMat);
    drGlass.scale.set(0.06, 2.72, 1.5);
    drGlass.renderOrder = 4;
    doorRear.add(drGlass);
    addBox(doorRear, cyanLedMat, 0.02, 0, -0.73, 0.08, 2.72, 0.05);
    busGroup.add(doorRear);

    // Walkable Panoramic Cabin Entry/Exit Door Interactable (no forced seat!)
    const totalLen = computePolylineLength2D(spec.waypoints);
    const initialDist = totalLen * spec.initialPhase;
    sampleClosedPolyline2D(spec.waypoints, initialDist, _busSample);
    const initY = groundHeightAt(_busSample.x, _busSample.z, 0);

    const dynCols = ctx.dynamicColliders ?? ctx.colliders;
    const busState: AutonomousBusRuntime = {
      spec,
      root: busGroup,
      totalLen,
      distanceMeters: initialDist,
      currentSpeed: spec.speedMs,
      wheels,
      doorFront,
      doorRear,
      doorOpen: 0,
      passengers,
      holoScreens,
      posX: _busSample.x,
      posY: initY,
      posZ: _busSample.z,
      prevX: _busSample.x,
      prevY: initY,
      prevZ: _busSample.z,
      prevYaw: _busSample.yaw,
      yaw: _busSample.yaw,
      playerBoarded: false,
      interactable: null as unknown as WorldInteractable,
      colliders: {
        leftWall: createTransitCollider(dynCols, 'metal'),
        rightFwdWall: createTransitCollider(dynCols, 'metal'),
        rightRearWall: createTransitCollider(dynCols, 'metal'),
        frontWall: createTransitCollider(dynCols, 'metal'),
        rearWall: createTransitCollider(dynCols, 'metal'),
        doorBlocker: createTransitCollider(dynCols, 'metal'),
      },
    };

    const interactable: WorldInteractable = {
      id: `door_${spec.id}`,
      x: _busSample.x,
      y: initY + 0.9,
      z: _busSample.z,
      radius: 6.8,
      category: 'transit_door',
      getLabel: () =>
        busState.playerBoarded
          ? `Exit ${spec.label} Door`
          : `Enter ${spec.label} Door (Walk Inside)`,
      trigger: (tCtx) => {
        const cosY = Math.cos(busState.yaw);
        const sinY = Math.sin(busState.yaw);
        if (busState.playerBoarded) {
          const ex = busState.posX + 3.2 * cosY;
          const ez = busState.posZ - 3.2 * sinY;
          const ey = groundHeightAt(ex, ez, busState.posY);
          busState.playerBoarded = false;
          tCtx.movePlayerTo?.(ex, ey, ez, busState.yaw + Math.PI * 0.5);
          return `Exited ${spec.label} Door`;
        }
        const inLx = -0.1;
        const inLz = 0.15;
        const ix = busState.posX + inLx * cosY + inLz * sinY;
        const iz = busState.posZ - inLx * sinY + inLz * cosY;
        const iy = busState.posY + 0.54;
        busState.playerBoarded = true;
        tCtx.movePlayerTo?.(ix, iy, iz, busState.yaw);
        return `Entered ${spec.label} — Walk freely inside with Joystick / WASD!`;
      },
    };

    busState.interactable = interactable;
    ctx.interactables.push(interactable);

    busGroup.position.set(busState.posX, busState.posY, busState.posZ);
    busGroup.rotation.y = busState.yaw;
    return busState;
  };

  for (let i = 0; i < SMART_CITY_BUS_ROUTES.length; i++) {
    buses.push(buildScienceBus(SMART_CITY_BUS_ROUTES[i], i));
  }

  // =========================================================================
  // 2. SINGLE BIGGEST MODERN DOME-CLIMBING PANORAMIC GLASS SKY-TRAIN & STATION
  // =========================================================================
  const splinePts = SMART_CITY_TRAIN_TRACK_POINTS.map((p) => new THREE.Vector3(p.x, p.y, p.z));
  const trainCurve = new THREE.CatmullRomCurve3(splinePts, true, 'centripetal', 0.45);
  const trackTotalLen = trainCurve.getLength();

  // Compute exact curve parameter `t` where track passes station center (-150, 1.35, -524)
  let stationNormT = 0.068;
  let bestStationDist = Infinity;
  for (let s = 0; s <= 400; s++) {
    const t = s / 400;
    trainCurve.getPointAt(t, _splinePos);
    const d = Math.hypot(_splinePos.x - SMART_CITY_TRAIN_STATION.trackX, _splinePos.z - SMART_CITY_TRAIN_STATION.z);
    if (d < bestStationDist) {
      bestStationDist = d;
      stationNormT = t;
    }
  }

  // Continuous sleek elevated monorail box-girder beam + glowing side rails
  const beamGeo = trackGeo(new THREE.TubeGeometry(trainCurve, 220, 0.78, 8, true));
  const beamMesh = new THREE.Mesh(beamGeo, silverFrameMat);
  root.add(beamMesh);

  // Dual glowing cyan/amber guide rail strips along track using InstancedMesh ties
  const tieCount = 180;
  const tieInst = new THREE.InstancedMesh(boxGeo, charcoalMat, tieCount);
  const railStripInst = new THREE.InstancedMesh(boxGeo, amberRailMat, tieCount);
  const tieDummy = new THREE.Object3D();
  for (let i = 0; i < tieCount; i++) {
    const t = i / tieCount;
    trainCurve.getPointAt(t, _splinePos);
    trainCurve.getTangentAt(t, _tangent).normalize();
    _sideVec.crossVectors(_worldUp, _tangent).normalize();
    _upVec.crossVectors(_tangent, _sideVec).normalize();
    _rotMat.makeBasis(_sideVec, _upVec, _tangent);

    tieDummy.position.copy(_splinePos).addScaledVector(_upVec, -0.32);
    tieDummy.quaternion.setFromRotationMatrix(_rotMat);
    tieDummy.scale.set(2.35, 0.36, 0.65);
    tieDummy.updateMatrix();
    tieInst.setMatrixAt(i, tieDummy.matrix);

    tieDummy.position.copy(_splinePos).addScaledVector(_upVec, 0.08);
    tieDummy.scale.set(2.42, 0.1, 1.85);
    tieDummy.updateMatrix();
    railStripInst.setMatrixAt(i, tieDummy.matrix);

    // Grounded architectural monorail support pylons for climb sections inside Dome (avoid station & top crown!)
    if (i % 9 === 0 && _splinePos.y > 2.8 && _splinePos.y < 54 && Math.abs(_splinePos.z - SMART_CITY_TRAIN_STATION.z) > 22) {
      const pylonH = _splinePos.y - 0.3;
      const pylon = new THREE.Mesh(cylGeo, silverFrameMat);
      pylon.position.set(_splinePos.x, pylonH * 0.5, _splinePos.z);
      pylon.scale.set(1.05, pylonH, 1.05);
      root.add(pylon);
      addBox(root, charcoalMat, _splinePos.x, 0.25, _splinePos.z, 2.2, 0.5, 2.2);
      addCollider(ctx.colliders, _splinePos.x, 0, _splinePos.z, 1.4, Math.min(4, pylonH), 1.4);
    }
  }
  tieInst.instanceMatrix.needsUpdate = true;
  railStripInst.instanceMatrix.needsUpdate = true;
  tieInst.computeBoundingSphere();
  railStripInst.computeBoundingSphere();
  root.add(tieInst, railStripInst);

  // 2 Glowing Dome Sky-Portal Rings where track exits onto & re-enters from Dome top (~60m)
  [
    { x: -76, y: 59.0, z: -542 },
    { x: -188, y: 60.5, z: -586 },
  ].forEach((portal) => {
    const ringGeo = trackGeo(new THREE.TorusGeometry(4.3, 0.35, 10, 28));
    const ring = new THREE.Mesh(ringGeo, cyanLedMat);
    ring.position.set(portal.x, portal.y, portal.z);
    ring.rotation.y = Math.PI * 0.25;
    ring.rotation.x = Math.PI * 0.32;
    root.add(ring);
  });

  // Dedicated Boarding Station inside Smart City Dome (with walk-up ramp, glass roof arches & live countdown board)
  const stationCanvas = document.createElement('canvas');
  stationCanvas.width = 640;
  stationCanvas.height = 140;
  const stationTex = trackTex(new THREE.CanvasTexture(stationCanvas));
  updateStationStatusCanvas(stationCanvas, stationTex, true, 10);
  const stationSignMat = trackMat(new THREE.MeshBasicMaterial({ map: stationTex }));

  {
    const st = SMART_CITY_TRAIN_STATION;
    const pX = st.platformX; // -143.6
    const pZ = st.z; // -524
    const pW = st.platformWidth; // 6.2
    const pL = st.platformLength; // 36
    const pH = st.deckY; // 7.8

    // Slim Elevated Station Deck (`6.9..7.8m`) so ground vehicles pass unobstructed below + solid deck collider
    addBox(root, cityPal.concreteDeck, pX, pH - 0.45, pZ, pW, 0.9, pL);
    addBox(root, cityPal.whiteMarble, pX, pH + 0.03, pZ, pW - 0.3, 0.06, pL - 0.3);
    addBox(root, amberRailMat, pX - pW * 0.5 + 0.22, pH + 0.05, pZ, 0.22, 0.05, pL - 0.8);
    addCollider(ctx.colliders, pX, pH - 0.9, pZ, pW, 0.9, pL, 0, 'concrete');

    // Architectural Support Columns underneath Station Platform (clear span between pillars)
    [-15, -5, 5, 15].forEach((dz) => {
      addBox(root, charcoalMat, pX - 1.85, (pH - 0.8) * 0.5, pZ + dz, 0.72, pH - 0.8, 0.72);
      addBox(root, charcoalMat, pX + 1.85, (pH - 0.8) * 0.5, pZ + dz, 0.72, pH - 0.8, 0.72);
      addCollider(ctx.colliders, pX - 1.85, 0, pZ + dz, 0.78, pH - 0.8, 0.78, 0, 'concrete');
      addCollider(ctx.colliders, pX + 1.85, 0, pZ + dz, 0.78, pH - 0.8, 0.78, 0, 'concrete');
    });

    // Two-Flight East Plaza Stairway / Walk-Up Ramp (`0m -> 3.9m -> 7.8m`) completely clear of south road!
    // Lower flight: z = -531, x climbs Westward from -120.5 (y=0) to -131.5 (y=3.9)
    const lowerLen = Math.hypot(11.0, 3.9);
    const lowerPitch = Math.atan2(3.9, 11.0);
    addBox(root, cityPal.concreteDeck, -126.0, 1.9, -531.0, lowerLen, 0.28, 3.6, { rz: -lowerPitch });
    addBox(root, cyanLedMat, -126.0, 2.55, -532.72, lowerLen, 0.08, 0.08, { rz: -lowerPitch });
    addBox(root, cyanLedMat, -126.0, 2.55, -529.28, lowerLen, 0.08, 0.08, { rz: -lowerPitch });
    ctx.ramps.push({
      minX: -131.6,
      maxX: -120.5,
      minZ: -532.85,
      maxZ: -529.15,
      axis: 'x',
      startCoord: -120.5,
      endCoord: -131.6,
      startY: 0,
      endY: 3.9,
    });
    addStairSideGuardColliders(ctx.colliders, {
      axis: 'x',
      centerCoord: -531.0,
      startCoord: -120.5,
      endCoord: -131.6,
      yBottom: 0,
      yTop: 3.9,
      width: 3.6,
      railSides: 'both',
    });

    // Mid-Landing Deck (`x: -134.8..-131.4, z: -533..-521, y: 3.9`) + Support Columns + Outer Rail Guards
    addBox(root, cityPal.concreteDeck, -133.1, 3.65, -527.0, 3.6, 0.5, 12.2);
    addCollider(ctx.colliders, -133.1, 3.4, -527.0, 3.6, 0.5, 12.2, 0, 'concrete');
    addCollider(ctx.colliders, -134.95, 3.9, -527.0, 0.25, 1.35, 12.2, 0, 'metal');
    addCollider(ctx.colliders, -133.1, 3.9, -533.1, 3.6, 1.35, 0.25, 0, 'metal');
    addCollider(ctx.colliders, -133.1, 3.9, -520.9, 3.6, 1.35, 0.25, 0, 'metal');
    addCollider(ctx.colliders, -131.3, 3.9, -527.0, 0.25, 1.35, 4.4, 0, 'metal');
    addBox(root, charcoalMat, -133.1, 1.7, -532.0, 0.65, 3.4, 0.65);
    addBox(root, charcoalMat, -133.1, 1.7, -522.0, 0.65, 3.4, 0.65);
    addCollider(ctx.colliders, -133.1, 0, -532.0, 0.72, 3.4, 0.72, 0, 'concrete');
    addCollider(ctx.colliders, -133.1, 0, -522.0, 0.72, 3.4, 0.72, 0, 'concrete');

    // Upper flight: z = -523, x climbs Westward from -131.8 (y=3.9) to -140.5 (y=7.8) flush at station!
    const upperLen = Math.hypot(8.7, 3.9);
    const upperPitch = Math.atan2(3.9, 8.7);
    addBox(root, cityPal.concreteDeck, -136.15, 5.8, -523.0, upperLen, 0.28, 3.6, { rz: -upperPitch });
    addBox(root, cyanLedMat, -136.15, 6.45, -524.72, upperLen, 0.08, 0.08, { rz: -upperPitch });
    addBox(root, cyanLedMat, -136.15, 6.45, -521.28, upperLen, 0.08, 0.08, { rz: -upperPitch });
    ctx.ramps.push({
      minX: -140.6,
      maxX: -131.6,
      minZ: -524.85,
      maxZ: -521.15,
      axis: 'x',
      startCoord: -131.6,
      endCoord: -140.6,
      startY: 3.9,
      endY: 7.8,
    });
    addStairSideGuardColliders(ctx.colliders, {
      axis: 'x',
      centerCoord: -523.0,
      startCoord: -131.6,
      endCoord: -140.6,
      yBottom: 3.9,
      yTop: 7.8,
      width: 3.6,
      railSides: 'both',
    });
    // Platform safety rails (North/South ends + East edge outside stair landing)
    addCollider(ctx.colliders, pX, pH, pZ - pL * 0.5, pW, 1.35, 0.25, 0, 'metal');
    addCollider(ctx.colliders, pX, pH, pZ + pL * 0.5, pW, 1.35, 0.25, 0, 'metal');
    addCollider(ctx.colliders, pX + pW * 0.5, pH, pZ - 9.8, 0.25, 1.35, 16.4, 0, 'metal');
    addCollider(ctx.colliders, pX + pW * 0.5, pH, pZ + 10.6, 0.25, 1.35, 15.0, 0, 'metal');

    // Futuristic Elevated Vaulted Glass Station Canopy Arches spanning platform + track
    for (let az = pZ - 16; az <= pZ + 16; az += 8) {
      addBox(root, charcoalMat, pX + pW * 0.5 - 0.25, pH + 3.0, az, 0.35, 6.0, 0.4);
      addBox(root, charcoalMat, st.trackX - 3.6, (pH + 6.0) * 0.5, az, 0.35, pH + 6.0, 0.4);
      addBox(root, silverFrameMat, -147.0, pH + 6.1, az, 12.6, 0.38, 0.42);
      addBox(root, cyanLedMat, -147.0, pH + 5.88, az, 11.4, 0.08, 0.14);
    }
    const canopyGlass = new THREE.Mesh(boxGeo, clearCabinGlassMat);
    canopyGlass.position.set(-147.0, pH + 6.3, pZ);
    canopyGlass.scale.set(12.2, 0.1, pL);
    canopyGlass.renderOrder = 3;
    root.add(canopyGlass);

    // Platform Live Train Arrival & Boarding Sign Board (fixed flush orientation facing both platform & East ramp!)
    addBox(root, charcoalMat, pX + 1.8, pH + 2.2, pZ, 0.3, 4.4, 7.8);
    addBox(root, stationSignMat, pX + 1.61, pH + 3.1, pZ, 0.08, 1.8, 7.4);
    addBox(root, stationSignMat, pX + 1.99, pH + 3.1, pZ, 0.08, 1.8, 7.4);
  }

  // Build Single 3-Coach Bullet Panoramic Glass Sky-Train (Lead Nose + Center Library + Rear)
  const trainGroup = new THREE.Group();
  trainGroup.name = 'smart_city_sky_train';
  root.add(trainGroup);

  const coaches: TrainCoachRuntime[] = [];
  const allTrainPassengers: AnimatedPassengerRig[] = [];
  const allTrainHolos: THREE.Object3D[] = [];
  const coachLength = 10.2;
  const coachOffsets = [0, -(coachLength + 0.9), -(coachLength + 0.9) * 2];
  const trainDynCols = ctx.dynamicColliders ?? ctx.colliders;

  coachOffsets.forEach((offsetMeters, cIdx) => {
    const cg = new THREE.Group();
    trainGroup.add(cg);

    const W = 3.85;
    const L = coachLength;
    const deckY = 0.54;
    const roofY = 3.65;
    const passengers: AnimatedPassengerRig[] = [];
    const holos: THREE.Object3D[] = [];

    // Silver/white lower hull & bogie rails + non-overlapping wood cabin floor (zero Z-fighting!)
    addBox(cg, charcoalMat, 0, 0.22, 0, W - 0.52, 0.32, L - 0.6);
    addBox(cg, silverFrameMat, 0, 0.43, 0, W, 0.12, L);
    addBox(cg, woodFloorMat, 0, 0.56, 0, W - 0.26, 0.06, L - 0.5);
    addBox(cg, amberRailMat, -W * 0.5 - 0.01, 0.48, 0, 0.05, 0.06, L - 0.3);
    addBox(cg, amberRailMat, W * 0.5 + 0.01, 0.48, 0, 0.05, 0.06, L - 0.3);

    // Aerodynamic Bullet Nose on Front Coach (cIdx === 0) & Tail Fairing on Rear Coach (cIdx === 2)
    if (cIdx === 0) {
      const noseGeo = trackGeo(new THREE.SphereGeometry(W * 0.48, 18, 14));
      const noseMesh = new THREE.Mesh(noseGeo, silverFrameMat);
      noseMesh.position.set(0, 1.55, L * 0.5 + 0.7);
      noseMesh.scale.set(1.0, 0.95, 1.65);
      cg.add(noseMesh);

      const canopyVisor = new THREE.Mesh(noseGeo, darkTintNoseGlassMat);
      canopyVisor.position.set(0, 2.02, L * 0.5 + 0.85);
      canopyVisor.scale.set(0.84, 0.72, 1.52);
      canopyVisor.renderOrder = 4;
      cg.add(canopyVisor);

      addBox(cg, headLightMat, -1.1, 0.88, L * 0.5 + 2.4, 0.45, 0.14, 0.22);
      addBox(cg, headLightMat, 1.1, 0.88, L * 0.5 + 2.4, 0.45, 0.14, 0.22);
      addBox(cg, amberRailMat, 0, 2.95, L * 0.5 + 0.95, 1.6, 0.2, 0.18);
    } else if (cIdx === 2) {
      const tailGeo = trackGeo(new THREE.SphereGeometry(W * 0.46, 16, 12));
      const tailMesh = new THREE.Mesh(tailGeo, silverFrameMat);
      tailMesh.position.set(0, 1.55, -L * 0.5 - 0.4);
      tailMesh.scale.set(1.0, 0.95, 1.35);
      cg.add(tailMesh);
      addBox(cg, tailLightMat, -1.0, 0.95, -L * 0.5 - 2.1, 0.5, 0.14, 0.2);
      addBox(cg, tailLightMat, 1.0, 0.95, -L * 0.5 - 2.1, 0.5, 0.14, 0.2);
    }

    // Upper Composite Roof Frame WITH Glass Skylights
    addBox(cg, bodyWhiteMat, 0, roofY, -L * 0.5 + 1.0, W, 0.28, 2.0);
    addBox(cg, bodyWhiteMat, 0, roofY, L * 0.5 - 1.0, W, 0.28, 2.0);
    addBox(cg, charcoalMat, -W * 0.5 + 0.28, roofY, 0, 0.56, 0.26, L - 3.8);
    addBox(cg, charcoalMat, W * 0.5 - 0.28, roofY, 0, 0.56, 0.26, L - 3.8);
    const rSky = new THREE.Mesh(boxGeo, clearCabinGlassMat);
    rSky.position.set(0, roofY + 0.02, 0);
    rSky.scale.set(W - 1.15, 0.06, L - 4.1);
    rSky.renderOrder = 4;
    cg.add(rSky);

    // Interior warm ceiling LED loop & cyan strips
    addBox(cg, warmCeilingLedMat, -1.05, roofY - 0.15, 0, 0.12, 0.05, L - 1.4);
    addBox(cg, warmCeilingLedMat, 1.05, roofY - 0.15, 0, 0.12, 0.05, L - 1.4);
    addBox(cg, cyanLedMat, 0, roofY - 0.15, 0, 0.1, 0.04, L - 2.0);

    // Book Library Shelves + Central Research Console + Holograms inside every coach!
    addBox(cg, bookMat, -W * 0.5 + 0.42, deckY + 1.35, -2.5, 0.36, 2.4, 2.8);
    addBox(cg, bookMat, -W * 0.5 + 0.42, deckY + 1.35, 2.5, 0.36, 2.4, 2.8);
    addBox(cg, bodyWhiteMat, -0.35, deckY + 0.44, 0, 0.92, 0.78, 3.2);
    addBox(cg, cyanLedMat, -0.35, deckY + 0.84, 0, 0.94, 0.04, 3.22);
    const h1 = addBox(cg, holoMat, -0.35, deckY + 1.28, -0.7, 0.8, 0.52, 0.04, { ry: 0.22 });
    const h2 = addBox(cg, holoMat, -0.35, deckY + 1.28, 0.7, 0.8, 0.52, 0.04, { ry: -0.22 });
    holos.push(h1, h2);
    allTrainHolos.push(h1, h2);

    // Panoramic Lounge Seats + Dynamic Seated White-Coat Scientists + Assistant Robots
    [
      { x: 1.05, z: -2.8, ry: -Math.PI * 0.5 },
      { x: 1.05, z: 2.8, ry: -Math.PI * 0.5 },
      { x: -1.05, z: 0.0, ry: Math.PI * 0.5 },
    ].forEach((sp, sIdx) => {
      addBox(cg, seatWhiteMat, sp.x, deckY + 0.26, sp.z, 0.66, 0.46, 0.66, { ry: sp.ry });
      const bx = sp.x - Math.sin(sp.ry) * 0.26;
      const bz = sp.z - Math.cos(sp.ry) * 0.26;
      addBox(cg, seatNavyMat, bx, deckY + 0.7, bz, 0.64, 0.68, 0.16, { ry: sp.ry });
      const rig = buildPassengerRig(cg, 'scientist', sp.x, deckY + 0.14, sp.z, sp.ry, cIdx * 1.9 + sIdx * 1.3);
      passengers.push(rig);
      allTrainPassengers.push(rig);
    });
    const botRig = buildPassengerRig(cg, 'robot', 0.25, deckY + 0.06, -3.5, 0.3, cIdx * 2.1);
    passengers.push(botRig);
    allTrainPassengers.push(botRig);

    // Pillars & Clear Middle Panoramic Glass Walls + Dual-Side Sliding Doors (Platform & Scenic Sides)
    [-L * 0.5 + 0.22, -1.5, 1.5, L * 0.5 - 0.22].forEach((pz) => {
      addBox(cg, charcoalMat, -W * 0.5 + 0.1, 2.08, pz, 0.18, 3.05, 0.22);
      addBox(cg, charcoalMat, W * 0.5 - 0.1, 2.08, pz, 0.18, 3.05, 0.22);
    });
    const addGlassWall = (gx: number, gz: number, gw: number, gd: number) => {
      const m = new THREE.Mesh(boxGeo, clearCabinGlassMat);
      m.position.set(gx, 2.08, gz);
      m.scale.set(gw, 2.95, gd);
      m.renderOrder = 3;
      cg.add(m);
    };
    addGlassWall(-W * 0.5 + 0.08, -3.25, 0.06, 3.2);
    addGlassWall(-W * 0.5 + 0.08, 3.25, 0.06, 3.2);
    addGlassWall(W * 0.5 - 0.08, -3.25, 0.06, 3.2);
    addGlassWall(W * 0.5 - 0.08, 3.25, 0.06, 3.2);
    if (cIdx === 0) {
      addGlassWall(0, L * 0.5 - 0.08, W - 0.3, 0.06);
    } else {
      addGlassWall(-1.32, L * 0.5 - 0.08, 1.0, 0.06);
      addGlassWall(1.32, L * 0.5 - 0.08, 1.0, 0.06);
      addBox(cg, charcoalMat, 0, 0.545, L * 0.5 + 0.45, 1.75, 0.07, 1.02);
      addBox(cg, silverFrameMat, -0.86, 2.0, L * 0.5 + 0.45, 0.08, 2.9, 0.96);
      addBox(cg, silverFrameMat, 0.86, 2.0, L * 0.5 + 0.45, 0.08, 2.9, 0.96);
    }
    if (cIdx === 2) {
      addGlassWall(0, -L * 0.5 + 0.08, W - 0.3, 0.06);
    } else {
      addGlassWall(-1.32, -L * 0.5 + 0.08, 1.0, 0.06);
      addGlassWall(1.32, -L * 0.5 + 0.08, 1.0, 0.06);
    }

    const makeCoachDoor = (sx: number, dz: number, edgeSign: number) => {
      const dg = new THREE.Group();
      dg.position.set(sx, 2.06, dz);
      const pane = new THREE.Mesh(boxGeo, clearCabinGlassMat);
      pane.scale.set(0.06, 2.9, 1.44);
      pane.renderOrder = 4;
      dg.add(pane);
      addBox(dg, amberRailMat, sx > 0 ? 0.02 : -0.02, 0, edgeSign * 0.7, 0.08, 2.9, 0.05);
      cg.add(dg);
      return dg;
    };
    const doorLF = makeCoachDoor(-W * 0.5 + 0.06, -0.74, 1);
    const doorLR = makeCoachDoor(-W * 0.5 + 0.06, 0.74, -1);
    const doorRF = makeCoachDoor(W * 0.5 - 0.06, -0.74, 1);
    const doorRR = makeCoachDoor(W * 0.5 - 0.06, 0.74, -1);

    coaches.push({
      root: cg,
      offsetMeters,
      doorLeftFront: doorLF,
      doorLeftRear: doorLR,
      doorRightFront: doorRF,
      doorRightRear: doorRR,
      passengers,
      holoScreens: holos,
      pos: new THREE.Vector3(),
      prevPos: new THREE.Vector3(),
      prevQuat: new THREE.Quaternion(),
      sideAxis: new THREE.Vector3(1, 0, 0),
      upAxis: new THREE.Vector3(0, 1, 0),
      fwdAxis: new THREE.Vector3(0, 0, 1),
      yaw: 0,
      colliders: {
        leftFwdWall: createTransitCollider(trainDynCols, 'metal'),
        leftRearWall: createTransitCollider(trainDynCols, 'metal'),
        rightFwdWall: createTransitCollider(trainDynCols, 'metal'),
        rightRearWall: createTransitCollider(trainDynCols, 'metal'),
        frontLeftWall: createTransitCollider(trainDynCols, 'metal'),
        frontRightWall: createTransitCollider(trainDynCols, 'metal'),
        rearLeftWall: createTransitCollider(trainDynCols, 'metal'),
        rearRightWall: createTransitCollider(trainDynCols, 'metal'),
        leftDoorBlocker: createTransitCollider(trainDynCols, 'metal'),
        rightDoorBlocker: createTransitCollider(trainDynCols, 'metal'),
      },
    });
  });

  // Register Single Walkable Glass Sky-Train Door System (no forced seating!)
  const trainWorldPos = new THREE.Vector3(SMART_CITY_TRAIN_STATION.trackX, SMART_CITY_TRAIN_STATION.deckY, SMART_CITY_TRAIN_STATION.z);
  let trainDoorOpen = 1;
  let lastCountdownSent = -1;
  let lastStoppedSent = true;
  let trainRideClock = 0;
  let playerInsideCoachTime = 0;
  let trainBoardedDeparted = false;
  let playerInsideTrainCached = false;

  const updateCoachMatrixAlongSpline = (
    coach: TrainCoachRuntime,
    coachIdx: number,
    headSplineT: number,
    doorOpenAmt: number,
    syncPrev: boolean,
  ) => {
    const t = (((headSplineT + coach.offsetMeters / trackTotalLen) % 1) + 1) % 1;
    const tNext = (t + 0.004) % 1;
    trainCurve.getPointAt(t, _splinePos);
    trainCurve.getPointAt(tNext, _splineNext);
    _tangent.subVectors(_splineNext, _splinePos).normalize();
    // Build upright frame along track tangent (+Z forward for coach lookAt, keeping up near +Y)
    _sideVec.crossVectors(_worldUp, _tangent);
    if (_sideVec.lengthSq() < 1e-4) _sideVec.set(1, 0, 0);
    _sideVec.normalize();
    _upVec.crossVectors(_tangent, _sideVec).normalize();
    _rotMat.makeBasis(_sideVec, _upVec, _tangent);

    if (syncPrev) {
      coach.prevPos.copy(coach.pos);
      coach.prevQuat.copy(coach.root.quaternion);
    }
    coach.root.position.copy(_splinePos).addScaledVector(_upVec, 0.14);
    coach.root.quaternion.setFromRotationMatrix(_rotMat);
    coach.pos.copy(coach.root.position);
    if (!syncPrev) {
      coach.prevPos.copy(coach.pos);
      coach.prevQuat.copy(coach.root.quaternion);
    }
    coach.sideAxis.copy(_sideVec);
    coach.upAxis.copy(_upVec);
    coach.fwdAxis.copy(_tangent);
    coach.yaw = Math.atan2(-_tangent.x, -_tangent.z);

    // Sync solid OBB walls & door blockers for this coach (opening gangway ends between connected coaches)
    const wallYaw = Math.atan2(_sideVec.z, _sideVec.x);
    const doorBlocked = doorOpenAmt < 0.65;
    const cY = coach.pos.y;
    const cw = 3.85;
    const cl = 10.2;
    syncOBBCollider(coach.colliders.leftFwdWall, coach.pos.x, cY, coach.pos.z, wallYaw, -cw * 0.5 + 0.08, -3.3, 0.24, 3.6, 3.5, true);
    syncOBBCollider(coach.colliders.leftRearWall, coach.pos.x, cY, coach.pos.z, wallYaw, -cw * 0.5 + 0.08, 3.3, 0.24, 3.6, 3.5, true);
    syncOBBCollider(coach.colliders.rightFwdWall, coach.pos.x, cY, coach.pos.z, wallYaw, cw * 0.5 - 0.08, -3.3, 0.24, 3.6, 3.5, true);
    syncOBBCollider(coach.colliders.rightRearWall, coach.pos.x, cY, coach.pos.z, wallYaw, cw * 0.5 - 0.08, 3.3, 0.24, 3.6, 3.5, true);
    if (coachIdx === 0) {
      syncOBBCollider(coach.colliders.frontLeftWall, coach.pos.x, cY, coach.pos.z, wallYaw, 0, cl * 0.5 - 0.08, cw - 0.1, 3.6, 0.26, true);
      syncOBBCollider(coach.colliders.frontRightWall, coach.pos.x, cY, coach.pos.z, wallYaw, 0, cl * 0.5 - 0.08, 0.2, 1, 0.2, false);
    } else {
      syncOBBCollider(coach.colliders.frontLeftWall, coach.pos.x, cY, coach.pos.z, wallYaw, -1.32, cl * 0.5 - 0.08, 1.05, 3.6, 0.26, true);
      syncOBBCollider(coach.colliders.frontRightWall, coach.pos.x, cY, coach.pos.z, wallYaw, 1.32, cl * 0.5 - 0.08, 1.05, 3.6, 0.26, true);
    }
    if (coachIdx === coaches.length - 1) {
      syncOBBCollider(coach.colliders.rearLeftWall, coach.pos.x, cY, coach.pos.z, wallYaw, 0, -cl * 0.5 + 0.08, cw - 0.1, 3.6, 0.26, true);
      syncOBBCollider(coach.colliders.rearRightWall, coach.pos.x, cY, coach.pos.z, wallYaw, 0, -cl * 0.5 + 0.08, 0.2, 1, 0.2, false);
    } else {
      syncOBBCollider(coach.colliders.rearLeftWall, coach.pos.x, cY, coach.pos.z, wallYaw, -1.32, -cl * 0.5 + 0.08, 1.05, 3.6, 0.26, true);
      syncOBBCollider(coach.colliders.rearRightWall, coach.pos.x, cY, coach.pos.z, wallYaw, 1.32, -cl * 0.5 + 0.08, 1.05, 3.6, 0.26, true);
    }
    syncOBBCollider(coach.colliders.leftDoorBlocker, coach.pos.x, cY, coach.pos.z, wallYaw, -cw * 0.5 + 0.06, 0, 0.24, 3.6, 3.05, doorBlocked);
    syncOBBCollider(coach.colliders.rightDoorBlocker, coach.pos.x, cY, coach.pos.z, wallYaw, cw * 0.5 - 0.06, 0, 0.24, 3.6, 3.05, doorBlocked);

    const slide = doorOpenAmt * 1.35;
    if (coach.doorLeftFront) coach.doorLeftFront.position.z = -0.74 - slide;
    if (coach.doorLeftRear) coach.doorLeftRear.position.z = 0.74 + slide;
    if (coach.doorRightFront) coach.doorRightFront.position.z = -0.74 - slide;
    if (coach.doorRightRear) coach.doorRightRear.position.z = 0.74 + slide;
  };

  // Initialize initial pose at elevated station
  for (let i = 0; i < coaches.length; i++) {
    updateCoachMatrixAlongSpline(coaches[i], i, stationNormT, 1, false);
  }
  trainWorldPos.copy(coaches[0].root.position);

  const trainEnterLocal = new THREE.Vector3(0.05, 0.62, 0.0);
  const _enterWorldScratch = new THREE.Vector3();
  const trainInteractable: WorldInteractable = {
    id: 'door_sky_train',
    x: SMART_CITY_TRAIN_STATION.platformX - 1.2,
    y: SMART_CITY_TRAIN_STATION.deckY,
    z: SMART_CITY_TRAIN_STATION.z,
    radius: 7.4,
    category: 'transit_door',
    getLabel: () =>
      playerInsideTrainCached
        ? 'Exit Sky-Train Door'
        : 'Enter Sky-Train Door (Walk Inside)',
    trigger: (tCtx) => {
      if (playerInsideTrainCached) {
        playerInsideTrainCached = false;
        playerInsideCoachTime = 0;
        tCtx.movePlayerTo?.(
          SMART_CITY_TRAIN_STATION.platformX + 0.4,
          SMART_CITY_TRAIN_STATION.deckY,
          SMART_CITY_TRAIN_STATION.z,
          Math.PI * 0.5,
        );
        return 'Exited Sky-Train onto Station Platform';
      }
      _enterWorldScratch.copy(trainEnterLocal).applyQuaternion(coaches[0].root.quaternion).add(coaches[0].root.position);
      const forward = _tangent.set(0, 0, 1).applyQuaternion(coaches[0].root.quaternion);
      const boardYaw = Math.atan2(-forward.x, -forward.z);
      playerInsideTrainCached = true;
      playerInsideCoachTime = 0.2;
      tCtx.movePlayerTo?.(_enterWorldScratch.x, _enterWorldScratch.y, _enterWorldScratch.z, boardYaw);
      return 'Entered Glass Sky-Train — Walk freely through coaches with Joystick / WASD!';
    },
  };
  ctx.interactables.push(trainInteractable);

  const animatePassengerArray = (rigs: AnimatedPassengerRig[], holos: THREE.Object3D[], elapsed: number) => {
    for (let i = 0; i < rigs.length; i++) {
      const r = rigs[i];
      const t = elapsed * 2.1 + r.phase;
      r.head.rotation.y = Math.sin(t * 0.7) * 0.24;
      r.head.rotation.x = Math.sin(t * 1.1) * 0.08;
      if (r.kind === 'scientist') {
        r.rightArm.rotation.x = Math.sin(t * 1.4) * 0.12;
        r.leftArm.rotation.x = -Math.sin(t * 1.1) * 0.08;
      } else {
        r.root.position.y = r.baseY + Math.sin(t * 1.8) * 0.04;
        r.rightArm.rotation.x = -0.35 + Math.sin(t * 1.5) * 0.16;
      }
    }
    for (let h = 0; h < holos.length; h++) {
      const hb = holos[h];
      if (hb.userData.baseY === undefined) hb.userData.baseY = hb.position.y;
      hb.position.y = (hb.userData.baseY as number) + Math.sin(elapsed * 2.6 + h) * 0.035;
    }
  };

  const findCoachContaining = (x: number, y: number, z: number): { coach: TrainCoachRuntime; floorY: number } | null => {
    for (let c = 0; c < coaches.length; c++) {
      const co = coaches[c];
      _relScratch.set(x - co.pos.x, y - co.pos.y, z - co.pos.z);
      const lx = _relScratch.dot(co.sideAxis);
      const lz = _relScratch.dot(co.fwdAxis);
      const minZ = c === coaches.length - 1 ? -5.05 : -5.6;
      const maxZ = c === 0 ? 5.05 : 5.6;
      const maxAbsX = Math.abs(lz) > 5.05 ? 0.85 : 1.82;
      if (Math.abs(lx) <= maxAbsX && lz >= minZ && lz <= maxZ) {
        const floorY = co.pos.y + 0.59 * co.upAxis.y + lx * co.sideAxis.y + lz * co.fwdAxis.y;
        if (y >= floorY - 0.65 && y <= floorY + 2.8) {
          return { coach: co, floorY };
        }
      }
    }
    return null;
  };

  return {
    root,
    getGateActors: () => buses.map((b) => ({ x: b.posX, z: b.posZ })),
    getWalkableDeckY: (x, z, curY) => {
      let bestY: number | null = null;
      for (let i = 0; i < buses.length; i++) {
        const b = buses[i];
        const cosY = Math.cos(b.yaw);
        const sinY = Math.sin(b.yaw);
        const relX = x - b.posX;
        const relZ = z - b.posZ;
        const lx = relX * cosY - relZ * sinY;
        const lz = relX * sinY + relZ * cosY;
        if (Math.abs(lx) <= 1.48 && Math.abs(lz) <= 6.12) {
          const deckTop = b.posY + 0.51;
          if (curY >= deckTop - 0.65 && curY <= deckTop + 2.9) {
            if (bestY === null || deckTop > bestY) bestY = deckTop;
          }
        }
      }
      const coachHit = findCoachContaining(x, curY, z);
      if (coachHit && (bestY === null || coachHit.floorY > bestY)) {
        bestY = coachHit.floorY;
      }
      return bestY;
    },
    consumePlayerCarryDelta: (playerPos, outDelta) => {
      for (let i = 0; i < buses.length; i++) {
        const b = buses[i];
        const cPrev = Math.cos(b.prevYaw);
        const sPrev = Math.sin(b.prevYaw);
        const relPrevX = playerPos.x - b.prevX;
        const relPrevZ = playerPos.z - b.prevZ;
        const lxPrev = relPrevX * cPrev - relPrevZ * sPrev;
        const lzPrev = relPrevX * sPrev + relPrevZ * cPrev;
        const deckTop = b.prevY + 0.51;
        if (Math.abs(lxPrev) <= 1.48 && Math.abs(lzPrev) <= 6.12 && Math.abs(playerPos.y - deckTop) <= 0.85) {
          const cosY = Math.cos(b.yaw);
          const sinY = Math.sin(b.yaw);
          const newWorldX = b.posX + lxPrev * cosY + lzPrev * sinY;
          const newWorldZ = b.posZ - lxPrev * sinY + lzPrev * cosY;
          outDelta.set(newWorldX - playerPos.x, b.posY - b.prevY, newWorldZ - playerPos.z);
          return true;
        }
      }
      // Match coach containing player using previous frame pose, then transform into current 3D pose!
      for (let c = 0; c < coaches.length; c++) {
        const co = coaches[c];
        _invPrevQuat.copy(co.prevQuat).invert();
        _deltaLocalScratch.copy(playerPos).sub(co.prevPos).applyQuaternion(_invPrevQuat);
        const minZ = c === coaches.length - 1 ? -5.05 : -5.6;
        const maxZ = c === 0 ? 5.05 : 5.6;
        const maxAbsX = Math.abs(_deltaLocalScratch.z) > 5.05 ? 0.85 : 1.82;
        if (
          Math.abs(_deltaLocalScratch.x) <= maxAbsX &&
          _deltaLocalScratch.z >= minZ &&
          _deltaLocalScratch.z <= maxZ &&
          _deltaLocalScratch.y >= -0.25 &&
          _deltaLocalScratch.y <= 3.1
        ) {
          _deltaLocalScratch.applyQuaternion(co.root.quaternion).add(co.pos);
          outDelta.copy(_deltaLocalScratch).sub(playerPos);
          return true;
        }
      }
      return false;
    },
    update: (dt, elapsed, _nightFactor, playerPos, _cameraPos, ghAt) => {
      const clampedDt = Math.min(0.05, dt);

      // 1. Update 3 Autonomous Panoramic Glass Science Buses (walkable + OBB collision + auto-start on boarding)
      for (let i = 0; i < buses.length; i++) {
        const b = buses[i];
        b.prevX = b.posX;
        b.prevY = b.posY;
        b.prevZ = b.posZ;
        b.prevYaw = b.yaw;

        const cosCur = Math.cos(b.yaw);
        const sinCur = Math.sin(b.yaw);
        const rpx = playerPos.x - b.posX;
        const rpz = playerPos.z - b.posZ;
        const pLocalX = rpx * cosCur - rpz * sinCur;
        const pLocalZ = rpx * sinCur + rpz * cosCur;
        const insideBus =
          Math.abs(pLocalX) <= 1.44 &&
          Math.abs(pLocalZ) <= 6.08 &&
          playerPos.y >= b.posY + 0.1 &&
          playerPos.y <= b.posY + 3.0;
        const atInteriorExitZone = insideBus && pLocalX >= 0.72 && Math.abs(pLocalZ) <= 1.6;
        if (insideBus && !atInteriorExitZone) {
          b.playerBoarded = true;
        } else if (!insideBus) {
          b.playerBoarded = false;
        }

        const distToPlayer = Math.hypot(rpx, rpz);
        const curbStop = (!insideBus && distToPlayer < 11.5) || atInteriorExitZone;

        // If player stepped cleanly inside cabin, close doors & automatically start driving the city tour!
        const targetSpeed = curbStop ? 0 : b.spec.speedMs;
        b.currentSpeed = THREE.MathUtils.damp(b.currentSpeed, targetSpeed, curbStop ? 4.4 : 2.8, clampedDt);
        const targetDoor = curbStop && b.currentSpeed < 0.85 ? 1 : 0;
        b.doorOpen = THREE.MathUtils.damp(b.doorOpen, targetDoor, 6.5, clampedDt);

        b.distanceMeters = (b.distanceMeters + b.currentSpeed * clampedDt) % b.totalLen;
        sampleClosedPolyline2D(b.spec.waypoints, b.distanceMeters, _busSample);
        const groundY = ghAt(_busSample.x, _busSample.z, 0);

        b.posX = _busSample.x;
        b.posY = groundY;
        b.posZ = _busSample.z;
        b.yaw = _busSample.yaw;
        b.root.position.set(b.posX, b.posY, b.posZ);
        b.root.rotation.y = b.yaw;

        // Update 6 solid OBB hull + sliding door colliders every frame
        const busW = 3.1;
        const busL = 12.6;
        const doorBlocked = b.doorOpen < 0.65;
        syncOBBCollider(b.colliders.leftWall, b.posX, b.posY, b.posZ, b.yaw, -busW * 0.5 + 0.08, 0, 0.22, 3.4, busL - 0.1, true);
        syncOBBCollider(b.colliders.rightFwdWall, b.posX, b.posY, b.posZ, b.yaw, busW * 0.5 - 0.08, -3.9, 0.22, 3.4, 4.5, true);
        syncOBBCollider(b.colliders.rightRearWall, b.posX, b.posY, b.posZ, b.yaw, busW * 0.5 - 0.08, 3.9, 0.22, 3.4, 4.5, true);
        syncOBBCollider(b.colliders.frontWall, b.posX, b.posY, b.posZ, b.yaw, 0, -busL * 0.5 + 0.08, busW - 0.1, 3.4, 0.24, true);
        syncOBBCollider(b.colliders.rearWall, b.posX, b.posY, b.posZ, b.yaw, 0, busL * 0.5 - 0.08, busW - 0.1, 3.4, 0.24, true);
        syncOBBCollider(b.colliders.doorBlocker, b.posX, b.posY, b.posZ, b.yaw, busW * 0.5 - 0.06, 0, 0.24, 3.4, 3.1, doorBlocked);

        const wheelSpin = (b.currentSpeed * clampedDt) / 0.53;
        for (let w = 0; w < b.wheels.length; w++) {
          b.wheels[w].rotation.x -= wheelSpin;
        }
        const slide = b.doorOpen * 1.42;
        b.doorFront.position.z = -0.78 - slide;
        b.doorRear.position.z = 0.78 + slide;

        animatePassengerArray(b.passengers, b.holoScreens, elapsed);

        if (b.playerBoarded) {
          b.interactable.x = playerPos.x;
          b.interactable.y = b.posY + 0.6;
          b.interactable.z = playerPos.z;
        } else {
          const doorWorldX = b.posX + 1.9 * cosCur;
          const doorWorldZ = b.posZ - 1.9 * sinCur;
          b.interactable.x = doorWorldX;
          b.interactable.y = b.posY + 0.85;
          b.interactable.z = doorWorldZ;
        }
      }

      // 2. Update Single Dome-Climbing Panoramic Glass Sky-Train & Station Board
      trainRideClock += clampedDt;
      const preCycle = computeTrainStationCycle(
        trainRideClock,
        SMART_CITY_TRAIN_STATION.dwellSeconds,
        SMART_CITY_TRAIN_STATION.rideLapSeconds,
        stationNormT,
      );
      const coachHit = findCoachContaining(playerPos.x, playerPos.y, playerPos.z);
      const playerInTrain = coachHit !== null;
      playerInsideTrainCached = playerInTrain;
      if (preCycle.stoppedAtStation && playerInTrain) {
        playerInsideCoachTime += clampedDt;
        if (playerInsideCoachTime > 0.75 && !trainBoardedDeparted) {
          // Jump cleanly to departure moment so doors close & train climbs the Glass Dome immediately!
          const totalPeriod = SMART_CITY_TRAIN_STATION.dwellSeconds + SMART_CITY_TRAIN_STATION.rideLapSeconds;
          const curLocal = ((trainRideClock % totalPeriod) + totalPeriod) % totalPeriod;
          if (curLocal < SMART_CITY_TRAIN_STATION.dwellSeconds) {
            trainRideClock += SMART_CITY_TRAIN_STATION.dwellSeconds - curLocal;
          }
          trainBoardedDeparted = true;
        }
      } else if (!preCycle.stoppedAtStation) {
        playerInsideCoachTime = 0;
        trainBoardedDeparted = false;
      } else {
        playerInsideCoachTime = 0;
      }

      const cycle = computeTrainStationCycle(
        trainRideClock,
        SMART_CITY_TRAIN_STATION.dwellSeconds,
        SMART_CITY_TRAIN_STATION.rideLapSeconds,
        stationNormT,
      );
      trainDoorOpen = THREE.MathUtils.damp(trainDoorOpen, cycle.doorOpenTarget, 6.0, clampedDt);

      for (let c = 0; c < coaches.length; c++) {
        updateCoachMatrixAlongSpline(coaches[c], c, cycle.splineT, trainDoorOpen, true);
      }
      trainWorldPos.copy(coaches[0].root.position);

      // Update door interactable location: follows player inside any coach, or platform edge when stopped
      if (playerInTrain && coachHit) {
        trainInteractable.x = playerPos.x;
        trainInteractable.y = coachHit.floorY;
        trainInteractable.z = playerPos.z;
      } else if (cycle.stoppedAtStation) {
        trainInteractable.x = SMART_CITY_TRAIN_STATION.platformX - 1.2;
        trainInteractable.y = SMART_CITY_TRAIN_STATION.deckY;
        trainInteractable.z = SMART_CITY_TRAIN_STATION.z;
      } else {
        trainInteractable.x = coaches[0].pos.x;
        trainInteractable.y = coaches[0].pos.y + 0.6;
        trainInteractable.z = coaches[0].pos.z;
      }

      animatePassengerArray(allTrainPassengers, allTrainHolos, elapsed);

      if (cycle.countdownSec !== lastCountdownSent || cycle.stoppedAtStation !== lastStoppedSent) {
        lastCountdownSent = cycle.countdownSec;
        lastStoppedSent = cycle.stoppedAtStation;
        updateStationStatusCanvas(stationCanvas, stationTex, cycle.stoppedAtStation, cycle.countdownSec);
      }
    },
    dispose: () => {
      localTexs.forEach((t) => t.dispose());
      void localGeos;
      void localMats;
    },
  };
}
