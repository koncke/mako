'use client';

// =============================================================================
// ModosMako — «Analizar · Editar»: los dos modos del MISMO MaKo de la hoja (#862)
// =============================================================================
// Martín, revisión del 16/10/2026 (1:24:47), cuando Joan le pidió un análisis del funnel al panel «Editar con MaKo» y
// MaKo le cambió la hoja: «Una cosa es MaKo analiza y otra cosa es MaKo Edita, entonces ahí está confundido». Ahora el
// panel de MaKo dice en qué modo está y se cambia de uno a otro sin salir: Analizar es el AI Analyst
// (./PanelAnalista.tsx), Editar es el chat que cambia la hoja (./PanelEditarMako.tsx). Va en la cabecera de los dos, en el
// lugar del título.
//
// ⚠️ Es la MISMA forma del segmentado de la casa (radiogroup con el elegido marcado), chica, para una cabecera de panel.

export type ModoMako = 'analizar' | 'editar';

const MODOS: ReadonlyArray<{ id: ModoMako; nombre: string }> = [
  { id: 'analizar', nombre: 'Analizar' },
  { id: 'editar', nombre: 'Editar' },
];

export function ModosMako({ modo, onModo }: { modo: ModoMako; onModo: (m: ModoMako) => void }) {
  return (
    <div className="mk-modos" role="radiogroup" aria-label="Qué hace MaKo">
      {MODOS.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={m.id === modo} className="mk-modos-op"
          onClick={() => { if (m.id !== modo) onModo(m.id); }}>
          {m.nombre}
        </button>
      ))}
    </div>
  );
}

/** Su CSS, para la hoja de estilos de los paneles (va con `.an`, la cabecera que comparten). */
export const CSS_MODOS_MAKO = `
.mk-modos { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: color-mix(in srgb, var(--ink) 7%, transparent); }
.mk-modos-op { min-height: 28px; padding: 0 12px; border: 0; border-radius: 8px; background: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--dim); cursor: pointer; }
.mk-modos-op[aria-checked="true"] { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px color-mix(in srgb, var(--ink) 12%, transparent); }
.mk-modos-op:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
`;
