'use client';

// =============================================================================
// El roadmap completo de Customer Success, renderizado
// =============================================================================
// Los datos y el porqué de que esta sea la ÚNICA vista de Dev escrita a mano
// están en `roadmap-cs.ts`. Acá solo se pinta.
//
// Decisiones de forma, todas de AGENTS.md y no inventadas acá:
//   · Un grupo de cosas del mismo tipo es una LISTA con filete (`.mk-fila`), no
//     una pila de cajas. Son 12 módulos con 52 items: apilar tarjetas los volvía
//     ilegibles y era el «contenedor perezoso».
//   · El color NUNCA es el único portador: cada estado lleva su rótulo escrito
//     al lado del punto, no solo el punto.
//   · El tono sale de `TONO`, no de un `var(--…)` escrito acá.
//   · Nada adentro lleva ancho propio: el `max-width` vive en el contenedor de
//     la página. Un `max-width` en el texto deja media caja muerta a la derecha.

import { useState } from 'react';
import { Section, MONO, TONO } from '@/app/_ui';
import { SECCIONES_CS, ESTADO_CS, conteoCS, type BloqueCS, type ItemCS, type EstadoCS } from './roadmap-cs';

/** El punto + el rótulo. El rótulo NO es opcional: el color solo no alcanza. */
function Chip({ estado }: { estado: EstadoCS }) {
  const { label, tono } = ESTADO_CS[estado];
  const t = TONO[tono];
  return (
    <span
      className="mk-pill"
      style={{ background: t.bg, color: t.ink, border: `1px solid ${t.border}`, flex: 'none' }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.fill, flex: 'none' }} aria-hidden />
      {label}
    </span>
  );
}

function Fila({ item }: { item: ItemCS }) {
  return (
    <div className="mk-fila">
      <div className="mk-fila__txt">
        <div className="mk-fila__l1">
          <span className="mk-fila__t">{item.titulo}</span>
          <Chip estado={item.estado} />
          {/* El tag del documento original va tachado cuando el código dice otra
              cosa: esa contradicción es la mitad del valor de esta pantalla. */}
          {item.tagOriginal && (
            <span
              style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', textDecoration: item.nota?.startsWith('⚠️') ? 'line-through' : 'none' }}
              title="El tag que el documento le mostró a Mauricio"
            >
              {item.tagOriginal}
            </span>
          )}
          {item.enPlan && (
            <a
              href={`/plan?tarea=${item.enPlan}`}
              style={{ fontFamily: MONO, fontSize: 11, color: 'var(--primary)' }}
              title="Ya está en el tablero"
            >
              #{item.enPlan}
            </a>
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

function Bloque({ b }: { b: BloqueCS }) {
  return (
    <Section titulo={`${b.n} · ${b.titulo}`} card>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 12px', lineHeight: 1.55 }}>{b.que}</p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {b.items.map((i) => <Fila key={i.titulo} item={i} />)}
      </div>
    </Section>
  );
}

export function RoadmapCS() {
  // Arranca en «Con Mauricio» a propósito: es lo que tiene reloj. La propuesta
  // original está a un clic, no en otra pantalla — el pedido fue tener las dos
  // cosas en el mismo lugar.
  const [sec, setSec] = useState(SECCIONES_CS[0].id);
  const activa = SECCIONES_CS.find((s) => s.id === sec) ?? SECCIONES_CS[0];
  const conteo = conteoCS(activa);
  const total = activa.bloques.reduce((n, b) => n + b.items.length, 0);

  return (
    <>
      {/* La barra NO scrollea de costado: son dos, entran siempre. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {SECCIONES_CS.map((s) => {
          const on = s.id === activa.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSec(s.id)}
              style={{
                appearance: 'none', cursor: 'pointer',
                padding: '8px 14px', borderRadius: 'var(--r-pill, 999px)',
                fontSize: 'var(--fs-sm)', fontWeight: on ? 600 : 500,
                background: on ? 'var(--mako-bg)' : 'var(--surface)',
                color: on ? 'var(--mako-ink)' : 'var(--dim)',
                border: `1px solid ${on ? 'var(--mako-border)' : 'var(--border)'}`,
              }}
              aria-pressed={on}
            >
              {s.titulo}
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 14px', lineHeight: 1.6 }}>{activa.intro}</p>

      {/* El resumen: cuántas de cada estado. Deriva de los datos, no se escribe. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)', alignSelf: 'center' }}>{total} líneas</span>
        {(Object.keys(ESTADO_CS) as EstadoCS[])
          .filter((e) => conteo[e] > 0)
          .map((e) => {
            const t = TONO[ESTADO_CS[e].tono];
            return (
              <span key={e} style={{ fontFamily: MONO, fontSize: 12, color: t.ink, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '4px 9px' }}>
                {conteo[e]} {ESTADO_CS[e].label.toLowerCase()}
              </span>
            );
          })}
      </div>

      {activa.bloques.map((b) => <Bloque key={b.id} b={b} />)}
    </>
  );
}
