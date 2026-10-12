'use client';
// =============================================================================
// El MARCO del mapa de calor: un celular (bisel y cámara) o una compu (ventana del navegador con el host)
// =============================================================================
// Pedido de Martín (12/10/2026): la landing «adentro de un celular (o de una compu)», como se ve en el
// teléfono de quien entra. La pantalla mide lo que mide la del aparato (390×844 en vivo, o la ventana de quien
// grabó en la foto), el marco se dibuja alrededor, y TODO junto se achica para entrar en la tarjeta.
//
// ⚠️ SE ACHICA CON `transform: scale`, nunca cambiando el tamaño de la pantalla: la página adentro tiene que
// verse con SU ancho (un celular de 390), o se dibuja la versión de otro aparato. Quien monta el marco pone lo
// de adentro en px de la PANTALLA y no tiene que saber nada de la escala (AGENTS.md: una medida adentro de una
// capa escalada no es la que se ve, y las posiciones se leen del DOM o se ponen en las unidades de la capa).
//
// Los colores son los de las islas oscuras de la casa (--sidebar…): un aparato es oscuro en los dos temas.
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';
import type { Dispositivo } from '@/lib/landing-mapa';

/** El bisel del celular y el borde de la ventana del navegador, en px de la pantalla. */
const BISEL = 12;
const BORDE = 6;
const BARRA = 34;

export type Tamano = { w: number; h: number };

/** Lo que mide el marco entero (pantalla + bisel o barra), sin escalar. */
export function medidasMarco(disp: Dispositivo, pantalla: { ancho: number; alto: number }): Tamano {
  return disp === 'movil'
    ? { w: pantalla.ancho + 2 * BISEL, h: pantalla.alto + 2 * BISEL }
    : { w: pantalla.ancho + 2 * BORDE, h: pantalla.alto + BARRA + BORDE };
}

/** Cuánto se achica el marco para entrar en `caja` (nunca se agranda: una página agrandada se ve borrosa). */
export function escalaParaCaber(caja: Tamano, marco: Tamano): number {
  if (!(caja.w > 0) || !(caja.h > 0) || !(marco.w > 0) || !(marco.h > 0)) return 1;
  return Math.max(0.05, Math.min(1, caja.w / marco.w, caja.h / marco.h));
}

const host = (url: string): string => {
  try { return new URL(url).host; } catch { return url; }
};

/**
 * El marco, ya escalado para entrar en `caja`, con `children` en px de la pantalla (`pantalla.ancho` ×
 * `pantalla.alto`, con `position: relative` y lo que se salga, recortado).
 */
export function MarcoDispositivo({ disp, pantalla, url, caja, children }: {
  disp: Dispositivo; pantalla: { ancho: number; alto: number }; url: string; caja: Tamano; children: ReactNode;
}) {
  const marco = medidasMarco(disp, pantalla);
  const k = escalaParaCaber(caja, marco);
  const fuera: CSSProperties = { width: marco.w * k, height: marco.h * k, position: 'relative', flex: 'none' };
  const escalado: CSSProperties = { position: 'absolute', left: 0, top: 0, width: marco.w, height: marco.h, transform: `scale(${k})`, transformOrigin: '0 0' };
  const pantallaCss: CSSProperties = { position: 'relative', width: pantalla.ancho, height: pantalla.alto, overflow: 'hidden', background: '#ffffff' };

  if (disp === 'movil') {
    return (
      <div style={fuera}>
        <div style={{ ...escalado, boxSizing: 'border-box', padding: BISEL, borderRadius: 48, background: 'var(--sidebar)', boxShadow: '0 0 0 1px var(--sidebar-line), 0 18px 40px rgba(0,0,0,.18)' }}>
          <div style={{ ...pantallaCss, borderRadius: 36 }}>
            {children}
            {/* La cámara: encima de la página, como en el teléfono. */}
            <div aria-hidden style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 112, height: 30, borderRadius: 15, background: 'var(--sidebar)', pointerEvents: 'none', zIndex: 3 }} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={fuera}>
      <div style={{ ...escalado, boxSizing: 'border-box', padding: `0 ${BORDE}px ${BORDE}px`, borderRadius: 14, background: 'var(--sidebar-2)', boxShadow: '0 0 0 1px var(--sidebar-line), 0 18px 40px rgba(0,0,0,.18)' }}>
        <div style={{ height: BARRA, display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} aria-hidden style={{ width: 12, height: 12, borderRadius: 6, background: c, flex: 'none' }} />)}
          <span style={{ marginLeft: 14, flex: '0 1 420px', minWidth: 0, height: 22, borderRadius: 11, background: 'var(--sidebar)', color: 'var(--sidebar-text)', fontSize: 13, lineHeight: '22px', padding: '0 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {host(url)}
          </span>
        </div>
        <div style={{ ...pantallaCss, borderRadius: 4 }}>{children}</div>
      </div>
    </div>
  );
}
