import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HUD_SETTINGS,
  MAP_PRESETS,
  MapId,
  SNIPER_ZOOM_OPTIONS,
  VehicleKind,
  WEAPON_ORDER,
  WEAPONS,
  createWeaponRecord,
  getMapPois,
  isOpenWorldMap,
  normalizeWeaponId,
} from '../types';
import * as THREE from 'three';
import { getGroundHeightFn } from './arena';
import { formatDisplayClock, getTrainBoardEntries } from './digitalDisplays';
import { HOSPITAL_ELEVATOR_INFO } from './newCityDistrict';
import { MAIN_SCREEN_VIDEO_URL } from './lobbyConfig';
import { buildDigitalBikeMesh, VehicleManager, VEHICLE_SPECS } from './vehicles';
import { NPC_ROLE_CATALOG } from './simulatorSystems';
import { createOrganicBoulderGeometry, fbm2D, ridged2D } from './realisticWorld';

test('isOpenWorldMap and getMapPois support simulator_city mega world', () => {
  const mapId: MapId = 'simulator_city';
  assert.equal(isOpenWorldMap(mapId), true);
  const pois = getMapPois(mapId);
  assert.ok(pois.length >= 6, `${mapId} should have at least 6 POIs`);
  assert.ok(MAP_PRESETS[mapId].thumbnail, `${mapId} should include a thumbnail`);
  assert.ok(MAP_PRESETS[mapId].worldRadius >= 200, `${mapId} should be expanded >= 200m`);
});

test('VEHICLE_SPECS covers digital_bike and all 12 modern car kinds while purging legacy non-bike vehicles', () => {
  const kinds: VehicleKind[] = [
    'digital_bike',
    'revuelto_red',
    'cyber_pickup',
    'stealth_hyper',
    'rolls_copper_gt',
    'cyber_gold',
    'vision_silver',
    'terzo_silver',
    'gullwing_coupe',
    'range_black_suv',
    'thar_black_4x4',
    'challenger_scissor',
    'lambo_blue_hyper',
  ];

  for (const kind of kinds) {
    const spec = VEHICLE_SPECS[kind];
    assert.ok(spec, `Missing spec for ${kind}`);
    assert.equal(spec.kind, kind);
    assert.ok(spec.maxHp >= 350);
    assert.ok(spec.maxSpeed > spec.reverseSpeed && spec.reverseSpeed > 0);
    assert.ok(spec.camDist > 4 && spec.camHeight > 1.8);
    assert.ok(spec.driverSeatOffset && typeof spec.driverSeatOffset[1] === 'number');
    assert.ok(['none', 'swing', 'gullwing', 'scissor'].includes(spec.doorStyle));
    assert.equal(spec.isHelicopter, false);
  }
  assert.equal(VEHICLE_SPECS.digital_bike.doorStyle, 'none');
  assert.equal(VEHICLE_SPECS.electric_scooter.doorStyle, 'none');
  assert.ok(VEHICLE_SPECS.electric_scooter.maxSpeed >= 18 && VEHICLE_SPECS.electric_scooter.camDist < 4);
  assert.equal(VEHICLE_SPECS.gullwing_coupe.doorStyle, 'gullwing');
  assert.equal(VEHICLE_SPECS.challenger_scissor.doorStyle, 'scissor');
  assert.equal(VEHICLE_SPECS.revuelto_red.doorStyle, 'scissor');
  assert.equal(VEHICLE_SPECS.range_black_suv.doorStyle, 'swing');

  const purgedLegacy = [
    'jeep',
    'suv',
    'pickup',
    'truck',
    'atv',
    'helicopter',
    'warthog',
    'interceptor',
    'bus',
    'taxi',
    'sedan',
  ];
  for (const legacy of purgedLegacy) {
    assert.equal(legacy in VEHICLE_SPECS, false, `Legacy vehicle ${legacy} should be purged`);
  }
});

test('buildDigitalBikeMesh and realisticWorld build smooth non-blocky 3D geometry', () => {
  const builtBike = buildDigitalBikeMesh('test_bike', false, null);
  assert.ok(
    builtBike.partCount >= 12,
    `Expected smooth digital bike to use >= 12 sculpted parts, got ${builtBike.partCount}`,
  );
  assert.equal(builtBike.wheels.length, 2);
  assert.ok(builtBike.hitMeshes.length > 0);

  const boulder = createOrganicBoulderGeometry(1.5, 2, 42);
  assert.ok(boulder.attributes.position.count >= 40, 'Organic boulder should have displaced high-segment vertices');
  assert.ok(boulder.attributes.color, 'Organic boulder should include vertex moss/crevice colors');
  boulder.dispose();

  const fbmVal = fbm2D(12.4, -8.7, 4);
  const ridgeVal = ridged2D(12.4, -8.7, 4);
  assert.ok(fbmVal >= 0 && fbmVal <= 1, `fbm2D should stay normalized [0..1], got ${fbmVal}`);
  assert.ok(ridgeVal >= 0 && ridgeVal <= 1, `ridged2D should stay normalized [0..1], got ${ridgeVal}`);
});

test('digital display formatters produce live clock and train schedule entries', () => {
  assert.equal(formatDisplayClock(0), '00:00');
  assert.equal(formatDisplayClock(75), '01:15');
  const entries = getTrainBoardEntries(12);
  assert.equal(entries.length, 4);
  assert.ok(entries.some((e) => e.status === 'BOARDING'));
});

test('DEFAULT_HUD_SETTINGS includes vibrant default map color saturation', () => {
  assert.ok(DEFAULT_HUD_SETTINGS.mapSaturation >= 1.2);
  assert.ok(DEFAULT_HUD_SETTINGS.mapSaturation <= 1.8);
});

test('WEAPONS catalog defines unarmed explore mode plus all 15 unique weapons with valid firing styles and 10x sniper lens zoom', () => {
  assert.equal(WEAPON_ORDER.length, 16);
  assert.equal(WEAPON_ORDER[0], 'unarmed');
  for (const wid of WEAPON_ORDER) {
    const spec = WEAPONS[wid];
    assert.ok(spec, `Missing weapon spec for ${wid}`);
    if (wid === 'unarmed') {
      assert.equal(spec.damage, 0);
      assert.equal(spec.magSize, 0);
      assert.equal(spec.category, 'Unarmed');
    } else {
      assert.ok(spec.damage > 0 && spec.fireRate > 0 && spec.magSize > 0);
    }
    assert.ok(spec.supportedFireModes.includes(spec.defaultFireMode));
  }
  assert.deepEqual(WEAPONS.pistol.supportedFireModes, ['semi']);
  assert.deepEqual(WEAPONS.m16.supportedFireModes, ['burst', 'semi']);
  assert.equal(WEAPONS.m249.magSize, 100);
  assert.equal(WEAPONS.hk416_cqb.actionStyle, 'auto_bolt');
  assert.equal(WEAPONS.shotgun.actionStyle, 'pump');
  assert.equal(WEAPONS.sniper.actionStyle, 'bolt');
  assert.equal(WEAPONS.sniper.category, 'Sniper');
  const zoom10x = SNIPER_ZOOM_OPTIONS.find((z) => z.label === '10x');
  assert.ok(zoom10x && zoom10x.fov <= 7.5, 'Sniper must support working 10x optical lens zoom');
  const zoom30x = SNIPER_ZOOM_OPTIONS.find((z) => z.label === '30x');
  assert.ok(zoom30x && zoom30x.fov <= 3.0 && zoom30x.sensMul < 0.1, 'Sniper must support working 30x ultra optical lens zoom');
  assert.equal(normalizeWeaponId('ak47'), 'm4a1');
  assert.equal(normalizeWeaponId('hk416'), 'hk416');

  const record = createWeaponRecord((wid) => WEAPONS[wid].magSize);
  assert.equal(Object.keys(record).length, 16);
  assert.equal(record.unarmed, 0);
  assert.equal(record.m249, 100);
});

test('HOSPITAL_ELEVATOR_INFO defines 1F<->2F glass elevator shaft coordinates cleanly', () => {
  assert.equal(HOSPITAL_ELEVATOR_INFO.x, 315);
  assert.equal(HOSPITAL_ELEVATOR_INFO.z, -102);
  assert.ok(HOSPITAL_ELEVATOR_INFO.f2Y >= 5.0);
  assert.ok(HOSPITAL_ELEVATOR_INFO.cabHalfSpan >= 2.0);
});

test('getGroundHeightFn isolates ground floor under 2nd floor decks unless climbing stairs', () => {
  const groundHeightAt = getGroundHeightFn([
    // Upper 2nd floor slab at y = 4.0 spanning x in [0, 10], z in [0, 10]
    { minX: 0, maxX: 10, minZ: 0, maxZ: 10, axis: 'x', startCoord: 0, endCoord: 10, startY: 4.0, endY: 4.0 },
    // Staircase alongside x in [-5, 0] rising from 0 -> 4.0
    { minX: -5, maxX: 0, minZ: 0, maxZ: 3, axis: 'x', startCoord: -5, endCoord: 0, startY: 0, endY: 4.0 },
  ]);

  // Player walking inside ground floor at (5, 5) with currentY = 0 MUST stay at y = 0
  assert.equal(groundHeightAt(5, 5, 0), 0);
  // Player climbing stairs smoothly steps up from 0 -> 4.0
  let stairY = 0;
  for (let x = -4.5; x <= 0; x += 0.8) {
    stairY = groundHeightAt(x, 1.5, stairY);
  }
  assert.ok(stairY >= 3.5, `Expected stair climb to reach upper deck, got ${stairY}`);
  // Once on the 2nd floor, stepping onto the upper deck keeps height at 4.0
  assert.equal(groundHeightAt(5, 5, stairY), 4.0);
});

test('VehicleManager emits R/N/1..5 gears, frontWheelSteerPivots, and raised driver seat eye height', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  const noopCtx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === 'measureText') return () => ({ width: 20 });
        return () => {};
      },
      set: () => true,
    },
  );
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 512,
      height: 256,
      getContext: () => noopCtx,
    }),
  };

  try {
    const scene = new THREE.Scene();
    const vm = new VehicleManager(scene, true);
    vm.spawnAll(
      [
        { id: 'car_1', kind: 'cyber_pickup', x: 0, z: 0, yaw: 0 },
        { id: 'bike_1', kind: 'digital_bike', x: 6, z: 0, yaw: 0 },
        { id: 'mansion_car_1', kind: 'mansion_escalade_gull', x: 14, z: 0, yaw: 0 },
      ],
      () => 0,
    );

    const car = vm.getById('car_1')!;
    assert.ok(car, 'Spawned cyber_pickup should exist');
    assert.equal(car.frontWheelSteerPivots.length, 2, 'Car should have 2 articulated front wheel steering pivots');
    assert.equal(car.secondLcdMesh, null, 'Non-mansion car must NOT have YouTube 2nd LCD');
    assert.equal(car.secondLcdEntry, null, 'Non-mansion car must NOT have YouTube 2nd LCD entry');

    const mansionCar = vm.getById('mansion_car_1')!;
    assert.ok(mansionCar, 'Spawned mansion_escalade_gull should exist');
    assert.ok(mansionCar.secondLcdMesh, 'Mansion luxury car MUST have 2nd LCD display');
    assert.ok(mansionCar.secondLcdEntry, 'Mansion luxury car MUST have 2nd LCD entry');
    assert.ok(
      mansionCar.secondLcdEntry.playlist?.[0] === MAIN_SCREEN_VIDEO_URL,
      'Mansion luxury car 2nd LCD must play valid MAIN_SCREEN_VIDEO_URL',
    );
    assert.ok(
      mansionCar.secondLcdMesh.position.z > -0.49,
      `2nd LCD must sit proud of dash base (z > -0.49), got ${mansionCar.secondLcdMesh.position.z}`,
    );
    assert.ok(
      mansionCar.secondLcdMesh.position.y >= 1.45,
      `2nd LCD must sit above dash cowl (y >= 1.45), got ${mansionCar.secondLcdMesh.position.y}`,
    );

    for (const [kind, spec] of Object.entries(VEHICLE_SPECS)) {
      if (kind === 'digital_bike' || kind === 'electric_scooter' || kind === 'future_bike') continue;
      assert.ok(
        spec.driverSeatOffset[1] >= 1.2,
        `Car ${kind} driverSeatOffset[1] (${spec.driverSeatOffset[1]}) must be >= 1.2 for clear interior windshield view`,
      );
    }

    const pPos = new THREE.Vector3();
    car.speed = -5;
    assert.equal(vm.buildHudState(car, pPos, () => 0).gear, 'R');
    car.speed = 0;
    assert.equal(vm.buildHudState(car, pPos, () => 0).gear, 'N');
    car.speed = 4; // ~14 km/h
    assert.equal(vm.buildHudState(car, pPos, () => 0).gear, '1');
    car.speed = 10; // ~36 km/h
    assert.equal(vm.buildHudState(car, pPos, () => 0).gear, '2');
    car.speed = 34; // ~122 km/h
    assert.equal(vm.buildHudState(car, pPos, () => 0).gear, '5');

    vm.clear();
  } finally {
    if (prevDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDoc;
    }
  }
});

test('NPC_ROLE_CATALOG preserves all 30 simulator roles', () => {
  assert.equal(NPC_ROLE_CATALOG.length, 30);
});


