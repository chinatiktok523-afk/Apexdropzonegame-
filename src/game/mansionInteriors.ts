import * as THREE from 'three';
import { addCollider, type ColliderBox, type RampSurface } from './arena';
import { addStairSideGuardColliders, type SimWorldBuildContext } from './buildingsAndTransit';
import {
  MAIN_HALL_LOUNGE_LAYOUT,
  MANSION_BUILDING_BOUNDS,
  MANSION_FLOOR_HEIGHT,
  MANSION_HELIPAD_COORDS,
  MANSION_HELIPAD_2_COORDS,
  MANSION_LEVEL_2_Y,
  MANSION_LEVEL_3_Y,
  MANSION_ROOF_Y,
  computeWireLedScale,
} from './mansionSystems';
import { PropMeshAssembler, createPropPbrMaterials } from './urbanProps';
import { MAIN_SCREEN_VIDEO_PLAYLIST } from './lobbyConfig';

export interface MansionInteriorResult {
  roomLightMats: THREE.MeshStandardMaterial[];
  animatedUpdaters: Array<(dt: number, elapsed: number) => void>;
}

/**
 * Shared helper to register a solid architectural slab or wall in both visual assembly and colliders.
 */
function addSolidWall(
  pb: PropMeshAssembler,
  colliders: ColliderBox[],
  x: number,
  yCenter: number,
  z: number,
  w: number,
  h: number,
  d: number,
  hex: number,
  style: 'solid' | 'glossy' | 'glass' | 'emissive' = 'solid',
  surface: ColliderBox['surface'] = 'concrete',
) {
  pb.addBox(x, yCenter, z, w, h, d, hex, style);
  addCollider(colliders, x, yCenter - h * 0.5, z, w, h, d, 0, surface);
}

/**
 * Builds an interactive wooden interior room door with hinged leaf that toggles open/closed via [E] interact
 * or proximity gentle auto-latch, toggling its physical collider dynamically.
 */
function createInteractiveInteriorDoor(
  ctx: SimWorldBuildContext,
  parent: THREE.Group,
  x: number,
  floorY: number,
  z: number,
  rotY: number,
  label: string,
  woodMat: THREE.Material,
  goldMat: THREE.Material,
  darkMat: THREE.Material,
  boxGeo: THREE.BoxGeometry,
) {
  const doorRoot = new THREE.Group();
  doorRoot.position.set(x, floorY, z);
  doorRoot.rotation.y = rotY;
  parent.add(doorRoot);

  // Frame surround
  const frameL = new THREE.Mesh(boxGeo, darkMat);
  frameL.scale.set(0.14, 2.8, 0.28);
  frameL.position.set(-0.78, 1.4, 0);
  const frameR = new THREE.Mesh(boxGeo, darkMat);
  frameR.scale.set(0.14, 2.8, 0.28);
  frameR.position.set(0.78, 1.4, 0);
  const frameTop = new THREE.Mesh(boxGeo, darkMat);
  frameTop.scale.set(1.7, 0.16, 0.28);
  frameTop.position.set(0, 2.84, 0);
  doorRoot.add(frameL, frameR, frameTop);

  // Hinged wooden door panel + brass handle + decorative reveal strips
  const hinge = new THREE.Group();
  hinge.position.set(-0.7, 0, 0);
  doorRoot.add(hinge);

  const leaf = new THREE.Mesh(boxGeo, woodMat);
  leaf.scale.set(1.38, 2.74, 0.08);
  leaf.position.set(0.69, 1.37, 0);
  leaf.castShadow = !ctx.isSoftwareGl;
  leaf.receiveShadow = true;
  hinge.add(leaf);

  const handleF = new THREE.Mesh(boxGeo, goldMat);
  handleF.scale.set(0.16, 0.05, 0.16);
  handleF.position.set(1.24, 1.24, 0);
  hinge.add(handleF);

  // Dynamic collider toggled when door closes vs opens
  const isRotatedEW = Math.abs(Math.sin(rotY)) > 0.7;
  const cw = isRotatedEW ? 0.35 : 1.44;
  const cd = isRotatedEW ? 1.44 : 0.35;
  addCollider(ctx.colliders, x, floorY, z, cw, 2.8, cd, 0, 'wood');
  const colRef = ctx.colliders[ctx.colliders.length - 1];
  const origMinX = colRef.minX;
  const origMaxX = colRef.maxX;

  let isOpen = false;
  let openAmt = 0;

  ctx.interactables.push({
    id: `mansion_door_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Math.round(floorY)}`,
    x,
    y: floorY,
    z,
    radius: 2.8,
    category: 'door',
    getLabel: () => (isOpen ? `Close ${label} Door` : `Open ${label} Door`),
    trigger: () => {
      isOpen = !isOpen;
      return `${label} door ${isOpen ? 'opened' : 'closed'}`;
    },
  });

  ctx.updaters.push((dt) => {
    const tgt = isOpen ? 1 : 0;
    if (Math.abs(tgt - openAmt) > 0.004) {
      openAmt += (tgt - openAmt) * Math.min(1, dt * 7.5);
      hinge.rotation.y = -openAmt * 1.48;
      if (openAmt > 0.55) {
        colRef.minX = 99999;
        colRef.maxX = 99998;
      } else {
        colRef.minX = origMinX;
        colRef.maxX = origMaxX;
      }
    }
  });
}

/**
 * Helper to register a walkable slab (both floor ramp & ceiling collider beneath it)
 */
function addWalkableSlab(
  pb: PropMeshAssembler,
  ramps: RampSurface[],
  colliders: ColliderBox[],
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  surfaceY: number,
  hex: number,
  thickness = 0.34,
  style: 'solid' | 'glossy' | 'glass' = 'solid',
) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  pb.addBox(cx, surfaceY - thickness * 0.5, cz, w, thickness, d, hex, style);
  ramps.push({
    minX,
    maxX,
    minZ,
    maxZ,
    axis: 'x',
    startCoord: minX,
    endCoord: maxX,
    startY: surfaceY,
    endY: surfaceY,
  });
  // Underside ceiling/head-bump collider (keeps gap above floor below)
  addCollider(colliders, cx, surfaceY - thickness - 0.02, cz, w, thickness - 0.04, d, 0, 'concrete');
}

/**
 * Adds a thin wire-like glowing LED strip registered into `ctx.nightGlowMats`
 * so the mansion comes alive with crisp colorful illumination at sunset & night.
 */
function addWireLedStrip(
  parent: THREE.Object3D,
  boxGeo: THREE.BoxGeometry,
  mat: THREE.MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  rotY = 0,
) {
  const scaled = computeWireLedScale(w, h, d);
  const m = new THREE.Mesh(boxGeo, mat);
  m.position.set(x, y, z);
  m.scale.set(scaled.w, scaled.h, scaled.d);
  if (rotY !== 0) m.rotation.y = rotY;
  parent.add(m);
  return m;
}

/**
 * Builds both Grand Staircases, Gun Collection Wall, F1 Double-Height Lobby,
 * F2 Bedrooms & Luxury Bath, F3 Cinema/RGB Gaming/Gym/Office, and F4 Rooftop Hex Helipad.
 */
export function buildMansionInteriorsAndRooftop(
  ctx: SimWorldBuildContext,
  nightLedPalette: {
    gold: THREE.MeshStandardMaterial;
    cyan: THREE.MeshStandardMaterial;
    violet: THREE.MeshStandardMaterial;
    emerald: THREE.MeshStandardMaterial;
    warmWhite: THREE.MeshStandardMaterial;
  },
): MansionInteriorResult {
  const root = new THREE.Group();
  ctx.arenaGroup.add(root);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  ctx.geometries.push(boxGeo, cylGeo);

  const mkStd = (
    color: number,
    roughness: number,
    metalness = 0.08,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {},
  ) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    ctx.materials.push(m);
    return m;
  };

  const tex = ctx.textures;
  const whiteMarbleMat = mkStd(0xf5f2ec, 0.24, 0.08, {
    ...(tex?.mallMarbleTile ? { map: tex.mallMarbleTile } : {}),
  });
  const oakWoodMat = mkStd(0x8b5732, 0.58, 0.06, {
    ...(tex?.woodPlank ? { map: tex.woodPlank } : {}),
  });
  const charcoalMat = mkStd(0x1f242d, 0.45, 0.42);
  const brushedGoldMat = mkStd(0xd99b26, 0.24, 0.82);
  const creamFabricMat = mkStd(0xf3ece0, 0.85, 0.02);
  const glassRailMat = mkStd(0xbae6fd, 0.08, 0.22, {
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const mirrorMat = mkStd(0xdbeafe, 0.04, 0.96);

  const pb = new PropMeshAssembler();
  const roomLightMats: THREE.MeshStandardMaterial[] = [
    nightLedPalette.gold,
    nightLedPalette.cyan,
    nightLedPalette.violet,
    nightLedPalette.emerald,
    nightLedPalette.warmWhite,
  ];
  const animatedUpdaters: Array<(dt: number, elapsed: number) => void> = [];

  // =========================================================================
  // 1. FLOOR SLABS WITH STAIRWELL CUTOUTS (F2 FULL GLASS, F3 FULL MARBLE)
  // =========================================================================
  // Building footprint: x in [-44..44], z in [-388..-324]
  // Staircase 1 Curved Opening on F2: x in [-14.2..-5.5], z in [-359.1..-349.5]
  // Staircase 2 East L-Shaft Void on F2, F3, F4: x in [20..30], z in [-374..-352]
  const F2_Y = MANSION_LEVEL_2_Y; // 5.8
  const F3_Y = MANSION_LEVEL_3_Y; // 11.6
  const F4_Y = MANSION_ROOF_Y; // 17.4

  // --- GROUND FLOOR MARBLE BASE (y = 0.14, cleanly above 0.05 exterior turf) ---
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, -44, 44, -388, -324, 0.14, 0xf2eee6, 0.24, 'glossy');

  // --- LEVEL 2 DECK SLABS (y = 5.8): FULL TEMPERED WALKABLE GLASS COVERING ENTIRE F2 EXCEPT STAIR CUTOUTS ---
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, -44, -14.2, -388, -324, F2_Y, 0xbbe6fc, 0.34, 'glass');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, -14.2, -5.5, -388, -359.1, F2_Y, 0xbbe6fc, 0.34, 'glass');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, -14.2, -5.5, -349.5, -324, F2_Y, 0xbbe6fc, 0.34, 'glass');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, -5.5, 20, -388, -324, F2_Y, 0xbbe6fc, 0.34, 'glass');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20, 30, -388, -374, F2_Y, 0xbbe6fc, 0.34, 'glass');
  // Seal ceiling over F1->F2 Flight A & north landing (leaves Flight B [25.2..30, -365..-352] open for climb)
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20, 25.0, -374, -352, F2_Y, 0xbbe6fc, 0.34, 'glass');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 25.0, 30, -374, -365.5, F2_Y, 0xbbe6fc, 0.34, 'glass');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20, 30, -352, -324, F2_Y, 0xbbe6fc, 0.34, 'glass');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 30, 44, -388, -324, F2_Y, 0xbbe6fc, 0.34, 'glass');
  // Front South Glass Balcony Deck (overhangs outside facade z in [-324..-318])
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, -44, -16, -324, -318, F2_Y, 0xbbe6fc, 0.3, 'glass');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 16, 44, -324, -318, F2_Y, 0xbbe6fc, 0.3, 'glass');

  // Glass safety balustrades framing ONLY Stair 1 entry opening [-14.2..-5.5, -359.1..-349.5]
  pb.addBox(-14.2, F2_Y + 0.56, -354.3, 0.12, 1.12, 9.6, 0xbae6fd, 'glass');
  addCollider(ctx.colliders, -14.2, F2_Y, -354.3, 0.25, 1.15, 9.6);
  pb.addBox(-5.5, F2_Y + 0.56, -354.3, 0.12, 1.12, 9.6, 0xbae6fd, 'glass');
  addCollider(ctx.colliders, -5.5, F2_Y, -354.3, 0.25, 1.15, 9.6);
  pb.addBox(-9.85, F2_Y + 0.56, -349.5, 8.7, 1.12, 0.12, 0xbae6fd, 'glass');
  addCollider(ctx.colliders, -9.85, F2_Y, -349.5, 8.7, 1.15, 0.25);
  addWireLedStrip(root, boxGeo, nightLedPalette.cyan, -9.85, F2_Y + 0.24, -359.1, 8.8, 0.045, 0.045);

  // --- LEVEL 3 DECK SLABS (y = 11.6): FULL CARRARA MARBLE COVERING ENTIRE 3RD FLOOR & FRONT STAIRWELL CEILING ---
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, -44, 20, -388, -324, F3_Y, 0xf3efe8, 0.34, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20, 44, -388, -374, F3_Y, 0xf3efe8, 0.34, 'glossy');
  // Seal ceiling over 2F->3F stairs front/Flight A & north landing (leaves Flight B [25.0..30, -365.5..-352] open to step onto 3F)
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20, 25.0, -374, -352, F3_Y, 0xf3efe8, 0.34, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 25.0, 30, -374, -365.5, F3_Y, 0xf3efe8, 0.34, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 30, 44, -374, -352, F3_Y, 0xf3efe8, 0.34, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20, 44, -352, -324, F3_Y, 0xf3efe8, 0.34, 'glossy');
  // F3 Sky Terrace Balconies
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, -44, -14, -324, -318, F3_Y, 0x262b35, 0.3, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 14, 44, -324, -318, F3_Y, 0x262b35, 0.3, 'glossy');

  // --- LEVEL 4 ROOFTOP DECK (y = 17.4) ---
  // Sealed rooftop marble/slate terrace leaving Staircase 2 exit opening [25.0..30, -365.5..-352]
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, -44, 20, -388, -324, F4_Y, 0x262b35, 0.38, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20, 44, -388, -374, F4_Y, 0x262b35, 0.38, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20, 25.0, -374, -352, F4_Y, 0x262b35, 0.38, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 25.0, 30, -374, -365.5, F4_Y, 0x262b35, 0.38, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 30, 44, -374, -352, F4_Y, 0x262b35, 0.38, 'glossy');
  addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20, 44, -352, -324, F4_Y, 0x262b35, 0.38, 'glossy');

  // =========================================================================
  // 2. STAIRCASE 1: GRAND CURVED OAK + BLACK VERTICAL STEEL SPINDLES (F1 <-> F2)
  // =========================================================================
  {
    const stairCenterX = -8.2;
    const stairCenterZ = -355.0;
    const innerR = 2.6;
    const outerR = 5.6;
    const midR = (innerR + outerR) * 0.5; // 4.1m
    const stepCount = 25;
    const startAngle = Math.PI * 0.42; // starts near south-west lobby
    const totalSweep = Math.PI * 1.05; // sweeps gracefully up to F2 north mezzanine landing (-11.5, -364)

    const spindleGeo = new THREE.CylinderGeometry(0.024, 0.024, 1, 6);
    ctx.geometries.push(spindleGeo);
    const spindleTransforms: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < stepCount; i++) {
      const t0 = i / stepCount;
      const t1 = (i + 1) / stepCount;
      const angMid = startAngle + (t0 + t1) * 0.5 * totalSweep;
      const stepY = 0.14 + ((i + 0.5) / stepCount) * (F2_Y - 0.14);
      const treadW = outerR - innerR;
      const arcStep = ((midR * totalSweep) / stepCount) * 1.18;

      const sx = stairCenterX + Math.cos(angMid) * midR;
      const sz = stairCenterZ + Math.sin(angMid) * midR;

      // Oak step tread
      const tread = new THREE.Mesh(boxGeo, oakWoodMat);
      tread.position.set(sx, stepY, sz);
      tread.rotation.y = -angMid;
      tread.scale.set(treadW, 0.14, arcStep);
      tread.castShadow = !ctx.isSoftwareGl;
      tread.receiveShadow = true;
      root.add(tread);

      // Curved black steel underside spine beam
      const soffit = new THREE.Mesh(boxGeo, charcoalMat);
      soffit.position.set(sx, stepY - 0.14, sz);
      soffit.rotation.y = -angMid;
      soffit.scale.set(treadW * 0.82, 0.16, arcStep * 1.08);
      root.add(soffit);

      // Outer & inner vertical steel spindles up to F2 soffit or handrail (Ref 1 signature silhouette!)
      [innerR + 0.12, outerR - 0.12].forEach((rVal, sideIdx) => {
        const px = stairCenterX + Math.cos(angMid) * rVal;
        const pz = stairCenterZ + Math.sin(angMid) * rVal;
        const railTop = Math.min(F2_Y + 1.08, stepY + 1.08);
        const h = sideIdx === 0 && i > 10 ? F2_Y + 1.08 - stepY : 1.08;
        dummy.position.set(px, stepY + h * 0.5, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        spindleTransforms.push(dummy.matrix.clone());

        // Curved oak handrail segment along top of spindles
        const hSeg = new THREE.Mesh(boxGeo, oakWoodMat);
        hSeg.position.set(px, railTop + 0.04, pz);
        hSeg.rotation.y = -angMid;
        hSeg.scale.set(0.09, 0.07, ((rVal * totalSweep) / stepCount) * 1.25);
        root.add(hSeg);
      });

      // Continuous walkable ramp segment connecting tread i -> i+1 cleanly
      const nextX = stairCenterX + Math.cos(startAngle + t1 * totalSweep) * midR;
      const nextZ = stairCenterZ + Math.sin(startAngle + t1 * totalSweep) * midR;
      const prevX = stairCenterX + Math.cos(startAngle + t0 * totalSweep) * midR;
      const prevZ = stairCenterZ + Math.sin(startAngle + t0 * totalSweep) * midR;
      const minRX = Math.min(prevX, nextX) - 1.55;
      const maxRX = Math.max(prevX, nextX) + 1.55;
      const minRZ = Math.min(prevZ, nextZ) - 1.55;
      const maxRZ = Math.max(prevZ, nextZ) + 1.55;
      const useZ = Math.abs(nextZ - prevZ) >= Math.abs(nextX - prevX);
      ctx.ramps.push({
        minX: minRX,
        maxX: maxRX,
        minZ: minRZ,
        maxZ: maxRZ,
        axis: useZ ? 'z' : 'x',
        startCoord: useZ ? prevZ : prevX,
        endCoord: useZ ? nextZ : nextX,
        startY: 0.14 + t0 * (F2_Y - 0.14),
        endY: 0.14 + t1 * (F2_Y - 0.14),
      });

      // Curved side-guard colliders along inner and outer balusters (skip extreme start/end step for clean entry/exit)
      if (i >= 1 && i <= stepCount - 2) {
        [innerR - 0.04, outerR + 0.04].forEach((guardR) => {
          const gx = stairCenterX + Math.cos(angMid) * guardR;
          const gz = stairCenterZ + Math.sin(angMid) * guardR;
          const arcLen = Math.max(0.45, ((guardR * totalSweep) / stepCount) * 1.25);
          addCollider(ctx.colliders, gx, stepY - 0.08, gz, 0.22, 1.38, arcLen, -angMid, 'metal');
        });
      }
    }

    // Thin glowing gold LED wire under the curved staircase underside!
    for (let i = 0; i < stepCount; i += 2) {
      const ang = startAngle + ((i + 0.5) / stepCount) * totalSweep;
      const stepY = 0.22 + ((i + 0.5) / stepCount) * (F2_Y - 0.28);
      addWireLedStrip(
        root,
        boxGeo,
        nightLedPalette.gold,
        stairCenterX + Math.cos(ang) * outerR,
        stepY - 0.16,
        stairCenterZ + Math.sin(ang) * outerR,
        0.04,
        0.04,
        ((outerR * totalSweep) / stepCount) * 2.1,
        -ang,
      );
    }

    // Instanced spindles (zero extra draw call bloat for 6GB RAM Android)
    const spindleIm = new THREE.InstancedMesh(spindleGeo, charcoalMat, spindleTransforms.length);
    for (let i = 0; i < spindleTransforms.length; i++) {
      spindleIm.setMatrixAt(i, spindleTransforms[i]);
    }
    spindleIm.instanceMatrix.needsUpdate = true;
    root.add(spindleIm);
  }

  // =========================================================================
  // 3. STAIRCASE 2: MODERN L-SHAPED OAK & GLASS BALUSTRADE SHAFT (F1 -> F2 -> F3 -> F4)
  // =========================================================================
  {
    const buildFlight = (
      xMid: number,
      zStart: number,
      zEnd: number,
      y0: number,
      y1: number,
      width: number,
    ) => {
      const steps = 15;
      const dz = (zEnd - zStart) / steps;
      const minStepY = y0 === 0 ? 0.20 : y0 + 0.12;
      const topStepY = y1 - 0.04;
      for (let i = 0; i < steps; i++) {
        const sy = minStepY + (i / (steps - 1)) * (topStepY - minStepY);
        const sz = zStart + (i + 0.5) * dz;
        const tread = new THREE.Mesh(boxGeo, oakWoodMat);
        tread.position.set(xMid, sy, sz);
        tread.scale.set(width, 0.12, Math.abs(dz) * 1.14);
        tread.castShadow = !ctx.isSoftwareGl;
        tread.receiveShadow = true;
        root.add(tread);
      }
      // Solid sloped structural underside soffit + glass balustrades + oak top rail
      const midZ = (zStart + zEnd) * 0.5;
      const spanZ = Math.abs(zEnd - zStart);
      const midY = (y0 + y1) * 0.5;
      const slopeAngle = Math.atan2(y1 - y0, spanZ);
      const diagLen = Math.hypot(spanZ, y1 - y0);
      const soffitSlab = new THREE.Mesh(boxGeo, charcoalMat);
      soffitSlab.position.set(xMid, midY - 0.12, midZ);
      soffitSlab.scale.set(width * 0.94, 0.16, diagLen);
      soffitSlab.rotation.x = zEnd < zStart ? slopeAngle : -slopeAngle;
      root.add(soffitSlab);

      [-width * 0.5 - 0.04, width * 0.5 + 0.04].forEach((ox) => {
        const rail = new THREE.Mesh(boxGeo, oakWoodMat);
        rail.position.set(xMid + ox, midY + 1.05, midZ);
        rail.scale.set(0.08, 0.07, diagLen);
        rail.rotation.x = zEnd < zStart ? slopeAngle : -slopeAngle;
        root.add(rail);

        const glass = new THREE.Mesh(boxGeo, glassRailMat);
        glass.position.set(xMid + ox, midY + 0.52, midZ);
        glass.scale.set(0.04, 0.96, diagLen);
        glass.rotation.x = rail.rotation.x;
        root.add(glass);

        addWireLedStrip(root, boxGeo, nightLedPalette.cyan, xMid + ox, midY + 0.04, midZ, 0.03, 0.03, diagLen, 0)
          .rotation.x = rail.rotation.x;
      });
      ctx.ramps.push({
        minX: xMid - width * 0.5,
        maxX: xMid + width * 0.5,
        minZ: Math.min(zStart, zEnd) - 0.4,
        maxZ: Math.max(zStart, zEnd) + 0.4,
        axis: 'z',
        startCoord: zStart,
        endCoord: zEnd,
        startY: y0,
        endY: y1,
      });
      addStairSideGuardColliders(ctx.colliders, {
        axis: 'z',
        centerCoord: xMid,
        startCoord: zStart,
        endCoord: zEnd,
        yBottom: y0,
        yTop: y1,
        width,
        railSides: 'both',
      });
    };

    // 3 double-flight runs inside shaft x in [20..30], z in [-374..-352]
    const levels = [0, F2_Y, F3_Y, F4_Y];
    for (let fl = 0; fl < 3; fl++) {
      const yBase = levels[fl];
      const yMid = yBase + MANSION_FLOOR_HEIGHT * 0.5;
      const yTop = levels[fl + 1];
      // Flight A: Northward along x=22.4 (z = -352.5 -> -369.0)
      buildFlight(22.4, -352.5, -369.0, yBase, yMid, 3.2);
      // Mid-landing across shaft north end (z in [-374..-369], x in [20..30])
      addWalkableSlab(pb, ctx.ramps, ctx.colliders, 20.2, 29.8, -373.8, -369.0, yMid, 0xe8dfd3, 0.24);
      // Flight B: Southward along x=27.6 (z = -369.0 -> -352.5)
      buildFlight(27.6, -369.0, -352.5, yMid, yTop, 3.2);
    }

    // Rooftop Stairwell Glass Safety Railings around exit cutout [25.0..30, -365.5..-352]
    addSolidWall(pb, ctx.colliders, 25.0, F4_Y + 0.6, -358.75, 0.22, 1.2, 13.5, 0xbae6fd, 'glass');
    addSolidWall(pb, ctx.colliders, 30.0, F4_Y + 0.6, -358.75, 0.22, 1.2, 13.5, 0xbae6fd, 'glass');
    addSolidWall(pb, ctx.colliders, 27.5, F4_Y + 0.6, -365.5, 5.0, 1.2, 0.22, 0xbae6fd, 'glass');
  }

  // =========================================================================
  // 4. FLOOR 1: DOUBLE-HEIGHT GRAND LUXURY LOBBY & SPECIAL GUN COLLECTION WALL
  // =========================================================================
  {
    const L = MAIN_HALL_LOUNGE_LAYOUT;
    // Ornate circular woven cream & gold rug + sweeping curved cream luxury sofa grouped right near the Lobby TV
    const rug = new THREE.Mesh(cylGeo, creamFabricMat);
    rug.position.set(L.rugX, 0.16, L.rugZ);
    rug.scale.set(9.4, 0.04, 9.4);
    root.add(rug);

    // Curved 9-segment luxury linen sofa PROPERLY FACING +X (toward Lobby HDR TV ~7.25m away)
    const linenSeatMat = mkStd(0xd8cfc4, 0.86, 0.02);
    const linenPillowTerracotta = mkStd(0xc26d47, 0.85, 0.02);
    const linenPillowSlate = mkStd(0x64748b, 0.85, 0.02);
    for (let s = 0; s < 9; s++) {
      const ang = -Math.PI * 0.52 + (s / 8) * Math.PI * 1.04;
      const cosA = Math.cos(ang + Math.PI); // negative (West -X arc)
      const sinA = Math.sin(ang + Math.PI);
      const rx = L.sofaArcCenterX + cosA * L.sofaArcRadius;
      const rz = L.sofaZ + sinA * L.sofaArcRadius;
      // Oak base frame
      const frameBase = new THREE.Mesh(boxGeo, oakWoodMat);
      frameBase.position.set(rx, 0.24, rz);
      frameBase.rotation.y = -ang;
      frameBase.scale.set(0.95, 0.16, 1.08);
      // Warm oatmeal linen cushion facing inward (+X)
      const seg = new THREE.Mesh(boxGeo, linenSeatMat);
      seg.position.set(rx, 0.44, rz);
      seg.rotation.y = -ang;
      seg.scale.set(0.92, 0.28, 1.04);
      // Backrest mounted on OUTER (-X) arc so sofa opens toward +X TV!
      const back = new THREE.Mesh(boxGeo, linenSeatMat);
      back.position.set(rx + cosA * 0.42, 0.78, rz + sinA * 0.42);
      back.rotation.y = -ang;
      back.scale.set(0.26, 0.54, 1.04);
      // Decorative throw pillow leaning against backrest
      const pillow = new THREE.Mesh(boxGeo, s % 2 === 0 ? linenPillowTerracotta : linenPillowSlate);
      pillow.position.set(rx + cosA * 0.22, 0.74, rz + sinA * 0.22);
      pillow.rotation.y = -ang;
      pillow.rotation.z = 0.18;
      pillow.scale.set(0.14, 0.36, 0.42);
      root.add(frameBase, seg, back, pillow);
    }
    // Round travertine & walnut center coffee table + ceramic vase & greenery between Sofa and TV
    const coffeeTbl = new THREE.Mesh(cylGeo, whiteMarbleMat);
    coffeeTbl.position.set(L.coffeeTableX, 0.4, L.coffeeTableZ);
    coffeeTbl.scale.set(1.85, 0.34, 1.85);
    const vase = new THREE.Mesh(cylGeo, brushedGoldMat);
    vase.position.set(L.coffeeTableX, 0.72, L.coffeeTableZ);
    vase.scale.set(0.24, 0.34, 0.24);
    const flowerCluster = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), mkStd(0xf43f5e, 0.6, 0.02));
    flowerCluster.position.set(L.coffeeTableX, 0.98, L.coffeeTableZ);
    root.add(coffeeTbl, vase, flowerCluster);
    addCollider(ctx.colliders, L.coffeeTableX, 0, L.coffeeTableZ, 1.95, 0.8, 1.95);

    // Interactive Sofa Sitting Spots along Main Hall Curved Sofa (facing +X toward HDR Lobby TV)
    ctx.mansionSeats = ctx.mansionSeats ?? [];
    const hallSofaSeats = [
      { id: 'mansion_sofa_center', label: 'Sit on Luxury Sofa', x: L.sofaCenterSeatX, y: 0.44, z: L.sofaZ, yaw: -Math.PI * 0.5 },
      { id: 'mansion_sofa_north', label: 'Sit on Luxury Sofa', x: L.sofaNorthSeatX, y: 0.44, z: L.sofaNorthSeatZ, yaw: -Math.PI * 0.35 },
    ];
    hallSofaSeats.forEach((ss) => {
      ctx.mansionSeats!.push({
        id: ss.id,
        label: ss.label,
        kind: 'sofa',
        x: ss.x,
        y: ss.y,
        z: ss.z,
        yaw: ss.yaw,
        canRotateChair: false,
      });
      ctx.interactables.push({
        id: ss.id,
        x: ss.x,
        y: 0.14,
        z: ss.z,
        radius: 2.6,
        category: 'seat',
        getLabel: () => ss.label,
        trigger: () => 'Seated on Luxury Hall Sofa',
      });
    });

    // Reference Prop: Rattan & Light-Oak Modern Credenza Sideboard + Ceramic Vases against South-West Foyer
    const cabinetGroup = new THREE.Group();
    cabinetGroup.position.set(-11.2, 0.14, -327.2);
    const cabBody = new THREE.Mesh(boxGeo, oakWoodMat);
    cabBody.position.set(0, 0.62, 0);
    cabBody.scale.set(2.4, 0.76, 0.68);
    const cabRattan = new THREE.Mesh(boxGeo, mkStd(0xc29b61, 0.78, 0.02));
    cabRattan.position.set(0.35, 0.62, 0.35);
    cabRattan.scale.set(1.45, 0.64, 0.04);
    const cerVaseA = new THREE.Mesh(cylGeo, whiteMarbleMat);
    cerVaseA.position.set(-0.6, 1.24, 0);
    cerVaseA.scale.set(0.28, 0.48, 0.28);
    const cerVaseB = new THREE.Mesh(cylGeo, mkStd(0xd6d3d1, 0.65, 0.04));
    cerVaseB.position.set(-0.22, 1.32, 0.05);
    cerVaseB.scale.set(0.22, 0.64, 0.22);
    cabinetGroup.add(cabBody, cabRattan, cerVaseA, cerVaseB);
    root.add(cabinetGroup);
    addCollider(ctx.colliders, -11.2, 0.14, -327.2, 2.5, 1.1, 0.75);

    // Interactive Giant Lobby HDR Video TV (mounted on decorative 3D fluted walnut media wall right in front of sofa!)
    pb.addBox(L.tvMediaWallX, 2.8, L.tvZ, 0.45, 5.4, 9.6, 0x1e293b);
    addCollider(ctx.colliders, L.tvMediaWallX, 0, L.tvZ, 0.55, 5.4, 9.6);
    for (let fl = -4.2; fl <= 4.2; fl += 0.55) {
      pb.addBox(L.tvSlatsX, 2.8, L.tvZ + fl, 0.14, 5.1, 0.18, 0x6b4226);
    }
    pb.addBox(L.tvBezelX, 2.85, L.tvZ, 0.14, 2.84, 5.04, 0x0f172a);
    const { material: lobbyTvMat, entry: lobbyTvEntry } = ctx.displays.createVideoDisplayMaterial(
      MAIN_SCREEN_VIDEO_PLAYLIST,
      'car_second_lcd',
      {
        title: 'MAIN SCREEN VIDEO',
        subtitle: 'MAIN SCREEN VIDEO · MAIN HALL TV',
        accentHex: '#38bdf8',
        width: 640,
        height: 360,
        intervalSec: 0.033,
        worldPos: { x: L.tvScreenX, y: 2.85, z: L.tvZ },
        audioMode: 'world',
        maxAudioVolume: 0.13,
        audioRangeMeters: 20,
      },
    );
    const lobbyTvMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 2.7), lobbyTvMat);
    lobbyTvMesh.position.set(L.tvScreenX, 2.85, L.tvZ);
    lobbyTvMesh.rotation.y = -Math.PI * 0.5;
    root.add(lobbyTvMesh);
    addWireLedStrip(root, boxGeo, nightLedPalette.cyan, L.tvBezelX - 0.04, 4.35, L.tvZ, 0.04, 0.04, 5.2);
    addWireLedStrip(root, boxGeo, nightLedPalette.cyan, L.tvBezelX - 0.04, 1.35, L.tvZ, 0.04, 0.04, 5.2);
    let tvChannelOn = true;
    ctx.interactables.push({
      id: 'mansion_lobby_tv',
      x: L.tvInteractX,
      y: 0,
      z: L.tvZ,
      radius: 3.4,
      category: 'shop',
      getLabel: () => (tvChannelOn ? 'Turn Off Main Screen Video TV' : 'Turn On Main Screen Video TV'),
      trigger: () => {
        tvChannelOn = !tvChannelOn;
        lobbyTvMesh.visible = tvChannelOn;
        lobbyTvEntry.disabled = !tvChannelOn;
        return `Main Screen Video TV turned ${tvChannelOn ? 'ON' : 'OFF'}`;
      },
    });

    // ---- INTERIOR GALLERY PROPS IN F1 FOYER & HALLWAYS ----
    // Framed paintings, wall mirrors, bookshelves, side tables, lamps & potted house plants
    const artPalette = [0xb45309, 0x0e7490, 0x7c3aed, 0xbe123c, 0x047857];
    const addFramedPainting = (parent: THREE.Object3D, px: number, py: number, pz: number, rotY: number, w: number, h: number, artIdx: number) => {
      const grp = new THREE.Group();
      grp.position.set(px, py, pz);
      grp.rotation.y = rotY;
      const frame = new THREE.Mesh(boxGeo, brushedGoldMat);
      frame.scale.set(w + 0.14, h + 0.14, 0.06);
      const canvas = new THREE.Mesh(boxGeo, mkStd(artPalette[artIdx % artPalette.length], 0.65, 0.04));
      canvas.position.z = 0.02;
      canvas.scale.set(w, h, 0.04);
      const accent = new THREE.Mesh(boxGeo, brushedGoldMat);
      accent.position.set(w * 0.12, h * 0.08, 0.045);
      accent.scale.set(w * 0.42, h * 0.36, 0.02);
      grp.add(frame, canvas, accent);
      parent.add(grp);
    };
    const addPlantPot = (parent: THREE.Object3D, px: number, py: number, pz: number, scale = 1.0) => {
      const pot = new THREE.Mesh(cylGeo, mkStd(0x9a5b3c, 0.72, 0.04));
      pot.position.set(px, py + 0.28 * scale, pz);
      pot.scale.set(0.46 * scale, 0.56 * scale, 0.46 * scale);
      const soil = new THREE.Mesh(cylGeo, charcoalMat);
      soil.position.set(px, py + 0.52 * scale, pz);
      soil.scale.set(0.4 * scale, 0.06 * scale, 0.4 * scale);
      const leafMat = mkStd(0x15803d, 0.62, 0.02);
      parent.add(pot, soil);
      for (let l = 0; l < 5; l++) {
        const frond = new THREE.Mesh(boxGeo, leafMat);
        const a = (l / 5) * Math.PI * 2;
        frond.position.set(px + Math.cos(a) * 0.18 * scale, py + (0.78 + (l % 2) * 0.14) * scale, pz + Math.sin(a) * 0.18 * scale);
        frond.rotation.set(Math.sin(a) * 0.45, a, Math.cos(a) * 0.45);
        frond.scale.set(0.14 * scale, 0.52 * scale, 0.05 * scale);
        parent.add(frond);
      }
    };
    const addBookshelf = (parent: THREE.Object3D, bx: number, by: number, bz: number, rotY: number) => {
      const sg = new THREE.Group();
      sg.position.set(bx, by, bz);
      sg.rotation.y = rotY;
      const back = new THREE.Mesh(boxGeo, oakWoodMat);
      back.position.set(0, 1.1, -0.18);
      back.scale.set(1.5, 2.2, 0.06);
      const sideL = new THREE.Mesh(boxGeo, oakWoodMat);
      sideL.position.set(-0.72, 1.1, 0);
      sideL.scale.set(0.06, 2.2, 0.42);
      const sideR = sideL.clone();
      sideR.position.x = 0.72;
      sg.add(back, sideL, sideR);
      const bookCols = [0xdc2626, 0x2563eb, 0xf59e0b, 0x059669, 0x7c3aed, 0xf8fafc];
      for (let sh = 0; sh < 4; sh++) {
        const plank = new THREE.Mesh(boxGeo, oakWoodMat);
        plank.position.set(0, 0.25 + sh * 0.58, 0);
        plank.scale.set(1.42, 0.05, 0.4);
        sg.add(plank);
        for (let b = 0; b < 5; b++) {
          const bk = new THREE.Mesh(boxGeo, mkStd(bookCols[(sh * 3 + b) % bookCols.length], 0.65, 0.04));
          bk.position.set(-0.46 + b * 0.22, 0.43 + sh * 0.58, 0);
          bk.scale.set(0.08, 0.28 + (b % 2) * 0.06, 0.26);
          sg.add(bk);
        }
      }
      parent.add(sg);
    };

    // F1 Foyer paintings, mirror, reading bookshelf, side lamps & potted plants
    addFramedPainting(root, -15.6, 2.7, -334, Math.PI * 0.5, 2.2, 1.4, 0);
    addFramedPainting(root, MAIN_HALL_LOUNGE_LAYOUT.tvMediaWallX + 0.3, 2.7, MAIN_HALL_LOUNGE_LAYOUT.tvZ, Math.PI * 0.5, 2.4, 1.6, 1);
    const foyerMirror = new THREE.Mesh(cylGeo, mirrorMat);
    foyerMirror.position.set(-15.72, 2.4, -352);
    foyerMirror.rotation.z = Math.PI * 0.5;
    foyerMirror.scale.set(1.3, 0.06, 0.9);
    root.add(foyerMirror);
    addBookshelf(root, -14.8, 0.14, -357, Math.PI * 0.5);
    addPlantPot(root, -13.6, 0.14, -327, 1.25);
    addPlantPot(root, 13.6, 0.14, -327, 1.25);
    addPlantPot(root, MAIN_HALL_LOUNGE_LAYOUT.tvScreenX, 0.14, MAIN_HALL_LOUNGE_LAYOUT.tvZ - 5.4, 1.15);
    addPlantPot(root, MAIN_HALL_LOUNGE_LAYOUT.tvScreenX, 0.14, MAIN_HALL_LOUNGE_LAYOUT.tvZ + 5.4, 1.15);

    // Ground Floor Crystal & Gold Chandeliers hanging cleanly BELOW F2_Y (5.8m) glass ceiling
    [-334, -349].forEach((cz) => {
      const rod = new THREE.Mesh(cylGeo, brushedGoldMat);
      rod.position.set(0, 5.1, cz);
      rod.scale.set(0.08, 1.15, 0.08);
      const ringOuter = new THREE.Mesh(cylGeo, nightLedPalette.warmWhite);
      ringOuter.position.set(0, 4.48, cz);
      ringOuter.scale.set(3.2, 0.16, 3.2);
      const ringInner = new THREE.Mesh(cylGeo, brushedGoldMat);
      ringInner.position.set(0, 4.12, cz);
      ringInner.scale.set(1.9, 0.14, 1.9);
      root.add(rod, ringOuter, ringInner);
    });

    // Ground Floor Glass Ceiling Underside Cove Wire LEDs (y = 5.05) + Upper Floor Wing Glow Wires (safely clear of slab edges)
    addWireLedStrip(root, boxGeo, nightLedPalette.warmWhite, 0, 5.05, -327, 26, 0.08, 0.08);
    addWireLedStrip(root, boxGeo, nightLedPalette.warmWhite, 0, 5.05, -361, 26, 0.08, 0.08);
    addWireLedStrip(root, boxGeo, nightLedPalette.gold, -13, 5.05, -344, 0.08, 0.08, 34);
    addWireLedStrip(root, boxGeo, nightLedPalette.gold, 13, 5.05, -344, 0.08, 0.08, 34);
    // Warm recessed wing ceiling strips visible from courtyard through floor-to-ceiling glass
    [-29, 29].forEach((wingX) => {
      addWireLedStrip(root, boxGeo, nightLedPalette.warmWhite, wingX, 4.95, -334, 20, 0.08, 0.14);
      addWireLedStrip(root, boxGeo, nightLedPalette.warmWhite, wingX, F2_Y + 4.95, -334, 20, 0.08, 0.14);
      addWireLedStrip(root, boxGeo, nightLedPalette.cyan, wingX, F3_Y + 4.95, -334, 20, 0.08, 0.14);
    });

    // ---- SPECIAL PRIVATE GUN COLLECTION DISPLAY WALL (East F1 Wing: x=33..43, z=-346..-328) ----
    // Purely visual museum-grade glass & backlit B&W cabinetry (zero alteration to gameplay loadout!)
    pb.addBox(42.8, 2.8, -337, 0.6, 5.4, 16.5, 0x11151d); // Matte obsidian back panel
    addCollider(ctx.colliders, 42.8, 0, -337, 0.8, 5.4, 16.5);
    for (let slot = 0; slot < 5; slot++) {
      const sz = -343 + slot * 3.0;
      const isWhiteBay = slot % 2 === 1;
      pb.addBox(42.3, 2.35, sz, 0.25, 3.6, 2.4, isWhiteBay ? 0xf8fafc : 0x1e293b);
      // Individual thin LED wire backlight frame around each weapon bay
      addWireLedStrip(root, boxGeo, slot % 2 === 0 ? nightLedPalette.gold : nightLedPalette.cyan, 42.15, 4.1, sz, 0.04, 0.04, 2.3);
      addWireLedStrip(root, boxGeo, slot % 2 === 0 ? nightLedPalette.gold : nightLedPalette.cyan, 42.15, 0.65, sz, 0.04, 0.04, 2.3);

      // Mounted Display Firearms (Assault Carbine, Gold Sniper, Chrome SMG, Tactical Shotgun, Gold Desert Pistol)
      const gunMat = slot % 2 === 0 ? brushedGoldMat : charcoalMat;
      const barrel = new THREE.Mesh(boxGeo, gunMat);
      barrel.position.set(42.0, 2.55, sz);
      barrel.scale.set(0.08, 0.09, slot === 1 ? 1.85 : slot === 4 ? 0.55 : 1.35);
      const receiver = new THREE.Mesh(boxGeo, charcoalMat);
      receiver.position.set(42.0, 2.45, sz + 0.12);
      receiver.scale.set(0.11, 0.22, slot === 4 ? 0.36 : 0.62);
      const grip = new THREE.Mesh(boxGeo, brushedGoldMat);
      grip.position.set(42.0, 2.22, sz + 0.22);
      grip.scale.set(0.08, 0.24, 0.12);
      grip.rotation.x = 0.25;
      root.add(barrel, receiver, grip);

      // Glass protection case door
      const glassCase = new THREE.Mesh(boxGeo, glassRailMat);
      glassCase.position.set(41.55, 2.35, sz);
      glassCase.scale.set(0.05, 3.55, 2.35);
      root.add(glassCase);
    }
    ctx.interactables.push({
      id: 'mansion_gun_vault_inspect',
      x: 39.2,
      y: 0,
      z: -337,
      radius: 3.8,
      category: 'shop',
      getLabel: () => 'Inspect Private Collector Gun Wall',
      trigger: () => 'Private Collector Vault: Custom 24K Gold & Obsidian Display Editions (Display Only)',
    });

    // ---- WEST GROUND FLOOR: LUXURY DINING HALL & CHEF KITCHEN (x in [-42..-18], z in [-382..-330]) ----
    // Flush partition wall with Dining Hall door at (x=-16, z=-346) + full header lintel (zero gaps!)
    addSolidWall(pb, ctx.colliders, -16, 2.8, -367.425, 0.45, 5.6, 41.15, 0xf2eee6);
    addSolidWall(pb, ctx.colliders, -16, 2.8, -334.575, 0.45, 5.6, 21.15, 0xf2eee6);
    addSolidWall(pb, ctx.colliders, -16, 4.3, -346, 0.45, 2.8, 1.7, 0xf2eee6);
    createInteractiveInteriorDoor(
      ctx,
      root,
      -16,
      0,
      -346,
      Math.PI * 0.5,
      'Dining Hall',
      oakWoodMat,
      brushedGoldMat,
      charcoalMat,
      boxGeo,
    );

    // Marble 8-seater Dining Table + Dinnerware + Revolving Ceiling Fan + Kitchen Island + Stove + Cookware
    pb.addBox(-29, 0.85, -342, 3.2, 0.14, 7.6, 0xf8fafc, 'glossy');
    pb.addBox(-29, 0.4, -342, 1.4, 0.78, 5.4, 0x1e293b);
    addCollider(ctx.colliders, -29, 0, -342, 3.4, 1.0, 7.8);
    [-345, -343, -341, -339].forEach((cz) => {
      [-31.2, -26.8].forEach((cx) => {
        pb.addBox(cx, 0.45, cz, 0.55, 0.5, 0.55, 0x7c2d12);
        // Porcelain dinner plate & goblet
        const plate = new THREE.Mesh(cylGeo, whiteMarbleMat);
        plate.position.set(cx < -29 ? cx + 1.3 : cx - 1.3, 0.94, cz);
        plate.scale.set(0.36, 0.04, 0.36);
        root.add(plate);
      });
    });
    // Dining Ceiling Fan
    const diningFanHub = new THREE.Group();
    diningFanHub.position.set(-29, 5.25, -342);
    const fanMotor = new THREE.Mesh(cylGeo, brushedGoldMat);
    fanMotor.scale.set(0.45, 0.28, 0.45);
    diningFanHub.add(fanMotor);
    for (let fb = 0; fb < 4; fb++) {
      const blade = new THREE.Mesh(boxGeo, oakWoodMat);
      const a = (fb / 4) * Math.PI * 2;
      blade.position.set(Math.cos(a) * 0.95, 0.02, Math.sin(a) * 0.95);
      blade.rotation.y = -a;
      blade.scale.set(1.5, 0.04, 0.24);
      diningFanHub.add(blade);
    }
    root.add(diningFanHub);
    animatedUpdaters.push((_dt, elapsed) => {
      diningFanHub.rotation.y = elapsed * 2.8;
    });

    // Chef Waterfall Kitchen Island + Induction Stove & Sink + Stainless Hood & Wall Cabinets
    pb.addBox(-30, 0.96, -366, 7.4, 0.96, 1.5, 0xf8fafc, 'glossy');
    pb.addBox(-28.4, 1.46, -366, 1.6, 0.06, 1.0, 0x0f172a, 'glossy'); // Glass sink / induction zone
    pb.addBox(-31.8, 1.46, -366, 1.4, 0.06, 1.0, 0x111827); // 4-burner cooktop
    const potBody = new THREE.Mesh(cylGeo, charcoalMat);
    potBody.position.set(-31.8, 1.66, -366);
    potBody.scale.set(0.42, 0.32, 0.42);
    const espressoMach = new THREE.Mesh(boxGeo, charcoalMat);
    espressoMach.position.set(-26.8, 1.72, -366);
    espressoMach.scale.set(0.45, 0.52, 0.42);
    root.add(potBody, espressoMach);
    addCollider(ctx.colliders, -30, 0, -366, 7.4, 1.0, 1.5);
    pb.addBox(-30, 1.5, -384, 14.0, 3.0, 1.1, 0x262b35);
    pb.addBox(-30, 4.3, -384, 14.0, 1.1, 0.9, 0x334155); // Upper kitchen cabinets
    pb.addBox(-39, 1.35, -384, 2.0, 2.7, 1.2, 0x94a3b8, 'glossy'); // Stainless Double Fridge
    addFramedPainting(root, -42.5, 2.8, -342, Math.PI * 0.5, 2.4, 1.5, 2);
    addPlantPot(root, -41.5, 0.14, -328, 1.1);
  }

  // =========================================================================
  // 5. FLOOR 2 (y = 5.8) & FLOOR 3 (y = 11.6) ROOMS (LOD CULLED FOR 6GB RAM ANDROID)
  // =========================================================================
  const f2Detail = new THREE.Group();
  root.add(f2Detail);
  ctx.lodDetailGroups.push({ group: f2Detail, x: 0, y: F2_Y + 2.5, z: -356, radius: 46, maxDist: 68, tier: 'detail' });

  // F2 Master Bedroom Suite (West F2: x in [-43..-17], z in [-386..-326]) — Flush Walls + Lintel!
  addSolidWall(pb, ctx.colliders, -16.2, F2_Y + 2.8, -368.425, 0.4, 5.6, 39.15, 0xf3ece0);
  addSolidWall(pb, ctx.colliders, -16.2, F2_Y + 2.8, -335.575, 0.4, 5.6, 23.15, 0xf3ece0);
  addSolidWall(pb, ctx.colliders, -16.2, F2_Y + 4.3, -348, 0.4, 2.8, 1.7, 0xf3ece0);
  createInteractiveInteriorDoor(ctx, root, -16.2, F2_Y, -348, Math.PI * 0.5, 'Master Suite', oakWoodMat, brushedGoldMat, charcoalMat, boxGeo);

  // Master King Bed, Sheets, Pillows, Nightstands & Lamps, Rug, TV, Wardrobe, Full-Length Mirror, Study Desk & Bookshelf
  const mbGroup = new THREE.Group();
  mbGroup.position.set(-32, F2_Y, -346);
  f2Detail.add(mbGroup);
  const bedFrame = new THREE.Mesh(boxGeo, oakWoodMat);
  bedFrame.position.set(-3, 0.35, 0);
  bedFrame.scale.set(4.2, 0.52, 3.6);
  const mattress = new THREE.Mesh(boxGeo, creamFabricMat);
  mattress.position.set(-2.9, 0.72, 0);
  mattress.scale.set(3.9, 0.34, 3.3);
  const duvetThrow = new THREE.Mesh(boxGeo, mkStd(0x9a3412, 0.85, 0.02));
  duvetThrow.position.set(-1.7, 0.9, 0);
  duvetThrow.scale.set(1.5, 0.08, 3.28);
  const headboard = new THREE.Mesh(boxGeo, charcoalMat);
  headboard.position.set(-5.0, 1.25, 0);
  headboard.scale.set(0.24, 2.2, 4.4);
  const pillowL = new THREE.Mesh(boxGeo, whiteMarbleMat);
  pillowL.position.set(-4.35, 0.96, -0.85);
  pillowL.scale.set(0.75, 0.22, 1.2);
  const pillowR = pillowL.clone();
  pillowR.position.z = 0.85;
  const masterRug = new THREE.Mesh(boxGeo, mkStd(0xd6d3d1, 0.92, 0.01));
  masterRug.position.set(-1.8, 0.06, 0);
  masterRug.scale.set(6.5, 0.04, 5.8);
  mbGroup.add(bedFrame, mattress, duvetThrow, headboard, pillowL, pillowR, masterRug);
  addCollider(ctx.colliders, -35, F2_Y, -346, 4.4, 1.2, 3.8);

  [-2.6, 2.6].forEach((nz) => {
    const ns = new THREE.Mesh(boxGeo, oakWoodMat);
    ns.position.set(-4.5, 0.45, nz);
    ns.scale.set(0.85, 0.75, 0.95);
    const lampShade = new THREE.Mesh(cylGeo, nightLedPalette.warmWhite);
    lampShade.position.set(-4.5, 1.1, nz);
    lampShade.scale.set(0.38, 0.36, 0.38);
    mbGroup.add(ns, lampShade);
  });
  // Master Wardrobe + Full-Length Mirror + Wall TV + Lounge Sofa + Coffee Table + Study Desk & Laptop
  const wardrobe = new THREE.Mesh(boxGeo, oakWoodMat);
  wardrobe.position.set(-4, 1.6, -12);
  wardrobe.scale.set(6.5, 3.2, 0.9);
  const fullMirror = new THREE.Mesh(boxGeo, mirrorMat);
  fullMirror.position.set(-0.6, 1.5, -11.45);
  fullMirror.scale.set(1.4, 2.7, 0.08);
  const masterTv = new THREE.Mesh(boxGeo, charcoalMat);
  masterTv.position.set(4.5, 1.9, 0);
  masterTv.scale.set(0.14, 1.9, 3.6);
  const masterSofa = new THREE.Mesh(boxGeo, creamFabricMat);
  masterSofa.position.set(3.2, 0.45, 7.5);
  masterSofa.scale.set(2.2, 0.85, 4.2);
  const masterTable = new THREE.Mesh(boxGeo, oakWoodMat);
  masterTable.position.set(0.8, 0.34, 7.5);
  masterTable.scale.set(1.1, 0.48, 2.0);
  const studyDesk = new THREE.Mesh(boxGeo, oakWoodMat);
  studyDesk.position.set(-7.2, 0.76, 11.5);
  studyDesk.scale.set(2.4, 0.1, 1.1);
  const studyLaptop = new THREE.Mesh(boxGeo, nightLedPalette.cyan);
  studyLaptop.position.set(-7.2, 1.05, 11.65);
  studyLaptop.scale.set(0.62, 0.42, 0.04);
  mbGroup.add(wardrobe, fullMirror, masterTv, masterSofa, masterTable, studyDesk, studyLaptop);
  // Master Suite Paintings & Potted Plant
  const mArt = new THREE.Mesh(boxGeo, mkStd(0x0284c7, 0.55, 0.06));
  mArt.position.set(-9.5, F2_Y + 2.6, -346);
  mArt.scale.set(0.08, 1.6, 2.6);
  const mArtFrame = new THREE.Mesh(boxGeo, brushedGoldMat);
  mArtFrame.position.set(-9.55, F2_Y + 2.6, -346);
  mArtFrame.scale.set(0.06, 1.76, 2.76);
  f2Detail.add(mArt, mArtFrame);
  // Wall bookshelf + F2 hall console & plants
  const f2PlantPot = new THREE.Mesh(cylGeo, mkStd(0x9a5b3c, 0.7, 0.04));
  f2PlantPot.position.set(-22, F2_Y + 0.3, -330);
  f2PlantPot.scale.set(0.55, 0.6, 0.55);
  const f2PlantTop = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), mkStd(0x15803d, 0.65, 0.02));
  f2PlantTop.position.set(-22, F2_Y + 0.92, -330);
  f2Detail.add(f2PlantPot, f2PlantTop);

  // Luxury Marble Bathroom (North Center F2: x in [-12..16], z in [-386..-366])
  addSolidWall(pb, ctx.colliders, -12, F2_Y + 2.8, -376, 0.35, 5.6, 20, 0xf8fafc);
  addSolidWall(pb, ctx.colliders, 16, F2_Y + 2.8, -376, 0.35, 5.6, 20, 0xf8fafc);
  const bathTub = new THREE.Mesh(cylGeo, whiteMarbleMat);
  bathTub.position.set(2, F2_Y + 0.5, -379);
  bathTub.scale.set(3.6, 0.85, 1.9);
  const bathWater = new THREE.Mesh(cylGeo, mkStd(0x38bdf8, 0.1, 0.15, { transparent: true, opacity: 0.72 }));
  bathWater.position.set(2, F2_Y + 0.84, -379);
  bathWater.scale.set(3.1, 0.1, 1.5);
  const showerGlass = new THREE.Mesh(boxGeo, glassRailMat);
  showerGlass.position.set(10, F2_Y + 1.5, -380);
  showerGlass.scale.set(0.08, 3.0, 3.6);
  const vanity = new THREE.Mesh(boxGeo, whiteMarbleMat);
  vanity.position.set(-6, F2_Y + 0.55, -384.5);
  vanity.scale.set(4.8, 1.0, 1.0);
  const bathMirror = new THREE.Mesh(cylGeo, mirrorMat);
  bathMirror.position.set(-6, F2_Y + 2.1, -385.1);
  bathMirror.rotation.x = Math.PI * 0.5;
  bathMirror.scale.set(1.6, 0.08, 1.6);
  const toiletBase = new THREE.Mesh(cylGeo, whiteMarbleMat);
  toiletBase.position.set(13.2, F2_Y + 0.25, -384.2);
  toiletBase.scale.set(0.55, 0.45, 0.65);
  const toiletTank = new THREE.Mesh(boxGeo, whiteMarbleMat);
  toiletTank.position.set(13.2, F2_Y + 0.68, -384.6);
  toiletTank.scale.set(0.52, 0.48, 0.24);
  const towelRack = new THREE.Mesh(boxGeo, brushedGoldMat);
  towelRack.position.set(-11.6, F2_Y + 1.35, -378);
  towelRack.scale.set(0.12, 0.05, 1.3);
  f2Detail.add(bathTub, bathWater, showerGlass, vanity, bathMirror, toiletBase, toiletTank, towelRack);

  // 3 Additional Distinct VIP Bedrooms (East & South-East F2: x in [18..43])
  [
    { x: 34, z: -380, bedHex: 0x065f46, label: 'Emerald VIP Suite' },
    { x: 37, z: -362, bedHex: 0x1e3a8a, label: 'Royal Blue Suite' },
    { x: 32, z: -336, bedHex: 0x7f1d1d, label: 'Crimson Guest Suite' },
  ].forEach((rm, rIdx) => {
    const rmBed = new THREE.Mesh(boxGeo, mkStd(rm.bedHex, 0.78, 0.05));
    rmBed.position.set(rm.x, F2_Y + 0.45, rm.z);
    rmBed.scale.set(3.0, 0.65, 2.5);
    const rmPillow = new THREE.Mesh(boxGeo, whiteMarbleMat);
    rmPillow.position.set(rm.x + 1.0, F2_Y + 0.85, rm.z);
    rmPillow.scale.set(0.55, 0.22, 1.6);
    const rmStand = new THREE.Mesh(boxGeo, oakWoodMat);
    rmStand.position.set(rm.x - 1.2, F2_Y + 0.36, rm.z + 1.6);
    rmStand.scale.set(0.7, 0.65, 0.7);
    const rmLamp = new THREE.Mesh(cylGeo, nightLedPalette.gold);
    rmLamp.position.set(rm.x - 1.2, F2_Y + 0.92, rm.z + 1.6);
    rmLamp.scale.set(0.32, 0.32, 0.32);
    const rmWardrobe = new THREE.Mesh(boxGeo, oakWoodMat);
    rmWardrobe.position.set(rm.x + 2.8, F2_Y + 1.4, rm.z - 2.4);
    rmWardrobe.scale.set(0.8, 2.6, 2.2);
    const rmDesk = new THREE.Mesh(boxGeo, charcoalMat);
    rmDesk.position.set(rm.x - 3.6, F2_Y + 0.74, rm.z);
    rmDesk.scale.set(0.9, 0.1, 1.9);
    const rmArt = new THREE.Mesh(boxGeo, mkStd([0xfbbf24, 0x38bdf8, 0xe11d48][rIdx % 3], 0.55, 0.05));
    rmArt.position.set(rm.x, F2_Y + 2.4, rm.z - 2.8);
    rmArt.scale.set(1.5, 1.0, 0.06);
    f2Detail.add(rmBed, rmPillow, rmStand, rmLamp, rmWardrobe, rmDesk, rmArt);
  });

  // =========================================================================
  // 6. FLOOR 3 (y = 11.6): CINEMA + RGB GAMING STUDIO + DJ SKY CLUB PARTY & BAR
  // =========================================================================
  const f3Detail = new THREE.Group();
  root.add(f3Detail);
  ctx.lodDetailGroups.push({ group: f3Detail, x: 0, y: F3_Y + 2.5, z: -356, radius: 46, maxDist: 68, tier: 'detail' });

  // A) Luxury Private IMAX Cinema Room (South-West F3: x in [-43.2..-16], z in [-356.2..-325.8]) — Sealed 4-Wall Enclosure!
  addSolidWall(pb, ctx.colliders, -16, F3_Y + 2.8, -344.525, 0.38, 5.6, 23.35, 0x1b1e28);
  addSolidWall(pb, ctx.colliders, -16, F3_Y + 2.8, -328.475, 0.38, 5.6, 5.35, 0x1b1e28);
  addSolidWall(pb, ctx.colliders, -16, F3_Y + 4.3, -332, 0.38, 2.8, 1.7, 0x1b1e28);
  addSolidWall(pb, ctx.colliders, -43.2, F3_Y + 2.8, -341.0, 0.38, 5.6, 30.8, 0x11151d);
  addSolidWall(pb, ctx.colliders, -29.6, F3_Y + 2.8, -325.8, 27.6, 5.6, 0.38, 0x11151d);
  createInteractiveInteriorDoor(ctx, root, -16, F3_Y, -332, Math.PI * 0.5, 'Home Cinema', charcoalMat, brushedGoldMat, charcoalMat, boxGeo);
  const { material: cinemaScreenMat } = ctx.displays.createVideoDisplayMaterial(
    [
      './assets/aistudio/movie_video_1_627e1400.mp4',
      './assets/aistudio/Grand_Theft_Auto_VI__An_Extended_Look___Now_Playing_720P_HD__3f882ce6.mp4',
    ],
    'city_billboard',
    {
      title: 'PRIVATE APEX IMAX CINEMA',
      subtitle: 'MOVIE 1 & 2 · CONTINUOUS LOOP',
      accentHex: '#a855f7',
      width: 640,
      height: 288,
      videoRotations: {
        movie_video_1_627e1400: -90,
      },
      worldPos: { x: -42.5, y: F3_Y + 2.75, z: -340 },
      audioMode: 'world',
      maxAudioVolume: 0.14,
      audioRangeMeters: 22,
    },
  );
  pb.addBox(-42.9, F3_Y + 2.75, -340, 0.14, 3.8, 9.0, 0x090d16);
  const cinemaScreen = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 3.6), cinemaScreenMat);
  cinemaScreen.position.set(-42.78, F3_Y + 2.75, -340);
  cinemaScreen.rotation.y = Math.PI * 0.5;
  f3Detail.add(cinemaScreen);
  addWireLedStrip(f3Detail, boxGeo, nightLedPalette.violet, -42.5, F3_Y + 4.75, -340, 0.05, 0.05, 9.0);
  addWireLedStrip(f3Detail, boxGeo, nightLedPalette.violet, -42.5, F3_Y + 0.75, -340, 0.05, 0.05, 9.0);
  [-30, -25].forEach((sx, row) => {
    const sofa = new THREE.Mesh(boxGeo, mkStd(0x4c1d95, 0.85, 0.05));
    sofa.position.set(sx, F3_Y + 0.45 + row * 0.35, -340);
    sofa.scale.set(1.6, 0.9, 6.8);
    const cinPillowL = new THREE.Mesh(boxGeo, creamFabricMat);
    cinPillowL.position.set(sx - 0.35, F3_Y + 0.98 + row * 0.35, -342.4);
    cinPillowL.scale.set(0.28, 0.36, 0.48);
    const cinPillowR = cinPillowL.clone();
    cinPillowR.position.z = -337.6;
    f3Detail.add(sofa, cinPillowL, cinPillowR);
  });
  // Cinema Popcorn & Snack Console + Framed Movie Posters
  pb.addBox(-20, F3_Y + 0.5, -328, 3.2, 1.0, 1.0, 0x0f172a, 'glossy');
  const popcornBox = new THREE.Mesh(boxGeo, mkStd(0xe11d48, 0.55, 0.05));
  popcornBox.position.set(-20.4, F3_Y + 1.32, -328);
  popcornBox.scale.set(0.45, 0.62, 0.45);
  f3Detail.add(popcornBox);
  [-36, -28].forEach((px, pIdx) => {
    const poster = new THREE.Mesh(boxGeo, mkStd(pIdx === 0 ? 0xf59e0b : 0x38bdf8, 0.5, 0.1));
    poster.position.set(px, F3_Y + 2.8, -326.05);
    poster.scale.set(1.6, 2.2, 0.06);
    f3Detail.add(poster);
  });

  // B) PRO ESPORTS & NEON CITY GAMING STUDIO (North-West F3: x in [-43..-16], z in [-386..-356])
  {
    const gsWallDarkMat = mkStd(0x141720, 0.52, 0.28);
    const gsWallWhiteMat = mkStd(0xf1f5f9, 0.48, 0.08);
    const gsWoodSlatMat = mkStd(0x8b5a2b, 0.6, 0.04);
    const redNeonMat = mkStd(0xff2442, 0.15, 0.1, {
      emissive: new THREE.Color(0xff2442),
      emissiveIntensity: 0.72,
    });
    const cyanNeonMat = mkStd(0x22d3ee, 0.15, 0.1, {
      emissive: new THREE.Color(0x22d3ee),
      emissiveIntensity: 0.72,
    });
    const violetNeonMat = mkStd(0xc084fc, 0.15, 0.1, {
      emissive: new THREE.Color(0xc084fc),
      emissiveIntensity: 0.68,
    });

    // Studio 4-Wall Partition Enclosure with Interactive Entry Door along East Edge (x = -16.2, z = -362)
    addSolidWall(pb, ctx.colliders, -29.6, F3_Y + 2.8, -356.2, 27.2, 5.6, 0.38, 0x11151d);
    addSolidWall(pb, ctx.colliders, -43.2, F3_Y + 2.8, -371.5, 0.35, 5.6, 30.8, 0x11151d);
    addSolidWall(pb, ctx.colliders, -29.8, F3_Y + 2.8, -386.6, 27.2, 5.6, 0.35, 0x11151d);
    addSolidWall(pb, ctx.colliders, -16.2, F3_Y + 2.8, -374.725, 0.38, 5.6, 23.75, 0x141720);
    addSolidWall(pb, ctx.colliders, -16.2, F3_Y + 2.8, -358.675, 0.38, 5.6, 4.95, 0x141720);
    addSolidWall(pb, ctx.colliders, -16.2, F3_Y + 4.3, -362.0, 0.38, 2.8, 1.7, 0x141720);
    createInteractiveInteriorDoor(ctx, root, -16.2, F3_Y, -362.0, Math.PI * 0.5, 'Gaming Studio', oakWoodMat, brushedGoldMat, charcoalMat, boxGeo);

    // Architectural Slatted Acoustic Panels & 3D Geometric Polygonal RGB Relief Wall (matching ref photos!)
    for (let slatZ = -384.5; slatZ <= -378.5; slatZ += 0.42) {
      pb.addBox(-43.0, F3_Y + 2.75, slatZ, 0.08, 4.9, 0.18, 0x7c4a26);
    }
    for (let slatZ = -364.5; slatZ <= -358.5; slatZ += 0.42) {
      pb.addBox(-43.0, F3_Y + 2.75, slatZ, 0.08, 4.9, 0.18, 0x7c4a26);
    }
    // Polygonal diagonal LED wall relief tiles on West feature wall
    for (let g = 0; g < 6; g++) {
      const gz = -376.5 + g * 2.1;
      const tile = new THREE.Mesh(boxGeo, g % 2 === 0 ? gsWallDarkMat : gsWallWhiteMat);
      tile.position.set(-42.98, F3_Y + 2.6 + (g % 2 === 0 ? 0.55 : -0.45), gz);
      tile.rotation.x = Math.PI * 0.25;
      tile.scale.set(0.1, 1.55, 1.55);
      const ledBeam = new THREE.Mesh(boxGeo, g % 2 === 0 ? redNeonMat : cyanNeonMat);
      ledBeam.position.set(-42.9, F3_Y + 2.6, gz);
      ledBeam.rotation.x = g % 2 === 0 ? Math.PI * 0.25 : -Math.PI * 0.25;
      ledBeam.scale.set(0.04, 0.045, 2.35);
      f3Detail.add(tile, ledBeam);
    }

    // North Feature Wall: Huge NEON CITY Animation Video Loop Screen (independent material + playlist!)
    const { material: neonCityWallMat } = ctx.displays.createVideoDisplayMaterial(
      [
        './assets/aistudio/neon_city_wall_loop.mp4',
        './assets/aistudio/Grand_Theft_Auto_VI__An_Extended_Look___Now_Playing_720P_HD__3f882ce6.mp4',
      ],
      'neon_city_wall',
      {
        title: 'NEON CYBER SKYLINE',
        subtitle: 'APEX PRO GAMING STUDIO',
        accentHex: '#ec4899',
        width: 512,
        height: 384,
        worldPos: { x: -30.0, y: F3_Y + 2.75, z: -386.24 },
        audioMode: 'world',
        maxAudioVolume: 0.09,
        audioRangeMeters: 16,
      },
    );
    const neonWallFrame = new THREE.Mesh(boxGeo, gsWallDarkMat);
    neonWallFrame.position.set(-30.0, F3_Y + 2.75, -386.35);
    neonWallFrame.scale.set(13.2, 4.6, 0.14);
    const neonWallScreen = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 4.15), neonCityWallMat);
    neonWallScreen.position.set(-30.0, F3_Y + 2.75, -386.24);
    f3Detail.add(neonWallFrame, neonWallScreen);
    addWireLedStrip(f3Detail, boxGeo, redNeonMat, -30.0, F3_Y + 5.1, -386.1, 13.4, 0.06, 0.06);
    addWireLedStrip(f3Detail, boxGeo, cyanNeonMat, -30.0, F3_Y + 0.45, -386.1, 13.4, 0.06, 0.06);

    // Floating illuminated shelves + Framed Posters + Patterned Pro Studio Rug
    const studioRug = new THREE.Mesh(boxGeo, mkStd(0x18181b, 0.92, 0.02));
    studioRug.position.set(-36.0, F3_Y + 0.04, -371.5);
    studioRug.scale.set(5.4, 0.04, 11.2);
    const rugStripeA = new THREE.Mesh(boxGeo, redNeonMat);
    rugStripeA.position.set(-38.4, F3_Y + 0.065, -371.5);
    rugStripeA.scale.set(0.08, 0.015, 10.8);
    const rugStripeB = rugStripeA.clone();
    rugStripeB.position.x = -33.6;
    f3Detail.add(studioRug, rugStripeA, rugStripeB);

    [-381.2, -361.8].forEach((shZ, sIdx) => {
      const shelf = new THREE.Mesh(boxGeo, gsWallDarkMat);
      shelf.position.set(-42.6, F3_Y + 2.95, shZ);
      shelf.scale.set(0.55, 0.08, 2.8);
      const shelfLed = new THREE.Mesh(boxGeo, sIdx === 0 ? redNeonMat : violetNeonMat);
      shelfLed.position.set(-42.6, F3_Y + 2.9, shZ);
      shelfLed.scale.set(0.52, 0.03, 2.75);
      const poster = new THREE.Mesh(boxGeo, mkStd(sIdx === 0 ? 0xe11d48 : 0x06b6d4, 0.45, 0.1));
      poster.position.set(-42.96, F3_Y + 3.9, shZ);
      poster.scale.set(0.06, 1.35, 1.0);
      const miniPlant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mkStd(0x16a34a, 0.65, 0.02));
      miniPlant.position.set(-42.55, F3_Y + 3.22, shZ - 0.7);
      const trophy = new THREE.Mesh(cylGeo, brushedGoldMat);
      trophy.position.set(-42.55, F3_Y + 3.2, shZ + 0.6);
      trophy.scale.set(0.18, 0.42, 0.18);
      f3Detail.add(shelf, shelfLed, poster, miniPlant, trophy);
    });

    // Distinct continuous gaming playlists — EVERY monitor owns its OWN material & display entry for independent damage!
    const rigPlaylists: string[][] = [
      [
        './assets/aistudio/game_video_2_deb9f1ca.mp4',
        './assets/aistudio/Black_Ops_6_Kilo_141_vs_MW4_Axion_Weapons_inspection__No_Ammo___mw4__bo6__callofduty_720P_HD__5ca51370.mp4',
        './assets/aistudio/gaming_screen_loop.mp4',
      ],
      [
        './assets/aistudio/GTA_VI_vs_Watch_Dogs_2___Pistol_Shooting_Physics_Comparison__1080P_HD__54ca8cce.mp4',
        './assets/aistudio/game_video_2_deb9f1ca.mp4',
        './assets/aistudio/Grand_Theft_Auto_VI__An_Extended_Look___Now_Playing_720P_HD__3f882ce6.mp4',
      ],
    ];
    const wingPlaylists: string[][] = [
      [
        './assets/aistudio/Black_Ops_6_Kilo_141_vs_MW4_Axion_Weapons_inspection__No_Ammo___mw4__bo6__callofduty_720P_HD__5ca51370.mp4',
        './assets/aistudio/game_video_2_deb9f1ca.mp4',
      ],
      [
        './assets/aistudio/GTA_VI_vs_Watch_Dogs_2___Pistol_Shooting_Physics_Comparison__1080P_HD__54ca8cce.mp4',
        './assets/aistudio/game_video_2_deb9f1ca.mp4',
      ],
      [
        './assets/aistudio/Grand_Theft_Auto_VI__An_Extended_Look___Now_Playing_720P_HD__3f882ce6.mp4',
        './assets/aistudio/gaming_screen_loop.mp4',
      ],
      [
        './assets/aistudio/gaming_screen_loop.mp4',
        './assets/aistudio/neon_city_wall_loop.mp4',
      ],
    ];

    // Modern Two-Station Pro Battlestation Desk (L-Shaped Sleek White & Carbon Trim + Underglow)
    const deskTop = new THREE.Mesh(boxGeo, gsWallWhiteMat);
    deskTop.position.set(-39.2, F3_Y + 0.84, -371.5);
    deskTop.scale.set(1.55, 0.09, 10.4);
    const deskL = new THREE.Mesh(boxGeo, gsWallWhiteMat);
    deskL.position.set(-37.8, F3_Y + 0.84, -376.4);
    deskL.scale.set(4.2, 0.09, 1.35);
    const drawerL = new THREE.Mesh(boxGeo, gsWallDarkMat);
    drawerL.position.set(-39.2, F3_Y + 0.4, -376.1);
    drawerL.scale.set(1.3, 0.78, 0.85);
    const drawerR = drawerL.clone();
    drawerR.position.z = -366.8;
    const deskLegMid = new THREE.Mesh(boxGeo, gsWallDarkMat);
    deskLegMid.position.set(-39.2, F3_Y + 0.4, -371.5);
    deskLegMid.scale.set(1.2, 0.78, 0.25);
    f3Detail.add(deskTop, deskL, drawerL, drawerR, deskLegMid);
    addCollider(ctx.colliders, -39.2, F3_Y, -371.5, 1.8, 1.1, 10.6);
    addWireLedStrip(f3Detail, boxGeo, redNeonMat, -38.42, F3_Y + 0.78, -371.5, 0.04, 0.04, 10.3);
    addWireLedStrip(f3Detail, boxGeo, cyanNeonMat, -39.8, F3_Y + 0.88, -371.5, 0.04, 0.04, 10.3);

    // Build 2 Full Luxury Battlestation Rigs (Ultrawide Curved Monitor + Side Monitors + Glass RGB PC + Interactive Rotating Chair)
    const rgbFans: THREE.Mesh[] = [];
    const rgbRings: Array<{ mat: THREE.MeshStandardMaterial; phase: number }> = [];
    [-374.0, -369.0].forEach((rigZ, rigIdx) => {
      const accentTrim = rigIdx === 0 ? redNeonMat : cyanNeonMat;
      const chairTrimHex = rigIdx === 0 ? 0xe11d48 : 0x22d3ee;

      // 1) Panoramic Curved Ultrawide Monitor with dedicated VideoDisplayMaterial instance!
      const monStandBase = new THREE.Mesh(boxGeo, gsWallDarkMat);
      monStandBase.position.set(-39.65, F3_Y + 0.91, rigZ);
      monStandBase.scale.set(0.32, 0.04, 0.65);
      const monArm = new THREE.Mesh(boxGeo, gsWallDarkMat);
      monArm.position.set(-39.72, F3_Y + 1.24, rigZ);
      monArm.scale.set(0.08, 0.62, 0.1);
      f3Detail.add(monStandBase, monArm);

      const { material: centerMonMat } = ctx.displays.createVideoDisplayMaterial(
        rigPlaylists[rigIdx % rigPlaylists.length],
        'gaming_action',
        {
          title: `STATION ${rigIdx + 1} // 240HZ`,
          subtitle: 'CONTINUOUS GAMING STREAM',
          accentHex: rigIdx === 0 ? '#f43f5e' : '#22d3ee',
          width: 640,
          height: 360,
          worldPos: { x: -39.51, y: F3_Y + 1.44, z: rigZ },
          audioMode: 'world',
          maxAudioVolume: 0.09,
          audioRangeMeters: 16,
        },
      );
      const monCenterBezel = new THREE.Mesh(boxGeo, gsWallDarkMat);
      monCenterBezel.position.set(-39.55, F3_Y + 1.44, rigZ);
      monCenterBezel.scale.set(0.07, 0.78, 1.85);
      const monCenterScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 0.71), centerMonMat);
      monCenterScreen.rotation.y = Math.PI * 0.5;
      monCenterScreen.position.set(-39.51, F3_Y + 1.44, rigZ);
      f3Detail.add(monCenterBezel, monCenterScreen);

      // Flanking Angled Side Display Wings — each wing gets its OWN independent VideoDisplayMaterial!
      [-1, 1].forEach((sideSign, wingIdx) => {
        const wingList = wingPlaylists[(rigIdx * 2 + wingIdx) % wingPlaylists.length];
        const { material: wingMat } = ctx.displays.createVideoDisplayMaterial(wingList, 'gaming_action', {
          title: `CAM ${rigIdx + 1}-${wingIdx + 1}`,
          accentHex: sideSign < 0 ? '#a855f7' : '#38bdf8',
          width: 384,
          height: 384,
          worldPos: { x: -39.34, y: F3_Y + 1.44, z: rigZ + sideSign * 1.18 },
          audioMode: 'none',
        });
        const wingBezel = new THREE.Mesh(boxGeo, gsWallDarkMat);
        wingBezel.position.set(-39.38, F3_Y + 1.44, rigZ + sideSign * 1.18);
        wingBezel.rotation.y = -sideSign * 0.38;
        wingBezel.scale.set(0.06, 0.74, 0.68);
        const wingScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.68), wingMat);
        wingScreen.position.set(-39.34, F3_Y + 1.44, rigZ + sideSign * 1.18);
        wingScreen.rotation.y = Math.PI * 0.5 - sideSign * 0.38;
        f3Detail.add(wingBezel, wingScreen);
      });

      // 2) Deskmat, RGB Backlit Mechanical Keyboard, Glowing Gaming Mouse, Speakers & Headphone Stand
      const deskMat = new THREE.Mesh(boxGeo, gsWallDarkMat);
      deskMat.position.set(-38.95, F3_Y + 0.895, rigZ);
      deskMat.scale.set(0.56, 0.015, 1.48);
      const kbBase = new THREE.Mesh(boxGeo, charcoalMat);
      kbBase.position.set(-38.95, F3_Y + 0.915, rigZ + 0.14);
      kbBase.scale.set(0.24, 0.028, 0.56);
      const kbGlow = new THREE.Mesh(boxGeo, accentTrim);
      kbGlow.position.set(-38.95, F3_Y + 0.932, rigZ + 0.14);
      kbGlow.scale.set(0.21, 0.012, 0.52);
      const mouseBody = new THREE.Mesh(boxGeo, gsWallWhiteMat);
      mouseBody.position.set(-38.95, F3_Y + 0.92, rigZ - 0.36);
      mouseBody.scale.set(0.14, 0.036, 0.09);
      const mouseGlow = new THREE.Mesh(boxGeo, cyanNeonMat);
      mouseGlow.position.set(-38.95, F3_Y + 0.91, rigZ - 0.36);
      mouseGlow.scale.set(0.15, 0.014, 0.1);
      // Pair of White Studio Bookshelf Speakers
      [-1.08, 1.08].forEach((sz) => {
        const spk = new THREE.Mesh(boxGeo, gsWallWhiteMat);
        spk.position.set(-39.45, F3_Y + 1.08, rigZ + sz);
        spk.scale.set(0.22, 0.34, 0.2);
        const cone = new THREE.Mesh(cylGeo, gsWallDarkMat);
        cone.rotation.z = Math.PI * 0.5;
        cone.position.set(-39.33, F3_Y + 1.04, rigZ + sz);
        cone.scale.set(0.13, 0.03, 0.13);
        f3Detail.add(spk, cone);
      });
      // Headset Stand + Wireless Gaming Headphones + Controller Prop
      const hStand = new THREE.Mesh(cylGeo, gsWallDarkMat);
      hStand.position.set(-39.15, F3_Y + 1.06, rigZ + 0.72);
      hStand.scale.set(0.05, 0.34, 0.05);
      const hBand = new THREE.Mesh(boxGeo, accentTrim);
      hBand.position.set(-39.15, F3_Y + 1.24, rigZ + 0.72);
      hBand.scale.set(0.14, 0.14, 0.18);
      const padProp = new THREE.Mesh(boxGeo, accentTrim);
      padProp.position.set(-38.75, F3_Y + 0.92, rigZ + 0.62);
      padProp.scale.set(0.14, 0.04, 0.22);
      f3Detail.add(deskMat, kbBase, kbGlow, mouseBody, mouseGlow, hStand, hBand, padProp);

      // 3) Luxury Tempered-Glass Colorful RGB PC Tower (Visible Motherboard, GPU, RAM & 3 Spinning RGB Ring Fans!)
      const towerX = -39.25;
      const towerZ = rigZ - 1.58;
      const pcChassis = new THREE.Mesh(boxGeo, rigIdx === 0 ? gsWallWhiteMat : gsWallDarkMat);
      pcChassis.position.set(towerX, F3_Y + 1.26, towerZ);
      pcChassis.scale.set(0.58, 0.74, 0.34);
      const pcGlass = new THREE.Mesh(boxGeo, glassRailMat);
      pcGlass.position.set(towerX + 0.26, F3_Y + 1.26, towerZ + 0.175);
      pcGlass.scale.set(0.5, 0.64, 0.03);
      const pcBackplate = new THREE.Mesh(boxGeo, gsWallDarkMat);
      pcBackplate.position.set(towerX, F3_Y + 1.26, towerZ - 0.08);
      pcBackplate.scale.set(0.5, 0.64, 0.08);
      const pcGpu = new THREE.Mesh(boxGeo, mkStd(0x0f172a, 0.25, 0.85));
      pcGpu.position.set(towerX - 0.04, F3_Y + 1.18, towerZ + 0.04);
      pcGpu.scale.set(0.36, 0.08, 0.16);
      const gpuRgbBar = new THREE.Mesh(boxGeo, accentTrim);
      gpuRgbBar.position.set(towerX - 0.04, F3_Y + 1.18, towerZ + 0.125);
      gpuRgbBar.scale.set(0.34, 0.025, 0.02);
      const cpuCooler = new THREE.Mesh(cylGeo, cyanNeonMat);
      cpuCooler.rotation.x = Math.PI * 0.5;
      cpuCooler.position.set(towerX - 0.06, F3_Y + 1.38, towerZ + 0.04);
      cpuCooler.scale.set(0.11, 0.06, 0.11);
      f3Detail.add(pcChassis, pcGlass, pcBackplate, pcGpu, gpuRgbBar, cpuCooler);

      for (let fIdx = 0; fIdx < 3; fIdx++) {
        const fanRingMat = mkStd(0xffffff, 0.15, 0.2, {
          emissive: new THREE.Color([0xff2442, 0x22d3ee, 0xc084fc][fIdx]),
          emissiveIntensity: 0.85,
        });
        const fanRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 8, 16), fanRingMat);
        fanRing.position.set(towerX + 0.21, F3_Y + 1.06 + fIdx * 0.195, towerZ + 0.08);
        fanRing.rotation.y = Math.PI * 0.5;
        const fanBlades = new THREE.Mesh(boxGeo, gsWallWhiteMat);
        fanBlades.position.copy(fanRing.position);
        fanBlades.scale.set(0.02, 0.13, 0.03);
        f3Detail.add(fanRing, fanBlades);
        rgbFans.push(fanBlades);
        rgbRings.push({ mat: fanRingMat, phase: fIdx * 1.1 + rigIdx * 2.1 });
      }

      // 4) Sculpted Beat-Style Ergonomic Racing Gaming Chair (5-star wheelbase, bolstered cushion, wing backrest, headrest & lumbar pillow)
      const chX = -37.25;
      const chMat = mkStd(rigIdx === 0 ? 0xe2e8f0 : 0x18181b, 0.48, 0.14);
      const chBolsterMat = mkStd(chairTrimHex, 0.42, 0.22);
      const chGrp = new THREE.Group();
      chGrp.position.set(chX, F3_Y, rigZ);
      chGrp.rotation.y = -0.14 + rigIdx * 0.26;
      const gasLift = new THREE.Mesh(cylGeo, charcoalMat);
      gasLift.position.set(0, 0.28, 0);
      gasLift.scale.set(0.1, 0.38, 0.1);
      chGrp.add(gasLift);
      for (let leg = 0; leg < 5; leg++) {
        const la = (leg / 5) * Math.PI * 2;
        const arm = new THREE.Mesh(boxGeo, charcoalMat);
        arm.position.set(Math.cos(la) * 0.22, 0.1, Math.sin(la) * 0.22);
        arm.rotation.y = -la;
        arm.scale.set(0.42, 0.05, 0.07);
        const caster = new THREE.Mesh(cylGeo, chBolsterMat);
        caster.position.set(Math.cos(la) * 0.39, 0.045, Math.sin(la) * 0.39);
        caster.scale.set(0.07, 0.07, 0.07);
        chGrp.add(arm, caster);
      }
      const seatBase = new THREE.Mesh(boxGeo, chMat);
      seatBase.position.set(0, 0.5, 0);
      seatBase.scale.set(0.62, 0.13, 0.62);
      const seatTrimL = new THREE.Mesh(boxGeo, chBolsterMat);
      seatTrimL.position.set(0, 0.54, -0.32);
      seatTrimL.scale.set(0.64, 0.08, 0.08);
      const seatTrimR = seatTrimL.clone();
      seatTrimR.position.z = 0.32;
      const backrest = new THREE.Mesh(boxGeo, chMat);
      backrest.position.set(0.28, 1.04, 0);
      backrest.rotation.z = -0.12;
      backrest.scale.set(0.14, 0.98, 0.56);
      const wingL = new THREE.Mesh(boxGeo, chBolsterMat);
      wingL.position.set(0.22, 1.04, -0.29);
      wingL.rotation.set(0, -0.28, -0.12);
      wingL.scale.set(0.12, 0.92, 0.1);
      const wingR = wingL.clone();
      wingR.position.z = 0.29;
      wingR.rotation.y = 0.28;
      const lumbarPillow = new THREE.Mesh(boxGeo, chBolsterMat);
      lumbarPillow.position.set(0.16, 0.72, 0);
      lumbarPillow.scale.set(0.1, 0.18, 0.34);
      const headPillow = new THREE.Mesh(boxGeo, chBolsterMat);
      headPillow.position.set(0.22, 1.44, 0);
      headPillow.scale.set(0.1, 0.18, 0.28);
      [-0.35, 0.35].forEach((az) => {
        const armPost = new THREE.Mesh(boxGeo, charcoalMat);
        armPost.position.set(0, 0.65, az);
        armPost.scale.set(0.07, 0.28, 0.07);
        const armPad = new THREE.Mesh(boxGeo, charcoalMat);
        armPad.position.set(-0.04, 0.8, az);
        armPad.scale.set(0.32, 0.05, 0.1);
        chGrp.add(armPost, armPad);
      });
      chGrp.add(seatBase, seatTrimL, seatTrimR, backrest, wingL, wingR, lumbarPillow, headPillow);
      // Feature-packed retractable ergonomic footrest bar + cushion pad
      const footrestArm = new THREE.Mesh(boxGeo, charcoalMat);
      footrestArm.position.set(-0.34, 0.34, 0);
      footrestArm.scale.set(0.32, 0.04, 0.08);
      const footrestPad = new THREE.Mesh(boxGeo, chBolsterMat);
      footrestPad.position.set(-0.48, 0.36, 0);
      footrestPad.scale.set(0.18, 0.05, 0.38);
      chGrp.add(footrestArm, footrestPad);
      f3Detail.add(chGrp);

      // Register Interactive Rotating Gaming Chair Seat (faces -X toward Gaming Monitor)
      const seatId = `mansion_gaming_chair_${rigIdx + 1}`;
      ctx.mansionSeats = ctx.mansionSeats ?? [];
      ctx.mansionSeats.push({
        id: seatId,
        label: `Sit in Pro Gaming Chair ${rigIdx + 1}`,
        kind: 'gaming_chair',
        x: chX,
        y: F3_Y + 0.54,
        z: rigZ,
        yaw: Math.PI * 0.5,
        canRotateChair: true,
        chairGroup: chGrp,
      });
      ctx.interactables.push({
        id: seatId,
        x: chX,
        y: F3_Y,
        z: rigZ,
        radius: 2.3,
        category: 'seat',
        getLabel: () => `Sit in Pro Gaming Chair ${rigIdx + 1}`,
        trigger: () => `Seated in Gaming Chair ${rigIdx + 1}`,
      });
    });

    // Studio Ceiling Cove RGB Strips
    addWireLedStrip(f3Detail, boxGeo, redNeonMat, -30, F3_Y + 5.4, -372, 24, 0.05, 0.06);
    addWireLedStrip(f3Detail, boxGeo, cyanNeonMat, -30, F3_Y + 5.4, -361, 24, 0.05, 0.06);
    addWireLedStrip(f3Detail, boxGeo, violetNeonMat, -42.9, F3_Y + 5.35, -371.5, 0.05, 0.05, 26);

    animatedUpdaters.push((_dt, elapsed) => {
      for (let i = 0; i < rgbFans.length; i++) {
        rgbFans[i].rotation.x = elapsed * 14.0 + i;
      }
      for (let i = 0; i < rgbRings.length; i++) {
        const rr = rgbRings[i];
        rr.mat.emissive.setHSL((elapsed * 0.28 + rr.phase * 0.16) % 1, 0.95, 0.55);
      }
    });
    void gsWoodSlatMat;
  }

  // F3 NE Fitness & Recovery Corner (x in [12..18], z = -383 — completely clear of Stair 2 & DJ Floor!)
  {
    const tmDeck = new THREE.Mesh(boxGeo, charcoalMat);
    tmDeck.position.set(14.5, F3_Y + 0.14, -383.2);
    tmDeck.scale.set(2.2, 0.22, 1.0);
    const tmConsole = new THREE.Mesh(boxGeo, charcoalMat);
    tmConsole.position.set(15.5, F3_Y + 1.05, -383.2);
    tmConsole.scale.set(0.28, 1.15, 0.95);
    const yogaMat = new THREE.Mesh(boxGeo, mkStd(0x14b8a6, 0.85, 0.02));
    yogaMat.position.set(11.6, F3_Y + 0.04, -383.2);
    yogaMat.scale.set(1.1, 0.05, 2.2);
    const dbRack = new THREE.Mesh(boxGeo, charcoalMat);
    dbRack.position.set(17.6, F3_Y + 0.45, -384.6);
    dbRack.scale.set(1.8, 0.82, 0.55);
    f3Detail.add(tmDeck, tmConsole, yogaMat, dbRack);
  }

  // C) 3F LUXURY DJ CLUB PARTY ARENA, SPEAKER TOWERS, COLD DRINK BAR & SPOTLIGHTS!
  {
    const djX = 0;
    const djZ = -378;
    // Elevated Glossy Dance Stage & DJ Console Riser
    pb.addBox(djX, F3_Y + 0.35, djZ, 11.5, 0.7, 3.6, 0x0f172a, 'glossy');
    addCollider(ctx.colliders, djX, F3_Y, djZ, 11.5, 0.9, 3.6);
    pb.addBox(djX, F3_Y + 1.15, djZ + 1.0, 4.6, 0.95, 1.2, 0x1e293b, 'glossy');
    addWireLedStrip(f3Detail, boxGeo, nightLedPalette.violet, djX, F3_Y + 1.15, djZ + 1.62, 4.5, 0.07, 0.05);
    addWireLedStrip(f3Detail, boxGeo, nightLedPalette.cyan, djX, F3_Y + 0.72, djZ + 1.82, 11.4, 0.06, 0.06);

    // Spinning Dual DJ Turntable Platters + Mixer Faders
    const platterL = new THREE.Mesh(cylGeo, brushedGoldMat);
    platterL.position.set(djX - 1.2, F3_Y + 1.66, djZ + 1.0);
    platterL.scale.set(0.68, 0.06, 0.68);
    const platterR = platterL.clone();
    platterR.position.x = djX + 1.2;
    const mixer = new THREE.Mesh(boxGeo, nightLedPalette.cyan);
    mixer.position.set(djX, F3_Y + 1.66, djZ + 1.0);
    mixer.scale.set(0.95, 0.05, 0.75);
    f3Detail.add(platterL, platterR, mixer);

    // Towering Triple-Woofer Club PA Speaker Stacks flanking DJ Stage
    [-6.8, -5.2, 5.2, 6.8].forEach((sx, sIdx) => {
      pb.addBox(sx, F3_Y + 2.1, djZ, 1.3, 4.2, 1.4, 0x090d16);
      const cone = new THREE.Mesh(cylGeo, sIdx % 2 === 0 ? nightLedPalette.violet : nightLedPalette.cyan);
      cone.rotation.x = Math.PI * 0.5;
      cone.position.set(sx, F3_Y + 2.6, djZ + 0.72);
      cone.scale.set(0.75, 0.06, 0.75);
      const subCone = cone.clone();
      subCone.position.y = F3_Y + 1.35;
      f3Detail.add(cone, subCone);
    });

    // Giant Live Equalizer DJ Club Backdrop Screen ('mansion_dj_eq')
    const { material: djScreenMat } = ctx.displays.createDisplayMaterial('mansion_dj_eq', {
      title: 'APEX SKY CLUB // LIVE DJ',
      subtitle: 'DEVELOPED BY AFTAB BALOCH DADU',
      accentHex: '#ec4899',
      intervalSec: 0.18,
      lockTitle: true,
      worldPos: { x: djX, y: F3_Y + 3.0, z: djZ - 1.9 },
    });
    const djScreen = new THREE.Mesh(boxGeo, djScreenMat);
    djScreen.position.set(djX, F3_Y + 3.0, djZ - 1.9);
    djScreen.scale.set(14.5, 4.4, 0.22);
    f3Detail.add(djScreen);

    // Glossy illuminated Dance Floor Centerpiece Grid (raised to prevent 3F->2F slab bleed)
    pb.addBox(0, F3_Y + 0.03, -354, 20, 0.06, 30, 0x090d16, 'glossy');
    addWireLedStrip(f3Detail, boxGeo, nightLedPalette.violet, -9.8, F3_Y + 0.24, -354, 0.08, 0.04, 29.5);
    addWireLedStrip(f3Detail, boxGeo, nightLedPalette.cyan, 9.8, F3_Y + 0.24, -354, 0.08, 0.04, 29.5);
    addWireLedStrip(f3Detail, boxGeo, nightLedPalette.gold, 0, F3_Y + 0.24, -339, 19.6, 0.04, 0.08);
    addWireLedStrip(f3Detail, boxGeo, nightLedPalette.emerald, 0, F3_Y + 0.24, -369, 19.6, 0.04, 0.08);

    // VIP Cold Drink & Cocktail Bar Counter (East F3: x=36, z=-340) + Neon Drink Bottles + Barstools
    pb.addBox(36, F3_Y + 0.58, -340, 2.2, 1.12, 12.0, 0x0f172a, 'glossy');
    pb.addBox(36, F3_Y + 1.18, -340, 2.5, 0.1, 12.2, 0xf8fafc, 'glossy');
    addCollider(ctx.colliders, 36, F3_Y, -340, 2.4, 1.25, 12.2);
    addWireLedStrip(f3Detail, boxGeo, nightLedPalette.cyan, 34.72, F3_Y + 1.08, -340, 0.05, 0.05, 12.0);
    // Backlit Bar Bottle Rack against x=42.8
    pb.addBox(42.6, F3_Y + 1.8, -340, 0.6, 3.4, 11.0, 0x111827);
    const bottleColors = [0x38bdf8, 0xec4899, 0x34d399, 0xfbbf24, 0xa855f7];
    for (let b = 0; b < 10; b++) {
      const bMat = mkStd(bottleColors[b % bottleColors.length], 0.15, 0.2, {
        emissive: new THREE.Color(bottleColors[b % bottleColors.length]),
        emissiveIntensity: 0.45,
      });
      const bottle = new THREE.Mesh(cylGeo, bMat);
      bottle.position.set(42.15, F3_Y + 1.95 + (b % 2) * 0.72, -344.2 + b * 0.92);
      bottle.scale.set(0.16, 0.42, 0.16);
      f3Detail.add(bottle);
    }
    // Barstools & High-Top Party Tables
    [-344, -342, -340, -338, -336].forEach((bz) => {
      const stool = new THREE.Mesh(cylGeo, charcoalMat);
      stool.position.set(34.0, F3_Y + 0.42, bz);
      stool.scale.set(0.45, 0.82, 0.45);
      f3Detail.add(stool);
    });
    // High-top VIP Club Lounge Tables (South-East F3 Hall)
    [[29, -332], [35, -355]].forEach(([htx, htz]) => {
      pb.addBox(htx, F3_Y + 0.55, htz, 1.3, 1.05, 1.3, 0x1e293b, 'glossy');
      addWireLedStrip(f3Detail, boxGeo, nightLedPalette.violet, htx, F3_Y + 1.09, htz, 1.32, 0.04, 1.32);
    });

    // Overhead Club Lighting Truss + Rotating Volumetric Party Light Beams (strictly above F3 floor; zero bleed into 2F ceiling)
    pb.addBox(0, F3_Y + 5.15, -356, 22, 0.18, 0.22, 0x334155);
    pb.addBox(0, F3_Y + 5.15, -370, 22, 0.18, 0.22, 0x334155);
    const beamGeo = new THREE.ConeGeometry(2.0, 4.2, 12, 1, true);
    ctx.geometries.push(beamGeo);
    const beamSpots: Array<{ cone: THREE.Mesh; baseX: number; baseZ: number; phase: number }> = [];
    const beamHexes = [0xec4899, 0x22d3ee, 0xa855f7, 0xfbbf24];
    [-7, -2.5, 2.5, 7].forEach((bx, bi) => {
      const bMat = new THREE.MeshBasicMaterial({
        color: beamHexes[bi % beamHexes.length],
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      ctx.materials.push(bMat);
      const cone = new THREE.Mesh(beamGeo, bMat);
      cone.position.set(bx, F3_Y + 2.85, -356 - (bi % 2) * 12);
      f3Detail.add(cone);
      beamSpots.push({ cone, baseX: bx, baseZ: cone.position.z, phase: bi * 1.4 });
    });

    const useClubPointLights = !ctx.graphicsQuality || ctx.graphicsQuality === 'high';
    const clubLightA = useClubPointLights ? new THREE.PointLight(0xec4899, 4.2, 22, 1.5) : null;
    const clubLightB = useClubPointLights ? new THREE.PointLight(0x22d3ee, 4.2, 22, 1.5) : null;
    if (clubLightA && clubLightB) {
      clubLightA.position.set(-4, F3_Y + 3.9, -366);
      clubLightB.position.set(4, F3_Y + 3.9, -348);
      f3Detail.add(clubLightA, clubLightB);
    }

    animatedUpdaters.push((_dt, elapsed) => {
      const visible = f3Detail.visible;
      if (clubLightA && clubLightB) {
        clubLightA.visible = visible;
        clubLightB.visible = visible;
      }
      if (!visible) return;
      platterL.rotation.y = elapsed * 3.4;
      platterR.rotation.y = -elapsed * 3.4;
      for (let i = 0; i < beamSpots.length; i++) {
        const bs = beamSpots[i];
        bs.cone.rotation.z = Math.sin(elapsed * 2.1 + bs.phase) * 0.42;
        bs.cone.rotation.x = Math.cos(elapsed * 1.7 + bs.phase) * 0.34;
      }
      if (clubLightA && clubLightB) {
        const hueA = (elapsed * 0.18) % 1;
        const hueB = (elapsed * 0.18 + 0.5) % 1;
        clubLightA.color.setHSL(hueA, 0.9, 0.58);
        clubLightB.color.setHSL(hueB, 0.9, 0.58);
      }
    });
  }

  // =========================================================================
  // 7. FLOOR 4 ROOFTOP (y = 17.4): SKY TERRACE SUNSET LOUNGE + 4F HELIPAD DECK
  // =========================================================================
  {
    const hy = F4_Y;
    // 4F Rooftop Helipad Deck (MANSION_HELIPAD_COORDS: x=-24, z=-370, deckY = F4_Y + 0.22)
    {
      const hx = MANSION_HELIPAD_COORDS.x;
      const hz = MANSION_HELIPAD_COORDS.z;
      const padBase = new THREE.Mesh(cylGeo, charcoalMat);
      padBase.position.set(hx, hy + 0.11, hz);
      padBase.scale.set(16.8, 0.22, 16.8);
      const padDeck = new THREE.Mesh(cylGeo, mkStd(0x1f2937, 0.52, 0.18));
      padDeck.position.set(hx, hy + 0.16, hz);
      padDeck.scale.set(15.2, 0.12, 15.2);
      const padRing = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.1, 8, 36), nightLedPalette.cyan);
      padRing.rotation.x = Math.PI * 0.5;
      padRing.position.set(hx, hy + 0.24, hz);
      ctx.geometries.push(padRing.geometry);
      root.add(padBase, padDeck, padRing);
      // Crisp glowing H marking + 8 perimeter beacons
      addWireLedStrip(root, boxGeo, nightLedPalette.gold, hx, hy + 0.23, hz, 3.6, 0.04, 0.65);
      addWireLedStrip(root, boxGeo, nightLedPalette.gold, hx - 1.75, hy + 0.23, hz, 0.65, 0.04, 5.2);
      addWireLedStrip(root, boxGeo, nightLedPalette.gold, hx + 1.75, hy + 0.23, hz, 0.65, 0.04, 5.2);
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        addWireLedStrip(
          root,
          boxGeo,
          k % 2 === 0 ? nightLedPalette.gold : nightLedPalette.cyan,
          hx + Math.cos(ang) * 7.8,
          hy + 0.25,
          hz + Math.sin(ang) * 7.8,
          0.24,
          0.12,
          0.24,
        );
      }
      ctx.ramps.push({
        minX: hx - 7.8,
        maxX: hx + 7.8,
        minZ: hz - 7.8,
        maxZ: hz + 7.8,
        axis: 'x',
        startCoord: hx - 7.8,
        endCoord: hx + 7.8,
        startY: MANSION_HELIPAD_COORDS.deckY,
        endY: MANSION_HELIPAD_COORDS.deckY,
      });
    }

    // Second 4F Rooftop Helipad Deck (MANSION_HELIPAD_2_COORDS: x=33, z=-377, deckY = F4_Y + 0.22)
    {
      const hx = MANSION_HELIPAD_2_COORDS.x;
      const hz = MANSION_HELIPAD_2_COORDS.z;
      const padBase = new THREE.Mesh(cylGeo, charcoalMat);
      padBase.position.set(hx, hy + 0.11, hz);
      padBase.scale.set(14.4, 0.22, 14.4);
      const padDeck = new THREE.Mesh(cylGeo, mkStd(0x1f2937, 0.52, 0.18));
      padDeck.position.set(hx, hy + 0.16, hz);
      padDeck.scale.set(13.2, 0.12, 13.2);
      const padRing = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.1, 8, 36), nightLedPalette.gold);
      padRing.rotation.x = Math.PI * 0.5;
      padRing.position.set(hx, hy + 0.24, hz);
      ctx.geometries.push(padRing.geometry);
      root.add(padBase, padDeck, padRing);
      // Crisp glowing H marking + 8 perimeter beacons
      addWireLedStrip(root, boxGeo, nightLedPalette.cyan, hx, hy + 0.23, hz, 3.1, 0.04, 0.58);
      addWireLedStrip(root, boxGeo, nightLedPalette.cyan, hx - 1.5, hy + 0.23, hz, 0.58, 0.04, 4.4);
      addWireLedStrip(root, boxGeo, nightLedPalette.cyan, hx + 1.5, hy + 0.23, hz, 0.58, 0.04, 4.4);
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        addWireLedStrip(
          root,
          boxGeo,
          k % 2 === 0 ? nightLedPalette.cyan : nightLedPalette.gold,
          hx + Math.cos(ang) * 6.7,
          hy + 0.25,
          hz + Math.sin(ang) * 6.7,
          0.22,
          0.12,
          0.22,
        );
      }
      ctx.ramps.push({
        minX: hx - 6.8,
        maxX: hx + 6.8,
        minZ: hz - 6.8,
        maxZ: hz + 6.8,
        axis: 'x',
        startCoord: hx - 6.8,
        endCoord: hx + 6.8,
        startY: MANSION_HELIPAD_2_COORDS.deckY,
        endY: MANSION_HELIPAD_2_COORDS.deckY,
      });
    }

    // Center Rooftop Illuminated Fire-Pit Lounge & Sofa Deck + Woven Cushions
    pb.addBox(0, hy + 0.24, -352, 10.5, 0.42, 10.5, 0xf3ece0, 'glossy');
    pb.addBox(0, hy + 0.52, -352, 3.2, 0.36, 3.2, 0x1d222b);
    addWireLedStrip(root, boxGeo, nightLedPalette.gold, 0, hy + 0.72, -352, 2.8, 0.05, 2.8);
    [[-3.8, -352], [3.8, -352], [0, -355.8], [0, -348.2]].forEach(([sx, sz], idx) => {
      const ew = idx < 2 ? 1.3 : 5.4;
      const ed = idx < 2 ? 5.4 : 1.3;
      pb.addBox(sx, hy + 0.65, sz, ew, 0.45, ed, 0xd8cfc4);
      pb.addBox(sx, hy + 0.96, sz, ew * 0.72, 0.22, ed * 0.72, idx % 2 === 0 ? 0xc26d47 : 0x475569);
    });

    // Rooftop Perimeter Frameless Glass Safety Balustrade (full unbroken 360-degree glass parapet)
    pb.addBox(0, hy + 0.62, -324.2, 88, 1.2, 0.14, 0xbae6fd, 'glass');
    pb.addBox(-43.8, hy + 0.62, -356, 0.14, 1.2, 64, 0xbae6fd, 'glass');
    pb.addBox(43.8, hy + 0.62, -356, 0.14, 1.2, 64, 0xbae6fd, 'glass');
    pb.addBox(0, hy + 0.62, -387.8, 88, 1.2, 0.14, 0xbae6fd, 'glass');
    addCollider(ctx.colliders, 0, hy, -324.2, 88, 1.2, 0.3);
    addCollider(ctx.colliders, -43.8, hy, -356, 0.3, 1.2, 64);
    addCollider(ctx.colliders, 43.8, hy, -356, 0.3, 1.2, 64);
    addCollider(ctx.colliders, 0, hy, -387.8, 88, 1.2, 0.3);

    // Rooftop West Sunset Lounge Pergola + Resort Daybeds & Lantern Planters (clear of NW helipad at -24,-370)
    pb.addBox(-30, hy + 0.35, -338, 6.2, 0.55, 6.2, 0xf3ece0);
    pb.addBox(-30, hy + 3.2, -338, 8.5, 0.25, 8.5, 0x1e293b);
    [-34, -26].forEach((px) => {
      [-342, -334].forEach((pz) => {
        pb.addBox(px, hy + 1.6, pz, 0.25, 3.2, 0.25, 0x1e293b);
      });
    });
    // Corner Rooftop Palm Planters + East Sunset Lounge Chairs
    [[-40, -328], [40, -328], [-40, -384], [40, -384]].forEach(([plx, plz]) => {
      pb.addBox(plx, hy + 0.45, plz, 1.5, 0.9, 1.5, 0x78350f);
      const palm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), mkStd(0x15803d, 0.62, 0.02));
      palm.position.set(plx, hy + 1.55, plz);
      root.add(palm);
    });
    [[28, -336], [34, -336], [28, -343], [34, -343]].forEach(([lx, lz]) => {
      pb.addBox(lx, hy + 0.3, lz, 1.4, 0.42, 2.4, 0xf5f5f4);
      pb.addBox(lx, hy + 0.62, lz - 0.85, 1.35, 0.35, 0.55, 0xf59e0b);
    });
  }

  // Interactive Mansion Master Light Theme Console inside Ground Lobby
  let ledThemeIdx = 0;
  const themes = [
    { name: 'Royal Gold & Cyan', gold: 0xfbbf24, cyan: 0x38bdf8, violet: 0xc084fc },
    { name: 'Cyber Neon Pulse', gold: 0xf43f5e, cyan: 0x22d3ee, violet: 0xa855f7 },
    { name: 'Emerald Oasis', gold: 0x34d399, cyan: 0x2dd4bf, violet: 0xfbbf24 },
  ];
  ctx.interactables.push({
    id: 'mansion_lighting_console',
    x: -11.5,
    y: 0,
    z: -332,
    radius: 3.2,
    category: 'shop',
    getLabel: () => 'Cycle Mansion Wire-LED Mood Lighting',
    trigger: () => {
      ledThemeIdx = (ledThemeIdx + 1) % themes.length;
      const th = themes[ledThemeIdx];
      nightLedPalette.gold.color.setHex(th.gold);
      nightLedPalette.gold.emissive.setHex(th.gold);
      nightLedPalette.cyan.color.setHex(th.cyan);
      nightLedPalette.cyan.emissive.setHex(th.cyan);
      nightLedPalette.violet.color.setHex(th.violet);
      nightLedPalette.violet.emissive.setHex(th.violet);
      return `Mansion LEDs set to ${th.name}`;
    },
  });

  // Compile all merged static architectural geometry in one high-speed PBR pass
  const propMats = createPropPbrMaterials(false);
  const compiled = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  root.add(compiled.group);
  ctx.geometries.push(...compiled.geometries);
  ctx.materials.push(...propMats.all, ...compiled.materials);
  ctx.shootableEnv.push(compiled.group);

  // Subtle breathing night shimmer on colorful wire LED strips (clamped, non-cumulative)
  animatedUpdaters.push((_dt, elapsed) => {
    const wave = 0.94 + Math.sin(elapsed * 2.2) * 0.06;
    nightLedPalette.cyan.emissiveIntensity = Math.min(1.85, Math.max(0.25, nightLedPalette.cyan.emissiveIntensity) * wave + 0.02);
  });

  void MANSION_BUILDING_BOUNDS;
  return {
    roomLightMats,
    animatedUpdaters,
  };
}
