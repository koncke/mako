'use client';

// =============================================================================
// ListaPlan — el plan en el teléfono: Hoy · Semana · Prioridades
// =============================================================================
// Recibe las tres listas ya armadas por el server (`leerPlanHoy` + `listaHoy`) y muestra
// UNA a la vez con el segmentado del prototipo (docs/prototipos/mako-mobile-v2.html,
// `#plan`). La fila: casilla redonda · título · el proyecto como punto de su color · el
// plazo en el riel. Tocar la fila abre el detalle en un sheet; editar se queda en la
// computadora.
//
// MARCAR: la casilla (o el swipe a la derecha, su equivalente) la llena, tacha el título,
// y la fila se va sola un momento después. Llama a `marcarHechaAction`: si el server dice
// que no, la fila VUELVE y el toast dice por qué; si dice que sí, el toast «Completada»
// lleva Deshacer, que vuelve a llamar con `{ prev, entryId }`. La action llama a
// `refresh()`, así que la página se re-pide sola (las 5 prioridades se rellenan).
//
// ⚠️ LA FILA QUE SE VA SE SOSTIENE AUNQUE EL SERVER YA NO LA MANDE. El refresco trae las
// listas SIN la tarea, y puede llegar antes de que termine de irse: `conEnTransito`
// (formato.ts) la deja donde estaba hasta que la animación termina. Al terminar, si el
// server ya no la manda, la marca se suelta: si un día vuelve (alguien la reabrió en la
// computadora), se ve. Con Deshacer pasa lo mismo al revés: se suelta la marca y la tarea
// reaparece cuando el server la vuelve a mandar.
//
// ⚠️ UNA TAREA NO SALE DOS VECES en la misma lista (`vistos`): «Hoy» junta dos listas del
// server (`listaHoy`), y si un día la lectura deja de separarlas, se notaría acá.
//
// ⚠️ EL SWIPE SALE CON LA FILA YA INVISIBLE. FilaM la lleva fuera de la pantalla, llama a
// `onAccion` y la devuelve a su lugar en el mismo tick: si la fila no se escondiera de
// forma SÍNCRONA (flushSync), se vería volver un frame antes de irse.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  CasillaM, ComputadoraM, FilaDatoM, FilaM, ListaM, PieM, PildoraM, SegmentadoM, SheetM, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import { Button } from '@/app/_ui/Button';
import { haptico } from '@/lib/haptico';
import { marcarHechaAction } from '@/app/m/plan/acciones';
import type { ItemPlan, ResultadoMarcar } from '@/app/plan/board/hoy';
import { ROTULO_BANDA, TONO_BANDA, colorProyecto, conEnTransito, contar, plazoCorto, textoVence } from './formato';

export type VistaPlan = 'hoy' | 'semana' | 'prioridades';
export type ListasPlan = Record<VistaPlan, ItemPlan[]>;

const VISTAS: { id: VistaPlan; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Semana' },
  { id: 'prioridades', label: 'Prioridades' },
];

/** marcada = llena y tachada · sale = la fila se cierra · sale-swipe = ya cruzó la pantalla · oculta = no se dibuja. */
type Estado = 'marcada' | 'sale' | 'sale-swipe' | 'oculta';
type Marca = { estado: Estado; item: ItemPlan; antes: string | null; vista: VistaPlan };

/** Cuánto se ve tachada antes de irse (el llenado del círculo son 160 ms de esto). */
const SOSTENER_MS = 600;
const SALIDA_MS = 200;

export function ListaPlan({ listas, fecha, abiertas }: {
  listas: ListasPlan;
  /** `YYYY-MM-DD` del negocio: contra esto se cuenta el plazo. */
  fecha: string;
  /** Cuántas tareas abiertas hay en todo el tablero (para decir bien el vacío). */
  abiertas: number;
}) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [vista, setVista] = useState<VistaPlan>('hoy');
  // Map y no objeto: los ids del tablero del cliente son números, y un objeto ordena las
  // claves numéricas — el orden en que se tocaron se perdería.
  const [marcas, setMarcas] = useState<ReadonlyMap<string, Marca>>(new Map());
  const [detalle, setDetalle] = useState<ItemPlan | null>(null);
  const [abierto, setAbierto] = useState(false);
  const timers = useRef(new Map<string, number[]>());
  const idsDelServer = useRef(new Set<string>());

  useEffect(() => {
    const t = timers.current;
    return () => { for (const ids of t.values()) ids.forEach((n) => window.clearTimeout(n)); };
  }, []);

  // Lo que el server manda ahora. Una marca «oculta» de una tarea que ya no viene se suelta.
  useEffect(() => {
    const ids = new Set<string>();
    for (const l of Object.values(listas)) for (const it of l) ids.add(it.id);
    idsDelServer.current = ids;
    setMarcas((prev) => {
      let cambio = false;
      const sig = new Map(prev);
      for (const [id, m] of prev) if (m.estado === 'oculta' && !ids.has(id)) { sig.delete(id); cambio = true; }
      return cambio ? sig : prev;
    });
  }, [listas]);

  const visibles = useMemo(() => {
    const transito = [...marcas.values()].filter((m) => m.vista === vista && m.estado !== 'oculta');
    const vistos = new Set<string>();
    return conEnTransito(listas[vista], transito).filter((it) => {
      if (vistos.has(it.id)) return false;
      vistos.add(it.id);
      return marcas.get(it.id)?.estado !== 'oculta';
    });
  }, [listas, vista, marcas]);

  const poner = (id: string, m: Marca) => setMarcas((prev) => new Map(prev).set(id, m));
  const cambiar = (id: string, estado: Estado) => setMarcas((prev) => {
    const m = prev.get(id);
    if (!m) return prev;
    const sig = new Map(prev);
    // Ya se fue y el server tampoco la manda: no hay nada que esconder.
    if (estado === 'oculta' && !idsDelServer.current.has(id)) sig.delete(id);
    else sig.set(id, { ...m, estado });
    return sig;
  });
  const agendar = (id: string, ms: number, f: () => void) => {
    const n = window.setTimeout(f, ms);
    timers.current.set(id, [...(timers.current.get(id) ?? []), n]);
  };
  const volver = (id: string) => {
    for (const n of timers.current.get(id) ?? []) window.clearTimeout(n);
    timers.current.delete(id);
    setMarcas((prev) => {
      if (!prev.has(id)) return prev;
      const sig = new Map(prev);
      sig.delete(id);
      return sig;
    });
  };

  const deshacer = async (item: ItemPlan, r: Extract<ResultadoMarcar, { ok: true }>) => {
    let res: ResultadoMarcar;
    try { res = await marcarHechaAction(item.id, false, { prev: r.prev, entryId: r.entryId }); }
    catch { res = { ok: false, error: 'Sin conexión' }; }
    if (res.ok) volver(item.id);
    else { haptico('error'); toast(res.error); }
  };

  const completar = (item: ItemPlan, via: 'check' | 'swipe') => {
    if (!enLinea || marcas.has(item.id)) return;
    const i = visibles.findIndex((x) => x.id === item.id);
    const base = { item, antes: i > 0 ? visibles[i - 1].id : null, vista };
    if (via === 'check') {
      haptico('light');
      poner(item.id, { ...base, estado: 'marcada' });
      agendar(item.id, SOSTENER_MS, () => cambiar(item.id, 'sale'));
      agendar(item.id, SOSTENER_MS + SALIDA_MS, () => cambiar(item.id, 'oculta'));
    } else {
      flushSync(() => poner(item.id, { ...base, estado: 'sale-swipe' }));
      agendar(item.id, SALIDA_MS, () => cambiar(item.id, 'oculta'));
    }
    marcarHechaAction(item.id, true)
      .then((r) => {
        if (!r.ok) { volver(item.id); haptico('error'); toast(r.error); return; }
        // Ya estaba hecha (otra pestaña, otra persona): se va igual, sin Deshacer.
        if (r.yaEstaba) { toast('Ya estaba hecha'); return; }
        toast('Completada', { deshacer: () => { void deshacer(item, r); } });
      })
      .catch(() => { volver(item.id); haptico('error'); toast('Sin conexión'); });
  };

  const abrir = (it: ItemPlan) => { setDetalle(it); setAbierto(true); };
  const vacio = vista === 'hoy' ? 'Nada vence hoy.'
    : vista === 'semana' ? 'Nada vence esta semana.'
      : abiertas === 0 ? 'No hay tareas abiertas.' : 'Ninguna prioridad por ahora.';
  const detalleMarcado = detalle ? marcas.has(detalle.id) : false;

  return (
    <>
      <div className="m-plan-seg">
        <SegmentadoM etiqueta="Vista" valor={vista} onCambio={setVista} opciones={VISTAS} />
      </div>

      <div className="m-plan-cuerpo">
        {visibles.length === 0 ? (
          <VacioM frase={vacio} />
        ) : (
          <ListaM etiqueta={contar(visibles.length, 'tarea', 'tareas')}>
            {visibles.map((it) => (
              <FilaTarea
                key={it.id}
                item={it}
                fecha={fecha}
                estado={marcas.get(it.id)?.estado}
                enLinea={enLinea}
                onCompletar={(via) => completar(it, via)}
                onAbrir={() => abrir(it)}
              />
            ))}
          </ListaM>
        )}
      </div>

      {/* Mientras se cierra, el pie se queda: si se fuera, la hoja se achica a mitad de la salida. */}
      <SheetM
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo={detalle?.titulo ?? ''}
        id="tarea"
        pie={detalle && !(abierto && detalleMarcado) ? (
          <PieM>
            <Button
              variant="primary"
              size="lg"
              full
              disabled={!enLinea}
              onClick={() => { setAbierto(false); completar(detalle, 'check'); }}
            >
              Completar tarea
            </Button>
          </PieM>
        ) : undefined}
      >
        {detalle && <DetalleTarea item={detalle} fecha={fecha} />}
      </SheetM>
    </>
  );
}

/** El proyecto como en el prototipo: su punto de color y su nombre. */
function Proyecto({ p }: { p: NonNullable<ItemPlan['proyecto']> }) {
  const color = colorProyecto(p);
  return (
    <span className="m-plan-proy">
      <i className="m-plan-punto" style={color ? { background: color } : undefined} aria-hidden />
      {p.nombre}
    </span>
  );
}

function FilaTarea({ item, fecha, estado, enLinea, onCompletar, onAbrir }: {
  item: ItemPlan;
  fecha: string;
  estado: Estado | undefined;
  enLinea: boolean;
  onCompletar: (via: 'check' | 'swipe') => void;
  onAbrir: () => void;
}) {
  const plazo = plazoCorto(item.deadline, fecha);
  return (
    <div className="m-plan-item" data-estado={estado}>
      <div className="m-plan-item__in">
        <FilaM
          titulo={(
            <>
              <span aria-hidden>{item.titulo}</span>
              {/* La fila entera abre el detalle: un botón estirado sobre la fila (la casilla
                  va por encima). Así FilaM sigue siendo un div con swipe y la casilla no
                  queda adentro de otro botón. */}
              <button type="button" className="m-plan-abrir" onClick={onAbrir} aria-label={`Ver ${item.titulo}`} />
            </>
          )}
          segunda={item.proyecto ? <Proyecto p={item.proyecto} /> : undefined}
          riel={plazo ? (
            <span className="m-plan-plazo" data-vencida={item.vencida || undefined}>
              {item.vencida && <span className="m-sr">Vencida, </span>}
              {plazo}
            </span>
          ) : undefined}
          chevron={false}
          leading={(
            <CasillaM
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
  return (
    <>
      <ListaM>
        {item.proyecto && <FilaDatoM k="Proyecto" v={<Proyecto p={item.proyecto} />} />}
        <FilaDatoM k="Prioridad" v={<PildoraM tono={TONO_BANDA[item.banda]}>{ROTULO_BANDA[item.banda]}</PildoraM>} />
        {vence && <FilaDatoM k="Plazo" v={vence.charAt(0).toUpperCase() + vence.slice(1)} />}
        {item.esInstancia && <FilaDatoM k="Se repite" v="Sí" />}
      </ListaM>
      <ComputadoraM que="Editar la tarea" />
    </>
  );
}
