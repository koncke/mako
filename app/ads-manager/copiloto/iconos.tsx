// Los íconos del Marketing CoPilot nuevo: los mismos trazos de la maqueta (docs/marketing-copilot/rediseno/maqueta-diecinueve.html).
import type { ReactNode } from 'react';
import type { TipoFuenteOC } from '@/lib/copiloto/comunicacion';

const Svg = ({ size = 16, ancho = 2, children }: { size?: number; ancho?: number; children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ancho} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
);

export const Chevron = () => <Svg><path d="m6 9 6 6 6-6" /></Svg>;
export const Tilde = ({ size = 14 }: { size?: number }) => <Svg size={size} ancho={2.6}><path d="M5 12.5l4.2 4.2L19 7" /></Svg>;
export const Flecha = () => <Svg><path d="M7 17 17 7M8 7h9v9" /></Svg>;
export const Tuerca = () => <Svg><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>;
export const Refrescar = () => <Svg><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" /><path d="M21 3v5h-5" /></Svg>;
export const Grafico = () => <Svg><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;

const FUENTE: Record<TipoFuenteOC, ReactNode> = {
  pdf: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></>,
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  llamada: <path d="M5 4h3.5l1.8 4.5-2.3 1.4a10.5 10.5 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z" />,
  reel: <><rect x="6" y="3" width="12" height="18" rx="3" /><path d="m10.5 9.5 4 2.5-4 2.5v-5Z" /></>,
  video: <><rect x="3" y="6" width="18" height="12" rx="3" /><path d="m10.5 9.5 4 2.5-4 2.5v-5Z" /></>,
  anuncio: <><path d="M4 10v4h3l6 4V6L7 10H4Z" /><path d="M17 9a4 4 0 0 1 0 6" /></>,
  comentario: <path d="M4 5h16v11H9l-5 4V5Z" />,
  chat: <path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 19l-5-3-5 3 1.4-6.2L4 9l5.8-.7Z" />,
  negocio: <><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /></>,
};
export const IconoFuente = ({ tipo, size = 14 }: { tipo: TipoFuenteOC; size?: number }) => <Svg size={size}>{FUENTE[tipo]}</Svg>;

/** La medialuna de la nota (la de la maqueta, `gauge(n)`): lo hecho en tinta, lo que falta rayado. */
export function Medialuna({ n }: { n: number }) {
  const v = Math.max(0, Math.min(100, Math.round(n)));
  const a = Math.PI * (1 - v / 100);
  const x = (125 + 102 * Math.cos(a)).toFixed(2), y = (125 - 102 * Math.sin(a)).toFixed(2);
  const id = `raya${v}`;
  return (
    <div className="frn-gauge">
      <svg viewBox="0 0 250 149" aria-hidden>
        <defs><pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="var(--card)" /><rect width="2" height="7" fill="#8d9a92" /></pattern></defs>
        {v < 100 && <path d={`M${x} ${y} A102 102 0 0 1 227.00 125.00`} fill="none" stroke={`url(#${id})`} strokeWidth="46" strokeLinecap="round" />}
        {v > 0 && <path d={`M23.00 125.00 A102 102 0 0 1 ${x} ${y}`} fill="none" stroke="var(--g-700)" strokeWidth="46" strokeLinecap="round" />}
      </svg>
      <div className="frn-gauge__c"><b className="frn-num">{v}</b><span>de 100</span></div>
    </div>
  );
}
