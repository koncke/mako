// =============================================================================
// api-mako/version — la versión de la API (por FECHA, como en GitHub) y sus topes
// =============================================================================
// GitHub versiona su API REST por fecha (`X-GitHub-Api-Version: 2022-11-28`): un cliente
// pide la versión con la que se escribió y la API le contesta igual aunque haya versiones
// nuevas. Copiado el 08/10/2026. Hoy hay UNA; cuando un cambio rompa contrato se suma otra
// fecha acá y la vieja se sigue sirviendo.
//
// Aparte de http.ts (que es `server-only`) porque la leen también la referencia, el
// OpenAPI, los ejemplos y la pantalla.
// =============================================================================

export const VERSION_API = '2026-10-08';
export const VERSIONES_API: readonly string[] = [VERSION_API];
export const CABECERA_VERSION = 'X-MaKo-Api-Version';

/** Pedidos por minuto. Best-effort (memoria por instancia): corta un bucle
 *  descontrolado de un agente o un escaneo de tokens, no un ataque distribuido. */
export const TOPE_POR_MINUTO_WS = 120;
export const TOPE_POR_MINUTO_IP = 240;

/** Tope del cuerpo ANTES de parsear. Vercel corta en 4,5 MB; 256 KB alcanza para
 *  un lote de 200 leads con holgura y no para un transcript entero. */
export const TOPE_CUERPO_BYTES = 256 * 1024;
