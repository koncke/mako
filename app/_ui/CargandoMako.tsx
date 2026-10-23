// =============================================================================
// CargandoMako — EL loader de las tabs y secciones grandes: la criatura de MaKo y una barra que corre (23/10/2026)
// =============================================================================
// Martín, 23/10/2026: «Los loader de las tabs o secciones grandes, quiero que sean todos como el de Ops Center. Con la
// criatura de MaKo. Solo que le falta algún elemento tipo loader para que se entienda que es un loader, si está solo la
// criatura no se entiende». Y antes: «ni siquiera hay un loader aunque sea, como para indicarme que le di click».
//
// Es la criatura del Ops Center (app/second-brain/EntradaOps.tsx: nace con un rebote y flota) con la barra
// INDETERMINADA de Linear y de Material debajo: una pista fina y un tramo que la cruza una y otra vez. Esa barra es la
// que dice «está cargando» sin una palabra (la criatura sola se lee como una ilustración).
//
// La regla: ningún clic queda sin respuesta visible. El fondo tapa al instante lo que había (la pantalla anterior o
// un esqueleto), y la criatura y la barra aparecen a los 150 ms: una carga más corta no hace parpadear nada.
//
// ⚠️ SIN HOOKS y sin 'use client': lo dibujan los `loading.tsx` (server) y las cargas de cliente por igual. El CSS
// vive en app/_ui/ui.css (global): no depende de la hoja del Centro.
// ⚠️ SIN TEXTO A LA VISTA: un «Cargando…» que aparece y se va en un segundo es ruido (app/crm/loading.tsx). Para el
// lector de pantalla va `role="status"` con el nombre de lo que carga.
// =============================================================================

import type { CSSProperties } from 'react';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';

/** Lo que tarda en aparecer la criatura: antes de esto, una carga no hace parpadear nada. */
export const MS_APARECE = 150;

export function CargandoMako({ que, cubre = false, alto, size = 64, style }: {
  /** Qué está cargando, para el lector de pantalla: «Cargando {que}». */
  que?: string;
  /** Tapa lo que hay debajo (un esqueleto, la pantalla anterior) con el fondo, como la capa del Ops Center. */
  cubre?: boolean;
  /** Alto de la caja cuando no cubre (por defecto, el de la pantalla menos la barra de agencia). */
  alto?: CSSProperties['height'];
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`cm-carga${cubre ? ' cm-carga--cubre' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={que ? `Cargando ${que}` : 'Cargando'}
      style={{ ...(cubre ? null : { height: alto ?? 'calc(100dvh - var(--barra-agencia, 0px))' }), ...style }}
    >
      <div className="cm-carga__centro">
        <div className="cm-carga__cria">
          <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={size} />
        </div>
        <div className="cm-carga__pista" aria-hidden><span className="cm-carga__tramo" /></div>
      </div>
    </div>
  );
}

/** La barra sola, para un lugar chico donde la criatura no entra (un panel, una lista). */
export function BarraCargando({ que, style }: { que?: string; style?: CSSProperties }) {
  return (
    <div className="cm-carga__pista cm-carga__pista--sola" role="status" aria-busy="true" aria-label={que ? `Cargando ${que}` : 'Cargando'} style={style}>
      <span className="cm-carga__tramo" />
    </div>
  );
}
