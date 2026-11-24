// ภาพประกอบภูเขา + ธง (สื่อถึง "Small steps, Big progress") — วาดด้วย SVG
export function MountainArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 220" preserveAspectRatio="xMaxYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dbe8fb" stopOpacity="0" />
          <stop offset="1" stopColor="#cfe0f6" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7aa3d6" /><stop offset="1" stopColor="#a9c4e6" />
        </linearGradient>
        <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d6aa8" /><stop offset="1" stopColor="#6f95c9" />
        </linearGradient>
        <linearGradient id="m3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e4a82" /><stop offset="1" stopColor="#3b6aa6" />
        </linearGradient>
      </defs>
      <rect width="600" height="220" fill="url(#sky)" />
      <circle cx="470" cy="62" r="26" fill="#fff6dd" opacity="0.9" />
      <path d="M120 220 L260 96 L330 150 L410 70 L520 160 L600 120 L600 220 Z" fill="url(#m1)" opacity="0.7" />
      <path d="M200 220 L330 120 L380 158 L455 52 L560 172 L600 150 L600 220 Z" fill="url(#m2)" />
      <path d="M455 52 L478 86 L466 82 L455 96 L444 80 L432 88 Z" fill="#fff" opacity="0.9" />
      <path d="M260 220 L360 168 L420 196 L500 140 L600 200 L600 220 Z" fill="url(#m3)" />
      <line x1="455" y1="52" x2="455" y2="22" stroke="#14335e" strokeWidth="2" />
      <path d="M455 22 L478 29 L455 36 Z" fill="#1fa463" />
      <path d="M300 205 q30 -18 60 -6 t70 -10 t60 -14" stroke="#fff" strokeWidth="2" strokeDasharray="3 6" fill="none" opacity="0.8" />
    </svg>
  );
}

export function LeafArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <g fill="none" stroke="#1fa463" strokeOpacity="0.35" strokeWidth="1.5">
        <path d="M40 190 C 60 120, 110 80, 170 40" />
        <path d="M70 150 c -30 -6 -46 -26 -48 -54 c 28 4 44 24 48 54z" fill="#1fa463" fillOpacity="0.12" />
        <path d="M100 116 c -4 -30 10 -52 36 -64 c 6 28 -8 50 -36 64z" fill="#1fa463" fillOpacity="0.12" />
        <path d="M128 84 c -28 -10 -40 -30 -38 -58 c 26 8 38 28 38 58z" fill="#1fa463" fillOpacity="0.12" />
        <path d="M150 58 c 8 -26 28 -38 50 -38 c -6 24 -24 38 -50 38z" fill="#1fa463" fillOpacity="0.12" />
      </g>
    </svg>
  );
}
