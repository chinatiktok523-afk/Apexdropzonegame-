import * as THREE from 'three';

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

/** Populates distinct interior 3D animations for each of the 8 Individual Glass Domes. */
export function populateDomeExhibits(
  domeIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  interiorGroup: THREE.Group,
  bank: ScienceExhibitMaterialBank,
  anims: ScienceExhibitAnimEntry[],
) {
  const zoneKey = `dome_${domeIndex}` as const;
  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  const geoCyl = new THREE.CylinderGeometry(0.4, 0.4, 1, 14);
  const geoCone = new THREE.ConeGeometry(0.45, 1.4, 12);
  const geoSphere = new THREE.SphereGeometry(0.8, 16, 12);
  const geoTorus = new THREE.TorusGeometry(1.1, 0.08, 8, 28);
  bank.sharedGeos.push(geoBox, geoCyl, geoCone, geoSphere, geoTorus);

  // Central illuminated pedestal inside every dome
  const ped = new THREE.Mesh(geoCyl, bank.slateMetal);
  ped.position.set(0, 0.22, 0);
  ped.scale.set(5.5, 0.44, 5.5);
  const pedRing = new THREE.Mesh(geoTorus, bank.cyanGlow);
  pedRing.rotation.x = Math.PI * 0.5;
  pedRing.position.set(0, 0.46, 0);
  pedRing.scale.setScalar(2.0);
  interiorGroup.add(ped, pedRing);

  if (domeIndex === 1) {
    // DOME 1 — SPACE EXPLORATION: Rocket launch demo, astronaut, space station, orbiting planets
    const rocket = new THREE.Group();
    const hull = new THREE.Mesh(geoCyl, bank.whiteMetal);
    hull.position.y = 2.6;
    hull.scale.set(1.25, 3.8, 1.25);
    const nose = new THREE.Mesh(geoCone, bank.crimsonPaint);
    nose.position.y = 5.1;
    nose.scale.set(1.12, 1.1, 1.12);
    const flame = new THREE.Mesh(geoCone, bank.amberGlow);
    flame.rotation.x = Math.PI;
    flame.position.y = 0.2;
    flame.scale.set(0.85, 0.95, 0.85);
    rocket.add(hull, nose, flame);
    interiorGroup.add(rocket);

    // Astronaut statue beside launchpad
    const astro = new THREE.Group();
    astro.position.set(-3.2, 0.9, 1.5);
    const suit = new THREE.Mesh(geoBox, bank.whiteMetal);
    suit.scale.set(0.68, 1.15, 0.48);
    const helm = new THREE.Mesh(geoSphere, bank.goldMetal);
    helm.position.y = 0.82;
    helm.scale.setScalar(0.42);
    astro.add(suit, helm);
    interiorGroup.add(astro);

    // Orbiting ringed planet + satellite
    const orrery = new THREE.Group();
    orrery.position.set(0, 5.4, 0);
    const planet = new THREE.Mesh(geoSphere, bank.goldMetal);
    planet.position.set(3.4, 0, 0);
    planet.scale.setScalar(0.82);
    const pRing = new THREE.Mesh(geoTorus, bank.cyanGlow);
    pRing.rotation.x = 1.15;
    pRing.scale.setScalar(0.88);
    planet.add(pRing);
    const sat = new THREE.Mesh(geoBox, bank.silverPaint);
    sat.position.set(-3.6, 0.6, 0);
    sat.scale.set(1.1, 0.32, 0.38);
    orrery.add(planet, sat);
    interiorGroup.add(orrery);

    anims.push({
      zoneKey,
      update: (t, _dt, boost) => {
        const spd = boost ? 2.2 : 1.0;
        rocket.position.y = 0.45 + Math.abs(Math.sin(t * 0.75 * spd)) * 1.45;
        flame.scale.y = 0.7 + Math.sin(t * 14) * 0.28;
        orrery.rotation.y = t * 0.85 * spd;
        planet.rotation.y = t * 1.4 * spd;
      },
    });
  } else if (domeIndex === 2) {
    // DOME 2 — ROBOTICS: Walking humanoid robot + dual sweeping assembly arms + AI holo core
    const walker = new THREE.Group();
    const wTorso = new THREE.Mesh(geoBox, bank.whiteMetal);
    wTorso.position.y = 1.4;
    wTorso.scale.set(0.66, 0.82, 0.42);
    const wHead = new THREE.Mesh(geoBox, bank.cyanGlow);
    wHead.position.y = 2.04;
    wHead.scale.set(0.36, 0.34, 0.36);
    const legL = new THREE.Mesh(geoBox, bank.slateMetal);
    legL.position.set(-0.18, 0.55, 0);
    legL.scale.set(0.22, 0.85, 0.24);
    const legR = new THREE.Mesh(geoBox, bank.slateMetal);
    legR.position.set(0.18, 0.55, 0);
    legR.scale.set(0.22, 0.85, 0.24);
    walker.add(wTorso, wHead, legL, legR);
    interiorGroup.add(walker);

    const arms: THREE.Group[] = [];
    [-3.1, 3.1].forEach((ax) => {
      const arm = new THREE.Group();
      arm.position.set(ax, 0.45, -1.6);
      const col = new THREE.Mesh(geoCyl, bank.whiteMetal);
      col.position.y = 1.25;
      col.scale.set(0.75, 2.5, 0.75);
      const boom = new THREE.Mesh(geoBox, bank.goldMetal);
      boom.position.set(ax < 0 ? 0.9 : -0.9, 2.45, 0);
      boom.scale.set(1.85, 0.32, 0.34);
      arm.add(col, boom);
      arms.push(arm);
      interiorGroup.add(arm);
    });

    const aiCore = new THREE.Mesh(geoTorus, bank.cyanGlow);
    aiCore.position.set(0, 2.8, 0);
    interiorGroup.add(aiCore);

    anims.push({
      zoneKey,
      update: (t, _dt, boost) => {
        const spd = boost ? 2.1 : 1.0;
        const ang = t * 0.9 * spd;
        walker.position.set(Math.cos(ang) * 2.4, 0.42, Math.sin(ang) * 2.4);
        walker.rotation.y = -ang;
        legL.rotation.x = Math.sin(t * 5.2 * spd) * 0.45;
        legR.rotation.x = -Math.sin(t * 5.2 * spd) * 0.45;
        aiCore.rotation.x = t * 1.2 * spd;
        aiCore.rotation.y = t * 1.7 * spd;
        arms[0].rotation.y = Math.sin(t * 1.3 * spd) * 0.85;
        arms[1].rotation.y = -Math.sin(t * 1.3 * spd) * 0.85;
      },
    });
  } else if (domeIndex === 3) {
    // DOME 3 — DINOSAUR WORLD: Walking articulated T-Rex + Triceratops + ferns
    const trex = buildAnimatedDino(bank, bank.dinoGreen, 1.35, false);
    trex.root.position.set(-0.6, 0.42, -0.4);
    interiorGroup.add(trex.root);

    const trike = buildAnimatedDino(bank, bank.goldMetal, 0.72, true);
    trike.root.position.set(3.2, 0.42, 1.6);
    trike.root.rotation.y = -0.8;
    interiorGroup.add(trike.root);

    anims.push({
      zoneKey,
      update: (t, _dt, boost) => {
        const spd = boost ? 2.0 : 1.0;
        trex.headPivot.rotation.y = Math.sin(t * 1.1 * spd) * 0.35;
        trex.headPivot.rotation.x = Math.sin(t * 1.8 * spd) * 0.14;
        trex.jawPivot.rotation.x = (Math.sin(t * 2.6 * spd) * 0.5 + 0.5) * 0.38;
        trex.tailPivot.rotation.y = Math.sin(t * 1.9 * spd) * 0.32;
        trex.legL.rotation.x = Math.sin(t * 2.2 * spd) * 0.25;
        trex.legR.rotation.x = -Math.sin(t * 2.2 * spd) * 0.25;
        trike.headPivot.rotation.y = Math.cos(t * 1.3 * spd) * 0.25;
      },
    });
  } else if (domeIndex === 4) {
    // DOME 4 — ANCIENT CIVILIZATION: Revolving Golden Sentinel Statue + Stepped Ziggurat + Holo Ring
    const stage = new THREE.Group();
    stage.position.set(0, 0.45, 0);
    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(geoBox, bank.boneFossil);
      step.position.y = 0.22 + s * 0.38;
      step.scale.set(3.6 - s * 0.85, 0.36, 3.6 - s * 0.85);
      stage.add(step);
    }
    const statueBody = new THREE.Mesh(geoCyl, bank.goldMetal);
    statueBody.position.y = 2.45;
    statueBody.scale.set(1.5, 2.2, 1.2);
    const statueHead = new THREE.Mesh(geoBox, bank.goldMetal);
    statueHead.position.y = 3.85;
    statueHead.scale.set(0.75, 0.85, 0.72);
    const holoScript = new THREE.Mesh(geoTorus, bank.amberGlow);
    holoScript.rotation.x = Math.PI * 0.5;
    holoScript.position.y = 2.55;
    holoScript.scale.setScalar(1.65);
    stage.add(statueBody, statueHead, holoScript);
    interiorGroup.add(stage);

    anims.push({
      zoneKey,
      update: (t, _dt, boost) => {
        const spd = boost ? 2.2 : 1.0;
        stage.rotation.y = t * 0.42 * spd;
        holoScript.position.y = 2.55 + Math.sin(t * 1.8) * 0.35;
      },
    });
  } else if (domeIndex === 5) {
    // DOME 5 — CRYSTAL & ENERGY: Levitating Giant Crystals + Plasma Containment Rings + Energy Beam
    const mainCrystal = new THREE.Mesh(geoCone, bank.crystalCyan);
    mainCrystal.position.set(0, 2.9, 0);
    mainCrystal.scale.set(2.1, 2.6, 2.1);
    const subCrystals: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const sc = new THREE.Mesh(geoCone, bank.crystalPurple);
      sc.position.set(Math.cos(ang) * 2.8, 1.75, Math.sin(ang) * 2.8);
      sc.scale.set(1.1, 1.5, 1.1);
      subCrystals.push(sc);
      interiorGroup.add(sc);
    }
    const fluxRing = new THREE.Mesh(geoTorus, bank.cyanGlow);
    fluxRing.position.set(0, 2.8, 0);
    fluxRing.scale.setScalar(2.4);
    const beam = new THREE.Mesh(geoCyl, bank.holoBlue);
    beam.position.set(0, 3.6, 0);
    beam.scale.set(0.55, 6.2, 0.55);
    interiorGroup.add(mainCrystal, fluxRing, beam);

    anims.push({
      zoneKey,
      update: (t, _dt, boost) => {
        const spd = boost ? 2.4 : 1.0;
        mainCrystal.rotation.y = t * 1.1 * spd;
        mainCrystal.position.y = 2.9 + Math.sin(t * 2.0 * spd) * 0.35;
        fluxRing.rotation.x = t * 0.9 * spd;
        fluxRing.rotation.z = t * 1.2 * spd;
        subCrystals.forEach((sc, idx) => {
          sc.rotation.y = -t * 1.3 * spd + idx;
          sc.position.y = 1.65 + Math.sin(t * 2.4 + idx) * 0.25;
        });
      },
    });
  } else if (domeIndex === 6) {
    // DOME 6 — FUTURE VEHICLES (All 8 showcase vehicles from Reference Image #2)
    buildFutureVehicleExhibition(interiorGroup, bank, anims, 'dome_6');
  } else if (domeIndex === 7) {
    // DOME 7 — SATELLITE TECHNOLOGY: Deep Space Dish + Relay Satellite with Articulating Solar Wings
    const satGroup = new THREE.Group();
    satGroup.position.set(0, 3.1, 0);
    const bus = new THREE.Mesh(geoBox, bank.goldMetal);
    bus.scale.set(1.3, 1.3, 1.6);
    const wingL = new THREE.Mesh(geoBox, bank.crystalCyan);
    wingL.position.set(-2.6, 0, 0);
    wingL.scale.set(3.2, 0.08, 1.45);
    const wingR = new THREE.Mesh(geoBox, bank.crystalCyan);
    wingR.position.set(2.6, 0, 0);
    wingR.scale.set(3.2, 0.08, 1.45);
    const dish = new THREE.Mesh(geoCone, bank.whiteMetal);
    dish.position.set(0, 1.15, 0.6);
    dish.rotation.x = 0.6;
    dish.scale.set(1.4, 0.6, 1.4);
    satGroup.add(bus, wingL, wingR, dish);
    interiorGroup.add(satGroup);

    anims.push({
      zoneKey,
      update: (t, _dt, boost) => {
        const spd = boost ? 2.1 : 1.0;
        satGroup.rotation.y = t * 0.65 * spd;
        wingL.rotation.x = Math.sin(t * 1.1 * spd) * 0.45;
        wingR.rotation.x = Math.sin(t * 1.1 * spd) * 0.45;
      },
    });
  } else {
    // DOME 8 — OCEAN DISCOVERY: Shark, Whale, Dolphins, Underwater ROV & Bubbles
    const orbitPool = new THREE.Group();
    orbitPool.position.set(0, 2.7, 0);

    const mkFish = (len: number, rad: number, mat: THREE.Material, radius: number, phase: number, height: number) => {
      const f = new THREE.Group();
      const body = new THREE.Mesh(geoSphere, mat);
      body.scale.set(rad, rad * 0.85, len);
      const tail = new THREE.Mesh(geoCone, mat);
      tail.rotation.x = Math.PI * 0.5;
      tail.position.set(0, 0, -len * 0.85);
      tail.scale.set(rad * 0.7, rad * 0.9, rad * 0.7);
      f.add(body, tail);
      f.userData = { radius, phase, height, tail };
      orbitPool.add(f);
      return f;
    };

    const shark = mkFish(1.8, 0.42, bank.oceanShark, 3.8, 0, 0.35);
    const whale = mkFish(2.6, 0.68, bank.slateMetal, 2.4, 2.1, 1.25);
    const dolphin1 = mkFish(1.2, 0.3, bank.crystalCyan, 4.4, 1.2, -0.45);
    const dolphin2 = mkFish(1.2, 0.3, bank.crystalCyan, 4.4, 4.2, -0.25);
    const rov = new THREE.Mesh(geoBox, bank.amberGlow);
    rov.position.set(0, -1.3, 0);
    rov.scale.set(1.1, 0.65, 1.35);

    // Coral columns + instanced rising bubbles
    [-3.1, 2.8, -1.2, 1.6].forEach((cx, idx) => {
      const coral = new THREE.Mesh(geoCone, idx % 2 === 0 ? bank.crimsonPaint : bank.crystalPurple);
      coral.position.set(cx, -2.0, idx % 2 === 0 ? 1.8 : -2.1);
      coral.scale.set(0.65, 1.35, 0.65);
      orbitPool.add(coral);
    });

    const bubbleGeo = new THREE.SphereGeometry(0.11, 6, 6);
    bank.sharedGeos.push(bubbleGeo);
    const bubbleCount = 24;
    const bubbles = new THREE.InstancedMesh(bubbleGeo, bank.holoBlue, bubbleCount);
    const dummy = new THREE.Object3D();
    interiorGroup.add(orbitPool, rov, bubbles);

    const swimmers = [shark, whale, dolphin1, dolphin2];
    anims.push({
      zoneKey,
      update: (t, _dt, boost) => {
        const spd = boost ? 2.0 : 1.0;
        swimmers.forEach((sw, i) => {
          const { radius, phase, height, tail } = sw.userData as {
            radius: number;
            phase: number;
            height: number;
            tail: THREE.Object3D;
          };
          const a = t * (0.62 + i * 0.12) * spd + phase;
          sw.position.set(Math.cos(a) * radius, height + Math.sin(t * 2.2 + i) * 0.28, Math.sin(a) * radius);
          sw.rotation.y = -a;
          tail.rotation.y = Math.sin(t * 7.5 * spd + i) * 0.45;
        });
        rov.rotation.y = t * 0.55 * spd;
        rov.position.y = 1.45 + Math.sin(t * 1.4) * 0.25;

        for (let b = 0; b < bubbleCount; b++) {
          const ang = b * 1.37;
          const r = 1.2 + (b % 5) * 0.85;
          const y = ((t * 1.4 * spd + b * 0.42) % 4.6) + 0.6;
          dummy.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
          dummy.scale.setScalar(0.75 + (b % 3) * 0.3);
          dummy.updateMatrix();
          bubbles.setMatrixAt(b, dummy.matrix);
        }
        bubbles.instanceMatrix.needsUpdate = true;
      },
    });
  }
}
