import { FireMode, WeaponId } from '../types';
import { computeEngineAudioTargets, getEngineAudioProfile, stepDjTrackIndex } from './mansionSystems';
import { clampMusicVolume, loadStoredMusicVolume } from './lobbyConfig';

const PISTOL_MP3 =
  './assets/aistudio/pistol_sound_effects__desert_eagle_sound_effects_gun_sound_effects_MP3_160K__3edb41aa.mp3';
const AK47_MP3 =
  './assets/aistudio/Ak-47___AKM_Sound_Effect__gunsound__real__ytshorts__viral_MP3_160K__19db8db8.mp3';
const SMG_MP3 =
  './assets/aistudio/SMG_-_Sound_Effect__Roblox__MP3_160K__7097d3a4.mp3';
const SINGLE_SHOT_MP3 =
  './assets/aistudio/40_Smith_wesson_single___Royalty_Free_Sound_Effects_MP3_160K__7403a81a.mp3';
const BURST_SHOT_MP3 =
  './assets/aistudio/Realistic_Gun_Sound_Effects___Bullets_Falling_MP3_160K__51f0318b.mp3';

// Uploaded combat, foley, headshot & drum explosion audio assets
const HEADSHOT_MP3 = './assets/aistudio/Headshot-sound-effect_e060a5b2.mp3';
const DRUM_EXPLOSION_MP3 = './assets/aistudio/drum_explosion_92bda242.mp3';
const BIG_EXPLOSION_MP3 = './assets/aistudio/Big_Explosion_Sound_Effect_MP3_160K__d9bb7f82.mp3';
const GRENADE_BLAST_MP3 = './assets/aistudio/Grenade_-_Sound_Effect__Roblox__MP3_160K__1d4b7584.mp3';
const POLICE_SIREN_MP3 = './assets/aistudio/police_siren_MP3_160K__b018c807.mp3';
const SHOTGUN_DB_MP3 = './assets/aistudio/Double_barrel_shotgun_sound_effects_4213bede.mp3';
const SNIPER_HEAVY_MP3 = './assets/aistudio/authentic-gunshot-sounds_94e7187e.mp3';
const BERETTA_PISTOL_MP3 = './assets/aistudio/beretta-92fs-handgun_25b839d2.mp3';
const PISTOL_TAP_MP3 = './assets/aistudio/pistol_975c178b.mp3';
const SOLO_HANDGUN_MP3 = './assets/aistudio/solo-handgun-fire-3-3_b1e432f8.mp3';
const M60_LMG_MP3 = './assets/aistudio/genuine-m60-shooting_221e68e1.mp3';
const AK_AUTO_MP3 = './assets/aistudio/ak47-sound-effects_b6bd3d36.mp3';
const AR_BURST_MP3 = './assets/aistudio/gun-shots-230534_adf5e718.mp3';
const PDW_RAPID_MP3 = './assets/aistudio/long-distance-gunfire-sounds-6_bd442a47.mp3';
const DISTANT_RIFLE_MP3 = './assets/aistudio/distant-gunshot-sound-12_69dbfa0b.mp3';
const SEMI_RIFLE_MP3 = './assets/aistudio/foisal72-gun-fire-346766_6d744d3c.mp3';
const HEAVY_SNAP_MP3 = './assets/aistudio/PL-K_b1628441.mp3';

// Uploaded environment, traffic, helicopter & footstep audio assets
const OUTDOOR_AMBIENCE_MP3 =
  './assets/aistudio/Outdoor_General_Ambience_Short_Sound_Effect_MP3_160K__725acaf0.mp3';
const CAR_HORN_MP3 =
  './assets/aistudio/Car_Horn_Sound_Effect___Car_Horn_Traffic_Sound_Effect_MP3_160K__e32afc20.mp3';
const FOOTSTEPS_MP3 =
  './assets/aistudio/Sound_Effects_-_Footsteps_MP3_160K__dcb3e53c.mp3';
const CAR_REMOTE_BEEP_MP3 = './assets/aistudio/car_beep_new.mp3';
const CAR_ENGINE_START_MP3 = './assets/aistudio/car_engine_start.mp3';
const MANSION_ENGINE_1_MP3 = './assets/aistudio/mansion_engine_1.mp3';
const MANSION_ENGINE_2_MP3 = './assets/aistudio/mansion_engine_2.mp3';
const MANSION_ENGINE_3_MP3 = './assets/aistudio/mansion_engine_3.mp3';
const MANSION_ENGINE_TOKYO_MP3 = './assets/aistudio/mansion_engine_tokyo.mp3';
const CAR_BACKFIRE_KIT_MP3 = './assets/aistudio/car_backfire_kit.mp3';
const PARTY_DJ_1_MP3 = './assets/aistudio/party_dj_music_1.mp3';
const PARTY_DJ_2_MP3 = './assets/aistudio/party_dj_music_2.mp3';
const HELICOPTER_ROTOR_MP3 =
  './assets/aistudio/Realistic_Helicopter_Sound_Effect_MP3_160K__23a578d1.mp3';

type SampleKey =
  | 'pistol'
  | 'ak47'
  | 'smg'
  | 'single'
  | 'burst'
  | 'headshot'
  | 'drum_explosion'
  | 'big_explosion'
  | 'grenade_blast'
  | 'police_siren'
  | 'shotgun_db'
  | 'sniper_heavy'
  | 'beretta_pistol'
  | 'pistol_tap'
  | 'solo_handgun'
  | 'm60_lmg'
  | 'ak_auto'
  | 'ar_burst'
  | 'pdw_rapid'
  | 'distant_rifle'
  | 'semi_rifle'
  | 'heavy_snap'
  | 'outdoor_ambience'
  | 'car_horn'
  | 'footsteps'
  | 'car_remote_beep'
  | 'car_engine_start'
  | 'mansion_engine_1'
  | 'mansion_engine_2'
  | 'mansion_engine_3'
  | 'mansion_engine_tokyo'
  | 'car_backfire_kit'
  | 'party_dj_1'
  | 'party_dj_2'
  | 'helicopter_rotor'
  | 'electric_spark';

const SAMPLE_MANIFEST: { key: SampleKey; url: string; normalize: boolean; label: string }[] = [
  { key: 'party_dj_1', url: PARTY_DJ_1_MP3, normalize: true, label: 'Mansion Club DJ Mix Track 1' },
  { key: 'party_dj_2', url: PARTY_DJ_2_MP3, normalize: true, label: 'Mansion Club DJ Mix Track 2' },
  { key: 'pistol', url: PISTOL_MP3, normalize: false, label: 'Tactical Pistol & Slide Foley' },
  { key: 'ak47', url: AK47_MP3, normalize: true, label: 'Assault Rifle Classic Audio' },
  { key: 'smg', url: SMG_MP3, normalize: true, label: 'SMG / CQB Core Audio' },
  { key: 'single', url: SINGLE_SHOT_MP3, normalize: false, label: 'Heavy Single Shot Audio' },
  { key: 'burst', url: BURST_SHOT_MP3, normalize: false, label: 'Burst & Brass Foley' },
  { key: 'headshot', url: HEADSHOT_MP3, normalize: true, label: 'Headshot Confirm SFX' },
  { key: 'drum_explosion', url: DRUM_EXPLOSION_MP3, normalize: false, label: 'Fuel Drum Explosion SFX' },
  { key: 'big_explosion', url: BIG_EXPLOSION_MP3, normalize: true, label: 'Big Gas Station Explosion SFX' },
  { key: 'grenade_blast', url: GRENADE_BLAST_MP3, normalize: true, label: 'Grenade Blast SFX' },
  { key: 'police_siren', url: POLICE_SIREN_MP3, normalize: true, label: 'Police Patrol Siren SFX' },
  { key: 'shotgun_db', url: SHOTGUN_DB_MP3, normalize: false, label: 'M870 Shotgun & Shell Foley' },
  { key: 'sniper_heavy', url: SNIPER_HEAVY_MP3, normalize: false, label: 'AX-50 Sniper Heavy Crack' },
  { key: 'beretta_pistol', url: BERETTA_PISTOL_MP3, normalize: false, label: 'M17 9mm Pistol & Reload' },
  { key: 'pistol_tap', url: PISTOL_TAP_MP3, normalize: false, label: 'M17 Rapid Tap Audio' },
  { key: 'solo_handgun', url: SOLO_HANDGUN_MP3, normalize: false, label: 'Sidearm & Suppressed Punch' },
  { key: 'm60_lmg', url: M60_LMG_MP3, normalize: false, label: 'M249 SAW & HMG Audio' },
  { key: 'ak_auto', url: AK_AUTO_MP3, normalize: true, label: 'Rifle Full-Auto Audio' },
  { key: 'ar_burst', url: AR_BURST_MP3, normalize: true, label: 'HK416 / M16 Burst Audio' },
  { key: 'pdw_rapid', url: PDW_RAPID_MP3, normalize: true, label: 'MP7A2 / CQB Rapid Fire' },
  { key: 'distant_rifle', url: DISTANT_RIFLE_MP3, normalize: false, label: 'Tactical Carbine Snap' },
  { key: 'semi_rifle', url: SEMI_RIFLE_MP3, normalize: true, label: 'Semi-Auto Marksman Fire' },
  { key: 'heavy_snap', url: HEAVY_SNAP_MP3, normalize: false, label: 'High-Caliber Muzzle Snap' },
  { key: 'outdoor_ambience', url: OUTDOOR_AMBIENCE_MP3, normalize: false, label: 'City Outdoor Ambience' },
  { key: 'car_horn', url: CAR_HORN_MP3, normalize: false, label: 'City Traffic Car Horns' },
  { key: 'footsteps', url: FOOTSTEPS_MP3, normalize: true, label: 'Realistic Footsteps' },
  { key: 'car_remote_beep', url: CAR_REMOTE_BEEP_MP3, normalize: true, label: 'Luxury Car Remote Key Beep' },
  { key: 'car_engine_start', url: CAR_ENGINE_START_MP3, normalize: true, label: 'Universal Car Engine Ignition Crank' },
  { key: 'mansion_engine_1', url: MANSION_ENGINE_1_MP3, normalize: true, label: 'Hypercar Twin-Turbo Start' },
  { key: 'mansion_engine_2', url: MANSION_ENGINE_2_MP3, normalize: true, label: 'Luxury V8 SUV Engine' },
  { key: 'mansion_engine_3', url: MANSION_ENGINE_3_MP3, normalize: true, label: 'Bespoke Exhaust Engine' },
  { key: 'mansion_engine_tokyo', url: MANSION_ENGINE_TOKYO_MP3, normalize: true, label: 'Drift GT Performance Note' },
  { key: 'car_backfire_kit', url: CAR_BACKFIRE_KIT_MP3, normalize: true, label: 'Exhaust Backfire Kit SFX' },
  { key: 'helicopter_rotor', url: HELICOPTER_ROTOR_MP3, normalize: true, label: 'Modern Helicopter Turbine & Rotor Audio' },
];

class TacticalAudioEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private decodedSamples: Partial<Record<SampleKey, AudioBuffer>> = {};
  private rawBuffers: Partial<Record<SampleKey, ArrayBuffer>> = {};
  private preloadPromise: Promise<void> | null = null;
  private preloadListeners = new Set<(loaded: number, total: number, detail: string) => void>();
  private preloadCompleted = 0;
  private preloadLastLabel = '';
  private samplesLoading = false;
  private shotCursors: Record<string, number> = {};
  private lastPlayerPainTime = 0;
  private lastEnemyPainTime = 0;
  private lastArmorImpactTime = 0;
  private lastHeadshotVoiceTime = 0;
  private _muted = false;
  private _sfxVolume = 0.85;
  private _musicVolume = loadStoredMusicVolume();
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private outdoorAmbSource: AudioBufferSourceNode | null = null;
  private outdoorAmbGain: GainNode | null = null;
  private airFlowSource: AudioBufferSourceNode | null = null;
  private airFlowGain: GainNode | null = null;
  private airFlowFilter: BiquadFilterNode | null = null;
  private lastCarHornTime = 0;
  private lastPoliceSirenTime = 0;
  private lastVehicleCrashTime = 0;
  private lastBackfireSfxTime = 0;
  private onsetCache = new Map<string, number>();

  public get muted(): boolean {
    return this._muted;
  }

  public set muted(val: boolean) {
    this.setMuted(val);
  }

  public get sfxVolume(): number {
    return this._sfxVolume;
  }

  public get musicVolume(): number {
    return this._musicVolume;
  }

  public setMusicVolume(vol: number) {
    this._musicVolume = clampMusicVolume(vol);
    if (this._musicVolume <= 0.005) {
      this.stopMansionPartyMusic();
    }
  }

  public setMuted(val: boolean) {
    this._muted = Boolean(val);
    this.syncSfxMasterGain();
    if (this._muted) {
      this.stopVehicleAudio();
      this.setSimulatorOutdoorAmbience(false);
      this.setAirFlowSound(false);
      this.stopMansionPartyMusic();
    }
  }

  public setSfxVolume(vol: number) {
    this._sfxVolume = Math.max(0, Math.min(1, vol));
    this.syncSfxMasterGain();
  }

  private syncSfxMasterGain() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const target = this._muted || this._sfxVolume <= 0.001 ? 0 : this._sfxVolume;
    try {
      this.sfxGain.gain.cancelScheduledValues(now);
      this.sfxGain.gain.setTargetAtTime(target, now, 0.025);
    } catch {
      this.sfxGain.gain.value = target;
    }
  }

  private getSfxDestination(ctx: AudioContext): AudioNode {
    if (!this.sfxGain) {
      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = this._muted ? 0 : this._sfxVolume;
      this.sfxGain.connect(ctx.destination);
    }
    return this.sfxGain;
  }

  private ensureAudioContextRaw(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._muted ? 0 : this._sfxVolume;
      this.sfxGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureContext(): AudioContext | null {
    if (this._muted || this._sfxVolume <= 0.001) return null;
    const ctx = this.ensureAudioContextRaw();
    if (!ctx) return null;
    this.preloadGunSamples();
    return ctx;
  }

  public unlock() {
    this.ensureAudioContextRaw();
    this.preloadGunSamples();
  }



  private normalizeBuffer(buffer: AudioBuffer, targetPeak = 0.9): AudioBuffer {
    let peak = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const a = Math.abs(data[i]);
        if (a > peak) peak = a;
      }
    }
    if (peak > 0.001 && peak < targetPeak * 0.85) {
      const scale = Math.min(5.0, targetPeak / peak);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.max(-0.98, Math.min(0.98, data[i] * scale));
        }
      }
    }
    return buffer;
  }

  private setDecodedSample(key: SampleKey, buffer: AudioBuffer) {
    this.decodedSamples[key] = buffer;
  }

  private hasDecodedSample(key: SampleKey): boolean {
    return Boolean(this.decodedSamples[key]);
  }

  private getSample(key: SampleKey): AudioBuffer | undefined {
    return this.decodedSamples[key];
  }

  private nextCursor(bucket: string, len: number): number {
    const idx = this.shotCursors[bucket] ?? 0;
    this.shotCursors[bucket] = idx + 1;
    return idx % Math.max(1, len);
  }

  /**
   * Pre-fetches and decodes essential short SFX during Loading Screen with fast timeout,
   * leaving heavy DJ music & secondary engine loops to lazy-load after user gesture.
   */
  public preloadAllSamples(
    onProgress?: (loaded: number, total: number, detail: string) => void,
  ): Promise<void> {
    const startupKeys = new Set<SampleKey>([
      'pistol',
      'ak47',
      'smg',
      'headshot',
      'grenade_blast',
      'shotgun_db',
      'sniper_heavy',
      'footsteps',
      'car_horn',
      'car_remote_beep',
      'car_engine_start',
      'helicopter_rotor',
    ]);
    const startupItems = SAMPLE_MANIFEST.filter((item) => startupKeys.has(item.key));
    const total = startupItems.length;
    if (onProgress) {
      this.preloadListeners.add(onProgress);
      if (this.preloadCompleted > 0) {
        onProgress(this.preloadCompleted, total, this.preloadLastLabel || 'Sound Bank Ready');
      }
    }
    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = (async () => {
      if (typeof window === 'undefined') return;

      // OfflineAudioContext can decode MP3 bytes without requiring user interaction on Android Chrome
      let decodeCtx: BaseAudioContext | null = this.ctx;
      if (!decodeCtx && typeof OfflineAudioContext !== 'undefined') {
        try {
          decodeCtx = new OfflineAudioContext(2, 44100, 44100);
        } catch {
          decodeCtx = null;
        }
      }

      let cursor = 0;
      const worker = async () => {
        while (cursor < total) {
          const item = startupItems[cursor++];
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 1800);
          try {
            if (!this.rawBuffers[item.key] && !this.hasDecodedSample(item.key)) {
              const res = await fetch(item.url, { signal: controller.signal });
              const cType = res.headers?.get('content-type') || '';
              if (res.ok && !cType.startsWith('text/')) {
                const arr = await res.arrayBuffer();
                this.rawBuffers[item.key] = arr;
              }
            }

            const cachedArr = this.rawBuffers[item.key];
            if (cachedArr && !this.hasDecodedSample(item.key) && decodeCtx) {
              const decoded = await Promise.race([
                decodeCtx.decodeAudioData(cachedArr.slice(0)),
                new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error('decode-timeout')), 1400)),
              ]);
              const finalBuf = item.normalize ? this.normalizeBuffer(decoded, 0.92) : decoded;
              this.setDecodedSample(item.key, finalBuf);
            }
          } catch {
            // Timeout, abort, or missing asset falls back safely without stalling
          } finally {
            window.clearTimeout(timeoutId);
            this.preloadCompleted++;
            this.preloadLastLabel = item.label;
            this.preloadListeners.forEach((cb) => cb(this.preloadCompleted, total, item.label));
          }
        }
      };

      const workers = Array.from({ length: 3 }, () => worker());
      await Promise.race([
        Promise.all(workers),
        new Promise<void>((resolve) => window.setTimeout(resolve, 2200)),
      ]);
      this.preloadListeners.clear();
    })();

    return this.preloadPromise;
  }

  private preloadGunSamples() {
    if (this.samplesLoading || !this.ctx) return;
    const missing = SAMPLE_MANIFEST.filter((item) => !this.hasDecodedSample(item.key));
    if (missing.length === 0) return;
    this.samplesLoading = true;

    const decodeOrFetch = async (item: (typeof SAMPLE_MANIFEST)[number]): Promise<void> => {
      try {
        if (this.hasDecodedSample(item.key) || !this.ctx) return;
        let arr = this.rawBuffers[item.key];
        if (!arr) {
          const res = await fetch(item.url);
          const cType = res.headers?.get('content-type') || '';
          if (!res.ok || cType.startsWith('text/')) return;
          arr = await res.arrayBuffer();
          this.rawBuffers[item.key] = arr;
        }
        if (!this.ctx) return;
        const decoded = await this.ctx.decodeAudioData(arr.slice(0));
        this.setDecodedSample(
          item.key,
          item.normalize ? this.normalizeBuffer(decoded, 0.92) : decoded,
        );
      } catch {
        // fallback cleanly to synthesized audio
      }
    };

    // Decode remaining samples gently in batches of 2 so gameplay FPS never hitches
    void (async () => {
      for (let i = 0; i < missing.length; i += 2) {
        await Promise.all(missing.slice(i, i + 2).map(decodeOrFetch));
      }
    })().finally(() => {
      this.samplesLoading = false;
    });
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playBufferClip(
    ctx: AudioContext,
    buffer: AudioBuffer,
    startOffset: number,
    duration: number,
    volume: number,
    playbackRate = 1.0,
    attackSec = 0.004,
    fadeOutSec = 0.045,
  ) {
    const now = ctx.currentTime;
    const safeOffset = Math.min(startOffset, Math.max(0, buffer.duration - 0.05));
    const safeDur = Math.min(duration, Math.max(0.05, buffer.duration - safeOffset));
    const playDur = safeDur / playbackRate;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(playbackRate, now);

    const gain = ctx.createGain();
    const atk = Math.min(attackSec, playDur * 0.25);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + atk);
    const fadeStart = now + Math.max(atk + 0.01, playDur - Math.min(fadeOutSec, playDur * 0.55));
    gain.gain.setValueAtTime(volume, fadeStart);
    gain.gain.exponentialRampToValueAtTime(0.001, now + playDur);

    src.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    src.start(now, safeOffset, safeDur);
  }

  private findSampleOnset(cacheKey: string, buffer: AudioBuffer, searchStartSec: number, windowSec = 0.45): number {
    const cached = this.onsetCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const ch = buffer.getChannelData(0);
    const sr = buffer.sampleRate;
    const startIdx = Math.max(0, Math.min(ch.length - 1, Math.floor(searchStartSec * sr)));
    const endIdx = Math.min(ch.length - 1, startIdx + Math.floor(windowSec * sr));
    let localPeak = 0;
    for (let i = startIdx; i <= endIdx; i++) {
      const a = Math.abs(ch[i]);
      if (a > localPeak) localPeak = a;
    }
    const thresh = Math.max(0.06, localPeak * 0.34);
    let onsetIdx = startIdx;
    for (let i = startIdx; i <= endIdx; i++) {
      if (Math.abs(ch[i]) >= thresh) {
        onsetIdx = Math.max(startIdx, i - Math.floor(sr * 0.004));
        break;
      }
    }
    const res = onsetIdx / sr;
    this.onsetCache.set(cacheKey, res);
    return res;
  }

  private playPistolTransient(ctx: AudioContext, now: number, gainScale = 1.0) {
    if (!this.noiseBuffer) return;
    // Crisp 9mm high-pressure crack
    const crack = ctx.createBufferSource();
    crack.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1950, now);
    bp.Q.setValueAtTime(0.65, now);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.32 * gainScale, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    crack.connect(bp);
    bp.connect(cg);
    cg.connect(this.getSfxDestination(ctx));
    crack.start(now);
    crack.stop(now + 0.11);

    // Punchy breech thump
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(195, now);
    thump.frequency.exponentialRampToValueAtTime(52, now + 0.07);
    tg.gain.setValueAtTime(0.34 * gainScale, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    thump.connect(tg);
    tg.connect(this.getSfxDestination(ctx));
    thump.start(now);
    thump.stop(now + 0.095);
  }

  public playGunshot(
    weaponId: WeaponId,
    onBeat = false,
    fireMode: FireMode = 'auto',
    isBurstSubShot = false,
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    if (weaponId === 'rocket') {
      this.playRocketLaunch(ctx, now);
      return;
    }

    const pistolBuf = this.getSample('pistol');
    const ak47Buf = this.getSample('ak47');
    const smgBuf = this.getSample('smg');
    const singleBuf = this.getSample('single');
    const burstBuf = this.getSample('burst');

    const berettaBuf = this.getSample('beretta_pistol');
    const pistolTapBuf = this.getSample('pistol_tap');
    const soloPistolBuf = this.getSample('solo_handgun');
    const pdwBuf = this.getSample('pdw_rapid');
    const akAutoBuf = this.getSample('ak_auto');
    const arBurstBuf = this.getSample('ar_burst');
    const m60Buf = this.getSample('m60_lmg');
    const sniperHeavyBuf = this.getSample('sniper_heavy');
    const shotgunDbBuf = this.getSample('shotgun_db');
    const distantRifleBuf = this.getSample('distant_rifle');
    const semiRifleBuf = this.getSample('semi_rifle');
    const heavySnapBuf = this.getSample('heavy_snap');

    // 1. M17 Tactical Pistol (Fixed crisp peak-onset slicing + instant 9mm transient crack every shot!)
    if (weaponId === 'pistol') {
      this.playPistolTransient(ctx, now, 0.92);
      const turn = this.nextCursor('pistol', 3);
      if (turn === 0 && soloPistolBuf) {
        const off = this.findSampleOnset('solo_handgun_0', soloPistolBuf, 0.0, 0.25);
        this.playBufferClip(ctx, soloPistolBuf, off, 0.32, 0.88, 1.0, 0.001, 0.07);
        return;
      }
      if (turn === 1 && berettaBuf) {
        const off = this.findSampleOnset('beretta_0', berettaBuf, 3.45, 0.5);
        this.playBufferClip(ctx, berettaBuf, off, 0.36, 0.9, 1.02, 0.001, 0.07);
        return;
      }
      if (pistolBuf) {
        const off = this.findSampleOnset('pistol_de_0', pistolBuf, 1.55, 0.35);
        this.playBufferClip(ctx, pistolBuf, off, 0.28, 0.86, 1.04, 0.001, 0.06);
        return;
      }
      if (pistolTapBuf) {
        const off = this.findSampleOnset('pistol_tap_0', pistolTapBuf, 1.9, 0.45);
        this.playBufferClip(ctx, pistolTapBuf, off, 0.32, 0.86, 1.02, 0.001, 0.06);
        return;
      }
      return;
    }

    // 2. HK MP7A2 PDW (fast compact 4.6mm snap)
    if (weaponId === 'smg') {
      if (fireMode === 'semi' && soloPistolBuf) {
        this.playBufferClip(ctx, soloPistolBuf, 0.03, 0.24, 0.72, 1.24, 0.002, 0.05);
        return;
      }
      if (pdwBuf && (this.nextCursor('smg_mix', 2) === 0 || !smgBuf)) {
        const offsets = [0.06, 0.82, 1.46, 1.78, 2.12];
        const off = offsets[this.nextCursor('pdw', offsets.length)];
        this.playBufferClip(ctx, pdwBuf, off, 0.12, 0.82, 1.08, 0.002, 0.035);
        return;
      }
      if (smgBuf) {
        const offsets = [0.938, 1.134, 1.214, 1.294, 1.414];
        const off = offsets[this.nextCursor('smg', offsets.length)];
        this.playBufferClip(ctx, smgBuf, off, 0.095, 0.74, 1.08, 0.003, 0.032);
        return;
      }
    }

    // 3. SIG MCX & M7 NGSW (suppressed .300 Blackout / 6.8mm Fury crisp suppressed snap)
    if (weaponId === 'mcx' || weaponId === 'm7') {
      if (fireMode === 'semi' && distantRifleBuf) {
        this.playBufferClip(
          ctx,
          distantRifleBuf,
          0.04,
          0.42,
          weaponId === 'm7' ? 0.86 : 0.74,
          weaponId === 'm7' ? 0.92 : 1.06,
          0.002,
          0.07,
        );
        return;
      }
      if (pdwBuf && weaponId === 'mcx') {
        const offsets = [0.06, 0.82, 1.46, 1.78];
        const off = offsets[this.nextCursor('mcx', offsets.length)];
        this.playBufferClip(ctx, pdwBuf, off, 0.13, 0.78, 0.96, 0.002, 0.045);
        return;
      }
      if (weaponId === 'm7' && arBurstBuf) {
        const offsets = [0.16, 0.28, 0.53, 0.88];
        const off = offsets[this.nextCursor('m7', offsets.length)];
        this.playBufferClip(ctx, arBurstBuf, off, 0.16, 0.86, 0.86, 0.002, 0.05);
        return;
      }
      if (smgBuf) {
        const offsets = [0.938, 1.134, 1.214, 1.414];
        const off = offsets[this.nextCursor('mcx_smg', offsets.length)];
        const rate = weaponId === 'm7' ? 0.78 : 0.92;
        const vol = weaponId === 'm7' ? 0.82 : 0.68;
        this.playBufferClip(ctx, smgBuf, off, 0.12, vol, rate, 0.003, 0.045);
        return;
      }
    }

    // 4. M249 SAW LMG & Mounted M12 Recon HMG (Heavy authentic M60 automatic gunfire)
    if (weaponId === 'm249') {
      if (m60Buf) {
        const offsets = [0.17, 0.33, 0.45, 0.6, 0.72, 0.88, 1.0, 1.13, 1.25];
        const off = offsets[this.nextCursor('m60', offsets.length)];
        this.playBufferClip(ctx, m60Buf, off, 0.17, 0.94, 0.98, 0.002, 0.045);
        // Heavy LMG chamber thump
        const thump = ctx.createOscillator();
        const thumpGain = ctx.createGain();
        thump.type = 'triangle';
        thump.frequency.setValueAtTime(140, now);
        thump.frequency.exponentialRampToValueAtTime(45, now + 0.08);
        thumpGain.gain.setValueAtTime(0.22, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        thump.connect(thumpGain);
        thumpGain.connect(this.getSfxDestination(ctx));
        thump.start(now);
        thump.stop(now + 0.09);
        return;
      }
    }

    // 5. Semi-Auto Fire Style on Assault & Battle Rifles (crisp single shots)
    if (
      fireMode === 'semi' &&
      (weaponId === 'm4a1' ||
        weaponId === 'hk416' ||
        weaponId === 'hk416_cqb' ||
        weaponId === 'm27_iar' ||
        weaponId === 'xm8' ||
        weaponId === 'm16' ||
        weaponId === 'mk17')
    ) {
      if (weaponId === 'mk17' && heavySnapBuf) {
        this.playBufferClip(ctx, heavySnapBuf, 0.0, 0.34, 0.9, 0.95, 0.002, 0.08);
        return;
      }
      if (semiRifleBuf) {
        const offsets = [0.57, 1.98, 2.62, 3.38, 4.06];
        const off = offsets[this.nextCursor('semi_rifle', offsets.length)];
        const rate = weaponId === 'mk17' ? 0.88 : weaponId === 'hk416_cqb' ? 1.08 : 1.0;
        this.playBufferClip(ctx, semiRifleBuf, off, 0.34, 0.88, rate, 0.002, 0.075);
        return;
      }
    }

    // 6. Assault & Battle Rifles (M4A1, HK416, HK416C, M27 IAR, XM8, M16, MK17)
    if (
      weaponId === 'm4a1' ||
      weaponId === 'hk416' ||
      weaponId === 'hk416_cqb' ||
      weaponId === 'm27_iar' ||
      weaponId === 'xm8' ||
      weaponId === 'm16' ||
      weaponId === 'mk17'
    ) {
      if ((weaponId === 'hk416' || weaponId === 'hk416_cqb' || weaponId === 'm16') && arBurstBuf) {
        const offsets = [0.16, 0.28, 0.53, 0.65, 0.88];
        const off = offsets[this.nextCursor('ar_burst', offsets.length)];
        const rate = weaponId === 'hk416_cqb' ? 1.12 : weaponId === 'm16' ? 1.04 : 0.98;
        this.playBufferClip(ctx, arBurstBuf, off, 0.16, 0.86, rate, 0.002, 0.045);
        return;
      }
      if (weaponId === 'mk17' && m60Buf) {
        const offsets = [0.17, 0.45, 0.72, 1.0, 1.25];
        const off = offsets[this.nextCursor('mk17', offsets.length)];
        this.playBufferClip(ctx, m60Buf, off, 0.17, 0.9, 0.88, 0.002, 0.05);
        return;
      }
      if (akAutoBuf && (weaponId === 'm4a1' || weaponId === 'xm8') && this.nextCursor('ak_mix', 2) === 0) {
        const offsets = [5.28, 5.68, 7.96, 8.32, 10.82, 11.15];
        const off = offsets[this.nextCursor('ak_auto', offsets.length)];
        const rate = weaponId === 'xm8' ? 1.08 : 1.0;
        this.playBufferClip(ctx, akAutoBuf, off, 0.17, 0.86, rate, 0.002, 0.045);
        return;
      }
      if (ak47Buf) {
        const offsets = [0.268, 0.398, 0.558, 0.758];
        const off = offsets[this.nextCursor('ak47_classic', offsets.length)];
        const clipDur = fireMode === 'semi' ? 0.24 : 0.145;
        const rate =
          weaponId === 'mk17'
            ? 0.84
            : weaponId === 'm27_iar'
              ? 0.95
              : weaponId === 'hk416_cqb'
                ? 1.14
                : weaponId === 'xm8'
                  ? 1.08
                  : weaponId === 'm16'
                    ? 1.04
                    : weaponId === 'hk416'
                      ? 1.06
                      : 1.0;
        const vol = weaponId === 'mk17' ? 0.92 : 0.82;
        this.playBufferClip(ctx, ak47Buf, off, clipDur, vol, rate, 0.003, 0.045);
        return;
      }
    }

    // 7. AX-50 Precision Sniper (Heavy authentic high-caliber sniper crack + sub punch + bolt rack)
    if (weaponId === 'sniper') {
      if (sniperHeavyBuf) {
        this.playBufferClip(ctx, sniperHeavyBuf, 0.03, 1.55, 0.98, 0.96, 0.002, 0.22);
      } else if (singleBuf) {
        this.playBufferClip(ctx, singleBuf, 0.255, 0.9, 0.96, 0.72, 0.003, 0.14);
      }
      if (sniperHeavyBuf || singleBuf) {
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(118, now);
        sub.frequency.exponentialRampToValueAtTime(28, now + 0.26);
        subGain.gain.setValueAtTime(0.42, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        sub.connect(subGain);
        subGain.connect(this.getSfxDestination(ctx));
        sub.start(now);
        sub.stop(now + 0.28);

        // Mechanical bolt cycle clack after firing
        const boltTime = now + 0.28;
        if (berettaBuf) {
          const src = ctx.createBufferSource();
          src.buffer = berettaBuf;
          src.playbackRate.setValueAtTime(1.12, boltTime);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.001, boltTime);
          g.gain.linearRampToValueAtTime(0.55, boltTime + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, boltTime + 0.22);
          src.connect(g);
          g.connect(this.getSfxDestination(ctx));
          src.start(boltTime, 1.48, 0.24);
        } else {
          const click = ctx.createOscillator();
          const clickGain = ctx.createGain();
          click.type = 'square';
          click.frequency.setValueAtTime(980, boltTime);
          click.frequency.exponentialRampToValueAtTime(420, boltTime + 0.045);
          clickGain.gain.setValueAtTime(0.08, boltTime);
          clickGain.gain.exponentialRampToValueAtTime(0.001, boltTime + 0.05);
          click.connect(clickGain);
          clickGain.connect(this.getSfxDestination(ctx));
          click.start(boltTime);
          click.stop(boltTime + 0.05);
        }

        return;
      }
    }

    // 8. M870 Combat Pump Shotgun (Uploaded Double Barrel Shotgun blast + forend rack foley)
    if (weaponId === 'shotgun') {
      if (shotgunDbBuf) {
        const blastOffsets = [1.7, 4.25];
        const off = blastOffsets[this.nextCursor('shotgun', blastOffsets.length)];
        this.playBufferClip(ctx, shotgunDbBuf, off, 1.25, 0.98, 1.0, 0.002, 0.16);
        // Pump rack foley shortly after trigger blast
        const rackT = now + 0.26;
        const pumpSrc = ctx.createBufferSource();
        pumpSrc.buffer = shotgunDbBuf;
        pumpSrc.playbackRate.setValueAtTime(1.08, rackT);
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0.001, rackT);
        pg.gain.linearRampToValueAtTime(0.75, rackT + 0.012);
        pg.gain.exponentialRampToValueAtTime(0.001, rackT + 0.22);
        pumpSrc.connect(pg);
        pg.connect(this.getSfxDestination(ctx));
        pumpSrc.start(rackT, 7.03, 0.24);

        return;
      }
      if (singleBuf) {
        this.playBufferClip(ctx, singleBuf, 0.255, 0.72, 0.95, 0.78, 0.003, 0.1);
        if (burstBuf) {
          this.playBufferClip(ctx, burstBuf, 0.14, 0.22, 0.55, 1.15, 0.005, 0.06);
        }
        return;
      }
    }

    // Fallback Burst / Single Sample
    if (fireMode === 'burst' && burstBuf) {
      if (!isBurstSubShot) {
        this.playBufferClip(ctx, burstBuf, 0.94, 0.72, 0.92, 0.9, 0.004, 0.08);
      }
      return;
    }

    if (singleBuf) {
      const rate = weaponId === 'shotgun' ? 0.8 : weaponId === 'smg' ? 1.15 : 1.0;
      this.playBufferClip(ctx, singleBuf, 0.255, 0.85, 0.86, rate, 0.003, 0.08);
      return;
    }

    // Fallback WebAudio synthesis if MP3s are still decoding on very first frame
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type =
      weaponId === 'sniper' || weaponId === 'shotgun' || weaponId === 'mk17' || weaponId === 'm249'
        ? 'sawtooth'
        : 'triangle';

    const startFreq =
      weaponId === 'sniper'
        ? 150
        : weaponId === 'shotgun'
          ? 140
          : weaponId === 'mk17' || weaponId === 'm249'
            ? 168
            : weaponId === 'smg'
              ? 240
              : 195;
    const endFreq = weaponId === 'sniper' || weaponId === 'shotgun' ? 30 : 52;
    const punchDur =
      weaponId === 'sniper'
        ? 0.25
        : weaponId === 'shotgun'
          ? 0.22
          : weaponId === 'smg'
            ? 0.08
            : 0.13;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + punchDur);
    oscGain.gain.setValueAtTime(weaponId === 'sniper' ? 0.5 : 0.32, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + punchDur);
    osc.connect(oscGain);
    oscGain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + punchDur);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(
      weaponId === 'sniper' ? 1300 : weaponId === 'smg' ? 2700 : 1850,
      now,
    );
    filter.Q.setValueAtTime(0.85, now);
    const noiseGain = ctx.createGain();
    const tail = weaponId === 'sniper' ? 0.42 : weaponId === 'smg' ? 0.1 : 0.18;
    noiseGain.gain.setValueAtTime(weaponId === 'sniper' ? 0.5 : 0.32, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + tail);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.getSfxDestination(ctx));
    noise.start(now);
    noise.stop(now + tail);
  }


  /**
   * Properly edited supply/ammo refill sound:
   * - Slices the real Desert Eagle mechanical slide-rack (0.635s..0.935s)
   * - Layers metallic shell/ammo latch clink (0.14s..0.49s from Realistic Gun Sound)
   * - Finishes with a crisp 2-tone tactical supply chime
   */
  public playRefill() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const pistolBuf = this.getSample('pistol');
    const burstBuf = this.getSample('burst');
    const berettaBuf = this.getSample('beretta_pistol');

    if (berettaBuf) {
      this.playBufferClip(ctx, berettaBuf, 1.48, 0.24, 0.82, 1.05, 0.006, 0.04);
    } else if (pistolBuf) {
      this.playBufferClip(ctx, pistolBuf, 0.635, 0.3, 1.35, 1.06, 0.008, 0.05);
    }
    if (burstBuf) {
      this.playBufferClip(ctx, burstBuf, 0.145, 0.34, 0.72, 1.15, 0.01, 0.06);
    }

    // Bright supply confirmation chime
    [587.33, 880.0].forEach((freq, idx) => {
      const t = now + 0.06 + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(this.getSfxDestination(ctx));
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playBigExplosion() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const bigBuf = this.getSample('big_explosion') ?? this.getSample('drum_explosion');
    if (bigBuf) {
      const off = this.findSampleOnset('big_explosion_0', bigBuf, 0.0, 0.4);
      this.playBufferClip(ctx, bigBuf, off, Math.min(3.8, bigBuf.duration - off), 1.05, 1.0, 0.002, 0.35);
      const now = ctx.currentTime;
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(92, now);
      sub.frequency.exponentialRampToValueAtTime(18, now + 0.95);
      subGain.gain.setValueAtTime(0.75, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      sub.connect(subGain);
      subGain.connect(this.getSfxDestination(ctx));
      sub.start(now);
      sub.stop(now + 1.02);
      return;
    }
    this.playRocketExplosion();
  }

  public playGrenadeExplosion(inWater = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (inWater) {
      this.playWaterSplash(1.8, 0);
    }
    const gBuf = this.getSample('drum_explosion') ?? this.getSample('big_explosion');
    if (gBuf) {
      const off = this.findSampleOnset('drum_exp_0', gBuf, 0.0, 0.35);
      this.playBufferClip(ctx, gBuf, off, Math.min(3.3, gBuf.duration - off), inWater ? 0.72 : 1.0, inWater ? 0.84 : 1.0, 0.002, 0.28);
      const now = ctx.currentTime;
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(inWater ? 85 : 108, now);
      sub.frequency.exponentialRampToValueAtTime(20, now + 0.68);
      subGain.gain.setValueAtTime(inWater ? 0.42 : 0.56, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      sub.connect(subGain);
      subGain.connect(this.getSfxDestination(ctx));
      sub.start(now);
      sub.stop(now + 0.75);
      return;
    }
    this.playExplosion();
  }

  public playDrumExplosion() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const drumBuf = this.getSample('drum_explosion') ?? this.getSample('big_explosion');
    if (drumBuf) {
      const off = this.findSampleOnset('drum_exp_0', drumBuf, 0.0, 0.35);
      this.playBufferClip(ctx, drumBuf, off, 3.3, 0.98, 1.0, 0.002, 0.28);
      // Add subtle sub-bass impact foundation
      const now = ctx.currentTime;
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(105, now);
      sub.frequency.exponentialRampToValueAtTime(22, now + 0.65);
      subGain.gain.setValueAtTime(0.5, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      sub.connect(subGain);
      subGain.connect(this.getSfxDestination(ctx));
      sub.start(now);
      sub.stop(now + 0.72);
      return;
    }
    this.playExplosion();
  }

  public playExplosion() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(24, now + 0.55);
    subGain.gain.setValueAtTime(0.65, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    sub.connect(subGain);
    subGain.connect(this.getSfxDestination(ctx));
    sub.start(now);
    sub.stop(now + 0.6);

    const blast = ctx.createBufferSource();
    blast.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.7);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    blast.connect(filter);
    filter.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    blast.start(now);
    blast.stop(now + 0.75);
  }

  private playRocketLaunch(ctx: AudioContext, now: number) {
    if (!this.noiseBuffer) return;
    // Deep ignition thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sawtooth';
    thump.frequency.setValueAtTime(145, now);
    thump.frequency.exponentialRampToValueAtTime(34, now + 0.34);
    thumpGain.gain.setValueAtTime(0.45, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    thump.connect(thumpGain);
    thumpGain.connect(this.getSfxDestination(ctx));
    thump.start(now);
    thump.stop(now + 0.38);

    // Pressurized rocket motor whoosh & propellant hiss
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = this.noiseBuffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(950, now);
    band.frequency.exponentialRampToValueAtTime(280, now + 0.65);
    band.Q.setValueAtTime(0.7, now);
    const wGain = ctx.createGain();
    wGain.gain.setValueAtTime(0.02, now);
    wGain.gain.linearRampToValueAtTime(0.58, now + 0.04);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    whoosh.connect(band);
    band.connect(wGain);
    wGain.connect(this.getSfxDestination(ctx));
    whoosh.start(now);
    whoosh.stop(now + 0.74);
  }

  public playRocketExplosion() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Massive sub-bass concussion wave
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, now);
    sub.frequency.exponentialRampToValueAtTime(18, now + 0.85);
    subGain.gain.setValueAtTime(0.85, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    sub.connect(subGain);
    subGain.connect(this.getSfxDestination(ctx));
    sub.start(now);
    sub.stop(now + 0.92);

    // Wide roaring blast rumble
    const blast = ctx.createBufferSource();
    blast.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(95, now + 1.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.18);
    blast.connect(filter);
    filter.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    blast.start(now);
    blast.stop(now + 1.2);
  }

  public playDryFire() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const shotgunDbBuf = this.getSample('shotgun_db');
    if (shotgunDbBuf) {
      // Crisp uploaded mechanical empty-chamber bullet click
      this.playBufferClip(ctx, shotgunDbBuf, 15.32, 0.24, 0.95, 1.1, 0.002, 0.04);
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.03);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playGrenadeBounce() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.04);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playSlide() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.25);
  }

  public playEnemyShot() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.1);
  }

  public playReloadStart() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const berettaBuf = this.getSample('beretta_pistol');
    if (berettaBuf) {
      this.playBufferClip(ctx, berettaBuf, 0.92, 0.36, 0.92, 1.04, 0.004, 0.05);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.06);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playReloadFinish() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const berettaBuf = this.getSample('beretta_pistol');
    const pistolBuf = this.getSample('pistol');
    if (berettaBuf) {
      this.playBufferClip(ctx, berettaBuf, 1.48, 0.25, 0.96, 1.02, 0.004, 0.045);
    } else if (pistolBuf) {
      this.playBufferClip(ctx, pistolBuf, 0.64, 0.28, 0.9, 1.12, 0.008, 0.04);
    }

    [0, 0.08].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 420 : 720, now + offset);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 640 : 980, now + offset + 0.05);
      gain.gain.setValueAtTime(0.1, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(gain);
      gain.connect(this.getSfxDestination(ctx));
      osc.start(now + offset);
      osc.stop(now + offset + 0.06);
    });
  }

  public playHitmarker(isHeadshot: boolean, isKill: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isHeadshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(isHeadshot ? 1480 : 880, now);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 1960 : 540, now + 0.06);
    gain.gain.setValueAtTime(isHeadshot ? 0.18 : 0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.07);

    if (isKill) {
      const killOsc = ctx.createOscillator();
      const killGain = ctx.createGain();
      killOsc.type = 'sine';
      killOsc.frequency.setValueAtTime(1046, now + 0.04);
      killOsc.frequency.exponentialRampToValueAtTime(1568, now + 0.14);
      killGain.gain.setValueAtTime(0.14, now + 0.04);
      killGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      killOsc.connect(killGain);
      killGain.connect(this.getSfxDestination(ctx));
      killOsc.start(now + 0.04);
      killOsc.stop(now + 0.16);
    }
  }

  public playArmorImpact(target: 'player' | 'enemy' = 'player') {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    if (now - this.lastArmorImpactTime < 0.055) return;
    this.lastArmorImpactTime = now;

    // Crisp ceramic/kevlar plate impact noise burst
    const impact = ctx.createBufferSource();
    impact.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(target === 'player' ? 1750 : 2250, now);
    filter.Q.setValueAtTime(2.0, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(target === 'player' ? 0.18 : 0.14, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    impact.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.getSfxDestination(ctx));
    impact.start(now);
    impact.stop(now + 0.08);

    // Subtle metallic plate clink
    const clink = ctx.createOscillator();
    const clinkGain = ctx.createGain();
    clink.type = 'triangle';
    clink.frequency.setValueAtTime(target === 'player' ? 680 : 940, now);
    clink.frequency.exponentialRampToValueAtTime(target === 'player' ? 320 : 460, now + 0.06);
    clinkGain.gain.setValueAtTime(target === 'player' ? 0.12 : 0.09, now);
    clinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    clink.connect(clinkGain);
    clinkGain.connect(this.getSfxDestination(ctx));
    clink.start(now);
    clink.stop(now + 0.07);
  }

  /**
   * Short, natural human pain sound ("Ah!") using parallel vowel formants & breath transient.
   * Distinct pitch/timbre for player vs. enemy, gated by cooldown and kept modest in volume.
   */
  public playPainSound(target: 'player' | 'enemy') {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    if (target === 'player') {
      if (now - this.lastPlayerPainTime < 0.22) return;
      this.lastPlayerPainTime = now;
    } else {
      if (now - this.lastEnemyPainTime < 0.16) return;
      this.lastEnemyPainTime = now;
    }

    const jitter = 0.94 + Math.random() * 0.12;
    const isPlayer = target === 'player';
    const dur = isPlayer ? 0.155 : 0.135;
    const f0Start = (isPlayer ? 172 : 138) * jitter;
    const f0End = (isPlayer ? 116 : 92) * jitter;
    const vol = isPlayer ? 0.2 : 0.15;

    // Glottal vocal source
    const glottal = ctx.createOscillator();
    glottal.type = 'sawtooth';
    glottal.frequency.setValueAtTime(f0Start, now);
    glottal.frequency.exponentialRampToValueAtTime(f0End, now + dur);

    // Parallel "Ah" vowel formants (F1 ~ 730Hz, F2 ~ 1180Hz)
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(isPlayer ? 740 : 660, now);
    f1.Q.setValueAtTime(4.2, now);

    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(isPlayer ? 1220 : 1090, now);
    f2.Q.setValueAtTime(5.0, now);

    const vocalEnv = ctx.createGain();
    vocalEnv.gain.setValueAtTime(0.001, now);
    vocalEnv.gain.linearRampToValueAtTime(vol, now + 0.018);
    vocalEnv.gain.exponentialRampToValueAtTime(vol * 0.45, now + dur * 0.55);
    vocalEnv.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const f1Gain = ctx.createGain();
    f1Gain.gain.setValueAtTime(0.85, now);
    const f2Gain = ctx.createGain();
    f2Gain.gain.setValueAtTime(0.55, now);

    glottal.connect(f1);
    glottal.connect(f2);
    f1.connect(f1Gain);
    f2.connect(f2Gain);
    f1Gain.connect(vocalEnv);
    f2Gain.connect(vocalEnv);
    vocalEnv.connect(this.getSfxDestination(ctx));

    // Subtle exhaled breath transient ("h" onset)
    const breath = ctx.createBufferSource();
    breath.buffer = this.noiseBuffer;
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.setValueAtTime(isPlayer ? 1450 : 1200, now);
    breathFilter.Q.setValueAtTime(1.4, now);
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.001, now);
    breathGain.gain.linearRampToValueAtTime(vol * 0.35, now + 0.015);
    breathGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.75);
    breath.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(this.getSfxDestination(ctx));

    glottal.start(now);
    glottal.stop(now + dur + 0.01);
    breath.start(now);
    breath.stop(now + dur);
  }

  public playDamageTaken(armorAbsorbed = false, hpDamaged = true) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = armorAbsorbed ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(armorAbsorbed ? 190 : 110, now);
    osc.frequency.exponentialRampToValueAtTime(armorAbsorbed ? 58 : 38, now + 0.14);
    gain.gain.setValueAtTime(armorAbsorbed ? 0.2 : 0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.16);

    if (armorAbsorbed) {
      this.playArmorImpact('player');
    }
    if (hpDamaged) {
      this.playPainSound('player');
    }
  }

  public playMagDrop() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const berettaBuf = this.getSample('beretta_pistol');
    const shotgunDbBuf = this.getSample('shotgun_db');
    if (berettaBuf) {
      this.playBufferClip(ctx, berettaBuf, 0.02, 0.22, 0.85, 1.08, 0.003, 0.04);
    } else if (shotgunDbBuf) {
      this.playBufferClip(ctx, shotgunDbBuf, 7.04, 0.16, 0.85, 1.0, 0.003, 0.04);
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.055);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playBoltRack() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const berettaBuf = this.getSample('beretta_pistol');
    const pistolBuf = this.getSample('pistol');
    if (berettaBuf) {
      this.playBufferClip(ctx, berettaBuf, 1.48, 0.23, 0.88, 1.06, 0.003, 0.04);
      return;
    }
    if (pistolBuf) {
      this.playBufferClip(ctx, pistolBuf, 0.64, 0.22, 0.72, 1.18, 0.005, 0.04);
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(1020, now + 0.045);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playPinPull() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(2200, now + 0.05);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playBreachReady() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(880, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.15);
  }

  public playPickup() {
    this.playRefill();
  }

  public playFootstep(
    sprinting: boolean,
    opts?: {
      surface?: 'concrete' | 'metal' | 'wood' | 'dirt' | 'water';
      isCrouching?: boolean;
      distanceMeters?: number;
      isLanding?: boolean;
    },
  ) {
    const dist = opts?.distanceMeters ?? 0;
    if (dist > 26) return;
    const distAtten = dist <= 1.5 ? 1 : Math.max(0.06, 1 - dist / 26);

    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const surface = opts?.surface ?? 'concrete';
    const isCrouching = Boolean(opts?.isCrouching);
    const isLanding = Boolean(opts?.isLanding);

    const strideVar = 0.94 + Math.random() * 0.12;
    const postureGain = isLanding ? 1.38 : isCrouching ? 0.38 : sprinting ? 1.0 : 0.72;
    const totalScale = postureGain * distAtten;

    // 1. Crisp low-mid heel/sole impact thud
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = surface === 'wood' ? 'triangle' : 'sine';
    const basePitch =
      surface === 'metal'
        ? 165
        : surface === 'wood'
          ? 122
          : surface === 'dirt'
            ? 88
            : surface === 'water'
              ? 135
              : 108;
    osc.frequency.setValueAtTime(basePitch * strideVar * (sprinting ? 1.08 : 1), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(36, basePitch * 0.42), now + 0.055);
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.14 * totalScale, now + 0.004);
    oscGain.gain.exponentialRampToValueAtTime(0.0008, now + (isLanding ? 0.11 : 0.065));
    osc.connect(oscGain);
    oscGain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.12);

    // 2. Clean surface-specific sole grit / scuff / splash transient
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = surface === 'water' || surface === 'metal' ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(
      surface === 'water'
        ? 1450 * strideVar
        : surface === 'metal'
          ? 1280 * strideVar
          : surface === 'wood'
            ? 520 * strideVar
            : surface === 'dirt'
              ? 780 * strideVar
              : (sprinting ? 640 : 480) * strideVar,
      now,
    );
    filter.Q.value = surface === 'metal' ? 4.8 : surface === 'water' ? 1.2 : 0.85;
    const nGain = ctx.createGain();
    const gritVol = (surface === 'water' ? 0.16 : surface === 'dirt' ? 0.11 : 0.085) * totalScale;
    nGain.gain.setValueAtTime(Math.max(0.002, gritVol), now);
    nGain.gain.exponentialRampToValueAtTime(0.0008, now + (surface === 'water' ? 0.16 : 0.075));
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.getSfxDestination(ctx));
    noise.start(now);
    noise.stop(now + 0.18);
  }

  public playCarjackDoor() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Door latch metallic click + deep cabin thud
    const click = ctx.createOscillator();
    const clickG = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(520, now);
    click.frequency.exponentialRampToValueAtTime(160, now + 0.045);
    clickG.gain.setValueAtTime(0.18, now);
    clickG.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    click.connect(clickG);
    clickG.connect(this.getSfxDestination(ctx));
    click.start(now);
    click.stop(now + 0.055);

    const thud = ctx.createOscillator();
    const thudG = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(128, now + 0.18);
    thud.frequency.exponentialRampToValueAtTime(42, now + 0.34);
    thudG.gain.setValueAtTime(0.24, now + 0.18);
    thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    thud.connect(thudG);
    thudG.connect(this.getSfxDestination(ctx));
    thud.start(now + 0.18);
    thud.stop(now + 0.38);
  }

  /** Plays metallic crunch, hood latch snap, and road slide impact SFX for vehicle/bike collisions. */
  public playVehicleCrash(
    severity: number,
    isBike = false,
    stage: 0 | 1 | 2 | 3 = 1,
    distanceMeters = 0,
  ) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 110) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastVehicleCrashTime < 90) return;
    this.lastVehicleCrashTime = nowPerf;

    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.14, 1 - distanceMeters / 110);
    const intensity = Math.max(0.25, Math.min(1.0, severity)) * atten;
    const dest = this.getSfxDestination(ctx);

    // 1. Sub chassis impact thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = isBike ? 'triangle' : 'sine';
    thump.frequency.setValueAtTime(isBike ? 170 : 120 + stage * 18, now);
    thump.frequency.exponentialRampToValueAtTime(34, now + 0.18 + intensity * 0.1);
    thumpGain.gain.setValueAtTime(0.001, now);
    thumpGain.gain.linearRampToValueAtTime(0.42 * intensity, now + 0.006);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    thump.connect(thumpGain);
    thumpGain.connect(dest);
    thump.start(now);
    thump.stop(now + 0.3);

    // 2. Crumple sheet-metal noise + asphalt scrape
    const crunch = ctx.createBufferSource();
    crunch.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isBike ? 1850 : 950 + stage * 240, now);
    bp.frequency.exponentialRampToValueAtTime(380, now + 0.28);
    bp.Q.value = 0.85;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.001, now);
    cg.gain.linearRampToValueAtTime(0.36 * intensity, now + 0.008);
    cg.gain.exponentialRampToValueAtTime(0.001, now + (isBike ? 0.34 : 0.3 + stage * 0.07));
    crunch.connect(bp);
    bp.connect(cg);
    cg.connect(dest);
    crunch.start(now);
    crunch.stop(now + 0.54);

    // 3. Hood latch / hinge metal clang on Stage 2 & 3
    if (!isBike && stage >= 2) {
      const clang = ctx.createOscillator();
      const clGain = ctx.createGain();
      clang.type = 'square';
      clang.frequency.setValueAtTime(stage === 3 ? 640 : 480, now + 0.02);
      clang.frequency.exponentialRampToValueAtTime(190, now + 0.22);
      clGain.gain.setValueAtTime(0.001, now + 0.02);
      clGain.gain.linearRampToValueAtTime(0.18 * intensity, now + 0.026);
      clGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      clang.connect(clGain);
      clGain.connect(dest);
      clang.start(now + 0.02);
      clang.stop(now + 0.25);
    }
  }

  public playFireModeSwitch() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const shotgunDbBuf = this.getSample('shotgun_db');
    if (shotgunDbBuf) {
      // Crisp metallic selector / bullet click
      this.playBufferClip(ctx, shotgunDbBuf, 7.05, 0.12, 0.9, 1.32, 0.002, 0.03);
      return;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1150, now);
    osc.frequency.exponentialRampToValueAtTime(1650, now + 0.032);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playVictoryFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(this.getSfxDestination(ctx));
      osc.start(t);
      osc.stop(t + 0.56);
    });
  }

  private vehicleOsc: OscillatorNode | null = null;
  private vehicleSubOsc: OscillatorNode | null = null;
  private vehicleGain: GainNode | null = null;
  private vehicleFilter: BiquadFilterNode | null = null;
  private engineSampleLoop: AudioBufferSourceNode | null = null;
  private engineSampleGain: GainNode | null = null;
  private activeVehicleKind = '';

  private getEngineSampleForKind(vehicleKind?: string | boolean): SampleKey {
    if (typeof vehicleKind !== 'string') return 'mansion_engine_1';
    return getEngineAudioProfile(vehicleKind).sampleKey;
  }

  public startVehicleAudio(vehicleKind?: boolean | string) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.stopVehicleAudio();

    const kindStr = typeof vehicleKind === 'string' ? vehicleKind : '';
    this.activeVehicleKind = kindStr;
    const prof = getEngineAudioProfile(kindStr);
    const idleTargets = computeEngineAudioTargets(kindStr, 0, 0, false);
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();

    const isSuvOrHeli =
      kindStr === 'apex_heli' ||
      kindStr === 'future_heli' ||
      kindStr === 'future_drone' ||
      kindStr.includes('hummer') ||
      kindStr.includes('escalade') ||
      kindStr.includes('range') ||
      kindStr.includes('thar') ||
      kindStr.includes('suv') ||
      kindStr.includes('tank') ||
      kindStr.includes('cyber');
    const isEvOrGt =
      kindStr === 'mansion_ev_gt' || kindStr === 'vision_silver' || kindStr === 'gullwing_coupe';

    osc.type = isSuvOrHeli ? 'triangle' : isEvOrGt ? 'sine' : 'sawtooth';
    sub.type = isEvOrGt ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(idleTargets.oscHz, now);
    sub.frequency.setValueAtTime(idleTargets.subHz, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(idleTargets.filterHz, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(idleTargets.synthGain, now + 0.22);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.getSfxDestination(ctx));

    osc.start(now);
    sub.start(now);

    this.vehicleOsc = osc;
    this.vehicleSubOsc = sub;
    this.vehicleGain = gain;
    this.vehicleFilter = filter;

    const engBuf = this.getSample(prof.sampleKey);
    if (engBuf) {
      const eSrc = ctx.createBufferSource();
      eSrc.buffer = engBuf;
      eSrc.loop = true;
      eSrc.playbackRate.setValueAtTime(idleTargets.playbackRate, now);
      const eGain = ctx.createGain();
      eGain.gain.setValueAtTime(0.001, now);
      eGain.gain.linearRampToValueAtTime(idleTargets.sampleGain, now + 0.28);
      eSrc.connect(eGain);
      eGain.connect(this.getSfxDestination(ctx));
      eSrc.start(now);
      this.engineSampleLoop = eSrc;
      this.engineSampleGain = eGain;
    }
  }

  public updateVehicleAudio(speedKmh: number, throttle: number, airborne = false) {
    if (!this.ctx || !this.vehicleOsc || !this.vehicleSubOsc || !this.vehicleGain || !this.vehicleFilter) return;
    const now = this.ctx.currentTime;
    const targets = computeEngineAudioTargets(this.activeVehicleKind, speedKmh, throttle, airborne);
    const isHeli =
      this.activeVehicleKind === 'apex_heli' ||
      this.activeVehicleKind === 'future_heli' ||
      this.activeVehicleKind === 'future_drone';
    const bladeMod = isHeli ? 1 + 0.12 * Math.sin(now * 28.0) : 1.0;

    this.vehicleOsc.frequency.setTargetAtTime(targets.oscHz * bladeMod, now, 0.06);
    this.vehicleSubOsc.frequency.setTargetAtTime(targets.subHz, now, 0.06);
    this.vehicleFilter.frequency.setTargetAtTime(targets.filterHz, now, 0.06);
    this.vehicleGain.gain.setTargetAtTime(targets.synthGain * bladeMod, now, 0.08);

    if (this.engineSampleLoop && this.engineSampleGain) {
      this.engineSampleLoop.playbackRate.setTargetAtTime(targets.playbackRate, now, 0.09);
      this.engineSampleGain.gain.setTargetAtTime(targets.sampleGain, now, 0.09);
    } else if (this.activeVehicleKind) {
      const engBuf = this.getSample(this.getEngineSampleForKind(this.activeVehicleKind));
      if (engBuf) {
        const eSrc = this.ctx.createBufferSource();
        eSrc.buffer = engBuf;
        eSrc.loop = true;
        eSrc.playbackRate.value = targets.playbackRate;
        const eGain = this.ctx.createGain();
        eGain.gain.value = targets.sampleGain;
        eSrc.connect(eGain);
        eGain.connect(this.getSfxDestination(this.ctx));
        eSrc.start(now);
        this.engineSampleLoop = eSrc;
        this.engineSampleGain = eGain;
      }
    }
  }

  public stopVehicleAudio() {
    this.activeVehicleKind = '';
    if (this.vehicleGain && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        this.vehicleGain.gain.cancelScheduledValues(now);
        this.vehicleGain.gain.setTargetAtTime(0.0001, now, 0.05);
      } catch {
        // ignore
      }
    }
    if (this.engineSampleGain && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        this.engineSampleGain.gain.cancelScheduledValues(now);
        this.engineSampleGain.gain.setTargetAtTime(0.0001, now, 0.06);
      } catch {
        // ignore
      }
    }
    const osc = this.vehicleOsc;
    const sub = this.vehicleSubOsc;
    const eSrc = this.engineSampleLoop;
    this.vehicleOsc = null;
    this.vehicleSubOsc = null;
    this.vehicleGain = null;
    this.vehicleFilter = null;
    this.engineSampleLoop = null;
    this.engineSampleGain = null;
    window.setTimeout(() => {
      try {
        osc?.stop();
        osc?.disconnect();
        sub?.stop();
        sub?.disconnect();
        eSrc?.stop();
        eSrc?.disconnect();
      } catch {
        // ignore
      }
    }, 90);
  }

  /** Plays uploaded "HEADSHOT" sound effect + crisp fallback chime if sample is still buffering. */
  public playHeadshotVoice() {
    if (this._muted || this._sfxVolume <= 0.02) return;
    const perfNow = performance.now();
    if (perfNow - this.lastHeadshotVoiceTime < 450) return;
    this.lastHeadshotVoiceTime = perfNow;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const headshotBuf = this.getSample('headshot');
    if (headshotBuf) {
      this.playBufferClip(ctx, headshotBuf, 0.04, 1.35, 0.96, 1.0, 0.003, 0.08);
      return;
    }

    const now = ctx.currentTime;
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'triangle';
    bell.frequency.setValueAtTime(1180, now);
    bell.frequency.exponentialRampToValueAtTime(1760, now + 0.09);
    bellGain.gain.setValueAtTime(0.28, now);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    bell.connect(bellGain);
    bellGain.connect(this.getSfxDestination(ctx));
    bell.start(now);
    bell.stop(now + 0.24);
  }

  /** Plays a heavy metallic bumper-strike thud when a vehicle hits or runs over a hostile. */
  public playVehicleImpact(fatal: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(fatal ? 110 : 95, now);
    thud.frequency.exponentialRampToValueAtTime(26, now + (fatal ? 0.28 : 0.18));
    thudGain.gain.setValueAtTime(fatal ? 0.65 : 0.45, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + (fatal ? 0.3 : 0.2));
    thud.connect(thudGain);
    thudGain.connect(this.getSfxDestination(ctx));
    thud.start(now);
    thud.stop(now + (fatal ? 0.32 : 0.22));

    if (this.noiseBuffer) {
      const crunch = ctx.createBufferSource();
      crunch.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'lowpass';
      bp.frequency.setValueAtTime(fatal ? 1600 : 1100, now);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(fatal ? 0.42 : 0.28, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + (fatal ? 0.24 : 0.14));
      crunch.connect(bp);
      bp.connect(cg);
      cg.connect(this.getSfxDestination(ctx));
      crunch.start(now);
      crunch.stop(now + (fatal ? 0.26 : 0.16));
    }
  }

  /** Soft local rain & breeze ambience for Simulator rainy weather (zero external assets). */
  public setWeatherAmbience(rainIntensity: number) {
    const clamped = Math.max(0, Math.min(1, rainIntensity));
    if (this._muted || this._sfxVolume <= 0.01 || clamped <= 0.02) {
      if (this.rainGain && this.ctx) {
        try {
          this.rainGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
        } catch {
          // ignore
        }
      }
      if (clamped <= 0.01 && this.rainSource) {
        const src = this.rainSource;
        this.rainSource = null;
        this.rainGain = null;
        this.rainFilter = null;
        window.setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
          } catch {
            // ignore
          }
        }, 200);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    if (!this.rainSource || !this.rainGain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1450;
      bp.Q.value = 0.55;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(bp);
      bp.connect(gain);
      gain.connect(this.getSfxDestination(ctx));
      src.start();
      this.rainSource = src;
      this.rainFilter = bp;
      this.rainGain = gain;
    }

    const targetGain = 0.048 * clamped;
    try {
      this.rainGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.22);
      if (this.rainFilter) {
        this.rainFilter.frequency.setTargetAtTime(1150 + clamped * 600, ctx.currentTime, 0.25);
      }
    } catch {
      // ignore
    }
  }

  /** Crisp UI/door/shop chime when interacting in World Simulator. */
  public playInteractChime(kind: 'door' | 'refuel' | 'shop' | 'dine' | 'bike' | 'seat' = 'door') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes =
      kind === 'refuel'
        ? [520, 780]
        : kind === 'shop' || kind === 'dine'
          ? [660, 880, 1120]
          : kind === 'bike'
            ? [420, 630, 840]
            : [320, 480];

    notes.forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = kind === 'door' ? 'triangle' : 'sine';
      const t0 = now + idx * 0.055;
      osc.frequency.setValueAtTime(hz, t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      osc.connect(g);
      g.connect(this.getSfxDestination(ctx));
      osc.start(t0);
      osc.stop(t0 + 0.18);
    });
  }

  /** Looped outdoor general city ambience for simulator exploration (active while BGM is disabled). */
  public setSimulatorOutdoorAmbience(active: boolean, nightFactor = 0) {
    if (!active || this._muted || this._sfxVolume <= 0.01) {
      if (this.outdoorAmbGain && this.ctx) {
        try {
          this.outdoorAmbGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.18);
        } catch {
          // ignore
        }
      }
      if (!active && this.outdoorAmbSource) {
        const src = this.outdoorAmbSource;
        this.outdoorAmbSource = null;
        this.outdoorAmbGain = null;
        window.setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
          } catch {
            // ignore
          }
        }, 220);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;
    const buf = this.getSample('outdoor_ambience');
    if (!buf) return;

    if (!this.outdoorAmbSource || !this.outdoorAmbGain) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(gain);
      gain.connect(this.getSfxDestination(ctx));
      src.start();
      this.outdoorAmbSource = src;
      this.outdoorAmbGain = gain;
    }

    const targetGain = 0.22 * (1 - nightFactor * 0.25);
    try {
      this.outdoorAmbGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.25);
    } catch {
      // ignore
    }
  }

  /**
   * Continuous realistic air-flow sound across ALL cities:
   * subtly breathes across urban streets and intensifies smoothly with walking/sprinting speed and helicopter flight.
   */
  public setAirFlowSound(
    active: boolean,
    params: { walkSpeed?: number; heliSpeed?: number; altitude?: number } = {},
  ) {
    if (!active || this._muted || this._sfxVolume <= 0.01) {
      if (this.airFlowGain && this.ctx) {
        try {
          this.airFlowGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.14);
        } catch {
          // ignore
        }
      }
      if (!active && this.airFlowSource) {
        const src = this.airFlowSource;
        this.airFlowSource = null;
        this.airFlowGain = null;
        this.airFlowFilter = null;
        window.setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
          } catch {
            // ignore
          }
        }, 180);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    if (!this.airFlowSource || !this.airFlowGain || !this.airFlowFilter) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.72;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.getSfxDestination(ctx));
      src.start();
      this.airFlowSource = src;
      this.airFlowFilter = filter;
      this.airFlowGain = gain;
    }

    const walkRatio = Math.max(0, Math.min(1, (params.walkSpeed ?? 0) / 11.4));
    const heliRatio = Math.max(0, Math.min(1, (params.heliSpeed ?? 0) / 17.0));
    const altRatio = Math.max(0, Math.min(1, (params.altitude ?? 0) / 30.0));
    const totalLevel = Math.min(1, 0.16 + walkRatio * 0.36 + heliRatio * 0.55 + altRatio * 0.35);
    const targetGain = 0.012 + totalLevel * 0.068;
    const targetHz = 340 + walkRatio * 420 + heliRatio * 680 + altRatio * 340;

    try {
      this.airFlowGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.12);
      this.airFlowFilter.frequency.setTargetAtTime(targetHz, ctx.currentTime, 0.14);
    } catch {
      // ignore
    }
  }

  /** Plays NPC traffic car horn attenuated smoothly by distance in meters. */
  public playNpcCarHorn(distanceMeters: number) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 72) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastCarHornTime < 2200) return;
    this.lastCarHornTime = nowPerf;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const atten = Math.max(0.06, 1 - distanceMeters / 72);
    const hornBuf = this.getSample('car_horn');
    if (hornBuf) {
      const idx = this.nextCursor('car_horn_slice', 3);
      const starts = [0.08, 0.85, 1.6];
      const offset = starts[idx] % Math.max(0.4, hornBuf.duration - 0.55);
      const dur = 0.42 + (idx % 2) * 0.14;
      const rate = 0.94 + (idx % 3) * 0.06;
      this.playBufferClip(ctx, hornBuf, offset, dur, 0.34 * atten, rate, 0.01, 0.08);
      return;
    }

    const now = ctx.currentTime;
    [392, 493.88].forEach((hz) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(hz, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.06 * atten, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(g);
      g.connect(this.getSfxDestination(ctx));
      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  /** Plays authentic police cruiser siren attenuated smoothly by distance in meters. */
  public playPoliceSiren(distanceMeters: number) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 120) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastPoliceSirenTime < 2600) return;
    this.lastPoliceSirenTime = nowPerf;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const atten = Math.max(0.08, 1 - distanceMeters / 120);
    const sirenBuf = this.getSample('police_siren');
    if (sirenBuf) {
      const off = this.findSampleOnset('police_siren_0', sirenBuf, 0.0, 0.5);
      const dur = Math.min(2.35, Math.max(0.6, sirenBuf.duration - off));
      this.playBufferClip(ctx, sirenBuf, off, dur, 0.52 * atten, 1.0, 0.03, 0.18);
      return;
    }

    // Two-tone police wail synth fallback
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.linearRampToValueAtTime(980, now + 0.45);
    osc.frequency.linearRampToValueAtTime(620, now + 0.9);
    osc.frequency.linearRampToValueAtTime(980, now + 1.35);
    osc.frequency.linearRampToValueAtTime(620, now + 1.8);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11 * atten, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.82);
    osc.connect(g);
    g.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 1.85);
  }

  /** Plays NPC police officer pistol gunshot attenuated smoothly by distance. */
  public playNpcPistolShot(distanceMeters: number) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 85) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.12, 1 - distanceMeters / 85);
    this.playPistolTransient(ctx, now, 0.62 * atten);
    const soloBuf = this.getSample('solo_handgun') ?? this.getSample('pistol');
    if (soloBuf) {
      const off = this.findSampleOnset('npc_pistol_0', soloBuf, 0.0, 0.35);
      this.playBufferClip(ctx, soloBuf, off, 0.24, 0.56 * atten, 1.04, 0.002, 0.06);
    }
  }

  /** Plays crisp crystalline glass crack or full shattering burst attenuated by distance. */
  public playGlassShatter(crackOnly = false, distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 95) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.14, 1 - distanceMeters / 95);
    const dest = this.getSfxDestination(ctx);

    // High-passed crystalline fracture noise burst
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(crackOnly ? 3200 : 2400, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime((crackOnly ? 0.22 : 0.38) * atten, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (crackOnly ? 0.14 : 0.38));
    src.connect(hp);
    hp.connect(gain);
    gain.connect(dest);
    src.start(now);
    src.stop(now + (crackOnly ? 0.16 : 0.42));

    // Metallic/glass shard tinkles
    const pingCount = crackOnly ? 2 : 6;
    const baseHz = crackOnly ? 2800 : 2100;
    for (let i = 0; i < pingCount; i++) {
      const t0 = now + i * (crackOnly ? 0.018 : 0.032) + Math.random() * 0.02;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseHz + Math.random() * 2400, t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime((crackOnly ? 0.045 : 0.07) * atten, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 0.1);
    }
  }

  /** Plays sharp rubber pop + pressurized air hiss for vehicle tire puncture. */
  public playTirePuncture(distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 90) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.15, 1 - distanceMeters / 90);
    const dest = this.getSfxDestination(ctx);

    // 1. Rubber blowout thump
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(165, now);
    popOsc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
    popGain.gain.setValueAtTime(0.001, now);
    popGain.gain.linearRampToValueAtTime(0.28 * atten, now + 0.004);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    popOsc.connect(popGain);
    popGain.connect(dest);
    popOsc.start(now);
    popOsc.stop(now + 0.12);

    // 2. Pressurized air leak hiss ("psssssht")
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3400, now);
    bp.frequency.exponentialRampToValueAtTime(1400, now + 0.55);
    bp.Q.value = 1.4;
    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(0.001, now);
    hissGain.gain.linearRampToValueAtTime(0.24 * atten, now + 0.015);
    hissGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    hissSrc.connect(bp);
    bp.connect(hissGain);
    hissGain.connect(dest);
    hissSrc.start(now);
    hissSrc.stop(now + 0.6);
  }

  /** Plays visceral meaty thud / cranial crunch on NPC/enemy hit. */
  public playBloodImpact(isHeadshot = false, distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 80) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.2, 1 - distanceMeters / 80);
    const dest = this.getSfxDestination(ctx);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHeadshot ? 190 : 125, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.075);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime((isHeadshot ? 0.24 : 0.15) * atten, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + 0.09);

    if (isHeadshot) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1650, now);
      bp.Q.value = 1.1;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.001, now);
      nGain.gain.linearRampToValueAtTime(0.22 * atten, now + 0.005);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      nSrc.connect(bp);
      bp.connect(nGain);
      nGain.connect(dest);
      nSrc.start(now);
      nSrc.stop(now + 0.12);
    }
  }

  /** Plays liquid splash & bubble burst on water bullet/grenade impact. */
  public playWaterSplash(scale = 1.0, distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 95) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.14, 1 - distanceMeters / 95) * Math.min(1.5, Math.max(0.55, scale));
    const dest = this.getSfxDestination(ctx);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(950, now);
    bp.frequency.exponentialRampToValueAtTime(340, now + 0.28 * Math.min(1.8, scale));
    bp.Q.value = 0.85;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.26 * atten, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36 * Math.min(1.8, scale));
    src.connect(bp);
    bp.connect(g);
    g.connect(dest);
    src.start(now);
    src.stop(now + 0.45 * Math.min(1.8, scale));

    const plink = ctx.createOscillator();
    const pg = ctx.createGain();
    plink.type = 'sine';
    plink.frequency.setValueAtTime(420, now + 0.01);
    plink.frequency.exponentialRampToValueAtTime(920, now + 0.08);
    pg.gain.setValueAtTime(0.001, now + 0.01);
    pg.gain.linearRampToValueAtTime(0.08 * atten, now + 0.02);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    plink.connect(pg);
    pg.connect(dest);
    plink.start(now + 0.01);
    plink.stop(now + 0.12);
  }

  /** Plays sharp canvas/rubber pop for hot-air balloons & target balls. */
  public playBalloonPop(distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 220) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.18, 1 - distanceMeters / 220);
    const dest = this.getSfxDestination(ctx);

    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(240, now);
    thump.frequency.exponentialRampToValueAtTime(52, now + 0.11);
    tg.gain.setValueAtTime(0.001, now);
    tg.gain.linearRampToValueAtTime(0.32 * atten, now + 0.004);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    thump.connect(tg);
    tg.connect(dest);
    thump.start(now);
    thump.stop(now + 0.14);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1200, now);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.28 * atten, now + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(dest);
    src.start(now);
    src.stop(now + 0.18);
  }

  /** Plays authentic electric spark & short-circuit audio from uploaded spark clip with procedural crackle fallback. */
  public playElectricSpark(shattered = false, distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 110) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const atten = Math.max(0.18, 1 - distanceMeters / 110);
    const sparkBuf = this.getSample('electric_spark');
    if (sparkBuf) {
      const idx = this.nextCursor('electric_spark_slice', 3);
      const startFrac = [0.08, 0.34, 0.58][idx] ?? 0.08;
      const offset = Math.min(Math.max(0, sparkBuf.duration - 0.8), sparkBuf.duration * startFrac);
      const dur = Math.min(shattered ? 1.15 : 0.72, Math.max(0.25, sparkBuf.duration - offset));
      const rate = shattered ? 0.96 : 1.06 + (idx % 2) * 0.08;
      this.playBufferClip(ctx, sparkBuf, offset, dur, (shattered ? 0.88 : 0.72) * atten, rate, 0.004, 0.1);
      return;
    }

    // Procedural high-voltage electric arc zap fallback while buffer decodes
    if (!this.noiseBuffer) return;
    const now = ctx.currentTime;
    const dest = this.getSfxDestination(ctx);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3800, now);
    bp.Q.value = 1.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime((shattered ? 0.32 : 0.22) * atten, now + 0.005);
    ng.gain.exponentialRampToValueAtTime(0.001, now + (shattered ? 0.42 : 0.22));
    src.connect(bp);
    bp.connect(ng);
    ng.connect(dest);
    src.start(now);
    src.stop(now + 0.44);

    const buzz = ctx.createOscillator();
    const bg = ctx.createGain();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(120, now);
    buzz.frequency.linearRampToValueAtTime(240, now + 0.09);
    bg.gain.setValueAtTime(0.001, now);
    bg.gain.linearRampToValueAtTime(0.14 * atten, now + 0.008);
    bg.gain.exponentialRampToValueAtTime(0.001, now + (shattered ? 0.34 : 0.18));
    buzz.connect(bg);
    bg.connect(dest);
    buzz.start(now);
    buzz.stop(now + 0.36);
  }

  /** Plays digital LCD crackle + glass fracture + electric spark when hitting screens. */
  public playScreenGlitch(shattered = false, distanceMeters = 0) {
    this.playGlassShatter(!shattered, distanceMeters);
    this.playElectricSpark(shattered, distanceMeters);
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 110) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.16, 1 - distanceMeters / 110);
    const dest = this.getSfxDestination(ctx);

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(shattered ? 960 : 1480, now);
    osc.frequency.setValueAtTime(320, now + 0.035);
    osc.frequency.setValueAtTime(shattered ? 110 : 740, now + 0.07);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14 * atten, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + (shattered ? 0.24 : 0.14));
    osc.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + (shattered ? 0.26 : 0.16));
  }

  /** Plays hollow metallic clang when a vehicle tips over a red barrel. */
  public playBarrelTip(distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 80) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.2, 1 - distanceMeters / 80);
    const dest = this.getSfxDestination(ctx);

    [210, 345].forEach((hz, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hz, now + idx * 0.02);
      osc.frequency.exponentialRampToValueAtTime(hz * 0.62, now + 0.22);
      g.gain.setValueAtTime(0.001, now + idx * 0.02);
      g.gain.linearRampToValueAtTime(0.16 * atten, now + idx * 0.02 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(g);
      g.connect(dest);
      osc.start(now + idx * 0.02);
      osc.stop(now + 0.28);
    });
  }

  /** Plays rapid whoosh when spilled gasoline ignites. */
  public playGasolineIgnite(distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 95) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.18, 1 - distanceMeters / 95);
    const dest = this.getSfxDestination(ctx);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.setValueAtTime(480, now);
    lp.frequency.exponentialRampToValueAtTime(1600, now + 0.14);
    lp.frequency.exponentialRampToValueAtTime(320, now + 0.55);
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28 * atten, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    src.connect(lp);
    lp.connect(g);
    g.connect(dest);
    src.start(now);
    src.stop(now + 0.62);
  }

  public playWoodImpact(distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 70) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.2, 1 - distanceMeters / 70);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.065);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16 * atten, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playSandImpact(distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 70) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.2, 1 - distanceMeters / 70);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(680, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16 * atten, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.getSfxDestination(ctx));
    src.start(now);
    src.stop(now + 0.16);
  }

  public playBallBounce(distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 65) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.18, 1 - distanceMeters / 65);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.085);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18 * atten, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playCarRemoteChirp(unlock: boolean, flashOnly = false) {
    if (this._muted || this._sfxVolume <= 0.02) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const beepBuf = this.getSample('car_remote_beep');
    if (beepBuf) {
      const dur = flashOnly ? Math.min(1.4, beepBuf.duration) : unlock ? Math.min(0.75, beepBuf.duration) : Math.min(0.55, beepBuf.duration);
      this.playBufferClip(ctx, beepBuf, 0.0, dur, 0.62, unlock || flashOnly ? 1.0 : 0.94, 0.004, 0.04);
      return;
    }
    const now = ctx.currentTime;
    const notes = flashOnly ? [1320, 1320, 1320] : unlock ? [1480, 1980] : [1380];
    notes.forEach((hz, idx) => {
      const t0 = now + idx * 0.095;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
      osc.connect(g);
      g.connect(this.getSfxDestination(ctx));
      osc.start(t0);
      osc.stop(t0 + 0.075);
    });
  }

  public playWindowMotor() {
    if (this._muted || this._sfxVolume <= 0.02) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(340, now + 0.24);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.075, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(g);
    g.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playEngineCrankStart(vehicleKind?: boolean | string) {
    if (this._muted || this._sfxVolume <= 0.02) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const crankBuf = this.getSample('car_engine_start');
    if (crankBuf) {
      const rate = vehicleKind === 'apex_heli' ? 0.92 : 1.0;
      this.playBufferClip(ctx, crankBuf, 0.0, Math.min(1.6, crankBuf.duration), 0.65, rate, 0.015, 0.18);
      return;
    }
    const now = ctx.currentTime;
    const crank = ctx.createOscillator();
    const cg = ctx.createGain();
    crank.type = 'sawtooth';
    crank.frequency.setValueAtTime(72, now);
    crank.frequency.exponentialRampToValueAtTime(195, now + 0.36);
    cg.gain.setValueAtTime(0.001, now);
    cg.gain.linearRampToValueAtTime(0.18, now + 0.05);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    crank.connect(cg);
    cg.connect(this.getSfxDestination(ctx));
    crank.start(now);
    crank.stop(now + 0.45);
  }

  /** Plays luxury exhaust silencer crackle & backfire pop scaled smoothly by speed and distance. */
  public playExhaustBackfire(speedKmh = 60, distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 65) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastBackfireSfxTime < 420) return;
    this.lastBackfireSfxTime = nowPerf;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const atten = Math.max(0.18, 1 - distanceMeters / 65);
    const kitBuf = this.getSample('car_backfire_kit');
    if (kitBuf) {
      const idx = this.nextCursor('backfire_pop', 4);
      const starts = [0.2, 1.65, 3.4, 5.1];
      const off = starts[idx] % Math.max(0.4, kitBuf.duration - 0.9);
      const pitch = speedKmh >= 115 ? 1.12 : speedKmh >= 65 ? 1.04 : 0.96;
      this.playBufferClip(ctx, kitBuf, off, 0.62, 0.48 * atten, pitch, 0.006, 0.12);
      return;
    }
    this.playWaterSplash(0.55, distanceMeters);
  }

  /** Plays subtle pool swim arm-stroke water splash. */
  public playSwimStroke(sprint = false) {
    this.playWaterSplash(sprint ? 0.72 : 0.52, 0);
  }

  private partyMusicSource: AudioBufferSourceNode | null = null;
  private partyMusicGain: GainNode | null = null;
  private partyTrackIdx = 0;

  /**
   * Streams 3F Mansion Club DJ music (`party_dj_music_1.mp3` -> `party_dj_music_2.mp3`)
   * continuously without trimming, with smooth 3D spatial distance attenuation from the 3rd floor DJ stage.
   */
  public updateMansionPartyMusic(playerX: number, playerY: number, playerZ: number) {
    if (this._muted || this._sfxVolume <= 0.02 || this._musicVolume <= 0.01) {
      if (this.partyMusicSource) this.stopMansionPartyMusic();
      return;
    }
    // 3rd floor DJ club booth sits around (0, 11.6, -356)
    const dx = playerX - 0;
    const dy = (playerY - 11.6) * 3.0;
    const dz = playerZ - -356;
    const dist = Math.hypot(dx, dy, dz);
    const maxHearingDist = 54;

    if (dist > maxHearingDist) {
      if (this.partyMusicGain && this.ctx) {
        this.partyMusicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.18);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    const targetGain =
      Math.max(0.02, Math.pow(Math.max(0, 1 - dist / maxHearingDist), 1.35)) *
      0.52 *
      this._musicVolume;

    if (!this.partyMusicGain) {
      this.partyMusicGain = ctx.createGain();
      this.partyMusicGain.gain.value = 0.0001;
      this.partyMusicGain.connect(this.getSfxDestination(ctx));
    }
    this.partyMusicGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.16);

    if (!this.partyMusicSource) {
      const tracks: SampleKey[] = ['party_dj_1', 'party_dj_2'];
      const primaryKey = tracks[this.partyTrackIdx % tracks.length];
      const fallbackKey = tracks[stepDjTrackIndex(this.partyTrackIdx, tracks.length)];
      const buf = this.getSample(primaryKey) ?? this.getSample(fallbackKey);
      if (buf && this.partyMusicGain) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.partyMusicGain);
        src.onended = () => {
          if (this.partyMusicSource === src) {
            this.partyMusicSource = null;
            this.partyTrackIdx = stepDjTrackIndex(this.partyTrackIdx, tracks.length);
          }
        };
        src.start(ctx.currentTime);
        this.partyMusicSource = src;
      }
    }
  }

  public stopMansionPartyMusic() {
    const src = this.partyMusicSource;
    this.partyMusicSource = null;
    if (src) {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    }
    if (this.partyMusicGain && this.ctx) {
      try {
        this.partyMusicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      } catch {
        // ignore
      }
    }
  }

  public playMetallicImpact(material: 'metal' | 'glass' | 'composite' | 'rubber' = 'metal', distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 90) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.16, 1 - distanceMeters / 90);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = material === 'glass' ? 'sine' : material === 'rubber' ? 'triangle' : 'square';
    const baseFreq = material === 'glass' ? 1850 : material === 'rubber' ? 160 : material === 'composite' ? 420 : 780 + Math.random() * 240;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.35, now + 0.085);
    g.gain.setValueAtTime(0.2 * atten, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(g);
    g.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.1);
  }


  public playPartSnap(distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 90) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.18, 1 - distanceMeters / 90);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.18);
    g.gain.setValueAtTime(0.28 * atten, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g);
    g.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playDroneCrash(distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 120) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.2, 1 - distanceMeters / 120);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.36);
    g.gain.setValueAtTime(0.35 * atten, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(g);
    g.connect(this.getSfxDestination(ctx));
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playGateChime(opening = true, distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02 || distanceMeters > 80) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const atten = Math.max(0.18, 1 - distanceMeters / 80);
    const freqs = opening ? [523.25, 659.25] : [659.25, 440];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      g.gain.setValueAtTime(0.001, now + idx * 0.08);
      g.gain.linearRampToValueAtTime(0.14 * atten, now + idx * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);
      osc.connect(g);
      g.connect(this.getSfxDestination(ctx));
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.24);
    });
  }

  public playRepairWeld(_distanceMeters = 0) {
    if (this._muted || this._sfxVolume <= 0.02) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      g.gain.setValueAtTime(0.14, now + idx * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
      osc.connect(g);
      g.connect(this.getSfxDestination(ctx));
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.24);
    });
  }
}

export const soundEngine = new TacticalAudioEngine();
