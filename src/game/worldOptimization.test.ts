import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DAY_DURATION_SEC,
  EnvironmentCycleController,
  NIGHT_DURATION_SEC,
  TOTAL_CYCLE_DURATION_SEC,
} from './environmentCycle';
import { WorldStreamingController } from './worldStreaming';
import { addStairSideGuardColliders } from './buildingsAndTransit';
import type { ColliderBox } from './arena';
import { resolveCircleColliders2D } from './simulatorSystems';
import { DigitalDisplayManager } from './digitalDisplays';
import { createSplatTerrainMaterial, populateLowPolyTrees } from './realisticWorld';
import { createCompoundPalette } from './models';

test('Day/Night cycle uses 30-minute Day (1800s) and 12-minute Night (720s)', () => {
  assert.equal(DAY_DURATION_SEC, 1800);
  assert.equal(NIGHT_DURATION_SEC, 720);
  assert.equal(TOTAL_CYCLE_DURATION_SEC, 2520);

  const ctrl = new EnvironmentCycleController();
  ctrl.reset('morning', 'clear', true);
  assert.equal(ctrl.cycleDurationSec, 2520);

  // Starting at morning (timeNorm = 0.25), daytime spans [0.18..0.82) -> remaining 0.57 / 0.64 * 1800 = ~1603s
  const tStart = ctrl.timeNorm;
  ctrl.step(900); // 15 minutes
  const dtNorm = ctrl.timeNorm - tStart;
  assert.ok(Math.abs(dtNorm - 0.32) < 0.01, `15m in 30m day should advance ~0.32 norm, got ${dtNorm}`);

  // Stepping across night: 6 minutes (360s) should advance half of night's 0.36 span (= 0.18 norm)
  ctrl.setPhase('night');
  const n0 = ctrl.timeNorm;
  ctrl.step(360);
  const dn = (ctrl.timeNorm - n0 + 1) % 1;
  assert.ok(Math.abs(dn - 0.18) < 0.01, `6m in 12m night should advance ~0.18 norm, got ${dn}`);
});

test('addStairSideGuardColliders blocks sideways fall-off without blocking landings or underneath headroom', () => {
  const colliders: ColliderBox[] = [];
  addStairSideGuardColliders(colliders, {
    axis: 'z',
    centerCoord: 0,
    startCoord: 0,
    endCoord: 12,
    yBottom: 0,
    yTop: 5.0,
    width: 3.6,
  });

  // Should create 5 left + 5 right guard boxes
  assert.equal(colliders.length, 10);

  // Player mid-way up stairs at z = 6, y = 2.5 pushed outward beyond x = 1.8 should be stopped inside guard rail
  const pushedSide = resolveCircleColliders2D(1.78, 2.5, 6.0, 0.35, 1.75, colliders);
  assert.ok(pushedSide.collided && pushedSide.x < 1.68, `Left/right guard rail should keep player on stair tread (got x=${pushedSide.x})`);

  // Walking underneath the upper end of the stairs at y = 0, x = 1.8, z = 10 should pass freely!
  const underPass = resolveCircleColliders2D(1.8, 0.0, 10.0, 0.35, 1.75, colliders);
  assert.ok(!underPass.collided && Math.abs(underPass.x - 1.8) < 0.01, 'Underneath headroom at y=0 must remain unobstructed');
});

test('WorldStreamingController handles dynamic chunk loading, LOD switching, frustum & occlusion culling', () => {
  const ws = new WorldStreamingController();
  const root = new THREE.Group();
  const terrainParent = new THREE.Group();
  root.add(terrainParent);

  const highGeo = new THREE.BoxGeometry(10, 1, 10);
  const lowGeo = new THREE.BoxGeometry(2, 1, 2);
  const mat = new THREE.MeshBasicMaterial();

  // Terrain chunk near origin (visible ahead along -Z), plus far terrain chunk at z = -850
  const nearMesh = new THREE.Mesh(highGeo, mat);
  const nearChunk = ws.registerTerrainChunk({
    id: 'near',
    parent: terrainParent,
    mesh: nearMesh,
    highGeo,
    lowGeo,
    box: new THREE.Box3(new THREE.Vector3(-40, -1, -90), new THREE.Vector3(40, 2, -10)),
  });

  const midMesh = new THREE.Mesh(highGeo, mat);
  const midChunk = ws.registerTerrainChunk({
    id: 'mid',
    parent: terrainParent,
    mesh: midMesh,
    highGeo,
    lowGeo,
    box: new THREE.Box3(new THREE.Vector3(-40, -1, -350), new THREE.Vector3(40, 2, -270)),
  });

  const farMesh = new THREE.Mesh(highGeo, mat);
  const farChunk = ws.registerTerrainChunk({
    id: 'far',
    parent: terrainParent,
    mesh: farMesh,
    highGeo,
    lowGeo,
    box: new THREE.Box3(new THREE.Vector3(-40, -1, -890), new THREE.Vector3(40, 2, -810)),
  });

  // Prop chunk behind camera (+Z) -> should load but be frustum culled
  const behindHigh = new THREE.Group();
  const behindLow = new THREE.Group();
  const behindProp = ws.registerPropChunk({
    id: 'behind_prop',
    parent: root,
    highGroup: behindHigh,
    lowGroup: behindLow,
    box: new THREE.Box3(new THREE.Vector3(-10, 0, 50), new THREE.Vector3(10, 8, 70)),
    lodDist: 180,
    loadDist: 380,
    unloadDist: 450,
  });

  // Prop chunk hidden strictly behind a solid wall occluder along -Z
  ws.registerOccluder('solid_wall', -25, 0, -28, 25, 25, -24);
  const occludedHigh = new THREE.Group();
  const occludedProp = ws.registerPropChunk({
    id: 'occluded_prop',
    parent: root,
    highGroup: occludedHigh,
    lowGroup: null,
    box: new THREE.Box3(new THREE.Vector3(-6, 1, -80), new THREE.Vector3(6, 10, -70)),
    lodDist: 180,
    loadDist: 380,
    unloadDist: 450,
  });

  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1500);
  camera.position.set(0, 5, 0);
  camera.lookAt(0, 5, -50);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const stats = ws.update(camera, { x: 0, y: 0, z: 0 }, 1.0, false);

  assert.equal(nearChunk.loaded, true);
  assert.equal(nearChunk.usingLowLod, false, 'Close terrain chunk must use High-Res geometry');
  assert.equal(nearChunk.visible, true);

  assert.equal(midChunk.loaded, true);
  assert.equal(midChunk.usingLowLod, true, 'Distant loaded terrain chunk (~310m) must switch to Low-Poly geometry');

  assert.equal(farChunk.loaded, false, 'Very far terrain chunk (850m) must unload cleanly');
  assert.equal(farChunk.tileGroup.parent, null);

  assert.equal(behindProp.loaded, true);
  assert.equal(behindProp.visible, false, 'Prop chunk behind camera must be frustum culled');

  assert.equal(occludedProp.loaded, true);
  assert.equal(occludedProp.visible, false, 'Prop chunk completely behind solid occluder wall must be occlusion culled');
  assert.ok(stats.occludedCulled >= 1 && stats.frustumCulled >= 1);

  // Moving camera inside occluder or past wall reveals the previously occluded prop
  camera.position.set(0, 5, -35);
  camera.lookAt(0, 5, -80);
  camera.updateMatrixWorld(true);
  ws.update(camera, { x: 0, y: 0, z: -35 }, 1.0, false);
  assert.equal(occludedProp.visible, true, 'Prop becomes visible once camera moves past solid wall');

  highGeo.dispose();
  lowGeo.dispose();
  mat.dispose();
  ws.dispose();
});

test('DigitalDisplayManager handles disabled toggle and unmute autoplay fallback without stalling playback', async () => {
  const prevDoc = (globalThis as { document?: unknown }).document;
  const noopCtx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === 'measureText') return () => ({ width: 20 });
        return () => {};
      },
      set: () => true,
    },
  );
  const createdVideos: Array<{
    muted: boolean;
    paused: boolean;
    playCalls: number;
    addEventListener: (ev: string, fn: () => void) => void;
    play: () => Promise<void>;
    pause: () => void;
    load: () => void;
    setAttribute: () => void;
    style: { cssText: string };
    preload: string;
    loop: boolean;
    playsInline: boolean;
    autoplay: boolean;
    readyState: number;
    videoWidth: number;
    videoHeight: number;
    volume: number;
    src: string;
  }> = [];

  (globalThis as { document?: unknown }).document = {
    body: { appendChild: () => {} },
    createElement: (tag: string) => {
      if (tag === 'video') {
        const vid = {
          muted: true,
          paused: false,
          playCalls: 0,
          preload: 'auto',
          loop: false,
          playsInline: true,
          autoplay: true,
          readyState: 4,
          videoWidth: 1280,
          videoHeight: 720,
          volume: 0,
          src: '',
          style: { cssText: '' },
          setAttribute: () => {},
          addEventListener: () => {},
          load: () => {},
          pause: function () {
            this.paused = true;
          },
          play: function () {
            this.playCalls++;
            if (!this.muted) {
              return Promise.reject(new Error('Autoplay with sound blocked'));
            }
            this.paused = false;
            return Promise.resolve();
          },
        };
        createdVideos.push(vid);
        return vid;
      }
      if (tag === 'div') {
        return { style: { cssText: '' }, setAttribute: () => {}, appendChild: () => {}, remove: () => {} };
      }
      return { width: 512, height: 256, getContext: () => noopCtx };
    },
  };

  try {
    const mgr = new DigitalDisplayManager();
    const { MAIN_SCREEN_VIDEO_URL } = await import('./lobbyConfig');
    const d1 = mgr.createVideoDisplayMaterial([MAIN_SCREEN_VIDEO_URL], 'shopping_mall', { worldPos: { x: 0, y: 2, z: 0 } });
    const d2 = mgr.createVideoDisplayMaterial([MAIN_SCREEN_VIDEO_URL], 'car_second_lcd', { worldPos: { x: 40, y: 2, z: 0 } });

    d1.entry.disabled = true;
    mgr.update(1.0, 0.05, new THREE.Vector3(0, 2, 2));
    // Wait a tick for rejected unmute promise fallback to resolve
    await new Promise((r) => setTimeout(r, 15));

    assert.equal(createdVideos[0].muted, true, 'Blocked unmute autoplay must cleanly fall back to muted playback');
    assert.equal(createdVideos[0].paused, false, 'Video must stay playing for active sibling screen when one screen is off');
    assert.equal(d2.entry.disabled, undefined);
    mgr.dispose();
  } finally {
    if (prevDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDoc;
    }
  }
});

test('populateLowPolyTrees merges trunk and crown cleanly for both deciduous and pine trees', () => {
  const parent = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const placements = [
    { x: 10, y: 0, z: 15, scale: 1.0, rotY: 0.5 },
    { x: -12, y: 0.2, z: -8, scale: 1.2, rotY: 1.8 },
  ];

  const dec = populateLowPolyTrees(parent, placements, geos, mats, { pine: false });
  assert.ok(dec !== null, 'Deciduous low-poly tree InstancedMesh must succeed');
  assert.ok(dec.geometry && dec.boundingSphere && dec.boundingSphere.radius > 0);

  const pine = populateLowPolyTrees(parent, placements, geos, mats, { pine: true });
  assert.ok(pine !== null, 'Pine low-poly tree InstancedMesh must succeed');
  assert.ok(pine.geometry && pine.boundingSphere && pine.boundingSphere.radius > 0);

  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
});

test('WorldStreamingController.optimizeStaticChunks batches static opaque meshes while preserving screens and shootableEnv', () => {
  const ws = new WorldStreamingController();
  const root = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(1, 2, 1);
  const opaqueMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });

  const b1 = new THREE.Mesh(boxGeo, opaqueMat);
  b1.position.set(10, 1, 10);
  const b2 = new THREE.Mesh(boxGeo, opaqueMat);
  b2.position.set(16, 1, 14);
  const b3 = new THREE.Mesh(boxGeo, opaqueMat);
  b3.position.set(22, 1, 18);

  const screenMesh = new THREE.Mesh(boxGeo, opaqueMat);
  screenMesh.position.set(12, 3, 12);
  screenMesh.userData.isDigitalScreen = true;

  const glassMesh = new THREE.Mesh(boxGeo, glassMat);
  glassMesh.position.set(14, 2, 12);

  root.add(b1, b2, b3, screenMesh, glassMesh);
  const shootableEnv: THREE.Object3D[] = [b1, glassMesh];

  ws.partitionStaticChildren(root, { idPrefix: 'test_city', cellSize: 190 });
  const saved = ws.optimizeStaticChunks(shootableEnv);

  assert.equal(saved, 2, '3 static opaque meshes with identical material merge into 1 (2 draw calls saved)');
  assert.ok(screenMesh.parent !== null, 'Digital screen mesh must not be merged away');
  assert.ok(glassMesh.parent !== null, 'Transparent glass mesh must not be merged away');
  assert.ok(
    shootableEnv.some((o) => o instanceof THREE.Mesh && o.name.startsWith('batched_')),
    'Merged batch mesh must remain shootable when source meshes were shootable',
  );

  boxGeo.dispose();
  opaqueMat.dispose();
  glassMat.dispose();
  ws.dispose();
});

test('Quality tiers use MeshLambertMaterial on Low/Medium and preserve MeshStandardMaterial + 260m video range on High', () => {
  const lowPal = createCompoundPalette(undefined, false, 'low');
  const medPal = createCompoundPalette(undefined, false, 'medium');
  const highPal = createCompoundPalette(undefined, false, 'high');

  assert.ok(lowPal.wallWhite instanceof THREE.MeshLambertMaterial);
  assert.ok(medPal.wallWhite instanceof THREE.MeshLambertMaterial);
  assert.ok(highPal.wallWhite instanceof THREE.MeshStandardMaterial, 'High quality must remain MeshStandardMaterial');

  const dummyTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const stubTextures = {
    terrainAlbedo: dummyTex,
  } as unknown as import('./textures').ProceduralTextureSet;
  const medTerrain = createSplatTerrainMaterial(stubTextures, { graphicsQuality: 'medium' });
  const highTerrain = createSplatTerrainMaterial(stubTextures, { graphicsQuality: 'high' });

  assert.ok(medTerrain.material instanceof THREE.MeshLambertMaterial);
  assert.ok(highTerrain.material instanceof THREE.MeshStandardMaterial, 'High terrain must remain PBR MeshStandardMaterial');

  dummyTex.dispose();
  medTerrain.material.dispose();
  highTerrain.material.dispose();
  lowPal.dispose();
  medPal.dispose();
  highPal.dispose();

  const prevDoc = (globalThis as { document?: unknown }).document;
  const noopCtx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === 'measureText') return () => ({ width: 20 });
        return () => {};
      },
      set: () => true,
    },
  );
  const videoStub = {
    muted: true,
    paused: false,
    readyState: 4,
    videoWidth: 1280,
    videoHeight: 720,
    volume: 0,
    src: '',
    style: { cssText: '' },
    setAttribute: () => {},
    addEventListener: () => {},
    load: () => {},
    pause: function () {
      this.paused = true;
    },
    play: function () {
      this.paused = false;
      return Promise.resolve();
    },
    remove: () => {},
    removeAttribute: () => {},
  };
  (globalThis as { document?: unknown }).document = {
    body: { appendChild: () => {} },
    createElement: (tag: string) =>
      tag === 'video'
        ? { ...videoStub }
        : tag === 'div'
          ? { style: { cssText: '' }, setAttribute: () => {}, appendChild: () => {}, remove: () => {} }
          : { width: 512, height: 256, getContext: () => noopCtx },
  };

  try {
    const mgr = new DigitalDisplayManager();
    const dFar = mgr.createVideoDisplayMaterial(['./assets/aistudio/Grand_Theft_Auto_VI__An_Extended_Look___Now_Playing_720P_HD__3f882ce6.mp4'], 'shopping_mall', {
      worldPos: { x: 180, y: 2, z: 0 },
    });
    const cam = { x: 0, y: 2, z: 0 };

    // On Low/Medium at 180m, video draw should be skipped (beyond 28m/48m range)
    mgr.update(1.0, 0.05, cam, null, 2.6, 'low');
    assert.equal(dFar.entry.lastDrawTime < 0, true, 'Low quality skips distant (180m) video draws');

    mgr.update(2.0, 0.05, cam, null, 1.8, 'medium');
    assert.equal(dFar.entry.lastDrawTime < 0, true, 'Medium quality skips distant (180m) video draws');

    // On High at 180m (< 260m), video draw remains active just as before
    mgr.update(3.0, 0.05, cam, null, 1.0, 'high');
    assert.equal(dFar.entry.lastDrawTime, 3.0, 'High quality preserves full 260m video display range');
    mgr.dispose();
  } finally {
    if (prevDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDoc;
    }
  }
});

