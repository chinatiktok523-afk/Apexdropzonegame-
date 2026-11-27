import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { DEFAULT_HUD_SETTINGS, type VehicleKind } from '../types';
import { DigitalDisplayManager } from './digitalDisplays';
import { MAIN_SCREEN_VIDEO_PLAYLIST, MAIN_SCREEN_VIDEO_URL, resolveGraphicsProfile } from './lobbyConfig';
import { shouldMansionNightGuestsAttend } from './mansionSystems';
import {
  SCIENCE_DOMES_CATALOG,
  SCIENCE_DOME_VIDEO_PLAYLISTS,
  SCIENCE_WALL_BOUNDS,
  SCIENCE_WALL_DOORS,
  stepScienceWallDoors,
} from './scienceDistrictSystems';
import { VehicleManager, VEHICLE_SPECS } from './vehicles';

function withMockDom<T>(fn: () => T): T {
  const prevDoc = (globalThis as { document?: unknown }).document;
  const noopCtx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === 'measureText') return () => ({ width: 12 });
        return () => {};
      },
      set: () => true,
    },
  );
  (globalThis as { document?: unknown }).document = {
    body: { appendChild: () => {} },
    createElement: (tag: string) =>
      tag === 'video'
        ? {
            muted: true,
            paused: true,
            readyState: 4,
            videoWidth: 640,
            videoHeight: 360,
            volume: 0,
            src: '',
            style: { cssText: '' },
            setAttribute: () => {},
            addEventListener: () => {},
            load: () => {},
            play: () => Promise.resolve(),
            pause: () => {},
            remove: () => {},
            removeAttribute: () => {},
          }
        : tag === 'div'
          ? { style: { cssText: '' }, setAttribute: () => {}, appendChild: () => {}, remove: () => {} }
          : { width: 512, height: 256, getContext: () => noopCtx },
  };
  try {
    return fn();
  } finally {
    if (prevDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = prevDoc;
  }
}

test('Mansion VIP guests, helicopter arrival, and dancers strictly attend only during night phase', () => {
  assert.equal(shouldMansionNightGuestsAttend('morning', false), false);
  assert.equal(shouldMansionNightGuestsAttend('afternoon', false), false);
  assert.equal(shouldMansionNightGuestsAttend('sunset', false), false);
  assert.equal(shouldMansionNightGuestsAttend('night', false), true);
  assert.equal(shouldMansionNightGuestsAttend('night', true), false);
});

test('Future City perimeter wall & 4 automatic proximity sliding portals open and close smoothly', () => {
  assert.ok(SCIENCE_WALL_BOUNDS.height >= 14);
  assert.equal(SCIENCE_WALL_DOORS.length, 4);

  const farPlayer = { x: 0, z: 0 };
  let fracs = [0, 0, 0, 0];
  fracs = stepScienceWallDoors(fracs, 0.5, farPlayer, null);
  assert.deepEqual(fracs, [0, 0, 0, 0], 'All perimeter doors remain closed when player is far away');

  // Drive near South Avenue portal
  const southAve = SCIENCE_WALL_DOORS[2];
  fracs = stepScienceWallDoors(fracs, 0.6, farPlayer, { x: southAve.x, z: southAve.z - 8 });
  assert.ok(fracs[2] > 0.5, 'Driven vehicle approaching Future City portal opens its sliding doors');
  assert.equal(fracs[0], 0, 'Other distant portals stay closed');

  // Step away -> door smoothly shuts across ticks
  fracs = stepScienceWallDoors(fracs, 0.5, farPlayer, farPlayer);
  assert.ok(fracs[2] < 1, 'Portal starts closing smoothly after leaving trigger radius');
  fracs = stepScienceWallDoors(fracs, 0.5, farPlayer, farPlayer);
  assert.equal(fracs[2], 0, 'Portal finishes closing cleanly to 0');
});

test('All 8 Future City dome MP4 playlists and Main Screen Video URLs exist on disk', () => {
  assert.equal(SCIENCE_DOMES_CATALOG.length, 8);
  assert.equal(SCIENCE_DOME_VIDEO_PLAYLISTS.length, 8);

  const checkRel = (url: string) => {
    const clean = url.replace(/^\.\//, 'public/');
    assert.equal(fs.existsSync(path.resolve(process.cwd(), clean)), true, `Missing asset on disk: ${clean}`);
  };
  checkRel(MAIN_SCREEN_VIDEO_URL);
  MAIN_SCREEN_VIDEO_PLAYLIST.forEach(checkRel);
  SCIENCE_DOME_VIDEO_PLAYLISTS.flat().forEach(checkRel);
});

test('LED screens crack under rifle bullets and shatter cleanly in a single grenade blast (dmg >= 115)', () => {
  withMockDom(() => {
    const mgr = new DigitalDisplayManager();
    const { entry: rifleTarget } = mgr.createDisplayMaterial('shopping_mall');
    assert.equal(mgr.hitDisplayEntry(rifleTarget, 0.4, 0.5, 28, 1.0), 'cracked');
    assert.equal(mgr.hitDisplayEntry(rifleTarget, 0.5, 0.5, 28, 1.1), 'cracked');
    assert.equal(mgr.hitDisplayEntry(rifleTarget, 0.6, 0.5, 28, 1.2), 'shattered');

    const { entry: grenadeTarget } = mgr.createDisplayMaterial('sci_dome_screen');
    assert.equal(mgr.hitDisplayEntry(grenadeTarget, 0.5, 0.5, 145, 2.0), 'shattered');
    assert.ok(grenadeTarget.damageHits >= 3);
    mgr.dispose();
  });
});

test('All 9 redesigned Future City vehicles spawn with correct rigs, thrusters, tank turret, and HUD flags', () => {
  withMockDom(() => {
    const kinds: VehicleKind[] = [
      'future_sports_car',
      'future_super_car',
      'future_suv',
      'future_bike',
      'future_heli',
      'future_flying_car',
      'future_drone',
      'future_tank',
      'koutone_hover',
    ];

    const scene = new THREE.Scene();
    const vm = new VehicleManager(scene, false);
    vm.spawnAll(
      kinds.map((k, idx) => ({ id: `fc_${k}`, kind: k, x: idx * 8, z: -500, yaw: 0 })),
      () => 0,
    );

    assert.equal(vm.vehicles.length, 9);
    for (const kind of kinds) {
      assert.ok(VEHICLE_SPECS[kind], `Missing VEHICLE_SPECS for ${kind}`);
    }

    const tank = vm.getById('fc_future_tank')!;
    assert.ok(tank.turretGroup && tank.turretMuzzle, 'Future Tank must have articulated rotating railgun turret & muzzle');
    const tankHud = vm.buildHudState(tank, new THREE.Vector3(), () => 0);
    assert.equal(tankHud.hasMountedGun, true);

    const drone = vm.getById('fc_future_drone')!;
    assert.equal(drone.spec.isHelicopter, true);
    assert.equal(drone.auxRotors?.length, 4, 'Future Drone must have 4 ducted fan rotors');

    const koutone = vm.getById('fc_koutone_hover')!;
    assert.equal(koutone.wheels.length, 0, 'Koutone Hover Coupe must float with 0 wheels and 4 hover thrusters');
    assert.equal(koutone.hoverThrusters?.length, 4);

    vm.clear();
  });
});

test('Hardware Acceleration defaults enabled and resolves cleanly in Graphics Profile', () => {
  assert.equal(DEFAULT_HUD_SETTINGS.hardwareAcceleration, true);
  const onProfile = resolveGraphicsProfile(DEFAULT_HUD_SETTINGS, false);
  assert.equal(onProfile.hardwareAcceleration, true);
  const offProfile = resolveGraphicsProfile({ ...DEFAULT_HUD_SETTINGS, hardwareAcceleration: false }, false);
  assert.equal(offProfile.hardwareAcceleration, false);
});
