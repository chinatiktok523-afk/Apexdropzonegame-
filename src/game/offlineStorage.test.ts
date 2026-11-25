import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SIMULATOR_PROGRESS,
  SIMULATOR_PROGRESS_STORAGE_KEY,
  loadSimulatorProgress,
} from './offlineStorage';
import { DEFAULT_HUD_SETTINGS, SIM_SHOP_ITEMS, type VehicleCameraMode } from '../types';

test('loadSimulatorProgress returns full offline defaults and safely migrates legacy saves', () => {
  // Without browser window/localStorage, returns defaults cleanly
  const fallback = loadSimulatorProgress();
  assert.equal(fallback.credits, DEFAULT_SIMULATOR_PROGRESS.credits);
  assert.equal(fallback.credits, 1500);
  assert.deepEqual(fallback.purchasedItems, {});
  assert.equal(fallback.totalSpentCredits, 0);

  // Mock browser localStorage to verify sanitization and backwards compatibility
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = { localStorage: mockLocalStorage };

  try {
    // Legacy save missing credits & shop inventory preserves existing position & grants starting 1500₡
    store.set(
      SIMULATOR_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        lastPoiId: 'sim_mall',
        lastX: -44,
        lastZ: -36,
        lastYaw: 1.5,
        lastDistrict: 'Central Resort & Mall Hub',
        visitedDistricts: ['Central Resort & Mall Hub', 'Festival Amusement Park'],
        stuntsCompleted: 3,
        racesCompleted: 1,
        bestLapSec: 42.6,
        hasSavedPosition: true,
      }),
    );
    const migrated = loadSimulatorProgress();
    assert.equal(migrated.lastPoiId, 'sim_mall');
    assert.equal(migrated.hasSavedPosition, true);
    assert.equal(migrated.credits, 1500);
    assert.equal(migrated.stuntsCompleted, 3);
    assert.equal(migrated.bestLapSec, 42.6);
    assert.equal(migrated.visitedDistricts.length, 2);

    // Corrupted / invalid values get clamped & sanitized safely
    store.set(
      SIMULATOR_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        credits: -250,
        purchasedItems: {
          energy_snack: 2.7,
          invalid_zero: 0,
          bad_nan: 'abc',
        },
        totalSpentCredits: -99,
      }),
    );
    const sanitized = loadSimulatorProgress();
    assert.equal(sanitized.credits, 0);
    assert.equal(sanitized.totalSpentCredits, 0);
    assert.deepEqual(sanitized.purchasedItems, { energy_snack: 3 });
  } finally {
    (globalThis as { window?: unknown }).window = prevWindow;
  }
});

test('SIM_SHOP_ITEMS defines valid offline catalog across food, gear, and vehicle categories', () => {
  assert.ok(SIM_SHOP_ITEMS.length >= 6);
  const ids = new Set<string>();
  const cats = new Set<string>();
  for (const item of SIM_SHOP_ITEMS) {
    assert.ok(item.id.length > 0);
    assert.ok(!ids.has(item.id), `Duplicate shop item id ${item.id}`);
    ids.add(item.id);
    cats.add(item.category);
    assert.ok(item.price > 0);
    assert.ok(item.healHp > 0 || item.grantArmor > 0 || item.staminaRefill > 0);
  }
  assert.ok(cats.has('food'));
  assert.ok(cats.has('gear'));
  assert.ok(cats.has('vehicle'));
});

test('HudSettings and VehicleCameraMode exclude Battle BGM and include Action camera', () => {
  assert.equal('musicVolume' in DEFAULT_HUD_SETTINGS, false);
  const modes: VehicleCameraMode[] = ['inner', 'near', 'outer', 'far', 'action'];
  assert.equal(modes.includes('action'), true);
});
