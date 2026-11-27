import * as THREE from 'three';
import type { DigitalDisplayManager } from './digitalDisplays';
import { SCIENCE_DOME_VIDEO_PLAYLISTS } from './scienceDistrictSystems';

export interface ScienceExhibitAnimEntry {
  zoneKey: 'plaza' | 'future_lab' | 'science_museum' | `dome_${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  update: (elapsed: number, dt: number, boost: boolean) => void;
}

export interface ScienceExhibitMaterialBank {
  whiteMetal: THREE.MeshStandardMaterial;
  slateMetal: THREE.MeshStandardMaterial;
  chromeMetal: THREE.MeshStandardMaterial;
  goldMetal: THREE.MeshStandardMaterial;
  boneFossil: THREE.MeshStandardMaterial;
  cyanGlow: THREE.MeshBasicMaterial;
  amberGlow: THREE.MeshBasicMaterial;
  crimsonPaint: THREE.MeshStandardMaterial;
  silverPaint: THREE.MeshStandardMaterial;
  dinoGreen: THREE.MeshStandardMaterial;
  oceanShark: THREE.MeshStandardMaterial;
  crystalPurple: THREE.MeshStandardMaterial;
  crystalCyan: THREE.MeshStandardMaterial;
  holoBlue: THREE.MeshBasicMaterial;
  sharedGeos: THREE.BufferGeometry[];
  sharedMats: THREE.Material[];
}

export function createExhibitMaterialBank(isReducedQ: boolean): ScienceExhibitMaterialBank {
  const mkStd = (color: number, roughness: number, metalness: number, extra?: Partial<THREE.MeshStandardMaterialParameters>) =>
    isReducedQ
      ? new THREE.MeshLambertMaterial({ color, ...(extra?.emissive ? { emissive: extra.emissive, emissiveIntensity: extra.emissiveIntensity ?? 0.6 } : {}) }) as unknown as THREE.MeshStandardMaterial
      : new THREE.MeshStandardMaterial({ color, roughness, metalness: Math.min(metalness, 0.32), ...extra });

  const whiteMetal = mkStd(0xf8fafc, 0.28, 0.18, { emissive: 0x1e293b, emissiveIntensity: 0.12 });
  const slateMetal = mkStd(0x64748b, 0.36, 0.25);
  const chromeMetal = mkStd(0xe2e8f0, 0.2, 0.32);
  const goldMetal = mkStd(0xfbbf24, 0.25, 0.32, { emissive: 0x78350f, emissiveIntensity: 0.28 });
  const boneFossil = mkStd(0xe7dcc6, 0.65, 0.06, { emissive: 0x443825, emissiveIntensity: 0.18 });
  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const amberGlow = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  const crimsonPaint = mkStd(0xef4444, 0.25, 0.24, { emissive: 0x7f1d1d, emissiveIntensity: 0.16 });
  const silverPaint = mkStd(0xdbeafe, 0.24, 0.28, { emissive: 0x1e3a5f, emissiveIntensity: 0.12 });
  const dinoGreen = mkStd(0x65a30d, 0.62, 0.08);
  const oceanShark = mkStd(0x94a3b8, 0.38, 0.22);
  const crystalPurple = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.9,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88,
  });
  const crystalCyan = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.95,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.86,
  });
  const holoBlue = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const sharedMats: THREE.Material[] = [
    whiteMetal,
    slateMetal,
    chromeMetal,
    goldMetal,
    boneFossil,
    cyanGlow,
    amberGlow,
    crimsonPaint,
    silverPaint,
    dinoGreen,
    oceanShark,
    crystalPurple,
    crystalCyan,
    holoBlue,
  ];
  return {
    whiteMetal,
    slateMetal,
    chromeMetal,
    goldMetal,
    boneFossil,
    cyanGlow,
    amberGlow,
    crimsonPaint,
    silverPaint,
    dinoGreen,
    oceanShark,
    crystalPurple,
    crystalCyan,
    holoBlue,
    sharedGeos: [],
    sharedMats,
  };
}

export function createSignBannerTexture(
  title: string,
  subtitle: string,
  opts?: { bg?: string; border?: string; accent?: string; lines?: string[]; badge?: string; w?: number; h?: number },
): THREE.CanvasTexture {
  const w = opts?.w ?? 1024;
  const h = opts?.h ?? 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, opts?.bg ?? '#071328');
    grad.addColorStop(1, '#0b1e3d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = opts?.border ?? '#38bdf8';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Subtle futuristic gridlines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 2;
    for (let x = 48; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x, h - 14);
      ctx.stroke();
    }

    if (opts?.badge === 'atom') {
      ctx.save();
      ctx.translate(115, h * 0.5);
      ctx.strokeStyle = opts?.accent ?? '#38bdf8';
      ctx.lineWidth = 6;
      for (let a = 0; a < 3; a++) {
        ctx.save();
        ctx.rotate((a * Math.PI) / 3);
        ctx.beginPath();
        ctx.ellipse(0, 0, 58, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (opts?.badge === 'museum') {
      ctx.save();
      ctx.translate(w * 0.5, 58);
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(-64, 0);
      ctx.lineTo(0, -32);
      ctx.lineTo(64, 0);
      ctx.closePath();
      ctx.fill();
      for (let p = -44; p <= 44; p += 29) {
        ctx.fillRect(p - 6, 4, 12, 34);
      }
      ctx.fillRect(-68, 40, 136, 8);
      ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = opts?.lines ? 'left' : 'center';
    const textX = opts?.lines ? 48 : opts?.badge === 'atom' ? w * 0.56 : w * 0.5;
    if (opts?.lines && opts.lines.length > 0) {
      ctx.font = 'bold 42px sans-serif';
      ctx.fillStyle = opts?.accent ?? '#38bdf8';
      ctx.fillText(title, 48, 66);
      ctx.font = 'bold 34px sans-serif';
      ctx.fillStyle = '#e2e8f0';
      opts.lines.forEach((line, idx) => {
        ctx.fillText(`•  ${line}`, 54, 128 + idx * 54);
      });
    } else {
      ctx.font = `bold ${opts?.badge === 'museum' ? 76 : 82}px sans-serif`;
      ctx.fillText(title, textX, opts?.badge === 'museum' ? h * 0.62 : h * 0.52);
      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = opts?.accent ?? '#67e8f9';
      ctx.fillText(subtitle, textX, opts?.badge === 'museum' ? h * 0.84 : h * 0.76);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createEarthGlobeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const bg = ctx.createLinearGradient(0, 0, 0, 256);
    bg.addColorStop(0, '#0c4a6e');
    bg.addColorStop(0.5, '#0369a1');
    bg.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);

    // Stylized glowing cyan continents + holographic latitude lines
    ctx.fillStyle = '#38bdf8';
    const blobs = [
      [110, 95, 55, 42],
      [145, 165, 32, 55],
      [270, 82, 72, 48],
      [295, 145, 38, 45],
      [395, 110, 62, 52],
      [425, 185, 35, 22],
    ];
    blobs.forEach(([x, y, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.25, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.lineWidth = 1.5;
    for (let y = 32; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    for (let x = 0; x < 512; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural matte dark hexagonal cell armor texture with glowing crimson-red recessed seams
 * matching the Future City perimeter wall reference.
 */
export function createHexRedPerimeterWallMaterial(
  isReducedQ: boolean,
  texturesOut: THREE.Texture[],
): THREE.MeshStandardMaterial {
  const w = 512;
  const h = 512;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = w;
  diffCanvas.height = h;
  const dCtx = diffCanvas.getContext('2d');

  const emCanvas = document.createElement('canvas');
  emCanvas.width = w;
  emCanvas.height = h;
  const eCtx = emCanvas.getContext('2d');

  if (dCtx && eCtx) {
    dCtx.fillStyle = '#dc2626';
    dCtx.fillRect(0, 0, w, h);
    eCtx.fillStyle = '#ef4444';
    eCtx.fillRect(0, 0, w, h);

    const r = 46;
    const dx = r * 1.58;
    const dy = r * Math.sqrt(3) * 0.56;
    const rows = Math.ceil(h / dy) + 3;
    const cols = Math.ceil(w / dx) + 3;

    const drawHexTile = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      rad: number,
      fill: string | CanvasGradient,
      stroke?: string,
    ) => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI / 3) * k;
        const px = cx + Math.cos(ang) * rad;
        const py = cy + Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    for (let c = -1; c < cols; c++) {
      for (let row = -1; row < rows; row++) {
        const cx = c * dx;
        const cy = row * (dy * 1.85) + (c % 2 === 0 ? 0 : dy * 0.925);
        const grad = dCtx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        grad.addColorStop(0, '#272a30');
        grad.addColorStop(0.55, '#191b20');
        grad.addColorStop(1, '#101216');
        drawHexTile(dCtx, cx, cy, r * 0.87, grad, '#33373f');
        drawHexTile(eCtx, cx, cy, r * 0.86, '#050203');
      }
    }
  }

  const diffTex = new THREE.CanvasTexture(diffCanvas);
  diffTex.colorSpace = THREE.SRGBColorSpace;
  diffTex.wrapS = THREE.RepeatWrapping;
  diffTex.wrapT = THREE.RepeatWrapping;
  diffTex.repeat.set(6, 2);

  const emTex = new THREE.CanvasTexture(emCanvas);
  emTex.colorSpace = THREE.SRGBColorSpace;
  emTex.wrapS = THREE.RepeatWrapping;
  emTex.wrapT = THREE.RepeatWrapping;
  emTex.repeat.set(6, 2);

  texturesOut.push(diffTex, emTex);
  if (isReducedQ) {
    return new THREE.MeshLambertMaterial({
      map: diffTex,
      emissive: 0xef4444,
      emissiveMap: emTex,
      emissiveIntensity: 1.15,
    }) as unknown as THREE.MeshStandardMaterial;
  }
  return new THREE.MeshStandardMaterial({
    map: diffTex,
    emissive: 0xff2a2a,
    emissiveMap: emTex,
    emissiveIntensity: 1.35,
    roughness: 0.42,
    metalness: 0.35,
  });
}

/**
 * Generates the 3 futuristic cyber interior wall materials matching the user's reference photos:
 * 1) Origami White Polygonal Facets + Cyan Neon Seams
 * 2) Cool-Grey Layered AI Panel Wall + Glowing Cyan Channels
 * 3) Dark Charcoal Wall + Vertical & 45-Degree Branching Electric-Blue LED Circuits
 */
export function createCyberInteriorWallMaterials(
  isReducedQ: boolean,
  texturesOut: THREE.Texture[],
): {
  origamiWhiteMat: THREE.Material;
  cyberGreyAiMat: THREE.Material;
  darkCircuitBlueMat: THREE.Material;
} {
  const mkRepeatedPair = (
    draw: (dCtx: CanvasRenderingContext2D, eCtx: CanvasRenderingContext2D, w: number, h: number) => void,
    rx: number,
    ry: number,
    rough: number,
    metal: number,
    emHex: number,
    emInt: number,
  ): THREE.Material => {
    const w = 512;
    const h = 512;
    const dc = document.createElement('canvas');
    dc.width = w;
    dc.height = h;
    const ec = document.createElement('canvas');
    ec.width = w;
    ec.height = h;
    const dCtx = dc.getContext('2d');
    const eCtx = ec.getContext('2d');
    if (dCtx && eCtx) draw(dCtx, eCtx, w, h);

    const dTex = new THREE.CanvasTexture(dc);
    dTex.colorSpace = THREE.SRGBColorSpace;
    dTex.wrapS = THREE.RepeatWrapping;
    dTex.wrapT = THREE.RepeatWrapping;
    dTex.repeat.set(rx, ry);

    const eTex = new THREE.CanvasTexture(ec);
    eTex.colorSpace = THREE.SRGBColorSpace;
    eTex.wrapS = THREE.RepeatWrapping;
    eTex.wrapT = THREE.RepeatWrapping;
    eTex.repeat.set(rx, ry);
    texturesOut.push(dTex, eTex);

    if (isReducedQ) {
      return new THREE.MeshLambertMaterial({
        map: dTex,
        emissive: emHex,
        emissiveMap: eTex,
        emissiveIntensity: emInt,
      });
    }
    return new THREE.MeshStandardMaterial({
      map: dTex,
      emissive: emHex,
      emissiveMap: eTex,
      emissiveIntensity: emInt,
      roughness: rough,
      metalness: metal,
    });
  };

  // 1) White Origami Facets + Cyan Neon Seams
  const origamiWhiteMat = mkRepeatedPair(
    (dCtx, eCtx, w, h) => {
      const tris: Array<[number[], string]> = [
        [[0, 0, 260, 0, 145, 220], '#f8fafc'],
        [[260, 0, 512, 0, 380, 185], '#eef4fa'],
        [[260, 0, 380, 185, 145, 220], '#e2ecf6'],
        [[0, 0, 145, 220, 0, 360], '#eef2f7'],
        [[145, 220, 380, 185, 290, 390], '#ffffff'],
        [[380, 185, 512, 0, 512, 310], '#e5eef8'],
        [[380, 185, 512, 310, 290, 390], '#f1f5f9'],
        [[0, 360, 145, 220, 180, 512], '#f8fafc'],
        [[145, 220, 290, 390, 180, 512], '#dce8f5'],
        [[290, 390, 512, 310, 512, 512], '#f1f6fb'],
        [[290, 390, 512, 512, 180, 512], '#e8f0f9'],
        [[0, 360, 180, 512, 0, 512], '#e2e8f0'],
      ];
      eCtx.fillStyle = '#000000';
      eCtx.fillRect(0, 0, w, h);
      tris.forEach(([pts, col]) => {
        dCtx.beginPath();
        dCtx.moveTo(pts[0], pts[1]);
        dCtx.lineTo(pts[2], pts[3]);
        dCtx.lineTo(pts[4], pts[5]);
        dCtx.closePath();
        dCtx.fillStyle = col;
        dCtx.fill();
        dCtx.strokeStyle = '#67e8f9';
        dCtx.lineWidth = 4;
        dCtx.stroke();

        eCtx.beginPath();
        eCtx.moveTo(pts[0], pts[1]);
        eCtx.lineTo(pts[2], pts[3]);
        eCtx.lineTo(pts[4], pts[5]);
        eCtx.closePath();
        eCtx.strokeStyle = '#22d3ee';
        eCtx.lineWidth = 4;
        eCtx.stroke();
      });
    },
    3,
    2,
    0.26,
    0.12,
    0x22d3ee,
    1.15,
  );

  // 2) Cool-Grey Layered Diagonal Cyber AI Panels
  const cyberGreyAiMat = mkRepeatedPair(
    (dCtx, eCtx, w, h) => {
      dCtx.fillStyle = '#475569';
      dCtx.fillRect(0, 0, w, h);
      eCtx.fillStyle = '#000000';
      eCtx.fillRect(0, 0, w, h);

      const plates = [
        [0, 36, 220, 36, 300, 185, 0, 185, '#64748b'],
        [240, 0, 512, 0, 512, 150, 315, 150, '#526277'],
        [170, 195, 512, 195, 512, 390, 90, 390, '#64748b'],
        [0, 310, 290, 310, 365, 512, 0, 512, '#56677c'],
      ] as const;
      plates.forEach(([x1, y1, x2, y2, x3, y3, x4, y4, col]) => {
        dCtx.beginPath();
        dCtx.moveTo(x1, y1);
        dCtx.lineTo(x2, y2);
        dCtx.lineTo(x3, y3);
        dCtx.lineTo(x4, y4);
        dCtx.closePath();
        dCtx.fillStyle = col;
        dCtx.fill();
        dCtx.strokeStyle = '#38bdf8';
        dCtx.lineWidth = 5;
        dCtx.stroke();

        eCtx.beginPath();
        eCtx.moveTo(x1, y1);
        eCtx.lineTo(x2, y2);
        eCtx.lineTo(x3, y3);
        eCtx.lineTo(x4, y4);
        eCtx.closePath();
        eCtx.strokeStyle = '#38bdf8';
        eCtx.lineWidth = 5;
        eCtx.stroke();
      });

      // Subtle holographic AI reticle accent
      dCtx.strokeStyle = 'rgba(103, 232, 249, 0.45)';
      dCtx.lineWidth = 3;
      dCtx.beginPath();
      dCtx.arc(w * 0.56, h * 0.54, 48, 0, Math.PI * 2);
      dCtx.stroke();
      eCtx.strokeStyle = '#0ea5e9';
      eCtx.lineWidth = 3;
      eCtx.beginPath();
      eCtx.arc(w * 0.56, h * 0.54, 48, 0, Math.PI * 2);
      eCtx.stroke();
    },
    3,
    1.5,
    0.34,
    0.24,
    0x38bdf8,
    1.25,
  );

  // 3) Dark Charcoal Wall + Vertical & Angled Electric-Blue LED Traces
  const darkCircuitBlueMat = mkRepeatedPair(
    (dCtx, eCtx, w, h) => {
      dCtx.fillStyle = '#2c3037';
      dCtx.fillRect(0, 0, w, h);
      eCtx.fillStyle = '#000000';
      eCtx.fillRect(0, 0, w, h);

      const traces: Array<Array<[number, number]>> = [
        [[46, 0], [46, 130], [98, 175], [98, 415], [142, 455], [142, 512]],
        [[118, 0], [118, 512]],
        [[198, 0], [198, 145], [248, 185], [248, 340], [196, 385], [196, 512]],
        [[308, 0], [308, 225], [260, 268], [260, 512]],
        [[374, 0], [374, 188], [430, 238], [430, 512]],
        [[458, 0], [458, 135], [492, 168], [492, 512]],
      ];

      traces.forEach((pts) => {
        [dCtx, eCtx].forEach((c) => {
          c.strokeStyle = '#00d8ff';
          c.lineWidth = 6;
          c.lineCap = 'round';
          c.lineJoin = 'round';
          c.beginPath();
          pts.forEach(([px, py], i) => {
            if (i === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          });
          c.stroke();
        });
      });
    },
    4,
    1.5,
    0.45,
    0.18,
    0x00d8ff,
    1.45,
  );

  return { origamiWhiteMat, cyberGreyAiMat, darkCircuitBlueMat };
}

/** Builds the Holographic Human + 6-Axis Articulated Robotic Arm visible inside Future Lab glass atrium. */
export function buildFutureLabAtriumHero(
  parent: THREE.Group,
  bank: ScienceExhibitMaterialBank,
  anims: ScienceExhibitAnimEntry[],
) {
  const g = new THREE.Group();
  g.position.set(0, 0, 5.5);

  // Illuminated hologram pedestal
  const pedGeo = new THREE.CylinderGeometry(3.2, 3.6, 0.55, 24);
  const ringGeo = new THREE.TorusGeometry(3.35, 0.08, 8, 32);
  const cylGeo = new THREE.CylinderGeometry(0.18, 0.22, 1, 10);
  const sphereGeo = new THREE.SphereGeometry(0.45, 14, 10);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  bank.sharedGeos.push(pedGeo, ringGeo, cylGeo, sphereGeo, boxGeo);

  const ped = new THREE.Mesh(pedGeo, bank.slateMetal);
  ped.position.set(-4.5, 0.28, 0);
  g.add(ped);
  const ring1 = new THREE.Mesh(ringGeo, bank.cyanGlow);
  ring1.rotation.x = Math.PI * 0.5;
  ring1.position.set(-4.5, 0.62, 0);
  g.add(ring1);

  // Holographic Human figure
  const holoHuman = new THREE.Group();
  holoHuman.position.set(-4.5, 0.75, 0);
  const head = new THREE.Mesh(sphereGeo, bank.holoBlue);
  head.position.set(0, 4.7, 0);
  head.scale.set(0.95, 1.15, 0.95);
  const torso = new THREE.Mesh(cylGeo, bank.holoBlue);
  torso.position.set(0, 3.25, 0);
  torso.scale.set(3.0, 2.0, 1.8);
  const pelvis = new THREE.Mesh(cylGeo, bank.holoBlue);
  pelvis.position.set(0, 2.1, 0);
  pelvis.scale.set(2.3, 0.6, 1.5);
  [-0.36, 0.36].forEach((lx) => {
    const leg = new THREE.Mesh(cylGeo, bank.holoBlue);
    leg.position.set(lx, 1.0, 0);
    leg.scale.set(1.05, 1.9, 1.05);
    holoHuman.add(leg);
  });
  [-0.86, 0.86].forEach((ax, idx) => {
    const arm = new THREE.Mesh(cylGeo, bank.holoBlue);
    arm.position.set(ax, 3.25, 0);
    arm.rotation.z = idx === 0 ? 0.22 : -0.22;
    arm.scale.set(0.8, 1.65, 0.8);
    holoHuman.add(arm);
  });
  const scanRing = new THREE.Mesh(ringGeo, bank.cyanGlow);
  scanRing.rotation.x = Math.PI * 0.5;
  scanRing.scale.setScalar(0.62);
  holoHuman.add(head, torso, pelvis, scanRing);
  g.add(holoHuman);

  // Giant White/Blue 6-Axis Industrial Robotic Arm (matching Future Lab image)
  const armBasePed = new THREE.Mesh(pedGeo, bank.slateMetal);
  armBasePed.position.set(6.5, 0.28, 0);
  armBasePed.scale.set(0.85, 1.2, 0.85);
  g.add(armBasePed);

  const armBaseYaw = new THREE.Group();
  armBaseYaw.position.set(6.5, 0.68, 0);
  const shoulderTurret = new THREE.Mesh(cylGeo, bank.whiteMetal);
  shoulderTurret.position.set(0, 0.9, 0);
  shoulderTurret.scale.set(5.2, 1.8, 5.2);
  armBaseYaw.add(shoulderTurret);

  const armLowerPivot = new THREE.Group();
  armLowerPivot.position.set(0, 1.7, 0);
  const lowerBoom = new THREE.Mesh(boxGeo, bank.whiteMetal);
  lowerBoom.position.set(0, 1.65, 0);
  lowerBoom.scale.set(0.92, 3.3, 0.85);
  const lowerTrim = new THREE.Mesh(boxGeo, bank.cyanGlow);
  lowerTrim.position.set(0, 1.65, 0.45);
  lowerTrim.scale.set(0.28, 2.7, 0.08);
  armLowerPivot.add(lowerBoom, lowerTrim);

  const armUpperPivot = new THREE.Group();
  armUpperPivot.position.set(0, 3.2, 0);
  const upperBoom = new THREE.Mesh(boxGeo, bank.whiteMetal);
  upperBoom.position.set(-1.35, 0.45, 0);
  upperBoom.rotation.z = -0.3;
  upperBoom.scale.set(2.9, 0.65, 0.65);
  const clawHead = new THREE.Mesh(boxGeo, bank.slateMetal);
  clawHead.position.set(-2.7, 0.85, 0);
  clawHead.scale.set(0.75, 0.55, 0.55);
  const gripperGlow = new THREE.Mesh(sphereGeo, bank.cyanGlow);
  gripperGlow.position.set(-3.15, 0.85, 0);
  gripperGlow.scale.setScalar(0.45);
  armUpperPivot.add(upperBoom, clawHead, gripperGlow);
  armLowerPivot.add(armUpperPivot);
  armBaseYaw.add(armLowerPivot);
  g.add(armBaseYaw);

  parent.add(g);

  anims.push({
    zoneKey: 'future_lab',
    update: (t, _dt, boost) => {
      const spd = boost ? 2.1 : 1.0;
      holoHuman.rotation.y = t * 0.65 * spd;
      holoHuman.position.y = 0.75 + Math.sin(t * 2.1) * 0.16;
      scanRing.position.y = 2.6 + Math.sin(t * 2.8 * spd) * 2.1;
      armBaseYaw.rotation.y = Math.sin(t * 0.75 * spd) * 0.85;
      armLowerPivot.rotation.z = -0.25 + Math.sin(t * 1.1 * spd) * 0.28;
      armUpperPivot.rotation.z = 0.35 + Math.cos(t * 1.45 * spd) * 0.42;
    },
  });
}

/** Builds a detailed multi-part animated T-Rex or Triceratops. */
function buildAnimatedDino(
  bank: ScienceExhibitMaterialBank,
  skinMat: THREE.Material,
  scale: number,
  isFossil = false,
): {
  root: THREE.Group;
  headPivot: THREE.Group;
  jawPivot: THREE.Group;
  tailPivot: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
} {
  const root = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.35, 0.48, 1, 10);
  const coneGeo = new THREE.ConeGeometry(0.36, 1.5, 8);
  bank.sharedGeos.push(boxGeo, cylGeo, coneGeo);

  const body = new THREE.Mesh(boxGeo, skinMat);
  body.position.set(0, 2.25 * scale, 0);
  body.rotation.x = -0.18;
  body.scale.set(1.25 * scale, 1.15 * scale, 2.45 * scale);
  root.add(body);

  if (isFossil) {
    for (let r = -0.7; r <= 0.7; r += 0.35) {
      const rib = new THREE.Mesh(cylGeo, skinMat);
      rib.position.set(0, 2.2 * scale, r * scale);
      rib.rotation.z = Math.PI * 0.5;
      rib.scale.set(0.35 * scale, 1.55 * scale, 0.35 * scale);
      root.add(rib);
    }
  }

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 2.85 * scale, 1.25 * scale);
  const neck = new THREE.Mesh(cylGeo, skinMat);
  neck.position.set(0, 0.35 * scale, 0.35 * scale);
  neck.rotation.x = 0.55;
  neck.scale.set(0.9 * scale, 1.05 * scale, 0.9 * scale);
  const skull = new THREE.Mesh(boxGeo, skinMat);
  skull.position.set(0, 0.75 * scale, 0.95 * scale);
  skull.scale.set(0.76 * scale, 0.56 * scale, 1.38 * scale);
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, 0.45 * scale, 0.65 * scale);
  const jaw = new THREE.Mesh(boxGeo, skinMat);
  jaw.position.set(0, -0.05 * scale, 0.45 * scale);
  jaw.scale.set(0.62 * scale, 0.22 * scale, 1.05 * scale);
  jawPivot.add(jaw);
  headPivot.add(neck, skull, jawPivot);
  root.add(headPivot);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 2.35 * scale, -1.1 * scale);
  const tail1 = new THREE.Mesh(coneGeo, skinMat);
  tail1.rotation.x = -Math.PI * 0.46;
  tail1.position.set(0, -0.08 * scale, -1.25 * scale);
  tail1.scale.set(0.95 * scale, 1.65 * scale, 0.95 * scale);
  tailPivot.add(tail1);
  root.add(tailPivot);

  const legL = new THREE.Mesh(boxGeo, skinMat);
  legL.position.set(-0.58 * scale, 1.05 * scale, -0.1 * scale);
  legL.scale.set(0.45 * scale, 2.0 * scale, 0.58 * scale);
  const legR = new THREE.Mesh(boxGeo, skinMat);
  legR.position.set(0.58 * scale, 1.05 * scale, -0.1 * scale);
  legR.scale.set(0.45 * scale, 2.0 * scale, 0.58 * scale);
  root.add(legL, legR);

  return { root, headPivot, jawPivot, tailPivot, legL, legR };
}

/**
 * Builds ALL 8 Future Vehicles from Image #2 ("FUTURE VEHICLES"):
 * Futuristic Sports Car, Super Future Car, Future SUV, Future Bike,
 * Future Helicopter, Flying Car, Future Drone, Future Tank
 */
function buildFutureVehicleExhibition(
  parent: THREE.Group,
  bank: ScienceExhibitMaterialBank,
  anims: ScienceExhibitAnimEntry[],
  zoneKey: 'dome_6',
) {
  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  const geoCyl = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
  const geoTorus = new THREE.TorusGeometry(0.36, 0.045, 8, 18);
  const geoStageRing = new THREE.TorusGeometry(1, 0.015, 8, 28);
  const geoCone = new THREE.ConeGeometry(0.38, 0.85, 10);
  bank.sharedGeos.push(geoBox, geoCyl, geoTorus, geoStageRing, geoCone);

  const turntable = new THREE.Group();
  turntable.position.set(0, 0.44, 0);
  const centerStage = new THREE.Mesh(geoCyl, bank.whiteMetal);
  centerStage.scale.set(6.8, 0.55, 6.8);
  const centerGlow = new THREE.Mesh(geoStageRing, bank.cyanGlow);
  centerGlow.rotation.x = Math.PI * 0.5;
  centerGlow.position.y = 0.08;
  centerGlow.scale.setScalar(2.35);
  turntable.add(centerStage, centerGlow);
  parent.add(turntable);

  // Center Rotating Stage for Hero Super Future Car + Flying Car
  const heroCar = new THREE.Group();
  heroCar.position.set(-1.35, 0.14, 0);
  const hcBody = new THREE.Mesh(geoBox, bank.crimsonPaint);
  hcBody.position.set(0, 0.38, 0);
  hcBody.scale.set(1.42, 0.42, 3.0);
  const hcCabin = new THREE.Mesh(geoBox, bank.slateMetal);
  hcCabin.position.set(0, 0.66, -0.12);
  hcCabin.scale.set(1.12, 0.32, 1.35);
  const hcDoorL = new THREE.Mesh(geoBox, bank.crimsonPaint);
  hcDoorL.position.set(-0.74, 0.52, 0.1);
  hcDoorL.scale.set(0.08, 0.36, 1.05);
  const hcDoorR = new THREE.Mesh(geoBox, bank.crimsonPaint);
  hcDoorR.position.set(0.74, 0.52, 0.1);
  hcDoorR.scale.set(0.08, 0.36, 1.05);
  const hcGlow = new THREE.Mesh(geoBox, bank.cyanGlow);
  hcGlow.position.set(0, 0.36, 1.52);
  hcGlow.scale.set(1.22, 0.08, 0.06);
  heroCar.add(hcBody, hcCabin, hcDoorL, hcDoorR, hcGlow);
  [[-0.68, 0.92], [0.68, 0.92], [-0.68, -0.92], [0.68, -0.92]].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(geoCyl, bank.slateMetal);
    w.rotation.z = Math.PI * 0.5;
    w.position.set(wx, 0.28, wz);
    heroCar.add(w);
  });
  turntable.add(heroCar);

  // 2) Hovering Flying Car (silver + cyan thruster cones underneath)
  const flyingCar = new THREE.Group();
  flyingCar.position.set(1.45, 0.95, 0);
  const fcBody = new THREE.Mesh(geoBox, bank.silverPaint);
  fcBody.scale.set(1.38, 0.38, 2.85);
  const fcCanopy = new THREE.Mesh(geoBox, bank.holoBlue);
  fcCanopy.position.set(0, 0.28, -0.05);
  fcCanopy.scale.set(1.06, 0.28, 1.25);
  flyingCar.add(fcBody, fcCanopy);
  [[-0.55, 0.95], [0.55, 0.95], [-0.55, -0.95], [0.55, -0.95]].forEach(([tx, tz]) => {
    const thrust = new THREE.Mesh(geoCone, bank.cyanGlow);
    thrust.position.set(tx, -0.45, tz);
    thrust.scale.set(0.55, 0.72, 0.55);
    flyingCar.add(thrust);
  });
  turntable.add(flyingCar);

  // Outer perimeter ring showcasing remaining 6 Future Vehicles:
  const ringEntries: Array<{ angle: number; build: (g: THREE.Group) => { spinRotor?: THREE.Object3D; turret?: THREE.Object3D } }> = [
    // Futuristic Sports Car
    {
      angle: 0.4,
      build: (g) => {
        const b = new THREE.Mesh(geoBox, bank.silverPaint);
        b.position.y = 0.36;
        b.scale.set(1.15, 0.34, 2.25);
        const c = new THREE.Mesh(geoBox, bank.slateMetal);
        c.position.set(0, 0.58, -0.08);
        c.scale.set(0.92, 0.26, 1.05);
        const trim = new THREE.Mesh(geoBox, bank.cyanGlow);
        trim.position.set(0, 0.34, 1.14);
        trim.scale.set(0.96, 0.08, 0.05);
        g.add(b, c, trim);
        return {};
      },
    },
    // Future SUV
    {
      angle: 1.45,
      build: (g) => {
        const b = new THREE.Mesh(geoBox, bank.whiteMetal);
        b.position.y = 0.54;
        b.scale.set(1.3, 0.65, 2.25);
        const cab = new THREE.Mesh(geoBox, bank.slateMetal);
        cab.position.set(0, 0.95, -0.1);
        cab.scale.set(1.16, 0.36, 1.45);
        g.add(b, cab);
        return {};
      },
    },
    // Future Bike (Hubless cyan neon wheel bike)
    {
      angle: 2.5,
      build: (g) => {
        const fw = new THREE.Mesh(geoTorus, bank.cyanGlow);
        fw.rotation.y = Math.PI * 0.5;
        fw.position.set(0, 0.42, 0.75);
        const rw = new THREE.Mesh(geoTorus, bank.cyanGlow);
        rw.rotation.y = Math.PI * 0.5;
        rw.position.set(0, 0.42, -0.75);
        const frame = new THREE.Mesh(geoBox, bank.whiteMetal);
        frame.position.set(0, 0.65, 0);
        frame.scale.set(0.32, 0.36, 1.45);
        g.add(fw, rw, frame);
        return {};
      },
    },
    // Future Helicopter
    {
      angle: 3.55,
      build: (g) => {
        const fus = new THREE.Mesh(geoBox, bank.whiteMetal);
        fus.position.y = 0.72;
        fus.scale.set(0.88, 0.68, 2.1);
        const boom = new THREE.Mesh(geoBox, bank.slateMetal);
        boom.position.set(0, 0.78, -1.55);
        boom.scale.set(0.24, 0.24, 1.3);
        const rotor = new THREE.Mesh(geoBox, bank.cyanGlow);
        rotor.position.set(0, 1.18, 0);
        rotor.scale.set(2.4, 0.04, 0.18);
        g.add(fus, boom, rotor);
        return { spinRotor: rotor };
      },
    },
    // Future Quad-Duct Drone
    {
      angle: 4.6,
      build: (g) => {
        const pod = new THREE.Mesh(geoBox, bank.whiteMetal);
        pod.position.y = 0.85;
        pod.scale.set(0.75, 0.45, 1.45);
        const rotors = new THREE.Group();
        rotors.position.y = 0.88;
        [[-0.78, 0.68], [0.78, 0.68], [-0.78, -0.68], [0.78, -0.68]].forEach(([dx, dz]) => {
          const duct = new THREE.Mesh(geoTorus, bank.cyanGlow);
          duct.rotation.x = Math.PI * 0.5;
          duct.position.set(dx, 0, dz);
          duct.scale.setScalar(0.85);
          rotors.add(duct);
        });
        g.add(pod, rotors);
        return { spinRotor: rotors };
      },
    },
    // Future Tank
    {
      angle: 5.65,
      build: (g) => {
        const hull = new THREE.Mesh(geoBox, bank.slateMetal);
        hull.position.y = 0.42;
        hull.scale.set(1.45, 0.52, 2.35);
        const turret = new THREE.Group();
        turret.position.set(0, 0.82, 0);
        const cap = new THREE.Mesh(geoBox, bank.silverPaint);
        cap.scale.set(0.95, 0.36, 1.15);
        const barrel = new THREE.Mesh(geoBox, bank.cyanGlow);
        barrel.position.set(0, 0.05, 1.05);
        barrel.scale.set(0.16, 0.14, 1.35);
        turret.add(cap, barrel);
        g.add(hull, turret);
        return { turret };
      },
    },
  ];

  const dynamicParts: Array<{ spinRotor?: THREE.Object3D; turret?: THREE.Object3D }> = [];
  ringEntries.forEach((entry) => {
    const holder = new THREE.Group();
    const r = 4.45;
    holder.position.set(Math.cos(entry.angle) * r, 0.44, Math.sin(entry.angle) * r);
    holder.rotation.y = -entry.angle;
    const ped = new THREE.Mesh(geoCyl, bank.whiteMetal);
    ped.scale.set(2.9, 0.45, 2.9);
    const pedRing = new THREE.Mesh(geoStageRing, bank.cyanGlow);
    pedRing.rotation.x = Math.PI * 0.5;
    pedRing.position.y = 0.06;
    pedRing.scale.setScalar(0.98);
    holder.add(ped, pedRing);
    dynamicParts.push(entry.build(holder));
    parent.add(holder);
  });

  anims.push({
    zoneKey,
    update: (t, _dt, boost) => {
      const spd = boost ? 2.2 : 1.0;
      turntable.rotation.y = t * 0.45 * spd;
      const doorSwing = (Math.sin(t * 1.4 * spd) * 0.5 + 0.5) * 0.72;
      hcDoorL.rotation.z = doorSwing;
      hcDoorR.rotation.z = -doorSwing;
      flyingCar.position.y = 0.95 + Math.sin(t * 2.5 * spd) * 0.22;
      for (const p of dynamicParts) {
        if (p.spinRotor) p.spinRotor.rotation.y = t * 8.5 * spd;
        if (p.turret) p.turret.rotation.y = Math.sin(t * 0.9 * spd) * 0.65;
      }
    },
  });
}

/**
 * Populates each of the 8 Glass Domes with 3D Holographic Curved Cinema & Wing Screens
 * playing its dedicated attached .mp4 animation cleanly inside the dome.
 */
export function populateDomeExhibits(
  domeIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  interiorGroup: THREE.Group,
  bank: ScienceExhibitMaterialBank,
  anims: ScienceExhibitAnimEntry[],
  displays?: DigitalDisplayManager,
  domeInfo?: { title: string; shortTitle: string; accentHex: string; accentNum: number; x: number; z: number },
) {
  const zoneKey = `dome_${domeIndex}` as const;
  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  const geoCyl = new THREE.CylinderGeometry(0.4, 0.4, 1, 16);
  const geoSphere = new THREE.SphereGeometry(0.45, 14, 10);
  const geoTorus = new THREE.TorusGeometry(1.1, 0.06, 8, 28);
  // Curved panoramic projection wall facing South (+Z entrance) around north side (-Z)
  const screenGeo = new THREE.CylinderGeometry(4.45, 4.45, 4.35, 28, 1, true, Math.PI * 0.62, Math.PI * 0.76);
  // Flip UV horizontally so inner curved screen reads cleanly left-to-right from entrance
  const uvAttr = screenGeo.getAttribute('uv');
  if (uvAttr) {
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setX(i, 1 - uvAttr.getX(i));
    }
    uvAttr.needsUpdate = true;
  }
  const wingGeo = new THREE.PlaneGeometry(2.65, 2.25);
  bank.sharedGeos.push(geoBox, geoCyl, geoSphere, geoTorus, screenGeo, wingGeo);

  const accentColorHex = domeInfo?.accentHex ?? '#22d3ee';
  const accentColorNum = domeInfo?.accentNum ?? 0x22d3ee;
  const accentMat = new THREE.MeshBasicMaterial({ color: accentColorNum });
  bank.sharedMats.push(accentMat);

  // Central Cyber Holo Projector Stage
  const ped = new THREE.Mesh(geoCyl, bank.slateMetal);
  ped.position.set(0, 0.24, 0);
  ped.scale.set(5.4, 0.48, 5.4);
  const pedRing = new THREE.Mesh(geoTorus, accentMat);
  pedRing.rotation.x = Math.PI * 0.5;
  pedRing.position.set(0, 0.5, 0);
  pedRing.scale.setScalar(2.02);
  const holoBeam = new THREE.Mesh(geoCyl, bank.holoBlue);
  holoBeam.position.set(0, 2.3, -0.3);
  holoBeam.scale.set(1.3, 3.6, 1.3);
  const emitterOrb = new THREE.Mesh(geoSphere, accentMat);
  emitterOrb.position.set(0, 0.85, 0.6);
  emitterOrb.scale.setScalar(0.62);
  const emitterHalo = new THREE.Mesh(geoTorus, accentMat);
  emitterHalo.position.set(0, 0.85, 0.6);
  emitterHalo.scale.setScalar(0.55);
  interiorGroup.add(ped, pedRing, holoBeam, emitterOrb, emitterHalo);

  // Curved Frame Rails (top + bottom arc brackets)
  const bezelArcGeo = new THREE.TorusGeometry(4.55, 0.08, 8, 28, Math.PI * 0.78);
  bank.sharedGeos.push(bezelArcGeo);
  const topArc = new THREE.Mesh(bezelArcGeo, accentMat);
  topArc.rotation.x = Math.PI * 0.5;
  topArc.rotation.z = Math.PI * 0.11;
  topArc.position.set(0, 5.15, 0);
  const botArc = new THREE.Mesh(bezelArcGeo, bank.whiteMetal);
  botArc.rotation.x = Math.PI * 0.5;
  botArc.rotation.z = Math.PI * 0.11;
  botArc.position.set(0, 0.72, 0);
  interiorGroup.add(topArc, botArc);

  const playlist = SCIENCE_DOME_VIDEO_PLAYLISTS[domeIndex - 1] ?? SCIENCE_DOME_VIDEO_PLAYLISTS[0];
  let screenMat: THREE.Material = bank.holoBlue;
  if (displays) {
    const res = displays.createVideoDisplayMaterial(playlist, 'sci_dome_screen', {
      title: domeInfo?.shortTitle?.toUpperCase() ?? `DOME ${domeIndex} STREAM`,
      subtitle: `HOLOGRAM STREAM · DOME ${domeIndex}`,
      accentHex: accentColorHex,
      width: 512,
      height: 288,
      intervalSec: 0.04,
      worldPos: domeInfo ? { x: domeInfo.x, y: 3.1, z: domeInfo.z } : undefined,
    });
    res.material.side = THREE.DoubleSide;
    screenMat = res.material;
  }

  // Main Curved 3D Projection Screen (facing south entrance)
  const mainScreen = new THREE.Mesh(screenGeo, screenMat);
  mainScreen.position.set(0, 2.94, 0);
  interiorGroup.add(mainScreen);

  // Flanking 3D Floating Holographic Side Screens
  const wingLeft = new THREE.Mesh(wingGeo, screenMat);
  wingLeft.position.set(-4.3, 2.55, 1.35);
  wingLeft.rotation.y = 0.58;
  const wingRight = new THREE.Mesh(wingGeo, screenMat);
  wingRight.position.set(4.3, 2.55, 1.35);
  wingRight.rotation.y = -0.58;
  interiorGroup.add(wingLeft, wingRight);

  anims.push({
    zoneKey,
    update: (t, _dt, boost) => {
      const spd = boost ? 2.2 : 1.0;
      emitterOrb.position.y = 0.92 + Math.sin(t * 2.4 * spd) * 0.16;
      emitterHalo.position.y = emitterOrb.position.y;
      emitterHalo.rotation.x = t * 1.4 * spd;
      emitterHalo.rotation.y = t * 1.9 * spd;
      holoBeam.rotation.y = t * 0.75 * spd;
      wingLeft.position.y = 2.55 + Math.sin(t * 1.8 * spd) * 0.1;
      wingRight.position.y = 2.55 + Math.cos(t * 1.8 * spd) * 0.1;
    },
  });
}
