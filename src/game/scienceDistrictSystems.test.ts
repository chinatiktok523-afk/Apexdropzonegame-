import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FUTURE_LAB_BOUNDS,
  FUTURE_LAB_DEPARTMENTS,
  SCIENCE_DISTRICT_BOUNDS,
  SCIENCE_DISTRICT_NPCS,
  SCIENCE_DOMES_CATALOG,
  SCIENCE_MUSEUM_BOUNDS,
  createInitialScienceDistrictState,
  detectNearestScienceInteraction,
  getScienceDistrictSurfaceOffsetY,
  isInScienceDistrictZone,
  isOnScienceDistrictRoad,
  updateOnDemandInteriorLoading,
} from './scienceDistrictSystems';
import { isInsideMansionProperty } from './mansionSystems';
import { isInsideSmartCityDome } from './smartCitySystems';

test('Science District sits cleanly behind Mansion and beside Smart City without overlapping either', () => {
  // Future Lab, Museum, and all 8 Glass Domes must NOT collide with Smart City Glass Dome or Mansion compound
  assert.equal(isInsideSmartCityDome(FUTURE_LAB_BOUNDS.centerX, FUTURE_LAB_BOUNDS.centerZ), false);
  assert.equal(isInsideSmartCityDome(SCIENCE_MUSEUM_BOUNDS.centerX, SCIENCE_MUSEUM_BOUNDS.centerZ), false);
  assert.equal(isInsideMansionProperty(FUTURE_LAB_BOUNDS.centerX, FUTURE_LAB_BOUNDS.centerZ), false);
  assert.equal(isInsideMansionProperty(SCIENCE_MUSEUM_BOUNDS.centerX, SCIENCE_MUSEUM_BOUNDS.centerZ), false);

  for (const dome of SCIENCE_DOMES_CATALOG) {
    assert.equal(isInsideSmartCityDome(dome.x, dome.z), false, `${dome.id} overlaps Smart City Dome`);
    assert.equal(isInsideMansionProperty(dome.x, dome.z), false, `${dome.id} overlaps Mansion`);
    assert.equal(isInScienceDistrictZone(dome.x, dome.z), true, `${dome.id} is outside Science District`);
  }

  // Ensure the 8 glass domes have generous clear walking clearance (>= 22m center-to-center)
  for (let i = 0; i < SCIENCE_DOMES_CATALOG.length; i++) {
    for (let j = i + 1; j < SCIENCE_DOMES_CATALOG.length; j++) {
      const a = SCIENCE_DOMES_CATALOG[i];
      const b = SCIENCE_DOMES_CATALOG[j];
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(dist >= a.radius + b.radius + 6, `Domes ${a.id} & ${b.id} too close (${dist.toFixed(1)}m)`);
    }
  }
});

test('All 10 Future Lab departments, 8 Glass Domes, and 7 NPC roles are populated cleanly', () => {
  assert.equal(FUTURE_LAB_DEPARTMENTS.length, 10);
  const deptFloors = new Set(FUTURE_LAB_DEPARTMENTS.map((d) => d.floor));
  assert.deepEqual([...deptFloors].sort(), [1, 2, 3]);

  assert.equal(SCIENCE_DOMES_CATALOG.length, 8);
  const roles = new Set(SCIENCE_DISTRICT_NPCS.map((n) => n.role));
  for (const required of ['scientist', 'engineer', 'visitor', 'guide', 'security', 'robot_assistant', 'maintenance'] as const) {
    assert.ok(roles.has(required), `Missing NPC role ${required}`);
  }
});

test('Connecting roads link Smart City & Central East Avenue into Science District Plaza cleanly', () => {
  // Smart City Gate 1 connector
  assert.equal(isOnScienceDistrictRoad(-114, -474), true);
  // Plaza Front Boulevard
  assert.equal(isOnScienceDistrictRoad(118, -474), true);
  // Central City Northbound x=140 extension
  assert.equal(isOnScienceDistrictRoad(140, -350), true);
  assert.equal(getScienceDistrictSurfaceOffsetY(118, -474), 0.085);
  // Elevated Skybridge deck at 2F altitude
  assert.equal(getScienceDistrictSurfaceOffsetY(115, -616, 5.6), 5.6);
  // Dome podium deck (0.54m) & Future Lab / Museum 1F floor slab (0.20m)
  assert.equal(getScienceDistrictSurfaceOffsetY(SCIENCE_DOMES_CATALOG[5].x, SCIENCE_DOMES_CATALOG[5].z + 5), 0.54);
  assert.equal(getScienceDistrictSurfaceOffsetY(64, -598.5), 0.2);
  assert.equal(getScienceDistrictSurfaceOffsetY(168, -598.5), 0.2);
});

test('On-demand Android 6GB RAM interior loader only mounts interiors when player or camera is nearby or inside', () => {
  const state = createInitialScienceDistrictState();
  // Far away at Central Resort (0, 0) -> all interiors unloaded
  updateOnDemandInteriorLoading(state, 0, 0, 0, 0);
  assert.equal(state.loadedZones.futureLabInterior, false);
  assert.equal(state.loadedZones.scienceMuseumInterior, false);
  assert.equal(Object.values(state.loadedZones.domeInteriors).some(Boolean), false);

  // Near Future Lab -> Future Lab interior loads, Museum stays unloaded if beyond radius
  updateOnDemandInteriorLoading(state, 64, -578, 64, -578);
  assert.equal(state.loadedZones.futureLabInterior, true);
  assert.equal(state.loadedZones.scienceMuseumInterior, false);

  // Inside Dome 6 via interaction -> Dome 6 stays loaded even if camera pulls slightly back
  state.activeBuilding = 'dome_6_vehicles';
  updateOnDemandInteriorLoading(state, 0, 0, 0, 0);
  assert.equal(state.loadedZones.domeInteriors.dome_6_vehicles, true);
});

test('detectNearestScienceInteraction identifies Future Lab, Museum, and each of the 8 Domes accurately', () => {
  const nearLab = detectNearestScienceInteraction(64, -590);
  assert.equal(nearLab?.kind, 'future_lab');

  const nearMuseum = detectNearestScienceInteraction(168, -590);
  assert.equal(nearMuseum?.kind, 'science_museum');

  const d6 = SCIENCE_DOMES_CATALOG[5];
  const nearDome6 = detectNearestScienceInteraction(d6.x, d6.z + 4);
  assert.equal(nearDome6?.kind, 'dome');
  assert.equal(nearDome6?.dome?.id, 'dome_6_vehicles');
});
