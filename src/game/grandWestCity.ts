import * as THREE from 'three';
import {
  addCollider,
  type RaceCheckpointGate,
  type RampSurface,
  type SpeedBoostPad,
  type StuntScoreRing,
} from './arena';
import { addStairSideGuardColliders, registerBreakableGlass, type CityPalette, type SimWorldBuildContext } from './buildingsAndTransit';
import type { MallNavData, SignalVisualGroup } from './simulatorNpcs';
import { addRoadMarkingsBatch, type CompiledPropMats, createPropPbrMaterials, PropMeshAssembler } from './urbanProps';

export const WEST_GP_CENTER_X = -705;
export const WEST_GP_CENTER_Z = -165;
export const WEST_GP_RX = 132;
export const WEST_GP_RZ = 64;
export const WEST_GP_TRACK_LENGTH = 720;

export function sampleWestGrandPrixTrack(distMeters: number): {
  x: number;
  z: number;
  yaw: number;
} {
  const t = (((distMeters % WEST_GP_TRACK_LENGTH) + WEST_GP_TRACK_LENGTH) % WEST_GP_TRACK_LENGTH) / WEST_GP_TRACK_LENGTH;
  const ang = t * Math.PI * 2;
  // Smooth Formula-1 circuit shape with sweeping chicane along north/south straights
  const chicaneZ = Math.sin(ang * 2) * 14;
  const x = WEST_GP_CENTER_X + Math.cos(ang) * WEST_GP_RX;
  const z = WEST_GP_CENTER_Z + Math.sin(ang) * WEST_GP_RZ + chicaneZ;

  const eps = 0.002;
  const ang2 = ang + eps;
  const x2 = WEST_GP_CENTER_X + Math.cos(ang2) * WEST_GP_RX;
  const z2 = WEST_GP_CENTER_Z + Math.sin(ang2) * WEST_GP_RZ + Math.sin(ang2 * 2) * 14;
  const yaw = Math.atan2(x2 - x, z2 - z);
  return { x, z, yaw };
}

export function getWestStraitCoastHeight(x: number, z: number): number {
  // Western Ocean Strait between x=-265 (Central Map shoreline) and x=-444 (West Island East Coast)
  if (x >= -265) return 0;
  if (x <= -444) return 0;

  // East shoreline of Strait (Central West beach taper x in [-265..-284])
  if (x > -284) {
    const t = THREE.MathUtils.smoothstep(-x, 265, 284);
    return THREE.MathUtils.lerp(0, -3.8, t);
  }
  // West shoreline of Strait (West Island beach taper x in [-424..-444])
  if (x < -424) {
    const t = THREE.MathUtils.smoothstep(x, -444, -424);
    return THREE.MathUtils.lerp(0, -3.8, t);
  }
  // Channel Light Buoy Islet at (-355, -135)
  const buoyDist = Math.hypot(x + 355, z + 135);
  if (buoyDist < 20) {
    if (buoyDist <= 11) return 0.65;
    const t = THREE.MathUtils.smoothstep(buoyDist, 11, 20);
    return THREE.MathUtils.lerp(0.65, -3.8, t);
  }
  return -3.8;
}

export function getGrandWestCityGroundHeight(x: number, z: number): number {
  if (x > -444) {
    return getWestStraitCoastHeight(x, z);
  }

  let h = 0;

  // West Island outer shoreline taper into deep ocean
  const westOverflow = -1152 - x;
  const nsOverflow = Math.abs(z) - 306;
  const edgeOverflow = Math.max(westOverflow, nsOverflow);
  if (edgeOverflow > 0) {
    const t = THREE.MathUtils.smoothstep(edgeOverflow, 0, 26);
    h = THREE.MathUtils.lerp(0, -3.8, t);
  }

  // Helios Marina Cove carved water bay (x in [-790..-620], z in [205..320])
  if (x >= -792 && x <= -618 && z >= 198) {
    const dxNorm = (x + 705) / 82;
    const dzFactor = THREE.MathUtils.smoothstep(z, 198, 224);
    const coveMask = Math.max(0, 1 - dxNorm * dxNorm) * dzFactor;
    if (coveMask > 0.01) {
      h = Math.min(h, THREE.MathUtils.lerp(0, -2.6, Math.min(1, coveMask * 1.4)));
    }
  }

  // Sculpted Red-Rock Canyon Mesa Backdrop (far West x in [-1154..-1092], z in [32..282])
  if (x >= -1154 && x <= -1092 && z >= 32 && z <= 282) {
    const westSlope = 1 - THREE.MathUtils.smoothstep(x, -1154, -1140);
    const eastSlope = THREE.MathUtils.smoothstep(x, -1138, -1092);
    const envelopeX = (1 - westSlope) * (1 - eastSlope);
    const envZ =
      THREE.MathUtils.smoothstep(z, 32, 62) *
      (1 - THREE.MathUtils.smoothstep(z, 250, 282));
    const env = envelopeX * envZ;
    if (env > 0.01) {
      const mesaA = Math.exp(-((x + 1122) ** 2 / 480 + (z - 102) ** 2 / 860)) * 23.0;
      const mesaB = Math.exp(-((x + 1125) ** 2 / 520 + (z - 210) ** 2 / 940)) * 26.0;
      const plateau = 9.0 + Math.sin(z * 0.055) * 1.6;
      // Stepped sandstone mesa strata effect
      const rawMesa = env * (plateau + mesaA + mesaB);
      h = Math.max(h, Math.round(rawMesa * 0.5) * 2.0);
    }
  }

  return h;
}

export function isOnGrandWestRoad(x: number, z: number): boolean {
  // West Bridge highway span across ocean strait
  if (Math.abs(z) < 6.8 && x <= -246 && x >= -466) return true;

  if (x > -444 || x < -1110) return false;

  // Main East-West West Trunk Boulevard (z = 0, x in [-1020..-464])
  if (Math.abs(z) < 7.2 && x >= -1020 && x <= -464) return true;

  // North-South Waterfront / Biodome Arterial (x = -515, z in [-255..230])
  if (Math.abs(x + 515) < 6.8 && z >= -255 && z <= 230) return true;

  // North-South Spaceport & Pyramid Dividing Arterial (x = -895, z in [-255..255])
  if (Math.abs(x + 895) < 6.8 && z >= -255 && z <= 255) return true;

  // Southern Marina & Sun Pyramid Connector Boulevard (z = 175, x in [-975..-515])
  if (Math.abs(z - 175) < 6.6 && x >= -975 && x <= -515) return true;

  // Northern Cyber-Tokyo Spur Road (z = -245, x in [-895..-515])
  if (Math.abs(z + 245) < 6.4 && x >= -895 && x <= -515) return true;

  // Formula-1 Grand Prix Closed Circuit Track
  if (x >= -855 && x <= -555 && z >= -255 && z <= -75) {
    const dx = x - WEST_GP_CENTER_X;
    const ang = Math.atan2((z - WEST_GP_CENTER_Z) * (WEST_GP_RX / WEST_GP_RZ), dx);
    const idealZ = WEST_GP_CENTER_Z + Math.sin(ang) * WEST_GP_RZ + Math.sin(ang * 2) * 14;
    const idealX = WEST_GP_CENTER_X + Math.cos(ang) * WEST_GP_RX;
    if (Math.hypot(x - idealX, z - idealZ) < 8.4) return true;
  }

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

export interface GrandWestCityResult {
  malls: MallNavData[];
  parkBenches: Array<{ x: number; z: number; yaw: number }>;
  intersections: Array<{ x: number; z: number; offsetSec: number }>;
  signalVisuals: SignalVisualGroup[];
  roadRectLoops: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; clockwise: boolean }>;
  westCitizenSpots: Array<{
    x: number;
    z: number;
    role: 'spaceport' | 'biodome' | 'marina' | 'cyber_tokyo' | 'pyramid';
  }>;
  touristSpots: Array<{ x: number; z: number; lookAtX: number; lookAtZ: number }>;
  gardenSpots: Array<{ x: number; z: number }>;
  drumPlacements: Array<[number, number]>;
  boostPads: SpeedBoostPad[];
  stuntRings: StuntScoreRing[];
  raceCheckpoints: RaceCheckpointGate[];
}

export function buildGrandWestCity(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  groundHeightAt: (x: number, z: number, currentY?: number) => number,
  opts: {
    placeIntersectionSignals: (x: number, z: number, offsetSec: number) => SignalVisualGroup;
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
): GrandWestCityResult {
  const group = new THREE.Group();
  ctx.arenaGroup.add(group);
  ctx.lodDetailGroups.push({
    group,
    x: -760,
    y: 16,
    z: 0,
    radius: 420,
    maxDist: 300,
    tier: 'district',
  });

  const propMats = opts.sharedPropMats ?? createPropPbrMaterials(false);
  if (!opts.sharedPropMats) ctx.materials.push(...propMats.all);
  const pb = new PropMeshAssembler();
  const boostPads: SpeedBoostPad[] = [];
  const stuntRings: StuntScoreRing[] = [];
  const raceCheckpoints: RaceCheckpointGate[] = [];

  // ---------------------------------------------------------------------------
  // 1. GOLDEN-CYAN CABLE-STAYED SKY BRIDGE (x = -246..-464, z = 0, deck y = 9.0m)
  // ---------------------------------------------------------------------------
  const bridgeGoldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.34, metalness: 0.58 });
  const bridgeCyanMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    emissive: 0x06b6d4,
    emissiveIntensity: 0,
    roughness: 0.28,
    metalness: 0.45,
  });
  const bridgeAmberGlowMat = new THREE.MeshStandardMaterial({
    color: 0x78716c,
    emissive: 0xfbbf24,
    emissiveIntensity: 0,
    roughness: 0.28,
    metalness: 0.45,
  });
  const bridgeVioletGlowMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    emissive: 0xe879f9,
    emissiveIntensity: 0,
    roughness: 0.28,
    metalness: 0.45,
  });
  const bridgeEmeraldGlowMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    emissive: 0x34d399,
    emissiveIntensity: 0,
    roughness: 0.28,
    metalness: 0.45,
  });
  const cableSteelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.72 });
  ctx.materials.push(bridgeGoldMat, bridgeCyanMat, bridgeAmberGlowMat, bridgeVioletGlowMat, bridgeEmeraldGlowMat, cableSteelMat);
  ctx.nightGlowMats?.push(
    { mat: bridgeCyanMat, dayHex: 0x64748b, nightHex: 0x22d3ee, nightIntensity: 2.35 },
    { mat: bridgeAmberGlowMat, dayHex: 0x78716c, nightHex: 0xfbbf24, nightIntensity: 2.25 },
    { mat: bridgeVioletGlowMat, dayHex: 0x64748b, nightHex: 0xe879f9, nightIntensity: 2.2 },
    { mat: bridgeEmeraldGlowMat, dayHex: 0x64748b, nightHex: 0x34d399, nightIntensity: 2.2 },
  );

  // Approach Ramp East (x=-246 -> -286, y=0 -> 9.0)
  const rampYaw = Math.atan2(9.0, 40.0);
  const rampLen = Math.hypot(40.0, 9.0);
  addPart(group, pal.boxGeo, pal.slateAsphalt, -266, 4.15, 0, rampLen, 0.7, 13.6, { rotZ: -rampYaw });
  addPart(group, pal.boxGeo, bridgeGoldMat, -266, 4.9, -6.7, rampLen, 1.1, 0.36, { rotZ: -rampYaw });
  addPart(group, pal.boxGeo, bridgeGoldMat, -266, 4.9, 6.7, rampLen, 1.1, 0.36, { rotZ: -rampYaw });
  addPart(group, pal.boxGeo, bridgeAmberGlowMat, -266, 5.45, -6.7, rampLen, 0.2, 0.26, { rotZ: -rampYaw });
  addPart(group, pal.boxGeo, bridgeAmberGlowMat, -266, 5.45, 6.7, rampLen, 0.2, 0.26, { rotZ: -rampYaw });
  addCollider(ctx.colliders, -266, 0, -6.9, 40, 12, 0.65, 0, 'metal');
  addCollider(ctx.colliders, -266, 0, 6.9, 40, 12, 0.65, 0, 'metal');

  // Center Elevated Deck (x=-286 -> -424, y=9.0)
  addPart(group, pal.boxGeo, pal.slateAsphalt, -355, 8.65, 0, 138, 0.7, 13.6);
  addPart(group, pal.boxGeo, bridgeGoldMat, -355, 9.4, -6.7, 138, 1.1, 0.36);
  addPart(group, pal.boxGeo, bridgeGoldMat, -355, 9.4, 6.7, 138, 1.1, 0.36);
  addPart(group, pal.boxGeo, bridgeCyanMat, -355, 9.85, -6.7, 136, 0.24, 0.26);
  addPart(group, pal.boxGeo, bridgeCyanMat, -355, 9.85, 6.7, 136, 0.24, 0.26);
  addPart(group, pal.boxGeo, bridgeVioletGlowMat, -355, 8.5, -6.85, 136, 0.22, 0.2);
  addPart(group, pal.boxGeo, bridgeEmeraldGlowMat, -355, 8.5, 6.85, 136, 0.22, 0.2);
  addCollider(ctx.colliders, -355, 8.2, -6.9, 138, 2.2, 0.65, 0, 'metal');
  addCollider(ctx.colliders, -355, 8.2, 6.9, 138, 2.2, 0.65, 0, 'metal');

  // West Landing Ramp (x=-424 -> -464, y=9.0 -> 0)
  addPart(group, pal.boxGeo, pal.slateAsphalt, -444, 4.15, 0, rampLen, 0.7, 13.6, { rotZ: rampYaw });
  addPart(group, pal.boxGeo, bridgeGoldMat, -444, 4.9, -6.7, rampLen, 1.1, 0.36, { rotZ: rampYaw });
  addPart(group, pal.boxGeo, bridgeGoldMat, -444, 4.9, 6.7, rampLen, 1.1, 0.36, { rotZ: rampYaw });
  addPart(group, pal.boxGeo, bridgeAmberGlowMat, -444, 5.45, -6.7, rampLen, 0.2, 0.26, { rotZ: rampYaw });
  addPart(group, pal.boxGeo, bridgeAmberGlowMat, -444, 5.45, 6.7, rampLen, 0.2, 0.26, { rotZ: rampYaw });
  addCollider(ctx.colliders, -444, 0, -6.9, 40, 12, 0.65, 0, 'metal');
  addCollider(ctx.colliders, -444, 0, 6.9, 40, 12, 0.65, 0, 'metal');

  // Walkable RampSurfaces for smooth crossing in vehicles or on foot
  const bridgeRamps: RampSurface[] = [
    { minX: -286, maxX: -246, minZ: -6.8, maxZ: 6.8, axis: 'x', startCoord: -246, endCoord: -286, startY: 0, endY: 9.0 },
    { minX: -424, maxX: -286, minZ: -6.8, maxZ: 6.8, axis: 'x', startCoord: -286, endCoord: -424, startY: 9.0, endY: 9.0 },
    { minX: -464, maxX: -424, minZ: -6.8, maxZ: 6.8, axis: 'x', startCoord: -424, endCoord: -464, startY: 9.0, endY: 0 },
  ];
  ctx.ramps.push(...bridgeRamps);

  // Twin Diamond Stay-Cable Pylons & Fan Cables + Night-Only Multi-Color Strips
  const westBridgeGlows = [bridgeCyanMat, bridgeAmberGlowMat, bridgeVioletGlowMat, bridgeEmeraldGlowMat];
  [-318, -392].forEach((tx, pIdx) => {
    addPart(group, pal.boxGeo, pal.concreteDeck, tx, 2.2, 0, 6.5, 13.2, 16.0);
    [-7.1, 7.1].forEach((tz) => {
      addPart(group, pal.boxGeo, bridgeGoldMat, tx, 22, tz, 1.6, 44, 1.6, { castShadow: !ctx.isSoftwareGl });
      addPart(group, pal.boxGeo, bridgeCyanMat, tx, 43.2, tz, 2.1, 1.2, 2.1);
      addPart(group, pal.boxGeo, westBridgeGlows[(pIdx + 2) % westBridgeGlows.length], tx, 25, tz * 1.13, 0.35, 30, 0.25);
      // Fan stay cables
      for (let c = 1; c <= 4; c++) {
        const span = c * 11;
        const cableLen = Math.hypot(span, 26);
        const angle = Math.atan2(26, span);
        const glowMat = westBridgeGlows[(c + pIdx) % westBridgeGlows.length];
        addPart(group, pal.cylGeo, cableSteelMat, tx - span * 0.5, 22.5, tz * 0.94, 0.14, cableLen, 0.14, { rotZ: Math.PI * 0.5 - angle });
        addPart(group, pal.cylGeo, cableSteelMat, tx + span * 0.5, 22.5, tz * 0.94, 0.14, cableLen, 0.14, { rotZ: -(Math.PI * 0.5 - angle) });
        addPart(group, pal.boxGeo, glowMat, tx - span, 10.1, tz * 0.94, 0.45, 0.45, 0.45);
        addPart(group, pal.boxGeo, glowMat, tx + span, 10.1, tz * 0.94, 0.45, 0.45, 0.45);
      }
    });
    addPart(group, pal.boxGeo, bridgeGoldMat, tx, 38, 0, 1.5, 1.8, 15.8);
    addPart(group, pal.boxGeo, bridgeCyanMat, tx, 26, 0, 1.4, 1.4, 15.8);
    addPart(group, pal.boxGeo, bridgeAmberGlowMat, tx, 39.2, 0, 0.65, 0.5, 15.4);
  });

  // Animated Strait Boats & Yachts sailing under the West Bridge!
  const straitBoats: Array<{ mesh: THREE.Group; laneX: number; zMin: number; zMax: number; speed: number; phase: number; waterY: number }> = [];
  const createHydrofoilYacht = (hullHex: number, trimHex: number, scale: number) => {
    const bg = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: hullHex, roughness: 0.35, metalness: 0.28 });
    const trimMat = new THREE.MeshStandardMaterial({ color: trimHex, emissive: trimHex, emissiveIntensity: 0.35 });
    ctx.materials.push(hullMat, trimMat);
    addPart(bg, pal.boxGeo, hullMat, 0, 0.65, 0, 3.6 * scale, 1.3 * scale, 12.5 * scale);
    addPart(bg, pal.boxGeo, pal.whiteMarble, 0, 1.75, -0.6 * scale, 2.8 * scale, 1.1 * scale, 6.2 * scale);
    registerBreakableGlass(ctx, addPart(bg, pal.boxGeo, pal.glassClear, 0, 2.0, 2.4 * scale, 2.6 * scale, 0.7 * scale, 1.6 * scale));
    addPart(bg, pal.boxGeo, trimMat, 0, 1.25, 0, 3.8 * scale, 0.18 * scale, 11.8 * scale);
    group.add(bg);
    return bg;
  };
  straitBoats.push(
    { mesh: createHydrofoilYacht(0x0f172a, 0x22d3ee, 1.35), laneX: -355, zMin: -255, zMax: 255, speed: 9.2, phase: 0.4, waterY: -0.45 },
    { mesh: createHydrofoilYacht(0x1e3a8a, 0xfacc15, 1.1), laneX: -332, zMin: -255, zMax: 255, speed: 7.4, phase: 2.1, waterY: -0.45 },
    { mesh: createHydrofoilYacht(0xb91c1c, 0xfef08a, 1.0), laneX: -378, zMin: -230, zMax: 230, speed: 6.5, phase: 3.7, waterY: -0.45 },
  );

  // Channel Lighthouse Buoy Islet at (-355, -135)
  pb.addCylinder(8.0, 9.0, 1.2, 18, -355, 0.3, -135, 0x94a3b8, 'solid');
  for (let band = 0; band < 5; band++) {
    const rBot = THREE.MathUtils.lerp(2.2, 1.5, band / 5);
    const rTop = THREE.MathUtils.lerp(2.2, 1.5, (band + 1) / 5);
    pb.addCylinder(rTop, rBot, 2.0, 16, -355, 2.0 + band * 2.0, -135, band % 2 === 0 ? 0xef4444 : 0xf8fafc, 'glossy');
  }
  pb.addCylinder(1.2, 1.2, 1.2, 12, -355, 11.6, -135, 0x22d3ee, 'emissive');
  pb.addCone(1.5, 1.2, 12, -355, 12.8, -135, 0x1e293b, 'glossy');
  addCollider(ctx.colliders, -355, 0, -135, 4.5, 12, 4.5);

  // ---------------------------------------------------------------------------
  // 2. ZONE 1: CYBER-TOKYO & FORMULA-1 GRAND PRIX CIRCUIT (North-Central)
  // ---------------------------------------------------------------------------
  // Grand Prix Asphalt Loop + Alternating Red/White Rumble Curbs + Track Centerline
  const gpSteps = ctx.isSoftwareGl ? 72 : 112;
  const gpTileIm = new THREE.InstancedMesh(pal.boxGeo, pal.slateAsphalt, gpSteps);
  const gpDummy = new THREE.Object3D();
  const tileLen = (WEST_GP_TRACK_LENGTH / gpSteps) * 1.15;
  for (let i = 0; i < gpSteps; i++) {
    const d = (i / gpSteps) * WEST_GP_TRACK_LENGTH;
    const pt = sampleWestGrandPrixTrack(d);
    gpDummy.position.set(pt.x, 0.04, pt.z);
    gpDummy.rotation.set(0, pt.yaw, 0);
    gpDummy.scale.set(13.8, 0.08, tileLen);
    gpDummy.updateMatrix();
    gpTileIm.setMatrixAt(i, gpDummy.matrix);
    // Red/White F1 Curbs on outer/inner shoulders every segment
    const perpX = Math.cos(pt.yaw);
    const perpZ = -Math.sin(pt.yaw);
    const curbHex = i % 2 === 0 ? 0xdc2626 : 0xf8fafc;
    pb.addBox(pt.x + perpX * 7.2, 0.08, pt.z + perpZ * 7.2, 1.1, 0.14, 1.1, curbHex, 'solid', 0, pt.yaw);
    pb.addBox(pt.x - perpX * 7.2, 0.08, pt.z - perpZ * 7.2, 1.1, 0.14, 1.1, curbHex, 'solid', 0, pt.yaw);
  }
  gpTileIm.instanceMatrix.needsUpdate = true;
  gpTileIm.computeBoundingSphere();
  gpTileIm.receiveShadow = true;
  group.add(gpTileIm);

  // Grand Prix Start/Finish Checkered Gantry & Grandstand at (-705, -242)
  const startPt = sampleWestGrandPrixTrack(WEST_GP_TRACK_LENGTH * 0.75);
  const startG = new THREE.Group();
  startG.position.set(startPt.x, 0, startPt.z);
  startG.rotation.y = startPt.yaw;
  addPart(startG, pal.boxGeo, pal.charcoalSteel, -7.8, 4.0, 0, 1.1, 8.0, 1.2);
  addPart(startG, pal.boxGeo, pal.charcoalSteel, 7.8, 4.0, 0, 1.1, 8.0, 1.2);
  addPart(startG, pal.boxGeo, pal.charcoalSteel, 0, 7.6, 0, 17.2, 1.6, 2.2);
  const checkeredSignMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'APEX GRAND PRIX CIRCUIT · 6 GATES',
    subtitle: 'HIT NITRO PADS · COMPLETE FULL LAP FOR +500 PTS',
    accentHex: '#ef4444',
    intervalSec: 0.9,
  }).material;
  addPart(startG, pal.boxGeo, checkeredSignMat, 0, 7.6, 1.18, 14.5, 1.3, 0.14);
  group.add(startG);
  addCollider(ctx.colliders, startPt.x - 7.8, 0, startPt.z, 1.4, 8, 1.4, startPt.yaw, 'metal');
  addCollider(ctx.colliders, startPt.x + 7.8, 0, startPt.z, 1.4, 8, 1.4, startPt.yaw, 'metal');

  // Grandstand Bleachers & Pit Garages North of Track
  for (let tier = 0; tier < 4; tier++) {
    pb.addBox(-705, 0.6 + tier * 1.2, -262 - tier * 1.6, 44, 1.2, 3.2, tier === 3 ? 0xdc2626 : tier === 2 ? 0x38bdf8 : 0x334155);
  }
  addCollider(ctx.colliders, -705, 0, -264, 44.5, 5.2, 10.0);

  // 6 Sequential Glowing Race Checkpoint Gates around the Grand Prix Track!
  for (let c = 0; c < 6; c++) {
    const pt = sampleWestGrandPrixTrack((c / 6) * WEST_GP_TRACK_LENGTH);
    const gateMat = new THREE.MeshStandardMaterial({
      color: c === 0 ? 0x22c55e : 0x38bdf8,
      emissive: c === 0 ? 0x16a34a : 0x0284c7,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.65,
    });
    const gateGeo = new THREE.TorusGeometry(6.8, 0.35, 8, 22, Math.PI);
    ctx.geometries.push(gateGeo);
    ctx.materials.push(gateMat);
    const gateMesh = new THREE.Mesh(gateGeo, gateMat);
    gateMesh.position.set(pt.x, 0.2, pt.z);
    gateMesh.rotation.y = pt.yaw;
    group.add(gateMesh);
    raceCheckpoints.push({
      index: c,
      x: pt.x,
      z: pt.z,
      radius: 9.2,
      mesh: gateMesh,
    });
  }

  // Animated AI Formula-1 Race Cars racing cleanly around the GP loop!
  const f1Cars: Array<{ group: THREE.Group; offsetDist: number; speed: number; lateral: number }> = [];
  const f1Colors = [0xdc2626, 0x0ea5e9, 0xfacc15];
  f1Colors.forEach((colHex, idx) => {
    const cg = new THREE.Group();
    const f1Mat = new THREE.MeshStandardMaterial({ color: colHex, roughness: 0.25, metalness: 0.55 });
    ctx.materials.push(f1Mat);
    addPart(cg, pal.boxGeo, f1Mat, 0, 0.42, 0, 1.45, 0.45, 4.4);
    addPart(cg, pal.boxGeo, f1Mat, 0, 0.28, 2.2, 2.2, 0.16, 0.75); // Front wing
    addPart(cg, pal.boxGeo, pal.charcoalSteel, 0, 0.92, -1.9, 2.1, 0.16, 0.65); // Rear spoiler
    addPart(cg, pal.boxGeo, pal.charcoalSteel, 0, 0.72, -0.3, 0.65, 0.45, 1.4); // Cockpit + Halo
    [[-1.05, 1.4], [1.05, 1.4], [-1.05, -1.4], [1.05, -1.4]].forEach(([wx, wz]) => {
      addPart(cg, pal.cylGeo, pal.charcoalSteel, wx, 0.36, wz, 0.38, 0.42, 0.38, { rotZ: Math.PI * 0.5 });
    });
    group.add(cg);
    f1Cars.push({ group: cg, offsetDist: idx * 240, speed: 34 + idx * 3.5, lateral: (idx - 1) * 2.5 });
  });

  // Cyber-Tokyo Neon Skyscrapers, Hologram Monoliths & Torii Arches
  const cyberTowers: Array<{ x: number; z: number; h: number; w: number; d: number; trim: number }> = [
    { x: -570, z: -268, h: 36, w: 18, d: 16, trim: 0xec4899 },
    { x: -632, z: -268, h: 46, w: 20, d: 18, trim: 0x22d3ee },
    { x: -782, z: -268, h: 42, w: 20, d: 18, trim: 0xa855f7 },
    { x: -846, z: -268, h: 34, w: 18, d: 16, trim: 0xfacc15 },
    { x: -705, z: -165, h: 28, w: 24, d: 22, trim: 0x38bdf8 }, // Cyber-Tokyo Infield Spire
  ];
  cyberTowers.forEach((ct, idx) => {
    pb.addBox(ct.x, ct.h * 0.5, ct.z, ct.w, ct.h, ct.d, 0x1e293b, 'glossy');
    pb.addBox(ct.x, ct.h * 0.5, ct.z, ct.w + 0.16, ct.h * 0.78, ct.d - 2.4, 0x0f172a, 'glass');
    pb.addBox(ct.x, ct.h * 0.5, ct.z + ct.d * 0.52, 0.65, ct.h * 0.92, 0.28, ct.trim, 'emissive');
    pb.addBox(ct.x, ct.h + 1.2, ct.z, ct.w * 0.72, 1.4, ct.d * 0.72, ct.trim, 'emissive');
    addCollider(ctx.colliders, ct.x, 0, ct.z, ct.w + 0.5, ct.h, ct.d + 0.5);

    const screenMat = ctx.displays.createDisplayMaterial('city_billboard', {
      title: idx % 2 === 0 ? 'CYBER-TOKYO NEO PLAZA' : 'APEX FORMULA CIRCUIT',
      subtitle: 'HIGH-SPEED DISTRICT · NITRO & STUNT ARENA',
      accentHex: idx % 2 === 0 ? '#ec4899' : '#22d3ee',
      intervalSec: 0.95,
      phaseOffset: idx * 0.6,
    }).material;
    addPart(group, pal.boxGeo, screenMat, ct.x, 12 + idx * 2, ct.z + ct.d * 0.54, ct.w * 0.76, 5.2, 0.16);
  });

  // Neon Red-Gold Torii Gateway Archways in Cyber-Tokyo
  [
    { x: -545, z: -165, rotY: Math.PI * 0.5 },
    { x: -865, z: -165, rotY: Math.PI * 0.5 },
  ].forEach((tg) => {
    const g = new THREE.Group();
    g.position.set(tg.x, 0, tg.z);
    g.rotation.y = tg.rotY;
    addPart(g, pal.cylGeo, pal.redAwning, -4.5, 4.5, 0, 0.52, 9.0, 0.52);
    addPart(g, pal.cylGeo, pal.redAwning, 4.5, 4.5, 0, 0.52, 9.0, 0.52);
    addPart(g, pal.boxGeo, pal.charcoalSteel, 0, 8.9, 0, 12.8, 0.9, 1.35);
    addPart(g, pal.boxGeo, bridgeCyanMat, 0, 7.4, 0, 10.6, 0.55, 0.85);
    group.add(g);
    addCollider(ctx.colliders, tg.x, 0, tg.z, 2.2, 9, 10.5, tg.rotY, 'metal');
  });

  // Floating Animated 3D Hologram Rings in Cyber-Tokyo Infield
  const holoRingMat = new THREE.MeshBasicMaterial({ color: 0xec4899, wireframe: true });
  const holoGeo = new THREE.TorusGeometry(6.5, 0.4, 8, 20);
  ctx.geometries.push(holoGeo);
  ctx.materials.push(holoRingMat);
  const holoRingA = new THREE.Mesh(holoGeo, holoRingMat);
  holoRingA.position.set(-705, 36, -165);
  group.add(holoRingA);

  // Cyber-Tokyo Arcade Recharge Interactable
  ctx.interactables.push({
    id: 'west_cyber_arcade',
    x: -632,
    y: 0,
    z: -252,
    radius: 4.5,
    category: 'shop',
    getLabel: () => 'Cyber-Tokyo Nitro Tune & Armor Boost (+50 Armor/HP)',
    trigger: (act) => {
      act.healPlayer(50, 100);
      return 'Cyber-Tokyo Overcharge Applied (+50 HP & Full Stamina)';
    },
  });

  // ---------------------------------------------------------------------------
  // 3. ZONE 2: APEX SPACEPORT & INTERACTIVE ORBITAL ROCKET LAUNCH (Far NW)
  // ---------------------------------------------------------------------------
  const rocketX = -1035;
  const rocketZ = -125;
  // Launchpad concrete apron + flame trench
  pb.addBox(rocketX, 0.25, rocketZ, 38, 0.5, 38, 0x475569, 'solid');
  pb.addBox(rocketX - 24, 2.75, rocketZ, 3.0, 5.5, 18, 0x334155);
  pb.addBox(-1002, 0.75, -116, 2.2, 1.5, 1.2, 0x0f172a);
  pb.addBox(-1002, 1.55, -116, 1.8, 0.25, 0.9, 0x38bdf8, 'emissive');
  // Steel Umbilical Launch Gantry Tower (46m)
  pb.addBox(rocketX - 11, 23, rocketZ, 5.2, 46, 5.2, 0xdc2626, 'glossy');
  pb.addBox(rocketX - 6.5, 34, rocketZ, 6.2, 0.7, 1.4, 0x94a3b8);
  addCollider(ctx.colliders, rocketX - 11, 0, rocketZ, 5.6, 46, 5.6, 0, 'metal');

  // 4 Cryogenic LH2 / LOX Sphere Tanks
  [[-1075, -155], [-1075, -135], [-1075, -115], [-1075, -95]].forEach(([tx, tz]) => {
    const sphereGeo = new THREE.SphereGeometry(4.2, 14, 12);
    ctx.geometries.push(sphereGeo);
    const tm = new THREE.Mesh(sphereGeo, pal.whiteMarble);
    tm.position.set(tx, 5.2, tz);
    group.add(tm);
    pb.addCylinder(1.2, 1.4, 3.6, 10, tx, 1.8, tz, 0x64748b);
    addCollider(ctx.colliders, tx, 0, tz, 8.6, 9.5, 8.6, 0, 'metal');
  });

  // Animated 48m Orbital Rocket Group
  const rocketGroup = new THREE.Group();
  rocketGroup.position.set(rocketX, 0.5, rocketZ);
  group.add(rocketGroup);
  const rocketWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.35 });
  const rocketOrange = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.42 });
  const rocketFlameMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.9 });
  const rocketSmokeMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.65 });
  ctx.materials.push(rocketWhite, rocketOrange, rocketFlameMat, rocketSmokeMat);

  addPart(rocketGroup, pal.cylGeo, rocketWhite, 0, 12, 0, 4.4, 24, 4.4);
  addPart(rocketGroup, pal.cylGeo, rocketOrange, 0, 29, 0, 3.6, 11, 3.6);
  addPart(rocketGroup, pal.cylGeo, rocketWhite, 0, 38, 0, 2.8, 7, 2.8);
  const coneGeo = new THREE.ConeGeometry(1.5, 7.0, 14);
  const flameConeGeo = new THREE.ConeGeometry(2.6, 15.0, 12);
  ctx.geometries.push(coneGeo, flameConeGeo);
  const nose = new THREE.Mesh(coneGeo, rocketWhite);
  nose.position.set(0, 45, 0);
  rocketGroup.add(nose);
  // Twin side boosters
  [-3.2, 3.2].forEach((bx) => {
    addPart(rocketGroup, pal.cylGeo, rocketOrange, bx, 9.5, 0, 1.8, 19, 1.8);
    const bNose = new THREE.Mesh(coneGeo, rocketWhite);
    bNose.scale.set(0.65, 0.45, 0.65);
    bNose.position.set(bx, 20.5, 0);
    rocketGroup.add(bNose);
  });
  // Ignition flame cone + pad smoke ring
  const exhaustCone = new THREE.Mesh(flameConeGeo, rocketFlameMat);
  exhaustCone.rotation.x = Math.PI;
  exhaustCone.position.set(0, -6.5, 0);
  exhaustCone.visible = false;
  rocketGroup.add(exhaustCone);

  const launchSmokeRing = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 8), rocketSmokeMat);
  ctx.geometries.push(launchSmokeRing.geometry);
  launchSmokeRing.position.set(rocketX, 2.5, rocketZ);
  launchSmokeRing.visible = false;
  group.add(launchSmokeRing);

  let rocketLaunchClock = -1; // -1 idle, >= 0 launching (0..22s cycle)
  ctx.interactables.push({
    id: 'west_spaceport_rocket_launch',
    x: -1000,
    y: 0,
    z: -125,
    radius: 10.0,
    category: 'shop',
    getLabel: () => (rocketLaunchClock < 0 ? 'Ignite Orbital Rocket Launch Sequence' : 'Rocket Launch In Progress...'),
    trigger: (act) => {
      if (rocketLaunchClock < 0) {
        rocketLaunchClock = 0;
        act.healPlayer(25, 100);
        return 'T-0 IGNITION! Apex Orbital Rocket Launching!';
      }
      return 'Orbital Rocket currently ascending!';
    },
  });

  // Cosmic Planetarium Sphere + Mission Control + Deep-Space Dishes
  const planetariumGeo = new THREE.SphereGeometry(13.5, 18, 14);
  const planetariumMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.22, metalness: 0.68 });
  ctx.geometries.push(planetariumGeo);
  ctx.materials.push(planetariumMat);
  const planetariumMesh = new THREE.Mesh(planetariumGeo, planetariumMat);
  planetariumMesh.position.set(-965, 10.5, -58);
  group.add(planetariumMesh);
  pb.addCylinder(14.6, 15.2, 6.0, 24, -965, 3.0, -58, 0xf8fafc, 'solid', 0, 0, 0, true);
  addCollider(ctx.colliders, -965, 0, -58, 28, 22, 28);

  // Spaceport Helipad (-945, -225) where flyable player helicopter spawns
  pb.addCylinder(11.6, 12.0, 0.25, 24, -945, 0.14, -225, 0x334155, 'solid');
  pb.addBox(-945, 0.28, -225, 6.0, 0.08, 1.4, 0xfacc15, 'emissive');
  pb.addBox(-947.5, 0.28, -225, 1.4, 0.08, 7.0, 0xfacc15, 'emissive');
  pb.addBox(-942.5, 0.28, -225, 1.4, 0.08, 7.0, 0xfacc15, 'emissive');

  // Deep Space Spinning Radar Dishes
  const deepDishes: THREE.Group[] = [];
  [[-1098, -215], [-1098, -42]].forEach(([dx, dz]) => {
    pb.addCylinder(1.6, 2.2, 11, 12, dx, 5.5, dz, 0xe2e8f0);
    const dishHead = new THREE.Group();
    dishHead.position.set(dx, 12.2, dz);
    addPart(dishHead, pal.cylGeo, pal.whiteMarble, 0, 0, 0, 5.6, 1.2, 5.6, { rotX: 0.65 });
    addPart(dishHead, pal.cylGeo, bridgeCyanMat, 0, 2.2, 1.8, 0.35, 3.8, 0.35, { rotX: 0.65 });
    group.add(dishHead);
    deepDishes.push(dishHead);
    addCollider(ctx.colliders, dx, 0, dz, 4.4, 12, 4.4);
  });

  // ---------------------------------------------------------------------------
  // 4. ZONE 3: HELIOS ECO-BIODOMES, SOLAR SUPERTREES & MAGNETIC MONORAIL
  // ---------------------------------------------------------------------------
  const glassDomeMat = new THREE.MeshStandardMaterial({
    color: 0xa7f3d0,
    roughness: 0.12,
    metalness: 0.18,
    transparent: true,
    opacity: 0.42,
  });
  const crystalCoreMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 0.85,
  });
  const bioDomeGeo = new THREE.SphereGeometry(24, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const bioWireGeo = new THREE.SphereGeometry(24.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const bioWireMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, wireframe: true });
  ctx.geometries.push(bioDomeGeo, bioWireGeo);
  ctx.materials.push(glassDomeMat, crystalCoreMat, bioWireMat);

  const biodomeCoords = [
    { x: -595, z: 60 },
    { x: -705, z: 60 },
    { x: -815, z: 60 },
  ];
  biodomeCoords.forEach((bd, idx) => {
    const dome = new THREE.Mesh(bioDomeGeo, glassDomeMat);
    dome.position.set(bd.x, 0.3, bd.z);
    group.add(dome);
    const frame = new THREE.Mesh(bioWireGeo, bioWireMat);
    frame.position.set(bd.x, 0.3, bd.z);
    group.add(frame);
    // Illuminated emerald sanctuary core + interior trees
    addPart(group, pal.cylGeo, crystalCoreMat, bd.x, 5.5, bd.z, 2.2, 11.0, 2.2);
    pb.addTorus(24.0, 0.75, bd.x, 0.55, bd.z, 0xf8fafc, 'solid', Math.PI * 0.5);
    // Open Archway Portals on North & South so you can walk inside/around!
    [-19, 19].forEach((ox) => {
      addCollider(ctx.colliders, bd.x + ox, 0, bd.z, 5.5, 14, 26, 0, 'metal');
    });
    if (idx === 1) {
      ctx.interactables.push({
        id: 'west_biodome_sanctuary',
        x: bd.x,
        y: 8.5,
        z: bd.z,
        radius: 5.5,
        category: 'dine',
        getLabel: () => 'Helios Skywalk Botanical Sanctuary (Full Heal)',
        trigger: (act) => {
          act.healPlayer(100, 100);
          return 'Helios Eco-Sanctuary Restored Full Health & Stamina!';
        },
      });
    }
  });

  // Walkable Elevated Glass Skywalk (y = 8.5m) connecting the 3 Biodomes & Supertrees!
  addPart(group, pal.boxGeo, pal.glassClear, -705, 8.32, 60, 244, 0.36, 4.6);
  addPart(group, pal.boxGeo, bridgeCyanMat, -705, 8.95, 57.8, 244, 0.4, 0.18);
  addPart(group, pal.boxGeo, bridgeCyanMat, -705, 8.95, 62.2, 244, 0.4, 0.18);
  // Skywalk Ramp Up on South side at x = -595, z = 88 -> 62
  addPart(group, pal.boxGeo, pal.concreteDeck, -595, 4.25, 76, 4.4, 0.35, 29.5, { rotX: -Math.atan2(8.5, 28) });
  ctx.ramps.push(
    { minX: -827, maxX: -583, minZ: 57.7, maxZ: 62.3, axis: 'x', startCoord: -827, endCoord: -583, startY: 8.5, endY: 8.5 },
    { minX: -597.5, maxX: -592.5, minZ: 62, maxZ: 90, axis: 'z', startCoord: 90, endCoord: 62, startY: 0, endY: 8.5 },
  );
  addStairSideGuardColliders(ctx.colliders, {
    axis: 'z',
    centerCoord: -595,
    startCoord: 90,
    endCoord: 62,
    yBottom: 0,
    yTop: 8.5,
    width: 4.4,
    railSides: 'both',
  });
  // Elevated Skywalk side guard rails (leaving ramp entrance x: -597.5..-592.5 on south side open!)
  addCollider(ctx.colliders, -705, 8.42, 57.75, 244, 1.35, 0.24, 0, 'metal');
  addCollider(ctx.colliders, -712.5, 8.42, 62.25, 229, 1.35, 0.24, 0, 'metal');
  addCollider(ctx.colliders, -587.75, 8.42, 62.25, 9.5, 1.35, 0.24, 0, 'metal');

  // 6 Illuminated Solar Supertrees (Gardens by the Bay Style)
  const supertreeCanopyMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.72,
  });
  ctx.materials.push(supertreeCanopyMat);
  [[-650, 22], [-760, 22], [-650, 102], [-760, 102], [-545, 96], [-865, 96]].forEach(([sx, sz]) => {
    pb.addCylinder(1.4, 2.3, 18, 12, sx, 9.0, sz, 0xec4899, 'glossy');
    addPart(group, pal.cylGeo, supertreeCanopyMat, sx, 19.0, sz, 8.5, 1.6, 8.5);
    addPart(group, pal.cylGeo, bridgeCyanMat, sx, 20.1, sz, 6.2, 0.4, 6.2);
    addCollider(ctx.colliders, sx, 0, sz, 3.6, 18, 3.6, 0, 'metal');
  });

  // Animated Elevated Magnetic Monorail Beam Loop (y = 11.5m) around (-705, 60)
  const monoSteps = 44;
  const monoIm = new THREE.InstancedMesh(pal.boxGeo, bridgeCyanMat, monoSteps);
  const monoDummy = new THREE.Object3D();
  for (let m = 0; m < monoSteps; m++) {
    const a = (m / monoSteps) * Math.PI * 2;
    const mx = -705 + Math.cos(a) * 165;
    const mz = 60 + Math.sin(a) * 68;
    const yaw = Math.atan2(-Math.sin(a) * 165, Math.cos(a) * 68);
    monoDummy.position.set(mx, 11.5, mz);
    monoDummy.rotation.set(0, yaw, 0);
    monoDummy.scale.set(1.4, 0.9, 25);
    monoDummy.updateMatrix();
    monoIm.setMatrixAt(m, monoDummy.matrix);
    if (m % 4 === 0) {
      pb.addCylinder(0.68, 0.82, 11.5, 10, mx, 5.75, mz, 0x94a3b8);
      addCollider(ctx.colliders, mx, 0, mz, 1.8, 11.5, 1.8);
    }
  }
  monoIm.instanceMatrix.needsUpdate = true;
  monoIm.computeBoundingSphere();
  group.add(monoIm);
  const monorailCars: THREE.Group[] = [];
  for (let c = 0; c < 3; c++) {
    const car = new THREE.Group();
    addPart(car, pal.boxGeo, pal.tealAwning, 0, 1.0, 0, 2.4, 2.1, 8.8);
    addPart(car, pal.boxGeo, bridgeGoldMat, 0, 1.15, 0, 2.48, 0.65, 7.6);
    group.add(car);
    monorailCars.push(car);
  }

  // ---------------------------------------------------------------------------
  // 5. ZONE 4: HELIOS MARINA COVE, PIER, ROTATING LIGHTHOUSE & SUBMARINE
  // ---------------------------------------------------------------------------
  // Wooden Marina Pier Deck extending into Cove (-705, z: 182 -> 282, y = 0.85m)
  addPart(group, pal.boxGeo, pal.terracottaWood, -705, 0.42, 234, 9.6, 0.85, 102);
  addPart(group, pal.boxGeo, pal.concreteDeck, -705, 0.45, 288, 16, 1.4, 16);
  ctx.ramps.push({
    minX: -710,
    maxX: -700,
    minZ: 180,
    maxZ: 295,
    axis: 'z',
    startCoord: 180,
    endCoord: 190,
    startY: 0,
    endY: 0.85,
  });
  for (let pz = 192; pz <= 278; pz += 14) {
    pb.addCylinder(0.32, 0.36, 3.6, 8, -709.5, 0.6, pz, 0x78350f);
    pb.addCylinder(0.32, 0.36, 3.6, 8, -700.5, 0.6, pz, 0x78350f);
  }

  // 34m Striped Smooth Cylindrical Lighthouse at pier head (-705, 288)
  for (let band = 0; band < 10; band++) {
    const rBot = THREE.MathUtils.lerp(4.2, 2.4, band / 10);
    const rTop = THREE.MathUtils.lerp(4.2, 2.4, (band + 1) / 10);
    pb.addCylinder(rTop, rBot, 3.0, 18, -705, 2.6 + band * 3.0, 288, band % 2 === 0 ? 0xdc2626 : 0xf8fafc, 'glossy');
  }
  addCollider(ctx.colliders, -705, 0, 288, 8.6, 31, 8.6);
  const lighthouseTurret = new THREE.Group();
  lighthouseTurret.position.set(-705, 32.5, 288);
  addPart(lighthouseTurret, pal.cylGeo, pal.warmGold, 0, 0, 0, 2.6, 2.2, 2.6);
  const lightConeMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const lightConeGeo = new THREE.ConeGeometry(11, 56, 12, 1, true);
  ctx.geometries.push(lightConeGeo);
  ctx.materials.push(lightConeMat);
  const beamA = new THREE.Mesh(lightConeGeo, lightConeMat);
  beamA.rotation.x = Math.PI * 0.5;
  beamA.position.set(0, 0, 29);
  lighthouseTurret.add(beamA);
  group.add(lighthouseTurret);

  // Docked Sleek Research Submarine & Coast Guard Patrol Cutter in Cove
  const subGroup = new THREE.Group();
  subGroup.position.set(-686, -0.25, 248);
  addPart(subGroup, pal.cylGeo, pal.charcoalSteel, 0, 0.65, 0, 2.6, 16, 2.6, { rotX: Math.PI * 0.5 });
  addPart(subGroup, pal.boxGeo, bridgeGoldMat, 0, 2.35, 0.5, 1.2, 2.2, 3.4); // Conning tower
  group.add(subGroup);

  // Marina Bistro Interactable (-668, 178) — Coral & Teal Marina Pavilion
  pb.addBox(-668, 2.2, 186, 12, 4.4, 8, 0xf97316, 'solid');
  pb.addBox(-668, 4.45, 186, 12.6, 0.5, 8.6, 0x0ea5e9, 'glossy');
  addCollider(ctx.colliders, -668, 0, 186, 12.2, 4.6, 8.2);
  ctx.interactables.push({
    id: 'west_marina_bistro',
    x: -668,
    y: 0,
    z: 179,
    radius: 4.2,
    category: 'dine',
    getLabel: () => 'Helios Marina Oyster Bar & Lounge (+45 HP)',
    trigger: (act) => {
      act.healPlayer(45, 100);
      return 'Refreshed at Helios Marina Bistro (+45 HP)';
    },
  });

  // ---------------------------------------------------------------------------
  // 6. ZONE 5: RED-ROCK CANYON OASIS, CLIMBABLE GOLDEN SUN PYRAMID & STUNT RINGS
  // ---------------------------------------------------------------------------
  const pyrX = -1015;
  const pyrZ = 175;
  const tiers = [
    { size: 42, y: 1.1, h: 2.2, col: 0xd97706 },
    { size: 34, y: 3.3, h: 2.2, col: 0xb45309 },
    { size: 26, y: 5.5, h: 2.2, col: 0xd97706 },
    { size: 18, y: 7.7, h: 2.2, col: 0xb45309 },
    { size: 12, y: 9.9, h: 2.2, col: 0xf59e0b },
  ];
  tiers.forEach((tr) => {
    pb.addBox(pyrX, tr.y, pyrZ, tr.size, tr.h, tr.size, tr.col);
    pb.addBox(pyrX, tr.y + tr.h * 0.45, pyrZ, tr.size + 0.4, 0.25, tr.size + 0.4, 0xfef08a, 'emissive');
  });
  // East Grand Staircase up the Sun Pyramid (walkable RampSurface x: -992 -> -1009, y: 0 -> 11.0)
  addPart(group, pal.boxGeo, bridgeGoldMat, -1000.5, 5.5, pyrZ, 19.5, 0.7, 7.6, { rotZ: -Math.atan2(11.0, 17.0) });
  ctx.ramps.push(
    { minX: -1009, maxX: -992, minZ: pyrZ - 4.0, maxZ: pyrZ + 4.0, axis: 'x', startCoord: -992, endCoord: -1009, startY: 0, endY: 11.0 },
    { minX: pyrX - 6.2, maxX: pyrX + 6.2, minZ: pyrZ - 6.2, maxZ: pyrZ + 6.2, axis: 'x', startCoord: pyrX - 6.2, endCoord: pyrX + 6.2, startY: 11.0, endY: 11.0 },
  );
  addStairSideGuardColliders(ctx.colliders, {
    axis: 'x',
    centerCoord: pyrZ,
    startCoord: -992,
    endCoord: -1009,
    yBottom: 0,
    yTop: 11.0,
    width: 7.6,
    railSides: 'both',
    segments: 6,
  });
  // Colliders around non-stair sides of pyramid so player stays solid on pyramid walls
  addCollider(ctx.colliders, pyrX - 11, 0, pyrZ, 18, 10.5, 41);
  addCollider(ctx.colliders, pyrX + 10, 0, pyrZ - 12, 20, 8.5, 14);
  addCollider(ctx.colliders, pyrX + 10, 0, pyrZ + 12, 20, 8.5, 14);

  // Floating Golden Sun Crystal on Pyramid Summit
  const crystalGeo = new THREE.OctahedronGeometry(1.9, 0);
  const crystalGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
    roughness: 0.15,
    metalness: 0.75,
  });
  ctx.geometries.push(crystalGeo);
  ctx.materials.push(crystalGoldMat);
  const sunCrystal = new THREE.Mesh(crystalGeo, crystalGoldMat);
  sunCrystal.position.set(pyrX, 13.8, pyrZ);
  group.add(sunCrystal);

  ctx.interactables.push({
    id: 'west_sun_pyramid_crystal',
    x: pyrX,
    y: 11.0,
    z: pyrZ,
    radius: 5.5,
    category: 'shop',
    getLabel: () => 'Touch Golden Sun Crystal (+100 HP & Solar Blessing)',
    trigger: (act) => {
      act.healPlayer(100, 100);
      return 'Solar Sun Crystal Restored +100 HP & Full Stamina!';
    },
  });

  // ---------------------------------------------------------------------------
  // 7. NITRO BOOST PADS & 3 NEON STUNT JUMP RAMPS + FLOATING SCORE RINGS!
  // ---------------------------------------------------------------------------
  const addBoostPadMesh = (px: number, py: number, pz: number, dirX: number, dirZ: number, boostSpeed: number, label: string) => {
    const padYaw = Math.atan2(dirX, dirZ);
    const pg = new THREE.Group();
    pg.position.set(px, py + 0.08, pz);
    pg.rotation.y = padYaw;
    addPart(pg, pal.boxGeo, bridgeCyanMat, 0, 0, 0, 5.2, 0.14, 7.2);
    addPart(pg, pal.boxGeo, pal.warmGold, 0, 0.09, 1.2, 3.4, 0.08, 1.2);
    addPart(pg, pal.boxGeo, pal.warmGold, 0, 0.09, -1.2, 3.4, 0.08, 1.2);
    group.add(pg);
    boostPads.push({
      x: px,
      y: py,
      z: pz,
      radius: 4.2,
      boostSpeed,
      dirX,
      dirZ,
      label,
      cooldownSec: 0,
    });
  };

  // West Bridge Boosts & Formula-1 Track Nitro Boost Pads!
  addBoostPadMesh(-335, 9.0, 0, -1, 0, 44, 'Sky Bridge Turbo Boost!');
  addBoostPadMesh(-375, 9.0, 0, 1, 0, 44, 'Sky Bridge Turbo Boost!');
  addBoostPadMesh(WEST_GP_CENTER_X + 10, 0, WEST_GP_CENTER_Z - WEST_GP_RZ, -1, 0, 46, 'Grand Prix Nitro Straight!');
  addBoostPadMesh(WEST_GP_CENTER_X - 10, 0, WEST_GP_CENTER_Z + WEST_GP_RZ, 1, 0, 46, 'Grand Prix Finish Nitro!');

  // 3 Neon Stunt Jump Ramps + Floating Glowing Score Rings!
  const stuntSetups = [
    { id: 'stunt_west_bridge', rampX: -484, rampZ: 20, ringX: -504, ringY: 7.4, ringZ: 20 },
    { id: 'stunt_canyon_oasis', rampX: -968, rampZ: 102, ringX: -988, ringY: 7.6, ringZ: 102 },
    { id: 'stunt_marina_cove', rampX: -610, rampZ: 186, ringX: -630, ringY: 7.5, ringZ: 186 },
  ];
  const ringGeo = new THREE.TorusGeometry(4.2, 0.42, 10, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
  });
  ctx.geometries.push(ringGeo);
  ctx.materials.push(ringMat);

  stuntSetups.forEach((st) => {
    // Launch ramp going East -> West (x: rampX + 8 -> rampX - 8, y: 0 -> 4.6)
    addPart(group, pal.boxGeo, bridgeGoldMat, st.rampX, 2.25, st.rampZ, 16.6, 0.65, 6.2, { rotZ: -Math.atan2(4.6, 16.0) });
    addPart(group, pal.boxGeo, bridgeCyanMat, st.rampX - 8, 2.3, st.rampZ, 0.7, 4.6, 6.2);
    ctx.ramps.push({
      minX: st.rampX - 8,
      maxX: st.rampX + 8,
      minZ: st.rampZ - 3.2,
      maxZ: st.rampZ + 3.2,
      axis: 'x',
      startCoord: st.rampX + 8,
      endCoord: st.rampX - 8,
      startY: 0,
      endY: 4.6,
    });
    // Takeoff nitro boost right at base of ramp
    addBoostPadMesh(st.rampX + 10, 0, st.rampZ, -1, 0, 40, 'Stunt Launch Boost!');

    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(st.ringX, st.ringY, st.ringZ);
    ringMesh.rotation.y = Math.PI * 0.5;
    group.add(ringMesh);
    stuntRings.push({
      id: st.id,
      x: st.ringX,
      y: st.ringY,
      z: st.ringZ,
      radius: 4.8,
      points: 250,
      mesh: ringMesh,
      cooldownSec: 0,
    });
  });

  // ---------------------------------------------------------------------------
  // 8. INTERSECTIONS, TRAFFIC SIGNALS, ROAD MARKINGS & INSTANCED BOTANICAL FLORA
  // ---------------------------------------------------------------------------
  const intersections = [
    { x: -515, z: 0, offsetSec: 1 },
    { x: -515, z: -245, offsetSec: 5 },
    { x: -515, z: 175, offsetSec: 8 },
    { x: -895, z: 0, offsetSec: 3 },
    { x: -895, z: -245, offsetSec: 7 },
    { x: -895, z: 175, offsetSec: 2 },
  ];
  const signalVisuals = intersections.map((inter) =>
    opts.placeIntersectionSignals(inter.x, inter.z, inter.offsetSec),
  );

  // Raised 3D Asphalt Boulevards + Sidewalk Curbs across Grand West City (zero Z-fighting!)
  const addWestRoadStrip = (cx: number, cz: number, sx: number, sz: number, ySurface: number) => {
    addPart(group, pal.boxGeo, pal.slateAsphalt, cx, ySurface - 0.04, cz, sx, 0.08, sz);
    if (sx >= sz) {
      addPart(group, pal.boxGeo, pal.concreteDeck, cx, ySurface - 0.025, cz - sz * 0.5 - 0.35, sx, 0.09, 0.7);
      addPart(group, pal.boxGeo, pal.concreteDeck, cx, ySurface - 0.025, cz + sz * 0.5 + 0.35, sx, 0.09, 0.7);
    } else {
      addPart(group, pal.boxGeo, pal.concreteDeck, cx - sx * 0.5 - 0.35, ySurface - 0.025, cz, 0.7, 0.09, sz);
      addPart(group, pal.boxGeo, pal.concreteDeck, cx + sx * 0.5 + 0.35, ySurface - 0.025, cz, 0.7, 0.09, sz);
    }
  };
  addWestRoadStrip(-742, 0, 556, 14.2, 0.017); // West trunk z=0
  addWestRoadStrip(-515, -12.5, 13.6, 485, 0.021); // Waterfront arterial
  addWestRoadStrip(-895, 0, 13.6, 510, 0.021); // Spaceport/Pyramid arterial
  addWestRoadStrip(-745, 175, 460, 13.2, 0.018); // Marina & Pyramid boulevard
  addWestRoadStrip(-705, -245, 380, 12.8, 0.018); // Cyber-Tokyo spur

  // Prominent Grand West Digital Screen: DEVELOPED BY AFTAB BALOCH DADU
  const westCreatorMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'DEVELOPED BY AFTAB BALOCH DADU',
    subtitle: 'APEX GRAND WEST · CYBER-TOKYO & SPACEPORT',
    accentHex: '#ec4899',
    lockTitle: true,
    intervalSec: 0.9,
  }).material;
  addPart(group, pal.boxGeo, pal.charcoalSteel, -536, 4.5, -24, 0.55, 9.0, 0.55);
  addPart(group, pal.boxGeo, pal.charcoalSteel, -536, 4.5, -12, 0.55, 9.0, 0.55);
  addPart(group, pal.boxGeo, pal.charcoalSteel, -536, 8.6, -18, 0.45, 5.2, 13.8);
  addPart(group, pal.boxGeo, westCreatorMat, -535.7, 8.6, -18, 0.14, 4.5, 13.0, { rotY: Math.PI * 0.5 });
  addPart(group, pal.boxGeo, westCreatorMat, -536.3, 8.6, -18, 0.14, 4.5, 13.0, { rotY: -Math.PI * 0.5 });
  addCollider(ctx.colliders, -536, 0, -24, 0.8, 9.0, 0.8);
  addCollider(ctx.colliders, -536, 0, -12, 0.8, 9.0, 0.8);

  addRoadMarkingsBatch(
    group,
    [
      { kind: 'dash_line', x1: -1020, z1: 0, x2: -248, z2: 0, color: 0xfacc15 },
      { kind: 'dash_line', x1: -515, z1: -250, x2: -515, z2: 225, color: 0xfacc15 },
      { kind: 'dash_line', x1: -895, z1: -250, x2: -895, z2: 250, color: 0xfacc15 },
      { kind: 'dash_line', x1: -975, z1: 175, x2: -515, z2: 175, color: 0xfacc15 },
      { kind: 'dash_line', x1: -895, z1: -245, x2: -515, z2: -245, color: 0xe2e8f0 },
    ],
    groundHeightAt,
    ctx.geometries,
    ctx.materials,
  );

  // Instanced West Flora: Futuristic Palms, Sakura Blossom Trees & Canyon Saguaro Cacti
  const treeSpots: Array<{ x: number; z: number; col: number }> = [];
  for (let gx = -875; gx <= -535; gx += 46) {
    for (let gz = -22; gz <= 148; gz += 44) {
      if (Math.hypot(gx + 705, gz - 60) < 30 || Math.hypot(gx + 595, gz - 60) < 28 || Math.hypot(gx + 815, gz - 60) < 28) continue;
      if (isOnGrandWestRoad(gx, gz)) continue;
      treeSpots.push({ x: gx, z: gz, col: 0x10b981 });
    }
  }
  // Sakura cherry trees around Cyber-Tokyo
  for (let gx = -860; gx <= -540; gx += 52) {
    if (!isOnGrandWestRoad(gx, -52)) {
      treeSpots.push({ x: gx, z: -52, col: 0xf472b6 });
    }
  }
  // Beach Palms flanking Marina Cove
  for (let gx = -840; gx <= -550; gx += 44) {
    if (Math.abs(gx + 705) > 95) {
      treeSpots.push({ x: gx, z: 245, col: 0x22c55e });
    }
  }
  if (treeSpots.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 4.6, 6);
    const crownGeo = new THREE.DodecahedronGeometry(2.3, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
    ctx.geometries.push(trunkGeo, crownGeo);
    ctx.materials.push(trunkMat, crownMat);

    const imTrunk = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
    const imCrown = new THREE.InstancedMesh(crownGeo, crownMat, treeSpots.length);
    const m4 = new THREE.Matrix4();
    const tmpCol = new THREE.Color();
    treeSpots.forEach((ts, idx) => {
      const gy = groundHeightAt(ts.x, ts.z, 0);
      m4.makeTranslation(ts.x, gy + 2.3, ts.z);
      imTrunk.setMatrixAt(idx, m4);
      m4.makeTranslation(ts.x, gy + 5.1, ts.z);
      imCrown.setMatrixAt(idx, m4);
      tmpCol.setHex(ts.col);
      imCrown.setColorAt(idx, tmpCol);
    });
    imTrunk.instanceMatrix.needsUpdate = true;
    imCrown.instanceMatrix.needsUpdate = true;
    if (imCrown.instanceColor) imCrown.instanceColor.needsUpdate = true;
    imTrunk.computeBoundingSphere();
    imCrown.computeBoundingSphere();
    group.add(imTrunk, imCrown);
  }

  // Compile all merged West City PBR assemblies
  const built = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  group.add(built.group);
  ctx.geometries.push(...built.geometries);
  ctx.materials.push(...built.materials);
  ctx.shootableEnv.push(built.group);

  // ---------------------------------------------------------------------------
  // 9. ANIMATION UPDATERS (Zero Heap Allocations!)
  // ---------------------------------------------------------------------------
  ctx.updaters.push((dt, elapsed) => {
    // 1. Western Strait Hydrofoil Yachts
    for (let i = 0; i < straitBoats.length; i++) {
      const sb = straitBoats[i];
      const span = sb.zMax - sb.zMin;
      const cycle = ((elapsed * sb.speed + sb.phase * 30) % (span * 2) + span * 2) % (span * 2);
      const forward = cycle <= span;
      const z = forward ? sb.zMin + cycle : sb.zMax - (cycle - span);
      sb.mesh.position.set(sb.laneX, sb.waterY + Math.sin(elapsed * 1.7 + sb.phase) * 0.14, z);
      sb.mesh.rotation.y = forward ? 0 : Math.PI;
      sb.mesh.rotation.z = Math.sin(elapsed * 1.2 + sb.phase) * 0.03;
    }

    // 2. Formula-1 AI Race Cars on Grand Prix Track
    for (let i = 0; i < f1Cars.length; i++) {
      const car = f1Cars[i];
      const pt = sampleWestGrandPrixTrack(elapsed * car.speed + car.offsetDist);
      const perpX = Math.cos(pt.yaw);
      const perpZ = -Math.sin(pt.yaw);
      car.group.position.set(pt.x + perpX * car.lateral, 0.08, pt.z + perpZ * car.lateral);
      car.group.rotation.y = pt.yaw;
    }

    // 3. Elevated Magnetic Monorail Train gliding along Eco-Biodome Loop
    for (let c = 0; c < monorailCars.length; c++) {
      const a = elapsed * 0.36 - c * 0.072;
      const mx = -705 + Math.cos(a) * 165;
      const mz = 60 + Math.sin(a) * 68;
      const yaw = Math.atan2(-Math.sin(a) * 165, Math.cos(a) * 68);
      monorailCars[c].position.set(mx, 12.15, mz);
      monorailCars[c].rotation.y = yaw;
    }

    // 4. Lighthouse Sweeping Searchlight Beam & Cyber-Tokyo Hologram Ring
    lighthouseTurret.rotation.y += dt * 0.85;
    holoRingA.rotation.y += dt * 0.9;
    holoRingA.rotation.x = Math.sin(elapsed * 0.8) * 0.45;
    sunCrystal.rotation.y += dt * 1.3;
    sunCrystal.position.y = 13.8 + Math.sin(elapsed * 2.2) * 0.55;

    // 5. Spaceport Deep Space Dishes & Interactive Orbital Rocket Launch Sequence
    for (let d = 0; d < deepDishes.length; d++) {
      deepDishes[d].rotation.y = Math.sin(elapsed * 0.3 + d * 1.5) * 1.1;
    }
    if (rocketLaunchClock >= 0) {
      rocketLaunchClock += dt;
      if (rocketLaunchClock < 3.0) {
        // Ignition rumble & billowing launchpad smoke
        const shake = Math.sin(rocketLaunchClock * 45) * 0.18;
        rocketGroup.position.set(rocketX + shake, 0.5, rocketZ + shake * 0.6);
        exhaustCone.visible = true;
        exhaustCone.scale.setScalar(0.5 + rocketLaunchClock * 0.35);
        launchSmokeRing.visible = true;
        const sm = 0.8 + rocketLaunchClock * 0.9;
        launchSmokeRing.scale.set(sm, 0.5 + rocketLaunchClock * 0.25, sm);
      } else if (rocketLaunchClock < 14.5) {
        const flightT = rocketLaunchClock - 3.0;
        const alt = 0.5 + flightT * flightT * 1.45;
        rocketGroup.position.set(rocketX, alt, rocketZ);
        exhaustCone.visible = true;
        exhaustCone.scale.set(1.3, 1.4 + Math.sin(elapsed * 30) * 0.2, 1.3);
        launchSmokeRing.visible = flightT < 4.5;
      } else if (rocketLaunchClock < 20.5) {
        // Vertical return descent onto pad
        const descT = (rocketLaunchClock - 14.5) / 6.0;
        rocketGroup.position.set(rocketX, THREE.MathUtils.lerp(185, 0.5, descT * descT), rocketZ);
        exhaustCone.visible = descT < 0.92;
        exhaustCone.scale.setScalar(0.7);
        launchSmokeRing.visible = false;
      } else {
        rocketLaunchClock = -1;
        rocketGroup.position.set(rocketX, 0.5, rocketZ);
        exhaustCone.visible = false;
        launchSmokeRing.visible = false;
      }
    }

    // 6. Floating Stunt Ring Bobbing
    for (let s = 0; s < stuntRings.length; s++) {
      stuntRings[s].mesh.rotation.z += dt * 1.1;
    }
  });

  // West District Shopping Mall (-580, 224) & Modern City Park (-842, 224)
  const westMalls: MallNavData[] = [];
  if (opts.buildMall) {
    westMalls.push(
      opts.buildMall({
        id: 'mall_west_helios',
        name: 'HELIOS CYBER MALL',
        cx: -580,
        cz: 224,
        facadeHex: 0x1e293b,
        trimHex: 0xec4899,
        floor1Hex: 0xe0f2fe,
        floor2Hex: 0xfce7f3,
        floor3Hex: 0xd1fae5,
        accentHex: '#ec4899',
      }),
    );
  }
  const westParkBenches = opts.buildPark ? opts.buildPark(-842, 224).benches : [];

  return {
    malls: westMalls,
    parkBenches: westParkBenches,
    intersections,
    signalVisuals,
    roadRectLoops: [
      { minX: -895, maxX: -515, minZ: -245, maxZ: 0, clockwise: true },
      { minX: -895, maxX: -515, minZ: 0, maxZ: 175, clockwise: false },
    ],
    westCitizenSpots: [
      { x: -965, z: -32, role: 'spaceport' },
      { x: -1012, z: -120, role: 'spaceport' },
      { x: -980, z: -76, role: 'spaceport' },
      { x: -1036, z: -38, role: 'spaceport' },
      { x: -935, z: 18, role: 'spaceport' },
      { x: -705, z: 42, role: 'biodome' },
      { x: -595, z: 42, role: 'biodome' },
      { x: -815, z: 42, role: 'biodome' },
      { x: -650, z: 74, role: 'biodome' },
      { x: -760, z: 74, role: 'biodome' },
      { x: -555, z: 120, role: 'biodome' },
      { x: -855, z: 120, role: 'biodome' },
      { x: -668, z: 176, role: 'marina' },
      { x: -705, z: 192, role: 'marina' },
      { x: -745, z: 178, role: 'marina' },
      { x: -705, z: 235, role: 'marina' },
      { x: -632, z: -248, role: 'cyber_tokyo' },
      { x: -782, z: -248, role: 'cyber_tokyo' },
      { x: -705, z: -232, role: 'cyber_tokyo' },
      { x: -620, z: -175, role: 'cyber_tokyo' },
      { x: -790, z: -175, role: 'cyber_tokyo' },
      { x: -545, z: -110, role: 'cyber_tokyo' },
      { x: -865, z: -110, role: 'cyber_tokyo' },
      { x: -985, z: 175, role: 'pyramid' },
      { x: -1010, z: 210, role: 'pyramid' },
      { x: -945, z: 196, role: 'pyramid' },
      { x: -842, z: 224, role: 'marina' },
      { x: -835, z: 214, role: 'marina' },
    ],
    touristSpots: [
      { x: -475, z: 12, lookAtX: -355, lookAtZ: 0 },
      { x: -705, z: 86, lookAtX: -705, lookAtZ: 60 },
      { x: -705, z: 235, lookAtX: -705, lookAtZ: 288 },
      { x: -986, z: 175, lookAtX: -1015, lookAtZ: 175 },
    ],
    gardenSpots: [
      { x: -650, z: 32 },
      { x: -760, z: 32 },
      { x: -650, z: 90 },
      { x: -760, z: 90 },
    ],
    drumPlacements: [
      [-1052, -138],
      [-1050, -138],
      [-980, -110],
      [-552, -238],
      [-554, -238],
      [-705, -232],
      [-862, 165],
      [-860, 165],
      [-980, 148],
      [-640, 182],
      [-760, 182],
      [-532, 32],
    ],
    boostPads,
    stuntRings,
    raceCheckpoints,
  };
}
