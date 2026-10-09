// =============================================================================
// IconosDisparador — el ícono de cada tipo de CRON y de cada evento de un canal
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026), CRON punto 2: la primera pantalla del CRON son seis botones
// gigantes «con ícono/logo cada uno», y la tarjeta CRON del lienzo dibuja una fila por CRON con el
// suyo (la clave la da `iconoDeDisparador`, lib/disparadores.ts). Íconos y no emojis (la regla de la
// casa en los menús), y los logos de las marcas que se reconocen: el de Instagram, el de Messenger y
// el sobre de Gmail (el mismo del lienzo, `ICONO_GMAIL` de app/_components/Lienzo.tsx).
//
// SVG en línea, sin dependencias: lo monta este editor y lo puede montar la tarjeta del lienzo.

import type { ReactNode } from 'react';
import type { ClaseDisparador } from '@/lib/disparadores';

type Props = { tipo: ClaseDisparador | 'otro'; tam?: number };

const caja = (tam: number, fondo: string, hijos: ReactNode, borde?: string) => (
  <span aria-hidden style={{
    width: tam, height: tam, flex: 'none', borderRadius: Math.round(tam * 0.28), background: fondo,
    border: borde, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }}>{hijos}</span>
);

/** El ícono de una clase de CRON. `otro` (un disparador de antes) es el rayo del CRON. */
export function IconoDisparador({ tipo, tam = 34 }: Props) {
  const s = Math.round(tam * 0.58);
  if (tipo === 'instagram') {
    return caja(tam, 'linear-gradient(45deg, #F58529 0%, #DD2A7B 45%, #8134AF 75%, #515BD4 100%)', (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1" fill="#fff" stroke="none" />
      </svg>
    ));
  }
  if (tipo === 'messenger') {
    return caja(tam, 'linear-gradient(45deg, #0099FF 0%, #A033FF 60%, #FF5280 100%)', (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff">
        <path d="M12 2.5C6.6 2.5 2.5 6.4 2.5 11.6c0 2.8 1.2 5.2 3.2 6.8v3.1l2.9-1.6c1.1.3 2.2.5 3.4.5 5.4 0 9.5-3.9 9.5-9.1S17.4 2.5 12 2.5Z" />
        <path d="m6.8 14.4 3.1-4.9 2.6 2 2.9-2 -3.1 4.9-2.6-2Z" fill="#7B3CFF" />
      </svg>
    ));
  }
  if (tipo === 'email') {
    return caja(tam, '#fff', (
      <svg width={s + 2} height={s + 2} viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="14" rx="2.5" fill="#fff" stroke="#EA4335" strokeWidth="1.6" />
        <path d="M3.2 6.4 12 13l8.8-6.6" fill="none" stroke="#EA4335" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ), '1px solid var(--border)');
  }
  if (tipo === 'producto') {
    return caja(tam, 'var(--primary-bg)', (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.9" strokeLinejoin="round">
        <path d="M12 2.8 20.5 7.4v9.2L12 21.2 3.5 16.6V7.4Z" />
        <path d="M3.5 7.4 12 12l8.5-4.6M12 12v9.2" />
      </svg>
    ));
  }
  if (tipo === 'recurrente') {
    return caja(tam, 'var(--primary-bg)', (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
        <path d="M3.5 9.5h17M8 2.8v3.4M16 2.8v3.4" />
        <path d="M15.5 14.6a3.6 3.6 0 1 1-1.1-2.6M15.6 11.6v2.2h-2.2" />
      </svg>
    ));
  }
  if (tipo === 'etiqueta') {
    return caja(tam, 'var(--warn-bg)', (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.9" strokeLinejoin="round">
        <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0Z" />
        <circle cx="8.3" cy="8.3" r="1.5" />
      </svg>
    ));
  }
  // El rayo del CRON (CRON punto 10: «que el emoji de CRON sea el rayo»).
  return caja(tam, 'var(--warn-bg)', (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#F59E0B"><path d="M13.2 2.5 4.8 13.6h6l-1.4 7.9 8.4-11.1h-6Z" /></svg>
  ));
}

/** El ícono de un evento de un canal (las filas de Instagram, Messenger y Email). */
export function IconoEvento({ subtipo, tam = 18 }: { subtipo: string; tam?: number }) {
  const p = { width: tam, height: tam, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (subtipo === 'comentario') return <svg {...p}><path d="M4 5.5h16v10H9l-5 4Z" /><path d="M8 9.5h8M8 12.5h5" /></svg>;
  if (subtipo === 'historia') return <svg {...p}><circle cx="12" cy="12" r="8.5" strokeDasharray="4 2.2" /><circle cx="12" cy="12" r="4" /></svg>;
  if (subtipo === 'dm') return <svg {...p}><path d="M21 3.5 3.5 10.6l6.8 2.6 2.6 6.8Z" /><path d="m10.3 13.2 4.4-4.4" /></svg>;
  if (subtipo === 'anuncio') return <svg {...p}><path d="M4 10v4h3l7 4V6l-7 4Z" /><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5" /></svg>;
  if (subtipo === 'en_vivo') return <svg {...p}><circle cx="12" cy="12" r="2.5" /><path d="M7.5 16.5a6.4 6.4 0 0 1 0-9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 19.4a10.4 10.4 0 0 1 0-14.8M19.4 4.6a10.4 10.4 0 0 1 0 14.8" /></svg>;
  if (subtipo === 'ref') return <svg {...p}><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1" /><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1" /></svg>;
  if (subtipo === 'qr') return <svg {...p}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></svg>;
  if (subtipo === 'tienda') return <svg {...p}><path d="M4 9.5 5.5 4.5h13L20 9.5" /><path d="M4 9.5h16v2a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0Z" /><path d="M5.5 13.5v6h13v-6" /></svg>;
  return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>;
}

/** El tacho de borrar, ROJO siempre (sexta tanda, general punto 9: «que siempre el ícono de borrar sea rojo»). */
export function IconoBorrar({ tam = 16 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="var(--bad)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
    </svg>
  );
}
