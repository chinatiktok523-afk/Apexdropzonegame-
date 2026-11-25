import * as THREE from 'three';
import { addCollider, type BarrelActor } from './arena';
import {
  buildArchitecturalStaircase,
  placeHighwayOverpassWithUnderpass,
  placeModernGasStation,
  registerBreakableGlass,
  type CityPalette,
  type SimWorldBuildContext,
} from './buildingsAndTransit';
import {
  type ModernBuildingContext,
  placeModernBalconyTower,
  placeModernVilla,
} from './modernBuildings';
import type { VehicleKind } from '../types';
import type { MallNavData, SignalVisualGroup } from './simulatorNpcs';
import { createElevatorState, type GangBossStyleId, requestNextElevatorFloor, stepElevatorState } from './simulatorSystems';
import { addRoadMarkingsBatch, type CompiledPropMats, createPropPbrMaterials, PropMeshAssembler } from './urbanProps';

export const HOSPITAL_ELEVATOR_INFO = {
  x: 315,
  z: -102,
  f2Y: 5.2,
  cabHalfSpan: 2.1,
} as const;

export const BAY_CITY_AVENUE_X = [275, 355, 435, 515];
export const BAY_CITY_AVENUE_Z = [-140, 0, 140];

export function isOnBayCityRoad(x: number, z: number): boolean {
  if (x < 220 || x > 565) return false;
  // Seamless East-West avenues extending from x=220 through the Bay City & Bridge approach
  for (let i = 0; i < BAY_CITY_AVENUE_Z.length; i++) {
    if (Math.abs(z - BAY_CITY_AVENUE_Z[i]) < 7.4 && x >= 220 && x <= 545) return true;
  }
  // North-South City Boulevards
  for (let i = 0; i < BAY_CITY_AVENUE_X.length; i++) {
    if (Math.abs(x - BAY_CITY_AVENUE_X[i]) < 7.4 && Math.abs(z) <= 215) return true;
  }
  // Harbor & Suburb collector loops
  if (Math.abs(Math.abs(z) - 210) < 5.8 && x >= 270 && x <= 522) return true;
  return false;
}

export function getBayCityCoastHeight(x: number, _z: number): number {
  if (x <= 548) return 0;
  if (x <= 566) {
    const t = THREE.MathUtils.smoothstep(x, 548, 566);
    return THREE.MathUtils.lerp(0, -0.45, t);
  }
  if (x <= 758) {
    const westT = THREE.MathUtils.clamp((x - 566) / 26, 0, 1);
    const eastT = THREE.MathUtils.clamp((758 - x) / 26, 0, 1);
    const depth = Math.min(westT, eastT);
    return THREE.MathUtils.lerp(-0.45, -3.6, depth);
  }
  if (x <= 784) {
    const t = THREE.MathUtils.smoothstep(x, 758, 784);
    return THREE.MathUtils.lerp(-0.45, 0, t);
  }
  return 0;
}

function addCityBox(
  parent: THREE.Object3D,
  pal: CityPalette,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  opts?: { rotY?: number; rotX?: number; rotZ?: number; castShadow?: boolean },
): THREE.Mesh {
  const m = new THREE.Mesh(pal.boxGeo, mat);
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

function addBayPavedRoadStrip(
  parent: THREE.Object3D,
  pal: CityPalette,
  cx: number,
  cz: number,
  w: number,
  d: number,
  ySurface = 0.08,
): void {
  addCityBox(parent, pal, pal.slateAsphalt, cx, ySurface - 0.08, cz, w, 0.16, d);
  if (w >= d) {
    addCityBox(parent, pal, pal.concreteDeck, cx, ySurface - 0.075, cz - d * 0.5 - 0.35, w, 0.16, 0.7);
    addCityBox(parent, pal, pal.concreteDeck, cx, ySurface - 0.075, cz + d * 0.5 + 0.35, w, 0.16, 0.7);
  } else {
    addCityBox(parent, pal, pal.concreteDeck, cx - w * 0.5 - 0.35, ySurface - 0.075, cz, 0.7, 0.16, d);
    addCityBox(parent, pal, pal.concreteDeck, cx + w * 0.5 + 0.35, ySurface - 0.075, cz, 0.7, 0.16, d);
  }
}

export interface BayCityExpansionResult {
  malls: MallNavData[];
  gasStation: { x: number; z: number; fuelBays: Array<{ x: number; z: number; yaw: number }> };
  intersections: Array<{ x: number; z: number; offsetSec: number }>;
  signalVisuals: SignalVisualGroup[];
  roadRectLoops: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; clockwise: boolean }>;
  busStops: Array<{ x: number; z: number }>;
  houses: Array<{ x: number; z: number; doorX: number; doorZ: number }>;
  parkBenches: Array<{ x: number; z: number; yaw: number }>;
  hospitalBeds: Array<{ x: number; y: number; z: number; yaw: number }>;
  hospitalDoctorSpots: Array<{ x: number; y: number; z: number }>;
  showroomSpots: Array<{ x: number; z: number; yaw: number }>;
  beachLoungers: Array<{ x: number; y: number; z: number; yaw: number }>;
  residentSpots: Array<{ x: number; z: number }>;
  touristSpots: Array<{ x: number; z: number; lookAtX: number; lookAtZ: number }>;
  gardenSpots: Array<{ x: number; z: number }>;
  constructionSpots: Array<{ x: number; z: number }>;
  gangAnchors: Array<{ name: string; x: number; z: number; bossId: GangBossStyleId }>;
  drumPlacements: Array<[number, number]>;
  barrelsOut: BarrelActor[];
}

export function buildApexBayCityExpansion(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  modCtx: ModernBuildingContext,
  groundHeightAt: (x: number, z: number, y?: number) => number,
  opts: {
    buildMall: (cfg: {
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
    placeIntersectionSignals: (ix: number, iz: number, offsetSec: number) => SignalVisualGroup;
    sharedPropMats?: CompiledPropMats;
  },
): BayCityExpansionResult {
  const propMats = opts.sharedPropMats ?? createPropPbrMaterials(false);
  if (!opts.sharedPropMats) ctx.materials.push(...propMats.all);
  const pb = new PropMeshAssembler();
  const group = new THREE.Group();
  ctx.arenaGroup.add(group);
  ctx.lodDetailGroups.push({
    group,
    x: 415,
    y: 16,
    z: 0,
    radius: 235,
    maxDist: 340,
    tier: 'district',
  });

  // 1. SEAMLESS RAILWAY GRADE CROSSINGS AT x = 228 FOR z in {-140, 0, +140}
  BAY_CITY_AVENUE_Z.forEach((az) => {
    addCityBox(group, pal, pal.slateAsphalt, 228, 0.24, az, 12.0, 0.2, 13.8);
    addCityBox(group, pal, pal.concreteDeck, 228, 0.26, az - 7.1, 12.2, 0.24, 0.45);
    addCityBox(group, pal, pal.concreteDeck, 228, 0.26, az + 7.1, 12.2, 0.24, 0.45);
    ctx.ramps.push({
      minX: 221.5,
      maxX: 234.5,
      minZ: az - 7.0,
      maxZ: az + 7.0,
      axis: 'x',
      startCoord: 221.5,
      endCoord: 234.5,
      startY: 0.34,
      endY: 0.34,
    });
  });

  // 2. RAISED 3D ASPHALT ROADS, SIDEWALK CURBS & ROAD MARKINGS (strict height layering prevents intersection flicker)
  BAY_CITY_AVENUE_Z.forEach((az) => {
    addBayPavedRoadStrip(group, pal, 382.5, az, 325, 14.2, 0.078);
  });
  BAY_CITY_AVENUE_X.forEach((ax) => {
    addBayPavedRoadStrip(group, pal, ax, 0, 14.2, 428, 0.094);
  });
  addBayPavedRoadStrip(group, pal, 396, -210, 252, 11.4, 0.072);
  addBayPavedRoadStrip(group, pal, 396, 210, 252, 11.4, 0.072);

  const markings: Parameters<typeof addRoadMarkingsBatch>[1] = [];
  BAY_CITY_AVENUE_Z.forEach((az) => {
    markings.push({ kind: 'dash_line', x1: 220, z1: az, x2: 540, z2: az, color: 0xfacc15 });
  });
  BAY_CITY_AVENUE_X.forEach((ax) => {
    markings.push({ kind: 'dash_line', x1: ax, z1: -210, x2: ax, z2: 210, color: 0xfacc15 });
  });
  markings.push(
    { kind: 'dash_line', x1: 275, z1: -210, x2: 515, z2: -210, color: 0xe2e8f0 },
    { kind: 'dash_line', x1: 275, z1: 210, x2: 515, z2: 210, color: 0xe2e8f0 },
    { kind: 'parking_bays', x: 315, z: -72, count: 6, rotY: 0 },
    { kind: 'parking_bays', x: 395, z: 72, count: 6, rotY: 0 },
  );

  const intersections: Array<{ x: number; z: number; offsetSec: number }> = [];
  const signalVisuals: SignalVisualGroup[] = [];
  BAY_CITY_AVENUE_X.forEach((ix, xi) => {
    BAY_CITY_AVENUE_Z.forEach((iz, zi) => {
      const offsetSec = (xi * 3 + zi * 4) % 14;
      intersections.push({ x: ix, z: iz, offsetSec });
      signalVisuals.push(opts.placeIntersectionSignals(ix, iz, offsetSec));
      markings.push(
        { kind: 'crosswalk', x: ix, z: iz + 9.2, rotY: 0 },
        { kind: 'crosswalk', x: ix, z: iz - 9.2, rotY: 0 },
        { kind: 'crosswalk', x: ix + 9.2, z: iz, rotY: Math.PI * 0.5 },
        { kind: 'crosswalk', x: ix - 9.2, z: iz, rotY: Math.PI * 0.5 },
      );
    });
  });
  addRoadMarkingsBatch(group, markings, groundHeightAt, ctx.geometries, ctx.materials);

  // Prominent Dedicated Bay City Digital Screen: DEVELOPED BY AFTAB BALOCH DADU
  const bayCreatorMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'DEVELOPED BY AFTAB BALOCH DADU',
    subtitle: 'APEX BAY CITY · NEXT-GEN 3D SIMULATOR ENGINE',
    accentHex: '#38bdf8',
    lockTitle: true,
    intervalSec: 0.9,
  }).material;
  addCityBox(group, pal, pal.charcoalSteel, 336, 4.2, -16, 0.55, 8.4, 0.55);
  addCityBox(group, pal, pal.charcoalSteel, 348, 4.2, -16, 0.55, 8.4, 0.55);
  addCityBox(group, pal, pal.charcoalSteel, 342, 8.2, -16, 13.8, 5.2, 0.45);
  const bayCreatorScreen = addCityBox(group, pal, bayCreatorMat, 342, 8.2, -15.72, 13.0, 4.5, 0.14);
  bayCreatorScreen.castShadow = false;
  addCityBox(group, pal, bayCreatorMat, 342, 8.2, -16.28, 13.0, 4.5, 0.14, { rotY: Math.PI });
  addCollider(ctx.colliders, 336, 0, -16, 0.8, 8.4, 0.8);
  addCollider(ctx.colliders, 348, 0, -16, 0.8, 8.4, 0.8);

  // Elevated Highway Overpass with Ground Underpass along z=140 between x=355 and x=435
  placeHighwayOverpassWithUnderpass(ctx, pal, { x: 395, z: 140, spanW: 34, rampLen: 18, deckW: 11.2 });

  // Overhead Highway Sign Gantries ("DOWNTOWN | PARK | HARBOR") at 3 major entry portals
  [
    { x: 256, z: 0, title: 'APEX BAY CITY · DOWNTOWN ->', sub: 'HOSPITAL · BAY MALL · COASTAL BRIDGE', accent: '#38bdf8' },
    { x: 256, z: -140, title: 'CIVIC & HARBOR DISTRICT ->', sub: 'CITY HOSPITAL · POLICE HQ · FIRE STATION', accent: '#ef4444' },
    { x: 256, z: 140, title: 'BAY SUBURBS & OVERPASS ->', sub: 'CENTRAL PARK · AUTOMAX · BEACHFRONT', accent: '#22c55e' },
  ].forEach((gSpec) => {
    pb.addCylinder(0.28, 0.34, 7.6, 10, gSpec.x, 3.8, gSpec.z - 8.6, 0x334155, 'glossy');
    pb.addCylinder(0.28, 0.34, 7.6, 10, gSpec.x, 3.8, gSpec.z + 8.6, 0x334155, 'glossy');
    pb.addBox(gSpec.x, 7.2, gSpec.z, 0.45, 0.45, 17.8, 0x475569);
    addCollider(ctx.colliders, gSpec.x, 0, gSpec.z - 8.6, 0.65, 7.6, 0.65, 0, 'metal');
    addCollider(ctx.colliders, gSpec.x, 0, gSpec.z + 8.6, 0.65, 7.6, 0.65, 0, 'metal');
    const signMat = ctx.displays.createDisplayMaterial('city_billboard', {
      title: gSpec.title,
      subtitle: gSpec.sub,
      accentHex: gSpec.accent,
      intervalSec: 0.9,
    }).material;
    const signMesh = new THREE.Mesh(pal.boxGeo, signMat);
    signMesh.position.set(gSpec.x - 0.3, 6.45, gSpec.z);
    signMesh.rotation.y = -Math.PI * 0.5;
    signMesh.scale.set(11.5, 2.3, 0.24);
    group.add(signMesh);
  });

  // 3. CIVIC & EMERGENCY QUARTER (ENTERABLE 2-FLOOR CITY HOSPITAL + GLASS ELEVATOR ONLY, POLICE HQ, FIRE STATION, CITY HALL)
  const hospX = HOSPITAL_ELEVATOR_INFO.x;
  const hospZ = HOSPITAL_ELEVATOR_INFO.z;
  const hospF2Y = HOSPITAL_ELEVATOR_INFO.f2Y;
  const hospitalBeds: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  const hospitalDoctorSpots: Array<{ x: number; y: number; z: number }> = [
    { x: hospX - 5.2, y: 0, z: hospZ - 3.2 },
    { x: hospX + 6.5, y: 0, z: hospZ - 4.0 },
    { x: hospX - 6.8, y: hospF2Y, z: hospZ - 2.5 },
    { x: hospX + 6.8, y: hospF2Y, z: hospZ + 2.5 },
  ];

  // Ground floor marble slab + warm sandstone/teal outer walls with wide open North & South portals (x in [311.4..318.6])
  addCityBox(group, pal, pal.mallMarble, hospX, 0.06, hospZ, 30, 0.24, 22);
  pb.addBox(hospX - 9.2, 6.5, hospZ - 10.6, 11.6, 13.0, 0.7, 0xdbeafe);
  pb.addBox(hospX + 9.2, 6.5, hospZ - 10.6, 11.6, 13.0, 0.7, 0xdbeafe);
  pb.addBox(hospX, 8.6, hospZ - 10.6, 7.2, 8.8, 0.45, 0x0ea5e9, 'glass');
  pb.addBox(hospX - 9.2, 6.5, hospZ + 10.6, 11.6, 13.0, 0.7, 0xdbeafe);
  pb.addBox(hospX + 9.2, 6.5, hospZ + 10.6, 11.6, 13.0, 0.7, 0xdbeafe);
  pb.addBox(hospX, 8.6, hospZ + 10.6, 7.2, 8.8, 0.45, 0x0ea5e9, 'glass');
  pb.addBox(hospX - 14.6, 6.5, hospZ, 0.7, 13.0, 22, 0xbae6fd);
  pb.addBox(hospX + 14.6, 6.5, hospZ, 0.7, 13.0, 22, 0xbae6fd);
  // Teal & Coral architectural perimeter ribbons + Roof & Helipad (offset clear of outer wall Z=±10.95 & roof slab)
  pb.addBox(hospX, 5.2, hospZ + 11.02, 30.3, 0.65, 0.42, 0x0d9488, 'glossy');
  pb.addBox(hospX, 5.2, hospZ - 11.02, 30.3, 0.65, 0.42, 0x0d9488, 'glossy');
  pb.addBox(hospX, 13.25, hospZ, 30.8, 0.52, 22.8, 0x1e293b);
  addCityBox(group, pal, pal.tealAwning, hospX, 12.76, hospZ, 31.1, 0.3, 23.1);
  pb.addBox(hospX, 9.8, hospZ + 11.1, 4.4, 1.3, 0.3, 0xef4444, 'emissive');
  pb.addBox(hospX, 9.8, hospZ + 11.1, 1.3, 4.4, 0.3, 0xef4444, 'emissive');
  pb.addCylinder(4.8, 4.8, 0.12, 20, hospX, 13.52, hospZ, 0x1e293b);
  pb.addBox(hospX - 1.6, 13.6, hospZ, 0.7, 0.08, 4.8, 0xfacc15, 'emissive');
  pb.addBox(hospX + 1.6, 13.6, hospZ, 0.7, 0.08, 4.8, 0xfacc15, 'emissive');
  pb.addBox(hospX, 13.6, hospZ, 3.2, 0.08, 0.7, 0xfacc15, 'emissive');
  pb.addBox(hospX, 3.8, hospZ + 13.2, 8.8, 0.4, 5.2, 0x0ea5e9, 'glossy');

  // Hospital Reception Counter + Dual Mini Computer Screens
  pb.addBox(hospX - 6.0, 0.58, hospZ + 4.2, 5.2, 1.16, 1.4, 0x0284c7, 'glossy');
  pb.addBox(hospX - 6.0, 1.18, hospZ + 4.2, 5.4, 0.12, 1.5, 0xe0f2fe);
  const hospDeskMonMat = ctx.displays.createDisplayMaterial('mini_monitor', {
    title: 'TRIAGE QUEUE',
    subtitle: 'ER BAY 01 · READY',
    accentHex: '#38bdf8',
    intervalSec: 0.9,
  }).material;
  [-7.2, -4.8].forEach((mxOff) => {
    pb.addCylinder(0.05, 0.08, 0.32, 8, hospX + mxOff, 1.34, hospZ + 4.2, 0x334155);
    const mon = new THREE.Mesh(pal.boxGeo, hospDeskMonMat);
    mon.position.set(hospX + mxOff, 1.62, hospZ + 4.2);
    mon.scale.set(0.76, 0.46, 0.06);
    group.add(mon);
  });

  // Floor 2 Structural Slabs leaving centered 4.2m x 4.2m Elevator Shaft Cutout (x in [hospX-2.1..hospX+2.1], z in [hospZ-2.1..hospZ+2.1])
  [
    { minX: hospX - 14.3, maxX: hospX - 2.1, minZ: hospZ - 10.3, maxZ: hospZ + 10.3 }, // West Ward
    { minX: hospX + 2.1, maxX: hospX + 14.3, minZ: hospZ - 10.3, maxZ: hospZ + 10.3 }, // East Ward
    { minX: hospX - 2.1, maxX: hospX + 2.1, minZ: hospZ - 10.3, maxZ: hospZ - 2.1 }, // North Upper Landing
    { minX: hospX - 2.1, maxX: hospX + 2.1, minZ: hospZ + 2.1, maxZ: hospZ + 10.3 }, // South Upper Landing (Elevator Entry)
  ].forEach((ds) => {
    const w = ds.maxX - ds.minX;
    const d = ds.maxZ - ds.minZ;
    const midX = (ds.minX + ds.maxX) * 0.5;
    const midZ = (ds.minZ + ds.maxZ) * 0.5;
    addCityBox(group, pal, pal.mallMarble, midX, hospF2Y - 0.16, midZ, w, 0.32, d);
    ctx.ramps.push({
      minX: ds.minX,
      maxX: ds.maxX,
      minZ: ds.minZ,
      maxZ: ds.maxZ,
      axis: 'x',
      startCoord: ds.minX,
      endCoord: ds.maxX,
      startY: hospF2Y,
      endY: hospF2Y,
    });
    addCollider(ctx.colliders, midX, hospF2Y - 0.32, midZ, w, 0.28, d);
  });

  // Glass Balustrades enclosing West, East & North sides of 2F Elevator Shaft (South side +Z open for elevator doors)
  pb.addBox(hospX - 2.12, hospF2Y + 0.55, hospZ, 0.12, 1.1, 4.2, 0x93c5fd, 'glass');
  pb.addBox(hospX + 2.12, hospF2Y + 0.55, hospZ, 0.12, 1.1, 4.2, 0x93c5fd, 'glass');
  pb.addBox(hospX, hospF2Y + 0.55, hospZ - 2.12, 4.2, 1.1, 0.12, 0x93c5fd, 'glass');

  // Working Glass Hospital Elevator (1F y=0 <-> 2F y=5.2) centered at (hospX, hospZ), doors facing South (+Z)
  const hospLiftState = createElevatorState([0, hospF2Y]);
  const hospLift = new THREE.Group();
  hospLift.position.set(hospX, 0, hospZ);
  ctx.arenaGroup.add(hospLift);
  addCityBox(hospLift, pal, pal.tealAwning, 0, -0.06, 0, 3.8, 0.16, 3.8);
  addCityBox(hospLift, pal, pal.charcoalSteel, 0, 2.95, 0, 3.8, 0.18, 3.8);
  registerBreakableGlass(ctx, addCityBox(hospLift, pal, pal.glassClear, -1.85, 1.5, 0, 0.08, 2.8, 3.6));
  registerBreakableGlass(ctx, addCityBox(hospLift, pal, pal.glassClear, 1.85, 1.5, 0, 0.08, 2.8, 3.6));
  registerBreakableGlass(ctx, addCityBox(hospLift, pal, pal.glassClear, 0, 1.5, -1.85, 3.6, 2.8, 0.08));
  const hDoorL = registerBreakableGlass(ctx, addCityBox(hospLift, pal, pal.glassClear, -0.9, 1.45, 1.85, 1.75, 2.7, 0.08));
  const hDoorR = registerBreakableGlass(ctx, addCityBox(hospLift, pal, pal.glassClear, 0.9, 1.45, 1.85, 1.75, 2.7, 0.08));

  // Elevator shaft safety walls (full height on West, East, and North; South +Z open for boarding)
  addCollider(ctx.colliders, hospX - 2.04, 0, hospZ, 0.18, hospF2Y + 3.2, 4.1, 0, 'concrete');
  addCollider(ctx.colliders, hospX + 2.04, 0, hospZ, 0.18, hospF2Y + 3.2, 4.1, 0, 'concrete');
  addCollider(ctx.colliders, hospX, 0, hospZ - 2.04, 4.1, hospF2Y + 3.2, 0.18, 0, 'concrete');

  const hospLiftRamp = {
    minX: hospX - 2.05,
    maxX: hospX + 2.05,
    minZ: hospZ - 2.05,
    maxZ: hospZ + 2.05,
    axis: 'x' as const,
    startCoord: hospX - 2.05,
    endCoord: hospX + 2.05,
    startY: 0,
    endY: 0,
  };
  ctx.ramps.push(hospLiftRamp);
  ctx.updaters.push((dt) => {
    stepElevatorState(hospLiftState, dt, 3.2);
    hospLift.position.y = hospLiftState.currentY;
    hospLiftRamp.startY = hospLiftState.currentY;
    hospLiftRamp.endY = hospLiftState.currentY;
    const slide = hospLiftState.doorsOpenProgress * 1.35;
    hDoorL.position.x = -0.9 - slide;
    hDoorR.position.x = 0.9 + slide;
  });
  [0, hospF2Y].forEach((fy, fIdx) => {
    ctx.interactables.push({
      id: `bay_hospital_lift_${fIdx + 1}f`,
      x: hospX,
      y: fy,
      z: hospZ + 2.7,
      radius: 3.6,
      category: 'shop',
      getLabel: () => `Hospital Glass Elevator (${fIdx === 0 ? '1F -> 2F' : '2F -> 1F'})`,
      trigger: () => {
        const nextIdx = requestNextElevatorFloor(hospLiftState);
        return `Hospital Elevator -> Floor ${nextIdx + 1}`;
      },
    });
  });

  // 8 Detailed Hospital Patient Beds + Bedside Vitals Monitors & IV Drip Poles (4 Ground ER + 4 Floor-2 ICU)
  const hospVitalsMat = ctx.displays.createDisplayMaterial('mini_monitor', {
    title: 'VITALS · BPM 72',
    subtitle: 'SPO2 99% · STABLE',
    accentHex: '#22c55e',
    intervalSec: 1.0,
  }).material;
  const bedConfigs = [
    { x: hospX - 10.6, y: 0, z: hospZ - 5.2, yaw: 0 },
    { x: hospX - 6.2, y: 0, z: hospZ - 5.2, yaw: 0 },
    { x: hospX + 8.6, y: 0, z: hospZ - 5.2, yaw: 0 },
    { x: hospX + 10.6, y: 0, z: hospZ + 4.8, yaw: 0 },
    { x: hospX - 10.6, y: hospF2Y, z: hospZ - 5.2, yaw: 0 },
    { x: hospX - 6.2, y: hospF2Y, z: hospZ - 5.2, yaw: 0 },
    { x: hospX + 8.6, y: hospF2Y, z: hospZ - 5.2, yaw: 0 },
    { x: hospX + 10.6, y: hospF2Y, z: hospZ + 4.8, yaw: 0 },
  ];
  bedConfigs.forEach((b) => {
    hospitalBeds.push(b);
    pb.addBox(b.x, b.y + 0.34, b.z, 1.35, 0.22, 2.45, 0x475569, 'glossy'); // steel frame
    pb.addBox(b.x, b.y + 0.54, b.z, 1.24, 0.22, 2.32, 0xf8fafc); // white mattress
    pb.addBox(b.x, b.y + 0.68, b.z - 0.85, 0.85, 0.14, 0.48, 0xe2e8f0); // pillow
    pb.addBox(b.x, b.y + 0.66, b.z + 0.38, 1.26, 0.08, 1.35, 0x38bdf8); // hospital blanket
    pb.addBox(b.x, b.y + 0.68, b.z - 1.2, 1.32, 0.58, 0.08, 0x0284c7, 'glossy'); // headboard
    // IV drip stand & bedside monitor
    pb.addCylinder(0.03, 0.03, 1.75, 6, b.x - 0.88, b.y + 0.88, b.z - 0.7, 0x94a3b8, 'glossy');
    pb.addBox(b.x + 0.92, b.y + 0.62, b.z - 0.65, 0.45, 1.24, 0.45, 0x1e293b);
    const vitMesh = new THREE.Mesh(pal.boxGeo, hospVitalsMat);
    vitMesh.position.set(b.x + 0.92, b.y + 1.38, b.z - 0.65);
    vitMesh.scale.set(0.48, 0.36, 0.08);
    group.add(vitMesh);
    addCollider(ctx.colliders, b.x, b.y, b.z, 1.45, 1.0, 2.55);
  });

  // Perimeter Wall Colliders leaving North & South doorways passable (x in [311.4..318.6])
  addCollider(ctx.colliders, hospX - 9.2, 0, hospZ - 10.6, 11.6, 13.0, 0.85);
  addCollider(ctx.colliders, hospX + 9.2, 0, hospZ - 10.6, 11.6, 13.0, 0.85);
  addCollider(ctx.colliders, hospX - 9.2, 0, hospZ + 10.6, 11.6, 13.0, 0.85);
  addCollider(ctx.colliders, hospX + 9.2, 0, hospZ + 10.6, 11.6, 13.0, 0.85);
  addCollider(ctx.colliders, hospX, 4.2, hospZ - 10.6, 7.2, 8.8, 0.7);
  addCollider(ctx.colliders, hospX, 4.2, hospZ + 10.6, 7.2, 8.8, 0.7);
  addCollider(ctx.colliders, hospX - 14.6, 0, hospZ, 0.85, 13.0, 22);
  addCollider(ctx.colliders, hospX + 14.6, 0, hospZ, 0.85, 13.0, 22);
  addCollider(ctx.colliders, hospX, 12.9, hospZ, 30.8, 0.7, 22.8);

  const hospSign = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'APEX CITY HOSPITAL · ER & ICU 24H',
    subtitle: 'GLASS ELEVATOR TO FLOOR 2 · DOCTORS & MEDKIT CARE',
    accentHex: '#ef4444',
  }).material;
  const hSignMesh = new THREE.Mesh(pal.boxGeo, hospSign);
  hSignMesh.position.set(hospX, 4.75, hospZ + 15.6);
  hSignMesh.scale.set(8.8, 1.7, 0.22);
  group.add(hSignMesh);
  ctx.interactables.push({
    id: 'bay_hospital_er',
    x: hospX - 5.5,
    y: 0,
    z: hospZ + 2.4,
    radius: 4.5,
    category: 'dine',
    getLabel: () => 'City Hospital ER · Full Medkit (+100 HP)',
    trigger: (act) => {
      act.healPlayer(100, 100);
      return 'City Hospital Trauma Care: Full Health & Armor restored!';
    },
  });

  // B) POLICE HEADQUARTERS (x=395, z=-104) — Vibrant Steel-Blue & Cobalt Composite
  pb.addBox(395, 5.5, -104, 24, 11, 18, 0x3b82f6, 'solid');
  addCityBox(group, pal, pal.facadePanel, 395, 5.5, -104, 24.22, 10.8, 18.22);
  pb.addBox(395, 5.5, -104, 24.3, 6.2, 14.5, 0x7dd3fc, 'glass');
  pb.addBox(395, 9.8, -104, 24.5, 2.2, 18.5, 0x1e3a8a, 'glossy');
  pb.addBox(395, 11.2, -104, 25, 0.5, 19, 0x0f172a);
  pb.addBox(395, 11.7, -94.6, 12, 0.6, 0.4, 0x3b82f6, 'emissive');
  addCollider(ctx.colliders, 395, 0, -104, 24, 11.5, 18);
  const polSign = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'BAY CITY POLICE HQ',
    subtitle: 'PRECINCT 01 · RAPID RESPONSE',
    accentHex: '#3b82f6',
  }).material;
  const polMesh = new THREE.Mesh(pal.boxGeo, polSign);
  polMesh.position.set(395, 7.6, -94.6);
  polMesh.scale.set(11.0, 2.2, 0.25);
  group.add(polMesh);

  // C) FIRE STATION WITH HOSE TOWER (x=475, z=-106)
  pb.addBox(475, 4.5, -106, 22, 9, 16, 0xdc2626);
  addCityBox(group, pal, pal.facadeMasonry, 475, 4.5, -106, 22.18, 8.6, 16.18);
  pb.addBox(475, 9.2, -106, 23, 0.5, 17, 0x334155);
  pb.addBox(483, 9.5, -110, 4.5, 19, 4.5, 0xb91c1c);
  [-5.2, 2.0].forEach((bx) => {
    pb.addBox(475 + bx, 2.2, -97.8, 4.6, 4.2, 0.35, 0xfef08a, 'glossy');
  });
  addCollider(ctx.colliders, 475, 0, -106, 22, 9.5, 16);
  addCollider(ctx.colliders, 483, 0, -110, 4.6, 19, 4.6);

  // D) CITY HALL & BAY ACADEMY (x=475, z=-40) — Warm Travertine Sandstone, Terracotta & Gold Trim
  pb.addBox(475, 0.35, -40, 26, 0.7, 20, 0x94a3b8);
  pb.addBox(475, 5.2, -40, 22, 9.2, 15, 0xe7d6b9);
  for (let c = -8; c <= 8; c += 4) {
    pb.addCylinder(0.42, 0.46, 9.0, 12, 475 + c, 5.0, -31.8, 0xfef3c7);
  }
  pb.addBox(475, 10.4, -40, 24, 1.2, 17, 0x0f766e);
  pb.addCylinder(2.2, 2.4, 9.5, 12, 475, 15.5, -40, 0xd97706);
  pb.addCylinder(1.2, 1.2, 0.3, 16, 475, 17.5, -37.8, 0xfacc15, 'emissive', Math.PI * 0.5);
  addCollider(ctx.colliders, 475, 0, -40, 22.5, 11.0, 15.5);

  // 4. DOWNTOWN SKYSCRAPER DISTRICT (Enterable Elevator Tower + Stepped Diagrid Spires)
  // A) ENTERABLE ZENITH CORPORATE TOWER (x=315, z=-36) with Working Elevator & Architectural Stairs!
  const tx = 315;
  const tz = -36;
  const towerH = 24.0; // Sky Lounge Floor at y=12, Rooftop Observation Deck at y=24!
  pb.addBox(tx, 0.12, tz, 24, 0.24, 24, 0xe2e8f0);
  [-11.2, 11.2].forEach((cxOff) => {
    [-11.2, 11.2].forEach((czOff) => {
      pb.addBox(tx + cxOff, 18.0, tz + czOff, 1.6, 36.0, 1.6, 0x1e293b);
      addCollider(ctx.colliders, tx + cxOff, 0, tz + czOff, 1.8, 36.0, 1.8);
    });
  });
  pb.addBox(tx - 7.4, 12.0, tz + 11.4, 7.6, 24.0, 0.7, 0x334155);
  pb.addBox(tx + 7.4, 12.0, tz + 11.4, 7.6, 24.0, 0.7, 0x334155);
  pb.addBox(tx, 14.0, tz + 11.4, 7.2, 20.0, 0.5, 0x7dd3fc, 'glass');
  pb.addBox(tx, 12.0, tz - 11.4, 22.4, 24.0, 0.7, 0x7dd3fc, 'glass');
  pb.addBox(tx - 11.4, 12.0, tz, 0.7, 24.0, 22.4, 0x7dd3fc, 'glass');
  pb.addBox(tx + 11.4, 12.0, tz, 0.7, 24.0, 22.4, 0x7dd3fc, 'glass');
  addCollider(ctx.colliders, tx - 7.4, 0, tz + 11.4, 7.8, 24.0, 0.9);
  addCollider(ctx.colliders, tx + 7.4, 0, tz + 11.4, 7.8, 24.0, 0.9);
  addCollider(ctx.colliders, tx, 4.2, tz + 11.4, 7.2, 20.0, 0.7);
  addCollider(ctx.colliders, tx, 0, tz - 11.4, 22.4, 24.0, 0.85);
  addCollider(ctx.colliders, tx - 11.4, 0, tz, 0.85, 24.0, 22.4);
  addCollider(ctx.colliders, tx + 11.4, 0, tz, 0.85, 24.0, 22.4);

  [12.0, towerH].forEach((fy) => {
    pb.addBox(tx - 6.8, fy - 0.18, tz, 8.8, 0.36, 22.0, 0xcbd5e1);
    pb.addBox(tx + 6.8, fy - 0.18, tz, 8.8, 0.36, 22.0, 0xcbd5e1);
    pb.addBox(tx, fy - 0.18, tz + 6.8, 4.8, 0.36, 8.4, 0xe2e8f0);
    pb.addBox(tx, fy - 0.18, tz - 6.8, 4.8, 0.36, 8.4, 0xe2e8f0);
    [
      { minX: tx - 11.2, maxX: tx - 2.4, minZ: tz - 11.0, maxZ: tz + 11.0 },
      { minX: tx + 2.4, maxX: tx + 11.2, minZ: tz - 11.0, maxZ: tz + 11.0 },
      { minX: tx - 2.4, maxX: tx + 2.4, minZ: tz + 2.6, maxZ: tz + 11.0 },
      { minX: tx - 2.4, maxX: tx + 2.4, minZ: tz - 11.0, maxZ: tz - 2.6 },
    ].forEach((s) => {
      ctx.ramps.push({
        minX: s.minX,
        maxX: s.maxX,
        minZ: s.minZ,
        maxZ: s.maxZ,
        axis: 'x',
        startCoord: s.minX,
        endCoord: s.maxX,
        startY: fy,
        endY: fy,
      });
      addCollider(
        ctx.colliders,
        (s.minX + s.maxX) * 0.5,
        fy - 0.36,
        (s.minZ + s.maxZ) * 0.5,
        s.maxX - s.minX,
        0.32,
        s.maxZ - s.minZ,
      );
    });
    ctx.ramps.push({
      minX: tx - 2.1,
      maxX: tx + 2.1,
      minZ: tz + 1.85,
      maxZ: tz + 2.75,
      axis: 'z',
      startCoord: tz + 1.85,
      endCoord: tz + 2.75,
      startY: fy,
      endY: fy,
    });
    pb.addBox(tx, fy - 0.18, tz + 2.25, 4.2, 0.36, 0.9, 0xe2e8f0);
  });

  pb.addBox(tx, towerH + 0.55, tz + 11.2, 22.8, 1.1, 0.25, 0x93c5fd, 'glass');
  pb.addBox(tx, towerH + 0.55, tz - 11.2, 22.8, 1.1, 0.25, 0x93c5fd, 'glass');
  pb.addBox(tx - 11.2, towerH + 0.55, tz, 0.25, 1.1, 22.8, 0x93c5fd, 'glass');
  pb.addBox(tx + 11.2, towerH + 0.55, tz, 0.25, 1.1, 22.8, 0x93c5fd, 'glass');
  addCollider(ctx.colliders, tx, towerH, tz + 11.2, 22.8, 1.1, 0.35);
  addCollider(ctx.colliders, tx, towerH, tz - 11.2, 22.8, 1.1, 0.35);
  addCollider(ctx.colliders, tx - 11.2, towerH, tz, 0.35, 1.1, 22.8);
  addCollider(ctx.colliders, tx + 11.2, towerH, tz, 0.35, 1.1, 22.8);
  [-10.5, 10.5].forEach((sx) => {
    pb.addCylinder(0.4, 0.95, 12.0, 10, tx + sx, towerH + 6.0, tz - 10.5, 0x38bdf8, 'emissive');
  });

  // Architectural staircase 0 -> 12 -> 24 along East bay of Tower
  const towerStairGroup = new THREE.Group();
  towerStairGroup.position.set(tx, 0, tz);
  ctx.arenaGroup.add(towerStairGroup);
  ctx.lodDetailGroups.push({
    group: towerStairGroup,
    x: tx,
    y: 12,
    z: tz,
    radius: 28,
    maxDist: 160,
    tier: 'detail',
  });
  buildArchitecturalStaircase(towerStairGroup, ctx, pal, {
    ox: tx,
    oz: tz,
    stairX: 8.2,
    zStart: 8.5,
    zEnd: -8.5,
    yBottom: 0,
    yTop: 12.0,
    width: 2.8,
    stepCount: 20,
    railSides: 'left',
  });
  buildArchitecturalStaircase(towerStairGroup, ctx, pal, {
    ox: tx,
    oz: tz,
    stairX: -8.2,
    zStart: 8.5,
    zEnd: -8.5,
    yBottom: 12.0,
    yTop: towerH,
    width: 2.8,
    stepCount: 20,
    railSides: 'right',
  });

  // Animated Skyscraper Glass Elevator (0 -> 12 -> 24)
  const towerLiftState = createElevatorState([0, 12.0, towerH]);
  const towerLift = new THREE.Group();
  towerLift.position.set(tx, 0, tz);
  ctx.arenaGroup.add(towerLift);
  ctx.lodDetailGroups.push({
    group: towerLift,
    x: tx,
    y: 12,
    z: tz,
    radius: 18,
    maxDist: 160,
    tier: 'detail',
  });
  addCityBox(towerLift, pal, pal.warmGold, 0, -0.08, 0, 3.8, 0.16, 3.8);
  addCityBox(towerLift, pal, pal.charcoalSteel, 0, 2.95, 0, 3.8, 0.18, 3.8);
  registerBreakableGlass(ctx, addCityBox(towerLift, pal, pal.glassClear, -1.85, 1.5, 0, 0.08, 2.8, 3.6));
  registerBreakableGlass(ctx, addCityBox(towerLift, pal, pal.glassClear, 1.85, 1.5, 0, 0.08, 2.8, 3.6));
  registerBreakableGlass(ctx, addCityBox(towerLift, pal, pal.glassClear, 0, 1.5, -1.85, 3.6, 2.8, 0.08));
  const tDoorL = registerBreakableGlass(ctx, addCityBox(towerLift, pal, pal.glassClear, -0.9, 1.45, 1.85, 1.75, 2.7, 0.08));
  const tDoorR = registerBreakableGlass(ctx, addCityBox(towerLift, pal, pal.glassClear, 0.9, 1.45, 1.85, 1.75, 2.7, 0.08));
  const towerLiftRamp = {
    minX: tx - 1.9,
    maxX: tx + 1.9,
    minZ: tz - 1.9,
    maxZ: tz + 1.9,
    axis: 'x' as const,
    startCoord: tx - 1.9,
    endCoord: tx + 1.9,
    startY: 0,
    endY: 0,
  };
  ctx.ramps.push(towerLiftRamp);
  ctx.updaters.push((dt) => {
    stepElevatorState(towerLiftState, dt, 4.4);
    towerLift.position.y = towerLiftState.currentY;
    towerLiftRamp.startY = towerLiftState.currentY;
    towerLiftRamp.endY = towerLiftState.currentY;
    const slide = towerLiftState.doorsOpenProgress * 1.35;
    tDoorL.position.x = -0.9 - slide;
    tDoorR.position.x = 0.9 + slide;
  });
  [0, 12.0, towerH].forEach((fy, fIdx) => {
    ctx.interactables.push({
      id: `zenith_tower_lift_${fIdx}`,
      x: tx,
      y: fy,
      z: tz + 2.5,
      radius: 3.8,
      category: 'shop',
      getLabel: () => `Zenith Sky Lift (Floor ${fIdx + 1} -> Next)`,
      trigger: () => {
        const nextIdx = requestNextElevatorFloor(towerLiftState);
        return `Zenith Tower Lift -> Level ${nextIdx + 1}`;
      },
    });
  });

  // B) DIAGRID CORPORATE SPIRE & TWIN FINANCIAL TOWERS (x=395, z=-36)
  pb.addBox(395, 22, -36, 18, 44, 18, 0x1e293b, 'glossy');
  registerBreakableGlass(ctx, addCityBox(group, pal, pal.facadeGlass, 395, 22, -36, 18.25, 42, 18.25));
  addCityBox(group, pal, pal.tealAwning, 395, 14, -36, 18.6, 1.1, 18.6);
  addCityBox(group, pal, pal.amberAwning, 395, 29, -36, 18.6, 1.1, 18.6);
  pb.addBox(395, 45.5, -36, 11, 3, 11, 0x0f172a);
  pb.addCylinder(0.25, 0.55, 9, 10, 395, 51, -36, 0x38bdf8, 'emissive');
  addCollider(ctx.colliders, 395, 0, -36, 18.2, 44, 18.2);

  // 5. BAY MEGA-MALL (6TH SHOPPING MALL AT x=315, z=42) + PARKING DECK + AUTOMAX + GAS STATION
  const bayMall = opts.buildMall({
    id: 'mall_bay_city',
    name: 'BAY MEGA-MALL',
    cx: 315,
    cz: 42,
    facadeHex: 0xf1f5f9,
    trimHex: 0x0ea5e9,
    floor1Hex: 0xf8fafc,
    floor2Hex: 0xe0f2fe,
    floor3Hex: 0xfef3c7,
    accentHex: '#0ea5e9',
  });

  // MULTI-LEVEL PARKING DECK (x=315, z=102) with Drivable Vehicle Ramp!
  const px = 315;
  const pz = 102;
  pb.addBox(px, 0.14, pz, 28, 0.28, 22, 0x475569);
  pb.addBox(px - 2.5, 4.1, pz, 23, 0.36, 22, 0x64748b);
  pb.addBox(px - 2.5, 8.1, pz, 23, 0.36, 22, 0x64748b);
  [-13.5, 13.5].forEach((cxOff) => {
    [-10.5, 10.5].forEach((czOff) => {
      pb.addCylinder(0.38, 0.42, 8.4, 10, px + cxOff, 4.2, pz + czOff, 0x334155);
      addCollider(ctx.colliders, px + cxOff, 0, pz + czOff, 0.85, 8.4, 0.85);
    });
  });
  pb.addBox(px, 4.8, pz - 10.8, 28, 1.0, 0.35, 0x94a3b8);
  pb.addBox(px, 4.8, pz + 10.8, 28, 1.0, 0.35, 0x94a3b8);
  addCollider(ctx.colliders, px, 4.2, pz - 10.8, 28, 1.1, 0.45);
  addCollider(ctx.colliders, px, 4.2, pz + 10.8, 28, 1.1, 0.45);
  addCityBox(group, pal, pal.slateAsphalt, px + 11.4, 2.05, pz, 4.8, 0.32, 20.5, { rotX: Math.atan2(4.1, 20) });
  ctx.ramps.push(
    { minX: px - 14, maxX: px + 9, minZ: pz - 11, maxZ: pz + 11, axis: 'x', startCoord: px - 14, endCoord: px + 9, startY: 4.28, endY: 4.28 },
    { minX: px + 9, maxX: px + 14, minZ: pz - 10.2, maxZ: pz + 10.2, axis: 'z', startCoord: pz + 10, endCoord: pz - 10, startY: 0, endY: 4.28 },
  );
  addCollider(ctx.colliders, px - 2.5, 3.9, pz, 23, 0.32, 22);

  // FLAGSHIP CAR SHOWROOM (x=395, z=36) — Open Walk-in Glass Pavilion, All 12 Cars, Small Computer Screens & Unlock Triggers!
  pb.addBox(395, 0.14, 36, 34, 0.28, 22, 0x1e293b);
  pb.addBox(395, 2.8, 25.3, 33.6, 5.4, 0.45, 0x0f172a);
  pb.addBox(378.4, 2.8, 36, 0.45, 5.4, 21.4, 0x38bdf8, 'glass');
  pb.addBox(411.6, 2.8, 36, 0.45, 5.4, 21.4, 0x38bdf8, 'glass');
  pb.addBox(395, 5.7, 36, 34.8, 0.5, 23.0, 0x0f172a);
  pb.addBox(395, 5.95, 47.4, 34.6, 0.22, 0.25, 0xf59e0b, 'emissive');
  addCollider(ctx.colliders, 395, 0, 25.3, 34, 5.6, 0.65);
  addCollider(ctx.colliders, 378.4, 0, 36, 0.65, 5.6, 21.4);
  addCollider(ctx.colliders, 411.6, 0, 36, 0.65, 5.6, 21.4);

  const showroomCatalog: Array<{ kind: VehicleKind; name: string; color: number; cost: number; lx: number; lz: number }> = [
    { kind: 'revuelto_red', name: 'Revuelto Crimson', color: 0xef4444, cost: 1200, lx: -12, lz: -5.5 },
    { kind: 'rolls_copper_gt', name: 'Aureus Copper GT', color: 0xd97706, cost: 1500, lx: -7.2, lz: -5.5 },
    { kind: 'vision_silver', name: 'Vision Aero', color: 0x94a3b8, cost: 1350, lx: -2.4, lz: -5.5 },
    { kind: 'range_black_suv', name: 'Monarch SUV', color: 0x1e293b, cost: 1100, lx: 2.4, lz: -5.5 },
    { kind: 'stealth_hyper', name: 'Stealth Hyper', color: 0x334155, cost: 2200, lx: 7.2, lz: -5.5 },
    { kind: 'challenger_scissor', name: 'Apex Scissor V8', color: 0xf97316, cost: 1400, lx: 12, lz: -5.5 },
    { kind: 'thar_black_4x4', name: 'Obsidian 4x4', color: 0x0f172a, cost: 950, lx: -12, lz: 4.5 },
    { kind: 'cyber_pickup', name: 'Cyber Steel Pickup', color: 0xcbd5e1, cost: 1300, lx: -7.2, lz: 4.5 },
    { kind: 'terzo_silver', name: 'Terzo Silver EV', color: 0x38bdf8, cost: 2400, lx: -2.4, lz: 4.5 },
    { kind: 'cyber_gold', name: 'Solaris Gold Truck', color: 0xfacc15, cost: 1900, lx: 2.4, lz: 4.5 },
    { kind: 'lambo_blue_hyper', name: 'Cobalt Hyper', color: 0x2563eb, cost: 2600, lx: 7.2, lz: 4.5 },
    { kind: 'gullwing_coupe', name: 'Gullwing GT', color: 0x10b981, cost: 1800, lx: 12, lz: 4.5 },
  ];
  const showroomSpots: Array<{ x: number; z: number; yaw: number }> = [
    { x: 395, z: 36, yaw: 0 },
    { x: 386, z: 33.5, yaw: -Math.PI * 0.35 },
    { x: 404, z: 33.5, yaw: Math.PI * 0.35 },
    { x: 388, z: 42.5, yaw: Math.PI * 0.7 },
    { x: 402, z: 42.5, yaw: -Math.PI * 0.7 },
    { x: 395, z: 48.0, yaw: Math.PI },
  ];
  const srMonMat = ctx.displays.createDisplayMaterial('mini_monitor', {
    title: 'CAR SHOWROOM OS',
    subtitle: 'PAY CREDITS TO UNLOCK',
    accentHex: '#f59e0b',
    intervalSec: 0.9,
  }).material;

  showroomCatalog.forEach((sc, idx) => {
    const sx = 395 + sc.lx;
    const sz = 36 + sc.lz;
    pb.addCylinder(1.65, 1.78, 0.22, 16, sx, 0.25, sz, 0x334155, 'glossy');
    pb.addCylinder(1.68, 1.68, 0.06, 16, sx, 0.37, sz, 0xf59e0b, 'emissive');
    pb.addBox(sx, 0.68, sz, 1.4, 0.46, 2.7, sc.color, 'glossy');
    pb.addBox(sx, 1.04, sz - 0.15, 1.15, 0.34, 1.45, 0x7dd3fc, 'glass');
    addCollider(ctx.colliders, sx, 0, sz, 1.6, 1.25, 2.9);
    // Small computer sales pedestal beside car
    pb.addCylinder(0.06, 0.1, 0.92, 8, sx + 1.45, 0.6, sz + 0.9, 0x475569);
    const deskScreen = new THREE.Mesh(pal.boxGeo, srMonMat);
    deskScreen.position.set(sx + 1.45, 1.18, sz + 0.9);
    deskScreen.rotation.x = -0.35;
    deskScreen.scale.set(0.62, 0.38, 0.06);
    group.add(deskScreen);

    ctx.interactables.push({
      id: `showroom_unlock_${sc.kind}_${idx}`,
      x: sx,
      y: 0,
      z: sz + 1.75,
      radius: 2.35,
      category: 'shop',
      getLabel: () => `Unlock & Drive ${sc.name} ($${sc.cost})`,
      trigger: (act) => {
        if (act.unlockShowroomCar) {
          return act.unlockShowroomCar(sc.kind, sc.cost, 395 + ((idx % 4) - 1.5) * 4.5, 54.0, sc.name);
        }
        return `${sc.name} Showroom Showcase ($${sc.cost})`;
      },
    });
  });

  // Central Showroom Computer Sales Counter with Twin Small Screens
  pb.addBox(395, 0.56, 35.5, 4.8, 1.12, 1.35, 0x0f172a, 'glossy');
  [-1.2, 1.2].forEach((dx) => {
    const mon = new THREE.Mesh(pal.boxGeo, srMonMat);
    mon.position.set(395 + dx, 1.42, 35.5);
    mon.scale.set(0.75, 0.45, 0.06);
    group.add(mon);
  });
  addCollider(ctx.colliders, 395, 0, 35.5, 4.9, 1.2, 1.4);

  const autoSign = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'CAR SHOWROOM · ALL 12 MODELS',
    subtitle: 'UNLOCK ANY SUPERCAR & DRIVE TODAY',
    accentHex: '#f59e0b',
    lockTitle: true,
  }).material;
  const autoSignMesh = new THREE.Mesh(pal.boxGeo, autoSign);
  autoSignMesh.position.set(395, 7.1, 47.6);
  autoSignMesh.scale.set(16.0, 2.5, 0.25);
  group.add(autoSignMesh);

  // 4th Modern Gas Station inside Apex Bay City (x=395, z=102)
  const bayGas = placeModernGasStation(ctx, pal, {
    x: 395,
    z: 102,
    idPrefix: 'bay_city_south',
    accentHex: 0x0ea5e9,
  });

  // 6. BRICK-FENCED CITY CENTRAL PARK (x=475, z=42) + COMMERCIAL PLAZA
  const cpkX = 475;
  const cpkZ = 42;
  pb.addBox(cpkX, 0.08, cpkZ, 44, 0.16, 48, 0x4ca64c);
  [-22, 22].forEach((fx) => {
    pb.addBox(cpkX + fx, 0.75, cpkZ, 0.55, 1.5, 48, 0x9a3412);
    addCollider(ctx.colliders, cpkX + fx, 0, cpkZ, 0.7, 1.5, 48);
  });
  [-24, 24].forEach((fz) => {
    [-13.5, 13.5].forEach((fx) => {
      pb.addBox(cpkX + fx, 0.75, cpkZ + fz, 17, 1.5, 0.55, 0x9a3412);
      addCollider(ctx.colliders, cpkX + fx, 0, cpkZ + fz, 17, 1.5, 0.7);
    });
  });
  // Circular Tiered Stone Fountain
  pb.addCylinder(4.6, 4.9, 0.75, 20, cpkX, 0.38, cpkZ, 0xe2e8f0);
  pb.addCylinder(3.8, 3.8, 0.22, 20, cpkX, 0.8, cpkZ, 0x0ea5e9, 'glass');
  pb.addCylinder(0.65, 0.85, 2.2, 14, cpkX, 1.85, cpkZ, 0xf8fafc);
  pb.addCylinder(1.8, 1.4, 0.3, 16, cpkX, 2.8, cpkZ, 0xe2e8f0);
  addCollider(ctx.colliders, cpkX, 0, cpkZ, 8.8, 1.5, 8.8);

  const parkBenches: Array<{ x: number; z: number; yaw: number }> = [
    { x: cpkX - 10, z: cpkZ - 8, yaw: Math.PI * 0.5 },
    { x: cpkX + 10, z: cpkZ - 8, yaw: -Math.PI * 0.5 },
    { x: cpkX - 10, z: cpkZ + 8, yaw: Math.PI * 0.5 },
    { x: cpkX + 10, z: cpkZ + 8, yaw: -Math.PI * 0.5 },
  ];
  parkBenches.forEach((b) => {
    addCityBox(group, pal, pal.terracottaWood, b.x, 0.45, b.z, 2.2, 0.14, 0.7, { rotY: b.yaw });
    addCityBox(group, pal, pal.charcoalSteel, b.x, 0.22, b.z, 1.9, 0.4, 0.55, { rotY: b.yaw });
  });

  // Commercial Storefront Row (x=475, z=104): Cinema, Pizza Diner, Pharmacy, Barber
  [
    { x: 460, w: 12, hex: 0xbe185d, trim: pal.redAwning, title: 'STARLIGHT CINEMA' },
    { x: 474, w: 12, hex: 0xd97706, trim: pal.amberAwning, title: 'APEX PIZZA & CAFE' },
    { x: 488, w: 12, hex: 0x059669, trim: pal.tealAwning, title: 'BAY PHARMACY' },
  ].forEach((shop) => {
    pb.addBox(shop.x, 3.2, 104, shop.w, 6.4, 14, shop.hex);
    addCityBox(group, pal, pal.facadeMasonry, shop.x, 3.2, 104, shop.w + 0.14, 6.2, 14.14);
    addCityBox(group, pal, shop.trim, shop.x, 4.4, 111.3, shop.w + 0.5, 0.55, 1.8);
    pb.addBox(shop.x, 2.2, 111.1, shop.w - 2.4, 3.2, 0.24, 0xbae6fd, 'glass');
    addCollider(ctx.colliders, shop.x, 0, 104, shop.w, 6.4, 14.2);
    const sMat = ctx.displays.createDisplayMaterial('city_billboard', {
      title: shop.title,
      subtitle: 'OPEN 24 HOURS · BAY COMMERCIAL STRIP',
      accentHex: '#facc15',
    }).material;
    const sMesh = new THREE.Mesh(pal.boxGeo, sMat);
    sMesh.position.set(shop.x, 5.4, 111.2);
    sMesh.scale.set(shop.w - 1.2, 1.4, 0.2);
    group.add(sMesh);
  });

  // 7. HARBOR INDUSTRIAL WAREHOUSES (z = -182) & RESIDENTIAL SUBURBS (z = +182)
  [
    { x: 315, z: -182, hex: 0x475569 },
    { x: 395, z: -182, hex: 0x334155 },
    { x: 475, z: -182, hex: 0x0f766e },
  ].forEach((wh) => {
    pb.addBox(wh.x, 4.5, wh.z, 34, 9.0, 22, wh.hex);
    addCityBox(group, pal, pal.facadePanel, wh.x, 4.5, wh.z, 34.18, 8.8, 22.18);
    addCityBox(group, pal, pal.amberAwning, wh.x, 8.7, wh.z, 34.6, 0.45, 22.6);
    pb.addBox(wh.x, 9.4, wh.z, 35, 1.0, 23, 0x1e293b);
    addCollider(ctx.colliders, wh.x, 0, wh.z, 34, 9.5, 22);
  });

  // Residential Suburb Neighborhood (Apartments + Modern Villas)
  placeModernBalconyTower(modCtx, { x: 315, z: 184, rotY: Math.PI, w: 14, d: 18, enterable: true, label: 'Bay Residences' });
  placeModernVilla(modCtx, { x: 395, z: 184, rotY: Math.PI, label: 'Bay Villa' });
  placeModernVilla(modCtx, { x: 475, z: 184, rotY: Math.PI, label: 'Palm Villa' });

  const houses = [
    { x: 315, z: 184, doorX: 315, doorZ: 171 },
    { x: 395, z: 184, doorX: 395, doorZ: 171 },
    { x: 475, z: 184, doorX: 475, doorZ: 171 },
  ];

  // 8. COASTAL WATERFRONT BEACH, SUNBATHER LOUNGERS & UMBRELLAS, HARBOR PIER & RED SUSPENSION BRIDGE
  const sandGeo = new THREE.PlaneGeometry(36, 480);
  sandGeo.rotateX(-Math.PI / 2);
  ctx.geometries.push(sandGeo);
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.92, metalness: 0.02 });
  ctx.materials.push(sandMat);
  const sandMesh = new THREE.Mesh(sandGeo, sandMat);
  sandMesh.position.set(554, -0.04, 0);
  sandMesh.receiveShadow = true;
  group.add(sandMesh);

  // Coastal Beach Striped Umbrellas, Wooden Sun Loungers & Colorful Towels along Bay Waterfront
  const beachLoungers: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  const umbCols = [0xef4444, 0x0ea5e9, 0xf59e0b, 0x10b981];
  [-92, -62, -32, 22, 42, 92, 114, 138].forEach((bz, uIdx) => {
    const ux = 553.5 + (uIdx % 2) * 3.0;
    const uy = groundHeightAt(ux, bz, 0);
    pb.addCylinder(0.05, 0.05, 2.5, 8, ux, uy + 1.25, bz, 0xfef3c7);
    pb.addCone(1.85, 0.68, 12, ux, uy + 2.55, bz, umbCols[uIdx % umbCols.length]);
    [-1.1, 1.1].forEach((dz) => {
      const lx = ux + 1.4;
      const lz = bz + dz;
      const ly = groundHeightAt(lx, lz, 0);
      pb.addBox(lx, ly + 0.24, lz, 2.1, 0.14, 0.78, 0xb45309);
      pb.addBox(lx + 0.75, ly + 0.44, lz, 0.55, 0.12, 0.76, 0xf8fafc);
      pb.addBox(lx - 0.15, ly + 0.34, lz, 1.3, 0.05, 0.68, umbCols[(uIdx + 1) % umbCols.length]);
      beachLoungers.push({ x: lx, y: ly + 0.36, z: lz, yaw: -Math.PI * 0.5 });
    });
  });

  // Coastal Boardwalk Pier extending over water at z = 65 + Moored Boat
  pb.addBox(572, 0.65, 65, 36, 0.35, 6.2, 0x9a5b32);
  for (let pxOff = 556; pxOff <= 588; pxOff += 8) {
    pb.addCylinder(0.24, 0.28, 2.4, 8, pxOff, -0.5, 62.4, 0x5c4033);
    pb.addCylinder(0.24, 0.28, 2.4, 8, pxOff, -0.5, 67.6, 0x5c4033);
  }
  ctx.ramps.push({
    minX: 554,
    maxX: 590,
    minZ: 61.9,
    maxZ: 68.1,
    axis: 'x',
    startCoord: 554,
    endCoord: 590,
    startY: 0.82,
    endY: 0.82,
  });
  // Moored Harbor Yacht (extruded pointed bow)
  const yachtShape = new THREE.Shape();
  yachtShape.moveTo(-5.5, -1.9);
  yachtShape.lineTo(3.2, -1.9);
  yachtShape.lineTo(5.8, 0);
  yachtShape.lineTo(3.2, 1.9);
  yachtShape.lineTo(-5.5, 1.9);
  yachtShape.closePath();
  pb.addExtrude(yachtShape, 1.3, 0.1, 582, -0.2, 82, 0xf8fafc, 'glossy', -Math.PI * 0.5);
  pb.addBox(581, 0.9, 82, 6.5, 1.2, 2.8, 0x0ea5e9, 'glass');

  // COMPLETE GRAND RED SUSPENSION BRIDGE AT z = 0 (x in [524..796], high 8.2m ship clearance over ocean channel!)
  const bridgeWidth = 13.6;
  const bridgeRoadW = 10.6;
  // Span 1: West Approach Ramp (524..552: y 0 -> 3.6)
  addCityBox(group, pal, pal.concreteDeck, 538, 1.65, 0, Math.hypot(28, 3.6), 0.55, bridgeWidth, {
    rotZ: Math.atan2(3.6, 28),
  });
  addCityBox(group, pal, pal.slateAsphalt, 538, 1.95, 0, Math.hypot(28, 3.6), 0.1, bridgeRoadW, {
    rotZ: Math.atan2(3.6, 28),
  });
  ctx.ramps.push({
    minX: 524,
    maxX: 552,
    minZ: -6.2,
    maxZ: 6.2,
    axis: 'x',
    startCoord: 524,
    endCoord: 552,
    startY: 0,
    endY: 3.6,
  });

  // Span 2: West Climb Span (552..596: y 3.6 -> 8.2)
  addCityBox(group, pal, pal.concreteDeck, 574, 5.75, 0, Math.hypot(44, 4.6), 0.65, bridgeWidth, {
    rotZ: Math.atan2(4.6, 44),
  });
  addCityBox(group, pal, pal.slateAsphalt, 574, 6.1, 0, Math.hypot(44, 4.6), 0.1, bridgeRoadW, {
    rotZ: Math.atan2(4.6, 44),
  });
  ctx.ramps.push({
    minX: 552,
    maxX: 596,
    minZ: -6.2,
    maxZ: 6.2,
    axis: 'x',
    startCoord: 552,
    endCoord: 596,
    startY: 3.6,
    endY: 8.2,
  });

  // Span 3: Main High Center Channel Deck (596..730: y = 8.2m level!)
  pb.addBox(663, 7.82, 0, 134, 0.72, bridgeWidth, 0x475569);
  pb.addBox(663, 8.2, 0, 134, 0.1, bridgeRoadW, 0x2d333d);
  pb.addBox(663, 8.32, 0, 134, 0.14, 0.4, 0xfacc15);
  ctx.ramps.push({
    minX: 596,
    maxX: 730,
    minZ: -6.2,
    maxZ: 6.2,
    axis: 'x',
    startCoord: 596,
    endCoord: 730,
    startY: 8.2,
    endY: 8.2,
  });

  // Span 4: East Descent Span (730..768: y 8.2 -> 3.6)
  addCityBox(group, pal, pal.concreteDeck, 749, 5.75, 0, Math.hypot(38, 4.6), 0.65, bridgeWidth, {
    rotZ: -Math.atan2(4.6, 38),
  });
  addCityBox(group, pal, pal.slateAsphalt, 749, 6.1, 0, Math.hypot(38, 4.6), 0.1, bridgeRoadW, {
    rotZ: -Math.atan2(4.6, 38),
  });
  ctx.ramps.push({
    minX: 730,
    maxX: 768,
    minZ: -6.2,
    maxZ: 6.2,
    axis: 'x',
    startCoord: 730,
    endCoord: 768,
    startY: 8.2,
    endY: 3.6,
  });

  // Span 5: East Island Landing Ramp (768..796: y 3.6 -> 0)
  addCityBox(group, pal, pal.concreteDeck, 782, 1.65, 0, Math.hypot(28, 3.6), 0.55, bridgeWidth, {
    rotZ: -Math.atan2(3.6, 28),
  });
  addCityBox(group, pal, pal.slateAsphalt, 782, 1.95, 0, Math.hypot(28, 3.6), 0.1, bridgeRoadW, {
    rotZ: -Math.atan2(3.6, 28),
  });
  ctx.ramps.push({
    minX: 768,
    maxX: 796,
    minZ: -6.2,
    maxZ: 6.2,
    axis: 'x',
    startCoord: 768,
    endCoord: 796,
    startY: 3.6,
    endY: 0,
  });

  // Night-only multi-color architectural LED lighting for Red Suspension Bridge
  const mkBridgeNightMat = (dayHex: number, nightHex: number, nightIntensity: number) => {
    const m = new THREE.MeshStandardMaterial({
      color: dayHex,
      emissive: nightHex,
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.4,
    });
    ctx.materials.push(m);
    ctx.nightGlowMats?.push({ mat: m, dayHex, nightHex, nightIntensity });
    return m;
  };
  const bridgeAmberGlow = mkBridgeNightMat(0x94a3b8, 0xfbbf24, 2.3);
  const bridgeCyanGlow = mkBridgeNightMat(0x64748b, 0x22d3ee, 2.4);
  const bridgeMagentaGlow = mkBridgeNightMat(0x64748b, 0xf43f5e, 2.2);
  const bridgeEmeraldGlow = mkBridgeNightMat(0x64748b, 0x34d399, 2.2);
  const bridgeLedCycle = [bridgeCyanGlow, bridgeAmberGlow, bridgeMagentaGlow, bridgeEmeraldGlow];

  // 3 Giant Crimson Suspension Bridge Pylon Towers (x = 596, 663, 730) with Tubular Main Cables
  [596, 663, 730].forEach((bx) => {
    pb.addBox(bx, -2.0, 0, 5.5, 4.5, 16.5, 0x64748b);
    [-6.3, 6.3].forEach((bz) => {
      pb.addBox(bx, 16.5, bz, 2.2, 34.0, 2.2, 0xdc2626, 'glossy');
      pb.addBox(bx, 34.0, bz, 2.6, 1.2, 2.6, 0xb91c1c, 'glossy');
      addCityBox(group, pal, bridgeCyanGlow, bx, 21.0, bz * 1.19, 0.28, 22.0, 0.22);
      addCityBox(group, pal, bridgeMagentaGlow, bx, 35.15, bz, 1.4, 0.9, 1.4);
      addCollider(ctx.colliders, bx, 0, bz, 2.3, 34, 2.3);
    });
    pb.addBox(bx, 31.8, 0, 1.8, 2.2, 14.8, 0xdc2626, 'glossy');
    pb.addBox(bx, 22.8, 0, 1.5, 1.6, 14.8, 0xdc2626, 'glossy');
    pb.addBox(bx, 14.2, 0, 1.4, 1.4, 14.8, 0xb91c1c, 'glossy');
    addCityBox(group, pal, bridgeAmberGlow, bx, 35.0, 0, 0.7, 0.7, 13.0);
    addCityBox(group, pal, bridgeCyanGlow, bx, 22.8, 0, 1.62, 0.45, 14.9);
  });

  // Smooth Catenary Tubular Suspension Cables + Vertical Steel Suspenders + Guardrails + Night LEDs
  [-6.3, 6.3].forEach((bz) => {
    pb.addBox(663, 8.95, bz, 134, 1.35, 0.42, 0xdc2626);
    addCollider(ctx.colliders, 663, 8.0, bz, 134, 1.5, 0.55);
    addCityBox(group, pal, bridgeCyanGlow, 630, 9.68, bz, 66, 0.22, 0.28);
    addCityBox(group, pal, bridgeAmberGlow, 696, 9.68, bz, 66, 0.22, 0.28);

    const cablePts: THREE.Vector3[] = [];
    let nodeIdx = 0;
    for (let cx = 548; cx <= 776; cx += 4) {
      let cableY = 33.2;
      if (cx < 596) {
        const t = (cx - 548) / 48;
        cableY = THREE.MathUtils.lerp(4.5, 33.2, Math.pow(t, 1.55));
      } else if (cx <= 663) {
        const t = (cx - 596) / 67;
        cableY = 18.0 + 15.2 * Math.pow(Math.abs(t * 2 - 1), 1.8);
      } else if (cx <= 730) {
        const t = (cx - 663) / 67;
        cableY = 18.0 + 15.2 * Math.pow(Math.abs(t * 2 - 1), 1.8);
      } else {
        const t = (cx - 730) / 46;
        cableY = THREE.MathUtils.lerp(33.2, 4.5, Math.pow(t, 0.68));
      }
      cablePts.push(new THREE.Vector3(cx, cableY, bz));
      const deckY =
        cx < 596
          ? cx < 552
            ? THREE.MathUtils.lerp(0, 3.6, (cx - 524) / 28)
            : THREE.MathUtils.lerp(3.6, 8.2, (cx - 552) / 44)
          : cx <= 730
            ? 8.2
            : cx <= 768
              ? THREE.MathUtils.lerp(8.2, 3.6, (cx - 730) / 38)
              : THREE.MathUtils.lerp(3.6, 0, (cx - 768) / 28);
      const suspH = Math.max(0.5, cableY - deckY);
      pb.addCylinder(0.075, 0.075, suspH, 6, cx, deckY + suspH * 0.5, bz, 0xe2e8f0, 'glossy');
      if (nodeIdx % 2 === 0) {
        const ledMat = bridgeLedCycle[(nodeIdx / 2) % bridgeLedCycle.length];
        addCityBox(group, pal, ledMat, cx, cableY, bz, 0.55, 0.55, 0.55);
        addCityBox(group, pal, ledMat, cx, deckY + 1.35, bz, 0.45, 0.35, 0.45);
      }
      nodeIdx++;
    }
    pb.addTube(cablePts, 0.28, 44, 8, 0xb91c1c, 'glossy');
  });

  // Compile all Bay City PBR assemblies cleanly
  const built = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  group.add(built.group);
  ctx.geometries.push(...built.geometries);
  ctx.materials.push(...built.materials);
  ctx.shootableEnv.push(built.group);

  // Explosive Red Drums across Industrial Harbor, Fuel Station & City Gang Spots
  const drumPlacements: Array<[number, number]> = [
    [328, -168],
    [329.5, -168],
    [331, -168],
    [388, -166],
    [412, -166],
    [413.5, -166],
    [462, -166],
    [488, -172],
    [490, -172],
    [382, 102],
    [408, 102],
    [416, 108],
    [340, -64],
    [418, -64],
    [494, -64],
    [538, -22],
    [562, 42],
    [563.5, 42],
    [452, 114],
    [332, 108],
  ];
  const barrelsOut: BarrelActor[] = [];

  const busStops = [
    { x: 286, z: 22 },
    { x: 368, z: -22 },
    { x: 448, z: 96 },
    { x: 528, z: -22 },
  ];
  busStops.forEach((bs) => {
    addCityBox(group, pal, pal.charcoalSteel, bs.x, 1.4, bs.z, 3.8, 2.8, 0.22);
    registerBreakableGlass(ctx, addCityBox(group, pal, pal.glassClear, bs.x, 1.4, bs.z + 0.5, 3.8, 0.16, 1.4));
  });

  return {
    malls: [bayMall],
    gasStation: { x: 395, z: 102, fuelBays: bayGas.fuelBays },
    intersections,
    signalVisuals,
    roadRectLoops: [
      { minX: 275, maxX: 355, minZ: -140, maxZ: 0, clockwise: true },
      { minX: 355, maxX: 435, minZ: -140, maxZ: 0, clockwise: true },
      { minX: 275, maxX: 435, minZ: 0, maxZ: 140, clockwise: true },
      { minX: 435, maxX: 515, minZ: -140, maxZ: 140, clockwise: true },
    ],
    busStops,
    houses,
    parkBenches,
    hospitalBeds,
    hospitalDoctorSpots,
    showroomSpots,
    beachLoungers,
    residentSpots: [
      { x: 315, z: 170 },
      { x: 395, z: 170 },
      { x: 475, z: 170 },
      { x: 468, z: 116 },
      { x: 482, z: 116 },
      { x: 315, z: -18 },
    ],
    touristSpots: [
      { x: 562, z: 18, lookAtX: 585, lookAtZ: 0 },
      { x: 475, z: 32, lookAtX: 475, lookAtZ: 42 },
      { x: 315, z: -16, lookAtX: 315, lookAtZ: -36 },
    ],
    gardenSpots: [
      { x: 468, z: 34 },
      { x: 482, z: 50 },
      { x: 468, z: 50 },
    ],
    constructionSpots: [
      { x: 326, z: -164 },
      { x: 410, z: -162 },
    ],
    gangAnchors: [
      { name: 'Noir Trench Mafia', x: 338, z: -62, bossId: 'baron_noir' },
      { name: 'Lion Fur Bratva', x: 416, z: -62, bossId: 'don_lion' },
      { name: 'Golden Crescent Guard', x: 492, z: -62, bossId: 'emir_aurelius' },
      { name: 'Harbor Street Vipers', x: 556, z: -48, bossId: 'kaos_viper' },
    ],
    drumPlacements,
    barrelsOut,
  };
}
