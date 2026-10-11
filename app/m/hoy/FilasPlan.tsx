'use client';

// =============================================================================
// Today — las tareas del plan con su check (marcar hecha + Deshacer en el toast)
// =============================================================================
// La escritura es `marcarHechaAction` (app/m/plan/acciones.ts): relee la fila, la guarda
// por el camino de cada tablero y llama a `refresh()`, así que la página vuelve a leer
// sola. Acá sólo se esconde la fila MIENTRAS tanto (optimista) y se la devuelve si falla.
//
// El check es el control visible; el swipe a la derecha hace lo mismo (regla de la casa:
// ningún gesto sin su botón equivalente). Sin conexión, el check se apaga con el motivo.
// =============================================================================

import { useState, useTransition } from 'react';
import { FilaM, useConexion, useToastM } from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';
import { marcarHechaAction } from '@/app/m/plan/acciones';
import type { ItemPlan } from '@/app/plan/board/hoy';

const BANDA: Record<ItemPlan['banda'], string> = { alta: 'Alta', media: 'Media', baja: 'Baja', futuro: 'A futuro' };

function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
}

export function FilasPlan({ items }: { items: ItemPlan[] }) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(new Set());
  const [, empezar] = useTransition();

  const mostrar = (id: string, si: boolean) =>
    setOcultas((prev) => {
      const s = new Set(prev);
      if (si) s.delete(id); else s.add(id);
      return s;
    });

  const completar = (item: ItemPlan) => {
    if (!enLinea) return;
    haptico('light');
    mostrar(item.id, false);
    empezar(async () => {
      const r = await marcarHechaAction(item.id, true);
      if (!r.ok) {
        mostrar(item.id, true);
        haptico('error');
        toast(r.error);
        return;
      }
      if (r.yaEstaba) { toast('Ya estaba hecha'); return; }
      toast('Tarea completada', {
        deshacer: () => {
          mostrar(item.id, true);
          empezar(async () => {
            const d = await marcarHechaAction(item.id, false, { prev: r.prev, entryId: r.entryId });
            if (!d.ok) toast(d.error);
          });
        },
      });
    });
  };

  const visibles = items.filter((i) => !ocultas.has(i.id));
  if (!visibles.length) return null;

  return (
    <div className="m-lista">
      {visibles.map((item) => {
        const meta = [item.proyecto ? `${item.proyecto.emoji} ${item.proyecto.nombre}`.trim() : null, BANDA[item.banda]]
          .filter(Boolean).join(' · ');
        return (
          <FilaM
            key={item.id}
            titulo={item.titulo}
            segunda={meta || undefined}
            riel={item.deadline ? <span className={item.vencida ? 'm-hoy-vencida' : undefined}>{item.vencida ? 'Vencida' : fechaCorta(item.deadline)}</span> : undefined}
            leading={
              <button
                type="button"
                className="m-hoy-check"
                onClick={() => completar(item)}
                disabled={!enLinea}
                aria-label={enLinea ? `Completar «${item.titulo}»` : 'Sin conexión: no se puede completar'}
              >
                <span aria-hidden />
              </button>
            }
            swipeDerecha={enLinea ? { rotulo: 'Completar', icono: 'check', tono: 'completar', onAccion: () => completar(item) } : undefined}
          />
        );
      })}
    </div>
  );
}
