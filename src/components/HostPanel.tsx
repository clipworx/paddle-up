"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { MAX_COURTS } from "@/lib/types";

type Props = {
  code: string;
  courtCount: number;
  onSetCourtCount: (n: number) => void;
  onEndSession: () => void;
};

const COURT_OPTIONS = [1, 2, 3, 4];

export function HostPanel({ code, courtCount, onSetCourtCount, onEndSession }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/${code}`;
    QRCode.toDataURL(url, { width: 224, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(`rezerve.today/${code}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <div className="font-op-mono text-[9px] text-muted tracking-[0.17em]">HOST CONTROLS</div>
      </div>
      <div className="p-4 flex flex-col gap-3.5">
        <div>
          <div className="text-[13px] text-muted mb-2 font-medium">Courts</div>
          <div className="flex gap-1.75">
            {COURT_OPTIONS.map((n) => {
              const selected = n === courtCount;
              const disabled = n > MAX_COURTS;
              return (
                <button
                  key={n}
                  onClick={() => onSetCourtCount(n)}
                  disabled={disabled}
                  className={`flex-1 py-2.75 rounded-lg text-[17px] font-extrabold border-[1.5px] transition-colors disabled:opacity-30 ${
                    selected ? "bg-accent text-white border-accent" : "bg-surface text-muted border-border"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-surface rounded-lg px-3.5 py-3 flex items-center gap-3">
          <div className="w-28 h-28 rounded-md bg-background border border-border flex items-center justify-center shrink-0 overflow-hidden">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- generated data URI, not a remote/static asset
              <img src={qrDataUrl} alt={`QR code to join session ${code}`} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-border/30 animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-op-mono text-[9px] text-muted tracking-[0.12em] mb-1">SHARE LINK</div>
            <div className="text-sm text-accent font-semibold break-all leading-tight">rezerve.today/{code}</div>
          </div>
          <button
            onClick={handleCopy}
            className="bg-background text-foreground px-3 py-2 rounded-md text-xs font-semibold border border-border shrink-0 hover:border-accent/40 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <button
          onClick={onEndSession}
          className="w-full py-2.5 rounded-lg text-[13px] font-semibold bg-negative/7 text-negative border border-negative/17 hover:bg-negative hover:text-white transition-colors"
        >
          End Session
        </button>
      </div>
    </div>
  );
}
