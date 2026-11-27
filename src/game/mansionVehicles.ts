import * as THREE from 'three';
import type { VehicleKind } from '../types';
import { DigitalDisplayManager, type AnimatedDisplayEntry } from './digitalDisplays';
import {
  createDeformablePart,
  createVehicleCrashState,
  type DeformableMeshPart,
  type VehicleCrashState,
} from './vehicleCrashPhysics';
import type { VehicleDoorStyle, VehicleGlassPane, VehicleSpec } from './vehicles';
import { MAIN_SCREEN_VIDEO_PLAYLIST } from './lobbyConfig';

export interface BuiltMansionVehicle {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheelSteerPivots: THREE.Group[];
  wheelRadii: number[];
  wheelSides: number[];
  glassPanes: VehicleGlassPane[];
  windowPanesFL: THREE.Mesh[];
  windowPanesFR: THREE.Mesh[];
  windowPanesRL: THREE.Mesh[];
  windowPanesRR: THREE.Mesh[];
  mainRotor: THREE.Object3D | null;
  tailRotor: THREE.Object3D | null;
  turretGroup: THREE.Object3D | null;
  turretMuzzle: THREE.Object3D | null;
  turretFlash: THREE.Mesh | null;
  leanGroup?: THREE.Group | null;
  steerPivot?: THREE.Group | null;
  doorPivotL?: THREE.Group | null;
  doorPivotR?: THREE.Group | null;
  doorStyle: VehicleDoorStyle;
  driverSeatOffset: THREE.Vector3;
  dashEntry: AnimatedDisplayEntry | null;
  secondLcdEntry: AnimatedDisplayEntry | null;
  secondLcdMesh: THREE.Mesh | null;
  dashStartButtonMesh: THREE.Mesh | null;
  startBtnMat: THREE.MeshStandardMaterial | null;
  nightGlowBeams: THREE.Mesh[];
  nightLightMats: THREE.MeshBasicMaterial[];
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  exhaustFlameMeshes: THREE.Mesh[];
  exhaustFlameMat: THREE.MeshBasicMaterial;
  hitMeshes: THREE.Mesh[];
  crashState: VehicleCrashState;
}

let cachedDragonTex: THREE.CanvasTexture | null = null;
function getDragonLiveryTexture(): THREE.CanvasTexture {
  if (cachedDragonTex) return cachedDragonTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle glossy obsidian gradient + gold Dragon S-curves & scales
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#0a0d14');
    grad.addColorStop(0.5, '#171b24');
    grad.addColorStop(1, '#07090d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      ctx.lineWidth = pass === 0 ? 22 : pass === 1 ? 11 : 4;
      ctx.strokeStyle = pass === 0 ? 'rgba(180, 115, 14, 0.7)' : pass === 1 ? '#fbbf24' : '#fef08a';
      ctx.beginPath();
      ctx.moveTo(40, 420);
      ctx.bezierCurveTo(140, 260, 190, 380, 270, 220);
      ctx.bezierCurveTo(330, 110, 410, 260, 476, 90);
      ctx.stroke();
    }

    // Stylized dragon scales, fins & whiskers along serpentine curve
    ctx.fillStyle = '#fde047';
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      const sx = 45 + t * 425;
      const sy = 415 - t * 320 + Math.sin(t * Math.PI * 2.5) * 44;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 16);
      ctx.lineTo(sx + 10, sy - 34);
      ctx.lineTo(sx + 18, sy - 12);
      ctx.closePath();
      ctx.fill();
    }
    // Dragon head crest top-right
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(466, 98, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(472, 92, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cachedDragonTex = tex;
  return tex;
}

let cachedMarbleTex: THREE.CanvasTexture | null = null;
function getMarbleDesignerTexture(): THREE.CanvasTexture {
  if (cachedMarbleTex) return cachedMarbleTex;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle Carrara grey marble veining
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.22)';
    for (let v = 0; v < 18; v++) {
      ctx.lineWidth = 1.5 + (v % 3) * 1.4;
      ctx.beginPath();
      let x = (v * 63) % 512;
      let y = 0;
      ctx.moveTo(x, y);
      for (let step = 1; step <= 8; step++) {
        x += Math.sin(v * 1.7 + step * 1.1) * 34;
        y = step * 64;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Crisp designer diamond/monogram pattern inspired by reference SUV
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.lineWidth = 1.4;
    for (let gx = 16; gx < 512; gx += 48) {
      for (let gy = 16; gy < 512; gy += 48) {
        ctx.strokeRect(gx - 7, gy - 7, 14, 14);
        ctx.beginPath();
        ctx.arc(gx + 16, gy + 16, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cachedMarbleTex = tex;
  return tex;
}

function createExtrudedProfile(points: [number, number][], width: number, bevel = 0.04): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.08, width - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -(width - bevel * 2) * 0.5);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

function buildLuxuryAlloyWheel(
  radius: number,
  width: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  accentMat: THREE.Material,
  isSoftwareGl: boolean,
  spokes = 8,
): THREE.Mesh {
  const wheelGeo = new THREE.CylinderGeometry(radius, radius, width, isSoftwareGl ? 18 : 26);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheel = new THREE.Mesh(wheelGeo, tireMat);
  wheel.castShadow = !isSoftwareGl;
  wheel.receiveShadow = true;

  const barrelGeo = new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, width * 1.03, 18);
  barrelGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(barrelGeo, rimMat));

  const spokeGeo = new THREE.BoxGeometry(width * 1.05, radius * 1.28, radius * 0.075);
  for (let s = 0; s < spokes; s++) {
    const sp = new THREE.Mesh(spokeGeo, s % 2 === 0 ? accentMat : rimMat);
    sp.rotation.x = (s / spokes) * Math.PI;
    wheel.add(sp);
  }

  const hubGeo = new THREE.CylinderGeometry(radius * 0.19, radius * 0.19, width * 1.08, 12);
  hubGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(hubGeo, accentMat));
  return wheel;
}

function attachMansionCockpitWithStartButton(
  vehicleId: string,
  seatColor: number,
  trimColor: number,
  seatY: number,
  seatZ: number,
  dashZ: number,
  cabinWidth: number,
  displays: DigitalDisplayManager | null | undefined,
  darkMat: THREE.Material,
  steerWheelX: number,
): {
  interiorGroup: THREE.Group;
  dashEntry: AnimatedDisplayEntry | null;
  secondLcdEntry: AnimatedDisplayEntry | null;
  secondLcdMesh: THREE.Mesh | null;
  steerPivot: THREE.Group;
  dashStartButtonMesh: THREE.Mesh;
  startBtnMat: THREE.MeshStandardMaterial;
} {
  const interiorGroup = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: seatColor, roughness: 0.58, metalness: 0.08 });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.28, metalness: 0.65 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.9, 0.07, 1.92), darkMat);
  floor.position.set(0, seatY - 0.16, seatZ - 0.18);
  interiorGroup.add(floor);

  const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 1.44), darkMat);
  consoleBox.position.set(0, seatY - 0.02, seatZ - 0.28);
  const consoleTrim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 1.36), trimMat);
  consoleTrim.position.set(0, seatY + 0.1, seatZ - 0.28);
  interiorGroup.add(consoleBox, consoleTrim);

  // Sculpted Luxury Seats
  const seatSpacing = Math.min(0.46, cabinWidth * 0.25);
  [-seatSpacing, seatSpacing].forEach((sx) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.5), seatMat);
    base.position.set(sx, seatY - 0.05, seatZ);
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.54, 0.12), seatMat);
    backrest.position.set(sx, seatY + 0.23, seatZ + 0.22);
    backrest.rotation.x = -0.22;
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.1), seatMat);
    headrest.position.set(sx, seatY + 0.54, seatZ + 0.28);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.03), trimMat);
    stripe.position.set(sx, seatY + 0.24, seatZ + 0.15);
    stripe.rotation.x = -0.22;
    interiorGroup.add(base, backrest, headrest, stripe);
  });

  // Dashboard + Wide Digital Infotainment
  const dashBase = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.9, 0.22, 0.42), darkMat);
  dashBase.position.set(0, seatY + 0.12, dashZ);
  const dashUpper = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.86, 0.05, 0.4), trimMat);
  dashUpper.position.set(0, seatY + 0.24, dashZ - 0.02);
  interiorGroup.add(dashBase, dashUpper);

  let dashEntry: AnimatedDisplayEntry | null = null;
  let secondLcdEntry: AnimatedDisplayEntry | null = null;
  let secondLcdMesh: THREE.Mesh | null = null;
  if (displays) {
    const { material: dashMat, entry } = displays.createDisplayMaterial('car_cockpit', { intervalSec: 0.08 });
    dashEntry = entry;
    const clusterFrame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.15, 0.03), darkMat);
    clusterFrame.position.set(steerWheelX, seatY + 0.21, dashZ + 0.2);
    clusterFrame.rotation.x = -0.18;
    const clusterPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.13), dashMat);
    clusterPanel.position.set(0, 0, 0.017);
    clusterFrame.add(clusterPanel);

    const { material: ytMat, entry: ytEntry } = displays.createVideoDisplayMaterial(
      MAIN_SCREEN_VIDEO_PLAYLIST,
      'car_second_lcd',
      {
        title: 'MAIN SCREEN VIDEO',
        subtitle: 'MAIN SCREEN VIDEO · CAR 2ND LCD',
        accentHex: '#38bdf8',
        width: 512,
        height: 288,
        intervalSec: 0.033,
        audioMode: 'vehicle_lcd',
        vehicleId,
        maxAudioVolume: 0.12,
      },
    );
    secondLcdEntry = ytEntry;

    // Sleek 16:9 Floating 2nd Display mounted OUT and ABOVE the dashboard cowl (zero interior clipping)
    const lcdX = -0.01;
    const lcdY = seatY + 0.375;
    const lcdZ = dashZ + 0.23;

    const mountArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.06), trimMat);
    mountArm.position.set(lcdX, seatY + 0.285, dashZ + 0.17);
    mountArm.rotation.x = 0.32;

    const tabletFrame = new THREE.Mesh(new THREE.BoxGeometry(0.365, 0.212, 0.024), darkMat);
    tabletFrame.position.set(lcdX, lcdY, lcdZ);
    tabletFrame.rotation.set(-0.06, -0.22, 0);
    tabletFrame.userData.secondLcdVehicleId = vehicleId;

    const tabletTrimBezel = new THREE.Mesh(new THREE.BoxGeometry(0.378, 0.224, 0.014), trimMat);
    tabletTrimBezel.position.set(0, 0, -0.008);
    tabletFrame.add(tabletTrimBezel);

    const centerNav = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.192), ytMat);
    centerNav.position.set(0, 0, 0.015);
    centerNav.userData.secondLcdVehicleId = vehicleId;
    centerNav.userData.isSecondLcdFace = true;
    tabletFrame.add(centerNav);
    tabletFrame.userData.secondLcdFace = centerNav;
    tabletFrame.userData.secondLcdWidth = 0.34;
    tabletFrame.userData.secondLcdHeight = 0.192;

    secondLcdMesh = tabletFrame;
    interiorGroup.add(clusterFrame, mountArm, tabletFrame);
  }

  // Physical Glowing 3D Engine Start/Stop Push Button right beside steering wheel on center console!
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.024, 16), trimMat);
  bezel.rotation.x = Math.PI * 0.5 - 0.2;
  bezel.position.set(steerWheelX + 0.21, seatY + 0.15, dashZ + 0.25);
  const startBtnMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 1.4,
    roughness: 0.22,
    metalness: 0.4,
  });
  const dashStartButtonMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16), startBtnMat);
  dashStartButtonMesh.rotation.x = Math.PI * 0.5 - 0.2;
  dashStartButtonMesh.position.set(steerWheelX + 0.21, seatY + 0.15, dashZ + 0.26);
  dashStartButtonMesh.userData.dashStartVehicleId = vehicleId;
  interiorGroup.add(bezel, dashStartButtonMesh);

  // Sport Steering Wheel
  const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.26, 8), darkMat);
  steerCol.rotation.x = Math.PI * 0.5 - 0.34;
  steerCol.position.set(steerWheelX, seatY + 0.18, dashZ + 0.23);
  interiorGroup.add(steerCol);

  const steerPivot = new THREE.Group();
  steerPivot.position.set(steerWheelX, seatY + 0.21, dashZ + 0.35);
  steerPivot.rotation.x = -0.34;
  const steerRim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.022, 8, 20), darkMat);
  const steerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 10), trimMat);
  steerHub.rotation.x = Math.PI * 0.5;
  const steerSpokeH = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.028, 0.018), darkMat);
  const steerTopStripe = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.03, 0.03), trimMat);
  steerTopStripe.position.set(0, 0.155, 0);
  steerPivot.add(steerRim, steerHub, steerSpokeH, steerTopStripe);
  interiorGroup.add(steerPivot);

  return { interiorGroup, dashEntry, secondLcdEntry, secondLcdMesh, steerPivot, dashStartButtonMesh, startBtnMat };
}

function attachLuxuryCarWireScreensAndSilencers(
  group: THREE.Group,
  kind: VehicleKind,
  spec: VehicleSpec,
  displays: DigitalDisplayManager | null | undefined,
  wireMat: THREE.Material,
  chromeMat: THREE.Material,
  darkMetal: THREE.Material,
  exhaustOffsetsX: number[],
  rearZ: number,
  silencerY: number,
  bodyW: number,
  roofY: number,
  wideScreenPos: [number, number, number],
  wideScreenSize: [number, number],
  smallScreenPos: [number, number, number],
  smallScreenSize: [number, number],
): { exhaustFlameMeshes: THREE.Mesh[]; exhaustFlameMat: THREE.MeshBasicMaterial } {
  // 1) Thin wire-like glowing LED accents along hood contour, roof line & rear diffuser
  [-bodyW * 0.34, bodyW * 0.34].forEach((lx) => {
    const roofWire = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 2.2), wireMat);
    roofWire.position.set(lx, roofY + 0.045, 0.35);
    const hoodWire = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 1.18), wireMat);
    hoodWire.position.set(lx * 0.85, silencerY + 0.62, -rearZ * 0.72);
    group.add(roofWire, hoodWire);
  });
  const frontGrilleWire = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.74, 0.032, 0.036), wireMat);
  frontGrilleWire.position.set(0, silencerY + 0.24, -rearZ + 0.02);
  const rearDiffuserWire = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.76, 0.032, 0.036), wireMat);
  rearDiffuserWire.position.set(0, silencerY + 0.08, rearZ + 0.02);
  group.add(frontGrilleWire, rearDiffuserWire);

  // 2) Fixed-proportion Large Wide + Small Exterior Digital Screens (custom branding, zero clothes/watch ads)
  if (displays) {
    const accentHex =
      kind === 'mansion_ev_gt' ? '#38bdf8' : kind === 'mansion_range_marble' ? '#fbbf24' : '#f59e0b';
    const { material: extScreenMat } = displays.createDisplayMaterial('city_billboard', {
      title: 'DEVELOPED BY AFTAB BALOCH DADU',
      subtitle: spec.name.toUpperCase(),
      accentHex,
      lockTitle: true,
      width: 512,
      height: 128,
      intervalSec: 0.7,
    });

    // Large wide digital display on rear fascia / aero deck
    const wideBezel = new THREE.Mesh(
      new THREE.BoxGeometry(wideScreenSize[0] + 0.07, wideScreenSize[1] + 0.06, 0.05),
      darkMetal,
    );
    wideBezel.position.set(wideScreenPos[0], wideScreenPos[1], wideScreenPos[2]);
    const wideFace = new THREE.Mesh(new THREE.PlaneGeometry(wideScreenSize[0], wideScreenSize[1]), extScreenMat);
    wideFace.position.set(0, 0, 0.028);
    wideBezel.add(wideFace);
    group.add(wideBezel);

    // Small crisp digital nameplates on both left & right lower rear doors / quarter panels
    [-1, 1].forEach((sideSign) => {
      const smallBezel = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, smallScreenSize[1] + 0.04, smallScreenSize[0] + 0.05),
        darkMetal,
      );
      smallBezel.position.set(sideSign * smallScreenPos[0], smallScreenPos[1], smallScreenPos[2]);
      const smallFace = new THREE.Mesh(
        new THREE.PlaneGeometry(smallScreenSize[0], smallScreenSize[1]),
        extScreenMat,
      );
      smallFace.position.set(sideSign * 0.023, 0, 0);
      smallFace.rotation.y = sideSign * Math.PI * 0.5;
      smallBezel.add(smallFace);
      group.add(smallBezel);
    });
  }

  // 3) Rear Dual/Quad Exhaust Silencer Mufflers + Speed-Colored Backfire Flame Cones
  const exhaustFlameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
    depthWrite: false,
  });
  const exhaustFlameMeshes: THREE.Mesh[] = [];
  const mufflerGeo = new THREE.CylinderGeometry(0.088, 0.095, 0.42, 12);
  mufflerGeo.rotateX(Math.PI * 0.5);
  const tipGeo = new THREE.CylinderGeometry(0.062, 0.068, 0.24, 12);
  tipGeo.rotateX(Math.PI * 0.5);
  const flameGeo = new THREE.ConeGeometry(0.082, 0.62, 10);
  flameGeo.rotateX(Math.PI * 0.5); // Apex points backward along +Z

  for (let i = 0; i < exhaustOffsetsX.length; i++) {
    const ex = exhaustOffsetsX[i];
    const muffler = new THREE.Mesh(mufflerGeo, darkMetal);
    muffler.position.set(ex, silencerY, rearZ - 0.14);
    const tip = new THREE.Mesh(tipGeo, chromeMat);
    tip.position.set(ex, silencerY, rearZ + 0.08);
    const flame = new THREE.Mesh(flameGeo, exhaustFlameMat);
    flame.position.set(ex, silencerY, rearZ + 0.42);
    flame.visible = false;
    group.add(muffler, tip, flame);
    exhaustFlameMeshes.push(flame);
  }

  return { exhaustFlameMeshes, exhaustFlameMat };
}

/**
 * Builds the 6 exclusive Private Mansion Luxury Cars.
 * Guaranteed exclusive to Mansion grounds — never spawned in public NPC traffic.
 */
export function buildMansionExclusiveVehicleMesh(
  id: string,
  kind: VehicleKind,
  spec: VehicleSpec,
  isSoftwareGl: boolean,
  displays?: DigitalDisplayManager | null,
): BuiltMansionVehicle {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const frontWheelSteerPivots: THREE.Group[] = [];
  const wheelRadii: number[] = [];
  const wheelSides: number[] = [];
  const glassPanes: VehicleGlassPane[] = [];
  const windowPanesFL: THREE.Mesh[] = [];
  const windowPanesFR: THREE.Mesh[] = [];
  const windowPanesRL: THREE.Mesh[] = [];
  const windowPanesRR: THREE.Mesh[] = [];
  const hitMeshes: THREE.Mesh[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  const nightGlowBeams: THREE.Mesh[] = [];
  const doorPivotL = new THREE.Group();
  const doorPivotR = new THREE.Group();
  group.add(doorPivotL, doorPivotR);

  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x111419, roughness: 0.52, metalness: 0.65 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.4, metalness: 0.38 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.88, metalness: 0.06 });
  const whiteLedMat = new THREE.MeshBasicMaterial({ color: 0xf8fcff, toneMapped: false });
  const redTailMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false });
  const cyanLedMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, toneMapped: false });
  const goldLedMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, toneMapped: false });
  const headlightBeamMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const nightLightMats = [whiteLedMat, redTailMat, cyanLedMat, goldLedMat];

  const baseGlassColor = 0x8db4ce;
  const baseGlassOpacity = 0.28;
  const glassMat = new THREE.MeshStandardMaterial({
    color: baseGlassColor,
    roughness: 0.08,
    metalness: 0.45,
    transparent: true,
    opacity: baseGlassOpacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const tagHit = (mesh: THREE.Mesh) => {
    mesh.userData.vehicleId = id;
    mesh.castShadow = !isSoftwareGl;
    mesh.receiveShadow = true;
    hitMeshes.push(mesh);
  };

  const registerVehicleLight = (mesh: THREE.Mesh, role: 'headlight' | 'taillight') => {
    mesh.userData.vehicleId = id;
    mesh.userData.vehiclePart = role;
    mesh.userData.origMaterial = mesh.material;
    mesh.userData.lightBroken = false;
    hitMeshes.push(mesh);
    if (role === 'headlight') headlightMeshes.push(mesh);
    else taillightMeshes.push(mesh);
  };

  const registerGlass = (mesh: THREE.Mesh, windowRole?: 'FL' | 'FR' | 'RL' | 'RR', baseH = 0.46) => {
    const idx = glassPanes.length;
    mesh.userData.vehicleId = id;
    mesh.userData.vehiclePart = 'glass';
    mesh.userData.glassIdx = idx;
    mesh.userData.baseGlassY = mesh.position.y;
    mesh.userData.baseGlassH = baseH;
    mesh.receiveShadow = true;
    hitMeshes.push(mesh);
    glassPanes.push({
      mesh,
      state: 'intact',
      baseOpacity: baseGlassOpacity,
      baseColor: baseGlassColor,
      baseMaterial: glassMat,
    });
    if (windowRole === 'FL') windowPanesFL.push(mesh);
    else if (windowRole === 'FR') windowPanesFR.push(mesh);
    else if (windowRole === 'RL') windowPanesRL.push(mesh);
    else if (windowRole === 'RR') windowPanesRR.push(mesh);
  };

  const registerWheel = (wMesh: THREE.Mesh, radius: number, sideSign: number) => {
    const idx = wheels.length;
    wMesh.traverse((ch) => {
      if (ch instanceof THREE.Mesh) {
        ch.userData.vehicleId = id;
        ch.userData.vehiclePart = 'wheel';
        ch.userData.wheelIdx = idx;
        hitMeshes.push(ch);
      }
    });
    wheels.push(wMesh);
    wheelRadii.push(radius);
    wheelSides.push(sideSign);
  };

  const attachHeadlightBeam = (frontZ: number) => {
    const beam = new THREE.Mesh(new THREE.CircleGeometry(1.0, 12), headlightBeamMat);
    beam.rotation.x = -Math.PI * 0.5;
    beam.scale.set(1.6, 4.6, 1);
    beam.position.set(0, 0.06, frontZ - 4.4);
    beam.visible = false;
    group.add(beam);
    nightGlowBeams.push(beam);
  };

  // Helper for articulated 2-door and 4-door luxury cars with individually motorized sliding door glass!
  const attachLuxuryDoors = (
    bodyMat: THREE.Material,
    doorLen: number,
    doorHeight: number,
    doorY: number,
    doorCenterZ: number,
    sideX: number,
    glassHeight: number,
    fourDoor: boolean,
  ) => {
    const hingeZ = doorCenterZ - doorLen * 0.46;
    const isGull = spec.doorStyle === 'gullwing';
    const pivotY = isGull ? doorY + doorHeight * 0.5 + glassHeight : doorY;
    doorPivotL.position.set(-sideX, pivotY, hingeZ);
    doorPivotR.position.set(sideX, pivotY, hingeZ);

    const buildLeaf = (pivot: THREE.Group, sign: number, sideRole: 'L' | 'R') => {
      const leafPanel = new THREE.Mesh(new THREE.BoxGeometry(0.085, doorHeight, doorLen), bodyMat);
      leafPanel.position.set(0, isGull ? -(doorHeight * 0.5 + glassHeight) : 0, doorLen * 0.46);
      tagHit(leafPanel);

      const glassLen = fourDoor ? doorLen * 0.42 : doorLen * 0.84;
      const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, glassHeight, glassLen), glassMat);
      frontGlass.position.set(
        sign * -0.02,
        leafPanel.position.y + doorHeight * 0.5 + glassHeight * 0.46,
        fourDoor ? doorLen * 0.25 : doorLen * 0.46,
      );
      registerGlass(frontGlass, sideRole === 'L' ? 'FL' : 'FR', glassHeight);
      pivot.add(leafPanel, frontGlass);

      if (fourDoor) {
        const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, glassHeight, doorLen * 0.42), glassMat);
        rearGlass.position.set(
          sign * -0.02,
          leafPanel.position.y + doorHeight * 0.5 + glassHeight * 0.46,
          doorLen * 0.72,
        );
        registerGlass(rearGlass, sideRole === 'L' ? 'RL' : 'RR', glassHeight);
        pivot.add(rearGlass);
      }

      const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.13), carbonMat);
      mirrorArm.position.set(sign * 0.11, leafPanel.position.y + doorHeight * 0.46, doorLen * 0.14);
      pivot.add(mirrorArm);
    };

    buildLeaf(doorPivotL, -1, 'L');
    buildLeaf(doorPivotR, 1, 'R');
  };

  const deformParts: DeformableMeshPart[] = [];

  // =========================================================================
  // 1) MANSION SCISSOR-DOOR HYPERCAR & EV CONCEPT GT
  // =========================================================================
  if (kind === 'mansion_hyper_scissor' || kind === 'mansion_ev_gt') {
    const isEv = kind === 'mansion_ev_gt';
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isEv ? 0xf1f5f9 : 0x16181f,
      roughness: isEv ? 0.14 : 0.2,
      metalness: isEv ? 0.42 : 0.78,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: isEv ? 0x0ea5e9 : 0xd99b26,
      roughness: 0.2,
      metalness: 0.85,
    });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.22, metalness: 0.8 });

    const nose = new THREE.Mesh(
      createExtrudedProfile(
        [
          [-2.32, 0.26],
          [-2.24, 0.48],
          [-0.76, 0.68],
          [-0.76, 0.26],
        ],
        1.98,
        0.04,
      ),
      bodyMat,
    );
    const tail = new THREE.Mesh(
      createExtrudedProfile(
        [
          [0.64, 0.28],
          [0.64, 0.92],
          [2.28, 0.95],
          [2.3, 0.34],
        ],
        2.0,
        0.04,
      ),
      bodyMat,
    );
    const floorPan = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.14, 1.54), bodyMat);
    floorPan.position.set(0, 0.3, -0.06);
    tagHit(nose);
    tagHit(tail);
    tagHit(floorPan);
    group.add(nose, tail, floorPan);

    const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.06, 1.48, 4, 1, 4), bodyMat);
    hoodMesh.position.set(0, 0.64, -1.52);
    hoodMesh.rotation.x = -0.14;
    tagHit(hoodMesh);
    deformParts.push(createDeformablePart(hoodMesh, 0.9));
    group.add(hoodMesh);

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.08, 0.38, 4, 1, 2), carbonMat);
    splitter.position.set(0, 0.22, -2.28);
    tagHit(splitter);
    deformParts.push(createDeformablePart(splitter, 1.0));
    group.add(splitter);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 1.18), isEv ? bodyMat : carbonMat);
    roof.position.set(0, 1.5, 0.06);
    tagHit(roof);
    group.add(roof);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.68, 0.04), glassMat);
    windshield.position.set(0, 1.18, -0.68);
    windshield.rotation.x = 0.34;
    registerGlass(windshield);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 1.24), glassMat);
    rearGlass.position.set(0, 1.24, 1.16);
    rearGlass.rotation.x = -0.25;
    registerGlass(rearGlass);
    group.add(windshield, rearGlass);

    // Thin signature LED wires along rockers & headlights/taillights
    const wireMat = isEv ? cyanLedMat : goldLedMat;
    [-0.98, 0.98].forEach((sx) => {
      const rockerWire = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 2.4), wireMat);
      rockerWire.position.set(sx, 0.24, 0);
      group.add(rockerWire);

      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.08), isEv ? cyanLedMat : whiteLedMat);
      hl.position.set(sx * 0.78, 0.56, -2.28);
      registerVehicleLight(hl, 'headlight');
      group.add(hl);
    });
    const tailLed = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.055, 0.07), redTailMat);
    tailLed.position.set(0, 0.78, 2.3);
    registerVehicleLight(tailLed, 'taillight');
    group.add(tailLed);
    attachHeadlightBeam(-2.34);

    if (!isEv) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.05, 0.34), carbonMat);
      wing.position.set(0, 1.46, 2.08);
      group.add(wing);
    }

    attachLuxuryDoors(bodyMat, 1.24, 0.48, 0.7, 0.04, 0.96, 0.42, false);

    const cockpit = attachMansionCockpitWithStartButton(
      id,
      isEv ? 0xf8fafc : 0x261d14,
      isEv ? 0x0ea5e9 : 0xd99b26,
      0.72,
      0.16,
      -0.62,
      1.7,
      displays,
      darkMetal,
      spec.driverSeatOffset[0],
    );
    if (cockpit.dashEntry) {
      cockpit.dashEntry.title = spec.name;
      cockpit.dashEntry.hpValue = spec.maxHp;
      cockpit.dashEntry.maxHpValue = spec.maxHp;
    }
    group.add(cockpit.interiorGroup);

    const extFx = attachLuxuryCarWireScreensAndSilencers(
      group,
      kind,
      spec,
      displays,
      wireMat,
      accentMat,
      darkMetal,
      [-0.54, -0.34, 0.34, 0.54],
      2.3,
      0.34,
      1.98,
      1.5,
      [0, 1.04, 2.28],
      [1.48, 0.34],
      [0.98, 0.54, 1.16],
      [0.62, 0.2],
    );

    const rad = spec.wheelRadius;
    (
      [
        [-1.02, -1.44],
        [1.02, -1.44],
        [-1.04, 1.42],
        [1.04, 1.42],
      ] as [number, number][]
    ).forEach(([wx, wz]) => {
      const wMesh = buildLuxuryAlloyWheel(rad, 0.32, tireMat, rimMat, accentMat, isSoftwareGl, 8);
      if (wz < 0) {
        const pivot = new THREE.Group();
        pivot.position.set(wx, rad, wz);
        pivot.add(wMesh);
        group.add(pivot);
        frontWheelSteerPivots.push(pivot);
      } else {
        wMesh.position.set(wx, rad, wz);
        group.add(wMesh);
      }
      registerWheel(wMesh, rad, wx < 0 ? -1 : 1);
    });

    return {
      group,
      wheels,
      frontWheelSteerPivots,
      wheelRadii,
      wheelSides,
      glassPanes,
      windowPanesFL,
      windowPanesFR,
      windowPanesRL,
      windowPanesRR,
      mainRotor: null,
      tailRotor: null,
      turretGroup: null,
      turretMuzzle: null,
      turretFlash: null,
      steerPivot: cockpit.steerPivot,
      doorPivotL,
      doorPivotR,
      doorStyle: spec.doorStyle,
      driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
      dashEntry: cockpit.dashEntry,
      secondLcdEntry: cockpit.secondLcdEntry,
      secondLcdMesh: cockpit.secondLcdMesh,
      dashStartButtonMesh: cockpit.dashStartButtonMesh,
      startBtnMat: cockpit.startBtnMat,
      nightGlowBeams,
      nightLightMats,
      headlightMeshes,
      taillightMeshes,
      exhaustFlameMeshes: extFx.exhaustFlameMeshes,
      exhaustFlameMat: extFx.exhaustFlameMat,
      hitMeshes,
      crashState: createVehicleCrashState({ paintMaterial: bodyMat, deformParts }),
    };
  }

  // =========================================================================
  // 2) LUXURY MANSION SUV COLLECTION:
  //    - Escalade Gullwing (`mansion_escalade_gull`)
  //    - Gold/Matte Hummer Exoskeleton (`mansion_hummer_gold`)
  //    - Dragon Livery Escalade (`mansion_escalade_dragon`)
  //    - White Marble & Gold Designer Range (`mansion_range_marble`)
  // =========================================================================
  const isHummer = kind === 'mansion_hummer_gold';
  const isDragon = kind === 'mansion_escalade_dragon';
  const isMarble = kind === 'mansion_range_marble';
  const isGullEsc = kind === 'mansion_escalade_gull';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: isMarble ? 0xffffff : isHummer ? 0x181a1f : 0x111318,
    map: isDragon ? getDragonLiveryTexture() : isMarble ? getMarbleDesignerTexture() : null,
    roughness: isHummer ? 0.56 : 0.16,
    metalness: isHummer ? 0.35 : 0.62,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: isGullEsc ? 0xd1d5db : 0xd99b26,
    roughness: 0.2,
    metalness: 0.88,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: isMarble || isHummer ? 0xd99b26 : 0x161920,
    roughness: 0.24,
    metalness: 0.86,
  });

  const bodyLen = isHummer ? 4.86 : 5.05;
  const bodyW = isHummer ? 2.16 : 2.08;

  const frontNose = new THREE.Mesh(
    createExtrudedProfile(
      [
        [-bodyLen * 0.5, 0.44],
        [-bodyLen * 0.5, 1.04],
        [-0.86, 1.1],
        [-0.86, 0.44],
      ],
      bodyW * 0.96,
      0.04,
    ),
    bodyMat,
  );
  const rearCargo = new THREE.Mesh(
    createExtrudedProfile(
      [
        [0.82, 0.44],
        [0.82, 1.24],
        [bodyLen * 0.48, 1.22],
        [bodyLen * 0.5, 0.44],
      ],
      bodyW,
      0.04,
    ),
    bodyMat,
  );
  const floorPan = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.96, 0.24, 1.76), bodyMat);
  floorPan.position.set(0, 0.56, -0.02);
  tagHit(frontNose);
  tagHit(rearCargo);
  tagHit(floorPan);
  group.add(frontNose, rearCargo, floorPan);

  // Sculpted Hood + Front Deformable Bumper
  const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.88, 0.08, bodyLen * 0.5 - 0.86, 4, 1, 4), bodyMat);
  hoodMesh.position.set(0, 1.12, -bodyLen * 0.25 - 0.44);
  tagHit(hoodMesh);
  deformParts.push(createDeformablePart(hoodMesh, 0.95));

  const frontBumper = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW * 1.02, 0.26, 0.26, 4, 2, 2),
    isHummer ? accentMat : darkMetal,
  );
  frontBumper.position.set(0, 0.54, -bodyLen * 0.5 - 0.04);
  tagHit(frontBumper);
  deformParts.push(createDeformablePart(frontBumper, 1.05));
  group.add(hoodMesh, frontBumper);

  // Full-length SUV Roof + Pillars
  const roof = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.88, 0.09, 2.95), bodyMat);
  roof.position.set(0, 2.06, 0.56);
  tagHit(roof);
  group.add(roof);

  [-bodyW * 0.44, bodyW * 0.44].forEach((sx) => {
    const aPil = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.86, 0.12), bodyMat);
    aPil.position.set(sx, 1.62, -0.82);
    aPil.rotation.x = isHummer ? 0.12 : 0.26;
    const cPil = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.86, 0.24), bodyMat);
    cPil.position.set(sx, 1.62, 1.94);
    group.add(aPil, cPil);

    // Exoskeleton gold lower skid/nerf bars for Matte Hummer + side steps on SUVs
    const sideStep = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.09, 2.1),
      isHummer || isMarble ? accentMat : darkMetal,
    );
    sideStep.position.set(sx * 1.14, 0.44, 0.06);
    group.add(sideStep);

    if (isHummer) {
      [-1.56, 1.52].forEach((fz) => {
        const exoStrut = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.82), accentMat);
        exoStrut.position.set(sx * 1.12, 0.62, fz);
        group.add(exoStrut);
      });
    }
  });

  // Panoramic Front & Rear Glass
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.78, 0.8, 0.05), glassMat);
  windshield.position.set(0, 1.62, -0.82);
  windshield.rotation.x = isHummer ? 0.12 : 0.26;
  registerGlass(windshield);
  const rearWin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.76, 0.74, 0.05), glassMat);
  rearWin.position.set(0, 1.64, bodyLen * 0.49);
  rearWin.rotation.x = -0.18;
  registerGlass(rearWin);
  group.add(windshield, rearWin);

  // Iconic Signature Grille & Lights per Reference Image!
  if (isHummer) {
    // 7-Slot Hummer Grille + Roof Rack + Roof LED Pods
    for (let s = -3; s <= 3; s++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.08), darkMetal);
      slot.position.set(s * 0.18, 0.92, -bodyLen * 0.5 - 0.03);
      group.add(slot);
    }
    const roofRack = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.76, 0.08, 2.2), darkMetal);
    roofRack.position.set(0, 2.15, 0.55);
    group.add(roofRack);
    [-0.55, 0.55].forEach((lx) => {
      const roofPod = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.09), whiteLedMat);
      roofPod.position.set(lx, 2.16, -0.58);
      registerVehicleLight(roofPod, 'headlight');
      group.add(roofPod);
    });
  } else {
    // Signature Wide Luxury Grille + Vertical Light Blades (Escalade / Designer Range)
    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 0.48, 0.08),
      isMarble ? accentMat : darkMetal,
    );
    grille.position.set(0, 0.88, -bodyLen * 0.5 - 0.02);
    group.add(grille);
  }

  [-0.78, 0.78].forEach((lx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(isMarble ? 0.36 : 0.14, isMarble ? 0.12 : 0.42, 0.08), whiteLedMat);
    hl.position.set(lx, 0.92, -bodyLen * 0.5 - 0.03);
    registerVehicleLight(hl, 'headlight');
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.54, 0.07), redTailMat);
    tail.position.set(lx * 1.06, 1.08, bodyLen * 0.5 + 0.02);
    registerVehicleLight(tail, 'taillight');
    group.add(hl, tail);
  });
  attachHeadlightBeam(-bodyLen * 0.5 - 0.06);

  // Full 4-Window Motorized Doors (`FL, FR, RL, RR`) with gullwing hinges on `mansion_escalade_gull`!
  attachLuxuryDoors(bodyMat, 1.78, 0.66, 0.9, 0.16, bodyW * 0.49, 0.56, true);

  const cockpit = attachMansionCockpitWithStartButton(
    id,
    isMarble ? 0xf8fafc : isDragon ? 0x261d12 : 0x16181f,
    isGullEsc ? 0xd1d5db : 0xd99b26,
    1.1,
    0.04,
    -0.7,
    bodyW * 0.86,
    displays,
    darkMetal,
    spec.driverSeatOffset[0],
  );
  if (cockpit.dashEntry) {
    cockpit.dashEntry.title = spec.name;
    cockpit.dashEntry.hpValue = spec.maxHp;
    cockpit.dashEntry.maxHpValue = spec.maxHp;
  }
  group.add(cockpit.interiorGroup);

  const extFx = attachLuxuryCarWireScreensAndSilencers(
    group,
    kind,
    spec,
    displays,
    isMarble ? cyanLedMat : goldLedMat,
    accentMat,
    darkMetal,
    [-0.64, -0.44, 0.44, 0.64],
    bodyLen * 0.5,
    0.42,
    bodyW,
    2.06,
    [0, 1.08, bodyLen * 0.5 + 0.03],
    [1.46, 0.36],
    [bodyW * 0.51, 0.92, 1.48],
    [0.64, 0.22],
  );

  const rad = spec.wheelRadius;
  const wxOff = bodyW * 0.52;
  const wzOff = 1.56;
  (
    [
      [-wxOff, -wzOff],
      [wxOff, -wzOff],
      [-wxOff, wzOff],
      [wxOff, wzOff],
    ] as [number, number][]
  ).forEach(([wx, wz]) => {
    const wMesh = buildLuxuryAlloyWheel(
      rad,
      isHummer ? 0.42 : 0.35,
      tireMat,
      rimMat,
      accentMat,
      isSoftwareGl,
      isMarble ? 12 : 8,
    );
    if (wz < 0) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, rad, wz);
      pivot.add(wMesh);
      group.add(pivot);
      frontWheelSteerPivots.push(pivot);
    } else {
      wMesh.position.set(wx, rad, wz);
      group.add(wMesh);
    }
    registerWheel(wMesh, rad, wx < 0 ? -1 : 1);
  });

  return {
    group,
    wheels,
    frontWheelSteerPivots,
    wheelRadii,
    wheelSides,
    glassPanes,
    windowPanesFL,
    windowPanesFR,
    windowPanesRL,
    windowPanesRR,
    mainRotor: null,
    tailRotor: null,
    turretGroup: null,
    turretMuzzle: null,
    turretFlash: null,
    steerPivot: cockpit.steerPivot,
    doorPivotL,
    doorPivotR,
    doorStyle: spec.doorStyle,
    driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
    dashEntry: cockpit.dashEntry,
    secondLcdEntry: cockpit.secondLcdEntry,
    secondLcdMesh: cockpit.secondLcdMesh,
    dashStartButtonMesh: cockpit.dashStartButtonMesh,
    startBtnMat: cockpit.startBtnMat,
    nightGlowBeams,
    nightLightMats,
    headlightMeshes,
    taillightMeshes,
    exhaustFlameMeshes: extFx.exhaustFlameMeshes,
    exhaustFlameMat: extFx.exhaustFlameMat,
    hitMeshes,
    crashState: createVehicleCrashState({ paintMaterial: bodyMat, deformParts }),
  };
}
