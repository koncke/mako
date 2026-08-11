'use client';

// =============================================================================
// El roadmap de implementación de Customer Success
// =============================================================================
// Reemplaza al Roadmap genérico del área (un área tiene UN roadmap) y usa EL
// MISMO renglón: `FilaRoadmap` sale de ../_registro/Registro.tsx, que es lo que
// pintan las otras siete áreas. Lo único que suma es lo que este roadmap tiene y
// aquéllas no: grupos con su porqué, numeración continua, quién lo hace, y el
// link a la tarjeta del plan.
//
// Los datos y qué va acá y qué no están en `roadmap-cs.ts`. Regla corta: solo
// pasos de implementación. Nada de citas, precios ni argumentos de venta — eso
// vive en docs/sprint-servicio-mauricio.md.
//
// «Después del sprint» va PLEGADO: son 24 pasos más y no es lo de hoy.

import { Section, MONO } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { FilaRoadmap, ListaRoadmap } from '../_registro/Registro';
import { Plegable } from '../pricing/Piezas';
import { OBJETIVO, GRUPOS, DESPUES, TOTAL_SPRINT, TOTAL_DESPUES, TITULOS_EN_PLAN, conteo, type Grupo, type Paso } from './roadmap-cs';
import type { TareaRoadmap } from '../roadmap';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

/** El rótulo de un grupo. Tenue y en versalitas: separa sin competir con las filas. */
function Rotulo({ g }: { g: Grupo }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', margin: '20px 0 8px' }}>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>
        {g.titulo}
      </span>
      <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{g.desbloquea}</span>
    </div>
  );
}

/** Lo que cuelga al lado del título: quién lo hace (si no es Martín) y su tarjeta. */
function Extra({ p, tarea }: { p: Paso; tarea?: TareaRoadmap }) {
  if (!p.quien && !tarea) return null;
  return (
    <>
      {p.quien && (
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 400, color: p.quien === 'Mauricio' ? 'var(--warn)' : 'var(--faint)', marginLeft: 9 }}>
          {p.quien}
        </span>
      )}
      {tarea && (
        <Link href={`/plan?tarea=${tarea.num}`} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 400, color: 'var(--primary)', marginLeft: 9 }}
          title={`${tarea.proyecto} · score ${tarea.score}${tarea.deadline ? ` · vence ${tarea.deadline}` : ''}`}>
          #{tarea.num}{tarea.progreso > 0 ? ` · ${tarea.progreso}%` : ''}
        </Link>
      )}
    </>
  );
}

/** Los grupos, con la numeración CONTINUA: el paso 01 es lo primero que se hace. */
function Pasos({ grupos, desde, porTitulo }: { grupos: Grupo[]; desde: number; porTitulo: Map<string, TareaRoadmap> }) {
  let n = desde;
  return (
    <>
      {grupos.map((g) => (
        <div key={g.titulo}>
          <Rotulo g={g} />
          <ListaRoadmap>
            {g.pasos.map((p) => {
              const tarea = p.plan ? porTitulo.get(norm(p.plan)) : undefined;
              return (
                <FilaRoadmap key={p.titulo} n={n++} titulo={p.titulo} detalle={p.que} estado={p.estado}
                  extra={<Extra p={p} tarea={tarea} />} />
              );
            })}
          </ListaRoadmap>
        </div>
      ))}
    </>
  );
}

export function RoadmapCS({ tareas }: { tareas: TareaRoadmap[] }) {
  const porTitulo = new Map(tareas.map((t) => [norm(t.titulo), t]));
  const reclamados = new Set(TITULOS_EN_PLAN.map(norm));
  const sueltas = tareas.filter((t) => !reclamados.has(norm(t.titulo)));
  const c = conteo(GRUPOS);
  const resumen = [
    `${TOTAL_SPRINT} pasos`,
    c.sigue ? `${c.sigue} en curso` : null,
    c.bloqueada ? `${c.bloqueada} bloqueados` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <Section titulo="Roadmap de implementación" nota={resumen}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 4px', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink)' }}>El objetivo:</strong> {OBJETIVO}
        </p>
        <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', margin: '0 0 2px' }}>
          El orden es el orden: está por dependencia, no por los frentes del Sprint.
        </p>
        <Pasos grupos={GRUPOS} desde={1} porTitulo={porTitulo} />
      </Section>

      <Section titulo="Después del sprint">
        <Plegable titulo={`${TOTAL_DESPUES} pasos más`} resumen="los 12 módulos de la propuesta original, sin lo que ya se descartó">
          <Pasos grupos={DESPUES} desde={TOTAL_SPRINT + 1} porTitulo={porTitulo} />
        </Plegable>
      </Section>

      {/* Las del tablero que ningún paso reclama. Se muestran o la pantalla
          miente: sin esto diría «esto es todo el trabajo» cuando no lo es. */}
      {sueltas.length > 0 && (
        <Section titulo="Sin lugar en el roadmap">
          <Plegable titulo={`${sueltas.length} tareas del plan que ningún paso reclama`} resumen="o les falta su lugar acá, o el roadmap les falta a ellas">
            <ListaRoadmap>
              {sueltas.map((t, i) => (
                <FilaRoadmap key={t.num} n={i + 1} titulo={t.titulo} detalle={t.proyecto} estado="cola"
                  extra={<Link href={`/plan?tarea=${t.num}`} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 400, color: 'var(--primary)', marginLeft: 9 }}>#{t.num}</Link>} />
              ))}
            </ListaRoadmap>
          </Plegable>
        </Section>
      )}
    </>
  );
}
