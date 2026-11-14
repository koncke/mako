'use client';

// =============================================================================
// OriginalAlLado — el original de una réplica, AL LADO de la página (13/11/2026, la maqueta aprobada del flujo nuevo)
// =============================================================================
// Martín, el relevo de Copywriting: «no está transcribiendo», y lo transcrito quedaba escondido en «Ver el original» (un modal).
// Ahora el original se ve junto a lo que MaKo escribe: en la computadora, una columna a la derecha de la página; en el teléfono, la
// pestaña «Original» (app/m/copywriter/GuionM.tsx). Dice qué es lo que se ve: lo que se DICE (transcrito) o, si no se pudo
// transcribir, su pie, su descripción o su copy (y que MaKo no sabe lo que se dice). Cuando MaKo termina de transcribirlo
// (./transcribir-original.ts), avisa con `avisarOriginalNuevo` y la columna vuelve a leerlo.
// =============================================================================

import { useEffect, useState } from 'react';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { rotuloDeFormato, type OutlierCopy } from '@/lib/copywriter/outliers';
import { pedirOriginal } from './cliente';

/** El aviso de «el original cambió» (lo transcribió MaKo): la columna lo vuelve a leer. */
export const EVENTO_ORIGINAL = 'mako:original-nuevo';
export function avisarOriginalNuevo(outlier: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_ORIGINAL, { detail: outlier }));
}

/** Qué es el texto que se ve, en una línea. */
export function queEsElTexto(o: Pick<OutlierCopy, 'deDonde' | 'formato'>): { transcrito: boolean; texto: string } {
  if (o.deDonde === 'guion') return { transcrito: true, texto: 'Transcrito: lo que se dice' };
  const video = o.formato === 'reel' || o.formato === 'youtube';
  const que = o.deDonde === 'pie' ? 'su pie' : o.deDonde === 'descripcion' ? 'su descripción' : 'su copy';
  return { transcrito: false, texto: video ? `Sin transcripción: es ${que}, no lo que se dice` : `Es ${que}` };
}

export function OriginalAlLado({ outlier, telefono = false }: { outlier: string; telefono?: boolean }) {
  const [o, setO] = useState<OutlierCopy | { error: string } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    const otraVez = (e: Event) => { if ((e as CustomEvent<string>).detail === outlier) setVuelta((n) => n + 1); };
    window.addEventListener(EVENTO_ORIGINAL, otraVez);
    return () => window.removeEventListener(EVENTO_ORIGINAL, otraVez);
  }, [outlier]);
  useEffect(() => {
    let vivo = true;
    void pedirOriginal(outlier).then((r) => { if (vivo) setO(r.ok ? r.outlier : { error: r.error }); });
    return () => { vivo = false; };
  }, [outlier, vuelta]);

  const leido = o && 'id' in o ? o : null;
  const que = leido ? queEsElTexto(leido) : null;
  const quien = leido ? (leido.creador.usuario ? `@${leido.creador.usuario}` : leido.creador.nombre) : '';
  return (
    <aside className="nt-original-lado" data-telefono={telefono ? '' : undefined} aria-label="El original">
      <div className="nt-original-cabeza">
        <strong>Original</strong>
        {leido ? <span className="nt-original-meta">{rotuloDeFormato(leido)} · {quien}</span> : null}
        {que ? <span className="nt-original-sello" data-transcrito={que.transcrito ? '' : undefined}>{que.transcrito ? '✓ ' : ''}{que.texto}</span> : null}
      </div>
      {!o ? <p className="nt-ejemplo-nota">Leyendo el original…</p>
        : 'error' in o ? <p className="nt-ejemplo-nota" role="alert">No pude leer el original: {o.error}<ReportarASoporte /></p>
          : (
            <>
              {o.gancho && o.deDonde !== 'guion' && !o.texto.startsWith(o.gancho.replace(/…$/, '')) ? <p className="nt-original-gancho">{o.gancho}</p> : null}
              <div className="nt-original">{o.texto}</div>
              <a className="nt-miga" href={o.url} target={telefono ? undefined : '_blank'} rel="noopener noreferrer">{o.formato === 'anuncio' ? 'Ver el anuncio' : 'Ver el original'} ↗</a>
            </>
          )}
    </aside>
  );
}
