import React, { useState } from 'react';
import { Globe2, Home, SlidersHorizontal, Sparkles, UserCircle2 } from 'lucide-react';
import { LOBBY_TAB_ORDER, type LobbyCopyDictionary, type LobbyTabId } from '../../game/lobbyConfig';

interface LobbyNavDockProps {
  activeTab: LobbyTabId;
  onSelectTab: (tab: LobbyTabId) => void;
  copy: LobbyCopyDictionary;
}

const TAB_META: Record<
  LobbyTabId,
  {
    Icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }
> = {
  home: { Icon: Home, accent: 'from-cyan-400 to-sky-500' },
  world: { Icon: Globe2, accent: 'from-sky-400 to-indigo-500' },
  graphics: { Icon: Sparkles, accent: 'from-amber-400 to-orange-500' },
  settings: { Icon: SlidersHorizontal, accent: 'from-cyan-300 to-teal-400' },
  profile: { Icon: UserCircle2, accent: 'from-orange-400 to-amber-400' },
};

export const LobbyNavDock: React.FC<LobbyNavDockProps> = ({ activeTab, onSelectTab, copy }) => {
  const [rippleTab, setRippleTab] = useState<{ id: LobbyTabId; key: number } | null>(null);
  const activeIndex = Math.max(0, LOBBY_TAB_ORDER.indexOf(activeTab));

  const handlePress = (tab: LobbyTabId) => {
    setRippleTab({ id: tab, key: Date.now() });
    onSelectTab(tab);
  };

  return (
    <>
      {/* Desktop & Tablet: Floating Vertical 3D Liquid Glass Sidebar */}
      <nav
        aria-label="Lobby navigation"
        className="hidden md:flex flex-col justify-between liquid-glass-shell liquid-prism-edge rounded-3xl p-2.5 w-[212px] shrink-0 select-none"
      >
        <div className="space-y-1.5 relative">
          {/* Animated vertical glowing active beam */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 h-[54px] rounded-2xl transition-transform duration-300 ease-out"
            style={{
              transform: `translate3d(0, ${activeIndex * 60}px, 0)`,
              background:
                'linear-gradient(125deg, rgba(56,189,248,0.22) 0%, rgba(14,165,233,0.12) 55%, rgba(249,115,22,0.18) 100%)',
              border: '1px solid rgba(125,211,252,0.48)',
              boxShadow:
                '0 8px 24px rgba(14,165,233,0.22), inset 0 1px 0 rgba(255,255,255,0.34)',
            }}
          >
            <div className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full bg-gradient-to-b from-cyan-300 via-sky-400 to-orange-400 shadow-[0_0_12px_#38bdf8]" />
          </div>

          {LOBBY_TAB_ORDER.map((tab) => {
            const { Icon, accent } = TAB_META[tab];
            const isActive = activeTab === tab;
            const showRipple = rippleTab?.id === tab;
            return (
              <button
                key={tab}
                type="button"
                data-testid={`lobby-tab-${tab}`}
                onClick={() => handlePress(tab)}
                className={`relative overflow-hidden w-full h-[54px] px-3 rounded-2xl flex items-center gap-3 text-left transition-all duration-200 cursor-pointer group ${
                  isActive ? 'text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {showRipple && (
                  <span
                    key={rippleTab.key}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-cyan-300/35"
                    style={{ animation: 'liquidRipple 480ms ease-out forwards' }}
                  />
                )}
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'liquid-glass-icon-3d-active text-white'
                      : 'liquid-glass-icon-3d text-slate-200 group-hover:scale-105'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] transition-transform duration-300 ${
                      isActive ? 'scale-110 -rotate-3' : 'group-hover:scale-105'
                    }`}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold tracking-wide truncate">
                    {copy.tabs[tab]}
                  </div>
                  {isActive && (
                    <div
                      className={`h-0.5 w-8 mt-0.5 rounded-full bg-gradient-to-r ${accent}`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-white/10 px-2 pb-1">
          <div className="text-[11px] font-semibold text-cyan-300/90 tracking-wide">
            MEGA-WORLD OS
          </div>
          <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
            Live 3D Engine Active
          </div>
        </div>
      </nav>

      {/* Mobile (< md): Bottom Liquid Glass Floating Dock Bar */}
      <nav
        aria-label="Mobile lobby dock"
        className="flex md:hidden items-center justify-between liquid-glass-shell liquid-prism-edge rounded-2xl px-2 py-1.5 w-full shrink-0 select-none relative"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1.5 bottom-1.5 left-2 rounded-xl transition-transform duration-300 ease-out"
          style={{
            width: `calc((100% - 16px) / ${LOBBY_TAB_ORDER.length})`,
            transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
            background:
              'linear-gradient(145deg, rgba(56,189,248,0.28) 0%, rgba(249,115,22,0.2) 100%)',
            border: '1px solid rgba(125,211,252,0.52)',
            boxShadow: '0 4px 18px rgba(56,189,248,0.25), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        />
        {LOBBY_TAB_ORDER.map((tab) => {
          const { Icon } = TAB_META[tab];
          const isActive = activeTab === tab;
          const showRipple = rippleTab?.id === tab;
          return (
            <button
              key={tab}
              type="button"
              data-testid={`lobby-mobile-tab-${tab}`}
              onClick={() => handlePress(tab)}
              className="relative flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 rounded-xl z-10 cursor-pointer"
            >
              {showRipple && (
                <span
                  key={rippleTab.key}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-cyan-300/40"
                  style={{ animation: 'liquidRipple 420ms ease-out forwards' }}
                />
              )}
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'liquid-glass-icon-3d-active text-white -translate-y-1 scale-110'
                    : 'text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <span
                className={`text-[10px] font-semibold tracking-tight truncate max-w-[66px] ${
                  isActive ? 'text-cyan-200' : 'text-slate-400'
                }`}
              >
                {copy.tabs[tab]}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
