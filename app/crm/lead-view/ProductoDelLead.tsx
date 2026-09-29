'use client';

// =============================================================================
// ProductoDelLead — en qué producto vive este lead, y cómo moverlo
// =============================================================================
// Pedido de Martín (30/09/2026), textual: «Dentro del detail de un lead debería salir
// el mismo desplegable de productos, para que se puedan ver los detalles de ese lead
// en el recorrido de ese funnel. Si ese lead NO está en el producto que seleccioné,
// que me de la opción de cargarlo y que lo cargue automáticamente como lead entrante».
//
// ⚠️ LO QUE ESTO **NO** HACE, Y HAY QUE DECIRLO ACÁ PORQUE LA PANTALLA NO PUEDE:
// no muestra «el recorrido de este lead en ESE otro embudo», porque ese recorrido no
// existe. Hoy el producto de un lead es UNA columna (`leads.funnel_id`) y la etapa, las
// fechas de reunión, la asistencia, el closer y el monto son columnas de la MISMA fila:
// una persona tiene un solo recorrido, el del producto donde está. Elegir otro producto
// en este desplegable no cambia de vista — MUEVE al lead, y lo deja en la etapa de
// ENTRADA del embudo destino, que es lo que se pidió y lo único que no miente: la etapa
// del embudo A es una clave SUYA y puede no existir en el B.
//
// Por eso el botón dice «Mover», no «Traer» ni «Ver»: prometer un cambio de vista sobre
// una escritura destructiva es exactamente la clase de promesa que se descubre cuando ya
// no se puede deshacer. Que la segunda mitad del pedido —dos recorridos de la misma
// persona, cada uno con su campaña, su anuncio y su % de VSL— exista, necesita que el
// RECORRIDO sea una entidad aparte de la PERSONA. Esa tabla todavía no está.
//
// ⚠️ Y `funnel_id = null` ES EL PRODUCTO DEL NEGOCIO, no «sin producto». Medido contra
// producción el 30/09/2026: los 1.530 leads de los 6 workspaces lo tienen en NULL, y el
// tablero del embudo por defecto los lista justamente con `is('funnel_id', null)`. Si
// este desplegable dibujara «sin producto» para ese caso, diría eso sobre CADA lead que
// existe hoy.

import { useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Confirm } from '@/app/_ui/Confirm';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { moverLeadAFunnelAction } from '../actions';

const SANS = "'Geist', sans-serif";

export type ProductoOpcion = { id: number; nombre: string; esDefault: boolean };

export function ProductoDelLead({ leadId, funnelId, productos }: {
  leadId: number;
  /** En cuál está. `null` = el del negocio. */
  funnelId: number | null;
  productos: ProductoOpcion[];
}) {
  const router = useRouter();
  const [mover, setMover] = useState<ProductoOpcion | null>(null);
  const [trabajando, startTrabajo] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Con un solo producto no hay nada que elegir, y un desplegable de una opción es un
  // control que promete una decisión que no existe.
  if (productos.length < 2) return null;

  const delNegocio = productos.find((p) => p.esDefault) ?? null;
  /** El id real del producto donde vive: NULL resuelve al del negocio. */
  const actualId = funnelId ?? delNegocio?.id ?? null;
  const actual = productos.find((p) => p.id === actualId) ?? delNegocio;

  const opciones: DropdownOption[] = productos.map((p) => ({ value: String(p.id), label: p.nombre }));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--faint)' }}>Producto</span>
        <Dropdown
          value={String(actual?.id ?? '')}
          options={opciones}
          onChange={(v) => {
            const destino = productos.find((p) => String(p.id) === v);
            // Elegir el que ya está no es una acción: sin esto, abrir el desplegable y
            // cerrarlo sobre la misma opción abriría un diálogo de confirmación.
            if (!destino || destino.id === actual?.id) return;
            setErr(null);
            setMover(destino);
          }}
          ariaLabel={`Producto de este lead: ${actual?.nombre ?? 'el del negocio'}`}
          align="right"
        />
      </div>
      {err && <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--bad)' }}>{err}</span>}

      {/* ⚠️ PREGUNTA SIEMPRE, tenga o no leads: acá el que se mueve es el lead que se está
          mirando, y moverlo lo saca del tablero donde alguien lo estaba trabajando. La
          consecuencia va pegada al botón y en una frase, que es la regla de la casa para
          lo que no se deshace solo. */}
      {mover && (
        <Confirm
          title={`Mover a ${mover.nombre}`}
          message={`Deja de verse en ${actual?.nombre ?? 'su producto actual'} y entra a ${mover.nombre} como lead entrante. Se puede volver a mover.`}
          tone="primary"
          confirmLabel={`Mover a ${mover.nombre}`}
          onCancel={() => setMover(null)}
          onConfirm={() => {
            startTrabajo(async () => {
              // ⚠️ Se manda el id CRUDO, no `null` cuando es el del negocio: la columna
              // acepta los dos y el tablero los trata igual, pero escribir el id deja el
              // dato explícito para el día en que NULL deje de significar lo mismo.
              const r = await moverLeadAFunnelAction(leadId, mover.id);
              if ('error' in r) { setErr(r.error); setMover(null); return; }
              setMover(null);
              router.refresh();
            });
          }}
          loading={trabajando}
        />
      )}
    </>
  );
}
