// =============================================================================
// archivero-webs — cuándo una web pegada NO es una lectura
// =============================================================================
// Tarea #201: pegar un Instagram dejaba el Archivero con un documento llamado
// «Instagram» marcado como LEÍDO y con cero campos adentro. Es el modo de falla
// más caro del arranque: no hay error, el paso queda en verde, y el cliente cree
// que MaKo ya conoce su negocio.
//
// ⚠️ SIN `server-only` A PROPÓSITO: acá vive la decisión de si una web cuenta o
// no, y una decisión que ningún test puede ejecutar es una decisión sin red.
//
// Son TRES preguntas, y se hacen en el orden en que se abaratan:
//   1. muroConocido(host)        → antes de bajar nada (ni IA ni request)
//   2. textoInsuficiente(host,…) → después de bajar, antes de gastar la IA
//   3. sinDatosDelNegocio(host,…)→ después de la IA, y es la que GENERALIZA
//
// La lista de hosts de (1) existe para dar un mensaje preciso y para no gastarle
// una llamada de IA a un muro, NO para ser completa: lo que cubre a cualquier
// muro que no esté en ella es (3). Que una lista de exclusiones crezca sola es
// lo que esta casa ya pagó varias veces.
// =============================================================================

/**
 * Las webs que, MEDIDAS el 13/10/2026 con nuestro propio User-Agent, contestan
 * 200 con un muro de login en vez de la página. El texto que devuelven es
 * plausible —por eso pasaba— y no dice nada del negocio:
 *
 *   instagram.com   200 ·   991 caracteres · «… Instagram Log In Sign Up …»
 *   facebook.com    200 ·     4 caracteres · «Nike»
 *   tiktok.com      200 ·    14 caracteres · «Please wait...»
 *   x.com           200 · 1.385 caracteres · «… Log in Sign up …»
 *
 * ⚠️ LinkedIn NO está acá porque se midió y SÍ funciona: una página de empresa
 * devolvió 13.159 caracteres de contenido real. No se agrega por parecido.
 */
const MUROS: Record<string, string> = {
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'fb.com': 'Facebook',
  'tiktok.com': 'TikTok',
  'x.com': 'X',
  'twitter.com': 'X',
  'threads.net': 'Threads',
};

/**
 * Un piso, no un juicio: los muros medidos devuelven 4 y 14 caracteres, así que
 * cualquier número por encima de eso los corta. 120 caracteres son ~20 palabras:
 * por debajo no hay documento ni para la IA ni para el panorama, y queda muy por
 * debajo de la landing más escueta.
 */
export const TEXTO_MINIMO_WEB = 120;

const normalizar = (host: string) => host.trim().toLowerCase().replace(/^www\./, '');

/** El dominio «de marca» de un host (ayuda.instagram.com → instagram.com). */
function dominio(host: string): string {
  const partes = normalizar(host).split('.');
  return partes.length > 2 ? partes.slice(-2).join('.') : partes.join('.');
}

/**
 * Si este host es un muro conocido, el mensaje que lo explica Y dice qué hacer.
 * Se pregunta ANTES de bajar la página: contra un muro, la llamada de IA se
 * gasta para nada.
 */
export function muroConocido(host: string): string | null {
  const nombre = MUROS[dominio(host)];
  if (!nombre) return null;
  return `${nombre} no deja que MaKo lea tu perfil: pide iniciar sesión. Pega tu página web, o sube un documento con tu oferta.`;
}

/** La web contestó, pero lo que trajo no es una página. */
export function textoInsuficiente(host: string, texto: string): string | null {
  if ((texto || '').trim().length >= TEXTO_MINIMO_WEB) return null;
  return `"${host}" no me devolvió página: casi no trae texto. Pasa con las redes sociales y con las webs que piden iniciar sesión. Pega tu página web, o sube un documento.`;
}

/**
 * La que generaliza: se leyó la web entera y no salió ni un dato del negocio.
 *
 * No es cosmético. Guardar la fila la mostraba como documento leído en el paso
 * del Archivero —el cliente da por hecho que MaKo ya sabe quién es— y ADEMÁS le
 * daba de comer ese texto al panorama, que es el perfil del negocio: un «Log In
 * Sign Up» entraba al perfil como si fuera lo que vende.
 */
export function sinDatosDelNegocio(host: string, campos: Record<string, string> | null | undefined): string | null {
  const utiles = Object.values(campos || {}).filter((v) => String(v ?? '').trim() !== '');
  if (utiles.length > 0) return null;
  return `Leí "${host}" y no saqué ningún dato de tu negocio, así que no la guardo. Pega la página donde cuentas qué vendes, o sube un documento.`;
}
