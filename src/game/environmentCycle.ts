import * as THREE from 'three';
import type { TimeOfDayPhase, WeatherKind } from '../types';

export interface EnvironmentLightingSnapshot {
  timeNorm: number; // 0..1 (0 = midnight, 0.25 = dawn/morning, 0.5 = noon/afternoon, 0.75 = sunset, 0.92 = night)
  phase: TimeOfDayPhase;
  clockLabel: string;
  nightFactor: number; // 0 (daylight) .. 1 (full night lights/windows ON)
  sunPos: [number, number, number];
  sunColorHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  rimIntensity: number;
  skyZenithHex: number;
  skyHorizonHex: number;
  bgHex: number;
  fogHex: number;
  fogDensity: number;
  rainIntensity: number; // 0..1
  cloudOpacity: number;
  cloudTintHex: number;
  envIntensity: number;
}

const PHASE_TARGET_NORM: Record<TimeOfDayPhase, number> = {
  morning: 0.27,
  afternoon: 0.5,
  sunset: 0.74,
  night: 0.94,
};

interface TimeKeyframe {
  t: number;
  sunColor: number;
  sunInt: number;
  hemiSky: number;
  hemiGround: number;
  hemiInt: number;
  zenith: number;
  horizon: number;
  fog: number;
  fogDensity: number;
  nightFactor: number;
  envInt: number;
}

const KEYFRAMES: TimeKeyframe[] = [
  {
    t: 0.0,
    sunColor: 0x8ea8f0,
    sunInt: 0.34,
    hemiSky: 0x162244,
    hemiGround: 0x080b14,
    hemiInt: 0.36,
    zenith: 0x020307,
    horizon: 0x060a14,
    fog: 0x04070e,
    fogDensity: 0.0017,
    nightFactor: 1.0,
    envInt: 0.22,
  },
  {
    t: 0.22,
    sunColor: 0xffd194,
    sunInt: 1.38,
    hemiSky: 0xaad4f5,
    hemiGround: 0x5c4f41,
    hemiInt: 0.58,
    zenith: 0x2f6cb5,
    horizon: 0xeec099,
    fog: 0xdfb99f,
    fogDensity: 0.0014,
    nightFactor: 0.18,
    envInt: 0.38,
  },
  {
    t: 0.48,
    sunColor: 0xfff6e3,
    sunInt: 1.65,
    hemiSky: 0xdcf0ff,
    hemiGround: 0x554c3b,
    hemiInt: 0.64,
    zenith: 0x1b5eb0,
    horizon: 0x9ed0f2,
    fog: 0x9ec5e2,
    fogDensity: 0.00115,
    nightFactor: 0.0,
    envInt: 0.42,
  },
  {
    t: 0.73,
    sunColor: 0xff944d,
    sunInt: 1.42,
    hemiSky: 0xd8a8e8,
    hemiGround: 0x4d3428,
    hemiInt: 0.56,
    zenith: 0x292d59,
    horizon: 0xe58652,
    fog: 0xc27756,
    fogDensity: 0.00155,
    nightFactor: 0.48,
    envInt: 0.36,
  },
  {
    t: 0.86,
    sunColor: 0x95aef5,
    sunInt: 0.4,
    hemiSky: 0x1b2a52,
    hemiGround: 0x090d18,
    hemiInt: 0.39,
    zenith: 0x03050c,
    horizon: 0x091020,
    fog: 0x060a16,
    fogDensity: 0.00168,
    nightFactor: 0.96,
    envInt: 0.24,
  },
  {
    t: 1.0,
    sunColor: 0x8ea8f0,
    sunInt: 0.34,
    hemiSky: 0x162244,
    hemiGround: 0x080b14,
    hemiInt: 0.36,
    zenith: 0x020307,
    horizon: 0x060a14,
    fog: 0x04070e,
    fogDensity: 0.0017,
    nightFactor: 1.0,
    envInt: 0.22,
  },
];

const _cA = new THREE.Color();
const _cB = new THREE.Color();

function lerpColorHex(aHex: number, bHex: number, t: number): number {
  _cA.setHex(aHex);
  _cB.setHex(bHex);
  _cA.lerp(_cB, t);
  return _cA.getHex();
}

export function classifyTimeOfDayPhase(timeNorm: number): TimeOfDayPhase {
  const n = ((timeNorm % 1) + 1) % 1;
  if (n >= 0.18 && n < 0.36) return 'morning';
  if (n >= 0.36 && n < 0.65) return 'afternoon';
  if (n >= 0.65 && n < 0.82) return 'sunset';
  return 'night';
}

export function formatTimeNormClock(timeNorm: number): string {
  const n = ((timeNorm % 1) + 1) % 1;
  const totalMinutes = Math.floor(n * 24 * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function phaseToTimeNorm(phase: TimeOfDayPhase): number {
  return PHASE_TARGET_NORM[phase];
}

export function computeEnvironmentSnapshot(
  timeNormInput: number,
  weather: WeatherKind,
  weatherStrength = 1,
): EnvironmentLightingSnapshot {
  const timeNorm = ((timeNormInput % 1) + 1) % 1;
  let k0 = KEYFRAMES[0];
  let k1 = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (timeNorm >= KEYFRAMES[i].t && timeNorm <= KEYFRAMES[i + 1].t) {
      k0 = KEYFRAMES[i];
      k1 = KEYFRAMES[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, k1.t - k0.t);
  const localT = THREE.MathUtils.smoothstep((timeNorm - k0.t) / span, 0, 1);

  let sunColorHex = lerpColorHex(k0.sunColor, k1.sunColor, localT);
  let sunIntensity = THREE.MathUtils.lerp(k0.sunInt, k1.sunInt, localT);
  let hemiSkyHex = lerpColorHex(k0.hemiSky, k1.hemiSky, localT);
  const hemiGroundHex = lerpColorHex(k0.hemiGround, k1.hemiGround, localT);
  let hemiIntensity = THREE.MathUtils.lerp(k0.hemiInt, k1.hemiInt, localT);
  let skyZenithHex = lerpColorHex(k0.zenith, k1.zenith, localT);
  let skyHorizonHex = lerpColorHex(k0.horizon, k1.horizon, localT);
  let fogHex = lerpColorHex(k0.fog, k1.fog, localT);
  let fogDensity = THREE.MathUtils.lerp(k0.fogDensity, k1.fogDensity, localT);
  const nightFactor = THREE.MathUtils.lerp(k0.nightFactor, k1.nightFactor, localT);
  let envIntensity = THREE.MathUtils.lerp(k0.envInt, k1.envInt, localT);

  // Sun orbital arc (peaks around afternoon 0.5, dips near horizon at sunset/dawn, moon arc at night)
  const dayAngle = (timeNorm - 0.25) * Math.PI * 2;
  const sunElev = Math.sin(dayAngle);
  const activeHeight = sunElev >= -0.05 ? Math.max(18, sunElev * 86) : Math.max(24, -sunElev * 68);
  const sunX = Math.cos(dayAngle) * 76;
  const sunZ = 34;

  // Apply Weather modifiers smoothly
  const wStr = THREE.MathUtils.clamp(weatherStrength, 0, 1);
  let rainIntensity = 0;
  let cloudOpacity = THREE.MathUtils.lerp(0.66, 0.24, nightFactor);
  let cloudTintHex = nightFactor > 0.5 ? 0x22304d : 0xe4edf5;

  if (weather === 'cloudy') {
    sunIntensity *= THREE.MathUtils.lerp(1, 0.62, wStr);
    hemiIntensity *= THREE.MathUtils.lerp(1, 0.94, wStr);
    skyZenithHex = lerpColorHex(skyZenithHex, nightFactor > 0.5 ? 0x0b1220 : 0x5c728a, 0.55 * wStr);
    skyHorizonHex = lerpColorHex(skyHorizonHex, nightFactor > 0.5 ? 0x1a263b : 0x9aaec2, 0.55 * wStr);
    fogHex = lerpColorHex(fogHex, nightFactor > 0.5 ? 0x152033 : 0x8ea2b8, 0.55 * wStr);
    fogDensity += 0.0011 * wStr;
    cloudOpacity = Math.max(cloudOpacity, 0.86 * wStr);
    cloudTintHex = nightFactor > 0.5 ? 0x334155 : 0xcbd5e1;
  } else if (weather === 'foggy') {
    sunIntensity *= THREE.MathUtils.lerp(1, 0.54, wStr);
    sunColorHex = lerpColorHex(sunColorHex, 0xdbeafe, 0.35 * wStr);
    const mistCol = nightFactor > 0.5 ? 0x1c2940 : 0xcbd8e6;
    skyZenithHex = lerpColorHex(skyZenithHex, mistCol, 0.72 * wStr);
    skyHorizonHex = lerpColorHex(skyHorizonHex, mistCol, 0.85 * wStr);
    fogHex = lerpColorHex(fogHex, mistCol, 0.88 * wStr);
    fogDensity += 0.0052 * wStr;
    cloudOpacity = 0.78 * wStr;
    cloudTintHex = mistCol;
  } else if (weather === 'rainy') {
    rainIntensity = wStr;
    sunIntensity *= THREE.MathUtils.lerp(1, 0.44, wStr);
    hemiSkyHex = lerpColorHex(hemiSkyHex, 0x475569, 0.45 * wStr);
    hemiIntensity *= THREE.MathUtils.lerp(1, 0.85, wStr);
    envIntensity *= THREE.MathUtils.lerp(1, 0.74, wStr);
    const stormCol = nightFactor > 0.5 ? 0x0b1324 : 0x495b73;
    const stormHoriz = nightFactor > 0.5 ? 0x162238 : 0x6f839c;
    skyZenithHex = lerpColorHex(skyZenithHex, stormCol, 0.75 * wStr);
    skyHorizonHex = lerpColorHex(skyHorizonHex, stormHoriz, 0.75 * wStr);
    fogHex = lerpColorHex(fogHex, stormHoriz, 0.75 * wStr);
    fogDensity += 0.0029 * wStr;
    cloudOpacity = 0.92 * wStr;
    cloudTintHex = nightFactor > 0.5 ? 0x1e293b : 0x64748b;
  }

  return {
    timeNorm,
    phase: classifyTimeOfDayPhase(timeNorm),
    clockLabel: formatTimeNormClock(timeNorm),
    nightFactor,
    sunPos: [sunX, activeHeight, sunZ],
    sunColorHex,
    sunIntensity,
    hemiSkyHex,
    hemiGroundHex,
    hemiIntensity,
    rimIntensity: THREE.MathUtils.lerp(0.7, 0.48, nightFactor),
    skyZenithHex,
    skyHorizonHex,
    bgHex: skyHorizonHex,
    fogHex,
    fogDensity,
    rainIntensity,
    cloudOpacity,
    cloudTintHex,
    envIntensity,
  };
}

export const DAY_DURATION_SEC = 1800; // 30 minutes daytime (0.18..0.82)
export const NIGHT_DURATION_SEC = 720; // 12 minutes nighttime (0.82..1.0 + 0.0..0.18)
export const TOTAL_CYCLE_DURATION_SEC = DAY_DURATION_SEC + NIGHT_DURATION_SEC;

const DAY_NORM_SPAN = 0.82 - 0.18; // 0.64
const NIGHT_NORM_SPAN = 1 - DAY_NORM_SPAN; // 0.36

export class EnvironmentCycleController {
  public timeNorm = 0.34;
  public weather: WeatherKind = 'clear';
  public autoCycle = true;
  public autoWeather = false;
  public cycleDurationSec = TOTAL_CYCLE_DURATION_SEC;
  private weatherTimer = 0;

  public reset(phase: TimeOfDayPhase = 'morning', weather: WeatherKind = 'clear', autoCycle = true) {
    this.timeNorm = phaseToTimeNorm(phase);
    this.weather = weather;
    this.autoCycle = autoCycle;
    this.weatherTimer = 0;
  }

  public setPhase(phase: TimeOfDayPhase) {
    this.timeNorm = phaseToTimeNorm(phase);
  }

  public setWeather(weather: WeatherKind) {
    this.weather = weather;
    this.weatherTimer = 0;
  }

  public step(dt: number): EnvironmentLightingSnapshot {
    if (this.autoCycle && dt > 0) {
      const totalSec = Math.max(20, this.cycleDurationSec);
      const daySec = totalSec * (DAY_DURATION_SEC / TOTAL_CYCLE_DURATION_SEC);
      const nightSec = totalSec * (NIGHT_DURATION_SEC / TOTAL_CYCLE_DURATION_SEC);
      const dayRate = DAY_NORM_SPAN / daySec;
      const nightRate = NIGHT_NORM_SPAN / nightSec;

      let rem = dt;
      let t = ((this.timeNorm % 1) + 1) % 1;
      for (let guard = 0; guard < 6 && rem > 1e-7; guard++) {
        const isDay = t >= 0.18 && t < 0.82;
        if (isDay) {
          const distToBoundary = 0.82 - t;
          const timeToBoundary = distToBoundary / dayRate;
          if (rem <= timeToBoundary) {
            t += rem * dayRate;
            rem = 0;
          } else {
            t = 0.82;
            rem -= timeToBoundary;
          }
        } else {
          const distToBoundary = t >= 0.82 ? 1.0 - t + 0.18 : 0.18 - t;
          const timeToBoundary = distToBoundary / nightRate;
          if (rem <= timeToBoundary) {
            t = (t + rem * nightRate) % 1;
            rem = 0;
          } else {
            t = 0.18;
            rem -= timeToBoundary;
          }
        }
      }
      this.timeNorm = ((t % 1) + 1) % 1;
    }
    if (this.autoWeather) {
      this.weatherTimer += dt;
      if (this.weatherTimer >= 55) {
        this.weatherTimer = 0;
        const order: WeatherKind[] = ['clear', 'cloudy', 'rainy', 'foggy'];
        const idx = (order.indexOf(this.weather) + 1) % order.length;
        this.weather = order[idx];
      }
    }
    return computeEnvironmentSnapshot(this.timeNorm, this.weather, 1);
  }

  public getSnapshot(): EnvironmentLightingSnapshot {
    return computeEnvironmentSnapshot(this.timeNorm, this.weather, 1);
  }
}
