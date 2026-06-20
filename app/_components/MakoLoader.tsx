'use client';

// =============================================================================
// MakoLoader — loader animado de MaKo (las letras M a K o rebotan)
// =============================================================================
// Reutilizable: tamaño y color configurables. Sirve como indicador de "pensando"
// y para cualquier estado de carga con marca MaKo.

import { useId } from 'react';

export function MakoLoader({ width = 96, gold = '#EF9F27', light = 'var(--ink)' }: { width?: number; gold?: string; light?: string }) {
  // id único y estable (server/client) para no chocar gradientes/keyframes.
  const uid = `mako${useId().replace(/[:]/g, '')}`;
  const css = `
    .${uid}-ltr { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 88px; opacity: 0;
      animation: ${uid}-rise .55s cubic-bezier(.2,.7,.3,1) forwards, ${uid}-bob 1.2s ease-in-out infinite; }
    .${uid}-1 { animation-delay: .15s, .70s; } .${uid}-2 { animation-delay: .30s, .85s; }
    .${uid}-3 { animation-delay: .45s, 1.00s; } .${uid}-4 { animation-delay: .60s, 1.15s; }
    @keyframes ${uid}-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ${uid}-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
  `;
  return (
    <svg viewBox="0 0 400 220" width={width} height={width * 0.55} role="img" aria-label="MaKo cargando" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F6D365" />
          <stop offset="100%" stopColor={gold} />
        </linearGradient>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </defs>
      <text className={`${uid}-ltr ${uid}-1`} x="118" y="140" textAnchor="middle" fill={`url(#${uid}-grad)`}>M</text>
      <text className={`${uid}-ltr ${uid}-2`} x="170" y="140" textAnchor="middle" fill={light}>a</text>
      <text className={`${uid}-ltr ${uid}-3`} x="226" y="140" textAnchor="middle" fill={`url(#${uid}-grad)`}>K</text>
      <text className={`${uid}-ltr ${uid}-4`} x="278" y="140" textAnchor="middle" fill={light}>o</text>
    </svg>
  );
}
