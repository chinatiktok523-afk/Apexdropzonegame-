import React from 'react';
import { WeaponId } from '../types';

interface WeaponArtProps {
  weaponId: WeaponId;
  className?: string;
}

/** Crisp side-profile tactical silhouette artwork for every weapon in the Gun Switch & Armory UI. */
export const WeaponArt: React.FC<WeaponArtProps> = ({ weaponId, className = 'w-20 h-9' }) => {
  switch (weaponId) {
    case 'pistol':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* M17 Coyote Tan Slide + Frame */}
          <rect x="40" y="16" width="76" height="14" rx="2" fill="#c29b6b" stroke="#292524" strokeWidth="1.5" />
          <rect x="44" y="12" width="18" height="4" rx="1" fill="#1c1917" />
          <rect x="42" y="30" width="72" height="5" rx="1" fill="#b08959" />
          <path d="M46 34 L38 56 L54 56 L60 34 Z" fill="#b58d5d" stroke="#292524" strokeWidth="1.5" />
          <path d="M62 34 L62 43 L76 43 L76 34" stroke="#44403c" strokeWidth="2.2" />
          <rect x="116" y="19" width="6" height="8" rx="1" fill="#292524" />
          <line x1="94" y1="32" x2="108" y2="32" stroke="#292524" strokeWidth="2" />
        </svg>
      );

    case 'smg':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* HK MP7A2 PDW */}
          <rect x="14" y="25" width="24" height="5" rx="1" fill="#3f3f46" />
          <rect x="12" y="22" width="6" height="14" rx="1.5" fill="#18181b" />
          <rect x="38" y="20" width="68" height="16" rx="2.5" fill="#27272a" stroke="#52525b" strokeWidth="1.2" />
          <rect x="106" y="22" width="38" height="10" rx="2" fill="#18181b" />
          <rect x="52" y="13" width="24" height="7" rx="1.5" fill="#18181b" stroke="#71717a" strokeWidth="1" />
          <circle cx="64" cy="16.5" r="1.8" fill="#ef4444" />
          <path d="M58 36 L52 57 L64 57 L70 36 Z" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <rect x="86" y="36" width="8" height="14" rx="1.5" fill="#3f3f46" />
        </svg>
      );

    case 'm4a1':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* M4A1 SOPMOD Carbine */}
          <path d="M12 24 L36 22 L36 35 L10 38 Z" fill="#1f2937" stroke="#4b5563" strokeWidth="1" />
          <rect x="36" y="25" width="12" height="5" fill="#374151" />
          <rect x="48" y="21" width="44" height="14" rx="1.5" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <rect x="92" y="22" width="36" height="9" rx="1" fill="#27272a" stroke="#52525b" strokeWidth="1" />
          <rect x="128" y="24.5" width="24" height="3.5" fill="#09090b" />
          <polygon points="118,22 122,14 125,22" fill="#3f3f46" />
          <rect x="58" y="14" width="22" height="7" rx="1.5" fill="#27272a" stroke="#71717a" strokeWidth="1" />
          <path d="M50 35 L44 51 L53 51 L58 35 Z" fill="#18181b" />
          <path d="M70 35 L74 55 L84 53 L80 35 Z" fill="#27272a" stroke="#52525b" strokeWidth="1" />
          <rect x="100" y="31" width="7" height="14" rx="1.5" fill="#18181b" />
        </svg>
      );

    case 'hk416':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* HK416D Tactical */}
          <path d="M10 22 L36 21 L36 36 L10 39 Z" fill="#27272a" stroke="#52525b" strokeWidth="1.1" />
          <rect x="36" y="24" width="12" height="6" fill="#3f3f46" />
          <rect x="48" y="20" width="46" height="15" rx="1.5" fill="#18181b" stroke="#71717a" strokeWidth="1" />
          <rect x="94" y="20" width="38" height="11" rx="1" fill="#27272a" stroke="#71717a" strokeWidth="1" />
          <rect x="132" y="23.5" width="20" height="4" fill="#18181b" />
          <rect x="148" y="22.5" width="6" height="6" rx="1" fill="#3f3f46" />
          <rect x="60" y="13" width="26" height="7" rx="1.5" fill="#18181b" stroke="#9ca3af" strokeWidth="1" />
          <rect x="108" y="16" width="14" height="4" rx="1" fill="#3f3f46" />
          <path d="M51 35 L45 52 L54 52 L59 35 Z" fill="#18181b" />
          <path d="M72 35 L75 56 L86 54 L83 35 Z" fill="#27272a" stroke="#52525b" strokeWidth="1" />
          <rect x="104" y="31" width="7" height="12" rx="1.5" fill="#27272a" />
        </svg>
      );

    case 'hk416_cqb':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* HK416C PDW Breacher */}
          <rect x="18" y="24" width="28" height="3.5" fill="#52525b" />
          <rect x="16" y="21" width="5" height="16" rx="1" fill="#18181b" />
          <rect x="46" y="21" width="44" height="14" rx="1.5" fill="#27272a" stroke="#71717a" strokeWidth="1" />
          <rect x="90" y="21.5" width="26" height="11" rx="1" fill="#3f3f46" />
          <rect x="116" y="24" width="24" height="6.5" rx="2" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <rect x="62" y="14" width="16" height="7" rx="1.5" fill="#18181b" stroke="#60a5fa" strokeWidth="1" />
          <path d="M50 35 L45 52 L54 52 L58 35 Z" fill="#18181b" />
          <path d="M70 35 L73 55 L83 54 L80 35 Z" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <rect x="98" y="32.5" width="6" height="11" rx="1" fill="#27272a" />
        </svg>
      );

    case 'm27_iar':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* HK M27 IAR Heavy Barrel */}
          <path d="M8 22 L34 21 L34 36 L8 39 Z" fill="#1f2937" stroke="#52525b" strokeWidth="1" />
          <rect x="34" y="24" width="12" height="5.5" fill="#3f3f46" />
          <rect x="46" y="20" width="44" height="15" rx="1.5" fill="#18181b" stroke="#71717a" strokeWidth="1" />
          <rect x="90" y="20.5" width="40" height="10" rx="1" fill="#27272a" />
          <rect x="130" y="23.5" width="24" height="3.5" fill="#18181b" />
          <rect x="56" y="13" width="26" height="7" rx="1.5" fill="#27272a" stroke="#fb923c" strokeWidth="1" />
          <path d="M49 35 L43 52 L52 52 L57 35 Z" fill="#18181b" />
          <path d="M68 35 L72 58 L83 56 L79 35 Z" fill="#27272a" stroke="#71717a" strokeWidth="1" />
          <line x1="118" y1="30.5" x2="128" y2="48" stroke="#52525b" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'm7':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* M7 NGSW Coyote Tan + LPVO + Suppressor */}
          <path d="M10 22 L38 22 L38 35 L10 38 Z" fill="#a68153" stroke="#44403c" strokeWidth="1" />
          <rect x="38" y="24" width="10" height="5" fill="#785e3b" />
          <rect x="48" y="20" width="44" height="15" rx="1.5" fill="#b8905f" stroke="#44403c" strokeWidth="1" />
          <rect x="92" y="21" width="32" height="10" rx="1" fill="#a68153" stroke="#44403c" strokeWidth="1" />
          <rect x="124" y="22.5" width="30" height="7" rx="2" fill="#7c6343" stroke="#44403c" strokeWidth="1" />
          {/* LPVO Optic */}
          <rect x="52" y="12" width="36" height="6.5" rx="2" fill="#57534e" stroke="#292524" strokeWidth="1" />
          <rect x="64" y="18.5" width="12" height="2" fill="#292524" />
          <path d="M50 35 L45 52 L54 52 L58 35 Z" fill="#785e3b" />
          <rect x="70" y="35" width="12" height="19" rx="1.5" fill="#9a774b" stroke="#44403c" strokeWidth="1" />
        </svg>
      );

    case 'xm8':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* XM8 Futuristic Tan/Olive Carbine */}
          <path d="M10 23 L38 21 L40 36 L10 38 Z" fill="#a89f82" stroke="#44403c" strokeWidth="1" />
          <path d="M40 20 L124 21 L120 34 L40 35 Z" fill="#c2b89b" stroke="#44403c" strokeWidth="1.1" />
          {/* Integrated Carry Rail + Optic */}
          <path d="M52 20 L58 12 L94 12 L100 20 Z" fill="#57534e" stroke="#292524" strokeWidth="1" />
          <circle cx="80" cy="16" r="2.2" fill="#34d399" />
          <rect x="122" y="25" width="26" height="4" rx="1" fill="#27272a" />
          <path d="M54 35 L49 52 L58 52 L62 35 Z" fill="#3f3f46" />
          <path d="M72 35 L77 56 L87 54 L83 35 Z" fill="#44403c" />
        </svg>
      );

    case 'm16':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* M16A4 Fixed Stock + 20" Rifle Barrel + Carry Handle */}
          <polygon points="8,24 44,23 44,36 8,42" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <rect x="44" y="21" width="44" height="14" rx="1" fill="#27272a" stroke="#52525b" strokeWidth="1" />
          <path d="M52 21 L55 13 L82 13 L85 21" stroke="#3f3f46" strokeWidth="3.5" />
          <rect x="88" y="21.5" width="38" height="10" rx="1" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <rect x="126" y="24.5" width="28" height="3.2" fill="#18181b" />
          <polygon points="122,22 125,13 128,22" fill="#3f3f46" />
          <path d="M48 35 L42 52 L51 52 L56 35 Z" fill="#18181b" />
          <path d="M68 35 L72 54 L82 52 L79 35 Z" fill="#3f3f46" />
        </svg>
      );

    case 'mk17':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* MK17 SCAR-H FDE Boot Stock + Straight 7.62 Mag */}
          <path d="M8 21 L38 22 L38 35 L10 42 L8 32 Z" fill="#c79f66" stroke="#44403c" strokeWidth="1.1" />
          <rect x="38" y="19" width="84" height="14" rx="1.5" fill="#d4ac73" stroke="#44403c" strokeWidth="1.1" />
          <rect x="122" y="23.5" width="30" height="4" fill="#27272a" />
          <rect x="60" y="12" width="26" height="7" rx="1.5" fill="#57534e" stroke="#292524" strokeWidth="1" />
          <path d="M48 33 L42 52 L51 52 L57 33 Z" fill="#44403c" />
          <rect x="69" y="33" width="14" height="21" rx="1" fill="#b48a54" stroke="#44403c" strokeWidth="1" />
        </svg>
      );

    case 'mcx':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* SIG MCX Virtus Skeleton Stock + Suppressed Barrel */}
          <path d="M10 22 L38 23 L38 27 L14 37 L10 37 Z" fill="#8f7351" stroke="#3f3f46" strokeWidth="1" />
          <rect x="38" y="20" width="48" height="14" rx="1.5" fill="#b29268" stroke="#44403c" strokeWidth="1" />
          <rect x="86" y="20.5" width="38" height="10.5" rx="1.5" fill="#9a7d58" stroke="#44403c" strokeWidth="1" />
          <rect x="124" y="22.5" width="28" height="6.5" rx="2" fill="#27272a" stroke="#52525b" strokeWidth="1" />
          <rect x="58" y="13" width="20" height="7" rx="1.5" fill="#3f3f46" stroke="#22d3ee" strokeWidth="1" />
          <path d="M48 34 L43 52 L52 52 L56 34 Z" fill="#27272a" />
          <path d="M68 34 L71 55 L81 53 L78 34 Z" fill="#7c6345" stroke="#44403c" strokeWidth="1" />
        </svg>
      );

    case 'm249':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* M249 SAW LMG + 100-rd Box Magazine + Bipod */}
          <path d="M8 22 L38 21 L38 35 L10 39 Z" fill="#18181b" stroke="#52525b" strokeWidth="1" />
          <rect x="38" y="18" width="54" height="16" rx="1.5" fill="#27272a" stroke="#71717a" strokeWidth="1" />
          <rect x="92" y="20" width="32" height="11" rx="1" fill="#3f3f46" />
          <rect x="124" y="23" width="28" height="4.5" fill="#18181b" />
          <rect x="46" y="11" width="16" height="7" rx="1.5" fill="#18181b" stroke="#fb923c" strokeWidth="1" />
          {/* 100-rd Belt Box */}
          <rect x="64" y="34" width="26" height="20" rx="2" fill="#365314" stroke="#65a30d" strokeWidth="1" />
          {/* Brass Ammo Belt Hint */}
          <rect x="70" y="28" width="14" height="5" rx="1" fill="#eab308" />
          <path d="M46 34 L41 51 L50 51 L54 34 Z" fill="#18181b" />
          <line x1="112" y1="31" x2="124" y2="52" stroke="#52525b" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );

    case 'sniper':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* M110A1 SDMR Tan Precision + Long Scope + Suppressor */}
          <path d="M6 23 L34 22 L34 36 L8 40 Z" fill="#9c7a4c" stroke="#44403c" strokeWidth="1" />
          <rect x="34" y="21" width="46" height="14" rx="1.5" fill="#b48f5c" stroke="#44403c" strokeWidth="1" />
          <rect x="80" y="21.5" width="40" height="9" rx="1" fill="#a07d4f" />
          <rect x="120" y="22.5" width="34" height="6.5" rx="2" fill="#27272a" stroke="#52525b" strokeWidth="1" />
          {/* Precision Optic */}
          <rect x="44" y="11" width="42" height="7" rx="2" fill="#27272a" stroke="#f97316" strokeWidth="1" />
          <rect x="54" y="18" width="22" height="3" fill="#18181b" />
          <path d="M44 35 L39 52 L48 52 L53 35 Z" fill="#27272a" />
          <rect x="63" y="35" width="12" height="15" rx="1" fill="#7c6240" />
          <line x1="108" y1="30.5" x2="117" y2="49" stroke="#52525b" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'shotgun':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* M870 Tactical Pump Shotgun */}
          <path d="M8 31 L42 23 L44 34 L12 46 Z" fill="#27272a" stroke="#52525b" strokeWidth="1" />
          <rect x="42" y="22" width="40" height="13" rx="1.5" fill="#18181b" stroke="#71717a" strokeWidth="1" />
          <rect x="82" y="22.5" width="66" height="4.5" fill="#3f3f46" />
          <rect x="82" y="28" width="54" height="4" fill="#27272a" />
          {/* Pump Forend */}
          <rect x="92" y="27.5" width="28" height="8.5" rx="2" fill="#52525b" stroke="#9ca3af" strokeWidth="1" />
          <rect x="52" y="17" width="14" height="5" rx="1" fill="#18181b" stroke="#fde047" strokeWidth="1" />
        </svg>
      );

    case 'rocket':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* RPG-7V2 Tube + Wooden Heatshield + PG-7VL Warhead */}
          <rect x="10" y="26" width="100" height="8" rx="1.5" fill="#3f4d36" stroke="#657c56" strokeWidth="1" />
          <rect x="44" y="25" width="38" height="10" rx="2" fill="#854d0e" stroke="#a16207" strokeWidth="1" />
          <path d="M110 25 L126 20 L148 30 L126 40 L110 35 Z" fill="#4d5e41" stroke="#84cc16" strokeWidth="1" />
          <rect x="10" y="24" width="10" height="12" rx="1" fill="#27272a" />
          <path d="M52 35 L48 51 L57 51 L61 35 Z" fill="#18181b" />
          <path d="M84 35 L82 49 L90 49 L92 35 Z" fill="#18181b" />
        </svg>
      );

    case 'unarmed':
      return (
        <svg viewBox="0 0 160 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Open Hands / Unarmed Explore Silhouette */}
          <path
            d="M66 54 L66 31 C66 28.5 68 27 70 27 C72 27 73 28.5 73 31 L73 18 C73 15.5 75 14 77 14 C79 14 80.5 15.5 80.5 18 L80.5 14 C80.5 11.5 82.5 10 84.5 10 C86.5 10 88 11.5 88 14 L88 18 C88 15.5 90 14 92 14 C94 14 95.5 15.5 95.5 18 L95.5 34 L99 28 C100.5 25.5 103.5 25.5 104.5 27.5 C105.5 29.5 104.5 32 103 34.5 L96 46 C94 50.5 90 54 84 54 Z"
            fill="#e2e8f0"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line x1="73" y1="31" x2="73" y2="36" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="80.5" y1="18" x2="80.5" y2="34" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="88" y1="18" x2="88" y2="34" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
};
