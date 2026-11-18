// =============================================================================
// Media Buyer — SUBIR CREATIVOS NUEVOS a un conjunto, por la Zernio del negocio: la parte PURA
// =============================================================================
// Martín, 25/10/2026: «subir creativos nuevos (lo que hoy Meta rechaza con el error 1885183 desde la app del cliente) y
// publicar». Con el token de la app propia del cliente, un creativo nuevo nace como post de ESA app y Meta lo rechaza
// (docs/hallazgos-ads.md, «Publicar por Zernio»). Zernio lo crea con SU app: `POST /v1/ads/create` en la forma «attach»
// (`adSetId`), que hereda presupuesto, público y calendario del conjunto. Contrato leído en el OpenAPI v1.353.0:
//   · imagen: `imageUrl` (Zernio la baja); video: `video: { url }` (Zernio lo sube a la cuenta y espera a Meta);
//   · en Meta, `body`, `headline`, `callToAction` y `linkUrl` son obligatorios; con un formulario instantáneo va
//     `leadGenFormId` y el link sobra;
//   · `status: 'PAUSED'` en la forma attach pausa SÓLO el anuncio nuevo.
//
// Sin `server-only`: lo prueban los tests.
// =============================================================================

import type { ConexionAnunciosZernio } from '@/lib/zernio-ads-cuerpo';
import { leerRefCreativo } from '@/lib/creativo-mako';

export const CTAS = ['LEARN_MORE', 'SIGN_UP', 'APPLY_NOW', 'BOOK_NOW', 'CONTACT_US', 'GET_QUOTE', 'SHOP_NOW', 'SUBSCRIBE', 'DOWNLOAD'] as const;
export type Cta = (typeof CTAS)[number];

export const NOMBRE_CTA: Record<Cta, string> = {
  LEARN_MORE: 'Más información', SIGN_UP: 'Registrarte', APPLY_NOW: 'Solicitar ahora', BOOK_NOW: 'Reservar',
  CONTACT_US: 'Contactarnos', GET_QUOTE: 'Pedir cotización', SHOP_NOW: 'Comprar', SUBSCRIBE: 'Suscribirte', DOWNLOAD: 'Descargar',
};

/** Lo que la persona escribe (o lo que se toma del mejor anuncio del conjunto). */
export type TextosCreativo = {
  textoPrincipal: string;
  titulo: string;
  cta: Cta;
  /** El destino: una URL https, o null si el conjunto usa un formulario instantáneo. */
  link: string | null;
  formularioId: string | null;
};

/**
 * Un archivo de la subida: uno del disco, que el navegador subió al staging (`path`), o un video que MaKo YA GENERÓ (`ref`, la
 * referencia de lib/creativo-mako.ts: `montaje:<id>` o `toma:<plan>:<n>:<op>`; lo prometido a Thiago, «que "Subir creativos"
 * deje elegir un video ya generado»). Con `ref`, el `path` va vacío y el servidor vuelve a buscar el archivo en el negocio
 * (resolverCreativoMako): la url nunca viaja desde el navegador.
 */
export type ArchivoSubido = { path: string; tipo: 'image' | 'video'; nombre: string; ref?: string };

/** Un conjunto al que se puede subir: lo lista la pantalla, los prendidos primero. */
export type ConjuntoParaSubir = { id: string; nombre: string; campana: string | null; prendido: boolean; anuncios: number };

const MAX_TEXTO = 2200;

/** Lo que no se puede publicar, en una frase para la persona; null si está bien. */
export function errorDeTextos(t: TextosCreativo): string | null {
  if (!t.textoPrincipal.trim()) return 'Falta el texto principal.';
  if (t.textoPrincipal.length > MAX_TEXTO) return `El texto principal pasa de ${MAX_TEXTO} caracteres.`;
  if (!t.titulo.trim()) return 'Falta el título.';
  if (t.titulo.length > 255) return 'El título pasa de 255 caracteres.';
  if (!CTAS.includes(t.cta)) return 'El botón no es válido.';
  if (!t.formularioId && !(t.link && /^https:\/\/[^\s]+$/i.test(t.link))) return 'Falta el link de destino (https://…), o el formulario.';
  return null;
}

/**
 * El cuerpo de `POST /v1/ads/create` para UN creativo en un conjunto que ya existe. `urlDescarga` es la URL firmada del
 * archivo en nuestro staging: Zernio la baja una vez y la sube a la cuenta de Meta.
 */
export function cuerpoCreativoEnConjunto(x: {
  conexion: ConexionAnunciosZernio;
  adSetId: string;
  nombre: string;
  archivo: ArchivoSubido;
  urlDescarga: string;
  textos: TextosCreativo;
  activo: boolean;
}): Record<string, unknown> {
  const t = x.textos;
  const cuerpo: Record<string, unknown> = {
    accountId: x.conexion.accountId,
    adAccountId: x.conexion.adAccountId,
    adSetId: x.adSetId,
    name: x.nombre,
    adName: x.nombre,
    status: x.activo ? 'ACTIVE' : 'PAUSED',
    body: t.textoPrincipal.trim(),
    headline: t.titulo.trim(),
    callToAction: t.cta,
  };
  if (t.formularioId) cuerpo.leadGenFormId = t.formularioId;
  if (t.link) cuerpo.linkUrl = t.link;
  if (x.archivo.tipo === 'video') cuerpo.video = { url: x.urlDescarga };
  else cuerpo.imageUrl = x.urlDescarga;
  return cuerpo;
}

/**
 * El nombre del anuncio nuevo: el del archivo sin extensión, con la marca de MaKo. Con `codigo` (el NNN.SS.x de la nomenclatura,
 * `codigosDeAnunciosNuevos`), el código va primero: es lo que se lee de un nombre en la nomenclatura de la cuenta.
 */
export function nombreDeAnuncio(nombreArchivo: string, i: number, codigo: string | null = null): string {
  const base = nombreArchivo.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 80) || `Creativo ${i + 1}`;
  return `${codigo ? `${codigo} ` : ''}${base} · MaKo`;
}

// ── La nomenclatura NNN.SS.x (18/11/2026, O9) ─────────────────────────────────────────────────────────────────────────────
// Martín, 31/07/2026 (docs/hallazgos-ads.md, «la nomenclatura se genera sola»): campaña `001.`, conjunto `001.02`, anuncio
// `001.02.a`, «también al agregar un ad a una campaña existente». La regla vivía en el Ads Manager viejo (CampanasBrowser.tsx:
// `codigoPadre`, `nextSuffix`, `letra`) y se fue con él el 25/10 (0c9383b83): desde ahí un anuncio subido a un conjunto con
// código nacía «hook dolor v2 · MaKo», fuera de la nomenclatura. Se trae ACÁ, sin IA: el código sale del nombre del conjunto y
// de las letras que ya usan sus anuncios. Lo que el nombre DICE (objetivo, ángulo) salía del análisis con IA: eso no (cuesta).
//
// Sólo con el código de un CONJUNTO al principio de su nombre (tres dígitos, un punto y dos o tres): un conjunto sin
// nomenclatura no recibe un código inventado, y un «2026 Leads» no se lee como uno.
const CODIGO_CONJUNTO = /^\s*(\d{3}\.\d{2,3})(?=$|[\s\-–—/|·:])/;

/** El código NNN.SS de un conjunto, si su nombre arranca con él; null si no está en la nomenclatura. */
export function codigoDeConjunto(nombre: string): string | null {
  return CODIGO_CONJUNTO.exec(nombre)?.[1] ?? null;
}

/** Letra → número (a=1, z=26, aa=27…) y al revés: la letra del anuncio dentro de su conjunto. */
const letraANumero = (s: string): number => { let n = 0; for (const ch of s.toLowerCase()) n = n * 26 + (ch.charCodeAt(0) - 96); return n; };
const numeroALetra = (n: number): string => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };

/**
 * Los códigos NNN.SS.x de los `n` anuncios nuevos de un conjunto: el del conjunto y la letra que sigue a la MAYOR que ya usa un
 * anuncio suyo (no al conteo: borrar un anuncio no hace que el siguiente repita una letra). Sin código en el conjunto, `n` nulls.
 */
export function codigosDeAnunciosNuevos(conjunto: string, hermanos: readonly string[], n: number): Array<string | null> {
  const codigo = codigoDeConjunto(conjunto);
  if (!codigo) return Array.from({ length: n }, () => null);
  const mayor = Math.max(0, ...[...letrasUsadas(codigo, hermanos)].map(letraANumero));
  return Array.from({ length: n }, (_, i) => `${codigo}.${numeroALetra(mayor + i + 1)}`);
}

/** Las letras (en minúscula) que ya usan los anuncios de un conjunto con código: `001.02.c …` → `c`. */
function letrasUsadas(codigo: string, hermanos: readonly string[]): Set<string> {
  const propio = new RegExp(`^\\s*${codigo.replace('.', '\\.')}\\.([a-z]+)(?=$|[\\s\\-–—/|·:])`, 'i');
  const out = new Set<string>();
  for (const h of hermanos) {
    const m = propio.exec(h);
    if (m) out.add(m[1].toLowerCase());
  }
  return out;
}

/** El código de un ANUNCIO al principio de un nombre (`001.02.c`): el del conjunto y la letra. */
const CODIGO_ANUNCIO = /^(\d{3}\.\d{2,3})\.([a-z]+)(?=$|[\s\-–—/|·:])/i;
const SEPARADOR = /^($|[\s\-–—/|·:])/;

/**
 * El nombre FINAL de UN anuncio que se agrega a un conjunto existente (`proponer_agregar_anuncio` y
 * `proponer_anuncio_desde_archivo` de la API de MaKo; 18/11/2026, la revisión de O9). La decisión del 31/07 dice que la
 * nomenclatura sale sola «también al agregar un ad a una campaña existente», y la regla de docs/hallazgos-ads.md pide que
 * `NNN.SS.x ` sea el PRIMER token, terminado en espacio. Así que el código va adelante y lo que mandó quien lo pide (el modelo,
 * o la persona que lo corrigió en la pantalla de revisión) queda como la parte que lo DESCRIBE, igual que en la plantilla del
 * Ads Manager viejo (`'{padre}.{a} {objetivo} / {angulo}'`). No se reemplaza: es lo único que dice qué es ese anuncio.
 *   · Un conjunto sin código: el nombre tal cual (no se inventa una nomenclatura que el negocio no usa).
 *   · Si el nombre YA trae el código de ESTE conjunto con una letra que ningún hermano usa, se respeta: lo eligió alguien.
 *   · Si trae otro código de anuncio (el de un hermano copiado, el de otro conjunto), o el del conjunto o su campaña copiados
 *     de su nombre, se saca y se pone el que le toca: un código que no dice dónde vive el anuncio es peor que ninguno.
 */
export function nombreConCodigoDeAnuncio(conjunto: string, hermanos: readonly string[], nombre: string): string {
  const base = nombre.trim();
  const codigo = codigoDeConjunto(conjunto);
  if (!codigo) return base;
  const ad = CODIGO_ANUNCIO.exec(base);
  if (ad && ad[1] === codigo && !letrasUsadas(codigo, hermanos).has(ad[2].toLowerCase())) return base;
  const campana = codigo.slice(0, 4); // «001.»
  let desc = base;
  if (ad) desc = base.slice(ad[0].length);
  else if (base.startsWith(codigo) && SEPARADOR.test(base.slice(codigo.length))) desc = base.slice(codigo.length);
  else if (base.startsWith(campana) && SEPARADOR.test(base.slice(campana.length))) desc = base.slice(campana.length);
  desc = desc.replace(/^[\s\-–—/|·:]+/, '').trim();
  const [nuevo] = codigosDeAnunciosNuevos(conjunto, hermanos, 1);
  return desc ? `${nuevo} ${desc}` : String(nuevo);
}

/** Una subida tal como llega: de la pantalla (/api/media-buyer → subir_creativos) o de la API de MaKo (subir_creativos_media_buyer). */
export type PedidoDeSubida = {
  adSetId: string | null; archivos: ArchivoSubido[]; textos: TextosCreativo; activo: boolean;
  /**
   * El anuncio del conjunto contra el que se prueban (un hook nuevo contra el video ganador). Queda en la decisión como su
   * `anuncioBase`, y con eso el Relevo (motor.ts) pausa el original cuando uno de éstos le gana. null = una subida suelta.
   */
  original: string | null;
};

const ID_META = /^\d{1,30}$/;

/**
 * El pedido de una subida, leído en UN lugar para las dos puertas: el conjunto (un id numérico), los archivos (path, tipo y
 * nombre; lo que no es video es imagen), los textos (el botón cae a «Más información» si no es uno de CTAS; el link vacío es
 * null) y si sale activo (`activo: false` lo deja en pausa; sin decirlo, activo, como la pantalla). Valida la FORMA; lo que
 * se puede publicar lo dicen `errorDeTextos` y lib/media-buyer/subir.ts.
 */
export function leerPedidoDeSubida(o: Record<string, unknown>): PedidoDeSubida {
  const adSetId = typeof o.adSetId === 'string' && ID_META.test(o.adSetId) ? o.adSetId : null;
  const archivos = (Array.isArray(o.archivos) ? o.archivos : []).map((a): ArchivoSubido => {
    const x = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
    const nombre = String(x.nombre ?? 'creativo').slice(0, 120);
    // Un video de MaKo: sólo su referencia, con la forma de lib/creativo-mako.ts (hoy todos son videos). Una ref que no tiene
    // esa forma no se cuela como path: queda con el path vacío, y revisarSubida la rechaza.
    if (typeof x.ref === 'string' && x.ref) return leerRefCreativo(x.ref) ? { path: '', tipo: 'video', nombre, ref: x.ref } : { path: '', tipo: 'video', nombre };
    return { path: String(x.path ?? ''), tipo: x.tipo === 'video' ? 'video' : 'image', nombre };
  });
  const t = (o.textos && typeof o.textos === 'object' ? o.textos : {}) as Record<string, unknown>;
  const textos: TextosCreativo = {
    textoPrincipal: String(t.textoPrincipal ?? ''), titulo: String(t.titulo ?? ''),
    cta: (CTAS as readonly string[]).includes(String(t.cta)) ? (t.cta as Cta) : 'LEARN_MORE',
    link: typeof t.link === 'string' && t.link.trim() ? t.link.trim() : null,
    formularioId: typeof t.formularioId === 'string' && ID_META.test(t.formularioId) ? t.formularioId : null,
  };
  const original = typeof o.original === 'string' && ID_META.test(o.original) ? o.original : null;
  return { adSetId, archivos, textos, activo: o.activo !== false, original };
}

/** ¿El archivo se puede usar? Uno del disco, con su path del staging; uno de MaKo, con su referencia bien formada. */
export const archivoValido = (a: ArchivoSubido, esPathDeStaging: (p: string) => boolean): boolean =>
  a.ref ? !!leerRefCreativo(a.ref) : esPathDeStaging(a.path);
