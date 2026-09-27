'use client';

// =============================================================================
// TarjetasTrabajo — el trabajo de un cliente, con la cara de las tarjetas del tablero
// =============================================================================
// «Tampoco aprovechaste el diseño de las cards de proyecto y tareas, sigue siendo una
// lista» (26/09/2026). Tenía razón: una lista con filete no se parece en nada al tablero,
// y el detalle de un cliente es una VISTA PREVIA de lo mismo.
//
// ⚠️ NO SE MONTA `ProyectoCardTile` NI `CardTile` DE `BoardShell`, y la razón no es
// estética. `CardTile` pide el `board` entero (el `ReturnType` de `useBoard`: cuarenta
// funciones de escritura, el dirty-set y el autoguardado), así que traerlo obligaría a
// montar un segundo `useBoard` sobre las mismas tareas — dos escritores pisándose sin un
// solo error. Y aunque `ProyectoCardTile` sí se podría, importar de `BoardShell` arrastra
// su grafo entero (~700 KB de fuente) a una pantalla que no edita nada.
//
// Lo que SÍ se comparte, para que no digan dos cosas distintas: el molde visual (banda de
// color arriba, emoji, título, pie anclado), `LineaDeadline` y `RepiteChip`.

import { LineaDeadline, RepiteChip } from '@/app/plan/board/piezas';
import { MONO } from '@/app/_ui';
import type { ProyectoCS, TareaCS } from './trabajo';

/** El color de una tarea según su prioridad, con la misma escala que el tablero
 *  (`prioFromScore`: ALTA ≥75 · MEDIA ≥50 · BAJA ≥25 · A FUTURO <25). */
function colorScore(score: number): string {
  if (score >= 75) return 'var(--bad)';
  if (score >= 50) return 'var(--warn, #B4762A)';
  if (score >= 25) return 'var(--good)';
  return 'var(--border-strong)';
}

export function TarjetaProyecto({ p, hoy, onAbrir }: { p: ProyectoCS; hoy: string; onAbrir: () => void }) {
  const conFin = p.abiertas + p.hechas;
  const pct = conFin ? Math.round((p.hechas / conFin) * 100) : 0;
  return (
    <button className="tt-card" onClick={onAbrir} style={{ borderTopColor: p.color }}>
      <span className="tt-top">
        <span className="em" aria-hidden>{p.emoji}</span>
        <span className="ti">{p.nombre}</span>
      </span>
      <span className="tt-sp" />
      {/* Un proyecto de puras recurrentes NO muestra 0%: ese 0 es indistinguible de
          «nadie hizo nada» sobre algo que se atiende todas las semanas. */}
      {conFin > 0 ? (
        <>
          <span className="tt-barra" aria-hidden><span style={{ width: `${Math.min(100, pct)}%`, background: p.color }} /></span>
          <span className="tt-pie">{p.hechas} de {conFin} terminadas{p.recurrentes ? ` · ${p.recurrentes} se repiten` : ''}</span>
        </>
      ) : (
        <span className="tt-pie">{p.recurrentes ? `${p.recurrentes} se ${p.recurrentes === 1 ? 'repite' : 'repiten'} · nada con fin` : 'Sin tareas'}</span>
      )}
      {p.deadline && <span className="tt-fecha"><LineaDeadline iso={p.deadline} hoy={hoy} tam={11} /></span>}
    </button>
  );
}

export function TarjetaTarea({ t, hoy, onAbrir }: { t: TareaCS; hoy: string; onAbrir: () => void }) {
  const hecha = !t.abierta;
  return (
    <button className={`tt-card${hecha ? ' hecha' : ''}`} onClick={onAbrir}
      style={{ borderTopColor: t.recurrente ? 'var(--primary)' : hecha ? 'var(--border)' : colorScore(t.score) }}>
      <span className="tt-top">
        <span className="em" aria-hidden>{t.recurrente ? '🔁' : hecha ? '✓' : '📌'}</span>
        <span className="ti">{t.titulo}</span>
        {/* El número de prioridad, como en el tablero. No lo lleva lo terminado ni lo que
            se repite: ninguno de los dos compite por un puesto. */}
        {!t.recurrente && !hecha && <span className="sc">{t.score}</span>}
      </span>
      <span className="tt-sp" />
      {!t.recurrente && !hecha && t.progreso > 0 && (
        <span className="tt-barra" aria-hidden><span style={{ width: `${Math.min(100, t.progreso)}%`, background: colorScore(t.score) }} /></span>
      )}
      <span className="tt-pie">
        {t.recurrente ? <RepiteChip soloIcono /> : null}
        {t.recurrente ? 'Se repite' : hecha ? 'Terminada' : `${t.progreso}% avanzado`}
        {t.responsable ? ` · ${t.responsable}` : ''}
      </span>
      {!t.recurrente && t.deadline && <span className="tt-fecha"><LineaDeadline iso={t.deadline} hoy={hoy} tam={11} /></span>}
    </button>
  );
}

/** La grilla. `auto-fill` y no `auto-fit`: con una sola tarjeta, `auto-fit` la estira a
 *  todo el ancho del modal y una tarjeta de 900 px no se lee como una tarjeta. */
export function Grilla({ children }: { children: React.ReactNode }) {
  return <div className="tt-grid">{children}</div>;
}

export const CSS_TARJETAS = `
.tt-grid{ display:grid; gap:12px; grid-template-columns:repeat(auto-fill, minmax(232px, 1fr)); }

.tt-card{ display:flex; flex-direction:column; gap:7px; min-height:124px; width:100%;
  background:var(--surface); border:1px solid var(--border); border-top-width:3px;
  border-top-style:solid; border-radius:13px; padding:11px 13px 11px; cursor:pointer;
  text-align:left; font:inherit; color:inherit; transition:border-color .12s, box-shadow .12s; }
.tt-card:hover{ border-color:var(--border-strong); box-shadow:0 4px 12px rgba(18,21,27,.05); }
.tt-card:focus-visible{ outline:none; box-shadow:var(--focus-ring); }
.tt-card.hecha .ti{ color:var(--faint); text-decoration:line-through; }

.tt-top{ display:flex; align-items:flex-start; gap:8px; }
.tt-top .em{ flex:none; font-size:14px; line-height:1.35; }
.tt-top .ti{ flex:1; min-width:0; font-size:13.5px; font-weight:560; line-height:1.35;
  color:var(--ink); display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;
  overflow:hidden; }
.tt-top .sc{ flex:none; font-family:${MONO}; font-size:10.5px; font-weight:700;
  color:var(--dim); background:var(--surface-2); border:1px solid var(--border-strong);
  border-radius:6px; padding:1px 6px; }

.tt-sp{ flex:1; min-height:4px; }
.tt-barra{ display:block; height:3px; border-radius:99px; background:var(--border); overflow:hidden; }
.tt-barra > span{ display:block; height:100%; }
.tt-pie{ display:flex; align-items:center; gap:5px; font-family:${MONO}; font-size:10px;
  color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tt-fecha{ display:block; }

@media(prefers-reduced-motion:reduce){ .tt-card{ transition:none; } }
`;
