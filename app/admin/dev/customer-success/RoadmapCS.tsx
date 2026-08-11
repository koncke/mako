'use client';

// =============================================================================
// El roadmap de Customer Success, renderizado
// =============================================================================
// Los datos y la separación objetivo / camino están en `roadmap-cs.ts`.
//
// Esta vista REEMPLAZA al Roadmap genérico del área. No convive con él: eran
// tres listas parecidas apiladas y el dueño lo cortó — «No entiendo porque hay
// 2 tabs de roadmap». Las tareas del plan se resuelven por título adentro de
// cada paso, así que el camino y el tablero son una sola cosa: el camino da el
// orden, el tablero da el estado.
//
// Decisiones de forma, de AGENTS.md:
//   · Lista con filete (`.mk-fila`), no pila de cajas: son 30 líneas.
//   · El color nunca es el único portador: cada estado lleva su rótulo.
//   · El tono sale de `TONO`.
//   · Nada adentro lleva ancho propio.

import { useState } from 'react';
import Link from '@/app/_ui/Link';
import { Section, MONO, TONO } from '@/app/_ui';
import { OBJETIVO, FASES, DESPUES, ESTADO_CS, conteoCamino, type EstadoCS, type ItemCS, type FaseCS } from './roadmap-cs';
import type { TareaRoadmap } from '../roadmap';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

function Chip({ estado }: { estado: EstadoCS }) {
  const { label, tono } = ESTADO_CS[estado];
  const t = TONO[tono];
  return (
    <span className="mk-pill" style={{ background: t.bg, color: t.ink, border: `1px solid ${t.border}`, flex: 'none' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.fill, flex: 'none' }} aria-hidden />
      {label}
    </span>
  );
}

/** El link a la tarjeta del tablero. Solo si la tarea EXISTE: si el título no
 *  matchea no se inventa un número — un número inventado manda a la tarjeta de
 *  otro, que es peor que no tener link. */
function EnPlan({ t }: { t: TareaRoadmap }) {
  return (
    <Link
      href={`/plan?tarea=${t.num}`}
      style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--primary)', flex: 'none' }}
      title={`${t.proyecto} · score ${t.score}${t.deadline ? ` · vence ${t.deadline}` : ''}`}
    >
      #{t.num}{t.progreso > 0 ? ` · ${t.progreso}%` : ''}
    </Link>
  );
}

function Fila({ item, tarea }: { item: ItemCS; tarea?: TareaRoadmap }) {
  return (
    <div className="mk-fila">
      <div className="mk-fila__txt">
        <div className="mk-fila__l1">
          <span className="mk-fila__t">{item.titulo}</span>
          <Chip estado={item.estado} />
          {item.quien && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: item.quien === 'Mauricio' ? 'var(--warn)' : 'var(--faint)' }}>
              {item.quien}
            </span>
          )}
          {tarea && <EnPlan t={tarea} />}
          {item.tagOriginal && (
            <span
              style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', textDecoration: item.nota?.startsWith('⚠️') ? 'line-through' : 'none' }}
              title="El tag que el documento le mostró a Mauricio"
            >
              {item.tagOriginal}
            </span>
          )}
        </div>
        <span className="mk-fila__c">{item.que}</span>
        {item.nota && (
          <span className="mk-fila__c" style={{ color: 'var(--faint)', borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
            {item.nota}
          </span>
        )}
      </div>
    </div>
  );
}

function Fase({ f, porTitulo }: { f: FaseCS; porTitulo: Map<string, TareaRoadmap> }) {
  return (
    <Section titulo={`Fase ${f.n} · ${f.titulo}`} card>
      {/* El porqué del ORDEN va arriba de los items, no al final: es lo que
          contesta «¿qué hacemos primero?». */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '0 0 12px' }}>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--ink)' }}>Desbloquea:</strong> {f.desbloquea}
        </span>
        {f.necesita && (
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--ink)' }}>Necesita antes:</strong> {f.necesita}
          </span>
        )}
        {f.paralelo && (
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: TONO.good.ink, background: TONO.good.bg, border: `1px solid ${TONO.good.border}`, borderRadius: 8, padding: '4px 9px', alignSelf: 'flex-start' }}>
            se puede hacer en paralelo, desde hoy
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {f.items.map((i) => <Fila key={i.titulo} item={i} tarea={i.plan ? porTitulo.get(norm(i.plan)) : undefined} />)}
      </div>
    </Section>
  );
}

export function RoadmapCS({ tareas }: { tareas: TareaRoadmap[] }) {
  const [verDespues, setVerDespues] = useState(false);
  const porTitulo = new Map(tareas.map((t) => [norm(t.titulo), t]));
  const conteo = conteoCamino();
  const reclamados = new Set(FASES.flatMap((f) => f.items.map((i) => i.plan).filter(Boolean).map((t) => norm(t!))));
  // Las del tablero que este camino NO reclama. Se muestran igual: esconderlas
  // haría que la pantalla dijera «esto es todo» cuando no lo es.
  const sueltas = tareas.filter((t) => !reclamados.has(norm(t.titulo)));

  return (
    <>
      {/* ── EL OBJETIVO ────────────────────────────────────────────────────── */}
      <Section titulo="El objetivo" card>
        <p style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.4 }}>
          {OBJETIVO.titulo}
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 10px', lineHeight: 1.6 }}>{OBJETIVO.que}</p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', margin: '0 0 16px', lineHeight: 1.6, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
          {OBJETIVO.cita}
        </p>

        <p style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Así va a funcionar el servicio · el bucle de 5 pasos
        </p>
        {/* ⚠️ Estos NO son tareas y por eso no llevan estado: son el destino. Cada
            uno dice qué fase del camino lo habilita — el paso 1 es el ÚLTIMO en
            poder correr, porque necesita la plataforma. */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {OBJETIVO.pasos.map((p) => (
            <div className="mk-fila" key={p.n}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--mako-ink)', flex: 'none', paddingTop: 2, width: 18 }}>{p.n}</span>
              <div className="mk-fila__txt">
                <div className="mk-fila__l1">
                  <span className="mk-fila__t">{p.titulo}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{p.necesita}</span>
                </div>
                <span className="mk-fila__c">{p.que}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── EL CAMINO ──────────────────────────────────────────────────────── */}
      <div style={{ margin: '4px 0 14px' }}>
        <p style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)', fontWeight: 600, margin: '0 0 6px' }}>
          El camino — en orden de dependencia
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 10px', lineHeight: 1.6 }}>
          No es el orden de los cuatro frentes del Sprint: es el de lo que habilita a qué. La fase 0
          va primero porque nada de lo demás avanza sin ella, y la matriz va antes que todo lo que
          se construye encima. Las fases 6 y ⚠ no esperan a nadie.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(ESTADO_CS) as EstadoCS[]).filter((e) => conteo[e] > 0).map((e) => {
            const t = TONO[ESTADO_CS[e].tono];
            return (
              <span key={e} style={{ fontFamily: MONO, fontSize: 12, color: t.ink, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '4px 9px' }}>
                {conteo[e]} {ESTADO_CS[e].label.toLowerCase()}
              </span>
            );
          })}
        </div>
      </div>

      {FASES.map((f) => <Fase key={f.n} f={f} porTitulo={porTitulo} />)}

      {sueltas.length > 0 && (
        <Section titulo="También en el plan, fuera de este camino" card>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 12px', lineHeight: 1.55 }}>
            Tareas abiertas del proyecto que ninguna fase reclama. O les falta su lugar en el camino,
            o el camino les falta a ellas.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sueltas.map((t) => (
              <div className="mk-fila" key={t.num}>
                <div className="mk-fila__txt">
                  <div className="mk-fila__l1">
                    <span className="mk-fila__t">{t.titulo}</span>
                    <EnPlan t={t} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── DESPUÉS ────────────────────────────────────────────────────────── */}
      <Section titulo="Después del sprint — la propuesta original" card>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 12px', lineHeight: 1.6 }}>{DESPUES.intro}</p>
        <button
          type="button"
          onClick={() => setVerDespues((v) => !v)}
          style={{
            appearance: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 999,
            fontSize: 'var(--fs-sm)', fontWeight: 500,
            background: 'var(--surface)', color: 'var(--dim)', border: '1px solid var(--border)',
          }}
          aria-expanded={verDespues}
        >
          {verDespues ? 'Ocultar' : `Ver los 12 módulos y sus ${DESPUES.bloques.reduce((n, b) => n + b.items.length, 0)} features`}
        </button>

        {verDespues && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {DESPUES.bloques.map((b) => (
              <div key={b.n}>
                <p style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)', fontWeight: 600, margin: '0 0 3px' }}>{b.n} · {b.titulo}</p>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 8px', lineHeight: 1.5 }}>{b.que}</p>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {b.items.map((i) => <Fila key={i.titulo} item={i} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
