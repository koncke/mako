// =============================================================================
// El «antes» y el «después» de un montaje, dichos como lo que son (F166 (c), 18/11/2026)
// =============================================================================
// El «antes» no es una medición: es la SUMA de las duraciones que se le PIDIERON a Flow por toma (worker/montar-cola.mjs,
// lib/montaje/pipeline.ts), no el largo del material que volvió. La API de MaKo ya lo rotula así
// (`segundos_antes_estimados`, lib/api-mako/areas/video.helpers.ts) y la pantalla decía «De 0:45 a 0:38» con los dos
// números en el mismo tono, como si los dos se hubieran medido. Regla (docs/hallazgos-video-pipeline.md §15): un número
// que la pantalla pone al lado de una medición se mide igual, o se rotula como estimado. El «después» sí sale del archivo
// montado (ffmpeg), y va sin rótulo.
//
// Aparte de PasoMontaje para tener test sin cargar sus server actions (tests/video-montaje-duraciones.test.ts).
// =============================================================================

/** `70.04` → `1:10`. Sin decimales: nadie lee un anuncio en centésimas. */
export function reloj(seg: number): string {
  const s = Math.round(seg);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** «De 0:45 (estimado) a 0:38»: el de antes, rotulado; el de después, el medido. */
export function DuracionesMontaje({ antes, despues }: { antes: number; despues: number }) {
  return (
    <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>
      De <strong>{reloj(antes)}</strong>{' '}
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>(estimado)</span>{' '}
      a <strong>{reloj(despues)}</strong>
    </div>
  );
}
