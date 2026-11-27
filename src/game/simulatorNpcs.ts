import * as THREE from 'three';
import type { BikeStyleId, NearbyHijackVehicleInfo, TimeOfDayPhase, VehicleKind, WeaponId } from '../types';
import {
  buildOrientedBoxCollider,
  type ColliderSpatialGrid,
  computeDailyRoutineGoal,
  computeHotelDoorwayWaypoint,
  computeMallMultiFloorWaypoint,
  computeObstacleAvoidanceDir,
  computeTrafficSignalState,
  createColliderSpatialGrid,
  createGangSquads,
  createVehicleRefuelTracker,
  type DiningSeatSlot,
  type ElevatorState,
  GANG_BOSS_CATALOG,
  type GangBossStyleId,
  type GangMemberState,
  type GangSquadState,
  type MallNavSpec,
  NPC_ROLE_CATALOG,
  type NpcRoleId,
  type NpcRoleSpec,
  pickRespawnPosition,
  provokeGangSquad,
  resolveCircleColliders2D,
  resolveCircleColliders2DGrid,
  shouldPedestrianWaitAtCrosswalk,
  shouldVehicleStopAtSignal,
  type SimColliderBox,
  stepGangMemberDecision,
  stepVehicleRefuelState,
  TableReservationSystem,
  type VehicleRefuelTracker,
} from './simulatorSystems';
import { HOSPITAL_ELEVATOR_INFO } from './newCityDistrict';
import { type CompiledPropMats, createPropPbrMaterials, PropMeshAssembler } from './urbanProps';
import { buildAk47RifleGroup, type MaterialLibrary } from './models';
import { getSharedCrackedGlassTexture, VEHICLE_SPECS, type VehicleGlassPane } from './vehicles';
import {
  getVehicleSurfaceOffsetY,
  MANSION_HELIPAD_2_COORDS,
  MANSION_ROOF_Y,
  shouldMansionNightGuestsAttend,
} from './mansionSystems';

export interface SignalVisualGroup {
  x: number;
  z: number;
  offsetSec: number;
  nsRed: THREE.MeshBasicMaterial;
  nsYellow: THREE.MeshBasicMaterial;
  nsGreen: THREE.MeshBasicMaterial;
  ewRed: THREE.MeshBasicMaterial;
  ewYellow: THREE.MeshBasicMaterial;
  ewGreen: THREE.MeshBasicMaterial;
}

export interface MallNavData {
  name: string;
  nav: MallNavSpec;
  elevatorState: ElevatorState;
  clothesSpots: Array<{ x: number; y: number; z: number }>;
  perfumeShoeSpots: Array<{ x: number; y: number; z: number }>;
  watchSpots: Array<{ x: number; y: number; z: number }>;
  cashierSpots: Array<{ x: number; y: number; z: number; yaw: number }>;
  foodCourtSpots: Array<{ x: number; y: number; z: number }>;
}

export interface MegaWorldEnvironmentData {
  colliders?: SimColliderBox[];
  seats: Omit<DiningSeatSlot, 'occupiedByNpcId' | 'eatRemainingSec' | 'lastVacatedAtSec'>[];
  hotFoodSpots: Array<{ x: number; y: number; z: number }>;
  houses: Array<{ x: number; z: number; doorX: number; doorZ: number }>;
  intersections: Array<{ x: number; z: number; offsetSec: number }>;
  signalVisuals: SignalVisualGroup[];
  busStops: Array<{ x: number; z: number }>;
  gasStations?: Array<{
    x: number;
    z: number;
    fuelBays: Array<{ x: number; z: number; yaw: number }>;
  }>;
  malls: MallNavData[];
  hotelCoords: {
    cx: number;
    cz: number;
    doorNorth?: { x: number; z: number };
    doorSouth?: { x: number; z: number };
    receptionSpots: Array<{ x: number; z: number; yaw: number }>;
    kitchenSpots: Array<{ x: number; z: number; yaw: number }>;
    cleanWaypoints: Array<{ x: number; z: number }>;
  };
  parkCoords: {
    cx: number;
    cz: number;
    benches: Array<{ x: number; z: number; yaw: number }>;
    playgroundSpots: Array<{ x: number; z: number }>;
    gymSpots: Array<{ x: number; z: number; mode: 'pushup' | 'jump' | 'stretch' }>;
    jogLoop: Array<{ x: number; z: number }>;
    cycleLoop: Array<{ x: number; z: number }>;
  };
  festivalCoords?: {
    stalls: Array<{ x: number; z: number }>;
    jokerSpots: Array<{ x: number; z: number }>;
    crowdSpots: Array<{ x: number; z: number }>;
  };
  stadiumCoords?: {
    cx: number;
    cz: number;
    ballMesh: THREE.Mesh;
    pitchSpots: Array<{ x: number; z: number }>;
    spectatorSeats: Array<{ x: number; y: number; z: number; yaw: number }>;
  };
  stationBenches?: Array<{ x: number; y: number; z: number; yaw: number }>;
  trainCarStates?: Array<{ x: number; y: number; z: number; yaw: number }>;
  mountainCamps?: Array<{
    x: number;
    z: number;
    seatSpots: Array<{ x: number; z: number; yaw: number }>;
  }>;
  powerPlantSpots?: Array<{ x: number; z: number }>;
  buildingResidentSpots?: Array<{ x: number; z: number }>;
  hospitalSpots?: Array<{ x: number; z: number }>;
  beachSpots?: Array<{ x: number; z: number }>;
  gangAnchors?: Array<{ name: string; x: number; z: number; bossId?: GangBossStyleId }>;
  farmPlots: Array<{ x: number; z: number }>;
  touristSpots: Array<{ x: number; z: number; lookAtX: number; lookAtZ: number }>;
  constructionSpots: Array<{ x: number; z: number }>;
  gardenSpots: Array<{ x: number; z: number }>;
  deliveryRoutes: Array<{ fromX: number; fromZ: number; toX: number; toZ: number }>;
  snowSlope: {
    lanes: Array<{ x: number; topZ: number; bottomZ: number }>;
    getHeight: (x: number, z: number) => number;
  };
  roadRectLoops: Array<{
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    clockwise: boolean;
  }>;
  eastRoadRectLoopStartIdx?: number;
  westRoadRectLoopStartIdx?: number;
  roadCircleLoops?: Array<{
    cx: number;
    cz: number;
    radius: number;
    clockwise: boolean;
  }>;
  castleFootGuards?: Array<{ x: number; z: number; patrolX: number; patrolZ: number }>;
  castleHorseGuards?: Array<{ waypoints: Array<{ x: number; z: number }>; horseColor: number }>;
  castleInteriorSpots?: Array<{ x: number; z: number; yaw: number }>;
  hospitalBeds?: Array<{ x: number; y: number; z: number; yaw: number }>;
  hospitalDoctorSpots?: Array<{ x: number; y: number; z: number }>;
  showroomSpots?: Array<{ x: number; z: number; yaw: number }>;
  beachLoungers?: Array<{ x: number; y: number; z: number; yaw: number }>;
  infinityPoolZone?: { minX: number; maxX: number; minZ: number; maxZ: number; y: number };
  mansionPartyZone?: { minX: number; maxX: number; minZ: number; maxZ: number; y: number; djX: number; djZ: number };
  eastCitizenSpots?: Array<{
    x: number;
    z: number;
    role: 'chinatown' | 'airport' | 'ring_park' | 'castle_villager';
  }>;
  westCitizenSpots?: Array<{
    x: number;
    z: number;
    role: 'spaceport' | 'biodome' | 'marina' | 'cyber_tokyo' | 'pyramid';
  }>;
  groundHeightAt: (x: number, z: number, currentY?: number) => number;
}

export interface GangFiredShot {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  damage: number;
  kind?: 'gang' | 'guard' | 'police_pistol' | 'convoy_ak47';
}

export type HitZone =
  | 'head'
  | 'chest'
  | 'abdomen'
  | 'back'
  | 'arm_left'
  | 'arm_right'
  | 'leg_left'
  | 'leg_right';
export type DeathActingStyle =
  | 'default'
  | 'sniper_headshot'
  | 'pistol_headshot'
  | 'shotgun_headshot'
  | 'rifle_headshot'
  | 'stagger_fall_back'
  | 'kneel_then_collapse'
  | 'faceplant_forward'
  | 'side_twist_crumple'
  | 'leg_sweep_fall'
  | 'crawl_struggle';

export type StaggerKind =
  | 'none'
  | 'leg_left'
  | 'leg_right'
  | 'arm_left'
  | 'arm_right'
  | 'abdomen'
  | 'chest'
  | 'back';

export function resolveDirectionalHitZone(
  rawZone: HitZone,
  actorYaw: number,
  bulletDirX: number,
  bulletDirZ: number,
  relHitY: number,
): HitZone {
  if (rawZone === 'chest' || rawZone === 'abdomen') {
    const fwdX = Math.sin(actorYaw);
    const fwdZ = Math.cos(actorYaw);
    const dot = fwdX * bulletDirX + fwdZ * bulletDirZ;
    // Positive dot means bullet travels in the same direction the actor faces -> hit from behind!
    if (dot > 0.25) return 'back';
    if (relHitY < 0.96) return 'abdomen';
    return 'chest';
  }
  return rawZone;
}

export interface SimulatorHitResult {
  hit: boolean;
  killed: boolean;
  isHead: boolean;
  hitZone?: HitZone;
  kind: 'npc' | 'gang' | 'police' | 'vehicle';
  label?: string;
  protectedBlocked?: boolean;
  partType?: 'body' | 'glass' | 'wheel';
  partResult?: 'cracked' | 'shattered' | 'punctured';
  isPoliceVehicle?: boolean;
}

type HumanoidSubMode =
  | 'walk'
  | 'sit'
  | 'eat'
  | 'serve'
  | 'exercise'
  | 'play'
  | 'photo'
  | 'water'
  | 'deliver'
  | 'snowboard'
  | 'joker'
  | 'football'
  | 'spectator'
  | 'train_passenger'
  | 'station_sitter'
  | 'camper'
  | 'power_worker'
  | 'resident'
  | 'festival'
  | 'east_citizen'
  | 'hospital_doctor'
  | 'hospital_patient'
  | 'showroom_customer'
  | 'pool_swimmer'
  | 'beach_sunbather'
  | 'party_dancer';

interface HumanoidNpc {
  id: number;
  spec: NpcRoleSpec;
  isProtectedChild: boolean;
  root: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  shirtMatCloned?: boolean;
  torsoMesh?: THREE.Mesh;
  leftArmMesh?: THREE.Mesh;
  rightArmMesh?: THREE.Mesh;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftKnee?: THREE.Object3D;
  rightKnee?: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftElbow?: THREE.Object3D;
  rightElbow?: THREE.Object3D;
  headPivot?: THREE.Group;
  neckStump?: THREE.Mesh;
  cameraFlashMesh: THREE.Mesh | null;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  moveSpeed: number;
  yaw: number;
  targetYaw: number;
  isWalkingNow: boolean;
  targetX: number;
  targetY: number;
  targetZ: number;
  homeX: number;
  homeZ: number;
  waitTimer: number;
  walkPhase: number;
  seated: boolean;
  activeSeat: DiningSeatSlot | null;
  groupPairAngle: number;
  waypointIndex: number;
  subMode: HumanoidSubMode;
  isSnowboarder?: boolean;
  snowLaneIdx?: number;
  snowZ?: number;
  snowSpeed?: number;
  isTrainPassenger?: boolean;
  trainCarIdx?: number;
  trainSeatLocalX?: number;
  trainSeatLocalZ?: number;
  isStadiumSpectator?: boolean;
  isFixedSit?: boolean;
  jokerAnchor?: { x: number; z: number };
  poolLaneAngle?: number;
  flashTimer: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  fallTimer: number;
  respawnTimer: number;
  hitFlashTimer: number;
  stuckTimer: number;
  lastProgressX: number;
  lastProgressZ: number;
  panicTimer?: number;
  staggerTimer?: number;
  staggerKind?: StaggerKind;
  limping?: boolean;
  deathStyle?: DeathActingStyle;
  deathDuration?: number;
  decapitated?: boolean;
  bloodEmitTimer?: number;
  hitDirX?: number;
  hitDirZ?: number;
  lastStepCycle?: number;
  heldPropObj?: THREE.Object3D | null;
  propDropped?: boolean;
}

interface GangMemberVisual {
  state: GangMemberState;
  squadIdx: number;
  root: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftKnee?: THREE.Object3D;
  rightKnee?: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftElbow?: THREE.Object3D;
  rightElbow?: THREE.Object3D;
  headPivot?: THREE.Group;
  neckStump?: THREE.Mesh;
  cigSmokeMesh: THREE.Mesh;
  walkPhase: number;
  fallTimer: number;
  hitFlashTimer: number;
  staggerTimer?: number;
  staggerKind?: StaggerKind;
  limping?: boolean;
  deathStyle?: DeathActingStyle;
  deathDuration?: number;
  decapitated?: boolean;
  bloodEmitTimer?: number;
  hitDirX?: number;
  hitDirZ?: number;
}

interface PoliceOfficerActor {
  id: number;
  carId: number;
  active: boolean;
  root: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftKnee?: THREE.Object3D;
  rightKnee?: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftElbow?: THREE.Object3D;
  rightElbow?: THREE.Object3D;
  headPivot?: THREE.Group;
  neckStump?: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  yaw: number;
  walkPhase: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  fireCooldown: number;
  fallTimer: number;
  hitFlashTimer: number;
  staggerTimer?: number;
  staggerKind?: StaggerKind;
  limping?: boolean;
  deathStyle?: DeathActingStyle;
  deathDuration?: number;
  decapitated?: boolean;
  bloodEmitTimer?: number;
  hitDirX?: number;
  hitDirZ?: number;
}

interface EjectedDriverActor {
  id: number;
  root: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vy: number;
  vz: number;
  rollAngle: number;
  stunTimer: number;
  fleeTimer: number;
  walkPhase: number;
}

interface AmbientRoadAgent {
  id: number;
  kind:
    | 'revuelto_red'
    | 'cyber_pickup'
    | 'stealth_hyper'
    | 'rolls_copper_gt'
    | 'cyber_gold'
    | 'vision_silver'
    | 'terzo_silver'
    | 'gullwing_coupe'
    | 'range_black_suv'
    | 'thar_black_4x4'
    | 'challenger_scissor'
    | 'lambo_blue_hyper'
    | 'police'
    | 'motorcycle'
    | 'sport_moto'
    | 'city_scooter'
    | 'bicycle';
  root: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheelSteerPivots?: THREE.Group[];
  steerAngle: number;
  prevYaw: number;
  wheelRadii: number[];
  wheelSides: number[];
  wheelBaseY: number[];
  puncturedWheels: boolean[];
  puncturedCount: number;
  glassPanes: VehicleGlassPane[];
  meshes: THREE.Mesh[];
  lightBarMeshes?: [THREE.Mesh, THREE.Mesh];
  doorPivotL?: THREE.Group;
  driverSeatGroup?: THREE.Group;
  originalMats: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  colW: number;
  colH: number;
  colD: number;
  loopIdx: number;
  circleLoopIdx?: number;
  circleAngle?: number;
  edge: 0 | 1 | 2 | 3; // 0: +X (minZ), 1: +Z (maxX), 2: -X (maxZ), 3: -Z (minX)
  x: number;
  z: number;
  yaw: number;
  speed: number;
  maxSpeed: number;
  baseMaxSpeed: number;
  stoppedAtSignal: boolean;
  refuel: VehicleRefuelTracker;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  respawnTimer: number;
  hideTimer: number;
  hitFlashTimer: number;
  hornCooldown: number;
  spawnX: number;
  spawnZ: number;
  spawnEdge: 0 | 1 | 2 | 3;
  policeMode?: 'patrol' | 'responding' | 'engaged';
  policeAlertTimer?: number;
  policeTargetX?: number;
  policeTargetZ?: number;
  sirenPulseTimer?: number;
  officersDeployed?: boolean;
  crashCooldown?: number;
  crashStallTimer?: number;
  crashSpinVel?: number;
}

interface RoyalCastleGuard {
  id: number;
  isMounted: boolean;
  root: THREE.Group;
  tunicMat: THREE.MeshStandardMaterial;
  riderLeftArm: THREE.Object3D;
  riderRightArm: THREE.Object3D;
  riderLeftLeg?: THREE.Object3D;
  riderRightLeg?: THREE.Object3D;
  horseLegs?: THREE.Group[];
  horseTail?: THREE.Mesh;
  waypoints: Array<{ x: number; z: number }>;
  wpIdx: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  walkPhase: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  hostile: boolean;
  alertTimer: number;
  fireCooldown: number;
  fallTimer: number;
  respawnTimer: number;
  hitFlashTimer: number;
  homeX: number;
  homeZ: number;
  escortOffset?: { fwd: number; side: number };
}

interface RoyalCarriageState {
  root: THREE.Group;
  horses: Array<{ legs: THREE.Group[]; tail: THREE.Mesh }>;
  wheels: THREE.Mesh[];
  route: Array<{ x: number; z: number; pauseSec?: number }>;
  routeIdx: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  waitTimer: number;
  trotPhase: number;
}

interface ConvoyVehicleUnit {
  id: number;
  role: 'police_moto' | 'escort_suv' | 'boss_hilux';
  root: THREE.Group;
  wheels: THREE.Mesh[];
  lightBarMeshes?: [THREE.Mesh, THREE.Mesh];
  hp: number;
  maxHp: number;
  destroyed: boolean;
  hitFlashTimer: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  leadOffset: number;
  lateralOffset: number;
}

interface ConvoyGuardUnit {
  id: number;
  role: 'pickup_guard' | 'police_biker' | 'suv_guard';
  vehicleIdx: number;
  localOffsetX: number;
  localOffsetY: number;
  localOffsetZ: number;
  root: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  headPivot: THREE.Group;
  walkPhase: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  fallTimer: number;
  deathDuration: number;
  deathStyle?: DeathActingStyle;
  staggerTimer?: number;
  staggerKind?: StaggerKind;
  limping?: boolean;
  hitDirX?: number;
  hitDirZ?: number;
  hitFlashTimer: number;
  fireCooldown: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

interface SteamPuff {
  mesh: THREE.Mesh;
  originX: number;
  originY: number;
  originZ: number;
  phase: number;
  speed: number;
}

interface SharedNpcGeos {
  torsoGeo: THREE.BoxGeometry;
  headGeo: THREE.BoxGeometry;
  limbGeo: THREE.BoxGeometry;
  sculptedTorsoGeo: THREE.CylinderGeometry;
  sculptedPelvisGeo: THREE.CylinderGeometry;
  sculptedHeadGeo: THREE.SphereGeometry;
  neckGeo: THREE.CylinderGeometry;
  sculptedArmGeo: THREE.CylinderGeometry;
  sculptedUpperArmGeo: THREE.CylinderGeometry;
  sculptedForearmGeo: THREE.CylinderGeometry;
  sculptedLegGeo: THREE.CylinderGeometry;
  sculptedThighGeo: THREE.CylinderGeometry;
  sculptedCalfGeo: THREE.CylinderGeometry;
  shoeGeo: THREE.BoxGeometry;
  handGeo: THREE.SphereGeometry;
  propGeo: THREE.BoxGeometry;
  boardGeo: THREE.BoxGeometry;
  flashGeo: THREE.SphereGeometry;
  smokeGeo: THREE.SphereGeometry;
  skinMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  shoeMat: THREE.MeshStandardMaterial;
  sunglassMat: THREE.MeshBasicMaterial;
  propGoldMat: THREE.MeshStandardMaterial;
  propWoodMat: THREE.MeshStandardMaterial;
  propSteelMat: THREE.MeshStandardMaterial;
  boardMat: THREE.MeshStandardMaterial;
  gunMetalMat: THREE.MeshStandardMaterial;
  cigPaperMat: THREE.MeshStandardMaterial;
  cigEmberMat: THREE.MeshBasicMaterial;
  cigSmokeMat: THREE.MeshBasicMaterial;
  jokerWhiteMat: THREE.MeshStandardMaterial;
  jokerNoseMat: THREE.MeshBasicMaterial;
  bloodStumpMat: THREE.MeshStandardMaterial;
  bloodDropMat: THREE.MeshBasicMaterial;
  neckStumpGeo: THREE.CylinderGeometry;
  bloodDropGeo: THREE.SphereGeometry;
  bloodPoolGeo: THREE.CylinderGeometry;
  matCache: Map<number, THREE.MeshStandardMaterial>;
  akPrototype: THREE.Group;
}

function selectDeathActingStyle(hitZone: HitZone, weaponId?: WeaponId, seed = 0): DeathActingStyle {
  if (hitZone === 'head') {
    if (weaponId === 'sniper') return 'sniper_headshot';
    if (weaponId === 'shotgun') return 'shotgun_headshot';
    if (weaponId === 'pistol') return 'pistol_headshot';
    return 'rifle_headshot';
  }
  const r = Math.abs(Math.sin(seed * 12.9898 + Date.now() * 0.0017)) % 1;
  if (hitZone === 'leg_left' || hitZone === 'leg_right') {
    return r < 0.52 ? 'leg_sweep_fall' : r < 0.82 ? 'kneel_then_collapse' : 'crawl_struggle';
  }
  if (hitZone === 'arm_left' || hitZone === 'arm_right') {
    return r < 0.58 ? 'side_twist_crumple' : 'stagger_fall_back';
  }
  if (hitZone === 'back') {
    return r < 0.65 ? 'faceplant_forward' : 'crawl_struggle';
  }
  if (hitZone === 'abdomen') {
    return r < 0.55 ? 'kneel_then_collapse' : 'crawl_struggle';
  }
  // Chest hit
  if (weaponId === 'shotgun') return 'stagger_fall_back';
  return r < 0.5 ? 'stagger_fall_back' : r < 0.8 ? 'kneel_then_collapse' : 'side_twist_crumple';
}

function animateHumanoidCollapse(
  root: THREE.Group,
  limbs: {
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
    headPivot?: THREE.Group;
    decapitated?: boolean;
  },
  baseX: number,
  baseY: number,
  baseZ: number,
  yaw: number,
  style: DeathActingStyle,
  fallTimer: number,
  totalDuration: number,
  hitDirX: number,
  hitDirZ: number,
  dt: number,
  colliders?: SimColliderBox[],
  groundHeightAt?: (x: number, z: number, currentY?: number) => number,
  colliderGrid?: ColliderSpatialGrid,
): void {
  const elapsedFall = Math.max(0, totalDuration - fallTimer);
  const p = Math.min(1, elapsedFall / 0.58);
  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);
  const dotFront = fwdX * hitDirX + fwdZ * hitDirZ;
  const sideCross = fwdX * hitDirZ - fwdZ * hitDirX;
  const fallPitchSign = dotFront < 0 ? -1 : 1;

  const placeBody = (dx: number, dy: number, dz: number) => {
    let tx = baseX + dx;
    let tz = baseZ + dz;
    if (colliderGrid) {
      const res = resolveCircleColliders2DGrid(tx, baseY, tz, 0.44, 1.4, colliderGrid);
      tx = res.x;
      tz = res.z;
    } else if (colliders && colliders.length > 0) {
      const res = resolveCircleColliders2D(tx, baseY, tz, 0.44, 1.4, colliders);
      tx = res.x;
      tz = res.z;
    }
    const gy = groundHeightAt ? groundHeightAt(tx, tz, baseY) : baseY;
    root.position.set(tx, gy + dy, tz);
  };

  if (limbs.decapitated) {
    root.rotation.order = 'YXZ';
    if (elapsedFall < 0.64) {
      // Video-matched decapitation reaction: headless body stands upright momentarily clutching/flailing arms while blood sprays up
      const shake = Math.sin(elapsedFall * 22);
      limbs.leftArm.rotation.set(-1.68 + shake * 0.25, 0, -0.35);
      limbs.rightArm.rotation.set(-1.58 - shake * 0.25, 0, 0.35);
      limbs.leftLeg.rotation.x = shake * 0.22;
      limbs.rightLeg.rotation.x = -shake * 0.22;
      root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, -0.1 + shake * 0.06, Math.min(1, dt * 14));
      root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, sideCross * 0.14, Math.min(1, dt * 12));
      placeBody(hitDirX * 0.18 * (elapsedFall / 0.64), 0, hitDirZ * 0.18 * (elapsedFall / 0.64));
      return;
    }
    const dropP = THREE.MathUtils.clamp((elapsedFall - 0.64) / 0.44, 0, 1);
    limbs.leftArm.rotation.set(-0.35 * (1 - dropP), 0, 0.62 * dropP);
    limbs.rightArm.rotation.set(-0.35 * (1 - dropP), 0, -0.62 * dropP);
    limbs.leftLeg.rotation.x = 0.2 * dropP;
    limbs.rightLeg.rotation.x = -0.25 * dropP;
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, fallPitchSign * Math.PI * 0.49 * dropP, Math.min(1, dt * 13));
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, sideCross * 0.32 * dropP, Math.min(1, dt * 10));
    placeBody(hitDirX * (0.18 + 0.42 * dropP), 0.16 * dropP, hitDirZ * (0.18 + 0.42 * dropP));
    return;
  }

  if (limbs.headPivot) {
    if (style === 'sniper_headshot') {
      limbs.headPivot.rotation.x = THREE.MathUtils.lerp(limbs.headPivot.rotation.x, -0.88 * fallPitchSign, Math.min(1, dt * 24));
      limbs.headPivot.rotation.z = THREE.MathUtils.lerp(limbs.headPivot.rotation.z, sideCross * 0.46, Math.min(1, dt * 20));
    } else if (style === 'pistol_headshot' || style === 'rifle_headshot') {
      limbs.headPivot.rotation.x = THREE.MathUtils.lerp(limbs.headPivot.rotation.x, -0.64 * fallPitchSign, Math.min(1, dt * 19));
      limbs.headPivot.rotation.z = THREE.MathUtils.lerp(limbs.headPivot.rotation.z, 0.48 * (sideCross >= 0 ? 1 : -1), Math.min(1, dt * 16));
    } else if (style === 'shotgun_headshot') {
      limbs.headPivot.rotation.x = THREE.MathUtils.lerp(limbs.headPivot.rotation.x, -0.92, Math.min(1, dt * 22));
    } else {
      limbs.headPivot.rotation.x = THREE.MathUtils.lerp(limbs.headPivot.rotation.x, 0.32 * fallPitchSign, Math.min(1, dt * 10));
    }
  }

  root.rotation.order = 'YXZ';

  if (style === 'pistol_headshot') {
    const buckle = Math.min(1, elapsedFall / 0.24);
    const collapse = THREE.MathUtils.clamp((elapsedFall - 0.18) / 0.38, 0, 1);
    limbs.leftLeg.rotation.x = -1.08 * buckle;
    limbs.rightLeg.rotation.x = 0.85 * buckle;
    limbs.leftArm.rotation.x = -0.35 + collapse * 0.55;
    limbs.rightArm.rotation.x = -0.45 + collapse * 0.58;
    limbs.leftArm.rotation.z = 0.58 * collapse;
    limbs.rightArm.rotation.z = -0.58 * collapse;
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, fallPitchSign * Math.PI * 0.48 * collapse, Math.min(1, dt * 12));
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, sideCross * 0.38 * collapse, Math.min(1, dt * 10));
    placeBody(hitDirX * 0.25 * p, 0.16, hitDirZ * 0.25 * p);
    return;
  }

  if (style === 'sniper_headshot' || style === 'shotgun_headshot') {
    const kbDist = style === 'shotgun_headshot' ? 1.05 : 0.72;
    const archP = Math.sin(Math.min(1, elapsedFall / 0.34) * Math.PI) * 0.18;
    limbs.leftArm.rotation.x = -1.65 * p;
    limbs.rightArm.rotation.x = -1.48 * p;
    limbs.leftArm.rotation.z = 0.88 * p;
    limbs.rightArm.rotation.z = -0.88 * p;
    limbs.leftLeg.rotation.x = 0.4 * p;
    limbs.rightLeg.rotation.x = -0.48 * p;
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, fallPitchSign * Math.PI * 0.49, Math.min(1, dt * 14));
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, sideCross * 0.36, Math.min(1, dt * 11));
    placeBody(hitDirX * kbDist * p, 0.16 + archP, hitDirZ * kbDist * p);
    return;
  }

  if (style === 'stagger_fall_back') {
    // Stagger 2 steps clutching torso before pitching onto back
    const staggerP = Math.min(1, elapsedFall / 0.46);
    const drop = THREE.MathUtils.clamp((elapsedFall - 0.36) / 0.44, 0, 1);
    limbs.leftArm.rotation.x = -1.1 * (1 - drop * 0.5);
    limbs.rightArm.rotation.x = -1.15 * (1 - drop * 0.5);
    limbs.leftArm.rotation.z = -0.4 + 0.85 * drop;
    limbs.rightArm.rotation.z = 0.4 - 0.85 * drop;
    limbs.leftLeg.rotation.x = Math.sin(staggerP * Math.PI * 2.5) * 0.45 * (1 - drop);
    limbs.rightLeg.rotation.x = -Math.sin(staggerP * Math.PI * 2.5) * 0.45 * (1 - drop);
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, -Math.PI * 0.48 * drop - 0.14 * (1 - drop), Math.min(1, dt * 11));
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, sideCross * 0.28 * drop, Math.min(1, dt * 9));
    placeBody(hitDirX * (0.62 * staggerP + 0.25 * drop), 0.16, hitDirZ * (0.62 * staggerP + 0.25 * drop));
    return;
  }

  if (style === 'kneel_then_collapse') {
    // Drops onto knees grabbing abdomen/chest, pauses briefly, then falls over
    const kneel = Math.min(1, elapsedFall / 0.32);
    const fall = THREE.MathUtils.clamp((elapsedFall - 0.48) / 0.45, 0, 1);
    limbs.leftLeg.rotation.x = -1.35 * kneel;
    limbs.rightLeg.rotation.x = 0.5 * kneel;
    limbs.leftArm.rotation.x = -1.25 * kneel + fall * 0.65;
    limbs.rightArm.rotation.x = -1.25 * kneel + fall * 0.65;
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, 0.42 * kneel + Math.PI * 0.36 * fall, Math.min(1, dt * 10));
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, (sideCross >= 0 ? 1 : -1) * 0.55 * fall, Math.min(1, dt * 9));
    const kneelDropY = THREE.MathUtils.lerp(-0.34 * kneel, 0.16, fall);
    placeBody(hitDirX * (0.14 + 0.26 * fall), Math.max(0.14, kneelDropY), hitDirZ * (0.14 + 0.26 * fall));
    return;
  }

  if (style === 'faceplant_forward') {
    // Shot from behind or jolted forward face-first
    const snap = Math.min(1, elapsedFall / 0.42);
    limbs.leftArm.rotation.x = -1.75 * snap;
    limbs.rightArm.rotation.x = -1.55 * snap;
    limbs.leftLeg.rotation.x = 0.35 * snap;
    limbs.rightLeg.rotation.x = -0.25 * snap;
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, Math.PI * 0.49 * snap, Math.min(1, dt * 14));
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, sideCross * 0.22 * snap, Math.min(1, dt * 10));
    placeBody(hitDirX * 0.58 * snap, 0.16, hitDirZ * 0.58 * snap);
    return;
  }

  if (style === 'side_twist_crumple') {
    // Arm/shoulder hit twists torso sideways and spins slightly as NPC collapses
    const spin = (sideCross >= 0 ? 1 : -1) * 0.72 * p;
    limbs.leftArm.rotation.z = 0.95 * p;
    limbs.rightArm.rotation.z = -0.75 * p;
    limbs.leftLeg.rotation.x = -0.65 * p;
    limbs.rightLeg.rotation.x = 0.42 * p;
    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, yaw + spin, Math.min(1, dt * 10));
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, (sideCross >= 0 ? 1 : -1) * Math.PI * 0.47 * p, Math.min(1, dt * 11));
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, 0.24 * p, Math.min(1, dt * 9));
    placeBody(hitDirX * 0.32 * p, 0.16, hitDirZ * 0.32 * p);
    return;
  }

  if (style === 'leg_sweep_fall') {
    const kneel = Math.min(1, elapsedFall / 0.22);
    const fall = THREE.MathUtils.clamp((elapsedFall - 0.14) / 0.38, 0, 1);
    limbs.leftLeg.rotation.x = -1.28 * kneel;
    limbs.rightLeg.rotation.x = 0.48 * kneel;
    limbs.leftArm.rotation.z = 0.62 * fall;
    limbs.rightArm.rotation.z = -0.45 * fall;
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, (sideCross >= 0 ? 1 : -1) * Math.PI * 0.47 * fall, Math.min(1, dt * 12));
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, 0.28 * kneel + fall * 0.35, Math.min(1, dt * 9));
    placeBody(hitDirX * 0.22 * p, 0.16, hitDirZ * 0.22 * p);
    return;
  }

  if (style === 'crawl_struggle') {
    // Drops to knees and reaches forward briefly before going limp
    const drop = Math.min(1, elapsedFall / 0.35);
    const struggle = THREE.MathUtils.clamp((elapsedFall - 0.35) / 0.9, 0, 1);
    const limp = THREE.MathUtils.clamp((elapsedFall - 1.15) / 0.45, 0, 1);
    limbs.leftArm.rotation.x = -1.45 - Math.sin(struggle * 10) * 0.38 * (1 - limp);
    limbs.rightArm.rotation.x = -1.45 + Math.sin(struggle * 10) * 0.38 * (1 - limp);
    limbs.leftLeg.rotation.x = -1.1 * drop;
    limbs.rightLeg.rotation.x = -0.75 * drop;
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, Math.PI * (0.34 * drop + 0.15 * limp), Math.min(1, dt * 10));
    placeBody(hitDirX * (0.28 * drop + 0.35 * struggle), 0.18, hitDirZ * (0.28 * drop + 0.35 * struggle));
    return;
  }

  // Default / rifle headshot collapse
  limbs.leftArm.rotation.x = -0.48 * p;
  limbs.rightArm.rotation.x = -0.38 * p;
  limbs.leftArm.rotation.z = 0.48 * p;
  limbs.rightArm.rotation.z = -0.48 * p;
  root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, fallPitchSign * Math.PI * 0.49, Math.min(1, dt * 11));
  root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, sideCross * 0.28, Math.min(1, dt * 9));
  placeBody(hitDirX * 0.36 * p, 0.16, hitDirZ * 0.36 * p);
}

const _camCheckPos = new THREE.Vector3();
const _camFrustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _frustumSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);

function applyGtaWalkKinematics(
  limbs: {
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    leftKnee?: THREE.Object3D;
    rightKnee?: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
    leftElbow?: THREE.Object3D;
    rightElbow?: THREE.Object3D;
  },
  walkPhase: number,
  amp = 0.62,
  limping = false,
): void {
  const s = Math.sin(walkPhase);
  const c = Math.cos(walkPhase);
  const legAmp = limping ? amp * 0.56 : amp;
  limbs.leftLeg.rotation.x = limping ? Math.max(-0.24, s * legAmp * 0.6) : s * legAmp;
  limbs.rightLeg.rotation.x = -s * legAmp;
  if (limbs.leftKnee) {
    limbs.leftKnee.rotation.x = Math.max(0.06, c * 0.78);
  }
  if (limbs.rightKnee) {
    limbs.rightKnee.rotation.x = Math.max(0.06, -c * 0.78);
  }
  const armAmp = amp * 0.72;
  limbs.leftArm.rotation.x = limping ? -0.88 : -s * armAmp;
  limbs.rightArm.rotation.x = s * armAmp;
  if (limbs.leftElbow) {
    limbs.leftElbow.rotation.x = -0.22 - Math.max(0, -s) * 0.36;
  }
  if (limbs.rightElbow) {
    limbs.rightElbow.rotation.x = -0.22 - Math.max(0, s) * 0.36;
  }
}

function getCachedClothMat(
  cache: Map<number, THREE.MeshStandardMaterial>,
  colorHex: number,
  roughness: number,
  materialsOut: THREE.Material[],
): THREE.MeshStandardMaterial {
  const bucket = Math.round(roughness * 10);
  const key = colorHex * 16 + bucket;
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness });
    cache.set(key, mat);
    materialsOut.push(mat);
  }
  return mat;
}

type NpcVisualArchetype = 'standard' | 'fatty_man' | 'tourist_backpacker' | 'tourist_hiker';

function buildNpcMesh(
  npcId: number,
  spec: NpcRoleSpec,
  sharedGeo: SharedNpcGeos,
  opts: {
    isSnowboarder?: boolean;
    isJoker?: boolean;
    hasSunglasses?: boolean;
    isDoctor?: boolean;
    visualArchetype?: NpcVisualArchetype;
    heldCupHex?: number;
  } = {},
  shootableOut: THREE.Object3D[],
): {
  root: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  torsoMesh: THREE.Mesh;
  leftArmMesh: THREE.Mesh;
  rightArmMesh: THREE.Mesh;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftKnee: THREE.Object3D;
  rightKnee: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftElbow: THREE.Object3D;
  rightElbow: THREE.Object3D;
  headPivot: THREE.Group;
  neckStump: THREE.Mesh;
  cameraFlashMesh: THREE.Mesh | null;
  heldPropObj: THREE.Object3D | null;
  mats: THREE.Material[];
} {
  const mats: THREE.Material[] = [];
  const arch = opts.visualArchetype ?? 'standard';
  const isFatty = arch === 'fatty_man';
  const isTourist = arch === 'tourist_backpacker' || arch === 'tourist_hiker';
  const shirtHex = isFatty ? 0x2f5a3f : spec.shirtHex;
  const pantsHex = isFatty ? 0x8e724d : spec.pantsHex;
  const shirtMat = getCachedClothMat(sharedGeo.matCache, shirtHex, 0.72, mats);
  const pantsMat = getCachedClothMat(sharedGeo.matCache, pantsHex, 0.82, mats);
  const accentMat = getCachedClothMat(sharedGeo.matCache, spec.accentHex, 0.5, mats);

  const root = new THREE.Group();
  const s = spec.scale;
  const limbGirth = isFatty ? 1.38 : 1.0;

  // Articulated hip + knee legs + boots/sneakers
  const makeLeg = (hipX: number) => {
    const hip = new THREE.Group();
    hip.position.set(hipX * s * (isFatty ? 1.25 : 1.0), 0.72 * s, 0);
    const legMesh = new THREE.Mesh(sharedGeo.sculptedThighGeo, pantsMat);
    legMesh.scale.set(s * limbGirth, s, s * limbGirth);
    const knee = new THREE.Group();
    knee.position.set(0, -0.34 * s, 0);
    const calfMat = isFatty || isTourist
      ? (arch === 'tourist_backpacker' && npcId % 2 === 1 ? pantsMat : sharedGeo.skinMat)
      : pantsMat;
    const calfMesh = new THREE.Mesh(sharedGeo.sculptedCalfGeo, calfMat);
    calfMesh.scale.set(s * (isFatty ? 1.22 : 1.0), s, s * (isFatty ? 1.22 : 1.0));
    const shoeColorMat = isFatty || isTourist
      ? getCachedClothMat(sharedGeo.matCache, 0x6b442a, 0.78, mats)
      : sharedGeo.shoeMat;
    const shoe = new THREE.Mesh(sharedGeo.shoeGeo, shoeColorMat);
    shoe.position.set(0, -0.34 * s, 0.045 * s);
    shoe.scale.set(s * (isFatty ? 1.22 : 1.0), s, s * 1.08);
    knee.add(calfMesh, shoe);
    if (isFatty || isTourist) {
      const sockMat = getCachedClothMat(sharedGeo.matCache, isFatty ? 0x3f2d2a : 0xf1f5f9, 0.82, mats);
      const sock = new THREE.Mesh(sharedGeo.torsoGeo, sockMat);
      sock.position.set(0, -0.24 * s, 0);
      sock.scale.set(0.11 * s * limbGirth, 0.14 * s, 0.11 * s * limbGirth);
      knee.add(sock);
    }
    hip.add(legMesh, knee);
    return { hip, knee, legMesh };
  };
  const leftBuilt = makeLeg(-0.105);
  const rightBuilt = makeLeg(0.105);
  const leftLeg = leftBuilt.hip;
  const rightLeg = rightBuilt.hip;
  const leftKnee = leftBuilt.knee;
  const rightKnee = rightBuilt.knee;

  // Sculpted pelvis, tapered (or stout) torso, neck & rounded cranium
  const pelvis = new THREE.Mesh(sharedGeo.sculptedPelvisGeo, pantsMat);
  pelvis.position.set(0, 0.75 * s, 0);
  pelvis.scale.set(isFatty ? 1.48 * s : s, s, isFatty ? 1.38 * s : s);

  const torso = new THREE.Mesh(sharedGeo.sculptedTorsoGeo, shirtMat);
  torso.position.set(0, 1.06 * s, 0);
  torso.scale.set((isFatty ? 1.56 : 1.05) * s, s, (isFatty ? 1.58 : 0.92) * s);

  if (isFatty) {
    // Matching Fatty Man: round protruding belly, cream vest, brass buttons, burgundy ascot, belt & buckle
    const vestMat = getCachedClothMat(sharedGeo.matCache, 0xede5c9, 0.76, mats);
    const leatherMat = getCachedClothMat(sharedGeo.matCache, 0x5c361d, 0.65, mats);
    const ascotMat = getCachedClothMat(sharedGeo.matCache, 0x5c2b26, 0.74, mats);
    const belly = new THREE.Mesh(sharedGeo.sculptedHeadGeo, vestMat);
    belly.position.set(0, 0.99 * s, 0.08 * s);
    belly.scale.set(1.78 * s, 1.78 * s, 1.68 * s);
    const belt = new THREE.Mesh(sharedGeo.torsoGeo, leatherMat);
    belt.position.set(0, 0.81 * s, 0.04 * s);
    belt.scale.set(0.56 * s, 0.095 * s, 0.48 * s);
    const buckle = new THREE.Mesh(sharedGeo.torsoGeo, sharedGeo.propGoldMat);
    buckle.position.set(0, 0.81 * s, 0.29 * s);
    buckle.scale.set(0.12 * s, 0.1 * s, 0.04 * s);
    const ascot = new THREE.Mesh(sharedGeo.torsoGeo, ascotMat);
    ascot.position.set(0, 1.29 * s, 0.18 * s);
    ascot.scale.set(0.2 * s, 0.12 * s, 0.08 * s);
    root.add(belly, belt, buckle, ascot);
    for (let bi = 0; bi < 4; bi++) {
      const btn = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.propGoldMat);
      btn.position.set(0, (0.91 + bi * 0.09) * s, (0.295 - bi * 0.015) * s);
      btn.scale.setScalar(0.32 * s);
      root.add(btn);
    }
  } else if (isTourist) {
    // Detailed Multi-Pocket Hiking Backpack + Rolled Mat + Shoulder/Chest Harness + Waist Belt
    const isHiker = arch === 'tourist_hiker';
    const packMat = getCachedClothMat(sharedGeo.matCache, isHiker ? 0x4e6b58 : (npcId % 2 === 0 ? 0x3b6c88 : 0x2f5f72), 0.78, mats);
    const bedrollMat = getCachedClothMat(sharedGeo.matCache, isHiker ? 0x7fa394 : 0xe08238, 0.76, mats);
    const strapMat = getCachedClothMat(sharedGeo.matCache, isHiker ? 0x7c3f1d : 0x374151, 0.72, mats);
    const packMain = new THREE.Mesh(sharedGeo.torsoGeo, packMat);
    packMain.position.set(0, 1.12 * s, -0.24 * s);
    packMain.scale.set(0.38 * s, 0.56 * s, 0.24 * s);
    const packTop = new THREE.Mesh(sharedGeo.torsoGeo, bedrollMat);
    packTop.position.set(0, 1.44 * s, -0.24 * s);
    packTop.scale.set(0.42 * s, 0.16 * s, 0.18 * s);
    const sidePocket = new THREE.Mesh(sharedGeo.torsoGeo, bedrollMat);
    sidePocket.position.set(isHiker ? -0.22 * s : 0.22 * s, 1.06 * s, -0.24 * s);
    sidePocket.scale.set(0.1 * s, 0.34 * s, 0.16 * s);
    const strapL = new THREE.Mesh(sharedGeo.torsoGeo, strapMat);
    strapL.position.set(-0.12 * s, 1.12 * s, 0.02 * s);
    strapL.scale.set(0.06 * s, 0.44 * s, 0.32 * s);
    const strapR = new THREE.Mesh(sharedGeo.torsoGeo, strapMat);
    strapR.position.set(0.12 * s, 1.12 * s, 0.02 * s);
    strapR.scale.set(0.06 * s, 0.44 * s, 0.32 * s);
    const chestBuckle = new THREE.Mesh(sharedGeo.torsoGeo, sharedGeo.propSteelMat);
    chestBuckle.position.set(0, 1.14 * s, 0.165 * s);
    chestBuckle.scale.set(0.22 * s, 0.05 * s, 0.04 * s);
    const belt = new THREE.Mesh(sharedGeo.torsoGeo, strapMat);
    belt.position.set(0, 0.82 * s, 0);
    belt.scale.set(0.38 * s, 0.07 * s, 0.27 * s);
    root.add(packMain, packTop, sidePocket, strapL, strapR, chestBuckle, belt);
  }

  if (opts.isDoctor) {
    const steth = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    steth.position.set(0, 1.24 * s, 0.14 * s);
    steth.scale.set(0.24 * s, 0.18 * s, 0.05 * s);
    root.add(steth);
  }

  const neckY = 1.36 * s;
  const headPivot = new THREE.Group();
  headPivot.position.set(0, neckY, 0);

  const neck = new THREE.Mesh(sharedGeo.neckGeo, sharedGeo.skinMat);
  neck.position.set(0, 0, 0);
  neck.scale.set(s * (isFatty ? 1.3 : 1.0), s, s * (isFatty ? 1.3 : 1.0));

  const head = new THREE.Mesh(
    sharedGeo.sculptedHeadGeo,
    opts.isJoker ? sharedGeo.jokerWhiteMat : sharedGeo.skinMat,
  );
  head.position.set(0, 1.54 * s - neckY, 0);
  head.scale.set(s * (isFatty ? 1.16 : 1.0), 1.08 * s, (isFatty ? 1.14 : 1.02) * s);
  head.userData.isHead = true;
  headPivot.add(neck, head);

  if (opts.hasSunglasses || (isTourist && npcId % 2 === 0)) {
    const glasses = new THREE.Mesh(sharedGeo.torsoGeo, sharedGeo.sunglassMat);
    glasses.position.set(0, 1.56 * s - neckY, 0.145 * s);
    glasses.scale.set(0.26 * s, 0.068 * s, 0.05 * s);
    headPivot.add(glasses);
  }

  // Articulated shoulder + elbow arms + hands
  const makeArm = (shX: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(shX * s * (isFatty ? 1.42 : 1.0), 1.29 * s, 0);
    const armMesh = new THREE.Mesh(sharedGeo.sculptedUpperArmGeo, shirtMat);
    armMesh.scale.set(s * limbGirth, s, s * limbGirth);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28 * s, 0);
    const forearmMesh = new THREE.Mesh(
      sharedGeo.sculptedForearmGeo,
      isTourist ? sharedGeo.skinMat : shirtMat,
    );
    forearmMesh.scale.set(s * limbGirth, s, s * limbGirth);
    const hand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
    hand.position.set(0, -0.28 * s, 0);
    hand.scale.setScalar(s * (isFatty ? 1.16 : 1.0));
    elbow.add(forearmMesh, hand);
    shoulder.add(armMesh, elbow);
    return { shoulder, elbow, armMesh };
  };
  const leftArmBuilt = makeArm(-0.245);
  const rightArmBuilt = makeArm(0.245);
  const leftArm = leftArmBuilt.shoulder;
  const rightArm = rightArmBuilt.shoulder;
  const leftElbow = leftArmBuilt.elbow;
  const rightElbow = rightArmBuilt.elbow;
  const leftArmMesh = leftArmBuilt.armMesh;
  const rightArmMesh = rightArmBuilt.armMesh;

  const neckStump = new THREE.Mesh(sharedGeo.neckStumpGeo, sharedGeo.bloodStumpMat);
  neckStump.position.set(0, neckY, 0);
  neckStump.scale.setScalar(s);
  neckStump.visible = false;

  root.add(leftLeg, rightLeg, pelvis, torso, neckStump, headPivot, leftArm, rightArm);

  if (opts.isJoker) {
    const nose = new THREE.Mesh(sharedGeo.flashGeo, sharedGeo.jokerNoseMat);
    nose.position.set(0, 1.53 * s - neckY, 0.16 * s);
    nose.scale.setScalar(0.32 * s);
    const prongL = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    prongL.position.set(-0.13 * s, 1.8 * s - neckY, 0);
    prongL.rotation.z = 0.4;
    prongL.scale.set(0.12 * s, 0.32 * s, 0.12 * s);
    const prongR = new THREE.Mesh(sharedGeo.torsoGeo, shirtMat);
    prongR.position.set(0.13 * s, 1.8 * s - neckY, 0);
    prongR.rotation.z = -0.4;
    prongR.scale.set(0.12 * s, 0.32 * s, 0.12 * s);
    headPivot.add(nose, prongL, prongR);
  } else if (isFatty) {
    const beardMat = getCachedClothMat(sharedGeo.matCache, 0x5a3825, 0.85, mats);
    const capRedMat = getCachedClothMat(sharedGeo.matCache, 0x8c2f27, 0.78, mats);
    const beard = new THREE.Mesh(sharedGeo.sculptedHeadGeo, beardMat);
    beard.position.set(0, 1.44 * s - neckY, 0.11 * s);
    beard.scale.set(0.85 * s, 0.65 * s, 0.72 * s);
    const capGreen = new THREE.Mesh(sharedGeo.sculptedHeadGeo, shirtMat);
    capGreen.position.set(0, 1.66 * s - neckY, 0);
    capGreen.scale.set(1.22 * s, 0.62 * s, 1.22 * s);
    const capTop = new THREE.Mesh(sharedGeo.sculptedHeadGeo, capRedMat);
    capTop.position.set(0, 1.72 * s - neckY, -0.02 * s);
    capTop.scale.set(1.06 * s, 0.62 * s, 1.06 * s);
    headPivot.add(beard, capGreen, capTop);
  } else if (arch === 'tourist_hiker') {
    const hatMat = getCachedClothMat(sharedGeo.matCache, npcId % 2 === 0 ? 0xc4a97d : 0x7c5b3e, 0.82, mats);
    const brim = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
    brim.position.set(0, 1.66 * s - neckY, 0);
    brim.scale.set(0.56 * s, 0.04 * s, 0.56 * s);
    const crown = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
    crown.position.set(0, 1.74 * s - neckY, 0);
    crown.scale.set(0.32 * s, 0.14 * s, 0.34 * s);
    headPivot.add(brim, crown);
    if (npcId % 2 === 0) {
      const beard = new THREE.Mesh(sharedGeo.sculptedHeadGeo, sharedGeo.hairMat);
      beard.position.set(0, 1.44 * s - neckY, 0.1 * s);
      beard.scale.set(0.88 * s, 0.72 * s, 0.72 * s);
      headPivot.add(beard);
    }
  } else {
    const hairOrHat = new THREE.Mesh(
      spec.id === 'chef' || spec.id === 'construction_worker' || spec.id === 'traffic_police'
        ? sharedGeo.torsoGeo
        : sharedGeo.sculptedHeadGeo,
      spec.id === 'chef' || spec.id === 'construction_worker' || spec.id === 'traffic_police'
        ? accentMat
        : sharedGeo.hairMat,
    );
    if (spec.id === 'chef' || spec.id === 'construction_worker' || spec.id === 'traffic_police') {
      const hatH = spec.id === 'chef' ? 0.24 : 0.11;
      hairOrHat.position.set(0, (1.69 + hatH * 0.25) * s - neckY, 0);
      hairOrHat.scale.set(0.32 * s, hatH * s, 0.32 * s);
    } else {
      hairOrHat.position.set(0, 1.59 * s - neckY, -0.02 * s);
      hairOrHat.scale.set(1.04 * s, 0.85 * s, 1.06 * s);
    }
    headPivot.add(hairOrHat);
  }

  let cameraFlashMesh: THREE.Mesh | null = null;
  let heldPropObj: THREE.Object3D | null = null;

  if (spec.propKind === 'tray') {
    const trayGroup = new THREE.Group();
    const tray = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propSteelMat);
    tray.position.set(0, -0.26 * s, 0.22 * s);
    tray.scale.set(0.38 * s, 0.04 * s, 0.28 * s);
    const dish = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propGoldMat);
    dish.position.set(0, -0.21 * s, 0.22 * s);
    dish.scale.set(0.2 * s, 0.08 * s, 0.2 * s);
    trayGroup.add(tray, dish);
    rightElbow.add(trayGroup);
    heldPropObj = trayGroup;
  } else if (spec.propKind === 'bag') {
    const bag = new THREE.Mesh(sharedGeo.propGeo, accentMat);
    bag.position.set(0.05 * s, -0.34 * s, 0.04 * s);
    bag.scale.set(0.14 * s, 0.28 * s, 0.24 * s);
    rightElbow.add(bag);
    heldPropObj = bag;
  } else if (spec.propKind === 'parcel') {
    const parcel = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propWoodMat);
    parcel.position.set(0, 1.02 * s, 0.28 * s);
    parcel.scale.set(0.38 * s, 0.28 * s, 0.32 * s);
    root.add(parcel);
    heldPropObj = parcel;
  } else if (spec.propKind === 'watering_can') {
    const can = new THREE.Mesh(sharedGeo.propGeo, accentMat);
    can.position.set(0.04 * s, -0.28 * s, 0.14 * s);
    can.scale.set(0.18 * s, 0.22 * s, 0.26 * s);
    rightElbow.add(can);
    heldPropObj = can;
  } else if (spec.propKind === 'camera') {
    const cam = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propSteelMat);
    cam.position.set(0, 1.35 * s, 0.24 * s);
    cam.scale.set(0.18 * s, 0.12 * s, 0.12 * s);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
    mats.push(flashMat);
    cameraFlashMesh = new THREE.Mesh(sharedGeo.flashGeo, flashMat);
    cameraFlashMesh.position.set(0, 1.38 * s, 0.34 * s);
    cameraFlashMesh.visible = false;
    root.add(cam, cameraFlashMesh);
    heldPropObj = cam;
  } else if (spec.propKind === 'broom' || spec.propKind === 'baton' || spec.propKind === 'tool') {
    const stick = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propWoodMat);
    stick.position.set(0, -0.28 * s, 0.12 * s);
    stick.scale.set(0.05 * s, 0.85 * s, 0.05 * s);
    rightElbow.add(stick);
    heldPropObj = stick;
  }

  if (opts.heldCupHex !== undefined) {
    const cupGroup = new THREE.Group();
    const cupMat = getCachedClothMat(sharedGeo.matCache, opts.heldCupHex, 0.22, mats);
    const cupBody = new THREE.Mesh(sharedGeo.neckGeo, cupMat);
    cupBody.position.set(0.02 * s, -0.24 * s, 0.14 * s);
    cupBody.scale.set(0.72 * s, 0.96 * s, 0.72 * s);
    const straw = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propGoldMat);
    straw.position.set(0.02 * s, -0.16 * s, 0.15 * s);
    straw.rotation.z = 0.2;
    straw.scale.set(0.016 * s, 0.12 * s, 0.016 * s);
    cupGroup.add(cupBody, straw);
    rightElbow.add(cupGroup);
    heldPropObj = cupGroup;
  }

  if (opts.isSnowboarder) {
    const board = new THREE.Mesh(sharedGeo.boardGeo, sharedGeo.boardMat);
    board.position.set(0, 0.04, 0);
    board.rotation.y = 0.22;
    root.add(board);
  }

  leftBuilt.legMesh.userData.hitZone = 'leg_left';
  rightBuilt.legMesh.userData.hitZone = 'leg_right';
  pelvis.userData.hitZone = 'abdomen';
  torso.userData.hitZone = 'chest';
  head.userData.hitZone = 'head';
  leftArmMesh.userData.hitZone = 'arm_left';
  rightArmMesh.userData.hitZone = 'arm_right';

  const hitParts = [
    leftBuilt.legMesh,
    rightBuilt.legMesh,
    pelvis,
    torso,
    head,
    leftArmMesh,
    rightArmMesh,
  ];
  for (let i = 0; i < hitParts.length; i++) {
    hitParts[i].userData.simNpcId = npcId;
    shootableOut.push(hitParts[i]);
  }

  return {
    root,
    shirtMat,
    torsoMesh: torso,
    leftArmMesh,
    rightArmMesh,
    leftLeg,
    rightLeg,
    leftKnee,
    rightKnee,
    leftArm,
    rightArm,
    leftElbow,
    rightElbow,
    headPivot,
    neckStump,
    cameraFlashMesh,
    heldPropObj,
    mats,
  };
}

function buildGangMemberMesh(
  gangId: number,
  bossId: GangBossStyleId,
  role: GangMemberState['role'],
  memberId: number,
  sharedGeo: SharedNpcGeos,
  shootableOut: THREE.Object3D[],
): {
  root: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  headPivot: THREE.Group;
  neckStump: THREE.Mesh;
  cigSmokeMesh: THREE.Mesh;
  mats: THREE.Material[];
} {
  const bossSpec =
    GANG_BOSS_CATALOG.find((b) => b.id === bossId) ?? GANG_BOSS_CATALOG[gangId % GANG_BOSS_CATALOG.length];
  const isBoss = role === 'boss';
  const isEnforcer = role === 'enforcer';
  const s =
    bossId === 'spectre_crow' && isEnforcer
      ? 1.18
      : bossId === 'big_barnaby'
        ? isBoss
          ? 1.14
          : 1.06
        : isBoss
          ? 1.08
          : 1.0;

  const shirtMat = new THREE.MeshStandardMaterial({ color: bossSpec.suitHex, roughness: 0.62 });
  const innerShirtMat = new THREE.MeshStandardMaterial({ color: bossSpec.shirtHex, roughness: 0.72 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: bossSpec.accentHex,
    roughness: 0.42,
    metalness: bossId === 'emir_aurelius' ? 0.65 : 0.18,
  });
  const hatMat = new THREE.MeshStandardMaterial({ color: bossSpec.hatHex, roughness: 0.75 });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: bossId === 'big_barnaby' ? 0x292524 : 0x0b0f19,
    roughness: 0.85,
  });
  const maskWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
  const furGreyMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 });
  const visorMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const mats: THREE.Material[] = [
    shirtMat,
    innerShirtMat,
    accentMat,
    hatMat,
    pantsMat,
    maskWhiteMat,
    furGreyMat,
    visorMat,
  ];

  const root = new THREE.Group();

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11 * s, 0.72 * s, 0);
  const leftLegMesh = new THREE.Mesh(sharedGeo.sculptedLegGeo, pantsMat);
  leftLegMesh.scale.setScalar(s);
  const leftShoe = new THREE.Mesh(sharedGeo.shoeGeo, sharedGeo.shoeMat);
  leftShoe.position.set(0, -0.68 * s, 0.04 * s);
  leftShoe.scale.setScalar(s);
  leftLeg.add(leftLegMesh, leftShoe);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11 * s, 0.72 * s, 0);
  const rightLegMesh = new THREE.Mesh(sharedGeo.sculptedLegGeo, pantsMat);
  rightLegMesh.scale.setScalar(s);
  const rightShoe = new THREE.Mesh(sharedGeo.shoeGeo, sharedGeo.shoeMat);
  rightShoe.position.set(0, -0.68 * s, 0.04 * s);
  rightShoe.scale.setScalar(s);
  rightLeg.add(rightLegMesh, rightShoe);

  const pelvis = new THREE.Mesh(sharedGeo.sculptedPelvisGeo, pantsMat);
  pelvis.position.set(0, 0.75 * s, 0);
  pelvis.scale.setScalar(s);

  const torso = new THREE.Mesh(sharedGeo.sculptedTorsoGeo, shirtMat);
  torso.position.set(0, 1.07 * s, 0);
  torso.scale.set((bossId === 'big_barnaby' ? 1.2 : 1.08) * s, s * 1.04, s);

  const neck = new THREE.Mesh(sharedGeo.neckGeo, sharedGeo.skinMat);
  neck.position.set(0, 1.37 * s, 0);
  neck.scale.setScalar(s);

  // Inner dress shirt / vest triangle + tie or ornate chest trim
  const chestFront = new THREE.Mesh(sharedGeo.torsoGeo, innerShirtMat);
  chestFront.position.set(0, 1.13 * s, 0.15 * s);
  chestFront.scale.set(0.2 * s, 0.4 * s, 0.04 * s);
  const tieOrPlate = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
  tieOrPlate.position.set(0, 1.06 * s, 0.165 * s);
  tieOrPlate.scale.set(bossId === 'emir_aurelius' ? 0.34 * s : 0.08 * s, 0.36 * s, 0.04 * s);
  root.add(pelvis, chestFront, tieOrPlate);

  const headMat =
    bossId === 'don_crimson'
      ? accentMat
      : bossId === 'spectre_crow' && isEnforcer
        ? maskWhiteMat
        : bossId === 'baron_noir'
          ? hatMat
          : sharedGeo.skinMat;
  const head = new THREE.Mesh(sharedGeo.sculptedHeadGeo, headMat);
  head.position.set(0, 1.56 * s, 0);
  head.scale.set(s, 1.08 * s, 1.02 * s);
  head.userData.isHead = true;

  // Distinct Headgear, Masks, Beards & Archetype Coats
  if (bossId === 'don_crimson') {
    const stache = new THREE.Mesh(sharedGeo.torsoGeo, pantsMat);
    stache.position.set(0, 1.5 * s, 0.17 * s);
    stache.scale.set(0.18 * s, 0.04 * s, 0.04 * s);
    const shades = new THREE.Mesh(sharedGeo.torsoGeo, pantsMat);
    shades.position.set(0, 1.6 * s, 0.17 * s);
    shades.scale.set(0.26 * s, 0.07 * s, 0.05 * s);
    const brim = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
    brim.position.set(0, 1.72 * s, 0);
    brim.scale.set(0.56 * s, 0.05 * s, 0.56 * s);
    const crown = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
    crown.position.set(0, 1.81 * s, 0);
    crown.scale.set(0.34 * s, 0.16 * s, 0.34 * s);
    root.add(stache, shades, brim, crown);
  } else if (bossId === 'spectre_crow') {
    if (isEnforcer) {
      const cloak = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
      cloak.position.set(0, 0.98 * s, -0.04 * s);
      cloak.scale.set(0.54 * s, 0.96 * s, 0.32 * s);
      const hood = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
      hood.position.set(0, 1.64 * s, -0.04 * s);
      hood.scale.set(0.4 * s, 0.4 * s, 0.34 * s);
      const eyes = new THREE.Mesh(sharedGeo.torsoGeo, pantsMat);
      eyes.position.set(0, 1.59 * s, 0.17 * s);
      eyes.scale.set(0.24 * s, 0.08 * s, 0.04 * s);
      root.add(cloak, hood, eyes);
    } else if (isBoss) {
      const hair = new THREE.Mesh(sharedGeo.sculptedHeadGeo, hatMat);
      hair.position.set(0, 1.64 * s, -0.02 * s);
      hair.scale.set(1.04 * s, 0.72 * s, 1.06 * s);
      const shades = new THREE.Mesh(sharedGeo.torsoGeo, pantsMat);
      shades.position.set(0, 1.59 * s, 0.165 * s);
      shades.scale.set(0.28 * s, 0.07 * s, 0.05 * s);
      root.add(hair, shades);
    } else {
      const mask = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
      mask.position.set(0, 1.51 * s, 0.155 * s);
      mask.scale.set(0.33 * s, 0.18 * s, 0.06 * s);
      const brim = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
      brim.position.set(0, 1.72 * s, 0);
      brim.scale.set(0.54 * s, 0.045 * s, 0.54 * s);
      const crown = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
      crown.position.set(0, 1.8 * s, 0);
      crown.scale.set(0.33 * s, 0.14 * s, 0.33 * s);
      root.add(mask, brim, crown);
    }
  } else if (bossId === 'baron_noir') {
    const coatTail = new THREE.Mesh(sharedGeo.torsoGeo, shirtMat);
    coatTail.position.set(0, 0.62 * s, -0.06 * s);
    coatTail.scale.set(0.52 * s, 0.55 * s, 0.24 * s);
    const brim = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
    brim.position.set(0, 1.72 * s, 0);
    brim.scale.set(0.62 * s, 0.05 * s, 0.62 * s);
    const crown = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
    crown.position.set(0, 1.81 * s, 0);
    crown.scale.set(0.34 * s, 0.16 * s, 0.34 * s);
    root.add(coatTail, brim, crown);
  } else if (bossId === 'don_lion') {
    const collar = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    collar.position.set(0, 1.37 * s, 0);
    collar.scale.set(0.56 * s, 0.15 * s, 0.34 * s);
    const beard = new THREE.Mesh(sharedGeo.torsoGeo, furGreyMat);
    beard.position.set(0, 1.46 * s, 0.165 * s);
    beard.scale.set(0.28 * s, 0.16 * s, 0.07 * s);
    const scar = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    scar.position.set(0.08 * s, 1.62 * s, 0.165 * s);
    scar.rotation.z = 0.4;
    scar.scale.set(0.03 * s, 0.14 * s, 0.03 * s);
    root.add(collar, beard, scar);
  } else if (bossId === 'emir_aurelius') {
    const turban = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
    turban.position.set(0, 1.77 * s, 0);
    turban.scale.set(0.42 * s, 0.2 * s, 0.42 * s);
    const crest = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    crest.position.set(0, 1.92 * s, 0.14 * s);
    crest.scale.set(0.14 * s, 0.18 * s, 0.08 * s);
    const visor = new THREE.Mesh(sharedGeo.torsoGeo, visorMat);
    visor.position.set(0, 1.6 * s, 0.168 * s);
    visor.scale.set(0.28 * s, 0.08 * s, 0.04 * s);
    const pauldronL = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    pauldronL.position.set(-0.3 * s, 1.32 * s, 0);
    pauldronL.scale.set(0.18 * s, 0.12 * s, 0.26 * s);
    const pauldronR = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    pauldronR.position.set(0.3 * s, 1.32 * s, 0);
    pauldronR.scale.set(0.18 * s, 0.12 * s, 0.26 * s);
    root.add(turban, crest, visor, pauldronL, pauldronR);
  } else if (bossId === 'big_barnaby') {
    const flatCap = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
    flatCap.position.set(0, 1.73 * s, 0.05 * s);
    flatCap.scale.set(0.36 * s, 0.11 * s, 0.42 * s);
    const beard = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    beard.position.set(0, 1.46 * s, 0.165 * s);
    beard.scale.set(0.28 * s, 0.16 * s, 0.08 * s);
    root.add(flatCap, beard);
  } else {
    const cap = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    cap.position.set(0, 1.74 * s, 0.03 * s);
    cap.scale.set(0.35 * s, 0.12 * s, 0.38 * s);
    const bandana = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    bandana.position.set(0, 1.49 * s, 0.165 * s);
    bandana.scale.set(0.32 * s, 0.16 * s, 0.05 * s);
    root.add(cap, bandana);
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.26 * s, 1.3 * s, 0);
  const leftArmMesh = new THREE.Mesh(sharedGeo.sculptedArmGeo, shirtMat);
  leftArmMesh.scale.setScalar(s);
  const leftHand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
  leftHand.position.set(0, -0.56 * s, 0);
  leftHand.scale.setScalar(s);
  leftArm.add(leftArmMesh, leftHand);

  const cigStick = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.cigPaperMat);
  cigStick.position.set(0, -0.56 * s, 0.09 * s);
  cigStick.scale.set(0.025 * s, 0.025 * s, 0.11 * s);
  const cigEmber = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.cigEmberMat);
  cigEmber.position.set(0, -0.56 * s, 0.155 * s);
  cigEmber.scale.set(0.03 * s, 0.03 * s, 0.03 * s);
  leftArm.add(cigStick, cigEmber);

  if (bossId === 'baron_noir' && isBoss) {
    const caneShaft = new THREE.Mesh(sharedGeo.propGeo, pantsMat);
    caneShaft.position.set(-0.04 * s, -0.78 * s, 0.08 * s);
    caneShaft.scale.set(0.03 * s, 0.78 * s, 0.03 * s);
    const caneKnob = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propSteelMat);
    caneKnob.position.set(-0.04 * s, -0.38 * s, 0.08 * s);
    caneKnob.scale.set(0.06 * s, 0.05 * s, 0.06 * s);
    leftArm.add(caneShaft, caneKnob);
  }

  const rightArm = new THREE.Group();
  rightArm.position.set(0.26 * s, 1.3 * s, 0);
  const rightArmMesh = new THREE.Mesh(sharedGeo.sculptedArmGeo, shirtMat);
  rightArmMesh.scale.setScalar(s);
  const rightHand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
  rightHand.position.set(0, -0.56 * s, 0);
  rightHand.scale.setScalar(s);
  rightArm.add(rightArmMesh, rightHand);

  // Pistol/SMG attached to right hand extending forward along forearm
  const gunReceiver = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.gunMetalMat);
  gunReceiver.position.set(0, -0.58 * s, 0.16 * s);
  gunReceiver.scale.set(0.065 * s, 0.09 * s, 0.34 * s);
  const gunGrip = new THREE.Mesh(sharedGeo.propGeo, pantsMat);
  gunGrip.position.set(0, -0.56 * s, 0.05 * s);
  gunGrip.scale.set(0.055 * s, 0.12 * s, 0.07 * s);
  rightArm.add(gunReceiver, gunGrip);

  const cigSmokeMesh = new THREE.Mesh(sharedGeo.smokeGeo, sharedGeo.cigSmokeMat);
  cigSmokeMesh.position.set(-0.28 * s, 1.48 * s, 0.28 * s);
  cigSmokeMesh.scale.set(0.45, 0.45, 0.45);

  const gNeckY = 1.37 * s;
  const gHeadPivot = new THREE.Group();
  gHeadPivot.position.set(0, gNeckY, 0);
  neck.position.set(0, 0, 0);
  head.position.set(0, 1.56 * s - gNeckY, 0);
  gHeadPivot.add(neck, head);

  const neckStump = new THREE.Mesh(sharedGeo.neckStumpGeo, sharedGeo.bloodStumpMat);
  neckStump.position.set(0, gNeckY, 0);
  neckStump.scale.setScalar(s);
  neckStump.visible = false;

  root.add(leftLeg, rightLeg, torso, neckStump, gHeadPivot, leftArm, rightArm, cigSmokeMesh);

  leftLegMesh.userData.hitZone = 'leg_left';
  rightLegMesh.userData.hitZone = 'leg_right';
  pelvis.userData.hitZone = 'abdomen';
  torso.userData.hitZone = 'chest';
  head.userData.hitZone = 'head';
  leftArmMesh.userData.hitZone = 'arm_left';
  rightArmMesh.userData.hitZone = 'arm_right';

  const hitParts = [leftLegMesh, rightLegMesh, pelvis, torso, head, leftArmMesh, rightArmMesh];
  for (let i = 0; i < hitParts.length; i++) {
    hitParts[i].userData.simGangId = memberId;
    shootableOut.push(hitParts[i]);
  }

  return { root, shirtMat, leftLeg, rightLeg, leftArm, rightArm, headPivot: gHeadPivot, neckStump, cigSmokeMesh, mats };
}

function buildPoliceOfficerMesh(
  officerId: number,
  sharedGeo: SharedNpcGeos,
  uniformMat: THREE.MeshStandardMaterial,
  hatMat: THREE.MeshStandardMaterial,
  badgeMat: THREE.MeshStandardMaterial,
  shootableOut: THREE.Object3D[],
): {
  root: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  headPivot: THREE.Group;
  neckStump: THREE.Mesh;
  mats: THREE.Material[];
} {
  const shirtMat = uniformMat.clone();
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const mats: THREE.Material[] = [shirtMat, pantsMat];
  const root = new THREE.Group();

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, 0.72, 0);
  const leftLegMesh = new THREE.Mesh(sharedGeo.sculptedLegGeo, pantsMat);
  const leftBoot = new THREE.Mesh(sharedGeo.shoeGeo, sharedGeo.shoeMat);
  leftBoot.position.set(0, -0.68, 0.04);
  leftLeg.add(leftLegMesh, leftBoot);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, 0.72, 0);
  const rightLegMesh = new THREE.Mesh(sharedGeo.sculptedLegGeo, pantsMat);
  const rightBoot = new THREE.Mesh(sharedGeo.shoeGeo, sharedGeo.shoeMat);
  rightBoot.position.set(0, -0.68, 0.04);
  rightLeg.add(rightLegMesh, rightBoot);

  const pelvis = new THREE.Mesh(sharedGeo.sculptedPelvisGeo, pantsMat);
  pelvis.position.set(0, 0.75, 0);
  const torso = new THREE.Mesh(sharedGeo.sculptedTorsoGeo, shirtMat);
  torso.position.set(0, 1.07, 0);
  torso.scale.set(1.08, 1.04, 1.0);
  const badge = new THREE.Mesh(sharedGeo.torsoGeo, badgeMat);
  badge.position.set(0.08, 1.18, 0.18);
  badge.scale.set(0.07, 0.08, 0.03);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.37, 0);
  const neck = new THREE.Mesh(sharedGeo.neckGeo, sharedGeo.skinMat);
  neck.position.set(0, 0, 0);
  const head = new THREE.Mesh(sharedGeo.sculptedHeadGeo, sharedGeo.skinMat);
  head.position.set(0, 0.19, 0);
  head.scale.set(1, 1.08, 1.02);
  head.userData.isHead = true;

  const capCrown = new THREE.Mesh(sharedGeo.torsoGeo, hatMat);
  capCrown.position.set(0, 0.35, 0);
  capCrown.scale.set(0.32, 0.11, 0.34);
  const capVisor = new THREE.Mesh(sharedGeo.torsoGeo, sharedGeo.shoeMat);
  capVisor.position.set(0, 0.3, 0.18);
  capVisor.scale.set(0.28, 0.035, 0.16);
  const capBadge = new THREE.Mesh(sharedGeo.torsoGeo, badgeMat);
  capBadge.position.set(0, 0.36, 0.175);
  capBadge.scale.set(0.07, 0.06, 0.03);
  headPivot.add(neck, head, capCrown, capVisor, capBadge);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.26, 1.3, 0);
  const leftArmMesh = new THREE.Mesh(sharedGeo.sculptedArmGeo, shirtMat);
  const leftHand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
  leftHand.position.set(0, -0.56, 0);
  leftArm.add(leftArmMesh, leftHand);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.26, 1.3, 0);
  const rightArmMesh = new THREE.Mesh(sharedGeo.sculptedArmGeo, shirtMat);
  const rightHand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
  rightHand.position.set(0, -0.56, 0);
  rightArm.add(rightArmMesh, rightHand);

  // Police Duty Pistol held in right hand
  const pistolSlide = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.gunMetalMat);
  pistolSlide.position.set(0, -0.58, 0.14);
  pistolSlide.scale.set(0.05, 0.07, 0.25);
  const pistolGrip = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.shoeMat);
  pistolGrip.position.set(0, -0.55, 0.04);
  pistolGrip.scale.set(0.045, 0.1, 0.06);
  rightArm.add(pistolSlide, pistolGrip);

  const neckStump = new THREE.Mesh(sharedGeo.neckStumpGeo, sharedGeo.bloodStumpMat);
  neckStump.position.set(0, 1.37, 0);
  neckStump.visible = false;

  root.add(
    leftLeg,
    rightLeg,
    pelvis,
    torso,
    badge,
    neckStump,
    headPivot,
    leftArm,
    rightArm,
  );
  leftLegMesh.userData.hitZone = 'leg_left';
  rightLegMesh.userData.hitZone = 'leg_right';
  pelvis.userData.hitZone = 'abdomen';
  torso.userData.hitZone = 'chest';
  head.userData.hitZone = 'head';
  leftArmMesh.userData.hitZone = 'arm_left';
  rightArmMesh.userData.hitZone = 'arm_right';

  const hitParts = [leftLegMesh, rightLegMesh, pelvis, torso, head, leftArmMesh, rightArmMesh];
  for (let i = 0; i < hitParts.length; i++) {
    hitParts[i].userData.simPoliceId = officerId;
    shootableOut.push(hitParts[i]);
  }
  return { root, shirtMat, leftLeg, rightLeg, leftArm, rightArm, headPivot, neckStump, mats };
}

function buildRoyalGuardOrCavalryMesh(
  guardId: number,
  isMounted: boolean,
  horseColorHex: number,
  sharedGeo: SharedNpcGeos,
  shootableOut: THREE.Object3D[],
): {
  root: THREE.Group;
  tunicMat: THREE.MeshStandardMaterial;
  riderLeftArm: THREE.Object3D;
  riderRightArm: THREE.Object3D;
  riderLeftLeg?: THREE.Object3D;
  riderRightLeg?: THREE.Object3D;
  horseLegs?: THREE.Group[];
  horseTail?: THREE.Mesh;
  mats: THREE.Material[];
} {
  const root = new THREE.Group();
  const tunicMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55 });
  const trousersMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.78 });
  const bearskinMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.65 });
  const horseMat = new THREE.MeshStandardMaterial({ color: horseColorHex, roughness: 0.72 });
  const saddleMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.65 });
  const mats: THREE.Material[] = [tunicMat, trousersMat, bearskinMat, goldMat, horseMat, saddleMat];

  let horseLegs: THREE.Group[] | undefined;
  let horseTail: THREE.Mesh | undefined;
  let riderLeftLeg: THREE.Object3D | undefined;
  let riderRightLeg: THREE.Object3D | undefined;

  const riderRoot = new THREE.Group();
  if (isMounted) {
    const hBody = new THREE.Mesh(sharedGeo.torsoGeo, horseMat);
    hBody.position.set(0, 1.15, 0);
    hBody.scale.set(0.68, 0.72, 1.85);
    const hSaddle = new THREE.Mesh(sharedGeo.torsoGeo, saddleMat);
    hSaddle.position.set(0, 1.54, 0.05);
    hSaddle.scale.set(0.74, 0.16, 0.78);
    const hNeck = new THREE.Mesh(sharedGeo.torsoGeo, horseMat);
    hNeck.position.set(0, 1.62, 0.88);
    hNeck.rotation.x = 0.52;
    hNeck.scale.set(0.38, 0.78, 0.42);
    const hHead = new THREE.Mesh(sharedGeo.torsoGeo, horseMat);
    hHead.position.set(0, 1.98, 1.24);
    hHead.rotation.x = 0.42;
    hHead.scale.set(0.32, 0.36, 0.64);
    const hBridle = new THREE.Mesh(sharedGeo.torsoGeo, goldMat);
    hBridle.position.set(0, 1.92, 1.38);
    hBridle.scale.set(0.35, 0.1, 0.12);
    horseTail = new THREE.Mesh(sharedGeo.torsoGeo, bearskinMat);
    horseTail.position.set(0, 1.22, -0.96);
    horseTail.rotation.x = -0.35;
    horseTail.scale.set(0.14, 0.68, 0.14);

    horseLegs = [];
    const legOffsets: Array<[number, number]> = [
      [-0.22, 0.68],
      [0.22, 0.68],
      [-0.22, -0.68],
      [0.22, -0.68],
    ];
    for (let l = 0; l < legOffsets.length; l++) {
      const piv = new THREE.Group();
      piv.position.set(legOffsets[l][0], 0.92, legOffsets[l][1]);
      const legMesh = new THREE.Mesh(sharedGeo.limbGeo, horseMat);
      legMesh.position.set(0, -0.45, 0);
      legMesh.scale.set(0.16, 0.9, 0.18);
      legMesh.userData.simRoyalGuardId = guardId;
      shootableOut.push(legMesh);
      piv.add(legMesh);
      root.add(piv);
      horseLegs.push(piv);
    }

    root.add(hBody, hSaddle, hNeck, hHead, hBridle, horseTail);
    [hBody, hNeck, hHead].forEach((part) => {
      part.userData.simRoyalGuardId = guardId;
      shootableOut.push(part);
    });
    riderRoot.position.set(0, 1.25, 0.05);
  } else {
    const leftPiv = new THREE.Group();
    leftPiv.position.set(-0.11, 0.72, 0);
    const leftLegMesh = new THREE.Mesh(sharedGeo.sculptedLegGeo, trousersMat);
    const leftShoe = new THREE.Mesh(sharedGeo.shoeGeo, sharedGeo.shoeMat);
    leftShoe.position.set(0, -0.68, 0.04);
    leftPiv.add(leftLegMesh, leftShoe);
    riderLeftLeg = leftPiv;

    const rightPiv = new THREE.Group();
    rightPiv.position.set(0.11, 0.72, 0);
    const rightLegMesh = new THREE.Mesh(sharedGeo.sculptedLegGeo, trousersMat);
    const rightShoe = new THREE.Mesh(sharedGeo.shoeGeo, sharedGeo.shoeMat);
    rightShoe.position.set(0, -0.68, 0.04);
    rightPiv.add(rightLegMesh, rightShoe);
    riderRightLeg = rightPiv;

    riderRoot.add(leftPiv, rightPiv);
    leftLegMesh.userData.simRoyalGuardId = guardId;
    rightLegMesh.userData.simRoyalGuardId = guardId;
    shootableOut.push(leftLegMesh, rightLegMesh);
  }

  const torso = new THREE.Mesh(sharedGeo.sculptedTorsoGeo, tunicMat);
  torso.position.set(0, 1.07, 0);
  torso.scale.set(1.08, 1.04, 1.0);
  const sash = new THREE.Mesh(sharedGeo.torsoGeo, goldMat);
  sash.position.set(0, 1.06, 0.16);
  sash.scale.set(0.42, 0.12, 0.05);
  const head = new THREE.Mesh(sharedGeo.sculptedHeadGeo, sharedGeo.skinMat);
  head.position.set(0, 1.54, 0);
  head.scale.set(1, 1.08, 1.02);
  head.userData.isHead = true;
  const helm = new THREE.Mesh(sharedGeo.torsoGeo, bearskinMat);
  helm.position.set(0, 1.86, 0);
  helm.scale.set(0.34, 0.4, 0.34);
  const plume = new THREE.Mesh(sharedGeo.torsoGeo, goldMat);
  plume.position.set(0.16, 1.98, 0);
  plume.scale.set(0.08, 0.24, 0.08);

  const riderLeftArm = new THREE.Group();
  riderLeftArm.position.set(-0.26, 1.29, 0);
  const riderLeftArmMesh = new THREE.Mesh(sharedGeo.sculptedArmGeo, tunicMat);
  const riderLeftHand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
  riderLeftHand.position.set(0, -0.56, 0);
  riderLeftArm.add(riderLeftArmMesh, riderLeftHand);

  const riderRightArm = new THREE.Group();
  riderRightArm.position.set(0.26, 1.29, 0);
  const riderRightArmMesh = new THREE.Mesh(sharedGeo.sculptedArmGeo, tunicMat);
  const riderRightHand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
  riderRightHand.position.set(0, -0.56, 0);
  riderRightArm.add(riderRightArmMesh, riderRightHand);

  const pikeShaft = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propWoodMat);
  pikeShaft.position.set(0, -0.25, 0.18);
  pikeShaft.scale.set(0.05, 1.85, 0.05);
  const pikeTip = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propSteelMat);
  pikeTip.position.set(0, 0.78, 0.18);
  pikeTip.scale.set(0.11, 0.32, 0.07);
  riderRightArm.add(pikeShaft, pikeTip);

  riderRoot.add(torso, sash, head, helm, plume, riderLeftArm, riderRightArm);
  [torso, head, helm, riderLeftArmMesh, riderRightArmMesh].forEach((part) => {
    part.userData.simRoyalGuardId = guardId;
    shootableOut.push(part);
  });

  root.add(riderRoot);
  return { root, tunicMat, riderLeftArm, riderRightArm, riderLeftLeg, riderRightLeg, horseLegs, horseTail, mats };
}

interface RoadCarPalette {
  paintHex: number;
  accentHex: number;
  seatHex: number;
  drlHex: number;
  len: number;
  width: number;
  waistH: number;
  hoodH: number;
  roofH: number;
  cabStart: number;
  cabEnd: number;
  wheelZ: number;
  wheelRad: number;
  cyber?: boolean;
  boxy4x4?: boolean;
  copperGrille?: boolean;
  wing?: boolean;
  police?: boolean;
}

const ROAD_CAR_PALETTES: Record<
  | 'revuelto_red'
  | 'cyber_pickup'
  | 'stealth_hyper'
  | 'rolls_copper_gt'
  | 'cyber_gold'
  | 'vision_silver'
  | 'terzo_silver'
  | 'gullwing_coupe'
  | 'range_black_suv'
  | 'thar_black_4x4'
  | 'challenger_scissor'
  | 'lambo_blue_hyper'
  | 'police',
  RoadCarPalette
> = {
  revuelto_red: {
    paintHex: 0xb91c1c, accentHex: 0x0f172a, seatHex: 0x450a0a, drlHex: 0xe0f2fe,
    len: 4.65, width: 2.06, waistH: 0.78, hoodH: 0.60, roofH: 1.44, cabStart: -1.15, cabEnd: 0.95, wheelZ: 1.48, wheelRad: 0.38, wing: true,
  },
  cyber_pickup: {
    paintHex: 0x1e2024, accentHex: 0x0f172a, seatHex: 0x1e293b, drlHex: 0xf8fafc,
    len: 5.2, width: 2.14, waistH: 1.12, hoodH: 0.96, roofH: 1.98, cabStart: -1.35, cabEnd: 1.05, wheelZ: 1.72, wheelRad: 0.46, cyber: true,
  },
  stealth_hyper: {
    paintHex: 0x14161a, accentHex: 0x090b0e, seatHex: 0x262626, drlHex: 0xf8fafc,
    len: 4.6, width: 2.06, waistH: 0.76, hoodH: 0.58, roofH: 1.42, cabStart: -1.15, cabEnd: 0.92, wheelZ: 1.46, wheelRad: 0.38,
  },
  rolls_copper_gt: {
    paintHex: 0xf8fafc, accentHex: 0xea580c, seatHex: 0xc2410c, drlHex: 0xe0f2fe,
    len: 4.86, width: 2.04, waistH: 0.92, hoodH: 0.80, roofH: 1.62, cabStart: -1.35, cabEnd: 0.65, wheelZ: 1.54, wheelRad: 0.42, copperGrille: true,
  },
  cyber_gold: {
    paintHex: 0xd4af37, accentHex: 0x111827, seatHex: 0x78350f, drlHex: 0xfef3c7,
    len: 5.2, width: 2.14, waistH: 1.12, hoodH: 0.96, roofH: 1.98, cabStart: -1.35, cabEnd: 1.05, wheelZ: 1.72, wheelRad: 0.46, cyber: true,
  },
  vision_silver: {
    paintHex: 0xcbd5e1, accentHex: 0x38bdf8, seatHex: 0x1e293b, drlHex: 0x38bdf8,
    len: 4.76, width: 2.02, waistH: 0.84, hoodH: 0.66, roofH: 1.56, cabStart: -1.25, cabEnd: 0.88, wheelZ: 1.5, wheelRad: 0.41,
  },
  terzo_silver: {
    paintHex: 0x94a3b8, accentHex: 0x0f172a, seatHex: 0x0f172a, drlHex: 0xf43f5e,
    len: 4.65, width: 2.08, waistH: 0.76, hoodH: 0.58, roofH: 1.42, cabStart: -1.2, cabEnd: 0.92, wheelZ: 1.48, wheelRad: 0.39,
  },
  gullwing_coupe: {
    paintHex: 0x1e242b, accentHex: 0x0f172a, seatHex: 0x334155, drlHex: 0xf8fafc,
    len: 4.52, width: 2.02, waistH: 0.94, hoodH: 0.76, roofH: 1.64, cabStart: -1.2, cabEnd: 0.92, wheelZ: 1.44, wheelRad: 0.42,
  },
  range_black_suv: {
    paintHex: 0x0f1115, accentHex: 0x050608, seatHex: 0x1e293b, drlHex: 0xe0f2fe,
    len: 4.76, width: 2.1, waistH: 1.08, hoodH: 0.96, roofH: 1.96, cabStart: -1.88, cabEnd: 0.95, wheelZ: 1.54, wheelRad: 0.45, boxy4x4: true,
  },
  thar_black_4x4: {
    paintHex: 0x111827, accentHex: 0x090b0f, seatHex: 0x1f2937, drlHex: 0xf8fafc,
    len: 4.16, width: 1.9, waistH: 1.10, hoodH: 1.00, roofH: 1.98, cabStart: -1.65, cabEnd: 0.55, wheelZ: 1.32, wheelRad: 0.45, boxy4x4: true,
  },
  challenger_scissor: {
    paintHex: 0x991b1b, accentHex: 0x0f172a, seatHex: 0x27272a, drlHex: 0xf8fafc,
    len: 4.78, width: 2.02, waistH: 0.88, hoodH: 0.74, roofH: 1.58, cabStart: -1.35, cabEnd: 0.72, wheelZ: 1.52, wheelRad: 0.41,
  },
  lambo_blue_hyper: {
    paintHex: 0x0284c7, accentHex: 0x090d16, seatHex: 0x0f172a, drlHex: 0xe0f2fe,
    len: 4.65, width: 2.08, waistH: 0.78, hoodH: 0.60, roofH: 1.44, cabStart: -1.15, cabEnd: 0.95, wheelZ: 1.48, wheelRad: 0.39, wing: true,
  },
  police: {
    paintHex: 0x0f172a, accentHex: 0xf8fafc, seatHex: 0x1e293b, drlHex: 0xe0f2fe,
    len: 4.76, width: 2.1, waistH: 1.08, hoodH: 0.96, roofH: 1.96, cabStart: -1.88, cabEnd: 0.95, wheelZ: 1.54, wheelRad: 0.45, boxy4x4: true, police: true,
  },
};

function createRoadLowerChassisProfile(
  len: number,
  waistH: number,
  hoodH: number,
  cabEnd: number,
  cyber = false,
): THREE.Shape {
  const halfL = len * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-halfL, 0.24);
  s.lineTo(halfL - 0.12, 0.24);
  s.lineTo(halfL, 0.42);
  s.lineTo(halfL - 0.08, hoodH);
  if (cyber) {
    s.lineTo(cabEnd, waistH);
    s.lineTo(-halfL + 0.05, waistH + 0.14);
  } else {
    s.lineTo(cabEnd, waistH);
    s.lineTo(-halfL + 0.05, waistH);
  }
  s.lineTo(-halfL, 0.44);
  s.closePath();
  return s;
}

function buildModernVehicleMesh(
  agentId: number,
  kind: AmbientRoadAgent['kind'],
  variantIdx: number,
  wheelGeo: THREE.CylinderGeometry,
  tireMat: THREE.MeshStandardMaterial,
  sharedPropMats: CompiledPropMats,
  geometriesOut: THREE.BufferGeometry[],
  materialsOut: THREE.Material[],
  shootableOut: THREE.Object3D[],
): {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheelSteerPivots: THREE.Group[];
  wheelRadii: number[];
  wheelSides: number[];
  wheelBaseY: number[];
  glassPanes: VehicleGlassPane[];
  meshes: THREE.Mesh[];
  lightBarMeshes?: [THREE.Mesh, THREE.Mesh];
  doorPivotL?: THREE.Group;
  driverSeatGroup?: THREE.Group;
  originalMats: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  colW: number;
  colH: number;
  colD: number;
} {
  const root = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const frontWheelSteerPivots: THREE.Group[] = [];
  const wheelRadii: number[] = [];
  const wheelSides: number[] = [];
  const wheelBaseY: number[] = [];
  const glassPanes: VehicleGlassPane[] = [];
  const meshes: THREE.Mesh[] = [];
  const originalMats = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const pb = new PropMeshAssembler();
  let lightBarMeshes: [THREE.Mesh, THREE.Mesh] | undefined;
  let doorPivotL: THREE.Group | undefined;
  let driverSeatGroup: THREE.Group | undefined;

  const isBikeLike =
    kind === 'motorcycle' || kind === 'bicycle' || kind === 'sport_moto' || kind === 'city_scooter';

  let colW = 2.04;
  let colH = 1.65;
  let colD = 4.65;

  if (isBikeLike) {
    colW = 0.78;
    colH = 1.75;
    colD = 2.1;
    const isBike = kind === 'bicycle';
    const isScoot = kind === 'city_scooter';
    const motoColors = [0xf97316, 0x22c55e, 0xef4444, 0x38bdf8, 0xa855f7];
    const paint = isBike
      ? 0x06b6d4
      : isScoot
        ? variantIdx % 2 === 0
          ? 0x10b981
          : 0xf59e0b
        : motoColors[variantIdx % motoColors.length];
    const bodyProfile = new THREE.Shape();
    bodyProfile.moveTo(-0.78, 0.52);
    bodyProfile.lineTo(0.45, 0.52);
    bodyProfile.lineTo(0.68, 0.96);
    bodyProfile.lineTo(0.25, 1.02);
    bodyProfile.lineTo(-0.18, 0.78);
    bodyProfile.lineTo(-0.72, 0.84);
    bodyProfile.closePath();
    pb.addExtrude(bodyProfile, isBike ? 0.1 : 0.3, 0.04, 0, 0, 0, paint, 'glossy', 0, -Math.PI * 0.5, 0);
    pb.addCylinder(0.035, 0.045, 0.72, 8, -0.1, 0.68, 0.52, 0x94a3b8, 'glossy', 0.38);
    pb.addCylinder(0.035, 0.045, 0.72, 8, 0.1, 0.68, 0.52, 0x94a3b8, 'glossy', 0.38);
    pb.addCylinder(0.03, 0.03, 0.68, 8, 0, 1.04, 0.44, 0x94a3b8, 'glossy', 0, 0, Math.PI * 0.5);
    pb.addCylinder(0.1, 0.1, 0.12, 10, 0, 0.96, 0.74, 0xfef08a, 'emissive', Math.PI * 0.5);
    pb.addBox(0, 0.86, -0.82, 0.16, 0.1, 0.08, 0xef4444, 'emissive');

    const rad = isScoot ? 0.28 : 0.36;
    [-0.68, 0.68].forEach((wz) => {
      const wIdx = wheels.length;
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.rotation.z = Math.PI * 0.5;
      w.scale.set(rad, isBike ? 0.1 : 0.22, rad);
      w.userData.vehiclePart = 'wheel';
      w.userData.wheelIdx = wIdx;
      if (wz > 0) {
        const steerPivot = new THREE.Group();
        steerPivot.position.set(0, rad, wz);
        steerPivot.add(w);
        root.add(steerPivot);
        frontWheelSteerPivots.push(steerPivot);
      } else {
        w.position.set(0, rad, wz);
        root.add(w);
      }
      wheels.push(w);
      wheelRadii.push(rad);
      wheelSides.push(0);
      wheelBaseY.push(wz > 0 ? 0 : rad);
    });

    // Visible helmeted rider on bike
    const riderGrp = new THREE.Group();
    const riderMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.28, metalness: 0.35 });
    materialsOut.push(riderMat, helmetMat);
    const torsoGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.48, 8);
    const helmetGeo = new THREE.SphereGeometry(0.16, 10, 8);
    geometriesOut.push(torsoGeo, helmetGeo);
    const torsoM = new THREE.Mesh(torsoGeo, riderMat);
    torsoM.position.set(0, 1.18, -0.08);
    torsoM.rotation.x = 0.24;
    const helmetM = new THREE.Mesh(helmetGeo, helmetMat);
    helmetM.position.set(0, 1.56, 0.02);
    riderGrp.add(torsoM, helmetM);
    root.add(riderGrp);
    driverSeatGroup = riderGrp;
  } else {
    const pal = ROAD_CAR_PALETTES[kind];
    colW = pal.width;
    colH = pal.roofH + 0.15;
    colD = pal.len;
    const halfL = pal.len * 0.5;
    const halfW = pal.width * 0.5;
    const cabCenterZ = (pal.cabStart + pal.cabEnd) * 0.5;
    const cabLen = pal.cabEnd - pal.cabStart;

    // 1. Sculpted lower chassis (0..waistH) leaving cabin upper section HOLLOW & see-through!
    const lowerHull = createRoadLowerChassisProfile(pal.len, pal.waistH, pal.hoodH, pal.cabEnd, pal.cyber);
    pb.addExtrude(lowerHull, pal.width - 0.18, 0.05, 0, 0, 0, pal.paintHex, 'glossy', 0, -Math.PI * 0.5, 0);
    // Undercarriage & side rocker skirts
    pb.addBox(0, 0.26, 0, pal.width * 0.94, 0.14, pal.len * 0.95, 0x0b0f17, 'solid');
    // Sculpted roof panel (curved or cyber wedge apex)
    const roofLen = pal.cyber ? 0.55 : cabLen * 0.58;
    const roofZ = pal.cyber ? cabCenterZ + 0.12 : cabCenterZ - 0.18;
    pb.addBox(0, pal.roofH - 0.04, roofZ, pal.width - 0.34, 0.07, roofLen, pal.paintHex, 'glossy');

    // Slim A-pillars & C-pillars around the clear glass cabin
    const pillarH = pal.roofH - pal.waistH;
    const pillarY = (pal.roofH + pal.waistH) * 0.5;
    const pillarLen = Math.hypot(pillarH, 0.52);
    const aTilt = Math.atan2(0.52, pillarH);
    [-halfW + 0.16, halfW - 0.16].forEach((px) => {
      pb.addBox(px, pillarY, pal.cabEnd - 0.22, 0.07, pillarLen, 0.08, pal.accentHex, 'solid', aTilt);
      pb.addBox(px, pillarY, pal.cabStart + 0.25, 0.08, pillarLen, 0.1, pal.accentHex, 'solid', -aTilt * 0.9);
    });

    // Side door outer skin panels + wing mirrors
    if (pal.police) {
      pb.addBox(0, pal.waistH * 0.65, cabCenterZ, pal.width + 0.03, 0.44, cabLen * 0.78, 0xf8fafc, 'glossy');
      pb.addBox(0, 0.64, halfL + 0.04, 1.36, 0.36, 0.12, 0x1e293b, 'solid');
    }
    if (pal.copperGrille) {
      pb.addBox(0, 0.58, halfL - 0.02, 0.78, 0.46, 0.1, pal.accentHex, 'glossy');
      pb.addBox(0, pal.hoodH + 0.06, halfL - 0.14, 0.08, 0.1, 0.08, 0xf59e0b, 'glossy');
    }
    if (pal.wing) {
      pb.addBox(0, pal.waistH + 0.2, -halfL + 0.18, pal.width - 0.12, 0.06, 0.26, pal.accentHex, 'glossy');
      [-0.52, 0.52].forEach((sx) => {
        pb.addBox(sx, pal.waistH + 0.09, -halfL + 0.18, 0.06, 0.2, 0.16, pal.accentHex, 'solid');
      });
    }
    // Headlights / LED lightbar at +Z and taillights at -Z
    if (pal.cyber) {
      pb.addBox(0, pal.hoodH - 0.04, halfL - 0.01, pal.width - 0.24, 0.07, 0.06, pal.drlHex, 'emissive');
      pb.addBox(0, pal.waistH + 0.02, -halfL + 0.02, pal.width - 0.24, 0.07, 0.06, 0xef4444, 'emissive');
    } else {
      [-halfW + 0.34, halfW - 0.34].forEach((lx) => {
        pb.addBox(lx, pal.hoodH - 0.08, halfL - 0.02, 0.42, 0.1, 0.07, pal.drlHex, 'emissive');
        pb.addBox(lx, pal.waistH - 0.08, -halfL + 0.02, 0.46, 0.11, 0.07, 0xef4444, 'emissive');
      });
    }

    // 2. Visible Cabin Interior (floor, dashboard, glowing screens, steering wheel, seats)
    pb.addBox(0, pal.waistH - 0.26, cabCenterZ, pal.width - 0.34, 0.08, cabLen * 0.85, 0x0f172a, 'solid');
    pb.addBox(0, pal.waistH - 0.02, pal.cabEnd - 0.24, pal.width - 0.38, 0.24, 0.38, 0x111827, 'solid');
    // Glowing digital dash gauge & center infotainment
    pb.addBox(0.42, pal.waistH + 0.04, pal.cabEnd - 0.44, 0.38, 0.11, 0.04, 0x38bdf8, 'emissive');
    pb.addBox(0, pal.waistH + 0.02, pal.cabEnd - 0.42, 0.26, 0.14, 0.04, 0x0ea5e9, 'emissive');
    // Steering wheel (+X = 0.42 left side when facing +Z)
    pb.addCylinder(0.14, 0.14, 0.04, 10, 0.42, pal.waistH + 0.06, pal.cabEnd - 0.56, 0x0f172a, 'solid', Math.PI * 0.42);
    // Bucket seats
    [-0.42, 0.42].forEach((sx) => {
      pb.addBox(sx, pal.waistH - 0.12, cabCenterZ - 0.18, 0.44, 0.14, 0.46, pal.seatHex, 'solid');
      pb.addBox(sx, pal.waistH + 0.18, cabCenterZ - 0.38, 0.42, 0.54, 0.12, pal.seatHex, 'solid', -0.18);
    });

    // 3. Visible Seated NPC Driver (+X = 0.42) tucked cleanly inside raised cabin below roof!
    const dGroup = new THREE.Group();
    dGroup.position.set(0.42, pal.waistH - 0.22, cabCenterZ - 0.18);
    dGroup.scale.setScalar(0.9);
    const dShirtColors = [0x2563eb, 0xf97316, 0x10b981, 0xe11d48, 0xf8fafc, 0x8b5cf6];
    const dShirtMat = new THREE.MeshStandardMaterial({
      color: pal.police ? 0x1e3a8a : dShirtColors[variantIdx % dShirtColors.length],
      roughness: 0.7,
    });
    const dSkinMat = new THREE.MeshStandardMaterial({ color: 0xe6b89c, roughness: 0.72 });
    const dHairMat = new THREE.MeshStandardMaterial({ color: pal.police ? 0x0f172a : 0x1f1612, roughness: 0.85 });
    materialsOut.push(dShirtMat, dSkinMat, dHairMat);
    const dTorsoGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.42, 8);
    const dHeadGeo = new THREE.SphereGeometry(0.135, 10, 8);
    geometriesOut.push(dTorsoGeo, dHeadGeo);
    const dTorso = new THREE.Mesh(dTorsoGeo, dShirtMat);
    dTorso.position.set(0, 0.22, -0.04);
    const dHead = new THREE.Mesh(dHeadGeo, dSkinMat);
    dHead.position.set(0, 0.52, -0.02);
    const dCap = new THREE.Mesh(dHeadGeo, dHairMat);
    dCap.position.set(0, 0.56, -0.03);
    dCap.scale.set(1.06, 0.7, 1.08);
    dGroup.add(dTorso, dHead, dCap);
    root.add(dGroup);
    driverSeatGroup = dGroup;

    // 4. Articulated Left Driver Door (+X side) with lower door card & clear side window
    const dPivot = new THREE.Group();
    dPivot.position.set(halfW - 0.06, pal.waistH * 0.65, cabCenterZ + 0.36);
    const dDoorMat = new THREE.MeshStandardMaterial({
      color: pal.police ? 0xf8fafc : pal.paintHex,
      roughness: 0.35,
      metalness: 0.45,
    });
    materialsOut.push(dDoorMat);
    const dDoorGeo = new THREE.BoxGeometry(0.08, pal.waistH * 0.44, 0.84);
    geometriesOut.push(dDoorGeo);
    const dDoorPanel = new THREE.Mesh(dDoorGeo, dDoorMat);
    dDoorPanel.position.set(0, 0, -0.42);
    dPivot.add(dDoorPanel);
    root.add(dPivot);
    doorPivotL = dPivot;

    // 5. Clear interactive glass panes (opacity 0.34, depthWrite: false, DoubleSide)
    const unitGlassGeo = new THREE.BoxGeometry(1, 1, 1);
    geometriesOut.push(unitGlassGeo);
    const winH = (pal.roofH - pal.waistH) * 0.82;
    const winY = (pal.roofH + pal.waistH) * 0.5;
    const glassDefs: Array<{
      x: number;
      y: number;
      z: number;
      w: number;
      h: number;
      d: number;
      rx?: number;
      parent?: THREE.Object3D;
    }> = [
      // Front Windshield
      { x: 0, y: winY, z: pal.cabEnd - 0.16, w: pal.width - 0.36, h: winH * 1.15, d: 0.05, rx: -0.78 },
      // Rear Glass
      { x: 0, y: winY, z: pal.cabStart + 0.16, w: pal.width - 0.38, h: winH, d: 0.05, rx: 0.72 },
      // Right Side Window
      { x: -halfW + 0.11, y: winY, z: cabCenterZ, w: 0.04, h: winH * 0.85, d: cabLen * 0.72 },
      // Left Door Window (pivots with driver door!)
      {
        x: 0,
        y: winY - pal.waistH * 0.65,
        z: -0.42,
        w: 0.04,
        h: winH * 0.85,
        d: 0.78,
        parent: dPivot,
      },
    ];
    for (let gIdx = 0; gIdx < glassDefs.length; gIdx++) {
      const gd = glassDefs[gIdx];
      const gMat = new THREE.MeshStandardMaterial({
        color: 0xbfe7ff,
        roughness: 0.08,
        metalness: 0.25,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      materialsOut.push(gMat);
      const gm = new THREE.Mesh(unitGlassGeo, gMat);
      gm.position.set(gd.x, gd.y, gd.z);
      gm.scale.set(gd.w, gd.h, gd.d);
      if (gd.rx) gm.rotation.x = gd.rx;
      gm.userData.vehiclePart = 'glass';
      gm.userData.glassIdx = gIdx;
      (gd.parent ?? root).add(gm);
      glassPanes.push({
        mesh: gm,
        state: 'intact',
        baseOpacity: 0.34,
        baseColor: 0xbfe7ff,
        baseMaterial: gMat,
      });
    }

    // 6. Roof Red/Blue Police Lightbar
    if (pal.police) {
      const lbGeo = new THREE.BoxGeometry(0.52, 0.15, 0.26);
      const lbMatA = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const lbMatB = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
      geometriesOut.push(lbGeo);
      materialsOut.push(lbMatA, lbMatB);
      const mA = new THREE.Mesh(lbGeo, lbMatA);
      mA.position.set(-0.29, pal.roofH + 0.09, cabCenterZ);
      const mB = new THREE.Mesh(lbGeo, lbMatB);
      mB.position.set(0.29, pal.roofH + 0.09, cabCenterZ);
      root.add(mA, mB);
      lightBarMeshes = [mA, mB];
    }

    // 7. Puncturable Wheels aligned cleanly at ground contact (front wheels in steering pivots)
    const xOff = halfW - 0.08;
    [-pal.wheelZ, pal.wheelZ].forEach((wz) => {
      [-xOff, xOff].forEach((wx) => {
        const wIdx = wheels.length;
        const w = new THREE.Mesh(wheelGeo, tireMat);
        w.rotation.z = Math.PI * 0.5;
        w.scale.set(pal.wheelRad, 0.26, pal.wheelRad);
        w.userData.vehiclePart = 'wheel';
        w.userData.wheelIdx = wIdx;
        if (wz > 0) {
          const steerPivot = new THREE.Group();
          steerPivot.position.set(wx, pal.wheelRad, wz);
          steerPivot.add(w);
          root.add(steerPivot);
          frontWheelSteerPivots.push(steerPivot);
        } else {
          w.position.set(wx, pal.wheelRad, wz);
          root.add(w);
        }
        wheels.push(w);
        wheelRadii.push(pal.wheelRad);
        wheelSides.push(wx < 0 ? -1 : 1);
        wheelBaseY.push(wz > 0 ? 0 : pal.wheelRad);
      });
    });
  }

  const built = pb.compile(sharedPropMats, { castShadow: false, receiveShadow: false });
  geometriesOut.push(...built.geometries);
  materialsOut.push(...built.materials);
  root.add(built.group);

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.userData.simRoadVehId = agentId;
      meshes.push(obj);
      originalMats.set(obj, obj.material);
      shootableOut.push(obj);
    }
  });

  return {
    root,
    wheels,
    frontWheelSteerPivots,
    wheelRadii,
    wheelSides,
    wheelBaseY,
    glassPanes,
    meshes,
    lightBarMeshes,
    doorPivotL,
    driverSeatGroup,
    originalMats,
    colW,
    colH,
    colD,
  };
}

function buildRoyalCarriageMesh(
  sharedGeo: SharedNpcGeos,
  geometriesOut: THREE.BufferGeometry[],
  materialsOut: THREE.Material[],
): {
  root: THREE.Group;
  horses: Array<{ legs: THREE.Group[]; tail: THREE.Mesh }>;
  wheels: THREE.Mesh[];
} {
  const root = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.82 });
  const trimGoldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.72 });
  const velvetMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 });
  const queenDressMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.55 });
  const kingRobeMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55 });
  const ermineMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.82 });
  const horseWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.68 });
  const horseManeMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.82 });
  const crystalGlassMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.08,
    metalness: 0.22,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  materialsOut.push(
    goldMat,
    trimGoldMat,
    velvetMat,
    queenDressMat,
    kingRobeMat,
    ermineMat,
    horseWhiteMat,
    horseManeMat,
    crystalGlassMat,
  );

  // Ornate Carriage Frame & Floor Deck
  const floorDeck = new THREE.Mesh(sharedGeo.propGeo, goldMat);
  floorDeck.position.set(0, 0.85, -0.35);
  floorDeck.scale.set(2.15, 0.16, 2.85);
  const plushBench = new THREE.Mesh(sharedGeo.propGeo, velvetMat);
  plushBench.position.set(0, 1.15, -0.82);
  plushBench.scale.set(1.78, 0.44, 0.78);
  const roofDome = new THREE.Mesh(sharedGeo.propGeo, goldMat);
  roofDome.position.set(0, 2.98, -0.35);
  roofDome.scale.set(2.22, 0.18, 2.9);
  const crownFinial = new THREE.Mesh(sharedGeo.sculptedHeadGeo, goldMat);
  crownFinial.position.set(0, 3.24, -0.35);
  crownFinial.scale.set(1.8, 1.4, 1.8);
  root.add(floorDeck, plushBench, roofDome, crownFinial);

  // Sculpted Gold Corner Pillars & Clear Crystal Glass Cabin Panels
  [-0.98, 0.98].forEach((px) => {
    [-1.65, 0.95].forEach((pz) => {
      const col = new THREE.Mesh(sharedGeo.propGeo, goldMat);
      col.position.set(px, 1.92, pz);
      col.scale.set(0.14, 2.02, 0.14);
      root.add(col);
    });
    const sideGlass = new THREE.Mesh(sharedGeo.propGeo, crystalGlassMat);
    sideGlass.position.set(px, 1.92, -0.35);
    sideGlass.scale.set(0.04, 1.85, 2.48);
    const sideRail = new THREE.Mesh(sharedGeo.propGeo, trimGoldMat);
    sideRail.position.set(px, 1.18, -0.35);
    sideRail.scale.set(0.12, 0.56, 2.65);
    root.add(sideGlass, sideRail);
  });
  [-1.65, 0.95].forEach((gz) => {
    const endGlass = new THREE.Mesh(sharedGeo.propGeo, crystalGlassMat);
    endGlass.position.set(0, 1.92, gz);
    endGlass.scale.set(1.86, 1.85, 0.04);
    root.add(endGlass);
  });

  // KING & QUEEN Seated Visibly Inside the Crystal & Gold Cabin!
  const makeRoyalFigure = (xOff: number, robeMat: THREE.MeshStandardMaterial, hasScepter: boolean) => {
    const grp = new THREE.Group();
    grp.position.set(xOff, 1.38, -0.68);
    const torso = new THREE.Mesh(sharedGeo.sculptedTorsoGeo, robeMat);
    torso.position.set(0, 0.28, 0);
    torso.scale.set(1.12, 1.0, 0.98);
    const cape = new THREE.Mesh(sharedGeo.propGeo, ermineMat);
    cape.position.set(0, 0.44, -0.04);
    cape.scale.set(0.46, 0.16, 0.28);
    const head = new THREE.Mesh(sharedGeo.sculptedHeadGeo, sharedGeo.skinMat);
    head.position.set(0, 0.66, 0.02);
    const crown = new THREE.Mesh(sharedGeo.propGeo, goldMat);
    crown.position.set(0, 0.85, 0.02);
    crown.scale.set(0.24, 0.14, 0.24);
    grp.add(torso, cape, head, crown);
    if (hasScepter) {
      const scepter = new THREE.Mesh(sharedGeo.propGeo, goldMat);
      scepter.position.set(0.24, 0.48, 0.22);
      scepter.scale.set(0.04, 0.72, 0.04);
      const orb = new THREE.Mesh(sharedGeo.flashGeo, goldMat);
      orb.position.set(0.24, 0.86, 0.22);
      orb.scale.setScalar(0.32);
      grp.add(scepter, orb);
    }
    root.add(grp);
  };
  makeRoyalFigure(-0.42, kingRobeMat, true);
  makeRoyalFigure(0.42, queenDressMat, false);

  // Front Royal Coachman + Trace Shafts
  const coachSeat = new THREE.Mesh(sharedGeo.propGeo, goldMat);
  coachSeat.position.set(0, 1.56, 1.24);
  coachSeat.scale.set(1.15, 0.14, 0.48);
  const coachTorso = new THREE.Mesh(sharedGeo.sculptedTorsoGeo, kingRobeMat);
  coachTorso.position.set(0, 1.88, 1.24);
  const coachHead = new THREE.Mesh(sharedGeo.sculptedHeadGeo, sharedGeo.skinMat);
  coachHead.position.set(0, 2.24, 1.24);
  const drawPole = new THREE.Mesh(sharedGeo.propGeo, trimGoldMat);
  drawPole.position.set(0, 0.92, 2.6);
  drawPole.scale.set(0.12, 0.1, 3.2);
  root.add(coachSeat, coachTorso, coachHead, drawPole);

  // 4 Spoked Golden Carriage Wheels
  const wheelRimGeo = new THREE.TorusGeometry(1, 0.12, 8, 18);
  wheelRimGeo.rotateY(Math.PI * 0.5);
  geometriesOut.push(wheelRimGeo);
  const wheels: THREE.Mesh[] = [];
  const wheelDefs: Array<[number, number, number]> = [
    [-1.16, 0.65, 1.02],
    [1.16, 0.65, 1.02],
    [-1.16, 0.82, -1.48],
    [1.16, 0.82, -1.48],
  ];
  wheelDefs.forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelRimGeo, goldMat);
    w.position.set(wx, wy, wz);
    w.scale.setScalar(wy);
    const spokeA = new THREE.Mesh(sharedGeo.propGeo, trimGoldMat);
    spokeA.scale.set(0.08, 1.9, 0.08);
    const spokeB = new THREE.Mesh(sharedGeo.propGeo, trimGoldMat);
    spokeB.scale.set(0.08, 0.08, 1.9);
    w.add(spokeA, spokeB);
    root.add(w);
    wheels.push(w);
  });

  // Twin White Trotting Carriage Horses (+Z = 3.65)
  const horses: Array<{ legs: THREE.Group[]; tail: THREE.Mesh }> = [];
  [-0.72, 0.72].forEach((hx) => {
    const hGrp = new THREE.Group();
    hGrp.position.set(hx, 0, 3.65);
    const body = new THREE.Mesh(sharedGeo.propGeo, horseWhiteMat);
    body.position.set(0, 1.15, 0);
    body.scale.set(0.62, 0.68, 1.78);
    const harness = new THREE.Mesh(sharedGeo.propGeo, goldMat);
    harness.position.set(0, 1.16, 0.35);
    harness.scale.set(0.68, 0.74, 0.24);
    const neck = new THREE.Mesh(sharedGeo.propGeo, horseWhiteMat);
    neck.position.set(0, 1.58, 0.82);
    neck.rotation.x = 0.55;
    neck.scale.set(0.34, 0.78, 0.38);
    const head = new THREE.Mesh(sharedGeo.propGeo, horseWhiteMat);
    head.position.set(0, 1.92, 1.18);
    head.rotation.x = 0.42;
    head.scale.set(0.28, 0.34, 0.58);
    const plume = new THREE.Mesh(sharedGeo.propGeo, goldMat);
    plume.position.set(0, 2.18, 1.06);
    plume.scale.set(0.14, 0.26, 0.14);
    const tail = new THREE.Mesh(sharedGeo.propGeo, horseManeMat);
    tail.position.set(0, 1.18, -0.92);
    tail.rotation.x = -0.35;
    tail.scale.set(0.14, 0.68, 0.14);
    hGrp.add(body, harness, neck, head, plume, tail);

    const legs: THREE.Group[] = [];
    [
      [-0.2, 0.62],
      [0.2, 0.62],
      [-0.2, -0.62],
      [0.2, -0.62],
    ].forEach(([lx, lz]) => {
      const piv = new THREE.Group();
      piv.position.set(lx, 0.92, lz);
      const lm = new THREE.Mesh(sharedGeo.propGeo, horseWhiteMat);
      lm.position.set(0, -0.45, 0);
      lm.scale.set(0.15, 0.9, 0.16);
      piv.add(lm);
      hGrp.add(piv);
      legs.push(piv);
    });
    root.add(hGrp);
    horses.push({ legs, tail });
  });

  return { root, horses, wheels };
}

function buildConvoyHumanActor(
  guardId: number,
  outfitHex: number,
  sharedGeo: SharedNpcGeos,
  shootableOut: THREE.Object3D[],
  materialsOut: THREE.Material[],
  opts: { isPoliceBiker?: boolean; hasHelmet?: boolean } = {},
): {
  root: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  headPivot: THREE.Group;
} {
  const shirtMat = new THREE.MeshStandardMaterial({ color: outfitHex, roughness: 0.6 });
  const pantsMat = getCachedClothMat(sharedGeo.matCache, 0x0b0f17, 0.8, materialsOut);
  materialsOut.push(shirtMat);
  const root = new THREE.Group();

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.105, 0.72, 0);
  const leftLegMesh = new THREE.Mesh(sharedGeo.sculptedLegGeo, pantsMat);
  const leftShoe = new THREE.Mesh(sharedGeo.shoeGeo, sharedGeo.shoeMat);
  leftShoe.position.set(0, -0.68, 0.04);
  leftLeg.add(leftLegMesh, leftShoe);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.105, 0.72, 0);
  const rightLegMesh = new THREE.Mesh(sharedGeo.sculptedLegGeo, pantsMat);
  const rightShoe = new THREE.Mesh(sharedGeo.shoeGeo, sharedGeo.shoeMat);
  rightShoe.position.set(0, -0.68, 0.04);
  rightLeg.add(rightLegMesh, rightShoe);

  const pelvis = new THREE.Mesh(sharedGeo.sculptedPelvisGeo, pantsMat);
  pelvis.position.set(0, 0.75, 0);
  const torso = new THREE.Mesh(sharedGeo.sculptedTorsoGeo, shirtMat);
  torso.position.set(0, 1.07, 0);
  torso.scale.set(1.08, 1.04, 1.0);
  const vestPlate = new THREE.Mesh(sharedGeo.propGeo, pantsMat);
  vestPlate.position.set(0, 1.1, 0.08);
  vestPlate.scale.set(0.32, 0.36, 0.16);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.37, 0);
  const neck = new THREE.Mesh(sharedGeo.neckGeo, sharedGeo.skinMat);
  const head = new THREE.Mesh(sharedGeo.sculptedHeadGeo, sharedGeo.skinMat);
  head.position.set(0, 0.19, 0);
  head.scale.set(1, 1.08, 1.02);
  head.userData.isHead = true;
  headPivot.add(neck, head);

  if (opts.hasHelmet) {
    const helmMat = getCachedClothMat(sharedGeo.matCache, opts.isPoliceBiker ? 0xf8fafc : 0x0f172a, 0.35, materialsOut);
    const helm = new THREE.Mesh(sharedGeo.sculptedHeadGeo, helmMat);
    helm.position.set(0, 0.22, -0.01);
    helm.scale.set(1.18, 1.12, 1.18);
    const visor = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.sunglassMat);
    visor.position.set(0, 0.2, 0.15);
    visor.scale.set(0.28, 0.1, 0.08);
    headPivot.add(helm, visor);
  } else {
    const hair = new THREE.Mesh(sharedGeo.sculptedHeadGeo, sharedGeo.hairMat);
    hair.position.set(0, 0.24, -0.02);
    hair.scale.set(1.05, 0.82, 1.06);
    const shades = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.sunglassMat);
    shades.position.set(0, 0.21, 0.15);
    shades.scale.set(0.26, 0.068, 0.05);
    headPivot.add(hair, shades);
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.25, 1.3, 0);
  const leftArmMesh = new THREE.Mesh(sharedGeo.sculptedArmGeo, shirtMat);
  const leftHand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
  leftHand.position.set(0, -0.56, 0);
  leftArm.add(leftArmMesh, leftHand);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.25, 1.3, 0);
  const rightArmMesh = new THREE.Mesh(sharedGeo.sculptedArmGeo, shirtMat);
  const rightHand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
  rightHand.position.set(0, -0.56, 0);
  rightArm.add(rightArmMesh, rightHand);

  // Heavy Oiled-Walnut & Steel AK-47 Rifle attached cleanly to right hand!
  const akMesh = sharedGeo.akPrototype.clone();
  akMesh.position.set(-0.02, -0.56, 0.12);
  akMesh.rotation.set(Math.PI * 0.5, 0, 0);
  akMesh.scale.setScalar(1.12);
  rightArm.add(akMesh);

  root.add(leftLeg, rightLeg, pelvis, torso, vestPlate, headPivot, leftArm, rightArm);

  leftLegMesh.userData.hitZone = 'leg_left';
  rightLegMesh.userData.hitZone = 'leg_right';
  pelvis.userData.hitZone = 'abdomen';
  torso.userData.hitZone = 'chest';
  head.userData.hitZone = 'head';
  leftArmMesh.userData.hitZone = 'arm_left';
  rightArmMesh.userData.hitZone = 'arm_right';
  const hitParts = [leftLegMesh, rightLegMesh, pelvis, torso, head, leftArmMesh, rightArmMesh];
  for (let i = 0; i < hitParts.length; i++) {
    hitParts[i].userData.simConvoyGuardId = guardId;
    shootableOut.push(hitParts[i]);
  }
  return { root, shirtMat, leftLeg, rightLeg, leftArm, rightArm, headPivot };
}

const BOSS_CONVOY_CIRCUIT: Array<{ x: number; z: number }> = [
  { x: -895, z: -245 },
  { x: -515, z: -245 },
  { x: -515, z: 3.2 },
  { x: -140, z: 3.2 },
  { x: -140, z: 140 },
  { x: 140, z: 140 },
  { x: 140, z: 3.2 },
  { x: 516, z: 3.2 },
  { x: 815, z: 3.2 },
  { x: 815, z: 222 },
  { x: 1105, z: 222 },
  { x: 1105, z: 0 },
  { x: 1235, z: 0 },
  { x: 1235, z: -148 },
  { x: 975, z: -148 },
  { x: 975, z: -3.2 },
  { x: 815, z: -3.2 },
  { x: 516, z: -3.2 },
  { x: 140, z: -3.2 },
  { x: 140, z: -140 },
  { x: -140, z: -140 },
  { x: -140, z: -3.2 },
  { x: -515, z: -3.2 },
  { x: -515, z: 175 },
  { x: -895, z: 175 },
];

interface VipWaypoint {
  x: number;
  y: number;
  z: number;
  stairDir?: -1 | 0 | 1;
}

interface VipHumanoidRig {
  root: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftKnee: THREE.Object3D;
  rightKnee: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftElbow: THREE.Object3D;
  rightElbow: THREE.Object3D;
  headPivot: THREE.Group;
}

function applyStairClimbKinematics(
  limbs: VipHumanoidRig,
  walkPhase: number,
  stairDir: -1 | 0 | 1,
): void {
  if (stairDir === 0) {
    limbs.root.rotation.x = 0;
    applyGtaWalkKinematics(limbs, walkPhase, 0.56, false);
    return;
  }
  const s = Math.sin(walkPhase);
  const c = Math.cos(walkPhase);
  if (stairDir > 0) {
    // Realistic stair ascent: higher knee drive, deep shin flexion on lifted step, slight forward lean
    limbs.root.rotation.x = 0.1;
    limbs.leftLeg.rotation.x = -0.22 + s * 0.58 - Math.max(0, c) * 0.24;
    limbs.rightLeg.rotation.x = -0.22 - s * 0.58 - Math.max(0, -c) * 0.24;
    limbs.leftKnee.rotation.x = 0.26 + Math.max(0, Math.sin(walkPhase + 0.55)) * 0.92;
    limbs.rightKnee.rotation.x = 0.26 + Math.max(0, Math.sin(walkPhase + Math.PI + 0.55)) * 0.92;
    limbs.leftArm.rotation.x = -s * 0.42;
    limbs.rightArm.rotation.x = s * 0.42;
    limbs.leftElbow.rotation.x = -0.35 - Math.max(0, -s) * 0.28;
    limbs.rightElbow.rotation.x = -0.35 - Math.max(0, s) * 0.28;
  } else {
    // Realistic stair descent: controlled reach-down, absorption knee bend on support leg, upright posture
    limbs.root.rotation.x = -0.05;
    limbs.leftLeg.rotation.x = -0.08 + s * 0.44;
    limbs.rightLeg.rotation.x = -0.08 - s * 0.44;
    limbs.leftKnee.rotation.x = 0.22 + Math.max(0, -c) * 0.78;
    limbs.rightKnee.rotation.x = 0.22 + Math.max(0, c) * 0.78;
    limbs.leftArm.rotation.x = -s * 0.3;
    limbs.rightArm.rotation.x = s * 0.3;
    limbs.leftElbow.rotation.x = -0.28;
    limbs.rightElbow.rotation.x = -0.28;
  }
}

function buildStaircase2Path(fromFloor: 0 | 1 | 2 | 3, toFloor: 0 | 1 | 2 | 3): VipWaypoint[] {
  const pts: VipWaypoint[] = [];
  const floorYs = [0.14, 5.8, 11.6, MANSION_ROOF_Y];
  if (fromFloor === toFloor) return pts;
  if (toFloor > fromFloor) {
    for (let fl = fromFloor; fl < toFloor; fl++) {
      const yBase = floorYs[fl];
      const yMid = yBase + 2.9;
      const yTop = floorYs[fl + 1];
      pts.push({ x: 22.4, y: yBase, z: -350.5, stairDir: 0 });
      pts.push({ x: 22.4, y: yBase, z: -352.5, stairDir: 1 });
      pts.push({ x: 22.4, y: yMid, z: -369.0, stairDir: 1 });
      pts.push({ x: 22.4, y: yMid, z: -371.4, stairDir: 0 });
      pts.push({ x: 27.6, y: yMid, z: -371.4, stairDir: 0 });
      pts.push({ x: 27.6, y: yMid, z: -369.0, stairDir: 1 });
      pts.push({ x: 27.6, y: yTop, z: -352.5, stairDir: 1 });
      pts.push({ x: 27.6, y: yTop, z: -349.6, stairDir: 0 });
    }
  } else {
    for (let fl = fromFloor; fl > toFloor; fl--) {
      const yTop = floorYs[fl];
      const yBase = floorYs[fl - 1];
      const yMid = yBase + 2.9;
      pts.push({ x: 27.6, y: yTop, z: -349.6, stairDir: 0 });
      pts.push({ x: 27.6, y: yTop, z: -352.5, stairDir: -1 });
      pts.push({ x: 27.6, y: yMid, z: -369.0, stairDir: -1 });
      pts.push({ x: 27.6, y: yMid, z: -371.4, stairDir: 0 });
      pts.push({ x: 22.4, y: yMid, z: -371.4, stairDir: 0 });
      pts.push({ x: 22.4, y: yMid, z: -369.0, stairDir: -1 });
      pts.push({ x: 22.4, y: yBase, z: -352.5, stairDir: -1 });
      pts.push({ x: 22.4, y: yBase, z: -350.5, stairDir: 0 });
    }
  }
  return pts;
}

function buildVipStyledHumanoid(
  sharedGeo: SharedNpcGeos,
  cfg: {
    isFemale: boolean;
    suitHex: number;
    accentHex: number;
    pantsHex: number;
    hairHex: number;
    hasSunglasses?: boolean;
    scale?: number;
  },
  materialsOut: THREE.Material[],
): VipHumanoidRig {
  const s = cfg.scale ?? (cfg.isFemale ? 0.96 : 1.04);
  const topMat = getCachedClothMat(sharedGeo.matCache, cfg.suitHex, cfg.isFemale ? 0.42 : 0.65, materialsOut);
  const pantsMat = getCachedClothMat(sharedGeo.matCache, cfg.pantsHex, 0.78, materialsOut);
  const accentMat = getCachedClothMat(sharedGeo.matCache, cfg.accentHex, 0.35, materialsOut);
  const hairMat = getCachedClothMat(sharedGeo.matCache, cfg.hairHex, 0.82, materialsOut);
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';

  const makeLeg = (hipX: number) => {
    const hip = new THREE.Group();
    hip.position.set(hipX * s, 0.72 * s, 0);
    const thigh = new THREE.Mesh(sharedGeo.sculptedThighGeo, cfg.isFemale ? sharedGeo.skinMat : pantsMat);
    thigh.scale.setScalar(s * (cfg.isFemale ? 0.88 : 1.0));
    const knee = new THREE.Group();
    knee.position.set(0, -0.34 * s, 0);
    const calf = new THREE.Mesh(sharedGeo.sculptedCalfGeo, cfg.isFemale ? sharedGeo.skinMat : pantsMat);
    calf.scale.setScalar(s * (cfg.isFemale ? 0.86 : 1.0));
    const shoe = new THREE.Mesh(sharedGeo.shoeGeo, cfg.isFemale ? accentMat : sharedGeo.shoeMat);
    shoe.position.set(0, -0.34 * s, 0.045 * s);
    shoe.scale.setScalar(s);
    knee.add(calf, shoe);
    hip.add(thigh, knee);
    return { hip, knee };
  };
  const lLeg = makeLeg(-0.105);
  const rLeg = makeLeg(0.105);

  const pelvis = new THREE.Mesh(sharedGeo.sculptedPelvisGeo, cfg.isFemale ? topMat : pantsMat);
  pelvis.position.set(0, 0.75 * s, 0);
  pelvis.scale.setScalar(s);

  const torso = new THREE.Mesh(sharedGeo.sculptedTorsoGeo, topMat);
  torso.position.set(0, 1.07 * s, 0);
  torso.scale.set(cfg.isFemale ? 0.88 * s : 1.06 * s, s, cfg.isFemale ? 0.84 * s : 0.96 * s);

  if (cfg.isFemale) {
    // Evening gown draped skirt + metallic clutch accent
    const gown = new THREE.Mesh(sharedGeo.sculptedPelvisGeo, topMat);
    gown.position.set(0, 0.56 * s, 0);
    gown.scale.set(1.22 * s, 2.35 * s, 1.24 * s);
    const belt = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    belt.position.set(0, 0.88 * s, 0.02 * s);
    belt.scale.set(0.32 * s, 0.05 * s, 0.24 * s);
    root.add(gown, belt);
  } else {
    // Dress shirt V-front & tie/lapel accent
    const shirtFront = new THREE.Mesh(sharedGeo.torsoGeo, sharedGeo.cigPaperMat);
    shirtFront.position.set(0, 1.13 * s, 0.145 * s);
    shirtFront.scale.set(0.18 * s, 0.34 * s, 0.04 * s);
    const tie = new THREE.Mesh(sharedGeo.torsoGeo, accentMat);
    tie.position.set(0, 1.08 * s, 0.16 * s);
    tie.scale.set(0.065 * s, 0.32 * s, 0.03 * s);
    root.add(shirtFront, tie);
  }

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.37 * s, 0);
  const neck = new THREE.Mesh(sharedGeo.neckGeo, sharedGeo.skinMat);
  neck.scale.setScalar(s);
  const head = new THREE.Mesh(sharedGeo.sculptedHeadGeo, sharedGeo.skinMat);
  head.position.set(0, 0.19 * s, 0);
  head.scale.set(s, 1.08 * s, 1.02 * s);
  const hair = new THREE.Mesh(sharedGeo.sculptedHeadGeo, hairMat);
  hair.position.set(0, (cfg.isFemale ? 0.22 : 0.24) * s, -0.02 * s);
  hair.scale.set((cfg.isFemale ? 1.12 : 1.05) * s, (cfg.isFemale ? 1.18 : 0.82) * s, (cfg.isFemale ? 1.15 : 1.06) * s);
  headPivot.add(neck, head, hair);
  if (cfg.isFemale) {
    const hairBack = new THREE.Mesh(sharedGeo.torsoGeo, hairMat);
    hairBack.position.set(0, 0.02 * s, -0.11 * s);
    hairBack.scale.set(0.26 * s, 0.34 * s, 0.1 * s);
    headPivot.add(hairBack);
  }
  if (cfg.hasSunglasses) {
    const shades = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.sunglassMat);
    shades.position.set(0, 0.21 * s, 0.15 * s);
    shades.scale.set(0.25 * s, 0.065 * s, 0.05 * s);
    headPivot.add(shades);
  }

  const makeArm = (sx: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * s, 1.3 * s, 0);
    const upper = new THREE.Mesh(sharedGeo.sculptedUpperArmGeo, cfg.isFemale ? sharedGeo.skinMat : topMat);
    upper.scale.setScalar(s * (cfg.isFemale ? 0.82 : 1.0));
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.27 * s, 0);
    const fore = new THREE.Mesh(sharedGeo.sculptedForearmGeo, cfg.isFemale ? sharedGeo.skinMat : topMat);
    fore.scale.setScalar(s * (cfg.isFemale ? 0.82 : 1.0));
    const hand = new THREE.Mesh(sharedGeo.handGeo, sharedGeo.skinMat);
    hand.position.set(0, -0.28 * s, 0);
    hand.scale.setScalar(s);
    elbow.add(fore, hand);
    shoulder.add(upper, elbow);
    return { shoulder, elbow };
  };
  const lArm = makeArm(-0.245);
  const rArm = makeArm(0.245);
  if (cfg.isFemale) {
    const purse = new THREE.Mesh(sharedGeo.propGeo, accentMat);
    purse.position.set(0, -0.32 * s, 0.04 * s);
    purse.scale.set(0.08 * s, 0.18 * s, 0.22 * s);
    rArm.elbow.add(purse);
  }

  root.add(lLeg.hip, rLeg.hip, pelvis, torso, headPivot, lArm.shoulder, rArm.shoulder);
  return {
    root,
    leftLeg: lLeg.hip,
    rightLeg: rLeg.hip,
    leftKnee: lLeg.knee,
    rightKnee: rLeg.knee,
    leftArm: lArm.shoulder,
    rightArm: rArm.shoulder,
    leftElbow: lArm.elbow,
    rightElbow: rArm.elbow,
    headPivot,
  };
}

function buildAwaisPrivateHelicopter(
  geometriesOut: THREE.BufferGeometry[],
  materialsOut: THREE.Material[],
): {
  root: THREE.Group;
  mainRotorPivot: THREE.Group;
  tailRotorPivot: THREE.Group;
  rotorBlurMesh: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
} {
  const root = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.2, metalness: 0.62 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.26, metalness: 0.85 });
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.34, metalness: 0.78 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.08,
    metalness: 0.25,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const blurMat = new THREE.MeshBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, toneMapped: false });
  materialsOut.push(hullMat, trimMat, skidMat, glassMat, blurMat, beaconMat);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const blurGeo = new THREE.CylinderGeometry(5.2, 5.2, 0.02, 24);
  geometriesOut.push(boxGeo, cylGeo, blurGeo);

  // Sleek fuselage cabin, nose & engine cowling
  const cabin = new THREE.Mesh(boxGeo, hullMat);
  cabin.position.set(0, 1.48, 0.35);
  cabin.scale.set(1.86, 1.32, 3.6);
  const nose = new THREE.Mesh(boxGeo, hullMat);
  nose.position.set(0, 1.15, 2.45);
  nose.rotation.x = 0.22;
  nose.scale.set(1.56, 0.86, 1.35);
  const canopy = new THREE.Mesh(boxGeo, glassMat);
  canopy.position.set(0, 1.72, 1.85);
  canopy.rotation.x = 0.42;
  canopy.scale.set(1.62, 0.74, 1.65);
  const turbinePod = new THREE.Mesh(cylGeo, hullMat);
  turbinePod.rotation.x = Math.PI * 0.5;
  turbinePod.position.set(0, 2.34, -0.35);
  turbinePod.scale.set(0.92, 2.6, 0.92);
  const goldAccent = new THREE.Mesh(boxGeo, trimMat);
  goldAccent.position.set(0, 1.05, 0.2);
  goldAccent.scale.set(1.9, 0.07, 4.1);
  root.add(cabin, nose, canopy, turbinePod, goldAccent);

  // Tail boom, horizontal stabilizer, vertical fin & ducted tail rotor
  const tailBoom = new THREE.Mesh(boxGeo, hullMat);
  tailBoom.position.set(0, 1.56, -3.55);
  tailBoom.scale.set(0.42, 0.48, 4.5);
  const vFin = new THREE.Mesh(boxGeo, hullMat);
  vFin.position.set(0, 2.08, -5.55);
  vFin.rotation.x = -0.25;
  vFin.scale.set(0.14, 1.45, 0.72);
  const hStab = new THREE.Mesh(boxGeo, trimMat);
  hStab.position.set(0, 1.56, -4.75);
  hStab.scale.set(1.9, 0.08, 0.42);
  root.add(tailBoom, vFin, hStab);

  // Landing skids
  [-0.92, 0.92].forEach((sx) => {
    const skid = new THREE.Mesh(cylGeo, skidMat);
    skid.rotation.x = Math.PI * 0.5;
    skid.position.set(sx, 0.1, 0.45);
    skid.scale.set(0.12, 4.2, 0.12);
    const strutF = new THREE.Mesh(boxGeo, skidMat);
    strutF.position.set(sx * 0.85, 0.55, 1.35);
    strutF.rotation.z = sx < 0 ? -0.26 : 0.26;
    strutF.scale.set(0.08, 0.92, 0.12);
    const strutR = strutF.clone();
    strutR.position.z = -0.65;
    root.add(skid, strutF, strutR);
  });

  // Main Rotor Assembly
  const mainRotorPivot = new THREE.Group();
  mainRotorPivot.position.set(0, 2.92, 0.15);
  const mast = new THREE.Mesh(cylGeo, skidMat);
  mast.position.set(0, -0.18, 0);
  mast.scale.set(0.18, 0.48, 0.18);
  mainRotorPivot.add(mast);
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.Mesh(boxGeo, hullMat);
    blade.rotation.y = (b * Math.PI) / 2;
    const isX = b % 2 === 0;
    blade.scale.set(isX ? 10.4 : 0.24, 0.04, isX ? 0.24 : 10.4);
    mainRotorPivot.add(blade);
  }
  const rotorBlurMesh = new THREE.Mesh(blurGeo, blurMat);
  rotorBlurMesh.position.y = -0.02;
  mainRotorPivot.add(rotorBlurMesh);
  root.add(mainRotorPivot);

  // Tail Rotor Assembly
  const tailRotorPivot = new THREE.Group();
  tailRotorPivot.position.set(0.18, 2.08, -5.65);
  for (let tb = 0; tb < 2; tb++) {
    const tBlade = new THREE.Mesh(boxGeo, trimMat);
    tBlade.scale.set(0.03, tb === 0 ? 1.1 : 0.12, tb === 0 ? 0.12 : 1.1);
    tailRotorPivot.add(tBlade);
  }
  const beacon = new THREE.Mesh(cylGeo, beaconMat);
  beacon.position.set(0, 2.86, -5.55);
  beacon.scale.set(0.14, 0.14, 0.14);
  root.add(tailRotorPivot, beacon);

  // Dual "AWAIS BALOCH" Fuselage Nameplate & Portrait Display Screen
  if (typeof document !== 'undefined') {
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 512;
    plateCanvas.height = 128;
    const pCtx = plateCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = '#070b14';
      pCtx.fillRect(0, 0, 512, 128);
      pCtx.strokeStyle = '#fbbf24';
      pCtx.lineWidth = 6;
      pCtx.strokeRect(4, 4, 504, 120);
      pCtx.textAlign = 'center';
      pCtx.fillStyle = '#fde68a';
      pCtx.font = 'bold 20px monospace';
      pCtx.fillText('PRIVATE VIP AVIATION', 256, 36);
      pCtx.fillStyle = '#ffffff';
      pCtx.font = '900 48px sans-serif';
      pCtx.fillText('AWAIS BALOCH', 256, 94);
    }
    const plateTex = new THREE.CanvasTexture(plateCanvas);
    plateTex.colorSpace = THREE.SRGBColorSpace;
    const plateMat = new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: false });
    materialsOut.push(plateMat);
    const plateGeo = new THREE.PlaneGeometry(2.15, 0.52);
    geometriesOut.push(plateGeo);
    [-0.95, 0.95].forEach((px) => {
      const pMesh = new THREE.Mesh(plateGeo, plateMat);
      pMesh.position.set(px, 1.72, -0.55);
      pMesh.rotation.y = px > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      root.add(pMesh);
    });

    const scrCanvas = document.createElement('canvas');
    scrCanvas.width = 320;
    scrCanvas.height = 384;
    const sCtx = scrCanvas.getContext('2d');
    const drawPortraitScreen = (img?: HTMLImageElement) => {
      if (!sCtx) return;
      sCtx.fillStyle = '#070b14';
      sCtx.fillRect(0, 0, 320, 384);
      if (img && img.naturalWidth > 0) {
        const aspect = 320 / 308;
        const imgAspect = img.naturalWidth / img.naturalHeight;
        let sx = 0;
        let sy = 0;
        let sw = img.naturalWidth;
        let sh = img.naturalHeight;
        if (imgAspect > aspect) {
          sw = img.naturalHeight * aspect;
          sx = (img.naturalWidth - sw) * 0.5;
        } else {
          sh = img.naturalWidth / aspect;
          sy = Math.max(0, (img.naturalHeight - sh) * 0.25);
        }
        sCtx.drawImage(img, sx, sy, sw, sh, 6, 6, 308, 304);
      } else {
        sCtx.fillStyle = '#111827';
        sCtx.fillRect(6, 6, 308, 304);
        sCtx.fillStyle = '#fbbf24';
        sCtx.beginPath();
        sCtx.arc(160, 125, 42, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.fillRect(102, 180, 116, 110);
      }
      sCtx.fillStyle = '#0f172a';
      sCtx.fillRect(0, 312, 320, 72);
      sCtx.strokeStyle = '#fbbf24';
      sCtx.lineWidth = 4;
      sCtx.strokeRect(4, 4, 312, 376);
      sCtx.textAlign = 'center';
      sCtx.fillStyle = '#fbbf24';
      sCtx.font = 'bold 14px monospace';
      sCtx.fillText('OWNER', 160, 334);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = '900 28px sans-serif';
      sCtx.fillText('AWAIS BALOCH', 160, 366);
    };
    drawPortraitScreen();
    const scrTex = new THREE.CanvasTexture(scrCanvas);
    scrTex.colorSpace = THREE.SRGBColorSpace;
    const scrMat = new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false });
    materialsOut.push(scrMat);
    const scrGeo = new THREE.PlaneGeometry(0.92, 1.08);
    geometriesOut.push(scrGeo);
    [-0.96, 0.96].forEach((px) => {
      const sMesh = new THREE.Mesh(scrGeo, scrMat);
      sMesh.position.set(px, 1.46, 0.88);
      sMesh.rotation.y = px > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      root.add(sMesh);
    });
    const portraitImg = new Image();
    portraitImg.onload = () => {
      drawPortraitScreen(portraitImg);
      scrTex.needsUpdate = true;
    };
    portraitImg.src = './assets/aistudio/bd6abcd88d333329229ec97b44253c79_0375cc05.jpg';
  }

  return { root, mainRotorPivot, tailRotorPivot, rotorBlurMesh, beaconMat };
}

interface VipBillionaireCarCouple {
  id: number;
  root: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheelSteerPivots: THREE.Group[];
  wheelRadii: number[];
  doorPivotL?: THREE.Group;
  x: number;
  y: number;
  z: number;
  yaw: number;
  stage:
    | 'approach_gate'
    | 'wait_gate_in'
    | 'drive_park'
    | 'couple_enter'
    | 'party_dance'
    | 'couple_exit'
    | 'wait_gate_out'
    | 'drive_away'
    | 'away_cooldown';
  stageTimer: number;
  parkSlot: { x: number; z: number; yaw: number };
  partySpot: { x: number; z: number };
  driveWps: Array<{ x: number; z: number }>;
  driveWpIdx: number;
  couple: [VipHumanoidRig, VipHumanoidRig];
  couplePos: [{ x: number; y: number; z: number; yaw: number; phase: number }, { x: number; y: number; z: number; yaw: number; phase: number }];
  coupleWps: VipWaypoint[];
  coupleWpIdx: number;
}

interface AwaisHeliGuestController {
  heliRoot: THREE.Group;
  mainRotorPivot: THREE.Group;
  tailRotorPivot: THREE.Group;
  rotorBlurMesh: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
  x: number;
  y: number;
  z: number;
  yaw: number;
  rotorSpeed: number;
  stage: 'fly_in' | 'land_settle' | 'couple_descend' | 'party_dance' | 'couple_ascend' | 'takeoff' | 'away_cooldown';
  stageTimer: number;
  guards: Array<{ rig: VipHumanoidRig; x: number; y: number; z: number; yaw: number }>;
  awais: VipHumanoidRig;
  partner: VipHumanoidRig;
  awaisState: { x: number; y: number; z: number; yaw: number; phase: number };
  partnerState: { x: number; y: number; z: number; yaw: number; phase: number };
  wps: VipWaypoint[];
  wpIdx: number;
}

export class SimulatorNpcManager {
  public readonly root = new THREE.Group();
  public readonly tableSystem: TableReservationSystem;
  public readonly npcs: HumanoidNpc[] = [];
  public readonly roadAgents: AmbientRoadAgent[] = [];
  public readonly gangSquads: GangSquadState[] = [];
  private readonly royalGuards: RoyalCastleGuard[] = [];
  private royalCarriage: RoyalCarriageState | null = null;
  private readonly convoyVehicles: ConvoyVehicleUnit[] = [];
  private readonly convoyGuards: ConvoyGuardUnit[] = [];
  private convoyPathSegs: Array<{ x0: number; z0: number; dx: number; dz: number; len: number; cumLen: number }> = [];
  private convoyTotalLen = 1;
  private convoyProgressDist = 920; // Starts near West->Central Bridge approach so easy to encounter!
  private convoyHostile = false;
  private convoyAlertTimer = 0;
  private convoyRespawnTimer = 0;
  private readonly gangVisuals: GangMemberVisual[] = [];
  private readonly vipCarCouples: VipBillionaireCarCouple[] = [];
  private awaisHeliGuest: AwaisHeliGuestController | null = null;
  private readonly mansionGateActorsScratch: Array<{ x: number; z: number }> = [];
  private readonly policeOfficers: PoliceOfficerActor[] = [];
  private readonly ejectedDrivers: EjectedDriverActor[] = [];
  private readonly severedHeads: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }> = [];
  private readonly bloodDrops: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }> = [];
  private readonly bloodPools: Array<{ mesh: THREE.Mesh; targetScale: number; life: number }> = [];
  private readonly npcPairBuckets = new Map<number, HumanoidNpc[]>();
  private readonly vehicleBuckets = new Map<number, Array<{ x: number; z: number; yaw: number; r: number; speed: number; agentIdx: number }>>();
  private readonly colliderGrid: ColliderSpatialGrid;
  private frameTick = 0;
  private simAccum = 1 / 12;
  private readonly shootableMeshes: THREE.Object3D[] = [];
  private readonly respawnPool: Array<{ x: number; y: number; z: number }> = [];
  private readonly allFuelBays: Array<{ x: number; z: number; yaw: number }> = [];
  private readonly steamPuffs: SteamPuff[] = [];
  private readonly obstacleBlockers: Array<{ x: number; z: number; radius: number }> = [];
  private readonly env: MegaWorldEnvironmentData;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly isSoftwareGl: boolean;
  private sharedGeo!: SharedNpcGeos;
  private charredVehicleMat!: THREE.MeshStandardMaterial;
  private policeUniformMat!: THREE.MeshStandardMaterial;
  private policeHatMat!: THREE.MeshStandardMaterial;
  private policeBadgeMat!: THREE.MeshStandardMaterial;
  private nextPoliceOfficerId = 80000;
  private currentPhase: TimeOfDayPhase = 'morning';
  private manualDayDepartureActive = false;
  private lastElapsedSec = 0;
  private globalHornCooldown = 0;

  constructor(env: MegaWorldEnvironmentData, isSoftwareGl: boolean) {
    this.env = env;
    this.isSoftwareGl = isSoftwareGl;
    this.colliderGrid = createColliderSpatialGrid(env.colliders ?? [], 24);
    this.tableSystem = new TableReservationSystem(env.seats);

    if (env.gasStations) {
      for (let i = 0; i < env.gasStations.length; i++) {
        this.allFuelBays.push(...env.gasStations[i].fuelBays);
      }
    }

    this.buildRespawnPool();
    this.buildSharedAssetsAndSpawn();
  }

  private spawnNeckBloodJet(nx: number, ny: number, nz: number, count: number): void {
    if (!this.sharedGeo || this.bloodDrops.length > 90) return;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.sharedGeo.bloodDropGeo, this.sharedGeo.bloodDropMat);
      m.position.set(nx + (Math.random() - 0.5) * 0.08, ny, nz + (Math.random() - 0.5) * 0.08);
      m.scale.setScalar(0.85 + Math.random() * 0.85);
      this.root.add(m);
      const ang = Math.random() * Math.PI * 2;
      const spread = 0.45 + Math.random() * 1.15;
      this.bloodDrops.push({
        mesh: m,
        vx: Math.cos(ang) * spread,
        vy: 3.1 + Math.random() * 2.2,
        vz: Math.sin(ang) * spread,
        life: 0.72 + Math.random() * 0.25,
      });
    }
  }

  private triggerHeadshotDecapitation(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirZ: number,
    headPivot?: THREE.Group,
    neckStump?: THREE.Mesh,
  ): void {
    if (headPivot) headPivot.visible = false;
    if (neckStump) neckStump.visible = true;
    if (!this.sharedGeo) return;
    if (this.severedHeads.length < 18) {
      const headMesh = new THREE.Mesh(this.sharedGeo.sculptedHeadGeo, this.sharedGeo.skinMat);
      headMesh.position.set(x, y + 1.54, z);
      headMesh.scale.set(1, 1.08, 1.02);
      this.root.add(headMesh);
      this.severedHeads.push({
        mesh: headMesh,
        vx: dirX * 3.4 + (Math.random() - 0.5) * 1.6,
        vy: 3.8 + Math.random() * 1.6,
        vz: dirZ * 3.4 + (Math.random() - 0.5) * 1.6,
        life: 5.5,
      });
    }
    this.spawnNeckBloodJet(x, y + 1.38, z, 10);
    if (this.bloodPools.length < 24) {
      const gy = this.env.groundHeightAt(x, z, y);
      const pool = new THREE.Mesh(this.sharedGeo.bloodPoolGeo, this.sharedGeo.bloodStumpMat);
      pool.position.set(x, gy + 0.015, z);
      pool.scale.set(0.25, 1, 0.25);
      this.root.add(pool);
      this.bloodPools.push({ mesh: pool, targetScale: 1.45 + Math.random() * 0.45, life: 9.0 });
    }
  }

  public getTotalCitizenAndVehicleCount(): number {
    return (
      this.npcs.length +
      this.roadAgents.length +
      this.convoyVehicles.length +
      this.convoyGuards.length +
      this.gangVisuals.length +
      this.royalGuards.length +
      this.policeOfficers.filter((o) => o.active).length
    );
  }

  public getShootableMeshes(): THREE.Object3D[] {
    return this.shootableMeshes;
  }

  /**
   * Zero-allocation soft aim magnetism target lookup across NPCs, Gangs, Guards, Police & Boss Convoy Guards.
   */
  public findBestAimAssistTarget(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    minCos: number,
    maxDist: number,
  ): { x: number; y: number; z: number } | null {
    let bestCos = minCos;
    let bestX = 0;
    let bestY = 0;
    let bestZ = 0;
    let found = false;
    const maxDistSq = maxDist * maxDist;

    const considerPoint = (px: number, py: number, pz: number) => {
      const vx = px - ox;
      const vy = py - oy;
      const vz = pz - oz;
      const dSq = vx * vx + vy * vy + vz * vz;
      if (dSq > maxDistSq || dSq < 1.2) return;
      const invLen = 1 / Math.sqrt(dSq);
      const c = (vx * dx + vy * dy + vz * dz) * invLen;
      if (c > bestCos) {
        bestCos = c;
        bestX = px;
        bestY = py;
        bestZ = pz;
        found = true;
      }
    };

    for (let i = 0; i < this.gangVisuals.length; i++) {
      const m = this.gangVisuals[i].state;
      if (!m.dead) {
        considerPoint(m.x, m.y + 1.52, m.z);
        considerPoint(m.x, m.y + 1.14, m.z);
      }
    }
    for (let i = 0; i < this.convoyGuards.length; i++) {
      const cg = this.convoyGuards[i];
      if (!cg.dead) {
        considerPoint(cg.x, cg.y + 1.52, cg.z);
        considerPoint(cg.x, cg.y + 1.14, cg.z);
      }
    }
    for (let i = 0; i < this.policeOfficers.length; i++) {
      const po = this.policeOfficers[i];
      if (po.active && !po.dead) {
        considerPoint(po.x, po.y + 1.52, po.z);
        considerPoint(po.x, po.y + 1.14, po.z);
      }
    }
    for (let i = 0; i < this.royalGuards.length; i++) {
      const rg = this.royalGuards[i];
      if (!rg.dead) {
        const yBase = rg.y + (rg.isMounted ? 2.25 : 1.18);
        considerPoint(rg.x, yBase + 0.34, rg.z);
        considerPoint(rg.x, yBase, rg.z);
      }
    }
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      if (n.dead || n.isProtectedChild || !n.root.visible) continue;
      considerPoint(n.x, n.y + 1.48, n.z);
      considerPoint(n.x, n.y + 1.08, n.z);
    }

    return found ? { x: bestX, y: bestY, z: bestZ } : null;
  }

  public getVehicleColliders(): SimColliderBox[] {
    const boxes: SimColliderBox[] = [];
    for (let i = 0; i < this.roadAgents.length; i++) {
      const v = this.roadAgents[i];
      if (!v.root.visible) continue;
      const gy = this.env.groundHeightAt(v.x, v.z, 0);
      boxes.push(buildOrientedBoxCollider(v.x, gy, v.z, v.colW, v.colH, v.colD, v.yaw));
    }
    return boxes;
  }

  private mapRoadKindToPlayerVehicle(kind: AmbientRoadAgent['kind']): {
    vehicleKind: VehicleKind;
    bikeStyle?: BikeStyleId;
    isBike: boolean;
  } {
    if (kind === 'motorcycle' || kind === 'bicycle') {
      return { vehicleKind: 'digital_bike', bikeStyle: 'volt_green', isBike: true };
    }
    if (kind === 'sport_moto') {
      return { vehicleKind: 'digital_bike', bikeStyle: 'arctic_orange', isBike: true };
    }
    if (kind === 'city_scooter') {
      return { vehicleKind: 'digital_bike', bikeStyle: 'emerald_stealth', isBike: true };
    }
    if (kind === 'police') {
      return { vehicleKind: 'range_black_suv', isBike: false };
    }
    return { vehicleKind: kind, isBike: false };
  }

  public findNearestHijackableRoadAgent(pos: THREE.Vector3, maxDist = 5.8): NearbyHijackVehicleInfo | null {
    let best: NearbyHijackVehicleInfo | null = null;
    let bestDist = maxDist;
    for (let i = 0; i < this.roadAgents.length; i++) {
      const v = this.roadAgents[i];
      if (!v.root.visible || v.destroyed) continue;
      const d = Math.hypot(v.x - pos.x, v.z - pos.z);
      if (d > bestDist) continue;
      const gy = this.env.groundHeightAt(v.x, v.z, 0);
      if (Math.abs(gy - pos.y) > 3.5) continue;
      bestDist = d;
      const mapped = this.mapRoadKindToPlayerVehicle(v.kind);
      best = {
        agentId: v.id,
        name: v.kind === 'police' ? 'Police Interceptor SVR' : VEHICLE_SPECS[mapped.vehicleKind].name,
        isBike: mapped.isBike,
      };
    }
    return best;
  }

  public hijackRoadAgent(agentId: number): {
    vehicleKind: VehicleKind;
    bikeStyle?: BikeStyleId;
    x: number;
    y: number;
    z: number;
    yaw: number;
    speed: number;
    isPolice: boolean;
  } | null {
    const v = this.roadAgents.find((r) => r.id === agentId);
    if (!v || !v.root.visible || v.destroyed) return null;
    const vy = this.env.groundHeightAt(v.x, v.z, 0);
    const mapped = this.mapRoadKindToPlayerVehicle(v.kind);

    // Throw ejected NPC driver cleanly outward & slightly upward beside left car door
    const ejectOutX = Math.cos(v.yaw);
    const ejectOutZ = -Math.sin(v.yaw);
    const spawnEx = v.x + ejectOutX * 1.25;
    const spawnEz = v.z + ejectOutZ * 1.25;
    const driverSpec = NPC_ROLE_CATALOG[0];
    const driverBuilt = buildNpcMesh(
      95000 + v.id,
      {
        ...driverSpec,
        shirtHex: v.kind === 'police' ? 0x1e3a8a : 0x2563eb,
        pantsHex: 0x0f172a,
        propKind: 'none',
      },
      this.sharedGeo,
      {},
      [],
    );
    this.materials.push(...driverBuilt.mats);
    driverBuilt.root.position.set(spawnEx, vy + 0.65, spawnEz);
    driverBuilt.root.rotation.order = 'YXZ';
    driverBuilt.root.rotation.set(Math.PI * 0.45, v.yaw, 0.35);
    this.root.add(driverBuilt.root);
    this.ejectedDrivers.push({
      id: 95000 + v.id,
      root: driverBuilt.root,
      shirtMat: driverBuilt.shirtMat,
      leftLeg: driverBuilt.leftLeg,
      rightLeg: driverBuilt.rightLeg,
      leftArm: driverBuilt.leftArm,
      rightArm: driverBuilt.rightArm,
      x: spawnEx,
      y: vy + 0.65,
      z: spawnEz,
      yaw: v.yaw,
      vx: ejectOutX * 5.8,
      vy: 3.4,
      vz: ejectOutZ * 5.8,
      rollAngle: 0,
      stunTimer: 1.55,
      fleeTimer: 5.0,
      walkPhase: 0,
    });

    const isPolice = v.kind === 'police';
    // Hide the ambient road agent for 28s while player drives the spawned player vehicle
    v.destroyed = true;
    v.speed = 0;
    v.hideTimer = 0;
    v.respawnTimer = 28.0;
    v.policeMode = 'patrol';
    v.policeAlertTimer = 0;
    v.root.visible = false;

    return {
      vehicleKind: mapped.vehicleKind,
      bikeStyle: mapped.bikeStyle,
      x: v.x,
      y: vy,
      z: v.z,
      yaw: v.yaw + Math.PI, // Convert +Z ambient car heading to -Z player vehicle heading
      speed: Math.min(v.speed * 0.45, 8.0),
      isPolice,
    };
  }

  public damageByMesh(
    mesh: THREE.Object3D,
    damage: number,
    hitPoint: THREE.Vector3,
    attackerPos: THREE.Vector3,
    weaponId?: WeaponId,
  ): SimulatorHitResult {
    const rawZone = (mesh.userData.hitZone as HitZone | undefined) ?? 'chest';
    const isHead = Boolean(mesh.userData.isHead) || rawZone === 'head';
    const hitDx = hitPoint.x - attackerPos.x;
    const hitDz = hitPoint.z - attackerPos.z;
    const hitLen = Math.hypot(hitDx, hitDz) || 1;
    const dirX = hitDx / hitLen;
    const dirZ = hitDz / hitLen;

    const getMultiplier = (zone: HitZone) =>
      zone === 'head'
        ? 2.8
        : zone === 'abdomen'
          ? 1.15
          : zone === 'back'
            ? 1.1
            : zone === 'leg_left' || zone === 'leg_right'
              ? 0.72
              : zone === 'arm_left' || zone === 'arm_right'
                ? 0.78
                : 1.0;

    const gangId = mesh.userData.simGangId as number | undefined;
    if (gangId !== undefined) {
      const gv = this.gangVisuals.find((g) => g.state.id === gangId);
      if (gv && !gv.state.dead) {
        const hitZone = isHead
          ? 'head'
          : resolveDirectionalHitZone(rawZone, gv.state.yaw, dirX, dirZ, hitPoint.y - gv.state.y);
        provokeGangSquad(this.gangSquads, gv.squadIdx, attackerPos.x, attackerPos.z);
        const dmg = Math.round(damage * getMultiplier(hitZone));
        gv.state.hp -= dmg;
        gv.hitFlashTimer = 0.16;
        gv.hitDirX = dirX;
        gv.hitDirZ = dirZ;
        if (hitZone === 'leg_left' || hitZone === 'leg_right') {
          gv.limping = true;
          gv.staggerTimer = 0.56;
          gv.staggerKind = hitZone;
        } else {
          gv.staggerTimer = hitZone === 'abdomen' ? 0.44 : 0.36;
          gv.staggerKind = hitZone === 'head' ? 'chest' : hitZone;
        }
        if (gv.state.hp <= 0) {
          gv.state.hp = 0;
          gv.state.dead = true;
          gv.deathDuration = 3.2;
          gv.fallTimer = 3.2;
          gv.deathStyle = selectDeathActingStyle(hitZone, weaponId, gv.state.id);
          gv.state.respawnTimer = 14.0;
          if (hitZone === 'head') {
            gv.decapitated = true;
            gv.bloodEmitTimer = 0.72;
            this.triggerHeadshotDecapitation(gv.state.x, gv.state.y, gv.state.z, dirX, dirZ, gv.headPivot, gv.neckStump);
          } else {
            gv.decapitated = false;
          }
          const sq = this.gangSquads[gv.squadIdx];
          const isBoss = gv.state.role === 'boss';
          return {
            hit: true,
            killed: true,
            isHead,
            hitZone,
            kind: 'gang',
            label: isBoss
              ? `[BOSS ELIMINATED] ${sq?.bossName ?? 'Gang Boss'}`
              : `${sq?.name ?? 'Gang'} Member`,
          };
        }
        return { hit: true, killed: false, isHead, hitZone, kind: 'gang' };
      }
    }

    const npcId = mesh.userData.simNpcId as number | undefined;
    if (npcId !== undefined) {
      const npc = this.npcs.find((n) => n.id === npcId);
      if (npc && !npc.dead) {
        if (npc.isProtectedChild) {
          return {
            hit: false,
            killed: false,
            isHead: false,
            kind: 'npc',
            label: npc.spec.label,
            protectedBlocked: true,
          };
        }
        const hitZone = isHead
          ? 'head'
          : resolveDirectionalHitZone(rawZone, npc.yaw, dirX, dirZ, hitPoint.y - npc.y);
        const dmg = Math.round(damage * getMultiplier(hitZone));
        npc.hp -= dmg;
        if (!npc.shirtMatCloned) {
          npc.shirtMat = npc.shirtMat.clone();
          npc.shirtMatCloned = true;
          this.materials.push(npc.shirtMat);
          if (npc.torsoMesh) npc.torsoMesh.material = npc.shirtMat;
          if (npc.leftArmMesh) npc.leftArmMesh.material = npc.shirtMat;
          if (npc.rightArmMesh) npc.rightArmMesh.material = npc.shirtMat;
        }
        npc.hitFlashTimer = 0.16;
        npc.hitDirX = dirX;
        npc.hitDirZ = dirZ;
        if (
          npc.heldPropObj &&
          !npc.propDropped &&
          (hitZone === 'arm_left' || hitZone === 'arm_right' || npc.hp <= 0)
        ) {
          npc.propDropped = true;
          npc.heldPropObj.visible = false;
        }
        if (hitZone === 'leg_left' || hitZone === 'leg_right') {
          npc.limping = true;
          npc.staggerTimer = 0.65;
          npc.staggerKind = hitZone;
        } else {
          npc.staggerTimer = hitZone === 'abdomen' ? 0.48 : 0.4;
          npc.staggerKind = hitZone === 'head' ? 'chest' : hitZone;
        }
        if (npc.hp <= 0) {
          this.killNpc(npc, selectDeathActingStyle(hitZone, weaponId, npc.id), dirX, dirZ, hitZone === 'head');
          return { hit: true, killed: true, isHead, hitZone, kind: 'npc', label: npc.spec.label };
        }
        npc.panicTimer = 6.0;
        npc.waitTimer = 0;
        npc.seated = false;
        return { hit: true, killed: false, isHead, hitZone, kind: 'npc' };
      }
    }

    const policeId = mesh.userData.simPoliceId as number | undefined;
    if (policeId !== undefined) {
      const officer = this.policeOfficers.find((o) => o.id === policeId && o.active);
      if (officer && !officer.dead) {
        const hitZone = isHead
          ? 'head'
          : resolveDirectionalHitZone(rawZone, officer.yaw, dirX, dirZ, hitPoint.y - officer.y);
        const dmg = Math.round(damage * getMultiplier(hitZone));
        officer.hp -= dmg;
        officer.hitFlashTimer = 0.16;
        officer.hitDirX = dirX;
        officer.hitDirZ = dirZ;
        if (hitZone === 'leg_left' || hitZone === 'leg_right') {
          officer.limping = true;
          officer.staggerTimer = 0.56;
          officer.staggerKind = hitZone;
        } else {
          officer.staggerTimer = hitZone === 'abdomen' ? 0.44 : 0.34;
          officer.staggerKind = hitZone === 'head' ? 'chest' : hitZone;
        }
        if (officer.hp <= 0) {
          officer.hp = 0;
          officer.dead = true;
          officer.deathDuration = 3.1;
          officer.fallTimer = 3.1;
          officer.deathStyle = selectDeathActingStyle(hitZone, weaponId, officer.id);
          if (hitZone === 'head') {
            officer.decapitated = true;
            officer.bloodEmitTimer = 0.72;
            this.triggerHeadshotDecapitation(
              officer.x,
              officer.y,
              officer.z,
              dirX,
              dirZ,
              officer.headPivot,
              officer.neckStump,
            );
          } else {
            officer.decapitated = false;
          }
          return { hit: true, killed: true, isHead, hitZone, kind: 'police', label: 'Patrol Officer' };
        }
        return { hit: true, killed: false, isHead, hitZone, kind: 'police' };
      }
    }

    const vehId = mesh.userData.simRoadVehId as number | undefined;
    if (vehId !== undefined) {
      const veh = this.roadAgents.find((v) => v.id === vehId);
      if (veh && !veh.destroyed) {
        const part = mesh.userData.vehiclePart as string | undefined;
        let partType: SimulatorHitResult['partType'] = 'body';
        let partResult: SimulatorHitResult['partResult'];

        if (part === 'glass') {
          const gIdx = mesh.userData.glassIdx as number | undefined;
          const pane = gIdx !== undefined ? veh.glassPanes[gIdx] : undefined;
          if (pane) {
            partType = 'glass';
            if (pane.state === 'intact' && damage < 55) {
              pane.state = 'cracked';
              const crackedMat = new THREE.MeshStandardMaterial({
                color: 0xdbeafe,
                map: getSharedCrackedGlassTexture(),
                roughness: 0.45,
                metalness: 0.25,
                transparent: true,
                opacity: 0.86,
              });
              this.materials.push(crackedMat);
              pane.mesh.material = crackedMat;
              partResult = 'cracked';
            } else if (pane.state !== 'shattered') {
              pane.state = 'shattered';
              pane.mesh.visible = false;
              const sIdx = this.shootableMeshes.indexOf(pane.mesh);
              if (sIdx >= 0) this.shootableMeshes.splice(sIdx, 1);
              partResult = 'shattered';
            }
          }
        } else if (part === 'wheel') {
          const wIdx = mesh.userData.wheelIdx as number | undefined;
          if (wIdx !== undefined && wIdx >= 0 && wIdx < veh.wheels.length && !veh.puncturedWheels[wIdx]) {
            partType = 'wheel';
            partResult = 'punctured';
            veh.puncturedWheels[wIdx] = true;
            veh.puncturedCount++;
            const w = veh.wheels[wIdx];
            const rad = veh.wheelRadii[wIdx] ?? 0.38;
            const side = veh.wheelSides[wIdx] ?? 0;
            w.position.y = (veh.wheelBaseY[wIdx] ?? rad) - rad * 0.22;
            w.scale.set(rad * 0.78, w.scale.y, rad * 0.78);
            if (side !== 0) {
              w.rotation.x += side * 0.14;
            }
            veh.maxSpeed = Math.max(3.5, veh.baseMaxSpeed * (1 - veh.puncturedCount * 0.18));
          }
        }

        veh.hp -= Math.round(partType === 'glass' ? damage * 0.25 : damage);
        veh.hitFlashTimer = 0.14;
        if (veh.hp <= 0) {
          this.destroyRoadAgent(veh);
          return {
            hit: true,
            killed: true,
            isHead: false,
            kind: 'vehicle',
            label: veh.kind.toUpperCase(),
            partType,
            partResult,
            isPoliceVehicle: veh.kind === 'police',
          };
        }
        return {
          hit: true,
          killed: false,
          isHead: false,
          kind: 'vehicle',
          partType,
          partResult,
          isPoliceVehicle: veh.kind === 'police',
        };
      }
    }

    const royalGuardId = mesh.userData.simRoyalGuardId as number | undefined;
    if (royalGuardId !== undefined) {
      const rg = this.royalGuards.find((g) => g.id === royalGuardId);
      if (rg && !rg.dead) {
        rg.hostile = true;
        rg.alertTimer = 25;
        const dmg = Math.round(damage * getMultiplier(rawZone));
        rg.hp -= dmg;
        rg.hitFlashTimer = 0.16;
        if (rg.hp <= 0) {
          rg.hp = 0;
          rg.dead = true;
          rg.fallTimer = 2.6;
          rg.respawnTimer = 16.0;
          return {
            hit: true,
            killed: true,
            isHead,
            hitZone: rawZone,
            kind: 'gang',
            label: rg.isMounted ? 'Royal Cavalry Guard' : 'Royal Castle Guard',
          };
        }
        return { hit: true, killed: false, isHead, hitZone: rawZone, kind: 'gang' };
      }
    }

    const convoyGuardId = mesh.userData.simConvoyGuardId as number | undefined;
    if (convoyGuardId !== undefined) {
      const cg = this.convoyGuards.find((g) => g.id === convoyGuardId);
      if (cg && !cg.dead) {
        this.convoyHostile = true;
        this.convoyAlertTimer = 38;
        const hitZone = isHead
          ? 'head'
          : resolveDirectionalHitZone(rawZone, cg.yaw, dirX, dirZ, hitPoint.y - cg.y);
        const dmg = Math.round(damage * getMultiplier(hitZone));
        cg.hp -= dmg;
        cg.hitFlashTimer = 0.16;
        cg.hitDirX = dirX;
        cg.hitDirZ = dirZ;
        if (hitZone === 'leg_left' || hitZone === 'leg_right') {
          cg.limping = true;
          cg.staggerTimer = 0.56;
          cg.staggerKind = hitZone;
        } else {
          cg.staggerTimer = hitZone === 'abdomen' ? 0.44 : 0.34;
          cg.staggerKind = hitZone === 'head' ? 'chest' : hitZone;
        }
        if (cg.hp <= 0) {
          cg.hp = 0;
          cg.dead = true;
          cg.deathDuration = 3.1;
          cg.fallTimer = 3.1;
          cg.deathStyle = selectDeathActingStyle(hitZone, weaponId, cg.id);
          return {
            hit: true,
            killed: true,
            isHead,
            hitZone,
            kind: cg.role === 'police_biker' ? 'police' : 'gang',
            label: cg.role === 'police_biker' ? 'Convoy Escort Officer' : '[BOSS GUARD] AK-47 Security',
          };
        }
        return {
          hit: true,
          killed: false,
          isHead,
          hitZone,
          kind: cg.role === 'police_biker' ? 'police' : 'gang',
        };
      }
    }

    const convoyVehId = mesh.userData.simConvoyVehId as number | undefined;
    if (convoyVehId !== undefined) {
      const cv = this.convoyVehicles.find((c) => c.id === convoyVehId);
      if (cv && !cv.destroyed) {
        this.convoyHostile = true;
        this.convoyAlertTimer = 38;
        cv.hp -= Math.round(damage);
        cv.hitFlashTimer = 0.14;
        if (cv.hp <= 0) {
          cv.hp = 0;
          cv.destroyed = true;
          cv.root.rotation.z = 0.2;
          if (cv.role === 'boss_hilux') {
            this.convoyRespawnTimer = 28;
          }
          return {
            hit: true,
            killed: true,
            isHead: false,
            kind: 'vehicle',
            label:
              cv.role === 'boss_hilux'
                ? '[BOSS VEHICLE DESTROYED] Hilux Black'
                : cv.role === 'police_moto'
                  ? 'Escort Police Bike'
                  : 'Security SUV',
            isPoliceVehicle: cv.role === 'police_moto',
          };
        }
        return {
          hit: true,
          killed: false,
          isHead: false,
          kind: 'vehicle',
          isPoliceVehicle: cv.role === 'police_moto',
        };
      }
    }

    return { hit: false, killed: false, isHead: false, kind: 'npc' };
  }

  public damageInRadius(
    center: THREE.Vector3,
    radius: number,
    maxDamage: number,
    attackerPos: THREE.Vector3,
  ): { damaged: boolean; killedCount: number } {
    let damaged = false;
    let killedCount = 0;

    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      if (n.dead || n.isProtectedChild) continue;
      const dist = Math.hypot(n.x - center.x, n.y - center.y, n.z - center.z);
      if (dist <= radius) {
        const falloff = 1 - dist / radius;
        const dmg = Math.round(maxDamage * (0.35 + 0.65 * falloff));
        n.hp -= dmg;
        n.hitFlashTimer = 0.18;
        damaged = true;
        if (n.hp <= 0) {
          this.killNpc(n);
          killedCount++;
        }
      }
    }

    for (let i = 0; i < this.policeOfficers.length; i++) {
      const po = this.policeOfficers[i];
      if (!po.active || po.dead) continue;
      const dist = Math.hypot(po.x - center.x, po.y - center.y, po.z - center.z);
      if (dist <= radius) {
        const falloff = 1 - dist / radius;
        po.hp -= Math.round(maxDamage * (0.35 + 0.65 * falloff));
        po.hitFlashTimer = 0.18;
        damaged = true;
        if (po.hp <= 0) {
          po.hp = 0;
          po.dead = true;
          po.fallTimer = 2.2;
          killedCount++;
        }
      }
    }

    for (let i = 0; i < this.gangVisuals.length; i++) {
      const gv = this.gangVisuals[i];
      const m = gv.state;
      if (m.dead) continue;
      const dist = Math.hypot(m.x - center.x, m.y - center.y, m.z - center.z);
      if (dist <= radius) {
        provokeGangSquad(this.gangSquads, gv.squadIdx, attackerPos.x, attackerPos.z);
        const falloff = 1 - dist / radius;
        const dmg = Math.round(maxDamage * (0.35 + 0.65 * falloff));
        m.hp -= dmg;
        gv.hitFlashTimer = 0.18;
        damaged = true;
        if (m.hp <= 0) {
          m.hp = 0;
          m.dead = true;
          gv.fallTimer = 2.4;
          m.respawnTimer = 14.0;
          killedCount++;
        }
      }
    }

    for (let i = 0; i < this.roadAgents.length; i++) {
      const v = this.roadAgents[i];
      if (v.destroyed) continue;
      const vy = this.env.groundHeightAt(v.x, v.z, 0);
      const dist = Math.hypot(v.x - center.x, vy - center.y, v.z - center.z);
      if (dist <= radius + 1.5) {
        const falloff = Math.max(0.25, 1 - dist / (radius + 1.5));
        v.hp -= Math.round(maxDamage * falloff);
        damaged = true;
        if (v.hp <= 0) {
          this.destroyRoadAgent(v);
          killedCount++;
        }
      }
    }

    for (let i = 0; i < this.royalGuards.length; i++) {
      const rg = this.royalGuards[i];
      if (rg.dead) continue;
      const dist = Math.hypot(rg.x - center.x, rg.y - center.y, rg.z - center.z);
      if (dist <= radius) {
        rg.hostile = true;
        rg.alertTimer = 25;
        rg.hp -= Math.round(maxDamage * (0.4 + 0.6 * (1 - dist / radius)));
        rg.hitFlashTimer = 0.18;
        damaged = true;
        if (rg.hp <= 0) {
          rg.hp = 0;
          rg.dead = true;
          rg.fallTimer = 2.2;
          rg.respawnTimer = 16.0;
          killedCount++;
        }
      }
    }

    return { damaged, killedCount };
  }

  public hitNearbyWithVehicle(vehPos: THREE.Vector3, radius: number, speed: number): { hit: boolean; killed: boolean } {
    if (speed < 2.4) return { hit: false, killed: false };
    let hit = false;
    let killed = false;
    const dmg = Math.min(140, Math.round(speed * 11));

    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      if (n.dead || n.isProtectedChild || Math.abs(n.y - vehPos.y) > 2.2) continue;
      if (Math.hypot(n.x - vehPos.x, n.z - vehPos.z) <= radius + 0.45) {
        n.hp -= dmg;
        n.hitFlashTimer = 0.18;
        hit = true;
        if (n.hp <= 0) {
          this.killNpc(n);
          killed = true;
        }
      }
    }

    for (let i = 0; i < this.policeOfficers.length; i++) {
      const po = this.policeOfficers[i];
      if (!po.active || po.dead || Math.abs(po.y - vehPos.y) > 2.2) continue;
      if (Math.hypot(po.x - vehPos.x, po.z - vehPos.z) <= radius + 0.45) {
        po.hp -= dmg;
        po.hitFlashTimer = 0.18;
        hit = true;
        if (po.hp <= 0) {
          po.hp = 0;
          po.dead = true;
          po.fallTimer = 2.2;
          killed = true;
        }
      }
    }

    for (let i = 0; i < this.gangVisuals.length; i++) {
      const gv = this.gangVisuals[i];
      const m = gv.state;
      if (m.dead || Math.abs(m.y - vehPos.y) > 2.2) continue;
      if (Math.hypot(m.x - vehPos.x, m.z - vehPos.z) <= radius + 0.45) {
        provokeGangSquad(this.gangSquads, gv.squadIdx, vehPos.x, vehPos.z);
        m.hp -= dmg;
        gv.hitFlashTimer = 0.18;
        hit = true;
        if (m.hp <= 0) {
          m.hp = 0;
          m.dead = true;
          gv.fallTimer = 2.4;
          m.respawnTimer = 14.0;
          killed = true;
        }
      }
    }

    for (let i = 0; i < this.royalGuards.length; i++) {
      const rg = this.royalGuards[i];
      if (rg.dead || Math.abs(rg.y - vehPos.y) > 2.4) continue;
      if (Math.hypot(rg.x - vehPos.x, rg.z - vehPos.z) <= radius + 0.55) {
        rg.hostile = true;
        rg.alertTimer = 25;
        rg.hp -= dmg;
        rg.hitFlashTimer = 0.18;
        hit = true;
        if (rg.hp <= 0) {
          rg.hp = 0;
          rg.dead = true;
          rg.fallTimer = 2.2;
          rg.respawnTimer = 16.0;
          killed = true;
        }
      }
    }

    return { hit, killed };
  }

  public getNearestPoliceDistance(x: number, z: number): number {
    let best = Infinity;
    for (let i = 0; i < this.policeOfficers.length; i++) {
      const po = this.policeOfficers[i];
      if (!po.active || po.dead) continue;
      const d = Math.hypot(po.x - x, po.z - z);
      if (d < best) best = d;
    }
    for (let i = 0; i < this.roadAgents.length; i++) {
      const v = this.roadAgents[i];
      if (v.kind !== 'police' || v.destroyed || !v.root.visible) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < best) best = d;
    }
    return best;
  }

  public clearPolicePursuit(): void {
    for (let i = 0; i < this.roadAgents.length; i++) {
      const v = this.roadAgents[i];
      if (v.kind === 'police') {
        v.policeMode = 'patrol';
        v.policeAlertTimer = 0;
        v.officersDeployed = false;
      }
    }
    for (let i = 0; i < this.policeOfficers.length; i++) {
      const po = this.policeOfficers[i];
      po.active = false;
      po.root.visible = false;
    }
  }

  public syncWantedPursuit(wantedLevel: number, playerX: number, playerZ: number): void {
    if (wantedLevel <= 0) {
      this.clearPolicePursuit();
      return;
    }
    const maxRadius = 155 + wantedLevel * 55;
    const maxCars = wantedLevel === 1 ? 1 : wantedLevel === 2 ? 2 : wantedLevel <= 4 ? 3 : 4;
    const candidates: Array<{ agent: AmbientRoadAgent; dist: number }> = [];
    for (let i = 0; i < this.roadAgents.length; i++) {
      const v = this.roadAgents[i];
      if (v.kind !== 'police' || v.destroyed || !v.root.visible) continue;
      const dist = Math.hypot(v.x - playerX, v.z - playerZ);
      if (dist <= maxRadius) {
        candidates.push({ agent: v, dist });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const chosen = new Set<number>();
    for (let i = 0; i < Math.min(maxCars, candidates.length); i++) {
      const car = candidates[i].agent;
      chosen.add(car.id);
      if (car.policeMode !== 'engaged') {
        car.policeMode = 'responding';
        car.sirenPulseTimer = car.sirenPulseTimer ?? 0;
      }
      car.policeAlertTimer = 28;
      car.policeTargetX = playerX;
      car.policeTargetZ = playerZ;
    }
    // Keep already-engaged nearby units updating target
    for (let i = 0; i < this.roadAgents.length; i++) {
      const v = this.roadAgents[i];
      if (v.kind === 'police' && (v.policeMode === 'engaged' || v.policeMode === 'responding')) {
        if (chosen.has(v.id)) {
          v.policeTargetX = playerX;
          v.policeTargetZ = playerZ;
          v.policeAlertTimer = 28;
        }
      }
    }
  }

  public alertPoliceNearGunfire(originX: number, originZ: number, radius: number): void {
    const alertDist = Math.max(90, radius * 1.4);
    const candidates: Array<{ agent: AmbientRoadAgent; dist: number }> = [];
    for (let i = 0; i < this.roadAgents.length; i++) {
      const v = this.roadAgents[i];
      if (v.kind !== 'police' || v.destroyed || !v.root.visible) continue;
      const dist = Math.hypot(v.x - originX, v.z - originZ);
      if (dist <= alertDist) {
        candidates.push({ agent: v, dist });
      }
    }
    if (candidates.length === 0) return;
    candidates.sort((a, b) => a.dist - b.dist);
    const maxRespond = Math.min(1, candidates.length);
    for (let i = 0; i < maxRespond; i++) {
      const car = candidates[i].agent;
      if (car.policeMode !== 'engaged') {
        car.policeMode = 'responding';
        car.sirenPulseTimer = 0;
      }
      car.policeAlertTimer = 25;
      car.policeTargetX = originX;
      car.policeTargetZ = originZ;
    }
  }

  private deployPoliceOfficersFromCar(car: AmbientRoadAgent): void {
    car.officersDeployed = true;
    const sideOffsets = [-1.45, 1.45];
    const cosY = Math.cos(car.yaw);
    const sinY = Math.sin(car.yaw);

    const existing = this.policeOfficers.filter((o) => o.carId === car.id);
    if (existing.length > 0) {
      for (let i = 0; i < existing.length; i++) {
        const off = sideOffsets[i % sideOffsets.length];
        const po = existing[i];
        po.active = true;
        po.dead = false;
        po.hp = po.maxHp;
        po.fallTimer = 0;
        po.hitFlashTimer = 0;
        po.fireCooldown = 0.55 + i * 0.28;
        po.x = car.x + cosY * off;
        po.z = car.z - sinY * off;
        po.y = this.env.groundHeightAt(po.x, po.z, 0);
        po.yaw = car.yaw;
        po.limping = false;
        po.staggerTimer = 0;
        if (po.headPivot) po.headPivot.rotation.set(0, 0, 0);
        po.root.visible = true;
        po.root.rotation.set(0, po.yaw, 0);
        po.root.position.set(po.x, po.y, po.z);
      }
      return;
    }

    for (let i = 0; i < 2; i++) {
      const id = this.nextPoliceOfficerId++;
      const built = buildPoliceOfficerMesh(
        id,
        this.sharedGeo,
        this.policeUniformMat,
        this.policeHatMat,
        this.policeBadgeMat,
        this.shootableMeshes,
      );
      this.materials.push(...built.mats);
      this.root.add(built.root);
      const off = sideOffsets[i];
      const px = car.x + cosY * off;
      const pz = car.z - sinY * off;
      const py = this.env.groundHeightAt(px, pz, 0);
      built.root.position.set(px, py, pz);
      built.root.rotation.set(0, car.yaw, 0);
      this.policeOfficers.push({
        id,
        carId: car.id,
        active: true,
        root: built.root,
        shirtMat: built.shirtMat,
        leftLeg: built.leftLeg,
        rightLeg: built.rightLeg,
        leftArm: built.leftArm,
        rightArm: built.rightArm,
        headPivot: built.headPivot,
        neckStump: built.neckStump,
        x: px,
        y: py,
        z: pz,
        yaw: car.yaw,
        walkPhase: i * 1.1,
        hp: 110,
        maxHp: 110,
        dead: false,
        fireCooldown: 0.55 + i * 0.28,
        fallTimer: 0,
        hitFlashTimer: 0,
      });
    }
  }

  public alertNearbyCivilians(originX: number, originZ: number, radius: number): void {
    const rSq = radius * radius;
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      if (
        n.dead ||
        n.isTrainPassenger ||
        n.isStadiumSpectator ||
        n.isFixedSit ||
        n.isSnowboarder ||
        n.subMode === 'joker' ||
        n.subMode === 'football'
      ) {
        continue;
      }
      const dx = n.x - originX;
      const dz = n.z - originZ;
      const dSq = dx * dx + dz * dz;
      if (dSq <= rSq && dSq > 0.01) {
        const d = Math.sqrt(dSq);
        n.panicTimer = 4.5;
        n.seated = false;
        if (n.activeSeat) {
          this.tableSystem.releaseSeat(n.id, this.lastElapsedSec);
          n.activeSeat = null;
        }
        n.targetX = THREE.MathUtils.clamp(n.x + (dx / d) * 28, -245, 558);
        n.targetZ = THREE.MathUtils.clamp(n.z + (dz / d) * 28, -240, 240);
        n.targetY = this.env.groundHeightAt(n.targetX, n.targetZ, n.y);
        n.waitTimer = 0;
      }
    }
  }

  private killNpc(
    npc: HumanoidNpc,
    deathStyle: DeathActingStyle = 'default',
    hitDirX = 0,
    hitDirZ = 1,
    decapitate = false,
  ): void {
    if (npc.dead) return;
    npc.hp = 0;
    npc.dead = true;
    npc.deathStyle = deathStyle;
    npc.deathDuration = 3.2;
    npc.fallTimer = 3.2;
    npc.hitDirX = hitDirX;
    npc.hitDirZ = hitDirZ;
    npc.respawnTimer = 9.0;
    npc.seated = false;
    npc.panicTimer = 0;
    if (npc.activeSeat) {
      this.tableSystem.releaseSeat(npc.id, this.lastElapsedSec);
      npc.activeSeat = null;
    }
    if (npc.cameraFlashMesh) npc.cameraFlashMesh.visible = false;
    if (decapitate) {
      npc.decapitated = true;
      npc.bloodEmitTimer = 0.72;
      this.triggerHeadshotDecapitation(npc.x, npc.y, npc.z, hitDirX, hitDirZ, npc.headPivot, npc.neckStump);
    } else {
      npc.decapitated = false;
    }
  }

  private destroyRoadAgent(v: AmbientRoadAgent): void {
    if (v.destroyed) return;
    v.hp = 0;
    v.destroyed = true;
    v.speed = 0;
    v.hideTimer = 4.5;
    v.respawnTimer = 14.0;
    v.root.rotation.z = 0.15;
    for (let i = 0; i < v.meshes.length; i++) {
      v.meshes[i].material = this.charredVehicleMat;
    }
  }

  private buildRespawnPool(): void {
    for (const h of this.env.houses) {
      this.respawnPool.push({ x: h.doorX, y: 0, z: h.doorZ });
    }
    for (const bs of this.env.busStops) {
      this.respawnPool.push({ x: bs.x, y: 0, z: bs.z });
    }
    for (const jl of this.env.parkCoords.jogLoop) {
      this.respawnPool.push({ x: jl.x, y: 0, z: jl.z });
    }
    for (const m of this.env.malls) {
      this.respawnPool.push({ x: m.nav.cx, y: 0, z: m.nav.doorSouthZ + 2.5 });
    }
    if (this.respawnPool.length === 0) {
      this.respawnPool.push({ x: 18, y: 0, z: 24 }, { x: -32, y: 0, z: 48 });
    }
  }

  private buildSharedAssetsAndSpawn(): void {
    const torsoGeo = new THREE.BoxGeometry(1, 1, 1);
    const headGeo = new THREE.BoxGeometry(1, 1, 1);
    const limbGeo = new THREE.BoxGeometry(1, 1, 1);
    const sculptedTorsoGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.52, 10);
    const sculptedPelvisGeo = new THREE.CylinderGeometry(0.16, 0.15, 0.17, 10);
    const sculptedHeadGeo = new THREE.SphereGeometry(0.16, 12, 10);
    const neckGeo = new THREE.CylinderGeometry(0.055, 0.068, 0.12, 8);
    const sculptedArmGeo = new THREE.CylinderGeometry(0.062, 0.048, 0.56, 8);
    sculptedArmGeo.translate(0, -0.28, 0);
    const sculptedUpperArmGeo = new THREE.CylinderGeometry(0.064, 0.052, 0.28, 8);
    sculptedUpperArmGeo.translate(0, -0.14, 0);
    const sculptedForearmGeo = new THREE.CylinderGeometry(0.052, 0.042, 0.28, 8);
    sculptedForearmGeo.translate(0, -0.14, 0);
    const sculptedLegGeo = new THREE.CylinderGeometry(0.082, 0.058, 0.68, 8);
    sculptedLegGeo.translate(0, -0.34, 0);
    const sculptedThighGeo = new THREE.CylinderGeometry(0.084, 0.068, 0.34, 8);
    sculptedThighGeo.translate(0, -0.17, 0);
    const sculptedCalfGeo = new THREE.CylinderGeometry(0.068, 0.052, 0.34, 8);
    sculptedCalfGeo.translate(0, -0.17, 0);
    const shoeGeo = new THREE.BoxGeometry(0.13, 0.09, 0.23);
    const handGeo = new THREE.SphereGeometry(0.055, 8, 6);
    const propGeo = new THREE.BoxGeometry(1, 1, 1);
    const boardGeo = new THREE.BoxGeometry(0.46, 0.07, 1.55);
    const flashGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
    const steamGeo = new THREE.SphereGeometry(0.18, 6, 6);
    this.geometries.push(
      torsoGeo,
      headGeo,
      limbGeo,
      sculptedTorsoGeo,
      sculptedPelvisGeo,
      sculptedHeadGeo,
      neckGeo,
      sculptedArmGeo,
      sculptedUpperArmGeo,
      sculptedForearmGeo,
      sculptedLegGeo,
      sculptedThighGeo,
      sculptedCalfGeo,
      shoeGeo,
      handGeo,
      propGeo,
      boardGeo,
      flashGeo,
      wheelGeo,
      steamGeo,
    );

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6b89c, roughness: 0.72 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x241914, roughness: 0.86 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    const sunglassMat = new THREE.MeshBasicMaterial({ color: 0x090b0f });
    const propGoldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.6 });
    const propWoodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
    const propSteelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.7 });
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.32, metalness: 0.2 });
    const steamMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.75 });
    const gunStainlessMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.32, metalness: 0.85 });
    const gunWoodMat = new THREE.MeshStandardMaterial({ color: 0x7c3b14, roughness: 0.56, metalness: 0.08 });
    const cigPaperMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 });
    const cigEmberMat = new THREE.MeshBasicMaterial({ color: 0xff6b00 });
    const cigSmokeMat = new THREE.MeshBasicMaterial({
      color: 0xd1d5db,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const jokerWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
    const jokerNoseMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const bloodStumpMat = new THREE.MeshStandardMaterial({ color: 0x7f0000, roughness: 0.45, metalness: 0.05 });
    const bloodDropMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const neckStumpGeo = new THREE.CylinderGeometry(0.068, 0.082, 0.09, 8);
    const bloodDropGeo = new THREE.SphereGeometry(0.055, 6, 5);
    const bloodPoolGeo = new THREE.CylinderGeometry(0.55, 0.62, 0.025, 12);
    this.geometries.push(neckStumpGeo, bloodDropGeo, bloodPoolGeo);
    this.charredVehicleMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.95, metalness: 0.15 });
    this.policeUniformMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.68 });
    this.policeHatMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
    this.policeBadgeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.75 });

    const sharedPropMats = createPropPbrMaterials(false);
    const akPrototype = buildAk47RifleGroup({
      gunReceiver: gunMetalMat,
      gunBarrel: gunMetalMat,
      gunWood: gunWoodMat,
      gunStainless: gunStainlessMat,
    } as unknown as MaterialLibrary);

    this.materials.push(
      skinMat,
      hairMat,
      shoeMat,
      sunglassMat,
      propGoldMat,
      propWoodMat,
      propSteelMat,
      boardMat,
      steamMat,
      tireMat,
      gunMetalMat,
      gunStainlessMat,
      gunWoodMat,
      cigPaperMat,
      cigEmberMat,
      cigSmokeMat,
      jokerWhiteMat,
      jokerNoseMat,
      bloodStumpMat,
      bloodDropMat,
      this.charredVehicleMat,
      this.policeUniformMat,
      this.policeHatMat,
      this.policeBadgeMat,
      ...sharedPropMats.all,
    );

    const sharedGeo: SharedNpcGeos = {
      torsoGeo,
      headGeo,
      limbGeo,
      sculptedTorsoGeo,
      sculptedPelvisGeo,
      sculptedHeadGeo,
      neckGeo,
      sculptedArmGeo,
      sculptedUpperArmGeo,
      sculptedForearmGeo,
      sculptedLegGeo,
      sculptedThighGeo,
      sculptedCalfGeo,
      shoeGeo,
      handGeo,
      propGeo,
      boardGeo,
      flashGeo,
      smokeGeo: steamGeo,
      skinMat,
      hairMat,
      shoeMat,
      sunglassMat,
      propGoldMat,
      propWoodMat,
      propSteelMat,
      boardMat,
      gunMetalMat,
      cigPaperMat,
      cigEmberMat,
      cigSmokeMat,
      jokerWhiteMat,
      jokerNoseMat,
      bloodStumpMat,
      bloodDropMat,
      neckStumpGeo,
      bloodDropGeo,
      bloodPoolGeo,
      matCache: new Map(),
      akPrototype,
    };
    this.sharedGeo = sharedGeo;

    // Rising Hot Food Steam Puffs
    for (let i = 0; i < this.env.hotFoodSpots.length; i++) {
      const spot = this.env.hotFoodSpots[i];
      const puffsPerDish = this.isSoftwareGl ? 2 : 3;
      for (let p = 0; p < puffsPerDish; p++) {
        const mesh = new THREE.Mesh(steamGeo, steamMat);
        mesh.position.set(spot.x, spot.y + 0.15 + p * 0.25, spot.z);
        this.root.add(mesh);
        this.steamPuffs.push({
          mesh,
          originX: spot.x,
          originY: spot.y,
          originZ: spot.z,
          phase: i * 0.7 + p * 0.35,
          speed: 0.62 + (p % 2) * 0.16,
        });
      }
    }

    // Core 30+ Living City Roles tuned cleanly for 60 FPS across all districts
    const roleCounts: Partial<Record<NpcRoleId, number>> = {
      sidewalk_walker: this.isSoftwareGl ? 18 : 26,
      house_leaver: 6,
      home_returner: 6,
      bench_sitter: 6,
      group_talker: 6,
      waiter: 4,
      chef: 3,
      hotel_receptionist: 2,
      hotel_cleaner: 3,
      restaurant_customer: 6,
      clothes_shopper: 8,
      watch_shopper: 8,
      cashier: 6,
      shopkeeper: 6,
      mall_security: 4,
      traffic_police: 4,
      jogger: 8,
      exerciser: 4,
      parent_with_child: 4,
      playground_child: 6,
      farmer: 4,
      tourist_camera: 6,
      construction_worker: 4,
      gardener: 4,
      delivery_worker: 4,
    };

    let nextId = 1;
    const spawnHumanoid = (
      spec: NpcRoleSpec,
      spawn: { x: number; y: number; z: number; homeX: number; homeZ: number },
      idx: number,
      extra: Partial<HumanoidNpc> = {},
      meshOpts: {
        isSnowboarder?: boolean;
        isJoker?: boolean;
        hasSunglasses?: boolean;
        isDoctor?: boolean;
        visualArchetype?: NpcVisualArchetype;
        heldCupHex?: number;
      } = {},
    ): HumanoidNpc => {
      const id = nextId++;
      const built = buildNpcMesh(id, spec, sharedGeo, meshOpts, this.shootableMeshes);
      this.materials.push(...built.mats);
      this.root.add(built.root);
      const npc: HumanoidNpc = {
        id,
        spec,
        isProtectedChild: spec.id === 'playground_child',
        root: built.root,
        shirtMat: built.shirtMat,
        torsoMesh: built.torsoMesh,
        leftArmMesh: built.leftArmMesh,
        rightArmMesh: built.rightArmMesh,
        leftLeg: built.leftLeg,
        rightLeg: built.rightLeg,
        leftKnee: built.leftKnee,
        rightKnee: built.rightKnee,
        leftArm: built.leftArm,
        rightArm: built.rightArm,
        leftElbow: built.leftElbow,
        rightElbow: built.rightElbow,
        headPivot: built.headPivot,
        neckStump: built.neckStump,
        cameraFlashMesh: built.cameraFlashMesh,
        heldPropObj: built.heldPropObj,
        propDropped: false,
        lastStepCycle: 0,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        vx: 0,
        vz: 0,
        moveSpeed: spec.baseSpeed,
        yaw: 0,
        targetYaw: 0,
        isWalkingNow: false,
        targetX: spawn.x,
        targetY: spawn.y,
        targetZ: spawn.z,
        homeX: spawn.homeX,
        homeZ: spawn.homeZ,
        waitTimer: (idx % 5) * 0.7,
        walkPhase: idx * 1.1,
        seated: false,
        activeSeat: null,
        groupPairAngle: idx * ((Math.PI * 2) / 6),
        waypointIndex: idx,
        subMode: 'walk',
        flashTimer: 0,
        hp: 75,
        maxHp: 75,
        dead: false,
        fallTimer: 0,
        respawnTimer: 0,
        hitFlashTimer: 0,
        stuckTimer: 0,
        lastProgressX: spawn.x,
        lastProgressZ: spawn.z,
        ...extra,
      };
      this.npcs.push(npc);
      return npc;
    };

    for (const spec of NPC_ROLE_CATALOG) {
      if (
        spec.id === 'car_driver' ||
        spec.id === 'motorcycle_rider' ||
        spec.id === 'bus_driver' ||
        spec.id === 'taxi_driver' ||
        spec.id === 'cyclist'
      ) {
        continue;
      }
      const count = roleCounts[spec.id] ?? 2;
      for (let c = 0; c < count; c++) {
        const spawn = this.pickInitialPositionForRole(spec.id, c);
        const visualArchetype: NpcVisualArchetype =
          spec.id === 'tourist_camera'
            ? (c % 2 === 0 ? 'tourist_backpacker' : 'tourist_hiker')
            : spec.id === 'sidewalk_walker' && c % 6 === 0
              ? 'fatty_man'
              : 'standard';
        const npc = spawnHumanoid(spec, spawn, c, {}, { visualArchetype });
        this.assignNextDestination(npc, 0);
      }
    }

    // Snow Mountain Snowboarders
    const touristSpec = NPC_ROLE_CATALOG.find((r) => r.id === 'tourist_camera') ?? NPC_ROLE_CATALOG[0];
    for (let s = 0; s < this.env.snowSlope.lanes.length; s++) {
      const lane = this.env.snowSlope.lanes[s];
      const sz = THREE.MathUtils.lerp(lane.topZ, lane.bottomZ, (s % 4) * 0.24);
      const sy = this.env.snowSlope.getHeight(lane.x, sz);
      spawnHumanoid(
        { ...touristSpec, label: 'Mountain Snowboarder', shirtHex: s % 2 === 0 ? 0xef4444 : 0x06b6d4 },
        { x: lane.x, y: sy, z: sz, homeX: lane.x, homeZ: lane.topZ },
        s,
        {
          subMode: 'snowboard',
          isSnowboarder: true,
          snowLaneIdx: s,
          snowZ: sz,
          snowSpeed: 10.5 + (s % 3) * 2.2,
          targetZ: lane.bottomZ,
        },
        { isSnowboarder: true },
      );
    }

    // Festival Amusement Park: Animated Circus Jokers + Festival Crowd
    const baseWalkerSpec = NPC_ROLE_CATALOG[0];
    if (this.env.festivalCoords) {
      const jokerColors = [0xec4899, 0xfacc15, 0x8b5cf6, 0x10b981, 0xf97316, 0x06b6d4];
      this.env.festivalCoords.jokerSpots.forEach((js, idx) => {
        spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: 'Circus Joker',
            shirtHex: jokerColors[idx % jokerColors.length],
            pantsHex: jokerColors[(idx + 2) % jokerColors.length],
            accentHex: 0xef4444,
            baseSpeed: 2.3,
          },
          { x: js.x, y: 0, z: js.z, homeX: js.x, homeZ: js.z },
          idx,
          { subMode: 'joker', jokerAnchor: js, targetX: js.x, targetZ: js.z },
          { isJoker: true },
        );
      });

      this.env.festivalCoords.crowdSpots.forEach((cs, idx) => {
        const npc = spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: 'Festival Visitor',
            shirtHex: jokerColors[(idx + 1) % jokerColors.length],
            propKind: idx % 2 === 0 ? 'bag' : 'none',
          },
          { x: cs.x, y: 0, z: cs.z, homeX: cs.x, homeZ: cs.z },
          idx,
          { subMode: 'festival' },
        );
        this.assignNextDestination(npc, 0);
      });
    }

    // Metro Stadium: Active Footballers + Clapping Spectators on Bleachers
    if (this.env.stadiumCoords) {
      const std = this.env.stadiumCoords;
      std.pitchSpots.forEach((ps, idx) => {
        spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: idx % 2 === 0 ? 'Red Team Striker' : 'Blue Team Defender',
            shirtHex: idx % 2 === 0 ? 0xef4444 : 0x2563eb,
            pantsHex: 0xf8fafc,
            baseSpeed: 4.2,
          },
          { x: ps.x, y: 0.05, z: ps.z, homeX: ps.x, homeZ: ps.z },
          idx,
          { subMode: 'football', targetX: std.cx, targetZ: std.cz },
        );
      });
      std.spectatorSeats.forEach((ss, idx) => {
        spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: 'Stadium Fan',
            shirtHex: idx % 2 === 0 ? 0xf59e0b : 0x38bdf8,
          },
          { x: ss.x, y: ss.y, z: ss.z, homeX: ss.x, homeZ: ss.z },
          idx,
          { subMode: 'spectator', isStadiumSpectator: true, seated: true, yaw: ss.yaw, targetY: ss.y },
        );
      });
    }

    // Map-Wide Train Car Passengers (visibly riding inside all 5 rail cars!)
    if (this.env.trainCarStates && this.env.trainCarStates.length > 0) {
      const carCount = this.env.trainCarStates.length;
      for (let p = 0; p < 8; p++) {
        const carIdx = p % carCount;
        const car = this.env.trainCarStates[carIdx];
        const lx = p % 2 === 0 ? -0.68 : 0.68;
        const lz = ((p % 4) - 1.5) * 1.4;
        spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: 'Train Passenger',
            shirtHex: p % 3 === 0 ? 0x38bdf8 : p % 3 === 1 ? 0xf59e0b : 0xec4899,
          },
          { x: car.x, y: car.y + 0.55, z: car.z, homeX: car.x, homeZ: car.z },
          p,
          {
            subMode: 'train_passenger',
            isTrainPassenger: true,
            trainCarIdx: carIdx,
            trainSeatLocalX: lx,
            trainSeatLocalZ: lz,
            seated: true,
          },
        );
      }
    }

    // Railway Station Platform Bench Sitters
    if (this.env.stationBenches && this.env.stationBenches.length > 0) {
      for (let i = 0; i < this.env.stationBenches.length; i += 2) {
        const sb = this.env.stationBenches[i];
        spawnHumanoid(
          { ...baseWalkerSpec, label: 'Station Commuter', shirtHex: 0x0ea5e9, propKind: 'bag' },
          { x: sb.x, y: sb.y, z: sb.z, homeX: sb.x, homeZ: sb.z },
          i,
          {
            subMode: 'station_sitter',
            isFixedSit: true,
            seated: true,
            yaw: sb.yaw,
            targetY: sb.y,
          },
        );
      }
    }

    // Mountain Campers + Photographers
    if (this.env.mountainCamps) {
      this.env.mountainCamps.forEach((mc, cIdx) => {
        mc.seatSpots.forEach((ss, sIdx) => {
          const sy = this.env.groundHeightAt(ss.x, ss.z, 0);
          spawnHumanoid(
            {
              ...touristSpec,
              label: sIdx % 2 === 0 ? 'Mountain Camper' : 'Alpine Photographer',
              shirtHex: cIdx % 2 === 0 ? 0xf97316 : 0x22c55e,
              propKind: sIdx % 2 === 0 ? 'none' : 'camera',
            },
            { x: ss.x, y: sy, z: ss.z, homeX: ss.x, homeZ: ss.z },
            cIdx * 4 + sIdx,
            {
              subMode: sIdx % 2 === 0 ? 'camper' : 'photo',
              isFixedSit: sIdx % 2 === 0,
              seated: sIdx % 2 === 0,
              yaw: ss.yaw,
              targetX: ss.x,
              targetY: sy,
              targetZ: ss.z,
            },
          );
        });
      });
    }

    // Power Plant Workers
    if (this.env.powerPlantSpots && this.env.powerPlantSpots.length > 0) {
      const workerSpec = NPC_ROLE_CATALOG.find((r) => r.id === 'construction_worker') ?? baseWalkerSpec;
      this.env.powerPlantSpots.forEach((ps, idx) => {
        const npc = spawnHumanoid(
          { ...workerSpec, label: 'Power Plant Engineer', shirtHex: 0xfacc15, accentHex: 0x0f172a },
          { x: ps.x, y: 0, z: ps.z, homeX: ps.x, homeZ: ps.z },
          idx,
          { subMode: 'power_worker' },
        );
        this.assignNextDestination(npc, 0);
      });
    }

    // Bay City Hospital Medical Staff & Beachfront Visitors
    if (this.env.hospitalSpots && this.env.hospitalSpots.length > 0) {
      this.env.hospitalSpots.forEach((hs, idx) => {
        const npc = spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: idx % 2 === 0 ? 'Trauma Doctor' : 'Hospital Nurse',
            shirtHex: 0xf8fafc,
            pantsHex: idx % 2 === 0 ? 0x0ea5e9 : 0x1e293b,
            accentHex: 0xef4444,
          },
          { x: hs.x, y: 0, z: hs.z, homeX: hs.x, homeZ: hs.z },
          idx,
          { subMode: 'resident' },
        );
        this.assignNextDestination(npc, 0);
      });
    }
    if (this.env.beachSpots && this.env.beachSpots.length > 0) {
      this.env.beachSpots.forEach((bs, idx) => {
        const npc = spawnHumanoid(
          {
            ...touristSpec,
            label: idx % 2 === 0 ? 'Backpacker Tourist' : 'Island Hiker',
            shirtHex: idx % 2 === 0 ? 0xeef0eb : 0xc2d5cb,
            pantsHex: idx % 2 === 0 ? 0x6b4f3a : 0x8f8e7c,
          },
          { x: bs.x, y: 0, z: bs.z, homeX: bs.x, homeZ: bs.z },
          idx,
          { subMode: 'photo' },
          { visualArchetype: idx % 2 === 0 ? 'tourist_backpacker' : 'tourist_hiker' },
        );
        this.assignNextDestination(npc, 0);
      });
    }

    // 5-Member Cigarette + Gun Gangs across all 7 named Boss Archetypes
    if (this.env.gangAnchors && this.env.gangAnchors.length > 0) {
      const created = createGangSquads(this.env.gangAnchors, 5000);
      this.gangSquads.push(...created);
      for (let sIdx = 0; sIdx < created.length; sIdx++) {
        const sq = created[sIdx];
        for (let mIdx = 0; mIdx < sq.members.length; mIdx++) {
          const m = sq.members[mIdx];
          m.y = this.env.groundHeightAt(m.x, m.z, 0);
          const built = buildGangMemberMesh(sIdx, sq.bossId, m.role, m.id, sharedGeo, this.shootableMeshes);
          this.materials.push(...built.mats);
          built.root.position.set(m.x, m.y, m.z);
          built.root.rotation.y = m.yaw;
          this.root.add(built.root);
          this.gangVisuals.push({
            state: m,
            squadIdx: sIdx,
            root: built.root,
            shirtMat: built.shirtMat,
            leftLeg: built.leftLeg,
            rightLeg: built.rightLeg,
            leftArm: built.leftArm,
            rightArm: built.rightArm,
            headPivot: built.headPivot,
            neckStump: built.neckStump,
            cigSmokeMesh: built.cigSmokeMesh,
            walkPhase: mIdx * 0.9,
            fallTimer: 0,
            hitFlashTimer: 0,
          });
        }
      }
    }

    // East Island Citizens (Chinatown Locals, Airport Travelers, Ring Park Walkers, Castle Villagers)
    if (this.env.eastCitizenSpots && this.env.eastCitizenSpots.length > 0) {
      this.env.eastCitizenSpots.forEach((es, idx) => {
        const label =
          es.role === 'chinatown'
            ? 'Chinatown Resident'
            : es.role === 'airport'
              ? 'Airport Traveler'
              : es.role === 'castle_villager'
                ? 'Castle Villager'
                : 'Ring Park Stroller';
        const shirtHex =
          es.role === 'chinatown'
            ? (idx % 2 === 0 ? 0xdc2626 : 0xf59e0b)
            : es.role === 'airport'
              ? 0x0284c7
              : es.role === 'castle_villager'
                ? 0x92400e
                : 0x10b981;
        const npc = spawnHumanoid(
          {
            ...baseWalkerSpec,
            label,
            shirtHex,
            pantsHex: es.role === 'castle_villager' ? 0x451a03 : 0x1e293b,
            propKind: es.role === 'airport' ? 'bag' : es.role === 'chinatown' && idx % 3 === 0 ? 'camera' : 'none',
          },
          { x: es.x, y: 0, z: es.z, homeX: es.x, homeZ: es.z },
          idx,
          { subMode: 'east_citizen', waypointIndex: idx },
        );
        this.assignNextDestination(npc, 0);
      });
    }

    // West Island Citizens (Spaceport Engineers, Eco-Biodome Visitors, Cyber-Tokyo Tourists, Pyramid Explorers)
    if (this.env.westCitizenSpots && this.env.westCitizenSpots.length > 0) {
      this.env.westCitizenSpots.forEach((ws, idx) => {
        const label =
          ws.role === 'spaceport'
            ? 'Spaceport Engineer'
            : ws.role === 'biodome'
              ? 'Eco-Biodome Scientist'
              : ws.role === 'marina'
                ? 'Marina Dock Crew'
                : ws.role === 'cyber_tokyo'
                  ? 'Cyber-Tokyo Visitor'
                  : 'Canyon Explorer';
        const shirtHex =
          ws.role === 'spaceport'
            ? 0xf8fafc
            : ws.role === 'biodome'
              ? 0x10b981
              : ws.role === 'marina'
                ? 0x0ea5e9
                : ws.role === 'cyber_tokyo'
                  ? 0xec4899
                  : 0xf59e0b;
        const npc = spawnHumanoid(
          {
            ...baseWalkerSpec,
            label,
            shirtHex,
            pantsHex: 0x1e293b,
            propKind: ws.role === 'cyber_tokyo' || ws.role === 'pyramid' ? 'camera' : 'bag',
          },
          { x: ws.x, y: 0, z: ws.z, homeX: ws.x, homeZ: ws.z },
          idx,
          { subMode: 'east_citizen', waypointIndex: idx },
        );
        this.assignNextDestination(npc, 0);
      });
    }

    // Royal Castle Foot Guards & Mounted Cavalry Guards on Horses
    let nextGuardId = 9001;
    if (this.env.castleFootGuards) {
      this.env.castleFootGuards.forEach((fg) => {
        const gid = nextGuardId++;
        const built = buildRoyalGuardOrCavalryMesh(gid, false, 0x7c2d12, sharedGeo, this.shootableMeshes);
        this.materials.push(...built.mats);
        this.root.add(built.root);
        const gy = this.env.groundHeightAt(fg.x, fg.z, 0);
        built.root.position.set(fg.x, gy, fg.z);
        this.royalGuards.push({
          id: gid,
          isMounted: false,
          root: built.root,
          tunicMat: built.tunicMat,
          riderLeftArm: built.riderLeftArm,
          riderRightArm: built.riderRightArm,
          riderLeftLeg: built.riderLeftLeg,
          riderRightLeg: built.riderRightLeg,
          waypoints: [
            { x: fg.x, z: fg.z },
            { x: fg.patrolX, z: fg.patrolZ },
          ],
          wpIdx: 1,
          x: fg.x,
          y: gy,
          z: fg.z,
          yaw: 0,
          walkPhase: gid * 0.4,
          hp: 150,
          maxHp: 150,
          dead: false,
          hostile: false,
          alertTimer: 0,
          fireCooldown: 0,
          fallTimer: 0,
          respawnTimer: 0,
          hitFlashTimer: 0,
          homeX: fg.x,
          homeZ: fg.z,
        });
      });
    }
    if (this.env.castleHorseGuards) {
      this.env.castleHorseGuards.forEach((hg) => {
        const gid = nextGuardId++;
        const built = buildRoyalGuardOrCavalryMesh(gid, true, hg.horseColor, sharedGeo, this.shootableMeshes);
        this.materials.push(...built.mats);
        this.root.add(built.root);
        const p0 = hg.waypoints[0] ?? { x: 1285, z: 188 };
        const gy = this.env.groundHeightAt(p0.x, p0.z, 0);
        built.root.position.set(p0.x, gy, p0.z);
        this.royalGuards.push({
          id: gid,
          isMounted: true,
          root: built.root,
          tunicMat: built.tunicMat,
          riderLeftArm: built.riderLeftArm,
          riderRightArm: built.riderRightArm,
          horseLegs: built.horseLegs,
          horseTail: built.horseTail,
          waypoints: hg.waypoints,
          wpIdx: 1 % hg.waypoints.length,
          x: p0.x,
          y: gy,
          z: p0.z,
          yaw: 0,
          walkPhase: gid * 0.7,
          hp: 260,
          maxHp: 260,
          dead: false,
          hostile: false,
          alertTimer: 0,
          fireCooldown: 0,
          fallTimer: 0,
          respawnTimer: 0,
          hitFlashTimer: 0,
          homeX: p0.x,
          homeZ: p0.z,
        });
      });
    }

    // 10b. Baroque Glass & Gold Royal Carriage (King + Queen Inside!) + 8 Front/Rear Escort Guards Visiting East City & Castle Keep
    if (this.env.eastCitizenSpots && this.env.eastCitizenSpots.length > 0) {
      const carriageBuilt = buildRoyalCarriageMesh(sharedGeo, this.geometries, this.materials);
      const royalRoute: RoyalCarriageState['route'] = [
        { x: 1142, z: 188 },
        { x: 1095, z: 145 },
        { x: 1030, z: 145 },
        { x: 1030, z: 222 },
        { x: 1142, z: 188 },
        { x: 1226, z: 188 },
        { x: 1264, z: 188 }, // Enters 12m Wide Castle Keep West Portal!
        { x: 1285, z: 188, pauseSec: 4.5 }, // Stops Inside Baroque Throne Hall!
        { x: 1285, z: 171 }, // Exits 12m Wide Castle Keep North Portal!
        { x: 1285, z: 125 },
        { x: 1185, z: 125 },
      ];
      const cy = this.env.groundHeightAt(royalRoute[0].x, royalRoute[0].z, 0);
      carriageBuilt.root.position.set(royalRoute[0].x, cy, royalRoute[0].z);
      this.root.add(carriageBuilt.root);
      this.royalCarriage = {
        root: carriageBuilt.root,
        horses: carriageBuilt.horses,
        wheels: carriageBuilt.wheels,
        route: royalRoute,
        routeIdx: 1,
        x: royalRoute[0].x,
        y: cy,
        z: royalRoute[0].z,
        yaw: -Math.PI * 0.5,
        waitTimer: 0,
        trotPhase: 0,
      };
      // 4 Front Royal Escort Guards + 4 Rear Royal Escort Guards flanking the Carriage!
      const escortOffsets: Array<{ fwd: number; side: number; mounted: boolean }> = [
        { fwd: 5.6, side: -1.65, mounted: true },
        { fwd: 5.6, side: 1.65, mounted: true },
        { fwd: 7.8, side: -1.5, mounted: false },
        { fwd: 7.8, side: 1.5, mounted: false },
        { fwd: -4.2, side: -1.65, mounted: false },
        { fwd: -4.2, side: 1.65, mounted: false },
        { fwd: -6.4, side: -1.6, mounted: true },
        { fwd: -6.4, side: 1.6, mounted: true },
      ];
      escortOffsets.forEach((eo) => {
        const gid = nextGuardId++;
        const built = buildRoyalGuardOrCavalryMesh(gid, eo.mounted, 0xf8fafc, sharedGeo, this.shootableMeshes);
        this.materials.push(...built.mats);
        this.root.add(built.root);
        const gx = royalRoute[0].x + eo.side;
        const gz = royalRoute[0].z + eo.fwd;
        const gy = this.env.groundHeightAt(gx, gz, 0);
        built.root.position.set(gx, gy, gz);
        this.royalGuards.push({
          id: gid,
          isMounted: eo.mounted,
          root: built.root,
          tunicMat: built.tunicMat,
          riderLeftArm: built.riderLeftArm,
          riderRightArm: built.riderRightArm,
          riderLeftLeg: built.riderLeftLeg,
          riderRightLeg: built.riderRightLeg,
          horseLegs: built.horseLegs,
          horseTail: built.horseTail,
          waypoints: [],
          wpIdx: 0,
          x: gx,
          y: gy,
          z: gz,
          yaw: 0,
          walkPhase: gid * 0.5,
          hp: eo.mounted ? 240 : 160,
          maxHp: eo.mounted ? 240 : 160,
          dead: false,
          hostile: false,
          alertTimer: 0,
          fireCooldown: 0,
          fallTimer: 0,
          respawnTimer: 0,
          hitFlashTimer: 0,
          homeX: gx,
          homeZ: gz,
          escortOffset: { fwd: eo.fwd, side: eo.side },
        });
      });
    }

    // 10c. Expand Living World Population to 1,050+ Citizens across Hospitals, Showroom, Infinity Pool, Beach, Mountains, Malls, Parks & Cities!
    if (this.env.hospitalBeds) {
      this.env.hospitalBeds.forEach((hb, idx) => {
        spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: 'Hospital Patient',
            shirtHex: idx % 2 === 0 ? 0xbae6fd : 0xe0e7ff,
            pantsHex: 0xf8fafc,
          },
          { x: hb.x, y: hb.y, z: hb.z, homeX: hb.x, homeZ: hb.z },
          idx,
          { subMode: 'hospital_patient', isFixedSit: true, seated: true, yaw: hb.yaw, targetY: hb.y },
        );
      });
    }
    if (this.env.hospitalDoctorSpots) {
      for (let d = 0; d < 6; d++) {
        const hs = this.env.hospitalDoctorSpots[d % this.env.hospitalDoctorSpots.length];
        const npc = spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: d % 2 === 0 ? 'Chief Surgeon' : 'Hospital Physician',
            shirtHex: 0xf8fafc,
            pantsHex: d % 2 === 0 ? 0x0284c7 : 0x0f766e,
            accentHex: 0x0ea5e9,
          },
          { x: hs.x, y: hs.y, z: hs.z, homeX: hs.x, homeZ: hs.z },
          d,
          { subMode: 'hospital_doctor' },
          { isDoctor: true },
        );
        this.assignNextDestination(npc, 0);
      }
    }
    if (this.env.showroomSpots) {
      for (let sh = 0; sh < 6; sh++) {
        const sp = this.env.showroomSpots[sh % this.env.showroomSpots.length];
        const npc = spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: sh % 4 === 0 ? 'Showroom Advisor' : 'Supercar Buyer',
            shirtHex: sh % 4 === 0 ? 0x0f172a : [0xef4444, 0xf59e0b, 0x38bdf8, 0x10b981][sh % 4],
            pantsHex: 0x1e293b,
          },
          { x: sp.x + ((sh % 3) - 1) * 0.9, y: 0, z: sp.z + ((sh % 2) - 0.5) * 0.9, homeX: sp.x, homeZ: sp.z },
          sh,
          { subMode: 'showroom_customer' },
        );
        this.assignNextDestination(npc, 0);
      }
    }
    if (this.env.infinityPoolZone) {
      const pz = this.env.infinityPoolZone;
      const swimColors = [0x0ea5e9, 0xf43f5e, 0xf59e0b, 0x10b981, 0x8b5cf6];
      for (let sw = 0; sw < 4; sw++) {
        const ang = (sw / 4) * Math.PI * 2;
        const sx = (pz.minX + pz.maxX) * 0.5 + Math.cos(ang) * 4.2;
        const sz = (pz.minZ + pz.maxZ) * 0.5 + Math.sin(ang) * 2.1;
        spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: 'Pool Swimmer',
            shirtHex: swimColors[sw % swimColors.length],
            pantsHex: swimColors[sw % swimColors.length],
          },
          { x: sx, y: pz.y, z: sz, homeX: sx, homeZ: sz },
          sw,
          { subMode: 'pool_swimmer', poolLaneAngle: ang, targetY: pz.y },
        );
      }
    }
    if (this.env.mansionPartyZone) {
      const mp = this.env.mansionPartyZone;
      const partySuits = [
        0x111827, 0x312e81, 0x701a75, 0x0f172a, 0x991b1b, 0x065f46,
        0xb45309, 0x4c1d95, 0x831843, 0x1e293b, 0xf8fafc,
      ];
      const cupColors = [0x38bdf8, 0xf43f5e, 0xa855f7, 0xfacc15, 0x22d3ee, 0xfb923c];
      const danceSpots: Array<{ x: number; z: number; role: string; hasCup: boolean }> = [
        // 32 VIP guests dancing around the F3 club floor (strictly clear of Stair 2 shaft [20..30, -374..-352] & DJ riser [-6..6, -380..-376])
        { x: -11.8, z: -371.2, role: 'VIP Club Guest', hasCup: true },
        { x: -9.6, z: -370.4, role: 'Club Dancer', hasCup: false },
        { x: -7.4, z: -372.0, role: 'VIP Club Guest', hasCup: true },
        { x: -5.2, z: -370.6, role: 'Club Dancer', hasCup: false },
        { x: -2.8, z: -371.8, role: 'VIP Club Guest', hasCup: true },
        { x: -0.6, z: -370.2, role: 'Club Dancer', hasCup: false },
        { x: 1.8, z: -371.6, role: 'Socialite Guest', hasCup: true },
        { x: 4.2, z: -370.4, role: 'Club Dancer', hasCup: false },
        { x: 6.6, z: -371.5, role: 'VIP Club Guest', hasCup: true },
        { x: 9.0, z: -370.2, role: 'Club Dancer', hasCup: false },
        { x: 11.4, z: -371.4, role: 'VIP Club Guest', hasCup: true },
        { x: 14.2, z: -370.0, role: 'Club Dancer', hasCup: false },
        { x: -11.4, z: -365.4, role: 'VIP Club Guest', hasCup: true },
        { x: -8.2, z: -366.2, role: 'Club Dancer', hasCup: false },
        { x: -4.8, z: -365.0, role: 'Club Dancer', hasCup: true },
        { x: -1.6, z: -366.0, role: 'VIP Club Guest', hasCup: false },
        { x: 1.6, z: -364.8, role: 'Club Dancer', hasCup: true },
        { x: 5.0, z: -366.0, role: 'VIP Club Guest', hasCup: false },
        { x: 8.6, z: -364.6, role: 'Club Dancer', hasCup: true },
        { x: 12.2, z: -365.8, role: 'VIP Club Guest', hasCup: true },
        { x: 15.6, z: -364.2, role: 'Club Dancer', hasCup: false },
        { x: -10.2, z: -359.2, role: 'Socialite Guest', hasCup: true },
        { x: -6.4, z: -360.4, role: 'Club Dancer', hasCup: false },
        { x: -2.8, z: -359.0, role: 'Club Dancer', hasCup: true },
        { x: 0.8, z: -360.2, role: 'VIP Club Guest', hasCup: false },
        { x: 4.6, z: -359.2, role: 'Club Dancer', hasCup: true },
        { x: 8.4, z: -360.4, role: 'VIP Club Guest', hasCup: false },
        { x: 12.4, z: -358.8, role: 'Club Dancer', hasCup: true },
        { x: -8.6, z: -352.6, role: 'VIP Club Guest', hasCup: true },
        { x: -4.2, z: -353.8, role: 'Club Dancer', hasCup: false },
        { x: 0.4, z: -352.4, role: 'Club Dancer', hasCup: true },
        { x: 5.2, z: -353.6, role: 'VIP Club Guest', hasCup: true },
        // 8 guests at the East Cold Drink Bar & High-Tops (x=28..39, z=-350..-331)
        { x: 33.4, z: -346.2, role: 'Bar Lounge Guest', hasCup: true },
        { x: 33.8, z: -343.0, role: 'Bar Lounge Guest', hasCup: true },
        { x: 33.4, z: -339.8, role: 'VIP Bar Guest', hasCup: true },
        { x: 33.6, z: -336.4, role: 'Bar Lounge Guest', hasCup: true },
        { x: 36.2, z: -332.8, role: 'VIP Bar Guest', hasCup: true },
        { x: 38.6, z: -338.2, role: 'Bartender Host', hasCup: true },
        { x: 38.6, z: -342.4, role: 'Bartender Host', hasCup: false },
        { x: 29.8, z: -334.0, role: 'VIP Lounge Guest', hasCup: true },
      ];
      danceSpots.forEach((ds, idx) => {
        const initYaw = Math.atan2(mp.djX - ds.x, mp.djZ - ds.z);
        spawnHumanoid(
          {
            ...baseWalkerSpec,
            label: ds.role,
            shirtHex: partySuits[idx % partySuits.length],
            pantsHex: idx % 4 === 0 ? 0xf8fafc : 0x090d16,
            accentHex: cupColors[idx % cupColors.length],
          },
          { x: ds.x, y: mp.y, z: ds.z, homeX: ds.x, homeZ: ds.z },
          idx,
          { subMode: 'party_dancer', yaw: initYaw, targetYaw: initYaw, targetY: mp.y },
          {
            hasSunglasses: idx % 3 === 0,
            heldCupHex: ds.hasCup ? cupColors[idx % cupColors.length] : undefined,
          },
        );
      });
    }
    if (this.env.beachLoungers) {
      const beachColors = [0xf59e0b, 0xec4899, 0x06b6d4, 0x22c55e, 0xef4444];
      this.env.beachLoungers.forEach((bl, idx) => {
        spawnHumanoid(
          {
            ...touristSpec,
            label: 'Beach Sunbather',
            shirtHex: beachColors[idx % beachColors.length],
            pantsHex: 0x0f172a,
          },
          { x: bl.x, y: bl.y, z: bl.z, homeX: bl.x, homeZ: bl.z },
          idx,
          { subMode: 'beach_sunbather', isFixedSit: true, seated: true, yaw: bl.yaw, targetY: bl.y },
          { hasSunglasses: true },
        );
      });
    }

    // Extra City, Mall, Park, Chinatown Festival, Mountain Camp & Island Citizens (optimized for 60 FPS)
    const crowdColors = [0x2563eb, 0xdc2626, 0xf59e0b, 0x10b981, 0x8b5cf6, 0xec4899, 0x0ea5e9, 0xf97316, 0xf8fafc, 0x14b8a6];
    const targetCrowdTotal = this.isSoftwareGl ? 240 : 320;
    let extraIdx = 0;
    const chinatownCenter = { x: 955, z: 222 };
    const bayHubs = [
      { x: 315, z: 12 },
      { x: 396, z: -12 },
      { x: 472, z: 12 },
      { x: 548, z: 45 },
      { x: 382, z: -112 },
    ];
    const mountainHikeHubs = (this.env.mountainCamps ?? []).map((c) => ({ x: c.x, z: c.z }));

    while (this.npcs.length < targetCrowdTotal - 40) {
      const bucket = extraIdx % 10;
      let sx = 0;
      let sz = 0;
      let subMode: HumanoidSubMode = 'walk';
      let label = 'City Resident';
      let shirtHex = crowdColors[extraIdx % crowdColors.length];

      if (bucket <= 2 && this.env.eastCitizenSpots && this.env.eastCitizenSpots.length > 0) {
        // Dense Chinatown Traditional Festival & East Plaza / Park Crowds!
        if (extraIdx % 3 === 0) {
          const ang = (extraIdx * 1.7) % (Math.PI * 2);
          const rad = 6 + (extraIdx % 38);
          sx = chinatownCenter.x + Math.cos(ang) * rad;
          sz = chinatownCenter.z + Math.sin(ang) * (rad * 0.65);
          label = 'Chinatown Festival Guest';
          shirtHex = extraIdx % 2 === 0 ? 0xdc2626 : 0xf59e0b;
        } else {
          const es = this.env.eastCitizenSpots[extraIdx % this.env.eastCitizenSpots.length];
          sx = es.x + ((extraIdx % 5) - 2) * 3.5;
          sz = es.z + (((extraIdx >> 2) % 5) - 2) * 3.5;
          label = es.role === 'chinatown' ? 'Chinatown Resident' : 'East City Citizen';
        }
        subMode = 'east_citizen';
      } else if ((bucket === 3 || bucket === 4) && this.env.westCitizenSpots && this.env.westCitizenSpots.length > 0) {
        const ws = this.env.westCitizenSpots[extraIdx % this.env.westCitizenSpots.length];
        sx = ws.x + ((extraIdx % 5) - 2) * 3.5;
        sz = ws.z + (((extraIdx >> 2) % 5) - 2) * 3.5;
        subMode = 'east_citizen';
        label = 'West City Citizen';
      } else if (bucket === 5 && this.env.malls.length > 0) {
        // Shopping Mall Multi-Floor Shoppers (Central, Helios West, Crown Galleria East!)
        const mall = this.env.malls[extraIdx % this.env.malls.length];
        const spot = mall.clothesSpots[extraIdx % mall.clothesSpots.length];
        sx = spot.x + ((extraIdx % 3) - 1) * 1.6;
        sz = spot.z + (((extraIdx >> 1) % 3) - 1) * 1.6;
        label = `${mall.name} Shopper`;
      } else if (bucket === 6 && mountainHikeHubs.length > 0 && extraIdx % 2 === 0) {
        const mh = mountainHikeHubs[extraIdx % mountainHikeHubs.length];
        const ang = (extraIdx * 2.1) % (Math.PI * 2);
        sx = mh.x + Math.cos(ang) * 5.2;
        sz = mh.z + Math.sin(ang) * 5.2;
        label = 'Mountain Trekker';
      } else if (bucket === 7) {
        const bh = bayHubs[extraIdx % bayHubs.length];
        sx = bh.x + ((extraIdx % 7) - 3) * 4.5;
        sz = bh.z + (((extraIdx >> 2) % 7) - 3) * 4.5;
        label = 'Bay Citizen';
      } else {
        // Central City Sidewalks, Parks & Streets
        const ring = (extraIdx % 9) - 4;
        const row = ((extraIdx >> 3) % 9) - 4;
        sx = ring * 34 + ((extraIdx % 3) - 1) * 6;
        sz = row * 34 + (((extraIdx >> 1) % 3) - 1) * 6;
        label = 'City Pedestrian';
      }

      const sy = this.env.groundHeightAt(sx, sz, 0);
      const crowdArch: NpcVisualArchetype =
        extraIdx % 11 === 0
          ? 'fatty_man'
          : extraIdx % 9 === 2
            ? 'tourist_backpacker'
            : extraIdx % 9 === 6
              ? 'tourist_hiker'
              : 'standard';
      const npc = spawnHumanoid(
        {
          ...baseWalkerSpec,
          label:
            crowdArch === 'fatty_man'
              ? 'Stout Townsperson'
              : crowdArch === 'tourist_backpacker' || crowdArch === 'tourist_hiker'
                ? 'Sightseeing Tourist'
                : label,
          shirtHex:
            crowdArch === 'tourist_backpacker'
              ? 0xeef0eb
              : crowdArch === 'tourist_hiker'
                ? 0xc2d5cb
                : shirtHex,
          pantsHex:
            crowdArch === 'tourist_backpacker'
              ? (extraIdx % 2 === 0 ? 0x6b4f3a : 0x3b7a9e)
              : crowdArch === 'tourist_hiker'
                ? 0x8f8e7c
                : extraIdx % 3 === 0
                  ? 0x0f172a
                  : 0x1e293b,
          propKind: extraIdx % 7 === 0 ? 'bag' : 'none',
        },
        { x: sx, y: sy, z: sz, homeX: sx, homeZ: sz },
        extraIdx,
        { subMode, waypointIndex: extraIdx },
        { visualArchetype: crowdArch },
      );
      this.assignNextDestination(npc, 0);
      extraIdx++;
    }

    // 10d. Build 7-Vehicle Roaming BOSS Convoy (2 Parallel Police Bikes -> 2 Black SUVs -> Boss Black Toyota Hilux Pickup w/ 2 Rear AK-47 Guards -> 2 Black SUVs)
    {
      let cum = 0;
      for (let p = 0; p < BOSS_CONVOY_CIRCUIT.length; p++) {
        const a = BOSS_CONVOY_CIRCUIT[p];
        const b = BOSS_CONVOY_CIRCUIT[(p + 1) % BOSS_CONVOY_CIRCUIT.length];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        this.convoyPathSegs.push({ x0: a.x, z0: a.z, dx, dz, len, cumLen: cum });
        cum += len;
      }
      this.convoyTotalLen = Math.max(1, cum);

      const convoyFormation: Array<{
        role: ConvoyVehicleUnit['role'];
        leadOffset: number;
        lateralOffset: number;
      }> = [
        { role: 'police_moto', leadOffset: 22.0, lateralOffset: -1.7 },
        { role: 'police_moto', leadOffset: 22.0, lateralOffset: 1.7 },
        { role: 'escort_suv', leadOffset: 14.5, lateralOffset: 0 },
        { role: 'escort_suv', leadOffset: 7.4, lateralOffset: 0 },
        { role: 'boss_hilux', leadOffset: 0, lateralOffset: 0 },
        { role: 'escort_suv', leadOffset: -7.8, lateralOffset: 0 },
        { role: 'escort_suv', leadOffset: -15.0, lateralOffset: 0 },
      ];

      let nextConvoyGuardId = 95001;
      convoyFormation.forEach((cfg, cIdx) => {
        const cvId = 9100 + cIdx;
        const root = new THREE.Group();
        const wheels: THREE.Mesh[] = [];
        let lightBarMeshes: [THREE.Mesh, THREE.Mesh] | undefined;

        if (cfg.role === 'police_moto') {
          // Escort Police Motorcycle (white/navy fairing, windshield, saddlebags, flashing beacon pole)
          const builtMoto = buildModernVehicleMesh(
            cvId,
            'sport_moto',
            cIdx,
            wheelGeo,
            tireMat,
            sharedPropMats,
            this.geometries,
            this.materials,
            [],
          );
          // Re-skin police motorcycle fairing in crisp Police White & Navy + Flashing Police Beacon Pole
          const whiteFairing = getCachedClothMat(sharedGeo.matCache, 0xf8fafc, 0.25, this.materials);
          const navyFairing = getCachedClothMat(sharedGeo.matCache, 0x0f172a, 0.35, this.materials);
          const poleMesh = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propSteelMat);
          poleMesh.position.set(0, 1.38, -0.78);
          poleMesh.scale.set(0.05, 0.72, 0.05);
          const beaconMatA = new THREE.MeshBasicMaterial({ color: 0xef4444 });
          const beaconMatB = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
          this.materials.push(beaconMatA, beaconMatB);
          const bA = new THREE.Mesh(sharedGeo.propGeo, beaconMatA);
          bA.position.set(-0.08, 1.76, -0.78);
          bA.scale.set(0.12, 0.14, 0.14);
          const bB = new THREE.Mesh(sharedGeo.propGeo, beaconMatB);
          bB.position.set(0.08, 1.76, -0.78);
          bB.scale.set(0.12, 0.14, 0.14);
          const shield = new THREE.Mesh(sharedGeo.propGeo, whiteFairing);
          shield.position.set(0, 1.05, 0.44);
          shield.scale.set(0.42, 0.34, 0.12);
          const bagL = new THREE.Mesh(sharedGeo.propGeo, navyFairing);
          bagL.position.set(-0.28, 0.74, -0.52);
          bagL.scale.set(0.16, 0.28, 0.44);
          const bagR = new THREE.Mesh(sharedGeo.propGeo, navyFairing);
          bagR.position.set(0.28, 0.74, -0.52);
          bagR.scale.set(0.16, 0.28, 0.44);
          root.add(builtMoto.root, poleMesh, bA, bB, shield, bagL, bagR);
          wheels.push(...builtMoto.wheels);
          lightBarMeshes = [bA, bB];

          // Armed Police Escort Rider holding AK-47!
          const gId = nextConvoyGuardId++;
          const rider = buildConvoyHumanActor(gId, 0x1e3a8a, sharedGeo, this.shootableMeshes, this.materials, {
            isPoliceBiker: true,
            hasHelmet: true,
          });
          rider.root.position.set(0, 0.24, -0.18);
          rider.leftLeg.rotation.x = 0.52;
          rider.rightLeg.rotation.x = 0.52;
          rider.leftArm.rotation.x = -1.05;
          rider.rightArm.rotation.x = -1.15;
          root.add(rider.root);
          this.convoyGuards.push({
            id: gId,
            role: 'police_biker',
            vehicleIdx: cIdx,
            localOffsetX: 0,
            localOffsetY: 0.24,
            localOffsetZ: -0.18,
            ...rider,
            walkPhase: 0,
            hp: 150,
            maxHp: 150,
            dead: false,
            fallTimer: 0,
            deathDuration: 3.1,
            hitFlashTimer: 0,
            fireCooldown: 0.35 + cIdx * 0.2,
            x: 0,
            y: 0,
            z: 0,
            yaw: 0,
          });
        } else if (cfg.role === 'boss_hilux') {
          // Center BOSS Vehicle: Black Toyota Hilux Double-Cab Pickup (with Bold Silver Grille, Boss Inside, & 2 Rear-Bed AK-47 Guards!)
          const builtPickup = buildModernVehicleMesh(
            cvId,
            'range_black_suv',
            cIdx,
            wheelGeo,
            tireMat,
            sharedPropMats,
            this.geometries,
            this.materials,
            [],
          );
          const blackPaint = getCachedClothMat(sharedGeo.matCache, 0x090b0f, 0.24, this.materials);
          const chromeMat = sharedGeo.propSteelMat;
          // Hilux Bold Horizontal Chrome Front Grille & Step Bars + Open Rear Cargo Bed
          const hiluxBed = new THREE.Mesh(sharedGeo.propGeo, blackPaint);
          hiluxBed.position.set(0, 0.78, -1.65);
          hiluxBed.scale.set(1.94, 0.42, 1.88);
          const hiluxBedRailL = new THREE.Mesh(sharedGeo.propGeo, blackPaint);
          hiluxBedRailL.position.set(-0.92, 1.12, -1.65);
          hiluxBedRailL.scale.set(0.14, 0.34, 1.88);
          const hiluxBedRailR = new THREE.Mesh(sharedGeo.propGeo, blackPaint);
          hiluxBedRailR.position.set(0.92, 1.12, -1.65);
          hiluxBedRailR.scale.set(0.14, 0.34, 1.88);
          const hiluxTailgate = new THREE.Mesh(sharedGeo.propGeo, blackPaint);
          hiluxTailgate.position.set(0, 1.08, -2.54);
          hiluxTailgate.scale.set(1.94, 0.42, 0.14);
          const rollBar = new THREE.Mesh(sharedGeo.propGeo, blackPaint);
          rollBar.position.set(0, 1.56, -0.95);
          rollBar.scale.set(1.75, 0.12, 0.12);
          const grilleFrame = new THREE.Mesh(sharedGeo.propGeo, chromeMat);
          grilleFrame.position.set(0, 0.72, 2.38);
          grilleFrame.scale.set(1.38, 0.44, 0.08);
          const skidPlate = new THREE.Mesh(sharedGeo.propGeo, chromeMat);
          skidPlate.position.set(0, 0.38, 2.38);
          skidPlate.scale.set(1.24, 0.18, 0.12);
          const sideStepL = new THREE.Mesh(sharedGeo.propGeo, blackPaint);
          sideStepL.position.set(-1.12, 0.34, 0.1);
          sideStepL.scale.set(0.18, 0.08, 1.95);
          const sideStepR = new THREE.Mesh(sharedGeo.propGeo, blackPaint);
          sideStepR.position.set(1.12, 0.34, 0.1);
          sideStepR.scale.set(0.18, 0.08, 1.95);

          // Rich BOSS inside Hilux Double-Cab (gold-trimmed tuxedo + sunglasses!)
          const bossSuitMat = getCachedClothMat(sharedGeo.matCache, 0x111827, 0.45, this.materials);
          const bossTorso = new THREE.Mesh(sharedGeo.sculptedTorsoGeo, bossSuitMat);
          bossTorso.position.set(-0.42, 1.18, 0.08);
          const bossChain = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.propGoldMat);
          bossChain.position.set(-0.42, 1.24, 0.24);
          bossChain.scale.set(0.18, 0.08, 0.05);
          const bossHead = new THREE.Mesh(sharedGeo.sculptedHeadGeo, sharedGeo.skinMat);
          bossHead.position.set(-0.42, 1.54, 0.08);
          const bossShades = new THREE.Mesh(sharedGeo.propGeo, sharedGeo.sunglassMat);
          bossShades.position.set(-0.42, 1.56, 0.22);
          bossShades.scale.set(0.24, 0.06, 0.05);

          root.add(
            builtPickup.root,
            hiluxBed,
            hiluxBedRailL,
            hiluxBedRailR,
            hiluxTailgate,
            rollBar,
            grilleFrame,
            skidPlate,
            sideStepL,
            sideStepR,
            bossTorso,
            bossChain,
            bossHead,
            bossShades,
          );
          wheels.push(...builtPickup.wheels);

          // TWO ARMED SECURITY GUARDS SITTING VISIBLY IN THE OPEN REAR BED HOLDING AK-47 RIFLES!
          [-0.56, 0.56].forEach((gx, gIdx) => {
            const gId = nextConvoyGuardId++;
            const bedGuard = buildConvoyHumanActor(gId, 0x0f172a, sharedGeo, this.shootableMeshes, this.materials, {
              hasHelmet: false,
            });
            const lz = -1.62 + gIdx * 0.22;
            bedGuard.root.position.set(gx, 0.72, lz);
            bedGuard.leftLeg.rotation.x = -1.15;
            bedGuard.rightLeg.rotation.x = -1.15;
            bedGuard.leftArm.rotation.x = -0.95;
            bedGuard.rightArm.rotation.x = -1.32;
            root.add(bedGuard.root);
            this.convoyGuards.push({
              id: gId,
              role: 'pickup_guard',
              vehicleIdx: cIdx,
              localOffsetX: gx,
              localOffsetY: 0.72,
              localOffsetZ: lz,
              ...bedGuard,
              walkPhase: 0,
              hp: 190,
              maxHp: 190,
              dead: false,
              fallTimer: 0,
              deathDuration: 3.1,
              hitFlashTimer: 0,
              fireCooldown: 0.25 + gIdx * 0.22,
              x: 0,
              y: 0,
              z: 0,
              yaw: 0,
            });
          });
        } else {
          // 4 Escort Security Black SUVs (2 Front + 2 Behind) + 1 AK-47 Tactical Security Guard each!
          const builtSuv = buildModernVehicleMesh(
            cvId,
            'range_black_suv',
            cIdx,
            wheelGeo,
            tireMat,
            sharedPropMats,
            this.geometries,
            this.materials,
            [],
          );
          root.add(builtSuv.root);
          wheels.push(...builtSuv.wheels);

          const gId = nextConvoyGuardId++;
          const suvGuard = buildConvoyHumanActor(gId, 0x111827, sharedGeo, this.shootableMeshes, this.materials, {
            hasHelmet: true,
          });
          suvGuard.root.visible = false; // Deploys cleanly out of escort SUV doors when Convoy is attacked!
          this.root.add(suvGuard.root);
          this.convoyGuards.push({
            id: gId,
            role: 'suv_guard',
            vehicleIdx: cIdx,
            localOffsetX: cIdx % 2 === 0 ? -1.45 : 1.45,
            localOffsetY: 0,
            localOffsetZ: 0.2,
            ...suvGuard,
            walkPhase: cIdx * 0.8,
            hp: 175,
            maxHp: 175,
            dead: false,
            fallTimer: 0,
            deathDuration: 3.1,
            hitFlashTimer: 0,
            fireCooldown: 0.4 + cIdx * 0.15,
            x: 0,
            y: 0,
            z: 0,
            yaw: 0,
          });
        }

        // Register all vehicle hull meshes shootable to provoke convoy retaliation
        root.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.userData.simConvoyGuardId === undefined) {
            obj.userData.simConvoyVehId = cvId;
            this.shootableMeshes.push(obj);
          }
        });

        this.root.add(root);
        this.convoyVehicles.push({
          id: cvId,
          role: cfg.role,
          root,
          wheels,
          lightBarMeshes,
          hp: cfg.role === 'boss_hilux' ? 420 : cfg.role === 'police_moto' ? 140 : 280,
          maxHp: cfg.role === 'boss_hilux' ? 420 : cfg.role === 'police_moto' ? 140 : 280,
          destroyed: false,
          hitFlashTimer: 0,
          x: 0,
          y: 0,
          z: 0,
          yaw: 0,
          leadOffset: cfg.leadOffset,
          lateralOffset: cfg.lateralOffset,
        });
      });
    }

    // Modern Car Fleet + Extra Bikes across West, Central, Bay, East & Valley Districts (no legacy vehicles!)
    const vehicleFleet: Array<{
      kind: AmbientRoadAgent['kind'];
      loopIdx: number;
      circleLoopIdx?: number;
      speed: number;
    }> = [
      { kind: 'revuelto_red', loopIdx: 0, speed: 15.8 },
      { kind: 'range_black_suv', loopIdx: 0, speed: 13.6 },
      { kind: 'cyber_pickup', loopIdx: 0, speed: 14.0 },
      { kind: 'sport_moto', loopIdx: 0, speed: 17.0 },
      { kind: 'vision_silver', loopIdx: 1, speed: 15.2 },
      { kind: 'rolls_copper_gt', loopIdx: 1, speed: 14.4 },
      { kind: 'thar_black_4x4', loopIdx: 1, speed: 13.2 },
      { kind: 'motorcycle', loopIdx: 1, speed: 16.2 },
      { kind: 'stealth_hyper', loopIdx: 2, speed: 16.0 },
      { kind: 'gullwing_coupe', loopIdx: 2, speed: 14.8 },
      { kind: 'police', loopIdx: 2, speed: 15.6 },
      { kind: 'city_scooter', loopIdx: 2, speed: 11.4 },
      { kind: 'cyber_gold', loopIdx: 3, speed: 14.2 },
      { kind: 'challenger_scissor', loopIdx: 3, speed: 15.4 },
      { kind: 'lambo_blue_hyper', loopIdx: 3, speed: 16.0 },
      { kind: 'terzo_silver', loopIdx: 3, speed: 16.2 },
      { kind: 'bicycle', loopIdx: -1, speed: 6.5 },
      { kind: 'bicycle', loopIdx: -1, speed: 7.1 },
    ];
    if (this.env.roadRectLoops.length > 4) {
      vehicleFleet.push(
        { kind: 'police', loopIdx: 4, speed: 15.8 },
        { kind: 'rolls_copper_gt', loopIdx: 4, speed: 14.6 },
        { kind: 'range_black_suv', loopIdx: 4, speed: 13.8 },
        { kind: 'revuelto_red', loopIdx: 5, speed: 16.2 },
        { kind: 'thar_black_4x4', loopIdx: 5, speed: 13.5 },
        { kind: 'sport_moto', loopIdx: 5, speed: 17.2 },
        { kind: 'cyber_pickup', loopIdx: 6, speed: 14.2 },
        { kind: 'gullwing_coupe', loopIdx: 6, speed: 15.0 },
        { kind: 'motorcycle', loopIdx: 6, speed: 16.4 },
        { kind: 'cyber_gold', loopIdx: 7, speed: 14.4 },
        { kind: 'vision_silver', loopIdx: 7, speed: 15.4 },
        { kind: 'challenger_scissor', loopIdx: 7, speed: 15.6 },
      );
    }

    // East Island Rings: Modern Hypercars, Coupe SUVs & Extra Bikes
    if (this.env.roadCircleLoops && this.env.roadCircleLoops.length > 0) {
      vehicleFleet.push(
        { kind: 'terzo_silver', loopIdx: 0, circleLoopIdx: 0, speed: 17.5 },
        { kind: 'lambo_blue_hyper', loopIdx: 0, circleLoopIdx: 0, speed: 16.8 },
        { kind: 'vision_silver', loopIdx: 0, circleLoopIdx: 0, speed: 14.6 },
        { kind: 'rolls_copper_gt', loopIdx: 0, circleLoopIdx: 0, speed: 15.2 },
        { kind: 'sport_moto', loopIdx: 0, circleLoopIdx: 0, speed: 18.2 },
        { kind: 'city_scooter', loopIdx: 0, circleLoopIdx: 0, speed: 11.5 },
        { kind: 'stealth_hyper', loopIdx: 0, circleLoopIdx: 1, speed: 15.8 },
        { kind: 'gullwing_coupe', loopIdx: 0, circleLoopIdx: 1, speed: 14.2 },
        { kind: 'cyber_pickup', loopIdx: 0, circleLoopIdx: 1, speed: 14.6 },
        { kind: 'sport_moto', loopIdx: 0, circleLoopIdx: 1, speed: 16.4 },
        { kind: 'city_scooter', loopIdx: 0, circleLoopIdx: 1, speed: 10.8 },
      );
    }
    if (this.env.eastRoadRectLoopStartIdx !== undefined) {
      const eStart = this.env.eastRoadRectLoopStartIdx;
      if (this.env.roadRectLoops[eStart]) {
        vehicleFleet.push(
          { kind: 'revuelto_red', loopIdx: eStart, speed: 16.6 },
          { kind: 'rolls_copper_gt', loopIdx: eStart, speed: 14.8 },
          { kind: 'range_black_suv', loopIdx: eStart, speed: 14.2 },
          { kind: 'sport_moto', loopIdx: eStart, speed: 17.2 },
          { kind: 'motorcycle', loopIdx: eStart, speed: 16.0 },
        );
      }
      if (this.env.roadRectLoops[eStart + 1]) {
        vehicleFleet.push(
          { kind: 'cyber_gold', loopIdx: eStart + 1, speed: 14.2 },
          { kind: 'vision_silver', loopIdx: eStart + 1, speed: 15.0 },
          { kind: 'city_scooter', loopIdx: eStart + 1, speed: 11.4 },
          { kind: 'police', loopIdx: eStart + 1, speed: 15.6 },
          { kind: 'sport_moto', loopIdx: eStart + 1, speed: 16.8 },
        );
      }
      if (this.env.roadRectLoops[eStart + 2]) {
        vehicleFleet.push(
          { kind: 'thar_black_4x4', loopIdx: eStart + 2, speed: 13.8 },
          { kind: 'terzo_silver', loopIdx: eStart + 2, speed: 16.4 },
          { kind: 'motorcycle', loopIdx: eStart + 2, speed: 15.8 },
        );
      }
    }
    if (this.env.westRoadRectLoopStartIdx !== undefined) {
      const wStart = this.env.westRoadRectLoopStartIdx;
      if (this.env.roadRectLoops[wStart]) {
        vehicleFleet.push(
          { kind: 'lambo_blue_hyper', loopIdx: wStart, speed: 18.0 },
          { kind: 'stealth_hyper', loopIdx: wStart, speed: 16.5 },
          { kind: 'sport_moto', loopIdx: wStart, speed: 18.8 },
          { kind: 'cyber_pickup', loopIdx: wStart, speed: 14.5 },
          { kind: 'motorcycle', loopIdx: wStart, speed: 16.6 },
        );
      }
      if (this.env.roadRectLoops[wStart + 1]) {
        vehicleFleet.push(
          { kind: 'range_black_suv', loopIdx: wStart + 1, speed: 14.2 },
          { kind: 'rolls_copper_gt', loopIdx: wStart + 1, speed: 15.0 },
          { kind: 'city_scooter', loopIdx: wStart + 1, speed: 12.0 },
          { kind: 'challenger_scissor', loopIdx: wStart + 1, speed: 17.0 },
          { kind: 'police', loopIdx: wStart + 1, speed: 15.8 },
        );
      }
      if (this.env.roadRectLoops[wStart + 2]) {
        vehicleFleet.push(
          { kind: 'cyber_gold', loopIdx: wStart + 2, speed: 14.6 },
          { kind: 'gullwing_coupe', loopIdx: wStart + 2, speed: 15.4 },
          { kind: 'sport_moto', loopIdx: wStart + 2, speed: 17.6 },
        );
      }
    }

    vehicleFleet.forEach((vCfg, idx) => {
      const agentId = 8000 + idx;
      const built = buildModernVehicleMesh(
        agentId,
        vCfg.kind,
        idx,
        wheelGeo,
        tireMat,
        sharedPropMats,
        this.geometries,
        this.materials,
        this.shootableMeshes,
      );
      this.root.add(built.root);

      const circleLoop =
        vCfg.circleLoopIdx !== undefined && this.env.roadCircleLoops
          ? this.env.roadCircleLoops[vCfg.circleLoopIdx]
          : null;
      const loop =
        !circleLoop && vCfg.loopIdx >= 0
          ? this.env.roadRectLoops[vCfg.loopIdx % this.env.roadRectLoops.length]
          : null;
      const edge = (idx % 4) as 0 | 1 | 2 | 3;
      let vx = 0;
      let vz = 0;
      let initCircleAngle = 0;
      if (circleLoop) {
        initCircleAngle = ((idx * 1.37) % (Math.PI * 2));
        const r = circleLoop.radius + (circleLoop.clockwise ? 2.8 : -2.8);
        vx = circleLoop.cx + Math.cos(initCircleAngle) * r;
        vz = circleLoop.cz + Math.sin(initCircleAngle) * r;
      } else if (loop) {
        const laneOff = 3.2;
        if (edge === 0) {
          vx = THREE.MathUtils.lerp(loop.minX + 12, loop.maxX - 12, (idx * 0.23) % 1);
          vz = loop.minZ + laneOff;
        } else if (edge === 1) {
          vx = loop.maxX - laneOff;
          vz = THREE.MathUtils.lerp(loop.minZ + 12, loop.maxZ - 12, (idx * 0.27) % 1);
        } else if (edge === 2) {
          vx = THREE.MathUtils.lerp(loop.maxX - 12, loop.minX + 12, (idx * 0.31) % 1);
          vz = loop.maxZ - laneOff;
        } else {
          vx = loop.minX + laneOff;
          vz = THREE.MathUtils.lerp(loop.maxZ - 12, loop.minZ + 12, (idx * 0.37) % 1);
        }
      } else {
        const pPt = this.env.parkCoords.cycleLoop[idx % this.env.parkCoords.cycleLoop.length];
        vx = pPt.x;
        vz = pPt.z;
      }

      const isMotoOrBike =
        vCfg.kind === 'motorcycle' ||
        vCfg.kind === 'sport_moto' ||
        vCfg.kind === 'city_scooter' ||
        vCfg.kind === 'bicycle';
      const isSuvOrCyber =
        vCfg.kind === 'cyber_pickup' ||
        vCfg.kind === 'cyber_gold' ||
        vCfg.kind === 'range_black_suv' ||
        vCfg.kind === 'thar_black_4x4' ||
        vCfg.kind === 'police';
      const maxHp = isMotoOrBike ? 75 : isSuvOrCyber ? 185 : 140;
      const isEastVeh =
        circleLoop !== null ||
        (this.env.eastRoadRectLoopStartIdx !== undefined && vCfg.loopIdx >= this.env.eastRoadRectLoopStartIdx) ||
        (this.env.westRoadRectLoopStartIdx !== undefined && vCfg.loopIdx >= this.env.westRoadRectLoopStartIdx);
      const initFuel = !isEastVeh && vCfg.loopIdx >= 0 && !isMotoOrBike ? 22 + ((idx * 17) % 58) : 95;

      this.roadAgents.push({
        id: agentId,
        kind: vCfg.kind,
        root: built.root,
        wheels: built.wheels,
        frontWheelSteerPivots: built.frontWheelSteerPivots,
        steerAngle: 0,
        prevYaw: 0,
        wheelRadii: built.wheelRadii,
        wheelSides: built.wheelSides,
        wheelBaseY: built.wheelBaseY,
        puncturedWheels: built.wheels.map(() => false),
        puncturedCount: 0,
        glassPanes: built.glassPanes,
        meshes: built.meshes,
        lightBarMeshes: built.lightBarMeshes,
        doorPivotL: built.doorPivotL,
        driverSeatGroup: built.driverSeatGroup,
        originalMats: built.originalMats,
        colW: built.colW,
        colH: built.colH,
        colD: built.colD,
        loopIdx: vCfg.loopIdx,
        circleLoopIdx: vCfg.circleLoopIdx,
        circleAngle: initCircleAngle,
        edge,
        x: vx,
        z: vz,
        yaw: 0,
        speed: vCfg.speed,
        maxSpeed: vCfg.speed,
        baseMaxSpeed: vCfg.speed,
        stoppedAtSignal: false,
        refuel: createVehicleRefuelTracker(initFuel),
        hp: maxHp,
        maxHp,
        destroyed: false,
        respawnTimer: 0,
        hideTimer: 0,
        hitFlashTimer: 0,
        hornCooldown: 2 + (idx % 6),
        spawnX: vx,
        spawnZ: vz,
        spawnEdge: edge,
      });
    });

    // 11. BILLIONAIRE LUXURY CAR COUPLES (City Boulevard -> Mansion Gate Auto-Open -> Courtyard Park -> Staircase 2 Climb -> 3F DJ Party -> Morning Departure)
    const vipCarDefs: Array<{
      kind: 'rolls_copper_gt' | 'revuelto_red' | 'lambo_blue_hyper' | 'vision_silver';
      suitHex: number;
      gownHex: number;
      accentHex: number;
      park: { x: number; z: number; yaw: number };
      party: { x: number; z: number };
      delaySec: number;
    }> = [
      {
        kind: 'rolls_copper_gt',
        suitHex: 0x0f172a,
        gownHex: 0xf8fafc,
        accentHex: 0xd99b26,
        park: { x: 13.8, z: -296.0, yaw: 0.35 },
        party: { x: -6.2, z: -363.2 },
        delaySec: 0,
      },
      {
        kind: 'revuelto_red',
        suitHex: 0x7f1d1d,
        gownHex: 0x991b1b,
        accentHex: 0xfbbf24,
        park: { x: 13.8, z: -306.5, yaw: 0.42 },
        party: { x: 6.4, z: -363.2 },
        delaySec: 6.5,
      },
      {
        kind: 'lambo_blue_hyper',
        suitHex: 0x111827,
        gownHex: 0xe7d3b0,
        accentHex: 0x38bdf8,
        park: { x: -13.8, z: -295.0, yaw: -0.35 },
        party: { x: -3.8, z: -354.5 },
        delaySec: 13.0,
      },
      {
        kind: 'vision_silver',
        suitHex: 0xf8fafc,
        gownHex: 0x065f46,
        accentHex: 0xf59e0b,
        park: { x: 16.5, z: -276.0, yaw: 0.15 },
        party: { x: 4.2, z: -354.5 },
        delaySec: 19.5,
      },
    ];
    vipCarDefs.forEach((vc, idx) => {
      const carBuilt = buildModernVehicleMesh(
        92000 + idx,
        vc.kind,
        idx,
        wheelGeo,
        tireMat,
        sharedPropMats,
        this.geometries,
        this.materials,
        [],
      );
      const startZ = -172 + idx * 14;
      carBuilt.root.position.set(2.8, 0.05, startZ);
      carBuilt.root.rotation.set(0, Math.PI, 0);
      carBuilt.root.visible = false;
      this.root.add(carBuilt.root);

      const him = buildVipStyledHumanoid(
        sharedGeo,
        {
          isFemale: false,
          suitHex: vc.suitHex,
          pantsHex: vc.suitHex === 0xf8fafc ? 0xf8fafc : 0x0b0f17,
          accentHex: vc.accentHex,
          hairHex: 0x111827,
          hasSunglasses: idx % 2 === 0,
        },
        this.materials,
      );
      const her = buildVipStyledHumanoid(
        sharedGeo,
        {
          isFemale: true,
          suitHex: vc.gownHex,
          pantsHex: vc.gownHex,
          accentHex: vc.accentHex,
          hairHex: idx % 2 === 0 ? 0x3f2718 : 0x111827,
        },
        this.materials,
      );
      him.root.visible = false;
      her.root.visible = false;
      this.root.add(him.root, her.root);

      this.vipCarCouples.push({
        id: 92000 + idx,
        root: carBuilt.root,
        wheels: carBuilt.wheels,
        frontWheelSteerPivots: carBuilt.frontWheelSteerPivots,
        wheelRadii: carBuilt.wheelRadii,
        doorPivotL: carBuilt.doorPivotL,
        x: 2.8,
        y: 0.05,
        z: startZ,
        yaw: Math.PI,
        stage: 'away_cooldown',
        stageTimer: 0.5 + idx * 0.9,
        parkSlot: vc.park,
        partySpot: vc.party,
        driveWps: [],
        driveWpIdx: 0,
        couple: [him, her],
        couplePos: [
          { x: vc.park.x - 1.4, y: 0.1, z: vc.park.z, yaw: 0, phase: 0 },
          { x: vc.park.x + 1.4, y: 0.1, z: vc.park.z, yaw: 0, phase: 1.1 },
        ],
        coupleWps: [],
        coupleWpIdx: 0,
      });
    });

    // 12. "AWAIS BALOCH" PRIVATE STEALTH HELICOPTER + 4 ROOFTOP ARMED SECURITY GUARDS + PARTY COUPLE
    {
      const heliBuilt = buildAwaisPrivateHelicopter(this.geometries, this.materials);
      const pad = MANSION_HELIPAD_2_COORDS;
      heliBuilt.root.position.set(pad.x + 48, pad.deckY + 34, pad.z + 52);
      heliBuilt.root.visible = false;
      this.root.add(heliBuilt.root);

      const guardOffsets: Array<[number, number, number]> = [
        [-4.2, -3.6, -Math.PI * 0.25],
        [4.2, -3.6, Math.PI * 0.25],
        [-4.4, 3.4, -Math.PI * 0.75],
        [4.2, 3.4, Math.PI * 0.75],
      ];
      const guards = guardOffsets.map(([ox, oz, gyaw], gIdx) => {
        const gRig = buildVipStyledHumanoid(
          sharedGeo,
          {
            isFemale: false,
            suitHex: 0x0b0f17,
            pantsHex: 0x090d16,
            accentHex: 0x1e293b,
            hairHex: 0x0f172a,
            hasSunglasses: true,
            scale: 1.07,
          },
          this.materials,
        );
        const rifle = sharedGeo.akPrototype.clone();
        rifle.position.set(-0.02, -0.28, 0.12);
        rifle.rotation.set(Math.PI * 0.5, 0, 0);
        rifle.scale.setScalar(1.06);
        gRig.rightElbow.add(rifle);
        gRig.rightArm.rotation.x = -0.65;
        gRig.leftArm.rotation.x = -0.45;
        gRig.root.visible = false;
        this.root.add(gRig.root);
        return {
          rig: gRig,
          x: pad.x + ox,
          y: MANSION_ROOF_Y + 0.02,
          z: pad.z + oz,
          yaw: gyaw + (gIdx % 2 === 0 ? 0.1 : -0.1),
        };
      });

      const awais = buildVipStyledHumanoid(
        sharedGeo,
        {
          isFemale: false,
          suitHex: 0x0f172a,
          pantsHex: 0x0b0f17,
          accentHex: 0xfbbf24,
          hairHex: 0x090d16,
          hasSunglasses: true,
          scale: 1.06,
        },
        this.materials,
      );
      const partner = buildVipStyledHumanoid(
        sharedGeo,
        {
          isFemale: true,
          suitHex: 0xe7d3b0,
          pantsHex: 0xe7d3b0,
          accentHex: 0xfbbf24,
          hairHex: 0x2b1b12,
          scale: 0.97,
        },
        this.materials,
      );
      awais.root.visible = false;
      partner.root.visible = false;
      this.root.add(awais.root, partner.root);

      this.awaisHeliGuest = {
        heliRoot: heliBuilt.root,
        mainRotorPivot: heliBuilt.mainRotorPivot,
        tailRotorPivot: heliBuilt.tailRotorPivot,
        rotorBlurMesh: heliBuilt.rotorBlurMesh,
        beaconMat: heliBuilt.beaconMat,
        x: pad.x + 48,
        y: pad.deckY + 34,
        z: pad.z + 52,
        yaw: pad.yaw,
        rotorSpeed: 32,
        stage: 'away_cooldown',
        stageTimer: 1.0,
        guards,
        awais,
        partner,
        awaisState: { x: pad.x - 1.2, y: MANSION_ROOF_Y, z: pad.z + 3.2, yaw: 0, phase: 0 },
        partnerState: { x: pad.x + 1.2, y: MANSION_ROOF_Y, z: pad.z + 3.2, yaw: 0, phase: 0.9 },
        wps: [],
        wpIdx: 0,
      };
    }
  }

  public getMansionGateActors(): ReadonlyArray<{ x: number; z: number }> {
    this.mansionGateActorsScratch.length = 0;
    for (let i = 0; i < this.vipCarCouples.length; i++) {
      const vc = this.vipCarCouples[i];
      if (
        vc.stage !== 'away_cooldown' &&
        vc.z >= -272 &&
        vc.z <= -224 &&
        Math.abs(vc.x) <= 22
      ) {
        this.mansionGateActorsScratch.push({ x: vc.x, z: vc.z });
      }
    }
    return this.mansionGateActorsScratch;
  }

  public triggerMansionPartyDeparture(): void {
    this.manualDayDepartureActive = true;
    const reverseCoupleWps = (wps: VipWaypoint[], upToIdx: number): VipWaypoint[] => {
      const len = Math.max(0, Math.min(wps.length, upToIdx));
      const out: VipWaypoint[] = [];
      for (let k = len - 1; k >= 0; k--) {
        const w = wps[k];
        out.push({
          x: w.x,
          y: w.y,
          z: w.z,
          stairDir: w.stairDir === 1 ? -1 : w.stairDir === -1 ? 1 : 0,
        });
      }
      return out;
    };

    for (let i = 0; i < this.vipCarCouples.length; i++) {
      const vc = this.vipCarCouples[i];
      if (vc.stage === 'party_dance') {
        vc.coupleWps = [
          { x: 27.6, y: 11.6, z: -349.6, stairDir: 0 },
          ...buildStaircase2Path(2, 0),
          { x: 18.5, y: 0.14, z: -344, stairDir: 0 },
          { x: 0, y: 0.14, z: -328, stairDir: 0 },
          { x: 0, y: 0.14, z: -316, stairDir: 0 },
          { x: vc.parkSlot.x, y: 0.1, z: vc.parkSlot.z, stairDir: 0 },
        ];
        vc.coupleWpIdx = 0;
        vc.stage = 'couple_exit';
        vc.stageTimer = 0;
      } else if (vc.stage === 'couple_enter') {
        const backPath = reverseCoupleWps(vc.coupleWps, vc.coupleWpIdx);
        backPath.push({ x: vc.parkSlot.x, y: 0.1, z: vc.parkSlot.z, stairDir: 0 });
        vc.coupleWps = backPath;
        vc.coupleWpIdx = 0;
        vc.stage = 'couple_exit';
        vc.stageTimer = 0;
      } else if (vc.stage === 'drive_park' || vc.stage === 'wait_gate_in') {
        vc.driveWps = [
          { x: vc.parkSlot.x > 0 ? 11.5 : -11.5, z: -282 },
          { x: -2.8, z: -260 },
          { x: -2.8, z: -255 },
        ];
        vc.driveWpIdx = 0;
        vc.stage = 'wait_gate_out';
        vc.stageTimer = 2.0;
      } else if (vc.stage === 'approach_gate') {
        vc.driveWps = [
          { x: -2.8, z: Math.max(-230, vc.z) },
          { x: -2.8, z: -162 },
        ];
        vc.driveWpIdx = 0;
        vc.stage = 'drive_away';
        vc.stageTimer = 0;
      }
    }

    if (this.awaisHeliGuest) {
      const hg = this.awaisHeliGuest;
      const pad = MANSION_HELIPAD_2_COORDS;
      if (hg.stage === 'party_dance') {
        hg.wps = [
          { x: 22.4, y: 11.6, z: -350.5, stairDir: 0 },
          ...buildStaircase2Path(2, 3),
          { x: 32.4, y: MANSION_ROOF_Y, z: -349.5, stairDir: 0 },
          { x: 32.4, y: MANSION_ROOF_Y, z: -368.0, stairDir: 0 },
          { x: pad.x, y: MANSION_ROOF_Y, z: pad.z + 3.2, stairDir: 0 },
        ];
        hg.wpIdx = 0;
        hg.stage = 'couple_ascend';
      } else if (hg.stage === 'couple_descend') {
        const backPath = reverseCoupleWps(hg.wps, hg.wpIdx);
        backPath.push({ x: pad.x, y: MANSION_ROOF_Y, z: pad.z + 3.2, stairDir: 0 });
        hg.wps = backPath;
        hg.wpIdx = 0;
        hg.stage = 'couple_ascend';
      } else if (hg.stage === 'fly_in' || hg.stage === 'land_settle') {
        hg.rotorSpeed = 34;
        hg.stage = 'takeoff';
        hg.stageTimer = 0;
      }
    }
  }

  public getVipPartyDebugState(): {
    manualDayDepartureActive: boolean;
    carStages: string[];
    heliStage: string | null;
  } {
    return {
      manualDayDepartureActive: this.manualDayDepartureActive,
      carStages: this.vipCarCouples.map((vc) => vc.stage),
      heliStage: this.awaisHeliGuest ? this.awaisHeliGuest.stage : null,
    };
  }

  private pickInitialPositionForRole(role: NpcRoleId, idx: number): {
    x: number;
    y: number;
    z: number;
    homeX: number;
    homeZ: number;
  } {
    const house = this.env.houses[idx % this.env.houses.length] ?? { doorX: 120, doorZ: 120 };
    if (role === 'house_leaver' || role === 'home_returner') {
      return { x: house.doorX, y: 0, z: house.doorZ, homeX: house.doorX, homeZ: house.doorZ };
    }
    if (role === 'hotel_receptionist') {
      const r = this.env.hotelCoords.receptionSpots[idx % this.env.hotelCoords.receptionSpots.length];
      return { x: r.x, y: 0, z: r.z, homeX: r.x, homeZ: r.z };
    }
    if (role === 'chef') {
      const k = this.env.hotelCoords.kitchenSpots[idx % this.env.hotelCoords.kitchenSpots.length];
      return { x: k.x, y: 0, z: k.z, homeX: k.x, homeZ: k.z };
    }
    if (role === 'waiter' || role === 'hotel_cleaner') {
      const w = this.env.hotelCoords.cleanWaypoints[idx % this.env.hotelCoords.cleanWaypoints.length];
      return { x: w.x, y: 0, z: w.z, homeX: w.x, homeZ: w.z };
    }
    const mall = this.env.malls[idx % this.env.malls.length];
    if ((role === 'cashier' || role === 'shopkeeper') && mall) {
      const c = mall.cashierSpots[idx % mall.cashierSpots.length];
      return { x: c.x, y: c.y, z: c.z, homeX: c.x, homeZ: c.z };
    }
    if (role === 'clothes_shopper' && mall) {
      const s = mall.clothesSpots[idx % mall.clothesSpots.length];
      return { x: s.x, y: s.y, z: s.z, homeX: house.doorX, homeZ: house.doorZ };
    }
    if (role === 'watch_shopper' && mall) {
      const list = idx % 2 === 0 ? mall.watchSpots : mall.perfumeShoeSpots;
      const s = list[idx % list.length];
      return { x: s.x, y: s.y, z: s.z, homeX: house.doorX, homeZ: house.doorZ };
    }
    if (role === 'mall_security' && mall) {
      return {
        x: mall.nav.cx + (idx % 2 === 0 ? -5 : 5),
        y: 0,
        z: mall.nav.cz + 8,
        homeX: mall.nav.cx,
        homeZ: mall.nav.cz,
      };
    }
    if (role === 'traffic_police') {
      const inter = this.env.intersections[idx % this.env.intersections.length] ?? { x: 0, z: 0 };
      return { x: inter.x + 8.5, y: 0, z: inter.z + 8.5, homeX: inter.x + 8.5, homeZ: inter.z + 8.5 };
    }
    if (role === 'playground_child' || role === 'parent_with_child') {
      const p = this.env.parkCoords.playgroundSpots[idx % this.env.parkCoords.playgroundSpots.length];
      return { x: p.x, y: 0, z: p.z, homeX: house.doorX, homeZ: house.doorZ };
    }
    if (role === 'exerciser') {
      const g = this.env.parkCoords.gymSpots[idx % this.env.parkCoords.gymSpots.length];
      return { x: g.x, y: 0, z: g.z, homeX: house.doorX, homeZ: house.doorZ };
    }
    if (role === 'jogger') {
      const j = this.env.parkCoords.jogLoop[idx % this.env.parkCoords.jogLoop.length];
      return { x: j.x, y: 0, z: j.z, homeX: house.doorX, homeZ: house.doorZ };
    }
    if (role === 'bench_sitter') {
      const b = this.env.parkCoords.benches[idx % this.env.parkCoords.benches.length];
      return { x: b.x, y: 0, z: b.z, homeX: house.doorX, homeZ: house.doorZ };
    }
    if (role === 'farmer') {
      const f = this.env.farmPlots[idx % this.env.farmPlots.length];
      return { x: f.x, y: this.env.groundHeightAt(f.x, f.z, 0), z: f.z, homeX: f.x, homeZ: f.z };
    }
    if (role === 'tourist_camera') {
      const t = this.env.touristSpots[idx % this.env.touristSpots.length];
      return { x: t.x, y: this.env.groundHeightAt(t.x, t.z, 0), z: t.z, homeX: this.env.hotelCoords.cx, homeZ: this.env.hotelCoords.cz };
    }
    if (role === 'construction_worker') {
      const c = this.env.constructionSpots[idx % this.env.constructionSpots.length];
      return { x: c.x, y: 0, z: c.z, homeX: c.x, homeZ: c.z };
    }
    if (role === 'gardener') {
      const g = this.env.gardenSpots[idx % this.env.gardenSpots.length];
      return { x: g.x, y: 0, z: g.z, homeX: g.x, homeZ: g.z };
    }
    if (role === 'delivery_worker') {
      const d = this.env.deliveryRoutes[idx % this.env.deliveryRoutes.length];
      return { x: d.fromX, y: 0, z: d.fromZ, homeX: d.fromX, homeZ: d.fromZ };
    }
    if (role === 'restaurant_customer') {
      return {
        x: this.env.hotelCoords.cx + ((idx % 3) - 1) * 3.5,
        y: 0,
        z: this.env.hotelCoords.cz - 11.5,
        homeX: house.doorX,
        homeZ: house.doorZ,
      };
    }
    if (this.env.roadRectLoops.length > 4 && idx % 2 === 1) {
      const bayWalkSpots = [
        { x: 284, z: -8 },
        { x: 348, z: -8 },
        { x: 364, z: 8 },
        { x: 428, z: 8 },
        { x: 444, z: -8 },
        { x: 508, z: 8 },
      ];
      const pt = bayWalkSpots[idx % bayWalkSpots.length];
      return { x: pt.x, y: 0, z: pt.z, homeX: house.doorX, homeZ: house.doorZ };
    }
    const bx = ((idx % 5) - 2) * 18 + 6.5;
    const bz = (Math.floor(idx / 5) - 1) * 24 + 6.5;
    return { x: bx, y: 0, z: bz, homeX: house.doorX, homeZ: house.doorZ };
  }

  private assignNextDestination(npc: HumanoidNpc, elapsedSec: number): void {
    if (npc.subMode === 'east_citizen') {
      if (npc.homeX < -400 && this.env.westCitizenSpots && this.env.westCitizenSpots.length > 0) {
        const sameZone = this.env.westCitizenSpots.filter(
          (s) => Math.hypot(s.x - npc.homeX, s.z - npc.homeZ) < 140,
        );
        const pool = sameZone.length > 0 ? sameZone : this.env.westCitizenSpots;
        const pt = pool[(npc.id + npc.waypointIndex) % pool.length];
        npc.targetX = pt.x + Math.sin(npc.waypointIndex * 1.5) * 3.5;
        npc.targetY = 0;
        npc.targetZ = pt.z + Math.cos(npc.waypointIndex * 1.5) * 3.5;
        npc.waitTimer = 2.0;
        npc.waypointIndex++;
        return;
      }
      if (this.env.eastCitizenSpots && this.env.eastCitizenSpots.length > 0) {
        const sameZone = this.env.eastCitizenSpots.filter(
          (s) => Math.hypot(s.x - npc.homeX, s.z - npc.homeZ) < 120,
        );
        const pool = sameZone.length > 0 ? sameZone : this.env.eastCitizenSpots;
        const pt = pool[(npc.id + npc.waypointIndex) % pool.length];
        npc.targetX = pt.x + Math.sin(npc.waypointIndex * 1.5) * 3.5;
        npc.targetY = 0;
        npc.targetZ = pt.z + Math.cos(npc.waypointIndex * 1.5) * 3.5;
        npc.waitTimer = 2.0;
        npc.waypointIndex++;
        return;
      }
    }

    if (npc.subMode === 'festival' && this.env.festivalCoords) {
      const spots = this.env.festivalCoords.crowdSpots;
      const pt = spots[(npc.id + npc.waypointIndex) % spots.length];
      npc.targetX = pt.x + Math.sin(npc.waypointIndex * 1.4) * 2.5;
      npc.targetY = 0;
      npc.targetZ = pt.z + Math.cos(npc.waypointIndex * 1.4) * 2.5;
      npc.waitTimer = 2.0;
      npc.waypointIndex++;
      return;
    }
    if (npc.subMode === 'power_worker' && this.env.powerPlantSpots && this.env.powerPlantSpots.length > 0) {
      const pt = this.env.powerPlantSpots[(npc.id + npc.waypointIndex) % this.env.powerPlantSpots.length];
      npc.targetX = pt.x + ((npc.waypointIndex % 2) - 0.5) * 3.2;
      npc.targetY = 0;
      npc.targetZ = pt.z;
      npc.waitTimer = 2.4;
      npc.waypointIndex++;
      return;
    }
    if (npc.subMode === 'resident' && this.env.buildingResidentSpots && this.env.buildingResidentSpots.length > 0) {
      const anchor = this.env.buildingResidentSpots[npc.id % this.env.buildingResidentSpots.length];
      const ang = npc.waypointIndex * 1.6 + npc.id;
      npc.targetX = anchor.x + Math.cos(ang) * 4.5;
      npc.targetY = 0;
      npc.targetZ = anchor.z + Math.sin(ang) * 4.5;
      npc.waitTimer = 2.6;
      npc.waypointIndex++;
      return;
    }

    const role = npc.spec.id;
    const goal = computeDailyRoutineGoal(role, this.currentPhase, elapsedSec, npc.id);

    if (role === 'hotel_receptionist') {
      const r = this.env.hotelCoords.receptionSpots[npc.id % this.env.hotelCoords.receptionSpots.length];
      npc.targetX = r.x;
      npc.targetY = 0;
      npc.targetZ = r.z;
      npc.subMode = 'walk';
      npc.waitTimer = 5.0;
      return;
    }
    if (role === 'chef') {
      const k = this.env.hotelCoords.kitchenSpots[(npc.id + npc.waypointIndex) % this.env.hotelCoords.kitchenSpots.length];
      npc.targetX = k.x + ((npc.waypointIndex % 2) * 1.8 - 0.9);
      npc.targetY = 0;
      npc.targetZ = k.z;
      npc.subMode = 'serve';
      npc.waitTimer = 2.5;
      npc.waypointIndex++;
      return;
    }
    if (role === 'waiter') {
      const occupied = this.tableSystem.seats.filter((s) => s.occupiedByNpcId !== null);
      if (occupied.length > 0 && npc.waypointIndex % 2 === 0) {
        const seat = occupied[npc.waypointIndex % occupied.length];
        npc.targetX = seat.lookAtX;
        npc.targetY = seat.y;
        npc.targetZ = seat.lookAtZ;
        npc.subMode = 'serve';
      } else {
        const k = this.env.hotelCoords.kitchenSpots[0];
        npc.targetX = k.x;
        npc.targetY = 0;
        npc.targetZ = k.z + 2.2;
        npc.subMode = 'walk';
      }
      npc.waitTimer = 2.0;
      npc.waypointIndex++;
      return;
    }
    if (role === 'hotel_cleaner') {
      const w = this.env.hotelCoords.cleanWaypoints[npc.waypointIndex % this.env.hotelCoords.cleanWaypoints.length];
      npc.targetX = w.x;
      npc.targetY = 0;
      npc.targetZ = w.z;
      npc.subMode = 'walk';
      npc.waitTimer = 1.8;
      npc.waypointIndex++;
      return;
    }

    const npcMall = this.env.malls[npc.id % this.env.malls.length];
    if ((role === 'cashier' || role === 'shopkeeper') && npcMall) {
      const c = npcMall.cashierSpots[npc.id % npcMall.cashierSpots.length];
      npc.targetX = c.x + ((npc.waypointIndex % 2) - 0.5) * 1.2;
      npc.targetY = c.y;
      npc.targetZ = c.z;
      npc.subMode = 'walk';
      npc.waitTimer = 4.0;
      npc.waypointIndex++;
      return;
    }
    if (role === 'mall_security' && npcMall) {
      const floorStep = npc.waypointIndex % 3;
      if (floorStep === 1) {
        npc.targetX = npcMall.nav.cx - 8;
        npc.targetY = npcMall.nav.floorHeight;
        npc.targetZ = npcMall.nav.cz + 6;
      } else if (floorStep === 2) {
        npc.targetX = npcMall.nav.cx + 8;
        npc.targetY = npcMall.nav.floorHeight * 2;
        npc.targetZ = npcMall.nav.cz - 6;
      } else {
        npc.targetX = npcMall.nav.cx + ((npc.waypointIndex % 2) * 2 - 1) * 10;
        npc.targetY = 0;
        npc.targetZ = npcMall.nav.cz + 6;
      }
      npc.subMode = 'walk';
      npc.waitTimer = 2.0;
      npc.waypointIndex++;
      return;
    }
    if (role === 'traffic_police') {
      const inter = this.env.intersections[npc.id % this.env.intersections.length] ?? { x: 0, z: 0 };
      npc.targetX = inter.x + 8.6;
      npc.targetY = 0;
      npc.targetZ = inter.z + 8.6;
      npc.subMode = 'serve';
      npc.waitTimer = 4.5;
      return;
    }
    if (role === 'farmer') {
      const f = this.env.farmPlots[(npc.id + npc.waypointIndex) % this.env.farmPlots.length];
      npc.targetX = f.x + Math.sin(npc.waypointIndex * 1.7) * 4.0;
      npc.targetZ = f.z + Math.cos(npc.waypointIndex * 1.3) * 4.0;
      npc.targetY = this.env.groundHeightAt(npc.targetX, npc.targetZ, 0);
      npc.subMode = 'walk';
      npc.waitTimer = 2.0;
      npc.waypointIndex++;
      return;
    }
    if (role === 'tourist_camera') {
      const t = this.env.touristSpots[(npc.id + npc.waypointIndex) % this.env.touristSpots.length];
      npc.targetX = t.x + ((npc.waypointIndex % 3) - 1) * 2.5;
      npc.targetZ = t.z + ((npc.waypointIndex % 2) - 0.5) * 2.5;
      npc.targetY = this.env.groundHeightAt(npc.targetX, npc.targetZ, 0);
      npc.subMode = 'photo';
      npc.waitTimer = 4.5;
      npc.waypointIndex++;
      return;
    }
    if (role === 'construction_worker') {
      const c = this.env.constructionSpots[(npc.id + npc.waypointIndex) % this.env.constructionSpots.length];
      npc.targetX = c.x + Math.sin(npc.waypointIndex) * 5;
      npc.targetZ = c.z + Math.cos(npc.waypointIndex) * 5;
      npc.targetY = 0;
      npc.subMode = 'walk';
      npc.waitTimer = 2.2;
      npc.waypointIndex++;
      return;
    }
    if (role === 'gardener') {
      const g = this.env.gardenSpots[(npc.id + npc.waypointIndex) % this.env.gardenSpots.length];
      npc.targetX = g.x;
      npc.targetY = 0;
      npc.targetZ = g.z;
      npc.subMode = 'water';
      npc.waitTimer = 3.5;
      npc.waypointIndex++;
      return;
    }
    if (role === 'delivery_worker') {
      const r = this.env.deliveryRoutes[npc.id % this.env.deliveryRoutes.length];
      const toShop = npc.waypointIndex % 2 === 0;
      npc.targetX = toShop ? r.toX : r.fromX;
      npc.targetY = 0;
      npc.targetZ = toShop ? r.toZ : r.fromZ;
      npc.subMode = 'deliver';
      npc.waitTimer = 2.4;
      npc.waypointIndex++;
      return;
    }
    if (role === 'playground_child') {
      const p = this.env.parkCoords.playgroundSpots[(npc.id + npc.waypointIndex) % this.env.parkCoords.playgroundSpots.length];
      npc.targetX = p.x + Math.sin(npc.waypointIndex * 2.1) * 2.2;
      npc.targetY = 0;
      npc.targetZ = p.z + Math.cos(npc.waypointIndex * 1.7) * 2.2;
      npc.subMode = 'play';
      npc.waitTimer = 1.6;
      npc.waypointIndex++;
      return;
    }
    if (role === 'parent_with_child') {
      const p = this.env.parkCoords.playgroundSpots[npc.id % this.env.parkCoords.playgroundSpots.length];
      npc.targetX = p.x + (npc.waypointIndex % 2 === 0 ? -3.0 : 3.0);
      npc.targetY = 0;
      npc.targetZ = p.z + 2.4;
      npc.subMode = 'walk';
      npc.waitTimer = 3.0;
      npc.waypointIndex++;
      return;
    }
    if (role === 'jogger') {
      const j = this.env.parkCoords.jogLoop[npc.waypointIndex % this.env.parkCoords.jogLoop.length];
      npc.targetX = j.x;
      npc.targetY = 0;
      npc.targetZ = j.z;
      npc.subMode = 'walk';
      npc.waitTimer = 0;
      npc.waypointIndex++;
      return;
    }
    if (role === 'exerciser') {
      const g = this.env.parkCoords.gymSpots[npc.id % this.env.parkCoords.gymSpots.length];
      npc.targetX = g.x;
      npc.targetY = 0;
      npc.targetZ = g.z;
      npc.subMode = 'exercise';
      npc.waitTimer = 6.0;
      return;
    }
    if (role === 'bench_sitter') {
      const b = this.env.parkCoords.benches[npc.id % this.env.parkCoords.benches.length];
      npc.targetX = b.x;
      npc.targetY = 0;
      npc.targetZ = b.z;
      npc.subMode = 'sit';
      npc.waitTimer = 8.0;
      return;
    }

    if (goal === 'dine_at_restaurant' || role === 'restaurant_customer') {
      const seat = this.tableSystem.claimFreeSeat(npc.id, undefined, 10 + (npc.id % 6));
      if (seat) {
        npc.activeSeat = seat;
        npc.targetX = seat.x;
        npc.targetY = seat.y;
        npc.targetZ = seat.z;
        npc.subMode = 'eat';
        npc.waitTimer = 0;
        return;
      }
    }

    if ((goal === 'shop_at_mall' || role === 'clothes_shopper' || role === 'watch_shopper') && npcMall) {
      const pool =
        role === 'watch_shopper'
          ? [...npcMall.watchSpots, ...npcMall.perfumeShoeSpots]
          : [...npcMall.clothesSpots, ...npcMall.foodCourtSpots];
      const s = pool[(npc.id + npc.waypointIndex) % pool.length];
      npc.targetX = s.x;
      npc.targetY = s.y;
      npc.targetZ = s.z;
      npc.subMode = 'walk';
      npc.waitTimer = 2.8;
      npc.waypointIndex++;
      return;
    }

    if (goal === 'leave_home_for_bus_or_walk') {
      const stop = this.env.busStops[npc.id % this.env.busStops.length];
      const atStop = npc.waypointIndex % 2 === 1;
      npc.targetX = atStop ? npc.homeX : stop.x;
      npc.targetY = 0;
      npc.targetZ = atStop ? npc.homeZ : stop.z;
      npc.subMode = 'walk';
      npc.waitTimer = 3.0;
      npc.waypointIndex++;
      return;
    }

    if (goal === 'return_home_or_hotel') {
      const goHotel = npc.id % 3 === 0;
      npc.targetX = goHotel ? this.env.hotelCoords.cx : npc.homeX;
      npc.targetY = 0;
      npc.targetZ = goHotel ? this.env.hotelCoords.cz - 11.2 : npc.homeZ;
      npc.subMode = 'walk';
      npc.waitTimer = 4.5;
      return;
    }

    if (role === 'group_talker') {
      const hubX = -18 + (npc.id % 2) * 42;
      const hubZ = 18;
      npc.targetX = hubX + Math.cos(npc.groupPairAngle) * 1.4;
      npc.targetY = 0;
      npc.targetZ = hubZ + Math.sin(npc.groupPairAngle) * 1.4;
      npc.subMode = 'walk';
      npc.waitTimer = 6.0;
      return;
    }

    if (npc.subMode === 'hospital_doctor' && this.env.hospitalDoctorSpots && this.env.hospitalDoctorSpots.length > 0) {
      const target = this.env.hospitalDoctorSpots[(npc.id + npc.waypointIndex) % this.env.hospitalDoctorSpots.length];
      npc.targetX = target.x + Math.sin(npc.waypointIndex * 1.4) * 1.6;
      npc.targetY = target.y;
      npc.targetZ = target.z + Math.cos(npc.waypointIndex * 1.4) * 1.6;
      npc.waitTimer = 2.2;
      npc.waypointIndex++;
      return;
    }
    if (npc.subMode === 'showroom_customer' && this.env.showroomSpots && this.env.showroomSpots.length > 0) {
      const target = this.env.showroomSpots[(npc.id + npc.waypointIndex) % this.env.showroomSpots.length];
      npc.targetX = target.x + Math.sin(npc.waypointIndex * 1.3) * 1.4;
      npc.targetY = 0;
      npc.targetZ = target.z + Math.cos(npc.waypointIndex * 1.3) * 1.4;
      npc.waitTimer = 3.2;
      npc.waypointIndex++;
      return;
    }

    const p = this.env.parkCoords.jogLoop[(npc.id + npc.waypointIndex) % this.env.parkCoords.jogLoop.length];
    npc.targetX = p.x;
    npc.targetY = 0;
    npc.targetZ = p.z;
    npc.subMode = 'walk';
    npc.waitTimer = 1.5;
    npc.waypointIndex++;
  }

  public update(
    dt: number,
    elapsedSec: number,
    phase: TimeOfDayPhase,
    cameraPos: THREE.Vector3,
    playerPos?: THREE.Vector3,
    onCarHorn?: (distanceMeters: number) => void,
    onPoliceSiren?: (distanceMeters: number) => void,
    onNpcFootstep?: (distanceMeters: number, x: number, z: number) => void,
    camera?: THREE.Camera,
    playerVehicleCollider?: { x: number; z: number; yaw: number; radius: number },
    onVehicleCrash?: (x: number, y: number, z: number, severity: number) => void,
  ): GangFiredShot[] {
    const prevPhase = this.currentPhase;
    this.currentPhase = phase;
    if (phase === 'night') {
      this.manualDayDepartureActive = false;
    } else if (prevPhase === 'night') {
      this.triggerMansionPartyDeparture();
    }
    this.lastElapsedSec = elapsedSec;
    this.frameTick = (this.frameTick + 1) % 60000;
    const clampedDt = Math.min(dt, 0.08);
    this.globalHornCooldown = Math.max(0, this.globalHornCooldown - clampedDt);
    const pPos = playerPos ?? cameraPos;
    const firedShots: GangFiredShot[] = [];

    // Camera frustum setup for true off-screen culling
    const hasFrustum = Boolean(camera);
    if (camera) {
      camera.updateMatrixWorld();
      _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _camFrustum.setFromProjectionMatrix(_projScreenMatrix);
    }
    const isInCameraView = (wx: number, wy: number, wz: number, radius: number, distSq: number, maxVisSq: number): boolean => {
      if (distSq > maxVisSq) return false;
      if (!hasFrustum || distSq < 225) return true; // Keep <= 15m always visible to avoid peripheral pop
      _frustumSphere.center.set(wx, wy + radius * 0.5, wz);
      _frustumSphere.radius = radius;
      return _camFrustum.intersectsSphere(_frustumSphere);
    };

    // Decoupled Fixed-Timestep Simulation Accumulator (~12 Hz heavy AI/traffic/grid collision)
    const SIM_TICK_DT = 1 / 12;
    this.simAccum += clampedDt;
    let simDt = 0;
    const runSimTick = this.simAccum >= SIM_TICK_DT;
    if (runSimTick) {
      simDt = Math.min(this.simAccum, 0.25);
      this.simAccum = 0;

      // Populate zero-allocation dynamic obstacle list from active AI road vehicles for pedestrian avoidance
      this.obstacleBlockers.length = 0;
      for (let i = 0; i < this.roadAgents.length; i++) {
        const v = this.roadAgents[i];
        if (!v.root.visible || v.destroyed) continue;
        this.obstacleBlockers.push({ x: v.x, z: v.z, radius: Math.max(v.colW, v.colD) * 0.55 });
      }

      // 1. Update Traffic Signal Lights (12 Hz)
      for (let i = 0; i < this.env.signalVisuals.length; i++) {
        const sv = this.env.signalVisuals[i];
        const st = computeTrafficSignalState(elapsedSec, sv.offsetSec);
        sv.nsRed.color.setHex(st.ns === 'RED' ? 0xff2222 : 0x2a0808);
        sv.nsYellow.color.setHex(st.ns === 'YELLOW' ? 0xfacc15 : 0x2e2404);
        sv.nsGreen.color.setHex(st.ns === 'GREEN' ? 0x22ff66 : 0x052e16);
        sv.ewRed.color.setHex(st.ew === 'RED' ? 0xff2222 : 0x2a0808);
        sv.ewYellow.color.setHex(st.ew === 'YELLOW' ? 0xfacc15 : 0x2e2404);
        sv.ewGreen.color.setHex(st.ew === 'GREEN' ? 0x22ff66 : 0x052e16);
      }

      // 2. Dining Table Turnover (12 Hz)
      const finishedIds = this.tableSystem.step(simDt, elapsedSec);
      if (finishedIds.length > 0) {
        for (let f = 0; f < finishedIds.length; f++) {
          const npc = this.npcs.find((n) => n.id === finishedIds[f]);
          if (npc && !npc.dead) {
            npc.seated = false;
            npc.activeSeat = null;
            this.assignNextDestination(npc, elapsedSec);
          }
        }
      }

      this.npcPairBuckets.clear();
    }

    const maxNpcVisSq = this.isSoftwareGl ? 92 * 92 : 120 * 120;
    const maxLimbAnimSq = this.isSoftwareGl ? 48 * 48 : 68 * 68;

    // 3. Step All City, Mall, Stadium, Train, Festival, Mountain & Worker NPCs (12 Hz AI + 60 FPS Smooth Interpolation & GTA Kinematics)
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];

      if (n.hitFlashTimer > 0) {
        n.hitFlashTimer = Math.max(0, n.hitFlashTimer - clampedDt);
        n.shirtMat.emissive.setHex(n.hitFlashTimer > 0 ? 0x991b1b : 0x000000);
      }

      if (n.dead) {
        if (n.decapitated && n.bloodEmitTimer && n.bloodEmitTimer > 0) {
          n.bloodEmitTimer = Math.max(0, n.bloodEmitTimer - clampedDt);
          if (this.frameTick % 2 === 0) {
            this.spawnNeckBloodJet(n.x, n.y + 1.38, n.z, 2);
          }
        }
        if (n.fallTimer > 0) {
          n.fallTimer = Math.max(0, n.fallTimer - clampedDt);
          animateHumanoidCollapse(
            n.root,
            n,
            n.x,
            n.y,
            n.z,
            n.yaw,
            n.deathStyle ?? 'default',
            n.fallTimer,
            n.deathDuration ?? 3.2,
            n.hitDirX ?? 0,
            n.hitDirZ ?? 1,
            clampedDt,
            this.env.colliders,
            this.env.groundHeightAt,
            this.colliderGrid,
          );
          if (n.fallTimer <= 0) {
            n.root.visible = false;
          }
        }
        n.respawnTimer -= clampedDt;
        if (n.respawnTimer <= 0) {
          n.dead = false;
          n.decapitated = false;
          n.bloodEmitTimer = 0;
          n.hp = n.maxHp;
          n.limping = false;
          n.staggerTimer = 0;
          n.staggerKind = 'none';
          n.propDropped = false;
          n.vx = 0;
          n.vz = 0;
          if (n.heldPropObj) n.heldPropObj.visible = true;
          if (n.headPivot) {
            n.headPivot.visible = true;
            n.headPivot.rotation.set(0, 0, 0);
          }
          if (n.neckStump) n.neckStump.visible = false;
          n.leftArm.rotation.set(0, 0, 0);
          n.rightArm.rotation.set(0, 0, 0);
          n.leftLeg.rotation.set(0, 0, 0);
          n.rightLeg.rotation.set(0, 0, 0);
          if (n.leftKnee) n.leftKnee.rotation.set(0, 0, 0);
          if (n.rightKnee) n.rightKnee.rotation.set(0, 0, 0);
          if (n.leftElbow) n.leftElbow.rotation.set(0, 0, 0);
          if (n.rightElbow) n.rightElbow.rotation.set(0, 0, 0);
          n.root.visible = true;
          n.root.rotation.set(0, n.yaw, 0);
          if (
            !n.isTrainPassenger &&
            !n.isStadiumSpectator &&
            !n.isFixedSit &&
            !n.isSnowboarder &&
            n.subMode !== 'joker' &&
            n.subMode !== 'football'
          ) {
            const spot = pickRespawnPosition(n.id + Math.floor(elapsedSec), this.respawnPool, pPos.x, pPos.z);
            n.x = spot.x;
            n.y = spot.y;
            n.z = spot.z;
            this.assignNextDestination(n, elapsedSec);
          }
        }
        continue;
      }

      if (n.staggerTimer && n.staggerTimer > 0) {
        n.staggerTimer = Math.max(0, n.staggerTimer - clampedDt);
        if (n.staggerTimer <= 0) n.staggerKind = 'none';
      }

      const distSq = _camCheckPos.set(n.x, n.y, n.z).distanceToSquared(cameraPos);
      const isVisible = isInCameraView(n.x, n.y, n.z, 1.5, distSq, maxNpcVisSq);
      if (n.root.visible !== isVisible) n.root.visible = isVisible;
      const animateLimbs = isVisible && distSq < maxLimbAnimSq;

      if (!isVisible && !n.isTrainPassenger && !n.isSnowboarder && n.subMode !== 'football') {
        continue;
      }

      // Train Car Passengers follow live moving railway carriages (60 FPS)
      if (n.isTrainPassenger && n.trainCarIdx !== undefined && this.env.trainCarStates) {
        const car = this.env.trainCarStates[n.trainCarIdx];
        if (car) {
          const lx = n.trainSeatLocalX ?? 0;
          const lz = n.trainSeatLocalZ ?? 0;
          const cosY = Math.cos(car.yaw);
          const sinY = Math.sin(car.yaw);
          n.x = car.x + lx * cosY + lz * sinY;
          n.z = car.z - lx * sinY + lz * cosY;
          n.y = car.y + 0.52;
          n.yaw = car.yaw;
          n.root.position.set(n.x, n.y - 0.25, n.z);
          n.root.rotation.set(0, n.yaw, 0);
          if (animateLimbs) {
            n.leftLeg.rotation.x = -1.25;
            n.rightLeg.rotation.x = -1.25;
            if (n.leftKnee) n.leftKnee.rotation.x = 1.25;
            if (n.rightKnee) n.rightKnee.rotation.x = 1.25;
            n.leftArm.rotation.x = -0.35;
            n.rightArm.rotation.x = -0.35 + Math.sin(elapsedSec * 2.2 + n.id) * 0.12;
          }
        }
        continue;
      }

      // Pool Swimmers circling Hotel Infinity Pool with freestyle strokes (60 FPS)
      if (n.subMode === 'pool_swimmer' && this.env.infinityPoolZone) {
        const pz = this.env.infinityPoolZone;
        const cx = (pz.minX + pz.maxX) * 0.5;
        const cz = (pz.minZ + pz.maxZ) * 0.5;
        n.poolLaneAngle = (n.poolLaneAngle ?? 0) + clampedDt * 0.42;
        const rx = 4.4;
        const rz = 2.05;
        n.x = cx + Math.cos(n.poolLaneAngle) * rx;
        n.z = cz + Math.sin(n.poolLaneAngle) * rz;
        n.y = pz.y;
        const tx = -Math.sin(n.poolLaneAngle) * rx;
        const tz = Math.cos(n.poolLaneAngle) * rz;
        n.yaw = Math.atan2(tx, tz);
        n.root.position.set(n.x, pz.y - 0.14 + Math.sin(elapsedSec * 4.5 + n.id) * 0.05, n.z);
        n.root.rotation.order = 'YXZ';
        n.root.rotation.set(-Math.PI * 0.44, n.yaw, 0);
        if (animateLimbs) {
          const stroke = elapsedSec * 5.2 + n.id;
          n.leftArm.rotation.x = stroke;
          n.rightArm.rotation.x = stroke + Math.PI;
          n.leftLeg.rotation.x = Math.sin(stroke * 2) * 0.32;
          n.rightLeg.rotation.x = -Math.sin(stroke * 2) * 0.32;
        }
        continue;
      }

      // Hospital Lying Patients & Beach Sunbathers
      if (n.subMode === 'hospital_patient') {
        n.root.position.set(n.x, n.y + 0.74, n.z + 0.76);
        n.root.rotation.order = 'YXZ';
        n.root.rotation.set(-Math.PI * 0.5, 0, 0);
        if (animateLimbs) {
          n.leftLeg.rotation.x = 0.04;
          n.rightLeg.rotation.x = 0.04;
          n.leftArm.rotation.set(-0.08, 0, 0.12);
          n.rightArm.rotation.set(-0.08, 0, -0.12);
        }
        continue;
      }
      if (n.subMode === 'party_dancer' && this.env.mansionPartyZone) {
        if (!shouldMansionNightGuestsAttend(phase, this.manualDayDepartureActive)) {
          n.root.visible = false;
          continue;
        }
        const mp = this.env.mansionPartyZone;
        const beat = elapsedSec * 6.8 + n.id * 1.15;
        const bounce = Math.abs(Math.sin(beat)) * 0.08;
        const baseYaw = Math.atan2(mp.djX - n.x, mp.djZ - n.z);
        n.yaw = baseYaw + Math.sin(elapsedSec * 1.45 + n.id) * 0.24;
        n.root.position.set(n.x, mp.y + bounce, n.z);
        n.root.rotation.order = 'YXZ';
        n.root.rotation.set(0, n.yaw, Math.sin(beat * 0.5) * 0.05);
        if (animateLimbs) {
          const sway = Math.sin(beat) * 0.35;
          n.leftLeg.rotation.x = Math.sin(beat) * 0.16;
          n.rightLeg.rotation.x = -Math.sin(beat) * 0.16;
          if (n.leftKnee) n.leftKnee.rotation.x = Math.max(0, Math.sin(beat)) * 0.26;
          if (n.rightKnee) n.rightKnee.rotation.x = Math.max(0, -Math.sin(beat)) * 0.26;
          n.leftArm.rotation.set(-1.55 + Math.sin(beat * 1.0) * 0.55, 0, -0.32 - Math.cos(beat) * 0.2);
          if (n.leftElbow) n.leftElbow.rotation.x = -0.55;
          if (n.heldPropObj) {
            // Drink cold drink periodically while grooving to the DJ beat
            const sipCycle = Math.sin(elapsedSec * 1.15 + n.id * 1.7);
            const sipLift = sipCycle > 0.35 ? (sipCycle - 0.35) / 0.65 : 0;
            n.rightArm.rotation.set(-0.65 - sipLift * 0.88 + sway * 0.2, 0.22 * sipLift, 0.14);
            if (n.rightElbow) n.rightElbow.rotation.x = -0.78 - sipLift * 0.62;
          } else {
            n.rightArm.rotation.set(-1.55 + Math.cos(beat * 1.0) * 0.55, 0, 0.32 + Math.sin(beat) * 0.2);
            if (n.rightElbow) n.rightElbow.rotation.x = -0.55;
          }
        }
        continue;
      }

      if (n.subMode === 'beach_sunbather') {
        n.root.position.set(n.x - 0.76, n.y + 0.14, n.z);
        n.root.rotation.order = 'YXZ';
        n.root.rotation.set(-1.38, -Math.PI * 0.5, 0);
        if (animateLimbs) {
          n.leftLeg.rotation.x = 0.04;
          n.rightLeg.rotation.x = 0.04;
          n.leftArm.rotation.set(-0.1, 0, 0.14);
          n.rightArm.rotation.set(-0.1, 0, -0.14);
        }
        continue;
      }

      // Stationary Sitters
      if (n.isStadiumSpectator || n.isFixedSit) {
        n.root.position.set(n.x, n.y - 0.24, n.z);
        n.root.rotation.set(0, n.yaw, 0);
        if (animateLimbs) {
          n.leftLeg.rotation.x = -1.25;
          n.rightLeg.rotation.x = -1.25;
          if (n.leftKnee) n.leftKnee.rotation.x = 1.25;
          if (n.rightKnee) n.rightKnee.rotation.x = 1.25;
          if (n.isStadiumSpectator) {
            const cheer = Math.max(0, Math.sin(elapsedSec * 5.2 + n.id * 1.4));
            n.leftArm.rotation.x = -2.0 + cheer * 0.5;
            n.rightArm.rotation.x = -2.0 + cheer * 0.5;
          } else {
            n.leftArm.rotation.x = -0.4;
            n.rightArm.rotation.x = -0.45 + Math.sin(elapsedSec * 2 + n.id) * 0.15;
          }
        }
        continue;
      }

      // Snow Mountain Snowboarders (60 FPS smooth carve)
      if (n.isSnowboarder && n.snowLaneIdx !== undefined) {
        const lane = this.env.snowSlope.lanes[n.snowLaneIdx];
        n.snowZ = (n.snowZ ?? lane.topZ) + (n.snowSpeed ?? 11) * clampedDt;
        if (n.snowZ > lane.bottomZ) n.snowZ = lane.topZ;
        const carveOffset = Math.sin(elapsedSec * 2.2 + n.id) * 2.4;
        n.x = lane.x + carveOffset;
        n.z = n.snowZ;
        n.y = this.env.snowSlope.getHeight(n.x, n.z);
        n.yaw = Math.cos(elapsedSec * 2.2 + n.id) * 0.35;
        n.root.position.set(n.x, n.y, n.z);
        n.root.rotation.set(0.24, n.yaw, -n.yaw * 0.45);
        continue;
      }

      // Animated Circus Jokers hopping & circling at the Festival Park
      if (n.subMode === 'joker' && n.jokerAnchor) {
        const ang = elapsedSec * 1.45 + n.id * 1.3;
        const nextX = n.jokerAnchor.x + Math.cos(ang) * 2.2;
        const nextZ = n.jokerAnchor.z + Math.sin(ang) * 2.2;
        n.yaw = Math.atan2(nextX - n.x, nextZ - n.z);
        n.x = nextX;
        n.z = nextZ;
        n.y = this.env.groundHeightAt(n.x, n.z, 0);
        const hop = Math.abs(Math.sin(elapsedSec * 6.0 + n.id)) * 0.48;
        n.root.position.set(n.x, n.y + hop, n.z);
        n.root.rotation.set(0, n.yaw, Math.sin(elapsedSec * 5 + n.id) * 0.14);
        if (animateLimbs) {
          n.leftArm.rotation.x = -2.2 + Math.sin(elapsedSec * 7.5 + n.id) * 0.7;
          n.rightArm.rotation.x = -2.2 + Math.cos(elapsedSec * 7.5 + n.id) * 0.7;
          n.leftLeg.rotation.x = Math.sin(elapsedSec * 6.0 + n.id) * 0.6;
          n.rightLeg.rotation.x = -Math.sin(elapsedSec * 6.0 + n.id) * 0.6;
        }
        continue;
      }

      // Stadium Footballers chasing & kicking the animated pitch ball
      if (n.subMode === 'football' && this.env.stadiumCoords) {
        const std = this.env.stadiumCoords;
        const ball = std.ballMesh.position;
        const ang = n.id * 1.05 + elapsedSec * 0.65;
        const roleRadius = n.id % 2 === 0 ? 3.5 : 8.5;
        const tx = THREE.MathUtils.clamp(ball.x + Math.cos(ang) * roleRadius, std.cx - 17, std.cx + 17);
        const tz = THREE.MathUtils.clamp(ball.z + Math.sin(ang) * roleRadius, std.cz - 9.5, std.cz + 9.5);
        const dx = tx - n.x;
        const dz = tz - n.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.35) {
          const step = Math.min(d, n.spec.baseSpeed * clampedDt);
          n.x += (dx / d) * step;
          n.z += (dz / d) * step;
          n.yaw = Math.atan2(dx, dz);
          n.walkPhase += clampedDt * 12.0;
        }
        n.y = this.env.groundHeightAt(n.x, n.z, n.y);
        n.root.position.set(n.x, n.y, n.z);
        n.root.rotation.set(0, n.yaw, 0);
        if (animateLimbs) {
          applyGtaWalkKinematics(n, n.walkPhase, 0.72, false);
        }
        continue;
      }

      // General Walking / Dining / Shopping / Hotel / Park NPCs:
      // Heavy pathfinding, signal checks & spatial-grid collisions run at 12 Hz (`runSimTick`),
      // while visual position, yaw damping, and GTA walk animation interpolate smoothly at 60 FPS!
      if (runSimTick) {
        let canRideElevator = false;
        let onStairs = false;

        if (n.activeSeat && n.subMode === 'eat') {
          const dx = n.activeSeat.x - n.x;
          const dz = n.activeSeat.z - n.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.48) {
            n.x = n.activeSeat.x;
            n.z = n.activeSeat.z;
            n.y = n.activeSeat.y;
            n.vx = 0;
            n.vz = 0;
            n.isWalkingNow = false;
            n.seated = true;
            n.targetYaw = Math.atan2(n.activeSeat.lookAtX - n.x, n.activeSeat.lookAtZ - n.z);
            n.yaw = n.targetYaw;
          } else {
            const spd = Math.min(d / simDt, n.spec.baseSpeed);
            n.vx = (dx / d) * spd;
            n.vz = (dz / d) * spd;
            n.x += n.vx * simDt * 0.5;
            n.z += n.vz * simDt * 0.5;
            if (this.colliderGrid) {
              const res = resolveCircleColliders2DGrid(n.x, n.y, n.z, 0.38, 1.7, this.colliderGrid);
              n.x = res.x;
              n.z = res.z;
            }
            n.y = this.env.groundHeightAt(n.x, n.z, n.y);
            n.targetYaw = Math.atan2(dx, dz);
            n.isWalkingNow = true;
          }
        } else {
          const mall = this.env.malls[n.id % this.env.malls.length];
          let destX = n.targetX;
          let destZ = n.targetZ;

          if (n.subMode === 'hospital_doctor' && Math.abs(n.targetY - n.y) > 1.2) {
            const ex = HOSPITAL_ELEVATOR_INFO.x;
            const ez = HOSPITAL_ELEVATOR_INFO.z;
            const dCab = Math.hypot(ex - n.x, ez - n.z);
            if (dCab > 1.4) {
              destX = ex;
              destZ = ez;
            } else {
              canRideElevator = true;
              n.y = THREE.MathUtils.lerp(n.y, n.targetY, Math.min(1, simDt * 3.2));
              if (Math.abs(n.y - n.targetY) < 0.28) {
                n.y = n.targetY;
              }
            }
          } else if (
            mall &&
            (Math.abs(n.targetY - n.y) > 0.6 ||
              Math.hypot(n.targetX - mall.nav.cx, n.targetZ - mall.nav.cz) <= 32 ||
              Math.hypot(n.x - mall.nav.cx, n.z - mall.nav.cz) <= 32)
          ) {
            const wp = computeMallMultiFloorWaypoint(
              n.x,
              n.y,
              n.z,
              n.targetX,
              n.targetY,
              n.targetZ,
              mall.nav,
              mall.elevatorState,
            );
            destX = wp.wx;
            destZ = wp.wz;
            canRideElevator = wp.canRideElevator;
            onStairs = wp.onStairs;
          } else if (this.env.hotelCoords.doorNorth && this.env.hotelCoords.doorSouth && n.y < 1.2) {
            const hWp = computeHotelDoorwayWaypoint(n.x, n.z, destX, destZ, {
              cx: this.env.hotelCoords.cx,
              cz: this.env.hotelCoords.cz,
              halfW: 13.4,
              halfD: 9.4,
              doorNorth: this.env.hotelCoords.doorNorth,
              doorSouth: this.env.hotelCoords.doorSouth,
            });
            destX = hWp.wx;
            destZ = hWp.wz;
          }

          if (n.panicTimer && n.panicTimer > 0) {
            n.panicTimer = Math.max(0, n.panicTimer - simDt);
          }

          const dx = destX - n.x;
          const dz = destZ - n.z;
          const dist = Math.hypot(dx, dz);

          if (canRideElevator && mall) {
            n.y = THREE.MathUtils.lerp(n.y, mall.elevatorState.currentY, Math.min(1, simDt * 6));
          } else {
            n.y = this.env.groundHeightAt(n.x, n.z, n.y);
          }

          const waitingAtSignal =
            dist > 0.55 &&
            (!n.panicTimer || n.panicTimer <= 0) &&
            n.y < 0.85 &&
            !canRideElevator &&
            !onStairs &&
            distSq < 105 * 105 &&
            this.env.intersections.length > 0 &&
            shouldPedestrianWaitAtCrosswalk(n.x, n.z, destX, destZ, this.env.intersections, elapsedSec);

          if (waitingAtSignal) {
            n.seated = false;
            n.stuckTimer = 0;
            n.vx = 0;
            n.vz = 0;
            n.isWalkingNow = false;
            n.targetYaw = Math.atan2(dx, dz);
          } else if (dist > 0.55) {
            n.seated = false;
            const panicMul = n.panicTimer && n.panicTimer > 0 ? 1.75 : 1.0;
            const limpMul = n.limping ? 0.45 : 1.0;
            const stagMul = n.staggerTimer && n.staggerTimer > 0 ? 0.15 : 1.0;
            const spd = Math.min(dist / simDt, n.spec.baseSpeed * panicMul * limpMul * stagMul);
            let dirX = dx / dist;
            let dirZ = dz / dist;
            if (!canRideElevator && !onStairs && this.obstacleBlockers.length > 0 && distSq < 70 * 70) {
              const avoided = computeObstacleAvoidanceDir(n.x, n.z, dirX, dirZ, this.obstacleBlockers);
              dirX = avoided.x;
              dirZ = avoided.z;
            }
            const nextX = THREE.MathUtils.clamp(n.x + dirX * spd * simDt, -1140, 1455);
            const nextZ = THREE.MathUtils.clamp(n.z + dirZ * spd * simDt, -305, 305);
            const probeY = this.env.groundHeightAt(nextX, nextZ, n.y);
            if (probeY > -0.35 || canRideElevator || onStairs) {
              n.vx = dirX * spd;
              n.vz = dirZ * spd;
              if (!canRideElevator && !onStairs && distSq < 72 * 72) {
                const res = resolveCircleColliders2DGrid(n.x, n.y, n.z, 0.38, 1.7, this.colliderGrid);
                n.x = res.x;
                n.z = res.z;
              }
              n.isWalkingNow = true;
            } else {
              n.vx = 0;
              n.vz = 0;
              n.isWalkingNow = false;
              this.assignNextDestination(n, elapsedSec);
            }

            n.targetYaw = Math.atan2(dirX, dirZ);

            if (Math.hypot(n.x - n.lastProgressX, n.z - n.lastProgressZ) < 0.08 * simDt * 10) {
              n.stuckTimer += simDt;
              if (n.stuckTimer > 3.2) {
                n.stuckTimer = 0;
                this.assignNextDestination(n, elapsedSec);
              }
            } else {
              n.stuckTimer = 0;
              n.lastProgressX = n.x;
              n.lastProgressZ = n.z;
            }
          } else {
            n.stuckTimer = 0;
            n.vx = 0;
            n.vz = 0;
            n.isWalkingNow = false;
            n.waitTimer -= simDt;
            if (n.subMode === 'sit') {
              n.seated = true;
            } else if (n.subMode === 'photo' && n.cameraFlashMesh) {
              n.flashTimer += simDt;
              n.cameraFlashMesh.visible = Math.sin(n.flashTimer * 4.5) > 0.92;
            }
            if (n.waitTimer <= 0) {
              if (n.cameraFlashMesh) n.cameraFlashMesh.visible = false;
              n.seated = false;
              this.assignNextDestination(n, elapsedSec);
            }
          }
        }

        // Separate overlapping citizens in 4m spatial buckets (12 Hz)
        if (distSq < 68 * 68 && !n.seated && !n.isFixedSit && !n.isStadiumSpectator) {
          const bKey = (Math.floor(n.x / 4) * 73856093) ^ (Math.floor(n.z / 4) * 19349663);
          let bucket = this.npcPairBuckets.get(bKey);
          if (bucket) {
            for (let b = 0; b < bucket.length; b++) {
              const other = bucket[b];
              if (Math.abs(other.y - n.y) > 1.4) continue;
              const sdx = n.x - other.x;
              const sdz = n.z - other.z;
              const sdSq = sdx * sdx + sdz * sdz;
              if (sdSq < 0.92 * 0.92) {
                const sd = Math.sqrt(sdSq) || 0.01;
                const nx = sdSq > 0.0001 ? sdx / sd : ((n.id % 2 === 0 ? 1 : -1) * 0.707);
                const nz = sdSq > 0.0001 ? sdz / sd : 0.707;
                const push = (0.92 - sd) * 0.45;
                n.x += nx * push - nz * 0.05;
                n.z += nz * push + nx * 0.05;
                other.x -= nx * push;
                other.z -= nz * push;
              }
            }
            bucket.push(n);
          } else {
            this.npcPairBuckets.set(bKey, [n]);
          }
        }
      }

      // 60 FPS Smooth Interpolation & GTA Walking Pose
      if (n.vx !== 0 || n.vz !== 0) {
        const stepX = n.vx * clampedDt;
        const stepZ = n.vz * clampedDt;
        n.x = THREE.MathUtils.clamp(n.x + stepX, -1140, 1455);
        n.z = THREE.MathUtils.clamp(n.z + stepZ, -305, 305);
        n.y = this.env.groundHeightAt(n.x, n.z, n.y);
        n.walkPhase += Math.hypot(stepX, stepZ) * 3.1;
      }
      let dYaw = n.targetYaw - n.yaw;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      n.yaw += dYaw * Math.min(1, clampedDt * 11);

      const isWalkingNow = n.isWalkingNow && !n.seated && n.subMode !== 'exercise';
      if (isWalkingNow && distSq < 26 * 26) {
        const cycle = Math.floor(n.walkPhase / Math.PI);
        if (n.lastStepCycle !== undefined && cycle !== n.lastStepCycle && onNpcFootstep && (!n.staggerTimer || n.staggerTimer <= 0)) {
          onNpcFootstep(Math.sqrt(distSq), n.x, n.z);
        }
        n.lastStepCycle = cycle;
      }
      const strideBob = isWalkingNow ? Math.abs(Math.sin(n.walkPhase)) * 0.048 : 0;
      const stagActive = Boolean(n.staggerTimer && n.staggerTimer > 0);
      const stagK = n.staggerKind ?? 'none';
      const isLegStag = stagActive && (stagK === 'leg_left' || stagK === 'leg_right');
      const stagDip = isLegStag ? -0.22 : stagK === 'abdomen' && stagActive ? -0.12 : 0;
      const limpDip = n.limping && isWalkingNow ? -Math.max(0, Math.sin(n.walkPhase)) * 0.14 : 0;
      n.root.position.set(n.x, (n.seated ? n.y - 0.28 : n.y) + strideBob + stagDip + limpDip, n.z);
      const stagPitch = stagActive
        ? isLegStag
          ? 0.26
          : stagK === 'abdomen'
            ? 0.42
            : stagK === 'back'
              ? 0.34
              : -0.28
        : n.limping
          ? 0.14
          : isWalkingNow
            ? 0.055
            : 0;
      const stagYawTwist =
        stagActive && stagK === 'arm_left' ? 0.36 : stagActive && stagK === 'arm_right' ? -0.36 : 0;
      const hipRoll = n.limping && isWalkingNow
        ? Math.sin(n.walkPhase) * 0.18
        : isWalkingNow
          ? Math.sin(n.walkPhase) * 0.042
          : 0;
      n.root.rotation.set(stagPitch, n.yaw + stagYawTwist, hipRoll);

      if (animateLimbs) {
        if (stagActive) {
          if (stagK === 'leg_left') {
            n.leftLeg.rotation.x = -0.95;
            n.rightLeg.rotation.x = 0.5;
            n.leftArm.rotation.set(-0.95, 0, 0.35);
            n.rightArm.rotation.set(-0.6, 0, -0.35);
          } else if (stagK === 'leg_right') {
            n.leftLeg.rotation.x = 0.5;
            n.rightLeg.rotation.x = -0.95;
            n.leftArm.rotation.set(-0.6, 0, 0.35);
            n.rightArm.rotation.set(-0.95, 0, -0.35);
          } else if (stagK === 'arm_left') {
            n.leftArm.rotation.set(-1.25, 0, 0.65);
            n.rightArm.rotation.set(-0.25, 0, -0.2);
            if (n.headPivot) n.headPivot.rotation.set(0.15, -0.35, 0.22);
          } else if (stagK === 'arm_right') {
            n.leftArm.rotation.set(-0.25, 0, 0.2);
            n.rightArm.rotation.set(-1.25, 0, -0.65);
            if (n.headPivot) n.headPivot.rotation.set(0.15, 0.35, -0.22);
          } else if (stagK === 'abdomen') {
            n.leftArm.rotation.set(-1.35, 0, -0.35);
            n.rightArm.rotation.set(-1.35, 0, 0.35);
            n.leftLeg.rotation.x = -0.35;
            n.rightLeg.rotation.x = 0.22;
            if (n.headPivot) n.headPivot.rotation.set(0.42, 0, 0);
          } else if (stagK === 'back') {
            n.leftArm.rotation.set(0.65, 0, 0.4);
            n.rightArm.rotation.set(0.65, 0, -0.4);
            if (n.headPivot) n.headPivot.rotation.set(-0.32, 0, 0);
          } else {
            n.leftArm.rotation.set(-1.15, 0, -0.35);
            n.rightArm.rotation.set(-1.1, 0, 0.35);
            if (n.headPivot) n.headPivot.rotation.set(-0.26, 0, 0);
          }
        } else {
          n.leftArm.rotation.z = 0;
          n.rightArm.rotation.z = 0;
          if (n.headPivot) n.headPivot.rotation.set(0, 0, 0);
          if (n.seated) {
            n.leftLeg.rotation.x = -1.25;
            n.rightLeg.rotation.x = -1.25;
            if (n.leftKnee) n.leftKnee.rotation.x = 1.25;
            if (n.rightKnee) n.rightKnee.rotation.x = 1.25;
            n.leftArm.rotation.x = -0.5 + Math.sin(elapsedSec * 3.5 + n.id) * 0.22;
            n.rightArm.rotation.x = -0.65 + Math.cos(elapsedSec * 4.2 + n.id) * 0.28;
            if (n.leftElbow) n.leftElbow.rotation.x = -0.45;
            if (n.rightElbow) n.rightElbow.rotation.x = -0.45;
          } else if (n.subMode === 'exercise') {
            const jump = Math.abs(Math.sin(elapsedSec * 5.0 + n.id)) * 0.45;
            n.root.position.y = n.y + jump;
            n.leftArm.rotation.x = -2.4 + Math.sin(elapsedSec * 5.0 + n.id) * 0.6;
            n.rightArm.rotation.x = -2.4 + Math.sin(elapsedSec * 5.0 + n.id) * 0.6;
          } else if (n.subMode === 'play') {
            const hop = Math.abs(Math.sin(elapsedSec * 6.5 + n.id)) * 0.28;
            n.root.position.y = n.y + hop;
            applyGtaWalkKinematics(n, n.walkPhase, 0.68, false);
          } else if (isWalkingNow) {
            applyGtaWalkKinematics(n, n.walkPhase, 0.64, Boolean(n.limping));
          } else {
            n.leftLeg.rotation.x = 0;
            n.rightLeg.rotation.x = 0;
            if (n.leftKnee) n.leftKnee.rotation.x = 0.04;
            if (n.rightKnee) n.rightKnee.rotation.x = 0.04;
            n.leftArm.rotation.x = n.subMode === 'water' ? -0.9 : 0;
            n.rightArm.rotation.x = n.subMode === 'water' ? -1.1 + Math.sin(elapsedSec * 4) * 0.2 : 0;
            if (n.leftElbow) n.leftElbow.rotation.x = -0.15;
            if (n.rightElbow) n.rightElbow.rotation.x = -0.15;
          }
        }
      }
    }

    // 4. Step 5-Member Cigarette + Gun Gangs
    for (let sIdx = 0; sIdx < this.gangSquads.length; sIdx++) {
      const sq = this.gangSquads[sIdx];
      if (sq.hostile && sq.alertTimer > 0) {
        sq.alertTimer -= clampedDt;
        if (sq.alertTimer <= 0 && Math.hypot(pPos.x - sq.anchorX, pPos.z - sq.anchorZ) > 55) {
          sq.hostile = false;
        }
      }
    }

    for (let i = 0; i < this.gangVisuals.length; i++) {
      const gv = this.gangVisuals[i];
      const m = gv.state;
      const sq = this.gangSquads[gv.squadIdx];

      if (gv.hitFlashTimer > 0) {
        gv.hitFlashTimer = Math.max(0, gv.hitFlashTimer - clampedDt);
        gv.shirtMat.emissive.setHex(gv.hitFlashTimer > 0 ? 0xb91c1c : 0x000000);
      }

      if (m.dead) {
        if (gv.decapitated && gv.bloodEmitTimer && gv.bloodEmitTimer > 0) {
          gv.bloodEmitTimer = Math.max(0, gv.bloodEmitTimer - clampedDt);
          if (this.frameTick % 2 === 0) {
            this.spawnNeckBloodJet(m.x, m.y + 1.38, m.z, 2);
          }
        }
        if (gv.fallTimer > 0) {
          gv.fallTimer = Math.max(0, gv.fallTimer - clampedDt);
          animateHumanoidCollapse(
            gv.root,
            gv,
            m.x,
            m.y,
            m.z,
            m.yaw,
            gv.deathStyle ?? 'default',
            gv.fallTimer,
            gv.deathDuration ?? 3.2,
            gv.hitDirX ?? 0,
            gv.hitDirZ ?? 1,
            clampedDt,
            this.env.colliders,
            this.env.groundHeightAt,
            this.colliderGrid,
          );
          gv.cigSmokeMesh.visible = false;
          if (gv.fallTimer <= 0) {
            gv.root.visible = false;
          }
        }
        m.respawnTimer -= clampedDt;
        if (m.respawnTimer <= 0) {
          m.dead = false;
          gv.decapitated = false;
          gv.bloodEmitTimer = 0;
          m.hp = m.maxHp;
          gv.limping = false;
          gv.staggerTimer = 0;
          if (gv.headPivot) {
            gv.headPivot.visible = true;
            gv.headPivot.rotation.set(0, 0, 0);
          }
          if (gv.neckStump) gv.neckStump.visible = false;
          gv.leftArm.rotation.set(0, 0, 0);
          gv.rightArm.rotation.set(0, 0, 0);
          gv.leftLeg.rotation.set(0, 0, 0);
          gv.rightLeg.rotation.set(0, 0, 0);
          m.x = m.homeX;
          m.z = m.homeZ;
          m.y = this.env.groundHeightAt(m.x, m.z, 0);
          gv.root.visible = true;
          gv.root.rotation.set(0, m.yaw, 0);
          gv.cigSmokeMesh.visible = true;
        }
        continue;
      }

      if (gv.staggerTimer && gv.staggerTimer > 0) {
        gv.staggerTimer = Math.max(0, gv.staggerTimer - clampedDt);
      }

      m.fireCooldown = Math.max(0, m.fireCooldown - clampedDt);
      const decision = stepGangMemberDecision(m, sq, pPos.x, pPos.z);
      m.yaw = decision.aimYaw;

      if (decision.moveDirX !== 0 || decision.moveDirZ !== 0) {
        const baseSpd = decision.mode === 'smoke_idle' ? 1.8 : 3.5;
        const spd = baseSpd * (gv.limping ? 0.52 : 1.0) * (gv.staggerTimer && gv.staggerTimer > 0 ? 0.2 : 1.0);
        m.x += decision.moveDirX * spd * clampedDt;
        m.z += decision.moveDirZ * spd * clampedDt;
        const res = resolveCircleColliders2DGrid(m.x, m.y, m.z, 0.42, 1.75, this.colliderGrid);
        m.x = res.x;
        m.z = res.z;
        gv.walkPhase += clampedDt * spd * 3.8;
      }
      m.y = this.env.groundHeightAt(m.x, m.z, m.y);
      gv.root.position.set(m.x, m.y, m.z);
      gv.root.rotation.set(gv.staggerTimer && gv.staggerTimer > 0 ? -0.18 : 0, m.yaw, 0);

      const dSq = _camCheckPos.set(m.x, m.y, m.z).distanceToSquared(cameraPos);
      if (dSq < 90 * 90) {
        if (decision.mode === 'smoke_idle') {
          gv.leftLeg.rotation.x = 0;
          gv.rightLeg.rotation.x = 0;
          const puffDrag = Math.max(0, Math.sin(elapsedSec * 1.4 + m.id));
          gv.leftArm.rotation.x = -0.65 - puffDrag * 0.55;
          gv.rightArm.rotation.x = -0.15;
          gv.cigSmokeMesh.visible = true;
          const smokeCycle = ((elapsedSec * 0.9 + m.id * 0.4) % 1 + 1) % 1;
          gv.cigSmokeMesh.position.set(
            -0.28 + Math.sin(smokeCycle * 6) * 0.08,
            1.44 + smokeCycle * 0.72,
            0.28 + smokeCycle * 0.14,
          );
          const ss = 0.32 + smokeCycle * 0.65;
          gv.cigSmokeMesh.scale.setScalar(ss);
        } else {
          gv.cigSmokeMesh.visible = false;
          const swing = Math.sin(gv.walkPhase) * 0.6;
          gv.leftLeg.rotation.x = swing;
          gv.rightLeg.rotation.x = -swing;
          gv.leftArm.rotation.x = -0.35;
          gv.rightArm.rotation.x = -1.42; // Aiming gun horizontally toward player!
        }
      } else {
        gv.cigSmokeMesh.visible = false;
      }

      if (decision.shouldShoot && Math.hypot(pPos.x - m.x, pPos.z - m.z) < 48) {
        m.fireCooldown = 0.72 + (m.id % 3) * 0.22;
        const jx = (Math.random() - 0.5) * 0.75;
        const jy = (Math.random() - 0.5) * 0.45;
        const jz = (Math.random() - 0.5) * 0.75;
        firedShots.push({
          fromX: m.x + Math.sin(m.yaw) * 0.5,
          fromY: m.y + 1.32,
          fromZ: m.z + Math.cos(m.yaw) * 0.5,
          toX: pPos.x + jx,
          toY: pPos.y + 1.18 + jy,
          toZ: pPos.z + jz,
          damage: 7,
        });
      }
    }

    // 4a-extra. Step Royal Glass & Gold Carriage (King & Queen Inside!) + 8 Flanking Escort Guards
    if (this.royalCarriage) {
      const rc = this.royalCarriage;
      if (rc.waitTimer > 0) {
        rc.waitTimer = Math.max(0, rc.waitTimer - clampedDt);
      } else {
        const wp = rc.route[rc.routeIdx % rc.route.length];
        const dx = wp.x - rc.x;
        const dz = wp.z - rc.z;
        const d = Math.hypot(dx, dz);
        const spd = 4.2;
        if (d < 0.9) {
          if (wp.pauseSec) rc.waitTimer = wp.pauseSec;
          rc.routeIdx = (rc.routeIdx + 1) % rc.route.length;
        } else {
          const step = Math.min(d, spd * clampedDt);
          rc.x += (dx / d) * step;
          rc.z += (dz / d) * step;
          rc.yaw = Math.atan2(dx, dz);
          rc.trotPhase += step * 2.8;
          for (let w = 0; w < rc.wheels.length; w++) rc.wheels[w].rotation.x += step * 1.4;
        }
      }
      rc.y = this.env.groundHeightAt(rc.x, rc.z, rc.y);
      rc.root.position.set(rc.x, rc.y, rc.z);
      rc.root.rotation.set(0, rc.yaw, 0);
      const rcVisSq = _camCheckPos.set(rc.x, rc.y, rc.z).distanceToSquared(cameraPos);
      rc.root.visible = rcVisSq < 190 * 190;
      if (rc.root.visible) {
        const hSwing = rc.waitTimer > 0 ? 0 : Math.sin(rc.trotPhase) * 0.5;
        for (let hi = 0; hi < rc.horses.length; hi++) {
          const h = rc.horses[hi];
          h.legs[0].rotation.x = hSwing;
          h.legs[3].rotation.x = hSwing;
          h.legs[1].rotation.x = -hSwing;
          h.legs[2].rotation.x = -hSwing;
          h.tail.rotation.z = Math.sin(elapsedSec * 4.5 + hi) * 0.18;
        }
      }
    }

    // 4b. Step Royal Castle Foot Guards, Cavalry & Carriage Escort Guards
    for (let i = 0; i < this.royalGuards.length; i++) {
      const rg = this.royalGuards[i];
      if (rg.hitFlashTimer > 0) {
        rg.hitFlashTimer = Math.max(0, rg.hitFlashTimer - clampedDt);
        rg.tunicMat.emissive.setHex(rg.hitFlashTimer > 0 ? 0x991b1b : 0x000000);
      }
      if (rg.dead) {
        if (rg.fallTimer > 0) {
          rg.fallTimer = Math.max(0, rg.fallTimer - clampedDt);
          rg.root.rotation.x = THREE.MathUtils.lerp(rg.root.rotation.x, Math.PI * 0.5, Math.min(1, clampedDt * 8));
          if (rg.fallTimer <= 0) rg.root.visible = false;
        }
        rg.respawnTimer -= clampedDt;
        if (rg.respawnTimer <= 0) {
          rg.dead = false;
          rg.hostile = false;
          rg.hp = rg.maxHp;
          rg.x = rg.homeX;
          rg.z = rg.homeZ;
          rg.y = this.env.groundHeightAt(rg.x, rg.z, 0);
          rg.root.visible = true;
          rg.root.rotation.set(0, rg.yaw, 0);
        }
        continue;
      }

      if (rg.hostile) {
        rg.alertTimer -= clampedDt;
        if (rg.alertTimer <= 0 && Math.hypot(pPos.x - rg.x, pPos.z - rg.z) > 65) {
          rg.hostile = false;
        }
      }
      rg.fireCooldown = Math.max(0, rg.fireCooldown - clampedDt);

      const dToPlayer = Math.hypot(pPos.x - rg.x, pPos.z - rg.z);
      let moveDx = 0;
      let moveDz = 0;
      let moveDist = 0;

      if (rg.hostile && dToPlayer < 52) {
        rg.yaw = Math.atan2(pPos.x - rg.x, pPos.z - rg.z);
        if (dToPlayer > 14) {
          const spd = rg.isMounted ? 7.2 : 3.6;
          moveDist = spd * clampedDt;
          moveDx = (pPos.x - rg.x) / dToPlayer;
          moveDz = (pPos.z - rg.z) / dToPlayer;
        }
        if (rg.fireCooldown <= 0 && dToPlayer < 45) {
          rg.fireCooldown = 0.85 + (i % 3) * 0.2;
          firedShots.push({
            fromX: rg.x + Math.sin(rg.yaw) * 0.6,
            fromY: rg.y + (rg.isMounted ? 2.45 : 1.35),
            fromZ: rg.z + Math.cos(rg.yaw) * 0.6,
            toX: pPos.x + (Math.random() - 0.5) * 0.7,
            toY: pPos.y + 1.15,
            toZ: pPos.z + (Math.random() - 0.5) * 0.7,
            damage: 8,
          });
        }
      } else if (rg.escortOffset && this.royalCarriage) {
        const rc = this.royalCarriage;
        const sinY = Math.sin(rc.yaw);
        const cosY = Math.cos(rc.yaw);
        const tx = rc.x + sinY * rg.escortOffset.fwd + cosY * rg.escortOffset.side;
        const tz = rc.z + cosY * rg.escortOffset.fwd - sinY * rg.escortOffset.side;
        const dx = tx - rg.x;
        const dz = tz - rg.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.25) {
          moveDist = Math.min(d, (rc.waitTimer > 0 ? 2.5 : 5.8) * clampedDt);
          moveDx = dx / d;
          moveDz = dz / d;
          rg.yaw = d > 1.8 ? Math.atan2(moveDx, moveDz) : rc.yaw;
        } else {
          rg.yaw = rc.yaw;
        }
      } else if (rg.waypoints.length > 0) {
        const wp = rg.waypoints[rg.wpIdx % rg.waypoints.length];
        const dx = wp.x - rg.x;
        const dz = wp.z - rg.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.1) {
          rg.wpIdx = (rg.wpIdx + 1) % rg.waypoints.length;
        } else {
          const spd = rg.isMounted ? 4.4 : 1.75;
          moveDist = Math.min(d, spd * clampedDt);
          moveDx = dx / d;
          moveDz = dz / d;
          rg.yaw = Math.atan2(moveDx, moveDz);
        }
      }

      if (moveDist > 0) {
        const nx = rg.x + moveDx * moveDist;
        const nz = rg.z + moveDz * moveDist;
        const gyProbe = this.env.groundHeightAt(nx, nz, rg.y);
        if (gyProbe > -0.35) {
          rg.x = nx;
          rg.z = nz;
        } else if (!rg.hostile && rg.waypoints.length > 0) {
          rg.wpIdx = (rg.wpIdx + 1) % rg.waypoints.length;
        }
        if (!rg.escortOffset) {
          const res = resolveCircleColliders2DGrid(rg.x, rg.y, rg.z, rg.isMounted ? 0.65 : 0.4, 1.8, this.colliderGrid);
          rg.x = res.x;
          rg.z = res.z;
        }
        rg.walkPhase += moveDist * (rg.isMounted ? 2.6 : 3.2);
      }

      rg.y = this.env.groundHeightAt(rg.x, rg.z, rg.y);
      rg.root.position.set(rg.x, rg.y, rg.z);
      rg.root.rotation.set(0, rg.yaw, 0);

      const gDistSq = _camCheckPos.set(rg.x, rg.y, rg.z).distanceToSquared(cameraPos);
      if (gDistSq < 110 * 110) {
        const swing = moveDist > 0.005 ? Math.sin(rg.walkPhase) * (rg.isMounted ? 0.55 : 0.45) : 0;
        if (rg.isMounted && rg.horseLegs) {
          rg.horseLegs[0].rotation.x = swing;
          rg.horseLegs[3].rotation.x = swing;
          rg.horseLegs[1].rotation.x = -swing;
          rg.horseLegs[2].rotation.x = -swing;
          if (rg.horseTail) {
            rg.horseTail.rotation.z = Math.sin(elapsedSec * 4.5 + i) * 0.2;
          }
          rg.riderRightArm.rotation.x = rg.hostile ? -1.35 : -0.35;
          rg.riderLeftArm.rotation.x = -0.55;
        } else if (rg.riderLeftLeg && rg.riderRightLeg) {
          rg.riderLeftLeg.rotation.x = swing;
          rg.riderRightLeg.rotation.x = -swing;
          rg.riderLeftArm.rotation.x = -swing * 0.5;
          rg.riderRightArm.rotation.x = rg.hostile ? -1.4 : -0.45;
        }
      }
    }

    // 4c. Step 7-Vehicle Roaming BOSS Convoy (2 Parallel Police Bikes -> 2 Black SUVs -> Boss Black Toyota Hilux Pickup w/ 2 Rear AK-47 Guards -> 2 Black SUVs)
    if (this.convoyVehicles.length > 0 && this.convoyPathSegs.length > 0) {
      if (this.convoyHostile) {
        this.convoyAlertTimer = Math.max(0, this.convoyAlertTimer - clampedDt);
        if (this.convoyAlertTimer <= 0) {
          this.convoyHostile = false;
        }
      }
      const bossHilux = this.convoyVehicles[4];
      const distBossToPlayer = bossHilux ? Math.hypot(bossHilux.x - pPos.x, bossHilux.z - pPos.z) : 999;
      if (this.convoyRespawnTimer > 0) {
        this.convoyRespawnTimer = Math.max(0, this.convoyRespawnTimer - clampedDt);
        if (this.convoyRespawnTimer <= 0) {
          this.convoyHostile = false;
          this.convoyVehicles.forEach((cv) => {
            cv.destroyed = false;
            cv.hp = cv.maxHp;
            cv.root.rotation.z = 0;
          });
          this.convoyGuards.forEach((cg) => {
            cg.dead = false;
            cg.hp = cg.maxHp;
            cg.limping = false;
            cg.staggerTimer = 0;
            cg.root.visible = cg.role !== 'suv_guard';
            cg.root.rotation.set(0, 0, 0);
          });
        }
      }
      const convoySpd = this.convoyHostile
        ? distBossToPlayer < 26
          ? 0
          : 4.2
        : 12.6;
      this.convoyProgressDist = (this.convoyProgressDist + convoySpd * clampedDt) % this.convoyTotalLen;

      const sampleConvoyAt = (targetDist: number): { x: number; z: number; yaw: number; sinY: number; cosY: number } => {
        const d = ((targetDist % this.convoyTotalLen) + this.convoyTotalLen) % this.convoyTotalLen;
        let seg = this.convoyPathSegs[0];
        for (let s = 0; s < this.convoyPathSegs.length; s++) {
          const cur = this.convoyPathSegs[s];
          if (d >= cur.cumLen && d <= cur.cumLen + cur.len) {
            seg = cur;
            break;
          }
        }
        const t = seg.len > 0.01 ? (d - seg.cumLen) / seg.len : 0;
        const dirX = seg.len > 0.01 ? seg.dx / seg.len : 0;
        const dirZ = seg.len > 0.01 ? seg.dz / seg.len : 1;
        return {
          x: seg.x0 + seg.dx * t,
          z: seg.z0 + seg.dz * t,
          yaw: Math.atan2(dirX, dirZ),
          sinY: dirX,
          cosY: dirZ,
        };
      };

      for (let i = 0; i < this.convoyVehicles.length; i++) {
        const cv = this.convoyVehicles[i];
        if (cv.destroyed) continue;
        const pt = sampleConvoyAt(this.convoyProgressDist + cv.leadOffset);
        cv.x = pt.x + pt.cosY * cv.lateralOffset;
        cv.z = pt.z - pt.sinY * cv.lateralOffset;
        cv.yaw = pt.yaw;
        cv.y = this.env.groundHeightAt(cv.x, cv.z, cv.y);
        cv.root.position.set(cv.x, cv.y, cv.z);
        cv.root.rotation.set(0, cv.yaw, 0);
        const visSq = _camCheckPos.set(cv.x, cv.y, cv.z).distanceToSquared(cameraPos);
        cv.root.visible = visSq < 210 * 210;
        for (let w = 0; w < cv.wheels.length; w++) {
          cv.wheels[w].rotation.x += convoySpd * clampedDt * 1.5;
        }
        if (cv.lightBarMeshes) {
          const flash = (Math.floor(elapsedSec * 9) + i) % 2 === 0;
          const mA = cv.lightBarMeshes[0].material;
          const mB = cv.lightBarMeshes[1].material;
          if (mA instanceof THREE.MeshBasicMaterial) mA.color.setHex(flash ? 0xff2222 : 0x3b0d0d);
          if (mB instanceof THREE.MeshBasicMaterial) mB.color.setHex(flash ? 0x0f2557 : 0x38bdf8);
        }
      }

      // Step Convoy Police Bikers, Pickup-Bed AK47 Guards & Deployed SUV Guards
      for (let i = 0; i < this.convoyGuards.length; i++) {
        const cg = this.convoyGuards[i];
        const veh = this.convoyVehicles[cg.vehicleIdx];
        if (cg.hitFlashTimer > 0) {
          cg.hitFlashTimer = Math.max(0, cg.hitFlashTimer - clampedDt);
          cg.shirtMat.emissive.setHex(cg.hitFlashTimer > 0 ? 0x991b1b : 0x000000);
        }
        if (cg.dead) {
          if (cg.fallTimer > 0) {
            cg.fallTimer = Math.max(0, cg.fallTimer - clampedDt);
            if (cg.role === 'suv_guard') {
              animateHumanoidCollapse(
                cg.root,
                cg,
                cg.x,
                cg.y,
                cg.z,
                cg.yaw,
                cg.deathStyle ?? 'default',
                cg.fallTimer,
                cg.deathDuration,
                cg.hitDirX ?? 0,
                cg.hitDirZ ?? 1,
                clampedDt,
                this.env.colliders,
                this.env.groundHeightAt,
                this.colliderGrid,
              );
            } else {
              cg.root.rotation.x = THREE.MathUtils.lerp(cg.root.rotation.x, Math.PI * 0.48, Math.min(1, clampedDt * 10));
            }
            if (cg.fallTimer <= 0) cg.root.visible = false;
          }
          continue;
        }
        if (cg.staggerTimer && cg.staggerTimer > 0) {
          cg.staggerTimer = Math.max(0, cg.staggerTimer - clampedDt);
        }

        if (cg.role === 'suv_guard') {
          if (!this.convoyHostile || !veh || veh.destroyed) {
            cg.root.visible = false;
            continue;
          }
          if (!cg.root.visible) {
            const cosY = Math.cos(veh.yaw);
            const sinY = Math.sin(veh.yaw);
            cg.x = veh.x + cosY * cg.localOffsetX;
            cg.z = veh.z - sinY * cg.localOffsetX;
            cg.y = this.env.groundHeightAt(cg.x, cg.z, veh.y);
            cg.root.visible = true;
          }
          const dx = pPos.x - cg.x;
          const dz = pPos.z - cg.z;
          const d = Math.hypot(dx, dz);
          cg.yaw = Math.atan2(dx, dz);
          if (d > 14 && d < 75) {
            const spd = 4.0 * (cg.limping ? 0.5 : 1) * (cg.staggerTimer && cg.staggerTimer > 0 ? 0.2 : 1);
            cg.x += (dx / d) * spd * clampedDt;
            cg.z += (dz / d) * spd * clampedDt;
            cg.walkPhase += spd * clampedDt * 3.2;
          }
          cg.y = this.env.groundHeightAt(cg.x, cg.z, cg.y);
          cg.root.position.set(cg.x, cg.y, cg.z);
          cg.root.rotation.set(0, cg.yaw, 0);
          const swing = d > 14 ? Math.sin(cg.walkPhase) * 0.55 : 0;
          cg.leftLeg.rotation.x = swing;
          cg.rightLeg.rotation.x = -swing;
          cg.leftArm.rotation.x = -1.25;
          cg.rightArm.rotation.x = -1.48;
        } else if (veh) {
          // Pickup Bed AK-47 Guards & Police Bikers stay synced in world coords
          const sinY = Math.sin(veh.yaw);
          const cosY = Math.cos(veh.yaw);
          cg.x = veh.x + sinY * cg.localOffsetZ + cosY * cg.localOffsetX;
          cg.z = veh.z + cosY * cg.localOffsetZ - sinY * cg.localOffsetX;
          cg.y = veh.y + cg.localOffsetY;
          if (this.convoyHostile) {
            const aimWorld = Math.atan2(pPos.x - cg.x, pPos.z - cg.z);
            cg.yaw = aimWorld;
            cg.root.rotation.set(0, aimWorld - veh.yaw, 0);
            cg.rightArm.rotation.x = -1.48;
            cg.leftArm.rotation.x = -1.32;
          } else {
            cg.yaw = veh.yaw;
            cg.root.rotation.set(0, 0, 0);
            cg.rightArm.rotation.x = cg.role === 'police_biker' ? -1.15 : -1.28;
            cg.leftArm.rotation.x = -1.05;
          }
        }

        // Fire Heavy AK-47 Rifle Bursts When Convoy Is Provoked!
        cg.fireCooldown = Math.max(0, cg.fireCooldown - clampedDt);
        if (this.convoyHostile && cg.fireCooldown <= 0) {
          const distP = Math.hypot(pPos.x - cg.x, pPos.z - cg.z);
          if (distP < 65) {
            cg.fireCooldown = 0.34 + (i % 3) * 0.11;
            firedShots.push({
              fromX: cg.x + Math.sin(cg.yaw) * 0.55,
              fromY: cg.y + 1.34,
              fromZ: cg.z + Math.cos(cg.yaw) * 0.55,
              toX: pPos.x + (Math.random() - 0.5) * 0.85,
              toY: pPos.y + 1.18 + (Math.random() - 0.5) * 0.45,
              toZ: pPos.z + (Math.random() - 0.5) * 0.85,
              damage: 11,
              kind: 'convoy_ak47',
            });
          }
        }
      }
    }

    // 5. Step Modern & East Island Ambient AI Road Vehicles (Spatial-Bucket Collision & Headway Braking + Frustum Culling + Steering Wheels)
    // Build spatial bucket grid for NPC vehicle-to-vehicle, convoy, and player vehicle spacing/collision!
    this.vehicleBuckets.clear();
    const registerVehBucket = (x: number, z: number, yaw: number, r: number, speed: number, agentIdx: number) => {
      const bx = Math.floor(x / 16);
      const bz = Math.floor(z / 16);
      const key = (bx * 73856093) ^ (bz * 19349663);
      let arr = this.vehicleBuckets.get(key);
      if (!arr) {
        arr = [];
        this.vehicleBuckets.set(key, arr);
      }
      arr.push({ x, z, yaw, r, speed, agentIdx });
    };
    for (let i = 0; i < this.roadAgents.length; i++) {
      const va = this.roadAgents[i];
      if (!va.destroyed && va.root.visible) {
        registerVehBucket(va.x, va.z, va.yaw, Math.max(va.colW, va.colD) * 0.45, va.speed, i);
      }
    }
    for (let c = 0; c < this.convoyVehicles.length; c++) {
      const cv = this.convoyVehicles[c];
      if (!cv.destroyed) {
        registerVehBucket(cv.x, cv.z, cv.yaw, 2.5, 10, -100 - c);
      }
    }
    if (playerVehicleCollider) {
      registerVehBucket(
        playerVehicleCollider.x,
        playerVehicleCollider.z,
        playerVehicleCollider.yaw,
        playerVehicleCollider.radius,
        0,
        -1,
      );
    }

    const maxVehVisSq = this.isSoftwareGl ? 175 * 175 : 230 * 230;
    const laneOffset = 3.4;
    for (let i = 0; i < this.roadAgents.length; i++) {
      const v = this.roadAgents[i];
      v.hornCooldown = Math.max(0, v.hornCooldown - clampedDt);
      if (v.crashCooldown && v.crashCooldown > 0) {
        v.crashCooldown = Math.max(0, v.crashCooldown - clampedDt);
      }
      if (v.crashStallTimer && v.crashStallTimer > 0) {
        v.crashStallTimer = Math.max(0, v.crashStallTimer - clampedDt);
        if (v.crashSpinVel) {
          v.yaw += v.crashSpinVel * clampedDt;
          v.crashSpinVel *= Math.max(0, 1 - 4.5 * clampedDt);
        }
      }

      if (v.hitFlashTimer > 0) {
        v.hitFlashTimer = Math.max(0, v.hitFlashTimer - clampedDt);
      }

      if (v.destroyed) {
        if (v.hideTimer > 0) {
          v.hideTimer -= clampedDt;
          if (v.hideTimer <= 0) v.root.visible = false;
        }
        v.respawnTimer -= clampedDt;
        if (v.respawnTimer <= 0) {
          v.destroyed = false;
          v.hp = v.maxHp;
          v.maxSpeed = v.baseMaxSpeed;
          v.x = v.spawnX;
          v.z = v.spawnZ;
          v.edge = v.spawnEdge;
          v.policeMode = undefined;
          v.officersDeployed = false;
          v.crashCooldown = 0;
          v.crashStallTimer = 0;
          v.crashSpinVel = 0;
          v.refuel.stage = 'cruise';
          v.refuel.fuelLevel = 80;
          v.root.visible = true;
          v.root.rotation.set(0, v.yaw, 0);
          v.puncturedCount = 0;
          for (let wi = 0; wi < v.puncturedWheels.length; wi++) {
            v.puncturedWheels[wi] = false;
            const w = v.wheels[wi];
            const rad = v.wheelRadii[wi] ?? 0.38;
            w.position.y = v.wheelBaseY[wi] ?? rad;
            w.scale.set(rad, w.scale.y, rad);
            w.rotation.x = 0;
          }
          for (let gi = 0; gi < v.glassPanes.length; gi++) {
            const gp = v.glassPanes[gi];
            gp.state = 'intact';
            gp.mesh.visible = true;
            if (!this.shootableMeshes.includes(gp.mesh)) {
              this.shootableMeshes.push(gp.mesh);
            }
          }
          v.originalMats.forEach((mat, mesh) => {
            mesh.material = mat;
          });
        }
        continue;
      }

      // Check spatial buckets for headway braking, vehicle-to-vehicle overlap separation & crash impacts!
      let blockedByVehicle = Boolean(v.crashStallTimer && v.crashStallTimer > 0);
      let headwaySpeedCap = v.crashStallTimer && v.crashStallTimer > 0 ? 0 : v.maxSpeed;
      const vRadius = Math.max(v.colW, v.colD) * 0.44;
      const vSinY = Math.sin(v.yaw);
      const vCosY = Math.cos(v.yaw);
      const bx0 = Math.floor(v.x / 16);
      const bz0 = Math.floor(v.z / 16);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const bList = this.vehicleBuckets.get(((bx0 + ox) * 73856093) ^ ((bz0 + oz) * 19349663));
          if (!bList) continue;
          for (let bi = 0; bi < bList.length; bi++) {
            const ov = bList[bi];
            if (ov.agentIdx === i) continue;
            const dx = ov.x - v.x;
            const dz = ov.z - v.z;
            const dSq = dx * dx + dz * dz;
            if (dSq > 14 * 14) continue;
            const minSep = vRadius + ov.r;
            if (dSq < minSep * minSep) {
              const d = Math.sqrt(dSq) || 0.01;
              const push = (minSep - d) * 0.48;
              const nx = dx / d;
              const nz = dz / d;
              const preImpactSpeed = Math.abs(v.speed);
              v.x -= nx * push;
              v.z -= nz * push;
              v.speed *= 0.28;
              blockedByVehicle = true;
              headwaySpeedCap = 0;

              if ((v.crashCooldown ?? 0) <= 0 && preImpactSpeed > 5.5) {
                v.crashCooldown = 1.65;
                v.crashStallTimer = preImpactSpeed > 10.5 ? 1.45 : 0.72;
                v.crashSpinVel = (i % 2 === 0 ? 1 : -1) * Math.min(3.2, preImpactSpeed * 0.22);
                const gyHit = this.env.groundHeightAt(v.x, v.z, 0);
                const severity = Math.min(1, preImpactSpeed / 16);
                if (onVehicleCrash) {
                  onVehicleCrash(v.x + nx * vRadius * 0.65, gyHit + 0.72, v.z + nz * vRadius * 0.65, severity);
                }
                if (onCarHorn && v.kind !== 'bicycle' && this.globalHornCooldown <= 0) {
                  const distP = Math.hypot(v.x - pPos.x, v.z - pPos.z);
                  if (distP < 55) {
                    onCarHorn(distP);
                    this.globalHornCooldown = 1.2;
                  }
                }
                const isBikeKind =
                  v.kind === 'motorcycle' ||
                  v.kind === 'sport_moto' ||
                  v.kind === 'city_scooter' ||
                  v.kind === 'bicycle';
                if (preImpactSpeed > 9.8 && this.ejectedDrivers.length < 16 && (isBikeKind || preImpactSpeed > 13.5)) {
                  const driverSpec = NPC_ROLE_CATALOG[0];
                  const ejectBuilt = buildNpcMesh(
                    97000 + v.id,
                    {
                      ...driverSpec,
                      shirtHex: v.kind === 'police' ? 0x1e3a8a : 0x334155,
                      pantsHex: 0x0f172a,
                      propKind: 'none',
                    },
                    this.sharedGeo,
                    {},
                    [],
                  );
                  this.materials.push(...ejectBuilt.mats);
                  const ejX = v.x + nx * 1.1;
                  const ejZ = v.z + nz * 1.1;
                  ejectBuilt.root.position.set(ejX, gyHit + 0.75, ejZ);
                  ejectBuilt.root.rotation.order = 'YXZ';
                  this.root.add(ejectBuilt.root);
                  this.ejectedDrivers.push({
                    id: 97000 + v.id,
                    root: ejectBuilt.root,
                    shirtMat: ejectBuilt.shirtMat,
                    leftLeg: ejectBuilt.leftLeg,
                    rightLeg: ejectBuilt.rightLeg,
                    leftArm: ejectBuilt.leftArm,
                    rightArm: ejectBuilt.rightArm,
                    x: ejX,
                    y: gyHit + 0.75,
                    z: ejZ,
                    yaw: v.yaw,
                    vx: vSinY * Math.min(8.5, preImpactSpeed * 0.55) + nx * 2.2,
                    vy: isBikeKind ? 4.4 : 2.8,
                    vz: vCosY * Math.min(8.5, preImpactSpeed * 0.55) + nz * 2.2,
                    rollAngle: 0,
                    stunTimer: 1.75,
                    fleeTimer: 4.5,
                    walkPhase: 0,
                  });
                }
              }
            }
            const fwdDot = vSinY * dx + vCosY * dz;
            const sideDist = Math.abs(vCosY * dx - vSinY * dz);
            if (fwdDot > 0.4 && fwdDot < 9.8 && sideDist < 2.15) {
              blockedByVehicle = true;
              headwaySpeedCap = Math.min(headwaySpeedCap, fwdDot < 5.6 ? 0 : Math.max(0, ov.speed * 0.85));
            }
          }
        }
      }

      const isPoliceActive =
        v.kind === 'police' && (v.policeMode === 'responding' || v.policeMode === 'engaged');
      if (isPoliceActive) {
        const distToPlayer = Math.hypot(v.x - pPos.x, v.z - pPos.z);
        v.policeAlertTimer = Math.max(0, (v.policeAlertTimer ?? 0) - clampedDt);
        v.sirenPulseTimer = Math.max(0, (v.sirenPulseTimer ?? 0) - clampedDt);
        if (onPoliceSiren && v.sirenPulseTimer <= 0 && distToPlayer < 130) {
          onPoliceSiren(distToPlayer);
          v.sirenPulseTimer = 2.5;
        }

        if (v.policeMode === 'responding') {
          if (distToPlayer < 95) {
            v.policeTargetX = pPos.x;
            v.policeTargetZ = pPos.z;
          }
          const tx = v.policeTargetX ?? pPos.x;
          const tz = v.policeTargetZ ?? pPos.z;
          const dx = tx - v.x;
          const dz = tz - v.z;
          const d = Math.hypot(dx, dz);
          if (d <= 14.5 || distToPlayer <= 15.5) {
            v.policeMode = 'engaged';
            v.speed = 0;
            if (!v.officersDeployed) {
              this.deployPoliceOfficersFromCar(v);
            }
          } else {
            const chaseTopSpd = Math.max(6.5, 16.5 * (1 - v.puncturedCount * 0.18));
            v.speed = THREE.MathUtils.damp(v.speed, blockedByVehicle ? Math.min(headwaySpeedCap, chaseTopSpd) : chaseTopSpd, 6, clampedDt);
            const step = Math.min(d, v.speed * clampedDt);
            const dirX = dx / d;
            const dirZ = dz / d;
            const avoided = computeObstacleAvoidanceDir(v.x, v.z, dirX, dirZ, this.obstacleBlockers);
            const nx = v.x + avoided.x * step;
            const nz = v.z + avoided.z * step;
            const gyProbe = this.env.groundHeightAt(nx, nz, 0);
            if (gyProbe > -0.35) {
              v.x = nx;
              v.z = nz;
              v.yaw = Math.atan2(avoided.x, avoided.z);
            } else {
              v.policeMode = 'engaged';
              v.speed = 0;
              if (!v.officersDeployed) this.deployPoliceOfficersFromCar(v);
            }
            for (let w = 0; w < v.wheels.length; w++) v.wheels[w].rotation.x += step * 1.4;
          }
        } else {
          v.speed = 0;
          if ((v.policeAlertTimer ?? 0) <= 0 && distToPlayer > 75) {
            v.policeMode = 'patrol';
            v.officersDeployed = false;
            for (let poIdx = 0; poIdx < this.policeOfficers.length; poIdx++) {
              if (this.policeOfficers[poIdx].carId === v.id) {
                this.policeOfficers[poIdx].active = false;
                this.policeOfficers[poIdx].root.visible = false;
              }
            }
          }
        }

        const rawGy = this.env.groundHeightAt(v.x, v.z, 0);
        const gy = rawGy >= -0.05 ? Math.max(rawGy, getVehicleSurfaceOffsetY(v.x, v.z)) : rawGy;
        const flatWobble = v.puncturedCount > 0 && v.speed > 1.5
          ? Math.sin(elapsedSec * 15 + i) * 0.065
          : 0;
        v.root.position.set(v.x, gy, v.z);
        v.root.rotation.set(0, v.yaw, flatWobble);
        if (v.lightBarMeshes) {
          const flashPhase = (Math.floor(elapsedSec * 11) + i) % 2 === 0;
          const mA = v.lightBarMeshes[0].material;
          const mB = v.lightBarMeshes[1].material;
          if (mA instanceof THREE.MeshBasicMaterial) {
            mA.color.setHex(flashPhase ? 0xff2222 : 0x3b0d0d);
          }
          if (mB instanceof THREE.MeshBasicMaterial) {
            mB.color.setHex(flashPhase ? 0x0f2557 : 0x38bdf8);
          }
        }
        continue;
      }

      if (onCarHorn && v.kind !== 'bicycle' && v.hornCooldown <= 0 && this.globalHornCooldown <= 0) {
        const distToPlayer = Math.hypot(v.x - pPos.x, v.z - pPos.z);
        if (distToPlayer < 32 && (distToPlayer < 12 || Math.sin(elapsedSec * 1.7 + i) > 0.94)) {
          onCarHorn(distToPlayer);
          v.hornCooldown = 7 + (i % 5);
          this.globalHornCooldown = 2.4;
        }
      }

      const checkPlayerBlockingLane = (vx: number, vz: number, yaw: number, curY: number): boolean => {
        const pdx = pPos.x - vx;
        const pdz = pPos.z - vz;
        const dSq = pdx * pdx + pdz * pdz;
        if (dSq > 14 * 14 || Math.abs(pPos.y - curY) > 2.2) return false;
        const sinY = Math.sin(yaw);
        const cosY = Math.cos(yaw);
        const fwdDot = sinY * pdx + cosY * pdz;
        const sideDist = Math.abs(cosY * pdx - sinY * pdz);
        return fwdDot > 1.2 && fwdDot < 12.8 && sideDist < 2.35;
      };

      const vDistSq = _camCheckPos.set(v.x, 0, v.z).distanceToSquared(cameraPos);
      const vehVisible = isInCameraView(v.x, 0, v.z, 3.2, vDistSq, maxVehVisSq);
      if (v.root.visible !== vehVisible) v.root.visible = vehVisible;

      const updateWheelSpinAndSteer = (distMoved: number) => {
        if (!vehVisible) return;
        let yawDelta = v.yaw - v.prevYaw;
        while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
        while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
        v.prevYaw = v.yaw;
        const targetSteer = THREE.MathUtils.clamp((yawDelta / Math.max(0.008, clampedDt)) * 0.28, -0.44, 0.44);
        v.steerAngle = THREE.MathUtils.damp(v.steerAngle, targetSteer, 10, clampedDt);
        if (v.frontWheelSteerPivots) {
          for (let sp = 0; sp < v.frontWheelSteerPivots.length; sp++) {
            v.frontWheelSteerPivots[sp].rotation.y = v.steerAngle;
          }
        }
        for (let w = 0; w < v.wheels.length; w++) {
          const rad = v.wheelRadii[w] || 0.38;
          v.wheels[w].rotation.x += distMoved / rad;
        }
      };

      if (v.circleLoopIdx !== undefined && this.env.roadCircleLoops && this.env.roadCircleLoops[v.circleLoopIdx]) {
        const cl = this.env.roadCircleLoops[v.circleLoopIdx];
        const laneR = cl.radius + (cl.clockwise ? 2.8 : -2.8);
        const dirSign = cl.clockwise ? 1 : -1;
        const gyCur = this.env.groundHeightAt(v.x, v.z, 0);
        const blockedByPlayer = checkPlayerBlockingLane(v.x, v.z, v.yaw, gyCur);
        const tgtSpd = blockedByPlayer ? 0 : blockedByVehicle ? headwaySpeedCap : v.maxSpeed;
        v.speed = THREE.MathUtils.damp(v.speed, tgtSpd, tgtSpd < v.speed ? 12 : 4.5, clampedDt);
        const dAng = ((v.speed * clampedDt) / laneR) * dirSign;
        v.circleAngle = (v.circleAngle ?? 0) + dAng;
        v.x = cl.cx + Math.cos(v.circleAngle) * laneR;
        v.z = cl.cz + Math.sin(v.circleAngle) * laneR;
        const tx = -Math.sin(v.circleAngle) * dirSign;
        const tz = Math.cos(v.circleAngle) * dirSign;
        v.yaw = Math.atan2(tx, tz);
        const rawGy = this.env.groundHeightAt(v.x, v.z, 0);
        const gy = rawGy >= -0.05 ? Math.max(rawGy, getVehicleSurfaceOffsetY(v.x, v.z)) : rawGy;
        const flatWobble = v.puncturedCount > 0 && v.speed > 1.5
          ? Math.sin(elapsedSec * 15 + i) * 0.065
          : 0;
        v.root.position.set(v.x, gy, v.z);
        v.root.rotation.set(0, v.yaw, flatWobble);
        updateWheelSpinAndSteer(v.speed * clampedDt);
        continue;
      }

      if (v.loopIdx < 0) {
        const pts = this.env.parkCoords.cycleLoop;
        const targetPt = pts[Math.floor((elapsedSec * 0.45 + i * 2) % pts.length)];
        const dx = targetPt.x - v.x;
        const dz = targetPt.z - v.z;
        const d = Math.hypot(dx, dz) || 1;
        const moveDist = Math.min(d, v.maxSpeed * clampedDt);
        v.x += (dx / d) * moveDist;
        v.z += (dz / d) * moveDist;
        v.yaw = Math.atan2(dx, dz);
        const rawGy = this.env.groundHeightAt(v.x, v.z, 0);
        const gy = rawGy >= -0.05 ? Math.max(rawGy, getVehicleSurfaceOffsetY(v.x, v.z)) : rawGy;
        v.root.position.set(v.x, gy, v.z);
        v.root.rotation.set(0, v.yaw, 0);
        updateWheelSpinAndSteer(moveDist);
        continue;
      }

      const isEastRectVeh =
        (this.env.eastRoadRectLoopStartIdx !== undefined && v.loopIdx >= this.env.eastRoadRectLoopStartIdx) ||
        (this.env.westRoadRectLoopStartIdx !== undefined && v.loopIdx >= this.env.westRoadRectLoopStartIdx);
      const isBikeAgent =
        v.kind === 'motorcycle' || v.kind === 'sport_moto' || v.kind === 'city_scooter' || v.kind === 'bicycle';
      const fuelStage =
        !isEastRectVeh && !isBikeAgent && this.allFuelBays.length > 0
          ? stepVehicleRefuelState(v.refuel, v.x, v.z, clampedDt, this.allFuelBays)
          : 'cruise';

      let moveDist = 0;
      if (fuelStage === 'approach_bay') {
        const dx = v.refuel.bayX - v.x;
        const dz = v.refuel.bayZ - v.z;
        const d = Math.hypot(dx, dz) || 1;
        v.speed = THREE.MathUtils.damp(v.speed, blockedByVehicle ? Math.min(headwaySpeedCap, 8.5) : 8.5, 5, clampedDt);
        moveDist = Math.min(d, v.speed * clampedDt);
        v.x += (dx / d) * moveDist;
        v.z += (dz / d) * moveDist;
        v.yaw = Math.atan2(dx, dz);
      } else if (fuelStage === 'refueling') {
        v.speed = 0;
        v.x = v.refuel.bayX;
        v.z = v.refuel.bayZ;
        v.yaw = v.refuel.bayYaw;
      } else if (fuelStage === 'exit_bay') {
        const dx = v.refuel.returnX - v.x;
        const dz = v.refuel.returnZ - v.z;
        const d = Math.hypot(dx, dz) || 1;
        v.speed = THREE.MathUtils.damp(v.speed, blockedByVehicle ? Math.min(headwaySpeedCap, 9.0) : 9.0, 5, clampedDt);
        moveDist = Math.min(d, v.speed * clampedDt);
        v.x += (dx / d) * moveDist;
        v.z += (dz / d) * moveDist;
        v.yaw = Math.atan2(dx, dz);
      } else {
        const loop = this.env.roadRectLoops[v.loopIdx % this.env.roadRectLoops.length];
        const headingAxis: 'ns' | 'ew' = v.edge === 0 || v.edge === 2 ? 'ew' : 'ns';
        const headingDir: 1 | -1 = v.edge === 0 || v.edge === 1 ? 1 : -1;

        let mustStop = false;
        for (let j = 0; j < this.env.intersections.length; j++) {
          const inter = this.env.intersections[j];
          const sig = computeTrafficSignalState(elapsedSec, inter.offsetSec);
          if (shouldVehicleStopAtSignal(v.x, v.z, headingAxis, headingDir, inter.x, inter.z, sig)) {
            mustStop = true;
            break;
          }
        }
        const gyCur = this.env.groundHeightAt(v.x, v.z, 0);
        if (!mustStop && checkPlayerBlockingLane(v.x, v.z, v.yaw, gyCur)) {
          mustStop = true;
        }

        v.stoppedAtSignal = mustStop;
        const targetSpd = mustStop ? 0 : blockedByVehicle ? headwaySpeedCap : v.maxSpeed;
        v.speed = THREE.MathUtils.damp(v.speed, targetSpd, targetSpd < v.speed ? 12 : 4.5, clampedDt);

        moveDist = v.speed * clampedDt;
        if (v.edge === 0) {
          v.x += moveDist;
          v.z = loop.minZ + laneOffset;
          v.yaw = Math.PI * 0.5;
          if (v.x >= loop.maxX - laneOffset) {
            v.x = loop.maxX - laneOffset;
            v.edge = 1;
          }
        } else if (v.edge === 1) {
          v.z += moveDist;
          v.x = loop.maxX - laneOffset;
          v.yaw = 0;
          if (v.z >= loop.maxZ - laneOffset) {
            v.z = loop.maxZ - laneOffset;
            v.edge = 2;
          }
        } else if (v.edge === 2) {
          v.x -= moveDist;
          v.z = loop.maxZ - laneOffset;
          v.yaw = -Math.PI * 0.5;
          if (v.x <= loop.minX + laneOffset) {
            v.x = loop.minX + laneOffset;
            v.edge = 3;
          }
        } else {
          v.z -= moveDist;
          v.x = loop.minX + laneOffset;
          v.yaw = Math.PI;
          if (v.z <= loop.minZ + laneOffset) {
            v.z = loop.minZ + laneOffset;
            v.edge = 0;
          }
        }
      }

      const rawGy = this.env.groundHeightAt(v.x, v.z, 0);
      const gy = rawGy >= -0.05 ? Math.max(rawGy, getVehicleSurfaceOffsetY(v.x, v.z)) : rawGy;
      const flatWobble = v.puncturedCount > 0 && v.speed > 1.5
        ? Math.sin(elapsedSec * 15 + i) * 0.065
        : 0;
      v.root.position.set(v.x, gy, v.z);
      v.root.rotation.set(0, v.yaw, flatWobble);
      updateWheelSpinAndSteer(moveDist);
      if (v.lightBarMeshes && vehVisible) {
        const flashPhase = (Math.floor(elapsedSec * 6.5) + i) % 2 === 0;
        const mA = v.lightBarMeshes[0].material;
        const mB = v.lightBarMeshes[1].material;
        if (mA instanceof THREE.MeshBasicMaterial) {
          mA.color.setHex(flashPhase ? 0xff2222 : 0x3b0d0d);
        }
        if (mB instanceof THREE.MeshBasicMaterial) {
          mB.color.setHex(flashPhase ? 0x0f2557 : 0x38bdf8);
        }
      }
    }

    // 5b. Step Disembarked Responding Police Officers Firing Pistols at Player
    for (let i = 0; i < this.policeOfficers.length; i++) {
      const po = this.policeOfficers[i];
      if (!po.active) continue;

      if (po.hitFlashTimer > 0) {
        po.hitFlashTimer = Math.max(0, po.hitFlashTimer - clampedDt);
        po.shirtMat.emissive.setHex(po.hitFlashTimer > 0 ? 0x991b1b : 0x000000);
      }
      if (po.dead) {
        if (po.decapitated && po.bloodEmitTimer && po.bloodEmitTimer > 0) {
          po.bloodEmitTimer = Math.max(0, po.bloodEmitTimer - clampedDt);
          if (this.frameTick % 2 === 0) {
            this.spawnNeckBloodJet(po.x, po.y + 1.38, po.z, 2);
          }
        }
        if (po.fallTimer > 0) {
          po.fallTimer = Math.max(0, po.fallTimer - clampedDt);
          animateHumanoidCollapse(
            po.root,
            po,
            po.x,
            po.y,
            po.z,
            po.yaw,
            po.deathStyle ?? 'default',
            po.fallTimer,
            po.deathDuration ?? 3.1,
            po.hitDirX ?? 0,
            po.hitDirZ ?? 1,
            clampedDt,
            this.env.colliders,
            this.env.groundHeightAt,
            this.colliderGrid,
          );
          if (po.fallTimer <= 0) {
            po.root.visible = false;
            po.active = false;
          }
        }
        continue;
      }

      if (po.staggerTimer && po.staggerTimer > 0) {
        po.staggerTimer = Math.max(0, po.staggerTimer - clampedDt);
      }

      po.fireCooldown = Math.max(0, po.fireCooldown - clampedDt);
      const dx = pPos.x - po.x;
      const dz = pPos.z - po.z;
      const d = Math.hypot(dx, dz);
      po.yaw = Math.atan2(dx, dz);

      let moving = false;
      if (d > 11.5 && d < 75) {
        const limpMul = po.limping ? 0.5 : 1.0;
        const stagMul = po.staggerTimer && po.staggerTimer > 0 ? 0.15 : 1.0;
        const step = Math.min(d - 10, 3.8 * limpMul * stagMul * clampedDt);
        const dirX = dx / d;
        const dirZ = dz / d;
        po.x += dirX * step;
        po.z += dirZ * step;
        const res = resolveCircleColliders2DGrid(po.x, po.y, po.z, 0.42, 1.75, this.colliderGrid);
        po.x = res.x;
        po.z = res.z;
        po.walkPhase += step * 3.1;
        moving = true;
      }
      po.y = this.env.groundHeightAt(po.x, po.z, po.y);
      const bob = moving ? Math.abs(Math.sin(po.walkPhase)) * 0.032 : 0;
      const poLegStag =
        po.staggerTimer && po.staggerTimer > 0 && (po.staggerKind === 'leg_left' || po.staggerKind === 'leg_right');
      const stagDip = poLegStag ? -0.2 : 0;
      po.root.position.set(po.x, po.y + bob + stagDip, po.z);
      po.root.rotation.set(
        po.staggerTimer && po.staggerTimer > 0 ? (poLegStag ? 0.25 : -0.2) : 0,
        po.yaw,
        0,
      );

      const swing = moving ? Math.sin(po.walkPhase) * (po.limping ? 0.34 : 0.56) : 0;
      po.leftLeg.rotation.x = swing;
      po.rightLeg.rotation.x = -swing;
      po.leftArm.rotation.x = moving ? -swing * 0.6 : -0.35;
      po.rightArm.rotation.x = -1.48; // Aiming pistol straight at player

      if (po.fireCooldown <= 0 && d < 46) {
        po.fireCooldown = 0.78 + (i % 3) * 0.22;
        firedShots.push({
          fromX: po.x + Math.sin(po.yaw) * 0.52,
          fromY: po.y + 1.34,
          fromZ: po.z + Math.cos(po.yaw) * 0.52,
          toX: pPos.x + (Math.random() - 0.5) * 0.68,
          toY: pPos.y + 1.18 + (Math.random() - 0.5) * 0.42,
          toZ: pPos.z + (Math.random() - 0.5) * 0.68,
          damage: 7,
          kind: 'police_pistol',
        });
      }
    }

    // 5c. Step Carjacked / Thrown NPC Drivers (airborne tumble arc -> pavement roll -> panic flee)
    for (let i = this.ejectedDrivers.length - 1; i >= 0; i--) {
      const ed = this.ejectedDrivers[i];
      if (ed.stunTimer > 0) {
        ed.stunTimer = Math.max(0, ed.stunTimer - clampedDt);
        ed.x += ed.vx * clampedDt;
        ed.z += ed.vz * clampedDt;
        ed.vy -= 14.5 * clampedDt;
        ed.y += ed.vy * clampedDt;
        const gy = this.env.groundHeightAt(ed.x, ed.z, ed.y);
        if (ed.y <= gy + 0.16) {
          ed.y = gy + 0.16;
          if (ed.vy < -1.8) {
            ed.vy = -ed.vy * 0.28;
          } else {
            ed.vy = 0;
          }
          const damp = Math.max(0, 1 - 6.2 * clampedDt);
          ed.vx *= damp;
          ed.vz *= damp;
          ed.rollAngle = THREE.MathUtils.lerp(ed.rollAngle, 0.38, Math.min(1, clampedDt * 12));
        } else {
          ed.rollAngle += clampedDt * 7.5;
        }
        const res = resolveCircleColliders2DGrid(ed.x, gy, ed.z, 0.4, 1.5, this.colliderGrid);
        ed.x = res.x;
        ed.z = res.z;
        ed.root.position.set(ed.x, ed.y, ed.z);
        ed.root.rotation.order = 'YXZ';
        ed.root.rotation.set(Math.PI * 0.46, ed.yaw, ed.rollAngle);
      } else if (ed.fleeTimer > 0) {
        ed.fleeTimer = Math.max(0, ed.fleeTimer - clampedDt);
        const fdx = ed.x - pPos.x;
        const fdz = ed.z - pPos.z;
        const fd = Math.hypot(fdx, fdz) || 1;
        const step = 4.6 * clampedDt;
        ed.x += (fdx / fd) * step;
        ed.z += (fdz / fd) * step;
        const res = resolveCircleColliders2DGrid(ed.x, ed.y, ed.z, 0.38, 1.65, this.colliderGrid);
        ed.x = res.x;
        ed.z = res.z;
        ed.y = this.env.groundHeightAt(ed.x, ed.z, ed.y);
        ed.yaw = Math.atan2(fdx, fdz);
        ed.walkPhase += clampedDt * 13;
        ed.root.position.set(ed.x, ed.y + Math.abs(Math.sin(ed.walkPhase)) * 0.04, ed.z);
        ed.root.rotation.set(0, ed.yaw, 0);
        const swing = Math.sin(ed.walkPhase) * 0.72;
        ed.leftLeg.rotation.x = swing;
        ed.rightLeg.rotation.x = -swing;
        ed.leftArm.rotation.x = -swing * 0.7;
        ed.rightArm.rotation.x = swing * 0.7;
      } else {
        this.root.remove(ed.root);
        this.ejectedDrivers.splice(i, 1);
      }
    }

    // 5d. Step Decapitation Severed Heads, Neck Blood Fountain & Expanding Blood Pools
    for (let i = this.severedHeads.length - 1; i >= 0; i--) {
      const sh = this.severedHeads[i];
      sh.life -= clampedDt;
      if (sh.life <= 0) {
        this.root.remove(sh.mesh);
        this.severedHeads.splice(i, 1);
        continue;
      }
      sh.vy -= 14.5 * clampedDt;
      sh.mesh.position.x += sh.vx * clampedDt;
      sh.mesh.position.y += sh.vy * clampedDt;
      sh.mesh.position.z += sh.vz * clampedDt;
      const gy = this.env.groundHeightAt(sh.mesh.position.x, sh.mesh.position.z, sh.mesh.position.y);
      if (sh.mesh.position.y < gy + 0.16) {
        sh.mesh.position.y = gy + 0.16;
        if (sh.vy < -1.2) sh.vy = -sh.vy * 0.35;
        else sh.vy = 0;
        sh.vx *= Math.max(0, 1 - 6.5 * clampedDt);
        sh.vz *= Math.max(0, 1 - 6.5 * clampedDt);
      } else {
        sh.mesh.rotation.x += clampedDt * 8.5;
        sh.mesh.rotation.z += clampedDt * 6.0;
      }
    }
    for (let i = this.bloodDrops.length - 1; i >= 0; i--) {
      const bd = this.bloodDrops[i];
      bd.life -= clampedDt;
      bd.vy -= 14.2 * clampedDt;
      bd.mesh.position.x += bd.vx * clampedDt;
      bd.mesh.position.y += bd.vy * clampedDt;
      bd.mesh.position.z += bd.vz * clampedDt;
      const gy = this.env.groundHeightAt(bd.mesh.position.x, bd.mesh.position.z, bd.mesh.position.y);
      if (bd.life <= 0 || bd.mesh.position.y < gy + 0.02) {
        this.root.remove(bd.mesh);
        this.bloodDrops.splice(i, 1);
      }
    }
    for (let i = this.bloodPools.length - 1; i >= 0; i--) {
      const bp = this.bloodPools[i];
      bp.life -= clampedDt;
      if (bp.life <= 0) {
        this.root.remove(bp.mesh);
        this.bloodPools.splice(i, 1);
        continue;
      }
      const nextS = THREE.MathUtils.lerp(bp.mesh.scale.x, bp.targetScale, Math.min(1, clampedDt * 3.8));
      bp.mesh.scale.set(nextS, 1, nextS);
    }

    // 6. Animate Hot Food Rising Steam
    for (let i = 0; i < this.steamPuffs.length; i++) {
      const p = this.steamPuffs[i];
      const dSq = _camCheckPos.set(p.originX, p.originY, p.originZ).distanceToSquared(cameraPos);
      if (dSq > 55 * 55) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.visible = true;
      const cycle = ((elapsedSec * p.speed + p.phase) % 1 + 1) % 1;
      p.mesh.position.set(
        p.originX + Math.sin(cycle * 6 + p.phase) * 0.14,
        p.originY + 0.12 + cycle * 1.05,
        p.originZ + Math.cos(cycle * 5 + p.phase) * 0.12,
      );
      const s = 0.55 + cycle * 1.15;
      p.mesh.scale.set(s, s * 1.2, s);
    }

    // 7. Step Billionaire Luxury Car Couples & "AWAIS BALOCH" Private Helicopter Party Cycle (Night-only guests)
    const nightPartyAllowed = shouldMansionNightGuestsAttend(phase, this.manualDayDepartureActive);
    const isDepartureDay = !nightPartyAllowed;

    for (let i = 0; i < this.vipCarCouples.length; i++) {
      const vc = this.vipCarCouples[i];
      const coupleHome = vc.parkSlot;
      const moveAlongDriveWps = (speed: number): boolean => {
        if (vc.driveWpIdx >= vc.driveWps.length) return true;
        const tgt = vc.driveWps[vc.driveWpIdx];
        const dx = tgt.x - vc.x;
        const dz = tgt.z - vc.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= Math.max(0.35, speed * clampedDt * 1.15)) {
          vc.x = tgt.x;
          vc.z = tgt.z;
          vc.driveWpIdx++;
          return vc.driveWpIdx >= vc.driveWps.length;
        }
        const step = speed * clampedDt;
        vc.x += (dx / dist) * step;
        vc.z += (dz / dist) * step;
        const wantYaw = Math.atan2(dx, dz);
        let dyaw = wantYaw - vc.yaw;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        vc.yaw += dyaw * Math.min(1, clampedDt * 8);
        for (let w = 0; w < vc.wheels.length; w++) {
          const rad = vc.wheelRadii[w] || 0.39;
          vc.wheels[w].rotation.x += step / rad;
        }
        if (vc.frontWheelSteerPivots) {
          const steer = THREE.MathUtils.clamp(dyaw * 0.4, -0.4, 0.4);
          for (let sp = 0; sp < vc.frontWheelSteerPivots.length; sp++) {
            vc.frontWheelSteerPivots[sp].rotation.y = steer;
          }
        }
        return false;
      };

      const stepCoupleAlongWps = (speed: number, danceWhenDone = false): boolean => {
        if (vc.coupleWpIdx >= vc.coupleWps.length) {
          if (danceWhenDone) {
            const mp = this.env.mansionPartyZone;
            const djX = mp ? mp.djX : 0;
            const djZ = mp ? mp.djZ : -378;
            const beat = elapsedSec * 6.8 + vc.id * 0.9;
            const bounce = Math.abs(Math.sin(beat)) * 0.08;
            for (let c = 0; c < 2; c++) {
              const cp = vc.couplePos[c];
              const rig = vc.couple[c];
              const offsetX = c === 0 ? -0.52 : 0.52;
              const tx = vc.partySpot.x + offsetX;
              const tz = vc.partySpot.z;
              cp.x = tx;
              cp.z = tz;
              cp.y = 11.6 + bounce;
              cp.yaw = Math.atan2(djX - tx, djZ - tz) + Math.sin(elapsedSec * 1.4 + c) * 0.2;
              rig.root.visible = true;
              rig.root.position.set(cp.x, cp.y, cp.z);
              rig.root.rotation.set(0, cp.yaw, Math.sin(beat * 0.5) * 0.04);
              rig.leftLeg.rotation.x = Math.sin(beat + c) * 0.16;
              rig.rightLeg.rotation.x = -Math.sin(beat + c) * 0.16;
              rig.leftKnee.rotation.x = Math.max(0.06, Math.sin(beat + c) * 0.26);
              rig.rightKnee.rotation.x = Math.max(0.06, -Math.sin(beat + c) * 0.26);
              rig.leftArm.rotation.set(-1.5 + Math.sin(beat + c) * 0.5, 0, -0.28);
              rig.rightArm.rotation.set(-1.5 + Math.cos(beat + c) * 0.5, 0, 0.28);
              rig.leftElbow.rotation.x = -0.52;
              rig.rightElbow.rotation.x = -0.52;
            }
          }
          return true;
        }
        const wp = vc.coupleWps[vc.coupleWpIdx];
        const cp0 = vc.couplePos[0];
        const dx = wp.x - cp0.x;
        const dz = wp.z - cp0.z;
        const horizDist = Math.hypot(dx, dz);
        const stepDist = speed * clampedDt;
        const prevFloorY = cp0.y;
        let arrived = false;
        if (horizDist <= Math.max(0.18, stepDist * 1.2)) {
          cp0.x = wp.x;
          cp0.y = wp.y;
          cp0.z = wp.z;
          vc.coupleWpIdx++;
          arrived = vc.coupleWpIdx >= vc.coupleWps.length;
        } else {
          const nx = dx / horizDist;
          const nz = dz / horizDist;
          cp0.x += nx * stepDist;
          cp0.z += nz * stepDist;
          const frac = Math.min(1, stepDist / Math.max(0.01, horizDist));
          cp0.y = prevFloorY + (wp.y - prevFloorY) * frac;
          cp0.yaw = Math.atan2(dx, dz);
          cp0.phase += stepDist * 4.4;
        }
        const sideX = Math.cos(cp0.yaw) * 0.44;
        const sideZ = -Math.sin(cp0.yaw) * 0.44;
        vc.couplePos[1].x = cp0.x + sideX * 2;
        vc.couplePos[1].z = cp0.z - sideZ * 2;
        vc.couplePos[1].y = cp0.y;
        vc.couplePos[1].yaw = cp0.yaw;
        vc.couplePos[1].phase = cp0.phase + 0.55;

        const stairDir = wp.stairDir ?? 0;
        for (let c = 0; c < 2; c++) {
          const cp = vc.couplePos[c];
          const rig = vc.couple[c];
          rig.root.visible = true;
          rig.root.position.set(cp.x - (c === 0 ? sideX : 0), cp.y, cp.z + (c === 0 ? sideZ : 0));
          rig.root.rotation.y = cp.yaw;
          applyStairClimbKinematics(rig, cp.phase, stairDir);
        }
        return arrived;
      };

      if (vc.stage === 'approach_gate') {
        if (isDepartureDay) {
          vc.root.visible = false;
          vc.stage = 'away_cooldown';
          vc.stageTimer = 2;
        } else if (vc.stageTimer > 0) {
          vc.stageTimer -= clampedDt;
        } else {
          vc.driveWps = [
            { x: 2.8, z: -241.5 },
          ];
          vc.driveWpIdx = 0;
          if (vc.z <= -241.0) {
            vc.z = -241.5;
            vc.stage = 'wait_gate_in';
            vc.stageTimer = 2.4;
          } else {
            moveAlongDriveWps(10.5);
          }
        }
      } else if (vc.stage === 'wait_gate_in') {
        if (isDepartureDay) {
          vc.driveWps = [
            { x: -2.8, z: -225 },
            { x: -2.8, z: -162 },
          ];
          vc.driveWpIdx = 0;
          vc.stage = 'drive_away';
        } else {
          vc.stageTimer -= clampedDt;
          if (vc.stageTimer <= 0) {
            vc.driveWps = [
              { x: 2.8, z: -268 },
              { x: vc.parkSlot.x > 0 ? 11.5 : -11.5, z: -282 },
              { x: vc.parkSlot.x, z: vc.parkSlot.z },
            ];
            vc.driveWpIdx = 0;
            vc.stage = 'drive_park';
          }
        }
      } else if (vc.stage === 'drive_park') {
        if (moveAlongDriveWps(8.5)) {
          vc.yaw = coupleHome.yaw;
          vc.couplePos[0] = { x: vc.parkSlot.x - 1.6, y: 0.1, z: vc.parkSlot.z, yaw: Math.PI, phase: 0 };
          vc.couplePos[1] = { x: vc.parkSlot.x + 1.6, y: 0.1, z: vc.parkSlot.z, yaw: Math.PI, phase: 0.5 };
          vc.coupleWps = [
            { x: 0, y: 0.14, z: -316, stairDir: 0 },
            { x: 0, y: 0.14, z: -328, stairDir: 0 },
            { x: 18.5, y: 0.14, z: -344, stairDir: 0 },
            ...buildStaircase2Path(0, 2),
            { x: vc.partySpot.x, y: 11.6, z: vc.partySpot.z, stairDir: 0 },
          ];
          vc.coupleWpIdx = 0;
          vc.stage = 'couple_enter';
          vc.stageTimer = 0;
        }
      } else if (vc.stage === 'couple_enter') {
        if (vc.doorPivotL) vc.doorPivotL.rotation.y = Math.sin(Math.min(Math.PI, elapsedSec * 2)) * 0.5;
        if (stepCoupleAlongWps(2.8, false)) {
          vc.stage = 'party_dance';
          vc.stageTimer = 0;
        }
      } else if (vc.stage === 'party_dance') {
        vc.stageTimer += clampedDt;
        stepCoupleAlongWps(2.8, true);
        if (isDepartureDay || vc.stageTimer > 125) {
          vc.coupleWps = [
            { x: 27.6, y: 11.6, z: -349.6, stairDir: 0 },
            ...buildStaircase2Path(2, 0),
            { x: 18.5, y: 0.14, z: -344, stairDir: 0 },
            { x: 0, y: 0.14, z: -328, stairDir: 0 },
            { x: 0, y: 0.14, z: -316, stairDir: 0 },
            { x: vc.parkSlot.x, y: 0.1, z: vc.parkSlot.z, stairDir: 0 },
          ];
          vc.coupleWpIdx = 0;
          vc.stage = 'couple_exit';
        }
      } else if (vc.stage === 'couple_exit') {
        if (stepCoupleAlongWps(2.8, false)) {
          vc.couple[0].root.visible = false;
          vc.couple[1].root.visible = false;
          vc.driveWps = [
            { x: vc.parkSlot.x > 0 ? 11.5 : -11.5, z: -282 },
            { x: -2.8, z: -260 },
            { x: -2.8, z: -255 },
          ];
          vc.driveWpIdx = 0;
          vc.stage = 'wait_gate_out';
          vc.stageTimer = 2.4;
        }
      } else if (vc.stage === 'wait_gate_out') {
        if (vc.driveWpIdx < vc.driveWps.length) {
          moveAlongDriveWps(7.5);
        } else {
          vc.stageTimer -= clampedDt;
          if (vc.stageTimer <= 0) {
            vc.driveWps = [
              { x: -2.8, z: -230 },
              { x: -2.8, z: -162 },
            ];
            vc.driveWpIdx = 0;
            vc.stage = 'drive_away';
          }
        }
      } else if (vc.stage === 'drive_away') {
        if (moveAlongDriveWps(12.0)) {
          vc.stage = 'away_cooldown';
          vc.stageTimer = 14 + i * 3;
          vc.root.visible = false;
        }
      } else if (vc.stage === 'away_cooldown') {
        vc.root.visible = false;
        vc.stageTimer -= clampedDt;
        if (vc.stageTimer <= 0 && nightPartyAllowed) {
          vc.x = 2.8;
          vc.z = -168 - i * 8;
          vc.yaw = Math.PI;
          vc.root.visible = true;
          vc.stage = 'approach_gate';
          vc.stageTimer = 0;
        }
      }

      const rawCarY = this.env.groundHeightAt(vc.x, vc.z, 0);
      vc.y = rawCarY >= -0.05 ? Math.max(rawCarY, getVehicleSurfaceOffsetY(vc.x, vc.z)) : rawCarY;
      vc.root.position.set(vc.x, vc.y, vc.z);
      vc.root.rotation.set(0, vc.yaw, 0);
    }

    if (this.awaisHeliGuest) {
      const hg = this.awaisHeliGuest;
      const pad = MANSION_HELIPAD_2_COORDS;
      hg.mainRotorPivot.rotation.y += hg.rotorSpeed * clampedDt;
      hg.tailRotorPivot.rotation.x += hg.rotorSpeed * 1.45 * clampedDt;
      hg.rotorBlurMesh.visible = hg.rotorSpeed > 12;
      hg.beaconMat.color.setHex(Math.sin(elapsedSec * 6.5) > 0 ? 0xf43f5e : 0x4c0519);

      const stepHeliPairAlongWps = (speed: number, dance: boolean): boolean => {
        if (hg.wpIdx >= hg.wps.length) {
          if (dance) {
            const mp = this.env.mansionPartyZone;
            const djX = mp ? mp.djX : 0;
            const djZ = mp ? mp.djZ : -378;
            const beat = elapsedSec * 6.8 + 3.1;
            const bounce = Math.abs(Math.sin(beat)) * 0.08;
            [
              { rig: hg.awais, st: hg.awaisState, tx: 1.5, tz: -361.4 },
              { rig: hg.partner, st: hg.partnerState, tx: 2.7, tz: -361.4 },
            ].forEach((pair, pIdx) => {
              pair.st.x = pair.tx;
              pair.st.y = 11.6 + bounce;
              pair.st.z = pair.tz;
              pair.st.yaw = Math.atan2(djX - pair.tx, djZ - pair.tz) + Math.sin(elapsedSec * 1.5 + pIdx) * 0.22;
              pair.rig.root.visible = true;
              pair.rig.root.position.set(pair.st.x, pair.st.y, pair.st.z);
              pair.rig.root.rotation.set(0, pair.st.yaw, Math.sin(beat * 0.5) * 0.04);
              pair.rig.leftLeg.rotation.x = Math.sin(beat + pIdx) * 0.16;
              pair.rig.rightLeg.rotation.x = -Math.sin(beat + pIdx) * 0.16;
              pair.rig.leftKnee.rotation.x = Math.max(0.06, Math.sin(beat + pIdx) * 0.26);
              pair.rig.rightKnee.rotation.x = Math.max(0.06, -Math.sin(beat + pIdx) * 0.26);
              pair.rig.leftArm.rotation.set(-1.55 + Math.sin(beat + pIdx) * 0.5, 0, -0.28);
              pair.rig.rightArm.rotation.set(-1.55 + Math.cos(beat + pIdx) * 0.5, 0, 0.28);
              pair.rig.leftElbow.rotation.x = -0.5;
              pair.rig.rightElbow.rotation.x = -0.5;
            });
          }
          return true;
        }
        const wp = hg.wps[hg.wpIdx];
        const st = hg.awaisState;
        const dx = wp.x - st.x;
        const dz = wp.z - st.z;
        const hDist = Math.hypot(dx, dz);
        const step = speed * clampedDt;
        const prevY = st.y;
        let done = false;
        if (hDist <= Math.max(0.2, step * 1.2)) {
          st.x = wp.x;
          st.y = wp.y;
          st.z = wp.z;
          hg.wpIdx++;
          done = hg.wpIdx >= hg.wps.length;
        } else {
          st.x += (dx / hDist) * step;
          st.z += (dz / hDist) * step;
          st.y = prevY + (wp.y - prevY) * Math.min(1, step / Math.max(0.01, hDist));
          st.yaw = Math.atan2(dx, dz);
          st.phase += step * 4.4;
        }
        const sideX = Math.cos(st.yaw) * 0.45;
        const sideZ = -Math.sin(st.yaw) * 0.45;
        hg.partnerState.x = st.x + sideX * 2;
        hg.partnerState.z = st.z - sideZ * 2;
        hg.partnerState.y = st.y;
        hg.partnerState.yaw = st.yaw;
        hg.partnerState.phase = st.phase + 0.5;

        const stairDir = wp.stairDir ?? 0;
        hg.awais.root.visible = true;
        hg.awais.root.position.set(st.x - sideX, st.y, st.z + sideZ);
        hg.awais.root.rotation.y = st.yaw;
        applyStairClimbKinematics(hg.awais, st.phase, stairDir);

        hg.partner.root.visible = true;
        hg.partner.root.position.set(hg.partnerState.x, hg.partnerState.y, hg.partnerState.z);
        hg.partner.root.rotation.y = hg.partnerState.yaw;
        applyStairClimbKinematics(hg.partner, hg.partnerState.phase, stairDir);
        return done;
      };

      if (hg.stage === 'fly_in') {
        if (isDepartureDay) {
          hg.heliRoot.visible = false;
          hg.stage = 'away_cooldown';
          hg.stageTimer = 2;
        } else {
          hg.heliRoot.visible = true;
          const dx = pad.x - hg.x;
          const dy = pad.deckY - hg.y;
          const dz = pad.z - hg.z;
          const dist = Math.hypot(dx, dy, dz);
          if (dist <= 0.45) {
            hg.x = pad.x;
            hg.y = pad.deckY;
            hg.z = pad.z;
            hg.yaw = pad.yaw;
            hg.stage = 'land_settle';
            hg.stageTimer = 2.0;
          } else {
            const spd = Math.min(dist, (dist > 14 ? 14.5 : 5.2) * clampedDt);
            hg.x += (dx / dist) * spd;
            hg.y += (dy / dist) * spd;
            hg.z += (dz / dist) * spd;
            if (Math.hypot(dx, dz) > 2.5) {
              hg.yaw = Math.atan2(dx, dz);
            } else {
              hg.yaw += (pad.yaw - hg.yaw) * Math.min(1, clampedDt * 4);
            }
          }
        }
      } else if (hg.stage === 'land_settle') {
        hg.rotorSpeed = Math.max(1.5, hg.rotorSpeed - clampedDt * 18);
        hg.stageTimer -= clampedDt;
        if (isDepartureDay) {
          hg.rotorSpeed = 34;
          hg.stage = 'takeoff';
          hg.stageTimer = 0;
        } else if (hg.stageTimer <= 0) {
          for (let g = 0; g < hg.guards.length; g++) {
            const gd = hg.guards[g];
            gd.rig.root.visible = true;
            gd.rig.root.position.set(gd.x, gd.y, gd.z);
            gd.rig.root.rotation.set(0, gd.yaw, 0);
          }
          hg.awaisState = { x: pad.x - 1.5, y: MANSION_ROOF_Y, z: pad.z + 4.8, yaw: Math.PI, phase: 0 };
          hg.wps = [
            { x: 32.4, y: MANSION_ROOF_Y, z: -368.0, stairDir: 0 },
            { x: 32.4, y: MANSION_ROOF_Y, z: -349.5, stairDir: 0 },
            ...buildStaircase2Path(3, 2),
            { x: 2.0, y: 11.6, z: -361.4, stairDir: 0 },
          ];
          hg.wpIdx = 0;
          hg.stage = 'couple_descend';
        }
      } else if (hg.stage === 'couple_descend') {
        hg.rotorSpeed = 0;
        if (stepHeliPairAlongWps(2.6, false)) {
          hg.stage = 'party_dance';
          hg.stageTimer = 0;
        }
      } else if (hg.stage === 'party_dance') {
        hg.stageTimer += clampedDt;
        stepHeliPairAlongWps(2.6, true);
        if (isDepartureDay || hg.stageTimer > 135) {
          hg.wps = [
            { x: 22.4, y: 11.6, z: -350.5, stairDir: 0 },
            ...buildStaircase2Path(2, 3),
            { x: 32.4, y: MANSION_ROOF_Y, z: -349.5, stairDir: 0 },
            { x: 32.4, y: MANSION_ROOF_Y, z: -368.0, stairDir: 0 },
            { x: pad.x, y: MANSION_ROOF_Y, z: pad.z + 3.2, stairDir: 0 },
          ];
          hg.wpIdx = 0;
          hg.stage = 'couple_ascend';
        }
      } else if (hg.stage === 'couple_ascend') {
        hg.rotorSpeed = Math.min(34, hg.rotorSpeed + clampedDt * 18);
        if (stepHeliPairAlongWps(2.6, false)) {
          hg.awais.root.visible = false;
          hg.partner.root.visible = false;
          for (let g = 0; g < hg.guards.length; g++) {
            hg.guards[g].rig.root.visible = false;
          }
          hg.stage = 'takeoff';
          hg.stageTimer = 0;
        }
      } else if (hg.stage === 'takeoff') {
        hg.rotorSpeed = 34;
        hg.stageTimer += clampedDt;
        hg.y += 8.2 * clampedDt;
        hg.x += 12.5 * clampedDt;
        hg.z += 11.5 * clampedDt;
        hg.yaw = Math.atan2(12.5, 11.5);
        if (hg.stageTimer > 9.5) {
          hg.heliRoot.visible = false;
          hg.stage = 'away_cooldown';
          hg.stageTimer = 18;
        }
      } else if (hg.stage === 'away_cooldown') {
        hg.heliRoot.visible = false;
        hg.stageTimer -= clampedDt;
        if (hg.stageTimer <= 0 && nightPartyAllowed) {
          hg.x = pad.x + 48;
          hg.y = pad.deckY + 34;
          hg.z = pad.z + 52;
          hg.rotorSpeed = 32;
          hg.heliRoot.visible = true;
          hg.stage = 'fly_in';
        }
      }

      hg.heliRoot.position.set(hg.x, hg.y, hg.z);
      hg.heliRoot.rotation.set(0, hg.yaw, 0);
      for (let g = 0; g < hg.guards.length; g++) {
        const gd = hg.guards[g];
        if (gd.rig.root.visible) {
          gd.rig.headPivot.rotation.y = Math.sin(elapsedSec * 0.9 + g * 1.4) * 0.28;
        }
      }
    }

    return firedShots;
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
