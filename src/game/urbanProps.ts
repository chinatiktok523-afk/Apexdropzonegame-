import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DigitalDisplayManager } from './digitalDisplays';

export type PropColliderAdder = (
  cx: number,
  minY: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  rotY?: number,
  surface?: 'concrete' | 'metal' | 'wood' | 'dirt',
) => void;

export interface UrbanPropInstance {
  x: number;
  z: number;
  rotY?: number;
  scale?: number;
  variant?: number;
}

export interface UrbanPropsBatchConfig {
  sceneParent: THREE.Group;
  groundHeightAt: (x: number, z: number, currentY?: number) => number;
  addCollider: PropColliderAdder;
  shootableEnv: THREE.Object3D[];
  isNight: boolean;
  isSoftwareGl: boolean;
  geometriesToDispose: THREE.BufferGeometry[];
  materialsToDispose: THREE.Material[];
  displays?: DigitalDisplayManager;
}

export interface CompiledPropMats {
  solid: THREE.MeshStandardMaterial;
  glossy: THREE.MeshStandardMaterial;
  emissive: THREE.MeshBasicMaterial;
  glass: THREE.MeshStandardMaterial;
  all: THREE.Material[];
}

export interface BuiltPropModel {
  group: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

export function createPropPbrMaterials(isNight: boolean): CompiledPropMats {
  const solid = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.08,
  });
  const glossy = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.24,
    metalness: 0.42,
  });
  const emissive = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
    color: isNight ? 0xffffff : 0xfef9c3,
  });
  const glass = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.76,
  });
  return { solid, glossy, emissive, glass, all: [solid, glossy, emissive, glass] };
}

export type PropBucket = 'solid' | 'glossy' | 'emissive' | 'glass';

export class PropMeshAssembler {
  private buckets: Record<PropBucket, THREE.BufferGeometry[]> = {
    solid: [],
    glossy: [],
    emissive: [],
    glass: [],
  };

  public addGeo(geo: THREE.BufferGeometry, colorHex: number, bucket: PropBucket = 'solid'): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    const count = g.attributes.position.count;
    const col = new THREE.Color(colorHex);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = col.r;
      arr[i * 3 + 1] = col.g;
      arr[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.buckets[bucket].push(g);
    if (g !== geo) geo.dispose();
  }

  public addCylinder(
    rTop: number,
    rBot: number,
    h: number,
    radialSegs: number,
    x: number,
    y: number,
    z: number,
    colorHex: number,
    bucket: PropBucket = 'solid',
    rotX = 0,
    rotY = 0,
    rotZ = 0,
    openEnded = false,
  ): void {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, radialSegs, 1, openEnded);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    this.addGeo(g, colorHex, bucket);
  }

  public addCone(
    radius: number,
    height: number,
    radialSegs: number,
    x: number,
    y: number,
    z: number,
    colorHex: number,
    bucket: PropBucket = 'solid',
    rotX = 0,
    rotY = 0,
    rotZ = 0,
  ): void {
    const g = new THREE.ConeGeometry(radius, height, radialSegs);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    this.addGeo(g, colorHex, bucket);
  }

  public addBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    colorHex: number,
    bucket: PropBucket = 'solid',
    rotX = 0,
    rotY = 0,
    rotZ = 0,
  ): void {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    this.addGeo(g, colorHex, bucket);
  }

  public addSphere(
    r: number,
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
    colorHex: number,
    bucket: PropBucket = 'solid',
    detail = 1,
  ): void {
    const g = new THREE.IcosahedronGeometry(r, detail);
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    this.addGeo(g, colorHex, bucket);
  }

  public addTorus(
    radius: number,
    tube: number,
    x: number,
    y: number,
    z: number,
    colorHex: number,
    bucket: PropBucket = 'solid',
    rotX = 0,
    rotY = 0,
    rotZ = 0,
    arc = Math.PI * 2,
  ): void {
    const g = new THREE.TorusGeometry(radius, tube, 8, 22, arc);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    this.addGeo(g, colorHex, bucket);
  }

  public addTube(
    points: THREE.Vector3[],
    radius: number,
    tubularSegs: number,
    radialSegs: number,
    colorHex: number,
    bucket: PropBucket = 'solid',
  ): void {
    const curve = new THREE.CatmullRomCurve3(points);
    const g = new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);
    this.addGeo(g, colorHex, bucket);
  }

  public addExtrude(
    shape: THREE.Shape,
    depth: number,
    bevel: number,
    x: number,
    y: number,
    z: number,
    colorHex: number,
    bucket: PropBucket = 'solid',
    rotX = 0,
    rotY = 0,
    rotZ = 0,
  ): void {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 10,
    });
    g.translate(0, 0, -depth * 0.5);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    this.addGeo(g, colorHex, bucket);
  }

  public addCheckerPad(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    cols: number,
    rows: number,
    colorFn: (ix: number, iz: number) => number,
    bucket: PropBucket = 'solid',
  ): void {
    const cw = w / cols;
    const cd = d / rows;
    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        const px = x - w * 0.5 + (ix + 0.5) * cw;
        const pz = z - d * 0.5 + (iz + 0.5) * cd;
        this.addBox(px, y, pz, cw * 0.995, h, cd * 0.995, colorFn(ix, iz), bucket);
      }
    }
  }

  public compile(
    mats: CompiledPropMats,
    opts?: { castShadow?: boolean; receiveShadow?: boolean },
  ): BuiltPropModel {
    const group = new THREE.Group();
    const geometries: THREE.BufferGeometry[] = [];
    const cast = opts?.castShadow ?? false;
    const recv = opts?.receiveShadow ?? true;

    (['solid', 'glossy', 'emissive', 'glass'] as PropBucket[]).forEach((b) => {
      const list = this.buckets[b];
      if (list.length === 0) return;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      geometries.push(merged);
      const mesh = new THREE.Mesh(merged, mats[b]);
      mesh.name = `prop_${b}`;
      mesh.castShadow = b !== 'emissive' && b !== 'glass' && cast;
      mesh.receiveShadow = b !== 'emissive' && recv;
      group.add(mesh);
    });

    return { group, geometries, materials: [] };
  }
}

function createInstancedFromProp(
  built: BuiltPropModel,
  transforms: { x: number; y: number; z: number; rotY: number; scale: number }[],
  parent: THREE.Group,
  geometriesToDispose: THREE.BufferGeometry[],
  materialsToDispose: THREE.Material[],
  shootableEnv?: THREE.Object3D[],
) {
  if (transforms.length === 0) {
    built.geometries.forEach((g) => g.dispose());
    built.materials.forEach((m) => m.dispose());
    return;
  }
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const euler = new THREE.Euler();

  for (const child of built.group.children) {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) continue;
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, transforms.length);
    im.castShadow = mesh.castShadow;
    im.receiveShadow = mesh.receiveShadow;
    for (let i = 0; i < transforms.length; i++) {
      const t = transforms[i];
      pos.set(t.x, t.y, t.z);
      euler.set(0, t.rotY, 0);
      quat.setFromEuler(euler);
      scl.setScalar(t.scale);
      mat4.compose(pos, quat, scl);
      im.setMatrixAt(i, mat4);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    parent.add(im);
    if (shootableEnv && mesh.name !== 'prop_emissive') {
      shootableEnv.push(im);
    }
  }

  geometriesToDispose.push(...built.geometries);
  materialsToDispose.push(...built.materials);
}

/**
 * Curved tapered cast-steel streetlight (single or double arm) with luminaire hood.
 */
export function buildRealisticStreetlight(
  isNight: boolean,
  doubleArm = false,
  sharedMats?: CompiledPropMats,
): BuiltPropModel {
  const mats = sharedMats ?? createPropPbrMaterials(isNight);
  const pb = new PropMeshAssembler();
  const poleCol = 0x334155;
  const trimCol = 0x64748b;
  const lampCol = isNight ? 0xfef08a : 0xfffbeb;

  pb.addCylinder(0.2, 0.28, 0.52, 10, 0, 0.26, 0, poleCol, 'glossy');
  pb.addCylinder(0.08, 0.13, 5.1, 10, 0, 3.05, 0, poleCol, 'glossy');
  pb.addCylinder(0.14, 0.14, 0.12, 10, 0, 2.2, 0, trimCol, 'glossy');

  const addArm = (dir: number) => {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 5.45, 0),
      new THREE.Vector3(dir * 0.65, 5.75, 0),
      new THREE.Vector3(dir * 1.5, 5.66, 0),
    ]);
    const armGeo = new THREE.TubeGeometry(armCurve, 8, 0.055, 7, false);
    pb.addGeo(armGeo, trimCol, 'glossy');

    // Luminaire hood & LED panel
    pb.addCylinder(0.24, 0.34, 0.14, 10, dir * 1.62, 5.65, 0, poleCol, 'glossy');
    pb.addCylinder(0.26, 0.26, 0.06, 10, dir * 1.62, 5.56, 0, lampCol, 'emissive');
  };

  addArm(1);
  if (doubleArm) addArm(-1);

  const built = pb.compile(mats, { castShadow: false, receiveShadow: true });
  if (!sharedMats) built.materials.push(...mats.all);
  return built;
}

/**
 * Traffic Signs: 0 = Red Octagon STOP, 1 = Circular Speed Limit, 2 = Crosswalk, 3 = Highway Sign.
 */
export function buildRealisticTrafficSign(
  variant: number,
  isNight: boolean,
  sharedMats?: CompiledPropMats,
): BuiltPropModel {
  const mats = sharedMats ?? createPropPbrMaterials(isNight);
  const pb = new PropMeshAssembler();

  pb.addCylinder(0.045, 0.055, 2.75, 8, 0, 1.38, 0, 0x94a3b8, 'glossy');
  pb.addCylinder(0.14, 0.16, 0.14, 10, 0, 0.07, 0, 0x475569, 'solid');

  if (variant === 0) {
    // True octagonal red STOP plate
    pb.addCylinder(0.42, 0.42, 0.045, 8, 0, 2.45, 0.06, 0xffffff, 'glossy', Math.PI / 2, Math.PI / 8, 0);
    pb.addCylinder(0.38, 0.38, 0.05, 8, 0, 2.45, 0.065, 0xdc2626, 'solid', Math.PI / 2, Math.PI / 8, 0);
    pb.addBox(0, 2.45, 0.095, 0.44, 0.12, 0.02, 0xffffff, 'emissive');
  } else if (variant === 1) {
    // True circular speed sign
    pb.addCylinder(0.38, 0.38, 0.045, 18, 0, 2.45, 0.06, 0xef4444, 'glossy', Math.PI / 2);
    pb.addCylinder(0.28, 0.28, 0.05, 18, 0, 2.45, 0.065, 0xf8fafc, 'solid', Math.PI / 2);
    pb.addBox(0, 2.45, 0.095, 0.24, 0.18, 0.02, 0x0f172a, 'solid');
  } else if (variant === 2) {
    pb.addBox(0, 2.45, 0.06, 0.72, 0.72, 0.045, 0xffffff, 'glossy');
    pb.addBox(0, 2.45, 0.07, 0.62, 0.62, 0.045, 0x2563eb, 'solid');
    pb.addCylinder(0.02, 0.22, 0.38, 3, 0, 2.43, 0.098, 0xf8fafc, 'emissive', Math.PI / 2);
  } else {
    pb.addBox(0, 2.45, 0.06, 1.15, 0.58, 0.045, 0xffffff, 'glossy');
    pb.addBox(0, 2.45, 0.07, 1.05, 0.48, 0.045, 0x15803d, 'solid');
    pb.addBox(0, 2.52, 0.098, 0.65, 0.12, 0.02, 0xfacc15, 'emissive');
  }

  const built = pb.compile(mats, { castShadow: false, receiveShadow: true });
  if (!sharedMats) built.materials.push(...mats.all);
  return built;
}

/**
 * Cast-iron & curved hardwood slatted park bench.
 */
export function buildRealisticBench(
  isNight: boolean,
  sharedMats?: CompiledPropMats,
): BuiltPropModel {
  const mats = sharedMats ?? createPropPbrMaterials(isNight);
  const pb = new PropMeshAssembler();
  const iron = 0x1e293b;
  const wood = 0xb45309;
  const woodLight = 0xd97706;

  [-0.95, 0.95].forEach((lx) => {
    pb.addCylinder(0.04, 0.05, 0.46, 8, lx, 0.23, -0.22, iron, 'glossy');
    pb.addCylinder(0.04, 0.05, 0.46, 8, lx, 0.23, 0.22, iron, 'glossy');
    pb.addCylinder(0.035, 0.035, 0.58, 8, lx, 0.46, 0, iron, 'glossy', Math.PI / 2);
    pb.addCylinder(0.035, 0.04, 0.56, 8, lx, 0.72, -0.24, iron, 'glossy', -0.14);
    pb.addCylinder(0.035, 0.035, 0.52, 8, lx, 0.66, 0.02, iron, 'glossy', Math.PI / 2);
  });

  [-0.17, 0, 0.17].forEach((sz, i) => {
    pb.addBox(0, 0.5, sz, 2.18, 0.06, 0.12, i % 2 === 0 ? wood : woodLight, 'solid');
  });
  [0.72, 0.88, 1.04].forEach((by, i) => {
    pb.addBox(0, by, -0.24, 2.18, 0.1, 0.055, i % 2 === 0 ? woodLight : wood, 'solid', -0.14);
  });

  const built = pb.compile(mats, { castShadow: false, receiveShadow: true });
  if (!sharedMats) built.materials.push(...mats.all);
  return built;
}

/**
 * Domed cylindrical park & street recycling bin.
 */
export function buildRealisticDustbin(
  isNight: boolean,
  sharedMats?: CompiledPropMats,
): BuiltPropModel {
  const mats = sharedMats ?? createPropPbrMaterials(isNight);
  const pb = new PropMeshAssembler();

  pb.addCylinder(0.32, 0.34, 0.12, 12, 0, 0.06, 0, 0x334155, 'glossy');
  pb.addCylinder(0.27, 0.25, 0.78, 14, 0, 0.5, 0, 0x16a34a, 'glossy');
  pb.addCylinder(0.28, 0.28, 0.08, 14, 0, 0.88, 0, 0xfacc15, 'glossy');
  pb.addSphere(0.27, 1, 0.68, 1, 0, 0.92, 0, 0x0f172a, 'glossy', 1);
  pb.addBox(0, 0.94, 0.24, 0.28, 0.09, 0.06, 0x38bdf8, 'emissive');

  const built = pb.compile(mats, { castShadow: false, receiveShadow: true });
  if (!sharedMats) built.materials.push(...mats.all);
  return built;
}

/**
 * Street Decor: 0 = Cast-Iron Fire Hydrant, 1 = Sculpted Floral Planter, 2 = Digital Vending Kiosk.
 */
export function buildRealisticStreetDecor(
  variant: number,
  isNight: boolean,
  sharedMats?: CompiledPropMats,
): BuiltPropModel {
  const mats = sharedMats ?? createPropPbrMaterials(isNight);
  const pb = new PropMeshAssembler();

  if (variant === 0) {
    pb.addCylinder(0.22, 0.25, 0.18, 12, 0, 0.09, 0, 0x991b1b, 'glossy');
    pb.addCylinder(0.15, 0.17, 0.56, 12, 0, 0.44, 0, 0xef4444, 'glossy');
    pb.addCylinder(0.06, 0.06, 0.48, 10, 0, 0.52, 0, 0xcbd5e1, 'glossy', 0, 0, Math.PI / 2);
    pb.addSphere(0.17, 1, 0.75, 1, 0, 0.74, 0, 0xfef08a, 'glossy', 1);
    pb.addCylinder(0.05, 0.06, 0.12, 8, 0, 0.9, 0, 0xcbd5e1, 'glossy');
  } else if (variant === 1) {
    pb.addCylinder(0.76, 0.66, 0.54, 14, 0, 0.27, 0, 0x94a3b8, 'solid');
    pb.addCylinder(0.68, 0.68, 0.08, 14, 0, 0.54, 0, 0x5c4033, 'solid');
    const petalCols = [0xf43f5e, 0xfacc15, 0xec4899, 0xa855f7, 0xf97316];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fx = Math.cos(a) * 0.38;
      const fz = Math.sin(a) * 0.38;
      pb.addSphere(0.16, 1, 0.75, 1, fx, 0.62, fz, 0x22c55e, 'solid', 1);
      pb.addSphere(0.1, 1, 0.7, 1, fx, 0.74, fz, petalCols[i % petalCols.length], 'solid', 1);
    }
    pb.addSphere(0.18, 1, 0.85, 1, 0, 0.66, 0, 0x16a34a, 'solid', 1);
    pb.addSphere(0.11, 1, 0.75, 1, 0, 0.82, 0, 0xfacc15, 'solid', 1);
  } else {
    pb.addBox(0, 1.05, 0, 1.24, 2.08, 0.86, 0x1e293b, 'glossy');
    pb.addCylinder(0.64, 0.64, 0.24, 14, 0, 2.12, 0, 0x0284c7, 'glossy');
    pb.addBox(0, 1.25, 0.44, 0.9, 1.15, 0.04, 0x38bdf8, 'emissive');
  }

  const built = pb.compile(mats, { castShadow: false, receiveShadow: true });
  if (!sharedMats) built.materials.push(...mats.all);
  return built;
}

/**
 * Ornate wrought-iron or industrial guardrail fence segment.
 */
export function buildRealisticFenceSegment(
  length: number,
  style: 'park' | 'industrial',
  isNight: boolean,
  sharedMats?: CompiledPropMats,
): BuiltPropModel {
  const mats = sharedMats ?? createPropPbrMaterials(isNight);
  const pb = new PropMeshAssembler();
  const postCol = style === 'park' ? 0x1e293b : 0x475569;
  const railCol = style === 'park' ? 0x334155 : 0x94a3b8;
  const baseCol = style === 'park' ? 0x64748b : 0xd97706;

  pb.addBox(0, 0.12, 0, length, 0.24, 0.26, baseCol, 'solid');
  const posts = Math.max(2, Math.round(length / 2) + 1);
  for (let i = 0; i < posts; i++) {
    const px = -length * 0.5 + (i / (posts - 1)) * length;
    pb.addCylinder(0.075, 0.09, 1.22, 8, px, 0.78, 0, postCol, 'glossy');
    if (style === 'park') {
      pb.addSphere(0.1, 1, 0.85, 1, px, 1.44, 0, 0xfacc15, 'glossy', 1);
    }
  }
  pb.addCylinder(0.038, 0.038, length, 8, 0, 0.55, 0, railCol, 'glossy', 0, 0, Math.PI / 2);
  pb.addCylinder(0.038, 0.038, length, 8, 0, 1.18, 0, railCol, 'glossy', 0, 0, Math.PI / 2);

  const picketCount = Math.max(6, Math.round(length * 2.2));
  for (let p = 1; p < picketCount; p++) {
    const px = -length * 0.5 + (p / picketCount) * length;
    pb.addCylinder(0.022, 0.022, 0.62, 6, px, 0.86, 0, railCol, 'glossy');
  }

  const built = pb.compile(mats, { castShadow: false, receiveShadow: true });
  if (!sharedMats) built.materials.push(...mats.all);
  return built;
}

/**
 * Sleek beveled PBR parked vehicles (0 = Coupe, 1 = Taxi, 2 = Van, 3 = Truck, 4 = City Bus).
 */
export function buildRealisticParkedVehicle(
  variant: number,
  isNight: boolean,
  sharedMats?: CompiledPropMats,
): { built: BuiltPropModel; w: number; h: number; d: number } {
  const mats = sharedMats ?? createPropPbrMaterials(isNight);
  const pb = new PropMeshAssembler();

  const tireCol = 0x111827;
  const rimCol = 0xe2e8f0;
  const glassCol = 0x38bdf8;
  const headCol = 0xfef9c3;
  const tailCol = 0xef4444;

  const isBus = variant === 4;
  const isTruck = variant === 3;
  const isVan = variant === 2;

  const bodyCol =
    variant === 0
      ? 0xef4444
      : variant === 1
        ? 0xfacc15
        : variant === 2
          ? 0x2563eb
          : variant === 3
            ? 0xf8fafc
            : 0x10b981;

  const w = isBus ? 2.55 : isTruck ? 2.4 : 2.02;
  const d = isBus ? 8.2 : isTruck ? 6.2 : isVan ? 4.8 : 4.4;
  const h = isBus ? 3.05 : isTruck ? 2.85 : isVan ? 2.05 : 1.55;

  // Cylindrical rubber tires & alloy wheel hubs
  const wheelZs = isBus ? [-2.6, 0.6, 2.7] : isTruck ? [-1.9, 1.9] : [-1.35, 1.35];
  wheelZs.forEach((wz) => {
    [-w * 0.48, w * 0.48].forEach((wx) => {
      pb.addCylinder(0.36, 0.36, 0.28, 14, wx, 0.36, wz, tireCol, 'solid', 0, 0, Math.PI / 2);
      pb.addCylinder(0.2, 0.2, 0.3, 12, wx, 0.36, wz, rimCol, 'glossy', 0, 0, Math.PI / 2);
    });
  });

  // Tapered beveled lower chassis via ExtrudeGeometry silhouette
  const profile = new THREE.Shape();
  const hd = d * 0.5;
  if (isBus) {
    profile.moveTo(-hd, 0.38);
    profile.lineTo(hd - 0.15, 0.38);
    profile.quadraticCurveTo(hd, 0.45, hd, 0.8);
    profile.lineTo(hd - 0.1, 2.7);
    profile.quadraticCurveTo(hd - 0.2, 2.85, hd - 0.45, 2.85);
    profile.lineTo(-hd + 0.25, 2.85);
    profile.lineTo(-hd, 2.65);
    profile.closePath();
  } else if (isTruck) {
    profile.moveTo(-hd, 0.4);
    profile.lineTo(hd, 0.4);
    profile.lineTo(hd, 1.35);
    profile.lineTo(hd - 0.35, 2.3);
    profile.lineTo(hd - 1.75, 2.3);
    profile.lineTo(hd - 1.8, 0.82);
    profile.lineTo(-hd, 0.82);
    profile.closePath();
  } else {
    const cabH = isVan ? 1.98 : 1.54;
    const hoodZ = isVan ? hd - 0.9 : hd - 1.25;
    profile.moveTo(-hd, 0.38);
    profile.lineTo(hd, 0.38);
    profile.lineTo(hd, 0.92);
    profile.lineTo(hoodZ, 1.06);
    profile.lineTo(hoodZ - 0.55, cabH);
    profile.lineTo(-hd + 0.55, cabH);
    profile.lineTo(-hd + 0.08, 1.02);
    profile.lineTo(-hd, 0.85);
    profile.closePath();
  }

  const bodyGeo = new THREE.ExtrudeGeometry(profile, {
    depth: w - 0.16,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  bodyGeo.translate(0, 0, -(w - 0.16) * 0.5);
  bodyGeo.rotateY(-Math.PI / 2);
  pb.addGeo(bodyGeo, bodyCol, 'glossy');

  if (isBus) {
    pb.addBox(0, 1.95, 0.1, w + 0.02, 0.88, d - 0.8, glassCol, 'glass');
    pb.addBox(0, 2.52, d * 0.505, 1.55, 0.24, 0.06, 0xfacc15, 'emissive');
  } else if (isTruck) {
    pb.addBox(0, 1.78, d * 0.34, w - 0.18, 0.58, 0.88, glassCol, 'glass');
    pb.addBox(0, 1.92, -d * 0.16, w, 1.85, d * 0.64, 0xf8fafc, 'solid');
  } else {
    const cabLen = isVan ? d * 0.62 : d * 0.46;
    const cabZ = isVan ? -0.15 : -0.28;
    pb.addBox(0, isVan ? 1.48 : 1.26, cabZ, w * 0.88, 0.44, cabLen, glassCol, 'glass');
    if (variant === 1) {
      pb.addBox(0, 1.68, cabZ + 0.1, 0.65, 0.18, 0.26, 0xfef08a, 'emissive');
    }
  }

  [-w * 0.34, w * 0.34].forEach((lx) => {
    pb.addSphere(0.14, 1.3, 0.7, 0.4, lx, 0.78, d * 0.51, headCol, 'emissive', 0);
    pb.addSphere(0.14, 1.3, 0.7, 0.4, lx, 0.78, -d * 0.51, tailCol, 'emissive', 0);
  });

  const built = pb.compile(mats, { castShadow: !isNight, receiveShadow: true });
  if (!sharedMats) built.materials.push(...mats.all);
  return { built, w, h, d };
}

/**
 * Organic Branching Tree with tapered trunk, limbs & sculpted multi-lobe foliage canopy.
 * 0 = Deciduous Green, 1 = Sakura Cherry Blossom, 2 = Alpine Pine.
 */
export function buildRealisticTree(
  variant: number,
  isNight: boolean,
  sharedMats?: CompiledPropMats,
): BuiltPropModel {
  const mats = sharedMats ?? createPropPbrMaterials(isNight);
  const pb = new PropMeshAssembler();
  const trunkCol = variant === 1 ? 0x5c3a2e : 0x6b4423;

  // Tapered main trunk & flared roots
  pb.addCylinder(0.15, 0.3, 3.3, 8, 0, 1.65, 0, trunkCol, 'solid');
  pb.addCylinder(0.28, 0.42, 0.5, 8, 0, 0.25, 0, trunkCol, 'solid');
  // Primary branches
  [0.2, 2.3, 4.4].forEach((ang, i) => {
    pb.addCylinder(
      0.06,
      0.12,
      1.6,
      6,
      Math.cos(ang) * 0.45,
      2.4 + i * 0.2,
      Math.sin(ang) * 0.45,
      trunkCol,
      'solid',
      Math.sin(ang) * 0.55,
      0,
      -Math.cos(ang) * 0.55,
    );
  });

  if (variant === 2) {
    // Organic sculpted pine bough whorls (displaced icosahedra, never crude cones or boxes)
    const tiers = [
      { y: 2.8, r: 1.75, sy: 0.62, col: 0x14532d },
      { y: 3.9, r: 1.42, sy: 0.64, col: 0x166534 },
      { y: 4.95, r: 1.05, sy: 0.68, col: 0x15803d },
      { y: 5.85, r: 0.65, sy: 0.78, col: 0x22c55e },
    ];
    tiers.forEach((t) => {
      pb.addSphere(t.r, 1, t.sy, 1, 0, t.y, 0, t.col, 'solid', 1);
    });
  } else {
    const cols =
      variant === 1
        ? [0xf472b6, 0xe879f9, 0xf9a8d4, 0xc084fc]
        : [0x2f8f3d, 0x4ca142, 0x227232, 0x67a83c];
    pb.addSphere(1.65, 1.08, 0.85, 1.05, 0, 4.4, 0, cols[0], 'solid', 1);
    pb.addSphere(1.25, 1.0, 0.82, 1.0, 1.05, 3.85, 0.55, cols[1], 'solid', 1);
    pb.addSphere(1.2, 1.0, 0.84, 1.0, -1.0, 3.95, -0.5, cols[2], 'solid', 1);
    pb.addSphere(1.12, 1.0, 0.82, 1.0, 0.2, 4.05, -0.95, cols[3], 'solid', 1);
    pb.addSphere(1.1, 1.0, 0.85, 1.0, -0.25, 5.15, 0.42, cols[1], 'solid', 1);
  }

  const built = pb.compile(mats, { castShadow: !isNight, receiveShadow: true });
  if (!sharedMats) built.materials.push(...mats.all);
  return built;
}

/**
 * Place crisp Road Markings (zebra crosswalks, stop bars, turn arrows, dashed lane lines)
 * elevated safely above road surfaces to avoid z-fighting.
 */
export function addRoadMarkingsBatch(
  parent: THREE.Group,
  markings: Array<
    | { kind: 'crosswalk'; x: number; z: number; rotY?: number; width?: number; stripes?: number }
    | { kind: 'dash_line'; x1: number; z1: number; x2: number; z2: number; color?: number }
    | { kind: 'turn_arrow'; x: number; z: number; rotY: number }
    | { kind: 'parking_bays'; x: number; z: number; count: number; rotY?: number }
  >,
  groundHeightAt: (x: number, z: number, y?: number) => number,
  geometriesToDispose: THREE.BufferGeometry[],
  materialsToDispose: THREE.Material[],
): void {
  const whiteGeo = new THREE.BoxGeometry(1, 0.024, 1);
  geometriesToDispose.push(whiteGeo);
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    depthWrite: false,
  });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    depthWrite: false,
  });
  materialsToDispose.push(whiteMat, yellowMat);

  const whiteMatrices: THREE.Matrix4[] = [];
  const yellowMatrices: THREE.Matrix4[] = [];
  const mat4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const euler = new THREE.Euler();

  const pushBox = (x: number, z: number, w: number, d: number, rotY: number, isYellow = false) => {
    const gy = groundHeightAt(x, z, 0) + 0.056;
    pos.set(x, gy, z);
    euler.set(0, rotY, 0);
    quat.setFromEuler(euler);
    scl.set(w, 1, d);
    mat4.compose(pos, quat, scl);
    (isYellow ? yellowMatrices : whiteMatrices).push(mat4.clone());
  };

  for (const m of markings) {
    if (m.kind === 'crosswalk') {
      const rotY = m.rotY ?? 0;
      const stripes = m.stripes ?? 6;
      const width = m.width ?? 6.2;
      const cos = Math.cos(rotY);
      const sin = Math.sin(rotY);
      for (let i = 0; i < stripes; i++) {
        const u = -width * 0.5 + ((i + 0.5) / stripes) * width;
        pushBox(m.x + u * cos, m.z - u * sin, 0.55, 2.8, rotY, false);
      }
      pushBox(m.x - 2.3 * sin, m.z - 2.3 * cos, width, 0.38, rotY, false);
    } else if (m.kind === 'dash_line') {
      const dx = m.x2 - m.x1;
      const dz = m.z2 - m.z1;
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const rotY = Math.atan2(dx, dz);
      const steps = Math.max(1, Math.floor(len / 4.2));
      const isYellow = m.color === 0xfacc15;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        pushBox(m.x1 + dx * t, m.z1 + dz * t, 0.24, 1.85, rotY, isYellow);
      }
    } else if (m.kind === 'turn_arrow') {
      const cos = Math.cos(m.rotY);
      const sin = Math.sin(m.rotY);
      pushBox(m.x, m.z, 0.35, 2.1, m.rotY, false);
      pushBox(m.x + sin * 0.95, m.z + cos * 0.95, 1.05, 0.45, m.rotY, false);
    } else if (m.kind === 'parking_bays') {
      const rotY = m.rotY ?? 0;
      const cos = Math.cos(rotY);
      const sin = Math.sin(rotY);
      for (let i = 0; i <= m.count; i++) {
        const u = (i - m.count * 0.5) * 3.1;
        pushBox(m.x + u * cos, m.z - u * sin, 0.18, 4.6, rotY, false);
      }
    }
  }

  const commit = (mats: THREE.Matrix4[], mat: THREE.Material) => {
    if (mats.length === 0) return;
    const im = new THREE.InstancedMesh(whiteGeo, mat, mats.length);
    for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
    im.instanceMatrix.needsUpdate = true;
    im.receiveShadow = true;
    parent.add(im);
  };
  commit(whiteMatrices, whiteMat);
  commit(yellowMatrices, yellowMat);
}

/**
 * Scatter realistic PBR urban props across a map in optimized instanced batches.
 */
export function populateUrbanProps(
  cfg: UrbanPropsBatchConfig,
  spec: {
    streetlights?: UrbanPropInstance[];
    trafficSigns?: UrbanPropInstance[];
    benches?: UrbanPropInstance[];
    dustbins?: UrbanPropInstance[];
    decor?: UrbanPropInstance[];
    fences?: Array<{ x: number; z: number; length: number; rotY: number; style: 'park' | 'industrial'; collider?: boolean }>;
    parkedVehicles?: UrbanPropInstance[];
    trees?: UrbanPropInstance[];
    gantries?: Array<{ x: number; z: number; rotY: number; width?: number }>;
  },
): void {
  const {
    sceneParent,
    groundHeightAt,
    addCollider,
    shootableEnv,
    isNight,
    geometriesToDispose,
    materialsToDispose,
    displays,
  } = cfg;

  const toTransforms = (list?: UrbanPropInstance[], defaultScale = 1) =>
    (list ?? []).map((p) => ({
      x: p.x,
      y: groundHeightAt(p.x, p.z, 0),
      z: p.z,
      rotY: p.rotY ?? 0,
      scale: p.scale ?? defaultScale,
    }));

  const sharedPropMats = createPropPbrMaterials(isNight);
  materialsToDispose.push(...sharedPropMats.all);

  // 1. Streetlights (single + double)
  if (spec.streetlights?.length) {
    const single = spec.streetlights.filter((s) => (s.variant ?? 0) === 0);
    const dbl = spec.streetlights.filter((s) => (s.variant ?? 0) === 1);
    if (single.length) {
      createInstancedFromProp(buildRealisticStreetlight(isNight, false, sharedPropMats), toTransforms(single), sceneParent, geometriesToDispose, materialsToDispose);
    }
    if (dbl.length) {
      createInstancedFromProp(buildRealisticStreetlight(isNight, true, sharedPropMats), toTransforms(dbl), sceneParent, geometriesToDispose, materialsToDispose);
    }
    spec.streetlights.forEach((s) => addCollider(s.x, groundHeightAt(s.x, s.z), s.z, 0.45, 4.5, 0.45, 0, 'metal'));
  }

  // 2. Traffic Signs (variants 0..3)
  if (spec.trafficSigns?.length) {
    for (let v = 0; v < 4; v++) {
      const sub = spec.trafficSigns.filter((t) => (t.variant ?? v) % 4 === v);
      if (sub.length) {
        createInstancedFromProp(buildRealisticTrafficSign(v, isNight, sharedPropMats), toTransforms(sub), sceneParent, geometriesToDispose, materialsToDispose);
      }
    }
  }

  // 3. Benches & Dustbins
  if (spec.benches?.length) {
    createInstancedFromProp(buildRealisticBench(isNight, sharedPropMats), toTransforms(spec.benches), sceneParent, geometriesToDispose, materialsToDispose, shootableEnv);
    spec.benches.forEach((b) => addCollider(b.x, groundHeightAt(b.x, b.z), b.z, 2.1, 1.0, 0.75, b.rotY ?? 0, 'wood'));
  }
  if (spec.dustbins?.length) {
    createInstancedFromProp(buildRealisticDustbin(isNight, sharedPropMats), toTransforms(spec.dustbins), sceneParent, geometriesToDispose, materialsToDispose, shootableEnv);
    spec.dustbins.forEach((d) => addCollider(d.x, groundHeightAt(d.x, d.z), d.z, 0.65, 1.15, 0.65, d.rotY ?? 0, 'metal'));
  }

  // 4. Street Decorations (hydrants, flower planters, glowing kiosks)
  if (spec.decor?.length) {
    for (let v = 0; v < 3; v++) {
      const sub = spec.decor.filter((d) => (d.variant ?? 0) % 3 === v);
      if (sub.length) {
        createInstancedFromProp(buildRealisticStreetDecor(v, isNight, sharedPropMats), toTransforms(sub), sceneParent, geometriesToDispose, materialsToDispose, shootableEnv);
        sub.forEach((d) => {
          const w = v === 1 ? 1.65 : v === 2 ? 1.25 : 0.45;
          const h = v === 2 ? 2.1 : 0.95;
          addCollider(d.x, groundHeightAt(d.x, d.z), d.z, w, h, 0.9, d.rotY ?? 0, v === 1 ? 'concrete' : 'metal');
        });
      }
    }
  }

  // 5. Fences
  if (spec.fences?.length) {
    for (const f of spec.fences) {
      const built = buildRealisticFenceSegment(f.length, f.style, isNight, sharedPropMats);
      const gy = groundHeightAt(f.x, f.z, 0);
      built.group.position.set(f.x, gy, f.z);
      built.group.rotation.y = f.rotY;
      sceneParent.add(built.group);
      shootableEnv.push(built.group);
      geometriesToDispose.push(...built.geometries);
      materialsToDispose.push(...built.materials);
      if (f.collider !== false) {
        addCollider(f.x, gy, f.z, f.length, 1.45, 0.35, f.rotY, 'metal');
      }
    }
  }

  // 6. Parked Vehicles (5 beveled PBR vehicle presets)
  if (spec.parkedVehicles?.length) {
    for (let v = 0; v < 5; v++) {
      const sub = spec.parkedVehicles.filter((pv, idx) => (pv.variant ?? idx) % 5 === v);
      if (sub.length) {
        const { built, w, h, d } = buildRealisticParkedVehicle(v, isNight, sharedPropMats);
        createInstancedFromProp(built, toTransforms(sub), sceneParent, geometriesToDispose, materialsToDispose, shootableEnv);
        sub.forEach((pv) => {
          const gy = groundHeightAt(pv.x, pv.z, 0);
          addCollider(pv.x, gy, pv.z, w, h, d, pv.rotY ?? 0, 'metal');
        });
      }
    }
  }

  // 7. Organic Trees (deciduous green, sakura blossom pink, alpine pine)
  if (spec.trees?.length) {
    for (let v = 0; v < 3; v++) {
      const sub = spec.trees.filter((tr, idx) => (tr.variant ?? idx) % 3 === v);
      if (sub.length) {
        createInstancedFromProp(buildRealisticTree(v, isNight, sharedPropMats), toTransforms(sub), sceneParent, geometriesToDispose, materialsToDispose, shootableEnv);
        sub.forEach((tr) => {
          const gy = groundHeightAt(tr.x, tr.z, 0);
          addCollider(tr.x, gy, tr.z, 0.72, 2.8, 0.72, 0, 'wood');
        });
      }
    }
  }

  // 8. Steel Truss Digital Traffic Gantries spanning roads
  if (spec.gantries?.length && displays) {
    for (const g of spec.gantries) {
      const span = g.width ?? 12.5;
      const gy = groundHeightAt(g.x, g.z, 0);
      const pb = new PropMeshAssembler();
      pb.addCylinder(0.2, 0.25, 6.4, 10, -span * 0.5, 3.2, 0, 0x334155, 'glossy');
      pb.addCylinder(0.2, 0.25, 6.4, 10, span * 0.5, 3.2, 0, 0x334155, 'glossy');
      pb.addCylinder(0.2, 0.2, span + 0.8, 10, 0, 6.1, 0, 0x475569, 'glossy', 0, 0, Math.PI / 2);
      pb.addBox(0, 5.4, 0, 6.4, 1.5, 0.35, 0x0f172a, 'glossy');
      const built = pb.compile(sharedPropMats, { castShadow: false, receiveShadow: true });
      built.group.position.set(g.x, gy, g.z);
      built.group.rotation.y = g.rotY;

      const { material } = displays.createDisplayMaterial('traffic_gantry');
      const screenGeo = new THREE.PlaneGeometry(5.8, 1.25);
      const sFront = new THREE.Mesh(screenGeo, material);
      sFront.position.set(0, 5.4, 0.2);
      const sBack = new THREE.Mesh(screenGeo, material);
      sBack.position.set(0, 5.4, -0.2);
      sBack.rotation.y = Math.PI;
      built.group.add(sFront, sBack);

      sceneParent.add(built.group);
      geometriesToDispose.push(...built.geometries, screenGeo);
      materialsToDispose.push(...built.materials, material);
    }
  }
}
