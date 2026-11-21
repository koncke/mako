// =============================================================================
// UN SOLO VIDEO A LA VEZ, Y EN LA ESQUINA SÓLO EL ÚLTIMO (21/11/2026)
// =============================================================================
// Martín, probando en el ws 3: «me reproduje un video de arriba y después estoy reproduciendo el de abajo, pero se marca abajo a la
// derecha el video de arriba». Al darle play a un video con sonido:
//   · se pausan todos los demás (el del chat, el del motor, el de la esquina);
//   · lo que flotaba en la esquina, si es OTRO video, deja de flotar (`terminar(…, 'omitido')`, como su X). El que se reproduce flota
//     sólo si sale de la vista (./useVideoQueFlota.ts), así que el de abajo, a la vista, no flota.
// Los videos mudos (de adorno, en bucle) no cuentan: ni pausan a los demás ni se pausan.
// Lo instala <MotorTutorial> una vez para toda la pantalla. Lo prueba tests/un-video-a-la-vez.test.ts.
// =============================================================================
import { senalAhora, terminar } from './store';

type Medio = { tagName?: string; muted: boolean; paused: boolean; pause(): void; closest?(sel: string): unknown };

/** Lo que dibuja el motor en la esquina o en su lugar: su <video> no se suelta a sí mismo. */
const DEL_MOTOR = '.mk-pip, .mk-tuto__video';
/** El video del recorrido del motor, en la ESQUINA (fuera de su mensaje). */
const TUTORIAL_EN_LA_ESQUINA = '.mk-tuto__video:not([data-en-lugar])';

/** Pausa los videos con sonido que no son `este`. Devuelve cuántos. */
export function pausarLosDemas(este: Medio, todos: Iterable<Medio>): number {
  let n = 0;
  for (const v of todos) if (v !== este && !v.paused && !v.muted) { v.pause(); n++; }
  return n;
}

/** Si lo que flota en la esquina es de otro video, deja de flotar. Devuelve si soltó algo. */
export function soltarLoQueFlota(este: Medio, doc: Pick<Document, 'querySelector'>): boolean {
  if (este.closest?.(DEL_MOTOR)) return false;
  const s = senalAhora();
  if (!s) return false;
  if (s.tipo === 'video' || (s.tipo === 'tutorial' && doc.querySelector(TUTORIAL_EN_LA_ESQUINA))) { terminar(s.id, 'omitido'); return true; }
  return false;
}

/** Escucha los play de toda la pantalla (en captura: el evento no burbujea). Devuelve cómo sacarlo. */
export function instalarUnVideoALaVez(doc: Document): () => void {
  const alPlay = (e: Event) => {
    const v = e.target as unknown as Medio | null;
    if (!v || v.tagName !== 'VIDEO' || v.muted) return;
    pausarLosDemas(v, Array.from(doc.querySelectorAll('video')) as unknown as Medio[]);
    soltarLoQueFlota(v, doc);
  };
  doc.addEventListener('play', alPlay, true);
  return () => doc.removeEventListener('play', alPlay, true);
}
