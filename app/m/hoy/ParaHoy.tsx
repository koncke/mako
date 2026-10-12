'use client';

// =============================================================================
// Today — «Para hoy»: las primeras tareas del plan con su casilla redonda
// =============================================================================
// Tocar la casilla completa la tarea (se llena de azul y el nombre se tacha) y sale el toast
// «Completada» con Deshacer. La escritura es `marcarHechaAction` (app/m/plan/acciones.ts),
// la MISMA de /m/plan: relee la fila fresca, la guarda por el camino de cada tablero, mira el
// rol (la tab Plan visible) y hace `refresh()`, así que Today vuelve a leer sola y la
// siguiente tarea ocupa el lugar. Aquí sólo se marca MIENTRAS tanto (optimista) y se desmarca
// si falla.
//
// El plazo y el color del proyecto se dicen con las MISMAS funciones que /m/plan
// (app/m/plan/formato.ts): una tarea no puede decir «Hoy» en Today y otra cosa en Plan. Lo
// vencido lo marca el punto rojo del riel (`item.vencida`), no el texto.
//
// El swipe a la derecha hace lo mismo que la casilla (ningún gesto sin su control visible).
// Sin conexión, la casilla se apaga: una tarea no se completa «en cola».
// =============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { CasillaM, FilaM, ListaM, useConexion, useToastM } from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';
import { marcarHechaAction } from '@/app/m/plan/acciones';
import type { ItemPlan } from '@/app/plan/board/hoy';
import { colorProyecto, plazoCorto } from '@/app/m/plan/formato';

export function ParaHoy({ items, fecha }: {
  items: ItemPlan[];
  /** `YYYY-MM-DD` del NEGOCIO (`PlanHoy.fecha`): contra esto se cuenta el plazo. */
  fecha: string;
}) {
  const toast = useToastM();
  const router = useRouter();
  const { enLinea } = useConexion();
  const [hechas, setHechas] = useState<ReadonlySet<string>>(new Set());
  const [, empezar] = useTransition();

  const marcar = (id: string, si: boolean) =>
    setHechas((prev) => {
      const s = new Set(prev);
      if (si) s.add(id); else s.delete(id);
      return s;
    });

  const completar = (item: ItemPlan) => {
    if (!enLinea || hechas.has(item.id)) return;
    haptico('light');
    marcar(item.id, true);
    empezar(async () => {
      const r = await marcarHechaAction(item.id, true);
      if (!r.ok) {
        marcar(item.id, false);
        haptico('error');
        toast(r.error);
        return;
      }
      if (r.yaEstaba) {
        // No se escribió nada, así que la action no refrescó: se pide aquí.
        toast('Ya estaba hecha');
        router.refresh();
        return;
      }
      toast('Completada', {
        deshacer: () => {
          marcar(item.id, false);
          empezar(async () => {
            const d = await marcarHechaAction(item.id, false, { prev: r.prev, entryId: r.entryId });
            if (!d.ok) toast(d.error);
          });
        },
      });
    });
  };

  return (
    <ListaM>
      {items.map((item) => {
        const hecha = hechas.has(item.id);
        const color = colorProyecto(item.proyecto);
        const plazo = plazoCorto(item.deadline, fecha);
        return (
          <FilaM
            key={item.id}
            titulo={<span className={hecha ? 'm-hoy-hecha' : undefined}>{item.titulo}</span>}
            segunda={item.proyecto ? (
              <>
                {color && <i className="m-hoy-punto" style={{ background: color }} aria-hidden />}
                {item.proyecto.nombre}
              </>
            ) : undefined}
            riel={plazo ? <span className="m-hoy-plazo" data-vencida={item.vencida || undefined}>{plazo}</span> : undefined}
            leading={
              <CasillaM
                className="m-hoy-casilla"
                marcada={hecha}
                onMarcar={() => completar(item)}
                titulo={item.titulo}
                deshabilitado={!enLinea}
                motivo="Sin conexión"
              />
            }
            swipeDerecha={enLinea && !hecha ? { rotulo: 'Completar', icono: 'check', tono: 'completar', onAccion: () => completar(item) } : undefined}
          />
        );
      })}
    </ListaM>
  );
}
