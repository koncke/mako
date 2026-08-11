'use client';

// =============================================================================
// El roadmap de implementación de Customer Success
// =============================================================================
// Reemplaza al Roadmap genérico del área (un área tiene UN roadmap) y usa EL
// MISMO renglón que las otras siete: `FilaRoadmap` de ../_registro/Registro.tsx.
//
// LO ÚNICO QUE SUMA es lo que este roadmap necesita y aquéllas no: grupos con su
// porqué, numeración continua, quién lo hace, el link a la tarjeta del plan, y
// **el detalle en un modal**. El modal es la respuesta a las dos cosas a la vez
// —«que se entienda rápido» y «no resumas tanto»—: la fila dice una línea, y lo
// que ya existe, lo que falta y dónde se toca se abre al clickearla.
//
// `Modal` (app/_ui) y no un plegable: acá el detalle NO es más texto del mismo
// tipo, es una ficha con su propia estructura. La regla de la casa: `Confirm`
// pregunta · `Modal` muestra el detalle · `WizardShell` conduce un flujo.

import { useState } from 'react';
import { Section, Modal, Button, MONO } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { FilaRoadmap, ListaRoadmap, ChipEstado, texto } from '../_registro/Registro';
import { OBJETIVO, GRUPOS, TOTAL, TITULOS_EN_PLAN, conteo, type Grupo, type Paso } from './roadmap-cs';
import type { TareaRoadmap } from '../roadmap';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

/** Un bloque del modal. No se dibuja si no tiene contenido: una ficha con
 *  títulos vacíos promete un dato que no está. */
function BloqueModal({ rotulo, items }: { rotulo: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600, marginBottom: 7 }}>
        {rotulo}
      </div>
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

function DetallePaso({ paso, n, tarea, onCerrar }: { paso: Paso; n: number; tarea?: TareaRoadmap; onCerrar: () => void }) {
  return (
    <Modal
      titulo={paso.titulo}
      encabezado={`Paso ${String(n).padStart(2, '0')}`}
      onCerrar={onCerrar}
      ancho={720}
      pie={<Button variant="secondary" onClick={onCerrar}>Cerrar</Button>}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <ChipEstado estado={paso.estado} />
        {paso.quien && (
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: paso.quien === 'Mauricio' ? 'var(--warn)' : 'var(--faint)' }}>
            lo hace {paso.quien === 'Los dos' ? 'con Mauricio' : paso.quien}
          </span>
        )}
        {tarea && (
          <Link href={`/plan?tarea=${tarea.num}`} style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--primary)' }}>
            #{tarea.num} en el plan{tarea.progreso > 0 ? ` · ${tarea.progreso}%` : ''}
          </Link>
        )}
      </div>

      <p style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)', margin: 0, lineHeight: 1.55 }}>{texto(paso.que)}</p>

      {paso.ojo && (
        <p style={{ margin: '16px 0 0', padding: '11px 15px', background: 'var(--surface-2)', borderLeft: '2px solid var(--warn-fill)', borderRadius: '0 var(--r-sm) var(--r-sm) 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
          {texto(paso.ojo)}
        </p>
      )}

      {/* «Ya está» va PRIMERO, y es a propósito: es lo que evita rehacer trabajo
          hecho, que es el error que este roadmap ya cometió una vez. */}
      <BloqueModal rotulo="Ya está construido" items={paso.yaEsta} />
      <BloqueModal rotulo="Falta" items={paso.falta} />
      <BloqueModal rotulo="Dónde se toca" items={paso.tocar} />
    </Modal>
  );
}

/** Lo que cuelga al lado del título en la fila. */
function Extra({ paso, tarea }: { paso: Paso; tarea?: TareaRoadmap }) {
  return (
    <>
      {paso.quien && (
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 400, color: paso.quien === 'Mauricio' ? 'var(--warn)' : 'var(--faint)', marginLeft: 9 }}>
          {paso.quien}
        </span>
      )}
      {tarea && (
        <Link href={`/plan?tarea=${tarea.num}`} onClick={(e) => e.stopPropagation()}
          style={{ fontFamily: MONO, fontSize: 11, fontWeight: 400, color: 'var(--primary)', marginLeft: 9 }}
          title={`${tarea.proyecto} · score ${tarea.score}`}>
          #{tarea.num}
        </Link>
      )}
    </>
  );
}

export function RoadmapCS({ tareas }: { tareas: TareaRoadmap[] }) {
  const [abierto, setAbierto] = useState<{ paso: Paso; n: number } | null>(null);
  const porTitulo = new Map(tareas.map((t) => [norm(t.titulo), t]));
  const reclamados = new Set(TITULOS_EN_PLAN.map(norm));
  const sueltas = tareas.filter((t) => !reclamados.has(norm(t.titulo)));
  const c = conteo();

  const resumen = [
    `${TOTAL} pasos`,
    c.hecha ? `${c.hecha} hechos` : null,
    c.sigue ? `${c.sigue} en curso` : null,
    c.bloqueada ? `${c.bloqueada} bloqueados` : null,
  ].filter(Boolean).join(' · ');

  let n = 0;
  const tareaDe = (p: Paso) => (p.plan ? porTitulo.get(norm(p.plan)) : undefined);

  return (
    <>
      <Section titulo="Roadmap de implementación" nota={resumen}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 4px', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--ink)' }}>El objetivo:</strong> {OBJETIVO}
        </p>
        <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', margin: 0 }}>
          Ordenado por dependencia. Cliqueá un paso para ver qué ya existe, qué falta y dónde se toca.
        </p>

        {GRUPOS.map((g: Grupo) => (
          <div key={g.titulo}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', margin: '22px 0 8px' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600 }}>
                {g.titulo}
              </span>
              <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{g.desbloquea}</span>
            </div>
            <ListaRoadmap>
              {g.pasos.map((p) => {
                const num = ++n;
                return (
                  <FilaRoadmap
                    key={p.titulo} n={num} titulo={p.titulo} detalle={p.que} estado={p.estado}
                    extra={<Extra paso={p} tarea={tareaDe(p)} />}
                    onAbrir={() => setAbierto({ paso: p, n: num })}
                  />
                );
              })}
            </ListaRoadmap>
          </div>
        ))}
      </Section>

      {/* Sin esto la pantalla diría «esto es todo el trabajo» cuando no lo es. */}
      {sueltas.length > 0 && (
        <Section titulo="Del plan, sin lugar en el roadmap" nota={`${sueltas.length}`}>
          <ListaRoadmap>
            {sueltas.map((t, i) => (
              <FilaRoadmap key={t.num} n={i + 1} titulo={t.titulo} detalle={t.proyecto} estado="cola"
                extra={<Link href={`/plan?tarea=${t.num}`} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 400, color: 'var(--primary)', marginLeft: 9 }}>#{t.num}</Link>} />
            ))}
          </ListaRoadmap>
        </Section>
      )}

      {abierto && (
        <DetallePaso paso={abierto.paso} n={abierto.n} tarea={tareaDe(abierto.paso)} onCerrar={() => setAbierto(null)} />
      )}
    </>
  );
}
