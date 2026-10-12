// =============================================================================
// editor-landing/server-reglas — las decisiones PURAS del server del editor
// =============================================================================
// Lo que deciden server.ts, publicar.ts y las dos rutas de /api/landing-generator sin tocar la base:
// el slug y su sugerencia, cuándo toca una versión automática, si una landing se puede borrar, qué
// URLs se miden en la analítica, cómo se arma la ruta de una subida y qué es un archivo por sus
// magic bytes. Vive aparte y SIN `server-only` por la regla de la casa: una condición adentro del
// módulo que hace el trabajo sucio no la puede importar ningún test, y termina siendo lo único sin
// red justo donde más duele (AGENTS.md, «Un guard sobre algo destructivo se escribe en POSITIVO»).
// Diseño: docs/diseno-editor-landing.md (D2, D4, D6, D8).
// =============================================================================

import { normalizarUrl } from '../landing-url';
import { hoyEnTz, diasAntes } from '../date-utils';
import { slugDe, slugValido, urlPublica, rutaValida, SLUGS_RESERVADOS, PREFIJO_PUBLICO, TOPES, type LandingContenido, type Pagina } from './doc';
import {
  CONFIG_DEFAULT, TIPOS_IMAGEN, TIPOS_VIDEO, TOPE_IMAGEN_BYTES, TOPE_VIDEO_BYTES,
  type ConfigLanding, type TemaPropio,
} from './api-tipos';
import { sanearTemaPropio } from './temas';

// ─────────────────────────────────────────────────────────────────────────────
// Versiones automáticas
// ─────────────────────────────────────────────────────────────────────────────

/** Cada cuánto, como mínimo, el guardado deja una instantánea sola (D8). */
export const MINUTOS_VERSION_AUTO = 10;

/** Cuántas instantáneas AUTOMÁTICAS se conservan por landing. Las publicadas y las manuales, todas. */
export const TOPE_VERSIONES_AUTO = 50;

export const MOTIVO = {
  auto: 'Guardado automático',
  publicada: 'Publicada',
  antesDeRestaurar: 'Antes de restaurar',
  manual: 'Guardada a mano',
} as const;

/**
 * ¿Este guardado deja una versión automática? Sí si nunca hubo una, o si la ÚLTIMA (de cualquier
 * motivo: una publicada también cuenta) tiene más de 10 minutos.
 *
 * ⚠️ Una fecha que no se puede leer cuenta como «no hay»: es preferible una instantánea de más que
 * pasar horas de edición sin ninguna porque una fila trajo basura en `created_at`.
 */
export function tocaVersionAutomatica(ultima: string | null | undefined, ahora: number): boolean {
  if (!ultima) return true;
  const t = Date.parse(ultima);
  if (!Number.isFinite(t)) return true;
  return ahora - t >= MINUTOS_VERSION_AUTO * 60_000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ¿Se puede borrar DEFINITIVAMENTE? Sólo si está en la papelera.
 *
 * ⚠️ EN POSITIVO: «tiene fecha de papelera», nunca «no está activa». El server además lo exige en
 * el propio `delete` (`.not('papelera_at', 'is', null)`), así que una fila que salió de la papelera
 * entre la lectura y el borrado tampoco se va.
 */
export function puedeBorrarse(fila: { papelera_at: string | null | undefined }): boolean {
  return typeof fila.papelera_at === 'string' && fila.papelera_at.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los segmentos que ya son RUTAS de /l y por eso no pueden ser el slug de una landing.
 *
 * ⚠️ `vista` FALTA EN `SLUGS_RESERVADOS` (lib/editor-landing/doc.ts, un contrato que este paquete
 * no toca: pedido en el informe). Una landing con slug `vista` tendría su inicio en /l/vista (que
 * resuelve app/l/[slug]) y sus páginas internas TAPADAS por app/l/vista/[token]: /l/vista/gracias se
 * leería como el token «gracias» y daría 404. Mientras doc.ts no lo reserve, se frena acá, que es
 * por donde pasa todo slug que se publica.
 */
const RUTAS_DE_L = new Set(['vista']);

/** ¿Se puede publicar en esta dirección? La forma de `slugValido` y fuera de las rutas de /l. */
export function slugPublicable(s: string): boolean {
  return slugValido(s) && !RUTAS_DE_L.has(s);
}

/** El link privado al borrador: `<base>/l/vista/<token>` (la ruta de app/l/vista/[token]). */
export function urlVistaPrevia(base: string, token: string): string {
  return `${base.replace(/\/$/, '')}${PREFIJO_PUBLICO}/vista/${token}`;
}

/** Lo que mandó la pantalla, como se compara: sin espacios ni mayúsculas. */
export function slugPedido(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * Los candidatos para SUGERIR una dirección a partir de un texto (lo que se escribió o el título):
 * el texto pasado por `slugDe` y, si está tomado, con sufijo `-2` … `-9`. Sólo los que pasan
 * `slugValido` (la forma de `SLUG_RE` y fuera de los reservados).
 *
 * Se recorta la base a 57 caracteres ANTES de sumar el sufijo: un sufijo que empuja el slug por
 * encima de 60 lo invalida y la lista quedaría vacía justo para los títulos largos.
 */
export function candidatosSlug(texto: string): string[] {
  const base = slugDe(texto).slice(0, 57).replace(/-+$/g, '') || 'landing';
  const out: string[] = [];
  for (const c of [base, ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`)]) {
    if (slugPublicable(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * Por qué una dirección NO se puede usar, en el texto corto que ve la persona, o null si tiene la
 * forma. No pregunta si está tomada: eso lo contesta la base.
 */
export function motivoSlugInvalido(slug: string): string | null {
  if (slugPublicable(slug)) return null;
  if (slug.length < 3) return 'Muy corta';
  if (slug.length > 60) return 'Muy larga';
  if (/[^a-z0-9-]/.test(slug)) return 'Solo minúsculas, números y guiones';
  if (SLUGS_RESERVADOS.has(slug) || RUTAS_DE_L.has(slug)) return 'Reservada';
  return 'Sin guion al principio ni al final';
}

/** El primer candidato que nadie tiene, o null. */
export function primeraLibre(candidatos: readonly string[], ocupados: ReadonlySet<string>): string | null {
  return candidatos.find((c) => !ocupados.has(c)) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Publicado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * «Tienes cambios que publicar»: hay una publicación y lo guardado ya no es esa versión.
 *
 * Se compara la VERSIÓN y no `updated_at > publicado_at` (lo que decía el diseño), porque marcar
 * como favorita, mover de carpeta o mandar a la papelera tocan la fila sin cambiar lo publicable, y
 * con la fecha esos tres encenderían el aviso sobre una landing idéntica a la publicada.
 */
export function cambiosSinPublicar(f: { publicado_at: string | null; publicado_version: number | null; version: number }): boolean {
  return !!f.publicado_at && f.publicado_version !== f.version;
}

// ─────────────────────────────────────────────────────────────────────────────
// La FOTO publicada (landing_docs.publicado)
// ─────────────────────────────────────────────────────────────────────────────

/** Una página ya renderizada: lo que sirve /l/<slug>/<ruta> adentro de su documento HTML. */
export type PaginaPublicada = { ruta: string; titulo: string; descripcion: string; html: string };

/**
 * Lo que se congela al publicar. La página pública (lib/editor-landing/pagina-publica.ts) arma el
 * documento entero con esto y NO vuelve a mirar `contenido` ni la `config` viva: si el dueño cambia
 * el favicon o el Píxel de Meta sin publicar, lo publicado sigue con lo de antes (AGENTS.md,
 * «publicar promueve lo GUARDADO»). `config` es la configuración ENTERA de ese momento.
 *
 * `css` va congelada con el HTML por la misma razón: el HTML de la foto lo fabricó el render de ese
 * día, y una hoja de mañana contra un HTML de ayer puede no calzar. pagina-publica.ts la usa si
 * está, y si viene vacía cae a la `CSS_CONTENIDO` de hoy.
 * `publicadoAt` es null en la vista previa del borrador (se arma al vuelo, no se publicó nada).
 */
export type FotoPublicada = {
  v: 1;
  paginas: PaginaPublicada[];
  css: string;
  fuentes: string;
  config: ConfigLanding;
  version: number;
  publicadoAt: string | null;
  /**
   * T6: el HTML de cada bloque «Formato libre (HTML)» publicado, por su id (`fuentesHtmlLibre`). De
   * acá lo sirve /l/html/<docId>/<bloque> (`htmlLibreDeFoto`): la versión PUBLICADA, nunca el borrador.
   * Opcional: una foto anterior a la tanda 2 no lo trae (y su página dibuja el bloque con srcdoc).
   */
  htmlLibre?: Record<string, string>;
};

/**
 * Las páginas que se publican, en orden: sin las secciones OCULTAS («no se presenta ni se publica»,
 * attrs.oculta), sin rutas repetidas ni inválidas (gana la primera), y con UNA página de inicio
 * (ruta ''): si ninguna la tiene, la primera pasa a serlo — un sitio sin inicio sería un 404 en la
 * dirección que se comparte.
 *
 * El render (lib/editor-landing/render.ts) también saltea lo oculto; acá se saca ANTES para que una
 * sección oculta no llegue ni a la foto aunque el render cambie.
 */
export function paginasParaPublicar(c: LandingContenido): Pagina[] {
  const out: Pagina[] = [];
  const vistas = new Set<string>();
  for (const p of c.paginas ?? []) {
    if (!p || typeof p.ruta !== 'string' || !rutaValida(p.ruta) || vistas.has(p.ruta)) continue;
    vistas.add(p.ruta);
    const content = (p.doc?.content ?? []).filter((t) => !(t?.attrs && (t.attrs as { oculta?: unknown }).oculta === true));
    out.push({ ...p, doc: { type: 'doc', content } });
  }
  if (out.length && !out.some((p) => p.ruta === '')) out[0] = { ...out[0], ruta: '' };
  return out;
}

/**
 * El título y la descripción de una página publicada (para el `<title>`, el SEO y la vista previa al
 * compartir). La página manda; si no tiene, la de inicio cae a lo del sitio y después al título de
 * la landing, y una página interna a su propio nombre.
 */
export function metaDePagina(p: Pagina, sitio: ConfigLanding['sitio'], tituloDoc: string): { titulo: string; descripcion: string } {
  const propio = (p.seoTitulo ?? '').trim();
  const titulo = propio || (p.ruta === '' ? (sitio.seoTitulo || '').trim() || tituloDoc : `${(p.titulo || '').trim() || tituloDoc}`);
  const descripcion = (p.seoDescripcion ?? '').trim() || (sitio.seoDescripcion || '').trim();
  return { titulo: titulo.slice(0, 200), descripcion: descripcion.slice(0, 300) };
}

/**
 * Lee la foto guardada con la forma que tiene que tener, o null. Una foto que no se puede leer NO se
 * sirve a medias: quien llama la trata como «no publicada» y lo deja en el log.
 */
export function leerFoto(raw: unknown): FotoPublicada | null {
  if (!esObjeto(raw) || !Array.isArray(raw.paginas) || !esObjeto(raw.config)) return null;
  const paginas: PaginaPublicada[] = [];
  for (const p of raw.paginas) {
    if (!esObjeto(p) || typeof p.ruta !== 'string' || typeof p.html !== 'string') return null;
    paginas.push({ ruta: p.ruta, html: p.html, titulo: typeof p.titulo === 'string' ? p.titulo : '', descripcion: typeof p.descripcion === 'string' ? p.descripcion : '' });
  }
  if (!paginas.length) return null;
  return {
    v: 1,
    paginas,
    css: typeof raw.css === 'string' ? raw.css : '',
    fuentes: typeof raw.fuentes === 'string' ? raw.fuentes : '',
    config: raw.config as ConfigLanding,
    version: typeof raw.version === 'number' ? raw.version : 0,
    publicadoAt: typeof raw.publicadoAt === 'string' ? raw.publicadoAt : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Analítica: qué URLs se miden
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las URLs de una landing publicada, NORMALIZADAS con la misma función que usa el Landing Analyst
 * (`normalizarUrl`, lib/landing-url.ts): host sin www, sin query, sin barra final. Una por página
 * (`/l/<slug>` y `/l/<slug>/<ruta>`).
 *
 * ⚠️ LAS DOS PUNTAS SE NORMALIZAN CON LA MISMA FUNCIÓN. `landing_visits.landing_url` la escribe el
 * Pixel con sus utm y su `fbclid`; si un lado se normalizara distinto, el cruce fallaría en silencio
 * y la pantalla diría «nadie la visitó» sobre una página con tráfico (AGENTS.md, «Dos escritores con
 * dos ritmos son dos claves»).
 */
export function urlsAMedir(base: string, slug: string | null, rutas: readonly string[]): string[] {
  if (!slug || !slugValido(slug)) return [];
  const out: string[] = [];
  for (const r of rutas) {
    if (!rutaValida(r)) continue;
    let u: string;
    try { u = normalizarUrl(urlPublica(base, slug, r)); } catch { continue; }
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

/** ¿Esta visita es de una de las URLs medidas? Sin tirar: una URL rota guardada no es de nadie. */
export function esUrlMedida(landingUrl: string | null | undefined, medidas: ReadonlySet<string>): boolean {
  if (!landingUrl) return false;
  try { return medidas.has(normalizarUrl(landingUrl)); } catch { return false; }
}

/**
 * El PREFILTRO de la consulta (`ilike`): trae CANDIDATOS, y la decisión la toma `esUrlMedida` con
 * una igualdad exacta después (AGENTS.md, «Un patrón trae CANDIDATOS»). Un slug válido no tiene `%`
 * ni `_`, pero se escapan igual: el día que la forma del slug cambie, este patrón no se vuelve un
 * comodín.
 */
export function prefiltroVisitas(slug: string): string {
  return `%/l/${slug.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Las visitas por DÍA LOCAL del negocio, los últimos `dias` días hasta `hoy` inclusive, con los días
 * sin visitas en 0 (acá un cero es un dato: la página estaba publicada y se midió).
 *
 * El día sale de la zona del workspace y no de UTC: una visita a las 20:00 en Tijuana es de ese día,
 * no del siguiente.
 */
export function visitasPorDia(fechas: readonly string[], hoy: string, dias: number, tz: string): { dia: string; visitas: number }[] {
  const conteo = new Map<string, number>();
  for (const f of fechas) {
    const t = Date.parse(f);
    if (!Number.isFinite(t)) continue;
    const d = hoyEnTz(tz, new Date(t));
    conteo.set(d, (conteo.get(d) ?? 0) + 1);
  }
  const out: { dia: string; visitas: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = diasAntes(hoy, i);
    out.push({ dia: d, visitas: conteo.get(d) ?? 0 });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuración: mezclar un parcial sobre la de siempre
// ─────────────────────────────────────────────────────────────────────────────

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function mezclar(base: unknown, parcial: unknown): unknown {
  if (!esObjeto(base) || !esObjeto(parcial)) return parcial === undefined ? base : parcial;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(parcial)) {
    if (v === undefined) continue;
    out[k] = esObjeto(base[k]) && esObjeto(v) ? mezclar(base[k], v) : v;
  }
  return out;
}

/**
 * `CONFIG_DEFAULT` con lo que vino encima, en PROFUNDIDAD (`sitio.nav`, `sitio.pie`, `pagina`).
 *
 * Una mezcla superficial haría que `crear({ config: { sitio: { nombre: 'X' } } })` dejara el sitio
 * sin `nav` ni `pie` — y el saneo los volvería a poner en su default, pero callado. El resultado igual
 * pasa por `sanearConfig` antes de guardarse: esto sólo decide de dónde sale cada valor.
 */
export function mezclarConfig(parcial: unknown, base: ConfigLanding = CONFIG_DEFAULT): ConfigLanding {
  return mezclar(structuredClone(base), parcial) as ConfigLanding;
}

// ─────────────────────────────────────────────────────────────────────────────
// Textos cortos que guarda el server
// ─────────────────────────────────────────────────────────────────────────────

/** El título de una landing: una línea, ≤ TOPES.titulo. Vacío = «Sin título» (como Gamma). */
export function sanearTitulo(raw: unknown): string {
  const t = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, TOPES.titulo).trim() : '';
  return t || 'Sin título';
}

/** El motivo de una versión guardada a mano o por la IA. */
export function sanearMotivo(raw: unknown, def: string = MOTIVO.manual): string {
  const t = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 120).trim() : '';
  return t || def;
}

/**
 * ¿El comentario es de quien mira? Por el `sub` de la sesión, nunca por el nombre (dos personas
 * pueden llamarse igual, y el nombre se edita). Un comentario sin autor (`null`, sesión legacy) no
 * es de nadie: sólo lo borra el super admin.
 */
export function esComentarioPropio(autorSub: string | null | undefined, miSub: string | null | undefined): boolean {
  return !!autorSub && !!miSub && autorSub === miSub;
}

/** Borra un comentario sólo quien lo escribió, o el super admin (rol de PLATAFORMA). */
export function puedeBorrarComentario(autorSub: string | null | undefined, yo: { sub: string | null; superAdmin: boolean }): boolean {
  return yo.superAdmin || esComentarioPropio(autorSub, yo.sub);
}

/** El id de una sección (attrs.id de la tarjeta), con la forma que exige la base. */
export function tarjetaIdValido(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw);
}

/** Un id de fila: entero positivo. Lo que llegue como string de dígitos también vale. */
export function idValido(raw: unknown): number | null {
  const n = typeof raw === 'string' && /^[0-9]{1,15}$/.test(raw) ? Number(raw) : raw;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** El token del link privado: 32 bytes en base64url. */
export function vistaTokenValido(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{43}$/.test(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Temas propios del workspace (app_settings 'landing.temas')
// ─────────────────────────────────────────────────────────────────────────────

export const CLAVE_TEMAS = 'landing.temas';
export const TOPE_TEMAS = 30;

/**
 * La lista guardada, saneada con la regla de UN tema que es de temas.ts (`sanearTemaPropio`: el id,
 * la base contra el catálogo y cada cambio contra sus hojas válidas — una sola regla para el server
 * que guarda y el render que aplica). Acá se agrega lo de la LISTA: los ids repetidos se quedan con
 * el primero y la lista se topea. `null`/basura = lista vacía (no hay temas propios); el ERROR DE
 * LECTURA es otra cosa y lo distingue quien lee (`getSettingEstricto` tira).
 */
export function sanearTemasPropios(raw: unknown): TemaPropio[] {
  let lista: unknown = raw;
  if (typeof raw === 'string') { try { lista = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(lista)) return [];
  const out: TemaPropio[] = [];
  for (const t of lista) {
    const s = sanearTemaPropio(t);
    if (s && !out.some((o) => o.id === s.id)) out.push(s);
    if (out.length >= TOPE_TEMAS) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subidas al bucket landing-imagenes
// ─────────────────────────────────────────────────────────────────────────────

export const BUCKET_LANDING = 'landing-imagenes';

/** Extensión por tipo: TIPOS_IMAGEN + TIPOS_VIDEO de api-tipos, y nada más (nunca svg). */
export const EXT_DE_TIPO: Readonly<Record<string, string>> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm',
};
const TIPO_DE_EXT: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(EXT_DE_TIPO).map(([t, e]) => [e, t]));

export const esTipoImagen = (t: unknown): t is (typeof TIPOS_IMAGEN)[number] => (TIPOS_IMAGEN as readonly unknown[]).includes(t);
export const esTipoVideo = (t: unknown): t is (typeof TIPOS_VIDEO)[number] => (TIPOS_VIDEO as readonly unknown[]).includes(t);

/** El tope de bytes de un tipo: 15 MB una imagen, 100 MB un video. */
export function topeDeTipo(tipo: string): number {
  return esTipoVideo(tipo) ? TOPE_VIDEO_BYTES : TOPE_IMAGEN_BYTES;
}

/** ¿Se puede firmar esta subida? El motivo es el texto corto que ve la persona. */
export function validarSubida(tipo: unknown, tamano: unknown): { ok: true; tipo: string; ext: string } | { ok: false; error: string } {
  if (typeof tipo !== 'string' || !(esTipoImagen(tipo) || esTipoVideo(tipo))) return { ok: false, error: 'Formato no permitido' };
  if (typeof tamano !== 'number' || !Number.isFinite(tamano) || tamano <= 0) return { ok: false, error: 'El archivo está vacío' };
  if (tamano > topeDeTipo(tipo)) return { ok: false, error: esTipoVideo(tipo) ? 'Pasa de 100 MB' : 'Pasa de 15 MB' };
  return { ok: true, tipo, ext: EXT_DE_TIPO[tipo] };
}

/** Carpeta de lo SUBIDO y todavía no verificado. Lo verificado se muda a la raíz del workspace. */
export const CARPETA_SUBIDAS = 'subidas';

/**
 * La ruta donde el navegador SUBE: `<ws>/subidas/<uuid>.<ext>`.
 *
 * ⚠️ NO ES LA RUTA FINAL, y es a propósito: lo que sube el navegador no se verificó (el bucket mira
 * el `content-type` que DECLARA la subida, no los bytes). `registrar` revisa los magic bytes y recién
 * ahí lo muda a `<ws>/<uuid>.<ext>`, que es lo único que lista la biblioteca. Así un archivo
 * disfrazado o una subida a medias nunca aparece para elegir, y lo que quedó de una pestaña cerrada
 * se barre por carpeta.
 */
export function pathDeSubida(ws: number, uuid: string, ext: string): string {
  return `${ws}/${CARPETA_SUBIDAS}/${uuid.toLowerCase()}.${ext}`;
}

const RE_SUBIDA = /^([0-9]{1,12})\/subidas\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg|webp|gif|mp4|webm)$/;
const RE_ARCHIVO = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg|webp|gif|mp4|webm)$/;

/**
 * Lo que dice una ruta de SUBIDA, sólo si es de este workspace y tiene la forma exacta: el tipo que
 * declara su extensión y la ruta FINAL a la que se muda al verificarla. Cualquier otra cosa (otro
 * workspace, un `..`, una carpeta de más, una ruta final) = null: el navegador manda la ruta y no
 * puede elegir registrar el archivo de otro negocio.
 */
export function subidaDelWs(path: unknown, ws: number): { tipo: string; final: string } | null {
  if (typeof path !== 'string') return null;
  const m = RE_SUBIDA.exec(path);
  if (!m || Number(m[1]) !== ws) return null;
  const tipo = TIPO_DE_EXT[m[3]];
  return tipo ? { tipo, final: `${ws}/${m[2]}.${m[3]}` } : null;
}

/** ¿Este nombre (de un listado de `<ws>/`) es un archivo verificado de la biblioteca? Su tipo, o null. */
export function archivoDeBiblioteca(nombre: unknown): 'imagen' | 'video' | null {
  if (typeof nombre !== 'string') return null;
  const m = RE_ARCHIVO.exec(nombre);
  if (!m) return null;
  return m[2] === 'mp4' || m[2] === 'webm' ? 'video' : 'imagen';
}

// ─────────────────────────────────────────────────────────────────────────────
// Magic bytes
// ─────────────────────────────────────────────────────────────────────────────

const ascii = (b: Uint8Array, desde: number, hasta: number) => String.fromCharCode(...b.subarray(desde, hasta));

/**
 * El tipo REAL de una imagen por sus primeros bytes. `file.type` y el `content-type` de un tercero
 * los pone el que manda, así que no deciden nada. Sólo formatos raster inertes: nunca SVG.
 */
export function sniffImagen(buf: Uint8Array): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Imagen o video por sus primeros bytes. MP4: la caja `ftyp` en el byte 4. WEBM: la firma EBML
 * (1A 45 DF A3). Un MOV también lleva `ftyp` (marca `qt  `): se rechaza, porque el bucket no lo
 * acepta y el navegador de un visitante no siempre lo reproduce.
 */
export function sniffMedia(buf: Uint8Array): string | null {
  const img = sniffImagen(buf);
  if (img) return img;
  if (buf.length >= 12 && ascii(buf, 4, 8) === 'ftyp' && ascii(buf, 8, 12) !== 'qt  ') return 'video/mp4';
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  return null;
}
