"use client";

interface MediopointLogoProps {
  className?: string;
  size?: number;
}

export function MediopointLogo({ className = "h-12 w-12" }: MediopointLogoProps) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-b from-[#0F172A] to-[#060A14] border border-amber-500/25 shadow-lg shadow-black/50 ring-4 ring-amber-500/5 ${className}`}
      aria-label="Mediopoint logo"
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-3/5 w-3/5"
      >
        <defs>
          <linearGradient id="mp-gold-bridge" x1="10" y1="14" x2="38" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#CA8A04" />
          </linearGradient>
          <linearGradient id="mp-pillar" x1="24" y1="21" x2="24" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>
          <filter id="mp-emerald-glow" x="19" y="9" width="10" height="10" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="1.5" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>

        {/* Outer connection bridge arch forming the outer legs of the "M" */}
        <path
          d="M 12 33 V 21 C 12 17 15 14.5 18.5 16.5 L 24 22 L 29.5 16.5 C 33 14.5 36 17 36 21 V 33"
          stroke="url(#mp-gold-bridge)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Central trust vault / midpoint pillar connecting the inner valley of M */}
        <path
          d="M 24 22 V 33"
          stroke="url(#mp-pillar)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Left buyer node */}
        <circle cx="12" cy="33" r="2.5" fill="#EAB308" />

        {/* Right seller node */}
        <circle cx="36" cy="33" r="2.5" fill="#EAB308" />

        {/* Center protected escrow funds: subtle vibrant emerald dot with glowing center */}
        <circle cx="24" cy="14" r="3.2" fill="#10B981" filter="url(#mp-emerald-glow)" />
        <circle cx="24" cy="14" r="1.5" fill="#A7F3D0" />
      </svg>
    </div>
  );
}
