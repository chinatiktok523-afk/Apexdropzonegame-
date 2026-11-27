import type { TimeOfDayPhase } from '../types';
import {
  getSmartCityDistrictAt,
  isInSmartCityZone,
  type SmartCityDistrictName,
} from './smartCitySystems';
import { isInScienceDistrictZone } from './scienceDistrictSystems';

export type NpcCategory =
  | 'everyday_citizen'
  | 'hotel_restaurant'
  | 'shopping_citizen'
  | 'transport_road'
  | 'park_fitness'
  | 'special_profession';

export type NpcRoleId =
  // 1-5: Everyday citizens
  | 'sidewalk_walker'
  | 'house_leaver'
  | 'home_returner'
  | 'bench_sitter'
  | 'group_talker'
  // 6-10: Hotel and restaurant workers
  | 'waiter'
  | 'chef'
  | 'hotel_receptionist'
  | 'hotel_cleaner'
  | 'restaurant_customer'
  // 11-15: Shopping citizens
  | 'clothes_shopper'
  | 'watch_shopper'
  | 'cashier'
  | 'shopkeeper'
  | 'mall_security'
  // 16-20: Transport and road workers
  | 'car_driver'
  | 'motorcycle_rider'
  | 'bus_driver'
  | 'taxi_driver'
  | 'traffic_police'
  // 21-25: Park and fitness visitors
  | 'jogger'
  | 'exerciser'
  | 'cyclist'
  | 'parent_with_child'
  | 'playground_child'
  // 26-30: Special NPC professions
  | 'farmer'
  | 'tourist_camera'
  | 'construction_worker'
  | 'gardener'
  | 'delivery_worker';

export interface NpcRoleSpec {
  id: NpcRoleId;
  index: number; // 1..30
  label: string;
  category: NpcCategory;
  shirtHex: number;
  pantsHex: number;
  accentHex: number;
  baseSpeed: number;
  scale: number;
  propKind:
    | 'none'
    | 'tray'
    | 'ladle'
    | 'broom'
    | 'bag'
    | 'camera'
    | 'watering_can'
    | 'parcel'
    | 'baton'
    | 'tool'
    | 'cup';
}

export const NPC_ROLE_CATALOG: NpcRoleSpec[] = [
  // 1–5 Everyday citizens
  { id: 'sidewalk_walker', index: 1, label: 'Sidewalk Walker', category: 'everyday_citizen', shirtHex: 0x3b82f6, pantsHex: 0x1e293b, accentHex: 0xf8fafc, baseSpeed: 1.9, scale: 1.0, propKind: 'none' },
  { id: 'house_leaver', index: 2, label: 'Morning Commuter', category: 'everyday_citizen', shirtHex: 0x6366f1, pantsHex: 0x334155, accentHex: 0xe2e8f0, baseSpeed: 2.1, scale: 1.0, propKind: 'bag' },
  { id: 'home_returner', index: 3, label: 'Home Returner', category: 'everyday_citizen', shirtHex: 0x0ea5e9, pantsHex: 0x1e293b, accentHex: 0xfde047, baseSpeed: 1.95, scale: 1.0, propKind: 'bag' },
  { id: 'bench_sitter', index: 4, label: 'Bench Sitter', category: 'everyday_citizen', shirtHex: 0x14b8a6, pantsHex: 0x334155, accentHex: 0xfef3c7, baseSpeed: 1.7, scale: 1.0, propKind: 'cup' },
  { id: 'group_talker', index: 5, label: 'Social Group Citizen', category: 'everyday_citizen', shirtHex: 0xf59e0b, pantsHex: 0x1e293b, accentHex: 0xffffff, baseSpeed: 1.8, scale: 1.0, propKind: 'none' },

  // 6–10 Hotel & restaurant workers + customers
  { id: 'waiter', index: 6, label: 'Waiter', category: 'hotel_restaurant', shirtHex: 0xf8fafc, pantsHex: 0x0f172a, accentHex: 0xd97706, baseSpeed: 2.35, scale: 1.0, propKind: 'tray' },
  { id: 'chef', index: 7, label: 'Master Chef', category: 'hotel_restaurant', shirtHex: 0xffffff, pantsHex: 0x1f2937, accentHex: 0xfef08a, baseSpeed: 1.65, scale: 1.02, propKind: 'ladle' },
  { id: 'hotel_receptionist', index: 8, label: 'Hotel Receptionist', category: 'hotel_restaurant', shirtHex: 0x1e3a8a, pantsHex: 0x0f172a, accentHex: 0xfbbf24, baseSpeed: 1.5, scale: 1.0, propKind: 'none' },
  { id: 'hotel_cleaner', index: 9, label: 'Hotel Cleaner', category: 'hotel_restaurant', shirtHex: 0x38bdf8, pantsHex: 0x1e293b, accentHex: 0xfacc15, baseSpeed: 1.8, scale: 1.0, propKind: 'broom' },
  { id: 'restaurant_customer', index: 10, label: 'Restaurant Diner', category: 'hotel_restaurant', shirtHex: 0xec4899, pantsHex: 0x334155, accentHex: 0xfde68a, baseSpeed: 1.95, scale: 1.0, propKind: 'cup' },

  // 11–15 Shopping citizens
  { id: 'clothes_shopper', index: 11, label: 'Clothes Shopper', category: 'shopping_citizen', shirtHex: 0xe879f9, pantsHex: 0x1e293b, accentHex: 0xf43f5e, baseSpeed: 1.85, scale: 1.0, propKind: 'bag' },
  { id: 'watch_shopper', index: 12, label: 'Watch Shopper', category: 'shopping_citizen', shirtHex: 0x0284c7, pantsHex: 0x0f172a, accentHex: 0xfbbf24, baseSpeed: 1.85, scale: 1.0, propKind: 'bag' },
  { id: 'cashier', index: 13, label: 'Store Cashier', category: 'shopping_citizen', shirtHex: 0x10b981, pantsHex: 0x1f2937, accentHex: 0xffffff, baseSpeed: 1.5, scale: 1.0, propKind: 'none' },
  { id: 'shopkeeper', index: 14, label: 'Boutique Shopkeeper', category: 'shopping_citizen', shirtHex: 0x7c3aed, pantsHex: 0x1e293b, accentHex: 0xfde047, baseSpeed: 1.65, scale: 1.0, propKind: 'none' },
  { id: 'mall_security', index: 15, label: 'Mall Security Guard', category: 'shopping_citizen', shirtHex: 0x0f172a, pantsHex: 0x020617, accentHex: 0x38bdf8, baseSpeed: 2.1, scale: 1.05, propKind: 'baton' },

  // 16–20 Transport & road workers
  { id: 'car_driver', index: 16, label: 'Car Driver', category: 'transport_road', shirtHex: 0x475569, pantsHex: 0x1e293b, accentHex: 0x38bdf8, baseSpeed: 12.5, scale: 1.0, propKind: 'none' },
  { id: 'motorcycle_rider', index: 17, label: 'Motorcycle Rider', category: 'transport_road', shirtHex: 0xf97316, pantsHex: 0x111827, accentHex: 0x22c55e, baseSpeed: 15.5, scale: 1.0, propKind: 'none' },
  { id: 'bus_driver', index: 18, label: 'City Bus Driver', category: 'transport_road', shirtHex: 0x2563eb, pantsHex: 0x0f172a, accentHex: 0xfacc15, baseSpeed: 10.5, scale: 1.02, propKind: 'none' },
  { id: 'taxi_driver', index: 19, label: 'Taxi Driver', category: 'transport_road', shirtHex: 0xfacc15, pantsHex: 0x1e293b, accentHex: 0x111827, baseSpeed: 13.5, scale: 1.0, propKind: 'none' },
  { id: 'traffic_police', index: 20, label: 'Traffic Police', category: 'transport_road', shirtHex: 0x1d4ed8, pantsHex: 0x0f172a, accentHex: 0xa3e635, baseSpeed: 2.0, scale: 1.04, propKind: 'baton' },

  // 21–25 Park & fitness visitors
  { id: 'jogger', index: 21, label: 'Morning Jogger', category: 'park_fitness', shirtHex: 0xef4444, pantsHex: 0x111827, accentHex: 0xfef08a, baseSpeed: 4.1, scale: 1.0, propKind: 'none' },
  { id: 'exerciser', index: 22, label: 'Park Athlete', category: 'park_fitness', shirtHex: 0x22c55e, pantsHex: 0x1e293b, accentHex: 0xffffff, baseSpeed: 2.0, scale: 1.02, propKind: 'none' },
  { id: 'cyclist', index: 23, label: 'Park Cyclist', category: 'park_fitness', shirtHex: 0x06b6d4, pantsHex: 0x0f172a, accentHex: 0xfbbf24, baseSpeed: 6.8, scale: 1.0, propKind: 'none' },
  { id: 'parent_with_child', index: 24, label: 'Parent Watching Child', category: 'park_fitness', shirtHex: 0xf472b6, pantsHex: 0x334155, accentHex: 0xfef3c7, baseSpeed: 1.65, scale: 1.0, propKind: 'none' },
  { id: 'playground_child', index: 25, label: 'Playground Child', category: 'park_fitness', shirtHex: 0xfacc15, pantsHex: 0x38bdf8, accentHex: 0xf43f5e, baseSpeed: 2.8, scale: 0.62, propKind: 'none' },

  // 26–30 Special professions
  { id: 'farmer', index: 26, label: 'Valley Farmer', category: 'special_profession', shirtHex: 0x16a34a, pantsHex: 0x713f12, accentHex: 0xfde047, baseSpeed: 1.75, scale: 1.02, propKind: 'tool' },
  { id: 'tourist_camera', index: 27, label: 'Landmark Tourist', category: 'special_profession', shirtHex: 0xfb7185, pantsHex: 0x475569, accentHex: 0xfef08a, baseSpeed: 1.75, scale: 1.0, propKind: 'camera' },
  { id: 'construction_worker', index: 28, label: 'Construction Worker', category: 'special_profession', shirtHex: 0xf97316, pantsHex: 0x334155, accentHex: 0xfacc15, baseSpeed: 1.85, scale: 1.04, propKind: 'tool' },
  { id: 'gardener', index: 29, label: 'Botanical Gardener', category: 'special_profession', shirtHex: 0x15803d, pantsHex: 0x3f6212, accentHex: 0x67e8f9, baseSpeed: 1.75, scale: 1.0, propKind: 'watering_can' },
  { id: 'delivery_worker', index: 30, label: 'Package Courier', category: 'special_profession', shirtHex: 0x0369a1, pantsHex: 0x1e293b, accentHex: 0xd97706, baseSpeed: 2.45, scale: 1.02, propKind: 'parcel' },
];

export const NPC_ROLE_MAP: Record<NpcRoleId, NpcRoleSpec> = Object.fromEntries(
  NPC_ROLE_CATALOG.map((r) => [r.id, r]),
) as Record<NpcRoleId, NpcRoleSpec>;

export type RoutineGoal =
  | 'leave_home_for_bus_or_walk'
  | 'work_shift'
  | 'shop_at_mall'
  | 'dine_at_restaurant'
  | 'park_or_social'
  | 'return_home_or_hotel';

/**
 * Computes an NPC's active daily routine stage from the world time phase & agent offset.
 * Follows the exact Morning -> Daytime -> Afternoon -> Evening -> Night schedule while
 * rotating citizens smoothly so dining halls, malls, parks, and roads always look alive.
 */
export function computeDailyRoutineGoal(
  role: NpcRoleId,
  phase: TimeOfDayPhase,
  elapsedSec: number,
  agentSeed: number,
): RoutineGoal {
  // Always keep service workers attending core posts during operating shifts
  if (role === 'hotel_receptionist' || role === 'chef' || role === 'waiter' || role === 'hotel_cleaner') {
    return phase === 'night' && agentSeed % 3 === 0 ? 'return_home_or_hotel' : 'work_shift';
  }
  if (role === 'traffic_police' || role === 'mall_security' || role === 'cashier' || role === 'shopkeeper') {
    return phase === 'night' && agentSeed % 2 === 0 ? 'return_home_or_hotel' : 'work_shift';
  }

  // Rolling 45-second micro-cycle keeps dynamic life visible even when player stays in one time phase
  const microSlot = Math.floor((elapsedSec + agentSeed * 7.3) / 45) % 4;

  if (phase === 'morning') {
    if (role === 'house_leaver' || (role === 'sidewalk_walker' && microSlot === 0)) {
      return 'leave_home_for_bus_or_walk';
    }
    if (role === 'jogger' || role === 'exerciser' || role === 'cyclist' || role === 'playground_child' || role === 'parent_with_child') {
      return 'park_or_social';
    }
    if (role === 'restaurant_customer' && microSlot === 1) return 'dine_at_restaurant';
    return microSlot === 2 ? 'shop_at_mall' : 'work_shift';
  }

  if (phase === 'afternoon') {
    if (role === 'restaurant_customer' || microSlot === 1) return 'dine_at_restaurant';
    if (role === 'clothes_shopper' || role === 'watch_shopper' || microSlot === 2) return 'shop_at_mall';
    if (role === 'playground_child' || role === 'parent_with_child' || role === 'bench_sitter') {
      return 'park_or_social';
    }
    return 'work_shift';
  }

  if (phase === 'sunset') {
    if (microSlot === 0) return 'park_or_social';
    if (microSlot === 1) return 'shop_at_mall';
    if (microSlot === 2) return 'dine_at_restaurant';
    return 'return_home_or_hotel';
  }

  // Night
  if (role === 'home_returner' || microSlot >= 2) return 'return_home_or_hotel';
  if (role === 'restaurant_customer' || role === 'tourist_camera') return 'dine_at_restaurant';
  return 'park_or_social';
}

// ============================================================================
// RESTAURANT & CAFETERIA TABLE RESERVATION + TURNOVER SYSTEM
// ============================================================================
export interface DiningSeatSlot {
  id: string;
  tableId: string;
  venue: 'hotel_banquet' | 'hotel_cafeteria' | 'seine_bistro' | 'mall_food_court';
  x: number;
  y: number;
  z: number;
  lookAtX: number;
  lookAtZ: number;
  hasHotFood: boolean;
  occupiedByNpcId: number | null;
  eatRemainingSec: number;
  lastVacatedAtSec: number;
}

export class TableReservationSystem {
  public readonly seats: DiningSeatSlot[] = [];

  constructor(initialSeats: Omit<DiningSeatSlot, 'occupiedByNpcId' | 'eatRemainingSec' | 'lastVacatedAtSec'>[]) {
    for (const s of initialSeats) {
      this.seats.push({
        ...s,
        occupiedByNpcId: null,
        eatRemainingSec: 0,
        lastVacatedAtSec: -10,
      });
    }
  }

  public claimFreeSeat(npcId: number, preferredVenue?: DiningSeatSlot['venue'], eatDurationSec = 14): DiningSeatSlot | null {
    // Check if NPC already holds a seat
    const existing = this.seats.find((s) => s.occupiedByNpcId === npcId);
    if (existing) return existing;

    // Prefer matching venue first, then any open seat
    const candidate =
      this.seats.find((s) => s.occupiedByNpcId === null && (!preferredVenue || s.venue === preferredVenue)) ??
      this.seats.find((s) => s.occupiedByNpcId === null) ??
      null;

    if (!candidate) return null;
    candidate.occupiedByNpcId = npcId;
    candidate.eatRemainingSec = Math.max(4, eatDurationSec);
    return candidate;
  }

  public releaseSeat(npcId: number, elapsedSec: number): void {
    for (let i = 0; i < this.seats.length; i++) {
      if (this.seats[i].occupiedByNpcId === npcId) {
        this.seats[i].occupiedByNpcId = null;
        this.seats[i].eatRemainingSec = 0;
        this.seats[i].lastVacatedAtSec = elapsedSec;
      }
    }
  }

  /**
   * Advances meal timers; returns NPC IDs whose meal just completed so they stand up & leave,
   * automatically opening the table for the next arriving customer!
   */
  public step(dt: number, elapsedSec: number): number[] {
    const finishedNpcIds: number[] = [];
    for (let i = 0; i < this.seats.length; i++) {
      const seat = this.seats[i];
      if (seat.occupiedByNpcId !== null) {
        seat.eatRemainingSec -= dt;
        if (seat.eatRemainingSec <= 0) {
          finishedNpcIds.push(seat.occupiedByNpcId);
          seat.occupiedByNpcId = null;
          seat.eatRemainingSec = 0;
          seat.lastVacatedAtSec = elapsedSec;
        }
      }
    }
    return finishedNpcIds;
  }

  public getOccupiedCount(): number {
    let count = 0;
    for (let i = 0; i < this.seats.length; i++) {
      if (this.seats[i].occupiedByNpcId !== null) count++;
    }
    return count;
  }
}

// ============================================================================
// ROAD TRAFFIC SIGNAL SYSTEM (Synchronized 4-Way Intersections)
// ============================================================================
export type SignalColor = 'GREEN' | 'YELLOW' | 'RED';

export interface SignalPhaseState {
  ns: SignalColor;
  ew: SignalColor;
  secondsRemaining: number;
  cyclePosSec: number;
}

const SIGNAL_CYCLE_SEC = 20; // 7s NS green, 2s NS yellow, 1s all-red, 7s EW green, 2s EW yellow, 1s all-red

export function computeTrafficSignalState(elapsedSec: number, offsetSec = 0): SignalPhaseState {
  const t = (((elapsedSec + offsetSec) % SIGNAL_CYCLE_SEC) + SIGNAL_CYCLE_SEC) % SIGNAL_CYCLE_SEC;
  if (t < 7) {
    return { ns: 'GREEN', ew: 'RED', secondsRemaining: Math.ceil(7 - t), cyclePosSec: t };
  }
  if (t < 9) {
    return { ns: 'YELLOW', ew: 'RED', secondsRemaining: Math.ceil(9 - t), cyclePosSec: t };
  }
  if (t < 10) {
    return { ns: 'RED', ew: 'RED', secondsRemaining: Math.ceil(10 - t), cyclePosSec: t };
  }
  if (t < 17) {
    return { ns: 'RED', ew: 'GREEN', secondsRemaining: Math.ceil(17 - t), cyclePosSec: t };
  }
  if (t < 19) {
    return { ns: 'RED', ew: 'YELLOW', secondsRemaining: Math.ceil(19 - t), cyclePosSec: t };
  }
  return { ns: 'RED', ew: 'RED', secondsRemaining: Math.ceil(20 - t), cyclePosSec: t };
}

/**
 * Returns true if an AI vehicle traveling along `axis` ('ns' or 'ew') must stop before entering
 * the intersection centered at `(interX, interZ)`.
 */
export function shouldVehicleStopAtSignal(
  vx: number,
  vz: number,
  headingAxis: 'ns' | 'ew',
  headingDir: 1 | -1,
  interX: number,
  interZ: number,
  signal: SignalPhaseState,
): boolean {
  const light = headingAxis === 'ns' ? signal.ns : signal.ew;
  if (light === 'GREEN') return false;

  const stopLineDist = 11.5;
  const minCheckDist = 7.2;
  if (headingAxis === 'ns') {
    if (Math.abs(vx - interX) > 9.5) return false;
    const distToCenter = (interZ - vz) * headingDir;
    return distToCenter > minCheckDist && distToCenter < stopLineDist + 6.5;
  } else {
    if (Math.abs(vz - interZ) > 9.5) return false;
    const distToCenter = (interX - vx) * headingDir;
    return distToCenter > minCheckDist && distToCenter < stopLineDist + 6.5;
  }
}

// ============================================================================
// REALISTIC SHOPPING MALL ELEVATOR / LIFT KINEMATICS
// ============================================================================
export interface ElevatorState {
  currentY: number;
  targetFloorIdx: number;
  floorHeights: number[];
  dwellTimer: number;
  direction: -1 | 0 | 1;
  doorsOpenProgress: number; // 0 closed .. 1 open
}

export function createElevatorState(floorHeights: number[] = [0, 4.8, 9.6]): ElevatorState {
  return {
    currentY: floorHeights[0] ?? 0,
    targetFloorIdx: 0,
    floorHeights,
    dwellTimer: 2.2,
    direction: 1,
    doorsOpenProgress: 1,
  };
}

export function requestNextElevatorFloor(state: ElevatorState, explicitFloorIdx?: number): number {
  const maxIdx = state.floorHeights.length - 1;
  if (explicitFloorIdx !== undefined) {
    state.targetFloorIdx = Math.max(0, Math.min(maxIdx, explicitFloorIdx));
  } else {
    state.targetFloorIdx = (state.targetFloorIdx + 1) % state.floorHeights.length;
  }
  state.dwellTimer = 0;
  return state.targetFloorIdx;
}

export function stepElevatorState(state: ElevatorState, dt: number, speedMps = 2.6): void {
  const targetY = state.floorHeights[state.targetFloorIdx] ?? 0;
  const diff = targetY - state.currentY;

  if (Math.abs(diff) <= 0.04) {
    state.currentY = targetY;
    state.direction = 0;
    state.doorsOpenProgress = Math.min(1, state.doorsOpenProgress + dt * 2.8);
    state.dwellTimer += dt;
    // Automatic floor cycling with comfortable 6.0s boarding/exit dwell window
    if (state.dwellTimer >= 6.0) {
      state.dwellTimer = 0;
      state.targetFloorIdx = (state.targetFloorIdx + 1) % state.floorHeights.length;
    }
    return;
  }

  // Close doors before moving
  if (state.doorsOpenProgress > 0.05) {
    state.doorsOpenProgress = Math.max(0, state.doorsOpenProgress - dt * 3.0);
    return;
  }

  state.doorsOpenProgress = 0;
  state.direction = diff > 0 ? 1 : -1;
  const stepDist = Math.min(Math.abs(diff), speedMps * dt);
  state.currentY += state.direction * stepDist;
}

// ============================================================================
// DIGITAL SCREEN ADVERTISING & CREDIT CYCLE
// ============================================================================
export type DigitalBillboardSlide =
  | { kind: 'credit'; headline: string; subline: string; accent: string }
  | { kind: 'clothes_sale'; headline: string; subline: string; accent: string }
  | { kind: 'watch_sale'; headline: string; subline: string; accent: string }
  | { kind: 'promo'; headline: string; subline: string; accent: string };

export const CREATOR_CREDIT_TEXT = 'DEVELOPED BY AFTAB BALOCH DADU';

/**
 * Rotates digital advertising boards across 4 vivid slides, dedicating ~5s of every 18s loop
 * to "DEVELOPED BY AFTAB BALOCH DADU" and showcasing Fashion Clothes & Watch Discounts.
 */
export function getBillboardSlideForTime(elapsedSec: number, screenSeed = 0): DigitalBillboardSlide {
  const cycleSec = 18;
  const t = (((elapsedSec + screenSeed * 4.5) % cycleSec) + cycleSec) % cycleSec;
  if (t < 5.0) {
    return {
      kind: 'credit',
      headline: CREATOR_CREDIT_TEXT,
      subline: 'UNIFIED MEGA-WORLD SIMULATOR',
      accent: '#fbbf24',
    };
  }
  if (t < 9.5) {
    return {
      kind: 'clothes_sale',
      headline: '50% OFF DESIGNER CLOTHES',
      subline: 'ATRIUM MALL 1F · FASHION FLASH SALE',
      accent: '#ec4899',
    };
  }
  if (t < 14.0) {
    return {
      kind: 'watch_sale',
      headline: '35% OFF LUXURY WATCHES',
      subline: 'CHRONO BOUTIQUE · SWISS & SMART SERIES',
      accent: '#38bdf8',
    };
  }
  return {
    kind: 'promo',
    headline: 'GRAND RESORT & SKI SLOPES',
    subline: 'CAR SHOWROOM · ALL LUXURY RIDES',
    accent: '#22c55e',
  };
}

// ============================================================================
// UNIFIED MEGA-WORLD DISTRICT LOCATOR
// ============================================================================
export type MegaWorldDistrict =
  | 'Central Resort & Mall Hub'
  | 'Paradise Valley & Snow Slopes'
  | 'Apex Luxury Mansion'
  | 'Metro Stadium & Rail Hub'
  | 'Paris Seine & Iron Tower'
  | 'Residential Suburb & Gardens'
  | 'Dropzone Compound & Base'
  | 'Festival Amusement Park'
  | 'Downtown Bay District'
  | 'Civic & Hospital Quarter'
  | 'Bay Coastal Beach & Port'
  | 'East Ring Metropolis'
  | 'International Airport'
  | 'Grand Royal Castle'
  | 'Grand Chinatown'
  | 'Isometric Valley & Mountains'
  | 'Western Ocean Sky Bridge'
  | 'Cyber-Tokyo & Grand Prix'
  | 'Apex Spaceport Launch Complex'
  | 'Helios Eco-Biodomes & Monorail'
  | 'Helios Marina & Lighthouse'
  | 'Sun Pyramid & Canyon Oasis'
  | 'Future Lab & Science Museum'
  | SmartCityDistrictName;

export function getMegaWorldDistrictAt(x: number, z: number): MegaWorldDistrict {
  if (isInSmartCityZone(x, z)) {
    return getSmartCityDistrictAt(x, z);
  }
  if (isInScienceDistrictZone(x, z)) {
    return 'Future Lab & Science Museum';
  }
  if (x <= -265) {
    if (x > -444) return 'Western Ocean Sky Bridge';
    if (x < -895) {
      if (z <= 35) return 'Apex Spaceport Launch Complex';
      return 'Sun Pyramid & Canyon Oasis';
    }
    if (z <= -38) return 'Cyber-Tokyo & Grand Prix';
    if (z >= 165) return 'Helios Marina & Lighthouse';
    return 'Helios Eco-Biodomes & Monorail';
  }
  if (x >= 775) {
    if (x >= 1135 && z <= -110) return 'International Airport';
    if (x >= 1135 && z >= 75) return 'Grand Royal Castle';
    if (x >= 1135) return 'Isometric Valley & Mountains';
    if (z >= 158) return 'Grand Chinatown';
    return 'East Ring Metropolis';
  }
  if (x > 240) {
    if (x >= 530) return 'Bay Coastal Beach & Port';
    if (z < -30) return 'Civic & Hospital Quarter';
    return 'Downtown Bay District';
  }
  if (x >= -104 && x <= 104 && z <= -228 && z >= -465) {
    return 'Apex Luxury Mansion';
  }
  if (x >= 52 && x <= 118 && z >= 56 && z <= 118) {
    return 'Festival Amusement Park';
  }
  if (x >= 148 && Math.abs(z) <= 85) {
    return 'Dropzone Compound & Base';
  }
  if (Math.abs(x) <= 95 && Math.abs(z) <= 95) {
    return 'Central Resort & Mall Hub';
  }
  if (x < 0 && z < 0) return 'Paradise Valley & Snow Slopes';
  if (x >= 0 && z < 0) return 'Metro Stadium & Rail Hub';
  if (x < 0 && z >= 0) return 'Paris Seine & Iron Tower';
  return 'Residential Suburb & Gardens';
}

// ============================================================================
// PURE 2D CIRCLE-VS-COLLIDER PUSH-OUT (Prevents NPCs/Gangs passing through walls)
// ============================================================================
export interface SimColliderBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  cx?: number;
  cz?: number;
  halfW?: number;
  halfD?: number;
  rotY?: number;
  cosY?: number;
  sinY?: number;
}

export function resolveCircleColliders2D(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  colliders: readonly SimColliderBox[],
): { x: number; z: number; collided: boolean } {
  let px = x;
  let pz = z;
  let collided = false;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (y + height <= c.minY || y >= c.maxY - 0.35) continue;
    if (px + radius <= c.minX || px - radius >= c.maxX || pz + radius <= c.minZ || pz - radius >= c.maxZ) {
      continue;
    }

    if (c.rotY && Math.abs(c.rotY) > 0.001 && c.cx !== undefined && c.cz !== undefined && c.halfW !== undefined && c.halfD !== undefined && c.cosY !== undefined && c.sinY !== undefined) {
      const relX = px - c.cx;
      const relZ = pz - c.cz;
      const lx = relX * c.cosY - relZ * c.sinY;
      const lz = relX * c.sinY + relZ * c.cosY;
      const closestX = Math.max(-c.halfW, Math.min(c.halfW, lx));
      const closestZ = Math.max(-c.halfD, Math.min(c.halfD, lz));
      const dx = lx - closestX;
      const dz = lz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        collided = true;
        let pushLx = 0;
        let pushLz = 0;
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          pushLx = (dx / dist) * push;
          pushLz = (dz / dist) * push;
        } else {
          const penL = Math.abs(lx + c.halfW);
          const penR = Math.abs(c.halfW - lx);
          const penB = Math.abs(lz + c.halfD);
          const penF = Math.abs(c.halfD - lz);
          const minP = Math.min(penL, penR, penB, penF);
          if (minP === penL) pushLx = -(penL + radius);
          else if (minP === penR) pushLx = penR + radius;
          else if (minP === penB) pushLz = -(penB + radius);
          else pushLz = penF + radius;
        }
        px += pushLx * c.cosY + pushLz * c.sinY;
        pz += -pushLx * c.sinY + pushLz * c.cosY;
      }
    } else {
      const closestX = Math.max(c.minX, Math.min(c.maxX, px));
      const closestZ = Math.max(c.minZ, Math.min(c.maxZ, pz));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        collided = true;
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          px += (dx / dist) * push;
          pz += (dz / dist) * push;
        } else {
          const penL = Math.abs(px - c.minX);
          const penR = Math.abs(c.maxX - px);
          const penB = Math.abs(pz - c.minZ);
          const penF = Math.abs(c.maxZ - pz);
          const minP = Math.min(penL, penR, penB, penF);
          if (minP === penL) px = c.minX - radius;
          else if (minP === penR) px = c.maxX + radius;
          else if (minP === penB) pz = c.minZ - radius;
          else pz = c.maxZ + radius;
        }
      }
    }
  }
  return { x: px, z: pz, collided };
}

export interface ColliderSpatialGrid {
  cellSize: number;
  colliders: readonly SimColliderBox[];
  cells: Map<number, number[]>;
  stampBuf: Uint32Array;
  stampTick: number;
}

function hashGridCell(cx: number, cz: number): number {
  return ((cx + 2048) << 12) | ((cz + 2048) & 0xfff);
}

export function createColliderSpatialGrid(
  colliders: readonly SimColliderBox[],
  cellSize = 24,
): ColliderSpatialGrid {
  const cells = new Map<number, number[]>();
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const minCx = Math.floor(c.minX / cellSize);
    const maxCx = Math.floor(c.maxX / cellSize);
    const minCz = Math.floor(c.minZ / cellSize);
    const maxCz = Math.floor(c.maxZ / cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = hashGridCell(cx, cz);
        let bucket = cells.get(key);
        if (!bucket) {
          bucket = [];
          cells.set(key, bucket);
        }
        bucket.push(i);
      }
    }
  }
  return {
    cellSize,
    colliders,
    cells,
    stampBuf: new Uint32Array(colliders.length),
    stampTick: 1,
  };
}

export function resolveCircleColliders2DGrid(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  grid: ColliderSpatialGrid,
): { x: number; z: number; collided: boolean } {
  let px = x;
  let pz = z;
  let collided = false;
  const cs = grid.cellSize;
  const minCx = Math.floor((px - radius) / cs);
  const maxCx = Math.floor((px + radius) / cs);
  const minCz = Math.floor((pz - radius) / cs);
  const maxCz = Math.floor((pz + radius) / cs);

  grid.stampTick++;
  if (grid.stampTick >= 0xfffffffe) {
    grid.stampBuf.fill(0);
    grid.stampTick = 1;
  }
  const tick = grid.stampTick;
  const stamps = grid.stampBuf;
  const cols = grid.colliders;

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const bucket = grid.cells.get(hashGridCell(cx, cz));
      if (!bucket) continue;
      for (let b = 0; b < bucket.length; b++) {
        const idx = bucket[b];
        if (stamps[idx] === tick) continue;
        stamps[idx] = tick;
        const c = cols[idx];
        if (y + height <= c.minY || y >= c.maxY - 0.35) continue;
        if (px + radius <= c.minX || px - radius >= c.maxX || pz + radius <= c.minZ || pz - radius >= c.maxZ) {
          continue;
        }

        if (
          c.rotY &&
          Math.abs(c.rotY) > 0.001 &&
          c.cx !== undefined &&
          c.cz !== undefined &&
          c.halfW !== undefined &&
          c.halfD !== undefined &&
          c.cosY !== undefined &&
          c.sinY !== undefined
        ) {
          const relX = px - c.cx;
          const relZ = pz - c.cz;
          const lx = relX * c.cosY - relZ * c.sinY;
          const lz = relX * c.sinY + relZ * c.cosY;
          const closestX = Math.max(-c.halfW, Math.min(c.halfW, lx));
          const closestZ = Math.max(-c.halfD, Math.min(c.halfD, lz));
          const dx = lx - closestX;
          const dz = lz - closestZ;
          const distSq = dx * dx + dz * dz;
          if (distSq < radius * radius) {
            collided = true;
            let pushLx = 0;
            let pushLz = 0;
            const dist = Math.sqrt(distSq);
            if (dist > 0.0001) {
              const push = radius - dist;
              pushLx = (dx / dist) * push;
              pushLz = (dz / dist) * push;
            } else {
              const penL = Math.abs(lx + c.halfW);
              const penR = Math.abs(c.halfW - lx);
              const penB = Math.abs(lz + c.halfD);
              const penF = Math.abs(c.halfD - lz);
              const minP = Math.min(penL, penR, penB, penF);
              if (minP === penL) pushLx = -(penL + radius);
              else if (minP === penR) pushLx = penR + radius;
              else if (minP === penB) pushLz = -(penB + radius);
              else pushLz = penF + radius;
            }
            px += pushLx * c.cosY + pushLz * c.sinY;
            pz += -pushLx * c.sinY + pushLz * c.cosY;
          }
        } else {
          const closestX = Math.max(c.minX, Math.min(c.maxX, px));
          const closestZ = Math.max(c.minZ, Math.min(c.maxZ, pz));
          const dx = px - closestX;
          const dz = pz - closestZ;
          const distSq = dx * dx + dz * dz;
          if (distSq < radius * radius) {
            collided = true;
            const dist = Math.sqrt(distSq);
            if (dist > 0.0001) {
              const push = radius - dist;
              px += (dx / dist) * push;
              pz += (dz / dist) * push;
            } else {
              const penL = Math.abs(px - c.minX);
              const penR = Math.abs(c.maxX - px);
              const penB = Math.abs(pz - c.minZ);
              const penF = Math.abs(c.maxZ - pz);
              const minP = Math.min(penL, penR, penB, penF);
              if (minP === penL) px = c.minX - radius;
              else if (minP === penR) px = c.maxX + radius;
              else if (minP === penB) pz = c.minZ - radius;
              else pz = c.maxZ + radius;
            }
          }
        }
      }
    }
  }
  return { x: px, z: pz, collided };
}

export function forEachColliderInBounds(
  grid: ColliderSpatialGrid,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  visitor: (index: number) => void,
): void {
  const cs = grid.cellSize;
  const minCx = Math.floor(minX / cs);
  const maxCx = Math.floor(maxX / cs);
  const minCz = Math.floor(minZ / cs);
  const maxCz = Math.floor(maxZ / cs);

  grid.stampTick++;
  if (grid.stampTick >= 0xfffffffe) {
    grid.stampBuf.fill(0);
    grid.stampTick = 1;
  }
  const tick = grid.stampTick;
  const stamps = grid.stampBuf;

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const bucket = grid.cells.get(hashGridCell(cx, cz));
      if (!bucket) continue;
      for (let b = 0; b < bucket.length; b++) {
        const idx = bucket[b];
        if (stamps[idx] === tick) continue;
        stamps[idx] = tick;
        visitor(idx);
      }
    }
  }
}

// ============================================================================
// SINGLE MAP-WIDE CLOSED-LOOP RAILWAY TRACK & STATION STOPS
// ============================================================================
export interface RailwayStationSpec {
  id: string;
  title: string;
  x: number;
  z: number;
  side: 'north' | 'east' | 'south' | 'west';
}

export const MEGA_RAILWAY_HALF_SPAN = 228;

export const MEGA_RAILWAY_WAYPOINTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: -228, z: -228 },
  { x: 228, z: -228 },
  { x: 228, z: 228 },
  { x: -228, z: 228 },
];

export const MEGA_RAILWAY_STATIONS: ReadonlyArray<RailwayStationSpec> = [
  { id: 'station_metro_north', title: 'NORTH METRO CENTRAL', x: 76, z: -228, side: 'north' },
  { id: 'station_dropzone_east', title: 'EAST DROPZONE DEPOT', x: 228, z: -48, side: 'east' },
  { id: 'station_suburb_south', title: 'SOUTH SEINE & SUBURB', x: -72, z: 228, side: 'south' },
  { id: 'station_valley_west', title: 'WEST ALPINE EXPRESS', x: -228, z: 48, side: 'west' },
];

export const MEGA_RAILWAY_LOOP_LENGTH = MEGA_RAILWAY_HALF_SPAN * 8; // 4 sides * 456m = 1824m

export function sampleRailwayLoop(distanceMeters: number): {
  x: number;
  z: number;
  yaw: number;
  nearestStation: RailwayStationSpec | null;
  distToStation: number;
} {
  const L = MEGA_RAILWAY_LOOP_LENGTH;
  const sideLen = MEGA_RAILWAY_HALF_SPAN * 2;
  const d = ((distanceMeters % L) + L) % L;
  const H = MEGA_RAILWAY_HALF_SPAN;

  let x = 0;
  let z = 0;
  let yaw = 0;

  if (d < sideLen) {
    // North edge: (-H, -H) -> (+H, -H), heading +X
    x = -H + d;
    z = -H;
    yaw = Math.PI * 0.5;
  } else if (d < sideLen * 2) {
    // East edge: (+H, -H) -> (+H, +H), heading +Z
    x = H;
    z = -H + (d - sideLen);
    yaw = 0;
  } else if (d < sideLen * 3) {
    // South edge: (+H, +H) -> (-H, +H), heading -X
    x = H - (d - sideLen * 2);
    z = H;
    yaw = -Math.PI * 0.5;
  } else {
    // West edge: (-H, +H) -> (-H, -H), heading -Z
    x = -H;
    z = H - (d - sideLen * 3);
    yaw = Math.PI;
  }

  let nearestStation: RailwayStationSpec | null = null;
  let distToStation = Infinity;
  for (let i = 0; i < MEGA_RAILWAY_STATIONS.length; i++) {
    const st = MEGA_RAILWAY_STATIONS[i];
    const dist = Math.hypot(x - st.x, z - st.z);
    if (dist < distToStation) {
      distToStation = dist;
      nearestStation = st;
    }
  }

  return { x, z, yaw, nearestStation, distToStation };
}

// ============================================================================
// 5-MEMBER CIGARETTE & GUN GANG PROVOCATION, 7 BOSS ARCHETYPES & COMBAT AI
// ============================================================================
export type GangBossStyleId =
  | 'don_crimson'
  | 'spectre_crow'
  | 'baron_noir'
  | 'don_lion'
  | 'emir_aurelius'
  | 'big_barnaby'
  | 'kaos_viper';

export interface GangBossSpec {
  id: GangBossStyleId;
  bossName: string;
  squadName: string;
  suitHex: number;
  shirtHex: number;
  accentHex: number;
  hatHex: number;
  bossHp: number;
}

export const GANG_BOSS_CATALOG: ReadonlyArray<GangBossSpec> = [
  {
    id: 'don_crimson',
    bossName: 'Don Crimson',
    squadName: 'Crimson Mask Syndicate',
    suitHex: 0x1e2028,
    shirtHex: 0xf8fafc,
    accentHex: 0xdc2626,
    hatHex: 0x111827,
    bossHp: 240,
  },
  {
    id: 'spectre_crow',
    bossName: 'Spectre Crow',
    squadName: 'Spectre Crow Cartel',
    suitHex: 0x0f1117,
    shirtHex: 0xe2e8f0,
    accentHex: 0x94a3b8,
    hatHex: 0x090b10,
    bossHp: 240,
  },
  {
    id: 'baron_noir',
    bossName: 'Baron Noir',
    squadName: 'Noir Trench Mafia',
    suitHex: 0x161922,
    shirtHex: 0xd1d5db,
    accentHex: 0x38bdf8,
    hatHex: 0x0f172a,
    bossHp: 240,
  },
  {
    id: 'don_lion',
    bossName: 'Victor "Don Lion" Leonov',
    squadName: 'Lion Fur Bratva',
    suitHex: 0x141418,
    shirtHex: 0x581c28,
    accentHex: 0xd97706,
    hatHex: 0x27272a,
    bossHp: 260,
  },
  {
    id: 'emir_aurelius',
    bossName: 'Emir Aurelius',
    squadName: 'Golden Crescent Guard',
    suitHex: 0x0d0f14,
    shirtHex: 0x111827,
    accentHex: 0xfbbf24,
    hatHex: 0x18181b,
    bossHp: 260,
  },
  {
    id: 'big_barnaby',
    bossName: 'Big Barnaby',
    squadName: 'Dockside Old Guard',
    suitHex: 0x365314,
    shirtHex: 0xfef3c7,
    accentHex: 0x78350f,
    hatHex: 0x3f6212,
    bossHp: 270,
  },
  {
    id: 'kaos_viper',
    bossName: 'Kaos Viper',
    squadName: 'Harbor Street Vipers',
    suitHex: 0x334155,
    shirtHex: 0x1e293b,
    accentHex: 0xf97316,
    hatHex: 0x7c2d12,
    bossHp: 230,
  },
];

export interface GangMemberState {
  id: number;
  gangId: number;
  role: 'boss' | 'enforcer' | 'member';
  homeX: number;
  homeZ: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  respawnTimer: number;
  fireCooldown: number;
  strafeSign: 1 | -1;
}

export interface GangSquadState {
  gangId: number;
  name: string;
  bossId: GangBossStyleId;
  bossName: string;
  anchorX: number;
  anchorZ: number;
  hostile: boolean;
  alertTimer: number;
  lastTargetX: number;
  lastTargetZ: number;
  members: GangMemberState[];
}

export function createGangSquads(
  anchors: ReadonlyArray<{ name: string; x: number; z: number; bossId?: GangBossStyleId }>,
  startNpcId = 5000,
): GangSquadState[] {
  const squads: GangSquadState[] = [];
  let nextId = startNpcId;
  for (let g = 0; g < anchors.length; g++) {
    const a = anchors[g];
    const bossSpec =
      (a.bossId ? GANG_BOSS_CATALOG.find((b) => b.id === a.bossId) : undefined) ??
      GANG_BOSS_CATALOG[g % GANG_BOSS_CATALOG.length];
    const members: GangMemberState[] = [];
    for (let m = 0; m < 5; m++) {
      const ang = (m / 5) * Math.PI * 2;
      const rad = m === 0 ? 0.45 : 2.55;
      const rx = a.x + Math.cos(ang) * rad;
      const rz = a.z + Math.sin(ang) * rad;
      const role: GangMemberState['role'] = m === 0 ? 'boss' : m === 1 ? 'enforcer' : 'member';
      const maxHp = role === 'boss' ? bossSpec.bossHp : role === 'enforcer' ? 130 : 100;
      members.push({
        id: nextId++,
        gangId: g,
        role,
        homeX: rx,
        homeZ: rz,
        x: rx,
        y: 0,
        z: rz,
        yaw: ang + Math.PI,
        hp: maxHp,
        maxHp,
        dead: false,
        respawnTimer: 0,
        fireCooldown: 0.4 + (m % 3) * 0.28,
        strafeSign: m % 2 === 0 ? 1 : -1,
      });
    }
    squads.push({
      gangId: g,
      name: a.name,
      bossId: bossSpec.id,
      bossName: bossSpec.bossName,
      anchorX: a.x,
      anchorZ: a.z,
      hostile: false,
      alertTimer: 0,
      lastTargetX: a.x,
      lastTargetZ: a.z,
      members,
    });
  }
  return squads;
}

export function provokeGangSquad(
  squads: GangSquadState[],
  gangId: number,
  targetX: number,
  targetZ: number,
): GangSquadState | null {
  const sq = squads.find((s) => s.gangId === gangId);
  if (!sq) return null;
  sq.hostile = true;
  sq.alertTimer = 42;
  sq.lastTargetX = targetX;
  sq.lastTargetZ = targetZ;
  return sq;
}

export function stepGangMemberDecision(
  member: GangMemberState,
  squad: GangSquadState,
  playerX: number,
  playerZ: number,
): {
  mode: 'smoke_idle' | 'pursue' | 'strafe_shoot';
  moveDirX: number;
  moveDirZ: number;
  aimYaw: number;
  shouldShoot: boolean;
} {
  if (!squad.hostile) {
    const dx = squad.anchorX - member.x;
    const dz = squad.anchorZ - member.z;
    const dHome = Math.hypot(member.homeX - member.x, member.homeZ - member.z);
    if (dHome > 1.2) {
      return {
        mode: 'smoke_idle',
        moveDirX: (member.homeX - member.x) / dHome,
        moveDirZ: (member.homeZ - member.z) / dHome,
        aimYaw: Math.atan2(dx, dz),
        shouldShoot: false,
      };
    }
    return {
      mode: 'smoke_idle',
      moveDirX: 0,
      moveDirZ: 0,
      aimYaw: Math.atan2(dx, dz),
      shouldShoot: false,
    };
  }

  const dx = playerX - member.x;
  const dz = playerZ - member.z;
  const dist = Math.hypot(dx, dz) || 1;
  const aimYaw = Math.atan2(dx, dz);

  if (dist > 14) {
    return {
      mode: 'pursue',
      moveDirX: dx / dist,
      moveDirZ: dz / dist,
      aimYaw,
      shouldShoot: dist < 38 && member.fireCooldown <= 0,
    };
  }

  // Optimal combat range: strafe around player & shoot
  const perpX = (-dz / dist) * member.strafeSign;
  const perpZ = (dx / dist) * member.strafeSign;
  const approachFactor = dist < 6.5 ? -0.35 : 0.2;
  const mx = perpX * 0.85 + (dx / dist) * approachFactor;
  const mz = perpZ * 0.85 + (dz / dist) * approachFactor;
  const mLen = Math.hypot(mx, mz) || 1;
  return {
    mode: 'strafe_shoot',
    moveDirX: mx / mLen,
    moveDirZ: mz / mLen,
    aimYaw,
    shouldShoot: member.fireCooldown <= 0,
  };
}

// ============================================================================
// MULTI-FLOOR MALL & DOORWAY NAVIGATION (Fixes auto-levitation & wall clipping)
// ============================================================================
export interface MallNavSpec {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  doorNorthZ: number;
  doorSouthZ: number;
  elevatorX: number;
  elevatorZ: number;
  stairX: number;
  stair2X?: number;
  stairBottomZ: number;
  stairMidZ: number;
  stairTopZ: number;
  floorHeight: number;
}

export function isInsideBuildingFootprint(
  x: number,
  z: number,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
): boolean {
  return Math.abs(x - cx) <= halfW && Math.abs(z - cz) <= halfD;
}

export function computeMallMultiFloorWaypoint(
  npcX: number,
  npcY: number,
  npcZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  mall: MallNavSpec,
  elevator: ElevatorState,
): {
  wx: number;
  wy: number;
  wz: number;
  canRideElevator: boolean;
  onStairs: boolean;
} {
  const curInside = isInsideBuildingFootprint(npcX, npcZ, mall.cx, mall.cz, mall.halfW - 0.6, mall.halfD - 0.6);
  const tgtInside = isInsideBuildingFootprint(targetX, targetZ, mall.cx, mall.cz, mall.halfW, mall.halfD);

  // Funnel through North/South open doorways when entering or exiting ground floor
  const doorZ = npcZ >= mall.cz ? mall.doorSouthZ : mall.doorNorthZ;
  if (!curInside && tgtInside) {
    if (Math.hypot(npcX - mall.cx, npcZ - doorZ) > 2.8) {
      return { wx: mall.cx, wy: 0, wz: doorZ, canRideElevator: false, onStairs: false };
    }
  }
  if (curInside && !tgtInside && npcY < 0.85) {
    const outDoorZ = targetZ >= mall.cz ? mall.doorSouthZ : mall.doorNorthZ;
    if (Math.hypot(npcX - mall.cx, npcZ - outDoorZ) > 2.8) {
      return { wx: mall.cx, wy: 0, wz: outDoorZ, canRideElevator: false, onStairs: false };
    }
  }

  const fh = mall.floorHeight;
  const curFloor = Math.max(0, Math.min(2, Math.round(npcY / fh)));
  const tgtFloor = Math.max(0, Math.min(2, Math.round(targetY / fh)));

  // Same floor navigation -> never walk into elevator pit or stairs mid-span unnecessarily
  if (curFloor === tgtFloor && Math.abs(targetY - npcY) <= 0.85) {
    return { wx: targetX, wy: curFloor * fh, wz: targetZ, canRideElevator: false, onStairs: false };
  }

  // Different floor inside mall -> ONLY ride elevator cabin if inside cab OR climb continuous stairs!
  const distToShaft = Math.hypot(npcX - mall.elevatorX, npcZ - mall.elevatorZ);
  const shaftMatchingFloor = Math.abs(elevator.currentY - npcY) < 0.65 && elevator.doorsOpenProgress > 0.45;
  if (distToShaft < 1.55) {
    const arrivedAtTargetFloor = Math.abs(elevator.currentY - targetY) < 0.65 && elevator.doorsOpenProgress > 0.45;
    if (arrivedAtTargetFloor) {
      return { wx: targetX, wy: targetY, wz: targetZ, canRideElevator: false, onStairs: false };
    }
    return { wx: mall.elevatorX, wy: elevator.currentY, wz: mall.elevatorZ, canRideElevator: true, onStairs: false };
  }

  // Dual-flight stairwell check: Flight A (1F<->2F at stairX) goes BottomZ (+Z) -> MidZ (-Z)
  // Flight B (2F<->3F at stair2X) goes MidZ (-Z) -> TopZ (+Z)
  const stair2X = mall.stair2X ?? mall.stairX;
  const goingUp = tgtFloor > curFloor;
  const useFlightA = (curFloor === 0 && goingUp) || (curFloor === 1 && !goingUp);
  const activeStairX = useFlightA ? mall.stairX : stair2X;

  // If NPC is already near East stairwell zone, route cleanly through stair landing & ramp!
  if (npcX > mall.cx + mall.halfW * 0.42 || Math.abs(npcX - activeStairX) < 4.4) {
    const startZ = useFlightA ? mall.stairBottomZ : mall.stairMidZ;
    const endZ = useFlightA ? mall.stairMidZ : mall.stairTopZ;
    const lowY = useFlightA ? 0 : fh;
    const highY = useFlightA ? fh : fh * 2;
    const enterZ = goingUp ? startZ : endZ;
    const exitZ = goingUp ? endZ : startZ;

    // Step 1: align with entrance landing on current floor before climbing
    const alignedX = Math.abs(npcX - activeStairX) < 1.65;
    const nearExit = Math.abs(npcZ - exitZ) < 1.8 && Math.abs(npcY - (goingUp ? highY : lowY)) < 0.85;
    if (nearExit) {
      return { wx: targetX, wy: goingUp ? highY : lowY, wz: targetZ, canRideElevator: false, onStairs: false };
    }

    const minZ = Math.min(startZ, endZ);
    const maxZ = Math.max(startZ, endZ);
    const inZBand = npcZ >= minZ - 0.6 && npcZ <= maxZ + 0.6;
    if (!alignedX || (!inZBand && Math.abs(npcZ - enterZ) > 2.2)) {
      const landingZ = enterZ + (enterZ >= mall.cz ? 1.8 : -1.8);
      return { wx: activeStairX, wy: curFloor * fh, wz: landingZ, canRideElevator: false, onStairs: false };
    }

    const span = endZ - startZ;
    const t = Math.abs(span) < 0.001 ? 0 : Math.max(0, Math.min(1, (npcZ - startZ) / span));
    const rampY = lowY + t * (highY - lowY);
    return { wx: activeStairX, wy: rampY, wz: exitZ, canRideElevator: false, onStairs: true };
  }

  // Otherwise use elevator vestibule (wait at z + 2.7 until doors open on NPC's current floor)
  if (distToShaft < 3.9 && shaftMatchingFloor) {
    return { wx: mall.elevatorX, wy: npcY, wz: mall.elevatorZ, canRideElevator: false, onStairs: false };
  }
  return { wx: mall.elevatorX, wy: npcY, wz: mall.elevatorZ + 2.8, canRideElevator: false, onStairs: false };
}

/**
 * Ensures walking NPCs entering/exiting the Waterfront Hotel pass through North/South doorways
 * instead of pushing blindly against exterior walls.
 */
export function computeHotelDoorwayWaypoint(
  npcX: number,
  npcZ: number,
  targetX: number,
  targetZ: number,
  hotel: {
    cx: number;
    cz: number;
    halfW: number;
    halfD: number;
    doorNorth: { x: number; z: number };
    doorSouth: { x: number; z: number };
  },
): { wx: number; wz: number } {
  const curInside = isInsideBuildingFootprint(npcX, npcZ, hotel.cx, hotel.cz, hotel.halfW, hotel.halfD);
  const tgtInside = isInsideBuildingFootprint(targetX, targetZ, hotel.cx, hotel.cz, hotel.halfW, hotel.halfD);
  if (curInside === tgtInside) {
    return { wx: targetX, wz: targetZ };
  }
  const dNorth = Math.hypot(npcX - hotel.doorNorth.x, npcZ - hotel.doorNorth.z) +
    Math.hypot(targetX - hotel.doorNorth.x, targetZ - hotel.doorNorth.z);
  const dSouth = Math.hypot(npcX - hotel.doorSouth.x, npcZ - hotel.doorSouth.z) +
    Math.hypot(targetX - hotel.doorSouth.x, targetZ - hotel.doorSouth.z);
  const door = dNorth <= dSouth ? hotel.doorNorth : hotel.doorSouth;
  const distToDoor = Math.hypot(npcX - door.x, npcZ - door.z);
  if (distToDoor > 2.1) {
    return { wx: door.x, wz: door.z };
  }
  return { wx: targetX, wz: targetZ };
}

// ============================================================================
// AMBIENT NPC VEHICLE FUELING & ORIENTED BOX COLLISION HELPERS
// ============================================================================
export type RoadVehicleFuelStage = 'cruise' | 'approach_bay' | 'refueling' | 'exit_bay';

export interface VehicleRefuelTracker {
  stage: RoadVehicleFuelStage;
  fuelLevel: number; // 0..100
  refuelTimer: number;
  bayX: number;
  bayZ: number;
  bayYaw: number;
  returnX: number;
  returnZ: number;
}

export function createVehicleRefuelTracker(initialFuel = 65): VehicleRefuelTracker {
  return {
    stage: 'cruise',
    fuelLevel: initialFuel,
    refuelTimer: 0,
    bayX: 0,
    bayZ: 0,
    bayYaw: 0,
    returnX: 0,
    returnZ: 0,
  };
}

export function stepVehicleRefuelState(
  tracker: VehicleRefuelTracker,
  vx: number,
  vz: number,
  dt: number,
  bays: ReadonlyArray<{ x: number; z: number; yaw: number }>,
): RoadVehicleFuelStage {
  if (tracker.stage === 'cruise') {
    tracker.fuelLevel = Math.max(0, tracker.fuelLevel - dt * 2.4);
    if (tracker.fuelLevel <= 20 && bays.length > 0) {
      let best = bays[0];
      let bestD = Math.hypot(best.x - vx, best.z - vz);
      for (let i = 1; i < bays.length; i++) {
        const d = Math.hypot(bays[i].x - vx, bays[i].z - vz);
        if (d < bestD) {
          best = bays[i];
          bestD = d;
        }
      }
      if (bestD < 68) {
        tracker.stage = 'approach_bay';
        tracker.bayX = best.x;
        tracker.bayZ = best.z;
        tracker.bayYaw = best.yaw;
        tracker.returnX = vx;
        tracker.returnZ = vz;
      }
    }
  } else if (tracker.stage === 'approach_bay') {
    if (Math.hypot(tracker.bayX - vx, tracker.bayZ - vz) < 1.6) {
      tracker.stage = 'refueling';
      tracker.refuelTimer = 3.5;
    }
  } else if (tracker.stage === 'refueling') {
    tracker.refuelTimer -= dt;
    tracker.fuelLevel = Math.min(100, tracker.fuelLevel + dt * 24);
    if (tracker.refuelTimer <= 0) {
      tracker.fuelLevel = 100;
      tracker.stage = 'exit_bay';
    }
  } else if (tracker.stage === 'exit_bay') {
    if (Math.hypot(tracker.returnX - vx, tracker.returnZ - vz) < 2.4) {
      tracker.stage = 'cruise';
    }
  }
  return tracker.stage;
}

export function buildOrientedBoxCollider(
  cx: number,
  minY: number,
  cz: number,
  width: number,
  height: number,
  depth: number,
  yaw: number,
): SimColliderBox {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const halfW = (width * Math.abs(cosY) + depth * Math.abs(sinY)) * 0.5;
  const halfD = (width * Math.abs(sinY) + depth * Math.abs(cosY)) * 0.5;
  return {
    minX: cx - halfW,
    maxX: cx + halfW,
    minY,
    maxY: minY + height,
    minZ: cz - halfD,
    maxZ: cz + halfD,
    cx,
    cz,
    halfW: width * 0.5,
    halfD: depth * 0.5,
    rotY: yaw,
    cosY,
    sinY,
  };
}

export function pickRespawnPosition(
  seed: number,
  candidates: ReadonlyArray<{ x: number; y: number; z: number }>,
  avoidX: number,
  avoidZ: number,
): { x: number; y: number; z: number } {
  if (candidates.length === 0) return { x: 0, y: 0, z: 24 };
  const start = ((seed % candidates.length) + candidates.length) % candidates.length;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[(start + i) % candidates.length];
    if (Math.hypot(c.x - avoidX, c.z - avoidZ) > 22) {
      return c;
    }
  }
  return candidates[start];
}

// ============================================================================
// PEDESTRIAN CROSSWALK SIGNAL YIELDING & DYNAMIC OBSTACLE AVOIDANCE
// ============================================================================
export function shouldPedestrianWaitAtCrosswalk(
  px: number,
  pz: number,
  targetX: number,
  targetZ: number,
  intersections: ReadonlyArray<{ x: number; z: number; offsetSec: number }>,
  elapsedSec: number,
): boolean {
  const dx = targetX - px;
  const dz = targetZ - pz;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.8) return false;
  const ndx = dx / dist;
  const ndz = dz / dist;

  for (let i = 0; i < intersections.length; i++) {
    const inter = intersections[i];
    const relX = px - inter.x;
    const relZ = pz - inter.z;
    // Curb waiting band around the crosswalk edge (7.2m .. 10.6m from intersection center)
    const inCrosswalkZoneNS = Math.abs(relX) < 11.2 && Math.abs(relZ) >= 7.0 && Math.abs(relZ) <= 10.6;
    const inCrosswalkZoneEW = Math.abs(relZ) < 11.2 && Math.abs(relX) >= 7.0 && Math.abs(relX) <= 10.6;
    if (!inCrosswalkZoneNS && !inCrosswalkZoneEW) continue;

    const sig = computeTrafficSignalState(elapsedSec, inter.offsetSec);
    // Crossing across EW roadway (heading along Z toward road center) requires EW cars to be RED
    if (inCrosswalkZoneNS && relZ * ndz < -0.35 && Math.abs(ndz) > 0.55) {
      if (sig.ew !== 'RED') return true;
    }
    // Crossing across NS roadway (heading along X toward road center) requires NS cars to be RED
    if (inCrosswalkZoneEW && relX * ndx < -0.35 && Math.abs(ndx) > 0.55) {
      if (sig.ns !== 'RED') return true;
    }
  }
  return false;
}

export function computeObstacleAvoidanceDir(
  nx: number,
  nz: number,
  desiredDirX: number,
  desiredDirZ: number,
  blockers: ReadonlyArray<{ x: number; z: number; radius: number }>,
): { x: number; z: number; steering: boolean } {
  const dLen = Math.hypot(desiredDirX, desiredDirZ) || 1;
  const fx = desiredDirX / dLen;
  const fz = desiredDirZ / dLen;
  let steerX = fx;
  let steerZ = fz;
  let steering = false;

  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i];
    const bx = b.x - nx;
    const bz = b.z - nz;
    const dist = Math.hypot(bx, bz);
    const checkRange = b.radius + 2.6;
    if (dist < 0.05 || dist > checkRange) continue;
    const forwardDot = (bx * fx + bz * fz) / dist;
    if (forwardDot < 0.25) continue;

    // Lateral repulsion perpendicular to forward vector
    const cross = fx * bz - fz * bx;
    const sideSign = cross >= 0 ? -1 : 1;
    const perpX = -fz * sideSign;
    const perpZ = fx * sideSign;
    const weight = ((checkRange - dist) / checkRange) * 1.45;
    steerX += perpX * weight;
    steerZ += perpZ * weight;
    steering = true;
  }

  const outLen = Math.hypot(steerX, steerZ) || 1;
  return { x: steerX / outLen, z: steerZ / outLen, steering };
}

// ============================================================================
// FESTIVAL AMUSEMENT PARK ROLLER COASTER TRACK SAMPLER (Continuous Closed Loop)
// ============================================================================
export function sampleRollerCoasterTrack(
  tNorm: number,
  centerX = 0,
  centerZ = 0,
  radiusX = 11.0,
  radiusZ = 6.2,
): { x: number; y: number; z: number; yaw: number; pitch: number } {
  const evalAt = (t: number) => {
    const th = (((t % 1) + 1) % 1) * Math.PI * 2;
    const x = centerX + Math.cos(th) * radiusX + Math.sin(th * 2) * 1.6;
    const z = centerZ + Math.sin(th) * radiusZ;
    // Closed multi-peak coaster profile: tall lift crest + exciting twin dips!
    const y =
      5.2 +
      Math.sin(th) * 3.2 +
      Math.cos(th * 2) * 1.65 +
      Math.sin(th * 3) * 0.7;
    return { x, y, z };
  };

  const eps = 0.004;
  const p = evalAt(tNorm);
  const next = evalAt(tNorm + eps);
  const dx = next.x - p.x;
  const dy = next.y - p.y;
  const dz = next.z - p.z;
  const horiz = Math.hypot(dx, dz) || 0.001;
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: Math.atan2(dx, dz),
    pitch: -Math.atan2(dy, horiz),
  };
}

// ============================================================================
// RARE PROXIMITY-BASED WANTED LEVEL SYSTEM (LEVELS 1-5)
// ============================================================================
export const WANTED_POLICE_KILL_THRESHOLDS = {
  2: 5,
  3: 10,
  4: 15,
  5: 30,
} as const;

export const WANTED_WITNESS_RADIUS_CIVILIAN = 48;
export const WANTED_WITNESS_RADIUS_POLICE = 90;
export const WANTED_EVADE_SAFE_DISTANCE = 48;
export const WANTED_STEP_DOWN_SEC = 14.0;

export type WantedIncidentKind =
  | 'ambient_shot'
  | 'object'
  | 'explosion'
  | 'gang'
  | 'civilian_crime'
  | 'police_crime';

export interface WantedLevelState {
  level: number;
  policeKills: number;
  evadeTimer: number;
  isEvading: boolean;
}

export function createWantedLevelState(): WantedLevelState {
  return {
    level: 0,
    policeKills: 0,
    evadeTimer: 0,
    isEvading: false,
  };
}

export function computeWantedLevelFromPoliceKills(policeKills: number, isWanted: boolean): number {
  if (!isWanted) return 0;
  if (policeKills >= WANTED_POLICE_KILL_THRESHOLDS[5]) return 5;
  if (policeKills >= WANTED_POLICE_KILL_THRESHOLDS[4]) return 4;
  if (policeKills >= WANTED_POLICE_KILL_THRESHOLDS[3]) return 3;
  if (policeKills >= WANTED_POLICE_KILL_THRESHOLDS[2]) return 2;
  return 1;
}

export function registerWantedIncident(
  state: WantedLevelState,
  incident: WantedIncidentKind,
  nearestPoliceDist: number,
  killedPolice = false,
): boolean {
  if (
    incident === 'ambient_shot' ||
    incident === 'object' ||
    incident === 'explosion' ||
    incident === 'gang'
  ) {
    return false;
  }

  const prevLevel = state.level;

  if (incident === 'civilian_crime') {
    if (state.level === 0) {
      if (nearestPoliceDist <= WANTED_WITNESS_RADIUS_CIVILIAN) {
        state.level = 1;
        state.evadeTimer = 0;
        state.isEvading = false;
      }
    } else if (nearestPoliceDist <= WANTED_WITNESS_RADIUS_CIVILIAN * 1.55) {
      state.evadeTimer = 0;
      state.isEvading = false;
    }
    return state.level !== prevLevel;
  }

  if (incident === 'police_crime') {
    if (killedPolice) {
      state.policeKills++;
    }
    if (state.level === 0) {
      if (nearestPoliceDist <= WANTED_WITNESS_RADIUS_POLICE || killedPolice) {
        state.level = 1;
      }
    }
    if (state.level >= 1) {
      state.level = Math.max(state.level, computeWantedLevelFromPoliceKills(state.policeKills, true));
      state.evadeTimer = 0;
      state.isEvading = false;
    }
    return state.level !== prevLevel;
  }

  return false;
}

export function stepWantedLevelState(
  state: WantedLevelState,
  dt: number,
  nearestPoliceDist: number,
): boolean {
  if (state.level <= 0) {
    state.level = 0;
    state.policeKills = 0;
    state.evadeTimer = 0;
    state.isEvading = false;
    return false;
  }

  if (nearestPoliceDist > WANTED_EVADE_SAFE_DISTANCE) {
    state.isEvading = true;
    state.evadeTimer += dt;
    if (state.evadeTimer >= WANTED_STEP_DOWN_SEC) {
      state.level = Math.max(0, state.level - 1);
      state.evadeTimer = 0;
      if (state.level === 0) {
        state.policeKills = 0;
        state.isEvading = false;
      }
      return true;
    }
  } else {
    state.isEvading = false;
    state.evadeTimer = Math.max(0, state.evadeTimer - dt * 0.5);
  }
  return false;
}

