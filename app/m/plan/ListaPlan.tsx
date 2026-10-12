'use client';

// =============================================================================
// ListaPlan — las listas de tareas del teléfono (Prioridades · Hoy · Esta semana)
// =============================================================================
// Una sola pieza para /m/plan y para la sección Plan de Today: recibe las listas
// ya armadas por el server (`leerPlanHoy`) y se encarga del ÚNICO gesto de
// escritura que el teléfono tiene sobre el plan, «marcar hecha», con su Deshacer.
// Tocar una tarea abre una hoja de lectura; editar se queda en la computadora.
//
// MARCAR: el check (o el swipe a la derecha, que es su equivalente) saca la fila
// en el acto —optimista— y llama a `marcarHechaAction`. Si el server dice que no,
// la fila VUELVE y el toast dice por qué. Si dice que sí, el toast «Completada»
// lleva Deshacer, que vuelve a llamar con `{ prev, entryId }`. La action llama a
// `refresh()`, así que la página se re-pide sola (las 5 prioridades se rellenan).
//
// ⚠️ LO OCULTO SE GUARDA POR ID, NO SE BORRA DE LAS PROPS. Después de marcar, el
// refresco trae las listas SIN esa tarea y el estado local deja de importar; si
// el refresco tarda, el estado la sigue escondiendo. Al revés con Deshacer: se
// suelta el id y la tarea reaparece cuando el server la vuelve a mandar.
//
// ⚠️ UNA TAREA NO SALE DOS VECES. `hoy` ya viene sin las de `prioridades`, pero
// `semana` trae todas (lib/plan-hoy.ts): acá se le sacan las que ya están arriba.
//
// ⚠️ EL SWIPE SALE CON LA FILA YA INVISIBLE. FilaM la lleva fuera de la pantalla,
// llama a `onAccion` y la devuelve a su lugar en el mismo tick: si la fila no se
// escondiera de forma SÍNCRONA (flushSync), se vería volver un frame antes de irse.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { FilaM, SeccionM, SheetM, VacioM, useConexion, useToastM } from '@/app/m/_ui';
import { ButtonLink } from '@/app/_ui/Button';
import { TONO } from '@/app/_ui/tokens';
import { haptico } from '@/lib/haptico';
import { marcarHechaAction } from '@/app/m/plan/acciones';
import type { ItemPlan, ResultadoMarcar } from '@/app/plan/board/hoy';
import { CheckTarea } from './CheckTarea';
import './plan.css';
import { ROTULO_BANDA, TONO_BANDA, textoVence } from './formato';

export type SeccionPlan = { id: string; titulo: string; items: ItemPlan[] };

/** marcada = el círculo se llena · sale = la fila se va · oculta = ya no se dibuja. */
type Estado = 'marcada' | 'sale' | 'sale-swipe' | 'oculta';

const LLENADO_MS = 160;
const SALIDA_MS = 200;

export function ListaPlan({ secciones, fecha, vacio = 'No tienes tareas para hoy.' }: {
  secciones: SeccionPlan[];
  /** `YYYY-MM-DD` del negocio: contra esto se cuenta «vence hoy». */
  fecha: string;
  vacio?: string;
}) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [abierta, setAbierta] = useState<ItemPlan | null>(null);
  const timers = useRef(new Map<string, number[]>());

  useEffect(() => {
    const t = timers.current;
    return () => { for (const ids of t.values()) ids.forEach((n) => window.clearTimeout(n)); };
  }, []);

  // Sin duplicados entre secciones: gana la primera donde aparece (Prioridades).
  const visibles = useMemo(() => {
    const vistos = new Set<string>();
    return secciones.map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (vistos.has(it.id)) return false;
        vistos.add(it.id);
        return estados[it.id] !== 'oculta';
      }),
    }));
  }, [secciones, estados]);

  const poner = (id: string, e: Estado | null) => setEstados((prev) => {
    const sig = { ...prev };
    if (e) sig[id] = e; else delete sig[id];
    return sig;
  });
  const agendar = (id: string, ms: number, f: () => void) => {
    const n = window.setTimeout(f, ms);
    timers.current.set(id, [...(timers.current.get(id) ?? []), n]);
  };
  const volver = (id: string) => {
    for (const n of timers.current.get(id) ?? []) window.clearTimeout(n);
    timers.current.delete(id);
    poner(id, null);
  };

  const deshacer = async (item: ItemPlan, r: Extract<ResultadoMarcar, { ok: true }>) => {
    let res: ResultadoMarcar;
    try { res = await marcarHechaAction(item.id, false, { prev: r.prev, entryId: r.entryId }); }
    catch { res = { ok: false, error: 'Sin conexión' }; }
    if (res.ok) volver(item.id);
    else { haptico('error'); toast(res.error); }
  };

  const completar = (item: ItemPlan, via: 'check' | 'swipe') => {
    if (!enLinea || estados[item.id]) return;
    if (via === 'check') {
      haptico('light');
      poner(item.id, 'marcada');
      agendar(item.id, LLENADO_MS, () => poner(item.id, 'sale'));
      agendar(item.id, LLENADO_MS + SALIDA_MS, () => poner(item.id, 'oculta'));
    } else {
      flushSync(() => poner(item.id, 'sale-swipe'));
      agendar(item.id, SALIDA_MS, () => poner(item.id, 'oculta'));
    }
    marcarHechaAction(item.id, true)
      .then((r) => {
        if (!r.ok) { volver(item.id); haptico('error'); toast(r.error); return; }
        // Ya estaba hecha (otra pestaña, otra persona): sale igual, sin Deshacer.
        if (r.yaEstaba) { toast('Ya estaba hecha'); return; }
        toast('Completada', { deshacer: () => { void deshacer(item, r); } });
      })
      .catch(() => { volver(item.id); haptico('error'); toast('Sin conexión'); });
  };

  const total = visibles.reduce((n, s) => n + s.items.length, 0);
  if (total === 0) return <VacioM frase={vacio} />;

  return (
    <>
      {visibles.map((s) => s.items.length > 0 && (
        <SeccionM key={s.id} id={`plan-${s.id}`} titulo={s.titulo}>
          <div className="m-lista">
            {s.items.map((it) => (
              <FilaTarea
                key={it.id}
                item={it}
                fecha={fecha}
                estado={estados[it.id]}
                enLinea={enLinea}
                onCompletar={(via) => completar(it, via)}
                onAbrir={() => setAbierta(it)}
              />
            ))}
          </div>
        </SeccionM>
      ))}
      <SheetM
        abierto={!!abierta}
        onCerrar={() => setAbierta(null)}
        titulo={abierta?.titulo ?? ''}
        id="tarea"
        pie={abierta && (
          <ButtonLink href={abierta.linkEscritorio} variant="primary" size="lg" full>Abrir en la computadora</ButtonLink>
        )}
      >
        {abierta && <DetalleTarea item={abierta} fecha={fecha} />}
      </SheetM>
    </>
  );
}

function PillBanda({ banda }: { banda: ItemPlan['banda'] }) {
  const t = TONO[TONO_BANDA[banda]];
  return <span className="mk-pill" style={{ background: t.bg, color: t.ink }}>{ROTULO_BANDA[banda]}</span>;
}

function FilaTarea({ item, fecha, estado, enLinea, onCompletar, onAbrir }: {
  item: ItemPlan;
  fecha: string;
  estado: Estado | undefined;
  enLinea: boolean;
  onCompletar: (via: 'check' | 'swipe') => void;
  onAbrir: () => void;
}) {
  const vence = textoVence(item.deadline, fecha);
  const segunda = item.proyecto || vence ? (
    <>
      {item.proyecto?.nombre}
      {item.proyecto && vence ? ' · ' : null}
      {vence && <span className={item.vencida ? 'm-plan-vencida' : undefined}>{vence}</span>}
    </>
  ) : undefined;

  return (
    <div className="m-plan-item" data-sale={estado === 'sale' ? 'check' : estado === 'sale-swipe' ? 'swipe' : undefined}>
      <div className="m-plan-item__in">
        <FilaM
          titulo={(
            <>
              <span aria-hidden>{item.titulo}</span>
              {/* La fila entera abre el detalle: un botón estirado sobre la fila
                  (el check va por encima). Así FilaM sigue siendo un div con swipe
                  y el check no queda adentro de otro botón. */}
              <button type="button" className="m-plan-abrir" onClick={onAbrir} aria-label={`Ver ${item.titulo}`} />
            </>
          )}
          pill={<PillBanda banda={item.banda} />}
          segunda={segunda}
          chevron
          leading={(
            <CheckTarea
              marcada={estado === 'marcada' || estado === 'sale'}
              onMarcar={() => onCompletar('check')}
              titulo={item.titulo}
              deshabilitado={!enLinea}
              motivo="Sin conexión"
            />
          )}
          swipeDerecha={enLinea && !estado ? { rotulo: 'Completar', icono: 'check', tono: 'completar', onAccion: () => onCompletar('swipe') } : undefined}
        />
      </div>
    </div>
  );
}

function DetalleTarea({ item, fecha }: { item: ItemPlan; fecha: string }) {
  const vence = textoVence(item.deadline, fecha);
  const filas: [string, string][] = [];
  if (item.proyecto) filas.push(['Proyecto', item.proyecto.nombre]);
  filas.push(['Prioridad', ROTULO_BANDA[item.banda]]);
  if (vence) filas.push(['Plazo', vence.charAt(0).toUpperCase() + vence.slice(1)]);
  if (item.esInstancia) filas.push(['Se repite', 'Sí']);
  return (
    <dl className="m-plan-detalle">
      {filas.map(([k, v]) => (
        <div key={k} className="m-plan-detalle__fila">
          <dt>{k}</dt>
          <dd className={k === 'Plazo' && item.vencida ? 'm-plan-vencida' : undefined}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
