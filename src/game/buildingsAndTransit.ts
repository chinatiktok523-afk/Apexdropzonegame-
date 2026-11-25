import * as THREE from 'three';
import type { GraphicsQuality } from '../types';
import type { BarrelActor, BreakableGlassPane, ColliderBox, DoorwayTrigger, MansionSeatSpot, RampSurface, SurfaceType, WorldInteractable } from './arena';
import type { DigitalDisplayManager } from './digitalDisplays';
import type { ProceduralTextureSet } from './textures';
import { createPropPbrMaterials, PropMeshAssembler } from './urbanProps';

export interface SimWorldBuildContext {
  arenaGroup: THREE.Group;
  colliders: ColliderBox[];
  dynamicColliders?: ColliderBox[];
  ramps: RampSurface[];
  doorways: DoorwayTrigger[];
  interactables: WorldInteractable[];
  mansionSeats?: MansionSeatSpot[];
  barrels?: BarrelActor[];
  shootableEnv: THREE.Object3D[];
  breakableGlass?: BreakableGlassPane[];
  shootableBalloons?: import('./worldWildlifeProps').BalloonRegistration[];
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
  updaters: Array<(dt: number, elapsed: number, cameraPos?: THREE.Vector3 | null) => void>;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  displays: DigitalDisplayManager;
  textures?: ProceduralTextureSet;
  isSoftwareGl: boolean;
  graphicsQuality?: GraphicsQuality;
}

export function registerBreakableGlass(ctx: SimWorldBuildContext, mesh: THREE.Mesh): THREE.Mesh {
  mesh.userData.isBreakableBuildingGlass = true;
  ctx.shootableEnv.push(mesh);
  if (ctx.breakableGlass) {
    ctx.breakableGlass.push({ mesh, broken: false, respawnTimer: 0 });
  }
  return mesh;
}

export type CitySurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;

export interface CityPalette {
  boxGeo: THREE.BoxGeometry;
  cylGeo: THREE.CylinderGeometry;
  whiteMarble: CitySurfaceMaterial;
  creamStone: CitySurfaceMaterial;
  facadeGlass: CitySurfaceMaterial;
  facadeMasonry: CitySurfaceMaterial;
  facadePanel: CitySurfaceMaterial;
  mallMarble: CitySurfaceMaterial;
  warmGold: CitySurfaceMaterial;
  charcoalSteel: CitySurfaceMaterial;
  slateAsphalt: CitySurfaceMaterial;
  concreteDeck: CitySurfaceMaterial;
  terracottaWood: CitySurfaceMaterial;
  glassClear: CitySurfaceMaterial;
  windowDayNight: CitySurfaceMaterial;
  poolWater: CitySurfaceMaterial;
  redAwning: CitySurfaceMaterial;
  tealAwning: CitySurfaceMaterial;
  amberAwning: CitySurfaceMaterial;
  greenTurf: CitySurfaceMaterial;
  lampGlow: THREE.MeshBasicMaterial;
  warmChandelier: THREE.MeshBasicMaterial;
  cyanNeon: THREE.MeshBasicMaterial;
}

export function createCityPalette(ctx: SimWorldBuildContext): CityPalette {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  ctx.geometries.push(boxGeo, cylGeo);

  const useLambert = ctx.graphicsQuality === 'low' || ctx.graphicsQuality === 'medium';

  const mkStd = (
    color: number,
    roughness: number,
    metalness = 0.08,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
  ): CitySurfaceMaterial => {
    if (useLambert) {
      const m = new THREE.MeshLambertMaterial({
        color,
        ...(extra.map ? { map: extra.map } : {}),
        ...(extra.emissive ? { emissive: extra.emissive } : {}),
        ...(extra.emissiveIntensity !== undefined ? { emissiveIntensity: extra.emissiveIntensity } : {}),
        ...(extra.transparent !== undefined ? { transparent: extra.transparent } : {}),
        ...(extra.opacity !== undefined ? { opacity: extra.opacity } : {}),
        ...(extra.polygonOffset !== undefined ? { polygonOffset: extra.polygonOffset } : {}),
        ...(extra.polygonOffsetFactor !== undefined ? { polygonOffsetFactor: extra.polygonOffsetFactor } : {}),
        ...(extra.polygonOffsetUnits !== undefined ? { polygonOffsetUnits: extra.polygonOffsetUnits } : {}),
        ...(extra.side !== undefined ? { side: extra.side } : {}),
      });
      ctx.materials.push(m);
      return m;
    }
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    ctx.materials.push(m);
    return m;
  };
  const mkBasic = (color: number) => {
    const m = new THREE.MeshBasicMaterial({ color });
    ctx.materials.push(m);
    return m;
  };

  const tex = ctx.textures;
  const windowDayNight = mkStd(0x9bd2f2, 0.16, 0.35, {
    ...(tex?.facadeGlassGrid ? { map: tex.facadeGlassGrid } : {}),
    emissive: new THREE.Color(0xffd27d),
    emissiveIntensity: 0,
  });
  ctx.windowEmissiveMats.push(windowDayNight);

  const lampGlow = mkBasic(0xfff1a8);
  ctx.streetLampMats.push(lampGlow);

  return {
    boxGeo,
    cylGeo,
    whiteMarble: mkStd(0xe4e0d8, 0.58, 0.06, {
      ...(tex?.facadeModernPanel ? { map: tex.facadeModernPanel } : {}),
    }),
    creamStone: mkStd(0xe0d2be, 0.72, 0.05, {
      ...(tex?.facadeMasonryWarm ? { map: tex.facadeMasonryWarm } : {}),
    }),
    facadeGlass: mkStd(0x7cc4eb, 0.18, 0.38, {
      ...(tex?.facadeGlassGrid ? { map: tex.facadeGlassGrid } : {}),
    }),
    facadeMasonry: mkStd(0xd8b896, 0.78, 0.04, {
      ...(tex?.facadeMasonryWarm ? { map: tex.facadeMasonryWarm } : {}),
    }),
    facadePanel: mkStd(0xcbd5e1, 0.52, 0.16, {
      ...(tex?.facadeModernPanel ? { map: tex.facadeModernPanel } : {}),
    }),
    mallMarble: mkStd(0xebe6dd, 0.32, 0.08, {
      ...(tex?.mallMarbleTile ? { map: tex.mallMarbleTile } : {}),
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    warmGold: mkStd(0xd99b26, 0.28, 0.72),
    charcoalSteel: mkStd(0x222936, 0.44, 0.52),
    slateAsphalt: mkStd(0x363d47, 0.88, 0.04, {
      ...(tex?.asphaltAlbedo ? { map: tex.asphaltAlbedo } : {}),
      ...(tex?.asphaltNormal ? { normalMap: tex.asphaltNormal } : {}),
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    concreteDeck: mkStd(0xa2aab5, 0.82, 0.06, {
      ...(tex?.concreteAlbedo ? { map: tex.concreteAlbedo } : {}),
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    terracottaWood: mkStd(0x9a5b32, 0.74, 0.05, {
      ...(tex?.woodPlank ? { map: tex.woodPlank } : {}),
    }),
    glassClear: mkStd(0x8ed4f7, 0.12, 0.25, { transparent: true, opacity: 0.42 }),
    windowDayNight,
    poolWater: mkStd(0x0ea5e9, 0.14, 0.18, { transparent: true, opacity: 0.82 }),
    redAwning: mkStd(0xdc2626, 0.65, 0.05),
    tealAwning: mkStd(0x0d9488, 0.65, 0.05),
    amberAwning: mkStd(0xea580c, 0.65, 0.05),
    greenTurf: mkStd(0x3f8f46, 0.88, 0.02, {
      ...(tex?.terrainAlbedo ? { map: tex.terrainAlbedo } : {}),
    }),
    lampGlow,
    warmChandelier: mkBasic(0xffdf8e),
    cyanNeon: mkBasic(0x22d3ee),
  };
}

function addBoxMesh(
  parent: THREE.Object3D,
  pal: CityPalette,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  opts?: { rotY?: number; rotX?: number; rotZ?: number; castShadow?: boolean; receiveShadow?: boolean },
): THREE.Mesh {
  const m = new THREE.Mesh(pal.boxGeo, mat);
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  if (opts?.rotY) m.rotation.y = opts.rotY;
  if (opts?.rotX) m.rotation.x = opts.rotX;
  if (opts?.rotZ) m.rotation.z = opts.rotZ;
  m.castShadow = opts?.castShadow ?? false;
  m.receiveShadow = opts?.receiveShadow ?? true;
  parent.add(m);
  return m;
}

function pushCollider(
  colliders: ColliderBox[],
  cx: number,
  minY: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  rotY = 0,
  surface: SurfaceType = 'concrete',
): ColliderBox {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const halfW = (w * Math.abs(cosY) + d * Math.abs(sinY)) * 0.5;
  const halfD = (w * Math.abs(sinY) + d * Math.abs(cosY)) * 0.5;
  const box: ColliderBox = {
    minX: cx - halfW,
    maxX: cx + halfW,
    minY,
    maxY: minY + h,
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
  };
  colliders.push(box);
  return box;
}

/**
 * Adds stepped left/right side-guard colliders along a sloped stair flight so players cannot walk sideways off stairs,
 * while leaving top/bottom landings (t in [0.04..0.96]) and headroom underneath elevated flights completely unobstructed.
 */
export function addStairSideGuardColliders(
  colliders: ColliderBox[],
  opts: {
    axis: 'x' | 'z';
    centerCoord: number; // stairX if axis==='z', stairZ if axis==='x'
    startCoord: number;
    endCoord: number;
    yBottom: number;
    yTop: number;
    width: number;
    railSides?: 'both' | 'left' | 'right';
    originX?: number;
    originBaseY?: number;
    originZ?: number;
    rotY?: number;
    segments?: number;
  },
): void {
  const {
    axis,
    centerCoord,
    startCoord,
    endCoord,
    yBottom,
    yTop,
    width,
    railSides = 'both',
    originX = 0,
    originBaseY = 0,
    originZ = 0,
    rotY = 0,
    segments = 5,
  } = opts;
  const span = endCoord - startCoord;
  if (Math.abs(span) < 0.2) return;
  const guardThickness = 0.22;
  const guardHeight = 1.38;
  const sideOffset = width * 0.5 + guardThickness * 0.45;
  const offsets: number[] = [];
  if (railSides === 'both' || railSides === 'left') offsets.push(-sideOffset);
  if (railSides === 'both' || railSides === 'right') offsets.push(sideOffset);

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  for (let i = 0; i < segments; i++) {
    const f0 = 0.04 + (i / segments) * 0.92;
    const f1 = 0.04 + ((i + 1) / segments) * 0.92;
    const coord0 = startCoord + f0 * span;
    const coord1 = startCoord + f1 * span;
    const segLen = Math.abs(coord1 - coord0) + 0.16;
    const midAlong = (coord0 + coord1) * 0.5;
    const y0 = THREE.MathUtils.lerp(yBottom, yTop, f0);
    const y1 = THREE.MathUtils.lerp(yBottom, yTop, f1);
    const segFloorY = Math.min(y0, y1);
    const segExtraH = Math.abs(y1 - y0);

    for (let s = 0; s < offsets.length; s++) {
      const lx = axis === 'z' ? centerCoord + offsets[s] : midAlong;
      const lz = axis === 'z' ? midAlong : centerCoord + offsets[s];
      const wx = originX + lx * cosY + lz * sinY;
      const wz = originZ - lx * sinY + lz * cosY;
      const wBox = axis === 'z' ? guardThickness : segLen;
      const dBox = axis === 'z' ? segLen : guardThickness;
      pushCollider(
        colliders,
        wx,
        originBaseY + segFloorY - 0.08,
        wz,
        wBox,
        guardHeight + segExtraH,
        dBox,
        rotY,
        'metal',
      );
    }
  }
}

/**
 * Architectural micro-block staircase with dual angled steel stringers, open treads with non-slip nosing,
 * tempered glass balustrade panels, continuous top handrail, newel posts, and seamless RampSurface.
 */
export function buildArchitecturalStaircase(
  parent: THREE.Object3D,
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  opts: {
    ox: number;
    oz: number;
    stairX: number;
    zStart: number;
    zEnd: number;
    yBottom: number;
    yTop: number;
    width: number;
    stepCount?: number;
    railSides?: 'both' | 'left' | 'right';
    treadMat?: THREE.Material;
    stringerMat?: THREE.Material;
  },
): void {
  const { ox, oz, stairX, zStart, zEnd, yBottom, yTop, width } = opts;
  const stepCount = opts.stepCount ?? Math.max(10, Math.round((yTop - yBottom) * 3.0));
  const treadMat = opts.treadMat ?? pal.terracottaWood;
  const stringerMat = opts.stringerMat ?? pal.charcoalSteel;
  const railSides = opts.railSides ?? 'both';

  const runSigned = zEnd - zStart;
  const runLen = Math.abs(runSigned);
  const rise = yTop - yBottom;
  const midZ = (zStart + zEnd) * 0.5;
  const midY = (yBottom + yTop) * 0.5;
  const diagLen = Math.hypot(runLen, rise);
  const rotX = (runSigned >= 0 ? -1 : 1) * Math.atan2(rise, runLen);
  const dirZ = runSigned >= 0 ? 1 : -1;

  const dummy = new THREE.Object3D();
  const buildInstancedBoxes = (
    mat: THREE.Material,
    transforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; rotX?: number }>,
    castShadow = false,
  ) => {
    if (transforms.length === 0) return;
    const im = new THREE.InstancedMesh(pal.boxGeo, mat, transforms.length);
    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i];
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(t.rotX ?? 0, 0, 0);
      dummy.scale.set(t.sx, t.sy, t.sz);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = castShadow;
    im.receiveShadow = true;
    parent.add(im);
  };

  const stringerTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; rotX?: number }> = [];
  const treadTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; rotX?: number }> = [];
  const nosingTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; rotX?: number }> = [];
  const glassTransforms: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; rotX?: number }> = [];

  // Dual angled structural side stringers + center mono-spine carriage beam
  [-width * 0.5 + 0.08, width * 0.5 - 0.08].forEach((sxOff) => {
    stringerTransforms.push({ x: stairX + sxOff, y: midY - 0.14, z: midZ, sx: 0.12, sy: 0.24, sz: diagLen + 0.2, rotX });
  });
  stringerTransforms.push({ x: stairX, y: midY - 0.2, z: midZ, sx: 0.24, sy: 0.22, sz: diagLen + 0.1, rotX });

  // Individual micro-block treads + crisp dark non-slip front nosing
  const treadDepth = Math.min(0.95, (runLen / stepCount) * 1.12);
  for (let s = 0; s < stepCount; s++) {
    const f = (s + 0.5) / stepCount;
    const sz = THREE.MathUtils.lerp(zStart, zEnd, f);
    const topY = yBottom + f * rise;
    treadTransforms.push({ x: stairX, y: topY - 0.045, z: sz, sx: width - 0.18, sy: 0.09, sz: treadDepth });
    nosingTransforms.push({
      x: stairX,
      y: topY - 0.012,
      z: sz - dirZ * (treadDepth * 0.44),
      sx: width - 0.22,
      sy: 0.032,
      sz: 0.08,
    });
  }

  // Tempered glass balustrades, stainless/charcoal handrail & vertical newel posts
  const railOffsets: number[] = [];
  if (railSides === 'both' || railSides === 'left') railOffsets.push(-width * 0.5 + 0.06);
  if (railSides === 'both' || railSides === 'right') railOffsets.push(width * 0.5 - 0.06);

  for (const rOff of railOffsets) {
    const rx = stairX + rOff;
    glassTransforms.push({ x: rx, y: midY + 0.48, z: midZ, sx: 0.045, sy: 0.92, sz: diagLen + 0.12, rotX });
    stringerTransforms.push({ x: rx, y: midY + 0.96, z: midZ, sx: 0.08, sy: 0.065, sz: diagLen + 0.28, rotX });
    stringerTransforms.push({ x: rx, y: yBottom + 0.5, z: zStart, sx: 0.08, sy: 1.0, sz: 0.08 });
    stringerTransforms.push({ x: rx, y: midY + 0.48, z: midZ, sx: 0.07, sy: 1.0, sz: 0.07 });
    stringerTransforms.push({ x: rx, y: yTop + 0.5, z: zEnd, sx: 0.08, sy: 1.0, sz: 0.08 });
  }

  buildInstancedBoxes(treadMat, treadTransforms, !ctx.isSoftwareGl);
  if (stringerMat === pal.charcoalSteel) {
    buildInstancedBoxes(stringerMat, stringerTransforms.concat(nosingTransforms), !ctx.isSoftwareGl);
  } else {
    buildInstancedBoxes(stringerMat, stringerTransforms, !ctx.isSoftwareGl);
    buildInstancedBoxes(pal.charcoalSteel, nosingTransforms, false);
  }
  buildInstancedBoxes(pal.glassClear, glassTransforms, false);

  // Walkable sloped ramp surface
  const minZ = Math.min(zStart, zEnd);
  const maxZ = Math.max(zStart, zEnd);
  ctx.ramps.push({
    minX: ox + stairX - width * 0.5,
    maxX: ox + stairX + width * 0.5,
    minZ: oz + minZ - 0.25,
    maxZ: oz + maxZ + 0.25,
    axis: 'z',
    startCoord: oz + zStart,
    endCoord: oz + zEnd,
    startY: yBottom,
    endY: yTop,
  });

  addStairSideGuardColliders(ctx.colliders, {
    axis: 'z',
    centerCoord: ox + stairX,
    startCoord: oz + zStart,
    endCoord: oz + zEnd,
    yBottom,
    yTop,
    width,
    railSides: 'both',
  });
}

function registerOpenableDoor(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  opts: {
    id: string;
    label: string;
    worldX: number;
    baseY: number;
    worldZ: number;
    width: number;
    height: number;
    axis: 'x' | 'z';
    doorMat?: THREE.Material;
    doubleLeaf?: boolean;
    startOpen?: boolean;
  },
) {
  const { worldX, baseY, worldZ, width, height, axis, doubleLeaf = false, startOpen = false } = opts;
  const doorRoot = new THREE.Group();
  doorRoot.position.set(worldX, baseY, worldZ);
  if (axis === 'z') {
    doorRoot.rotation.y = Math.PI * 0.5;
  }
  ctx.arenaGroup.add(doorRoot);

  // Frame posts & header
  const postMat = pal.charcoalSteel;
  addBoxMesh(doorRoot, pal, postMat, -width * 0.5 - 0.1, height * 0.5, 0, 0.2, height, 0.34);
  addBoxMesh(doorRoot, pal, postMat, width * 0.5 + 0.1, height * 0.5, 0, 0.2, height, 0.34);
  addBoxMesh(doorRoot, pal, postMat, 0, height + 0.12, 0, width + 0.4, 0.24, 0.36);

  const pivots: THREE.Group[] = [];
  const leafMat = opts.doorMat ?? pal.glassClear;
  if (doubleLeaf) {
    [-1, 1].forEach((side) => {
      const piv = new THREE.Group();
      piv.position.set(side * (width * 0.5), 0, 0);
      const leafW = width * 0.48;
      addBoxMesh(piv, pal, leafMat, -side * (leafW * 0.5), height * 0.5, 0, leafW, height - 0.08, 0.12);
      addBoxMesh(piv, pal, pal.warmGold, -side * (leafW * 0.85), height * 0.46, 0.09, 0.07, 0.55, 0.05);
      addBoxMesh(piv, pal, pal.warmGold, -side * (leafW * 0.85), height * 0.46, -0.09, 0.07, 0.55, 0.05);
      doorRoot.add(piv);
      pivots.push(piv);
    });
  } else {
    const piv = new THREE.Group();
    piv.position.set(-width * 0.5, 0, 0);
    addBoxMesh(piv, pal, leafMat, width * 0.48, height * 0.5, 0, width * 0.96, height - 0.08, 0.14);
    addBoxMesh(piv, pal, pal.warmGold, width * 0.86, height * 0.46, 0.09, 0.1, 0.38, 0.05);
    addBoxMesh(piv, pal, pal.warmGold, width * 0.86, height * 0.46, -0.09, 0.1, 0.38, 0.05);
    doorRoot.add(piv);
    pivots.push(piv);
  }

  // Collider toggles seamlessly in/out of player Y band without changing resolveCollisions
  const colW = axis === 'x' ? width : 0.28;
  const colD = axis === 'x' ? 0.28 : width;
  const doorCollider = pushCollider(
    ctx.colliders,
    worldX,
    startOpen ? 900 : baseY,
    worldZ,
    colW,
    height,
    colD,
    0,
    'metal',
  );

  let isOpen = startOpen;
  let openAnim = startOpen ? 1 : 0;
  if (startOpen) {
    const angle = Math.PI * 0.46;
    if (pivots.length === 2) {
      pivots[0].rotation.y = angle;
      pivots[1].rotation.y = -angle;
    } else if (pivots[0]) {
      pivots[0].rotation.y = angle;
    }
  }

  ctx.updaters.push((dt) => {
    const target = isOpen ? 1 : 0;
    if (Math.abs(openAnim - target) > 0.002) {
      openAnim = THREE.MathUtils.damp(openAnim, target, 10, dt);
      const angle = openAnim * Math.PI * 0.46;
      if (pivots.length === 2) {
        pivots[0].rotation.y = angle;
        pivots[1].rotation.y = -angle;
      } else if (pivots[0]) {
        pivots[0].rotation.y = angle;
      }
    }
  });

  ctx.interactables.push({
    id: opts.id,
    x: worldX,
    y: baseY,
    z: worldZ,
    radius: 3.3,
    category: 'door',
    getLabel: () => (isOpen ? `Close ${opts.label}` : `Open ${opts.label}`),
    trigger: () => {
      isOpen = !isOpen;
      if (isOpen) {
        doorCollider.minY = 900;
        doorCollider.maxY = 905;
        return `${opts.label} opened`;
      } else {
        doorCollider.minY = baseY;
        doorCollider.maxY = baseY + height;
        return `${opts.label} closed`;
      }
    },
  });
}

/**
 * 1. GRAND WATERFRONT RESORT HOTEL (Inspired by Resort/Lobby/Banquet/Suites/Boutique screenshots)
 * Axis-aligned at origin (ox, 0, oz) facing -Z (north boulevard entrance) with South Waterfront Pool!
 * Ground floor = Lobby & Chandelier Banquet Restaurant + Boutique Wing; Staircase to Floor 2 Luxury Suites & Floor 3 Sky Terrace!
 */
export function placeWaterfrontHotelResort(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  opts: { x: number; z: number },
) {
  const { x: ox, z: oz } = opts;
  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  ctx.arenaGroup.add(g);

  const detailGroup = new THREE.Group();
  g.add(detailGroup);
  ctx.lodDetailGroups.push({ group: detailGroup, x: ox, z: oz, maxDist: 92 });

  const W = 28; // x in [-14, +14]
  const D = 20; // z in [-10, +10]
  const F1H = 4.6;
  const F2H = 4.2;

  // Ground marble podium floor (visual)
  addBoxMesh(g, pal, pal.whiteMarble, 0, 0.08, 0, W + 4, 0.16, D + 4, { receiveShadow: true });

  // Outer perimeter ground walls (leave North Entrance z=-10 center x in [-2.6, 2.6] open for double doors!)
  // North facade segments + colorful architectural pilasters & cornice trim
  addBoxMesh(g, pal, pal.creamStone, -8.3, F1H * 0.5, -10, 11.4, F1H, 0.55);
  addBoxMesh(g, pal, pal.creamStone, 8.3, F1H * 0.5, -10, 11.4, F1H, 0.55);
  addBoxMesh(g, pal, pal.tealAwning, -8.3, F1H - 0.15, -10.1, 11.6, 0.35, 0.7);
  addBoxMesh(g, pal, pal.tealAwning, 8.3, F1H - 0.15, -10.1, 11.6, 0.35, 0.7);
  addBoxMesh(g, pal, pal.warmGold, -13.7, F1H * 0.5, -10.15, 0.55, F1H, 0.65);
  addBoxMesh(g, pal, pal.warmGold, 13.7, F1H * 0.5, -10.15, 0.55, F1H, 0.65);
  addBoxMesh(g, pal, pal.charcoalSteel, 0, F1H - 0.45, -10, 5.4, 0.9, 0.65);
  pushCollider(ctx.colliders, ox - 8.3, 0, oz - 10, 11.4, F1H, 0.7);
  pushCollider(ctx.colliders, ox + 8.3, 0, oz - 10, 11.4, F1H, 0.7);

  // Portico awning & glowing "APEX GRAND HOTEL" sign at North Entrance
  addBoxMesh(g, pal, pal.charcoalSteel, 0, 4.1, -12.4, 9.6, 0.35, 4.4);
  addBoxMesh(g, pal, pal.warmGold, -4.4, 2.0, -14.2, 0.45, 4.0, 0.45);
  addBoxMesh(g, pal, pal.warmGold, 4.4, 2.0, -14.2, 0.45, 4.0, 0.45);
  pushCollider(ctx.colliders, ox - 4.4, 0, oz - 14.2, 0.55, 4.0, 0.55);
  pushCollider(ctx.colliders, ox + 4.4, 0, oz - 14.2, 0.55, 4.0, 0.55);

  const hotelMarquee = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'GRAND RESORT HOTEL',
    subtitle: 'LOBBY · SUITES · POOL · SHOWROOM',
    accentHex: '#fbbf24',
    lockTitle: true,
    intervalSec: 0.9,
  }).material;
  const marqueeMesh = new THREE.Mesh(pal.boxGeo, hotelMarquee);
  marqueeMesh.position.set(0, 4.85, -10.38);
  marqueeMesh.scale.set(8.6, 1.35, 0.16);
  g.add(marqueeMesh);

  // Openable Hotel Main Glass Double Doors!
  registerOpenableDoor(ctx, pal, {
    id: 'hotel_main_door',
    label: 'Hotel Lobby Doors',
    worldX: ox,
    baseY: 0,
    worldZ: oz - 10,
    width: 4.8,
    height: 3.6,
    axis: 'x',
    doubleLeaf: true,
    startOpen: true,
  });

  // East & West Ground Walls with panoramic glass windows
  [-14, 14].forEach((wx) => {
    addBoxMesh(g, pal, pal.creamStone, wx, 0.75, 0, 0.55, 1.5, D);
    registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.windowDayNight, wx, 2.65, 0, 0.35, 2.3, D - 2.4));
    addBoxMesh(g, pal, pal.creamStone, wx, 4.2, 0, 0.55, 0.8, D);
    pushCollider(ctx.colliders, ox + wx, 0, oz, 0.7, F1H, D);
  });

  // South Waterfront Pool Wall (open patio doorway at x in [-2.2, 2.2])
  addBoxMesh(g, pal, pal.creamStone, -8.1, F1H * 0.5, 10, 11.8, F1H, 0.55);
  addBoxMesh(g, pal, pal.creamStone, 8.1, F1H * 0.5, 10, 11.8, F1H, 0.55);
  addBoxMesh(g, pal, pal.charcoalSteel, 0, F1H - 0.45, 10, 4.6, 0.9, 0.6);
  pushCollider(ctx.colliders, ox - 8.1, 0, oz + 10, 11.8, F1H, 0.7);
  pushCollider(ctx.colliders, ox + 8.1, 0, oz + 10, 11.8, F1H, 0.7);

  registerOpenableDoor(ctx, pal, {
    id: 'hotel_pool_door',
    label: 'Poolside Patio Doors',
    worldX: ox,
    baseY: 0,
    worldZ: oz + 10,
    width: 4.0,
    height: 3.6,
    axis: 'x',
    doubleLeaf: true,
    startOpen: true,
  });

  // Revolving Glass Vestibule Spinner right inside North Lobby entrance
  const revGroup = new THREE.Group();
  revGroup.position.set(0, 0, -7.6);
  for (let w = 0; w < 4; w++) {
    const wing = new THREE.Mesh(pal.boxGeo, pal.glassClear);
    wing.rotation.y = (w * Math.PI) * 0.5;
    wing.position.set(Math.sin(w * Math.PI * 0.5) * 0.8, 1.5, Math.cos(w * Math.PI * 0.5) * 0.8);
    wing.scale.set(1.5, 2.8, 0.08);
    revGroup.add(wing);
    registerBreakableGlass(ctx, wing);
  }
  const revHub = addBoxMesh(revGroup, pal, pal.warmGold, 0, 1.5, 0, 0.24, 3.0, 0.24);
  revHub.castShadow = false;
  g.add(revGroup);
  ctx.updaters.push((dt) => {
    revGroup.rotation.y += dt * 0.65;
  });

  // Ground Lobby Furniture & Chandelier Banquet Restaurant + Kitchen Buffet (Detail LOD group)
  // Curved/stepped Reception Desk on West Wing with Dual Monitors
  addBoxMesh(detailGroup, pal, pal.warmGold, -7.2, 0.62, -2.5, 5.2, 1.1, 1.3);
  addBoxMesh(detailGroup, pal, pal.whiteMarble, -7.2, 1.2, -2.5, 5.5, 0.14, 1.5);
  addBoxMesh(detailGroup, pal, pal.charcoalSteel, -8.4, 1.48, -2.5, 0.72, 0.44, 0.08);
  addBoxMesh(detailGroup, pal, pal.charcoalSteel, -6.0, 1.48, -2.5, 0.72, 0.44, 0.08);
  pushCollider(ctx.colliders, ox - 7.2, 0, oz - 2.5, 5.2, 1.25, 1.35);

  // Hot Cafeteria & Chef Kitchen Counter on North-East Wing
  addBoxMesh(detailGroup, pal, pal.charcoalSteel, 8.8, 0.58, -7.6, 6.4, 1.15, 1.35);
  addBoxMesh(detailGroup, pal, pal.whiteMarble, 8.8, 1.2, -7.6, 6.6, 0.12, 1.5);
  addBoxMesh(detailGroup, pal, pal.warmGold, 8.8, 3.65, -7.6, 6.4, 0.5, 1.4);
  pushCollider(ctx.colliders, ox + 8.8, 0, oz - 7.6, 6.4, 1.25, 1.4);

  // Chandelier Banquet Dining Tables on East Wing + Hot Food Plates & Cups
  [
    [6.5, -3.5],
    [10.2, -3.5],
    [6.5, 3.2],
    [10.2, 3.2],
  ].forEach(([tx, tz]) => {
    addBoxMesh(detailGroup, pal, pal.whiteMarble, tx, 0.85, tz, 2.2, 0.12, 2.2);
    addBoxMesh(detailGroup, pal, pal.warmGold, tx, 0.42, tz, 0.35, 0.8, 0.35);
    addBoxMesh(detailGroup, pal, pal.redAwning, tx - 1.35, 0.5, tz, 0.55, 0.7, 0.55);
    addBoxMesh(detailGroup, pal, pal.redAwning, tx + 1.35, 0.5, tz, 0.55, 0.7, 0.55);
    // Dining plates & hot bowls
    addBoxMesh(detailGroup, pal, pal.warmGold, tx - 0.5, 0.94, tz, 0.44, 0.06, 0.44);
    addBoxMesh(detailGroup, pal, pal.amberAwning, tx + 0.5, 0.95, tz, 0.42, 0.09, 0.42);
    pushCollider(ctx.colliders, ox + tx, 0, oz + tz, 2.2, 0.95, 2.2);
  });

  // Glowing Circular Pendant Chandeliers inside Lobby & Banquet Hall
  [-6.5, 8.2].forEach((cx) => {
    addBoxMesh(detailGroup, pal, pal.warmChandelier, cx, 4.05, 0, 3.4, 0.14, 3.4);
    addBoxMesh(detailGroup, pal, pal.charcoalSteel, cx, 4.35, 0, 0.25, 0.5, 0.25);
  });

  // FLOOR 2 SLAB (y = 4.6) with stairwell cutout at x in [-12.6, -7.8], z in [3.2, 9.2]
  // East large section x in [-7.8, 14], z in [-10, 10]
  addBoxMesh(g, pal, pal.whiteMarble, 3.1, F1H - 0.18, 0, 21.8, 0.36, D);
  ctx.ramps.push({
    minX: ox - 7.8,
    maxX: ox + 14.0,
    minZ: oz - 10,
    maxZ: oz + 10,
    axis: 'x',
    startCoord: ox - 7.8,
    endCoord: ox + 14.0,
    startY: F1H,
    endY: F1H,
  });
  // North-West floor 2 slab x in [-14, -7.8], z in [-10, 3.2]
  addBoxMesh(g, pal, pal.whiteMarble, -10.9, F1H - 0.18, -3.4, 6.2, 0.36, 13.2);
  ctx.ramps.push({
    minX: ox - 14.0,
    maxX: ox - 7.8,
    minZ: oz - 10,
    maxZ: oz + 3.2,
    axis: 'x',
    startCoord: ox - 14.0,
    endCoord: ox - 7.8,
    startY: F1H,
    endY: F1H,
  });
  // Ground ceiling colliders over non-stairwell portion (East bay + NW bay) so jumping underneath hits ceiling cleanly
  pushCollider(ctx.colliders, ox + 3.1, F1H - 0.36, oz, 21.8, 0.36, D);
  pushCollider(ctx.colliders, ox - 10.9, F1H - 0.36, oz - 3.4, 6.2, 0.36, 13.2);

  // STAIRCASE 1->2 inside West-South bay: climbs North along Z from z=9.2 (y=0) -> z=3.2 (y=4.6)
  buildArchitecturalStaircase(g, ctx, pal, {
    ox,
    oz,
    stairX: -10.5,
    zStart: 9.2,
    zEnd: 3.2,
    yBottom: 0,
    yTop: F1H,
    width: 3.2,
    stepCount: 14,
    railSides: 'both',
  });
  // Stairwell safety glass rail along East cutout edge on Floor 2 (x = -7.8, z in [3.2..9.6])
  registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.glassClear, -7.8, F1H + 0.55, 6.4, 0.08, 1.05, 6.4));
  addBoxMesh(g, pal, pal.charcoalSteel, -7.8, F1H + 1.08, 6.4, 0.1, 0.07, 6.4);
  pushCollider(ctx.colliders, ox - 7.8, F1H, oz + 6.4, 0.14, 1.1, 6.4);

  // FLOOR 2 EXTERIOR CURTAIN WALLS & SUITES
  [-14, 14].forEach((wx) => {
    addBoxMesh(g, pal, pal.whiteMarble, wx, F1H + 0.65, 0, 0.5, 1.3, D);
    registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.windowDayNight, wx, F1H + 2.4, 0, 0.35, 2.2, D - 1.6));
    addBoxMesh(g, pal, pal.whiteMarble, wx, F1H + 3.85, 0, 0.5, 0.7, D);
    pushCollider(ctx.colliders, ox + wx, F1H, oz, 0.65, F2H, D);
  });
  [-10, 10].forEach((wz) => {
    addBoxMesh(g, pal, pal.whiteMarble, 0, F1H + 0.65, wz, W, 1.3, 0.5);
    registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.windowDayNight, 0, F1H + 2.4, wz, W - 2.4, 2.2, 0.35));
    addBoxMesh(g, pal, pal.whiteMarble, 0, F1H + 3.85, wz, W, 0.7, 0.5);
    pushCollider(ctx.colliders, ox, F1H, oz + wz, W, F2H, 0.65);
  });

  // Luxury Suite Beds, Rotating Ceiling Fan & Wall TV on Floor 2
  const ceilingFan = new THREE.Group();
  ceilingFan.position.set(3.5, F1H + 3.7, -4.8);
  for (let b = 0; b < 3; b++) {
    const blade = new THREE.Mesh(pal.boxGeo, pal.terracottaWood);
    blade.rotation.y = (b * Math.PI * 2) / 3;
    blade.position.set(Math.sin((b * Math.PI * 2) / 3) * 0.85, 0, Math.cos((b * Math.PI * 2) / 3) * 0.85);
    blade.scale.set(0.22, 0.04, 1.6);
    ceilingFan.add(blade);
  }
  detailGroup.add(ceilingFan);
  ctx.updaters.push((dt) => {
    ceilingFan.rotation.y += dt * 4.5;
  });

  [
    [3.5, -5.2],
    [10.2, 4.5],
  ].forEach(([bx, bz]) => {
    addBoxMesh(detailGroup, pal, pal.terracottaWood, bx, F1H + 0.28, bz, 3.2, 0.5, 2.4);
    addBoxMesh(detailGroup, pal, pal.whiteMarble, bx, F1H + 0.6, bz, 2.9, 0.25, 2.1);
    addBoxMesh(detailGroup, pal, pal.amberAwning, bx - 0.9, F1H + 0.78, bz, 0.7, 0.18, 1.6);
    // Flatscreen TV stand facing bed
    addBoxMesh(detailGroup, pal, pal.charcoalSteel, bx + 2.4, F1H + 1.55, bz, 0.1, 1.1, 1.9);
    pushCollider(ctx.colliders, ox + bx, F1H, oz + bz, 3.2, 0.9, 2.4);
  });

  // FLOOR 3 ROOFTOP TERRACE (y = 8.8) — completely sealed Floor-2 ceiling slabs around 2->3 stairwell cutout (x in [9..14], z in [-7.6..-1.0])!
  const ROOF_Y = F1H + F2H; // 8.8m
  addBoxMesh(g, pal, pal.creamStone, -2.5, ROOF_Y - 0.18, 0, 23, 0.36, D);
  // East Floor-3 sections North & South of stairwell cutout so Floor 2 has zero sky gaps!
  addBoxMesh(g, pal, pal.creamStone, 11.5, ROOF_Y - 0.18, -8.8, 5.0, 0.36, 2.4);
  addBoxMesh(g, pal, pal.creamStone, 11.5, ROOF_Y - 0.18, 4.5, 5.0, 0.36, 11.0);
  pushCollider(ctx.colliders, ox - 2.5, ROOF_Y - 0.36, oz, 23, 0.36, D);
  pushCollider(ctx.colliders, ox + 11.5, ROOF_Y - 0.36, oz - 8.8, 5.0, 0.36, 2.4);
  pushCollider(ctx.colliders, ox + 11.5, ROOF_Y - 0.36, oz + 4.5, 5.0, 0.36, 11.0);
  ctx.ramps.push(
    {
      minX: ox - 14.0,
      maxX: ox + 9.0,
      minZ: oz - 10,
      maxZ: oz + 10,
      axis: 'x',
      startCoord: ox - 14.0,
      endCoord: ox + 9.0,
      startY: ROOF_Y,
      endY: ROOF_Y,
    },
    {
      minX: ox + 9.0,
      maxX: ox + 14.0,
      minZ: oz - 10.0,
      maxZ: oz - 7.6,
      axis: 'x',
      startCoord: ox + 9.0,
      endCoord: ox + 14.0,
      startY: ROOF_Y,
      endY: ROOF_Y,
    },
    {
      minX: ox + 9.0,
      maxX: ox + 14.0,
      minZ: oz - 1.0,
      maxZ: oz + 10.0,
      axis: 'x',
      startCoord: ox + 9.0,
      endCoord: ox + 14.0,
      startY: ROOF_Y,
      endY: ROOF_Y,
    },
  );
  // Staircase 2->3 along East bay z in [-7.6, -1.0]
  buildArchitecturalStaircase(g, ctx, pal, {
    ox,
    oz,
    stairX: 11.2,
    zStart: -7.6,
    zEnd: -1.0,
    yBottom: F1H,
    yTop: ROOF_Y,
    width: 3.1,
    stepCount: 13,
    railSides: 'left',
  });
  // Rooftop stairwell safety glass rail at x = 9.0, z in [-7.8..-1.0]
  registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.glassClear, 9.0, ROOF_Y + 0.55, -4.4, 0.08, 1.05, 6.8));
  addBoxMesh(g, pal, pal.charcoalSteel, 9.0, ROOF_Y + 1.08, -4.4, 0.1, 0.07, 6.8);
  pushCollider(ctx.colliders, ox + 9.0, ROOF_Y, oz - 4.4, 0.14, 1.1, 6.8);

  // Rooftop glass parapet walls + 3rd Floor Architectural Canopy Ceiling & Skylight Pergola + Twin Sail Towers!
  registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.glassClear, 0, ROOF_Y + 0.6, -9.8, W, 1.2, 0.25));
  registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.glassClear, 0, ROOF_Y + 0.6, 9.8, W, 1.2, 0.25));
  pushCollider(ctx.colliders, ox, ROOF_Y, oz - 9.8, W, 1.2, 0.35);
  pushCollider(ctx.colliders, ox, ROOF_Y, oz + 9.8, W, 1.2, 0.35);
  // 3rd Floor Sealed Sky Lounge Canopy Roof (y = ROOF_Y + 3.9m) supported by corner gold columns
  [-12.8, 0, 12.8].forEach((px) => {
    [-8.8, 8.8].forEach((pz) => {
      addBoxMesh(g, pal, pal.warmGold, px, ROOF_Y + 1.95, pz, 0.42, 3.9, 0.42);
    });
  });
  addBoxMesh(g, pal, pal.creamStone, 0, ROOF_Y + 3.95, -5.2, W - 0.6, 0.34, 9.6);
  registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.glassClear, 0, ROOF_Y + 3.95, 2.2, W - 1.2, 0.18, 5.4));
  addBoxMesh(g, pal, pal.warmChandelier, 0, ROOF_Y + 3.72, -5.2, 6.4, 0.12, 2.2);
  pushCollider(ctx.colliders, ox, ROOF_Y + 3.8, oz - 1.6, W, 0.4, 16.5);
  // Twin curved architectural rooftop sail towers seated above canopy
  [-5.5, 5.5].forEach((tx) => {
    addBoxMesh(g, pal, pal.whiteMarble, tx, ROOF_Y + 7.2, 2.5, 5.2, 6.4, 4.8);
    registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.windowDayNight, tx, ROOF_Y + 7.2, 0.05, 4.4, 5.6, 0.3));
    addBoxMesh(g, pal, pal.cyanNeon, tx, ROOF_Y + 10.6, 2.5, 5.4, 0.28, 5.0);
  });

  // Waterfront South Infinity Pool Deck
  addBoxMesh(g, pal, pal.whiteMarble, 0, 0.06, 18.5, 26, 0.14, 15);
  addBoxMesh(g, pal, pal.poolWater, 0, 0.15, 19.2, 16, 0.12, 8.5);
  [-9.8, 9.8].forEach((lx) => {
    addBoxMesh(detailGroup, pal, pal.tealAwning, lx, 0.35, 18.5, 1.4, 0.45, 2.6);
    addBoxMesh(detailGroup, pal, pal.whiteMarble, lx, 1.6, 20.4, 0.14, 2.6, 0.14);
    addBoxMesh(detailGroup, pal, pal.amberAwning, lx, 2.85, 20.4, 2.8, 0.22, 2.8);
  });

  // Hotel concierge welcome desk interaction
  ctx.interactables.push({
    id: 'hotel_concierge',
    x: ox - 7.2,
    y: 0,
    z: oz - 4.4,
    radius: 3.4,
    category: 'dine',
    getLabel: () => 'Hotel Concierge · Refresh (+35 HP)',
    trigger: (act) => {
      act.healPlayer(35, 100);
      return 'Checked in at Grand Waterfront Hotel (+35 HP, Full Stamina)';
    },
  });
}

/**
 * 2. ENTERABLE OFFICE / APARTMENT BUILDING (Ground Lobby, Staircase, Furnished Floor 2, Rooftop Terrace)
 */
export function placeEnterableOfficeBuilding(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  opts: { x: number; z: number; title?: string; doorId?: string },
) {
  const { x: ox, z: oz } = opts;
  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  ctx.arenaGroup.add(g);

  const W = 18;
  const D = 14;
  const FH = 4.2;

  addBoxMesh(g, pal, pal.concreteDeck, 0, 0.06, 0, W + 2, 0.12, D + 2);
  // North entrance facade with center doorway x in [-1.8, 1.8]
  addBoxMesh(g, pal, pal.charcoalSteel, -5.4, FH * 0.5, -7, 7.2, FH, 0.45);
  addBoxMesh(g, pal, pal.charcoalSteel, 5.4, FH * 0.5, -7, 7.2, FH, 0.45);
  addBoxMesh(g, pal, pal.charcoalSteel, 0, FH - 0.45, -7, 3.8, 0.9, 0.5);
  pushCollider(ctx.colliders, ox - 5.4, 0, oz - 7, 7.2, FH, 0.6);
  pushCollider(ctx.colliders, ox + 5.4, 0, oz - 7, 7.2, FH, 0.6);

  registerOpenableDoor(ctx, pal, {
    id: opts.doorId ?? `office_door_${Math.round(ox)}_${Math.round(oz)}`,
    label: opts.title ?? 'Office Tower Door',
    worldX: ox,
    baseY: 0,
    worldZ: oz - 7,
    width: 3.3,
    height: 3.2,
    axis: 'x',
  });

  // Side & back ground walls with glowing breakable windows
  [-9, 9].forEach((wx) => {
    addBoxMesh(g, pal, pal.whiteMarble, wx, 0.65, 0, 0.45, 1.3, D);
    registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.windowDayNight, wx, 2.35, 0, 0.3, 2.1, D - 2));
    addBoxMesh(g, pal, pal.whiteMarble, wx, 3.8, 0, 0.45, 0.8, D);
    pushCollider(ctx.colliders, ox + wx, 0, oz, 0.6, FH, D);
  });
  addBoxMesh(g, pal, pal.whiteMarble, 0, FH * 0.5, 7, W, FH, 0.45);
  pushCollider(ctx.colliders, ox, 0, oz + 7, W, FH, 0.6);

  // Floor 2 Slab (x in [-4.8, 9.0]) leaving stairwell on West x in [-8.6, -4.8]
  addBoxMesh(g, pal, pal.creamStone, 2.1, FH - 0.15, 0, 13.8, 0.3, D);
  ctx.ramps.push({
    minX: ox - 4.8,
    maxX: ox + 9.0,
    minZ: oz - 7,
    maxZ: oz + 7,
    axis: 'x',
    startCoord: ox - 4.8,
    endCoord: ox + 9.0,
    startY: FH,
    endY: FH,
  });
  pushCollider(ctx.colliders, ox + 2.1, FH - 0.3, oz, 13.8, 0.3, D);

  // Stairs 1 -> 2 on West side (climb South->North)
  buildArchitecturalStaircase(g, ctx, pal, {
    ox,
    oz,
    stairX: -6.7,
    zStart: 5.6,
    zEnd: -1.6,
    yBottom: 0,
    yTop: FH,
    width: 3.2,
    stepCount: 12,
    railSides: 'right',
  });
  registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.glassClear, -4.8, FH + 0.55, 2.0, 0.08, 1.05, 7.2));
  addBoxMesh(g, pal, pal.charcoalSteel, -4.8, FH + 1.08, 2.0, 0.1, 0.07, 7.2);
  pushCollider(ctx.colliders, ox - 4.8, FH, oz + 2.0, 0.14, 1.1, 7.2);

  // Floor 2 glass facade & office desks
  [-9, 9].forEach((wx) => {
    registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.windowDayNight, wx, FH + 2.1, 0, 0.32, 3.2, D - 1));
    pushCollider(ctx.colliders, ox + wx, FH, oz, 0.55, FH, D);
  });
  [-7, 7].forEach((wz) => {
    registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.windowDayNight, 0, FH + 2.1, wz, W - 1, 3.2, 0.32));
    pushCollider(ctx.colliders, ox, FH, oz + wz, W, FH, 0.55);
  });

  // Office desks & computer monitors
  [0.5, 5.2].forEach((dx) => {
    addBoxMesh(g, pal, pal.terracottaWood, dx, FH + 0.42, -2.5, 2.6, 0.84, 1.2);
    addBoxMesh(g, pal, pal.cyanNeon, dx, FH + 1.12, -2.8, 0.9, 0.52, 0.08);
    pushCollider(ctx.colliders, ox + dx, FH, oz - 2.5, 2.6, 1.2, 1.2);
  });

  // Rooftop Deck at y = 8.4 with stairs 2->3 on East side
  const RY = FH * 2;
  addBoxMesh(g, pal, pal.concreteDeck, -1.8, RY - 0.15, 0, 14.4, 0.3, D);
  ctx.ramps.push({
    minX: ox - 9.0,
    maxX: ox + 5.4,
    minZ: oz - 7,
    maxZ: oz + 7,
    axis: 'x',
    startCoord: ox - 9.0,
    endCoord: ox + 5.4,
    startY: RY,
    endY: RY,
  });
  // Stairs 2 -> 3 on East side (climb South->North)
  buildArchitecturalStaircase(g, ctx, pal, {
    ox,
    oz,
    stairX: 7.1,
    zStart: 5.6,
    zEnd: -1.6,
    yBottom: FH,
    yTop: RY,
    width: 3.0,
    stepCount: 12,
    railSides: 'left',
  });
  registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.glassClear, 5.4, RY + 0.55, 2.0, 0.08, 1.05, 7.2));
  addBoxMesh(g, pal, pal.charcoalSteel, 5.4, RY + 1.08, 2.0, 0.1, 0.07, 7.2);
  pushCollider(ctx.colliders, ox + 5.4, RY, oz + 2.0, 0.14, 1.1, 7.2);

  // Rooftop parapet & Neon Penthouse Sign
  registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.glassClear, 0, RY + 0.55, -6.8, W, 1.1, 0.25));
  registerBreakableGlass(ctx, addBoxMesh(g, pal, pal.glassClear, 0, RY + 0.55, 6.8, W, 1.1, 0.25));
  pushCollider(ctx.colliders, ox, RY, oz - 6.8, W, 1.1, 0.35);
  pushCollider(ctx.colliders, ox, RY, oz + 6.8, W, 1.1, 0.35);
  const topSign = ctx.displays.createDisplayMaterial('city_billboard', {
    title: opts.title ?? 'APEX CORPORATE',
    subtitle: 'OFFICES · APARTMENTS · SKYDECK',
    accentHex: '#38bdf8',
  }).material;
  const signMesh = new THREE.Mesh(pal.boxGeo, topSign);
  signMesh.position.set(0, RY + 2.4, -6.9);
  signMesh.scale.set(9.5, 2.2, 0.25);
  g.add(signMesh);
  [-3.8, 3.8].forEach((sx) => {
    addBoxMesh(g, pal, pal.charcoalSteel, sx, RY + 1.1, -6.9, 0.26, 2.2, 0.26);
  });
}

/**
 * 3. ELEVATED HIGHWAY OVERPASS WITH GROUND UNDERPASS
 * Ground road passes underneath at y=0 cleanly while drivers/walkers climbing West/East ramps cross at y=5.4!
 */
export function placeHighwayOverpassWithUnderpass(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  opts: { x: number; z: number; spanW?: number; rampLen?: number; deckW?: number },
) {
  const { x: ox, z: oz } = opts;
  const deckLen = opts.spanW ?? 34;
  const rampLen = opts.rampLen ?? 20;
  const deckW = opts.deckW ?? 11.5;
  const H = 5.4;

  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  ctx.arenaGroup.add(g);

  // Elevated Asphalt & Concrete Overpass Deck
  addBoxMesh(g, pal, pal.concreteDeck, 0, H - 0.35, 0, deckLen, 0.7, deckW);
  addBoxMesh(g, pal, pal.slateAsphalt, 0, H - 0.02, 0, deckLen, 0.06, deckW - 1.2);
  // Dashed center line
  for (let lx = -deckLen * 0.42; lx <= deckLen * 0.42; lx += 4.2) {
    addBoxMesh(g, pal, pal.warmChandelier, lx, H + 0.02, 0, 2.2, 0.02, 0.24);
  }
  // Overpass concrete guardrails (North & South edges)
  [-deckW * 0.5 + 0.35, deckW * 0.5 - 0.35].forEach((rz) => {
    addBoxMesh(g, pal, pal.concreteDeck, 0, H + 0.55, rz, deckLen, 1.1, 0.5);
    pushCollider(ctx.colliders, ox, H, oz + rz, deckLen, 1.1, 0.6);
  });

  // Twin concrete support piers flanking the open Ground Underpass road (wide clear 16m underpass!)
  [-deckLen * 0.38, deckLen * 0.38].forEach((px) => {
    [-deckW * 0.34, deckW * 0.34].forEach((pz) => {
      addBoxMesh(g, pal, pal.concreteDeck, px, (H - 0.7) * 0.5, pz, 1.6, H - 0.7, 1.6);
      pushCollider(ctx.colliders, ox + px, 0, oz + pz, 1.7, H, 1.7);
    });
  });

  // Walkable/Drivable Elevated Deck RampSurface (ground traffic at y=0 ignores it because H=5.4 > 0 + 1.15!)
  ctx.ramps.push({
    minX: ox - deckLen * 0.5,
    maxX: ox + deckLen * 0.5,
    minZ: oz - deckW * 0.46,
    maxZ: oz + deckW * 0.46,
    axis: 'x',
    startCoord: ox - deckLen * 0.5,
    endCoord: ox + deckLen * 0.5,
    startY: H,
    endY: H,
  });

  // West & East Sloped Concrete Approach Ramps (smoothly stepped mesh + continuous RampSurface)
  const slopeAng = Math.atan2(H, rampLen);
  const hypLen = Math.hypot(rampLen, H);
  [-1, 1].forEach((dir) => {
    const midX = dir * (deckLen * 0.5 + rampLen * 0.5);
    const rampMesh = addBoxMesh(g, pal, pal.slateAsphalt, midX, H * 0.5 - 0.25, 0, hypLen, 0.5, deckW - 0.6, {
      rotZ: dir > 0 ? -slopeAng : slopeAng,
    });
    rampMesh.receiveShadow = true;

    const rStartX = ox + dir * (deckLen * 0.5 + rampLen);
    const rEndX = ox + dir * (deckLen * 0.5);
    ctx.ramps.push({
      minX: Math.min(rStartX, rEndX),
      maxX: Math.max(rStartX, rEndX),
      minZ: oz - deckW * 0.46,
      maxZ: oz + deckW * 0.46,
      axis: 'x',
      startCoord: rStartX,
      endCoord: rEndX,
      startY: 0,
      endY: H,
    });
  });

  // Overhead highway streetlights along bridge span
  [-deckLen * 0.3, 0, deckLen * 0.3].forEach((lx) => {
    addBoxMesh(g, pal, pal.charcoalSteel, lx, H + 2.6, -deckW * 0.46, 0.22, 4.6, 0.22);
    addBoxMesh(g, pal, pal.lampGlow, lx, H + 4.8, -deckW * 0.32, 0.5, 0.16, 1.4);
  });
}

/**
 * 4. ILLUMINATED UNDERGROUND HILLSIDE TUNNEL (Ground level drive-through + grassy hilltop overlook above!)
 */
export function placeUndergroundTunnel(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  opts: { x: number; z: number; length?: number; width?: number },
) {
  const { x: ox, z: oz } = opts;
  const len = opts.length ?? 36;
  const clearW = opts.width ?? 11;
  const clearH = 5.0;

  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  ctx.arenaGroup.add(g);

  // Tunnel asphalt floor
  addBoxMesh(g, pal, pal.slateAsphalt, 0, 0.03, 0, clearW + 1, 0.06, len + 8);

  // Thick concrete tunnel side walls (leaving clearW inside!)
  [-1, 1].forEach((side) => {
    const wx = side * (clearW * 0.5 + 1.1);
    addBoxMesh(g, pal, pal.concreteDeck, wx, clearH * 0.5, 0, 2.2, clearH + 1.2, len);
    pushCollider(ctx.colliders, ox + wx, 0, oz, 2.2, clearH + 1.2, len);
    // Green sloped earth embankments outside tunnel walls
    addBoxMesh(g, pal, pal.greenTurf, side * (clearW * 0.5 + 4.8), clearH * 0.45, 0, 5.4, clearH + 0.6, len - 2, {
      rotZ: side * 0.32,
    });
  });

  // Tunnel ceiling slab + grassy park hill rooftop
  addBoxMesh(g, pal, pal.concreteDeck, 0, clearH + 0.45, 0, clearW + 4.6, 0.9, len);
  addBoxMesh(g, pal, pal.greenTurf, 0, clearH + 1.05, 0, clearW + 7.2, 0.35, len - 1);
  // Ceiling collider ONLY above clearH so cars & bikes drive straight through at y=0!
  pushCollider(ctx.colliders, ox, clearH, oz, clearW + 4.4, 1.3, len);

  // Glowing LED ceiling light strips along the tunnel interior
  for (let lz = -len * 0.42; lz <= len * 0.42; lz += 6.0) {
    addBoxMesh(g, pal, pal.lampGlow, 0, clearH - 0.06, lz, 3.8, 0.1, 0.45);
    addBoxMesh(g, pal, pal.amberAwning, -clearW * 0.5 + 0.12, 1.4, lz, 0.12, 0.25, 2.4);
    addBoxMesh(g, pal, pal.amberAwning, clearW * 0.5 - 0.12, 1.4, lz, 0.12, 0.25, 2.4);
  }

  // North & South Arch Portal Headers
  [-len * 0.5, len * 0.5].forEach((pz) => {
    addBoxMesh(g, pal, pal.charcoalSteel, 0, clearH + 0.35, pz, clearW + 4.8, 1.25, 0.8);
    addBoxMesh(g, pal, pal.amberAwning, 0, clearH - 0.22, pz, clearW + 0.8, 0.24, 0.9);
  });
}

export function placeModernGasStation(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  opts: { x: number; z: number; idPrefix?: string; accentHex?: number },
): { fuelBays: Array<{ x: number; z: number; yaw: number }> } {
  const px = opts.x;
  const pz = opts.z;
  const accent = opts.accentHex ?? 0x2563eb;
  const petrol = new THREE.Group();
  petrol.position.set(px, 0, pz);
  ctx.arenaGroup.add(petrol);

  // Realistic Modern Gas & EV Supercharger Complex ("Super Save Gas" + Convenience Store)
  const pb = new PropMeshAssembler();
  // Clean concrete forecourt pad with drive-through apron & yellow bay stripes
  pb.addBox(0, 0.04, 0, 26, 0.08, 22, 0x263143, 'solid');
  pb.addBox(0, 0.082, -1.6, 17, 0.02, 7.6, 0x3b475a, 'solid');
  [-10.4, 10.4].forEach((sz) => {
    pb.addBox(0, 0.085, sz, 24.5, 0.02, 0.35, 0xfacc15, 'solid');
  });

  // Sleek beveled architectural canopy with royal-blue/red/white fascia + recessed soffit lighting
  const canopyShape = new THREE.Shape();
  canopyShape.moveTo(-10.1, -0.45);
  canopyShape.lineTo(10.1, -0.45);
  canopyShape.lineTo(10.3, 0.45);
  canopyShape.lineTo(-10.3, 0.45);
  canopyShape.closePath();
  pb.addExtrude(canopyShape, 11.4, 0.08, 0, 5.48, -1.6, accent, 'glossy');
  pb.addBox(0, 5.26, -1.6, 20.5, 0.22, 11.8, 0xef4444, 'glossy');
  pb.addBox(0, 5.02, -1.6, 20.1, 0.18, 11.4, 0xf8fafc, 'glossy');
  pb.addBox(0, 4.92, -1.6, 19.2, 0.12, 10.6, 0xe2e8f0, 'solid');
  [-6.2, 0, 6.2].forEach((lx) => {
    [-4.2, -1.6, 1.0].forEach((lz) => {
      pb.addBox(lx, 4.82, lz, 2.4, 0.08, 0.55, 0xfef9c3, 'emissive');
    });
  });
  pb.addBox(0, 5.15, 4.35, 20.5, 0.16, 0.14, 0xfef08a, 'emissive');
  pb.addBox(0, 5.15, -7.55, 20.5, 0.16, 0.14, 0xf97316, 'emissive');

  // 4 Cylindrical steel canopy columns with beveled yellow safety bases
  [-7.2, 7.2].forEach((cx) => {
    [-4.8, 1.6].forEach((cz) => {
      pb.addCylinder(0.42, 0.48, 0.85, 14, cx, 0.425, cz, 0xfacc15, 'glossy');
      pb.addCylinder(0.3, 0.34, 4.2, 14, cx, 2.88, cz, accent, 'glossy');
      pb.addCylinder(0.34, 0.34, 0.45, 14, cx, 4.8, cz, 0xf1f5f9, 'glossy');
      pushCollider(ctx.colliders, px + cx, 0, pz + cz, 0.72, 4.9, 0.72, 0, 'metal');
    });
  });

  // 3 Fuel & EV Supercharger Islands with shootable explosive petrol refilling machines!
  [-4.4, 0, 4.4].forEach((fx, idx) => {
    const isEv = idx === 2;
    const pumpHex = isEv ? 0x10b981 : 0x38bdf8;
    pb.addBox(fx, 0.16, -1.6, 1.45, 0.32, 4.1, 0xcbd5e1, 'solid');
    pb.addCylinder(0.72, 0.72, 0.32, 12, fx, 0.16, -3.65, 0xcbd5e1, 'solid');
    pb.addCylinder(0.72, 0.72, 0.32, 12, fx, 0.16, 0.45, 0xcbd5e1, 'solid');

    // Tubular protective U-bollards
    [-3.45, 0.25].forEach((bz) => {
      pb.addTube(
        [
          new THREE.Vector3(fx - 0.52, 0.15, bz),
          new THREE.Vector3(fx - 0.52, 1.0, bz),
          new THREE.Vector3(fx + 0.52, 1.0, bz),
          new THREE.Vector3(fx + 0.52, 0.15, bz),
        ],
        0.075,
        12,
        8,
        0xfacc15,
        'glossy',
      );
    });

    // Individual destructible & explosive Petrol Dispenser Machine
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(fx, 0, -1.6);
    petrol.add(pumpGroup);

    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.48 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.18 });
    const headMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.36, metalness: 0.25 });
    const scrMat = new THREE.MeshBasicMaterial({ color: pumpHex });
    const warnMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    ctx.materials.push(baseMat, bodyMat, headMat, scrMat, warnMat);

    const baseGeo = new THREE.BoxGeometry(0.9, 0.55, 1.06);
    const bodyGeo = new THREE.BoxGeometry(0.84, 1.15, 0.98);
    const headGeo = new THREE.BoxGeometry(0.92, 0.36, 1.12);
    const scrGeo = new THREE.BoxGeometry(0.6, 0.42, 0.06);
    const priceGeo = new THREE.BoxGeometry(0.52, 0.16, 0.06);
    ctx.geometries.push(baseGeo, bodyGeo, headGeo, scrGeo, priceGeo);

    const baseM = new THREE.Mesh(baseGeo, baseMat);
    baseM.position.set(0, 0.56, 0);
    const pumpHitMesh = new THREE.Mesh(bodyGeo, bodyMat);
    pumpHitMesh.position.set(0, 1.38, 0);
    pumpHitMesh.castShadow = !ctx.isSoftwareGl;
    pumpHitMesh.receiveShadow = true;
    const headM = new THREE.Mesh(headGeo, headMat);
    headM.position.set(0, 2.1, 0);
    const scrF = new THREE.Mesh(scrGeo, scrMat);
    scrF.position.set(0, 1.68, -0.51);
    const scrB = new THREE.Mesh(scrGeo, scrMat);
    scrB.position.set(0, 1.68, 0.51);
    const pF = new THREE.Mesh(priceGeo, warnMat);
    pF.position.set(0, 1.24, -0.51);
    const pB = new THREE.Mesh(priceGeo, warnMat);
    pB.position.set(0, 1.24, 0.51);

    pumpGroup.add(baseM, pumpHitMesh, headM, scrF, scrB, pF, pB);

    // Hoses & nozzles on pump group
    [-0.48, 0.48].forEach((hx) => {
      const hoseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx * 0.9, 1.85, 0),
        new THREE.Vector3(hx * 1.28, 1.25, 0.05),
        new THREE.Vector3(hx * 1.02, 0.78, 0),
      ]);
      const hoseGeo = new THREE.TubeGeometry(hoseCurve, 10, 0.04, 6, false);
      const hoseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78 });
      const nozGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.24, 8);
      const nozMat = new THREE.MeshStandardMaterial({ color: isEv ? 0x22c55e : 0xef4444, roughness: 0.35 });
      ctx.geometries.push(hoseGeo, nozGeo);
      ctx.materials.push(hoseMat, nozMat);
      const hoseM = new THREE.Mesh(hoseGeo, hoseMat);
      const nozM = new THREE.Mesh(nozGeo, nozMat);
      nozM.position.set(hx * 1.04, 1.68, 0);
      pumpGroup.add(hoseM, nozM);
    });

    if (ctx.barrels) {
      ctx.barrels.push({
        id: 9100 + ctx.barrels.length,
        group: pumpGroup,
        hitMesh: pumpHitMesh,
        position: new THREE.Vector3(px + fx, 0, pz - 1.6),
        exploded: false,
        health: 36,
        radius: 13.0,
        maxDamage: 245,
        isBigExplosion: true,
        kind: 'petrol_pump',
      });
    }
    ctx.shootableEnv.push(pumpHitMesh);
    pb.addCylinder(0.26, 0.26, 0.72, 10, fx, 0.68, -2.65, accent, 'glossy');
    pushCollider(ctx.colliders, px + fx, 0, pz - 1.6, 1.25, 2.2, 4.2, 0, 'metal');
  });

  // Glazed Convenience Store at rear of forecourt (z = -9.4)
  pb.addBox(0, 2.05, -11.45, 14.4, 4.1, 0.5, 0xf8fafc, 'solid');
  pb.addBox(-6.95, 2.05, -9.4, 0.5, 4.1, 4.6, 0xf8fafc, 'solid');
  pb.addBox(6.95, 2.05, -9.4, 0.5, 4.1, 4.6, 0xf8fafc, 'solid');
  pb.addBox(0, 3.65, -9.4, 14.6, 0.9, 4.8, accent, 'glossy');
  pb.addBox(0, 1.75, -7.15, 13.4, 2.9, 0.14, 0xbae6fd, 'glass');
  pb.addBox(-3.6, 1.3, -10.4, 4.2, 2.2, 0.65, 0x38bdf8, 'emissive');
  pb.addBox(3.2, 1.0, -9.6, 4.6, 1.6, 0.85, 0xf59e0b, 'solid');
  pb.addBox(0, 3.85, -7.05, 14.5, 0.26, 0.14, 0xef4444, 'emissive');
  pushCollider(ctx.colliders, px, 0, pz - 9.4, 14.5, 4.1, 4.7, 0, 'concrete');

  const pMats = createPropPbrMaterials(false);
  const built = pb.compile(pMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  petrol.add(built.group);
  ctx.geometries.push(...built.geometries);
  ctx.materials.push(...pMats.all, ...built.materials);
  ctx.shootableEnv.push(built.group);

  // Canopy front & back backlit "SUPER SAVE GAS" fascia banners
  const canopySignMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'SUPER SAVE GAS',
    subtitle: '24/7 FUEL · EV FAST CHARGE · STORE',
    accentHex: '#ef4444',
    lockTitle: true,
    width: 1152,
    height: 96,
  }).material;
  const canopyFrontSign = new THREE.Mesh(pal.boxGeo, canopySignMat);
  canopyFrontSign.position.set(0, 5.45, 4.38);
  canopyFrontSign.scale.set(11.4, 0.95, 0.1);
  petrol.add(canopyFrontSign);

  // Dual-Post Roadside Digital Fuel Price Totem Pylon
  const fuelSign = ctx.displays.createDisplayMaterial('city_billboard', {
    title: 'SUPER SAVE GAS',
    subtitle: 'REG $3.19 · PREM $3.69 · EV 350kW',
    accentHex: '#38bdf8',
  }).material;
  addBoxMesh(petrol, pal, pal.charcoalSteel, -11.9, 3.3, 6.2, 0.36, 6.6, 0.36);
  addBoxMesh(petrol, pal, pal.charcoalSteel, -9.7, 3.3, 6.2, 0.36, 6.6, 0.36);
  addBoxMesh(petrol, pal, pal.whiteMarble, -10.8, 4.6, 6.2, 2.5, 2.9, 0.48);
  const fScreen = new THREE.Mesh(pal.boxGeo, fuelSign);
  fScreen.position.set(-10.8, 4.6, 6.5);
  fScreen.scale.set(2.25, 2.6, 0.12);
  petrol.add(fScreen);
  pushCollider(ctx.colliders, px - 10.8, 0, pz + 6.2, 2.7, 6.6, 0.7);

  ctx.interactables.push({
    id: `${opts.idPrefix ?? 'petrol'}_station_refuel`,
    x: px,
    y: 0,
    z: pz - 1.6,
    radius: 8.5,
    category: 'refuel',
    getLabel: () => 'Refuel & Repair Vehicle / Cycle Bike Style',
    trigger: (act) => {
      const msg = act.refuelNearbyVehicle();
      if (msg) return msg;
      return `Cyber Bike Paint: ${act.cycleBikeStyle()}`;
    },
  });

  return {
    fuelBays: [
      { x: px - 2.2, z: pz + 2.4, yaw: Math.PI * 0.5 },
      { x: px + 2.2, z: pz + 2.4, yaw: Math.PI * 0.5 },
    ],
  };
}

/**
 * 5. CITY LOCATIONS (Petrol & EV Station, Convenience Store, Bistro Restaurant, Street Market, Parking Area)
 */
export function placeInteractiveCityLocations(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  opts?: {
    petrolPos?: { x: number; z: number };
    skipPetrol?: boolean;
    martPos?: { x: number; z: number };
    bistroPos?: { x: number; z: number };
    marketPos?: { x: number; z: number };
  },
) {
  // A) APEX PETROL & EV CHARGING STATION
  if (!opts?.skipPetrol) {
    const px = opts?.petrolPos?.x ?? -38;
    const pz = opts?.petrolPos?.z ?? 6;
    placeModernGasStation(ctx, pal, { x: px, z: pz, idPrefix: 'main' });
  }

  // B) 24/7 CONVENIENCE STORE ("APEX MART")
  const mx = opts?.martPos?.x ?? -64;
  const mz = opts?.martPos?.z ?? -14;
  const mart = new THREE.Group();
  mart.position.set(mx, 0, mz);
  ctx.arenaGroup.add(mart);

  addBoxMesh(mart, pal, pal.concreteDeck, 0, 0.05, 0, 14, 0.1, 11);
  addBoxMesh(mart, pal, pal.whiteMarble, 0, 4.1, 0, 13.6, 0.5, 10.6);
  addBoxMesh(mart, pal, pal.tealAwning, 0, 4.55, 0, 13.8, 0.55, 10.8);
  // Openable / Open East entrance facing boulevard
  addBoxMesh(mart, pal, pal.whiteMarble, -6.5, 2.0, 0, 0.45, 4.0, 10.4);
  addBoxMesh(mart, pal, pal.whiteMarble, 0, 2.0, -5.0, 13.2, 4.0, 0.45);
  addBoxMesh(mart, pal, pal.whiteMarble, 0, 2.0, 5.0, 13.2, 4.0, 0.45);
  pushCollider(ctx.colliders, mx - 6.5, 0, mz, 0.55, 4.0, 10.4);
  pushCollider(ctx.colliders, mx, 0, mz - 5.0, 13.2, 4.0, 0.55);
  pushCollider(ctx.colliders, mx, 0, mz + 5.0, 13.2, 4.0, 0.55);
  // Front East breakable glass walls leaving center gap
  registerBreakableGlass(ctx, addBoxMesh(mart, pal, pal.glassClear, 6.5, 2.0, -3.4, 0.3, 3.8, 3.2));
  registerBreakableGlass(ctx, addBoxMesh(mart, pal, pal.glassClear, 6.5, 2.0, 3.4, 0.3, 3.8, 3.2));
  pushCollider(ctx.colliders, mx + 6.5, 0, mz - 3.4, 0.4, 3.8, 3.2);
  pushCollider(ctx.colliders, mx + 6.5, 0, mz + 3.4, 0.4, 3.8, 3.2);
  // Shelves & glowing drink cooler inside
  addBoxMesh(mart, pal, pal.cyanNeon, -5.4, 1.7, -2.2, 0.65, 2.6, 3.8);
  addBoxMesh(mart, pal, pal.amberAwning, -1.2, 1.05, 0, 1.1, 1.8, 5.2);
  addBoxMesh(mart, pal, pal.charcoalSteel, 2.6, 0.6, -2.5, 1.2, 1.1, 3.2);
  pushCollider(ctx.colliders, mx - 1.2, 0, mz, 1.1, 1.8, 5.2);
  const martMat = ctx.displays.createDisplayMaterial('city_billboard', {
    title: '24/7 APEX MART',
    subtitle: 'SNACKS · DRINKS · MEDKITS',
    accentHex: '#34d399',
  }).material;
  const martSign = new THREE.Mesh(pal.boxGeo, martMat);
  martSign.position.set(6.85, 4.2, 0);
  martSign.rotation.y = Math.PI * 0.5;
  martSign.scale.set(8.2, 1.3, 0.16);
  mart.add(martSign);

  ctx.interactables.push({
    id: 'mart_buy_snack',
    x: mx + 2.2,
    y: 0,
    z: mz,
    radius: 4.2,
    category: 'shop',
    getLabel: () => 'Buy Energy Snack (+25 HP & Stamina)',
    trigger: (act) => {
      act.healPlayer(25, 100);
      return 'Purchased Apex Energy Snack (+25 HP & Full Stamina)';
    },
  });

  // C) BISTRO RESTAURANT & OUTDOOR STREET MARKET
  const bx = opts?.bistroPos?.x ?? -64;
  const bz = opts?.bistroPos?.z ?? 14;
  const bistro = new THREE.Group();
  bistro.position.set(bx, 0, bz);
  ctx.arenaGroup.add(bistro);

  addBoxMesh(bistro, pal, pal.creamStone, 0, 2.1, 0, 13, 4.2, 10);
  addBoxMesh(bistro, pal, pal.redAwning, 7.6, 2.85, 0, 3.6, 0.25, 9.6, { rotZ: -0.22 });
  pushCollider(ctx.colliders, bx, 0, bz, 13.1, 4.2, 10.1);
  // Outdoor Bistro tables & umbrellas
  [-2.6, 2.6].forEach((tz) => {
    addBoxMesh(bistro, pal, pal.whiteMarble, 8.2, 0.78, tz, 1.6, 0.1, 1.6);
    addBoxMesh(bistro, pal, pal.charcoalSteel, 8.2, 0.4, tz, 0.2, 0.78, 0.2);
    addBoxMesh(bistro, pal, pal.amberAwning, 8.2, 2.4, tz, 2.4, 0.2, 2.4);
  });

  ctx.interactables.push({
    id: 'bistro_dine',
    x: bx + 8.2,
    y: 0,
    z: bz,
    radius: 4.6,
    category: 'dine',
    getLabel: () => 'Dine at Le Jardin Bistro (+45 HP)',
    trigger: (act) => {
      act.healPlayer(45, 100);
      return 'Enjoyed hot espresso & meal at Le Jardin Bistro (+45 HP)';
    },
  });

  // D) OPEN-AIR STREET MARKET STALLS
  const marketColors = [pal.redAwning, pal.tealAwning, pal.amberAwning];
  const mktBaseX = opts?.marketPos?.x ?? -48;
  const mktBaseZ = opts?.marketPos?.z ?? -22;
  for (let i = 0; i < 3; i++) {
    const sx = mktBaseX + i * 7.2;
    const sz = mktBaseZ;
    addBoxMesh(ctx.arenaGroup, pal, pal.terracottaWood, sx, 0.55, sz, 4.4, 1.1, 2.4);
    addBoxMesh(ctx.arenaGroup, pal, marketColors[i], sx, 2.6, sz, 4.8, 0.25, 3.0);
    addBoxMesh(ctx.arenaGroup, pal, pal.charcoalSteel, sx - 2.1, 1.3, sz - 1.1, 0.14, 2.6, 0.14);
    addBoxMesh(ctx.arenaGroup, pal, pal.charcoalSteel, sx + 2.1, 1.3, sz - 1.1, 0.14, 2.6, 0.14);
    pushCollider(ctx.colliders, sx, 0, sz, 4.5, 1.2, 2.5);
  }
}

/**
 * 6. ARCH CANAL BRIDGE & SMALL PEDESTRIAN BRIDGE
 */
export function placeCanalRoadBridge(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
  opts: { x: number; z: number; spanLen?: number; width?: number; deckY?: number },
) {
  const { x: ox, z: oz } = opts;
  const spanLen = opts.spanLen ?? 28;
  const width = opts.width ?? 10.5;
  const deckY = opts.deckY ?? 2.2;

  const g = new THREE.Group();
  g.position.set(ox, 0, oz);
  ctx.arenaGroup.add(g);

  // Main flat span
  const flatLen = spanLen * 0.56;
  addBoxMesh(g, pal, pal.concreteDeck, 0, deckY - 0.35, 0, flatLen, 0.7, width);
  addBoxMesh(g, pal, pal.slateAsphalt, 0, deckY - 0.02, 0, flatLen, 0.06, width - 1.1);
  // Steel red-orange side arches
  [-width * 0.48, width * 0.48].forEach((rz) => {
    addBoxMesh(g, pal, pal.redAwning, 0, deckY + 3.2, rz, flatLen * 0.65, 0.55, 0.45);
    addBoxMesh(g, pal, pal.redAwning, -flatLen * 0.35, deckY + 1.6, rz, 0.5, 3.2, 0.45, { rotZ: 0.45 });
    addBoxMesh(g, pal, pal.redAwning, flatLen * 0.35, deckY + 1.6, rz, 0.5, 3.2, 0.45, { rotZ: -0.45 });
    addBoxMesh(g, pal, pal.charcoalSteel, 0, deckY + 0.5, rz, spanLen, 1.0, 0.35);
    pushCollider(ctx.colliders, ox, deckY, oz + rz, flatLen, 1.0, 0.45);
  });
  ctx.ramps.push({
    minX: ox - flatLen * 0.5,
    maxX: ox + flatLen * 0.5,
    minZ: oz - width * 0.45,
    maxZ: oz + width * 0.45,
    axis: 'x',
    startCoord: ox - flatLen * 0.5,
    endCoord: ox + flatLen * 0.5,
    startY: deckY,
    endY: deckY,
  });

  // Approach ramps East & West
  const rampLen = (spanLen - flatLen) * 0.5;
  const slope = Math.atan2(deckY, rampLen);
  const hyp = Math.hypot(rampLen, deckY);
  [-1, 1].forEach((dir) => {
    addBoxMesh(g, pal, pal.slateAsphalt, dir * (flatLen * 0.5 + rampLen * 0.5), deckY * 0.5 - 0.25, 0, hyp, 0.5, width - 0.6, {
      rotZ: dir > 0 ? -slope : slope,
    });
    const sx = ox + dir * (flatLen * 0.5 + rampLen);
    const ex = ox + dir * (flatLen * 0.5);
    ctx.ramps.push({
      minX: Math.min(sx, ex),
      maxX: Math.max(sx, ex),
      minZ: oz - width * 0.45,
      maxZ: oz + width * 0.45,
      axis: 'x',
      startCoord: sx,
      endCoord: ex,
      startY: 0,
      endY: deckY,
    });
  });
}
