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
      <rect width="64" height="64" rx="14" fill="#4B2E2B" />
      <circle cx="32" cy="32" r="22" fill="#C08552" />
      <g fill="#4B2E2B">
        <circle cx="23" cy="23" r="2.4" />
        <circle cx="32" cy="20" r="2.4" />
        <circle cx="41" cy="23" r="2.4" />
        <circle cx="20" cy="32" r="2.4" />
        <circle cx="32" cy="32" r="2.4" />
        <circle cx="44" cy="32" r="2.4" />
        <circle cx="23" cy="41" r="2.4" />
        <circle cx="32" cy="44" r="2.4" />
        <circle cx="41" cy="41" r="2.4" />
      </g>
    </svg>
  );
}
