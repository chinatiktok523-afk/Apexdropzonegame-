import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GraphicsQuality, OperatorSkinId, WEAPON_ORDER, WeaponId, WeaponSkinId } from '../types';
import { createOrganicBoulderGeometry, fbm2D, ridged2D } from './realisticWorld';
import { overlapsMansionHorizonCorridor } from './mansionSystems';
import { ProceduralTextureSet } from './textures';

export interface MaterialLibrary {
  gunReceiver: THREE.MeshStandardMaterial;
  gunBarrel: THREE.MeshStandardMaterial;
  gunPolymer: THREE.MeshStandardMaterial;
  gunCrimson: THREE.MeshStandardMaterial;
  gunWhite: THREE.MeshStandardMaterial;
  gunBronze: THREE.MeshStandardMaterial;
  gunTan: THREE.MeshStandardMaterial;
  gunOliveGreen: THREE.MeshStandardMaterial;
  gunStainless: THREE.MeshStandardMaterial;
  gunWood: THREE.MeshStandardMaterial;
  gunTranslucentMag: THREE.MeshStandardMaterial;
  gunOpticGlass: THREE.MeshStandardMaterial;
  gunReticle: THREE.MeshBasicMaterial;
  packShellWhite: THREE.MeshStandardMaterial;
  packOrangeGlow: THREE.MeshStandardMaterial;
  armorOlive: THREE.MeshStandardMaterial;
  armorDark: THREE.MeshStandardMaterial;
  armorHeavy: THREE.MeshStandardMaterial;
  armorBeat: THREE.MeshStandardMaterial;
  skinTone: THREE.MeshStandardMaterial;
  skinHero: THREE.MeshStandardMaterial;
  hairHero: THREE.MeshStandardMaterial;
  jacketBlack: THREE.MeshStandardMaterial;
  crimsonAccent: THREE.MeshStandardMaterial;
  silverBuckle: THREE.MeshStandardMaterial;
  sneakerWhite: THREE.MeshStandardMaterial;
  wolfChestMat: THREE.MeshStandardMaterial;
  wolfBackMat: THREE.MeshStandardMaterial;
  maskCrestMat: THREE.MeshStandardMaterial;
  sleeveGraphicMat: THREE.MeshStandardMaterial;
  heroBduMat: THREE.MeshStandardMaterial;
  heroArmorMat: THREE.MeshStandardMaterial;
  heroAccentMat: THREE.MeshStandardMaterial;
  heroPackMat: THREE.MeshStandardMaterial;
  heroVisorMat: THREE.MeshStandardMaterial;
  visorEnemy: THREE.MeshStandardMaterial;
  visorPlayer: THREE.MeshStandardMaterial;
  visorBeat: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  courtyardMat: THREE.MeshStandardMaterial;
  woodPlankMat: THREE.MeshStandardMaterial;
  hazardStripeMat: THREE.MeshStandardMaterial;
  containerMaterials: THREE.MeshStandardMaterial[];
  crateMat: THREE.MeshStandardMaterial;
  steelTrim: THREE.MeshStandardMaterial;
  woodTrunk: THREE.MeshStandardMaterial;
  pineFoliage: THREE.MeshStandardMaterial;
  rockMat: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  sharedSet: Set<THREE.Material>;
  dispose: () => void;
}

/**
 * Recursively disposes every unique BufferGeometry (and any non-shared Material)
 * inside an Object3D subtree so WebGL VRAM does not leak across restarts or dead enemies.
 */
export function disposeObject3DResources(
  root: THREE.Object3D,
  protectedMaterials?: Set<THREE.Material>,
) {
  const disposedGeos = new Set<THREE.BufferGeometry>();
  const disposedMats = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
      disposedGeos.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const rawMat = mesh.material;
    if (rawMat) {
      const matList = Array.isArray(rawMat) ? rawMat : [rawMat];
      for (let i = 0; i < matList.length; i++) {
        const m = matList[i];
        if (!m || disposedMats.has(m) || protectedMaterials?.has(m)) continue;
        disposedMats.add(m);
        m.dispose();
      }
    }
  });
}

export function createMaterialLibrary(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
  quality: GraphicsQuality = 'medium',
): MaterialLibrary {
  const all: THREE.Material[] = [];
  const sharedSet = new Set<THREE.Material>();
  const reg = <T extends THREE.Material>(m: T): T => {
    all.push(m);
    sharedSet.add(m);
    return m;
  };
  const useHighShaders = quality === 'high' && !isSoftwareGl;

  const extraTextures: THREE.Texture[] = [];
  const makeCanvasTex = (size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (ctx) draw(ctx, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    extraTextures.push(tex);
    return tex;
  };

  const drawWolfHead = (ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number, r: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(r / 50, r / 50);
    // Stylized fierce geometric wolf head facing left
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-42, -6);
    ctx.lineTo(-18, -16);
    ctx.lineTo(-2, -38); // ear
    ctx.lineTo(10, -24);
    ctx.lineTo(24, -36); // back ear
    ctx.lineTo(30, -10);
    ctx.lineTo(42, 4);
    ctx.lineTo(24, 16);
    ctx.lineTo(34, 30);
    ctx.lineTo(8, 36);
    ctx.lineTo(-6, 22);
    ctx.lineTo(-24, 24);
    ctx.lineTo(-14, 10);
    ctx.lineTo(-34, 8);
    ctx.lineTo(-42, -6);
    ctx.closePath();
    ctx.fill();
    // Fierce crimson eye
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(0, -12);
    ctx.lineTo(-4, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const wolfChestTex = makeCanvasTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    drawWolfHead(ctx, s, s * 0.5, s * 0.52, s * 0.42);
  });

  const wolfBackTex = makeCanvasTex(256, (ctx, s) => {
    ctx.fillStyle = '#14161c';
    ctx.fillRect(0, 0, s, s);
    // Crimson claw slashes behind wolf crest (matching back-view photo)
    ctx.strokeStyle = '#dc1e28';
    ctx.lineCap = 'round';
    [
      [42, 210, 185, 68, 12],
      [76, 232, 220, 96, 15],
      [114, 238, 228, 140, 10],
    ].forEach(([x1, y1, x2, y2, lw]) => {
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });
    drawWolfHead(ctx, s, s * 0.5, s * 0.44, s * 0.34);
  });

  const maskCrestTex = makeCanvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#111318';
    ctx.fillRect(0, 0, s, s);
    // Crimson diamond/fang crest centered on mask (matching front-view photo)
    ctx.fillStyle = '#e11d2a';
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.16);
    ctx.lineTo(s * 0.68, s * 0.44);
    ctx.lineTo(s * 0.56, s * 0.84);
    ctx.lineTo(s * 0.5, s * 0.68);
    ctx.lineTo(s * 0.44, s * 0.84);
    ctx.lineTo(s * 0.32, s * 0.44);
    ctx.closePath();
    ctx.fill();
  });

  const sleeveGraphicTex = makeCanvasTex(128, (ctx, s) => {
    ctx.fillStyle = '#14161c';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(16, 36);
    ctx.lineTo(64, 18);
    ctx.lineTo(112, 36);
    ctx.moveTo(20, 74);
    ctx.lineTo(64, 56);
    ctx.lineTo(108, 74);
    ctx.moveTo(28, 108);
    ctx.lineTo(64, 92);
    ctx.lineTo(100, 108);
    ctx.stroke();
  });

  const gunCrimson: THREE.MeshStandardMaterial = reg(
    new THREE.MeshStandardMaterial({
      color: 0xdc1e28,
      metalness: useHighShaders ? 0.58 : 0.55,
      roughness: useHighShaders ? 0.24 : 0.28,
    }),
  );

  const gunWhite: THREE.MeshStandardMaterial = reg(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: useHighShaders ? 0.32 : 0.28,
      roughness: useHighShaders ? 0.26 : 0.32,
    }),
  );

  const gunReceiver: THREE.MeshStandardMaterial = reg(
    new THREE.MeshStandardMaterial({
      color: 0x262a30,
      map: textures.brushedMetal,
      metalness: useHighShaders ? 0.86 : 0.82,
      roughness: useHighShaders ? 0.28 : 0.32,
    }),
  );

  const gunBarrel = reg(
    new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      metalness: 0.92,
      roughness: 0.22,
    }),
  );

  const gunPolymer = reg(
    new THREE.MeshStandardMaterial({
      color: 0x2d3138,
      metalness: 0.1,
      roughness: 0.78,
    }),
  );

  const gunOpticGlass: THREE.MeshStandardMaterial = reg(
    new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      metalness: 0.25,
      roughness: useHighShaders ? 0.08 : 0.1,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    }),
  );

  const gunBronze = reg(
    new THREE.MeshStandardMaterial({
      color: 0x826c56,
      metalness: 0.72,
      roughness: 0.32,
    }),
  );

  const gunTan = reg(
    new THREE.MeshStandardMaterial({
      color: 0xc5a373,
      metalness: 0.4,
      roughness: 0.45,
    }),
  );

  const gunOliveGreen = reg(
    new THREE.MeshStandardMaterial({
      color: 0x4c583c,
      metalness: 0.28,
      roughness: 0.56,
    }),
  );

  const gunStainless = reg(
    new THREE.MeshStandardMaterial({
      color: 0xbac4ce,
      metalness: 0.9,
      roughness: 0.22,
    }),
  );

  const gunWood = reg(
    new THREE.MeshStandardMaterial({
      color: 0xb95f2b,
      map: textures.woodWalnut,
      metalness: 0.08,
      roughness: 0.42,
    }),
  );

  const gunTranslucentMag = reg(
    new THREE.MeshStandardMaterial({
      color: 0x574632,
      metalness: 0.14,
      roughness: 0.24,
      transparent: true,
      opacity: 0.78,
    }),
  );

  const gunReticle = reg(
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
    }),
  );

  const packShellWhite = reg(
    new THREE.MeshStandardMaterial({
      color: 0xdbe3ec,
      metalness: 0.42,
      roughness: 0.26,
    }),
  );

  const packOrangeGlow = reg(
    new THREE.MeshStandardMaterial({
      color: 0xff6a00,
      emissive: 0xff5200,
      emissiveIntensity: 1.45,
      metalness: 0.2,
      roughness: 0.28,
    }),
  );

  const armorOlive = reg(
    new THREE.MeshStandardMaterial({
      color: 0x4b563c,
      roughness: 0.76,
      metalness: 0.12,
    }),
  );

  const armorDark = reg(
    new THREE.MeshStandardMaterial({
      color: 0x242830,
      roughness: 0.65,
      metalness: 0.28,
    }),
  );

  const armorHeavy = reg(
    new THREE.MeshStandardMaterial({
      color: 0x5c2b26,
      roughness: 0.48,
      metalness: 0.45,
    }),
  );

  const armorBeat = reg(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.65,
    }),
  );

  const skinTone = reg(
    new THREE.MeshStandardMaterial({
      color: 0x8d6e5a,
      roughness: 0.85,
      metalness: 0.0,
    }),
  );

  const skinHero = reg(
    new THREE.MeshStandardMaterial({
      color: 0xd9a88e,
      roughness: 0.68,
      metalness: 0.02,
    }),
  );

  const hairHero = reg(
    new THREE.MeshStandardMaterial({
      color: 0x3b2216,
      roughness: 0.82,
      metalness: 0.04,
    }),
  );

  const jacketBlack = reg(
    new THREE.MeshStandardMaterial({
      color: 0x13151b,
      roughness: 0.62,
      metalness: 0.12,
    }),
  );

  const crimsonAccent = reg(
    new THREE.MeshStandardMaterial({
      color: 0xdc1e28,
      roughness: 0.42,
      metalness: 0.18,
    }),
  );

  const silverBuckle = reg(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.22,
      metalness: 0.88,
    }),
  );

  const sneakerWhite = reg(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.5,
      metalness: 0.05,
    }),
  );

  const wolfChestMat = reg(
    new THREE.MeshStandardMaterial({
      map: wolfChestTex,
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.5,
      metalness: 0.05,
    }),
  );

  const wolfBackMat = reg(
    new THREE.MeshStandardMaterial({
      map: wolfBackTex,
      roughness: 0.58,
      metalness: 0.1,
    }),
  );

  const maskCrestMat = reg(
    new THREE.MeshStandardMaterial({
      map: maskCrestTex,
      roughness: 0.55,
      metalness: 0.12,
    }),
  );

  const sleeveGraphicMat = reg(
    new THREE.MeshStandardMaterial({
      map: sleeveGraphicTex,
      roughness: 0.58,
      metalness: 0.08,
    }),
  );

  const heroBduMat = reg(
    new THREE.MeshStandardMaterial({
      color: 0x1c2028,
      roughness: 0.78,
      metalness: 0.08,
    }),
  );

  const heroArmorMat = reg(
    new THREE.MeshStandardMaterial({
      color: 0x262b34,
      roughness: 0.54,
      metalness: 0.28,
    }),
  );

  const heroAccentMat = reg(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.44,
      metalness: 0.18,
    }),
  );

  const heroPackMat = reg(
    new THREE.MeshStandardMaterial({
      color: 0x171b22,
      roughness: 0.74,
      metalness: 0.12,
    }),
  );

  const heroVisorMat = reg(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.15,
      metalness: 0.85,
    }),
  );

  const visorEnemy = reg(
    new THREE.MeshStandardMaterial({
      color: 0xff5a1f,
      emissive: 0xd9380f,
      emissiveIntensity: 0.8,
      roughness: 0.15,
      metalness: 0.85,
    }),
  );

  const visorPlayer = reg(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.85,
    }),
  );

  const visorBeat = reg(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.2,
      roughness: 0.15,
      metalness: 0.85,
    }),
  );

  const concrete = reg(
    new THREE.MeshStandardMaterial({
      map: textures.concreteAlbedo,
      ...(textures.concreteBump ? { bumpMap: textures.concreteBump, bumpScale: 0.04 } : {}),
      roughness: 0.88,
      metalness: 0.04,
    }),
  );

  const courtyardMat = reg(
    new THREE.MeshStandardMaterial({
      map: textures.courtyardConcrete,
      ...(textures.concreteBump ? { bumpMap: textures.concreteBump, bumpScale: 0.025 } : {}),
      roughness: 0.86,
      metalness: 0.03,
    }),
  );

  const woodPlankMat = reg(
    new THREE.MeshStandardMaterial({
      map: textures.woodPlank,
      roughness: 0.82,
      metalness: 0.04,
    }),
  );

  const hazardStripeMat = reg(
    new THREE.MeshStandardMaterial({
      map: textures.hazardStripe,
      roughness: 0.52,
      metalness: 0.25,
    }),
  );

  const containerMaterials = [
    textures.containerRed,
    textures.containerOlive,
    textures.containerNavy,
    textures.containerTeal,
  ].map((map) =>
    reg(
      new THREE.MeshStandardMaterial({
        map,
        ...(textures.containerBump ? { bumpMap: textures.containerBump, bumpScale: 0.08 } : {}),
        roughness: 0.62,
        metalness: 0.38,
      }),
    ),
  );

  const crateMat = reg(
    new THREE.MeshStandardMaterial({
      map: textures.woodCrate,
      roughness: 0.78,
      metalness: 0.08,
    }),
  );

  const steelTrim = reg(
    new THREE.MeshStandardMaterial({
      color: 0x374151,
      roughness: 0.4,
      metalness: 0.82,
    }),
  );

  const woodTrunk = reg(
    new THREE.MeshStandardMaterial({
      color: 0x4b3624,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );

  const pineFoliage = reg(
    new THREE.MeshStandardMaterial({
      color: 0x2f4d2d,
      roughness: 0.85,
      metalness: 0.0,
    }),
  );

  const rockMat = reg(
    new THREE.MeshStandardMaterial({
      color: 0x8b8d8a,
      map: textures.rockAlbedo,
      ...(textures.concreteBump ? { bumpMap: textures.concreteBump, bumpScale: 0.05 } : {}),
      roughness: 0.9,
      metalness: 0.04,
    }),
  );

  const contactShadowMat = reg(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );

  return {
    gunReceiver,
    gunBarrel,
    gunPolymer,
    gunCrimson,
    gunWhite,
    gunBronze,
    gunTan,
    gunOliveGreen,
    gunStainless,
    gunWood,
    gunTranslucentMag,
    gunOpticGlass,
    gunReticle,
    packShellWhite,
    packOrangeGlow,
    armorOlive,
    armorDark,
    armorHeavy,
    armorBeat,
    skinTone,
    skinHero,
    hairHero,
    jacketBlack,
    crimsonAccent,
    silverBuckle,
    sneakerWhite,
    wolfChestMat,
    wolfBackMat,
    maskCrestMat,
    sleeveGraphicMat,
    heroBduMat,
    heroArmorMat,
    heroAccentMat,
    heroPackMat,
    heroVisorMat,
    visorEnemy,
    visorPlayer,
    visorBeat,
    concrete,
    courtyardMat,
    woodPlankMat,
    hazardStripeMat,
    containerMaterials,
    crateMat,
    steelTrim,
    woodTrunk,
    pineFoliage,
    rockMat,
    contactShadowMat,
    sharedSet,
    dispose: () => {
      all.forEach((m) => m.dispose());
      extraTextures.forEach((t) => t.dispose());
    },
  };
}

export function applyOperatorSkin(mats: MaterialLibrary, skin: OperatorSkinId) {
  if (skin === 'desert_recon') {
    mats.heroBduMat.color.setHex(0x9c8360);
    mats.heroArmorMat.color.setHex(0x5b4b38);
    mats.heroAccentMat.color.setHex(0xd97706);
    mats.heroPackMat.color.setHex(0x6e5a41);
    mats.heroVisorMat.color.setHex(0xfbbf24);
    mats.heroVisorMat.emissive.setHex(0xb45309);
  } else if (skin === 'ranger_olive') {
    mats.heroBduMat.color.setHex(0x3f4f36);
    mats.heroArmorMat.color.setHex(0x283224);
    mats.heroAccentMat.color.setHex(0x65a30d);
    mats.heroPackMat.color.setHex(0x303b2a);
    mats.heroVisorMat.color.setHex(0x34d399);
    mats.heroVisorMat.emissive.setHex(0x047857);
  } else if (skin === 'night_ops') {
    mats.heroBduMat.color.setHex(0x1e293b);
    mats.heroArmorMat.color.setHex(0x0f172a);
    mats.heroAccentMat.color.setHex(0x0ea5e9);
    mats.heroPackMat.color.setHex(0x131c2e);
    mats.heroVisorMat.color.setHex(0x22d3ee);
    mats.heroVisorMat.emissive.setHex(0x0284c7);
  } else {
    // wolf_black (Crimson Vanguard)
    mats.heroBduMat.color.setHex(0x1c2028);
    mats.heroArmorMat.color.setHex(0x262b34);
    mats.heroAccentMat.color.setHex(0xdc2626);
    mats.heroPackMat.color.setHex(0x171b22);
    mats.heroVisorMat.color.setHex(0x38bdf8);
    mats.heroVisorMat.emissive.setHex(0x0284c7);
  }
}

export function applyWeaponSkin(mats: MaterialLibrary, skin: WeaponSkinId) {
  if (skin === 'crimson') {
    mats.gunCrimson.color.setHex(0xdc1e28);
    mats.gunWhite.color.setHex(0x1e222a);
    mats.gunReceiver.color.setHex(0x381920);
    mats.gunBronze.color.setHex(0x88242c);
    mats.gunTan.color.setHex(0x99262e);
    mats.gunOliveGreen.color.setHex(0x7c1d24);
    mats.gunStainless.color.setHex(0xcbd5e1);
  } else if (skin === 'desert') {
    mats.gunCrimson.color.setHex(0xb45309);
    mats.gunWhite.color.setHex(0xc29b61);
    mats.gunReceiver.color.setHex(0x4a3e2e);
    mats.gunBronze.color.setHex(0x9a7852);
    mats.gunTan.color.setHex(0xc7a36e);
    mats.gunOliveGreen.color.setHex(0x786c48);
    mats.gunStainless.color.setHex(0xd4be98);
  } else if (skin === 'carbon') {
    mats.gunCrimson.color.setHex(0x27272a);
    mats.gunWhite.color.setHex(0x3f3f46);
    mats.gunReceiver.color.setHex(0x18181b);
    mats.gunBronze.color.setHex(0x2d3036);
    mats.gunTan.color.setHex(0x33373f);
    mats.gunOliveGreen.color.setHex(0x23272e);
    mats.gunStainless.color.setHex(0x525866);
  } else if (skin === 'arctic') {
    mats.gunCrimson.color.setHex(0x0284c7);
    mats.gunWhite.color.setHex(0xf1f5f9);
    mats.gunReceiver.color.setHex(0x475569);
    mats.gunBronze.color.setHex(0xd6dee6);
    mats.gunTan.color.setHex(0xe2e8f0);
    mats.gunOliveGreen.color.setHex(0x94a3b8);
    mats.gunStainless.color.setHex(0xf8fafc);
  } else {
    // standard (matches reference weapons)
    mats.gunCrimson.color.setHex(0xdc1e28);
    mats.gunWhite.color.setHex(0xf1f5f9);
    mats.gunReceiver.color.setHex(0x262a30);
    mats.gunBronze.color.setHex(0x826c56);
    mats.gunTan.color.setHex(0xc5a373);
    mats.gunOliveGreen.color.setHex(0x4c583c);
    mats.gunStainless.color.setHex(0xbac4ce);
  }
}

export function buildGrenadePreviewModel(mats: MaterialLibrary): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 14), mats.armorOlive);
  body.scale.set(0.92, 1.15, 0.92);
  group.add(body);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.138, 0.042, 16), mats.heroAccentMat);
  group.add(band);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.06, 12), mats.steelTrim);
  neck.position.y = 0.16;
  group.add(neck);

  const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.18, 0.06), mats.steelTrim);
  spoon.position.set(0.088, 0.08, 0);
  spoon.rotation.z = -0.18;
  group.add(spoon);

  const pin = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 8, 16), mats.silverBuckle);
  pin.position.set(-0.072, 0.175, 0);
  group.add(pin);

  return group;
}

export interface WeaponViewModel {
  group: THREE.Group;
  muzzlePoint: THREE.Object3D;
  ejectPoint: THREE.Object3D;
  magGroup: THREE.Group;
  boltMesh: THREE.Object3D;
  pumpMesh?: THREE.Object3D;
  muzzleFlashGroup: THREE.Group;
  loadedWarhead?: THREE.Object3D;
}

function createMuzzleFlashStar(colorHex = 0xffbe3b): THREE.Group {
  const flashGroup = new THREE.Group();
  const flashMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), coreMat);
  core.scale.set(1, 1, 1.8);
  flashGroup.add(core);

  const finGeo = new THREE.ConeGeometry(0.032, 0.14, 4);
  const fwdCone = new THREE.Mesh(finGeo, flashMat);
  fwdCone.rotation.x = -Math.PI / 2;
  fwdCone.position.z = -0.07;
  flashGroup.add(fwdCone);

  for (let i = 0; i < 4; i++) {
    const petal = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.028), flashMat);
    const angle = (i * Math.PI) / 4;
    petal.rotation.z = angle;
    petal.position.z = -0.02;
    flashGroup.add(petal);
  }

  flashGroup.visible = false;
  return flashGroup;
}

/**
 * Detailed oiled-walnut & stamped-steel AK-47 rifle group (matching IMG_ec62e2ac reference)
 * for Convoy Security Guards, Police Escorts & world rifle props.
 */
export function buildAk47RifleGroup(mats: MaterialLibrary): THREE.Group {
  const ak = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.068, 0.27), mats.gunReceiver);
  receiver.position.set(0, 0.01, 0);
  const dustCover = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.24, 10, 1, false, -Math.PI * 0.5, Math.PI), mats.gunBarrel);
  dustCover.rotation.x = Math.PI / 2;
  dustCover.position.set(0, 0.042, 0.01);
  const handguardWood = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.046, 0.19), mats.gunWood);
  handguardWood.position.set(0, 0.014, -0.22);
  const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 8), mats.gunBarrel);
  gasTube.rotation.x = Math.PI / 2;
  gasTube.position.set(0, 0.036, -0.22);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.36, 10), mats.gunBarrel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, -0.44);
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.044, 0.028), mats.gunBarrel);
  frontSight.position.set(0, 0.036, -0.58);
  const woodGrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.104, 0.042), mats.gunWood);
  woodGrip.position.set(0, -0.066, 0.088);
  woodGrip.rotation.x = 0.28;
  const underfoldStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6), mats.gunStainless);
  underfoldStrut.rotation.x = Math.PI / 2 + 0.12;
  underfoldStrut.position.set(0.022, -0.015, -0.14);
  // Curved banana 7.62mm magazine
  const magUpper = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.062), mats.gunReceiver);
  magUpper.position.set(0, -0.058, -0.068);
  magUpper.rotation.x = -0.18;
  const magLower = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.092, 0.06), mats.gunReceiver);
  magLower.position.set(0, -0.135, -0.095);
  magLower.rotation.x = -0.42;
  const stockWood = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.096, 0.22), mats.gunWood);
  stockWood.position.set(0, -0.012, 0.24);
  stockWood.rotation.x = -0.08;
  ak.add(receiver, dustCover, handguardWood, gasTube, barrel, frontSight, woodGrip, underfoldStrut, magUpper, magLower, stockWood);
  return ak;
}

/**
 * 15 Modern Reference-Matched Tactical Weapons: M17 Pistol, HK MP7, M4A1, HK416D, HK416C Breacher,
 * M27 IAR, M7 NGSW, XM8, M16A4, MK17 SCAR-H, SIG MCX, M249 SAW, M110A1 Sniper, M870 Pump, RPG-7V2.
 */
export function buildWeaponModel(weaponId: WeaponId, mats: MaterialLibrary): WeaponViewModel {
  const group = new THREE.Group();
  const muzzlePoint = new THREE.Object3D();
  const ejectPoint = new THREE.Object3D();
  const magGroup = new THREE.Group();
  group.add(magGroup);
  let boltMesh: THREE.Object3D = new THREE.Object3D();
  let pumpMesh: THREE.Object3D | undefined;
  let loadedWarhead: THREE.Object3D | undefined;

  if (weaponId === 'unarmed') {
    group.visible = false;
  } else if (weaponId === 'pistol') {
    // === M17 TACTICAL PISTOL (Coyote Tan frame + optic-ready slide + RMR + X300 light) ===
    const lowerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.21), mats.gunTan);
    lowerFrame.position.set(0, -0.004, -0.04);
    group.add(lowerFrame);

    const beavertail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.044), mats.gunTan);
    beavertail.position.set(0, 0.009, 0.068);
    group.add(beavertail);

    const slideGroup = new THREE.Group();
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.036, 0.228), mats.gunTan);
    slide.position.set(0, 0.024, -0.044);
    slideGroup.add(slide);

    const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.018, 0.042), mats.gunBarrel);
    chamber.position.set(0, 0.031, -0.034);
    slideGroup.add(chamber);

    const rmrHood = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.04), mats.gunBarrel);
    rmrHood.position.set(0, 0.054, 0.022);
    slideGroup.add(rmrHood);
    const rmrLens = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.017, 0.005), mats.gunOpticGlass);
    rmrLens.position.set(0, 0.056, 0.004);
    slideGroup.add(rmrLens);
    const rmrDot = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 6, 6), mats.gunReticle);
    rmrDot.position.set(0, 0.056, 0.01);
    slideGroup.add(rmrDot);

    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.011, 0.011), mats.gunReticle);
    frontSight.position.set(0, 0.048, -0.148);
    slideGroup.add(frontSight);

    group.add(slideGroup);
    boltMesh = slideGroup;

    const barrelTip = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.042, 10), mats.gunBarrel);
    barrelTip.rotation.x = Math.PI / 2;
    barrelTip.position.set(0, 0.022, -0.166);
    group.add(barrelTip);

    const lightBody = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.085, 10), mats.gunBarrel);
    lightBody.rotation.x = Math.PI / 2;
    lightBody.position.set(0, -0.026, -0.106);
    group.add(lightBody);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.106, 0.048), mats.gunTan);
    grip.position.set(0, -0.068, 0.036);
    grip.rotation.x = 0.28;
    group.add(grip);

    const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.098, 0.04), mats.gunBarrel);
    magBody.position.set(0, -0.074, 0.037);
    magBody.rotation.x = 0.28;
    magGroup.add(magBody);

    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.016, 0.048), mats.gunTan);
    magBase.position.set(0, -0.124, 0.05);
    magBase.rotation.x = 0.28;
    magGroup.add(magBase);

    muzzlePoint.position.set(0, 0.022, -0.195);
    ejectPoint.position.set(0.022, 0.03, -0.025);
  } else if (weaponId === 'smg') {
    // === HK MP7A2 PDW (Compact polymer chassis, retractable wire stock, grip-fed 40-rd mag, suppressor & micro red dot) ===
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.072, 0.34), mats.gunReceiver);
    chassis.position.set(0, 0.01, -0.06);
    group.add(chassis);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.34), mats.gunBarrel);
    topRail.position.set(0, 0.05, -0.06);
    group.add(topRail);

    const wireL = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.24, 6), mats.gunStainless);
    wireL.rotation.x = Math.PI / 2;
    wireL.position.set(-0.022, 0.014, 0.16);
    const wireR = wireL.clone();
    wireR.position.x = 0.022;
    group.add(wireL, wireR);

    const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.088, 0.022), mats.gunPolymer);
    buttPad.position.set(0, 0.0, 0.278);
    group.add(buttPad);

    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.145, 12), mats.gunBarrel);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.016, -0.302);
    group.add(suppressor);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.11, 0.044), mats.gunPolymer);
    grip.position.set(0, -0.068, 0.015);
    grip.rotation.x = 0.2;
    group.add(grip);

    const magExt = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.125, 0.034), mats.gunBarrel);
    magExt.position.set(0, -0.115, 0.026);
    magExt.rotation.x = 0.2;
    magGroup.add(magExt);

    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.072, 0.03), mats.gunPolymer);
    foregrip.position.set(0, -0.056, -0.175);
    foregrip.rotation.x = 0.1;
    group.add(foregrip);

    const microOptic = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.03, 0.054), mats.gunBarrel);
    microOptic.position.set(0, 0.07, -0.03);
    group.add(microOptic);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.07, -0.042);
    group.add(dot);

    const boltHandle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.028), mats.gunStainless);
    boltHandle.position.set(0.026, 0.026, 0.075);
    group.add(boltHandle);
    boltMesh = boltHandle;

    muzzlePoint.position.set(0, 0.016, -0.38);
    ejectPoint.position.set(0.026, 0.024, -0.01);
  } else if (weaponId === 'm4a1') {
    // === M4A1 SOPMOD CARBINE (matte receiver, KAC quad-rail, A2 front sight, VFG, PMAG, crane stock, Holo+Magnifier) ===
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.044, 0.26), mats.gunReceiver);
    lower.position.set(0, -0.012, 0.01);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.04, 0.26), mats.gunBarrel);
    upper.position.set(0, 0.024, 0.005);
    const quadRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.054, 0.24), mats.gunPolymer);
    quadRail.position.set(0, 0.014, -0.24);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.22, 10), mats.gunBarrel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.016, -0.45);
    const gasBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.045, 8), mats.gunStainless);
    gasBlock.rotation.x = Math.PI / 2;
    gasBlock.position.set(0, 0.022, -0.37);
    const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.052, 0.036), mats.gunBarrel);
    frontPost.position.set(0, 0.036, -0.38);
    const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.014, 0.058, 8), mats.gunStainless);
    flashHider.rotation.x = Math.PI / 2;
    flashHider.position.set(0, 0.016, -0.575);
    const vfg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.075, 10), mats.gunPolymer);
    vfg.position.set(0, -0.046, -0.25);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.105, 0.042), mats.gunPolymer);
    grip.position.set(0, -0.068, 0.085);
    grip.rotation.x = 0.28;
    const stockTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.19, 10), mats.gunBarrel);
    stockTube.rotation.x = Math.PI / 2;
    stockTube.position.set(0, 0.018, 0.215);
    const craneStock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.104, 0.175), mats.gunPolymer);
    craneStock.position.set(0, 0.0, 0.29);
    const topPicRail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.5), mats.gunStainless);
    topPicRail.position.set(0, 0.045, -0.12);
    group.add(lower, upper, quadRail, barrel, gasBlock, frontPost, flashHider, vfg, grip, stockTube, craneStock, topPicRail);

    const pmag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.145, 0.062), mats.gunPolymer);
    pmag.position.set(0, -0.095, -0.045);
    pmag.rotation.x = -0.14;
    magGroup.add(pmag);

    const holo = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.068), mats.gunBarrel);
    holo.position.set(0, 0.066, -0.06);
    const holoGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.024), mats.gunOpticGlass);
    holoGlass.position.set(0, 0.068, -0.092);
    const magOptic = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.082, 10), mats.gunBarrel);
    magOptic.rotation.x = Math.PI / 2;
    magOptic.position.set(0, 0.068, 0.04);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.068, -0.072);
    group.add(holo, holoGlass, magOptic, dot);

    const boltHandle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.035), mats.gunStainless);
    boltHandle.position.set(0.027, 0.024, -0.005);
    group.add(boltHandle);
    boltMesh = boltHandle;

    muzzlePoint.position.set(0, 0.016, -0.605);
    ejectPoint.position.set(0.032, 0.024, -0.01);
  } else if (weaponId === 'hk416') {
    // === HK416D TACTICAL RIFLE (taller piston upper, quad rail, PEQ-15 laser, ACOG + RMR, suppressor, bronze/dark accents) ===
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.074, 0.27), mats.gunReceiver);
    receiver.position.set(0, 0.01, 0);
    const quadRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.058, 0.26), mats.gunBarrel);
    quadRail.position.set(0, 0.016, -0.255);
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12), mats.gunBronze);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.016, -0.465);
    const peq = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.024, 0.076), mats.gunTan);
    peq.position.set(0, 0.064, -0.285);
    const vfg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.076, 10), mats.gunPolymer);
    vfg.position.set(0, -0.046, -0.24);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.106, 0.044), mats.gunPolymer);
    grip.position.set(0, -0.07, 0.082);
    grip.rotation.x = 0.28;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.108, 0.21), mats.gunPolymer);
    stock.position.set(0, 0.0, 0.26);
    const acog = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.135, 12), mats.gunBarrel);
    acog.rotation.x = Math.PI / 2;
    acog.position.set(0, 0.074, 0.01);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.074, -0.04);
    group.add(receiver, quadRail, suppressor, peq, vfg, grip, stock, acog, dot);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.142, 0.06), mats.gunBarrel);
    mag.position.set(0, -0.095, -0.042);
    mag.rotation.x = -0.14;
    magGroup.add(mag);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.035), mats.gunStainless);
    bolt.position.set(0.027, 0.022, -0.01);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.016, -0.55);
    ejectPoint.position.set(0.032, 0.022, -0.01);
  } else if (weaponId === 'hk416_cqb') {
    // === HK416C BREACHER (Ultra-short 9" barrel, collapsed wire PDW stock, stubby VFG & reflex) ===
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.07, 0.25), mats.gunReceiver);
    receiver.position.set(0, 0.01, 0.01);
    const shortRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.054, 0.155), mats.gunBarrel);
    shortRail.position.set(0, 0.015, -0.185);
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.07, 10), mats.gunBarrel);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.015, -0.295);
    const wireTop = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 6), mats.gunStainless);
    wireTop.rotation.x = Math.PI / 2;
    wireTop.position.set(-0.025, 0.014, 0.185);
    const wireTopR = wireTop.clone();
    wireTopR.position.x = 0.025;
    const buttCap = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.092, 0.022), mats.gunPolymer);
    buttCap.position.set(0, 0.0, 0.268);
    const stubVfg = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.058, 10), mats.gunPolymer);
    stubVfg.position.set(0, -0.038, -0.18);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.102, 0.042), mats.gunPolymer);
    grip.position.set(0, -0.068, 0.08);
    grip.rotation.x = 0.28;
    const reflex = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.03, 0.05), mats.gunBarrel);
    reflex.position.set(0, 0.064, -0.02);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.064, -0.032);
    group.add(receiver, shortRail, muzzleBrake, wireTop, wireTopR, buttCap, stubVfg, grip, reflex, dot);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.132, 0.058), mats.gunPolymer);
    mag.position.set(0, -0.09, -0.04);
    mag.rotation.x = -0.14;
    magGroup.add(mag);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.032), mats.gunStainless);
    bolt.position.set(0.027, 0.022, -0.005);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.015, -0.335);
    ejectPoint.position.set(0.032, 0.022, -0.01);
  } else if (weaponId === 'm27_iar') {
    // === HK M27 IAR (Long 16.5" heavy barrel, long quad-rail, folding bipod legs, 45-rd quad-stack mag, ACOG) ===
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.072, 0.27), mats.gunReceiver);
    receiver.position.set(0, 0.01, 0);
    const longRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.054, 0.34), mats.gunBarrel);
    longRail.position.set(0, 0.015, -0.295);
    const heavyBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.014, 0.24, 10), mats.gunBarrel);
    heavyBarrel.rotation.x = Math.PI / 2;
    heavyBarrel.position.set(0, 0.016, -0.56);
    const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.19, 8), mats.gunBarrel);
    bipodL.rotation.x = Math.PI / 2 - 0.14;
    bipodL.position.set(-0.028, -0.024, -0.38);
    const bipodR = bipodL.clone();
    bipodR.position.x = 0.028;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.106, 0.044), mats.gunPolymer);
    grip.position.set(0, -0.07, 0.084);
    grip.rotation.x = 0.28;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.108, 0.215), mats.gunPolymer);
    stock.position.set(0, 0.0, 0.265);
    const acog = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.145, 12), mats.gunBarrel);
    acog.rotation.x = Math.PI / 2;
    acog.position.set(0, 0.074, 0.0);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.074, -0.05);
    group.add(receiver, longRail, heavyBarrel, bipodL, bipodR, grip, stock, acog, dot);

    const extMag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.175, 0.064), mats.gunPolymer);
    extMag.position.set(0, -0.11, -0.042);
    extMag.rotation.x = -0.14;
    magGroup.add(extMag);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.035), mats.gunStainless);
    bolt.position.set(0.027, 0.022, -0.01);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.016, -0.685);
    ejectPoint.position.set(0.032, 0.022, -0.01);
  } else if (weaponId === 'm7') {
    // === M7 NGSW FURY RIFLE (Coyote Tan M-LOK receiver, FDE suppressor, LPVO 1-6x optic, 20-rd 6.8mm mag) ===
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.076, 0.29), mats.gunTan);
    receiver.position.set(0, 0.01, 0);
    const mlokTan = new THREE.Mesh(new THREE.BoxGeometry(0.049, 0.056, 0.26), mats.gunTan);
    mlokTan.position.set(0, 0.016, -0.265);
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.185, 12), mats.gunBronze);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.016, -0.49);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.106, 0.044), mats.gunPolymer);
    grip.position.set(0, -0.07, 0.088);
    grip.rotation.x = 0.26;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.104, 0.22), mats.gunTan);
    stock.position.set(0, 0.004, 0.265);
    const lpvoTube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.023, 0.22, 12), mats.gunBarrel);
    lpvoTube.rotation.x = Math.PI / 2;
    lpvoTube.position.set(0, 0.078, -0.015);
    const scopeGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.008, 12), mats.gunOpticGlass);
    scopeGlass.rotation.x = Math.PI / 2;
    scopeGlass.position.set(0, 0.078, -0.126);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.078, -0.08);
    group.add(receiver, mlokTan, suppressor, grip, stock, lpvoTube, scopeGlass, dot);

    const furyMag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.135, 0.072), mats.gunTan);
    furyMag.position.set(0, -0.095, -0.04);
    furyMag.rotation.x = -0.08;
    magGroup.add(furyMag);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.034), mats.gunBarrel);
    bolt.position.set(0.029, 0.022, -0.01);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.016, -0.59);
    ejectPoint.position.set(0.034, 0.024, -0.01);
  } else if (weaponId === 'xm8') {
    // === XM8 INTEGRATED CARBINE (Streamlined tan/olive polymer shroud + integrated carry-rail optic) ===
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.078, 0.56), mats.gunTan);
    hull.position.set(0, 0.01, -0.12);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.038, 0.24), mats.gunBarrel);
    bridge.position.set(0, 0.068, -0.07);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 10), mats.gunBarrel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.016, -0.475);
    const slopeStock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.105, 0.22), mats.gunTan);
    slopeStock.position.set(0, -0.002, 0.265);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.104, 0.044), mats.gunPolymer);
    grip.position.set(0, -0.07, 0.065);
    grip.rotation.x = 0.26;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.07, -0.11);
    group.add(hull, bridge, barrel, slopeStock, grip, dot);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.14, 0.058), mats.gunTranslucentMag);
    mag.position.set(0, -0.095, -0.055);
    mag.rotation.x = -0.14;
    magGroup.add(mag);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.032), mats.gunBarrel);
    bolt.position.set(0.029, 0.022, -0.02);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.016, -0.56);
    ejectPoint.position.set(0.032, 0.022, -0.02);
  } else if (weaponId === 'm16') {
    // === M16A4 SERVICE RIFLE (20" barrel, fixed A2 solid buttstock, quad handguard, carry handle / ACOG) ===
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.07, 0.26), mats.gunReceiver);
    receiver.position.set(0, 0.008, 0);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.056, 0.34), mats.gunBarrel);
    handguard.position.set(0, 0.014, -0.295);
    const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.26, 10), mats.gunBarrel);
    longBarrel.rotation.x = Math.PI / 2;
    longBarrel.position.set(0, 0.016, -0.59);
    const a2Sight = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.056, 0.038), mats.gunBarrel);
    a2Sight.position.set(0, 0.04, -0.49);
    const fixedStock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.118, 0.26), mats.gunPolymer);
    fixedStock.position.set(0, -0.008, 0.255);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.104, 0.042), mats.gunPolymer);
    grip.position.set(0, -0.068, 0.085);
    grip.rotation.x = 0.28;
    const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.036, 0.19), mats.gunBarrel);
    carryHandle.position.set(0, 0.06, 0.005);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.062, -0.05);
    group.add(receiver, handguard, longBarrel, a2Sight, fixedStock, grip, carryHandle, dot);

    const stanag = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.14, 0.06), mats.gunReceiver);
    stanag.position.set(0, -0.095, -0.045);
    stanag.rotation.x = -0.14;
    magGroup.add(stanag);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.034), mats.gunStainless);
    bolt.position.set(0.027, 0.022, -0.005);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.016, -0.725);
    ejectPoint.position.set(0.032, 0.022, -0.01);
  } else if (weaponId === 'mk17') {
    // === MK17 MOD 0 SCAR-H (Monolithic FDE upper, folding UGG boot stock, straight 7.62mm mag, ELCAN optic) ===
    const monoUpper = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.072, 0.56), mats.gunTan);
    monoUpper.position.set(0, 0.02, -0.13);
    const lowerFde = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.04, 0.25), mats.gunTan);
    lowerFde.position.set(0, -0.022, 0.01);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.19, 10), mats.gunBarrel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.018, -0.49);
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.024, 0.055), mats.gunBarrel);
    brake.position.set(0, 0.018, -0.595);
    const uggStock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.118, 0.24), mats.gunTan);
    uggStock.position.set(0, -0.006, 0.26);
    const cheekRiser = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.024, 0.15), mats.gunBronze);
    cheekRiser.position.set(0, 0.052, 0.24);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.104, 0.044), mats.gunPolymer);
    grip.position.set(0, -0.072, 0.088);
    grip.rotation.x = 0.26;
    const elcan = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.025, 0.15, 12), mats.gunBronze);
    elcan.rotation.x = Math.PI / 2;
    elcan.position.set(0, 0.08, -0.02);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.08, -0.07);
    group.add(monoUpper, lowerFde, barrel, brake, uggStock, cheekRiser, grip, elcan, dot);

    const mag762 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.145, 0.074), mats.gunTan);
    mag762.position.set(0, -0.1, -0.045);
    magGroup.add(mag762);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.015, 0.034), mats.gunBarrel);
    bolt.position.set(0.03, 0.03, -0.08);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.018, -0.63);
    ejectPoint.position.set(0.034, 0.024, -0.01);
  } else if (weaponId === 'mcx') {
    // === SIG SAUER MCX VIRTUS (Bronze/FDE M-LOK receiver, suppressed barrel, skeleton folding stock, EOTech) ===
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.072, 0.27), mats.gunBronze);
    receiver.position.set(0, 0.01, 0);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.049, 0.056, 0.24), mats.gunTan);
    handguard.position.set(0, 0.014, -0.245);
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.17, 12), mats.gunBarrel);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.014, -0.44);
    const skelTop = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.02, 0.21), mats.gunBronze);
    skelTop.position.set(0, 0.02, 0.24);
    const skelBot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.016, 0.2), mats.gunBronze);
    skelBot.position.set(0, -0.018, 0.235);
    skelBot.rotation.x = 0.2;
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.095, 0.024), mats.gunPolymer);
    stockPad.position.set(0, -0.01, 0.345);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.105, 0.042), mats.gunPolymer);
    grip.position.set(0, -0.068, 0.084);
    grip.rotation.x = 0.26;
    const holo = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.068), mats.gunBarrel);
    holo.position.set(0, 0.068, -0.03);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.068, -0.048);
    group.add(receiver, handguard, suppressor, skelTop, skelBot, stockPad, grip, holo, dot);

    const pmag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.145, 0.062), mats.gunPolymer);
    pmag.position.set(0, -0.095, -0.045);
    pmag.rotation.x = -0.14;
    magGroup.add(pmag);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.034), mats.gunStainless);
    bolt.position.set(0.028, 0.022, -0.01);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.014, -0.53);
    ejectPoint.position.set(0.032, 0.022, -0.01);
  } else if (weaponId === 'm249') {
    // === M249 SAW LMG (Heavy steel feed cover, 100-rd green box drum, visible brass belt, heatshield barrel, bipod) ===
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.086, 0.36), mats.gunBarrel);
    receiver.position.set(0, 0.012, 0.01);
    const feedCover = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.024, 0.24), mats.gunReceiver);
    feedCover.position.set(0, 0.065, -0.02);
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.056, 0.28), mats.gunBarrel);
    shroud.position.set(0, 0.016, -0.3);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.26, 10), mats.gunBarrel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.018, -0.54);
    const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8), mats.gunReceiver);
    bipodL.rotation.x = Math.PI / 2 - 0.15;
    bipodL.position.set(-0.036, -0.028, -0.44);
    const bipodR = bipodL.clone();
    bipodR.position.x = 0.036;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.11, 0.23), mats.gunPolymer);
    stock.position.set(0, 0.0, 0.29);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.106, 0.044), mats.gunPolymer);
    grip.position.set(0, -0.072, 0.105);
    grip.rotation.x = 0.25;
    const holo = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.068), mats.gunBarrel);
    holo.position.set(0, 0.095, 0.02);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.095, -0.002);
    group.add(receiver, feedCover, shroud, barrel, bipodL, bipodR, stock, grip, holo, dot);

    // 100-rd Olive Box Magazine + golden linked ammo belt feeding into receiver
    const boxDrum = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.115, 0.115), mats.gunOliveGreen);
    boxDrum.position.set(-0.022, -0.088, -0.075);
    const brassBelt = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.075), mats.gunTan);
    brassBelt.position.set(-0.042, -0.006, -0.065);
    brassBelt.rotation.z = 0.45;
    magGroup.add(boxDrum, brassBelt);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.016, 0.036), mats.gunStainless);
    bolt.position.set(0.038, 0.022, -0.02);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.018, -0.675);
    ejectPoint.position.set(0.04, 0.024, -0.02);
  } else if (weaponId === 'sniper') {
    // === M110A1 SDMR SNIPER (Coyote tan chassis & rail, suppressor, precision scope, bipod, bolt-action handle) ===
    const lowerChassis = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.048, 0.36), mats.gunTan);
    lowerChassis.position.set(0, -0.01, 0);
    const upperAction = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.04, 0.32), mats.gunTan);
    upperAction.position.set(0, 0.026, -0.01);
    const tanShroud = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.36), mats.gunTan);
    tanShroud.position.set(0, 0.016, -0.34);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.42, 12), mats.gunBarrel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.68);
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.21, 12), mats.gunBarrel);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.02, -0.94);

    [-0.03, 0.03].forEach((bx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.21, 8), mats.gunBarrel);
      leg.rotation.x = Math.PI / 2 - 0.16;
      leg.position.set(bx, -0.028, -0.46);
      group.add(leg);
    });

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.106, 0.044), mats.gunPolymer);
    grip.position.set(0, -0.072, 0.1);
    grip.rotation.x = 0.22;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.112, 0.24), mats.gunTan);
    stock.position.set(0, -0.004, 0.295);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 14), mats.gunBarrel);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.086, -0.025);
    const scopeBell = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.022, 0.075, 14), mats.gunBarrel);
    scopeBell.rotation.x = Math.PI / 2;
    scopeBell.position.set(0, 0.086, -0.18);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 14), mats.gunOpticGlass);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.086, -0.22);
    const reticle = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 8, 8), mats.gunReticle);
    reticle.position.set(0, 0.086, -0.14);
    group.add(lowerChassis, upperAction, tanShroud, barrel, suppressor, grip, stock, scopeTube, scopeBell, lens, reticle);

    const dmrMag = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.115, 0.082), mats.gunTan);
    dmrMag.position.set(0, -0.09, -0.035);
    magGroup.add(dmrMag);

    const boltHandle = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.015, 0.032), mats.gunStainless);
    boltHandle.position.set(0.032, 0.026, 0.02);
    group.add(boltHandle);
    boltMesh = boltHandle;

    muzzlePoint.position.set(0, 0.02, -1.06);
    ejectPoint.position.set(0.034, 0.026, -0.01);
  } else if (weaponId === 'shotgun') {
    // === M870 COMBAT PUMP SHOTGUN (steel receiver, long tube + 18.5" barrel, sliding pump forend, tactical stock) ===
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.068, 0.25), mats.gunReceiver);
    receiver.position.set(0, 0.006, 0.0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.56, 12), mats.gunBarrel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.026, -0.4);
    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.48, 10), mats.gunReceiver);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.008, -0.36);

    const pumpGroup = new THREE.Group();
    const pumpForend = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.19, 10), mats.gunPolymer);
    pumpForend.rotation.x = Math.PI / 2;
    pumpForend.position.set(0, -0.01, -0.28);
    pumpGroup.add(pumpForend);
    group.add(pumpGroup);
    pumpMesh = pumpGroup;

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.1, 0.25), mats.gunPolymer);
    stock.position.set(0, -0.025, 0.22);
    stock.rotation.x = -0.14;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.095, 0.045), mats.gunPolymer);
    grip.position.set(0, -0.065, 0.095);
    grip.rotation.x = 0.34;
    const ghostOptic = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.042), mats.gunBarrel);
    ghostOptic.position.set(0, 0.052, -0.02);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 6, 6), mats.gunReticle);
    dot.position.set(0, 0.052, -0.03);
    group.add(receiver, barrel, magTube, stock, grip, ghostOptic, dot);

    const shellFeed = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.04, 0.065), mats.gunCrimson);
    shellFeed.position.set(0, -0.025, -0.04);
    magGroup.add(shellFeed);

    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, 0.055), mats.gunStainless);
    bolt.position.set(0.025, 0.02, -0.02);
    group.add(bolt);
    boltMesh = bolt;

    muzzlePoint.position.set(0, 0.026, -0.69);
    ejectPoint.position.set(0.03, 0.022, -0.02);
  } else {
    // === RPG-7V2 LAUNCHER ===
    const mainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.88, 14), mats.gunBarrel);
    mainTube.rotation.x = Math.PI / 2;
    mainTube.position.set(0, 0.025, -0.04);
    const rearCone = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.058, 0.18, 14), mats.gunReceiver);
    rearCone.rotation.x = Math.PI / 2;
    rearCone.position.set(0, 0.025, 0.47);
    const woodShield = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.34, 12), mats.woodPlankMat);
    woodShield.rotation.x = Math.PI / 2;
    woodShield.position.set(0, 0.025, 0.14);
    const rearGrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.11, 0.044), mats.gunPolymer);
    rearGrip.position.set(0, -0.048, -0.14);
    rearGrip.rotation.x = 0.25;
    const frontGrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.105, 0.042), mats.gunPolymer);
    frontGrip.position.set(0, -0.046, -0.32);
    frontGrip.rotation.x = 0.18;
    const sightTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 12), mats.gunBarrel);
    sightTube.rotation.x = Math.PI / 2;
    sightTube.position.set(-0.056, 0.072, -0.14);
    group.add(mainTube, rearCone, woodShield, rearGrip, frontGrip, sightTube);

    const warhead = new THREE.Group();
    const whShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 10), mats.gunOliveGreen);
    whShaft.rotation.x = Math.PI / 2;
    whShaft.position.set(0, 0.025, -0.56);
    const whBody = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.028, 0.14, 12), mats.gunOliveGreen);
    whBody.rotation.x = Math.PI / 2;
    whBody.position.set(0, 0.025, -0.68);
    const whNose = new THREE.Mesh(new THREE.ConeGeometry(0.054, 0.16, 12), mats.gunOliveGreen);
    whNose.rotation.x = -Math.PI / 2;
    whNose.position.set(0, 0.025, -0.825);
    warhead.add(whShaft, whBody, whNose);
    group.add(warhead);
    boltMesh = warhead;
    loadedWarhead = warhead;

    muzzlePoint.position.set(0, 0.025, -0.93);
    ejectPoint.position.set(0, 0.025, 0.56);
  }

  const muzzleFlashGroup = createMuzzleFlashStar(
    weaponId === 'smg' || weaponId === 'hk416_cqb' || weaponId === 'mcx' ? 0xfef08a : 0xffaa2b,
  );
  muzzleFlashGroup.position.copy(muzzlePoint.position);
  group.add(muzzleFlashGroup);

  group.add(muzzlePoint);
  group.add(ejectPoint);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  return { group, muzzlePoint, ejectPoint, magGroup, boltMesh, pumpMesh, muzzleFlashGroup, loadedWarhead };
}

export interface FirstPersonArmsRig {
  group: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  grenadeGroup: THREE.Group;
  grenadePin: THREE.Mesh;
}

/**
 * First-Person Operator Sleeves, Forearms, Gloves & Hand-Held Frag Grenade Viewmodel.
 */
export function buildFirstPersonArms(mats: MaterialLibrary): FirstPersonArmsRig {
  const group = new THREE.Group();

  const buildArm = (isRight: boolean) => {
    const shoulder = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.24, 0.085), mats.heroBduMat);
    upper.position.set(0, -0.11, 0);
    shoulder.add(upper);

    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.11, 0.088), mats.sleeveGraphicMat);
    badge.position.set(0, -0.1, 0);
    shoulder.add(badge);

    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.032, 0.088), mats.heroAccentMat);
    cuff.position.set(0, -0.22, 0);
    shoulder.add(cuff);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.23, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.17, 0.072), mats.heroBduMat);
    forearm.position.set(0, 0.0, -0.09);
    forearm.rotation.x = Math.PI / 2;
    elbow.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.068, 0.085), mats.heroArmorMat);
    glove.position.set(0, 0.005, -0.195);
    elbow.add(glove);

    const gloveTrim = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.022, 0.035), mats.heroAccentMat);
    gloveTrim.position.set(0, 0.015, -0.165);
    elbow.add(gloveTrim);

    // Subtle thumb/knuckle bridge so grip reads cleanly in 1st-person
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.026, 0.045), mats.heroArmorMat);
    thumb.position.set(isRight ? -0.034 : 0.034, 0.022, -0.205);
    elbow.add(thumb);

    return { shoulder, elbow };
  };

  const left = buildArm(false);
  left.shoulder.position.set(-0.26, -0.19, -0.06);
  const right = buildArm(true);
  right.shoulder.position.set(0.25, -0.2, -0.05);
  group.add(left.shoulder, right.shoulder);

  // 3D Frag Grenade attached inside right hand for pull-pin + throw animation
  const grenadeGroup = new THREE.Group();
  grenadeGroup.position.set(0, 0.035, -0.22);
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 10, 10),
    mats.armorOlive,
  );
  body.scale.set(0.92, 1.15, 0.92);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.016, 10),
    mats.crimsonAccent,
  );
  const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.055, 0.022), mats.steelTrim);
  spoon.position.set(0.028, 0.025, 0);
  const grenadePin = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 12), mats.silverBuckle);
  grenadePin.position.set(-0.022, 0.052, 0);
  grenadeGroup.add(body, band, spoon, grenadePin);
  grenadeGroup.visible = false;
  right.elbow.add(grenadeGroup);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });

  return {
    group,
    leftShoulder: left.shoulder,
    leftElbow: left.elbow,
    rightShoulder: right.shoulder,
    rightElbow: right.elbow,
    grenadeGroup,
    grenadePin,
  };
}

export interface SoldierRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  pelvisGroup: THREE.Group;
  leftLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightLeg: THREE.Group;
  rightKnee: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  neckStump: THREE.Mesh;
  leftArm: THREE.Group;
  leftElbow: THREE.Group;
  rightArm: THREE.Group;
  rightElbow: THREE.Group;
  weaponSocket: THREE.Group;
  playerWeapons?: Partial<Record<WeaponId, THREE.Group>>;
  playerWeaponMuzzles?: Partial<Record<WeaponId, THREE.Object3D>>;
  muzzlePoint: THREE.Object3D;
  hitMeshes: THREE.Mesh[];
  armorMeshes: THREE.Mesh[];
  visorMesh: THREE.Mesh;
}

/**
 * Crimson Wolf Tactical Player Character (matching front & back reference images) + Hostile Soldiers.
 */
export function buildSoldierModel(
  variant: 'player' | 'enemy' | 'heavy',
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): SoldierRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Ground contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const hitMeshes: THREE.Mesh[] = [];
  const armorMeshes: THREE.Mesh[] = [];

  const pelvisGroup = new THREE.Group();
  bodyPivot.add(pelvisGroup);

  if (variant === 'player') {
    // === HERO TACTICAL SOLDIER RIG (Consistent across 3D Lobby & 3rd-Person Combat) ===
    const buildHeroLeg = (xOffset: number, isLeft: boolean) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(xOffset, 0.85, 0);

      const sideSign = isLeft ? -1 : 1;

      // Combat BDU Thigh + Cargo Utility Pockets + Drop-Leg Holster
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.41, 0.235), mats.heroBduMat);
      thigh.position.y = -0.205;
      legGroup.add(thigh);

      const cargoPocket = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.19, 0.155), mats.heroPackMat);
      cargoPocket.position.set(sideSign * 0.115, -0.22, 0.01);
      legGroup.add(cargoPocket);

      const pocketStrap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.028, 0.175), mats.heroArmorMat);
      pocketStrap.position.set(sideSign * 0.116, -0.16, 0.01);
      legGroup.add(pocketStrap);

      const holsterPlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.17, 0.11), mats.heroArmorMat);
      holsterPlate.position.set(sideSign * 0.118, -0.13, -0.02);
      legGroup.add(holsterPlate);

      const pocketBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.045), mats.silverBuckle);
      pocketBuckle.position.set(sideSign * 0.138, -0.16, 0.01);
      legGroup.add(pocketBuckle);

      const legRigStrap = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.032, 0.245), mats.heroAccentMat);
      legRigStrap.position.set(0, -0.15, 0);
      legGroup.add(legRigStrap);

      // Articulated Knee Joint + Molded Tactical Knee Pad + Shin + Armored Combat Boots
      const kneeGroup = new THREE.Group();
      kneeGroup.position.set(0, -0.41, 0);
      legGroup.add(kneeGroup);

      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.12, 0.065), mats.heroArmorMat);
      kneePad.position.set(0, -0.02, -0.112);
      kneeGroup.add(kneePad);
      armorMeshes.push(kneePad);

      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.29, 0.20), mats.heroBduMat);
      shin.position.y = -0.135;
      kneeGroup.add(shin);

      const shinStrap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.205), mats.heroArmorMat);
      shinStrap.position.set(0, -0.21, 0);
      kneeGroup.add(shinStrap);

      // High-ankle Tactical Combat Boot with toe cap & rugged lug sole
      const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.135, 0.275), mats.heroArmorMat);
      bootUpper.position.set(0, -0.325, -0.02);
      kneeGroup.add(bootUpper);

      const bootCollar = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.042, 0.23), mats.heroPackMat);
      bootCollar.position.set(0, -0.255, 0.0);
      kneeGroup.add(bootCollar);

      const bootToeCap = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.075, 0.095), mats.gunBarrel);
      bootToeCap.position.set(0, -0.355, -0.145);
      kneeGroup.add(bootToeCap);

      const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.212, 0.048, 0.325), mats.gunPolymer);
      bootSole.position.set(0, -0.415, -0.035);
      kneeGroup.add(bootSole);

      const bootLaces = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.025), mats.heroAccentMat);
      bootLaces.position.set(0, -0.31, -0.142);
      kneeGroup.add(bootLaces);

      thigh.userData.isLimb = true;
      shin.userData.isLimb = true;
      bootUpper.userData.isLimb = true;
      hitMeshes.push(thigh, shin, bootUpper);
      return { legGroup, kneeGroup };
    };

    const leftLegBuilt = buildHeroLeg(-0.145, true);
    const rightLegBuilt = buildHeroLeg(0.145, false);
    const leftLeg = leftLegBuilt.legGroup;
    const leftKnee = leftLegBuilt.kneeGroup;
    const rightLeg = rightLegBuilt.legGroup;
    const rightKnee = rightLegBuilt.kneeGroup;
    pelvisGroup.add(leftLeg, rightLeg);

    // Duty Battle Belt & Hip Pouches
    const battleBelt = new THREE.Mesh(new THREE.BoxGeometry(0.495, 0.105, 0.31), mats.heroArmorMat);
    battleBelt.position.set(0, 0.86, 0);
    pelvisGroup.add(battleBelt);

    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.032), mats.silverBuckle);
    beltBuckle.position.set(0, 0.86, -0.16);
    pelvisGroup.add(beltBuckle);

    [-0.265, 0.265].forEach((bx) => {
      const hipPouch = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.125, 0.14), mats.heroPackMat);
      hipPouch.position.set(bx, 0.86, 0.01);
      pelvisGroup.add(hipPouch);
    });

    // 2. Torso: Tactical BDU Combat Shirt + Plate Carrier Vest + Mag Pouches + Shoulder Radio + Assault Backpack
    const torso = new THREE.Group();
    torso.position.set(0, 0.85, 0);
    pelvisGroup.add(torso);

    const combatShirt = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.56, 0.275), mats.heroBduMat);
    combatShirt.position.y = 0.29;
    torso.add(combatShirt);
    hitMeshes.push(combatShirt);

    const neckCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.11, 12), mats.heroBduMat);
    neckCollar.position.set(0, 0.585, 0);
    torso.add(neckCollar);

    const neckStump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.098, 0.09, 10),
      new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.42, metalness: 0.08 }),
    );
    neckStump.position.set(0, 0.625, 0);
    neckStump.visible = false;
    torso.add(neckStump);

    // Plate Carrier Tactical Vest
    const vestCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.335), mats.heroArmorMat);
    vestCarrier.position.set(0, 0.32, 0);
    vestCarrier.userData.isArmorPlate = true;
    torso.add(vestCarrier);
    hitMeshes.push(vestCarrier);
    armorMeshes.push(vestCarrier);

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.055), mats.heroPackMat);
    chestPlate.position.set(0, 0.37, -0.172);
    chestPlate.userData.isArmorPlate = true;
    torso.add(chestPlate);
    hitMeshes.push(chestPlate);
    armorMeshes.push(chestPlate);

    // Triple Rifle Magazine Pouches across lower chest carrier
    [-0.105, 0, 0.105].forEach((px) => {
      const magPouch = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.15, 0.065), mats.heroPackMat);
      magPouch.position.set(px, 0.19, -0.188);
      torso.add(magPouch);

      const pouchFlap = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.036, 0.07), mats.heroAccentMat);
      pouchFlap.position.set(px, 0.255, -0.19);
      torso.add(pouchFlap);
    });

    // Vanguard Wolf Chest Patch + Shoulder Straps + Diagonal Sling
    const chestWolf = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), mats.wolfChestMat);
    chestWolf.position.set(-0.085, 0.41, -0.203);
    chestWolf.rotation.y = Math.PI;
    torso.add(chestWolf);

    [-0.145, 0.145].forEach((sx) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.34), mats.heroArmorMat);
      strap.position.set(sx, 0.56, 0);
      torso.add(strap);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.024, 0.344), mats.heroAccentMat);
      trim.position.set(sx, 0.61, 0);
      torso.add(trim);
    });

    // Shoulder Tactical Radio + Whip Antenna
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.15, 0.06), mats.gunBarrel);
    radio.position.set(-0.22, 0.44, -0.14);
    torso.add(radio);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.30, 6), mats.steelTrim);
    antenna.position.set(-0.23, 0.64, -0.14);
    torso.add(antenna);

    // Modern Armored Sci-Fi Tactical Backpack (silver-white shell plates, dark inner chassis, glowing orange vertical trim)
    const packInnerCore = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.14), mats.heroPackMat);
    packInnerCore.position.set(0, 0.33, 0.22);
    torso.add(packInnerCore);

    // Twin sculpted left/right silver-white armor shells flanking central orange glow channel
    [-0.092, 0.092].forEach((px) => {
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.46, 0.165), mats.packShellWhite);
      shell.position.set(px, 0.33, 0.255);
      torso.add(shell);

      const upperBevel = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.11, 0.145), mats.packShellWhite);
      upperBevel.position.set(px, 0.52, 0.238);
      upperBevel.rotation.x = 0.28;
      torso.add(upperBevel);

      const sidePod = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.24, 0.12), mats.packShellWhite);
      sidePod.position.set(px > 0 ? 0.18 : -0.18, 0.27, 0.24);
      torso.add(sidePod);

      const sideGlow = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.22, 0.024), mats.packOrangeGlow);
      sideGlow.position.set(px > 0 ? 0.188 : -0.188, 0.27, 0.295);
      torso.add(sideGlow);
    });

    // Central spine dark recess + full-height vertical glowing orange strip + bottom vents
    const centerRecess = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.46, 0.172), mats.gunBarrel);
    centerRecess.position.set(0, 0.33, 0.255);
    torso.add(centerRecess);

    const centerOrangeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.44, 0.028), mats.packOrangeGlow);
    centerOrangeStrip.position.set(0, 0.33, 0.338);
    torso.add(centerOrangeStrip);

    const topOrangeArc = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.13), mats.packOrangeGlow);
    topOrangeArc.position.set(0, 0.565, 0.24);
    torso.add(topOrangeArc);

    const lowerThrusterPod = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.12), mats.gunBarrel);
    lowerThrusterPod.position.set(0, 0.14, 0.275);
    torso.add(lowerThrusterPod);

    // 3. Articulated Shoulder + Elbow Arms with Tactical Shoulder Pads & Combat Gloves
    const buildHeroArm = (xOffset: number, isRight: boolean) => {
      const arm = new THREE.Group();
      arm.position.set(xOffset, 0.46, 0);

      const shoulderPad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.17), mats.heroArmorMat);
      shoulderPad.position.set(isRight ? 0.01 : -0.01, -0.03, 0);
      arm.add(shoulderPad);

      const upperSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.25, 0.15), mats.heroBduMat);
      upperSleeve.position.set(0, -0.11, -0.01);
      arm.add(upperSleeve);

      const sleevePatch = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.09, 0.154), mats.heroAccentMat);
      sleevePatch.position.set(0, -0.09, -0.01);
      arm.add(sleevePatch);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.24, -0.01);
      arm.add(elbow);

      const elbowPad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.12), mats.heroArmorMat);
      elbowPad.position.set(0, -0.01, 0.01);
      elbow.add(elbowPad);

      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.18, 0.12), mats.heroBduMat);
      forearm.position.set(isRight ? -0.02 : 0.03, -0.02, -0.09);
      forearm.rotation.x = Math.PI / 2;
      elbow.add(forearm);

      const gloveBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.105, 0.115), mats.heroArmorMat);
      gloveBody.position.set(isRight ? -0.03 : 0.04, -0.01, -0.2);
      gloveBody.rotation.x = Math.PI / 2;
      elbow.add(gloveBody);

      const gloveKnuckle = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.035, 0.12), mats.heroAccentMat);
      gloveKnuckle.position.set(isRight ? -0.03 : 0.04, 0.0, -0.17);
      gloveKnuckle.rotation.x = Math.PI / 2;
      elbow.add(gloveKnuckle);

      upperSleeve.userData.isLimb = true;
      forearm.userData.isLimb = true;
      hitMeshes.push(upperSleeve, forearm);
      return { arm, elbow };
    };

    const leftArmBuilt = buildHeroArm(-0.31, false);
    const rightArmBuilt = buildHeroArm(0.31, true);
    const leftArm = leftArmBuilt.arm;
    const leftElbow = leftArmBuilt.elbow;
    const rightArm = rightArmBuilt.arm;
    const rightElbow = rightArmBuilt.elbow;

    leftArm.rotation.x = 0.25;
    leftArm.rotation.z = -0.18;
    torso.add(leftArm);
    torso.add(rightArm);

    // Weapon Socket attached to right elbow
    const weaponSocket = new THREE.Group();
    weaponSocket.position.set(-0.07, 0.01, -0.33);
    rightElbow.add(weaponSocket);

    const playerWeapons: Partial<Record<WeaponId, THREE.Group>> = {};
    const playerWeaponMuzzles: Partial<Record<WeaponId, THREE.Object3D>> = {};
    let defaultMuzzle: THREE.Object3D = new THREE.Object3D();
    WEAPON_ORDER.forEach((wid) => {
      const wm = buildWeaponModel(wid, mats);
      wm.group.scale.setScalar(1.18);
      wm.group.visible = wid === 'm4a1';
      weaponSocket.add(wm.group);
      playerWeapons[wid] = wm.group;
      playerWeaponMuzzles[wid] = wm.muzzlePoint;
      if (wid === 'm4a1') defaultMuzzle = wm.muzzlePoint;
    });

    // 4. Head: Ballistic OPS-Core Tactical Helmet + Side Rails + Ear-Pro + NVG Shroud + Balaclava + Visor
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.64, 0);
    torso.add(headGroup);

    const balaclavaHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), mats.heroPackMat);
    balaclavaHead.position.y = 0.12;
    balaclavaHead.userData.isHead = true;
    headGroup.add(balaclavaHead);

    const faceBridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.065, 0.03), mats.skinHero);
    faceBridge.position.set(0, 0.145, -0.115);
    headGroup.add(faceBridge);

    const maskLower = new THREE.Mesh(new THREE.PlaneGeometry(0.175, 0.105), mats.maskCrestMat);
    maskLower.position.set(0, 0.066, -0.124);
    maskLower.rotation.y = Math.PI;
    headGroup.add(maskLower);

    // Ballistic Helmet Shell + Rear Neck Guard
    const helmetShell = new THREE.Mesh(new THREE.BoxGeometry(0.295, 0.165, 0.31), mats.heroArmorMat);
    helmetShell.position.set(0, 0.225, 0.01);
    helmetShell.userData.isHead = true;
    headGroup.add(helmetShell);

    const helmetRim = new THREE.Mesh(new THREE.BoxGeometry(0.305, 0.03, 0.318), mats.heroAccentMat);
    helmetRim.position.set(0, 0.165, 0.01);
    headGroup.add(helmetRim);

    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.04), mats.gunBarrel);
    nvgMount.position.set(0, 0.23, -0.155);
    headGroup.add(nvgMount);

    [-0.155, 0.155].forEach((ex) => {
      const earPro = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.036, 10), mats.gunBarrel);
      earPro.rotation.z = Math.PI / 2;
      earPro.position.set(ex, 0.135, 0.0);
      headGroup.add(earPro);
    });

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.058, 0.03), mats.heroVisorMat);
    visorMesh.position.set(0, 0.148, -0.128);
    visorMesh.userData.isHead = true;
    headGroup.add(visorMesh);

    hitMeshes.push(balaclavaHead, helmetShell, visorMesh);
    armorMeshes.push(helmetShell);

    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj !== shadow) {
        obj.castShadow = !isSoftwareGl;
        obj.receiveShadow = true;
      }
    });

    return {
      root,
      bodyPivot,
      pelvisGroup,
      leftLeg,
      leftKnee,
      rightLeg,
      rightKnee,
      torso,
      headGroup,
      neckStump,
      leftArm,
      leftElbow,
      rightArm,
      rightElbow,
      weaponSocket,
      playerWeapons,
      playerWeaponMuzzles,
      muzzlePoint: defaultMuzzle,
      hitMeshes,
      armorMeshes,
      visorMesh,
    };
  }

  // === HOSTILE SOLDIER RIGS (enemy / heavy) ===
  const armorMat = variant === 'heavy' ? mats.armorHeavy.clone() : mats.armorDark.clone();
  const accentMat = variant === 'heavy' ? mats.steelTrim : mats.armorOlive;
  const vestPlateMat = variant === 'heavy' ? mats.crimsonAccent : mats.steelTrim;
  const visorMat = mats.visorEnemy.clone();

  const scale = variant === 'heavy' ? 1.16 : 1.0;
  bodyPivot.scale.setScalar(scale);

  // Legs (hip pivot at y = 0.85, knee at y = -0.41, boots touch y = 0)
  const buildLeg = (xOffset: number, isRightSide: boolean) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, 0.85, 0);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.41, 0.24), accentMat);
    thigh.position.y = -0.205;
    legGroup.add(thigh);

    // Tactical drop-leg holster (right) or utility pouch (left)
    const thighRig = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.17, 0.14),
      variant === 'heavy' ? mats.gunBarrel : mats.gunPolymer,
    );
    thighRig.position.set(isRightSide ? 0.125 : -0.125, -0.19, 0.01);
    legGroup.add(thighRig);

    const kneeGroup = new THREE.Group();
    kneeGroup.position.y = -0.41;
    legGroup.add(kneeGroup);

    // Articulated molded knee pad
    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.07), mats.gunBarrel);
    kneePad.position.set(0, -0.02, -0.115);
    kneeGroup.add(kneePad);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.31, 0.2), accentMat);
    shin.position.y = -0.14;
    kneeGroup.add(shin);

    // Front armored shin guard
    const shinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.23, 0.05), armorMat);
    shinGuard.position.set(0, -0.15, -0.095);
    shinGuard.userData.isArmorPlate = true;
    kneeGroup.add(shinGuard);

    // Tactical combat boot (ankle cuff + toe cap + lug sole)
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.28), mats.gunBarrel);
    bootUpper.position.set(0, -0.35, -0.025);
    kneeGroup.add(bootUpper);

    const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.045, 0.31), mats.gunPolymer);
    bootSole.position.set(0, -0.415, -0.03);
    kneeGroup.add(bootSole);

    thigh.userData.isLimb = true;
    shin.userData.isLimb = true;
    bootUpper.userData.isLimb = true;
    hitMeshes.push(thigh, shin, bootUpper);
    armorMeshes.push(shinGuard, kneePad);
    return { legGroup, kneeGroup };
  };

  const leftLegBuilt = buildLeg(-0.15, false);
  const rightLegBuilt = buildLeg(0.15, true);
  const leftLeg = leftLegBuilt.legGroup;
  const leftKnee = leftLegBuilt.kneeGroup;
  const rightLeg = rightLegBuilt.legGroup;
  const rightKnee = rightLegBuilt.kneeGroup;
  pelvisGroup.add(leftLeg, rightLeg);

  // Pelvis Tactical Belt & Side Pouches
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.11, 0.31), mats.gunBarrel);
  belt.position.set(0, 0.86, 0);
  pelvisGroup.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.03), mats.silverBuckle);
  buckle.position.set(0, 0.86, -0.16);
  pelvisGroup.add(buckle);
  [-0.26, 0.26].forEach((bx) => {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.14), mats.gunPolymer);
    pouch.position.set(bx, 0.86, 0.01);
    pelvisGroup.add(pouch);
  });

  // Torso + Multi-Plate Tactical Carrier + Chest Mag Rig
  const torso = new THREE.Group();
  torso.position.set(0, 0.85, 0);
  pelvisGroup.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.57, 0.28), accentMat);
  chest.position.y = 0.29;
  torso.add(chest);
  hitMeshes.push(chest);

  const plateVest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.41, 0.33), armorMat);
  plateVest.position.set(0, 0.32, 0);
  plateVest.userData.isArmorPlate = true;
  torso.add(plateVest);
  hitMeshes.push(plateVest);
  armorMeshes.push(plateVest);

  // Front angled ceramic trauma plate + shoulder straps
  const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.27, 0.055), vestPlateMat);
  frontPlate.position.set(0, 0.36, -0.17);
  frontPlate.userData.isArmorPlate = true;
  torso.add(frontPlate);
  hitMeshes.push(frontPlate);
  armorMeshes.push(frontPlate);

  [-0.14, 0.14].forEach((sx) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.14, 0.32), mats.gunBarrel);
    strap.position.set(sx, 0.56, 0);
    torso.add(strap);
  });

  // 3 Front Rifle Magazine Pouches
  [-0.105, 0, 0.105].forEach((mx) => {
    const magPouch = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.14, 0.065), mats.gunPolymer);
    magPouch.position.set(mx, 0.21, -0.185);
    torso.add(magPouch);
  });

  // Tactical shoulder radio + whip antenna
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.065), mats.gunBarrel);
  radio.position.set(-0.23, 0.44, -0.11);
  torso.add(radio);
  const radioAnt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.009, 0.24, 5),
    variant === 'heavy' ? mats.crimsonAccent : mats.steelTrim,
  );
  radioAnt.position.set(-0.24, 0.61, -0.11);
  torso.add(radioAnt);

  if (variant === 'heavy') {
    const collarArmor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.35), armorMat);
    collarArmor.position.set(0, 0.58, 0.01);
    torso.add(collarArmor);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.18), mats.gunReceiver);
    backpack.position.set(0, 0.34, 0.22);
    torso.add(backpack);
    hitMeshes.push(backpack);
    armorMeshes.push(backpack);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.52, 6), mats.crimsonAccent);
    antenna.position.set(0.14, 0.68, 0.23);
    torso.add(antenna);
  } else {
    // Standard rear hydration / utility pack
    const backPack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.12), mats.gunPolymer);
    backPack.position.set(0, 0.35, 0.19);
    torso.add(backPack);
  }

  // Articulated Shoulder Pauldrons
  [-0.31, 0.31].forEach((sx) => {
    const padSize = variant === 'heavy' ? 0.21 : 0.155;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(padSize, 0.17, 0.25), armorMat);
    pad.position.set(sx, 0.48, 0);
    pad.userData.isArmorPlate = true;
    torso.add(pad);
    hitMeshes.push(pad);
    armorMeshes.push(pad);
  });

  // Left support arm + elbow + tactical glove (reaches inward toward rifle handguard)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.32, 0.45, -0.02);
  const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.23, 0.145), accentMat);
  leftUpperArm.position.set(0.02, -0.11, -0.02);
  leftArm.add(leftUpperArm);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0.03, -0.22, -0.04);
  leftArm.add(leftElbow);
  const leftElbowPad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.09), mats.gunBarrel);
  leftElbowPad.position.set(0, 0, 0.06);
  leftElbow.add(leftElbowPad);

  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.23, 0.12), accentMat);
  leftForearm.position.set(0.05, 0.01, -0.11);
  leftForearm.rotation.x = Math.PI / 2;
  leftForearm.rotation.z = -0.35;
  leftElbow.add(leftForearm);

  const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.12), mats.gunBarrel);
  leftGlove.position.set(0.11, 0.02, -0.23);
  leftElbow.add(leftGlove);

  leftUpperArm.userData.isLimb = true;
  leftForearm.userData.isLimb = true;
  hitMeshes.push(leftUpperArm, leftForearm);
  torso.add(leftArm);

  // Right weapon arm + elbow + tactical glove + Rifle
  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 0.45, -0.02);
  const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.23, 0.145), accentMat);
  rightUpperArm.position.set(-0.02, -0.11, -0.02);
  rightArm.add(rightUpperArm);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(-0.02, -0.22, -0.04);
  rightArm.add(rightElbow);
  const rightElbowPad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.09), mats.gunBarrel);
  rightElbowPad.position.set(0, 0, 0.06);
  rightElbow.add(rightElbowPad);

  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.23, 0.12), accentMat);
  rightForearm.position.set(-0.03, 0.0, -0.11);
  rightForearm.rotation.x = Math.PI / 2;
  rightElbow.add(rightForearm);

  const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.11), mats.gunBarrel);
  rightGlove.position.set(-0.04, 0.01, -0.22);
  rightElbow.add(rightGlove);

  rightUpperArm.userData.isLimb = true;
  rightForearm.userData.isLimb = true;
  hitMeshes.push(rightUpperArm, rightForearm);

  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(-0.06, 0.03, -0.37);
  rightElbow.add(weaponSocket);

  const rifle = buildWeaponModel(variant === 'heavy' ? 'm249' : 'hk416', mats);
  rifle.group.scale.setScalar(1.15);
  weaponSocket.add(rifle.group);
  torso.add(rightArm);

  // Exposed crimson neck stump shown immediately on decapitation
  const neckStump = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.098, 0.095, 10),
    new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.42, metalness: 0.08 }),
  );
  neckStump.position.set(0, 0.615, 0);
  neckStump.visible = false;
  torso.add(neckStump);

  // Head + Balaclava + OPS-Core Tactical Helmet + NVG Mount + Ear-Pro + Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.62, 0);
  torso.add(headGroup);

  // Neck gaiter / balaclava base
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.12, 8), mats.gunBarrel);
  neck.position.y = 0.02;
  headGroup.add(neck);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.25), mats.skinTone);
  headMesh.position.y = 0.14;
  headMesh.userData.isHead = true;
  headGroup.add(headMesh);

  const balaclavaLower = new THREE.Mesh(new THREE.BoxGeometry(0.255, 0.12, 0.265), mats.gunBarrel);
  balaclavaLower.position.set(0, 0.09, -0.005);
  balaclavaLower.userData.isHead = true;
  headGroup.add(balaclavaLower);

  // Main Helmet Shell + Rear Nape Skirt
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.16, 0.32), armorMat);
  helmet.position.set(0, 0.245, 0.005);
  helmet.userData.isHead = true;
  helmet.userData.isArmorPlate = true;
  headGroup.add(helmet);

  const helmetTop = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.26), armorMat);
  helmetTop.position.set(0, 0.335, 0.01);
  helmetTop.userData.isHead = true;
  helmetTop.userData.isArmorPlate = true;
  headGroup.add(helmetTop);

  const napeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.1, 0.07), armorMat);
  napeGuard.position.set(0, 0.16, 0.135);
  napeGuard.userData.isHead = true;
  headGroup.add(napeGuard);

  // NVG Shroud Mount on Helmet Front
  const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.04), mats.gunBarrel);
  nvgMount.position.set(0, 0.245, -0.165);
  headGroup.add(nvgMount);

  // Side Accessory Rails & Tactical Ear-Pro Headset Cups
  [-0.165, 0.165].forEach((ex) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.18), mats.gunPolymer);
    rail.position.set(ex, 0.22, 0);
    const earCup = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 8), mats.gunBarrel);
    earCup.rotation.z = Math.PI / 2;
    earCup.position.set(ex * 0.96, 0.15, 0.02);
    headGroup.add(rail, earCup);
  });

  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.085, 0.055), visorMat);
  visorMesh.position.set(0, 0.175, -0.145);
  visorMesh.userData.isHead = true;
  headGroup.add(visorMesh);

  hitMeshes.push(headMesh, balaclavaLower, helmet, helmetTop, visorMesh);
  armorMeshes.push(helmet, helmetTop, napeGuard);

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== shadow) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return {
    root,
    bodyPivot,
    pelvisGroup,
    leftLeg,
    leftKnee,
    rightLeg,
    rightKnee,
    torso,
    headGroup,
    neckStump,
    leftArm,
    leftElbow,
    rightArm,
    rightElbow,
    weaponSocket,
    muzzlePoint: rifle.muzzlePoint,
    hitMeshes,
    armorMeshes,
    visorMesh,
  };
}

/**
 * Composite shipping container with corner castings, lock bars, and bottom-center pivot.
 */
export function buildContainerProp(
  matIndex: number,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const w = 3.2;
  const h = 3.0;
  const d = 7.4;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mats.containerMaterials[matIndex % mats.containerMaterials.length],
  );
  body.position.y = h / 2;
  group.add(body);

  // Corner steel posts
  const postGeo = new THREE.BoxGeometry(0.18, h + 0.06, 0.18);
  [
    [-w / 2 + 0.06, -d / 2 + 0.06],
    [w / 2 - 0.06, -d / 2 + 0.06],
    [-w / 2 + 0.06, d / 2 - 0.06],
    [w / 2 - 0.06, d / 2 - 0.06],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(postGeo, mats.steelTrim);
    post.position.set(px, h / 2, pz);
    group.add(post);
  });

  // Top frame beams
  const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.14, d + 0.08), mats.steelTrim);
  roofTrim.position.y = h - 0.05;
  group.add(roofTrim);

  // Door locking bars on front face
  [-0.55, 0.55].forEach((bx) => {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h - 0.3, 8), mats.steelTrim);
    bar.position.set(bx, h / 2, d / 2 + 0.04);
    group.add(bar);
  });

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Composite reinforced concrete bunker/barrier with beveled top cap.
 */
export function buildConcreteBarrier(
  w: number,
  h: number,
  d: number,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();

  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.24, d + 0.34), mats.concrete);
  base.position.y = h * 0.12;
  group.add(base);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.72, d), mats.concrete);
  wall.position.y = h * 0.5;
  group.add(wall);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.03, Math.max(0.14, h * 0.14), d + 0.03),
    mats.hazardStripeMat,
  );
  stripe.position.y = h * 0.72;
  group.add(stripe);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.13, d + 0.1), mats.steelTrim);
  cap.position.y = h - 0.04;
  group.add(cap);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Composite tactical watchtower with legs, deck, guard rails, and roof canopy.
 */
export function buildWatchtower(mats: MaterialLibrary, isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();
  const deckY = 4.0;
  const span = 3.2;

  // 4 legs
  const legGeo = new THREE.BoxGeometry(0.26, deckY, 0.26);
  [
    [-span / 2, -span / 2],
    [span / 2, -span / 2],
    [-span / 2, span / 2],
    [span / 2, span / 2],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, mats.steelTrim);
    leg.position.set(lx, deckY / 2, lz);
    group.add(leg);
  });

  // Deck platform
  const deck = new THREE.Mesh(new THREE.BoxGeometry(span + 0.8, 0.25, span + 0.8), mats.concrete);
  deck.position.y = deckY;
  group.add(deck);

  // Parapet waist walls (4 sides)
  const wallH = 1.05;
  const wallT = 0.16;
  const wLen = span + 0.7;
  const front = new THREE.Mesh(new THREE.BoxGeometry(wLen, wallH, wallT), mats.steelTrim);
  front.position.set(0, deckY + wallH / 2, span / 2 + 0.3);
  const back = front.clone();
  back.position.z = -(span / 2 + 0.3);
  const left = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, wLen), mats.steelTrim);
  left.position.set(-(span / 2 + 0.3), deckY + wallH / 2, 0);
  const right = left.clone();
  right.position.x = span / 2 + 0.3;
  group.add(front, back, left, right);

  // Roof posts + corrugated canopy
  const roofY = deckY + 2.55;
  const postGeo = new THREE.BoxGeometry(0.14, 2.55, 0.14);
  [
    [-span / 2 - 0.25, -span / 2 - 0.25],
    [span / 2 + 0.25, -span / 2 - 0.25],
    [-span / 2 - 0.25, span / 2 + 0.25],
    [span / 2 + 0.25, span / 2 + 0.25],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(postGeo, mats.steelTrim);
    post.position.set(px, deckY + 1.275, pz);
    group.add(post);
  });

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(span + 1.3, 0.18, span + 1.3),
    mats.containerMaterials[1],
  );
  roof.position.y = roofY;
  group.add(roof);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Composite military supply crate with steel corner bands and beacon crystal.
 */
export function buildSupplyCrate(mats: MaterialLibrary, isSoftwareGl: boolean): {
  group: THREE.Group;
  beacon: THREE.Mesh;
} {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  const box = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.95, 1.25), mats.crateMat);
  box.position.y = 0.475;
  group.add(box);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.14, 1.32), mats.steelTrim);
  lid.position.y = 0.96;
  group.add(lid);

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.5,
  });
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), beaconMat);
  beacon.position.y = 1.48;
  group.add(beacon);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && obj !== shadow) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return { group, beacon };
}

/**
 * Enterable 3-sided concrete tactical shelter with roof & front half-wall parapet for hiding & peeking.
 */
export function buildGuardHouseBunker(
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const w = 4.8;
  const d = 4.2;
  const h = 2.75;
  const t = 0.35;

  // Floor pad
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), mats.concrete);
  floor.position.y = 0.08;
  group.add(floor);

  // Back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mats.concrete);
  back.position.set(0, h / 2, -d / 2 + t / 2);
  group.add(back);

  // Left & Right side walls
  const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), mats.concrete);
  left.position.set(-w / 2 + t / 2, h / 2, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), mats.concrete);
  right.position.set(w / 2 - t / 2, h / 2, 0);
  group.add(left, right);

  // Front waist-high cover parapet (with center doorway gap)
  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, t), mats.concrete);
  frontLeft.position.set(-w / 2 + 0.75, 0.575, d / 2 - t / 2);
  const frontRight = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, t), mats.concrete);
  frontRight.position.set(w / 2 - 0.75, 0.575, d / 2 - t / 2);
  group.add(frontLeft, frontRight);

  // Steel roof slab
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.22, d + 0.3), mats.steelTrim);
  roof.position.y = h + 0.1;
  group.add(roof);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * L-shaped reinforced concrete corner wall for multi-angle player and AI cover.
 */
export function buildCornerCover(mats: MaterialLibrary, isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();
  const h = 1.65;

  const wingA = new THREE.Mesh(new THREE.BoxGeometry(3.8, h, 0.55), mats.concrete);
  wingA.position.set(0, h / 2, -1.6);
  const wingB = new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 3.6), mats.concrete);
  wingB.position.set(-1.62, h / 2, 0);
  const capA = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.12, 0.65), mats.steelTrim);
  capA.position.set(0, h + 0.04, -1.6);
  const capB = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 3.7), mats.steelTrim);
  capB.position.set(-1.62, h + 0.04, 0);

  group.add(wingA, wingB, capA, capB);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Stacked wooden & steel cargo crates for mid-lane concealment.
 */
export function buildCrateStack(mats: MaterialLibrary, isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();

  const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 1.4), mats.crateMat);
  c1.position.set(-0.72, 0.65, 0);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.1, 1.35), mats.crateMat);
  c2.position.set(0.72, 0.55, 0.12);
  const c3 = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 1.15), mats.crateMat);
  c3.position.set(-0.15, 1.82, 0.05);
  c3.rotation.y = 0.22;

  group.add(c1, c2, c3);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

export type CompoundSurfaceMat = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;

export interface CompoundPalette {
  wallWhite: CompoundSurfaceMat;
  roofBlue: CompoundSurfaceMat;
  roofGreen: CompoundSurfaceMat;
  roofTerracotta: CompoundSurfaceMat;
  windowStrip: CompoundSurfaceMat;
  darkSteel: CompoundSurfaceMat;
  asphalt: CompoundSurfaceMat;
  grass: CompoundSurfaceMat;
  earth: CompoundSurfaceMat;
  curbPale: CompoundSurfaceMat;
  trailerWhite: CompoundSurfaceMat;
  trailerBlue: CompoundSurfaceMat;
  trailerRed: CompoundSurfaceMat;
  siloSilver: CompoundSurfaceMat;
  lumberOrange: CompoundSurfaceMat;
  leafGreen: CompoundSurfaceMat;
  dispose: () => void;
}

export function createCompoundPalette(
  textures?: ProceduralTextureSet,
  isBeatMode = false,
  graphicsQuality: GraphicsQuality = 'high',
): CompoundPalette {
  const mats: THREE.Material[] = [];
  const useLambert = graphicsQuality === 'low' || graphicsQuality === 'medium';
  const reg = <T extends THREE.Material>(m: T): T => {
    mats.push(m);
    return m;
  };
  const mkCompoundMat = (params: THREE.MeshStandardMaterialParameters): CompoundSurfaceMat => {
    if (useLambert) {
      return reg(
        new THREE.MeshLambertMaterial({
          ...(params.color !== undefined ? { color: params.color } : {}),
          ...(params.map ? { map: params.map } : {}),
          ...(params.emissive !== undefined ? { emissive: params.emissive } : {}),
          ...(params.emissiveIntensity !== undefined ? { emissiveIntensity: params.emissiveIntensity } : {}),
        }),
      );
    }
    return reg(new THREE.MeshStandardMaterial(params));
  };

  const wallWhite = mkCompoundMat({
    color: 0xd9dde2,
    ...(textures ? { map: textures.stuccoWall } : {}),
    roughness: 0.78,
    metalness: 0.06,
  });
  const roofBlue = mkCompoundMat({
    color: 0x3b7fb8,
    ...(textures ? { map: textures.corrugatedRoof } : {}),
    roughness: 0.5,
    metalness: 0.28,
  });
  const roofGreen = mkCompoundMat({
    color: 0x577535,
    ...(textures ? { map: textures.corrugatedRoof } : {}),
    roughness: 0.65,
    metalness: 0.15,
  });
  const roofTerracotta = mkCompoundMat({
    color: 0xb94a36,
    ...(textures ? { map: textures.stuccoWall } : {}),
    roughness: 0.66,
    metalness: 0.1,
  });
  const windowStrip = mkCompoundMat({
    color: 0xe9eef4,
    emissive: isBeatMode ? 0x0284c7 : 0x334155,
    emissiveIntensity: isBeatMode ? 0.45 : 0.24,
    roughness: 0.18,
    metalness: 0.45,
  });
  const darkSteel = mkCompoundMat({ color: 0x373c44, roughness: 0.46, metalness: 0.72 });
  const asphalt = mkCompoundMat({
    color: isBeatMode ? 0x94a3b8 : 0xffffff,
    ...(textures ? { map: textures.asphaltAlbedo } : { color: 0x4b4e53 }),
    roughness: 0.9,
    metalness: 0.04,
  });
  const grass = mkCompoundMat({
    color: isBeatMode ? 0xffffff : 0xc8d2b0,
    ...(textures
      ? {
          map: textures.terrainAlbedo,
          ...(textures.terrainBump ? { bumpMap: textures.terrainBump, bumpScale: 0.04 } : {}),
        }
      : { color: 0x627739 }),
    roughness: 0.92,
    metalness: 0.0,
  });
  const earth = mkCompoundMat({
    color: 0x7c5f48,
    ...(textures ? { map: textures.rockAlbedo } : {}),
    roughness: 0.94,
    metalness: 0.02,
  });
  const curbPale = mkCompoundMat({
    color: 0xc8ccd0,
    ...(textures ? { map: textures.stuccoWall } : {}),
    roughness: 0.84,
    metalness: 0.04,
  });
  const trailerWhite = mkCompoundMat({
    color: 0xd9dce0,
    ...(textures ? { map: textures.corrugatedRoof } : {}),
    roughness: 0.48,
    metalness: 0.24,
  });
  const trailerBlue = mkCompoundMat({
    color: 0x3f6188,
    ...(textures ? { map: textures.corrugatedRoof } : {}),
    roughness: 0.48,
    metalness: 0.26,
  });
  const trailerRed = mkCompoundMat({
    color: 0xd84b2c,
    ...(textures ? { map: textures.corrugatedRoof } : {}),
    roughness: 0.48,
    metalness: 0.24,
  });
  const siloSilver = mkCompoundMat({
    color: 0xcfd4da,
    ...(textures ? { map: textures.brushedMetal } : {}),
    roughness: 0.3,
    metalness: 0.82,
  });
  const lumberOrange = mkCompoundMat({
    color: 0xc98a4b,
    ...(textures ? { map: textures.woodPlank } : {}),
    roughness: 0.82,
    metalness: 0.04,
  });
  const leafGreen = mkCompoundMat({ color: 0x3c5826, roughness: 0.86, metalness: 0.0 });

  return {
    wallWhite,
    roofBlue,
    roofGreen,
    roofTerracotta,
    windowStrip,
    darkSteel,
    asphalt,
    grass,
    earth,
    curbPale,
    trailerWhite,
    trailerBlue,
    trailerRed,
    siloSilver,
    lumberOrange,
    leafGreen,
    dispose: () => mats.forEach((m) => m.dispose()),
  };
}

/**
 * Enterable twin blue-roofed industrial warehouse hangar with open front/back cargo bays,
 * concrete loading ramps, clerestory windows, and pitched gable roof.
 */
export function buildWarehouseHangar(
  w: number,
  h: number,
  d: number,
  pal: CompoundPalette,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const t = 0.36;
  const doorW = 4.4;
  const doorH = 3.6;

  // Interior concrete slab
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), pal.curbPale);
  floor.position.y = 0.07;
  group.add(floor);

  // Side walls
  const sideGeo = new THREE.BoxGeometry(t, h, d);
  const leftWall = new THREE.Mesh(sideGeo, pal.wallWhite);
  leftWall.position.set(-w / 2 + t / 2, h / 2, 0);
  const rightWall = new THREE.Mesh(sideGeo, pal.wallWhite);
  rightWall.position.set(w / 2 - t / 2, h / 2, 0);
  group.add(leftWall, rightWall);

  // Horizontal clerestory window strips on both long sides
  const winStripGeo = new THREE.BoxGeometry(w + 0.08, 0.85, d * 0.72);
  const winStrip = new THREE.Mesh(winStripGeo, pal.windowStrip);
  winStrip.position.set(0, h - 1.35, 0);
  group.add(winStrip);

  // Window mullions along sides
  for (let z = -d * 0.32; z <= d * 0.32; z += 2.2) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.9, 0.14), pal.wallWhite);
    mullion.position.set(0, h - 1.35, z);
    group.add(mullion);
  }

  // Front & Back gable end walls with centered roll-up cargo bay doorways
  const wingW = (w - doorW) / 2;
  const buildEndWall = (zPos: number, frameSign: number) => {
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(wingW, h, t), pal.wallWhite);
    leftWing.position.set(-(w / 2 - wingW / 2), h / 2, zPos);
    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(wingW, h, t), pal.wallWhite);
    rightWing.position.set(w / 2 - wingW / 2, h / 2, zPos);
    const header = new THREE.Mesh(new THREE.BoxGeometry(doorW, h - doorH, t), pal.wallWhite);
    header.position.set(0, doorH + (h - doorH) / 2, zPos);
    // Steel doorway frame
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.35, 0.2, t + 0.14), pal.darkSteel);
    lintel.position.set(0, doorH, zPos);
    const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorH, t + 0.14), pal.darkSteel);
    jambL.position.set(-doorW / 2, doorH / 2, zPos);
    const jambR = jambL.clone();
    jambR.position.x = doorW / 2;

    // Pale concrete loading ramp sloping onto asphalt
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.6, 0.12, 3.2), pal.curbPale);
    ramp.position.set(0, 0.05, zPos + frameSign * 1.65);
    ramp.rotation.x = frameSign * 0.035;

    group.add(leftWing, rightWing, header, lintel, jambL, jambR, ramp);
  };

  buildEndWall(d / 2 - t / 2, 1);
  buildEndWall(-d / 2 + t / 2, -1);

  // Gable triangular end caps (constructed from stepped/extruded wedge geometry)
  const gablePeak = 2.45;
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-w / 2, 0);
  gableShape.lineTo(w / 2, 0);
  gableShape.lineTo(0, gablePeak);
  gableShape.closePath();

  const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
    depth: d - 0.1,
    bevelEnabled: false,
  });
  gableGeo.translate(0, 0, -(d - 0.1) / 2);
  const gableMesh = new THREE.Mesh(gableGeo, pal.wallWhite);
  gableMesh.position.y = h;
  group.add(gableMesh);

  // Bright steel-blue pitched roof slopes with overhang
  const slopeRun = w / 2 + 0.55;
  const slopeAngle = Math.atan2(gablePeak, w / 2);
  const slopeLen = Math.hypot(slopeRun, gablePeak * (slopeRun / (w / 2)));
  const roofGeo = new THREE.BoxGeometry(slopeLen, 0.18, d + 0.9);

  const roofL = new THREE.Mesh(roofGeo, pal.roofBlue);
  roofL.position.set(-slopeRun / 2, h + gablePeak / 2 + 0.06, 0);
  roofL.rotation.z = slopeAngle;

  const roofR = new THREE.Mesh(roofGeo, pal.roofBlue);
  roofR.position.set(slopeRun / 2, h + gablePeak / 2 + 0.06, 0);
  roofR.rotation.z = -slopeAngle;

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.24, d + 0.95), pal.roofBlue);
  ridge.position.set(0, h + gablePeak + 0.12, 0);
  group.add(roofL, roofR, ridge);

  // Roof vent boxes & industrial HVAC condenser units
  [-d * 0.25, d * 0.25].forEach((vz) => {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.54, 0.92), pal.curbPale);
    vent.position.set(0, h + gablePeak + 0.3, vz);
    const fanGrill = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.65), pal.darkSteel);
    fanGrill.position.set(0, h + gablePeak + 0.59, vz);
    group.add(vent, fanGrill);
  });

  // Exterior concrete foundation plinth & vertical wall buttresses
  const plinthL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.38, d + 0.1), pal.curbPale);
  plinthL.position.set(-w / 2 + 0.18, 0.19, 0);
  const plinthR = plinthL.clone();
  plinthR.position.x = w / 2 - 0.18;
  group.add(plinthL, plinthR);
  for (let bz = -d * 0.38; bz <= d * 0.38; bz += d * 0.25) {
    const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.28), pal.curbPale);
    ribL.position.set(-w / 2 - 0.02, h / 2, bz);
    const ribR = ribL.clone();
    ribR.position.x = w / 2 + 0.02;
    group.add(ribL, ribR);
  }

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Parked industrial semi-trailer / shipping cargo trailer with undercarriage & wheels.
 */
export function buildParkedTrailer(
  bodyMat: THREE.Material,
  pal: CompoundPalette,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const w = 2.55;
  const h = 2.75;
  const d = 8.4;

  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  box.position.y = 0.85 + h / 2;
  group.add(box);

  // Rear axle wheels & front landing gear legs
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  [-1.05, 1.05].forEach((wx) => {
    [-2.4, -3.35].forEach((wz) => {
      const wheel = new THREE.Mesh(wheelGeo, pal.darkSteel);
      wheel.position.set(wx, 0.42, wz);
      group.add(wheel);
    });
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.14), pal.darkSteel);
    leg.position.set(wx * 0.82, 0.425, 2.7);
    group.add(leg);
  });

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Open steel-frame canopy shelter (carport / lumber shed / tank shelter).
 */
export function buildCanopyShelter(
  w: number,
  h: number,
  d: number,
  roofMat: THREE.Material,
  pal: CompoundPalette,
  isSoftwareGl: boolean,
  pitched = false,
): THREE.Group {
  const group = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.16, h, 0.16);
  [
    [-w / 2 + 0.25, -d / 2 + 0.25],
    [w / 2 - 0.25, -d / 2 + 0.25],
    [-w / 2 + 0.25, d / 2 - 0.25],
    [w / 2 - 0.25, d / 2 - 0.25],
    [-w / 2 + 0.25, 0],
    [w / 2 - 0.25, 0],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(postGeo, pal.darkSteel);
    post.position.set(px, h / 2, pz);
    group.add(post);
  });

  if (pitched) {
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 0.14, d + 0.4), roofMat);
    roofL.position.set(-w * 0.26, h + 0.35, 0);
    roofL.rotation.z = 0.24;
    const roofR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 0.14, d + 0.4), roofMat);
    roofR.position.set(w * 0.26, h + 0.35, 0);
    roofR.rotation.z = -0.24;
    group.add(roofL, roofR);
  } else {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.16, d + 0.4), roofMat);
    roof.position.y = h + 0.08;
    roof.rotation.z = 0.08;
    group.add(roof);
  }

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Small rectangular security guard kiosk at the front gate.
 */
export function buildGuardKiosk(pal: CompoundPalette, isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.35, 2.8), pal.roofGreen);
  body.position.y = 1.175;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 3.2), pal.roofTerracotta);
  roof.position.y = 2.55;
  group.add(roof);

  const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 2.9), pal.windowStrip);
  win.position.set(-0.6, 1.4, 0);
  group.add(win);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Tall industrial courtyard floodlight pole with quad light heads.
 */
export function buildFloodlightPole(pal: CompoundPalette, isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 7.6, 8), pal.curbPale);
  pole.position.y = 3.8;
  group.add(pole);

  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.14), pal.curbPale);
  crossArm.position.y = 7.55;
  group.add(crossArm);

  [-0.5, 0.5].forEach((lx) => {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.26), pal.windowStrip);
    head.position.set(lx, 7.42, 0.16);
    head.rotation.x = 0.4;
    group.add(head);
  });

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Lush leafy deciduous compound tree (matching courtyard island & lawn trees).
 */
export function buildDeciduousTree(pal: CompoundPalette, mats: MaterialLibrary, isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();
  const rootFlair = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.36, 0.74), mats.woodTrunk);
  rootFlair.position.y = 0.18;
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.55, 0.42), mats.woodTrunk);
  trunk.position.y = 1.45;
  group.add(rootFlair, trunk);

  const layers: [number, number, number, number, number, number][] = [
    [0, 3.05, 0, 2.95, 0.92, 2.95],
    [-0.42, 3.72, 0.32, 2.25, 0.85, 2.3],
    [0.48, 3.82, -0.28, 2.1, 0.82, 2.05],
    [0.05, 4.46, 0.05, 1.55, 0.74, 1.55],
  ];
  layers.forEach(([x, y, z, w, h, d]) => {
    const crown = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pal.leafGreen);
    crown.position.set(x, y, z);
    group.add(crown);
  });

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl && obj === trunk;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * 2-Story Rustic Terracotta & Timber Barn Lodge (matching images-2.jpeg top-left & bottom-right buildings).
 */
export function buildBarnLodge(
  w: number,
  h: number,
  d: number,
  pal: CompoundPalette,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
  openFrame = false,
): THREE.Group {
  const group = new THREE.Group();
  const t = 0.34;
  const doorW = 3.8;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), pal.curbPale);
  floor.position.y = 0.08;
  group.add(floor);

  const wallMat = openFrame ? mats.woodPlankMat : pal.roofTerracotta;
  if (!openFrame) {
    // Solid lower & upper barn walls with walk-through front/back doorway
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), wallMat);
    sideL.position.set(-w / 2 + t / 2, h / 2, 0);
    const sideR = sideL.clone();
    sideR.position.x = w / 2 - t / 2;
    group.add(sideL, sideR);

    const wingW = (w - doorW) / 2;
    [d / 2 - t / 2, -d / 2 + t / 2].forEach((ez) => {
      const wL = new THREE.Mesh(new THREE.BoxGeometry(wingW, h, t), wallMat);
      wL.position.set(-(w / 2 - wingW / 2), h / 2, ez);
      const wR = new THREE.Mesh(new THREE.BoxGeometry(wingW, h, t), wallMat);
      wR.position.set(w / 2 - wingW / 2, h / 2, ez);
      const hdr = new THREE.Mesh(new THREE.BoxGeometry(doorW, h - 3.4, t), wallMat);
      hdr.position.set(0, 3.4 + (h - 3.4) / 2, ez);
      group.add(wL, wR, hdr);
    });
  } else {
    // Open-frame timber barn (exposed wooden columns & horizontal beams)
    const postGeo = new THREE.BoxGeometry(0.32, h, 0.32);
    [-w / 2 + 0.25, 0, w / 2 - 0.25].forEach((px) => {
      [-d / 2 + 0.25, 0, d / 2 - 0.25].forEach((pz) => {
        if (px === 0 && pz === 0) return;
        const post = new THREE.Mesh(postGeo, mats.woodPlankMat);
        post.position.set(px, h / 2, pz);
        group.add(post);
      });
    });
    // Mid-level timber floor gallery
    const loft = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.2, d * 0.5), mats.woodPlankMat);
    loft.position.set(0, h * 0.52, -d * 0.2);
    group.add(loft);
  }

  // Gabled Terracotta Roof
  const gablePeak = 2.8;
  const slopeRun = w / 2 + 0.6;
  const slopeAngle = Math.atan2(gablePeak, w / 2);
  const slopeLen = Math.hypot(slopeRun, gablePeak * (slopeRun / (w / 2)));
  const roofGeo = new THREE.BoxGeometry(slopeLen, 0.2, d + 0.8);

  const roofL = new THREE.Mesh(roofGeo, pal.roofTerracotta);
  roofL.position.set(-slopeRun / 2, h + gablePeak / 2 + 0.05, 0);
  roofL.rotation.z = slopeAngle;

  const roofR = new THREE.Mesh(roofGeo, pal.roofTerracotta);
  roofR.position.set(slopeRun / 2, h + gablePeak / 2 + 0.05, 0);
  roofR.rotation.z = -slopeAngle;

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.24, d + 0.85), mats.woodPlankMat);
  ridge.position.set(0, h + gablePeak + 0.1, 0);
  group.add(roofL, roofR, ridge);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return group;
}

/**
 * Small Tan Wooden Gabled Shed (matching right-side hut in images-2.jpeg).
 */
export function buildSmallWoodHut(
  pal: CompoundPalette,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const w = 4.6;
  const h = 3.0;
  const d = 5.4;

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.woodPlankMat);
  body.position.y = h / 2;
  group.add(body);

  const roofL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.18, d + 0.5), pal.roofTerracotta);
  roofL.position.set(-w * 0.27, h + 0.68, 0);
  roofL.rotation.z = 0.52;
  const roofR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.18, d + 0.5), pal.roofTerracotta);
  roofR.position.set(w * 0.27, h + 0.68, 0);
  roofR.rotation.z = -0.52;
  group.add(roofL, roofR);

  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.12), pal.darkSteel);
  door.position.set(0, 1.1, d / 2 + 0.02);
  group.add(door);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Open Steel-Gray Flat-Roofed Depot Pavilion Shelter (matching carport structure in images-2.jpeg).
 */
export function buildDepotPavilion(
  w: number,
  h: number,
  d: number,
  pal: CompoundPalette,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), pal.curbPale);
  slab.position.y = 0.08;
  group.add(slab);

  const postGeo = new THREE.BoxGeometry(0.45, h, 0.45);
  [
    [-w / 2 + 0.5, -d / 2 + 0.5],
    [w / 2 - 0.5, -d / 2 + 0.5],
    [-w / 2 + 0.5, d / 2 - 0.5],
    [w / 2 - 0.5, d / 2 - 0.5],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(postGeo, pal.curbPale);
    post.position.set(px, h / 2, pz);
    group.add(post);
  });

  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.55, d + 0.8), pal.wallWhite);
  roof.position.y = h + 0.25;
  group.add(roof);

  const roofCap = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, 0.16, d + 1.0), pal.darkSteel);
  roofCap.position.y = h + 0.56;
  group.add(roofCap);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Horizontal Cylindrical Industrial Tank inside Steel-Truss Frame Cage (matching images-2.jpeg).
 */
export function buildCagedTank(
  pal: CompoundPalette,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const w = 3.1;
  const h = 2.6;
  const d = 5.4;

  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, d - 0.6, 18), pal.siloSilver);
  tank.rotation.x = Math.PI / 2;
  tank.position.y = 1.3;
  group.add(tank);

  [-1.1, 1.1].forEach((bz) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.42, 18), mats.hazardStripeMat);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 1.3, bz);
    group.add(band);
  });

  const beamV = new THREE.BoxGeometry(0.14, h, 0.14);
  [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(beamV, pal.darkSteel);
    post.position.set(px, h / 2, pz);
    group.add(post);
  });

  [0.12, h].forEach((by) => {
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, d), pal.darkSteel);
    railL.position.set(-w / 2, by, 0);
    const railR = railL.clone();
    railR.position.x = w / 2;
    const railF = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.14), pal.darkSteel);
    railF.position.set(0, by, d / 2);
    const railB = railF.clone();
    railB.position.z = -d / 2;
    group.add(railL, railR, railF, railB);
  });

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Walk-Through Open-Ended Corrugated Teal/Blue Container (matching images-2.jpeg).
 */
export function buildOpenBlueContainer(mats: MaterialLibrary, isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();
  const w = 3.2;
  const h = 3.0;
  const d = 7.4;
  const t = 0.16;
  const tealMat = mats.containerMaterials[3 % mats.containerMaterials.length];

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), mats.steelTrim);
  floor.position.y = t * 0.5;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), tealMat);
  roof.position.y = h - t * 0.5;
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), tealMat);
  wallL.position.set(-w / 2 + t / 2, h / 2, 0);
  const wallR = wallL.clone();
  wallR.position.x = w / 2 - t / 2;
  group.add(floor, roof, wallL, wallR);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Sloped Wooden Plank Ramp connecting ground level up onto stacked containers (images-2.jpeg).
 */
export function buildPlankRamp(
  runLength: number,
  width: number,
  riseHeight: number,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const slopeLen = Math.hypot(runLength, riseHeight);
  const angle = Math.atan2(riseHeight, runLength);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.18, slopeLen), mats.woodPlankMat);
  deck.position.set(0, riseHeight * 0.5, 0);
  deck.rotation.x = angle;
  group.add(deck);

  [-width * 0.42, width * 0.42].forEach((rx) => {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, slopeLen), mats.steelTrim);
    stringer.position.set(rx, riseHeight * 0.5 - 0.12, 0);
    stringer.rotation.x = angle;
    group.add(stringer);
  });

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Elevated Blue-Topped Watchtower with Diagonal Access Stairs (matching images-2.jpeg).
 */
export function buildWatchtowerWithStairs(
  pal: CompoundPalette,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const deckY = 3.2;
  const span = 2.8;

  const legGeo = new THREE.BoxGeometry(0.2, deckY, 0.2);
  [
    [-span / 2, -span / 2],
    [span / 2, -span / 2],
    [-span / 2, span / 2],
    [span / 2, span / 2],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, pal.darkSteel);
    leg.position.set(lx, deckY / 2, lz);
    group.add(leg);
  });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(span + 0.6, 0.22, span + 0.6), pal.roofBlue);
  deck.position.y = deckY;
  group.add(deck);

  const wallH = 1.05;
  const wLen = span + 0.55;
  const bWall = new THREE.Mesh(new THREE.BoxGeometry(wLen, wallH, 0.16), pal.roofBlue);
  bWall.position.set(0, deckY + wallH / 2, -(span / 2 + 0.25));
  const lWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, wallH, wLen), pal.roofBlue);
  lWall.position.set(-(span / 2 + 0.25), deckY + wallH / 2, 0);
  const rWall = lWall.clone();
  rWall.position.x = span / 2 + 0.25;
  const fWallL = new THREE.Mesh(new THREE.BoxGeometry(0.95, wallH, 0.16), pal.roofBlue);
  fWallL.position.set(-span / 2 + 0.2, deckY + wallH / 2, span / 2 + 0.25);
  group.add(bWall, lWall, rWall, fWallL);

  // Diagonal staircase on +Z side
  const stairLen = Math.hypot(deckY, 3.2);
  const stair = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, stairLen), mats.steelTrim);
  stair.position.set(0.55, deckY * 0.5, span / 2 + 1.65);
  stair.rotation.x = -Math.atan2(deckY, 3.2);
  group.add(stair);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Concrete Post & Wood-Panel Divider Wall (matching perimeter & zigzagging lane walls in images-2.jpeg).
 */
export function buildZigzagDividerWall(
  length: number,
  height: number,
  pal: CompoundPalette,
  mats: MaterialLibrary,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(length, 0.35, 0.42), pal.curbPale);
  base.position.y = 0.175;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(length, height - 0.35, 0.26), mats.woodPlankMat);
  panel.position.y = 0.35 + (height - 0.35) * 0.5;
  group.add(base, panel);

  const steps = Math.max(2, Math.round(length / 3.8));
  for (let i = 0; i <= steps; i++) {
    const px = -length / 2 + (i / steps) * length;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, height + 0.2, 0.44), pal.curbPale);
    post.position.set(px, (height + 0.2) * 0.5, 0);
    group.add(post);
  }

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Tall Steel Lattice Floodlight / Radio Tower (matching images-2.jpeg).
 */
export function buildLatticeTower(pal: CompoundPalette, isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.4), pal.curbPale);
  plinth.position.y = 0.3;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.55, 11.5, 4), pal.curbPale);
  mast.position.y = 6.35;
  const topHead = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.26, 0.5), pal.windowStrip);
  topHead.position.y = 12.1;
  group.add(plinth, mast, topHead);

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Instanced distant mountain peaks, compound perimeter boulders & pine clusters
 * enclosing the Drop Zone horizon without affecting playable colliders or hurting Android FPS.
 */
export function buildPerimeterMountainsAndRocks(
  pal: CompoundPalette,
  mats: MaterialLibrary,
  isBeatMode: boolean,
  isSoftwareGl: boolean,
  skipEast = false,
  skipWest = false,
): THREE.Group {
  const group = new THREE.Group();

  // Deterministic pseudo-random helper so landscape silhouette stays consistent
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // 1. Sculpted Multi-Octave Displaced Horizon Mountains (High-Segment Ridged Noise + Slope/Altitude Shading)
  const peakGeo = new THREE.ConeGeometry(36, 46, isSoftwareGl ? 16 : 24, isSoftwareGl ? 8 : 12);
  const pos = peakGeo.attributes.position;
  const peakCols = new Float32Array(pos.count * 3);
  const rockCol = new THREE.Color(isBeatMode ? 0x16203a : 0x626058);
  const mossBaseCol = new THREE.Color(isBeatMode ? 0x132824 : 0x456335);
  const snowPeakCol = new THREE.Color(isBeatMode ? 0x4b5e85 : 0xdbe6f2);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const normY = THREE.MathUtils.clamp((y + 23) / 46, 0, 1);
    const ridge = ridged2D(x * 0.085 + 3.1, z * 0.085 - 2.4, 3, 911);
    const fbm = fbm2D(x * 0.14 - 1.2, z * 0.14 + 4.7, 3, 2.0, 0.5, 421);
    const radialScale = 0.72 + ridge * 0.42 + fbm * 0.18;
    const ny = y + (1 - normY) * (fbm - 0.5) * 4.5;
    pos.setXYZ(i, x * radialScale, ny, z * radialScale);

    const snowFactor = THREE.MathUtils.smoothstep(normY, 0.62, 0.88);
    const baseFactor = 1 - THREE.MathUtils.smoothstep(normY, 0.05, 0.35);
    tmpCol.copy(rockCol).lerp(mossBaseCol, baseFactor * 0.75).lerp(snowPeakCol, snowFactor * 0.9);
    peakCols[i * 3] = tmpCol.r;
    peakCols[i * 3 + 1] = tmpCol.g;
    peakCols[i * 3 + 2] = tmpCol.b;
  }
  peakGeo.setAttribute('color', new THREE.BufferAttribute(peakCols, 3));
  peakGeo.computeVertexNormals();

  const peakCount = 42;
  const mountainMat = new THREE.MeshStandardMaterial({
    color: isBeatMode ? 0x94a3b8 : 0xffffff,
    map: mats.rockMat.map ?? null,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.05,
  });

  const peakPlacements: Array<{ px: number; py: number; pz: number; rotY: number; sx: number; sy: number }> = [];
  for (let i = 0; i < peakCount; i++) {
    const theta = (i / peakCount) * Math.PI * 2;
    const rx = 215 + rand() * 38;
    const rz = 160 + rand() * 32;
    const px = 20 + Math.cos(theta) * rx;
    const pz = Math.sin(theta) * rz;
    const scaleY = 0.85 + rand() * 1.15;
    const scaleXZ = 0.95 + rand() * 0.75;
    const rotY = rand() * Math.PI;
    if (skipEast && px > 120) continue;
    if (skipWest && px < -80) continue;
    if (overlapsMansionHorizonCorridor(px, pz)) continue;
    peakPlacements.push({ px, py: 14 * scaleY - 3, pz, rotY, sx: scaleXZ, sy: scaleY });
  }

  const peaks = new THREE.InstancedMesh(peakGeo, mountainMat, peakPlacements.length);
  const dummy = new THREE.Object3D();
  peakPlacements.forEach((pk, idx) => {
    dummy.position.set(pk.px, pk.py, pk.pz);
    dummy.rotation.set(0, pk.rotY, 0);
    dummy.scale.set(pk.sx, pk.sy, pk.sx);
    dummy.updateMatrix();
    peaks.setMatrixAt(idx, dummy.matrix);
  });
  peaks.instanceMatrix.needsUpdate = true;
  peaks.computeBoundingSphere();
  peaks.receiveShadow = !isSoftwareGl;
  group.add(peaks);

  // 2. Sculpted Organic Boulders outside expanded city loop (high-segment displaced ridge outcrops)
  const rockGeo = createOrganicBoulderGeometry(1.45, isSoftwareGl ? 1 : 2, 107);
  const rockCoords: [number, number, number, number][] = [];
  for (let i = 0; i < 42; i++) {
    const side = i % 4;
    let x = 0;
    let z = 0;
    const y = -0.15;
    if (side === 0) {
      x = -148 + rand() * 330;
      z = -128 - rand() * 14;
    } else if (side === 1) {
      x = -148 + rand() * 330;
      z = 128 + rand() * 14;
    } else if (side === 2) {
      x = -152 - rand() * 14;
      z = -124 + rand() * 248;
    } else {
      x = 186 + rand() * 14;
      z = -124 + rand() * 248;
    }
    const sc = 0.85 + rand() * 1.75;
    if (skipEast && side === 3) continue;
    if (skipWest && side === 2) continue;
    if (side === 0 && Math.abs(x) < 110) continue;
    rockCoords.push([x, y, z, sc]);
  }

  const boulderMat = new THREE.MeshStandardMaterial({
    map: mats.rockMat.map ?? null,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.06,
    color: isBeatMode ? 0x64748b : 0xffffff,
  });

  const rocks = new THREE.InstancedMesh(rockGeo, boulderMat, rockCoords.length);
  rockCoords.forEach(([x, y, z, sc], idx) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI * 2, (rand() - 0.5) * 0.25);
    dummy.scale.set(sc * (0.95 + rand() * 0.45), sc * (0.65 + rand() * 0.35), sc * (0.95 + rand() * 0.45));
    dummy.updateMatrix();
    rocks.setMatrixAt(idx, dummy.matrix);
  });
  rocks.instanceMatrix.needsUpdate = true;
  rocks.computeBoundingSphere();
  rocks.receiveShadow = true;
  group.add(rocks);

  // 3. Instanced Organic Layered Horizon Pine Trees (tapered trunks + displaced multi-tier boughs)
  const treeCount = 56;
  const trunkParts: THREE.BufferGeometry[] = [];
  const mainT = new THREE.CylinderGeometry(0.14, 0.34, 3.4, 8);
  mainT.translate(0, 1.7, 0);
  const flareT = new THREE.CylinderGeometry(0.32, 0.48, 0.6, 8);
  flareT.translate(0, 0.3, 0);
  trunkParts.push(mainT, flareT);
  const trunkGeo = mergeGeometries(trunkParts, false);
  trunkParts.forEach((g) => g.dispose());

  const boughParts: THREE.BufferGeometry[] = [];
  [
    { y: 3.1, rx: 1.9, ry: 1.15, seed: 11 },
    { y: 4.5, rx: 1.45, ry: 1.1, seed: 29 },
    { y: 5.7, rx: 0.98, ry: 0.98, seed: 47 },
    { y: 6.7, rx: 0.52, ry: 0.85, seed: 67 },
  ].forEach((tier) => {
    const lobe = new THREE.IcosahedronGeometry(1, 1);
    const lPos = lobe.attributes.position;
    for (let vi = 0; vi < lPos.count; vi++) {
      const lx = lPos.getX(vi);
      const ly = lPos.getY(vi);
      const lz = lPos.getZ(vi);
      const n = 0.84 + fbm2D(lx * 2.1 + tier.seed, lz * 2.1 - tier.seed, 2) * 0.35;
      lPos.setXYZ(vi, lx * tier.rx * n, ly * tier.ry * n + tier.y, lz * tier.rx * n);
    }
    lobe.computeVertexNormals();
    boughParts.push(lobe);
  });
  const canopyGeo = mergeGeometries(boughParts, false);
  boughParts.forEach((g) => g.dispose());

  const treePlacements: Array<{ tx: number; tz: number; sc: number; rotY: number }> = [];
  for (let i = 0; i < treeCount; i++) {
    const theta = (i / treeCount) * Math.PI * 2 + 0.08;
    const tx = 20 + Math.cos(theta) * (174 + rand() * 26);
    const tz = Math.sin(theta) * (132 + rand() * 22);
    const sc = 0.95 + rand() * 0.7;
    const rotY = rand() * Math.PI;
    if (skipEast && tx > 115) continue;
    if (skipWest && tx < -80) continue;
    treePlacements.push({ tx, tz, sc, rotY });
  }

  const trunks = new THREE.InstancedMesh(trunkGeo, mats.woodTrunk, treePlacements.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, pal.leafGreen, treePlacements.length);
  treePlacements.forEach((tr, idx) => {
    const baseY = -0.2;
    dummy.position.set(tr.tx, baseY, tr.tz);
    dummy.rotation.set(0, tr.rotY, 0);
    dummy.scale.setScalar(tr.sc);
    dummy.updateMatrix();
    trunks.setMatrixAt(idx, dummy.matrix);
    canopies.setMatrixAt(idx, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  trunks.computeBoundingSphere();
  canopies.instanceMatrix.needsUpdate = true;
  canopies.computeBoundingSphere();
  group.add(trunks, canopies);

  return group;
}




