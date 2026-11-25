import {
  WEAPON_ORDER,
  WEAPONS,
  createWeaponRecord,
  normalizeWeaponId,
  type FireMode,
  type ScopeStyle,
  type WeaponActionStyle,
  type WeaponCategory,
  type WeaponId,
  type WeaponSpec,
} from './shared/weapons.ts';

export { WEAPON_ORDER, WEAPONS, createWeaponRecord, normalizeWeaponId };
export type { FireMode, ScopeStyle, WeaponActionStyle, WeaponCategory, WeaponId, WeaponSpec };
import {
  SMART_CITY_POIS,
  type DroneFleetMode,
  type IrrigationMode,
  type RobotWorkMode,
  type SmartCityDynamicChartsData,
  type SmartCityTelemetry,
} from './game/smartCitySystems';
import type { SmartCityTargetKind } from './game/smartCityDestruction';

export interface SmartCityAimTargetInfo {
  label: string;
  kind: SmartCityTargetKind;
  hp: number;
  maxHp: number;
  stage: number;
  stageLabel: string;
  component: string;
}

export type WorldSystem = 'simulator';
export type WeatherKind = 'clear' | 'cloudy' | 'foggy' | 'rainy';
export type TimeOfDayPhase = 'morning' | 'afternoon' | 'sunset' | 'night';
export type BikeStyleId =
  | 'volt_green'
  | 'arctic_orange'
  | 'apex_gold'
  | 'emerald_stealth'
  | 'midnight_bat';
export type Difficulty = 'recruit' | 'veteran' | 'apex';
export type CameraPerspective = 'first' | 'third';
export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover';
export type DetectionState = 'hidden' | 'heard' | 'spotted';
export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface LoadProgress {
  progress: number; // 0..100
  stage: string;
  detail: string;
}

export interface ZoomOption {
  label: string;
  fov: number;
  sensMul: number;
}

export type SniperZoomOption = ZoomOption;

export const SNIPER_ZOOM_OPTIONS: ZoomOption[] = [
  { label: '2x', fov: 36, sensMul: 0.65 },
  { label: '4x', fov: 18, sensMul: 0.38 },
  { label: '8x', fov: 9, sensMul: 0.22 },
  { label: '10x', fov: 7.2, sensMul: 0.16 },
  { label: '30x', fov: 2.5, sensMul: 0.06 },
];

export const WEAPON_ZOOM_OPTIONS: Record<WeaponId, ZoomOption[]> = {
  unarmed: [{ label: '1x', fov: 68, sensMul: 1.0 }],
  pistol: [{ label: '1.2x', fov: 60, sensMul: 0.85 }],
  smg: [
    { label: '1.3x', fov: 56, sensMul: 0.78 },
    { label: '2x', fov: 40, sensMul: 0.58 },
  ],
  m4a1: [
    { label: '1.5x', fov: 50, sensMul: 0.72 },
    { label: '3x', fov: 30, sensMul: 0.48 },
  ],
  hk416: [
    { label: '1.5x', fov: 48, sensMul: 0.7 },
    { label: '3x', fov: 30, sensMul: 0.48 },
  ],
  hk416_cqb: [
    { label: '1.3x', fov: 56, sensMul: 0.8 },
    { label: '2x', fov: 42, sensMul: 0.6 },
  ],
  m27_iar: [
    { label: '1.6x', fov: 46, sensMul: 0.68 },
    { label: '3.5x', fov: 28, sensMul: 0.45 },
  ],
  m7: [
    { label: '1.8x', fov: 42, sensMul: 0.65 },
    { label: '4x', fov: 24, sensMul: 0.4 },
  ],
  xm8: [
    { label: '1.6x', fov: 46, sensMul: 0.68 },
    { label: '3x', fov: 30, sensMul: 0.48 },
  ],
  m16: [
    { label: '1.7x', fov: 45, sensMul: 0.66 },
    { label: '3.5x', fov: 28, sensMul: 0.46 },
  ],
  mk17: [
    { label: '1.8x', fov: 40, sensMul: 0.62 },
    { label: '4x', fov: 24, sensMul: 0.4 },
  ],
  mcx: [
    { label: '1.4x', fov: 52, sensMul: 0.75 },
    { label: '2.5x', fov: 34, sensMul: 0.52 },
  ],
  m249: [
    { label: '1.3x', fov: 52, sensMul: 0.75 },
    { label: '2.2x', fov: 38, sensMul: 0.55 },
  ],
  sniper: SNIPER_ZOOM_OPTIONS,
  shotgun: [{ label: '1.2x', fov: 60, sensMul: 0.85 }],
  rocket: [
    { label: '2x', fov: 42, sensMul: 0.62 },
    { label: '3.5x', fov: 26, sensMul: 0.45 },
  ],
};

export type MapId = 'simulator_city';
export type DropSector = 'west' | 'center' | 'east';
export type OperatorSkinId = 'wolf_black' | 'desert_recon' | 'ranger_olive' | 'night_ops';
export type WeaponSkinId = 'standard' | 'crimson' | 'desert' | 'carbon' | 'arctic';
export type ReticleColorId = 'amber' | 'emerald' | 'cyan' | 'crimson';
export type LobbyPose = 'ready' | 'patrol' | 'guard';
export type LobbyViewMode = 'overview' | 'soldier' | 'weapon' | 'map';
export type CustomizableControlId =
  | 'move'
  | 'fire'
  | 'jump'
  | 'grenade'
  | 'ads'
  | 'crouch'
  | 'slide'
  | 'reload'
  | 'camera';

export interface HudControlPlacement {
  xPct: number; // 6..94 horizontal % of stage
  yPct: number; // 14..94 vertical % of stage
  scale: number; // 0.65..1.75 size multiplier
}

export type HudControlLayout = Record<CustomizableControlId, HudControlPlacement>;

export const DEFAULT_HUD_CONTROL_LAYOUT: HudControlLayout = {
  move: { xPct: 14, yPct: 70, scale: 1.0 },
  fire: { xPct: 88, yPct: 72, scale: 1.1 },
  jump: { xPct: 79, yPct: 75, scale: 1.0 },
  ads: { xPct: 72, yPct: 68, scale: 0.95 },
  grenade: { xPct: 72, yPct: 54, scale: 0.95 },
  reload: { xPct: 79, yPct: 56, scale: 0.95 },
  slide: { xPct: 86, yPct: 54, scale: 0.95 },
  crouch: { xPct: 92, yPct: 58, scale: 0.95 },
  camera: { xPct: 78, yPct: 36, scale: 1.0 },
};

export interface HudSettings {
  hudScale: number; // 0.75 to 1.35
  hudOpacity: number; // 0.45 to 1.0
  lookSensitivity: number; // 0.5 to 3.0
  leftHanded: boolean;
  showRadar: boolean;
  showTouchControls: boolean;
  autoSprint: boolean;
  graphicsQuality: GraphicsQuality;
  bloomEnabled: boolean;
  mapSaturation: number; // 0.8 to 1.8
  sfxVolume: number; // 0 to 1
  muted: boolean;
  controlLayout: HudControlLayout;
}

export const DEFAULT_HUD_SETTINGS: HudSettings = {
  hudScale: 0.85,
  hudOpacity: 1,
  lookSensitivity: 1,
  leftHanded: false,
  showRadar: true,
  showTouchControls: true,
  autoSprint: true,
  graphicsQuality: 'low',
  bloomEnabled: false,
  mapSaturation: 1.38,
  sfxVolume: 0.85,
  muted: false,
  controlLayout: {
    move: { ...DEFAULT_HUD_CONTROL_LAYOUT.move },
    fire: { ...DEFAULT_HUD_CONTROL_LAYOUT.fire },
    jump: { ...DEFAULT_HUD_CONTROL_LAYOUT.jump },
    ads: { ...DEFAULT_HUD_CONTROL_LAYOUT.ads },
    grenade: { ...DEFAULT_HUD_CONTROL_LAYOUT.grenade },
    reload: { ...DEFAULT_HUD_CONTROL_LAYOUT.reload },
    slide: { ...DEFAULT_HUD_CONTROL_LAYOUT.slide },
    crouch: { ...DEFAULT_HUD_CONTROL_LAYOUT.crouch },
    camera: { ...DEFAULT_HUD_CONTROL_LAYOUT.camera },
  },
};

export interface LoadoutConfig {
  startingWeapon: WeaponId;
  operatorSkin: OperatorSkinId;
  weaponSkin: WeaponSkinId;
  reticleColor: ReticleColorId;
  lobbyPose: LobbyPose;
  preferredFireModes: Partial<Record<WeaponId, FireMode>>;
}

export const DEFAULT_LOADOUT_CONFIG: LoadoutConfig = {
  startingWeapon: 'm4a1',
  operatorSkin: 'wolf_black',
  weaponSkin: 'standard',
  reticleColor: 'amber',
  lobbyPose: 'ready',
  preferredFireModes: {},
};


// --- Simulator World POIs & Vehicle Spawn Spec ---
export interface DronePoi {
  id: string;
  name: string;
  shortName?: string;
  subtitle: string;
  x: number;
  z: number;
  viewYaw?: number;
  kind: 'base' | 'town' | 'landmark' | 'depot';
}

export interface VehicleSpawnSpec {
  id: string;
  kind: VehicleKind;
  x: number;
  y?: number;
  z: number;
  yaw: number;
  bikeStyle?: BikeStyleId;
}

export const SIMULATOR_POIS: DronePoi[] = [
  {
    id: 'sim_mansion',
    name: 'Apex Luxury Mansion',
    shortName: 'Luxury Mansion',
    subtitle: '4-Level Private Estate, Supercar Showroom & 3F DJ Party Club',
    x: 0,
    z: -274,
    viewYaw: 0,
    kind: 'base',
  },
  {
    id: 'sim_hotel',
    name: 'Grand Waterfront Hotel',
    shortName: 'Resort Hotel',
    subtitle: 'Central Resort · Revolving Lobby, Cafeteria, Chefs & Pool',
    x: 26,
    z: 22,
    viewYaw: Math.PI,
    kind: 'town',
  },
  {
    id: 'sim_mall',
    name: 'Grand Atrium Mall (1F-3F)',
    shortName: 'Grand Mall',
    subtitle: '5 Stores · Clothes, Perfume, Watches, Shoes, Cafeteria & Lifts',
    x: -44,
    z: -13,
    viewYaw: 0,
    kind: 'town',
  },
  {
    id: 'sim_festival',
    name: 'Festival Amusement Park & Circus',
    shortName: 'Festival Park',
    subtitle: 'Ferris Wheel, Carousel, Circus Jokers, Stalls & Neon Lights',
    x: 84,
    z: 60,
    viewYaw: Math.PI,
    kind: 'landmark',
  },
  {
    id: 'sim_park',
    name: 'Modern Park & Playground',
    shortName: 'Park & Swings',
    subtitle: 'Central Park · Swings, Slide, Duck Pond, Fountain & Fitness',
    x: -46,
    z: 36,
    viewYaw: 2.75,
    kind: 'landmark',
  },
  {
    id: 'sim_dropzone',
    name: 'Dropzone Compound & Drums',
    shortName: 'Dropzone Base',
    subtitle: 'East Sector · Tactical Watchtower, Hangar, Crates & Red Drums',
    x: 186,
    z: 35,
    viewYaw: -2.72,
    kind: 'base',
  },
  {
    id: 'sim_snow',
    name: 'Paradise Snow Mountains & Camps',
    shortName: 'Snow & Camps',
    subtitle: 'NW Quadrant · Snowboard Slopes, Campsites, Waterfall & Farms',
    x: -175,
    z: -152,
    viewYaw: 0.35,
    kind: 'landmark',
  },
  {
    id: 'sim_metro',
    name: 'Metro Stadium & Express Rail',
    shortName: 'Metro Stadium',
    subtitle: 'NE Quadrant · Live Footballers, Seated Fans & Full-Map Train',
    x: 152,
    z: -162,
    viewYaw: -0.72,
    kind: 'landmark',
  },
  {
    id: 'sim_seine',
    name: 'Paris Seine & Iron Tower',
    shortName: 'Paris Seine',
    subtitle: 'SW Quadrant · Grand Lattice Tower, River Bridges & Seine Mall',
    x: -162,
    z: 148,
    viewYaw: 2.6,
    kind: 'landmark',
  },
  {
    id: 'sim_power',
    name: 'Power Plant & Suburb Homes',
    shortName: 'Power & Homes',
    subtitle: 'SE Quadrant · Cooling Towers, Plant Engineers & Citizen Homes',
    x: 188,
    z: 176,
    viewYaw: 2.4,
    kind: 'depot',
  },
  {
    id: 'sim_petrol',
    name: 'Gas Station & Cyber Bikes',
    shortName: 'Gas & Bikes',
    subtitle: 'Central Boulevard · Modern Fuel Canopy, Bikes & Traffic Gantry',
    x: 24,
    z: -62,
    viewYaw: 0.25,
    kind: 'depot',
  },
  {
    id: 'sim_bay_downtown',
    name: 'Bay Downtown & Zenith Tower',
    shortName: 'Bay Downtown',
    subtitle: 'East Metropolis · Enterable 24m Glass Sky Lift Tower & Diagrid Spires',
    x: 355,
    z: -24,
    viewYaw: -1.1,
    kind: 'town',
  },
  {
    id: 'sim_bay_hospital',
    name: 'City Hospital & Civic HQ',
    shortName: 'Hospital & HQ',
    subtitle: 'Civic Quarter · 24H Trauma ER Heal, Helipad, Police HQ & Fire Station',
    x: 315,
    z: -135,
    viewYaw: Math.PI,
    kind: 'base',
  },
  {
    id: 'sim_bay_mall',
    name: 'Bay Mega-Mall & AutoMax',
    shortName: 'Bay Mega-Mall',
    subtitle: 'Commercial Plaza · 6th Elevator Mall, AutoMax Showroom & Parking Deck',
    x: 315,
    z: 48,
    viewYaw: 0,
    kind: 'town',
  },
  {
    id: 'sim_bay_coast',
    name: 'Red Suspension Bridge & Ocean',
    shortName: 'Red Bridge',
    subtitle: 'Ocean Channel · Big Red Suspension Bridge, Cruise Ships & Harbor Boats',
    x: 545,
    z: 0,
    viewYaw: -Math.PI * 0.5,
    kind: 'landmark',
  },
  {
    id: 'sim_east_ring',
    name: 'East Ring Skyline & Civic Plaza',
    shortName: 'Ring City',
    subtitle: 'Circular Boulevards · Capitol, Space Needle, White House, Minimalist Skyline & New EVs',
    x: 902,
    z: 0,
    viewYaw: -Math.PI * 0.5,
    kind: 'town',
  },
  {
    id: 'sim_airport',
    name: 'Grand International Airport',
    shortName: 'Airport',
    subtitle: 'Runway & Terminals · Flying Jet, ATC Radar, Jetbridges & Helicopter Pad',
    x: 1175,
    z: -148,
    viewYaw: 0,
    kind: 'base',
  },
  {
    id: 'sim_royal_castle',
    name: 'Grand Royal Castle & Cavalry',
    shortName: 'Royal Castle',
    subtitle: 'Moat Citadel · Royal Foot Guards, Mounted Horse Cavalry, Windmill & Keep',
    x: 1152,
    z: 185,
    viewYaw: -Math.PI * 0.5,
    kind: 'landmark',
  },
  {
    id: 'sim_chinatown',
    name: 'Grand Chinatown & Dragon Plaza',
    shortName: 'Chinatown',
    subtitle: 'Paifang Gates · Red Lanterns, Imperial Temple, Sakura Gardens & Dragon Dance',
    x: 842,
    z: 228,
    viewYaw: -Math.PI * 0.5,
    kind: 'town',
  },
  {
    id: 'sim_isometric_valley',
    name: 'Isometric River Valley & Balloons',
    shortName: 'Valley & Balloons',
    subtitle: 'Eastern Flank · Snow Mountains, Winding River Bridge, Modern Towers & Hot Air Balloons',
    x: 1210,
    z: -15,
    viewYaw: -Math.PI * 0.5,
    kind: 'landmark',
  },
  {
    id: 'sim_west_bridge',
    name: 'Golden-Cyan Sky Bridge & Strait',
    shortName: 'West Sky Bridge',
    subtitle: 'Western Ocean Strait · Twin Diamond Cable-Stayed Pylons, Turbo Pads & Yachts',
    x: -242,
    z: 0,
    viewYaw: Math.PI * 0.5,
    kind: 'landmark',
  },
  {
    id: 'sim_west_grandprix',
    name: 'Cyber-Tokyo & Grand Prix Circuit',
    shortName: 'F1 Grand Prix',
    subtitle: 'Formula Race Track · 6 Lap Gates, Nitro Pads, Neon Skyscrapers & Holoprojectors',
    x: -662,
    z: -229,
    viewYaw: Math.PI * 0.5,
    kind: 'town',
  },
  {
    id: 'sim_west_spaceport',
    name: 'Apex Spaceport & Orbital Launch',
    shortName: 'Spaceport Rocket',
    subtitle: 'NW West Island · Interactive [E] Rocket Launch, Planetarium Sphere & Helipad',
    x: -994,
    z: -125,
    viewYaw: Math.PI * 0.5,
    kind: 'base',
  },
  {
    id: 'sim_west_biodomes',
    name: 'Helios Eco-Biodomes & Monorail',
    shortName: 'Eco-Biodomes',
    subtitle: 'Geodesic Glass Domes, Solar Supertrees, Walkable Skywalk, Monorail & Marina Lighthouse',
    x: -705,
    z: 114,
    viewYaw: 0,
    kind: 'landmark',
  },
  {
    id: 'sim_west_pyramid',
    name: 'Sun Pyramid & Red-Rock Canyon',
    shortName: 'Sun Pyramid',
    subtitle: 'Climbable Golden Ziggurat, Solar Crystal Summit & Stunt Jump Rings',
    x: -985,
    z: 175,
    viewYaw: Math.PI * 0.5,
    kind: 'landmark',
  },
  ...SMART_CITY_POIS.map((p) => ({
    id: p.id,
    name: p.name,
    shortName: p.shortName,
    subtitle: p.subtitle,
    x: p.x,
    z: p.z,
    viewYaw: p.viewYaw,
    kind: p.kind,
  })),
];

export function isOpenWorldMap(mapId: MapId): boolean {
  return mapId === 'simulator_city';
}

export function getMapPois(mapId: MapId): DronePoi[] {
  if (mapId === 'simulator_city') return SIMULATOR_POIS;
  return [];
}

export interface CustomDropTarget {
  x: number;
  y?: number;
  z: number;
  label: string;
}

export const MAP_PRESETS: Record<
  MapId,
  {
    id: MapId;
    name: string;
    environment: string;
    weather: string;
    description: string;
    thumbnail?: string;
    worldRadius: number;
  }
> = {
  simulator_city: {
    id: 'simulator_city',
    name: 'Unified Mega-World: East & West Empires',
    environment: 'Mega World Simulator · Twin Ocean Bridges, Grand Prix, Spaceport, Castle & Chinatown',
    weather: 'Dynamic Day/Night, Air Flow Wind & Outdoor Ambience',
    description:
      'Massive dual-coast seamless world! Cross the East Red Bridge to Ring City, Airport, Royal Castle & Chinatown, OR cross the new West Sky Bridge to Cyber-Tokyo F1 Grand Prix, Interactive Launching Spaceport Rocket, Helios Eco-Biodomes & Monorail, Marina Lighthouse & Climbable Golden Sun Pyramid.',
    thumbnail: './assets/aistudio/23332-50kb_a46294ed.jpeg',
    worldRadius: 1500,
  },
};

export const BIKE_STYLES: {
  id: BikeStyleId;
  name: string;
  bodyHex: number;
  secondaryHex: number;
  trimHex: number;
  neonHex: number;
  swatchCss: string;
}[] = [
  {
    id: 'volt_green',
    name: 'Volt-X Titanium',
    bodyHex: 0xf4f7fb,
    secondaryHex: 0x9aa4b4,
    trimHex: 0xff6d00,
    neonHex: 0x1aff66,
    swatchCss: '#1aff66',
  },
  {
    id: 'arctic_orange',
    name: 'Arctic Blade',
    bodyHex: 0xf1f5f9,
    secondaryHex: 0x141820,
    trimHex: 0xf97316,
    neonHex: 0xff8a1e,
    swatchCss: '#f97316',
  },
  {
    id: 'apex_gold',
    name: 'Apex Sovereign Gold',
    bodyHex: 0xfbbf24,
    secondaryHex: 0xb45309,
    trimHex: 0xfef08a,
    neonHex: 0xfde047,
    swatchCss: '#fbbf24',
  },
  {
    id: 'emerald_stealth',
    name: 'Cyber Emerald',
    bodyHex: 0x1f2937,
    secondaryHex: 0x0f172a,
    trimHex: 0xff6a00,
    neonHex: 0x10b981,
    swatchCss: '#10b981',
  },
  {
    id: 'midnight_bat',
    name: 'Midnight Hyper',
    bodyHex: 0x12151c,
    secondaryHex: 0x262b38,
    trimHex: 0xeab308,
    neonHex: 0xfacc15,
    swatchCss: '#eab308',
  },
];

export const OPERATOR_SKINS: {
  id: OperatorSkinId;
  name: string;
  detail: string;
  primaryHex: string;
  accentHex: string;
}[] = [
  {
    id: 'wolf_black',
    name: 'Crimson Vanguard',
    detail: 'Stealth black combat rig with crimson tactical webbing & armor',
    primaryHex: '#1c2028',
    accentHex: '#dc2626',
  },
  {
    id: 'desert_recon',
    name: 'Desert Recon',
    detail: 'Arid coyote tan plate carrier & sandstone BDU',
    primaryHex: '#9c8360',
    accentHex: '#d97706',
  },
  {
    id: 'ranger_olive',
    name: 'Woodland Ranger',
    detail: 'OD green tactical fatigues & ranger matte armor',
    primaryHex: '#3f4f36',
    accentHex: '#65a30d',
  },
  {
    id: 'night_ops',
    name: 'Night Ops Spec',
    detail: 'Deep navy-slate urban gear with cyan tactical trim',
    primaryHex: '#1e293b',
    accentHex: '#0ea5e9',
  },
];

export const WEAPON_SKINS: {
  id: WeaponSkinId;
  name: string;
  detail: string;
  swatchHex: string;
}[] = [
  { id: 'standard', name: 'Factory Spec', detail: 'Standard military gunmetal & crimson accent', swatchHex: '#4b5563' },
  { id: 'crimson', name: 'Crimson Strike', detail: 'Anodized crimson receiver with dark carbon', swatchHex: '#dc2626' },
  { id: 'desert', name: 'Desert Coyote', detail: 'Matte cerakote sand finish for arid ops', swatchHex: '#c29b61' },
  { id: 'carbon', name: 'Stealth Carbon', detail: 'Blackout polymer & titanium hardware', swatchHex: '#18181b' },
  { id: 'arctic', name: 'Arctic Digital', detail: 'High-contrast alpine white & slate furniture', swatchHex: '#e2e8f0' },
];

export const RETICLE_COLORS: { id: ReticleColorId; name: string; hex: string }[] = [
  { id: 'amber', name: 'Amber Gold', hex: '#fbbf24' },
  { id: 'emerald', name: 'Tactical Green', hex: '#34d399' },
  { id: 'cyan', name: 'Ice Cyan', hex: '#22d3ee' },
  { id: 'crimson', name: 'Red Dot', hex: '#f87171' },
];

export type PlayerAnimState =
  | 'idle'
  | 'walk'
  | 'crouch_idle'
  | 'crouch_walk'
  | 'sprint'
  | 'slide'
  | 'jump'
  | 'land'
  | 'cover_crouch'
  | 'cover_peek'
  | 'reload'
  | 'grenade'
  | 'breach'
  | 'drive';

export interface KillFeedEntry {
  id: number;
  text: string;
  isHeadshot: boolean;
  isOnBeat: boolean;
  timestamp: number;
}

export interface CompassThreat {
  id: number;
  angleDeg: number; // relative to north 0..360
  intensity: number; // 0..1
}

export interface RadarBlip {
  x: number;
  z: number;
  kind: 'enemy' | 'heavy' | 'crate' | 'barrel' | 'vehicle' | 'poi' | 'drop';
  alert?: boolean;
  label?: string;
}

export interface RadarObstacle {
  cx: number;
  cz: number;
  w: number;
  d: number;
}

// --- Vehicles ---
export type VehicleKind =
  | 'digital_bike'
  | 'electric_scooter'
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
  | 'mansion_hyper_scissor'
  | 'mansion_escalade_gull'
  | 'mansion_hummer_gold'
  | 'mansion_escalade_dragon'
  | 'mansion_range_marble'
  | 'mansion_ev_gt'
  | 'apex_heli';

export interface NearbyHijackVehicleInfo {
  agentId: number;
  name: string;
  isBike: boolean;
}

export type VehicleCameraMode = 'inner' | 'near' | 'outer' | 'far' | 'action';

export interface MansionNearbyRemoteInfo {
  vehicleId: string;
  vehicleName: string;
  locked: boolean;
  doorsOpen: boolean;
  distanceMeters: number;
}

export interface MansionActiveVehicleInfo {
  isMansionExclusive: boolean;
  isHelicopter: boolean;
  locked: boolean;
  engineRunning: boolean;
  cranking: boolean;
  doorsOpen: boolean;
  windowOpenFL: number;
  windowOpenFR: number;
  windowOpenRL: number;
  windowOpenRR: number;
  headlightsOn: boolean;
  rotorRpm: number;
}

export interface VehicleHudState {
  inVehicle: boolean;
  vehicleId: string | null;
  vehicleKind: VehicleKind | null;
  vehicleName: string | null;
  cameraMode: VehicleCameraMode;
  hasMountedGun: boolean;
  speedKmh: number;
  gear: string;
  health: number;
  maxHealth: number;
  altitude: number;
  crashStage?: 0 | 1 | 2 | 3;
  isBikeEjected?: boolean;
  nearbyVehicleId: string | null;
  nearbyVehicleName: string | null;
  nearbyVehicleKind: VehicleKind | null;
  nearbyHijackVehicle: NearbyHijackVehicleInfo | null;
  mansion?: {
    nearbyRemote: MansionNearbyRemoteInfo | null;
    active: MansionActiveVehicleInfo | null;
    blockedReason?: string | null;
  };
}

export interface VehicleInputState {
  throttle: number; // -1..1 (positive = gas, negative = reverse)
  steer: number; // -1..1 (positive = turn right)
  ascend: boolean;
  descend: boolean;
}

export type SimShopCategory = 'food' | 'gear' | 'vehicle';

export interface SimShopItem {
  id: string;
  name: string;
  category: SimShopCategory;
  price: number;
  healHp: number;
  grantArmor: number;
  staminaRefill: number;
  description: string;
}

export const SIM_SHOP_ITEMS: SimShopItem[] = [
  {
    id: 'energy_snack',
    name: 'Metro Energy Bar',
    category: 'food',
    price: 40,
    healHp: 25,
    grantArmor: 0,
    staminaRefill: 60,
    description: 'Convenience Mart snack · Restores +25 HP & +60 Stamina.',
  },
  {
    id: 'bistro_espresso',
    name: 'Seine Bistro Meal',
    category: 'food',
    price: 85,
    healHp: 65,
    grantArmor: 0,
    staminaRefill: 100,
    description: 'Chef special platter · Full Stamina & +65 HP recovery.',
  },
  {
    id: 'kevlar_vest',
    name: 'Tactical Street Vest',
    category: 'gear',
    price: 160,
    healHp: 0,
    grantArmor: 50,
    staminaRefill: 0,
    description: 'Mall Armory protection · +50 ballistic Armor plating.',
  },
  {
    id: 'cyber_sneakers',
    name: 'Volt Sprint Trainers',
    category: 'gear',
    price: 240,
    healHp: 15,
    grantArmor: 0,
    staminaRefill: 100,
    description: 'Mall Fashion footwear · Instant stamina surge & +15 HP.',
  },
  {
    id: 'designer_jacket',
    name: 'Apex Couture Jacket',
    category: 'gear',
    price: 420,
    healHp: 40,
    grantArmor: 60,
    staminaRefill: 100,
    description: 'Designer boutique armored jacket · +60 Armor & +40 HP.',
  },
  {
    id: 'chronograph_watch',
    name: 'Grand Prix Chrono',
    category: 'gear',
    price: 680,
    healHp: 100,
    grantArmor: 100,
    staminaRefill: 100,
    description: 'Luxury mall timepiece · Full HP, Armor & Stamina restore.',
  },
  {
    id: 'nitro_tune_kit',
    name: 'Cyber Tune & Repair',
    category: 'vehicle',
    price: 150,
    healHp: 0,
    grantArmor: 20,
    staminaRefill: 50,
    description: 'Petrol Service Pack · Repairs & refuels nearby/driven vehicle 100%.',
  },
];


export interface HudState {
  health: number;
  maxHealth: number;
  isRecoveringHealth: boolean;
  recoveryCountdown: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  grenades: number;
  score: number;
  highScore: number;
  kills: number;
  targetKills: number;
  victoryCelebration: boolean;
  headshots: number;
  wave: number;
  enemiesRemaining: number;
  streak: number;
  bestStreak: number;
  combo: number;
  shotsFired: number;
  shotsHit: number;
  activeWeapon: WeaponId;
  activeFireMode: FireMode;
  supportedFireModes: FireMode[];
  ammoInMag: Record<WeaponId, number>;
  reserveAmmo: Record<WeaponId, number>;
  isReloading: boolean;
  reloadProgress: number;
  reloadStage: string;
  isAds: boolean;
  sniperZoomIndex: number;
  sniperZoomLabel: string;
  activeZoomLabel: string;
  canCycleZoom: boolean;
  aimDistance: number;
  fps: number;
  isSprinting: boolean;
  runModeEnabled: boolean;
  isCrouching: boolean;
  isSliding: boolean;
  isInCover: boolean;
  coverPeekDir: -1 | 0 | 1;
  nearDoorway: boolean;
  isBreaching: boolean;
  isThrowingGrenade: boolean;
  animState: PlayerAnimState;
  perspective: CameraPerspective;
  spreadAmount: number;
  hitMarker: 'none' | 'body' | 'head' | 'kill';
  headshotSeq: number;
  lastHeadshotAt: number;
  damageFlash: number; // 0 to 1
  detectedState: DetectionState;
  killFeed: KillFeedEntry[];
  headingDeg: number; // 0..360
  threats: CompassThreat[];
  playerX: number;
  playerZ: number;
  radarBlips: RadarBlip[];
  radarObstacles: RadarObstacle[];
  radarWorldRange: number;
  elapsedTime: number;
  vehicle: VehicleHudState;
  worldSystem: WorldSystem;
  timePhase: TimeOfDayPhase;
  clockLabel: string;
  weather: WeatherKind;
  autoEnvCycle: boolean;
  bikeStyle: BikeStyleId;
  nearbyInteractable: {
    id: string;
    label: string;
    category: 'door' | 'refuel' | 'shop' | 'dine' | 'bike' | 'seat' | 'dashboard' | 'transit_door';
  } | null;
  seatedChair?: {
    label: string;
    kind: 'gaming_chair' | 'sofa';
    canRotate: boolean;
  } | null;
  interactFeedback: string | null;
  districtName?: string;
  simNpcCount?: number;
  simCredits: number;
  simPurchasedItems: Record<string, number>;
  simStuntsCompleted: number;
  simRacesCompleted: number;
  simBestLapSec: number | null;
  simVisitedCount: number;
  wantedLevel: number;
  wantedEvading: boolean;
  wantedPoliceKills: number;
  isBikeEjected?: boolean;
  smartCity?: {
    telemetry: SmartCityTelemetry;
    irrigationMode: IrrigationMode;
    droneFleetMode: DroneFleetMode;
    robotWorkMode: RobotWorkMode;
    factoryActive: boolean;
    securityAlert: boolean;
    researchBoost: boolean;
    charts?: SmartCityDynamicChartsData;
    robotStages?: number[];
    droneStages?: number[];
    aimTarget?: SmartCityAimTargetInfo | null;
  };
}
