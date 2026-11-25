import React from 'react';

interface HeadshotBannerProps {
  visible: boolean;
  seq: number;
}

/** Animated skull-inside-crosshair headshot banner centered cleanly above the combat crosshair. */
export const HeadshotBanner: React.FC<HeadshotBannerProps> = ({ visible, seq }) => {
  if (!visible || seq <= 0) return null;

  return (
    <div
      key={seq}
      className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 z-30 flex flex-col items-center animate-[hsPop_0.95s_cubic-bezier(0.22,1,0.36,1)_forwards]"
    >
      <style>{`
        @keyframes hsPop {
          0% { opacity: 0; transform: translate(-50%, 10px) scale(0.55); }
          18% { opacity: 1; transform: translate(-50%, -4px) scale(1.14); }
          32% { opacity: 1; transform: translate(-50%, 0px) scale(1); }
          80% { opacity: 1; transform: translate(-50%, -6px) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -14px) scale(0.92); }
        }
      `}</style>
      <div className="relative flex items-center justify-center w-20 h-20 drop-shadow-[0_0_16px_rgba(239,68,68,0.85)]">
        <svg viewBox="0 0 120 120" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer concentric segmented ring */}
          <circle cx="60" cy="60" r="46" stroke="#ffffff" strokeWidth="4" strokeDasharray="58 14" strokeDashoffset="7" />
          {/* Inner concentric segmented ring */}
          <circle cx="60" cy="60" r="37" stroke="#f87171" strokeWidth="3.5" strokeDasharray="46 12" strokeDashoffset="6" />
          {/* 4 Cardinal crosshair ticks */}
          <rect x="57" y="4" width="6" height="22" rx="1.5" fill="#ffffff" />
          <rect x="57" y="94" width="6" height="22" rx="1.5" fill="#ffffff" />
          <rect x="4" y="57" width="22" height="6" rx="1.5" fill="#ffffff" />
          <rect x="94" y="57" width="22" height="6" rx="1.5" fill="#ffffff" />
          {/* Centered tactical skull */}
          <path
            d="M60 36C47.8 36 39 44.5 39 55.5C39 61.8 42.4 66.8 46.8 69.5V75.5C46.8 77.7 48.6 79.5 50.8 79.5H69.2C71.4 79.5 73.2 77.7 73.2 75.5V69.5C77.6 66.8 81 61.8 81 55.5C81 44.5 72.2 36 60 36Z"
            fill="#ffffff"
          />
          {/* Left & right eye sockets */}
          <ellipse cx="51.5" cy="57.5" rx="5.2" ry="4.4" transform="rotate(-10 51.5 57.5)" fill="#18181b" />
          <ellipse cx="68.5" cy="57.5" rx="5.2" ry="4.4" transform="rotate(10 68.5 57.5)" fill="#18181b" />
          {/* Nasal cavity */}
          <path d="M60 62.5L56.6 68.5H63.4L60 62.5Z" fill="#18181b" />
          {/* Jaw teeth cuts */}
          <rect x="52.5" y="73.5" width="2.2" height="6" fill="#18181b" />
          <rect x="58.9" y="73.5" width="2.2" height="6" fill="#18181b" />
          <rect x="65.3" y="73.5" width="2.2" height="6" fill="#18181b" />
        </svg>
      </div>
      <div className="-mt-1 px-3 py-0.5 rounded bg-red-600/90 border border-red-300/70 shadow-[0_2px_12px_rgba(220,38,38,0.65)]">
        <span className="text-[11px] font-black tracking-[0.22em] text-white uppercase">
          HEADSHOT
        </span>
      </div>
    </div>
  );
};
