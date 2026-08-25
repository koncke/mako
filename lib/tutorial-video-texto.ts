// =============================================================================
// tutorial-video-texto — QUÉ dice el mensaje del tutorial. Sin `server-only`.
// =============================================================================
// Separado de `tutorial-video.ts` (que hace el trabajo sucio: resolver la key y
// pegarle a YouTube) por la regla de la casa: lo que hay que poder TESTEAR va en
// un módulo que un test pueda importar. Mismo criterio que `alerta-critica-texto`
// y `respuesta-doer`.
// =============================================================================

export type VideoTutorial = {
  titulo: string;
  canal: string;
  publicado: string;   // YYYY-MM-DD
  url: string;
};

/**
 * Cómo se le ofrece al cliente. Lo escribe el CÓDIGO, no el modelo.
 *
 * Dos razones, y las dos ya se pagaron esta semana: el link de un video son 11
 * caracteres al azar que un LLM transcribe mal, y **el canal y la fecha tienen que
 * ir**. MaKo no vio ese video: no puede presentarlo como «el tutorial oficial».
 * Decir de quién es y de cuándo es le deja a la persona con qué juzgarlo.
 */
export function textoTutorial(videos: VideoTutorial[], tema: string): string {
  if (!videos.length) {
    return `No encontré un video decente de «${tema}». Contame en qué parte te trabás y lo vemos juntos.`;
  }
  const v = videos[0];
  return [
    `Acá tenés el tutorial 👇`,
    `*${v.titulo}*`,
    `${v.canal}${v.publicado ? ` · ${v.publicado.slice(0, 4)}` : ''}`,
    v.url,
    '',
    'Miralo y si te trabás en algún paso, decime cuál y te ayudo.',
  ].join('\n');
}
