// =============================================================================
// El Pixel de MaKo en UNA línea: el cargador
// =============================================================================
// Decisión de Martín (09/10/2026, «terminalo todo»): en vez de pegar las ~2.226
// líneas del snippet, se pega
//
//     <script src="https://hola-mako.com/m.js?id=mko_…" defer></script>
//
// y la ruta `app/m.js/route.ts` sirve el Pixel ACTUAL para ese token. Dos cosas
// que el snippet pegado no podía:
//
//   · nadie tiene que volver a pegarlo cuando sale una versión nueva: el código
//     queda CONGELADO en el HTML del cliente el día que lo copia (así se perdieron
//     18 días de medición en julio), y con el cargador lo que se congela es la
//     línea, no el código;
//   · el editor con IA de un cliente (ws13, 08/10/2026) TAPABA el código con
//     ******** al pegarlo. Una línea con una URL no tiene nada que tapar.
//
// ⚠️ EL NOMBRE DE LA RUTA ES CORTO Y NEUTRO A PROPÓSITO. Los bloqueadores de
// anuncios listan rutas con `track`, `pixel`, `analytics`, `tag` o `beacon`: con
// una de esas palabras, el Pixel no se baja en el navegador de quien tenga uno, y
// nadie se entera. `/m.js` no dice nada. (El beacon sigue en /api/track/vsl: eso
// es otra pelea, y no se tocó acá.)
//
// ⚠️ Y EL TOKEN VA EN EL QUERY, no en el camino: así la ruta es UNA, exacta, y entra
// en lib/rutas-publicas.ts sin abrir un prefijo.
//
// `defer` y no `async`: con `defer` el código corre cuando el HTML ya se leyó y
// ANTES del `load`, que es lo mismo que pasaba pegado antes del </body>. Con
// `async` puede correr después del `load` (el snippet lo tolera, pero no hay por
// qué cambiarle el momento).
//
// SIN `server-only`: lo usan la ruta, el análisis de la página, el aviso y la
// pantalla, y lo prueba tests/pixel-cargador.test.ts.
// =============================================================================

/** El camino de la ruta. Si cambia, cambian también la carpeta `app/m.js` y la
 *  entrada de lib/rutas-publicas.ts (tests/pixel-cargador.test.ts lo exige). */
export const RUTA_CARGADOR = '/m.js';

/** El parámetro que lleva el token. NO puede ser `token` ni `key`: son las
 *  palabras que buscan los detectores de secretos que tapan el código. */
export const PARAM_CARGADOR = 'id';

/**
 * La forma de un token de landing que se acepta. La misma que acepta el beacon
 * (`TOKEN_RE` en app/api/track/vsl/route.ts), para no dejar afuera un token viejo
 * de otra forma.
 *
 * ⚠️ ES TAMBIÉN UNA BARANDA: el token se escribe ADENTRO del JavaScript que se
 * sirve (`var CUENTA = '…'`). Con sólo letras, números, `_` y `-` no hay comilla ni
 * barra con la que cerrar la cadena e inyectar código en la página del cliente.
 */
export const FORMA_TOKEN = /^[\w-]{8,64}$/;

/** La línea que se copia en /integraciones. `base` es APP_BASE_URL. */
export function lineaCargador(token: string, base: string): string {
  return `<script src="${base.replace(/\/+$/, '')}${RUTA_CARGADOR}?${PARAM_CARGADOR}=${token}" defer></script>`;
}

/**
 * El token de la línea del cargador que trae un HTML, o `null` si no la trae.
 *
 * Se busca el camino con su parámetro (`/m.js?id=`) y no el dominio: el día que
 * MaKo se mude, las líneas pegadas con el dominio viejo siguen siendo nuestras.
 * Acepta `&amp;` y el resto del query después, que es como lo escribe un HTML.
 *
 * ⚠️ PERO EL TOKEN TIENE QUE SER NUESTRO (`mko_…`). `/m.js?id=` es un nombre genérico:
 * cualquier otro script de la página puede llamarse así, y esta función es la que decide
 * que una página «está al día» (`versionEnHtml`, lib/pixel-aviso.ts). Con un id ajeno, una
 * página con el Pixel viejo metido por un administrador de etiquetas —que no está en el
 * HTML— se leía como al día y el aviso se apagaba. Medido el 09/10/2026 (sólo lectura):
 * los 9 tokens de landing del ruteo son `mko_` + 32 hex. La ruta sigue aceptando la forma
 * amplia (`FORMA_TOKEN`); lo que se acota es lo que se AFIRMA de una página ajena.
 */
export function tokenDelCargador(html: string | null | undefined): string | null {
  const m = /\/m\.js\?(?:[^"'\s>]*?&(?:amp;)?)?id=(mko_[\w-]{4,60})(?=["'&\s>]|$)/.exec(html ?? '');
  return m ? m[1] : null;
}

// ── Lo que contesta la ruta ─────────────────────────────────────────────────
//
// La decisión vive acá y no en el route.ts por la regla de la casa: lo que se puede
// equivocar va donde un test lo pueda correr. La ruta sólo enchufa la base y el
// snippet.

/**
 * Caché corta en el navegador y en el CDN: una versión nueva tiene que llegar SOLA
 * en minutos (el navegador la vuelve a pedir a los 5, el CDN a los 10), y mientras
 * el CDN revalida sigue sirviendo la anterior un día entero en vez de hacer esperar
 * a la página. Un día sin poder revalidar es una base caída: mejor el Pixel de ayer
 * que ninguno.
 */
export const CACHE_PIXEL = 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400';

/** Un token que no es de nadie se guarda poco: un minuto alcanza para que una
 *  página mal pegada no le pegue a la base en cada visita, y no tapa a un token
 *  recién acuñado más que eso. */
export const CACHE_DESCONOCIDO = 'public, max-age=60, s-maxage=60';

export type RespuestaCargador = { status: number; cuerpo: string; headers: Record<string, string> };

const JS = 'application/javascript; charset=utf-8';

/**
 * Lo que contesta `GET /m.js?id=…`.
 *
 *   · token con forma inválida o que no es de nadie → 404, y el cuerpo es SÓLO un
 *     comentario: la página que lo carga recibe JavaScript válido que no hace nada,
 *     en vez de un HTML de error que el navegador intentaría ejecutar;
 *   · la base no contestó → 503 SIN caché: un «no sé» guardado en el CDN apagaría
 *     el Pixel de ese negocio diez minutos después de que la base volvió;
 *   · el snippet no tiene la forma de archivo → 500 sin caché (no se sirve uno roto);
 *   · token de alguien → 200 con el Pixel actual, el mismo que se descarga como
 *     archivo en /integraciones (`pixelComoArchivo(landingSnippet(token))`).
 *
 * ⚠️ «NO PUDE LEER» NO ES «NO ESTÁ»: `resolver` es la lectura ESTRICTA del ruteo
 * (`wsPorIdentificadorEstricto`), que TIRA si la base falla. Con la tolerante, un
 * pestañeo de la base contestaba 404 y el CDN lo guardaba: la página medía nada.
 */
export async function responderCargador(
  id: string | null | undefined,
  dep: { resolver: (token: string) => Promise<number | null>; pixel: (token: string) => string | null },
): Promise<RespuestaCargador> {
  const token = (id ?? '').trim();
  const nada = (status: number, cache: string, porque: string): RespuestaCargador => ({
    status, cuerpo: `/* MaKo: ${porque} */\n`, headers: { 'Content-Type': JS, 'Cache-Control': cache },
  });
  if (!FORMA_TOKEN.test(token)) return nada(404, CACHE_DESCONOCIDO, 'este Pixel no existe');
  let ws: number | null;
  try {
    ws = await dep.resolver(token);
  } catch {
    return nada(503, 'no-store', 'no se pudo cargar el Pixel, se reintenta en la próxima visita');
  }
  if (ws == null) return nada(404, CACHE_DESCONOCIDO, 'este Pixel no existe');
  const codigo = dep.pixel(token);
  if (!codigo) return nada(500, 'no-store', 'no se pudo armar el Pixel');
  return { status: 200, cuerpo: codigo, headers: { 'Content-Type': JS, 'Cache-Control': CACHE_PIXEL } };
}
