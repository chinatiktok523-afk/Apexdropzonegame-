import { User, signInWithPopup, signOut } from 'firebase/auth';
import {
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { SimulatorProgress } from '../game/offlineStorage';
import {
  BIKE_STYLES,
  BikeStyleId,
  LoadoutConfig,
  TimeOfDayPhase,
  WeatherKind,
  normalizeWeaponId,
} from '../types';
import {
  OperationType,
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
} from './firebase';

const VALID_ID_RE = /^[a-zA-Z0-9_\-]+$/;

function clampId(val: unknown, fallback: string, maxLen: number): string {
  if (typeof val === 'string') {
    const trimmed = val.trim().slice(0, maxLen);
    if (trimmed.length >= 1 && VALID_ID_RE.test(trimmed)) {
      return trimmed;
    }
  }
  return fallback;
}

function clampString(val: unknown, fallback: string, maxLen: number): string {
  if (typeof val === 'string') {
    const trimmed = val.trim().slice(0, maxLen);
    if (trimmed.length >= 1) return trimmed;
  }
  return fallback;
}

function clampFinite(val: unknown, fallback: number, min: number, max: number): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.min(max, Math.max(min, val));
  }
  return fallback;
}

function sanitizePurchasedItems(raw: Record<string, number> | undefined): Record<string, number> {
  const clean: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return clean;
  let count = 0;
  for (const [key, qty] of Object.entries(raw)) {
    if (count >= 32) break;
    if (typeof qty === 'number' && Number.isFinite(qty) && qty > 0) {
      const cleanKey = key.trim().slice(0, 48);
      if (cleanKey.length > 0) {
        clean[cleanKey] = Math.min(999, Math.round(qty));
        count++;
      }
    }
  }
  return clean;
}

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleAuthProvider);
  await ensureUserProfile(credential.user);
  return credential.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfile(user: User): Promise<void> {
  const uid = user.uid;
  const displayName = clampString(user.displayName, 'Operator', 80);
  const profilePath = `users/${uid}`;
  const profileRef = doc(db, 'users', uid);

  let profileSnap;
  try {
    profileSnap = await getDoc(profileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  if (!profileSnap.exists()) {
    try {
      await setDoc(profileRef, {
        uid,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, profilePath);
    }
  } else if (profileSnap.data()?.displayName !== displayName) {
    try {
      await updateDoc(profileRef, {
        displayName,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, profilePath);
    }
  }

  if (user.email) {
    const email = clampString(user.email, '', 160);
    if (email.length >= 3) {
      const privatePath = `users/${uid}/private/account`;
      const privateRef = doc(db, 'users', uid, 'private', 'account');
      let privateSnap;
      try {
        privateSnap = await getDoc(privateRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, privatePath);
      }
      if (!privateSnap.exists()) {
        try {
          await setDoc(privateRef, {
            uid,
            email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, privatePath);
        }
      } else if (privateSnap.data()?.email !== email) {
        try {
          await updateDoc(privateRef, {
            email,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, privatePath);
        }
      }
    }
  }
}

export interface LoadedCloudSave {
  simProgress: SimulatorProgress;
  loadoutPatch: Partial<LoadoutConfig>;
}

export async function loadCloudSimulatorSave(uid: string): Promise<LoadedCloudSave | null> {
  const savePath = `users/${uid}/saves/world_simulator`;
  const saveRef = doc(db, 'users', uid, 'saves', 'world_simulator');
  let snap;
  try {
    snap = await getDoc(saveRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, savePath);
  }
  if (!snap.exists()) return null;

  const d = snap.data() as Record<string, unknown>;
  const updatedTs = d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now();
  const timePhase: TimeOfDayPhase =
    d.timePhase === 'morning' ||
    d.timePhase === 'afternoon' ||
    d.timePhase === 'sunset' ||
    d.timePhase === 'night'
      ? d.timePhase
      : 'morning';
  const weather: WeatherKind =
    d.weather === 'clear' ||
    d.weather === 'cloudy' ||
    d.weather === 'foggy' ||
    d.weather === 'rainy'
      ? d.weather
      : 'clear';
  const bikeStyle: BikeStyleId = BIKE_STYLES.some((b) => b.id === d.bikeStyle)
    ? (d.bikeStyle as BikeStyleId)
    : 'volt_green';

  const simProgress: SimulatorProgress = {
    lastPoiId: clampId(d.lastPoiId, 'sim_petrol', 64),
    lastX: clampFinite(d.lastX, 0, -10000, 10000),
    lastZ: clampFinite(d.lastZ, 0, -10000, 10000),
    lastYaw: clampFinite(d.lastYaw, 0, -100, 100),
    lastDistrict: clampString(d.lastDistrict, 'Central Resort & Mall Hub', 80),
    timePhase,
    weather,
    autoCycle: typeof d.autoCycle === 'boolean' ? d.autoCycle : true,
    bikeStyle,
    visitedDistricts: Array.isArray(d.visitedDistricts)
      ? d.visitedDistricts
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim().slice(0, 80))
          .slice(0, 40)
      : [],
    totalExploreSeconds: Math.round(clampFinite(d.totalExploreSeconds, 0, 0, 100000000)),
    stuntsCompleted: Math.round(clampFinite(d.stuntsCompleted, 0, 0, 1000000)),
    racesCompleted: Math.round(clampFinite(d.racesCompleted, 0, 0, 1000000)),
    bestLapSec:
      typeof d.bestLapSec === 'number' && Number.isFinite(d.bestLapSec) && d.bestLapSec > 0
        ? Math.min(86400, d.bestLapSec)
        : null,
    credits: Math.round(clampFinite(d.credits, 1500, 0, 100000000)),
    purchasedItems: sanitizePurchasedItems(d.purchasedItems as Record<string, number> | undefined),
    totalSpentCredits: Math.round(clampFinite(d.totalSpentCredits, 0, 0, 100000000)),
    hasSavedPosition: Boolean(d.hasSavedPosition),
    updatedAt: updatedTs,
  };

  const loadoutPatch: Partial<LoadoutConfig> = {
    startingWeapon: normalizeWeaponId(
      typeof d.startingWeapon === 'string' ? d.startingWeapon : undefined,
    ),
  };
  if (
    d.operatorSkin === 'wolf_black' ||
    d.operatorSkin === 'desert_recon' ||
    d.operatorSkin === 'ranger_olive' ||
    d.operatorSkin === 'night_ops'
  ) {
    loadoutPatch.operatorSkin = d.operatorSkin;
  }
  if (
    d.weaponSkin === 'standard' ||
    d.weaponSkin === 'crimson' ||
    d.weaponSkin === 'desert' ||
    d.weaponSkin === 'carbon' ||
    d.weaponSkin === 'arctic'
  ) {
    loadoutPatch.weaponSkin = d.weaponSkin;
  }
  if (
    d.reticleColor === 'amber' ||
    d.reticleColor === 'emerald' ||
    d.reticleColor === 'cyan' ||
    d.reticleColor === 'crimson'
  ) {
    loadoutPatch.reticleColor = d.reticleColor;
  }

  return { simProgress, loadoutPatch };
}

export async function saveCloudSimulatorSave(
  user: User,
  progress: SimulatorProgress,
  loadout: LoadoutConfig,
): Promise<void> {
  await ensureUserProfile(user);

  const uid = user.uid;
  const savePath = `users/${uid}/saves/world_simulator`;
  const saveRef = doc(db, 'users', uid, 'saves', 'world_simulator');

  const payload = {
    lastPoiId: clampId(progress.lastPoiId, 'sim_petrol', 64),
    lastX: clampFinite(progress.lastX, 0, -10000, 10000),
    lastZ: clampFinite(progress.lastZ, 0, -10000, 10000),
    lastYaw: clampFinite(progress.lastYaw, 0, -100, 100),
    lastDistrict: clampString(progress.lastDistrict, 'Central Resort & Mall Hub', 80),
    timePhase: progress.timePhase,
    weather: progress.weather,
    autoCycle: Boolean(progress.autoCycle),
    bikeStyle: clampId(progress.bikeStyle, 'volt_green', 32),
    visitedDistricts: progress.visitedDistricts
      .filter((d) => typeof d === 'string' && d.trim().length > 0)
      .map((d) => d.trim().slice(0, 80))
      .slice(0, 40),
    totalExploreSeconds: Math.round(clampFinite(progress.totalExploreSeconds, 0, 0, 100000000)),
    stuntsCompleted: Math.round(clampFinite(progress.stuntsCompleted, 0, 0, 1000000)),
    racesCompleted: Math.round(clampFinite(progress.racesCompleted, 0, 0, 1000000)),
    bestLapSec:
      progress.bestLapSec !== null && Number.isFinite(progress.bestLapSec) && progress.bestLapSec > 0
        ? Math.min(86400, progress.bestLapSec)
        : null,
    credits: Math.round(clampFinite(progress.credits, 1500, 0, 100000000)),
    purchasedItems: sanitizePurchasedItems(progress.purchasedItems),
    totalSpentCredits: Math.round(clampFinite(progress.totalSpentCredits, 0, 0, 100000000)),
    hasSavedPosition: Boolean(progress.hasSavedPosition),
    startingWeapon: clampString(loadout.startingWeapon, 'm4a1', 32),
    operatorSkin: clampString(loadout.operatorSkin, 'wolf_black', 32),
    weaponSkin: clampString(loadout.weaponSkin, 'standard', 32),
    reticleColor: clampString(loadout.reticleColor, 'amber', 32),
    updatedAt: serverTimestamp(),
  };

  let existingSnap;
  try {
    existingSnap = await getDoc(saveRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, savePath);
  }

  if (!existingSnap.exists()) {
    try {
      await setDoc(saveRef, {
        uid,
        ...payload,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, savePath);
    }
  } else {
    try {
      await updateDoc(saveRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, savePath);
    }
  }
}
