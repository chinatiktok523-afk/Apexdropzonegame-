import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  buildOrientedBoxCollider,
  computeDailyRoutineGoal,
  computeHotelDoorwayWaypoint,
  computeMallMultiFloorWaypoint,
  computeObstacleAvoidanceDir,
  computeTrafficSignalState,
  createColliderSpatialGrid,
  createElevatorState,
  createGangSquads,
  createVehicleRefuelTracker,
  createWantedLevelState,
  CREATOR_CREDIT_TEXT,
  forEachColliderInBounds,
  GANG_BOSS_CATALOG,
  getBillboardSlideForTime,
  getMegaWorldDistrictAt,
  MEGA_RAILWAY_LOOP_LENGTH,
  NPC_ROLE_CATALOG,
  NPC_ROLE_MAP,
  pickRespawnPosition,
  provokeGangSquad,
  registerWantedIncident,
  requestNextElevatorFloor,
  resolveCircleColliders2D,
  resolveCircleColliders2DGrid,
  sampleRailwayLoop,
  sampleRollerCoasterTrack,
  shouldPedestrianWaitAtCrosswalk,
  shouldVehicleStopAtSignal,
  stepElevatorState,
  stepGangMemberDecision,
  stepVehicleRefuelState,
  stepWantedLevelState,
  TableReservationSystem,
  WANTED_POLICE_KILL_THRESHOLDS,
  WANTED_STEP_DOWN_SEC,
} from './simulatorSystems';

test('NPC_ROLE_CATALOG defines all 30 distinct professions across 6 categories', () => {
  assert.equal(NPC_ROLE_CATALOG.length, 30);
  const uniqueIds = new Set(NPC_ROLE_CATALOG.map((r) => r.id));
  assert.equal(uniqueIds.size, 30);
  const categories = new Set(NPC_ROLE_CATALOG.map((r) => r.category));
  assert.equal(categories.size, 6);
  for (let i = 0; i < 30; i++) {
    assert.equal(NPC_ROLE_CATALOG[i].index, i + 1);
  }
  assert.equal(NPC_ROLE_MAP.waiter.propKind, 'tray');
  assert.equal(NPC_ROLE_MAP.tourist_camera.propKind, 'camera');
  assert.equal(NPC_ROLE_MAP.gardener.propKind, 'watering_can');
  assert.equal(NPC_ROLE_MAP.delivery_worker.propKind, 'parcel');
});

test('computeDailyRoutineGoal adapts dynamically across morning, afternoon, sunset, and night', () => {
  const morningHome = computeDailyRoutineGoal('house_leaver', 'morning', 10, 0);
  assert.equal(morningHome, 'leave_home_for_bus_or_walk');

  const afternoonDine = computeDailyRoutineGoal('restaurant_customer', 'afternoon', 0, 0);
  assert.equal(afternoonDine, 'dine_at_restaurant');

  const nightReturn = computeDailyRoutineGoal('home_returner', 'night', 0, 0);
  assert.equal(nightReturn, 'return_home_or_hotel');
});

test('TableReservationSystem seats diners, turns over tables, and frees seats for arriving NPCs', () => {
  const tables = new TableReservationSystem([
    {
      id: 'seat_1',
      tableId: 't1',
      venue: 'hotel_cafeteria',
      x: 10,
      y: 0,
      z: 10,
      lookAtX: 11,
      lookAtZ: 10,
      hasHotFood: true,
    },
  ]);

  const first = tables.claimFreeSeat(101, 'hotel_cafeteria', 6);
  assert.ok(first);
  assert.equal(first.occupiedByNpcId, 101);
  assert.equal(tables.getOccupiedCount(), 1);

  const blocked = tables.claimFreeSeat(102, 'hotel_cafeteria', 6);
  assert.equal(blocked, null);

  const finished = tables.step(7, 20);
  assert.deepEqual(finished, [101]);
  assert.equal(tables.getOccupiedCount(), 0);

  const second = tables.claimFreeSeat(102, 'hotel_cafeteria', 8);
  assert.ok(second);
  assert.equal(second.occupiedByNpcId, 102);
});

test('TrafficSignalController alternates NS/EW phases and flags approaching vehicles at RED', () => {
  const s0 = computeTrafficSignalState(2, 0);
  assert.equal(s0.ns, 'GREEN');
  assert.equal(s0.ew, 'RED');

  assert.equal(shouldVehicleStopAtSignal(-11, 2, 'ew', 1, 0, 0, s0), true);
  assert.equal(shouldVehicleStopAtSignal(2, -11, 'ns', 1, 0, 0, s0), false);

  const s12 = computeTrafficSignalState(12, 0);
  assert.equal(s12.ns, 'RED');
  assert.equal(s12.ew, 'GREEN');
  assert.equal(shouldVehicleStopAtSignal(-11, 2, 'ew', 1, 0, 0, s12), false);
});

test('Elevator state closes doors, travels smoothly to requested floor, and opens doors', () => {
  const lift = createElevatorState([0, 4.8, 9.6]);
  requestNextElevatorFloor(lift, 1);

  for (let i = 0; i < 40; i++) {
    stepElevatorState(lift, 0.1, 3.0);
  }
  assert.ok(Math.abs(lift.currentY - 4.8) < 0.05);
  assert.ok(lift.doorsOpenProgress > 0.5);
});

test('getBillboardSlideForTime showcases DEVELOPED BY AFTAB BALOCH DADU plus clothes & watch sales', () => {
  const sCredit = getBillboardSlideForTime(2, 0);
  assert.equal(sCredit.kind, 'credit');
  assert.equal(sCredit.headline, CREATOR_CREDIT_TEXT);

  const sClothes = getBillboardSlideForTime(7, 0);
  assert.equal(sClothes.kind, 'clothes_sale');
  assert.match(sClothes.headline, /CLOTHES/i);

  const sWatches = getBillboardSlideForTime(11.5, 0);
  assert.equal(sWatches.kind, 'watch_sale');
  assert.match(sWatches.headline, /WATCHES/i);
});

import { stepBreakableGlassPanes, type BreakableGlassPane } from './arena';
import { resolveDirectionalHitZone } from './simulatorNpcs';
import {
  getSnowMountainHeight,
  isInsidePavedBuildingPad,
  isOnMegaRoad,
  unifiedSimulatorGroundHeight,
} from './unifiedSimulatorArena';
import { VEHICLE_SPECS } from './vehicles';

test('getMegaWorldDistrictAt maps all unified mega-world regions including Dropzone & Festival', () => {
  assert.equal(getMegaWorldDistrictAt(0, 0), 'Central Resort & Mall Hub');
  assert.equal(getMegaWorldDistrictAt(-160, -160), 'Paradise Valley & Snow Slopes');
  assert.equal(getMegaWorldDistrictAt(160, -160), 'Metro Stadium & Rail Hub');
  assert.equal(getMegaWorldDistrictAt(-160, 160), 'Paris Seine & Iron Tower');
  assert.equal(getMegaWorldDistrictAt(160, 160), 'Residential Suburb & Gardens');
  assert.equal(getMegaWorldDistrictAt(186, 36), 'Dropzone Compound & Base');
  assert.equal(getMegaWorldDistrictAt(84, 86), 'Festival Amusement Park');
});

test('Unified Mega-World keeps avenues flat and elevates Snow Mountain slope smoothly', () => {
  assert.equal(isOnMegaRoad(0, 50), true);
  assert.equal(isOnMegaRoad(-140, -140), true);
  assert.equal(unifiedSimulatorGroundHeight(-140, -140), 0);
  const peakY = getSnowMountainHeight(-195, -242);
  const footY = getSnowMountainHeight(-195, -172);
  assert.ok(peakY > 12, `Expected tall snow mountain peak > 12m, got ${peakY}`);
  assert.ok(peakY > footY, 'Snow peak should slope down toward valley');
  assert.ok(unifiedSimulatorGroundHeight(-100, 166) < -1.0);
  const bridgeRamp = [
    { minX: -147, maxX: -133, minZ: 152, maxZ: 180, axis: 'z' as const, startCoord: 152, endCoord: 180, startY: 0.85, endY: 0.85 },
  ];
  assert.equal(unifiedSimulatorGroundHeight(-140, 166, 0, bridgeRamp), 0.85);
});

test('VEHICLE_SPECS supports modern fleet door styles and 1st-person driver seat offsets', () => {
  assert.equal(VEHICLE_SPECS.revuelto_red.doorStyle, 'scissor');
  assert.equal(VEHICLE_SPECS.challenger_scissor.doorStyle, 'scissor');
  assert.equal(VEHICLE_SPECS.gullwing_coupe.doorStyle, 'gullwing');
  assert.equal(VEHICLE_SPECS.range_black_suv.doorStyle, 'swing');
  assert.equal(VEHICLE_SPECS.thar_black_4x4.doorStyle, 'swing');
  assert.equal(VEHICLE_SPECS.digital_bike.doorStyle, 'none');
  assert.ok(VEHICLE_SPECS.lambo_blue_hyper.maxSpeed > VEHICLE_SPECS.thar_black_4x4.maxSpeed);
  assert.ok(VEHICLE_SPECS.revuelto_red.driverSeatOffset[1] > 0.8);
});

test('resolveCircleColliders2D pushes NPC out of hotel wall and ignores elevated ceiling', () => {
  const colliders = [
    { minX: 10, maxX: 14, minY: 0, maxY: 4.5, minZ: 20, maxZ: 40 },
    { minX: 10, maxX: 30, minY: 4.5, maxY: 5.0, minZ: 20, maxZ: 40 },
  ];
  const hitWall = resolveCircleColliders2D(10.1, 0, 30, 0.45, 1.75, colliders);
  assert.equal(hitWall.collided, true);
  assert.ok(hitWall.x <= 10 - 0.44);

  const underCeiling = resolveCircleColliders2D(20, 0, 30, 0.45, 1.75, colliders);
  assert.equal(underCeiling.collided, false);
});

test('sampleRailwayLoop traverses one closed mega-world perimeter loop continuously', () => {
  const start = sampleRailwayLoop(0);
  const full = sampleRailwayLoop(MEGA_RAILWAY_LOOP_LENGTH);
  assert.equal(start.x, -228);
  assert.equal(start.z, -228);
  assert.ok(Math.abs(start.x - full.x) < 0.01);
  assert.ok(Math.abs(start.z - full.z) < 0.01);
});

test('5-member gang squads stay calm smoking until provoked then all 5 members attack', () => {
  const squads = createGangSquads([{ name: 'Dropzone Crew', x: 180, z: 45 }], 5000);
  assert.equal(squads.length, 1);
  assert.equal(squads[0].members.length, 5);
  assert.equal(squads[0].hostile, false);

  const calm = stepGangMemberDecision(squads[0].members[0], squads[0], 170, 45);
  assert.equal(calm.mode, 'smoke_idle');
  assert.equal(calm.shouldShoot, false);

  provokeGangSquad(squads, 0, 170, 45);
  assert.equal(squads[0].hostile, true);
  for (const m of squads[0].members) {
    m.fireCooldown = 0;
    const combat = stepGangMemberDecision(m, squads[0], 170, 45);
    assert.ok(combat.mode === 'pursue' || combat.mode === 'strafe_shoot');
    assert.equal(combat.shouldShoot, true);
  }
});

test('computeMallMultiFloorWaypoint blocks floating outside shaft and routes through open doorway', () => {
  const mall = {
    cx: -44,
    cz: -36,
    halfW: 21,
    halfD: 15,
    doorNorthZ: -51,
    doorSouthZ: -21,
    elevatorX: -44,
    elevatorZ: -36,
    stairX: -26,
    stairBottomZ: -26,
    stairMidZ: -36,
    stairTopZ: -44,
    floorHeight: 4.8,
  };
  const lift = createElevatorState([0, 4.8, 9.6]);

  // Outside NPC targeting floor 2 inside mall -> routes to South Doorway first, cannot levitate!
  const stepOutside = computeMallMultiFloorWaypoint(-50, 0, -10, -52, 4.8, -36, mall, lift);
  assert.equal(stepOutside.canRideElevator, false);
  assert.equal(stepOutside.wx, -44);
  assert.equal(stepOutside.wz, -21);

  // Far from elevator inside mall -> cannot float! Walks to elevator waiting bay
  const stepFar = computeMallMultiFloorWaypoint(-56, 0, -30, -52, 4.8, -36, mall, lift);
  assert.equal(stepFar.canRideElevator, false);

  // Inside elevator cab at y=0 -> permitted to ride!
  const stepInsideCab = computeMallMultiFloorWaypoint(-44, 0, -36, -52, 4.8, -36, mall, lift);
  assert.equal(stepInsideCab.canRideElevator, true);
});

test('pickRespawnPosition selects a distant spot when NPC respawns', () => {
  const chosen = pickRespawnPosition(
    1,
    [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 100 },
    ],
    2,
    2,
  );
  assert.equal(chosen.x, 100);
});

test('computeMallMultiFloorWaypoint supports dual-flight stairs (stair2X) for 2F <-> 3F travel', () => {
  const mall = {
    cx: -44,
    cz: -36,
    halfW: 28,
    halfD: 19,
    doorNorthZ: -55,
    doorSouthZ: -17,
    elevatorX: -44,
    elevatorZ: -36,
    stairX: -21.4,
    stair2X: -18.2,
    stairBottomZ: -24.5,
    stairMidZ: -47.5,
    stairTopZ: -24.5,
    floorHeight: 5.0,
  };
  const lift = createElevatorState([0, 5.0, 10.0]);
  // NPC standing on 2F near Flight B stairwell targeting 3F -> uses stair2X & marks onStairs = true
  const onFlightB = computeMallMultiFloorWaypoint(-18.2, 5.0, -36, -50, 10.0, -36, mall, lift);
  assert.equal(onFlightB.onStairs, true);
  assert.equal(onFlightB.wx, -18.2);
  assert.equal(onFlightB.canRideElevator, false);
});

test('computeHotelDoorwayWaypoint routes external NPCs through nearest open hotel doorway', () => {
  const hotel = {
    cx: 26,
    cz: 34,
    halfW: 13.4,
    halfD: 9.4,
    doorNorth: { x: 26, z: 23.2 },
    doorSouth: { x: 26, z: 44.8 },
  };
  const wp = computeHotelDoorwayWaypoint(20, 12, 24, 32, hotel);
  assert.equal(wp.wx, 26);
  assert.equal(wp.wz, 23.2);

  const insideDirect = computeHotelDoorwayWaypoint(22, 32, 30, 36, hotel);
  assert.equal(insideDirect.wx, 30);
  assert.equal(insideDirect.wz, 36);
});

test('stepVehicleRefuelState transitions cruise -> approach_bay -> refueling -> exit_bay -> cruise', () => {
  const tracker = createVehicleRefuelTracker(18);
  const bays = [{ x: 26, z: -72, yaw: 0 }];

  const s1 = stepVehicleRefuelState(tracker, 10, -72, 0.5, bays);
  assert.equal(s1, 'approach_bay');
  assert.equal(tracker.bayX, 26);

  const s2 = stepVehicleRefuelState(tracker, 25.5, -72, 0.5, bays);
  assert.equal(s2, 'refueling');

  for (let i = 0; i < 8; i++) {
    stepVehicleRefuelState(tracker, 26, -72, 0.6, bays);
  }
  assert.equal(tracker.stage, 'exit_bay');
  assert.equal(tracker.fuelLevel, 100);

  const s4 = stepVehicleRefuelState(tracker, 10, -72, 0.5, bays);
  assert.equal(s4, 'cruise');
});

test('buildOrientedBoxCollider + resolveCircleColliders2D blocks rotated NPC vehicles solidly', () => {
  const obb = buildOrientedBoxCollider(10, 0, 10, 2.0, 1.85, 4.4, Math.PI * 0.25);
  const res = resolveCircleColliders2D(10.2, 0, 10.2, 0.55, 1.75, [obb]);
  assert.equal(res.collided, true);
  assert.ok(Math.hypot(res.x - 10, res.z - 10) > 0.6);
});

test('getMegaWorldDistrictAt covers expanded Apex Bay City East districts', () => {
  assert.equal(getMegaWorldDistrictAt(340, 20), 'Downtown Bay District');
  assert.equal(getMegaWorldDistrictAt(350, -90), 'Civic & Hospital Quarter');
  assert.equal(getMegaWorldDistrictAt(575, 10), 'Bay Coastal Beach & Port');
});

test('shouldPedestrianWaitAtCrosswalk yields on cross-traffic GREEN and walks on RED', () => {
  const inters = [{ x: 0, z: 0, offsetSec: 0 }];
  // At t=12s, EW traffic is GREEN, so NS pedestrian crossing at curb z=8.5 toward z=-12 waits
  assert.equal(shouldPedestrianWaitAtCrosswalk(2, 8.5, 2, -12, inters, 12), true);
  // At t=2s, EW traffic is RED, so NS pedestrian crosses freely
  assert.equal(shouldPedestrianWaitAtCrosswalk(2, 8.5, 2, -12, inters, 2), false);
});

test('computeObstacleAvoidanceDir steers laterally around blocking obstacle ahead', () => {
  const res = computeObstacleAvoidanceDir(0, 0, 0, 1, [{ x: 0.2, z: 1.8, radius: 0.9 }]);
  assert.equal(res.steering, true);
  assert.ok(Math.abs(res.x) > 0.2);
});

test('sampleRollerCoasterTrack forms a continuous smooth 3D closed loop', () => {
  const p0 = sampleRollerCoasterTrack(0, 10, 20);
  const p1 = sampleRollerCoasterTrack(1, 10, 20);
  assert.ok(Math.abs(p0.x - p1.x) < 0.01);
  assert.ok(Math.abs(p0.y - p1.y) < 0.01);
  assert.ok(Math.abs(p0.z - p1.z) < 0.01);
});

test('GANG_BOSS_CATALOG defines all 7 unique named bosses with stronger boss HP', () => {
  assert.equal(GANG_BOSS_CATALOG.length, 7);
  const squads = createGangSquads(
    GANG_BOSS_CATALOG.map((b, idx) => ({
      name: b.squadName,
      x: 50 + idx * 40,
      z: 50,
      bossId: b.id,
    })),
    5000,
  );
  assert.equal(squads.length, 7);
  for (const sq of squads) {
    assert.equal(sq.members.length, 5);
    assert.equal(sq.members[0].role, 'boss');
    assert.ok(sq.members[0].maxHp >= 230);
    assert.equal(sq.members[2].role, 'member');
    assert.equal(sq.members[2].maxHp, 100);
  }
});

test('getMegaWorldDistrictAt maps all 5 Grand East Island districts across Red Suspension Bridge', () => {
  assert.equal(getMegaWorldDistrictAt(975, 0), 'East Ring Metropolis');
  assert.equal(getMegaWorldDistrictAt(1275, -190), 'International Airport');
  assert.equal(getMegaWorldDistrictAt(1285, 188), 'Grand Royal Castle');
  assert.equal(getMegaWorldDistrictAt(955, 228), 'Grand Chinatown');
  assert.equal(getMegaWorldDistrictAt(1340, -10), 'Isometric Valley & Mountains');
});

import { getIsometricRiverZ, EAST_RING_CENTER_X, EAST_RING_CENTER_Z, EAST_RING_INNER_R, EAST_RING_OUTER_R } from './grandEastCity';

test('Grand East City features concentric circular ring boulevards, castle moat, river, snow peaks & bridge link', () => {
  // Concentric circular ring roads around (975, 0)
  assert.equal(isOnMegaRoad(EAST_RING_CENTER_X + EAST_RING_OUTER_R, EAST_RING_CENTER_Z), true);
  assert.equal(isOnMegaRoad(EAST_RING_CENTER_X, EAST_RING_CENTER_Z + EAST_RING_INNER_R), true);
  assert.equal(isOnMegaRoad(955, 228), true); // Chinatown promenade

  // Deep ocean channel at x=660, plus East Landing bridge ramp rideable surface
  assert.ok(unifiedSimulatorGroundHeight(660, 80) < -2.5);
  const bridgeCenterRamp = [
    { minX: 596, maxX: 730, minZ: -6.2, maxZ: 6.2, axis: 'x' as const, startCoord: 596, endCoord: 730, startY: 8.2, endY: 8.2 },
  ];
  assert.equal(unifiedSimulatorGroundHeight(660, 0, 8.2, bridgeCenterRamp), 8.2);

  // Royal Castle moat trench (outer square minus inner courtyard) & inner dry courtyard
  assert.ok(unifiedSimulatorGroundHeight(1160, 188) < -1.0);
  assert.equal(unifiedSimulatorGroundHeight(1285, 188), 0);

  // Isometric Winding River channel & Snow-Capped Mountains
  const rz = getIsometricRiverZ(1280);
  assert.ok(unifiedSimulatorGroundHeight(1280, rz) < -1.0);
  assert.ok(unifiedSimulatorGroundHeight(1435, -82) > 15, 'Eastern isometric mountain peak should exceed 15m');
});

import {
  getGrandWestCityGroundHeight,
  sampleWestGrandPrixTrack,
  WEST_GP_CENTER_X,
  WEST_GP_CENTER_Z,
  WEST_GP_TRACK_LENGTH,
} from './grandWestCity';

test('getMegaWorldDistrictAt maps all 6 Grand West Mega-District zones across West Sky Bridge', () => {
  assert.equal(getMegaWorldDistrictAt(-355, 0), 'Western Ocean Sky Bridge');
  assert.equal(getMegaWorldDistrictAt(-705, -165), 'Cyber-Tokyo & Grand Prix');
  assert.equal(getMegaWorldDistrictAt(-1015, -145), 'Apex Spaceport Launch Complex');
  assert.equal(getMegaWorldDistrictAt(-705, 60), 'Helios Eco-Biodomes & Monorail');
  assert.equal(getMegaWorldDistrictAt(-705, 240), 'Helios Marina & Lighthouse');
  assert.equal(getMegaWorldDistrictAt(-1015, 175), 'Sun Pyramid & Canyon Oasis');
});

test('Grand West City removes blocking West wall, spans Sky Bridge over deep strait, forms closed GP loop, Marina Cove & climbable Sun Pyramid', () => {
  // Blocking West wall removed: flat road landing at West Bridge shore
  assert.equal(unifiedSimulatorGroundHeight(-464, 0), 0);
  assert.equal(isOnMegaRoad(-464, 0), true);

  // Western Ocean Strait between Central Map (-246) and West Mega-District (-464)
  assert.ok(unifiedSimulatorGroundHeight(-355, 45) < -3.0);

  // West Sky Bridge deck at y = 9.0 rideable via RampSurface
  const westBridgeDeck = [
    { minX: -418, maxX: -292, minZ: -6.2, maxZ: 6.2, axis: 'x' as const, startCoord: -418, endCoord: -292, startY: 9.0, endY: 9.0 },
  ];
  assert.equal(unifiedSimulatorGroundHeight(-355, 0, 9.0, westBridgeDeck), 9.0);
  assert.equal(isOnMegaRoad(-355, 0), true);

  // Cyber-Tokyo Grand Prix track forms continuous closed loop & is drivable road
  const gp0 = sampleWestGrandPrixTrack(0);
  const gpEnd = sampleWestGrandPrixTrack(WEST_GP_TRACK_LENGTH);
  assert.ok(Math.abs(gp0.x - gpEnd.x) < 0.05);
  assert.ok(Math.abs(gp0.z - gpEnd.z) < 0.05);
  assert.equal(isOnMegaRoad(gp0.x, gp0.z), true);
  assert.ok(Math.hypot(gp0.x - WEST_GP_CENTER_X, gp0.z - WEST_GP_CENTER_Z) > 50);

  // Marina Cove & Red-Rock Canyon Mesa peaks
  assert.ok(getGrandWestCityGroundHeight(-705, 245) < -1.5);
  assert.ok(unifiedSimulatorGroundHeight(-1122, 102) > 14, 'Western canyon mesa should exceed 14m');

  // Climbable Golden Sun Pyramid East Staircase (x: -992 -> -1009, y: 0 -> 11.0)
  const pyrStair = [
    { minX: -1009, maxX: -992, minZ: 171, maxZ: 179, axis: 'x' as const, startCoord: -992, endCoord: -1009, startY: 0, endY: 11.0 },
  ];
  assert.equal(unifiedSimulatorGroundHeight(-992, 175, 0, pyrStair), 0);
  assert.ok(Math.abs(unifiedSimulatorGroundHeight(-1000.5, 175, 5.5, pyrStair) - 5.5) < 0.05);
  assert.equal(unifiedSimulatorGroundHeight(-1009, 175, 11.0, pyrStair), 11.0);
});

import { WEAPON_ORDER, WEAPON_ZOOM_OPTIONS, WEAPONS } from '../types';

test('All weapons expose proper optic scopeStyle and valid WEAPON_ZOOM_OPTIONS for non-sniper ADS scopes', () => {
  for (const wid of WEAPON_ORDER) {
    const spec = WEAPONS[wid];
    const zooms = WEAPON_ZOOM_OPTIONS[wid];
    assert.ok(spec.scopeStyle.length > 0, `Missing scopeStyle on ${wid}`);
    assert.ok(Array.isArray(zooms) && zooms.length >= 1, `Missing WEAPON_ZOOM_OPTIONS on ${wid}`);
    for (const opt of zooms) {
      assert.ok(opt.fov > 0 && opt.fov < 75, `Unexpected ADS FOV ${opt.fov} on ${wid}`);
      assert.ok(opt.label.length > 0);
    }
  }
  assert.equal(CREATOR_CREDIT_TEXT, 'DEVELOPED BY AFTAB BALOCH DADU');
  assert.ok(NPC_ROLE_MAP.playground_child);
});

test('Wanted level stays rare: gunshots, objects, explosions & gangs never raise stars; police proximity gates Lv1 and kills escalate 5/10/15/30', () => {
  const w = createWantedLevelState();

  // Shooting objects, explosions, ambient shots, or gangs NEVER triggers Wanted even next to police
  assert.equal(registerWantedIncident(w, 'ambient_shot', 12, false), false);
  assert.equal(registerWantedIncident(w, 'object', 12, false), false);
  assert.equal(registerWantedIncident(w, 'explosion', 12, false), false);
  assert.equal(registerWantedIncident(w, 'gang', 12, false), false);
  assert.equal(w.level, 0);

  // Shooting an NPC far away from police (>48m) does NOT trigger Wanted (keeps it rare)
  assert.equal(registerWantedIncident(w, 'civilian_crime', 75, false), false);
  assert.equal(w.level, 0);

  // Shooting an NPC when police are nearby (<=48m) triggers Wanted Level 1
  assert.equal(registerWantedIncident(w, 'civilian_crime', 32, false), true);
  assert.equal(w.level, 1);

  // Killing civilians never raises Wanted above Level 1; only killing police does
  registerWantedIncident(w, 'civilian_crime', 20, false);
  registerWantedIncident(w, 'civilian_crime', 20, false);
  assert.equal(w.level, 1);

  assert.deepEqual(WANTED_POLICE_KILL_THRESHOLDS, {
    2: 5,
    3: 10,
    4: 15,
    5: 30,
  });

  for (let i = 1; i <= 4; i++) {
    registerWantedIncident(w, 'police_crime', 25, true);
    assert.equal(w.level, 1);
  }
  registerWantedIncident(w, 'police_crime', 25, true);
  assert.equal(w.policeKills, 5);
  assert.equal(w.level, 2);

  for (let i = 6; i <= 10; i++) {
    registerWantedIncident(w, 'police_crime', 25, true);
  }
  assert.equal(w.level, 3);

  for (let i = 11; i <= 15; i++) {
    registerWantedIncident(w, 'police_crime', 25, true);
  }
  assert.equal(w.level, 4);

  for (let i = 16; i <= 30; i++) {
    registerWantedIncident(w, 'police_crime', 25, true);
  }
  assert.equal(w.level, 5);

  // Staying close keeps Wanted active; rushing far away starts evading & steps down stars
  assert.equal(stepWantedLevelState(w, 5, 22), false);
  assert.equal(w.isEvading, false);
  assert.equal(w.level, 5);

  // Move far away (>48m) -> steps down 5 -> 4 -> 3 -> 2 -> 1 -> 0 cleanly
  for (let lvl = 4; lvl >= 0; lvl--) {
    const steppedDown = stepWantedLevelState(w, WANTED_STEP_DOWN_SEC + 0.1, 85);
    assert.equal(steppedDown, true);
    assert.equal(w.level, lvl);
  }
  assert.equal(w.policeKills, 0);
  assert.equal(w.isEvading, false);
});

test('isInsidePavedBuildingPad excludes all shopping malls from grass & terrain bleed-through', () => {
  assert.equal(isInsidePavedBuildingPad(-44, -36), true); // Central Mall
  assert.equal(isInsidePavedBuildingPad(-184, -96), true); // Paradise Mall
  assert.equal(isInsidePavedBuildingPad(188, -44), true); // Metro Mall
  assert.equal(isInsidePavedBuildingPad(-184, 88), true); // Seine Mall
  assert.equal(isInsidePavedBuildingPad(68, 188), true); // Suburb Mall
  assert.equal(isInsidePavedBuildingPad(315, 42), true); // Apex Bay Mall
  assert.equal(isInsidePavedBuildingPad(0, 0), false); // Central intersection
  assert.equal(isInsidePavedBuildingPad(84, 86), false); // Festival park
});

test('stepBreakableGlassPanes automatically restores shattered glass after 5 seconds', () => {
  const mesh = new THREE.Mesh();
  mesh.visible = false;
  const panes: BreakableGlassPane[] = [{ mesh, broken: true, respawnTimer: 5.0 }];

  // After 4.0 seconds glass remains shattered
  assert.equal(stepBreakableGlassPanes(panes, 4.0), 0);
  assert.equal(panes[0].broken, true);
  assert.equal(mesh.visible, false);

  // After crossing 5.0 seconds glass cleanly regenerates
  assert.equal(stepBreakableGlassPanes(panes, 1.1), 1);
  assert.equal(panes[0].broken, false);
  assert.equal(panes[0].respawnTimer, 0);
  assert.equal(mesh.visible, true);
});

test('resolveDirectionalHitZone distinguishes back, chest, and abdomen hits accurately', () => {
  // Actor facing +Z (yaw = 0); bullet traveling +Z hits actor in the back
  assert.equal(resolveDirectionalHitZone('chest', 0, 0, 1, 1.1), 'back');
  // Bullet traveling -Z hits actor in the front -> chest above 0.96, abdomen below 0.96
  assert.equal(resolveDirectionalHitZone('chest', 0, 0, -1, 1.15), 'chest');
  assert.equal(resolveDirectionalHitZone('chest', 0, 0, -1, 0.85), 'abdomen');
  // Limb and head hits preserve exact zone
  assert.equal(resolveDirectionalHitZone('arm_left', 0, 0, 1, 1.1), 'arm_left');
  assert.equal(resolveDirectionalHitZone('leg_right', 0, 0, 1, 0.4), 'leg_right');
});

test('ColliderSpatialGrid matches resolveCircleColliders2D and queries local cell bounds accurately', () => {
  const colliders = [
    { minX: 10, maxX: 14, minY: 0, maxY: 4.5, minZ: 20, maxZ: 40 },
    buildOrientedBoxCollider(42, 0, -18, 2.2, 2.0, 4.8, 0.6),
    { minX: -200, maxX: -195, minY: 0, maxY: 5, minZ: -200, maxZ: -195 },
  ];
  const grid = createColliderSpatialGrid(colliders, 16);

  const linearRes = resolveCircleColliders2D(10.1, 0, 30, 0.45, 1.75, colliders);
  const gridRes = resolveCircleColliders2DGrid(10.1, 0, 30, 0.45, 1.75, grid);
  assert.equal(gridRes.collided, linearRes.collided);
  assert.ok(Math.abs(gridRes.x - linearRes.x) < 1e-4);
  assert.ok(Math.abs(gridRes.z - linearRes.z) < 1e-4);

  const obbGridRes = resolveCircleColliders2DGrid(42.2, 0, -18.1, 0.5, 1.75, grid);
  assert.equal(obbGridRes.collided, true);

  const hitIndices: number[] = [];
  forEachColliderInBounds(grid, 9, 28, 15, 32, (idx) => hitIndices.push(idx));
  assert.deepEqual(hitIndices, [0]);
});


