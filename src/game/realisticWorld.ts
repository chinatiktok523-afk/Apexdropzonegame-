import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GraphicsQuality } from '../types';
import type { ProceduralTextureSet } from './textures';

// ---------------------------------------------------------------------------
// Deterministic Multi-Octave Fractal & Ridged Noise Utilities
// ---------------------------------------------------------------------------

export function hash2D(ix: number, iz: number, seed = 1337): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function hash3D(ix: number, iy: number, iz: number, seed = 17): number {
  const n = Math.sin(ix * 127.1 + iy * 269.5 + iz * 419.2 + seed * 53.3) * 43758.5453123;
  return n - Math.floor(n);
}

export function valueNoise2D(x: number, z: number, seed = 1337): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz, seed);
  const b = hash2D(ix + 1, iz, seed);
  const c = hash2D(ix, iz + 1, seed);
  const d = hash2D(ix + 1, iz + 1, seed);
  return (a * (1 - ux) + b * ux) * (1 - uz) + (c * (1 - ux) + d * ux) * uz;
}

export function fbm2D(x: number, z: number, octaves = 4, lacunarity = 2.05, gain = 0.5, seed = 1337): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, z * freq, seed + i * 31);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / Math.max(0.0001, norm);
}

export function ridged2D(x: number, z: number, octaves = 4, seed = 701): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2D(x * freq, z * freq, seed + i * 47) * 2 - 1;
    const ridge = 1 - Math.abs(n);
    sum += amp * ridge * ridge;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / Math.max(0.0001, norm);
}

function noise3D(x: number, y: number, z: number, seed = 17): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const c000 = hash3D(ix, iy, iz, seed);
  const c100 = hash3D(ix + 1, iy, iz, seed);
  const c010 = hash3D(ix, iy + 1, iz, seed);
  const c110 = hash3D(ix + 1, iy + 1, iz, seed);
  const c001 = hash3D(ix, iy, iz + 1, seed);
  const c101 = hash3D(ix + 1, iy, iz + 1, seed);
  const c011 = hash3D(ix, iy + 1, iz + 1, seed);
  const c111 = hash3D(ix + 1, iy + 1, iz + 1, seed);

  const x00 = c000 * (1 - ux) + c100 * ux;
  const x10 = c010 * (1 - ux) + c110 * ux;
  const x01 = c001 * (1 - ux) + c101 * ux;
  const x11 = c011 * (1 - ux) + c111 * ux;
  const y0 = x00 * (1 - uy) + x10 * uy;
  const y1 = x01 * (1 - uy) + x11 * uy;
  return y0 * (1 - uz) + y1 * uz;
}

// ---------------------------------------------------------------------------
// 1. Slope & Altitude Texture-Splatting PBR Terrain Material
// ---------------------------------------------------------------------------

export interface SplatTerrainOptions {
  waterLevel?: number;
  snowStartY?: number;
  isNight?: boolean;
  isBeatMode?: boolean;
  rockTint?: number;
  grassTint?: number;
  soilTint?: number;
  sandTint?: number;
  graphicsQuality?: GraphicsQuality;
}

export interface SplatTerrainController {
  material: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
  uniforms: {
    uWaterLevel: { value: number };
    uSnowStartY: { value: number };
    uNightMix: { value: number };
  };
}

export function createSplatTerrainMaterial(
  textures: ProceduralTextureSet,
  opts: SplatTerrainOptions = {},
): SplatTerrainController {
  const uniforms = {
    uWaterLevel: { value: opts.waterLevel ?? -2.2 },
    uSnowStartY: { value: opts.snowStartY ?? 21.0 },
    uNightMix: { value: opts.isNight ? 1.0 : 0.0 },
  };

  const useLambert = opts.graphicsQuality === 'low' || opts.graphicsQuality === 'medium';
  const material: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial = useLambert
    ? new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: textures.terrainAlbedo,
        vertexColors: true,
      })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.terrainAlbedo,
        normalMap: textures.terrainNormal ?? undefined,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughnessMap: textures.terrainRoughness ?? undefined,
        roughness: 0.92,
        metalness: 0.03,
        vertexColors: true,
      });

  if (!opts.isBeatMode) {
    const rockCol = new THREE.Color(opts.rockTint ?? 0x67655e);
    const grassCol = new THREE.Color(opts.grassTint ?? 0x4b7f36);
    const soilCol = new THREE.Color(opts.soilTint ?? 0x6b563c);
    const sandCol = new THREE.Color(opts.sandTint ?? 0xb29c72);
    const snowCol = new THREE.Color(0xdbe6f2);

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterLevel = uniforms.uWaterLevel;
      shader.uniforms.uSnowStartY = uniforms.uSnowStartY;
      shader.uniforms.uNightMix = uniforms.uNightMix;
      shader.uniforms.uAsphaltMap = { value: textures.asphaltAlbedo ?? textures.terrainAlbedo };
      shader.uniforms.uRockColor = { value: rockCol };
      shader.uniforms.uGrassColor = { value: grassCol };
      shader.uniforms.uSoilColor = { value: soilCol };
      shader.uniforms.uSandColor = { value: sandCol };
      shader.uniforms.uSnowColor = { value: snowCol };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aRoadMask;
           varying vec3 vTerrainWorldPos;
           varying vec3 vTerrainWorldNormal;
           varying float vRoadMask;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vec4 splatWp = modelMatrix * vec4(transformed, 1.0);
           vTerrainWorldPos = splatWp.xyz;
           vTerrainWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
           vRoadMask = aRoadMask;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uWaterLevel;
           uniform float uSnowStartY;
           uniform float uNightMix;
           uniform sampler2D uAsphaltMap;
           uniform vec3 uRockColor;
           uniform vec3 uGrassColor;
           uniform vec3 uSoilColor;
           uniform vec3 uSandColor;
           uniform vec3 uSnowColor;
           varying vec3 vTerrainWorldPos;
           varying vec3 vTerrainWorldNormal;
           varying float vRoadMask;
           float terrainHash(vec2 p) {
             return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
           }
           float terrainNoise(vec2 p) {
             vec2 i = floor(p);
             vec2 f = fract(p);
             vec2 u = f * f * (3.0 - 2.0 * f);
             return mix(
               mix(terrainHash(i), terrainHash(i + vec2(1.0, 0.0)), u.x),
               mix(terrainHash(i + vec2(0.0, 1.0)), terrainHash(i + vec2(1.0, 1.0)), u.x),
               u.y
             );
           }`,
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
             float roadTexMix = smoothstep(0.35, 0.65, clamp(vRoadMask, 0.0, 1.0));
             vec4 sampledTerrainTex = texture2D( map, vMapUv );
             vec4 sampledAsphaltTex = texture2D( uAsphaltMap, vTerrainWorldPos.xz * 0.08 );
             diffuseColor *= mix( sampledTerrainTex, sampledAsphaltTex, roadTexMix );
           #endif`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float upness = clamp(vTerrainWorldNormal.y, 0.0, 1.0);
           float microVar = terrainNoise(vTerrainWorldPos.xz * 0.055);
           float fineStrata = terrainNoise(vec2(vTerrainWorldPos.x * 0.12 + vTerrainWorldPos.y * 0.45, vTerrainWorldPos.z * 0.12));

           // Flat grass/soil variation
           vec3 groundCol = mix(uGrassColor, uSoilColor, smoothstep(0.42, 0.78, microVar) * 0.55);
           groundCol *= (0.88 + fineStrata * 0.24);

           // Steep slope rock cliff splat
           float rockBlend = smoothstep(0.84, 0.64, upness);
           vec3 cliffCol = uRockColor * (0.76 + fineStrata * 0.48);
           groundCol = mix(groundCol, cliffCol, rockBlend);

           // Low basin sand / wet mud near waterline
           float shoreBlend = 1.0 - smoothstep(uWaterLevel - 0.5, uWaterLevel + 0.85, vTerrainWorldPos.y);
           vec3 wetSand = mix(uSandColor * 0.52, uSandColor, smoothstep(uWaterLevel - 0.6, uWaterLevel + 0.45, vTerrainWorldPos.y));
           groundCol = mix(groundCol, wetSand, shoreBlend * (1.0 - rockBlend * 0.4));

           // Alpine snow accumulation on high elevations & gentle ridges
           float snowHeight = smoothstep(uSnowStartY - 3.0, uSnowStartY + 5.5, vTerrainWorldPos.y);
           float snowSlope = smoothstep(0.56, 0.82, upness);
           groundCol = mix(groundCol, uSnowColor, snowHeight * snowSlope * 0.92);

           // Clean separation between grass/terrain and asphalt/plaza aprons (no muddy green-grey edge halo)
           float roadColMix = smoothstep(0.35, 0.65, clamp(vRoadMask, 0.0, 1.0));
           vec3 cleanAsphalt = mix(vec3(0.18, 0.20, 0.23), diffuseColor.rgb, 0.35);
           vec3 finalTerrainCol = mix(mix(diffuseColor.rgb, groundCol, 0.65), cleanAsphalt, roadColMix);
           finalTerrainCol = mix(finalTerrainCol, finalTerrainCol * vec3(0.32, 0.36, 0.48), uNightMix * 0.72);
           diffuseColor.rgb = finalTerrainCol;`,
        );
    };
    material.customProgramCacheKey = () =>
      useLambert ? 'splat_terrain_lambert_v2' : 'splat_terrain_pbr_v2';
  }

  return { material, uniforms };
}

// ---------------------------------------------------------------------------
// 2. Displaced High-Segment Organic Boulders & Rock Outcrops (InstancedMesh)
// ---------------------------------------------------------------------------

export function createOrganicBoulderGeometry(radius = 1, detail = 2, seed = 42): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const baseRock = new THREE.Color(0x6b6b66);
  const mossRock = new THREE.Color(0x4c6239);
  const darkCrevice = new THREE.Color(0x3a3b38);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();
    const n1 = noise3D(dir.x * 2.1, dir.y * 2.1, dir.z * 2.1, seed);
    const n2 = 1 - Math.abs(noise3D(dir.x * 4.5, dir.y * 4.5, dir.z * 4.5, seed + 13) * 2 - 1);
    const disp = 0.72 + n1 * 0.34 + n2 * 0.22;
    v.multiplyScalar(disp);
    // Flatten underside subtly so boulders sit grounded naturally
    v.y *= dir.y < 0 ? 0.62 : 0.86;
    pos.setXYZ(i, v.x, v.y, v.z);

    const mossMask = THREE.MathUtils.smoothstep(dir.y, 0.28, 0.75) * (0.45 + 0.55 * n1);
    const crevMask = THREE.MathUtils.clamp((1 - disp) * 1.4, 0, 1);
    tmp.copy(baseRock).lerp(darkCrevice, crevMask * 0.6).lerp(mossRock, mossMask * 0.65);
    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

export interface BoulderPlacement {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotY: number;
  rotX?: number;
}

export function populateOrganicBoulders(
  parent: THREE.Object3D,
  placements: BoulderPlacement[],
  textures: ProceduralTextureSet,
  geometriesToDispose: THREE.BufferGeometry[],
  materialsToDispose: THREE.Material[],
  opts?: { isSoftwareGl?: boolean; isNight?: boolean; shootableEnv?: THREE.Object3D[]; graphicsQuality?: GraphicsQuality },
): THREE.InstancedMesh | null {
  if (placements.length === 0) return null;
  const q = opts?.graphicsQuality;
  const useLambert = q === 'low' || q === 'medium';
  const lowDetail = useLambert || Boolean(opts?.isSoftwareGl);
  const geo = createOrganicBoulderGeometry(1, lowDetail ? 1 : 2, 79);
  geometriesToDispose.push(geo);

  const mat = useLambert
    ? new THREE.MeshLambertMaterial({
        map: textures.rockAlbedo,
        vertexColors: true,
        color: opts?.isNight ? 0x94a3b8 : 0xffffff,
      })
    : new THREE.MeshStandardMaterial({
        map: textures.rockAlbedo,
        normalMap: textures.rockNormal ?? undefined,
        normalScale: new THREE.Vector2(1.1, 1.1),
        vertexColors: true,
        roughness: 0.88,
        metalness: 0.06,
        color: opts?.isNight ? 0x94a3b8 : 0xffffff,
      });
  materialsToDispose.push(mat);

  const im = new THREE.InstancedMesh(geo, mat, placements.length);
  im.castShadow = !lowDetail;
  im.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rotX ?? 0, p.rotY, 0);
    dummy.scale.set(p.scaleX, p.scaleY, p.scaleZ);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  parent.add(im);
  if (opts?.shootableEnv) opts.shootableEnv.push(im);
  return im;
}

// ---------------------------------------------------------------------------
// 3. Tapered Branching Tree Trunks + Layered Organic Foliage Canopies
// ---------------------------------------------------------------------------

function makeDisplacedLobe(rx: number, ry: number, rz: number, cx: number, cy: number, cz: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise3D(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2 - seed, seed);
    const s = 0.84 + n * 0.34;
    v.set(v.x * rx * s + cx, v.y * ry * s + cy, v.z * rz * s + cz);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export interface OrganicTreePlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  tintHex?: number;
}

export function populateOrganicTrees(
  parent: THREE.Object3D,
  placements: OrganicTreePlacement[],
  textures: ProceduralTextureSet,
  geometriesToDispose: THREE.BufferGeometry[],
  materialsToDispose: THREE.Material[],
  opts?: { isSoftwareGl?: boolean; isNight?: boolean; pine?: boolean; graphicsQuality?: GraphicsQuality },
): {
  trunks: THREE.InstancedMesh;
  canopies: THREE.InstancedMesh;
  fruits: THREE.InstancedMesh | null;
  perchSpots: Array<{ x: number; y: number; z: number }>;
  update: (elapsed: number) => void;
} | null {
  if (placements.length === 0) return null;

  const isPine = Boolean(opts?.pine);
  // Build taller, complex tapered multi-fork trunk + spreading branches cleanly via mergeGeometries
  const trunkParts: THREE.BufferGeometry[] = [];
  const baseH = isPine ? 4.2 : 5.4;
  const mainTrunk = new THREE.CylinderGeometry(0.16, 0.36, baseH, 8);
  mainTrunk.translate(0, baseH * 0.5, 0);
  trunkParts.push(mainTrunk);

  const rootFlare = new THREE.CylinderGeometry(0.32, 0.52, 0.72, 8);
  rootFlare.translate(0, 0.36, 0);
  trunkParts.push(rootFlare);

  const localPerches: Array<[number, number, number]> = [];
  const localFruits: Array<[number, number, number]> = [];

  if (isPine) {
    const limbAngles = [0.2, 2.35, 4.45];
    limbAngles.forEach((ang, idx) => {
      const limb = new THREE.CylinderGeometry(0.06, 0.12, 1.9, 6);
      limb.translate(0, 0.95, 0);
      limb.rotateZ(0.62 + idx * 0.06);
      limb.rotateY(ang);
      limb.translate(0, 2.6 + idx * 0.3, 0);
      trunkParts.push(limb);
    });
    localPerches.push([0, 7.6, 0]);
  } else {
    // 5 primary spreading limbs + 5 secondary outer twigs where birds perch
    const primaryAngles = [0.15, 1.4, 2.65, 3.9, 5.15];
    primaryAngles.forEach((ang, idx) => {
      const len = 2.6 + (idx % 2) * 0.45;
      const tilt = 0.66 + (idx % 3) * 0.09;
      const yStart = 3.2 + (idx % 3) * 0.55;
      const limb = new THREE.CylinderGeometry(0.065, 0.14, len, 6);
      limb.translate(0, len * 0.5, 0);
      limb.rotateZ(tilt);
      limb.rotateY(ang);
      limb.translate(0, yStart, 0);
      trunkParts.push(limb);

      // Tip coordinate in local space for branch perch & secondary sub-branch
      const tipR = Math.sin(tilt) * len;
      const tipY = yStart + Math.cos(tilt) * len;
      const tx = -Math.cos(ang) * tipR;
      const tz = Math.sin(ang) * tipR;
      localPerches.push([tx * 0.85, tipY + 0.18, tz * 0.85]);

      const subLen = 1.45;
      const subLimb = new THREE.CylinderGeometry(0.032, 0.065, subLen, 5);
      subLimb.translate(0, subLen * 0.5, 0);
      subLimb.rotateZ(0.82);
      subLimb.rotateY(ang + 0.42);
      subLimb.translate(tx * 0.65, yStart + Math.cos(tilt) * len * 0.65, tz * 0.65);
      trunkParts.push(subLimb);

      localFruits.push(
        [tx * 0.92, tipY + 0.35, tz * 0.92],
        [tx * 0.58 + 0.45, tipY + 0.72, tz * 0.58 - 0.35],
      );
    });
    localPerches.push([0.35, 7.85, -0.25]);
  }

  const mergedTrunk = mergeGeometries(trunkParts, false);
  trunkParts.forEach((p) => p.dispose());
  geometriesToDispose.push(mergedTrunk);

  // Build taller organic layered foliage canopy geometry
  const canopyParts: THREE.BufferGeometry[] = isPine
    ? [
        makeDisplacedLobe(2.05, 1.15, 2.05, 0, 3.6, 0, 11),
        makeDisplacedLobe(1.6, 1.15, 1.6, 0.14, 4.95, -0.08, 23),
        makeDisplacedLobe(1.12, 1.05, 1.12, -0.08, 6.2, 0.1, 37),
        makeDisplacedLobe(0.62, 0.95, 0.62, 0, 7.2, 0, 51),
      ]
    : [
        makeDisplacedLobe(2.25, 1.68, 2.25, 0, 6.25, 0, 19),
        makeDisplacedLobe(1.75, 1.38, 1.75, 1.48, 5.45, 0.75, 31),
        makeDisplacedLobe(1.68, 1.32, 1.68, -1.42, 5.55, -0.72, 43),
        makeDisplacedLobe(1.55, 1.25, 1.55, 0.35, 5.75, -1.38, 61),
        makeDisplacedLobe(1.52, 1.25, 1.52, -0.35, 5.65, 1.35, 73),
        makeDisplacedLobe(1.45, 1.28, 1.45, -0.22, 7.25, 0.32, 89),
      ];

  const mergedCanopy = mergeGeometries(canopyParts, false);
  canopyParts.forEach((p) => p.dispose());
  geometriesToDispose.push(mergedCanopy);

  const q = opts?.graphicsQuality;
  const useLambert = q === 'low' || q === 'medium';

  const barkMat = useLambert
    ? new THREE.MeshLambertMaterial({
        map: textures.barkAlbedo,
        color: opts?.isNight ? 0x64748b : 0xffffff,
      })
    : new THREE.MeshStandardMaterial({
        map: textures.barkAlbedo,
        normalMap: textures.barkNormal ?? undefined,
        normalScale: new THREE.Vector2(0.95, 0.95),
        roughness: 0.9,
        metalness: 0.02,
        color: opts?.isNight ? 0x64748b : 0xffffff,
      });

  const windUniforms = {
    uTime: { value: 0 },
  };
  const foliageMat = useLambert
    ? new THREE.MeshLambertMaterial({
        color: opts?.isNight ? 0x64748b : 0xffffff,
      })
    : new THREE.MeshStandardMaterial({
        color: opts?.isNight ? 0x64748b : 0xffffff,
        roughness: 0.82,
        metalness: 0.02,
      });
  foliageMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 treeInst = vec4(0.0, 0.0, 0.0, 1.0);
         #ifdef USE_INSTANCING
           treeInst = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         #endif
         float leafHeight = clamp((position.y - 3.0) * 0.25, 0.0, 1.4);
         float sway = sin(uTime * 1.9 + treeInst.x * 0.14 + position.y * 0.85) * 0.16 * leafHeight;
         float flutter = cos(uTime * 3.4 + treeInst.z * 0.18 + position.x * 1.4) * 0.07 * leafHeight;
         transformed.x += sway + flutter;
         transformed.z += sway * 0.65 - flutter * 0.5;`,
      );
  };
  foliageMat.customProgramCacheKey = () =>
    useLambert ? 'organic_wind_canopy_lambert_v1' : 'organic_wind_canopy_v1';
  materialsToDispose.push(barkMat, foliageMat);

  const trunks = new THREE.InstancedMesh(mergedTrunk, barkMat, placements.length);
  const canopies = new THREE.InstancedMesh(mergedCanopy, foliageMat, placements.length);
  const castTreeShadow = !(opts?.isSoftwareGl ?? false) && !useLambert;
  trunks.castShadow = castTreeShadow;
  trunks.receiveShadow = true;
  canopies.castShadow = castTreeShadow;
  canopies.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  const palette = isPine
    ? [0x265c3a, 0x2e6f45, 0x1e4d30, 0x357a49]
    : [0x3d8b3e, 0x4ca142, 0x327535, 0x62a840, 0x739c38];

  const perchSpots: Array<{ x: number; y: number; z: number }> = [];
  const pLocalVec = new THREE.Vector3();

  for (let i = 0; i < placements.length; i++) {
    const t = placements[i];
    const tallScale = isPine ? t.scale : t.scale * 1.18;
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, t.rotY, 0);
    dummy.scale.setScalar(tallScale);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    canopies.setMatrixAt(i, dummy.matrix);

    cTmp.setHex(t.tintHex ?? palette[i % palette.length]);
    canopies.setColorAt(i, cTmp);

    if (localPerches.length > 0 && (i % 2 === 0 || placements.length < 30)) {
      const lp = localPerches[i % localPerches.length];
      pLocalVec.set(lp[0], lp[1], lp[2]).applyMatrix4(dummy.matrix);
      perchSpots.push({ x: pLocalVec.x, y: pLocalVec.y, z: pLocalVec.z });
    }
  }
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  trunks.computeBoundingSphere();
  canopies.computeBoundingSphere();

  parent.add(trunks, canopies);

  // Hanging Colorful Fruits on Deciduous Complex Trees (skip on Low quality for extra FPS)
  let fruits: THREE.InstancedMesh | null = null;
  if (!isPine && localFruits.length > 0 && q !== 'low') {
    const fruitLimit = q === 'medium' || opts?.isSoftwareGl ? 60 : 120;
    const fruitTreesCount = Math.min(placements.length, fruitLimit);
    const totalFruits = fruitTreesCount * 3;
    const fruitGeo = new THREE.SphereGeometry(0.18, 6, 6);
    geometriesToDispose.push(fruitGeo);
    const fruitMat = useLambert
      ? new THREE.MeshLambertMaterial({ color: 0xffffff })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.42,
          metalness: 0.04,
        });
    materialsToDispose.push(fruitMat);
    fruits = new THREE.InstancedMesh(fruitGeo, fruitMat, totalFruits);
    const fruitColors = [0xf97316, 0xef4444, 0xfacc15, 0xfb7185];
    let fIdx = 0;
    for (let i = 0; i < fruitTreesCount; i++) {
      const t = placements[i];
      const tallScale = t.scale * 1.18;
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, t.rotY, 0);
      dummy.scale.setScalar(tallScale);
      dummy.updateMatrix();
      for (let k = 0; k < 3; k++) {
        const lf = localFruits[(i + k * 2) % localFruits.length];
        pLocalVec.set(lf[0], lf[1], lf[2]).applyMatrix4(dummy.matrix);
        const fDummy = new THREE.Matrix4().makeTranslation(pLocalVec.x, pLocalVec.y, pLocalVec.z);
        fruits.setMatrixAt(fIdx, fDummy);
        cTmp.setHex(fruitColors[(i + k) % fruitColors.length]);
        fruits.setColorAt(fIdx, cTmp);
        fIdx++;
      }
    }
    fruits.instanceMatrix.needsUpdate = true;
    if (fruits.instanceColor) fruits.instanceColor.needsUpdate = true;
    fruits.computeBoundingSphere();
    parent.add(fruits);
  }

  return {
    trunks,
    canopies,
    fruits,
    perchSpots,
    update: (elapsed: number) => {
      windUniforms.uTime.value = elapsed;
    },
  };
}

/**
 * Low-polygon merged tree proxy (1 trunk + 1 crown per instance, ~24 tris) for distant tree LOD chunks.
 */
export function populateLowPolyTrees(
  parent: THREE.Object3D,
  placements: OrganicTreePlacement[],
  geometriesToDispose: THREE.BufferGeometry[],
  materialsToDispose: THREE.Material[],
  opts?: { isNight?: boolean; pine?: boolean; graphicsQuality?: GraphicsQuality },
): THREE.InstancedMesh | null {
  if (placements.length === 0) return null;
  const isPine = Boolean(opts?.pine);
  const useLambert = opts?.graphicsQuality === 'low' || opts?.graphicsQuality === 'medium';

  const trunkRaw = new THREE.CylinderGeometry(0.18, 0.34, isPine ? 3.8 : 4.8, 5);
  trunkRaw.translate(0, isPine ? 1.9 : 2.4, 0);
  const trunkGeo = trunkRaw.index ? trunkRaw.toNonIndexed() : trunkRaw;
  if (trunkGeo !== trunkRaw) trunkRaw.dispose();
  const tPos = trunkGeo.attributes.position;
  const tCols = new Float32Array(tPos.count * 3);
  for (let i = 0; i < tPos.count; i++) {
    tCols[i * 3] = 0.42;
    tCols[i * 3 + 1] = 0.28;
    tCols[i * 3 + 2] = 0.16;
  }
  trunkGeo.setAttribute('color', new THREE.BufferAttribute(tCols, 3));

  const crownRaw = isPine
    ? new THREE.ConeGeometry(2.05, 5.2, 6)
    : new THREE.IcosahedronGeometry(2.35, 0);
  crownRaw.translate(0, isPine ? 5.1 : 6.1, 0);
  const crownGeo = crownRaw.index ? crownRaw.toNonIndexed() : crownRaw;
  if (crownGeo !== crownRaw) crownRaw.dispose();
  const cPos = crownGeo.attributes.position;
  const cCols = new Float32Array(cPos.count * 3);
  for (let i = 0; i < cPos.count; i++) {
    cCols[i * 3] = isPine ? 0.18 : 0.28;
    cCols[i * 3 + 1] = isPine ? 0.44 : 0.58;
    cCols[i * 3 + 2] = isPine ? 0.24 : 0.24;
  }
  crownGeo.setAttribute('color', new THREE.BufferAttribute(cCols, 3));

  const mergedLow = mergeGeometries([trunkGeo, crownGeo], false);
  trunkGeo.dispose();
  crownGeo.dispose();
  if (!mergedLow) return null;
  geometriesToDispose.push(mergedLow);

  const mat = useLambert
    ? new THREE.MeshLambertMaterial({
        color: opts?.isNight ? 0x64748b : 0xffffff,
        vertexColors: true,
      })
    : new THREE.MeshStandardMaterial({
        color: opts?.isNight ? 0x64748b : 0xffffff,
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.02,
      });
  materialsToDispose.push(mat);

  const im = new THREE.InstancedMesh(mergedLow, mat, placements.length);
  im.castShadow = false;
  im.receiveShadow = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < placements.length; i++) {
    const t = placements[i];
    const tallScale = isPine ? t.scale : t.scale * 1.18;
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, t.rotY, 0);
    dummy.scale.setScalar(tallScale);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  parent.add(im);
  return im;
}


// ---------------------------------------------------------------------------
// 4. Thousands of GPU-Instanced Curved Grass Blades with Wind Shader
// ---------------------------------------------------------------------------

function buildGrassClumpGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const angles = [0, 2.094, 4.188];
  const offsets: [number, number][] = [
    [0, 0],
    [0.09, -0.06],
    [-0.08, 0.07],
  ];

  for (let b = 0; b < 3; b++) {
    const g = new THREE.PlaneGeometry(0.13, 0.62, 1, 3);
    g.translate(0, 0.31, 0);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = THREE.MathUtils.clamp(y / 0.62, 0, 1);
      // Taper cleanly to a pointed tip & arch slightly along +Z
      pos.setX(i, pos.getX(i) * (1 - t * 0.9));
      pos.setZ(i, pos.getZ(i) + t * t * 0.16);
    }
    g.computeVertexNormals();
    g.rotateY(angles[b]);
    g.translate(offsets[b][0], 0, offsets[b][1]);
    blades.push(g);
  }

  const merged = mergeGeometries(blades, false);
  blades.forEach((g) => g.dispose());
  return merged;
}

export interface InstancedGrassSystem {
  mesh: THREE.InstancedMesh;
  maxCount: number;
  uniforms: {
    uTime: { value: number };
    uWindStrength: { value: number };
    uMaxDistSq: { value: number };
  };
  setQuality: (quality: GraphicsQuality, isSoftwareGl: boolean) => void;
  update: (elapsed: number) => void;
}

export function populateInstancedGrass(
  parent: THREE.Object3D,
  samples: Array<{ x: number; y: number; z: number; scale: number; rotY: number; tintHex?: number }>,
  geometriesToDispose: THREE.BufferGeometry[],
  materialsToDispose: THREE.Material[],
  quality: GraphicsQuality,
  isSoftwareGl: boolean,
  isNight = false,
): InstancedGrassSystem | null {
  if (samples.length === 0) return null;

  const bladeGeo = buildGrassClumpGeometry();
  geometriesToDispose.push(bladeGeo);

  const uniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: 0.24 },
    uMaxDistSq: { value: 110 * 110 },
  };

  const grassMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x3b6e44 : 0x5ca63e,
    roughness: 0.85,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.uniforms.uMaxDistSq = uniforms.uMaxDistSq;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWindStrength;
         uniform float uMaxDistSq;
         varying float vGrassHeight;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float hFactor = clamp(position.y / 0.62, 0.0, 1.0);
         vGrassHeight = hFactor;
         vec4 instWorld = vec4(0.0, 0.0, 0.0, 1.0);
         #ifdef USE_INSTANCING
           instWorld = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         #endif
         float gust = sin(uTime * 2.2 + instWorld.x * 0.16 + instWorld.z * 0.11)
                    + 0.45 * cos(uTime * 3.7 + instWorld.z * 0.29);
         float bend = hFactor * hFactor * uWindStrength * gust;
         transformed.x += bend;
         transformed.z += bend * 0.55;
         transformed.y -= abs(bend) * 0.18 * hFactor;

         // Smooth distance cull fade by shrinking blades beyond uMaxDistSq
         vec3 camDelta = instWorld.xyz - cameraPosition;
         float d2 = dot(camDelta, camDelta);
         float distScale = 1.0 - smoothstep(uMaxDistSq * 0.55, uMaxDistSq, d2);
         transformed *= distScale;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vGrassHeight;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // Darken roots slightly for natural ambient occlusion and brighten sunlit tips
         diffuseColor.rgb *= mix(0.54, 1.18, vGrassHeight);`,
      );
  };
  grassMat.customProgramCacheKey = () => 'instanced_wind_grass_v1';
  materialsToDispose.push(grassMat);

  const im = new THREE.InstancedMesh(bladeGeo, grassMat, samples.length);
  im.castShadow = false;
  im.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  const tints = [0xffffff, 0xdef2b8, 0xb8e096, 0xe8ebb0];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    dummy.position.set(s.x, s.y - 0.03, s.z);
    dummy.rotation.set(0, s.rotY, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    cTmp.setHex(s.tintHex ?? tints[i % tints.length]);
    im.setColorAt(i, cTmp);
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.computeBoundingSphere();

  const applyQuality = (q: GraphicsQuality, softGl: boolean) => {
    if (softGl) {
      im.count = Math.min(samples.length, Math.max(120, Math.round(samples.length * 0.25)));
      uniforms.uMaxDistSq.value = 60 * 60;
      return;
    }
    if (q === 'low') {
      im.count = Math.max(200, Math.round(samples.length * 0.35));
      uniforms.uMaxDistSq.value = 68 * 68;
    } else if (q === 'medium') {
      im.count = Math.max(400, Math.round(samples.length * 0.7));
      uniforms.uMaxDistSq.value = 95 * 95;
    } else {
      im.count = samples.length;
      uniforms.uMaxDistSq.value = 130 * 130;
    }
  };
  applyQuality(quality, isSoftwareGl);

  parent.add(im);
  return {
    mesh: im,
    maxCount: samples.length,
    uniforms,
    setQuality: applyQuality,
    update: (elapsed: number) => {
      uniforms.uTime.value = elapsed;
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Realistic Animated Water (Dual Normals, Fresnel, Depth Absorption, Foam)
// ---------------------------------------------------------------------------

export interface RealisticWaterSystem {
  mesh: THREE.Mesh;
  uniforms: {
    uTime: { value: number };
    uSkyHorizon: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
  };
  update: (elapsed: number, sunDir?: THREE.Vector3, skyHorizon?: THREE.Color, sunColor?: THREE.Color) => void;
}

export function createRealisticWater(
  width: number,
  depth: number,
  waterY: number,
  terrainHeightFn: (x: number, z: number) => number,
  textures: ProceduralTextureSet,
  geometriesToDispose: THREE.BufferGeometry[],
  materialsToDispose: THREE.Material[],
  opts?: { segsX?: number; segsZ?: number; centerX?: number; centerZ?: number; isNight?: boolean },
): RealisticWaterSystem {
  const segX = opts?.segsX ?? 72;
  const segZ = opts?.segsZ ?? 72;
  const cx = opts?.centerX ?? 0;
  const cz = opts?.centerZ ?? 0;

  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const depths = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + cx;
    const wz = pos.getZ(i) + cz;
    const floorY = terrainHeightFn(wx, wz);
    depths[i] = waterY - floorY;
  }
  geo.setAttribute('aWaterDepth', new THREE.BufferAttribute(depths, 1));
  geometriesToDispose.push(geo);

  const uniforms = {
    uTime: { value: 0 },
    uSkyHorizon: { value: new THREE.Color(opts?.isNight ? 0x162442 : 0xaad6f2) },
    uSunColor: { value: new THREE.Color(opts?.isNight ? 0x94a3b8 : 0xfff5dc) },
    uSunDir: { value: new THREE.Vector3(0.55, 0.72, 0.42).normalize() },
    uNormalB: { value: textures.waterNormalB },
  };

  const mat = new THREE.MeshStandardMaterial({
    color: opts?.isNight ? 0x0b3954 : 0x1889b2,
    normalMap: textures.waterNormalA,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.1,
    metalness: 0.36,
    transparent: true,
    opacity: 0.9,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSkyHorizon = uniforms.uSkyHorizon;
    shader.uniforms.uSunColor = uniforms.uSunColor;
    shader.uniforms.uSunDir = uniforms.uSunDir;
    shader.uniforms.uNormalB = uniforms.uNormalB;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aWaterDepth;
         uniform float uTime;
         varying float vWaterDepth;
         varying vec3 vWaterWorldPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vWaterDepth = aWaterDepth;
         vec4 wPosCheck = modelMatrix * vec4(transformed, 1.0);
         float wave = sin(wPosCheck.x * 0.45 + uTime * 1.9) * 0.032 + cos(wPosCheck.z * 0.38 - uTime * 1.6) * 0.028;
         transformed.y += wave * smoothstep(0.05, 0.85, aWaterDepth);`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vec4 waterWp = modelMatrix * vec4(transformed, 1.0);
         vWaterWorldPos = waterWp.xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform vec3 uSkyHorizon;
         uniform vec3 uSunColor;
         uniform vec3 uSunDir;
         uniform sampler2D uNormalB;
         varying float vWaterDepth;
         varying vec3 vWaterWorldPos;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         vec2 wUvA = vWaterWorldPos.xz * 0.045 + vec2(uTime * 0.024, uTime * 0.017);
         vec2 wUvB = vWaterWorldPos.xz * 0.068 - vec2(uTime * 0.019, -uTime * 0.026);
         vec3 nA = texture2D(normalMap, wUvA).xyz * 2.0 - 1.0;
         vec3 nB = texture2D(uNormalB, wUvB).xyz * 2.0 - 1.0;
         vec3 ripple = normalize(vec3((nA.x + nB.x) * 0.42, (nA.y + nB.y) * 0.42, 1.8));
         normal = normalize(normal + vec3(ripple.x * 0.36, 0.0, ripple.y * 0.36));`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float depthClamped = clamp(vWaterDepth, 0.0, 5.0);
         vec3 shallowCol = vec3(0.16, 0.72, 0.74);
         vec3 deepCol = vec3(0.03, 0.25, 0.44);
         float absorb = smoothstep(0.15, 2.8, depthClamped);
         vec3 baseWater = mix(shallowCol, deepCol, absorb);

         vec3 viewDirW = normalize(cameraPosition - vWaterWorldPos);
         float fresnel = pow(1.0 - clamp(dot(viewDirW, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 3.4);
         baseWater = mix(baseWater, uSkyHorizon * 0.92, clamp(fresnel * 0.78, 0.05, 0.8));

         // Sun specular glint across waves
         vec3 halfVec = normalize(normalize(uSunDir) + viewDirW);
         float spec = pow(max(dot(vec3(0.0, 1.0, 0.0), halfVec), 0.0), 80.0);
         baseWater += uSunColor * spec * 0.45;

         // Animated shoreline foam where water meets land (depth in [0.0..0.48])
         float foamBand = 1.0 - smoothstep(0.0, 0.52, depthClamped);
         float foamWave = 0.5 + 0.5 * sin(depthClamped * 14.0 - uTime * 3.1 + vWaterWorldPos.x * 0.4);
         float foam = foamBand * (0.45 + 0.55 * foamWave);
         diffuseColor.rgb = mix(baseWater, vec3(0.92, 0.97, 1.0), foam * 0.72);
         diffuseColor.a = clamp(mix(0.46, 0.94, smoothstep(0.0, 0.85, depthClamped)) + foam * 0.25, 0.38, 0.96);`,
      );
  };
  mat.customProgramCacheKey = () => 'realistic_water_pbr_v1';
  materialsToDispose.push(mat);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, waterY, cz);
  mesh.receiveShadow = true;

  return {
    mesh,
    uniforms,
    update: (elapsed: number, sunDir?: THREE.Vector3, skyHorizon?: THREE.Color, sunColor?: THREE.Color) => {
      uniforms.uTime.value = elapsed;
      if (sunDir) uniforms.uSunDir.value.copy(sunDir).normalize();
      if (skyHorizon) uniforms.uSkyHorizon.value.copy(skyHorizon);
      if (sunColor) uniforms.uSunColor.value.copy(sunColor);
    },
  };
}

// ---------------------------------------------------------------------------
// 6. Physically Inspired Atmospheric Scattering Sky Dome & Soft Cloud Puffs
// ---------------------------------------------------------------------------

export interface AtmosphericSkyDome {
  mesh: THREE.Mesh;
  cloudInstanced: THREE.InstancedMesh;
  cloudMat: THREE.MeshBasicMaterial;
  skyMat: THREE.ShaderMaterial;
  uniforms: {
    uZenithColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uNightMix: { value: number };
    uTime: { value: number };
  };
  update: (
    elapsed: number,
    sunDir?: THREE.Vector3,
    zenithCol?: THREE.Color,
    horizonCol?: THREE.Color,
    sunCol?: THREE.Color,
    nightMix?: number,
    cloudOpacity?: number,
  ) => void;
}

export function createAtmosphericSkyDome(
  parent: THREE.Object3D,
  geometriesToDispose: THREE.BufferGeometry[],
  materialsToDispose: THREE.Material[],
  opts?: { radius?: number; isNight?: boolean; cloudCount?: number },
): AtmosphericSkyDome {
  const radius = opts?.radius ?? 680;
  const skyGeo = new THREE.SphereGeometry(radius, 32, 20);
  geometriesToDispose.push(skyGeo);

  const uniforms = {
    uZenithColor: { value: new THREE.Color(opts?.isNight ? 0x060b18 : 0x1b5eb0) },
    uHorizonColor: { value: new THREE.Color(opts?.isNight ? 0x172546 : 0x9ed0f2) },
    uSunColor: { value: new THREE.Color(opts?.isNight ? 0x94a3b8 : 0xfff1cc) },
    uSunDir: { value: new THREE.Vector3(0.55, 0.58, 0.45).normalize() },
    uNightMix: { value: opts?.isNight ? 1.0 : 0.0 },
    uTime: { value: 0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vSkyDir;
      void main() {
        vSkyDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uNightMix;
      uniform float uTime;
      varying vec3 vSkyDir;

      float starHash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vSkyDir);
        float elev = clamp(dir.y, 0.0, 1.0);
        vec3 sky = mix(uHorizonColor, uZenithColor, pow(elev, 0.55));

        // Mie horizon atmospheric scatter halo around sun azimuth
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float mieGlow = pow(sunDot, 7.0) * 0.22 * (1.0 - uNightMix * 0.65);
        float sunCore = smoothstep(0.9972, 0.9994, sunDot) * (1.0 - uNightMix * 0.4);
        float sunCorona = pow(sunDot, 72.0) * 0.34 * (1.0 - uNightMix * 0.55);

        sky += uSunColor * (mieGlow + sunCorona + sunCore * 0.92);

        // Subtle starfield on clear nights
        if (uNightMix > 0.25 && elev > 0.06) {
          vec3 grid = floor(dir * 210.0);
          float h = starHash(grid);
          if (h > 0.9935) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + h * 100.0);
            sky += vec3(0.85, 0.92, 1.0) * twinkle * smoothstep(0.25, 0.85, uNightMix) * smoothstep(0.06, 0.3, elev);
          }
        }

        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  materialsToDispose.push(skyMat);

  const mesh = new THREE.Mesh(skyGeo, skyMat);
  mesh.frustumCulled = false;
  parent.add(mesh);

  // Smooth Organic Ellipsoid Clouds (zero BoxGeometry blocks!)
  const cloudPuffCount = opts?.cloudCount ?? 42;
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  puffGeo.scale(1.85, 0.56, 1.18);
  geometriesToDispose.push(puffGeo);

  const cloudMat = new THREE.MeshBasicMaterial({
    color: opts?.isNight ? 0x1e293b : 0xe4edf5,
    transparent: true,
    opacity: opts?.isNight ? 0.24 : 0.66,
    depthWrite: false,
  });
  materialsToDispose.push(cloudMat);

  const cloudInstanced = new THREE.InstancedMesh(puffGeo, cloudMat, cloudPuffCount);
  cloudInstanced.frustumCulled = false;
  const dummy = new THREE.Object3D();

  for (let i = 0; i < cloudPuffCount; i++) {
    const cluster = Math.floor(i / 3);
    const sub = i % 3;
    const baseAngle = (cluster / Math.ceil(cloudPuffCount / 3)) * Math.PI * 2 + sub * 0.042;
    const dist = radius * (0.28 + (cluster % 4) * 0.085) + (sub - 1) * 9;
    const y = 66 + (cluster % 5) * 9 + (sub === 1 ? 2.4 : 0);
    const sx = (sub === 1 ? 10.5 : 7.8) + (cluster % 3) * 1.8;
    const sy = (sub === 1 ? 5.2 : 3.8) + (cluster % 2);
    const sz = (sub === 1 ? 7.6 : 5.4) + (cluster % 3) * 1.2;

    dummy.position.set(Math.cos(baseAngle) * dist, y, Math.sin(baseAngle) * dist);
    dummy.rotation.set(0, baseAngle, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    cloudInstanced.setMatrixAt(i, dummy.matrix);
  }
  cloudInstanced.instanceMatrix.needsUpdate = true;
  parent.add(cloudInstanced);

  return {
    mesh,
    cloudInstanced,
    cloudMat,
    skyMat,
    uniforms,
    update: (elapsed, sunDir, zenithCol, horizonCol, sunCol, nightMix, cloudOpacity) => {
      uniforms.uTime.value = elapsed;
      if (sunDir) uniforms.uSunDir.value.copy(sunDir).normalize();
      if (zenithCol) uniforms.uZenithColor.value.copy(zenithCol);
      if (horizonCol) uniforms.uHorizonColor.value.copy(horizonCol);
      if (sunCol) uniforms.uSunColor.value.copy(sunCol);
      if (nightMix !== undefined) uniforms.uNightMix.value = nightMix;
      if (cloudOpacity !== undefined) cloudMat.opacity = cloudOpacity;

      cloudInstanced.rotation.y = elapsed * 0.0045;
    },
  };
}
