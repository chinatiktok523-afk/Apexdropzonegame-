import * as THREE from 'three';
import { addCollider } from './arena';
import type { SimWorldBuildContext } from './buildingsAndTransit';
import {
  MANSION_BUILDING_BOUNDS,
  MANSION_GARAGE_BOUNDS,
  MANSION_LEVEL_2_Y,
  MANSION_LEVEL_3_Y,
  MANSION_PLOT_BOUNDS,
  MANSION_ROOF_Y,
  computeWireLedScale,
  stepProximityPortal,
} from './mansionSystems';
import { buildMansionInteriorsAndRooftop } from './mansionInteriors';
import { PropMeshAssembler, createPropPbrMaterials } from './urbanProps';
import { MANSION_POOL_BOUNDS } from './swimmingPhysics';

export interface MansionProximityPortal {
  id: string;
  x: number;
  z: number;
  open: number;
  openRadius: number;
  closeRadius: number;
  updateVisualAndCollider: (openAmount: number, colliderActive: boolean) => void;
}

export interface MansionBuildResult {
  portals: MansionProximityPortal[];
  updateProximityPortals: (
    playerX: number,
    playerZ: number,
    drivenX: number | null,
    drivenZ: number | null,
    dt: number,
    extraActors?: ReadonlyArray<{ x: number; z: number }>,
  ) => void;
}

/**
 * Builds the complete 4-Level Ultra-Luxury Modern Mansion Exterior, Thin Wire-Like Colorful Night LEDs,
 * Landscaped Estate Courtyard, Animated Tiered Water Fountain, Glowing Infinity Swimming Pool,
 * Private Glass Supercar Showroom Garage, and Proximity-Sensor Main Gate + Foyer Entrance Doors.
 */
export function buildLuxuryMansionProperty(ctx: SimWorldBuildContext): MansionBuildResult {
  const root = new THREE.Group();
  ctx.arenaGroup.add(root);
  ctx.lodDetailGroups.push({
    group: root,
    x: 0,
    y: 12,
    z: -340,
    radius: 115,
    maxDist: 250,
    tier: 'district',
  });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
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

  const makeWireLedMat = (dayHex: number, nightHex: number, nightIntensity: number) => {
    const mat = mkStd(dayHex, 0.14, 0.1, {
      emissive: new THREE.Color(nightHex),
      emissiveIntensity: 0.25,
      toneMapped: false,
    });
    ctx.nightGlowMats?.push({ mat, nightHex, dayHex, nightIntensity });
    return mat;
  };

  // Balanced thin wire-like colorful night LED materials (crisp visibility without night glare)
  const ledGold = makeWireLedMat(0xf59e0b, 0xfbbf24, 1.55);
  const ledCyan = makeWireLedMat(0x0ea5e9, 0x22d3ee, 1.65);
  const ledViolet = makeWireLedMat(0xa855f7, 0xe879f9, 1.6);
  const ledEmerald = makeWireLedMat(0x10b981, 0x34d399, 1.45);
  const ledWarmWhite = makeWireLedMat(0xfef3c7, 0xfff7ed, 1.35);
  const ledRuby = makeWireLedMat(0xf43f5e, 0xfb7185, 1.55);

  // Flowing multi-phase emissive strips for dynamic wall & ceiling lines (wave-animated)
  const garageLineMats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 6; i++) {
    const gm = mkStd(i % 2 === 0 ? 0xe0f2fe : 0xbae6fd, 0.12, 0.1, {
      emissive: new THREE.Color(i % 3 === 0 ? 0x38bdf8 : i % 3 === 1 ? 0xf8fafc : 0x818cf8),
      emissiveIntensity: 0.65,
      toneMapped: false,
    });
    garageLineMats.push(gm);
  }
  const flowingWallMats: Array<{ mat: THREE.MeshStandardMaterial; nightHex: number; phase: number }> = [
    { mat: mkStd(0x22d3ee, 0.14, 0.1, { emissive: new THREE.Color(0x22d3ee), emissiveIntensity: 0.55, toneMapped: false }), nightHex: 0x22d3ee, phase: 0 },
    { mat: mkStd(0xfbbf24, 0.14, 0.1, { emissive: new THREE.Color(0xfbbf24), emissiveIntensity: 0.55, toneMapped: false }), nightHex: 0xfbbf24, phase: 1.55 },
    { mat: mkStd(0xe879f9, 0.14, 0.1, { emissive: new THREE.Color(0xe879f9), emissiveIntensity: 0.55, toneMapped: false }), nightHex: 0xe879f9, phase: 3.1 },
    { mat: mkStd(0x34d399, 0.14, 0.1, { emissive: new THREE.Color(0x34d399), emissiveIntensity: 0.55, toneMapped: false }), nightHex: 0x34d399, phase: 4.65 },
  ];

  const whiteStuccoMat = mkStd(0xf7f5f0, 0.38, 0.04, {
    ...(ctx.textures?.facadeModernPanel ? { map: ctx.textures.facadeModernPanel } : {}),
  });
  const darkCharcoalMat = mkStd(0x1d222b, 0.44, 0.32);
  const woodAccentMat = mkStd(0x7c4a26, 0.56, 0.06, {
    ...(ctx.textures?.woodPlank ? { map: ctx.textures.woodPlank } : {}),
  });
  const marblePavMat = mkStd(0xe8e2d8, 0.36, 0.06, {
    ...(ctx.textures?.mallMarbleTile ? { map: ctx.textures.mallMarbleTile } : {}),
  });
  const clearGlassMat = mkStd(0x9bd7f8, 0.06, 0.25, {
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const brushedGoldMat = mkStd(0xd99b26, 0.22, 0.85);
  const poolWaterMat = mkStd(0x06b6d4, 0.08, 0.2, {
    transparent: true,
    opacity: 0.78,
    emissive: new THREE.Color(0x0891b2),
    emissiveIntensity: 0.18,
  });
  ctx.nightGlowMats?.push({
    mat: poolWaterMat,
    nightHex: 0x22d3ee,
    dayHex: 0x06b6d4,
    nightIntensity: 0.62,
  });

  const pb = new PropMeshAssembler();
  const portals: MansionProximityPortal[] = [];

  const addWire = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.MeshStandardMaterial,
  ) => {
    const scaled = computeWireLedScale(w, h, d);
    const m = new THREE.Mesh(boxGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(scaled.w, scaled.h, scaled.d);
    root.add(m);
    return m;
  };

  // =========================================================================
  // 1. BILLIONAIRE SYMMETRICAL ENTRANCE BOULEVARD & ESTATE LANDSCAPED GROUNDS
  // =========================================================================
  // Wide smooth luxury asphalt road spur (z=-206..-248) with road markings & Carrara marble sidewalks
  pb.addBox(0, 0.02, -227, 16.0, 0.06, 44, 0x262c36);
  // Crisp dashed white lane divider & gold curb accents along both sides of front road
  for (let mz = -244; mz <= -208; mz += 4.5) {
    pb.addBox(0, 0.055, mz, 0.22, 0.02, 2.4, 0xf8fafc);
  }
  pb.addBox(-7.8, 0.055, -227, 0.18, 0.02, 43, 0xfbbf24);
  pb.addBox(7.8, 0.055, -227, 0.18, 0.02, 43, 0xfbbf24);
  // Elevated Carrara marble sidewalks flanking the front boulevard
  pb.addBox(-10.4, 0.05, -227, 4.6, 0.12, 44, 0xeae4da, 'glossy');
  pb.addBox(10.4, 0.05, -227, 4.6, 0.12, 44, 0xeae4da, 'glossy');
  addWire(-8.1, 0.12, -227, 0.06, 0.04, 43, ledGold);
  addWire(8.1, 0.12, -227, 0.06, 0.04, 43, ledGold);

  // Symmetrical manicured emerald gardens & decorative walls along BOTH sides of approach road (z=-248..-206)
  pb.addBox(-50.3, -0.02, -227, 75.4, 0.12, 44, 0x3b7a38);
  pb.addBox(50.3, -0.02, -227, 75.4, 0.12, 44, 0x3b7a38);
  // Decorative low stone garden walls along outer boulevard sidewalks
  [-13.0, 13.0].forEach((gx) => {
    pb.addBox(gx, 0.55, -227, 0.45, 1.1, 42, 0xf3efe6);
    addWire(gx, 1.14, -227, 0.08, 0.06, 42, ledGold);
  });

  // Symmetrical Billionaire Entrance Features on BOTH sides: Modern Golden LED Streetlights,
  // Marble Planters with Flowers, Sculptural Pillars, and Illuminated Black-Marble Waterfalls
  [-242, -230, -218].forEach((lz) => {
    [-10.6, 10.6].forEach((lx) => {
      const sign = lx < 0 ? 1 : -1;
      pb.addBox(lx, 2.4, lz, 0.22, 4.8, 0.22, 0x1d222b);
      pb.addBox(lx + sign * 0.9, 4.85, lz, 1.9, 0.16, 0.24, 0xd99b26);
      addWire(lx + sign * 1.5, 4.72, lz, 0.85, 0.08, 0.22, ledWarmWhite);
      addWire(lx, 2.4, lz + 0.14, 0.05, 4.2, 0.05, ledGold);
    });
  });

  // Flanking Grand Illuminated Waterfall Fountains & Flower Beds along both sides of Front Road (z=-236 & z=-220)
  [-1, 1].forEach((side) => {
    const fx = side * 22.5;
    const fz = -236;
    pb.addBox(fx, 0.28, fz, 9.6, 0.52, 6.4, 0x111827, 'glossy'); // Dark basalt pool basin
    pb.addBox(fx, 1.95, fz - 2.6, 8.8, 3.6, 0.75, 0x1d222b); // Waterfall monument backwall
    pb.addBox(fx, 3.85, fz - 2.6, 9.2, 0.25, 1.0, 0xd99b26); // Gold cap
    const waterSheet = new THREE.Mesh(boxGeo, poolWaterMat);
    waterSheet.position.set(fx, 1.85, fz - 2.15);
    waterSheet.scale.set(7.8, 3.2, 0.14);
    const basinSurf = new THREE.Mesh(boxGeo, poolWaterMat);
    basinSurf.position.set(fx, 0.48, fz);
    basinSurf.scale.set(8.8, 0.14, 5.6);
    root.add(waterSheet, basinSurf);
    addWire(fx, 3.65, fz - 2.12, 8.2, 0.06, 0.06, ledGold);
    addWire(fx, 0.56, fz + 2.8, 8.8, 0.06, 0.06, ledCyan);
    addCollider(ctx.colliders, fx, 0, fz, 9.6, 3.8, 6.4);

    // Oversized Marble Flower Planters + Golden Modern Sculptures
    [-222, -212].forEach((pz, pIdx) => {
      const px = side * (pIdx === 0 ? 17.5 : 26.5);
      pb.addBox(px, 0.45, pz, 3.4, 0.9, 2.2, 0xf3efe6, 'glossy');
      pb.addBox(px, 0.98, pz, 2.9, 0.28, 1.7, 0x166534);
      pb.addBox(px - 0.7, 1.18, pz, 0.45, 0.25, 0.45, 0xf43f5e);
      pb.addBox(px + 0.1, 1.2, pz + 0.2, 0.45, 0.28, 0.45, 0xfbbf24);
      pb.addBox(px + 0.8, 1.18, pz - 0.2, 0.45, 0.25, 0.45, 0xa855f7);
      if (pIdx === 0) {
        // Modern golden sculpture monolith
        const sculpt = new THREE.Mesh(cylGeo, brushedGoldMat);
        sculpt.position.set(side * 25.5, 1.7, -220);
        sculpt.scale.set(0.55, 3.2, 0.55);
        const sculptRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.12, 8, 20), brushedGoldMat);
        sculptRing.position.set(side * 25.5, 2.8, -220);
        ctx.geometries.push(sculptRing.geometry);
        root.add(sculpt, sculptRing);
      }
    });
  });

  // Estate Full Ground Base Apron SPLIT AROUND SWIMMING POOL CUTOUT (x=19..53, z=-311..-273 remains open pit!)
  pb.addBox(-34.5, -0.02, -340, 107, 0.14, 190, 0x3b7a38); // West lawn & building pad (x=-88..19)
  pb.addBox(70.5, -0.02, -340, 35, 0.14, 190, 0x3b7a38); // East lawn strip (x=53..88)
  pb.addBox(36, -0.02, -259, 34, 0.14, 28, 0x3b7a38); // South of pool (z=-273..-245)
  pb.addBox(36, -0.02, -373, 34, 0.14, 124, 0x3b7a38); // North of pool under east wing (z=-435..-311)

  // Travertine Marble Driveway + Grand Arrival Courtyard
  pb.addBox(0, 0.04, -284, 13.5, 0.09, 78, 0xeae4da, 'glossy');
  pb.addBox(0, 0.05, -288, 34, 0.09, 28, 0xece6dc, 'glossy'); // Fountain arrival plaza
  pb.addBox(0, 0.06, -318, 92, 0.12, 16, 0xf2ede4, 'glossy'); // Front Entrance Promenade
  // Showroom Forecourt Apron connecting Driveway -> Private Garage & Showcase Hypercar Pad
  pb.addBox(-42, 0.055, -305, 68, 0.1, 24, 0xe5dfd4, 'glossy');

  // Symmetrical Perimeter Estate Boundary Walls with Pillars, Warm Sconces & Thin Gold Wire Accents
  const wallH = 3.2;
  // South boundary (z=-248) flush into both gate pillars at ±9.0 (zero left/right wall gap)
  pb.addBox(-48.5, wallH * 0.5, -248, 80, wallH, 0.75, 0xf3efe6);
  pb.addBox(48.5, wallH * 0.5, -248, 80, wallH, 0.75, 0xf3efe6);
  addCollider(ctx.colliders, -48.5, 0, -248, 80, wallH, 0.9);
  addCollider(ctx.colliders, 48.5, 0, -248, 80, wallH, 0.9);
  // West Boundary Wall split cleanly beside Garage (opening z = -406.5 .. -389.5) leading directly to Smart City Gate 1
  // South segment: z in [-389.5 .. -247] (centerZ = -318.25, len = 142.5)
  pb.addBox(-88, wallH * 0.5, -318.25, 0.75, wallH, 142.5, 0xf3efe6);
  addCollider(ctx.colliders, -88, 0, -318.25, 0.9, wallH, 142.5);
  // North segment: z in [-433 .. -406.5] (centerZ = -419.75, len = 26.5)
  pb.addBox(-88, wallH * 0.5, -419.75, 0.75, wallH, 26.5, 0xf3efe6);
  addCollider(ctx.colliders, -88, 0, -419.75, 0.9, wallH, 26.5);
  // Twin Marble Portal Pillars framing the Mansion-to-Smart-City Garage Gate Opening + Driveway Spur
  [-407.0, -389.0].forEach((pz) => {
    pb.addBox(-88, 2.3, pz, 1.9, 4.6, 1.9, 0xf7f5f0, 'glossy');
    pb.addBox(-88, 4.7, pz, 2.2, 0.28, 2.2, 0xd99b26);
    addWire(-87.0, 2.3, pz, 0.08, 3.8, 0.08, ledGold);
    addWire(-89.0, 2.3, pz, 0.08, 3.8, 0.08, ledCyan);
    addCollider(ctx.colliders, -88, 0, pz, 2.0, 4.6, 2.0);
  });
  pb.addBox(-88, 5.1, -398, 1.6, 0.55, 19.6, 0x2b313a);
  addWire(-88, 4.78, -398, 0.14, 0.08, 17.8, ledWarmWhite);

  // Automatic Sliding Mansion-West Garage Gate (x = -88, z = -398) leading onto elevated Smart City Road
  {
    const gateWL = new THREE.Mesh(boxGeo, darkCharcoalMat);
    gateWL.scale.set(0.28, 3.6, 8.2);
    gateWL.position.set(-88, 1.85, -398 - 4.1);
    const gateWR = new THREE.Mesh(boxGeo, darkCharcoalMat);
    gateWR.scale.set(0.28, 3.6, 8.2);
    gateWR.position.set(-88, 1.85, -398 + 4.1);

    const barWL = new THREE.Mesh(boxGeo, ledCyan);
    barWL.scale.set(1.15, 0.05, 0.94);
    gateWL.add(barWL);
    const barWR = new THREE.Mesh(boxGeo, ledCyan);
    barWR.scale.set(1.15, 0.05, 0.94);
    gateWR.add(barWR);
    const goldTopWL = new THREE.Mesh(boxGeo, brushedGoldMat);
    goldTopWL.position.y = 0.48;
    goldTopWL.scale.set(1.12, 0.035, 0.98);
    gateWL.add(goldTopWL);
    const goldTopWR = goldTopWL.clone();
    gateWR.add(goldTopWR);
    root.add(gateWL, gateWR);

    const colTarget = ctx.dynamicColliders ?? ctx.colliders;
    addCollider(colTarget, -88, 0, -398 - 4.1, 0.65, 3.8, 8.2, 0, 'metal');
    const leftLeafCol = colTarget[colTarget.length - 1];
    addCollider(colTarget, -88, 0, -398 + 4.1, 0.65, 3.8, 8.2, 0, 'metal');
    const rightLeafCol = colTarget[colTarget.length - 1];

    portals.push({
      id: 'mansion_west_smartcity_gate',
      x: -88,
      z: -398,
      open: 0,
      openRadius: 12.5,
      closeRadius: 17.5,
      updateVisualAndCollider: (openAmt, _colliderActive) => {
        const slide = openAmt * 7.6;
        const czL = -398 - 4.1 - slide;
        const czR = -398 + 4.1 + slide;
        gateWL.position.z = czL;
        gateWR.position.z = czR;
        const leafActive = openAmt < 0.72;
        leftLeafCol.cz = czL;
        leftLeafCol.minZ = czL - 4.1;
        leftLeafCol.maxZ = czL + 4.1;
        leftLeafCol.maxY = leafActive ? 3.8 : -100;
        rightLeafCol.cz = czR;
        rightLeafCol.minZ = czR - 4.1;
        rightLeafCol.maxZ = czR + 4.1;
        rightLeafCol.maxY = leafActive ? 3.8 : -100;
      },
    });
  }

  // East-side Garage border apron (kept east of the raised Smart City connecting road so zero overlap!)
  pb.addBox(-73.5, 0.05, -354, 4.2, 0.1, 84, 0xe5dfd4, 'glossy');

  // East & North boundary walls
  pb.addBox(88, wallH * 0.5, -340, 0.75, wallH, 186, 0xf3efe6);
  pb.addBox(0, wallH * 0.5, -432, 176, wallH, 0.75, 0xf3efe6);
  addCollider(ctx.colliders, 88, 0, -340, 0.9, wallH, 186);
  addCollider(ctx.colliders, 0, 0, -432, 176, wallH, 0.9);

  // Decorative Perimeter & Driveway Glowing Wire LED Lines (clear of door thresholds)
  addWire(-48.5, wallH + 0.08, -248, 79, 0.08, 0.08, ledGold);
  addWire(48.5, wallH + 0.08, -248, 79, 0.08, 0.08, ledGold);
  // Sleek cyan & gold wire strips framing the grand marble arrival driveway
  addWire(-6.75, 0.12, -284, 0.08, 0.06, 74, ledCyan);
  addWire(6.75, 0.12, -284, 0.08, 0.06, 74, ledGold);
  // Promenade architectural floor wire accent before front steps
  addWire(0, 0.14, -310.2, 90, 0.06, 0.08, ledGold);

  // =========================================================================
  // 2. PROXIMITY-SENSOR AUTOMATIC MAIN ESTATE GATE (z = -248) + NIGHT LIGHTING
  // =========================================================================
  {
    [-9.0, 9.0].forEach((px, pIdx) => {
      pb.addBox(px, 2.7, -248, 2.1, 5.4, 2.1, 0xf7f5f0, 'glossy');
      pb.addBox(px, 5.55, -248, 2.45, 0.3, 2.45, 0xd99b26);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 10), ledWarmWhite);
      orb.position.set(px, 6.1, -248);
      ctx.geometries.push(orb.geometry);
      root.add(orb);
      // Night gate pillar glowing sconces (front & estate-facing sides)
      addWire(px, 2.8, -246.9, 0.08, 4.4, 0.08, ledGold);
      addWire(px, 2.8, -249.1, 0.08, 4.4, 0.08, ledGold);
      addWire(px + (pIdx === 0 ? 1.08 : -1.08), 3.6, -248, 0.08, 2.4, 0.42, ledWarmWhite);
      addCollider(ctx.colliders, px, 0, -248, 2.2, 5.4, 2.2);
    });

    const gateL = new THREE.Mesh(boxGeo, darkCharcoalMat);
    gateL.scale.set(8.4, 3.4, 0.24);
    gateL.position.set(-4.1, 1.75, -248);
    const gateR = new THREE.Mesh(boxGeo, darkCharcoalMat);
    gateR.scale.set(8.4, 3.4, 0.24);
    gateR.position.set(4.1, 1.75, -248);

    // Thin gold geometric bars + glowing crest strip across gate leaves
    const barL = new THREE.Mesh(boxGeo, brushedGoldMat);
    barL.scale.set(1.0, 0.04, 1.12);
    gateL.add(barL);
    const barR = barL.clone();
    gateR.add(barR);
    root.add(gateL, gateR);

    addCollider(ctx.colliders, 0, 0, -248, 16.4, 3.6, 0.45);
    const gateCollider = ctx.colliders[ctx.colliders.length - 1];
    const origMinX = gateCollider.minX;
    const origMaxX = gateCollider.maxX;

    portals.push({
      id: 'mansion_main_gate',
      x: 0,
      z: -248,
      open: 0,
      openRadius: 11.5,
      closeRadius: 15.5,
      updateVisualAndCollider: (openAmt, colliderActive) => {
        gateL.position.x = -4.1 - openAmt * 7.5;
        gateR.position.x = 4.1 + openAmt * 7.5;
        if (colliderActive) {
          gateCollider.minX = origMinX;
          gateCollider.maxX = origMaxX;
        } else {
          gateCollider.minX = 99999;
          gateCollider.maxX = 99998;
        }
      },
    });
  }

  // =========================================================================
  // 3. CENTRAL CIRCULAR ANIMATED WATER FOUNTAIN (0, -288)
  // =========================================================================
  {
    const fx = 0;
    const fz = -288;
    const outerRim = new THREE.Mesh(cylGeo, marblePavMat);
    outerRim.position.set(fx, 0.26, fz);
    outerRim.scale.set(10.6, 0.46, 10.6);
    const waterBasin = new THREE.Mesh(cylGeo, poolWaterMat);
    waterBasin.position.set(fx, 0.42, fz);
    waterBasin.scale.set(9.4, 0.26, 9.4);
    const pedestal = new THREE.Mesh(cylGeo, marblePavMat);
    pedestal.position.set(fx, 1.15, fz);
    pedestal.scale.set(1.3, 1.8, 1.3);
    const bowl = new THREE.Mesh(cylGeo, marblePavMat);
    bowl.position.set(fx, 1.9, fz);
    bowl.scale.set(3.4, 0.34, 3.4);

    // Animated rising water jet column + 4 parabolic arc plumes + cyan ring LED glow
    const jetMat = mkStd(0xe0f2fe, 0.08, 0.1, {
      transparent: true,
      opacity: 0.78,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 0.45,
    });
    const centerJet = new THREE.Mesh(cylGeo, jetMat);
    centerJet.position.set(fx, 2.9, fz);
    centerJet.scale.set(0.32, 2.2, 0.32);

    const sprayRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.05, 8, 28),
      ledCyan,
    );
    sprayRing.rotation.x = Math.PI * 0.5;
    sprayRing.position.set(fx, 0.56, fz);
    ctx.geometries.push(sprayRing.geometry);

    root.add(outerRim, waterBasin, pedestal, bowl, centerJet, sprayRing);
    addCollider(ctx.colliders, fx, 0, fz, 10.4, 1.5, 10.4);

    ctx.updaters.push((_dt, elapsed) => {
      const pulse = 1 + Math.sin(elapsed * 4.5) * 0.22;
      centerJet.scale.set(0.28 + Math.sin(elapsed * 6) * 0.04, 2.1 * pulse, 0.28);
      centerJet.position.y = 2.0 + 1.05 * pulse;
    });
  }

  // =========================================================================
  // 4. DYNAMIC DEEP SWIMMING POOL + ANIMATED WAVE WATER & UNDERWATER LEDs (x=20..52, z=-310..-274)
  // =========================================================================
  {
    const { minX, maxX, minZ, maxZ, waterY } = MANSION_POOL_BOUNDS;
    const midX = (minX + maxX) * 0.5; // 36
    const midZ = (minZ + maxZ) * 0.5; // -292
    const poolW = maxX - minX; // 32
    const poolD = maxZ - minZ; // 36

    // 4 Separate Hollow Marble Coping Deck Borders framing the open water pit (NEVER covers pit center!)
    pb.addBox(18.5, 0.17, midZ, 3.0, 0.34, 42, 0xf2eee6, 'glossy'); // West edge (x=17..20)
    pb.addBox(53.4, 0.17, midZ, 2.8, 0.34, 42, 0xf2eee6, 'glossy'); // East edge (x=52..54.8)
    pb.addBox(midX, 0.17, minZ - 1.5, poolW, 0.34, 3.0, 0xf2eee6, 'glossy'); // North edge (z=-313..-310)
    pb.addBox(midX, 0.17, maxZ + 1.5, poolW, 0.34, 3.0, 0xf2eee6, 'glossy'); // South edge (z=-274..-271)

    // Sunken Tiled Basin Inner Walls & Sloped Floor Plates (-1.15m shallow west -> -2.85m deep east)
    pb.addBox(22.5, -1.25, midZ, 5.2, 0.2, poolD, 0x0e7490); // Shallow shelf bed (y=-1.15)
    pb.addBox(43.0, -2.95, midZ, 18.2, 0.2, poolD, 0x0c4a6e); // Deep plunge floor (y=-2.85)
    // Sloped transition ramp plate (x=25..34)
    const slopeFloor = new THREE.Mesh(boxGeo, mkStd(0x0284c7, 0.25, 0.08));
    slopeFloor.position.set(29.5, -2.02, midZ);
    slopeFloor.scale.set(Math.hypot(9, 1.7), 0.2, poolD);
    slopeFloor.rotation.z = -Math.atan2(1.7, 9);
    root.add(slopeFloor);

    // 4 Sunken Perimeter Basin Inner Tile Walls
    pb.addBox(minX - 0.12, -0.45, midZ, 0.24, 1.6, poolD, 0x0891b2); // West shallow wall
    pb.addBox(maxX + 0.12, -1.3, midZ, 0.24, 3.3, poolD, 0x0891b2); // East deep wall
    pb.addBox(midX, -1.3, minZ - 0.12, poolW, 3.3, 0.24, 0x0891b2); // North deep wall
    pb.addBox(midX, -1.3, maxZ + 0.12, poolW, 3.3, 0.24, 0x0891b2); // South deep wall

    // Submerged Roman Entry Steps at Shallow SW Corner (x=20..23, z=-280..-274)
    for (let st = 0; st < 4; st++) {
      const sy = -0.15 - st * 0.26;
      pb.addBox(20.4 + st * 0.65, sy, -277, 0.7, 0.24, 5.8, 0xe0f2fe);
    }
    // Brushed Chrome Poolside Grab Ladder on Deep SE Edge
    [-276.6, -275.8].forEach((lz) => {
      pb.addBox(51.6, 0.55, lz, 0.08, 1.6, 0.08, 0xe2e8f0, 'glossy');
      pb.addBox(52.0, 1.15, lz, 0.8, 0.08, 0.08, 0xe2e8f0, 'glossy');
    });

    // Dynamic Animated Rippling Water Surface Plane (DoubleSide visible from above & underwater!)
    const waterPlaneGeo = new THREE.PlaneGeometry(poolW, poolD, 16, 18);
    waterPlaneGeo.rotateX(-Math.PI * 0.5);
    ctx.geometries.push(waterPlaneGeo);
    const dynamicWaterMat = mkStd(0x06b6d4, 0.06, 0.24, {
      transparent: true,
      opacity: 0.74,
      emissive: new THREE.Color(0x0891b2),
      emissiveIntensity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    ctx.nightGlowMats?.push({
      mat: dynamicWaterMat,
      nightHex: 0x22d3ee,
      dayHex: 0x06b6d4,
      nightIntensity: 1.85,
    });
    const waterMesh = new THREE.Mesh(waterPlaneGeo, dynamicWaterMat);
    waterMesh.position.set(midX, waterY, midZ);
    root.add(waterMesh);

    const posAttr = waterPlaneGeo.attributes.position as THREE.BufferAttribute;
    const baseXZ = new Float32Array(posAttr.count * 2);
    for (let vi = 0; vi < posAttr.count; vi++) {
      baseXZ[vi * 2] = posAttr.getX(vi);
      baseXZ[vi * 2 + 1] = posAttr.getZ(vi);
    }
    ctx.updaters.push((_dt, elapsed) => {
      for (let vi = 0; vi < posAttr.count; vi++) {
        const vx = baseXZ[vi * 2];
        const vz = baseXZ[vi * 2 + 1];
        const wy =
          Math.sin(vx * 0.42 + elapsed * 2.4) * 0.032 +
          Math.cos(vz * 0.38 - elapsed * 1.9) * 0.028;
        posAttr.setY(vi, wy);
      }
      posAttr.needsUpdate = true;
    });

    // Infinity waterfall edge spilling down East glass face + underwater & rim cyan wire LEDs
    const waterfallGlass = new THREE.Mesh(boxGeo, dynamicWaterMat);
    waterfallGlass.position.set(52.15, 0.05, midZ);
    waterfallGlass.scale.set(0.16, 0.65, poolD);
    root.add(waterfallGlass);

    [-0.55, -1.65, waterY + 0.1].forEach((ly, idx) => {
      const m = idx === 2 ? ledCyan : ledCyan;
      addWire(midX, ly, maxZ - 0.06, poolW - 0.2, 0.05, 0.05, m);
      addWire(midX, ly, minZ + 0.06, poolW - 0.2, 0.05, 0.05, m);
      if (idx === 0 || idx === 2) {
        addWire(minX + 0.06, ly, midZ, 0.05, 0.05, poolD - 0.2, m);
      }
      addWire(maxX - 0.06, ly, midZ, 0.05, 0.05, poolD - 0.2, m);
    });

    // Teak Wood Sun Deck + 4 Modern Poolside Loungers & Cabana Pergola (West side of pool)
    pb.addBox(15.5, 0.22, midZ, 6.0, 0.3, poolD, 0x8b5732);
    [-304, -296, -288, -280].forEach((lz) => {
      pb.addBox(15.5, 0.52, lz, 2.2, 0.2, 1.0, 0xf8fafc);
      pb.addBox(14.4, 0.72, lz, 0.55, 0.45, 1.0, 0xf8fafc);
    });
    // Poolside Outdoor Dining & Pergola at North-East Terrace
    pb.addBox(64, 0.2, -334, 14, 0.35, 14, 0xeae4da);
    pb.addBox(64, 3.8, -334, 12, 0.24, 12, 0x1d222b);
    addWire(64, 3.66, -334, 11.8, 0.05, 11.8, ledGold);
  }

  // =========================================================================
  // 5. PRIVATE GLASS & MARBLE SUPERCAR SHOWROOM GARAGE (x=-76..-46, z=-378..-318)
  // =========================================================================
  {
    const gx0 = MANSION_GARAGE_BOUNDS.minX; // -76
    const gx1 = MANSION_GARAGE_BOUNDS.maxX; // -46
    const gz0 = MANSION_GARAGE_BOUNDS.minZ; // -378
    const gz1 = MANSION_GARAGE_BOUNDS.maxZ; // -318
    const gMidX = (gx0 + gx1) * 0.5; // -61
    const gMidZ = (gz0 + gz1) * 0.5; // -348
    const gW = gx1 - gx0; // 30
    const gD = gz1 - gz0; // 60

    // Polished showroom marble floor deck
    pb.addBox(gMidX, 0.06, gMidZ, gW + 2, 0.12, gD + 2, 0xf3f0ea, 'glossy');

    // Perimeter dark charcoal concrete/glass walls (Tall 9.0m Showroom Gallery!)
    const gWallH = 9.0;
    pb.addBox(gx0, gWallH * 0.5, gMidZ, 0.65, gWallH, gD, 0x1d222b);
    addCollider(ctx.colliders, gx0, 0, gMidZ, 0.85, gWallH, gD);
    pb.addBox(gMidX, gWallH * 0.5, gz0, gW, gWallH, 0.65, 0x1d222b);
    addCollider(ctx.colliders, gMidX, 0, gz0, gW, gWallH, 0.85);
    // East Garage Wall connecting into Mansion West Wing (clear glass-door doorway z in [-351..-349], solid walls on either side + tall lintel!)
    pb.addBox(gx1, gWallH * 0.5, -364.5, 0.65, gWallH, 27, 0xf4f1ea);
    pb.addBox(gx1, gWallH * 0.5, -333.5, 0.65, gWallH, 31, 0xf4f1ea);
    pb.addBox(gx1, 5.9, -350, 0.65, 6.2, 2.2, 0xf4f1ea);
    addCollider(ctx.colliders, gx1, 0, -364.5, 0.85, gWallH, 27);
    addCollider(ctx.colliders, gx1, 0, -333.5, 0.85, gWallH, 31);
    addCollider(ctx.colliders, gx1, 2.8, -350, 0.85, 6.2, 2.2);

    // Front Garage Pillars flanking the Tall Digital Vertical-Opening Garage Gate (z = -318)
    pb.addBox(gx0 + 2.2, gWallH * 0.5, gz1, 4.4, gWallH, 0.8, 0x1d222b);
    pb.addBox(gx1 - 2.2, gWallH * 0.5, gz1, 4.4, gWallH, 0.8, 0x1d222b);
    addCollider(ctx.colliders, gx0 + 2.2, 0, gz1, 4.4, gWallH, 0.9);
    addCollider(ctx.colliders, gx1 - 2.2, 0, gz1, 4.4, gWallH, 0.9);
    pb.addBox(gMidX, 7.9, gz1, gW, 2.2, 0.9, 0x1d222b);

    // Digital Vertical-Opening Sectional Garage Gate (rolls smoothly upward into overhead housing!)
    {
      const bayW = 21.2;
      const bayH = 6.8;
      // Side guide tracks & overhead motorized drum housing
      pb.addBox(gMidX - bayW * 0.5 + 0.08, bayH * 0.5, gz1, 0.22, bayH, 0.42, 0x94a3b8, 'glossy');
      pb.addBox(gMidX + bayW * 0.5 - 0.08, bayH * 0.5, gz1, 0.22, bayH, 0.42, 0x94a3b8, 'glossy');
      pb.addBox(gMidX, bayH + 0.15, gz1 - 0.36, bayW + 0.6, 0.58, 0.68, 0x0f172a, 'glossy');

      const garageGateGroup = new THREE.Group();
      garageGateGroup.position.set(gMidX, 0, gz1);
      root.add(garageGateGroup);

      const slatCount = 10;
      const slatH = bayH / slatCount; // 0.68m per articulated slat
      const slats: THREE.Group[] = [];
      const gateEdgeMat = mkStd(0x22d3ee, 0.14, 0.1, {
        emissive: new THREE.Color(0x22d3ee),
        emissiveIntensity: 2.0,
        toneMapped: false,
      });
      const slatDarkMat = mkStd(0x161b24, 0.28, 0.72);
      const slatTrimMat = mkStd(0x64748b, 0.25, 0.8);

      for (let s = 0; s < slatCount; s++) {
        const sg = new THREE.Group();
        sg.position.set(0, (s + 0.5) * slatH, 0);
        // Panoramic tinted vision slats in upper-middle rows
        const isVisionRow = s === 5 || s === 6;
        if (isVisionRow) {
          const glassBand = new THREE.Mesh(boxGeo, clearGlassMat);
          glassBand.scale.set(bayW - 0.8, slatH - 0.08, 0.1);
          const frameBarTop = new THREE.Mesh(boxGeo, slatTrimMat);
          frameBarTop.scale.set(bayW - 0.3, 0.055, 0.18);
          frameBarTop.position.set(0, slatH * 0.46, 0);
          const frameBarBot = frameBarTop.clone();
          frameBarBot.position.y = -slatH * 0.46;
          sg.add(glassBand, frameBarTop, frameBarBot);
        } else {
          const panel = new THREE.Mesh(boxGeo, slatDarkMat);
          panel.scale.set(bayW - 0.3, slatH - 0.04, 0.16);
          const rib = new THREE.Mesh(boxGeo, slatTrimMat);
          rib.scale.set(bayW - 0.36, 0.04, 0.2);
          rib.position.set(0, slatH * 0.44, 0);
          sg.add(panel, rib);
        }
        if (s === 0) {
          // Bottom digital laser edge strip
          const bottomLed = new THREE.Mesh(boxGeo, gateEdgeMat);
          bottomLed.scale.set(bayW - 0.5, 0.06, 0.22);
          bottomLed.position.set(0, -slatH * 0.44, 0);
          sg.add(bottomLed);
        }
        garageGateGroup.add(sg);
        slats.push(sg);
      }

      // Digital status indicator light bar above header
      const statusBar = new THREE.Mesh(boxGeo, gateEdgeMat);
      statusBar.position.set(gMidX, bayH + 0.15, gz1 + 0.46);
      statusBar.scale.set(4.8, 0.12, 0.1);
      root.add(statusBar);

      addCollider(ctx.colliders, gMidX, 0, gz1, bayW, bayH, 0.45);
      const garageCollider = ctx.colliders[ctx.colliders.length - 1];
      const gOrigMinY = garageCollider.minY;
      const gOrigMaxY = garageCollider.maxY;

      portals.push({
        id: 'mansion_garage_gate',
        x: gMidX,
        z: gz1,
        open: 0,
        openRadius: 11.5,
        closeRadius: 15.5,
        updateVisualAndCollider: (openAmt, colliderActive) => {
          const liftY = openAmt * (bayH - 0.15);
          garageGateGroup.position.y = liftY;
          // Roll top slats cleanly into overhead drum housing once above y = 6.75m
          for (let s = 0; s < slats.length; s++) {
            const worldSlatY = liftY + (s + 0.5) * slatH;
            if (worldSlatY > bayH - 0.05) {
              const tRoll = Math.min(1, (worldSlatY - (bayH - 0.05)) / 0.68);
              slats[s].visible = tRoll < 0.96;
              slats[s].position.z = -tRoll * 0.36;
              slats[s].rotation.x = tRoll * Math.PI * 0.48;
            } else {
              slats[s].visible = true;
              slats[s].position.z = 0;
              slats[s].rotation.x = 0;
            }
          }
          if (openAmt > 0.65) {
            gateEdgeMat.color.setHex(0x34d399);
            gateEdgeMat.emissive.setHex(0x34d399);
          } else {
            gateEdgeMat.color.setHex(0x22d3ee);
            gateEdgeMat.emissive.setHex(0x22d3ee);
          }
          if (colliderActive) {
            garageCollider.minY = gOrigMinY + liftY;
            garageCollider.maxY = gOrigMaxY + liftY;
          } else {
            garageCollider.minY = 99999;
            garageCollider.maxY = 99998;
          }
        },
      });
    }

    // Garage Roof Slab (9.05m high, clear of East mansion exterior) + Glowing Showcase Header Sign & Wire LEDs
    pb.addBox(gMidX - 0.2, 9.05, gMidZ, gW + 1.6, 0.52, gD + 2, 0x1d222b);
    addCollider(ctx.colliders, gMidX - 0.2, 8.78, gMidZ, gW + 1.6, 0.52, gD + 2);
    addWire(gMidX, 6.86, gz1 + 0.5, 22, 0.08, 0.08, ledCyan);
    addWire(gMidX, 9.36, gz1 + 0.5, gW + 1.4, 0.09, 0.09, ledGold);
    // Vertical colorful showroom arch wires flanking the supercar gallery
    addWire(gx0 + 4.45, 3.55, gz1 + 0.48, 0.08, 6.8, 0.08, ledCyan);
    addWire(gx1 - 4.45, 3.55, gz1 + 0.48, 0.08, 6.8, 0.08, ledCyan);

    // MODERN LARGE-SIZE DYNAMIC GARAGE CEILING LIGHT LINES (18 long bars)
    for (let li = 0; li < 18; li++) {
      const lx = gx0 + 2.4 + li * ((gW - 4.8) / 17);
      const lMat = garageLineMats[li % garageLineMats.length];
      addWire(lx, 8.72, gMidZ, 0.06, 0.045, gD - 6, lMat);
    }
    // Cross-beam modern ceiling border framing lines
    [-324, -338, -352, -366, -374].forEach((cz, ci) => {
      addWire(gMidX, 8.68, cz, gW - 5, 0.04, 0.05, garageLineMats[(ci + 2) % garageLineMats.length]);
    });

    const { material: showroomSignMat } = ctx.displays.createDisplayMaterial('city_billboard', {
      title: 'PRIVATE COLLECTION GALLERY',
      subtitle: 'DEVELOPED BY AFTAB BALOCH DADU',
      accentHex: '#f59e0b',
      intervalSec: 1.0,
      lockTitle: true,
    });
    const signMesh = new THREE.Mesh(boxGeo, showroomSignMat);
    signMesh.position.set(gMidX, 7.95, gz1 + 0.48);
    signMesh.scale.set(12.5, 1.35, 0.08);
    root.add(signMesh);

    // 6 Illuminated Marble Car Bay Plinths + Overhead Accent Wires inside Showroom!
    const bayCoords: Array<[number, number]> = [
      [-69, -334],
      [-53, -334],
      [-69, -350],
      [-53, -350],
      [-69, -366],
      [-53, -366],
    ];
    bayCoords.forEach(([bx, bz], idx) => {
      pb.addBox(bx, 0.14, bz, 5.4, 0.12, 8.2, 0xe2e8f0, 'glossy');
      const bayLed = idx % 2 === 0 ? ledGold : ledCyan;
      addWire(bx, 0.21, bz - 4.1, 5.4, 0.04, 0.04, bayLed);
      addWire(bx, 0.21, bz + 4.1, 5.4, 0.04, 0.04, bayLed);
    });
    // Longest Dynamic Flowing Wall Accent Strips across ALL Showroom Garage Walls (West, North & East)
    addWire(gx0 + 0.55, 1.6, gMidZ, 0.055, 0.055, gD - 3, flowingWallMats[0].mat);
    addWire(gx0 + 0.55, 3.8, gMidZ, 0.055, 0.055, gD - 3, flowingWallMats[1].mat);
    addWire(gx0 + 0.55, 6.4, gMidZ, 0.055, 0.055, gD - 3, flowingWallMats[2].mat);
    addWire(gMidX, 1.6, gz0 + 0.55, gW - 3, 0.055, 0.055, flowingWallMats[1].mat);
    addWire(gMidX, 3.8, gz0 + 0.55, gW - 3, 0.055, 0.055, flowingWallMats[0].mat);
    addWire(gMidX, 6.4, gz0 + 0.55, gW - 3, 0.055, 0.055, flowingWallMats[3].mat);
    addWire(gx1 - 0.55, 1.6, gMidZ, 0.055, 0.055, gD - 3, flowingWallMats[2].mat);
    addWire(gx1 - 0.55, 6.4, gMidZ, 0.055, 0.055, gD - 3, flowingWallMats[0].mat);
  }

  // =========================================================================
  // 6. 4-LEVEL MODERN LUXURY MANSION EXTERIOR FACADE + COLORFUL WIRE NIGHT LEDs
  // =========================================================================
  {
    const minX = MANSION_BUILDING_BOUNDS.minX; // -44
    const maxX = MANSION_BUILDING_BOUNDS.maxX; // +44
    const minZ = MANSION_BUILDING_BOUNDS.minZ; // -388
    const maxZ = MANSION_BUILDING_BOUNDS.maxZ; // -324
    const totalH = MANSION_ROOF_Y; // 17.4m (3 interior stories + rooftop)

    // --- A) DOUBLE-HEIGHT FRONT FOYER PORTICO + PROXIMITY AUTO GLASS DOUBLE DOORS (z = -324) ---
    // Monumental Entrance Frame Columns (height 11.8m, white stucco + charcoal ribs + twin vertical wire LEDs)
    [-6.6, 6.6].forEach((px, pIdx) => {
      pb.addBox(px, 5.9, maxZ, 1.8, 11.8, 2.2, 0xf7f5f0);
      pb.addBox(px, 5.9, maxZ + 1.15, 0.45, 11.6, 0.2, 0x1d222b);
      addWire(px, 5.9, maxZ + 1.28, 0.09, 11.4, 0.09, ledGold);
      addWire(px + (pIdx === 0 ? -0.68 : 0.68), 5.9, maxZ + 1.15, 0.07, 11.4, 0.07, ledCyan);
      // Warm architectural wall sconce lanterns illuminating outer main foyer doors at night
      pb.addBox(px + (pIdx === 0 ? -0.96 : 0.96), 2.8, maxZ + 1.05, 0.24, 0.65, 0.28, 0x1d222b);
      addWire(px + (pIdx === 0 ? -1.04 : 1.04), 2.8, maxZ + 1.12, 0.14, 0.48, 0.14, ledWarmWhite);
      addCollider(ctx.colliders, px, 0, maxZ, 1.9, 11.8, 2.2);
    });
    // Missing side glass bays framing BOTH sides of main hall gate columns (x in [-9.5..-7.5] and [7.5..9.5])!
    [-8.5, 8.5].forEach((sideX) => {
      // Floor 1 side glass + mullion frame next to portico gate
      const sideGlassF1 = new THREE.Mesh(boxGeo, clearGlassMat);
      sideGlassF1.position.set(sideX, 2.9, maxZ);
      sideGlassF1.scale.set(2.0, 5.4, 0.16);
      root.add(sideGlassF1);
      addCollider(ctx.colliders, sideX, 0, maxZ, 2.0, 5.8, 0.35);
      // Dark aluminum mullions framing side glass neatly
      pb.addBox(sideX < 0 ? -9.45 : 9.45, 2.9, maxZ, 0.12, 5.6, 0.24, 0x1d222b);
      pb.addBox(sideX, 2.9, maxZ, 0.08, 5.4, 0.2, 0x1d222b);
      pb.addBox(sideX, 5.55, maxZ, 2.0, 0.24, 0.26, 0x1d222b);
      addWire(sideX, 0.22, maxZ + 0.12, 1.9, 0.05, 0.05, ledGold);

      // Floor 2 & Floor 3 matching curtain glass bays above main hall side glass
      const sideGlassF2 = new THREE.Mesh(boxGeo, clearGlassMat);
      sideGlassF2.position.set(sideX, MANSION_LEVEL_2_Y + 2.9, maxZ);
      sideGlassF2.scale.set(2.0, 5.4, 0.16);
      const sideGlassF3 = new THREE.Mesh(boxGeo, clearGlassMat);
      sideGlassF3.position.set(sideX, MANSION_LEVEL_3_Y + 2.9, maxZ);
      sideGlassF3.scale.set(2.0, 5.4, 0.16);
      root.add(sideGlassF2, sideGlassF3);
      addCollider(ctx.colliders, sideX, MANSION_LEVEL_2_Y, maxZ, 2.0, 5.4, 0.35);
    });
    // Extended Double-Height Entrance Canopy Roof + Transom Glass + Night Downlights illuminating Main Outer Door
    pb.addBox(0, 11.6, maxZ + 1.6, 16.4, 0.65, 5.2, 0x1d222b);
    addWire(0, 11.25, maxZ + 4.18, 16.2, 0.09, 0.09, ledGold);
    addWire(0, 11.96, maxZ + 4.18, 16.2, 0.08, 0.08, ledCyan);
    // Warm recessed soffit night light bars directly beneath entrance canopy illuminating outer door plaza
    addWire(0, 11.22, maxZ + 2.2, 14.0, 0.08, 0.28, ledWarmWhite);
    addWire(0, 5.42, maxZ + 0.35, 11.2, 0.07, 0.2, ledWarmWhite);
    const foyerTransom = new THREE.Mesh(boxGeo, clearGlassMat);
    foyerTransom.position.set(0, 8.4, maxZ);
    foyerTransom.scale.set(11.4, 5.6, 0.16);
    root.add(foyerTransom);
    addCollider(ctx.colliders, 0, 5.5, maxZ, 11.4, 5.8, 0.35);

    // Sliding Automatic Black-Steel & Geometric Glass Foyer Double Doors (x in [-5.7..5.7], height 5.2m)
    const foyerDoorL = new THREE.Group();
    foyerDoorL.position.set(-2.85, 0, maxZ);
    const foyerDoorR = new THREE.Group();
    foyerDoorR.position.set(2.85, 0, maxZ);

    const buildFoyerLeaf = (grp: THREE.Group) => {
      const glassPane = new THREE.Mesh(boxGeo, clearGlassMat);
      glassPane.scale.set(5.6, 5.1, 0.12);
      glassPane.position.set(0, 2.6, 0);
      const topRail = new THREE.Mesh(boxGeo, darkCharcoalMat);
      topRail.scale.set(5.7, 0.22, 0.18);
      topRail.position.set(0, 5.15, 0);
      const botRail = new THREE.Mesh(boxGeo, darkCharcoalMat);
      botRail.scale.set(5.7, 0.22, 0.18);
      botRail.position.set(0, 0.12, 0);
      // Geometric vertical gold/black mullions matching Ref 4
      [-2.7, -0.9, 0.9, 2.7].forEach((mx) => {
        const mullion = new THREE.Mesh(boxGeo, darkCharcoalMat);
        mullion.scale.set(0.11, 5.0, 0.16);
        mullion.position.set(mx, 2.6, 0);
        grp.add(mullion);
      });
      const pullHandle = new THREE.Mesh(boxGeo, brushedGoldMat);
      pullHandle.scale.set(0.08, 1.4, 0.24);
      pullHandle.position.set(grp === foyerDoorL ? 2.4 : -2.4, 1.85, 0);
      grp.add(glassPane, topRail, botRail, pullHandle);
    };
    buildFoyerLeaf(foyerDoorL);
    buildFoyerLeaf(foyerDoorR);
    root.add(foyerDoorL, foyerDoorR);

    addCollider(ctx.colliders, 0, 0, maxZ, 11.4, 5.2, 0.45);
    const foyerCollider = ctx.colliders[ctx.colliders.length - 1];
    const foyerOrigMinX = foyerCollider.minX;
    const foyerOrigMaxX = foyerCollider.maxX;

    portals.push({
      id: 'mansion_foyer_sensor_doors',
      x: 0,
      z: maxZ,
      open: 0,
      openRadius: 7.5,
      closeRadius: 10.5,
      updateVisualAndCollider: (openAmt, colliderActive) => {
        foyerDoorL.position.x = -2.85 - openAmt * 4.8;
        foyerDoorR.position.x = 2.85 + openAmt * 4.8;
        if (colliderActive) {
          foyerCollider.minX = foyerOrigMinX;
          foyerCollider.maxX = foyerOrigMaxX;
        } else {
          foyerCollider.minX = 99999;
          foyerCollider.maxX = 99998;
        }
      },
    });

    // --- B) CANTILEVERED WHITE & CHARCOAL 4-LEVEL FACADE SECTIONS + CURTAIN GLASS ---
    // South Front Wings (Left [-44..-7.5] and Right [7.5..44]) across F1, F2, F3
    [-25.75, 25.75].forEach((wx, sideIdx) => {
      // Floor 1 Solid Stucco Pillars + Panoramic Glass Windows
      pb.addBox(wx < 0 ? minX + 1.5 : maxX - 1.5, 2.9, maxZ, 3.0, 5.8, 0.85, 0xf7f5f0);
      addCollider(ctx.colliders, wx < 0 ? minX + 1.5 : maxX - 1.5, 0, maxZ, 3.0, 5.8, 0.9);
      // Panoramic F1 Front Glass Wall + Mullions
      const winF1 = new THREE.Mesh(boxGeo, clearGlassMat);
      winF1.position.set(wx, 2.9, maxZ);
      winF1.scale.set(32.5, 5.2, 0.16);
      root.add(winF1);
      addCollider(ctx.colliders, wx, 0, maxZ, 32.5, 5.6, 0.35);

      // Floor 2 Cantilevered Dark Charcoal & White Frames + Balcony Glass Railings (z = -318)
      pb.addBox(wx, MANSION_LEVEL_2_Y + 0.1, maxZ + 2.8, 35.5, 0.45, 6.2, sideIdx === 0 ? 0xf7f5f0 : 0x1d222b);
      pb.addBox(wx, MANSION_LEVEL_2_Y + 5.7, maxZ + 2.6, 35.5, 0.45, 5.8, 0x1d222b);
      const balcRailF2 = new THREE.Mesh(boxGeo, clearGlassMat);
      balcRailF2.position.set(wx, MANSION_LEVEL_2_Y + 0.72, maxZ + 5.75);
      balcRailF2.scale.set(35.0, 1.15, 0.12);
      root.add(balcRailF2);
      addCollider(ctx.colliders, wx, MANSION_LEVEL_2_Y, maxZ + 5.75, 35.0, 1.2, 0.25);

      // F2 Glass Curtain Wall
      const winF2 = new THREE.Mesh(boxGeo, clearGlassMat);
      winF2.position.set(wx < 0 ? -30 : 30, MANSION_LEVEL_2_Y + 2.9, maxZ);
      winF2.scale.set(22, 5.2, 0.16);
      root.add(winF2);
      addCollider(ctx.colliders, wx < 0 ? -30 : 30, MANSION_LEVEL_2_Y, maxZ, 22, 5.4, 0.35);

      // Floor 3 Extended White & Wood Slatted Cantilever Box + Sky Terrace Railing
      pb.addBox(wx, MANSION_LEVEL_3_Y + 5.7, maxZ + 1.8, 36.5, 0.55, 5.4, 0xf7f5f0);
      const balcRailF3 = new THREE.Mesh(boxGeo, clearGlassMat);
      balcRailF3.position.set(wx, MANSION_LEVEL_3_Y + 0.72, maxZ + 5.75);
      balcRailF3.scale.set(34.5, 1.15, 0.12);
      root.add(balcRailF3);
      addCollider(ctx.colliders, wx, MANSION_LEVEL_3_Y, maxZ + 5.75, 34.5, 1.2, 0.25);

      // Decorative Warm Wood Architectural Louver Panels on F3 Wing Edges (Ref 6)
      for (let s = 0; s < 5; s++) {
        pb.addBox(wx < 0 ? -42.5 + s * 0.7 : 42.5 - s * 0.7, MANSION_LEVEL_3_Y + 2.9, maxZ + 0.2, 0.22, 5.1, 0.4, 0x7c4a26);
      }

      // LONGEST DYNAMIC FLOWING WALL LED STRIPS positioned strictly on exterior parapet rim (zero 3F->2F ceiling bleed)
      addWire(wx, MANSION_LEVEL_2_Y + 0.28, maxZ + 6.08, 35.5, 0.08, 0.08, flowingWallMats[0].mat);
      addWire(wx, MANSION_LEVEL_2_Y + 1.45, maxZ + 5.9, 35.0, 0.07, 0.07, ledWarmWhite);
      addWire(wx, MANSION_LEVEL_3_Y + 0.28, maxZ + 6.08, 35.5, 0.08, 0.08, flowingWallMats[2].mat);
      addWire(wx, MANSION_LEVEL_3_Y + 1.45, maxZ + 5.9, 34.5, 0.07, 0.07, flowingWallMats[1].mat);
      addWire(wx, MANSION_ROOF_Y + 0.28, maxZ + 4.7, 36.5, 0.09, 0.09, flowingWallMats[1].mat);
      addWire(wx, MANSION_ROOF_Y + 0.65, maxZ + 4.7, 36.5, 0.08, 0.08, flowingWallMats[3].mat);

      // Thin vertical geometric LED wire columns across outer corner & mid-bay frames
      const outerX = wx < 0 ? minX + 0.4 : maxX - 0.4;
      const midBayX = wx < 0 ? -24 : 24;
      addWire(outerX, 8.7, maxZ + 5.95, 0.09, 17.2, 0.09, flowingWallMats[2].mat);
      addWire(midBayX, 8.7, maxZ + 0.45, 0.07, 17.0, 0.07, ledCyan);
      addWire(wx < 0 ? -12 : 12, 2.9, maxZ + 0.45, 0.07, 5.4, 0.07, ledGold);
      // Multi-color varied outdoor balcony accent sconces (Ruby, Emerald, Cyan)
      addWire(wx < 0 ? -34 : 34, MANSION_LEVEL_2_Y + 2.6, maxZ + 5.9, 0.18, 0.72, 0.12, sideIdx === 0 ? ledRuby : ledEmerald);
    });

    // Center F3 Bridge Front Glass Wall above Portico + Glowing Crown Halo
    const winCenterF3 = new THREE.Mesh(boxGeo, clearGlassMat);
    winCenterF3.position.set(0, MANSION_LEVEL_3_Y + 2.9, maxZ);
    winCenterF3.scale.set(16.0, 5.2, 0.16);
    root.add(winCenterF3);
    addWire(0, MANSION_ROOF_Y + 0.24, maxZ + 0.15, 88, 0.1, 0.1, flowingWallMats[1].mat);
    addWire(0, MANSION_LEVEL_3_Y + 5.45, maxZ + 0.2, 16.0, 0.08, 0.08, flowingWallMats[2].mat);

    // --- C) NORTH BACKSIDE, EAST SIDE & WEST SIDE ARCHITECTURAL FACADES (360-DEGREE IMPRESSIVE) ---
    // North Back Wall (z = -388) with full floor-to-ceiling tinted glass & longest flowing wall LEDs
    pb.addBox(-34, totalH * 0.5, minZ, 20, totalH, 0.85, 0xf7f5f0);
    pb.addBox(34, totalH * 0.5, minZ, 20, totalH, 0.85, 0xf7f5f0);
    pb.addBox(0, MANSION_LEVEL_2_Y, minZ, 88, 0.55, 1.2, 0x1d222b);
    pb.addBox(0, MANSION_LEVEL_3_Y, minZ, 88, 0.55, 1.2, 0x1d222b);
    pb.addBox(0, MANSION_ROOF_Y, minZ, 89, 0.6, 1.4, 0xf7f5f0);
    const northGlass = new THREE.Mesh(boxGeo, clearGlassMat);
    northGlass.position.set(0, totalH * 0.5, minZ);
    northGlass.scale.set(48, totalH - 0.6, 0.16);
    root.add(northGlass);
    addCollider(ctx.colliders, 0, 0, minZ, 88, totalH, 0.9);
    // Longest flowing dynamic wall strips along entire North Wall
    addWire(0, 2.8, minZ - 0.5, 87, 0.06, 0.06, flowingWallMats[1].mat);
    addWire(0, MANSION_LEVEL_2_Y + 0.25, minZ - 0.65, 87, 0.07, 0.07, flowingWallMats[3].mat);
    addWire(0, MANSION_LEVEL_3_Y + 0.25, minZ - 0.65, 87, 0.07, 0.07, flowingWallMats[0].mat);
    addWire(0, MANSION_ROOF_Y + 0.25, minZ - 0.72, 87, 0.08, 0.08, flowingWallMats[2].mat);

    // East Wall (x = 44): Enclose East Wing & Gun Collection Vault completely + interactive Patio Glass Door (z=-327.5)
    pb.addBox(maxX, totalH * 0.5, -366, 0.75, totalH, 44, 0xf7f5f0);
    pb.addBox(maxX, MANSION_LEVEL_2_Y + 5.8, -334, 0.75, 11.6, 20, 0x1d222b);
    addCollider(ctx.colliders, maxX, 0, -366, 0.9, totalH, 44);
    addCollider(ctx.colliders, maxX, 5.4, -334, 0.9, 12.0, 20);
    // F1 Solid Enclosure along East Wall (z=-344..-324) with Patio Glass Door opening at z=-327.5
    pb.addBox(maxX, 2.9, -336.2, 0.75, 5.8, 15.6, 0xf7f5f0);
    pb.addBox(maxX, 2.9, -325.3, 0.75, 5.8, 2.6, 0xf7f5f0);
    pb.addBox(maxX, 4.3, -327.5, 0.75, 3.0, 1.8, 0xf7f5f0);
    addCollider(ctx.colliders, maxX, 0, -336.2, 0.9, 5.8, 15.6);
    addCollider(ctx.colliders, maxX, 0, -325.3, 0.9, 5.8, 2.6);
    addCollider(ctx.colliders, maxX, 2.8, -327.5, 0.9, 3.0, 1.8);
    // Longest flowing dynamic wall strips along East Wall + Varied Colored Sconces
    addWire(maxX + 0.7, 2.8, -356, 0.06, 0.06, 63, flowingWallMats[3].mat);
    addWire(maxX + 0.7, MANSION_LEVEL_2_Y + 0.35, -356, 0.07, 0.07, 63, flowingWallMats[0].mat);
    addWire(maxX + 0.7, MANSION_LEVEL_3_Y + 0.35, -356, 0.07, 0.07, 63, flowingWallMats[2].mat);
    addWire(maxX + 0.7, MANSION_ROOF_Y + 0.35, -356, 0.08, 0.08, 63, flowingWallMats[1].mat);
    [-334, -356, -378].forEach((ez, idx) => {
      addWire(maxX + 0.72, 8.7, ez, 0.08, 15.5, 0.08, idx === 1 ? ledRuby : ledGold);
    });

    // West Wall (x = -44): Connects flush into Dining Hall <-> Garage Glass Portal + Flowing Wall LEDs
    pb.addBox(minX, 2.9, -336.5, 0.75, 5.8, 25, 0xf7f5f0);
    pb.addBox(minX, 2.9, -369.5, 0.75, 5.8, 37, 0xf7f5f0);
    pb.addBox(minX, 4.3, -350, 0.75, 3.0, 2.2, 0xf7f5f0);
    pb.addBox(minX, MANSION_LEVEL_2_Y + 5.8, -356, 0.75, 11.6, 64, 0x1d222b);
    addCollider(ctx.colliders, minX, 0, -336.5, 0.9, 5.8, 25);
    addCollider(ctx.colliders, minX, 0, -369.5, 0.9, 5.8, 37);
    addCollider(ctx.colliders, minX, 2.8, -350, 0.9, 3.0, 2.2);
    addCollider(ctx.colliders, minX, 5.4, -356, 0.9, 12.0, 64);
    addWire(minX - 0.65, MANSION_LEVEL_2_Y + 0.35, -356, 0.07, 0.07, 63, flowingWallMats[1].mat);
    addWire(minX - 0.65, MANSION_LEVEL_3_Y + 0.35, -356, 0.07, 0.07, 63, flowingWallMats[0].mat);
    addWire(minX - 0.65, MANSION_ROOF_Y + 0.35, -356, 0.08, 0.08, 63, flowingWallMats[2].mat);
    // Interior glowing flowing LED bands positioned safely below slab soffits (zero floor/ceiling bleed)
    addWire(0, 4.95, minZ + 0.75, 84, 0.06, 0.06, flowingWallMats[0].mat);
    addWire(0, MANSION_LEVEL_2_Y + 4.95, minZ + 0.75, 84, 0.06, 0.06, flowingWallMats[2].mat);
    addWire(0, MANSION_LEVEL_3_Y + 4.95, minZ + 0.75, 84, 0.06, 0.06, flowingWallMats[1].mat);
    addWire(maxX - 0.7, 4.95, -356, 0.06, 0.06, 60, flowingWallMats[3].mat);
    addWire(minX + 0.7, 4.95, -356, 0.06, 0.06, 60, flowingWallMats[1].mat);
  }

  // Interactive Glass Vestibule Door (Dining Hall <-> Garage at x=-45, z=-350) + East Patio Glass Door (x=44, z=-327.5)
  const addInteractiveGlassDoor = (id: string, label: string, x: number, z: number) => {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    const frameL = new THREE.Mesh(boxGeo, darkCharcoalMat);
    frameL.scale.set(0.28, 2.8, 0.14);
    frameL.position.set(0, 1.4, -0.82);
    const frameR = frameL.clone();
    frameR.position.z = 0.82;
    const frameTop = new THREE.Mesh(boxGeo, darkCharcoalMat);
    frameTop.scale.set(0.28, 0.16, 1.8);
    frameTop.position.set(0, 2.84, 0);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0, -0.74);
    const leaf = new THREE.Mesh(boxGeo, clearGlassMat);
    leaf.scale.set(0.1, 2.74, 1.46);
    leaf.position.set(0, 1.37, 0.73);
    const handle = new THREE.Mesh(boxGeo, brushedGoldMat);
    handle.scale.set(0.18, 0.9, 0.06);
    handle.position.set(0, 1.25, 1.3);
    hinge.add(leaf, handle);
    grp.add(frameL, frameR, frameTop, hinge);
    root.add(grp);

    addCollider(ctx.colliders, x, 0, z, 0.35, 2.8, 1.5);
    const colRef = ctx.colliders[ctx.colliders.length - 1];
    const origMinX = colRef.minX;
    const origMaxX = colRef.maxX;
    let isOpen = false;
    let openAmt = 0;

    ctx.interactables.push({
      id,
      x,
      y: 0,
      z,
      radius: 3.0,
      category: 'door',
      getLabel: () => (isOpen ? `Close ${label}` : `Open ${label}`),
      trigger: () => {
        isOpen = !isOpen;
        return `${label} ${isOpen ? 'opened' : 'closed'}`;
      },
    });
    ctx.updaters.push((dt) => {
      const tgt = isOpen ? 1 : 0;
      if (Math.abs(tgt - openAmt) > 0.004) {
        openAmt += (tgt - openAmt) * Math.min(1, dt * 7.5);
        hinge.rotation.y = openAmt * 1.48;
        if (openAmt > 0.55) {
          colRef.minX = 99999;
          colRef.maxX = 99998;
        } else {
          colRef.minX = origMinX;
          colRef.maxX = origMaxX;
        }
      }
    });
  };
  addInteractiveGlassDoor('mansion_door_garage_dining', 'Dining-Garage Glass Door', -45.0, -350);
  addInteractiveGlassDoor('mansion_door_east_patio', 'Pool Patio Glass Door', 44.0, -327.5);

  // =========================================================================
  // 7. SYMMETRICAL PALM TREES, LUXURY GREEN TREES, FLOWER BEDS & PATHWAY LIGHTS
  // =========================================================================
  {
    const cypressCoords: Array<[number, number]> = [
      // Symmetrical Mansion Forecourt Cypresses & Trees
      [-12, -252], [12, -252], [-20, -252], [20, -252],
      [-9.5, -264], [9.5, -264], [-9.5, -276], [9.5, -276],
      [-9.5, -295], [9.5, -304],
      [-84, -254], [-82, -288], [78, -262], [78, -292], [78, -324],
      // Symmetrical Boulevard Green Trees lining BOTH sides of Front Approach Road
      [-16, -214], [16, -214], [-16, -228], [16, -228],
      [-16, -242], [16, -242], [-32, -218], [32, -218], [-32, -238], [32, -238],
    ];
    const trunkMat = mkStd(0x5c3a21, 0.85, 0.02);
    const leafMat = mkStd(0x166534, 0.78, 0.02);
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 8);
    const coneGeo = new THREE.ConeGeometry(1.25, 5.6, 9);
    ctx.geometries.push(trunkGeo, coneGeo);

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, cypressCoords.length);
    const crowns = new THREE.InstancedMesh(coneGeo, leafMat, cypressCoords.length);
    const dummy = new THREE.Object3D();
    cypressCoords.forEach(([tx, tz], i) => {
      dummy.position.set(tx, 0.7, tz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tx, 4.1, tz);
      dummy.scale.set(1, 1 + (i % 3) * 0.14, 1);
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
    });
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    root.add(trunks, crowns);

    // Tall Luxury Palm Trees symmetrically lining BOTH sides of Front Boulevard & Mansion Entrance
    const palmCoords: Array<[number, number]> = [
      [-11.8, -210], [11.8, -210], [-11.8, -224], [11.8, -224],
      [-11.8, -238], [11.8, -238], [-28.0, -214], [28.0, -214],
      [-28.0, -230], [28.0, -230], [-28.0, -246], [28.0, -246],
      [-24.0, -264], [24.0, -264],
    ];
    const palmTrunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 7.6, 7);
    const palmFrondGeo = new THREE.BoxGeometry(0.45, 0.08, 3.2);
    ctx.geometries.push(palmTrunkGeo, palmFrondGeo);
    const palmTrunks = new THREE.InstancedMesh(palmTrunkGeo, trunkMat, palmCoords.length);
    const palmFronds = new THREE.InstancedMesh(palmFrondGeo, mkStd(0x15803d, 0.72, 0.04), palmCoords.length * 6);
    palmCoords.forEach(([px, pz], idx) => {
      dummy.position.set(px, 3.8, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      palmTrunks.setMatrixAt(idx, dummy.matrix);
      for (let f = 0; f < 6; f++) {
        const ang = (f / 6) * Math.PI * 2 + idx * 0.3;
        dummy.position.set(px + Math.sin(ang) * 1.35, 7.35, pz + Math.cos(ang) * 1.35);
        dummy.rotation.set(-0.28, ang, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        palmFronds.setMatrixAt(idx * 6 + f, dummy.matrix);
      }
    });
    palmTrunks.instanceMatrix.needsUpdate = true;
    palmFronds.instanceMatrix.needsUpdate = true;
    root.add(palmTrunks, palmFronds);

    // Pathway thin glowing bollard lights lining main driveway
    for (let pz = -304; pz <= -252; pz += 6.5) {
      [-7.2, 7.2].forEach((px) => {
        pb.addBox(px, 0.35, pz, 0.22, 0.7, 0.22, 0x1d222b);
        addWire(px, 0.72, pz, 0.18, 0.08, 0.18, ledWarmWhite);
      });
    }
  }

  // Compile all merged static estate geometry
  const propMats = createPropPbrMaterials(false);
  const built = pb.compile(propMats, { castShadow: !ctx.isSoftwareGl, receiveShadow: true });
  root.add(built.group);
  ctx.geometries.push(...built.geometries);
  ctx.materials.push(...propMats.all, ...built.materials);
  ctx.shootableEnv.push(built.group);

  // Build all 4 floors of interiors + staircases + gun wall + rooftop hex helipad
  const interiors = buildMansionInteriorsAndRooftop(ctx, {
    gold: ledGold,
    cyan: ledCyan,
    violet: ledViolet,
    emerald: ledEmerald,
    warmWhite: ledWarmWhite,
  });

  const useDecorPointLights = !ctx.graphicsQuality || ctx.graphicsQuality === 'high';
  // 3 lightweight non-shadow night PointLights illuminating Atrium/Outer Doors, Pool/Courtyard & Showroom (High quality only)
  const atriumNightLight = useDecorPointLights ? new THREE.PointLight(0xffe0a3, 0, 62, 1.25) : null;
  const poolNightLight = useDecorPointLights ? new THREE.PointLight(0x38bdf8, 0, 58, 1.35) : null;
  const showroomNightLight = useDecorPointLights ? new THREE.PointLight(0xe0f2fe, 0, 48, 1.35) : null;
  if (atriumNightLight && poolNightLight && showroomNightLight) {
    atriumNightLight.position.set(0, 7.2, -325);
    poolNightLight.position.set(28, 6.5, -292);
    showroomNightLight.position.set(-61, 5.2, -346);
    root.add(atriumNightLight, poolNightLight, showroomNightLight);
  }

  ctx.updaters.push((dt, elapsed, cameraPos) => {
    const camDx = cameraPos ? cameraPos.x : 0;
    const camDz = cameraPos ? cameraPos.z + 340 : 0;
    const camDistSq = cameraPos ? camDx * camDx + camDz * camDz : 0;
    const nearMansion = root.visible && (!cameraPos || camDistSq <= 135 * 135);
    const nightMix = Math.min(1, ledGold.emissiveIntensity / 1.55);
    const lightsOn = nearMansion && nightMix > 0.01;
    if (atriumNightLight && poolNightLight && showroomNightLight) {
      atriumNightLight.visible = lightsOn;
      poolNightLight.visible = lightsOn;
      showroomNightLight.visible = lightsOn;
    }
    if (!nearMansion) return;

    if (atriumNightLight && poolNightLight && showroomNightLight) {
      atriumNightLight.intensity = 7.2 * nightMix;
      poolNightLight.intensity = 5.8 * nightMix;
      showroomNightLight.intensity = 5.8 * nightMix;
    }
    // Dynamic traveling brightness wave across Garage Ceiling Light Lines
    for (let li = 0; li < garageLineMats.length; li++) {
      const wave = 0.5 + 0.5 * Math.sin(elapsed * 3.4 - li * 0.95);
      garageLineMats[li].emissiveIntensity = (0.35 + nightMix * 0.65) * (0.45 + wave * 0.75);
    }
    // Dynamic flowing glow wave across long mansion & showroom wall LED strips
    for (let wi = 0; wi < flowingWallMats.length; wi++) {
      const fw = flowingWallMats[wi];
      const wave = 0.5 + 0.5 * Math.sin(elapsed * 2.5 - fw.phase);
      fw.mat.emissiveIntensity = (0.25 + nightMix * 1.15) * (0.55 + wave * 0.65);
    }
    for (let i = 0; i < interiors.animatedUpdaters.length; i++) {
      interiors.animatedUpdaters[i](dt, elapsed);
    }
  });

  // Unused material refs cleanup check: keep woodAccentMat reachable if needed
  void woodAccentMat;
  void MANSION_PLOT_BOUNDS;

  return {
    portals,
    updateProximityPortals: (playerX, playerZ, drivenX, drivenZ, dt, extraActors) => {
      for (let i = 0; i < portals.length; i++) {
        const p = portals[i];
        let minDist = Math.hypot(playerX - p.x, playerZ - p.z);
        if (drivenX !== null && drivenZ !== null) {
          const dVeh = Math.hypot(drivenX - p.x, drivenZ - p.z);
          if (dVeh < minDist) minDist = dVeh;
        }
        if (extraActors) {
          for (let ei = 0; ei < extraActors.length; ei++) {
            const dBus = Math.hypot(extraActors[ei].x - p.x, extraActors[ei].z - p.z);
            if (dBus < minDist) minDist = dBus;
          }
        }
        const res = stepProximityPortal(p.open, minDist, p.openRadius, p.closeRadius, dt);
        if (res.open !== p.open || Math.abs(res.open) < 0.01) {
          p.open = res.open;
          p.updateVisualAndCollider(res.open, res.colliderActive);
        }
      }
    },
  };
}
