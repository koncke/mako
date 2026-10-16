// =============================================================================
// editor-landing/publicar — la foto que sirve /l/<slug>, y las dos lecturas sin sesión
// =============================================================================
// Publicar es FOTOGRAFIAR: se renderiza cada página con la ÚNICA fábrica de HTML público
// (`htmlDePagina`, lib/editor-landing/render.ts) y el tema (lib/editor-landing/temas.ts), y se
// guarda el resultado en `landing_docs.publicado` junto con la hoja, las fuentes y la configuración
// del sitio. La página pública sirve esa foto y nunca el borrador. Diseño:
// docs/diseno-editor-landing.md (D3, D4).
//
// Tres reglas que este archivo no negocia:
//   · SE PUBLICA LO GUARDADO, NO LO QUE MANDA LA PANTALLA. `publicar` lee LA FILA y exige que su
//     versión sea la que la pantalla dice tener: si no, conflicto. La pantalla manda lo pendiente
//     primero (cancela el respiro del autoguardado) y recién después publica (AGENTS.md, «Un BORRADOR
//     no es un DEFAULT, y publicar promueve lo GUARDADO»). El update vuelve a exigir la versión: un
//     guardado que se cuele entre la lectura y la escritura no queda publicado a medias.
//   · LAS LECTURAS PÚBLICAS NO USAN `getTenantDb`: la página pública no tiene cookie, y sin cookie
//     el workspace cae al ws1 (Mauricio, un cliente). Leen con el cliente crudo por una clave GLOBAL
//     única (el slug, el token) y fijan el workspace de la FILA para todo lo demás.
//   · LEEN ESTRICTO: un error de base TIRA. «No existe» (404) y «no pude leer» (5xx) son dos
//     respuestas, y un 404 por un parpadeo de la base le diría a Google que la página murió.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from '../workspace';
import { getSupabaseServer } from '../supabase';
import { getUsuarioActual } from '../auth';
import { urlPublicaLanding, urlVistaLanding } from '../app-url';
import { slugValido, rutaValida } from './doc';
import { htmlDePagina } from './render';
import { temaPorId, urlFuentes } from './temas';
import { CSS_CONTENIDO } from './css';
import { TEXTO_PIDE_CONTRASENA, fuentesHtmlLibre, pideContrasena } from './html-libre';
import { productosDePago } from './pago-landing';
import {
  falla, leerFilaDoc, crearVersion, slugsOcupados, temasPropiosDe, limpiarContenido, limpiarConfig,
  type FallaHttp, type FilaDoc, type Resultado,
} from './server';
import {
  MOTIVO, idValido, leerFoto, metaDePagina, motivoSlugInvalido, paginasParaPublicar, slugPedido,
  vistaTokenValido, type FotoPublicada, type PaginaPublicada,
} from './server-reglas';
import type { ConfigLanding, TemaPropio } from './api-tipos';
import { sanearEstilo, type IdEstilo } from './animaciones';

export type { FotoPublicada, PaginaPublicada } from './server-reglas';

/**
 * Lo que reciben las rutas públicas para armar el documento de UNA página: es lo que lee
 * `LecturaPublica` (lib/editor-landing/pagina-publica.ts). La foto viene con cuatro atajos de su
 * configuración congelada (`sitio`, `temaId`, `animaciones`, `estiloAnimacion`) además de la configuración
 * entera. `leerFoto` no sanea la config: una foto de antes del catálogo de animaciones no trae el estilo, y
 * `sanearEstilo` la lee con el de siempre.
 */
export type SitioPublico = {
  workspaceId: number;
  docId: number;
  /** El título de la landing (último respaldo del `<title>`). */
  titulo: string;
  foto: FotoPublicada & { sitio: ConfigLanding['sitio']; temaId: string; animaciones: boolean; estiloAnimacion: IdEstilo };
  /** La página pedida, ya elegida por su ruta (`titulo`/`descripcion` = su `<title>` y su SEO). */
  pagina: PaginaPublicada;
};

/** La página `ruta` de una foto, como la consumen las rutas públicas. null si no es de ese sitio. */
function sitioDe(ws: number, docId: number, titulo: string, foto: FotoPublicada, ruta: string): SitioPublico | null {
  const pagina = foto.paginas.find((p) => p.ruta === ruta);
  if (!pagina) return null;
  return {
    workspaceId: ws, docId, titulo, pagina,
    foto: {
      ...foto, sitio: foto.config.sitio, temaId: foto.config.tema, animaciones: foto.config.pagina.animaciones,
      estiloAnimacion: sanearEstilo(foto.config.pagina?.estiloAnimacion),
    },
  };
}

/**
 * Tope de la foto: el HTML de todas las páginas, la hoja y la configuración. Por debajo del CHECK de la base
 * (12 MB) a propósito, para que la pantalla diga «demasiado grande» antes que Postgres.
 */
const TOPE_FOTO_BYTES = 10_000_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Arma la foto de una fila: saneo, tema (con los temas propios del workspace), render de cada
 * página publicable y la configuración del sitio congelada. La usan publicar (con fecha) y la vista
 * previa del borrador (sin fecha, al vuelo).
 *
 * `urlBase` es la dirección de inicio del sitio publicado: con ella el render resuelve los enlaces
 * entre páginas (`pagina:<id>` → `<urlBase>/<ruta>`). Tiene que ser ABSOLUTA: el script de la
 * página (pagina-publica.ts) sólo redirige a http(s). La vista previa pasa la del link privado
 * (`/l/vista/<token>`): sus otras páginas se sirven en app/l/vista/[token]/[ruta], y así el menú
 * del sitio y los botones entre páginas de un borrador no llevan a lo publicado.
 *
 * ⚠️ Tanda 4: las dos salen de lib/app-url.ts (`urlPublicaLanding`, `urlVistaLanding`), y en
 * producción son de hola-mako.site (`https://hola-mako.site/<slug>`, `…/vista/<token>`). La foto
 * guarda esos enlaces ABSOLUTOS: lo publicado antes de la mudanza los trae a hola-mako.com/l/…, que
 * redirige (308) y que la ruta del dominio propio también reescribe (`basesLandings`).
 *
 * `vista` (T6, tanda 2) es el token del link privado en la vista previa y null al publicar: con él
 * el render dibuja cada bloque «Formato libre (HTML)» como un iframe a SU URL (/l/html/<docId>/<bloque>,
 * con `?vista=` en el borrador), servida con la política sandbox que deja correr su JavaScript. La
 * foto publicada guarda además el HTML de esos bloques (`htmlLibre`), que es de donde los sirve esa
 * ruta: así se sirve lo PUBLICADO aunque el borrador cambie.
 *
 * Tanda 4: sólo la foto PUBLICADA (con fecha) lleva los botones de pago al paso de nombre y email
 * (`pagos: true` del render), y guarda en `pagos` los productos que esos botones cobran
 * (`productosDePago`): el POST de app/api/landing-generator/pagar no crea un cobro de nada que no
 * esté ahí. La vista previa deja el botón en `#` (el link privado no cobra).
 */
function armarFoto(f: Pick<FilaDoc, 'id' | 'titulo' | 'contenido' | 'config' | 'version'>, propios: TemaPropio[], publicadoAt: string | null, urlBase: string | null, vista: string | null): FotoPublicada {
  const donde = `${publicadoAt ? 'publicar' : 'vista previa'} #${f.id}`;
  const contenido = limpiarContenido(f.contenido, donde).contenido;
  const config = limpiarConfig(f.config, donde).config;
  const tema = temaPorId(config.tema, propios);
  const publicables = paginasParaPublicar(contenido);
  const rutas = publicables.map((p) => ({ id: p.id, ruta: p.ruta }));
  const paginas = publicables.map((p) => {
    const meta = metaDePagina(p, config.sitio, f.titulo);
    const html = htmlDePagina(p, config, tema, { modo: 'publico', paginas: rutas, ...(urlBase ? { urlBase } : {}), htmlLibre: { docId: f.id, vista }, pagos: publicadoAt !== null });
    return { ruta: p.ruta, titulo: meta.titulo, descripcion: meta.descripcion, html };
  });
  return {
    v: 1, paginas, css: CSS_CONTENIDO, fuentes: urlFuentes([tema]), config, version: f.version, publicadoAt, htmlLibre: fuentesHtmlLibre(publicables),
    ...(publicadoAt !== null ? { pagos: productosDePago(publicables) } : {}),
  };
}

async function wsOFalla(): Promise<number | FallaHttp> {
  const ws = await getWorkspaceActual();
  return ws ?? falla('No hay un negocio abierto', 403);
}

// ─────────────────────────────────────────────────────────────────────────────
// Publicar, despublicar, sitio activo (con sesión: los llama /api/landing-generator)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Publica la versión GUARDADA `version` de la landing en `/l/<slug>`.
 *
 * Devuelve la URL pública. Deja una versión «Publicada» en el historial y marca el paso opcional
 * `lg_publicar` del onboarding (las dos cosas son accesorias: si fallan, lo publicado ya está).
 */
export async function publicar(idRaw: unknown, versionRaw: unknown, slugRaw: unknown): Promise<Resultado<'publicar'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  const version = typeof versionRaw === 'number' && Number.isSafeInteger(versionRaw) && versionRaw >= 1 ? versionRaw : null;
  if (!id || !version) return falla('Falta la landing o su versión');
  const slug = slugPedido(slugRaw);
  const invalido = motivoSlugInvalido(slug);
  if (invalido) return falla(invalido);

  try {
    const f = await leerFilaDoc(ws, id);
    if (!f) return falla('No existe', 404);
    if (f.papelera_at) return falla('Está en la papelera', 409);
    // LA FILA, no el body: si lo guardado no es lo que la pantalla cree, no se publica nada.
    if (f.version !== version) return { ok: false, error: 'Hay una versión más nueva', conflicto: true, versionActual: f.version, status: 409 };
    if ((await slugsOcupados([slug], id)).has(slug)) return falla('Esa dirección ya está tomada', 409);

    const propios = await temasPropiosDe(ws);
    const publicadoAt = new Date().toISOString();
    const foto = armarFoto(f, propios, publicadoAt, urlPublicaLanding(slug), null);
    if (!foto.paginas.length) return falla('No hay nada para publicar');
    // Un bloque HTML que pide una contraseña no se publica en hola-mako.com (revisión de la tanda 2:
    // html-libre.ts, `pideContrasena`). La ruta tampoco lo sirve; acá se dice antes de publicar.
    if (Object.values(foto.htmlLibre ?? {}).some(pideContrasena)) return falla(`Un bloque «HTML personalizado» pide una contraseña. ${TEXTO_PIDE_CONTRASENA}`, 422);
    if (Buffer.byteLength(JSON.stringify(foto), 'utf8') > TOPE_FOTO_BYTES) return falla('Demasiado grande para publicar', 413);

    const db = await getTenantDb();
    const { data, error } = await db.from('landing_docs')
      .update({ publicado: foto, publicado_at: publicadoAt, publicado_version: version, slug, sitio_activo: true })
      .eq('workspace_id', ws).eq('id', id).eq('version', version).select('id');
    if (error) {
      // 23505 = el índice único del slug: otro negocio lo reclamó entre el chequeo y la escritura.
      // Primer reclamante gana, y se dice con las mismas palabras que el chequeo.
      if ((error as { code?: string }).code === '23505') return falla('Esa dirección ya está tomada', 409);
      return falla(error.message, 500);
    }
    if (!(data ?? []).length) {
      const actual = await leerFilaDoc(ws, id, 'id, version');
      return { ok: false, error: 'Hay una versión más nueva', conflicto: true, versionActual: actual?.version, status: 409 };
    }

    try {
      const yo = await getUsuarioActual();
      await crearVersion(ws, f, MOTIVO.publicada, (yo?.nombre || yo?.email || '').trim() || null);
    } catch (e) {
      console.warn(`[editor-landing] publicar #${id}: no pude dejar la versión «Publicada»: ${msg(e)}`);
    }
    try {
      const { marcarPasoTab } = await import('../tab-onboarding-state');
      await marcarPasoTab('landing-writer', 'lg_publicar');
    } catch { /* accesorio a la publicación (el paso es opcional y lo declara el catálogo de la tab) */ }

    const url = urlPublicaLanding(slug);
    console.log(`[editor-landing] publicada #${id} v${version} en ${url} (${foto.paginas.length} página(s))`);
    return { ok: true, url, slug, publicadoAt, version };
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/**
 * Saca la landing de internet: borra la foto. El slug QUEDA reservado para esta landing (al
 * republicar vuelve a la misma dirección) y el borrador no se toca.
 */
export async function despublicar(idRaw: unknown): Promise<Resultado<'despublicar'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('landing_docs')
      .update({ publicado: null, publicado_at: null, publicado_version: null })
      .eq('workspace_id', ws).eq('id', id).select('id');
    if (error) return falla(error.message, 500);
    return (data ?? []).length ? { ok: true } : falla('No existe', 404);
  } catch (e) {
    return falla(msg(e), 500);
  }
}

/**
 * El interruptor «Sitio activo»: pausa (o reanuda) lo publicado sin perder la foto. Con el sitio
 * pausado, /l/<slug> contesta como si no existiera.
 */
export async function sitioActivo(idRaw: unknown, valor: unknown): Promise<Resultado<'sitioActivo'>> {
  const ws = await wsOFalla();
  if (typeof ws !== 'number') return ws;
  const id = idValido(idRaw);
  if (!id) return falla('Falta la landing');
  const activo = valor === true;
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('landing_docs').update({ sitio_activo: activo })
      .eq('workspace_id', ws).eq('id', id).select('id');
    if (error) return falla(error.message, 500);
    return (data ?? []).length ? { ok: true, sitioActivo: activo } : falla('No existe', 404);
  } catch (e) {
    return falla(msg(e), 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Las lecturas SIN sesión (las usan app/l/[slug], app/l/[slug]/[ruta] y app/l/vista/[token])
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La página publicada de `/l/<slug>/<ruta>` (`ruta` '' = la de inicio), o null si no se sirve: no
 * existe, nunca se publicó, se despublicó, el sitio está pausado, está en la papelera o la ruta no
 * es de ese sitio. Un ERROR de base TIRA (la ruta pública contesta 5xx, no 404).
 */
export async function leerPublicado(slug: string, ruta = ''): Promise<SitioPublico | null> {
  if (!slugValido(slug) || !rutaValida(ruta)) return null;
  const { data, error } = await getSupabaseServer().from('landing_docs')
    .select('id, workspace_id, titulo, publicado, sitio_activo, papelera_at')
    .eq('slug', slug).maybeSingle();
  if (error) throw new Error(`No pude leer la landing ${slug}: ${error.message}`);
  const f = data as { id: number; workspace_id: number; titulo: string; publicado: unknown; sitio_activo: boolean; papelera_at: string | null } | null;
  if (!f || !f.publicado || !f.sitio_activo || f.papelera_at) return null;
  const foto = leerFoto(f.publicado);
  if (!foto) {
    console.error(`[editor-landing] la foto publicada de /l/${slug} (#${f.id}) no tiene la forma: no se sirve`);
    return null;
  }
  // La configuración congelada se vuelve a sanear al servirla: de ahí salen el favicon, la imagen
  // para compartir y el Píxel de Meta que van al <head> de una página pública.
  return sitioDe(Number(f.workspace_id), Number(f.id), f.titulo, { ...foto, config: limpiarConfig(foto.config, `servir /l/${slug}`).config }, ruta);
}

/**
 * El BORRADOR por su link privado (`/l/vista/<token>[/<ruta>]`), renderizado al vuelo con lo guardado. null
 * si el token no es de ninguna landing (o la landing está en la papelera). Un error de base TIRA.
 *
 * Los temas propios se leen con el workspace de la FILA (`temasPropiosDe(ws)`), nunca con el de la
 * cookie: quien abre el link puede no tener sesión, o tener la de otro negocio.
 */
export async function leerVistaPrevia(token: string, ruta = ''): Promise<SitioPublico | null> {
  if (!vistaTokenValido(token) || !rutaValida(ruta)) return null;
  const { data, error } = await getSupabaseServer().from('landing_docs')
    .select('id, workspace_id, titulo, contenido, config, version, papelera_at')
    .eq('vista_token', token).maybeSingle();
  if (error) throw new Error(`No pude leer la vista previa: ${error.message}`);
  const f = data as (Pick<FilaDoc, 'id' | 'workspace_id' | 'titulo' | 'contenido' | 'config' | 'version' | 'papelera_at'>) | null;
  if (!f || f.papelera_at) return null;
  const ws = Number(f.workspace_id);
  return sitioDe(ws, Number(f.id), f.titulo, armarFoto(f, await temasPropiosDe(ws), null, urlVistaLanding(token), token), ruta);
}
