import * as THREE from 'three';
import { addCollider, type RampSurface } from './arena';
import { registerBreakableGlass, type CityPalette, type SimWorldBuildContext } from './buildingsAndTransit';
import type { MallNavData, SignalVisualGroup } from './simulatorNpcs';
import { addRoadMarkingsBatch, type CompiledPropMats, createPropPbrMaterials, PropMeshAssembler } from './urbanProps';

export const EAST_RING_CENTER_X = 975;
export const EAST_RING_CENTER_Z = 0;
export const EAST_RING_OUTER_R = 148;
export const EAST_RING_INNER_R = 74;

export function getIsometricRiverZ(x: number): number {
  return -24 + Math.sin((x - 1140) * 0.022) * 24;
}

export function getGrandEastCityGroundHeight(x: number, z: number): number {
  // Statue of Liberty Star-Fort Harbor Island in channel (cx=742, cz=-155)
  const libDist = Math.hypot(x - 742, z + 155);
  if (libDist < 26) {
    if (libDist <= 16) return 0.75;
    const t = THREE.MathUtils.smoothstep(libDist, 16, 26);
    return THREE.MathUtils.lerp(0.75, -3.5, t);
  }

  if (x < 782) return 0;

  let h = 0;

  // East Island perimeter shoreline taper into deep ocean
  const northSouthDist = Math.abs(z) - 312;
  const farEastDist = x - 1488;
  const shoreOverflow = Math.max(northSouthDist, farEastDist);
  if (shoreOverflow > 0) {
    const t = THREE.MathUtils.smoothstep(shoreOverflow, 0, 26);
    h = THREE.MathUtils.lerp(0, -3.8, t);
  }

  // Royal Medieval Castle Moat trench (around square perimeter x in [1152..1418], z in [88..288])
  if (x >= 1148 && x <= 1422 && z >= 84 && z <= 292) {
    const inOuter = x >= 1152 && x <= 1418 && z >= 88 && z <= 288;
    const inInner = x >= 1168 && x <= 1402 && z >= 104 && z <= 272;
    if (inOuter && !inInner) {
      const dEdge = Math.min(
        Math.abs(x - 1152),
        Math.abs(x - 1418),
        Math.abs(z - 88),
        Math.abs(z - 288),
        Math.abs(x - 1168),
        Math.abs(x - 1402),
        Math.abs(z - 104),
        Math.abs(z - 272),
      );
      const bank = THREE.MathUtils.smoothstep(dEdge, 0, 2.8);
      h = Math.min(h, THREE.MathUtils.lerp(0, -1.65, bank));
    }
  }

  // Isometric Winding River channel (x in [1142..1472])
  if (x >= 1142 && x <= 1472) {
    const rz = getIsometricRiverZ(x);
    const rDist = Math.abs(z - rz);
    if (rDist < 11.5) {
      const bank = THREE.MathUtils.smoothstep(rDist, 8.2, 11.5);
      h = Math.min(h, THREE.MathUtils.lerp(-1.85, 0, bank));
    }
  }

  // Eastern Snow-Capped Mountain Ridge (x in [1380..1482], z in [-142..82])
  if (x >= 1380 && x <= 1482 && z >= -142 && z <= 82) {
    const rz = getIsometricRiverZ(x);
    const riverClear = THREE.MathUtils.smoothstep(Math.abs(z - rz), 13, 24);
    const westSlope = THREE.MathUtils.smoothstep(x, 1380, 1415);
    const eastSlope = 1 - THREE.MathUtils.smoothstep(x, 1458, 1484);
    const nsSlope =
      THREE.MathUtils.smoothstep(z, -142, -112) *
      (1 - THREE.MathUtils.smoothstep(z, 54, 82));
    const envelope = riverClear * westSlope * eastSlope * nsSlope;
    if (envelope > 0.001) {
      const peakA = Math.exp(-((x - 1435) ** 2 / 780 + (z + 82) ** 2 / 720)) * 28.5;
      const peakB = Math.exp(-((x - 1442) ** 2 / 740 + (z - 28) ** 2 / 680)) * 25.0;
      const ridge = 10.5 + Math.sin(x * 0.065) * 2.2 + Math.cos(z * 0.07) * 2.0;
      h = Math.max(h, envelope * (ridge + peakA + peakB));
    }
  }

  return h;
}

export function isOnGrandEastRoad(x: number, z: number): boolean {
  if (x < 782 || x > 1470) return false;

  // Bridge arrival East-West trunk (z = 0, x in [782..1138])
  if (Math.abs(z) < 7.4 && x >= 782 && x <= 1138) return true;

  // Civic & Ring North-South boulevard (x = 975, z in [-285..285])
  if (Math.abs(x - EAST_RING_CENTER_X) < 7.2 && Math.abs(z) <= 285) return true;

  // Concentric Circular Ring Boulevards inside East Ring City
  const ringR = Math.hypot(x - EAST_RING_CENTER_X, z - EAST_RING_CENTER_Z);
  if (Math.abs(ringR - EAST_RING_OUTER_R) < 7.5) return true;
  if (Math.abs(ringR - EAST_RING_INNER_R) < 6.8) return true;

  // Airport access boulevard (z = -148, x in [975..1285])
  if (Math.abs(z + 148) < 6.6 && x >= 975 && x <= 1285) return true;

  // Chinatown Lantern Promenade (z = 228, x in [802..1115])
  if (Math.abs(z - 228) < 6.8 && x >= 802 && x <= 1115) return true;

  // Isometric City Riverfront Parkway (x = 1235, z in [-148..88])
  if (Math.abs(x - 1235) < 6.5 && z >= -148 && z <= 88) return true;

  // Castle Gatehouse approach roads (West gate z = 188, x in [1115..1160] & North gate x = 1285, z in [60..95])
  if (Math.abs(z - 188) < 6.2 && x >= 1110 && x <= 1160) return true;
  if (Math.abs(x - 1285) < 6.2 && z >= 60 && z <= 95) return true;

  return false;
}

function addPart(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  opts?: { rotX?: number; rotY?: number; rotZ?: number; castShadow?: boolean },
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  if (opts?.rotX) m.rotation.x = opts.rotX;
  if (opts?.rotY) m.rotation.y = opts.rotY;
  if (opts?.rotZ) m.rotation.z = opts.rotZ;
  m.castShadow = opts?.castShadow ?? false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export interface GrandEastCityResult {
  malls: MallNavData[];
  parkBenches: Array<{ x: number; z: number; yaw: number }>;
  intersections: Array<{ x: number; z: number; offsetSec: number }>;
  signalVisuals: SignalVisualGroup[];
  roadRectLoops: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; clockwise: boolean }>;
  roadCircleLoops: Array<{ cx: number; cz: number; radius: number; clockwise: boolean }>;
  castleFootGuards: Array<{ x: number; z: number; patrolX: number; patrolZ: number }>;
  castleHorseGuards: Array<{ waypoints: Array<{ x: number; z: number }>; horseColor: number }>;
  castleInteriorSpots: Array<{ x: number; z: number; yaw: number }>;
  eastCitizenSpots: Array<{ x: number; z: number; role: 'chinatown' | 'airport' | 'ring_park' | 'castle_villager' }>;
  touristSpots: Array<{ x: number; z: number; lookAtX: number; lookAtZ: number }>;
  gardenSpots: Array<{ x: number; z: number }>;
  drumPlacements: Array<[number, number]>;
}

export function buildGrandEastCity(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  groundHeightAt: (x: number, z: number, currentY?: number) => number,
  opts: {
    placeIntersectionSignals: (ix: number, iz: number, offsetSec: number) => SignalVisualGroup;
    buildMall?: (cfg: {
      id: string;
      name: string;
      cx: number;
      cz: number;
      facadeHex: number;
      trimHex: number;
      floor1Hex: number;
      floor2Hex: number;
      floor3Hex: number;
      accentHex: string;
    }) => MallNavData;
    buildPark?: (cx: number, cz: number) => { benches: Array<{ x: number; z: number; yaw: number }> };
    sharedPropMats?: CompiledPropMats;
  },
): GrandEastCityResult {
  const group = new THREE.Group();
  ctx.arenaGroup.add(group);
  ctx.lodDetailGroups.push({
    group,
    x: 1120,
    y: 16,
    z: 0,
    radius: 440,
    maxDist: 560,
    tier: 'district',
  });
  const propMats = opts.sharedPropMats ?? createPropPbrMaterials(false);
  if (!opts.sharedPropMats) ctx.materials.push(...propMats.all);
  const pb = new PropMeshAssembler();

  // Shared non-box geometries & distinctive East City PBR materials (always disposed properly)
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  const coneGeo = new THREE.ConeGeometry(1, 1, 14);
  const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
  const torusGeo = new THREE.TorusGeometry(1, 0.08, 8, 28);
  ctx.geometries.push(cylGeo, coneGeo, sphereGeo, torusGeo);

  const makeMat = (color: number, roughness = 0.6, metalness = 0.12, extra?: Partial<THREE.MeshStandardMaterialParameters>) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    ctx.materials.push(m);
    return m;
  };

  const pureWhiteMat = makeMat(0xe2e7ee, 0.54, 0.06);
  const stoneWarmMat = makeMat(0xe7d6b9, 0.78, 0.06);
  const castleStoneMat = makeMat(0xd6cfc2, 0.82, 0.05);
  const castleDarkStoneMat = makeMat(0x526071, 0.86, 0.08);
  const azureRoofMat = makeMat(0x2563eb, 0.42, 0.22);
  const libertyPatinaMat = makeMat(0x2dd4bf, 0.48, 0.18);
  const eiffelIronMat = makeMat(0x785947, 0.56, 0.58);
  const vermilionMat = makeMat(0xdc2626, 0.46, 0.14);
  const jadeRoofMat = makeMat(0x0d9488, 0.34, 0.28);
  const coralFacadeMat = makeMat(0xea580c, 0.56, 0.12);
  const sapphireFacadeMat = makeMat(0x0284c7, 0.48, 0.24);
  const emeraldFacadeMat = makeMat(0x059669, 0.52, 0.18);
  const plumFacadeMat = makeMat(0x7c3aed, 0.5, 0.2);
  const terracottaFacadeMat = makeMat(0xc2410c, 0.62, 0.1);
  const royalVelvetMat = makeMat(0x991b1b, 0.74, 0.08);
  const frescoMat = makeMat(0xfef3c7, 0.68, 0.08, { emissive: 0x78350f, emissiveIntensity: 0.18 });
  const lanternGlowMat = new THREE.MeshBasicMaterial({ color: 0xff5a36 });
  const chandelierGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe484 });
  const goldTrimMat = makeMat(0xf59e0b, 0.28, 0.68);
  const glassBlueMat = makeMat(0x38bdf8, 0.14, 0.25, { transparent: true, opacity: 0.76 });
  const asphaltNewMat = makeMat(0x1f2937, 0.9, 0.05);
  const waterChannelMat = makeMat(0x0284c7, 0.14, 0.36, { transparent: true, opacity: 0.82 });
  const woodTimberMat = makeMat(0x7c4a24, 0.82, 0.04);
  ctx.materials.push(lanternGlowMat, chandelierGlowMat);

  // Register decorative glowing lanterns to twinkle at night cleanly via engine lamp cycle
  ctx.streetLampMats.push(lanternGlowMat);

  // ---------------------------------------------------------------------------
  // 1. ROAD NETWORK, RAISED ASPHALT STRIPS, CIRCULAR BOULEVARDS & INTERSECTIONS
  // ---------------------------------------------------------------------------
  const addEastRoadStrip = (cx: number, cz: number, sx: number, sz: number, ySurface: number) => {
    addPart(group, pal.boxGeo, pal.slateAsphalt, cx, ySurface - 0.08, cz, sx, 0.16, sz);
    if (sx >= sz) {
      addPart(group, pal.boxGeo, pal.concreteDeck, cx, ySurface - 0.075, cz - sz * 0.5 - 0.35, sx, 0.15, 0.7);
      addPart(group, pal.boxGeo, pal.concreteDeck, cx, ySurface - 0.075, cz + sz * 0.5 + 0.35, sx, 0.15, 0.7);
    } else {
      addPart(group, pal.boxGeo, pal.concreteDeck, cx - sx * 0.5 - 0.35, ySurface - 0.075, cz, 0.7, 0.15, sz);
      addPart(group, pal.boxGeo, pal.concreteDeck, cx + sx * 0.5 + 0.35, ySurface - 0.075, cz, 0.7, 0.15, sz);
    }
  };
  addEastRoadStrip(960, 0, 356, 14.4, 0.078); // Bridge arrival trunk
  addEastRoadStrip(EAST_RING_CENTER_X, 0, 14.2, 570, 0.094); // Civic N-S boulevard
  addEastRoadStrip(1130, -148, 310, 13.2, 0.078); // Airport boulevard
  addEastRoadStrip(958.5, 228, 313, 13.4, 0.084); // Chinatown lantern promenade
  addEastRoadStrip(1235, -30, 13.0, 236, 0.092); // Riverfront parkway
  addEastRoadStrip(1135, 188, 50, 12.2, 0.086); // Castle West gate approach
  addEastRoadStrip(1285, 77.5, 12.2, 35, 0.090); // Castle North gate approach

  // Prominent East City Digital Screen: DEVELOPED BY AFTAB BALOCH DADU
  const eastCreatorMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'DEVELOPED BY AFTAB BALOCH DADU',
    subtitle: 'APEX GRAND EAST CITY · AIRPORT & ROYAL PLAZA',
    accentHex: '#f59e0b',
    lockTitle: true,
    intervalSec: 0.9,
  }).material;
  addPart(group, pal.boxGeo, pal.charcoalSteel, 996, 4.4, -126, 0.55, 8.8, 0.55);
  addPart(group, pal.boxGeo, pal.charcoalSteel, 1008, 4.4, -126, 0.55, 8.8, 0.55);
  addPart(group, pal.boxGeo, pal.charcoalSteel, 1002, 8.4, -126, 13.8, 5.2, 0.45);
  addPart(group, pal.boxGeo, eastCreatorMat, 1002, 8.4, -125.7, 13.0, 4.5, 0.14);
  addPart(group, pal.boxGeo, eastCreatorMat, 1002, 8.4, -126.3, 13.0, 4.5, 0.14, { rotY: Math.PI });
  addCollider(ctx.colliders, 996, 0, -126, 0.8, 8.8, 0.8);
  addCollider(ctx.colliders, 1008, 0, -126, 0.8, 8.8, 0.8);

  const markings: Parameters<typeof addRoadMarkingsBatch>[1] = [
    { kind: 'dash_line', x1: 794, z1: 0, x2: 1135, z2: 0, color: 0xfacc15 },
    { kind: 'dash_line', x1: EAST_RING_CENTER_X, z1: -275, x2: EAST_RING_CENTER_X, z2: 275, color: 0xfacc15 },
    { kind: 'dash_line', x1: 975, z1: -148, x2: 1280, z2: -148, color: 0xfacc15 },
    { kind: 'dash_line', x1: 812, z1: 228, x2: 1108, z2: 228, color: 0xfacc15 },
    { kind: 'dash_line', x1: 1235, z1: -142, x2: 1235, z2: 85, color: 0xfacc15 },
  ];

  // Crisp textured asphalt rings + yellow lane markings for both concentric circular roads!
  const ringAsphaltMat = makeMat(0x28313e, 0.88, 0.06, {
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const drawCircleRoadRing = (cx: number, cz: number, rad: number, halfW: number) => {
    const ringGeo = new THREE.RingGeometry(rad - halfW, rad + halfW, 72);
    ringGeo.rotateX(-Math.PI * 0.5);
    ctx.geometries.push(ringGeo);
    const ringMesh = new THREE.Mesh(ringGeo, ringAsphaltMat);
    ringMesh.position.set(cx, 0.056, cz);
    ringMesh.receiveShadow = true;
    group.add(ringMesh);

    const dashGeo = new THREE.RingGeometry(rad - 0.22, rad + 0.22, 64);
    dashGeo.rotateX(-Math.PI * 0.5);
    ctx.geometries.push(dashGeo);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    ctx.materials.push(dashMat);
    const dashMesh = new THREE.Mesh(dashGeo, dashMat);
    dashMesh.position.set(cx, 0.066, cz);
    group.add(dashMesh);
  };
  drawCircleRoadRing(EAST_RING_CENTER_X, EAST_RING_CENTER_Z, EAST_RING_OUTER_R, 7.2);
  drawCircleRoadRing(EAST_RING_CENTER_X, EAST_RING_CENTER_Z, EAST_RING_INNER_R, 6.4);

  // Intersections & signals (at outer ring cardinals & airport junction)
  const intersections = [
    { x: 975, z: -148, offsetSec: 1 },
    { x: 975, z: 148, offsetSec: 6 },
    { x: 1123, z: 0, offsetSec: 3 },
  ];
  const signalVisuals: SignalVisualGroup[] = intersections.map((inter) =>
    opts.placeIntersectionSignals(inter.x, inter.z, inter.offsetSec),
  );
  intersections.forEach((ix) => {
    markings.push(
      { kind: 'crosswalk', x: ix.x, z: ix.z + 9.2, rotY: 0 },
      { kind: 'crosswalk', x: ix.x, z: ix.z - 9.2, rotY: 0 },
      { kind: 'crosswalk', x: ix.x + 9.2, z: ix.z, rotY: Math.PI * 0.5 },
      { kind: 'crosswalk', x: ix.x - 9.2, z: ix.z, rotY: Math.PI * 0.5 },
    );
  });
  addRoadMarkingsBatch(group, markings, groundHeightAt, ctx.geometries, ctx.materials);

  // ---------------------------------------------------------------------------
  // 2. OCEAN CHANNEL SHIPS & BOATS (Cruise Liner, Container Ship, Motor Yachts & Sailboats)
  // ---------------------------------------------------------------------------
  const animatedShips: Array<{
    mesh: THREE.Group;
    laneX: number;
    zMin: number;
    zMax: number;
    speed: number;
    phase: number;
    waterY: number;
    circleRadius?: number;
  }> = [];

  // A) Grand White & Navy Cruise Liner patrolling North Bay Channel (x = 640, z in [-260..-42])
  const makeBoatHullShape = (len: number, beam: number) => {
    const s = new THREE.Shape();
    const hl = len * 0.5;
    const hb = beam * 0.5;
    s.moveTo(-hb * 0.85, -hl);
    s.lineTo(hb * 0.85, -hl);
    s.lineTo(hb, hl * 0.45);
    s.lineTo(0, hl);
    s.lineTo(-hb, hl * 0.45);
    s.closePath();
    return s;
  };

  const buildCruiseLiner = () => {
    const sg = new THREE.Group();
    const sPb = new PropMeshAssembler();
    sPb.addExtrude(makeBoatHullShape(42, 10.5), 2.8, 0.14, 0, 0.8, 0, 0x0f172a, 'glossy', -Math.PI * 0.5);
    sPb.addExtrude(makeBoatHullShape(36, 9.8), 1.8, 0.1, 0, 2.8, -1.0, 0xf8fafc, 'glossy', -Math.PI * 0.5);
    sPb.addExtrude(makeBoatHullShape(28, 8.8), 1.8, 0.1, 0, 4.5, -2.0, 0xf8fafc, 'solid', -Math.PI * 0.5);
    sPb.addBox(0, 5.4, 8.0, 8.6, 1.5, 5.4, 0x38bdf8, 'glass'); // Bridge deck
    sPb.addBox(0, 6.2, -5.0, 6.2, 1.1, 16.0, 0x0ea5e9, 'glass'); // Pool/lido deck
    sPb.addCylinder(1.2, 1.5, 3.0, 12, 0, 7.6, -9.0, 0xdc2626, 'solid'); // Streamlined funnel
    [-3.2, 3.2].forEach((lx) => {
      for (let z = -14; z <= 10; z += 4) {
        sPb.addBox(lx * 1.55, 3.0, z, 0.2, 0.65, 2.2, 0xfef08a, 'emissive');
      }
    });
    const compiled = sPb.compile(propMats, { castShadow: false, receiveShadow: true });
    sg.add(compiled.group);
    ctx.geometries.push(...compiled.geometries);
    ctx.materials.push(...compiled.materials);
    return sg;
  };
  const cruiseLiner = buildCruiseLiner();
  group.add(cruiseLiner);
  animatedShips.push({ mesh: cruiseLiner, laneX: 635, zMin: -255, zMax: -42, speed: 6.2, phase: 0, waterY: -0.45 });

  // B) Cargo Container Vessel patrolling South Bay Channel (x = 695, z in [42..255])
  const buildCargoShip = () => {
    const cg = new THREE.Group();
    const cPb = new PropMeshAssembler();
    cPb.addExtrude(makeBoatHullShape(34, 9.2), 2.4, 0.12, 0, 0.7, 0, 0x991b1b, 'solid', -Math.PI * 0.5);
    cPb.addExtrude(makeBoatHullShape(35, 9.6), 0.9, 0.1, 0, 2.2, 0, 0x1e293b, 'solid', -Math.PI * 0.5);
    cPb.addBox(0, 4.6, -12.5, 7.4, 4.2, 6.2, 0xf8fafc, 'solid');
    cPb.addBox(0, 5.6, -9.3, 6.6, 1.0, 0.3, 0x38bdf8, 'glass');
    const cCols = [0x0284c7, 0xf97316, 0x16a34a, 0xeab308, 0xdc2626];
    for (let zi = -4; zi <= 10; zi += 4.5) {
      for (let xi = -2.2; xi <= 2.2; xi += 2.2) {
        cPb.addBox(xi, 3.6, zi, 1.9, 1.8, 4.0, cCols[Math.abs(Math.round(zi + xi)) % cCols.length]);
        cPb.addBox(xi, 5.4, zi, 1.9, 1.8, 4.0, cCols[Math.abs(Math.round(zi * 2 + xi)) % cCols.length]);
      }
    }
    const compiled = cPb.compile(propMats, { castShadow: false, receiveShadow: true });
    cg.add(compiled.group);
    ctx.geometries.push(...compiled.geometries);
    ctx.materials.push(...compiled.materials);
    return cg;
  };
  const cargoShip = buildCargoShip();
  group.add(cargoShip);
  animatedShips.push({ mesh: cargoShip, laneX: 695, zMin: 42, zMax: 255, speed: 5.0, phase: 2.2, waterY: -0.45 });

  // C) Low-clearance Speedboats & Yachts that glide right UNDERNEATH the Red Bridge spans (at x=628 & x=696)!
  const boatConfigs = [
    { laneX: 628, color: 0xf8fafc, accent: 0x0284c7, speed: 9.2, phase: 0.4, hasSail: false },
    { laneX: 696, color: 0xfef3c7, accent: 0xef4444, speed: 8.4, phase: 3.1, hasSail: false },
    { laneX: 632, color: 0xf8fafc, accent: 0xf59e0b, speed: 5.5, phase: 1.5, hasSail: true },
    { laneX: 702, color: 0xe0f2fe, accent: 0x10b981, speed: 6.0, phase: 4.5, hasSail: true },
  ];
  boatConfigs.forEach((bc) => {
    const bg = new THREE.Group();
    const bPb = new PropMeshAssembler();
    bPb.addExtrude(makeBoatHullShape(9.6, 3.2), 0.95, 0.08, 0, 0.35, 0, bc.color, 'glossy', -Math.PI * 0.5);
    bPb.addBox(0, 0.95, -0.8, 2.2, 0.75, 4.0, 0xf8fafc, 'solid');
    bPb.addBox(0, 1.15, 1.1, 2.1, 0.62, 1.4, 0x38bdf8, 'glass');
    bPb.addBox(0, 0.65, 0, 3.1, 0.2, 8.6, bc.accent, 'glossy');
    if (bc.hasSail) {
      bPb.addCylinder(0.08, 0.1, 4.6, 8, 0, 3.3, 0.4, 0x94a3b8, 'glossy');
      const sail = new THREE.Shape();
      sail.moveTo(0, 0);
      sail.lineTo(2.4, 0);
      sail.lineTo(0, 3.8);
      sail.closePath();
      bPb.addExtrude(sail, 0.08, 0, 0, 1.7, 0.3, 0xf8fafc, 'solid', 0, Math.PI * 0.5, 0);
    }
    const compiled = bPb.compile(propMats, { castShadow: false, receiveShadow: false });
    bg.add(compiled.group);
    ctx.geometries.push(...compiled.geometries);
    ctx.materials.push(...compiled.materials);
    group.add(bg);
    animatedShips.push({
      mesh: bg,
      laneX: bc.laneX,
      zMin: -245,
      zMax: 245,
      speed: bc.speed,
      phase: bc.phase,
      waterY: -0.45,
    });
  });

  // ---------------------------------------------------------------------------
  // 3. SIMPLE CITY PACK CIVIC LANDMARKS + STATUE OF LIBERTY ISLAND (Ref 6)
  // ---------------------------------------------------------------------------
  // A) Statue of Liberty on Channel Island (742, -155)
  {
    const lx = 742;
    const lz = -155;
    const lg = new THREE.Group();
    lg.position.set(lx, 0.75, lz);
    // Star-fort stone base + stepped pedestal
    addPart(lg, cylGeo, castleDarkStoneMat, 0, 1.2, 0, 7.6, 2.4, 7.6);
    addPart(lg, pal.boxGeo, stoneWarmMat, 0, 4.4, 0, 6.2, 4.4, 6.2);
    addPart(lg, pal.boxGeo, stoneWarmMat, 0, 7.6, 0, 4.6, 2.2, 4.6);
    // Liberty copper-patina draped figure, raised torch arm, tablet & 7-ray crown
    addPart(lg, coneGeo, libertyPatinaMat, 0, 13.4, 0, 2.4, 9.6, 2.2);
    addPart(lg, sphereGeo, libertyPatinaMat, 0, 18.6, 0, 1.05, 1.2, 1.05);
    addPart(lg, cylGeo, libertyPatinaMat, 1.5, 20.6, 0.3, 0.32, 4.8, 0.32, { rotZ: -0.24 });
    addPart(lg, sphereGeo, lanternGlowMat, 2.05, 23.2, 0.3, 0.55, 0.85, 0.55); // Torch flame
    addPart(lg, pal.boxGeo, libertyPatinaMat, -1.25, 16.0, 0.65, 0.55, 1.7, 1.2, { rotZ: 0.2 }); // Tablet
    for (let r = -3; r <= 3; r++) {
      addPart(lg, coneGeo, libertyPatinaMat, r * 0.24, 19.8, 0.35, 0.08, 0.9, 0.08, { rotZ: -r * 0.22 });
    }
    group.add(lg);
    addCollider(ctx.colliders, lx, 0, lz, 8.2, 12.0, 8.2, 0, 'concrete');
  }

  // B) US Capitol Domed Building (x = 834, z = -96) — Warm Sandstone + Teal Copper Dome
  {
    const cx = 834;
    const cz = -96;
    const cg = new THREE.Group();
    cg.position.set(cx, 0, cz);
    addPart(cg, pal.boxGeo, stoneWarmMat, 0, 3.6, 0, 32, 7.2, 15, { castShadow: !ctx.isSoftwareGl });
    addPart(cg, pal.boxGeo, terracottaFacadeMat, 0, 7.35, 0, 32.5, 0.5, 15.5);
    addPart(cg, pal.boxGeo, goldTrimMat, 0, 4.0, 8.4, 10, 8.0, 2.5);
    for (let colX = -3.8; colX <= 3.8; colX += 1.9) {
      addPart(cg, cylGeo, stoneWarmMat, colX, 3.8, 9.7, 0.4, 6.8, 0.4);
    }
    addPart(cg, cylGeo, stoneWarmMat, 0, 10.6, 0, 5.6, 6.8, 5.6);
    addPart(cg, sphereGeo, jadeRoofMat, 0, 14.0, 0, 5.3, 5.0, 5.3);
    addPart(cg, cylGeo, goldTrimMat, 0, 19.6, 0, 0.7, 2.6, 0.7);
    group.add(cg);
    addCollider(ctx.colliders, cx, 0, cz, 32.5, 10, 17, 0, 'concrete');
  }

  // C) White House Executive Colonnade (x = 834, z = -44) — Sandstone & Azure Accent Trim
  {
    const wx = 834;
    const wz = -44;
    const wg = new THREE.Group();
    wg.position.set(wx, 0, wz);
    addPart(wg, pal.boxGeo, stoneWarmMat, 0, 4.2, 0, 26, 8.4, 13, { castShadow: !ctx.isSoftwareGl });
    addPart(wg, cylGeo, coralFacadeMat, 0, 4.2, 7.0, 4.8, 8.0, 4.8);
    addPart(wg, pal.boxGeo, azureRoofMat, 0, 8.6, 0, 26.8, 0.7, 13.6);
    for (let c = -3; c <= 3; c++) {
      addPart(wg, cylGeo, goldTrimMat, c * 1.4, 4.2, -7.2, 0.36, 7.8, 0.36);
    }
    group.add(wg);
    addCollider(ctx.colliders, wx, 0, wz, 26.5, 9, 15, 0, 'concrete');
  }

  // D) Space Needle Observation Tower (x = 816, z = 48) — Coral-Orange & Titanium Cyan
  {
    const sx = 816;
    const sz = 48;
    const sg = new THREE.Group();
    sg.position.set(sx, 0, sz);
    for (let leg = 0; leg < 3; leg++) {
      const ang = (leg / 3) * Math.PI * 2;
      addPart(sg, cylGeo, coralFacadeMat, Math.cos(ang) * 2.2, 16, Math.sin(ang) * 2.2, 0.62, 32, 0.62, {
        rotX: Math.sin(ang) * 0.08,
        rotZ: -Math.cos(ang) * 0.08,
      });
    }
    addPart(sg, cylGeo, sapphireFacadeMat, 0, 16, 0, 1.1, 32, 1.1);
    registerBreakableGlass(ctx, addPart(sg, cylGeo, glassBlueMat, 0, 32.5, 0, 7.2, 2.2, 7.2));
    addPart(sg, cylGeo, goldTrimMat, 0, 34.0, 0, 8.6, 0.9, 8.6);
    addPart(sg, coneGeo, lanternGlowMat, 0, 40.5, 0, 0.45, 11.5, 0.45);
    group.add(sg);
    addCollider(ctx.colliders, sx, 0, sz, 6.2, 32, 6.2, 0, 'metal');
  }

  // E) Eiffel Iron Lattice Tower (x = 824, z = 104)
  {
    const ex = 824;
    const ez = 104;
    const eg = new THREE.Group();
    eg.position.set(ex, 0, ez);
    [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]].forEach(([lx, lz]) => {
      addPart(eg, pal.boxGeo, eiffelIronMat, lx * 0.65, 8.5, lz * 0.65, 1.35, 18.0, 1.35, {
        rotZ: lx > 0 ? 0.16 : -0.16,
        rotX: lz > 0 ? -0.16 : 0.16,
      });
    });
    addPart(eg, pal.boxGeo, eiffelIronMat, 0, 15.5, 0, 6.8, 1.2, 6.8);
    addPart(eg, pal.boxGeo, eiffelIronMat, 0, 26.5, 0, 3.8, 1.0, 3.8);
    addPart(eg, coneGeo, eiffelIronMat, 0, 30.0, 0, 2.5, 36.0, 2.5);
    addPart(eg, sphereGeo, lanternGlowMat, 0, 48.2, 0, 0.45, 0.7, 0.45);
    group.add(eg);
    addCollider(ctx.colliders, ex, 0, ez, 9.2, 16, 9.2, 0, 'metal');
  }

  // F) Columned Classic Museum (812, -150) & Empire Art Deco Tower (848, -148)
  {
    addPart(group, pal.boxGeo, terracottaFacadeMat, 812, 4.0, -150, 18, 8.0, 14, { castShadow: !ctx.isSoftwareGl });
    for (let cx = -6.5; cx <= 6.5; cx += 2.6) {
      addPart(group, cylGeo, stoneWarmMat, 812 + cx, 4.0, -142.3, 0.45, 7.6, 0.45);
    }
    addPart(group, pal.boxGeo, azureRoofMat, 812, 8.4, -150, 19.2, 0.9, 15.6);
    addCollider(ctx.colliders, 812, 0, -150, 18.5, 9, 15.5, 0, 'concrete');

    // Empire Art Deco Setback Skyscraper (Sapphire & Gold Art Deco)
    addPart(group, pal.boxGeo, sapphireFacadeMat, 848, 10, -148, 13, 20, 13, { castShadow: !ctx.isSoftwareGl });
    addPart(group, pal.boxGeo, coralFacadeMat, 848, 25, -148, 9.2, 12, 9.2);
    registerBreakableGlass(ctx, addPart(group, pal.boxGeo, glassBlueMat, 848, 34, -148, 5.4, 7, 5.4));
    addPart(group, cylGeo, goldTrimMat, 848, 41.5, -148, 0.42, 9, 0.42);
    addCollider(ctx.colliders, 848, 0, -148, 13.5, 38, 13.5, 0, 'concrete');
  }

  // G) Animated Civic Ferris Wheel (x = 858, z = 44) & Rotating Yellow Tower Crane (x = 858, z = -72)
  const civicWheelRotor = new THREE.Group();
  {
    const fx = 858;
    const fz = 44;
    addPart(group, pal.boxGeo, castleDarkStoneMat, fx - 1.8, 7.5, fz, 0.7, 15.2, 0.9, { rotZ: -0.18 });
    addPart(group, pal.boxGeo, castleDarkStoneMat, fx + 1.8, 7.5, fz, 0.7, 15.2, 0.9, { rotZ: 0.18 });
    civicWheelRotor.position.set(fx, 14.5, fz);
    addPart(civicWheelRotor, torusGeo, vermilionMat, 0, 0, 0, 10.5, 10.5, 1.0);
    const cabinCols = [vermilionMat, jadeRoofMat, goldTrimMat, azureRoofMat];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = addPart(civicWheelRotor, pal.boxGeo, goldTrimMat, Math.cos(a) * 5.2, Math.sin(a) * 5.2, 0, 10.4, 0.22, 0.22);
      spoke.rotation.z = a;
      const cab = addPart(civicWheelRotor, pal.boxGeo, cabinCols[i % 4], Math.cos(a) * 10.5, Math.sin(a) * 10.5, 0, 1.6, 1.8, 1.6);
      cab.userData.keepUpright = true;
    }
    group.add(civicWheelRotor);
    addCollider(ctx.colliders, fx, 0, fz, 5.5, 10, 3.0, 0, 'metal');
  }

  const eastCraneJib = new THREE.Group();
  {
    const cx = 858;
    const cz = -72;
    addPart(group, pal.boxGeo, goldTrimMat, cx, 13, cz, 1.7, 26, 1.7);
    eastCraneJib.position.set(cx, 26.2, cz);
    addPart(eastCraneJib, pal.boxGeo, goldTrimMat, 5.5, 0, 0, 20, 1.2, 1.2);
    addPart(eastCraneJib, pal.boxGeo, castleDarkStoneMat, -4.5, 0.4, 0, 4.5, 1.8, 1.8);
    addPart(eastCraneJib, cylGeo, castleDarkStoneMat, 12.5, -5.0, 0, 0.08, 10, 0.08);
    addPart(eastCraneJib, pal.boxGeo, vermilionMat, 12.5, -10.2, 0, 1.6, 1.0, 1.6);
    group.add(eastCraneJib);
    addCollider(ctx.colliders, cx, 0, cz, 2.2, 26, 2.2, 0, 'metal');
  }

  // ---------------------------------------------------------------------------
  // 4. CONCENTRIC CIRCULAR RING METROPOLIS (Vibrant Colorful Skyline Towers!)
  // ---------------------------------------------------------------------------
  const innerLawnGeo = new THREE.CircleGeometry(66.5, 48);
  innerLawnGeo.rotateX(-Math.PI * 0.5);
  ctx.geometries.push(innerLawnGeo);
  const innerLawnMat = makeMat(0x65a30d, 0.85, 0.02);
  const innerLawn = new THREE.Mesh(innerLawnGeo, innerLawnMat);
  innerLawn.position.set(EAST_RING_CENTER_X, 0.04, EAST_RING_CENTER_Z);
  innerLawn.receiveShadow = true;
  group.add(innerLawn);

  // Vibrant Multi-Color Skyline Towers inside Inner Ring (instead of monochrome white!)
  const whiteTowers: Array<[number, number, number, number, number]> = [
    [-16, -24, 9.5, 36, 9.5],
    [-4, -18, 8.5, 26, 8.5],
    [12, -26, 9.0, 31, 9.0],
    [-26, 12, 8.0, 20, 8.0],
    [-12, 24, 10.0, 24, 9.0],
    [18, 18, 9.5, 29, 9.5],
    [28, -8, 8.5, 19, 8.5],
    [-30, -14, 7.8, 16, 7.8],
    [8, 30, 8.0, 15, 8.0],
  ];
  const innerTowerMats = [sapphireFacadeMat, coralFacadeMat, emeraldFacadeMat, plumFacadeMat, stoneWarmMat, goldTrimMat, vermilionMat, jadeRoofMat, terracottaFacadeMat];
  whiteTowers.forEach(([ox, oz, w, h, d], idx) => {
    const px = EAST_RING_CENTER_X + ox;
    const pz = EAST_RING_CENTER_Z + oz;
    const bMat = innerTowerMats[idx % innerTowerMats.length];
    addPart(group, pal.boxGeo, bMat, px, h * 0.5, pz, w, h, d, { castShadow: !ctx.isSoftwareGl });
    registerBreakableGlass(ctx, addPart(group, pal.boxGeo, glassBlueMat, px, h * 0.55, pz, w + 0.14, h * 0.45, d * 0.72));
    registerBreakableGlass(ctx, addPart(group, pal.boxGeo, glassBlueMat, px, h - 1.2, pz, w * 0.86, 1.4, d * 0.86));
    addCollider(ctx.colliders, px, 0, pz, w, h, d, 0, 'concrete');
  });

  // Grand Ring Center Plaza Marble Fountain at (975, 0) (cross-road safe: placed offset in inner park quadrants)
  const addPlazaFountain = (fx: number, fz: number) => {
    addPart(group, cylGeo, pureWhiteMat, fx, 0.25, fz, 5.4, 0.5, 5.4);
    addPart(group, cylGeo, waterChannelMat, fx, 0.52, fz, 4.4, 0.2, 4.4);
    addPart(group, cylGeo, pureWhiteMat, fx, 1.4, fz, 0.9, 2.2, 0.9);
    addPart(group, cylGeo, pureWhiteMat, fx, 2.5, fz, 2.2, 0.25, 2.2);
    addPart(group, coneGeo, glassBlueMat, fx, 3.2, fz, 0.55, 1.2, 0.55);
    addCollider(ctx.colliders, fx, 0, fz, 5.4, 1.6, 5.4, 0, 'concrete');
  };
  addPlazaFountain(EAST_RING_CENTER_X + 36, -34);

  // Outer-to-Inner Ring Urban District (R = 90..130, 8 sectors skipping cardinal avenues):
  // Colorful brick/mustard/teal/terracotta modern towers (Refs 1, 3, 5!) + Neoclassical Hall + Rising Smoke Factory!
  const ringSectorColors = [0xd97706, 0x0284c7, 0xb45309, 0x10b981, 0xe11d48, 0xeab308, 0x6366f1, 0xec4899];
  const ringTowerAngles = [0.42, 0.98, 2.02, 2.58, 3.56, 4.18, 5.18, 5.78];
  const smokePuffsEast: Array<{ mesh: THREE.Mesh; x: number; y: number; z: number; phase: number }> = [];

  ringTowerAngles.forEach((ang, idx) => {
    const rDist = 112;
    const tx = EAST_RING_CENTER_X + Math.cos(ang) * rDist;
    const tz = EAST_RING_CENTER_Z + Math.sin(ang) * rDist;
    const w = 15 + (idx % 3) * 3;
    const d = 14 + ((idx + 1) % 2) * 4;
    const h = 16 + (idx % 4) * 6;
    const colHex = ringSectorColors[idx % ringSectorColors.length];

    // Clean architectural tower with glazed curtain bands & rooftop HVAC penthouse
    pb.addBox(tx, h * 0.5, tz, w, h, d, colHex, 'solid');
    pb.addBox(tx, h * 0.5 + 0.6, tz, w + 0.14, h * 0.72, d - 2.2, 0x38bdf8, 'glass');
    pb.addBox(tx, h * 0.5 + 0.6, tz, w - 2.2, h * 0.72, d + 0.14, 0x38bdf8, 'glass');
    pb.addBox(tx, h + 1.1, tz, w * 0.55, 2.2, d * 0.55, 0xcbd5e1, 'solid');
    addCollider(ctx.colliders, tx, 0, tz, w, h, d, 0, 'concrete');

    // Special Ref 3 Industrial Smokestack on sector idx === 2 (NW Ring)
    if (idx === 2) {
      pb.addCylinder(0.9, 1.35, 19, 14, tx + 9, 9.5, tz + 7, 0xe2e8f0, 'solid');
      pb.addCylinder(1.02, 1.08, 1.5, 14, tx + 9, 17.5, tz + 7, 0xdc2626, 'solid');
      for (let p = 0; p < 4; p++) {
        const sm = addPart(group, sphereGeo, pureWhiteMat, tx + 9, 20 + p * 2.1, tz + 7, 1.2 + p * 0.35, 1.0 + p * 0.3, 1.2 + p * 0.35);
        smokePuffsEast.push({ mesh: sm, x: tx + 9, y: 19.6, z: tz + 7, phase: p * 0.25 });
      }
    }

    // Special Ref 3 Neoclassical Town Hall & Courtyard Plaza on sector idx === 5 (SE Ring)
    if (idx === 5) {
      addPart(group, pal.boxGeo, stoneWarmMat, tx - 14, 3.2, tz + 2, 11, 6.4, 10);
      addPart(group, pal.boxGeo, vermilionMat, tx - 14, 7.2, tz + 2, 11.8, 1.6, 10.8);
      addPlazaFountain(tx - 14, tz - 10);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. INTERNATIONAL AIRPORT SYSTEM (x = 1140..1455, z = -295..-120, Ref 7)
  // ---------------------------------------------------------------------------
  // Main Asphalt Runway (280m E-W) + Apron + Taxiway with polygonOffset paint markings (zero Z-fighting)
  const runwayPaintMat = makeMat(0xf8fafc, 0.42, 0.05, {
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  addPart(group, pal.boxGeo, asphaltNewMat, 1300, 0.06, -260, 280, 0.1, 22);
  addPart(group, pal.boxGeo, asphaltNewMat, 1295, 0.04, -214, 250, 0.08, 48);
  // Runway piano threshold keys & centerline dashes (GPU instanced)
  const paintDummy = new THREE.Object3D();
  const runwayTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [];
  for (let kx = -7; kx <= 7; kx += 2.2) {
    runwayTransforms.push(
      { x: 1172, y: 0.125, z: -260 + kx, sx: 7.5, sy: 0.024, sz: 0.85 },
      { x: 1428, y: 0.125, z: -260 + kx, sx: 7.5, sy: 0.024, sz: 0.85 },
    );
  }
  for (let dx = 1188; dx <= 1412; dx += 14) {
    runwayTransforms.push({ x: dx, y: 0.125, z: -260, sx: 6.8, sy: 0.024, sz: 0.5 });
  }
  const runwayPaintIm = new THREE.InstancedMesh(pal.boxGeo, runwayPaintMat, runwayTransforms.length);
  for (let i = 0; i < runwayTransforms.length; i++) {
    const t = runwayTransforms[i];
    paintDummy.position.set(t.x, t.y, t.z);
    paintDummy.rotation.set(0, 0, 0);
    paintDummy.scale.set(t.sx, t.sy, t.sz);
    paintDummy.updateMatrix();
    runwayPaintIm.setMatrixAt(i, paintDummy.matrix);
  }
  runwayPaintIm.instanceMatrix.needsUpdate = true;
  runwayPaintIm.computeBoundingSphere();
  group.add(runwayPaintIm);

  const edgeLightTransforms: Array<{ x: number; y: number; z: number }> = [];
  for (let hx = 1165; hx <= 1435; hx += 18) {
    edgeLightTransforms.push({ x: hx, y: 0.16, z: -271.2 }, { x: hx, y: 0.16, z: -248.8 });
  }
  const runwayLightsIm = new THREE.InstancedMesh(pal.boxGeo, lanternGlowMat, edgeLightTransforms.length);
  for (let i = 0; i < edgeLightTransforms.length; i++) {
    const t = edgeLightTransforms[i];
    paintDummy.position.set(t.x, t.y, t.z);
    paintDummy.rotation.set(0, 0, 0);
    paintDummy.scale.set(0.5, 0.2, 0.5);
    paintDummy.updateMatrix();
    runwayLightsIm.setMatrixAt(i, paintDummy.matrix);
  }
  runwayLightsIm.instanceMatrix.needsUpdate = true;
  runwayLightsIm.computeBoundingSphere();
  group.add(runwayLightsIm);

  // Main Curved Glass International Terminal + Breakable Glass Walls + 2 Jetbridges
  const termX = 1272;
  const termZ = -172;
  pb.addBox(termX, 4.5, termZ, 52, 9.0, 18, 0xf1f5f9, 'solid');
  pb.addBox(termX, 9.5, termZ, 56, 1.0, 22, 0x0284c7, 'glossy');
  [-17, 0, 17].forEach((gx) => {
    [-9.08, 9.08].forEach((gz) => {
      registerBreakableGlass(ctx, addPart(group, pal.boxGeo, glassBlueMat, termX + gx, 4.6, termZ + gz, 15.2, 6.0, 0.16));
    });
  });
  addCollider(ctx.colliders, termX, 0, termZ, 52, 10, 18, 0, 'concrete');

  // Terminal Signboard
  const airportSignMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: "APEX INT'L AIRPORT · DEPARTURES",
    subtitle: 'RUNWAY 09R · HELIPAD · JETBRIDGES OPEN',
    accentHex: '#38bdf8',
    intervalSec: 0.9,
  }).material;
  const airportBanner = new THREE.Mesh(pal.boxGeo, airportSignMat);
  airportBanner.position.set(termX, 7.6, termZ + 9.4);
  airportBanner.scale.set(16, 3.0, 0.22);
  group.add(airportBanner);

  // 2 Jetbridges extending North to apron gates
  [-14, 14].forEach((jx) => {
    registerBreakableGlass(ctx, addPart(group, pal.boxGeo, glassBlueMat, termX + jx, 4.2, termZ - 14.5, 2.4, 2.2, 11));
    addPart(group, cylGeo, castleDarkStoneMat, termX + jx, 2.0, termZ - 18.5, 0.35, 4.0, 0.35);
    addCollider(ctx.colliders, termX + jx, 0, termZ - 14.5, 2.6, 5.2, 11, 0, 'metal');
  });

  // Air Traffic Control (ATC) Tower + Spinning Radar Dish (1192, -176)
  const atcRadar = new THREE.Group();
  {
    const ax = 1192;
    const az = -176;
    addPart(group, cylGeo, pureWhiteMat, ax, 11.5, az, 2.4, 23, 2.4);
    registerBreakableGlass(ctx, addPart(group, cylGeo, glassBlueMat, ax, 24.5, az, 4.2, 3.2, 4.2));
    addPart(group, cylGeo, castleDarkStoneMat, ax, 26.5, az, 4.8, 0.7, 4.8);
    atcRadar.position.set(ax, 27.6, az);
    addPart(atcRadar, pal.boxGeo, pureWhiteMat, 0, 0.6, 0, 3.4, 0.75, 0.45);
    addPart(atcRadar, pal.boxGeo, vermilionMat, 0, 0.6, 0, 0.4, 1.3, 0.4);
    group.add(atcRadar);
    addCollider(ctx.colliders, ax, 0, az, 5.2, 26, 5.2, 0, 'concrete');
  }

  // 2 Aircraft Hangars (x = 1365 & 1412, z = -172) — Teal & Terracotta Stripes
  [1365, 1412].forEach((hx, idx) => {
    addPart(group, pal.boxGeo, idx === 0 ? sapphireFacadeMat : coralFacadeMat, hx, 4.2, -172, 22, 8.4, 22);
    addPart(group, cylGeo, idx === 0 ? goldTrimMat : azureRoofMat, hx, 8.4, -172, 11, 22, 11, { rotX: Math.PI * 0.5 });
    addCollider(ctx.colliders, hx, 0, -172, 22, 10, 22, 0, 'metal');
  });

  // Airport Helipad (clearly south of Airport Blvd at 1168, -124 so it never overlaps road)
  addPart(group, cylGeo, asphaltNewMat, 1168, 0.06, -124, 8.4, 0.16, 8.4);
  addPart(group, torusGeo, goldTrimMat, 1168, 0.16, -124, 6.8, 6.8, 0.4, { rotX: Math.PI * 0.5 });
  addPart(group, pal.boxGeo, goldTrimMat, 1166.5, 0.16, -124, 0.7, 0.08, 4.4);
  addPart(group, pal.boxGeo, goldTrimMat, 1169.5, 0.16, -124, 0.7, 0.08, 4.4);
  addPart(group, pal.boxGeo, goldTrimMat, 1168, 0.16, -124, 3.0, 0.08, 0.7);

  // Helper to build sleek cylindrical Passenger Airliner Mesh
  const buildAirliner = (liveryHex: number) => {
    const pg = new THREE.Group();
    const pPb = new PropMeshAssembler();
    pPb.addCylinder(1.4, 1.4, 17.5, 14, 0, 2.2, 0, 0xf8fafc, 'glossy', Math.PI * 0.5);
    pPb.addCone(1.4, 3.2, 14, 0, 2.2, 10.35, 0xf8fafc, 'glossy', Math.PI * 0.5);
    pPb.addSphere(1.0, 1.0, 0.85, 1.25, 0, 2.55, 9.2, 0x0f172a, 'glass', 1);
    pPb.addBox(0, 2.0, 1.2, 19.2, 0.3, 3.4, 0xe2e8f0, 'solid');
    pPb.addCylinder(0.55, 0.55, 2.6, 12, -4.4, 1.35, 1.8, 0x334155, 'glossy', Math.PI * 0.5);
    pPb.addCylinder(0.55, 0.55, 2.6, 12, 4.4, 1.35, 1.8, 0x334155, 'glossy', Math.PI * 0.5);
    pPb.addBox(0, 4.6, -7.2, 0.34, 4.4, 3.0, liveryHex, 'glossy', -0.22);
    pPb.addBox(0, 2.7, -7.6, 6.6, 0.22, 1.6, liveryHex, 'solid');
    pPb.addCylinder(1.43, 1.43, 15.0, 14, 0, 2.35, 0, liveryHex, 'glossy', Math.PI * 0.5);
    const compiled = pPb.compile(propMats, { castShadow: false, receiveShadow: true });
    pg.add(compiled.group);
    ctx.geometries.push(...compiled.geometries);
    ctx.materials.push(...compiled.materials);
    return pg;
  };
  // 2 Parked Airliners at Terminal Gates
  const parkedJetA = buildAirliner(0x0284c7);
  parkedJetA.position.set(1258, 0, -206);
  parkedJetA.rotation.y = Math.PI;
  const parkedJetB = buildAirliner(0xdc2626);
  parkedJetB.position.set(1286, 0, -206);
  parkedJetB.rotation.y = Math.PI;
  group.add(parkedJetA, parkedJetB);
  addCollider(ctx.colliders, 1258, 0, -206, 6, 4.5, 16, 0, 'metal');
  addCollider(ctx.colliders, 1286, 0, -206, 6, 4.5, 16, 0, 'metal');

  // 1 Animated Taking-off / Circling Sky Jet!
  const flyingAirliner = buildAirliner(0xf59e0b);
  group.add(flyingAirliner);

  // ---------------------------------------------------------------------------
  // 6. ISOMETRIC CITY CONCEPT: WINDING RIVER, MODERN BRIDGE, MOUNTAINS & HOT AIR BALLOONS (Ref 11)
  // ---------------------------------------------------------------------------
  // Winding River Water Ribbon
  const riverWaterGeo = new THREE.PlaneGeometry(340, 28, 36, 1);
  riverWaterGeo.rotateX(-Math.PI * 0.5);
  const rwPos = riverWaterGeo.attributes.position;
  for (let i = 0; i < rwPos.count; i++) {
    const wx = 1308 + rwPos.getX(i);
    rwPos.setZ(i, rwPos.getZ(i) + getIsometricRiverZ(wx));
  }
  riverWaterGeo.computeVertexNormals();
  ctx.geometries.push(riverWaterGeo);
  const riverWaterMesh = new THREE.Mesh(riverWaterGeo, waterChannelMat);
  riverWaterMesh.position.set(1308, -0.62, 0);
  group.add(riverWaterMesh);

  // Grounded Modern Arched Bridge across Isometric River along x = 1235 (both ends slope flush to y = 0!)
  const isoRiverZ = getIsometricRiverZ(1235);
  const isoDeckY = 1.4;
  const isoSlopeLen = 7.5;
  const isoSlopeAng = Math.atan2(isoDeckY, isoSlopeLen);
  const isoSlopeHyp = Math.hypot(isoSlopeLen, isoDeckY);
  // Center level span (z in [isoRiverZ-10..isoRiverZ+10])
  addPart(group, pal.boxGeo, castleDarkStoneMat, 1235, isoDeckY - 0.35, isoRiverZ, 12.8, 0.7, 20);
  addPart(group, pal.boxGeo, asphaltNewMat, 1235, isoDeckY - 0.02, isoRiverZ, 11.4, 0.08, 20);
  // Grounded bridge piers into riverbanks
  [-10, 10].forEach((pzOff) => {
    addPart(group, pal.boxGeo, castleStoneMat, 1235, -0.4, isoRiverZ + pzOff, 12.8, 2.8, 1.8);
  });
  // Flush sloped North & South approach ramps reaching y = 0 cleanly
  addPart(group, pal.boxGeo, asphaltNewMat, 1235, isoDeckY * 0.5 - 0.18, isoRiverZ - 10 - isoSlopeLen * 0.5, 12.6, 0.45, isoSlopeHyp, { rotX: -isoSlopeAng });
  addPart(group, pal.boxGeo, asphaltNewMat, 1235, isoDeckY * 0.5 - 0.18, isoRiverZ + 10 + isoSlopeLen * 0.5, 12.6, 0.45, isoSlopeHyp, { rotX: isoSlopeAng });
  addPart(group, pal.boxGeo, goldTrimMat, 1229.1, isoDeckY + 0.55, isoRiverZ, 0.45, 1.1, 20);
  addPart(group, pal.boxGeo, goldTrimMat, 1240.9, isoDeckY + 0.55, isoRiverZ, 0.45, 1.1, 20);
  addPart(group, torusGeo, azureRoofMat, 1229.1, isoDeckY + 0.25, isoRiverZ, 10, 5.2, 0.6, { rotY: Math.PI * 0.5 });
  addPart(group, torusGeo, azureRoofMat, 1240.9, isoDeckY + 0.25, isoRiverZ, 10, 5.2, 0.6, { rotY: Math.PI * 0.5 });
  ctx.ramps.push(
    {
      minX: 1228.5,
      maxX: 1241.5,
      minZ: isoRiverZ - 17.5,
      maxZ: isoRiverZ - 10,
      axis: 'z',
      startCoord: isoRiverZ - 17.5,
      endCoord: isoRiverZ - 10,
      startY: 0,
      endY: isoDeckY,
    },
    {
      minX: 1228.5,
      maxX: 1241.5,
      minZ: isoRiverZ - 10,
      maxZ: isoRiverZ + 10,
      axis: 'z',
      startCoord: isoRiverZ - 10,
      endCoord: isoRiverZ + 10,
      startY: isoDeckY,
      endY: isoDeckY,
    },
    {
      minX: 1228.5,
      maxX: 1241.5,
      minZ: isoRiverZ + 10,
      maxZ: isoRiverZ + 17.5,
      axis: 'z',
      startCoord: isoRiverZ + 10,
      endCoord: isoRiverZ + 17.5,
      startY: isoDeckY,
      endY: 0,
    },
  );

  // Futuristic Digital Isometric Valley Cyber-Towers (Dark Obsidian Alloy, Clear Breakable Glass, Neon Ribs & Live Displays)
  const isoDarkAlloyMat = makeMat(0x0b1220, 0.28, 0.78);
  const isoNeonMats = [
    makeMat(0x22d3ee, 0.25, 0.3, { emissive: 0x06b6d4, emissiveIntensity: 1.4 }),
    makeMat(0xa855f7, 0.25, 0.3, { emissive: 0x9333ea, emissiveIntensity: 1.4 }),
    makeMat(0x34d399, 0.25, 0.3, { emissive: 0x10b981, emissiveIntensity: 1.4 }),
    makeMat(0xf43f5e, 0.25, 0.3, { emissive: 0xe11d48, emissiveIntensity: 1.4 }),
    makeMat(0xfacc15, 0.25, 0.3, { emissive: 0xeab308, emissiveIntensity: 1.3 }),
  ];
  const isoGlassMat = makeMat(0x38bdf8, 0.08, 0.65, { transparent: true, opacity: 0.42, depthWrite: false });
  [
    { x: 1175, z: -78, w: 14, d: 14, h: 28, neonHex: '#22d3ee', label: 'AFTAB TECH TOWER' },
    { x: 1202, z: -84, w: 12, d: 12, h: 22, neonHex: '#34d399', label: 'QUANTUM VALLEY' },
    { x: 1320, z: -68, w: 15, d: 15, h: 32, neonHex: '#facc15', label: 'DEVELOPED BY AFTAB BALOCH DADU' },
    { x: 1305, z: 32, w: 16, d: 14, h: 24, neonHex: '#a855f7', label: 'HYPERNET HUB' },
    { x: 1178, z: 42, w: 14, d: 14, h: 20, neonHex: '#f43f5e', label: 'APEX DIGITAL PLAZA' },
  ].forEach((b, idx) => {
    const neonMat = isoNeonMats[idx % isoNeonMats.length];
    // Sculpted dark obsidian core + setback digital crown
    addPart(group, pal.boxGeo, isoDarkAlloyMat, b.x, b.h * 0.45, b.z, b.w * 0.88, b.h * 0.9, b.d * 0.88, { castShadow: !ctx.isSoftwareGl });
    addPart(group, pal.boxGeo, isoDarkAlloyMat, b.x, b.h * 0.94, b.z, b.w * 0.66, b.h * 0.14, b.d * 0.66);
    // Corner glowing digital neon columns
    [-1, 1].forEach((sx) => {
      [-1, 1].forEach((sz) => {
        addPart(group, pal.boxGeo, neonMat, b.x + sx * (b.w * 0.46), b.h * 0.48, b.z + sz * (b.d * 0.46), 0.42, b.h * 0.94, 0.42);
      });
    });
    // Horizontal neon circuit rings
    [b.h * 0.34, b.h * 0.68, b.h * 0.9].forEach((ry) => {
      addPart(group, pal.boxGeo, neonMat, b.x, ry, b.z, b.w * 0.94, 0.28, b.d * 0.94);
    });
    // Shootable auto-healing glass curtain walls on North & South facades
    [-1, 1].forEach((sz) => {
      registerBreakableGlass(
        ctx,
        addPart(group, pal.boxGeo, isoGlassMat, b.x, b.h * 0.48, b.z + sz * (b.d * 0.45), b.w * 0.78, b.h * 0.72, 0.16),
      );
    });
    // Rooftop holographic ring & telemetry spire
    addPart(group, torusGeo, neonMat, b.x, b.h + 1.4, b.z, b.w * 0.34, b.w * 0.34, 0.45, { rotX: Math.PI * 0.5 });
    addPart(group, cylGeo, neonMat, b.x, b.h + 3.2, b.z, 0.16, 4.2, 0.16);
    // Live animated digital facade screen facing road
    const towerScreenMat = ctx.displays.createDisplayMaterial('city_billboard', {
      title: b.label,
      subtitle: 'ISOMETRIC DIGITAL VALLEY',
      accentHex: b.neonHex,
      lockTitle: idx === 2,
      intervalSec: 0.9,
    }).material;
    const scr = new THREE.Mesh(pal.boxGeo, towerScreenMat);
    scr.position.set(b.x, b.h * 0.54, b.z + b.d * 0.48);
    scr.scale.set(b.w * 0.68, 3.8, 0.18);
    group.add(scr);
    addCollider(ctx.colliders, b.x, 0, b.z, b.w, b.h, b.d, 0, 'concrete');
  });

  // Isometric City Green Sports Pitch (x = 1265, z = 44)
  addPart(group, pal.boxGeo, makeMat(0x16a34a, 0.85, 0.02), 1265, 0.06, 44, 24, 0.12, 16);
  addPart(group, pal.boxGeo, pureWhiteMat, 1265, 0.14, 44, 0.25, 0.04, 15.2);

  // 7 Animated Multi-Colored Hot Air Balloons floating across Isometric Valley & East Skyline (Ref 11!)
  const hotAirBalloons: Array<{
    group: THREE.Group;
    bx: number;
    by: number;
    bz: number;
    ampX: number;
    ampZ: number;
    phase: number;
  }> = [];
  const balloonColors = [vermilionMat, azureRoofMat, goldTrimMat, jadeRoofMat, makeMat(0xec4899, 0.5), makeMat(0x8b5cf6, 0.5), makeMat(0xf97316, 0.5)];
  const balloonColorHex = [0xdc2626, 0x0284c7, 0xfacc15, 0x10b981, 0xec4899, 0x8b5cf6, 0xf97316];
  [
    { x: 1190, y: 42, z: -42, ampX: 16, ampZ: 12 },
    { x: 1295, y: 48, z: -20, ampX: 20, ampZ: 16 },
    { x: 1385, y: 54, z: -65, ampX: 14, ampZ: 18 },
    { x: 1365, y: 46, z: 32, ampX: 18, ampZ: 14 },
    { x: 1265, y: 50, z: 125, ampX: 22, ampZ: 14 },
    { x: 1020, y: 46, z: -25, ampX: 24, ampZ: 18 },
    { x: 935, y: 44, z: 205, ampX: 18, ampZ: 12 },
  ].forEach((bc, idx) => {
    const bg = new THREE.Group();
    const bMat = balloonColors[idx % balloonColors.length];
    const envSphere = addPart(bg, sphereGeo, bMat, 0, 3.2, 0, 3.6, 4.3, 3.6);
    const envBand = addPart(bg, torusGeo, goldTrimMat, 0, 3.2, 0, 3.7, 3.7, 1.0, { rotX: Math.PI * 0.5 });
    const envSkirt = addPart(bg, coneGeo, pureWhiteMat, 0, 0.6, 0, 2.2, 2.4, 2.2, { rotX: Math.PI });
    const basket = addPart(bg, pal.boxGeo, woodTimberMat, 0, -2.0, 0, 1.5, 1.2, 1.5);
    const burner = addPart(bg, sphereGeo, lanternGlowMat, 0, -0.5, 0, 0.35, 0.55, 0.35); // Burner glow!
    bg.position.set(bc.x, bc.y, bc.z);
    group.add(bg);
    hotAirBalloons.push({ ...bc, bx: bc.x, by: bc.y, bz: bc.z, group: bg, phase: idx * 1.15 });
    ctx.shootableBalloons?.push({
      group: bg,
      envelopeMeshes: [envSphere, envBand, envSkirt, burner],
      basketMeshes: [basket],
      baseX: bc.x,
      baseY: bc.y,
      baseZ: bc.z,
      ampX: bc.ampX,
      ampZ: bc.ampZ,
      phase: idx * 1.15,
      envelopeOffsetY: 3.1,
      hitRadius: 4.3,
      accentHex: balloonColorHex[idx % balloonColorHex.length],
    });
  });

  // Ambient Overhead Isometric Patrol Helicopter circling East Island sky
  const ambientHeli = new THREE.Group();
  const heliRotorMain = new THREE.Group();
  const heliRotorTail = new THREE.Group();
  {
    addPart(ambientHeli, pal.boxGeo, azureRoofMat, 0, 0, 0, 2.2, 1.8, 5.4);
    registerBreakableGlass(ctx, addPart(ambientHeli, pal.boxGeo, glassBlueMat, 0, 0.25, 2.2, 1.9, 1.1, 1.6));
    addPart(ambientHeli, pal.boxGeo, pureWhiteMat, 0, 0.2, -4.6, 0.45, 0.55, 4.2);
    heliRotorMain.position.set(0, 1.15, 0);
    addPart(heliRotorMain, pal.boxGeo, castleDarkStoneMat, 0, 0, 0, 9.2, 0.08, 0.28);
    addPart(heliRotorMain, pal.boxGeo, castleDarkStoneMat, 0, 0, 0, 0.28, 0.08, 9.2);
    heliRotorTail.position.set(0.32, 0.35, -6.5);
    addPart(heliRotorTail, pal.boxGeo, castleDarkStoneMat, 0, 0, 0, 0.06, 1.7, 0.2);
    ambientHeli.add(heliRotorMain, heliRotorTail);
    group.add(ambientHeli);
  }

  // ---------------------------------------------------------------------------
  // 7. BIGGEST ROYAL MEDIEVAL CASTLE + MOAT + WINDMILL + GUARDS + CAVALRY (Ref 10)
  // ---------------------------------------------------------------------------
  const castleCx = 1285;
  const castleCz = 188;
  // Moat water surface covering x in [1150..1420], z in [86..290] beneath ground y=-0.45..0
  const moatWaterGeo = new THREE.PlaneGeometry(270, 204);
  moatWaterGeo.rotateX(-Math.PI * 0.5);
  ctx.geometries.push(moatWaterGeo);
  const moatWater = new THREE.Mesh(moatWaterGeo, waterChannelMat);
  moatWater.position.set(castleCx, -0.58, castleCz);
  group.add(moatWater);

  // Raised Royal Stone Courtyard Slab inside Moat (x in [1168..1402], z in [104..272]) — strictly below Keep Marble & above recessed terrain
  const castleCourtyardMat = makeMat(0xcbd5e1, 0.78, 0.08, {
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  addPart(group, pal.boxGeo, castleCourtyardMat, castleCx, -0.04, castleCz, 234, 0.16, 168);

  // 2 Grand WIDE Stone Castle Gatehouse Drawbridges across Water Moat (West x=1160, z=188 & North x=1285, z=96)
  // Both smoothly sloped down to y=0 at road & courtyard ends so King/Queen Horse Carriage enters effortlessly!
  addPart(group, pal.boxGeo, woodTimberMat, 1160, 0.25, castleCz, 22, 0.5, 14);
  addPart(group, pal.boxGeo, castleDarkStoneMat, 1160, 0.9, castleCz - 6.8, 22, 0.9, 0.6);
  addPart(group, pal.boxGeo, castleDarkStoneMat, 1160, 0.9, castleCz + 6.8, 22, 0.9, 0.6);
  ctx.ramps.push(
    { minX: 1147, maxX: 1152, minZ: castleCz - 6.5, maxZ: castleCz + 6.5, axis: 'x', startCoord: 1147, endCoord: 1152, startY: 0, endY: 0.5 },
    { minX: 1152, maxX: 1168, minZ: castleCz - 6.5, maxZ: castleCz + 6.5, axis: 'x', startCoord: 1152, endCoord: 1168, startY: 0.5, endY: 0.5 },
    { minX: 1168, maxX: 1173, minZ: castleCz - 6.5, maxZ: castleCz + 6.5, axis: 'x', startCoord: 1168, endCoord: 1173, startY: 0.5, endY: 0 },
  );

  addPart(group, pal.boxGeo, woodTimberMat, castleCx, 0.25, 96, 14, 0.5, 22);
  addPart(group, pal.boxGeo, castleDarkStoneMat, castleCx - 6.8, 0.9, 96, 0.6, 0.9, 22);
  addPart(group, pal.boxGeo, castleDarkStoneMat, castleCx + 6.8, 0.9, 96, 0.6, 0.9, 22);
  ctx.ramps.push(
    { minX: castleCx - 6.5, maxX: castleCx + 6.5, minZ: 83, maxZ: 88, axis: 'z', startCoord: 83, endCoord: 88, startY: 0, endY: 0.5 },
    { minX: castleCx - 6.5, maxX: castleCx + 6.5, minZ: 88, maxZ: 104, axis: 'z', startCoord: 88, endCoord: 104, startY: 0.5, endY: 0.5 },
    { minX: castleCx - 6.5, maxX: castleCx + 6.5, minZ: 104, maxZ: 109, axis: 'z', startCoord: 104, endCoord: 109, startY: 0.5, endY: 0 },
  );

  // Outer Stone Curtain Walls with WIDE Open Gateways (20m wide!) & Battlement Crenellations
  const wallN = { minX: 1170, maxX: 1400, minZ: 106, maxZ: 270 };
  [
    { x: 1221, z: wallN.minZ, w: 102, d: 4.5 },
    { x: 1349, z: wallN.minZ, w: 102, d: 4.5 },
    { x: castleCx, z: wallN.maxZ, w: 230, d: 4.5 }, // South wall
    { x: wallN.maxX, z: castleCz, w: 4.5, d: 164 }, // East wall
    { x: wallN.minX, z: 141, w: 4.5, d: 68 }, // West wall north half
    { x: wallN.minX, z: 235, w: 4.5, d: 68 }, // West wall south half
  ].forEach((ws) => {
    addPart(group, pal.boxGeo, castleStoneMat, ws.x, 4.6, ws.z, ws.w, 9.2, ws.d, { castShadow: !ctx.isSoftwareGl });
    const count = Math.max(4, Math.floor(Math.max(ws.w, ws.d) / 6));
    for (let m = 0; m < count; m++) {
      const t = (m / Math.max(1, count - 1)) - 0.5;
      const mx = ws.w > ws.d ? ws.x + t * (ws.w - 4) : ws.x;
      const mz = ws.d > ws.w ? ws.z + t * (ws.d - 4) : ws.z;
      pb.addBox(mx, 9.8, mz, 2.2, 1.3, 2.2, 0x94a3b8);
    }
    addCollider(ctx.colliders, ws.x, 0, ws.z, ws.w, 9.6, ws.d, 0, 'concrete');
  });

  // 8 Stone Cylindrical Drum Towers (4 Corners + 4 Wide-Spaced Gatehouse Towers)
  [
    [1170, 106, 16, true],
    [1400, 106, 16, true],
    [1170, 270, 16, true],
    [1400, 270, 16, true],
    [1272, 106, 14, false],
    [1298, 106, 14, false],
    [1170, 175, 14, false],
    [1170, 201, 14, false],
  ].forEach(([tx, tz, th, isCorner]) => {
    const rad = isCorner ? 5.2 : 4.0;
    addPart(group, cylGeo, castleStoneMat, tx as number, (th as number) * 0.5, tz as number, rad, th as number, rad, {
      castShadow: !ctx.isSoftwareGl,
    });
    addPart(group, coneGeo, azureRoofMat, tx as number, (th as number) + 3.2, tz as number, rad * 1.18, 6.4, rad * 1.18);
    addPart(group, cylGeo, goldTrimMat, tx as number, (th as number) + 7.2, tz as number, 0.16, 2.2, 0.16);
    addCollider(ctx.colliders, tx as number, 0, tz as number, rad * 1.85, th as number, rad * 1.85, 0, 'concrete');
  });
  // Gatehouse upper stone lintels (tall 8.6m carriage clearance!)
  addPart(group, pal.boxGeo, castleStoneMat, castleCx, 10.4, 106, 22, 3.6, 4.6);
  addPart(group, pal.boxGeo, castleStoneMat, 1170, 10.4, castleCz, 4.6, 3.6, 22);

  // ENTERABLE GRAND ROYAL KEEP CITADEL (1285, 188) WITH COMPLEX BAROQUE INTERIOR, GOLDEN THRONE HALL & HUGE OPEN CARRIAGE DOORS!
  {
    const keepW = 42; // x in [1264..1306]
    const keepD = 34; // z in [171..205]
    const keepH = 16;
    const kx0 = castleCx - keepW * 0.5;
    const kx1 = castleCx + keepW * 0.5;
    const kz0 = castleCz - keepD * 0.5;
    const kz1 = castleCz + keepD * 0.5;

    // Polished Palace Marble Floor (top y=0.12) + Distinct Plush Red Royal Carpet Runner (top y=0.195)
    addPart(group, pal.boxGeo, pal.mallMarble, castleCx, 0.04, castleCz, keepW - 0.6, 0.16, keepD - 0.6);
    addPart(group, pal.boxGeo, royalVelvetMat, castleCx - 3.5, 0.165, castleCz, 28, 0.06, 6.2);
    addPart(group, pal.boxGeo, goldTrimMat, castleCx - 3.5, 0.155, castleCz, 28.4, 0.04, 6.8);
    addPart(group, pal.boxGeo, royalVelvetMat, castleCx, 0.165, castleCz - 7.5, 6.2, 0.06, 17.5);

    // West Keep Wall with BIGGEST & WIDEST 12m wide x 9m tall Grand Double Portal Doors! (z in [182..194] wide open)
    addPart(group, pal.boxGeo, castleStoneMat, kx0, keepH * 0.5, kz0 + 5.5, 1.4, keepH, 11);
    addPart(group, pal.boxGeo, castleStoneMat, kx0, keepH * 0.5, kz1 - 5.5, 1.4, keepH, 11);
    addPart(group, pal.boxGeo, castleStoneMat, kx0, 12.6, castleCz, 1.6, 6.8, 12.4);
    addPart(group, pal.boxGeo, goldTrimMat, kx0 - 0.6, 9.2, castleCz, 0.6, 0.8, 12.8);
    // Open gilded double doors folded wide outward (12m clear drive-through for Royal Carriage!)
    addPart(group, pal.boxGeo, woodTimberMat, kx0 - 2.6, 4.5, castleCz - 6.2, 4.8, 8.8, 0.35, { rotY: 0.15 });
    addPart(group, pal.boxGeo, goldTrimMat, kx0 - 2.6, 4.5, castleCz - 6.0, 4.4, 8.2, 0.42, { rotY: 0.15 });
    addPart(group, pal.boxGeo, woodTimberMat, kx0 - 2.6, 4.5, castleCz + 6.2, 4.8, 8.8, 0.35, { rotY: -0.15 });
    addPart(group, pal.boxGeo, goldTrimMat, kx0 - 2.6, 4.5, castleCz + 6.0, 4.4, 8.2, 0.42, { rotY: -0.15 });
    addCollider(ctx.colliders, kx0, 0, kz0 + 5.5, 1.5, keepH, 11, 0, 'concrete');
    addCollider(ctx.colliders, kx0, 0, kz1 - 5.5, 1.5, keepH, 11, 0, 'concrete');

    // North Keep Wall with BIGGEST & WIDEST 12m wide x 9m tall North Gate Portal! (x in [1279..1291] wide open)
    addPart(group, pal.boxGeo, castleStoneMat, kx0 + 7.5, keepH * 0.5, kz0, 15, keepH, 1.4);
    addPart(group, pal.boxGeo, castleStoneMat, kx1 - 7.5, keepH * 0.5, kz0, 15, keepH, 1.4);
    addPart(group, pal.boxGeo, castleStoneMat, castleCx, 12.6, kz0, 12.4, 6.8, 1.6);
    addPart(group, pal.boxGeo, goldTrimMat, castleCx, 9.2, kz0 - 0.6, 12.8, 0.8, 0.6);
    addPart(group, pal.boxGeo, goldTrimMat, castleCx - 6.2, 4.5, kz0 - 2.6, 0.4, 8.6, 4.8, { rotY: -0.15 });
    addPart(group, pal.boxGeo, goldTrimMat, castleCx + 6.2, 4.5, kz0 - 2.6, 0.4, 8.6, 4.8, { rotY: 0.15 });
    addCollider(ctx.colliders, kx0 + 7.5, 0, kz0, 15, keepH, 1.5, 0, 'concrete');
    addCollider(ctx.colliders, kx1 - 7.5, 0, kz0, 15, keepH, 1.5, 0, 'concrete');

    // South & East Solid Keep Walls with Tall Glowing Gothic Arched Palace Windows (matching Throne Room refs!)
    addPart(group, pal.boxGeo, castleStoneMat, castleCx, keepH * 0.5, kz1, keepW, keepH, 1.4, { castShadow: !ctx.isSoftwareGl });
    addPart(group, pal.boxGeo, castleStoneMat, kx1, keepH * 0.5, castleCz, 1.4, keepH, keepD, { castShadow: !ctx.isSoftwareGl });
    addCollider(ctx.colliders, castleCx, 0, kz1, keepW, keepH, 1.6, 0, 'concrete');
    addCollider(ctx.colliders, kx1, 0, castleCz, 1.6, keepH, keepD, 0, 'concrete');

    [-12, 0, 12].forEach((wx) => {
      addPart(group, pal.boxGeo, chandelierGlowMat, castleCx + wx, 7.6, kz1 - 0.72, 3.2, 8.2, 0.18);
      addPart(group, pal.boxGeo, goldTrimMat, castleCx + wx, 11.8, kz1 - 0.72, 3.6, 0.45, 0.3);
    });
    [-8, 8].forEach((wz) => {
      addPart(group, pal.boxGeo, chandelierGlowMat, kx1 - 0.72, 8.2, castleCz + wz, 0.18, 8.6, 3.6);
      addPart(group, pal.boxGeo, goldTrimMat, kx1 - 0.72, 12.6, castleCz + wz, 0.3, 0.45, 4.0);
    });

    // Ornate Fresco & Gilded Coffered Vault Ceiling (y = 14.5..16) + Hanging Multi-Tier Crystal Chandeliers!
    addPart(group, pal.boxGeo, frescoMat, castleCx, 15.2, castleCz, keepW - 1.2, 0.45, keepD - 1.2);
    addPart(group, pal.boxGeo, castleStoneMat, castleCx, 16.3, castleCz, keepW + 1.0, 0.7, keepD + 1.0);
    addCollider(ctx.colliders, castleCx, 15.0, castleCz, keepW, 1.2, keepD, 0, 'concrete');
    [-10, 0, 10].forEach((rx) => {
      addPart(group, pal.boxGeo, goldTrimMat, castleCx + rx, 14.75, castleCz, 0.9, 0.55, keepD - 1.6);
      // 3 Grand Multi-Tier Crystal & Gold Chandeliers
      const chX = castleCx + rx;
      addPart(group, cylGeo, goldTrimMat, chX, 13.3, castleCz, 0.12, 3.4, 0.12);
      addPart(group, torusGeo, chandelierGlowMat, chX, 11.6, castleCz, 2.2, 2.2, 0.35, { rotX: Math.PI * 0.5 });
      addPart(group, torusGeo, goldTrimMat, chX, 12.3, castleCz, 1.4, 1.4, 0.25, { rotX: Math.PI * 0.5 });
      addPart(group, sphereGeo, chandelierGlowMat, chX, 11.2, castleCz, 0.75, 0.9, 0.75);
    });

    // Interior Corinthian Marble & Gold Columns flanking the Royal Red Carpet Aisle + Side Velvet Armchairs!
    [-12, -4, 4].forEach((cxOff) => {
      [-6.8, 6.8].forEach((czOff) => {
        addPart(group, cylGeo, stoneWarmMat, castleCx + cxOff, 7.5, castleCz + czOff, 0.85, 14.8, 0.85);
        addPart(group, pal.boxGeo, goldTrimMat, castleCx + cxOff, 14.4, castleCz + czOff, 2.1, 0.7, 2.1);
        addCollider(ctx.colliders, castleCx + cxOff, 0, castleCz + czOff, 1.8, 14.8, 1.8, 0, 'concrete');
        // Royal Court Red & Gold Velvet Armchairs between columns
        addPart(group, pal.boxGeo, goldTrimMat, castleCx + cxOff, 0.38, castleCz + czOff * 1.48, 1.5, 0.65, 1.5);
        addPart(group, pal.boxGeo, royalVelvetMat, castleCx + cxOff, 0.88, castleCz + czOff * 1.48, 1.25, 0.5, 1.25);
        addPart(group, pal.boxGeo, goldTrimMat, castleCx + cxOff, 1.4, castleCz + czOff * 1.56, 1.4, 1.1, 0.35);
      });
    });

    // Raised Stepped Royal Dais + Twin Gilded King & Queen Thrones + Royal Canopy at East Apse (x = 1299)
    addPart(group, pal.boxGeo, stoneWarmMat, kx1 - 6.0, 0.45, castleCz, 8.5, 0.9, 14.5);
    addPart(group, pal.boxGeo, royalVelvetMat, kx1 - 5.2, 0.96, castleCz, 6.8, 0.16, 12.2);
    // Golden Canopy Baldachin Columns & Crown
    [-3.8, 3.8].forEach((tz) => {
      addPart(group, cylGeo, goldTrimMat, kx1 - 4.4, 5.2, castleCz + tz, 0.35, 8.6, 0.35);
    });
    addPart(group, pal.boxGeo, goldTrimMat, kx1 - 4.4, 9.6, castleCz, 4.2, 0.9, 8.6);
    addPart(group, pal.boxGeo, royalVelvetMat, kx1 - 2.4, 5.2, castleCz, 0.4, 8.2, 7.6);
    // King & Queen Golden Thrones side-by-side
    [-2.0, 2.0].forEach((tzOff, tIdx) => {
      const thx = kx1 - 4.6;
      const thz = castleCz + tzOff;
      addPart(group, pal.boxGeo, goldTrimMat, thx, 1.55, thz, 1.9, 1.1, 1.9);
      addPart(group, pal.boxGeo, royalVelvetMat, thx - 0.1, 1.95, thz, 1.5, 0.45, 1.5);
      addPart(group, pal.boxGeo, goldTrimMat, thx + 0.75, 3.2, thz, 0.42, 3.6, 1.9);
      addPart(group, sphereGeo, tIdx === 0 ? azureRoofMat : vermilionMat, thx + 0.72, 5.2, thz, 0.45, 0.55, 0.45);
    });
    addCollider(ctx.colliders, kx1 - 5.2, 0, castleCz, 7.0, 3.5, 13.0, 0, 'concrete');

    // Upper Citadel Setback Palace + 4 Corner Spires + High Central Royal Azure Spire!
    addPart(group, pal.boxGeo, stoneWarmMat, castleCx, 21.5, castleCz, 24, 10, 20);
    [[-18, -14], [18, -14], [-18, 14], [18, 14]].forEach(([ox, oz]) => {
      addPart(group, cylGeo, castleStoneMat, castleCx + ox, 13.0, castleCz + oz, 3.8, 26, 3.8);
      addPart(group, coneGeo, azureRoofMat, castleCx + ox, 28.8, castleCz + oz, 4.4, 6.2, 4.4);
    });
    addPart(group, cylGeo, stoneWarmMat, castleCx, 30.5, castleCz, 4.8, 11, 4.8);
    addPart(group, coneGeo, azureRoofMat, castleCx, 39.5, castleCz, 5.6, 8.4, 5.6);
    addPart(group, pal.boxGeo, vermilionMat, castleCx, 44.8, castleCz + 0.9, 0.12, 1.4, 2.4);
  }

  // Medieval Half-Timbered Village Cottages inside Courtyard & Animated Windmill (Ref 10!)
  [
    { x: 1212, z: 140, rotY: 0.12 },
    { x: 1216, z: 236, rotY: -0.08 },
    { x: 1354, z: 232, rotY: 0.05 },
    { x: 1352, z: 142, rotY: 0 },
    { x: 1445, z: 158, rotY: 0.4 },
    { x: 1445, z: 222, rotY: -0.35 },
  ].forEach((c, idx) => {
    const cg = new THREE.Group();
    cg.position.set(c.x, 0, c.z);
    cg.rotation.y = c.rotY;
    addPart(cg, pal.boxGeo, stoneWarmMat, 0, 2.4, 0, 10, 4.8, 8);
    addPart(cg, pal.boxGeo, woodTimberMat, 0, 2.5, 4.08, 9.6, 0.35, 0.18);
    addPart(cg, coneGeo, idx % 2 === 0 ? vermilionMat : castleDarkStoneMat, 0, 6.6, 0, 6.8, 3.8, 6.2, { rotY: Math.PI * 0.25 });
    group.add(cg);
    addCollider(ctx.colliders, c.x, 0, c.z, 10.2, 6, 8.2, c.rotY, 'concrete');
  });

  // Animated 4-Blade Medieval Windmill at (1332, 146)
  const windmillBlades = new THREE.Group();
  {
    const mx = 1332;
    const mz = 146;
    addPart(group, cylGeo, stoneWarmMat, mx, 5.5, mz, 2.6, 11, 2.6);
    addPart(group, coneGeo, vermilionMat, mx, 12.2, mz, 3.1, 3.2, 3.1);
    windmillBlades.position.set(mx, 9.8, mz + 2.8);
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * Math.PI * 2;
      const arm = new THREE.Group();
      arm.rotation.z = a;
      addPart(arm, pal.boxGeo, woodTimberMat, 0, 2.6, 0, 0.26, 5.2, 0.22);
      addPart(arm, pal.boxGeo, pureWhiteMat, 0.42, 3.0, 0.08, 1.05, 3.8, 0.08);
      windmillBlades.add(arm);
    }
    group.add(windmillBlades);
    addCollider(ctx.colliders, mx, 0, mz, 5.5, 11, 5.5, 0, 'concrete');
  }

  // Royal Guard & Cavalry Patrol Coordinates
  const castleFootGuards: GrandEastCityResult['castleFootGuards'] = [
    { x: 1152, z: 181, patrolX: 1168, patrolZ: 181 },
    { x: 1152, z: 195, patrolX: 1168, patrolZ: 195 },
    { x: 1278, z: 90, patrolX: 1278, patrolZ: 105 },
    { x: 1292, z: 90, patrolX: 1292, patrolZ: 105 },
    { x: 1246, z: 188, patrolX: 1246, patrolZ: 162 },
    { x: 1324, z: 188, patrolX: 1324, patrolZ: 214 },
    { x: 1285, z: 158, patrolX: 1255, patrolZ: 158 },
    { x: 1285, z: 218, patrolX: 1315, patrolZ: 218 },
  ];
  const castleHorseGuards: GrandEastCityResult['castleHorseGuards'] = [
    {
      horseColor: 0x7c2d12,
      waypoints: [
        { x: 1142, z: 188 },
        { x: 1142, z: 80 },
        { x: 1285, z: 80 },
        { x: 1428, z: 80 },
        { x: 1428, z: 292 },
        { x: 1142, z: 292 },
      ],
    },
    {
      horseColor: 0xf8fafc,
      waypoints: [
        { x: 1428, z: 292 },
        { x: 1142, z: 292 },
        { x: 1142, z: 80 },
        { x: 1428, z: 80 },
      ],
    },
    {
      horseColor: 0x1e293b,
      waypoints: [
        { x: 1236, z: 132 },
        { x: 1344, z: 132 },
        { x: 1344, z: 246 },
        { x: 1236, z: 246 },
      ],
    },
    {
      horseColor: 0x92400e,
      waypoints: [
        { x: 1344, z: 246 },
        { x: 1236, z: 246 },
        { x: 1236, z: 132 },
        { x: 1344, z: 132 },
      ],
    },
  ];

  // ---------------------------------------------------------------------------
  // 8. BIGGEST CHINATOWN DISTRICT (Refs 4, 8, 9, 12, 13, 14, 15)
  // ---------------------------------------------------------------------------
  // Red Stone-Paved Lantern Promenade Plaza split cleanly NORTH (z=168..220) & SOUTH (z=236..296) of z=228 Promenade Road!
  const chinatownPlazaMat = makeMat(0x9f1239, 0.78, 0.08, {
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  addPart(group, pal.boxGeo, chinatownPlazaMat, 958, -0.03, 194, 314, 0.16, 52);
  addPart(group, pal.boxGeo, chinatownPlazaMat, 958, -0.03, 266, 314, 0.16, 60);

  // 3 Monumental 4-Pillar Paifang Ceremonial Gates (Refs 8, 9, 13!)
  const placePaifangGate = (gx: number, gz: number, rotY: number) => {
    const pg = new THREE.Group();
    pg.position.set(gx, 0, gz);
    pg.rotation.y = rotY;
    // 4 Tall Vermilion Pillars on Carved Stone Plinths
    [-6.2, -3.4, 3.4, 6.2].forEach((px) => {
      addPart(pg, pal.boxGeo, castleStoneMat, px, 0.55, 0, 1.35, 1.1, 1.35);
      addPart(pg, cylGeo, vermilionMat, px, 4.2, 0, 0.42, 7.2, 0.42);
    });
    // Crossbeam Lintels + Gold Imperial Signboard + Upturned Jade/Emerald Pagoda Roofs!
    addPart(pg, pal.boxGeo, vermilionMat, 0, 6.2, 0, 13.8, 1.1, 1.2);
    addPart(pg, pal.boxGeo, goldTrimMat, 0, 6.2, 0.65, 5.4, 1.0, 0.14);
    // Center high roof tier & flanking wing roofs
    addPart(pg, pal.boxGeo, jadeRoofMat, 0, 8.2, 0, 9.2, 0.75, 3.6);
    addPart(pg, pal.boxGeo, goldTrimMat, 0, 8.8, 0, 9.6, 0.25, 0.6);
    addPart(pg, pal.boxGeo, jadeRoofMat, -5.2, 7.0, 0, 4.4, 0.6, 3.0, { rotZ: 0.16 });
    addPart(pg, pal.boxGeo, jadeRoofMat, 5.2, 7.0, 0, 4.4, 0.6, 3.0, { rotZ: -0.16 });
    // Hanging glowing red lanterns across gate lintel
    [-4.8, -1.6, 0, 1.6, 4.8].forEach((lx) => {
      addPart(pg, sphereGeo, lanternGlowMat, lx, 5.05, 0.4, 0.46, 0.58, 0.46);
    });
    group.add(pg);
    [-6.2, -3.4, 3.4, 6.2].forEach((px) => {
      const wx = gx + px * Math.cos(rotY);
      const wz = gz - px * Math.sin(rotY);
      addCollider(ctx.colliders, wx, 0, wz, 1.4, 7.5, 1.4, 0, 'concrete');
    });
  };
  placePaifangGate(820, 228, Math.PI * 0.5);
  placePaifangGate(1096, 228, Math.PI * 0.5);
  placePaifangGate(975, 174, 0);

  // Chinatown Illuminated Signboard
  const chinaBannerMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'CHINATOWN · 天下為公',
    subtitle: 'GRAND IMPERIAL TEMPLE · NIGHT LANTERN STREET · DRAGON PLAZA',
    accentHex: '#ef4444',
    intervalSec: 0.85,
  }).material;
  const chinaBanner = new THREE.Mesh(pal.boxGeo, chinaBannerMat);
  chinaBanner.position.set(975, 6.2, 174.9);
  chinaBanner.scale.set(5.2, 1.2, 0.24);
  group.add(chinaBanner);

  // Multi-Tiered Imperial Chinese Temple & Koi Pond Moon-Bridge (955, 274 — Refs 12, 14!)
  {
    const tx = 955;
    const tz = 274;
    addPart(group, pal.boxGeo, stoneWarmMat, tx, 0.5, tz, 34, 1.0, 24);
    addPart(group, pal.boxGeo, vermilionMat, tx, 4.0, tz, 26, 6.2, 16, { castShadow: !ctx.isSoftwareGl });
    addPart(group, pal.boxGeo, jadeRoofMat, tx, 7.6, tz, 30, 1.2, 20);
    addPart(group, pal.boxGeo, goldTrimMat, tx, 8.4, tz, 31, 0.35, 21);
    addPart(group, pal.boxGeo, vermilionMat, tx, 10.8, tz, 17, 4.4, 11);
    addPart(group, pal.boxGeo, jadeRoofMat, tx, 13.6, tz, 22, 1.4, 15);
    addPart(group, pal.boxGeo, goldTrimMat, tx, 14.8, tz, 22.8, 0.5, 0.5);
    // Decorative Corner Upturned Eave Tips + Guardian Lions at steps
    [-10.5, 10.5].forEach((ex) => {
      addPart(group, coneGeo, goldTrimMat, tx + ex, 14.6, tz, 0.75, 1.8, 0.75, { rotZ: ex > 0 ? -0.45 : 0.45 });
    });
    [-4.5, 4.5].forEach((lx) => {
      addPart(group, pal.boxGeo, stoneWarmMat, tx + lx, 1.2, tz - 13.5, 1.4, 1.6, 1.6);
      addPart(group, sphereGeo, goldTrimMat, tx + lx, 2.2, tz - 13.5, 0.65, 0.7, 0.65);
    });
    addCollider(ctx.colliders, tx, 0, tz, 26.5, 14, 16.5, 0, 'concrete');

    // Grounded Koi Pond & Arched Red Moon-Bridge in front of Temple (flush ramps from y=0 -> 0.9 -> 0!)
    addPart(group, cylGeo, waterChannelMat, tx + 26, 0.04, tz, 10.5, 0.08, 10.5);
    addPart(group, pal.boxGeo, vermilionMat, tx + 26, 0.72, tz, 4.2, 0.36, 8.0);
    addPart(group, pal.boxGeo, vermilionMat, tx + 24.1, 1.35, tz, 0.24, 0.9, 8.0);
    addPart(group, pal.boxGeo, vermilionMat, tx + 27.9, 1.35, tz, 0.24, 0.9, 8.0);
    // Grounded stone piers & flush North/South step ramps down to y = 0
    addPart(group, pal.boxGeo, castleStoneMat, tx + 26, 0.45, tz - 4.0, 4.4, 0.9, 0.65);
    addPart(group, pal.boxGeo, castleStoneMat, tx + 26, 0.45, tz + 4.0, 4.4, 0.9, 0.65);
    const mbAng = Math.atan2(0.9, 4.0);
    const mbHyp = Math.hypot(4.0, 0.9);
    addPart(group, pal.boxGeo, vermilionMat, tx + 26, 0.38, tz - 6.0, 4.2, 0.28, mbHyp, { rotX: -mbAng });
    addPart(group, pal.boxGeo, vermilionMat, tx + 26, 0.38, tz + 6.0, 4.2, 0.28, mbHyp, { rotX: mbAng });
    ctx.ramps.push(
      { minX: tx + 23.9, maxX: tx + 28.1, minZ: tz - 8.0, maxZ: tz - 4.0, axis: 'z', startCoord: tz - 8.0, endCoord: tz - 4.0, startY: 0, endY: 0.9 },
      { minX: tx + 23.9, maxX: tx + 28.1, minZ: tz - 4.0, maxZ: tz + 4.0, axis: 'z', startCoord: tz - 4.0, endCoord: tz + 4.0, startY: 0.9, endY: 0.9 },
      { minX: tx + 23.9, maxX: tx + 28.1, minZ: tz + 4.0, maxZ: tz + 8.0, axis: 'z', startCoord: tz + 4.0, endCoord: tz + 8.0, startY: 0.9, endY: 0 },
    );
  }

  // Chinatown Shophouses, Tea Houses, Festival Paper-Fan & Floral Arches + Dense Hanging Red Lantern Canopies (GPU Instanced!)
  const ctDummy = new THREE.Object3D();
  type BoxTr = { x: number; y: number; z: number; sx: number; sy: number; sz: number };
  const ctStoneBoxes: BoxTr[] = [];
  const ctVermilionBoxes: BoxTr[] = [];
  const ctJadeBoxes: BoxTr[] = [];
  const ctGoldBoxes: BoxTr[] = [];
  const ctLanternSpheres: BoxTr[] = [];
  const ctGoldSpheres: BoxTr[] = [];

  for (let sx = 845; sx <= 1075; sx += 26) {
    if (Math.abs(sx - 975) < 16) continue;
    [-1, 1].forEach((side) => {
      const bz = 228 + side * 20;
      if (bz > 258 && Math.abs(sx - 955) < 28) return; // Clear Temple courtyard
      const colH = 8.5 + ((sx + side) % 3) * 2.5;
      (side < 0 ? ctStoneBoxes : ctVermilionBoxes).push({ x: sx, y: colH * 0.5, z: bz, sx: 18, sy: colH, sz: 12 });
      ctJadeBoxes.push({ x: sx, y: colH + 0.7, z: bz, sx: 20, sy: 1.2, sz: 14 });
      (side < 0 ? ctVermilionBoxes : ctGoldBoxes).push({ x: sx, y: 3.2, z: bz - side * 6.8, sx: 12, sy: 0.4, sz: 2.2 });
      ctLanternSpheres.push(
        { x: sx - 4, y: 2.6, z: bz - side * 7.2, sx: 0.35, sy: 0.45, sz: 0.35 },
        { x: sx + 4, y: 2.6, z: bz - side * 7.2, sx: 0.35, sy: 0.45, sz: 0.35 },
      );
      addCollider(ctx.colliders, sx, 0, bz, 18.2, colH, 12.2, 0, 'concrete');
    });

    // Overhead Lantern Canopy Strings crossing z = 228 (double-tiered festive red + gold glowing lanterns!)
    pb.addCylinder(0.04, 0.04, 17, 6, sx, 6.2, 228, 0x1f2937, 'solid', Math.PI * 0.5);
    pb.addCylinder(0.035, 0.035, 17, 6, sx + 13, 6.6, 228, 0x1f2937, 'solid', Math.PI * 0.5);
    for (let lz = -7; lz <= 7; lz += 2.3) {
      ctLanternSpheres.push({ x: sx, y: 5.75 - Math.abs(lz) * 0.03, z: 228 + lz, sx: 0.44, sy: 0.56, sz: 0.44 });
      ctGoldSpheres.push({ x: sx + 13, y: 6.15 - Math.abs(lz) * 0.03, z: 228 + lz, sx: 0.36, sy: 0.48, sz: 0.36 });
    }
  }
  const addInstancedBatch = (geo: THREE.BufferGeometry, mat: THREE.Material, items: BoxTr[], shadow = false) => {
    if (items.length === 0) return;
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    for (let i = 0; i < items.length; i++) {
      const t = items[i];
      ctDummy.position.set(t.x, t.y, t.z);
      ctDummy.rotation.set(0, 0, 0);
      ctDummy.scale.set(t.sx, t.sy, t.sz);
      ctDummy.updateMatrix();
      im.setMatrixAt(i, ctDummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = shadow;
    im.receiveShadow = true;
    group.add(im);
  };
  addInstancedBatch(pal.boxGeo, stoneWarmMat, ctStoneBoxes, !ctx.isSoftwareGl);
  addInstancedBatch(pal.boxGeo, vermilionMat, ctVermilionBoxes, !ctx.isSoftwareGl);
  addInstancedBatch(pal.boxGeo, jadeRoofMat, ctJadeBoxes, !ctx.isSoftwareGl);
  addInstancedBatch(pal.boxGeo, goldTrimMat, ctGoldBoxes, false);
  addInstancedBatch(sphereGeo, lanternGlowMat, ctLanternSpheres, false);
  addInstancedBatch(sphereGeo, goldTrimMat, ctGoldSpheres, false);

  // Chinatown Festival Paper-Fan & Floral Sculptures (Ref image 29!) + Illuminated Night Festival Floats (Ref image 31!)
  [875, 920, 1008, 1055].forEach((fx, fIdx) => {
    const fz = fIdx % 2 === 0 ? 214 : 242;
    addPart(group, pal.boxGeo, stoneWarmMat, fx, 0.55, fz, 1.8, 1.1, 1.8);
    // Layered Red & Gold Pleated Fan Discs + Floral Clusters
    addPart(group, cylGeo, vermilionMat, fx - 0.4, 2.2, fz, 1.15, 0.16, 1.15, { rotX: Math.PI * 0.5 });
    addPart(group, cylGeo, goldTrimMat, fx + 0.55, 2.8, fz, 0.95, 0.16, 0.95, { rotX: Math.PI * 0.5 });
    addPart(group, sphereGeo, vermilionMat, fx, 2.4, fz + 0.2, 0.48, 0.48, 0.48);
    addPart(group, sphereGeo, lanternGlowMat, fx + 0.3, 2.0, fz + 0.2, 0.38, 0.38, 0.38);
  });

  // Grand Illuminated Pagoda Festival Floats along Chinatown Night Promenade
  [905, 1022].forEach((flx) => {
    const flz = 204;
    addPart(group, pal.boxGeo, goldTrimMat, flx, 0.85, flz, 11, 1.7, 6.4);
    addPart(group, pal.boxGeo, lanternGlowMat, flx, 3.2, flz, 8.2, 3.2, 4.6);
    addPart(group, pal.boxGeo, jadeRoofMat, flx, 5.4, flz, 10.4, 0.9, 6.0);
    addPart(group, pal.boxGeo, lanternGlowMat, flx, 7.2, flz, 5.2, 2.6, 3.2);
    addPart(group, pal.boxGeo, goldTrimMat, flx, 9.0, flz, 7.4, 0.85, 4.5);
    addCollider(ctx.colliders, flx, 0, flz, 11.2, 8.5, 6.6, 0, 'concrete');
  });

  // Animated Undulating Festival Chinese Dragon Dance circling Plaza (x=955, z=206)
  const dragonSegments: THREE.Mesh[] = [];
  for (let d = 0; d < 14; d++) {
    const isHead = d === 0;
    const dm = addPart(
      group,
      isHead ? pal.boxGeo : sphereGeo,
      d % 2 === 0 ? vermilionMat : goldTrimMat,
      955,
      2.2,
      206,
      isHead ? 1.55 : 0.76,
      isHead ? 1.35 : 0.76,
      isHead ? 1.85 : 0.76,
    );
    dragonSegments.push(dm);
  }

  // BIGGEST HIGH-ALTITUDE NIGHT SKY FIREWORKS OVER CHINATOWN!
  const fireworkBursts: Array<{
    group: THREE.Group;
    stars: THREE.Mesh[];
    rocket: THREE.Mesh;
    cx: number;
    cy: number;
    cz: number;
    period: number;
    offset: number;
    mat: THREE.MeshBasicMaterial;
  }> = [];
  const fwColors = [0xff3b5c, 0xfacc15, 0x22d3ee, 0xc084fc, 0x4ade80];
  const fwSpecs = [
    { cx: 955, cy: 62, cz: 228, period: 4.8, offset: 0.0 },
    { cx: 905, cy: 56, cz: 218, period: 5.4, offset: 1.4 },
    { cx: 1015, cy: 66, cz: 238, period: 5.1, offset: 2.7 },
    { cx: 955, cy: 72, cz: 252, period: 6.0, offset: 3.9 },
  ];
  const fwDirs: Array<[number, number, number]> = [];
  const fwPtsCount = ctx.isSoftwareGl ? 14 : 22;
  for (let i = 0; i < fwPtsCount; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / fwPtsCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    fwDirs.push([
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    ]);
  }
  fwSpecs.forEach((fws, idx) => {
    const fwg = new THREE.Group();
    const fMat = new THREE.MeshBasicMaterial({
      color: fwColors[idx % fwColors.length],
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    ctx.materials.push(fMat);
    const rocket = new THREE.Mesh(sphereGeo, fMat);
    rocket.scale.set(0.55, 1.4, 0.55);
    fwg.add(rocket);
    const stars: THREE.Mesh[] = [];
    for (let s = 0; s < fwPtsCount; s++) {
      const sm = new THREE.Mesh(sphereGeo, fMat);
      sm.scale.setScalar(0.85);
      fwg.add(sm);
      stars.push(sm);
    }
    group.add(fwg);
    fireworkBursts.push({ group: fwg, stars, rocket, ...fws, mat: fMat });
  });

  // ---------------------------------------------------------------------------
  // 9. NEW BOTANICAL GARDENS, SAKURA TREES, ROUNDED PARK TREES, FLOWERBEDS & PERGOLAS
  // ---------------------------------------------------------------------------
  const gardenSpots: Array<{ x: number; z: number }> = [];
  const sakuraList: Array<{ x: number; z: number; s: number }> = [];
  const roundTreeList: Array<{ x: number; z: number; s: number; shadeIdx: number }> = [];
  const hedgeList: Array<{ x: number; z: number; rotY: number }> = [];
  const flowerList: Array<{ x: number; z: number; cIdx: number }> = [];

  // Ring Inner & Outer Gardens + Flowerbeds
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const rx = EAST_RING_CENTER_X + Math.cos(a) * 52;
    const rz = EAST_RING_CENTER_Z + Math.sin(a) * 52;
    if (Math.abs(rx - 975) > 10 && Math.abs(rz) > 10) {
      roundTreeList.push({ x: rx, z: rz, s: 0.9 + (i % 3) * 0.25, shadeIdx: i % 3 });
    }
    const ox = EAST_RING_CENTER_X + Math.cos(a + 0.1) * 165;
    const oz = EAST_RING_CENTER_Z + Math.sin(a + 0.1) * 165;
    if (!isOnGrandEastRoad(ox, oz) && Math.abs(oz) < 165) {
      roundTreeList.push({ x: ox, z: oz, s: 1.0 + (i % 2) * 0.2, shadeIdx: (i + 1) % 3 });
      gardenSpots.push({ x: ox, z: oz });
    }
  }

  // Chinatown Cherry Blossom Sakura Trees & Botanical Pergolas
  for (let sx = 825; sx <= 1095; sx += 22) {
    sakuraList.push({ x: sx, z: 215, s: 1.05 + ((sx % 3) * 0.12) });
    sakuraList.push({ x: sx, z: 241, s: 1.0 + ((sx % 4) * 0.1) });
  }
  sakuraList.push(
    { x: 932, z: 266, s: 1.25 },
    { x: 978, z: 266, s: 1.25 },
    { x: 955, z: 185, s: 1.15 },
    { x: 995, z: 185, s: 1.15 },
  );

  // Botanical Pergola Arches + Hedge Rows in Civic & Ring Garden Plazas
  [
    { x: 896, z: -24 },
    { x: 896, z: 24 },
    { x: 1054, z: -24 },
    { x: 1054, z: 24 },
  ].forEach((gp) => {
    addPart(group, pal.boxGeo, woodTimberMat, gp.x - 2.6, 1.5, gp.z, 0.25, 3.0, 0.25);
    addPart(group, pal.boxGeo, woodTimberMat, gp.x + 2.6, 1.5, gp.z, 0.25, 3.0, 0.25);
    addPart(group, pal.boxGeo, woodTimberMat, gp.x, 3.1, gp.z, 6.0, 0.25, 2.4);
    addPart(group, pal.boxGeo, jadeRoofMat, gp.x, 3.35, gp.z, 5.8, 0.28, 2.2);
    gardenSpots.push({ x: gp.x, z: gp.z });
    hedgeList.push({ x: gp.x - 4.2, z: gp.z, rotY: 0 }, { x: gp.x + 4.2, z: gp.z, rotY: 0 });
  });

  // Colorful Flowerbeds around Ring Parks, Civic Lawns, Castle Village & Isometric Riverfront
  const bedCenters = [
    [975 + 32, -26],
    [975 - 32, 26],
    [834, -70],
    [834, -20],
    [1204, 188],
    [1352, 188],
    [1218, -32],
    [955, 200],
  ];
  bedCenters.forEach(([bx, bz], idx) => {
    for (let f = 0; f < (ctx.isSoftwareGl ? 10 : 18); f++) {
      const fx = bx + Math.sin(f * 2.1 + idx) * 6.5;
      const fz = bz + Math.cos(f * 1.7 + idx) * 6.5;
      flowerList.push({ x: fx, z: fz, cIdx: (f + idx) % 4 });
    }
  });

  // Castle & Isometric Pine / Broadleaf Trees
  for (let tx = 1138; tx <= 1380; tx += 24) {
    if (Math.abs(tx - 1235) > 12) {
      const zNorth = -96;
      const zSouth = 66;
      roundTreeList.push({ x: tx, z: zNorth, s: 1.1, shadeIdx: 0 });
      roundTreeList.push({ x: tx, z: zSouth, s: 1.05, shadeIdx: 2 });
    }
  }

  // Instanced Botanical Meshes (zero draw-call bloat!)
  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();

  if (sakuraList.length > 0) {
    const sTrunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 2.8, 7);
    const sCrownGeo = new THREE.DodecahedronGeometry(2.1, 1);
    ctx.geometries.push(sTrunkGeo, sCrownGeo);
    const sTrunkMat = makeMat(0x5c3a21, 0.9);
    const sCrownMat = makeMat(0xf472b6, 0.72);
    const imTrunk = new THREE.InstancedMesh(sTrunkGeo, sTrunkMat, sakuraList.length);
    const imCrown = new THREE.InstancedMesh(sCrownGeo, sCrownMat, sakuraList.length);
    sakuraList.forEach((t, i) => {
      const gy = groundHeightAt(t.x, t.z, 0);
      dummy.position.set(t.x, gy + 1.4 * t.s, t.z);
      dummy.rotation.set(0, i * 0.9, 0);
      dummy.scale.set(t.s, t.s, t.s);
      dummy.updateMatrix();
      imTrunk.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, gy + 3.4 * t.s, t.z);
      dummy.scale.set(t.s * 1.15, t.s * 0.85, t.s * 1.15);
      dummy.updateMatrix();
      imCrown.setMatrixAt(i, dummy.matrix);
    });
    imTrunk.instanceMatrix.needsUpdate = true;
    imCrown.instanceMatrix.needsUpdate = true;
    imTrunk.computeBoundingSphere();
    imCrown.computeBoundingSphere();
    group.add(imTrunk, imCrown);
  }

  if (roundTreeList.length > 0) {
    const rTrunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 7);
    const rCrownGeo = new THREE.IcosahedronGeometry(1.75, 1);
    ctx.geometries.push(rTrunkGeo, rCrownGeo);
    const rTrunkMat = makeMat(0x6b4423, 0.9);
    const rCrownMat = makeMat(0xffffff, 0.78);
    const imTrunk = new THREE.InstancedMesh(rTrunkGeo, rTrunkMat, roundTreeList.length);
    const imCrown = new THREE.InstancedMesh(rCrownGeo, rCrownMat, roundTreeList.length);
    const treeHexes = [0x16a34a, 0x22c55e, 0x65a30d];
    roundTreeList.forEach((t, i) => {
      const gy = groundHeightAt(t.x, t.z, 0);
      dummy.position.set(t.x, gy + 1.2 * t.s, t.z);
      dummy.rotation.set(0, i * 0.6, 0);
      dummy.scale.set(t.s, t.s, t.s);
      dummy.updateMatrix();
      imTrunk.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, gy + 3.1 * t.s, t.z);
      dummy.scale.set(t.s, t.s * 0.95, t.s);
      dummy.updateMatrix();
      imCrown.setMatrixAt(i, dummy.matrix);
      colorTmp.setHex(treeHexes[t.shadeIdx]);
      imCrown.setColorAt(i, colorTmp);
    });
    imTrunk.instanceMatrix.needsUpdate = true;
    imCrown.instanceMatrix.needsUpdate = true;
    if (imCrown.instanceColor) imCrown.instanceColor.needsUpdate = true;
    imTrunk.computeBoundingSphere();
    imCrown.computeBoundingSphere();
    group.add(imTrunk, imCrown);
  }

  if (hedgeList.length > 0) {
    const hGeo = new THREE.BoxGeometry(2.8, 0.95, 1.0);
    ctx.geometries.push(hGeo);
    const hMat = makeMat(0x15803d, 0.88);
    const imHedge = new THREE.InstancedMesh(hGeo, hMat, hedgeList.length);
    hedgeList.forEach((h, i) => {
      dummy.position.set(h.x, groundHeightAt(h.x, h.z, 0) + 0.48, h.z);
      dummy.rotation.set(0, h.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      imHedge.setMatrixAt(i, dummy.matrix);
    });
    imHedge.instanceMatrix.needsUpdate = true;
    imHedge.computeBoundingSphere();
    group.add(imHedge);
  }

  if (flowerList.length > 0) {
    const fGeo = new THREE.DodecahedronGeometry(0.28, 0);
    ctx.geometries.push(fGeo);
    const fMat = makeMat(0xffffff, 0.55);
    const imFlower = new THREE.InstancedMesh(fGeo, fMat, flowerList.length);
    const fCols = [0xf43f5e, 0xfacc15, 0xa855f7, 0x38bdf8];
    flowerList.forEach((f, i) => {
      dummy.position.set(f.x, groundHeightAt(f.x, f.z, 0) + 0.3, f.z);
      dummy.rotation.set(0, i, 0);
      dummy.scale.set(1, 0.85, 1);
      dummy.updateMatrix();
      imFlower.setMatrixAt(i, dummy.matrix);
      colorTmp.setHex(fCols[f.cIdx]);
      imFlower.setColorAt(i, colorTmp);
    });
    imFlower.instanceMatrix.needsUpdate = true;
    if (imFlower.instanceColor) imFlower.instanceColor.needsUpdate = true;
    imFlower.computeBoundingSphere();
    group.add(imFlower);
  }

  // Compile all merged East City PBR assemblies cleanly
  const built = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  group.add(built.group);
  ctx.geometries.push(...built.geometries);
  ctx.materials.push(...built.materials);
  ctx.shootableEnv.push(built.group);

  // ---------------------------------------------------------------------------
  // 10. ANIMATION UPDATERS (Ships, Boats, Jet, ATC Radar, Balloons, Heli, Windmill, Dragon, Crane, Ferris)
  // ---------------------------------------------------------------------------
  ctx.updaters.push((dt, elapsed) => {
    // 1. Ocean Ships & Boats
    for (let i = 0; i < animatedShips.length; i++) {
      const sh = animatedShips[i];
      const span = sh.zMax - sh.zMin;
      const cycle = ((elapsed * sh.speed + sh.phase * 22) % (span * 2) + span * 2) % (span * 2);
      const forward = cycle <= span;
      const z = forward ? sh.zMin + cycle : sh.zMax - (cycle - span);
      sh.mesh.position.set(
        sh.laneX,
        sh.waterY + Math.sin(elapsed * 1.6 + sh.phase) * 0.14,
        z,
      );
      sh.mesh.rotation.y = forward ? 0 : Math.PI;
      sh.mesh.rotation.z = Math.sin(elapsed * 1.1 + sh.phase) * 0.025;
    }

    // 2. Airport Spinning Radar & Taking-Off / Climbing / Circling Airliner
    atcRadar.rotation.y += dt * 1.8;
    {
      // 36s cycle: 0..10s accelerate along runway E -> 10..15s climb out -> 15..32s sky loop -> 32..36s approach
      const c = (elapsed % 36) / 36;
      if (c < 0.28) {
        const t = c / 0.28;
        const speedT = t * t;
        flyingAirliner.position.set(1172 + speedT * 240, 0, -260);
        flyingAirliner.rotation.set(t > 0.78 ? -(t - 0.78) * 0.9 : 0, Math.PI * 0.5, 0);
      } else if (c < 0.44) {
        const t = (c - 0.28) / 0.16;
        flyingAirliner.position.set(1412 + t * 90, t * 44, -260 + t * 35);
        flyingAirliner.rotation.set(-0.22, Math.PI * 0.5 - t * 0.65, -0.18 * t);
      } else {
        const t = (c - 0.44) / 0.56;
        const ang = t * Math.PI * 2;
        const ax = 1280 + Math.cos(ang) * 195;
        const az = -110 + Math.sin(ang) * 165;
        const alt = 44 + Math.sin(t * Math.PI) * 18;
        const dx = -Math.sin(ang) * 195;
        const dz = Math.cos(ang) * 165;
        flyingAirliner.position.set(ax, alt, az);
        flyingAirliner.rotation.set(0, Math.atan2(dx, dz), -0.18);
      }
    }

    // 3. Hot Air Balloons gentle sky drift (owned by WorldWildlifeController when shootableBalloons is provided)
    if (!ctx.shootableBalloons) {
      for (let i = 0; i < hotAirBalloons.length; i++) {
        const hb = hotAirBalloons[i];
        hb.group.position.set(
          hb.bx + Math.sin(elapsed * 0.18 + hb.phase) * hb.ampX,
          hb.by + Math.sin(elapsed * 0.65 + hb.phase) * 2.2,
          hb.bz + Math.cos(elapsed * 0.15 + hb.phase) * hb.ampZ,
        );
        hb.group.rotation.y = Math.sin(elapsed * 0.22 + hb.phase) * 0.45;
      }
    }

    // 4. Ambient Patrol Helicopter over Isometric City & Castle
    {
      const hAng = elapsed * 0.34;
      const hx = 1285 + Math.cos(hAng) * 105;
      const hz = 10 + Math.sin(hAng) * 95;
      ambientHeli.position.set(hx, 38 + Math.sin(elapsed * 1.1) * 1.8, hz);
      ambientHeli.rotation.y = Math.atan2(-Math.sin(hAng) * 105, Math.cos(hAng) * 95);
      heliRotorMain.rotation.y += dt * 22;
      heliRotorTail.rotation.x += dt * 28;
    }

    // 5. Castle Windmill, Civic Ferris Wheel, Crane & Ring Smokestack Steam
    windmillBlades.rotation.z -= dt * 0.85;
    civicWheelRotor.rotation.z += dt * 0.3;
    eastCraneJib.rotation.y = Math.sin(elapsed * 0.28) * 0.95;

    for (let i = 0; i < smokePuffsEast.length; i++) {
      const sp = smokePuffsEast[i];
      const cyc = ((elapsed * 0.45 + sp.phase) % 1 + 1) % 1;
      sp.mesh.position.set(sp.x + Math.sin(cyc * 5) * 0.6, sp.y + cyc * 9.0, sp.z + Math.cos(cyc * 4) * 0.4);
      const sc = 0.7 + cyc * 1.9;
      sp.mesh.scale.set(sc, sc * 0.85, sc);
    }

    // 6. Undulating Chinatown Festival Dragon Dance + Night Sky Fireworks
    for (let d = 0; d < dragonSegments.length; d++) {
      const t = elapsed * 1.35 - d * 0.14;
      const dx = 955 + Math.sin(t) * 24;
      const dz = 205 + Math.sin(t * 2) * 8;
      const dy = 1.65 + Math.abs(Math.sin(elapsed * 4.5 - d * 0.45)) * 1.1;
      dragonSegments[d].position.set(dx, dy, dz);
      dragonSegments[d].rotation.y = Math.atan2(Math.cos(t) * 24, Math.cos(t * 2) * 16);
    }

    // Huge Chinatown Night-Sky Fireworks (active brightly at dusk/night, gentle twilight test glow during sunset)
    const isNightShow = pal.windowDayNight.emissiveIntensity >= 0.25;
    for (let i = 0; i < fireworkBursts.length; i++) {
      const fw = fireworkBursts[i];
      if (!isNightShow) {
        fw.group.visible = false;
        continue;
      }
      fw.group.visible = true;
      const cyc = ((elapsed + fw.offset) % fw.period) / fw.period;
      if (cyc < 0.24) {
        // Ascending rocket trail
        const riseT = cyc / 0.24;
        fw.rocket.visible = true;
        fw.rocket.position.set(fw.cx, 8 + riseT * (fw.cy - 8), fw.cz);
        fw.mat.opacity = 0.95;
        for (let s = 0; s < fw.stars.length; s++) fw.stars[s].visible = false;
      } else {
        // Massive colorful spherical starburst (26m radius!)
        const burstT = (cyc - 0.24) / 0.76;
        const spread = (1 - (1 - burstT) * (1 - burstT)) * 26.0;
        const gravY = -burstT * burstT * 10.5;
        fw.rocket.visible = false;
        fw.mat.opacity = Math.max(0, 1 - burstT * 1.08);
        const starScale = (1 - burstT * 0.65) * 1.15;
        for (let s = 0; s < fw.stars.length; s++) {
          const dir = fwDirs[s];
          const st = fw.stars[s];
          st.visible = true;
          st.position.set(
            fw.cx + dir[0] * spread,
            fw.cy + dir[1] * spread + gravY,
            fw.cz + dir[2] * spread,
          );
          st.scale.setScalar(Math.max(0.15, starScale));
        }
      }
    }
  });

  // East District Shopping Mall (1092, -212) & Modern City Park (875, -212)
  const eastMalls: MallNavData[] = [];
  if (opts.buildMall) {
    eastMalls.push(
      opts.buildMall({
        id: 'mall_east_royal',
        name: 'EAST CROWN GALLERIA',
        cx: 1092,
        cz: -212,
        facadeHex: 0xfef3c7,
        trimHex: 0xf59e0b,
        floor1Hex: 0xfffbeb,
        floor2Hex: 0xfde68a,
        floor3Hex: 0xe0f2fe,
        accentHex: '#f59e0b',
      }),
    );
  }
  const eastParkBenches = opts.buildPark ? opts.buildPark(875, -212).benches : [];

  return {
    malls: eastMalls,
    parkBenches: eastParkBenches,
    intersections,
    signalVisuals,
    roadRectLoops: [
      { minX: 975, maxX: 1235, minZ: -148, maxZ: 0, clockwise: true },
      { minX: 815, maxX: 1105, minZ: 176, maxZ: 228, clockwise: false },
    ],
    roadCircleLoops: [
      { cx: EAST_RING_CENTER_X, cz: EAST_RING_CENTER_Z, radius: EAST_RING_OUTER_R, clockwise: true },
      { cx: EAST_RING_CENTER_X, cz: EAST_RING_CENTER_Z, radius: EAST_RING_INNER_R, clockwise: false },
    ],
    castleFootGuards,
    castleHorseGuards,
    castleInteriorSpots: [
      { x: 1278, z: 182, yaw: 0 },
      { x: 1288, z: 182, yaw: 0 },
      { x: 1278, z: 194, yaw: Math.PI },
      { x: 1288, z: 194, yaw: Math.PI },
      { x: 1294, z: 185, yaw: -Math.PI * 0.5 },
      { x: 1294, z: 191, yaw: -Math.PI * 0.5 },
    ],
    eastCitizenSpots: [
      { x: 890, z: 222, role: 'chinatown' },
      { x: 920, z: 224, role: 'chinatown' },
      { x: 940, z: 214, role: 'chinatown' },
      { x: 955, z: 232, role: 'chinatown' },
      { x: 972, z: 218, role: 'chinatown' },
      { x: 990, z: 226, role: 'chinatown' },
      { x: 1012, z: 214, role: 'chinatown' },
      { x: 1030, z: 230, role: 'chinatown' },
      { x: 1065, z: 224, role: 'chinatown' },
      { x: 955, z: 248, role: 'chinatown' },
      { x: 865, z: 210, role: 'chinatown' },
      { x: 1045, z: 210, role: 'chinatown' },
      { x: 1265, z: -158, role: 'airport' },
      { x: 1280, z: -158, role: 'airport' },
      { x: 1255, z: -185, role: 'airport' },
      { x: 1295, z: -156, role: 'airport' },
      { x: 1320, z: -178, role: 'airport' },
      { x: 1210, z: -170, role: 'airport' },
      { x: 952, z: -26, role: 'ring_park' },
      { x: 996, z: 28, role: 'ring_park' },
      { x: 940, z: 32, role: 'ring_park' },
      { x: 1005, z: -32, role: 'ring_park' },
      { x: 875, z: -212, role: 'ring_park' },
      { x: 865, z: -202, role: 'ring_park' },
      { x: 910, z: -115, role: 'ring_park' },
      { x: 1035, z: -115, role: 'ring_park' },
      { x: 910, z: 108, role: 'ring_park' },
      { x: 1035, z: 108, role: 'ring_park' },
      { x: 1222, z: 152, role: 'castle_villager' },
      { x: 1344, z: 162, role: 'castle_villager' },
      { x: 1340, z: 228, role: 'castle_villager' },
      { x: 1278, z: 188, role: 'castle_villager' },
      { x: 1292, z: 188, role: 'castle_villager' },
      { x: 1188, z: 188, role: 'castle_villager' },
      { x: 1245, z: 235, role: 'castle_villager' },
      { x: 1365, z: 190, role: 'castle_villager' },
      { x: 1240, z: isoRiverZ + 16, role: 'castle_villager' },
      { x: 1305, z: isoRiverZ - 16, role: 'castle_villager' },
    ],
    touristSpots: [
      { x: 798, z: -96, lookAtX: 834, lookAtZ: -96 },
      { x: 804, z: 104, lookAtX: 824, lookAtZ: 104 },
      { x: 955, z: 244, lookAtX: 955, lookAtZ: 274 },
      { x: 1144, z: 188, lookAtX: 1285, lookAtZ: 188 },
      { x: 1235, z: isoRiverZ + 14, lookAtX: 1310, lookAtZ: isoRiverZ },
    ],
    gardenSpots,
    drumPlacements: [
      [1184, -156],
      [1186, -156],
      [1352, -162],
      [1354, -162],
      [848, -62],
      [850, -62],
      [1045, -142],
      [1142, 18],
      [1246, -68],
      [1378, 122],
      [1112, 218],
      [882, 162],
    ],
  };
}
