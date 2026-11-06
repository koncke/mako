// =============================================================================
// thumbnails/carga — llenar la biblioteca de miniaturas desde la YouTube Data API (la corre la PC, 6/11/2026)
// =============================================================================
// Lo usa scripts/thumbnails-biblioteca.mts, con la clave de YouTube de la PLATAFORMA. Dos pasos, como la biblioteca de carruseles
// (una lista de creadores y sus publicaciones):
//
//   1. DESCUBRIR canales por rubro: `search.list` (type=video, order=viewCount, de los últimos N días, en un idioma) con UNA
//      consulta por rubro e idioma, y se quedan los canales que más aparecen. ⚠️ `search.list` tiene un balde propio de 100
//      LLAMADAS POR DÍA para toda la app (desde el 1/6/2026: docs/hallazgos-competitors-spy.md), así que acá se usa poco: 4
//      rubros × 3 idiomas = 12 llamadas como mucho por corrida, y el script lleva el tope (`--max-busquedas`).
//   2. LEER cada canal por el camino barato de Spy (`traerVideosDelCanal`, lib/spy-youtube.ts: channels → playlistItems → videos,
//      ~3 unidades de las 10.000 diarias por canal). Se guardan sus videos largos con sus vistas; el múltiplo se calcula al
//      mostrar (./explorar.ts) y sólo con la enmienda III.L.
//
// La imagen no se guarda: se dibuja la de `i.ytimg.com`. Lo que sí se guarda (títulos, vistas) vence a los 30 días (`podar`).
// Lo puro (leer las respuestas, armar las filas) se prueba sin red (tests/thumbnails-carga.test.ts).
// =============================================================================

import type { Buscador, CanalYoutube, VideoYoutube } from '../spy-youtube';
import { esCorto, esIdDeVideo, type IdiomaThumbnail, type NichoThumbnail } from './explorar';

const API = 'https://www.googleapis.com/youtube/v3';

/**
 * Lo que se busca en cada rubro e idioma: frases que dice un dueño de negocio (no palabras sueltas, que traen música o
 * videojuegos). Una consulta por par: con el tope de 100 llamadas por día, no se gasta en variantes.
 */
export const CONSULTAS: Record<NichoThumbnail, Record<IdiomaThumbnail, string>> = {
  ventas: { es: 'cómo vender más técnicas de ventas', en: 'sales training how to close more sales', pt: 'técnicas de vendas como vender mais' },
  marketing: { es: 'marketing digital para negocios estrategia', en: 'marketing strategy for small business', pt: 'marketing digital para negócios' },
  emprendimiento: { es: 'emprendimiento cómo empezar un negocio', en: 'entrepreneurship how to start a business', pt: 'empreendedorismo como começar um negócio' },
  servicios: { es: 'cómo conseguir clientes para tu negocio de servicios', en: 'how to get clients for your service business', pt: 'como conseguir clientes para prestação de serviços' },
};

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const ID_CANAL = /^UC[A-Za-z0-9_-]{20,}$/;

/** El pedido a `search.list`: 1 llamada (del balde de 100 por día), 50 videos, los más vistos de los últimos `dias`. */
export function urlDeBusqueda(consulta: string, idioma: IdiomaThumbnail, clave: string, o: { dias?: number; ahora?: number } = {}): string {
  const u = new URL(`${API}/search`);
  const desde = new Date((o.ahora ?? Date.now()) - Math.max(7, o.dias ?? 180) * 86_400_000).toISOString();
  u.searchParams.set('part', 'snippet');
  u.searchParams.set('type', 'video');
  u.searchParams.set('order', 'viewCount');
  u.searchParams.set('maxResults', '50');
  u.searchParams.set('q', consulta);
  u.searchParams.set('relevanceLanguage', idioma);
  u.searchParams.set('publishedAfter', desde);
  // Ni Shorts ni videos de 4 horas: 4 a 20 minutos es lo que publica un dueño de negocio que enseña.
  u.searchParams.set('videoDuration', 'medium');
  u.searchParams.set('safeSearch', 'strict');
  u.searchParams.set('key', clave);
  return u.toString();
}

/** De una respuesta de `search.list`, los canales y cuántas veces aparecen, de más a menos (sin repetidos, sólo ids válidos). */
export function canalesDeBusqueda(cuerpo: unknown): Array<{ id: string; nombre: string | null; veces: number }> {
  const items = esObj(cuerpo) && Array.isArray(cuerpo.items) ? cuerpo.items.filter(esObj) : [];
  const m = new Map<string, { id: string; nombre: string | null; veces: number; orden: number }>();
  items.forEach((it, i) => {
    const s = esObj(it.snippet) ? it.snippet : {};
    const id = str(s.channelId);
    if (!ID_CANAL.test(id)) return;
    const x = m.get(id) ?? { id, nombre: str(s.channelTitle) || null, veces: 0, orden: i };
    x.veces += 1;
    m.set(id, x);
  });
  return [...m.values()].sort((a, b) => b.veces - a.veces || a.orden - b.orden).map(({ id, nombre, veces }) => ({ id, nombre, veces }));
}

/** El error de YouTube en una frase («cuota», «clave», …) para el log del script. */
export function motivoDeError(status: number, cuerpo: unknown): string {
  const e = esObj(cuerpo) && esObj(cuerpo.error) ? cuerpo.error : {};
  const razon = Array.isArray(e.errors) && esObj(e.errors[0]) ? str((e.errors[0] as Record<string, unknown>).reason) : '';
  if (status === 403 && /quota/i.test(razon)) return 'se terminó la cuota de YouTube de hoy (vuelve a correr mañana)';
  if (status === 400 && /keyInvalid|badRequest/i.test(razon)) return 'la clave de YouTube no es válida';
  if (status === 403) return `YouTube no dejó (${razon || 'sin motivo'})`;
  return `YouTube contestó ${status}${razon ? ` (${razon})` : ''}`;
}

/** Una búsqueda, con su `fetch` por parámetro (los tests lo pasan de mentira). */
export async function buscarCanales(consulta: string, idioma: IdiomaThumbnail, clave: string, buscar: Buscador, o: { dias?: number } = {}): Promise<{ ok: true; canales: Array<{ id: string; nombre: string | null; veces: number }> } | { ok: false; error: string }> {
  const r = await buscar(urlDeBusqueda(consulta, idioma, clave, o));
  let cuerpo: unknown = null;
  try { cuerpo = await r.json(); } catch { cuerpo = null; }
  if (r.status !== 200) return { ok: false, error: motivoDeError(r.status, cuerpo) };
  return { ok: true, canales: canalesDeBusqueda(cuerpo) };
}

/** La fila de un canal (mig 0409) por lo que contestó `channels.list`. */
export function filaDeCanal(c: CanalYoutube, nicho: NichoThumbnail, idioma: IdiomaThumbnail, fuente: 'busqueda' | 'lista', ahora: string) {
  return {
    canal_id: c.id, nombre: (c.nombre || c.handle || c.id).slice(0, 120), handle: c.handle ? c.handle.replace(/^@?/, '@').slice(0, 60) : null,
    foto: c.foto && /^https:\/\//.test(c.foto) ? c.foto : null, nicho, idioma, fuente, estado: 'activo', leido_en: ahora, updated_at: ahora,
  };
}

/** Las filas de los videos de un canal: sólo los largos (un Short no es una miniatura que se diseñe) y con id válido. */
export function filasDeVideos(videos: readonly VideoYoutube[], canalFila: number, ahora: string) {
  return videos
    .filter((v) => esIdDeVideo(v.id) && !esCorto(v.duracion))
    .map((v) => ({
      video_id: v.id, canal_id: canalFila, titulo: v.titulo ? v.titulo.slice(0, 300) : null,
      publicado_en: Number.isFinite(Date.parse(v.publicadoEn)) ? new Date(v.publicadoEn).toISOString() : null,
      duracion: v.duracion, vistas: v.vistas, megusta: v.megusta, comentarios: v.comentarios, leido_en: ahora,
    }));
}
