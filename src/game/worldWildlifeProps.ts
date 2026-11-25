import * as THREE from 'three';

export interface WildlifeHitResult {
  kind: 'bird' | 'balloon' | 'ball' | 'none';
  point: THREE.Vector3;
  burst?: boolean;
  bounced?: boolean;
  birdSpecies?: 'eagle' | 'pigeon';
  colorHex?: number;
}

export interface BalloonRegistration {
  group: THREE.Group;
  envelopeMeshes: THREE.Object3D[];
  basketMeshes: THREE.Object3D[];
  baseX: number;
  baseY: number;
  baseZ: number;
  ampX: number;
  ampZ: number;
  phase: number;
  envelopeOffsetY: number;
  hitRadius: number;
  accentHex?: number;
}

interface BirdActor {
  index: number;
  species: 'eagle' | 'pigeon';
  group: THREE.Group;
  bodyGroup: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  headGroup: THREE.Group;
  hitMesh: THREE.Mesh;
  mode: 'soar' | 'tree';
  state: 'soaring' | 'perched' | 'flying_to_perch' | 'falling' | 'dead';
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  flapPhase: number;
  perchIndex: number;
  targetPerchIndex: number;
  perchTimer: number;
  orbitCenterX: number;
  orbitCenterZ: number;
  orbitRadius: number;
  orbitAlt: number;
  orbitSpeed: number;
  orbitAngle: number;
  respawnTimer: number;
  spiralPhase: number;
}

interface BalloonActor {
  index: number;
  reg: BalloonRegistration;
  hitMesh: THREE.Mesh;
  burst: boolean;
  respawnTimer: number;
  basketFallOffset: number;
  basketVelY: number;
}

interface TargetBallActor {
  index: number;
  mesh: THREE.Mesh;
  spawnPos: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
  colorHex: number;
  hits: number;
  burst: boolean;
  respawnTimer: number;
}

interface ConfettiParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
  gravity: number;
}

const _dummy = new THREE.Object3D();
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _cTmp = new THREE.Color();

function createBeachSoccerBallTexture(primaryHex: string, secondaryHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 128, 64);
    for (let s = 0; s < 6; s++) {
      ctx.fillStyle = s % 3 === 0 ? primaryHex : s % 3 === 1 ? secondaryHex : '#f8fafc';
      ctx.fillRect(s * 22, 0, 22, 64);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 8);
    ctx.fillRect(0, 56, 128, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class WorldWildlifeController {
  public readonly root = new THREE.Group();
  public readonly shootableMeshes: THREE.Object3D[] = [];

  private birds: BirdActor[] = [];
  private balloons: BalloonActor[] = [];
  private balls: TargetBallActor[] = [];
  private treePerches: Array<{ x: number; y: number; z: number }> = [];

  private confettiPool: ConfettiParticle[] = [];
  private leavesInstanced: THREE.InstancedMesh | null = null;
  private leafData: Float32Array | null = null;
  private leafAnchorCenters: Array<{ x: number; y: number; z: number }> = [];

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  private hitProxyGeo: THREE.SphereGeometry;
  private hitProxyMat: THREE.MeshBasicMaterial;

  constructor(
    parent: THREE.Object3D,
    treePerches: Array<{ x: number; y: number; z: number }>,
    isSoftwareGl: boolean,
  ) {
    this.treePerches = treePerches;
    this.hitProxyGeo = new THREE.SphereGeometry(1, 8, 6);
    this.hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    this.geometries.push(this.hitProxyGeo);
    this.materials.push(this.hitProxyMat);

    this.initConfettiPool(isSoftwareGl ? 36 : 72);
    this.initBirds(isSoftwareGl);
    this.initDriftingLeaves(isSoftwareGl);
    this.initTargetBalls(isSoftwareGl);

    parent.add(this.root);
  }

  private initConfettiPool(count: number) {
    const geo = new THREE.BoxGeometry(0.18, 0.04, 0.14);
    this.geometries.push(geo);
    const palette = [0xf43f5e, 0xfacc15, 0x38bdf8, 0x22c55e, 0xa855f7, 0xf8fafc, 0x78350f];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: palette[i % palette.length],
        transparent: true,
        opacity: 0.95,
      });
      this.materials.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.root.add(mesh);
      this.confettiPool.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        active: false,
        gravity: 9.5,
      });
    }
  }

  private spawnBurstParticles(
    point: THREE.Vector3,
    colors: number[],
    count: number,
    speed: number,
    gravity = 9.0,
    scale = 1.0,
  ) {
    let spawned = 0;
    for (let i = 0; i < this.confettiPool.length && spawned < count; i++) {
      const p = this.confettiPool[i];
      if (p.active) continue;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.position.copy(point);
      p.mesh.scale.setScalar(scale * (0.7 + Math.random() * 0.7));
      p.mat.color.setHex(colors[spawned % colors.length]);
      p.mat.opacity = 0.95;
      p.vel.set(
        (Math.random() - 0.5) * speed * 2,
        (0.25 + Math.random() * 0.9) * speed,
        (Math.random() - 0.5) * speed * 2,
      );
      p.rotVel.set(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
      );
      p.gravity = gravity;
      p.maxLife = 0.95 + Math.random() * 0.7;
      p.life = p.maxLife;
      spawned++;
    }
  }

  private buildBirdRig(species: 'eagle' | 'pigeon', idx: number): BirdActor {
    const group = new THREE.Group();
    const bodyGroup = new THREE.Group();
    group.add(bodyGroup);

    const isEagle = species === 'eagle';
    const sc = isEagle ? 1.55 : 0.92;

    const bodyColor = isEagle ? 0x3b2618 : idx % 2 === 0 ? 0x64748b : 0x7c8b9e;
    const headColor = isEagle ? 0xf8fafc : 0x475569;
    const wingTipColor = isEagle ? 0x1e140d : 0x334155;

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.75 });
    const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.7 });
    const wingMat = new THREE.MeshStandardMaterial({ color: wingTipColor, roughness: 0.78 });
    const beakMat = new THREE.MeshStandardMaterial({ color: isEagle ? 0xfacc15 : 0xf59e0b, roughness: 0.5 });
    this.materials.push(bodyMat, headMat, wingMat, beakMat);

    const bodyGeo = new THREE.SphereGeometry(0.24 * sc, 8, 6);
    bodyGeo.scale(0.85, 0.78, 1.75);
    const wingGeo = new THREE.BoxGeometry(0.74 * sc, 0.035 * sc, 0.34 * sc);
    const tailGeo = new THREE.BoxGeometry(0.28 * sc, 0.03 * sc, 0.32 * sc);
    const headGeo = new THREE.SphereGeometry(0.13 * sc, 7, 6);
    const beakGeo = new THREE.ConeGeometry(0.05 * sc, 0.14 * sc, 5);
    this.geometries.push(bodyGeo, wingGeo, tailGeo, headGeo, beakGeo);

    const torso = new THREE.Mesh(bodyGeo, bodyMat);
    bodyGroup.add(torso);

    const tail = new THREE.Mesh(tailGeo, isEagle ? headMat : wingMat);
    tail.position.set(0, 0.02 * sc, 0.44 * sc);
    tail.rotation.x = 0.18;
    bodyGroup.add(tail);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.11 * sc, -0.34 * sc);
    const head = new THREE.Mesh(headGeo, headMat);
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.rotation.x = -Math.PI * 0.5;
    beak.position.set(0, -0.02 * sc, -0.14 * sc);
    headGroup.add(head, beak);
    bodyGroup.add(headGroup);

    const leftWing = new THREE.Group();
    leftWing.position.set(-0.14 * sc, 0.06 * sc, -0.04 * sc);
    const lwMesh = new THREE.Mesh(wingGeo, wingMat);
    lwMesh.position.x = -0.37 * sc;
    leftWing.add(lwMesh);
    bodyGroup.add(leftWing);

    const rightWing = new THREE.Group();
    rightWing.position.set(0.14 * sc, 0.06 * sc, -0.04 * sc);
    const rwMesh = new THREE.Mesh(wingGeo, wingMat);
    rwMesh.position.x = 0.37 * sc;
    rightWing.add(rwMesh);
    bodyGroup.add(rightWing);

    const hitMesh = new THREE.Mesh(this.hitProxyGeo, this.hitProxyMat);
    hitMesh.scale.setScalar(isEagle ? 1.25 : 0.85);
    hitMesh.userData.wildlifeKind = 'bird';
    hitMesh.userData.birdIndex = idx;
    group.add(hitMesh);
    this.shootableMeshes.push(hitMesh);

    this.root.add(group);

    return {
      index: idx,
      species,
      group,
      bodyGroup,
      leftWing,
      rightWing,
      headGroup,
      hitMesh,
      mode: 'soar',
      state: 'soaring',
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      yaw: 0,
      flapPhase: idx * 0.9,
      perchIndex: -1,
      targetPerchIndex: -1,
      perchTimer: 0,
      orbitCenterX: 0,
      orbitCenterZ: 0,
      orbitRadius: 34,
      orbitAlt: 28,
      orbitSpeed: 0.3,
      orbitAngle: idx * 0.8,
      respawnTimer: 0,
      spiralPhase: idx * 1.3,
    };
  }

  private initBirds(isSoftwareGl: boolean) {
    // High-altitude soaring hawks/eagles & pigeons across all mega-city sectors
    const soarAnchors = [
      { x: 0, z: 0, r: 42, alt: 30 },
      { x: -46, z: 44, r: 28, alt: 25 },
      { x: 186, z: 36, r: 34, alt: 34 },
      { x: 188, z: -195, r: 38, alt: 38 },
      { x: -165, z: -165, r: 40, alt: 42 },
      { x: 430, z: 24, r: 44, alt: 32 },
      { x: 975, z: 0, r: 52, alt: 40 },
      { x: 1285, z: 188, r: 46, alt: 44 },
      { x: -705, z: -20, r: 48, alt: 36 },
      { x: -155, z: 165, r: 36, alt: 28 },
    ];
    const soarCount = isSoftwareGl ? 14 : 22;
    for (let i = 0; i < soarCount; i++) {
      const a = soarAnchors[i % soarAnchors.length];
      const species: 'eagle' | 'pigeon' = i % 3 === 0 ? 'eagle' : 'pigeon';
      const bird = this.buildBirdRig(species, this.birds.length);
      bird.mode = 'soar';
      bird.state = 'soaring';
      bird.orbitCenterX = a.x + ((i * 19) % 24) - 12;
      bird.orbitCenterZ = a.z + ((i * 23) % 24) - 12;
      bird.orbitRadius = a.r + (i % 4) * 7;
      bird.orbitAlt = a.alt + (i % 5) * 4.2;
      bird.orbitSpeed = (species === 'eagle' ? 0.22 : 0.34) * (i % 2 === 0 ? 1 : -1);
      bird.orbitAngle = (i / soarCount) * Math.PI * 2;
      bird.pos.set(
        bird.orbitCenterX + Math.cos(bird.orbitAngle) * bird.orbitRadius,
        bird.orbitAlt,
        bird.orbitCenterZ + Math.sin(bird.orbitAngle) * bird.orbitRadius,
      );
      bird.group.position.copy(bird.pos);
      this.birds.push(bird);
    }

    // Dynamic Tree-Perched Birds that sit on branches AND periodically fly between trees!
    if (this.treePerches.length > 0) {
      const treeBirdCount = Math.min(this.treePerches.length, isSoftwareGl ? 18 : 30);
      const stride = Math.max(1, Math.floor(this.treePerches.length / treeBirdCount));
      for (let i = 0; i < treeBirdCount; i++) {
        const pIdx = (i * stride) % this.treePerches.length;
        const p = this.treePerches[pIdx];
        const bird = this.buildBirdRig('pigeon', this.birds.length);
        bird.mode = 'tree';
        bird.state = i % 5 === 0 ? 'flying_to_perch' : 'perched';
        bird.perchIndex = pIdx;
        bird.targetPerchIndex = (pIdx + 7) % this.treePerches.length;
        bird.perchTimer = 3.5 + (i % 7) * 1.9;
        bird.pos.set(p.x, p.y, p.z);
        bird.yaw = (i * 1.4) % (Math.PI * 2);
        bird.group.position.copy(bird.pos);
        this.birds.push(bird);
      }
    }
  }

  private initDriftingLeaves(isSoftwareGl: boolean) {
    if (this.treePerches.length === 0) return;
    // Pick representative tree centers so leaves drift naturally under tall trees
    const step = Math.max(1, Math.floor(this.treePerches.length / 40));
    for (let i = 0; i < this.treePerches.length; i += step) {
      this.leafAnchorCenters.push(this.treePerches[i]);
    }
    const leafCount = isSoftwareGl ? 48 : 96;
    const leafGeo = new THREE.PlaneGeometry(0.22, 0.14);
    leafGeo.rotateX(Math.PI * 0.35);
    this.geometries.push(leafGeo);
    const leafMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    this.materials.push(leafMat);

    const im = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
    im.frustumCulled = false;
    this.leafData = new Float32Array(leafCount * 6); // x, y, z, phase, speedY, anchorIdx
    const leafCols = [0x4ade80, 0x22c55e, 0x84cc16, 0xfacc15, 0xf59e0b];

    for (let i = 0; i < leafCount; i++) {
      const aIdx = i % this.leafAnchorCenters.length;
      const anc = this.leafAnchorCenters[aIdx];
      const lx = anc.x + (Math.random() - 0.5) * 4.8;
      const ly = anc.y - Math.random() * 4.5;
      const lz = anc.z + (Math.random() - 0.5) * 4.8;
      this.leafData[i * 6] = lx;
      this.leafData[i * 6 + 1] = ly;
      this.leafData[i * 6 + 2] = lz;
      this.leafData[i * 6 + 3] = Math.random() * Math.PI * 2;
      this.leafData[i * 6 + 4] = 0.65 + Math.random() * 0.75;
      this.leafData[i * 6 + 5] = aIdx;

      _dummy.position.set(lx, ly, lz);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      im.setMatrixAt(i, _dummy.matrix);
      _cTmp.setHex(leafCols[i % leafCols.length]);
      im.setColorAt(i, _cTmp);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    this.leavesInstanced = im;
    this.root.add(im);
  }

  private initTargetBalls(isSoftwareGl: boolean) {
    const ballLocations: Array<{ x: number; z: number; r: number; c1: string; c2: string; hex: number }> = [
      // Central Plaza & Park & Playground
      { x: -41, z: 46, r: 0.44, c1: '#ef4444', c2: '#38bdf8', hex: 0xef4444 },
      { x: -34, z: 52, r: 0.48, c1: '#facc15', c2: '#22c55e', hex: 0xfacc15 },
      { x: -48, z: 38, r: 0.42, c1: '#ec4899', c2: '#facc15', hex: 0xec4899 },
      { x: -8, z: 14, r: 0.45, c1: '#111827', c2: '#38bdf8', hex: 0x38bdf8 },
      { x: 14, z: 18, r: 0.46, c1: '#f97316', c2: '#ffffff', hex: 0xf97316 },
      { x: 24, z: 56, r: 0.48, c1: '#22d3ee', c2: '#f43f5e', hex: 0x22d3ee },
      // Dropzone & Firing Range plaza
      { x: 174, z: 32, r: 0.46, c1: '#ef4444', c2: '#facc15', hex: 0xef4444 },
      { x: 182, z: 44, r: 0.46, c1: '#22c55e', c2: '#38bdf8', hex: 0x22c55e },
      // Bay Beach & Bay Central Park
      { x: 552, z: -18, r: 0.56, c1: '#f43f5e', c2: '#facc15', hex: 0xf43f5e },
      { x: 556, z: 14, r: 0.56, c1: '#38bdf8', c2: '#ffffff', hex: 0x38bdf8 },
      { x: 550, z: 46, r: 0.54, c1: '#a855f7', c2: '#facc15', hex: 0xa855f7 },
      { x: 472, z: 36, r: 0.46, c1: '#111827', c2: '#e2e8f0', hex: 0xe2e8f0 },
      { x: 482, z: 48, r: 0.46, c1: '#10b981', c2: '#facc15', hex: 0x10b981 },
      // Festival & Stadium surroundings
      { x: 82, z: 76, r: 0.5, c1: '#ec4899', c2: '#38bdf8', hex: 0xec4899 },
      { x: 182, z: -194, r: 0.46, c1: '#111827', c2: '#f8fafc', hex: 0xf8fafc },
      { x: 194, z: -196, r: 0.46, c1: '#111827', c2: '#facc15', hex: 0xfacc15 },
      // East Island & West Island Beaches/Parks
      { x: 1260, z: 44, r: 0.48, c1: '#ef4444', c2: '#f8fafc', hex: 0xef4444 },
      { x: 1272, z: 46, r: 0.48, c1: '#38bdf8', c2: '#facc15', hex: 0x38bdf8 },
      { x: -430, z: -18, r: 0.56, c1: '#f97316', c2: '#38bdf8', hex: 0xf97316 },
      { x: -432, z: 24, r: 0.56, c1: '#ec4899', c2: '#facc15', hex: 0xec4899 },
    ];
    const limit = isSoftwareGl ? Math.min(ballLocations.length, 14) : ballLocations.length;
    const sphereGeo = new THREE.SphereGeometry(1, isSoftwareGl ? 10 : 14, isSoftwareGl ? 8 : 12);
    this.geometries.push(sphereGeo);

    for (let i = 0; i < limit; i++) {
      const b = ballLocations[i];
      const tex = createBeachSoccerBallTexture(b.c1, b.c2);
      this.textures.push(tex);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.04 });
      this.materials.push(mat);

      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.scale.setScalar(b.r);
      mesh.position.set(b.x, b.r, b.z);
      mesh.castShadow = !isSoftwareGl;
      mesh.userData.wildlifeKind = 'ball';
      mesh.userData.ballIndex = i;
      this.root.add(mesh);
      this.shootableMeshes.push(mesh);

      this.balls.push({
        index: i,
        mesh,
        spawnPos: new THREE.Vector3(b.x, b.r, b.z),
        pos: new THREE.Vector3(b.x, b.r, b.z),
        vel: new THREE.Vector3(),
        radius: b.r,
        colorHex: b.hex,
        hits: 0,
        burst: false,
        respawnTimer: 0,
      });
    }
  }

  public registerBalloon(reg: BalloonRegistration): void {
    const idx = this.balloons.length;
    const hitMesh = new THREE.Mesh(this.hitProxyGeo, this.hitProxyMat);
    hitMesh.position.set(0, reg.envelopeOffsetY, 0);
    hitMesh.scale.setScalar(reg.hitRadius);
    hitMesh.userData.wildlifeKind = 'balloon';
    hitMesh.userData.balloonIndex = idx;
    reg.group.add(hitMesh);
    this.shootableMeshes.push(hitMesh);
    this.balloons.push({
      index: idx,
      reg,
      hitMesh,
      burst: false,
      respawnTimer: 0,
      basketFallOffset: 0,
      basketVelY: 0,
    });
  }

  public scatterBirds(x: number, z: number, radius = 38): void {
    const rSq = radius * radius;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      if (b.mode !== 'tree' || b.state !== 'perched') continue;
      const dx = b.pos.x - x;
      const dz = b.pos.z - z;
      if (dx * dx + dz * dz <= rSq) {
        b.state = 'flying_to_perch';
        b.perchTimer = 0;
        if (this.treePerches.length > 1) {
          b.targetPerchIndex = (b.perchIndex + 5 + (i % 9)) % this.treePerches.length;
        }
        b.vel.set((Math.random() - 0.5) * 6, 4.5 + Math.random() * 2.5, (Math.random() - 0.5) * 6);
      }
    }
  }

  public handleRayHit(
    mesh: THREE.Object3D,
    rayDir: THREE.Vector3,
    hitPoint: THREE.Vector3,
    damage: number,
  ): WildlifeHitResult {
    const kind = mesh.userData.wildlifeKind as 'bird' | 'balloon' | 'ball' | undefined;
    if (!kind) {
      return { kind: 'none', point: hitPoint };
    }

    if (kind === 'bird') {
      const idx = mesh.userData.birdIndex as number;
      const b = this.birds[idx];
      if (!b || b.state === 'falling' || b.state === 'dead') {
        return { kind: 'none', point: hitPoint };
      }
      b.state = 'falling';
      b.vel.set(rayDir.x * 5.2, 1.4, rayDir.z * 5.2);
      b.spiralPhase = 0;
      b.respawnTimer = 14.0;
      const featherCols = b.species === 'eagle' ? [0x3b2618, 0xf8fafc, 0x991b1b] : [0x64748b, 0xe2e8f0, 0x991b1b];
      this.spawnBurstParticles(hitPoint, featherCols, 14, 4.6, 4.2, 0.9);
      this.scatterBirds(hitPoint.x, hitPoint.z, 34);
      return { kind: 'bird', point: hitPoint, burst: true, birdSpecies: b.species };
    }

    if (kind === 'balloon') {
      const idx = mesh.userData.balloonIndex as number;
      const bl = this.balloons[idx];
      if (!bl || bl.burst) {
        return { kind: 'none', point: hitPoint };
      }
      bl.burst = true;
      bl.respawnTimer = 25.0;
      bl.basketFallOffset = 0;
      bl.basketVelY = -1.5;
      for (let i = 0; i < bl.reg.envelopeMeshes.length; i++) {
        bl.reg.envelopeMeshes[i].visible = false;
      }
      const accent = bl.reg.accentHex ?? 0xf43f5e;
      this.spawnBurstParticles(hitPoint, [accent, 0xfacc15, 0xf8fafc, 0x38bdf8], 26, 9.5, 6.5, 2.2);
      return { kind: 'balloon', point: hitPoint, burst: true, colorHex: accent };
    }

    if (kind === 'ball') {
      const idx = mesh.userData.ballIndex as number;
      const ball = this.balls[idx];
      if (!ball || ball.burst) {
        return { kind: 'none', point: hitPoint };
      }
      ball.hits += 1;
      if (damage >= 48 || ball.hits >= 2) {
        ball.burst = true;
        ball.respawnTimer = 10.0;
        ball.mesh.visible = false;
        this.spawnBurstParticles(hitPoint, [ball.colorHex, 0xffffff, 0xfacc15], 18, 6.8, 9.5, 1.15);
        return { kind: 'ball', point: hitPoint, burst: true, colorHex: ball.colorHex };
      }
      ball.vel.x += rayDir.x * 11.5;
      ball.vel.z += rayDir.z * 11.5;
      ball.vel.y = Math.max(ball.vel.y, 4.6);
      return { kind: 'ball', point: hitPoint, burst: false, bounced: true, colorHex: ball.colorHex };
    }

    return { kind: 'none', point: hitPoint };
  }

  public step(
    dt: number,
    elapsed: number,
    groundHeightAt: (x: number, z: number, curY?: number) => number,
    playerPos: THREE.Vector3,
    vehicleActors: ReadonlyArray<{ position: THREE.Vector3; speed: number; yaw: number; kind: string }>,
  ): { ballBouncedNearPlayer: boolean } {
    let ballBouncedNearPlayer = false;

    // 1. Update Soaring & Tree-Perched Dynamic Birds
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];

      if (b.state === 'dead') {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) {
          if (b.mode === 'tree' && b.perchIndex >= 0 && b.perchIndex < this.treePerches.length) {
            const p = this.treePerches[b.perchIndex];
            b.pos.set(p.x, p.y, p.z);
            b.state = 'perched';
            b.perchTimer = 5.0 + (i % 6) * 2.0;
          } else {
            b.state = 'soaring';
            b.pos.y = b.orbitAlt;
          }
          b.bodyGroup.rotation.set(0, 0, 0);
          b.group.visible = true;
        }
        continue;
      }

      if (b.state === 'falling') {
        // Realistic slow sniper-hit spiral & fluttering wing descent
        b.vel.y = Math.max(-6.8, b.vel.y - 5.4 * dt);
        b.vel.x *= Math.exp(-0.9 * dt);
        b.vel.z *= Math.exp(-0.9 * dt);
        b.pos.addScaledVector(b.vel, dt);
        b.spiralPhase += dt * 7.5;
        b.pos.x += Math.cos(b.spiralPhase) * 1.4 * dt;
        b.pos.z += Math.sin(b.spiralPhase) * 1.4 * dt;

        b.bodyGroup.rotation.x += 3.6 * dt;
        b.bodyGroup.rotation.z += 5.2 * dt;
        b.leftWing.rotation.z = 0.55 + Math.sin(b.spiralPhase * 2) * 0.45;
        b.rightWing.rotation.z = -0.55 - Math.sin(b.spiralPhase * 2) * 0.45;

        const gy = groundHeightAt(b.pos.x, b.pos.z, b.pos.y);
        if (b.pos.y <= gy + 0.14) {
          b.pos.y = gy + 0.14;
          b.state = 'dead';
          b.respawnTimer = 14.0;
          b.group.visible = false;
        }
        b.group.position.copy(b.pos);
        continue;
      }

      if (b.mode === 'soar' && b.state === 'soaring') {
        b.orbitAngle += b.orbitSpeed * dt;
        const nx = b.orbitCenterX + Math.cos(b.orbitAngle) * b.orbitRadius;
        const nz = b.orbitCenterZ + Math.sin(b.orbitAngle) * b.orbitRadius;
        const ny = b.orbitAlt + Math.sin(elapsed * 0.65 + b.index) * 2.4;
        const dx = nx - b.pos.x;
        const dz = nz - b.pos.z;
        if (dx * dx + dz * dz > 1e-6) {
          b.yaw = Math.atan2(-dx, -dz);
        }
        b.pos.set(nx, ny, nz);
        b.group.position.copy(b.pos);
        b.group.rotation.y = b.yaw;
        b.bodyGroup.rotation.set(0, 0, b.orbitSpeed > 0 ? 0.18 : -0.18);

        // Periodic flap bursts followed by long soaring glides
        const glideWindow = Math.sin(elapsed * 0.7 + b.index * 1.3);
        const flapAmp = glideWindow > 0.15 ? 0.52 : 0.08;
        b.flapPhase += dt * (b.species === 'eagle' ? 8.5 : 13.5);
        const flap = Math.sin(b.flapPhase) * flapAmp;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
        continue;
      }

      if (b.mode === 'tree') {
        if (b.state === 'perched') {
          b.perchTimer -= dt;
          // Gentle head look-around & tail bob while sitting on tree branch
          b.headGroup.rotation.y = Math.sin(elapsed * 2.2 + b.index) * 0.45;
          b.headGroup.rotation.x = Math.sin(elapsed * 3.7 + b.index) * 0.12;
          b.leftWing.rotation.z = 1.05;
          b.rightWing.rotation.z = -1.05;
          b.bodyGroup.rotation.set(0, 0, 0);
          b.group.position.copy(b.pos);
          b.group.rotation.y = b.yaw;

          if (b.perchTimer <= 0 && this.treePerches.length > 1) {
            b.state = 'flying_to_perch';
            b.targetPerchIndex = (b.perchIndex + 3 + (Math.floor(elapsed * 7 + b.index) % 13)) % this.treePerches.length;
            b.vel.set(0, 3.2, 0);
          }
        } else if (b.state === 'flying_to_perch' && this.treePerches.length > 0) {
          const tgt = this.treePerches[b.targetPerchIndex];
          const midArcY = Math.max(tgt.y, b.pos.y) + 3.5;
          const dx = tgt.x - b.pos.x;
          const dz = tgt.z - b.pos.z;
          const horizDist = Math.hypot(dx, dz);
          const dy = (horizDist > 4 ? midArcY : tgt.y) - b.pos.y;
          const totalDist = Math.hypot(horizDist, dy) || 1;
          const flySpeed = 9.5;
          b.vel.set((dx / totalDist) * flySpeed, (dy / totalDist) * flySpeed, (dz / totalDist) * flySpeed);
          b.pos.addScaledVector(b.vel, dt);
          if (horizDist > 0.2) {
            b.yaw = Math.atan2(-dx, -dz);
          }
          b.flapPhase += dt * 16.0;
          const flap = Math.sin(b.flapPhase) * 0.65;
          b.leftWing.rotation.z = flap;
          b.rightWing.rotation.z = -flap;
          b.bodyGroup.rotation.set(-0.15, 0, 0);
          b.group.position.copy(b.pos);
          b.group.rotation.y = b.yaw;

          if (horizDist < 0.75 && Math.abs(tgt.y - b.pos.y) < 0.9) {
            b.pos.set(tgt.x, tgt.y, tgt.z);
            b.perchIndex = b.targetPerchIndex;
            b.state = 'perched';
            b.perchTimer = 5.5 + (b.index % 7) * 2.2;
          }
        }
      }
    }

    // 2. Update Floating & Burst Hot-Air Balloons
    for (let i = 0; i < this.balloons.length; i++) {
      const bl = this.balloons[i];
      const reg = bl.reg;
      if (bl.burst) {
        bl.respawnTimer -= dt;
        bl.basketVelY -= 16 * dt;
        bl.basketFallOffset += bl.basketVelY * dt;
        for (let k = 0; k < reg.basketMeshes.length; k++) {
          const bm = reg.basketMeshes[k];
          if (bm.userData.origY === undefined) bm.userData.origY = bm.position.y;
          bm.position.y = (bm.userData.origY as number) + bl.basketFallOffset;
          bm.rotation.z += dt * 1.4;
        }
        if (bl.respawnTimer <= 0) {
          bl.burst = false;
          bl.basketFallOffset = 0;
          bl.basketVelY = 0;
          for (let k = 0; k < reg.envelopeMeshes.length; k++) {
            reg.envelopeMeshes[k].visible = true;
          }
          for (let k = 0; k < reg.basketMeshes.length; k++) {
            const bm = reg.basketMeshes[k];
            if (bm.userData.origY !== undefined) bm.position.y = bm.userData.origY as number;
            bm.rotation.z = 0;
          }
        }
      } else {
        reg.group.position.x = reg.baseX + Math.sin(elapsed * 0.14 + reg.phase) * reg.ampX;
        reg.group.position.y = reg.baseY + Math.sin(elapsed * 0.42 + reg.phase) * 1.8;
        reg.group.position.z = reg.baseZ + Math.cos(elapsed * 0.12 + reg.phase) * reg.ampZ;
        reg.group.rotation.y = elapsed * 0.08 + reg.phase;
      }
    }

    // 3. Update Dynamic Drifting Tree Leaves in Airflow
    if (this.leavesInstanced && this.leafData && this.leafAnchorCenters.length > 0) {
      const count = this.leavesInstanced.count;
      const windX = 1.65 + Math.sin(elapsed * 0.55) * 0.85;
      const windZ = 0.75 + Math.cos(elapsed * 0.42) * 0.55;
      for (let i = 0; i < count; i++) {
        const off = i * 6;
        let lx = this.leafData[off];
        let ly = this.leafData[off + 1];
        let lz = this.leafData[off + 2];
        const phase = this.leafData[off + 3];
        const spdY = this.leafData[off + 4];
        const aIdx = this.leafData[off + 5] | 0;
        const anc = this.leafAnchorCenters[aIdx];

        lx += (windX + Math.sin(elapsed * 2.4 + phase) * 0.9) * dt;
        lz += (windZ + Math.cos(elapsed * 2.1 + phase) * 0.9) * dt;
        ly -= spdY * dt;

        const floorY = groundHeightAt(lx, lz, anc.y);
        if (ly <= floorY + 0.05) {
          lx = anc.x + Math.sin(elapsed + phase * 3) * 2.8;
          lz = anc.z + Math.cos(elapsed + phase * 5) * 2.8;
          ly = anc.y - Math.random() * 0.6;
        }
        this.leafData[off] = lx;
        this.leafData[off + 1] = ly;
        this.leafData[off + 2] = lz;

        _dummy.position.set(lx, ly, lz);
        _dummy.rotation.set(elapsed * 1.8 + phase, elapsed * 1.3 + phase, Math.sin(elapsed * 3 + phase) * 0.7);
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        this.leavesInstanced.setMatrixAt(i, _dummy.matrix);
      }
      this.leavesInstanced.instanceMatrix.needsUpdate = true;
    }

    // 4. Update Physics Target Balls (Player/Vehicle kick + bounce + confetti respawn)
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      if (ball.burst) {
        ball.respawnTimer -= dt;
        if (ball.respawnTimer <= 0) {
          ball.burst = false;
          ball.hits = 0;
          ball.pos.copy(ball.spawnPos);
          ball.pos.y = groundHeightAt(ball.pos.x, ball.pos.z, 0) + ball.radius;
          ball.vel.set(0, 0, 0);
          ball.mesh.position.copy(ball.pos);
          ball.mesh.visible = true;
        }
        continue;
      }

      // Player kick impulse
      const pdx = ball.pos.x - playerPos.x;
      const pdz = ball.pos.z - playerPos.z;
      const pDist = Math.hypot(pdx, pdz);
      if (pDist < ball.radius + 0.65 && Math.abs(ball.pos.y - playerPos.y) < 1.6) {
        const nx = pDist > 0.01 ? pdx / pDist : 1;
        const nz = pDist > 0.01 ? pdz / pDist : 0;
        ball.vel.x += nx * 8.5;
        ball.vel.z += nz * 8.5;
        ball.vel.y = Math.max(ball.vel.y, 4.2);
        ballBouncedNearPlayer = true;
      }

      // Vehicle bumper kick impulse
      for (let vIdx = 0; vIdx < vehicleActors.length; vIdx++) {
        const veh = vehicleActors[vIdx];
        if (Math.abs(veh.speed) < 0.8) continue;
        const vdx = ball.pos.x - veh.position.x;
        const vdz = ball.pos.z - veh.position.z;
        const vDist = Math.hypot(vdx, vdz);
        if (vDist < 2.2 + ball.radius && Math.abs(ball.pos.y - veh.position.y) < 1.8) {
          const nx = vDist > 0.01 ? vdx / vDist : -Math.sin(veh.yaw);
          const nz = vDist > 0.01 ? vdz / vDist : -Math.cos(veh.yaw);
          const push = Math.max(6, Math.abs(veh.speed) * 1.15);
          ball.vel.x = nx * push;
          ball.vel.z = nz * push;
          ball.vel.y = Math.max(ball.vel.y, 3.8 + Math.min(5, Math.abs(veh.speed) * 0.25));
          if (vDist < 12 && playerPos.distanceToSquared(ball.pos) < 400) {
            ballBouncedNearPlayer = true;
          }
        }
      }

      if (ball.vel.lengthSq() > 0.002 || ball.pos.y > groundHeightAt(ball.pos.x, ball.pos.z, ball.pos.y) + ball.radius + 0.02) {
        ball.vel.y -= 17.5 * dt;
        ball.pos.addScaledVector(ball.vel, dt);
        const gy = groundHeightAt(ball.pos.x, ball.pos.z, ball.pos.y);
        if (ball.pos.y <= gy + ball.radius) {
          ball.pos.y = gy + ball.radius;
          if (ball.vel.y < -1.8) {
            ball.vel.y = Math.abs(ball.vel.y) * 0.62;
            if (playerPos.distanceToSquared(ball.pos) < 320) ballBouncedNearPlayer = true;
          } else {
            ball.vel.y = 0;
          }
          ball.vel.x *= Math.exp(-1.8 * dt);
          ball.vel.z *= Math.exp(-1.8 * dt);
        }
        ball.mesh.rotation.x += ball.vel.z * dt * 1.8;
        ball.mesh.rotation.z -= ball.vel.x * dt * 1.8;
        ball.mesh.position.copy(ball.pos);
      }
    }

    // 5. Update Burst Confetti / Feather Particles
    for (let i = 0; i < this.confettiPool.length; i++) {
      const p = this.confettiPool[i];
      if (!p.active) continue;
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.vel.x *= Math.exp(-1.6 * dt);
      p.vel.z *= Math.exp(-1.6 * dt);
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.rotation.z += p.rotVel.z * dt;
      p.mat.opacity = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    return { ballBouncedNearPlayer };
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
    this.shootableMeshes.length = 0;
    this.birds.length = 0;
    this.balloons.length = 0;
    this.balls.length = 0;
    this.confettiPool.length = 0;
  }
}
