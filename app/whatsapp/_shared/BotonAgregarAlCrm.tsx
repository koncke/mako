'use client';

// =============================================================================
// BotonAgregarAlCrm — el «+ Agregar al CRM» de las DOS bandejas, con el producto
// =============================================================================
// Pedido de Leila (ws11, 08/10/2026), en un audio: «tengo a Nora Ricardi, ya la agregué al
// CRM. Pero… ella está en marca personal. Primero de por sí me entra al funnel principal, o
// sea que la tengo que eliminar de funnel principal». Medido ese día: los 6 leads que había
// subido desde WhatsApp nacieron en el principal; a los 6 los agregó a mano a otro producto
// (entre 12 y 16 segundos después, casi siempre) y a 4 los sacó del principal después. El
// botón no preguntaba y la action no recibía el dato.
//
// La regla es la de las otras altas: con UN producto (o ninguno) no se pregunta nada —el
// botón sigue siendo un clic, sin fricción nueva—; con DOS o más, el mismo clic abre la lista
// y el lead nace en el elegido. No es un paso más: es el mismo gesto.
//
// ⚠️ SIN PRESELECCIÓN. Ni «el último usado» ni localStorage: Leila subió tres seguidos a Marca
// Personal y tres a Capacitaciones, o sea que la elección cambia de un lead al siguiente, y
// una preferencia restaurada no puede pisar una decisión (AGENTS.md).
//
// ⚠️ `productos === null` ES «NO PUDE LEER», NO «HAY UNO». El botón queda de un clic y el que
// decide es el server (`destinoDelAlta`, lib/lead-funnel-reglas.ts): relee los productos y,
// si hay dos o más, NO crea —devuelve la lista para preguntar—; con la lectura caída tampoco.
// Tratar el `[]` de una lectura fallida como «hay uno» era volver a crear en el principal sin
// preguntar, que es justo el bug.
//
// Vive acá y no en cada bandeja: tests/inbox-agregar-al-crm.test.ts exige el alta en las DOS,
// y dos copias del mismo botón son la forma de que una se quede vieja.

import type { CSSProperties } from 'react';
import { Dropdown } from '../../components/Dropdown';
import { pideProducto, type ProductoParaAlta } from '@/lib/lead-funnel-reglas';

/** Se ve como el link de texto que era: el Dropdown trae borde, fondo y 14 px por default. */
const COMO_LINK: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600,
  color: 'var(--primary)', background: 'none', border: 'none', padding: 0, borderRadius: 0,
};

export function BotonAgregarAlCrm({ productos, creando, onAgregar }: {
  /** Los productos del workspace, ya con su nombre visible. `null` = no se pudieron leer. */
  productos: ProductoParaAlta[] | null;
  creando: boolean;
  /** `null` = no se eligió (0-1 producto, o la lista no se leyó): decide el server. */
  onAgregar: (funnelId: number | null) => void;
}) {
  const rotulo = creando ? 'Agregando…' : '+ Agregar al CRM';
  if (!productos || !pideProducto(productos)) {
    return (
      <button type="button" disabled={creando} onClick={() => onAgregar(null)}
        style={{ ...COMO_LINK, marginTop: '12px', cursor: creando ? 'default' : 'pointer' }}
      >{rotulo}</button>
    );
  }
  // Menú de ACCIÓN, no un select: `value=""` + `resetAfterSelect` vuelve al rótulo después de
  // elegir (el precedente es «Acciones» de app/admin/FichaWorkspace.tsx). El default va primero
  // porque `listarFunnels` lo ordena así.
  return (
    <div style={{ marginTop: '12px' }}>
      <Dropdown value="" resetAfterSelect sinFlecha alContenido disabled={creando}
        placeholder={rotulo} ariaLabel="Agregar al CRM en un funnel" buttonStyle={COMO_LINK}
        columns={[[{ title: 'Funnel', options: productos.map((p) => ({ value: String(p.id), label: p.nombre })) }]]}
        onChange={(v) => { const id = Number(v); if (Number.isInteger(id) && id > 0) onAgregar(id); }} />
    </div>
  );
}
