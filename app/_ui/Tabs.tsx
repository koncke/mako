'use client';

// =============================================================================
// Tabs — vistas hermanas del MISMO nivel
// =============================================================================
// Del inventario del documento (§19.2): «vistas hermanas del mismo nivel. Deben
// soportar scroll horizontal en mobile y contadores cuando aporten valor».
//
// Cuándo NO usarlas: si las vistas no son hermanas —si una es el detalle de la
// otra— eso es navegación, no tabs. Y si son más de seis, probablemente falte
// una decisión de arquitectura, no una tab más.
//
// El indicador del activo es AZUL, no dorado: cambiar de tab es una acción del
// usuario. El dorado quedó reservado para MaKo (ver la regla en globals.css).
//
// Las tabs por RUTA (Configuraciones) siguen en app/_components/ConfigTabs.tsx;
// esto es para las que viven dentro de una misma pantalla.

import type { ReactNode } from 'react';
import { MONO } from './tokens';

export type Tab = { id: string; label: string; badge?: number };

export function Tabs({ tabs, activa, onCambio, extra }: {
  tabs: Tab[];
  activa: string;
  onCambio: (id: string) => void;
  /** Algo alineado a la derecha de la fila (una acción, un estado). */
  extra?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 'var(--sect-gap)' }}>
      {/* En pantalla chica la fila scrollea sola en vez de comprimir las tabs
          hasta que no se lean. El body nunca se mueve de costado. */}
      <div className="mk-scroll-x" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 2, width: 'max-content' }}>
          {tabs.map((t) => {
            const on = t.id === activa;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={on}
                className="mk-tab" data-activo={on}
                onClick={() => onCambio(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', minHeight: 'var(--touch)',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 'var(--fs-md)',
                  fontWeight: on ? 600 : 500,
                  borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`,
                  marginBottom: -1, whiteSpace: 'nowrap',
                }}>
                {t.label}
                {typeof t.badge === 'number' && t.badge > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--dim)' }}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {extra && <div style={{ flex: 'none', paddingBottom: 8 }}>{extra}</div>}
    </div>
  );
}
