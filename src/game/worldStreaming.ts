import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GraphicsQuality } from '../types';

export interface OccluderVolume {
  id: string;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  cx: number;
  cy: number;
  cz: number;
  radius: number;
}

export interface TerrainChunkEntry {
  id: string;
  parent: THREE.Group;
  tileGroup: THREE.Group;
  mesh: THREE.Mesh;
  highGeo: THREE.BufferGeometry;
  lowGeo: THREE.BufferGeometry;
  box: THREE.Box3;
  cx: number;
  cz: number;
  halfDiag: number;
  loaded: boolean;
  usingLowLod: boolean;
  visible: boolean;
}

export interface PropChunkEntry {
  id: string;
  parent: THREE.Group;
  highGroup: THREE.Group;
  lowGroup: THREE.Group | null;
  box: THREE.Box3;
  cx: number;
  cy: number;
  cz: number;
  radius: number;
  lodDist: number;
  loadDist: number;
  unloadDist: number;
  loaded: boolean;
  usingLowLod: boolean;
  visible: boolean;
}

export interface DistrictLodEntry {
  id: string;
  parent: THREE.Group;
  group: THREE.Group;
  proxyGroup: THREE.Group | null;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxDist: number;
  unloadDist: number;
  proxyMaxDist: number;
  tier: 'district' | 'detail';
  box: THREE.Box3;
  loaded: boolean;
  proxyLoaded: boolean;
  visible: boolean;
}

export interface WorldStreamingStats {
  totalTerrainChunks: number;
  loadedTerrainChunks: number;
  visibleTerrainChunks: number;
  highLodTerrainChunks: number;
  lowLodTerrainChunks: number;
  totalPropChunks: number;
  loadedPropChunks: number;
  visiblePropChunks: number;
  lowLodPropChunks: number;
  totalDistricts: number;
  loadedDistricts: number;
  proxyActiveDistricts: number;
  frustumCulled: number;
  occludedCulled: number;
  activeOccluders: number;
}

// Module-scoped zero-allocation math scratch objects
const _camProjScreenMat = new THREE.Matrix4();
const _camFrustum = new THREE.Frustum();
const _tmpBox = new THREE.Box3();
const _tmpSphere = new THREE.Sphere();
const _activeOccluders: OccluderVolume[] = [];

function segmentIntersectsBox(
  ox: number,
  oy: number,
  oz: number,
  tx: number,
  ty: number,
  tz: number,
  occ: OccluderVolume,
): boolean {
  const dx = tx - ox;
  const dy = ty - oy;
  const dz = tz - oz;

  let tMin = 0;
  let tMax = 1;

  // X slab
  if (Math.abs(dx) < 1e-8) {
    if (ox < occ.minX || ox > occ.maxX) return false;
  } else {
    const inv = 1 / dx;
    let t1 = (occ.minX - ox) * inv;
    let t2 = (occ.maxX - ox) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }

  // Y slab
  if (Math.abs(dy) < 1e-8) {
    if (oy < occ.minY || oy > occ.maxY) return false;
  } else {
    const inv = 1 / dy;
    let t1 = (occ.minY - oy) * inv;
    let t2 = (occ.maxY - oy) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }

  // Z slab
  if (Math.abs(dz) < 1e-8) {
    if (oz < occ.minZ || oz > occ.maxZ) return false;
  } else {
    const inv = 1 / dz;
    let t1 = (occ.minZ - oz) * inv;
    let t2 = (occ.maxZ - oz) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }

  // Must enter strictly after camera origin and before reaching target corner
  return tMax >= tMin && tMin > 0.001 && tMin < 0.995;
}

export class WorldStreamingController {
  public readonly terrainChunks: TerrainChunkEntry[] = [];
  public readonly propChunks: PropChunkEntry[] = [];
  public readonly districts: DistrictLodEntry[] = [];
  public readonly occluders: OccluderVolume[] = [];

  private extraGeos: THREE.BufferGeometry[] = [];
  private extraMats: THREE.Material[] = [];

  private stats: WorldStreamingStats = {
    totalTerrainChunks: 0,
    loadedTerrainChunks: 0,
    visibleTerrainChunks: 0,
    highLodTerrainChunks: 0,
    lowLodTerrainChunks: 0,
    totalPropChunks: 0,
    loadedPropChunks: 0,
    visiblePropChunks: 0,
    lowLodPropChunks: 0,
    totalDistricts: 0,
    loadedDistricts: 0,
    proxyActiveDistricts: 0,
    frustumCulled: 0,
    occludedCulled: 0,
    activeOccluders: 0,
  };

  public trackGeometry(geo: THREE.BufferGeometry) {
    this.extraGeos.push(geo);
  }

  public trackMaterial(mat: THREE.Material) {
    this.extraMats.push(mat);
  }

  public registerOccluder(
    id: string,
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
  ): OccluderVolume {
    const x0 = Math.min(minX, maxX);
    const x1 = Math.max(minX, maxX);
    const y0 = Math.min(minY, maxY);
    const y1 = Math.max(minY, maxY);
    const z0 = Math.min(minZ, maxZ);
    const z1 = Math.max(minZ, maxZ);
    const cx = (x0 + x1) * 0.5;
    const cy = (y0 + y1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const radius = Math.hypot(x1 - cx, y1 - cy, z1 - cz);
    const occ: OccluderVolume = {
      id,
      minX: x0,
      minY: y0,
      minZ: z0,
      maxX: x1,
      maxY: y1,
      maxZ: z1,
      cx,
      cy,
      cz,
      radius,
    };
    this.occluders.push(occ);
    return occ;
  }

  public registerTerrainChunk(opts: {
    id: string;
    parent: THREE.Group;
    mesh: THREE.Mesh;
    highGeo: THREE.BufferGeometry;
    lowGeo: THREE.BufferGeometry;
    box: THREE.Box3;
  }): TerrainChunkEntry {
    const tileGroup = new THREE.Group();
    tileGroup.name = `terrain_chunk_${opts.id}`;
    tileGroup.add(opts.mesh);
    const cx = (opts.box.min.x + opts.box.max.x) * 0.5;
    const cz = (opts.box.min.z + opts.box.max.z) * 0.5;
    const halfDiag = Math.hypot(opts.box.max.x - cx, opts.box.max.z - cz);
    const entry: TerrainChunkEntry = {
      id: opts.id,
      parent: opts.parent,
      tileGroup,
      mesh: opts.mesh,
      highGeo: opts.highGeo,
      lowGeo: opts.lowGeo,
      box: opts.box,
      cx,
      cz,
      halfDiag,
      loaded: false,
      usingLowLod: false,
      visible: false,
    };
    this.terrainChunks.push(entry);
    return entry;
  }

  public registerPropChunk(opts: {
    id: string;
    parent: THREE.Group;
    highGroup: THREE.Group;
    lowGroup?: THREE.Group | null;
    box: THREE.Box3;
    lodDist?: number;
    loadDist?: number;
    unloadDist?: number;
  }): PropChunkEntry {
    const cx = (opts.box.min.x + opts.box.max.x) * 0.5;
    const cy = (opts.box.min.y + opts.box.max.y) * 0.5;
    const cz = (opts.box.min.z + opts.box.max.z) * 0.5;
    const radius = Math.hypot(opts.box.max.x - cx, opts.box.max.y - cy, opts.box.max.z - cz);
    if (opts.highGroup.parent === opts.parent) {
      opts.parent.remove(opts.highGroup);
    }
    if (opts.lowGroup && opts.lowGroup.parent === opts.parent) {
      opts.parent.remove(opts.lowGroup);
    }
    const entry: PropChunkEntry = {
      id: opts.id,
      parent: opts.parent,
      highGroup: opts.highGroup,
      lowGroup: opts.lowGroup ?? null,
      box: opts.box,
      cx,
      cy,
      cz,
      radius,
      lodDist: opts.lodDist ?? 185,
      loadDist: opts.loadDist ?? 380,
      unloadDist: opts.unloadDist ?? 455,
      loaded: false,
      usingLowLod: false,
      visible: false,
    };
    this.propChunks.push(entry);
    return entry;
  }

  public registerDistrictGroup(opts: {
    id: string;
    parent: THREE.Group;
    group: THREE.Group;
    proxyGroup?: THREE.Group | null;
    x: number;
    y?: number;
    z: number;
    radius?: number;
    maxDist: number;
    unloadDist?: number;
    proxyMaxDist?: number;
    tier?: 'district' | 'detail';
  }): DistrictLodEntry {
    const radius = opts.radius ?? Math.min(54, opts.maxDist * 0.65);
    const y = opts.y ?? 10;
    const tier = opts.tier ?? 'detail';
    const box = new THREE.Box3(
      new THREE.Vector3(opts.x - radius, Math.max(-4, y - radius * 0.4), opts.z - radius),
      new THREE.Vector3(opts.x + radius, y + radius * 0.65, opts.z + radius),
    );
    if (opts.group.parent === opts.parent) {
      opts.parent.remove(opts.group);
    }
    if (opts.proxyGroup && opts.proxyGroup.parent === opts.parent) {
      opts.parent.remove(opts.proxyGroup);
    }
    const entry: DistrictLodEntry = {
      id: opts.id,
      parent: opts.parent,
      group: opts.group,
      proxyGroup: opts.proxyGroup ?? null,
      x: opts.x,
      y,
      z: opts.z,
      radius,
      maxDist: opts.maxDist,
      unloadDist: opts.unloadDist ?? opts.maxDist + (tier === 'district' ? 45 : 22),
      proxyMaxDist: opts.proxyMaxDist ?? opts.maxDist + 560,
      tier,
      box,
      loaded: false,
      proxyLoaded: false,
      visible: false,
    };
    this.districts.push(entry);
    return entry;
  }

  /**
   * Partitions static children directly attached to `parent` into spatial cell chunks
   * so distant city blocks & props dynamically load/unload and cull individually.
   */
  public partitionStaticChildren(
    parent: THREE.Group,
    opts?: {
      idPrefix?: string;
      cellSize?: number;
      maxObjectSpan?: number;
      loadDist?: number;
      unloadDist?: number;
    },
  ): number {
    const cellSize = opts?.cellSize ?? 190;
    const maxSpan = opts?.maxObjectSpan ?? 135;
    const prefix = opts?.idPrefix ?? 'prop';
    const loadDist = opts?.loadDist ?? 390;
    const unloadDist = opts?.unloadDist ?? 465;

    parent.updateMatrixWorld(true);
    const buckets = new Map<string, { items: THREE.Object3D[]; box: THREE.Box3 }>();
    const snapshot = parent.children.slice();

    for (let i = 0; i < snapshot.length; i++) {
      const child = snapshot[i];
      if (child.userData?.keepInArenaRoot) continue;
      _tmpBox.setFromObject(child);
      if (_tmpBox.isEmpty()) continue;
      const spanX = _tmpBox.max.x - _tmpBox.min.x;
      const spanZ = _tmpBox.max.z - _tmpBox.min.z;
      if (spanX > maxSpan || spanZ > maxSpan) continue;

      const cx = (_tmpBox.min.x + _tmpBox.max.x) * 0.5;
      const cz = (_tmpBox.min.z + _tmpBox.max.z) * 0.5;
      const cellX = Math.floor(cx / cellSize);
      const cellZ = Math.floor(cz / cellSize);
      const key = `${prefix}_${cellX}_${cellZ}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { items: [], box: _tmpBox.clone() };
        buckets.set(key, bucket);
      } else {
        bucket.box.union(_tmpBox);
      }
      bucket.items.push(child);
    }

    let created = 0;
    for (const [key, bucket] of buckets.entries()) {
      const chunkGroup = new THREE.Group();
      chunkGroup.name = `chunk_${key}`;
      for (let i = 0; i < bucket.items.length; i++) {
        chunkGroup.add(bucket.items[i]);
      }
      this.registerPropChunk({
        id: key,
        parent,
        highGroup: chunkGroup,
        lowGroup: null,
        box: bucket.box,
        loadDist,
        unloadDist,
      });
      created++;
    }
    return created;
  }

  /**
   * Merges static opaque non-interactive meshes by material inside each partitioned chunk
   * to dramatically cut WebGL draw calls on Low/Medium quality without touching High quality.
   */
  public optimizeStaticChunks(shootableEnv?: THREE.Object3D[]): number {
    const shootableSet = new Set<THREE.Object3D>(shootableEnv ?? []);
    let mergedDrawCallsSaved = 0;

    for (let i = 0; i < this.propChunks.length; i++) {
      const pc = this.propChunks[i];
      // Skip flora chunks (already InstancedMeshes with low-poly LOD)
      if (pc.lowGroup) continue;
      const root = pc.highGroup;
      root.updateMatrixWorld(true);

      const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const buckets = new Map<
        THREE.Material,
        Array<{ mesh: THREE.Mesh; wasShootable: boolean; castShadow: boolean; receiveShadow: boolean }>
      >();

      const isBlockedBranch = (obj: THREE.Object3D): boolean => {
        let cur: THREE.Object3D | null = obj;
        while (cur && cur !== root) {
          const ud = cur.userData;
          if (ud?.isDigitalScreen || ud?.isBreakableBuildingGlass || ud?.noBatch || ud?.keepInArenaRoot) {
            return true;
          }
          cur = cur.parent;
        }
        return false;
      };

      const isShootableBranch = (obj: THREE.Object3D): boolean => {
        let cur: THREE.Object3D | null = obj;
        while (cur) {
          if (shootableSet.has(cur)) return true;
          if (cur === root) break;
          cur = cur.parent;
        }
        return false;
      };

      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || obj instanceof THREE.InstancedMesh) return;
        if (!obj.geometry || Array.isArray(obj.material) || !obj.material) return;
        const mat = obj.material;
        if (mat.transparent || mat.opacity < 0.99) return;
        if (
          mat instanceof THREE.ShaderMaterial ||
          mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ||
          Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey')
        ) {
          return;
        }
        if (isBlockedBranch(obj)) return;

        let list = buckets.get(obj.material);
        if (!list) {
          list = [];
          buckets.set(obj.material, list);
        }
        list.push({
          mesh: obj,
          wasShootable: isShootableBranch(obj),
          castShadow: obj.castShadow,
          receiveShadow: obj.receiveShadow,
        });
      });

      const relMat = new THREE.Matrix4();
      buckets.forEach((items, mat) => {
        if (items.length < 2) return;
        const allHaveColor = items.every((it) => Boolean(it.mesh.geometry.attributes.color));
        const bakedGeos: THREE.BufferGeometry[] = [];
        let anyShootable = false;
        let anyCastShadow = false;
        let anyReceiveShadow = false;

        for (let k = 0; k < items.length; k++) {
          const it = items[k];
          if (it.wasShootable) anyShootable = true;
          if (it.castShadow) anyCastShadow = true;
          if (it.receiveShadow) anyReceiveShadow = true;

          const src = it.mesh.geometry;
          const nonIdx = src.index ? src.toNonIndexed() : src.clone();
          if (!nonIdx.attributes.normal) {
            nonIdx.computeVertexNormals();
          }
          const posCount = nonIdx.attributes.position.count;
          if (!nonIdx.attributes.uv) {
            nonIdx.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(posCount * 2), 2));
          }
          // Strip non-uniform extra attributes so mergeGeometries succeeds cleanly
          for (const attrName of Object.keys(nonIdx.attributes)) {
            if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv' && !(allHaveColor && attrName === 'color')) {
              nonIdx.deleteAttribute(attrName);
            }
          }
          relMat.multiplyMatrices(invRoot, it.mesh.matrixWorld);
          nonIdx.applyMatrix4(relMat);
          bakedGeos.push(nonIdx);
        }

        const merged = mergeGeometries(bakedGeos, false);
        for (let g = 0; g < bakedGeos.length; g++) bakedGeos[g].dispose();
        if (!merged) return;

        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        this.extraGeos.push(merged);

        const mergedMesh = new THREE.Mesh(merged, mat);
        mergedMesh.name = `batched_${pc.id}`;
        mergedMesh.castShadow = anyCastShadow;
        mergedMesh.receiveShadow = anyReceiveShadow;
        root.add(mergedMesh);
        if (anyShootable && shootableEnv) {
          shootableEnv.push(mergedMesh);
        }

        for (let k = 0; k < items.length; k++) {
          items[k].mesh.parent?.remove(items[k].mesh);
        }
        mergedDrawCallsSaved += items.length - 1;
      });
    }
    return mergedDrawCallsSaved;
  }

  private refreshActiveOccluders(camX: number, camY: number, camZ: number) {
    _activeOccluders.length = 0;
    // Skip occlusion culling from high aerial altitudes (helicopter / elevated vistas)
    if (camY > 38) return;

    for (let i = 0; i < this.occluders.length; i++) {
      const occ = this.occluders[i];
      // Never use an occluder if the camera is inside or hugging its walls
      if (
        camX >= occ.minX - 2.6 &&
        camX <= occ.maxX + 2.6 &&
        camY >= occ.minY - 2.0 &&
        camY <= occ.maxY + 2.6 &&
        camZ >= occ.minZ - 2.6 &&
        camZ <= occ.maxZ + 2.6
      ) {
        continue;
      }
      const dx = occ.cx - camX;
      const dy = occ.cy - camY;
      const dz = occ.cz - camZ;
      const maxRange = 280 + occ.radius;
      if (dx * dx + dy * dy + dz * dz > maxRange * maxRange) continue;

      _tmpSphere.center.set(occ.cx, occ.cy, occ.cz);
      _tmpSphere.radius = occ.radius;
      if (!_camFrustum.intersectsSphere(_tmpSphere)) continue;

      _activeOccluders.push(occ);
    }

    if (_activeOccluders.length > 8) {
      _activeOccluders.sort((a, b) => {
        const da = (a.cx - camX) * (a.cx - camX) + (a.cz - camZ) * (a.cz - camZ);
        const db = (b.cx - camX) * (b.cx - camX) + (b.cz - camZ) * (b.cz - camZ);
        return da - db;
      });
      _activeOccluders.length = 8;
    }
  }

  public isBoxOccluded(camX: number, camY: number, camZ: number, box: THREE.Box3): boolean {
    if (_activeOccluders.length === 0) return false;
    const x0 = box.min.x;
    const y0 = box.min.y;
    const z0 = box.min.z;
    const x1 = box.max.x;
    const y1 = box.max.y;
    const z1 = box.max.z;
    const tcx = (x0 + x1) * 0.5;
    const tcy = (y0 + y1) * 0.5;
    const tcz = (z0 + z1) * 0.5;

    for (let i = 0; i < _activeOccluders.length; i++) {
      const occ = _activeOccluders[i];
      if (!segmentIntersectsBox(camX, camY, camZ, tcx, tcy, tcz, occ)) continue;
      if (
        segmentIntersectsBox(camX, camY, camZ, x0, y0, z0, occ) &&
        segmentIntersectsBox(camX, camY, camZ, x1, y0, z0, occ) &&
        segmentIntersectsBox(camX, camY, camZ, x0, y1, z0, occ) &&
        segmentIntersectsBox(camX, camY, camZ, x1, y1, z0, occ) &&
        segmentIntersectsBox(camX, camY, camZ, x0, y0, z1, occ) &&
        segmentIntersectsBox(camX, camY, camZ, x1, y0, z1, occ) &&
        segmentIntersectsBox(camX, camY, camZ, x0, y1, z1, occ) &&
        segmentIntersectsBox(camX, camY, camZ, x1, y1, z1, occ)
      ) {
        return true;
      }
    }
    return false;
  }

  public update(
    camera: THREE.Camera,
    streamOrigin: { x: number; y: number; z: number },
    distMul = 1.0,
    isMapLobby = false,
    quality: GraphicsQuality = 'high',
  ): WorldStreamingStats {
    _camProjScreenMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _camFrustum.setFromProjectionMatrix(_camProjScreenMat);

    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;
    const origX = streamOrigin.x;
    const origZ = streamOrigin.z;

    if (isMapLobby) {
      _activeOccluders.length = 0;
    } else {
      this.refreshActiveOccluders(camX, camY, camZ);
    }

    const stats = this.stats;
    stats.totalTerrainChunks = this.terrainChunks.length;
    stats.loadedTerrainChunks = 0;
    stats.visibleTerrainChunks = 0;
    stats.highLodTerrainChunks = 0;
    stats.lowLodTerrainChunks = 0;
    stats.totalPropChunks = this.propChunks.length;
    stats.loadedPropChunks = 0;
    stats.visiblePropChunks = 0;
    stats.lowLodPropChunks = 0;
    stats.totalDistricts = this.districts.length;
    stats.loadedDistricts = 0;
    stats.proxyActiveDistricts = 0;
    stats.frustumCulled = 0;
    stats.occludedCulled = 0;
    stats.activeOccluders = _activeOccluders.length;

    // 1. Dynamic Terrain Chunk Streaming + High/Low Poly LOD + Frustum & Occlusion Culling
    const terrainLoadBase = (quality === 'low' ? 280 : quality === 'medium' ? 375 : 480) * distMul;
    const terrainUnloadBase = (quality === 'low' ? 340 : quality === 'medium' ? 450 : 580) * distMul;
    const terrainLodDist = (quality === 'low' ? 85 : quality === 'medium' ? 135 : 225) * distMul;

    for (let i = 0; i < this.terrainChunks.length; i++) {
      const tc = this.terrainChunks[i];
      const dx = tc.cx - origX;
      const dz = tc.cz - origZ;
      const distSq = dx * dx + dz * dz;
      const loadLim = terrainLoadBase + tc.halfDiag;
      const unloadLim = terrainUnloadBase + tc.halfDiag;

      if (!isMapLobby) {
        if (tc.loaded && distSq > unloadLim * unloadLim) {
          if (tc.tileGroup.parent === tc.parent) tc.parent.remove(tc.tileGroup);
          tc.loaded = false;
          tc.visible = false;
          continue;
        }
        if (!tc.loaded && distSq <= loadLim * loadLim) {
          if (tc.tileGroup.parent !== tc.parent) tc.parent.add(tc.tileGroup);
          tc.loaded = true;
        }
      } else {
        if (!tc.loaded) {
          if (tc.tileGroup.parent !== tc.parent) tc.parent.add(tc.tileGroup);
          tc.loaded = true;
        }
      }

      if (!tc.loaded) continue;
      stats.loadedTerrainChunks++;

      const wantLowLod = isMapLobby || distSq > (terrainLodDist + tc.halfDiag * 0.35) * (terrainLodDist + tc.halfDiag * 0.35);
      if (wantLowLod !== tc.usingLowLod) {
        tc.mesh.geometry = wantLowLod ? tc.lowGeo : tc.highGeo;
        tc.usingLowLod = wantLowLod;
      }
      if (tc.usingLowLod) stats.lowLodTerrainChunks++;
      else stats.highLodTerrainChunks++;

      if (!isMapLobby && !_camFrustum.intersectsBox(tc.box)) {
        tc.tileGroup.visible = false;
        tc.visible = false;
        stats.frustumCulled++;
        continue;
      }
      if (!isMapLobby && this.isBoxOccluded(camX, camY, camZ, tc.box)) {
        tc.tileGroup.visible = false;
        tc.visible = false;
        stats.occludedCulled++;
        continue;
      }
      tc.tileGroup.visible = true;
      tc.visible = true;
      stats.visibleTerrainChunks++;
    }

    // 2. Dynamic Spatial Prop & Flora Chunk Streaming + Object LOD + Frustum & Occlusion Culling
    for (let i = 0; i < this.propChunks.length; i++) {
      const pc = this.propChunks[i];
      const dx = pc.cx - origX;
      const dz = pc.cz - origZ;
      const distSq = dx * dx + dz * dz;
      const loadLim = pc.loadDist * distMul + pc.radius;
      const unloadLim = pc.unloadDist * distMul + pc.radius;

      if (!isMapLobby) {
        if (pc.loaded && distSq > unloadLim * unloadLim) {
          if (pc.highGroup.parent === pc.parent) pc.parent.remove(pc.highGroup);
          if (pc.lowGroup && pc.lowGroup.parent === pc.parent) pc.parent.remove(pc.lowGroup);
          pc.loaded = false;
          pc.visible = false;
          continue;
        }
        if (!pc.loaded && distSq <= loadLim * loadLim) {
          pc.loaded = true;
        }
      } else {
        pc.loaded = true;
      }

      if (!pc.loaded) continue;
      stats.loadedPropChunks++;

      const lodLim = pc.lodDist * distMul + pc.radius * 0.35;
      const wantLowLod = Boolean(pc.lowGroup) && (isMapLobby || distSq > lodLim * lodLim);
      pc.usingLowLod = wantLowLod;

      if (wantLowLod && pc.lowGroup) {
        if (pc.highGroup.parent === pc.parent) pc.parent.remove(pc.highGroup);
        if (pc.lowGroup.parent !== pc.parent) pc.parent.add(pc.lowGroup);
        stats.lowLodPropChunks++;
      } else {
        if (pc.lowGroup && pc.lowGroup.parent === pc.parent) pc.parent.remove(pc.lowGroup);
        if (pc.highGroup.parent !== pc.parent) pc.parent.add(pc.highGroup);
      }

      const activeGroup = wantLowLod && pc.lowGroup ? pc.lowGroup : pc.highGroup;
      if (!isMapLobby && !_camFrustum.intersectsBox(pc.box)) {
        activeGroup.visible = false;
        pc.visible = false;
        stats.frustumCulled++;
        continue;
      }
      if (!isMapLobby && this.isBoxOccluded(camX, camY, camZ, pc.box)) {
        activeGroup.visible = false;
        pc.visible = false;
        stats.occludedCulled++;
        continue;
      }
      activeGroup.visible = true;
      pc.visible = true;
      stats.visiblePropChunks++;
    }

    // 3. District & Interior LOD Detail Groups + Low-Poly Skyline Proxies
    for (let i = 0; i < this.districts.length; i++) {
      const dg = this.districts[i];
      const dx = dg.x - origX;
      const dz = dg.z - origZ;
      const distSq = dx * dx + dz * dz;
      const loadLim = dg.maxDist * distMul + dg.radius;
      const unloadLim = dg.unloadDist * distMul + dg.radius;
      const proxyLim = dg.proxyMaxDist * distMul + dg.radius;

      if (isMapLobby) {
        if (distSq <= loadLim * loadLim) {
          if (dg.proxyGroup && dg.proxyGroup.parent === dg.parent) dg.parent.remove(dg.proxyGroup);
          if (dg.group.parent !== dg.parent) dg.parent.add(dg.group);
          dg.loaded = true;
          dg.proxyLoaded = false;
          dg.group.visible = true;
          dg.visible = true;
          stats.loadedDistricts++;
        } else if (dg.proxyGroup) {
          if (dg.group.parent === dg.parent) dg.parent.remove(dg.group);
          if (dg.proxyGroup.parent !== dg.parent) dg.parent.add(dg.proxyGroup);
          dg.loaded = false;
          dg.proxyLoaded = true;
          dg.proxyGroup.visible = true;
          dg.visible = true;
          stats.proxyActiveDistricts++;
        }
        continue;
      }

      // Dynamic detail group load/unload with hysteresis
      if (dg.loaded && distSq > unloadLim * unloadLim) {
        if (dg.group.parent === dg.parent) dg.parent.remove(dg.group);
        dg.loaded = false;
        dg.visible = false;
      } else if (!dg.loaded && distSq <= loadLim * loadLim) {
        if (dg.group.parent !== dg.parent) dg.parent.add(dg.group);
        dg.loaded = true;
      }

      if (dg.loaded) {
        stats.loadedDistricts++;
        if (dg.proxyGroup && dg.proxyGroup.parent === dg.parent) {
          dg.parent.remove(dg.proxyGroup);
          dg.proxyLoaded = false;
        }
        _tmpSphere.center.set(dg.x, dg.y, dg.z);
        _tmpSphere.radius = dg.radius;
        if (!_camFrustum.intersectsSphere(_tmpSphere)) {
          dg.group.visible = false;
          dg.visible = false;
          stats.frustumCulled++;
          continue;
        }
        if (dg.tier === 'detail' && this.isBoxOccluded(camX, camY, camZ, dg.box)) {
          dg.group.visible = false;
          dg.visible = false;
          stats.occludedCulled++;
          continue;
        }
        dg.group.visible = true;
        dg.visible = true;
      } else if (dg.proxyGroup) {
        // Low-poly skyline proxy when high-detail district is unloaded
        if (distSq <= proxyLim * proxyLim) {
          if (dg.proxyGroup.parent !== dg.parent) dg.parent.add(dg.proxyGroup);
          dg.proxyLoaded = true;
          stats.proxyActiveDistricts++;
          _tmpSphere.center.set(dg.x, dg.y, dg.z);
          _tmpSphere.radius = dg.radius;
          dg.proxyGroup.visible = _camFrustum.intersectsSphere(_tmpSphere);
        } else {
          if (dg.proxyGroup.parent === dg.parent) dg.parent.remove(dg.proxyGroup);
          dg.proxyLoaded = false;
        }
      }
    }

    return stats;
  }

  public dispose() {
    for (let i = 0; i < this.terrainChunks.length; i++) {
      const tc = this.terrainChunks[i];
      if (tc.tileGroup.parent === tc.parent) tc.parent.remove(tc.tileGroup);
      tc.highGeo.dispose();
      tc.lowGeo.dispose();
    }
    for (let i = 0; i < this.propChunks.length; i++) {
      const pc = this.propChunks[i];
      if (pc.highGroup.parent === pc.parent) pc.parent.remove(pc.highGroup);
      if (pc.lowGroup && pc.lowGroup.parent === pc.parent) pc.parent.remove(pc.lowGroup);
    }
    for (let i = 0; i < this.districts.length; i++) {
      const dg = this.districts[i];
      if (dg.group.parent === dg.parent) dg.parent.remove(dg.group);
      if (dg.proxyGroup && dg.proxyGroup.parent === dg.parent) dg.parent.remove(dg.proxyGroup);
    }
    for (let i = 0; i < this.extraGeos.length; i++) this.extraGeos[i].dispose();
    for (let i = 0; i < this.extraMats.length; i++) this.extraMats[i].dispose();
    this.extraGeos.length = 0;
    this.extraMats.length = 0;
  }
}
