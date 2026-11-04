'use client';

// =============================================================================
// SelectorIntencion — «Discutir | Editar» arriba de la caja de un chat de MaKo que trabaja sobre algo de la pantalla
// =============================================================================
// Nació en Automations (app/automations/ChatMako.tsx, 22/10/2026, la llamada con Mauricio: «como Lovable: un botón de
// discutir y otro de editar»): EDITAR hace lo pedido; DISCUTIR contesta y sugiere sin tocar nada. El 24/10/2026 lo pidió
// Martín para el editor web («Tampoco pongas los botones de "toda la landing, sin titulo" pon los botones de "Discutir,
// editar"»), y vive acá para que los chats lo compartan: el mismo aspecto (el interruptor de dos lados) y la MISMA
// preferencia guardada (`mako-chat-intencion`), así quien eligió «Discutir» en Automations lo encuentra igual en el editor.
//
// Automations la usa desde la noche del 24/10/2026 (app/automations/ChatMako.tsx): su copia se borró. Un chat con un
// selector propio es otra vez dos piezas que se separan (tests/chat-mako-envio-a-la-vista.test.ts lo fija).
// =============================================================================

import { useEffect, useState } from 'react';
import type { IntencionChat } from '@/lib/flujo-ia-intencion';

export type { IntencionChat };

/** La clave del navegador: la misma de Automations (`CLAVE_INTENCION` en app/automations/ChatMako.tsx). */
export const CLAVE_INTENCION = 'mako-chat-intencion';

/** Lo que eligió esta persona la última vez (en ESTE navegador). Sin poder leer, Editar («que obedezca», Mauricio). */
export function leerIntencion(): IntencionChat {
  try { return localStorage.getItem(CLAVE_INTENCION) === 'discutir' ? 'discutir' : 'editar'; } catch { return 'editar'; }
}

function guardarIntencion(i: IntencionChat): void {
  try { localStorage.setItem(CLAVE_INTENCION, i); } catch { /* sin almacenamiento: vale para esta pantalla */ }
}

/**
 * La intención, recordada. Arranca en Editar y lee lo guardado DESPUÉS de montar: leído en el primer render, el server
 * (sin `localStorage`) y el navegador dibujarían distinto.
 */
export function useIntencion(): [IntencionChat, (i: IntencionChat) => void] {
  const [intencion, setIntencion] = useState<IntencionChat>('editar');
  useEffect(() => { setIntencion(leerIntencion()); }, []);
  return [intencion, (i) => { setIntencion(i); guardarIntencion(i); }];
}

/** Lo que hace cada opción: sólo al pasar el cursor (Martín, 22/10: «Elimina los textos innecesarios»). */
export const AYUDA_INTENCION: Readonly<Record<IntencionChat, string>> = {
  editar: 'Hace lo que pides, tal cual.',
  discutir: 'Te contesta y sugiere, sin tocar nada.',
};

const OPCIONES: ReadonlyArray<{ id: IntencionChat; rotulo: string }> = [{ id: 'discutir', rotulo: 'Discutir' }, { id: 'editar', rotulo: 'Editar' }];

/** Las dos opciones, como un interruptor de dos lados, encima de la caja. */
export function SelectorIntencion({ valor, onCambio, deshabilitado = false }: {
  valor: IntencionChat; onCambio: (i: IntencionChat) => void; deshabilitado?: boolean;
}) {
  return (
    <div data-intencion={valor} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, flexWrap: 'wrap' }}>
      <div role="radiogroup" aria-label="Qué hace MaKo con lo que escribes" style={{ display: 'inline-flex', padding: 2, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {OPCIONES.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} disabled={deshabilitado}
            title={AYUDA_INTENCION[o.id]} onClick={() => onCambio(o.id)}
            style={{
              border: 'none', borderRadius: 999, padding: '4px 12px', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: deshabilitado ? 'default' : 'pointer',
              background: valor === o.id ? 'var(--surface)' : 'transparent', color: valor === o.id ? 'var(--ink)' : 'var(--dim)',
              boxShadow: valor === o.id ? '0 1px 2px rgba(18,21,27,.10)' : 'none',
            }}>
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
