import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRONE_FLEET_CATALOG,
  MANSION_WEST_GARAGE_PORTAL,
  ROBOT_ROLE_CATALOG,
  SMART_CITY_BUS_ROUTES,
  SMART_CITY_CONTROL_TERMINALS,
  SMART_CITY_DOME,
  SMART_CITY_GATES,
  SMART_CITY_POIS,
  SMART_CITY_REPAIR_STATIONS,
  SMART_CITY_TRAIN_STATION,
  SMART_CITY_TRAIN_TRACK_POINTS,
  applySmartCityCommand,
  computePolylineLength2D,
  computeTrainStationCycle,
  createInitialSmartCityState,
  getDomeCeilingHeightAt,
  getSmartCityDistrictAt,
  getSmartCityDynamicChartsData,
  getSmartCitySurfaceOffsetY,
  isInSmartCityZone,
  isInsideSmartCityDome,
  isOnSmartCityRoad,
  sampleClosedPolyline2D,
  stepSmartCityState,
} from './smartCitySystems';
import {
  overlapsMansionHorizonCorridor,
  shouldFlattenNorthExpansion,
} from './mansionSystems';
import { getMegaWorldDistrictAt } from './simulatorSystems';

test('Consolidated Glass-Domed Smart City sits cleanly near Mansion & Garage with zero overlaps', () => {
  // Mansion & Garage interior must NEVER be classified inside Smart City
  assert.equal(isInSmartCityZone(0, -340), false);
  assert.equal(isInSmartCityZone(-60, -350), false);
  assert.equal(isInSmartCityZone(45, -290), false);

  // Snow Mountain (SW of -154, -154 -> z > -262) must stay excluded
  assert.equal(isInSmartCityZone(-200, -210), false);
  assert.equal(shouldFlattenNorthExpansion(-200, -210), false);

  // Mansion NW corner (-88, -435) lies outside Dome radius 116
  assert.equal(isInsideSmartCityDome(-88, -435), false);

  // All 5 consolidated zones inside the dome are inside both dome & flattening box
  assert.equal(isInsideSmartCityDome(-160, -478), true); // Greenhouses & Farming
  assert.equal(isInsideSmartCityDome(-210, -562), true); // Vertical Hydroponics
  assert.equal(isInsideSmartCityDome(-126, -532), true); // Nexus HQ & AI Lab
  assert.equal(isInsideSmartCityDome(-120, -604), true); // Smart Factory
  assert.equal(isInsideSmartCityDome(-60, -540), true); // Drone Control & Energy

  assert.equal(shouldFlattenNorthExpansion(-146, -542), true);
  assert.equal(shouldFlattenNorthExpansion(-250, -640), true);
  assert.equal(overlapsMansionHorizonCorridor(-146, -542), true);

  // Dome height envelope peaks smoothly at center and drops toward perimeter
  assert.ok(Math.abs(getDomeCeilingHeightAt(SMART_CITY_DOME.centerX, SMART_CITY_DOME.centerZ) - SMART_CITY_DOME.height) < 0.01);
  assert.ok(getDomeCeilingHeightAt(-126, -532) > 65);
  assert.equal(getDomeCeilingHeightAt(50, -542), 0);
});

test('Single exploration road links Mansion Garage wall opening through Dome Gate 1 to Gate 2 outer exit', () => {
  // Garage forecourt & West wall portal beside garage
  assert.equal(isOnSmartCityRoad(-80, -350), true);
  assert.equal(isOnSmartCityRoad(MANSION_WEST_GARAGE_PORTAL.wallX, MANSION_WEST_GARAGE_PORTAL.gapCenterZ), true);
  // Both Dome gates sit directly on the single road
  assert.equal(isOnSmartCityRoad(SMART_CITY_GATES[0].x, SMART_CITY_GATES[0].z), true);
  assert.equal(isOnSmartCityRoad(SMART_CITY_GATES[1].x, SMART_CITY_GATES[1].z), true);
  // Interior winding route & outer exit road
  assert.equal(isOnSmartCityRoad(-146, -492), true);
  assert.equal(isOnSmartCityRoad(-180, -536), true);
  assert.equal(isOnSmartCityRoad(-146, -695), true);

  // Connecting road sits cleanly elevated at 0.22m above ground terrain
  assert.equal(getSmartCitySurfaceOffsetY(-82, -388), 0.22);
  assert.equal(getSmartCitySurfaceOffsetY(MANSION_WEST_GARAGE_PORTAL.wallX, MANSION_WEST_GARAGE_PORTAL.gapCenterZ), 0.22);
  assert.equal(getSmartCitySurfaceOffsetY(SMART_CITY_GATES[0].x, SMART_CITY_GATES[0].z), 0.22);

  // No sprawling distant grids outside Dome!
  assert.equal(isOnSmartCityRoad(340, -452), false);
  assert.equal(isOnSmartCityRoad(460, -565), false);

  assert.equal(getSmartCityDistrictAt(-180, -485), 'AI Automated Farming & Greenhouses');
  assert.equal(getSmartCityDistrictAt(-210, -600), 'Vertical Hydroponics & Soil Labs');
  assert.equal(getSmartCityDistrictAt(-120, -525), 'Smart City Downtown & AI Labs');
  assert.equal(getSmartCityDistrictAt(-118, -605), 'Autonomous Factories & Recycling');
  assert.equal(getSmartCityDistrictAt(-60, -540), 'Renewable Energy & Drone Hub');
  assert.equal(getMegaWorldDistrictAt(-120, -525), 'Smart City Downtown & AI Labs');
});

test('Expanded catalog & dome specs: 30 robots, 18 drones inside dome, 2 automatic gates, 6 POIs, 2 repair bays', () => {
  assert.equal(ROBOT_ROLE_CATALOG.length, 30);
  const roleIds = new Set(ROBOT_ROLE_CATALOG.map((r) => r.id));
  assert.equal(roleIds.size, 30);
  for (const r of ROBOT_ROLE_CATALOG) {
    for (const wp of r.waypoints) {
      assert.equal(
        isInsideSmartCityDome(wp.x, wp.z, -2),
        true,
        `Robot ${r.id} waypoint (${wp.x},${wp.z}) must stay safely inside glass dome`,
      );
    }
  }

  assert.equal(DRONE_FLEET_CATALOG.length, 18);
  const droneArchs = new Set(DRONE_FLEET_CATALOG.map((d) => d.archetype));
  assert.equal(droneArchs.size, 7);
  for (const d of DRONE_FLEET_CATALOG) {
    assert.equal(isInsideSmartCityDome(d.padX, d.padZ, -2), true, `Drone ${d.id} pad must be inside dome`);
    const maxEdgeX = Math.max(
      Math.hypot(d.centerX + d.radiusX - SMART_CITY_DOME.centerX, d.centerZ - SMART_CITY_DOME.centerZ),
      Math.hypot(d.centerX - d.radiusX - SMART_CITY_DOME.centerX, d.centerZ - SMART_CITY_DOME.centerZ),
    );
    assert.ok(maxEdgeX < SMART_CITY_DOME.radius - 4, `Drone ${d.id} orbit stays safely inside dome`);
    assert.ok(d.cruiseY < getDomeCeilingHeightAt(d.centerX, d.centerZ) - 5, `Drone ${d.id} cruiseY clears dome ceiling`);
  }

  assert.equal(SMART_CITY_GATES.length, 2);
  assert.equal(SMART_CITY_POIS.length, 6);
  assert.equal(SMART_CITY_CONTROL_TERMINALS.length, 6);
  assert.equal(SMART_CITY_REPAIR_STATIONS.length, 2);
  const repairEntry = SMART_CITY_REPAIR_STATIONS.find((s) => s.id === 'sc_repair_entry');
  assert.ok(repairEntry, 'sc_repair_entry must exist');
  assert.equal(repairEntry.x, -107);
  assert.equal(repairEntry.z, -482);
  assert.equal(isOnSmartCityRoad(repairEntry.x, repairEntry.z), false, 'sc_repair_entry must sit off the main Smart City road');
  assert.equal(SMART_CITY_DOME.titleText, 'SMART CITY');
  assert.equal(SMART_CITY_DOME.subtitleText, 'developed by AFTAB BALOCH DADU');
});

test('30 Robot agents move, dynamic chart series update, and dashboard commands control ecosystem', () => {
  const sim = createInitialSmartCityState();
  const initialRobotPositions = sim.robots.map((r) => ({ x: r.x, z: r.z }));

  for (let i = 0; i < 50; i++) {
    stepSmartCityState(sim, 0.08, 0.9);
  }
  for (let i = 0; i < sim.robots.length; i++) {
    const movedDist = Math.hypot(
      sim.robots[i].x - initialRobotPositions[i].x,
      sim.robots[i].z - initialRobotPositions[i].z,
    );
    assert.ok(movedDist > 0.5, `Robot ${sim.robots[i].roleId} did not move`);
  }

  const charts = getSmartCityDynamicChartsData(sim);
  assert.equal(charts.energySeries.length, 4);
  assert.equal(charts.districtBars.length, 5);
  assert.equal(charts.fleetIntegrityPct, 100);
  assert.equal(charts.trendPoints.length, 12);

  const cratesBefore = sim.telemetry.harvestedCrates;
  applySmartCityCommand(sim, { type: 'trigger_harvest' });
  assert.equal(sim.telemetry.harvestedCrates, cratesBefore + 24);
  assert.equal(sim.cropGrowthStage, 0.28);

  applySmartCityCommand(sim, { type: 'set_drones', mode: 'recall' });
  for (let i = 0; i < 40; i++) {
    stepSmartCityState(sim, 0.08, 0.9);
  }
  assert.equal(sim.telemetry.activeDrones, 0);
  assert.ok(sim.drones[0].y < 0.6);

  applySmartCityCommand(sim, { type: 'toggle_factory', active: false });
  stepSmartCityState(sim, 0.08, 0.9);
  assert.equal(sim.telemetry.factoryProductionUnits, 0);
  const warehouseBot = sim.robots.find((r) => r.roleId === 'warehouse_robot');
  assert.equal(warehouseBot?.active, false);
});

test('3 city-wide Science Library buses & 1 single Dome-climbing Sky-Train station schedule', () => {
  assert.equal(SMART_CITY_BUS_ROUTES.length, 3);
  const sampleOut = { x: 0, z: 0, yaw: 0 };
  for (const route of SMART_CITY_BUS_ROUTES) {
    assert.ok(route.waypoints.length >= 6);
    const totalLen = computePolylineLength2D(route.waypoints);
    assert.ok(totalLen > 300, `Bus ${route.id} loop should cover city route`);
    sampleClosedPolyline2D(route.waypoints, totalLen * 0.25, sampleOut);
    assert.ok(Number.isFinite(sampleOut.x) && Number.isFinite(sampleOut.z) && Number.isFinite(sampleOut.yaw));
  }

  // Single Sky-Train track climbs cleanly above 74m Glass Dome crown
  assert.ok(SMART_CITY_TRAIN_STATION.deckY >= 7.5, 'Sky-Train station deck must be elevated >= 7.5m over road');
  const maxTrainY = Math.max(...SMART_CITY_TRAIN_TRACK_POINTS.map((p) => p.y));
  const minTrainY = Math.min(...SMART_CITY_TRAIN_TRACK_POINTS.map((p) => p.y));
  assert.ok(minTrainY >= SMART_CITY_TRAIN_STATION.deckY);
  assert.ok(maxTrainY > SMART_CITY_DOME.height + 4, 'Sky-Train must climb onto Dome top crown (>78m)');

  // Station dwell schedule stops train with doors open then smoothly launches onto Dome loop
  const boarding = computeTrainStationCycle(3.5, SMART_CITY_TRAIN_STATION.dwellSeconds, SMART_CITY_TRAIN_STATION.rideLapSeconds, 0.068);
  assert.equal(boarding.stoppedAtStation, true);
  assert.equal(boarding.doorOpenTarget, 1);
  assert.equal(boarding.speedScale, 0);

  const climbing = computeTrainStationCycle(30.0, SMART_CITY_TRAIN_STATION.dwellSeconds, SMART_CITY_TRAIN_STATION.rideLapSeconds, 0.068);
  assert.equal(climbing.stoppedAtStation, false);
  assert.equal(climbing.doorOpenTarget, 0);
  assert.equal(climbing.speedScale, 1);
});
