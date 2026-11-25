# Apex Dropzone: World Simulator — Offline Android Build & Play Guide

## Delivered Files in Workspace
- **`World_Simulator_Offline.apk`** — Signed Release APK ready for direct installation on Android phones (Android 7.0+ / SDK 24+, target SDK 34+).
- **`World_Simulator_Offline_Debug.apk`** — Debug APK build for ADB/USB developer testing.
- **`android/`** — Complete Capacitor + Gradle Android native project (`com.apexdropzone.worldsimulator`).
- **`capacitor.config.ts`** — Capacitor runtime configuration (`androidScheme: https`, immersive fullscreen SplashScreen & StatusBar).
- **`src/game/offlineStorage.ts`** — Dual-layer `localStorage` + `IndexedDB` (`ApexDropzoneOfflineDB`) offline persistence manager preserving Battle Career stats, HUD layout/settings, Loadouts, Profile, and World Simulator exploration progress across app restarts.

---

## Offline Architecture Highlights
1. **Zero Gemini / Zero Cloud API Dependencies**:
   - `@google/genai` and external Google Fonts CDN calls were completely removed.
   - All game audio (23 weapon/ambience/helicopter/horn/footstep MP3s + 2 soundtrack MP3s), artwork, 3D geometry (`VoxelBuilder` micro-blocks), terrain, traffic, and AI bots run 100% locally inside the APK bundle.
2. **Offline vs Online Modes**:
   - **World Simulator Mode (`simulator_city`)**: 100% offline (21 interconnected districts across East & West Empires, Hotel Dining, Elevator Mall, Royal Castle & Cavalry Guards, Chinatown, Spaceport Rocket Launch, F1 Grand Prix, Biodomes, Day/Night & Weather cycles).
   - **Battle Mode Singleplayer (Extraction, Dropzone Royale, Neon Strike Beat)**: 100% offline with local AI squads, drivable vehicles, and helicopters across all 6 tactical maps.
   - **Battle Mode Multiplayer (Co-op vs Bots / PvP Arena)**: Explicitly checks internet connectivity (`navigator.onLine`) and requires an active internet connection + live Apex Dropzone WebSocket server URL (configurable directly inside the Multiplayer tab on Android APK).

---

## Rebuilding the APK Locally
Prerequisites: **Node.js 20+**, **OpenJDK 17**, and **Android SDK (Platform 34 / Build-Tools 34.0.0)**.

```bash
# 1. Build web bundle and sync assets into android/app/src/main/assets/public
npm run cap:sync

# 2. Build both Debug & Signed Release APKs
cd android
./gradlew assembleDebug assembleRelease

# Output paths:
# - android/app/build/outputs/apk/debug/app-debug.apk
# - android/app/build/outputs/apk/release/app-release.apk
```

To install directly onto an Android phone connected via USB (`ADB`):
```bash
adb install -r World_Simulator_Offline.apk
```
