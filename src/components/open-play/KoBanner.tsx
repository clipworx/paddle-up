"use client";

type Props = {
  show: boolean;
};

export function KoBanner({ show }: Props) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center pointer-events-none animate-[op-koBg_0.6s_ease_forwards]"
    >
      <div className="text-center animate-[op-koSlam_0.48s_cubic-bezier(.22,.61,.36,1)_forwards]">
        <div className="font-display italic font-black text-[clamp(72px,18vw,130px)] text-negative leading-[0.82] tracking-tight [text-shadow:0_0_60px_color-mix(in_srgb,var(--color-negative)_55%,transparent)]">
          MATCH
        </div>
        <div className="font-display italic font-black text-[clamp(72px,18vw,130px)] text-white leading-[0.82] tracking-tight">
          COMPLETE
        </div>
        <div className="font-op-mono text-xs text-white/40 tracking-[0.22em] mt-5">
          ALL PLAYERS RETURN TO REST
        </div>
      </div>
    </div>
  );
}
