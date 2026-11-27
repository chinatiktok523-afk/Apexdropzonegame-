import * as THREE from 'three';
import { addCollider, type WorldInteractable } from './arena';
import { buildArchitecturalStaircase, type CityPalette, type SimWorldBuildContext } from './buildingsAndTransit';
import {
  FUTURE_LAB_BOUNDS,
  FUTURE_LAB_DEPARTMENTS,
  SCIENCE_DISTRICT_NPCS,
  SCIENCE_DOMES_CATALOG,
  SCIENCE_MUSEUM_BOUNDS,
  SCIENCE_PLAZA_CENTER,
  createInitialScienceDistrictState,
  updateOnDemandInteriorLoading,
  type ScienceDistrictSimulationState,
  type ScienceDomeId,
  type ScienceLabDepartmentId,
} from './scienceDistrictSystems';
import {
  buildFutureLabAtriumHero,
  createEarthGlobeTexture,
  createExhibitMaterialBank,
  createSignBannerTexture,
  populateDomeExhibits,
  type ScienceExhibitAnimEntry,
} from './scienceDistrictExhibits';

export interface ScienceDistrictController {
  root: THREE.Group;
  getState: () => ScienceDistrictSimulationState;
  setActiveBuilding: (target: ScienceDistrictSimulationState['activeBuilding']) => void;
  setActiveDepartment: (dept: ScienceLabDepartmentId) => void;
  toggleDomeBoost: (domeId: ScienceDomeId) => boolean;
  toggleLabRobots: () => boolean;
  toggleLabOverdrive: () => boolean;
  setElevatorFloor: (floor: 1 | 2 | 3) => void;
  update: (
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    cameraPos: THREE.Vector3 | null | undefined,
  ) => void;
  dispose: () => void;
}

interface AnimatedDistrictNpc {
  root: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  waypoints: readonly { x: number; y: number; z: number }[];
  segIdx: number;
  progress: number;
  speed: number;
  phase: number;
  activity: 'walk' | 'inspect' | 'operate' | 'guide' | 'sit';
}

export function buildScienceDistrictWorld(
  ctx: SimWorldBuildContext,
  pal: CityPalette,
): ScienceDistrictController {
  const root = new THREE.Group();
  root.name = 'FuturisticScienceDistrictRoot';
  root.userData.keepInArenaRoot = true;

  const isReducedQ = ctx.isSoftwareGl || ctx.graphicsQuality === 'low';
  const bank = createExhibitMaterialBank(isReducedQ);
  const state = createInitialScienceDistrictState();
  const anims: ScienceExhibitAnimEntry[] = [];
  const texturesToDispose: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ctx.geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    ctx.materials.push(m);
    return m;
  };

  // Shared Architectural Materials
  const glassDomeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: isReducedQ ? 0.34 : 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const skybridgeGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.14,
      metalness: 0.2,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
  const waterPoolMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    }),
  );
  const graniteFloorMat = trackMat(
    isReducedQ
      ? new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
      : new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.32, metalness: 0.15 }),
  );
  const whiteFacadeMat = trackMat(
    isReducedQ
      ? new THREE.MeshLambertMaterial({ color: 0xf8fafc, emissive: 0x1e293b, emissiveIntensity: 0.22 })
      : new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.16, emissive: 0x1e293b, emissiveIntensity: 0.14 }),
  );
  const darkFrameMat = trackMat(
    isReducedQ
      ? new THREE.MeshLambertMaterial({ color: 0x475569, emissive: 0x0f172a, emissiveIntensity: 0.2 })
      : new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.26 }),
  );
  const ledCyanMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const ledGoldMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  ctx.streetLampMats.push(ledCyanMat);

  const boxGeo = pal.boxGeo;
  const cylGeo = trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 16));
  const ringGeo = trackGeo(new THREE.TorusGeometry(1, 0.016, 8, 32));
  const archRibGeo = trackGeo(new THREE.TorusGeometry(1, 0.014, 8, 28, Math.PI));
  const domeGeo = trackGeo(new THREE.SphereGeometry(1, isReducedQ ? 16 : 24, isReducedQ ? 10 : 14, 0, Math.PI * 2, 0, Math.PI * 0.5));
  const fullSphereGeo = trackGeo(new THREE.SphereGeometry(1, 20, 14));

  const addStructBox = (
    parent: THREE.Object3D,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rotY = 0,
  ) => {
    const m = new THREE.Mesh(boxGeo, mat);
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    if (rotY !== 0) m.rotation.y = rotY;
    parent.add(m);
    return m;
  };

  // ============================================================================
  // 1. PLAZA DECK, ROADS, CROSSWALK MARKINGS, EV PARKING & LANDSCAPING
  // ============================================================================
  const plazaDeck = addStructBox(root, graniteFloorMat, 116, 0.07, -567, 196, 0.14, 150);
  plazaDeck.receiveShadow = true;

  // EV Parking Deck beside Future Lab Boulevard (x: -10..32, z: -512..-482)
  addStructBox(root, darkFrameMat, 11, 0.05, -497, 40, 0.1, 28);
  for (let i = 0; i < 4; i++) {
    const px = -2 + i * 7.5;
    addStructBox(root, whiteFacadeMat, px, 2.2, -508, 0.4, 4.4, 0.4);
    addStructBox(root, whiteFacadeMat, px, 4.4, -504, 6.2, 0.24, 8.2);
    addStructBox(root, ledCyanMat, px, 4.25, -500, 5.8, 0.1, 0.12);
    addStructBox(root, ledCyanMat, px + 2.8, 0.9, -508, 0.45, 1.8, 0.45); // EV Charger post
    addCollider(ctx.colliders, px, 0, -508, 0.8, 4.4, 0.8);
  }

  // Grand Connecting Boulevard Crosswalk, Stepped Plaza Ramp & LED Curb Strip along z = -474
  addStructBox(root, ledCyanMat, 116, 0.15, -482, 192, 0.08, 0.25);
  for (let cw = -3; cw <= 3; cw++) {
    addStructBox(root, whiteFacadeMat, 118 + cw * 2.2, 0.1, -474, 1.0, 0.04, 11.5);
  }
  // Stepped Central Plaza Promenade Entrance (z = -483 to -493 leading toward World Globe)
  addStructBox(root, graniteFloorMat, 118, 0.05, -485, 16, 0.1, 6.2);
  addStructBox(root, whiteFacadeMat, 118, 0.09, -489.5, 14, 0.1, 3.2);
  addStructBox(root, ledCyanMat, 118, 0.145, -488.0, 14, 0.04, 0.12);
  addStructBox(root, ledCyanMat, 118, 0.145, -491.0, 14, 0.04, 0.12);

  // Central Glowing World Hologram Sphere Monument at (118, -514)
  const globeGroup = new THREE.Group();
  globeGroup.position.set(SCIENCE_PLAZA_CENTER.globeX, 0.14, SCIENCE_PLAZA_CENTER.globeZ);
  const gBase1 = new THREE.Mesh(cylGeo, darkFrameMat);
  gBase1.position.y = 0.25;
  gBase1.scale.set(11.5, 0.5, 11.5);
  const gPool = new THREE.Mesh(cylGeo, waterPoolMat);
  gPool.position.y = 0.52;
  gPool.scale.set(9.8, 0.16, 9.8);
  const gRing = new THREE.Mesh(ringGeo, ledCyanMat);
  gRing.rotation.x = Math.PI * 0.5;
  gRing.position.y = 0.65;
  gRing.scale.setScalar(5.2);

  const earthTex = createEarthGlobeTexture();
  texturesToDispose.push(earthTex);
  const earthMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: earthTex,
      transparent: true,
      opacity: 0.92,
    }),
  );
  const earthSphere = new THREE.Mesh(fullSphereGeo, earthMat);
  earthSphere.position.y = 4.6;
  earthSphere.scale.setScalar(3.4);
  const earthHalo = new THREE.Mesh(ringGeo, ledCyanMat);
  earthHalo.position.y = 4.6;
  earthHalo.rotation.x = 0.35;
  earthHalo.scale.setScalar(4.1);
  globeGroup.add(gBase1, gPool, gRing, earthSphere, earthHalo);
  root.add(globeGroup);
  addCollider(ctx.colliders, SCIENCE_PLAZA_CENTER.globeX, 0, SCIENCE_PLAZA_CENTER.globeZ, 10.2, 4.5, 10.2);

  anims.push({
    zoneKey: 'plaza',
    update: (t) => {
      earthSphere.rotation.y = t * 0.42;
      earthHalo.rotation.z = t * 0.6;
      earthHalo.rotation.y = -t * 0.35;
    },
  });

  // Left & Right Choreographed Water Fountains (West: (26,-526), East: (212,-526))
  const fountainJets: THREE.Mesh[] = [];
  [26, 212].forEach((fx) => {
    const fg = new THREE.Group();
    fg.position.set(fx, 0.14, -526);
    const rim = new THREE.Mesh(cylGeo, whiteFacadeMat);
    rim.position.y = 0.25;
    rim.scale.set(12.5, 0.5, 12.5);
    const pool = new THREE.Mesh(cylGeo, waterPoolMat);
    pool.position.y = 0.52;
    pool.scale.set(11.4, 0.16, 11.4);
    fg.add(rim, pool);
    for (let j = 0; j < 6; j++) {
      const ang = (j / 6) * Math.PI * 2;
      const jet = new THREE.Mesh(cylGeo, bank.holoBlue);
      jet.position.set(Math.cos(ang) * 2.5, 2.2, Math.sin(ang) * 2.5);
      jet.scale.set(0.32, 3.6, 0.32);
      fountainJets.push(jet);
      fg.add(jet);
    }
    root.add(fg);
    addCollider(ctx.colliders, fx, 0, -526, 11.5, 1.5, 11.5);
  });
  anims.push({
    zoneKey: 'plaza',
    update: (t) => {
      fountainJets.forEach((jet, idx) => {
        const h = 2.4 + Math.sin(t * 3.4 + idx * 0.85) * 1.35;
        jet.scale.y = h;
        jet.position.y = 0.55 + h * 0.5;
      });
    },
  });

  // Instanced Landscaping Palms + Modern Streetlights around Plaza & Crosswalk
  const palmSpots: [number, number][] = [
    [16, -486], [34, -486], [88, -486], [148, -486], [198, -486], [220, -486],
    [18, -552], [38, -568], [96, -572], [138, -572], [198, -568], [218, -552],
  ];
  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 5.2, 8));
  const crownGeo = trackGeo(new THREE.ConeGeometry(2.2, 2.1, 7));
  const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
  const leafMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72 }));
  const trunksIm = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crownsIm = new THREE.InstancedMesh(crownGeo, leafMat, palmSpots.length);
  const dummy = new THREE.Object3D();
  palmSpots.forEach(([px, pz], i) => {
    const s = 0.88 + (i % 3) * 0.14;
    dummy.position.set(px, 2.6 * s, pz);
    dummy.rotation.set(0, i * 0.8, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunksIm.setMatrixAt(i, dummy.matrix);
    dummy.position.set(px, 5.4 * s, pz);
    dummy.updateMatrix();
    crownsIm.setMatrixAt(i, dummy.matrix);
  });
  trunksIm.instanceMatrix.needsUpdate = true;
  crownsIm.instanceMatrix.needsUpdate = true;
  trunksIm.computeBoundingSphere();
  crownsIm.computeBoundingSphere();
  root.add(trunksIm, crownsIm);

  // ============================================================================
  // 2. FUTURE LAB BUILDING (West-North Wing at x=64, z=-618, 3 Floors)
  // ============================================================================
  const labGroup = new THREE.Group();
  labGroup.position.set(FUTURE_LAB_BOUNDS.centerX, 0, FUTURE_LAB_BOUNDS.centerZ);
  root.add(labGroup);

  const labInteriorGroup = new THREE.Group();
  labInteriorGroup.name = 'FutureLabInterior';
  labGroup.add(labInteriorGroup);

  const LW = 68;
  const LD = 44;
  const FH = FUTURE_LAB_BOUNDS.floorHeight;
  const LAB_ROOF_Y = FH * 3; // 16.8m

  // Main Slabs & Exterior Envelope
  addStructBox(labGroup, whiteFacadeMat, 0, 0.1, 0, LW, 0.2, LD);
  addStructBox(labGroup, whiteFacadeMat, 0, LAB_ROOF_Y + 0.3, 0, LW + 2.4, 0.6, LD + 2.4);
  addStructBox(labGroup, ledCyanMat, 0, LAB_ROOF_Y + 0.65, LD * 0.5 + 1.2, LW + 2.6, 0.24, 0.24);
  // 2F & 3F Exterior Atrium Balcony Slabs (leaving central void x: -12..12 open for atrium view!)
  [FH, FH * 2].forEach((fy) => {
    addStructBox(labInteriorGroup, graniteFloorMat, -22, fy, 0, 22, 0.28, LD - 2);
    addStructBox(labInteriorGroup, graniteFloorMat, 22, fy, 0, 22, 0.28, LD - 2);
    addStructBox(labInteriorGroup, graniteFloorMat, 0, fy, -12, 22, 0.28, 18);
  });

  // Back wall, Left & Right curved/ribbed walls, Front glass atrium framing (open doorway x:-5..+5 at z=+22)
  addStructBox(labGroup, whiteFacadeMat, 0, LAB_ROOF_Y * 0.5, -LD * 0.5, LW, LAB_ROOF_Y, 0.7);
  addStructBox(labGroup, whiteFacadeMat, -LW * 0.5, LAB_ROOF_Y * 0.5, 0, 0.8, LAB_ROOF_Y, LD);
  // Right East wall has Skybridge doorway opening on 2F (z: -2..+6, y: 5.6..10.2)
  addStructBox(labGroup, whiteFacadeMat, LW * 0.5, 2.8, 0, 0.8, 5.6, LD);
  addStructBox(labGroup, whiteFacadeMat, LW * 0.5, 14.0, 0, 0.8, 5.6, LD);
  addStructBox(labGroup, whiteFacadeMat, LW * 0.5, 8.4, -12, 0.8, 5.6, 20);
  addStructBox(labGroup, whiteFacadeMat, LW * 0.5, 8.4, 14, 0.8, 5.6, 16);

  // Front Atrium Transparent Curtain Glass + Sweeping Columns + Approach Steps
  addStructBox(labGroup, whiteFacadeMat, -21, LAB_ROOF_Y * 0.5, LD * 0.5, 26, LAB_ROOF_Y, 0.65);
  addStructBox(labGroup, whiteFacadeMat, 21, LAB_ROOF_Y * 0.5, LD * 0.5, 26, LAB_ROOF_Y, 0.65);
  addStructBox(labGroup, glassDomeMat, 0, LAB_ROOF_Y * 0.55 + 2.1, LD * 0.5, 16, LAB_ROOF_Y - 4.2, 0.25);
  // Glowing Entrance Portal Trim
  addStructBox(labGroup, ledCyanMat, -5.2, 2.2, LD * 0.5 + 0.15, 0.25, 4.4, 0.3);
  addStructBox(labGroup, ledCyanMat, 5.2, 2.2, LD * 0.5 + 0.15, 0.25, 4.4, 0.3);
  addStructBox(labGroup, ledCyanMat, 0, 4.45, LD * 0.5 + 0.15, 10.6, 0.25, 0.3);

  // Rooftop Sky-Ring Spire Beacon (Matching Image #1 left building crown!)
  const spireRing = new THREE.Mesh(ringGeo, whiteFacadeMat);
  spireRing.rotation.x = Math.PI * 0.5;
  spireRing.position.set(0, LAB_ROOF_Y + 7.2, 0);
  spireRing.scale.setScalar(11.5);
  const spireRingGlow = new THREE.Mesh(ringGeo, ledCyanMat);
  spireRingGlow.rotation.x = Math.PI * 0.5;
  spireRingGlow.position.set(0, LAB_ROOF_Y + 6.9, 0);
  spireRingGlow.scale.setScalar(11.5);
  const spireCore = new THREE.Mesh(cylGeo, bank.holoBlue);
  spireCore.position.set(0, LAB_ROOF_Y + 7.0, 0);
  spireCore.scale.set(2.4, 14.0, 2.4);
  labGroup.add(spireRing, spireRingGlow, spireCore);

  // Exterior Signage ("FUTURE LAB · INNOVATION FOR A BETTER TOMORROW" + Left Department Marquee)
  const labSignTex = createSignBannerTexture('FUTURE LAB', 'INNOVATION FOR A BETTER TOMORROW', {
    badge: 'atom',
    w: 1024,
    h: 256,
  });
  texturesToDispose.push(labSignTex);
  const labSignMat = trackMat(new THREE.MeshBasicMaterial({ map: labSignTex }));
  addStructBox(labGroup, labSignMat, 0, LAB_ROOF_Y - 1.5, LD * 0.5 + 0.55, 28, 4.8, 0.25);

  const deptBoardTex = createSignBannerTexture('RESEARCH DIVISIONS', '', {
    lines: ['AI ROBOTICS', 'QUANTUM TECH', 'SPACE TECH', 'GREEN ENERGY', 'SMART SYSTEMS'],
    w: 512,
    h: 420,
  });
  texturesToDispose.push(deptBoardTex);
  const deptBoardMat = trackMat(new THREE.MeshBasicMaterial({ map: deptBoardTex }));
  addStructBox(labGroup, deptBoardMat, -22, 9.2, LD * 0.5 + 0.5, 14, 9.8, 0.25);

  // Lab Colliders (Perimeter leaving Front Door x: -5..5 open and East Skybridge 2F door open)
  const LX = FUTURE_LAB_BOUNDS.centerX;
  const LZ = FUTURE_LAB_BOUNDS.centerZ;
  addCollider(ctx.colliders, LX, 0, LZ - LD * 0.5, LW, LAB_ROOF_Y, 1.0);
  addCollider(ctx.colliders, LX - LW * 0.5, 0, LZ, 1.0, LAB_ROOF_Y, LD);
  addCollider(ctx.colliders, LX + LW * 0.5, 0, LZ, 1.0, 5.4, LD);
  addCollider(ctx.colliders, LX + LW * 0.5, 10.6, LZ, 1.0, 6.2, LD);
  addCollider(ctx.colliders, LX - 20, 0, LZ + LD * 0.5, 28, LAB_ROOF_Y, 1.0);
  addCollider(ctx.colliders, LX + 20, 0, LZ + LD * 0.5, 28, LAB_ROOF_Y, 1.0);

  // Atrium Hero Hologram Human + Robotic Arm
  buildFutureLabAtriumHero(labGroup, bank, anims);

  // Lab Interior Details: Side Reception Desk (clear central aisle!), Ceiling Light Strips, Staircases & Elevators
  addStructBox(labInteriorGroup, whiteFacadeMat, 12.2, 0.55, 15.8, 5.4, 1.1, 1.6);
  addStructBox(labInteriorGroup, ledCyanMat, 12.2, 0.92, 16.65, 5.1, 0.14, 0.08);
  addStructBox(labInteriorGroup, ledCyanMat, 0, LAB_ROOF_Y - 0.1, 0, 22, 0.12, 0.5);
  addStructBox(labInteriorGroup, ledCyanMat, 0, LAB_ROOF_Y - 0.1, 10, 18, 0.12, 0.4);
  if (!isReducedQ) {
    const labLight = new THREE.PointLight(0xe0f2fe, 2.2, 52, 1.4);
    labLight.position.set(0, 12.5, 4);
    labInteriorGroup.add(labLight);
  }
  buildArchitecturalStaircase(labInteriorGroup, ctx, pal, {
    ox: LX,
    oz: LZ,
    stairX: -12,
    zStart: -6,
    zEnd: -18,
    yBottom: 0,
    yTop: FH,
    width: 2.6,
    stepCount: 16,
    railSides: 'both',
    treadMat: whiteFacadeMat,
  });
  buildArchitecturalStaircase(labInteriorGroup, ctx, pal, {
    ox: LX,
    oz: LZ,
    stairX: 12,
    zStart: -18,
    zEnd: -6,
    yBottom: FH,
    yTop: FH * 2,
    width: 2.6,
    stepCount: 16,
    railSides: 'both',
    treadMat: whiteFacadeMat,
  });

  // Animated Glass Elevators (Left & Right Atrium Shafts)
  const elevatorCabins: THREE.Group[] = [];
  [-15, 15].forEach((ex) => {
    addStructBox(labInteriorGroup, skybridgeGlassMat, ex, LAB_ROOF_Y * 0.5, -2, 3.6, LAB_ROOF_Y, 3.6);
    const cabin = new THREE.Group();
    addStructBox(cabin, darkFrameMat, 0, 0.12, 0, 3.2, 0.24, 3.2);
    addStructBox(cabin, ledCyanMat, 0, 2.7, 0, 3.2, 0.16, 3.2);
    cabin.position.set(ex, 0.1, -2);
    elevatorCabins.push(cabin);
    labInteriorGroup.add(cabin);
  });

  // 10 Interactive Lab Benches & Animated Scientific Equipment inside Future Lab (1F, 2F, 3F)
  const labRotators: THREE.Object3D[] = [];
  FUTURE_LAB_DEPARTMENTS.forEach((dept, idx) => {
    const lx = dept.x - LX;
    const lz = dept.z - LZ;
    const ly = dept.y;
    const deptGrp = new THREE.Group();
    deptGrp.position.set(lx, ly, lz);
    // Lab bench & neon screen
    addStructBox(deptGrp, whiteFacadeMat, 0, 0.5, 0, 4.2, 1.0, 1.6);
    addStructBox(deptGrp, darkFrameMat, 0, 1.65, -0.5, 3.2, 1.4, 0.14);
    addStructBox(deptGrp, ledCyanMat, 0, 1.65, -0.42, 2.9, 1.1, 0.06);
    // Department unique 3D centerpiece instrument
    const inst = new THREE.Mesh(
      idx % 3 === 0 ? fullSphereGeo : idx % 3 === 1 ? ringGeo : cylGeo,
      idx % 2 === 0 ? bank.holoBlue : bank.goldMetal,
    );
    inst.position.set(0, 1.85, 0.25);
    inst.scale.setScalar(idx % 3 === 2 ? 0.85 : 0.65);
    labRotators.push(inst);
    deptGrp.add(inst);
    labInteriorGroup.add(deptGrp);
  });

  anims.push({
    zoneKey: 'future_lab',
    update: (t) => {
      const spd = state.labEnergyOverdrive ? 2.6 : 1.0;
      const targetElevY = (state.elevatorFloor.labWest - 1) * FH + 0.1;
      elevatorCabins.forEach((cab, idx) => {
        const autoY = ((Math.sin(t * 0.45 + idx * 1.5) * 0.5 + 0.5) * FH * 2) + 0.1;
        const dst = state.activeBuilding === 'future_lab' ? targetElevY : autoY;
        cab.position.y += (dst - cab.position.y) * 0.08;
      });
      labRotators.forEach((m, i) => {
        m.rotation.y = t * (0.9 + (i % 3) * 0.35) * spd;
        m.rotation.x = i % 2 === 0 ? Math.sin(t * 1.2) * 0.35 : 0;
      });
    },
  });

  // ============================================================================
  // 3. ELEVATED GLASS SKYBRIDGE (x: 98..134, z: -616, y: 5.6m)
  // ============================================================================
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(116, FH, -616);
  addStructBox(bridgeGroup, whiteFacadeMat, 0, -0.2, 0, 36, 0.4, 7.2);
  addStructBox(bridgeGroup, ledCyanMat, 0, -0.2, 3.65, 36, 0.18, 0.16);
  addStructBox(bridgeGroup, ledCyanMat, 0, -0.2, -3.65, 36, 0.18, 0.16);
  addStructBox(bridgeGroup, skybridgeGlassMat, 0, 1.9, 3.45, 36, 3.8, 0.18);
  addStructBox(bridgeGroup, skybridgeGlassMat, 0, 1.9, -3.45, 36, 3.8, 0.18);
  addStructBox(bridgeGroup, skybridgeGlassMat, 0, 3.9, 0, 36, 0.18, 7.1);
  // Grounded structural bridge piers at x=106 & x=126
  [-10, 10].forEach((bx) => {
    addStructBox(bridgeGroup, whiteFacadeMat, bx, -FH * 0.5, 0, 1.2, FH, 1.2);
    addCollider(ctx.colliders, 116 + bx, 0, -616, 1.4, FH, 1.4);
  });
  root.add(bridgeGroup);

  // ============================================================================
  // 4. SCIENCE MUSEUM BUILDING (East-North Wing at x=168, z=-618)
  // ============================================================================
  const museumGroup = new THREE.Group();
  museumGroup.position.set(SCIENCE_MUSEUM_BOUNDS.centerX, 0, SCIENCE_MUSEUM_BOUNDS.centerZ);
  root.add(museumGroup);

  const museumInteriorGroup = new THREE.Group();
  museumInteriorGroup.name = 'ScienceMuseumInterior';
  museumGroup.add(museumInteriorGroup);

  const MX = SCIENCE_MUSEUM_BOUNDS.centerX;
  const MZ = SCIENCE_MUSEUM_BOUNDS.centerZ;
  const M_WALL_H = 12.6;

  // Exterior Museum Hall + Giant Translucent Ribbed Glass Dome Crown
  addStructBox(museumGroup, graniteFloorMat, 0, 0.1, 0, LW, 0.2, LD);
  addStructBox(museumGroup, whiteFacadeMat, 0, M_WALL_H * 0.5, -LD * 0.5, LW, M_WALL_H, 0.7);
  // West wall leaves 2F Skybridge passage open
  addStructBox(museumGroup, whiteFacadeMat, -LW * 0.5, 2.8, 0, 0.8, 5.6, LD);
  addStructBox(museumGroup, whiteFacadeMat, -LW * 0.5, 9.2, -12, 0.8, 6.8, 20);
  addStructBox(museumGroup, whiteFacadeMat, -LW * 0.5, 9.2, 14, 0.8, 6.8, 16);
  addStructBox(museumGroup, whiteFacadeMat, LW * 0.5, M_WALL_H * 0.5, 0, 0.8, M_WALL_H, LD);
  // Front Portico with open central glass atrium doors (x: -7..+7 open)
  addStructBox(museumGroup, whiteFacadeMat, -21, M_WALL_H * 0.5, LD * 0.5, 26, M_WALL_H, 0.7);
  addStructBox(museumGroup, whiteFacadeMat, 21, M_WALL_H * 0.5, LD * 0.5, 26, M_WALL_H, 0.7);
  addStructBox(museumGroup, ledCyanMat, 0, 4.6, LD * 0.5 + 0.2, 14.5, 0.28, 0.35);

  const museumSignTex = createSignBannerTexture('MUSEUM', 'EXPLORE · LEARN · DISCOVER', {
    badge: 'museum',
    w: 1024,
    h: 280,
  });
  texturesToDispose.push(museumSignTex);
  const museumSignMat = trackMat(new THREE.MeshBasicMaterial({ map: museumSignTex }));
  addStructBox(museumGroup, museumSignMat, 0, 8.8, LD * 0.5 + 0.55, 26, 5.2, 0.25);

  // Flanking Golden Ancient & Astronaut showcase banners (Reference Image #1 Museum portico)
  const goldBannerTex = createSignBannerTexture('ANCIENT', 'GOLDEN GUARDIAN HALL', { bg: '#271506', border: '#fbbf24', accent: '#fde047', w: 320, h: 640 });
  const astroBannerTex = createSignBannerTexture('SPACE', 'APOLLO & ORBITAL', { bg: '#09182e', border: '#38bdf8', accent: '#bae6fd', w: 320, h: 640 });
  texturesToDispose.push(goldBannerTex, astroBannerTex);
  addStructBox(museumGroup, trackMat(new THREE.MeshBasicMaterial({ map: goldBannerTex })), -16.5, 6.2, LD * 0.5 + 0.55, 5.2, 10.2, 0.25);
  addStructBox(museumGroup, trackMat(new THREE.MeshBasicMaterial({ map: astroBannerTex })), 16.5, 6.2, LD * 0.5 + 0.55, 5.2, 10.2, 0.25);

  // Grand Ribbed Blue Glass Dome atop Science Museum!
  const museumDome = new THREE.Mesh(domeGeo, glassDomeMat);
  museumDome.position.set(0, M_WALL_H - 0.5, 0);
  museumDome.scale.set(27.5, 19.5, 21.0);
  museumDome.renderOrder = 5;
  museumGroup.add(museumDome);
  // Structural white dome half-arch ribs (top hemisphere only so nothing hangs into the Rotunda)
  for (let r = 0; r < 6; r++) {
    const rib = new THREE.Mesh(archRibGeo, whiteFacadeMat);
    rib.position.set(0, M_WALL_H - 0.4, 0);
    rib.rotation.y = (r / 6) * Math.PI;
    rib.scale.set(27.5, 19.5, 21.0);
    museumGroup.add(rib);
  }

  // Museum Colliders (leaving front portal x: -7..+7 open)
  addCollider(ctx.colliders, MX, 0, MZ - LD * 0.5, LW, M_WALL_H, 1.0);
  addCollider(ctx.colliders, MX + LW * 0.5, 0, MZ, 1.0, M_WALL_H, LD);
  addCollider(ctx.colliders, MX - LW * 0.5, 0, MZ, 1.0, 5.4, LD);
  addCollider(ctx.colliders, MX - 20.5, 0, MZ + LD * 0.5, 27, M_WALL_H, 1.0);
  addCollider(ctx.colliders, MX + 20.5, 0, MZ + LD * 0.5, 27, M_WALL_H, 1.0);

  // Museum Interior: Side Information Desk (clear central foyer!), Seating Benches, T-Rex Skeleton & 8 Alcoves
  addStructBox(museumInteriorGroup, whiteFacadeMat, 12.2, 0.55, 15.8, 5.4, 1.1, 1.6);
  addStructBox(museumInteriorGroup, ledGoldMat, 12.2, 0.92, 16.65, 5.1, 0.14, 0.08);
  addStructBox(museumInteriorGroup, ledCyanMat, 0, 0.22, 0, 14, 0.04, 14);
  if (!isReducedQ) {
    const museumLight = new THREE.PointLight(0xe0f2fe, 2.2, 54, 1.4);
    museumLight.position.set(0, 11.5, 2);
    museumInteriorGroup.add(museumLight);
  }
  [-12, 12].forEach((bx) => {
    addStructBox(museumInteriorGroup, darkFrameMat, bx, 0.42, 8.5, 3.6, 0.48, 1.1);
  });

  // Grand Centerpiece Animated T-Rex Skeleton inside Museum Lobby
  const museumRexFossil = buildAnimatedFossilCenterpiece(museumInteriorGroup, bank, anims);
  void museumRexFossil;

  // 8 Museum Exhibition Hall Alcoves (4 West, 4 East) + 2F Skybridge Landing Mezzanine
  addStructBox(museumInteriorGroup, graniteFloorMat, -22, FH, 0, 20, 0.28, LD - 4);
  buildArchitecturalStaircase(museumInteriorGroup, ctx, pal, {
    ox: MX,
    oz: MZ,
    stairX: -14,
    zStart: 12,
    zEnd: -2,
    yBottom: 0,
    yTop: FH,
    width: 2.6,
    stepCount: 16,
    railSides: 'both',
    treadMat: whiteFacadeMat,
  });

  SCIENCE_DOMES_CATALOG.forEach((dome, idx) => {
    const side = idx < 4 ? -1 : 1;
    const row = idx % 4;
    const ax = side * 24;
    const az = -13 + row * 8.6;
    addStructBox(museumInteriorGroup, darkFrameMat, ax, 0.55, az, 3.4, 1.1, 3.4);
    const hallIcon = new THREE.Mesh(
      idx % 2 === 0 ? fullSphereGeo : cylGeo,
      new THREE.MeshBasicMaterial({ color: dome.accentNum }),
    );
    hallIcon.position.set(ax, 1.8, az);
    hallIcon.scale.setScalar(0.75);
    museumInteriorGroup.add(hallIcon);
  });

  // ============================================================================
  // 5. EIGHT INDIVIDUAL ANIMATED TRANSPARENT GLASS DOMES
  // ============================================================================
  const domeInteriorGroups: Record<ScienceDomeId, THREE.Group> = {} as Record<ScienceDomeId, THREE.Group>;

  SCIENCE_DOMES_CATALOG.forEach((dome) => {
    const dg = new THREE.Group();
    dg.position.set(dome.x, 0.14, dome.z);
    root.add(dg);

    const accentMat = trackMat(new THREE.MeshBasicMaterial({ color: dome.accentNum }));

    // Stepped Circular Dome Podium + Glowing Perimeter Ring
    const baseRing = new THREE.Mesh(cylGeo, whiteFacadeMat);
    baseRing.position.y = 0.2;
    baseRing.scale.set(dome.radius * 2.15, 0.4, dome.radius * 2.15);
    const neonTrim = new THREE.Mesh(ringGeo, accentMat);
    neonTrim.rotation.x = Math.PI * 0.5;
    neonTrim.position.y = 0.42;
    neonTrim.scale.setScalar(dome.radius + 0.35);
    dg.add(baseRing, neonTrim);

    // Transparent Glass Dome Canopy (with 3.6m walk-in portal gap on front south face!)
    const canopy = new THREE.Mesh(domeGeo, glassDomeMat);
    canopy.position.y = 0.4;
    canopy.scale.set(dome.radius, dome.radius * 0.88, dome.radius);
    canopy.renderOrder = 6;
    dg.add(canopy);

    // Metallic Geodesic Half-Arch Frame Ribs (top hemisphere only)
    for (let r = 0; r < 4; r++) {
      const rib = new THREE.Mesh(archRibGeo, whiteFacadeMat);
      rib.position.y = 0.4;
      rib.rotation.y = (r / 4) * Math.PI + Math.PI * 0.125;
      rib.scale.set(dome.radius + 0.06, dome.radius * 0.88 + 0.06, dome.radius + 0.06);
      dg.add(rib);
    }

    // Illuminated Dome Title Plaque beside front entrance
    const plaqueTex = createSignBannerTexture(dome.shortTitle.toUpperCase(), `EXHIBITION DOME ${dome.index}`, {
      border: dome.accentHex,
      accent: dome.accentHex,
      w: 512,
      h: 180,
    });
    texturesToDispose.push(plaqueTex);
    const plaqueMat = trackMat(new THREE.MeshBasicMaterial({ map: plaqueTex }));
    addStructBox(dg, darkFrameMat, -3.2, 1.35, dome.radius + 0.45, 2.7, 1.15, 0.22);
    addStructBox(dg, plaqueMat, -3.2, 1.35, dome.radius + 0.58, 2.5, 0.96, 0.06);

    // Interior Animated Exhibits (On-Demand Visibility for Android 6GB RAM!)
    const intGrp = new THREE.Group();
    intGrp.name = `${dome.id}_interior`;
    dg.add(intGrp);
    domeInteriorGroups[dome.id] = intGrp;
    populateDomeExhibits(dome.index as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, intGrp, bank, anims);

    // Register [E] WorldInteractable for each Dome
    const domeInteract: WorldInteractable = {
      id: `sci_${dome.id}`,
      x: dome.x,
      y: 0.4,
      z: dome.z + dome.radius + 1.2,
      radius: 4.5,
      category: 'dashboard',
      getLabel: () => `Explore ${dome.title}`,
      trigger: () => `Opened ${dome.title}`,
    };
    ctx.interactables.push(domeInteract);
  });

  // Register [E] WorldInteractables for Future Lab & Science Museum Front Portals
  ctx.interactables.push(
    {
      id: 'sci_future_lab_portal',
      x: 64,
      y: 0.4,
      z: -592,
      radius: 5.5,
      category: 'dashboard',
      getLabel: () => 'Future Lab Console · 10 Research Labs',
      trigger: () => 'Future Lab Interface Ready',
    },
    {
      id: 'sci_museum_portal',
      x: 168,
      y: 0.4,
      z: -592,
      radius: 5.5,
      category: 'dashboard',
      getLabel: () => 'Science Museum Guide & 8 Domes',
      trigger: () => 'Science Museum Interface Ready',
    },
  );

  // ============================================================================
  // 6. INTELLIGENT ANIMATED DISTRICT NPCs (Scientists, Engineers, Guides, Bots)
  // ============================================================================
  const npcs: AnimatedDistrictNpc[] = [];
  const headGeo = trackGeo(new THREE.SphereGeometry(0.18, 10, 8));
  const torsoGeo = trackGeo(new THREE.BoxGeometry(0.44, 0.62, 0.24));
  const limbGeo = trackGeo(new THREE.BoxGeometry(0.15, 0.56, 0.16));

  SCIENCE_DISTRICT_NPCS.forEach((spec, idx) => {
    const ng = new THREE.Group();
    const shirtMat = trackMat(new THREE.MeshStandardMaterial({ color: spec.shirtHex, roughness: 0.6 }));
    const pantsMat = trackMat(new THREE.MeshStandardMaterial({ color: spec.pantsHex, roughness: 0.75 }));
    const accMat = trackMat(new THREE.MeshBasicMaterial({ color: spec.accentHex }));
    const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: spec.role === 'robot_assistant' ? 0xcbd5e1 : 0xf1c27d, roughness: 0.55 }));

    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.02;
    const head = new THREE.Mesh(headGeo, spec.role === 'robot_assistant' ? accMat : skinMat);
    head.position.y = 1.52;
    const badge = new THREE.Mesh(boxGeo, accMat);
    badge.position.set(0.12, 1.15, 0.13);
    badge.scale.set(0.1, 0.08, 0.03);

    const legL = new THREE.Mesh(limbGeo, pantsMat);
    legL.position.set(-0.12, 0.42, 0);
    const legR = new THREE.Mesh(limbGeo, pantsMat);
    legR.position.set(0.12, 0.42, 0);
    const armL = new THREE.Mesh(limbGeo, shirtMat);
    armL.position.set(-0.31, 1.02, 0);
    const armR = new THREE.Mesh(limbGeo, shirtMat);
    armR.position.set(0.31, 1.02, 0);

    ng.add(torso, head, badge, legL, legR, armL, armR);
    const p0 = spec.waypoints[0];
    ng.position.set(p0.x, p0.y, p0.z);
    root.add(ng);

    npcs.push({
      root: ng,
      legL,
      legR,
      armL,
      armR,
      waypoints: spec.waypoints,
      segIdx: 0,
      progress: (idx * 0.27) % 1,
      speed: spec.speed,
      phase: idx * 1.13,
      activity: spec.activity,
    });
  });

  ctx.arenaGroup.add(root);

  return {
    root,
    getState: () => state,
    setActiveBuilding: (target) => {
      state.activeBuilding = target;
    },
    setActiveDepartment: (dept) => {
      state.activeLabDept = dept;
      const found = FUTURE_LAB_DEPARTMENTS.find((d) => d.id === dept);
      if (found) state.elevatorFloor.labWest = found.floor;
    },
    toggleDomeBoost: (domeId) => {
      state.boostedDomes[domeId] = !state.boostedDomes[domeId];
      return state.boostedDomes[domeId];
    },
    toggleLabRobots: () => {
      state.labRobotsActive = !state.labRobotsActive;
      return state.labRobotsActive;
    },
    toggleLabOverdrive: () => {
      state.labEnergyOverdrive = !state.labEnergyOverdrive;
      return state.labEnergyOverdrive;
    },
    setElevatorFloor: (floor) => {
      state.elevatorFloor.labWest = floor;
      state.elevatorFloor.labEast = floor;
    },
    update: (dt, elapsed, playerPos, cameraPos) => {
      const cx = cameraPos?.x ?? playerPos.x;
      const cz = cameraPos?.z ?? playerPos.z;
      updateOnDemandInteriorLoading(state, cx, cz, playerPos.x, playerPos.z);

      // Apply on-demand interior visibility for smooth Android 6GB RAM performance
      labInteriorGroup.visible = state.loadedZones.futureLabInterior;
      museumInteriorGroup.visible = state.loadedZones.scienceMuseumInterior;
      for (let i = 0; i < SCIENCE_DOMES_CATALOG.length; i++) {
        const d = SCIENCE_DOMES_CATALOG[i];
        domeInteriorGroups[d.id].visible = state.loadedZones.domeInteriors[d.id];
      }

      // Skip all animations when player is far outside Science District unless interacting
      const nearDistrict =
        Math.hypot(cx - 116, cz - -560) <= 185 || Math.hypot(playerPos.x - 116, playerPos.z - -560) <= 185;
      if (!nearDistrict && state.activeBuilding === 'exterior') {
        return;
      }

      // Step visible exhibition animations
      for (let i = 0; i < anims.length; i++) {
        const a = anims[i];
        if (a.zoneKey === 'future_lab' && !labInteriorGroup.visible) continue;
        if (a.zoneKey === 'science_museum' && !museumInteriorGroup.visible) continue;
        if (a.zoneKey.startsWith('dome_')) {
          const idx = Number(a.zoneKey.slice(5)) - 1;
          const dome = SCIENCE_DOMES_CATALOG[idx];
          if (dome && !domeInteriorGroups[dome.id].visible) continue;
        }
        const boost = a.zoneKey.startsWith('dome_')
          ? state.boostedDomes[SCIENCE_DOMES_CATALOG[Number(a.zoneKey.slice(5)) - 1].id]
          : state.labEnergyOverdrive;
        a.update(elapsed, dt, boost);
      }

      // Step District NPCs smoothly along their paths & lab activities
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        const a = npc.waypoints[npc.segIdx];
        const b = npc.waypoints[(npc.segIdx + 1) % npc.waypoints.length];
        const dist = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const stepSpeed = npc.activity === 'operate' ? npc.speed * 0.55 : npc.speed;
        npc.progress += (dt * stepSpeed) / dist;
        while (npc.progress >= 1) {
          npc.progress -= 1;
          npc.segIdx = (npc.segIdx + 1) % npc.waypoints.length;
        }
        const curA = npc.waypoints[npc.segIdx];
        const curB = npc.waypoints[(npc.segIdx + 1) % npc.waypoints.length];
        npc.root.position.set(
          curA.x + (curB.x - curA.x) * npc.progress,
          curA.y + (curB.y - curA.y) * npc.progress,
          curA.z + (curB.z - curA.z) * npc.progress,
        );
        npc.root.rotation.y = Math.atan2(curB.x - curA.x, curB.z - curA.z);
        const gait = Math.sin(elapsed * 5.2 + npc.phase) * 0.42;
        npc.legL.rotation.x = gait;
        npc.legR.rotation.x = -gait;
        npc.armL.rotation.x = -gait * 0.75;
        npc.armR.rotation.x = npc.activity === 'operate' ? -0.8 + Math.sin(elapsed * 4 + npc.phase) * 0.25 : gait * 0.75;
      }
    },
    dispose: () => {
      texturesToDispose.forEach((t) => t.dispose());
      bank.sharedGeos.forEach((g) => g.dispose());
      bank.sharedMats.forEach((m) => m.dispose());
    },
  };
}

function buildAnimatedFossilCenterpiece(
  parent: THREE.Group,
  bank: ReturnType<typeof createExhibitMaterialBank>,
  anims: ScienceExhibitAnimEntry[],
) {
  const g = new THREE.Group();
  g.position.set(0, 0.2, 0);
  const cyl = new THREE.CylinderGeometry(3.8, 4.2, 0.5, 20);
  const box = new THREE.BoxGeometry(1, 1, 1);
  bank.sharedGeos.push(cyl, box);

  const stage = new THREE.Mesh(cyl, bank.slateMetal);
  stage.position.y = 0.25;
  g.add(stage);

  // Fossil Spine + Ribs + Articulated Skull + Tail
  const skull = new THREE.Group();
  skull.position.set(0, 3.85, 1.8);
  const cranium = new THREE.Mesh(box, bank.boneFossil);
  cranium.scale.set(0.85, 0.72, 1.55);
  const jaw = new THREE.Mesh(box, bank.boneFossil);
  jaw.position.set(0, -0.45, 0.15);
  jaw.scale.set(0.68, 0.24, 1.25);
  skull.add(cranium, jaw);

  const spine = new THREE.Mesh(box, bank.boneFossil);
  spine.position.set(0, 2.95, 0);
  spine.rotation.x = -0.25;
  spine.scale.set(0.55, 0.55, 3.4);
  for (let r = -1.0; r <= 1.0; r += 0.45) {
    const rib = new THREE.Mesh(box, bank.boneFossil);
    rib.position.set(0, 2.75, r);
    rib.scale.set(1.45, 0.95, 0.18);
    g.add(rib);
  }
  [-0.55, 0.55].forEach((lx) => {
    const leg = new THREE.Mesh(box, bank.boneFossil);
    leg.position.set(lx, 1.5, -0.2);
    leg.scale.set(0.38, 2.2, 0.42);
    g.add(leg);
  });
  g.add(spine, skull);
  parent.add(g);

  anims.push({
    zoneKey: 'science_museum',
    update: (t) => {
      skull.rotation.y = Math.sin(t * 0.9) * 0.3;
      jaw.rotation.x = (Math.sin(t * 2.1) * 0.5 + 0.5) * 0.28;
    },
  });
  return g;
}
