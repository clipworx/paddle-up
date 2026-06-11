type Props = {
  size?: number;
  className?: string;
};

export function Logo({ size = 48, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* Background */}
      <rect width="64" height="64" rx="14" fill="var(--color-accent, #c08552)" />

      {/* Subtle inner glow ring */}
      <rect x="3" y="3" width="58" height="58" rx="12" fill="none" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />

      {/* R */}
      <g fill="white">
        {/* R — vertical stem */}
        <rect x="12" y="16" width="5" height="32" rx="1.5" />
        {/* R — top bowl */}
        <path d="M17 16 h8 a8 8 0 0 1 0 16 h-8 z" />
        {/* R — bowl fill (accent-over-accent to cut the bowl) */}
        <rect x="17" y="19" width="7" height="10" rx="3" fill="var(--color-accent, #c08552)" />
        {/* R — leg */}
        <path d="M22 32 L31 48" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>

      {/* Z */}
      <g fill="white">
        {/* Z — top bar */}
        <rect x="33" y="16" width="19" height="5" rx="2" />
        {/* Z — bottom bar */}
        <rect x="33" y="43" width="19" height="5" rx="2" />
        {/* Z — diagonal */}
        <path d="M50 18 L34 46" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
