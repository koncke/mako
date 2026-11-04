import 'server-only';

// =============================================================================
// Guardar y leer las páginas de un competidor capturadas con la extensión (4/11/2026)
// =============================================================================
// Lo puro (qué se acepta, si es la página, sus otras páginas) vive en lib/spy-pagina-capturada.ts. Acá: que la página sea SUYA,
// la foto en nuestro Storage y el registro por negocio (`spy.paginas.<competidor>`). Corre adentro del negocio de quien captura
// (la ruta de la extensión pone `runWithWorkspace` con el negocio de su token).

import { createHash } from 'node:crypto';
import { getSettingEstricto, setSetting } from './settings';
import { getTenantDb, wsObligatorio } from './workspace';
import { ofertaGuardada } from './spy-oferta-servidor';
import { webComparable } from './spy-oferta';
import { subirFotoDePagina, tipoDeImagen } from './spy-miniaturas';
import {
  claveDePaginasCapturadas, conPaginaCapturada, juzgarCaptura, leerPaginasCapturadas, paginasDeLaCaptura, TEXTO_GUARDADO,
  type CapturaDePagina, type PaginaCapturada,
} from './spy-pagina-capturada';

/** La foto pesa lo que una pantalla en JPEG: con 2 MiB sobra (y es el tope del bucket). */
const PESO_FOTO = 2 * 1024 * 1024;

/** Las capturadas de un competidor del negocio actual. */
export async function paginasCapturadas(competidorId: number): Promise<Record<string, PaginaCapturada>> {
  return leerPaginasCapturadas(await getSettingEstricto(claveDePaginasCapturadas(competidorId)));
}

/**
 * Sus páginas: su web y las que enlaza según su oferta, y las que salieron de una página de enlaces capturada. La ruta de la
 * vista previa y la captura sólo aceptan éstas: no son un lector de cualquier dirección. `null` si el competidor no es del negocio.
 */
export async function paginasSuyas(competidorId: number): Promise<string[] | null> {
  const v = await ofertaGuardada(competidorId);
  if (!v) return null;
  const capturadas = Object.values(await paginasCapturadas(competidorId));
  const todas = [
    ...('enlaces' in v ? [...v.urls, ...v.enlaces] : []),
    ...capturadas.flatMap((p) => [p.url, ...p.paginas]),
  ];
  const vistas = new Set<string>();
  return todas.filter((u) => { const k = webComparable(u); if (vistas.has(k)) return false; vistas.add(k); return true; });
}

/** La foto que mandó la extensión (un `data:` de JPEG o PNG), en bytes. `null` si no es una imagen de verdad o pesa de más. */
export function fotoDeDataUrl(crudo: unknown): { bytes: Uint8Array; mime: string; ext: string } | null {
  if (typeof crudo !== 'string') return null;
  const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(crudo);
  if (!m) return null;
  const bytes = new Uint8Array(Buffer.from(m[1], 'base64'));
  if (!bytes.length || bytes.length > PESO_FOTO) return null;
  const tipo = tipoDeImagen(bytes);
  return tipo ? { bytes, ...tipo } : null;
}

export type ResultadoCaptura =
  | { ok: true; titulo: string; paginas: number }
  | { ok: false; motivo: 'no-es-suya' | 'desafio' | 'error' | 'vacia' | 'falla'; error: string };

/** Lo que dice la extensión en su desplegable, por motivo. Corto y con lo que hay que hacer. */
const QUE_DECIR: Record<Exclude<ResultadoCaptura, { ok: true }>['motivo'], string> = {
  'no-es-suya': 'Esta página no es de ese competidor.',
  desafio: 'Pasa la verificación de la página y vuelve a tocar el ícono de MaKo.',
  error: 'La página mostró un error. Recárgala y vuelve a tocar el ícono de MaKo.',
  vacia: 'La página no cargó. Recárgala y vuelve a tocar el ícono de MaKo.',
  falla: 'No pude guardarla. Vuelve a tocar el ícono de MaKo.',
};
const no = (motivo: keyof typeof QUE_DECIR): ResultadoCaptura => ({ ok: false, motivo, error: QUE_DECIR[motivo] });

/**
 * Guarda una página capturada: que sea suya, que sea la página (no el desafío, ni su error, ni nada), la foto en el Storage y el
 * registro. Lo que no es la página no se guarda: la pantalla sigue ofreciendo «Capturar».
 */
export async function guardarPaginaCapturada(competidorId: number, url: string, c: CapturaDePagina, fotoCruda: unknown): Promise<ResultadoCaptura> {
  const suyas = await paginasSuyas(competidorId);
  if (!suyas || !suyas.some((u) => webComparable(u) === webComparable(url))) return no('no-es-suya');
  const foto = fotoDeDataUrl(fotoCruda);
  const juicio = juzgarCaptura(c, !!foto);
  if (juicio !== 'ok') return no(juicio);

  const ws = await wsObligatorio();
  let fotoUrl: string | null = null;
  if (foto) {
    const hash = createHash('sha256').update(webComparable(url)).digest('hex').slice(0, 24);
    fotoUrl = await subirFotoDePagina(`spy/pagina/${ws}/${competidorId}/${hash}.${foto.ext}`, foto.bytes, foto.mime);
    if (!fotoUrl) return no('falla');
  }

  const paginas = paginasDeLaCaptura(url, c);
  const nueva: PaginaCapturada = {
    url, final: c.final, titulo: c.titulo.trim(), foto: fotoUrl, paginas,
    texto: c.texto.replace(/\s+/g, ' ').trim().slice(0, TEXTO_GUARDADO), capturadaEn: new Date().toISOString(),
  };
  await setSetting(claveDePaginasCapturadas(competidorId), JSON.stringify(conPaginaCapturada(await paginasCapturadas(competidorId), nueva)));
  return { ok: true, titulo: nueva.titulo, paginas: paginas.length };
}

/** El competidor es del negocio actual (antes de leer sus capturadas para la pantalla). */
export async function esCompetidorDelNegocio(competidorId: number): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from('spy_competidores').select('id').eq('id', competidorId).maybeSingle();
  if (error) throw new Error(`No pude leer al competidor: ${error.message}`);
  return !!data;
}
