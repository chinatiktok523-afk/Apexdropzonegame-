import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIKE_STYLES,
  MAP_PRESETS,
  SIMULATOR_POIS,
  TimeOfDayPhase,
  WeatherKind,
  getMapPois,
  isOpenWorldMap,
} from '../types';
import {
  EnvironmentCycleController,
  classifyTimeOfDayPhase,
  computeEnvironmentSnapshot,
  formatTimeNormClock,
} from './environmentCycle';
import { unifiedSimulatorGroundHeight as simulatorCityGroundHeight } from './unifiedSimulatorArena';
import { buildDigitalBikeMesh } from './vehicles';

test('EnvironmentCycleController handles all 4 time phases, 4 weathers, and automatic stepping', () => {
  const ctrl = new EnvironmentCycleController();
  const phases: TimeOfDayPhase[] = ['morning', 'afternoon', 'sunset', 'night'];
  for (const p of phases) {
    ctrl.setPhase(p);
    const snap = ctrl.getSnapshot();
    assert.equal(snap.phase, p);
    assert.equal(classifyTimeOfDayPhase(snap.timeNorm), p);
    assert.match(snap.clockLabel, /^\d{2}:\d{2}$/);
  }

  ctrl.setPhase('afternoon');
  const daySnap = ctrl.getSnapshot();
  ctrl.setPhase('night');
  const nightSnap = ctrl.getSnapshot();
  assert.ok(daySnap.nightFactor < 0.1, 'Afternoon must keep streetlights/windows off');
  assert.ok(nightSnap.nightFactor > 0.85, 'Night must illuminate streetlights and building windows');
  assert.ok(daySnap.sunIntensity > nightSnap.sunIntensity);

  const weathers: WeatherKind[] = ['clear', 'cloudy', 'foggy', 'rainy'];
  for (const w of weathers) {
    const snap = computeEnvironmentSnapshot(0.5, w, 1);
    if (w === 'rainy') {
      assert.equal(snap.rainIntensity, 1);
    } else {
      assert.equal(snap.rainIntensity, 0);
    }
    if (w === 'foggy') {
      assert.ok(snap.fogDensity > 0.005, 'Foggy weather should visibly thicken atmosphere');
    }
  }

  // Verify automatic progression steps timeNorm forward
  ctrl.reset('morning', 'clear', true);
  const t0 = ctrl.timeNorm;
  ctrl.step(14);
  assert.ok(ctrl.timeNorm > t0, 'Auto cycle should advance time smoothly');
  assert.equal(formatTimeNormClock(0.5), '12:00');
});

test('simulatorCityGroundHeight supports underpass, elevated highway overpass, canal, and flat streets', () => {
  const ramps = [
    // Overpass deck at y = 5.4 spanning x in [-28, 28], z in [-44, -32]
    { minX: -28, maxX: 28, minZ: -44, maxZ: -32, axis: 'x' as const, startCoord: -28, endCoord: 28, startY: 5.4, endY: 5.4 },
    // River bridge cresting above Seine channel at (-140, 166)
    { minX: -147, maxX: -133, minZ: 154, maxZ: 178, axis: 'z' as const, startCoord: 154, endCoord: 178, startY: 1.9, endY: 1.9 },
  ];

  // Street traffic driving at y = 0 passes cleanly UNDER the overpass without snapping upward
  assert.equal(simulatorCityGroundHeight(0, -38, 0, ramps), 0);
  // Vehicles already on top of the overpass deck at y = 5.4 stay elevated at 5.4m
  assert.equal(simulatorCityGroundHeight(0, -38, 5.4, ramps), 5.4);

  // Off-bridge canal/river floor dips below water level (-1.15m)
  const canalFloor = simulatorCityGroundHeight(-100, 166, 0, ramps);
  assert.ok(canalFloor < -1.2, `Expected canal floor < -1.2m, got ${canalFloor}`);
  assert.equal(simulatorCityGroundHeight(-140, 166, 1.9, ramps), 1.9);

  // City boulevard stays at y = 0
  assert.equal(simulatorCityGroundHeight(0, 0, 0, ramps), 0);
});

test('simulator_city map config, POIs, and all 5 Cyber Bike styles build properly', () => {
  assert.equal(isOpenWorldMap('simulator_city'), true);
  assert.ok(MAP_PRESETS.simulator_city.worldRadius >= 220);
  assert.equal(getMapPois('simulator_city').length, SIMULATOR_POIS.length);
  assert.ok(SIMULATOR_POIS.length >= 8);

  assert.equal(BIKE_STYLES.length, 5);
  for (const style of BIKE_STYLES) {
    const built = buildDigitalBikeMesh(`test_${style.id}`, false, null, style.id);
    assert.ok(
      built.partCount >= 12,
      `Cyber bike style ${style.id} must use >= 12 sculpted parts (got ${built.partCount})`,
    );
    assert.equal(built.wheels.length, 2);
  }
});
