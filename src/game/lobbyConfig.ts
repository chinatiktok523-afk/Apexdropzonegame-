import type {
  GraphicsQuality,
  HudSettings,
  LobbyLanguage,
  QualityTierOption,
  ShadowQualityOption,
} from '../types';

export type LobbyTabId = 'home' | 'world' | 'graphics' | 'settings' | 'profile';

export const LOBBY_TAB_ORDER: LobbyTabId[] = ['home', 'world', 'graphics', 'settings', 'profile'];

export const MUSIC_VOLUME_STORAGE_KEY = 'apex_dropzone_music_vol_v1';
export const MAIN_SCREEN_VIDEO_URL =
  './assets/aistudio/Grand_Theft_Auto_VI__An_Extended_Look___Now_Playing_720P_HD__3f882ce6.mp4';
export const MAIN_SCREEN_VIDEO_PLAYLIST: string[] = [
  MAIN_SCREEN_VIDEO_URL,
  './assets/aistudio/GTA_VI_vs_Watch_Dogs_2___Pistol_Shooting_Physics_Comparison__1080P_HD__54ca8cce.mp4',
  './assets/aistudio/game_video_2_deb9f1ca.mp4',
];
export const TOTAL_WORLD_ZONES = 21;

export interface ResolvedGraphicsProfile {
  preset: GraphicsQuality;
  shadowQuality: ShadowQualityOption;
  lightingQuality: QualityTierOption;
  reflectionQuality: 'off' | 'low' | 'high';
  textureQuality: QualityTierOption;
  mapQuality: QualityTierOption;
  drawDistance: number;
  bloomEnabled: boolean;
  mapSaturation: number;
  hardwareAcceleration: boolean;
}

export const SATURATION_PRESETS = [
  { id: 'natural', label: 'Natural', value: 1.0 },
  { id: 'vibrant', label: 'Vibrant', value: 1.38 },
  { id: 'vivid', label: 'Vivid', value: 1.65 },
] as const;

export const QUALITY_PRESET_CARDS: {
  id: GraphicsQuality;
  title: string;
  subtitle: string;
  defaults: Omit<ResolvedGraphicsProfile, 'preset' | 'mapSaturation' | 'hardwareAcceleration'>;
}[] = [
  {
    id: 'low',
    title: '60 FPS Smooth',
    subtitle: 'Streamlined glass & max frame stability',
    defaults: {
      shadowQuality: 'off',
      lightingQuality: 'low',
      reflectionQuality: 'off',
      textureQuality: 'low',
      mapQuality: 'low',
      drawDistance: 0.75,
      bloomEnabled: false,
    },
  },
  {
    id: 'medium',
    title: 'Balanced',
    subtitle: 'Crisp shadows, reflections & responsive frame pacing',
    defaults: {
      shadowQuality: 'medium',
      lightingQuality: 'medium',
      reflectionQuality: 'low',
      textureQuality: 'medium',
      mapQuality: 'medium',
      drawDistance: 1.0,
      bloomEnabled: false,
    },
  },
  {
    id: 'high',
    title: 'Ultra Detail',
    subtitle: 'Full PBR reflections, soft shadows, bloom & max range',
    defaults: {
      shadowQuality: 'high',
      lightingQuality: 'high',
      reflectionQuality: 'high',
      textureQuality: 'high',
      mapQuality: 'high',
      drawDistance: 1.25,
      bloomEnabled: true,
    },
  },
];

export function clampSaturation(val: number | undefined): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 1.38;
  return Math.round(Math.min(1.8, Math.max(0.8, val)) * 100) / 100;
}

export function clampDrawDistance(val: number | undefined): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 1.0;
  return Math.round(Math.min(1.4, Math.max(0.6, val)) * 100) / 100;
}

export function clampMusicVolume(val: number | undefined): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0.75;
  return Math.round(Math.min(1, Math.max(0, val)) * 100) / 100;
}

export function loadStoredMusicVolume(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0.75;
  try {
    const raw = window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
    if (!raw) return 0.75;
    return clampMusicVolume(Number(raw));
  } catch {
    return 0.75;
  }
}

export function saveStoredMusicVolume(vol: number): number {
  const clamped = clampMusicVolume(vol);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore quota errors
    }
  }
  return clamped;
}

export function buildPresetGraphicsPatch(quality: GraphicsQuality): Partial<HudSettings> {
  const card = QUALITY_PRESET_CARDS.find((c) => c.id === quality) ?? QUALITY_PRESET_CARDS[2];
  return {
    graphicsQuality: quality,
    shadowQuality: card.defaults.shadowQuality,
    lightingQuality: card.defaults.lightingQuality,
    reflectionQuality: card.defaults.reflectionQuality,
    textureQuality: card.defaults.textureQuality,
    mapQuality: card.defaults.mapQuality,
    drawDistance: card.defaults.drawDistance,
    bloomEnabled: card.defaults.bloomEnabled,
    hardwareAcceleration: true,
  };
}

export function resolveGraphicsProfile(
  settings: Partial<HudSettings>,
  isSoftwareGl = false,
): ResolvedGraphicsProfile {
  const preset: GraphicsQuality = settings.graphicsQuality ?? 'high';
  const presetDefaults =
    QUALITY_PRESET_CARDS.find((c) => c.id === preset)?.defaults ??
    QUALITY_PRESET_CARDS[2].defaults;
  const hwAccelRequested =
    typeof settings.hardwareAcceleration === 'boolean' ? settings.hardwareAcceleration : true;

  if (isSoftwareGl) {
    return {
      preset,
      shadowQuality: 'off',
      lightingQuality: 'low',
      reflectionQuality: 'off',
      textureQuality: 'low',
      mapQuality: 'low',
      drawDistance: clampDrawDistance(settings.drawDistance ?? 0.8),
      bloomEnabled: false,
      mapSaturation: clampSaturation(settings.mapSaturation),
      hardwareAcceleration: false,
    };
  }

  return {
    preset,
    shadowQuality: settings.shadowQuality ?? presetDefaults.shadowQuality,
    lightingQuality: settings.lightingQuality ?? presetDefaults.lightingQuality,
    reflectionQuality: settings.reflectionQuality ?? presetDefaults.reflectionQuality,
    textureQuality: settings.textureQuality ?? presetDefaults.textureQuality,
    mapQuality: settings.mapQuality ?? presetDefaults.mapQuality,
    drawDistance: clampDrawDistance(settings.drawDistance ?? presetDefaults.drawDistance),
    bloomEnabled:
      typeof settings.bloomEnabled === 'boolean'
        ? settings.bloomEnabled
        : presetDefaults.bloomEnabled,
    mapSaturation: clampSaturation(settings.mapSaturation),
    hardwareAcceleration: hwAccelRequested,
  };
}

export interface LobbyCopyDictionary {
  title: string;
  subtitle: string;
  tabs: Record<LobbyTabId, string>;
  zonesExplored: string;
  credits: string;
  savedWorldPos: string;
  startingDistrict: string;
  continueExploration: string;
  enterWorld: string;
  bikeView: string;
  cityFlyover: string;
  selectStartingPos: string;
  selectedStartingPos: string;
  resumeSavedSpot: string;
  graphicsTitle: string;
  settingsTitle: string;
  profileTitle: string;
  pauseTitle: string;
  resumeExploration: string;
  resetWorldPos: string;
  exitToLobby: string;
  confirmResetTitle: string;
  confirmResetBody: string;
  confirmResetAction: string;
  cancelAction: string;
}

const COPY_BY_LANG: Record<LobbyLanguage, LobbyCopyDictionary> = {
  en: {
    title: 'World Simulator Lobby',
    subtitle: 'Unified Mega-World · Twin Ocean Bridges, Metropolis, Grand Prix & Mansion',
    tabs: {
      home: 'Home',
      world: 'World Select',
      graphics: 'Graphics',
      settings: 'Settings',
      profile: 'Profile',
    },
    zonesExplored: 'Zones Explored',
    credits: 'Player Credits',
    savedWorldPos: 'Saved World Position',
    startingDistrict: 'Starting District',
    continueExploration: 'Continue Exploration',
    enterWorld: 'Enter World',
    bikeView: 'Bike View',
    cityFlyover: 'City Flyover',
    selectStartingPos: 'Select Starting Position',
    selectedStartingPos: 'Active Starting Position',
    resumeSavedSpot: 'Resume Saved Spot',
    graphicsTitle: 'Visual & Render Calibration',
    settingsTitle: 'Audio, Controls & Interface',
    profileTitle: 'Operator Dossier & Cloud Sync',
    pauseTitle: 'Simulator Paused',
    resumeExploration: 'Resume Exploration',
    resetWorldPos: 'Reset World Position',
    exitToLobby: 'Exit to Simulator Lobby',
    confirmResetTitle: 'Confirm Position Reset?',
    confirmResetBody: 'Respawns you at your selected starting district while keeping your credits & discovered zones.',
    confirmResetAction: 'Yes, Reset Position',
    cancelAction: 'Keep Current Spot',
  },
  es: {
    title: 'World Simulator Lobby',
    subtitle: 'Mega-Mundo Unificado · Puentes Oceánicos, Metrópolis, Gran Premio y Mansión',
    tabs: {
      home: 'Inicio',
      world: 'Mapa Mundial',
      graphics: 'Gráficos',
      settings: 'Ajustes',
      profile: 'Perfil',
    },
    zonesExplored: 'Zonas Exploradas',
    credits: 'Créditos',
    savedWorldPos: 'Posición Guardada',
    startingDistrict: 'Distrito Inicial',
    continueExploration: 'Continuar Exploración',
    enterWorld: 'Entrar al Mundo',
    bikeView: 'Vista Moto',
    cityFlyover: 'Vuelo Ciudad',
    selectStartingPos: 'Seleccionar Posición Inicial',
    selectedStartingPos: 'Posición Inicial Activa',
    resumeSavedSpot: 'Reanudar Último Punto',
    graphicsTitle: 'Calibración Visual y Gráficos',
    settingsTitle: 'Audio, Controles e Interfaz',
    profileTitle: 'Perfil del Jugador y Nube',
    pauseTitle: 'Simulador en Pausa',
    resumeExploration: 'Reanudar Exploración',
    resetWorldPos: 'Reiniciar Posición',
    exitToLobby: 'Salir al Lobby',
    confirmResetTitle: '¿Reiniciar posición en el mundo?',
    confirmResetBody: 'Te reubica en el distrito inicial seleccionado manteniendo créditos y zonas exploradas.',
    confirmResetAction: 'Sí, Reiniciar',
    cancelAction: 'Cancelar',
  },
  fr: {
    title: 'World Simulator Lobby',
    subtitle: 'Méga-Monde Unifié · Ponts Océaniques, Métropole, Grand Prix & Manoir',
    tabs: {
      home: 'Accueil',
      world: 'Monde',
      graphics: 'Graphismes',
      settings: 'Paramètres',
      profile: 'Profil',
    },
    zonesExplored: 'Zones Explorées',
    credits: 'Crédits',
    savedWorldPos: 'Position Sauvegardée',
    startingDistrict: 'Quartier de Départ',
    continueExploration: 'Continuer l’Exploration',
    enterWorld: 'Entrer dans le Monde',
    bikeView: 'Vue Moto',
    cityFlyover: 'Survol Ville',
    selectStartingPos: 'Choisir Position de Départ',
    selectedStartingPos: 'Point de Départ Actif',
    resumeSavedSpot: 'Reprendre Position',
    graphicsTitle: 'Rendu & Calibration Visuelle',
    settingsTitle: 'Audio, Contrôles & Interface',
    profileTitle: 'Profil Joueur & Synchronisation',
    pauseTitle: 'Simulateur en Pause',
    resumeExploration: 'Reprendre l’Exploration',
    resetWorldPos: 'Réinitialiser la Position',
    exitToLobby: 'Quitter vers le Lobby',
    confirmResetTitle: 'Confirmer la réinitialisation ?',
    confirmResetBody: 'Réapparaît au point de départ sélectionné tout en conservant crédits et zones découvertes.',
    confirmResetAction: 'Confirmer',
    cancelAction: 'Annuler',
  },
  ar: {
    title: 'World Simulator Lobby',
    subtitle: 'العالم الضخم الموحد · الجسور البحرية، المدينة، حلبة السباق والقصر',
    tabs: {
      home: 'الرئيسية',
      world: 'اختيار العالم',
      graphics: 'الرسوميات',
      settings: 'الإعدادات',
      profile: 'الملف الشخصي',
    },
    zonesExplored: 'المناطق المستكشفة',
    credits: 'الرصيد',
    savedWorldPos: 'الموقع المحفوظ',
    startingDistrict: 'منطقة البداية',
    continueExploration: 'مواصلة الاستكشاف',
    enterWorld: 'دخول العالم',
    bikeView: 'عرض الدراجة',
    cityFlyover: 'جولة المدينة',
    selectStartingPos: 'تحديد موقع البداية',
    selectedStartingPos: 'موقع البداية النشط',
    resumeSavedSpot: 'استئناف الموقع المحفوظ',
    graphicsTitle: 'إعدادات الجودة والرسوميات',
    settingsTitle: 'الصوت والتحكم والواجهة',
    profileTitle: 'ملف اللاعب والمزامنة',
    pauseTitle: 'تم إيقاف المحاكي',
    resumeExploration: 'استئناف الاستكشاف',
    resetWorldPos: 'إعادة تعيين الموقع',
    exitToLobby: 'العودة إلى اللوبي',
    confirmResetTitle: 'تأكيد إعادة تعيين الموقع؟',
    confirmResetBody: 'يعيدك إلى نقطة البداية المحددة مع الاحتفاظ برصيدك والمناطق المكتشفة.',
    confirmResetAction: 'نعم، إعادة التعيين',
    cancelAction: 'إلغاء',
  },
};

export function getLobbyCopy(lang: LobbyLanguage | undefined): LobbyCopyDictionary {
  if (lang && lang in COPY_BY_LANG) {
    return COPY_BY_LANG[lang];
  }
  return COPY_BY_LANG.en;
}
