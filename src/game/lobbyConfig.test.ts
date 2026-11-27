import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPresetGraphicsPatch,
  clampDrawDistance,
  clampMusicVolume,
  clampSaturation,
  getLobbyCopy,
  LOBBY_TAB_ORDER,
  resolveGraphicsProfile,
} from './lobbyConfig';
import { DEFAULT_HUD_SETTINGS } from '../types';

test('Game boots with High quality default while keeping musicVolume out of DEFAULT_HUD_SETTINGS', () => {
  assert.equal(DEFAULT_HUD_SETTINGS.graphicsQuality, 'high');
  assert.equal(DEFAULT_HUD_SETTINGS.bloomEnabled, true);
  assert.equal('musicVolume' in DEFAULT_HUD_SETTINGS, false);
});

test('resolveGraphicsProfile respects granular overrides and guards software WebGL', () => {
  const highProfile = resolveGraphicsProfile({
    graphicsQuality: 'high',
    shadowQuality: 'medium',
    drawDistance: 1.35,
    bloomEnabled: true,
    mapSaturation: 1.65,
  });
  assert.equal(highProfile.preset, 'high');
  assert.equal(highProfile.shadowQuality, 'medium');
  assert.equal(highProfile.drawDistance, 1.35);
  assert.equal(highProfile.bloomEnabled, true);
  assert.equal(highProfile.mapSaturation, 1.65);

  const softwareFallback = resolveGraphicsProfile(DEFAULT_HUD_SETTINGS, true);
  assert.equal(softwareFallback.shadowQuality, 'off');
  assert.equal(softwareFallback.reflectionQuality, 'off');
  assert.equal(softwareFallback.bloomEnabled, false);
});

test('buildPresetGraphicsPatch maps Low / Medium / High presets accurately', () => {
  const low = buildPresetGraphicsPatch('low');
  assert.equal(low.graphicsQuality, 'low');
  assert.equal(low.shadowQuality, 'off');
  assert.equal(low.bloomEnabled, false);

  const med = buildPresetGraphicsPatch('medium');
  assert.equal(med.graphicsQuality, 'medium');
  assert.equal(med.shadowQuality, 'medium');

  const high = buildPresetGraphicsPatch('high');
  assert.equal(high.graphicsQuality, 'high');
  assert.equal(high.shadowQuality, 'high');
  assert.equal(high.reflectionQuality, 'high');
  assert.equal(high.bloomEnabled, true);
});

test('clamping helpers & multi-language lobby copy stay within safe ranges', () => {
  assert.equal(clampSaturation(0.2), 0.8);
  assert.equal(clampSaturation(2.9), 1.8);
  assert.equal(clampDrawDistance(0.1), 0.6);
  assert.equal(clampDrawDistance(5.0), 1.4);
  assert.equal(clampMusicVolume(-1), 0);
  assert.equal(clampMusicVolume(3), 1);

  assert.deepEqual(LOBBY_TAB_ORDER, ['home', 'world', 'graphics', 'settings', 'profile']);
  assert.equal(getLobbyCopy('es').tabs.graphics, 'Gráficos');
  assert.equal(getLobbyCopy('fr').tabs.world, 'Monde');
  assert.equal(getLobbyCopy('en').resumeExploration, 'Resume Exploration');
});
