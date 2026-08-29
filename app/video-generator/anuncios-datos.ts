import 'server-only';

// =============================================================================
// Los anuncios TERMINADOS del workspace
// =============================================================================
// El dueño: «sería bueno que vayas guardando los vídeos ya generados y
// finalizados abajo de las plantillas, por ahora los tendremos allí, luego lo
// mudaremos».
//
// «Por ahora» está tomado en serio: esto es una LISTA, no una galería con
// filtros ni una tab. Cuando el pipeline de video exista y produzca varios por
// semana, se muda a lo suyo — y el día que se mude, lo que hay que cambiar es
// esta lectura, no cinco pantallas.
//
// ── Por qué no es el historial ──────────────────────────────────────────────
// `video-datos.ts` ya guarda un historial, pero guarda PLANES —el guion repartido
// en tomas— y se recorta a 10. Un plan no es un anuncio: hoy «Generar anuncio»
// escribe el plan y no genera ni un clip. Meter las dos cosas en la misma lista
// haría que la pantalla que dice «tus anuncios» muestre cosas que no son
// anuncios, que es la forma más rápida de que nadie le crea.
//
// ── Dónde viven los archivos ────────────────────────────────────────────────
// Hoy en `public/anuncios/`, servidos por Vercel como cualquier estático. Es
// deuda consciente y tiene fecha de vencimiento: son archivos del repo, iguales
// para todos los workspaces, así que solo sirve mientras los anuncios cargados a
// mano sean los de un cliente. El día que el pipeline baje los clips de Flow,
// `url` pasa a apuntar a storage y esta lista no cambia — por eso guarda una
// URL y no un nombre de archivo.

import { getSetting, setSetting } from '@/lib/settings';

export const KEY_ANUNCIOS = 'video-generator.anuncios';

export type AnuncioHecho = {
  id: string;
  /** Cómo lo reconoce el dueño. Suele ser el título del guion. */
  titulo: string;
  /** El video terminado, listo para reproducir. */
  url: string;
  /** Un cuadro para la portada. Sin él, la tarjeta muestra el video en pausa. */
  poster?: string;
  /** Con qué formato se produjo (id de lib/puestas-data.ts). */
  puestaId: string;
  /** El guion del que salió, si se sabe. Es lo que cierra el círculo con la lista de guiones. */
  guionId?: string;
  duracionSeg: number;
  /** ISO. Cuándo quedó terminado. */
  at: string;
};

const esAnuncio = (v: unknown): v is AnuncioHecho => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.url === 'string' && o.url.length > 0
    && typeof o.titulo === 'string' && typeof o.at === 'string';
};

/**
 * Los anuncios terminados, del más nuevo al más viejo.
 *
 * Tolerante a propósito: basura en el setting devuelve lista vacía en vez de
 * tumbar la pantalla. Un anuncio que no se puede leer es un anuncio menos, no
 * una tab caída.
 */
export async function leerAnuncios(): Promise<AnuncioHecho[]> {
  try {
    const raw = await getSetting(KEY_ANUNCIOS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(esAnuncio).sort((a, b) => (a.at < b.at ? 1 : -1));
  } catch {
    return [];
  }
}

/** Agrega uno (o lo reemplaza por id). Devuelve la lista nueva. */
export async function guardarAnuncio(item: AnuncioHecho): Promise<AnuncioHecho[]> {
  const actual = await leerAnuncios();
  const nuevo = [item, ...actual.filter((a) => a.id !== item.id)];
  await setSetting(KEY_ANUNCIOS, JSON.stringify(nuevo));
  return nuevo;
}
