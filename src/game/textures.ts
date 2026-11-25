import * as THREE from 'three';
import { GraphicsQuality } from '../types';

export interface ProceduralTextureSet {
  terrainAlbedo: THREE.CanvasTexture;
  terrainBump: THREE.CanvasTexture | null;
  asphaltAlbedo: THREE.CanvasTexture;
  asphaltNormal: THREE.CanvasTexture | null;
  rockAlbedo: THREE.CanvasTexture;
  rockNormal: THREE.CanvasTexture | null;
  terrainNormal: THREE.CanvasTexture | null;
  terrainRoughness: THREE.CanvasTexture | null;
  soilAlbedo: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  barkNormal: THREE.CanvasTexture | null;
  waterNormalA: THREE.CanvasTexture;
  waterNormalB: THREE.CanvasTexture;
  stuccoWall: THREE.CanvasTexture;
  corrugatedRoof: THREE.CanvasTexture;
  concreteAlbedo: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture | null;
  courtyardConcrete: THREE.CanvasTexture;
  woodPlank: THREE.CanvasTexture;
  hazardStripe: THREE.CanvasTexture;
  containerRed: THREE.CanvasTexture;
  containerOlive: THREE.CanvasTexture;
  containerNavy: THREE.CanvasTexture;
  containerTeal: THREE.CanvasTexture;
  containerBump: THREE.CanvasTexture | null;
  woodCrate: THREE.CanvasTexture;
  brushedMetal: THREE.CanvasTexture;
  facadeGlassGrid: THREE.CanvasTexture;
  facadeMasonryWarm: THREE.CanvasTexture;
  facadeModernPanel: THREE.CanvasTexture;
  mallMarbleTile: THREE.CanvasTexture;
  woodWalnut: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  bulletHoleTex: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  tex: THREE.CanvasTexture,
  isColor: boolean,
  anisoCap: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.max(1, anisoCap);
  tex.needsUpdate = true;
  return tex;
}

function periodicHash(ix: number, iy: number, period: number, seed: number): number {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function tileableValueNoise(u: number, v: number, freq: number, seed: number): number {
  const x = u * freq;
  const y = v * freq;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = periodicHash(ix, iy, freq, seed);
  const b = periodicHash(ix + 1, iy, freq, seed);
  const c = periodicHash(ix, iy + 1, freq, seed);
  const d = periodicHash(ix + 1, iy + 1, freq, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

function tileableFbm(u: number, v: number, baseFreq: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileableValueNoise(u, v, freq, seed + o * 17.3);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / Math.max(0.0001, norm);
}

function buildNormalMapFromHeight(
  size: number,
  heights: Float32Array,
  strength: number,
  anisoCap: number,
  repX: number,
  repY: number,
): THREE.CanvasTexture {
  const [nCanvas, nCtx] = makeCanvas(size, size);
  const img = nCtx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heights[y * size + xp] - heights[y * size + xm]) * strength;
      const dy = (heights[yp * size + x] - heights[ym * size + x]) * strength;
      const invLen = 1 / Math.hypot(dx, dy, 1);
      const nx = -dx * invLen;
      const ny = -dy * invLen;
      const nz = invLen;
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  nCtx.putImageData(img, 0, 0);
  return configureTexture(new THREE.CanvasTexture(nCanvas), false, anisoCap, repX, repY);
}

export function createProceduralTextures(
  maxAnisotropy: number,
  quality: GraphicsQuality = 'medium',
): ProceduralTextureSet {
  const textures: THREE.CanvasTexture[] = [];
  const track = (t: THREE.CanvasTexture) => {
    textures.push(t);
    return t;
  };

  const isLow = quality === 'low';
  const dimScale = isLow ? 0.75 : 1.0;
  const detailScale = isLow ? 0.55 : 1.0;
  const anisoCap = isLow
    ? Math.min(4, maxAnisotropy)
    : quality === 'medium'
      ? Math.min(8, maxAnisotropy)
      : Math.min(16, maxAnisotropy);
  const sz = (base: number) => Math.max(64, Math.round(base * dimScale));

  // 1. Terrain Albedo + Bump
  const tSize = sz(512);
  const [tCanvas, tCtx] = makeCanvas(tSize, tSize);
  tCtx.fillStyle = '#4a5538';
  tCtx.fillRect(0, 0, tSize, tSize);

  const grassDots = Math.round(3600 * detailScale);
  for (let i = 0; i < grassDots; i++) {
    const x = Math.random() * tSize;
    const y = Math.random() * tSize;
    const r = 1 + Math.random() * 3.5 * dimScale;
    tCtx.fillStyle =
      Math.random() > 0.6
        ? 'rgba(92, 102, 66, 0.22)'
        : Math.random() > 0.3
          ? 'rgba(56, 63, 42, 0.22)'
          : 'rgba(108, 95, 68, 0.18)';
    tCtx.fillRect(x, y, r, r);
  }
  const patchCount = Math.round(32 * detailScale);
  for (let i = 0; i < patchCount; i++) {
    const gx = Math.random() * tSize;
    const gy = Math.random() * tSize;
    const rad = (16 + Math.random() * 44) * dimScale;
    const grad = tCtx.createRadialGradient(gx, gy, 2, gx, gy, rad);
    grad.addColorStop(0, 'rgba(96, 84, 62, 0.24)');
    grad.addColorStop(1, 'rgba(96, 84, 62, 0)');
    tCtx.fillStyle = grad;
    tCtx.beginPath();
    tCtx.arc(gx, gy, rad, 0, Math.PI * 2);
    tCtx.fill();
  }

  const terrainAlbedo = track(
    configureTexture(new THREE.CanvasTexture(tCanvas), true, anisoCap, 36, 36),
  );

  // Bump maps skipped completely on Low quality to save mobile GPU bandwidth & VRAM
  let terrainBump: THREE.CanvasTexture | null = null;
  let concreteBump: THREE.CanvasTexture | null = null;
  if (!isLow) {
    const tbSize = sz(256);
    const [tbCanvas, tbCtx] = makeCanvas(tbSize, tbSize);
    tbCtx.fillStyle = '#808080';
    tbCtx.fillRect(0, 0, tbSize, tbSize);
    const bumpDots = Math.round(2400 * detailScale);
    for (let i = 0; i < bumpDots; i++) {
      const v = 90 + Math.floor(Math.random() * 80);
      tbCtx.fillStyle = `rgb(${v},${v},${v})`;
      tbCtx.fillRect(Math.random() * tbSize, Math.random() * tbSize, 2, 2);
    }
    terrainBump = track(
      configureTexture(new THREE.CanvasTexture(tbCanvas), false, anisoCap, 36, 36),
    );
    concreteBump = track(
      configureTexture(new THREE.CanvasTexture(tbCanvas), false, anisoCap, 2, 2),
    );
  }

  // 2. Concrete Texture
  const cSize = sz(512);
  const [cCanvas, cCtx] = makeCanvas(cSize, cSize);
  cCtx.fillStyle = '#7c8187';
  cCtx.fillRect(0, 0, cSize, cSize);
  const concreteSpecks = Math.round(3000 * detailScale);
  for (let i = 0; i < concreteSpecks; i++) {
    const shade = 100 + Math.floor(Math.random() * 52);
    cCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 5}, 0.24)`;
    cCtx.fillRect(Math.random() * cSize, Math.random() * cSize, 3, 3);
  }
  cCtx.strokeStyle = 'rgba(40, 44, 48, 0.35)';
  cCtx.lineWidth = Math.max(1.5, 3 * dimScale);
  for (let y = 0; y <= cSize; y += cSize / 4) {
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.lineTo(cSize, y);
    cCtx.stroke();
  }
  for (let x = 0; x <= cSize; x += cSize / 2) {
    cCtx.beginPath();
    cCtx.moveTo(x, 0);
    cCtx.lineTo(x, cSize);
    cCtx.stroke();
  }
  const concreteAlbedo = track(
    configureTexture(new THREE.CanvasTexture(cCanvas), true, anisoCap, 2, 2),
  );

  // 2b. Courtyard Concrete Texture
  const cySize = sz(512);
  const [cyCanvas, cyCtx] = makeCanvas(cySize, cySize);
  cyCtx.fillStyle = '#dfd4c1';
  cyCtx.fillRect(0, 0, cySize, cySize);
  const cySpecks = Math.round(2800 * detailScale);
  for (let i = 0; i < cySpecks; i++) {
    cyCtx.fillStyle =
      Math.random() > 0.5 ? 'rgba(186, 170, 146, 0.22)' : 'rgba(244, 238, 226, 0.22)';
    cyCtx.fillRect(Math.random() * cySize, Math.random() * cySize, 3, 3);
  }
  cyCtx.strokeStyle = 'rgba(155, 140, 118, 0.38)';
  cyCtx.lineWidth = Math.max(1, 2 * dimScale);
  for (let g = 0; g <= cySize; g += cySize / 4) {
    cyCtx.beginPath();
    cyCtx.moveTo(g, 0);
    cyCtx.lineTo(g, cySize);
    cyCtx.stroke();
    cyCtx.beginPath();
    cyCtx.moveTo(0, g);
    cyCtx.lineTo(cySize, g);
    cyCtx.stroke();
  }
  const courtyardConcrete = track(
    configureTexture(new THREE.CanvasTexture(cyCanvas), true, anisoCap, 12, 10),
  );

  // 2c. Wooden Plank Texture
  const wpSize = sz(256);
  const [wpCanvas, wpCtx] = makeCanvas(wpSize, wpSize);
  wpCtx.fillStyle = '#a37b52';
  wpCtx.fillRect(0, 0, wpSize, wpSize);
  const plankH = Math.max(10, Math.round(24 * dimScale));
  for (let y = 0; y < wpSize; y += plankH) {
    const shade = Math.floor(Math.random() * 20) - 10;
    wpCtx.fillStyle = `rgb(${164 + shade}, ${122 + shade}, ${82 + shade})`;
    wpCtx.fillRect(0, y, wpSize, plankH - 2);
    wpCtx.fillStyle = 'rgba(46, 30, 16, 0.42)';
    wpCtx.fillRect(0, y + plankH - 2, wpSize, 2);
  }
  const woodPlank = track(
    configureTexture(new THREE.CanvasTexture(wpCanvas), true, anisoCap, 2, 2),
  );

  // 2d. Hazard Stripe Band Texture
  const hzW = sz(256);
  const hzH = sz(128);
  const [hzCanvas, hzCtx] = makeCanvas(hzW, hzH);
  hzCtx.fillStyle = '#eab308';
  hzCtx.fillRect(0, 0, hzW, hzH);
  hzCtx.fillStyle = '#18181b';
  const stripeStep = Math.max(12, Math.round(32 * dimScale));
  for (let x = -hzW; x < hzW * 2; x += stripeStep) {
    hzCtx.beginPath();
    hzCtx.moveTo(x, 0);
    hzCtx.lineTo(x + stripeStep * 0.5, 0);
    hzCtx.lineTo(x + stripeStep * 0.5 + hzH * 0.5, hzH);
    hzCtx.lineTo(x + hzH * 0.5, hzH);
    hzCtx.closePath();
    hzCtx.fill();
  }
  const hazardStripe = track(
    configureTexture(new THREE.CanvasTexture(hzCanvas), true, anisoCap, 2, 1),
  );

  // 3. Corrugated Shipping Container Textures
  const ctW = sz(512);
  const ctH = sz(256);
  const buildContainerTex = (baseHex: string, stripeHex: string, code: string) => {
    const [canvas, ctx] = makeCanvas(ctW, ctH);
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, ctW, ctH);

    const ribStep = Math.max(6, Math.round(16 * dimScale));
    for (let x = 0; x < ctW; x += ribStep) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(x, 0, Math.max(2, ribStep * 0.31), ctH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(x + Math.max(2, ribStep * 0.31), 0, Math.max(2, ribStep * 0.25), ctH);
    }

    const grimeBottom = ctx.createLinearGradient(0, ctH * 0.7, 0, ctH);
    grimeBottom.addColorStop(0, 'rgba(20,20,20,0)');
    grimeBottom.addColorStop(1, 'rgba(15,15,15,0.45)');
    ctx.fillStyle = grimeBottom;
    ctx.fillRect(0, ctH * 0.7, ctW, ctH * 0.3);

    ctx.fillStyle = stripeHex;
    ctx.fillRect(ctW * 0.07, ctH * 0.19, ctW * 0.23, ctH * 0.047);
    ctx.fillStyle = 'rgba(245, 245, 245, 0.78)';
    ctx.font = `bold ${Math.max(12, Math.round(28 * dimScale))}px monospace`;
    ctx.fillText(code, ctW * 0.07, ctH * 0.38);

    return track(configureTexture(new THREE.CanvasTexture(canvas), true, anisoCap, 1, 1));
  };

  const containerRed = buildContainerTex('#b9382a', '#eab308', 'SEC-04');
  const containerOlive = buildContainerTex('#46543a', '#f97316', 'MIL-09');
  const containerNavy = buildContainerTex('#293c52', '#38bdf8', 'OP-72');
  const containerTeal = buildContainerTex('#1f7ca8', '#e0f2fe', 'DPT-18');

  let containerBump: THREE.CanvasTexture | null = null;
  if (!isLow) {
    const [cbCanvas, cbCtx] = makeCanvas(ctW, ctH);
    cbCtx.fillStyle = '#808080';
    cbCtx.fillRect(0, 0, ctW, ctH);
    const ribStep = Math.max(6, Math.round(16 * dimScale));
    for (let x = 0; x < ctW; x += ribStep) {
      cbCtx.fillStyle = '#404040';
      cbCtx.fillRect(x, 0, Math.max(2, ribStep * 0.37), ctH);
      cbCtx.fillStyle = '#c8c8c8';
      cbCtx.fillRect(x + Math.max(2, ribStep * 0.37), 0, Math.max(2, ribStep * 0.31), ctH);
    }
    containerBump = track(
      configureTexture(new THREE.CanvasTexture(cbCanvas), false, anisoCap, 1, 1),
    );
  }

  // 4. Wood Supply Crate
  const wSize = sz(256);
  const [wCanvas, wCtx] = makeCanvas(wSize, wSize);
  wCtx.fillStyle = '#6c5234';
  wCtx.fillRect(0, 0, wSize, wSize);
  const slatStep = Math.max(12, Math.round(32 * dimScale));
  for (let y = 0; y < wSize; y += slatStep) {
    wCtx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    wCtx.fillRect(0, y, wSize, Math.max(1.5, 3 * dimScale));
  }
  wCtx.strokeStyle = '#3b2b18';
  wCtx.lineWidth = Math.max(6, Math.round(14 * dimScale));
  wCtx.strokeRect(4, 4, wSize - 8, wSize - 8);
  wCtx.fillStyle = '#f59e0b';
  wCtx.fillRect(wSize * 0.22, wSize * 0.42, wSize * 0.56, wSize * 0.16);
  wCtx.fillStyle = '#111827';
  wCtx.font = `bold ${Math.max(10, Math.round(20 * dimScale))}px monospace`;
  wCtx.fillText('SUPPLY', wSize * 0.34, wSize * 0.53);
  const woodCrate = track(
    configureTexture(new THREE.CanvasTexture(wCanvas), true, anisoCap, 1, 1),
  );

  // 5. Brushed Gunmetal
  const mSize = sz(256);
  const [mCanvas, mCtx] = makeCanvas(mSize, mSize);
  mCtx.fillStyle = '#3b4048';
  mCtx.fillRect(0, 0, mSize, mSize);
  for (let y = 0; y < mSize; y += 2) {
    const shade = 50 + Math.floor(Math.random() * 24);
    mCtx.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 7})`;
    mCtx.fillRect(0, y, mSize, 1);
  }
  const brushedMetal = track(
    configureTexture(new THREE.CanvasTexture(mCanvas), true, anisoCap, 1, 1),
  );

  // 6. Soft Radial Contact Shadow
  const sSize = isLow ? 64 : 128;
  const [sCanvas, sCtx] = makeCanvas(sSize, sSize);
  const half = sSize / 2;
  const sGrad = sCtx.createRadialGradient(half, half, half * 0.12, half, half, half * 0.94);
  sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  sGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.26)');
  sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, sSize, sSize);
  const contactShadow = track(
    configureTexture(new THREE.CanvasTexture(sCanvas), true, anisoCap, 1, 1),
  );
  contactShadow.wrapS = THREE.ClampToEdgeWrapping;
  contactShadow.wrapT = THREE.ClampToEdgeWrapping;

  // 7. Asphalt Road Texture (aggregate grit, tire wear lanes & tar seams)
  const aSize = sz(512);
  const [aCanvas, aCtx] = makeCanvas(aSize, aSize);
  aCtx.fillStyle = '#3d4147';
  aCtx.fillRect(0, 0, aSize, aSize);
  const aSpecks = Math.round(3200 * detailScale);
  for (let i = 0; i < aSpecks; i++) {
    const shade = 42 + Math.floor(Math.random() * 44);
    aCtx.fillStyle = `rgba(${shade}, ${shade + 2}, ${shade + 5}, 0.34)`;
    aCtx.fillRect(Math.random() * aSize, Math.random() * aSize, 2, 2);
  }
  // Subtle tar crack lines
  aCtx.strokeStyle = 'rgba(20, 22, 26, 0.42)';
  aCtx.lineWidth = Math.max(1, 1.5 * dimScale);
  for (let c = 0; c < 4; c++) {
    let cx = Math.random() * aSize;
    let cy = Math.random() * aSize;
    aCtx.beginPath();
    aCtx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (Math.random() - 0.5) * aSize * 0.22;
      cy += (Math.random() - 0.5) * aSize * 0.22;
      aCtx.lineTo(cx, cy);
    }
    aCtx.stroke();
  }
  const asphaltAlbedo = track(
    configureTexture(new THREE.CanvasTexture(aCanvas), true, anisoCap, 14, 10),
  );

  // 8. Stratified Mountain / Cliff Rock Texture
  const rSize = sz(256);
  const [rCanvas, rCtx] = makeCanvas(rSize, rSize);
  rCtx.fillStyle = '#61605b';
  rCtx.fillRect(0, 0, rSize, rSize);
  for (let y = 0; y < rSize; y += Math.max(4, Math.round(10 * dimScale))) {
    const delta = Math.floor(Math.random() * 24) - 12;
    rCtx.fillStyle = `rgba(${96 + delta}, ${94 + delta}, ${88 + delta}, 0.32)`;
    rCtx.fillRect(0, y, rSize, Math.max(3, Math.round(8 * dimScale)));
  }
  const rockDots = Math.round(1200 * detailScale);
  for (let i = 0; i < rockDots; i++) {
    const shade = 70 + Math.floor(Math.random() * 65);
    rCtx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 4}, 0.25)`;
    rCtx.fillRect(Math.random() * rSize, Math.random() * rSize, 3, 2);
  }
  const rockAlbedo = track(
    configureTexture(new THREE.CanvasTexture(rCanvas), true, anisoCap, 3, 3),
  );

  // 9. Stucco / Industrial Wall Panel Texture (neutral white base so palette color tints cleanly)
  const swSize = sz(256);
  const [swCanvas, swCtx] = makeCanvas(swSize, swSize);
  swCtx.fillStyle = '#efefef';
  swCtx.fillRect(0, 0, swSize, swSize);
  const swDots = Math.round(1100 * detailScale);
  for (let i = 0; i < swDots; i++) {
    const v = 212 + Math.floor(Math.random() * 34);
    swCtx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    swCtx.fillRect(Math.random() * swSize, Math.random() * swSize, 3, 3);
  }
  swCtx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  swCtx.lineWidth = Math.max(1, 2 * dimScale);
  swCtx.strokeRect(1, 1, swSize - 2, swSize - 2);
  swCtx.beginPath();
  swCtx.moveTo(0, swSize * 0.5);
  swCtx.lineTo(swSize, swSize * 0.5);
  swCtx.stroke();
  const stuccoWall = track(
    configureTexture(new THREE.CanvasTexture(swCanvas), true, anisoCap, 3, 2),
  );

  // 10. Corrugated Roof Ribbed Sheet Texture (neutral tintable base)
  const crSize = sz(256);
  const [crCanvas, crCtx] = makeCanvas(crSize, crSize);
  crCtx.fillStyle = '#e5e7eb';
  crCtx.fillRect(0, 0, crSize, crSize);
  const roofRib = Math.max(6, Math.round(16 * dimScale));
  for (let x = 0; x < crSize; x += roofRib) {
    crCtx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    crCtx.fillRect(x, 0, Math.max(2, roofRib * 0.35), crSize);
    crCtx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    crCtx.fillRect(x + Math.max(2, roofRib * 0.35), 0, Math.max(2, roofRib * 0.3), crSize);
  }
  const corrugatedRoof = track(
    configureTexture(new THREE.CanvasTexture(crCanvas), true, anisoCap, 4, 2),
  );

  // 11. Bullet Strike / Crater Decal Texture (alpha-masked dark impact hole + cracked rim)
  const bhSize = isLow ? 64 : 128;
  const [bhCanvas, bhCtx] = makeCanvas(bhSize, bhSize);
  const bhCenter = bhSize * 0.5;
  const bhScorch = bhCtx.createRadialGradient(
    bhCenter,
    bhCenter,
    bhSize * 0.08,
    bhCenter,
    bhCenter,
    bhSize * 0.48,
  );
  bhScorch.addColorStop(0, 'rgba(10, 10, 12, 0.96)');
  bhScorch.addColorStop(0.32, 'rgba(24, 24, 28, 0.85)');
  bhScorch.addColorStop(0.55, 'rgba(55, 55, 62, 0.42)');
  bhScorch.addColorStop(1, 'rgba(0, 0, 0, 0)');
  bhCtx.fillStyle = bhScorch;
  bhCtx.beginPath();
  bhCtx.arc(bhCenter, bhCenter, bhSize * 0.48, 0, Math.PI * 2);
  bhCtx.fill();

  bhCtx.strokeStyle = 'rgba(20, 20, 24, 0.72)';
  bhCtx.lineWidth = Math.max(1, bhSize * 0.025);
  for (let k = 0; k < 7; k++) {
    const ang = (k / 7) * Math.PI * 2 + (k % 2) * 0.25;
    bhCtx.beginPath();
    bhCtx.moveTo(bhCenter + Math.cos(ang) * bhSize * 0.14, bhCenter + Math.sin(ang) * bhSize * 0.14);
    bhCtx.lineTo(bhCenter + Math.cos(ang) * bhSize * 0.42, bhCenter + Math.sin(ang) * bhSize * 0.42);
    bhCtx.stroke();
  }
  bhCtx.fillStyle = 'rgba(5, 5, 7, 0.98)';
  bhCtx.beginPath();
  bhCtx.arc(bhCenter, bhCenter, bhSize * 0.18, 0, Math.PI * 2);
  bhCtx.fill();

  const bulletHoleTex = track(
    configureTexture(new THREE.CanvasTexture(bhCanvas), true, anisoCap, 1, 1),
  );
  bulletHoleTex.wrapS = THREE.ClampToEdgeWrapping;
  bulletHoleTex.wrapT = THREE.ClampToEdgeWrapping;

  // 12. Tileable PBR Normal / Roughness / Bark / Soil / Dual Animated Water Normal Maps
  const pbrSz = isLow ? 64 : quality === 'medium' ? 128 : 256;

  // 12a. Terrain Detail Normal + Roughness
  let terrainNormal: THREE.CanvasTexture | null = null;
  let terrainRoughness: THREE.CanvasTexture | null = null;
  let rockNormal: THREE.CanvasTexture | null = null;
  let asphaltNormal: THREE.CanvasTexture | null = null;
  let barkNormal: THREE.CanvasTexture | null = null;

  if (!isLow) {
    const tHeights = new Float32Array(pbrSz * pbrSz);
    const rHeights = new Float32Array(pbrSz * pbrSz);
    const aHeights = new Float32Array(pbrSz * pbrSz);
    const bHeights = new Float32Array(pbrSz * pbrSz);
    const [trCanvas, trCtx] = makeCanvas(pbrSz, pbrSz);
    const trImg = trCtx.createImageData(pbrSz, pbrSz);

    for (let y = 0; y < pbrSz; y++) {
      const v = y / pbrSz;
      for (let x = 0; x < pbrSz; x++) {
        const u = x / pbrSz;
        const idx = y * pbrSz + x;
        const g = tileableFbm(u, v, 8, 4, 1.7);
        tHeights[idx] = g;

        // Stratified ridged rock heightfield
        const strata = 0.5 + 0.5 * Math.sin((v * 5 + g * 0.65) * Math.PI * 2);
        const ridge = 1 - Math.abs(tileableFbm(u, v, 6, 4, 9.2) * 2 - 1);
        rHeights[idx] = ridge * 0.68 + strata * 0.32;

        // Micro asphalt aggregate grain
        aHeights[idx] = tileableFbm(u, v, 16, 3, 22.1);

        // Vertical fibrous tree bark grooves
        const barkGrain = tileableFbm(u * 2.5, v * 0.45, 8, 4, 41.3);
        const furrow = Math.sin((u * 12 + barkGrain * 1.4) * Math.PI * 2) * 0.5 + 0.5;
        bHeights[idx] = barkGrain * 0.48 + furrow * 0.52;

        const rVal = Math.round(THREE.MathUtils.clamp(178 + (1 - g) * 65, 140, 248));
        trImg.data[idx * 4] = rVal;
        trImg.data[idx * 4 + 1] = rVal;
        trImg.data[idx * 4 + 2] = rVal;
        trImg.data[idx * 4 + 3] = 255;
      }
    }
    trCtx.putImageData(trImg, 0, 0);
    terrainRoughness = track(configureTexture(new THREE.CanvasTexture(trCanvas), false, anisoCap, 36, 36));
    terrainNormal = track(buildNormalMapFromHeight(pbrSz, tHeights, 3.2, anisoCap, 36, 36));
    rockNormal = track(buildNormalMapFromHeight(pbrSz, rHeights, 4.8, anisoCap, 4, 4));
    asphaltNormal = track(buildNormalMapFromHeight(pbrSz, aHeights, 2.1, anisoCap, 14, 10));
    barkNormal = track(buildNormalMapFromHeight(pbrSz, bHeights, 4.4, anisoCap, 2, 3));
  }

  // 12b. Organic Rich Soil / Gravel Albedo
  const sTile = sz(256);
  const [soilCanvas, soilCtx] = makeCanvas(sTile, sTile);
  soilCtx.fillStyle = '#6f5a42';
  soilCtx.fillRect(0, 0, sTile, sTile);
  for (let i = 0; i < Math.round(1800 * detailScale); i++) {
    const shade = 75 + Math.floor(Math.random() * 52);
    soilCtx.fillStyle = `rgba(${shade + 18}, ${shade + 4}, ${shade - 12}, 0.28)`;
    soilCtx.fillRect(Math.random() * sTile, Math.random() * sTile, 3, 2);
  }
  const soilAlbedo = track(configureTexture(new THREE.CanvasTexture(soilCanvas), true, anisoCap, 16, 16));

  // 12c. Tree Bark Albedo (fibrous warm oak/pine bark)
  const bTile = sz(256);
  const [barkCanvas, barkCtx] = makeCanvas(bTile, bTile);
  barkCtx.fillStyle = '#4f3b2b';
  barkCtx.fillRect(0, 0, bTile, bTile);
  for (let x = 0; x < bTile; x += Math.max(3, Math.round(5 * dimScale))) {
    const d = Math.floor(Math.random() * 26) - 13;
    barkCtx.fillStyle = `rgba(${78 + d}, ${58 + d}, ${42 + d}, 0.45)`;
    barkCtx.fillRect(x, 0, Math.max(2, Math.round(4 * dimScale)), bTile);
  }
  for (let i = 0; i < Math.round(600 * detailScale); i++) {
    barkCtx.fillStyle = Math.random() > 0.5 ? 'rgba(34,24,16,0.35)' : 'rgba(116,94,68,0.25)';
    barkCtx.fillRect(Math.random() * bTile, Math.random() * bTile, 2, 10 + Math.random() * 14);
  }
  const barkAlbedo = track(configureTexture(new THREE.CanvasTexture(barkCanvas), true, anisoCap, 2, 3));

  // 12d. Dual Seamless Animated Water Normal Maps (always generated so water ripples on every preset)
  const wSz = isLow ? 64 : 128;
  const wHA = new Float32Array(wSz * wSz);
  const wHB = new Float32Array(wSz * wSz);
  for (let y = 0; y < wSz; y++) {
    const v = y / wSz;
    for (let x = 0; x < wSz; x++) {
      const u = x / wSz;
      const idx = y * wSz + x;
      wHA[idx] =
        tileableFbm(u, v, 6, 3, 3.1) * 0.65 +
        Math.sin((u * 4 + v * 2) * Math.PI * 2) * 0.18 +
        Math.cos((v * 5 - u * 1) * Math.PI * 2) * 0.17;
      wHB[idx] =
        tileableFbm(u, v, 9, 3, 14.7) * 0.65 +
        Math.sin((u * 3 - v * 5) * Math.PI * 2) * 0.18 +
        Math.cos((u * 6 + v * 3) * Math.PI * 2) * 0.17;
    }
  }
  const waterNormalA = track(buildNormalMapFromHeight(wSz, wHA, 3.0, anisoCap, 18, 18));
  const waterNormalB = track(buildNormalMapFromHeight(wSz, wHB, 2.6, anisoCap, 24, 24));

  // 12e. Modern Architectural Curtain-Glass Tower Facade (mullions + tinted sky glass + lit office bays)
  const fgSz = sz(256);
  const [fgCanvas, fgCtx] = makeCanvas(fgSz, fgSz);
  fgCtx.fillStyle = '#1e2f42';
  fgCtx.fillRect(0, 0, fgSz, fgSz);
  const fgCols = 8;
  const fgRows = 8;
  const fgW = fgSz / fgCols;
  const fgH = fgSz / fgRows;
  for (let r = 0; r < fgRows; r++) {
    for (let c = 0; c < fgCols; c++) {
      const lit = (r * 7 + c * 13) % 5 === 0;
      const gx = c * fgW;
      const gy = r * fgH;
      fgCtx.fillStyle = lit ? '#68a9cc' : (r + c) % 2 === 0 ? '#2b4c6f' : '#233f5e';
      fgCtx.fillRect(gx + 2, gy + 3, fgW - 4, fgH - 6);
      // Subtle specular reflection diagonal streak
      fgCtx.fillStyle = 'rgba(210, 238, 255, 0.14)';
      fgCtx.fillRect(gx + 3, gy + 4, (fgW - 6) * 0.42, fgH - 8);
      // Crisp aluminum mullion horizontal spandrel
      fgCtx.fillStyle = '#475569';
      fgCtx.fillRect(gx, gy, fgW, 3);
      fgCtx.fillRect(gx, gy, 2, fgH);
    }
  }
  const facadeGlassGrid = track(configureTexture(new THREE.CanvasTexture(fgCanvas), true, anisoCap, 2, 3));

  // 12f. Warm Architectural Sandstone / Brick Masonry Facade with recessed window bays
  const fmSz = sz(256);
  const [fmCanvas, fmCtx] = makeCanvas(fmSz, fmSz);
  fmCtx.fillStyle = '#c8aa8a';
  fmCtx.fillRect(0, 0, fmSz, fmSz);
  const fmStep = fmSz / 8;
  for (let r = 0; r < 16; r++) {
    const rowH = fmSz / 16;
    fmCtx.fillStyle = r % 2 === 0 ? 'rgba(90,62,42,0.08)' : 'rgba(255,244,230,0.09)';
    fmCtx.fillRect(0, r * rowH, fmSz, rowH - 1);
    fmCtx.fillStyle = 'rgba(72,50,35,0.16)';
    fmCtx.fillRect(0, r * rowH + rowH - 1, fmSz, 1);
  }
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const wx = c * (fmSz / 4) + fmStep * 0.35;
      const wy = r * (fmSz / 4) + fmStep * 0.4;
      const ww = fmSz / 4 - fmStep * 0.7;
      const wh = fmSz / 4 - fmStep * 0.75;
      fmCtx.fillStyle = '#a88766';
      fmCtx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      fmCtx.fillStyle = '#334e68';
      fmCtx.fillRect(wx, wy, ww, wh);
      fmCtx.fillStyle = 'rgba(248, 250, 252, 0.25)';
      fmCtx.fillRect(wx + ww * 0.48, wy, 2, wh);
      fmCtx.fillRect(wx, wy + wh * 0.5, ww, 2);
    }
  }
  const facadeMasonryWarm = track(configureTexture(new THREE.CanvasTexture(fmCanvas), true, anisoCap, 2, 2));

  // 12g. Sleek Contemporary Architectural Paneling (matte composite panels + gold/slate seams)
  const fpSz = sz(256);
  const [fpCanvas, fpCtx] = makeCanvas(fpSz, fpSz);
  fpCtx.fillStyle = '#d4d8df';
  fpCtx.fillRect(0, 0, fpSz, fpSz);
  const pCols = 4;
  const pRows = 6;
  const pW = fpSz / pCols;
  const pH = fpSz / pRows;
  for (let r = 0; r < pRows; r++) {
    for (let c = 0; c < pCols; c++) {
      const shade = 204 + ((r * 5 + c * 11) % 3) * 10;
      fpCtx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
      fpCtx.fillRect(c * pW + 2, r * pH + 2, pW - 4, pH - 4);
      fpCtx.fillStyle = 'rgba(30, 41, 59, 0.22)';
      fpCtx.fillRect(c * pW, r * pH, pW, 2);
      fpCtx.fillRect(c * pW, r * pH, 2, pH);
    }
  }
  const facadeModernPanel = track(configureTexture(new THREE.CanvasTexture(fpCanvas), true, anisoCap, 2, 2));

  // 12h. Polished Terrazzo / Carrara Marble Floor (smooth sculpted non-blocky mall deck)
  const mmSz = sz(256);
  const [mmCanvas, mmCtx] = makeCanvas(mmSz, mmSz);
  mmCtx.fillStyle = '#ddd7ce';
  mmCtx.fillRect(0, 0, mmSz, mmSz);
  for (let i = 0; i < Math.round(900 * detailScale); i++) {
    const shade = 185 + Math.floor(Math.random() * 44);
    mmCtx.fillStyle = i % 9 === 0 ? 'rgba(196, 154, 72, 0.22)' : `rgba(${shade}, ${shade - 4}, ${shade - 10}, 0.28)`;
    const r = 1 + Math.random() * 2.5;
    mmCtx.beginPath();
    mmCtx.arc(Math.random() * mmSz, Math.random() * mmSz, r, 0, Math.PI * 2);
    mmCtx.fill();
  }
  // Subtle organic marble veins (continuous, no checkerboard blocks)
  mmCtx.strokeStyle = 'rgba(156, 146, 134, 0.24)';
  mmCtx.lineWidth = 1.4;
  for (let v = 0; v < 6; v++) {
    mmCtx.beginPath();
    let vx = 0;
    let vy = (v / 6) * mmSz;
    mmCtx.moveTo(vx, vy);
    for (let s = 1; s <= 6; s++) {
      vx = (s / 6) * mmSz;
      vy += (Math.sin(s * 1.7 + v * 2.3) * 14);
      mmCtx.lineTo(vx, vy);
    }
    mmCtx.stroke();
  }
  const mallMarbleTile = track(configureTexture(new THREE.CanvasTexture(mmCanvas), true, anisoCap, 8, 8));

  // 12i. Oiled Walnut Gunstock Texture (warm reddish-brown grain for AK-47 furniture & grip)
  const wwSz = sz(256);
  const [wwCanvas, wwCtx] = makeCanvas(wwSz, wwSz);
  wwCtx.fillStyle = '#7c3f1d';
  wwCtx.fillRect(0, 0, wwSz, wwSz);
  for (let y = 0; y < wwSz; y += 2) {
    const wave = Math.sin(y * 0.14) * 12;
    const tone = Math.floor(Math.random() * 18);
    wwCtx.fillStyle = `rgba(${110 + tone + Math.round(wave)}, ${50 + Math.round(tone * 0.5)}, ${20}, 0.34)`;
    wwCtx.fillRect(0, y, wwSz, 2);
  }
  wwCtx.strokeStyle = 'rgba(42, 16, 6, 0.32)';
  wwCtx.lineWidth = 1.4;
  for (let g = 0; g < 18; g++) {
    wwCtx.beginPath();
    const baseY = (g / 18) * wwSz;
    wwCtx.moveTo(0, baseY);
    for (let x = 0; x <= wwSz; x += 24) {
      wwCtx.lineTo(x, baseY + Math.sin(x * 0.04 + g) * 6);
    }
    wwCtx.stroke();
  }
  const woodWalnut = track(configureTexture(new THREE.CanvasTexture(wwCanvas), true, anisoCap, 1, 1));

  return {
    terrainAlbedo,
    terrainBump,
    terrainNormal,
    terrainRoughness,
    asphaltAlbedo,
    asphaltNormal,
    rockAlbedo,
    rockNormal,
    soilAlbedo,
    barkAlbedo,
    barkNormal,
    waterNormalA,
    waterNormalB,
    stuccoWall,
    corrugatedRoof,
    concreteAlbedo,
    concreteBump,
    courtyardConcrete,
    woodPlank,
    hazardStripe,
    containerRed,
    containerOlive,
    containerNavy,
    containerTeal,
    containerBump,
    woodCrate,
    brushedMetal,
    facadeGlassGrid,
    facadeMasonryWarm,
    facadeModernPanel,
    mallMarbleTile,
    woodWalnut,
    contactShadow,
    bulletHoleTex,
    dispose: () => {
      textures.forEach((t) => t.dispose());
    },
  };
}
