// =============================================================================
// tutorial-video — cuando la respuesta es «mirá este video», no un muro de texto
// =============================================================================
// EL PEDIDO DEL DUEÑO (2026-08-25): «Cuando un lead pide un tutorial de algo,
// sería bueno que se busque un vídeo de YouTube y se le diga "Aquí tienes el
// tutorial, míralo y dime si necesitas ayuda con algo"».
//
// EL CASO. El cliente preguntó, textual: «decime cómo agregar mi pixel de meta a
// mi landing page». MaKo le escribió sesenta líneas con bloques de código, un id
// de píxel inventado y pasos de Vercel que no hacen nada.
//
// ⚠️ Y LA DISTINCIÓN QUE FALTABA, que es el corazón de esto: **su landing no es
// MaKo**. Instalar el píxel de Meta en un Vercel propio es una tarea de SU stack,
// no de esta herramienta — mandarlo a /integraciones (donde se pega el token
// DENTRO de MaKo) contesta otra pregunta. Son dos cosas distintas:
//
//   · «¿cómo hago X EN MAKO?»        → la tarjeta de /integraciones, que tiene el
//                                       tutorial oficial escrito por el equipo.
//   · «¿cómo hago X EN MI SITIO?»    → MaKo no lo sabe y no tiene por qué. Un
//                                       video es mejor respuesta que un texto
//                                       largo inventado.
//
// Confundir las dos es lo que produjo el manual con el id de juguete: se le pidió
// a MaKo que explicara algo que está fuera de su producto, y explicó igual.
// =============================================================================

import 'server-only';
import { credWs } from './credenciales';
import { wsSuperAdmin } from './workspace';
import type { VideoTutorial } from './tutorial-video-texto';

// El texto vive aparte y se re-exporta para que quien use este módulo no tenga
// que saber de la división.
export { textoTutorial, type VideoTutorial } from './tutorial-video-texto';

/**
 * La key de YouTube: la del cliente si la cargó, si no la de la plataforma.
 *
 * A diferencia de la IA, buscar un video NO es un dato del cliente ni le gasta
 * cuota que le sirva para otra cosa: es una capacidad de la herramienta. La free
 * tier son 10.000 unidades por día y una búsqueda cuesta 100 → ~100 búsquedas
 * diarias, de sobra para esto.
 */
async function keyYoutube(): Promise<string | null> {
  const propia = await credWs('YOUTUBE_API_KEY').catch(() => null);
  if (propia) return propia;
  const ws = await wsSuperAdmin().catch(() => null);
  if (ws != null) {
    const plataforma = await credWs('YOUTUBE_API_KEY', ws).catch(() => null);
    if (plataforma) return plataforma;
  }
  return process.env.YOUTUBE_API_KEY || null;
}

/** Los últimos N años, en ISO. Un tutorial de una UI que ya cambió es peor que nada. */
function desdeHace(anios: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anios);
  return d.toISOString();
}

async function pedir(key: string, q: string, publishedAfter?: string): Promise<VideoTutorial[]> {
  const u = new URL('https://www.googleapis.com/youtube/v3/search');
  u.searchParams.set('part', 'snippet');
  u.searchParams.set('q', q);
  u.searchParams.set('type', 'video');
  u.searchParams.set('maxResults', '5');
  u.searchParams.set('order', 'relevance');
  // En español: el cliente es hispanohablante y un tutorial en otro idioma no le
  // sirve aunque sea mejor.
  u.searchParams.set('relevanceLanguage', 'es');
  // Que se pueda ver embebido filtra los que están restringidos.
  u.searchParams.set('videoEmbeddable', 'true');
  if (publishedAfter) u.searchParams.set('publishedAfter', publishedAfter);
  u.searchParams.set('key', key);

  const r = await fetch(u, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
  if (!r.ok) return [];
  const b = (await r.json()) as { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string } }> };
  return (b.items ?? [])
    .map((it) => ({
      titulo: (it.snippet?.title ?? '').replace(/&(amp|quot|#39);/g, (m) => ({ '&amp;': '&', '&quot;': '"', '&#39;': "'" }[m] ?? m)),
      canal: it.snippet?.channelTitle ?? '',
      publicado: (it.snippet?.publishedAt ?? '').slice(0, 10),
      url: it.id?.videoId ? `https://youtu.be/${it.id.videoId}` : '',
    }))
    .filter((v) => v.url && v.titulo);
}

/**
 * Busca un tutorial en video. Devuelve hasta 3, del más relevante al menos.
 *
 * ⚠️ PRIMERO ACOTADO A LOS ÚLTIMOS 3 AÑOS. En un tutorial de configuración, la
 * antigüedad no es un detalle: las pantallas de Meta y de Vercel cambian, y un
 * video de 2021 manda a buscar un botón que ya no existe — que es peor que no
 * contestar, porque el que lo mira cree que está haciendo algo mal. Si no hay
 * nada reciente, se afloja el filtro antes que quedarse sin respuesta.
 */
export async function buscarTutorial(tema: string): Promise<VideoTutorial[]> {
  const q = (tema || '').trim();
  if (!q) return [];
  const key = await keyYoutube();
  if (!key) return [];
  try {
    const recientes = await pedir(key, q, desdeHace(3));
    if (recientes.length) return recientes.slice(0, 3);
    return (await pedir(key, q)).slice(0, 3);
  } catch {
    return [];
  }
}

