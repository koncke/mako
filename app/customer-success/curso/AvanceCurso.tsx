'use client';

// =============================================================================
// AvanceCurso — dónde va cada cliente en el curso de un producto
// =============================================================================
// «Que también se mida cuánto del vídeo se vieron, cuáles tareas completaron» (Martín,
// 06/10/2026), y de Mauricio el 9/9: poder ver quién vio cada clase y quién hizo la tarea.
//
// Una fila por cliente del producto: su etapa, las tareas que envió en CADA etapa (la suya
// resaltada), cuánto vio de los videos de su etapa, cuándo entró por última vez a su portal y
// en qué quedó su ACCESO (invitarlo, reenviarle o volver a habilitarlo: ./InvitarAlCurso.tsx).
// Todo llega armado del server (page.tsx → `avanceDeCliente`): acá sólo se dibuja.
//
// ⚠️ LAS CELDAS DEL AVANCE NO SE DIBUJAN ACÁ: son ./FilaAvance.tsx, las mismas que la pestaña
// Curso de la ficha muestra arriba para un cliente. Acá se agrega lo que es de la TABLA: la
// columna del cliente y la del acceso.
//
// ⚠️ SIN `Pagina` NI CAJA PROPIA: lo monta la vista Avance adentro de su propio contenedor. Es una
// tabla con scroll de costado y nada más.
//
// ⚠️ DESDE EL 07/10/2026 VIVE EN CLIENTES (item 4: «Elimina la tab de Avance de clientes en este
// lugar [el curso] solo se va a editar el curso. Que esa tab esté en la ruta de clientes»): la monta
// ../ClientesApp.tsx como la vista «Avance» de /customer-success, con el selector de servicio de esa
// pantalla. Las filas las arma ../page.tsx (`cursoDeLaCartera`) con el email del CRM y la
// invitación, que la tab Curso nunca le pasó.

import { useState } from 'react';
import { EmptyState, Banner } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import type { AccesoFila, FilaAvance } from './reglas';
import { CabezaAvance, CeldasAvance, EstiloAvance, type EtapaVista } from './FilaAvance';
import { CeldaAcceso, EstiloInvitar } from './InvitarAlCurso';
import { accesoDeFila, type AccesoInvitacion } from '../curso-ficha-lectura';
import { accesoEnProducto } from '@/lib/curso-invitar-reglas';

// CursoApp lo importa de acá desde antes de que existiera FilaAvance.tsx.
export type { EtapaVista };

/**
 * Una fila, con lo que la columna «Acceso» necesita además de lo de `FilaAvance`: el email del
 * CRM (para prellenar la invitación) y la invitación (mig 0206).
 *
 * ⚠️ OPCIONALES A PROPÓSITO: los arma la página de la tab (page.tsx → `accesosDeClientes`), y
 * mientras esa lectura no los traiga, `undefined` se dibuja como «no lo sé» y nunca como «Sin
 * invitar» (ver `AccesoInvitacion`). Un `FilaAvance` sin ellos entra igual.
 */
export type FilaConAcceso = Omit<FilaAvance, 'acceso'> & {
  email?: string | null;
  /** `productos`: qué cursos abre (mig 0232); la columna «Acceso» lo mira desde el curso de la tabla. */
  acceso: (AccesoFila & { email?: string | null; invitacionEnviadaAt?: string | null; productos?: number[] | null }) | null;
};

// ⛔ ACÁ VIVÍA `accesoDeFila` (el acceso de una fila → lo que lee la celda). Se mudó a
// ../curso-ficha-lectura.ts el 07/10/2026: desde que la tarjeta del kanban y la lista «Clientes sin
// invitar» también la necesitan, tres traducciones del mismo acceso podían decir tres cosas.

export function AvanceCurso({ etapas, filas, error, onAcceso, productoId }: {
  etapas: EtapaVista[];
  filas: readonly FilaConAcceso[];
  error: string | null;
  /**
   * El acceso de un cliente como quedó después de invitarlo o habilitarlo desde la tabla. Lo usa
   * Clientes para que la tarjeta del kanban diga lo mismo (`Reenviar invitación`) sin releer la página.
   */
  onAcceso?: (leadId: number, a: AccesoInvitacion) => void;
  /**
   * El curso de ESTA tabla (puntos 6 y 7 del audio del 08/10 a la noche). Con él la columna «Acceso»
   * mira la invitación desde este curso (`accesoEnProducto`: invitado a otro curso es «Sin invitar»
   * acá) e «Invitar» invita a ESTE curso — el mail nombra sólo éste y el acceso pasa a abrirlo.
   */
  productoId?: number;
}) {
  /**
   * Lo que cambió en esta pantalla (invitar, habilitar), por cliente. El acceso es del CLIENTE,
   * no del producto: invitarlo desde la tabla de un producto vale para la de otro.
   */
  const [cambios, setCambios] = useState<Record<number, AccesoInvitacion>>({});
  const router = useRouter();
  /**
   * Se pinta lo que volvió del server en el acto, y además se relee la página: lo de `cambios`
   * vive mientras esta tabla esté montada, y la vista Clases la desmonta. Sin releer, volver a
   * Avance mostraría la invitación de ANTES — y un «Invitar» sobre alguien ya invitado es un mail
   * duplicado. `refresh` (del Link de la casa, que preserva el `?ws=`) no pierde el estado de la
   * pantalla.
   */
  const alCambiar = (leadId: number, a: AccesoInvitacion) => {
    setCambios((m) => ({ ...m, [leadId]: a }));
    onAcceso?.(leadId, a);
    router.refresh();
  };

  if (error) return <Banner tono="bad">No pude leer el avance. {error}</Banner>;
  if (!filas.length) {
    return <EmptyState titulo="Sin clientes en este producto" detalle="Cuando ganes uno, su avance aparece aquí." />;
  }
  return (
    <div className="mk-scroll-x">
      <table className="av">
        <thead>
          {/* ⚠️ «Acceso» va PEGADA AL CLIENTE y no al final: con nueve etapas la tabla scrollea
              de costado (medido a 1600 px), y al final el botón de invitar quedaba fuera de la
              vista — una acción que hay que ir a buscar con la rueda no se usa. */}
          <tr>
            <th className="av-cli">Cliente</th>
            <th>Acceso</th>
            <CabezaAvance etapas={etapas} />
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            // Lo cambiado acá también se mira desde este curso: invitarlo desde otro producto no lo
            // deja «Invitado» en éste.
            const crudo = cambios[f.leadId] ?? accesoDeFila(f.acceso);
            const acceso = productoId != null ? accesoEnProducto(crudo, productoId) : crudo;
            return (
              <tr key={f.leadId}>
                <td className="av-cli">
                  <div className="av-nombre">{f.nombre || 'Sin nombre'}</div>
                  {f.empresa && <div className="av-sub">{f.empresa}</div>}
                </td>
                <td>
                  <CeldaAcceso leadId={f.leadId} nombre={f.nombre} emailCrm={f.email} acceso={acceso} productoId={productoId}
                    onAcceso={(a) => alCambiar(f.leadId, a)} />
                </td>
                <CeldasAvance etapas={etapas} fila={{ ...f, acceso }} />
              </tr>
            );
          })}
        </tbody>
      </table>
      <EstiloAvance />
      <EstiloInvitar />
    </div>
  );
}
