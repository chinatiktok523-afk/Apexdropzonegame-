import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBulletDamage,
  computeDestructionStage,
  createDestructibleEntity,
  getWeaponDestructionProfile,
  repairDestructibleEntity,
  shouldStepDestructionPhysics,
  stepDroneCrashPhysics,
} from './smartCityDestruction';
import {
  applySmartCityCommand,
  createInitialSmartCityState,
  damageSmartCityTarget,
  getSmartCityDynamicChartsData,
  repairAllSmartCityUnits,
} from './smartCitySystems';

test('Weapon destruction profiles balance damage from pistol up to sniper/rocket', () => {
  const pistol = getWeaponDestructionProfile('pistol');
  const rifle = getWeaponDestructionProfile('ak47');
  const shotgun = getWeaponDestructionProfile('shotgun');
  const sniper = getWeaponDestructionProfile('sniper');
  const heavy = getWeaponDestructionProfile('m249');
  const rocket = getWeaponDestructionProfile('rocket');

  assert.ok(pistol.damageMultiplier < rifle.damageMultiplier);
  assert.ok(rifle.damageMultiplier < shotgun.damageMultiplier);
  assert.ok(sniper.damageMultiplier > shotgun.damageMultiplier);
  assert.ok(rocket.damageMultiplier > sniper.damageMultiplier);
  assert.ok(rocket.sparkCount > pistol.sparkCount);
  assert.ok(heavy.particleScale > pistol.particleScale);
});

test('Robot 5-stage progressive destruction transitions, component detachment & repair work accurately', () => {
  const bot = createDestructibleEntity('test_bot', 'Test Humanoid', 'robot', 'humanoid', 100);
  assert.equal(bot.stage, 0);
  assert.equal(bot.speedMultiplier, 1);

  // Stage 1: Minor damage (75-99%)
  applyBulletDamage(bot, 'pistol', 18, 'torso', 1, 0);
  assert.equal(bot.stage, 1);
  assert.equal(bot.disabled, false);
  assert.ok(bot.speedMultiplier < 1 && bot.speedMultiplier > 0.8);
  assert.ok(bot.flinchTimer > 0);

  // Stage 2: Moderate damage (50-74%)
  applyBulletDamage(bot, 'pistol', 28, 'armor', 1, 0);
  assert.equal(bot.stage, 2);
  assert.ok(bot.smokeIntensity > 0.2);
  assert.equal(bot.lightsFlicker, true);

  // Stage 3: Heavy damage (25-49%) detaches sensor & slows severely
  applyBulletDamage(bot, 'ak47', 24, 'sensor', 1, 0);
  assert.equal(bot.stage, 3);
  assert.ok(bot.detachedComponents.includes('sensor'));
  assert.ok(bot.speedMultiplier <= 0.4);

  // Stage 4: Critical damage (1-24%) breaks arm_r/tool_arm and turns lights off
  applyBulletDamage(bot, 'pistol', 22, 'arm_r', 1, 0);
  assert.equal(bot.stage, 4);
  assert.equal(bot.disabled, true);
  assert.equal(bot.lightsOff, true);
  assert.ok(bot.detachedComponents.includes('arm_r'));

  // Stage 5: Complete destruction collapses head & limbs
  const finalHit = applyBulletDamage(bot, 'shotgun', 40, 'head', 1, 0);
  assert.equal(finalHit.newlyDestroyed, true);
  assert.equal(bot.stage, 5);
  assert.equal(bot.destroyed, true);
  assert.ok(bot.detachedComponents.includes('head'));
  assert.ok(bot.detachedComponents.includes('arm_l'));

  // Repair restores to full intact state
  repairDestructibleEntity(bot);
  assert.equal(bot.stage, 0);
  assert.equal(bot.hp, 100);
  assert.equal(bot.destroyed, false);
  assert.equal(bot.detachedComponents.length, 0);
});

test('Drone rotor component damage causes instability wobble, spiral crash, and ground impact', () => {
  const drone = createDestructibleEntity('drone_1', 'Test Drone', 'drone', 'security_surveillance', 100);
  assert.equal(drone.droneFlightState, 'flying');

  // Shooting 1st rotor disables that rotor and triggers wobbling
  applyBulletDamage(drone, 'ak47', 26, 'rotor_0', 0.5, 0.5);
  assert.equal(drone.brokenRotors[0], true);
  const flightAfter1: string = drone.droneFlightState;
  assert.ok(flightAfter1 === 'wobbling' || flightAfter1 === 'crashing');

  // Shooting 2nd rotor causes immediate flight failure -> crashing
  const hit2 = applyBulletDamage(drone, 'ak47', 26, 'rotor_2', 0.5, 0.5);
  assert.equal(drone.brokenRotors[2], true);
  assert.equal(drone.droneFlightState, 'crashing');
  assert.equal(hit2.justStartedCrashing, true);

  // Step crash physics until hitting ground y = 0
  let y = 12;
  let crashed = false;
  for (let i = 0; i < 120; i++) {
    const step = stepDroneCrashPhysics(drone, 0, y, 0, 0, 0.05);
    y = step.y;
    if (step.impactedGround) {
      crashed = true;
      break;
    }
  }
  assert.equal(crashed, true);
  assert.equal(drone.droneFlightState, 'crashed');
  assert.equal(drone.stage, 5);
  assert.equal(drone.destroyed, true);
  assert.deepEqual(drone.brokenRotors, [true, true, true, true]);
});

test('Smart City simulation tracks damaged/destroyed telemetry and repairs all fleets cleanly', () => {
  const sim = createInitialSmartCityState();
  assert.equal(sim.telemetry.robotsDamaged, 0);
  assert.equal(sim.telemetry.robotsDestroyed, 0);

  // Damage robot 0 moderately and destroy robot 1 with sniper
  damageSmartCityTarget(sim, 'robot', 0, 'pistol', 35, 'torso');
  damageSmartCityTarget(sim, 'robot', 1, 'sniper', 180, 'head');
  damageSmartCityTarget(sim, 'drone', 0, 'sniper', 150, 'battery');
  damageSmartCityTarget(sim, 'machine', 0, 'm249', 260, 'wheel');

  assert.equal(sim.telemetry.robotsDamaged, 1);
  assert.equal(sim.telemetry.robotsDestroyed, 1);
  assert.equal(sim.telemetry.dronesDestroyed, 1);
  assert.equal(sim.telemetry.machinesDamaged, 1);
  assert.equal(sim.robots[1].active, false);
  assert.equal(sim.telemetry.securityStatus, 'HIGH ALERT');

  const charts = getSmartCityDynamicChartsData(sim);
  assert.ok(charts.fleetIntegrityPct < 100);

  // Distance culling bounds check
  assert.equal(shouldStepDestructionPhysics(-140, -540, -145, -545), true);
  assert.equal(shouldStepDestructionPhysics(-140, -540, 200, 200), false);
  assert.equal(computeDestructionStage(10, 100), 4);

  // Full dashboard repair restores 100% of fleet
  applySmartCityCommand(sim, { type: 'repair_all' });
  assert.equal(sim.telemetry.robotsDamaged, 0);
  assert.equal(sim.telemetry.robotsDestroyed, 0);
  assert.equal(sim.telemetry.dronesDestroyed, 0);
  assert.equal(sim.telemetry.machinesDamaged, 0);
  assert.equal(sim.robots[1].active, true);

  assert.equal(repairAllSmartCityUnits(sim), 0);
});
