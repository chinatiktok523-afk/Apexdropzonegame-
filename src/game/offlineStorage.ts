import { BIKE_STYLES, type BikeStyleId, type TimeOfDayPhase, type WeatherKind } from '../types';

export const HUD_SETTINGS_STORAGE_KEY = 'apex_dropzone_hud_settings_v1';
export const LOADOUT_STORAGE_KEY = 'apex_dropzone_loadout_v1';
export const SIMULATOR_PROGRESS_STORAGE_KEY = 'apex_dropzone_simulator_v1';

const ALL_PERSISTENT_KEYS = [
  HUD_SETTINGS_STORAGE_KEY,
  LOADOUT_STORAGE_KEY,
  SIMULATOR_PROGRESS_STORAGE_KEY,
] as const;

export interface SimulatorProgress {
  lastPoiId: string;
  lastX: number;
  lastZ: number;
  lastYaw: number;
  lastDistrict: string;
  timePhase: TimeOfDayPhase;
  weather: WeatherKind;
  autoCycle: boolean;
  bikeStyle: BikeStyleId;
  visitedDistricts: string[];
  totalExploreSeconds: number;
  stuntsCompleted: number;
  racesCompleted: number;
  bestLapSec: number | null;
  credits: number;
  purchasedItems: Record<string, number>;
  totalSpentCredits: number;
  hasSavedPosition: boolean;
  updatedAt: number;
}

export const DEFAULT_SIMULATOR_PROGRESS: SimulatorProgress = {
  lastPoiId: 'sim_mansion',
  lastX: 0,
  lastZ: -274,
  lastYaw: 0,
  lastDistrict: 'Apex Luxury Mansion',
  timePhase: 'morning',
  weather: 'clear',
  autoCycle: true,
  bikeStyle: 'volt_green',
  visitedDistricts: [],
  totalExploreSeconds: 0,
  stuntsCompleted: 0,
  racesCompleted: 0,
  bestLapSec: null,
  credits: 1500,
  purchasedItems: {},
  totalSpentCredits: 0,
  hasSavedPosition: false,
  updatedAt: 0,
};

const IDB_NAME = 'ApexDropzoneOfflineDB';
const IDB_VERSION = 1;
const IDB_STORE = 'save_kv';

let idbPromise: Promise<IDBDatabase | null> | null = null;

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return idbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(typeof req.result === 'string' ? req.result : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function saveOfflineJson(key: string, data: unknown): void {
  try {
    const serialized = JSON.stringify(data);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, serialized);
    }
    void idbSet(key, serialized);
  } catch {
    // Ignore quota/private-mode storage errors safely
  }
}

export function loadOfflineJson<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadSimulatorProgress(): SimulatorProgress {
  const parsed = loadOfflineJson<Partial<SimulatorProgress>>(SIMULATOR_PROGRESS_STORAGE_KEY);
  if (!parsed) return { ...DEFAULT_SIMULATOR_PROGRESS };
  const cleanPurchased: Record<string, number> = {};
  if (parsed.purchasedItems && typeof parsed.purchasedItems === 'object') {
    for (const [k, v] of Object.entries(parsed.purchasedItems)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        cleanPurchased[k] = Math.min(99, Math.round(v));
      }
    }
  }
  return {
    lastPoiId: typeof parsed.lastPoiId === 'string' && parsed.lastPoiId ? parsed.lastPoiId : 'sim_mansion',
    lastX: typeof parsed.lastX === 'number' && Number.isFinite(parsed.lastX) ? parsed.lastX : 0,
    lastZ: typeof parsed.lastZ === 'number' && Number.isFinite(parsed.lastZ) ? parsed.lastZ : -274,
    lastYaw: typeof parsed.lastYaw === 'number' && Number.isFinite(parsed.lastYaw) ? parsed.lastYaw : 0,
    lastDistrict:
      typeof parsed.lastDistrict === 'string' && parsed.lastDistrict
        ? parsed.lastDistrict
        : DEFAULT_SIMULATOR_PROGRESS.lastDistrict,
    timePhase:
      parsed.timePhase === 'morning' ||
      parsed.timePhase === 'afternoon' ||
      parsed.timePhase === 'sunset' ||
      parsed.timePhase === 'night'
        ? parsed.timePhase
        : 'morning',
    weather:
      parsed.weather === 'clear' ||
      parsed.weather === 'cloudy' ||
      parsed.weather === 'foggy' ||
      parsed.weather === 'rainy'
        ? parsed.weather
        : 'clear',
    autoCycle: typeof parsed.autoCycle === 'boolean' ? parsed.autoCycle : true,
    bikeStyle: BIKE_STYLES.some((b) => b.id === parsed.bikeStyle)
      ? (parsed.bikeStyle as BikeStyleId)
      : 'volt_green',
    visitedDistricts: Array.isArray(parsed.visitedDistricts)
      ? parsed.visitedDistricts.filter((d): d is string => typeof d === 'string').slice(0, 40)
      : [],
    totalExploreSeconds:
      typeof parsed.totalExploreSeconds === 'number' && Number.isFinite(parsed.totalExploreSeconds)
        ? Math.max(0, parsed.totalExploreSeconds)
        : 0,
    stuntsCompleted:
      typeof parsed.stuntsCompleted === 'number' && Number.isFinite(parsed.stuntsCompleted)
        ? Math.max(0, parsed.stuntsCompleted)
        : 0,
    racesCompleted:
      typeof parsed.racesCompleted === 'number' && Number.isFinite(parsed.racesCompleted)
        ? Math.max(0, parsed.racesCompleted)
        : 0,
    bestLapSec:
      typeof parsed.bestLapSec === 'number' && Number.isFinite(parsed.bestLapSec)
        ? parsed.bestLapSec
        : null,
    credits:
      typeof parsed.credits === 'number' && Number.isFinite(parsed.credits)
        ? Math.max(0, Math.round(parsed.credits))
        : DEFAULT_SIMULATOR_PROGRESS.credits,
    purchasedItems: cleanPurchased,
    totalSpentCredits:
      typeof parsed.totalSpentCredits === 'number' && Number.isFinite(parsed.totalSpentCredits)
        ? Math.max(0, Math.round(parsed.totalSpentCredits))
        : 0,
    hasSavedPosition: Boolean(parsed.hasSavedPosition),
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
  };
}

/**
 * Synchronizes localStorage <-> IndexedDB without overwriting or deleting existing saves.
 * Returns any keys that were restored from IndexedDB into localStorage so React state can refresh.
 */
export async function syncOfflineSaveBackups(): Promise<Record<string, string>> {
  const restored: Record<string, string> = {};
  if (typeof window === 'undefined' || !window.localStorage) return restored;

  for (const key of ALL_PERSISTENT_KEYS) {
    try {
      const lsRaw = window.localStorage.getItem(key);
      const idbRaw = await idbGet(key);

      if (!lsRaw && idbRaw) {
        window.localStorage.setItem(key, idbRaw);
        restored[key] = idbRaw;
      } else if (lsRaw && !idbRaw) {
        await idbSet(key, lsRaw);
      } else if (lsRaw && idbRaw && lsRaw !== idbRaw) {
        // Keep whichever has newer timestamp if present, else preserve existing localStorage
        try {
          const lsObj = JSON.parse(lsRaw) as { updatedAt?: number };
          const idbObj = JSON.parse(idbRaw) as { updatedAt?: number };
          if (
            typeof idbObj?.updatedAt === 'number' &&
            typeof lsObj?.updatedAt === 'number' &&
            idbObj.updatedAt > lsObj.updatedAt
          ) {
            window.localStorage.setItem(key, idbRaw);
            restored[key] = idbRaw;
          } else {
            await idbSet(key, lsRaw);
          }
        } catch {
          await idbSet(key, lsRaw);
        }
      }
    } catch {
      // Ignore single-key sync failure
    }
  }
  return restored;
}
