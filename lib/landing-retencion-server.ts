// La lectura de la retención por video de UNA landing (ticket #74): los eventos de video del Pixel de esa página y ese
// período, en tandas, y la cuenta pura de lib/landing-retencion.ts.
import 'server-only';
import { getTenantDb } from './workspace';
import { normalizarUrl } from './landing-paginas';
import { retencionPorVideo, type EventoRetencion, type RetencionDeVideo } from './landing-retencion';

/** Filas por tanda: el techo de PostgREST es 1000 y lo que pasa de ahí se corta SIN error. */
const TANDA = 1000;
/** Hasta cuántas filas se leen. Arriba de esto la respuesta lo dice (`recortado`), no lo esconde. */
const TOPE_FILAS = 60_000;

export type RetencionDeLanding = {
  url: string;
  desde: string;
  hasta: string;
  /** FALSE = la consulta falló: los ceros de abajo NO son ceros. */
  medido: boolean;
  videos: RetencionDeVideo[];
  recortado: boolean;
  nota: string;
};

const host = (u: string): string | null => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return null; } };

export async function retencionDeLanding(opts: { url: string; desde: string; hasta: string; video?: string | null }): Promise<RetencionDeLanding> {
  const url = normalizarUrl(opts.url);
  const base = { url: url ?? opts.url, desde: opts.desde, hasta: opts.hasta, videos: [] as RetencionDeVideo[], recortado: false };
  if (!url) return { ...base, medido: false, nota: 'Esa no es una dirección válida.' };
  const dominio = host(url);
  const db = await getTenantDb();
  const filas: Array<EventoRetencion & { landing_url: string | null }> = [];
  try {
    for (let desdeFila = 0; desdeFila < TOPE_FILAS; desdeFila += TANDA) {
      let q = db.from('vsl_events')
        .select('visitor_id, video_id, vsl_titulo, tipo_evento, porcentaje, segundos, auto, landing_url')
        .not('video_id', 'is', null)
        // Las pruebas del Pixel no cuentan: son los toques de quien está probando la instalación.
        .is('prueba', null)
        .gte('created_at', opts.desde)
        .lt('created_at', opts.hasta);
      // Un primer corte por dominio en la consulta, para no bajar los eventos de todas las páginas del negocio; el de
      // la página exacta va abajo, en JS, con la misma normalización que las visitas y los clics (utm, barra final, www).
      if (dominio) q = q.ilike('landing_url', `%${dominio}%`);
      if (opts.video?.trim()) q = q.eq('video_id', opts.video.trim());
      const { data, error } = await q.order('id', { ascending: true }).range(desdeFila, desdeFila + TANDA - 1);
      if (error) throw new Error(error.message);
      const tanda = (data ?? []) as Array<EventoRetencion & { landing_url: string | null }>;
      filas.push(...tanda);
      if (tanda.length < TANDA) break;
    }
  } catch (e) {
    console.error(`[landing-retencion] ${e instanceof Error ? e.message : String(e)}`);
    return { ...base, medido: false, nota: 'No se pudo leer: esto NO es un cero. Vuelve a pedirlo antes de concluir algo.' };
  }
  const recortado = filas.length >= TOPE_FILAS;
  const suyas = filas.filter((f) => normalizarUrl(f.landing_url ?? '') === url);
  const videos = retencionPorVideo(suyas);
  return {
    ...base, medido: true, videos, recortado,
    nota: [
      videos.length ? null : 'Ningún evento de video de esta página en el período: la consulta corrió bien, es un cero de verdad (o el Pixel de la página es anterior a la v12, que no decía de qué página venía cada evento).',
      'por_minuto: de las personas con avance medido, cuántas llegaron por lo menos a ese minuto (si alguien adelantó el video, cuenta como que pasó por lo que saltó). El denominador son los medidos, no los que arrancaron: quien dio play y no dejó avance puede ser un agujero de medición.',
      'dieron_play = sólo quienes le dieron play ellos; todos incluye a los que el video les arrancó solo (autoplay). Las fechas van en UTC.',
      recortado ? `Se leyeron ${TOPE_FILAS} eventos: hay más sin contar, achica el período.` : null,
    ].filter(Boolean).join(' '),
  };
}
