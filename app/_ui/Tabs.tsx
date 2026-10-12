'use client';

// =============================================================================
// Tabs — vistas hermanas del MISMO nivel
// =============================================================================
// Cuándo NO usarlas: si las vistas no son hermanas —si una es el detalle de la
// otra— eso es navegación, no tabs. Y si son más de seis, probablemente falte
// una decisión de arquitectura, no una tab más.
//
// El indicador del activo es AZUL, no dorado: cambiar de tab es una acción del
// usuario. El dorado quedó reservado para MaKo (ver la regla en globals.css).
//
// ⚠️ UNA BARRA DE NAVEGACIÓN NO LLEVA SCROLL HORIZONTAL. Es la regla de la casa
// y va en contra de lo que decía el §19.2 del documento («deben soportar scroll
// horizontal en mobile»): esconder destinos detrás de un gesto lateral es
// esconderlos. Si no entran, BAJAN — la fila envuelve y se ve entera. El scroll
// lateral sigue siendo correcto para una tabla o una fila de filtros, donde lo
// que se corre es CONTENIDO, no el mapa de dónde se puede ir.
//
// Las tabs por RUTA (Configuraciones) siguen en app/_components/ConfigTabs.tsx;
// esto es para las que viven dentro de una misma pantalla.

import type { ReactNode } from 'react';
import { MONO } from './tokens';

export type Tab = { id: string; label: string; badge?: number };

export function Tabs({ tabs, activa, onCambio, extra, sinLinea }: {
  tabs: Tab[];
  activa: string;
  onCambio: (id: string) => void;
  /** Algo alineado a la derecha de la fila (una acción, un estado). */
  extra?: ReactNode;
  /**
   * Sin el filete de abajo de la fila: queda sólo el subrayado azul de la activa. Para una caja que ya
   * apagó los suyos (el Modal con `sinFiletes`): éste quedaba suelto, 17 px debajo del azul por el padding
   * del cuerpo (undécima tanda, punto 1: «elimina el divider de abajo del título»). Sin la prop, igual que siempre.
   */
  sinLinea?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, borderBottom: sinLinea ? 'none' : '1px solid var(--border)', marginBottom: 'var(--sect-gap)' }}>
      {/* flexWrap, no scroll: en pantalla angosta la fila baja de renglón y se
          siguen viendo todos los destinos. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, flex: 1, minWidth: 0 }}>
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
      {extra && <div style={{ flex: 'none', paddingBottom: 8 }}>{extra}</div>}
    </div>
  );
}
