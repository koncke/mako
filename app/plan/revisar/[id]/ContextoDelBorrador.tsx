'use client';

// =============================================================================
// ContextoDelBorrador — de dónde salieron estas tareas, abajo y plegado
// =============================================================================
// El `resumen` de un borrador puede ser una línea («Agregar 5 tareas al plan») o la
// investigación entera que le dio origen: tres mil caracteres con hallazgos, links y
// decisiones. Ese texto entraba como TÍTULO del wizard —una línea mono, centrada, al
// tope de la pantalla— y el resultado era un muro de texto centrado antes de poder
// leer la primera pregunta.
//
// Acá va como lo que es: el contexto. ABAJO de la pregunta (no antes: primero lo que
// tenés que responder), plegado, con su título, alineado a la izquierda y con el
// markdown renderizado. Se abre solo si te interesa.
// =============================================================================

import { useState } from 'react';
import { Markdown } from '@/app/_components/Markdown';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Debajo de esto no vale la pena plegar nada: es una línea y se lee de un vistazo. */
const CORTO = 220;

export function ContextoDelBorrador({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  const t = (texto ?? '').trim();
  if (!t) return null;

  // Un resumen corto NO se pliega: esconder «Agregar 5 tareas al plan» detrás de un
  // botón es más trabajo para el que mira que simplemente mostrarlo.
  if (t.length <= CORTO) {
    return (
      <div style={{ marginTop: 22, textAlign: 'left', fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, fontFamily: SANS }}>
        {t}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24, textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: 0,
          border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS,
          fontSize: 12.5, fontWeight: 700, color: 'var(--dim)',
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          De dónde salieron estas tareas
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' }}>
          {abierto ? 'Ver menos' : 'Ver más'}
        </span>
      </button>

      {abierto ? (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink)', lineHeight: 1.65, fontFamily: SANS }}>
          <Markdown text={t} />
        </div>
      ) : (
        // Un asomo de dos líneas: alcanza para decidir si vale la pena abrirlo, y no
        // empuja la pregunta fuera de la pantalla.
        <div style={{
          marginTop: 8, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.55, fontFamily: SANS,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {t.replace(/[*#_`>-]/g, ' ').replace(/\s+/g, ' ').trim()}
        </div>
      )}
    </div>
  );
}
