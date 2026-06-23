"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  code: string;
};

export function JoinQrCode({ code }: Props) {
  const [result, setResult] = useState<{ dataUrl: string; joinUrl: string } | null>(null);

  useEffect(() => {
    const url = `${window.location.origin}/${code}`;
    QRCode.toDataURL(url, { width: 280, margin: 1 })
      .then((dataUrl) => setResult({ dataUrl, joinUrl: url }))
      .catch(() => setResult(null));
  }, [code]);

  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm space-y-3 text-center">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted">Scan to join</h3>
      {result ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated data URI, not a remote/static asset
        <img
          src={result.dataUrl}
          alt={`QR code to join session ${code}`}
          className="mx-auto rounded-lg w-55 max-w-full h-auto"
        />
      ) : (
        <div className="mx-auto w-55 max-w-full h-55 rounded-lg bg-surface animate-pulse" />
      )}
      {result && <p className="text-xs text-muted break-all">{result.joinUrl}</p>}
    </div>
  );
}
