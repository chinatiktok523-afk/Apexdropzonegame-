import * as THREE from 'three';
import { BIKE_STYLES, GraphicsQuality } from '../types';
import {
  addCollider,
  buildExplosiveBarrel,
  stepBreakableGlassPanes,
  type BarrelActor,
  type BreakableGlassPane,
  type BuiltArena,
  type ColliderBox,
  type CoverNode,
  type DoorwayTrigger,
  type RampSurface,
  type SupplyCrateActor,
  type WorldInteractable,
} from './arena';
import {
  buildArchitecturalStaircase,
  createCityPalette,
  placeEnterableOfficeBuilding,
  placeInteractiveCityLocations,
  placeModernGasStation,
  placeWaterfrontHotelResort,
  registerBreakableGlass,
  type CityPalette,
  type SimWorldBuildContext,
} from './buildingsAndTransit';
import { DigitalDisplayManager } from './digitalDisplays';
import {
  addAnimatedCanalBarge,
  type LandmarkContext,
  placeIndustrialFactoryLandmark,
  placeLargeTowerLandmark,
  placeStadiumLandmark,
} from './landmarks';
import { type BalloonRegistration, WorldWildlifeController } from './worldWildlifeProps';
import { buildPerimeterMountainsAndRocks, createCompoundPalette, disposeObject3DResources, MaterialLibrary } from './models';
import { createModernBuildingPalette, ModernBuildingContext, placeModernBalconyTower, placeModernVilla } from './modernBuildings';
import {
  BAY_CITY_AVENUE_X,
  BAY_CITY_AVENUE_Z,
  buildApexBayCityExpansion,
  getBayCityCoastHeight,
  isOnBayCityRoad,
} from './newCityDistrict';
import {
  buildGrandEastCity,
  getGrandEastCityGroundHeight,
  isOnGrandEastRoad,
} from './grandEastCity';
import {
  buildGrandWestCity,
  getGrandWestCityGroundHeight,
  isOnGrandWestRoad,
} from './grandWestCity';
import type { VehicleSpawnSpec } from '../types';
import {
  createAtmosphericSkyDome,
  createRealisticWater,
  createSplatTerrainMaterial,
  fbm2D,
  populateInstancedGrass,
  populateLowPolyTrees,
  populateOrganicBoulders,
  populateOrganicTrees,
  type InstancedGrassSystem,
  type RealisticWaterSystem,
} from './realisticWorld';
import { WorldStreamingController } from './worldStreaming';
import {
  type MallNavData,
  type MegaWorldEnvironmentData,
  type SignalVisualGroup,
  SimulatorNpcManager,
} from './simulatorNpcs';
import {
  createElevatorState,
  type GangBossStyleId,
  MEGA_RAILWAY_LOOP_LENGTH,
  MEGA_RAILWAY_STATIONS,
  requestNextElevatorFloor,
  sampleRailwayLoop,
  sampleRollerCoasterTrack,
  stepElevatorState,
} from './simulatorSystems';
import { ProceduralTextureSet } from './textures';
import { addRoadMarkingsBatch, createPropPbrMaterials, PropMeshAssembler } from './urbanProps';
import { buildLuxuryMansionProperty } from './mansionEstate';
import {
  MANSION_HELIPAD_COORDS,
  SPACEPORT_HELIPAD_COORDS,
  isInsideMansionProperty,
  shouldFlattenNorthExpansion,
} from './mansionSystems';
import { getMansionPoolBedDepth } from './swimmingPhysics';
import {
  SMART_CITY_DOME,
  distanceToSingleSmartCityRoad,
  isInSmartCityZone,
  isInsideSmartCityDome,
  isOnSmartCityRoad,
} from './smartCitySystems';
import { buildSmartCityWorld } from './smartCityWorld';
import { buildSmartCityTransit } from './smartCityTransit';
import { isInScienceDistrictZone, isOnScienceDistrictRoad } from './scienceDistrictSystems';
import { buildScienceDistrictWorld } from './scienceDistrictWorld';

const AVENUE_X = [-140, 0, 140];
const AVENUE_Z = [-140, 0, 140];
const SEINE_RIVER_Z = 166;
const SEINE_HALF_W = 11;

const ALL_MALL_FOOTPRINTS: ReadonlyArray<{ cx: number; cz: number; hw: number; hd: number }> = [
  { cx: -44, cz: -36, hw: 29, hd: 20 },
  { cx: -184, cz: -96, hw: 29, hd: 20 },
  { cx: 188, cz: -44, hw: 29, hd: 20 },
  { cx: -184, cz: 88, hw: 29, hd: 20 },
  { cx: 68, cz: 188, hw: 29, hd: 20 },
  { cx: 315, cz: 42, hw: 29, hd: 20 },
  // East & West District Shopping Malls & Parks + Hospital
  { cx: 1092, cz: -212, hw: 29, hd: 20 },
  { cx: 875, cz: -212, hw: 26, hd: 24 },
  { cx: -580, cz: 224, hw: 29, hd: 20 },
  { cx: -842, cz: 224, hw: 26, hd: 24 },
  { cx: 315, cz: -102, hw: 18, hd: 14 },
  // Waterfront Hotel Resort pad & Car Showroom pad
  { cx: 26, cz: 34, hw: 16, hd: 20 },
  { cx: 395, cz: 36, hw: 19, hd: 13 },
  // Chinatown Stone Plaza (prevents green grass blending through floor)
  { cx: 958, cz: 232, hw: 162, hd: 68 },
];

export function isInsidePavedBuildingPad(x: number, z: number, pad = 0): boolean {
  for (let i = 0; i < ALL_MALL_FOOTPRINTS.length; i++) {
    const m = ALL_MALL_FOOTPRINTS[i];
    if (Math.abs(x - m.cx) <= m.hw + pad && Math.abs(z - m.cz) <= m.hd + pad) {
      return true;
    }
  }
  return false;
}

export function isOnMegaRoad(x: number, z: number): boolean {
  if (isOnSmartCityRoad(x, z)) return true;
  if (isOnScienceDistrictRoad(x, z)) return true;
  if (isOnBayCityRoad(x, z)) return true;
  if (isOnGrandEastRoad(x, z)) return true;
  if (isOnGrandWestRoad(x, z)) return true;
  for (let i = 0; i < AVENUE_X.length; i++) {
    if (Math.abs(x - AVENUE_X[i]) < 7.2 && Math.abs(z) < 265) return true;
  }
  for (let i = 0; i < AVENUE_Z.length; i++) {
    if (Math.abs(z - AVENUE_Z[i]) < 7.2 && Math.abs(x) < 265) return true;
  }
  // Outer perimeter collector loop connecting all 4 districts & Dropzone/Festival/Seine/Stadium
  if ((Math.abs(Math.abs(x) - 208) < 5.6) && Math.abs(z) < 214) return true;
  if ((Math.abs(Math.abs(z) - 208) < 5.6) && Math.abs(x) < 214) return true;
  // Dropzone Compound connector spur (x in [140..192], z = 36)
  if (Math.abs(z - 36) < 5.4 && x >= 140 && x <= 192) return true;
  // Festival Amusement Park connector spur (z = 60, x in [52..140] & x = 58, z in [0..140])
  if (Math.abs(z - 60) < 5.2 && x >= 52 && x <= 140) return true;
  if (Math.abs(x - 58) < 5.2 && z >= 0 && z <= 140) return true;
  // Stadium & Power Plant spurs
  if (Math.abs(x - 188) < 5.4 && z >= -208 && z <= -140) return true;
  if (Math.abs(x - 192) < 5.4 && z >= 140 && z <= 208) return true;
  // North Connector Boulevard linking central city North Avenue to Apex Mansion Main Gate (z = -248)
  if (Math.abs(x) < 7.2 && z <= -208 && z >= -248) return true;
  return false;
}

export function getSnowMountainHeight(x: number, z: number): number {
  if (x > -154 || z > -154 || x < -265 || z < -265) return 0;
  const distFromRoadX = Math.max(0, -154 - x);
  const distFromRoadZ = Math.max(0, -154 - z);
  const edgeBlend = Math.min(1, distFromRoadX / 18) * Math.min(1, distFromRoadZ / 18);
  const peakFactor = THREE.MathUtils.clamp((-168 - z) / 88, 0, 1);
  const ridgeWave = Math.sin(x * 0.045) * 1.4 + Math.cos(z * 0.04) * 1.1;
  return Math.max(0, edgeBlend * (peakFactor * 24.5 + ridgeWave));
}

export function unifiedSimulatorGroundHeight(
  x: number,
  z: number,
  currentY?: number,
  ramps: RampSurface[] = [],
): number {
  const mansionPoolBed = getMansionPoolBedDepth(x, z);
  if (mansionPoolBed !== null) return mansionPoolBed;

  let base = getSnowMountainHeight(x, z);

  // SW Seine River channel across x in [-265, -24], bridged at x=-140 via RampSurface
  if (x >= -265 && x <= -24) {
    const rDist = Math.abs(z - SEINE_RIVER_Z);
    if (rDist < SEINE_HALF_W) {
      const bankT = THREE.MathUtils.smoothstep(rDist, SEINE_HALF_W - 2.6, SEINE_HALF_W);
      base = Math.min(base, THREE.MathUtils.lerp(-2.1, 0, bankT));
    }
  }

  // NW Emerald Lake basin near waterfall (-216, -158)
  const lakeDist = Math.hypot(x + 216, z + 158);
  if (lakeDist < 17) {
    const lt = THREE.MathUtils.smoothstep(lakeDist, 12, 17);
    base = Math.min(base, THREE.MathUtils.lerp(-1.6, 0, lt));
  }

  // West Strait & Grand West Island City (x < -265)
  if (x < -265) {
    base = getGrandWestCityGroundHeight(x, z);
  }

  // East Apex Bay Coastline, Ocean Channel & Grand East Island City (x > 548)
  if (x > 548) {
    if (Math.hypot(x - 742, z + 155) < 26) {
      base = getGrandEastCityGroundHeight(x, z);
    } else if (x <= 784) {
      base = Math.min(base, getBayCityCoastHeight(x, z));
    } else {
      base = getGrandEastCityGroundHeight(x, z);
    }
  }

  // Soft perimeter mountain skirt along North/South central valley (feathers smoothly outward from Mansion estate)
  const zEdge = Math.max(0, Math.abs(z) - 295);
  if (zEdge > 0 && x >= -265 && x < 548 && !shouldFlattenNorthExpansion(x, z)) {
    const northFeather = z < -210 ? THREE.MathUtils.clamp((Math.abs(x) - 142) / 68, 0, 1) : 1;
    base = Math.max(base, Math.min(14, zEdge * 0.45) * northFeather);
  }

  // Keep Smart City -> Mansion West connecting road cleanly elevated above surrounding terrain
  if (isOnSmartCityRoad(x, z)) {
    base = Math.max(base, 0.22);
  }

  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      const coord = r.axis === 'x' ? x : z;
      const span = r.endCoord - r.startCoord;
      const t = Math.abs(span) < 0.001 ? 0 : THREE.MathUtils.clamp((coord - r.startCoord) / span, 0, 1);
      const ry = THREE.MathUtils.lerp(r.startY, r.endY, t);
      if (currentY !== undefined && ry > currentY + 1.35) continue;
      if (ry > base) base = ry;
    }
  }
  return base;
}

function addBox(
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

interface MallThemeConfig {
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
}

/**
 * Enlarged 56m x 38m 3-Floor Enterable Shopping Mall:
 * - Sealed Floor 2 & Floor 3 deck slabs + Ceiling Colliders + Full 3rd-Floor Roof & Skylight Dome
 * - Continuous dual-flight staircases (1F->2F at x=22.6 & 2F->3F at x=25.8) + Working Glass Elevator (0 / 5.0 / 10.0)
 * - Distinct per-floor wall/tile/trim/awning designs on 1F, 2F, and 3F
 * - All 5 large store categories on EVERY floor: Clothes (+ Clothes Stalls/Racks/Stacks), Perfume, Watches, Shoes, Cafeteria + Modern Seller Desks
 */
function placeEnterableElevatorMall(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  cfg: MallThemeConfig,
): MallNavData {
  const { cx, cz } = cfg;
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  ctx.arenaGroup.add(g);

  const W = 56; // x in [-28..28]
  const D = 38; // z in [-19..19]
  const F_H = 5.0; // Floors at y = 0, 5.0, 10.0; Roof at y = 15.0
  const HALF_W = W * 0.5;
  const HALF_D = D * 0.5;

  const pb = new PropMeshAssembler();

  // 1. Seamless Polished Terrazzo/Marble Ground Floor Deck + Concrete Perimeter Apron (recessed terrain underneath -> zero grass Z-fighting!)
  addBox(g, pal, pal.concreteDeck, 0, -0.025, 0, W + 6, 0.06, D + 6);
  const f1FloorMat = pal.mallMarble;
  addBox(g, pal, f1FloorMat, 0, -0.005, 0, W + 2, 0.09, D + 2);

  // 2. Exterior North & South Facade Walls (Open 8.4m wide central doorways x in [-4.2..4.2])
  [-HALF_D, HALF_D].forEach((wz) => {
    [-16.1, 16.1].forEach((wx) => {
      pb.addBox(wx, F_H * 1.5, wz, 23.8, F_H * 3, 0.7, cfg.facadeHex);
      [F_H, F_H * 2].forEach((bandY) => {
        pb.addBox(wx, bandY, wz, 24.0, 0.55, 0.85, cfg.trimHex, 'glossy');
      });
      addCollider(ctx.colliders, cx + wx, 0, cz + wz, 23.8, F_H * 3, 0.8);
    });
    // Breakable glass portal transom above open ground doorway (clear 4.0m doorway height)
    registerBreakableGlass(ctx, addBox(g, pal, pal.glassClear, 0, F_H * 1.9, wz, 8.4, F_H * 2.1, 0.28));
    pb.addBox(0, 4.15, wz, 9.2, 0.5, 0.9, cfg.trimHex, 'glossy');
    addCollider(ctx.colliders, cx, 3.9, cz + wz, 8.4, F_H * 2.2, 0.75);
  });

  // 3. Exterior East & West Curtain Walls (full 3-story breakable glazing + architectural pilasters)
  [-HALF_W, HALF_W].forEach((wx) => {
    registerBreakableGlass(ctx, addBox(g, pal, pal.glassClear, wx, F_H * 1.5, 0, 0.34, F_H * 2.8, D - 1.4));
    for (let pz = -HALF_D; pz <= HALF_D; pz += 6.2) {
      pb.addBox(wx, F_H * 1.5, pz, 0.78, F_H * 3, 0.95, cfg.facadeHex);
    }
    [F_H, F_H * 2].forEach((bandY) => {
      pb.addBox(wx, bandY, 0, 0.85, 0.5, D, cfg.trimHex, 'glossy');
    });
    addCollider(ctx.colliders, cx + wx, 0, cz, 0.8, F_H * 3, D);
  });

  // 4. Floor 2 (y=5.0) & Floor 3 (y=10.0) Seamless Marble Decks + Flush Elevator Lobby Bridges
  const floorMats = [cfg.floor2Hex, cfg.floor3Hex];
  [F_H, F_H * 2].forEach((fy, fIdx) => {
    const fCol = floorMats[fIdx];
    const upperDeckMat = new THREE.MeshStandardMaterial({
      color: fCol,
      roughness: 0.34,
      metalness: 0.08,
      ...(ctx.textures?.mallMarbleTile ? { map: ctx.textures.mallMarbleTile } : {}),
    });
    ctx.materials.push(upperDeckMat);
    // West Deck: x in [-28..-5.5] & Center-East Deck: x in [5.5..21.0]
    addBox(g, pal, upperDeckMat, -16.75, fy - 0.18, 0, 22.5, 0.36, D);
    addBox(g, pal, upperDeckMat, 13.25, fy - 0.18, 0, 15.5, 0.36, D);
    // South & North Atrium Bridges
    addBox(g, pal, upperDeckMat, 0, fy - 0.18, 12.0, 11.0, 0.36, 14.0);
    addBox(g, pal, upperDeckMat, 0, fy - 0.18, -12.0, 11.0, 0.36, 14.0);

    // FLUSH ELEVATOR LOBBY BRIDGE (bridges the 3.1m atrium gap directly to lift doors at z=1.9!)
    addBox(g, pal, upperDeckMat, 0, fy - 0.18, 3.5, 4.5, 0.36, 3.3);
    pb.addBox(-2.22, fy + 0.55, 3.5, 0.12, 1.1, 3.2, 0x93c5fd, 'glass');
    pb.addBox(2.22, fy + 0.55, 3.5, 0.12, 1.1, 3.2, 0x93c5fd, 'glass');

    // East Stairwell North Landing (z in [-19..-12]) & South Landing (z in [12..19])
    pb.addBox(24.25, fy - 0.18, -15.5, 6.5, 0.36, 7.0, fCol);
    pb.addBox(24.25, fy - 0.18, 15.5, 6.5, 0.36, 7.0, fCol);

    // Glass atrium balustrades
    pb.addBox(-5.5, fy + 0.55, 0, 0.14, 1.1, 10.2, 0x93c5fd, 'glass');
    pb.addBox(5.5, fy + 0.55, 0, 0.14, 1.1, 10.2, 0x93c5fd, 'glass');
    pb.addBox(-3.88, fy + 0.55, 5.0, 3.25, 1.1, 0.14, 0x93c5fd, 'glass');
    pb.addBox(3.88, fy + 0.55, 5.0, 3.25, 1.1, 0.14, 0x93c5fd, 'glass');
    pb.addBox(0, fy + 0.55, -5.0, 11.0, 1.1, 0.14, 0x93c5fd, 'glass');
    pb.addBox(21.0, fy + 0.55, 0, 0.12, 1.1, 24.0, 0x93c5fd, 'glass');

    // Walkable Floor Ramps + thin underside Ceiling Colliders!
    const deckSections = [
      { minX: -28, maxX: -5.5, minZ: -19, maxZ: 19 },
      { minX: 5.5, maxX: 21.0, minZ: -19, maxZ: 19 },
      { minX: -5.5, maxX: 5.5, minZ: 5.0, maxZ: 19 },
      { minX: -5.5, maxX: 5.5, minZ: -19, maxZ: -5.0 },
      { minX: -2.25, maxX: 2.25, minZ: 1.85, maxZ: 5.15 },
      { minX: 21.0, maxX: 27.6, minZ: -19, maxZ: -12 },
      { minX: 21.0, maxX: 27.6, minZ: 12, maxZ: 19 },
    ];
    for (const ds of deckSections) {
      const w = ds.maxX - ds.minX;
      const d = ds.maxZ - ds.minZ;
      const midX = cx + (ds.minX + ds.maxX) * 0.5;
      const midZ = cz + (ds.minZ + ds.maxZ) * 0.5;
      ctx.ramps.push({
        minX: cx + ds.minX,
        maxX: cx + ds.maxX,
        minZ: cz + ds.minZ,
        maxZ: cz + ds.maxZ,
        axis: 'x',
        startCoord: cx + ds.minX,
        endCoord: cx + ds.maxX,
        startY: fy,
        endY: fy,
      });
      addCollider(ctx.colliders, midX, fy - 0.36, midZ, w, 0.31, d);
    }
  });

  // Elevator Shaft Side & Back Safety Colliders
  addCollider(ctx.colliders, cx - 1.98, 0, cz, 0.22, F_H * 3, 4.0, 0, 'concrete');
  addCollider(ctx.colliders, cx + 1.98, 0, cz, 0.22, F_H * 3, 4.0, 0, 'concrete');
  addCollider(ctx.colliders, cx, 0, cz - 1.98, 4.0, F_H * 3, 0.22, 0, 'concrete');

  // 5. SEALED 3RD-FLOOR ROOF (y = 15.0) + Curved Atrium Skylight Dome + Roof Parapet!
  const ROOF_Y = F_H * 3; // 15.0m
  pb.addBox(-16.75, ROOF_Y + 0.22, 0, 22.8, 0.44, D + 0.8, 0x334155);
  pb.addBox(16.75, ROOF_Y + 0.22, 0, 22.8, 0.44, D + 0.8, 0x334155);
  pb.addBox(0, ROOF_Y + 0.22, -12.0, 11.4, 0.44, 14.4, 0x334155);
  pb.addBox(0, ROOF_Y + 0.22, 12.0, 11.4, 0.44, 14.4, 0x334155);
  pb.addBox(0, ROOF_Y + 0.52, 0, 11.6, 0.26, 10.6, 0xbae6fd, 'glass');
  pb.addSphere(4.6, 1.2, 0.48, 1.05, 0, ROOF_Y + 0.65, 0, 0xe0f2fe, 'glass', 1);
  pb.addBox(0, ROOF_Y + 0.65, -HALF_D, W + 0.8, 0.45, 0.45, cfg.trimHex, 'emissive');
  pb.addBox(0, ROOF_Y + 0.65, HALF_D, W + 0.8, 0.45, 0.45, cfg.trimHex, 'emissive');
  addCollider(ctx.colliders, cx, ROOF_Y - 0.15, cz, W + 0.6, 0.65, D + 0.6);

  // 6. ARCHITECTURAL DUAL-FLIGHT STAIRCASES: Flight A (1F->2F at x=22.6) AND Flight B (2F->3F at x=25.8)
  buildArchitecturalStaircase(g, ctx, pal, {
    ox: cx,
    oz: cz,
    stairX: 22.6,
    zStart: 11.8,
    zEnd: -11.8,
    yBottom: 0,
    yTop: F_H,
    width: 2.8,
    stepCount: 18,
    railSides: 'both',
    treadMat: pal.terracottaWood,
  });
  buildArchitecturalStaircase(g, ctx, pal, {
    ox: cx,
    oz: cz,
    stairX: 25.8,
    zStart: -11.8,
    zEnd: 11.8,
    yBottom: F_H,
    yTop: F_H * 2,
    width: 2.8,
    stepCount: 18,
    railSides: 'both',
    treadMat: pal.warmGold,
  });

  // Central Atrium Decorative Greenery & Bench Seating (around glass elevator on 1F)
  [-6.8, 6.8].forEach((px) => {
    pb.addCylinder(0.9, 1.0, 0.7, 12, px, 0.35, -3.5, 0x94a3b8);
    pb.addCylinder(0.14, 0.2, 1.1, 8, px, 1.0, -3.5, 0x78350f);
    pb.addSphere(0.75, 1.1, 0.95, 1.1, px, 1.75, -3.5, 0x16a34a);
    pb.addBox(px, 0.35, 3.5, 2.2, 0.5, 0.7, 0xb45309);
  });

  // 7. SCULPTED NON-BLOCKY BOUTIQUE STORES ON EVERY FLOOR (Curved racks, mannequins, glass vitrines, pedestals)
  const addModernSellerDesk = (lx: number, fy: number, lz: number, deskHex: number, topHex: number, monitorHex: number) => {
    pb.addCylinder(0.62, 0.62, 1.02, 12, lx - 1.9, fy + 0.51, lz, deskHex, 'glossy');
    pb.addCylinder(0.62, 0.62, 1.02, 12, lx + 1.9, fy + 0.51, lz, deskHex, 'glossy');
    pb.addBox(lx, fy + 0.51, lz, 3.8, 1.02, 1.24, deskHex, 'glossy');
    pb.addCylinder(0.66, 0.66, 0.12, 12, lx - 1.9, fy + 1.08, lz, topHex, 'glossy');
    pb.addCylinder(0.66, 0.66, 0.12, 12, lx + 1.9, fy + 1.08, lz, topHex, 'glossy');
    pb.addBox(lx, fy + 1.08, lz, 3.8, 0.12, 1.32, topHex, 'glossy');
    pb.addBox(lx, fy + 0.24, lz + 0.63, 3.6, 0.1, 0.06, monitorHex, 'emissive');
    pb.addCylinder(0.06, 0.1, 0.32, 8, lx - 1.1, fy + 1.24, lz, 0x334155);
    pb.addBox(lx - 1.1, fy + 1.48, lz, 0.72, 0.44, 0.06, monitorHex, 'emissive');
    pb.addCylinder(0.06, 0.1, 0.32, 8, lx + 1.1, fy + 1.24, lz, 0x334155);
    pb.addBox(lx + 1.1, fy + 1.48, lz, 0.72, 0.44, 0.06, 0x0f172a);
    addCollider(ctx.colliders, cx + lx, fy, cz + lz, 4.6, 1.28, 1.32);
  };

  const floorPalettes = [
    {
      name: '1F ROSE & GOLD GALLERY',
      clothes: [0xec4899, 0x38bdf8, 0xfacc15, 0xf43f5e],
      desk: 0x1e293b,
      deskTop: 0xf8fafc,
      awning: 0xbe185d,
      wallBand: 0xfde047,
      monitor: 0x38bdf8,
    },
    {
      name: '2F SAPPHIRE & EMERALD WING',
      clothes: [0x8b5cf6, 0x10b981, 0x0ea5e9, 0xf97316],
      desk: 0x0f766e,
      deskTop: 0xe0f2fe,
      awning: 0x0284c7,
      wallBand: 0x34d399,
      monitor: 0xa7f3d0,
    },
    {
      name: '3F ROYAL SKY TERRACE BAZAAR',
      clothes: [0xef4444, 0xf59e0b, 0x06b6d4, 0xa855f7],
      desk: 0x7c2d12,
      deskTop: 0xfef3c7,
      awning: 0x7c3aed,
      wallBand: 0xfbbf24,
      monitor: 0xfef08a,
    },
  ];

  const addBoutiqueFloor = (fy: number, fIdx: number) => {
    const fp = floorPalettes[fIdx];

    pb.addBox(-16.5, fy + 3.45, -18.3, 18.0, 0.45, 0.25, fp.awning, 'glossy');
    pb.addBox(-16.5, fy + 3.45, 18.3, 18.0, 0.45, 0.25, fp.wallBand, 'emissive');
    pb.addBox(13.5, fy + 3.45, -18.3, 14.0, 0.45, 0.25, fp.awning, 'glossy');
    pb.addBox(13.5, fy + 3.45, 18.3, 14.0, 0.45, 0.25, fp.wallBand, 'emissive');

    // A) DESIGNER CLOTHING BOUTIQUE (Curved tubular steel garment arches + contoured mannequin forms + round display ottomans)
    [-23.5, -18.0, -12.5, -8.2].forEach((rx, rIdx) => {
      pb.addTube(
        [
          new THREE.Vector3(rx - 1.45, fy + 0.05, -14.2),
          new THREE.Vector3(rx - 1.45, fy + 1.52, -14.2),
          new THREE.Vector3(rx + 1.45, fy + 1.52, -14.2),
          new THREE.Vector3(rx + 1.45, fy + 0.05, -14.2),
        ],
        0.055,
        12,
        8,
        0xcbd5e1,
        'glossy',
      );
      pb.addCylinder(0.24, 0.28, 0.08, 10, rx - 1.45, fy + 0.04, -14.2, 0x1e293b, 'glossy');
      pb.addCylinder(0.24, 0.28, 0.08, 10, rx + 1.45, fy + 0.04, -14.2, 0x1e293b, 'glossy');
      for (let h = -2; h <= 2; h++) {
        const col = fp.clothes[(rIdx + Math.abs(h)) % 4];
        const gx = rx + h * 0.5;
        // Draped sculpted jacket/dress garment silhouette
        pb.addCylinder(0.14, 0.22, 0.72, 10, gx, fy + 1.08, -14.2, col);
        pb.addSphere(0.16, 1.2, 0.7, 0.9, gx, fy + 1.42, -14.2, col);
      }
      // Circular marble/velvet display ottoman + folded fabric rolls
      pb.addCylinder(1.05, 0.95, 0.76, 16, rx, fy + 0.38, -8.8, fp.deskTop, 'glossy');
      pb.addCylinder(0.38, 0.42, 0.18, 12, rx - 0.42, fy + 0.85, -8.8, fp.clothes[rIdx % 4]);
      pb.addCylinder(0.38, 0.42, 0.18, 12, rx + 0.42, fy + 0.85, -8.8, fp.clothes[(rIdx + 2) % 4]);
      addCollider(ctx.colliders, cx + rx, fy, cz - 14.2, 3.2, 1.65, 0.65);
      addCollider(ctx.colliders, cx + rx, fy, cz - 8.8, 2.2, 1.1, 2.2);
    });
    addModernSellerDesk(-16.0, fy, -4.6, fp.desk, fp.deskTop, fp.monitor);

    // B) HAUTE PARFUMERIE (Cylindrical marble islands + curved glass bell domes + crystal flacon bottles)
    [-23.5, -18.5].forEach((px, pIdx) => {
      pb.addCylinder(1.45, 1.55, 0.95, 18, px, fy + 0.48, 15.6, 0xfdf2f8, 'glossy');
      pb.addCylinder(1.5, 1.5, 0.08, 18, px, fy + 0.96, 15.6, 0xfbbf24, 'emissive');
      pb.addCylinder(1.3, 1.3, 0.85, 18, px, fy + 1.42, 15.6, 0xe0f2fe, 'glass');
      pb.addSphere(1.3, 1.3, 0.45, 1.3, px, fy + 1.84, 15.6, 0xe0f2fe, 'glass');
      for (let b = -1; b <= 1; b++) {
        const fx = px + b * 0.68;
        pb.addCylinder(0.11, 0.18, 0.38, 12, fx, fy + 1.18, 15.6, pIdx === 0 ? 0xf43f5e : 0xa855f7, 'glass');
        pb.addSphere(0.09, 1, 1, 1, fx, fy + 1.42, 15.6, 0xfbbf24, 'glossy');
      }
      addCollider(ctx.colliders, cx + px, fy, cz + 15.6, 3.1, 2.2, 3.1);
    });
    addModernSellerDesk(-21.0, fy, 9.6, fp.desk, fp.deskTop, 0xf472b6);

    // C) DESIGNER FOOTWEAR SALON (Tiered circular pedestals + sculpted curved sneaker/shoe silhouettes)
    [-12.2, -8.2].forEach((sx, sIdx) => {
      pb.addCylinder(1.35, 1.45, 0.72, 18, sx, fy + 0.36, 12.2, 0x0f172a, 'glossy');
      pb.addCylinder(0.95, 1.05, 0.36, 18, sx, fy + 0.9, 12.2, 0xf8fafc, 'glossy');
      for (let a = 0; a < 4; a++) {
        const ang = (a / 4) * Math.PI * 2 + 0.3;
        const shx = sx + Math.cos(ang) * 0.72;
        const shz = 12.2 + Math.sin(ang) * 0.72;
        const shoeCol = fp.clothes[(a + sIdx) % 4];
        pb.addCylinder(0.14, 0.16, 0.08, 10, shx, fy + 1.12, shz, 0xf8fafc, 'glossy');
        pb.addSphere(0.14, 1.4, 0.8, 0.9, shx, fy + 1.2, shz, shoeCol, 'glossy');
        pb.addCylinder(0.08, 0.1, 0.16, 10, shx - Math.cos(ang) * 0.08, fy + 1.26, shz - Math.sin(ang) * 0.08, shoeCol);
      }
      addCollider(ctx.colliders, cx + sx, fy, cz + 12.2, 2.9, 1.35, 2.9);
    });
    addModernSellerDesk(-10.5, fy, 6.4, fp.desk, fp.deskTop, 0x38bdf8);

    // D) LUXURY WATCHES GALLERY (Circular cylindrical glass showcases with gold rings)
    [9.4, 14.2, 18.2].forEach((wx) => {
      pb.addCylinder(1.05, 1.12, 0.96, 18, wx, fy + 0.48, -11.5, 0x1e293b, 'glossy');
      pb.addCylinder(1.0, 1.0, 0.62, 18, wx, fy + 1.27, -11.5, 0xbae6fd, 'glass');
      pb.addCylinder(1.04, 1.04, 0.08, 18, wx, fy + 1.58, -11.5, 0xfbbf24, 'glossy');
      pb.addCylinder(0.22, 0.24, 0.26, 14, wx - 0.36, fy + 1.09, -11.5, 0xfbbf24, 'glossy');
      pb.addCylinder(0.22, 0.24, 0.26, 14, wx + 0.36, fy + 1.09, -11.5, 0xe2e8f0, 'glossy');
      addCollider(ctx.colliders, cx + wx, fy, cz - 11.5, 2.25, 1.6, 2.25);
    });
    addModernSellerDesk(13.6, fy, -6.2, fp.desk, fp.deskTop, 0xfacc15);

    // E) MALL MINI CAR SHOWROOM & DIGITAL LOUNGE (Replaces old Cafeteria Hot Dining!)
    addModernSellerDesk(13.6, fy, 15.8, 0x1e293b, 0xf8fafc, 0xf59e0b);
    const mallShowroomMonMat = ctx.displays.createDisplayMaterial('mini_monitor', {
      title: 'CAR SHOWROOM',
      subtitle: 'ALL LUXURY RIDES · TEST DRIVE',
      accentHex: '#f59e0b',
      intervalSec: 0.9,
    }).material;
    [
      [9.4, 7.6, 0xef4444],
      [14.4, 7.6, 0x0ea5e9],
      [9.4, 11.6, 0xf59e0b],
      [14.4, 11.6, 0x10b981],
    ].forEach(([tx, tz, carHex], dIdx) => {
      pb.addCylinder(1.22, 1.32, 0.22, 16, tx, fy + 0.11, tz, 0x1e293b, 'glossy');
      pb.addCylinder(1.24, 1.24, 0.05, 16, tx, fy + 0.23, tz, 0xf59e0b, 'emissive');
      pb.addBox(tx, fy + 0.44, tz, 0.95, 0.34, 1.85, carHex, 'glossy');
      pb.addBox(tx, fy + 0.68, tz - 0.1, 0.78, 0.22, 0.95, 0xbae6fd, 'glass');
      const mScreen = new THREE.Mesh(pal.boxGeo, mallShowroomMonMat);
      mScreen.position.set(tx + (dIdx % 2 === 0 ? -1.15 : 1.15), fy + 0.95, tz);
      mScreen.scale.set(0.56, 0.34, 0.05);
      g.add(mScreen);
      addCollider(ctx.colliders, cx + tx, fy, cz + tz, 2.3, 1.0, 2.3);
    });
  };

  addBoutiqueFloor(0, 0);
  addBoutiqueFloor(F_H, 1);
  addBoutiqueFloor(F_H * 2, 2);

  // Elevator guide rails
  [-1.95, 1.95].forEach((rx) => {
    pb.addCylinder(0.09, 0.09, F_H * 3, 8, rx, F_H * 1.5, -1.95, 0x334155, 'glossy');
    pb.addCylinder(0.09, 0.09, F_H * 3, 8, rx, F_H * 1.5, 1.95, 0x334155, 'glossy');
  });

  const propMats = createPropPbrMaterials(false);
  const built = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  g.add(built.group);
  ctx.geometries.push(...built.geometries);
  ctx.materials.push(...propMats.all, ...built.materials);
  ctx.shootableEnv.push(built.group);

  // WORKING ANIMATED GLASS ELEVATOR / LIFT IN CENTRAL ATRIUM (x=0, z=0)
  const elevatorState = createElevatorState([0, F_H, F_H * 2]);
  const liftGroup = new THREE.Group();
  liftGroup.position.set(0, 0, 0);
  g.add(liftGroup);

  // Cabin floor slab positioned so top surface is exact local y = 0.00 (completely flush with 1F/2F/3F!)
  addBox(liftGroup, pal, pal.warmGold, 0, -0.08, 0, 3.8, 0.16, 3.8);
  addBox(liftGroup, pal, pal.charcoalSteel, 0, 2.9, 0, 3.8, 0.18, 3.8);
  registerBreakableGlass(ctx, addBox(liftGroup, pal, pal.glassClear, -1.85, 1.5, 0, 0.08, 2.8, 3.6));
  registerBreakableGlass(ctx, addBox(liftGroup, pal, pal.glassClear, 1.85, 1.5, 0, 0.08, 2.8, 3.6));
  registerBreakableGlass(ctx, addBox(liftGroup, pal, pal.glassClear, 0, 1.5, -1.85, 3.6, 2.8, 0.08));
  const doorLeft = registerBreakableGlass(ctx, addBox(liftGroup, pal, pal.glassClear, -0.9, 1.45, 1.85, 1.75, 2.7, 0.08));
  const doorRight = registerBreakableGlass(ctx, addBox(liftGroup, pal, pal.glassClear, 0.9, 1.45, 1.85, 1.75, 2.7, 0.08));

  const liftRamp: RampSurface = {
    minX: cx - 1.9,
    maxX: cx + 1.9,
    minZ: cz - 1.9,
    maxZ: cz + 1.9,
    axis: 'x',
    startCoord: cx - 1.9,
    endCoord: cx + 1.9,
    startY: 0,
    endY: 0,
  };
  ctx.ramps.push(liftRamp);

  ctx.updaters.push((dt) => {
    stepElevatorState(elevatorState, dt, 2.8);
    liftGroup.position.y = elevatorState.currentY;
    liftRamp.startY = elevatorState.currentY;
    liftRamp.endY = elevatorState.currentY;
    const openSlide = elevatorState.doorsOpenProgress * 1.35;
    doorLeft.position.x = -0.9 - openSlide;
    doorRight.position.x = 0.9 + openSlide;
  });

  [0, F_H, F_H * 2].forEach((fy, idx) => {
    ctx.interactables.push({
      id: `${cfg.id}_elevator_f${idx + 1}`,
      x: cx,
      y: fy,
      z: cz + 2.6,
      radius: 4.0,
      category: 'shop',
      getLabel: () => `Elevator Lift (Floor ${idx + 1} -> Next Floor)`,
      trigger: () => {
        const nextIdx = requestNextElevatorFloor(elevatorState);
        return `${cfg.name} Lift -> Floor ${nextIdx + 1}`;
      },
    });
  });

  // Digital Screens on Mall Exterior & Atrium cycling DEVELOPED BY AFTAB BALOCH DADU & Store Promos
  const mallScreenMat = ctx.displays.createDisplayMaterial('shopping_mall', {
    title: `${cfg.name} · CLOTHES, PERFUME, WATCHES, SHOES, CAR SHOWROOM`,
    intervalSec: 0.75,
  }).material;
  const frontScreen = new THREE.Mesh(pal.boxGeo, mallScreenMat);
  frontScreen.position.set(0, F_H * 2.35, HALF_D + 0.45);
  frontScreen.scale.set(17.5, 4.8, 0.16);
  g.add(frontScreen);

  const atriumScreenMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'DEVELOPED BY AFTAB BALOCH DADU',
    intervalSec: 0.75,
  }).material;
  const interiorScreen = new THREE.Mesh(pal.boxGeo, atriumScreenMat);
  interiorScreen.position.set(0, F_H + 2.5, -HALF_D + 0.65);
  interiorScreen.scale.set(12.5, 4.2, 0.16);
  g.add(interiorScreen);

  ctx.interactables.push({
    id: `${cfg.id}_boutique_shop`,
    x: cx - 16.0,
    y: 0,
    z: cz - 3.2,
    radius: 4.0,
    category: 'shop',
    getLabel: () => `Browse ${cfg.name} (Clothes, Perfume, Watches & Shoes)`,
    trigger: (act) => {
      act.healPlayer(25, 100);
      return `Shopped at ${cfg.name} (+25 HP & Full Armor)`;
    },
  });

  return {
    name: cfg.name,
    nav: {
      cx,
      cz,
      halfW: HALF_W,
      halfD: HALF_D,
      doorNorthZ: cz - HALF_D,
      doorSouthZ: cz + HALF_D,
      elevatorX: cx,
      elevatorZ: cz,
      stairX: cx + 22.6,
      stair2X: cx + 25.8,
      stairBottomZ: cz + 11.5,
      stairMidZ: cz - 11.5,
      stairTopZ: cz + 11.5,
      floorHeight: F_H,
    },
    elevatorState,
    clothesSpots: [
      { x: cx - 21.0, y: 0, z: cz - 11.0 },
      { x: cx - 14.5, y: F_H, z: cz - 11.0 },
      { x: cx - 9.5, y: F_H * 2, z: cz - 11.0 },
    ],
    perfumeShoeSpots: [
      { x: cx - 21.0, y: 0, z: cz + 12.0 },
      { x: cx - 10.5, y: F_H, z: cz + 9.2 },
      { x: cx - 19.5, y: F_H * 2, z: cz + 12.0 },
    ],
    watchSpots: [
      { x: cx + 13.5, y: 0, z: cz - 9.0 },
      { x: cx + 13.5, y: F_H, z: cz - 9.0 },
      { x: cx + 13.5, y: F_H * 2, z: cz - 9.0 },
    ],
    cashierSpots: [
      { x: cx - 16.0, y: 0, z: cz - 3.2, yaw: 0 },
      { x: cx + 13.6, y: 0, z: cz - 4.8, yaw: 0 },
      { x: cx - 21.0, y: F_H, z: cz + 8.2, yaw: 0 },
      { x: cx - 10.5, y: F_H, z: cz + 5.0, yaw: 0 },
      { x: cx + 13.6, y: F_H * 2, z: cz + 14.4, yaw: 0 },
    ],
    foodCourtSpots: [
      { x: cx + 9.2, y: 0, z: cz + 7.6 },
      { x: cx + 14.2, y: F_H, z: cz + 7.6 },
      { x: cx + 14.2, y: F_H * 2, z: cz + 11.4 },
    ],
  };
}

/**
 * DROPZONE COMPOUND SECTOR (Red-Orange Warehouse, Tactical Command Buildings, Watchtower, Wooden Crates & Road Barriers)
 */
function placeDropzoneCompoundSector(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  cx: number,
  cz: number,
) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  ctx.arenaGroup.add(g);

  const pb = new PropMeshAssembler();

  // Concrete & sand compound yard (continuous slab, zero block checker)
  addBox(g, pal, pal.concreteDeck, 0, 0.05, 0, 44, 0.1, 42);

  // Red-Orange Sloped Depot Warehouse
  pb.addBox(-9, 3.0, -9, 14, 6.0, 12, 0xdc2626);
  pb.addBox(-9, 6.3, -9, 14.8, 0.9, 12.6, 0xf97316, 'glossy');
  addCollider(ctx.colliders, cx - 9, 0, cz - 9, 14.2, 6.5, 12.2);

  // White & Blue Tactical Operations Building
  pb.addBox(10, 3.4, -10, 12, 6.8, 11, 0xf8fafc);
  pb.addBox(10, 6.4, -10, 12.3, 0.85, 11.3, 0x0284c7, 'glossy');
  addCollider(ctx.colliders, cx + 10, 0, cz - 10, 12.2, 6.8, 11.2);

  // Elevated Tactical Watchtower (NE Corner of compound)
  [-2.1, 2.1].forEach((px) => {
    [-2.1, 2.1].forEach((pz) => {
      pb.addCylinder(0.22, 0.25, 8.4, 8, 14 + px, 4.2, 11 + pz, 0x78350f);
    });
  });
  pb.addBox(14, 6.8, 11, 5.4, 0.35, 5.4, 0x92400e);
  pb.addCone(4.1, 1.5, 4, 14, 10.2, 11, 0xb91c1c, 'solid', 0, Math.PI * 0.25, 0);
  addCollider(ctx.colliders, cx + 14, 0, cz + 11, 4.8, 8.0, 4.8);

  // Stacked Wooden Tactical Crates & Smooth Safety Barriers
  [
    [-12, 7],
    [-10, 9.5],
    [3, 12],
    [5.8, 12.5],
  ].forEach(([kx, kz], idx) => {
    pb.addBox(kx, 0.85, kz, 1.8, 1.7, 1.8, idx % 2 === 0 ? 0xb45309 : 0x92400e);
    addCollider(ctx.colliders, cx + kx, 0, cz + kz, 1.85, 1.8, 1.85);
  });
  pb.addBox(-10.5, 2.35, 8.2, 1.6, 1.5, 1.6, 0xd97706);

  [-6, 0, 6].forEach((bx) => {
    pb.addBox(bx, 0.65, 17, 4.2, 1.15, 0.85, 0xdc2626, 'glossy');
    pb.addBox(bx, 1.15, 17, 4.24, 0.24, 0.9, 0xf8fafc, 'glossy');
    addCollider(ctx.colliders, cx + bx, 0, cz + 17, 4.2, 1.3, 0.95);
  });

  const propMats = createPropPbrMaterials(false);
  const built = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  g.add(built.group);
  ctx.geometries.push(...built.geometries);
  ctx.materials.push(...propMats.all, ...built.materials);
  ctx.shootableEnv.push(built.group);
}

/**
 * FESTIVAL AMUSEMENT PARK & CIRCUS (All 6 Rides: Ferris Wheel, Painted-Horse Carousel, Roller Coaster + 3-Car Train,
 * Kiddie Mini-Train, Bumper Cars Arena, Wave Swinger + Circus Big-Top, Bunting, Balloons, Confetti & Spotlights!)
 */
function placeFestivalAmusementPark(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  cx: number,
  cz: number,
) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  ctx.arenaGroup.add(g);

  const pb = new PropMeshAssembler();
  // Smooth terrazzo festival plaza (non-blocky)
  addBox(g, pal, pal.mallMarble, 2.5, 0.05, 2.5, 48, 0.1, 48);

  // Smooth Striped Circus Big-Top Tent (Cylindrical Wall + Fluted Conical Roof)
  pb.addCylinder(7.6, 7.6, 4.8, 16, -11, 2.5, 11, 0xdc2626);
  for (let s = 0; s < 16; s++) {
    const a = (s / 16) * Math.PI * 2;
    pb.addBox(-11 + Math.cos(a) * 7.62, 2.5, 11 + Math.sin(a) * 7.62, 1.45, 4.8, 0.25, s % 2 === 0 ? 0xdc2626 : 0xf8fafc, 'solid', 0, -a + Math.PI * 0.5, 0);
  }
  pb.addCone(8.1, 6.2, 16, -11, 8.0, 11, 0xdc2626);
  pb.addCone(5.4, 4.2, 16, -11, 9.1, 11, 0xfacc15);
  pb.addCylinder(0.18, 0.22, 1.8, 8, -11, 11.8, 11, 0xfacc15, 'emissive');
  addCollider(ctx.colliders, cx - 11, 0, cz + 11, 13.8, 5.2, 13.8);

  // Illuminated Carnival Game & Snack Booths
  [
    [-12, -16, 0xec4899],
    [-4, -16, 0x0ea5e9],
    [4, -16, 0x10b981],
    [12, -16, 0xf97316],
  ].forEach(([sx, sz, col], idx) => {
    pb.addBox(sx, 1.4, sz, 4.4, 2.8, 3.0, col);
    pb.addBox(sx, 3.1, sz + 0.4, 4.9, 0.45, 3.8, 0xfacc15);
    pb.addBox(sx, 3.35, sz + 2.2, 4.6, 0.25, 0.2, 0xfef08a, 'emissive');
    for (let b = 0; b < 3; b++) {
      pb.addSphere(0.24, 1, 1.25, 1, sx + 2.25 + b * 0.26, 3.15 + b * 0.34, sz + 1.1, [0xf43f5e, 0x38bdf8, 0xfacc15][(idx + b) % 3]);
    }
    addCollider(ctx.colliders, cx + sx, 0, cz + sz, 4.5, 3.2, 3.2);
  });

  // Festival String Light Poles & Festive Bulbs
  const bulbCols = [0xfef08a, 0xf43f5e, 0x38bdf8, 0x22c55e, 0xf59e0b];
  [-19, 23].forEach((lx) => {
    [-16, 2, 19].forEach((lz) => {
      pb.addCylinder(0.16, 0.2, 7.0, 8, lx, 3.5, lz, 0x1e293b);
      pb.addSphere(0.38, 1, 1, 1, lx, 7.1, lz, 0xfef08a, 'emissive');
    });
  });
  [-16, 2, 19].forEach((lz, rowIdx) => {
    pb.addCylinder(0.04, 0.04, 42.0, 6, 2, 6.9, lz, 0x1e293b, 'solid', 0, 0, Math.PI * 0.5);
    for (let b = -6; b <= 6; b++) {
      pb.addSphere(0.22, 1, 1.2, 1, 2 + b * 3.0, 6.62 + Math.abs(b) * 0.04, lz, bulbCols[(Math.abs(b) + rowIdx) % 5], 'emissive');
      pb.addCone(0.28, 0.45, 3, 2 + b * 3.0 + 1.4, 6.66, lz, bulbCols[(Math.abs(b) + rowIdx + 2) % 5], 'solid', Math.PI, 0, 0);
    }
  });

  // Grounded Carnival Entrance Archway
  [-6.2, 6.2].forEach((ax) => {
    pb.addCylinder(0.32, 0.36, 7.2, 10, ax, 3.6, -20.5, 0x1e293b);
    pb.addCylinder(0.55, 0.62, 0.7, 10, ax, 0.35, -20.5, 0xfacc15);
    addCollider(ctx.colliders, cx + ax, 0, cz - 20.5, 0.85, 7.2, 0.85, 0, 'metal');
  });
  pb.addBox(0, 7.1, -20.5, 13.0, 0.48, 0.55, 0xdc2626);

  // Ferris Wheel A-Frame
  pb.addCylinder(0.28, 0.32, 11.5, 10, 16, 5.6, 7.0, 0x334155);
  pb.addCylinder(0.28, 0.32, 11.5, 10, 16, 5.6, 11.0, 0x334155);
  addCollider(ctx.colliders, cx + 16, 0, cz + 9, 4.2, 3.2, 5.2);

  // Bumper Cars Pavilion
  const bmpX = 14;
  const bmpZ = -10;
  pb.addBox(bmpX, 0.14, bmpZ, 13.5, 0.24, 10.5, 0x1e293b);
  pb.addBox(bmpX, 3.9, bmpZ, 13.8, 0.38, 10.8, 0x4c1d95, 'glossy');
  pb.addBox(bmpX, 4.15, bmpZ - 5.3, 13.8, 0.25, 0.2, 0x38bdf8, 'emissive');
  pb.addBox(bmpX, 4.15, bmpZ + 5.3, 13.8, 0.25, 0.2, 0xf43f5e, 'emissive');
  [bmpX - 6.4, bmpX + 6.4].forEach((px) => {
    [bmpZ - 4.9, bmpZ + 4.9].forEach((pz) => {
      pb.addCylinder(0.18, 0.2, 3.8, 8, px, 2.0, pz, 0x94a3b8, 'glossy');
    });
  });
  addCollider(ctx.colliders, cx + bmpX, 0, cz + bmpZ, 13.8, 4.1, 10.8);

  // Ride 3 Track Structure: Smooth Curved Tubular Roller Coaster Track & Cylindrical Pillars
  const coasterSteps = 56;
  const trackCurvePts: THREE.Vector3[] = [];
  for (let i = 0; i < coasterSteps; i++) {
    const t0 = i / coasterSteps;
    const p0 = sampleRollerCoasterTrack(t0, 0, 2);
    trackCurvePts.push(new THREE.Vector3(p0.x, p0.y, p0.z));
    if (i % 4 === 0 && p0.y > 1.2) {
      pb.addCylinder(0.22, 0.26, p0.y, 8, p0.x, p0.y * 0.5, p0.z, 0x475569, 'glossy');
    }
  }
  const closedCoasterCurve = new THREE.CatmullRomCurve3(trackCurvePts, true);
  pb.addGeo(new THREE.TubeGeometry(closedCoasterCurve, 72, 0.28, 7, true), 0xe11d48, 'glossy');

  const propMats = createPropPbrMaterials(false);
  const built = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  g.add(built.group);
  ctx.geometries.push(...built.geometries);
  ctx.materials.push(...propMats.all, ...built.materials);
  ctx.shootableEnv.push(built.group);

  // Ride 1: Animated Rotating Ferris Wheel Rotor + Gondolas
  const ferrisWheel = new THREE.Group();
  ferrisWheel.position.set(16, 11.2, 9);
  g.add(ferrisWheel);
  const gondolas: THREE.Group[] = [];
  const spokeCols = [pal.redAwning, pal.amberAwning, pal.tealAwning, pal.cyanNeon];
  for (let s = 0; s < 8; s++) {
    const ang = (s / 8) * Math.PI * 2;
    const rad = 8.4;
    const spoke = addBox(ferrisWheel, pal, pal.whiteMarble, Math.cos(ang) * rad * 0.5, Math.sin(ang) * rad * 0.5, 0, rad, 0.16, 0.16);
    spoke.rotation.z = ang;
    const gnd = new THREE.Group();
    gnd.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, 0);
    addBox(gnd, pal, spokeCols[s % spokeCols.length], 0, -0.65, 0, 1.4, 1.2, 1.4);
    ferrisWheel.add(gnd);
    gondolas.push(gnd);
  }

  // Ride 2: Animated Painted-Horse Carousel (Center x=-1, z=-1)
  const carousel = new THREE.Group();
  carousel.position.set(-1, 0, -1);
  g.add(carousel);
  addBox(carousel, pal, pal.amberAwning, 0, 0.25, 0, 7.6, 0.4, 7.6);
  addBox(carousel, pal, pal.redAwning, 0, 4.2, 0, 7.8, 0.65, 7.8);
  addBox(carousel, pal, pal.warmGold, 0, 2.2, 0, 0.85, 3.8, 0.85);
  const carouselHorses: THREE.Group[] = [];
  for (let c = 0; c < 6; c++) {
    const ang = (c / 6) * Math.PI * 2;
    const hx = Math.cos(ang) * 2.8;
    const hz = Math.sin(ang) * 2.8;
    addBox(carousel, pal, pal.warmGold, hx, 2.2, hz, 0.1, 3.6, 0.1);
    const horse = new THREE.Group();
    horse.position.set(hx, 1.35, hz);
    horse.rotation.y = ang + Math.PI * 0.5;
    addBox(horse, pal, spokeCols[c % spokeCols.length], 0, 0, 0, 0.42, 0.44, 1.15);
    addBox(horse, pal, pal.whiteMarble, 0, 0.36, 0.44, 0.24, 0.42, 0.36);
    addBox(horse, pal, spokeCols[(c + 1) % spokeCols.length], -0.14, -0.34, 0.38, 0.1, 0.38, 0.1);
    addBox(horse, pal, spokeCols[(c + 1) % spokeCols.length], 0.14, -0.34, -0.38, 0.1, 0.38, 0.1);
    carousel.add(horse);
    carouselHorses.push(horse);
  }
  addCollider(ctx.colliders, cx - 1, 0, cz - 1, 7.2, 4.2, 7.2);

  // Ride 3: 3-Car Roller Coaster Train racing along undulating skyline track!
  const coasterCars: THREE.Group[] = [];
  for (let c = 0; c < 3; c++) {
    const car = new THREE.Group();
    addBox(car, pal, c === 0 ? pal.redAwning : pal.amberAwning, 0, 0.42, 0, 1.25, 0.68, 2.2);
    addBox(car, pal, pal.warmGold, 0, 0.18, 0, 1.35, 0.22, 2.3);
    g.add(car);
    coasterCars.push(car);
  }

  // Ride 4: Kiddie Trackless Mini-Train circling festival center plaza!
  const miniTrainCars: THREE.Group[] = [];
  for (let m = 0; m < 3; m++) {
    const tc = new THREE.Group();
    addBox(tc, pal, m === 0 ? pal.redAwning : m === 1 ? pal.tealAwning : pal.amberAwning, 0, 0.55, 0, 1.2, 0.9, 1.9);
    if (m === 0) addBox(tc, pal, pal.charcoalSteel, 0, 1.15, 0.55, 0.28, 0.45, 0.28);
    g.add(tc);
    miniTrainCars.push(tc);
  }

  // Ride 5: 4 Animated Bumper Cars zooming inside Bumper Car Pavilion!
  const bumperCars: THREE.Group[] = [];
  for (let b = 0; b < 4; b++) {
    const bc = new THREE.Group();
    addBox(bc, pal, spokeCols[b % spokeCols.length], 0, 0.45, 0, 1.3, 0.55, 1.7);
    addBox(bc, pal, pal.charcoalSteel, 0, 0.28, 0, 1.55, 0.22, 1.95);
    addBox(bc, pal, pal.warmGold, 0, 1.75, -0.6, 0.06, 2.6, 0.06);
    g.add(bc);
    bumperCars.push(bc);
  }

  // Ride 6: Wave Swinger Swing Carousel (NW Festival Corner x=-14, z=-9)
  const swingerBase = new THREE.Group();
  swingerBase.position.set(-14, 0, -9);
  g.add(swingerBase);
  addBox(swingerBase, pal, pal.whiteMarble, 0, 3.2, 0, 1.3, 6.4, 1.3);
  const swingerRotor = new THREE.Group();
  swingerRotor.position.set(0, 6.5, 0);
  swingerBase.add(swingerRotor);
  addBox(swingerRotor, pal, pal.tealAwning, 0, 0, 0, 7.2, 0.55, 7.2);
  addBox(swingerRotor, pal, pal.warmGold, 0, 0.5, 0, 5.4, 0.45, 5.4);
  const swingerChairs: THREE.Group[] = [];
  for (let s = 0; s < 8; s++) {
    const ang = (s / 8) * Math.PI * 2;
    const chair = new THREE.Group();
    chair.position.set(Math.cos(ang) * 3.1, -0.2, Math.sin(ang) * 3.1);
    chair.rotation.y = ang;
    addBox(chair, pal, pal.charcoalSteel, 0, -1.6, 0, 0.06, 3.2, 0.06);
    addBox(chair, pal, spokeCols[s % spokeCols.length], 0, -3.2, 0, 0.58, 0.45, 0.58);
    swingerRotor.add(chair);
    swingerChairs.push(chair);
  }
  addCollider(ctx.colliders, cx - 14, 0, cz - 9, 4.2, 6.5, 4.2);

  // Overhead Drifting Hot-Air Carnival Balloons + Sweeping Sky Spotlights + Confetti
  const balloons: Array<{ group: THREE.Group; baseX: number; baseY: number; baseZ: number; phase: number }> = [];
  [
    { x: -16, y: 24, z: -8, mat: pal.redAwning, hex: 0xdc2626 },
    { x: 14, y: 28, z: -12, mat: pal.tealAwning, hex: 0x0d9488 },
  ].forEach((b, idx) => {
    const bg = new THREE.Group();
    bg.position.set(b.x, b.y, b.z);
    const envBody = addBox(bg, pal, b.mat, 0, 1.8, 0, 3.4, 4.2, 3.4);
    const envBand = addBox(bg, pal, pal.warmGold, 0, 1.8, 0, 3.6, 0.9, 3.6);
    const basket = addBox(bg, pal, pal.terracottaWood, 0, -1.2, 0, 1.3, 1.0, 1.3);
    g.add(bg);
    balloons.push({ group: bg, baseX: b.x, baseY: b.y, baseZ: b.z, phase: idx * 2.1 });
    ctx.shootableBalloons?.push({
      group: bg,
      envelopeMeshes: [envBody, envBand],
      basketMeshes: [basket],
      baseX: b.x,
      baseY: b.y,
      baseZ: b.z,
      ampX: 1.8,
      ampZ: 1.4,
      phase: idx * 2.1,
      envelopeOffsetY: 1.8,
      hitRadius: 3.0,
      accentHex: b.hex,
    });
  });

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  ctx.materials.push(beamMat);
  const spotBeams: THREE.Mesh[] = [];
  [-18, 18].forEach((sx) => {
    const beam = new THREE.Mesh(pal.cylGeo, beamMat);
    beam.position.set(sx, 14, 0);
    beam.scale.set(2.4, 28, 2.4);
    g.add(beam);
    spotBeams.push(beam);
  });

  const confettiPieces: Array<{ mesh: THREE.Mesh; bx: number; bz: number; phase: number }> = [];
  const confMats = [pal.redAwning, pal.cyanNeon, pal.amberAwning, pal.tealAwning];
  for (let cf = 0; cf < (ctx.isSoftwareGl ? 10 : 18); cf++) {
    const cm = new THREE.Mesh(pal.boxGeo, confMats[cf % confMats.length]);
    cm.scale.set(0.24, 0.08, 0.24);
    const bx = ((cf * 7) % 36) - 18;
    const bz = ((cf * 11) % 32) - 16;
    cm.position.set(bx, 5 + (cf % 6), bz);
    g.add(cm);
    confettiPieces.push({ mesh: cm, bx, bz, phase: cf * 0.7 });
  }

  // Grounded Digital Festival Banner framed inside the Entrance Archway
  const festMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'APEX CARNIVAL · ALL 6 RIDES OPEN',
    subtitle: 'FERRIS · COASTER · BUMPER CARS · SWINGER · JOKERS',
    accentHex: '#f43f5e',
    intervalSec: 0.8,
  }).material;
  const festBanner = new THREE.Mesh(pal.boxGeo, festMat);
  festBanner.position.set(0, 5.45, -20.5);
  festBanner.scale.set(11.2, 3.0, 0.24);
  g.add(festBanner);

  ctx.updaters.push((dt, elapsed) => {
    ferrisWheel.rotation.z += dt * 0.36;
    for (let i = 0; i < gondolas.length; i++) {
      gondolas[i].rotation.z = -ferrisWheel.rotation.z;
    }
    carousel.rotation.y += dt * 0.9;
    for (let i = 0; i < carouselHorses.length; i++) {
      carouselHorses[i].position.y = 1.35 + Math.sin(elapsed * 3.6 + i * 1.1) * 0.32;
    }

    // Coaster 3-Car Train along track
    for (let i = 0; i < coasterCars.length; i++) {
      const t = (elapsed * 0.095 - i * 0.025 + 1) % 1;
      const pt = sampleRollerCoasterTrack(t, 0, 2);
      coasterCars[i].position.set(pt.x, pt.y + 0.15, pt.z);
      coasterCars[i].rotation.set(pt.pitch, pt.yaw, 0);
    }

    // Kiddie Mini-Train oval around plaza
    for (let i = 0; i < miniTrainCars.length; i++) {
      const ang = elapsed * 0.42 - i * 0.16;
      const nx = Math.cos(ang) * 9.8;
      const nz = 9.5 + Math.sin(ang) * 4.5;
      miniTrainCars[i].position.set(nx, 0.12, nz);
      miniTrainCars[i].rotation.y = -ang;
    }

    // Bumper Cars bouncing inside pavilion
    for (let i = 0; i < bumperCars.length; i++) {
      const t = elapsed * (1.2 + i * 0.25) + i * 1.6;
      bumperCars[i].position.set(
        bmpX + Math.sin(t) * 4.4,
        0.24,
        bmpZ + Math.cos(t * 1.35) * 3.2,
      );
      bumperCars[i].rotation.y = Math.atan2(Math.cos(t) * 4.4, -Math.sin(t * 1.35) * 3.2);
    }

    // Wave Swinger centrifugal tilt
    swingerRotor.rotation.y += dt * 1.45;
    swingerRotor.rotation.z = Math.sin(elapsed * 0.9) * 0.08;
    for (let i = 0; i < swingerChairs.length; i++) {
      swingerChairs[i].rotation.z = -0.34;
    }

    // Balloons (owned by WorldWildlifeController when shootableBalloons is active), Spotlights & Confetti
    if (!ctx.shootableBalloons) {
      for (let i = 0; i < balloons.length; i++) {
        const bl = balloons[i];
        bl.group.position.y = bl.baseY + Math.sin(elapsed * 0.7 + bl.phase) * 1.4;
        bl.group.position.x = bl.baseX + Math.cos(elapsed * 0.35 + bl.phase) * 1.8;
      }
    }
    spotBeams[0].rotation.z = Math.sin(elapsed * 0.8) * 0.32;
    spotBeams[1].rotation.z = -Math.cos(elapsed * 0.7) * 0.32;
    for (let i = 0; i < confettiPieces.length; i++) {
      const cp = confettiPieces[i];
      const yCycle = 9.5 - ((elapsed * 1.4 + cp.phase) % 8.5);
      cp.mesh.position.set(
        cp.bx + Math.sin(elapsed * 2.4 + cp.phase) * 0.9,
        yCycle,
        cp.bz + Math.cos(elapsed * 2.1 + cp.phase) * 0.9,
      );
      cp.mesh.rotation.y += dt * 3.2;
    }
  });

  return {
    stalls: [
      { x: cx - 16, z: cz - 17 },
      { x: cx - 6, z: cz - 17 },
      { x: cx + 4, z: cz - 17 },
      { x: cx + 14, z: cz - 17 },
    ],
    jokerSpots: [
      { x: cx - 3, z: cz + 8 },
      { x: cx + 4, z: cz + 14 },
      { x: cx - 7, z: cz - 3 },
      { x: cx + 6, z: cz - 6 },
      { x: cx - 11, z: cz + 1 },
      { x: cx + 1, z: cz + 17 },
      { x: cx - 16, z: cz - 2 },
      { x: cx + 11, z: cz - 14 },
    ],
    crowdSpots: [
      { x: cx - 7, z: cz + 2 },
      { x: cx + 6, z: cz + 3 },
      { x: cx - 1, z: cz + 16 },
      { x: cx + 11, z: cz - 2 },
      { x: cx - 13, z: cz - 4 },
      { x: cx + 2, z: cz - 11 },
      { x: cx - 18, z: cz + 12 },
      { x: cx + 17, z: cz + 15 },
      { x: cx + 14, z: cz - 4 },
      { x: cx - 16, z: cz - 14 },
      { x: cx + 5, z: cz - 16 },
      { x: cx - 5, z: cz - 16 },
    ],
  };
}

/**
 * SINGLE MAP-WIDE CLOSED-LOOP RAILWAY TRACK + 4 STATIONS WITH BENCHES + EXPRESS TRAIN
 */
function placeMapWideRailwaySystem(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  groundHeightAt: (x: number, z: number, y?: number) => number,
): {
  stationBenches: Array<{ x: number; y: number; z: number; yaw: number }>;
  trainCarStates: Array<{ x: number; y: number; z: number; yaw: number }>;
} {
  const pb = new PropMeshAssembler();
  const stationBenches: Array<{ x: number; y: number; z: number; yaw: number }> = [];

  // Continuous closed-loop track
  const stepMeters = ctx.isSoftwareGl ? 3.8 : 2.6;
  for (let d = 0; d < MEGA_RAILWAY_LOOP_LENGTH; d += stepMeters) {
    const pt = sampleRailwayLoop(d);
    const gy = groundHeightAt(pt.x, pt.z, 0);
    if (gy > 0.5) {
      pb.addCylinder(1.1, 1.25, gy, 8, pt.x, gy * 0.5, pt.z, 0x64748b);
    }
    const alongX = Math.abs(Math.sin(pt.yaw)) > 0.7;
    if (alongX) {
      pb.addBox(pt.x, gy + 0.08, pt.z, 0.5, 0.14, 2.6, 0x5c4033);
      pb.addBox(pt.x, gy + 0.2, pt.z - 0.9, stepMeters + 0.1, 0.16, 0.16, 0x94a3b8, 'glossy');
      pb.addBox(pt.x, gy + 0.2, pt.z + 0.9, stepMeters + 0.1, 0.16, 0.16, 0x94a3b8, 'glossy');
    } else {
      pb.addBox(pt.x, gy + 0.08, pt.z, 2.6, 0.14, 0.5, 0x5c4033);
      pb.addBox(pt.x - 0.9, gy + 0.2, pt.z, 0.16, 0.16, stepMeters + 0.1, 0x94a3b8, 'glossy');
      pb.addBox(pt.x + 0.9, gy + 0.2, pt.z, 0.16, 0.16, stepMeters + 0.1, 0x94a3b8, 'glossy');
    }
  }

  // 4 Scenic Railway Stations along the single loop with Modern Passenger Benches!
  for (const st of MEGA_RAILWAY_STATIONS) {
    const isHorizontal = st.side === 'north' || st.side === 'south';
    const platOff = st.side === 'north' ? 4.6 : st.side === 'south' ? -4.6 : st.side === 'east' ? -4.6 : 4.6;
    const px = isHorizontal ? st.x : st.x + platOff;
    const pz = isHorizontal ? st.z + platOff : st.z;
    const gy = groundHeightAt(px, pz, 0);

    const w = isHorizontal ? 26 : 5.2;
    const d = isHorizontal ? 5.2 : 26;
    pb.addBox(px, gy + 0.45, pz, w, 0.9, d, 0xe2e8f0);
    pb.addBox(px, gy + 3.9, pz, w - 1, 0.26, d - 0.6, 0x0284c7, 'glossy');
    [-1, 1].forEach((endSign) => {
      const ex = isHorizontal ? px + endSign * 9.5 : px;
      const ez = isHorizontal ? pz : pz + endSign * 9.5;
      pb.addCylinder(0.18, 0.22, 3.5, 8, ex, gy + 2.2, ez, 0x1e293b, 'glossy');
    });
    [-1.8, 1.8].forEach((off) => {
      pb.addCylinder(0.09, 0.09, 0.95, 8, isHorizontal ? px + off : px, gy + 3.4, isHorizontal ? pz : pz + off, 0x1e293b);
    });

    [-6.5, 0, 6.5].forEach((offset) => {
      const bx = isHorizontal ? px + offset : px;
      const bz = isHorizontal ? pz : pz + offset;
      const byaw = st.side === 'north' ? Math.PI : st.side === 'south' ? 0 : st.side === 'east' ? Math.PI * 0.5 : -Math.PI * 0.5;
      const bw = isHorizontal ? 2.4 : 0.8;
      const bd = isHorizontal ? 0.8 : 2.4;
      pb.addBox(bx, gy + 1.25, bz, bw, 0.14, bd, 0xb45309);
      pb.addBox(bx, gy + 1.0, bz, bw * 0.85, 0.38, bd * 0.8, 0x1e293b);
      stationBenches.push({ x: bx, y: gy + 0.9, z: bz, yaw: byaw });
    });

    const { material: boardMat } = ctx.displays.createDisplayMaterial('railway_timetable', {
      title: st.title,
    });
    const bMesh = new THREE.Mesh(pal.boxGeo, boardMat);
    bMesh.position.set(px, gy + 2.8, pz);
    bMesh.rotation.y = isHorizontal ? 0 : Math.PI * 0.5;
    bMesh.scale.set(6.4, 1.8, 0.22);
    ctx.arenaGroup.add(bMesh);
  }

  const propMats = createPropPbrMaterials(false);
  const trackBuilt = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  ctx.arenaGroup.add(trackBuilt.group);
  ctx.geometries.push(...trackBuilt.geometries);
  ctx.materials.push(...propMats.all, ...trackBuilt.materials);
  ctx.shootableEnv.push(trackBuilt.group);

  // Single 5-Car Aerodynamic Express Train
  const carGroups: THREE.Group[] = [];
  const trainCarStates: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  for (let c = 0; c < 5; c++) {
    const carPb = new PropMeshAssembler();
    const isLead = c === 0;
    const bodyCol = isLead ? 0x0ea5e9 : 0x0284c7;
    carPb.addBox(0, 0.65, 0, 2.2, 0.35, 8.8, 0x1e293b);
    [-3.1, 3.1].forEach((bz) => {
      carPb.addCylinder(0.38, 0.38, 2.4, 10, 0, 0.38, bz, 0x334155, 'glossy', 0, 0, Math.PI * 0.5);
    });
    carPb.addBox(0, 1.82, 0, 2.55, 2.0, 9.0, bodyCol, 'glossy');
    carPb.addCylinder(1.26, 1.26, 9.0, 12, 0, 2.82, 0, 0xf8fafc, 'glossy', Math.PI * 0.5, 0, 0);
    carPb.addBox(0, 2.1, 0, 2.6, 0.72, 7.6, 0x38bdf8, 'glass');
    if (isLead) {
      carPb.addCone(1.28, 2.2, 12, 0, 1.82, 5.5, 0xf97316, 'glossy', Math.PI * 0.5, 0, 0);
      carPb.addSphere(0.24, 1, 1, 1, -0.68, 1.35, 4.75, 0xfef08a, 'emissive');
      carPb.addSphere(0.24, 1, 1, 1, 0.68, 1.35, 4.75, 0xfef08a, 'emissive');
    }
    const carBuilt = carPb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
    carBuilt.group.userData.keepInArenaRoot = true;
    ctx.arenaGroup.add(carBuilt.group);
    ctx.geometries.push(...carBuilt.geometries);
    ctx.materials.push(...carBuilt.materials);
    carGroups.push(carBuilt.group);

    const initSample = sampleRailwayLoop(110 - c * 10.4);
    const initGy = groundHeightAt(initSample.x, initSample.z, 0);
    trainCarStates.push({ x: initSample.x, y: initGy + 0.95, z: initSample.z, yaw: initSample.yaw });
  }

  let trainDist = 110;
  let trainPauseTimer = 0;
  let lastStoppedStationId = '';

  ctx.updaters.push((dt) => {
    const head = sampleRailwayLoop(trainDist);
    if (head.nearestStation && head.distToStation < 2.2 && head.nearestStation.id !== lastStoppedStationId) {
      lastStoppedStationId = head.nearestStation.id;
      trainPauseTimer = 3.2;
    }
    if (trainPauseTimer > 0) {
      trainPauseTimer -= dt;
    } else {
      trainDist = (trainDist + 24 * dt) % MEGA_RAILWAY_LOOP_LENGTH;
      if (head.distToStation > 12) lastStoppedStationId = '';
    }

    for (let c = 0; c < carGroups.length; c++) {
      const sample = sampleRailwayLoop(trainDist - c * 10.4);
      const gy = groundHeightAt(sample.x, sample.z, 0);
      carGroups[c].position.set(sample.x, gy + 0.35, sample.z);
      carGroups[c].rotation.set(0, sample.yaw, 0);
      trainCarStates[c].x = sample.x;
      trainCarStates[c].y = gy + 0.95;
      trainCarStates[c].z = sample.z;
      trainCarStates[c].yaw = sample.yaw;
    }
  });

  return { stationBenches, trainCarStates };
}

/**
 * Builds Modern City Park & Children/Baby Playground with swings, slide, seesaw, fountain, pond & gym
 */
function placeModernParkPlayground(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  cx: number,
  cz: number,
) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  ctx.arenaGroup.add(g);

  const pb = new PropMeshAssembler();
  // Landscaped Park Lawn + Stone Cross Pathways
  pb.addBox(0, 0.04, 0, 50, 0.08, 46, 0x459242);
  pb.addBox(0, 0.06, 0, 50, 0.08, 5.2, 0xd6d3d1);
  pb.addBox(0, 0.06, 0, 5.2, 0.08, 46, 0xd6d3d1);

  // Central Circular Tiered Marble Fountain Plaza
  pb.addCylinder(5.4, 5.6, 0.32, 24, 0, 0.16, 0, 0xf1f5f9);
  pb.addCylinder(4.3, 4.3, 0.34, 24, 0, 0.28, 0, 0x0ea5e9, 'glass');
  pb.addCylinder(0.45, 0.72, 2.2, 14, 0, 1.35, 0, 0xf8fafc);
  pb.addCylinder(1.75, 1.35, 0.25, 18, 0, 2.2, 0, 0xe2e8f0);
  pb.addCylinder(0.45, 0.25, 0.75, 12, 0, 2.65, 0, 0x7dd3fc, 'glass');
  addCollider(ctx.colliders, cx, 0, cz, 7.3, 1.7, 7.3);

  // Organic Duck Pond + Wooden Footbridge & Circular Lily Pads
  pb.addCylinder(6.2, 6.4, 0.14, 22, -13, 0.08, 12, 0x0284c7, 'glass');
  pb.addBox(-13, 0.42, 12, 3.4, 0.2, 11.2, 0x92400e);
  pb.addBox(-14.6, 0.85, 12, 0.16, 0.9, 11.0, 0xb45309);
  pb.addBox(-11.4, 0.85, 12, 0.16, 0.9, 11.0, 0xb45309);
  [-16, -9.5].forEach((lx) => {
    pb.addCylinder(0.48, 0.48, 0.08, 12, lx, 0.17, 13.5, 0x22c55e);
  });

  // Colorful Playground Zone
  pb.addBox(12, 0.08, 8, 17, 0.12, 15, 0xfef3c7);
  pb.addBox(9.5, 1.5, 5, 2.2, 3.0, 2.2, 0xf59e0b);
  pb.addCone(2.0, 1.35, 4, 9.5, 3.6, 5, 0xdc2626, 'solid', 0, Math.PI * 0.25, 0);
  pb.addBox(9.5, 0.22, 12.2, 4.4, 0.44, 3.8, 0x92400e);
  pb.addBox(9.5, 0.34, 12.2, 3.8, 0.26, 3.2, 0xfde68a);

  // Fitness & Calisthenics Bar Station
  [-13, -9.5, -6].forEach((fx) => {
    pb.addCylinder(0.09, 0.09, 2.7, 8, fx, 1.35, -13, 0x1e293b);
  });
  pb.addCylinder(0.06, 0.06, 7.4, 8, -9.5, 2.65, -13, 0x94a3b8, 'glossy', 0, 0, Math.PI * 0.5);

  // Decorative Park Lamps & Organic Shade Trees
  [
    [-20, -18],
    [20, -18],
    [-20, 18],
    [20, 18],
  ].forEach(([tx, tz]) => {
    pb.addCylinder(0.24, 0.38, 3.2, 8, tx, 1.6, tz, 0x78350f);
    pb.addSphere(1.85, 1.15, 0.92, 1.15, tx, 4.1, tz, 0x15803d);
    addCollider(ctx.colliders, cx + tx, 0, cz + tz, 0.9, 3.2, 0.9);
  });
  [-8, 8].forEach((lx) => {
    [-8, 8].forEach((lz) => {
      pb.addCylinder(0.11, 0.14, 3.6, 8, lx, 1.8, lz, 0x1e293b);
      pb.addSphere(0.32, 1, 0.85, 1, lx, 3.7, lz, 0xfef08a, 'emissive');
    });
  });

  const propMats = createPropPbrMaterials(false);
  const built = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  g.add(built.group);
  ctx.geometries.push(...built.geometries);
  ctx.materials.push(...propMats.all, ...built.materials);
  ctx.shootableEnv.push(built.group);

  // Animated Slide Chute, Dual Swings & Seesaw
  addBox(g, pal, pal.redAwning, 9.5, 1.25, 7.6, 1.15, 0.18, 4.4, { rotX: 0.48 });
  addBox(g, pal, pal.charcoalSteel, 14, 1.6, 4.5, 0.18, 3.2, 0.18);
  addBox(g, pal, pal.charcoalSteel, 18.5, 1.6, 4.5, 0.18, 3.2, 0.18);
  addBox(g, pal, pal.charcoalSteel, 16.25, 3.15, 4.5, 4.8, 0.18, 0.18);
  const swingPivots: THREE.Group[] = [];
  [15.2, 17.3].forEach((sx) => {
    const piv = new THREE.Group();
    piv.position.set(sx, 3.1, 4.5);
    addBox(piv, pal, pal.charcoalSteel, -0.32, -1.15, 0, 0.05, 2.3, 0.05);
    addBox(piv, pal, pal.charcoalSteel, 0.32, -1.15, 0, 0.05, 2.3, 0.05);
    addBox(piv, pal, pal.amberAwning, 0, -2.3, 0, 0.85, 0.1, 0.48);
    g.add(piv);
    swingPivots.push(piv);
  });

  addBox(g, pal, pal.charcoalSteel, 14.5, 0.4, 11.5, 0.45, 0.8, 0.45);
  const seesawPlank = addBox(g, pal, pal.tealAwning, 14.5, 0.85, 11.5, 4.6, 0.14, 0.65);

  const benches: Array<{ x: number; z: number; yaw: number }> = [
    { x: cx - 6, z: cz + 2, yaw: Math.PI * 0.5 },
    { x: cx + 6, z: cz - 2, yaw: -Math.PI * 0.5 },
    { x: cx - 2, z: cz - 7, yaw: 0 },
    { x: cx + 3, z: cz + 7, yaw: Math.PI },
  ];
  benches.forEach((b) => {
    addBox(ctx.arenaGroup, pal, pal.terracottaWood, b.x, 0.45, b.z, 2.2, 0.14, 0.72, { rotY: b.yaw });
    addBox(ctx.arenaGroup, pal, pal.charcoalSteel, b.x, 0.22, b.z, 1.9, 0.4, 0.6, { rotY: b.yaw });
  });

  ctx.updaters.push((_dt, elapsed) => {
    swingPivots[0].rotation.x = Math.sin(elapsed * 2.6) * 0.42;
    swingPivots[1].rotation.x = Math.sin(elapsed * 2.6 + 1.4) * 0.38;
    seesawPlank.rotation.z = Math.sin(elapsed * 2.1) * 0.24;
  });

  return { benches };
}

/**
 * Adds a 4-Way Road Traffic Signal Set + Grounded Overhead Gantry Supports (no floating screens!)
 */
function placeIntersectionSignals(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  ix: number,
  iz: number,
  offsetSec: number,
): SignalVisualGroup {
  const nsRed = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const nsYellow = new THREE.MeshBasicMaterial({ color: 0x2e2404 });
  const nsGreen = new THREE.MeshBasicMaterial({ color: 0x052e16 });
  const ewRed = new THREE.MeshBasicMaterial({ color: 0x2a0808 });
  const ewYellow = new THREE.MeshBasicMaterial({ color: 0x2e2404 });
  const ewGreen = new THREE.MeshBasicMaterial({ color: 0x22ff66 });
  ctx.materials.push(nsRed, nsYellow, nsGreen, ewRed, ewYellow, ewGreen);

  [
    { x: ix - 8.5, z: iz - 8.5, mats: [nsRed, nsYellow, nsGreen], rotY: 0 },
    { x: ix + 8.5, z: iz + 8.5, mats: [nsRed, nsYellow, nsGreen], rotY: Math.PI },
    { x: ix + 8.5, z: iz - 8.5, mats: [ewRed, ewYellow, ewGreen], rotY: -Math.PI * 0.5 },
    { x: ix - 8.5, z: iz + 8.5, mats: [ewRed, ewYellow, ewGreen], rotY: Math.PI * 0.5 },
  ].forEach((pole) => {
    const pg = new THREE.Group();
    pg.position.set(pole.x, 0, pole.z);
    pg.rotation.y = pole.rotY;
    addBox(pg, pal, pal.charcoalSteel, 0, 2.6, 0, 0.24, 5.2, 0.24);
    addBox(pg, pal, pal.charcoalSteel, 0, 4.9, 1.4, 0.18, 0.18, 3.0);
    addBox(pg, pal, pal.charcoalSteel, 0, 4.6, 2.6, 0.52, 1.35, 0.42);
    addBox(pg, pal, pole.mats[0], 0, 5.02, 2.6, 0.34, 0.28, 0.48);
    addBox(pg, pal, pole.mats[1], 0, 4.6, 2.6, 0.34, 0.28, 0.48);
    addBox(pg, pal, pole.mats[2], 0, 4.18, 2.6, 0.34, 0.28, 0.48);
    ctx.arenaGroup.add(pg);
  });

  // Grounded Overhead Digital Traffic Gantry (Left + Right Sidewalk Steel Columns & Crossbeam Truss!)
  const gantryZ = iz - 10.2;
  addBox(ctx.arenaGroup, pal, pal.charcoalSteel, ix - 9.4, 3.6, gantryZ, 0.48, 7.2, 0.48);
  addBox(ctx.arenaGroup, pal, pal.charcoalSteel, ix + 9.4, 3.6, gantryZ, 0.48, 7.2, 0.48);
  addBox(ctx.arenaGroup, pal, pal.charcoalSteel, ix, 6.9, gantryZ, 19.3, 0.42, 0.42);
  addBox(ctx.arenaGroup, pal, pal.charcoalSteel, ix - 3.2, 6.6, gantryZ, 0.22, 0.8, 0.26);
  addBox(ctx.arenaGroup, pal, pal.charcoalSteel, ix + 3.2, 6.6, gantryZ, 0.22, 0.8, 0.26);
  addCollider(ctx.colliders, ix - 9.4, 0, gantryZ, 0.55, 7.2, 0.55, 0, 'metal');
  addCollider(ctx.colliders, ix + 9.4, 0, gantryZ, 0.55, 7.2, 0.55, 0, 'metal');

  const gantryMat = ctx.displays.createDisplayMaterial('traffic_gantry', {
    intervalSec: 0.5,
  }).material;
  const gBoard = new THREE.Mesh(pal.boxGeo, gantryMat);
  gBoard.position.set(ix, 6.25, gantryZ);
  gBoard.scale.set(9.2, 2.2, 0.28);
  ctx.arenaGroup.add(gBoard);

  return { x: ix, z: iz, offsetSec, nsRed, nsYellow, nsGreen, ewRed, ewYellow, ewGreen };
}

function populateInstancedFlora(
  arenaGroup: THREE.Group,
  textures: ProceduralTextureSet,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  groundHeightAt: (x: number, z: number, y?: number) => number,
  quality: GraphicsQuality,
  isSoftwareGl: boolean,
  worldStreaming?: WorldStreamingController,
): {
  grassSystem: InstancedGrassSystem | null;
  treePerches: Array<{ x: number; y: number; z: number }>;
  updateTrees: (elapsed: number) => void;
} {
  const flowerCoords: Array<{ x: number; z: number; colIdx: number }> = [];
  const deciduousTrees: Array<{ x: number; y: number; z: number; scale: number; rotY: number; tintHex?: number }> = [];
  const pineTrees: Array<{ x: number; y: number; z: number; scale: number; rotY: number; tintHex?: number }> = [];
  const grassSamples: Array<{ x: number; y: number; z: number; scale: number; rotY: number }> = [];
  const boulderPlacements: Array<{ x: number; y: number; z: number; scaleX: number; scaleY: number; scaleZ: number; rotY: number }> = [];

  const isLowQ = quality === 'low';
  const isMedQ = quality === 'medium';
  const useLambertFlora = isLowQ || isMedQ;

  const zones = [
    { cx: -46, cz: 44, r: 22, count: isLowQ ? 50 : isMedQ ? 80 : isSoftwareGl ? 60 : 140 },
    { cx: 112, cz: 202, r: 24, count: isLowQ ? 40 : isMedQ ? 65 : isSoftwareGl ? 50 : 110 },
    { cx: -120, cz: -175, r: 26, count: isLowQ ? 32 : isMedQ ? 52 : isSoftwareGl ? 40 : 90 },
    { cx: -115, cz: 118, r: 22, count: isLowQ ? 26 : isMedQ ? 42 : isSoftwareGl ? 35 : 70 },
    { cx: 26, cz: 58, r: 16, count: isLowQ ? 20 : isMedQ ? 30 : isSoftwareGl ? 25 : 50 },
  ];

  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (const zInfo of zones) {
    for (let i = 0; i < zInfo.count; i++) {
      const fx = zInfo.cx + (rand() - 0.5) * zInfo.r * 2;
      const fz = zInfo.cz + (rand() - 0.5) * zInfo.r * 2;
      if (isOnMegaRoad(fx, fz) || isInsidePavedBuildingPad(fx, fz, 4) || isInsideMansionProperty(fx, fz, 6)) continue;
      flowerCoords.push({ x: fx, z: fz, colIdx: i % 4 });
    }
  }

  const treeCount = isLowQ ? 85 : isMedQ ? 125 : isSoftwareGl ? 105 : 190;
  for (let i = 0; i < treeCount; i++) {
    const tx = -240 + rand() * 785;
    const tz = (rand() - 0.5) * 440;
    if (isOnMegaRoad(tx, tz) || isInsidePavedBuildingPad(tx, tz, 6) || isInsideMansionProperty(tx, tz, 6) || isInSmartCityZone(tx, tz) || isInScienceDistrictZone(tx, tz, 6)) continue;
    if (Math.abs(Math.abs(tx) - 228) < 8 || Math.abs(Math.abs(tz) - 228) < 8) continue;
    if (Math.hypot(tx - 26, tz - 34) < 26 || Math.hypot(tx + 44, tz + 36) < 28) continue;
    if (Math.hypot(tx - 84, tz - 86) < 34 || Math.hypot(tx - 186, tz - 36) < 28) continue;
    if (Math.hypot(tx - 188, tz + 195) < 34 || Math.hypot(tx + 195, tz - 205) < 22) continue;
    if (tx >= 255 && Math.abs(tz) < 210) {
      const inCentralPark = tx >= 450 && tx <= 500 && tz >= 12 && tz <= 72;
      const onCoastBeach = tx >= 530 && tx <= 548;
      if (!inCentralPark && !onCoastBeach && i % 3 !== 0) continue;
      if (BAY_CITY_AVENUE_X.some((ax) => Math.abs(tx - ax) < 16)) continue;
      if (BAY_CITY_AVENUE_Z.some((az) => Math.abs(tz - az) < 16)) continue;
    }
    const gy = groundHeightAt(tx, tz, 0);
    if (gy < -0.25) continue;
    const isPine = tx < -140 && tz < -140;
    const sc = 0.85 + rand() * 0.55;
    if (isPine) {
      pineTrees.push({ x: tx, y: gy, z: tz, scale: sc, rotY: rand() * Math.PI * 2, tintHex: gy > 5 ? 0xdbeafe : undefined });
    } else {
      deciduousTrees.push({ x: tx, y: gy, z: tz, scale: sc, rotY: rand() * Math.PI * 2 });
    }
  }

  // GPU-instanced wind-animated grass blades scattered across parks, riverbanks & outer meadows
  const grassTargetCount = isLowQ ? 500 : isMedQ ? 850 : isSoftwareGl ? 800 : 1400;
  for (let i = 0; i < grassTargetCount; i++) {
    const gx = -245 + rand() * 790;
    const gz = (rand() - 0.5) * 440;
    if (isOnMegaRoad(gx, gz) || isInsidePavedBuildingPad(gx, gz, 5) || isInsideMansionProperty(gx, gz, 6) || isInSmartCityZone(gx, gz) || isInScienceDistrictZone(gx, gz, 6)) continue;
    if (gx >= 245 && gx < 530 && Math.abs(gz) < 168) {
      const inPark = gx >= 450 && gx <= 500 && gz >= 12 && gz <= 72;
      if (!inPark) continue;
    }
    const gy = groundHeightAt(gx, gz, 0);
    if (gy < -0.2 || gy > 6.5) continue;
    grassSamples.push({ x: gx, y: gy, z: gz, scale: 0.78 + rand() * 0.75, rotY: rand() * Math.PI * 2 });
  }

  // Sculpted organic boulders along NW mountain slopes, riverbanks & coastal cliffs
  const boulderTargetCount = isLowQ ? 24 : isMedQ ? 42 : isSoftwareGl ? 36 : 72;
  for (let i = 0; i < boulderTargetCount; i++) {
    const bx = -255 + rand() * 800;
    const bz = (rand() - 0.5) * 460;
    if (isOnMegaRoad(bx, bz) || isInsidePavedBuildingPad(bx, bz, 5) || isInsideMansionProperty(bx, bz, 6) || isInSmartCityZone(bx, bz) || isInScienceDistrictZone(bx, bz, 6)) continue;
    if (Math.abs(bx) < 220 && Math.abs(bz) < 215 && !(bx < -150 && bz < -150)) continue;
    const by = groundHeightAt(bx, bz, 0);
    if (by < -0.6) continue;
    const s = 0.8 + rand() * 1.9;
    boulderPlacements.push({
      x: bx,
      y: by + s * 0.22,
      z: bz,
      scaleX: s * (0.9 + rand() * 0.4),
      scaleY: s * (0.65 + rand() * 0.35),
      scaleZ: s * (0.9 + rand() * 0.4),
      rotY: rand() * Math.PI * 2,
    });
  }

  const buildFlowersInParent = (
    targetParent: THREE.Object3D,
    coords: Array<{ x: number; z: number; colIdx: number }>,
  ) => {
    if (coords.length === 0) return;
    const stemGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.34, 6);
    const bloomGeo = new THREE.IcosahedronGeometry(0.22, isLowQ ? 0 : 1);
    geometries.push(stemGeo, bloomGeo);
    const stemMat = useLambertFlora
      ? new THREE.MeshLambertMaterial({ color: 0x15803d })
      : new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const bloomMat = useLambertFlora
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    materials.push(stemMat, bloomMat);

    const stemsIm = new THREE.InstancedMesh(stemGeo, stemMat, coords.length);
    const bloomsIm = new THREE.InstancedMesh(bloomGeo, bloomMat, coords.length);
    const dummy = new THREE.Object3D();
    const paletteHex = [0xf43f5e, 0xfacc15, 0xec4899, 0xa855f7];
    const col = new THREE.Color();

    for (let i = 0; i < coords.length; i++) {
      const f = coords[i];
      const gy = groundHeightAt(f.x, f.z, 0);
      dummy.position.set(f.x, gy + 0.16, f.z);
      dummy.rotation.set(0, i * 0.7, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stemsIm.setMatrixAt(i, dummy.matrix);

      dummy.position.set(f.x, gy + 0.36, f.z);
      dummy.scale.set(1, 0.72, 1);
      dummy.updateMatrix();
      bloomsIm.setMatrixAt(i, dummy.matrix);
      col.setHex(paletteHex[f.colIdx]);
      bloomsIm.setColorAt(i, col);
    }
    stemsIm.instanceMatrix.needsUpdate = true;
    bloomsIm.instanceMatrix.needsUpdate = true;
    if (bloomsIm.instanceColor) bloomsIm.instanceColor.needsUpdate = true;
    stemsIm.computeBoundingSphere();
    bloomsIm.computeBoundingSphere();
    targetParent.add(stemsIm, bloomsIm);
  };

  const treePerches: Array<{ x: number; y: number; z: number }> = [];
  const treeUpdaters: Array<{ highGroup: THREE.Object3D; update: (elapsed: number) => void }> = [];

  if (worldStreaming) {
    const FLORA_CELL = 180;
    const cells = new Map<
      string,
      {
        decid: typeof deciduousTrees;
        pine: typeof pineTrees;
        boulders: typeof boulderPlacements;
        flowers: typeof flowerCoords;
      }
    >();
    const getCell = (x: number, z: number) => {
      const k = `${Math.floor(x / FLORA_CELL)}_${Math.floor(z / FLORA_CELL)}`;
      let c = cells.get(k);
      if (!c) {
        c = { decid: [], pine: [], boulders: [], flowers: [] };
        cells.set(k, c);
      }
      return c;
    };
    deciduousTrees.forEach((t) => getCell(t.x, t.z).decid.push(t));
    pineTrees.forEach((t) => getCell(t.x, t.z).pine.push(t));
    boulderPlacements.forEach((b) => getCell(b.x, b.z).boulders.push(b));
    flowerCoords.forEach((f) => getCell(f.x, f.z).flowers.push(f));

    for (const [key, cell] of cells.entries()) {
      const highGroup = new THREE.Group();
      highGroup.name = `flora_high_${key}`;
      const lowGroup = new THREE.Group();
      lowGroup.name = `flora_low_${key}`;

      buildFlowersInParent(highGroup, cell.flowers);
      const decBuilt = populateOrganicTrees(highGroup, cell.decid, textures, geometries, materials, { isSoftwareGl, pine: false, graphicsQuality: quality });
      const pineBuilt = populateOrganicTrees(highGroup, cell.pine, textures, geometries, materials, { isSoftwareGl, pine: true, graphicsQuality: quality });
      populateOrganicBoulders(highGroup, cell.boulders, textures, geometries, materials, { isSoftwareGl, graphicsQuality: quality });

      populateLowPolyTrees(lowGroup, cell.decid, geometries, materials, { pine: false, graphicsQuality: quality });
      populateLowPolyTrees(lowGroup, cell.pine, geometries, materials, { pine: true, graphicsQuality: quality });

      if (decBuilt) {
        treePerches.push(...decBuilt.perchSpots);
        treeUpdaters.push({ highGroup, update: decBuilt.update });
      }
      if (pineBuilt) {
        treePerches.push(...pineBuilt.perchSpots);
        treeUpdaters.push({ highGroup, update: pineBuilt.update });
      }

      highGroup.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(highGroup);
      if (!box.isEmpty()) {
        worldStreaming.registerPropChunk({
          id: `flora_${key}`,
          parent: arenaGroup,
          highGroup,
          lowGroup: lowGroup.children.length > 0 ? lowGroup : null,
          box,
          lodDist: isLowQ ? 85 : isMedQ ? 120 : 175,
          loadDist: isLowQ ? 215 : isMedQ ? 280 : 370,
          unloadDist: isLowQ ? 265 : isMedQ ? 345 : 445,
        });
      }
    }
  } else {
    buildFlowersInParent(arenaGroup, flowerCoords);
    const decTrees = populateOrganicTrees(arenaGroup, deciduousTrees, textures, geometries, materials, { isSoftwareGl, pine: false });
    const pineTreesBuilt = populateOrganicTrees(arenaGroup, pineTrees, textures, geometries, materials, { isSoftwareGl, pine: true });
    populateOrganicBoulders(arenaGroup, boulderPlacements, textures, geometries, materials, { isSoftwareGl });
    if (decTrees) {
      treePerches.push(...decTrees.perchSpots);
      treeUpdaters.push({ highGroup: arenaGroup, update: decTrees.update });
    }
    if (pineTreesBuilt) {
      treePerches.push(...pineTreesBuilt.perchSpots);
      treeUpdaters.push({ highGroup: arenaGroup, update: pineTreesBuilt.update });
    }
  }

  const grassSystem = populateInstancedGrass(arenaGroup, grassSamples, geometries, materials, quality, isSoftwareGl, false);
  if (grassSystem) {
    grassSystem.mesh.userData.keepInArenaRoot = true;
  }
  return {
    grassSystem,
    treePerches,
    updateTrees: (elapsed: number) => {
      for (let i = 0; i < treeUpdaters.length; i++) {
        const tu = treeUpdaters[i];
        if (tu.highGroup.parent && tu.highGroup.visible) {
          tu.update(elapsed);
        }
      }
    },
  };
}

export function buildUnifiedSimulatorArena(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
  graphicsQuality: GraphicsQuality = 'medium',
): BuiltArena {
  const arenaGroup = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const ramps: RampSurface[] = [];
  const coverNodes: CoverNode[] = [];
  const doorways: DoorwayTrigger[] = [];
  const interactables: WorldInteractable[] = [];
  const barrels: BarrelActor[] = [];
  const shootableEnv: THREE.Object3D[] = [];
  const breakableGlass: BreakableGlassPane[] = [];
  const shootableBalloons: BalloonRegistration[] = [];
  const supplyCrates: SupplyCrateActor[] = [];
  const clouds: THREE.Group[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const streetLampMats: THREE.MeshBasicMaterial[] = [];
  const windowEmissiveMats: Array<THREE.MeshStandardMaterial | THREE.MeshLambertMaterial> = [];
  const nightGlowMats: Array<{ mat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial; nightHex: number; dayHex: number; nightIntensity: number }> = [];
  const lodDetailGroups: {
    group: THREE.Group;
    x: number;
    z: number;
    maxDist: number;
    y?: number;
    radius?: number;
    tier?: 'district' | 'detail';
  }[] = [];
  const updaters: Array<(dt: number, elapsed: number, cameraPos?: THREE.Vector3 | null) => void> = [
    (dt) => {
      stepBreakableGlassPanes(breakableGlass, dt);
    },
  ];

  const isLowQ = graphicsQuality === 'low';
  const isMedQ = graphicsQuality === 'medium';
  const isReducedQ = isLowQ || isMedQ;

  const displays = new DigitalDisplayManager();
  const worldStreaming = new WorldStreamingController();
  const pal = createCompoundPalette(textures, isSoftwareGl, graphicsQuality);
  const groundHeightAt = (x: number, z: number, currentY?: number) =>
    unifiedSimulatorGroundHeight(x, z, currentY, ramps);

  scene.background = new THREE.Color(0x9bd2f7);
  scene.fog = new THREE.FogExp2(0xbadff5, 0.00085);

  const skyDome = createAtmosphericSkyDome(arenaGroup, geometries, materials, {
    radius: 2950,
    isNight: false,
    cloudCount: isLowQ ? 22 : isMedQ ? 34 : isSoftwareGl ? 36 : 54,
  });
  skyDome.mesh.userData.keepInArenaRoot = true;
  skyDome.cloudInstanced.userData.keepInArenaRoot = true;

  const tmpC = new THREE.Color();
  const grassC = new THREE.Color(0x4c9342);
  const eastGrassC = new THREE.Color(0x52a347);
  const westEcoGrassC = new THREE.Color(0x16a34a);
  const redRockC = new THREE.Color(0xc2410c);
  const desertSandC = new THREE.Color(0xeab308);
  const sidewalkC = new THREE.Color(0xb1bac5);
  const snowC = new THREE.Color(0xdbe6f2);
  const alpineRockC = new THREE.Color(0x5b6b5d);
  const riverBedC = new THREE.Color(0x1f4b68);
  const farmSoilC = new THREE.Color(0x7c5329);
  const beachSandC = new THREE.Color(0xe6cc90);
  const oceanBedC = new THREE.Color(0x0c4a6e);
  const chinatownStoneC = new THREE.Color(0xb8a992);
  const tarmacC = new THREE.Color(0x475569);

  const isNearMegaRoad = (vx: number, vz: number): boolean => {
    if (isOnMegaRoad(vx, vz)) return true;
    if (distanceToSingleSmartCityRoad(vx, vz) <= 13) return true;
    const step = 11;
    return (
      isOnMegaRoad(vx - step, vz) ||
      isOnMegaRoad(vx + step, vz) ||
      isOnMegaRoad(vx, vz - step) ||
      isOnMegaRoad(vx, vz + step) ||
      isOnMegaRoad(vx - step, vz - step) ||
      isOnMegaRoad(vx + step, vz - step) ||
      isOnMegaRoad(vx - step, vz + step) ||
      isOnMegaRoad(vx + step, vz + step)
    );
  };

  const sampleMegaTerrainHeight = (vx: number, vz: number): number => {
    let vy = unifiedSimulatorGroundHeight(vx, vz);
    const onRoad = isOnMegaRoad(vx, vz);
    const nearRoad = onRoad || isNearMegaRoad(vx, vz);
    if (onRoad && isOnSmartCityRoad(vx, vz)) {
      vy = -0.24;
    }
    const inMansionPad = isInsideMansionProperty(vx, vz, 6);
    const inSmartCityPad = isInSmartCityZone(vx, vz);
    const inSciencePad = isInScienceDistrictZone(vx, vz, 6);
    const inInnerCity = Math.abs(vx) < 225 && Math.abs(vz) < 225;
    if (!nearRoad && !inInnerCity && !inMansionPad && !inSmartCityPad && !inSciencePad && vy >= -0.05 && vy < 4.5 && !(vx >= 250 && vx < 544 && Math.abs(vz) < 165)) {
      vy += (fbm2D(vx * 0.025, vz * 0.025, 3) - 0.45) * 0.65;
    }
    const inMallPad = isInsidePavedBuildingPad(vx, vz, 8.5);
    const inChinatownPad = vx >= 792 && vx <= 1126 && vz >= 160 && vz <= 304;
    const inCastleGround = vx >= 1162 && vx <= 1408 && vz >= 98 && vz <= 278;
    const inAirportPad = vx >= 1144 && vx <= 1456 && vz >= -282 && vz <= -152;
    if ((inMallPad || inMansionPad || inSciencePad || inChinatownPad || inCastleGround || inAirportPad) && Math.abs(vy) < 0.35) {
      vy = -0.24;
    } else if (nearRoad && Math.abs(vy) < 0.35) {
      vy = -0.22;
    }
    return vy;
  };

  const sampleMegaTerrainColorAndMask = (vx: number, vz: number, vy: number): number => {
    const inMansionPad = isInsideMansionProperty(vx, vz, 6);
    const inSmartCityPad = isInSmartCityZone(vx, vz);
    const inSciencePad = isInScienceDistrictZone(vx, vz, 4);
    const inMallPad = isInsidePavedBuildingPad(vx, vz, 8.5);
    const inChinatownPad = vx >= 792 && vx <= 1126 && vz >= 160 && vz <= 304;
    const inCastleGround = vx >= 1162 && vx <= 1408 && vz >= 98 && vz <= 278;
    const inAirportPad = vx >= 1144 && vx <= 1456 && vz >= -282 && vz <= -152;

    let rMask = 0.0;
    if (inChinatownPad && vy <= 0.1) {
      tmpC.copy(chinatownStoneC);
      rMask = 0.96;
    } else if ((inMallPad || inMansionPad || inSciencePad) && vy <= 0.1) {
      tmpC.copy(sidewalkC);
      rMask = 0.96;
    } else if (inCastleGround && vy <= 0.1) {
      tmpC.copy(chinatownStoneC);
      rMask = 0.96;
    } else if (inAirportPad && vy <= 0.1) {
      tmpC.copy(tarmacC);
      rMask = 1.0;
    } else if (vx < -265) {
      if (vy > 3.0) {
        tmpC.copy(redRockC);
      } else if (vy < -0.5) {
        tmpC.copy(oceanBedC);
      } else if (vx >= -444) {
        tmpC.copy(vx <= -424 || vx >= -286 ? beachSandC : oceanBedC);
      } else if (vx < -895 && vz <= 35) {
        tmpC.copy(tarmacC);
        rMask = 1.0;
      } else if (vx < -895 && vz > 35) {
        tmpC.copy(desertSandC);
      } else if (vx <= -1135 || Math.abs(vz) > 292 || vx >= -462) {
        tmpC.copy(beachSandC);
      } else if (vz <= -38) {
        tmpC.copy(tarmacC);
        rMask = 0.85;
      } else {
        tmpC.copy(westEcoGrassC);
      }
    } else if (vx >= 740) {
      if (vy > 13.5) {
        tmpC.copy(snowC);
      } else if (vy > 3.0) {
        tmpC.copy(alpineRockC);
      } else if (vy < -0.5) {
        tmpC.copy(vx < 782 && Math.hypot(vx - 742, vz + 155) >= 24 ? oceanBedC : riverBedC);
      } else if (vx >= 1148 && vx <= 1455 && vz <= -140 && vz >= -285) {
        tmpC.copy(tarmacC);
        rMask = 1.0;
      } else if (vx >= 800 && vx <= 1110 && vz >= 175 && vz <= 290) {
        tmpC.copy(chinatownStoneC);
        rMask = 0.9;
      } else if ((vx >= 780 && vx <= 792) || Math.abs(vz) > 304 || vx > 1478) {
        tmpC.copy(beachSandC);
      } else {
        tmpC.copy(eastGrassC);
      }
    } else if (vy > 6.5) {
      tmpC.copy(snowC);
    } else if (vy > 2.6) {
      tmpC.copy(alpineRockC);
    } else if (vx > 574) {
      tmpC.copy(oceanBedC);
    } else if (vx >= 544 && vx <= 574) {
      tmpC.copy(beachSandC);
    } else if (vy < -0.5) {
      tmpC.copy(riverBedC);
    } else if (vx >= -135 && vx <= -90 && vz >= -205 && vz <= -155) {
      tmpC.copy(farmSoilC);
      rMask = 0.45;
    } else if (inSmartCityPad && isInsideSmartCityDome(vx, vz) && vx <= -178 && vz >= -556 && vz <= -486) {
      tmpC.copy(farmSoilC);
      rMask = 0.25;
    } else if (inSmartCityPad && isInsideSmartCityDome(vx, vz)) {
      tmpC.copy(sidewalkC);
      rMask = 0.55;
    } else if (vx >= 450 && vx <= 500 && vz >= 12 && vz <= 72) {
      tmpC.copy(grassC);
    } else {
      tmpC.copy(grassC);
    }
    return rMask;
  };

  const terrainSplat = createSplatTerrainMaterial(textures, {
    waterLevel: -0.45,
    snowStartY: 13.5,
    isNight: false,
    graphicsQuality,
  });
  materials.push(terrainSplat.material);

  const terrainRoot = new THREE.Group();
  terrainRoot.name = 'MegaWorldTerrainChunks';
  terrainRoot.userData.keepInArenaRoot = true;
  arenaGroup.add(terrainRoot);

  // Build 16x8 = 128 streamed Terrain Chunks with High-Res and Low-Poly (4x4) LOD geometries
  const TERRAIN_MIN_X = -1280;
  const TERRAIN_MAX_X = 1620;
  const TERRAIN_MIN_Z = -900;
  const TERRAIN_MAX_Z = 540;
  const TILE_COLS = 16;
  const TILE_ROWS = 8;
  const tileW = (TERRAIN_MAX_X - TERRAIN_MIN_X) / TILE_COLS;
  const tileD = (TERRAIN_MAX_Z - TERRAIN_MIN_Z) / TILE_ROWS;
  const highSegsX = isLowQ ? 8 : isMedQ ? 12 : isSoftwareGl ? 12 : 18;
  const highSegsZ = isLowQ ? 8 : isMedQ ? 12 : isSoftwareGl ? 12 : 20;

  const buildTerrainTileGeo = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    segX: number,
    segZ: number,
  ): { geo: THREE.BufferGeometry; minY: number; maxY: number } => {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) * 0.5, 0, (z0 + z1) * 0.5);
    const pAttr = geo.attributes.position;
    const nAttr = geo.attributes.normal;
    const cols = new Float32Array(pAttr.count * 3);
    const masks = new Float32Array(pAttr.count);
    let minY = Infinity;
    let maxY = -Infinity;
    const normEps = 3.5;

    for (let i = 0; i < pAttr.count; i++) {
      const vx = pAttr.getX(i);
      const vz = pAttr.getZ(i);
      const vy = sampleMegaTerrainHeight(vx, vz);
      pAttr.setY(i, vy);
      if (vy < minY) minY = vy;
      if (vy > maxY) maxY = vy;

      const rMask = sampleMegaTerrainColorAndMask(vx, vz, vy);
      masks[i] = rMask;
      cols[i * 3] = tmpC.r;
      cols[i * 3 + 1] = tmpC.g;
      cols[i * 3 + 2] = tmpC.b;

      // Globally continuous central-difference normals ensure seamless borders across adjacent chunks & LODs
      const hL = sampleMegaTerrainHeight(vx - normEps, vz);
      const hR = sampleMegaTerrainHeight(vx + normEps, vz);
      const hD = sampleMegaTerrainHeight(vx, vz - normEps);
      const hU = sampleMegaTerrainHeight(vx, vz + normEps);
      const nx = hL - hR;
      const ny = normEps * 2;
      const nz = hD - hU;
      const len = Math.hypot(nx, ny, nz) || 1;
      nAttr.setXYZ(i, nx / len, ny / len, nz / len);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setAttribute('aRoadMask', new THREE.BufferAttribute(masks, 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return { geo, minY, maxY };
  };

  for (let row = 0; row < TILE_ROWS; row++) {
    for (let col = 0; col < TILE_COLS; col++) {
      const x0 = TERRAIN_MIN_X + col * tileW;
      const x1 = x0 + tileW;
      const z0 = TERRAIN_MIN_Z + row * tileD;
      const z1 = z0 + tileD;
      const highBuilt = buildTerrainTileGeo(x0, x1, z0, z1, highSegsX, highSegsZ);
      const lowBuilt = buildTerrainTileGeo(x0, x1, z0, z1, 4, 4);
      const mesh = new THREE.Mesh(highBuilt.geo, terrainSplat.material);
      mesh.receiveShadow = true;
      const box = new THREE.Box3(
        new THREE.Vector3(x0, Math.min(highBuilt.minY, lowBuilt.minY) - 0.5, z0),
        new THREE.Vector3(x1, Math.max(highBuilt.maxY, lowBuilt.maxY) + 0.5, z1),
      );
      worldStreaming.registerTerrainChunk({
        id: `${col}_${row}`,
        parent: terrainRoot,
        mesh,
        highGeo: highBuilt.geo,
        lowGeo: lowBuilt.geo,
        box,
      });
    }
  }
  // NOTE: Terrain chunks intentionally excluded from shootableEnv (analytical groundHeightAt handles shots & LOS at 60+ FPS).

  // Realistic Animated Water Systems (Seine River, Bay & West Oceans, Emerald Lake + Cascade)
  const oceanSegX = isLowQ ? 26 : isMedQ ? 42 : isSoftwareGl ? 42 : 72;
  const oceanSegZ = isLowQ ? 22 : isMedQ ? 36 : isSoftwareGl ? 36 : 56;
  const waters: RealisticWaterSystem[] = [];
  const seineWaterSys = createRealisticWater(245, SEINE_HALF_W * 1.9, -0.95, (x, z) => groundHeightAt(x, z, 0), textures, geometries, materials, {
    segsX: isLowQ ? 20 : isMedQ ? 32 : 48,
    segsZ: isLowQ ? 6 : isMedQ ? 8 : 12,
    centerX: -144,
    centerZ: SEINE_RIVER_Z,
  });
  const bayOceanSys = createRealisticWater(1060, 900, -0.45, (x, z) => groundHeightAt(x, z, 0), textures, geometries, materials, {
    segsX: oceanSegX,
    segsZ: oceanSegZ,
    centerX: 1090,
    centerZ: 0,
  });
  const westOceanSys = createRealisticWater(1015, 900, -0.45, (x, z) => groundHeightAt(x, z, 0), textures, geometries, materials, {
    segsX: oceanSegX,
    segsZ: oceanSegZ,
    centerX: -772.5,
    centerZ: 0,
  });
  const lakeWaterSys = createRealisticWater(35, 35, -0.75, (x, z) => groundHeightAt(x, z, 0), textures, geometries, materials, {
    segsX: isLowQ ? 12 : isMedQ ? 16 : 24,
    segsZ: isLowQ ? 12 : isMedQ ? 16 : 24,
    centerX: -216,
    centerZ: -158,
  });
  waters.push(seineWaterSys, bayOceanSys, westOceanSys, lakeWaterSys);
  waters.forEach((w) => {
    w.mesh.userData.keepInArenaRoot = true;
  });
  arenaGroup.add(seineWaterSys.mesh, bayOceanSys.mesh, westOceanSys.mesh, lakeWaterSys.mesh);

  const fallMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.35,
    roughness: 0.22,
    transparent: true,
    opacity: 0.84,
  });
  materials.push(fallMat);
  const fallGeo = new THREE.CylinderGeometry(4.2, 5.2, 16.5, 14);
  geometries.push(fallGeo);
  const fallMesh = new THREE.Mesh(fallGeo, fallMat);
  fallMesh.position.set(-216, 6.2, -178);
  fallMesh.scale.set(1.1, 1.0, 0.35);
  fallMesh.rotation.x = -0.35;
  arenaGroup.add(fallMesh);

  const perimeter = buildPerimeterMountainsAndRocks(pal, mats, false, isSoftwareGl, true, true);
  perimeter.scale.set(1.85, 1.5, 1.85);
  perimeter.userData.keepInArenaRoot = true;
  arenaGroup.add(perimeter);

  const mansionSeats: import('./arena').MansionSeatSpot[] = [];
  const dynamicColliders: ColliderBox[] = [];

  const simCtx: SimWorldBuildContext = {
    arenaGroup,
    colliders,
    dynamicColliders,
    ramps,
    doorways,
    interactables,
    mansionSeats,
    barrels,
    shootableEnv,
    breakableGlass,
    shootableBalloons,
    streetLampMats,
    windowEmissiveMats,
    nightGlowMats,
    lodDetailGroups,
    updaters,
    geometries,
    materials,
    displays,
    textures,
    isSoftwareGl,
    graphicsQuality,
  };
  const cityPal = createCityPalette(simCtx);

  // Crisp 3D Raised Asphalt Road Decks & Curbed Sidewalks across Central City (zero grass/road triangle glitch!)
  const addPavedRoadStrip = (cx: number, cz: number, w: number, d: number, isNS: boolean) => {
    const sw = new THREE.Mesh(cityPal.boxGeo, cityPal.concreteDeck);
    sw.position.set(cx, -0.035, cz);
    sw.scale.set(w + (isNS ? 4.4 : 0), 0.16, d + (isNS ? 0 : 4.4));
    sw.receiveShadow = true;
    const rd = new THREE.Mesh(cityPal.boxGeo, cityPal.slateAsphalt);
    rd.position.set(cx, (isNS ? 0.094 : 0.078) - 0.08, cz);
    rd.scale.set(w, 0.16, d);
    rd.receiveShadow = true;
    arenaGroup.add(sw, rd);
  };
  // Central City E-W Avenues (z = -140, 0, +140)
  AVENUE_Z.forEach((az) => addPavedRoadStrip(-24, az, 488, 14.4, false));
  // Central City N-S Avenues (x = -140 split cleanly around Seine River bridge, 0, 140)
  addPavedRoadStrip(-140, -56, 14.4, 418, true);
  addPavedRoadStrip(-140, 224, 14.4, 88, true);
  addPavedRoadStrip(0, 0, 14.4, 530, true);
  addPavedRoadStrip(140, 0, 14.4, 530, true);
  // Outer Collector Ring ±208 & District Connector Spurs
  addPavedRoadStrip(0, -208, 428, 11.2, false);
  addPavedRoadStrip(0, 208, 428, 11.2, false);
  addPavedRoadStrip(-208, 0, 11.2, 428, true);
  addPavedRoadStrip(208, 0, 11.2, 428, true);
  addPavedRoadStrip(166, 36, 52, 10.8, false);
  addPavedRoadStrip(96, 60, 88, 10.4, false);
  addPavedRoadStrip(58, 70, 10.4, 140, true);
  addPavedRoadStrip(188, -174, 10.8, 68, true);
  addPavedRoadStrip(192, 174, 10.8, 68, true);
  // Futuristic Science District Connecting Avenues (links Smart City, Mansion East & Central x=140!)
  addPavedRoadStrip(59, -474, 346, 14.4, false); // Science Boulevard (x: -114..+232)
  addPavedRoadStrip(-114, -470.5, 12.4, 21, true); // Smart City Gate 1 connector
  addPavedRoadStrip(140, -344.5, 14.4, 273, true); // Central x=140 Northbound Extension
  addPavedRoadStrip(104, -364.5, 11.2, 233, true); // Mansion East Scenic Parkway
  addPavedRoadStrip(116, -660, 208, 10.8, false); // Science District Rear Loop North
  addPavedRoadStrip(12, -569, 10.8, 190, true); // West Science Perimeter
  addPavedRoadStrip(220, -569, 10.8, 190, true); // East Science Perimeter

  // Grounded Bridge across Seine River along West Avenue x=-140 (flush approaches down to y=0 + stone bank piers!)
  const sbSlopeLen = Math.hypot(7, 0.92);
  const sbPitch = Math.atan2(0.92, 7);
  // Center level span z in [157..175] at y = 0.92
  addBox(arenaGroup, cityPal, cityPal.slateAsphalt, -140, 0.72, SEINE_RIVER_Z, 14.5, 0.4, 18);
  addBox(arenaGroup, cityPal, cityPal.whiteMarble, -147.2, 1.35, SEINE_RIVER_Z, 0.5, 0.95, 18);
  addBox(arenaGroup, cityPal, cityPal.whiteMarble, -132.8, 1.35, SEINE_RIVER_Z, 0.5, 0.95, 18);
  // Sloped North approach z in [150..157] (y: 0 -> 0.92) & South approach z in [175..182] (y: 0.92 -> 0)
  addBox(arenaGroup, cityPal, cityPal.slateAsphalt, -140, 0.36, SEINE_RIVER_Z - 12.5, 14.5, 0.32, sbSlopeLen, { rotX: -sbPitch });
  addBox(arenaGroup, cityPal, cityPal.whiteMarble, -147.2, 0.76, SEINE_RIVER_Z - 12.5, 0.5, 0.85, sbSlopeLen, { rotX: -sbPitch });
  addBox(arenaGroup, cityPal, cityPal.whiteMarble, -132.8, 0.76, SEINE_RIVER_Z - 12.5, 0.5, 0.85, sbSlopeLen, { rotX: -sbPitch });
  addBox(arenaGroup, cityPal, cityPal.slateAsphalt, -140, 0.36, SEINE_RIVER_Z + 12.5, 14.5, 0.32, sbSlopeLen, { rotX: sbPitch });
  addBox(arenaGroup, cityPal, cityPal.whiteMarble, -147.2, 0.76, SEINE_RIVER_Z + 12.5, 0.5, 0.85, sbSlopeLen, { rotX: sbPitch });
  addBox(arenaGroup, cityPal, cityPal.whiteMarble, -132.8, 0.76, SEINE_RIVER_Z + 12.5, 0.5, 0.85, sbSlopeLen, { rotX: sbPitch });
  // Grounded stone river piers under deck
  [-7.5, 7.5].forEach((zOff) => {
    [-144.8, -135.2].forEach((px) => {
      addBox(arenaGroup, cityPal, cityPal.concreteDeck, px, -0.55, SEINE_RIVER_Z + zOff, 2.1, 2.8, 2.1);
    });
  });
  ramps.push(
    {
      minX: -147.2,
      maxX: -132.8,
      minZ: SEINE_RIVER_Z - 16,
      maxZ: SEINE_RIVER_Z - 9,
      axis: 'z',
      startCoord: SEINE_RIVER_Z - 16,
      endCoord: SEINE_RIVER_Z - 9,
      startY: 0,
      endY: 0.92,
    },
    {
      minX: -147.2,
      maxX: -132.8,
      minZ: SEINE_RIVER_Z - 9,
      maxZ: SEINE_RIVER_Z + 9,
      axis: 'z',
      startCoord: SEINE_RIVER_Z - 9,
      endCoord: SEINE_RIVER_Z + 9,
      startY: 0.92,
      endY: 0.92,
    },
    {
      minX: -147.2,
      maxX: -132.8,
      minZ: SEINE_RIVER_Z + 9,
      maxZ: SEINE_RIVER_Z + 16,
      axis: 'z',
      startCoord: SEINE_RIVER_Z + 9,
      endCoord: SEINE_RIVER_Z + 16,
      startY: 0.92,
      endY: 0,
    },
  );

  // Clean wide Boulevard & District Connector Road Markings (Zero Obstructions!)
  const markings: Parameters<typeof addRoadMarkingsBatch>[1] = [
    { kind: 'dash_line', x1: 0, z1: -250, x2: 0, z2: 250, color: 0xfacc15 },
    { kind: 'dash_line', x1: -140, z1: -250, x2: -140, z2: 250, color: 0xfacc15 },
    { kind: 'dash_line', x1: 140, z1: -250, x2: 140, z2: 250, color: 0xfacc15 },
    { kind: 'dash_line', x1: -250, z1: 0, x2: 250, z2: 0, color: 0xfacc15 },
    { kind: 'dash_line', x1: -250, z1: -140, x2: 250, z2: -140, color: 0xfacc15 },
    { kind: 'dash_line', x1: -250, z1: 140, x2: 250, z2: 140, color: 0xfacc15 },
    // Outer ring & district spur markings connecting Dropzone, Festival, Stadium, Power Plant & Seine!
    { kind: 'dash_line', x1: -208, z1: -208, x2: 208, z2: -208, color: 0xe2e8f0 },
    { kind: 'dash_line', x1: -208, z1: 208, x2: 208, z2: 208, color: 0xe2e8f0 },
    { kind: 'dash_line', x1: -208, z1: -208, x2: -208, z2: 208, color: 0xe2e8f0 },
    { kind: 'dash_line', x1: 208, z1: -208, x2: 208, z2: 208, color: 0xe2e8f0 },
    { kind: 'dash_line', x1: 140, z1: 36, x2: 192, z2: 36, color: 0xfacc15 },
    { kind: 'dash_line', x1: 58, z1: 60, x2: 140, z2: 60, color: 0xfacc15 },
    { kind: 'crosswalk', x: 0, z: 10.5, rotY: 0 },
    { kind: 'crosswalk', x: 0, z: -10.5, rotY: 0 },
    { kind: 'crosswalk', x: 10.5, z: 0, rotY: Math.PI * 0.5 },
    { kind: 'crosswalk', x: -10.5, z: 0, rotY: Math.PI * 0.5 },
    { kind: 'parking_bays', x: 14, z: -12, count: 6, rotY: 0 },
    { kind: 'dash_line', x1: -114, z1: -474, x2: 232, z2: -474, color: 0x38bdf8 },
    { kind: 'dash_line', x1: 140, z1: -208, x2: 140, z2: -474, color: 0xfacc15 },
    { kind: 'dash_line', x1: 104, z1: -248, x2: 104, z2: -474, color: 0xe2e8f0 },
  ];
  addRoadMarkingsBatch(arenaGroup, markings, groundHeightAt, geometries, materials);

  // 1. CENTRAL HUB: Apex 4-Level Luxury Mansion + Smart City Mega Project + Futuristic Science District
  const mansionBuilt = buildLuxuryMansionProperty(simCtx);
  const smartCity = buildSmartCityWorld(simCtx, cityPal, groundHeightAt);
  const smartCityTransit = buildSmartCityTransit(simCtx, cityPal, groundHeightAt);
  const scienceDistrict = buildScienceDistrictWorld(simCtx, cityPal);
  placeWaterfrontHotelResort(simCtx, cityPal, { x: 26, z: 34 });
  const parkBuilt = placeModernParkPlayground(simCtx, cityPal, -46, 44);
  placeEnterableOfficeBuilding(simCtx, cityPal, { x: 56, z: -36 });
  placeInteractiveCityLocations(simCtx, cityPal, {
    skipPetrol: true,
    martPos: { x: -82, z: -26 },
    bistroPos: { x: -106, z: 118 },
    marketPos: { x: 34, z: 78 },
  });

  // 3 Modern "Super Save Gas" Stations across Central, Seine West & Metro East!
  const gasStationMain = placeModernGasStation(simCtx, cityPal, {
    x: 26,
    z: -76,
    idPrefix: 'central_north',
    accentHex: 0x2563eb,
  });
  const gasStationWest = placeModernGasStation(simCtx, cityPal, {
    x: -108,
    z: 76,
    idPrefix: 'seine_west',
    accentHex: 0x10b981,
  });
  const gasStationEast = placeModernGasStation(simCtx, cityPal, {
    x: 108,
    z: -76,
    idPrefix: 'metro_east',
    accentHex: 0xf97316,
  });

  // 5 ENLARGED 3-FLOOR SHOPPING MALLS ACROSS ALL QUADRANTS OF THE MEGA-WORLD!
  const mallConfigs: MallThemeConfig[] = [
    {
      id: 'mall_central',
      name: 'GRAND ATRIUM MALL',
      cx: -44,
      cz: -36,
      facadeHex: 0xe6dccb,
      trimHex: 0xd99b26,
      floor1Hex: 0xf4f1eb,
      floor2Hex: 0xdbeafe,
      floor3Hex: 0xfef3c7,
      accentHex: '#f59e0b',
    },
    {
      id: 'mall_paradise',
      name: 'ALPINE GALLERIA',
      cx: -184,
      cz: -96,
      facadeHex: 0xe2e8f0,
      trimHex: 0x0ea5e9,
      floor1Hex: 0xf8fafc,
      floor2Hex: 0xd1fae5,
      floor3Hex: 0xe0f2fe,
      accentHex: '#38bdf8',
    },
    {
      id: 'mall_metro',
      name: 'METRO SKY PLAZA',
      cx: 188,
      cz: -44,
      facadeHex: 0xcbd5e1,
      trimHex: 0xec4899,
      floor1Hex: 0xf1f5f9,
      floor2Hex: 0xfce7f3,
      floor3Hex: 0xf3e8ff,
      accentHex: '#ec4899',
    },
    {
      id: 'mall_seine',
      name: 'GALERIES SEINE',
      cx: -184,
      cz: 88,
      facadeHex: 0xfef3c7,
      trimHex: 0x0d9488,
      floor1Hex: 0xfffbeb,
      floor2Hex: 0xccfbf1,
      floor3Hex: 0xffedd5,
      accentHex: '#14b8a6',
    },
    {
      id: 'mall_suburb',
      name: 'SUBURB EMPORIUM',
      cx: 68,
      cz: 188,
      facadeHex: 0xf3e8ff,
      trimHex: 0x7c3aed,
      floor1Hex: 0xfaf5ff,
      floor2Hex: 0xfef9c3,
      floor3Hex: 0xdbeafe,
      accentHex: '#a855f7',
    },
  ];
  const malls: MallNavData[] = mallConfigs.map((cfg) => placeEnterableElevatorMall(simCtx, cityPal, cfg));

  // Grand Grounded Digital Billboards on Central Plaza & District Gateways (with DEVELOPED BY AFTAB BALOCH DADU)
  [
    { x: -16, z: -16, rotY: 0.42, phaseOffset: 0, lockCredit: false },
    { x: 16, z: 16, rotY: -2.45, phaseOffset: 1.2, lockCredit: true },
    { x: -16, z: 16, rotY: 2.35, phaseOffset: 2.2, lockCredit: false },
    { x: 14, z: -18, rotY: -0.55, phaseOffset: 0.5, lockCredit: true },
    { x: -128, z: -18, rotY: 0.4, phaseOffset: 0.9, lockCredit: true },
    { x: 128, z: 18, rotY: -2.6, phaseOffset: 1.5, lockCredit: true },
  ].forEach((b) => {
    const bg = new THREE.Group();
    bg.position.set(b.x, 0, b.z);
    bg.rotation.y = b.rotY;
    addBox(bg, cityPal, cityPal.concreteDeck, 0, 0.35, 0, 6.4, 0.7, 1.4);
    addBox(bg, cityPal, cityPal.charcoalSteel, -2.5, 3.6, -0.18, 0.46, 6.8, 0.46);
    addBox(bg, cityPal, cityPal.charcoalSteel, 2.5, 3.6, -0.18, 0.46, 6.8, 0.46);
    addBox(bg, cityPal, cityPal.charcoalSteel, 0, 7.0, -0.12, 10.6, 5.0, 0.24);
    const mat = displays.createDisplayMaterial(
      'city_billboard',
      b.lockCredit
        ? {
            title: 'DEVELOPED BY AFTAB BALOCH DADU',
            subtitle: 'APEX DROPZONE · MEGA CITY SIMULATOR',
            accentHex: '#facc15',
            lockTitle: true,
            intervalSec: 0.9,
            worldPos: { x: b.x, y: 7.0, z: b.z },
          }
        : {
            intervalSec: 0.7,
            phaseOffset: b.phaseOffset,
            worldPos: { x: b.x, y: 7.0, z: b.z },
          },
    ).material;
    const screen = new THREE.Mesh(cityPal.boxGeo, mat);
    screen.position.set(0, 7.0, 0.08);
    screen.scale.set(10.2, 4.6, 0.14);
    bg.add(screen);
    arenaGroup.add(bg);
    addCollider(colliders, b.x, 0, b.z, 5.6, 6.8, 1.2, b.rotY, 'metal');
  });

  // 2. TRAFFIC SIGNALS WITH GROUNDED GANTRY PILLARS AT ALL 9 INTERSECTIONS
  const intersections = [
    { x: 0, z: 0, offsetSec: 0 },
    { x: -140, z: 0, offsetSec: 4 },
    { x: 140, z: 0, offsetSec: 8 },
    { x: 0, z: -140, offsetSec: 5 },
    { x: 0, z: 140, offsetSec: 10 },
    { x: -140, z: -140, offsetSec: 2 },
    { x: 140, z: -140, offsetSec: 6 },
    { x: -140, z: 140, offsetSec: 3 },
    { x: 140, z: 140, offsetSec: 9 },
  ];
  const signalVisuals: SignalVisualGroup[] = intersections.map((inter) =>
    placeIntersectionSignals(simCtx, cityPal, inter.x, inter.z, inter.offsetSec),
  );

  // Bus Stops
  const busStops = [
    { x: -10, z: 22 },
    { x: 10, z: -26 },
    { x: 112, z: 112 },
    { x: -112, z: -112 },
  ];
  busStops.forEach((bs) => {
    addBox(arenaGroup, cityPal, cityPal.charcoalSteel, bs.x, 1.4, bs.z, 3.8, 2.8, 0.22);
    registerBreakableGlass(simCtx, addBox(arenaGroup, cityPal, cityPal.glassClear, bs.x, 1.4, bs.z + 0.5, 3.8, 0.16, 1.4));
  });

  // 3. NW PARADISE FARM PLOTS + MOUNTAIN CAMPSITES!
  const farmPlots = [
    { x: -116, z: -172 },
    { x: -104, z: -172 },
    { x: -116, z: -192 },
    { x: -104, z: -192 },
  ];
  farmPlots.forEach((fp) => {
    for (let row = -2; row <= 2; row++) {
      addBox(arenaGroup, cityPal, cityPal.greenTurf, fp.x + row * 1.4, 0.35, fp.z, 0.5, 0.7, 7.5);
    }
  });
  addBox(arenaGroup, cityPal, cityPal.redAwning, -92, 2.5, -182, 8.5, 5.0, 9.5);
  addCollider(colliders, -92, 0, -182, 8.5, 5.0, 9.5);

  const mountainCamps: MegaWorldEnvironmentData['mountainCamps'] = [];
  const campFlameMeshes: Array<{ cone: THREE.Mesh; inner: THREE.Mesh; baseY: number; phase: number }> = [];
  const campFlameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const campCoreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const campSmokeMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.42 });
  const campFlameGeo = new THREE.ConeGeometry(0.42, 1.1, 7);
  geometries.push(campFlameGeo);
  materials.push(campFlameMat, campCoreMat, campSmokeMat);
  const tentMats = [cityPal.amberAwning, cityPal.redAwning, cityPal.tealAwning, cityPal.cyanNeon];
  [
    { x: -166, z: -172 },
    { x: -206, z: -194 },
    { x: -188, z: -212 },
    { x: -222, z: -176 },
  ].forEach((mc, cIdx) => {
    const gy = groundHeightAt(mc.x, mc.z, 0);
    // Larger Twin-Pitch Mountain Dome Tents + Crossed Wood-Log Campfire + Glowing Embers + Bench Logs
    addBox(arenaGroup, cityPal, tentMats[cIdx % tentMats.length], mc.x, gy + 1.15, mc.z, 3.8, 2.3, 4.0);
    addBox(arenaGroup, cityPal, cityPal.charcoalSteel, mc.x, gy + 0.08, mc.z + 2.1, 1.4, 1.5, 0.14);
    const fx = mc.x + 3.2;
    const fz = mc.z + 1.6;
    const fgy = groundHeightAt(fx, fz, 0);
    // Stone fire-ring & crossed wooden logs
    addBox(arenaGroup, cityPal, cityPal.charcoalSteel, fx, fgy + 0.12, fz, 1.5, 0.24, 1.5);
    addBox(arenaGroup, cityPal, cityPal.terracottaWood, fx, fgy + 0.28, fz, 1.35, 0.22, 0.24, { rotY: 0.65 });
    addBox(arenaGroup, cityPal, cityPal.terracottaWood, fx, fgy + 0.28, fz, 1.35, 0.22, 0.24, { rotY: -0.65 });
    const flameCone = new THREE.Mesh(campFlameGeo, campFlameMat);
    flameCone.position.set(fx, fgy + 0.78, fz);
    const flameInner = new THREE.Mesh(campFlameGeo, campCoreMat);
    flameInner.scale.set(0.6, 0.75, 0.6);
    flameInner.position.set(fx, fgy + 0.65, fz);
    arenaGroup.add(flameCone, flameInner);
    campFlameMeshes.push({ cone: flameCone, inner: flameInner, baseY: fgy, phase: cIdx * 1.7 });
    // Sitting timber logs around campfire
    addBox(arenaGroup, cityPal, cityPal.terracottaWood, fx, fgy + 0.22, fz + 1.85, 2.0, 0.36, 0.45);
    addBox(arenaGroup, cityPal, cityPal.terracottaWood, fx + 1.85, fgy + 0.22, fz, 0.45, 0.36, 2.0);
    addCollider(colliders, mc.x, gy, mc.z, 3.9, 2.4, 4.1);
    mountainCamps.push({
      x: mc.x,
      z: mc.z,
      seatSpots: [
        { x: fx - 0.5, z: fz + 1.85, yaw: Math.PI },
        { x: fx + 0.5, z: fz + 1.85, yaw: Math.PI },
        { x: fx + 1.85, z: fz - 0.5, yaw: -Math.PI * 0.5 },
        { x: fx + 1.85, z: fz + 0.5, yaw: -Math.PI * 0.5 },
      ],
    });
  });
  updaters.push((_dt, elapsed, cameraPos) => {
    if (cameraPos) {
      const dx = cameraPos.x + 195;
      const dz = cameraPos.z + 188;
      if (dx * dx + dz * dz > 160 * 160) return;
    }
    for (let i = 0; i < campFlameMeshes.length; i++) {
      const f = campFlameMeshes[i];
      const pulse = 0.85 + Math.sin(elapsed * 9.5 + f.phase) * 0.22 + Math.cos(elapsed * 14.3 + f.phase) * 0.12;
      f.cone.scale.set(0.95 + Math.sin(elapsed * 6 + f.phase) * 0.12, pulse, 0.95);
      f.inner.scale.set(0.55, 0.72 * pulse, 0.55);
      f.cone.rotation.y += 0.08;
    }
  });

  // 4. DROPZONE COMPOUND SECTOR, FESTIVAL AMUSEMENT PARK, LANDMARKS & SINGLE MAP-WIDE RAILWAY!
  placeDropzoneCompoundSector(simCtx, cityPal, 186, 36);
  const festivalData = placeFestivalAmusementPark(simCtx, cityPal, 84, 86);
  const railwayBuilt = placeMapWideRailwaySystem(simCtx, cityPal, groundHeightAt);

  const landmarkCtx: LandmarkContext = {
    sceneParent: arenaGroup,
    addCollider: (cx, minY, cz, w, h, d, rotY = 0, surface = 'concrete') =>
      addCollider(colliders, cx, minY, cz, w, h, d, rotY, surface),
    groundHeightAt,
    shootableEnv,
    isNight: false,
    isSoftwareGl,
    geometriesToDispose: geometries,
    materialsToDispose: materials,
    displays,
    updaters,
  };
  placeStadiumLandmark(landmarkCtx, { x: 188, z: -195, title: 'METRO STADIUM' });
  placeLargeTowerLandmark(landmarkCtx, { x: -195, z: 205, height: 48, primaryHex: 0x94a3b8 });
  placeIndustrialFactoryLandmark(landmarkCtx, { x: 192, z: 186 }); // SE Electricity Producing Plant (clear of ±228 railway!)

  // Animated Football / Soccer Ball inside Metro Stadium (188, -195)
  const ballGeo = new THREE.SphereGeometry(0.45, 10, 10);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  geometries.push(ballGeo);
  materials.push(ballMat);
  const stadiumBall = new THREE.Mesh(ballGeo, ballMat);
  stadiumBall.position.set(188, 0.45, -195);
  arenaGroup.add(stadiumBall);
  updaters.push((_dt, elapsed, cameraPos) => {
    if (cameraPos) {
      const dx = cameraPos.x - 188;
      const dz = cameraPos.z + 195;
      if (dx * dx + dz * dz > 150 * 150) return;
    }
    stadiumBall.position.x = 188 + Math.sin(elapsed * 0.95) * 11.5;
    stadiumBall.position.z = -195 + Math.sin(elapsed * 1.9) * 5.8;
    stadiumBall.position.y = 0.45 + Math.abs(Math.sin(elapsed * 4.5)) * 0.55;
    stadiumBall.rotation.x += 0.08;
    stadiumBall.rotation.z += 0.06;
  });

  const modPal = createModernBuildingPalette(geometries, materials, false, textures);
  const modCtx: ModernBuildingContext = {
    arenaGroup,
    colliders,
    ramps,
    coverNodes,
    doorways,
    interiorSpawns: [],
    shootableEnv,
    breakableGlass,
    isSoftwareGl,
    pal: modPal,
  };
  placeModernBalconyTower(modCtx, { x: 192, z: -102, rotY: 0, w: 14, d: 18, enterable: true, label: 'Metro Residences' });
  placeModernVilla(modCtx, { x: -112, z: 190, rotY: 0, label: 'Seine Villa' });

  // NE Construction Zone (Steel Scaffolding + Rotating Tower Crane)
  const craneGroup = new THREE.Group();
  craneGroup.position.set(106, 0, -192);
  addBox(craneGroup, cityPal, cityPal.amberAwning, 0, 10, 0, 1.6, 20, 1.6);
  const jib = new THREE.Group();
  jib.position.set(0, 20, 0);
  addBox(jib, cityPal, cityPal.amberAwning, 6, 0, 0, 18, 1.0, 1.0);
  addBox(jib, cityPal, cityPal.charcoalSteel, -4, 0, 0, 5, 1.4, 1.4);
  craneGroup.add(jib);
  arenaGroup.add(craneGroup);
  updaters.push((_dt, elapsed, cameraPos) => {
    if (cameraPos) {
      const dx = cameraPos.x - 106;
      const dz = cameraPos.z + 192;
      if (dx * dx + dz * dz > 240 * 240) return;
    }
    jib.rotation.y = Math.sin(elapsed * 0.25) * 0.85;
  });

  // SW Seine River Barges & Extra Shootable Sky Hot-Air Balloons
  addAnimatedCanalBarge(landmarkCtx, { x1: -220, z1: SEINE_RIVER_Z, x2: -60, z2: SEINE_RIVER_Z, waterY: -0.95 });
  const extraBalloonSphere = new THREE.SphereGeometry(2.8, 14, 12);
  const extraBalloonCone = new THREE.ConeGeometry(1.7, 1.8, 12);
  geometries.push(extraBalloonSphere, extraBalloonCone);
  [
    { x: -78, y: 34, z: -88, mat: cityPal.redAwning, hex: 0xdc2626 },
    { x: 64, y: 38, z: -92, mat: cityPal.tealAwning, hex: 0x0d9488 },
    { x: 405, y: 40, z: -18, mat: cityPal.amberAwning, hex: 0xea580c },
    { x: -42, y: 35, z: 156, mat: cityPal.cyanNeon, hex: 0x22d3ee },
  ].forEach((eb, idx) => {
    const bg = new THREE.Group();
    bg.position.set(eb.x, eb.y, eb.z);
    const envTop = new THREE.Mesh(extraBalloonSphere, eb.mat);
    envTop.position.y = 2.6;
    envTop.scale.set(1.0, 1.18, 1.0);
    const envCone = new THREE.Mesh(extraBalloonCone, cityPal.whiteMarble);
    envCone.position.y = 0.25;
    envCone.rotation.x = Math.PI;
    const basket = addBox(bg, cityPal, cityPal.terracottaWood, 0, -1.65, 0, 1.25, 1.0, 1.25);
    bg.add(envTop, envCone);
    arenaGroup.add(bg);
    shootableBalloons.push({
      group: bg,
      envelopeMeshes: [envTop, envCone],
      basketMeshes: [basket],
      baseX: eb.x,
      baseY: eb.y,
      baseZ: eb.z,
      ampX: 12,
      ampZ: 10,
      phase: idx * 1.65,
      envelopeOffsetY: 2.3,
      hitRadius: 3.3,
      accentHex: eb.hex,
    });
  });

  const sharedBayPropMats = createPropPbrMaterials(false);
  materials.push(...sharedBayPropMats.all);
  const bayResult = buildApexBayCityExpansion(simCtx, cityPal, modCtx, groundHeightAt, {
    buildMall: (cfg) => placeEnterableElevatorMall(simCtx, cityPal, cfg),
    placeIntersectionSignals: (ix, iz, offsetSec) => placeIntersectionSignals(simCtx, cityPal, ix, iz, offsetSec),
    sharedPropMats: sharedBayPropMats,
  });
  const eastCityResult = buildGrandEastCity(simCtx, cityPal, groundHeightAt, {
    placeIntersectionSignals: (ix, iz, offsetSec) => placeIntersectionSignals(simCtx, cityPal, ix, iz, offsetSec),
    buildMall: (cfg) => placeEnterableElevatorMall(simCtx, cityPal, cfg),
    buildPark: (cx, cz) => placeModernParkPlayground(simCtx, cityPal, cx, cz),
    sharedPropMats: sharedBayPropMats,
  });
  const westCityResult = buildGrandWestCity(simCtx, cityPal, groundHeightAt, {
    placeIntersectionSignals: (ix, iz, offsetSec) => placeIntersectionSignals(simCtx, cityPal, ix, iz, offsetSec),
    buildMall: (cfg) => placeEnterableElevatorMall(simCtx, cityPal, cfg),
    buildPark: (cx, cz) => placeModernParkPlayground(simCtx, cityPal, cx, cz),
    sharedPropMats: sharedBayPropMats,
  });

  // 5. SE RESIDENTIAL SUBURB HOUSES + BAY CITY HOMES (Textured Masonry, Glass Windows & Colorful Trim)
  const baseHouses = [
    { x: 112, z: 116, doorX: 112, doorZ: 122.5 },
    { x: 158, z: 116, doorX: 158, doorZ: 122.5 },
    { x: 174, z: 116, doorX: 174, doorZ: 122.5 },
    { x: 112, z: 168, doorX: 112, doorZ: 161.5 },
    { x: 158, z: 168, doorX: 158, doorZ: 161.5 },
    { x: 174, z: 168, doorX: 174, doorZ: 161.5 },
  ];
  baseHouses.forEach((h, idx) => {
    const wallMat = idx % 2 === 0 ? cityPal.facadeMasonry : cityPal.facadePanel;
    const roofMat = idx % 3 === 0 ? cityPal.redAwning : idx % 3 === 1 ? cityPal.tealAwning : cityPal.amberAwning;
    const facingSouth = h.doorZ > h.z;
    const frontZ = h.z + (facingSouth ? 4.82 : -4.82);
    addBox(arenaGroup, cityPal, wallMat, h.x, 2.4, h.z, 10.5, 4.8, 9.5);
    addBox(arenaGroup, cityPal, roofMat, h.x, 5.4, h.z, 11.4, 1.2, 10.4);
    addBox(arenaGroup, cityPal, cityPal.warmGold, h.x, 4.78, h.z, 10.8, 0.24, 9.8);
    registerBreakableGlass(simCtx, addBox(arenaGroup, cityPal, cityPal.facadeGlass, h.x - 3.1, 2.5, frontZ, 2.1, 1.8, 0.16));
    registerBreakableGlass(simCtx, addBox(arenaGroup, cityPal, cityPal.facadeGlass, h.x + 3.1, 2.5, frontZ, 2.1, 1.8, 0.16));
    addBox(arenaGroup, cityPal, cityPal.terracottaWood, h.doorX, 1.3, h.doorZ - (facingSouth ? 1.5 : -1.5), 1.6, 2.6, 0.25);
    addCollider(colliders, h.x, 0, h.z, 10.5, 5.5, 9.5);
  });
  const houses = [...baseHouses, ...bayResult.houses];

  // SE Botanical Greenhouses & Flower Nursery
  registerBreakableGlass(simCtx, addBox(arenaGroup, cityPal, cityPal.glassClear, 112, 2.2, 202, 14, 4.4, 9.5));
  addBox(arenaGroup, cityPal, cityPal.charcoalSteel, 112, 4.45, 202, 14.3, 0.22, 9.8);
  addCollider(colliders, 112, 0, 202, 14, 4.5, 9.5);

  // 6. EXPLOSIVE RED DRUMS (Generous tactical clusters across Central City, Streets, Gas Stations, Docks, & Districts!)
  const drumPlacements: Array<[number, number]> = [
    [176, 42],
    [178, 43.2],
    [194, 46],
    [195.4, 46],
    [34, -74],
    [35.4, -74],
    [-98, 74],
    [-96.6, 74],
    [116, -74],
    [117.5, -74],
    [174, 178],
    [175.4, 178],
    [206, 174],
    [-184, 180],
    [115, 144],
    [113, -180],
    // Extra Central City & District Street Explosive Drum Clusters
    [-12, -26],
    [-10.5, -26],
    [22, 12],
    [23.5, 12],
    [-68, -24],
    [-66.5, -24],
    [68, -24],
    [70, 56],
    [-22, 62],
    [-20.5, 62],
    [14, 118],
    [-118, 12],
    [-116.5, 12],
    [132, -132],
    [-132, -126],
    [82, 112],
    // Extra Tactical Roadside & Spawn-Adjacent Explosive Barrel Clusters
    [-4, -22],
    [-2.5, -22],
    [9.5, 19],
    [11, 19],
    [-34, 14],
    [-32.5, 14],
    [48, -16],
    [49.5, -16],
    [152, 24],
    [153.5, 24],
    [296, 12],
    [297.5, 12],
    [540, 14],
    [541.5, 14],
    ...bayResult.drumPlacements,
    ...eastCityResult.drumPlacements,
    ...westCityResult.drumPlacements,
  ];
  drumPlacements.forEach(([bx, bz], idx) => {
    const id = idx + 1;
    const by = groundHeightAt(bx, bz, 0);
    const builtBarrel = buildExplosiveBarrel(id, mats, isSoftwareGl, geometries, materials);
    builtBarrel.group.position.set(bx, by, bz);
    arenaGroup.add(builtBarrel.group);
    shootableEnv.push(builtBarrel.hitMesh);
    addCollider(colliders, bx, by, bz, 0.95, 1.3, 0.95, 0, 'metal');
    barrels.push({
      id,
      group: builtBarrel.group,
      tiltGroup: builtBarrel.tiltGroup,
      hitMesh: builtBarrel.hitMesh,
      holeMesh: builtBarrel.holeMesh,
      streamMesh: builtBarrel.streamMesh,
      puddleMesh: builtBarrel.puddleMesh,
      fireMesh: builtBarrel.fireMesh,
      position: new THREE.Vector3(bx, by, bz),
      puddlePos: new THREE.Vector3(bx, by, bz),
      health: 50,
      exploded: false,
      bulletHits: 0,
      fallen: false,
      tiltAngle: 0,
      tiltDirX: 1,
      tiltDirZ: 0,
      velX: 0,
      velY: 0,
      velZ: 0,
      rollAngle: 0,
      colliderRemoved: false,
      leaking: false,
      leakDirX: 1,
      leakDirZ: 0,
      leakHeight: 0.72,
      puddleRadius: 0,
      ignited: false,
      fireProgress: 0,
    });
  });

  // Tag moving / district groups so Central City static prop chunk partitioning leaves them attached directly to arenaGroup
  shootableBalloons.forEach((b) => {
    b.group.userData.keepInArenaRoot = true;
  });
  barrels.forEach((b) => {
    b.group.userData.keepInArenaRoot = true;
  });
  lodDetailGroups.forEach((lg) => {
    lg.group.userData.keepInArenaRoot = true;
  });
  for (let i = 0; i < arenaGroup.children.length; i++) {
    const ch = arenaGroup.children[i];
    if (ch.name === 'SmartCityGlassDomeMegaProjectRoot' || ch.name.startsWith('SmartCity')) {
      ch.userData.keepInArenaRoot = true;
    }
  }
  // Partition static Central City buildings, roads, billboards, lamps & props into spatial 190m streaming chunks
  worldStreaming.partitionStaticChildren(arenaGroup, {
    idPrefix: 'central',
    cellSize: 190,
    maxObjectSpan: 135,
    loadDist: isLowQ ? 175 : isMedQ ? 250 : 380,
    unloadDist: isLowQ ? 220 : isMedQ ? 310 : 455,
  });
  if (isReducedQ) {
    worldStreaming.optimizeStaticChunks(shootableEnv);
  }

  // 7. SPATIALLY CHUNKED & LOD-MANAGED FLOWERS, WIND TREES + LOW-POLY PROXIES, BOULDERS & GRASS
  const floraBuilt = populateInstancedFlora(
    arenaGroup,
    textures,
    geometries,
    materials,
    groundHeightAt,
    graphicsQuality,
    isSoftwareGl,
    worldStreaming,
  );
  const grassSystem = floraBuilt.grassSystem;
  const wildlifeProps = new WorldWildlifeController(arenaGroup, floraBuilt.treePerches, isSoftwareGl);
  wildlifeProps.root.userData.keepInArenaRoot = true;
  shootableBalloons.forEach((b) => wildlifeProps.registerBalloon(b));

  // 8. PLAYER VEHICLES (12 Modern Reference-Matched Cars + Extra Digital Bikes across all districts!)
  const vehicleSpawns: VehicleSpawnSpec[] = [
    // Central City & Waterfront Hub (plenty of bikes + modern supercars/SUVs)
    { id: 'mega_bike_volt', kind: 'digital_bike', x: -11.5, z: -12.5, yaw: 0.25, bikeStyle: BIKE_STYLES[0].id },
    { id: 'mega_bike_arctic', kind: 'digital_bike', x: -14.0, z: -12.5, yaw: 0.2, bikeStyle: BIKE_STYLES[1].id },
    { id: 'mega_bike_gold', kind: 'digital_bike', x: -16.5, z: -12.5, yaw: 0.15, bikeStyle: BIKE_STYLES[2].id },
    { id: 'mega_bike_emerald', kind: 'digital_bike', x: -19.0, z: -12.5, yaw: 0.1, bikeStyle: BIKE_STYLES[3].id },
    { id: 'mega_bike_bat', kind: 'digital_bike', x: 11.5, z: 12.0, yaw: -0.35, bikeStyle: BIKE_STYLES[4].id },
    { id: 'mega_revuelto_hotel', kind: 'revuelto_red', x: 16, z: 12, yaw: Math.PI * 0.5 },
    { id: 'mega_rolls_mall', kind: 'rolls_copper_gt', x: -24, z: -16, yaw: -Math.PI * 0.5 },
    { id: 'mega_vision_hub', kind: 'vision_silver', x: 14, z: -16, yaw: 0 },
    { id: 'mega_range_park', kind: 'range_black_suv', x: -26, z: 22, yaw: Math.PI },
    { id: 'mega_stealth_dropzone', kind: 'stealth_hyper', x: 162, z: 18, yaw: -Math.PI * 0.5 },
    { id: 'mega_challenger_dropzone', kind: 'challenger_scissor', x: 170, z: 54, yaw: Math.PI },
    { id: 'mega_thar_farm', kind: 'thar_black_4x4', x: -128, z: -148, yaw: 0.5 },
    { id: 'mega_cyber_snow', kind: 'cyber_pickup', x: -148, z: -158, yaw: -0.6 },
    { id: 'mega_gullwing_resort', kind: 'gullwing_coupe', x: 64, z: 48, yaw: -0.75 },
    // Bay City AutoMax & Beachfront Fleet
    { id: 'mega_bike_bay_beach', kind: 'digital_bike', x: 528, z: 10, yaw: -0.4, bikeStyle: BIKE_STYLES[2].id },
    { id: 'mega_terzo_bay_automax', kind: 'terzo_silver', x: 315, z: 98, yaw: 0 },
    { id: 'mega_cyber_gold_bay', kind: 'cyber_gold', x: 386, z: 46, yaw: -0.5 },
    { id: 'mega_lambo_blue_bay', kind: 'lambo_blue_hyper', x: 536, z: 16, yaw: -Math.PI * 0.5 },
    // East Island New City vehicles (custom bikes + futuristic hypercars/SUVs)
    { id: 'east_bike_bridge_gate', kind: 'digital_bike', x: 822, z: -12, yaw: -Math.PI * 0.5, bikeStyle: BIKE_STYLES[0].id },
    { id: 'east_stealth_ring', kind: 'stealth_hyper', x: 960, z: -8, yaw: Math.PI * 0.5 },
    { id: 'east_bike_chinatown', kind: 'digital_bike', x: 944, z: 222, yaw: Math.PI * 0.5, bikeStyle: BIKE_STYLES[2].id },
    { id: 'east_rolls_castle', kind: 'rolls_copper_gt', x: 1122, z: 182, yaw: Math.PI * 0.5 },
    { id: 'east_revuelto_airport', kind: 'revuelto_red', x: 1162, z: -138, yaw: 0.45 },
    { id: 'east_bike_valley', kind: 'digital_bike', x: 1222, z: -82, yaw: 0.2, bikeStyle: BIKE_STYLES[4].id },
    // West Island New Mega-District vehicles (hypercars, digital bikes & off-road 4x4s)
    { id: 'west_bike_bridge_gate', kind: 'digital_bike', x: -242, z: -12, yaw: Math.PI * 0.5, bikeStyle: BIKE_STYLES[1].id },
    { id: 'west_lambo_gp', kind: 'lambo_blue_hyper', x: -705, z: -229, yaw: Math.PI * 0.5 },
    { id: 'west_bike_biodomes', kind: 'digital_bike', x: -582, z: 100, yaw: Math.PI * 0.5, bikeStyle: BIKE_STYLES[3].id },
    { id: 'west_thar_pyramid', kind: 'thar_black_4x4', x: -978, z: 164, yaw: Math.PI * 0.5 },
    { id: 'west_cyber_spaceport', kind: 'cyber_gold', x: -959, z: -225, yaw: 0.35 },
    {
      id: 'spaceport_heli',
      kind: 'apex_heli',
      x: SPACEPORT_HELIPAD_COORDS.x,
      z: SPACEPORT_HELIPAD_COORDS.z,
      yaw: SPACEPORT_HELIPAD_COORDS.yaw,
    },
    // PRIVATE MANSION EXCLUSIVE FLEET (Strictly private to Apex Mansion Showroom & Courtyard)
    { id: 'mansion_showroom_hyper', kind: 'mansion_hyper_scissor', x: -53, z: -334, yaw: Math.PI * 0.94 },
    { id: 'mansion_showroom_escalade_gull', kind: 'mansion_escalade_gull', x: -69, z: -334, yaw: Math.PI * 0.94 },
    { id: 'mansion_showroom_hummer_gold', kind: 'mansion_hummer_gold', x: -53, z: -350, yaw: Math.PI * 0.96 },
    { id: 'mansion_showroom_escalade_dragon', kind: 'mansion_escalade_dragon', x: -69, z: -350, yaw: Math.PI * 0.96 },
    { id: 'mansion_showroom_range_marble', kind: 'mansion_range_marble', x: -53, z: -366, yaw: Math.PI },
    { id: 'mansion_showroom_ev_gt', kind: 'mansion_ev_gt', x: -69, z: -366, yaw: Math.PI },
    { id: 'mansion_courtyard_showcase', kind: 'mansion_hyper_scissor', x: -12, z: -306, yaw: Math.PI * 0.85 },
    {
      id: 'mansion_courtyard_heli',
      kind: 'apex_heli',
      x: MANSION_HELIPAD_COORDS.x,
      y: MANSION_HELIPAD_COORDS.deckY,
      z: MANSION_HELIPAD_COORDS.z,
      yaw: MANSION_HELIPAD_COORDS.yaw,
    },
    // SMART CITY DRIVABLE ELECTRIC SCOOTERS (4 plazas inside Biodome)
    { id: 'sc_scooter_gate_plaza', kind: 'electric_scooter', x: -105, z: -450, yaw: 0.45 },
    { id: 'sc_scooter_eco_park', kind: 'electric_scooter', x: -93, z: -474, yaw: -0.35 },
    { id: 'sc_scooter_station_plaza', kind: 'electric_scooter', x: -121, z: -536, yaw: 0.9 },
    { id: 'sc_scooter_research_plaza', kind: 'electric_scooter', x: -134, z: -554, yaw: -0.8 },
    // FUTURISTIC SCIENCE DISTRICT EV CHARGING BAY FLEET
    { id: 'sci_ev_sport_1', kind: 'vision_silver', x: -2, z: -501, yaw: 0 },
    { id: 'sci_ev_hyper_2', kind: 'lambo_blue_hyper', x: 5.5, z: -501, yaw: 0 },
    { id: 'sci_ev_bike_1', kind: 'digital_bike', x: 13, z: -501, yaw: 0, bikeStyle: BIKE_STYLES[0].id },
    { id: 'sci_ev_bike_2', kind: 'digital_bike', x: 20.5, z: -501, yaw: 0, bikeStyle: BIKE_STYLES[2].id },
  ];

  // 9. DINING SEATS + HOT FOOD STEAM
  const seats: MegaWorldEnvironmentData['seats'] = [
    { id: 'hb1', tableId: 'ht1', venue: 'hotel_banquet', x: 31.1, y: 0, z: 30.5, lookAtX: 32.5, lookAtZ: 30.5, hasHotFood: true },
    { id: 'hb2', tableId: 'ht1', venue: 'hotel_banquet', x: 33.9, y: 0, z: 30.5, lookAtX: 32.5, lookAtZ: 30.5, hasHotFood: true },
    { id: 'hb3', tableId: 'ht2', venue: 'hotel_banquet', x: 34.8, y: 0, z: 30.5, lookAtX: 36.2, lookAtZ: 30.5, hasHotFood: true },
    { id: 'hb4', tableId: 'ht2', venue: 'hotel_banquet', x: 37.6, y: 0, z: 30.5, lookAtX: 36.2, lookAtZ: 30.5, hasHotFood: true },
    { id: 'hb5', tableId: 'ht3', venue: 'hotel_banquet', x: 31.1, y: 0, z: 37.2, lookAtX: 32.5, lookAtZ: 37.2, hasHotFood: true },
    { id: 'hb6', tableId: 'ht3', venue: 'hotel_banquet', x: 33.9, y: 0, z: 37.2, lookAtX: 32.5, lookAtZ: 37.2, hasHotFood: true },
    { id: 'hb7', tableId: 'ht4', venue: 'hotel_banquet', x: 34.8, y: 0, z: 37.2, lookAtX: 36.2, lookAtZ: 37.2, hasHotFood: true },
    { id: 'hb8', tableId: 'ht4', venue: 'hotel_banquet', x: 37.6, y: 0, z: 37.2, lookAtX: 36.2, lookAtZ: 37.2, hasHotFood: true },
    { id: 'sb1', tableId: 'st1', venue: 'seine_bistro', x: -108, y: 0, z: 121, lookAtX: -106, lookAtZ: 121, hasHotFood: true },
    { id: 'sb2', tableId: 'st1', venue: 'seine_bistro', x: -104, y: 0, z: 121, lookAtX: -106, lookAtZ: 121, hasHotFood: true },
    { id: 'mf1', tableId: 'mt1', venue: 'mall_food_court', x: -34.8, y: 5.0, z: -28.4, lookAtX: -34.8, lookAtZ: -28.4, hasHotFood: true },
    { id: 'mf2', tableId: 'mt2', venue: 'mall_food_court', x: -29.8, y: 5.0, z: -28.4, lookAtX: -29.8, lookAtZ: -28.4, hasHotFood: true },
  ];

  const hotFoodSpots = [
    { x: 32.5, y: 1.0, z: 30.5 },
    { x: 36.2, y: 1.0, z: 30.5 },
    { x: 32.5, y: 1.0, z: 37.2 },
    { x: 36.2, y: 1.0, z: 37.2 },
    { x: 34.8, y: 1.35, z: 26.4 },
    { x: -106, y: 1.0, z: 121 },
    { x: -34.8, y: 5.95, z: -28.4 },
    { x: -29.8, y: 10.95, z: -24.6 },
  ];

  const allGangAnchors: Array<{ name: string; x: number; z: number; bossId: GangBossStyleId }> = [
    { name: 'Dropzone Crimson Syndicate', x: 192, z: 48, bossId: 'don_crimson' },
    { name: 'Power Plant Old Guard', x: 206, z: 170, bossId: 'big_barnaby' },
    { name: 'Seine Dock Crow Crew', x: -186, z: 182, bossId: 'spectre_crow' },
    ...bayResult.gangAnchors,
  ];

  const baseAndBayRoadLoops = [
    { minX: -140, maxX: 0, minZ: -140, maxZ: 0, clockwise: true },
    { minX: 0, maxX: 140, minZ: -140, maxZ: 0, clockwise: true },
    { minX: -140, maxX: 140, minZ: 0, maxZ: 140, clockwise: true },
    { minX: -208, maxX: 208, minZ: -208, maxZ: 208, clockwise: true },
    ...bayResult.roadRectLoops,
  ];
  const eastRoadRectLoopStartIdx = baseAndBayRoadLoops.length;
  const westRoadRectLoopStartIdx = eastRoadRectLoopStartIdx + eastCityResult.roadRectLoops.length;

  // 10. CREATE LIVING 30+ NPC, 6-MALL, 7-GANG-BOSS, STADIUM, FESTIVAL, BAY CITY, EAST & GRAND WEST CITY MANAGER
  const npcEnv: MegaWorldEnvironmentData = {
    colliders,
    seats,
    hotFoodSpots,
    houses,
    intersections: [
      ...intersections,
      ...bayResult.intersections,
      ...eastCityResult.intersections,
      ...westCityResult.intersections,
    ],
    signalVisuals: [
      ...signalVisuals,
      ...bayResult.signalVisuals,
      ...eastCityResult.signalVisuals,
      ...westCityResult.signalVisuals,
    ],
    busStops: [...busStops, ...bayResult.busStops],
    gasStations: [
      { x: 26, z: -76, fuelBays: gasStationMain.fuelBays },
      { x: -108, z: 76, fuelBays: gasStationWest.fuelBays },
      { x: 108, z: -76, fuelBays: gasStationEast.fuelBays },
      bayResult.gasStation,
    ],
    malls: [...malls, ...bayResult.malls, ...eastCityResult.malls, ...westCityResult.malls],
    hotelCoords: {
      cx: 26,
      cz: 34,
      doorNorth: { x: 26, z: 23.2 },
      doorSouth: { x: 26, z: 44.8 },
      receptionSpots: [
        { x: 18.2, z: 30.5, yaw: -Math.PI * 0.5 },
        { x: 18.2, z: 33.2, yaw: -Math.PI * 0.5 },
      ],
      kitchenSpots: [
        { x: 33.5, z: 25.5, yaw: 0 },
        { x: 36.2, z: 25.5, yaw: 0 },
      ],
      cleanWaypoints: [
        { x: 24, z: 30 },
        { x: 29, z: 38 },
        { x: 22, z: 42 },
      ],
    },
    parkCoords: {
      cx: -46,
      cz: 44,
      benches: [
        ...parkBuilt.benches,
        ...bayResult.parkBenches,
        ...eastCityResult.parkBenches,
        ...westCityResult.parkBenches,
      ],
      playgroundSpots: [
        { x: -36, z: 50 },
        { x: -31, z: 49 },
        { x: -34, z: 55 },
        { x: -37, z: 56 },
      ],
      gymSpots: [
        { x: -58, z: 31, mode: 'jump' },
        { x: -55, z: 31, mode: 'pushup' },
        { x: -52, z: 31, mode: 'stretch' },
      ],
      jogLoop: [
        { x: -64, z: 26 },
        { x: -28, z: 26 },
        { x: -28, z: 62 },
        { x: -64, z: 62 },
      ],
      cycleLoop: [
        { x: -68, z: 22 },
        { x: -24, z: 22 },
        { x: -24, z: 66 },
        { x: -68, z: 66 },
      ],
    },
    festivalCoords: festivalData,
    stadiumCoords: {
      cx: 188,
      cz: -195,
      ballMesh: stadiumBall,
      pitchSpots: [
        { x: 180, z: -199 },
        { x: 196, z: -191 },
        { x: 184, z: -192 },
        { x: 192, z: -198 },
        { x: 175, z: -195 },
        { x: 201, z: -195 },
      ],
      spectatorSeats: [
        { x: 178, y: 1.9, z: -207.8, yaw: 0 },
        { x: 184, y: 3.0, z: -209.2, yaw: 0 },
        { x: 192, y: 1.9, z: -207.8, yaw: 0 },
        { x: 198, y: 3.0, z: -209.2, yaw: 0 },
        { x: 178, y: 1.9, z: -182.2, yaw: Math.PI },
        { x: 184, y: 3.0, z: -180.8, yaw: Math.PI },
        { x: 192, y: 1.9, z: -182.2, yaw: Math.PI },
        { x: 198, y: 3.0, z: -180.8, yaw: Math.PI },
      ],
    },
    stationBenches: railwayBuilt.stationBenches,
    trainCarStates: railwayBuilt.trainCarStates,
    mountainCamps,
    powerPlantSpots: [
      { x: 180, z: 178 },
      { x: 194, z: 176 },
      { x: 188, z: 194 },
      { x: 204, z: 188 },
    ],
    buildingResidentSpots: [
      { x: 190, z: -88 },
      { x: 182, z: -96 },
      { x: -112, z: 179 },
      { x: 180, z: 22 },
      { x: 192, z: 42 },
      { x: 56, z: -46 },
      ...bayResult.residentSpots,
    ],
    hospitalSpots: [
      { x: 315, z: -85 },
      { x: 310, z: -94 },
      { x: 320, z: -94 },
      { x: 315, z: -102 },
    ],
    beachSpots: [
      { x: 552, z: -24 },
      { x: 554, z: 22 },
      { x: 552, z: 54 },
      { x: 566, z: 65 },
    ],
    gangAnchors: allGangAnchors,
    farmPlots,
    touristSpots: [
      { x: -182, z: 185, lookAtX: -195, lookAtZ: 205 },
      { x: -202, z: -152, lookAtX: -216, lookAtZ: -178 },
      { x: -178, z: -174, lookAtX: -200, lookAtZ: -215 },
      { x: 26, z: 18, lookAtX: 26, lookAtZ: 34 },
      { x: 162, z: -172, lookAtX: 188, lookAtZ: -195 },
      ...bayResult.touristSpots,
      ...eastCityResult.touristSpots,
      ...westCityResult.touristSpots,
    ],
    constructionSpots: [
      { x: 102, z: -184 },
      { x: 112, z: -188 },
      ...bayResult.constructionSpots,
    ],
    gardenSpots: [
      { x: 112, z: 192 },
      { x: 120, z: 208 },
      { x: -46, z: 36 },
      { x: -50, z: 52 },
      ...bayResult.gardenSpots,
      ...eastCityResult.gardenSpots,
      ...westCityResult.gardenSpots,
    ],
    deliveryRoutes: [
      { fromX: 176, fromZ: 174, toX: -44, toZ: -13 },
      { fromX: 176, fromZ: 174, toX: 26, toZ: 20 },
      { fromX: 326, fromZ: -164, toX: 315, toZ: -102 },
    ],
    snowSlope: {
      lanes: [
        { x: -178, topZ: -245, bottomZ: -168 },
        { x: -192, topZ: -245, bottomZ: -168 },
        { x: -206, topZ: -245, bottomZ: -168 },
        { x: -222, topZ: -245, bottomZ: -168 },
      ],
      getHeight: getSnowMountainHeight,
    },
    roadRectLoops: [
      ...baseAndBayRoadLoops,
      ...eastCityResult.roadRectLoops,
      ...westCityResult.roadRectLoops,
    ],
    eastRoadRectLoopStartIdx,
    westRoadRectLoopStartIdx,
    roadCircleLoops: eastCityResult.roadCircleLoops,
    castleFootGuards: eastCityResult.castleFootGuards,
    castleHorseGuards: eastCityResult.castleHorseGuards,
    castleInteriorSpots: eastCityResult.castleInteriorSpots,
    hospitalBeds: bayResult.hospitalBeds,
    hospitalDoctorSpots: bayResult.hospitalDoctorSpots,
    showroomSpots: bayResult.showroomSpots,
    beachLoungers: bayResult.beachLoungers,
    infinityPoolZone: { minX: 19, maxX: 33, minZ: 49.5, maxZ: 57.0, y: 0.16 },
    mansionPartyZone: { minX: -14, maxX: 42, minZ: -386, maxZ: -326, y: 11.6, djX: 0, djZ: -378 },
    eastCitizenSpots: eastCityResult.eastCitizenSpots,
    westCitizenSpots: westCityResult.westCitizenSpots,
    groundHeightAt,
  };

  const npcManager = new SimulatorNpcManager(npcEnv, isSoftwareGl);
  npcManager.root.userData.keepInArenaRoot = true;
  arenaGroup.add(npcManager.root);

  // Build Low-Poly Skyline Proxies for distant districts & register all lodDetailGroups + solid OccluderVolumes
  const proxyStoneMat = isReducedQ
    ? new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
    : new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72, metalness: 0.08 });
  const proxyAccentMat = isReducedQ
    ? new THREE.MeshLambertMaterial({ color: 0x0ea5e9 })
    : new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.45, metalness: 0.25 });
  const proxyGoldMat = isReducedQ
    ? new THREE.MeshLambertMaterial({ color: 0xf59e0b })
    : new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.45 });
  const proxyGlassDomeMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    roughness: 0.25,
    metalness: 0.15,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  materials.push(proxyStoneMat, proxyAccentMat, proxyGoldMat, proxyGlassDomeMat);
  const proxyBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const proxyDomeGeo = new THREE.SphereGeometry(SMART_CITY_DOME.radius, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const proxyPyrGeo = new THREE.ConeGeometry(28, 22, 4);
  geometries.push(proxyBoxGeo, proxyDomeGeo, proxyPyrGeo);

  const mkProxyBox = (
    pg: THREE.Group,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => {
    const m = new THREE.Mesh(proxyBoxGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    pg.add(m);
  };

  for (let i = 0; i < lodDetailGroups.length; i++) {
    const lg = lodDetailGroups[i];
    let proxyGroup: THREE.Group | null = null;
    let proxyMaxDist = lg.maxDist + 520;

    if (lg.tier === 'district') {
      proxyGroup = new THREE.Group();
      proxyGroup.name = `lowpoly_proxy_${i}`;
      if (Math.abs(lg.x) < 10 && lg.z < -300) {
        // Apex Mansion Low-Poly Silhouette
        mkProxyBox(proxyGroup, proxyStoneMat, 0, 10, -356, 68, 20, 54);
        mkProxyBox(proxyGroup, proxyGoldMat, 0, 21.5, -356, 72, 2.5, 58);
        mkProxyBox(proxyGroup, proxyStoneMat, -60, 4, -350, 34, 8, 52);
        proxyMaxDist = 920;
      } else if (Math.abs(lg.x - SMART_CITY_DOME.centerX) < 10 && Math.abs(lg.z - SMART_CITY_DOME.centerZ) < 10) {
        // Smart City Low-Poly Translucent Bio-Dome Silhouette
        const domeProxy = new THREE.Mesh(proxyDomeGeo, proxyGlassDomeMat);
        domeProxy.position.set(SMART_CITY_DOME.centerX, 0, SMART_CITY_DOME.centerZ);
        proxyGroup.add(domeProxy);
        mkProxyBox(proxyGroup, proxyAccentMat, SMART_CITY_DOME.centerX, 24, SMART_CITY_DOME.centerZ - 16, 26, 48, 26);
        proxyMaxDist = 1180;
      } else if (Math.abs(lg.x - 415) < 20) {
        // Bay City Low-Poly Skyline + Red Bridge Pylons
        mkProxyBox(proxyGroup, proxyStoneMat, 355, 28, -24, 22, 56, 22);
        mkProxyBox(proxyGroup, proxyAccentMat, 315, 16, -102, 26, 32, 22);
        mkProxyBox(proxyGroup, proxyStoneMat, 315, 8, 42, 54, 16, 38);
        mkProxyBox(proxyGroup, proxyGoldMat, 545, 22, 0, 18, 44, 18);
        proxyMaxDist = 1150;
      } else if (lg.x > 900) {
        // East City Low-Poly Skyline (Ring City, Airport, Castle)
        mkProxyBox(proxyGroup, proxyStoneMat, 902, 26, 0, 28, 52, 28);
        mkProxyBox(proxyGroup, proxyAccentMat, 1175, 12, -148, 86, 24, 34);
        mkProxyBox(proxyGroup, proxyGoldMat, 1280, 18, 185, 42, 36, 42);
        proxyMaxDist = 1480;
      } else if (lg.x < -500) {
        // West City Low-Poly Skyline (Spaceport Rocket, Sun Pyramid, Biodomes)
        mkProxyBox(proxyGroup, proxyStoneMat, -994, 24, -125, 14, 48, 14);
        const pyrProxy = new THREE.Mesh(proxyPyrGeo, proxyGoldMat);
        pyrProxy.position.set(-985, 11, 175);
        pyrProxy.rotation.y = Math.PI * 0.25;
        proxyGroup.add(pyrProxy);
        mkProxyBox(proxyGroup, proxyAccentMat, -662, 22, -229, 32, 44, 32);
        proxyMaxDist = 1350;
      }
    }

    const actualParent = lg.group.parent instanceof THREE.Group ? lg.group.parent : arenaGroup;
    worldStreaming.registerDistrictGroup({
      id: `lod_${i}`,
      parent: actualParent,
      group: lg.group,
      proxyGroup,
      x: lg.x,
      y: lg.y,
      z: lg.z,
      radius: lg.radius,
      maxDist: lg.maxDist,
      proxyMaxDist,
      tier: lg.tier,
    });
  }

  // Register solid opaque Mountain & Architectural Occluder Volumes for Frustum + Occlusion Culling
  worldStreaming.registerOccluder('nw_snow_mountain', -252, 0, -245, -162, 13.5, -162);
  worldStreaming.registerOccluder('waterfront_hotel_core', 26 - 13.5, 4.8, 34 - 9.6, 26 + 13.5, 14.0, 34 + 9.6);
  worldStreaming.registerOccluder('metro_stadium_north', 188 - 18, 0, -195 - 19.6, 188 + 18, 8.2, -195 - 17.5);
  worldStreaming.registerOccluder('metro_stadium_south', 188 - 18, 0, -195 + 17.5, 188 + 18, 8.2, -195 + 19.6);
  worldStreaming.registerOccluder('power_plant_block', 192 - 14, 0, 186 - 10, 192 + 14, 15.5, 186 + 10);
  worldStreaming.registerOccluder('bay_hospital_core', 315 - 12, 4.5, -102 - 10, 315 + 12, 18.0, -102 + 10);
  worldStreaming.registerOccluder('west_sun_pyramid', -985 - 18, 0, 175 - 18, -985 + 18, 12.0, 175 + 18);
  worldStreaming.registerOccluder('east_castle_keep', 1280 - 16, 0, 185 - 16, 1280 + 16, 18.0, 185 + 16);
  // Solid opaque flanking stone wings of all Malls (leaves glass front portals & E/W curtain windows unoccluded!)
  for (let m = 0; m < malls.length; m++) {
    const mc = malls[m].nav;
    worldStreaming.registerOccluder(`mall_${m}_nw`, mc.cx - 27.5, 0, mc.cz - 19.0, mc.cx - 6.0, 14.8, mc.cz - 18.0);
    worldStreaming.registerOccluder(`mall_${m}_ne`, mc.cx + 6.0, 0, mc.cz - 19.0, mc.cx + 27.5, 14.8, mc.cz - 18.0);
    worldStreaming.registerOccluder(`mall_${m}_sw`, mc.cx - 27.5, 0, mc.cz + 18.0, mc.cx - 6.0, 14.8, mc.cz + 19.0);
    worldStreaming.registerOccluder(`mall_${m}_se`, mc.cx + 6.0, 0, mc.cz + 18.0, mc.cx + 27.5, 14.8, mc.cz + 19.0);
  }

  scene.add(arenaGroup);
  arenaGroup.updateMatrixWorld(true);

  const shootableScreens = displays.collectShootableMeshes(arenaGroup);

  return {
    arenaGroup,
    colliders,
    dynamicColliders,
    ramps,
    coverNodes,
    doorways,
    interactables,
    mansionSeats,
    boostPads: westCityResult.boostPads,
    stuntRings: westCityResult.stuntRings,
    raceCheckpoints: westCityResult.raceCheckpoints,
    barrels,
    shootableEnv,
    breakableGlass,
    displays,
    shootableScreens,
    wildlifeProps,
    supplyCrates,
    clouds,
    groundHeightAt,
    playableRadius: 1500,
    zoneCenter: { x: 160, z: -120 },
    mapBounds: { minX: -1165, maxX: 1500, minZ: -780, maxZ: 335 },
    interiorSpawns: [],
    vehicleSpawns,
    dayNightTargets: {
      cloudMat: skyDome.cloudMat,
      streetLampMats,
      windowEmissiveMats,
      nightGlowMats,
      lodDetailGroups,
    },
    realisticTargets: {
      skyDome,
      waters,
      grass: grassSystem,
      terrainSplats: [terrainSplat],
    },
    npcManager,
    smartCity,
    smartCityTransit,
    scienceDistrict,
    worldStreaming,
    updateMansionPortals: mansionBuilt.updateProximityPortals,
    update: (dt: number, elapsed: number, cameraPos?: THREE.Vector3 | null, quality?: GraphicsQuality) => {
      const q = quality ?? graphicsQuality;
      const perfScale = q === 'low' ? 2.8 : q === 'medium' ? 1.9 : isSoftwareGl ? 1.5 : 1;
      displays.update(elapsed, dt, cameraPos, null, perfScale, q);
      if (q === 'high' || Math.floor(elapsed * 20) !== Math.floor((elapsed - dt) * 20)) {
        floraBuilt.updateTrees(elapsed);
        if (grassSystem) grassSystem.update(elapsed);
      }
      skyDome.update(elapsed);
      for (let w = 0; w < waters.length; w++) {
        if (waters[w].mesh.visible) {
          waters[w].update(elapsed);
        }
      }
      for (let i = 0; i < updaters.length; i++) {
        updaters[i](dt, elapsed, cameraPos);
      }
    },
    dispose: () => {
      worldStreaming.dispose();
      smartCityTransit.dispose();
      smartCity.dispose();
      scienceDistrict.dispose();
      wildlifeProps.dispose();
      displays.dispose();
      npcManager.dispose();
      disposeObject3DResources(arenaGroup, mats.sharedSet);
      scene.remove(arenaGroup);
      pal.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
