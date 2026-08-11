'use client';

// =============================================================================
// Customer Success — el roadmap de implementación
// =============================================================================
// Dos bloques: URGENCIA (lo de Mauricio ya) y A FUTURO (la propuesta original).
// El renglón es el MISMO que las otras siete áreas (`FilaRoadmap`), y al
// clickearlo se abre **el modal de /plan**, no uno parecido: `TaskModal` sale de
// `app/plan/board/BoardShell.tsx` y el `Board` se arma con el mismo `repoPlan()`.
// Eso da, gratis, edición del detalle, checklist, avance, historial y MaKo — y
// que lo que se cambie acá sea lo mismo que se ve en /plan, sin cambiar de ruta.
//
// Los pasos que TODAVÍA no tienen tarjeta abren la ficha corta del roadmap: no
// hay tarea que editar. Se distinguen a propósito — un paso sin tarjeta es un
// paso que nadie va a hacer.

import { useState } from 'react';
import { Section, Modal, Button, MONO } from '@/app/_ui';
import { FilaRoadmap, ListaRoadmap, ChipEstado, texto } from '../_registro/Registro';
import { useBoard } from '@/app/plan/board/useBoard';
import { repoPlan } from '@/app/plan/board/repo-plan';
import { TaskModal } from '@/app/plan/board/BoardShell';
import type { BoardTask, Label, BoardUser } from '@/app/plan/board/types';
import { OBJETIVO, URGENTE, FUTURO, TITULOS_EN_PLAN, cuantos, conteo, type Grupo, type Paso } from './roadmap-cs';
import type { TareaRoadmap } from '../roadmap';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

/** Un bloque de la ficha corta. No se dibuja vacío: un título sin contenido
 *  promete un dato que no está. */
function Bloque({ rotulo, items }: { rotulo: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600, marginBottom: 7 }}>{rotulo}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((x, k) => (
          <li key={k} style={{ position: 'relative', paddingLeft: 16, fontSize: 'var(--fs-sm)', lineHeight: 1.6, color: 'var(--dim)' }}>
            <span style={{ position: 'absolute', left: 1, top: '.66em', width: 5, height: 5, borderRadius: '50%', background: 'var(--faint)' }} />
            {texto(x)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** La ficha de un paso SIN tarjeta en el plan. Los que sí la tienen abren `TaskModal`. */
function FichaCorta({ paso, n, onCerrar }: { paso: Paso; n: number; onCerrar: () => void }) {
  return (
    <Modal titulo={paso.titulo} encabezado={`Paso ${String(n).padStart(2, '0')} · sin tarjeta en el plan`} onCerrar={onCerrar} ancho={720}
      pie={<Button variant="secondary" onClick={onCerrar}>Cerrar</Button>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <ChipEstado estado={paso.estado} />
        {paso.quien && <span style={{ fontFamily: MONO, fontSize: 11.5, color: paso.quien === 'Mauricio' ? 'var(--warn)' : 'var(--faint)' }}>lo hace {paso.quien === 'Los dos' ? 'con Mauricio' : paso.quien}</span>}
      </div>
      <p style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)', margin: 0, lineHeight: 1.55 }}>{texto(paso.que)}</p>
      {paso.ojo && (
        <p style={{ margin: '16px 0 0', padding: '11px 15px', background: 'var(--surface-2)', borderLeft: '2px solid var(--warn-fill)', borderRadius: '0 var(--r-sm) var(--r-sm) 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>{texto(paso.ojo)}</p>
      )}
      {/* «Ya está» va PRIMERO: es lo que evita rehacer trabajo hecho. */}
      <Bloque rotulo="Ya está construido" items={paso.yaEsta} />
      <Bloque rotulo="Falta" items={paso.falta} />
      <Bloque rotulo="Dónde se toca" items={paso.tocar} />
    </Modal>
  );
}

function Extra({ paso, tarea }: { paso: Paso; tarea?: BoardTask }) {
  return (
    <>
      {paso.quien && (
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 400, color: paso.quien === 'Mauricio' ? 'var(--warn)' : 'var(--faint)', marginLeft: 9 }}>{paso.quien}</span>
      )}
      {tarea && <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 400, color: 'var(--primary)', marginLeft: 9 }}>#{tarea.num}</span>}
    </>
  );
}

export function RoadmapCS({ tareas, plan, user }: {
  tareas: TareaRoadmap[];
  plan: { tareas: BoardTask[]; proyectos: Label[] } | null;
  user: BoardUser;
}) {
  // El MISMO board que /plan: mismo repo, misma API, mismo optimismo. Lo que se
  // edita acá queda guardado igual que si se hubiera abierto la tarjeta allá.
  const board = useBoard(plan?.tareas ?? [], plan?.proyectos ?? [], user, repoPlan());
  const [abierto, setAbierto] = useState<{ paso: Paso; n: number; id: string | null } | null>(null);

  const porTitulo = new Map(board.tasks.map((t) => [norm(t.title), t]));
  const tareaDe = (p: Paso) => (p.plan ? porTitulo.get(norm(p.plan)) : undefined);

  const reclamados = new Set(TITULOS_EN_PLAN.map(norm));
  const sueltas = tareas.filter((t) => !reclamados.has(norm(t.titulo)));

  // La numeración es continua y cruza los dos bloques: el paso 01 es lo primero.
  let n = 0;
  const bloque = (gs: Grupo[]) => gs.map((g) => (
    <div key={g.titulo}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', margin: '22px 0 8px' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>{g.titulo}</span>
        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{g.desbloquea}</span>
      </div>
      <ListaRoadmap>
        {g.pasos.map((p) => {
          const num = ++n;
          const t = tareaDe(p);
          return (
            <FilaRoadmap key={p.titulo} n={num} titulo={p.titulo} detalle={p.que} estado={p.estado}
              extra={<Extra paso={p} tarea={t} />}
              onAbrir={() => setAbierto({ paso: p, n: num, id: t?.id ?? null })} />
          );
        })}
      </ListaRoadmap>
    </div>
  ));

  const cU = conteo(URGENTE);
  const resumenU = [`${cuantos(URGENTE)} pasos`, cU.hecha ? `${cU.hecha} hechos` : null, cU.sigue ? `${cU.sigue} en curso` : null, cU.bloqueada ? `${cU.bloqueada} bloqueados` : null].filter(Boolean).join(' · ');

  // `board.tasks` es el estado VIVO: la tarjeta se relee de ahí en cada render,
  // así lo que se edita en el modal se refleja al toque (y no una copia congelada).
  const tareaAbierta = abierto?.id ? board.tasks.find((t) => t.id === abierto.id) ?? null : null;

  return (
    <>
      <Section titulo="Urgencia" nota={resumenU}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 4px', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink)' }}>El objetivo:</strong> {OBJETIVO}
        </p>
        <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', margin: 0 }}>Ordenado por dependencia. Cliqueá un paso para abrir su tarjeta.</p>
        {bloque(URGENTE)}
      </Section>

      <Section titulo="A futuro" nota={`${cuantos(FUTURO)} pasos · la propuesta original`}>
        {bloque(FUTURO)}
      </Section>

      {sueltas.length > 0 && (
        <Section titulo="Del plan, sin lugar en el roadmap" nota={`${sueltas.length}`}>
          <ListaRoadmap>
            {sueltas.map((t, i) => (
              <FilaRoadmap key={t.num} n={i + 1} titulo={t.titulo} detalle={t.proyecto} estado="cola"
                onAbrir={() => { const bt = board.tasks.find((x) => x.num === t.num); if (bt) setAbierto({ paso: { titulo: t.titulo, que: t.proyecto, estado: 'cola' }, n: i + 1, id: bt.id }); }} />
            ))}
          </ListaRoadmap>
        </Section>
      )}

      {/* El modal EXACTO de /plan cuando el paso tiene tarjeta; la ficha corta cuando no. */}
      {abierto && tareaAbierta && (
        <TaskModal t={tareaAbierta} board={board} topProjectId={null}
          onDebate={() => {}} onDebateFecha={() => {}} onDelete={() => {}} onAsignar={() => {}}
          ask={(_m, ok) => ok()} onClose={() => setAbierto(null)} />
      )}
      {abierto && !tareaAbierta && (
        <FichaCorta paso={abierto.paso} n={abierto.n} onCerrar={() => setAbierto(null)} />
      )}
    </>
  );
}
