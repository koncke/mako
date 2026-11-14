// =============================================================================
// Marketing CoPilot — tu VSL, en la tarjeta de Anuncios (14/11/2026): lo que decide el código, PURO (con test)
// =============================================================================
// Martín a Julio (13/11, min 00:50): «conectar el VSL de Wistia… después va a estar bien vinculado». Lo que mide de verdad cuánto
// ve la gente del VSL es el Pixel de MaKo en la landing (los eventos de video de Wistia, Panda o YouTube: lib/landing-retencion*.ts,
// la misma lectura que `ver_retencion_video_landing` de la API). Acá se resume para la tarjeta: la curva en cuartos, dónde se va
// más gente y UNA frase. Sin eventos, null: la tarjeta pide conectar (el Pixel y el alojador), no dibuja una curva en cero.
// =============================================================================

import type { RetencionDeVideo } from '@/lib/landing-retencion';

export type ResumenVsl = {
  titulo: string | null;
  /** Personas con avance medido (los que le dieron play, si los hay; si no, todos). */
  personas: number;
  /** El % que sigue mirando en el 0, 25, 50, 75 y 100 % del video. */
  cuartos: Array<{ corte: number; porcentaje: number }>;
  /** El tramo de 5 % donde se va más gente. */
  caida: { desde: number; hasta: number; pierde: number } | null;
  frase: string;
};

/** Con menos que esto, una curva no dice nada todavía. */
export const MINIMO_PERSONAS_VSL = 10;

const redondo = (n: number) => Math.round(n);

export function resumenVsl(videos: readonly RetencionDeVideo[]): ResumenVsl | null {
  const conCurva = videos
    .map((v) => ({ v, g: v.dieron_play.medidos > 0 && v.dieron_play.por_porcentaje ? v.dieron_play : v.todos }))
    .filter((x) => x.g.por_porcentaje && x.g.medidos > 0)
    .sort((a, b) => b.g.medidos - a.g.medidos);
  const top = conCurva[0];
  if (!top || top.g.medidos < MINIMO_PERSONAS_VSL) return null;
  const curva = [...(top.g.por_porcentaje ?? [])].sort((a, b) => a.corte - b.corte);
  const en = (c: number) => {
    const exacto = curva.find((p) => p.corte === c);
    if (exacto) return exacto.porcentaje;
    const despues = curva.find((p) => p.corte > c);
    return despues ? despues.porcentaje : (curva.at(-1)?.porcentaje ?? 0);
  };
  const cuartos = [0, 25, 50, 75, 100].map((c) => ({ corte: c, porcentaje: redondo(c === 0 ? Math.max(en(0), 100) : en(c)) }));
  let caida: ResumenVsl['caida'] = null;
  for (let i = 1; i < curva.length; i++) {
    const pierde = curva[i - 1].porcentaje - curva[i].porcentaje;
    if (pierde > 0 && (!caida || pierde > caida.pierde)) caida = { desde: curva[i - 1].corte, hasta: curva[i].corte, pierde: redondo(pierde) };
  }
  const mitad = cuartos[2].porcentaje;
  const frase = `De ${top.g.medidos.toLocaleString('es')} que le dieron play, ${mitad} % llega a la mitad`
    + (caida && caida.pierde >= 5 ? ` y el ${caida.pierde} % se va entre el ${caida.desde} % y el ${caida.hasta} % del video.` : '.');
  return { titulo: top.v.titulo, personas: top.g.medidos, cuartos, caida, frase };
}
