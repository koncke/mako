'use client';

// =============================================================================
// BibliotecaBloques — «Bloques» de la barra de edición: cada tarjeta de cada diseño copiado, para ponerla en cualquier hoja
// =============================================================================
// Martín, 6/11/2026: «quiero que todos los bloques nuevos se conviertan en bloques utilizables». A la izquierda los diseños del
// informe (los del Dashboard en el Dashboard; los de General en General, con los bloques de General de antes); a la derecha, las
// tarjetas del elegido, cada una con su vista previa DE VERDAD: el mismo diseño con sus datos de ejemplo (./DisenoEnMiniatura.tsx),
// dibujando sólo esa tarjeta (./parte.tsx), a su tamaño y achicado. Elegir una la inserta (lib/disenos-partes.ts → `insertarBloque`).
//
// ⚠️ SE DIBUJAN SÓLO LAS TARJETAS DEL DISEÑO ELEGIDO: cada vista previa monta el diseño entero (con su hoja de estilos), y trece por
//    diseño ya es mucho para un menú.
// ⚠️ QUIETAS: la miniatura no anima, no cuenta cifras y no lee la caja de IA (`quieta`), y no recibe el mouse.
// =============================================================================

import { useMemo, useState, type ReactNode } from 'react';
import type { Hoja } from '@/lib/graficos-catalogo';
import { instanciarPlantilla, plantillaHojaDe } from '@/lib/graficos-plantillas';
import { DISENOS, disenosDelInforme, type DisenoId, type ParteDiseno } from '@/lib/disenos-partes';
import { ParteSola } from './parte';
import { DisenoEnMiniatura } from './DisenoEnMiniatura';
import { CSS_BLOQUE_DISENO } from './BloqueDeDiseno';

/**
 * Lo que mide una tarjeta en una grilla de 960 px (más angosta que la de la hoja, 1.324: así una tarjeta a lo ancho no queda como
 * una raya), para dibujarla a ese tamaño y achicarla.
 */
const COL = (960 - 11 * 16) / 12;
const anchoDe = (p: ParteDiseno) => p.w * COL + (p.w - 1) * 16;
const altoDe = (p: ParteDiseno) => p.h * 30 + (p.h - 1) * 16;
const ANCHO_VISTA = 244;
const ALTO_VISTA = 150;

export const CSS_BIBLIOTECA = `
.lk-biblio { display: grid; grid-template-columns: 188px minmax(0, 1fr); min-height: 420px; max-height: min(640px, 76vh); }
.lk-biblio-disenos { border-right: 1px solid var(--border); padding: 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.lk-biblio-diseno { display: block; width: 100%; text-align: left; border: 0; background: none; font: inherit; font-size: 13px; color: var(--ink); padding: 7px 10px; border-radius: 8px; cursor: pointer; }
.lk-biblio-diseno:hover { background: var(--surface-2); }
.lk-biblio-diseno[aria-pressed="true"] { background: var(--surface-2); font-weight: 600; box-shadow: inset 2px 0 0 var(--primary); }
.lk-biblio-cuerpo { overflow-y: auto; padding: 10px 12px 14px; }
.lk-biblio-titulo { font-size: 12px; color: var(--dim); margin: 2px 2px 10px; }
.lk-biblio-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(${ANCHO_VISTA}px, 1fr)); gap: 12px; }
.lk-biblio-vista { position: relative; display: block; height: ${ALTO_VISTA}px; margin-bottom: 6px; border-radius: 10px; overflow: hidden; background: var(--bg); box-shadow: 0 0 0 1px var(--border); pointer-events: none; transition: box-shadow .12s; }
.lk-bloque:hover .lk-biblio-vista, .lk-bloque:focus-visible .lk-biblio-vista { box-shadow: 0 0 0 2px var(--primary); }
.lk-biblio-escala { position: absolute; left: 50%; top: 8px; transform-origin: top center; }
@media (max-width: 760px) { .lk-biblio { grid-template-columns: 1fr; } .lk-biblio-disenos { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--border); } .lk-biblio-diseno { white-space: nowrap; width: auto; } }
`;

/** La vista previa de UNA tarjeta: el diseño con sus datos de ejemplo, dibujando sólo ésta, a su tamaño y achicado. */
function VistaDeParte({ hoja, parte, hoy }: { hoja: Hoja; parte: ParteDiseno; hoy: string }) {
  const w = anchoDe(parte), h = altoDe(parte);
  const escala = Math.min((ANCHO_VISTA - 16) / w, (ALTO_VISTA - 16) / h);
  return (
    <span className="lk-biblio-vista" aria-hidden inert>
      <span className="lk-biblio-escala" style={{ width: w, height: h, transform: `translateX(-50%) scale(${escala})` }}>
        <span className="lk-diseno" style={{ display: 'block', width: w, height: h }} data-parte-sola={parte.id}>
          <ParteSola.Provider value={parte.id}><DisenoEnMiniatura hoja={hoja} hoy={hoy} /></ParteSola.Provider>
        </span>
      </span>
    </span>
  );
}

export type GrupoPropio = { id: string; nombre: string; contenido: ReactNode };

export function BibliotecaBloques({ informe, hoy, inicial, otros = [], onElegir }: {
  informe: 'dashboard' | 'general';
  hoy: string;
  /** El diseño que se abre primero (el de la hoja, si tiene). */
  inicial?: string | null;
  /** Grupos que no son de un diseño (en General, los bloques de General de antes). Van primero. */
  otros?: readonly GrupoPropio[];
  onElegir: (d: DisenoId, parte: string) => void;
}) {
  const disenos = useMemo(() => disenosDelInforme(informe), [informe]);
  const [elegido, setElegido] = useState<string>(() => (inicial && (disenos as string[]).includes(inicial) ? inicial : otros[0]?.id ?? disenos[0]));
  const propio = otros.find((g) => g.id === elegido);
  const d = propio ? null : (disenos as string[]).includes(elegido) ? (elegido as DisenoId) : null;
  // La hoja de la plantilla del diseño, con sus datos de ejemplo: de ahí dibuja cada vista previa.
  const hoja = useMemo(() => {
    const pl = d ? plantillaHojaDe(DISENOS[d].plantilla) : undefined;
    return pl ? instanciarPlantilla(pl) : null;
  }, [d]);
  return (
    <div className="lk-biblio" role="menu" aria-label="Bloques">
      <style href="dash-biblioteca" precedence="default">{CSS_BIBLIOTECA}</style>
      <style href="dash-bloque-diseno" precedence="high">{CSS_BLOQUE_DISENO}</style>
      <nav className="lk-biblio-disenos" aria-label="Diseños">
        {otros.map((g) => (
          <button key={g.id} type="button" className="lk-biblio-diseno" aria-pressed={elegido === g.id} onClick={() => setElegido(g.id)}>{g.nombre}</button>
        ))}
        {disenos.map((x) => (
          <button key={x} type="button" className="lk-biblio-diseno" aria-pressed={elegido === x} onClick={() => setElegido(x)}>{DISENOS[x].nombre}</button>
        ))}
      </nav>
      <div className="lk-biblio-cuerpo">
        {propio ? propio.contenido : d && (
          <>
            <p className="lk-biblio-titulo">Las tarjetas de «{DISENOS[d].nombre}». Elige una y entra con sus datos.</p>
            <div className="lk-biblio-grilla">
              {DISENOS[d].partes.map((p) => (
                // Un div y no un <button>: la vista previa es la tarjeta de verdad y trae sus botones (un botón adentro de otro
                // no es HTML, y React lo avisa al hidratar). Se elige igual con el teclado.
                <div key={p.id} role="menuitem" tabIndex={0} className="lk-bloque" onClick={() => onElegir(d, p.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onElegir(d, p.id); } }}>
                  {hoja ? <VistaDeParte hoja={hoja} parte={p} hoy={hoy} /> : <span className="lk-biblio-vista" aria-hidden />}
                  <span className="lk-bloque-nombre">{p.nombre}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
