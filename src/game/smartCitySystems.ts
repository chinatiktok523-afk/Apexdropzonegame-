/**
 * Pure deterministic simulation & spatial math for the Consolidated Glass-Domed
 * Futuristic AI Smart City & Autonomous Farming Ecosystem near the Apex Luxury Mansion & Garage.
 *
 * Strictly pure (zero Three.js, zero DOM, zero React) so all layout rules,
 * robot/drone state machines, crop cycles, destruction integration, and chart telemetry
 * can be fast-tested with node:test and stepped with zero GC churn inside engine.ts.
 */

import {
  applyBulletDamage,
  createDestructibleEntity,
  repairDestructibleEntity,
  type BulletHitOutcome,
  type DestructibleEntityState,
  type DestructionStage,
  type SmartCityComponentKind,
} from './smartCityDestruction';

export const SMART_CITY_DOME = {
  centerX: -146,
  centerZ: -542,
  radius: 116,
  height: 74,
  titleText: 'SMART CITY',
  subtitleText: 'developed by AFTAB BALOCH DADU',
} as const;

export const SMART_CITY_BOUNDS = {
  minX: SMART_CITY_DOME.centerX - SMART_CITY_DOME.radius - 4, // -266
  maxX: SMART_CITY_DOME.centerX + SMART_CITY_DOME.radius + 4, // -26
  minZ: -722, // Includes Gate 2 outer environment exit spur
  maxZ: SMART_CITY_DOME.centerZ + SMART_CITY_DOME.radius + 4, // -422
} as const;

export const MANSION_WEST_GARAGE_PORTAL = {
  wallX: -88,
  gapCenterZ: -398,
  gapHalfSpan: 8.5,
} as const;

export interface SmartCityGateSpec {
  id: 'gate_mansion_garage' | 'gate_outer_env';
  label: string;
  x: number;
  z: number;
  yaw: number;
  openRadius: number;
  closeRadius: number;
}

// Gate 1 sits flush on the Glass Dome rim facing the Mansion West Wall beside Garage (-88, -398).
// Gate 2 sits flush on the North Dome rim facing the outer natural environment.
export const SMART_CITY_GATES: ReadonlyArray<SmartCityGateSpec> = [
  {
    id: 'gate_mansion_garage',
    label: 'Smart City Main Gate (Mansion Garage Wing)',
    x: -101.7,
    z: -434.8,
    yaw: 0.392, // Outward vector (0.382, 0.924) toward Mansion Garage wall opening
    openRadius: 13.5,
    closeRadius: 19.5,
  },
  {
    id: 'gate_outer_env',
    label: 'Smart City North Gate (Outer Environment)',
    x: -146,
    z: -658,
    yaw: Math.PI, // Facing North (-Z) toward outer hills & nature
    openRadius: 13.5,
    closeRadius: 19.5,
  },
];

// ONE continuous exploration road:
// Mansion Garage Forecourt -> beside Garage -> Mansion Wall Portal -> Dome Gate 1 ->
// serpentine tour past Greenhouses/Crops/Hydro/Lab/HQ/Factory -> Dome Gate 2 -> Outer Environment
export const SMART_CITY_SINGLE_ROAD_POINTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: -78, z: -312 },
  { x: -82, z: -388 },
  { x: -88, z: -398 },
  { x: -101.7, z: -434.8 }, // Gate 1
  { x: -114, z: -464 },
  { x: -146, z: -492 },
  { x: -180, z: -536 },
  { x: -172, z: -586 },
  { x: -146, z: -616 },
  { x: -146, z: -658 }, // Gate 2
  { x: -146, z: -714 }, // Outer Nature Exit
];

export type SmartCityDistrictName =
  | 'AI Automated Farming & Greenhouses'
  | 'Vertical Hydroponics & Soil Labs'
  | 'Smart City Downtown & AI Labs'
  | 'Autonomous Factories & Recycling'
  | 'Renewable Energy & Drone Hub';

export type RobotRoleId =
  | 'planting_robot'
  | 'harvesting_robot'
  | 'watering_robot'
  | 'soil_testing_robot'
  | 'crop_inspection_robot'
  | 'greenhouse_maintenance_robot'
  | 'delivery_robot'
  | 'cleaning_robot'
  | 'security_patrol_robot'
  | 'construction_robot'
  | 'road_maintenance_robot'
  | 'warehouse_robot'
  | 'research_lab_robot'
  | 'transport_robot'
  | 'gardening_robot'
  | 'tree_maintenance_robot'
  | 'recycling_robot'
  | 'ag_monitoring_robot'
  | 'autonomous_assistant_robot'
  | 'humanoid_robot'
  | 'cargo_loader_robot'
  | 'emergency_response_robot'
  | 'solar_panel_cleaner_bot'
  | 'dome_structural_inspector_bot'
  | 'medical_aid_robot'
  | 'hydroponic_pollinator_bot'
  | 'heavy_welding_bot'
  | 'autonomous_forklift_bot'
  | 'security_sentinel_alpha'
  | 'nano_harvester_bot';

export interface RobotRoleSpec {
  id: RobotRoleId;
  index: number;
  label: string;
  sector: 'farming' | 'city' | 'factory' | 'energy' | 'lab';
  visualKind: 'humanoid' | 'assistant' | 'rover_arm' | 'rover_camera' | 'utility_box' | 'heavy_loader';
  bodyHex: number;
  accentHex: number;
  baseSpeed: number;
  waypoints: ReadonlyArray<{ x: number; z: number }>;
}

export type DroneArchetypeId =
  | 'ag_spraying'
  | 'crop_monitoring'
  | 'seed_distribution'
  | 'security_surveillance'
  | 'delivery_drone'
  | 'greenhouse_inspection'
  | 'aerial_mapping';

export interface DroneUnitSpec {
  id: string;
  archetype: DroneArchetypeId;
  label: string;
  style: 'sprayer_white' | 'phantom_cam' | 'security_dark' | 'cargo_white';
  padX: number;
  padZ: number;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  cruiseY: number;
  speedRad: number;
  phaseOffset: number;
  hasMist: boolean;
}

export type IrrigationMode = 'auto' | 'boost' | 'conserve';
export type DroneFleetMode = 'active' | 'patrol' | 'recall';
export type RobotWorkMode = 'standard' | 'overdrive' | 'eco';

export interface SmartCityAgentRuntime {
  roleId: RobotRoleId;
  x: number;
  z: number;
  yaw: number;
  waypointIdx: number;
  progress: number;
  workPhase: number;
  active: boolean;
  damage: DestructibleEntityState;
}

export interface SmartCityDroneRuntime {
  id: string;
  archetype: DroneArchetypeId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  angle: number;
  deployFactor: number; // 0 = landed on charging pad, 1 = airborne on mission
  batteryPct: number;
  spraying: boolean;
  damage: DestructibleEntityState;
}

export interface SmartCityTelemetry {
  robotsOperating: number;
  robotsTotal: number;
  robotsDamaged: number;
  robotsDestroyed: number;
  activeDrones: number;
  dronesTotal: number;
  dronesDamaged: number;
  dronesDestroyed: number;
  machinesTotal: number;
  machinesDamaged: number;
  farmingProductionTons: number;
  harvestedCrates: number;
  cropHealthPct: number;
  soilMoisturePct: number;
  waterConsumptionLpm: number;
  waterRecycledPct: number;
  electricitySolarMw: number;
  electricityWindMw: number;
  electricityTotalMw: number;
  electricityDemandMw: number;
  factoryProductionUnits: number;
  cityPopulation: number;
  securityStatus: 'NOMINAL' | 'HIGH ALERT';
  securityCoveragePct: number;
  researchProgressPct: number;
  researchProjectsActive: number;
}

export interface SmartCitySimulationState {
  irrigationMode: IrrigationMode;
  droneFleetMode: DroneFleetMode;
  robotWorkMode: RobotWorkMode;
  factoryActive: boolean;
  securityAlert: boolean;
  researchBoost: boolean;
  harvestTriggerCount: number;
  cropGrowthStage: number; // 0..1 continuous loop
  simTimeSec: number;
  robots: SmartCityAgentRuntime[];
  drones: SmartCityDroneRuntime[];
  machines: DestructibleEntityState[];
  telemetry: SmartCityTelemetry;
}

export type SmartCityCommand =
  | { type: 'set_irrigation'; mode: IrrigationMode }
  | { type: 'set_drones'; mode: DroneFleetMode }
  | { type: 'set_robots'; mode: RobotWorkMode }
  | { type: 'toggle_factory'; active?: boolean }
  | { type: 'toggle_security'; alert?: boolean }
  | { type: 'toggle_research_boost'; boost?: boolean }
  | { type: 'trigger_harvest' }
  | { type: 'repair_all' };

export const SMART_CITY_CONTROL_TERMINALS: ReadonlyArray<{
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
}> = [
  { id: 'sc_term_greenhouse', label: 'Greenhouse AI Tablet', x: -154, y: 0, z: -444 },
  { id: 'sc_term_hydro_lab', label: 'AI Farm Hydroponic Console', x: -202, y: 0, z: -562 },
  { id: 'sc_term_robotics_lab', label: 'Robotics & AI Lab Terminal', x: -126, y: 0, z: -550 },
  { id: 'sc_term_factory', label: 'Factory Automation Console', x: -120, y: 0, z: -589 },
  { id: 'sc_term_drone_tower', label: 'Drone Fleet Command Desk', x: -64, y: 0, z: -522 },
  { id: 'sc_term_plaza', label: 'Smart City Command Kiosk', x: -104, y: 0, z: -474 },
];

export const SMART_CITY_REPAIR_STATIONS: ReadonlyArray<{
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
}> = [
  { id: 'sc_repair_entry', label: 'Dome Entry Repair & Restore Bay', x: -107, y: 0, z: -482 },
  { id: 'sc_repair_lab', label: 'Central Robotics Service Bay', x: -138, y: 0, z: -542 },
];

// 30 Distinct Specialized Autonomous Robots consolidated cleanly inside the Glass Dome!
export const ROBOT_ROLE_CATALOG: ReadonlyArray<RobotRoleSpec> = [
  {
    id: 'planting_robot',
    index: 1,
    label: 'Planting Robot',
    sector: 'farming',
    visualKind: 'humanoid',
    bodyHex: 0xf8fafc,
    accentHex: 0x22d3ee,
    baseSpeed: 1.65,
    waypoints: [
      { x: -196, z: -504 },
      { x: -218, z: -504 },
      { x: -218, z: -518 },
      { x: -196, z: -518 },
    ],
  },
  {
    id: 'harvesting_robot',
    index: 2,
    label: 'Harvesting Robot',
    sector: 'farming',
    visualKind: 'rover_arm',
    bodyHex: 0xf1f5f9,
    accentHex: 0x10b981,
    baseSpeed: 1.85,
    waypoints: [
      { x: -200, z: -498 },
      { x: -222, z: -498 },
      { x: -222, z: -524 },
      { x: -200, z: -524 },
    ],
  },
  {
    id: 'watering_robot',
    index: 3,
    label: 'Watering Arm Robot',
    sector: 'farming',
    visualKind: 'rover_arm',
    bodyHex: 0xffffff,
    accentHex: 0x06b6d4,
    baseSpeed: 1.35,
    waypoints: [
      { x: -158, z: -454 },
      { x: -148, z: -454 },
      { x: -148, z: -460 },
      { x: -158, z: -460 },
    ],
  },
  {
    id: 'soil_testing_robot',
    index: 4,
    label: 'Soil Testing Robot',
    sector: 'farming',
    visualKind: 'rover_camera',
    bodyHex: 0xe2e8f0,
    accentHex: 0x14b8a6,
    baseSpeed: 1.7,
    waypoints: [
      { x: -194, z: -530 },
      { x: -220, z: -530 },
      { x: -220, z: -544 },
      { x: -194, z: -544 },
    ],
  },
  {
    id: 'crop_inspection_robot',
    index: 5,
    label: 'Crop Inspection Rover',
    sector: 'farming',
    visualKind: 'rover_camera',
    bodyHex: 0xf8fafc,
    accentHex: 0x38bdf8,
    baseSpeed: 1.95,
    waypoints: [
      { x: -196, z: -508 },
      { x: -224, z: -508 },
      { x: -224, z: -522 },
      { x: -196, z: -522 },
    ],
  },
  {
    id: 'greenhouse_maintenance_robot',
    index: 6,
    label: 'Greenhouse Care Bot',
    sector: 'farming',
    visualKind: 'rover_arm',
    bodyHex: 0xf1f5f9,
    accentHex: 0xa855f7,
    baseSpeed: 1.4,
    waypoints: [
      { x: -192, z: -475 },
      { x: -180, z: -475 },
      { x: -180, z: -482 },
      { x: -192, z: -482 },
    ],
  },
  {
    id: 'delivery_robot',
    index: 7,
    label: 'Autonomous Delivery Bot',
    sector: 'city',
    visualKind: 'utility_box',
    bodyHex: 0xffffff,
    accentHex: 0x2563eb,
    baseSpeed: 2.9,
    waypoints: [
      { x: -114, z: -464 },
      { x: -146, z: -492 },
      { x: -180, z: -536 },
      { x: -146, z: -492 },
    ],
  },
  {
    id: 'cleaning_robot',
    index: 8,
    label: 'Street Cleaning Bot',
    sector: 'city',
    visualKind: 'utility_box',
    bodyHex: 0xe2e8f0,
    accentHex: 0x0ea5e9,
    baseSpeed: 2.2,
    waypoints: [
      { x: -172, z: -586 },
      { x: -146, z: -616 },
      { x: -142, z: -608 },
      { x: -168, z: -582 },
    ],
  },
  {
    id: 'security_patrol_robot',
    index: 9,
    label: 'Security Patrol Robot',
    sector: 'city',
    visualKind: 'humanoid',
    bodyHex: 0x1e293b,
    accentHex: 0x38bdf8,
    baseSpeed: 2.45,
    waypoints: [
      { x: -106, z: -446 },
      { x: -102, z: -498 },
      { x: -136, z: -504 },
      { x: -116, z: -460 },
    ],
  },
  {
    id: 'construction_robot',
    index: 10,
    label: 'Construction Bot',
    sector: 'city',
    visualKind: 'heavy_loader',
    bodyHex: 0xf59e0b,
    accentHex: 0x1e293b,
    baseSpeed: 1.5,
    waypoints: [
      { x: -98, z: -540 },
      { x: -72, z: -540 },
      { x: -72, z: -548 },
      { x: -98, z: -548 },
    ],
  },
  {
    id: 'road_maintenance_robot',
    index: 11,
    label: 'Road Maintenance Bot',
    sector: 'city',
    visualKind: 'utility_box',
    bodyHex: 0xf97316,
    accentHex: 0xf8fafc,
    baseSpeed: 2.1,
    waypoints: [
      { x: -146, z: -620 },
      { x: -146, z: -650 },
      { x: -142, z: -650 },
      { x: -142, z: -620 },
    ],
  },
  {
    id: 'warehouse_robot',
    index: 12,
    label: 'Warehouse AGV Robot',
    sector: 'factory',
    visualKind: 'utility_box',
    bodyHex: 0xf8fafc,
    accentHex: 0xf59e0b,
    baseSpeed: 2.65,
    waypoints: [
      { x: -96, z: -582 },
      { x: -78, z: -582 },
      { x: -78, z: -574 },
      { x: -96, z: -574 },
    ],
  },
  {
    id: 'research_lab_robot',
    index: 13,
    label: 'Research Lab Bot',
    sector: 'lab',
    visualKind: 'humanoid',
    bodyHex: 0xffffff,
    accentHex: 0x38bdf8,
    baseSpeed: 1.55,
    waypoints: [
      { x: -132, z: -556 },
      { x: -120, z: -556 },
      { x: -120, z: -566 },
      { x: -132, z: -566 },
    ],
  },
  {
    id: 'transport_robot',
    index: 14,
    label: 'Transport Carrier Bot',
    sector: 'factory',
    visualKind: 'heavy_loader',
    bodyHex: 0xe2e8f0,
    accentHex: 0x0284c7,
    baseSpeed: 2.5,
    waypoints: [
      { x: -136, z: -582 },
      { x: -102, z: -582 },
      { x: -102, z: -590 },
      { x: -136, z: -590 },
    ],
  },
  {
    id: 'gardening_robot',
    index: 15,
    label: 'Park Gardening Bot',
    sector: 'city',
    visualKind: 'rover_arm',
    bodyHex: 0xf1f5f9,
    accentHex: 0x16a34a,
    baseSpeed: 1.65,
    waypoints: [
      { x: -112, z: -480 },
      { x: -96, z: -480 },
      { x: -96, z: -496 },
      { x: -112, z: -496 },
    ],
  },
  {
    id: 'tree_maintenance_robot',
    index: 16,
    label: 'Tree Care Bot',
    sector: 'farming',
    visualKind: 'rover_arm',
    bodyHex: 0xf8fafc,
    accentHex: 0x22c55e,
    baseSpeed: 1.5,
    waypoints: [
      { x: -168, z: -474 },
      { x: -140, z: -474 },
      { x: -140, z: -468 },
      { x: -168, z: -468 },
    ],
  },
  {
    id: 'recycling_robot',
    index: 17,
    label: 'AI Recycling Sorter Bot',
    sector: 'factory',
    visualKind: 'heavy_loader',
    bodyHex: 0xd1fae5,
    accentHex: 0x059669,
    baseSpeed: 1.9,
    waypoints: [
      { x: -126, z: -616 },
      { x: -108, z: -616 },
      { x: -108, z: -620 },
      { x: -126, z: -620 },
    ],
  },
  {
    id: 'ag_monitoring_robot',
    index: 18,
    label: 'Ag Sensor Monitor Bot',
    sector: 'farming',
    visualKind: 'rover_camera',
    bodyHex: 0xffffff,
    accentHex: 0x0ea5e9,
    baseSpeed: 1.85,
    waypoints: [
      { x: -206, z: -556 },
      { x: -222, z: -556 },
      { x: -222, z: -568 },
      { x: -206, z: -568 },
    ],
  },
  {
    id: 'autonomous_assistant_robot',
    index: 19,
    label: 'Smart Assistant Bot',
    sector: 'lab',
    visualKind: 'assistant',
    bodyHex: 0xffffff,
    accentHex: 0x22d3ee,
    baseSpeed: 1.55,
    waypoints: [
      { x: -118, z: -536 },
      { x: -106, z: -536 },
      { x: -106, z: -544 },
      { x: -118, z: -544 },
    ],
  },
  {
    id: 'humanoid_robot',
    index: 20,
    label: 'Autonomous Humanoid',
    sector: 'lab',
    visualKind: 'humanoid',
    bodyHex: 0xf8fafc,
    accentHex: 0x00e5ff,
    baseSpeed: 1.75,
    waypoints: [
      { x: -140, z: -528 },
      { x: -140, z: -548 },
      { x: -148, z: -548 },
      { x: -148, z: -528 },
    ],
  },
  {
    id: 'cargo_loader_robot',
    index: 21,
    label: 'Heavy Cargo Loader Bot',
    sector: 'factory',
    visualKind: 'heavy_loader',
    bodyHex: 0xe2e8f0,
    accentHex: 0xea580c,
    baseSpeed: 2.0,
    waypoints: [
      { x: -130, z: -588 },
      { x: -110, z: -588 },
      { x: -110, z: -592 },
      { x: -130, z: -592 },
    ],
  },
  {
    id: 'emergency_response_robot',
    index: 22,
    label: 'Emergency Response Bot',
    sector: 'energy',
    visualKind: 'utility_box',
    bodyHex: 0xf8fafc,
    accentHex: 0xef4444,
    baseSpeed: 3.1,
    waypoints: [
      { x: -72, z: -514 },
      { x: -72, z: -568 },
      { x: -58, z: -568 },
      { x: -58, z: -514 },
    ],
  },
  // 8 Newly Deployed Smart Dome Expansion Robots (#23..#30)
  {
    id: 'solar_panel_cleaner_bot',
    index: 23,
    label: 'Solar Collector Sweeper Bot',
    sector: 'energy',
    visualKind: 'rover_arm',
    bodyHex: 0xf8fafc,
    accentHex: 0xfacc15,
    baseSpeed: 1.7,
    waypoints: [
      { x: -78, z: -574 },
      { x: -56, z: -574 },
      { x: -56, z: -604 },
      { x: -78, z: -604 },
    ],
  },
  {
    id: 'dome_structural_inspector_bot',
    index: 24,
    label: 'Dome Optics Inspector Bot',
    sector: 'lab',
    visualKind: 'rover_camera',
    bodyHex: 0xe2e8f0,
    accentHex: 0x38bdf8,
    baseSpeed: 2.0,
    waypoints: [
      { x: -102, z: -454 },
      { x: -76, z: -468 },
      { x: -64, z: -504 },
      { x: -86, z: -462 },
    ],
  },
  {
    id: 'medical_aid_robot',
    index: 25,
    label: 'Med-Bay Triage Humanoid',
    sector: 'city',
    visualKind: 'humanoid',
    bodyHex: 0xffffff,
    accentHex: 0xf43f5e,
    baseSpeed: 2.1,
    waypoints: [
      { x: -104, z: -504 },
      { x: -86, z: -504 },
      { x: -86, z: -474 },
      { x: -104, z: -474 },
    ],
  },
  {
    id: 'hydroponic_pollinator_bot',
    index: 26,
    label: 'Hydroponic Bio-Assistant',
    sector: 'farming',
    visualKind: 'assistant',
    bodyHex: 0xf8fafc,
    accentHex: 0x4ade80,
    baseSpeed: 1.65,
    waypoints: [
      { x: -194, z: -574 },
      { x: -206, z: -574 },
      { x: -206, z: -592 },
      { x: -194, z: -592 },
    ],
  },
  {
    id: 'heavy_welding_bot',
    index: 27,
    label: 'Heavy Assembly Welder Bot',
    sector: 'factory',
    visualKind: 'heavy_loader',
    bodyHex: 0xf59e0b,
    accentHex: 0x38bdf8,
    baseSpeed: 1.75,
    waypoints: [
      { x: -134, z: -612 },
      { x: -104, z: -612 },
      { x: -104, z: -616 },
      { x: -134, z: -616 },
    ],
  },
  {
    id: 'autonomous_forklift_bot',
    index: 28,
    label: 'Smart Warehouse Forklift',
    sector: 'factory',
    visualKind: 'heavy_loader',
    bodyHex: 0xf97316,
    accentHex: 0x0f172a,
    baseSpeed: 2.35,
    waypoints: [
      { x: -100, z: -582 },
      { x: -100, z: -604 },
      { x: -96, z: -604 },
      { x: -96, z: -582 },
    ],
  },
  {
    id: 'security_sentinel_alpha',
    index: 29,
    label: 'Gate Defense Sentinel Unit',
    sector: 'city',
    visualKind: 'humanoid',
    bodyHex: 0x0f172a,
    accentHex: 0xef4444,
    baseSpeed: 2.3,
    waypoints: [
      { x: -156, z: -644 },
      { x: -136, z: -644 },
      { x: -136, z: -654 },
      { x: -156, z: -654 },
    ],
  },
  {
    id: 'nano_harvester_bot',
    index: 30,
    label: 'Precision Ag Harvester Bot',
    sector: 'farming',
    visualKind: 'rover_arm',
    bodyHex: 0xe2e8f0,
    accentHex: 0x22c55e,
    baseSpeed: 1.8,
    waypoints: [
      { x: -178, z: -492 },
      { x: -194, z: -492 },
      { x: -194, z: -512 },
      { x: -178, z: -512 },
    ],
  },
];

// 18 Autonomous Drones safely orbiting INSIDE the giant Glass Dome (radius <= 116m, height <= 74m)
export const DRONE_FLEET_CATALOG: ReadonlyArray<DroneUnitSpec> = [
  {
    id: 'drone_ag_spray_1',
    archetype: 'ag_spraying',
    label: 'Ag Spray Drone Alpha',
    style: 'sprayer_white',
    padX: -66,
    padZ: -532,
    centerX: -206,
    centerZ: -512,
    radiusX: 16,
    radiusZ: 14,
    cruiseY: 4.0,
    speedRad: 0.52,
    phaseOffset: 0.0,
    hasMist: true,
  },
  {
    id: 'drone_ag_spray_2',
    archetype: 'ag_spraying',
    label: 'Ag Spray Drone Beta',
    style: 'sprayer_white',
    padX: -60,
    padZ: -532,
    centerX: -162,
    centerZ: -464,
    radiusX: 18,
    radiusZ: 12,
    cruiseY: 4.8,
    speedRad: 0.46,
    phaseOffset: 2.1,
    hasMist: true,
  },
  {
    id: 'drone_ag_spray_3',
    archetype: 'ag_spraying',
    label: 'Ag Spray Drone Gamma',
    style: 'sprayer_white',
    padX: -54,
    padZ: -532,
    centerX: -188,
    centerZ: -486,
    radiusX: 14,
    radiusZ: 14,
    cruiseY: 5.5,
    speedRad: 0.49,
    phaseOffset: 4.0,
    hasMist: true,
  },
  {
    id: 'drone_crop_mon_1',
    archetype: 'crop_monitoring',
    label: 'Crop Optic Drone 1',
    style: 'phantom_cam',
    padX: -66,
    padZ: -539,
    centerX: -205,
    centerZ: -550,
    radiusX: 18,
    radiusZ: 18,
    cruiseY: 7.4,
    speedRad: 0.56,
    phaseOffset: 1.0,
    hasMist: false,
  },
  {
    id: 'drone_crop_mon_2',
    archetype: 'crop_monitoring',
    label: 'Crop Optic Drone 2',
    style: 'phantom_cam',
    padX: -60,
    padZ: -539,
    centerX: -178,
    centerZ: -598,
    radiusX: 20,
    radiusZ: 16,
    cruiseY: 8.6,
    speedRad: 0.5,
    phaseOffset: 3.4,
    hasMist: false,
  },
  {
    id: 'drone_seed_dist_1',
    archetype: 'seed_distribution',
    label: 'Seed Seeder Drone 1',
    style: 'sprayer_white',
    padX: -54,
    padZ: -539,
    centerX: -190,
    centerZ: -518,
    radiusX: 22,
    radiusZ: 18,
    cruiseY: 6.0,
    speedRad: 0.42,
    phaseOffset: 0.7,
    hasMist: true,
  },
  {
    id: 'drone_seed_dist_2',
    archetype: 'seed_distribution',
    label: 'Seed Seeder Drone 2',
    style: 'sprayer_white',
    padX: -48,
    padZ: -539,
    centerX: -168,
    centerZ: -504,
    radiusX: 20,
    radiusZ: 16,
    cruiseY: 6.8,
    speedRad: 0.45,
    phaseOffset: 2.9,
    hasMist: true,
  },
  {
    id: 'drone_greenhouse_1',
    archetype: 'greenhouse_inspection',
    label: 'Greenhouse Scanner 1',
    style: 'phantom_cam',
    padX: -66,
    padZ: -546,
    centerX: -166,
    centerZ: -468,
    radiusX: 26,
    radiusZ: 16,
    cruiseY: 9.8,
    speedRad: 0.48,
    phaseOffset: 2.6,
    hasMist: false,
  },
  {
    id: 'drone_greenhouse_2',
    archetype: 'greenhouse_inspection',
    label: 'Greenhouse Scanner 2',
    style: 'phantom_cam',
    padX: -60,
    padZ: -546,
    centerX: -206,
    centerZ: -566,
    radiusX: 16,
    radiusZ: 20,
    cruiseY: 10.6,
    speedRad: 0.44,
    phaseOffset: 5.1,
    hasMist: false,
  },
  {
    id: 'drone_security_1',
    archetype: 'security_surveillance',
    label: 'City Sentinel Drone 1',
    style: 'security_dark',
    padX: -54,
    padZ: -546,
    centerX: -146,
    centerZ: -542,
    radiusX: 52,
    radiusZ: 48,
    cruiseY: 16.5,
    speedRad: 0.36,
    phaseOffset: 0.3,
    hasMist: false,
  },
  {
    id: 'drone_security_2',
    archetype: 'security_surveillance',
    label: 'City Sentinel Drone 2',
    style: 'security_dark',
    padX: -48,
    padZ: -546,
    centerX: -146,
    centerZ: -542,
    radiusX: 48,
    radiusZ: 52,
    cruiseY: 18.2,
    speedRad: 0.33,
    phaseOffset: 3.5,
    hasMist: false,
  },
  {
    id: 'drone_security_3',
    archetype: 'security_surveillance',
    label: 'Gate Watch Sentinel',
    style: 'security_dark',
    padX: -66,
    padZ: -553,
    centerX: -124,
    centerZ: -486,
    radiusX: 26,
    radiusZ: 26,
    cruiseY: 13.5,
    speedRad: 0.42,
    phaseOffset: 1.8,
    hasMist: false,
  },
  {
    id: 'drone_delivery_1',
    archetype: 'delivery_drone',
    label: 'Express Parcel Drone 1',
    style: 'cargo_white',
    padX: -60,
    padZ: -553,
    centerX: -134,
    centerZ: -548,
    radiusX: 42,
    radiusZ: 38,
    cruiseY: 15.0,
    speedRad: 0.34,
    phaseOffset: 1.4,
    hasMist: false,
  },
  {
    id: 'drone_delivery_2',
    archetype: 'delivery_drone',
    label: 'Express Parcel Drone 2',
    style: 'cargo_white',
    padX: -54,
    padZ: -553,
    centerX: -130,
    centerZ: -564,
    radiusX: 44,
    radiusZ: 34,
    cruiseY: 17.5,
    speedRad: 0.31,
    phaseOffset: 4.1,
    hasMist: false,
  },
  {
    id: 'drone_delivery_3',
    archetype: 'delivery_drone',
    label: 'Express Parcel Drone 3',
    style: 'cargo_white',
    padX: -48,
    padZ: -553,
    centerX: -112,
    centerZ: -522,
    radiusX: 30,
    radiusZ: 28,
    cruiseY: 14.2,
    speedRad: 0.38,
    phaseOffset: 0.5,
    hasMist: false,
  },
  {
    id: 'drone_mapping_1',
    archetype: 'aerial_mapping',
    label: 'Aerial LiDAR Mapper 1',
    style: 'phantom_cam',
    padX: -66,
    padZ: -560,
    centerX: -146,
    centerZ: -542,
    radiusX: 56,
    radiusZ: 56,
    cruiseY: 21.0,
    speedRad: 0.25,
    phaseOffset: 2.2,
    hasMist: false,
  },
  {
    id: 'drone_mapping_2',
    archetype: 'aerial_mapping',
    label: 'Aerial LiDAR Mapper 2',
    style: 'phantom_cam',
    padX: -60,
    padZ: -560,
    centerX: -146,
    centerZ: -542,
    radiusX: 50,
    radiusZ: 50,
    cruiseY: 22.8,
    speedRad: 0.28,
    phaseOffset: 5.0,
    hasMist: false,
  },
  {
    id: 'drone_mapping_3',
    archetype: 'aerial_mapping',
    label: 'Aerial Dome Thermal Scan',
    style: 'phantom_cam',
    padX: -54,
    padZ: -560,
    centerX: -146,
    centerZ: -542,
    radiusX: 38,
    radiusZ: 38,
    cruiseY: 25.0,
    speedRad: 0.31,
    phaseOffset: 3.7,
    hasMist: false,
  },
];

export const SMART_CITY_POIS = [
  {
    id: 'sim_smart_plaza',
    name: 'Glass Dome Gate 1 & Smart City Plaza',
    shortName: 'Smart City Dome',
    subtitle: 'Automatic Dome Gate, 3D Marble Arches, Nexus HQ & Live Charts beside Garage',
    x: -94,
    z: -420,
    viewYaw: 0.38,
    kind: 'town' as const,
  },
  {
    id: 'sim_smart_greenhouse',
    name: 'AI Automated Farming & Solar Greenhouses',
    shortName: 'AI Greenhouses',
    subtitle: 'Walk-in Solar Glass Greenhouses, Spraying Arm Robots, Drip Sensors & Crop Fields',
    x: -162,
    z: -480,
    viewYaw: 0,
    kind: 'landmark' as const,
  },
  {
    id: 'sim_smart_hydro_lab',
    name: 'AI Farm Vertical Hydroponics & Water Plant',
    shortName: 'Hydro AI Farm',
    subtitle: 'Multi-Tier AI FARM Racks, Hydroponic Sky-Towers & Aqua Recycling Plant',
    x: -194,
    z: -562,
    viewYaw: 1.2,
    kind: 'town' as const,
  },
  {
    id: 'sim_smart_robotics_lab',
    name: 'AI & Robotics Research Laboratory',
    shortName: 'AI Robotics Lab',
    subtitle: 'Humanoid Bench, Articulated Robotic Arms, Tech University & Repair Bay',
    x: -130,
    z: -542,
    viewYaw: 0.65,
    kind: 'base' as const,
  },
  {
    id: 'sim_smart_factory',
    name: 'Autonomous Factories & Recycling Hub',
    shortName: 'Smart Factory',
    subtitle: 'Robotic Assembly Conveyor, Smart Warehouse Logistics & AI Recycling Facility',
    x: -134,
    z: -604,
    viewYaw: -1.5,
    kind: 'depot' as const,
  },
  {
    id: 'sim_smart_drones',
    name: 'Drone Control Tower & Renewable Grid',
    shortName: 'Drone & Wind Hub',
    subtitle: '18 Autonomous Drones, Charging Pads, Solar Array, Wind Turbines & Gate 2',
    x: -72,
    z: -540,
    viewYaw: 0,
    kind: 'landmark' as const,
  },
] as const;

export function isInsideSmartCityDome(x: number, z: number, pad = 0): boolean {
  const dx = x - SMART_CITY_DOME.centerX;
  const dz = z - SMART_CITY_DOME.centerZ;
  const r = SMART_CITY_DOME.radius + pad;
  return dx * dx + dz * dz <= r * r;
}

export function getDomeCeilingHeightAt(x: number, z: number): number {
  const dx = x - SMART_CITY_DOME.centerX;
  const dz = z - SMART_CITY_DOME.centerZ;
  const rRatioSq = (dx * dx + dz * dz) / (SMART_CITY_DOME.radius * SMART_CITY_DOME.radius);
  if (rRatioSq >= 1) return 0;
  return SMART_CITY_DOME.height * Math.sqrt(Math.max(0, 1 - rRatioSq));
}

export function isInSmartCityZone(x: number, z: number): boolean {
  // Strictly exclude private Apex Mansion compound (x in [-88..88], z in [-435..-245])
  if (x >= -88 && x <= 88 && z >= -435 && z <= -245) return false;
  if (isInsideSmartCityDome(x, z, 6)) return true;
  // Include Gate 2 outer exit avenue & Mansion-Garage connector approach
  if (Math.abs(x - -146) <= 12 && z <= -650 && z >= -720) return true;
  return false;
}

export function getSmartCityDistrictAt(x: number, z: number): SmartCityDistrictName {
  const dx = x - SMART_CITY_DOME.centerX;
  const dz = z - SMART_CITY_DOME.centerZ;
  if (dx > 52 && dz > -75 && dz < 40) return 'Renewable Energy & Drone Hub';
  if (dz <= -45) {
    return dx < -22 ? 'Vertical Hydroponics & Soil Labs' : 'Autonomous Factories & Recycling';
  }
  return dx < -4 ? 'AI Automated Farming & Greenhouses' : 'Smart City Downtown & AI Labs';
}

function distSqToSegment2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) return (px - ax) * (px - ax) + (pz - az) * (pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq));
  const qx = ax + vx * t;
  const qz = az + vz * t;
  return (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
}

export function distanceToSingleSmartCityRoad(x: number, z: number): number {
  let minSq = Infinity;
  for (let i = 0; i < SMART_CITY_SINGLE_ROAD_POINTS.length - 1; i++) {
    const a = SMART_CITY_SINGLE_ROAD_POINTS[i];
    const b = SMART_CITY_SINGLE_ROAD_POINTS[i + 1];
    const dSq = distSqToSegment2D(x, z, a.x, a.z, b.x, b.z);
    if (dSq < minSq) minSq = dSq;
  }
  return Math.sqrt(minSq);
}

export function isOnSmartCityRoad(x: number, z: number): boolean {
  if (x < -266 || x > -24 || z < -720 || z > -304) return false;
  return distanceToSingleSmartCityRoad(x, z) <= 5.4;
}

export function getSmartCitySurfaceOffsetY(x: number, z: number): number {
  if (isOnSmartCityRoad(x, z)) return 0.22;
  // Walk-in concrete slab decks inside Dome: Greenhouses A/B, AI Farm Lab, Robotics Lab, Factory, Drone Plaza
  if (x >= -166 && x <= -142 && z >= -466 && z <= -446) return 0.12;
  if (x >= -198 && x <= -174 && z >= -488 && z <= -468) return 0.12;
  if (x >= -228 && x <= -204 && z >= -574 && z <= -550) return 0.12;
  if (x >= -139 && x <= -113 && z >= -573 && z <= -551) return 0.12;
  if (x >= -134 && x <= -106 && z >= -611 && z <= -589) return 0.12;
  if (x >= -72 && x <= -44 && z >= -558 && z <= -524) return 0.12;
  return 0;
}

function advanceRobotAlongWaypoints(
  agent: SmartCityAgentRuntime,
  spec: RobotRoleSpec,
  speedMul: number,
  dt: number,
): void {
  const pts = spec.waypoints;
  if (pts.length < 2) return;
  const effMul = speedMul * agent.damage.speedMultiplier;
  if (effMul <= 0.001) return;
  const targetIdx = (agent.waypointIdx + 1) % pts.length;
  const cur = pts[agent.waypointIdx];
  const nxt = pts[targetIdx];
  const dx = nxt.x - cur.x;
  const dz = nxt.z - cur.z;
  const segLen = Math.hypot(dx, dz) || 1;
  const distStep = spec.baseSpeed * effMul * dt;
  agent.progress += distStep / segLen;
  if (agent.progress >= 1) {
    agent.waypointIdx = targetIdx;
    agent.progress = agent.progress - Math.floor(agent.progress);
    const nCur = pts[agent.waypointIdx];
    const nNxt = pts[(agent.waypointIdx + 1) % pts.length];
    agent.x = nCur.x + (nNxt.x - nCur.x) * agent.progress;
    agent.z = nCur.z + (nNxt.z - nCur.z) * agent.progress;
    agent.yaw = Math.atan2(nNxt.x - nCur.x, nNxt.z - nCur.z);
  } else {
    agent.x = cur.x + dx * agent.progress;
    agent.z = cur.z + dz * agent.progress;
    agent.yaw = Math.atan2(dx, dz);
  }
  agent.workPhase += dt * (2.6 * effMul);
}

const MACHINE_SPECS: ReadonlyArray<{ id: string; label: string; archetype: string; maxHp: number }> = [
  { id: 'tractor_1', label: 'Autonomous Field Tractor', archetype: 'tractor', maxHp: 220 },
  { id: 'harvester_1', label: 'Automated Combine Harvester', archetype: 'harvester', maxHp: 260 },
  { id: 'lab_arm_1', label: 'AI Robotics Bench Arm', archetype: 'robotic_arm', maxHp: 130 },
  { id: 'factory_arm_0', label: 'Factory Assembly Arm 1', archetype: 'robotic_arm', maxHp: 140 },
  { id: 'factory_arm_1', label: 'Factory Assembly Arm 2', archetype: 'robotic_arm', maxHp: 140 },
  { id: 'factory_arm_2', label: 'Factory Assembly Arm 3', archetype: 'robotic_arm', maxHp: 140 },
  { id: 'factory_arm_3', label: 'Factory Assembly Arm 4', archetype: 'robotic_arm', maxHp: 140 },
  { id: 'shuttle_0', label: 'Autonomous Electric Shuttle A', archetype: 'shuttle', maxHp: 240 },
  { id: 'shuttle_1', label: 'Autonomous Electric Shuttle B', archetype: 'shuttle', maxHp: 240 },
  { id: 'shuttle_2', label: 'Autonomous Electric Shuttle C', archetype: 'shuttle', maxHp: 240 },
];

export function createInitialSmartCityState(): SmartCitySimulationState {
  const robots: SmartCityAgentRuntime[] = ROBOT_ROLE_CATALOG.map((spec) => {
    const p0 = spec.waypoints[0];
    const p1 = spec.waypoints[1] ?? p0;
    const maxHp =
      spec.visualKind === 'heavy_loader' ? 175 : spec.visualKind === 'utility_box' ? 140 : 120;
    return {
      roleId: spec.id,
      x: p0.x,
      z: p0.z,
      yaw: Math.atan2(p1.x - p0.x, p1.z - p0.z),
      waypointIdx: 0,
      progress: 0,
      workPhase: spec.index * 0.45,
      active: true,
      damage: createDestructibleEntity(spec.id, spec.label, 'robot', spec.visualKind, maxHp),
    };
  });

  const drones: SmartCityDroneRuntime[] = DRONE_FLEET_CATALOG.map((d) => ({
    id: d.id,
    archetype: d.archetype,
    x: d.centerX + Math.cos(d.phaseOffset) * d.radiusX,
    y: d.cruiseY,
    z: d.centerZ + Math.sin(d.phaseOffset) * d.radiusZ,
    yaw: d.phaseOffset + Math.PI * 0.5,
    angle: d.phaseOffset,
    deployFactor: 1,
    batteryPct: 86,
    spraying: d.hasMist,
    damage: createDestructibleEntity(d.id, d.label, 'drone', d.archetype, 95),
  }));

  const machines: DestructibleEntityState[] = MACHINE_SPECS.map((m) =>
    createDestructibleEntity(m.id, m.label, 'machine', m.archetype, m.maxHp),
  );

  const state: SmartCitySimulationState = {
    irrigationMode: 'auto',
    droneFleetMode: 'active',
    robotWorkMode: 'standard',
    factoryActive: true,
    securityAlert: false,
    researchBoost: false,
    harvestTriggerCount: 0,
    cropGrowthStage: 0.72,
    simTimeSec: 0,
    robots,
    drones,
    machines,
    telemetry: {
      robotsOperating: robots.length,
      robotsTotal: robots.length,
      robotsDamaged: 0,
      robotsDestroyed: 0,
      activeDrones: drones.length,
      dronesTotal: drones.length,
      dronesDamaged: 0,
      dronesDestroyed: 0,
      machinesTotal: machines.length,
      machinesDamaged: 0,
      farmingProductionTons: 148,
      harvestedCrates: 412,
      cropHealthPct: 96,
      soilMoisturePct: 68,
      waterConsumptionLpm: 240,
      waterRecycledPct: 88,
      electricitySolarMw: 46,
      electricityWindMw: 38,
      electricityTotalMw: 84,
      electricityDemandMw: 54,
      factoryProductionUnits: 640,
      cityPopulation: 4820,
      securityStatus: 'NOMINAL',
      securityCoveragePct: 98,
      researchProgressPct: 74,
      researchProjectsActive: 14,
    },
  };
  return state;
}

export function repairAllSmartCityUnits(state: SmartCitySimulationState): number {
  let repaired = 0;
  for (let i = 0; i < state.robots.length; i++) {
    const r = state.robots[i];
    if (r.damage.stage > 0) repaired++;
    repairDestructibleEntity(r.damage);
    r.active = true;
  }
  for (let i = 0; i < state.drones.length; i++) {
    const d = state.drones[i];
    if (d.damage.stage > 0) repaired++;
    repairDestructibleEntity(d.damage);
    const spec = DRONE_FLEET_CATALOG[i];
    if (spec) {
      d.x = spec.centerX + Math.cos(d.angle) * spec.radiusX;
      d.z = spec.centerZ + Math.sin(d.angle) * spec.radiusZ;
      d.y = spec.cruiseY;
    }
  }
  for (let i = 0; i < state.machines.length; i++) {
    if (state.machines[i].stage > 0) repaired++;
    repairDestructibleEntity(state.machines[i]);
  }
  recomputeTelemetry(state, 0.85);
  return repaired;
}

export function damageSmartCityTarget(
  state: SmartCitySimulationState,
  kind: 'robot' | 'drone' | 'machine',
  index: number,
  weaponId: string,
  baseDamage: number,
  component: SmartCityComponentKind,
  dirX = 0,
  dirZ = 1,
): BulletHitOutcome | null {
  let entity: DestructibleEntityState | undefined;
  if (kind === 'robot') {
    entity = state.robots[index]?.damage;
  } else if (kind === 'drone') {
    entity = state.drones[index]?.damage;
  } else if (kind === 'machine') {
    entity = state.machines[index];
  }
  if (!entity) return null;
  const out = applyBulletDamage(entity, weaponId, baseDamage, component, dirX, dirZ);
  if (kind === 'robot' && entity.disabled) {
    state.robots[index].active = false;
  }
  recomputeTelemetry(state, 0.85);
  return out;
}

export function applySmartCityCommand(
  state: SmartCitySimulationState,
  cmd: SmartCityCommand,
): void {
  switch (cmd.type) {
    case 'set_irrigation':
      state.irrigationMode = cmd.mode;
      break;
    case 'set_drones':
      state.droneFleetMode = cmd.mode;
      break;
    case 'set_robots':
      state.robotWorkMode = cmd.mode;
      break;
    case 'toggle_factory':
      state.factoryActive = cmd.active !== undefined ? cmd.active : !state.factoryActive;
      break;
    case 'toggle_security':
      state.securityAlert = cmd.alert !== undefined ? cmd.alert : !state.securityAlert;
      break;
    case 'toggle_research_boost':
      state.researchBoost = cmd.boost !== undefined ? cmd.boost : !state.researchBoost;
      break;
    case 'trigger_harvest':
      state.harvestTriggerCount += 1;
      state.cropGrowthStage = 0.28;
      state.telemetry.harvestedCrates += 24;
      state.telemetry.farmingProductionTons += 6;
      break;
    case 'repair_all':
      repairAllSmartCityUnits(state);
      break;
  }
  recomputeTelemetry(state, 0.85);
}

function recomputeTelemetry(state: SmartCitySimulationState, daylightFactor: number): void {
  let robotsOperating = 0;
  let robotsDamaged = 0;
  let robotsDestroyed = 0;
  for (let i = 0; i < state.robots.length; i++) {
    const r = state.robots[i];
    if (r.active && !r.damage.disabled) robotsOperating++;
    if (r.damage.destroyed || r.damage.disabled) robotsDestroyed++;
    else if (r.damage.stage > 0) robotsDamaged++;
  }

  let activeDrones = 0;
  let dronesDamaged = 0;
  let dronesDestroyed = 0;
  for (let i = 0; i < state.drones.length; i++) {
    const d = state.drones[i];
    if (d.damage.droneFlightState === 'crashed' || d.damage.destroyed) {
      dronesDestroyed++;
    } else if (d.damage.stage > 0 || d.damage.droneFlightState !== 'flying') {
      dronesDamaged++;
      if (d.deployFactor > 0.25 && d.damage.droneFlightState !== 'crashing') activeDrones++;
    } else if (d.deployFactor > 0.25) {
      activeDrones++;
    }
  }

  let machinesDamaged = 0;
  for (let i = 0; i < state.machines.length; i++) {
    if (state.machines[i].stage > 0) machinesDamaged++;
  }

  const irrWater =
    state.irrigationMode === 'boost' ? 360 : state.irrigationMode === 'conserve' ? 145 : 240;
  const moistureTarget =
    state.irrigationMode === 'boost' ? 84 : state.irrigationMode === 'conserve' ? 54 : 69;

  const sunFactor = Math.max(0.18, Math.min(1, daylightFactor));
  const solarMw = Math.round(16 + sunFactor * 38); // Glass Dome Solar Array boost
  const windMw = Math.round(34 + Math.sin(state.simTimeSec * 0.25) * 6);
  const totalMw = solarMw + windMw;
  const demandMw = Math.round(
    34 +
      (state.factoryActive ? 14 : 3) +
      (state.robotWorkMode === 'overdrive' ? 9 : state.robotWorkMode === 'eco' ? 2 : 5) +
      (state.researchBoost ? 6 : 2),
  );

  const robotBonus =
    (state.robotWorkMode === 'overdrive' ? 1.25 : state.robotWorkMode === 'eco' ? 0.8 : 1.0) *
    (robotsOperating / Math.max(1, state.robots.length));

  state.telemetry.robotsOperating = robotsOperating;
  state.telemetry.robotsTotal = state.robots.length;
  state.telemetry.robotsDamaged = robotsDamaged;
  state.telemetry.robotsDestroyed = robotsDestroyed;
  state.telemetry.activeDrones = activeDrones;
  state.telemetry.dronesTotal = state.drones.length;
  state.telemetry.dronesDamaged = dronesDamaged;
  state.telemetry.dronesDestroyed = dronesDestroyed;
  state.telemetry.machinesTotal = state.machines.length;
  state.telemetry.machinesDamaged = machinesDamaged;
  state.telemetry.soilMoisturePct = moistureTarget;
  state.telemetry.cropHealthPct = Math.min(
    100,
    Math.round(88 + (state.irrigationMode === 'conserve' ? 4 : 8) + (state.researchBoost ? 3 : 1)),
  );
  state.telemetry.waterConsumptionLpm = irrWater;
  state.telemetry.waterRecycledPct = state.irrigationMode === 'conserve' ? 94 : 88;
  state.telemetry.electricitySolarMw = solarMw;
  state.telemetry.electricityWindMw = windMw;
  state.telemetry.electricityTotalMw = totalMw;
  state.telemetry.electricityDemandMw = demandMw;
  state.telemetry.farmingProductionTons = Math.round(
    136 * Math.max(0.2, robotBonus) + state.harvestTriggerCount * 6 + state.cropGrowthStage * 22,
  );
  state.telemetry.factoryProductionUnits = state.factoryActive
    ? Math.round(620 * Math.max(0.25, robotBonus) + (state.simTimeSec * 0.4) % 120)
    : 0;
  state.telemetry.securityStatus =
    state.securityAlert || robotsDestroyed > 0 || dronesDestroyed > 0 ? 'HIGH ALERT' : 'NOMINAL';
  state.telemetry.securityCoveragePct = state.securityAlert ? 100 : activeDrones >= 10 ? 98 : 89;
  state.telemetry.researchProjectsActive = state.researchBoost ? 18 : 14;
  state.telemetry.researchProgressPct = Math.round(
    72 + ((state.simTimeSec * (state.researchBoost ? 0.9 : 0.35)) % 27),
  );
}

export interface SmartCityDynamicChartsData {
  energySeries: ReadonlyArray<{ label: string; valueMw: number; maxMw: number; hex: string }>;
  districtBars: ReadonlyArray<{ label: string; pct: number; hex: string }>;
  fleetIntegrityPct: number;
  trendPoints: number[]; // Normalized 0..1 wave samples derived deterministically from simTime
}

export function getSmartCityDynamicChartsData(
  state: SmartCitySimulationState,
): SmartCityDynamicChartsData {
  const t = state.telemetry;
  const totalFleet = Math.max(1, t.robotsTotal + t.dronesTotal + t.machinesTotal);
  const brokenFleet = t.robotsDestroyed + t.dronesDestroyed + t.machinesDamaged;
  const damagedPartial = t.robotsDamaged + t.dronesDamaged;
  const fleetIntegrityPct = Math.max(
    0,
    Math.round(((totalFleet - brokenFleet - damagedPartial * 0.45) / totalFleet) * 100),
  );

  const energySeries = [
    { label: 'SOLAR DOME', valueMw: t.electricitySolarMw, maxMw: 60, hex: '#facc15' },
    { label: 'WIND TURB', valueMw: t.electricityWindMw, maxMw: 60, hex: '#38bdf8' },
    { label: 'TOTAL GEN', valueMw: t.electricityTotalMw, maxMw: 100, hex: '#22c55e' },
    { label: 'CITY LOAD', valueMw: t.electricityDemandMw, maxMw: 100, hex: '#f97316' },
  ];

  const districtBars = [
    { label: 'AG YIELD', pct: t.cropHealthPct, hex: '#4ade80' },
    { label: 'WATER REC', pct: t.waterRecycledPct, hex: '#06b6d4' },
    {
      label: 'ROBOTS OK',
      pct: Math.round((t.robotsOperating / Math.max(1, t.robotsTotal)) * 100),
      hex: '#38bdf8',
    },
    {
      label: 'DRONES OK',
      pct: Math.round((t.activeDrones / Math.max(1, t.dronesTotal)) * 100),
      hex: '#a855f7',
    },
    { label: 'SECURITY', pct: t.securityCoveragePct, hex: '#f59e0b' },
  ];

  const trendPoints: number[] = [];
  for (let i = 0; i < 12; i++) {
    const phase = state.simTimeSec * 0.65 + i * 0.55;
    const base = 0.58 + (fleetIntegrityPct / 100) * 0.24;
    const val = Math.max(0.15, Math.min(0.98, base + Math.sin(phase) * 0.12 + Math.cos(phase * 0.5) * 0.06));
    trendPoints.push(val);
  }

  return { energySeries, districtBars, fleetIntegrityPct, trendPoints };
}

export function getStageStatusTag(stage: DestructionStage): string {
  switch (stage) {
    case 0:
      return 'ONLINE';
    case 1:
      return 'STAGE 1';
    case 2:
      return 'STAGE 2';
    case 3:
      return 'STAGE 3';
    case 4:
      return 'CRITICAL';
    case 5:
      return 'WRECKED';
  }
}

export function stepSmartCityState(
  state: SmartCitySimulationState,
  dt: number,
  daylightFactor = 0.85,
): void {
  if (dt <= 0) return;
  const clampedDt = Math.min(dt, 0.08);
  state.simTimeSec += clampedDt;

  // Advance crop growth cycle smoothly
  const growthSpeed =
    state.irrigationMode === 'boost' ? 0.016 : state.irrigationMode === 'conserve' ? 0.008 : 0.012;
  state.cropGrowthStage += clampedDt * growthSpeed;
  if (state.cropGrowthStage >= 1.0) {
    state.cropGrowthStage -= 1.0;
    state.telemetry.harvestedCrates += 12;
  }

  // Step all 30 robots
  const baseMul =
    state.robotWorkMode === 'overdrive' ? 1.55 : state.robotWorkMode === 'eco' ? 0.55 : 1.0;
  for (let i = 0; i < ROBOT_ROLE_CATALOG.length; i++) {
    const spec = ROBOT_ROLE_CATALOG[i];
    const agent = state.robots[i];
    if (agent.damage.flinchTimer > 0) {
      agent.damage.flinchTimer = Math.max(0, agent.damage.flinchTimer - clampedDt);
    }
    if (agent.damage.disabled || agent.damage.destroyed) {
      agent.active = false;
      agent.damage.wreckAgeSec += clampedDt;
      continue;
    }
    if (state.robotWorkMode === 'eco' && i % 5 === 4) {
      agent.active = false;
      continue;
    }
    if (!state.factoryActive && spec.sector === 'factory') {
      agent.active = false;
      continue;
    }
    agent.active = true;
    const roleMul =
      state.securityAlert && (spec.id === 'security_patrol_robot' || spec.id === 'security_sentinel_alpha')
        ? baseMul * 1.45
        : state.researchBoost && spec.sector === 'lab'
          ? baseMul * 1.3
          : baseMul;
    advanceRobotAlongWaypoints(agent, spec, roleMul, clampedDt);
  }

  // Step all 18 drones (except crashing/crashed ones which run crash physics in smartCityWorld)
  const targetDeploy = state.droneFleetMode === 'recall' ? 0 : 1;
  const speedScale = state.droneFleetMode === 'patrol' ? 1.35 : 1.0;
  for (let i = 0; i < DRONE_FLEET_CATALOG.length; i++) {
    const spec = DRONE_FLEET_CATALOG[i];
    const d = state.drones[i];
    if (d.damage.flinchTimer > 0) {
      d.damage.flinchTimer = Math.max(0, d.damage.flinchTimer - clampedDt);
    }
    if (d.damage.droneFlightState === 'crashing' || d.damage.droneFlightState === 'crashed') {
      d.spraying = false;
      if (d.damage.droneFlightState === 'crashed') {
        d.damage.wreckAgeSec += clampedDt;
      }
      continue;
    }

    const isSecurityInPatrol =
      state.droneFleetMode === 'patrol' &&
      (spec.archetype === 'security_surveillance' || spec.archetype === 'aerial_mapping');
    const unitDeploy =
      state.droneFleetMode === 'recall'
        ? 0
        : state.droneFleetMode === 'patrol' && !isSecurityInPatrol && i % 2 === 1
          ? 0
          : targetDeploy;

    const rate = clampedDt * 0.45;
    if (d.deployFactor < unitDeploy) d.deployFactor = Math.min(unitDeploy, d.deployFactor + rate);
    else if (d.deployFactor > unitDeploy) d.deployFactor = Math.max(unitDeploy, d.deployFactor - rate);

    const stabilitySpeed = d.damage.droneFlightState === 'wobbling' ? 0.68 : 1.0;
    if (d.deployFactor > 0.05) {
      d.angle += spec.speedRad * speedScale * stabilitySpeed * clampedDt * (0.4 + 0.6 * d.deployFactor);
      d.batteryPct = Math.max(32, d.batteryPct - clampedDt * 0.12);
    } else {
      d.batteryPct = Math.min(100, d.batteryPct + clampedDt * 2.5);
    }

    const orbitX = spec.centerX + Math.cos(d.angle) * spec.radiusX;
    const orbitZ = spec.centerZ + Math.sin(d.angle) * spec.radiusZ;
    const nextOrbitX = spec.centerX + Math.cos(d.angle + 0.05) * spec.radiusX;
    const nextOrbitZ = spec.centerZ + Math.sin(d.angle + 0.05) * spec.radiusZ;

    const t = d.deployFactor;
    const wobbleAmp = d.damage.droneFlightState === 'wobbling' ? 0.65 : 0.18;
    d.x = spec.padX + (orbitX - spec.padX) * t;
    d.z = spec.padZ + (orbitZ - spec.padZ) * t;
    d.y =
      0.45 +
      (spec.cruiseY - 0.45) * t +
      (t > 0.1 ? Math.sin(state.simTimeSec * (d.damage.droneFlightState === 'wobbling' ? 6.5 : 2.4) + i) * wobbleAmp * t : 0);
    d.yaw = Math.atan2(nextOrbitX - orbitX, nextOrbitZ - orbitZ);
    d.spraying = spec.hasMist && t > 0.72 && state.irrigationMode !== 'conserve' && d.damage.stage < 2;
  }

  for (let i = 0; i < state.machines.length; i++) {
    const m = state.machines[i];
    if (m.flinchTimer > 0) m.flinchTimer = Math.max(0, m.flinchTimer - clampedDt);
    if (m.disabled || m.destroyed) m.wreckAgeSec += clampedDt;
  }

  recomputeTelemetry(state, daylightFactor);
}

// =========================================================================
// 3 AUTONOMOUS PANORAMIC SCIENCE LIBRARY BUS ROUTES & 1 DOME-CLIMBING SKY-TRAIN
// =========================================================================

export interface ScienceBusRouteSpec {
  id: string;
  label: string;
  accentHex: number;
  speedMs: number;
  initialPhase: number;
  waypoints: ReadonlyArray<{ x: number; z: number }>;
}

export const SMART_CITY_BUS_ROUTES: ReadonlyArray<ScienceBusRouteSpec> = [
  {
    id: 'bus_smart_mansion',
    label: 'Sci-Library Bus 01 (Dome <-> Mansion)',
    accentHex: 0x22d3ee,
    speedMs: 8.6,
    initialPhase: 0.08,
    waypoints: [
      { x: -144.2, z: -616 },
      { x: -170.2, z: -586 },
      { x: -178.2, z: -536 },
      { x: -144.2, z: -492 },
      { x: -112.2, z: -464 },
      { x: -100.0, z: -435.5 },
      { x: -86.2, z: -398.5 },
      { x: -80.2, z: -388 },
      { x: -76.5, z: -316 },
      { x: -79.8, z: -316 },
      { x: -83.8, z: -388 },
      { x: -89.8, z: -397.5 },
      { x: -103.4, z: -434.1 },
      { x: -115.8, z: -464 },
      { x: -147.8, z: -492 },
      { x: -181.8, z: -536 },
      { x: -173.8, z: -586 },
      { x: -147.8, z: -616 },
      { x: -147.8, z: -658 },
      { x: -147.8, z: -708 },
      { x: -144.2, z: -708 },
      { x: -144.2, z: -658 },
    ],
  },
  {
    id: 'bus_central_city',
    label: 'Sci-Library Bus 02 (Central City)',
    accentHex: 0x38bdf8,
    speedMs: 11.4,
    initialPhase: 0.14,
    waypoints: [
      { x: -140, z: 140 },
      { x: 0, z: 140 },
      { x: 140, z: 140 },
      { x: 140, z: 0 },
      { x: 140, z: -140 },
      { x: 0, z: -140 },
      { x: -140, z: -140 },
      { x: -140, z: 0 },
    ],
  },
  {
    id: 'bus_bay_east',
    label: 'Sci-Library Bus 03 (Bay City East)',
    accentHex: 0x0ea5e9,
    speedMs: 11.0,
    initialPhase: 0.22,
    waypoints: [
      { x: 275, z: -140 },
      { x: 435, z: -140 },
      { x: 515, z: -140 },
      { x: 515, z: 0 },
      { x: 435, z: 0 },
      { x: 275, z: 0 },
    ],
  },
];

export const SMART_CITY_TRAIN_STATION = {
  id: 'smart_city_sky_station',
  name: 'NEXUS DOME SKY-TRAIN STATION',
  trackX: -150,
  platformX: -143.6,
  z: -524,
  deckY: 7.8,
  platformLength: 36,
  platformWidth: 6.2,
  dwellSeconds: 10.0,
  rideLapSeconds: 68.0,
} as const;

// Single closed 3D curve: elevated 7.8m over ground roads at the Dome Station (-150, 7.8, -524)
// so buses/cars pass cleanly underneath, climbs up through the upper Dome sky-portal onto & around
// the 74m Dome top crown (~79m), and descends smoothly back to the elevated station!
export const SMART_CITY_TRAIN_TRACK_POINTS: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x: -150, y: 7.8, z: -502 },
  { x: -150, y: 7.8, z: -524 }, // Elevated Station stop center
  { x: -150, y: 7.8, z: -546 },
  { x: -152, y: 12.2, z: -578 },
  { x: -142, y: 24.5, z: -604 },
  { x: -94, y: 42.5, z: -594 },
  { x: -76, y: 59.0, z: -542 }, // East exit through upper Dome ring
  { x: -106, y: 74.0, z: -496 },
  { x: -126, y: 79.2, z: -514 }, // Top of 74m Glass Dome
  { x: -172, y: 79.2, z: -522 }, // Apex West Crown
  { x: -178, y: 75.5, z: -562 },
  { x: -188, y: 60.5, z: -586 }, // West re-entry through upper Dome ring
  { x: -192, y: 36.5, z: -554 },
  { x: -178, y: 18.5, z: -504 },
  { x: -158, y: 9.2, z: -486 },
];

export function computePolylineLength2D(pts: ReadonlyArray<{ x: number; z: number }>): number {
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}

export function sampleClosedPolyline2D(
  pts: ReadonlyArray<{ x: number; z: number }>,
  distanceMeters: number,
  out: { x: number; z: number; yaw: number },
): void {
  const totalLen = computePolylineLength2D(pts);
  if (totalLen < 0.001 || pts.length < 2) {
    out.x = pts[0]?.x ?? 0;
    out.z = pts[0]?.z ?? 0;
    out.yaw = 0;
    return;
  }
  let rem = ((distanceMeters % totalLen) + totalLen) % totalLen;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segLen = Math.hypot(dx, dz) || 0.001;
    if (rem <= segLen || i === pts.length - 1) {
      const t = Math.max(0, Math.min(1, rem / segLen));
      out.x = a.x + dx * t;
      out.z = a.z + dz * t;
      out.yaw = Math.atan2(-dx, -dz); // Three.js -Z forward convention
      return;
    }
    rem -= segLen;
  }
}

export function computeTrainStationCycle(
  cycleTimeSec: number,
  dwellSeconds: number,
  rideLapSeconds: number,
  stationNormT: number,
): { splineT: number; stoppedAtStation: boolean; doorOpenTarget: number; countdownSec: number; speedScale: number } {
  const totalPeriod = dwellSeconds + rideLapSeconds;
  const localT = ((cycleTimeSec % totalPeriod) + totalPeriod) % totalPeriod;
  if (localT < dwellSeconds) {
    return {
      splineT: stationNormT,
      stoppedAtStation: true,
      doorOpenTarget: localT > 0.6 && localT < dwellSeconds - 0.8 ? 1 : 0,
      countdownSec: Math.max(0, Math.ceil(dwellSeconds - localT)),
      speedScale: 0,
    };
  }
  const moveElapsed = localT - dwellSeconds;
  const moveFrac = Math.max(0, Math.min(1, moveElapsed / rideLapSeconds));
  // Smooth ease-out departure & ease-in arrival at station
  const eased =
    moveFrac < 0.08
      ? (moveFrac * moveFrac) / (2 * 0.08 * (1 - 0.08))
      : moveFrac > 0.92
        ? 1 - ((1 - moveFrac) * (1 - moveFrac)) / (2 * 0.08 * (1 - 0.08))
        : (moveFrac - 0.04) / (1 - 0.08);
  const splineT = (stationNormT + eased) % 1;
  const arrivalRemaining = Math.max(0, Math.ceil(rideLapSeconds - moveElapsed));
  return {
    splineT,
    stoppedAtStation: false,
    doorOpenTarget: 0,
    countdownSec: arrivalRemaining,
    speedScale: moveFrac < 0.08 ? moveFrac / 0.08 : moveFrac > 0.92 ? (1 - moveFrac) / 0.08 : 1,
  };
}

