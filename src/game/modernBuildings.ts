import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';
import type {
  BreakableGlassPane,
  ColliderBox,
  CoverNode,
  DoorwayTrigger,
  RampSurface,
  SurfaceType,
} from './arena';

export interface ModernBuildingPalette {
  stuccoWhite: THREE.MeshStandardMaterial;
  creamStone: THREE.MeshStandardMaterial;
  slateFrame: THREE.MeshStandardMaterial;
  darkCharcoal: THREE.MeshStandardMaterial;
  timberWarm: THREE.MeshStandardMaterial;
  glassPanel: THREE.MeshStandardMaterial;
  interiorFloor: THREE.MeshStandardMaterial;
  stairTread: THREE.MeshStandardMaterial;
  rugMat: THREE.MeshStandardMaterial;
  sofaMat: THREE.MeshStandardMaterial;
  planterLeaf: THREE.MeshStandardMaterial;
  ledWarm: THREE.MeshBasicMaterial;
  ledOrange: THREE.MeshBasicMaterial;
  ledCyan: THREE.MeshBasicMaterial;
  sharedBoxGeo: THREE.BoxGeometry;
  sharedCylGeo: THREE.CylinderGeometry;
}

export interface ModernBuildingContext {
  arenaGroup: THREE.Group;
  colliders: ColliderBox[];
  ramps: RampSurface[];
  coverNodes: CoverNode[];
  doorways: DoorwayTrigger[];
  interiorSpawns: { x: number; y: number; z: number }[];
  shootableEnv: THREE.Object3D[];
  breakableGlass?: BreakableGlassPane[];
  isSoftwareGl: boolean;
  pal: ModernBuildingPalette;
}

function regModernGlass(ctx: ModernBuildingContext, mesh: THREE.Mesh): THREE.Mesh {
  mesh.userData.isBreakableBuildingGlass = true;
  ctx.shootableEnv.push(mesh);
  if (ctx.breakableGlass) {
    ctx.breakableGlass.push({ mesh, broken: false, respawnTimer: 0 });
  }
  return mesh;
}

export function createModernBuildingPalette(
  geoms: THREE.BufferGeometry[],
  extraMats: THREE.Material[],
  isNight = false,
  textures?: ProceduralTextureSet,
): ModernBuildingPalette {
  const mkStd = (color: number, roughness: number, metalness = 0.08, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    extraMats.push(m);
    return m;
  };
  const mkBasic = (color: number) => {
    const m = new THREE.MeshBasicMaterial({ color });
    extraMats.push(m);
    return m;
  };

  const sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const sharedCylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  geoms.push(sharedBoxGeo, sharedCylGeo);

  return {
    stuccoWhite: mkStd(isNight ? 0xb4c0ce : 0xe3e7ec, 0.68, 0.05, {
      ...(textures?.facadeModernPanel ? { map: textures.facadeModernPanel } : {}),
    }),
    creamStone: mkStd(isNight ? 0xa9a397 : 0xdcd3c4, 0.72, 0.05, {
      ...(textures?.facadeMasonryWarm ? { map: textures.facadeMasonryWarm } : {}),
    }),
    slateFrame: mkStd(0x28313d, 0.42, 0.45),
    darkCharcoal: mkStd(0x181e27, 0.48, 0.35),
    timberWarm: mkStd(0x9c663b, 0.76, 0.04, {
      ...(textures?.woodPlank ? { map: textures.woodPlank } : {}),
    }),
    glassPanel: mkStd(isNight ? 0x264b68 : 0x7bc8eb, 0.14, 0.38, {
      transparent: true,
      opacity: 0.44,
    }),
    interiorFloor: mkStd(0xe4dfd6, 0.42, 0.06, {
      ...(textures?.mallMarbleTile ? { map: textures.mallMarbleTile } : {}),
    }),
    stairTread: mkStd(0x2d241e, 0.62, 0.12),
    rugMat: mkStd(0x9f9484, 0.92, 0.02),
    sofaMat: mkStd(0xc6bfb4, 0.85, 0.02),
    planterLeaf: mkStd(isNight ? 0x1d4d2c : 0x2e7d3b, 0.82, 0.02),
    ledWarm: mkBasic(0xffd27d),
    ledOrange: mkBasic(0xff6b1a),
    ledCyan: mkBasic(0x22d3ee),
    sharedBoxGeo,
    sharedCylGeo,
  };
}

function addLocalBoxCollider(
  colliders: ColliderBox[],
  originX: number,
  baseY: number,
  originZ: number,
  rotY: number,
  lx: number,
  ly: number,
  lz: number,
  w: number,
  h: number,
  d: number,
  surface: SurfaceType = 'concrete',
) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const cx = originX + lx * cos + lz * sin;
  const cz = originZ - lx * sin + lz * cos;
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  const halfW = (w * absCos + d * absSin) * 0.5;
  const halfD = (w * absSin + d * absCos) * 0.5;
  colliders.push({
    minX: cx - halfW,
    maxX: cx + halfW,
    minY: baseY + ly,
    maxY: baseY + ly + h,
    minZ: cz - halfD,
    maxZ: cz + halfD,
    cx,
    cz,
    halfW: w * 0.5,
    halfD: d * 0.5,
    rotY,
    cosY: cos,
    sinY: sin,
    surface,
  });
}

function toWorldXZ(originX: number, originZ: number, rotY: number, lx: number, lz: number): { x: number; z: number } {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  return {
    x: originX + lx * cos + lz * sin,
    z: originZ - lx * sin + lz * cos,
  };
}

function addLocalRamp(
  ramps: RampSurface[],
  originX: number,
  baseY: number,
  originZ: number,
  rotY: number,
  lxMin: number,
  lxMax: number,
  lzMin: number,
  lzMax: number,
  localAxis: 'x' | 'z',
  lStartCoord: number,
  lEndCoord: number,
  lStartY: number,
  lEndY: number,
) {
  const p1 = toWorldXZ(originX, originZ, rotY, lxMin, lzMin);
  const p2 = toWorldXZ(originX, originZ, rotY, lxMax, lzMax);
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minZ = Math.min(p1.z, p2.z);
  const maxZ = Math.max(p1.z, p2.z);

  const cos = Math.cos(rotY);
  const alignedX = Math.abs(cos) > 0.5;
  const worldAxis: 'x' | 'z' = alignedX ? localAxis : localAxis === 'x' ? 'z' : 'x';

  const startPt = toWorldXZ(
    originX,
    originZ,
    rotY,
    localAxis === 'x' ? lStartCoord : 0,
    localAxis === 'z' ? lStartCoord : 0,
  );
  const endPt = toWorldXZ(
    originX,
    originZ,
    rotY,
    localAxis === 'x' ? lEndCoord : 0,
    localAxis === 'z' ? lEndCoord : 0,
  );

  ramps.push({
    minX,
    maxX,
    minZ,
    maxZ,
    axis: worldAxis,
    startCoord: worldAxis === 'x' ? startPt.x : startPt.z,
    endCoord: worldAxis === 'x' ? endPt.x : endPt.z,
    startY: baseY + lStartY,
    endY: baseY + lEndY,
  });
}

function addBoxMesh(
  parent: THREE.Group,
  geo: THREE.BoxGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  castShadow: boolean,
  shootable?: THREE.Object3D[],
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  parent.add(m);
  if (shootable) shootable.push(m);
  return m;
}

/** Builds a modern wood-slat accent wall with LED strip glow, floating stair treads, glass railing, & under-stair planter. */
function buildModernInteriorStaircase(
  ctx: ModernBuildingContext,
  grp: THREE.Group,
  originX: number,
  baseY: number,
  originZ: number,
  rotY: number,
  wallX: number,
  zStart: number,
  zEnd: number,
  floorH: number,
  stairWidth: number,
  railSideSign: -1 | 1,
  ledMat: THREE.MeshBasicMaterial,
) {
  const { sharedBoxGeo: boxGeo, sharedCylGeo: cylGeo } = ctx.pal;
  const { timberWarm, stairTread, glassPanel, slateFrame, interiorFloor, planterLeaf } = ctx.pal;
  const shadow = !ctx.isSoftwareGl;

  const minZ = Math.min(zStart, zEnd);
  const maxZ = Math.max(zStart, zEnd);
  const runLen = maxZ - minZ;
  const midZ = (minZ + maxZ) * 0.5;
  const centerX = wallX + railSideSign * (stairWidth * 0.5 + 0.12);

  // Vertical wood slat backing wall
  const slatCount = Math.max(6, Math.floor(runLen / 0.42));
  for (let i = 0; i <= slatCount; i++) {
    const sz = minZ + (i / slatCount) * runLen;
    addBoxMesh(grp, boxGeo, timberWarm, wallX, floorH * 0.48, sz, 0.14, floorH * 0.94, 0.12, false);
  }

  // Diagonal warm LED wave accent along slat wall
  const slopeAngle = Math.atan2(floorH, runLen) * (zEnd > zStart ? -1 : 1);
  const ledStrip = new THREE.Mesh(boxGeo, ledMat);
  ledStrip.position.set(wallX + railSideSign * 0.08, floorH * 0.5 + 0.45, midZ);
  ledStrip.scale.set(0.06, 0.09, Math.hypot(runLen, floorH) * 0.92);
  ledStrip.rotation.x = slopeAngle;
  grp.add(ledStrip);

  // Diagonal structural mono-stringer + floating timber treads with dark nosing
  const diagLen = Math.hypot(runLen, floorH);
  const carriage = new THREE.Mesh(boxGeo, slateFrame);
  carriage.position.set(centerX, floorH * 0.5 - 0.14, midZ);
  carriage.scale.set(0.26, 0.22, diagLen + 0.15);
  carriage.rotation.x = slopeAngle;
  grp.add(carriage);

  const stepCount = 12;
  const treadDepth = runLen / stepCount;
  const zDir = zEnd >= zStart ? 1 : -1;
  for (let s = 0; s < stepCount; s++) {
    const frac = (s + 0.5) / stepCount;
    const sz = THREE.MathUtils.lerp(zStart, zEnd, frac);
    const sy = frac * floorH;
    addBoxMesh(
      grp,
      boxGeo,
      stairTread,
      centerX,
      sy - 0.055,
      sz,
      stairWidth,
      0.11,
      treadDepth * 0.96,
      shadow,
      ctx.shootableEnv,
    );
    addBoxMesh(
      grp,
      boxGeo,
      slateFrame,
      centerX,
      sy - 0.015,
      sz - zDir * (treadDepth * 0.42),
      stairWidth - 0.06,
      0.032,
      0.07,
      false,
    );
  }

  // Sleek glass balustrade + handrail on inner open side
  const railX = centerX + railSideSign * (stairWidth * 0.5);
  const glassRail = new THREE.Mesh(boxGeo, glassPanel);
  glassRail.position.set(railX, floorH * 0.5 + 0.55, midZ);
  glassRail.scale.set(0.05, 1.0, diagLen);
  glassRail.rotation.x = slopeAngle;
  grp.add(glassRail);
  regModernGlass(ctx, glassRail);

  const handRail = new THREE.Mesh(boxGeo, slateFrame);
  handRail.position.set(railX, floorH * 0.5 + 1.06, midZ);
  handRail.scale.set(0.09, 0.07, diagLen);
  handRail.rotation.x = slopeAngle;
  grp.add(handRail);

  // Under-stair planter bed (also cleanly blocks walking under the tall half of the floating staircase)
  const upperMidZ = THREE.MathUtils.lerp(zStart, zEnd, 0.66);
  const planterLen = runLen * 0.62;
  addBoxMesh(grp, boxGeo, interiorFloor, centerX, 0.22, upperMidZ, stairWidth + 0.1, 0.44, planterLen, false);
  for (let p = -1; p <= 1; p++) {
    const bush = new THREE.Mesh(cylGeo, planterLeaf);
    bush.position.set(centerX, 0.72, upperMidZ + p * (planterLen * 0.26));
    bush.scale.set(0.75, 0.65, 0.75);
    grp.add(bush);
  }
  addLocalBoxCollider(
    ctx.colliders,
    originX,
    baseY,
    originZ,
    rotY,
    centerX,
    0,
    upperMidZ,
    stairWidth + 0.15,
    2.45,
    planterLen,
    'concrete',
  );

  // Walkable sloped ramp collider for stairs
  addLocalRamp(
    ctx.ramps,
    originX,
    baseY,
    originZ,
    rotY,
    centerX - stairWidth * 0.52,
    centerX + stairWidth * 0.52,
    minZ - 0.22,
    maxZ + 0.22,
    'z',
    zStart,
    zEnd,
    0,
    floorH,
  );

  // Side-guard colliders on both sides so walking laterally on stairs cannot fall off
  const guardSegs = 5;
  const spanZ = zEnd - zStart;
  for (let i = 0; i < guardSegs; i++) {
    const f0 = 0.04 + (i / guardSegs) * 0.92;
    const f1 = 0.04 + ((i + 1) / guardSegs) * 0.92;
    const z0 = zStart + f0 * spanZ;
    const z1 = zStart + f1 * spanZ;
    const midZSeg = (z0 + z1) * 0.5;
    const segLen = Math.abs(z1 - z0) + 0.14;
    const y0 = f0 * floorH;
    const y1 = f1 * floorH;
    const segFloorY = Math.min(y0, y1);
    const segExtraH = Math.abs(y1 - y0);
    [-1, 1].forEach((sideSign) => {
      addLocalBoxCollider(
        ctx.colliders,
        originX,
        baseY,
        originZ,
        rotY,
        centerX + sideSign * (stairWidth * 0.5 + 0.09),
        segFloorY - 0.08,
        midZSeg,
        0.22,
        1.38 + segExtraH,
        segLen,
        'metal',
      );
    });
  }
}

/** Helper to add a wall with a wide open doorway along X (z fixed) or Z (x fixed). */
function addPortalWallX(
  ctx: ModernBuildingContext,
  grp: THREE.Group,
  originX: number,
  baseY: number,
  originZ: number,
  rotY: number,
  wallZ: number,
  totalW: number,
  baseLy: number,
  wallH: number,
  doorW: number,
  doorH: number,
  wallMat: THREE.Material,
  frameMat: THREE.Material,
  inwardDirZ: -1 | 1,
  label: string,
) {
  const { sharedBoxGeo: boxGeo } = ctx.pal;
  const shadow = !ctx.isSoftwareGl;
  const wingW = (totalW - doorW) * 0.5;
  const t = 0.38;

  if (wingW > 0.25) {
    [-1, 1].forEach((side) => {
      const wx = side * (doorW * 0.5 + wingW * 0.5);
      addBoxMesh(grp, boxGeo, wallMat, wx, baseLy + wallH * 0.5, wallZ, wingW, wallH, t, shadow, ctx.shootableEnv);
      addLocalBoxCollider(ctx.colliders, originX, baseY, originZ, rotY, wx, baseLy, wallZ, wingW, wallH, t, 'concrete');
    });
  }
  const headerH = wallH - doorH;
  if (headerH > 0.15) {
    addBoxMesh(
      grp,
      boxGeo,
      frameMat,
      0,
      baseLy + doorH + headerH * 0.5,
      wallZ,
      doorW + 0.3,
      headerH,
      t + 0.04,
      shadow,
      ctx.shootableEnv,
    );
  }
  // Side trim pillars framing doorway
  [-doorW * 0.5, doorW * 0.5].forEach((px) => {
    addBoxMesh(grp, boxGeo, frameMat, px, baseLy + doorH * 0.5, wallZ, 0.22, doorH, t + 0.08, false);
  });

  if (baseLy < 0.5) {
    const wp = toWorldXZ(originX, originZ, rotY, 0, wallZ);
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    ctx.doorways.push({
      x: wp.x,
      z: wp.z,
      inwardDirX: inwardDirZ * sin,
      inwardDirZ: inwardDirZ * cos,
      width: doorW,
      label,
    });
  }
}

export interface ModernVillaOptions {
  x: number;
  y?: number;
  z: number;
  w?: number;
  d?: number;
  rotY?: number; // Use 0, Math.PI/2, Math.PI, -Math.PI/2 for exact ramp alignment
  accent?: 'warm' | 'cyan';
  label?: string;
}

/**
 * Modern 2-Story Cantilevered Luxury Villa (Enterable with Floating Wood-Slat LED Staircase,
 * Glass Curtain Walls, 2nd-Floor Balcony & Interior Combat Cover).
 */
export function placeModernVilla(ctx: ModernBuildingContext, opts: ModernVillaOptions) {
  const {
    x,
    y = 0,
    z,
    w = 13.6,
    d = 11.4,
    rotY = 0,
    accent = 'warm',
    label = 'Modern Villa',
  } = opts;
  const { pal, isSoftwareGl } = ctx;
  const { sharedBoxGeo: boxGeo } = pal;
  const shadow = !isSoftwareGl;
  const floorH = 4.0;
  const upperH = 3.6;
  const doorW = 3.2;
  const doorH = 2.95;

  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;

  // Ground floor tile deck & subtle entry terrace
  addBoxMesh(grp, boxGeo, pal.interiorFloor, 0, 0.07, 0, w + 0.6, 0.14, d + 1.4, false, ctx.shootableEnv);

  // Ground floor front & rear walls with wide open walkable doorways
  addPortalWallX(ctx, grp, x, y, z, rotY, d * 0.5 - 0.19, w, 0, floorH, doorW, doorH, pal.stuccoWhite, pal.slateFrame, -1, label);
  addPortalWallX(ctx, grp, x, y, z, rotY, -d * 0.5 + 0.19, w, 0, floorH, doorW, doorH, pal.stuccoWhite, pal.slateFrame, 1, label);

  // Side walls (ground floor: white stucco + warm timber facade accent + recessed architectural glazing)
  [-1, 1].forEach((side) => {
    const sx = side * (w * 0.5 - 0.19);
    addBoxMesh(grp, boxGeo, pal.stuccoWhite, sx, floorH * 0.5, -d * 0.24, 0.38, floorH, d * 0.52, shadow, ctx.shootableEnv);
    addBoxMesh(grp, boxGeo, pal.timberWarm, sx + side * 0.05, floorH * 0.5, d * 0.2, 0.34, floorH - 0.3, d * 0.36, shadow, ctx.shootableEnv);
    regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, sx, floorH * 0.5, d * 0.04, 0.16, floorH - 0.7, d * 0.36, false));
    addLocalBoxCollider(ctx.colliders, x, y, z, rotY, sx, 0, 0, 0.4, floorH, d, 'concrete');
  });

  // Interior ground-floor modern lounge furniture (tactical low cover!)
  const sofaX = -w * 0.24;
  const sofaZ = -0.8;
  addBoxMesh(grp, boxGeo, pal.rugMat, sofaX, 0.16, sofaZ, 3.2, 0.04, 2.6, false);
  addBoxMesh(grp, boxGeo, pal.sofaMat, sofaX - 0.7, 0.48, sofaZ, 0.9, 0.64, 2.2, shadow, ctx.shootableEnv);
  addBoxMesh(grp, boxGeo, pal.timberWarm, sofaX + 0.55, 0.38, sofaZ, 0.8, 0.42, 1.3, shadow, ctx.shootableEnv);
  addLocalBoxCollider(ctx.colliders, x, y, z, rotY, sofaX - 0.7, 0, sofaZ, 0.95, 0.85, 2.25, 'wood');

  // Right-side interior modern floating staircase against east wall
  const stairWallX = w * 0.5 - 0.52;
  const stairW = 2.15;
  const stairZStart = d * 0.33;
  const stairZEnd = -d * 0.28;
  buildModernInteriorStaircase(
    ctx,
    grp,
    x,
    y,
    z,
    rotY,
    stairWallX,
    stairZStart,
    stairZEnd,
    floorH,
    stairW,
    -1,
    accent === 'cyan' ? pal.ledCyan : pal.ledWarm,
  );

  // 2nd Floor Cantilevered Slab (split around stairwell opening on the east side!)
  const stairCutMinX = stairWallX - stairW - 0.2;
  const mainSlabW = stairCutMinX - (-w * 0.5 - 0.35);
  const mainSlabCx = (-w * 0.5 - 0.35) + mainSlabW * 0.5;
  // Main 2nd floor + front cantilevered balcony overhang (+1.6m beyond front wall)
  const mainSlabD = d + 2.2;
  const mainSlabCz = 0.65;
  addBoxMesh(grp, boxGeo, pal.stuccoWhite, mainSlabCx, floorH - 0.14, mainSlabCz, mainSlabW, 0.28, mainSlabD, shadow, ctx.shootableEnv);
  addLocalRamp(
    ctx.ramps,
    x,
    y,
    z,
    rotY,
    mainSlabCx - mainSlabW * 0.5,
    mainSlabCx + mainSlabW * 0.5,
    mainSlabCz - mainSlabD * 0.5,
    mainSlabCz + mainSlabD * 0.5,
    'z',
    mainSlabCz - mainSlabD * 0.5,
    mainSlabCz + mainSlabD * 0.5,
    floorH,
    floorH,
  );

  // North upper landing bridge behind stairwell (connects stair top cleanly to 2nd floor)
  const landingMinZ = -d * 0.5 - 0.3;
  const landingMaxZ = stairZEnd + 0.1;
  const landingD = landingMaxZ - landingMinZ;
  const landingCz = (landingMinZ + landingMaxZ) * 0.5;
  const landingW = w * 0.5 + 0.35 - stairCutMinX;
  const landingCx = stairCutMinX + landingW * 0.5;
  if (landingD > 0.6 && landingW > 0.6) {
    addBoxMesh(grp, boxGeo, pal.stuccoWhite, landingCx, floorH - 0.14, landingCz, landingW, 0.28, landingD, shadow, ctx.shootableEnv);
    addLocalRamp(
      ctx.ramps,
      x,
      y,
      z,
      rotY,
      landingCx - landingW * 0.5,
      landingCx + landingW * 0.5,
      landingMinZ,
      landingMaxZ,
      'z',
      landingMinZ,
      landingMaxZ,
      floorH,
      floorH,
    );
  }

  // Front outdoor balcony glass railing
  const balcZ = mainSlabCz + mainSlabD * 0.5 - 0.08;
  regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, mainSlabCx, floorH + 0.52, balcZ, mainSlabW, 1.0, 0.08, false));
  addBoxMesh(grp, boxGeo, pal.slateFrame, mainSlabCx, floorH + 1.04, balcZ, mainSlabW, 0.08, 0.12, false);
  addLocalBoxCollider(ctx.colliders, x, y, z, rotY, mainSlabCx, floorH, balcZ, mainSlabW, 1.1, 0.2, 'concrete');

  // Stairwell safety glass rail on 2nd floor inner edge
  const wellLen = stairZStart - stairZEnd;
  if (wellLen > 0.5) {
    const wellMidZ = (stairZStart + stairZEnd) * 0.5;
    regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, stairCutMinX, floorH + 0.52, wellMidZ, 0.08, 1.0, wellLen, false));
    addBoxMesh(grp, boxGeo, pal.slateFrame, stairCutMinX, floorH + 1.04, wellMidZ, 0.12, 0.08, wellLen, false);
    addLocalBoxCollider(ctx.colliders, x, y, z, rotY, stairCutMinX, floorH, wellMidZ, 0.22, 1.1, wellLen, 'concrete');
  }

  // 2nd Floor Architectural Volume + Walkable Balcony Portal + Cantilevered Flat Roof
  const upFrontZ = d * 0.36;
  const upBackZ = -d * 0.5 + 0.19;
  addPortalWallX(ctx, grp, x, y, z, rotY, upFrontZ, w, floorH, upperH, 3.6, 2.8, pal.stuccoWhite, pal.slateFrame, -1, `${label} Upper`);
  addBoxMesh(grp, boxGeo, pal.stuccoWhite, 0, floorH + upperH * 0.5, upBackZ, w, upperH, 0.38, shadow, ctx.shootableEnv);
  addLocalBoxCollider(ctx.colliders, x, y, z, rotY, 0, floorH, upBackZ, w, upperH, 0.42, 'concrete');
  [-1, 1].forEach((side) => {
    const sx = side * (w * 0.5 - 0.19);
    addBoxMesh(grp, boxGeo, pal.stuccoWhite, sx, floorH + upperH * 0.5, 0, 0.38, upperH, d, shadow, ctx.shootableEnv);
    addBoxMesh(grp, boxGeo, pal.timberWarm, sx + side * 0.04, floorH + upperH * 0.5, -d * 0.1, 0.32, upperH - 0.4, d * 0.45, shadow);
    addLocalBoxCollider(ctx.colliders, x, y, z, rotY, sx, floorH, 0, 0.42, upperH, d, 'concrete');
  });

  // Cantilevered Flat Modern Roof + Warm Soffit Glow Accent
  const roofY = floorH + upperH;
  addBoxMesh(grp, boxGeo, pal.stuccoWhite, -0.35, roofY + 0.22, 0.55, w + 1.4, 0.44, d + 2.4, shadow, ctx.shootableEnv);
  addBoxMesh(grp, boxGeo, pal.darkCharcoal, -0.35, roofY + 0.48, 0.55, w + 0.6, 0.12, d + 1.6, false);
  addBoxMesh(
    grp,
    boxGeo,
    accent === 'cyan' ? pal.ledCyan : pal.ledWarm,
    0,
    floorH + 0.04,
    balcZ - 0.3,
    w * 0.65,
    0.06,
    0.1,
    false,
  );

  // Exterior & Interior Cover Nodes + Interior Enemy Spawns (1st & 2nd floor!)
  [
    { lx: -w * 0.18, ly: 0, lz: 1.6 },
    { lx: w * 0.12, ly: 0, lz: -1.8 },
    { lx: -w * 0.22, ly: floorH, lz: 0.4 },
    { lx: 0.6, ly: floorH, lz: -1.8 },
  ].forEach((pt) => {
    const wp = toWorldXZ(x, z, rotY, pt.lx, pt.lz);
    ctx.interiorSpawns.push({ x: wp.x, y: y + pt.ly, z: wp.z });
    ctx.coverNodes.push({ x: wp.x, y: y + pt.ly, z: wp.z, coverCenterX: x, coverCenterZ: z, occupiedBy: null });
  });

  // Exterior corner cover nodes
  [
    [-w * 0.64, 0],
    [w * 0.64, 0],
    [0, d * 0.66],
    [0, -d * 0.64],
  ].forEach(([lx, lz]) => {
    const wp = toWorldXZ(x, z, rotY, lx, lz);
    ctx.coverNodes.push({ x: wp.x, y, z: wp.z, coverCenterX: x, coverCenterZ: z, occupiedBy: null });
  });

  ctx.arenaGroup.add(grp);
}

export interface ModernTechOptions {
  x: number;
  y?: number;
  z: number;
  w?: number;
  d?: number;
  h?: number;
  rotY?: number;
  accent?: 'orange' | 'cyan';
  enterable?: boolean;
  label?: string;
}

/**
 * Modern Futuristic Modular Tech Facility (White Armored Facade + Glowing Orange or Cyan Accent Panels).
 * When `enterable: true`, includes open lobby portals, indoor stair ramp to 2nd-floor tactical deck, and interior spawns.
 */
export function placeModernTechBuilding(ctx: ModernBuildingContext, opts: ModernTechOptions) {
  const {
    x,
    y = 0,
    z,
    w = 14.0,
    d = 12.0,
    h = 7.4,
    rotY = 0,
    accent = 'orange',
    enterable = true,
    label = 'Tech Outpost',
  } = opts;
  const { pal, isSoftwareGl } = ctx;
  const { sharedBoxGeo: boxGeo } = pal;
  const shadow = !isSoftwareGl;
  const ledMat = accent === 'cyan' ? pal.ledCyan : pal.ledOrange;

  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;

  if (!enterable) {
    // Sleek modular armored command pod
    addBoxMesh(grp, boxGeo, pal.darkCharcoal, 0, h * 0.48, 0, w * 0.94, h * 0.96, d * 0.94, shadow, ctx.shootableEnv);
    // White outer armored wings
    [-1, 1].forEach((side) => {
      addBoxMesh(grp, boxGeo, pal.stuccoWhite, side * (w * 0.34), h * 0.5, 0, w * 0.34, h, d, shadow, ctx.shootableEnv);
      addBoxMesh(grp, boxGeo, ledMat, side * (w * 0.34), h * 0.72, d * 0.51, w * 0.24, 0.22, 0.08, false);
      addBoxMesh(grp, boxGeo, ledMat, side * (w * 0.34), h * 0.72, -d * 0.51, w * 0.24, 0.22, 0.08, false);
    });
    // Crown canopy & neon strip
    addBoxMesh(grp, boxGeo, pal.stuccoWhite, 0, h + 0.32, 0, w + 0.8, 0.64, d + 0.8, shadow, ctx.shootableEnv);
    addBoxMesh(grp, boxGeo, ledMat, 0, h + 0.14, d * 0.5 + 0.42, w * 0.75, 0.14, 0.08, false);
    regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, 0, h * 0.54, d * 0.48, w * 0.32, h * 0.38, 0.15, false));

    addLocalBoxCollider(ctx.colliders, x, y, z, rotY, 0, 0, 0, w, h, d, 'metal');
    [
      [-w * 0.64, 0],
      [w * 0.64, 0],
      [0, d * 0.66],
      [0, -d * 0.66],
    ].forEach(([lx, lz]) => {
      const wp = toWorldXZ(x, z, rotY, lx, lz);
      ctx.coverNodes.push({ x: wp.x, y, z: wp.z, coverCenterX: x, coverCenterZ: z, occupiedBy: null });
    });
    ctx.arenaGroup.add(grp);
    return;
  }

  // Enterable 2-level Tech Facility
  const floorH = 3.8;
  const upperH = Math.max(3.2, h - floorH);
  const doorW = 3.8;
  const doorH = 2.9;

  addBoxMesh(grp, boxGeo, pal.darkCharcoal, 0, 0.06, 0, w + 0.4, 0.12, d + 0.8, false, ctx.shootableEnv);

  // Front & back walls with wide tactical bay doors + glowing top accent
  addPortalWallX(ctx, grp, x, y, z, rotY, d * 0.5 - 0.19, w, 0, floorH, doorW, doorH, pal.stuccoWhite, pal.darkCharcoal, -1, label);
  addPortalWallX(ctx, grp, x, y, z, rotY, -d * 0.5 + 0.19, w, 0, floorH, doorW, doorH, pal.stuccoWhite, pal.darkCharcoal, 1, label);
  addBoxMesh(grp, boxGeo, ledMat, 0, doorH + 0.14, d * 0.5 + 0.04, doorW + 0.6, 0.12, 0.08, false);
  addBoxMesh(grp, boxGeo, ledMat, 0, doorH + 0.14, -d * 0.5 - 0.04, doorW + 0.6, 0.12, 0.08, false);

  // Armored side shells (ground + upper)
  [-1, 1].forEach((side) => {
    const sx = side * (w * 0.5 - 0.22);
    const totalH = floorH + upperH;
    addBoxMesh(grp, boxGeo, pal.stuccoWhite, sx, totalH * 0.5, 0, 0.44, totalH, d, shadow, ctx.shootableEnv);
    addBoxMesh(grp, boxGeo, pal.slateFrame, sx + side * 0.24, totalH * 0.5, 0, 0.12, totalH * 0.72, d * 0.64, false);
    addBoxMesh(grp, boxGeo, ledMat, sx + side * 0.27, floorH + 0.4, 0, 0.08, 0.14, d * 0.78, false);
    addLocalBoxCollider(ctx.colliders, x, y, z, rotY, sx, 0, 0, 0.48, totalH, d, 'metal');
  });

  // Interior ground-floor tactical server racks for indoor cover
  addBoxMesh(grp, boxGeo, pal.darkCharcoal, -w * 0.22, 0.9, -0.4, 1.3, 1.8, 3.0, shadow, ctx.shootableEnv);
  addBoxMesh(grp, boxGeo, ledMat, -w * 0.22 + 0.68, 1.2, -0.4, 0.06, 0.9, 2.2, false);
  addLocalBoxCollider(ctx.colliders, x, y, z, rotY, -w * 0.22, 0, -0.4, 1.35, 1.85, 3.05, 'metal');

  // Interior modern staircase along east wall
  const stairWallX = w * 0.5 - 0.54;
  const stairW = 2.2;
  const stairZStart = d * 0.34;
  const stairZEnd = -d * 0.28;
  buildModernInteriorStaircase(ctx, grp, x, y, z, rotY, stairWallX, stairZStart, stairZEnd, floorH, stairW, -1, ledMat);

  // Upper 2nd floor gallery deck (left of stairwell + north landing)
  const cutMinX = stairWallX - stairW - 0.22;
  const deckW = cutMinX - (-w * 0.5 - 0.1);
  const deckCx = (-w * 0.5 - 0.1) + deckW * 0.5;
  addBoxMesh(grp, boxGeo, pal.darkCharcoal, deckCx, floorH - 0.14, 0, deckW, 0.28, d - 0.4, shadow, ctx.shootableEnv);
  addLocalRamp(
    ctx.ramps,
    x,
    y,
    z,
    rotY,
    deckCx - deckW * 0.5,
    deckCx + deckW * 0.5,
    -d * 0.5 + 0.2,
    d * 0.5 - 0.2,
    'z',
    -d * 0.5 + 0.2,
    d * 0.5 - 0.2,
    floorH,
    floorH,
  );

  // North landing strip
  const landMinZ = -d * 0.5 + 0.2;
  const landMaxZ = stairZEnd + 0.1;
  const landD = landMaxZ - landMinZ;
  const landCz = (landMinZ + landMaxZ) * 0.5;
  const landW = w * 0.5 - cutMinX - 0.2;
  const landCx = cutMinX + landW * 0.5;
  if (landD > 0.6 && landW > 0.6) {
    addBoxMesh(grp, boxGeo, pal.darkCharcoal, landCx, floorH - 0.14, landCz, landW, 0.28, landD, shadow, ctx.shootableEnv);
    addLocalRamp(
      ctx.ramps,
      x,
      y,
      z,
      rotY,
      landCx - landW * 0.5,
      landCx + landW * 0.5,
      landMinZ,
      landMaxZ,
      'z',
      landMinZ,
      landMaxZ,
      floorH,
      floorH,
    );
  }

  // Upper floor front & back armored parapet windows (glass top + half-wall cover!)
  [d * 0.5 - 0.19, -d * 0.5 + 0.19].forEach((wz) => {
    addBoxMesh(grp, boxGeo, pal.stuccoWhite, 0, floorH + 0.55, wz, w, 1.1, 0.38, shadow, ctx.shootableEnv);
    regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, 0, floorH + upperH * 0.62, wz, w * 0.72, upperH * 0.45, 0.12, false));
    addBoxMesh(grp, boxGeo, pal.stuccoWhite, 0, floorH + upperH - 0.3, wz, w, 0.6, 0.42, shadow);
    addLocalBoxCollider(ctx.colliders, x, y, z, rotY, 0, floorH, wz, w, 1.15, 0.42, 'metal');
  });

  // High-tech cantilevered roof + top neon fins
  const roofY = floorH + upperH;
  addBoxMesh(grp, boxGeo, pal.stuccoWhite, 0, roofY + 0.28, 0, w + 1.0, 0.56, d + 1.0, shadow, ctx.shootableEnv);
  addBoxMesh(grp, boxGeo, pal.darkCharcoal, 0, roofY + 0.72, 0, w * 0.62, 0.34, d * 0.58, false);
  addBoxMesh(grp, boxGeo, ledMat, 0, roofY + 0.28, d * 0.5 + 0.52, w * 0.7, 0.14, 0.08, false);

  // Interior combat positions (ground + upper gallery)
  [
    { lx: 0.4, ly: 0, lz: 1.5 },
    { lx: -w * 0.05, ly: 0, lz: -2.2 },
    { lx: -w * 0.2, ly: floorH, lz: 1.2 },
    { lx: 0.2, ly: floorH, lz: -2.2 },
  ].forEach((pt) => {
    const wp = toWorldXZ(x, z, rotY, pt.lx, pt.lz);
    ctx.interiorSpawns.push({ x: wp.x, y: y + pt.ly, z: wp.z });
    ctx.coverNodes.push({ x: wp.x, y: y + pt.ly, z: wp.z, coverCenterX: x, coverCenterZ: z, occupiedBy: null });
  });

  [
    [-w * 0.64, 0],
    [w * 0.64, 0],
    [0, d * 0.65],
    [0, -d * 0.65],
  ].forEach(([lx, lz]) => {
    const wp = toWorldXZ(x, z, rotY, lx, lz);
    ctx.coverNodes.push({ x: wp.x, y, z: wp.z, coverCenterX: x, coverCenterZ: z, occupiedBy: null });
  });

  ctx.arenaGroup.add(grp);
}

export interface ModernTowerOptions {
  x: number;
  y?: number;
  z: number;
  w?: number;
  d?: number;
  floors?: number;
  rotY?: number;
  enterable?: boolean;
  label?: string;
}

/**
 * Modern Residential / Commercial Balcony Tower (Cream Stone, Warm Timber Soffits,
 * Wraparound Cantilevered Balconies & Glass Railings).
 * When `enterable: true`, ground + 2nd floor are walkable indoors via floating LED stairs!
 */
export function placeModernBalconyTower(ctx: ModernBuildingContext, opts: ModernTowerOptions) {
  const {
    x,
    y = 0,
    z,
    w = 15.0,
    d = 13.0,
    floors = 4,
    rotY = 0,
    enterable = false,
    label = 'Balcony Tower',
  } = opts;
  const { pal, isSoftwareGl } = ctx;
  const { sharedBoxGeo: boxGeo } = pal;
  const shadow = !isSoftwareGl;
  const floorH = 3.8;
  const totalH = floors * floorH;

  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;

  if (!enterable) {
    // Architectural tower core with glass window curtain bands + wraparound timber-lined balconies
    addBoxMesh(grp, boxGeo, pal.creamStone, 0, totalH * 0.5, 0, w, totalH, d, shadow, ctx.shootableEnv);
    regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, 0, totalH * 0.5, 0, w * 0.88, totalH * 0.88, d + 0.14, false));
    regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, 0, totalH * 0.5, 0, w + 0.14, totalH * 0.88, d * 0.86, false));

    for (let f = 1; f <= floors; f++) {
      const fy = f * floorH;
      addBoxMesh(grp, boxGeo, pal.stuccoWhite, 0, fy - 0.14, 0, w + 1.8, 0.28, d + 1.8, shadow, ctx.shootableEnv);
      addBoxMesh(grp, boxGeo, pal.timberWarm, 0, fy - 0.3, 0, w + 1.4, 0.08, d + 1.4, false);
      if (f < floors) {
        regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, 0, fy + 0.48, d * 0.5 + 0.82, w + 1.6, 0.92, 0.07, false));
        regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, 0, fy + 0.48, -d * 0.5 - 0.82, w + 1.6, 0.92, 0.07, false));
        addBoxMesh(grp, boxGeo, pal.planterLeaf, -w * 0.34, fy + 0.3, d * 0.5 + 0.55, 2.2, 0.55, 0.55, false);
      }
    }
    addBoxMesh(grp, boxGeo, pal.slateFrame, 0, totalH + 0.32, 0, w * 0.65, 0.6, d * 0.65, false);

    addLocalBoxCollider(ctx.colliders, x, y, z, rotY, 0, 0, 0, w + 0.6, totalH, d + 0.6, 'concrete');
    [
      [-w * 0.64, 0],
      [w * 0.64, 0],
      [0, d * 0.66],
      [0, -d * 0.66],
    ].forEach(([lx, lz]) => {
      const wp = toWorldXZ(x, z, rotY, lx, lz);
      ctx.coverNodes.push({ x: wp.x, y, z: wp.z, coverCenterX: x, coverCenterZ: z, occupiedBy: null });
    });
    ctx.arenaGroup.add(grp);
    return;
  }

  // Enterable 2-Level Podium + Upper Architectural Balcony Tower
  const doorW = 3.4;
  const doorH = 2.95;
  addBoxMesh(grp, boxGeo, pal.interiorFloor, 0, 0.07, 0, w + 0.8, 0.14, d + 0.8, false, ctx.shootableEnv);

  // Ground floor open lobby front & rear portals
  addPortalWallX(ctx, grp, x, y, z, rotY, d * 0.5 - 0.19, w, 0, floorH, doorW, doorH, pal.creamStone, pal.slateFrame, -1, label);
  addPortalWallX(ctx, grp, x, y, z, rotY, -d * 0.5 + 0.19, w, 0, floorH, doorW, doorH, pal.creamStone, pal.slateFrame, 1, label);

  // Ground + 2nd floor side walls
  [-1, 1].forEach((side) => {
    const sx = side * (w * 0.5 - 0.2);
    addBoxMesh(grp, boxGeo, pal.creamStone, sx, floorH, 0, 0.4, floorH * 2, d, shadow, ctx.shootableEnv);
    regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, sx, floorH * 0.5, 0, 0.46, floorH * 0.6, d * 0.45, false));
    addLocalBoxCollider(ctx.colliders, x, y, z, rotY, sx, 0, 0, 0.45, floorH * 2, d, 'concrete');
  });

  // Ground lounge divider desk for indoor cover
  addBoxMesh(grp, boxGeo, pal.timberWarm, -w * 0.22, 0.55, 0.2, 2.8, 1.1, 0.85, shadow, ctx.shootableEnv);
  addLocalBoxCollider(ctx.colliders, x, y, z, rotY, -w * 0.22, 0, 0.2, 2.85, 1.15, 0.9, 'wood');

  // Indoor modern staircase on east side
  const stairWallX = w * 0.5 - 0.52;
  const stairW = 2.25;
  const stairZStart = d * 0.34;
  const stairZEnd = -d * 0.28;
  buildModernInteriorStaircase(ctx, grp, x, y, z, rotY, stairWallX, stairZStart, stairZEnd, floorH, stairW, -1, pal.ledWarm);

  // 2nd Floor slab + cantilevered balcony + north stair landing
  const cutMinX = stairWallX - stairW - 0.22;
  const slabW = cutMinX - (-w * 0.5 - 0.8);
  const slabCx = (-w * 0.5 - 0.8) + slabW * 0.5;
  addBoxMesh(grp, boxGeo, pal.stuccoWhite, slabCx, floorH - 0.14, 0, slabW, 0.28, d + 2.2, shadow, ctx.shootableEnv);
  addLocalRamp(
    ctx.ramps,
    x,
    y,
    z,
    rotY,
    slabCx - slabW * 0.5,
    slabCx + slabW * 0.5,
    -d * 0.5 - 1.1,
    d * 0.5 + 1.1,
    'z',
    -d * 0.5 - 1.1,
    d * 0.5 + 1.1,
    floorH,
    floorH,
  );

  const landMinZ = -d * 0.5 - 0.3;
  const landMaxZ = stairZEnd + 0.1;
  const landD = landMaxZ - landMinZ;
  const landCz = (landMinZ + landMaxZ) * 0.5;
  const landW = w * 0.5 + 0.8 - cutMinX;
  const landCx = cutMinX + landW * 0.5;
  if (landD > 0.5 && landW > 0.5) {
    addBoxMesh(grp, boxGeo, pal.stuccoWhite, landCx, floorH - 0.14, landCz, landW, 0.28, landD, shadow, ctx.shootableEnv);
    addLocalRamp(
      ctx.ramps,
      x,
      y,
      z,
      rotY,
      landCx - landW * 0.5,
      landCx + landW * 0.5,
      landMinZ,
      landMaxZ,
      'z',
      landMinZ,
      landMaxZ,
      floorH,
      floorH,
    );
  }

  // 2nd floor front & back balcony open portals + wraparound glass railings
  addPortalWallX(ctx, grp, x, y, z, rotY, d * 0.5 - 0.19, w, floorH, floorH, 3.6, 2.8, pal.creamStone, pal.slateFrame, -1, `${label} 2F`);
  addPortalWallX(ctx, grp, x, y, z, rotY, -d * 0.5 + 0.19, w, floorH, floorH, 3.6, 2.8, pal.creamStone, pal.slateFrame, 1, `${label} 2F`);
  [d * 0.5 + 1.02, -d * 0.5 - 1.02].forEach((rz) => {
    regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, slabCx, floorH + 0.52, rz, slabW, 1.0, 0.08, false));
    addBoxMesh(grp, boxGeo, pal.slateFrame, slabCx, floorH + 1.04, rz, slabW, 0.08, 0.12, false);
    addLocalBoxCollider(ctx.colliders, x, y, z, rotY, slabCx, floorH, rz, slabW, 1.1, 0.22, 'concrete');
  });

  // Sealed Upper Floors (Floor 3+) rising above the accessible 2nd floor ceiling
  const upperFloors = Math.max(1, floors - 2);
  const upBaseY = floorH * 2;
  const upH = upperFloors * floorH;
  addBoxMesh(grp, boxGeo, pal.creamStone, 0, upBaseY + upH * 0.5, 0, w, upH, d, shadow, ctx.shootableEnv);
  regModernGlass(ctx, addBoxMesh(grp, boxGeo, pal.glassPanel, 0, upBaseY + upH * 0.5, 0, w * 0.86, upH * 0.85, d + 0.12, false));
  for (let f = 2; f <= floors; f++) {
    const fy = f * floorH;
    addBoxMesh(grp, boxGeo, pal.stuccoWhite, 0, fy - 0.14, 0, w + 1.8, 0.28, d + 1.8, shadow);
    addBoxMesh(grp, boxGeo, pal.timberWarm, 0, fy - 0.3, 0, w + 1.4, 0.08, d + 1.4, false);
  }
  addBoxMesh(grp, boxGeo, pal.slateFrame, 0, totalH + 0.3, 0, w * 0.65, 0.6, d * 0.65, false);

  // Interior combat spawns (ground + 2nd floor)
  [
    { lx: 0.4, ly: 0, lz: 1.8 },
    { lx: -w * 0.12, ly: 0, lz: -2.0 },
    { lx: -w * 0.2, ly: floorH, lz: 0.8 },
    { lx: 0.3, ly: floorH, lz: -2.1 },
  ].forEach((pt) => {
    const wp = toWorldXZ(x, z, rotY, pt.lx, pt.lz);
    ctx.interiorSpawns.push({ x: wp.x, y: y + pt.ly, z: wp.z });
    ctx.coverNodes.push({ x: wp.x, y: y + pt.ly, z: wp.z, coverCenterX: x, coverCenterZ: z, occupiedBy: null });
  });

  [
    [-w * 0.64, 0],
    [w * 0.64, 0],
    [0, d * 0.68],
    [0, -d * 0.68],
  ].forEach(([lx, lz]) => {
    const wp = toWorldXZ(x, z, rotY, lx, lz);
    ctx.coverNodes.push({ x: wp.x, y, z: wp.z, coverCenterX: x, coverCenterZ: z, occupiedBy: null });
  });

  ctx.arenaGroup.add(grp);
}
