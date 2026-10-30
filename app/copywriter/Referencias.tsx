'use client';

// =============================================================================
// Referencias — el «@» de la caja de MaKo: citar otro guion, la oferta o un archivo de El Archivero (copiado de mila.gg)
// =============================================================================
// mila.gg: «Plan, research, or @ to reference files» — en la caja de su chat, «@» abre la lista de tus archivos y el
// elegido viaja con el pedido. Acá lo citable es lo de un copywriter: OTRO guion del árbol, «La oferta» (lo que el
// negocio vende, del Second Brain) y los archivos de El Archivero. Lo elegido queda como chip arriba de la caja y viaja
// con el próximo mensaje; el server lo lee y se lo pasa a la IA como DATOS (lib/copywriter/referencias.ts).
// Lo puro (cuándo se abre la lista y qué encuentra) vive en lib/copywriter/referencias-reglas.ts, con test.
// =============================================================================

import { INFO_TIPO } from '@/lib/copywriter/tipos';
import type { Referencia } from '@/lib/copywriter/referencias-reglas';

export function ListaReferencias({ opciones, activa, onElegir }: { opciones: readonly Referencia[]; activa: number; onElegir: (r: Referencia) => void }) {
  if (!opciones.length) return <div className="nt-menu nt-ref-menu" role="listbox" aria-label="Citar"><div className="nt-menu-vacio">Nada para citar con ese nombre</div></div>;
  return (
    <div className="nt-menu nt-ref-menu" role="listbox" aria-label="Citar" onMouseDown={(e) => e.preventDefault()}>
      <div className="nt-menu-grupo">Citar</div>
      {opciones.map((r, i) => (
        <button key={`${r.tipo}:${r.id}`} type="button" role="option" aria-selected={i === activa} className="nt-menu-fila" data-activa={i === activa ? '' : undefined} onClick={() => onElegir(r)}>
          <span className="nt-menu-cuadro" aria-hidden>{r.tipo === 'guion' ? (r.tipoGuion ? INFO_TIPO[r.tipoGuion].emoji : '📄') : r.tipo === 'oferta' ? '🎯' : '📎'}</span>
          <span className="nt-menu-textos">
            <span className="nt-menu-nombre">{r.nombre}</span>
            <span className="nt-menu-desc">{r.tipo === 'guion' ? 'Otro guion' : r.tipo === 'oferta' ? 'Lo que vende el negocio' : 'Archivo de El Archivero'}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function ChipsReferencias({ refs, onQuitar }: { refs: readonly Referencia[]; onQuitar: (r: Referencia) => void }) {
  if (!refs.length) return null;
  return (
    <div className="nt-ref-chips" aria-label="Lo que citas">
      {refs.map((r) => (
        <span key={`${r.tipo}:${r.id}`} className="nt-ref-chip">
          @{r.nombre}
          <button type="button" onClick={() => onQuitar(r)} aria-label={`Sacar ${r.nombre}`}>×</button>
        </span>
      ))}
    </div>
  );
}
