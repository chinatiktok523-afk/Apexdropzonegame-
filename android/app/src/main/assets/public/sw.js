/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "24dc1a1a0c728a74ef0b1a341b3de2a6"
  }, {
    "url": "icon.svg",
    "revision": "300d31e1f86010cbfcaec21adf3d6c3b"
  }, {
    "url": "favicon.ico",
    "revision": "c2377cfaa8d2b6a91a425d8a3b737ada"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/web-MdfVpAak.js",
    "revision": null
  }, {
    "url": "assets/web-DJ3_VGvZ.js",
    "revision": null
  }, {
    "url": "assets/three-3to5c06Y.js",
    "revision": null
  }, {
    "url": "assets/react-vendor-Cr6lJ2mJ.js",
    "revision": null
  }, {
    "url": "assets/index-DzYZFqnk.js",
    "revision": null
  }, {
    "url": "assets/index-DT0LL_z5.css",
    "revision": null
  }, {
    "url": "assets/icons-C3ZbFaEO.js",
    "revision": null
  }, {
    "url": "assets/firebase-DR2l3c5a.js",
    "revision": null
  }, {
    "url": "assets/aistudio/solo-handgun-fire-3-3_b1e432f8.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/police_siren_MP3_160K__b018c807.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/pistol_sound_effects__desert_eagle_sound_effects_gun_sound_effects_MP3_160K__3edb41aa.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/pistol_975c178b.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/party_dj_music_2.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/party_dj_music_1.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/mansion_engine_tokyo.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/mansion_engine_3.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/mansion_engine_2.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/mansion_engine_1.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/long-distance-gunfire-sounds-6_bd442a47.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/gun-shots-230534_adf5e718.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/genuine-m60-shooting_221e68e1.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/foisal72-gun-fire-346766_6d744d3c.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/drum_explosion_92bda242.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/distant-gunshot-sound-12_69dbfa0b.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/car_engine_start.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/car_beep_new.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/car_backfire_kit.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/beretta-92fs-handgun_25b839d2.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/authentic-gunshot-sounds_94e7187e.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/ak47-sound-effects_b6bd3d36.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Sound_Effects_-_Footsteps_MP3_160K__dcb3e53c.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/SMG_-_Sound_Effect__Roblox__MP3_160K__7097d3a4.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Realistic_Helicopter_Sound_Effect_MP3_160K__23a578d1.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Realistic_Gun_Sound_Effects___Bullets_Falling_MP3_160K__51f0318b.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/PL-K_b1628441.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Outdoor_General_Ambience_Short_Sound_Effect_MP3_160K__725acaf0.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Headshot-sound-effect_e060a5b2.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Grenade_-_Sound_Effect__Roblox__MP3_160K__1d4b7584.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Double_barrel_shotgun_sound_effects_4213bede.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Car_Horn_Sound_Effect___Car_Horn_Traffic_Sound_Effect_MP3_160K__e32afc20.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Big_Explosion_Sound_Effect_MP3_160K__d9bb7f82.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/Ak-47___AKM_Sound_Effect__gunsound__real__ytshorts__viral_MP3_160K__19db8db8.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/40_Smith_wesson_single___Royalty_Free_Sound_Effects_MP3_160K__7403a81a.mp3",
    "revision": null
  }, {
    "url": "assets/aistudio/23332-50kb_a46294ed.jpeg",
    "revision": null
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "bd07d0c61bf648e75bfc59f754ebd634"
  }, {
    "url": "pwa-512x512.png",
    "revision": "82b75933fc09f10636539b53305000fb"
  }, {
    "url": "pwa-192x192.png",
    "revision": "aaa9476918395c2e34e00bbbcec756bc"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "557d8d6d07e53e1e6f0b0f4e6ee23f5f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "557d8d6d07e53e1e6f0b0f4e6ee23f5f"
  }, {
    "url": "favicon.ico",
    "revision": "c2377cfaa8d2b6a91a425d8a3b737ada"
  }, {
    "url": "icon.svg",
    "revision": "300d31e1f86010cbfcaec21adf3d6c3b"
  }, {
    "url": "pwa-192x192.png",
    "revision": "aaa9476918395c2e34e00bbbcec756bc"
  }, {
    "url": "pwa-512x512.png",
    "revision": "82b75933fc09f10636539b53305000fb"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "bd07d0c61bf648e75bfc59f754ebd634"
  }, {
    "url": "manifest.webmanifest",
    "revision": "e9dea5dcff5345321f4117060721264f"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api/, /^\/ws/]
  }));
  workbox.registerRoute(/\/assets\/aistudio\/.*\.(mp3|jpeg|jpg|png|webp)$/i, new workbox.CacheFirst({
    "cacheName": "apex-local-assets",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
