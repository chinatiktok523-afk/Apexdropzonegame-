import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MAIN_SCREEN_VIDEO_URL } from './lobbyConfig';
import {
  MANSION_DEFAULT_SPAWN,
  MANSION_HELIPAD_COORDS,
  MANSION_HELIPAD_2_COORDS,
  MANSION_ROOF_Y,
  HELICOPTER_PADS,
  MAIN_HALL_LOUNGE_LAYOUT,
  applyCarRemoteAction,
  canEnterMansionVehicle,
  canShowCarRemote,
  canVehicleMove,
  computeEngineAudioTargets,
  computeRotatedVideoDraw,
  computeScreenAudioGain,
  computeVideoCoverCrop,
  computeWireLedScale,
  createDefaultMansionVehicleState,
  getEngineAudioProfile,
  getSosPulseState,
  getVehicleSurfaceOffsetY,
  getVideoRotationForUrl,
  isInsideMansionProperty,
  overlapsMansionHorizonCorridor,
  shouldFlattenNorthExpansion,
  stepDjTrackIndex,
  stepHelicopterPadRespawn,
  stepMansionVehicleMechanisms,
  stepPlaylistIndex,
  stepProximityPortal,
  stepSeatedChairYaw,
  toggleVehicleEngineIgnition,
  triggerSosLightFlash,
} from './mansionSystems';
import { DigitalDisplayManager } from './digitalDisplays';
import {
  MANSION_POOL_BOUNDS,
  getExhaustBackfireColorHex,
  getMansionPoolBedDepth,
  resolvePlayerAgainstVehicle,
  stepSwimmingPhysics,
} from './swimmingPhysics';
import { getMegaWorldDistrictAt } from './simulatorSystems';
import { DEFAULT_HUD_CONTROL_LAYOUT } from '../types';

test('default spawn starts inside Mansion courtyard facing north at the 4-level house', () => {
  assert.equal(MANSION_DEFAULT_SPAWN.id, 'sim_mansion');
  assert.equal(MANSION_DEFAULT_SPAWN.viewYaw, 0);
  assert.equal(isInsideMansionProperty(MANSION_DEFAULT_SPAWN.x, MANSION_DEFAULT_SPAWN.z), true);
  assert.equal(shouldFlattenNorthExpansion(0, -340), true);
  assert.equal(shouldFlattenNorthExpansion(-118, -350), true);
  assert.equal(shouldFlattenNorthExpansion(118, -350), true);
  assert.equal(overlapsMansionHorizonCorridor(0, -195), true);
  assert.equal(overlapsMansionHorizonCorridor(-90, -135), true);
  assert.equal(overlapsMansionHorizonCorridor(240, -195), false);
  assert.equal(getMegaWorldDistrictAt(0, -274), 'Apex Luxury Mansion');
  assert.equal(getMegaWorldDistrictAt(-12, -306), 'Apex Luxury Mansion');
  assert.equal(getMegaWorldDistrictAt(-60, -350), 'Apex Luxury Mansion');
  assert.equal(getMegaWorldDistrictAt(160, -160), 'Metro Stadium & Rail Hub');
  assert.equal(getMegaWorldDistrictAt(-160, -160), 'Paradise Valley & Snow Slopes');
});

test('proximity sensor doors smoothly open on approach and close on exit with collider sync', () => {
  let open = 0;
  for (let i = 0; i < 15; i++) {
    const res = stepProximityPortal(open, 4.2, 6.5, 9.0, 0.1);
    open = res.open;
  }
  assert.ok(open > 0.95, `Expected portal open near 1, got ${open}`);

  const openStep = stepProximityPortal(open, 4.2, 6.5, 9.0, 0.05);
  assert.equal(openStep.colliderActive, false);

  for (let i = 0; i < 20; i++) {
    const res = stepProximityPortal(open, 14.0, 6.5, 9.0, 0.1);
    open = res.open;
  }
  assert.equal(open, 0);
  const closedStep = stepProximityPortal(open, 14.0, 6.5, 9.0, 0.05);
  assert.equal(closedStep.colliderActive, true);
});

test('Car Remote Key visibility strictly depends on proximity to mansion cars', () => {
  const car = createDefaultMansionVehicleState(true);
  const worldCar = createDefaultMansionVehicleState(false);

  assert.equal(canShowCarRemote(car, false, false, 5.2), true);
  assert.equal(canShowCarRemote(car, false, false, 12.0), false);
  assert.equal(canShowCarRemote(car, true, false, 1.0), false);
  assert.equal(canShowCarRemote(worldCar, false, false, 3.0), false);
});

test('mansion supercar entry is blocked when locked or door closed, and allowed once remote opens doors', () => {
  const car = createDefaultMansionVehicleState(true);
  assert.deepEqual(canEnterMansionVehicle(car), { allowed: false, reason: 'locked' });

  car.locked = false;
  assert.deepEqual(canEnterMansionVehicle(car), { allowed: false, reason: 'door_closed' });

  applyCarRemoteAction(car, 'unlock_open');
  for (let i = 0; i < 18; i++) {
    stepMansionVehicleMechanisms(car, 0.08);
  }
  assert.ok(car.doorOpenL >= 0.9, `Expected door open, got ${car.doorOpenL}`);
  assert.deepEqual(canEnterMansionVehicle(car), { allowed: true, reason: 'ok' });

  applyCarRemoteAction(car, 'lock_close');
  for (let i = 0; i < 20; i++) {
    stepMansionVehicleMechanisms(car, 0.08);
  }
  assert.equal(car.doorOpenL, 0);
  assert.deepEqual(canEnterMansionVehicle(car), { allowed: false, reason: 'locked' });
});

test('motorized windows and physical dashboard engine ignition step smoothly and gate movement', () => {
  const car = createDefaultMansionVehicleState(true);
  assert.equal(canVehicleMove(car), false);

  car.windowTargetFL = 1;
  car.windowTargetRR = 0.5;
  const started = toggleVehicleEngineIgnition(car);
  assert.equal(started, true);
  assert.equal(car.engineRunning, false);

  for (let i = 0; i < 15; i++) {
    stepMansionVehicleMechanisms(car, 0.1);
  }
  assert.equal(car.engineRunning, true);
  assert.equal(canVehicleMove(car), true);
  assert.ok(car.windowOpenFL > 0.95);
  assert.ok(Math.abs(car.windowOpenRR - 0.5) < 0.05);

  const stopped = toggleVehicleEngineIgnition(car);
  assert.equal(stopped, false);
  assert.equal(canVehicleMove(car), false);
});

test('dynamic pool depth slopes deeper and swimming physics floats, dives, and climbs out cleanly', () => {
  const shallow = getMansionPoolBedDepth(22, -292);
  const deep = getMansionPoolBedDepth(44, -292);
  assert.ok(shallow !== null && deep !== null);
  assert.ok(deep < shallow, `Expected deep end (${deep}) < shallow end (${shallow})`);
  assert.equal(getMansionPoolBedDepth(0, -274), null);

  const swimState = { y: -1.8, vx: 0, vy: 0, vz: 0, isSwimming: false };
  const firstStep = stepSwimmingPhysics(
    swimState,
    {
      moveDirX: 1,
      moveDirZ: 0,
      sprint: false,
      ascend: false,
      dive: false,
      floorY: deep!,
      waterY: MANSION_POOL_BOUNDS.waterY,
      nearPoolRim: false,
    },
    0.1,
  );
  assert.equal(firstStep.enteredWater, true);
  assert.equal(swimState.isSwimming, true);
  assert.ok(swimState.vy > 0, 'Buoyancy should push player upward toward waterline');

  // Dive down underwater
  for (let i = 0; i < 12; i++) {
    stepSwimmingPhysics(
      swimState,
      {
        moveDirX: 0,
        moveDirZ: 0,
        sprint: false,
        ascend: false,
        dive: true,
        floorY: deep!,
        waterY: MANSION_POOL_BOUNDS.waterY,
        nearPoolRim: false,
      },
      0.08,
    );
  }
  assert.ok(swimState.y < MANSION_POOL_BOUNDS.waterY - 1.15);

  // Float up near pool rim and climb out
  swimState.y = MANSION_POOL_BOUNDS.waterY - 1.05;
  const climb = stepSwimmingPhysics(
    swimState,
    {
      moveDirX: 0,
      moveDirZ: 0,
      sprint: false,
      ascend: true,
      dive: false,
      floorY: deep!,
      waterY: MANSION_POOL_BOUNDS.waterY,
      nearPoolRim: true,
    },
    0.05,
  );
  assert.equal(climb.climbOutTriggered, true);
  assert.equal(swimState.isSwimming, false);
});

test('exhaust backfire color shifts blue -> yellow -> red by speed, and player collides solidly with parked cars', () => {
  assert.equal(getExhaustBackfireColorHex(30), 0x38bdf8);
  assert.equal(getExhaustBackfireColorHex(88), 0xfacc15);
  assert.equal(getExhaustBackfireColorHex(132), 0xef4444);

  const hit = resolvePlayerAgainstVehicle(0.2, 0.1, 0.2, 0.48, 1.75, 0, 0, 0, 0, 2.1, 4.9);
  assert.equal(hit.collided, true);
  assert.ok(Math.abs(hit.x) >= 1.5, `Expected push outside vehicle half-width, got x=${hit.x}`);

  const clear = resolvePlayerAgainstVehicle(5.0, 0.1, 0.0, 0.48, 1.75, 0, 0, 0, 0, 2.1, 4.9);
  assert.equal(clear.collided, false);

  assert.ok(DEFAULT_HUD_CONTROL_LAYOUT.camera);
  assert.ok(DEFAULT_HUD_CONTROL_LAYOUT.camera.scale >= 0.65);
});

test('SOS beep flashes front and rear lights 3 times then turns lights off', () => {
  const car = createDefaultMansionVehicleState(true);
  car.headlightsOn = true;
  triggerSosLightFlash(car);
  assert.equal(car.headlightsOn, false);
  assert.ok(car.sosFlashTimer > 1.4);

  let pulseTransitions = 0;
  let prevLit = false;
  for (let step = 0; step < 32; step++) {
    const { active, lit } = getSosPulseState(car.sosFlashTimer);
    if (active && lit && !prevLit) pulseTransitions++;
    prevLit = lit;
    stepMansionVehicleMechanisms(car, 0.05);
  }
  assert.equal(pulseTransitions, 3, 'Expected exactly 3 SOS light flashes');
  assert.equal(car.sosFlashTimer, 0);
  assert.equal(car.headlightsOn, false);
});

test('helicopter respawns at pad exactly 10 seconds after being taken and uses 4F rooftop coordinates', () => {
  assert.equal(MANSION_HELIPAD_COORDS.deckY, MANSION_ROOF_Y + 0.22);
  assert.equal(MANSION_HELIPAD_2_COORDS.x, 33);
  assert.equal(MANSION_HELIPAD_2_COORDS.z, -377);
  assert.equal(MANSION_HELIPAD_2_COORDS.deckY, MANSION_ROOF_Y + 0.22);
  assert.ok(HELICOPTER_PADS.some((p) => p.id === MANSION_HELIPAD_2_COORDS.id));
  assert.ok(MANSION_HELIPAD_COORDS.deckY > 17.0, '4F Rooftop helipad must sit on mansion roof');
  assert.equal(getEngineAudioProfile('apex_heli').sampleKey, 'helicopter_rotor');

  const tracker = { vacatedAtSec: {} as Record<string, number | null> };
  const idleOnPad = [
    { x: MANSION_HELIPAD_COORDS.x, z: MANSION_HELIPAD_COORDS.z, hasDriver: false, destroyed: false },
  ];
  assert.equal(stepHelicopterPadRespawn(HELICOPTER_PADS, idleOnPad, tracker, 5.0).length, 0);
  assert.equal(tracker.vacatedAtSec[MANSION_HELIPAD_COORDS.id], null);

  // Now player takes the mansion helicopter
  const playerTakingHeli = [
    { x: MANSION_HELIPAD_COORDS.x, z: MANSION_HELIPAD_COORDS.z, hasDriver: true, destroyed: false },
  ];
  for (let i = 0; i < 9; i++) {
    const out = stepHelicopterPadRespawn([MANSION_HELIPAD_COORDS], playerTakingHeli, tracker, 1.0);
    assert.equal(out.length, 0);
  }
  const triggered = stepHelicopterPadRespawn([MANSION_HELIPAD_COORDS], playerTakingHeli, tracker, 1.0);
  assert.equal(triggered.length, 1);
  assert.equal(triggered[0].id, MANSION_HELIPAD_COORDS.id);
});

test('vehicle wheel surface offsets and distinct throttle-modulated engine audio targets work cleanly', () => {
  assert.equal(getVehicleSurfaceOffsetY(-53, -334), 0.2); // Showroom marble plinth
  assert.equal(getVehicleSurfaceOffsetY(-60, -340), 0.12); // Showroom deck
  assert.equal(getVehicleSurfaceOffsetY(0, -260), 0.085); // Mansion driveway
  assert.equal(getVehicleSurfaceOffsetY(0, 50), 0.094); // Central N/S avenue
  assert.equal(getVehicleSurfaceOffsetY(40, -292), 0); // Pool interior stays sunken
  // When helicopter sits above 4F helipad, rooftop deck offset applies on rooftop and does NOT pull ground traffic up
  assert.equal(getVehicleSurfaceOffsetY(MANSION_HELIPAD_COORDS.x, MANSION_HELIPAD_COORDS.z, 0), 0);
  assert.equal(
    getVehicleSurfaceOffsetY(MANSION_HELIPAD_COORDS.x, MANSION_HELIPAD_COORDS.z, MANSION_HELIPAD_COORDS.deckY),
    MANSION_HELIPAD_COORDS.deckY,
  );
  assert.equal(getVehicleSurfaceOffsetY(MANSION_HELIPAD_2_COORDS.x, MANSION_HELIPAD_2_COORDS.z, 0), 0);
  assert.equal(
    getVehicleSurfaceOffsetY(MANSION_HELIPAD_2_COORDS.x, MANSION_HELIPAD_2_COORDS.z, MANSION_HELIPAD_2_COORDS.deckY),
    MANSION_HELIPAD_2_COORDS.deckY,
  );

  const hyperProf = getEngineAudioProfile('mansion_hyper_scissor');
  const hummerProf = getEngineAudioProfile('mansion_hummer_gold');
  const evProf = getEngineAudioProfile('mansion_ev_gt');
  assert.notEqual(hyperProf.baseFreqHz, hummerProf.baseFreqHz);
  assert.notEqual(evProf.sampleKey, hummerProf.sampleKey);

  const stoppedIdle = computeEngineAudioTargets('mansion_hyper_scissor', 0, 0);
  const fullGas = computeEngineAudioTargets('mansion_hyper_scissor', 80, 1.0);
  assert.ok(stoppedIdle.sampleGain < 0.04, `Expected low stopped idle gain, got ${stoppedIdle.sampleGain}`);
  assert.ok(fullGas.sampleGain > stoppedIdle.sampleGain * 4);
  assert.ok(fullGas.playbackRate > stoppedIdle.playbackRate + 0.35);
});

test('wire LED scaling, video cover cropping, playlist looping, audio capping, and gaming chair rotation behave cleanly', () => {
  const scaled = computeWireLedScale(12, 0.04, 0.04);
  assert.equal(scaled.w, 12);
  assert.equal(scaled.h, 0.4);
  assert.equal(scaled.d, 0.4);

  const portraitCrop = computeVideoCoverCrop(720, 1280, 1920, 1080);
  assert.equal(portraitCrop.sx, 0);
  assert.equal(portraitCrop.sw, 720);
  assert.ok(portraitCrop.sh < 1280 && portraitCrop.sy > 0);

  assert.equal(stepPlaylistIndex(0, 2), 1);
  assert.equal(stepPlaylistIndex(1, 2), 0);

  assert.equal(computeScreenAudioGain(0, 20, 0.14, false), 0.14);
  assert.equal(computeScreenAudioGain(25, 20, 0.14, false), 0);
  assert.equal(computeScreenAudioGain(2, 20, 0.14, true), 0);

  const initialYaw = Math.PI * 0.5;
  const turnedRight = stepSeatedChairYaw(initialYaw, 1, 0.5);
  assert.ok(turnedRight < initialYaw, 'Steer right turns yaw clockwise smoothly');
  assert.equal(stepSeatedChairYaw(initialYaw, 0, 0.5), initialYaw);
});

test('Main Hall lounge places curved sofa, coffee table, and HDR TV close together without stair collisions', () => {
  const L = MAIN_HALL_LOUNGE_LAYOUT;
  const viewDist = L.tvScreenX - L.sofaCenterSeatX;
  assert.ok(viewDist >= 5.0 && viewDist <= 9.0, `Expected 5..9m TV-to-sofa distance, got ${viewDist}`);
  assert.ok(L.coffeeTableX > L.sofaCenterSeatX && L.coffeeTableX < L.tvScreenX);
  assert.ok(L.tvInteractX > L.coffeeTableX && L.tvInteractX < L.tvScreenX);
  assert.ok(L.sofaCenterSeatX >= -1.0, 'Sofa must sit east of curved Staircase 1 edge');
  assert.ok(L.tvMediaWallX <= 19.0, 'Media wall must sit west of Staircase 2 shaft (x=20)');
});

test('rotated cinema video framing and continuous DJ track cycling work accurately', () => {
  const rots = { movie_video_1_627e1400: -90 as const };
  assert.equal(getVideoRotationForUrl('./assets/aistudio/movie_video_1_627e1400.mp4', rots), -90);
  assert.equal(getVideoRotationForUrl('./assets/aistudio/movie_video_2_ff45b074.mp4', rots), 0);

  const rotDraw = computeRotatedVideoDraw(720, 1280, 640, 288, -90);
  assert.equal(rotDraw.visW, 1280);
  assert.equal(rotDraw.visH, 720);
  assert.equal(rotDraw.drawW, 360);
  assert.equal(rotDraw.drawH, 640);
  assert.ok(Math.abs(rotDraw.rad + Math.PI / 2) < 1e-6);

  assert.equal(stepDjTrackIndex(0, 2), 1);
  assert.equal(stepDjTrackIndex(1, 2), 0);
});

test('DigitalDisplayManager pools shared video streams while preserving independent screen damage', () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  const createdVideos: Array<Record<string, unknown>> = [];
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
    body: { appendChild: () => {} },
    createElement: (tag: string) => {
      if (tag === 'video') {
        const v: Record<string, unknown> = {
          style: {},
          readyState: 0,
          videoWidth: 0,
          videoHeight: 0,
          muted: true,
          volume: 0,
          paused: true,
          play: () => Promise.resolve(),
          load: () => {},
          setAttribute: () => {},
          addEventListener: () => {},
        };
        createdVideos.push(v);
        return v;
      }
      if (tag === 'div') {
        return { style: { cssText: '' }, setAttribute: () => {}, appendChild: () => {}, remove: () => {} };
      }
      return {
        width: 512,
        height: 256,
        getContext: () => noopCtx,
      };
    },
  };

  try {
    const mgr = new DigitalDisplayManager();
    const d1 = mgr.createVideoDisplayMaterial([MAIN_SCREEN_VIDEO_URL], 'car_second_lcd');
    const d2 = mgr.createVideoDisplayMaterial([MAIN_SCREEN_VIDEO_URL], 'car_second_lcd');
    assert.equal(createdVideos.length, 1, 'Identical playlists should share a single pooled <video> element');
    assert.equal(createdVideos[0].crossOrigin, undefined, 'Relative same-origin videos should not set crossOrigin');
    assert.equal(d1.entry.video, d2.entry.video);

    const hitRes = mgr.hitDisplayEntry(d1.entry, 0.5, 0.5, 100, 1.0);
    mgr.hitDisplayEntry(d1.entry, 0.5, 0.5, 100, 1.1);
    assert.equal(hitRes, 'shattered');
    assert.ok(d1.entry.damageHits >= 3);
    assert.equal(d2.entry.damageHits, 0, 'Destroying one screen must not damage sibling screens');
    mgr.dispose();
  } finally {
    if (prevDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDoc;
    }
  }
});

test('all referenced mansion media playlists and DJ audio assets exist on disk', () => {
  const requiredMedia = [
    'public/assets/aistudio/Grand_Theft_Auto_VI__An_Extended_Look___Now_Playing_720P_HD__3f882ce6.mp4',
    'public/assets/aistudio/game_video_2_deb9f1ca.mp4',
    'public/assets/aistudio/movie_video_1_627e1400.mp4',
    'public/assets/aistudio/Black_Ops_6_Kilo_141_vs_MW4_Axion_Weapons_inspection__No_Ammo___mw4__bo6__callofduty_720P_HD__5ca51370.mp4',
    'public/assets/aistudio/GTA_VI_vs_Watch_Dogs_2___Pistol_Shooting_Physics_Comparison__1080P_HD__54ca8cce.mp4',
    'public/assets/aistudio/gaming_screen_loop.mp4',
    'public/assets/aistudio/neon_city_wall_loop.mp4',
    'public/assets/aistudio/party_dj_music_1.mp3',
    'public/assets/aistudio/party_dj_music_2.mp3',
  ];
  for (const relPath of requiredMedia) {
    const abs = path.resolve(process.cwd(), relPath);
    assert.equal(fs.existsSync(abs), true, `Missing required media file: ${relPath}`);
  }
});

