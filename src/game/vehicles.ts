import * as THREE from 'three';
import {
  BIKE_STYLES,
  type BikeStyleId,
  type GraphicsQuality,
  type VehicleCameraMode,
  type VehicleHudState,
  type VehicleInputState,
  type VehicleKind,
} from '../types';
import { resolveVehicleBoxCollider, type ColliderBox } from './arena';
import { disposeObject3DResources } from './models';
import type { VehicleSpawnSpec } from '../types';
import { DigitalDisplayManager, type AnimatedDisplayEntry } from './digitalDisplays';
import {
  forEachColliderInBounds,
  resolveCircleColliders2D,
  type ColliderSpatialGrid,
  type SimColliderBox,
} from './simulatorSystems';
import {
  applyVehicleCrashImpact,
  createDeformablePart,
  createVehicleCrashState,
  DetachedHoodPool,
  resetVehicleCrashState,
  stepVehicleCrashPhysics,
  type CrashImpactSummary,
  type DeformableMeshPart,
  type VehicleCrashState,
} from './vehicleCrashPhysics';
import {
  canShowCarRemote,
  canVehicleMove,
  createDefaultMansionVehicleState,
  getSosPulseState,
  getVehicleSurfaceOffsetY,
  stepMansionVehicleMechanisms,
  type MansionVehicleControlState,
} from './mansionSystems';
import { getExhaustBackfireColorHex } from './swimmingPhysics';
import { soundEngine } from './audio';
import { buildMansionExclusiveVehicleMesh } from './mansionVehicles';

export type VehicleDoorStyle = 'none' | 'swing' | 'gullwing' | 'scissor';

export interface VehicleSpec {
  kind: VehicleKind;
  name: string;
  maxHp: number;
  maxSpeed: number; // m/s
  reverseSpeed: number;
  accel: number;
  turnRate: number;
  seatHeight: number;
  camDist: number;
  camHeight: number;
  isHelicopter: boolean;
  isMansionExclusive?: boolean;
  doorStyle: VehicleDoorStyle;
  driverSeatOffset: [number, number, number];
  bodyW: number;
  bodyL: number;
  wheelRadius: number;
}

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  digital_bike: {
    kind: 'digital_bike',
    name: 'Volt-X Digital Bike',
    maxHp: 380,
    maxSpeed: 23.0,
    reverseSpeed: 9.5,
    accel: 36,
    turnRate: 3.15,
    seatHeight: 1.06,
    camDist: 4.05,
    camHeight: 2.05,
    isHelicopter: false,
    doorStyle: 'none',
    driverSeatOffset: [0, 1.54, 0.2],
    bodyW: 0.78,
    bodyL: 2.15,
    wheelRadius: 0.42,
  },
  electric_scooter: {
    kind: 'electric_scooter',
    name: 'Apex Smart E-Scooter',
    maxHp: 260,
    maxSpeed: 19.5,
    reverseSpeed: 6.5,
    accel: 34,
    turnRate: 3.6,
    seatHeight: 1.05,
    camDist: 3.4,
    camHeight: 1.95,
    isHelicopter: false,
    doorStyle: 'none',
    driverSeatOffset: [0, 1.88, 0.08],
    bodyW: 0.62,
    bodyL: 1.45,
    wheelRadius: 0.22,
  },
  revuelto_red: {
    kind: 'revuelto_red',
    name: 'Apex Revuelto V12',
    maxHp: 760,
    maxSpeed: 39.5,
    reverseSpeed: 15.5,
    accel: 34,
    turnRate: 2.65,
    seatHeight: 1.26,
    camDist: 6.8,
    camHeight: 2.55,
    isHelicopter: false,
    doorStyle: 'scissor',
    driverSeatOffset: [-0.42, 1.24, 0.08],
    bodyW: 2.08,
    bodyL: 4.65,
    wheelRadius: 0.39,
  },
  cyber_pickup: {
    kind: 'cyber_pickup',
    name: 'Stealth Cyber Pickup',
    maxHp: 1080,
    maxSpeed: 29.0,
    reverseSpeed: 13.0,
    accel: 24,
    turnRate: 2.15,
    seatHeight: 1.8,
    camDist: 7.9,
    camHeight: 3.25,
    isHelicopter: false,
    doorStyle: 'swing',
    driverSeatOffset: [-0.46, 1.68, -0.18],
    bodyW: 2.18,
    bodyL: 5.25,
    wheelRadius: 0.49,
  },
  stealth_hyper: {
    kind: 'stealth_hyper',
    name: 'Valkyrie Stealth Hyper',
    maxHp: 820,
    maxSpeed: 41.0,
    reverseSpeed: 16.0,
    accel: 35,
    turnRate: 2.7,
    seatHeight: 1.24,
    camDist: 6.75,
    camHeight: 2.52,
    isHelicopter: false,
    doorStyle: 'scissor',
    driverSeatOffset: [-0.42, 1.24, 0.08],
    bodyW: 2.08,
    bodyL: 4.62,
    wheelRadius: 0.38,
  },
  rolls_copper_gt: {
    kind: 'rolls_copper_gt',
    name: 'Sovereign Copper GT',
    maxHp: 940,
    maxSpeed: 32.5,
    reverseSpeed: 13.5,
    accel: 26,
    turnRate: 2.35,
    seatHeight: 1.48,
    camDist: 7.25,
    camHeight: 2.82,
    isHelicopter: false,
    doorStyle: 'swing',
    driverSeatOffset: [-0.44, 1.38, 0.14],
    bodyW: 2.06,
    bodyL: 4.88,
    wheelRadius: 0.43,
  },
  cyber_gold: {
    kind: 'cyber_gold',
    name: 'Midas Gold Cybertruck',
    maxHp: 1120,
    maxSpeed: 30.5,
    reverseSpeed: 13.5,
    accel: 25,
    turnRate: 2.18,
    seatHeight: 1.8,
    camDist: 7.9,
    camHeight: 3.25,
    isHelicopter: false,
    doorStyle: 'swing',
    driverSeatOffset: [-0.46, 1.68, -0.18],
    bodyW: 2.18,
    bodyL: 5.25,
    wheelRadius: 0.49,
  },
  vision_silver: {
    kind: 'vision_silver',
    name: 'EQ Vision Concept',
    maxHp: 820,
    maxSpeed: 35.5,
    reverseSpeed: 14.5,
    accel: 30,
    turnRate: 2.55,
    seatHeight: 1.46,
    camDist: 7.0,
    camHeight: 2.75,
    isHelicopter: false,
    doorStyle: 'swing',
    driverSeatOffset: [-0.43, 1.38, 0.1],
    bodyW: 2.04,
    bodyL: 4.78,
    wheelRadius: 0.42,
  },
  terzo_silver: {
    kind: 'terzo_silver',
    name: 'Terzo Hyper Concept',
    maxHp: 780,
    maxSpeed: 40.5,
    reverseSpeed: 16.0,
    accel: 36,
    turnRate: 2.72,
    seatHeight: 1.24,
    camDist: 6.75,
    camHeight: 2.52,
    isHelicopter: false,
    doorStyle: 'scissor',
    driverSeatOffset: [-0.41, 1.24, 0.06],
    bodyW: 2.1,
    bodyL: 4.68,
    wheelRadius: 0.4,
  },
  gullwing_coupe: {
    kind: 'gullwing_coupe',
    name: 'Obsidian Gullwing EV',
    maxHp: 850,
    maxSpeed: 34.0,
    reverseSpeed: 14.0,
    accel: 29,
    turnRate: 2.5,
    seatHeight: 1.5,
    camDist: 7.0,
    camHeight: 2.82,
    isHelicopter: false,
    doorStyle: 'gullwing',
    driverSeatOffset: [-0.43, 1.38, 0.02],
    bodyW: 2.04,
    bodyL: 4.55,
    wheelRadius: 0.43,
  },
  range_black_suv: {
    kind: 'range_black_suv',
    name: 'Monarch Black SVR',
    maxHp: 1020,
    maxSpeed: 28.5,
    reverseSpeed: 12.5,
    accel: 23,
    turnRate: 2.25,
    seatHeight: 1.78,
    camDist: 7.75,
    camHeight: 3.35,
    isHelicopter: false,
    doorStyle: 'swing',
    driverSeatOffset: [-0.46, 1.58, -0.05],
    bodyW: 2.12,
    bodyL: 4.78,
    wheelRadius: 0.46,
  },
  thar_black_4x4: {
    kind: 'thar_black_4x4',
    name: 'Thar Trail 4x4',
    maxHp: 960,
    maxSpeed: 25.5,
    reverseSpeed: 12.0,
    accel: 21,
    turnRate: 2.4,
    seatHeight: 1.8,
    camDist: 7.2,
    camHeight: 3.25,
    isHelicopter: false,
    doorStyle: 'swing',
    driverSeatOffset: [-0.42, 1.62, 0.05],
    bodyW: 1.92,
    bodyL: 4.18,
    wheelRadius: 0.46,
  },
  challenger_scissor: {
    kind: 'challenger_scissor',
    name: 'Phantom Scissor GT',
    maxHp: 840,
    maxSpeed: 36.0,
    reverseSpeed: 14.5,
    accel: 31,
    turnRate: 2.58,
    seatHeight: 1.46,
    camDist: 7.0,
    camHeight: 2.75,
    isHelicopter: false,
    doorStyle: 'scissor',
    driverSeatOffset: [-0.44, 1.38, 0.08],
    bodyW: 2.04,
    bodyL: 4.74,
    wheelRadius: 0.41,
  },
  lambo_blue_hyper: {
    kind: 'lambo_blue_hyper',
    name: 'Cobalt Apex Roadster',
    maxHp: 780,
    maxSpeed: 40.0,
    reverseSpeed: 15.8,
    accel: 35,
    turnRate: 2.7,
    seatHeight: 1.26,
    camDist: 6.8,
    camHeight: 2.55,
    isHelicopter: false,
    doorStyle: 'scissor',
    driverSeatOffset: [-0.42, 1.24, 0.08],
    bodyW: 2.08,
    bodyL: 4.65,
    wheelRadius: 0.39,
  },
  mansion_hyper_scissor: {
    kind: 'mansion_hyper_scissor',
    name: 'Obsidian Monarch Scissor Hypercar',
    maxHp: 960,
    maxSpeed: 44.0,
    reverseSpeed: 16.5,
    accel: 38,
    turnRate: 2.75,
    seatHeight: 1.26,
    camDist: 6.9,
    camHeight: 2.55,
    isHelicopter: false,
    isMansionExclusive: true,
    doorStyle: 'scissor',
    driverSeatOffset: [-0.42, 1.24, 0.14],
    bodyW: 2.1,
    bodyL: 4.72,
    wheelRadius: 0.4,
  },
  mansion_escalade_gull: {
    kind: 'mansion_escalade_gull',
    name: 'Escalade Gullwing Bespoke Edition',
    maxHp: 1200,
    maxSpeed: 33.5,
    reverseSpeed: 14.0,
    accel: 28,
    turnRate: 2.32,
    seatHeight: 1.82,
    camDist: 7.9,
    camHeight: 3.35,
    isHelicopter: false,
    isMansionExclusive: true,
    doorStyle: 'gullwing',
    driverSeatOffset: [-0.46, 1.62, 0.04],
    bodyW: 2.12,
    bodyL: 5.08,
    wheelRadius: 0.48,
  },
  mansion_hummer_gold: {
    kind: 'mansion_hummer_gold',
    name: 'Apex Armored Gold Exoskeleton Hummer',
    maxHp: 1450,
    maxSpeed: 31.0,
    reverseSpeed: 13.5,
    accel: 26,
    turnRate: 2.2,
    seatHeight: 1.86,
    camDist: 8.1,
    camHeight: 3.4,
    isHelicopter: false,
    isMansionExclusive: true,
    doorStyle: 'swing',
    driverSeatOffset: [-0.48, 1.64, 0.04],
    bodyW: 2.22,
    bodyL: 4.92,
    wheelRadius: 0.5,
  },
  mansion_escalade_dragon: {
    kind: 'mansion_escalade_dragon',
    name: 'Imperial Dragon Gold Escalade',
    maxHp: 1180,
    maxSpeed: 34.0,
    reverseSpeed: 14.2,
    accel: 28,
    turnRate: 2.35,
    seatHeight: 1.82,
    camDist: 7.9,
    camHeight: 3.35,
    isHelicopter: false,
    isMansionExclusive: true,
    doorStyle: 'swing',
    driverSeatOffset: [-0.46, 1.62, 0.04],
    bodyW: 2.12,
    bodyL: 5.08,
    wheelRadius: 0.48,
  },
  mansion_range_marble: {
    kind: 'mansion_range_marble',
    name: 'Carrara Marble & Gold Designer SUV',
    maxHp: 1160,
    maxSpeed: 34.5,
    reverseSpeed: 14.2,
    accel: 29,
    turnRate: 2.4,
    seatHeight: 1.8,
    camDist: 7.8,
    camHeight: 3.3,
    isHelicopter: false,
    isMansionExclusive: true,
    doorStyle: 'swing',
    driverSeatOffset: [-0.46, 1.6, 0.04],
    bodyW: 2.1,
    bodyL: 4.98,
    wheelRadius: 0.47,
  },
  mansion_ev_gt: {
    kind: 'mansion_ev_gt',
    name: 'Apex Zero-Emission EV Hyper GT',
    maxHp: 940,
    maxSpeed: 43.0,
    reverseSpeed: 16.2,
    accel: 39,
    turnRate: 2.75,
    seatHeight: 1.26,
    camDist: 6.85,
    camHeight: 2.55,
    isHelicopter: false,
    isMansionExclusive: true,
    doorStyle: 'scissor',
    driverSeatOffset: [-0.42, 1.24, 0.14],
    bodyW: 2.08,
    bodyL: 4.7,
    wheelRadius: 0.4,
  },
  apex_heli: {
    kind: 'apex_heli',
    name: 'Apex Phantom Stealth Helicopter',
    maxHp: 1350,
    maxSpeed: 42.0,
    reverseSpeed: 16.0,
    accel: 24,
    turnRate: 2.15,
    seatHeight: 1.55,
    camDist: 10.5,
    camHeight: 3.8,
    isHelicopter: true,
    isMansionExclusive: false,
    doorStyle: 'swing',
    driverSeatOffset: [0, 1.48, -1.0],
    bodyW: 3.0,
    bodyL: 7.4,
    wheelRadius: 0.45,
  },
  future_sports_car: {
    kind: 'future_sports_car',
    name: 'Future Silver Aero Sports Car',
    maxHp: 880,
    maxSpeed: 42.5,
    reverseSpeed: 16.5,
    accel: 37,
    turnRate: 2.75,
    seatHeight: 1.24,
    camDist: 6.75,
    camHeight: 2.5,
    isHelicopter: false,
    doorStyle: 'scissor',
    driverSeatOffset: [-0.41, 1.24, 0.08],
    bodyW: 2.08,
    bodyL: 4.66,
    wheelRadius: 0.39,
  },
  future_super_car: {
    kind: 'future_super_car',
    name: 'Super Future Crimson Hypercar',
    maxHp: 900,
    maxSpeed: 45.0,
    reverseSpeed: 17.5,
    accel: 40,
    turnRate: 2.82,
    seatHeight: 1.22,
    camDist: 6.8,
    camHeight: 2.48,
    isHelicopter: false,
    doorStyle: 'scissor',
    driverSeatOffset: [-0.41, 1.22, 0.08],
    bodyW: 2.1,
    bodyL: 4.72,
    wheelRadius: 0.39,
  },
  future_suv: {
    kind: 'future_suv',
    name: 'Future Tactical White SUV',
    maxHp: 1180,
    maxSpeed: 31.5,
    reverseSpeed: 13.8,
    accel: 26,
    turnRate: 2.32,
    seatHeight: 1.78,
    camDist: 7.75,
    camHeight: 3.3,
    isHelicopter: false,
    doorStyle: 'swing',
    driverSeatOffset: [-0.46, 1.58, -0.02],
    bodyW: 2.14,
    bodyL: 4.86,
    wheelRadius: 0.47,
  },
  future_bike: {
    kind: 'future_bike',
    name: 'Future Neon-Halo Superbike',
    maxHp: 440,
    maxSpeed: 29.0,
    reverseSpeed: 10.5,
    accel: 40,
    turnRate: 3.3,
    seatHeight: 1.06,
    camDist: 4.1,
    camHeight: 2.05,
    isHelicopter: false,
    doorStyle: 'none',
    driverSeatOffset: [0, 1.54, 0.2],
    bodyW: 0.8,
    bodyL: 2.18,
    wheelRadius: 0.42,
  },
  future_heli: {
    kind: 'future_heli',
    name: 'Future Aero White Helicopter',
    maxHp: 1420,
    maxSpeed: 46.0,
    reverseSpeed: 18.0,
    accel: 26,
    turnRate: 2.25,
    seatHeight: 1.52,
    camDist: 10.2,
    camHeight: 3.7,
    isHelicopter: true,
    doorStyle: 'swing',
    driverSeatOffset: [0, 1.44, -1.05],
    bodyW: 2.9,
    bodyL: 7.1,
    wheelRadius: 0.45,
  },
  future_flying_car: {
    kind: 'future_flying_car',
    name: 'Future Thruster Flying Car',
    maxHp: 960,
    maxSpeed: 48.0,
    reverseSpeed: 18.0,
    accel: 34,
    turnRate: 2.55,
    seatHeight: 1.38,
    camDist: 7.4,
    camHeight: 2.8,
    isHelicopter: true,
    doorStyle: 'gullwing',
    driverSeatOffset: [-0.41, 1.38, 0.06],
    bodyW: 2.14,
    bodyL: 4.74,
    wheelRadius: 0.39,
  },
  future_drone: {
    kind: 'future_drone',
    name: 'Future Quad-Tilt Passenger Drone',
    maxHp: 1120,
    maxSpeed: 44.0,
    reverseSpeed: 18.0,
    accel: 28,
    turnRate: 2.4,
    seatHeight: 1.48,
    camDist: 8.6,
    camHeight: 3.25,
    isHelicopter: true,
    doorStyle: 'gullwing',
    driverSeatOffset: [0, 1.48, -0.35],
    bodyW: 4.2,
    bodyL: 4.8,
    wheelRadius: 0.35,
  },
  future_tank: {
    kind: 'future_tank',
    name: 'Future Railgun Stealth Tank',
    maxHp: 2200,
    maxSpeed: 24.5,
    reverseSpeed: 11.5,
    accel: 20,
    turnRate: 1.9,
    seatHeight: 1.65,
    camDist: 8.8,
    camHeight: 3.55,
    isHelicopter: false,
    doorStyle: 'swing',
    driverSeatOffset: [0, 1.62, -0.05],
    bodyW: 3.1,
    bodyL: 5.8,
    wheelRadius: 0.44,
  },
  koutone_hover: {
    kind: 'koutone_hover',
    name: 'Koutone Ice-Blue Hover Coupe',
    maxHp: 980,
    maxSpeed: 43.0,
    reverseSpeed: 16.5,
    accel: 36,
    turnRate: 2.68,
    seatHeight: 1.34,
    camDist: 6.85,
    camHeight: 2.62,
    isHelicopter: false,
    doorStyle: 'gullwing',
    driverSeatOffset: [-0.38, 1.34, 0.06],
    bodyW: 2.04,
    bodyL: 4.78,
    wheelRadius: 0.38,
  },
};

export interface VehicleGlassPane {
  mesh: THREE.Mesh;
  state: 'intact' | 'cracked' | 'shattered';
  baseOpacity: number;
  baseColor: number;
  baseMaterial: THREE.Material;
}

export interface VehicleActor {
  id: string;
  kind: VehicleKind;
  spec: VehicleSpec;
  group: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheelSteerPivots?: THREE.Group[];
  wheelRadii: number[];
  wheelSides: number[];
  puncturedWheels: boolean[];
  glassPanes: VehicleGlassPane[];
  wobblePhase: number;
  mainRotor: THREE.Object3D | null;
  tailRotor: THREE.Object3D | null;
  auxRotors?: THREE.Object3D[];
  hoverThrusters?: THREE.Mesh[];
  turretGroup: THREE.Object3D | null;
  turretMuzzle: THREE.Object3D | null;
  turretFlash: THREE.Mesh | null;
  leanGroup?: THREE.Group | null;
  steerPivot?: THREE.Group | null;
  doorPivotL?: THREE.Group | null;
  doorPivotR?: THREE.Group | null;
  doorStyle: VehicleDoorStyle;
  doorTimerL: number;
  doorOpenL?: number;
  driverSeatOffset: THREE.Vector3;
  bikeSteer?: number;
  bikeLean?: number;
  dashEntry?: AnimatedDisplayEntry | null;
  secondLcdEntry?: AnimatedDisplayEntry | null;
  secondLcdMesh?: THREE.Mesh | null;
  dashStartButtonMesh?: THREE.Mesh | null;
  startBtnMat?: THREE.MeshStandardMaterial | null;
  windowPanesFL?: THREE.Mesh[];
  windowPanesFR?: THREE.Mesh[];
  windowPanesRL?: THREE.Mesh[];
  windowPanesRR?: THREE.Mesh[];
  mansionState: MansionVehicleControlState;
  nightGlowBeams?: THREE.Mesh[];
  nightLightMats?: THREE.MeshBasicMaterial[];
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  exhaustFlameMeshes?: THREE.Mesh[];
  exhaustFlameMat?: THREE.MeshBasicMaterial | null;
  backfireTimer?: number;
  backfireCooldown?: number;
  headlightsBroken: boolean;
  bulletHoleDecals: THREE.Mesh[];
  hitMeshes: THREE.Mesh[];
  crashState: VehicleCrashState;
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  vertVel: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  driverId: string | null;
  smokeTimer: number;
}

export interface VehicleDriveStepResult {
  collided: boolean;
  impactSpeedMs: number;
  impactPoint: THREE.Vector3;
  impactNormal: THREE.Vector3;
  crashSummary: CrashImpactSummary | null;
}

// Pre-allocated scratch vectors for VehicleManager (zero-GC collision & physics path)
const _scratchImpactPt = new THREE.Vector3();
const _scratchImpactDir = new THREE.Vector3();
const _scratchVelWorld = new THREE.Vector3();
const _scratchStepResult: VehicleDriveStepResult = {
  collided: false,
  impactSpeedMs: 0,
  impactPoint: new THREE.Vector3(),
  impactNormal: new THREE.Vector3(),
  crashSummary: null,
};

let sharedCrackedGlassTex: THREE.CanvasTexture | null = null;
export function getSharedCrackedGlassTexture(): THREE.CanvasTexture {
  if (sharedCrackedGlassTex) return sharedCrackedGlassTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(130, 178, 210, 0.34)';
    ctx.fillRect(0, 0, 256, 256);

    const drawWeb = (cx: number, cy: number, rays: number, scale: number) => {
      ctx.strokeStyle = 'rgba(240, 249, 255, 0.94)';
      ctx.lineWidth = 2.0;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + (i % 2) * 0.14;
        const len = (54 + ((i * 23) % 45)) * scale;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        const mx = cx + Math.cos(a + 0.08) * len * 0.52;
        const my = cy + Math.sin(a + 0.08) * len * 0.52;
        ctx.lineTo(mx, my);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.lineWidth = 1.3;
      [14, 28, 46, 66].forEach((r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
        ctx.stroke();
      });
    };
    drawWeb(92, 118, 13, 1.0);
    drawWeb(178, 146, 10, 0.72);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedCrackedGlassTex = tex;
  return tex;
}

let sharedBrokenLightMat: THREE.MeshStandardMaterial | null = null;
function getSharedBrokenLightMaterial(): THREE.MeshStandardMaterial {
  if (sharedBrokenLightMat) return sharedBrokenLightMat;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(64, 64);
      ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(64, 64, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(64, 64, 38, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedBrokenLightMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    map: tex,
    roughness: 0.72,
    metalness: 0.25,
  });
  return sharedBrokenLightMat;
}

let sharedBulletHoleMat: THREE.MeshBasicMaterial | null = null;
let sharedBulletHoleGeo: THREE.PlaneGeometry | null = null;
function getSharedBulletHoleAssets(): { geo: THREE.PlaneGeometry; mat: THREE.MeshBasicMaterial } {
  if (sharedBulletHoleGeo && sharedBulletHoleMat) {
    return { geo: sharedBulletHoleGeo, mat: sharedBulletHoleMat };
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    const scorch = ctx.createRadialGradient(32, 32, 4, 32, 32, 28);
    scorch.addColorStop(0, 'rgba(10, 10, 12, 0.96)');
    scorch.addColorStop(0.42, 'rgba(30, 34, 42, 0.75)');
    scorch.addColorStop(0.68, 'rgba(203, 213, 225, 0.55)');
    scorch.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = scorch;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();

    // Bright torn metal rim shards
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      ctx.beginPath();
      ctx.moveTo(32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9);
      ctx.lineTo(32 + Math.cos(a) * 16, 32 + Math.sin(a) * 16);
      ctx.stroke();
    }

    ctx.fillStyle = '#020408';
    ctx.beginPath();
    ctx.arc(32, 32, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedBulletHoleGeo = new THREE.PlaneGeometry(0.115, 0.115);
  sharedBulletHoleMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side: THREE.DoubleSide,
  });
  return { geo: sharedBulletHoleGeo, mat: sharedBulletHoleMat };
}

function getBikePalette(styleId: BikeStyleId = 'volt_green') {
  const found = BIKE_STYLES.find((b) => b.id === styleId) ?? BIKE_STYLES[0];
  return {
    whiteArmor: found.bodyHex,
    silverArmor: found.secondaryHex,
    neonOrange: found.trimHex,
    neonGreen: found.neonHex,
  };
}

function buildRealisticSuperbikeWheel(
  radius: number,
  width: number,
  isSoftwareGl: boolean,
  bikeStyle: BikeStyleId = 'volt_green',
): { wheelGroup: THREE.Mesh; partCount: number } {
  const pal = getBikePalette(bikeStyle);
  const segs = isSoftwareGl ? 18 : 26;
  const pivot = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 6, 6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );

  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x161922, roughness: 0.85, metalness: 0.08 });
  const rimMat = new THREE.MeshStandardMaterial({ color: pal.neonOrange, roughness: 0.24, metalness: 0.72 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x262c3a, roughness: 0.35, metalness: 0.8 });
  const glowMat = new THREE.MeshBasicMaterial({ color: pal.neonGreen, toneMapped: false });

  // Sculpted wide sportbike tire (torus outer edge = radius sits flush at y = 0)
  const tubeR = radius * 0.24;
  const tireGeo = new THREE.TorusGeometry(radius - tubeR, tubeR, 12, segs);
  tireGeo.rotateY(Math.PI / 2);
  tireGeo.scale(width / (tubeR * 2.05), 1, 1);
  const tire = new THREE.Mesh(tireGeo, rubberMat);
  tire.castShadow = !isSoftwareGl;
  tire.receiveShadow = true;
  pivot.add(tire);

  // Machined anodized rim barrel
  const rimGeo = new THREE.TorusGeometry(radius * 0.65, 0.042, 10, segs);
  rimGeo.rotateY(Math.PI / 2);
  rimGeo.scale(width * 0.75 / 0.1, 1, 1);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  pivot.add(rim);

  // Inner turbine alloy spokes (5 swept blades)
  const spokeGeo = new THREE.CylinderGeometry(0.022, 0.032, radius * 1.24, 6);
  for (let s = 0; s < 5; s++) {
    const spoke = new THREE.Mesh(spokeGeo, s % 2 === 0 ? rimMat : metalMat);
    spoke.rotation.x = (s / 5) * Math.PI;
    pivot.add(spoke);
  }

  // Twin glow rings + disc brake rotor & axle
  const rotorGeo = new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, 0.028, 18);
  rotorGeo.rotateZ(Math.PI / 2);
  const rotor = new THREE.Mesh(rotorGeo, metalMat);
  rotor.position.x = width * 0.28;
  pivot.add(rotor);

  const glowRingGeo = new THREE.TorusGeometry(radius * 0.25, 0.018, 8, 20);
  glowRingGeo.rotateY(Math.PI / 2);
  [-width * 0.24, width * 0.24].forEach((gx) => {
    const gr = new THREE.Mesh(glowRingGeo, glowMat);
    gr.position.x = gx;
    pivot.add(gr);
  });

  const axleGeo = new THREE.CylinderGeometry(0.06, 0.06, width * 0.96, 12);
  axleGeo.rotateZ(Math.PI / 2);
  pivot.add(new THREE.Mesh(axleGeo, metalMat));

  return { wheelGroup: pivot, partCount: 10 };
}

/**
 * Constructs a sleek, sculpted, non-blocky PBR futuristic superbike ("Volt-X Hyperbike")
 * with smooth ExtrudeGeometry cowling, USD forks, turbine wheels, and working digital dash.
 */
export function buildDigitalBikeMesh(
  id: string,
  isSoftwareGl: boolean,
  displays?: DigitalDisplayManager | null,
  bikeStyle: BikeStyleId = 'volt_green',
  isFutureHoloBike = false,
): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  wheelRadii: number[];
  wheelSides: number[];
  glassPanes: VehicleGlassPane[];
  leanGroup: THREE.Group;
  steerPivot: THREE.Group;
  dashEntry: AnimatedDisplayEntry | null;
  hitMeshes: THREE.Mesh[];
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  partCount: number;
} {
  const group = new THREE.Group();
  const leanGroup = new THREE.Group();
  group.add(leanGroup);

  const steerPivot = new THREE.Group();
  steerPivot.position.set(0, 0.72, -0.78);
  leanGroup.add(steerPivot);

  const hitMeshes: THREE.Mesh[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  const wheels: THREE.Mesh[] = [];
  let partCount = 0;

  const tagHit = (obj: THREE.Object3D) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.visible) {
        child.userData.vehicleId = id;
        hitMeshes.push(child);
      }
    });
  };

  const pal = isFutureHoloBike
    ? { whiteArmor: 0xf8fafc, silverArmor: 0xcbd5e1, neonOrange: 0x0ea5e9, neonGreen: 0x22d3ee }
    : getBikePalette(bikeStyle);
  const bodyMat = new THREE.MeshStandardMaterial({ color: pal.whiteArmor, roughness: 0.18, metalness: 0.48 });
  const secondaryMat = new THREE.MeshStandardMaterial({ color: pal.silverArmor, roughness: 0.3, metalness: 0.56 });
  const trimMat = new THREE.MeshStandardMaterial({ color: pal.neonOrange, roughness: 0.22, metalness: 0.62 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.55, metalness: 0.65 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.48, metalness: 0.22 });
  const neonMat = new THREE.MeshBasicMaterial({ color: pal.neonGreen, toneMapped: false });
  const headlightMat = new THREE.MeshBasicMaterial({ color: isFutureHoloBike ? 0x67e8f9 : 0xe0f2fe, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: isFutureHoloBike ? 0x22d3ee : 0xef4444, toneMapped: false });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.08,
    metalness: 0.35,
    transparent: true,
    opacity: 0.72,
  });

  // 1. Front & Rear Realistic Sportbike Wheels
  const wheelRadii = [0.41, 0.43];
  const wheelSides = [0, 0];
  const frontW = buildRealisticSuperbikeWheel(0.41, 0.26, isSoftwareGl, bikeStyle);
  frontW.wheelGroup.position.set(0, 0.41 - 0.72, -0.22);
  if (isFutureHoloBike) {
    const outerHaloGeo = new THREE.TorusGeometry(0.36, 0.022, 8, 26);
    outerHaloGeo.rotateY(Math.PI / 2);
    [-0.125, 0.125].forEach((hx) => {
      const hRing = new THREE.Mesh(outerHaloGeo, neonMat);
      hRing.position.x = hx;
      frontW.wheelGroup.add(hRing);
    });
  }
  frontW.wheelGroup.traverse((ch) => {
    if (ch instanceof THREE.Mesh && ch.visible) {
      ch.userData.vehicleId = id;
      ch.userData.vehiclePart = 'wheel';
      ch.userData.wheelIdx = 0;
      hitMeshes.push(ch);
    }
  });
  steerPivot.add(frontW.wheelGroup);
  wheels.push(frontW.wheelGroup);
  partCount += frontW.partCount;

  const rearW = buildRealisticSuperbikeWheel(0.43, 0.34, isSoftwareGl, bikeStyle);
  rearW.wheelGroup.position.set(0, 0.43, 0.96);
  if (isFutureHoloBike) {
    const rearHaloGeo = new THREE.TorusGeometry(0.38, 0.024, 8, 26);
    rearHaloGeo.rotateY(Math.PI / 2);
    [-0.165, 0.165].forEach((hx) => {
      const hRing = new THREE.Mesh(rearHaloGeo, neonMat);
      hRing.position.x = hx;
      rearW.wheelGroup.add(hRing);
    });
  }
  rearW.wheelGroup.traverse((ch) => {
    if (ch instanceof THREE.Mesh && ch.visible) {
      ch.userData.vehicleId = id;
      ch.userData.vehiclePart = 'wheel';
      ch.userData.wheelIdx = 1;
      hitMeshes.push(ch);
    }
  });
  leanGroup.add(rearW.wheelGroup);
  wheels.push(rearW.wheelGroup);
  partCount += rearW.partCount;

  // 2. Steerable Inverted USD Front Forks, Nose Fairing, Windscreen & Handlebars
  const forkTubeGeo = new THREE.CylinderGeometry(0.036, 0.032, 0.78, 10);
  const shroudGeo = new THREE.CylinderGeometry(0.052, 0.044, 0.44, 10);
  [-0.17, 0.17].forEach((fx) => {
    const leg = new THREE.Mesh(forkTubeGeo, trimMat);
    leg.position.set(fx, -0.02, -0.1);
    leg.rotation.x = 0.34;
    leg.castShadow = !isSoftwareGl;
    steerPivot.add(leg);

    const shroud = new THREE.Mesh(shroudGeo, bodyMat);
    shroud.position.set(fx, 0.1, -0.04);
    shroud.rotation.x = 0.34;
    steerPivot.add(shroud);

    const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), neonMat);
    strip.position.set(fx * 0.85, 0.06, -0.02);
    strip.rotation.x = 0.34;
    steerPivot.add(strip);
    partCount += 3;
  });

  // Aerodynamic nose fairing via ExtrudeGeometry profile
  const noseShape = new THREE.Shape();
  noseShape.moveTo(-0.34, 0.02);
  noseShape.quadraticCurveTo(-0.22, 0.24, 0.08, 0.28);
  noseShape.lineTo(0.24, 0.14);
  noseShape.quadraticCurveTo(0.05, 0.0, -0.34, 0.02);
  const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  noseGeo.center();
  noseGeo.rotateY(Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeo, bodyMat);
  noseMesh.position.set(0, 0.16, -0.18);
  noseMesh.castShadow = !isSoftwareGl;
  steerPivot.add(noseMesh);

  // Tinted aero windscreen & twin LED headlights
  const screenGeo = new THREE.CylinderGeometry(0.18, 0.21, 0.34, 12, 1, true, -Math.PI * 0.35, Math.PI * 0.7);
  const windscreen = new THREE.Mesh(screenGeo, glassMat);
  windscreen.position.set(0, 0.32, -0.11);
  windscreen.rotation.set(-0.62, Math.PI, 0);
  windscreen.userData.vehicleId = id;
  windscreen.userData.vehiclePart = 'glass';
  windscreen.userData.glassIdx = 0;
  steerPivot.add(windscreen);
  const glassPanes: VehicleGlassPane[] = [
    { mesh: windscreen, state: 'intact', baseOpacity: 0.72, baseColor: 0x38bdf8, baseMaterial: glassMat },
  ];

  [-0.1, 0.1].forEach((hx) => {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), headlightMat);
    hl.scale.set(1.2, 0.65, 1.4);
    hl.position.set(hx, 0.12, -0.36);
    hl.userData.vehiclePart = 'headlight';
    hl.userData.origMaterial = headlightMat;
    hl.userData.lightBroken = false;
    headlightMeshes.push(hl);
    steerPivot.add(hl);
  });

  // Clip-on handlebars + grips
  const barGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.76, 10);
  barGeo.rotateZ(Math.PI / 2);
  const bar = new THREE.Mesh(barGeo, frameMat);
  bar.position.set(0, 0.32, 0.1);
  steerPivot.add(bar);
  [-0.34, 0.34].forEach((gx) => {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.14, 10), trimMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(gx, 0.32, 0.1);
    steerPivot.add(grip);
  });
  tagHit(steerPivot);
  partCount += 6;

  // Working Digital Cockpit Speedometer Dashboard mounted right above triple clamp
  if (displays) {
    const { material: dashMat, entry: dashEntry } = displays.createDisplayMaterial('bike_dash', {
      intervalSec: 0.08,
    });
    const dashHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.04, 12), carbonMat);
    dashHousing.scale.set(1.3, 1, 0.78);
    dashHousing.position.set(0, 0.36, 0.04);
    dashHousing.rotation.x = Math.PI * 0.5 - 0.58;
    const dashScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), dashMat);
    dashScreen.position.set(0, 0.022, 0);
    dashScreen.rotation.x = -Math.PI * 0.5;
    dashHousing.add(dashScreen);
    steerPivot.add(dashHousing);
    steerPivot.userData.dashEntry = dashEntry;
  }

  // 3. Sculpted Chassis, Aerodynamic Fuel Tank, Reactor Core, Seat & Tail Section
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.72, 0.38);
  bodyShape.quadraticCurveTo(-0.42, 0.96, -0.02, 1.06);
  bodyShape.quadraticCurveTo(0.28, 0.92, 0.56, 0.86);
  bodyShape.lineTo(1.06, 1.04);
  bodyShape.lineTo(1.12, 0.92);
  bodyShape.lineTo(0.62, 0.64);
  bodyShape.lineTo(0.22, 0.32);
  bodyShape.lineTo(-0.48, 0.32);
  bodyShape.closePath();

  const tankGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 3,
  });
  tankGeo.translate(0, 0, -0.18);
  tankGeo.rotateY(Math.PI / 2);
  const mainBody = new THREE.Mesh(tankGeo, bodyMat);
  mainBody.castShadow = !isSoftwareGl;
  mainBody.receiveShadow = true;
  leanGroup.add(mainBody);

  // Lower engine cradle & reactor core
  const cradleGeo = new THREE.CylinderGeometry(0.24, 0.2, 1.12, 12);
  cradleGeo.rotateX(Math.PI / 2);
  cradleGeo.scale(0.95, 1.15, 1);
  const cradle = new THREE.Mesh(cradleGeo, frameMat);
  cradle.position.set(0, 0.52, 0.05);
  leanGroup.add(cradle);

  // Glowing reactor vein tubes + diagonal frame struts on both flanks
  [-0.22, 0.22].forEach((sx) => {
    const reactorPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 10), neonMat);
    reactorPipe.rotation.x = Math.PI / 2 - 0.14;
    reactorPipe.position.set(sx, 0.54, -0.04);
    leanGroup.add(reactorPipe);

    const frameStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.76, 8), trimMat);
    frameStrut.rotation.x = 0.78;
    frameStrut.position.set(sx * 1.08, 0.64, 0.12);
    leanGroup.add(frameStrut);

    const winglet = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.14, 0.44, 6), secondaryMat);
    winglet.rotation.set(0.32, 0, sx > 0 ? -0.35 : 0.35);
    winglet.position.set(sx * 1.18, 0.78, -0.26);
    leanGroup.add(winglet);

    // Rear swingarm + coil shock
    const swing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.048, 0.74, 8), secondaryMat);
    swing.rotation.x = Math.PI / 2 + 0.08;
    swing.position.set(sx * 0.92, 0.44, 0.62);
    leanGroup.add(swing);
    partCount += 4;
  });

  // Sculpted ergonomic rider saddle
  const saddleGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.56, 12);
  saddleGeo.rotateX(Math.PI / 2);
  saddleGeo.scale(1.15, 0.48, 1);
  const saddle = new THREE.Mesh(saddleGeo, carbonMat);
  saddle.position.set(0, 0.9, 0.34);
  saddle.rotation.x = -0.14;
  leanGroup.add(saddle);

  // Tail LED light bar & exhaust under-silencer
  const tailLed = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), tailMat);
  tailLed.rotation.z = Math.PI / 2;
  tailLed.position.set(0, 1.0, 1.12);
  tailLed.userData.vehiclePart = 'taillight';
  tailLed.userData.origMaterial = tailMat;
  tailLed.userData.lightBroken = false;
  taillightMeshes.push(tailLed);
  leanGroup.add(tailLed);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.54, 10), secondaryMat);
  exhaust.rotation.x = Math.PI / 2 - 0.18;
  exhaust.position.set(0.22, 0.34, 0.52);
  leanGroup.add(exhaust);

  tagHit(leanGroup);
  partCount += 6;

  return {
    group,
    wheels,
    wheelRadii,
    wheelSides,
    glassPanes,
    leanGroup,
    steerPivot,
    dashEntry: (steerPivot.userData.dashEntry as AnimatedDisplayEntry | undefined) ?? null,
    hitMeshes,
    headlightMeshes,
    taillightMeshes,
    partCount,
  };
}

/**
 * Sleek Urban Smart Electric Scooter (charcoal chassis, bronze side rails, spoked disc-brake wheels,
 * curved front stem + external battery pack + digital speedo screen + bright round LED headlight).
 */
export function buildElectricScooterMesh(
  id: string,
  isSoftwareGl: boolean,
  displays?: DigitalDisplayManager | null,
): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  wheelRadii: number[];
  wheelSides: number[];
  glassPanes: VehicleGlassPane[];
  leanGroup: THREE.Group;
  steerPivot: THREE.Group;
  dashEntry: AnimatedDisplayEntry | null;
  hitMeshes: THREE.Mesh[];
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
} {
  const group = new THREE.Group();
  const leanGroup = new THREE.Group();
  group.add(leanGroup);

  const steerPivot = new THREE.Group();
  steerPivot.position.set(0, 0.42, -0.52);
  leanGroup.add(steerPivot);

  const hitMeshes: THREE.Mesh[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  const wheels: THREE.Mesh[] = [];

  const tagMesh = (m: THREE.Mesh) => {
    m.userData.vehicleId = id;
    m.castShadow = !isSoftwareGl;
    m.receiveShadow = true;
    hitMeshes.push(m);
  };

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e242c, roughness: 0.44, metalness: 0.58 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.08 });
  const bronzeRailMat = new THREE.MeshStandardMaterial({ color: 0xb68652, roughness: 0.28, metalness: 0.72 });
  const silverDiscMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.84 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444, toneMapped: false });

  const makeScooterWheel = (wx: number, wy: number, wz: number, wheelIdx: number): THREE.Mesh => {
    const tireGeo = new THREE.TorusGeometry(0.17, 0.052, 10, 22);
    tireGeo.rotateY(Math.PI * 0.5);
    const wMesh = new THREE.Mesh(tireGeo, rubberMat);
    wMesh.position.set(wx, wy, wz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.085, 12), frameMat);
    hub.rotation.z = Math.PI * 0.5;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.015, 16), silverDiscMat);
    disc.rotation.z = Math.PI * 0.5;
    disc.position.x = -0.05;
    wMesh.add(hub, disc);
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.26, 0.024), frameMat);
      spoke.rotation.x = (s / 5) * Math.PI;
      wMesh.add(spoke);
    }
    wMesh.traverse((ch) => {
      if (ch instanceof THREE.Mesh) {
        ch.userData.vehicleId = id;
        ch.userData.vehiclePart = 'wheel';
        ch.userData.wheelIdx = wheelIdx;
        hitMeshes.push(ch);
      }
    });
    return wMesh;
  };

  // Front & Rear 10-inch Tubeless Wheels (radius = 0.22)
  const frontWheel = makeScooterWheel(0, 0.22 - 0.42, 0, 0);
  steerPivot.add(frontWheel);
  wheels.push(frontWheel);

  const rearWheel = makeScooterWheel(0, 0.22, 0.52, 1);
  leanGroup.add(rearWheel);
  wheels.push(rearWheel);

  // Sculpted Charcoal Deck Base + Anti-Slip Footpad + Curved Bronze Twin Side Rails
  const deckBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.78), frameMat);
  deckBase.position.set(0, 0.22, 0.03);
  tagMesh(deckBase);
  const deckGrip = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.022, 0.68), rubberMat);
  deckGrip.position.set(0, 0.268, 0.04);
  leanGroup.add(deckBase, deckGrip);

  [-0.125, 0.125].forEach((rx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.042, 0.76), bronzeRailMat);
    rail.position.set(rx, 0.23, 0.03);
    const forkArm = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.045, 0.34), frameMat);
    forkArm.position.set(rx * 0.72, 0.22, 0.42);
    leanGroup.add(rail, forkArm);
  });

  // Angled Neck Bridge joining Deck to Headtube
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.34), frameMat);
  neck.position.set(0, 0.34, -0.39);
  neck.rotation.x = -0.68;
  tagMesh(neck);
  leanGroup.add(neck);

  // Rear Mudguard Fender + Bright Red LED Taillight + Kickstand
  const rearFender = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.32), frameMat);
  rearFender.position.set(0, 0.43, 0.54);
  rearFender.rotation.x = 0.28;
  const tailLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.035), tailMat);
  tailLed.position.set(0, 0.41, 0.69);
  tailLed.userData.vehiclePart = 'taillight';
  tailLed.userData.origMaterial = tailMat;
  taillightMeshes.push(tailLed);
  leanGroup.add(rearFender, tailLed);

  // Steerable Front Fork + Slanted Aluminum Stem + External Battery Pack + Handlebars
  [-0.075, 0.075].forEach((fx) => {
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.34, 8), frameMat);
    fork.position.set(fx, -0.1, 0);
    steerPivot.add(fork);
  });
  const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.22), frameMat);
  frontFender.position.set(0, 0.02, 0.03);
  frontFender.rotation.x = 0.24;
  steerPivot.add(frontFender);

  const stemGroup = new THREE.Group();
  stemGroup.rotation.x = -0.22; // sleek swept-back stem geometry
  steerPivot.add(stemGroup);

  const stemPole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.88, 12), frameMat);
  stemPole.position.set(0, 0.42, 0);
  tagMesh(stemPole);
  const batteryPod = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.44, 12), bronzeRailMat);
  batteryPod.position.set(0, 0.34, 0.055);
  tagMesh(batteryPod);
  stemGroup.add(stemPole, batteryPod);

  // Bright Round LED Headlight in Bezel + Handlebars + Grips
  const hlHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.042, 0.075, 12), frameMat);
  hlHousing.rotation.x = Math.PI * 0.5;
  hlHousing.position.set(0, 0.74, -0.048);
  const hlLens = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.014, 12), headlightMat);
  hlLens.rotation.x = Math.PI * 0.5;
  hlLens.position.set(0, 0.74, -0.088);
  hlLens.userData.vehiclePart = 'headlight';
  hlLens.userData.origMaterial = headlightMat;
  headlightMeshes.push(hlLens);
  stemGroup.add(hlHousing, hlLens);

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.54, 10), frameMat);
  bar.rotation.z = Math.PI * 0.5;
  bar.position.set(0, 0.85, 0.02);
  stemGroup.add(bar);
  [-0.22, 0.22].forEach((gx) => {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.13, 10), rubberMat);
    grip.rotation.z = Math.PI * 0.5;
    grip.position.set(gx, 0.85, 0.02);
    const brakeLever = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.016, 0.018), bronzeRailMat);
    brakeLever.position.set(gx * 0.72, 0.83, -0.025);
    stemGroup.add(grip, brakeLever);
  });

  if (displays) {
    const { material: dashMat, entry: dashEntry } = displays.createDisplayMaterial('bike_dash', {
      intervalSec: 0.08,
    });
    const dashBezel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.085), frameMat);
    dashBezel.position.set(0, 0.87, 0.015);
    dashBezel.rotation.x = 0.42;
    const dashScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.068), dashMat);
    dashScreen.position.set(0, 0.014, 0);
    dashScreen.rotation.x = -Math.PI * 0.5;
    dashBezel.add(dashScreen);
    stemGroup.add(dashBezel);
    steerPivot.userData.dashEntry = dashEntry;
  }

  return {
    group,
    wheels,
    wheelRadii: [0.22, 0.22],
    wheelSides: [0, 0],
    glassPanes: [],
    leanGroup,
    steerPivot,
    dashEntry: (steerPivot.userData.dashEntry as AnimatedDisplayEntry | undefined) ?? null,
    hitMeshes,
    headlightMeshes,
    taillightMeshes,
  };
}

function createExtrudedProfile(
  points: [number, number][],
  width: number,
  bevel = 0.04,
): THREE.BufferGeometry {
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
  geo.rotateY(-Math.PI / 2); // +X -> +Z (rear), -X -> -Z (front)
  return geo;
}

/**
 * Attaches a recessed dark engine bay + sculpted engine block/radiator underneath the bonnet,
 * plus an articulated deformable hood mounted at a strict windshield-base pivot (`hoodRearZ`).
 * Note: positive X rotation on `hoodHingePivot` lifts the forward (-Z) bonnet edge UP.
 */
function attachEngineBayAndHingeHood(
  parent: THREE.Group,
  tagHit: (mesh: THREE.Mesh) => void,
  darkMetal: THREE.Material,
  carbonMat: THREE.Material,
  bodyMat: THREE.MeshStandardMaterial,
  accentColorHex: number,
  opts: {
    hoodW: number;
    hoodLen: number;
    hoodRearY: number;
    hoodRearZ: number;
    hoodTiltX: number; // negative radians dips front tip downward when closed
    engineY: number;
  },
): {
  hoodHingePivot: THREE.Group;
  hoodTiltGroup: THREE.Group;
  hoodMesh: THREE.Mesh;
  hoodSize: [number, number, number];
  deformParts: DeformableMeshPart[];
} {
  const deformParts: DeformableMeshPart[] = [];
  const engineCenterZ = opts.hoodRearZ - opts.hoodLen * 0.5;

  // Recessed engine bay tub (kept safely below MAX_DEFORM_DEPTH clearance)
  const bayTub = new THREE.Mesh(
    new THREE.BoxGeometry(opts.hoodW * 0.72, 0.24, opts.hoodLen * 0.76),
    darkMetal,
  );
  bayTub.position.set(0, opts.engineY - 0.1, engineCenterZ);
  parent.add(bayTub);

  // Sculpted V8/Turbo engine block + dual valve covers + front radiator
  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x3f4652,
    roughness: 0.42,
    metalness: 0.78,
  });
  const valveMat = new THREE.MeshStandardMaterial({
    color: accentColorHex,
    roughness: 0.34,
    metalness: 0.62,
  });
  const engineBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.2, opts.hoodLen * 0.44),
    blockMat,
  );
  engineBlock.position.set(0, opts.engineY, engineCenterZ + 0.08);
  const intakePlenum = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.09, opts.hoodLen * 0.36),
    carbonMat,
  );
  intakePlenum.position.set(0, opts.engineY + 0.12, engineCenterZ + 0.08);
  const radiator = new THREE.Mesh(
    new THREE.BoxGeometry(opts.hoodW * 0.56, 0.22, 0.08),
    blockMat,
  );
  radiator.position.set(0, opts.engineY - 0.02, opts.hoodRearZ - opts.hoodLen * 0.84);
  parent.add(engineBlock, intakePlenum, radiator);

  [-0.22, 0.22].forEach((vx) => {
    const cover = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.07, opts.hoodLen * 0.38),
      valveMat,
    );
    cover.position.set(vx, opts.engineY + 0.09, engineCenterZ + 0.08);
    parent.add(cover);
  });

  // Windshield-base Hinge Pivot (positioned strictly at the cowl edge)
  const hoodHingePivot = new THREE.Group();
  hoodHingePivot.position.set(0, opts.hoodRearY, opts.hoodRearZ);

  const hoodTiltGroup = new THREE.Group();
  hoodTiltGroup.rotation.x = opts.hoodTiltX;
  hoodHingePivot.add(hoodTiltGroup);

  const hoodSize: [number, number, number] = [opts.hoodW, 0.065, opts.hoodLen];
  // Subdivided 6x1x6 mesh so localized crash dents crease naturally around impact point
  const hoodGeo = new THREE.BoxGeometry(hoodSize[0], hoodSize[1], hoodSize[2], 6, 1, 6);
  const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
  hoodMesh.position.set(0, -0.02, -opts.hoodLen * 0.5);
  tagHit(hoodMesh);
  hoodTiltGroup.add(hoodMesh);
  parent.add(hoodHingePivot);

  deformParts.push(createDeformablePart(hoodMesh, 0.92));

  return {
    hoodHingePivot,
    hoodTiltGroup,
    hoodMesh,
    hoodSize,
    deformParts,
  };
}

function buildDetailedCarInterior(
  seatColor: number,
  trimColor: number,
  seatY: number,
  seatZ: number,
  dashZ: number,
  cabinWidth: number,
  displays: DigitalDisplayManager | null | undefined,
  darkMat: THREE.Material,
  steerWheelX = -0.42,
  futuristic = false,
): {
  interiorGroup: THREE.Group;
  dashEntry: AnimatedDisplayEntry | null;
  secondLcdEntry: AnimatedDisplayEntry | null;
  secondLcdMesh: THREE.Mesh | null;
  steerPivot: THREE.Group;
} {
  const interiorGroup = new THREE.Group();
  const effSeatColor = futuristic ? 0xf1f5f9 : seatColor;
  const effTrimColor = futuristic ? 0x22d3ee : trimColor;
  const seatMat = new THREE.MeshStandardMaterial({ color: effSeatColor, roughness: futuristic ? 0.38 : 0.62, metalness: 0.08 });
  const trimMat = new THREE.MeshStandardMaterial({
    color: effTrimColor,
    roughness: 0.25,
    metalness: 0.62,
    emissive: futuristic ? 0x0891b2 : 0x000000,
    emissiveIntensity: futuristic ? 0.45 : 0,
  });
  const pearlDashMat = futuristic
    ? new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.24, metalness: 0.35 })
    : darkMat;
  const holoCyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, toneMapped: false });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.16, metalness: 0.9 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: futuristic ? 0xe2e8f0 : 0x161920, roughness: 0.45, metalness: 0.25 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.72, metalness: 0.08 });

  // Cabin floor & center tunnel console (with cyan holographic light tunnel in futuristic cockpit)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.9, 0.07, 1.92), darkMat);
  floor.position.set(0, seatY - 0.16, seatZ - 0.18);
  interiorGroup.add(floor);

  const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 1.42), futuristic ? pearlDashMat : darkMat);
  consoleBox.position.set(0, seatY - 0.02, seatZ - 0.28);
  const consoleTrim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 1.34), trimMat);
  consoleTrim.position.set(0, seatY + 0.1, seatZ - 0.28);
  interiorGroup.add(consoleBox, consoleTrim);

  if (futuristic) {
    // Illuminated cyan rotary drive controller + dual ambient console strips + brushed chrome pedals
    const rotaryOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.032, 16), chromeMat);
    rotaryOuter.position.set(0, seatY + 0.125, seatZ - 0.32);
    const rotaryCore = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.038, 16), darkMat);
    rotaryCore.position.set(0, seatY + 0.13, seatZ - 0.32);
    const rotaryRing = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.008, 8, 18), holoCyanGlowMat);
    rotaryRing.rotation.x = Math.PI * 0.5;
    rotaryRing.position.set(0, seatY + 0.142, seatZ - 0.32);
    interiorGroup.add(rotaryOuter, rotaryCore, rotaryRing);

    [-0.125, 0.125].forEach((cx) => {
      const vein = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.018, 1.25), holoCyanGlowMat);
      vein.position.set(cx, seatY + 0.08, seatZ - 0.3);
      interiorGroup.add(vein);
    });

    // Chrome brake + accelerator pedals
    const brakePedal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.065, 0.016), chromeMat);
    brakePedal.position.set(steerWheelX - 0.06, seatY - 0.06, dashZ + 0.14);
    brakePedal.rotation.x = -0.35;
    const gasPedal = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.11, 0.016), chromeMat);
    gasPedal.position.set(steerWheelX + 0.06, seatY - 0.07, dashZ + 0.14);
    gasPedal.rotation.x = -0.35;
    interiorGroup.add(brakePedal, gasPedal);
  } else {
    const shifter = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.12, 8), trimMat);
    shifter.position.set(0, seatY + 0.16, seatZ - 0.34);
    interiorGroup.add(shifter);
  }

  // Dual sculpted sport bucket seats (pearl white quilted leather for futuristic vehicles)
  const seatSpacing = Math.min(0.46, cabinWidth * 0.25);
  [-seatSpacing, seatSpacing].forEach((sx) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.5), seatMat);
    base.position.set(sx, seatY - 0.05, seatZ);
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.54, 0.12), seatMat);
    backrest.position.set(sx, seatY + 0.23, seatZ + 0.22);
    backrest.rotation.x = -0.22;
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.1), seatMat);
    headrest.position.set(sx, seatY + 0.54, seatZ + 0.28);
    headrest.rotation.x = -0.15;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.03), trimMat);
    stripe.position.set(sx, seatY + 0.24, seatZ + 0.15);
    stripe.rotation.x = -0.22;
    interiorGroup.add(base, backrest, headrest, stripe);
  });

  // Low-profile cockpit dashboard cowl + digital gauges + holographic wrap-around hyperscreen
  const dashBase = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.9, 0.22, 0.42), futuristic ? pearlDashMat : darkMat);
  dashBase.position.set(0, seatY + 0.12, dashZ);
  const dashUpper = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.86, 0.05, 0.4), futuristic ? darkMat : trimMat);
  dashUpper.position.set(0, seatY + 0.24, dashZ - 0.02);
  interiorGroup.add(dashBase, dashUpper);

  if (futuristic) {
    // Full-width cyan ambient contour bar + glowing circular holographic radar core on center screen
    const dashLightStrip = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.84, 0.018, 0.02), holoCyanGlowMat);
    dashLightStrip.position.set(0, seatY + 0.12, dashZ + 0.22);
    const holoShroud = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.84, 0.21, 0.032), darkMat);
    holoShroud.position.set(0, seatY + 0.22, dashZ + 0.19);
    holoShroud.rotation.x = -0.14;
    const holoRingOuter = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.008, 8, 24), holoCyanGlowMat);
    holoRingOuter.position.set(0.14, seatY + 0.22, dashZ + 0.215);
    holoRingOuter.rotation.x = -0.14;
    const holoRingInner = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.006, 8, 20), holoCyanGlowMat);
    holoRingInner.position.set(0.14, seatY + 0.22, dashZ + 0.216);
    holoRingInner.rotation.x = -0.14;
    interiorGroup.add(dashLightStrip, holoShroud, holoRingOuter, holoRingInner);
  }

  let dashEntry: AnimatedDisplayEntry | null = null;
  const secondLcdEntry: AnimatedDisplayEntry | null = null;
  const secondLcdMesh: THREE.Mesh | null = null;
  if (displays) {
    const { material: dashMat, entry } = displays.createDisplayMaterial('car_cockpit', { intervalSec: 0.08 });
    dashEntry = entry;
    const clusterFrame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.03), darkMat);
    clusterFrame.position.set(steerWheelX, seatY + 0.21, dashZ + 0.2);
    clusterFrame.rotation.x = -0.18;
    const clusterPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.13), dashMat);
    clusterPanel.position.set(0, 0, 0.017);
    clusterFrame.add(clusterPanel);
    interiorGroup.add(clusterFrame);

    const tabletFrame = new THREE.Mesh(new THREE.BoxGeometry(futuristic ? 0.56 : 0.40, 0.20, 0.025), darkMat);
    tabletFrame.position.set(Math.min(cabinWidth * 0.16, 0.18), seatY + 0.22, dashZ + 0.22);
    tabletFrame.rotation.set(-0.12, futuristic ? -0.06 : -0.18, 0);
    const centerNav = new THREE.Mesh(new THREE.PlaneGeometry(futuristic ? 0.53 : 0.37, 0.17), dashMat);
    centerNav.position.set(0, 0, 0.015);
    tabletFrame.add(centerNav);
    interiorGroup.add(tabletFrame);
  }

  // Articulated sport steering column + rotating wheel & driver forearms/hands
  const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.26, 8), darkMat);
  steerCol.rotation.x = Math.PI / 2 - 0.34;
  steerCol.position.set(steerWheelX, seatY + 0.18, dashZ + 0.23);
  interiorGroup.add(steerCol);

  const steerPivot = new THREE.Group();
  steerPivot.position.set(steerWheelX, seatY + 0.21, dashZ + 0.35);
  steerPivot.rotation.x = -0.34;

  const steerRim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.022, 8, 22), futuristic ? pearlDashMat : darkMat);
  const steerTopStripe = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.03, 0.03), trimMat);
  steerTopStripe.position.set(0, 0.155, 0);
  const steerHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.03, 12),
    futuristic ? pearlDashMat : trimMat,
  );
  steerHub.rotation.x = Math.PI / 2;
  const steerSpokeH = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.028, 0.018), futuristic ? chromeMat : darkMat);
  const steerSpokeV = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.15, 0.018), futuristic ? chromeMat : darkMat);
  steerSpokeV.position.set(0, -0.075, 0);
  if (futuristic) {
    const hubEmblem = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 8, 18), holoCyanGlowMat);
    hubEmblem.position.set(0, 0, 0.018);
    steerPivot.add(hubEmblem);
  }

  // Driver gloved hands + forearms gripping 9 & 3 o'clock (move cleanly with steerPivot.rotation.z)
  [-0.155, 0.155].forEach((hx) => {
    const sign = hx < 0 ? -1 : 1;
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.072, 0.062), gloveMat);
    glove.position.set(hx, 0, 0.012);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.04, 0.24, 8), sleeveMat);
    sleeve.position.set(hx + sign * 0.05, -0.06, 0.12);
    sleeve.rotation.set(Math.PI / 2 + 0.24, 0, sign * 0.22);
    steerPivot.add(glove, sleeve);
  });

  steerPivot.add(steerRim, steerTopStripe, steerHub, steerSpokeH, steerSpokeV);
  interiorGroup.add(steerPivot);

  return { interiorGroup, dashEntry, secondLcdEntry, secondLcdMesh, steerPivot };
}

function buildModernAlloyWheel(
  radius: number,
  width: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  accentMat: THREE.Material,
  isSoftwareGl: boolean,
  spokes = 6,
  aeroCap = false,
): THREE.Mesh {
  const wheelGeo = new THREE.CylinderGeometry(radius, radius, width, isSoftwareGl ? 18 : 26);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheel = new THREE.Mesh(wheelGeo, tireMat);
  wheel.castShadow = !isSoftwareGl;
  wheel.receiveShadow = true;

  const barrelGeo = new THREE.CylinderGeometry(radius * 0.67, radius * 0.67, width * 1.02, 18);
  barrelGeo.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, rimMat);
  wheel.add(barrel);

  const innerDishGeo = new THREE.CylinderGeometry(radius * 0.54, radius * 0.54, width * 0.88, 16);
  innerDishGeo.rotateZ(Math.PI / 2);
  const innerDish = new THREE.Mesh(innerDishGeo, new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.65, metalness: 0.4 }));
  wheel.add(innerDish);

  if (aeroCap) {
    for (let s = 0; s < spokes; s++) {
      const wedge = new THREE.Mesh(
        new THREE.BoxGeometry(width * 1.04, radius * 0.18, radius * 0.58),
        s % 2 === 0 ? accentMat : rimMat,
      );
      const a = (s / spokes) * Math.PI * 2;
      wedge.position.set(0, Math.sin(a) * radius * 0.32, Math.cos(a) * radius * 0.32);
      wedge.rotation.x = -a;
      wheel.add(wedge);
    }
  } else {
    const spokeGeo = new THREE.BoxGeometry(width * 1.04, radius * 1.24, radius * 0.09);
    for (let s = 0; s < spokes; s++) {
      const sp = new THREE.Mesh(spokeGeo, s % 2 === 0 ? accentMat : rimMat);
      sp.rotation.x = (s / spokes) * Math.PI;
      wheel.add(sp);
    }
  }

  const hubGeo = new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, width * 1.07, 10);
  hubGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(hubGeo, accentMat));

  return wheel;
}

function buildVehicleMesh(
  id: string,
  kind: VehicleKind,
  isSoftwareGl: boolean,
  displays?: DigitalDisplayManager | null,
  bikeStyle: BikeStyleId = 'volt_green',
): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheelSteerPivots?: THREE.Group[];
  wheelRadii: number[];
  wheelSides: number[];
  glassPanes: VehicleGlassPane[];
  mainRotor: THREE.Object3D | null;
  tailRotor: THREE.Object3D | null;
  auxRotors?: THREE.Object3D[];
  hoverThrusters?: THREE.Mesh[];
  turretGroup: THREE.Object3D | null;
  turretMuzzle: THREE.Object3D | null;
  turretFlash: THREE.Mesh | null;
  leanGroup?: THREE.Group | null;
  steerPivot?: THREE.Group | null;
  doorPivotL?: THREE.Group | null;
  doorPivotR?: THREE.Group | null;
  doorStyle: VehicleDoorStyle;
  driverSeatOffset: THREE.Vector3;
  dashEntry?: AnimatedDisplayEntry | null;
  secondLcdEntry?: AnimatedDisplayEntry | null;
  secondLcdMesh?: THREE.Mesh | null;
  dashStartButtonMesh?: THREE.Mesh | null;
  startBtnMat?: THREE.MeshStandardMaterial | null;
  windowPanesFL?: THREE.Mesh[];
  windowPanesFR?: THREE.Mesh[];
  windowPanesRL?: THREE.Mesh[];
  windowPanesRR?: THREE.Mesh[];
  nightGlowBeams?: THREE.Mesh[];
  nightLightMats?: THREE.MeshBasicMaterial[];
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  exhaustFlameMeshes?: THREE.Mesh[];
  exhaustFlameMat?: THREE.MeshBasicMaterial | null;
  hitMeshes: THREE.Mesh[];
  crashState: VehicleCrashState;
} {
  if (
    kind === 'mansion_hyper_scissor' ||
    kind === 'mansion_escalade_gull' ||
    kind === 'mansion_hummer_gold' ||
    kind === 'mansion_escalade_dragon' ||
    kind === 'mansion_range_marble' ||
    kind === 'mansion_ev_gt'
  ) {
    return buildMansionExclusiveVehicleMesh(id, kind, VEHICLE_SPECS[kind], isSoftwareGl, displays);
  }
  if (kind === 'digital_bike' || kind === 'electric_scooter' || kind === 'future_bike') {
    const twoWheel =
      kind === 'electric_scooter'
        ? buildElectricScooterMesh(id, isSoftwareGl, displays)
        : buildDigitalBikeMesh(id, isSoftwareGl, displays, bikeStyle, kind === 'future_bike');
    return {
      group: twoWheel.group,
      wheels: twoWheel.wheels,
      frontWheelSteerPivots: [],
      wheelRadii: twoWheel.wheelRadii,
      wheelSides: twoWheel.wheelSides,
      glassPanes: twoWheel.glassPanes,
      mainRotor: null,
      tailRotor: null,
      auxRotors: [],
      hoverThrusters: [],
      turretGroup: null,
      turretMuzzle: null,
      turretFlash: null,
      leanGroup: twoWheel.leanGroup,
      steerPivot: twoWheel.steerPivot,
      doorPivotL: null,
      doorPivotR: null,
      doorStyle: 'none',
      driverSeatOffset: new THREE.Vector3(...VEHICLE_SPECS[kind].driverSeatOffset),
      dashEntry: twoWheel.dashEntry,
      nightGlowBeams: [],
      nightLightMats: [],
      headlightMeshes: twoWheel.headlightMeshes,
      taillightMeshes: twoWheel.taillightMeshes,
      hitMeshes: twoWheel.hitMeshes,
      crashState: createVehicleCrashState({}),
    };
  }
  if (
    kind === 'future_sports_car' ||
    kind === 'future_super_car' ||
    kind === 'future_suv' ||
    kind === 'future_heli' ||
    kind === 'future_flying_car' ||
    kind === 'future_drone' ||
    kind === 'future_tank' ||
    kind === 'koutone_hover'
  ) {
    return buildFutureCityVehicleMesh(id, kind, VEHICLE_SPECS[kind], isSoftwareGl, displays);
  }
  if (kind === 'apex_heli') {
    const group = new THREE.Group();
    const glassPanes: VehicleGlassPane[] = [];
    const hitMeshes: THREE.Mesh[] = [];
    const headlightMeshes: THREE.Mesh[] = [];
    const taillightMeshes: THREE.Mesh[] = [];
    const nightGlowBeams: THREE.Mesh[] = [];

    const fuseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.24, metalness: 0.78 });
    const stealthTrimMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.34, metalness: 0.65 });
    const trimGoldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.2, metalness: 0.88 });
    const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.28, metalness: 0.82 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.65 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.06,
      metalness: 0.35,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const noseLedMat = new THREE.MeshBasicMaterial({ color: 0xf8fcff, toneMapped: false });
    const tailStrobeMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false });
    const navGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, toneMapped: false });
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const tagHit = (mesh: THREE.Mesh) => {
      mesh.userData.vehicleId = id;
      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = true;
      hitMeshes.push(mesh);
    };

    // Aerodynamic Twin Landing Skids with Fairings resting strictly at y = 0
    [-1.02, 1.02].forEach((sx) => {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 4.15, 10), titaniumMat);
      skid.rotation.x = Math.PI * 0.5;
      skid.position.set(sx, 0.055, -0.15);
      tagHit(skid);
      const skidTip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.55, 8), trimGoldMat);
      skidTip.rotation.x = Math.PI * 0.34;
      skidTip.position.set(sx, 0.16, -2.35);
      const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 2.5), fuseMat);
      fairing.position.set(sx, 0.13, -0.1);
      group.add(skid, skidTip, fairing);

      [-0.95, 0.78].forEach((sz) => {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.68, 0.14), stealthTrimMat);
        strut.position.set(sx * 0.84, 0.37, sz);
        strut.rotation.z = sx < 0 ? -0.34 : 0.34;
        group.add(strut);
      });
    });

    // Sculpted Modern Stealth/Executive Composite Fuselage (angled chine hull + belly + twin sponsons)
    const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.78, 3.65), fuseMat);
    lowerHull.position.set(0, 0.94, -0.18);
    tagHit(lowerHull);
    const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.86, 2.85), fuseMat);
    upperCabin.position.set(0, 1.54, 0.08);
    tagHit(upperCabin);
    const noseCone = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.82, 1.65, 8), fuseMat);
    noseCone.rotation.x = Math.PI * 0.5 + 0.14;
    noseCone.scale.set(1.12, 1.0, 0.74);
    noseCone.position.set(0, 1.02, -2.42);
    tagHit(noseCone);

    // Chin Electro-Optical / FLIR Gimbal Turret
    const flirPod = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), darkMetal);
    flirPod.position.set(0, 0.62, -2.62);
    const flirLens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), glassMat);
    flirLens.rotation.x = Math.PI * 0.5;
    flirLens.position.set(0, 0.6, -2.84);
    group.add(lowerHull, upperCabin, noseCone, flirPod, flirLens);

    // Swept Side Equipment Sponsons with Wingtip Nav Lights & Gold Pin-stripes
    [-1.12, 1.12].forEach((sx, sIdx) => {
      const sponson = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 2.45), stealthTrimMat);
      sponson.position.set(sx, 0.82, -0.05);
      sponson.rotation.z = sx < 0 ? 0.18 : -0.18;
      tagHit(sponson);
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.09, 0.58), fuseMat);
      winglet.position.set(sx * 1.18, 0.86, 0.15);
      winglet.rotation.z = sx < 0 ? 0.14 : -0.14;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 2.55), trimGoldMat);
      stripe.position.set(sx * 0.96, 1.05, -0.08);
      const navTip = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.14),
        sIdx === 0 ? tailStrobeMat : navGreenMat,
      );
      navTip.position.set(sx * 1.56, 0.92, 0.12);
      group.add(sponson, winglet, stripe, navTip);
    });

    // Raked Wrap-Around Panoramic Tinted Glass Canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.78, 1.56), glassMat);
    canopy.position.set(0, 1.54, -1.72);
    canopy.rotation.x = -0.44;
    canopy.userData.vehicleId = id;
    canopy.userData.vehiclePart = 'glass';
    canopy.userData.glassIdx = 0;
    glassPanes.push({
      mesh: canopy,
      state: 'intact',
      baseOpacity: 0.36,
      baseColor: 0x38bdf8,
      baseMaterial: glassMat,
    });
    hitMeshes.push(canopy);
    const canopyCenterRib = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.82, 0.08), darkMetal);
    canopyCenterRib.position.set(0, 1.56, -1.72);
    canopyCenterRib.rotation.x = -0.44;
    group.add(canopy, canopyCenterRib);

    // Twin Modern Turbine Nacelles with Air Intakes & Titanium Exhausts
    [-0.46, 0.46].forEach((tx) => {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.35, 12), fuseMat);
      nacelle.rotation.x = Math.PI * 0.5;
      nacelle.position.set(tx, 2.08, 0.25);
      tagHit(nacelle);
      const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.18, 10), titaniumMat);
      intake.rotation.x = Math.PI * 0.5;
      intake.position.set(tx, 2.08, -0.94);
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.28, 10), darkMetal);
      exhaust.rotation.x = Math.PI * 0.5;
      exhaust.position.set(tx, 2.04, 1.44);
      group.add(nacelle, intake, exhaust);
    });

    // Tapered Aerodynamic Tail Boom, Swept Vertical Fin & Shrouded Fenestron Duct
    const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, 4.1, 10), fuseMat);
    tailBoom.rotation.x = Math.PI * 0.5;
    tailBoom.position.set(0, 1.56, 3.25);
    tagHit(tailBoom);
    const tailSpine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 3.6), stealthTrimMat);
    tailSpine.position.set(0, 1.76, 3.15);
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.48, 0.84), fuseMat);
    tailFin.position.set(0, 2.26, 5.02);
    tailFin.rotation.x = -0.34;
    const finTrim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.24, 0.14), trimGoldMat);
    finTrim.position.set(0, 2.32, 5.38);
    finTrim.rotation.x = -0.34;
    const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.09, 0.48), stealthTrimMat);
    hStab.position.set(0, 1.62, 4.18);
    const fenestronRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.11, 8, 18), stealthTrimMat);
    fenestronRing.rotation.y = Math.PI * 0.5;
    fenestronRing.position.set(0, 1.88, 5.08);
    group.add(tailBoom, tailSpine, tailFin, finTrim, hStab, fenestronRing);

    // 4-Blade Swept Composite Main Rotor + Machined Titanium/Gold Swashplate Hub
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.48, 12), titaniumMat);
    mast.position.set(0, 2.4, -0.08);
    group.add(mast);
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 2.66, -0.08);
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.22, 12), trimGoldMat);
    mainRotor.add(hubCap);
    for (let b = 0; b < 4; b++) {
      const ang = (b / 4) * Math.PI * 2;
      const bladePivot = new THREE.Group();
      bladePivot.rotation.y = ang;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 4.35), darkMetal);
      blade.position.set(0, 0, 2.24);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.042, 0.46), trimGoldMat);
      tip.position.set(-0.04, 0, 4.34);
      tip.rotation.y = -0.22; // Swept stealth blade tip
      bladePivot.add(blade, tip);
      mainRotor.add(bladePivot);
    }
    group.add(mainRotor);

    // Fenestron 4-Blade Shrouded Tail Rotor
    const tailRotor = new THREE.Group();
    tailRotor.position.set(0, 1.88, 5.08);
    for (let tb = 0; tb < 4; tb++) {
      const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.11), trimGoldMat);
      tBlade.rotation.x = tb * Math.PI * 0.25;
      tailRotor.add(tBlade);
    }
    group.add(tailRotor);

    // Nose LED Searchlight + Rear Tail Strobe + Ground Beam
    const noseLight = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12), noseLedMat);
    noseLight.rotation.x = Math.PI * 0.5;
    noseLight.position.set(0, 0.76, -3.12);
    noseLight.userData.vehicleId = id;
    noseLight.userData.vehiclePart = 'headlight';
    noseLight.userData.origMaterial = noseLedMat;
    noseLight.userData.lightBroken = false;
    headlightMeshes.push(noseLight);
    hitMeshes.push(noseLight);

    const tailStrobe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), tailStrobeMat);
    tailStrobe.position.set(0, 3.04, 5.24);
    tailStrobe.userData.vehicleId = id;
    tailStrobe.userData.vehiclePart = 'taillight';
    tailStrobe.userData.origMaterial = tailStrobeMat;
    tailStrobe.userData.lightBroken = false;
    taillightMeshes.push(tailStrobe);
    hitMeshes.push(tailStrobe);

    const beam = new THREE.Mesh(new THREE.CircleGeometry(1.4, 14), beamMat);
    beam.rotation.x = -Math.PI * 0.5;
    beam.scale.set(1.8, 5.2, 1);
    beam.position.set(0, 0.08, -7.8);
    beam.visible = false;
    nightGlowBeams.push(beam);

    const doorPivotL = new THREE.Group();
    const doorPivotR = new THREE.Group();
    group.add(noseLight, tailStrobe, beam, doorPivotL, doorPivotR);

    return {
      group,
      wheels: [],
      frontWheelSteerPivots: [],
      wheelRadii: [],
      wheelSides: [],
      glassPanes,
      mainRotor,
      tailRotor,
      turretGroup: null,
      turretMuzzle: null,
      turretFlash: null,
      leanGroup: null,
      steerPivot: null,
      doorPivotL,
      doorPivotR,
      doorStyle: 'swing',
      driverSeatOffset: new THREE.Vector3(...VEHICLE_SPECS.apex_heli.driverSeatOffset),
      dashEntry: null,
      nightGlowBeams,
      nightLightMats: [noseLedMat, tailStrobeMat],
      headlightMeshes,
      taillightMeshes,
      hitMeshes,
      crashState: createVehicleCrashState({}),
    };
  }

  const spec = VEHICLE_SPECS[kind];
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const frontWheelSteerPivots: THREE.Group[] = [];
  const wheelRadii: number[] = [];
  const wheelSides: number[] = [];
  const glassPanes: VehicleGlassPane[] = [];
  const hitMeshes: THREE.Mesh[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  const nightGlowBeams: THREE.Mesh[] = [];
  const doorPivotL = new THREE.Group();
  const doorPivotR = new THREE.Group();
  group.add(doorPivotL, doorPivotR);

  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x111419, roughness: 0.55, metalness: 0.62 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.42, metalness: 0.35 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x131519, roughness: 0.88, metalness: 0.06 });
  const whiteLedMat = new THREE.MeshBasicMaterial({ color: 0xf8fcff, toneMapped: false });
  const redTailMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, toneMapped: false });
  const cyanLedMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, toneMapped: false });
  const headlightBeamMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const nightLightMats = [whiteLedMat, redTailMat, cyanLedMat];

  // Clear tinted glass matching Monarch Black SVR & Thar Trail 4x4 visibility
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

  const registerGlass = (mesh: THREE.Mesh) => {
    const idx = glassPanes.length;
    mesh.userData.vehicleId = id;
    mesh.userData.vehiclePart = 'glass';
    mesh.userData.glassIdx = idx;
    mesh.receiveShadow = true;
    hitMeshes.push(mesh);
    glassPanes.push({
      mesh,
      state: 'intact',
      baseOpacity: baseGlassOpacity,
      baseColor: baseGlassColor,
      baseMaterial: glassMat,
    });
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
    beam.scale.set(1.55, 4.4, 1);
    beam.position.set(0, 0.06, frontZ - 4.4);
    beam.visible = false;
    group.add(beam);
    nightGlowBeams.push(beam);
  };

  const attachArticulatedDoors = (
    bodyMaterial: THREE.Material,
    doorLen: number,
    doorHeight: number,
    doorY: number,
    doorCenterZ: number,
    sideX: number,
    glassHeight: number,
  ) => {
    const hingeZ = doorCenterZ - doorLen * 0.46;
    const isGull = spec.doorStyle === 'gullwing';
    const pivotY = isGull ? doorY + doorHeight * 0.5 + glassHeight : doorY;
    doorPivotL.position.set(-sideX, pivotY, hingeZ);
    doorPivotR.position.set(sideX, pivotY, hingeZ);

    const buildLeaf = (pivot: THREE.Group, sign: number) => {
      const leafPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorHeight, doorLen), bodyMaterial);
      leafPanel.position.set(0, isGull ? -(doorHeight * 0.5 + glassHeight) : 0, isGull ? 0 : doorLen * 0.46);
      if (isGull) leafPanel.position.z = doorLen * 0.46;
      tagHit(leafPanel);

      const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, glassHeight, doorLen * 0.86), glassMat);
      doorGlass.position.set(
        sign * -0.02,
        leafPanel.position.y + doorHeight * 0.5 + glassHeight * 0.46,
        doorLen * 0.46,
      );
      registerGlass(doorGlass);

      const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.12), carbonMat);
      mirrorArm.position.set(sign * 0.1, leafPanel.position.y + doorHeight * 0.45, doorLen * 0.14);
      pivot.add(leafPanel, doorGlass, mirrorArm);
    };
    buildLeaf(doorPivotL, -1);
    buildLeaf(doorPivotR, 1);
  };

  let dashEntry: AnimatedDisplayEntry | null = null;

  // =====================================================================
  // A. CYBER PICKUP (Stealth Matte Black) & GOLD CYBERTRUCK
  // =====================================================================
  if (kind === 'cyber_pickup' || kind === 'cyber_gold') {
    const isGold = kind === 'cyber_gold';
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xd9a41e : 0x1a1d22,
      roughness: isGold ? 0.14 : 0.42,
      metalness: isGold ? 0.94 : 0.48,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xd49d1a : 0x1e2229,
      roughness: isGold ? 0.18 : 0.48,
      metalness: isGold ? 0.88 : 0.52,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: isGold ? 0xf6ca4b : 0x353b45,
      roughness: 0.35,
      metalness: 0.65,
    });

    // Recessed lower nose tub so open engine bay & articulated hood sit cleanly above
    const frontHood = new THREE.Mesh(
      createExtrudedProfile(
        [
          [-2.50, 0.42],
          [-2.54, 0.78],
          [-0.86, 0.96],
          [-0.86, 0.42],
        ],
        2.02,
        0.03,
      ),
      bodyMat,
    );
    const rearDeck = new THREE.Mesh(
      createExtrudedProfile(
        [
          [0.64, 0.44],
          [0.64, 1.24],
          [2.48, 1.16],
          [2.44, 0.46],
        ],
        2.06,
        0.03,
      ),
      bodyMat,
    );
    const cabinPan = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.22, 1.65), bodyMat);
    cabinPan.position.set(0, 0.56, -0.1);
    tagHit(frontHood);
    tagHit(rearDeck);
    tagHit(cabinPan);
    group.add(frontHood, rearDeck, cabinPan);

    const hoodRig = attachEngineBayAndHingeHood(group, tagHit, darkMetal, carbonMat, bodyMat, isGold ? 0xd9a41e : 0x38bdf8, {
      hoodW: 1.82,
      hoodLen: 1.66,
      hoodRearY: 1.16,
      hoodRearZ: -0.88,
      hoodTiltX: -0.145,
      engineY: 0.80,
    });

    // Apex tall roof spine + Range/Thar-style upright clear windshield framing
    const roofPeak = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.08, 1.48), bodyMat);
    roofPeak.position.set(0, 2.04, 0.06);
    tagHit(roofPeak);
    group.add(roofPeak);

    [-0.86, 0.86].forEach((sx) => {
      const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.92, 0.11), bodyMat);
      aPillar.position.set(sx, 1.6, -0.82);
      aPillar.rotation.x = 0.28;
      const cPillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.92), bodyMat);
      cPillar.position.set(sx, 1.68, 1.32);
      cPillar.rotation.x = -0.34;
      group.add(aPillar, cPillar);

      // Angular black off-road fender flares
      [-1.58, 1.52].forEach((fz) => {
        const arch = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 1.06), darkMetal);
        arch.position.set(sx * 1.16, 1.04, fz);
        group.add(arch);
      });
    });

    // Clear upright Range/Thar-style windshield + rear glass + side doors
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.88, 0.05), glassMat);
    windshield.position.set(0, 1.6, -0.82);
    windshield.rotation.x = 0.28;
    registerGlass(windshield);
    const rearSlope = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.05, 1.72), glassMat);
    rearSlope.position.set(0, 1.72, 1.24);
    rearSlope.rotation.x = -0.34;
    registerGlass(rearSlope);
    group.add(windshield, rearSlope);

    attachArticulatedDoors(bodyMat, 1.28, 0.56, 1.02, -0.15, 1.02, 0.52);

    // Full-width white DRL lightbar + full-width rear red bar + subdivided deformable front bumper
    const frontBar = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.08, 0.09), whiteLedMat);
    frontBar.position.set(0, 1.02, -2.56);
    registerVehicleLight(frontBar, 'headlight');
    const rearBar = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.08, 0.09), redTailMat);
    rearBar.position.set(0, 1.16, 2.48);
    registerVehicleLight(rearBar, 'taillight');
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.24, 0.26, 6, 2, 2), darkMetal);
    frontBumper.position.set(0, 0.45, -2.56);
    tagHit(frontBumper);
    hoodRig.deformParts.push(createDeformablePart(frontBumper, 1.05));
    const frontFascia = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.2, 0.24, 6, 2, 2), bodyMat);
    frontFascia.position.set(0, 0.84, -2.5);
    tagHit(frontFascia);
    hoodRig.deformParts.push(createDeformablePart(frontFascia, 0.95));
    group.add(frontBar, rearBar, frontBumper, frontFascia);
    attachHeadlightBeam(-2.6);

    const interior = buildDetailedCarInterior(
      isGold ? 0x262118 : 0x1c2026,
      isGold ? 0xd9a41e : 0x64748b,
      1.08,
      0.08,
      -0.78,
      1.86,
      displays,
      darkMetal,
      spec.driverSeatOffset[0],
    );
    dashEntry = interior.dashEntry;
    group.add(interior.interiorGroup);

    const rad = spec.wheelRadius;
    (
      [
        [-1.08, -1.58],
        [1.08, -1.58],
        [-1.08, 1.52],
        [1.08, 1.52],
      ] as [number, number][]
    ).forEach(([wx, wz]) => {
      const wMesh = buildModernAlloyWheel(rad, 0.36, tireMat, rimMat, accentMat, isSoftwareGl, 7, true);
      if (wz < 0) {
        const pivot = new THREE.Group();
        pivot.position.set(wx, rad, wz);
        wMesh.position.set(0, 0, 0);
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
      mainRotor: null,
      tailRotor: null,
      turretGroup: null,
      turretMuzzle: null,
      turretFlash: null,
      steerPivot: interior.steerPivot,
      doorPivotL,
      doorPivotR,
      doorStyle: spec.doorStyle,
      driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
      dashEntry,
      secondLcdEntry: interior.secondLcdEntry,
      secondLcdMesh: interior.secondLcdMesh,
      nightGlowBeams,
      nightLightMats,
      headlightMeshes,
      taillightMeshes,
      hitMeshes,
      crashState: createVehicleCrashState({
        hoodHingePivot: hoodRig.hoodHingePivot,
        hoodMesh: hoodRig.hoodMesh,
        hoodSize: hoodRig.hoodSize,
        paintMaterial: bodyMat,
        deformParts: hoodRig.deformParts,
      }),
    };
  }

  // =====================================================================
  // B. SUPERCAR FLEET: Revuelto Red, Stealth Hyper, Terzo Silver, Lambo Blue
  // =====================================================================
  if (
    kind === 'revuelto_red' ||
    kind === 'stealth_hyper' ||
    kind === 'terzo_silver' ||
    kind === 'lambo_blue_hyper'
  ) {
    const paintHex =
      kind === 'revuelto_red'
        ? 0xa80b18
        : kind === 'stealth_hyper'
          ? 0x17191e
          : kind === 'terzo_silver'
            ? 0x9aa5b5
            : 0x0c4a9e;
    const accentHex =
      kind === 'revuelto_red'
        ? 0xef4444
        : kind === 'stealth_hyper'
          ? 0x64748b
          : kind === 'terzo_silver'
            ? 0x38bdf8
            : 0x38bdf8;
    const seatHex =
      kind === 'revuelto_red'
        ? 0x261417
        : kind === 'lambo_blue_hyper'
          ? 0x241f1c
          : 0x191d24;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: paintHex,
      roughness: kind === 'stealth_hyper' ? 0.38 : 0.16,
      metalness: kind === 'terzo_silver' ? 0.78 : kind === 'stealth_hyper' ? 0.48 : 0.65,
    });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x161920, roughness: 0.25, metalness: 0.75 });
    const calMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.25, metalness: 0.65 });
    const drlAccentMat = kind === 'terzo_silver' ? redTailMat : whiteLedMat;

    // Recessed front lower tub + sculpted wedge hood + engine/radiator bay
    const frontNose = new THREE.Mesh(
      createExtrudedProfile(
        [
          [-2.28, 0.26],
          [-2.20, 0.46],
          [-0.78, 0.62],
          [-0.78, 0.26],
        ],
        1.94,
        0.04,
      ),
      bodyMat,
    );
    const rearEngineBay = new THREE.Mesh(
      createExtrudedProfile(
        [
          [0.62, 0.28],
          [0.62, 0.88],
          [2.24, 0.92],
          [2.28, 0.34],
        ],
        1.98,
        0.04,
      ),
      bodyMat,
    );
    const floorPan = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.14, 1.5), bodyMat);
    floorPan.position.set(0, 0.3, -0.08);
    tagHit(frontNose);
    tagHit(rearEngineBay);
    tagHit(floorPan);
    group.add(frontNose, rearEngineBay, floorPan);

    const hoodRig = attachEngineBayAndHingeHood(group, tagHit, darkMetal, carbonMat, bodyMat, accentHex, {
      hoodW: 1.56,
      hoodLen: 1.44,
      hoodRearY: 0.78,
      hoodRearZ: -0.80,
      hoodTiltX: -0.14,
      engineY: 0.50,
    });

    // Subdivided deformable carbon front splitter + bumper fascia & rear diffuser
    const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.09, 0.42, 6, 1, 2), carbonMat);
    frontSplitter.position.set(0, 0.22, -2.26);
    tagHit(frontSplitter);
    hoodRig.deformParts.push(createDeformablePart(frontSplitter, 1.0));
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.2, 0.24, 6, 2, 2), bodyMat);
    frontBumper.position.set(0, 0.46, -2.22);
    tagHit(frontBumper);
    hoodRig.deformParts.push(createDeformablePart(frontBumper, 0.95));
    const rearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.22, 0.22), carbonMat);
    rearDiffuser.position.set(0, 0.34, 2.24);
    group.add(frontSplitter, frontBumper, rearDiffuser);

    // Elevated sleek cab roof + Range/Thar-style upright clear windshield framing
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.07, 1.12), carbonMat);
    roofCap.position.set(0, 1.5, 0.04);
    tagHit(roofCap);
    group.add(roofCap);

    [-0.68, 0.68].forEach((sx) => {
      const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.09), bodyMat);
      aPillar.position.set(sx, 1.18, -0.68);
      aPillar.rotation.x = 0.34;
      const intakeScoop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 1.15), carbonMat);
      intakeScoop.position.set(sx * 1.38, 0.68, 0.72);
      const flare = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.92), bodyMat);
      flare.position.set(sx * 1.44, 0.86, -1.42);
      group.add(aPillar, intakeScoop, flare);
    });

    // Clear upright Range/Thar-style windshield + rear engine glass
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.68, 0.04), glassMat);
    windshield.position.set(0, 1.18, -0.68);
    windshield.rotation.x = 0.34;
    registerGlass(windshield);
    const engineGlass = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.04, 1.25), glassMat);
    engineGlass.position.set(0, 1.24, 1.14);
    engineGlass.rotation.x = -0.26;
    registerGlass(engineGlass);
    group.add(windshield, engineGlass);

    // Rear GT Wing (Revuelto & Terzo)
    if (kind === 'revuelto_red' || kind === 'terzo_silver' || kind === 'lambo_blue_hyper') {
      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.05, 0.34), carbonMat);
      wingBlade.position.set(0, 1.46, 2.06);
      wingBlade.rotation.x = 0.1;
      [-0.58, 0.58].forEach((px) => {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.24), carbonMat);
        pylon.position.set(px, 1.18, 2.04);
        group.add(pylon);
      });
      group.add(wingBlade);
    }

    // Y-shaped signature LED DRL headlights & rear tail slits
    [-0.78, 0.78].forEach((lx) => {
      const sign = lx < 0 ? -1 : 1;
      const drlA = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.08), whiteLedMat);
      drlA.position.set(lx, 0.56, -2.26);
      drlA.rotation.y = sign * 0.32;
      registerVehicleLight(drlA, 'headlight');
      const drlB = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.08), drlAccentMat);
      drlB.position.set(lx + sign * 0.12, 0.46, -2.28);
      drlB.rotation.z = sign * 0.45;
      registerVehicleLight(drlB, 'headlight');
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.07), redTailMat);
      tail.position.set(lx, 0.72, 2.28);
      registerVehicleLight(tail, 'taillight');
      group.add(drlA, drlB, tail);
    });
    attachHeadlightBeam(-2.3);

    if (kind === 'terzo_silver') {
      [-0.96, 0.96].forEach((sx) => {
        const glowRocker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 2.3), cyanLedMat);
        glowRocker.position.set(sx, 0.24, 0);
        group.add(glowRocker);
      });
    }

    attachArticulatedDoors(bodyMat, 1.22, 0.48, 0.7, 0.02, 0.95, 0.42);

    const interior = buildDetailedCarInterior(
      seatHex,
      accentHex,
      0.72,
      0.16,
      -0.62,
      1.68,
      displays,
      darkMetal,
      spec.driverSeatOffset[0],
    );
    dashEntry = interior.dashEntry;
    group.add(interior.interiorGroup);

    const rad = spec.wheelRadius;
    (
      [
        [-1.0, -1.42],
        [1.0, -1.42],
        [-1.02, 1.4],
        [1.02, 1.4],
      ] as [number, number][]
    ).forEach(([wx, wz]) => {
      const wMesh = buildModernAlloyWheel(
        rad,
        0.31,
        tireMat,
        rimMat,
        kind === 'terzo_silver' ? cyanLedMat : calMat,
        isSoftwareGl,
        6,
        false,
      );
      if (wz < 0) {
        const pivot = new THREE.Group();
        pivot.position.set(wx, rad, wz);
        wMesh.position.set(0, 0, 0);
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
      mainRotor: null,
      tailRotor: null,
      turretGroup: null,
      turretMuzzle: null,
      turretFlash: null,
      steerPivot: interior.steerPivot,
      doorPivotL,
      doorPivotR,
      doorStyle: spec.doorStyle,
      driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
      dashEntry,
      secondLcdEntry: interior.secondLcdEntry,
      secondLcdMesh: interior.secondLcdMesh,
      nightGlowBeams,
      nightLightMats,
      headlightMeshes,
      taillightMeshes,
      hitMeshes,
      crashState: createVehicleCrashState({
        hoodHingePivot: hoodRig.hoodHingePivot,
        hoodMesh: hoodRig.hoodMesh,
        hoodSize: hoodRig.hoodSize,
        paintMaterial: bodyMat,
        deformParts: hoodRig.deformParts,
      }),
    };
  }

  // =====================================================================
  // C. ROLLS COPPER GT, VISION SILVER, GULLWING COUPE, CHALLENGER SCISSOR
  // =====================================================================
  if (
    kind === 'rolls_copper_gt' ||
    kind === 'vision_silver' ||
    kind === 'gullwing_coupe' ||
    kind === 'challenger_scissor'
  ) {
    const isRolls = kind === 'rolls_copper_gt';
    const isVision = kind === 'vision_silver';
    const isGull = kind === 'gullwing_coupe';

    const bodyHex = isRolls
      ? 0xf3f5f8
      : isVision
        ? 0xcbd5e1
        : isGull
          ? 0x262930
          : 0x1d2129;
    const accentHex = isRolls
      ? 0xe86a12
      : isVision
        ? 0x38bdf8
        : isGull
          ? 0xd1d5db
          : 0xd97706;
    const seatHex = isRolls ? 0xd95f0e : isVision ? 0x1e293b : 0x1e222a;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyHex,
      roughness: isVision ? 0.16 : 0.22,
      metalness: isVision ? 0.78 : 0.45,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      roughness: 0.22,
      metalness: isRolls ? 0.72 : 0.55,
    });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.3, metalness: 0.72 });

    // Recessed lower engine bay tub + articulated hood + rear trunk deck + cabin floorpan
    const frontBay = new THREE.Mesh(
      createExtrudedProfile(
        [
          [-2.36, 0.3],
          [-2.36, 0.70],
          [-0.82, 0.78],
          [-0.82, 0.3],
        ],
        1.94,
        0.04,
      ),
      bodyMat,
    );
    const rearTrunk = new THREE.Mesh(
      createExtrudedProfile(
        [
          [0.72, 0.32],
          [0.72, 0.96],
          [2.32, 0.92],
          [2.3, 0.34],
        ],
        1.98,
        0.04,
      ),
      bodyMat,
    );
    const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.18, 1.6), bodyMat);
    cabinFloor.position.set(0, 0.38, -0.04);
    tagHit(frontBay);
    tagHit(rearTrunk);
    tagHit(cabinFloor);
    group.add(frontBay, rearTrunk, cabinFloor);

    const hoodRig = attachEngineBayAndHingeHood(group, tagHit, darkMetal, carbonMat, bodyMat, accentHex, {
      hoodW: 1.68,
      hoodLen: 1.54,
      hoodRearY: 0.96,
      hoodRearZ: -0.84,
      hoodTiltX: -0.055,
      engineY: 0.74,
    });

    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.28, 0.24, 6, 2, 2), bodyMat);
    frontBumper.position.set(0, 0.56, -2.34);
    tagHit(frontBumper);
    hoodRig.deformParts.push(createDeformablePart(frontBumper, 1.0));
    group.add(frontBumper);

    // Tall Coupe/Vision Roof + Range/Thar-style upright clear windshield framing
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.08, 1.5), isGull ? accentMat : bodyMat);
    roof.position.set(0, 1.66, 0.16);
    tagHit(roof);
    group.add(roof);

    [-0.76, 0.76].forEach((sx) => {
      const aPil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.76, 0.09), bodyMat);
      aPil.position.set(sx, 1.3, -0.72);
      aPil.rotation.x = 0.26;
      const cPil = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.76, 0.12), bodyMat);
      cPil.position.set(sx, 1.3, 1.1);
      cPil.rotation.x = -0.28;
      group.add(aPil, cPil);
    });

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.72, 0.04), glassMat);
    windshield.position.set(0, 1.3, -0.72);
    windshield.rotation.x = 0.26;
    registerGlass(windshield);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.72, 0.04), glassMat);
    rearGlass.position.set(0, 1.3, 1.1);
    rearGlass.rotation.x = -0.28;
    registerGlass(rearGlass);
    group.add(windshield, rearGlass);

    if (isRolls) {
      // Iconic bright copper vertical pantheon grille, copper hood stripe, copper aero splitter & Spirit hood ornament
      const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.62, 0.14), accentMat);
      grilleFrame.position.set(0, 0.66, -2.38);
      group.add(grilleFrame);
      for (let g = -3; g <= 3; g++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.52, 0.06), darkMetal);
        slat.position.set(g * 0.09, 0.66, -2.44);
        group.add(slat);
      }
      const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 1.48), accentMat);
      hoodStripe.position.set(0, 0.02, -0.76);
      const ornament = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.14, 8), accentMat);
      ornament.position.set(0, 0.09, -1.46);
      hoodRig.hoodTiltGroup.add(hoodStripe, ornament);
      const copperSplitter = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.1, 0.36, 6, 1, 2), accentMat);
      copperSplitter.position.set(0, 0.27, -2.3);
      tagHit(copperSplitter);
      hoodRig.deformParts.push(createDeformablePart(copperSplitter, 0.95));
      group.add(copperSplitter);
    } else if (isVision) {
      // Glowing cyan dotted grille & lower cyan rocker light strips
      const grilleGlow = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.32, 0.08), cyanLedMat);
      grilleGlow.position.set(0, 0.56, -2.38);
      registerVehicleLight(grilleGlow, 'headlight');
      const starRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 8, 18), whiteLedMat);
      starRing.position.set(0, 0.56, -2.43);
      registerVehicleLight(starRing, 'headlight');
      group.add(grilleGlow, starRing);
      [-0.98, 0.98].forEach((sx) => {
        const sideGlow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.2), cyanLedMat);
        sideGlow.position.set(sx, 0.32, 0);
        group.add(sideGlow);
      });
    } else if (isGull) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.07, 0.09), whiteLedMat);
      bar.position.set(0, 0.72, -2.38);
      registerVehicleLight(bar, 'headlight');
      group.add(bar);
    } else {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.11, 0.92), carbonMat);
      scoop.position.set(0, 0.05, -0.68);
      hoodRig.hoodTiltGroup.add(scoop);
    }

    if (!isGull) {
      [-0.72, 0.72].forEach((lx) => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.08), whiteLedMat);
        hl.position.set(lx, 0.76, -2.38);
        registerVehicleLight(hl, 'headlight');
        group.add(hl);
      });
    }
    [-0.68, 0.68].forEach((lx) => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.07), redTailMat);
      tail.position.set(lx, 0.78, 2.32);
      registerVehicleLight(tail, 'taillight');
      group.add(tail);
    });
    attachHeadlightBeam(-2.42);

    attachArticulatedDoors(bodyMat, 1.24, 0.54, 0.8, 0.06, 0.97, 0.46);

    const interior = buildDetailedCarInterior(
      seatHex,
      accentHex,
      0.86,
      0.16,
      -0.66,
      1.76,
      displays,
      darkMetal,
      spec.driverSeatOffset[0],
    );
    dashEntry = interior.dashEntry;
    group.add(interior.interiorGroup);

    const rad = spec.wheelRadius;
    (
      [
        [-1.0, -1.45],
        [1.0, -1.45],
        [-1.0, 1.45],
        [1.0, 1.45],
      ] as [number, number][]
    ).forEach(([wx, wz]) => {
      const wMesh = buildModernAlloyWheel(
        rad,
        0.3,
        tireMat,
        isVision ? cyanLedMat : rimMat,
        accentMat,
        isSoftwareGl,
        isVision ? 10 : 7,
        isVision || isGull,
      );
      if (wz < 0) {
        const pivot = new THREE.Group();
        pivot.position.set(wx, rad, wz);
        wMesh.position.set(0, 0, 0);
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
      mainRotor: null,
      tailRotor: null,
      turretGroup: null,
      turretMuzzle: null,
      turretFlash: null,
      steerPivot: interior.steerPivot,
      doorPivotL,
      doorPivotR,
      doorStyle: spec.doorStyle,
      driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
      dashEntry,
      secondLcdEntry: interior.secondLcdEntry,
      secondLcdMesh: interior.secondLcdMesh,
      nightGlowBeams,
      nightLightMats,
      headlightMeshes,
      taillightMeshes,
      hitMeshes,
      crashState: createVehicleCrashState({
        hoodHingePivot: hoodRig.hoodHingePivot,
        hoodMesh: hoodRig.hoodMesh,
        hoodSize: hoodRig.hoodSize,
        paintMaterial: bodyMat,
        deformParts: hoodRig.deformParts,
      }),
    };
  }

  // =====================================================================
  // D. RANGE BLACK SVR (Widebody Stealth SUV) & THAR BLACK 4x4
  // =====================================================================
  const isThar = kind === 'thar_black_4x4';
  const bodyMat = new THREE.MeshStandardMaterial({
    color: isThar ? 0x15171c : 0x181b20,
    roughness: isThar ? 0.24 : 0.34,
    metalness: 0.45,
  });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x1e222b, roughness: 0.35, metalness: 0.68 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.72 });

  const bodyLen = isThar ? 3.96 : 4.65;
  const bodyW = isThar ? 1.76 : 2.02;
  const frontBay = new THREE.Mesh(
    createExtrudedProfile(
      [
        [-bodyLen * 0.5, 0.42],
        [-bodyLen * 0.5, 0.88],
        [-0.82, 0.92],
        [-0.82, 0.42],
      ],
      bodyW * 0.96,
      0.03,
    ),
    bodyMat,
  );
  const rearCargo = new THREE.Mesh(
    createExtrudedProfile(
      [
        [0.74, 0.44],
        [0.74, 1.12],
        [bodyLen * 0.48, 1.12],
        [bodyLen * 0.5, 0.44],
      ],
      bodyW,
      0.03,
    ),
    bodyMat,
  );
  const suvFloorPan = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.96, 0.22, 1.68), bodyMat);
  suvFloorPan.position.set(0, 0.54, -0.02);
  tagHit(frontBay);
  tagHit(rearCargo);
  tagHit(suvFloorPan);
  group.add(frontBay, rearCargo, suvFloorPan);

  const hoodLenD = bodyLen * 0.5 - 0.84;
  const hoodRig = attachEngineBayAndHingeHood(group, tagHit, darkMetal, carbonMat, bodyMat, 0x38bdf8, {
    hoodW: bodyW * 0.86,
    hoodLen: hoodLenD,
    hoodRearY: 1.1,
    hoodRearZ: -0.84,
    hoodTiltX: -0.03,
    engineY: 0.88,
  });

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.98, 0.24, 0.24, 6, 2, 2), darkMetal);
  frontBumper.position.set(0, 0.56, -bodyLen * 0.5 - 0.02);
  tagHit(frontBumper);
  hoodRig.deformParts.push(createDeformablePart(frontBumper, 1.0));
  group.add(frontBumper);

  // Tall SUV / 4x4 Roof & pillars leaving side/front cabin clear & open to interior
  const roof = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.86, 0.08, isThar ? 2.15 : 2.48), bodyMat);
  roof.position.set(0, 1.98, 0.42);
  tagHit(roof);
  group.add(roof);

  [-bodyW * 0.42, bodyW * 0.42].forEach((sx) => {
    const aPil = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.84, 0.11), bodyMat);
    aPil.position.set(sx, 1.54, -0.78);
    aPil.rotation.x = isThar ? 0.14 : 0.34;
    const cPil = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.84, 0.22), bodyMat);
    cPil.position.set(sx, 1.54, isThar ? 1.56 : 1.78);
    cPil.rotation.x = isThar ? -0.08 : -0.25;
    group.add(aPil, cPil);

    // Wide wheel arch flares & side steps
    [-bodyLen * 0.32, bodyLen * 0.32].forEach((wz) => {
      const flare = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.94), darkMetal);
      flare.position.set(sx * 1.24, 0.92, wz);
      group.add(flare);
    });
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 1.48), darkMetal);
    step.position.set(sx * 1.2, 0.44, 0.05);
    group.add(step);
  });

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.78, 0.76, 0.05), glassMat);
  windshield.position.set(0, 1.54, -0.78);
  windshield.rotation.x = isThar ? 0.14 : 0.34;
  registerGlass(windshield);
  const rearWin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.76, 0.72, 0.05), glassMat);
  rearWin.position.set(0, 1.54, isThar ? 1.58 : 1.82);
  rearWin.rotation.x = isThar ? -0.08 : -0.24;
  registerGlass(rearWin);
  group.add(windshield, rearWin);

  if (isThar) {
    for (let s = -2; s <= 2; s++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.08), darkMetal);
      slot.position.set(s * 0.13, 0.88, -bodyLen * 0.5 - 0.02);
      group.add(slot);
    }
    [-0.56, 0.56].forEach((hx) => {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.024, 8, 16), whiteLedMat);
      halo.position.set(hx, 0.9, -bodyLen * 0.5 - 0.02);
      registerVehicleLight(halo, 'headlight');
      group.add(halo);
    });
    const spare = buildModernAlloyWheel(0.42, 0.26, tireMat, rimMat, accentMat, isSoftwareGl, 5, false);
    spare.rotation.y = Math.PI / 2;
    spare.position.set(0, 1.02, bodyLen * 0.5 + 0.14);
    group.add(spare);
  } else {
    [-0.46, 0.46].forEach((vx) => {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.46), darkMetal);
      vent.position.set(vx, 0.03, -hoodLenD * 0.44);
      hoodRig.hoodTiltGroup.add(vent);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.08), whiteLedMat);
      hl.position.set(vx * 1.45, 0.94, -bodyLen * 0.5 - 0.01);
      registerVehicleLight(hl, 'headlight');
      group.add(hl);
    });
    const svrSpoiler = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.84, 0.08, 0.24), darkMetal);
    svrSpoiler.position.set(0, 2.02, 1.72);
    group.add(svrSpoiler);
  }
  attachHeadlightBeam(-bodyLen * 0.5 - 0.05);

  [-0.64, 0.64].forEach((tx) => {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.06), redTailMat);
    tail.position.set(tx, 0.96, bodyLen * 0.5 + 0.01);
    registerVehicleLight(tail, 'taillight');
    group.add(tail);
  });

  attachArticulatedDoors(bodyMat, 1.24, 0.64, 0.86, 0.04, bodyW * 0.48, 0.56);

  const interior = buildDetailedCarInterior(
    isThar ? 0x3b2c20 : 0x1b1e24,
    0x64748b,
    1.04,
    0.04,
    -0.66,
    bodyW * 0.86,
    displays,
    darkMetal,
    spec.driverSeatOffset[0],
  );
  dashEntry = interior.dashEntry;
  group.add(interior.interiorGroup);

  const rad = spec.wheelRadius;
  const wzOff = isThar ? 1.28 : 1.48;
  const wxOff = isThar ? 0.92 : 1.04;
  (
    [
      [-wxOff, -wzOff],
      [wxOff, -wzOff],
      [-wxOff, wzOff],
      [wxOff, wzOff],
    ] as [number, number][]
  ).forEach(([wx, wz]) => {
    const wMesh = buildModernAlloyWheel(rad, 0.34, tireMat, rimMat, accentMat, isSoftwareGl, isThar ? 5 : 8, false);
    if (wz < 0) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, rad, wz);
      wMesh.position.set(0, 0, 0);
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
    mainRotor: null,
    tailRotor: null,
    auxRotors: [],
    hoverThrusters: [],
    turretGroup: null,
    turretMuzzle: null,
    turretFlash: null,
    steerPivot: interior.steerPivot,
    doorPivotL,
    doorPivotR,
    doorStyle: spec.doorStyle,
    driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
    dashEntry,
    secondLcdEntry: interior.secondLcdEntry,
    secondLcdMesh: interior.secondLcdMesh,
    nightGlowBeams,
    nightLightMats,
    headlightMeshes,
    taillightMeshes,
    hitMeshes,
    crashState: createVehicleCrashState({
      hoodHingePivot: hoodRig.hoodHingePivot,
      hoodMesh: hoodRig.hoodMesh,
      hoodSize: hoodRig.hoodSize,
      paintMaterial: bodyMat,
      deformParts: hoodRig.deformParts,
    }),
  };
}

function createKoutoneBadgeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#6db6d8';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KOUTONE', 128, 34);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFutureCityVehicleMesh(
  id: string,
  kind:
    | 'future_sports_car'
    | 'future_super_car'
    | 'future_suv'
    | 'future_heli'
    | 'future_flying_car'
    | 'future_drone'
    | 'future_tank'
    | 'koutone_hover',
  spec: VehicleSpec,
  isSoftwareGl: boolean,
  displays?: DigitalDisplayManager | null,
) {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const frontWheelSteerPivots: THREE.Group[] = [];
  const wheelRadii: number[] = [];
  const wheelSides: number[] = [];
  const glassPanes: VehicleGlassPane[] = [];
  const hitMeshes: THREE.Mesh[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  const nightGlowBeams: THREE.Mesh[] = [];
  const auxRotors: THREE.Object3D[] = [];
  const hoverThrusters: THREE.Mesh[] = [];
  const doorPivotL = new THREE.Group();
  const doorPivotR = new THREE.Group();
  group.add(doorPivotL, doorPivotR);

  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.72 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.36, metalness: 0.45 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111419, roughness: 0.85, metalness: 0.08 });
  const cyanLedMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, toneMapped: false });
  const whiteLedMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, toneMapped: false });
  const redTailMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, toneMapped: false });
  const thrusterGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.76,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.06,
    metalness: 0.42,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const tagHit = (mesh: THREE.Mesh) => {
    mesh.userData.vehicleId = id;
    mesh.castShadow = !isSoftwareGl;
    mesh.receiveShadow = true;
    hitMeshes.push(mesh);
  };
  const registerLight = (mesh: THREE.Mesh, role: 'headlight' | 'taillight') => {
    mesh.userData.vehicleId = id;
    mesh.userData.vehiclePart = role;
    mesh.userData.origMaterial = mesh.material;
    mesh.userData.lightBroken = false;
    hitMeshes.push(mesh);
    if (role === 'headlight') headlightMeshes.push(mesh);
    else taillightMeshes.push(mesh);
  };
  const registerGlass = (mesh: THREE.Mesh) => {
    const idx = glassPanes.length;
    mesh.userData.vehicleId = id;
    mesh.userData.vehiclePart = 'glass';
    mesh.userData.glassIdx = idx;
    hitMeshes.push(mesh);
    glassPanes.push({ mesh, state: 'intact', baseOpacity: 0.32, baseColor: 0x7dd3fc, baseMaterial: glassMat });
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

  // =========================================================================
  // 1. FUTURE TANK (White/Silver Digital Stealth MBT + Rotating Railgun Turret)
  // =========================================================================
  if (kind === 'future_tank') {
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.32, metalness: 0.56 });
    const slateArmor = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.44, metalness: 0.68 });

    const lowerHull = new THREE.Mesh(
      createExtrudedProfile(
        [
          [-2.65, 0.44],
          [-2.9, 0.88],
          [-1.85, 1.32],
          [2.45, 1.34],
          [2.85, 0.82],
          [2.65, 0.44],
        ],
        2.15,
        0.04,
      ),
      hullMat,
    );
    tagHit(lowerHull);
    group.add(lowerHull);

    // Side armored track pods with 6 roadwheels & cyan energy rails
    [-1.28, 1.28].forEach((tx) => {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 5.25), darkMetal);
      pod.position.set(tx, 0.48, 0);
      tagHit(pod);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 5.15), slateArmor);
      skirt.position.set(tx, 0.84, 0);
      tagHit(skirt);
      const railGlow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 4.5), cyanLedMat);
      railGlow.position.set(tx + (tx < 0 ? -0.31 : 0.31), 0.86, 0);
      group.add(pod, skirt, railGlow);

      for (let w = 0; w < 6; w++) {
        const wMesh = buildModernAlloyWheel(0.32, 0.44, tireMat, slateArmor, hullMat, isSoftwareGl, 6, true);
        wMesh.position.set(tx, 0.32, -2.05 + w * 0.82);
        group.add(wMesh);
        registerWheel(wMesh, 0.32, tx < 0 ? -1 : 1);
      }
    });

    // Nose headlights + rear vents
    [-0.78, 0.78].forEach((hx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.1), cyanLedMat);
      hl.position.set(hx, 0.96, -2.85);
      registerLight(hl, 'headlight');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), redTailMat);
      tl.position.set(hx, 0.96, 2.8);
      registerLight(tl, 'taillight');
      group.add(hl, tl);
    });

    // Rotating Turret + Long Railgun Barrel + Muzzle + Flash
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.38, 0.05);
    const turretShell = new THREE.Mesh(
      createExtrudedProfile(
        [
          [-1.35, 0],
          [-0.95, 0.56],
          [0.95, 0.58],
          [1.55, 0.22],
          [1.45, 0],
        ],
        1.78,
        0.04,
      ),
      hullMat,
    );
    tagHit(turretShell);
    const sensorPod = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.52), slateArmor);
    sensorPod.position.set(0.45, 0.68, -0.32);
    const opticSlit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.06), cyanLedMat);
    opticSlit.position.set(0.45, 0.68, -0.59);
    const barrelOuter = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 3.35), slateArmor);
    barrelOuter.position.set(0, 0.34, -2.35);
    tagHit(barrelOuter);
    const barrelGlow = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.04, 2.85), cyanLedMat);
    barrelGlow.position.set(0, 0.34, -2.35);
    const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.36), darkMetal);
    muzzleBrake.position.set(0, 0.34, -4.08);
    const turretMuzzle = new THREE.Object3D();
    turretMuzzle.position.set(0, 0.34, -4.32);
    const turretFlash = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.85, 8),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, toneMapped: false }),
    );
    turretFlash.rotation.x = -Math.PI * 0.5;
    turretFlash.position.set(0, 0.34, -4.65);
    turretFlash.visible = false;
    turretGroup.add(turretShell, sensorPod, opticSlit, barrelOuter, barrelGlow, muzzleBrake, turretMuzzle, turretFlash);
    group.add(turretGroup);

    return {
      group,
      wheels,
      frontWheelSteerPivots,
      wheelRadii,
      wheelSides,
      glassPanes,
      mainRotor: null,
      tailRotor: null,
      auxRotors,
      hoverThrusters,
      turretGroup,
      turretMuzzle,
      turretFlash,
      steerPivot: null,
      doorPivotL,
      doorPivotR,
      doorStyle: 'swing' as VehicleDoorStyle,
      driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
      dashEntry: null,
      nightGlowBeams,
      nightLightMats: [cyanLedMat, whiteLedMat, redTailMat],
      headlightMeshes,
      taillightMeshes,
      hitMeshes,
      crashState: createVehicleCrashState({ paintMaterial: hullMat }),
    };
  }

  // =========================================================================
  // 2. FUTURE HELI & FUTURE PASSENGER QUAD-DRONE
  // =========================================================================
  if (kind === 'future_heli' || kind === 'future_drone') {
    const whiteBody = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.42 });
    const chromeSkid = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.22, metalness: 0.86 });

    // Landing skids seated flush at y = 0
    [-0.95, 0.95].forEach((sx) => {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, kind === 'future_drone' ? 2.8 : 3.9, 10), chromeSkid);
      skid.rotation.x = Math.PI * 0.5;
      skid.position.set(sx, 0.05, -0.1);
      tagHit(skid);
      [-0.75, 0.75].forEach((sz) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.58, 0.11), darkMetal);
        leg.position.set(sx * 0.84, 0.34, sz);
        leg.rotation.z = sx < 0 ? -0.3 : 0.3;
        group.add(leg);
      });
      group.add(skid);
    });

    if (kind === 'future_heli') {
      const lowerPod = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.76, 3.65), whiteBody);
      lowerPod.position.set(0, 0.96, -0.2);
      tagHit(lowerPod);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.84, 1.85), glassMat);
      canopy.position.set(0, 1.46, -1.62);
      canopy.rotation.x = -0.38;
      registerGlass(canopy);
      const topCowling = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.64, 2.55), whiteBody);
      topCowling.position.set(0, 1.72, 0.28);
      tagHit(topCowling);
      const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.32, 3.7, 10), whiteBody);
      tailBoom.rotation.x = Math.PI * 0.5;
      tailBoom.position.set(0, 1.48, 3.05);
      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.38, 0.78), whiteBody);
      tailFin.position.set(0, 2.15, 4.72);
      tailFin.rotation.x = -0.32;
      const cyanStripe = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.08, 3.4), cyanLedMat);
      cyanStripe.position.set(0, 0.84, -0.22);
      const noseLed = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.1, 0.1), cyanLedMat);
      noseLed.position.set(0, 0.78, -2.1);
      registerLight(noseLed, 'headlight');
      group.add(lowerPod, canopy, topCowling, tailBoom, tailFin, cyanStripe, noseLed);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.45, 10), darkMetal);
      mast.position.set(0, 2.24, 0.05);
      group.add(mast);
      const mainRotor = new THREE.Group();
      mainRotor.position.set(0, 2.5, 0.05);
      for (let b = 0; b < 4; b++) {
        const bp = new THREE.Group();
        bp.rotation.y = (b / 4) * Math.PI * 2;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.036, 4.15), darkMetal);
        blade.position.set(0, 0, 2.15);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.42), cyanLedMat);
        tip.position.set(0, 0, 4.15);
        bp.add(blade, tip);
        mainRotor.add(bp);
      }
      const tailRotor = new THREE.Group();
      tailRotor.position.set(0.12, 1.88, 4.78);
      for (let tb = 0; tb < 4; tb++) {
        const tbl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.1), cyanLedMat);
        tbl.rotation.x = tb * Math.PI * 0.25;
        tailRotor.add(tbl);
      }
      group.add(mainRotor, tailRotor);

      const interior = buildDetailedCarInterior(0xf1f5f9, 0x22d3ee, 0.92, -0.85, -1.58, 1.38, displays, darkMetal, 0, true);
      group.add(interior.interiorGroup);

      return {
        group,
        wheels: [],
        frontWheelSteerPivots: [],
        wheelRadii: [],
        wheelSides: [],
        glassPanes,
        mainRotor,
        tailRotor,
        auxRotors,
        hoverThrusters,
        turretGroup: null,
        turretMuzzle: null,
        turretFlash: null,
        steerPivot: interior.steerPivot,
        doorPivotL,
        doorPivotR,
        doorStyle: 'swing' as VehicleDoorStyle,
        driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
        dashEntry: interior.dashEntry,
        nightGlowBeams,
        nightLightMats: [cyanLedMat, whiteLedMat, redTailMat],
        headlightMeshes,
        taillightMeshes,
        hitMeshes,
        crashState: createVehicleCrashState({ paintMaterial: whiteBody }),
      };
    }

    // Future Quad-Tilt Passenger Drone (4 circular cyan LED ducted fans + white teardrop pod)
    const cabinShell = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.94, 3.2), whiteBody);
    cabinShell.position.set(0, 1.06, 0);
    tagHit(cabinShell);
    const canopyDome = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.78, 1.72), glassMat);
    canopyDome.position.set(0, 1.46, -0.92);
    canopyDome.rotation.x = -0.32;
    registerGlass(canopyDome);
    const droneEye = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.1), cyanLedMat);
    droneEye.position.set(0, 0.94, -1.66);
    registerLight(droneEye, 'headlight');
    group.add(cabinShell, canopyDome, droneEye);

    const interior = buildDetailedCarInterior(0xf1f5f9, 0x22d3ee, 0.98, -0.18, -0.94, 1.32, displays, darkMetal, 0, true);
    group.add(interior.interiorGroup);

    const fanCoords: [number, number][] = [
      [-1.78, -1.45],
      [1.78, -1.45],
      [-1.78, 1.38],
      [1.78, 1.38],
    ];
    fanCoords.forEach(([fx, fz]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 1.65), whiteBody);
      arm.position.set(fx * 0.56, 1.24, fz * 0.65);
      arm.rotation.y = Math.atan2(fx, fz);
      const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.09, 10, 24), darkMetal);
      shroud.rotation.x = Math.PI * 0.5;
      shroud.position.set(fx, 1.28, fz);
      const cyanRing = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.032, 8, 24), cyanLedMat);
      cyanRing.rotation.x = Math.PI * 0.5;
      cyanRing.position.set(fx, 1.34, fz);
      const fanHub = new THREE.Group();
      fanHub.position.set(fx, 1.28, fz);
      for (let fb = 0; fb < 4; fb++) {
        const fBlade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 1.48), carbonMat);
        fBlade.rotation.y = (fb / 4) * Math.PI;
        fanHub.add(fBlade);
      }
      auxRotors.push(fanHub);
      group.add(arm, shroud, cyanRing, fanHub);
    });

    return {
      group,
      wheels: [],
      frontWheelSteerPivots: [],
      wheelRadii: [],
      wheelSides: [],
      glassPanes,
      mainRotor: auxRotors[0] ?? null,
      tailRotor: null,
      auxRotors,
      hoverThrusters,
      turretGroup: null,
      turretMuzzle: null,
      turretFlash: null,
      steerPivot: interior.steerPivot,
      doorPivotL,
      doorPivotR,
      doorStyle: 'gullwing' as VehicleDoorStyle,
      driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
      dashEntry: interior.dashEntry,
      nightGlowBeams,
      nightLightMats: [cyanLedMat, whiteLedMat, redTailMat],
      headlightMeshes,
      taillightMeshes,
      hitMeshes,
      crashState: createVehicleCrashState({ paintMaterial: whiteBody }),
    };
  }

  // =========================================================================
  // 3. FUTURE SPORTS CAR, SUPER FUTURE CAR, FUTURE SUV, FLYING CAR, KOUTONE HOVER
  // =========================================================================
  const isSuv = kind === 'future_suv';
  const isFlyingCar = kind === 'future_flying_car';
  const isKoutone = kind === 'koutone_hover';
  const isRedSuper = kind === 'future_super_car';

  const bodyHex = isRedSuper
    ? 0xb91c1c
    : isKoutone
      ? 0x79badb
      : isSuv
        ? 0xf1f5f9
        : 0xdbe4ef;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyHex,
    roughness: isRedSuper ? 0.14 : isKoutone ? 0.16 : 0.2,
    metalness: isSuv ? 0.45 : isKoutone ? 0.72 : 0.78,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: isRedSuper ? 0x1e293b : 0x334155,
    roughness: 0.22,
    metalness: 0.85,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: isRedSuper ? 0xef4444 : 0x22d3ee,
    roughness: 0.2,
    metalness: 0.7,
  });

  if (isSuv) {
    const frontBay = new THREE.Mesh(
      createExtrudedProfile([[-2.4, 0.46], [-2.4, 1.04], [-0.84, 1.12], [-0.84, 0.46]], 1.98, 0.04),
      bodyMat,
    );
    const rearCargo = new THREE.Mesh(
      createExtrudedProfile([[0.74, 0.48], [0.74, 1.24], [2.36, 1.22], [2.38, 0.48]], 2.02, 0.04),
      bodyMat,
    );
    const pan = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.24, 1.7), bodyMat);
    pan.position.set(0, 0.56, 0);
    tagHit(frontBay);
    tagHit(rearCargo);
    tagHit(pan);
    group.add(frontBay, rearCargo, pan);

    const roofRack = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 2.38), darkMetal);
    roofRack.position.set(0, 2.04, 0.44);
    const roofLed = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 0.09), cyanLedMat);
    roofLed.position.set(0, 2.08, -0.76);
    registerLight(roofLed, 'headlight');
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.08, 2.48), bodyMat);
    roof.position.set(0, 1.96, 0.42);
    tagHit(roof);
    group.add(roof, roofRack, roofLed);

    [-0.86, 0.86].forEach((sx) => {
      const ap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.84, 0.11), darkMetal);
      ap.position.set(sx, 1.56, -0.82);
      ap.rotation.x = 0.24;
      const cp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.84, 0.24), darkMetal);
      cp.position.set(sx, 1.56, 1.78);
      cp.rotation.x = -0.22;
      group.add(ap, cp);
      [-1.5, 1.5].forEach((wz) => {
        const flare = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.96), darkMetal);
        flare.position.set(sx * 1.24, 0.96, wz);
        group.add(flare);
      });
    });

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.78, 0.05), glassMat);
    windshield.position.set(0, 1.56, -0.82);
    windshield.rotation.x = 0.24;
    registerGlass(windshield);
    const suvRearWin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.74, 0.05), glassMat);
    suvRearWin.position.set(0, 1.56, 1.78);
    suvRearWin.rotation.x = -0.22;
    registerGlass(suvRearWin);
    const grilleBar = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.08, 0.09), cyanLedMat);
    grilleBar.position.set(0, 0.94, -2.42);
    registerLight(grilleBar, 'headlight');
    [-0.78, 0.78].forEach((hx) => {
      const cLamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.08), whiteLedMat);
      cLamp.position.set(hx, 0.92, -2.42);
      registerLight(cLamp, 'headlight');
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.07), redTailMat);
      tl.position.set(hx, 1.04, 2.38);
      registerLight(tl, 'taillight');
      group.add(cLamp, tl);
    });
    group.add(windshield, suvRearWin, grilleBar);
  } else {
    // Low-slung aero wedge chassis (Sports Car / Super Car / Flying Car / Koutone Hover Coupe)
    const elev = isKoutone ? 0.36 : isFlyingCar ? 0.34 : 0;
    const frontNose = new THREE.Mesh(
      createExtrudedProfile([[-2.32, 0.24 + elev], [-2.22, 0.52 + elev], [-0.78, 0.72 + elev], [-0.78, 0.24 + elev]], 1.94, 0.04),
      bodyMat,
    );
    const rearDeck = new THREE.Mesh(
      createExtrudedProfile([[0.64, 0.26 + elev], [0.64, 0.9 + elev], [2.28, 0.92 + elev], [2.32, 0.32 + elev]], 1.98, 0.04),
      bodyMat,
    );
    const floorPan = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.14, 1.55), isKoutone ? bodyMat : darkMetal);
    floorPan.position.set(0, 0.28 + elev, -0.06);
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.08, 0.44), darkMetal);
    splitter.position.set(0, 0.22 + elev, -2.28);
    tagHit(frontNose);
    tagHit(rearDeck);
    tagHit(floorPan);
    tagHit(splitter);
    group.add(frontNose, rearDeck, floorPan, splitter);

    // Sculpted glasshouse canopy
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.07, 1.24), isKoutone ? glassMat : darkMetal);
    roofCap.position.set(0, 1.48 + elev, 0.06);
    tagHit(roofCap);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.74, 0.05), glassMat);
    windshield.position.set(0, 1.18 + elev, -0.74);
    windshield.rotation.x = isKoutone ? 0.48 : 0.38;
    registerGlass(windshield);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.06, 1.28), glassMat);
    rearGlass.position.set(0, 1.22 + elev, 1.22);
    rearGlass.rotation.x = -0.34;
    registerGlass(rearGlass);
    group.add(roofCap, windshield, rearGlass);

    // Aggressive Cyber LED headlights & wrap-around tail bar
    [-0.72, 0.72].forEach((hx) => {
      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.09), isRedSuper ? whiteLedMat : cyanLedMat);
      drl.position.set(hx, 0.62 + elev, -2.28);
      registerLight(drl, 'headlight');
      group.add(drl);
    });
    const tailStrip = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.07, 0.08), isKoutone ? cyanLedMat : redTailMat);
    tailStrip.position.set(0, 0.84 + elev, 2.32);
    registerLight(tailStrip, 'taillight');
    group.add(tailStrip);

    // Side aero blades / rear wing / Koutone branding
    const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.07, 0.34), isKoutone ? bodyMat : carbonMat);
    spoilerWing.position.set(0, 1.06 + elev, 2.18);
    group.add(spoilerWing);

    if (isKoutone) {
      const kTex = createKoutoneBadgeTexture();
      const kMat = new THREE.MeshBasicMaterial({ map: kTex });
      [-0.99, 0.99].forEach((sx) => {
        const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.22), kMat);
        badge.position.set(sx, 0.62 + elev, 0.12);
        badge.rotation.y = sx < 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
        group.add(badge);
      });
    }

    // Thruster Cones for Flying Car & Koutone Hover Coupe
    if (isFlyingCar || isKoutone) {
      (
        [
          [-0.96, -1.42],
          [0.96, -1.42],
          [-0.96, 1.42],
          [0.96, 1.42],
        ] as [number, number][]
      ).forEach(([px, pz]) => {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 14), darkMetal);
        pod.position.set(px, 0.28 + elev, pz);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.52, 12), thrusterGlowMat);
        cone.rotation.x = Math.PI;
        cone.position.set(px, 0.08 + elev * 0.5, pz);
        hoverThrusters.push(cone);
        group.add(pod, cone);
      });
    }
  }

  const elevInt = isKoutone ? 0.36 : isFlyingCar ? 0.34 : 0;
  const interior = buildDetailedCarInterior(
    0xf1f5f9,
    0x22d3ee,
    (isSuv ? 1.04 : 0.72) + elevInt,
    isSuv ? 0.04 : 0.08,
    isSuv ? -0.66 : -0.64,
    isSuv ? 1.84 : 1.72,
    displays,
    darkMetal,
    spec.driverSeatOffset[0],
    true,
  );
  group.add(interior.interiorGroup);

  if (!isKoutone) {
    const rad = spec.wheelRadius;
    const wzOff = isSuv ? 1.48 : 1.44;
    const wxOff = isSuv ? 1.04 : 1.0;
    (
      [
        [-wxOff, -wzOff],
        [wxOff, -wzOff],
        [-wxOff, wzOff],
        [wxOff, wzOff],
      ] as [number, number][]
    ).forEach(([wx, wz]) => {
      const wMesh = buildModernAlloyWheel(rad, isSuv ? 0.34 : 0.3, tireMat, rimMat, accentMat, isSoftwareGl, 8, !isSuv);
      const wy = rad + (isFlyingCar ? 0.34 : 0);
      if (wz < 0) {
        const pivot = new THREE.Group();
        pivot.position.set(wx, wy, wz);
        pivot.add(wMesh);
        group.add(pivot);
        frontWheelSteerPivots.push(pivot);
      } else {
        wMesh.position.set(wx, wy, wz);
        group.add(wMesh);
      }
      registerWheel(wMesh, rad, wx < 0 ? -1 : 1);
    });
  }

  return {
    group,
    wheels,
    frontWheelSteerPivots,
    wheelRadii,
    wheelSides,
    glassPanes,
    mainRotor: null,
    tailRotor: null,
    auxRotors,
    hoverThrusters,
    turretGroup: null,
    turretMuzzle: null,
    turretFlash: null,
    steerPivot: interior.steerPivot,
    doorPivotL,
    doorPivotR,
    doorStyle: spec.doorStyle,
    driverSeatOffset: new THREE.Vector3(...spec.driverSeatOffset),
    dashEntry: interior.dashEntry,
    secondLcdEntry: interior.secondLcdEntry,
    secondLcdMesh: interior.secondLcdMesh,
    nightGlowBeams,
    nightLightMats: [cyanLedMat, whiteLedMat, redTailMat],
    headlightMeshes,
    taillightMeshes,
    hitMeshes,
    crashState: createVehicleCrashState({ paintMaterial: bodyMat }),
  };
}

export function applyDoorRotation(
  pivot: THREE.Group | null | undefined,
  style: VehicleDoorStyle,
  openAmount: number,
  sideSign: number,
) {
  if (!pivot) return;
  if (style === 'swing') {
    pivot.rotation.set(0, sideSign * openAmount * 1.05, 0);
  } else if (style === 'gullwing') {
    pivot.rotation.set(0, 0, sideSign * openAmount * 1.12);
  } else if (style === 'scissor') {
    pivot.rotation.set(-openAmount * 1.02, sideSign * openAmount * 0.16, 0);
  } else {
    pivot.rotation.set(0, 0, 0);
  }
}

function stepWindowPanesGroup(meshes: THREE.Mesh[] | undefined, openAmt: number) {
  if (!meshes || meshes.length === 0) return;
  const clamped = Math.max(0, Math.min(1, openAmt));
  const scaleY = Math.max(0.05, 1 - clamped * 0.92);
  for (let i = 0; i < meshes.length; i++) {
    const m = meshes[i];
    const baseY = (m.userData.baseGlassY as number | undefined) ?? m.position.y;
    const baseH = (m.userData.baseGlassH as number | undefined) ?? 0.46;
    m.scale.y = scaleY;
    m.position.y = baseY - (baseH * (1 - scaleY)) * 0.5;
  }
}

const OFF_HEADLIGHT_MAT = new THREE.MeshStandardMaterial({
  color: 0x334155,
  roughness: 0.45,
  metalness: 0.35,
});
const OFF_TAILLIGHT_MAT = new THREE.MeshStandardMaterial({
  color: 0x3b0d0d,
  roughness: 0.52,
  metalness: 0.28,
});

function getSurfaceAlignedGroundY(
  x: number,
  z: number,
  rawGroundY: number,
): number {
  if (rawGroundY < -0.05) return rawGroundY;
  return Math.max(rawGroundY, getVehicleSurfaceOffsetY(x, z, rawGroundY));
}

function applyVehicleLightVisuals(
  v: VehicleActor,
  lightsLit: boolean,
  beamLit: boolean,
  beamOpacity = 0.24,
) {
  for (let i = 0; i < v.headlightMeshes.length; i++) {
    const m = v.headlightMeshes[i];
    if (m.userData.lightBroken) continue;
    if (!m.userData.origMaterial) m.userData.origMaterial = m.material;
    m.material = lightsLit ? (m.userData.origMaterial as THREE.Material) : OFF_HEADLIGHT_MAT;
  }
  for (let i = 0; i < v.taillightMeshes.length; i++) {
    const m = v.taillightMeshes[i];
    if (m.userData.lightBroken) continue;
    if (!m.userData.origMaterial) m.userData.origMaterial = m.material;
    m.material = lightsLit ? (m.userData.origMaterial as THREE.Material) : OFF_TAILLIGHT_MAT;
  }
  if (v.nightGlowBeams) {
    for (let b = 0; b < v.nightGlowBeams.length; b++) {
      const bm = v.nightGlowBeams[b];
      bm.visible = beamLit && !v.destroyed && !v.headlightsBroken;
      const bmMat = bm.material as THREE.MeshBasicMaterial | undefined;
      if (bmMat && typeof bmMat.opacity === 'number') bmMat.opacity = beamOpacity;
    }
  }
}

function stepMansionVisualMechanisms(v: VehicleActor, dt: number, elapsedSec = 0) {
  stepMansionVehicleMechanisms(v.mansionState, dt);

  if (v.mansionState.isMansionExclusive && v.doorStyle !== 'none') {
    v.doorOpenL = v.mansionState.doorOpenL;
    applyDoorRotation(v.doorPivotL, v.doorStyle, v.mansionState.doorOpenL, -1);
    applyDoorRotation(v.doorPivotR, v.doorStyle, v.mansionState.doorOpenR, 1);
  }

  if (v.mansionState.isMansionExclusive) {
    stepWindowPanesGroup(v.windowPanesFL, v.mansionState.windowOpenFL);
    stepWindowPanesGroup(v.windowPanesFR, v.mansionState.windowOpenFR);
    stepWindowPanesGroup(v.windowPanesRL, v.mansionState.windowOpenRL);
    stepWindowPanesGroup(v.windowPanesRR, v.mansionState.windowOpenRR);
  }

  if (v.startBtnMat) {
    if (v.mansionState.engineRunning) {
      v.startBtnMat.color.setHex(0x10b981);
      v.startBtnMat.emissive.setHex(0x10b981);
      v.startBtnMat.emissiveIntensity = 1.65;
    } else if (v.mansionState.engineStartTimer > 0) {
      v.startBtnMat.color.setHex(0xf59e0b);
      v.startBtnMat.emissive.setHex(0xf59e0b);
      v.startBtnMat.emissiveIntensity = 2.2;
    } else {
      const pulse = 1.0 + Math.sin(elapsedSec * 5.2) * 0.45;
      v.startBtnMat.color.setHex(0xef4444);
      v.startBtnMat.emissive.setHex(0xef4444);
      v.startBtnMat.emissiveIntensity = pulse;
    }
  }

  const sosPulse = getSosPulseState(v.mansionState.sosFlashTimer);
  if (sosPulse.active) {
    applyVehicleLightVisuals(v, sosPulse.lit, sosPulse.lit, sosPulse.lit ? 0.36 : 0);
  } else if (v.mansionState.isMansionExclusive) {
    const flashOn = v.mansionState.hazardFlashTimer > 0 && Math.floor(v.mansionState.hazardFlashTimer * 8) % 2 === 0;
    const lit = (v.mansionState.headlightsOn || flashOn) && !v.destroyed && !v.headlightsBroken;
    applyVehicleLightVisuals(v, lit, lit, flashOn ? 0.34 : 0.22);
  } else {
    const lit = v.mansionState.headlightsOn && !v.destroyed && !v.headlightsBroken;
    for (let i = 0; i < v.headlightMeshes.length; i++) {
      const m = v.headlightMeshes[i];
      if (!m.userData.lightBroken) {
        if (!m.userData.origMaterial) m.userData.origMaterial = m.material;
        m.material = lit ? (m.userData.origMaterial as THREE.Material) : OFF_HEADLIGHT_MAT;
      }
    }
    for (let i = 0; i < v.taillightMeshes.length; i++) {
      const m = v.taillightMeshes[i];
      if (!m.userData.lightBroken) {
        if (!m.userData.origMaterial) m.userData.origMaterial = m.material;
        m.material = lit ? (m.userData.origMaterial as THREE.Material) : OFF_TAILLIGHT_MAT;
      }
    }
    if (!lit && v.nightGlowBeams) {
      for (let b = 0; b < v.nightGlowBeams.length; b++) v.nightGlowBeams[b].visible = false;
    }
  }

  if (v.exhaustFlameMeshes && v.exhaustFlameMat) {
    v.backfireTimer = Math.max(0, (v.backfireTimer ?? 0) - dt);
    v.backfireCooldown = Math.max(0, (v.backfireCooldown ?? 0) - dt);
    const speedKmh = Math.abs(v.speed) * 3.6;
    const isBlazing =
      v.mansionState.engineRunning &&
      !v.destroyed &&
      (speedKmh >= 18 || v.backfireTimer > 0);
    if (isBlazing) {
      const hex = getExhaustBackfireColorHex(speedKmh);
      v.exhaustFlameMat.color.setHex(hex);
      const speedMix = THREE.MathUtils.clamp(speedKmh / 135, 0.25, 1.35);
      const flicker = 0.65 + Math.abs(Math.sin(elapsedSec * 42 + v.wobblePhase)) * 0.72;
      const pulseLen = (v.backfireTimer > 0 ? 1.45 : speedMix) * flicker;
      v.exhaustFlameMat.opacity = Math.min(0.95, 0.48 + speedMix * 0.42);
      for (let ei = 0; ei < v.exhaustFlameMeshes.length; ei++) {
        const fm = v.exhaustFlameMeshes[ei];
        fm.visible = true;
        fm.scale.set(0.85 + flicker * 0.25, 0.85 + flicker * 0.25, pulseLen);
      }
    } else {
      for (let ei = 0; ei < v.exhaustFlameMeshes.length; ei++) {
        v.exhaustFlameMeshes[ei].visible = false;
      }
    }
  }
}

function stepVehicleLeftDoor(v: VehicleActor, dt: number, speedScale = 1) {
  if (v.mansionState.isMansionExclusive) return;
  if (v.doorStyle === 'none') return;
  if (v.doorTimerL > 0) {
    v.doorTimerL = Math.max(0, v.doorTimerL - dt * speedScale);
    // Open smoothly in first phase, hold briefly while player enters/exits, then pull shut smoothly!
    const targetOpen = v.doorTimerL > 0.48 ? 1 : THREE.MathUtils.clamp(v.doorTimerL / 0.42, 0, 1);
    const cur = v.doorOpenL ?? 0;
    const rate = targetOpen > cur ? 15 : 8.5;
    v.doorOpenL = THREE.MathUtils.lerp(cur, targetOpen, Math.min(1, dt * rate));
    applyDoorRotation(v.doorPivotL, v.doorStyle, v.doorOpenL, -1);
  } else if ((v.doorOpenL ?? 0) > 0.005) {
    v.doorOpenL = THREE.MathUtils.lerp(v.doorOpenL ?? 0, 0, Math.min(1, dt * 10));
    if (v.doorOpenL < 0.01) v.doorOpenL = 0;
    applyDoorRotation(v.doorPivotL, v.doorStyle, v.doorOpenL, -1);
  }
}

export class VehicleManager {
  public vehicles: VehicleActor[] = [];
  public shootableMeshes: THREE.Mesh[] = [];
  private rootGroup = new THREE.Group();
  private scene: THREE.Scene;
  private isSoftwareGl: boolean;
  private displays = new DigitalDisplayManager();
  public detachedHoodPool: DetachedHoodPool;

  constructor(scene: THREE.Scene, isSoftwareGl: boolean) {
    this.scene = scene;
    this.isSoftwareGl = isSoftwareGl;
    this.scene.add(this.rootGroup);
    this.detachedHoodPool = new DetachedHoodPool(this.scene);
  }

  public clear() {
    this.displays.dispose();
    this.displays = new DigitalDisplayManager();
    this.detachedHoodPool.clearAll();
    disposeObject3DResources(this.rootGroup);
    this.rootGroup.clear();
    this.vehicles = [];
    this.shootableMeshes = [];
  }

  public dispose() {
    this.clear();
    this.detachedHoodPool.dispose();
    this.scene.remove(this.rootGroup);
  }

  public spawnAll(
    specs: VehicleSpawnSpec[],
    groundHeightAt: (x: number, z: number, curY?: number) => number,
  ) {
    this.clear();
    for (const sp of specs) {
      const refY = sp.y ?? 0.4;
      const rawY = groundHeightAt(sp.x, sp.z, refY);
      const spawnY = sp.y !== undefined ? Math.max(sp.y, rawY) : getSurfaceAlignedGroundY(sp.x, sp.z, rawY);
      this.spawnSingle(
        sp.id,
        sp.kind,
        sp.x,
        spawnY,
        sp.z,
        sp.yaw,
        sp.bikeStyle ?? 'volt_green',
        false,
      );
    }
  }

  public spawnDynamicVehicle(
    kind: VehicleKind,
    x: number,
    y: number,
    z: number,
    yaw: number,
    idPrefix = 'hijack',
    opts?: { bikeStyle?: BikeStyleId; openLeftDoor?: boolean },
  ): VehicleActor {
    const id = `${idPrefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    return this.spawnSingle(
      id,
      kind,
      x,
      y,
      z,
      yaw,
      opts?.bikeStyle ?? 'volt_green',
      Boolean(opts?.openLeftDoor),
    );
  }

  private spawnSingle(
    id: string,
    kind: VehicleKind,
    x: number,
    y: number,
    z: number,
    yaw: number,
    bikeStyle: BikeStyleId,
    openLeftDoor: boolean,
  ): VehicleActor {
    const spec = VEHICLE_SPECS[kind];
    const built = buildVehicleMesh(id, kind, this.isSoftwareGl, this.displays, bikeStyle);
    built.group.position.set(x, y, z);
    built.group.rotation.y = yaw;
    this.rootGroup.add(built.group);

    const doorTimerL = openLeftDoor && built.doorStyle !== 'none' ? 1.1 : 0;
    if (doorTimerL > 0) {
      applyDoorRotation(built.doorPivotL, built.doorStyle, 0.25, -1);
    }

    const actor: VehicleActor = {
      id,
      kind,
      spec,
      group: built.group,
      wheels: built.wheels,
      frontWheelSteerPivots: built.frontWheelSteerPivots ?? [],
      wheelRadii: built.wheelRadii,
      wheelSides: built.wheelSides,
      puncturedWheels: built.wheels.map(() => false),
      glassPanes: built.glassPanes,
      wobblePhase: 0,
      mainRotor: built.mainRotor,
      tailRotor: built.tailRotor,
      auxRotors: built.auxRotors ?? [],
      hoverThrusters: built.hoverThrusters ?? [],
      turretGroup: built.turretGroup,
      turretMuzzle: built.turretMuzzle,
      turretFlash: built.turretFlash,
      leanGroup: built.leanGroup ?? null,
      steerPivot: built.steerPivot ?? null,
      doorPivotL: built.doorPivotL ?? null,
      doorPivotR: built.doorPivotR ?? null,
      doorStyle: built.doorStyle,
      doorTimerL,
      doorOpenL: openLeftDoor && built.doorStyle !== 'none' ? 0.25 : 0,
      driverSeatOffset: built.driverSeatOffset,
      bikeSteer: 0,
      bikeLean: 0,
      dashEntry: built.dashEntry ?? null,
      secondLcdEntry: built.secondLcdEntry ?? null,
      secondLcdMesh: built.secondLcdMesh ?? null,
      dashStartButtonMesh: built.dashStartButtonMesh ?? null,
      startBtnMat: built.startBtnMat ?? null,
      windowPanesFL: built.windowPanesFL ?? [],
      windowPanesFR: built.windowPanesFR ?? [],
      windowPanesRL: built.windowPanesRL ?? [],
      windowPanesRR: built.windowPanesRR ?? [],
      mansionState: createDefaultMansionVehicleState(
        Boolean(spec.isMansionExclusive),
        Boolean(spec.isHelicopter),
      ),
      nightGlowBeams: built.nightGlowBeams ?? [],
      nightLightMats: built.nightLightMats ?? [],
      headlightMeshes: built.headlightMeshes,
      taillightMeshes: built.taillightMeshes,
      exhaustFlameMeshes: built.exhaustFlameMeshes ?? [],
      exhaustFlameMat: built.exhaustFlameMat ?? null,
      backfireTimer: 0,
      backfireCooldown: 0,
      headlightsBroken: false,
      bulletHoleDecals: [],
      hitMeshes: built.hitMeshes,
      crashState: built.crashState,
      position: new THREE.Vector3(x, y, z),
      yaw,
      pitch: 0,
      roll: 0,
      speed: 0,
      vertVel: 0,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      destroyed: false,
      driverId: null,
      smokeTimer: 0,
    };
    if (actor.dashEntry) {
      actor.dashEntry.vehicleId = id;
      actor.dashEntry.worldPos = actor.position;
    }
    if (actor.secondLcdEntry) {
      actor.secondLcdEntry.vehicleId = id;
      actor.secondLcdEntry.worldPos = actor.position;
    }
    this.vehicles.push(actor);
    this.shootableMeshes.push(...built.hitMeshes);
    return actor;
  }

  public setNightGlow(nightFactor: number) {
    const showBeams = nightFactor > 0.28;
    const beamOpacity = Math.max(0, Math.min(0.26, (nightFactor - 0.2) * 0.34));
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v.mansionState.isMansionExclusive || v.mansionState.sosFlashTimer > 0) continue;
      if (v.nightGlowBeams) {
        for (let b = 0; b < v.nightGlowBeams.length; b++) {
          const bm = v.nightGlowBeams[b];
          bm.visible = showBeams && v.mansionState.headlightsOn && !v.destroyed && !v.headlightsBroken;
          const m = bm.material as THREE.MeshBasicMaterial;
          if (m && typeof m.opacity === 'number') m.opacity = beamOpacity;
        }
      }
    }
  }

  public hitVehiclePart(
    vehicle: VehicleActor,
    mesh: THREE.Object3D,
    damage = 25,
    hitPoint?: THREE.Vector3,
    hitNormal?: THREE.Vector3,
  ): 'body' | 'cracked' | 'shattered' | 'punctured' | 'light_cracked' {
    const part = mesh.userData.vehiclePart as string | undefined;
    if (part === 'headlight' || part === 'taillight') {
      const lm = mesh as THREE.Mesh;
      if (!lm.userData.lightBroken) {
        lm.userData.lightBroken = true;
        lm.material = getSharedBrokenLightMaterial();
        if (part === 'headlight' && vehicle.headlightMeshes.every((h) => h.userData.lightBroken)) {
          vehicle.headlightsBroken = true;
          if (vehicle.nightGlowBeams) {
            for (let b = 0; b < vehicle.nightGlowBeams.length; b++) {
              vehicle.nightGlowBeams[b].visible = false;
            }
          }
        }
        return 'light_cracked';
      }
      return 'body';
    }
    if (part === 'glass') {
      const gIdx = mesh.userData.glassIdx as number | undefined;
      const pane = gIdx !== undefined ? vehicle.glassPanes[gIdx] : undefined;
      if (pane) {
        if (pane.state === 'intact' && damage < 55) {
          pane.state = 'cracked';
          const crackedMat = new THREE.MeshStandardMaterial({
            color: 0xdbeafe,
            map: getSharedCrackedGlassTexture(),
            roughness: 0.45,
            metalness: 0.25,
            transparent: true,
            opacity: Math.max(0.84, pane.baseOpacity),
          });
          pane.mesh.material = crackedMat;
          return 'cracked';
        }
        if (pane.state !== 'shattered') {
          pane.state = 'shattered';
          pane.mesh.visible = false;
          const hIdx = vehicle.hitMeshes.indexOf(pane.mesh);
          if (hIdx >= 0) vehicle.hitMeshes.splice(hIdx, 1);
          const sIdx = this.shootableMeshes.indexOf(pane.mesh);
          if (sIdx >= 0) this.shootableMeshes.splice(sIdx, 1);
          return 'shattered';
        }
      }
    } else if (part === 'wheel') {
      const wIdx = mesh.userData.wheelIdx as number | undefined;
      if (wIdx !== undefined && wIdx >= 0 && wIdx < vehicle.wheels.length && !vehicle.puncturedWheels[wIdx]) {
        vehicle.puncturedWheels[wIdx] = true;
        const w = vehicle.wheels[wIdx];
        const rad = vehicle.wheelRadii[wIdx] ?? 0.44;
        const side = vehicle.wheelSides[wIdx] ?? 0;
        w.position.y -= rad * 0.22;
        w.scale.set(1, 0.78, 0.78);
        if (side !== 0) {
          w.rotation.z += side * 0.14;
        }
        return 'punctured';
      }
    }

    // Attach realistic local-space bullet-hole decal on body armor hits
    if (hitPoint && hitNormal && !vehicle.destroyed) {
      const { geo, mat } = getSharedBulletHoleAssets();
      let decal: THREE.Mesh;
      if (vehicle.bulletHoleDecals.length >= 24) {
        decal = vehicle.bulletHoleDecals.shift()!;
      } else {
        decal = new THREE.Mesh(geo, mat);
        decal.userData.isBulletHoleDecal = true;
        vehicle.group.add(decal);
      }
      vehicle.group.updateMatrixWorld();
      _scratchImpactPt.copy(hitPoint).addScaledVector(hitNormal, 0.018);
      vehicle.group.worldToLocal(_scratchImpactPt);
      _scratchImpactDir.copy(hitPoint).addScaledVector(hitNormal, 1.0);
      vehicle.group.worldToLocal(_scratchImpactDir);
      decal.position.copy(_scratchImpactPt);
      decal.lookAt(vehicle.group.localToWorld(_scratchImpactDir.clone()));
      decal.rotateZ((vehicle.bulletHoleDecals.length * 1.37) % (Math.PI * 2));
      decal.visible = true;
      vehicle.bulletHoleDecals.push(decal);
    }
    return 'body';
  }

  public findNearestAvailable(pos: THREE.Vector3, maxDist = 5.4): VehicleActor | null {
    let best: VehicleActor | null = null;
    let bestDist = maxDist;
    for (const v of this.vehicles) {
      if (v.destroyed) continue;
      if (v.driverId !== null) continue;
      const d = Math.hypot(v.position.x - pos.x, v.position.z - pos.z);
      if (d < bestDist && Math.abs(v.position.y - pos.y) < 4.5) {
        best = v;
        bestDist = d;
      }
    }
    return best;
  }

  public getById(id: string | null): VehicleActor | null {
    if (!id) return null;
    return this.vehicles.find((v) => v.id === id) || null;
  }

  public repairVehicle(v: VehicleActor) {
    v.hp = v.maxHp;
    resetVehicleCrashState(v.crashState);
    for (let i = 0; i < v.glassPanes.length; i++) {
      const pane = v.glassPanes[i];
      pane.state = 'intact';
      pane.mesh.material = pane.baseMaterial;
      pane.mesh.visible = true;
      if (!v.hitMeshes.includes(pane.mesh)) {
        v.hitMeshes.push(pane.mesh);
      }
      if (!this.shootableMeshes.includes(pane.mesh)) {
        this.shootableMeshes.push(pane.mesh);
      }
    }
    for (let i = 0; i < v.puncturedWheels.length; i++) {
      if (v.puncturedWheels[i]) {
        v.puncturedWheels[i] = false;
        const w = v.wheels[i];
        const rad = v.wheelRadii[i] ?? 0.44;
        const side = v.wheelSides[i] ?? 0;
        w.position.y += rad * 0.22;
        w.scale.set(1, 1, 1);
        if (side !== 0) {
          w.rotation.z -= side * 0.14;
        }
      }
    }
    v.headlightsBroken = false;
    for (let i = 0; i < v.headlightMeshes.length; i++) {
      const hl = v.headlightMeshes[i];
      hl.userData.lightBroken = false;
      if (hl.userData.origMaterial) hl.material = hl.userData.origMaterial as THREE.Material;
    }
    for (let i = 0; i < v.taillightMeshes.length; i++) {
      const tl = v.taillightMeshes[i];
      tl.userData.lightBroken = false;
      if (tl.userData.origMaterial) tl.material = tl.userData.origMaterial as THREE.Material;
    }
    for (let i = 0; i < v.bulletHoleDecals.length; i++) {
      v.group.remove(v.bulletHoleDecals[i]);
    }
    v.bulletHoleDecals.length = 0;
  }

  public applyDamageImpact(
    vehicle: VehicleActor,
    worldPoint: THREE.Vector3,
    worldInwardDir: THREE.Vector3,
    impactSpeedMs: number,
  ): CrashImpactSummary | null {
    if (vehicle.destroyed || vehicle.kind === 'digital_bike' || vehicle.kind === 'electric_scooter' || vehicle.kind === 'future_bike') return null;
    _scratchVelWorld.set(
      -Math.sin(vehicle.yaw) * vehicle.speed,
      0,
      -Math.cos(vehicle.yaw) * vehicle.speed,
    );
    const summary = applyVehicleCrashImpact(
      vehicle.crashState,
      worldPoint,
      worldInwardDir,
      impactSpeedMs,
      _scratchVelWorld,
      this.detachedHoodPool,
    );
    if (summary.shatterWindshield && vehicle.glassPanes.length > 0) {
      this.hitVehiclePart(vehicle, vehicle.glassPanes[0].mesh, 38);
    }
    return summary;
  }

  public stepLocalDriven(
    vehicle: VehicleActor,
    input: VehicleInputState,
    dt: number,
    groundHeightAt: (x: number, z: number, currentY?: number) => number,
    colliders: ColliderBox[],
    mapBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
    extraColliders: readonly SimColliderBox[] = [],
    colliderGrid?: ColliderSpatialGrid | null,
    elapsedSec?: number,
    dynamicColliders: readonly ColliderBox[] = [],
  ): VehicleDriveStepResult {
    _scratchStepResult.collided = false;
    _scratchStepResult.impactSpeedMs = 0;
    _scratchStepResult.crashSummary = null;
    if (vehicle.destroyed) return _scratchStepResult;
    const spec = vehicle.spec;

    stepMansionVisualMechanisms(vehicle, dt, elapsedSec ?? 0);
    if (vehicle.mansionState.isMansionExclusive) {
      const spdKmh = Math.abs(vehicle.speed) * 3.6;
      if (
        vehicle.mansionState.engineRunning &&
        (vehicle.backfireCooldown ?? 0) <= 0 &&
        ((input.throttle > 0.5 && spdKmh > 38 && Math.random() < dt * 1.1) ||
          (Math.abs(input.throttle) < 0.08 && spdKmh > 52 && Math.random() < dt * 2.2))
      ) {
        vehicle.backfireTimer = 0.28;
        vehicle.backfireCooldown = 1.4;
        soundEngine.playExhaustBackfire(spdKmh, 0);
      }
    }

    const engineReady = canVehicleMove(vehicle.mansionState);
    const effectiveThrottle = engineReady ? input.throttle : 0;

    if (spec.isHelicopter) {
      vehicle.mansionState.rotorRpm = Math.min(1, vehicle.mansionState.rotorRpm + dt * 0.72);
      const canLift = vehicle.mansionState.rotorRpm > 0.32;
      const targetSpd =
        effectiveThrottle > 0.05
          ? effectiveThrottle * spec.maxSpeed
          : effectiveThrottle < -0.05
            ? effectiveThrottle * spec.reverseSpeed
            : 0;
      vehicle.speed = THREE.MathUtils.lerp(vehicle.speed, targetSpd, Math.min(1, dt * 2.8));
      vehicle.yaw -= input.steer * spec.turnRate * dt;

      const fwdX = -Math.sin(vehicle.yaw);
      const fwdZ = -Math.cos(vehicle.yaw);
      let nextX = THREE.MathUtils.clamp(vehicle.position.x + fwdX * vehicle.speed * dt, mapBounds.minX, mapBounds.maxX);
      let nextZ = THREE.MathUtils.clamp(vehicle.position.z + fwdZ * vehicle.speed * dt, mapBounds.minZ, mapBounds.maxZ);

      const floorAtDest = getSurfaceAlignedGroundY(
        nextX,
        nextZ,
        groundHeightAt(nextX, nextZ, vehicle.position.y),
      );
      if (input.ascend && canLift) {
        vehicle.vertVel = THREE.MathUtils.lerp(vehicle.vertVel, 14.5, Math.min(1, dt * 4.5));
      } else if (input.descend) {
        vehicle.vertVel = THREE.MathUtils.lerp(vehicle.vertVel, -13.5, Math.min(1, dt * 5.0));
      } else {
        const airborne = vehicle.position.y > floorAtDest + 0.35;
        vehicle.vertVel = THREE.MathUtils.lerp(vehicle.vertVel, airborne ? -0.35 : 0, Math.min(1, dt * 4.2));
      }
      let nextY = vehicle.position.y + vehicle.vertVel * dt;
      if (nextY <= floorAtDest) {
        nextY = floorAtDest;
        vehicle.vertVel = Math.max(0, vehicle.vertVel);
      }
      nextY = Math.min(floorAtDest + 160, nextY);

      // Horizontal collider check when flying low (supports OBB + dynamic door colliders)
      const radius = 1.95;
      const boxRes = { x: nextX, z: nextZ, hitNormalX: 0, hitNormalZ: 0, collided: false };
      const resolveHeliBox = (c: ColliderBox) => {
        if (resolveVehicleBoxCollider(nextX, nextZ, nextY, radius, 2.4, c, boxRes)) {
          nextX = boxRes.x;
          nextZ = boxRes.z;
          vehicle.speed *= 0.45;
          _scratchStepResult.collided = true;
        }
      };
      if (colliderGrid) {
        forEachColliderInBounds(
          colliderGrid,
          nextX - radius - 1,
          nextZ - radius - 1,
          nextX + radius + 1,
          nextZ + radius + 1,
          (idx) => resolveHeliBox(colliders[idx]),
        );
      } else {
        for (let i = 0; i < colliders.length; i++) resolveHeliBox(colliders[i]);
      }
      for (let i = 0; i < dynamicColliders.length; i++) {
        resolveHeliBox(dynamicColliders[i]);
      }

      vehicle.position.set(nextX, nextY, nextZ);
      const isAirborne = nextY > floorAtDest + 0.35;
      const targetPitch = isAirborne ? -THREE.MathUtils.clamp(vehicle.speed / spec.maxSpeed, -0.5, 1) * 0.22 : 0;
      const targetRoll = isAirborne ? -input.steer * 0.22 : 0;
      vehicle.pitch = THREE.MathUtils.lerp(vehicle.pitch, targetPitch, Math.min(1, dt * 6));
      vehicle.roll = THREE.MathUtils.lerp(vehicle.roll, targetRoll, Math.min(1, dt * 6));

      if (vehicle.mainRotor) vehicle.mainRotor.rotation.y += dt * (4 + vehicle.mansionState.rotorRpm * 24);
      if (vehicle.auxRotors && vehicle.auxRotors.length > 0) {
        const spin = dt * (5 + vehicle.mansionState.rotorRpm * 26);
        for (let ai = 0; ai < vehicle.auxRotors.length; ai++) {
          vehicle.auxRotors[ai].rotation.y += ai % 2 === 0 ? spin : -spin;
        }
      }
      if (vehicle.hoverThrusters && vehicle.hoverThrusters.length > 0) {
        const pulse = 0.85 + Math.sin((elapsedSec ?? 0) * 18) * 0.25;
        for (let ti = 0; ti < vehicle.hoverThrusters.length; ti++) {
          vehicle.hoverThrusters[ti].scale.set(1, pulse, 1);
        }
      }
      if (vehicle.tailRotor) vehicle.tailRotor.rotation.x += dt * (5 + vehicle.mansionState.rotorRpm * 28);

      vehicle.group.position.copy(vehicle.position);
      vehicle.group.rotation.order = 'YXZ';
      vehicle.group.rotation.y = vehicle.yaw;
      vehicle.group.rotation.x = vehicle.pitch;
      vehicle.group.rotation.z = vehicle.roll;
      return _scratchStepResult;
    }

    let puncturedCount = 0;
    let leftPunctures = 0;
    let rightPunctures = 0;
    for (let wi = 0; wi < vehicle.puncturedWheels.length; wi++) {
      if (vehicle.puncturedWheels[wi]) {
        puncturedCount++;
        const s = vehicle.wheelSides[wi] ?? 0;
        if (s < 0) leftPunctures++;
        else if (s > 0) rightPunctures++;
      }
    }
    const tireSpeedScale = Math.max(0.42, 1 - puncturedCount * 0.16);

    const speedNorm = Math.min(1, Math.abs(vehicle.speed) / Math.max(4, spec.maxSpeed * 0.44));
    const progressiveTorque = 0.24 + 0.76 * speedNorm;
    if (effectiveThrottle < -0.04) {
      if (vehicle.speed > 1.2) {
        vehicle.speed = THREE.MathUtils.lerp(vehicle.speed, 0, Math.min(1, dt * 6.5));
      } else {
        const target = effectiveThrottle * spec.reverseSpeed * tireSpeedScale;
        vehicle.speed = THREE.MathUtils.lerp(vehicle.speed, target, Math.min(1, dt * (spec.accel / 7.8) * progressiveTorque));
      }
    } else if (effectiveThrottle > 0.04) {
      if (vehicle.speed < -1.2) {
        vehicle.speed = THREE.MathUtils.lerp(vehicle.speed, 0, Math.min(1, dt * 6.5));
      } else {
        const target = effectiveThrottle * spec.maxSpeed * tireSpeedScale;
        vehicle.speed = THREE.MathUtils.lerp(vehicle.speed, target, Math.min(1, dt * (spec.accel / 8.5) * progressiveTorque));
      }
    } else {
      vehicle.speed = THREE.MathUtils.lerp(vehicle.speed, 0, Math.min(1, dt * 2.6));
    }

    const speedSign = vehicle.speed >= -0.15 ? 1 : -1;
    const activeMoveSteer = Math.abs(input.throttle) > 0.05 ? 0.42 : 0;
    const steerAuthority = Math.max(activeMoveSteer, Math.min(1, Math.abs(vehicle.speed) / 3.2));
    vehicle.yaw -= input.steer * spec.turnRate * steerAuthority * speedSign * dt;
    if (puncturedCount > 0 && Math.abs(vehicle.speed) > 1.2) {
      vehicle.wobblePhase += dt * (9 + Math.abs(vehicle.speed) * 0.7);
      const sidePull = (leftPunctures - rightPunctures) * 0.24;
      const shimmy = Math.sin(vehicle.wobblePhase) * 0.11 * Math.min(2, puncturedCount);
      vehicle.yaw += (sidePull + shimmy) * dt * Math.min(1, Math.abs(vehicle.speed) / 7);
    }

    const preImpactSpeed = vehicle.speed;
    const absPreImpactSpeed = Math.abs(preImpactSpeed);
    const fwdX = -Math.sin(vehicle.yaw);
    const fwdZ = -Math.cos(vehicle.yaw);
    const nextX = THREE.MathUtils.clamp(vehicle.position.x + fwdX * vehicle.speed * dt, mapBounds.minX, mapBounds.maxX);
    const nextZ = THREE.MathUtils.clamp(vehicle.position.z + fwdZ * vehicle.speed * dt, mapBounds.minZ, mapBounds.maxZ);

    let finalX = nextX;
    let finalZ = nextZ;
    const isTwoWheeler = vehicle.kind === 'digital_bike' || vehicle.kind === 'electric_scooter' || vehicle.kind === 'future_bike';
    const radius = vehicle.kind === 'electric_scooter' ? 0.55 : (vehicle.kind === 'digital_bike' || vehicle.kind === 'future_bike') ? 0.85 : Math.max(1.38, spec.bodyW * 0.74);
    const curGy = groundHeightAt(finalX, finalZ, vehicle.position.y);
    let hitNormalX = -fwdX;
    let hitNormalZ = -fwdZ;

    const boxRes = { x: finalX, z: finalZ, hitNormalX: -fwdX, hitNormalZ: -fwdZ, collided: false };
    const resolveStaticBox = (c: ColliderBox) => {
      if (resolveVehicleBoxCollider(finalX, finalZ, curGy, radius, 2.2, c, boxRes)) {
        finalX = boxRes.x;
        finalZ = boxRes.z;
        hitNormalX = boxRes.hitNormalX;
        hitNormalZ = boxRes.hitNormalZ;
        _scratchStepResult.collided = true;
        vehicle.speed *= 0.4;
      }
    };

    if (colliderGrid) {
      forEachColliderInBounds(
        colliderGrid,
        finalX - radius - 1,
        finalZ - radius - 1,
        finalX + radius + 1,
        finalZ + radius + 1,
        (idx) => resolveStaticBox(colliders[idx]),
      );
    } else {
      for (let i = 0; i < colliders.length; i++) {
        resolveStaticBox(colliders[i]);
      }
    }
    for (let i = 0; i < dynamicColliders.length; i++) {
      resolveStaticBox(dynamicColliders[i]);
    }

    if (extraColliders.length > 0) {
      const preExtraX = finalX;
      const preExtraZ = finalZ;
      const vehRes = resolveCircleColliders2D(finalX, vehicle.position.y, finalZ, radius, 2.0, extraColliders);
      if (vehRes.collided) {
        finalX = vehRes.x;
        finalZ = vehRes.z;
        const dx = finalX - preExtraX;
        const dz = finalZ - preExtraZ;
        const dLen = Math.hypot(dx, dz);
        if (dLen > 0.001) {
          hitNormalX = dx / dLen;
          hitNormalZ = dz / dLen;
        }
        _scratchStepResult.collided = true;
        vehicle.speed *= 0.45;
      }
    }

    const rawNextY = getSurfaceAlignedGroundY(
      finalX,
      finalZ,
      groundHeightAt(finalX, finalZ, vehicle.position.y),
    );
    const nextY = rawNextY - Math.min(0.12, puncturedCount * 0.045);
    if (rawNextY < -2.35) {
      vehicle.speed *= 0.9;
    }

    vehicle.position.set(finalX, nextY, finalZ);

    // Trigger one-shot 3-stage vertex deformation + hood latch failure on significant collision (>= 5 m/s)
    if (_scratchStepResult.collided && absPreImpactSpeed >= 5.0) {
      _scratchStepResult.impactSpeedMs = absPreImpactSpeed;
      _scratchImpactPt.set(
        finalX - hitNormalX * (radius * 0.92),
        nextY + (isTwoWheeler ? 0.58 : 0.72),
        finalZ - hitNormalZ * (radius * 0.92),
      );
      _scratchStepResult.impactPoint.copy(_scratchImpactPt);
      _scratchStepResult.impactNormal.set(hitNormalX, 0, hitNormalZ);

      // Inward crush direction pushes bumper & hood vertices inward toward chassis
      _scratchImpactDir.set(hitNormalX, 0.14, hitNormalZ).normalize();
      _scratchVelWorld.set(fwdX * preImpactSpeed, 0, fwdZ * preImpactSpeed);

      if (!isTwoWheeler) {
        const crashRes = applyVehicleCrashImpact(
          vehicle.crashState,
          _scratchImpactPt,
          _scratchImpactDir,
          absPreImpactSpeed,
          _scratchVelWorld,
          this.detachedHoodPool,
        );
        _scratchStepResult.crashSummary = crashRes;
        if (crashRes.shatterWindshield && vehicle.glassPanes.length > 0) {
          this.hitVehiclePart(vehicle, vehicle.glassPanes[0].mesh, 38);
        }
        vehicle.pitch = THREE.MathUtils.clamp(vehicle.pitch - 0.09, -0.25, 0.25);
        vehicle.hp = Math.max(25, vehicle.hp - Math.round(absPreImpactSpeed * 1.35));
      } else {
        vehicle.hp = Math.max(20, vehicle.hp - Math.round(absPreImpactSpeed * 1.15));
      }
    }

    const hFwd = groundHeightAt(finalX + fwdX * 1.4, finalZ + fwdZ * 1.4, nextY);
    const hBack = groundHeightAt(finalX - fwdX * 1.4, finalZ - fwdZ * 1.4, nextY);
    const slopePitch = Math.atan2(hFwd - hBack, 2.8);
    const flatRollBias = (rightPunctures - leftPunctures) * 0.045;
    vehicle.pitch = THREE.MathUtils.lerp(vehicle.pitch, slopePitch, Math.min(1, dt * 8));
    vehicle.roll = THREE.MathUtils.lerp(
      vehicle.roll,
      (isTwoWheeler ? 0 : -input.steer * steerAuthority * 0.09) + flatRollBias,
      Math.min(1, dt * 8),
    );

    if (isTwoWheeler) {
      const speedNormBike = Math.min(1, Math.abs(vehicle.speed) / 14);
      const targetSteer = -input.steer * (vehicle.kind === 'electric_scooter' ? 0.42 : 0.36);
      const targetLean = -input.steer * (vehicle.kind === 'electric_scooter' ? 0.08 + speedNormBike * 0.14 : 0.14 + speedNormBike * 0.24);
      vehicle.bikeSteer = THREE.MathUtils.lerp(vehicle.bikeSteer ?? 0, targetSteer, Math.min(1, dt * 10));
      vehicle.bikeLean = THREE.MathUtils.lerp(vehicle.bikeLean ?? 0, targetLean, Math.min(1, dt * 9));
      if (vehicle.steerPivot) vehicle.steerPivot.rotation.y = vehicle.bikeSteer;
      if (vehicle.leanGroup) vehicle.leanGroup.rotation.z = vehicle.bikeLean;
    } else {
      if (vehicle.steerPivot) {
        vehicle.steerPivot.rotation.z = THREE.MathUtils.lerp(
          vehicle.steerPivot.rotation.z,
          -input.steer * 0.72,
          Math.min(1, dt * 11),
        );
      }
      if (vehicle.frontWheelSteerPivots && vehicle.frontWheelSteerPivots.length > 0) {
        const targetFrontSteer = -input.steer * 0.42;
        const steerStep = Math.min(1, dt * 11);
        for (let fi = 0; fi < vehicle.frontWheelSteerPivots.length; fi++) {
          const fp = vehicle.frontWheelSteerPivots[fi];
          fp.rotation.y = THREE.MathUtils.lerp(fp.rotation.y, targetFrontSteer, steerStep);
        }
      }
      stepVehicleLeftDoor(vehicle, dt, Math.abs(vehicle.speed) > 1.2 ? 1.55 : 0.95);
      stepVehicleCrashPhysics(vehicle.crashState, vehicle.speed, dt, elapsedSec);
    }

    if (vehicle.dashEntry) {
      vehicle.dashEntry.liveValue = vehicle.speed * 3.6;
      vehicle.dashEntry.hpValue = Math.max(0, Math.round(vehicle.hp));
      vehicle.dashEntry.maxHpValue = vehicle.maxHp;
    }

    if (vehicle.hoverThrusters && vehicle.hoverThrusters.length > 0) {
      const pulse = 0.85 + Math.sin((elapsedSec ?? 0) * 18) * 0.22;
      for (let ti = 0; ti < vehicle.hoverThrusters.length; ti++) {
        vehicle.hoverThrusters[ti].scale.set(1, pulse, 1);
      }
    }

    const wheelSpinMul =
      vehicle.kind === 'electric_scooter'
        ? 4.4
        : vehicle.kind === 'digital_bike' || vehicle.kind === 'future_bike'
          ? 2.4
          : 2.2;
    for (let wi = 0; wi < vehicle.wheels.length; wi++) {
      vehicle.wheels[wi].rotation.x -= vehicle.speed * dt * wheelSpinMul;
    }

    vehicle.group.position.copy(vehicle.position);
    vehicle.group.rotation.order = 'YXZ';
    vehicle.group.rotation.y = vehicle.yaw;
    vehicle.group.rotation.x = vehicle.pitch;
    vehicle.group.rotation.z = vehicle.roll;

    return _scratchStepResult;
  }

  public updateDisplaysAudio(
    listenerPos: { x: number; y: number; z: number },
    activeVehicleId: string | null,
    globalMuted: boolean,
  ) {
    this.displays.updateSpatialAudio(listenerPos, activeVehicleId, globalMuted);
  }

  public updateAmbient(
    dt: number,
    localDrivenId: string | null,
    elapsedSec = 0,
    groundHeightAt?: (x: number, z: number, curY?: number) => number,
    colliders?: ColliderBox[],
    mapBounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
    extraColliders: readonly SimColliderBox[] = [],
    colliderGrid?: ColliderSpatialGrid | null,
    cameraPos?: THREE.Vector3 | null,
    maxVisibleDist = 420,
    dynamicColliders: readonly ColliderBox[] = [],
    graphicsQuality: GraphicsQuality = 'high',
  ) {
    const perfScale =
      graphicsQuality === 'low' ? 2.6 : graphicsQuality === 'medium' ? 1.8 : this.isSoftwareGl ? 1.5 : 1;
    this.displays.update(elapsedSec, dt, cameraPos, localDrivenId, perfScale, graphicsQuality);
    if (groundHeightAt) {
      this.detachedHoodPool.step(dt, groundHeightAt);
    }
    const maxVisDistSq = maxVisibleDist * maxVisibleDist;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v.id === localDrivenId) {
        v.group.visible = true;
        continue;
      }

      const isMovingOrAirborne =
        (!v.destroyed && Math.abs(v.speed) > 0.12) ||
        Math.abs(v.vertVel) > 0.05 ||
        (v.spec.isHelicopter && v.mansionState.rotorRpm > 0.01);

      if (cameraPos && !isMovingOrAirborne) {
        const dx = v.position.x - cameraPos.x;
        const dz = v.position.z - cameraPos.z;
        const inRange = dx * dx + dz * dz <= maxVisDistSq;
        v.group.visible = inRange;
        if (!inRange) {
          continue;
        }
      } else {
        v.group.visible = true;
      }

      let isCoasting = false;
      if (!v.destroyed && Math.abs(v.speed) > 0.12 && groundHeightAt) {
        isCoasting = true;
        const preSpeed = v.speed;
        const fwdX = -Math.sin(v.yaw);
        const fwdZ = -Math.cos(v.yaw);
        let finalX = v.position.x + fwdX * v.speed * dt;
        let finalZ = v.position.z + fwdZ * v.speed * dt;
        if (mapBounds) {
          finalX = THREE.MathUtils.clamp(finalX, mapBounds.minX, mapBounds.maxX);
          finalZ = THREE.MathUtils.clamp(finalZ, mapBounds.minZ, mapBounds.maxZ);
        }

        const radius =
          v.kind === 'electric_scooter' ? 0.55 : v.kind === 'digital_bike' ? 0.85 : Math.max(1.38, v.spec.bodyW * 0.74);
        const curGy = groundHeightAt(finalX, finalZ, v.position.y);
        let collided = false;
        let hitNormalX = -fwdX;
        let hitNormalZ = -fwdZ;

        const boxRes = { x: finalX, z: finalZ, hitNormalX: -fwdX, hitNormalZ: -fwdZ, collided: false };
        const resolveBox = (c: ColliderBox) => {
          if (resolveVehicleBoxCollider(finalX, finalZ, curGy, radius, 2.2, c, boxRes)) {
            finalX = boxRes.x;
            finalZ = boxRes.z;
            hitNormalX = boxRes.hitNormalX;
            hitNormalZ = boxRes.hitNormalZ;
            collided = true;
          }
        };

        if (colliders) {
          if (colliderGrid) {
            forEachColliderInBounds(
              colliderGrid,
              finalX - radius - 1,
              finalZ - radius - 1,
              finalX + radius + 1,
              finalZ + radius + 1,
              (idx) => resolveBox(colliders[idx]),
            );
          } else {
            for (let ci = 0; ci < colliders.length; ci++) {
              resolveBox(colliders[ci]);
            }
          }
        }
        for (let di = 0; di < dynamicColliders.length; di++) {
          resolveBox(dynamicColliders[di]);
        }

        if (extraColliders.length > 0) {
          const vehRes = resolveCircleColliders2D(finalX, v.position.y, finalZ, radius, 2.0, extraColliders);
          if (vehRes.collided) {
            finalX = vehRes.x;
            finalZ = vehRes.z;
            collided = true;
          }
        }

        const nextY = getSurfaceAlignedGroundY(
          finalX,
          finalZ,
          groundHeightAt(finalX, finalZ, v.position.y),
        );
        v.position.set(finalX, nextY, finalZ);
        const hFwd = groundHeightAt(finalX + fwdX * 1.4, finalZ + fwdZ * 1.4, nextY);
        const hBack = groundHeightAt(finalX - fwdX * 1.4, finalZ - fwdZ * 1.4, nextY);
        v.pitch = THREE.MathUtils.lerp(v.pitch, Math.atan2(hFwd - hBack, 2.8), Math.min(1, dt * 8));

        const spinFactor = v.kind === 'electric_scooter' ? 4.4 : v.kind === 'digital_bike' ? 2.4 : 2.2;
        for (let wi = 0; wi < v.wheels.length; wi++) {
          v.wheels[wi].rotation.x -= v.speed * dt * spinFactor;
        }

        if (collided) {
          const absImpact = Math.abs(preSpeed);
          v.speed *= 0.32;
          if (absImpact >= 5.0 && v.kind !== 'digital_bike' && v.kind !== 'electric_scooter') {
            _scratchImpactPt.set(finalX - hitNormalX * radius, nextY + 0.72, finalZ - hitNormalZ * radius);
            _scratchImpactDir.set(hitNormalX, 0.14, hitNormalZ).normalize();
            this.applyDamageImpact(v, _scratchImpactPt, _scratchImpactDir, absImpact);
          }
        } else {
          v.speed *= Math.exp(-0.82 * dt);
        }
        if (Math.abs(v.speed) <= 0.14) v.speed = 0;
      }

      if (v.spec.isHelicopter) {
        v.mansionState.rotorRpm = Math.max(0, v.mansionState.rotorRpm - dt * 0.38);
        if (v.mainRotor && v.mansionState.rotorRpm > 0.01) {
          v.mainRotor.rotation.y += dt * v.mansionState.rotorRpm * 24;
        }
        if (v.auxRotors && v.auxRotors.length > 0 && v.mansionState.rotorRpm > 0.01) {
          const spin = dt * v.mansionState.rotorRpm * 26;
          for (let ai = 0; ai < v.auxRotors.length; ai++) {
            v.auxRotors[ai].rotation.y += ai % 2 === 0 ? spin : -spin;
          }
        }
        if (v.tailRotor && v.mansionState.rotorRpm > 0.01) {
          v.tailRotor.rotation.x += dt * v.mansionState.rotorRpm * 28;
        }
        if (groundHeightAt) {
          const padGy = getSurfaceAlignedGroundY(
            v.position.x,
            v.position.z,
            groundHeightAt(v.position.x, v.position.z, v.position.y),
          );
          if (v.position.y > padGy + 0.05) {
            v.vertVel = Math.max(-9.5, v.vertVel - 6.5 * dt);
            v.position.y = Math.max(padGy, v.position.y + v.vertVel * dt);
          } else {
            v.position.y = padGy;
            v.vertVel = 0;
            v.pitch = THREE.MathUtils.lerp(v.pitch, 0, Math.min(1, dt * 6));
            v.roll = THREE.MathUtils.lerp(v.roll, 0, Math.min(1, dt * 6));
          }
        }
      }

      stepMansionVisualMechanisms(v, dt, elapsedSec);
      if ((v.kind === 'digital_bike' || v.kind === 'electric_scooter' || v.kind === 'future_bike') && v.leanGroup && !v.driverId) {
        const targetLean = v.kind === 'electric_scooter' ? 0.02 : Math.abs(v.speed) > 1.0 ? 0.04 : 0.08;
        v.leanGroup.rotation.z = THREE.MathUtils.lerp(v.leanGroup.rotation.z, targetLean, Math.min(1, dt * 4));
      }
      stepVehicleLeftDoor(v, dt, 0.92);
      stepVehicleCrashPhysics(v.crashState, v.speed, dt, elapsedSec);
      if (isCoasting) {
        v.group.position.copy(v.position);
      } else {
        v.group.position.lerp(v.position, Math.min(1, dt * 14));
      }
      v.group.rotation.order = 'YXZ';
      v.group.rotation.y = v.yaw;
      v.group.rotation.x = v.pitch;
      v.group.rotation.z = v.roll;
    }
  }

  public markDestroyed(v: VehicleActor, groundHeightAt?: (x: number, z: number) => number) {
    if (v.destroyed) return;
    v.destroyed = true;
    v.hp = 0;
    v.speed = 0;
    v.vertVel = 0;
    v.driverId = null;

    if (groundHeightAt) {
      const gy = groundHeightAt(v.position.x, v.position.z);
      if (v.position.y > gy + 0.15) {
        v.position.y = gy;
      }
    }
    v.roll = 0.07;
    v.pitch = -0.05;
    v.group.position.copy(v.position);
    v.group.rotation.order = 'YXZ';
    v.group.rotation.y = v.yaw;
    v.group.rotation.x = v.pitch;
    v.group.rotation.z = v.roll;

    const charredMat = new THREE.MeshStandardMaterial({
      color: 0x1c1e22,
      roughness: 0.94,
      metalness: 0.18,
    });
    v.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = charredMat;
      }
    });
  }

  public findNearestMansionRemoteTarget(playerPos: THREE.Vector3, maxDist = 8.5): VehicleActor | null {
    let best: VehicleActor | null = null;
    let bestDist = maxDist;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      const d = Math.hypot(v.position.x - playerPos.x, v.position.z - playerPos.z);
      if (Math.abs(v.position.y - playerPos.y) > 4.5) continue;
      if (canShowCarRemote(v.mansionState, v.driverId !== null, v.destroyed, d, bestDist)) {
        best = v;
        bestDist = d;
      }
    }
    return best;
  }

  public buildHudState(
    activeVehicle: VehicleActor | null,
    playerPos: THREE.Vector3,
    groundHeightAt: (x: number, z: number, curY?: number) => number,
    cameraMode: VehicleCameraMode = 'outer',
    blockedReason?: string | null,
  ): VehicleHudState {
    if (activeVehicle) {
      const gy = groundHeightAt(activeVehicle.position.x, activeVehicle.position.z, activeVehicle.position.y);
      const speedKmh = Math.round(Math.abs(activeVehicle.speed) * 3.6);
      const gear =
        activeVehicle.speed < -0.35
          ? 'R'
          : Math.abs(activeVehicle.speed) <= 0.35
            ? 'N'
            : speedKmh < 24
              ? '1'
              : speedKmh < 48
                ? '2'
                : speedKmh < 78
                  ? '3'
                  : speedKmh < 110
                    ? '4'
                    : '5';
      const ms = activeVehicle.mansionState;
      return {
        inVehicle: true,
        vehicleId: activeVehicle.id,
        vehicleKind: activeVehicle.kind,
        vehicleName: activeVehicle.spec.name,
        speedKmh,
        gear,
        health: Math.max(0, Math.round(activeVehicle.hp)),
        maxHealth: activeVehicle.maxHp,
        altitude: Math.max(0, Math.round(activeVehicle.position.y - gy)),
        crashStage: activeVehicle.crashState?.stage ?? 0,
        cameraMode,
        nearbyVehicleId: null,
        nearbyVehicleName: null,
        nearbyVehicleKind: null,
        nearbyHijackVehicle: null,
        hasMountedGun: Boolean(activeVehicle.turretGroup),
        mansion: ms.isMansionExclusive
          ? {
              nearbyRemote: null,
              active: {
                isMansionExclusive: ms.isMansionExclusive,
                isHelicopter: ms.isHelicopter,
                locked: ms.locked,
                engineRunning: ms.engineRunning,
                cranking: ms.engineStartTimer > 0,
                doorsOpen: ms.doorTargetL > 0.5 || ms.doorOpenL > 0.5,
                windowOpenFL: ms.windowTargetFL,
                windowOpenFR: ms.windowTargetFR,
                windowOpenRL: ms.windowTargetRL,
                windowOpenRR: ms.windowTargetRR,
                headlightsOn: ms.headlightsOn,
                rotorRpm: ms.rotorRpm,
              },
              blockedReason: blockedReason ?? null,
            }
          : undefined,
      };
    }

    const nearby = this.findNearestAvailable(playerPos, 5.6);
    const remoteTarget = this.findNearestMansionRemoteTarget(playerPos, 8.5);
    return {
      inVehicle: false,
      vehicleId: null,
      vehicleKind: null,
      vehicleName: null,
      speedKmh: 0,
      gear: 'N',
      health: 0,
      maxHealth: 0,
      altitude: 0,
      crashStage: 0,
      cameraMode,
      nearbyVehicleId: nearby?.id ?? null,
      nearbyVehicleName: nearby?.spec.name ?? null,
      nearbyVehicleKind: nearby?.kind ?? null,
      nearbyHijackVehicle: null,
      hasMountedGun: false,
      mansion:
        remoteTarget || blockedReason
          ? {
              nearbyRemote: remoteTarget
                ? {
                    vehicleId: remoteTarget.id,
                    vehicleName: remoteTarget.spec.name,
                    locked: remoteTarget.mansionState.locked,
                    doorsOpen: remoteTarget.mansionState.doorTargetL > 0.5,
                    distanceMeters: Number(
                      Math.hypot(
                        remoteTarget.position.x - playerPos.x,
                        remoteTarget.position.z - playerPos.z,
                      ).toFixed(1),
                    ),
                  }
                : null,
              active: null,
              blockedReason: blockedReason ?? null,
            }
          : undefined,
    };
  }
}

