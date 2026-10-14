'use client';

// =============================================================================
// Plan — las tareas prioritarias, las prioridades y los proyectos del Plan, y los próximos deadlines
// =============================================================================
// Martín, 14/10/2026: «Tenemos un diseño de tarjetas para las tareas y proyectos del plan e hiciste cualquier cosa. Por
// favor rediseña completamente cada bloque». El bloque «Prioridades del Plan» es la vista Prioridades del Plan: el
// Objetivo Principal a la izquierda (`ProyectoCardTile`) y las tareas a la derecha (`TarjetaPrioridad`), las dos
// exportadas de app/plan/board/BoardShell.tsx.
//
// La tercera vuelta (el mismo día: «muchos bloques los copiaste de otros lados, como el de Prioridades, pero no están
// interactuando con el diseño de la página» y «Faltan bloques... como el de "Tareas Prioritarias"... si quiero que muestre
// 1 tarea, 3 tareas, 5, 10»):
//   · las tarjetas del Plan van adentro de `gb-plan` (./comun.tsx): su fondo es la losa de la hoja y no llevan borde, así
//     que no son una tarjeta dentro de la tarjeta;
//   · «Tareas prioritarias» es la lista de lo que más mueve la aguja, con su opción de cuántas (1, 3, 5 o 10), como lista
//     de la hoja o con las tarjetas del Plan, y con o sin su proyecto;
//   · «Proyectos del Plan» dibuja la ANATOMÍA de la tarjeta del Plan (la portada, la marca que la cruza, el título, el
//     avance y el deadline) a la escala de un bloque: la del tablero mide 360 px de alto, que en una hoja es un hueco;
//   · «Próximos deadlines»: lo que vence pronto y lo que ya se pasó, tareas y proyectos.
//
// ⚠️ LAS PIEZAS SE IMPORTAN, NO SE COPIAN: la tarjeta de una tarea, la de un proyecto, la línea del deadline, la marca, la
//    portada y el avance son las del Plan. El módulo del tablero es grande, así que llega con `next/dynamic`.
// ⚠️ «Completar» es la escritura del teléfono (`marcarHechaAction`, app/m/plan/acciones.ts): relee la fila y guarda por
//    el camino de cada tablero (el del dueño y el de un cliente), con su Deshacer.
// ⚠️ «Hoy» es el del NEGOCIO (`d.d.hoy`, lo manda el server): el plazo de un deadline sale igual en los dos lados.
// =============================================================================

import dynamic from 'next/dynamic';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { Marca } from '@/app/_components/Marca';
import { LineaDeadline, diasHasta, plazoTexto, projProgress, proyectoTerminado } from '@/app/plan/board/piezas';
import type { BoardTask, Label } from '@/app/plan/board/types';
import { marcarHechaAction } from '@/app/m/plan/acciones';
import { fondoPortada } from '@/lib/portadas';
import { opcionDe, numeroDe, type OpcionesElegidas } from '@/lib/general-piezas';
import type { DatosGeneral } from '../datos-tipos';
import { Cabeza, Fallo, Placeholder } from './comun';
import { hoyMuestra, proyectosMuestra, tareasMuestra } from './muestras';

const ProyectoCardTile = dynamic(() => import('@/app/plan/board/BoardShell').then((m) => m.ProyectoCardTile));
const TarjetaPrioridad = dynamic(() => import('@/app/plan/board/BoardShell').then((m) => m.TarjetaPrioridad));

const nada = () => {};

/** Completar una tarea desde General: se va de la lista, vuelve si falla, y el toast trae «Deshacer». */
function useCompletar() {
  const { toast, show, clear } = useToast();
  const [hechas, setHechas] = useState<ReadonlySet<string>>(new Set());
  const enCurso = useRef(false);
  const volver = (id: string) => setHechas((s) => { const n = new Set(s); n.delete(id); return n; });
  const completar = async (t: BoardTask) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setHechas((s) => new Set(s).add(t.id));
    try {
      const r = await marcarHechaAction(t.id, true);
      if (!r.ok) { volver(t.id); show(r.error, undefined, 'bad'); return; }
      if (r.yaEstaba) return;
      show('Tarea completada', async () => {
        volver(t.id);
        const v = await marcarHechaAction(t.id, false, { prev: r.prev, entryId: r.entryId });
        if (!v.ok) show(v.error, undefined, 'bad');
      });
    } catch (e) {
      console.error('[general] completar:', e instanceof Error ? e.message : String(e));
      volver(t.id);
      show('No se pudo completar', undefined, 'bad');
    } finally {
      enCurso.current = false;
    }
  };
  return { hechas, completar: (t: BoardTask) => { void completar(t); }, toast: <Toast state={toast} onClose={clear} /> };
}

const useAbrir = () => {
  const router = useRouter();
  return {
    tarea: (id: string) => router.push(`/plan?tarea=${encodeURIComponent(id)}`),
    proyecto: (id: string) => router.push(`/plan?proyecto=${encodeURIComponent(id)}`),
  };
};

// ── Las prioridades del Plan (la vista Prioridades) ──────────────────────────────────────────────────────────────────

/** El Objetivo Principal y las tareas, como la vista Prioridades del Plan. */
function VistaPrioridades({ tareas, objetivo, etiquetas, todasLasTareas, conObjetivo, onOpen, onOpenProj, onCompletar }: {
  tareas: BoardTask[]; objetivo: Label | null; etiquetas: Label[]; todasLasTareas: BoardTask[]; conObjetivo: boolean;
  onOpen: (id: string) => void; onOpenProj: (id: string) => void; onCompletar: (t: BoardTask) => void;
}) {
  const porId = new Map(etiquetas.map((l) => [l.id, l]));
  return (
    <div className="gb-plan" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
      {conObjetivo && objetivo && (
        <div style={{ flex: '0 1 300px', minWidth: 230, display: 'flex' }}>
          <ProyectoCardTile l={objetivo} prog={projProgress(todasLasTareas, objetivo.id)} isTop onOpen={() => onOpenProj(objetivo.id)} />
        </div>
      )}
      <div style={{ flex: '2 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
  const abrir = useAbrir();
  const { hechas, completar, toast } = useCompletar();
  if (!d.ok) return <Fallo titulo="Prioridades del Plan" error={d.error} />;
  const cuantas = numeroDe(opcionDe('prioridades', op, 'cuantas'));
  const conObjetivo = opcionDe('prioridades', op, 'objetivo') === 'si';
  const tareas = d.d.prioridades.filter((t) => !hechas.has(t.id)).slice(0, cuantas);
  const objetivo = d.d.objetivo;
  return (
    <div className="gb">
      <Cabeza titulo="Prioridades del Plan" extra={objetivo ? `${objetivo.emoji} ${objetivo.name}` : null} href="/plan" link="Abrir el Plan" />
      {tareas.length ? (
        <VistaPrioridades tareas={tareas} objetivo={objetivo} etiquetas={[...d.d.etiquetas, ...(objetivo ? [objetivo] : [])]}
          todasLasTareas={d.d.tareasDeProyectos} conObjetivo={conObjetivo} onOpen={abrir.tarea} onOpenProj={abrir.proyecto} onCompletar={completar} />
      ) : (
        <Placeholder
          muestra={<MuestraVistaPrioridades cuantas={cuantas} conObjetivo={conObjetivo} />}
          texto={hechas.size ? 'Completaste las prioridades de hoy.' : 'No hay tareas abiertas en el Plan.'}
          accion={{ href: '/plan', rotulo: 'Abrir el Plan' }}
        />
      )}
      {toast}
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

// ── Las tareas prioritarias ─────────────────────────────────────────────────────────────────────────────────────────

/** El proyecto de una tarea, como un chip con su color. */
function ChipProyecto({ l }: { l: Label }) {
  return (
    <span className="gb-chip" style={{ maxWidth: '100%', minWidth: 0 }} title={l.name}>
      <span aria-hidden style={{ flex: 'none', width: 7, height: 7, borderRadius: 2, background: l.color }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
    </span>
  );
}

const NUMERO: CSSProperties = { flex: 'none', width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, background: 'var(--primary)', color: 'var(--on-primary, #fff)' };

/** Una tarea en la lista de la hoja: su puesto, el título, su proyecto y su deadline, y el círculo para completarla. */
function FilaTarea({ t, puesto, proyecto, hoy, onOpen, onCompletar }: {
  t: BoardTask; puesto: number; proyecto: Label | null; hoy: string; onOpen: () => void; onCompletar: () => void;
}) {
  return (
    <div className="gb-fila" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <span style={NUMERO} className="gb-num">{puesto}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span title={t.title} style={{ fontSize: 'clamp(14.5px, 3cqi, 17px)', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{t.title}</span>
        {(proyecto || t.deadline) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {proyecto && <ChipProyecto l={proyecto} />}
            {t.deadline && <LineaDeadline iso={t.deadline} hoy={hoy} tam={12} mono={false} color="var(--dim)" style={{ flex: '0 1 auto' }} />}
          </span>
        )}
      </span>
      <button type="button" aria-label={`Marcar «${t.title}» como completada`} title="Completar"
        onClick={(e) => { e.stopPropagation(); onCompletar(); }}
        style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', border: '2px solid var(--border-strong)', background: 'transparent', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', color: 'var(--faint)' }}>
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5L20 7" /></svg>
      </button>
    </div>
  );
}

function ListaTareas({ tareas, etiquetas, hoy, vista, conProyecto, onOpen, onOpenProj, onCompletar }: {
  tareas: BoardTask[]; etiquetas: Label[]; hoy: string; vista: string; conProyecto: boolean;
  onOpen: (id: string) => void; onOpenProj: (id: string) => void; onCompletar: (t: BoardTask) => void;
}) {
  const porId = new Map(etiquetas.map((l) => [l.id, l]));
  const de = (t: BoardTask) => (conProyecto ? t.labels.map((id) => porId.get(id)).filter((l): l is Label => !!l) : []);
  if (vista === 'tarjetas') {
    return (
      <div className="gb-plan" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tareas.map((t, i) => (
          <TarjetaPrioridad key={t.id} t={t} puesto={i + 1} proyectos={de(t)} emoji={t.emoji || '📌'}
            onOpen={onOpen} onOpenProj={onOpenProj} onCompletar={() => onCompletar(t)} />
        ))}
      </div>
    );
  }
  return (
    <div>
      {tareas.map((t, i) => (
        <FilaTarea key={t.id} t={t} puesto={i + 1} proyecto={de(t)[0] ?? null} hoy={hoy} onOpen={() => onOpen(t.id)} onCompletar={() => onCompletar(t)} />
      ))}
    </div>
  );
}

export function BloqueTareas({ d, op }: { d: DatosGeneral['plan']; op?: OpcionesElegidas }) {
  const abrir = useAbrir();
  const { hechas, completar, toast } = useCompletar();
  if (!d.ok) return <Fallo titulo="Tareas prioritarias" error={d.error} />;
  const cuantas = numeroDe(opcionDe('tareas', op, 'cuantas'));
  const vista = opcionDe('tareas', op, 'vista');
  const conProyecto = opcionDe('tareas', op, 'proyecto') === 'si';
  const tareas = d.d.top.filter((t) => !hechas.has(t.id)).slice(0, cuantas);
  return (
    <div className="gb">
      <Cabeza titulo="Tareas prioritarias" href="/plan" link="Abrir el Plan" />
      {tareas.length ? (
        <ListaTareas tareas={tareas} etiquetas={d.d.etiquetas} hoy={d.d.hoy} vista={vista} conProyecto={conProyecto}
          onOpen={abrir.tarea} onOpenProj={abrir.proyecto} onCompletar={completar} />
      ) : (
        <Placeholder muestra={<MuestraListaTareas cuantas={cuantas} vista={vista} conProyecto={conProyecto} />}
          texto={hechas.size ? 'Completaste tus tareas prioritarias.' : 'No hay tareas abiertas en el Plan.'}
          accion={{ href: '/plan', rotulo: 'Abrir el Plan' }} />
      )}
      {toast}
    </div>
  );
}

function MuestraListaTareas({ cuantas, vista, conProyecto }: { cuantas: number; vista: string; conProyecto: boolean }) {
  return <ListaTareas tareas={tareasMuestra().slice(0, cuantas)} etiquetas={proyectosMuestra()} hoy={hoyMuestra()} vista={vista} conProyecto={conProyecto} onOpen={nada} onOpenProj={nada} onCompletar={nada} />;
}

export function MuestraTareas({ op }: { op?: OpcionesElegidas }) {
  return (
    <div className="gb">
      <Cabeza titulo="Tareas prioritarias" />
      <MuestraListaTareas cuantas={Math.min(5, numeroDe(opcionDe('tareas', op, 'cuantas')))} vista={opcionDe('tareas', op, 'vista')} conProyecto={opcionDe('tareas', op, 'proyecto') === 'si'} />
    </div>
  );
}

// ── Los proyectos ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Los proyectos que se dibujan, en el orden elegido: los más prioritarios, o los que vencen antes. Los terminados no. */
export function proyectosAMostrar(proyectos: Label[], tareas: BoardTask[], orden: string, cuantos: number): Label[] {
  const vivos = proyectos.filter((l) => !proyectoTerminado(projProgress(tareas, l.id)));
  const ordenados = orden === 'deadline'
    ? vivos.filter((l) => l.deadline).sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    : [...vivos].sort((a, b) => b.score - a.score);
  return ordenados.slice(0, cuantos);
}

/**
 * Un proyecto con la anatomía de su tarjeta del Plan —la portada, la marca que la cruza, el título, el avance y el
 * deadline— a la escala de un bloque. Una losa, no una tarjeta dentro de la tarjeta.
 */
function TarjetaProyecto({ l, prog, principal, hoy, onOpen }: {
  l: Label; prog: { total: number; done: number; pct: number }; principal: boolean; hoy: string; onOpen: () => void;
}) {
  return (
    <div className="gb-losa" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', cursor: 'pointer' }} title={l.name}>
      <span aria-hidden style={{ position: 'relative', height: 46, background: fondoPortada(l.portada, l.color, l.portadaY), flex: 'none' }}>
        <span style={{ position: 'absolute', left: 12, bottom: -14, borderRadius: 8, lineHeight: 0, boxShadow: '0 0 0 3px var(--gb-fondo, var(--surface))' }}>
          <Marca icono={l.icono} emoji={l.emoji} nombre={l.name} tam={28} color={l.color} cuadrado />
        </span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 12px 12px', minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{l.name}</span>
          {principal && <span className="gb-chip" style={{ flex: 'none', color: 'var(--primary)' }}>Principal</span>}
        </span>
        <span style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span aria-hidden style={{ display: 'block', height: 6, borderRadius: 999, background: 'var(--gb-losa-2)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.min(100, prog.pct)}%`, borderRadius: 999, background: l.color }} />
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--dim)', minWidth: 0 }}>
            <span className="gb-num" style={{ flex: 'none' }}>{prog.total ? `${prog.done}/${prog.total} · ${prog.pct}%` : 'Sin tareas'}</span>
            {l.deadline && <LineaDeadline iso={l.deadline} hoy={hoy} tam={12} mono={false} color="var(--dim)" style={{ flex: '0 1 auto', marginLeft: 'auto' }} />}
          </span>
        </span>
      </span>
    </div>
  );
}

function Grilla({ proyectos, tareas, objetivoId, hoy, onOpen }: { proyectos: Label[]; tareas: BoardTask[]; objetivoId: string | null; hoy: string; onOpen: (id: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, alignItems: 'stretch' }}>
      {proyectos.map((l) => (
        <TarjetaProyecto key={l.id} l={l} prog={projProgress(tareas, l.id)} principal={l.id === objetivoId} hoy={hoy} onOpen={() => onOpen(l.id)} />
      ))}
    </div>
  );
}

export function BloqueProyectos({ d, op }: { d: DatosGeneral['plan']; op?: OpcionesElegidas }) {
  const abrir = useAbrir();
  if (!d.ok) return <Fallo titulo="Proyectos del Plan" error={d.error} />;
  const cuantos = numeroDe(opcionDe('proyectos', op, 'cuantos'));
  const orden = opcionDe('proyectos', op, 'orden');
  const objetivoId = d.d.objetivo?.id ?? null;
  const lista = proyectosAMostrar(d.d.proyectos, d.d.tareasDeProyectos, orden, cuantos);
  return (
    <div className="gb">
      <Cabeza titulo="Proyectos del Plan" href="/plan?vista=proyectos" link="Ver todos" />
      {lista.length ? (
        <Grilla proyectos={lista} tareas={d.d.tareasDeProyectos} objetivoId={objetivoId} hoy={d.d.hoy} onOpen={abrir.proyecto} />
      ) : (
        <Placeholder
          muestra={<Grilla proyectos={proyectosMuestra().slice(0, cuantos)} tareas={tareasMuestra()} objetivoId="pm1" hoy={hoyMuestra()} onOpen={nada} />}
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
      <Grilla proyectos={proyectosMuestra().slice(0, numeroDe(opcionDe('proyectos', op, 'cuantos')))} tareas={tareasMuestra()} objetivoId="pm1" hoy={hoyMuestra()} onOpen={nada} />
    </div>
  );
}

// ── Los próximos deadlines ──────────────────────────────────────────────────────────────────────────────────────────

type Vence = { id: string; tipo: 'tarea' | 'proyecto'; titulo: string; deadline: string; proyecto: Label | null; color: string };

/** Lo que vence en los próximos `dias` (y lo vencido, si se pide), por fecha. */
function vencimientos(tareas: BoardTask[], proyectos: Label[], etiquetas: Label[], hoy: string, dias: number, que: string, vencidos: boolean): Vence[] {
  const porId = new Map([...etiquetas, ...proyectos].map((l) => [l.id, l]));
  const out: Vence[] = [];
  if (que !== 'proyectos') for (const t of tareas) {
    const p = t.labels.map((id) => porId.get(id)).find((l): l is Label => !!l) ?? null;
    out.push({ id: t.id, tipo: 'tarea', titulo: t.title, deadline: t.deadline, proyecto: p, color: p?.color ?? 'var(--faint)' });
  }
  if (que !== 'tareas') for (const l of proyectos) if (l.deadline) out.push({ id: l.id, tipo: 'proyecto', titulo: l.name, deadline: l.deadline, proyecto: null, color: l.color });
  return out
    .filter((v) => { const n = diasHasta(v.deadline, hoy); return n < dias && (vencidos || n >= 0); })
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function ListaVence({ items, hoy, onOpen }: { items: Vence[]; hoy: string; onOpen: (v: Vence) => void }) {
  return (
    <div>
      {items.map((v) => {
        const p = plazoTexto(diasHasta(v.deadline, hoy));
        const [, m, dd] = v.deadline.split('-').map(Number);
        return (
          <div key={`${v.tipo}:${v.id}`} className="gb-fila" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => onOpen(v)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(v); }}>
            <span aria-hidden style={{ flex: 'none', width: 40, height: 42, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, background: `color-mix(in srgb, ${p.color} 14%, transparent)`, color: p.color }}>
              <span className="gb-num" style={{ fontSize: 17, fontWeight: 700 }}>{dd}</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{MES[(m ?? 1) - 1]}</span>
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span title={v.titulo} style={{ fontSize: 'clamp(14.5px, 3cqi, 17px)', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.titulo}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12, color: 'var(--dim)' }}>
                <span aria-hidden style={{ flex: 'none', width: 7, height: 7, borderRadius: 2, background: v.color }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.tipo === 'proyecto' ? 'Proyecto' : v.proyecto?.name ?? 'Tarea'}</span>
              </span>
            </span>
            <span style={{ flex: 'none', fontSize: 12.5, fontWeight: p.fuerte ? 700 : 500, color: p.color, whiteSpace: 'nowrap' }}>{p.texto}</span>
          </div>
        );
      })}
    </div>
  );
}

const opcionesDeadlines = (op?: OpcionesElegidas) => ({
  dias: numeroDe(opcionDe('deadlines', op, 'dias')),
  que: opcionDe('deadlines', op, 'que'),
  vencidos: opcionDe('deadlines', op, 'vencidos') === 'si',
});

function muestraVence(op?: OpcionesElegidas): Vence[] {
  const o = opcionesDeadlines(op);
  const ts = tareasMuestra().filter((t) => t.deadline);
  return vencimientos(ts, proyectosMuestra(), proyectosMuestra(), hoyMuestra(), o.dias, o.que, o.vencidos).slice(0, 6);
}

export function BloqueDeadlines({ d, op }: { d: DatosGeneral['plan']; op?: OpcionesElegidas }) {
  const abrir = useAbrir();
  if (!d.ok) return <Fallo titulo="Próximos deadlines" error={d.error} />;
  const o = opcionesDeadlines(op);
  const items = vencimientos(d.d.deadlines.tareas, d.d.deadlines.proyectos, d.d.etiquetas, d.d.hoy, o.dias, o.que, o.vencidos);
  const vencidos = items.filter((v) => diasHasta(v.deadline, d.d.hoy) < 0).length;
  const extra: ReactNode = vencidos ? <span style={{ color: 'var(--bad)', fontWeight: 600 }}>{vencidos} {vencidos === 1 ? 'vencido' : 'vencidos'}</span> : null;
  return (
    <div className="gb">
      <Cabeza titulo="Próximos deadlines" extra={extra} href="/plan" link="Abrir el Plan" />
      {items.length ? (
        <ListaVence items={items} hoy={d.d.hoy} onOpen={(v) => (v.tipo === 'tarea' ? abrir.tarea(v.id) : abrir.proyecto(v.id))} />
      ) : (
        <Placeholder muestra={<ListaVence items={muestraVence(op)} hoy={hoyMuestra()} onOpen={nada} />}
          texto={`Nada vence en los próximos ${o.dias} días.`} accion={{ href: '/plan', rotulo: 'Abrir el Plan' }} />
      )}
    </div>
  );
}

export function MuestraDeadlines({ op }: { op?: OpcionesElegidas }) {
  return (
    <div className="gb">
      <Cabeza titulo="Próximos deadlines" />
      <ListaVence items={muestraVence(op)} hoy={hoyMuestra()} onOpen={nada} />
    </div>
  );
}
