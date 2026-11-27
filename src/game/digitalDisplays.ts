import * as THREE from 'three';
import type { GraphicsQuality } from '../types';
import {
  computeRotatedVideoDraw,
  computeScreenAudioGain,
  computeVideoCoverCrop,
  getVideoRotationForUrl,
  stepPlaylistIndex,
  type VideoRotationDeg,
} from './mansionSystems';
import {
  computeTrafficSignalState,
  getBillboardSlideForTime,
} from './simulatorSystems';

export type DigitalDisplayKind =
  | 'stadium_scoreboard'
  | 'railway_timetable'
  | 'city_billboard'
  | 'shopping_mall'
  | 'traffic_gantry'
  | 'bike_dash'
  | 'car_cockpit'
  | 'car_second_lcd'
  | 'mini_monitor'
  | 'mansion_dj_eq'
  | 'gaming_action'
  | 'neon_city_wall'
  | 'smart_farm_telemetry'
  | 'smart_city_dome_banner'
  | 'smart_city_charts';

export interface AnimatedDisplayEntry {
  kind: DigitalDisplayKind;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material?: THREE.MeshBasicMaterial;
  title: string;
  subtitle?: string;
  accentHex?: string;
  lockTitle?: boolean;
  phaseOffset: number;
  lastDrawTime: number;
  intervalSec: number;
  liveValue?: number; // e.g., speed km/h on bike dash or score
  hpValue?: number;
  maxHpValue?: number;
  damageHits: number;
  repairTimer: number;
  cracks: Array<{ u: number; v: number; seed: number }>;
  video?: HTMLVideoElement | null;
  videoFailed?: boolean;
  playlist?: string[];
  playlistIndex?: number;
  videoRotations?: Record<string, VideoRotationDeg>;
  worldPos?: { x: number; y: number; z: number };
  audioMode?: 'none' | 'world' | 'vehicle_lcd';
  vehicleId?: string;
  maxAudioVolume?: number;
  audioRangeMeters?: number;
  audioUnlocked?: boolean;
  disabled?: boolean;
}

interface SharedVideoStream {
  key: string;
  video: HTMLVideoElement;
  playlist: string[];
  playlistIndex: number;
  failed: boolean;
  errorTries: number;
  lastPlayAttemptSec: number;
  playPromisePending: boolean;
  unmuteBlocked: boolean;
  subscribers: AnimatedDisplayEntry[];
}

/**
 * Pure formatters for digital displays (also unit-tested without Canvas DOM).
 */
export function formatDisplayClock(elapsedSec: number): string {
  const sec = Math.max(0, Math.floor(elapsedSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getTrainBoardEntries(elapsedSec: number): Array<{
  platform: string;
  route: string;
  etaMin: number;
  status: 'BOARDING' | 'ON TIME' | 'ARRIVING';
}> {
  const cycle = Math.floor(elapsedSec / 6);
  const routes = [
    ['P1', 'METRO CENTRAL EXP', 1 + ((cycle + 2) % 4)],
    ['P2', 'SEINE GRAND LINE', 2 + ((cycle + 1) % 5)],
    ['P3', 'PARADISE ALPINE', 4 + (cycle % 6)],
    ['P4', 'APEX HARBOR FREIGHT', 6 + ((cycle + 3) % 7)],
  ] as const;
  return routes.map(([platform, route, etaMin], idx) => ({
    platform,
    route,
    etaMin,
    status: idx === cycle % 4 ? 'BOARDING' : etaMin <= 2 ? 'ARRIVING' : 'ON TIME',
  }));
}

/**
 * Manages live animated CanvasTexture digital screens across stadiums,
 * train stations, shopping centres, city billboards, road gantries, and the Digital Bike.
 */
export class DigitalDisplayManager {
  public readonly entries: AnimatedDisplayEntry[] = [];
  private materialToEntry = new Map<THREE.Material, AnimatedDisplayEntry>();
  private sharedVideos = new Map<string, SharedVideoStream>();
  private videoPoolContainer: HTMLDivElement | null = null;
  private globalAudioUnlocked = false;
  private prevUpdateSec = 0;
  private disposed = false;

  public createDisplayMaterial(
    kind: DigitalDisplayKind,
    opts?: {
      title?: string;
      subtitle?: string;
      accentHex?: string;
      lockTitle?: boolean;
      width?: number;
      height?: number;
      intervalSec?: number;
      phaseOffset?: number;
      worldPos?: { x: number; y: number; z: number };
      vehicleId?: string;
    },
  ): {
    material: THREE.MeshBasicMaterial;
    entry: AnimatedDisplayEntry;
  } {
    const w = opts?.width ?? (kind === 'bike_dash' || kind === 'mini_monitor' ? 256 : 512);
    const h =
      opts?.height ??
      (kind === 'traffic_gantry' || kind === 'bike_dash' || kind === 'car_cockpit' ? 128 : kind === 'mini_monitor' ? 160 : 256);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const entry: AnimatedDisplayEntry = {
      kind,
      canvas,
      ctx,
      texture,
      title: opts?.title ?? 'APEX LIVE',
      subtitle: opts?.subtitle,
      accentHex: opts?.accentHex ?? '#38bdf8',
      lockTitle: opts?.lockTitle ?? false,
      phaseOffset: opts?.phaseOffset ?? this.entries.length * 1.37,
      lastDrawTime: -999,
      intervalSec: opts?.intervalSec ?? (kind === 'bike_dash' || kind === 'car_cockpit' ? 0.14 : kind === 'mansion_dj_eq' ? 0.1 : 0.65),
      liveValue: 0,
      hpValue: 100,
      maxHpValue: 100,
      damageHits: 0,
      repairTimer: 0,
      cracks: [],
      video: null,
      videoFailed: false,
      worldPos: opts?.worldPos,
      vehicleId: opts?.vehicleId,
    };

    this.drawEntry(entry, 0);

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    });
    entry.material = material;
    this.entries.push(entry);
    this.materialToEntry.set(material, entry);

    return { material, entry };
  }

  private getOrCreateVideoPoolContainer(): HTMLDivElement | null {
    if (typeof document === 'undefined' || !document.body) return null;
    if (!this.videoPoolContainer) {
      const div = document.createElement('div');
      div.setAttribute('data-apex-video-pool', '1');
      div.style.cssText =
        'position:fixed;left:-9999px;top:-9999px;width:4px;height:4px;opacity:0.001;pointer-events:none;overflow:hidden;';
      document.body.appendChild(div);
      this.videoPoolContainer = div;
    }
    return this.videoPoolContainer;
  }

  private tryPlayStream(stream: SharedVideoStream): void {
    if (this.disposed || stream.failed || stream.playPromisePending) return;
    const vid = stream.video;
    try {
      const p = vid.play();
      if (p && typeof p.then === 'function') {
        stream.playPromisePending = true;
        p.then(() => {
          stream.playPromisePending = false;
        }).catch(() => {
          stream.playPromisePending = false;
          if (!vid.muted) {
            vid.muted = true;
            vid.volume = 0;
            stream.unmuteBlocked = true;
            try {
              const p2 = vid.play();
              if (p2 && typeof p2.catch === 'function') {
                p2.catch(() => {});
              }
            } catch {
              // ignore
            }
          }
        });
      }
    } catch {
      stream.playPromisePending = false;
      // ignore synchronous play rejection
    }
  }

  public createVideoDisplayMaterial(
    videoSrcOrPlaylist: string | string[],
    fallbackKind: DigitalDisplayKind = 'gaming_action',
    opts?: {
      title?: string;
      subtitle?: string;
      accentHex?: string;
      width?: number;
      height?: number;
      intervalSec?: number;
      videoRotations?: Record<string, VideoRotationDeg>;
      worldPos?: { x: number; y: number; z: number };
      audioMode?: 'none' | 'world' | 'vehicle_lcd';
      vehicleId?: string;
      maxAudioVolume?: number;
      audioRangeMeters?: number;
    },
  ): {
    material: THREE.MeshBasicMaterial;
    entry: AnimatedDisplayEntry;
  } {
    const playlist = Array.isArray(videoSrcOrPlaylist)
      ? videoSrcOrPlaylist.filter(Boolean)
      : [videoSrcOrPlaylist].filter(Boolean);
    const res = this.createDisplayMaterial(fallbackKind, {
      ...opts,
      lockTitle: true,
      intervalSec: opts?.intervalSec ?? 0.066,
    });
    res.entry.playlist = playlist;
    res.entry.playlistIndex = 0;
    res.entry.videoRotations = opts?.videoRotations;
    res.entry.worldPos = opts?.worldPos;
    res.entry.audioMode = opts?.audioMode ?? 'none';
    res.entry.vehicleId = opts?.vehicleId;
    res.entry.maxAudioVolume = opts?.maxAudioVolume ?? 0.12;
    res.entry.audioRangeMeters = opts?.audioRangeMeters ?? 22;
    res.entry.audioUnlocked = this.globalAudioUnlocked;

    if (typeof document === 'undefined' || playlist.length === 0) return res;
    try {
      const poolKey = playlist.join('|');
      let stream = this.sharedVideos.get(poolKey);
      if (stream) {
        stream.subscribers.push(res.entry);
        res.entry.video = stream.video;
        res.entry.playlistIndex = stream.playlistIndex;
        res.entry.videoFailed = stream.failed;
        if (!stream.failed && stream.video.readyState >= 2 && stream.video.videoWidth > 0) {
          this.drawEntry(res.entry, res.entry.phaseOffset);
          res.entry.texture.needsUpdate = true;
        }
        return res;
      }

      const video = document.createElement('video');
      if (!video || typeof video.play !== 'function') return res;
      const firstSrc = playlist[0];
      video.src = firstSrc;
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.loop = playlist.length <= 1;
      video.playsInline = true;
      video.autoplay = true;
      video.preload = 'auto';
      if (/^https?:\/\//i.test(firstSrc)) {
        video.crossOrigin = 'anonymous';
      }
      video.setAttribute?.('playsinline', '');
      video.setAttribute?.('webkit-playsinline', '');
      video.setAttribute?.('autoplay', '');
      video.setAttribute?.('muted', '');

      const poolContainer = this.getOrCreateVideoPoolContainer();
      if (poolContainer) {
        poolContainer.appendChild(video);
      }

      const newStream: SharedVideoStream = {
        key: poolKey,
        video,
        playlist,
        playlistIndex: 0,
        failed: false,
        errorTries: 0,
        lastPlayAttemptSec: -10,
        playPromisePending: false,
        unmuteBlocked: false,
        subscribers: [res.entry],
      };
      this.sharedVideos.set(poolKey, newStream);
      res.entry.video = video;

      const syncSubscribersState = () => {
        for (let si = 0; si < newStream.subscribers.length; si++) {
          const sub = newStream.subscribers[si];
          sub.playlistIndex = newStream.playlistIndex;
          sub.videoFailed = newStream.failed;
        }
      };

      const paintSubscribers = () => {
        if (this.disposed || newStream.failed) return;
        this.tryPlayStream(newStream);
        if (video.readyState >= 2 && video.videoWidth > 0) {
          syncSubscribersState();
          for (let si = 0; si < newStream.subscribers.length; si++) {
            const sub = newStream.subscribers[si];
            this.drawEntry(sub, sub.phaseOffset);
            sub.texture.needsUpdate = true;
          }
        }
      };

      video.addEventListener?.('error', () => {
        const len = newStream.playlist.length;
        if (len > 1 && newStream.errorTries < len - 1) {
          newStream.errorTries++;
          newStream.playlistIndex = stepPlaylistIndex(newStream.playlistIndex, len);
          syncSubscribersState();
          video.src = newStream.playlist[newStream.playlistIndex];
          video.load();
          this.tryPlayStream(newStream);
        } else {
          newStream.failed = true;
          syncSubscribersState();
        }
      });

      video.addEventListener?.('ended', () => {
        if (this.disposed) return;
        if (newStream.playlist.length > 1) {
          newStream.playlistIndex = stepPlaylistIndex(newStream.playlistIndex, newStream.playlist.length);
          syncSubscribersState();
          video.src = newStream.playlist[newStream.playlistIndex];
          video.load();
          this.tryPlayStream(newStream);
        } else {
          video.currentTime = 0;
          this.tryPlayStream(newStream);
        }
      });

      video.addEventListener?.('loadedmetadata', () => {
        this.tryPlayStream(newStream);
      });
      video.addEventListener?.('loadeddata', paintSubscribers);
      video.addEventListener?.('canplay', paintSubscribers);
      video.addEventListener?.('canplaythrough', paintSubscribers);
      video.addEventListener?.('playing', paintSubscribers);
      this.tryPlayStream(newStream);

      if (typeof window !== 'undefined') {
        const resumeOnce = () => {
          this.globalAudioUnlocked = true;
          for (let si = 0; si < newStream.subscribers.length; si++) {
            newStream.subscribers[si].audioUnlocked = true;
          }
          if (!newStream.failed && newStream.video.paused) {
            this.tryPlayStream(newStream);
          }
          window.removeEventListener('pointerdown', resumeOnce);
          window.removeEventListener('keydown', resumeOnce);
        };
        window.addEventListener('pointerdown', resumeOnce, { passive: true });
        window.addEventListener('keydown', resumeOnce, { passive: true });
      }
    } catch {
      // Fall back silently to Canvas2D rendering
    }
    return res;
  }

  public updateSpatialAudio(
    listenerPos: { x: number; y: number; z: number },
    activeVehicleId: string | null,
    globalMuted: boolean,
  ): void {
    if (this.disposed) return;
    const streamByVideo = new Map<HTMLVideoElement, SharedVideoStream>();
    this.sharedVideos.forEach((s) => streamByVideo.set(s.video, s));
    const perVideo = new Map<HTMLVideoElement, { maxGain: number; anyUnlocked: boolean }>();

    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const vid = e.video;
      if (!vid) continue;
      const unlocked = Boolean(e.audioUnlocked || this.globalAudioUnlocked);
      const destroyed = e.damageHits >= 3 || Boolean(e.disabled);
      let gain = 0;

      if (!destroyed && !globalMuted && e.audioMode && e.audioMode !== 'none') {
        if (e.audioMode === 'vehicle_lcd') {
          if (activeVehicleId && e.vehicleId === activeVehicleId) {
            gain = e.maxAudioVolume ?? 0.12;
          }
        } else if (e.audioMode === 'world' && e.worldPos) {
          const dx = listenerPos.x - e.worldPos.x;
          const dy = (listenerPos.y - e.worldPos.y) * 1.6;
          const dz = listenerPos.z - e.worldPos.z;
          const dist = Math.hypot(dx, dy, dz);
          gain = computeScreenAudioGain(
            dist,
            e.audioRangeMeters ?? 22,
            e.maxAudioVolume ?? 0.14,
            globalMuted,
          );
        }
      }

      const prev = perVideo.get(vid);
      if (!prev) {
        perVideo.set(vid, { maxGain: gain, anyUnlocked: unlocked });
      } else {
        if (gain > prev.maxGain) prev.maxGain = gain;
        if (unlocked) prev.anyUnlocked = true;
      }
    }

    perVideo.forEach(({ maxGain, anyUnlocked }, vid) => {
      const stream = streamByVideo.get(vid);
      const clampedGain = Math.max(0, Math.min(0.28, maxGain));
      if (clampedGain <= 0.002 || !anyUnlocked || stream?.unmuteBlocked) {
        if (!vid.muted) vid.muted = true;
        if (vid.volume !== 0) vid.volume = 0;
      } else {
        if (vid.muted) vid.muted = false;
        if (Math.abs(vid.volume - clampedGain) > 0.008) {
          vid.volume = clampedGain;
        }
        if (vid.paused && stream && !stream.playPromisePending) {
          this.tryPlayStream(stream);
        } else if (vid.paused && !stream) {
          vid.play().catch(() => {
            vid.muted = true;
            vid.volume = 0;
            vid.play().catch(() => {});
          });
        }
      }
    });
  }

  public getEntryByMaterial(mat: THREE.Material | THREE.Material[] | null | undefined): AnimatedDisplayEntry | null {
    if (!mat || Array.isArray(mat)) return null;
    return this.materialToEntry.get(mat) ?? null;
  }

  public collectShootableMeshes(root: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh && !Array.isArray(obj.material)) {
        const entry = this.materialToEntry.get(obj.material);
        if (entry) {
          obj.userData.isDigitalScreen = true;
          out.push(obj);
        }
      }
    });
    return out;
  }

  public hitDisplayEntry(
    entry: AnimatedDisplayEntry,
    uvX = 0.5,
    uvY = 0.5,
    damage = 25,
    elapsedSec = 0,
  ): 'cracked' | 'shattered' {
    const step = damage >= 75 ? 2 : 1;
    entry.damageHits = Math.min(4, entry.damageHits + step);
    entry.repairTimer = 5.0;
    if (entry.cracks.length < 6) {
      entry.cracks.push({
        u: THREE.MathUtils.clamp(uvX, 0.08, 0.92),
        v: THREE.MathUtils.clamp(1 - uvY, 0.08, 0.92),
        seed: (entry.cracks.length + 1) * 1.73 + uvX * 9.1,
      });
    }
    entry.lastDrawTime = elapsedSec;
    this.drawEntry(entry, elapsedSec + entry.phaseOffset);
    entry.texture.needsUpdate = true;
    return entry.damageHits >= 3 ? 'shattered' : 'cracked';
  }

  private isEntryWithinUpdateRange(
    e: AnimatedDisplayEntry,
    cameraPos?: { x: number; y: number; z: number } | null,
    activeVehicleId?: string | null,
    quality: GraphicsQuality = 'high',
  ): boolean {
    if (e.disabled) return false;
    if (e.vehicleId) {
      if (activeVehicleId && e.vehicleId === activeVehicleId) return true;
      if (!cameraPos) return true;
      if (e.worldPos) {
        const dx = e.worldPos.x - cameraPos.x;
        const dz = e.worldPos.z - cameraPos.z;
        const vehRange = quality === 'low' ? 20 : quality === 'medium' ? 32 : 75;
        return dx * dx + dz * dz <= vehRange * vehRange;
      }
      return false;
    }
    if (!cameraPos || !e.worldPos) return true;
    const dx = e.worldPos.x - cameraPos.x;
    const dy = e.worldPos.y - cameraPos.y;
    const dz = e.worldPos.z - cameraPos.z;
    const maxDist = e.video
      ? quality === 'low'
        ? 28
        : quality === 'medium'
          ? 48
          : 260
      : e.kind === 'stadium_scoreboard'
        ? quality === 'low'
          ? 85
          : quality === 'medium'
            ? 125
            : 240
        : quality === 'low'
          ? 55
          : quality === 'medium'
            ? 85
            : 190;
    return dx * dx + dy * dy + dz * dz <= maxDist * maxDist;
  }

  public update(
    elapsedSec: number,
    dt?: number,
    cameraPos?: { x: number; y: number; z: number } | null,
    activeVehicleId?: string | null,
    perfScale = 1,
    quality: GraphicsQuality = 'high',
  ): void {
    if (this.disposed) return;
    const stepDt = dt !== undefined ? dt : Math.min(0.2, Math.max(0, elapsedSec - this.prevUpdateSec));
    this.prevUpdateSec = elapsedSec;
    const clampedScale = Math.max(1, Math.min(4, perfScale));
    const keepAliveDist = quality === 'low' ? 30 : quality === 'medium' ? 60 : 360;
    const keepAliveDistSq = keepAliveDist * keepAliveDist;

    this.sharedVideos.forEach((stream) => {
      if (stream.failed) return;
      const vid = stream.video;
      let anySubActive = !cameraPos;
      if (!anySubActive) {
        for (let si = 0; si < stream.subscribers.length; si++) {
          const sub = stream.subscribers[si];
          if (this.isEntryWithinUpdateRange(sub, cameraPos, activeVehicleId, quality)) {
            anySubActive = true;
            break;
          }
        }
      }
      if (!anySubActive) {
        // Pause when ALL subscribers are beyond keep-alive distance or disabled
        let anyNearKeepAlive = false;
        if (cameraPos) {
          for (let si = 0; si < stream.subscribers.length; si++) {
            const sub = stream.subscribers[si];
            if (sub.disabled) continue;
            if (!sub.worldPos) {
              anyNearKeepAlive = true;
              break;
            }
            const dx = sub.worldPos.x - cameraPos.x;
            const dz = sub.worldPos.z - cameraPos.z;
            if (dx * dx + dz * dz <= keepAliveDistSq) {
              anyNearKeepAlive = true;
              break;
            }
          }
        }
        if (!anyNearKeepAlive && !vid.paused) {
          try {
            vid.pause();
          } catch {
            // ignore
          }
        } else if (anyNearKeepAlive && !vid.muted) {
          vid.muted = true;
          vid.volume = 0;
        }
        return;
      }

      if (vid.ended) {
        if (stream.playlist.length > 1) {
          stream.playlistIndex = stepPlaylistIndex(stream.playlistIndex, stream.playlist.length);
          for (let si = 0; si < stream.subscribers.length; si++) {
            stream.subscribers[si].playlistIndex = stream.playlistIndex;
          }
          vid.src = stream.playlist[stream.playlistIndex];
          vid.load?.();
        } else {
          vid.currentTime = 0;
        }
        this.tryPlayStream(stream);
      } else if (vid.paused && elapsedSec - stream.lastPlayAttemptSec >= 0.35) {
        stream.lastPlayAttemptSec = elapsedSec;
        if (!vid.muted && stream.unmuteBlocked) {
          vid.muted = true;
          vid.volume = 0;
        }
        this.tryPlayStream(stream);
      }
    });

    const nonVideoScale =
      quality === 'low' ? Math.max(3.2, clampedScale) : quality === 'medium' ? Math.max(2.0, clampedScale) : clampedScale;

    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (e.damageHits > 0) {
        e.repairTimer -= stepDt;
        if (e.repairTimer <= 0) {
          e.damageHits = 0;
          e.repairTimer = 0;
          e.cracks.length = 0;
          e.lastDrawTime = -999;
        }
      }
      if (!this.isEntryWithinUpdateRange(e, cameraPos, activeVehicleId, quality)) {
        continue;
      }
      const baseInterval = e.damageHits === 1 || e.damageHits === 2 ? Math.min(e.intervalSec, 0.09) : e.intervalSec;
      const effectiveInterval = e.video
        ? quality === 'low'
          ? Math.max(0.16, baseInterval * 2.4)
          : quality === 'medium'
            ? Math.max(0.1, baseInterval * 1.5)
            : Math.min(0.045, baseInterval * Math.min(1.35, clampedScale))
        : baseInterval * nonVideoScale;
      if (elapsedSec - e.lastDrawTime >= effectiveInterval) {
        e.lastDrawTime = elapsedSec;
        this.drawEntry(e, elapsedSec + e.phaseOffset);
        e.texture.needsUpdate = true;
      }
    }
  }

  private drawEntry(entry: AnimatedDisplayEntry, t: number): void {
    const { ctx, canvas, kind, title, subtitle, accentHex } = entry;
    const w = canvas.width;
    const h = canvas.height;
    ctx.save();

    // Draw decoded looping MP4 video frame directly onto the monitor canvas with aspect cover crop (no trimming/stretching)
    const vid = entry.video;
    if (vid && !entry.videoFailed && vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
      try {
        const activeSrc = entry.playlist?.[entry.playlistIndex ?? 0] ?? vid.currentSrc ?? vid.src;
        const rotateDeg = getVideoRotationForUrl(activeSrc, entry.videoRotations);
        if (rotateDeg !== 0) {
          const rot = computeRotatedVideoDraw(vid.videoWidth, vid.videoHeight, w, h, rotateDeg);
          ctx.save();
          ctx.translate(w * 0.5, h * 0.5);
          ctx.rotate(rot.rad);
          ctx.drawImage(vid, -rot.drawW * 0.5, -rot.drawH * 0.5, rot.drawW, rot.drawH);
          ctx.restore();
        } else {
          const crop = computeVideoCoverCrop(vid.videoWidth, vid.videoHeight, w, h);
          ctx.drawImage(vid, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
        }
        if (entry.damageHits > 0) {
          this.drawCrackAndGlitchOverlay(entry, t);
        }
        ctx.restore();
        return;
      } catch {
        // Fall through to Canvas2D dynamic render
      }
    }

    if (kind === 'stadium_scoreboard') {
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, w, h);
      // Glowing stadium header bar
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#0ea5e9');
      grad.addColorStop(0.5, '#6366f1');
      grad.addColorStop(1, '#f97316');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 34);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(title || 'APEX STADIUM ARENA // LIVE', w * 0.5, 24);

      const apexScore = 2 + (Math.floor(t / 18) % 5);
      const novaScore = 1 + (Math.floor(t / 23) % 4);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(24, 52, w * 0.34, 118);
      ctx.fillRect(w - 24 - w * 0.34, 52, w * 0.34, 118);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 52, w * 0.34, 118);
      ctx.strokeStyle = '#fb923c';
      ctx.strokeRect(w - 24 - w * 0.34, 52, w * 0.34, 118);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('APEX', 24 + w * 0.17, 84);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 62px monospace';
      ctx.fillText(String(apexScore), 24 + w * 0.17, 148);

      ctx.fillStyle = '#fb923c';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('NOVA', w - 24 - w * 0.17, 84);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 62px monospace';
      ctx.fillText(String(novaScore), w - 24 - w * 0.17, 148);

      // Center live clock + equalizer bars
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 34px monospace';
      ctx.fillText(formatDisplayClock(t * 2), w * 0.5, 108);
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(Math.sin(t * 5) > 0 ? '● LIVE HD FEED' : '  LIVE HD FEED', w * 0.5, 136);

      // Crowd energy waveform bars along bottom
      for (let b = 0; b < 24; b++) {
        const bh = 10 + Math.abs(Math.sin(t * 4.5 + b * 0.6)) * 28;
        ctx.fillStyle = b % 2 === 0 ? '#38bdf8' : '#facc15';
        ctx.fillRect(28 + b * 19, h - 16 - bh, 12, bh);
      }
    } else if (kind === 'railway_timetable') {
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, 40);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 21px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(title || 'CENTRAL RAIL DEPARTURES', 16, 27);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(formatDisplayClock(t + 600), w - 16, 27);

      const rows = getTrainBoardEntries(t);
      rows.forEach((row, idx) => {
        const ry = 54 + idx * 42;
        ctx.fillStyle = idx % 2 === 0 ? '#0c1322' : '#111a2e';
        ctx.fillRect(10, ry, w - 20, 36);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(row.platform, 20, ry + 24);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 17px monospace';
        ctx.fillText(row.route, 66, ry + 24);

        ctx.textAlign = 'right';
        ctx.fillStyle =
          row.status === 'BOARDING'
            ? Math.sin(t * 6) > 0
              ? '#4ade80'
              : '#bbf7d0'
            : row.status === 'ARRIVING'
              ? '#facc15'
              : '#94a3b8';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`${row.status} ${row.etaMin}m`, w - 20, ry + 24);
      });

      // Scrolling ticker bottom
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 14px monospace';
      const offset = (t * 95) % (w + 340);
      ctx.textAlign = 'left';
      ctx.fillText('NEXT EXPRESS TRAIN APPROACHING — STAND CLEAR OF PLATFORM EDGE', w - offset, h - 10);
    } else if (kind === 'city_billboard') {
      const slide = !entry.lockTitle ? getBillboardSlideForTime(t, entry.phaseOffset) : null;
      const activeAccent = slide ? slide.accent : accentHex || '#f59e0b';
      const headline = slide ? slide.headline : title;
      const subline = slide ? slide.subline : subtitle || 'ULTRA HDR DISTRICT · OPEN 24H';

      const pulse = 0.5 + 0.5 * Math.sin(t * 2.8);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, activeAccent);
      grad.addColorStop(0.5, slide?.kind === 'credit' ? '#0284c7' : '#ec4899');
      grad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const isWideFascia = h <= 150;
      const pad = isWideFascia ? 6 : 14;
      ctx.fillStyle = 'rgba(8, 12, 24, 0.88)';
      ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);

      if (!isWideFascia) {
        ctx.fillStyle = activeAccent;
        const scanX = ((t * 120) % (w - 40)) + 20;
        ctx.fillRect(scanX, 18, 32, 6);
        ctx.fillRect(w - scanX - 32, h - 24, 32, 6);
      }

      ctx.strokeStyle = pulse > 0.5 ? activeAccent : '#38bdf8';
      ctx.lineWidth = isWideFascia ? 3 : 6;
      const inset = isWideFascia ? 8 : 18;
      ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

      ctx.textAlign = 'center';
      if (isWideFascia) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText(headline, w * 0.5, h * 0.52);
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 17px monospace';
        ctx.fillText(subline, w * 0.5, h * 0.82);
      } else if (slide?.kind === 'credit') {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 17px monospace';
        ctx.fillText('★ CREATOR STUDIO EDITION ★', w * 0.5, h * 0.28);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(headline, w * 0.5, h * 0.52);
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 19px monospace';
        ctx.fillText(subline, w * 0.5, h * 0.74);
      } else {
        ctx.fillStyle = '#fef08a';
        ctx.font = headline.length > 22 ? 'bold 30px sans-serif' : 'bold 38px sans-serif';
        ctx.fillText(headline, w * 0.5, h * 0.46);
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(subline, w * 0.5, h * 0.72);
      }

      if (!isWideFascia) {
        for (let i = 0; i < 12; i++) {
          const active = Math.floor(t * 6 + i) % 3 === 0;
          ctx.fillStyle = active ? '#4ade80' : '#1e293b';
          ctx.fillRect(36 + i * 37, h - 40, 24, 9);
        }
      }
    } else if (kind === 'shopping_mall') {
      const slide = getBillboardSlideForTime(t, entry.phaseOffset);
      ctx.fillStyle = '#070b16';
      ctx.fillRect(0, 0, w, h);

      if (slide.kind === 'credit') {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(0, 0, w, 46);
        ctx.fillStyle = '#090d1a';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DEVELOPED BY AFTAB BALOCH DADU', w * 0.5, 31);
      } else {
        ctx.fillStyle = slide.kind === 'watch_sale' ? '#0284c7' : '#ec4899';
        ctx.fillRect(0, 0, w, 46);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title || 'GRAND ATRIUM MALL · LIFTS OPEN', w * 0.5, 32);
      }

      const cards = [
        { label: 'CLOTHES', discount: '50% OFF', col: '#ec4899', floor: 'FLOOR 1F' },
        { label: 'WATCHES', discount: '35% OFF', col: '#38bdf8', floor: 'LUXURY 1F' },
        { label: 'FOOD & SKI', discount: '20% OFF', col: '#f59e0b', floor: 'LIFT 2F-3F' },
      ];
      cards.forEach((c, i) => {
        const cx = 20 + i * 162;
        ctx.fillStyle = '#111827';
        ctx.fillRect(cx, 62, 148, 148);
        ctx.strokeStyle = c.col;
        ctx.lineWidth = 3;
        ctx.strokeRect(cx, 62, 148, 148);
        ctx.fillStyle = c.col;
        ctx.fillRect(cx + 12, 74, 124, 28);
        ctx.fillStyle = '#090d1a';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(c.discount, cx + 74, 94);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 21px sans-serif';
        ctx.fillText(c.label, cx + 74, 142);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(c.floor, cx + 74, 182);
      });

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('DEVELOPED BY AFTAB BALOCH DADU  ·  ELEVATORS ACTIVE', w * 0.5, h - 14);
    } else if (kind === 'traffic_gantry') {
      const sig = computeTrafficSignalState(t);
      ctx.fillStyle = '#05080f';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      const nsHex = sig.ns === 'GREEN' ? '#22c55e' : sig.ns === 'YELLOW' ? '#facc15' : '#ef4444';
      const ewHex = sig.ew === 'GREEN' ? '#22c55e' : sig.ew === 'YELLOW' ? '#facc15' : '#ef4444';

      ctx.textAlign = 'left';
      ctx.fillStyle = nsHex;
      ctx.font = 'bold 30px monospace';
      ctx.fillText(`N/S ${sig.ns}`, 22, 52);

      ctx.fillStyle = ewHex;
      ctx.fillText(`E/W ${sig.ew}`, 22, 96);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('OBEY SIGNALS', w * 0.62, 42);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 28px monospace';
      ctx.fillText(`${sig.secondsRemaining}s`, w * 0.62, 86);

      // Signal dot indicator
      ctx.fillStyle = nsHex;
      ctx.beginPath();
      ctx.arc(w - 52, h * 0.5, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (kind === 'bike_dash') {
      ctx.fillStyle = '#040a08';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#22ff66';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      const rawSpeedKmh = entry.liveValue ?? 0;
      const speedKmh = Math.round(Math.abs(rawSpeedKmh));
      const bikeGear = rawSpeedKmh < -1.2 ? 'R' : speedKmh < 2 ? 'N' : speedKmh < 24 ? '1' : speedKmh < 48 ? '2' : speedKmh < 75 ? '3' : '4';
      ctx.fillStyle = '#22ff66';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(String(speedKmh).padStart(2, '0'), 18, 66);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('KM/H', 22, 88);

      ctx.textAlign = 'right';
      ctx.fillStyle = bikeGear === 'R' ? '#f43f5e' : '#ff7b00';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`VOLT-X · ${bikeGear}`, w - 16, 30);

      // Animated RPM / battery energy bar
      const bars = 8;
      const lit = Math.max(2, Math.min(bars, Math.ceil((speedKmh / 85) * bars + 0.5 * Math.sin(t * 8) + 1.5)));
      for (let i = 0; i < bars; i++) {
        ctx.fillStyle = i < lit ? (i > 5 ? '#ff7b00' : '#22ff66') : '#14291d';
        ctx.fillRect(110 + i * 16, 52 + (bars - i) * 3, 12, 34 - (bars - i) * 3);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('CORE: ONLINE // HDR HUD', w * 0.5, h - 14);
    } else if (kind === 'car_cockpit') {
      // Wide Digital Car Infotainment & Instrument Cluster (matches reference wide cockpit display)
      ctx.fillStyle = '#040812';
      ctx.fillRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#091529');
      grad.addColorStop(0.5, '#0b1e38');
      grad.addColorStop(1, '#091529');
      ctx.fillStyle = grad;
      ctx.fillRect(4, 4, w - 8, h - 8);

      const accent = accentHex || '#38bdf8';
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      const rawSpeedKmh = entry.liveValue ?? 0;
      const speedKmh = Math.round(Math.abs(rawSpeedKmh));
      const gear =
        rawSpeedKmh < -1.2
          ? 'R'
          : speedKmh < 2
            ? 'N'
            : speedKmh < 24
              ? '1'
              : speedKmh < 48
                ? '2'
                : speedKmh < 78
                  ? '3'
                  : speedKmh < 110
                    ? '4'
                    : '5';

      // Left Panel: Speedometer + Gear
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('SPEED', 20, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px monospace';
      ctx.fillText(String(speedKmh).padStart(2, '0'), 18, 82);
      ctx.fillStyle = accent;
      ctx.font = 'bold 14px monospace';
      ctx.fillText('KM/H', 20, 106);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(118, 22, 48, 86);
      ctx.strokeStyle = gear === 'R' ? '#f43f5e' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(118, 22, 48, 86);
      ctx.textAlign = 'center';
      ctx.fillStyle = gear === 'R' ? '#fb7185' : '#fbbf24';
      ctx.font = 'bold 40px monospace';
      ctx.fillText(gear, 142, 76);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('GEAR', 142, 98);

      // Center Panel: Car Name, Curved RPM Telemetry & HP Gauge
      const hpCur = Math.max(0, Math.round(entry.hpValue ?? 100));
      const hpMax = Math.max(1, Math.round(entry.maxHpValue ?? 100));
      const hpFrac = Math.max(0, Math.min(1, hpCur / hpMax));
      const hpCol = hpFrac > 0.55 ? '#22c55e' : hpFrac > 0.25 ? '#f59e0b' : '#ef4444';

      const bars = 12;
      const lit = Math.max(2, Math.min(bars, Math.ceil((speedKmh / 120) * bars + Math.sin(t * 7) * 0.4 + 1.2)));
      for (let i = 0; i < bars; i++) {
        const bx = 182 + i * 13;
        const bh = 16 + i * 3.1;
        ctx.fillStyle = i < lit ? (i > 9 ? '#ef4444' : i > 6 ? '#f59e0b' : accent) : '#17253d';
        ctx.fillRect(bx, 88 - bh, 9, bh);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fde047';
      const cockpitTitle = title || 'APEX GT COCKPIT';
      ctx.font = cockpitTitle.length > 20 ? 'bold 11px monospace' : 'bold 13px monospace';
      ctx.fillText(cockpitTitle, 182, 24, 152);

      ctx.fillStyle = '#0b1424';
      ctx.fillRect(182, 96, 152, 16);
      ctx.fillStyle = hpCol;
      ctx.fillRect(184, 98, Math.round(148 * hpFrac), 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`HP ${hpCur}/${hpMax}`, 188, 108);

      // Right Panel: Mini Nav Radar & System Status
      ctx.fillStyle = '#07111e';
      ctx.fillRect(w - 142, 16, 126, 96);
      ctx.strokeStyle = '#1e3a5f';
      ctx.strokeRect(w - 142, 16, 126, 96);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w - 120, 96);
      ctx.lineTo(w - 92, 62);
      ctx.lineTo(w - 58, 58);
      ctx.lineTo(w - 34, 28);
      ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(w - 79, 60, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('NAV · SPORT+', w - 134, 32);
    } else if (kind === 'car_second_lcd') {
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, w, h);

      const hue = (t * 48) % 360;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, `hsla(${hue}, 92%, 52%, 0.45)`);
      grad.addColorStop(0.5, `hsla(${(hue + 110) % 360}, 92%, 52%, 0.35)`);
      grad.addColorStop(1, `hsla(${(hue + 220) % 360}, 92%, 52%, 0.45)`);
      ctx.fillStyle = grad;
      ctx.fillRect(6, 6, w - 12, h - 12);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(title || 'MAIN SCREEN VIDEO', w * 0.5, h * 0.46);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(subtitle || 'HD FEED · CONTINUOUS STREAM', w * 0.5, h * 0.62);
    } else if (kind === 'mansion_dj_eq') {
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, w, h);

      const hueShift = (t * 42) % 360;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, `hsla(${hueShift}, 95%, 52%, 0.25)`);
      grad.addColorStop(0.5, `hsla(${(hueShift + 110) % 360}, 95%, 52%, 0.18)`);
      grad.addColorStop(1, `hsla(${(hueShift + 220) % 360}, 95%, 52%, 0.25)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Animated high-energy multi-band spectrum equalizer
      const bands = 22;
      const bw = Math.floor((w - 36) / bands);
      for (let b = 0; b < bands; b++) {
        const energy = 0.25 + 0.75 * Math.abs(Math.sin(t * 6.4 + b * 0.55) * Math.cos(t * 2.7 - b * 0.28));
        const bh = Math.round(energy * (h * 0.58));
        const hue = (hueShift + b * 14) % 360;
        ctx.fillStyle = `hsl(${hue}, 92%, 58%)`;
        ctx.fillRect(18 + b * bw, h - 20 - bh, Math.max(6, bw - 5), bh);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(title || 'APEX SKY CLUB // LIVE DJ', w * 0.5, 42);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(subtitle || 'DEVELOPED BY AFTAB BALOCH DADU', w * 0.5, 70);
      ctx.strokeStyle = `hsl(${hueShift}, 95%, 60%)`;
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);
    } else if (kind === 'mini_monitor') {
      ctx.fillStyle = '#090e1a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = accentHex || '#38bdf8';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = accentHex || '#38bdf8';
      ctx.fillRect(8, 8, w - 16, 28);
      ctx.fillStyle = '#070b14';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(title || 'APEX TERMINAL', w * 0.5, 27);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(subtitle || 'SYSTEM ONLINE · READY', w * 0.5, 64);
      // Animated telemetry wave / bar graph
      for (let i = 0; i < 8; i++) {
        const bh = 16 + Math.abs(Math.sin(t * 2.8 + i * 0.8)) * 44;
        ctx.fillStyle = i % 2 === 0 ? accentHex || '#38bdf8' : '#22c55e';
        ctx.fillRect(24 + i * 26, h - 22 - bh, 18, bh);
      }
    } else if (kind === 'gaming_action') {
      // Dynamic FPS / Open-World Racing Action fallback when video is buffering or headless
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#09071a');
      sky.addColorStop(0.5, '#1f1135');
      sky.addColorStop(1, '#0b1020');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Perspective neon highway grid & moving speed lines
      const horizonY = h * 0.46;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
      ctx.lineWidth = 2;
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + i * 16, horizonY);
        ctx.lineTo(w * 0.5 + i * 74, h);
        ctx.stroke();
      }
      for (let r = 0; r < 6; r++) {
        const prog = ((t * 1.4 + r / 6) % 1);
        const ry = horizonY + Math.pow(prog, 1.8) * (h - horizonY);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.15 + prog * 0.65})`;
        ctx.beginPath();
        ctx.moveTo(0, ry);
        ctx.lineTo(w, ry);
        ctx.stroke();
      }

      // Dynamic HUD reticle & gun barrel / supercar silhouette overlay
      const aimX = w * 0.5 + Math.sin(t * 2.4) * (w * 0.14);
      const aimY = h * 0.44 + Math.cos(t * 1.9) * (h * 0.08);
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(aimX, aimY, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(aimX - 28, aimY);
      ctx.lineTo(aimX + 28, aimY);
      ctx.moveTo(aimX, aimY - 28);
      ctx.lineTo(aimX, aimY + 28);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(14, 12, 168, 28);
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(title || 'NOW PLAYING · 120 FPS', 22, 31);
    } else if (kind === 'neon_city_wall') {
      // Cyberpunk Neon City animated trails & skyline fallback
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#090d24');
      grad.addColorStop(0.5, '#190a2a');
      grad.addColorStop(1, '#071526');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Skyline towers
      for (let b = 0; b < 16; b++) {
        const bw = w / 16;
        const bh = h * (0.28 + ((b * 37) % 5) * 0.09);
        ctx.fillStyle = b % 2 === 0 ? '#0b1020' : '#11162a';
        ctx.fillRect(b * bw + 2, h - bh, bw - 4, bh);
        ctx.fillStyle = b % 3 === 0 ? '#22d3ee' : b % 3 === 1 ? '#f43f5e' : '#a855f7';
        ctx.fillRect(b * bw + 6, h - bh + 8, bw - 12, 4);
      }
      // Animated horizontal neon light trails
      const trailCols = ['#22d3ee', '#f43f5e', '#a855f7', '#fbbf24'];
      for (let tr = 0; tr < 12; tr++) {
        const yPos = ((tr * 23) % (h - 30)) + 16;
        const speed = 110 + (tr % 4) * 55;
        const dir = tr % 2 === 0 ? 1 : -1;
        const xRaw = dir > 0 ? ((t * speed + tr * 67) % (w + 180)) - 140 : w - ((t * speed + tr * 53) % (w + 180)) + 40;
        ctx.fillStyle = trailCols[tr % trailCols.length];
        ctx.fillRect(xRaw, yPos, 95 + (tr % 3) * 35, 3);
      }
    } else if (kind === 'smart_farm_telemetry') {
      ctx.fillStyle = '#061118';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#14b8a6';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      ctx.fillStyle = '#0d2630';
      ctx.fillRect(10, 10, w - 20, 34);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(title || 'AI SMART FARM TELEMETRY', 20, 32);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#34d399';
      ctx.fillText(subtitle || 'AUTO · OPTIMAL', w - 20, 32);

      // Soil Moisture, Nutrient EC, Solar Grid & Crop Health bars
      const bars = [
        { label: 'MOISTURE', val: 68 + Math.round(Math.sin(t * 0.9) * 4), col: '#06b6d4' },
        { label: 'HEALTH', val: 96, col: '#22c55e' },
        { label: 'PH / EC', val: 84, col: '#38bdf8' },
        { label: 'SOLAR', val: 88 + Math.round(Math.cos(t * 0.7) * 5), col: '#facc15' },
      ];
      bars.forEach((b, idx) => {
        const bx = 22 + idx * Math.floor((w - 44) / 4);
        const bw = Math.floor((w - 76) / 4);
        const maxH = h - 108;
        const bh = Math.round((b.val / 100) * maxH);
        ctx.fillStyle = '#0b1e29';
        ctx.fillRect(bx, 60, bw, maxH);
        ctx.fillStyle = b.col;
        ctx.fillRect(bx + 4, 60 + maxH - bh, bw - 8, bh);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`${b.val}%`, bx + bw * 0.5, 56);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(b.label, bx + bw * 0.5, h - 22);
      });
    } else if (kind === 'smart_city_dome_banner') {
      // Modern Futuristic LED Dome Marquee: "SMART CITY — developed by AFTAB BALOCH DADU"
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#040b18');
      grad.addColorStop(0.5, '#071b30');
      grad.addColorStop(1, '#040b18');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle perspective cyber grid
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
      ctx.lineWidth = 1.5;
      for (let gx = 0; gx <= w; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy <= h; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // Outer luminous bezel & sweeping pulse line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      const scanX = ((t * 220) % (w + 180)) - 90;
      const scanGrad = ctx.createLinearGradient(scanX - 90, 0, scanX + 90, 0);
      scanGrad.addColorStop(0, 'rgba(34,211,238,0)');
      scanGrad.addColorStop(0.5, 'rgba(34,211,238,0.45)');
      scanGrad.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(10, 10, w - 20, 6);
      ctx.fillRect(10, h - 16, w - 20, 6);

      // Main Title
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(h * 0.36)}px sans-serif`;
      ctx.fillText(title || 'SMART CITY', w * 0.5, h * 0.48);

      // Developer Credit Pill Band
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.fillRect(w * 0.08, h * 0.56, w * 0.84, h * 0.25);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(w * 0.08, h * 0.56, w * 0.84, h * 0.25);
      ctx.fillStyle = '#fde68a';
      ctx.font = `bold ${Math.round(h * 0.125)}px monospace`;
      ctx.fillText(subtitle || 'developed by AFTAB BALOCH DADU', w * 0.5, h * 0.725);

      // Corner indicator status
      ctx.fillStyle = '#34d399';
      ctx.font = `bold ${Math.round(h * 0.075)}px monospace`;
      ctx.fillText('SOLAR GLASS BIODOME · 30 ROBOTS · 18 DRONES ACTIVE', w * 0.5, h * 0.925);
    } else if (kind === 'smart_city_charts') {
      // Live Animated Dynamic Multi-Chart Display Board inside Dome
      ctx.fillStyle = '#050c17';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      ctx.fillStyle = '#0b1e33';
      ctx.fillRect(8, 8, w - 16, 30);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(title || 'SMART CITY DYNAMIC ANALYTICS', 16, 28);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(subtitle || 'LIVE TELEMETRY', w - 16, 28);

      // Left half: Animated Energy & Yield Bars
      const barLabels = ['SOLAR', 'WIND', 'HYDRO', 'AI LAB'];
      const barCols = ['#facc15', '#38bdf8', '#22c55e', '#a855f7'];
      const leftW = w * 0.46;
      barLabels.forEach((lbl, idx) => {
        const val = 0.58 + 0.34 * Math.abs(Math.sin(t * 0.8 + idx * 1.1));
        const bx = 18 + idx * ((leftW - 24) / 4);
        const bw = (leftW - 44) / 4;
        const maxH = h - 82;
        const bh = val * maxH;
        ctx.fillStyle = '#0f2238';
        ctx.fillRect(bx, 48, bw, maxH);
        ctx.fillStyle = barCols[idx];
        ctx.fillRect(bx + 2, 48 + maxH - bh, bw - 4, bh);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${Math.round(val * 100)}%`, bx + bw * 0.5, 44 + maxH - bh);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(lbl, bx + bw * 0.5, h - 14);
      });

      // Right half: Live Scrolling Line Graph
      const gx = w * 0.52;
      const gw = w * 0.44;
      const gy = 48;
      const gh = h - 76;
      ctx.fillStyle = '#071526';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      for (let r = 1; r < 4; r++) {
        ctx.beginPath();
        ctx.moveTo(gx, gy + (gh * r) / 4);
        ctx.lineTo(gx + gw, gy + (gh * r) / 4);
        ctx.stroke();
      }
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const px = gx + (i / 14) * gw;
        const py = gy + gh * (0.46 - 0.32 * Math.sin(t * 1.4 + i * 0.55));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const px = gx + (i / 14) * gw;
        const py = gy + gh * (0.62 - 0.24 * Math.cos(t * 1.1 + i * 0.48));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#67e8f9';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('OUTPUT & FLEET STABILITY CURVE', gx + gw * 0.5, h - 12);
    }

    if (entry.damageHits > 0) {
      this.drawCrackAndGlitchOverlay(entry, t);
    }

    ctx.restore();
  }

  private drawCrackAndGlitchOverlay(entry: AnimatedDisplayEntry, t: number): void {
    const { ctx, canvas, damageHits, cracks } = entry;
    const w = canvas.width;
    const h = canvas.height;

    if (damageHits >= 3) {
      // Completely destroyed / shattered black LCD with jagged fracture edges & faint dead-pixel flicker
      ctx.fillStyle = '#030508';
      ctx.fillRect(0, 0, w, h);

      // Subtle dead RGB tear band flickering along fracture
      const tearY = ((Math.floor(t * 14) * 53) % Math.max(12, h - 18));
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.fillRect(0, tearY, w, 4);
      ctx.fillStyle = 'rgba(236, 72, 153, 0.14)';
      ctx.fillRect(0, (tearY + 11) % h, w, 3);

      for (let c = 0; c < cracks.length; c++) {
        const cr = cracks[c];
        const cx = cr.u * w;
        const cy = cr.v * h;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.68)';
        ctx.lineWidth = 2.2;
        for (let r = 0; r < 14; r++) {
          const ang = (r / 14) * Math.PI * 2 + Math.sin(cr.seed + r) * 0.25;
          const len = Math.max(w, h) * (0.28 + ((r * 17) % 11) * 0.05);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          const mx = cx + Math.cos(ang + 0.12) * len * 0.45;
          const my = cy + Math.sin(ang + 0.12) * len * 0.45;
          ctx.lineTo(mx, my);
          ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
          ctx.stroke();
        }
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // Cracked LCD (1-2 hits): vibrant RGB vertical/horizontal pixel glitch columns + dark ink bleeding + spiderweb cracks
    const glitchCols = ['#22d3ee', '#ec4899', '#3b82f6', '#4ade80', '#facc15', '#ffffff'];
    for (let c = 0; c < cracks.length; c++) {
      const cr = cracks[c];
      const cx = cr.u * w;
      const cy = cr.v * h;

      // Vertical broken-LCD RGB bleed stripes from impact point
      const stripeCount = damageHits >= 2 ? 11 : 6;
      for (let s = 0; s < stripeCount; s++) {
        const sx = cx + Math.sin(cr.seed + s * 2.1 + Math.floor(t * 16) * 0.4) * (18 + s * 4);
        const sw = 2 + (s % 4) * 2;
        ctx.fillStyle = glitchCols[(s + Math.floor(t * 12)) % glitchCols.length];
        ctx.globalAlpha = 0.72;
        ctx.fillRect(sx, 0, sw, h);
      }

      // Horizontal RGB glitch scanlines
      const barCount = damageHits >= 2 ? 9 : 4;
      for (let b = 0; b < barCount; b++) {
        const by = cy + Math.cos(cr.seed + b * 3.1 + Math.floor(t * 18) * 0.5) * (h * 0.35);
        const bh = 3 + (b % 5) * 2;
        ctx.fillStyle = glitchCols[(b * 2 + Math.floor(t * 15)) % glitchCols.length];
        ctx.globalAlpha = 0.65;
        ctx.fillRect(0, by, w, bh);
      }
      ctx.globalAlpha = 1;

      // Black dead-LCD ink blotch at impact core
      ctx.fillStyle = '#020408';
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        Math.min(w, h) * (damageHits >= 2 ? 0.16 : 0.1),
        Math.min(w, h) * (damageHits >= 2 ? 0.12 : 0.08),
        cr.seed,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // White/cyan jagged spiderweb fracture cracks radiating outward
      const rays = damageHits >= 2 ? 14 : 9;
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.92)';
      ctx.lineWidth = 2.0;
      for (let r = 0; r < rays; r++) {
        const ang = (r / rays) * Math.PI * 2 + Math.sin(cr.seed + r) * 0.2;
        const len = Math.min(w, h) * (0.28 + (r % 3) * 0.14) * (damageHits >= 2 ? 1.45 : 1.0);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        const midX = cx + Math.cos(ang + 0.09) * len * 0.52;
        const midY = cy + Math.sin(ang + 0.09) * len * 0.52;
        ctx.lineTo(midX, midY);
        ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        ctx.stroke();
      }
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)';
      [0.14, 0.25].forEach((radFrac) => {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * radFrac, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.sharedVideos.forEach((stream) => {
      try {
        stream.video.pause();
        stream.video.removeAttribute('src');
        stream.video.load();
        stream.video.remove();
      } catch {
        // ignore
      }
    });
    this.sharedVideos.clear();
    if (this.videoPoolContainer) {
      try {
        this.videoPoolContainer.remove();
      } catch {
        // ignore
      }
      this.videoPoolContainer = null;
    }
    for (const e of this.entries) {
      e.video = null;
      e.texture.dispose();
    }
    this.entries.length = 0;
    this.materialToEntry.clear();
  }
}
