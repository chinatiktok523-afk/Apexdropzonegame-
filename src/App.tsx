import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { User, onAuthStateChanged } from 'firebase/auth';
import { GameHUD } from './components/GameHUD';
import { HudLayoutEditor } from './components/HudLayoutEditor';
import { LoadingScreen } from './components/LoadingScreen';
import { SimulatorLobbyScreen } from './components/SimulatorLobbyScreen';
import { SmartCityDashboard } from './components/SmartCityDashboard';
import { soundEngine } from './game/audio';
import { ShooterEngine } from './game/engine';
import { auth } from './lib/firebase';
import {
  loadCloudSimulatorSave,
  saveCloudSimulatorSave,
  signInWithGoogle,
  signOutAccount,
} from './lib/cloudSave';
import {
  HUD_SETTINGS_STORAGE_KEY,
  LOADOUT_STORAGE_KEY,
  SIMULATOR_PROGRESS_STORAGE_KEY,
  SimulatorProgress,
  loadSimulatorProgress,
  saveOfflineJson,
  syncOfflineSaveBackups,
} from './game/offlineStorage';
import { getMegaWorldDistrictAt } from './game/simulatorSystems';
import {
  BikeStyleId,
  CustomDropTarget,
  CustomizableControlId,
  DEFAULT_HUD_CONTROL_LAYOUT,
  DEFAULT_HUD_SETTINGS,
  DEFAULT_LOADOUT_CONFIG,
  DropSector,
  GamePhase,
  GraphicsQuality,
  HudControlLayout,
  HudSettings,
  HudState,
  LoadProgress,
  LoadoutConfig,
  MAP_PRESETS,
  MapId,
  SIMULATOR_POIS,
  TimeOfDayPhase,
  VehicleInputState,
  WeaponId,
  WeatherKind,
  WorldSystem,
  createWeaponRecord,
  normalizeWeaponId,
} from './types';

const CONTROL_IDS: CustomizableControlId[] = [
  'move',
  'fire',
  'jump',
  'ads',
  'grenade',
  'reload',
  'slide',
  'crouch',
  'camera',
];

function normalizeGraphicsQuality(raw: unknown): GraphicsQuality {
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw;
  if (raw === 'performance') return 'low';
  if (raw === 'auto') return 'medium';
  return DEFAULT_HUD_SETTINGS.graphicsQuality;
}

function mergeControlLayout(raw: Partial<HudControlLayout> | undefined): HudControlLayout {
  const next = { ...DEFAULT_HUD_CONTROL_LAYOUT };
  CONTROL_IDS.forEach((id) => {
    const src = raw?.[id];
    const def = DEFAULT_HUD_CONTROL_LAYOUT[id];
    next[id] = {
      xPct: typeof src?.xPct === 'number' ? Math.min(94, Math.max(6, src.xPct)) : def.xPct,
      yPct: typeof src?.yPct === 'number' ? Math.min(93, Math.max(18, src.yPct)) : def.yPct,
      scale: typeof src?.scale === 'number' ? Math.min(1.75, Math.max(0.65, src.scale)) : def.scale,
    };
  });
  return next;
}

function loadHudSettings(): HudSettings {
  try {
    const raw = localStorage.getItem(HUD_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_HUD_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<HudSettings>;
    return {
      hudScale:
        typeof parsed.hudScale === 'number'
          ? Math.min(1.3, Math.max(0.75, parsed.hudScale))
          : DEFAULT_HUD_SETTINGS.hudScale,
      hudOpacity:
        typeof parsed.hudOpacity === 'number'
          ? Math.min(1, Math.max(0.45, parsed.hudOpacity))
          : DEFAULT_HUD_SETTINGS.hudOpacity,
      lookSensitivity:
        typeof parsed.lookSensitivity === 'number'
          ? Math.min(3.0, Math.max(0.5, parsed.lookSensitivity))
          : DEFAULT_HUD_SETTINGS.lookSensitivity,
      leftHanded:
        typeof parsed.leftHanded === 'boolean' ? parsed.leftHanded : DEFAULT_HUD_SETTINGS.leftHanded,
      showRadar:
        typeof parsed.showRadar === 'boolean' ? parsed.showRadar : DEFAULT_HUD_SETTINGS.showRadar,
      showTouchControls: true,
      autoSprint:
        typeof parsed.autoSprint === 'boolean' ? parsed.autoSprint : DEFAULT_HUD_SETTINGS.autoSprint,
      graphicsQuality: normalizeGraphicsQuality(parsed.graphicsQuality),
      bloomEnabled:
        typeof parsed.bloomEnabled === 'boolean'
          ? parsed.bloomEnabled
          : DEFAULT_HUD_SETTINGS.bloomEnabled,
      mapSaturation:
        typeof parsed.mapSaturation === 'number'
          ? Math.min(1.9, Math.max(0.75, parsed.mapSaturation))
          : DEFAULT_HUD_SETTINGS.mapSaturation,
      sfxVolume:
        typeof parsed.sfxVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.sfxVolume))
          : DEFAULT_HUD_SETTINGS.sfxVolume,
      muted:
        typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_HUD_SETTINGS.muted,
      controlLayout: mergeControlLayout(parsed.controlLayout),
    };
  } catch {
    return DEFAULT_HUD_SETTINGS;
  }
}

function loadLoadoutConfig(): LoadoutConfig {
  try {
    const raw = localStorage.getItem(LOADOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LOADOUT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<LoadoutConfig>;
    return {
      startingWeapon: normalizeWeaponId(parsed.startingWeapon),
      operatorSkin: parsed.operatorSkin ?? DEFAULT_LOADOUT_CONFIG.operatorSkin,
      weaponSkin: parsed.weaponSkin ?? DEFAULT_LOADOUT_CONFIG.weaponSkin,
      reticleColor: parsed.reticleColor ?? DEFAULT_LOADOUT_CONFIG.reticleColor,
      lobbyPose: parsed.lobbyPose ?? DEFAULT_LOADOUT_CONFIG.lobbyPose,
      preferredFireModes: parsed.preferredFireModes ?? {},
    };
  } catch {
    return DEFAULT_LOADOUT_CONFIG;
  }
}

const INITIAL_HUD: HudState = {
  health: 100,
  maxHealth: 100,
  isRecoveringHealth: false,
  recoveryCountdown: 0,
  armor: 50,
  maxArmor: 100,
  stamina: 100,
  grenades: 3,
  score: 0,
  highScore: 0,
  kills: 0,
  targetKills: 25,
  victoryCelebration: false,
  headshots: 0,
  wave: 1,
  enemiesRemaining: 25,
  streak: 0,
  bestStreak: 0,
  combo: 1,
  shotsFired: 0,
  shotsHit: 0,
  activeWeapon: 'm4a1',
  activeFireMode: 'auto',
  supportedFireModes: ['auto', 'burst', 'semi'],
  ammoInMag: createWeaponRecord((_id, spec) => spec.magSize),
  reserveAmmo: createWeaponRecord((_id, spec) => spec.maxReserve),
  isReloading: false,
  reloadProgress: 0,
  reloadStage: '',
  isAds: false,
  sniperZoomIndex: 3,
  sniperZoomLabel: '10x',
  activeZoomLabel: '1.5x',
  canCycleZoom: true,
  aimDistance: 0,
  fps: 60,
  isSprinting: false,
  runModeEnabled: false,
  isCrouching: false,
  isSliding: false,
  isInCover: false,
  coverPeekDir: 0,
  nearDoorway: false,
  isBreaching: false,
  isThrowingGrenade: false,
  animState: 'idle',
  perspective: 'first',
  spreadAmount: 0.02,
  hitMarker: 'none',
  headshotSeq: 0,
  lastHeadshotAt: -10,
  damageFlash: 0,
  detectedState: 'hidden',
  killFeed: [],
  headingDeg: 0,
  threats: [],
  playerX: 0,
  playerZ: 0,
  radarBlips: [],
  radarObstacles: [],
  radarWorldRange: 44,
  elapsedTime: 0,
  vehicle: {
    inVehicle: false,
    vehicleId: null,
    vehicleKind: null,
    vehicleName: null,
    cameraMode: 'outer',
    speedKmh: 0,
    gear: 'N',
    health: 0,
    maxHealth: 0,
    altitude: 0,
    crashStage: 0,
    isBikeEjected: false,
    nearbyVehicleId: null,
    nearbyVehicleName: null,
    nearbyVehicleKind: null,
    nearbyHijackVehicle: null,
    hasMountedGun: false,
  },
  worldSystem: 'simulator',
  timePhase: 'morning',
  clockLabel: '06:28',
  weather: 'clear',
  autoEnvCycle: true,
  bikeStyle: 'volt_green',
  nearbyInteractable: null,
  interactFeedback: null,
  simCredits: 1500,
  simPurchasedItems: {},
  simStuntsCompleted: 0,
  simRacesCompleted: 0,
  simBestLapSec: null,
  simVisitedCount: 0,
  wantedLevel: 0,
  wantedEvading: false,
  wantedPoliceKills: 0,
};

export default function App() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ShooterEngine | null>(null);

  const initialParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

  const [simProgress, setSimProgress] = useState<SimulatorProgress>(() => loadSimulatorProgress());
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [worldSystem, setWorldSystem] = useState<WorldSystem>('simulator');
  const [simLobbyOpen, setSimLobbyOpen] = useState<boolean>(
    () => initialParams?.get('autostart') !== '1',
  );
  const [simMapId] = useState<MapId>('simulator_city');
  const [simStartPoiId, setSimStartPoiId] = useState<string>(() => 'sim_mansion');
  const [simTimePhase, setSimTimePhase] = useState<TimeOfDayPhase>(
    () => loadSimulatorProgress().timePhase,
  );
  const [simWeather, setSimWeather] = useState<WeatherKind>(() => loadSimulatorProgress().weather);
  const [simAutoCycle, setSimAutoCycle] = useState<boolean>(
    () => loadSimulatorProgress().autoCycle,
  );
  const [simBikeStyle, setSimBikeStyle] = useState<BikeStyleId>(
    () => loadSimulatorProgress().bikeStyle,
  );

  const [selectedMap] = useState<MapId>('simulator_city');
  const [selectedSector] = useState<DropSector>('west');
  const [customDropTarget] = useState<CustomDropTarget | null>(null);
  const [hudSettings, setHudSettings] = useState<HudSettings>(() => loadHudSettings());
  const [loadoutConfig, setLoadoutConfig] = useState<LoadoutConfig>(() => loadLoadoutConfig());
  const [showHudEditor, setShowHudEditor] = useState(false);
  const [showSmartCityDashboard, setShowSmartCityDashboard] = useState(false);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [contextLost, setContextLost] = useState(false);
  const [loadProgress, setLoadProgress] = useState<LoadProgress>({
    progress: 0,
    stage: 'Initializing Engine',
    detail: 'Preparing Android WebGL & simulator assets...',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaderFading, setIsLoaderFading] = useState(false);

  // Wide-screen landscape mode: locks 16:9 widescreen framing on narrow/portrait screens, or fills widescreen displays
  const [wideLandscape, setWideLandscape] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortraitWindow, setIsPortraitWindow] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
  );

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    document.body.dataset.state =
      phase === 'playing' ? 'playing' : phase === 'paused' ? 'paused' : 'title';
  }, [phase]);
  const hudSettingsRef = useRef(hudSettings);
  hudSettingsRef.current = hudSettings;
  const selectedSectorRef = useRef(selectedSector);
  selectedSectorRef.current = selectedSector;
  const loadoutRef = useRef(loadoutConfig);
  loadoutRef.current = loadoutConfig;
  const customDropRef = useRef(customDropTarget);
  customDropRef.current = customDropTarget;

  const simProgressRef = useRef(simProgress);
  simProgressRef.current = simProgress;
  const simTimePhaseRef = useRef(simTimePhase);
  simTimePhaseRef.current = simTimePhase;
  const simWeatherRef = useRef(simWeather);
  simWeatherRef.current = simWeather;
  const simAutoCycleRef = useRef(simAutoCycle);
  simAutoCycleRef.current = simAutoCycle;
  const simBikeStyleRef = useRef(simBikeStyle);
  simBikeStyleRef.current = simBikeStyle;
  const worldSystemRef = useRef(worldSystem);
  worldSystemRef.current = worldSystem;
  const simLobbyOpenRef = useRef(simLobbyOpen);
  simLobbyOpenRef.current = simLobbyOpen;
  const showHudEditorRef = useRef(showHudEditor);
  showHudEditorRef.current = showHudEditor;
  const showSmartCityDashboardRef = useRef(showSmartCityDashboard);
  showSmartCityDashboardRef.current = showSmartCityDashboard;
  const lastSimSaveAtRef = useRef(0);
  const lastCloudSaveAtRef = useRef(0);
  const firebaseUserRef = useRef<User | null>(null);
  firebaseUserRef.current = firebaseUser;
  const latestHudRef = useRef(hud);
  latestHudRef.current = hud;

  const persistSimulatorSnapshot = useCallback(
    (force = false, overrides?: Partial<SimulatorProgress>) => {
      const now = Date.now();
      if (!force && now - lastSimSaveAtRef.current < 2500) return;
      const elapsedDeltaSec =
        lastSimSaveAtRef.current > 0 && now - lastSimSaveAtRef.current < 15000
          ? (now - lastSimSaveAtRef.current) / 1000
          : 0;
      lastSimSaveAtRef.current = now;

      const curHud = latestHudRef.current;
      const prev = simProgressRef.current;
      const inSimPlaying = worldSystemRef.current === 'simulator' && phaseRef.current === 'playing';
      const curX = inSimPlaying ? Math.round(curHud.playerX * 10) / 10 : prev.lastX;
      const curZ = inSimPlaying ? Math.round(curHud.playerZ * 10) / 10 : prev.lastZ;
      const curYaw = inSimPlaying
        ? (curHud.headingDeg * Math.PI) / 180
        : prev.lastYaw;
      const district = inSimPlaying
        ? getMegaWorldDistrictAt(curX, curZ)
        : prev.lastDistrict;
      const visited = prev.visitedDistricts.includes(district)
        ? prev.visitedDistricts
        : [...prev.visitedDistricts, district].slice(0, 40);
      const nextCredits = inSimPlaying ? curHud.simCredits : prev.credits;
      const nextSpent =
        inSimPlaying && curHud.simCredits < prev.credits
          ? prev.totalSpentCredits + (prev.credits - curHud.simCredits)
          : prev.totalSpentCredits;

      const next: SimulatorProgress = {
        ...prev,
        lastX: curX,
        lastZ: curZ,
        lastYaw: curYaw,
        lastDistrict: district,
        timePhase: simTimePhaseRef.current,
        weather: simWeatherRef.current,
        autoCycle: simAutoCycleRef.current,
        bikeStyle: simBikeStyleRef.current,
        visitedDistricts: visited,
        totalExploreSeconds: Math.round(
          prev.totalExploreSeconds + (inSimPlaying ? elapsedDeltaSec : 0),
        ),
        stuntsCompleted: inSimPlaying
          ? Math.max(prev.stuntsCompleted, curHud.simStuntsCompleted)
          : prev.stuntsCompleted,
        racesCompleted: inSimPlaying
          ? Math.max(prev.racesCompleted, curHud.simRacesCompleted)
          : prev.racesCompleted,
        bestLapSec: inSimPlaying ? (curHud.simBestLapSec ?? prev.bestLapSec) : prev.bestLapSec,
        credits: nextCredits,
        purchasedItems: inSimPlaying ? { ...curHud.simPurchasedItems } : prev.purchasedItems,
        totalSpentCredits: nextSpent,
        hasSavedPosition: prev.hasSavedPosition || inSimPlaying,
        updatedAt: now,
        ...overrides,
      };
      simProgressRef.current = next;
      setSimProgress(next);
      saveOfflineJson(SIMULATOR_PROGRESS_STORAGE_KEY, next);

      const activeUser = firebaseUserRef.current;
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (activeUser && isOnline && (force || now - lastCloudSaveAtRef.current >= 10000)) {
        lastCloudSaveAtRef.current = now;
        void saveCloudSimulatorSave(activeUser, next, loadoutRef.current).catch(() => {
          // Offline or deferred sync will retry on next snapshot
        });
      }
    },
    [],
  );

  // Sync Firebase Auth & Firestore Cloud Save only when online and signed in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      firebaseUserRef.current = user;
      setFirebaseUser(user);
      if (!user || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
      void (async () => {
        try {
          const cloud = await loadCloudSimulatorSave(user.uid);
          if (cloud) {
            const local = simProgressRef.current;
            const preferCloud =
              cloud.simProgress.updatedAt > local.updatedAt ||
              (!local.hasSavedPosition && cloud.simProgress.hasSavedPosition);
            if (preferCloud) {
              simProgressRef.current = cloud.simProgress;
              setSimProgress(cloud.simProgress);
              setSimTimePhase(cloud.simProgress.timePhase);
              simTimePhaseRef.current = cloud.simProgress.timePhase;
              setSimWeather(cloud.simProgress.weather);
              simWeatherRef.current = cloud.simProgress.weather;
              setSimAutoCycle(cloud.simProgress.autoCycle);
              simAutoCycleRef.current = cloud.simProgress.autoCycle;
              setSimBikeStyle(cloud.simProgress.bikeStyle);
              simBikeStyleRef.current = cloud.simProgress.bikeStyle;
              if (cloud.simProgress.hasSavedPosition) {
                setSimStartPoiId('saved_pos');
              }
              saveOfflineJson(SIMULATOR_PROGRESS_STORAGE_KEY, cloud.simProgress);
              if (Object.keys(cloud.loadoutPatch).length > 0) {
                setLoadoutConfig((prev) => ({ ...prev, ...cloud.loadoutPatch }));
              }
              return;
            }
          }
          await saveCloudSimulatorSave(user, simProgressRef.current, loadoutRef.current);
        } catch {
          // Offline or deferred sync falls back to local IndexedDB/localStorage cleanly
        }
      })();
    });
    return () => unsub();
  }, []);

  const handleSignInGoogle = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setAuthBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      // Popup closed or sign-in cancelled cleanly
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthBusy(true);
    try {
      await signOutAccount();
    } finally {
      setAuthBusy(false);
    }
  }, []);

  // Sync IndexedDB offline backup & initialize native Android immersion
  useEffect(() => {
    let active = true;
    void syncOfflineSaveBackups().then((restored) => {
      if (!active) return;
      if (restored[HUD_SETTINGS_STORAGE_KEY]) setHudSettings(loadHudSettings());
      if (restored[LOADOUT_STORAGE_KEY]) setLoadoutConfig(loadLoadoutConfig());
      if (restored[SIMULATOR_PROGRESS_STORAGE_KEY]) {
        const sp = loadSimulatorProgress();
        setSimProgress(sp);
        setSimTimePhase(sp.timePhase);
        setSimWeather(sp.weather);
        setSimAutoCycle(sp.autoCycle);
        setSimBikeStyle(sp.bikeStyle);
      }
    });

    if (Capacitor.isNativePlatform()) {
      StatusBar.hide().catch(() => {});
    }

    const flushSimSave = () => {
      if (worldSystemRef.current === 'simulator') {
        persistSimulatorSnapshot(true);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSimSave();
      }
    };
    window.addEventListener('pagehide', flushSimSave);
    window.addEventListener('beforeunload', flushSimSave);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener('pagehide', flushSimSave);
      window.removeEventListener('beforeunload', flushSimSave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [persistSimulatorSnapshot]);

  useEffect(() => {
    const onResize = () => {
      setIsPortraitWindow(window.innerHeight > window.innerWidth);
    };
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.state =
      phase === 'menu' ? 'title' : phase === 'playing' ? 'playing' : phase === 'paused' ? 'paused' : 'gameover';
  }, [phase]);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new ShooterEngine(mountEl, {
      onHudUpdate: (nextHud) => {
        setHud(nextHud);
        latestHudRef.current = nextHud;
      },
      onPauseRequest: () => {
        if (phaseRef.current === 'playing') {
          engineRef.current?.pauseMatch();
          setPhase('paused');
        }
      },
      onContextLost: (lost) => {
        setContextLost(lost);
      },
      onOpenSmartCityDashboard: () => {
        setShowSmartCityDashboard(true);
      },
    });

    engineRef.current = engine;
    engine.setHudSettings(hudSettingsRef.current);
    engine.setLobbyConfig({
      mapId: 'simulator_city',
      loadout: loadoutRef.current,
      viewMode: 'overview',
      previewItem: loadoutRef.current.startingWeapon,
    });

    let cancelled = false;
    let fadeTimer: number | null = null;

    void (async () => {
      try {
        await engine.initializeAssets((nextProgress) => {
          if (!cancelled) {
            setLoadProgress(nextProgress);
          }
        });
      } catch {
        // Proceed cleanly even if an optional warm-up step failed
      }
      if (cancelled) return;
      setLoadProgress({
        progress: 100,
        stage: 'Ready for Dropzone',
        detail: 'All local tactical systems ready',
      });
      setIsLoaderFading(true);
      const shouldAutostart =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('autostart') === '1';
      fadeTimer = window.setTimeout(() => {
        if (!cancelled) {
          setIsLoading(false);
          if (Capacitor.isNativePlatform()) {
            SplashScreen.hide().catch(() => {});
          }
          if (shouldAutostart) {
            const params = new URLSearchParams(window.location.search);
            const poiParam = params.get('poi');
            const pxParam = params.get('px');
            const pzParam = params.get('pz');
            const pyParam = params.get('py');
            const pyawParam = params.get('pyaw');
            const poiObj = poiParam ? SIMULATOR_POIS.find((p) => p.id === poiParam) : null;
            const hasExplicitCoords =
              pxParam !== null &&
              pzParam !== null &&
              Number.isFinite(Number(pxParam)) &&
              Number.isFinite(Number(pzParam));
            const autoCustomDrop: CustomDropTarget | null = hasExplicitCoords
              ? {
                  x: Number(pxParam),
                  ...(pyParam !== null && Number.isFinite(Number(pyParam)) ? { y: Number(pyParam) } : {}),
                  z: Number(pzParam),
                  label: poiObj?.name ?? 'Apex Luxury Mansion',
                }
              : poiObj
                ? { x: poiObj.x, z: poiObj.z, label: poiObj.name }
                : customDropRef.current;
            const autoYaw =
              pyawParam !== null && Number.isFinite(Number(pyawParam))
                ? Number(pyawParam)
                : undefined;
            setWorldSystem('simulator');
            setSimLobbyOpen(false);
            setShowHudEditor(false);
            setPhase('playing');
            engine.startMatch(
              'recruit',
              'third',
              0,
              25,
              {
                mapId: 'simulator_city',
                dropSector: selectedSectorRef.current,
                loadout: loadoutRef.current,
                customDrop: autoCustomDrop,
                worldSystem: 'simulator',
                initialTimePhase: (params.get('time') as TimeOfDayPhase | null) || 'morning',
                initialWeather: (params.get('weather') as WeatherKind | null) || 'clear',
                autoEnvCycle: params.get('autocycle') === '0' ? false : true,
                ...(autoYaw !== undefined ? { initialYaw: autoYaw } : {}),
              },
            );
          }
        }
      }, 460);
    })();

    return () => {
      cancelled = true;
      if (fadeTimer !== null) {
        window.clearTimeout(fadeTimer);
      }
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setHudSettings(hudSettings);
    soundEngine.setSfxVolume(hudSettings.sfxVolume);
    soundEngine.setMuted(hudSettings.muted);
    saveOfflineJson(HUD_SETTINGS_STORAGE_KEY, hudSettings);
  }, [hudSettings]);

  // Unlock WebAudio & background music on any Android touch / click / pointer gesture (capture phase)
  useEffect(() => {
    const handleUnlock = () => {
      soundEngine.unlock();
    };
    window.addEventListener('pointerdown', handleUnlock, { capture: true, passive: true });
    window.addEventListener('touchstart', handleUnlock, { capture: true, passive: true });
    window.addEventListener('click', handleUnlock, { capture: true, passive: true });
    window.addEventListener('keydown', handleUnlock, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock, { capture: true });
      window.removeEventListener('touchstart', handleUnlock, { capture: true });
      window.removeEventListener('click', handleUnlock, { capture: true });
      window.removeEventListener('keydown', handleUnlock, { capture: true });
    };
  }, []);

  useEffect(() => {
    saveOfflineJson(LOADOUT_STORAGE_KEY, loadoutConfig);
  }, [loadoutConfig]);

  const handleToggleFullscreenLandscape = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const target = rootRef.current || document.documentElement;
        if (target.requestFullscreen) {
          await target.requestFullscreen();
        }
        const orient = screen.orientation as ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
        };
        if (orient && typeof orient.lock === 'function') {
          await orient.lock('landscape').catch(() => {});
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback gracefully if fullscreen/orientation lock is blocked by browser/iframe policy
    }
  }, []);

  const handleEnterSimulator = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const saved = simProgressRef.current;
    let customStart: CustomDropTarget | null = null;
    if (simStartPoiId === 'saved_pos' && saved.hasSavedPosition) {
      customStart = {
        x: saved.lastX,
        z: saved.lastZ,
        label: saved.lastDistrict || 'Last Saved Position',
      };
    } else {
      const startPoi = SIMULATOR_POIS.find((p) => p.id === simStartPoiId) || SIMULATOR_POIS[0];
      if (startPoi) {
        customStart = { x: startPoi.x, z: startPoi.z, label: startPoi.name };
      }
    }
    setWorldSystem('simulator');
    setSimLobbyOpen(false);
    setShowHudEditor(false);
    setPhase('playing');
    persistSimulatorSnapshot(true, { lastPoiId: simStartPoiId });
    engine.startMatch(
      'recruit',
      'third',
      0,
      25,
      {
        mapId: 'simulator_city',
        dropSector: selectedSector,
        loadout: loadoutConfig,
        customDrop: customStart,
        worldSystem: 'simulator',
        initialTimePhase: simTimePhase,
        initialWeather: simWeather,
        autoEnvCycle: simAutoCycle,
        bikeStyle: simBikeStyle,
        initialYaw: simStartPoiId === 'saved_pos' && saved.hasSavedPosition ? saved.lastYaw : undefined,
        initialSimProgress: {
          credits: saved.credits,
          purchasedItems: saved.purchasedItems,
          stuntsCompleted: saved.stuntsCompleted,
          racesCompleted: saved.racesCompleted,
          bestLapSec: saved.bestLapSec,
          visitedDistricts: saved.visitedDistricts,
        },
      },
    );
  }, [
    simStartPoiId,
    simTimePhase,
    simWeather,
    simAutoCycle,
    simBikeStyle,
    selectedSector,
    loadoutConfig,
    persistSimulatorSnapshot,
  ]);

  const handleSetSimulatorEnv = useCallback(
    (opts: {
      timePhase?: TimeOfDayPhase;
      weather?: WeatherKind;
      autoCycle?: boolean;
      bikeStyle?: BikeStyleId;
    }) => {
      if (opts.timePhase !== undefined) {
        setSimTimePhase(opts.timePhase);
        simTimePhaseRef.current = opts.timePhase;
      }
      if (opts.weather !== undefined) {
        setSimWeather(opts.weather);
        simWeatherRef.current = opts.weather;
      }
      if (opts.autoCycle !== undefined) {
        setSimAutoCycle(opts.autoCycle);
        simAutoCycleRef.current = opts.autoCycle;
      }
      if (opts.bikeStyle !== undefined) {
        setSimBikeStyle(opts.bikeStyle);
        simBikeStyleRef.current = opts.bikeStyle;
      }
      engineRef.current?.setSimulatorEnvironment(opts);
      persistSimulatorSnapshot(true);
    },
    [persistSimulatorSnapshot],
  );

  const handleSaveHudLayout = useCallback((nextLayout: HudControlLayout) => {
    setHudSettings((prev) => ({ ...prev, controlLayout: nextLayout }));
    setShowHudEditor(false);
  }, []);

  const handleTouchMove = useCallback((x: number, y: number) => {
    engineRef.current?.setTouchMove(x, y);
  }, []);

  const handleDeploy = useCallback(() => {
    handleEnterSimulator();
  }, [handleEnterSimulator]);

  const handleToggleMute = useCallback(() => {
    soundEngine.unlock();
    setHudSettings((prev) => ({ ...prev, muted: !prev.muted }));
  }, []);

  const handlePause = useCallback(() => {
    setShowSmartCityDashboard(false);
    persistSimulatorSnapshot(true);
    engineRef.current?.pauseMatch();
    setPhase('paused');
  }, [persistSimulatorSnapshot]);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeMatch();
    setPhase('playing');
  }, []);

  const handleReturnToMenu = useCallback(() => {
    setShowSmartCityDashboard(false);
    persistSimulatorSnapshot(true);
    engineRef.current?.returnToMenu();
    setPhase('menu');
    setSimLobbyOpen(true);
  }, [persistSimulatorSnapshot]);

  // Android Hardware Back Button Navigation Handler
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => Promise<void>) | null = null;
    void CapApp.addListener('backButton', () => {
      if (showSmartCityDashboardRef.current) {
        setShowSmartCityDashboard(false);
        return;
      }
      if (showHudEditorRef.current) {
        setShowHudEditor(false);
        return;
      }
      if (phaseRef.current === 'playing') {
        handlePause();
        return;
      }
      if (phaseRef.current === 'paused') {
        handleResume();
        return;
      }
      if (!simLobbyOpenRef.current) {
        setSimLobbyOpen(true);
        return;
      }
      CapApp.exitApp().catch(() => {});
    }).then((handle) => {
      removeListener = () => handle.remove();
    });
    return () => {
      void removeListener?.();
    };
  }, [handlePause, handleResume, handleReturnToMenu]);

  const handleSwitchWeapon = useCallback((id: WeaponId) => {
    engineRef.current?.switchWeapon(id);
  }, []);

  const useLetterboxedWide = wideLandscape && isPortraitWindow && phase === 'playing';

  return (
    <div
      ref={rootRef}
      data-phase={phase}
      data-map={worldSystem === 'simulator' ? simMapId : selectedMap}
      className="relative w-full h-full overflow-hidden bg-[#06080c] flex items-center justify-center"
    >
      {/* Dedicated Landscape Stage (full-bleed on widescreen, 16:9 landscape stage on tall portrait windows) */}
      <div
        className={
          useLetterboxedWide
            ? 'relative w-full aspect-video max-h-full border-y border-white/15 bg-[#090b0f] overflow-hidden shadow-2xl'
            : 'relative w-full h-full bg-[#090b0f] overflow-hidden'
        }
      >
        <div ref={canvasMountRef} className="w-full h-full" />

        {/* Active Combat HUD locked inside the Landscape Stage */}
        {phase === 'playing' && (
          <GameHUD
            hud={hud}
            hudSettings={hudSettings}
            reticleColor={loadoutConfig.reticleColor}
            muted={hudSettings.muted}
            wideLandscape={wideLandscape}
            isFullscreen={isFullscreen}
            onUpdateHudSettings={setHudSettings}
            onCycleZoom={() => engineRef.current?.cycleZoom(1)}
            onToggleMute={handleToggleMute}
            onToggleWideLandscape={() => setWideLandscape((v) => !v)}
            onToggleFullscreen={handleToggleFullscreenLandscape}
            onTogglePerspective={() => engineRef.current?.togglePerspective()}
            onSwitchWeapon={handleSwitchWeapon}
            onCycleFireMode={() => engineRef.current?.cycleFireMode()}
            onReload={() => engineRef.current?.reload()}
            onPause={handlePause}
            onTouchMove={handleTouchMove}
            onTouchLookDelta={(dx, dy) => engineRef.current?.addLookDelta(dx, dy)}
            onTouchFire={(firing) => engineRef.current?.setTouchFire(firing)}
            onToggleAds={() => engineRef.current?.toggleAds()}
            onToggleRunMode={() => engineRef.current?.toggleRunMode()}
            onJump={() => engineRef.current?.triggerJump()}
            onToggleCrouch={() => engineRef.current?.toggleCrouch()}
            onSlide={() => engineRef.current?.triggerSlideAction()}
            onThrowGrenade={() => engineRef.current?.throwGrenade()}
            onBreach={() => engineRef.current?.triggerBreach()}
            onCyclePeek={() => engineRef.current?.cycleCoverPeek()}
            onToggleVehicle={() => engineRef.current?.toggleVehicle()}
            onCycleVehicleCamera={() => engineRef.current?.cycleVehicleCameraMode()}
            onVehicleInput={(input: Partial<VehicleInputState>) =>
              engineRef.current?.setVehicleInput(input)
            }
            onSetSimulatorEnv={handleSetSimulatorEnv}
            onInteract={() => engineRef.current?.triggerInteract()}
            onTeleportPoi={(x, z, label, yaw) => engineRef.current?.teleportToPoi(x, z, label, yaw)}
            onBuySimItem={(id) => {
              engineRef.current?.buySimulatorItem(id);
              persistSimulatorSnapshot(true);
            }}
            onUseSimItem={(id) => {
              engineRef.current?.useSimulatorItem(id);
              persistSimulatorSnapshot(true);
            }}
            onMansionCarRemote={(action) => engineRef.current?.triggerMansionCarRemote(action)}
            onMansionToggleEngine={() => engineRef.current?.toggleMansionVehicleEngine()}
            onMansionToggleDoors={() => engineRef.current?.toggleMansionVehicleDoors()}
            onMansionToggleWindow={(pane) => engineRef.current?.toggleMansionVehicleWindow(pane)}
            onMansionToggleHeadlights={() => engineRef.current?.toggleMansionVehicleHeadlights()}
            onVehicleBeepSos={() => engineRef.current?.triggerVehicleBeepSos()}
            onTapWorldCanvas={(cx, cy) => engineRef.current?.handleCanvasTap(cx, cy)}
            onOpenHudEditor={() => {
              if (typeof document !== 'undefined' && document.pointerLockElement) {
                document.exitPointerLock?.();
              }
              setShowHudEditor(true);
            }}
            showSmartCityDashboard={showSmartCityDashboard}
            onOpenSmartCityDashboard={() => {
              if (typeof document !== 'undefined' && document.pointerLockElement) {
                document.exitPointerLock?.();
              }
              setShowSmartCityDashboard((v) => !v);
            }}
          />
        )}

        {phase === 'playing' && showSmartCityDashboard && hud.smartCity && (
          <SmartCityDashboard
            smartCity={hud.smartCity}
            onCommand={(cmd) => engineRef.current?.sendSmartCityCommand(cmd)}
            onTeleportPoi={(x, z, label, yaw) => engineRef.current?.teleportToPoi(x, z, label, yaw)}
            onClose={() => setShowSmartCityDashboard(false)}
          />
        )}
      </div>

      {/* Portrait Widescreen Landscape Hint Bar when letterboxed on portrait */}
      {useLetterboxedWide && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 text-xs text-zinc-300 bg-zinc-950/90 border border-white/15 rounded-md px-3.5 py-1.5">
          <span>16:9 Landscape Combat View</span>
          <button
            type="button"
            onClick={handleToggleFullscreenLandscape}
            className="text-amber-400 font-semibold hover:text-amber-300 transition-colors"
          >
            Fullscreen Landscape
          </button>
        </div>
      )}

      {/* Context Lost Safe Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-50 bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center">
          <h2 className="font-display text-3xl font-bold text-white mb-2">
            3D Graphics Context Suspended
          </h2>
          <p className="text-sm text-zinc-300 max-w-md mb-4">
            The browser temporarily reclaimed WebGL resources. Reloading or resuming will restore the 3D arena.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-md bg-amber-500 text-zinc-950 font-semibold text-sm"
          >
            Reload Arena
          </button>
        </div>
      )}

      {/* World Simulator Pre-Launch Lobby */}
      {phase === 'menu' && simLobbyOpen && !isLoading && (
        <SimulatorLobbyScreen
          simStartPoiId={simStartPoiId}
          simTimePhase={simTimePhase}
          simWeather={simWeather}
          simAutoCycle={simAutoCycle}
          simBikeStyle={simBikeStyle}
          simProgress={simProgress}
          hudSettings={hudSettings}
          muted={hudSettings.muted}
          isFullscreen={isFullscreen}
          onSelectSimStartPoi={setSimStartPoiId}
          onSelectSimTimePhase={(tp) => {
            setSimTimePhase(tp);
            simTimePhaseRef.current = tp;
            persistSimulatorSnapshot(true, { timePhase: tp });
          }}
          onSelectSimWeather={(w) => {
            setSimWeather(w);
            simWeatherRef.current = w;
            persistSimulatorSnapshot(true, { weather: w });
          }}
          onToggleSimAutoCycle={() =>
            setSimAutoCycle((v) => {
              const next = !v;
              simAutoCycleRef.current = next;
              persistSimulatorSnapshot(true, { autoCycle: next });
              return next;
            })
          }
          onSelectSimBikeStyle={(b) => {
            setSimBikeStyle(b);
            simBikeStyleRef.current = b;
            persistSimulatorSnapshot(true, { bikeStyle: b });
          }}
          onUpdateHudSettings={setHudSettings}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreenLandscape}
          onOpenHudEditor={() => setShowHudEditor(true)}
          onDeploySimulator={handleEnterSimulator}
          signedInUserName={firebaseUser?.displayName || firebaseUser?.email || null}
          authBusy={authBusy}
          onSignInGoogle={handleSignInGoogle}
          onSignOut={handleSignOut}
        />
      )}

      {/* Touch & Drive Cam HUD Layout Editor (available in lobby or in-game) */}
      {(phase === 'menu' || phase === 'playing') && showHudEditor && (
        <HudLayoutEditor
          layout={hudSettings.controlLayout}
          onSave={handleSaveHudLayout}
          onClose={() => setShowHudEditor(false)}
        />
      )}

      {/* Pause Overlay */}
      {phase === 'paused' && (
        <div className="fixed inset-0 z-30 bg-zinc-950/85 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[#0d1117] border border-white/15 rounded-lg p-6 space-y-4">
            <div>
              <p className="text-xs text-zinc-400 mb-1">
                World Simulator · {MAP_PRESETS[simMapId].name}
              </p>
              <h2 className="font-display text-3xl font-bold text-white">
                Simulator Paused
              </h2>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleResume}
                className="w-full py-3 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display text-lg font-bold transition-colors"
              >
                Resume Exploration
              </button>
              <button
                type="button"
                onClick={handleDeploy}
                className="w-full py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white text-sm font-semibold transition-colors"
              >
                Reset World Position
              </button>
              <button
                type="button"
                onClick={handleReturnToMenu}
                className="w-full py-2.5 rounded-md bg-zinc-950 hover:bg-zinc-900 border border-white/10 text-zinc-300 text-sm transition-colors"
              >
                Exit to Simulator Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Android Startup Loading Overlay */}
      {isLoading && (
        <LoadingScreen loadProgress={loadProgress} isFadingOut={isLoaderFading} />
      )}
    </div>
  );
}
