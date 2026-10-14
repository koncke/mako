'use client';

// =============================================================================
// Plan — las prioridades y los proyectos del Plan, con las MISMAS tarjetas del Plan
// =============================================================================
// Martín, 14/10/2026: «Tenemos un diseño de tarjetas para las tareas y proyectos del plan e hiciste cualquier cosa. Por
// favor rediseña completamente cada bloque». El bloque «Prioridades del Plan» es la vista Prioridades del Plan: el
// Objetivo Principal a la izquierda (`ProyectoCardTile`) y las tareas a la derecha (`TarjetaPrioridad`), las dos
// exportadas de app/plan/board/BoardShell.tsx. «Proyectos del Plan» es la grilla de proyectos con la misma tarjeta.
//
// ⚠️ LAS TARJETAS SE IMPORTAN, NO SE COPIAN: una segunda copia del dibujo es la que se queda vieja. El módulo del
//    tablero es grande, así que llega con `next/dynamic` (un pedazo aparte, sólo cuando hay un bloque del Plan).
// ⚠️ «Completar» es la escritura del teléfono (`marcarHechaAction`, app/m/plan/acciones.ts): relee la fila y guarda por
//    el camino de cada tablero (el del dueño y el de un cliente), con su Deshacer.
// =============================================================================

import dynamic from 'next/dynamic';
import { useRef, useState, type CSSProperties } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { projProgress, proyectoTerminado } from '@/app/plan/board/piezas';
import type { BoardTask, Label } from '@/app/plan/board/types';
import { marcarHechaAction } from '@/app/m/plan/acciones';
import { opcionDe, numeroDe, type OpcionesElegidas } from '@/lib/general-piezas';
import type { DatosGeneral } from '../datos-tipos';
import { Cabeza, Fallo, Placeholder } from './comun';
import { proyectosMuestra, tareasMuestra } from './muestras';

const ProyectoCardTile = dynamic(() => import('@/app/plan/board/BoardShell').then((m) => m.ProyectoCardTile));
const TarjetaPrioridad = dynamic(() => import('@/app/plan/board/BoardShell').then((m) => m.TarjetaPrioridad));

const nada = () => {};

/** El Objetivo Principal y las tareas, como la vista Prioridades del Plan. */
function VistaPrioridades({ tareas, objetivo, etiquetas, todasLasTareas, conObjetivo, onOpen, onOpenProj, onCompletar }: {
  tareas: BoardTask[]; objetivo: Label | null; etiquetas: Label[]; todasLasTareas: BoardTask[]; conObjetivo: boolean;
  onOpen: (id: string) => void; onOpenProj: (id: string) => void; onCompletar: (t: BoardTask) => void;
}) {
  const porId = new Map(etiquetas.map((l) => [l.id, l]));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
      {conObjetivo && objetivo && (
        <div style={{ flex: '0 1 320px', minWidth: 240, display: 'flex' }}>
          <ProyectoCardTile l={objetivo} prog={projProgress(todasLasTareas, objetivo.id)} isTop onOpen={() => onOpenProj(objetivo.id)} />
        </div>
      )}
      <div style={{ flex: '2 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tareas.map((t, i) => (
          <TarjetaPrioridad key={t.id} t={t} puesto={i + 1}
            proyectos={t.labels.map((id) => porId.get(id)).filter((l): l is Label => !!l)}
            emoji={t.emoji || '📌'} onOpen={onOpen} onOpenProj={onOpenProj} onCompletar={() => onCompletar(t)} />
        ))}
      </div>
    </div>
  );
}

export function BloquePrioridades({ d, op }: { d: DatosGeneral['plan']; op?: OpcionesElegidas }) {
  const router = useRouter();
  const { toast, show, clear } = useToast();
  const [hechas, setHechas] = useState<ReadonlySet<string>>(new Set());
  const enCurso = useRef(false);
  if (!d.ok) return <Fallo titulo="Prioridades del Plan" error={d.error} />;
  const cuantas = numeroDe(opcionDe('prioridades', op, 'cuantas'));
  const conObjetivo = opcionDe('prioridades', op, 'objetivo') === 'si';
  const tareas = d.d.prioridades.filter((t) => !hechas.has(t.id)).slice(0, cuantas);
  const abrir = (id: string) => router.push(`/plan?tarea=${encodeURIComponent(id)}`);
  const abrirProyecto = (id: string) => router.push(`/plan?proyecto=${encodeURIComponent(id)}`);

  const completar = async (t: BoardTask) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setHechas((s) => new Set(s).add(t.id));
    try {
      const r = await marcarHechaAction(t.id, true);
      if (!r.ok) { setHechas((s) => { const n = new Set(s); n.delete(t.id); return n; }); show(r.error, undefined, 'bad'); return; }
      if (r.yaEstaba) return;
      show('Tarea completada', async () => {
        setHechas((s) => { const n = new Set(s); n.delete(t.id); return n; });
        const v = await marcarHechaAction(t.id, false, { prev: r.prev, entryId: r.entryId });
        if (!v.ok) show(v.error, undefined, 'bad');
      });
    } catch (e) {
      console.error('[general] completar:', e instanceof Error ? e.message : String(e));
      setHechas((s) => { const n = new Set(s); n.delete(t.id); return n; });
      show('No se pudo completar', undefined, 'bad');
    } finally {
      enCurso.current = false;
    }
  };

  const objetivo = d.d.objetivo;
  return (
    <div className="gb">
      <Cabeza titulo="Prioridades del Plan" extra={objetivo ? `${objetivo.emoji} ${objetivo.name}` : null} href="/plan" link="Abrir el Plan" />
      {tareas.length ? (
        <VistaPrioridades tareas={tareas} objetivo={objetivo} etiquetas={[...d.d.etiquetas, ...(objetivo ? [objetivo] : [])]}
          todasLasTareas={d.d.tareasDeProyectos} conObjetivo={conObjetivo} onOpen={abrir} onOpenProj={abrirProyecto} onCompletar={(t) => { void completar(t); }} />
      ) : (
        <Placeholder
          muestra={<MuestraVistaPrioridades cuantas={cuantas} conObjetivo={conObjetivo} />}
          texto={hechas.size ? 'Completaste las prioridades de hoy.' : 'No hay tareas abiertas en el Plan.'}
          accion={{ href: '/plan', rotulo: 'Abrir el Plan' }}
        />
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

function MuestraVistaPrioridades({ cuantas, conObjetivo }: { cuantas: number; conObjetivo: boolean }) {
  const ps = proyectosMuestra();
  const ts = tareasMuestra();
  return <VistaPrioridades tareas={ts.slice(0, cuantas)} objetivo={ps[0]} etiquetas={ps} todasLasTareas={ts} conObjetivo={conObjetivo} onOpen={nada} onOpenProj={nada} onCompletar={nada} />;
}

export function MuestraPrioridades({ op }: { op?: OpcionesElegidas }) {
  return (
    <div className="gb">
      <Cabeza titulo="Prioridades del Plan" extra="🚀 Lanzar la oferta nueva" />
      <MuestraVistaPrioridades cuantas={numeroDe(opcionDe('prioridades', op, 'cuantas'))} conObjetivo={opcionDe('prioridades', op, 'objetivo') === 'si'} />
    </div>
  );
}

// ── Los proyectos ───────────────────────────────────────────────────────────────────────────────────────────────────

const GRILLA: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12, alignItems: 'stretch' };

/** Los proyectos que se dibujan, en el orden elegido: los más prioritarios, o los que vencen antes. Los terminados no. */
export function proyectosAMostrar(proyectos: Label[], tareas: BoardTask[], orden: string, cuantos: number): Label[] {
  const vivos = proyectos.filter((l) => !proyectoTerminado(projProgress(tareas, l.id)));
  const ordenados = orden === 'deadline'
    ? vivos.filter((l) => l.deadline).sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    : [...vivos].sort((a, b) => b.score - a.score);
  return ordenados.slice(0, cuantos);
}

function Grilla({ proyectos, tareas, objetivoId, onOpen }: { proyectos: Label[]; tareas: BoardTask[]; objetivoId: string | null; onOpen: (id: string) => void }) {
  return (
    <div style={GRILLA}>
      {proyectos.map((l) => (
        <div key={l.id} style={{ display: 'flex', minWidth: 0 }}>
          <ProyectoCardTile l={l} prog={projProgress(tareas, l.id)} isTop={l.id === objetivoId} onOpen={() => onOpen(l.id)} />
        </div>
      ))}
    </div>
  );
}

export function BloqueProyectos({ d, op }: { d: DatosGeneral['plan']; op?: OpcionesElegidas }) {
  const router = useRouter();
  if (!d.ok) return <Fallo titulo="Proyectos del Plan" error={d.error} />;
  const cuantos = numeroDe(opcionDe('proyectos', op, 'cuantos'));
  const orden = opcionDe('proyectos', op, 'orden');
  const objetivoId = d.d.objetivo?.id ?? null;
  const lista = proyectosAMostrar(d.d.proyectos, d.d.tareasDeProyectos, orden, cuantos);
  return (
    <div className="gb">
      <Cabeza titulo="Proyectos del Plan" href="/plan?vista=proyectos" link="Ver todos" />
      {lista.length ? (
        <Grilla proyectos={lista} tareas={d.d.tareasDeProyectos} objetivoId={objetivoId} onOpen={(id) => router.push(`/plan?proyecto=${encodeURIComponent(id)}`)} />
      ) : (
        <Placeholder
          muestra={<Grilla proyectos={proyectosMuestra().slice(0, cuantos)} tareas={tareasMuestra()} objetivoId="pm1" onOpen={nada} />}
          texto={orden === 'deadline' ? 'Ningún proyecto abierto tiene deadline.' : 'Todavía no hay proyectos abiertos.'}
          accion={{ href: '/plan?vista=proyectos', rotulo: 'Abrir el Plan' }}
        />
      )}
    </div>
  );
}

export function MuestraProyectos({ op }: { op?: OpcionesElegidas }) {
  return (
    <div className="gb">
      <Cabeza titulo="Proyectos del Plan" />
      <Grilla proyectos={proyectosMuestra().slice(0, numeroDe(opcionDe('proyectos', op, 'cuantos')))} tareas={tareasMuestra()} objetivoId="pm1" onOpen={nada} />
    </div>
  );
}
