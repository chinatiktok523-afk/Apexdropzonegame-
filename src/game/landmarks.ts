import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DigitalDisplayManager } from './digitalDisplays';
import {
  PropColliderAdder,
  buildRealisticBench,
  buildRealisticStreetlight,
  buildRealisticTree,
} from './urbanProps';

export interface LandmarkContext {
  sceneParent: THREE.Group;
  groundHeightAt: (x: number, z: number, currentY?: number) => number;
  addCollider: PropColliderAdder;
  shootableEnv: THREE.Object3D[];
  isNight: boolean;
  isSoftwareGl: boolean;
  geometriesToDispose: THREE.BufferGeometry[];
  materialsToDispose: THREE.Material[];
  displays: DigitalDisplayManager;
  updaters: Array<(dt: number, elapsed: number) => void>;
}

type Bucket = 'solid' | 'glossy' | 'emissive' | 'glass';

interface LandmarkMats {
  solid: THREE.MeshStandardMaterial;
  glossy: THREE.MeshStandardMaterial;
  emissive: THREE.MeshBasicMaterial;
  glass: THREE.MeshStandardMaterial;
  all: THREE.Material[];
}

const landmarkMatsCache = new WeakMap<THREE.Group, LandmarkMats>();

function getLandmarkMats(ctx: LandmarkContext): LandmarkMats {
  let cached = landmarkMatsCache.get(ctx.sceneParent);
  if (!cached) {
    const solid = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0.08,
    });
    const glossy = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.24,
      metalness: 0.36,
    });
    const emissive = new THREE.MeshBasicMaterial({
      vertexColors: true,
      toneMapped: false,
      color: ctx.isNight ? 0xffffff : 0xfef9c3,
    });
    const glass = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.78,
    });
    cached = { solid, glossy, emissive, glass, all: [solid, glossy, emissive, glass] };
    ctx.materialsToDispose.push(...cached.all);
    landmarkMatsCache.set(ctx.sceneParent, cached);
  }
  return cached;
}

class LandmarkBuilder {
  private buckets: Record<Bucket, THREE.BufferGeometry[]> = {
    solid: [],
    glossy: [],
    emissive: [],
    glass: [],
  };
  public partCount = 0;

  public addGeo(geo: THREE.BufferGeometry, colorHex: number, bucket: Bucket = 'solid'): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    const count = g.attributes.position.count;
    const col = new THREE.Color(colorHex);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = col.r;
      arr[i * 3 + 1] = col.g;
      arr[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.buckets[bucket].push(g);
    if (g !== geo) geo.dispose();
    this.partCount++;
  }

  public addBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    colorHex: number,
    bucket: Bucket = 'solid',
    rotX = 0,
    rotY = 0,
    rotZ = 0,
  ): void {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    this.addGeo(g, colorHex, bucket);
  }

  public addCylinder(
    rTop: number,
    rBot: number,
    h: number,
    segs: number,
    x: number,
    y: number,
    z: number,
    colorHex: number,
    bucket: Bucket = 'solid',
    rotX = 0,
    rotY = 0,
    rotZ = 0,
  ): void {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    this.addGeo(g, colorHex, bucket);
  }

  public addStrut(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    radius: number,
    colorHex: number,
    bucket: Bucket = 'glossy',
  ): void {
    const pA = new THREE.Vector3(ax, ay, az);
    const pB = new THREE.Vector3(bx, by, bz);
    const dir = new THREE.Vector3().subVectors(pB, pA);
    const len = dir.length();
    if (len < 0.01) return;
    const g = new THREE.CylinderGeometry(radius, radius, len, 6);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    g.applyQuaternion(quat);
    g.translate((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
    this.addGeo(g, colorHex, bucket);
  }

  public commit(
    ctx: LandmarkContext,
    x: number,
    y: number,
    z: number,
    rotY = 0,
    opts?: { castShadow?: boolean; receiveShadow?: boolean; shootable?: boolean },
  ): THREE.Group {
    const mats = getLandmarkMats(ctx);
    const group = new THREE.Group();
    const cast = opts?.castShadow ?? !ctx.isSoftwareGl;
    const recv = opts?.receiveShadow ?? true;

    (['solid', 'glossy', 'emissive', 'glass'] as Bucket[]).forEach((b) => {
      const list = this.buckets[b];
      if (list.length === 0) return;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      ctx.geometriesToDispose.push(merged);
      const mesh = new THREE.Mesh(merged, mats[b]);
      mesh.castShadow = b !== 'emissive' && b !== 'glass' && cast;
      mesh.receiveShadow = b !== 'emissive' && recv;
      group.add(mesh);
    });

    group.position.set(x, y, z);
    group.rotation.y = rotY;
    ctx.sceneParent.add(group);
    if (opts?.shootable !== false) {
      ctx.shootableEnv.push(group);
    }
    return group;
  }
}

/**
 * 1. STADIUM LANDMARK (Smooth tiered arena bowl + open entry portals + live digital Jumbotron)
 */
export function placeStadiumLandmark(
  ctx: LandmarkContext,
  opts: { x: number; z: number; rotY?: number; scale?: number; title?: string },
): number {
  const { x, z } = opts;
  const rotY = opts.rotY ?? 0;
  const s = opts.scale ?? 1;
  const gy = ctx.groundHeightAt(x, z, 0);
  const lb = new LandmarkBuilder();

  // Mowed pitch turf stripes & chalk markings
  for (let i = 0; i < 8; i++) {
    const px = (-14.875 + i * 4.25) * s;
    lb.addBox(px, 0.08, 0, 4.25 * s, 0.16, 22 * s, i % 2 === 0 ? 0x22c55e : 0x16a34a, 'solid');
  }
  lb.addBox(0, 0.17, 0, 0.28 * s, 0.04, 21.5 * s, 0xf8fafc, 'solid');
  lb.addBox(0, 0.17, -10.8 * s, 33.8 * s, 0.04, 0.28 * s, 0xf8fafc, 'solid');
  lb.addBox(0, 0.17, 10.8 * s, 33.8 * s, 0.04, 0.28 * s, 0xf8fafc, 'solid');

  // Cylindrical Goalposts
  [-15.5 * s, 15.5 * s].forEach((gx) => {
    lb.addCylinder(0.11 * s, 0.11 * s, 2.6 * s, 8, gx, 1.4 * s, -2.2 * s, 0xffffff, 'glossy');
    lb.addCylinder(0.11 * s, 0.11 * s, 2.6 * s, 8, gx, 1.4 * s, 2.2 * s, 0xffffff, 'glossy');
    lb.addCylinder(0.11 * s, 0.11 * s, 4.65 * s, 8, gx, 2.7 * s, 0, 0xffffff, 'glossy', Math.PI / 2);
  });

  // Tiered North & South Grandstands + Swept Cantilever Roof Canopies
  [-1, 1].forEach((side) => {
    for (let tier = 0; tier < 5; tier++) {
      const tz = side * (12.8 + tier * 1.45) * s;
      const ty = (0.65 + tier * 1.15) * s;
      const seatColor = tier % 2 === 0 ? (side < 0 ? 0x0284c7 : 0xea580c) : 0xfacc15;
      if (tier <= 1) {
        [-11.5 * s, 11.5 * s].forEach((segX) => {
          lb.addBox(segX, ty, tz, 14 * s, 1.1 * s, 1.35 * s, seatColor, 'solid');
        });
      } else {
        lb.addBox(0, ty, tz, 37 * s, 1.1 * s, 1.35 * s, seatColor, 'solid');
      }
    }
    [-12.5 * s, 12.5 * s].forEach((fx) => {
      lb.addBox(fx, 3.1 * s, side * 19.6 * s, 13 * s, 6.2 * s, 1.3 * s, 0xf1f5f9, 'solid');
      lb.addBox(fx, 6.35 * s, side * 19.6 * s, 13.2 * s, 0.55 * s, 1.45 * s, 0xf97316, 'glossy');
    });
    lb.addBox(0, 8.2 * s, side * 16.0 * s, 39 * s, 0.55 * s, 8.5 * s, 0xf8fafc, 'glossy', side * 0.08);
    lb.addBox(0, 7.8 * s, side * 12.0 * s, 38 * s, 0.3 * s, 0.3 * s, side < 0 ? 0x38bdf8 : 0xfb923c, 'emissive');
  });

  // East & West End Stands
  [-1, 1].forEach((side) => {
    for (let tier = 0; tier < 4; tier++) {
      const tx = side * (18.5 + tier * 1.4) * s;
      const ty = (0.65 + tier * 1.1) * s;
      const seatCol = tier % 2 === 0 ? 0xef4444 : 0xf8fafc;
      if (tier <= 1) {
        [-7.5 * s, 7.5 * s].forEach((sz) => {
          lb.addBox(tx, ty, sz, 1.35 * s, 1.05 * s, 8 * s, seatCol, 'solid');
        });
      } else {
        lb.addBox(tx, ty, 0, 1.35 * s, 1.05 * s, 23 * s, seatCol, 'solid');
      }
    }
    lb.addBox(side * 23.4 * s, 2.9 * s, 0, 1.3 * s, 5.8 * s, 25 * s, 0xf1f5f9, 'solid');
    lb.addBox(side * 23.4 * s, 5.95 * s, 0, 1.45 * s, 0.55 * s, 25.2 * s, 0x0284c7, 'glossy');
  });

  // 4 Tapered Tubular Floodlight Masts
  [
    [-22 * s, -18 * s],
    [22 * s, -18 * s],
    [-22 * s, 18 * s],
    [22 * s, 18 * s],
  ].forEach(([fx, fz]) => {
    lb.addCylinder(0.38 * s, 0.65 * s, 15 * s, 10, fx, 7.5 * s, fz, 0x475569, 'glossy');
    lb.addBox(fx, 15.2 * s, fz, 3.6 * s, 1.6 * s, 1.1 * s, 0xfef08a, 'emissive');
  });

  const group = lb.commit(ctx, x, gy, z, rotY);

  // Live Working Digital Jumbotron
  const { material } = ctx.displays.createDisplayMaterial('stadium_scoreboard', {
    title: opts.title || 'APEX STADIUM CUP',
  });
  const boardGeo = new THREE.PlaneGeometry(11.5 * s, 5.2 * s);
  const boardFront = new THREE.Mesh(boardGeo, material);
  boardFront.position.set(0, 10.6 * s, -15.4 * s);
  const boardBack = new THREE.Mesh(boardGeo, material);
  boardBack.position.set(0, 10.6 * s, -16.1 * s);
  boardBack.rotation.y = Math.PI;
  const frameGeo = new THREE.BoxGeometry(12.2 * s, 5.8 * s, 0.5 * s);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.6 });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.set(0, 10.6 * s, -15.75 * s);
  group.add(frameMesh, boardFront, boardBack);
  ctx.geometriesToDispose.push(boardGeo, frameGeo);
  ctx.materialsToDispose.push(material, frameMat);

  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const addLocalCollider = (lx: number, lz: number, w: number, h: number, d: number) => {
    const wx = x + lx * cos + lz * sin;
    const wz = z - lx * sin + lz * cos;
    ctx.addCollider(wx, gy, wz, w, h, d, rotY, 'concrete');
  };
  [-12.5 * s, 12.5 * s].forEach((lx) => {
    addLocalCollider(lx, -16.2 * s, 13.5 * s, 6.5 * s, 7.2 * s);
    addLocalCollider(lx, 16.2 * s, 13.5 * s, 6.5 * s, 7.2 * s);
  });
  [-8.0 * s, 8.0 * s].forEach((lz) => {
    addLocalCollider(-21.2 * s, lz, 5.6 * s, 5.8 * s, 8.5 * s);
    addLocalCollider(21.2 * s, lz, 5.6 * s, 5.8 * s, 8.5 * s);
  });

  return lb.partCount;
}

/**
 * 2. LARGE LATTICE SPIRE TOWER (Tapered steel trusses + arched stone plinth + observation decks + beacon)
 */
export function placeLargeTowerLandmark(
  ctx: LandmarkContext,
  opts: { x: number; z: number; height?: number; baseHalfW?: number; primaryHex?: number },
): number {
  const gy = ctx.groundHeightAt(opts.x, opts.z, 0);
  const height = opts.height ?? 44;
  const baseHalfW = opts.baseHalfW ?? 5.8;
  const primaryHex = opts.primaryHex ?? 0xef4444;
  const lb = new LandmarkBuilder();

  // Podium base
  lb.addCylinder(baseHalfW * 1.35, baseHalfW * 1.48, 2.6, 8, 0, 1.3, 0, 0xf8fafc, 'solid');
  lb.addCylinder(baseHalfW * 1.25, baseHalfW * 1.35, 0.55, 8, 0, 2.75, 0, 0x0ea5e9, 'glossy');

  // Sweeping tapered 4-leg tubular lattice steel tower
  const tiers = 10;
  const tierH = height / tiers;
  const radiusAt = (f: number) => THREE.MathUtils.lerp(baseHalfW, 0.85, Math.pow(f, 0.72));

  for (let t = 0; t < tiers; t++) {
    const f0 = t / tiers;
    const f1 = (t + 1) / tiers;
    const y0 = 2.8 + t * tierH;
    const y1 = 2.8 + (t + 1) * tierH;
    const r0 = radiusAt(f0);
    const r1 = radiusAt(f1);
    const col = t % 2 === 0 ? primaryHex : 0xf8fafc;
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (let c = 0; c < 4; c++) {
      const [cx, cz] = corners[c];
      const [nx, nz] = corners[(c + 1) % 4];
      // Main corner leg
      lb.addStrut(cx * r0, y0, cz * r0, cx * r1, y1, cz * r1, 0.24 - f0 * 0.1, col, 'glossy');
      // Horizontal brace + X-diagonal truss
      lb.addStrut(cx * r1, y1, cz * r1, nx * r1, y1, nz * r1, 0.14 - f0 * 0.05, col, 'glossy');
      lb.addStrut(cx * r0, y0, cz * r0, nx * r1, y1, nz * r1, 0.1, 0xe2e8f0, 'glossy');
    }

    // Observation decks at 40% and 78% elevation
    if (t === 3 || t === 7) {
      lb.addCylinder(r1 * 1.55, r1 * 1.35, 1.3, 16, 0, y1, 0, 0x1e293b, 'glossy');
      lb.addCylinder(r1 * 1.58, r1 * 1.58, 0.5, 16, 0, y1 + 0.3, 0, 0xfef08a, 'emissive');
    }
  }

  // Upper Broadcast Spire Needle
  lb.addCylinder(0.08, 0.45, 10.2, 10, 0, 2.8 + height + 5.1, 0, 0xf8fafc, 'glossy');

  const group = lb.commit(ctx, opts.x, gy, opts.z, 0);

  const beaconGeo = new THREE.SphereGeometry(0.55, 10, 10);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2244, toneMapped: false });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0, 2.8 + height + 10.2, 0);
  group.add(beacon);
  ctx.geometriesToDispose.push(beaconGeo);
  ctx.materialsToDispose.push(beaconMat);

  ctx.updaters.push((_dt, elapsed) => {
    beacon.visible = Math.sin(elapsed * 4.2 + opts.x) > -0.15;
  });

  ctx.addCollider(opts.x, gy, opts.z, baseHalfW * 2.1, 14, baseHalfW * 2.1, 0, 'metal');
  return lb.partCount;
}

/**
 * 3. RAILWAY STATION & STREAMLINED 4-CAR EXPRESS TRAIN
 */
export function placeRailwayStationLandmark(
  ctx: LandmarkContext,
  opts: {
    x: number;
    z: number;
    rotY?: number;
    trackSpan?: number;
    trainColor?: number;
    title?: string;
  },
): number {
  const { x, z } = opts;
  const rotY = opts.rotY ?? 0;
  const trackSpan = opts.trackSpan ?? 116;
  const gy = ctx.groundHeightAt(x, z, 0);
  const lb = new LandmarkBuilder();

  // Raised Platforms + Cylindrical Canopy Columns & Curved Glass Sheds
  [-5.2, 5.2].forEach((pz, pIdx) => {
    lb.addBox(0, 0.55, pz, 28, 1.1, 4.4, pIdx === 0 ? 0xe2e8f0 : 0xcbd5e1, 'solid');
    lb.addBox(0, 1.12, pz - Math.sign(pz) * 2.0, 28, 0.06, 0.25, 0xfacc15, 'solid');
    [-11, -4, 4, 11].forEach((px) => {
      lb.addCylinder(0.2, 0.24, 3.6, 8, px, 2.6, pz, 0x1e293b, 'glossy');
    });
    lb.addBox(0, 4.55, pz, 27, 0.3, 4.2, 0x0284c7, 'glossy');
    lb.addBox(0, 4.72, pz, 22, 0.14, 2.4, 0x38bdf8, 'glass');
  });

  // Grand Concourse Hall & Clock Arch
  lb.addBox(0, 3.6, 10.6, 22, 7.2, 6.8, 0xf8fafc, 'solid');
  lb.addBox(0, 7.35, 10.6, 22.8, 0.6, 7.4, 0x1e3a8a, 'glossy');
  lb.addBox(0, 3.6, 7.18, 9.5, 4.5, 0.18, 0x38bdf8, 'glass');
  lb.addCylinder(1.2, 1.2, 0.4, 18, 0, 7.8, 7.2, 0xf59e0b, 'glossy', Math.PI / 2);
  lb.addCylinder(0.95, 0.95, 0.44, 18, 0, 7.8, 7.2, 0xfef9c3, 'emissive', Math.PI / 2);

  // Steel Rails + Wooden Ties + Catenary Gantries
  const sleeperCount = Math.floor(trackSpan / 1.8);
  for (let i = 0; i <= sleeperCount; i++) {
    const rx = -trackSpan * 0.5 + (i / sleeperCount) * trackSpan;
    [-1.6, 1.6].forEach((rz) => {
      lb.addBox(rx, 0.08, rz, 0.42, 0.14, 2.2, 0x5c4033, 'solid');
    });
  }
  [-2.35, -0.85, 0.85, 2.35].forEach((rz) => {
    lb.addBox(0, 0.2, rz, trackSpan, 0.15, 0.12, 0x94a3b8, 'glossy');
  });
  for (let cx = -trackSpan * 0.45; cx <= trackSpan * 0.45; cx += 18) {
    lb.addCylinder(0.14, 0.16, 6.4, 8, cx, 3.2, -3.5, 0x334155, 'glossy');
    lb.addCylinder(0.14, 0.16, 6.4, 8, cx, 3.2, 3.5, 0x334155, 'glossy');
    lb.addCylinder(0.12, 0.12, 7.4, 8, cx, 6.2, 0, 0x475569, 'glossy', Math.PI / 2);
  }

  const stationGroup = lb.commit(ctx, x, gy, z, rotY);

  // Digital Railway Timetable
  const { material: boardMat } = ctx.displays.createDisplayMaterial('railway_timetable', {
    title: opts.title || 'CENTRAL STATION LIVE',
  });
  const boardGeo = new THREE.PlaneGeometry(7.2, 3.2);
  const board1 = new THREE.Mesh(boardGeo, boardMat);
  board1.position.set(0, 5.2, 7.05);
  board1.rotation.y = Math.PI;
  const board2 = new THREE.Mesh(boardGeo, boardMat);
  board2.position.set(0, 5.2, 14.15);
  stationGroup.add(board1, board2);
  ctx.geometriesToDispose.push(boardGeo);
  ctx.materialsToDispose.push(boardMat);

  // Sleek Streamlined 4-Car Aerodynamic Express Train
  const trainLb = new LandmarkBuilder();
  const bodyHex = opts.trainColor ?? 0x0ea5e9;
  const noseShape = new THREE.Shape();
  noseShape.moveTo(-4.4, 0.72);
  noseShape.lineTo(3.2, 0.72);
  noseShape.lineTo(4.6, 0.95);
  noseShape.quadraticCurveTo(4.45, 2.15, 2.8, 2.88);
  noseShape.lineTo(-4.4, 2.88);
  noseShape.closePath();

  for (let car = 0; car < 4; car++) {
    const cx = (car - 1.5) * 9.8;
    // Steel wheel bogies
    [-3.1, 3.1].forEach((wx) => {
      trainLb.addCylinder(0.4, 0.4, 2.0, 12, cx + wx, 0.45, 0, 0x1e293b, 'glossy', Math.PI / 2);
    });
    if (car === 0 || car === 3) {
      const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
        depth: 2.32,
        bevelEnabled: true,
        bevelThickness: 0.12,
        bevelSize: 0.1,
        bevelSegments: 2,
      });
      noseGeo.translate(0, 0, -1.16);
      if (car === 0) noseGeo.rotateY(Math.PI);
      noseGeo.translate(cx, 0, 0);
      trainLb.addGeo(noseGeo, bodyHex, 'glossy');
      const endX = car === 0 ? cx - 4.45 : cx + 4.45;
      trainLb.addBox(endX, 1.35, -0.65, 0.14, 0.25, 0.34, 0xfef08a, 'emissive');
      trainLb.addBox(endX, 1.35, 0.65, 0.14, 0.25, 0.34, 0xfef08a, 'emissive');
    } else {
      trainLb.addBox(cx, 1.85, 0, 8.8, 2.15, 2.42, bodyHex, 'glossy');
      trainLb.addBox(cx, 2.95, 0, 8.8, 0.18, 2.38, 0xf8fafc, 'glossy');
    }
    // Panoramic tinted passenger windows
    trainLb.addBox(cx, 2.05, 0, 7.2, 0.72, 2.48, 0x38bdf8, 'glass');
  }

  const trainGroup = trainLb.commit(ctx, x, gy + 0.28, z, rotY, { shootable: false });
  // Reparent train cleanly inside stationGroup local coordinates
  ctx.sceneParent.remove(trainGroup);
  trainGroup.position.set(0, 0.28, -1.6);
  trainGroup.rotation.set(0, 0, 0);
  stationGroup.add(trainGroup);

  const maxSlide = Math.max(12, trackSpan * 0.5 - 22);
  ctx.updaters.push((_dt, elapsed) => {
    const raw = Math.sin(elapsed * 0.28);
    const eased = Math.sign(raw) * Math.pow(Math.abs(raw), 0.78);
    trainGroup.position.x = eased * maxSlide;
  });

  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const addLocal = (lx: number, lz: number, w: number, h: number, d: number) => {
    ctx.addCollider(x + lx * cos + lz * sin, gy, z - lx * sin + lz * cos, w, h, d, rotY, 'concrete');
  };
  addLocal(0, 10.6, 22, 7.2, 6.8);

  return lb.partCount + trainLb.partCount;
}

/**
 * 4. INDUSTRIAL FACTORY LANDMARK (LatheGeometry Hyperbolic Cooling Towers + Animated Steam + Turbine Halls)
 */
export function placeIndustrialFactoryLandmark(
  ctx: LandmarkContext,
  opts: { x: number; z: number; rotY?: number; scale?: number },
): number {
  const { x, z } = opts;
  const rotY = opts.rotY ?? 0;
  const s = opts.scale ?? 1;
  const gy = ctx.groundHeightAt(x, z, 0);
  const lb = new LandmarkBuilder();

  // Concrete apron
  lb.addBox(0, 0.14, 0, 38 * s, 0.28, 30 * s, 0x475569, 'solid');

  // True smooth hyperbolic LatheGeometry cooling towers!
  const lathePts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const h = t * 14.5 * s;
    const pinch = 1 - Math.sin(t * Math.PI * 0.85) * 0.26;
    const r = THREE.MathUtils.lerp(4.6 * s, 3.6 * s, t) * pinch;
    lathePts.push(new THREE.Vector2(r, h));
  }

  [
    [-11 * s, -7.5 * s],
    [2 * s, -8.5 * s],
  ].forEach(([tx, tz]) => {
    const towerGeo = new THREE.LatheGeometry(lathePts, 22);
    towerGeo.translate(tx, 0.28, tz);
    lb.addGeo(towerGeo, 0xe2e8f0, 'solid');
    lb.addCylinder(3.85 * s, 3.85 * s, 1.4 * s, 22, tx, 12.2 * s, tz, 0xef4444, 'glossy');
    lb.addCylinder(4.65 * s, 4.65 * s, 0.8 * s, 22, tx, 0.7 * s, tz, 0xfacc15, 'solid');
  });

  // Tall Red-White Striped Smokestack
  for (let seg = 0; seg < 8; seg++) {
    const y = 0.28 + seg * 2.75 * s + 1.375 * s;
    const rB = THREE.MathUtils.lerp(1.55, 0.95, seg / 8) * s;
    const rT = THREE.MathUtils.lerp(1.55, 0.95, (seg + 1) / 8) * s;
    lb.addCylinder(rT, rB, 2.75 * s, 16, 13 * s, y, -8 * s, seg % 2 === 0 ? 0xef4444 : 0xf8fafc, 'solid');
  }

  // Turbine & Boiler Halls
  lb.addBox(-5 * s, 3.6 * s, 5.5 * s, 16 * s, 6.8 * s, 10 * s, 0x0284c7, 'solid');
  lb.addBox(-5 * s, 3.6 * s, 5.5 * s, 16.2 * s, 1.8 * s, 8.2 * s, 0x38bdf8, 'glass');
  lb.addBox(10.5 * s, 3.1 * s, 5.0 * s, 11 * s, 5.8 * s, 9 * s, 0xb45309, 'solid');

  // Cylindrical Chemical Storage Tanks
  [
    [-14 * s, 7.5 * s],
    [-14 * s, 12.0 * s],
    [14.5 * s, 11.5 * s],
  ].forEach(([cx, cz]) => {
    lb.addCylinder(2.1 * s, 2.1 * s, 4.4 * s, 18, cx, 2.5 * s, cz, 0xf8fafc, 'glossy');
    lb.addCylinder(2.14 * s, 2.14 * s, 0.55 * s, 18, cx, 3.2 * s, cz, 0xef4444, 'glossy');
  });

  // Overhead Cylindrical Pipelines & Containers
  lb.addCylinder(0.32 * s, 0.32 * s, 26 * s, 10, 0, 4.8 * s, -0.5 * s, 0xfacc15, 'glossy', 0, 0, Math.PI / 2);
  lb.addCylinder(0.26 * s, 0.26 * s, 22 * s, 10, 2 * s, 5.5 * s, 0.3 * s, 0x38bdf8, 'glossy', 0, 0, Math.PI / 2);
  lb.addBox(4 * s, 1.5 * s, 12 * s, 6.4 * s, 2.6 * s, 2.6 * s, 0xea580c, 'solid');
  lb.addBox(4 * s, 4.1 * s, 12 * s, 6.4 * s, 2.6 * s, 2.6 * s, 0x0ea5e9, 'solid');

  const factoryGroup = lb.commit(ctx, x, gy, z, rotY);

  // Soft spherical rising steam clouds (never cubes!)
  const steamGeo = new THREE.SphereGeometry(1.1 * s, 8, 8);
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xf1f5f9,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  ctx.geometriesToDispose.push(steamGeo);
  ctx.materialsToDispose.push(steamMat);

  const puffs: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }> = [];
  const sources = [
    { x: -11 * s, y: 15.2 * s, z: -7.5 * s },
    { x: 2 * s, y: 15.2 * s, z: -8.5 * s },
    { x: 13 * s, y: 22.8 * s, z: -8 * s },
  ];
  sources.forEach((src, sIdx) => {
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(steamGeo, steamMat);
      factoryGroup.add(m);
      puffs.push({ mesh: m, baseX: src.x, baseY: src.y, baseZ: src.z, phase: k * 0.25 + sIdx * 0.31 });
    }
  });

  ctx.updaters.push((_dt, elapsed) => {
    for (const p of puffs) {
      const cycle = (elapsed * 0.35 + p.phase) % 1;
      p.mesh.position.set(
        p.baseX + Math.sin(elapsed * 0.8 + p.phase * 6) * 0.9 * cycle,
        p.baseY + cycle * 9.5 * s,
        p.baseZ + cycle * 2.2 * s,
      );
      const scl = (0.7 + cycle * 1.45) * (1 - cycle * 0.35);
      p.mesh.scale.setScalar(scl);
    }
  });

  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const addLocal = (lx: number, lz: number, w: number, h: number, d: number) => {
    ctx.addCollider(x + lx * cos + lz * sin, gy, z - lx * sin + lz * cos, w, h, d, rotY, 'metal');
  };
  addLocal(-11 * s, -7.5 * s, 8.6 * s, 14 * s, 8.6 * s);
  addLocal(2 * s, -8.5 * s, 8.6 * s, 14 * s, 8.6 * s);
  addLocal(-5 * s, 5.5 * s, 16 * s, 6.8 * s, 10 * s);
  addLocal(10.5 * s, 5.0 * s, 11 * s, 5.8 * s, 9 * s);
  addLocal(4 * s, 12 * s, 6.4 * s, 5.2 * s, 2.6 * s);

  return lb.partCount;
}

/**
 * 5. SHOPPING CENTRE LANDMARK (Glass atrium + curved rotunda skylight + digital displays)
 */
export function placeShoppingCentreLandmark(
  ctx: LandmarkContext,
  opts: { x: number; z: number; rotY?: number; scale?: number; title?: string },
): number {
  const { x, z } = opts;
  const rotY = opts.rotY ?? 0;
  const s = opts.scale ?? 1;
  const gy = ctx.groundHeightAt(x, z, 0);
  const lb = new LandmarkBuilder();

  lb.addBox(0, 0.12, 0, 32 * s, 0.24, 24 * s, 0xfef3c7, 'solid');
  lb.addBox(-8.5 * s, 6.1 * s, 0, 9 * s, 12 * s, 18 * s, 0xf43f5e, 'glossy');
  lb.addBox(8.5 * s, 6.1 * s, 0, 9 * s, 12 * s, 18 * s, 0x8b5cf6, 'glossy');
  lb.addBox(0, 6.1 * s, 0, 8 * s, 12 * s, 17.6 * s, 0x38bdf8, 'glass');
  lb.addCylinder(4.8 * s, 4.8 * s, 1.4 * s, 18, 0, 12.6 * s, 0, 0x38bdf8, 'glass');
  lb.addBox(0, 12.3 * s, 0, 26.8 * s, 0.65 * s, 18.8 * s, 0x1e293b, 'glossy');
  lb.addBox(0, 14.0 * s, 0, 10 * s, 3.6 * s, 4 * s, 0x0f172a, 'glossy');
  [-8.5 * s, 8.5 * s].forEach((ax) => {
    lb.addBox(ax, 3.2 * s, 9.8 * s, 6.4 * s, 0.32 * s, 1.9 * s, 0xef4444, 'glossy');
  });

  const mallGroup = lb.commit(ctx, x, gy, z, rotY);

  const { material: mallMat } = ctx.displays.createDisplayMaterial('shopping_mall', {
    title: opts.title || 'GRAND ATRIUM MALL',
  });
  const { material: promoMat } = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'CYBER PLAZA HDR',
    subtitle: 'TECH · ARCADE · BIKE',
    accentHex: '#ec4899',
  });
  const screenGeo1 = new THREE.PlaneGeometry(9.6 * s, 4.4 * s);
  const frontScreen = new THREE.Mesh(screenGeo1, mallMat);
  frontScreen.position.set(0, 8.5 * s, 9.15 * s);

  const screenGeo2 = new THREE.PlaneGeometry(8.6 * s, 3.0 * s);
  const roofScreenF = new THREE.Mesh(screenGeo2, promoMat);
  roofScreenF.position.set(0, 14.0 * s, 2.08 * s);
  const roofScreenB = new THREE.Mesh(screenGeo2, promoMat);
  roofScreenB.position.set(0, 14.0 * s, -2.08 * s);
  roofScreenB.rotation.y = Math.PI;

  mallGroup.add(frontScreen, roofScreenF, roofScreenB);
  ctx.geometriesToDispose.push(screenGeo1, screenGeo2);
  ctx.materialsToDispose.push(mallMat, promoMat);

  ctx.addCollider(x, gy, z, 26 * s, 12 * s, 18 * s, rotY, 'concrete');
  return lb.partCount;
}

/**
 * 6. CITY PARK LANDMARK (Pond, arched timber bridge, tiered circular fountain, domed gazebo, trees & benches)
 */
export function placeCityParkLandmark(
  ctx: LandmarkContext,
  opts: { x: number; z: number; rotY?: number; scale?: number },
): number {
  const { x, z } = opts;
  const rotY = opts.rotY ?? 0;
  const s = opts.scale ?? 1;
  const gy = ctx.groundHeightAt(x, z, 0);
  const lb = new LandmarkBuilder();

  // Lush lawn + stone paths
  lb.addBox(0, 0.08, 0, 28 * s, 0.16, 24 * s, 0x3b9d42, 'solid');
  lb.addBox(0, 0.11, 0, 28 * s, 0.14, 3.2 * s, 0xe2e8f0, 'solid');
  lb.addBox(0, 0.11, 0, 3.2 * s, 0.14, 24 * s, 0xe2e8f0, 'solid');

  // Circular-edged turquoise reflecting pond + stone coping
  lb.addCylinder(6.2 * s, 6.4 * s, 0.18, 22, -5.5 * s, 0.14, 0, 0x94a3b8, 'solid');
  lb.addCylinder(5.6 * s, 5.6 * s, 0.2, 22, -5.5 * s, 0.15, 0, 0x06b6d4, 'glossy');

  // Arched Wooden Footbridge spanning the pond
  for (let b = -5; b <= 5; b++) {
    const bx = -5.5 * s + b * 0.9 * s;
    const archY = 0.45 * s + Math.cos((b / 5) * Math.PI * 0.5) * 0.9 * s;
    lb.addBox(bx, archY, 0, 0.88 * s, 0.2 * s, 2.4 * s, 0xb45309, 'solid');
    lb.addCylinder(0.08 * s, 0.08 * s, 0.9 * s, 6, bx, archY + 0.55 * s, -1.1 * s, 0x78350f, 'solid');
    lb.addCylinder(0.08 * s, 0.08 * s, 0.9 * s, 6, bx, archY + 0.55 * s, 1.1 * s, 0x78350f, 'solid');
  }

  // Tiered Circular Stone Fountain
  lb.addCylinder(3.2 * s, 3.4 * s, 0.65 * s, 20, 5.5 * s, 0.48 * s, 0, 0xcbd5e1, 'solid');
  lb.addCylinder(1.6 * s, 1.2 * s, 1.35 * s, 18, 5.5 * s, 1.35 * s, 0, 0x38bdf8, 'glossy');
  lb.addCylinder(0.42 * s, 0.55 * s, 1.1 * s, 14, 5.5 * s, 2.5 * s, 0, 0x7dd3fc, 'emissive');

  // Conical-Roof Park Gazebo
  const gx = 8.5 * s;
  const gz = -7.5 * s;
  lb.addCylinder(3.1 * s, 3.2 * s, 0.36, 8, gx, 0.24, gz, 0xfef3c7, 'solid');
  [
    [gx - 2.0 * s, gz - 2.0 * s],
    [gx + 2.0 * s, gz - 2.0 * s],
    [gx - 2.0 * s, gz + 2.0 * s],
    [gx + 2.0 * s, gz + 2.0 * s],
  ].forEach(([px, pz]) => {
    lb.addCylinder(0.16 * s, 0.18 * s, 3.0 * s, 10, px, 1.9 * s, pz, 0xf8fafc, 'solid');
  });
  lb.addGeo(
    (() => {
      const c = new THREE.ConeGeometry(3.8 * s, 1.9 * s, 8);
      c.translate(gx, 4.35 * s, gz);
      return c;
    })(),
    0xdc2626,
    'glossy',
  );
  lb.addCylinder(0.15 * s, 0.25 * s, 0.6 * s, 8, gx, 5.4 * s, gz, 0xfacc15, 'emissive');

  const parkGroup = lb.commit(ctx, x, gy, z, rotY);

  const treeOffsets: Array<[number, number, number]> = [
    [-11 * s, -8.5 * s, 1],
    [-11 * s, 8.5 * s, 0],
    [11 * s, 8.5 * s, 1],
    [0.5 * s, -9.2 * s, 0],
    [0.5 * s, 9.2 * s, 1],
  ];
  treeOffsets.forEach(([tx, tz, variant]) => {
    const tb = buildRealisticTree(variant, ctx.isNight);
    tb.group.position.set(tx, 0.16, tz);
    tb.group.scale.setScalar(0.95 * s);
    parkGroup.add(tb.group);
    ctx.geometriesToDispose.push(...tb.geometries);
    ctx.materialsToDispose.push(...tb.materials);
  });

  [
    [5.5 * s, -4.5 * s, 0],
    [5.5 * s, 4.5 * s, Math.PI],
  ].forEach(([bx, bz, bry]) => {
    const bb = buildRealisticBench(ctx.isNight);
    bb.group.position.set(bx, 0.16, bz);
    bb.group.rotation.y = bry;
    parkGroup.add(bb.group);
    ctx.geometriesToDispose.push(...bb.geometries);
    ctx.materialsToDispose.push(...bb.materials);
  });

  [
    [-12 * s, -2 * s, 0],
    [12 * s, 2 * s, Math.PI],
  ].forEach(([lx, lz, lry]) => {
    const st = buildRealisticStreetlight(ctx.isNight, false);
    st.group.position.set(lx, 0.16, lz);
    st.group.rotation.y = lry;
    parkGroup.add(st.group);
    ctx.geometriesToDispose.push(...st.geometries);
    ctx.materialsToDispose.push(...st.materials);
  });

  ctx.addCollider(x + 5.5 * s, gy, z, 2.8 * s, 2.5 * s, 2.8 * s, 0, 'concrete');
  return lb.partCount;
}

/**
 * 7. ANIMATED LIVING BIRDS & RIVER CANAL BARGE
 */
export function addLivingSkyBirds(
  ctx: LandmarkContext,
  centers: Array<{ x: number; y: number; z: number; radius: number }>,
): void {
  const birdShape = new THREE.Shape();
  birdShape.moveTo(-0.55, 0.04);
  birdShape.quadraticCurveTo(-0.18, 0.12, 0, 0.02);
  birdShape.quadraticCurveTo(0.18, 0.12, 0.55, 0.04);
  birdShape.lineTo(0, -0.05);
  birdShape.closePath();
  const birdGeo = new THREE.ExtrudeGeometry(birdShape, { depth: 0.22, bevelEnabled: false });
  birdGeo.center();
  const birdMat = new THREE.MeshBasicMaterial({ color: ctx.isNight ? 0x94a3b8 : 0xffffff });
  ctx.geometriesToDispose.push(birdGeo);
  ctx.materialsToDispose.push(birdMat);

  const birds: Array<{ mesh: THREE.Mesh; cx: number; cy: number; cz: number; rad: number; spd: number; ph: number }> = [];
  centers.forEach((c, idx) => {
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(birdGeo, birdMat);
      ctx.sceneParent.add(m);
      birds.push({
        mesh: m,
        cx: c.x,
        cy: c.y + (i % 2) * 2.5,
        cz: c.z,
        rad: c.radius + i * 3.5,
        spd: 0.42 + (i % 3) * 0.12,
        ph: idx * 1.4 + i * 1.5,
      });
    }
  });

  ctx.updaters.push((_dt, elapsed) => {
    for (const b of birds) {
      const a = elapsed * b.spd + b.ph;
      b.mesh.position.set(
        b.cx + Math.cos(a) * b.rad,
        b.cy + Math.sin(elapsed * 2.2 + b.ph) * 0.9,
        b.cz + Math.sin(a) * b.rad,
      );
      b.mesh.rotation.y = -a;
      b.mesh.rotation.z = Math.sin(elapsed * 8 + b.ph) * 0.25;
    }
  });
}

export function addAnimatedCanalBarge(
  ctx: LandmarkContext,
  opts: { x1: number; z1: number; x2: number; z2: number; waterY: number },
): void {
  const lb = new LandmarkBuilder();
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-5.2, 0.3);
  hullShape.lineTo(4.2, 0.3);
  hullShape.lineTo(5.4, 0.9);
  hullShape.lineTo(-5.0, 0.9);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 3.4,
    bevelEnabled: true,
    bevelThickness: 0.18,
    bevelSize: 0.14,
    bevelSegments: 2,
  });
  hullGeo.translate(0, 0, -1.7);
  hullGeo.rotateY(-Math.PI / 2);
  lb.addGeo(hullGeo, 0x334155, 'glossy');
  lb.addBox(0, 1.35, -1.5, 2.8, 1.25, 5.2, 0x0ea5e9, 'solid');
  lb.addBox(0, 2.02, -1.5, 2.84, 0.25, 5.24, 0xf97316, 'solid');
  lb.addBox(0, 1.55, 3.4, 2.6, 1.6, 2.2, 0xf8fafc, 'solid');
  lb.addBox(0, 1.95, 3.4, 2.64, 0.65, 2.24, 0x38bdf8, 'glass');
  lb.addCylinder(0.18, 0.18, 0.35, 10, 0, 2.65, 3.4, 0xfef08a, 'emissive');

  const group = lb.commit(ctx, opts.x1, opts.waterY, opts.z1, 0, { castShadow: false, shootable: false });
  group.userData.keepInArenaRoot = true;

  const yaw = Math.atan2(opts.x2 - opts.x1, opts.z2 - opts.z1);
  ctx.updaters.push((_dt, elapsed) => {
    const t = 0.5 + 0.5 * Math.sin(elapsed * 0.14);
    const px = THREE.MathUtils.lerp(opts.x1, opts.x2, t);
    const pz = THREE.MathUtils.lerp(opts.z1, opts.z2, t);
    const forward = Math.cos(elapsed * 0.14) >= 0;
    group.position.set(px, opts.waterY + Math.sin(elapsed * 2.1) * 0.06, pz);
    group.rotation.y = forward ? yaw : yaw + Math.PI;
  });
}
