import * as THREE from 'three';
import {
  shouldStepDestructionPhysics,
  type SmartCityComponentKind,
  type SmartCityMaterialKind,
  type SmartCityTargetKind,
} from './smartCityDestruction';

export interface SmartCityHitTargetMeta {
  kind: SmartCityTargetKind;
  index: number;
  component: SmartCityComponentKind;
  material: SmartCityMaterialKind;
}

export function tagDestructibleMesh(
  obj: THREE.Object3D,
  kind: SmartCityTargetKind,
  index: number,
  component: SmartCityComponentKind,
  material: SmartCityMaterialKind,
  outMeshes: THREE.Object3D[],
): void {
  const meta: SmartCityHitTargetMeta = { kind, index, component, material };
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.userData.scTarget = meta;
      outMeshes.push(child);
    }
  });
}

interface PooledSpark {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
}

interface PooledShrapnel {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
}

interface PooledSmoke {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  startScale: number;
}

interface PooledBulletMark {
  mesh: THREE.Mesh;
  active: boolean;
  age: number;
  parentObj: THREE.Object3D | null;
  localOffset: THREE.Vector3;
}

interface PooledDebrisPiece {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  active: boolean;
  age: number;
  maxAge: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  halfH: number;
  grounded: boolean;
}

const _tmpNormal = new THREE.Vector3();
const _tmpWorld = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

export class SmartCityDestructionEffectsPool {
  public readonly group = new THREE.Group();
  private readonly sparks: PooledSpark[] = [];
  private readonly shrapnel: PooledShrapnel[] = [];
  private readonly smoke: PooledSmoke[] = [];
  private readonly marks: PooledBulletMark[] = [];
  private readonly debris: PooledDebrisPiece[] = [];
  private markCursor = 0;
  private smokeCursor = 0;

  private readonly sparkGeo: THREE.BufferGeometry;
  private readonly shrapGeo: THREE.BufferGeometry;
  private readonly smokeGeo: THREE.BufferGeometry;
  private readonly markGeo: THREE.BufferGeometry;
  private readonly debrisBoxGeo: THREE.BufferGeometry;

  private readonly sparkOrangeMat: THREE.MeshBasicMaterial;
  private readonly sparkCyanMat: THREE.MeshBasicMaterial;
  private readonly sparkGlassMat: THREE.MeshBasicMaterial;
  private readonly shrapMetalMat: THREE.MeshStandardMaterial;
  private readonly shrapDarkMat: THREE.MeshStandardMaterial;
  private readonly markMat: THREE.MeshBasicMaterial;

  constructor(
    parent: THREE.Object3D,
    private readonly groundHeightAt: (x: number, z: number, y?: number) => number,
  ) {
    this.group.name = 'SmartCityDestructionEffectsPool';
    parent.add(this.group);

    this.sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.34);
    this.shrapGeo = new THREE.BoxGeometry(0.11, 0.04, 0.14);
    this.smokeGeo = new THREE.SphereGeometry(0.45, 7, 6);
    this.markGeo = new THREE.CircleGeometry(0.12, 8);
    this.debrisBoxGeo = new THREE.BoxGeometry(1, 1, 1);

    this.sparkOrangeMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
    this.sparkCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.sparkGlassMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    this.shrapMetalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.78, roughness: 0.28 });
    this.shrapDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.72 });
    this.markMat = new THREE.MeshBasicMaterial({
      color: 0x090d14,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });

    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(this.sparkGeo, i % 3 === 0 ? this.sparkCyanMat : this.sparkOrangeMat);
      m.visible = false;
      this.group.add(m);
      this.sparks.push({ mesh: m, active: false, life: 0, maxLife: 0.3, vx: 0, vy: 0, vz: 0 });
    }

    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(this.shrapGeo, i % 2 === 0 ? this.shrapMetalMat : this.shrapDarkMat);
      m.visible = false;
      this.group.add(m);
      this.shrapnel.push({ mesh: m, active: false, life: 0, maxLife: 0.8, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0 });
    }

    for (let i = 0; i < 36; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x334155,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      });
      const m = new THREE.Mesh(this.smokeGeo, mat);
      m.visible = false;
      this.group.add(m);
      this.smoke.push({ mesh: m, mat, active: false, life: 0, maxLife: 1.6, vx: 0, vy: 1.4, vz: 0, startScale: 0.4 });
    }

    for (let i = 0; i < 64; i++) {
      const m = new THREE.Mesh(this.markGeo, this.markMat);
      m.visible = false;
      this.group.add(m);
      this.marks.push({
        mesh: m,
        active: false,
        age: 0,
        parentObj: null,
        localOffset: new THREE.Vector3(),
      });
    }

    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.55, roughness: 0.42 });
      const m = new THREE.Mesh(this.debrisBoxGeo, mat);
      m.visible = false;
      this.group.add(m);
      this.debris.push({
        mesh: m,
        mat,
        active: false,
        age: 0,
        maxAge: 26,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        halfH: 0.14,
        grounded: false,
      });
    }
  }

  public spawnMaterialImpact(
    point: THREE.Vector3,
    normal: THREE.Vector3,
    material: SmartCityMaterialKind,
    sparkCount: number,
    shrapnelCount: number,
    scale: number,
    craterScale: number,
    hitObject?: THREE.Object3D | null,
  ): void {
    const sparkMat =
      material === 'glass'
        ? this.sparkGlassMat
        : material === 'metal'
          ? this.sparkOrangeMat
          : this.sparkCyanMat;

    let spawnedSparks = 0;
    for (let i = 0; i < this.sparks.length && spawnedSparks < sparkCount; i++) {
      const sp = this.sparks[i];
      if (sp.active) continue;
      sp.active = true;
      sp.life = 0;
      sp.maxLife = 0.18 + Math.random() * 0.22;
      sp.mesh.material = sparkMat;
      sp.mesh.position.copy(point);
      sp.mesh.scale.setScalar(scale * (0.7 + Math.random() * 0.6));
      const spread = 4.2 * scale;
      sp.vx = normal.x * (3.2 + Math.random() * 3.8) + (Math.random() - 0.5) * spread;
      sp.vy = normal.y * (2.5 + Math.random() * 3.5) + Math.random() * 2.4;
      sp.vz = normal.z * (3.2 + Math.random() * 3.8) + (Math.random() - 0.5) * spread;
      sp.mesh.visible = true;
      spawnedSparks++;
    }

    let spawnedShrap = 0;
    const shrapMat = material === 'rubber' || material === 'composite' ? this.shrapDarkMat : this.shrapMetalMat;
    for (let i = 0; i < this.shrapnel.length && spawnedShrap < shrapnelCount; i++) {
      const sh = this.shrapnel[i];
      if (sh.active) continue;
      sh.active = true;
      sh.life = 0;
      sh.maxLife = 0.45 + Math.random() * 0.45;
      sh.mesh.material = shrapMat;
      sh.mesh.position.copy(point);
      sh.mesh.scale.setScalar(scale * (0.65 + Math.random() * 0.7));
      sh.vx = normal.x * (2.4 + Math.random() * 4.2) + (Math.random() - 0.5) * 4.5;
      sh.vy = 2.0 + Math.random() * 4.4;
      sh.vz = normal.z * (2.4 + Math.random() * 4.2) + (Math.random() - 0.5) * 4.5;
      sh.rx = (Math.random() - 0.5) * 18;
      sh.ry = (Math.random() - 0.5) * 18;
      sh.mesh.visible = true;
      spawnedShrap++;
    }

    // Bullet mark / crater overlay
    const mk = this.marks[this.markCursor % this.marks.length];
    this.markCursor++;
    mk.active = true;
    mk.age = 0;
    mk.mesh.scale.setScalar(craterScale * (material === 'glass' ? 1.45 : 1.0));
    if (hitObject && hitObject.matrixWorld) {
      mk.parentObj = hitObject;
      _tmpWorld.copy(point).addScaledVector(normal, 0.015);
      hitObject.worldToLocal(mk.localOffset.copy(_tmpWorld));
      mk.mesh.position.copy(_tmpWorld);
    } else {
      mk.parentObj = null;
      mk.mesh.position.copy(point).addScaledVector(normal, 0.015);
    }
    _tmpNormal.copy(normal).normalize();
    if (_tmpNormal.lengthSq() < 0.1) _tmpNormal.set(0, 1, 0);
    mk.mesh.quaternion.setFromUnitVectors(_upAxis, _tmpNormal);
    mk.mesh.rotateX(Math.PI * 0.5);
    mk.mesh.visible = true;
  }

  public spawnSmokePuff(x: number, y: number, z: number, intensity = 0.7): void {
    const sm = this.smoke[this.smokeCursor % this.smoke.length];
    this.smokeCursor++;
    sm.active = true;
    sm.life = 0;
    sm.maxLife = 1.0 + intensity * 0.9;
    sm.startScale = 0.35 + intensity * 0.55;
    sm.mesh.position.set(x + (Math.random() - 0.5) * 0.35, y, z + (Math.random() - 0.5) * 0.35);
    sm.mesh.scale.setScalar(sm.startScale);
    sm.vx = (Math.random() - 0.5) * 0.65;
    sm.vy = 1.4 + intensity * 1.4;
    sm.vz = (Math.random() - 0.5) * 0.65;
    sm.mat.opacity = Math.min(0.62, 0.25 + intensity * 0.35);
    sm.mesh.visible = true;
  }

  public spawnDetachedDebris(
    x: number,
    y: number,
    z: number,
    component: SmartCityComponentKind,
    colorHex = 0xe2e8f0,
    impulseScale = 1.0,
  ): void {
    let slot: PooledDebrisPiece | null = null;
    for (let i = 0; i < this.debris.length; i++) {
      if (!this.debris[i].active) {
        slot = this.debris[i];
        break;
      }
    }
    if (!slot) {
      // Recycle oldest debris piece
      slot = this.debris[0];
      for (let i = 1; i < this.debris.length; i++) {
        if (this.debris[i].age > slot.age) slot = this.debris[i];
      }
    }
    slot.active = true;
    slot.age = 0;
    slot.maxAge = 26;
    slot.grounded = false;
    slot.mat.color.setHex(colorHex);
    slot.mesh.position.set(x, y, z);

    // Shape dimensions per mechanical component type
    if (component === 'head') {
      slot.mesh.scale.set(0.36, 0.34, 0.36);
      slot.halfH = 0.17;
    } else if (component === 'arm_l' || component === 'arm_r' || component === 'tool_arm') {
      slot.mesh.scale.set(0.16, 0.48, 0.16);
      slot.halfH = 0.14;
    } else if (component === 'leg_l' || component === 'leg_r') {
      slot.mesh.scale.set(0.18, 0.62, 0.18);
      slot.halfH = 0.14;
    } else if (component.startsWith('rotor_')) {
      slot.mesh.scale.set(0.76, 0.05, 0.12);
      slot.halfH = 0.05;
    } else if (component === 'wheel' || component === 'roller') {
      slot.mesh.scale.set(0.45, 0.45, 0.25);
      slot.halfH = 0.22;
    } else {
      slot.mesh.scale.set(0.38, 0.12, 0.32);
      slot.halfH = 0.08;
    }

    const ang = Math.random() * Math.PI * 2;
    const spd = (2.4 + Math.random() * 3.8) * impulseScale;
    slot.vx = Math.cos(ang) * spd;
    slot.vy = (3.4 + Math.random() * 4.2) * impulseScale;
    slot.vz = Math.sin(ang) * spd;
    slot.rx = (Math.random() - 0.5) * 14;
    slot.ry = (Math.random() - 0.5) * 14;
    slot.rz = (Math.random() - 0.5) * 14;
    slot.mesh.visible = true;
  }

  public clearAllMarksAndDebris(): void {
    for (let i = 0; i < this.marks.length; i++) {
      this.marks[i].active = false;
      this.marks[i].parentObj = null;
      this.marks[i].mesh.visible = false;
    }
    for (let i = 0; i < this.debris.length; i++) {
      this.debris[i].active = false;
      this.debris[i].mesh.visible = false;
    }
    for (let i = 0; i < this.smoke.length; i++) {
      this.smoke[i].active = false;
      this.smoke[i].mesh.visible = false;
    }
  }

  public update(dt: number, cameraX: number, cameraZ: number): void {
    const clampedDt = Math.min(dt, 0.06);

    for (let i = 0; i < this.sparks.length; i++) {
      const sp = this.sparks[i];
      if (!sp.active) continue;
      sp.life += clampedDt;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        sp.mesh.visible = false;
        continue;
      }
      sp.vy -= 14.0 * clampedDt;
      sp.mesh.position.x += sp.vx * clampedDt;
      sp.mesh.position.y += sp.vy * clampedDt;
      sp.mesh.position.z += sp.vz * clampedDt;
      sp.mesh.lookAt(
        sp.mesh.position.x + sp.vx,
        sp.mesh.position.y + sp.vy,
        sp.mesh.position.z + sp.vz,
      );
    }

    for (let i = 0; i < this.shrapnel.length; i++) {
      const sh = this.shrapnel[i];
      if (!sh.active) continue;
      sh.life += clampedDt;
      if (sh.life >= sh.maxLife) {
        sh.active = false;
        sh.mesh.visible = false;
        continue;
      }
      sh.vy -= 16.0 * clampedDt;
      sh.mesh.position.x += sh.vx * clampedDt;
      sh.mesh.position.y += sh.vy * clampedDt;
      sh.mesh.position.z += sh.vz * clampedDt;
      sh.mesh.rotation.x += sh.rx * clampedDt;
      sh.mesh.rotation.y += sh.ry * clampedDt;
    }

    for (let i = 0; i < this.smoke.length; i++) {
      const sm = this.smoke[i];
      if (!sm.active) continue;
      sm.life += clampedDt;
      if (sm.life >= sm.maxLife) {
        sm.active = false;
        sm.mesh.visible = false;
        continue;
      }
      const p = sm.life / sm.maxLife;
      sm.mesh.position.x += sm.vx * clampedDt;
      sm.mesh.position.y += sm.vy * clampedDt;
      sm.mesh.position.z += sm.vz * clampedDt;
      sm.mesh.scale.setScalar(sm.startScale * (1 + p * 2.1));
      sm.mat.opacity = 0.45 * (1 - p);
    }

    // Track bullet marks attached to moving robots/machines
    for (let i = 0; i < this.marks.length; i++) {
      const mk = this.marks[i];
      if (!mk.active) continue;
      mk.age += clampedDt;
      if (mk.age > 45) {
        mk.active = false;
        mk.mesh.visible = false;
        continue;
      }
      if (mk.parentObj) {
        if (!mk.parentObj.visible) {
          mk.mesh.visible = false;
        } else if (shouldStepDestructionPhysics(mk.mesh.position.x, mk.mesh.position.z, cameraX, cameraZ, 150)) {
          _tmpWorld.copy(mk.localOffset).applyMatrix4(mk.parentObj.matrixWorld);
          mk.mesh.position.copy(_tmpWorld);
        }
      }
    }

    // Step bouncing rigid-body mechanical debris with environment ground collision
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      if (!d.active) continue;
      d.age += clampedDt;
      if (d.age >= d.maxAge) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      if (!shouldStepDestructionPhysics(d.mesh.position.x, d.mesh.position.z, cameraX, cameraZ, 180)) {
        continue;
      }
      if (!d.grounded) {
        d.vy -= 18.0 * clampedDt;
        d.mesh.position.x += d.vx * clampedDt;
        d.mesh.position.y += d.vy * clampedDt;
        d.mesh.position.z += d.vz * clampedDt;
        d.mesh.rotation.x += d.rx * clampedDt;
        d.mesh.rotation.y += d.ry * clampedDt;
        d.mesh.rotation.z += d.rz * clampedDt;

        const floorY = this.groundHeightAt(d.mesh.position.x, d.mesh.position.z, d.mesh.position.y) + d.halfH;
        if (d.mesh.position.y <= floorY) {
          d.mesh.position.y = floorY;
          if (Math.abs(d.vy) > 1.35) {
            d.vy = -d.vy * 0.36;
            d.vx *= 0.62;
            d.vz *= 0.62;
            d.rx *= 0.55;
            d.ry *= 0.55;
            d.rz *= 0.55;
          } else {
            d.vy = 0;
            d.vx = 0;
            d.vz = 0;
            d.grounded = true;
          }
        }
      }
    }
  }

  public dispose(): void {
    this.sparkGeo.dispose();
    this.shrapGeo.dispose();
    this.smokeGeo.dispose();
    this.markGeo.dispose();
    this.debrisBoxGeo.dispose();
    this.sparkOrangeMat.dispose();
    this.sparkCyanMat.dispose();
    this.sparkGlassMat.dispose();
    this.shrapMetalMat.dispose();
    this.shrapDarkMat.dispose();
    this.markMat.dispose();
    for (let i = 0; i < this.smoke.length; i++) this.smoke[i].mat.dispose();
    for (let i = 0; i < this.debris.length; i++) this.debris[i].mat.dispose();
  }
}
