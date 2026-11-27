import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  BIKE_STYLES,
  BikeStyleId,
  CameraPerspective,
  CompassThreat,
  CustomDropTarget,
  DEFAULT_HUD_SETTINGS,
  DEFAULT_LOADOUT_CONFIG,
  DetectionState,
  Difficulty,
  DropSector,
  FireMode,
  GamePhase,
  HudSettings,
  HudState,
  KillFeedEntry,
  LoadoutConfig,
  LoadProgress,
  LobbyViewMode,
  MapId,
  OPERATOR_SKINS,
  PlayerAnimState,
  getMapPois,
  RadarBlip,
  RadarObstacle,
  SIMULATOR_POIS,
  SIM_SHOP_ITEMS,
  SNIPER_ZOOM_OPTIONS,
  SmartCityAimTargetInfo,
  TimeOfDayPhase,
  VehicleCameraMode,
  VehicleInputState,
  VehicleKind,
  WEAPON_ORDER,
  WEAPON_ZOOM_OPTIONS,
  WEAPONS,
  WeaponId,
  WeatherKind,
  WorldSystem,
  createWeaponRecord,
  normalizeWeaponId,
} from '../types';
import {
  createWantedLevelState,
  createColliderSpatialGrid,
  forEachColliderInBounds,
  getMegaWorldDistrictAt,
  registerWantedIncident,
  resolveCircleColliders2D,
  resolveCircleColliders2DGrid,
  stepWantedLevelState,
  type ColliderSpatialGrid,
  type WantedLevelState,
} from './simulatorSystems';
import {
  BarrelActor,
  buildArena,
  BuiltArena,
  ColliderBox,
  DoorwayTrigger,
  hitBreakableGlassPane,
  MansionSeatSpot,
  SurfaceType,
  WorldInteractable,
} from './arena';
import {
  computeEnvironmentSnapshot,
  EnvironmentCycleController,
  type EnvironmentLightingSnapshot,
} from './environmentCycle';
import { soundEngine } from './audio';
import {
  applyOperatorSkin,
  applyWeaponSkin,
  buildFirstPersonArms,
  buildGrenadePreviewModel,
  buildSoldierModel,
  buildWeaponModel,
  createMaterialLibrary,
  disposeObject3DResources,
  FirstPersonArmsRig,
  MaterialLibrary,
  SoldierRig,
  WeaponViewModel,
} from './models';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { isInsidePavedBuildingPad, isOnMegaRoad } from './unifiedSimulatorArena';
import { buildDigitalBikeMesh, VehicleActor, VehicleManager } from './vehicles';
import { resolveGraphicsProfile } from './lobbyConfig';
import {
  HELICOPTER_PADS,
  MANSION_DEFAULT_SPAWN,
  applyCarRemoteAction,
  canEnterMansionVehicle,
  stepHelicopterPadRespawn,
  stepSeatedChairYaw,
  toggleVehicleEngineIgnition,
  triggerSosLightFlash,
  type HelipadTrackerState,
  type MansionCarDoorAction,
} from './mansionSystems';
import {
  MANSION_POOL_BOUNDS,
  resolvePlayerAgainstVehicle,
  stepSwimmingPhysics,
  type SwimPhysicsState,
} from './swimmingPhysics';
import {
  getSmartCityDynamicChartsData,
  SMART_CITY_DOME,
  type SmartCityCommand,
  type SmartCitySimulationState,
} from './smartCitySystems';
import {
  FUTURE_LAB_DEPARTMENTS,
  SCIENCE_DOMES_CATALOG,
  detectNearestScienceInteraction,
  type ScienceDomeId,
  type ScienceLabDepartmentId,
} from './scienceDistrictSystems';

// Pre-allocated math helpers (zero GC inside animation loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _prevPos = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _venturiWorld = new THREE.Vector3();
const _shellVel = new THREE.Vector3();
const _throwOrigin = new THREE.Vector3();
const _throwDir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _raycaster = new THREE.Raycaster();
const _zeroNdc = new THREE.Vector2(0, 0);
const _tapNdc = new THREE.Vector2();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _hitNormal = new THREE.Vector3();
const _tmpNormal = new THREE.Vector3();
const _decalQuat = new THREE.Quaternion();
const _rainMat4 = new THREE.Matrix4();
const _envSunDir = new THREE.Vector3();
const _envZenithCol = new THREE.Color();
const _envHorizonCol = new THREE.Color();
const _envSunCol = new THREE.Color();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _ringQuat = new THREE.Quaternion();
const _waterSplashPt = new THREE.Vector3();
const _waterSplashNorm = new THREE.Vector3(0, 1, 0);
const _expCenter = new THREE.Vector3();
const _camFrustum = new THREE.Frustum();
const _camProjScreenMat = new THREE.Matrix4();
const _lodSphere = new THREE.Sphere(new THREE.Vector3(), 30);
const _hoodSmokePos = new THREE.Vector3();
const _screenBox = new THREE.Box3();
const _screenClosestPt = new THREE.Vector3();
const _screenNormal = new THREE.Vector3();
const _screenQuat = new THREE.Quaternion();
const _sparkQuat = new THREE.Quaternion();

interface TracerEffect {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

interface ShellCasing {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  active: boolean;
}

interface ImpactParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  baseScale: number;
  active: boolean;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  startOpacity: number;
  active: boolean;
}

interface ExplosionFlash {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  startScale: number;
  maxScale: number;
  startOpacity: number;
  active: boolean;
}

interface ShockRingEffect {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
  active: boolean;
}

interface WaterSplashDroplet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
  active: boolean;
}

interface WaterRipple {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
  active: boolean;
}

interface SandPuff {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  active: boolean;
}

interface RocketProjectile {
  group: THREE.Group;
  flameMesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  smokeAccum: number;
}

interface ThrownGrenade {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fuse: number;
  inWater?: boolean;
}

interface BulletHoleDecal {
  mesh: THREE.Mesh;
}

interface ActiveThreat {
  id: number;
  angleDeg: number;
  life: number;
}

interface ElectricSparkQuad {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudState) => void;
  onPauseRequest: () => void;
  onContextLost: (lost: boolean) => void;
  onOpenSmartCityDashboard?: () => void;
  onOpenScienceDistrict?: () => void;
}

export class ShooterEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private isSoftwareGl: boolean;
  private initialized = false;
  private builtQuality = DEFAULT_HUD_SETTINGS.graphicsQuality;

  private textures: ProceduralTextureSet | null = null;
  private materials: MaterialLibrary | null = null;
  private arena: BuiltArena | null = null;
  private arenaColliderGrid: ColliderSpatialGrid | null = null;
  private baseCameraFar = 300;

  // Lighting
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private muzzleLight: THREE.PointLight;
  private explosionLight: THREE.PointLight;

  // Player state
  private playerPos = new THREE.Vector3(0, 0, 18);
  private playerVel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private recoilPitchOffset = 0;
  private recoilYawOffset = 0;
  private screenShake = 0;
  private isGrounded = true;
  private wasGrounded = true;
  private landImpulse = 0;
  private smoothedEyeY = 1.62;
  private smoothedGroundY = 0;
  private smoothedEyeOffset = 1.62;
  private smoothThirdCamArm = 4.1;
  private lastShadowX = 0;
  private lastShadowY = 0;
  private lastShadowZ = 0;
  private thirdPersonCamInit = false;
  private flinchTimer = 0;
  private flinchDir = 1;
  private staggerTimer = 0;
  private crouchBlend = 0;
  private isCrouchToggle = false;
  private slideTimer = 0;
  private slideDuration = 0.55;
  private slideRollBlend = 0;
  private slideDustAccum = 0;
  private slideDir = new THREE.Vector3();
  private adsBlend = 0;
  private sprintBlend = 0;
  private walkBobPhase = 0;
  private walkBobWeight = 0;
  private footstepAccum = 0;
  private currentlySprinting = false;
  private runModeEnabled = false;
  private weaponSwayX = 0;
  private weaponSwayY = 0;
  private animState: PlayerAnimState = 'idle';

  // Cover & Peeking
  private isInCover = false;
  private coverWallHeight = 0;
  private peekDir: -1 | 0 | 1 = 0;
  private peekBlend = 0;

  // Tactical Doorway Breach
  private nearDoorway: DoorwayTrigger | null = null;
  private breachTimer = 0;
  private breachTotal = 0.95;
  private activeBreachDoorway: DoorwayTrigger | null = null;
  private breachStartPos = new THREE.Vector3();
  private breachEndPos = new THREE.Vector3();
  private breachBaseYaw = 0;

  // Grenade Throw Animation
  private grenadeAnimTimer = 0;
  private grenadeAnimDuration = 0.58;
  private grenadePinPulled = false;
  private grenadeReleased = false;
  private doorCloseAnimTimer = 0;

  private health = 100;
  private maxHealth = 100;
  private timeSinceDamage = 999;
  private isRecoveringHealth = false;
  private armor = 50;
  private maxArmor = 100;
  private stamina = 100;
  private grenades = 3;

  // Player rigs
  private weaponMount = new THREE.Group();
  private fpArms: FirstPersonArmsRig | null = null;
  private viewModels: Partial<Record<WeaponId, WeaponViewModel>> = {};
  private muzzleFlashTimer = 0;
  private playerThirdPersonRig: SoldierRig | null = null;

  // Game mode, lobby customization & match state
  private phase: GamePhase = 'menu';
  private worldSystem: WorldSystem = 'simulator';
  private envCycle = new EnvironmentCycleController();
  private envSnapshot: EnvironmentLightingSnapshot = computeEnvironmentSnapshot(0.34, 'clear', 1);
  private envCycleCustomized = false;
  private lastSkyUpdateKey = '';
  private bikeStyle: BikeStyleId = 'volt_green';
  private nearInteractable: WorldInteractable | null = null;
  private interactFeedback: string | null = null;
  private interactFeedbackTimer = 0;
  private rainMesh: THREE.InstancedMesh | null = null;
  private rainPositions: Float32Array | null = null;
  private rainMat: THREE.MeshBasicMaterial | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private usePostProcessing = false;
  private mapId: MapId = 'simulator_city';
  private dropSector: DropSector = 'west';
  private loadoutConfig: LoadoutConfig = { ...DEFAULT_LOADOUT_CONFIG };
  private lobbyViewMode: LobbyViewMode = 'overview';
  private lobbyInspectYaw = 0;
  private lobbyBikeZoom = 1.0;
  private lobbyWeaponInspectYaw = 0.65;
  private lobbyWeaponInspectPitch = 0.14;
  private lobbyPreviewItem: WeaponId | 'grenade' = 'm4a1';
  private lobbyCamPos = new THREE.Vector3(-4.6, 2.2, 19.6);
  private lobbyCamLook = new THREE.Vector3(-8.0, 1.15, 14.0);
  private lobbyCamInitialized = false;
  private lobbyShowcaseGroup = new THREE.Group();
  private lobbyBikeGroup: THREE.Group | null = null;
  private lobbyBikeBuiltStyle: BikeStyleId | null = null;
  private lobbyWeaponMeshes: Partial<Record<WeaponId | 'grenade', THREE.Group>> = {};
  private difficulty: Difficulty = 'veteran';
  private perspective: CameraPerspective = 'first';
  private highScore = 0;
  private hudSettings: HudSettings = { ...DEFAULT_HUD_SETTINGS };
  private isMobileDevice = false;

  private score = 0;
  private kills = 0;
  private headshots = 0;
  private streak = 0;
  private bestStreak = 0;
  private combo = 1;
  private comboTimer = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private elapsedTime = 0;

  // Weapon state
  private activeWeapon: WeaponId = 'm4a1';
  private sniperZoomIndex = 3; // defaults to 10x sniper lens zoom
  private weaponZoomIndices: Record<WeaponId, number> = createWeaponRecord((wid) =>
    wid === 'sniper' ? 3 : 0,
  );
  private recoilKickZ = 0;
  private recoilRoll = 0;
  private gunFovPunch = 0;
  private reloadSlapBump = 0;
  private fireModes: Record<WeaponId, FireMode> = createWeaponRecord(
    (wid) => WEAPONS[wid].defaultFireMode,
  );
  private ammoInMag: Record<WeaponId, number> = createWeaponRecord(
    (wid) => WEAPONS[wid].magSize,
  );
  private reserveAmmo: Record<WeaponId, number> = createWeaponRecord(
    (wid) => WEAPONS[wid].maxReserve,
  );
  private fireCooldown = 0;
  private burstShotsRemaining = 0;
  private burstShotTimer = 0;
  private shotAnimTimer = 0;
  private shotAnimDuration = 0;
  private headshotSeq = 0;
  private lastHeadshotAt = -10;
  private isReloading = false;
  private reloadTimer = 0;
  private reloadDuration = 1.5;
  private reloadMagDropped = false;
  private reloadBoltRacked = false;
  private reloadStage = '';
  private radarObstacles: RadarObstacle[] = [];

  // Actors & VFX pools
  private tracers: TracerEffect[] = [];
  private shells: ShellCasing[] = [];
  private droppingMags: ShellCasing[] = [];
  private particles: ImpactParticle[] = [];
  private smokePuffs: SmokePuff[] = [];
  private explosions: ExplosionFlash[] = [];
  private shockRings: ShockRingEffect[] = [];
  private waterSplashes: WaterSplashDroplet[] = [];
  private waterRipples: WaterRipple[] = [];
  private sandPuffs: SandPuff[] = [];
  private rockets: RocketProjectile[] = [];
  private thrownGrenades: ThrownGrenade[] = [];
  private vfxPoolsInitialized = false;
  private killFeed: KillFeedEntry[] = [];
  private nextKillFeedId = 1;
  private activeThreats: ActiveThreat[] = [];
  private nextThreatId = 1;

  // Shared VFX geometries & cached materials
  private tracerGeo = new THREE.BoxGeometry(0.04, 0.04, 1.35);
  private tracerMatCache = new Map<number, THREE.MeshBasicMaterial>();
  private shellGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.032, 6);
  private shellMat = new THREE.MeshStandardMaterial({
    color: 0xd9a74a,
    metalness: 0.9,
    roughness: 0.25,
  });
  private droppingMagGeo = new THREE.BoxGeometry(0.032, 0.11, 0.052);
  private droppingMagMat = new THREE.MeshStandardMaterial({
    color: 0x1e222b,
    metalness: 0.6,
    roughness: 0.45,
  });
  private particleGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  private particleMatCache = new Map<number, THREE.MeshBasicMaterial>();
  private smokeGeo = new THREE.DodecahedronGeometry(0.11, 1);
  private smokeMats = [0xd4d4d8, 0xc4c4ca, 0xe4e4e7, 0xb4b8be].map(
    (c) =>
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
  );
  private waterSplashGeo = new THREE.SphereGeometry(0.068, 5, 4);
  private waterSplashMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  private waterFoamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  private waterRippleGeo = (() => {
    const g = new THREE.RingGeometry(0.45, 1.0, 20);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  private sandPuffGeo = new THREE.DodecahedronGeometry(0.12, 0);
  private grenadeGeo = new THREE.SphereGeometry(0.11, 10, 10);
  private grenadeMat = new THREE.MeshStandardMaterial({
    color: 0x3f4f32,
    roughness: 0.65,
    metalness: 0.35,
  });
  private explosionGeo = new THREE.SphereGeometry(1, 16, 12);
  private shockRingGeo = (() => {
    const g = new THREE.RingGeometry(0.68, 1.0, 28);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  private rocketBodyGeo = (() => {
    const g = new THREE.CylinderGeometry(0.055, 0.045, 0.42, 10);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  private rocketConeGeo = (() => {
    const g = new THREE.ConeGeometry(0.068, 0.18, 10);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  private rocketFlameGeo = (() => {
    const g = new THREE.ConeGeometry(0.065, 0.36, 8);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  private rocketBodyMat = new THREE.MeshStandardMaterial({
    color: 0x4b563c,
    roughness: 0.5,
    metalness: 0.45,
  });
  private rocketConeMat = new THREE.MeshStandardMaterial({
    color: 0xdc1e28,
    roughness: 0.35,
    metalness: 0.55,
  });
  private rocketFlameMat = new THREE.MeshBasicMaterial({
    color: 0xff9f1c,
    transparent: true,
    opacity: 0.92,
  });
  private bulletHoleGeo = new THREE.PlaneGeometry(0.15, 0.15);
  private bulletHoleMat: THREE.MeshBasicMaterial | null = null;
  private bulletHoles: BulletHoleDecal[] = [];
  private bulletHoleCursor = 0;

  private wantedState: WantedLevelState = createWantedLevelState();
  private wantedSyncTimer = 0;
  private killSlowMoTimer = 0;
  private rimSparkTimer = 0;
  private bloodPoolGeo = (() => {
    const g = new THREE.CircleGeometry(1, 16);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  private bloodPoolMat = new THREE.MeshBasicMaterial({
    color: 0x6b050b,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  private bloodPools: Array<{ mesh: THREE.Mesh; age: number; maxRadius: number; startRadius: number }> = [];
  private shardGeo = new THREE.BoxGeometry(0.11, 0.015, 0.085);
  private shardMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.8,
  });
  private glassShards: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3; life: number; active: boolean }> = [];
  private puffGeo = new THREE.SphereGeometry(0.11, 6, 5);
  private puffMat = new THREE.MeshBasicMaterial({
    color: 0xf1f5f9,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  private tirePuffs: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number; active: boolean }> = [];

  // Feedback & telemetry state
  private hitMarker: 'none' | 'body' | 'head' | 'kill' = 'none';
  private hitMarkerTimer = 0;
  private damageFlash = 0;
  private currentFps = 60;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private adaptiveTier: 0 | 1 | 2 = 0;
  private adaptiveSampleTime = 0;
  private adaptiveSampleFrames = 0;
  private adaptiveHighFpsTime = 0;
  private adaptiveDistMul = 1.0;
  private cachedNearbyRadarObstacles: Array<{ cx: number; cz: number; w: number; d: number }> = [];
  private lastRadarFilterX = 99999;
  private lastRadarFilterZ = 99999;
  private smartCityAimTick = 0;
  private lastSmartCityAimTarget: SmartCityAimTargetInfo | null = null;
  private aimDistance = 0;

  // Android Touch Input State
  private isAdsToggle = false;
  private touchMoveVec = { x: 0, y: 0 };
  private touchFiring = false;

  // Drivable Vehicles, Drone Map Camera & Custom Drop Target
  private vehicleManager: VehicleManager;
  private activeVehicleId: string | null = null;
  private vehicleCameraMode: VehicleCameraMode = 'outer';
  private vehicleTurretFlashTimer = 0;
  private driveLookYaw = 0;
  private driveLookPitch = 0;
  private crosshairBloom = 0;
  private vehicleInput: VehicleInputState = {
    throttle: 0,
    steer: 0,
    ascend: false,
    descend: false,
  };
  private actionCrashCamTimer = 0;
  private actionCrashCamSide = 1;
  private actionCrashCamTarget = new THREE.Vector3();
  private mansionBlockedReason: string | null = null;
  private mansionBlockedTimer = 0;
  private mansionAudioVehicleId: string | null = null;
  private vehicleAudioDelayTimer = 0;
  private helipadTracker: HelipadTrackerState = { vacatedAtSec: {} };
  private seatedSpot: MansionSeatSpot | null = null;
  private seatedYaw = 0;
  private electricSparks: ElectricSparkQuad[] = [];
  private electricSparkGeo = new THREE.PlaneGeometry(1, 1);
  private electricSparkVideo: HTMLVideoElement | null = null;
  private electricSparkTex: THREE.Texture | null = null;
  private electricSparkVideoFailed = false;
  private radiatorSmokeTimer = 0;
  private bikeEjectTimer = 0;
  private bikeEjectDuration = 1.45;
  private bikeEjectVel = new THREE.Vector3();
  private bikeEjectSpin = 0;
  private bikeEjectImpactYaw = 0;
  private bikeEjectSparkTimer = 0;
  private swimState: SwimPhysicsState = {
    y: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    isSwimming: false,
  };
  private swimStrokeTimer = 0;
  private underwaterFogBlend = 0;
  private droneCenter = new THREE.Vector2(8, 0);
  private droneZoom = 1.0;
  private droneOrbitYaw = 0.72;
  private customDropTarget: CustomDropTarget | null = null;
  private dropBeaconGroup: THREE.Group | null = null;
  private raceNextGateIdx = 0;
  private raceLapStartTime = 0;
  private raceBestLapSec = 0;
  private simCredits = 1500;
  private simPurchasedItems: Record<string, number> = {};
  private simStuntsCompleted = 0;
  private simRacesCompleted = 0;
  private simVisitedDistricts = new Set<string>();
  private simLastDistrict = '';

  // Achievement Tracking
  private grenadeKills = 0;
  private weaponKillTypes = new Set<WeaponId>();

  // Desktop Keyboard Input State
  private keysHeld = new Set<string>();

  // Loop management
  private clock = new THREE.Clock();
  private frameId = 0;
  private hudSyncTimer = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.isMobileDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900);

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && !this.isMobileDevice,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const aspect =
      (container.clientWidth || window.innerWidth) /
      Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(74, aspect, 0.08, 1400);
    this.scene.add(this.camera);

    this.hemiLight = new THREE.HemisphereLight(0xc8e4ff, 0x4b4335, 0.58);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 1.55);
    this.keyLight.position.set(42, 68, 34);
    this.keyLight.shadow.camera.near = 5;
    this.keyLight.shadow.camera.far = 165;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0x7cc4fa, 0.36);
    this.rimLight.position.set(-45, 30, -40);
    this.scene.add(this.rimLight);

    this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 14, 2);
    this.camera.add(this.muzzleLight);

    this.explosionLight = new THREE.PointLight(0xff6b1a, 0, 34, 1.8);
    this.scene.add(this.explosionLight);

    this.camera.add(this.weaponMount);
    this.vehicleManager = new VehicleManager(this.scene, this.isSoftwareGl);
    this.applyGraphicsQuality();
    this.bindEvents();
  }

  private yieldFrame(): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const timer = window.setTimeout(finish, 40);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          window.clearTimeout(timer);
          finish();
        });
      }
    });
  }

  /**
   * Real progressive asset initializer: preloads loading artwork & audio MP3 clips,
   * builds PMREM studio reflections, mode-specific procedural PBR textures, 6 weapon
   * viewmodels, articulated rigs, arena compound, and compiles WebGL shaders cleanly.
   */
  public async initializeAssets(onProgress: (p: LoadProgress) => void): Promise<void> {
    if (this.initialized || this.disposed) return;

    const report = (progress: number, stage: string, detail: string) => {
      if (!this.disposed) {
        onProgress({ progress: Math.min(100, Math.max(0, progress)), stage, detail });
      }
    };

    report(4, 'Initializing Graphics', 'Preparing Android WebGL2 viewport...');
    await this.yieldFrame();
    if (this.disposed) return;

    // 1. Ensure loading visual + audio sample bank are genuinely loaded with timeout safety
    report(10, 'Loading Assets', 'Caching loading screen & weapon sound bank...');
    const preloadArt = new Promise<void>((resolve) => {
      const img = new Image();
      const t = window.setTimeout(resolve, 3500);
      img.onload = () => {
        window.clearTimeout(t);
        resolve();
      };
      img.onerror = () => {
        window.clearTimeout(t);
        resolve();
      };
      img.src = './assets/aistudio/23332-50kb_a46294ed.jpeg';
    });

    await Promise.all([
      preloadArt,
      soundEngine.preloadAllSamples((loaded, total, label) => {
        const pct = 12 + (loaded / Math.max(1, total)) * 34;
        report(pct, 'Loading Audio Bank', `${label} (${loaded}/${total})`);
      }),
    ]);
    if (this.disposed) return;

    const gfxInit = resolveGraphicsProfile(this.hudSettings, this.isSoftwareGl);
    const wantReflections = gfxInit.reflectionQuality !== 'off' && !this.isSoftwareGl;
    if (wantReflections) {
      report(50, 'Lighting & IBL', 'Baking studio environment reflection map...');
      await this.yieldFrame();
      if (this.disposed) return;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      this.envRT = pmrem.fromScene(roomEnv, 0.04);
      roomEnv.dispose();
      pmrem.dispose();
    }
    this.scene.environment = wantReflections && this.envRT ? this.envRT.texture : null;
    this.scene.environmentIntensity = gfxInit.reflectionQuality === 'high' ? 0.42 : 0.24;

    // 3. Generate procedural textures & shader materials for active quality tier
    const q = gfxInit.mapQuality;
    const texQ = gfxInit.textureQuality;
    this.builtQuality = q;
    report(62, 'Procedural Textures', `Generating ${texQ.toUpperCase()} surface maps...`);
    await this.yieldFrame();
    if (this.disposed) return;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso, texQ);
    this.materials = createMaterialLibrary(this.textures, this.isSoftwareGl, q);
    this.bulletHoleMat?.dispose();
    this.bulletHoleMat = new THREE.MeshBasicMaterial({
      map: this.textures.bulletHoleTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    // 4. Build 6 composite weapons step by step so progress updates smoothly
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      if (this.disposed) return;
      const wid = WEAPON_ORDER[i];
      report(
        70 + ((i + 1) / WEAPON_ORDER.length) * 14,
        'Building Arsenal',
        `Assembling ${WEAPONS[wid].name}...`,
      );
      const vm = buildWeaponModel(wid, this.materials);
      vm.group.visible = wid === this.activeWeapon;
      this.weaponMount.add(vm.group);
      this.viewModels[wid] = vm;
      if (i % 2 === 1) await this.yieldFrame();
    }

    if (this.disposed) return;
    report(86, 'Character Rigs', 'Building 1st & 3rd-person operator rigs...');
    this.fpArms = buildFirstPersonArms(this.materials);
    this.fpArms.group.visible = false;
    this.camera.add(this.fpArms.group);

    this.playerThirdPersonRig = buildSoldierModel('player', this.materials, this.isSoftwareGl);
    this.playerThirdPersonRig.root.visible = true;
    this.scene.add(this.playerThirdPersonRig.root);
    this.buildLobbyShowcase();
    this.applyLoadoutMaterials();
    await this.yieldFrame();

    // 5. Build Compound Arena & Static Colliders
    if (this.disposed) return;
    report(91, 'Constructing Arena', 'Building Simulator City landmarks, roads & districts...');
    await this.yieldFrame();
    if (this.disposed) return;
    this.arena = buildArena(
      this.scene,
      this.textures,
      this.materials,
      this.isSoftwareGl,
      this.mapId,
      q,
    );
    this.arenaColliderGrid = createColliderSpatialGrid(this.arena.colliders, 24);
    this.refreshRadarObstacles();
    this.syncModeLights(this.mapId);

    // 6. Compile shaders upfront with timeout guard to avoid gameplay stutter
    report(96, 'Optimizing Shaders', 'Pre-compiling WebGL shaders for smooth FPS...');
    await this.yieldFrame();
    if (!this.disposed && !this.isSoftwareGl) {
      const rAny = this.renderer as THREE.WebGLRenderer & {
        compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<void>;
      };
      if (typeof rAny.compileAsync === 'function') {
        await Promise.race([
          rAny.compileAsync(this.scene, this.camera).catch(() => {}),
          new Promise<void>((res) => window.setTimeout(res, 2500)),
        ]);
      } else {
        this.renderer.compile(this.scene, this.camera);
      }
    }

    if (this.disposed) return;
    this.initialized = true;
    this.applyGraphicsQuality();
    this.weaponMount.visible = false;
    this.syncLobbyPreviewState();
    this.clock.start();
    this.tick();
    report(100, 'Deployment Ready', 'All local simulator systems ready.');
  }

  public setHudSettings(settings: HudSettings) {
    const prevProfile = resolveGraphicsProfile(this.hudSettings, this.isSoftwareGl);
    const nextProfile = resolveGraphicsProfile(settings, this.isSoftwareGl);
    this.hudSettings = { ...settings };
    const visualChanged =
      prevProfile.preset !== nextProfile.preset ||
      prevProfile.bloomEnabled !== nextProfile.bloomEnabled ||
      prevProfile.mapSaturation !== nextProfile.mapSaturation ||
      prevProfile.shadowQuality !== nextProfile.shadowQuality ||
      prevProfile.lightingQuality !== nextProfile.lightingQuality ||
      prevProfile.reflectionQuality !== nextProfile.reflectionQuality ||
      prevProfile.textureQuality !== nextProfile.textureQuality ||
      prevProfile.mapQuality !== nextProfile.mapQuality ||
      prevProfile.drawDistance !== nextProfile.drawDistance;

    if (visualChanged) {
      this.adaptiveTier = 0;
      this.adaptiveSampleTime = 0;
      this.adaptiveSampleFrames = 0;
      this.adaptiveHighFpsTime = 0;
      this.applyGraphicsQuality();
      if (prevProfile.mapQuality !== nextProfile.mapQuality || prevProfile.preset !== nextProfile.preset) {
        this.arena?.realisticTargets?.grass?.setQuality(nextProfile.mapQuality, this.isSoftwareGl);
      }
      if (
        this.initialized &&
        this.phase === 'menu' &&
        (prevProfile.mapQuality !== nextProfile.mapQuality ||
          prevProfile.textureQuality !== nextProfile.textureQuality ||
          prevProfile.preset !== nextProfile.preset)
      ) {
        this.rebuildWorld(this.mapId);
      }
    }
  }

  private renderFrame() {
    this.camera.updateMatrixWorld();
    const isMapLobby = this.phase === 'menu' && this.lobbyViewMode === 'map';
    const isSniperScope =
      this.phase === 'playing' && this.activeWeapon === 'sniper' && this.adsBlend > 0.45;
    const gfx = resolveGraphicsProfile(this.hudSettings, this.isSoftwareGl);
    const distMul = (isMapLobby ? 3.2 : isSniperScope ? 2.1 : this.adaptiveDistMul) * gfx.drawDistance;

    const streaming = this.arena?.worldStreaming;
    if (streaming) {
      streaming.update(this.camera, this.playerPos, distMul, isMapLobby, gfx.mapQuality);
    }

    const lodGroups = this.arena?.dayNightTargets?.lodDetailGroups;
    const hasWaters = Boolean(this.arena?.realisticTargets?.waters?.length);
    if ((!streaming && lodGroups && lodGroups.length > 0) || hasWaters) {
      _camProjScreenMat.multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse,
      );
      _camFrustum.setFromProjectionMatrix(_camProjScreenMat);
      const px = this.camera.position.x;
      const pz = this.camera.position.z;
      const py = this.playerPos.y;

      if (!streaming && lodGroups) {
        for (let i = 0; i < lodGroups.length; i++) {
          const lg = lodGroups[i];
          const sphereR = lg.radius ?? Math.min(54, lg.maxDist * 0.65);
          const effMaxDist = lg.maxDist * distMul + sphereR;
          const dx = lg.x - px;
          const dz = lg.z - pz;
          if (dx * dx + dz * dz > effMaxDist * effMaxDist) {
            lg.group.visible = false;
            continue;
          }
          _lodSphere.center.set(lg.x, lg.y ?? py, lg.z);
          _lodSphere.radius = sphereR;
          lg.group.visible = _camFrustum.intersectsSphere(_lodSphere);
        }
      }

      const waters = this.arena?.realisticTargets?.waters;
      if (waters && waters.length > 0) {
        for (let w = 0; w < waters.length; w++) {
          const wm = waters[w].mesh;
          if (isMapLobby) {
            wm.visible = true;
            continue;
          }
          if (!wm.geometry.boundingSphere) {
            wm.geometry.computeBoundingSphere();
          }
          const bsR = wm.geometry.boundingSphere?.radius ?? 220;
          const dx = wm.position.x - px;
          const dz = wm.position.z - pz;
          const maxWaterDist = 560 * distMul + bsR;
          if (dx * dx + dz * dz > maxWaterDist * maxWaterDist) {
            wm.visible = false;
            continue;
          }
          _lodSphere.center.copy(wm.position);
          _lodSphere.radius = bsR;
          wm.visible = _camFrustum.intersectsSphere(_lodSphere);
        }
      }
    }
    if (this.usePostProcessing && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private applyGraphicsQuality() {
    const gfx = resolveGraphicsProfile(this.hudSettings, this.isSoftwareGl);
    const sat = gfx.mapSaturation;
    // Keep ACES Filmic exposure balanced so white surfaces retain shading instead of clipping to pure white
    this.renderer.toneMappingExposure = THREE.MathUtils.clamp(0.94 + (sat - 1.38) * 0.14, 0.8, 1.08);

    const q = gfx.preset;
    const isLow = q === 'low' || this.isSoftwareGl;
    const isMed = q === 'medium' && !this.isSoftwareGl;
    const isHigh = q === 'high' && !this.isSoftwareGl;
    this.adaptiveTier = 0;
    this.adaptiveDistMul = (isLow ? 0.45 : isMed ? 0.65 : 1.0) * gfx.drawDistance;

    const dpr = window.devicePixelRatio || 1;
    let targetRatio = 1;
    if (isLow) {
      targetRatio = this.isSoftwareGl ? 0.8 : Math.min(dpr, 0.85);
    } else if (isHigh) {
      targetRatio = Math.min(dpr, 1.75);
    } else {
      targetRatio = Math.min(dpr, 1.15);
    }
    this.renderer.setPixelRatio(targetRatio);

    const wantReflections = gfx.reflectionQuality !== 'off' && !this.isSoftwareGl;
    if (wantReflections && !this.envRT) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      this.envRT = pmrem.fromScene(roomEnv, 0.04);
      roomEnv.dispose();
      pmrem.dispose();
    }
    this.scene.environment = wantReflections ? (this.envRT?.texture ?? null) : null;
    this.scene.environmentIntensity = gfx.reflectionQuality === 'high' ? 0.42 : 0.24;

    const shadowsOn =
      !this.isSoftwareGl &&
      gfx.shadowQuality !== 'off' &&
      (gfx.shadowQuality === 'high' || gfx.shadowQuality === 'medium' || !this.isMobileDevice);
    this.renderer.shadowMap.enabled = shadowsOn;
    this.keyLight.castShadow = shadowsOn;
    const nextShadowType = gfx.shadowQuality === 'high' ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    if (this.renderer.shadowMap.type !== nextShadowType) {
      this.renderer.shadowMap.type = nextShadowType;
      this.renderer.shadowMap.needsUpdate = true;
    }

    const mapSize = gfx.shadowQuality === 'high' ? 1536 : gfx.shadowQuality === 'medium' ? 1024 : 512;
    if (this.keyLight.shadow.mapSize.x !== mapSize) {
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
      this.keyLight.shadow.mapSize.set(mapSize, mapSize);
    }

    const frustum = gfx.shadowQuality === 'high' ? 60 : gfx.shadowQuality === 'medium' ? 46 : 34;
    this.keyLight.shadow.camera.left = -frustum;
    this.keyLight.shadow.camera.right = frustum;
    this.keyLight.shadow.camera.top = frustum;
    this.keyLight.shadow.camera.bottom = -frustum;
    this.keyLight.shadow.camera.updateProjectionMatrix();

    const baseFar =
      this.phase === 'menu' && this.lobbyViewMode === 'map'
        ? 1650
        : isLow
          ? 420
          : isHigh
            ? 1400
            : 680;
    const nextFar = Math.round(baseFar * gfx.drawDistance);
    this.baseCameraFar = nextFar;
    if (this.camera.far !== nextFar) {
      this.camera.far = nextFar;
      this.camera.updateProjectionMatrix();
    }
    this.rimLight.visible = gfx.lightingQuality !== 'low' && !this.isSoftwareGl;
    this.muzzleLight.visible = gfx.lightingQuality === 'high' && !this.isSoftwareGl;
    this.explosionLight.visible = gfx.lightingQuality !== 'low' && !this.isSoftwareGl;

    const grass = this.arena?.realisticTargets?.grass;
    if (grass) {
      grass.setQuality(gfx.mapQuality, this.isSoftwareGl);
      grass.mesh.visible = true;
    }

    const enableBloom = !this.isSoftwareGl && gfx.bloomEnabled && (isHigh || isMed);
    this.usePostProcessing = enableBloom;
    if (enableBloom) {
      const w = this.container.clientWidth || window.innerWidth;
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);
      if (!this.composer) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.16, 0.32, 1.28);
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(new OutputPass());
      }
      this.composer.setPixelRatio(targetRatio);
      this.composer.setSize(w, h);
    }
  }

  private refreshRadarObstacles() {
    this.lastRadarFilterX = 99999;
    this.lastRadarFilterZ = 99999;
    if (!this.arena) {
      this.radarObstacles = [];
      this.cachedNearbyRadarObstacles = [];
      return;
    }
    this.radarObstacles = this.arena.colliders
      .map((c) => ({
        cx: (c.minX + c.maxX) * 0.5,
        cz: (c.minZ + c.maxZ) * 0.5,
        w: c.maxX - c.minX,
        d: c.maxZ - c.minZ,
        minY: c.minY,
        maxY: c.maxY,
      }))
      .filter((o) => o.maxY > 0.7 && o.minY < 3.5 && Math.max(o.w, o.d) > 1.2 && o.w < 30 && o.d < 30)
      .map(({ cx, cz, w, d }) => ({ cx, cz, w, d }));
    this.cachedNearbyRadarObstacles = [];
  }

  private syncModeLights(_mapId: MapId = this.mapId) {
    this.hemiLight.color.setHex(0xdcf0ff);
    this.hemiLight.groundColor.setHex(0x52493a);
    this.hemiLight.intensity = 0.62;
    this.keyLight.color.setHex(0xfff5e0);
    this.keyLight.intensity = 1.62;
    this.rimLight.intensity = 0.38;
    this.scene.environmentIntensity = 0.4;
  }

  private applyLoadoutMaterials() {
    if (!this.materials) return;
    applyOperatorSkin(this.materials, this.loadoutConfig.operatorSkin);
    applyWeaponSkin(this.materials, this.loadoutConfig.weaponSkin);
  }

  private buildLobbyShowcase() {
    const sharedSet = this.materials?.sharedSet;
    if (this.lobbyShowcaseGroup.parent) {
      disposeObject3DResources(this.lobbyShowcaseGroup, sharedSet);
      this.scene.remove(this.lobbyShowcaseGroup);
    }
    this.lobbyShowcaseGroup = new THREE.Group();
    this.lobbyWeaponMeshes = {};
    if (!this.materials) return;

    WEAPON_ORDER.forEach((wid) => {
      const vm = buildWeaponModel(wid, this.materials!);
      const s =
        wid === 'pistol'
          ? 2.2
          : wid === 'smg'
            ? 1.78
            : wid === 'rocket' || wid === 'sniper' || wid === 'm249'
              ? 1.15
              : 1.45;
      vm.group.scale.setScalar(s);
      vm.group.rotation.y = Math.PI * 0.5;
      vm.group.position.set(wid === 'pistol' ? 0 : -0.1, 0, 0);
      vm.group.visible = this.lobbyPreviewItem === wid;
      this.lobbyShowcaseGroup.add(vm.group);
      this.lobbyWeaponMeshes[wid] = vm.group;
    });

    const grenadeMesh = buildGrenadePreviewModel(this.materials);
    grenadeMesh.scale.setScalar(1.65);
    grenadeMesh.visible = this.lobbyPreviewItem === 'grenade';
    this.lobbyShowcaseGroup.add(grenadeMesh);
    this.lobbyWeaponMeshes.grenade = grenadeMesh;

    this.lobbyShowcaseGroup.position.set(-8.0, 6.8, 14.0);
    this.lobbyShowcaseGroup.visible = this.phase === 'menu' && this.lobbyViewMode === 'weapon';
    this.scene.add(this.lobbyShowcaseGroup);
    this.buildLobbyBikeShowcase();
  }

  private buildLobbyBikeShowcase() {
    const sharedSet = this.materials?.sharedSet;
    if (this.lobbyBikeGroup) {
      disposeObject3DResources(this.lobbyBikeGroup, sharedSet);
      this.scene.remove(this.lobbyBikeGroup);
      this.lobbyBikeGroup = null;
    }
    const bikeContainer = new THREE.Group();
    const builtBike = buildDigitalBikeMesh(
      'lobby_showcase_bike',
      this.isSoftwareGl,
      this.arena?.displays ?? null,
      this.bikeStyle,
    );
    bikeContainer.add(builtBike.group);
    const activeStyle = BIKE_STYLES.find((b) => b.id === this.bikeStyle) ?? BIKE_STYLES[0];
    const plinthRing = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.72, 48),
      new THREE.MeshBasicMaterial({
        color: activeStyle.neonHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
        toneMapped: false,
      }),
    );
    plinthRing.rotation.x = -Math.PI / 2;
    plinthRing.position.y = 0.03;
    bikeContainer.add(plinthRing);

    const gy = this.arena ? this.arena.groundHeightAt(-5.4, 13.8) : 0;
    bikeContainer.position.set(-5.4, gy, 13.8);
    bikeContainer.visible = this.phase === 'menu' && (this.lobbyViewMode === 'bike' || this.lobbyViewMode === 'overview');
    this.scene.add(bikeContainer);
    this.lobbyBikeGroup = bikeContainer;
    this.lobbyBikeBuiltStyle = this.bikeStyle;
  }

  private syncLobbyPreviewState() {
    if (this.playerThirdPersonRig?.playerWeapons) {
      const pw = this.playerThirdPersonRig.playerWeapons;
      WEAPON_ORDER.forEach((wid) => {
        const mesh = pw[wid];
        if (mesh) mesh.visible = wid === this.loadoutConfig.startingWeapon;
      });
    }
    ([...WEAPON_ORDER, 'grenade'] as const).forEach((item) => {
      const m = this.lobbyWeaponMeshes[item];
      if (m) m.visible = this.lobbyPreviewItem === item;
    });
    this.lobbyShowcaseGroup.visible = this.phase === 'menu' && this.lobbyViewMode === 'weapon';
    if (this.lobbyBikeBuiltStyle !== this.bikeStyle && this.initialized) {
      this.buildLobbyBikeShowcase();
    }
    if (this.lobbyBikeGroup) {
      this.lobbyBikeGroup.visible =
        this.phase === 'menu' && (this.lobbyViewMode === 'bike' || this.lobbyViewMode === 'overview');
    }
  }

  private rebuildWorld(mapId: MapId = this.mapId) {
    this.clearDynamicEntities();

    const sharedSet = this.materials?.sharedSet;

    if (this.arena) {
      this.arena.dispose();
      this.arena = null;
    }
    if (this.playerThirdPersonRig) {
      disposeObject3DResources(this.playerThirdPersonRig.root, sharedSet);
      this.scene.remove(this.playerThirdPersonRig.root);
      this.playerThirdPersonRig = null;
    }
    if (this.fpArms) {
      disposeObject3DResources(this.fpArms.group, sharedSet);
      this.camera.remove(this.fpArms.group);
      this.fpArms = null;
    }
    if (this.lobbyShowcaseGroup.parent) {
      disposeObject3DResources(this.lobbyShowcaseGroup, sharedSet);
      this.scene.remove(this.lobbyShowcaseGroup);
    }
    if (this.lobbyBikeGroup) {
      disposeObject3DResources(this.lobbyBikeGroup, sharedSet);
      this.scene.remove(this.lobbyBikeGroup);
      this.lobbyBikeGroup = null;
      this.lobbyBikeBuiltStyle = null;
    }
    this.lobbyWeaponMeshes = {};

    Object.values(this.viewModels).forEach((vm) => {
      if (vm) {
        disposeObject3DResources(vm.group, sharedSet);
        this.weaponMount.remove(vm.group);
      }
    });
    this.viewModels = {};

    if (this.materials) {
      this.materials.dispose();
      this.materials = null;
    }
    if (this.textures) {
      this.textures.dispose();
      this.textures = null;
    }

    const q = this.hudSettings.graphicsQuality;
    this.builtQuality = q;
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso, q);
    this.materials = createMaterialLibrary(this.textures, this.isSoftwareGl, q);
    this.bulletHoleMat?.dispose();
    this.bulletHoleMat = new THREE.MeshBasicMaterial({
      map: this.textures.bulletHoleTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.arena = buildArena(
      this.scene,
      this.textures,
      this.materials,
      this.isSoftwareGl,
      mapId,
      q,
    );
    this.arenaColliderGrid = createColliderSpatialGrid(this.arena.colliders, 24);

    if (this.arena.vehicleSpawns && this.arena.vehicleSpawns.length > 0) {
      this.vehicleManager.spawnAll(this.arena.vehicleSpawns, this.arena.groundHeightAt);
    } else {
      this.vehicleManager.clear();
    }
    this.refreshDropBeacon();

    this.refreshRadarObstacles();
    this.syncModeLights(mapId);
    this.applyGraphicsQuality();

    WEAPON_ORDER.forEach((wid) => {
      const vm = buildWeaponModel(wid, this.materials!);
      vm.group.visible = wid === this.activeWeapon;
      this.weaponMount.add(vm.group);
      this.viewModels[wid] = vm;
    });

    this.fpArms = buildFirstPersonArms(this.materials);
    this.fpArms.group.visible = false;
    this.camera.add(this.fpArms.group);

    this.playerThirdPersonRig = buildSoldierModel('player', this.materials, this.isSoftwareGl);
    this.playerThirdPersonRig.root.visible = this.phase === 'menu';
    this.scene.add(this.playerThirdPersonRig.root);

    this.buildLobbyShowcase();
    this.applyLoadoutMaterials();
    this.syncLobbyPreviewState();
  }

  private clearDynamicEntities() {
    for (let i = 0; i < this.tracers.length; i++) {
      this.tracers[i].active = false;
      this.tracers[i].mesh.visible = false;
    }
    for (let i = 0; i < this.shells.length; i++) {
      this.shells[i].active = false;
      this.shells[i].mesh.visible = false;
    }
    for (let i = 0; i < this.droppingMags.length; i++) {
      this.droppingMags[i].active = false;
      this.droppingMags[i].mesh.visible = false;
    }
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
      this.particles[i].mesh.visible = false;
    }
    for (let i = 0; i < this.smokePuffs.length; i++) {
      this.smokePuffs[i].active = false;
      this.smokePuffs[i].mesh.visible = false;
    }
    for (let i = 0; i < this.explosions.length; i++) {
      this.explosions[i].active = false;
      this.explosions[i].mesh.visible = false;
    }
    for (let i = 0; i < this.shockRings.length; i++) {
      this.shockRings[i].active = false;
      this.shockRings[i].mesh.visible = false;
    }
    for (let i = 0; i < this.waterSplashes.length; i++) {
      this.waterSplashes[i].active = false;
      this.waterSplashes[i].mesh.visible = false;
    }
    for (let i = 0; i < this.waterRipples.length; i++) {
      this.waterRipples[i].active = false;
      this.waterRipples[i].mesh.visible = false;
    }
    for (let i = 0; i < this.sandPuffs.length; i++) {
      this.sandPuffs[i].active = false;
      this.sandPuffs[i].mesh.visible = false;
    }

    this.rockets.forEach((r) => {
      this.scene.remove(r.group);
    });
    this.rockets = [];

    this.thrownGrenades.forEach((g) => this.scene.remove(g.mesh));
    this.thrownGrenades = [];

    this.bulletHoles.forEach((d) => this.scene.remove(d.mesh));
    this.bulletHoles = [];
    this.bulletHoleCursor = 0;

    this.bloodPools.forEach((bp) => this.scene.remove(bp.mesh));
    this.bloodPools = [];
    this.doorCloseAnimTimer = 0;
    for (let i = 0; i < this.glassShards.length; i++) {
      this.glassShards[i].active = false;
      this.glassShards[i].mesh.visible = false;
    }
    for (let i = 0; i < this.tirePuffs.length; i++) {
      this.tirePuffs[i].active = false;
      this.tirePuffs[i].mesh.visible = false;
    }

    for (let i = 0; i < this.electricSparks.length; i++) {
      this.electricSparks[i].active = false;
      this.electricSparks[i].mesh.visible = false;
    }
    this.activeThreats = [];
    this.explosionLight.intensity = 0;
    this.activeVehicleId = null;
    this.seatedSpot = null;
    this.actionCrashCamTimer = 0;
    this.radiatorSmokeTimer = 0;
    this.bikeEjectTimer = 0;
    this.bikeEjectVel.set(0, 0, 0);
    this.raceNextGateIdx = 0;
    this.raceLapStartTime = 0;
    this.raceBestLapSec = 0;
    this.swimState = { y: 0, vx: 0, vy: 0, vz: 0, isSwimming: false };
    this.swimStrokeTimer = 0;
    this.underwaterFogBlend = 0;
    soundEngine.stopVehicleAudio();
    soundEngine.stopMansionPartyMusic();
    soundEngine.setSimulatorOutdoorAmbience(false);
    soundEngine.setAirFlowSound(false);
  }

  public startMatch(
    difficulty: Difficulty,
    perspective: CameraPerspective,
    existingHighScore: number,
    targetKills = 25,
    options?: {
      mapId?: MapId;
      dropSector?: DropSector;
      loadout?: LoadoutConfig;
      customDrop?: CustomDropTarget | null;
      worldSystem?: WorldSystem;
      initialTimePhase?: TimeOfDayPhase;
      initialWeather?: WeatherKind;
      autoEnvCycle?: boolean;
      bikeStyle?: BikeStyleId;
      initialYaw?: number;
      initialSimProgress?: {
        credits?: number;
        purchasedItems?: Record<string, number>;
        stuntsCompleted?: number;
        racesCompleted?: number;
        bestLapSec?: number | null;
        visitedDistricts?: string[];
      };
    },
  ) {
    soundEngine.unlock();
    this.worldSystem = 'simulator';
    if (options?.bikeStyle) this.bikeStyle = options.bikeStyle;
    this.mapId = 'simulator_city';
    if (options?.dropSector) this.dropSector = options.dropSector;
    if (options?.customDrop !== undefined) this.customDropTarget = options.customDrop;
    if (options?.loadout) {
      this.loadoutConfig = {
        ...options.loadout,
        preferredFireModes: { ...options.loadout.preferredFireModes },
      };
    }
    this.grenadeKills = 0;
    this.weaponKillTypes.clear();

    this.difficulty = difficulty;
    this.perspective = perspective;
    this.highScore = existingHighScore;
    this.nearInteractable = null;
    this.interactFeedback = null;
    this.interactFeedbackTimer = 0;
    this.raceNextGateIdx = 0;
    this.raceLapStartTime = 0;
    const savedSim = options?.initialSimProgress;
    this.raceBestLapSec = savedSim?.bestLapSec ?? 0;
    this.simCredits =
      typeof savedSim?.credits === 'number' && Number.isFinite(savedSim.credits)
        ? savedSim.credits
        : 1500;
    this.simPurchasedItems = savedSim?.purchasedItems ? { ...savedSim.purchasedItems } : {};
    this.simStuntsCompleted = savedSim?.stuntsCompleted ?? 0;
    this.simRacesCompleted = savedSim?.racesCompleted ?? 0;
    this.simVisitedDistricts = new Set(savedSim?.visitedDistricts ?? []);
    this.simLastDistrict = '';

    this.envCycle.reset(
      options?.initialTimePhase ?? 'morning',
      options?.initialWeather ?? 'clear',
      options?.autoEnvCycle ?? true,
    );
    this.envSnapshot = this.envCycle.getSnapshot();
    this.envCycleCustomized = true;
    this.lastSkyUpdateKey = '';

    this.rebuildWorld(this.mapId);
    this.ensureRainSystem();
    this.ensureElectricSparkPool();
    this.applyEnvironmentToScene(this.envSnapshot, 0);

    const startX = this.customDropTarget ? this.customDropTarget.x : MANSION_DEFAULT_SPAWN.x;
    const startZ = this.customDropTarget ? this.customDropTarget.z : MANSION_DEFAULT_SPAWN.z;

    const groundY = this.arena ? this.arena.groundHeightAt(startX, startZ, this.customDropTarget?.y ?? 0) : (this.customDropTarget?.y ?? 0);
    this.playerPos.set(startX, groundY, startZ);
    this.playerVel.set(0, 0, 0);
    const simPoiMatch = SIMULATOR_POIS.find(
      (p) => Math.abs(p.x - startX) < 1.5 && Math.abs(p.z - startZ) < 1.5,
    );
    const initialYaw =
      typeof options?.initialYaw === 'number' && Number.isFinite(options.initialYaw)
        ? options.initialYaw
        : (simPoiMatch?.viewYaw ?? MANSION_DEFAULT_SPAWN.viewYaw);
    this.mansionBlockedReason = null;
    this.mansionBlockedTimer = 0;
    this.mansionAudioVehicleId = null;
    this.vehicleAudioDelayTimer = 0;
    this.helipadTracker = { vacatedAtSec: {} };
    this.seatedSpot = null;
    this.swimState = { y: groundY, vx: 0, vy: 0, vz: 0, isSwimming: false };
    this.swimStrokeTimer = 0;
    this.underwaterFogBlend = 0;
    this.yaw = initialYaw;
    this.pitch = 0;
    this.targetYaw = initialYaw;
    this.targetPitch = 0;
    this.recoilPitchOffset = 0;
    this.recoilYawOffset = 0;
    this.crosshairBloom = 0;
    this.driveLookYaw = 0;
    this.driveLookPitch = 0;
    this.screenShake = 0;
    this.isGrounded = true;
    this.wasGrounded = true;
    this.landImpulse = 0;
    this.smoothedGroundY = groundY;
    this.smoothedEyeY = groundY + 1.62;
    this.smoothedEyeOffset = 1.62;
    this.smoothThirdCamArm = 4.1;
    this.lastShadowX = startX;
    this.lastShadowY = groundY;
    this.lastShadowZ = startZ;
    this.thirdPersonCamInit = false;
    this.flinchTimer = 0;
    this.staggerTimer = 0;
    this.crouchBlend = 0;
    this.isCrouchToggle = false;
    this.slideTimer = 0;
    this.slideRollBlend = 0;
    this.adsBlend = 0;
    this.sprintBlend = 0;
    this.walkBobPhase = 0;
    this.walkBobWeight = 0;
    this.weaponSwayX = 0;
    this.weaponSwayY = 0;
    this.animState = 'idle';
    this.isInCover = false;
    this.peekDir = 0;
    this.peekBlend = 0;
    this.nearDoorway = null;
    this.breachTimer = 0;
    this.activeBreachDoorway = null;
    this.grenadeAnimTimer = 0;
    this.grenadePinPulled = false;
    this.grenadeReleased = false;
    this.doorCloseAnimTimer = 0;
    this.isAdsToggle = false;

    this.health = 100;
    this.timeSinceDamage = 999;
    this.isRecoveringHealth = false;
    this.armor = 75;
    this.stamina = 100;
    this.grenades = 3;

    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.elapsedTime = 0;

    this.activeWeapon = normalizeWeaponId(this.loadoutConfig.startingWeapon);
    this.sniperZoomIndex = 3;
    this.weaponZoomIndices = createWeaponRecord((wid) => (wid === 'sniper' ? 3 : 0));
    this.recoilKickZ = 0;
    this.recoilRoll = 0;
    this.gunFovPunch = 0;
    this.reloadSlapBump = 0;
    this.fireModes = createWeaponRecord(
      (wid) => this.loadoutConfig.preferredFireModes[wid] ?? WEAPONS[wid].defaultFireMode,
    );
    WEAPON_ORDER.forEach((wid) => {
      const vm = this.viewModels[wid];
      if (vm) {
        vm.group.visible = wid === this.activeWeapon;
        vm.muzzleFlashGroup.visible = false;
      }
      if (!WEAPONS[wid].supportedFireModes.includes(this.fireModes[wid])) {
        this.fireModes[wid] = WEAPONS[wid].defaultFireMode;
      }
    });
    this.ammoInMag = createWeaponRecord((wid) => WEAPONS[wid].magSize);
    this.reserveAmmo = createWeaponRecord((wid) => WEAPONS[wid].maxReserve);
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadStage = '';
    this.fireCooldown = 0;
    this.burstShotsRemaining = 0;
    this.burstShotTimer = 0;
    this.shotAnimTimer = 0;
    this.shotAnimDuration = 0;
    this.headshotSeq = 0;
    this.lastHeadshotAt = -10;
    this.syncThirdPersonWeapon();
    this.applyLoadoutMaterials();
    this.lobbyShowcaseGroup.visible = false;

    this.killFeed = [];
    this.hitMarker = 'none';
    this.damageFlash = 0;
    this.wantedState = createWantedLevelState();
    this.wantedSyncTimer = 0;
    this.killSlowMoTimer = 0;
    this.rimSparkTimer = 0;

    if (this.camera.fov !== 74) {
      this.camera.fov = 74;
      this.camera.updateProjectionMatrix();
    }

    this.phase = 'playing';
    this.updateCameraRigVisibility();
    this.snapCameraAndRigImmediate();
    if (this.initialized) {
      this.renderFrame();
    }
    this.emitHud();
  }

  public setSimulatorEnvironment(opts: {
    timePhase?: TimeOfDayPhase;
    weather?: WeatherKind;
    autoCycle?: boolean;
    bikeStyle?: BikeStyleId;
  }) {
    const prevPhase = this.envSnapshot?.phase;
    if (opts.timePhase !== undefined) {
      this.envCycle.setPhase(opts.timePhase);
      this.envCycleCustomized = true;
    }
    if (opts.weather !== undefined) {
      this.envCycle.setWeather(opts.weather);
      this.envCycleCustomized = true;
    }
    if (opts.autoCycle !== undefined) {
      this.envCycle.autoCycle = opts.autoCycle;
      this.envCycleCustomized = true;
    }
    if (opts.bikeStyle !== undefined) {
      this.bikeStyle = opts.bikeStyle;
      if (this.phase === 'menu' && this.initialized) {
        this.buildLobbyBikeShowcase();
      }
    }
    this.envSnapshot = this.envCycle.getSnapshot();
    if (
      prevPhase === 'night' &&
      (this.envSnapshot.phase === 'morning' || this.envSnapshot.phase === 'afternoon')
    ) {
      this.arena?.npcManager?.triggerMansionPartyDeparture?.();
    }
    this.lastSkyUpdateKey = '';
    this.ensureRainSystem();
    this.applyEnvironmentToScene(this.envSnapshot, 0);
    this.emitHud();
  }

  public teleportToPoi(x: number, z: number, label?: string, viewYaw?: number) {
    if (this.phase !== 'playing' || !this.arena || this.worldSystem !== 'simulator') return;
    if (this.activeVehicleId) {
      this.activeVehicleId = null;
      soundEngine.stopVehicleAudio();
    }
    this.seatedSpot = null;
    this.swimState = { y: 0, vx: 0, vy: 0, vz: 0, isSwimming: false };
    this.swimStrokeTimer = 0;
    this.underwaterFogBlend = 0;
    const gy = this.arena.groundHeightAt(x, z, 0);
    this.playerPos.set(x, gy, z);
    this.playerVel.set(0, 0, 0);
    if (viewYaw !== undefined) {
      this.yaw = viewYaw;
      this.targetYaw = viewYaw;
      this.pitch = 0;
      this.targetPitch = 0;
    }
    this.smoothedGroundY = gy;
    this.smoothedEyeY = gy + 1.62;
    this.thirdPersonCamInit = false;
    this.snapCameraAndRigImmediate();
    if (this.initialized) {
      this.renderFrame();
    }
    if (label) {
      this.interactFeedback = `Arrived at ${label}`;
      this.interactFeedbackTimer = 3.0;
    }
    this.emitHud();
  }

  public buySimulatorItem(itemId: string): { ok: boolean; message: string } {
    if (this.worldSystem !== 'simulator') {
      return { ok: false, message: 'Shops are available in World Simulator Mode.' };
    }
    const item = SIM_SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item) return { ok: false, message: 'Item not found.' };
    if (this.simCredits < item.price) {
      this.interactFeedback = `Need ${item.price}₡ for ${item.name} (Have ${this.simCredits}₡)`;
      this.interactFeedbackTimer = 2.5;
      this.emitHud();
      return { ok: false, message: this.interactFeedback };
    }

    this.simCredits -= item.price;
    this.simPurchasedItems[item.id] = (this.simPurchasedItems[item.id] ?? 0) + 1;

    if (item.healHp > 0) this.health = Math.min(this.maxHealth, this.health + item.healHp);
    if (item.grantArmor > 0) this.armor = Math.min(this.maxArmor, this.armor + item.grantArmor);
    if (item.staminaRefill > 0) {
      this.stamina = Math.min(100, Math.max(this.stamina, item.staminaRefill));
    }
    if (item.id === 'nitro_tune_kit') {
      const veh = this.activeVehicleId
        ? this.vehicleManager.getById(this.activeVehicleId)
        : this.vehicleManager.findNearestAvailable(this.playerPos, 14.0);
      if (veh) {
        this.vehicleManager.repairVehicle(veh);
        veh.destroyed = false;
      }
    }

    soundEngine.playInteractChime(item.category === 'food' ? 'dine' : 'shop');
    this.interactFeedback = `Purchased ${item.name} (-${item.price}₡)`;
    this.interactFeedbackTimer = 2.8;
    this.emitHud();
    return { ok: true, message: this.interactFeedback };
  }

  public useSimulatorItem(itemId: string): { ok: boolean; message: string } {
    if (this.worldSystem !== 'simulator') {
      return { ok: false, message: 'Available in World Simulator Mode.' };
    }
    const count = this.simPurchasedItems[itemId] ?? 0;
    const item = SIM_SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item || count <= 0) {
      return { ok: false, message: 'No item in inventory.' };
    }
    this.simPurchasedItems[itemId] = count - 1;
    if (this.simPurchasedItems[itemId] <= 0) delete this.simPurchasedItems[itemId];

    if (item.healHp > 0) this.health = Math.min(this.maxHealth, this.health + item.healHp);
    if (item.grantArmor > 0) this.armor = Math.min(this.maxArmor, this.armor + item.grantArmor);
    if (item.staminaRefill > 0) {
      this.stamina = Math.min(100, Math.max(this.stamina, item.staminaRefill));
    }
    if (item.id === 'nitro_tune_kit') {
      const veh = this.activeVehicleId
        ? this.vehicleManager.getById(this.activeVehicleId)
        : this.vehicleManager.findNearestAvailable(this.playerPos, 14.0);
      if (veh) {
        this.vehicleManager.repairVehicle(veh);
        veh.destroyed = false;
      }
    }

    soundEngine.playInteractChime('dine');
    this.interactFeedback = `Used ${item.name}`;
    this.interactFeedbackTimer = 2.4;
    this.emitHud();
    return { ok: true, message: this.interactFeedback };
  }

  public triggerInteract() {
    if (this.phase !== 'playing') return;
    if (this.seatedSpot) {
      this.standUpFromSeat();
      return;
    }
    if (!this.nearInteractable) return;
    const item = this.nearInteractable;
    if (item.category === 'seat' && this.arena?.mansionSeats) {
      const seat = this.arena.mansionSeats.find((s) => s.id === item.id);
      if (seat) {
        seat.syncPosition?.();
        soundEngine.playInteractChime('dine');
        this.seatedSpot = seat;
        this.seatedYaw = seat.yaw;
        this.yaw = seat.yaw;
        this.targetYaw = seat.yaw;
        this.pitch = 0.02;
        this.targetPitch = 0.02;
        this.slideTimer = 0;
        this.isCrouchToggle = false;
        this.breachTimer = 0;
        this.isAdsToggle = false;
        this.touchMoveVec = { x: 0, y: 0 };
        this.playerVel.set(0, 0, 0);
        const floorY =
          seat.seatTag === 'transit_seat'
            ? seat.y - 0.48
            : this.arena.groundHeightAt(seat.x, seat.z, seat.y);
        this.playerPos.set(seat.x, floorY, seat.z);
        this.smoothedGroundY = floorY;
        this.smoothedEyeOffset = Math.max(1.05, seat.y - floorY + 0.72);
        this.smoothedEyeY = floorY + this.smoothedEyeOffset;
        if (seat.chairGroup) {
          seat.chairGroup.rotation.y = seat.yaw - Math.PI * 0.5;
        }
        this.interactFeedback =
          seat.seatTag === 'transit_seat'
            ? `Riding ${seat.label} — Look Around Freely, [E] Disembark`
            : seat.canRotateChair
              ? 'Seated — A/D or Stick to Rotate Chair, [E] Stand Up'
              : 'Seated — [E] Stand Up';
        this.interactFeedbackTimer = 3.2;
        this.snapCameraAndRigImmediate();
        this.emitHud();
        return;
      }
    }
    soundEngine.playInteractChime(
      item.category === 'dashboard' ? 'shop' : item.category === 'transit_door' ? 'door' : item.category,
    );
    if (item.category === 'dashboard') {
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      if (item.id.startsWith('sci_')) {
        if (item.id === 'sci_future_lab_portal') {
          this.arena?.scienceDistrict?.setActiveBuilding('future_lab');
        } else if (item.id === 'sci_museum_portal') {
          this.arena?.scienceDistrict?.setActiveBuilding('science_museum');
        } else {
          const domeId = item.id.slice(4) as ScienceDomeId;
          this.arena?.scienceDistrict?.setActiveBuilding(domeId);
        }
        this.callbacks.onOpenScienceDistrict?.();
      } else {
        this.callbacks.onOpenSmartCityDashboard?.();
      }
    }
    const feedback = item.trigger({
      healPlayer: (hp, stamina) => {
        this.health = Math.min(this.maxHealth, this.health + hp);
        this.stamina = Math.max(this.stamina, Math.min(100, stamina));
      },
      refuelNearbyVehicle: () => {
        const veh = this.activeVehicleId
          ? this.vehicleManager.getById(this.activeVehicleId)
          : this.vehicleManager.findNearestAvailable(this.playerPos, 9.0);
        if (!veh) return null;
        this.vehicleManager.repairVehicle(veh);
        veh.destroyed = false;
        return `${veh.spec.name} refueled & repaired (100%)`;
      },
      cycleBikeStyle: () => {
        const idx = BIKE_STYLES.findIndex((b) => b.id === this.bikeStyle);
        const next = BIKE_STYLES[(idx + 1) % BIKE_STYLES.length];
        this.bikeStyle = next.id;
        return next.name;
      },
      movePlayerTo: (x, y, z, yaw) => {
        this.seatedSpot = null;
        this.slideTimer = 0;
        this.isCrouchToggle = false;
        this.breachTimer = 0;
        this.playerVel.set(0, 0, 0);
        this.playerPos.set(x, y, z);
        if (yaw !== undefined) {
          this.yaw = yaw;
          this.targetYaw = yaw;
        }
        this.smoothedGroundY = y;
        this.smoothedEyeOffset = 1.62;
        this.smoothedEyeY = y + 1.62;
        this.isGrounded = true;
        this.snapCameraAndRigImmediate();
      },
      unlockShowroomCar: (kind, cost, spawnX, spawnZ, label) => {
        if (this.simCredits < cost) {
          return `Need ${cost}₡ to unlock ${label} (You have ${this.simCredits}₡)`;
        }
        this.simCredits -= cost;
        const gy = this.arena ? this.arena.groundHeightAt(spawnX, spawnZ, 0) : 0;
        this.vehicleManager.spawnDynamicVehicle(kind, spawnX, gy, spawnZ, 0, 'showroom');
        soundEngine.playInteractChime('shop');
        return `Unlocked ${label} for ${cost}₡! Parked outside Showroom ready to drive.`;
      },
    });
    const isShowroomBuy = item.id.startsWith('showroom_');
    if (!isShowroomBuy && (item.category === 'dine' || item.category === 'shop')) {
      this.simCredits += 25;
    }
    this.interactFeedback =
      !isShowroomBuy && (item.category === 'dine' || item.category === 'shop')
        ? `${feedback} (+25₡ Bonus)`
        : feedback;
    this.interactFeedbackTimer = 3.2;
    this.emitHud();
  }

  public sendSmartCityCommand(cmd: SmartCityCommand): void {
    const sc = this.arena?.smartCity;
    if (!sc) return;
    sc.applyCommand(cmd);
    if (cmd.type === 'repair_all') {
      soundEngine.playRepairWeld();
    } else {
      soundEngine.playInteractChime('shop');
    }
    this.emitHud();
  }

  public getSmartCityState(): SmartCitySimulationState | null {
    return this.arena?.smartCity?.getState() ?? null;
  }

  public sendScienceDistrictCommand(
    cmd:
      | { type: 'enter_future_lab' }
      | { type: 'enter_museum' }
      | { type: 'enter_dome'; domeId: ScienceDomeId }
      | { type: 'exit_building' }
      | { type: 'explore_department'; deptId: ScienceLabDepartmentId }
      | { type: 'toggle_dome_boost'; domeId: ScienceDomeId }
      | { type: 'toggle_lab_robots' }
      | { type: 'toggle_lab_overdrive' }
      | { type: 'set_elevator_floor'; floor: 1 | 2 | 3 },
  ): void {
    const sd = this.arena?.scienceDistrict;
    if (!sd) return;
    const moveInside = (x: number, y: number, z: number, yaw = 0) => {
      this.seatedSpot = null;
      this.slideTimer = 0;
      this.isCrouchToggle = false;
      this.breachTimer = 0;
      this.playerVel.set(0, 0, 0);
      this.playerPos.set(x, y, z);
      this.yaw = yaw;
      this.targetYaw = yaw;
      this.smoothedGroundY = y;
      this.smoothedEyeOffset = 1.62;
      this.smoothedEyeY = y + 1.62;
      this.isGrounded = true;
      this.snapCameraAndRigImmediate();
    };
    if (cmd.type === 'enter_future_lab') {
      sd.setActiveBuilding('future_lab');
      moveInside(64, 0.22, -598.5, 0);
      soundEngine.playInteractChime('door');
      this.interactFeedback = 'Entered Future Lab Atrium';
    } else if (cmd.type === 'enter_museum') {
      sd.setActiveBuilding('science_museum');
      moveInside(168, 0.22, -598.5, 0);
      soundEngine.playInteractChime('door');
      this.interactFeedback = 'Entered Science Museum Rotunda';
    } else if (cmd.type === 'enter_dome') {
      const dome = SCIENCE_DOMES_CATALOG.find((d) => d.id === cmd.domeId);
      if (dome) {
        sd.setActiveBuilding(dome.id);
        moveInside(dome.x, 0.56, dome.z + dome.radius - 1.35, dome.entryYaw);
        soundEngine.playInteractChime('door');
        this.interactFeedback = `Exploring ${dome.title}`;
      }
    } else if (cmd.type === 'exit_building') {
      sd.setActiveBuilding('exterior');
      moveInside(118, 0.25, -496, 0);
      soundEngine.playInteractChime('door');
      this.interactFeedback = 'Exited to Science Plaza Promenade';
    } else if (cmd.type === 'explore_department') {
      const dept = FUTURE_LAB_DEPARTMENTS.find((d) => d.id === cmd.deptId);
      if (dept) {
        sd.setActiveBuilding('future_lab');
        sd.setActiveDepartment(dept.id);
        moveInside(dept.x + (dept.x < 64 ? 3.5 : -3.5), dept.y + 0.25, dept.z + 1.5, dept.viewYaw);
        soundEngine.playInteractChime('shop');
        this.interactFeedback = `${dept.floor}F · ${dept.name}`;
      }
    } else if (cmd.type === 'toggle_dome_boost') {
      const on = sd.toggleDomeBoost(cmd.domeId);
      soundEngine.playInteractChime('shop');
      this.interactFeedback = on ? 'Exhibit Animation Activated' : 'Exhibit Normal Speed';
    } else if (cmd.type === 'toggle_lab_robots') {
      const on = sd.toggleLabRobots();
      soundEngine.playInteractChime('shop');
      this.interactFeedback = on ? 'Lab Humanoid Robots Active' : 'Lab Robots Docked';
    } else if (cmd.type === 'toggle_lab_overdrive') {
      const on = sd.toggleLabOverdrive();
      soundEngine.playInteractChime('shop');
      this.interactFeedback = on ? 'Reactor & Holograms Overclocked' : 'Standard Lab Power';
    } else if (cmd.type === 'set_elevator_floor') {
      sd.setActiveBuilding('future_lab');
      sd.setElevatorFloor(cmd.floor);
      moveInside(49, (cmd.floor - 1) * 5.6 + 0.25, -618, Math.PI * 0.5);
      soundEngine.playInteractChime('door');
      this.interactFeedback = `Glass Elevator · Level ${cmd.floor}F`;
    }
    this.interactFeedbackTimer = 3.2;
    this.emitHud();
  }

  private stepWestCityTriggers(dt: number, drivenVehicle: VehicleActor | null) {
    if (!this.arena) return;

    // 1. Nitro Speed Boost Pads (Sky Bridge + Formula-1 Circuit + Stunt Launch Ramps)
    const boostPads = this.arena.boostPads;
    if (boostPads && boostPads.length > 0) {
      for (let i = 0; i < boostPads.length; i++) {
        const pad = boostPads[i];
        if (pad.cooldownSec > 0) pad.cooldownSec = Math.max(0, pad.cooldownSec - dt);
        if (pad.cooldownSec > 0) continue;
        if (Math.abs(this.playerPos.y - pad.y) > 2.4) continue;
        if (Math.hypot(this.playerPos.x - pad.x, this.playerPos.z - pad.z) <= pad.radius) {
          pad.cooldownSec = 1.6;
          if (drivenVehicle) {
            drivenVehicle.speed = Math.max(drivenVehicle.speed, pad.boostSpeed);
          } else if (!drivenVehicle) {
            const dx = pad.dirX ?? -Math.sin(this.yaw);
            const dz = pad.dirZ ?? -Math.cos(this.yaw);
            const dLen = Math.hypot(dx, dz) || 1;
            this.playerVel.x = (dx / dLen) * 18.0;
            this.playerVel.z = (dz / dLen) * 18.0;
            this.playerVel.y = Math.max(this.playerVel.y, 4.5);
          }
          soundEngine.playInteractChime('bike');
          _v1.set(this.playerPos.x, this.playerPos.y + 0.5, this.playerPos.z);
          this.spawnImpactSparks(_v1, 0x38bdf8, 8, 1.2);
          this.interactFeedback = pad.label ?? 'Nitro Turbo Boost!';
          this.interactFeedbackTimer = 2.0;
        }
      }
    }

    // 2. Mid-Air Neon Stunt Score Rings
    const stuntRings = this.arena.stuntRings;
    if (stuntRings && stuntRings.length > 0) {
      for (let i = 0; i < stuntRings.length; i++) {
        const ring = stuntRings[i];
        if (ring.cooldownSec > 0) ring.cooldownSec = Math.max(0, ring.cooldownSec - dt);
        if (ring.cooldownSec > 0) continue;
        const dist3d = Math.hypot(
          this.playerPos.x - ring.x,
          this.playerPos.y + 1.0 - ring.y,
          this.playerPos.z - ring.z,
        );
        if (dist3d <= ring.radius) {
          ring.cooldownSec = 6.0;
          this.score += ring.points;
          this.simStuntsCompleted += 1;
          this.simCredits += 150;
          soundEngine.playInteractChime('shop');
          _v1.set(ring.x, ring.y, ring.z);
          this.spawnImpactSparks(_v1, 0xfacc15, 10, 1.5);
          this.interactFeedback = `STUNT RING CLEARED! +${ring.points} Score · +150₡`;
          this.interactFeedbackTimer = 2.6;
        }
      }
    }

    // 3. Formula-1 Grand Prix 6-Gate Lap Timing System
    const raceGates = this.arena.raceCheckpoints;
    if (raceGates && raceGates.length === 6) {
      const gate = raceGates[this.raceNextGateIdx];
      if (
        gate &&
        Math.abs(this.playerPos.y) < 4.5 &&
        Math.hypot(this.playerPos.x - gate.x, this.playerPos.z - gate.z) <= gate.radius
      ) {
        const prevMat = gate.mesh.material as THREE.MeshStandardMaterial;
        prevMat.color.setHex(0x38bdf8);
        prevMat.emissive.setHex(0x0284c7);

        if (this.raceNextGateIdx === 0 && this.raceLapStartTime > 0) {
          const lapSec = this.elapsedTime - this.raceLapStartTime;
          const isBest = this.raceBestLapSec <= 0 || lapSec < this.raceBestLapSec;
          if (isBest) this.raceBestLapSec = lapSec;
          this.score += 500;
          this.simRacesCompleted += 1;
          this.simCredits += 300;
          this.raceLapStartTime = this.elapsedTime;
          soundEngine.playInteractChime('shop');
          this.interactFeedback = `GP LAP COMPLETE: ${lapSec.toFixed(1)}s${isBest ? ' (BEST!)' : ''} +300₡`;
          this.interactFeedbackTimer = 3.2;
        } else if (this.raceNextGateIdx === 0) {
          this.raceLapStartTime = this.elapsedTime;
          soundEngine.playInteractChime('bike');
          this.interactFeedback = 'GRAND PRIX LAP STARTED! Gate 1/6';
          this.interactFeedbackTimer = 2.4;
        } else {
          this.score += 50;
          soundEngine.playInteractChime('bike');
          this.interactFeedback = `GP Gate ${this.raceNextGateIdx + 1}/6 (+50 Score)`;
          this.interactFeedbackTimer = 1.8;
        }

        this.raceNextGateIdx = (this.raceNextGateIdx + 1) % raceGates.length;
        const nextGate = raceGates[this.raceNextGateIdx];
        if (nextGate) {
          const nextMat = nextGate.mesh.material as THREE.MeshStandardMaterial;
          nextMat.color.setHex(0x22c55e);
          nextMat.emissive.setHex(0x16a34a);
        }
      }
    }
  }

  private ensureRainSystem() {
    if (this.rainMesh) return;
    const count = this.isSoftwareGl ? 110 : 250;
    const geo = new THREE.BoxGeometry(0.025, 0.72, 0.025);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcbe4ff,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.frustumCulled = false;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = Math.random() * 22;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    this.rainPositions = positions;
    this.rainMat = mat;
    this.rainMesh = im;
    im.visible = false;
    this.scene.add(im);
  }

  private applyEnvironmentToScene(snap: EnvironmentLightingSnapshot, dt: number) {
    this.hemiLight.color.setHex(snap.hemiSkyHex);
    this.hemiLight.groundColor.setHex(snap.hemiGroundHex);
    this.hemiLight.intensity = snap.hemiIntensity;
    this.keyLight.color.setHex(snap.sunColorHex);
    this.keyLight.intensity = snap.sunIntensity;
    this.rimLight.intensity = snap.rimIntensity;
    this.scene.environmentIntensity = snap.envIntensity;

    if (!this.keyLight.castShadow) {
      this.keyLight.position.set(
        this.playerPos.x + snap.sunPos[0],
        snap.sunPos[1],
        this.playerPos.z + snap.sunPos[2],
      );
    }

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(snap.bgHex);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      if (this.underwaterFogBlend > 0.02) {
        _c.setHex(snap.fogHex);
        _c2.setHex(0x0b4f6c);
        this.scene.fog.color.copy(_c).lerp(_c2, this.underwaterFogBlend);
        this.scene.fog.density = THREE.MathUtils.lerp(snap.fogDensity, 0.042, this.underwaterFogBlend);
      } else {
        this.scene.fog.color.setHex(snap.fogHex);
        this.scene.fog.density = snap.fogDensity;
      }
    }

    const targets = this.arena?.dayNightTargets;
    if (targets) {
      if (targets.cloudMat) {
        targets.cloudMat.color.setHex(snap.cloudTintHex);
        targets.cloudMat.opacity = snap.cloudOpacity;
      }
      const nightOn = snap.nightFactor > 0.35;
      const lampHex = nightOn ? 0xfef9c3 : 0x64748b;
      for (let i = 0; i < targets.streetLampMats.length; i++) {
        targets.streetLampMats[i].color.setHex(lampHex);
      }
      const winEmissive =
        snap.nightFactor <= 0.15
          ? 0
          : THREE.MathUtils.lerp(0, 2.45, Math.min(1, (snap.nightFactor - 0.12) / 0.88));
      for (let i = 0; i < targets.windowEmissiveMats.length; i++) {
        const wm = targets.windowEmissiveMats[i];
        if (wm.emissiveIntensity !== undefined) {
          wm.emissiveIntensity = winEmissive;
        }
      }
      if (targets.nightGlowMats) {
        const nightGlowMix =
          snap.nightFactor <= 0.18 ? 0 : Math.min(1, (snap.nightFactor - 0.18) / 0.82);
        for (let i = 0; i < targets.nightGlowMats.length; i++) {
          const g = targets.nightGlowMats[i];
          _c.setHex(g.dayHex);
          _c2.setHex(g.nightHex);
          g.mat.color.copy(_c).lerp(_c2, nightGlowMix);
          g.mat.emissiveIntensity = g.nightIntensity * nightGlowMix;
        }
      }
      // Update SkyDome gradient when quantized time/weather changes
      const skyKey = `${snap.skyZenithHex}_${snap.skyHorizonHex}`;
      if (targets.skyDomeGeo && skyKey !== this.lastSkyUpdateKey) {
        this.lastSkyUpdateKey = skyKey;
        const pos = targets.skyDomeGeo.attributes.position;
        const colAttr = targets.skyDomeGeo.attributes.color as THREE.BufferAttribute | undefined;
        if (pos && colAttr) {
          const zCol = _v1.set(
            ((snap.skyZenithHex >> 16) & 255) / 255,
            ((snap.skyZenithHex >> 8) & 255) / 255,
            (snap.skyZenithHex & 255) / 255,
          );
          const hCol = _v2.set(
            ((snap.skyHorizonHex >> 16) & 255) / 255,
            ((snap.skyHorizonHex >> 8) & 255) / 255,
            (snap.skyHorizonHex & 255) / 255,
          );
          if (!targets.skyDomeGeo.boundingSphere) {
            targets.skyDomeGeo.computeBoundingSphere();
          }
          const skyDivisor = Math.max(640, (targets.skyDomeGeo.boundingSphere?.radius ?? 820) * 0.85);
          const arr = colAttr.array as Float32Array;
          for (let i = 0; i < pos.count; i++) {
            const t = Math.pow(THREE.MathUtils.clamp(pos.getY(i) / skyDivisor, 0, 1), 0.58);
            arr[i * 3] = hCol.x + (zCol.x - hCol.x) * t;
            arr[i * 3 + 1] = hCol.y + (zCol.y - hCol.y) * t;
            arr[i * 3 + 2] = hCol.z + (zCol.z - hCol.z) * t;
          }
          colAttr.needsUpdate = true;
        }
      }
    }
    this.vehicleManager.setNightGlow(snap.nightFactor);

    // Realistic Sky Dome, Water Reflections & Splatted Terrain Night Mix
    const realTargets = this.arena?.realisticTargets;
    if (realTargets) {
      _envSunDir.set(snap.sunPos[0], snap.sunPos[1], snap.sunPos[2]);
      _envZenithCol.setHex(snap.skyZenithHex);
      _envHorizonCol.setHex(snap.skyHorizonHex);
      _envSunCol.setHex(snap.sunColorHex);
      realTargets.skyDome?.update(
        this.elapsedTime,
        _envSunDir,
        _envZenithCol,
        _envHorizonCol,
        _envSunCol,
        snap.nightFactor,
        snap.cloudOpacity,
      );
      if (realTargets.waters) {
        for (let w = 0; w < realTargets.waters.length; w++) {
          realTargets.waters[w].update(this.elapsedTime, _envSunDir, _envHorizonCol, _envSunCol);
        }
      }
      if (realTargets.terrainSplats) {
        for (let t = 0; t < realTargets.terrainSplats.length; t++) {
          realTargets.terrainSplats[t].uniforms.uNightMix.value = snap.nightFactor;
        }
      }
    }

    // Rain particle streak update (zero GC allocations)
    if (this.rainMesh && this.rainPositions && this.rainMat) {
      if (snap.rainIntensity <= 0.02) {
        this.rainMesh.visible = false;
      } else {
        this.rainMesh.visible = true;
        this.rainMat.opacity = 0.25 + snap.rainIntensity * 0.35;
        const count = this.rainMesh.count;
        const dropSpeed = 24 * Math.max(0.001, dt);
        const px = this.playerPos.x;
        const py = this.playerPos.y;
        const pz = this.playerPos.z;
        const dummy = _v3;
        for (let i = 0; i < count; i++) {
          let rx = this.rainPositions[i * 3];
          let ry = this.rainPositions[i * 3 + 1] - dropSpeed;
          let rz = this.rainPositions[i * 3 + 2];
          if (ry < 0) {
            ry += 22;
            rx = (Math.random() - 0.5) * 42;
            rz = (Math.random() - 0.5) * 42;
          }
          this.rainPositions[i * 3] = rx;
          this.rainPositions[i * 3 + 1] = ry;
          this.rainPositions[i * 3 + 2] = rz;
          dummy.set(px + rx, py + ry, pz + rz);
          _rainMat4.makeTranslation(dummy.x, dummy.y, dummy.z);
          this.rainMesh.setMatrixAt(i, _rainMat4);
        }
        this.rainMesh.instanceMatrix.needsUpdate = true;
      }
    }

    soundEngine.setWeatherAmbience(snap.rainIntensity);
  }

  public resumeMatch() {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.clock.getDelta();
    if (this.activeVehicleId) {
      const veh = this.vehicleManager.getById(this.activeVehicleId);
      if (veh) soundEngine.startVehicleAudio(veh.kind);
    }
    this.emitHud();
  }

  public pauseMatch() {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.touchFiring = false;
    this.vehicleAudioDelayTimer = 0;
    soundEngine.stopVehicleAudio();
    soundEngine.stopMansionPartyMusic();
    soundEngine.setWeatherAmbience(0);
    soundEngine.setSimulatorOutdoorAmbience(false);
    soundEngine.setAirFlowSound(false);
    this.emitHud();
  }

  public returnToMenu() {
    this.phase = 'menu';
    this.touchFiring = false;
    soundEngine.setWeatherAmbience(0);
    soundEngine.setSimulatorOutdoorAmbience(false);
    soundEngine.setAirFlowSound(false);
    if (this.rainMesh) this.rainMesh.visible = false;
    this.clearDynamicEntities();
    this.weaponMount.visible = false;
    if (this.fpArms) this.fpArms.group.visible = false;
    this.lobbyCamInitialized = false;
    this.applyGraphicsQuality();
    this.syncLobbyPreviewState();
    this.emitHud();
  }

  public setLobbyConfig(config: {
    mapId?: MapId;
    loadout?: LoadoutConfig;
    viewMode?: LobbyViewMode;
    previewItem?: WeaponId | 'grenade';
  }) {
    let needsMapRebuild = false;
    if (config.mapId && config.mapId !== this.mapId) {
      this.mapId = config.mapId;
      this.droneCenter.set(0, 0);
      this.droneZoom = 1;
      this.droneOrbitYaw = 0.65;
      needsMapRebuild = true;
    }
    if (config.loadout) {
      this.loadoutConfig = {
        ...config.loadout,
        preferredFireModes: { ...config.loadout.preferredFireModes },
      };
      this.applyLoadoutMaterials();
    }
    if (config.viewMode) {
      this.lobbyViewMode = config.viewMode;
      this.applyGraphicsQuality();
      this.refreshDropBeacon();
    }
    if (config.previewItem) {
      this.lobbyPreviewItem = config.previewItem;
    }
    if (this.phase === 'menu' && this.initialized) {
      if (needsMapRebuild) {
        this.rebuildWorld(this.mapId);
      } else {
        this.syncLobbyPreviewState();
      }
    }
  }

  public setDroneControl(opts: {
    panX?: number;
    panZ?: number;
    zoomDelta?: number;
    orbitDelta?: number;
    focusX?: number;
    focusZ?: number;
    zoom?: number;
  }) {
    const minXBound = -1120;
    const maxXBound = 1440;
    const maxZBound = 280;
    if (opts.focusX !== undefined) this.droneCenter.x = THREE.MathUtils.clamp(opts.focusX, minXBound, maxXBound);
    if (opts.focusZ !== undefined) this.droneCenter.y = THREE.MathUtils.clamp(opts.focusZ, -maxZBound, maxZBound);
    if (opts.panX !== undefined || opts.panZ !== undefined) {
      const cos = Math.cos(this.droneOrbitYaw);
      const sin = Math.sin(this.droneOrbitYaw);
      const px = opts.panX ?? 0;
      const pz = opts.panZ ?? 0;
      this.droneCenter.x = THREE.MathUtils.clamp(
        this.droneCenter.x + (px * cos - pz * sin) * this.droneZoom,
        minXBound,
        maxXBound,
      );
      this.droneCenter.y = THREE.MathUtils.clamp(
        this.droneCenter.y + (px * sin + pz * cos) * this.droneZoom,
        -maxZBound,
        maxZBound,
      );
    }
    if (opts.zoom !== undefined) {
      this.droneZoom = THREE.MathUtils.clamp(opts.zoom, 0.35, 1.85);
      if (this.lobbyViewMode === 'bike') {
        this.lobbyBikeZoom = THREE.MathUtils.clamp(opts.zoom, 0.6, 1.65);
      }
    }
    if (opts.zoomDelta !== undefined) {
      this.droneZoom = THREE.MathUtils.clamp(this.droneZoom + opts.zoomDelta, 0.35, 1.85);
      if (this.lobbyViewMode === 'bike') {
        this.lobbyBikeZoom = THREE.MathUtils.clamp(this.lobbyBikeZoom + opts.zoomDelta, 0.6, 1.65);
      }
    }
    if (opts.orbitDelta !== undefined) this.droneOrbitYaw += opts.orbitDelta;
  }

  public setCustomDropTarget(target: CustomDropTarget | null) {
    this.customDropTarget = target;
    if (target) {
      this.droneCenter.set(target.x, target.z);
    }
    this.refreshDropBeacon();
  }

  private refreshDropBeacon() {
    if (this.dropBeaconGroup) {
      disposeObject3DResources(this.dropBeaconGroup);
      this.scene.remove(this.dropBeaconGroup);
      this.dropBeaconGroup = null;
    }
    if (!this.customDropTarget || !this.arena) return;
    if (this.phase !== 'menu' || this.lobbyViewMode !== 'map') return;

    const grp = new THREE.Group();
    const gy = this.arena.groundHeightAt(this.customDropTarget.x, this.customDropTarget.z);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 48, 16, 1, true), beamMat);
    beam.position.y = 24;
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.4, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.25;
    grp.add(beam, ring);
    grp.position.set(this.customDropTarget.x, gy, this.customDropTarget.z);
    this.scene.add(grp);
    this.dropBeaconGroup = grp;
  }

  public setVehicleInput(partial: Partial<VehicleInputState>) {
    this.vehicleInput = { ...this.vehicleInput, ...partial };
  }

  public toggleVehicle() {
    if (this.phase !== 'playing' || !this.arena) return;
    if (this.seatedSpot) {
      this.standUpFromSeat();
    }
    if (this.activeVehicleId) {
      const veh = this.vehicleManager.getById(this.activeVehicleId);
      this.exitVehicle(veh);
      return;
    }
    if (this.bikeEjectTimer > 0) return;

    let near = this.vehicleManager.findNearestAvailable(this.playerPos, 5.8);
    let wasHijacked = false;
    if (!near && this.arena.npcManager) {
      const hijackCandidate = this.arena.npcManager.findNearestHijackableRoadAgent(this.playerPos, 5.8);
      if (hijackCandidate) {
        const hijacked = this.arena.npcManager.hijackRoadAgent(hijackCandidate.agentId);
        if (hijacked) {
          const spawned = this.vehicleManager.spawnDynamicVehicle(
            hijacked.vehicleKind,
            hijacked.x,
            hijacked.y,
            hijacked.z,
            hijacked.yaw,
            'hijack',
            { bikeStyle: hijacked.bikeStyle ?? this.bikeStyle, openLeftDoor: true },
          );
          spawned.speed = hijacked.speed;
          near = spawned;
          wasHijacked = true;
          soundEngine.playCarjackDoor();
          this.interactFeedback = `Carjacked ${spawned.spec.name}!`;
          this.interactFeedbackTimer = 2.2;
          if (hijacked.isPolice) {
            const nearPol = this.arena.npcManager.getNearestPoliceDistance(this.playerPos.x, this.playerPos.z);
            registerWantedIncident(this.wantedState, 'police_crime', nearPol, false);
            if (this.wantedState.level > 0) {
              this.arena.npcManager.syncWantedPursuit(this.wantedState.level, this.playerPos.x, this.playerPos.z);
            }
          }
        }
      }
    }
    if (!near) return;
    if (!wasHijacked) {
      const entryCheck = canEnterMansionVehicle(near.mansionState);
      if (!entryCheck.allowed) {
        const msg =
          entryCheck.reason === 'locked'
            ? `${near.spec.name} is Locked — Tap Unlock & Open [K]`
            : `Doors Closed — Tap Car Remote [K] to Open Doors`;
        this.mansionBlockedReason = msg;
        this.mansionBlockedTimer = 2.6;
        this.interactFeedback = msg;
        this.interactFeedbackTimer = 2.6;
        soundEngine.playCarRemoteChirp(false, true);
        this.emitHud();
        return;
      }
      if (near.mansionState.isMansionExclusive) {
        near.mansionState.doorTargetL = 0;
        near.mansionState.doorTargetR = 0;
        soundEngine.playCarjackDoor();
      } else if (near.doorStyle !== 'none') {
        near.doorTimerL = 1.1;
        near.doorOpenL = 0.28;
        soundEngine.playCarjackDoor();
      }
    }
    this.mansionBlockedReason = null;
    this.mansionBlockedTimer = 0;
    this.swimState.isSwimming = false;
    this.underwaterFogBlend = 0;
    this.cancelReloadCleanly();
    this.isAdsToggle = false;
    this.slideTimer = 0;
    this.doorCloseAnimTimer = 0;
    this.touchMoveVec = { x: 0, y: 0 };
    this.touchFiring = false;
    this.burstShotsRemaining = 0;
    this.driveLookYaw = 0;
    this.driveLookPitch = 0;
    this.vehicleCameraMode = 'inner';
    this.activeVehicleId = near.id;
    near.driverId = 'local_player';
    this.playerPos.copy(near.position);
    if (!near.mansionState.isMansionExclusive) {
      soundEngine.stopVehicleAudio();
      soundEngine.playEngineCrankStart(near.kind);
      this.vehicleAudioDelayTimer = 1.05;
      this.mansionAudioVehicleId = null;
    } else if (near.mansionState.engineRunning) {
      this.vehicleAudioDelayTimer = 0;
      soundEngine.startVehicleAudio(near.kind);
      this.mansionAudioVehicleId = near.id;
    } else {
      this.vehicleAudioDelayTimer = 0;
      soundEngine.stopVehicleAudio();
      this.mansionAudioVehicleId = null;
    }
    this.updateCameraRigVisibility();
    this.snapCameraAndRigImmediate();
    this.emitHud();
  }

  public triggerMansionCarRemote(action: MansionCarDoorAction) {
    if (this.phase !== 'playing' || this.activeVehicleId) return;
    const target = this.vehicleManager.findNearestMansionRemoteTarget(this.playerPos, 8.5);
    if (!target) return;
    const res = applyCarRemoteAction(target.mansionState, action);
    soundEngine.playCarRemoteChirp(res.unlocked, action === 'flash');
    this.mansionBlockedReason = null;
    this.mansionBlockedTimer = 0;
    this.interactFeedback =
      action === 'unlock_open'
        ? `Unlocked & Opened ${target.spec.name}`
        : action === 'lock_close'
          ? `Locked & Closed ${target.spec.name}`
          : `Flashed ${target.spec.name} Lights`;
    this.interactFeedbackTimer = 2.4;
    this.emitHud();
  }

  public triggerVehicleBeepSos() {
    if (this.phase !== 'playing') return;
    const target = this.activeVehicleId
      ? this.vehicleManager.getById(this.activeVehicleId)
      : this.vehicleManager.findNearestAvailable(this.playerPos, 8.5);
    if (!target) return;
    triggerSosLightFlash(target.mansionState);
    soundEngine.playCarRemoteChirp(false, true);
    this.interactFeedback = 'Beep! Front & Rear SOS Flash (3x -> OFF)';
    this.interactFeedbackTimer = 2.0;
    this.emitHud();
  }

  public toggleMansionVehicleEngine() {
    if (this.phase !== 'playing' || !this.activeVehicleId) return;
    const v = this.vehicleManager.getById(this.activeVehicleId);
    if (!v || !v.mansionState.isMansionExclusive) return;
    const starting = toggleVehicleEngineIgnition(v.mansionState);
    if (starting) {
      this.vehicleAudioDelayTimer = 0;
      soundEngine.playEngineCrankStart(v.kind);
      this.interactFeedback = `Cranking ${v.spec.name} Engine...`;
    } else {
      this.vehicleAudioDelayTimer = 0;
      soundEngine.stopVehicleAudio();
      this.mansionAudioVehicleId = null;
      this.interactFeedback = `${v.spec.name} Engine Stopped`;
    }
    this.interactFeedbackTimer = 2.0;
    this.emitHud();
  }

  public toggleMansionVehicleDoors() {
    if (this.phase !== 'playing' || !this.activeVehicleId) return;
    const v = this.vehicleManager.getById(this.activeVehicleId);
    if (!v || !v.mansionState.isMansionExclusive) return;
    const openNow = v.mansionState.doorTargetL > 0.5 || v.mansionState.doorTargetR > 0.5;
    const next = openNow ? 0 : 1;
    v.mansionState.doorTargetL = next;
    v.mansionState.doorTargetR = next;
    soundEngine.playCarjackDoor();
    this.interactFeedback = next === 1 ? 'Doors Opened' : 'Doors Closed';
    this.interactFeedbackTimer = 1.6;
    this.emitHud();
  }

  public toggleMansionVehicleWindow(pane: 'FL' | 'FR' | 'RL' | 'RR' | 'ALL') {
    if (this.phase !== 'playing' || !this.activeVehicleId) return;
    const v = this.vehicleManager.getById(this.activeVehicleId);
    if (!v || !v.mansionState.isMansionExclusive) return;
    const ms = v.mansionState;
    if (pane === 'ALL') {
      const anyOpen =
        ms.windowTargetFL > 0.5 ||
        ms.windowTargetFR > 0.5 ||
        ms.windowTargetRL > 0.5 ||
        ms.windowTargetRR > 0.5;
      const next = anyOpen ? 0 : 1;
      ms.windowTargetFL = next;
      ms.windowTargetFR = next;
      ms.windowTargetRL = next;
      ms.windowTargetRR = next;
      this.interactFeedback = next === 1 ? 'All Windows Lowered' : 'All Windows Raised';
    } else if (pane === 'FL') {
      ms.windowTargetFL = ms.windowTargetFL > 0.5 ? 0 : 1;
    } else if (pane === 'FR') {
      ms.windowTargetFR = ms.windowTargetFR > 0.5 ? 0 : 1;
    } else if (pane === 'RL') {
      ms.windowTargetRL = ms.windowTargetRL > 0.5 ? 0 : 1;
    } else if (pane === 'RR') {
      ms.windowTargetRR = ms.windowTargetRR > 0.5 ? 0 : 1;
    }
    soundEngine.playWindowMotor();
    if (pane !== 'ALL') {
      this.interactFeedback = `Window ${pane} Toggled`;
    }
    this.interactFeedbackTimer = 1.5;
    this.emitHud();
  }

  public toggleMansionVehicleHeadlights() {
    if (this.phase !== 'playing' || !this.activeVehicleId) return;
    const v = this.vehicleManager.getById(this.activeVehicleId);
    if (!v) return;
    v.mansionState.sosFlashTimer = 0;
    v.mansionState.headlightsOn = !v.mansionState.headlightsOn;
    soundEngine.playFireModeSwitch();
    this.emitHud();
  }

  private standUpFromSeat() {
    if (!this.seatedSpot) return;
    const seat = this.seatedSpot;
    this.seatedSpot = null;
    this.touchMoveVec = { x: 0, y: 0 };
    this.playerVel.set(0, 0, 0);
    if (seat.exitTarget) {
      const ex = seat.exitTarget();
      this.playerPos.set(ex.x, ex.y, ex.z);
      if (ex.yaw !== undefined) {
        this.yaw = ex.yaw;
        this.targetYaw = ex.yaw;
      }
    } else {
      const standX =
        seat.kind === 'gaming_chair'
          ? seat.x + 1.15
          : seat.x - Math.sin(seat.yaw) * 1.15;
      const standZ =
        seat.kind === 'gaming_chair'
          ? seat.z
          : seat.z - Math.cos(seat.yaw) * 1.15;
      const standFloorY = this.arena ? this.arena.groundHeightAt(standX, standZ, seat.y) : 0;
      this.playerPos.set(standX, standFloorY, standZ);
    }
    this.resolveCollisions(this.playerPos, 0.48, 1.75);
    this.playerPos.y = this.surfaceHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
    this.smoothedGroundY = this.playerPos.y;
    this.smoothedEyeOffset = 1.62;
    this.smoothedEyeY = this.playerPos.y + 1.62;
    this.thirdPersonCamInit = false;
    if (this.playerThirdPersonRig) {
      const rig = this.playerThirdPersonRig;
      rig.pelvisGroup.position.set(0, 0, 0);
      rig.leftLeg.rotation.set(0, 0, 0);
      rig.rightLeg.rotation.set(0, 0, 0);
      rig.leftKnee.rotation.set(0, 0, 0);
      rig.rightKnee.rotation.set(0, 0, 0);
    }
    soundEngine.playInteractChime('dine');
    this.interactFeedback = 'Stood up';
    this.interactFeedbackTimer = 1.8;
    this.snapCameraAndRigImmediate();
    this.emitHud();
  }

  private ensureElectricSparkPool() {
    if (this.electricSparks.length > 0 || typeof document === 'undefined') return;
    try {
      this.electricSparkVideo = null;
      this.electricSparkVideoFailed = true;
      const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
      tex.needsUpdate = true;
      this.electricSparkTex = tex;

      const vertShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;
      const fragShader = `
        uniform sampler2D tSpark;
        uniform float uOpacity;
        uniform float uFallback;
        uniform float uTime;
        varying vec2 vUv;
        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        void main() {
          if (uFallback < 0.5) {
            vec4 tex = texture2D(tSpark, vUv);
            float greenExcess = tex.g - max(tex.r, tex.b);
            float keyAlpha = 1.0 - smoothstep(0.03, 0.16, greenExcess);
            float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
            float lumaMask = smoothstep(0.03, 0.18, lum);
            float alpha = keyAlpha * lumaMask * uOpacity;
            if (alpha < 0.03) discard;
            vec3 col = tex.rgb;
            col.g = min(col.g, max(col.r, col.b) + 0.02);
            col = mix(col, vec3(0.55, 0.88, 1.0), 0.25) * 1.85;
            gl_FragColor = vec4(col, alpha);
            return;
          }
          vec2 uv = vUv - 0.5;
          float r = length(uv);
          float radialFade = smoothstep(0.5, 0.06, r);
          float ang = atan(uv.y, uv.x);
          float bolt1 = abs(sin(ang * 5.0 + uTime * 22.0 + r * 14.0));
          float bolt2 = abs(cos(ang * 7.0 - uTime * 17.0 + sin(r * 18.0) * 2.0));
          float arc = smoothstep(0.92, 0.995, bolt1) + smoothstep(0.94, 0.996, bolt2);
          float core = smoothstep(0.16, 0.0, r) * 0.95;
          float sparkle = step(0.965, hash21(floor(vUv * 42.0) + floor(uTime * 18.0))) * radialFade;
          float intensity = (arc * radialFade * 1.4 + core + sparkle * 1.2) * uOpacity;
          if (intensity < 0.04) discard;
          vec3 arcCol = mix(vec3(0.2, 0.72, 1.0), vec3(0.88, 0.97, 1.0), clamp(core + arc * 0.45, 0.0, 1.0));
          gl_FragColor = vec4(arcCol * 1.65, clamp(intensity, 0.0, 1.0));
        }
      `;
      for (let i = 0; i < 6; i++) {
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            tSpark: { value: tex },
            uOpacity: { value: 0 },
            uFallback: { value: 1 },
            uTime: { value: 0 },
          },
          vertexShader: vertShader,
          fragmentShader: fragShader,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        });
        const mesh = new THREE.Mesh(this.electricSparkGeo, mat);
        mesh.visible = false;
        mesh.renderOrder = 14;
        this.scene.add(mesh);
        this.electricSparks.push({ mesh, mat, life: 0, maxLife: 0.65, active: false });
      }
    } catch {
      // Headless / test environment without DOM video
    }
  }

  private spawnScreenElectricSpark(worldPos: THREE.Vector3, worldNormal: THREE.Vector3, size = 1.45) {
    this.ensureElectricSparkPool();
    if (this.electricSparks.length === 0) return;
    if (this.electricSparkVideo && this.electricSparkVideo.paused) {
      this.electricSparkVideo.play().catch(() => {});
    }
    let slot = this.electricSparks.find((s) => !s.active);
    if (!slot) {
      slot = this.electricSparks.reduce((a, b) => (a.life < b.life ? a : b));
    }
    if (worldNormal.lengthSq() > 0.001) {
      _screenNormal.copy(worldNormal).normalize();
    } else {
      _screenNormal.set(0, 0, 1);
    }
    _sparkQuat.setFromUnitVectors(_zAxis, _screenNormal);
    slot.mesh.position.copy(worldPos).addScaledVector(_screenNormal, 0.08);
    slot.mesh.quaternion.copy(_sparkQuat);
    slot.mesh.rotateZ((Math.random() - 0.5) * 0.8);
    slot.mesh.scale.set(size * 1.15, size * 0.85, 1);
    slot.maxLife = 0.85;
    slot.life = slot.maxLife;
    const vidReady = !this.electricSparkVideoFailed && Boolean(this.electricSparkVideo && this.electricSparkVideo.readyState >= 2);
    slot.mat.uniforms.uFallback.value = vidReady ? 0.0 : 1.0;
    slot.mat.uniforms.uTime.value = this.elapsedTime;
    slot.mat.uniforms.uOpacity.value = 1.0;
    slot.mesh.visible = true;
    slot.active = true;
  }

  public clearVehicleInputKeys() {
    this.keysHeld.clear();
    this.vehicleInput = { throttle: 0, steer: 0, ascend: false, descend: false };
    this.touchMoveVec = { x: 0, y: 0 };
    this.touchFiring = false;
  }

  public handleCanvasTap(clientX: number, clientY: number): boolean {
    if (this.phase !== 'playing' || !this.activeVehicleId || this.vehicleCameraMode !== 'inner') {
      return false;
    }
    const v = this.vehicleManager.getById(this.activeVehicleId);
    if (!v || !v.mansionState.isMansionExclusive) return false;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    _tapNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    _raycaster.setFromCamera(_tapNdc, this.camera);

    if (v.dashStartButtonMesh) {
      const startHits = _raycaster.intersectObject(v.dashStartButtonMesh, true);
      if (startHits.length > 0) {
        this.toggleMansionVehicleEngine();
        return true;
      }
    }
    return false;
  }

  private snapCameraAndRigImmediate() {
    if (this.phase !== 'playing') return;
    const drivenVeh = this.activeVehicleId ? this.vehicleManager.getById(this.activeVehicleId) : null;
    if (drivenVeh) {
      this.weaponMount.visible = false;
      if (this.fpArms) this.fpArms.group.visible = false;
      const isInner = this.vehicleCameraMode === 'inner';
      if (this.playerThirdPersonRig) {
        if (this.isOpenCockpitVehicle(drivenVeh.kind) && !isInner) {
          this.poseRiderOnVehicle(this.playerThirdPersonRig, drivenVeh, 0);
        } else {
          this.playerThirdPersonRig.root.visible = false;
        }
      }
      if (isInner) {
        _euler.set(drivenVeh.pitch, drivenVeh.yaw, drivenVeh.roll, 'YXZ');
        _v1.copy(drivenVeh.driverSeatOffset);
        if (drivenVeh.kind === 'digital_bike') {
          _v1.y += 0.34;
          _v1.z -= 0.14;
        } else if (drivenVeh.kind === 'electric_scooter') {
          _v1.y += 0.06;
          _v1.z -= 0.08;
        }
        _v1.applyEuler(_euler).add(drivenVeh.position);
        this.camera.position.copy(_v1);
        _euler.set(
          drivenVeh.pitch + this.driveLookPitch,
          drivenVeh.yaw + this.driveLookYaw,
          drivenVeh.roll * 0.45,
          'YXZ',
        );
        this.camera.quaternion.setFromEuler(_euler);
        if (this.camera.fov !== 76) {
          this.camera.fov = 76;
          this.camera.updateProjectionMatrix();
        }
        return;
      }
      const distMul =
        this.vehicleCameraMode === 'near'
          ? 0.72
          : this.vehicleCameraMode === 'far'
            ? 1.58
            : this.vehicleCameraMode === 'action'
              ? 1.18
              : 1.0;
      const hMul =
        this.vehicleCameraMode === 'near'
          ? 0.85
          : this.vehicleCameraMode === 'far'
            ? 1.38
            : this.vehicleCameraMode === 'action'
              ? 1.12
              : 1.0;
      const targetFov =
        this.vehicleCameraMode === 'near'
          ? 75
          : this.vehicleCameraMode === 'far'
            ? 82
            : this.vehicleCameraMode === 'action'
              ? 86
              : 78;
      const camDist = drivenVeh.spec.camDist * distMul;
      const camH = drivenVeh.spec.camHeight * hMul;
      const actionAngle = this.vehicleCameraMode === 'action' ? 0.56 : 0;
      const camYaw = drivenVeh.yaw + actionAngle + (drivenVeh.kind === 'digital_bike' ? -0.32 : 0);
      _camTarget.set(
        drivenVeh.position.x,
        drivenVeh.position.y + drivenVeh.spec.seatHeight + 0.45,
        drivenVeh.position.z,
      );
      _camPos.set(
        drivenVeh.position.x + Math.sin(camYaw) * camDist,
        drivenVeh.position.y + camH,
        drivenVeh.position.z + Math.cos(camYaw) * camDist,
      );
      if (this.arena) {
        const camFloor = this.arena.groundHeightAt(_camPos.x, _camPos.z, drivenVeh.position.y) + 0.55;
        if (_camPos.y < camFloor) _camPos.y = camFloor;
      }
      this.camera.position.copy(_camPos);
      this.camera.lookAt(_camTarget);
      if (this.camera.fov !== targetFov) {
        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    if (this.perspective === 'first') {
      if (this.playerThirdPersonRig) this.playerThirdPersonRig.root.visible = false;
      this.camera.position.set(this.playerPos.x, this.playerPos.y + this.smoothedEyeOffset, this.playerPos.z);
      _euler.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(_euler);
    } else {
      if (this.playerThirdPersonRig) {
        this.playerThirdPersonRig.root.visible = true;
        this.playerThirdPersonRig.root.position.copy(this.playerPos);
        this.playerThirdPersonRig.root.rotation.set(0, this.yaw, 0);
      }
      _euler.set(this.pitch, this.yaw, 0, 'YXZ');
      _camTarget.set(this.playerPos.x, this.playerPos.y + this.smoothedEyeOffset * 0.94, this.playerPos.z);
      _v1.set(0, 0, 1).applyEuler(_euler);
      _v2.set(1, 0, 0).applyEuler(_euler);
      this.camera.position.copy(_camTarget).addScaledVector(_v1, 4.1).addScaledVector(_v2, 0.72);
      this.camera.quaternion.setFromEuler(_euler);
    }
  }

  private exitVehicle(veh: VehicleActor | null, skipNetSend = false) {
    if (!this.activeVehicleId) return;
    this.activeVehicleId = null;
    this.mansionAudioVehicleId = null;
    this.vehicleAudioDelayTimer = 0;
    this.driveLookYaw = 0;
    this.driveLookPitch = 0;
    this.vehicleInput = { throttle: 0, steer: 0, ascend: false, descend: false };
    this.touchMoveVec = { x: 0, y: 0 };
    this.touchFiring = false;
    this.burstShotsRemaining = 0;
    soundEngine.stopVehicleAudio();

    const wasSpeed = veh ? veh.speed : 0;
    const shouldHighSpeedEject = Boolean(
      veh && !skipNetSend && Math.abs(wasSpeed) > 4.2 && this.bikeEjectTimer <= 0,
    );

    if (veh) {
      veh.driverId = null;
      // Exit on driver's left side matching doorPivotL swing
      const sideX = -Math.cos(veh.yaw) * 2.25;
      const sideZ = Math.sin(veh.yaw) * 2.25;
      const exitX = veh.position.x + sideX;
      const exitZ = veh.position.z + sideZ;
      const gy = this.arena ? this.arena.groundHeightAt(exitX, exitZ, veh.position.y) : 0;
      this.playerPos.set(exitX, Math.max(gy, veh.position.y), exitZ);
      this.playerVel.set(0, 0, 0);
      this.resolveCollisions(this.playerPos, 0.48, 1.75);
      this.playerPos.y = this.surfaceHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
      this.smoothedGroundY = this.playerPos.y;
      this.smoothedEyeY = this.playerPos.y + 1.62;
      this.thirdPersonCamInit = false;

      if (shouldHighSpeedEject) {
        // Vehicle keeps coasting forward cleanly while operator tumbles out onto asphalt
        veh.speed = wasSpeed * 0.94;
        this.bikeEjectDuration = 1.18;
        this.bikeEjectTimer = this.bikeEjectDuration;
        this.bikeEjectImpactYaw = veh.yaw;
        this.bikeEjectSpin = (Math.random() > 0.5 ? 1 : -1) * (5.2 + Math.min(6, Math.abs(wasSpeed) * 0.28));
        this.bikeEjectVel.set(
          -Math.sin(veh.yaw) * wasSpeed * 0.58 - Math.cos(veh.yaw) * 3.8,
          3.2 + Math.min(2.6, Math.abs(wasSpeed) * 0.12),
          -Math.cos(veh.yaw) * wasSpeed * 0.58 + Math.sin(veh.yaw) * 3.8,
        );
        this.bikeEjectSparkTimer = 0;
        this.actionCrashCamTimer = this.bikeEjectDuration + 0.55;
        this.actionCrashCamSide = -1;
        this.actionCrashCamTarget.copy(veh.position);
      }

      if (veh.mansionState.isMansionExclusive) {
        veh.mansionState.doorTargetL = 1;
        soundEngine.playCarjackDoor();
      } else if (veh.doorStyle !== 'none') {
        veh.doorTimerL = shouldHighSpeedEject ? 3.2 : 1.05;
        veh.doorOpenL = 0.92;
        soundEngine.playCarjackDoor();
        this.doorCloseAnimTimer = shouldHighSpeedEject ? 0 : 0.44;
      }
    }
    if (this.playerThirdPersonRig && this.bikeEjectTimer <= 0) {
      const rig = this.playerThirdPersonRig;
      rig.root.rotation.set(0, this.yaw, 0);
      rig.bodyPivot.rotation.set(0, 0, 0);
      rig.bodyPivot.position.set(0, 0, 0);
      rig.pelvisGroup.position.set(0, 0, 0);
      rig.torso.rotation.set(0, 0, 0);
      rig.headGroup.rotation.set(0, 0, 0);
      rig.leftLeg.rotation.set(0, 0, 0);
      rig.rightLeg.rotation.set(0, 0, 0);
      rig.leftKnee.rotation.set(0, 0, 0);
      rig.rightKnee.rotation.set(0, 0, 0);
      this.syncThirdPersonWeapon();
    }
    this.updateCameraRigVisibility();
    if (this.bikeEjectTimer <= 0) {
      this.snapCameraAndRigImmediate();
    }
    this.emitHud();
  }

  private isOpenCockpitVehicle(kind: VehicleKind | null | undefined): boolean {
    return kind === 'digital_bike' || kind === 'electric_scooter';
  }

  private poseRiderOnVehicle(rig: SoldierRig, veh: VehicleActor, steer: number) {
    if (rig.playerWeapons) {
      WEAPON_ORDER.forEach((w) => {
        const m = rig.playerWeapons![w];
        if (m) m.visible = false;
      });
    }
    rig.root.visible = true;
    rig.root.position.copy(veh.position);
    rig.root.rotation.order = 'YXZ';
    rig.root.rotation.y = veh.yaw;
    rig.root.rotation.x = veh.pitch;
    rig.root.rotation.z = veh.roll;

    if (veh.kind === 'electric_scooter') {
      rig.bodyPivot.rotation.set(0, 0, veh.bikeLean ?? 0);
      rig.pelvisGroup.position.set(0, 0.24, 0.06);
      rig.torso.rotation.set(-0.14, 0, 0);
      rig.headGroup.rotation.set(0.1, steer * -0.18, 0);
      rig.leftLeg.rotation.set(0.08, 0, -0.08);
      rig.rightLeg.rotation.set(-0.08, 0, 0.08);
      rig.leftKnee.rotation.set(-0.14, 0, 0);
      rig.rightKnee.rotation.set(-0.1, 0, 0);
      rig.leftArm.rotation.set(0.92 + steer * 0.14, 0.16, -0.12);
      rig.rightArm.rotation.set(0.92 - steer * 0.14, -0.16, 0.12);
      rig.leftElbow.rotation.set(0.28, 0, 0);
      rig.rightElbow.rotation.set(0.28, 0, 0);
    } else if (veh.kind === 'digital_bike') {
      rig.bodyPivot.rotation.set(0, 0, veh.bikeLean ?? 0);
      rig.pelvisGroup.position.set(0, 0.14, 0.28);
      rig.torso.rotation.set(-0.42, 0, 0);
      rig.headGroup.rotation.set(0.32, steer * -0.18, 0);
      rig.leftLeg.rotation.set(0.72, 0, -0.26);
      rig.rightLeg.rotation.set(0.72, 0, 0.26);
      rig.leftKnee.rotation.set(-1.18, 0, 0);
      rig.rightKnee.rotation.set(-1.18, 0, 0);
      rig.leftArm.rotation.set(1.08 + steer * 0.18, 0.22, -0.14);
      rig.rightArm.rotation.set(1.08 - steer * 0.18, -0.22, 0.14);
      rig.leftElbow.rotation.set(0.38, 0, 0);
      rig.rightElbow.rotation.set(0.38, 0, 0);
    } else {
      rig.bodyPivot.rotation.set(0, 0, 0);
      rig.pelvisGroup.position.set(-0.34, 0.42, 0.08);
      rig.torso.rotation.set(-0.08, 0, 0);
      rig.headGroup.rotation.set(0.06, 0, 0);
      rig.leftLeg.rotation.set(1.22, 0, -0.08);
      rig.rightLeg.rotation.set(1.22, 0, 0.08);
      rig.leftKnee.rotation.set(-1.22, 0, 0);
      rig.rightKnee.rotation.set(-1.22, 0, 0);
      rig.leftArm.rotation.set(0.92, 0.15, -0.1);
      rig.rightArm.rotation.set(0.92, -0.15, 0.1);
      rig.leftElbow.rotation.set(0.35, 0, 0);
      rig.rightElbow.rotation.set(0.35, 0, 0);
    }
  }

  private updateRemotePlayers(_dt: number) {
    // Multiplayer removed in simulator-only mode
  }

  private damageVehicle(veh: VehicleActor, rawDmg: number, isRocket = false) {
    if (veh.destroyed) return;
    const dmg = isRocket
      ? veh.maxHp
      : Math.max(4, Math.round(rawDmg * (rawDmg >= 70 ? 0.45 : 0.65)));

    const wasDrivenByLocal = this.activeVehicleId === veh.id;
    const nextHp = Math.max(0, veh.hp - dmg);

    veh.hp = nextHp;
    if (veh.hp <= 0) {
      this.vehicleManager.markDestroyed(veh, this.arena?.groundHeightAt);
      if (wasDrivenByLocal) {
        this.exitVehicle(veh, true);
        this.applyDamageToPlayer(120, true, 'vehicle');
      }
      this.detonateExplosion(veh.position, 8.5, 130, false, false, true);
    }
  }

  private damageVehicleAtMesh(
    mesh: THREE.Object3D,
    dmg: number,
    isRocket = false,
    hitPoint?: THREE.Vector3,
    hitNormal?: THREE.Vector3,
  ) {
    const vid = mesh.userData.vehicleId as string | undefined;
    if (!vid) return;
    const veh = this.vehicleManager.getById(vid);
    if (!veh || veh.destroyed) return;
    const partResult = this.vehicleManager.hitVehiclePart(veh, mesh, dmg, hitPoint, hitNormal);
    const dist = hitPoint ? hitPoint.distanceTo(this.playerPos) : veh.position.distanceTo(this.playerPos);
    if (partResult === 'cracked') {
      soundEngine.playGlassShatter(true, dist);
      if (hitPoint) this.spawnImpactSparks(hitPoint, 0xe0f2fe, 4, 0.85);
    } else if (partResult === 'shattered') {
      soundEngine.playGlassShatter(false, dist);
      if (hitPoint) this.spawnGlassShards(hitPoint, 11);
    } else if (partResult === 'light_cracked') {
      soundEngine.playGlassShatter(true, dist);
      if (hitPoint) this.spawnImpactSparks(hitPoint, 0xfef08a, 5, 0.95);
    } else if (partResult === 'punctured') {
      soundEngine.playTirePuncture(dist);
      if (hitPoint) this.spawnTireAirPuff(hitPoint);
    }
    const bodyDmg =
      partResult === 'cracked' || partResult === 'shattered' || partResult === 'light_cracked'
        ? Math.round(dmg * 0.25)
        : dmg;
    this.damageVehicle(veh, bodyDmg, isRocket);
  }

  public addLobbyInspectDelta(dx: number, dy: number) {
    if (this.phase !== 'menu') return;
    if (this.lobbyViewMode === 'weapon') {
      this.lobbyWeaponInspectYaw += dx * 0.011;
      this.lobbyWeaponInspectPitch = THREE.MathUtils.clamp(
        this.lobbyWeaponInspectPitch + dy * 0.008,
        -0.65,
        0.65,
      );
    } else {
      this.lobbyInspectYaw += dx * 0.011;
    }
  }

  public setPerspective(perspective: CameraPerspective) {
    this.perspective = perspective;
    this.thirdPersonCamInit = false;
    this.driveLookYaw = 0;
    this.driveLookPitch = 0;
    this.updateCameraRigVisibility();
    if (this.activeVehicleId) {
      this.snapCameraAndRigImmediate();
    }
    this.emitHud();
  }

  public togglePerspective() {
    this.setPerspective(this.perspective === 'first' ? 'third' : 'first');
  }

  public cycleVehicleCameraMode() {
    const order: VehicleCameraMode[] = ['inner', 'near', 'outer', 'far', 'action'];
    const idx = order.indexOf(this.vehicleCameraMode);
    this.vehicleCameraMode = order[(idx + 1) % order.length];
    this.driveLookYaw = 0;
    this.driveLookPitch = 0;
    this.updateCameraRigVisibility();
    if (this.activeVehicleId) {
      this.snapCameraAndRigImmediate();
    }
    soundEngine.playFireModeSwitch();
    this.emitHud();
  }

  private updateCameraRigVisibility() {
    if (this.phase !== 'playing') {
      this.weaponMount.visible = false;
      if (this.fpArms) this.fpArms.group.visible = false;
      this.syncLobbyPreviewState();
      return;
    }
    this.lobbyShowcaseGroup.visible = false;
    if (this.lobbyBikeGroup) this.lobbyBikeGroup.visible = false;
    const drivenVeh = this.activeVehicleId ? this.vehicleManager.getById(this.activeVehicleId) : null;
    const driving = Boolean(drivenVeh);
    const isFirst = this.perspective === 'first' && !driving;
    this.weaponMount.visible = isFirst;
    if (this.fpArms) this.fpArms.group.visible = isFirst;
    if (this.playerThirdPersonRig) {
      const showRider = drivenVeh
        ? this.isOpenCockpitVehicle(drivenVeh.kind) && this.vehicleCameraMode !== 'inner'
        : !isFirst;
      this.playerThirdPersonRig.root.visible = showRider;
      if (!driving) {
        this.syncThirdPersonWeapon();
      }
    }
  }

  private cancelReloadCleanly() {
    if (!this.isReloading) return;
    const prevVm = this.viewModels[this.activeWeapon];
    if (prevVm) {
      prevVm.magGroup.visible = true;
      prevVm.magGroup.position.set(0, 0, 0);
      prevVm.boltMesh.position.set(0, 0, 0);
    }
    this.isReloading = false;
    this.reloadTimer = 0;
    this.reloadStage = '';
    this.reloadMagDropped = false;
    this.reloadBoltRacked = false;
  }

  private syncThirdPersonWeapon() {
    const pw = this.playerThirdPersonRig?.playerWeapons;
    if (!pw) return;
    WEAPON_ORDER.forEach((id) => {
      const grp = pw[id];
      if (grp) grp.visible = id === this.activeWeapon;
    });
  }

  public switchWeapon(weaponId: WeaponId) {
    if (this.activeWeapon === weaponId) return;
    this.cancelReloadCleanly();
    this.activeWeapon = weaponId;
    this.fireCooldown = 0.16;
    this.burstShotsRemaining = 0;
    this.isAdsToggle = false;

    WEAPON_ORDER.forEach((id) => {
      const vm = this.viewModels[id];
      if (vm) vm.group.visible = id === weaponId;
    });
    this.syncThirdPersonWeapon();
    soundEngine.playFireModeSwitch();
    this.emitHud();
  }

  public cycleZoom(delta = 1) {
    if (this.phase !== 'playing') return;
    const opts = WEAPON_ZOOM_OPTIONS[this.activeWeapon];
    if (!opts || opts.length <= 1) return;
    const idx = (this.weaponZoomIndices[this.activeWeapon] + delta + opts.length) % opts.length;
    this.weaponZoomIndices[this.activeWeapon] = idx;
    if (this.activeWeapon === 'sniper') {
      this.sniperZoomIndex = idx;
    }
    soundEngine.playFireModeSwitch();
    this.emitHud();
  }

  public cycleSniperZoom(delta = 1) {
    this.cycleZoom(delta);
  }

  public cycleFireMode() {
    if (this.phase !== 'playing') return;
    const supported = WEAPONS[this.activeWeapon].supportedFireModes;
    if (supported.length <= 1) return;
    const current = this.fireModes[this.activeWeapon];
    const nextIdx = (supported.indexOf(current) + 1) % supported.length;
    this.fireModes[this.activeWeapon] = supported[nextIdx];
    this.burstShotsRemaining = 0;
    soundEngine.playFireModeSwitch();
    this.emitHud();
  }

  public reload() {
    if (
      this.phase !== 'playing' ||
      this.isReloading ||
      this.grenadeAnimTimer > 0 ||
      this.health <= 0
    ) {
      return;
    }
    const spec = WEAPONS[this.activeWeapon];
    if (spec.magSize <= 0) return;
    const inMag = this.ammoInMag[this.activeWeapon];
    const reserve = this.reserveAmmo[this.activeWeapon];
    if (inMag >= spec.magSize || reserve <= 0) return;

    this.isReloading = true;
    this.burstShotsRemaining = 0;
    this.reloadDuration = spec.reloadTime;
    this.reloadTimer = spec.reloadTime;
    this.reloadMagDropped = false;
    this.reloadBoltRacked = false;
    this.reloadStage = 'Mag Out';
    this.isAdsToggle = false;
    soundEngine.playReloadStart();
    this.emitHud();
  }

  public setTouchMove(x: number, y: number) {
    this.touchMoveVec.x = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMoveVec.y = THREE.MathUtils.clamp(y, -1, 1);
  }

  public toggleRunMode() {
    this.setRunMode(!this.runModeEnabled);
  }

  public setRunMode(enabled: boolean) {
    if (this.runModeEnabled === enabled) return;
    this.runModeEnabled = enabled;
    soundEngine.playFireModeSwitch();
    this.emitHud();
  }

  public addLookDelta(dx: number, dy: number) {
    if (this.phase !== 'playing') return;
    const ads = this.isCurrentlyAds();
    const zoomOpts = WEAPON_ZOOM_OPTIONS[this.activeWeapon];
    const zoomOpt = zoomOpts[this.weaponZoomIndices[this.activeWeapon] % zoomOpts.length];
    const sensMul = ads ? zoomOpt.sensMul : 1.0;
    const baseSens = 0.0046 * this.hudSettings.lookSensitivity;
    const sens = baseSens * sensMul;
    if (this.activeVehicleId && this.vehicleCameraMode === 'inner') {
      this.driveLookYaw = THREE.MathUtils.clamp(this.driveLookYaw - dx * sens, -1.45, 1.45);
      this.driveLookPitch = THREE.MathUtils.clamp(this.driveLookPitch - dy * sens, -0.55, 0.48);
      return;
    }
    this.targetYaw -= dx * sens;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - dy * sens, -1.35, 1.35);
    this.weaponSwayX = THREE.MathUtils.clamp(this.weaponSwayX - dx * 0.00055, -0.045, 0.045);
    this.weaponSwayY = THREE.MathUtils.clamp(this.weaponSwayY + dy * 0.00045, -0.035, 0.035);
  }

  public setTouchFire(firing: boolean) {
    soundEngine.unlock();
    if (firing && !this.touchFiring) {
      if (this.activeVehicleId) {
        this.fireVehicleMachineGun();
      } else {
        this.tryFireShot();
      }
    }
    this.touchFiring = firing;
  }

  public fireOnce() {
    soundEngine.unlock();
    if (this.activeVehicleId) {
      this.fireVehicleMachineGun();
    } else {
      this.tryFireShot();
    }
  }

  public toggleAds() {
    if (this.breachTimer > 0) this.breachTimer = 0;
    this.isAdsToggle = !this.isAdsToggle;
    this.emitHud();
  }

  public toggleCrouch() {
    if (this.phase !== 'playing' || this.seatedSpot) return;
    this.breachTimer = 0;
    this.isCrouchToggle = false;
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.isGrounded && horizSpeed > 5.8 && this.slideTimer <= 0) {
      this.triggerSlide();
    }
    this.emitHud();
  }

  public triggerSlideAction() {
    if (this.phase !== 'playing' || this.seatedSpot || !this.isGrounded || this.slideTimer > 0) return;
    this.breachTimer = 0;
    this.isCrouchToggle = false;
    this.triggerSlide();
    this.emitHud();
  }

  private triggerSlide() {
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    this.slideDuration = THREE.MathUtils.clamp(0.42 + horizSpeed * 0.024, 0.48, 0.72);
    this.slideTimer = this.slideDuration;
    this.slideDustAccum = 0;
    this.peekDir = 0;
    if (horizSpeed > 1.2) {
      this.slideDir.set(this.playerVel.x, 0, this.playerVel.z).normalize();
    } else {
      this.slideDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    }
    soundEngine.playSlide();
  }

  public triggerJump() {
    if (this.phase !== 'playing' || this.seatedSpot) return;
    if (this.swimState.isSwimming) {
      const inMansionPool =
        this.playerPos.x >= MANSION_POOL_BOUNDS.minX &&
        this.playerPos.x <= MANSION_POOL_BOUNDS.maxX &&
        this.playerPos.z >= MANSION_POOL_BOUNDS.minZ &&
        this.playerPos.z <= MANSION_POOL_BOUNDS.maxZ;
      const nearPoolRim =
        inMansionPool &&
        (this.playerPos.x <= MANSION_POOL_BOUNDS.minX + 1.6 ||
          this.playerPos.x >= MANSION_POOL_BOUNDS.maxX - 1.6 ||
          this.playerPos.z <= MANSION_POOL_BOUNDS.minZ + 1.6 ||
          this.playerPos.z >= MANSION_POOL_BOUNDS.maxZ - 1.6);
      if (nearPoolRim && this.playerPos.y >= MANSION_POOL_BOUNDS.waterY - 1.35) {
        this.swimState.isSwimming = false;
        this.playerPos.y = 0.25;
        this.playerVel.y = 6.2;
        this.isGrounded = false;
        soundEngine.playSwimStroke(true);
      } else {
        this.swimState.vy = Math.max(this.swimState.vy, 3.6);
      }
      return;
    }
    if (this.isGrounded) {
      this.isCrouchToggle = false;
      this.slideTimer = 0;
      this.breachTimer = 0;
      this.peekDir = 0;
      this.playerVel.y = 8.6;
      this.isGrounded = false;
    }
  }

  public cycleCoverPeek() {
    if (this.phase !== 'playing' || this.seatedSpot) return;
    if (!this.isInCover) {
      this.peekDir = 0;
      return;
    }
    if (this.peekDir === 0) this.peekDir = 1;
    else if (this.peekDir === 1) this.peekDir = -1;
    else this.peekDir = 0;
    this.emitHud();
  }

  public triggerBreach() {
    if (this.phase !== 'playing' || this.seatedSpot || !this.nearDoorway || this.breachTimer > 0 || !this.isGrounded) return;
    const door = this.nearDoorway;
    this.isCrouchToggle = false;
    this.slideTimer = 0;
    this.peekDir = 0;
    this.isAdsToggle = false;
    this.activeBreachDoorway = door;
    this.breachTotal = 0.95;
    this.breachTimer = this.breachTotal;
    this.breachStartPos.copy(this.playerPos);
    this.breachEndPos.set(
      door.x + door.inwardDirX * 2.4,
      this.playerPos.y,
      door.z + door.inwardDirZ * 2.4,
    );
    this.breachBaseYaw = Math.atan2(-door.inwardDirX, -door.inwardDirZ);
    soundEngine.playBreachReady();
    this.emitHud();
  }

  public throwGrenade() {
    if (this.phase !== 'playing' || this.grenades <= 0 || this.grenadeAnimTimer > 0) return;
    soundEngine.unlock();
    this.cancelReloadCleanly();
    this.isAdsToggle = false;
    this.grenadeAnimTimer = this.grenadeAnimDuration;
    this.grenadePinPulled = false;
    this.grenadeReleased = false;
    this.emitHud();
  }

  private spawnThrownGrenadeProjectile() {
    if (this.grenades <= 0) return;
    this.grenades--;
    const mesh = new THREE.Mesh(this.grenadeGeo, this.grenadeMat);
    _throwOrigin.copy(this.camera.position);
    _raycaster.setFromCamera(_zeroNdc, this.camera);
    _throwDir.copy(_raycaster.ray.direction).normalize();
    _throwOrigin.addScaledVector(_throwDir, 0.72);
    mesh.position.copy(_throwOrigin);
    this.scene.add(mesh);

    const origin = _throwOrigin.clone();
    const vel = _throwDir.clone().multiplyScalar(20.5);
    vel.y += 5.4;
    this.thrownGrenades.push({
      mesh,
      position: origin,
      velocity: vel,
      fuse: 1.5,
    });
    soundEngine.playGrenadeBounce();
  }

  private spawnDroppingMagazine() {
    this.ensureVfxPoolsInitialized();
    const vm = this.viewModels[this.activeWeapon];
    if (this.perspective === 'first' && vm) {
      vm.magGroup.getWorldPosition(_v2);
    } else {
      _v2.set(this.playerPos.x, this.playerPos.y + 1.15, this.playerPos.z);
    }
    const slot = this.acquirePooledSlot(this.droppingMags);
    if (!slot) return;
    slot.active = true;
    slot.mesh.visible = true;
    slot.mesh.position.copy(_v2);
    slot.mesh.rotation.set(0, 0, 0);
    slot.velocity.set((Math.random() - 0.5) * 0.9, -0.5, (Math.random() - 0.5) * 0.9);
    slot.rotVel.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    slot.life = 1.8;
  }

  private isCurrentlyAds(): boolean {
    if (this.activeWeapon === 'unarmed') return false;
    return this.isAdsToggle && !this.isReloading && this.grenadeAnimTimer <= 0;
  }

  /**
   * Fast analytical Ray vs OBB/AABB segment test against arena colliders.
   * Returns normalized hit distance `t` in meters along `dir` up to `maxDist`, or `maxDist + 1` if clear.
   * Optionally populates `outNormal` (world space outward face normal) and `outSurface`.
   */
  private raycastColliders(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    outNormal?: THREE.Vector3,
    outSurface?: { surface: SurfaceType },
  ): number {
    if (!this.arena) return maxDist + 1;
    const colliders = this.arena.colliders;
    let closestT = maxDist + 1;

    const testCollider = (c: ColliderBox) => {
      if (c.maxY <= -50) return;

      let rox = ox;
      let roz = oz;
      let rdx = dx;
      let rdz = dz;
      let minX = c.minX;
      let maxX = c.maxX;
      let minZ = c.minZ;
      let maxZ = c.maxZ;
      const isRotated = Math.abs(c.rotY) > 0.001;

      if (isRotated) {
        const relX = ox - c.cx;
        const relZ = oz - c.cz;
        rox = relX * c.cosY - relZ * c.sinY;
        roz = relX * c.sinY + relZ * c.cosY;
        rdx = dx * c.cosY - dz * c.sinY;
        rdz = dx * c.sinY + dz * c.cosY;
        minX = -c.halfW;
        maxX = c.halfW;
        minZ = -c.halfD;
        maxZ = c.halfD;
      }

      let tMin = 0.02;
      let tMax = Math.min(maxDist, closestT);
      let hitAxis = -1; // 0=X, 1=Y, 2=Z
      let hitSign = 1;

      // X slab
      if (Math.abs(rdx) < 1e-6) {
        if (rox < minX || rox > maxX) return;
      } else {
        const invX = 1 / rdx;
        let t1 = (minX - rox) * invX;
        let t2 = (maxX - rox) * invX;
        let sign = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          sign = 1;
        }
        if (t1 > tMin) {
          tMin = t1;
          hitAxis = 0;
          hitSign = sign;
        }
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return;
      }

      // Y slab
      if (Math.abs(dy) < 1e-6) {
        if (oy < c.minY || oy > c.maxY) return;
      } else {
        const invY = 1 / dy;
        let t1 = (c.minY - oy) * invY;
        let t2 = (c.maxY - oy) * invY;
        let sign = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          sign = 1;
        }
        if (t1 > tMin) {
          tMin = t1;
          hitAxis = 1;
          hitSign = sign;
        }
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return;
      }

      // Z slab
      if (Math.abs(rdz) < 1e-6) {
        if (roz < minZ || roz > maxZ) return;
      } else {
        const invZ = 1 / rdz;
        let t1 = (minZ - roz) * invZ;
        let t2 = (maxZ - roz) * invZ;
        let sign = -1;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
          sign = 1;
        }
        if (t1 > tMin) {
          tMin = t1;
          hitAxis = 2;
          hitSign = sign;
        }
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return;
      }

      if (tMin <= maxDist && tMin < closestT) {
        closestT = tMin;
        if (outSurface) outSurface.surface = c.surface;
        if (outNormal) {
          const nx = hitAxis === 0 ? hitSign : 0;
          const ny = hitAxis === 1 ? hitSign : 0;
          const nz = hitAxis === 2 ? hitSign : 0;
          if (hitAxis === -1) {
            outNormal.set(-dx, -dy, -dz).normalize();
          } else if (isRotated) {
            outNormal.set(
              nx * c.cosY + nz * c.sinY,
              ny,
              -nx * c.sinY + nz * c.cosY,
            ).normalize();
          } else {
            outNormal.set(nx, ny, nz);
          }
        }
      }
    };

    if (this.arenaColliderGrid && maxDist <= 64) {
      const endX = ox + dx * maxDist;
      const endZ = oz + dz * maxDist;
      forEachColliderInBounds(
        this.arenaColliderGrid,
        Math.min(ox, endX) - 1,
        Math.min(oz, endZ) - 1,
        Math.max(ox, endX) + 1,
        Math.max(oz, endZ) + 1,
        (idx) => testCollider(colliders[idx]),
      );
    } else {
      for (let i = 0; i < colliders.length; i++) {
        testCollider(colliders[i]);
      }
    }

    return closestT;
  }

  private getWaterLevelAt(x: number, z: number): number | null {
    if (this.mapId === 'simulator_city') {
      if (
        x >= MANSION_POOL_BOUNDS.minX &&
        x <= MANSION_POOL_BOUNDS.maxX &&
        z >= MANSION_POOL_BOUNDS.minZ &&
        z <= MANSION_POOL_BOUNDS.maxZ
      ) {
        return MANSION_POOL_BOUNDS.waterY;
      }
      if (x >= -265 && x <= -24 && Math.abs(z - 166) <= 10.5) return -0.95;
      if (x >= 558 && x <= 784 && Math.abs(z) <= 335) return -0.45;
      if (x >= -440 && x <= -268 && Math.abs(z) <= 335) return -0.45;
      const dxLake = x + 216;
      const dzLake = z + 158;
      if (dxLake * dxLake + dzLake * dzLake <= 17.5 * 17.5) return -0.75;
      if (x >= 19 && x <= 33 && z >= 49.5 && z <= 57.0) return 0.16;
    }
    if (this.arena) {
      const gy = this.arena.groundHeightAt(x, z, -0.3);
      if (gy < -0.25) return -0.45;
    }
    return null;
  }

  private isSandZoneAt(x: number, z: number, gy: number): boolean {
    if (this.mapId !== 'simulator_city' || gy < -0.25) return false;
    if (isOnMegaRoad(x, z) || isInsidePavedBuildingPad(x, z)) return false;
    if (x >= 542 && x <= 576 && Math.abs(z) <= 335) return true;
    if (((x >= -462 && x <= -424) || (x >= -286 && x <= -265)) && Math.abs(z) <= 335) return true;
    if ((x < -895 && z > 35) || x <= -1135 || (Math.abs(z) > 292 && x < -265)) return true;
    if ((x >= 780 && x <= 792) || (Math.abs(z) > 304 && x >= 740) || x > 1478) return true;
    return false;
  }

  /**
   * Fast analytical raycast against all building/barrier OBB colliders, explosive barrels, water planes, and terrain/ramps.
   * Returns distance, barrel reference, surface material type, and optionally world hit normal.
   */
  private raycastEnvironment(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    outPoint: THREE.Vector3,
    outNormal?: THREE.Vector3,
  ): { dist: number; barrel: BarrelActor | null; surface: SurfaceType; hitPuddle?: boolean } {
    if (!this.arena) return { dist: maxDist + 1, barrel: null, surface: 'concrete' };

    const surfaceHolder: { surface: SurfaceType } = { surface: 'concrete' };
    let bestDist = this.raycastColliders(ox, oy, oz, dx, dy, dz, maxDist, outNormal, surfaceHolder);
    let hitBarrel: BarrelActor | null = null;
    let hitPuddle = false;
    let surface: SurfaceType = surfaceHolder.surface;

    // 1. Analytical vertical-cylinder (standing) or sphere (fallen) + gasoline puddle tests for barrels & petrol pumps
    const barrels = this.arena.barrels;
    const horizLenSq = dx * dx + dz * dz;
    for (let i = 0; i < barrels.length; i++) {
      const b = barrels[i];
      if (b.exploded) continue;
      if (b.fallen) {
        const bx = b.position.x;
        const by = b.position.y + 0.45;
        const bz = b.position.z;
        const fx = ox - bx;
        const fy = oy - by;
        const fz = oz - bz;
        const halfB = fx * dx + fy * dy + fz * dz;
        const c = fx * fx + fy * fy + fz * fz - 0.68 * 0.68;
        const disc = halfB * halfB - c;
        if (disc >= 0) {
          const t = -halfB - Math.sqrt(disc);
          if (t >= 0.02 && t <= bestDist) {
            bestDist = t;
            hitBarrel = b;
            hitPuddle = false;
            surface = 'metal';
            if (outNormal) {
              outNormal.set(ox + dx * t - bx, oy + dy * t - by, oz + dz * t - bz).normalize();
            }
          }
        }
      } else if (horizLenSq > 1e-6) {
        const r = b.kind === 'petrol_pump' ? 0.72 : 0.5;
        const rSq = r * r;
        const maxH = b.kind === 'petrol_pump' ? 2.3 : 1.32;
        const fx = ox - b.position.x;
        const fz = oz - b.position.z;
        const halfB = fx * dx + fz * dz;
        const c = fx * fx + fz * fz - rSq;
        const disc = halfB * halfB - horizLenSq * c;
        if (disc >= 0) {
          const t = (-halfB - Math.sqrt(disc)) / horizLenSq;
          if (t >= 0.02 && t <= bestDist) {
            const hitY = oy + dy * t;
            if (hitY >= b.position.y - 0.05 && hitY <= b.position.y + maxH) {
              bestDist = t;
              hitBarrel = b;
              hitPuddle = false;
              surface = 'metal';
              if (outNormal) {
                outNormal.set(ox + dx * t - b.position.x, 0, oz + dz * t - b.position.z).normalize();
              }
            }
          }
        }
      }

      // Check shot hitting leaking gasoline puddle on ground so fire crawls back to barrel
      if (b.leaking && !b.ignited && b.puddlePos && (b.puddleRadius ?? 0) > 0.16 && dy < -0.002) {
        const pY = b.puddlePos.y + 0.04;
        if (oy > pY) {
          const tP = (pY - oy) / dy;
          if (tP > 0.05 && tP < bestDist && tP <= maxDist) {
            const px = ox + dx * tP;
            const pz = oz + dz * tP;
            const pRad = (b.puddleRadius ?? 0.5) + 0.28;
            const ddx = px - b.puddlePos.x;
            const ddz = pz - b.puddlePos.z;
            if (ddx * ddx + ddz * ddz <= pRad * pRad) {
              bestDist = tP;
              hitBarrel = b;
              hitPuddle = true;
              surface = 'dirt';
              if (outNormal) outNormal.set(0, 1, 0);
            }
          }
        }
      }
    }

    // 1b. Analytical ray-water-plane intersection so shots hitting rivers, bay, lake & pool trigger water splashes
    if (dy < -0.002) {
      const waterPlanes = this.mapId === 'simulator_city' ? [-0.95, -0.75, -0.45, 0.16] : [-0.45];
      for (let w = 0; w < waterPlanes.length; w++) {
        const wY = waterPlanes[w];
        if (oy <= wY + 0.02) continue;
        const tW = (wY - oy) / dy;
        if (tW > 0.05 && tW < bestDist && tW <= maxDist) {
          const wx = ox + dx * tW;
          const wz = oz + dz * tW;
          const actualWy = this.getWaterLevelAt(wx, wz);
          if (actualWy !== null && Math.abs(actualWy - wY) < 0.06) {
            bestDist = tW;
            hitBarrel = null;
            surface = 'water';
            if (outNormal) outNormal.set(0, 1, 0);
          }
        }
      }
    }

    // 2. Analytical terrain & ramp surface raymarch + binary refinement
    const searchLimit = Math.min(maxDist, bestDist);
    if (searchLimit > 0.2) {
      let prevT = 0.05;
      let prevDiff = oy + dy * prevT - this.arena.groundHeightAt(ox + dx * prevT, oz + dz * prevT);
      const step = Math.max(1.8, searchLimit / 26);
      for (let t = step; t <= searchLimit + step * 0.5; t += step) {
        const clampedT = Math.min(t, searchLimit);
        const px = ox + dx * clampedT;
        const py = oy + dy * clampedT;
        const pz = oz + dz * clampedT;
        const gy = this.arena.groundHeightAt(px, pz);
        const diff = py - gy;
        if (diff <= 0 && prevDiff > 0) {
          let lo = prevT;
          let hi = clampedT;
          for (let k = 0; k < 4; k++) {
            const mid = (lo + hi) * 0.5;
            const mDiff = oy + dy * mid - this.arena.groundHeightAt(ox + dx * mid, oz + dz * mid);
            if (mDiff > 0) lo = mid;
            else hi = mid;
          }
          const exactT = (lo + hi) * 0.5;
          if (exactT < bestDist) {
            bestDist = exactT;
            hitBarrel = null;
            const gx = ox + dx * exactT;
            const gz = oz + dz * exactT;
            const gHitY = this.arena.groundHeightAt(gx, gz);
            let onRamp = false;
            for (let rIdx = 0; rIdx < this.arena.ramps.length; rIdx++) {
              const r = this.arena.ramps[rIdx];
              if (gx >= r.minX && gx <= r.maxX && gz >= r.minZ && gz <= r.maxZ) {
                onRamp = true;
                break;
              }
            }
            const inWest = gx >= -45.5 && gx <= 44.5 && Math.abs(gz) <= 33.5;
            const inEast = gx > 44.0 && gx <= 135.5 && Math.abs(gz) <= 36.5;
            if (onRamp) {
              surface = 'wood';
            } else if (this.getWaterLevelAt(gx, gz) !== null && gHitY < -0.22) {
              surface = 'water';
            } else if (this.isSandZoneAt(gx, gz, gHitY)) {
              surface = 'sand';
            } else if (this.mapId === 'simulator_city') {
              surface = isOnMegaRoad(gx, gz) || isInsidePavedBuildingPad(gx, gz) ? 'concrete' : 'dirt';
            } else {
              surface = inWest || inEast ? 'concrete' : 'dirt';
            }
            if (outNormal) {
              const hx = this.arena.groundHeightAt(gx + 0.15, gz) - this.arena.groundHeightAt(gx - 0.15, gz);
              const hz = this.arena.groundHeightAt(gx, gz + 0.15) - this.arena.groundHeightAt(gx, gz - 0.15);
              outNormal.set(-hx, 0.3, -hz).normalize();
            }
          }
          break;
        }
        prevT = clampedT;
        prevDiff = diff;
        if (clampedT >= searchLimit) break;
      }
    }

    if (bestDist <= maxDist) {
      outPoint.set(ox + dx * bestDist, oy + dy * bestDist, oz + dz * bestDist);
      if (!hitBarrel) {
        for (let i = 0; i < barrels.length; i++) {
          const b = barrels[i];
          if (b.exploded || !b.leaking || b.ignited || !b.puddlePos) continue;
          const pRad = (b.puddleRadius ?? 0.5) + 0.34;
          const ddx = outPoint.x - b.puddlePos.x;
          const ddz = outPoint.z - b.puddlePos.z;
          if (ddx * ddx + ddz * ddz <= pRad * pRad && Math.abs(outPoint.y - b.puddlePos.y) < 0.5) {
            hitBarrel = b;
            hitPuddle = true;
            break;
          }
        }
      }
    }
    return { dist: bestDist, barrel: hitBarrel, surface, hitPuddle };
  }

  private detectFootstepSurface(
    x: number,
    z: number,
  ): 'concrete' | 'metal' | 'wood' | 'dirt' | 'water' | 'sand' {
    if (!this.arena) return 'concrete';
    const gy = this.arena.groundHeightAt(x, z, this.playerPos.y);
    const wY = this.getWaterLevelAt(x, z);
    if (gy < -0.25 || (wY !== null && gy <= wY + 0.12)) return 'water';
    for (let i = 0; i < this.arena.ramps.length; i++) {
      const r = this.arena.ramps[i];
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        return Math.abs(r.endY - r.startY) > 1.5 ? 'metal' : 'wood';
      }
    }
    let hitSurf: 'concrete' | 'metal' | 'wood' | 'dirt' | 'water' | 'sand' | null = null;
    if (this.arenaColliderGrid) {
      const cols = this.arena.colliders;
      forEachColliderInBounds(
        this.arenaColliderGrid,
        x - 0.5,
        z - 0.5,
        x + 0.5,
        z + 0.5,
        (idx) => {
          if (hitSurf !== null) return;
          const c = cols[idx];
          if (
            Math.abs(this.playerPos.y - c.maxY) < 0.45 &&
            x >= c.minX - 0.3 &&
            x <= c.maxX + 0.3 &&
            z >= c.minZ - 0.3 &&
            z <= c.maxZ + 0.3
          ) {
            hitSurf = c.surface;
          }
        },
      );
    }
    if (hitSurf !== null) return hitSurf;
    if (this.mapId === 'simulator_city') {
      if (isOnMegaRoad(x, z) || isInsidePavedBuildingPad(x, z)) return 'concrete';
      if (this.isSandZoneAt(x, z, gy)) return 'sand';
      return 'dirt';
    }
    const inCompound =
      (x >= -45.5 && x <= 44.5 && Math.abs(z) <= 33.5) ||
      (x > 44.0 && x <= 135.5 && Math.abs(z) <= 36.5);
    return inCompound ? 'concrete' : 'dirt';
  }

  private emitSoundAlert(origin: THREE.Vector3, radius: number, reason: 'gunshot' | 'footstep') {
    if (radius <= 0) return;
    if (reason === 'gunshot') {
      this.arena?.npcManager?.alertNearbyCivilians?.(origin.x, origin.z, radius);
    }
  }

  private spawnShockRing(center: THREE.Vector3, colorHex: number, maxScale: number, maxLife = 0.42, quat?: THREE.Quaternion) {
    this.ensureVfxPoolsInitialized();
    const slot = this.acquirePooledSlot(this.shockRings);
    if (!slot) return;
    slot.active = true;
    slot.mat.color.setHex(colorHex);
    slot.mat.opacity = 0.85;
    slot.mesh.visible = true;
    slot.mesh.position.copy(center);
    slot.mesh.position.y += 0.08;
    if (quat) slot.mesh.quaternion.copy(quat);
    else slot.mesh.quaternion.identity();
    slot.mesh.scale.setScalar(0.35);
    slot.life = maxLife;
    slot.maxLife = maxLife;
    slot.maxScale = maxScale;
  }

  private spawnExplosionFlash(
    center: THREE.Vector3,
    colorHex: number,
    startScale: number,
    maxScale: number,
    life: number,
    startOpacity: number,
  ) {
    this.ensureVfxPoolsInitialized();
    const slot = this.acquirePooledSlot(this.explosions);
    if (!slot) return;
    slot.active = true;
    slot.mat.color.setHex(colorHex);
    slot.mat.opacity = startOpacity;
    slot.mesh.visible = true;
    slot.mesh.position.copy(center);
    slot.mesh.scale.setScalar(startScale);
    slot.life = life;
    slot.maxLife = life;
    slot.startScale = startScale;
    slot.maxScale = maxScale;
    slot.startOpacity = startOpacity;
  }

  private detonateExplosion(
    centerInput: THREE.Vector3,
    radius: number,
    maxDamage: number,
    isRocket = false,
    isGrenade = false,
    skipVehicleChain = false,
    isDrum = false,
    isBigExplosion = false,
    inWater = false,
  ) {
    const center = _expCenter.copy(centerInput);
    if (isBigExplosion) {
      soundEngine.playBigExplosion();
    } else if (isDrum) {
      soundEngine.playDrumExplosion();
    } else if (isGrenade) {
      soundEngine.playGrenadeExplosion(inWater);
    } else if (isRocket) {
      soundEngine.playRocketExplosion();
    } else {
      soundEngine.playExplosion();
    }
    if (inWater) {
      this.spawnWaterSplash(center, 2.75, true);
      this.spawnImpactSparks(center, 0xe0f2fe, 14, 1.45);
    } else if (this.isSandZoneAt(center.x, center.z, center.y)) {
      this.spawnSandPuff(center, _waterSplashNorm, 2.3);
    }
    this.emitSoundAlert(center, isBigExplosion ? 85 : isRocket ? 58 : 46, 'gunshot');

    // Dynamic blast illumination + distance-scaled camera shake
    this.explosionLight.position.set(center.x, center.y + 1.4, center.z);
    this.explosionLight.intensity = isBigExplosion ? 36 : isRocket ? 28 : 14;
    const playerDist = this.playerPos.distanceTo(center);
    if (playerDist < 38) {
      const shakePower = (1 - playerDist / 38) * (isBigExplosion ? 0.1 : isRocket ? 0.085 : 0.045);
      this.screenShake = Math.max(this.screenShake, shakePower);
    }

    // Fiery debris, sparks & rising smoke plume
    const isHeavyVisual = isRocket || isBigExplosion;
    this.spawnImpactSparks(center, 0xff5500, isHeavyVisual ? 30 : 20, isHeavyVisual ? 1.95 : 1.4);
    this.spawnImpactSparks(center, 0xfacc15, isHeavyVisual ? 20 : 12, isHeavyVisual ? 1.7 : 1.3);
    this.spawnMuzzleSmoke(center, isHeavyVisual ? 4.2 : 2.2);

    // 1. Expanding fiery outer blast sphere (pooled)
    this.spawnExplosionFlash(
      center,
      isHeavyVisual ? 0xff5500 : 0xff7b29,
      0.55,
      radius * (isHeavyVisual ? 0.88 : 0.7),
      isHeavyVisual ? 0.48 : 0.32,
      0.82,
    );

    // 2. White-hot blinding inner detonation core (pooled)
    this.spawnExplosionFlash(center, 0xfff3b0, 0.35, radius * 0.46, 0.22, 0.95);

    // 3. Expanding shockwave pressure ring (pooled)
    this.spawnShockRing(
      center,
      isHeavyVisual ? 0xff9f1c : 0xfbbf24,
      radius * (isHeavyVisual ? 1.24 : 0.92),
      isHeavyVisual ? 0.48 : 0.34,
    );

    let killedAny = false;
    let damagedAny = false;

    if (this.arena?.npcManager && maxDamage > 0) {
      const npcSplash = this.arena.npcManager.damageInRadius(center, radius, maxDamage, this.playerPos);
      if (npcSplash.damaged) damagedAny = true;
      if (npcSplash.killedCount > 0) {
        killedAny = true;
        this.kills += npcSplash.killedCount;
        this.score += npcSplash.killedCount * 120;
        soundEngine.playHitmarker(false, true);
      }
    }

    if (this.arena?.smartCity && maxDamage > 0) {
      if (this.arena.smartCity.handleExplosion(center, radius, maxDamage)) {
        damagedAny = true;
      }
    }

    // Damage nearby vehicles in blast radius (1 RPG hit destroys any vehicle!)
    if (!skipVehicleChain && maxDamage > 0) {
      for (let i = 0; i < this.vehicleManager.vehicles.length; i++) {
        const v = this.vehicleManager.vehicles[i];
        if (v.destroyed) continue;
        const dist = v.position.distanceTo(center);
        if (dist <= radius + 1.8) {
          if (isRocket && dist <= radius * 0.72) {
            this.damageVehicle(v, v.maxHp, true);
          } else {
            const falloff = Math.max(0.2, 1 - dist / (radius + 1.8));
            this.damageVehicle(v, Math.round(maxDamage * falloff), false);
          }
        }
      }
    }

    if (killedAny) {
      this.hitMarker = 'kill';
      this.hitMarkerTimer = 0.24;
    } else if (damagedAny) {
      this.hitMarker = 'body';
      this.hitMarkerTimer = 0.16;
      soundEngine.playHitmarker(false, false);
    }

    // Chain-detonate nearby explosive barrels & shatter nearby building glass
    if (this.arena && maxDamage > 0) {
      for (let i = 0; i < this.arena.barrels.length; i++) {
        const b = this.arena.barrels[i];
        if (!b.exploded && b.position.distanceTo(center) < radius * 0.9) {
          this.triggerBarrelExplosion(b);
        }
      }
      if (this.arena.breakableGlass) {
        const glassRadSq = (radius * 0.85) * (radius * 0.85);
        for (let i = 0; i < this.arena.breakableGlass.length; i++) {
          const g = this.arena.breakableGlass[i];
          if (g.broken) continue;
          g.mesh.getWorldPosition(_v1);
          if (_v1.distanceToSquared(center) < glassRadSq) {
            if (hitBreakableGlassPane(g, maxDamage) === 'shattered') {
              this.spawnGlassShards(_v1, 8);
            }
          }
        }
      }
      if (this.arena.shootableScreens && this.arena.displays) {
        for (let i = 0; i < this.arena.shootableScreens.length; i++) {
          const scr = this.arena.shootableScreens[i];
          scr.updateWorldMatrix(true, false);
          _screenBox.setFromObject(scr);
          _screenBox.clampPoint(center, _screenClosestPt);
          const distToScr = _screenClosestPt.distanceTo(center);
          if (distToScr <= radius + 0.8) {
            const mat = (scr as THREE.Mesh).material;
            const entry = this.arena.displays.getEntryByMaterial(mat);
            if (entry) {
              const falloff = Math.max(0.35, 1 - distToScr / (radius + 0.8));
              const blastDmg = Math.max(48, Math.round(maxDamage * falloff));
              const scrRes = this.arena.displays.hitDisplayEntry(
                entry,
                0.35 + Math.random() * 0.3,
                0.35 + Math.random() * 0.3,
                blastDmg,
                this.elapsedTime,
              );
              const dPlayer = _screenClosestPt.distanceTo(this.playerPos);
              soundEngine.playScreenGlitch(scrRes === 'shattered', dPlayer);
              scr.getWorldQuaternion(_screenQuat);
              _screenNormal.set(0, 0, 1).applyQuaternion(_screenQuat).normalize();
              _screenBox.getSize(_v2);
              const sparkScale = Math.min(3.5, Math.max(1.2, Math.max(_v2.x, _v2.y) * 0.45));
              this.spawnScreenElectricSpark(_screenClosestPt, _screenNormal, sparkScale);
              this.spawnImpactSparks(_screenClosestPt, 0x38bdf8, scrRes === 'shattered' ? 10 : 6, 1.35);
              if (scrRes === 'shattered') {
                this.spawnGlassShards(_screenClosestPt, 12);
              }
            }
          }
        }
      }
    }

    // Self-damage if player stands inside blast core
    if (maxDamage > 0 && playerDist < radius * 0.62) {
      const pDmg = Math.round((isRocket ? 48 : 35) * (1 - playerDist / (radius * 0.62)));
      if (pDmg > 3) this.applyDamageToPlayer(pDmg, false, 'explosion');
    }

    this.emitHud();
  }

  private removeBarrelCollider(barrel: BarrelActor) {
    if (barrel.colliderRemoved || !this.arena) return;
    barrel.colliderRemoved = true;
    for (let i = 0; i < this.arena.colliders.length; i++) {
      const c = this.arena.colliders[i];
      if (c.surface !== 'metal' || c.maxY <= -50) continue;
      const cx = (c.minX + c.maxX) * 0.5;
      const cz = (c.minZ + c.maxZ) * 0.5;
      if (Math.hypot(cx - barrel.position.x, cz - barrel.position.z) < 1.15) {
        c.maxY = -100;
        break;
      }
    }
  }

  private hitBarrelActor(barrel: BarrelActor, hitPoint: THREE.Vector3, damage: number, hitPuddle = false) {
    if (barrel.exploded) return;
    const dist = hitPoint.distanceTo(this.playerPos);
    if (hitPuddle) {
      if (barrel.leaking && !barrel.ignited) {
        barrel.ignited = true;
        barrel.fireProgress = 0;
        if (barrel.fireMesh) barrel.fireMesh.visible = true;
        soundEngine.playGasolineIgnite(dist);
        this.spawnImpactSparks(hitPoint, 0xff6b1a, 8, 1.1);
      }
      return;
    }

    barrel.bulletHits = (barrel.bulletHits ?? 0) + 1;
    barrel.health -= damage;
    this.spawnImpactSparks(hitPoint, 0xf97316, 5, 1.05);

    if (damage >= 55 || barrel.bulletHits >= 2 || barrel.health <= 0 || barrel.ignited) {
      this.triggerBarrelExplosion(barrel);
      return;
    }

    if (!barrel.leaking) {
      barrel.leaking = true;
      let ldx = hitPoint.x - barrel.position.x;
      let ldz = hitPoint.z - barrel.position.z;
      const len = Math.hypot(ldx, ldz);
      if (len > 0.05) {
        ldx /= len;
        ldz /= len;
      } else {
        ldx = 1;
        ldz = 0;
      }
      barrel.leakDirX = ldx;
      barrel.leakDirZ = ldz;
      barrel.leakHeight = barrel.fallen
        ? 0.34
        : THREE.MathUtils.clamp(hitPoint.y - barrel.position.y, 0.28, 0.96);
      barrel.puddleRadius = 0.24;
      const pDist = barrel.kind === 'petrol_pump' ? 1.15 : 0.92;
      const px = barrel.position.x + ldx * pDist;
      const pz = barrel.position.z + ldz * pDist;
      const gy = this.arena ? this.arena.groundHeightAt(px, pz, barrel.position.y) : barrel.position.y;
      if (!barrel.puddlePos) barrel.puddlePos = new THREE.Vector3();
      barrel.puddlePos.set(px, gy, pz);

      if (barrel.holeMesh) {
        barrel.holeMesh.visible = true;
        const hRad = barrel.kind === 'petrol_pump' ? 0.42 : 0.458;
        barrel.holeMesh.position.set(ldx * hRad, (barrel.leakHeight ?? 0.65) - 0.625, ldz * hRad);
        _v1.set(ldx * 2, (barrel.leakHeight ?? 0.65) - 0.625, ldz * 2);
        barrel.holeMesh.lookAt(barrel.tiltGroup ? barrel.tiltGroup.localToWorld(_v1.clone()) : _v1);
      }
      if (barrel.streamMesh) barrel.streamMesh.visible = true;
      if (barrel.puddleMesh) {
        barrel.puddleMesh.visible = true;
        barrel.puddleMesh.position.set(ldx * pDist, gy - barrel.position.y + 0.025, ldz * pDist);
        barrel.puddleMesh.scale.set(0.24, 1, 0.24);
      }
      soundEngine.playGasolineIgnite(dist);
    }
  }

  private stepBarrelsAndVehicleHits(dt: number) {
    if (!this.arena) return;
    const barrels = this.arena.barrels;
    const vehicles = this.vehicleManager.vehicles;

    // 1. Vehicle collisions with barrels (car/bike knocks barrel over, high speed detonates)
    for (let vi = 0; vi < vehicles.length; vi++) {
      const v = vehicles[vi];
      if (v.destroyed) continue;
      const absSpd = Math.abs(v.speed);
      if (absSpd < 1.2) continue;
      const vRad = v.kind === 'digital_bike' ? 1.15 : Math.max(v.spec.bodyW, v.spec.bodyL) * 0.44;
      for (let bi = 0; bi < barrels.length; bi++) {
        const b = barrels[bi];
        if (b.exploded) continue;
        const dx = b.position.x - v.position.x;
        const dz = b.position.z - v.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < vRad + 0.55 && Math.abs(v.position.y - b.position.y) < 2.2) {
          if (absSpd >= 14.0) {
            this.triggerBarrelExplosion(b);
          } else {
            const nx = dist > 0.05 ? dx / dist : -Math.sin(v.yaw);
            const nz = dist > 0.05 ? dz / dist : -Math.cos(v.yaw);
            if (!b.fallen) {
              b.fallen = true;
              this.removeBarrelCollider(b);
              b.tiltDirX = nx;
              b.tiltDirZ = nz;
              b.velX = nx * Math.max(4.5, absSpd * 0.72);
              b.velZ = nz * Math.max(4.5, absSpd * 0.72);
              soundEngine.playBarrelTip(v.position.distanceTo(this.playerPos));
              v.speed *= 0.86;
            } else {
              b.velX = (b.velX ?? 0) + nx * absSpd * 0.45;
              b.velZ = (b.velZ ?? 0) + nz * absSpd * 0.45;
            }
          }
        }
      }
    }

    // 2. Step fallen barrel sliding/tipping, gasoline puddle leak, and fire trail ignition
    for (let i = 0; i < barrels.length; i++) {
      const b = barrels[i];
      if (b.exploded) continue;
      if (!b.fallen && !b.leaking && !b.ignited) continue;

      if (b.fallen) {
        b.tiltAngle = Math.min(Math.PI * 0.5, (b.tiltAngle ?? 0) + dt * 5.6);
        const vx = b.velX ?? 0;
        const vz = b.velZ ?? 0;
        if (Math.abs(vx) > 0.04 || Math.abs(vz) > 0.04) {
          b.position.x += vx * dt;
          b.position.z += vz * dt;
          b.velX = vx * Math.exp(-2.8 * dt);
          b.velZ = vz * Math.exp(-2.8 * dt);
          b.rollAngle = (b.rollAngle ?? 0) + Math.hypot(vx, vz) * dt * 1.4;
        }
        b.position.y = this.arena.groundHeightAt(b.position.x, b.position.z, b.position.y);
        b.group.position.copy(b.position);

        if (b.tiltGroup) {
          const tdx = b.tiltDirX ?? 1;
          const tdz = b.tiltDirZ ?? 0;
          _v2.set(-tdz, 0, tdx).normalize();
          b.tiltGroup.quaternion.setFromAxisAngle(_v2, b.tiltAngle);
          b.tiltGroup.position.y = THREE.MathUtils.lerp(0.625, 0.45, b.tiltAngle / (Math.PI * 0.5));
          b.tiltGroup.rotateY(b.rollAngle ?? 0);
        }
      }

      if (b.leaking) {
        const ldx = b.leakDirX ?? 1;
        const ldz = b.leakDirZ ?? 0;
        const pDist = b.kind === 'petrol_pump' ? 1.15 : 0.92;
        b.puddleRadius = Math.min(1.68, (b.puddleRadius ?? 0.24) + dt * 0.42);
        const px = b.position.x + ldx * pDist;
        const pz = b.position.z + ldz * pDist;
        const gy = this.arena.groundHeightAt(px, pz, b.position.y);
        if (!b.puddlePos) b.puddlePos = new THREE.Vector3();
        b.puddlePos.set(px, gy, pz);

        const localPy = gy - b.position.y + 0.025;
        if (b.puddleMesh) {
          b.puddleMesh.visible = true;
          b.puddleMesh.position.set(ldx * pDist, localPy, ldz * pDist);
          b.puddleMesh.scale.set(b.puddleRadius, 1, b.puddleRadius);
        }
        const hx = b.fallen ? ldx * 0.28 : ldx * 0.45;
        const hy = b.fallen ? 0.32 : (b.leakHeight ?? 0.65);
        const hz = b.fallen ? ldz * 0.28 : ldz * 0.45;
        if (b.streamMesh) {
          b.streamMesh.visible = true;
          _v1.set(hx, hy, hz);
          _v2.set(ldx * pDist, localPy, ldz * pDist);
          _v3.subVectors(_v1, _v2);
          const sLen = Math.max(0.12, _v3.length());
          b.streamMesh.position.copy(_v1).add(_v2).multiplyScalar(0.5);
          _v3.divideScalar(sLen);
          b.streamMesh.quaternion.setFromUnitVectors(_upAxis, _v3);
          b.streamMesh.scale.set(1, sLen, 1);
        }

        if (b.ignited) {
          b.fireProgress = Math.min(1, (b.fireProgress ?? 0) + dt * 1.18);
          const fp = b.fireProgress;
          if (b.fireMesh) {
            b.fireMesh.visible = true;
            if (fp < 0.45) {
              const pT = fp / 0.45;
              const startR = pDist + b.puddleRadius * 0.55;
              const curR = THREE.MathUtils.lerp(startR, pDist, pT);
              b.fireMesh.position.set(ldx * curR, localPy + 0.14, ldz * curR);
            } else {
              const sT = (fp - 0.45) / 0.55;
              b.fireMesh.position.set(
                THREE.MathUtils.lerp(ldx * pDist, hx, sT),
                THREE.MathUtils.lerp(localPy + 0.14, hy, sT),
                THREE.MathUtils.lerp(ldz * pDist, hz, sT),
              );
            }
            const pulse = 0.85 + Math.sin(this.elapsedTime * 34 + b.id) * 0.26;
            b.fireMesh.scale.setScalar(pulse);
            if (Math.random() < dt * 14) {
              _v4.copy(b.position).add(b.fireMesh.position);
              this.spawnImpactSparks(_v4, 0xff8a1a, 1, 0.7);
            }
          }
          if (b.fireProgress >= 1) {
            this.triggerBarrelExplosion(b);
          }
        }
      }
    }
  }

  private triggerBarrelExplosion(barrel: BarrelActor) {
    if (barrel.exploded) return;
    barrel.exploded = true;
    barrel.group.visible = false;
    if (barrel.holeMesh) barrel.holeMesh.visible = false;
    if (barrel.streamMesh) barrel.streamMesh.visible = false;
    if (barrel.puddleMesh) barrel.puddleMesh.visible = false;
    if (barrel.fireMesh) barrel.fireMesh.visible = false;
    this.removeBarrelCollider(barrel);
    this.detonateExplosion(
      barrel.position,
      barrel.radius ?? 8.5,
      barrel.maxDamage ?? 165,
      false,
      false,
      false,
      true,
      Boolean(barrel.isBigExplosion),
    );
  }

  private fireRocket(muzzleWorld: THREE.Vector3, spread: number) {
    _raycaster.setFromCamera(_zeroNdc, this.camera);
    _rayOrigin.copy(_raycaster.ray.origin);
    _rayDir.copy(_raycaster.ray.direction);

    _rayDir.x += (Math.random() - 0.5) * spread;
    _rayDir.y += (Math.random() - 0.5) * spread;
    _rayDir.z += (Math.random() - 0.5) * spread;
    _rayDir.normalize();

    // Rear backblast venturi origin
    const vm = this.viewModels.rocket;
    if (this.perspective === 'first' && vm) {
      vm.ejectPoint.getWorldPosition(_venturiWorld);
    } else {
      _venturiWorld.copy(muzzleWorld).addScaledVector(_rayDir, -1.0);
    }

    // Launch Effects: Muzzle ignition flash + shock ring + rear backblast smoke + fiery sparks + camera punch
    this.muzzleFlashTimer = 0.1;
    this.muzzleLight.intensity = 12;
    this.screenShake = Math.max(this.screenShake, 0.036);
    this.spawnImpactSparks(muzzleWorld, 0xff9f1c, 12, 1.5);
    this.spawnMuzzleSmoke(muzzleWorld, 2.2);
    this.spawnImpactSparks(_venturiWorld, 0xfbbf24, 10, 1.3);
    this.spawnMuzzleSmoke(_venturiWorld, 3.2);

    this.spawnExplosionFlash(muzzleWorld, 0xffaa33, 0.18, 0.95, 0.14, 0.9);

    // Forward muzzle launch pressure ring perpendicular to firing line
    _ringQuat.setFromUnitVectors(_upAxis, _rayDir);
    this.spawnShockRing(muzzleWorld, 0xffaa33, 1.45, 0.22, _ringQuat);

    // Build visible 3D PG-7V Rocket Projectile
    const group = new THREE.Group();
    const body = new THREE.Mesh(this.rocketBodyGeo, this.rocketBodyMat);
    const cone = new THREE.Mesh(this.rocketConeGeo, this.rocketConeMat);
    cone.position.z = 0.28;
    const flameMesh = new THREE.Mesh(this.rocketFlameGeo, this.rocketFlameMat);
    flameMesh.position.z = -0.36;
    group.add(body, cone, flameMesh);

    const startPos = muzzleWorld.clone();
    group.position.copy(startPos);
    _v4.copy(startPos).add(_rayDir);
    group.lookAt(_v4);
    this.scene.add(group);

    this.rockets.push({
      group,
      flameMesh,
      position: startPos,
      velocity: _rayDir.clone().multiplyScalar(58),
      life: 4.5,
      smokeAccum: 0,
    });
  }

  private fireVehicleMachineGun() {
    if (
      this.phase !== 'playing' ||
      !this.activeVehicleId ||
      this.health <= 0 ||
      this.fireCooldown > 0
    ) {
      return;
    }
    const veh = this.vehicleManager.getById(this.activeVehicleId);
    if (!veh || veh.destroyed || !veh.spec || !veh.turretMuzzle) return;

    this.fireCooldown = 0.088;
    this.shotsFired++;
    soundEngine.playGunshot('m249', false, 'auto', false);
    this.emitSoundAlert(veh.position, 68, 'gunshot');

    if (veh.turretFlash) {
      veh.turretFlash.visible = true;
      this.vehicleTurretFlashTimer = 0.045;
    }

    if (veh.turretMuzzle) {
      veh.turretMuzzle.getWorldPosition(_muzzleWorld);
    } else {
      _muzzleWorld.set(veh.position.x, veh.position.y + 2.35, veh.position.z);
    }
    this.spawnMuzzleSmoke(_muzzleWorld, 0.9);

    const vehicleTargets = this.vehicleManager.shootableMeshes.filter((m) => !veh.hitMeshes.includes(m as THREE.Mesh));
    const simTargets = this.arena?.npcManager?.getShootableMeshes() ?? [];
    const scTargets = this.arena?.smartCity?.getShootableMeshes() ?? [];
    const wildlifeTargets = this.arena?.wildlifeProps?.shootableMeshes ?? [];
    const screenTargets = this.arena?.shootableScreens ?? [];
    const glassTargets =
      this.arena?.breakableGlass?.filter((g) => !g.broken).map((g) => g.mesh) ?? [];
    this.arena?.wildlifeProps?.scatterBirds(veh.position.x, veh.position.z, 45);

    _raycaster.setFromCamera(_zeroNdc, this.camera);
    _rayOrigin.copy(_raycaster.ray.origin);
    _rayDir.copy(_raycaster.ray.direction);
    _rayDir.x += (Math.random() - 0.5) * 0.012;
    _rayDir.y += (Math.random() - 0.5) * 0.012;
    _rayDir.z += (Math.random() - 0.5) * 0.012;
    _rayDir.normalize();

    const range = 165;
    _raycaster.set(_rayOrigin, _rayDir);
    _raycaster.far = range;

    const envRes = this.raycastEnvironment(
      _rayOrigin.x,
      _rayOrigin.y,
      _rayOrigin.z,
      _rayDir.x,
      _rayDir.y,
      _rayDir.z,
      range,
      _v3,
      _hitNormal,
    );
    const vehicleHits = vehicleTargets.length > 0 ? _raycaster.intersectObjects(vehicleTargets, false) : [];
    const simHits = simTargets.length > 0 ? _raycaster.intersectObjects(simTargets, false) : [];
    const scHits = scTargets.length > 0 ? _raycaster.intersectObjects(scTargets, false) : [];
    const wildlifeHits = wildlifeTargets.length > 0 ? _raycaster.intersectObjects(wildlifeTargets, false) : [];
    const screenHits = screenTargets.length > 0 ? _raycaster.intersectObjects(screenTargets, false) : [];

    const closestEnvDist = envRes.dist;
    if (glassTargets.length > 0 && this.arena?.breakableGlass) {
      const glassHits = _raycaster.intersectObjects(glassTargets, false);
      const firstGlass = glassHits.length > 0 ? glassHits[0] : null;
      if (firstGlass && firstGlass.distance < closestEnvDist) {
        const pane = this.arena.breakableGlass.find((g) => g.mesh === firstGlass.object && !g.broken);
        if (pane) {
          const glassRes = hitBreakableGlassPane(pane, 28);
          if (glassRes === 'cracked') {
            soundEngine.playGlassShatter(true, firstGlass.distance);
            this.spawnImpactSparks(firstGlass.point, 0xe0f2fe, 4, 0.8);
          } else if (glassRes === 'shattered') {
            this.spawnGlassShards(firstGlass.point, 14);
            soundEngine.playGlassShatter(false, firstGlass.distance);
          }
        }
      }
    }

    const hitEnv = closestEnvDist <= range;
    const closestVehicle = vehicleHits.length > 0 ? vehicleHits[0] : null;
    const closestSim = simHits.length > 0 ? simHits[0] : null;
    const closestSc = scHits.length > 0 ? scHits[0] : null;
    const closestWildlife = wildlifeHits.length > 0 ? wildlifeHits[0] : null;
    const closestScreen = screenHits.length > 0 ? screenHits[0] : null;
    const vehDist = closestVehicle ? closestVehicle.distance : Infinity;
    const simDist = closestSim ? closestSim.distance : Infinity;
    const scDist = closestSc ? closestSc.distance : Infinity;
    const wildDist = closestWildlife ? closestWildlife.distance : Infinity;
    const scrDist = closestScreen ? closestScreen.distance : Infinity;

    _v4.copy(_rayOrigin).addScaledVector(_rayDir, range);
    let anyHit = false;
    let anyHead = false;
    let anyKill = false;

    if (closestWildlife && wildDist < closestEnvDist && wildDist <= simDist && wildDist <= scDist && wildDist <= vehDist && this.arena?.wildlifeProps) {
      _v4.copy(closestWildlife.point);
      const wRes = this.arena.wildlifeProps.handleRayHit(closestWildlife.object, _rayDir, _v4, 28);
      if (wRes.kind === 'bird') {
        anyHit = true;
        anyKill = true;
        this.spawnBloodImpactFX(_v4, _rayDir, false, false, true);
        soundEngine.playBloodImpact(false, wildDist);
        soundEngine.playHitmarker(false, true);
        this.score += 75;
      } else if (wRes.kind === 'balloon') {
        anyHit = true;
        soundEngine.playBalloonPop(wildDist);
        soundEngine.playHitmarker(false, true);
        this.score += 100;
      } else if (wRes.kind === 'ball') {
        anyHit = true;
        if (wRes.burst) {
          soundEngine.playBalloonPop(wildDist);
          this.score += 40;
        } else {
          soundEngine.playBallBounce(wildDist);
        }
      }
    } else if (closestScreen && scrDist <= closestEnvDist + 0.3 && scrDist < simDist && scrDist < scDist && scrDist < vehDist && this.arena?.displays) {
      _v4.copy(closestScreen.point);
      const mat = (closestScreen.object as THREE.Mesh).material;
      const entry = this.arena.displays.getEntryByMaterial(mat);
      if (entry) {
        const uv = closestScreen.uv;
        const scrRes = this.arena.displays.hitDisplayEntry(entry, uv ? uv.x : 0.5, uv ? uv.y : 0.5, 28, this.elapsedTime);
        soundEngine.playScreenGlitch(scrRes === 'shattered', scrDist);
        if (closestScreen.face) {
          _screenNormal.copy(closestScreen.face.normal).transformDirection(closestScreen.object.matrixWorld).normalize();
        } else {
          _screenNormal.copy(_rayDir).negate();
        }
        this.spawnScreenElectricSpark(_v4, _screenNormal, scrRes === 'shattered' ? 1.8 : 1.35);
        this.spawnImpactSparks(_v4, scrRes === 'shattered' ? 0x38bdf8 : 0xf43f5e, scrRes === 'shattered' ? 8 : 4, 1.0);
        if (scrRes === 'shattered') this.spawnGlassShards(_v4, 10);
      }
    } else if (closestSc && scDist < closestEnvDist && scDist <= simDist && scDist <= vehDist && this.arena?.smartCity) {
      _v4.copy(closestSc.point);
      if (closestSc.face) {
        _hitNormal.copy(closestSc.face.normal).transformDirection(closestSc.object.matrixWorld).normalize();
      } else {
        _hitNormal.copy(_rayDir).negate();
      }
      const scRes = this.arena.smartCity.handleBulletHit(
        closestSc.object,
        _v4,
        _hitNormal,
        _rayDir,
        'm249',
        28,
      );
      if (scRes.hit) {
        anyHit = true;
        const isCrit =
          scRes.component === 'head' ||
          scRes.component === 'camera' ||
          scRes.component === 'battery' ||
          scRes.component === 'sensor';
        if (isCrit) anyHead = true;
        if (scRes.outcome?.newlyDestroyed) {
          anyKill = true;
          this.score += 150;
          soundEngine.playHitmarker(isCrit, true);
        }
      }
    } else if (closestSim && simDist < closestEnvDist && simDist <= vehDist && this.arena?.npcManager) {
      _v4.copy(closestSim.point);
      const res = this.arena.npcManager.damageByMesh(closestSim.object, 28, _v4, this.playerPos, 'm249');
      if (res.protectedBlocked) {
        this.interactFeedback = 'Children in parks are protected!';
        this.interactFeedbackTimer = 1.6;
      } else if (res.hit) {
        anyHit = true;
        if (res.isHead) anyHead = true;
        const hitDist = _v4.distanceTo(this.playerPos);
        if (res.kind === 'vehicle') {
          this.spawnImpactSparks(_v4, 0xffa62b, 5, 1.15);
          if (res.partResult === 'cracked') {
            soundEngine.playGlassShatter(true, hitDist);
          } else if (res.partResult === 'shattered') {
            soundEngine.playGlassShatter(false, hitDist);
            this.spawnGlassShards(_v4, 11);
          } else if (res.partResult === 'punctured') {
            soundEngine.playTirePuncture(hitDist);
            this.spawnTireAirPuff(_v4);
          }
        } else {
          this.spawnBloodImpactFX(_v4, _rayDir, res.isHead, false, res.killed);
          soundEngine.playBloodImpact(res.isHead, hitDist);
          soundEngine.playPainSound('enemy');
        }
        if (this.worldSystem === 'simulator') {
          const nearPol = this.arena.npcManager.getNearestPoliceDistance(this.playerPos.x, this.playerPos.z);
          if (res.kind === 'npc') {
            registerWantedIncident(this.wantedState, 'civilian_crime', nearPol, false);
          } else if (res.kind === 'police' || (res.kind === 'vehicle' && res.isPoliceVehicle)) {
            registerWantedIncident(this.wantedState, 'police_crime', nearPol, res.kind === 'police' && res.killed);
          } else if (res.kind === 'gang') {
            registerWantedIncident(this.wantedState, 'gang', nearPol, false);
          }
          if (this.wantedState.level > 0) {
            this.arena.npcManager.syncWantedPursuit(this.wantedState.level, this.playerPos.x, this.playerPos.z);
          }
        }
        if (res.killed) {
          anyKill = true;
          this.kills++;
          if (res.isHead) this.headshots++;
          const isBossKill = Boolean(res.label?.startsWith('[BOSS'));
          const pts = isBossKill ? 450 : res.kind === 'gang' ? 180 : 100;
          this.score += pts;
          if (isBossKill && res.label) {
            this.killFeed.unshift({
              id: this.nextKillFeedId++,
              text: `${res.label} +${pts}`,
              isHeadshot: res.isHead,
              isOnBeat: false,
              timestamp: this.elapsedTime,
            });
            if (this.killFeed.length > 4) this.killFeed.pop();
          }
          soundEngine.playHitmarker(res.isHead, true);
          if (res.kind === 'vehicle') {
            this.detonateExplosion(_v4, 6.2, 85, false, false, true);
          }
        }
      }
    } else if (closestVehicle && vehDist < closestEnvDist) {
      _v4.copy(closestVehicle.point);
      if (closestVehicle.face) {
        _hitNormal.copy(closestVehicle.face.normal).transformDirection(closestVehicle.object.matrixWorld).normalize();
      } else {
        _hitNormal.copy(_rayDir).negate();
      }
      this.spawnImpactSparks(_v4, 0xffa62b, 5, 1.15);
      this.damageVehicleAtMesh(closestVehicle.object, 26, false, _v4, _hitNormal);
    } else if (hitEnv) {
      _v4.copy(_v3);
      this.spawnSurfaceImpact(_v4, _hitNormal, envRes.surface, 1.15, !envRes.hitPuddle);
      if (envRes.barrel && !envRes.barrel.exploded) {
        this.hitBarrelActor(envRes.barrel, _v4, 28, Boolean(envRes.hitPuddle));
      }
    }

    this.spawnTracer(_muzzleWorld, _v4, 0xffaa33, 1.2);
    if (anyHead) {
      this.triggerHeadshotEffect();
    }
    if (anyHit) {
      this.shotsHit++;
      if (anyKill) {
        this.hitMarker = 'kill';
        this.hitMarkerTimer = 0.22;
      } else {
        this.hitMarker = anyHead ? 'head' : 'body';
        this.hitMarkerTimer = 0.14;
        soundEngine.playHitmarker(anyHead, false);
      }
    }
    this.emitHud();
  }

  private triggerHeadshotEffect() {
    this.headshotSeq += 1;
    this.lastHeadshotAt = this.elapsedTime;
    soundEngine.playHeadshotVoice();
  }

  private tryFireShot(fromBurst = false) {
    if (
      this.phase !== 'playing' ||
      this.activeWeapon === 'unarmed' ||
      this.isReloading ||
      this.grenadeAnimTimer > 0 ||
      this.activeVehicleId ||
      this.health <= 0
    ) {
      return;
    }
    if (!fromBurst && this.fireCooldown > 0) return;
    if (this.breachTimer > 0) this.breachTimer = 0;
    const spec = WEAPONS[this.activeWeapon];
    const activeMode = this.fireModes[this.activeWeapon];

    if (this.ammoInMag[this.activeWeapon] <= 0) {
      this.burstShotsRemaining = 0;
      if (this.reserveAmmo[this.activeWeapon] > 0) {
        this.reload();
      } else {
        this.fireCooldown = 0.22;
        soundEngine.playDryFire();
      }
      return;
    }

    this.ammoInMag[this.activeWeapon]--;

    if (!fromBurst) {
      if (activeMode === 'burst') {
        const extraRounds = this.activeWeapon === 'shotgun' ? 1 : 2;
        this.burstShotsRemaining = Math.min(extraRounds, this.ammoInMag[this.activeWeapon]);
        this.burstShotTimer = this.activeWeapon === 'shotgun' ? 0.14 : 0.065;
        this.fireCooldown = this.activeWeapon === 'shotgun' ? 0.65 : 0.28;
      } else {
        this.fireCooldown = 1 / spec.fireRate;
      }
    }

    this.shotsFired++;

    soundEngine.playGunshot(this.activeWeapon, false, activeMode, fromBurst);

    // Gunfire attracts ONLY nearby enemies within the weapon's acoustic radius
    this.emitSoundAlert(this.playerPos, spec.soundRadius, 'gunshot');

    this.muzzleFlashTimer = 0.055;
    this.muzzleLight.intensity = 4.5 * Math.max(0.7, spec.smokeIntensity);
    this.shotAnimDuration =
      spec.actionStyle === 'pump'
        ? 0.42
        : spec.actionStyle === 'bolt'
          ? 0.56
          : spec.actionStyle === 'slide'
            ? 0.11
            : 0.08;
    this.shotAnimTimer = this.shotAnimDuration;

    if (this.activeWeapon !== 'rocket') {
      this.spawnShellCasing();
    }

    const isAds = this.isCurrentlyAds();
    const moveSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const movePenalty = moveSpeed > 1.5 ? 0.012 : 0;
    const spread = (isAds ? spec.adsSpread : spec.hipSpread) + movePenalty;
    this.crosshairBloom = Math.min(
      0.068,
      this.crosshairBloom + spec.recoilPitch * (isAds ? 0.32 : 0.65),
    );

    const vm = this.viewModels[this.activeWeapon];
    if (vm) {
      vm.muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
      vm.muzzleFlashGroup.scale.setScalar(0.82 + Math.random() * 0.38);
      vm.muzzleFlashGroup.visible = this.perspective === 'first' && !this.activeVehicleId;
    }
    _muzzleWorld.set(0, 0, 0);
    const sniperScopedNow = this.activeWeapon === 'sniper' && this.adsBlend > 0.45;
    if (sniperScopedNow) {
      _raycaster.setFromCamera(_zeroNdc, this.camera);
      _muzzleWorld.copy(_raycaster.ray.origin).addScaledVector(_raycaster.ray.direction, 0.9);
      _muzzleWorld.y -= 0.08;
    } else if (this.perspective === 'first' && vm) {
      vm.muzzlePoint.getWorldPosition(_muzzleWorld);
    } else if (this.playerThirdPersonRig) {
      this.playerThirdPersonRig.muzzlePoint.getWorldPosition(_muzzleWorld);
    }
    if (_muzzleWorld.lengthSq() === 0) {
      _raycaster.setFromCamera(_zeroNdc, this.camera);
      _muzzleWorld.copy(_raycaster.ray.origin).addScaledVector(_raycaster.ray.direction, 0.8);
    }

    if (this.activeWeapon === 'rocket') {
      this.fireRocket(_muzzleWorld, spread);
    } else {
      // Realistic muzzle smoke puffs drifting out of barrel
      this.spawnMuzzleSmoke(_muzzleWorld, spec.smokeIntensity);

      const vehicleTargets = this.vehicleManager.shootableMeshes;
      const simTargets = this.arena?.npcManager?.getShootableMeshes() ?? [];
      const scTargets = this.arena?.smartCity?.getShootableMeshes() ?? [];
      const wildlifeTargets = this.arena?.wildlifeProps?.shootableMeshes ?? [];
      const screenTargets = this.arena?.shootableScreens ?? [];
      const glassTargets =
        this.arena?.breakableGlass?.filter((g) => !g.broken).map((g) => g.mesh) ?? [];
      this.arena?.wildlifeProps?.scatterBirds(this.playerPos.x, this.playerPos.z, 42);

      let anyHit = false;
      let anyHead = false;
      let anyKill = false;
      const fxScale = spec.hitEffectScale;

      for (let p = 0; p < spec.pellets; p++) {
        _raycaster.setFromCamera(_zeroNdc, this.camera);
        _rayOrigin.copy(_raycaster.ray.origin);
        _rayDir.copy(_raycaster.ray.direction);

        // Combat Aim Magnetism: gently lock within ~3.2° cone toward nearest visible enemy or hostile/NPC center-mass
        const minAssistCos = isAds ? 0.9978 : 0.9984;
        let bestCos = minAssistCos;
        let hasAssist = false;
        _v1.set(0, 0, 0);

        if (this.arena?.npcManager) {
          const simPt = this.arena.npcManager.findBestAimAssistTarget(
            _rayOrigin.x,
            _rayOrigin.y,
            _rayOrigin.z,
            _rayDir.x,
            _rayDir.y,
            _rayDir.z,
            bestCos,
            Math.min(72, spec.range),
          );
          if (simPt) {
            _v1.set(simPt.x - _rayOrigin.x, simPt.y - _rayOrigin.y, simPt.z - _rayOrigin.z).normalize();
            hasAssist = true;
          }
        }
        if (hasAssist) {
          const snapStrength = p === 0 ? (isAds ? 0.84 : 0.72) : 0.52;
          _rayDir.lerp(_v1, snapStrength).normalize();
        }

        const effectiveSpread = hasAssist && p === 0 ? spread * 0.35 : spread;
        _rayDir.x += (Math.random() - 0.5) * effectiveSpread;
        _rayDir.y += (Math.random() - 0.5) * effectiveSpread;
        _rayDir.z += (Math.random() - 0.5) * effectiveSpread;
        _rayDir.normalize();

        _raycaster.set(_rayOrigin, _rayDir);
        _raycaster.far = spec.range;

        const envRes = this.raycastEnvironment(
          _rayOrigin.x,
          _rayOrigin.y,
          _rayOrigin.z,
          _rayDir.x,
          _rayDir.y,
          _rayDir.z,
          spec.range,
          _v3,
          _hitNormal,
        );
        const vehicleHits = vehicleTargets.length > 0 ? _raycaster.intersectObjects(vehicleTargets, false) : [];
        const simHits = simTargets.length > 0 ? _raycaster.intersectObjects(simTargets, false) : [];
        const scHits = scTargets.length > 0 ? _raycaster.intersectObjects(scTargets, false) : [];
        const wildlifeHits = wildlifeTargets.length > 0 ? _raycaster.intersectObjects(wildlifeTargets, false) : [];
        const screenHits = screenTargets.length > 0 ? _raycaster.intersectObjects(screenTargets, false) : [];

        const closestEnvDist = envRes.dist;
        if (glassTargets.length > 0 && this.arena?.breakableGlass) {
          const glassHits = _raycaster.intersectObjects(glassTargets, false);
          const firstGlass = glassHits.length > 0 ? glassHits[0] : null;
          if (firstGlass && firstGlass.distance < closestEnvDist) {
            const pane = this.arena.breakableGlass.find(
              (g) => g.mesh === firstGlass.object && !g.broken,
            );
            if (pane) {
              const glassRes = hitBreakableGlassPane(pane, spec.damage);
              if (glassRes === 'cracked') {
                soundEngine.playGlassShatter(true, firstGlass.distance);
                this.spawnImpactSparks(firstGlass.point, 0xe0f2fe, 4, 0.78);
              } else if (glassRes === 'shattered') {
                this.spawnGlassShards(firstGlass.point, 14);
                soundEngine.playGlassShatter(false, firstGlass.distance);
              }
            }
          }
        }
        const hitEnv = closestEnvDist <= spec.range;
        const closestVehicle = vehicleHits.length > 0 ? vehicleHits[0] : null;
        const closestSim = simHits.length > 0 ? simHits[0] : null;
        const closestSc = scHits.length > 0 ? scHits[0] : null;
        const closestWildlife = wildlifeHits.length > 0 ? wildlifeHits[0] : null;
        const closestScreen = screenHits.length > 0 ? screenHits[0] : null;

        _v4.copy(_rayOrigin).addScaledVector(_rayDir, spec.range);

        const vehDist = closestVehicle ? closestVehicle.distance : Infinity;
        const simDist = closestSim ? closestSim.distance : Infinity;
        const scDist = closestSc ? closestSc.distance : Infinity;
        const wildDist = closestWildlife ? closestWildlife.distance : Infinity;
        const scrDist = closestScreen ? closestScreen.distance : Infinity;

        if (closestWildlife && wildDist < closestEnvDist && wildDist <= simDist && wildDist <= scDist && wildDist <= vehDist && this.arena?.wildlifeProps) {
          _v4.copy(closestWildlife.point);
          const wRes = this.arena.wildlifeProps.handleRayHit(closestWildlife.object, _rayDir, _v4, spec.damage);
          if (wRes.kind === 'bird') {
            anyHit = true;
            anyKill = true;
            this.spawnBloodImpactFX(_v4, _rayDir, false, this.activeWeapon === 'sniper', true);
            soundEngine.playBloodImpact(false, wildDist);
            soundEngine.playHitmarker(false, true);
            this.score += 75;
          } else if (wRes.kind === 'balloon') {
            anyHit = true;
            soundEngine.playBalloonPop(wildDist);
            soundEngine.playHitmarker(false, true);
            this.score += 100;
          } else if (wRes.kind === 'ball') {
            anyHit = true;
            if (wRes.burst) {
              soundEngine.playBalloonPop(wildDist);
              this.score += 40;
            } else {
              soundEngine.playBallBounce(wildDist);
            }
          }
        } else if (closestScreen && scrDist <= closestEnvDist + 0.3 && scrDist < simDist && scrDist < scDist && scrDist < vehDist && this.arena?.displays) {
          _v4.copy(closestScreen.point);
          const mat = (closestScreen.object as THREE.Mesh).material;
          const entry = this.arena.displays.getEntryByMaterial(mat);
          if (entry) {
            const uv = closestScreen.uv;
            const scrRes = this.arena.displays.hitDisplayEntry(entry, uv ? uv.x : 0.5, uv ? uv.y : 0.5, spec.damage, this.elapsedTime);
            soundEngine.playScreenGlitch(scrRes === 'shattered', scrDist);
            if (closestScreen.face) {
              _screenNormal.copy(closestScreen.face.normal).transformDirection(closestScreen.object.matrixWorld).normalize();
            } else {
              _screenNormal.copy(_rayDir).negate();
            }
            this.spawnScreenElectricSpark(_v4, _screenNormal, scrRes === 'shattered' ? 1.85 : 1.35 * fxScale);
            this.spawnImpactSparks(_v4, scrRes === 'shattered' ? 0x38bdf8 : 0xf43f5e, scrRes === 'shattered' ? 8 : 4, fxScale);
            if (scrRes === 'shattered') this.spawnGlassShards(_v4, 10);
          }
        } else if (closestSc && scDist < closestEnvDist && scDist <= simDist && scDist <= vehDist && this.arena?.smartCity) {
          _v4.copy(closestSc.point);
          if (closestSc.face) {
            _hitNormal.copy(closestSc.face.normal).transformDirection(closestSc.object.matrixWorld).normalize();
          } else {
            _hitNormal.copy(_rayDir).negate();
          }
          const scRes = this.arena.smartCity.handleBulletHit(
            closestSc.object,
            _v4,
            _hitNormal,
            _rayDir,
            this.activeWeapon,
            spec.damage,
          );
          if (scRes.hit) {
            anyHit = true;
            const isCrit =
              scRes.component === 'head' ||
              scRes.component === 'camera' ||
              scRes.component === 'battery' ||
              scRes.component === 'sensor';
            if (isCrit) anyHead = true;
            if (scRes.outcome?.newlyDestroyed) {
              anyKill = true;
              this.score += 150;
              soundEngine.playHitmarker(isCrit, true);
            }
          }
        } else if (closestSim && simDist < closestEnvDist && simDist <= vehDist && this.arena?.npcManager) {
          _v4.copy(closestSim.point);
          const dmg = spec.damage;
          const res = this.arena.npcManager.damageByMesh(
            closestSim.object,
            dmg,
            _v4,
            this.playerPos,
            this.activeWeapon,
          );
          if (res.protectedBlocked) {
            this.interactFeedback = 'Children in parks are protected!';
            this.interactFeedbackTimer = 1.6;
          } else if (res.hit) {
            anyHit = true;
            if (res.isHead) anyHead = true;
            const hitDist = _v4.distanceTo(this.playerPos);
            if (res.kind === 'vehicle') {
              this.spawnImpactSparks(_v4, 0xffa62b, Math.max(3, Math.round(5 * fxScale)), fxScale);
              if (res.partResult === 'cracked') {
                soundEngine.playGlassShatter(true, hitDist);
              } else if (res.partResult === 'shattered') {
                soundEngine.playGlassShatter(false, hitDist);
                this.spawnGlassShards(_v4, 11);
              } else if (res.partResult === 'punctured') {
                soundEngine.playTirePuncture(hitDist);
                this.spawnTireAirPuff(_v4);
              }
            } else {
              this.spawnBloodImpactFX(_v4, _rayDir, res.isHead, this.activeWeapon === 'sniper', res.killed);
              soundEngine.playBloodImpact(res.isHead, hitDist);
              soundEngine.playPainSound('enemy');
            }
            if (this.worldSystem === 'simulator') {
              const nearPol = this.arena.npcManager.getNearestPoliceDistance(this.playerPos.x, this.playerPos.z);
              if (res.kind === 'npc') {
                registerWantedIncident(this.wantedState, 'civilian_crime', nearPol, false);
              } else if (res.kind === 'police' || (res.kind === 'vehicle' && res.isPoliceVehicle)) {
                registerWantedIncident(this.wantedState, 'police_crime', nearPol, res.kind === 'police' && res.killed);
              } else if (res.kind === 'gang') {
                registerWantedIncident(this.wantedState, 'gang', nearPol, false);
              }
              if (this.wantedState.level > 0) {
                this.arena.npcManager.syncWantedPursuit(this.wantedState.level, this.playerPos.x, this.playerPos.z);
              }
            }
            if (res.killed) {
              anyKill = true;
              this.weaponKillTypes.add(this.activeWeapon);
              if (res.isHead && this.activeWeapon === 'sniper') {
                this.killSlowMoTimer = 0.42;
              }
              this.kills++;
              if (res.isHead) this.headshots++;
              this.streak++;
              if (this.streak > this.bestStreak) this.bestStreak = this.streak;
              const isBossKill = Boolean(res.label?.startsWith('[BOSS'));
              const pts = isBossKill ? 450 : res.kind === 'gang' ? 180 : 100;
              this.score += pts;
              if (isBossKill && res.label) {
                this.killFeed.unshift({
                  id: this.nextKillFeedId++,
                  text: `${res.label} +${pts}`,
                  isHeadshot: res.isHead,
                  isOnBeat: false,
                  timestamp: this.elapsedTime,
                });
                if (this.killFeed.length > 4) this.killFeed.pop();
              }
              soundEngine.playHitmarker(res.isHead, true);
              if (res.kind === 'vehicle') {
                this.detonateExplosion(_v4, 6.2, 85, false, false, true);
              }
            }
          }
        } else if (closestVehicle && vehDist < closestEnvDist) {
          _v4.copy(closestVehicle.point);
          if (closestVehicle.face) {
            _hitNormal.copy(closestVehicle.face.normal).transformDirection(closestVehicle.object.matrixWorld).normalize();
          } else {
            _hitNormal.copy(_rayDir).negate();
          }
          this.spawnImpactSparks(_v4, 0xffa62b, 5, fxScale);
          this.damageVehicleAtMesh(closestVehicle.object, spec.damage, false, _v4, _hitNormal);
        } else if (hitEnv) {
          _v4.copy(_v3);
          this.spawnSurfaceImpact(_v4, _hitNormal, envRes.surface, fxScale, !envRes.hitPuddle);

          if (envRes.barrel && !envRes.barrel.exploded) {
            this.hitBarrelActor(envRes.barrel, _v4, spec.damage, Boolean(envRes.hitPuddle));
          }
        }

        this.spawnTracer(_muzzleWorld, _v4, spec.tracerColor, fxScale);
      }

      if (anyHead) {
        this.triggerHeadshotEffect();
      }
      if (anyHit) {
        this.shotsHit++;
        if (anyKill) {
          this.hitMarker = 'kill';
          this.hitMarkerTimer = 0.22;
        } else {
          this.hitMarker = anyHead ? 'head' : 'body';
          this.hitMarkerTimer = 0.14;
          soundEngine.playHitmarker(anyHead, false);
        }
      }
    }

    const isBurstMode = this.fireModes[this.activeWeapon] === 'burst';
    const adsRecoilMul = (isAds ? 0.58 : 1.0) * (isBurstMode ? 0.78 : 1.0);
    this.recoilPitchOffset += spec.recoilPitch * adsRecoilMul;
    this.recoilYawOffset += (Math.random() - 0.5) * 2 * spec.recoilYaw * adsRecoilMul;
    this.recoilKickZ = Math.min(0.18, this.recoilKickZ + (isAds ? 0.034 : 0.056) * spec.hitEffectScale);
    this.recoilRoll = THREE.MathUtils.clamp(
      this.recoilRoll + (Math.random() - 0.42) * 0.14 * adsRecoilMul * spec.hitEffectScale,
      -0.18,
      0.18,
    );
    this.gunFovPunch = Math.min(2.4, this.gunFovPunch + (isAds ? 0.45 : 1.05) * spec.hitEffectScale);

    if (this.ammoInMag[this.activeWeapon] <= 0 && this.reserveAmmo[this.activeWeapon] > 0) {
      this.burstShotsRemaining = 0;
      this.reload();
    }

    this.emitHud();
  }

  private getParticleMat(colorHex: number): THREE.MeshBasicMaterial {
    let mat = this.particleMatCache.get(colorHex);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95,
      });
      this.particleMatCache.set(colorHex, mat);
    }
    return mat;
  }

  private ensureVfxPoolsInitialized() {
    if (this.vfxPoolsInitialized) return;
    this.vfxPoolsInitialized = true;

    const defaultTracerMat = this.getTracerMat(0xfbbf24);
    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(this.tracerGeo, defaultTracerMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 0.1, active: false });
    }
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(this.shellGeo, this.shellMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shells.push({ mesh, velocity: new THREE.Vector3(), rotVel: new THREE.Vector3(), life: 0, active: false });
    }
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(this.droppingMagGeo, this.droppingMagMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.droppingMags.push({ mesh, velocity: new THREE.Vector3(), rotVel: new THREE.Vector3(), life: 0, active: false });
    }
    const defaultParticleMat = this.getParticleMat(0xfbbf24);
    for (let i = 0; i < 96; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, defaultParticleMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 0.4, gravity: 14, baseScale: 1, active: false });
    }
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(this.smokeGeo, this.smokeMats[i % this.smokeMats.length]);
      mesh.visible = false;
      this.scene.add(mesh);
      this.smokePuffs.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        startScale: 0.5,
        endScale: 1.5,
        startOpacity: 0.28,
        active: false,
      });
    }
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xff7b29, transparent: true, opacity: 0.82, depthWrite: false });
      const mesh = new THREE.Mesh(this.explosionGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.explosions.push({ mesh, mat, life: 0, maxLife: 0.3, startScale: 0.5, maxScale: 4, startOpacity: 0.82, active: false });
    }
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(this.shockRingGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockRings.push({ mesh, mat, life: 0, maxLife: 0.4, maxScale: 5, active: false });
    }
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(this.shardGeo, this.shardMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.glassShards.push({ mesh, vel: new THREE.Vector3(), rotVel: new THREE.Vector3(), life: 0, active: false });
    }
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(this.puffGeo, this.puffMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.tirePuffs.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.42, active: false });
    }
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(this.waterSplashGeo, i % 3 === 0 ? this.waterFoamMat : this.waterSplashMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.waterSplashes.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 0.45, baseScale: 1, active: false });
    }
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(this.waterRippleGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.waterRipples.push({ mesh, mat, life: 0, maxLife: 0.65, maxScale: 1.6, active: false });
    }
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xe5c48c, transparent: true, opacity: 0.56, depthWrite: false });
      const mesh = new THREE.Mesh(this.sandPuffGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sandPuffs.push({
        mesh,
        mat,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
        startScale: 0.6,
        endScale: 2.2,
        active: false,
      });
    }
  }

  private acquirePooledSlot<T extends { active: boolean; life: number }>(pool: T[]): T | null {
    if (pool.length === 0) return null;
    let oldest = pool[0];
    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      if (!item.active) return item;
      if (item.life < oldest.life) oldest = item;
    }
    return oldest;
  }

  private getTracerMat(colorHex: number): THREE.MeshBasicMaterial {
    let mat = this.tracerMatCache.get(colorHex);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.9,
      });
      this.tracerMatCache.set(colorHex, mat);
    }
    return mat;
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex: number, scale = 1.0) {
    this.ensureVfxPoolsInitialized();
    const slot = this.acquirePooledSlot(this.tracers);
    if (!slot) return;
    slot.active = true;
    slot.mesh.material = this.getTracerMat(colorHex);
    slot.mesh.visible = true;
    slot.mesh.position.copy(start);
    slot.mesh.scale.set(0.95 + 0.68 * scale, 0.95 + 0.68 * scale, 1.15 + 0.65 * scale);
    slot.mesh.lookAt(end);

    _v4.subVectors(end, start);
    const dist = _v4.length();
    if (dist > 1e-4) _v4.divideScalar(dist);
    else _v4.set(0, 0, -1);

    const speed = 265;
    const maxLife = Math.min(0.32, Math.max(0.028, dist / speed));
    slot.velocity.copy(_v4).multiplyScalar(speed);
    slot.life = maxLife;
    slot.maxLife = maxLife;
  }

  private spawnMuzzleSmoke(origin: THREE.Vector3, intensity: number, upwardBoost = 0) {
    this.ensureVfxPoolsInitialized();
    const baseCount = Math.max(1, Math.round(1.6 * intensity));
    const q = this.hudSettings.graphicsQuality;
    const count = q === 'low' ? Math.min(1, baseCount) : q === 'medium' ? Math.min(2, baseCount) : Math.min(4, baseCount);
    this.camera.getWorldDirection(_v2);

    for (let i = 0; i < count; i++) {
      const slot = this.acquirePooledSlot(this.smokePuffs);
      if (!slot) break;
      slot.active = true;
      slot.mesh.visible = true;
      slot.mesh.position.set(
        origin.x + (Math.random() - 0.5) * 0.1,
        origin.y + (Math.random() - 0.5) * 0.08,
        origin.z + (Math.random() - 0.5) * 0.1,
      );
      const startScale = (0.42 + Math.random() * 0.25) * Math.max(0.65, intensity * 0.75);
      slot.mesh.scale.setScalar(startScale);
      const maxLife = 0.42 + Math.random() * 0.32;
      slot.velocity.set(
        _v2.x * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.7,
        0.65 + Math.random() * 0.6 + upwardBoost,
        _v2.z * (0.8 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.7,
      );
      slot.life = maxLife;
      slot.maxLife = maxLife;
      slot.startScale = startScale;
      slot.endScale = startScale * 3.1;
      slot.startOpacity = 0.28;
    }
  }

  private spawnShellCasing() {
    this.ensureVfxPoolsInitialized();
    const slot = this.acquirePooledSlot(this.shells);
    if (!slot) return;
    const vm = this.viewModels[this.activeWeapon];
    if (this.perspective === 'first' && vm) {
      vm.ejectPoint.getWorldPosition(_v2);
    } else {
      _v2.set(this.playerPos.x + 0.25, this.playerPos.y + 1.45, this.playerPos.z);
    }

    slot.active = true;
    slot.mesh.visible = true;
    slot.mesh.position.copy(_v2);
    slot.mesh.rotation.set(0, 0, 0);

    _right.set(1, 0, 0).applyAxisAngle(_upAxis, this.yaw);
    _shellVel.copy(_right).multiplyScalar(2.4 + Math.random() * 1.2);
    _shellVel.y += 2.2 + Math.random() * 0.8;

    slot.velocity.copy(_shellVel);
    slot.rotVel.set(
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18,
    );
    slot.life = 1.2;
  }

  private spawnBulletHole(point: THREE.Vector3, normal: THREE.Vector3) {
    if (!this.bulletHoleMat) return;
    const q = this.hudSettings.graphicsQuality;
    const cap = q === 'low' || this.isSoftwareGl ? 16 : q === 'medium' ? 36 : 56;

    _tmpNormal.copy(normal);
    if (_tmpNormal.lengthSq() < 0.01) {
      _tmpNormal.set(0, 1, 0);
    } else {
      _tmpNormal.normalize();
    }

    let mesh: THREE.Mesh;
    if (this.bulletHoles.length < cap) {
      mesh = new THREE.Mesh(this.bulletHoleGeo, this.bulletHoleMat);
      this.scene.add(mesh);
      this.bulletHoles.push({ mesh });
    } else {
      mesh = this.bulletHoles[this.bulletHoleCursor % this.bulletHoles.length].mesh;
      this.bulletHoleCursor++;
    }

    mesh.position.copy(point).addScaledVector(_tmpNormal, 0.016);
    _decalQuat.setFromUnitVectors(_zAxis, _tmpNormal);
    mesh.quaternion.copy(_decalQuat);
    mesh.rotateZ(Math.random() * Math.PI * 2);
    mesh.scale.setScalar(0.85 + Math.random() * 0.35);
  }

  private spawnWaterSplash(point: THREE.Vector3, scale = 1.0, addRipple = true) {
    this.ensureVfxPoolsInitialized();
    const q = this.hudSettings.graphicsQuality;
    const dropCount = q === 'low' ? 4 : q === 'medium' ? 7 : 10;
    const baseScale = Math.max(0.55, 0.75 * scale);
    for (let i = 0; i < dropCount; i++) {
      const slot = this.acquirePooledSlot(this.waterSplashes);
      if (!slot) break;
      slot.active = true;
      slot.mesh.visible = true;
      slot.mesh.position.set(
        point.x + (Math.random() - 0.5) * 0.18 * scale,
        point.y + 0.05,
        point.z + (Math.random() - 0.5) * 0.18 * scale,
      );
      slot.mesh.scale.setScalar(baseScale);
      const ang = Math.random() * Math.PI * 2;
      const radial = (0.7 + Math.random() * 1.9) * scale;
      slot.velocity.set(
        Math.cos(ang) * radial,
        (2.8 + Math.random() * 3.4) * Math.max(0.75, scale),
        Math.sin(ang) * radial,
      );
      const maxLife = 0.32 + Math.random() * 0.22;
      slot.life = maxLife;
      slot.maxLife = maxLife;
      slot.baseScale = baseScale;
    }

    if (addRipple) {
      const ripple = this.acquirePooledSlot(this.waterRipples);
      if (ripple) {
        ripple.active = true;
        ripple.mesh.visible = true;
        ripple.mesh.position.set(point.x, point.y + 0.03, point.z);
        ripple.mesh.scale.setScalar(0.18 * scale);
        ripple.mat.opacity = 0.74;
        ripple.life = 0.62;
        ripple.maxLife = 0.62;
        ripple.maxScale = 1.55 * Math.max(0.7, scale);
      }
    }
  }

  private spawnSandPuff(point: THREE.Vector3, normal: THREE.Vector3, scale = 1.0) {
    this.ensureVfxPoolsInitialized();
    const q = this.hudSettings.graphicsQuality;
    const puffCount = q === 'low' ? 2 : q === 'medium' ? 4 : 6;
    for (let i = 0; i < puffCount; i++) {
      const slot = this.acquirePooledSlot(this.sandPuffs);
      if (!slot) break;
      slot.active = true;
      slot.mesh.visible = true;
      slot.mesh.position.set(
        point.x + (Math.random() - 0.5) * 0.2 * scale,
        point.y + 0.04,
        point.z + (Math.random() - 0.5) * 0.2 * scale,
      );
      const startS = (0.55 + Math.random() * 0.35) * Math.max(0.75, scale);
      slot.mesh.scale.setScalar(startS);
      slot.mat.color.setHex(i % 2 === 0 ? 0xe5c48c : 0xd6b073);
      slot.mat.opacity = 0.58;
      slot.velocity.set(
        normal.x * 0.9 + (Math.random() - 0.5) * 2.4 * scale,
        (1.1 + Math.random() * 1.9) * Math.max(0.7, scale),
        normal.z * 0.9 + (Math.random() - 0.5) * 2.4 * scale,
      );
      const maxLife = 0.36 + Math.random() * 0.22;
      slot.life = maxLife;
      slot.maxLife = maxLife;
      slot.startScale = startS;
      slot.endScale = startS * 2.8;
    }
  }

  private spawnSurfaceImpact(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    surface: SurfaceType,
    scale = 1.0,
    placeHole = true,
  ) {
    const dist = point.distanceTo(this.playerPos);
    if (surface === 'water') {
      this.spawnWaterSplash(point, Math.max(0.95, scale * 1.1), true);
      soundEngine.playWaterSplash(scale, dist);
      return;
    }
    if (surface === 'sand') {
      this.spawnSandPuff(point, normal, Math.max(0.95, scale * 1.1));
      soundEngine.playSandImpact(dist);
      return;
    }
    if (surface === 'wood') {
      soundEngine.playWoodImpact(dist);
    }
    if (placeHole) {
      this.spawnBulletHole(point, normal);
    }

    this.ensureVfxPoolsInitialized();
    const q = this.hudSettings.graphicsQuality;
    const rawCount = surface === 'metal' ? 4 : 3;
    const count =
      q === 'low' || this.isSoftwareGl
        ? Math.max(1, Math.round(rawCount * 0.45))
        : q === 'medium'
          ? Math.min(4, Math.round(rawCount * 0.8))
          : rawCount;

    const baseColor =
      surface === 'metal'
        ? 0xffa62b
        : surface === 'wood'
          ? 0xd4a373
          : surface === 'dirt'
            ? 0x7c6244
            : 0xcbd5e1;
    const mat = this.getParticleMat(baseColor);
    const baseScale = Math.max(0.4, 0.55 + 0.42 * scale);
    const spdScale = 0.85 + 0.35 * scale;

    for (let i = 0; i < count; i++) {
      const slot = this.acquirePooledSlot(this.particles);
      if (!slot) break;
      slot.active = true;
      slot.mesh.material = mat;
      slot.mesh.visible = true;
      slot.mesh.position.copy(point).addScaledVector(normal, 0.04);
      slot.mesh.scale.setScalar(baseScale);

      const nPush = (surface === 'metal' ? 4.4 : 2.8) * spdScale;
      slot.velocity.set(
        normal.x * nPush + (Math.random() - 0.5) * 4.2 * spdScale,
        normal.y * nPush + (0.8 + Math.random() * 3.0) * spdScale,
        normal.z * nPush + (Math.random() - 0.5) * 4.2 * spdScale,
      );
      slot.life = 0.2 + Math.random() * 0.16;
      slot.maxLife = 0.4;
      slot.gravity = surface === 'metal' ? 11 : 15;
      slot.baseScale = baseScale;
    }

    // Subtle dust puff on concrete, wood, or dirt impacts
    if (surface !== 'metal' && q !== 'low' && !this.isSoftwareGl) {
      const puffSlot = this.acquirePooledSlot(this.smokePuffs);
      if (puffSlot) {
        puffSlot.active = true;
        puffSlot.mesh.visible = true;
        puffSlot.mesh.position.copy(point).addScaledVector(normal, 0.08);
        const startScale = 0.48 * Math.max(0.7, scale);
        puffSlot.mesh.scale.setScalar(startScale);
        puffSlot.velocity.set(
          normal.x * 1.1 + (Math.random() - 0.5) * 0.5,
          0.65 + normal.y * 0.8,
          normal.z * 1.1 + (Math.random() - 0.5) * 0.5,
        );
        puffSlot.life = 0.36;
        puffSlot.maxLife = 0.36;
        puffSlot.startScale = startScale;
        puffSlot.endScale = startScale * 2.4;
        puffSlot.startOpacity = 0.24;
      }
    }
  }

  private spawnImpactSparks(point: THREE.Vector3, colorHex: number, count: number, scale = 1.0) {
    this.ensureVfxPoolsInitialized();
    const mat = this.getParticleMat(colorHex);
    const baseScale = Math.max(0.45, 0.7 + 0.48 * scale);
    const spdScale = 0.75 + 0.45 * scale;
    const q = this.hudSettings.graphicsQuality;
    const capped = q === 'low' ? Math.max(1, Math.round(count * 0.45)) : q === 'medium' ? Math.min(5, Math.round(count * 0.75)) : Math.min(8, count);
    for (let i = 0; i < capped; i++) {
      const slot = this.acquirePooledSlot(this.particles);
      if (!slot) break;
      slot.active = true;
      slot.mesh.material = mat;
      slot.mesh.visible = true;
      slot.mesh.position.copy(point);
      slot.mesh.scale.setScalar(baseScale);
      slot.velocity.set(
        (Math.random() - 0.5) * 7 * spdScale,
        (1.4 + Math.random() * 4.5) * spdScale,
        (Math.random() - 0.5) * 7 * spdScale,
      );
      slot.life = 0.26 + Math.random() * 0.2 * Math.min(1.4, scale);
      slot.maxLife = 0.5;
      slot.gravity = 14;
      slot.baseScale = baseScale;
    }
  }

  private spawnGlassShards(point: THREE.Vector3, count = 10) {
    this.ensureVfxPoolsInitialized();
    for (let i = 0; i < count; i++) {
      const slot = this.acquirePooledSlot(this.glassShards);
      if (!slot) break;
      slot.active = true;
      slot.mesh.visible = true;
      slot.mesh.position.copy(point);
      slot.mesh.rotation.set(0, 0, 0);
      slot.mesh.scale.setScalar(0.6 + Math.random() * 0.9);
      slot.vel.set(
        (Math.random() - 0.5) * 6.5,
        1.2 + Math.random() * 4.2,
        (Math.random() - 0.5) * 6.5,
      );
      slot.rotVel.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
      );
      slot.life = 0.95 + Math.random() * 0.45;
    }
  }

  private spawnTireAirPuff(point: THREE.Vector3) {
    this.ensureVfxPoolsInitialized();
    for (let i = 0; i < 6; i++) {
      const slot = this.acquirePooledSlot(this.tirePuffs);
      if (!slot) break;
      slot.active = true;
      slot.mesh.visible = true;
      slot.mesh.position.copy(point);
      slot.mesh.scale.setScalar(0.5);
      slot.vel.set(
        (Math.random() - 0.5) * 3.8,
        0.8 + Math.random() * 2.2,
        (Math.random() - 0.5) * 3.8,
      );
      slot.life = 0.42;
      slot.maxLife = 0.42;
    }
  }

  private spawnBloodImpactFX(
    point: THREE.Vector3,
    dir: THREE.Vector3,
    isHead: boolean,
    isSniper: boolean,
    killed: boolean,
  ) {
    this.ensureVfxPoolsInitialized();
    const mistCount = isHead ? (isSniper ? 10 : 8) : killed ? 6 : 4;
    const matDark = this.getParticleMat(0x5c060c);
    const matMid = this.getParticleMat(0x991b1b);
    const matBright = this.getParticleMat(0xdc2626);
    for (let i = 0; i < mistCount; i++) {
      const slot = this.acquirePooledSlot(this.particles);
      if (!slot) break;
      const pMat = i % 3 === 0 ? matDark : i % 3 === 1 ? matMid : matBright;
      slot.active = true;
      slot.mesh.material = pMat;
      slot.mesh.visible = true;
      slot.mesh.position.copy(point);
      const baseScale = isHead ? 0.5 + Math.random() * 0.35 : 0.36 + Math.random() * 0.28;
      slot.mesh.scale.setScalar(baseScale);
      const spraySpd = isHead ? (isSniper ? 5.6 : 4.2) : 2.8;
      slot.velocity.set(
        dir.x * spraySpd + (Math.random() - 0.5) * 2.8,
        0.9 + Math.random() * (isHead ? 2.8 : 1.8),
        dir.z * spraySpd + (Math.random() - 0.5) * 2.8,
      );
      slot.life = 0.24 + Math.random() * 0.2;
      slot.maxLife = 0.44;
      slot.gravity = 16.0;
      slot.baseScale = baseScale;
    }

    // Small crisp ground blood droplets on hit / kill
    const gy = this.arena ? this.arena.groundHeightAt(point.x, point.z, point.y) : 0;
    if (point.y - gy < 2.2 || killed) {
      const poolCount = killed ? 2 : 1;
      for (let k = 0; k < poolCount; k++) {
        if (this.bloodPools.length >= 48) {
          const oldest = this.bloodPools.shift();
          if (oldest) this.scene.remove(oldest.mesh);
        }
        const ox = k === 0 ? 0 : dir.x * (0.28 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.24;
        const oz = k === 0 ? 0 : dir.z * (0.28 + Math.random() * 0.3) + (Math.random() - 0.5) * 0.24;
        const sy = this.arena ? this.arena.groundHeightAt(point.x + ox, point.z + oz, point.y) : gy;
        const poolMesh = new THREE.Mesh(this.bloodPoolGeo, this.bloodPoolMat);
        poolMesh.position.set(point.x + ox, sy + 0.025 + k * 0.002, point.z + oz);
        const startR = k === 0 ? 0.09 : 0.06;
        poolMesh.scale.setScalar(startR);
        this.scene.add(poolMesh);
        this.bloodPools.push({
          mesh: poolMesh,
          age: 0,
          startRadius: startR,
          maxRadius:
            k === 0
              ? killed
                ? isHead
                  ? 0.58
                  : 0.44
                : 0.24
              : isHead
                ? 0.3
                : 0.22,
        });
      }
    }
  }

  private spawnNeckBloodSpray(neckPos: THREE.Vector3, count = 4) {
    this.ensureVfxPoolsInitialized();
    const matDark = this.getParticleMat(0x5c060c);
    const matMid = this.getParticleMat(0x991b1b);
    const matBright = this.getParticleMat(0xdc2626);
    for (let i = 0; i < count; i++) {
      const slot = this.acquirePooledSlot(this.particles);
      if (!slot) break;
      const pMat = i % 3 === 0 ? matDark : i % 3 === 1 ? matMid : matBright;
      slot.active = true;
      slot.mesh.material = pMat;
      slot.mesh.visible = true;
      slot.mesh.position.set(
        neckPos.x + (Math.random() - 0.5) * 0.14,
        neckPos.y + Math.random() * 0.08,
        neckPos.z + (Math.random() - 0.5) * 0.14,
      );
      const baseScale = 0.72 + Math.random() * 0.65;
      slot.mesh.scale.setScalar(baseScale);
      slot.velocity.set(
        (Math.random() - 0.5) * 2.2,
        2.6 + Math.random() * 3.0,
        (Math.random() - 0.5) * 2.2,
      );
      slot.life = 0.36 + Math.random() * 0.24;
      slot.maxLife = 0.6;
      slot.gravity = 16.5;
      slot.baseScale = baseScale;
    }
  }

  private resolveCollisions(pos: THREE.Vector3, radius: number, height: number) {
    if (!this.arena) return;
    const colliders: ColliderBox[] = this.arena.colliders;

    if (this.arenaColliderGrid) {
      const res = resolveCircleColliders2DGrid(
        pos.x,
        pos.y,
        pos.z,
        radius,
        height,
        this.arenaColliderGrid,
      );
      pos.x = res.x;
      pos.z = res.z;
    } else {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (pos.y + height <= c.minY || pos.y >= c.maxY - 0.35) continue;

        if (Math.abs(c.rotY) > 0.001) {
          const relX = pos.x - c.cx;
          const relZ = pos.z - c.cz;
          const lx = relX * c.cosY - relZ * c.sinY;
          const lz = relX * c.sinY + relZ * c.cosY;

          const closestX = THREE.MathUtils.clamp(lx, -c.halfW, c.halfW);
          const closestZ = THREE.MathUtils.clamp(lz, -c.halfD, c.halfD);
          const dx = lx - closestX;
          const dz = lz - closestZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < radius * radius) {
            let pushLx = 0;
            let pushLz = 0;
            const dist = Math.sqrt(distSq);
            if (dist > 0.0001) {
              const push = radius - dist;
              pushLx = (dx / dist) * push;
              pushLz = (dz / dist) * push;
            } else {
              const penLeft = Math.abs(lx + c.halfW);
              const penRight = Math.abs(c.halfW - lx);
              const penBack = Math.abs(lz + c.halfD);
              const penFront = Math.abs(c.halfD - lz);
              const minPen = Math.min(penLeft, penRight, penBack, penFront);
              if (minPen === penLeft) pushLx = -(penLeft + radius);
              else if (minPen === penRight) pushLx = penRight + radius;
              else if (minPen === penBack) pushLz = -(penBack + radius);
              else pushLz = penFront + radius;
            }
            pos.x += pushLx * c.cosY + pushLz * c.sinY;
            pos.z += -pushLx * c.sinY + pushLz * c.cosY;
          }
        } else {
          const closestX = THREE.MathUtils.clamp(pos.x, c.minX, c.maxX);
          const closestZ = THREE.MathUtils.clamp(pos.z, c.minZ, c.maxZ);
          const dx = pos.x - closestX;
          const dz = pos.z - closestZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < radius * radius) {
            const dist = Math.sqrt(distSq);
            if (dist > 0.0001) {
              const push = radius - dist;
              pos.x += (dx / dist) * push;
              pos.z += (dz / dist) * push;
            } else {
              const penLeft = Math.abs(pos.x - c.minX);
              const penRight = Math.abs(c.maxX - pos.x);
              const penBack = Math.abs(pos.z - c.minZ);
              const penFront = Math.abs(c.maxZ - pos.z);
              const minPen = Math.min(penLeft, penRight, penBack, penFront);
              if (minPen === penLeft) pos.x = c.minX - radius;
              else if (minPen === penRight) pos.x = c.maxX + radius;
              else if (minPen === penBack) pos.z = c.minZ - radius;
              else pos.z = c.maxZ + radius;
            }
          }
        }
      }
    }

    if (this.arena.dynamicColliders && this.arena.dynamicColliders.length > 0) {
      const dynRes = resolveCircleColliders2D(
        pos.x,
        pos.y,
        pos.z,
        radius,
        height,
        this.arena.dynamicColliders,
      );
      pos.x = dynRes.x;
      pos.z = dynRes.z;
    }

    if (this.arena.npcManager) {
      const npcVehs = this.arena.npcManager.getVehicleColliders();
      if (npcVehs.length > 0) {
        const res = resolveCircleColliders2D(pos.x, pos.y, pos.z, radius, height, npcVehs);
        pos.x = res.x;
        pos.z = res.z;
      }
    }

    const pVehs = this.vehicleManager.vehicles;
    for (let i = 0; i < pVehs.length; i++) {
      const v = pVehs[i];
      if (v.destroyed || v.id === this.activeVehicleId) continue;
      const pushRes = resolvePlayerAgainstVehicle(
        pos.x,
        pos.y,
        pos.z,
        radius,
        height,
        v.position.x,
        v.position.y,
        v.position.z,
        v.yaw,
        v.spec.bodyW,
        v.spec.bodyL,
        v.kind === 'digital_bike' ? 1.2 : 1.75,
      );
      pos.x = pushRes.x;
      pos.z = pushRes.z;
    }

    const b = this.arena.mapBounds;
    pos.x = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
    pos.z = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
  }

  private surfaceHeightAt(x: number, z: number, currentY: number): number {
    if (!this.arena) return 0;
    let h = this.arena.groundHeightAt(x, z, currentY);
    const colliders = this.arena.colliders;
    const testCollider = (c: ColliderBox) => {
      if (currentY < c.maxY - 0.45 || c.maxY <= h) return;
      if (Math.abs(c.rotY) > 0.001) {
        const relX = x - c.cx;
        const relZ = z - c.cz;
        const lx = relX * c.cosY - relZ * c.sinY;
        const lz = relX * c.sinY + relZ * c.cosY;
        if (Math.abs(lx) <= c.halfW + 0.35 && Math.abs(lz) <= c.halfD + 0.35) {
          h = c.maxY;
        }
      } else if (x >= c.minX - 0.35 && x <= c.maxX + 0.35 && z >= c.minZ - 0.35 && z <= c.maxZ + 0.35) {
        h = c.maxY;
      }
    };
    if (this.arenaColliderGrid) {
      forEachColliderInBounds(
        this.arenaColliderGrid,
        x - 0.5,
        z - 0.5,
        x + 0.5,
        z + 0.5,
        (idx) => testCollider(colliders[idx]),
      );
    } else {
      for (let i = 0; i < colliders.length; i++) {
        testCollider(colliders[i]);
      }
    }
    if (this.arena.dynamicColliders) {
      for (let i = 0; i < this.arena.dynamicColliders.length; i++) {
        testCollider(this.arena.dynamicColliders[i]);
      }
    }
    const transitDeckY = this.arena.smartCityTransit?.getWalkableDeckY?.(x, z, currentY);
    if (transitDeckY !== null && transitDeckY !== undefined && transitDeckY > h) {
      h = transitDeckY;
    }
    return h;
  }

  private applyDamageToPlayer(
    amount: number,
    bypassArmor = false,
    source: 'combat' | 'zone' | 'explosion' | 'vehicle' = 'combat',
  ) {
    if (this.phase !== 'playing' || this.health <= 0) return;

    const armorAbsorbed = !bypassArmor && this.armor > 0;
    const hpBefore = this.health;
    this.damageFlash = 1.0;
    this.timeSinceDamage = 0;
    this.isRecoveringHealth = false;
    this.streak = 0;

    // Subtle, non-disorienting combat flinch & brief movement interruption
    this.flinchTimer = source === 'zone' ? 0 : 0.22;
    this.flinchDir = Math.random() > 0.5 ? 1 : -1;
    this.staggerTimer = source === 'zone' ? 0 : 0.16;
    this.screenShake = Math.max(this.screenShake, source === 'zone' ? 0.006 : armorAbsorbed ? 0.018 : 0.028);

    let remaining = amount;
    if (armorAbsorbed) {
      const absorbed = Math.min(this.armor, remaining * 0.65);
      this.armor = Math.max(0, this.armor - absorbed);
      remaining -= absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    const hpLost = hpBefore - this.health;
    soundEngine.playDamageTaken(armorAbsorbed, hpLost > 0.2);

    if (this.health <= 0) {
      // Simulator World Hospital / Safe Medical Respawn
      this.touchFiring = false;
      this.bikeEjectTimer = 0;
      this.actionCrashCamTimer = 0;
      this.seatedSpot = null;
      if (this.activeVehicleId) {
        this.exitVehicle(this.vehicleManager.getById(this.activeVehicleId), true);
      }
      this.wantedState.level = 0;
      this.wantedState.isEvading = false;
      this.arena?.npcManager?.clearPolicePursuit?.();
      this.health = this.maxHealth;
      this.armor = 50;
      this.timeSinceDamage = 999;
      const sx = 4;
      const sz = 16;
      const sy = this.arena ? this.arena.groundHeightAt(sx, sz, 0) : 0;
      this.playerPos.set(sx, sy, sz);
      this.playerVel.set(0, 0, 0);
      this.resolveCollisions(this.playerPos, 0.48, 1.75);
      this.playerPos.y = this.surfaceHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
      this.smoothedGroundY = this.playerPos.y;
      this.smoothedEyeY = this.playerPos.y + 1.62;
      this.thirdPersonCamInit = false;
      this.interactFeedback = 'Medical Respawn — Back in Action';
      this.interactFeedbackTimer = 3.0;
    }
    this.emitHud();
  }

  private tick = () => {
    if (this.disposed) return;

    const rawDelta = this.clock.getDelta();
    const rawDt = Math.min(rawDelta, 0.05);
    let dt = rawDt;
    if (this.killSlowMoTimer > 0 && this.phase === 'playing') {
      this.killSlowMoTimer = Math.max(0, this.killSlowMoTimer - rawDt);
      dt = rawDt * 0.38;
    }

    this.fpsAccum += rawDelta;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.4) {
      this.currentFps = Math.max(1, Math.round(this.fpsFrames / this.fpsAccum));
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    const tickQ = this.hudSettings.graphicsQuality;
    const baseDistMul =
      tickQ === 'low' || this.isSoftwareGl ? 0.45 : tickQ === 'medium' ? 0.65 : 1.0;

    if (this.phase === 'playing') {
      this.adaptiveSampleTime += rawDelta;
      this.adaptiveSampleFrames++;
      if (this.adaptiveSampleTime >= 1.4) {
        const windowFps = this.adaptiveSampleFrames / this.adaptiveSampleTime;
        this.adaptiveSampleTime = 0;
        this.adaptiveSampleFrames = 0;
        if (windowFps < 38 && this.adaptiveTier < 2) {
          this.adaptiveTier = (this.adaptiveTier + 1) as 0 | 1 | 2;
          this.adaptiveHighFpsTime = 0;
        } else if (windowFps >= 52 && this.adaptiveTier > 0) {
          this.adaptiveHighFpsTime += 1.4;
          if (this.adaptiveHighFpsTime >= 4.0) {
            this.adaptiveTier = (this.adaptiveTier - 1) as 0 | 1 | 2;
            this.adaptiveHighFpsTime = 0;
          }
        } else {
          this.adaptiveHighFpsTime = 0;
        }
      }
    } else {
      this.adaptiveTier = 0;
      this.adaptiveSampleTime = 0;
      this.adaptiveSampleFrames = 0;
      this.adaptiveHighFpsTime = 0;
    }

    const tierScale = this.adaptiveTier === 2 ? 0.68 : this.adaptiveTier === 1 ? 0.84 : 1.0;
    this.adaptiveDistMul = baseDistMul * tierScale;

    if (this.phase === 'menu') {
      this.updateMenuCamera(dt);
    } else if (this.phase === 'playing') {
      this.updateGameplay(dt);
    }

    this.renderFrame();

    if (this.isSoftwareGl) {
      this.afterDrawSoftwareGl(() => {
        if (!this.disposed) {
          this.frameId = requestAnimationFrame(this.tick);
        }
      });
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDrawSoftwareGl(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext | null;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 64);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) {
      this.frameId = window.setTimeout(cb, 64);
      return;
    }
    let checks = 0;
    const poll = () => {
      if (this.disposed) {
        try {
          gl.deleteSync(sync);
        } catch {
          // ignore
        }
        return;
      }
      checks++;
      const syncState = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (syncState === gl.UNSIGNALED && checks < 5) {
        this.frameId = window.setTimeout(poll, 8);
      } else {
        try {
          gl.deleteSync(sync);
        } catch {
          // ignore
        }
        this.frameId = window.setTimeout(cb, 64);
      }
    };
    this.frameId = window.setTimeout(poll, 8);
  }

  private updateMenuCamera(dt: number) {
    this.elapsedTime += dt;

    // Gentle cloud drift & animated scenery across sky/valley
    if (this.arena) {
      this.arena.update?.(dt, this.elapsedTime, this.camera.position, this.hudSettings.graphicsQuality);
      const clouds = this.arena.clouds;
      const cloudMinX = this.mapId === 'simulator_city' ? -1240 : -150;
      const cloudMaxX = this.mapId === 'simulator_city' ? 1520 : 210;
      for (let i = 0; i < clouds.length; i++) {
        const cl = clouds[i];
        const speed = (cl.userData.driftSpeed as number) || 1.0;
        cl.position.x += speed * dt;
        if (cl.position.x > cloudMaxX) cl.position.x = cloudMinX;
      }
    }

    const stageX = -8.0;
    const stageZ = 14.0;
    const groundY = this.arena ? this.arena.groundHeightAt(stageX, stageZ) : 0;

    // Stage 3D Tactical Soldier in main courtyard road (rotatable, idle breathing & weapon stance)
    if (this.playerThirdPersonRig) {
      const rig = this.playerThirdPersonRig;
      rig.root.visible = this.lobbyViewMode !== 'weapon';
      rig.root.position.set(stageX, groundY, stageZ);
      rig.root.rotation.y = Math.PI - 0.34 + this.lobbyInspectYaw;

      const breath = Math.sin(this.elapsedTime * 1.9);
      const sway = Math.cos(this.elapsedTime * 0.95);
      const pose = this.loadoutConfig.lobbyPose;
      const wid = this.loadoutConfig.startingWeapon;

      rig.pelvisGroup.position.y = THREE.MathUtils.damp(rig.pelvisGroup.position.y, 0, 10, dt);
      rig.leftLeg.rotation.set(pose === 'guard' ? -0.14 : -0.06, 0.08, 0);
      rig.leftKnee.rotation.set(pose === 'guard' ? 0.16 : 0.06, 0, 0);
      rig.rightLeg.rotation.set(pose === 'guard' ? 0.14 : 0.08, -0.08, 0);
      rig.rightKnee.rotation.set(0.06, 0, 0);

      rig.torso.position.y = 0.85 + breath * 0.008;
      rig.torso.rotation.x = THREE.MathUtils.damp(
        rig.torso.rotation.x,
        pose === 'guard' ? -0.08 : 0.02,
        10,
        dt,
      );
      rig.torso.rotation.z = sway * 0.018;
      rig.headGroup.rotation.y = Math.sin(this.elapsedTime * 0.65) * 0.14;
      rig.headGroup.rotation.x = breath * 0.02;

      if (wid === 'rocket') {
        rig.rightArm.rotation.set(0.75 + breath * 0.02, 0.1, 0);
        rig.rightElbow.rotation.set(-0.45, 0, 0);
        rig.leftArm.rotation.set(0.55, -0.35, -0.12);
        rig.leftElbow.rotation.set(-0.35, 0, 0);
      } else if (pose === 'patrol') {
        rig.rightArm.rotation.set(-0.08 + breath * 0.02, 0.42, 0);
        rig.rightElbow.rotation.set(0.28, 0, 0);
        rig.leftArm.rotation.set(0.18, -0.42, -0.1);
        rig.leftElbow.rotation.set(-0.18, 0, 0);
      } else if (pose === 'guard') {
        rig.rightArm.rotation.set(0.42 + breath * 0.015, 0.12, 0);
        rig.rightElbow.rotation.set(-0.22, 0, 0);
        rig.leftArm.rotation.set(0.48, -0.26, -0.08);
        rig.leftElbow.rotation.set(-0.14, 0, 0);
      } else {
        // ready
        rig.rightArm.rotation.set(0.26 + breath * 0.02, 0.28, 0);
        rig.rightElbow.rotation.set(-0.08, 0, 0);
        rig.leftArm.rotation.set(0.32, -0.34, -0.14);
        rig.leftElbow.rotation.set(-0.12, 0, 0);
      }
    }

    // Update Weapon Showcase Turntable
    const isWeaponView = this.lobbyViewMode === 'weapon';
    const isBikeView = this.lobbyViewMode === 'bike';
    this.lobbyShowcaseGroup.visible = isWeaponView;
    if (isWeaponView) {
      this.lobbyShowcaseGroup.position.set(stageX, groundY + 7.2, stageZ);
      this.lobbyShowcaseGroup.rotation.y = this.lobbyWeaponInspectYaw + this.elapsedTime * 0.25;
      this.lobbyShowcaseGroup.rotation.x = this.lobbyWeaponInspectPitch;
    }

    if (this.lobbyBikeGroup) {
      this.lobbyBikeGroup.visible = isBikeView || this.lobbyViewMode === 'overview';
      const bikeGroundY = this.arena ? this.arena.groundHeightAt(-5.4, 13.8) : groundY;
      this.lobbyBikeGroup.position.set(-5.4, bikeGroundY, 13.8);
      this.lobbyBikeGroup.rotation.y = isBikeView
        ? -0.45 + this.lobbyInspectYaw + this.elapsedTime * 0.26
        : -0.68;
    }

    // Target Camera Position & LookAt per Lobby View Mode
    if (this.lobbyViewMode === 'weapon') {
      _camPos.set(stageX, groundY + 7.26, stageZ + 1.85);
      _camTarget.set(stageX, groundY + 7.2, stageZ);
    } else if (this.lobbyViewMode === 'soldier') {
      const orbitDrift = Math.sin(this.elapsedTime * 0.35) * 0.22;
      _camPos.set(stageX + 0.55 + orbitDrift, groundY + 1.32, stageZ + 3.4);
      _camTarget.set(stageX, groundY + 1.05, stageZ);
    } else if (isBikeView) {
      const bikeGroundY = this.arena ? this.arena.groundHeightAt(-5.4, 13.8) : groundY;
      const orbit = 0.62 + this.lobbyInspectYaw * 0.35;
      const dist = 3.3 * this.lobbyBikeZoom;
      _camPos.set(
        -5.4 + Math.cos(orbit) * dist,
        bikeGroundY + 1.24 * this.lobbyBikeZoom + Math.sin(this.elapsedTime * 0.45) * 0.05,
        13.8 + Math.sin(orbit) * dist,
      );
      _camTarget.set(-5.4, bikeGroundY + 0.52, 13.8);
    } else if (this.lobbyViewMode === 'map') {
      const baseDist = 115 * this.droneZoom;
      const baseHeight = 62 * this.droneZoom;
      const ang = this.droneOrbitYaw + this.elapsedTime * 0.05;
      const cx = this.droneCenter.x;
      const cz = this.droneCenter.y;
      const gy = this.arena ? this.arena.groundHeightAt(cx, cz) : 0;
      _camPos.set(cx + Math.cos(ang) * baseDist, gy + baseHeight, cz + Math.sin(ang) * baseDist);
      _camTarget.set(cx, gy + 2.0, cz);
    } else {
      // 'overview': Soldier & Cyber Bike framed cleanly inside the living Mega-World compound
      const camDriftX = Math.sin(this.elapsedTime * 0.28) * 0.55;
      const camDriftY = Math.cos(this.elapsedTime * 0.36) * 0.12;
      _camPos.set(stageX + 2.6 + camDriftX, groundY + 1.78 + camDriftY, stageZ + 5.25);
      _camTarget.set(stageX + 0.45, groundY + 1.18, stageZ - 3.6);
    }

    if (!this.lobbyCamInitialized) {
      this.lobbyCamPos.copy(_camPos);
      this.lobbyCamLook.copy(_camTarget);
      this.lobbyCamInitialized = true;
    } else {
      const dampRate =
        this.lobbyViewMode === 'weapon' ? 10 : this.lobbyViewMode === 'bike' ? 6.5 : 4.8;
      this.lobbyCamPos.x = THREE.MathUtils.damp(this.lobbyCamPos.x, _camPos.x, dampRate, dt);
      this.lobbyCamPos.y = THREE.MathUtils.damp(this.lobbyCamPos.y, _camPos.y, dampRate, dt);
      this.lobbyCamPos.z = THREE.MathUtils.damp(this.lobbyCamPos.z, _camPos.z, dampRate, dt);
      this.lobbyCamLook.x = THREE.MathUtils.damp(this.lobbyCamLook.x, _camTarget.x, dampRate, dt);
      this.lobbyCamLook.y = THREE.MathUtils.damp(this.lobbyCamLook.y, _camTarget.y, dampRate, dt);
      this.lobbyCamLook.z = THREE.MathUtils.damp(this.lobbyCamLook.z, _camTarget.z, dampRate, dt);
    }

    const desiredFov =
      this.lobbyViewMode === 'weapon' ? 46 : this.lobbyViewMode === 'bike' ? 54 : 62;
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, 9, dt);
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.copy(this.lobbyCamPos);
    this.camera.lookAt(this.lobbyCamLook);
  }

  private updateGameplay(dt: number) {
    this.elapsedTime += dt;

    if (this.arena) {
      this.arena.update?.(dt, this.elapsedTime, this.camera.position, this.hudSettings.graphicsQuality);
      this.arena.smartCityTransit?.update(
        dt,
        this.elapsedTime,
        this.envSnapshot.nightFactor,
        this.playerPos,
        this.camera.position,
        this.arena.groundHeightAt,
      );
      const transitActors = this.arena.smartCityTransit?.getGateActors();
      const npcGateActors = this.arena.npcManager?.getMansionGateActors?.();
      const portalActors =
        transitActors && npcGateActors && npcGateActors.length > 0
          ? [...transitActors, ...npcGateActors]
          : npcGateActors && npcGateActors.length > 0
            ? npcGateActors
            : transitActors;
      const drivenForPortals = this.activeVehicleId ? this.vehicleManager.getById(this.activeVehicleId) : null;
      this.arena.smartCity?.update(
        dt,
        this.elapsedTime,
        this.envSnapshot.nightFactor,
        1 - this.envSnapshot.nightFactor,
        this.playerPos,
        drivenForPortals ? drivenForPortals.position : null,
        this.camera.position,
        transitActors,
      );
      this.arena.scienceDistrict?.update(
        dt,
        this.elapsedTime,
        this.playerPos,
        this.camera.position,
      );
      this.arena.displays?.updateSpatialAudio(this.camera.position, this.activeVehicleId, this.hudSettings.muted);
      this.vehicleManager.updateDisplaysAudio(this.camera.position, this.activeVehicleId, this.hudSettings.muted);
      this.arena.updateMansionPortals?.(
        this.playerPos.x,
        this.playerPos.z,
        drivenForPortals ? drivenForPortals.position.x : null,
        drivenForPortals ? drivenForPortals.position.z : null,
        dt,
        portalActors,
      );
      const cloudMinX = this.mapId === 'simulator_city' ? -1240 : -210;
      const cloudMaxX = this.mapId === 'simulator_city' ? 1520 : 210;
      const clouds = this.arena.clouds;
      for (let i = 0; i < clouds.length; i++) {
        const cl = clouds[i];
        const speed = (cl.userData.driftSpeed as number) || 1.0;
        cl.position.x += speed * dt;
        if (cl.position.x > cloudMaxX) cl.position.x = cloudMinX;
      }
    }

    if (
      this.worldSystem === 'simulator' ||
      this.envCycle.autoCycle ||
      this.envCycle.weather !== 'clear' ||
      this.envCycleCustomized
    ) {
      this.envSnapshot = this.envCycle.step(dt);
      this.applyEnvironmentToScene(this.envSnapshot, dt);
    }

    if (this.worldSystem === 'simulator') {
      soundEngine.setSimulatorOutdoorAmbience(true, this.envSnapshot.nightFactor);
      soundEngine.updateMansionPartyMusic(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      if (this.arena) {
        const activeHelis = this.vehicleManager.vehicles
          .filter((v) => v.kind === 'apex_heli')
          .map((v) => ({
            x: v.position.x,
            z: v.position.z,
            hasDriver: Boolean(v.driverId),
            destroyed: v.destroyed,
          }));
        const readyPads = stepHelicopterPadRespawn(
          HELICOPTER_PADS,
          activeHelis,
          this.helipadTracker,
          dt,
        );
        for (let i = 0; i < readyPads.length; i++) {
          const pad = readyPads[i];
          this.vehicleManager.spawnDynamicVehicle(
            'apex_heli',
            pad.x,
            pad.deckY,
            pad.z,
            pad.yaw,
            'heli_respawn',
          );
          this.interactFeedback = `Helicopter arrived at ${pad.label}`;
          this.interactFeedbackTimer = 2.6;
        }
      }
      if (this.arena?.npcManager) {
        const activePlayerVeh = this.activeVehicleId ? this.vehicleManager.getById(this.activeVehicleId) : null;
        const playerVehicleCol =
          activePlayerVeh && !activePlayerVeh.destroyed
            ? {
                x: activePlayerVeh.position.x,
                z: activePlayerVeh.position.z,
                yaw: activePlayerVeh.yaw,
                radius: Math.max(activePlayerVeh.spec.bodyW, activePlayerVeh.spec.bodyL) * 0.45,
              }
            : undefined;
        const gangShots = this.arena.npcManager.update(
          dt,
          this.elapsedTime,
          this.envSnapshot.phase,
          this.camera.position,
          this.playerPos,
          (distMeters) => soundEngine.playNpcCarHorn(distMeters),
          (distMeters) => soundEngine.playPoliceSiren(distMeters),
          (distMeters, x, z) => {
            const npcSurf = this.detectFootstepSurface(x, z);
            soundEngine.playFootstep(false, {
              surface: npcSurf === 'sand' ? 'dirt' : npcSurf,
              isCrouching: false,
              distanceMeters: distMeters,
            });
            if (distMeters < 24) {
              if (npcSurf === 'water') {
                this.spawnWaterSplash(
                  _waterSplashPt.set(x, this.getWaterLevelAt(x, z) ?? -0.45, z),
                  0.62,
                  true,
                );
              } else if (npcSurf === 'sand') {
                this.spawnSandPuff(
                  _waterSplashPt.set(x, (this.arena?.groundHeightAt(x, z) ?? 0) + 0.04, z),
                  _waterSplashNorm,
                  0.58,
                );
              }
            }
          },
          this.camera,
          playerVehicleCol,
        );
        for (let gs = 0; gs < gangShots.length; gs++) {
          const s = gangShots[gs];
          _v1.set(s.fromX, s.fromY, s.fromZ);
          _v2.set(s.toX, s.toY, s.toZ);
          _v3.subVectors(_v2, _v1);
          const d = _v3.length();
          if (d > 0.1) {
            _v3.divideScalar(d);
            const envCheck = this.raycastEnvironment(_v1.x, _v1.y, _v1.z, _v3.x, _v3.y, _v3.z, d, _v4);
            if (s.kind === 'police_pistol') {
              soundEngine.playNpcPistolShot(Math.hypot(s.fromX - this.playerPos.x, s.fromZ - this.playerPos.z));
            } else {
              soundEngine.playEnemyShot();
            }
            const tracerCol =
              s.kind === 'police_pistol' ? 0x60a5fa : s.kind === 'convoy_ak47' ? 0xfbbf24 : 0xf97316;
            if (envCheck.dist < d - 0.5) {
              this.spawnTracer(_v1, _v4, tracerCol, 0.85);
            } else {
              this.spawnTracer(_v1, _v2, tracerCol, 0.85);
              if (Math.hypot(s.toX - this.playerPos.x, s.toZ - this.playerPos.z) < 1.3) {
                this.applyDamageToPlayer(s.damage, false, 'combat');
              }
            }
          }
        }
        if (this.wantedState.level > 0) {
          const nearPol = this.arena.npcManager.getNearestPoliceDistance(this.playerPos.x, this.playerPos.z);
          const dropped = stepWantedLevelState(this.wantedState, dt, nearPol);
          if (dropped && this.wantedState.level === 0) {
            this.arena.npcManager.clearPolicePursuit();
          } else {
            this.wantedSyncTimer -= dt;
            if (this.wantedSyncTimer <= 0) {
              this.wantedSyncTimer = 0.85;
              this.arena.npcManager.syncWantedPursuit(this.wantedState.level, this.playerPos.x, this.playerPos.z);
            }
          }
        }
      }
    } else {
      soundEngine.setSimulatorOutdoorAmbience(false);
    }

    if (this.interactFeedbackTimer > 0) {
      this.interactFeedbackTimer = Math.max(0, this.interactFeedbackTimer - dt);
      if (this.interactFeedbackTimer <= 0) {
        this.interactFeedback = null;
      }
    }
    if (this.mansionBlockedTimer > 0) {
      this.mansionBlockedTimer = Math.max(0, this.mansionBlockedTimer - dt);
      if (this.mansionBlockedTimer <= 0) {
        this.mansionBlockedReason = null;
      }
    }

    // Nearby Simulator Interactables (Openable Doors, Petrol Station, Convenience Store, Bistro, Bike Paint)
    this.nearInteractable = null;
    if (this.arena?.interactables && this.arena.interactables.length > 0) {
      let bestIntDist = 999;
      for (let i = 0; i < this.arena.interactables.length; i++) {
        const item = this.arena.interactables[i];
        const yTol = item.category === 'seat' || item.category === 'transit_door' ? 3.5 : 2.8;
        if (Math.abs(item.y - this.playerPos.y) > yTol) continue;
        const d = Math.hypot(item.x - this.playerPos.x, item.z - this.playerPos.z);
        if (d <= item.radius && d < bestIntDist) {
          bestIntDist = d;
          this.nearInteractable = item;
        }
      }
    }

    // Smooth exponential look damping for buttery full-screen drag & mouse aim
    this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 34, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 34, dt);
    this.weaponSwayX = THREE.MathUtils.damp(this.weaponSwayX, 0, 14, dt);
    this.weaponSwayY = THREE.MathUtils.damp(this.weaponSwayY, 0, 14, dt);
    this.flinchTimer = Math.max(0, this.flinchTimer - dt);
    this.staggerTimer = Math.max(0, this.staggerTimer - dt);

    // Tactical Doorway Proximity Detection
    this.nearDoorway = null;
    if (this.arena && this.breachTimer <= 0) {
      let bestDoorDist = 3.6;
      for (let i = 0; i < this.arena.doorways.length; i++) {
        const d = this.arena.doorways[i];
        const dx = d.x - this.playerPos.x;
        const dz = d.z - this.playerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < bestDoorDist) {
          const approachDot = (dx / (dist || 1)) * d.inwardDirX + (dz / (dist || 1)) * d.inwardDirZ;
          if (approachDot > 0.1 || dist < 1.2) {
            bestDoorDist = dist;
            this.nearDoorway = d;
          }
        }
      }
    }

    const isPlayerAlive = this.health > 0;

    // Smoke & ember FX for damaged / destroyed vehicles
    for (let i = 0; i < this.vehicleManager.vehicles.length; i++) {
      const v = this.vehicleManager.vehicles[i];
      if (!v.destroyed && v.hp >= v.maxHp * 0.55) continue;
      v.smokeTimer += dt;
      const interval = v.destroyed ? 0.28 : v.hp < v.maxHp * 0.28 ? 0.11 : 0.19;
      if (v.smokeTimer >= interval) {
        v.smokeTimer = 0;
        _v1.set(v.position.x, v.position.y + 1.1, v.position.z);
        this.spawnMuzzleSmoke(_v1, v.destroyed ? 0.85 : 1.1, 1.25);
        if (!v.destroyed && v.hp < v.maxHp * 0.28) {
          this.spawnImpactSparks(_v1, 0xff5500, 1, 0.8);
        }
      }
    }

    const drivenVehicle = this.activeVehicleId
      ? this.vehicleManager.getById(this.activeVehicleId)
      : null;

    if (drivenVehicle && this.arena && isPlayerAlive) {
      this.weaponMount.visible = false;
      if (this.fpArms) this.fpArms.group.visible = false;
      const kbThrottle =
        (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
        (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
      const kbSteer =
        (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
        (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);
      const mergedVehicleInput: VehicleInputState = {
        throttle: Math.abs(this.vehicleInput.throttle) > 0.05 ? this.vehicleInput.throttle : kbThrottle,
        steer: Math.abs(this.vehicleInput.steer) > 0.05 ? this.vehicleInput.steer : kbSteer,
        ascend: this.vehicleInput.ascend || this.keysHeld.has('Space'),
        descend:
          this.vehicleInput.descend ||
          this.keysHeld.has('ControlLeft') ||
          this.keysHeld.has('KeyQ') ||
          this.keysHeld.has('KeyZ'),
      };
      const driveStep = this.vehicleManager.stepLocalDriven(
        drivenVehicle,
        mergedVehicleInput,
        dt,
        this.arena.groundHeightAt,
        this.arena.colliders,
        this.arena.mapBounds,
        this.arena.npcManager?.getVehicleColliders() ?? [],
        this.arenaColliderGrid,
        this.elapsedTime,
        this.arena.dynamicColliders ?? [],
      );
      this.vehicleManager.updateAmbient(
        dt,
        drivenVehicle.id,
        this.elapsedTime,
        this.arena.groundHeightAt,
        this.arena.colliders,
        this.arena.mapBounds,
        this.arena.npcManager?.getVehicleColliders() ?? [],
        this.arenaColliderGrid,
        this.camera.position,
        Math.round(420 * this.adaptiveDistMul),
        this.arena.dynamicColliders ?? [],
        this.hudSettings.graphicsQuality,
      );
      this.playerPos.copy(drivenVehicle.position);
      this.playerVel.set(0, 0, 0);
      this.animState = 'drive';

      // Handle vehicle & bike collision deformation, SFX, sparks, action crash cam, and bike ejection
      let ejectedThisFrame = false;
      if (driveStep.collided && driveStep.impactSpeedMs >= 5.0) {
        const severity = THREE.MathUtils.clamp((driveStep.impactSpeedMs - 4.0) / 22.0, 0.25, 1.0);
        const isBike = drivenVehicle.kind === 'digital_bike' || drivenVehicle.kind === 'electric_scooter';
        const stage = driveStep.crashSummary?.newStage ?? (drivenVehicle.crashState?.stage ?? 1);
        soundEngine.playVehicleCrash(severity, isBike, stage, 0);
        this.spawnImpactSparks(
          driveStep.impactPoint,
          0xfbbf24,
          Math.round(6 + severity * 14),
          1.15,
        );
        if (driveStep.crashSummary?.shatterWindshield) {
          this.spawnGlassShards(driveStep.impactPoint, 12);
          soundEngine.playGlassShatter(false, 1.5);
        }
        this.screenShake = Math.max(this.screenShake, 0.025 + severity * 0.045);

        if (isBike && driveStep.impactSpeedMs >= 10.5) {
          ejectedThisFrame = true;
          this.bikeEjectTimer = this.bikeEjectDuration;
          this.bikeEjectImpactYaw = drivenVehicle.yaw;
          this.bikeEjectSpin = (Math.random() > 0.5 ? 1 : -1) * (6.5 + severity * 5.0);
          const launchSpd = Math.max(8.5, driveStep.impactSpeedMs * 0.68);
          this.bikeEjectVel.set(
            -Math.sin(drivenVehicle.yaw) * launchSpd,
            4.2 + severity * 3.0,
            -Math.cos(drivenVehicle.yaw) * launchSpd,
          );
          this.bikeEjectSparkTimer = 0;
          this.actionCrashCamTimer = this.bikeEjectDuration + 0.35;
          this.actionCrashCamSide = Math.random() > 0.5 ? 1 : -1;
          this.actionCrashCamTarget.copy(driveStep.impactPoint);
          this.exitVehicle(drivenVehicle, false);
          this.applyDamageToPlayer(Math.round(8 + severity * 16), true, 'vehicle');
        } else if (
          driveStep.crashSummary &&
          (driveStep.crashSummary.stageChanged || severity >= 0.52)
        ) {
          this.actionCrashCamTimer = driveStep.crashSummary.newStage >= 2 ? 1.45 : 0.95;
          this.actionCrashCamSide = Math.random() > 0.5 ? 1 : -1;
          this.actionCrashCamTarget.copy(driveStep.impactPoint);
          if (severity > 0.65) {
            this.applyDamageToPlayer(Math.round(4 + severity * 10), true, 'vehicle');
          }
        }
      }

      if (!ejectedThisFrame) {
        // Radiator / engine-bay smoke on Stage 2+ damaged vehicles
        if ((drivenVehicle.crashState?.stage ?? 0) >= 2 && !drivenVehicle.destroyed) {
          this.radiatorSmokeTimer -= dt;
          if (this.radiatorSmokeTimer <= 0) {
            this.radiatorSmokeTimer = drivenVehicle.crashState.stage === 3 ? 0.08 : 0.14;
            const fwdX = -Math.sin(drivenVehicle.yaw);
            const fwdZ = -Math.cos(drivenVehicle.yaw);
            _v1.set(
              drivenVehicle.position.x + fwdX * 1.45,
              drivenVehicle.position.y + 0.85,
              drivenVehicle.position.z + fwdZ * 1.45,
            );
            this.spawnMuzzleSmoke(_v1, drivenVehicle.crashState.stage === 3 ? 1.15 : 0.8, 1.3);
          }
        }

        if (drivenVehicle.puncturedWheels.some(Boolean) && Math.abs(drivenVehicle.speed) > 4.5) {
          this.rimSparkTimer -= dt;
          if (this.rimSparkTimer <= 0) {
            this.rimSparkTimer = 0.09;
            const idx = drivenVehicle.puncturedWheels.findIndex(Boolean);
            if (idx >= 0 && drivenVehicle.wheels[idx]) {
              drivenVehicle.wheels[idx].getWorldPosition(_v1);
              _v1.y = drivenVehicle.position.y + 0.08;
              this.spawnImpactSparks(_v1, 0xfbbf24, 2, 0.7);
            }
          }
        }
        if (this.playerThirdPersonRig) {
          if (this.isOpenCockpitVehicle(drivenVehicle.kind) && this.vehicleCameraMode !== 'inner') {
            this.poseRiderOnVehicle(this.playerThirdPersonRig, drivenVehicle, mergedVehicleInput.steer);
          } else {
            this.playerThirdPersonRig.root.visible = false;
          }
        }

        // Vehicle bumper collision vs city/gang NPCs
        const vehSpeed = Math.abs(drivenVehicle.speed);
        if (vehSpeed > 1.8) {
          const hitRad =
            drivenVehicle.kind === 'digital_bike'
              ? 1.45
              : drivenVehicle.kind === 'cyber_pickup' ||
                  drivenVehicle.kind === 'cyber_gold' ||
                  drivenVehicle.kind === 'range_black_suv' ||
                  drivenVehicle.kind === 'thar_black_4x4'
                ? 2.1
                : 1.9;
          if (this.arena.npcManager) {
            const npcVehHit = this.arena.npcManager.hitNearbyWithVehicle(drivenVehicle.position, hitRad, vehSpeed);
            if (npcVehHit.hit) {
              soundEngine.playVehicleImpact(npcVehHit.killed);
              this.hitMarker = npcVehHit.killed ? 'kill' : 'body';
              this.hitMarkerTimer = 0.2;
              soundEngine.playHitmarker(false, npcVehHit.killed);
              if (npcVehHit.killed) {
                this.kills++;
                this.score += 100;
              }
            }
          }
        }

        // M12 Recon Gunner simultaneous drive + fire
        this.fireCooldown = Math.max(0, this.fireCooldown - dt);
        if (this.touchFiring && this.fireCooldown <= 0) {
          this.fireVehicleMachineGun();
        }

        const gy = this.arena.groundHeightAt(drivenVehicle.position.x, drivenVehicle.position.z, drivenVehicle.position.y);
        if (this.vehicleAudioDelayTimer > 0) {
          this.vehicleAudioDelayTimer = Math.max(0, this.vehicleAudioDelayTimer - dt);
        }
        if (
          this.vehicleAudioDelayTimer <= 0 &&
          (!drivenVehicle.mansionState.isMansionExclusive || drivenVehicle.mansionState.engineRunning)
        ) {
          if (this.mansionAudioVehicleId !== drivenVehicle.id) {
            soundEngine.startVehicleAudio(drivenVehicle.kind);
            this.mansionAudioVehicleId = drivenVehicle.id;
          }
          soundEngine.updateVehicleAudio(
            Math.abs(drivenVehicle.speed) * 3.6,
            Math.abs(mergedVehicleInput.throttle) + (mergedVehicleInput.ascend ? 0.5 : 0),
            drivenVehicle.position.y > gy + 0.6,
          );
        } else if (this.mansionAudioVehicleId) {
          soundEngine.stopVehicleAudio();
          this.mansionAudioVehicleId = null;
        }
        soundEngine.setAirFlowSound(true, {
          walkSpeed: 0,
          heliSpeed: Math.abs(drivenVehicle.speed) * 0.4,
          altitude: Math.max(0, drivenVehicle.position.y - gy),
        });
        this.stepWestCityTriggers(dt, drivenVehicle);

        // Driving Camera: 1st-person interior cockpit, 3rd-person chase cam, or dynamic Action Crash Cam
        this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 18, dt);
        this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 18, dt);
        if (this.vehicleTurretFlashTimer > 0) {
          this.vehicleTurretFlashTimer = Math.max(0, this.vehicleTurretFlashTimer - dt);
          if (this.vehicleTurretFlashTimer <= 0 && drivenVehicle.turretFlash) {
            drivenVehicle.turretFlash.visible = false;
          }
        }
        if (this.actionCrashCamTimer > 0) {
          this.actionCrashCamTimer = Math.max(0, this.actionCrashCamTimer - dt);
          const orbitAng = drivenVehicle.yaw + this.actionCrashCamSide * (0.95 + (1.45 - this.actionCrashCamTimer) * 0.35);
          const crashDist = drivenVehicle.spec.camDist * 0.92;
          _camTarget.set(
            drivenVehicle.position.x,
            drivenVehicle.position.y + 1.05,
            drivenVehicle.position.z,
          );
          _camPos.set(
            drivenVehicle.position.x + Math.sin(orbitAng) * crashDist,
            drivenVehicle.position.y + 1.75,
            drivenVehicle.position.z + Math.cos(orbitAng) * crashDist,
          );
          const camFloor = this.arena.groundHeightAt(_camPos.x, _camPos.z, drivenVehicle.position.y) + 0.55;
          if (_camPos.y < camFloor) _camPos.y = camFloor;
          this.camera.position.lerp(_camPos, Math.min(1, dt * 14));
          this.camera.lookAt(_camTarget);
          if (Math.abs(this.camera.fov - 84) > 0.05) {
            this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 84, 12, dt);
            this.camera.updateProjectionMatrix();
          }
        } else if (this.vehicleCameraMode === 'inner') {
          _euler.set(drivenVehicle.pitch, drivenVehicle.yaw, drivenVehicle.roll, 'YXZ');
          _v1.copy(drivenVehicle.driverSeatOffset);
          if (drivenVehicle.kind === 'digital_bike') {
            _v1.y += 0.34;
            _v1.z -= 0.14;
          } else if (drivenVehicle.kind === 'electric_scooter') {
            _v1.y += 0.06;
            _v1.z -= 0.08;
          }
          _v1.applyEuler(_euler).add(drivenVehicle.position);
          this.camera.position.copy(_v1);
          _euler.set(
            drivenVehicle.pitch + this.driveLookPitch,
            drivenVehicle.yaw + this.driveLookYaw,
            drivenVehicle.roll * 0.45,
            'YXZ',
          );
          this.camera.quaternion.setFromEuler(_euler);
          if (Math.abs(this.camera.fov - 76) > 0.05) {
            this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 76, 12, dt);
            this.camera.updateProjectionMatrix();
          }
        } else {
          const isActionCam = this.vehicleCameraMode === 'action';
          const speedRatio = Math.min(1, Math.abs(drivenVehicle.speed) / Math.max(12, drivenVehicle.spec.maxSpeed));
          const distMul =
            this.vehicleCameraMode === 'near'
              ? 0.72
              : this.vehicleCameraMode === 'far'
                ? 1.58
                : isActionCam
                  ? 0.86 - speedRatio * 0.08
                  : 1.0;
          const hMul =
            this.vehicleCameraMode === 'near'
              ? 0.85
              : this.vehicleCameraMode === 'far'
                ? 1.38
                : isActionCam
                  ? 0.62
                  : 1.0;
          const targetVehFov =
            this.vehicleCameraMode === 'near'
              ? 75
              : this.vehicleCameraMode === 'far'
                ? 82
                : isActionCam
                  ? 82 + speedRatio * 8
                  : 78;
          const camDist = drivenVehicle.spec.camDist * distMul;
          const camH = drivenVehicle.spec.camHeight * hMul;
          const actionSideOffset = isActionCam ? Math.sin(this.elapsedTime * 0.55) * 0.24 - mergedVehicleInput.steer * 0.28 : 0;
          const aimOffset =
            drivenVehicle.kind === 'digital_bike'
              ? -0.26 + this.yaw * 0.2 + actionSideOffset
              : this.yaw * 0.25 + actionSideOffset;
          if (drivenVehicle.turretGroup) {
            drivenVehicle.turretGroup.rotation.y = aimOffset;
          }
          const camYaw = drivenVehicle.yaw + aimOffset;
          _camTarget.set(
            drivenVehicle.position.x,
            drivenVehicle.position.y + drivenVehicle.spec.seatHeight + (isActionCam ? 0.35 : 0.5),
            drivenVehicle.position.z,
          );
          _camPos.set(
            drivenVehicle.position.x + Math.sin(camYaw) * camDist,
            drivenVehicle.position.y + camH + Math.sin(-this.pitch) * 1.8,
            drivenVehicle.position.z + Math.cos(camYaw) * camDist,
          );
          const camFloor = this.arena.groundHeightAt(_camPos.x, _camPos.z, drivenVehicle.position.y) + 0.55;
          if (_camPos.y < camFloor) _camPos.y = camFloor;
          this.camera.position.lerp(_camPos, Math.min(1, dt * (isActionCam ? 13 : 10)));
          this.camera.lookAt(_camTarget);
          if (Math.abs(this.camera.fov - targetVehFov) > 0.05) {
            this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetVehFov, 8, dt);
            this.camera.updateProjectionMatrix();
          }
        }
      }
    } else {
      this.vehicleManager.updateAmbient(
        dt,
        null,
        this.elapsedTime,
        this.arena?.groundHeightAt,
        this.arena?.colliders,
        this.arena?.mapBounds,
        this.arena?.npcManager?.getVehicleColliders() ?? [],
        this.arenaColliderGrid,
        this.camera.position,
        Math.round(420 * this.adaptiveDistMul),
        this.arena?.dynamicColliders ?? [],
        this.hudSettings.graphicsQuality,
      );
      if (this.bikeEjectTimer > 0 && this.arena) {
        this.bikeEjectTimer = Math.max(0, this.bikeEjectTimer - dt);
        this.actionCrashCamTimer = Math.max(0, this.actionCrashCamTimer - dt);
        this.bikeEjectVel.y -= 18.5 * dt;
        this.playerPos.addScaledVector(this.bikeEjectVel, dt);
        this.resolveCollisions(this.playerPos, 0.48, 1.4);
        const ejectFloor = this.surfaceHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
        if (this.playerPos.y <= ejectFloor) {
          this.playerPos.y = ejectFloor;
          if (this.bikeEjectVel.y < -2.4) {
            this.bikeEjectVel.y = Math.abs(this.bikeEjectVel.y) * 0.32;
            soundEngine.playVehicleCrash(0.42, true, 1, 0);
          } else {
            this.bikeEjectVel.y = 0;
          }
          this.bikeEjectVel.x *= Math.exp(-4.2 * dt);
          this.bikeEjectVel.z *= Math.exp(-4.2 * dt);
          this.bikeEjectSparkTimer -= dt;
          if (this.bikeEjectSparkTimer <= 0 && Math.hypot(this.bikeEjectVel.x, this.bikeEjectVel.z) > 1.8) {
            this.bikeEjectSparkTimer = 0.09;
            this.spawnImpactSparks(this.playerPos, 0xa8a29e, 2, 0.75);
          }
        }
        this.smoothedGroundY = this.playerPos.y;
        this.smoothedEyeY = this.playerPos.y + 1.1;

        this.weaponMount.visible = false;
        if (this.fpArms) this.fpArms.group.visible = false;
        if (this.playerThirdPersonRig) {
          const rig = this.playerThirdPersonRig;
          rig.root.visible = true;
          rig.root.position.copy(this.playerPos);
          rig.root.rotation.y = this.bikeEjectImpactYaw;
          const tumbleP = 1 - this.bikeEjectTimer / this.bikeEjectDuration;
          rig.bodyPivot.position.y = 0.45;
          rig.bodyPivot.rotation.x = tumbleP * Math.PI * 2.2;
          rig.bodyPivot.rotation.z = this.bikeEjectSpin * tumbleP * 0.35;
          rig.leftArm.rotation.x = 1.25;
          rig.rightArm.rotation.x = -0.85;
          rig.leftLeg.rotation.x = -0.45;
          rig.rightLeg.rotation.x = 0.55;
          if (this.bikeEjectTimer <= 0) {
            rig.bodyPivot.position.y = 0;
            rig.bodyPivot.rotation.set(0, 0, 0);
          }
        }
        const isActionView = this.vehicleCameraMode === 'action';
        const crashOrbit =
          this.bikeEjectImpactYaw +
          this.actionCrashCamSide * (isActionView ? 1.05 + Math.sin(this.elapsedTime * 1.4) * 0.25 : 1.15);
        const camDist = isActionView ? 5.4 : 4.4;
        _camTarget.set(this.playerPos.x, this.playerPos.y + 0.75, this.playerPos.z);
        _camPos.set(
          this.playerPos.x + Math.sin(crashOrbit) * camDist,
          this.playerPos.y + (isActionView ? 2.15 : 1.85),
          this.playerPos.z + Math.cos(crashOrbit) * camDist,
        );
        const camFloor = this.arena.groundHeightAt(_camPos.x, _camPos.z, this.playerPos.y) + 0.55;
        if (_camPos.y < camFloor) _camPos.y = camFloor;
        this.camera.position.lerp(_camPos, Math.min(1, dt * 12));
        this.camera.lookAt(_camTarget);
      } else if (isPlayerAlive) {
        // Android Touch + Desktop Keyboard Movement + Tactical Slide + Breaching
        const kbFwd = this.seatedSpot
          ? 0
          : (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
            (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
        const kbStrafe =
          (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
          (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);
        const touchMag = Math.hypot(this.touchMoveVec.x, this.touchMoveVec.y);
        const useTouchMove = touchMag > 0.08;
        const forwardInput = this.seatedSpot ? 0 : useTouchMove ? this.touchMoveVec.y : kbFwd;
        const strafeInput = useTouchMove ? this.touchMoveVec.x : kbStrafe;
        const moveInputMag = this.seatedSpot ? 0 : Math.min(1, Math.hypot(forwardInput, strafeInput));

    // Cancel breach if player gives manual movement input mid-scan
    if (this.breachTimer > 0 && (Math.abs(forwardInput) > 0.4 || Math.abs(strafeInput) > 0.4)) {
      if (this.breachTimer < this.breachTotal * 0.45) {
        this.breachTimer = 0;
      }
    }

    const wantsCrouch = !this.seatedSpot && this.slideTimer > 0;
    const shiftHeld = this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');
    const wantsSprint =
      !this.seatedSpot &&
      (this.runModeEnabled || shiftHeld) &&
      moveInputMag > 0.14 &&
      !wantsCrouch &&
      !this.isCurrentlyAds() &&
      this.breachTimer <= 0;
    this.currentlySprinting = wantsSprint;
    this.sprintBlend = THREE.MathUtils.damp(this.sprintBlend, wantsSprint ? 1 : 0, 12, dt);

    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - 16 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 20 * dt);
    }

    this.crouchBlend = THREE.MathUtils.damp(this.crouchBlend, wantsCrouch ? 1 : 0, 12, dt);

    const staggerMul = this.staggerTimer > 0 ? 0.82 : 1.0;

    if (this.breachTimer > 0 && this.activeBreachDoorway) {
      this.breachTimer = Math.max(0, this.breachTimer - dt);
      const bp = 1 - this.breachTimer / this.breachTotal;
      if (bp < 0.62) {
        const moveP = THREE.MathUtils.clamp((bp - 0.12) / 0.48, 0, 1);
        const smoothMove = moveP * moveP * (3 - 2 * moveP);
        this.playerPos.x = THREE.MathUtils.lerp(this.breachStartPos.x, this.breachEndPos.x, smoothMove);
        this.playerPos.z = THREE.MathUtils.lerp(this.breachStartPos.z, this.breachEndPos.z, smoothMove);
        this.targetYaw = this.breachBaseYaw;
      } else {
        const scanP = (bp - 0.62) / 0.38;
        const scanOffset =
          scanP < 0.4
            ? Math.sin((scanP / 0.4) * Math.PI * 0.5) * 0.34
            : scanP < 0.82
              ? THREE.MathUtils.lerp(0.34, -0.34, (scanP - 0.4) / 0.42)
              : THREE.MathUtils.lerp(-0.34, 0, (scanP - 0.82) / 0.18);
        this.targetYaw = this.breachBaseYaw + scanOffset;
      }
      this.playerVel.x = 0;
      this.playerVel.z = 0;
    } else if (this.slideTimer > 0) {
      this.slideTimer = Math.max(0, this.slideTimer - dt);
      const slideProgress = 1 - this.slideTimer / this.slideDuration;
      const eased = 1 - Math.pow(slideProgress, 1.55);
      const slideSpeed = THREE.MathUtils.lerp(5.8, 14.5, eased) * staggerMul;
      this.playerVel.x = this.slideDir.x * slideSpeed;
      this.playerVel.z = this.slideDir.z * slideSpeed;
      this.slideRollBlend = THREE.MathUtils.damp(this.slideRollBlend, -0.085, 16, dt);

      // Floor dust/debris trail along slide
      this.slideDustAccum += dt;
      if (this.slideDustAccum >= 0.045) {
        this.slideDustAccum = 0;
        _v2.set(this.playerPos.x, this.playerPos.y + 0.08, this.playerPos.z);
        this.spawnImpactSparks(_v2, 0xa8a29e, 2, 0.7);
      }
    } else {
      this.slideRollBlend = THREE.MathUtils.damp(this.slideRollBlend, 0, 14, dt);
      const maxSpeed =
        (wantsCrouch ? 3.8 : wantsSprint ? 12.8 : this.isCurrentlyAds() ? 4.5 : 6.2) * staggerMul;

      _dir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

      _v1.set(0, 0, 0).addScaledVector(_dir, forwardInput).addScaledVector(_right, strafeInput);
      if (_v1.lengthSq() > 1) _v1.normalize();

      const targetVx = _v1.x * maxSpeed;
      const targetVz = _v1.z * maxSpeed;
      const moveRate = this.isGrounded ? 14 : moveInputMag > 0.05 ? 3.5 : 0.8;

      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, moveRate, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, moveRate, dt);

      const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
      if (moveInputMag <= 0.02 && horizSpeed < 0.12 && this.isGrounded) {
        this.playerVel.x = 0;
        this.playerVel.z = 0;
      } else if (horizSpeed > maxSpeed) {
        const ratio = maxSpeed / horizSpeed;
        this.playerVel.x *= ratio;
        this.playerVel.z *= ratio;
      }
    }

    const prevVelY = this.playerVel.y;
    const playerHeight = THREE.MathUtils.lerp(1.75, 1.12, this.crouchBlend);
    const waterSurfaceY = this.getWaterLevelAt(this.playerPos.x, this.playerPos.z);
    const bedFloorY = this.surfaceHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
    const waterDepthAtPos = waterSurfaceY !== null ? waterSurfaceY - bedFloorY : 0;
    const isPoolRimExit =
      this.playerPos.x >= MANSION_POOL_BOUNDS.minX &&
      this.playerPos.x <= MANSION_POOL_BOUNDS.maxX &&
      this.playerPos.z >= MANSION_POOL_BOUNDS.minZ &&
      this.playerPos.z <= MANSION_POOL_BOUNDS.maxZ
        ? this.playerPos.x <= MANSION_POOL_BOUNDS.minX + 1.5 ||
          this.playerPos.x >= MANSION_POOL_BOUNDS.maxX - 1.5 ||
          this.playerPos.z <= MANSION_POOL_BOUNDS.minZ + 1.5 ||
          this.playerPos.z >= MANSION_POOL_BOUNDS.maxZ - 1.5
        : waterDepthAtPos < 0.9;

    const shouldStepSwim =
      waterSurfaceY !== null &&
      (this.swimState.isSwimming || (this.playerPos.y < waterSurfaceY - 0.35 && waterDepthAtPos >= 0.72));

    let floorY = bedFloorY;
    if (this.seatedSpot) {
      this.seatedSpot.syncPosition?.();
      this.swimState.isSwimming = false;
      this.underwaterFogBlend = THREE.MathUtils.damp(this.underwaterFogBlend, 0, 10, dt);
      this.slideTimer = 0;
      this.playerVel.set(0, 0, 0);
      this.isGrounded = true;
      this.wasGrounded = true;
      floorY =
        this.seatedSpot.seatTag === 'transit_seat'
          ? this.seatedSpot.y - 0.48
          : this.arena
            ? this.arena.groundHeightAt(this.seatedSpot.x, this.seatedSpot.z, this.seatedSpot.y)
            : 0;
      this.playerPos.set(this.seatedSpot.x, floorY, this.seatedSpot.z);
      if (this.seatedSpot.canRotateChair && Math.abs(strafeInput) > 0.04) {
        const prevSeatedYaw = this.seatedYaw;
        this.seatedYaw = stepSeatedChairYaw(this.seatedYaw, strafeInput, dt);
        const deltaYaw = this.seatedYaw - prevSeatedYaw;
        this.yaw += deltaYaw;
        this.targetYaw += deltaYaw;
        if (this.seatedSpot.chairGroup) {
          this.seatedSpot.chairGroup.rotation.y = this.seatedYaw - Math.PI * 0.5;
        }
      }
    } else if (shouldStepSwim && waterSurfaceY !== null) {
      const diveHeld = this.keysHeld.has('KeyC') || this.keysHeld.has('ControlLeft');
      const ascendHeld = this.keysHeld.has('Space');
      _dir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
      _v1.set(0, 0, 0).addScaledVector(_dir, forwardInput).addScaledVector(_right, strafeInput);
      if (_v1.lengthSq() > 1) _v1.normalize();
      if (!this.swimState.isSwimming) {
        this.swimState.y = this.playerPos.y;
        this.swimState.vx = this.playerVel.x;
        this.swimState.vy = this.playerVel.y;
        this.swimState.vz = this.playerVel.z;
      }
      const swimRes = stepSwimmingPhysics(
        this.swimState,
        {
          moveDirX: _v1.x,
          moveDirZ: _v1.z,
          sprint: wantsSprint,
          ascend: ascendHeld,
          dive: diveHeld,
          floorY: bedFloorY,
          waterY: waterSurfaceY,
          nearPoolRim: isPoolRimExit,
        },
        dt,
      );
      if (swimRes.enteredWater) {
        this.spawnWaterSplash(_waterSplashPt.set(this.playerPos.x, waterSurfaceY, this.playerPos.z), 1.15, true);
        soundEngine.playSwimStroke(true);
      }
      if (this.swimState.isSwimming) {
        this.playerPos.x += this.swimState.vx * dt;
        this.playerPos.z += this.swimState.vz * dt;
        this.playerPos.y = this.swimState.y;
        this.playerVel.set(this.swimState.vx, this.swimState.vy, this.swimState.vz);
        this.resolveCollisions(this.playerPos, 0.48, 1.25);
        floorY = this.surfaceHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
        if (this.playerPos.y < floorY) {
          this.playerPos.y = floorY;
          this.swimState.y = floorY;
        }
        this.wasGrounded = false;
        this.isGrounded = false;
        this.slideTimer = 0;
        const swimHoriz = Math.hypot(this.swimState.vx, this.swimState.vz);
        if (swimHoriz > 0.75) {
          this.swimStrokeTimer -= dt;
          if (this.swimStrokeTimer <= 0) {
            this.swimStrokeTimer = wantsSprint ? 0.36 : 0.54;
            soundEngine.playSwimStroke(wantsSprint);
            if (!swimRes.isUnderwater) {
              this.spawnWaterSplash(_waterSplashPt.set(this.playerPos.x, waterSurfaceY, this.playerPos.z), 0.52, false);
            }
          }
        }
        this.underwaterFogBlend = THREE.MathUtils.damp(this.underwaterFogBlend, swimRes.isUnderwater ? 1 : 0, 10, dt);
      } else {
        this.underwaterFogBlend = THREE.MathUtils.damp(this.underwaterFogBlend, 0, 10, dt);
        this.playerPos.y += 0.28;
        this.playerVel.y = 5.2;
        this.isGrounded = false;
      }
    } else {
      this.swimState.isSwimming = false;
      this.underwaterFogBlend = THREE.MathUtils.damp(this.underwaterFogBlend, 0, 10, dt);
      this.playerVel.y -= 22.0 * dt;

      this.playerPos.x += this.playerVel.x * dt;
      this.playerPos.y += this.playerVel.y * dt;
      this.playerPos.z += this.playerVel.z * dt;

      if (!this.seatedSpot && this.arena?.smartCityTransit?.consumePlayerCarryDelta) {
        if (this.arena.smartCityTransit.consumePlayerCarryDelta(this.playerPos, _v1)) {
          this.playerPos.x += _v1.x;
          this.playerPos.y += _v1.y;
          this.playerPos.z += _v1.z;
        }
      }

      this.resolveCollisions(this.playerPos, 0.48, playerHeight);

      floorY = this.surfaceHeightAt(this.playerPos.x, this.playerPos.z, this.playerPos.y);
      this.wasGrounded = this.isGrounded;
      if (this.playerPos.y <= floorY) {
        this.playerPos.y = floorY;
        this.playerVel.y = 0;
        this.isGrounded = true;
        if (!this.wasGrounded && prevVelY < -2.5) {
          this.landImpulse = Math.min(0.11, Math.abs(prevVelY) * 0.009);
          if (prevVelY < -3.6) {
            const landSurf = this.detectFootstepSurface(this.playerPos.x, this.playerPos.z);
            soundEngine.playFootstep(true, {
              surface: landSurf === 'sand' ? 'dirt' : landSurf,
              isCrouching: wantsCrouch,
              isLanding: true,
            });
            if (landSurf === 'water') {
              this.spawnWaterSplash(
                _waterSplashPt.set(this.playerPos.x, Math.max(this.playerPos.y, this.getWaterLevelAt(this.playerPos.x, this.playerPos.z) ?? this.playerPos.y), this.playerPos.z),
                1.05,
                true,
              );
            } else if (landSurf === 'sand') {
              this.spawnSandPuff(
                _waterSplashPt.set(this.playerPos.x, this.playerPos.y + 0.05, this.playerPos.z),
                _waterSplashNorm,
                1.0,
              );
            }
          }
        }
      } else if (
        this.wasGrounded &&
        prevVelY <= 0.15 &&
        this.slideTimer <= 0 &&
        this.playerPos.y - floorY <= 0.44
      ) {
        // Stick smoothly to downhill terrain slopes, curbs & descending elevator platforms
        this.playerPos.y = floorY;
        this.playerVel.y = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    }
    this.landImpulse = THREE.MathUtils.damp(this.landImpulse, 0, 14, dt);
    this.stepWestCityTriggers(dt, null);

    // Tactical Cover Detection (nearby cover wall within 1.28m via spatial grid)
    this.isInCover = false;
    this.coverWallHeight = 0;
    if (this.arena && this.slideTimer <= 0 && !wantsSprint && this.isGrounded) {
      const cols = this.arena.colliders;
      const checkCoverCollider = (c: ColliderBox) => {
        const h = c.maxY - c.minY;
        if (h < 0.85 || this.playerPos.y < c.minY - 0.35 || this.playerPos.y > c.maxY + 0.1) return;
        let dx = 0;
        let dz = 0;
        if (Math.abs(c.rotY) > 0.001) {
          const relX = this.playerPos.x - c.cx;
          const relZ = this.playerPos.z - c.cz;
          const lx = relX * c.cosY - relZ * c.sinY;
          const lz = relX * c.sinY + relZ * c.cosY;
          dx = lx - THREE.MathUtils.clamp(lx, -c.halfW, c.halfW);
          dz = lz - THREE.MathUtils.clamp(lz, -c.halfD, c.halfD);
        } else {
          dx = this.playerPos.x - THREE.MathUtils.clamp(this.playerPos.x, c.minX, c.maxX);
          dz = this.playerPos.z - THREE.MathUtils.clamp(this.playerPos.z, c.minZ, c.maxZ);
        }
        const d = Math.hypot(dx, dz);
        if (d < 1.28) {
          this.isInCover = true;
          this.coverWallHeight = Math.max(this.coverWallHeight, c.maxY - this.playerPos.y);
        }
      };
      if (this.arenaColliderGrid) {
        forEachColliderInBounds(
          this.arenaColliderGrid,
          this.playerPos.x - 1.5,
          this.playerPos.z - 1.5,
          this.playerPos.x + 1.5,
          this.playerPos.z + 1.5,
          (idx) => checkCoverCollider(cols[idx]),
        );
      } else {
        for (let i = 0; i < cols.length; i++) checkCoverCollider(cols[i]);
      }
    }
    if (!this.isInCover && this.peekDir !== 0) {
      this.peekDir = 0;
    }
    this.peekBlend = THREE.MathUtils.damp(this.peekBlend, this.peekDir, 13, dt);

    // Quantized directional shadow frustum (updates every 4m only to avoid ground shadow shimmer)
    if (this.keyLight.castShadow) {
      if (
        Math.abs(this.playerPos.x - this.lastShadowX) >= 4 ||
        Math.abs(this.playerPos.z - this.lastShadowZ) >= 4 ||
        Math.abs(this.playerPos.y - this.lastShadowY) >= 2
      ) {
        this.lastShadowX = Math.round(this.playerPos.x / 4) * 4;
        this.lastShadowZ = Math.round(this.playerPos.z / 4) * 4;
        this.lastShadowY = Math.round(this.playerPos.y / 2) * 2;
        this.keyLight.position.set(this.lastShadowX + 42, 68, this.lastShadowZ + 34);
        this.keyLight.target.position.set(this.lastShadowX, this.lastShadowY, this.lastShadowZ);
        this.keyLight.target.updateMatrixWorld();
      }
    }

    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const isFastFootsteps = wantsSprint || this.slideTimer > 0 || (horizSpeed > 6.8 && !wantsCrouch);
    const isActivelyWalking = this.isGrounded && horizSpeed > 0.65 && this.slideTimer <= 0;
    this.walkBobWeight = THREE.MathUtils.damp(this.walkBobWeight, isActivelyWalking ? 1 : 0, 10, dt);
    if (isActivelyWalking) {
      const strideSpeedScale = THREE.MathUtils.clamp(
        horizSpeed / (wantsSprint ? 12.8 : wantsCrouch ? 3.8 : 6.2),
        0.55,
        1.25,
      );
      this.walkBobPhase =
        (this.walkBobPhase + dt * (wantsSprint ? 13.5 : wantsCrouch ? 6.8 : 9.2) * strideSpeedScale) %
        (Math.PI * 2);
      this.footstepAccum += horizSpeed * dt;
      const stepThreshold = wantsSprint ? 2.65 : wantsCrouch ? 1.85 : 2.15;
      if (this.footstepAccum > stepThreshold) {
        this.footstepAccum = 0;
        const stepSurf = this.detectFootstepSurface(this.playerPos.x, this.playerPos.z);
        soundEngine.playFootstep(wantsSprint, {
          surface: stepSurf === 'sand' ? 'dirt' : stepSurf,
          isCrouching: wantsCrouch,
        });
        if (stepSurf === 'water') {
          this.spawnWaterSplash(
            _waterSplashPt.set(this.playerPos.x, Math.max(this.playerPos.y, this.getWaterLevelAt(this.playerPos.x, this.playerPos.z) ?? this.playerPos.y), this.playerPos.z),
            wantsSprint ? 0.92 : 0.72,
            true,
          );
        } else if (stepSurf === 'sand') {
          this.spawnSandPuff(
            _waterSplashPt.set(this.playerPos.x, this.playerPos.y + 0.04, this.playerPos.z),
            _waterSplashNorm,
            wantsSprint ? 0.9 : 0.7,
          );
        }
        if (isFastFootsteps) {
          this.emitSoundAlert(this.playerPos, 18.0, 'footstep');
        }
      }
    }
    soundEngine.setAirFlowSound(true, {
      walkSpeed: horizSpeed,
      heliSpeed: 0,
      altitude: Math.max(0, this.playerPos.y - floorY),
    });

    // Slow Tactical Health Recovery when waiting safely out of fire (starts after 5s without damage)
    this.timeSinceDamage += dt;
    if (
      this.health > 0 &&
      this.health < this.maxHealth &&
      this.timeSinceDamage >= 5.0
    ) {
      const recoveryRate = horizSpeed < 1.8 || wantsCrouch ? 3.2 : 1.8;
      this.health = Math.min(this.maxHealth, this.health + recoveryRate * dt);
      this.isRecoveringHealth = true;
    } else {
      this.isRecoveringHealth = false;
    }

    // Firing, Burst Queue, Multi-Stage Reload & Grenade Throw
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    const spec = WEAPONS[this.activeWeapon];
    if (this.burstShotsRemaining > 0 && !this.isReloading && this.grenadeAnimTimer <= 0) {
      this.burstShotTimer -= dt;
      if (this.burstShotTimer <= 0) {
        this.burstShotsRemaining--;
        this.burstShotTimer = this.activeWeapon === 'shotgun' ? 0.14 : 0.065;
        this.tryFireShot(true);
      }
    } else if (this.touchFiring && this.activeVehicleId && this.fireCooldown <= 0) {
      this.fireVehicleMachineGun();
    } else if (
      this.touchFiring &&
      !this.activeVehicleId &&
      this.fireModes[this.activeWeapon] === 'auto' &&
      this.fireCooldown <= 0
    ) {
      this.tryFireShot();
    }

    let reloadProgress = 0;
    const activeVm = this.viewModels[this.activeWeapon];
    if (this.isReloading) {
      this.reloadTimer -= dt;
      reloadProgress = 1 - Math.max(0, this.reloadTimer / this.reloadDuration);

      if (reloadProgress < 0.25) {
        this.reloadStage = 'Mag Out';
        if (activeVm) activeVm.magGroup.position.y = -(reloadProgress / 0.25) * 0.2;
        if (reloadProgress >= 0.20 && !this.reloadMagDropped) {
          this.reloadMagDropped = true;
          soundEngine.playMagDrop();
          this.spawnDroppingMagazine();
          if (activeVm) activeVm.magGroup.visible = false;
        }
      } else if (reloadProgress < 0.56) {
        this.reloadStage = 'Fresh Mag';
        if (activeVm) activeVm.magGroup.visible = false;
      } else if (reloadProgress < 0.78) {
        this.reloadStage = 'Insert';
        const insP = (reloadProgress - 0.56) / 0.22;
        if (activeVm) {
          activeVm.magGroup.visible = true;
          activeVm.magGroup.position.y = THREE.MathUtils.lerp(-0.2, 0, insP);
        }
        if (insP > 0.88) {
          this.reloadSlapBump = Math.max(this.reloadSlapBump, 0.022);
        }
      } else {
        this.reloadStage = 'Chamber';
        if (activeVm) {
          activeVm.magGroup.visible = true;
          activeVm.magGroup.position.y = 0;
          const rackP = (reloadProgress - 0.78) / 0.22;
          const boltPull = Math.sin(rackP * Math.PI) * 0.062;
          activeVm.boltMesh.position.z = boltPull;
        }
        if (reloadProgress >= 0.80 && !this.reloadBoltRacked) {
          this.reloadBoltRacked = true;
          soundEngine.playBoltRack();
        }
      }

      if (this.reloadTimer <= 0) {
        const needed = spec.magSize - this.ammoInMag[this.activeWeapon];
        const taken = Math.min(needed, this.reserveAmmo[this.activeWeapon]);
        this.ammoInMag[this.activeWeapon] += taken;
        this.reserveAmmo[this.activeWeapon] -= taken;
        this.isReloading = false;
        this.reloadStage = '';
        if (activeVm) {
          activeVm.magGroup.visible = true;
          activeVm.magGroup.position.set(0, 0, 0);
          activeVm.boltMesh.position.set(0, 0, 0);
          if (activeVm.pumpMesh) activeVm.pumpMesh.position.z = 0;
        }
        soundEngine.playReloadFinish();
      }
    } else if (activeVm) {
      activeVm.magGroup.visible = true;
      activeVm.magGroup.position.set(0, 0, 0);
      if (this.shotAnimTimer > 0 && this.shotAnimDuration > 0) {
        this.shotAnimTimer = Math.max(0, this.shotAnimTimer - dt);
        const prog = 1 - this.shotAnimTimer / this.shotAnimDuration;
        if (spec.actionStyle === 'pump' && activeVm.pumpMesh) {
          const pumpCycle = prog > 0.22 ? Math.sin(((prog - 0.22) / 0.78) * Math.PI) : 0;
          activeVm.pumpMesh.position.z = pumpCycle * 0.068;
          activeVm.boltMesh.position.z = pumpCycle * 0.042;
        } else if (spec.actionStyle === 'bolt') {
          const boltCycle = prog > 0.16 ? Math.sin(((prog - 0.16) / 0.84) * Math.PI) : 0;
          activeVm.boltMesh.position.z = boltCycle * 0.055;
        } else {
          const blowback = Math.sin(prog * Math.PI) * (spec.actionStyle === 'slide' ? 0.046 : 0.036);
          activeVm.boltMesh.position.z = blowback;
        }
      } else {
        activeVm.boltMesh.position.set(0, 0, 0);
        if (activeVm.pumpMesh) activeVm.pumpMesh.position.z = 0;
      }
    }

    // Grenade throwing animation timeline
    let grenadePhase = 0;
    if (this.grenadeAnimTimer > 0) {
      this.grenadeAnimTimer = Math.max(0, this.grenadeAnimTimer - dt);
      grenadePhase = 1 - this.grenadeAnimTimer / this.grenadeAnimDuration;
      if (grenadePhase >= 0.16 && !this.grenadePinPulled) {
        this.grenadePinPulled = true;
        soundEngine.playPinPull();
      }
      if (grenadePhase >= 0.42 && !this.grenadeReleased) {
        this.grenadeReleased = true;
        this.spawnThrownGrenadeProjectile();
      }
    }

    // Toggle visible PG-7V warhead on RPG-7V launcher viewmodel
    const rocketVm = this.viewModels.rocket;
    if (rocketVm?.loadedWarhead) {
      rocketVm.loadedWarhead.visible =
        this.ammoInMag.rocket > 0 && (!this.isReloading || reloadProgress > 0.65);
    }

    // Compute unified PlayerAnimState
    if (this.breachTimer > 0) this.animState = 'breach';
    else if (this.grenadeAnimTimer > 0) this.animState = 'grenade';
    else if (this.isReloading) this.animState = 'reload';
    else if (this.slideTimer > 0) this.animState = 'slide';
    else if (!this.isGrounded) this.animState = 'jump';
    else if (this.landImpulse > 0.03) this.animState = 'land';
    else if (this.isInCover && this.peekDir !== 0) this.animState = 'cover_peek';
    else if (this.isInCover && this.crouchBlend > 0.45) this.animState = 'cover_crouch';
    else if (wantsSprint && horizSpeed > 4.5) this.animState = 'sprint';
    else if (this.crouchBlend > 0.45 && horizSpeed > 0.8) this.animState = 'crouch_walk';
    else if (this.crouchBlend > 0.45) this.animState = 'crouch_idle';
    else if (horizSpeed > 0.65) this.animState = 'walk';
    else this.animState = 'idle';

    this.recoilPitchOffset = THREE.MathUtils.damp(this.recoilPitchOffset, 0, 14, dt);
    this.recoilYawOffset = THREE.MathUtils.damp(this.recoilYawOffset, 0, 14, dt);
    this.recoilKickZ = THREE.MathUtils.damp(this.recoilKickZ, 0, 20, dt);
    this.recoilRoll = THREE.MathUtils.damp(this.recoilRoll, 0, 18, dt);
    this.gunFovPunch = THREE.MathUtils.damp(this.gunFovPunch, 0, 22, dt);
    this.reloadSlapBump = THREE.MathUtils.damp(this.reloadSlapBump, 0, 20, dt);
    this.screenShake = THREE.MathUtils.damp(this.screenShake, 0, 14, dt);
    this.crosshairBloom = Math.max(0, this.crosshairBloom - dt * 0.095);

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      this.muzzleLight.intensity = THREE.MathUtils.damp(this.muzzleLight.intensity, 0, 30, dt);
    } else {
      this.muzzleLight.intensity = 0;
    }
    if (activeVm) {
      activeVm.muzzleFlashGroup.visible =
        this.muzzleFlashTimer > 0 && this.perspective === 'first' && !this.activeVehicleId;
    }

    const isAds = this.isCurrentlyAds();
    this.adsBlend = THREE.MathUtils.damp(this.adsBlend, isAds ? 1 : 0, 15 * (spec.adsSpeedMul ?? 1), dt);

    const zoomOpts = WEAPON_ZOOM_OPTIONS[this.activeWeapon];
    const activeZoom = zoomOpts[this.weaponZoomIndices[this.activeWeapon] % zoomOpts.length];
    const activeAdsFov = activeZoom ? activeZoom.fov : spec.adsFov;

    const targetFov =
      THREE.MathUtils.lerp(
        this.slideTimer > 0 ? 76.5 : 74 + this.sprintBlend * 2.2,
        activeAdsFov,
        this.adsBlend,
      ) + this.gunFovPunch;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 15, dt);
      this.camera.updateProjectionMatrix();
    }

    // Rock-steady First-Person & Third-Person Camera (zero walking head-bob or sway jitter)
    const coverPeekUp =
      this.isInCover && this.crouchBlend > 0.4 && this.coverWallHeight <= 1.55 ? this.adsBlend * 0.28 : 0;
    const baseEyeHeight = this.seatedSpot
      ? Math.max(1.05, this.seatedSpot.y - floorY + 0.72)
      : this.slideTimer > 0
        ? 0.86
        : THREE.MathUtils.lerp(1.62, 1.05, this.crouchBlend) + coverPeekUp;

    const flinchProgress = this.flinchTimer > 0 ? Math.sin((this.flinchTimer / 0.22) * Math.PI) : 0;
    const flinchRoll = flinchProgress * this.flinchDir * 0.04;
    const flinchPitch = -flinchProgress * 0.028;

    const shakeP = this.screenShake > 0.001 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0.001 ? (Math.random() - 0.5) * this.screenShake : 0;
    const effPitch = THREE.MathUtils.clamp(
      this.pitch + this.recoilPitchOffset + shakeP + flinchPitch,
      -1.35,
      1.35,
    );
    const effYaw = this.yaw + this.recoilYawOffset + shakeY;
    const totalRoll = this.slideRollBlend + flinchRoll + this.peekBlend * -0.055;

    // Collision-checked lateral peek shift
    let peekShiftX = 0;
    let peekShiftZ = 0;
    if (Math.abs(this.peekBlend) > 0.01) {
      const targetShift = this.peekBlend * 0.42;
      _right.set(Math.cos(effYaw), 0, -Math.sin(effYaw)).normalize();
      const sSign = targetShift >= 0 ? 1 : -1;
      const maxClear = this.raycastColliders(
        this.playerPos.x,
        this.playerPos.y + baseEyeHeight,
        this.playerPos.z,
        _right.x * sSign,
        0,
        _right.z * sSign,
        Math.abs(targetShift) + 0.25,
      );
      const safeDist = Math.min(Math.abs(targetShift), Math.max(0, maxClear - 0.22));
      peekShiftX = _right.x * sSign * safeDist;
      peekShiftZ = _right.z * sSign * safeDist;
    }

    const targetEyeOffset = baseEyeHeight - this.landImpulse;
    this.smoothedEyeOffset =
      this.breachTimer > 0
        ? targetEyeOffset
        : THREE.MathUtils.damp(this.smoothedEyeOffset, targetEyeOffset, 18, dt);
    if (this.seatedSpot?.seatTag === 'transit_seat') {
      this.smoothedGroundY = this.playerPos.y;
    } else if (Math.abs(this.playerPos.y - this.smoothedGroundY) > 0.45 || !this.isGrounded) {
      this.smoothedGroundY = THREE.MathUtils.damp(this.smoothedGroundY, this.playerPos.y, 26, dt);
    } else {
      this.smoothedGroundY = THREE.MathUtils.damp(this.smoothedGroundY, this.playerPos.y, 16, dt);
    }
    this.smoothedEyeY = this.smoothedGroundY + this.smoothedEyeOffset;

    const opticalAdsScope =
      this.adsBlend > 0.48 && !this.isReloading && this.grenadeAnimTimer <= 0;
    const sniperFarTarget =
      opticalAdsScope && this.activeWeapon === 'sniper'
        ? Math.max(this.baseCameraFar, 1450)
        : this.baseCameraFar;
    if (Math.abs(this.camera.far - sniperFarTarget) > 1) {
      this.camera.far = sniperFarTarget;
      this.camera.updateProjectionMatrix();
    }
    if (this.perspective === 'first' || opticalAdsScope) {
      if (this.playerThirdPersonRig && this.perspective === 'third') {
        this.playerThirdPersonRig.root.visible = false;
      }
      this.camera.position.set(
        this.playerPos.x + peekShiftX,
        this.smoothedGroundY + this.smoothedEyeOffset,
        this.playerPos.z + peekShiftZ,
      );
      _euler.set(effPitch, effYaw, totalRoll, 'YXZ');
      this.camera.quaternion.setFromEuler(_euler);

      const isUnarmed = this.activeWeapon === 'unarmed';
      const hideVmInScope = opticalAdsScope;
      const grenadeHide = this.grenadeAnimTimer > 0 && grenadePhase > 0.1 && grenadePhase < 0.86;
      this.weaponMount.visible = this.perspective === 'first' && !isUnarmed && !hideVmInScope && !grenadeHide;

      const hipX = 0.21;
      const hipY = -0.21;
      const hipZ = -0.42;
      const adsX = 0.0;
      const adsY = this.activeWeapon === 'sniper' ? -0.078 : this.activeWeapon === 'pistol' ? -0.068 : -0.074;
      const adsZ = -0.32;

      const notAds = 1 - this.adsBlend;
      const tacSprint = this.sprintBlend * notAds * (this.isReloading ? 0.2 : 1.0);
      const stride = this.walkBobPhase;
      const walkSwingX = Math.sin(stride) * 0.011 * this.walkBobWeight * notAds;
      const walkSwingY = Math.abs(Math.cos(stride)) * 0.01 * this.walkBobWeight * notAds;
      const sprintBobX = Math.sin(stride * 1.05) * 0.018 * tacSprint;
      const sprintBobY = -Math.abs(Math.cos(stride * 1.05)) * 0.02 * tacSprint;
      const idleBreathY = Math.sin(this.elapsedTime * 1.9) * 0.0022 * notAds;

      // Multi-stage Tactical Reload Pose (Cant -> Drop Mag -> Slap Fresh Mag -> Rack Bolt -> Settle)
      let reloadShiftX = 0;
      let reloadShiftY = 0;
      let reloadShiftZ = 0;
      let reloadRotX = 0;
      let reloadRotY = 0;
      let reloadRotZ = 0;
      let boltPullTug = 0;
      if (this.isReloading) {
        const cantEnv = Math.sin(Math.min(1, reloadProgress / 0.84) * Math.PI);
        const rackPhase = reloadProgress >= 0.78 ? Math.sin(((reloadProgress - 0.78) / 0.22) * Math.PI) : 0;
        boltPullTug = rackPhase * 0.026;
        reloadShiftX = -0.032 * cantEnv + rackPhase * 0.014;
        reloadShiftY = -0.055 * cantEnv + this.reloadSlapBump;
        reloadShiftZ = 0.032 * cantEnv + boltPullTug;
        reloadRotX = 0.24 * cantEnv - rackPhase * 0.09;
        reloadRotY = -0.26 * cantEnv;
        reloadRotZ = 0.52 * cantEnv - rackPhase * 0.22;
      }

      const grenadeDip = this.grenadeAnimTimer > 0 ? Math.sin(grenadePhase * Math.PI) * 0.35 : 0;
      const breachLift = this.breachTimer > 0 ? Math.sin((1 - this.breachTimer / this.breachTotal) * Math.PI) * 0.06 : 0;
      const kickZ = this.recoilPitchOffset * 0.55 + this.recoilKickZ;
      const recoilLiftY = Math.min(0.025, this.recoilKickZ * 0.14);

      this.weaponMount.position.set(
        THREE.MathUtils.lerp(hipX, adsX, this.adsBlend) - 0.058 * tacSprint + walkSwingX + sprintBobX + reloadShiftX,
        THREE.MathUtils.lerp(hipY, adsY, this.adsBlend) - 0.044 * tacSprint - walkSwingY + sprintBobY + idleBreathY + reloadShiftY - grenadeDip + breachLift + recoilLiftY,
        THREE.MathUtils.lerp(hipZ, adsZ, this.adsBlend) + 0.026 * tacSprint + kickZ + reloadShiftZ,
      );
      this.weaponMount.rotation.set(
        THREE.MathUtils.clamp(this.recoilPitchOffset * 1.15, -0.1, 0.24) - 0.14 * tacSprint + reloadRotX + (this.breachTimer > 0 ? 0.22 : 0),
        0.54 * tacSprint + reloadRotY,
        this.recoilRoll + 0.46 * tacSprint + Math.sin(stride) * 0.04 * tacSprint + (this.slideTimer > 0 ? 0.24 : 0) + reloadRotZ,
      );

      // First-person Articulated Operator Sleeves, Forearms & Hand-Held Frag Grenade Viewmodel
      if (this.fpArms) {
        this.fpArms.group.visible = !hideVmInScope;
        const arms = this.fpArms;
        if (this.grenadeAnimTimer > 0) {
          arms.grenadeGroup.visible = !this.grenadeReleased;
          arms.grenadePin.visible = grenadePhase < 0.24;
          if (grenadePhase < 0.22) {
            const pp = grenadePhase / 0.22;
            arms.rightShoulder.position.set(0.14, -0.15, -0.05);
            arms.rightShoulder.rotation.set(0.55, 0.25, 0);
            arms.rightElbow.rotation.set(0.15, 0.1, 0);
            arms.leftShoulder.position.set(-0.14 - pp * 0.08, -0.16, -0.06);
            arms.leftShoulder.rotation.set(0.55, -0.35 - pp * 0.25, 0);
            arms.leftElbow.rotation.set(0.15, -0.2, 0);
          } else if (grenadePhase < 0.42) {
            const wp = (grenadePhase - 0.22) / 0.20;
            arms.rightShoulder.position.set(0.24, -0.12 + wp * 0.14, -0.02);
            arms.rightShoulder.rotation.set(THREE.MathUtils.lerp(0.55, 1.05, wp), -0.1, -0.2);
            arms.rightElbow.rotation.set(THREE.MathUtils.lerp(0.15, 0.72, wp), 0, 0);
            arms.leftShoulder.position.set(-0.26, -0.25, -0.06);
            arms.leftShoulder.rotation.set(0.25, 0.1, 0);
          } else {
            const tp = (grenadePhase - 0.42) / 0.58;
            arms.rightShoulder.position.set(0.22, THREE.MathUtils.lerp(0.02, -0.22, tp), -0.05);
            arms.rightShoulder.rotation.set(THREE.MathUtils.lerp(1.05, 0.2, tp), 0.15, 0);
            arms.rightElbow.rotation.set(THREE.MathUtils.lerp(0.72, -0.35, tp), 0, 0);
            arms.leftShoulder.position.set(-0.24, -0.20, -0.06);
            arms.leftShoulder.rotation.set(0.42, -0.25, 0);
          }
        } else if (isUnarmed) {
          arms.grenadeGroup.visible = false;
          const handSwing = Math.sin(this.walkBobPhase) * 0.18 * this.walkBobWeight;
          arms.rightShoulder.position.set(0.28, -0.36 - handSwing * 0.06, -0.02);
          arms.rightShoulder.rotation.set(-0.08 + handSwing, 0.06, 0.12);
          arms.rightElbow.rotation.set(0.22 + Math.max(0, handSwing) * 0.25, 0, 0);
          arms.leftShoulder.position.set(-0.28, -0.36 + handSwing * 0.06, -0.02);
          arms.leftShoulder.rotation.set(-0.08 - handSwing, -0.06, -0.12);
          arms.leftElbow.rotation.set(0.22 + Math.max(0, -handSwing) * 0.25, 0, 0);
        } else {
          arms.grenadeGroup.visible = false;
          const mOffX = this.weaponMount.position.x - 0.21;
          const mOffY = this.weaponMount.position.y + 0.21;
          const mOffZ = this.weaponMount.position.z + 0.42;
          arms.rightShoulder.position.set(0.25 + mOffX * 0.58, -0.21 + mOffY * 0.58, -0.04 + mOffZ * 0.45);
          arms.rightShoulder.rotation.set(0.48 + this.recoilPitchOffset * 0.7 + reloadRotX * 0.45, 0.12 + 0.24 * tacSprint, this.recoilRoll * 0.55);
          arms.rightElbow.rotation.set(-0.12, 0.18, 0);

          if (this.isReloading && reloadProgress >= 0.12 && reloadProgress <= 0.78) {
            const reach = Math.sin(((reloadProgress - 0.12) / 0.66) * Math.PI);
            arms.leftShoulder.position.set(-0.22 + mOffX * 0.3, -0.22 - reach * 0.2, -0.06 + reach * 0.04);
            arms.leftShoulder.rotation.set(0.34 - reach * 0.52, -0.28, 0);
            arms.leftElbow.rotation.set(-0.08 - reach * 0.32, -0.32, 0);
          } else if (this.isReloading && reloadProgress > 0.78) {
            const rackReach = Math.sin(((reloadProgress - 0.78) / 0.22) * Math.PI);
            arms.leftShoulder.position.set(-0.22 + mOffX * 0.45, -0.19 + mOffY * 0.45, -0.08 + rackReach * 0.07);
            arms.leftShoulder.rotation.set(0.56 - rackReach * 0.14, -0.34, 0.12 * rackReach);
            arms.leftElbow.rotation.set(-0.14 - rackReach * 0.24, -0.28, 0);
          } else {
            arms.leftShoulder.position.set(-0.23 + mOffX * 0.52, -0.20 + mOffY * 0.52, -0.08 + mOffZ * 0.4);
            arms.leftShoulder.rotation.set(
              0.52 + tacSprint * 0.22,
              -0.38 - this.adsBlend * 0.12 + tacSprint * 0.34,
              this.recoilRoll * 0.4 + tacSprint * 0.26,
            );
            arms.leftElbow.rotation.set(-0.1, -0.25, 0);
          }
        }
      }
    } else {
      if (this.fpArms) this.fpArms.group.visible = false;
      _euler.set(effPitch, effYaw, 0, 'YXZ');
      // Phase-locked Third-Person anchor (zero XZ lag vs player rig so walking never shakes person or environment)
      _camTarget.set(
        this.playerPos.x + peekShiftX,
        this.smoothedGroundY + this.smoothedEyeOffset * 0.94,
        this.playerPos.z + peekShiftZ,
      );

      const desiredDist = THREE.MathUtils.lerp(4.1, 2.35, this.adsBlend);
      const shoulderOffset = THREE.MathUtils.lerp(0.72, 0.55, this.adsBlend);

      _v1.set(0, 0, 1).applyEuler(_euler);
      _v2.set(1, 0, 0).applyEuler(_euler);

      _camPos
        .copy(_camTarget)
        .addScaledVector(_v1, desiredDist)
        .addScaledVector(_v2, shoulderOffset);
      _v3.subVectors(_camPos, _camTarget);
      const rawArmLen = _v3.length();
      let safeArmLen = desiredDist;
      if (rawArmLen > 0.2) {
        _v3.divideScalar(rawArmLen);
        const wallT = this.raycastColliders(
          _camTarget.x,
          _camTarget.y,
          _camTarget.z,
          _v3.x,
          _v3.y,
          _v3.z,
          rawArmLen,
        );
        if (wallT < rawArmLen) {
          safeArmLen = Math.max(0.55, desiredDist * (wallT / rawArmLen) - 0.25);
        }
      }

      if (!this.thirdPersonCamInit) {
        this.smoothThirdCamArm = safeArmLen;
        this.thirdPersonCamInit = true;
      } else {
        this.smoothThirdCamArm = THREE.MathUtils.damp(this.smoothThirdCamArm, safeArmLen, 16, dt);
      }

      this.camera.position
        .copy(_camTarget)
        .addScaledVector(_v1, this.smoothThirdCamArm)
        .addScaledVector(_v2, shoulderOffset * (this.smoothThirdCamArm / Math.max(0.1, desiredDist)));
      const minCamY = (this.arena ? this.arena.groundHeightAt(this.camera.position.x, this.camera.position.z, this.playerPos.y) : 0) + 0.45;
      if (this.camera.position.y < minCamY) {
        this.camera.position.y = minCamY;
      }
      this.camera.quaternion.setFromEuler(_euler);

      if (this.playerThirdPersonRig) {
        const rig = this.playerThirdPersonRig;
        rig.root.visible = true;
        rig.root.position.set(this.playerPos.x + peekShiftX * 0.5, this.playerPos.y, this.playerPos.z + peekShiftZ * 0.5);
        rig.root.rotation.y = this.seatedSpot
          ? (this.seatedSpot.canRotateChair ? this.seatedYaw : this.seatedSpot.yaw)
          : effYaw;

        if (this.seatedSpot) {
          rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, 0, 14, dt);
          rig.bodyPivot.rotation.set(0, 0, 0);
          rig.pelvisGroup.position.y = THREE.MathUtils.damp(
            rig.pelvisGroup.position.y,
            (this.seatedSpot.y - floorY) - 0.52,
            18,
            dt,
          );
          rig.pelvisGroup.rotation.z = 0;
          rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, -0.08, 14, dt);
          rig.torso.rotation.z = 0;
          rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, 1.24, 16, dt);
          rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 1.24, 16, dt);
          rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, -1.28, 16, dt);
          rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, -1.28, 16, dt);
        } else if (this.swimState.isSwimming) {
          const strokeRate = wantsSprint ? 7.2 : 4.8;
          const phase = this.elapsedTime * strokeRate;
          rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, 0.72, 12, dt);
          rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, -1.18, 12, dt);
          rig.bodyPivot.rotation.z = THREE.MathUtils.damp(rig.bodyPivot.rotation.z, Math.sin(phase) * 0.14, 12, dt);
          rig.torso.rotation.set(0, Math.sin(phase) * 0.2, 0);
          rig.pelvisGroup.position.y = 0;
          rig.leftLeg.rotation.x = Math.sin(phase * 2.0) * 0.34;
          rig.rightLeg.rotation.x = -Math.sin(phase * 2.0) * 0.34;
          rig.leftKnee.rotation.x = -0.25 - Math.max(0, -Math.sin(phase * 2.0)) * 0.35;
          rig.rightKnee.rotation.x = -0.25 - Math.max(0, Math.sin(phase * 2.0)) * 0.35;
          rig.rightArm.rotation.set(-2.35 + Math.cos(phase) * 1.1, 0.15, -0.2);
          rig.leftArm.rotation.set(-2.35 - Math.cos(phase) * 1.1, -0.15, 0.2);
          rig.rightElbow.rotation.x = -0.4;
          rig.leftElbow.rotation.x = -0.4;
        } else {
          rig.bodyPivot.position.y = THREE.MathUtils.damp(rig.bodyPivot.position.y, 0, 14, dt);
          rig.bodyPivot.rotation.x = THREE.MathUtils.damp(rig.bodyPivot.rotation.x, 0, 14, dt);
          rig.bodyPivot.rotation.z = THREE.MathUtils.damp(rig.bodyPivot.rotation.z, 0, 14, dt);

        if (this.slideTimer > 0) {
          // Articulated Combat Slide Pose: low pelvis, torso leaned back, extended front leg, tucked rear leg, rifle aimed
          rig.pelvisGroup.position.y = THREE.MathUtils.damp(rig.pelvisGroup.position.y, -0.44, 16, dt);
          rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, 0.36, 14, dt);
          rig.torso.rotation.z = THREE.MathUtils.damp(rig.torso.rotation.z, 0.08, 14, dt);
          rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 1.32, 16, dt);
          rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, -0.14, 16, dt);
          rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, 0.45, 16, dt);
          rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, -1.65, 16, dt);
        } else {
          // Articulated GTA-style Stand / Walk / Crouch / Sprint / Jump / Cover stride
          const stride = this.walkBobPhase;
          const walkW = this.walkBobWeight;
          const crouchPelvis = -0.32 * this.crouchBlend;
          const strideBounce = this.isGrounded ? Math.abs(Math.sin(stride)) * 0.038 * walkW * (1 - this.crouchBlend * 0.5) : 0;
          const jumpPelvis = !this.isGrounded ? -0.1 : -this.landImpulse * 0.8 + strideBounce;
          rig.pelvisGroup.position.y = THREE.MathUtils.damp(
            rig.pelvisGroup.position.y,
            crouchPelvis + jumpPelvis,
            15,
            dt,
          );
          rig.pelvisGroup.rotation.z = THREE.MathUtils.damp(
            rig.pelvisGroup.rotation.z,
            Math.cos(stride) * 0.045 * walkW,
            12,
            dt,
          );
          const leanX =
            -this.sprintBlend * 0.22 -
            this.crouchBlend * 0.14 -
            0.05 * walkW +
            flinchProgress * 0.16;
          rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, leanX, 14, dt);
          rig.torso.rotation.z = THREE.MathUtils.damp(
            rig.torso.rotation.z,
            this.peekBlend * -0.22 - Math.cos(stride) * 0.032 * walkW,
            14,
            dt,
          );

          if (!this.isGrounded) {
            rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, 0.42, 12, dt);
            rig.leftKnee.rotation.x = THREE.MathUtils.damp(rig.leftKnee.rotation.x, -0.85, 12, dt);
            rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, -0.22, 12, dt);
            rig.rightKnee.rotation.x = THREE.MathUtils.damp(rig.rightKnee.rotation.x, -0.55, 12, dt);
          } else {
            const swingAmp = this.sprintBlend > 0.4 ? 0.78 : wantsCrouch ? 0.38 : 0.58;
            const kneeAmp = this.sprintBlend > 0.4 ? 0.92 : wantsCrouch ? 0.45 : 0.68;
            const swing = Math.sin(stride) * swingAmp * walkW;
            const crouchHip = 0.72 * this.crouchBlend;
            const crouchKnee = -1.32 * this.crouchBlend;
            rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, crouchHip + swing, 16, dt);
            rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, crouchHip - swing, 16, dt);
            rig.leftKnee.rotation.x = THREE.MathUtils.damp(
              rig.leftKnee.rotation.x,
              crouchKnee - Math.max(0, Math.sin(stride + 0.55)) * kneeAmp * walkW,
              16,
              dt,
            );
            rig.rightKnee.rotation.x = THREE.MathUtils.damp(
              rig.rightKnee.rotation.x,
              crouchKnee - Math.max(0, -Math.sin(stride + 0.55)) * kneeAmp * walkW,
              16,
              dt,
            );
          }
        }

        if (this.doorCloseAnimTimer > 0) {
          if (horizSpeed > 1.8 || this.touchFiring || !this.isGrounded || this.grenadeAnimTimer > 0) {
            this.doorCloseAnimTimer = 0;
          } else {
            this.doorCloseAnimTimer = Math.max(0, this.doorCloseAnimTimer - dt);
          }
        }
        // Articulated Upper Body: Aiming, Vehicle Door Close, Cross-Chest Sprint Carry, Reload Reach, Grenade Throw
        if (this.swimState.isSwimming) {
          // Arm strokes already driven in swimming pose above
        } else if (this.doorCloseAnimTimer > 0) {
          const dp = 1 - this.doorCloseAnimTimer / 0.44;
          const reachCurve = Math.sin(dp * Math.PI);
          rig.torso.rotation.y = THREE.MathUtils.damp(rig.torso.rotation.y, 0.48 * reachCurve, 18, dt);
          rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, 1.05 * reachCurve, 18, dt);
          rig.rightArm.rotation.y = THREE.MathUtils.damp(rig.rightArm.rotation.y, 0.45 * reachCurve, 18, dt);
          rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, 0.35 * reachCurve, 18, dt);
          rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, 0.25, 14, dt);
        } else if (this.grenadeAnimTimer > 0) {
          const throwArmX = grenadePhase < 0.42 ? 1.15 : THREE.MathUtils.lerp(1.15, -0.35, (grenadePhase - 0.42) / 0.58);
          rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, throwArmX, 18, dt);
          rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, grenadePhase < 0.42 ? 0.55 : -0.25, 18, dt);
          rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, 0.35, 14, dt);
        } else if (this.activeWeapon === 'unarmed') {
          const unarmedSwing = Math.sin(this.walkBobPhase) * (this.sprintBlend > 0.4 ? 0.72 : 0.45) * this.walkBobWeight;
          rig.torso.rotation.y = THREE.MathUtils.damp(rig.torso.rotation.y, 0, 12, dt);
          rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, -0.12 - unarmedSwing, 14, dt);
          rig.rightArm.rotation.y = THREE.MathUtils.damp(rig.rightArm.rotation.y, 0.04, 12, dt);
          rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, 0.18 + Math.max(0, -unarmedSwing) * 0.25, 14, dt);
          rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, -0.12 + unarmedSwing, 14, dt);
          rig.leftArm.rotation.y = THREE.MathUtils.damp(rig.leftArm.rotation.y, -0.04, 12, dt);
        } else if (this.sprintBlend > 0.35 && !isAds && this.slideTimer <= 0) {
          // Gentle, steady sprint carry (eliminates jerky cross-chest snap)
          rig.torso.rotation.y = THREE.MathUtils.damp(rig.torso.rotation.y, 0, 12, dt);
          rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, 0.22, 12, dt);
          rig.rightArm.rotation.y = THREE.MathUtils.damp(rig.rightArm.rotation.y, 0.22, 12, dt);
          rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, 0.14, 12, dt);
          rig.leftArm.rotation.x = THREE.MathUtils.damp(rig.leftArm.rotation.x, 0.28, 12, dt);
          rig.leftArm.rotation.y = THREE.MathUtils.damp(rig.leftArm.rotation.y, -0.24, 12, dt);
        } else {
          rig.torso.rotation.y = THREE.MathUtils.damp(rig.torso.rotation.y, 0, 12, dt);
          const aimFactor = effPitch + this.recoilPitchOffset * 0.7;
          const reloadTilt = this.isReloading ? -0.35 : 0;
          rig.rightArm.rotation.x = THREE.MathUtils.damp(rig.rightArm.rotation.x, 0.28 + aimFactor * 0.7 + reloadTilt, 16, dt);
          rig.rightArm.rotation.y = THREE.MathUtils.damp(rig.rightArm.rotation.y, 0.08 * this.adsBlend, 14, dt);
          rig.rightElbow.rotation.x = THREE.MathUtils.damp(rig.rightElbow.rotation.x, -0.15 + aimFactor * 0.35, 16, dt);
          rig.leftArm.rotation.x = THREE.MathUtils.damp(
            rig.leftArm.rotation.x,
            0.35 + aimFactor * 0.65 - (this.isReloading && reloadProgress < 0.6 ? 0.5 : 0),
            16,
            dt,
          );
          rig.leftArm.rotation.y = THREE.MathUtils.damp(rig.leftArm.rotation.y, -0.22, 14, dt);
        }
        }
      }
    }
    }
    }

    // Supply Crates (with properly edited Refill Sound + RPG rockets!)
    if (this.arena) {
      for (let i = 0; i < this.arena.supplyCrates.length; i++) {
        const crate = this.arena.supplyCrates[i];
        if (!crate.active) {
          crate.respawnTimer -= dt;
          if (crate.respawnTimer <= 0) {
            crate.active = true;
            crate.beacon.visible = true;
          }
          continue;
        }
        crate.beacon.rotation.y += dt * 2.2;
        crate.beacon.position.y = 1.48 + Math.sin(this.elapsedTime * 3.2 + crate.id) * 0.14;

        const dCrate = this.playerPos.distanceTo(crate.position);
        if (dCrate < 2.25) {
          crate.active = false;
          crate.beacon.visible = false;
          crate.respawnTimer = 22;

          this.health = Math.min(this.maxHealth, this.health + 25);
          this.armor = Math.min(this.maxArmor, this.armor + 40);
          this.grenades = Math.min(5, this.grenades + 1);
          WEAPON_ORDER.forEach((wid) => {
            const wSpec = WEAPONS[wid];
            if (wSpec.magSize <= 0) return;
            const gain = wid === 'rocket' ? 2 : Math.max(10, Math.round(wSpec.magSize * 1.5));
            this.reserveAmmo[wid] = Math.min(wSpec.maxReserve, this.reserveAmmo[wid] + gain);
          });
          this.score += 50;
          soundEngine.playRefill();
          this.emitHud();
        }
      }
    }

    // Track Simulator World district discovery & credit rewards
    const curDistrict = getMegaWorldDistrictAt(this.playerPos.x, this.playerPos.z);
    if (curDistrict !== this.simLastDistrict) {
      this.simLastDistrict = curDistrict;
      if (!this.simVisitedDistricts.has(curDistrict)) {
        this.simVisitedDistricts.add(curDistrict);
        if (this.elapsedTime > 1.5) {
          this.simCredits += 100;
          this.interactFeedback = `Discovered ${curDistrict} (+100₡)`;
          this.interactFeedbackTimer = 3.0;
        }
      }
    }

    this.stepBarrelsAndVehicleHits(dt);
    if (this.arena?.wildlifeProps) {
      const wlRes = this.arena.wildlifeProps.step(
        dt,
        this.elapsedTime,
        this.arena.groundHeightAt,
        this.playerPos,
        this.vehicleManager.vehicles,
      );
      if (wlRes.ballBouncedNearPlayer) {
        soundEngine.playBallBounce(2);
      }
    }
    this.updateProjectilesAndVfx(dt);

    // Threats decay
    for (let i = this.activeThreats.length - 1; i >= 0; i--) {
      this.activeThreats[i].life -= dt;
      if (this.activeThreats[i].life <= 0) {
        this.activeThreats.splice(i, 1);
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= dt;
      if (this.hitMarkerTimer <= 0) this.hitMarker = 'none';
    }
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);

    this.hudSyncTimer += dt;
    const hudSyncInterval =
      this.hudSettings.graphicsQuality === 'low'
        ? 0.22
        : this.hudSettings.graphicsQuality === 'medium'
          ? 0.16
          : 0.1;
    if (this.hudSyncTimer >= hudSyncInterval) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private updateProjectilesAndVfx(dt: number) {
    // Decay blast illumination light smoothly
    if (this.explosionLight.intensity > 0.05) {
      this.explosionLight.intensity = THREE.MathUtils.damp(this.explosionLight.intensity, 0, 9, dt);
    } else {
      this.explosionLight.intensity = 0;
    }

    // Active RPG Rockets in flight (swept collision + trail + strike detonation)
    if (this.rockets.length > 0) {
      const vehicleTargets = this.vehicleManager.shootableMeshes;
      const simTargets = this.arena?.npcManager?.getShootableMeshes() ?? [];
      const screenTargets = this.arena?.shootableScreens ?? [];

      for (let i = this.rockets.length - 1; i >= 0; i--) {
        const r = this.rockets[i];
        r.life -= dt;
        _prevPos.copy(r.position);
        r.velocity.y -= 3.2 * dt;
        r.position.addScaledVector(r.velocity, dt);

        r.group.position.copy(r.position);
        _v4.copy(r.position).add(r.velocity);
        r.group.lookAt(_v4);
        r.group.rotateZ(this.elapsedTime * 14);
        r.flameMesh.scale.set(
          0.85 + Math.random() * 0.35,
          0.85 + Math.random() * 0.45,
          0.85 + Math.random() * 0.35,
        );

        // Exhaust smoke & fiery ember trail
        r.smokeAccum += dt;
        if (r.smokeAccum >= 0.022) {
          r.smokeAccum = 0;
          this.spawnMuzzleSmoke(r.position, 0.9);
          this.spawnImpactSparks(r.position, 0xff9f1c, 1, 0.55);
        }

        // Swept analytical raycast for zero tunneling against arena, screens, vehicles & players/enemies
        _v2.subVectors(r.position, _prevPos);
        const stepDist = _v2.length();
        let impacted = false;

        if (stepDist > 0.001) {
          _v2.divideScalar(stepDist);
          _raycaster.set(_prevPos, _v2);
          _raycaster.far = stepDist + 0.35;

          const envRes = this.raycastEnvironment(
            _prevPos.x,
            _prevPos.y,
            _prevPos.z,
            _v2.x,
            _v2.y,
            _v2.z,
            stepDist + 0.35,
            _v3,
          );
          const vehicleHits = vehicleTargets.length > 0 ? _raycaster.intersectObjects(vehicleTargets, false) : [];
          const simHits = simTargets.length > 0 ? _raycaster.intersectObjects(simTargets, false) : [];
          const screenHits = screenTargets.length > 0 ? _raycaster.intersectObjects(screenTargets, false) : [];

          const envDist = envRes.dist;
          const hitEnv = envDist <= stepDist + 0.35;
          const hitVehicle = vehicleHits.length > 0 ? vehicleHits[0] : null;
          const hitSim = simHits.length > 0 ? simHits[0] : null;
          const hitScreen = screenHits.length > 0 ? screenHits[0] : null;

          const vehDist = hitVehicle ? hitVehicle.distance : Infinity;
          const simDist = hitSim ? hitSim.distance : Infinity;
          const scrDist = hitScreen ? hitScreen.distance : Infinity;
          const minActorDist = Math.min(vehDist, simDist, scrDist);

          if (minActorDist < Infinity && (!hitEnv || minActorDist <= envDist)) {
            impacted = true;
            if (vehDist === minActorDist && hitVehicle) {
              _v4.copy(hitVehicle.point);
              this.damageVehicleAtMesh(hitVehicle.object, 9999, true);
            } else if (scrDist === minActorDist && hitScreen) {
              _v4.copy(hitScreen.point);
            } else if (simDist === minActorDist && hitSim) {
              _v4.copy(hitSim.point);
            }
          } else if (hitEnv) {
            impacted = true;
            _v4.copy(_v3);
          }
        }

        const floorY = this.arena ? this.arena.groundHeightAt(r.position.x, r.position.z) : 0;
        if (!impacted && (r.position.y <= floorY + 0.1 || r.life <= 0)) {
          impacted = true;
          _v4.copy(r.position);
          _v4.y = Math.max(_v4.y, floorY + 0.12);
        }

        if (impacted) {
          this.scene.remove(r.group);
          this.rockets.splice(i, 1);
          this.detonateExplosion(_v4, 10.5, WEAPONS.rocket.damage, true);
        }
      }
    }

    // Screen hit chroma-key electric sparks (pooled)
    let anySparkActive = false;
    const sparkVidReady = !this.electricSparkVideoFailed && Boolean(this.electricSparkVideo && this.electricSparkVideo.readyState >= 2);
    for (let i = 0; i < this.electricSparks.length; i++) {
      const es = this.electricSparks[i];
      if (!es.active) continue;
      anySparkActive = true;
      es.life -= dt;
      const frac = Math.max(0, es.life / es.maxLife);
      es.mat.uniforms.uFallback.value = sparkVidReady ? 0.0 : 1.0;
      es.mat.uniforms.uTime.value = this.elapsedTime;
      es.mat.uniforms.uOpacity.value = Math.min(1, frac * 1.55);
      if (es.life <= 0) {
        es.active = false;
        es.mesh.visible = false;
      }
    }
    if (anySparkActive && sparkVidReady && this.electricSparkTex) {
      this.electricSparkTex.needsUpdate = true;
    }

    // Tracers (pre-allocated pool, zero GC)
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (!t.active) continue;
      t.life -= dt;
      t.mesh.position.addScaledVector(t.velocity, dt);
      const fade = Math.max(0.05, t.life / t.maxLife);
      t.mesh.scale.z = fade;
      if (t.life <= 0) {
        t.active = false;
        t.mesh.visible = false;
      }
    }

    // Muzzle & rocket smoke puffs (pre-allocated pool, zero GC)
    for (let i = 0; i < this.smokePuffs.length; i++) {
      const sp = this.smokePuffs[i];
      if (!sp.active) continue;
      sp.life -= dt;
      const progress = 1 - Math.max(0, sp.life / sp.maxLife);
      sp.mesh.position.addScaledVector(sp.velocity, dt);
      sp.velocity.multiplyScalar(Math.exp(-2.8 * dt));
      const scaleFade = progress < 0.72 ? 1.0 : Math.max(0.05, 1 - (progress - 0.72) / 0.28);
      sp.mesh.scale.setScalar(THREE.MathUtils.lerp(sp.startScale, sp.endScale, progress) * scaleFade);
      if (sp.life <= 0) {
        sp.active = false;
        sp.mesh.visible = false;
      }
    }

    // Dropping magazines & Shell casings (pre-allocated pools)
    for (let i = 0; i < this.droppingMags.length; i++) {
      const m = this.droppingMags[i];
      if (!m.active) continue;
      m.life -= dt;
      m.velocity.y -= 15 * dt;
      m.mesh.position.addScaledVector(m.velocity, dt);
      m.mesh.rotation.x += m.rotVel.x * dt;
      m.mesh.rotation.y += m.rotVel.y * dt;
      m.mesh.rotation.z += m.rotVel.z * dt;
      const ground = this.arena ? this.arena.groundHeightAt(m.mesh.position.x, m.mesh.position.z) : 0;
      if (m.mesh.position.y < ground + 0.04) {
        m.mesh.position.y = ground + 0.04;
        m.velocity.y = Math.abs(m.velocity.y) * 0.28;
        m.velocity.x *= 0.45;
        m.velocity.z *= 0.45;
        m.rotVel.multiplyScalar(0.4);
      }
      if (m.life <= 0) {
        m.active = false;
        m.mesh.visible = false;
      }
    }

    for (let i = 0; i < this.shells.length; i++) {
      const s = this.shells[i];
      if (!s.active) continue;
      s.life -= dt;
      s.velocity.y -= 16 * dt;
      s.mesh.position.addScaledVector(s.velocity, dt);
      s.mesh.rotation.x += s.rotVel.x * dt;
      s.mesh.rotation.y += s.rotVel.y * dt;
      s.mesh.rotation.z += s.rotVel.z * dt;

      const ground = this.arena ? this.arena.groundHeightAt(s.mesh.position.x, s.mesh.position.z) : 0;
      if (s.mesh.position.y < ground + 0.02) {
        s.mesh.position.y = ground + 0.02;
        s.velocity.y = Math.abs(s.velocity.y) * 0.42;
        s.velocity.x *= 0.6;
        s.velocity.z *= 0.6;
      }

      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
      }
    }

    // Impact sparks (pre-allocated pool, zero GC)
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      p.velocity.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.scale.setScalar(p.baseScale * Math.max(0.1, p.life / p.maxLife));
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    // Expanding ground blood pools
    for (let i = this.bloodPools.length - 1; i >= 0; i--) {
      const bp = this.bloodPools[i];
      if (bp.age < 1.4) {
        bp.age = Math.min(1.4, bp.age + dt);
        const t = bp.age / 1.4;
        const r = THREE.MathUtils.lerp(bp.startRadius, bp.maxRadius, 1 - (1 - t) * (1 - t));
        bp.mesh.scale.setScalar(r);
      }
    }

    // Shattered glass shards (pre-allocated pool)
    for (let i = 0; i < this.glassShards.length; i++) {
      const gs = this.glassShards[i];
      if (!gs.active) continue;
      gs.life -= dt;
      gs.vel.y -= 14 * dt;
      gs.mesh.position.addScaledVector(gs.vel, dt);
      gs.mesh.rotation.x += gs.rotVel.x * dt;
      gs.mesh.rotation.y += gs.rotVel.y * dt;
      gs.mesh.rotation.z += gs.rotVel.z * dt;
      const ground = this.arena ? this.arena.groundHeightAt(gs.mesh.position.x, gs.mesh.position.z) : 0;
      if (gs.mesh.position.y < ground + 0.02) {
        gs.mesh.position.y = ground + 0.02;
        gs.vel.multiplyScalar(0.35);
        gs.vel.y = 0;
      }
      if (gs.life <= 0) {
        gs.active = false;
        gs.mesh.visible = false;
      }
    }

    // Punctured tire pressurized air puffs (pre-allocated pool)
    for (let i = 0; i < this.tirePuffs.length; i++) {
      const tp = this.tirePuffs[i];
      if (!tp.active) continue;
      tp.life -= dt;
      tp.mesh.position.addScaledVector(tp.vel, dt);
      tp.vel.multiplyScalar(Math.exp(-3.2 * dt));
      const p = 1 - Math.max(0, tp.life / tp.maxLife);
      tp.mesh.scale.setScalar(0.5 + p * 2.2);
      if (tp.life <= 0) {
        tp.active = false;
        tp.mesh.visible = false;
      }
    }

    // Explosion fireball & inner flashes (pre-allocated pool)
    for (let i = 0; i < this.explosions.length; i++) {
      const ex = this.explosions[i];
      if (!ex.active) continue;
      ex.life -= dt;
      const progress = 1 - Math.max(0, ex.life / ex.maxLife);
      ex.mesh.scale.setScalar(THREE.MathUtils.lerp(ex.startScale, ex.maxScale, progress));
      ex.mat.opacity = (1 - progress) * ex.startOpacity;
      if (ex.life <= 0) {
        ex.active = false;
        ex.mesh.visible = false;
      }
    }

    // Expanding blast shockwave rings (pre-allocated pool)
    for (let i = 0; i < this.shockRings.length; i++) {
      const sr = this.shockRings[i];
      if (!sr.active) continue;
      sr.life -= dt;
      const progress = 1 - Math.max(0, sr.life / sr.maxLife);
      const eased = 1 - Math.pow(1 - progress, 2.2);
      sr.mesh.scale.setScalar(THREE.MathUtils.lerp(0.35, sr.maxScale, eased));
      sr.mat.opacity = (1 - progress) * 0.85;
      if (sr.life <= 0) {
        sr.active = false;
        sr.mesh.visible = false;
      }
    }

    // Water splash droplets (pre-allocated pool)
    for (let i = 0; i < this.waterSplashes.length; i++) {
      const ws = this.waterSplashes[i];
      if (!ws.active) continue;
      ws.life -= dt;
      ws.velocity.y -= 13.5 * dt;
      ws.mesh.position.addScaledVector(ws.velocity, dt);
      const frac = Math.max(0.15, ws.life / ws.maxLife);
      ws.mesh.scale.setScalar(ws.baseScale * frac);
      if (ws.life <= 0) {
        ws.active = false;
        ws.mesh.visible = false;
      }
    }

    // Water surface ripples (pre-allocated pool)
    for (let i = 0; i < this.waterRipples.length; i++) {
      const wr = this.waterRipples[i];
      if (!wr.active) continue;
      wr.life -= dt;
      const p = 1 - Math.max(0, wr.life / wr.maxLife);
      wr.mesh.scale.setScalar(THREE.MathUtils.lerp(0.18, wr.maxScale, 1 - (1 - p) * (1 - p)));
      wr.mat.opacity = (1 - p) * 0.72;
      if (wr.life <= 0) {
        wr.active = false;
        wr.mesh.visible = false;
      }
    }

    // Sand puffs (pre-allocated pool)
    for (let i = 0; i < this.sandPuffs.length; i++) {
      const sp = this.sandPuffs[i];
      if (!sp.active) continue;
      sp.life -= dt;
      const p = 1 - Math.max(0, sp.life / sp.maxLife);
      sp.velocity.y -= 3.5 * dt;
      sp.mesh.position.addScaledVector(sp.velocity, dt);
      sp.velocity.x *= Math.exp(-3.0 * dt);
      sp.velocity.z *= Math.exp(-3.0 * dt);
      sp.mesh.scale.setScalar(THREE.MathUtils.lerp(sp.startScale, sp.endScale, p));
      sp.mat.opacity = (1 - p) * 0.56;
      if (sp.life <= 0) {
        sp.active = false;
        sp.mesh.visible = false;
      }
    }

    // Thrown Frag Grenades (water splash/buoyant drag + sand soft thud + gasoline audio blast)
    for (let i = this.thrownGrenades.length - 1; i >= 0; i--) {
      const g = this.thrownGrenades[i];
      g.fuse -= dt;
      g.velocity.y -= 20 * dt;

      const waterY = this.getWaterLevelAt(g.position.x, g.position.z);
      if (waterY !== null && g.position.y <= waterY + 0.08) {
        if (!g.inWater) {
          g.inWater = true;
          this.spawnWaterSplash(_waterSplashPt.set(g.position.x, waterY, g.position.z), 1.45, true);
          soundEngine.playWaterSplash(1.45, g.position.distanceTo(this.playerPos));
          g.velocity.multiplyScalar(0.32);
        }
        g.velocity.y += 14.5 * dt;
        g.velocity.x *= Math.exp(-4.5 * dt);
        g.velocity.z *= Math.exp(-4.5 * dt);
      }

      g.position.addScaledVector(g.velocity, dt);

      const ground = this.arena ? this.arena.groundHeightAt(g.position.x, g.position.z, g.position.y) : 0;
      if (g.position.y <= ground + 0.12) {
        g.position.y = ground + 0.12;
        if (g.inWater) {
          g.velocity.y = 0;
          g.velocity.x *= 0.4;
          g.velocity.z *= 0.4;
        } else if (this.isSandZoneAt(g.position.x, g.position.z, ground)) {
          if (Math.abs(g.velocity.y) > 1.5) {
            soundEngine.playSandImpact(g.position.distanceTo(this.playerPos));
            this.spawnSandPuff(g.position, _waterSplashNorm, 1.15);
          }
          g.velocity.y = Math.abs(g.velocity.y) * 0.14;
          g.velocity.x *= 0.36;
          g.velocity.z *= 0.36;
        } else {
          if (Math.abs(g.velocity.y) > 1.8) soundEngine.playGrenadeBounce();
          g.velocity.y = Math.abs(g.velocity.y) * 0.45;
          g.velocity.x *= 0.65;
          g.velocity.z *= 0.65;
        }
      }
      g.mesh.position.copy(g.position);
      g.mesh.rotation.x += (g.inWater ? 2.5 : 9) * dt;
      g.mesh.rotation.z += (g.inWater ? 2.0 : 7) * dt;

      if (g.fuse <= 0) {
        this.detonateExplosion(g.position, 8.5, 165, false, true, false, false, false, Boolean(g.inWater));
        this.scene.remove(g.mesh);
        this.thrownGrenades.splice(i, 1);
      }
    }

  }

  private emitHud() {
    const spec = WEAPONS[this.activeWeapon];
    const moveSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const moveRatio = Math.min(1.35, moveSpeed / 8.8);
    const crouchMul = this.crouchBlend > 0.5 ? 0.72 : 1.0;
    const sprintMul = this.currentlySprinting && moveSpeed > 7.0 ? 1.48 : 1.0;
    const airMul = !this.isGrounded ? 1.65 : 1.0;
    const baseSpread = this.isCurrentlyAds() ? spec.adsSpread : spec.hipSpread;
    const spreadAmount =
      (baseSpread + moveRatio * 0.016) * crouchMul * sprintMul * airMul +
      this.crosshairBloom +
      this.recoilPitchOffset * 0.35;

    // Camera yaw = 0 faces -Z (North = 0 deg). Turning right (negative yaw) increases bearing clockwise.
    const headingDeg = ((-this.yaw * 180) / Math.PI % 360 + 360) % 360;
    const threats: CompassThreat[] = this.activeThreats.map((t) => ({
      id: t.id,
      angleDeg: t.angleDeg,
      intensity: Math.min(1, t.life / 1.6),
    }));

    const radarBlips: RadarBlip[] = [];
    const detectedState: DetectionState =
      this.wantedState.level > 0 && !this.wantedState.isEvading ? 'spotted' : 'hidden';

    if (this.arena) {
      const px = this.playerPos.x;
      const pz = this.playerPos.z;
      const maxRadarBlipDistSq = 220 * 220;
      for (let i = 0; i < this.arena.supplyCrates.length; i++) {
        const c = this.arena.supplyCrates[i];
        if (c.active) {
          const dx = c.position.x - px;
          const dz = c.position.z - pz;
          if (dx * dx + dz * dz <= maxRadarBlipDistSq) {
            radarBlips.push({ x: c.position.x, z: c.position.z, kind: 'crate' });
          }
        }
      }
      for (let i = 0; i < this.arena.barrels.length; i++) {
        const b = this.arena.barrels[i];
        if (!b.exploded) {
          const dx = b.position.x - px;
          const dz = b.position.z - pz;
          if (dx * dx + dz * dz <= maxRadarBlipDistSq) {
            radarBlips.push({ x: b.position.x, z: b.position.z, kind: 'barrel' });
          }
        }
      }
    }

    const rMoveDx = this.playerPos.x - this.lastRadarFilterX;
    const rMoveDz = this.playerPos.z - this.lastRadarFilterZ;
    if (rMoveDx * rMoveDx + rMoveDz * rMoveDz > 12 * 12) {
      this.lastRadarFilterX = this.playerPos.x;
      this.lastRadarFilterZ = this.playerPos.z;
      const nearby: Array<{ cx: number; cz: number; w: number; d: number }> = [];
      for (let i = 0; i < this.radarObstacles.length; i++) {
        const ob = this.radarObstacles[i];
        if (Math.abs(ob.cx - this.lastRadarFilterX) <= 145 && Math.abs(ob.cz - this.lastRadarFilterZ) <= 145) {
          nearby.push(ob);
        }
      }
      this.cachedNearbyRadarObstacles = nearby;
    }

    const recoveryCountdown =
      this.health < this.maxHealth && this.timeSinceDamage < 5.0
        ? Math.ceil(5.0 - this.timeSinceDamage)
        : 0;

    // Fast analytical rangefinder distance from camera center for optical Scope UIs
    this.camera.getWorldDirection(_v2);
    let rangeDist = this.raycastColliders(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
      _v2.x,
      _v2.y,
      _v2.z,
      spec.range,
    );
    this.aimDistance = rangeDist <= spec.range ? Math.round(rangeDist) : 0;

    const zoomOpts = WEAPON_ZOOM_OPTIONS[this.activeWeapon];
    const activeZoom = zoomOpts[this.weaponZoomIndices[this.activeWeapon] % zoomOpts.length];

    const activePois = getMapPois(this.mapId);
    for (let i = 0; i < activePois.length; i++) {
      const poi = activePois[i];
      radarBlips.push({ x: poi.x, z: poi.z, kind: 'poi', label: poi.name });
    }
    if (this.customDropTarget) {
      radarBlips.push({
        x: this.customDropTarget.x,
        z: this.customDropTarget.z,
        kind: 'drop',
        label: this.customDropTarget.label,
      });
    }
    for (let i = 0; i < this.vehicleManager.vehicles.length; i++) {
      const v = this.vehicleManager.vehicles[i];
      if (!v.destroyed && v.id !== this.activeVehicleId) {
        radarBlips.push({ x: v.position.x, z: v.position.z, kind: 'vehicle' });
      }
    }

    const activeVehicle = this.activeVehicleId
      ? this.vehicleManager.getById(this.activeVehicleId)
      : null;
    const groundFn = this.arena ? this.arena.groundHeightAt : () => 0;
    const vehicleHud = this.vehicleManager.buildHudState(
      activeVehicle,
      this.playerPos,
      groundFn,
      this.vehicleCameraMode,
      this.mansionBlockedReason,
    );
    vehicleHud.isBikeEjected = this.bikeEjectTimer > 0;
    if (!activeVehicle && !vehicleHud.nearbyVehicleId && this.arena?.npcManager) {
      const hijack = this.arena.npcManager.findNearestHijackableRoadAgent(this.playerPos, 5.8);
      if (hijack) {
        vehicleHud.nearbyHijackVehicle = {
          agentId: hijack.agentId,
          name: hijack.name,
          isBike: hijack.isBike,
        };
      }
    }
    const radarWorldRange = 120;

    this.callbacks.onHudUpdate({
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      isRecoveringHealth: this.isRecoveringHealth,
      recoveryCountdown,
      armor: Math.ceil(this.armor),
      maxArmor: this.maxArmor,
      stamina: Math.round(this.stamina),
      grenades: this.grenades,
      score: this.score,
      highScore: Math.max(this.score, this.highScore),
      kills: this.kills,
      targetKills: 0,
      victoryCelebration: false,
      headshots: this.headshots,
      wave: 1,
      enemiesRemaining: 0,
      streak: this.streak,
      bestStreak: this.bestStreak,
      combo: Math.floor(this.combo),
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      activeWeapon: this.activeWeapon,
      activeFireMode: this.fireModes[this.activeWeapon],
      supportedFireModes: spec.supportedFireModes,
      ammoInMag: { ...this.ammoInMag },
      reserveAmmo: { ...this.reserveAmmo },
      isReloading: this.isReloading,
      reloadProgress: this.isReloading
        ? 1 - Math.max(0, this.reloadTimer / this.reloadDuration)
        : 0,
      reloadStage: this.reloadStage,
      isAds: this.isCurrentlyAds(),
      sniperZoomIndex: this.sniperZoomIndex,
      sniperZoomLabel: SNIPER_ZOOM_OPTIONS[this.sniperZoomIndex].label,
      activeZoomLabel: activeZoom ? activeZoom.label : '1x',
      canCycleZoom: zoomOpts.length > 1,
      aimDistance: this.aimDistance,
      fps: this.currentFps,
      isSprinting: this.currentlySprinting && moveSpeed > 7.0,
      runModeEnabled: this.runModeEnabled,
      isCrouching: this.crouchBlend > 0.5,
      isSliding: this.slideTimer > 0,
      isInCover: this.isInCover,
      coverPeekDir: this.peekDir,
      nearDoorway: this.nearDoorway !== null,
      isBreaching: this.breachTimer > 0,
      isThrowingGrenade: this.grenadeAnimTimer > 0,
      animState: this.animState,
      perspective: this.perspective,
      spreadAmount,
      hitMarker: this.hitMarker,
      headshotSeq: this.headshotSeq,
      lastHeadshotAt: this.lastHeadshotAt,
      damageFlash: this.damageFlash,
      detectedState,
      killFeed: [...this.killFeed],
      headingDeg,
      threats,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      radarBlips,
      radarObstacles: this.cachedNearbyRadarObstacles,
      radarWorldRange,
      elapsedTime: this.elapsedTime,
      vehicle: vehicleHud,
      worldSystem: this.worldSystem,
      timePhase: this.envSnapshot.phase,
      clockLabel: this.envSnapshot.clockLabel,
      weather: this.envCycle.weather,
      autoEnvCycle: this.envCycle.autoCycle,
      bikeStyle: this.bikeStyle,
      nearbyInteractable: this.nearInteractable
        ? {
            id: this.nearInteractable.id,
            label: this.nearInteractable.getLabel(),
            category: this.nearInteractable.category,
          }
        : null,
      interactFeedback: this.interactFeedback,
      districtName: getMegaWorldDistrictAt(this.playerPos.x, this.playerPos.z),
      simNpcCount: this.arena?.npcManager?.getTotalCitizenAndVehicleCount() ?? 0,
      simCredits: this.simCredits,
      simPurchasedItems: { ...this.simPurchasedItems },
      simStuntsCompleted: this.simStuntsCompleted,
      simRacesCompleted: this.simRacesCompleted,
      simBestLapSec: this.raceBestLapSec > 0 ? Math.round(this.raceBestLapSec * 10) / 10 : null,
      simVisitedCount: this.simVisitedDistricts.size,
      wantedLevel: this.wantedState.level,
      wantedEvading: this.wantedState.isEvading,
      wantedPoliceKills: this.wantedState.policeKills,
      isBikeEjected: this.bikeEjectTimer > 0,
      seatedChair: this.seatedSpot
        ? {
            label: this.seatedSpot.label,
            kind: this.seatedSpot.canRotateChair ? 'gaming_chair' : 'sofa',
            canRotate: this.seatedSpot.canRotateChair,
          }
        : null,
      smartCity: (() => {
        const scCtrl = this.arena?.smartCity;
        const sc = scCtrl?.getState();
        if (!scCtrl || !sc) return undefined;
        let aimTarget: SmartCityAimTargetInfo | null = null;
        if (
          this.phase === 'playing' &&
          this.health > 0 &&
          Math.hypot(this.playerPos.x - SMART_CITY_DOME.centerX, this.playerPos.z - SMART_CITY_DOME.centerZ) <= 175
        ) {
          if (this.smartCityAimTick++ % 2 === 0) {
            const targets = scCtrl.getShootableMeshes();
            if (targets.length > 0) {
              _raycaster.setFromCamera(_zeroNdc, this.camera);
              _raycaster.far = 140;
              const hits = _raycaster.intersectObjects(targets, false);
              if (hits.length > 0 && (this.aimDistance <= 0 || hits[0].distance <= this.aimDistance + 0.35)) {
                this.lastSmartCityAimTarget = scCtrl.getAimTargetInfo(hits[0].object);
              } else {
                this.lastSmartCityAimTarget = null;
              }
            } else {
              this.lastSmartCityAimTarget = null;
            }
          }
          aimTarget = this.lastSmartCityAimTarget;
        } else {
          this.lastSmartCityAimTarget = null;
        }
        return {
          telemetry: { ...sc.telemetry },
          irrigationMode: sc.irrigationMode,
          droneFleetMode: sc.droneFleetMode,
          robotWorkMode: sc.robotWorkMode,
          factoryActive: sc.factoryActive,
          securityAlert: sc.securityAlert,
          researchBoost: sc.researchBoost,
          charts: getSmartCityDynamicChartsData(sc),
          robotStages: sc.robots.map((r) => r.damage.stage),
          droneStages: sc.drones.map((d) => d.damage.stage),
          aimTarget,
        };
      })(),
      scienceDistrict: (() => {
        const sdCtrl = this.arena?.scienceDistrict;
        if (!sdCtrl) return undefined;
        const st = sdCtrl.getState();
        const near = detectNearestScienceInteraction(this.playerPos.x, this.playerPos.z);
        return {
          nearbyKind: near?.kind ?? null,
          nearbyLabel: near?.label ?? null,
          nearbyDomeId: near?.dome?.id ?? null,
          activeBuilding: st.activeBuilding,
          activeLabDept: st.activeLabDept,
          activeMuseumHall: st.activeMuseumHall,
          labRobotsActive: st.labRobotsActive,
          labEnergyOverdrive: st.labEnergyOverdrive,
          boostedDomes: { ...st.boostedDomes },
          elevatorFloor: st.elevatorFloor.labWest,
        };
      })(),
    });
  }

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.applyGraphicsQuality();
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private onContextRestored = () => {
    this.callbacks.onContextLost(false);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    this.keysHeld.add(e.code);
    if (this.phase !== 'playing') return;
    if (!e.repeat) {
      if (e.code === 'KeyG' && (this.seatedSpot || this.nearInteractable)) {
        this.triggerInteract();
      } else if (e.code === 'KeyE' || e.code === 'KeyF') {
        if (this.seatedSpot) {
          this.triggerInteract();
          return;
        }
        const nearVeh = this.vehicleManager.findNearestAvailable(this.playerPos, 5.8);
        const nearHijack =
          this.arena?.npcManager?.findNearestHijackableRoadAgent(this.playerPos, 5.8) ?? null;
        if (!this.activeVehicleId && this.nearInteractable && !nearVeh && !nearHijack) {
          this.triggerInteract();
        } else {
          this.toggleVehicle();
        }
      } else if (e.code === 'KeyK' && !this.activeVehicleId) {
        const remote = this.vehicleManager.findNearestMansionRemoteTarget(this.playerPos, 8.5);
        if (remote) {
          this.triggerMansionCarRemote(remote.mansionState.locked ? 'unlock_open' : 'lock_close');
        }
      } else if (e.code === 'KeyI' && this.activeVehicleId) {
        this.toggleMansionVehicleEngine();
      } else if (e.code === 'KeyO' && this.activeVehicleId) {
        this.toggleMansionVehicleDoors();
      } else if (e.code === 'KeyU' && this.activeVehicleId) {
        this.toggleMansionVehicleWindow('ALL');
      } else if (e.code === 'KeyL' && this.activeVehicleId) {
        this.toggleMansionVehicleHeadlights();
      } else if (e.code === 'KeyH') {
        this.triggerVehicleBeepSos();
      } else if (e.code === 'KeyV') {
        this.togglePerspective();
      } else if (e.code === 'KeyC' && this.activeVehicleId) {
        this.cycleVehicleCameraMode();
      } else if (e.code === 'Space' && !this.activeVehicleId) {
        this.triggerJump();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
  };

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keysHeld.clear();

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);

    const sharedSet = this.materials?.sharedSet;
    this.clearDynamicEntities();
    soundEngine.stopMansionPartyMusic();
    this.vehicleManager.clear();
    if (this.dropBeaconGroup) {
      disposeObject3DResources(this.dropBeaconGroup);
      this.scene.remove(this.dropBeaconGroup);
      this.dropBeaconGroup = null;
    }
    this.arena?.dispose();
    if (this.playerThirdPersonRig) {
      disposeObject3DResources(this.playerThirdPersonRig.root, sharedSet);
      this.scene.remove(this.playerThirdPersonRig.root);
      this.playerThirdPersonRig = null;
    }
    if (this.fpArms) {
      disposeObject3DResources(this.fpArms.group, sharedSet);
      this.camera.remove(this.fpArms.group);
      this.fpArms = null;
    }
    if (this.lobbyShowcaseGroup.parent) {
      disposeObject3DResources(this.lobbyShowcaseGroup, sharedSet);
      this.scene.remove(this.lobbyShowcaseGroup);
    }
    if (this.lobbyBikeGroup) {
      disposeObject3DResources(this.lobbyBikeGroup, sharedSet);
      this.scene.remove(this.lobbyBikeGroup);
      this.lobbyBikeGroup = null;
    }
    this.lobbyWeaponMeshes = {};
    Object.values(this.viewModels).forEach((vm) => {
      if (vm) {
        disposeObject3DResources(vm.group, sharedSet);
        this.weaponMount.remove(vm.group);
      }
    });
    this.viewModels = {};

    this.materials?.dispose();
    this.textures?.dispose();
    this.tracers.forEach((t) => this.scene.remove(t.mesh));
    this.tracers = [];
    this.shells.forEach((s) => this.scene.remove(s.mesh));
    this.shells = [];
    this.droppingMags.forEach((m) => this.scene.remove(m.mesh));
    this.droppingMags = [];
    this.particles.forEach((p) => this.scene.remove(p.mesh));
    this.particles = [];
    this.smokePuffs.forEach((sp) => this.scene.remove(sp.mesh));
    this.smokePuffs = [];
    this.explosions.forEach((ex) => {
      this.scene.remove(ex.mesh);
      ex.mat.dispose();
    });
    this.explosions = [];
    this.shockRings.forEach((sr) => {
      this.scene.remove(sr.mesh);
      sr.mat.dispose();
    });
    this.shockRings = [];
    this.glassShards.forEach((gs) => this.scene.remove(gs.mesh));
    this.glassShards = [];
    this.tirePuffs.forEach((tp) => this.scene.remove(tp.mesh));
    this.tirePuffs = [];
    this.waterSplashes.forEach((ws) => this.scene.remove(ws.mesh));
    this.waterSplashes = [];
    this.waterRipples.forEach((wr) => {
      this.scene.remove(wr.mesh);
      wr.mat.dispose();
    });
    this.waterRipples = [];
    this.sandPuffs.forEach((sp) => {
      this.scene.remove(sp.mesh);
      sp.mat.dispose();
    });
    this.sandPuffs = [];
    this.tracerGeo.dispose();
    this.tracerMatCache.forEach((m) => m.dispose());
    this.tracerMatCache.clear();
    this.shellGeo.dispose();
    this.shellMat.dispose();
    this.droppingMagGeo.dispose();
    this.droppingMagMat.dispose();
    this.particleGeo.dispose();
    this.particleMatCache.forEach((m) => m.dispose());
    this.particleMatCache.clear();
    this.smokeGeo.dispose();
    this.smokeMats.forEach((m) => m.dispose());
    this.waterSplashGeo.dispose();
    this.waterSplashMat.dispose();
    this.waterFoamMat.dispose();
    this.waterRippleGeo.dispose();
    this.sandPuffGeo.dispose();
    this.grenadeGeo.dispose();
    this.grenadeMat.dispose();
    this.explosionGeo.dispose();
    this.shockRingGeo.dispose();
    this.rocketBodyGeo.dispose();
    this.rocketConeGeo.dispose();
    this.rocketFlameGeo.dispose();
    this.rocketBodyMat.dispose();
    this.rocketConeMat.dispose();
    this.rocketFlameMat.dispose();
    this.bulletHoleGeo.dispose();
    this.bulletHoleMat?.dispose();
    this.bulletHoleMat = null;
    this.bloodPoolGeo.dispose();
    this.bloodPoolMat.dispose();
    this.shardGeo.dispose();
    this.shardMat.dispose();
    this.puffGeo.dispose();
    this.puffMat.dispose();
    this.electricSparks.forEach((es) => {
      this.scene.remove(es.mesh);
      es.mat.dispose();
    });
    this.electricSparks = [];
    this.electricSparkGeo.dispose();
    this.electricSparkTex?.dispose();
    this.electricSparkTex = null;
    if (this.electricSparkVideo) {
      this.electricSparkVideo.pause();
      this.electricSparkVideo.removeAttribute('src');
      this.electricSparkVideo.load();
      this.electricSparkVideo = null;
    }
    this.envRT?.dispose();
    this.envRT = null;
    this.composer?.dispose();
    this.composer = null;
    this.bloomPass = null;
    this.renderer.dispose();

    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
