/**
 * Pure deterministic simulation, spatial bounds, catalogs, on-demand LOD/interior
 * loading logic, and NPC activity state machine for the Futuristic Science District
 * (Future Lab + Science Museum + 8 Animated Glass Domes) behind the Apex Garage Mansion
 * and beside Smart City.
 *
 * Strictly pure (zero DOM, zero Three.js, zero React) so it runs seamlessly in node:test
 * unit tests and with zero allocations in the 60fps Three.js game loop.
 */

export const SCIENCE_DISTRICT_BOUNDS = {
  minX: -16,
  maxX: 244,
  minZ: -692,
  maxZ: -454,
} as const;

export const FUTURE_LAB_BOUNDS = {
  centerX: 64,
  centerZ: -618,
  halfW: 34, // x: 30..98
  halfD: 22, // z: -640..-596
  floorHeight: 5.6,
  floors: 3,
} as const;

export const SCIENCE_MUSEUM_BOUNDS = {
  centerX: 168,
  centerZ: -618,
  halfW: 34, // x: 134..202
  halfD: 22, // z: -640..-596
  floorHeight: 5.6,
  floors: 2,
} as const;

export const SCIENCE_PLAZA_CENTER = {
  x: 118,
  z: -532,
  globeX: 118,
  globeZ: -514,
} as const;

export const SCIENCE_WALL_BOUNDS = {
  minX: -20,
  maxX: 248,
  minZ: -696,
  maxZ: -462,
  height: 14.5,
  thickness: 2.4,
  portalHeight: 10.2,
} as const;

export interface ScienceWallDoorSpec {
  id: 'west_blvd' | 'south_parkway' | 'south_avenue' | 'east_blvd';
  label: string;
  x: number;
  z: number;
  width: number;
  orientation: 'ew' | 'ns'; // 'ew' spans along X on a N/S wall; 'ns' spans along Z on an E/W wall
  triggerRadius: number;
}

export const SCIENCE_WALL_DOORS: readonly ScienceWallDoorSpec[] = [
  {
    id: 'west_blvd',
    label: 'Future City West Portal',
    x: SCIENCE_WALL_BOUNDS.minX,
    z: -474,
    width: 18,
    orientation: 'ns',
    triggerRadius: 23,
  },
  {
    id: 'south_parkway',
    label: 'Future City Parkway Portal',
    x: 104,
    z: SCIENCE_WALL_BOUNDS.maxZ,
    width: 16,
    orientation: 'ew',
    triggerRadius: 23,
  },
  {
    id: 'south_avenue',
    label: 'Future City Main Avenue Portal',
    x: 140,
    z: SCIENCE_WALL_BOUNDS.maxZ,
    width: 18,
    orientation: 'ew',
    triggerRadius: 23,
  },
  {
    id: 'east_blvd',
    label: 'Future City East Portal',
    x: SCIENCE_WALL_BOUNDS.maxX,
    z: -474,
    width: 18,
    orientation: 'ns',
    triggerRadius: 23,
  },
] as const;

/**
 * Steps a Future City automatic sliding wall door fraction [0..1] based on
 * proximity to either the player or an active driven vehicle.
 */
export function stepScienceWallDoors(
  currentOpenFracs: readonly number[],
  dt: number,
  playerPos: { x: number; z: number },
  vehiclePos?: { x: number; z: number } | null,
): number[] {
  const step = Math.min(1, Math.max(0, dt) * 2.4);
  return SCIENCE_WALL_DOORS.map((door, idx) => {
    const cur = currentOpenFracs[idx] ?? 0;
    const pDist = Math.hypot(playerPos.x - door.x, playerPos.z - door.z);
    const vDist = vehiclePos ? Math.hypot(vehiclePos.x - door.x, vehiclePos.z - door.z) : Infinity;
    const targetOpen = Math.min(pDist, vDist) <= door.triggerRadius ? 1 : 0;
    if (cur < targetOpen) return Math.min(1, cur + step);
    if (cur > targetOpen) return Math.max(0, cur - step * 0.75);
    return cur;
  });
}

/** Attached animated 3D projection MP4 streams for each of the 8 Future City Glass Domes. */
export const SCIENCE_DOME_VIDEO_PLAYLISTS: readonly string[][] = [
  ['./assets/aistudio/new_livve_wallpaper_hd_4k_MP4__99ad0d8a.mp4', './assets/aistudio/neon_city_wall_loop.mp4'],
  [
    './assets/aistudio/Green_and_black___Green_science_aesthetic__Motion_graphics_design__Creative_learning_MP4__e046ebe9.mp4',
    './assets/aistudio/neon_city_wall_loop.mp4',
  ],
  ['./assets/aistudio/Heart_Red_MP4__3e0ba08c.mp4', './assets/aistudio/neon_city_wall_loop.mp4'],
  [
    './assets/aistudio/Gambar_seni_keren___Wallpaper_keren__Fantasi_gelap__Wallpaper_ponsel_hd_MP4__07fdfce5.mp4',
    './assets/aistudio/gaming_screen_loop.mp4',
  ],
  ['./assets/aistudio/_______________________________MP4__a701545e.mp4', './assets/aistudio/neon_city_wall_loop.mp4'],
  ['./assets/aistudio/Dark_Blue_and_White_Futuristic_MP4__4ad3d254.mp4', './assets/aistudio/neon_city_wall_loop.mp4'],
  ['./assets/aistudio/Golden_Steampunk_Garmin_Watch_Face_____MP4__3f619f85.mp4', './assets/aistudio/gaming_screen_loop.mp4'],
  ['./assets/aistudio/neon_city_wall_loop.mp4', './assets/aistudio/Dark_Blue_and_White_Futuristic_MP4__4ad3d254.mp4'],
];

export type ScienceLabDepartmentId =
  | 'ai_lab'
  | 'robotics_lab'
  | 'drone_lab'
  | 'space_lab'
  | 'quantum_lab'
  | 'energy_lab'
  | 'agri_lab'
  | 'vehicle_lab'
  | 'medical_lab'
  | 'machinery_lab';

export interface ScienceLabDepartmentSpec {
  id: ScienceLabDepartmentId;
  index: number; // 1..10
  name: string;
  floor: 1 | 2 | 3;
  x: number;
  y: number;
  z: number;
  viewYaw: number;
  accentHex: string;
  leadScientist: string;
  activeProject: string;
  summary: string;
  metrics: { label: string; value: string }[];
}

export const FUTURE_LAB_DEPARTMENTS: readonly ScienceLabDepartmentSpec[] = [
  {
    id: 'ai_lab',
    index: 1,
    name: 'Artificial Intelligence Laboratory',
    floor: 1,
    x: 42,
    y: 0,
    z: -608,
    viewYaw: Math.PI * 0.5,
    accentHex: '#22d3ee',
    leadScientist: 'Dr. Elena Vance',
    activeProject: 'Neural World Twin v4',
    summary: 'Holographic cognitive clusters training real-time robotics and climate models.',
    metrics: [
      { label: 'Compute Cluster', value: '48.2 PFLOPS' },
      { label: 'Inference Latency', value: '1.4 ms' },
    ],
  },
  {
    id: 'robotics_lab',
    index: 2,
    name: 'Humanoid Robotics Laboratory',
    floor: 1,
    x: 42,
    y: 0,
    z: -628,
    viewYaw: Math.PI * 0.5,
    accentHex: '#38bdf8',
    leadScientist: 'Dr. Kenji Sato',
    activeProject: 'Atlas-Bipedal Actuators',
    summary: 'Autonomous humanoid walkers and precision 6-axis dual assembly manipulators.',
    metrics: [
      { label: 'Torque Precision', value: '0.02 mm' },
      { label: 'Active Humanoids', value: '4 Units' },
    ],
  },
  {
    id: 'drone_lab',
    index: 3,
    name: 'Drone Engineering Laboratory',
    floor: 1,
    x: 86,
    y: 0,
    z: -608,
    viewYaw: -Math.PI * 0.5,
    accentHex: '#0ea5e9',
    leadScientist: 'Eng. Maya Lin',
    activeProject: 'Tilt-Rotor Cargo Swarm',
    summary: 'Indoor tethered hover bay for autonomous quad-tilt aerial research platforms.',
    metrics: [
      { label: 'Flight Endurance', value: '94 min' },
      { label: 'Swarm Sync', value: '99.8%' },
    ],
  },
  {
    id: 'vehicle_lab',
    index: 4,
    name: 'Future Vehicle Engineering',
    floor: 1,
    x: 86,
    y: 0,
    z: -628,
    viewYaw: -Math.PI * 0.5,
    accentHex: '#f59e0b',
    leadScientist: 'Eng. Marcus Cole',
    activeProject: 'Mag-Lev Chassis Aero',
    summary: 'Wind-tunnel validated solid-state battery hypercars and vectored hover-craft.',
    metrics: [
      { label: 'Drag Coeff', value: '0.17 Cd' },
      { label: 'Pack Density', value: '620 Wh/kg' },
    ],
  },
  {
    id: 'space_lab',
    index: 5,
    name: 'Space Exploration Laboratory',
    floor: 2,
    x: 42,
    y: 5.6,
    z: -608,
    viewYaw: Math.PI * 0.5,
    accentHex: '#60a5fa',
    leadScientist: 'Cmdr. Aria Patel',
    activeProject: 'Ion-Drive Orbital Probe',
    summary: 'Deep-space ion thrusters, EVA suit telemetry, and planetary orbital navigation.',
    metrics: [
      { label: 'Specific Impulse', value: '4,200 s' },
      { label: 'Delta-V Budget', value: '14.8 km/s' },
    ],
  },
  {
    id: 'quantum_lab',
    index: 6,
    name: 'Quantum Computing Laboratory',
    floor: 2,
    x: 42,
    y: 5.6,
    z: -628,
    viewYaw: Math.PI * 0.5,
    accentHex: '#fbbf24',
    leadScientist: 'Dr. Viktor Novak',
    activeProject: '1024-Qubit Cryo Array',
    summary: 'Gold-plated dilution cryostat operating at 12 millikelvin for molecular simulation.',
    metrics: [
      { label: 'Core Temp', value: '12 mK' },
      { label: 'Coherence', value: '840 µs' },
    ],
  },
  {
    id: 'energy_lab',
    index: 7,
    name: 'Renewable Energy Laboratory',
    floor: 2,
    x: 86,
    y: 5.6,
    z: -626,
    viewYaw: -Math.PI * 0.5,
    accentHex: '#10b981',
    leadScientist: 'Dr. Nadia Okafor',
    activeProject: 'Compact Tokamak Injector',
    summary: 'High-efficiency perovskite solar cells paired with clean plasma magnetic confinement.',
    metrics: [
      { label: 'Cell Efficiency', value: '41.6%' },
      { label: 'Grid Output', value: '18.4 MW' },
    ],
  },
  {
    id: 'agri_lab',
    index: 8,
    name: 'Advanced Agriculture Laboratory',
    floor: 3,
    x: 42,
    y: 11.2,
    z: -608,
    viewYaw: Math.PI * 0.5,
    accentHex: '#34d399',
    leadScientist: 'Dr. Sofia Alvarez',
    activeProject: 'Aeroponic Spectrum Pods',
    summary: 'Closed-loop vertical biophotonic towers yielding 14x seasonal nutrition output.',
    metrics: [
      { label: 'Water Saved', value: '96.4%' },
      { label: 'Harvest Cycle', value: '14 Days' },
    ],
  },
  {
    id: 'medical_lab',
    index: 9,
    name: 'Medical Technology Laboratory',
    floor: 3,
    x: 42,
    y: 11.2,
    z: -628,
    viewYaw: Math.PI * 0.5,
    accentHex: '#2dd4bf',
    leadScientist: 'Dr. Hannah Cho',
    activeProject: 'Bio-Print Cellular Matrix',
    summary: 'Holographic DNA diagnostics, non-invasive cryo-scanners, and micro-surgical bots.',
    metrics: [
      { label: 'Scan Resolution', value: '4.2 µm' },
      { label: 'Match Accuracy', value: '99.94%' },
    ],
  },
  {
    id: 'machinery_lab',
    index: 10,
    name: 'Advanced Machinery Research',
    floor: 3,
    x: 86,
    y: 11.2,
    z: -620,
    viewYaw: -Math.PI * 0.5,
    accentHex: '#a78bfa',
    leadScientist: 'Eng. Leo Mercer',
    activeProject: 'Carbon-Alloy Nano-Lathe',
    summary: 'Sub-micron additive titanium fabrication and hypersonic turbine stress testing.',
    metrics: [
      { label: 'Spindle Speed', value: '42,000 RPM' },
      { label: 'Alloy Yield', value: '1,950 MPa' },
    ],
  },
];

export type ScienceDomeId =
  | 'dome_1_space'
  | 'dome_2_robotics'
  | 'dome_3_dinosaur'
  | 'dome_4_ancient'
  | 'dome_5_crystal'
  | 'dome_6_vehicles'
  | 'dome_7_satellite'
  | 'dome_8_ocean';

export interface ScienceDomeSpec {
  id: ScienceDomeId;
  index: number; // 1..8
  title: string;
  shortTitle: string;
  x: number;
  z: number;
  radius: number;
  entryYaw: number;
  accentHex: string;
  accentNum: number;
  highlights: readonly string[];
  description: string;
  telemetryFacts: readonly { label: string; value: string }[];
}

export const SCIENCE_DOMES_CATALOG: readonly ScienceDomeSpec[] = [
  {
    id: 'dome_1_space',
    index: 1,
    title: 'DOME 1 — SPACE EXPLORATION',
    shortTitle: 'Space Exploration',
    x: 56,
    z: -544,
    radius: 8.2,
    entryYaw: 0,
    accentHex: '#38bdf8',
    accentNum: 0x38bdf8,
    highlights: ['Orbital Launch Rocket', 'Astronaut Crew', 'Space Station Core', 'Planetary Orrery'],
    description:
      'Witness multi-stage orbital boosters, EVA astronauts, orbiting communications satellites, and a rotating Saturn planetary system.',
    telemetryFacts: [
      { label: 'Escape Velocity', value: '11.2 km/s' },
      { label: 'Orbit Altitude', value: '420 km LEO' },
    ],
  },
  {
    id: 'dome_2_robotics',
    index: 2,
    title: 'DOME 2 — ROBOTICS',
    shortTitle: 'Robotics',
    x: 86,
    z: -518,
    radius: 8.0,
    entryYaw: 0,
    accentHex: '#22d3ee',
    accentNum: 0x22d3ee,
    highlights: ['Bipedal Humanoid Walkers', '6-Axis Assembly Arms', 'AI Core Pedestal', 'Servo Calibration'],
    description:
      'Autonomous bipedal robots demonstrate balanced gait while twin articulated industrial arms assemble precision cybernetic modules.',
    telemetryFacts: [
      { label: 'DOF Actuation', value: '42 Joints' },
      { label: 'AI Cycle Rate', value: '1,200 Hz' },
    ],
  },
  {
    id: 'dome_3_dinosaur',
    index: 3,
    title: 'DOME 3 — DINOSAUR WORLD',
    shortTitle: 'Dinosaur World',
    x: 52,
    z: -510,
    radius: 8.0,
    entryYaw: 0,
    accentHex: '#84cc16',
    accentNum: 0x84cc16,
    highlights: ['Animated T-Rex Predator', 'Triceratops Specimen', 'Illuminated Fossils', 'Cretaceous Ferns'],
    description:
      'Full-scale animatronic Tyrannosaurus & Triceratops models breathe, articulate jaws, sway tails, and patrol reconstructed fern habitats.',
    telemetryFacts: [
      { label: 'Geological Era', value: '68M Years Ago' },
      { label: 'T-Rex Length', value: '12.3 Meters' },
    ],
  },
  {
    id: 'dome_4_ancient',
    index: 4,
    title: 'DOME 4 — ANCIENT CIVILIZATION',
    shortTitle: 'Ancient Civilization',
    x: 150,
    z: -518,
    radius: 8.0,
    entryYaw: 0,
    accentHex: '#f59e0b',
    accentNum: 0xf59e0b,
    highlights: ['Golden Guardian Statue', 'Step Pyramid Relic', 'Ceremonial Chariot', 'Holo-Script Ring'],
    description:
      'Preserved golden guardian statues, monolithic columns, ancient chariots, and revolving holographic inscriptions reveal early engineering.',
    telemetryFacts: [
      { label: 'Artifact Era', value: '2600 BCE' },
      { label: 'Preservation', value: 'Argon Sealed' },
    ],
  },
  {
    id: 'dome_5_crystal',
    index: 5,
    title: 'DOME 5 — CRYSTAL & ENERGY',
    shortTitle: 'Crystal & Energy',
    x: 152,
    z: -548,
    radius: 8.0,
    entryYaw: 0,
    accentHex: '#a855f7',
    accentNum: 0xa855f7,
    highlights: ['Levitating Quantum Crystals', 'Arc Flux Generators', 'Particle Containment', 'Resonance Beacons'],
    description:
      'Giant luminescent crystalline cores levitate within harmonic containment rings, projecting pulsed plasma beams and rising energy motes.',
    telemetryFacts: [
      { label: 'Harmonic Flux', value: '9.4 Tesla' },
      { label: 'Energy Density', value: '480 MJ/m³' },
    ],
  },
  {
    id: 'dome_6_vehicles',
    index: 6,
    title: 'DOME 6 — FUTURE VEHICLES',
    shortTitle: 'Future Vehicles',
    x: 184,
    z: -510,
    radius: 8.6,
    entryYaw: 0,
    accentHex: '#06b6d4',
    accentNum: 0x06b6d4,
    highlights: [
      'Futuristic Sports & Super Cars',
      'Future SUV & Glow Bike',
      'Flying Car & Future Drone',
      'Future Helicopter & Tank',
    ],
    description:
      'Eight next-gen mobility prototypes on rotating glass turntables: Sports Car, Super Car, SUV, Glow Bike, Helicopter, Flying Car, Drone & Future Tank.',
    telemetryFacts: [
      { label: 'Showcase Fleet', value: '8 Prototypes' },
      { label: 'Top Mach Trim', value: '480 km/h' },
    ],
  },
  {
    id: 'dome_7_satellite',
    index: 7,
    title: 'DOME 7 — SATELLITE TECHNOLOGY',
    shortTitle: 'Satellite Technology',
    x: 180,
    z: -544,
    radius: 8.2,
    entryYaw: 0,
    accentHex: '#0ea5e9',
    accentNum: 0x0ea5e9,
    highlights: ['Deep Space Telescope', 'Relay Satellites', 'Tracking Solar Wings', 'Phased Dish Array'],
    description:
      'High-gain orbital relay spacecraft with sun-tracking photovoltaic wings, deep-space mirrors, and rotating telemetry radar dishes.',
    telemetryFacts: [
      { label: 'Laser Uplink', value: '120 Gbps' },
      { label: 'Aperture Mirror', value: '6.5 Meters' },
    ],
  },
  {
    id: 'dome_8_ocean',
    index: 8,
    title: 'DOME 8 — OCEAN DISCOVERY',
    shortTitle: 'Ocean Discovery',
    x: 118,
    z: -544,
    radius: 8.4,
    entryYaw: 0,
    accentHex: '#14b8a6',
    accentNum: 0x14b8a6,
    highlights: ['Swimming Shark & Whale', 'Dolphin Pod & Reef Fish', 'Abyssal Research ROV', 'Bioluminescent Coral'],
    description:
      'Submerged walk-in aquarium habitat featuring cruising sharks, whales, dolphins, coral formations, rising bubbles, and autonomous subsea drones.',
    telemetryFacts: [
      { label: 'Habitat Depth', value: '1,800 m Sim' },
      { label: 'Marine Species', value: '18 Models' },
    ],
  },
];

export type ScienceFocusTarget =
  | { kind: 'future_lab'; departmentId?: ScienceLabDepartmentId }
  | { kind: 'science_museum'; hallIndex?: number }
  | { kind: 'dome'; domeId: ScienceDomeId };

export interface ScienceDistrictNpcSpec {
  id: string;
  role: 'scientist' | 'engineer' | 'visitor' | 'guide' | 'security' | 'robot_assistant' | 'maintenance';
  label: string;
  shirtHex: number;
  pantsHex: number;
  accentHex: number;
  speed: number;
  waypoints: readonly { x: number; y: number; z: number }[];
  activity: 'walk' | 'inspect' | 'operate' | 'guide' | 'sit';
}

export const SCIENCE_DISTRICT_NPCS: readonly ScienceDistrictNpcSpec[] = [
  // Future Lab 1F Scientists & Engineers
  {
    id: 'sci_ai_1',
    role: 'scientist',
    label: 'AI Researcher',
    shirtHex: 0xf8fafc,
    pantsHex: 0x1e293b,
    accentHex: 0x22d3ee,
    speed: 1.5,
    activity: 'operate',
    waypoints: [
      { x: 42, y: 0, z: -608 },
      { x: 54, y: 0, z: -612 },
      { x: 46, y: 0, z: -624 },
      { x: 40, y: 0, z: -626 },
    ],
  },
  {
    id: 'sci_eng_1',
    role: 'engineer',
    label: 'Robotics Engineer',
    shirtHex: 0x0284c7,
    pantsHex: 0x0f172a,
    accentHex: 0xfbbf24,
    speed: 1.75,
    activity: 'inspect',
    waypoints: [
      { x: 64, y: 0, z: -612 },
      { x: 82, y: 0, z: -608 },
      { x: 84, y: 0, z: -628 },
      { x: 64, y: 0, z: -626 },
    ],
  },
  {
    id: 'sci_robot_atrium',
    role: 'robot_assistant',
    label: 'Lab Humanoid Assistant',
    shirtHex: 0xe2e8f0,
    pantsHex: 0x334155,
    accentHex: 0x38bdf8,
    speed: 1.65,
    activity: 'walk',
    waypoints: [
      { x: 56, y: 0, z: -602 },
      { x: 72, y: 0, z: -602 },
      { x: 72, y: 0, z: -624 },
      { x: 56, y: 0, z: -624 },
    ],
  },
  {
    id: 'sci_2f_space',
    role: 'scientist',
    label: 'Quantum & Space Physicist',
    shirtHex: 0xf8fafc,
    pantsHex: 0x334155,
    accentHex: 0xa855f7,
    speed: 1.45,
    activity: 'operate',
    waypoints: [
      { x: 46, y: 5.6, z: -608 },
      { x: 82, y: 5.6, z: -608 },
      { x: 82, y: 5.6, z: -626 },
      { x: 46, y: 5.6, z: -626 },
    ],
  },
  // Skybridge & Maintenance
  {
    id: 'sci_maint_bridge',
    role: 'maintenance',
    label: 'Skybridge Technician',
    shirtHex: 0xf97316,
    pantsHex: 0x1e293b,
    accentHex: 0xfde047,
    speed: 1.55,
    activity: 'walk',
    waypoints: [
      { x: 90, y: 5.6, z: -616 },
      { x: 142, y: 5.6, z: -616 },
    ],
  },
  // Museum Guides, Visitors, Security
  {
    id: 'mus_guide_1',
    role: 'guide',
    label: 'Museum Docent Guide',
    shirtHex: 0x1d4ed8,
    pantsHex: 0x0f172a,
    accentHex: 0xfbbf24,
    speed: 1.6,
    activity: 'guide',
    waypoints: [
      { x: 154, y: 0, z: -604 },
      { x: 182, y: 0, z: -604 },
      { x: 184, y: 0, z: -630 },
      { x: 152, y: 0, z: -630 },
    ],
  },
  {
    id: 'mus_vis_1',
    role: 'visitor',
    label: 'Museum Visitor',
    shirtHex: 0xec4899,
    pantsHex: 0x1e293b,
    accentHex: 0xfef3c7,
    speed: 1.4,
    activity: 'inspect',
    waypoints: [
      { x: 158, y: 0, z: -612 },
      { x: 178, y: 0, z: -612 },
      { x: 178, y: 0, z: -624 },
      { x: 158, y: 0, z: -624 },
    ],
  },
  // Outdoor Plaza & 8 Glass Domes NPCs
  {
    id: 'plaza_vis_1',
    role: 'visitor',
    label: 'Plaza Explorer',
    shirtHex: 0x14b8a6,
    pantsHex: 0x334155,
    accentHex: 0xffffff,
    speed: 1.75,
    activity: 'walk',
    waypoints: [
      { x: 46, y: 0, z: -502 },
      { x: 118, y: 0, z: -498 },
      { x: 190, y: 0, z: -502 },
      { x: 192, y: 0, z: -564 },
      { x: 118, y: 0, z: -570 },
      { x: 46, y: 0, z: -564 },
    ],
  },
  {
    id: 'plaza_vis_2',
    role: 'visitor',
    label: 'Science Student',
    shirtHex: 0x6366f1,
    pantsHex: 0x1e293b,
    accentHex: 0x38bdf8,
    speed: 1.65,
    activity: 'inspect',
    waypoints: [
      { x: 70, y: 0, z: -532 },
      { x: 102, y: 0, z: -532 },
      { x: 134, y: 0, z: -532 },
      { x: 166, y: 0, z: -532 },
      { x: 166, y: 0, z: -558 },
      { x: 70, y: 0, z: -558 },
    ],
  },
  {
    id: 'plaza_guide_1',
    role: 'guide',
    label: 'Dome Tour Guide',
    shirtHex: 0x0284c7,
    pantsHex: 0x0f172a,
    accentHex: 0xfacc15,
    speed: 1.6,
    activity: 'guide',
    waypoints: [
      { x: 66, y: 0, z: -512 },
      { x: 118, y: 0, z: -528 },
      { x: 170, y: 0, z: -512 },
      { x: 118, y: 0, z: -502 },
    ],
  },
  {
    id: 'plaza_sec_1',
    role: 'security',
    label: 'District Security Officer',
    shirtHex: 0x0f172a,
    pantsHex: 0x020617,
    accentHex: 0x38bdf8,
    speed: 2.0,
    activity: 'walk',
    waypoints: [
      { x: 24, y: 0, z: -486 },
      { x: 118, y: 0, z: -486 },
      { x: 212, y: 0, z: -486 },
      { x: 212, y: 0, z: -584 },
      { x: 24, y: 0, z: -584 },
    ],
  },
  {
    id: 'plaza_robot_1',
    role: 'robot_assistant',
    label: 'Plaza Guide Droid',
    shirtHex: 0xf1f5f9,
    pantsHex: 0x1e293b,
    accentHex: 0x06b6d4,
    speed: 1.85,
    activity: 'walk',
    waypoints: [
      { x: 96, y: 0, z: -504 },
      { x: 140, y: 0, z: -504 },
      { x: 140, y: 0, z: -574 },
      { x: 96, y: 0, z: -574 },
    ],
  },
];

export interface ScienceDistrictSimulationState {
  activeBuilding: 'exterior' | 'future_lab' | 'science_museum' | ScienceDomeId;
  activeLabDept: ScienceLabDepartmentId;
  activeMuseumHall: number;
  boostedDomes: Record<ScienceDomeId, boolean>;
  labRobotsActive: boolean;
  labEnergyOverdrive: boolean;
  hologramPulsePhase: number;
  elevatorFloor: { labWest: 1 | 2 | 3; labEast: 1 | 2 | 3 };
  loadedZones: {
    futureLabInterior: boolean;
    scienceMuseumInterior: boolean;
    domeInteriors: Record<ScienceDomeId, boolean>;
  };
}

export function createInitialScienceDistrictState(): ScienceDistrictSimulationState {
  return {
    activeBuilding: 'exterior',
    activeLabDept: 'ai_lab',
    activeMuseumHall: 1,
    boostedDomes: {
      dome_1_space: false,
      dome_2_robotics: false,
      dome_3_dinosaur: false,
      dome_4_ancient: false,
      dome_5_crystal: false,
      dome_6_vehicles: false,
      dome_7_satellite: false,
      dome_8_ocean: false,
    },
    labRobotsActive: true,
    labEnergyOverdrive: false,
    hologramPulsePhase: 0,
    elevatorFloor: { labWest: 1, labEast: 1 },
    loadedZones: {
      futureLabInterior: false,
      scienceMuseumInterior: false,
      domeInteriors: {
        dome_1_space: false,
        dome_2_robotics: false,
        dome_3_dinosaur: false,
        dome_4_ancient: false,
        dome_5_crystal: false,
        dome_6_vehicles: false,
        dome_7_satellite: false,
        dome_8_ocean: false,
      },
    },
  };
}

/** True when (x, z) is inside the Futuristic Science District + road apron (for terrain flatten & flora exclusion). */
export function isInScienceDistrictZone(x: number, z: number, pad = 0): boolean {
  return (
    x >= SCIENCE_DISTRICT_BOUNDS.minX - pad &&
    x <= SCIENCE_DISTRICT_BOUNDS.maxX + pad &&
    z >= SCIENCE_DISTRICT_BOUNDS.minZ - pad &&
    z <= SCIENCE_DISTRICT_BOUNDS.maxZ + pad
  );
}

/** True on the paved connector avenues serving the Science District and connecting Smart City & Mansion East. */
export function isOnScienceDistrictRoad(x: number, z: number): boolean {
  // 1. Main East-West Science Boulevard (z = -474, width 14.4m) linking Smart City road (-114) to East Plaza (232)
  if (Math.abs(z - -474) <= 7.2 && x >= -114 && x <= 232) {
    return true;
  }
  // 2. Smart City Gate 1 -> Science Boulevard angled/stepped connector at x = -114, z in [-481..-460]
  if (Math.abs(x - -114) <= 6.2 && z >= -481 && z <= -460) {
    return true;
  }
  // 3. Northbound Avenue x = 140 continuing from Central City ring (-208) straight into Science Boulevard (-474)
  if (Math.abs(x - 140) <= 7.2 && z >= -481 && z <= -208) {
    return true;
  }
  // 4. Scenic Parkway behind East Mansion Wall (x = 104, z in [-474..-248])
  if (Math.abs(x - 104) <= 5.6 && z >= -481 && z <= -248) {
    return true;
  }
  // 5. Rear Service Perimeter Loop North of Lab & Museum (z = -660, x in [12..220])
  if (Math.abs(z - -660) <= 5.4 && x >= 12 && x <= 220) {
    return true;
  }
  if (Math.abs(x - 12) <= 5.4 && z >= -664 && z <= -474) {
    return true;
  }
  if (Math.abs(x - 220) <= 5.4 && z >= -664 && z <= -474) {
    return true;
  }
  return false;
}

/** Returns vehicle/player ground surface offset for Science District roads, plaza, EV parking & elevated floors. */
export function getScienceDistrictSurfaceOffsetY(x: number, z: number, refY?: number): number {
  if (isOnScienceDistrictRoad(x, z)) {
    return 0.085;
  }
  // Future Lab 3F (y = 11.2)
  if (
    refY !== undefined &&
    refY >= 10.0 &&
    x >= FUTURE_LAB_BOUNDS.centerX - FUTURE_LAB_BOUNDS.halfW &&
    x <= FUTURE_LAB_BOUNDS.centerX + FUTURE_LAB_BOUNDS.halfW &&
    z >= FUTURE_LAB_BOUNDS.centerZ - FUTURE_LAB_BOUNDS.halfD &&
    z <= FUTURE_LAB_BOUNDS.centerZ + FUTURE_LAB_BOUNDS.halfD
  ) {
    return 11.2;
  }
  // Future Lab 2F, Skybridge (x: 98..134, z: -620..-612) & Science Museum 2F mezzanine (y = 5.6)
  if (refY !== undefined && refY >= 4.4) {
    if (x >= 96 && x <= 136 && z >= -621 && z <= -611) {
      return 5.6;
    }
    if (
      x >= FUTURE_LAB_BOUNDS.centerX - FUTURE_LAB_BOUNDS.halfW &&
      x <= FUTURE_LAB_BOUNDS.centerX + FUTURE_LAB_BOUNDS.halfW &&
      z >= FUTURE_LAB_BOUNDS.centerZ - FUTURE_LAB_BOUNDS.halfD &&
      z <= FUTURE_LAB_BOUNDS.centerZ + FUTURE_LAB_BOUNDS.halfD
    ) {
      return 5.6;
    }
    if (
      x >= SCIENCE_MUSEUM_BOUNDS.centerX - SCIENCE_MUSEUM_BOUNDS.halfW &&
      x <= SCIENCE_MUSEUM_BOUNDS.centerX + SCIENCE_MUSEUM_BOUNDS.halfW &&
      z >= SCIENCE_MUSEUM_BOUNDS.centerZ - SCIENCE_MUSEUM_BOUNDS.halfD &&
      z <= SCIENCE_MUSEUM_BOUNDS.centerZ + SCIENCE_MUSEUM_BOUNDS.halfD
    ) {
      return 5.6;
    }
  }
  // 8 Glass Dome circular podiums (base deck 0.14 + 0.40 podium height = 0.54m)
  for (let i = 0; i < SCIENCE_DOMES_CATALOG.length; i++) {
    const d = SCIENCE_DOMES_CATALOG[i];
    if (Math.hypot(x - d.x, z - d.z) <= d.radius + 0.65) {
      return 0.54;
    }
  }
  // Future Lab & Science Museum 1F interior floor slabs (0.20m)
  if (
    (x >= FUTURE_LAB_BOUNDS.centerX - FUTURE_LAB_BOUNDS.halfW &&
      x <= FUTURE_LAB_BOUNDS.centerX + FUTURE_LAB_BOUNDS.halfW &&
      z >= FUTURE_LAB_BOUNDS.centerZ - FUTURE_LAB_BOUNDS.halfD &&
      z <= FUTURE_LAB_BOUNDS.centerZ + FUTURE_LAB_BOUNDS.halfD) ||
    (x >= SCIENCE_MUSEUM_BOUNDS.centerX - SCIENCE_MUSEUM_BOUNDS.halfW &&
      x <= SCIENCE_MUSEUM_BOUNDS.centerX + SCIENCE_MUSEUM_BOUNDS.halfW &&
      z >= SCIENCE_MUSEUM_BOUNDS.centerZ - SCIENCE_MUSEUM_BOUNDS.halfD &&
      z <= SCIENCE_MUSEUM_BOUNDS.centerZ + SCIENCE_MUSEUM_BOUNDS.halfD)
  ) {
    return 0.2;
  }
  // Raised plaza deck + steps promenade
  if (x >= 18 && x <= 214 && z >= -642 && z <= -492) {
    return 0.14;
  }
  // EV Parking pad
  if (x >= -10 && x <= 32 && z >= -512 && z <= -482) {
    return 0.1;
  }
  return 0;
}

/** Evaluates nearest interactive Science District anchor within `maxDist` meters. */
export function detectNearestScienceInteraction(
  x: number,
  z: number,
  maxDist = 14.5,
): {
  kind: 'future_lab' | 'science_museum' | 'dome';
  dome?: ScienceDomeSpec;
  label: string;
  dist: number;
} | null {
  // Check Future Lab entrance & atrium (center 64, -596 / inside -618)
  const insideLab =
    x >= FUTURE_LAB_BOUNDS.centerX - FUTURE_LAB_BOUNDS.halfW - 2 &&
    x <= FUTURE_LAB_BOUNDS.centerX + FUTURE_LAB_BOUNDS.halfW + 2 &&
    z >= FUTURE_LAB_BOUNDS.centerZ - FUTURE_LAB_BOUNDS.halfD - 2 &&
    z <= FUTURE_LAB_BOUNDS.centerZ + FUTURE_LAB_BOUNDS.halfD + 8;
  const distLabDoor = Math.hypot(x - 64, z - -590);

  const insideMuseum =
    x >= SCIENCE_MUSEUM_BOUNDS.centerX - SCIENCE_MUSEUM_BOUNDS.halfW - 2 &&
    x <= SCIENCE_MUSEUM_BOUNDS.centerX + SCIENCE_MUSEUM_BOUNDS.halfW + 2 &&
    z >= SCIENCE_MUSEUM_BOUNDS.centerZ - SCIENCE_MUSEUM_BOUNDS.halfD - 2 &&
    z <= SCIENCE_MUSEUM_BOUNDS.centerZ + SCIENCE_MUSEUM_BOUNDS.halfD + 8;
  const distMuseumDoor = Math.hypot(x - 168, z - -590);

  // First check the 8 outdoor domes (prioritize whichever dome is closest within radius+4.5m)
  let bestDome: ScienceDomeSpec | null = null;
  let bestDomeDist = Infinity;
  for (let i = 0; i < SCIENCE_DOMES_CATALOG.length; i++) {
    const d = SCIENCE_DOMES_CATALOG[i];
    const dist = Math.hypot(x - d.x, z - d.z);
    if (dist <= d.radius + 4.8 && dist < bestDomeDist) {
      bestDome = d;
      bestDomeDist = dist;
    }
  }
  if (bestDome) {
    return {
      kind: 'dome',
      dome: bestDome,
      label: bestDome.title,
      dist: bestDomeDist,
    };
  }

  if (insideLab || distLabDoor <= maxDist) {
    return {
      kind: 'future_lab',
      label: 'FUTURE LAB — 10 RESEARCH DEPARTMENTS',
      dist: insideLab ? 0 : distLabDoor,
    };
  }
  if (insideMuseum || distMuseumDoor <= maxDist) {
    return {
      kind: 'science_museum',
      label: 'SCIENCE MUSEUM — EXHIBITION HALLS',
      dist: insideMuseum ? 0 : distMuseumDoor,
    };
  }
  return null;
}

/**
 * Updates on-demand Android 6GB RAM interior visibility flags so only interiors
 * near the camera or currently entered by the player stay active in GPU draw lists.
 */
export function updateOnDemandInteriorLoading(
  state: ScienceDistrictSimulationState,
  camX: number,
  camZ: number,
  playerX: number,
  playerZ: number,
  loadRadiusLabMuseum = 76,
  loadRadiusDome = 44,
): void {
  const labCamDist = Math.hypot(camX - FUTURE_LAB_BOUNDS.centerX, camZ - FUTURE_LAB_BOUNDS.centerZ);
  const labPlayerDist = Math.hypot(playerX - FUTURE_LAB_BOUNDS.centerX, playerZ - FUTURE_LAB_BOUNDS.centerZ);
  state.loadedZones.futureLabInterior =
    state.activeBuilding === 'future_lab' ||
    Math.min(labCamDist, labPlayerDist) <= loadRadiusLabMuseum;

  const musCamDist = Math.hypot(camX - SCIENCE_MUSEUM_BOUNDS.centerX, camZ - SCIENCE_MUSEUM_BOUNDS.centerZ);
  const musPlayerDist = Math.hypot(playerX - SCIENCE_MUSEUM_BOUNDS.centerX, playerZ - SCIENCE_MUSEUM_BOUNDS.centerZ);
  state.loadedZones.scienceMuseumInterior =
    state.activeBuilding === 'science_museum' ||
    Math.min(musCamDist, musPlayerDist) <= loadRadiusLabMuseum;

  for (let i = 0; i < SCIENCE_DOMES_CATALOG.length; i++) {
    const d = SCIENCE_DOMES_CATALOG[i];
    const camD = Math.hypot(camX - d.x, camZ - d.z);
    const plyD = Math.hypot(playerX - d.x, playerZ - d.z);
    state.loadedZones.domeInteriors[d.id] =
      state.activeBuilding === d.id || Math.min(camD, plyD) <= loadRadiusDome;
  }
}

export const SCIENCE_DISTRICT_POIS = [
  {
    id: 'sim_future_lab',
    name: 'Future Lab & Research Complex',
    shortName: 'Future Lab',
    subtitle: '10 Interactive Science & AI Robotics Labs, Glass Elevators & Skybridge',
    x: 64,
    z: -578,
    viewYaw: 0,
    kind: 'landmark' as const,
  },
  {
    id: 'sim_science_museum',
    name: 'Science Museum & 8 Glass Domes',
    shortName: 'Science Museum',
    subtitle: 'Grand Glass Dome Museum, World Hologram Plaza & 8 Animated Exhibit Domes',
    x: 118,
    z: -486,
    viewYaw: 0,
    kind: 'landmark' as const,
  },
] as const;
