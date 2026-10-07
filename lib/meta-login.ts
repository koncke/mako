// =============================================================================
// meta-login — «Conectar con Meta»: la app propia de MaKo y Facebook Login for Business
// =============================================================================
// SIN `server-only` a propósito: decide a DÓNDE vuelve el navegador después de
// Meta y qué se le pide a Meta, y una condición así tiene que poder importarla un
// test (mismo criterio que lib/gcal-estado.ts). El SECRETO de la app no vive acá:
// lo lee sólo el callback, de `process.env.MAKO_META_APP_SECRET`.
//
// La identidad de la app es de la PLATAFORMA y va en el código, no en un setting
// de un inquilino (AGENTS.md → «OWNER_WS NO es la plataforma»). No son secretos:
// el app id y el config id viajan igual en la URL del diálogo.
//
// ⚠️ OJO CON `META_APP_SECRET`: ya existe y es el de la app VIEJA («Leads -
// Dashboard MKT (Martin)», del portafolio de Mauricio). Con ése se firma el webhook
// de leads (app/api/webhooks/meta-leads). El de la app MaKo es OTRO valor y va en
// otra variable; reusar el nombre rompería la firma de todos los leads entrantes.

/** La app «MaKo» (portafolio MaKo 493711571134922), creada el 07/10/2026. */
export const META_APP_ID = '2586146911825340';

/**
 * La configuración «MaKo - Conectar Meta» de Login for Business: token de USUARIO
 * DEL SISTEMA que no vence, con Páginas y Cuentas publicitarias obligatorias y
 * Píxeles opcional. Sin vencimiento a propósito: con 60 días haría falta un job de
 * renovación, y su falla silenciosa desconectaría a cada cliente cada dos meses.
 */
export const META_CONFIG_ID = '1856482472307001';

/** La variable de entorno con el secreto de la app MaKo (la carga Martín en Vercel). */
export const ENV_SECRETO_APP = 'MAKO_META_APP_SECRET';

/**
 * El redirect está registrado en MODO ESTRICTO en el panel de la app: tiene que
 * ser EXACTAMENTE este. Por eso no se arma con el origin del request — en un
 * preview de Vercel daría otra URL y Meta contestaría «URL bloqueada» — sino con
 * el dominio público, igual que `googleRedirectUri`.
 */
export function metaRedirectUri(origin: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL?.trim() || origin).replace(/\/+$/, '');
  return `${base}/api/integraciones/meta/callback`;
}

/** La URL del diálogo de Meta. `response_type=code` + `override_default_response_type`
 *  es lo que pide Login for Business para canjear un token de usuario del sistema. */
export function urlDialogoMeta(opts: { version: string; redirectUri: string; state: string }): string {
  const u = new URL(`https://www.facebook.com/${opts.version}/dialog/oauth`);
  u.searchParams.set('client_id', META_APP_ID);
  u.searchParams.set('config_id', META_CONFIG_ID);
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('state', opts.state);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('override_default_response_type', 'true');
  return u.toString();
}

/**
 * A dónde vuelve el navegador al terminar. Sólo un path de ESTA app: un `volver`
 * con dominio (o `//dominio`, que el navegador lee como otro host) sería un
 * redirect abierto con la sesión del cliente recién conectada.
 *
 * El `?ws=` se le saca: lo pone el callback con el workspace que autorizó el paso
 * 1 (conWs), nunca el que venga escrito en un parámetro.
 */
export function volverSeguro(volver: string | null | undefined): string {
  const v = (volver ?? '').trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.length > 300) return '/integraciones';
  let u: URL;
  try { u = new URL(v, 'https://x.invalid'); } catch { return '/integraciones'; }
  if (u.origin !== 'https://x.invalid') return '/integraciones';
  u.searchParams.delete('ws');
  // Los parámetros de un intento anterior no se arrastran al siguiente.
  u.searchParams.delete('meta');
  return `${u.pathname}${u.search}`;
}

/**
 * El destino final del callback: la pantalla de la que salió, y en /integraciones
 * con el modal de Meta abierto (`?servicio=meta`, que el tablero ya sabe leer).
 */
export function destinoDeVuelta(volver: string): string {
  const u = new URL(volverSeguro(volver), 'https://x.invalid');
  if (u.pathname === '/integraciones') u.searchParams.set('servicio', 'meta');
  return `${u.pathname}${u.search}`;
}

/** Cómo terminó el último intento. Lo lee el formulario de Meta (vía la ruta de credenciales). */
export type ResultadoConexionMeta = 'ok' | 'cancelado' | 'vencido' | 'no-permitido' | 'no-disponible' | 'meta-fallo';

const RESULTADOS: readonly ResultadoConexionMeta[] = ['ok', 'cancelado', 'vencido', 'no-permitido', 'no-disponible', 'meta-fallo'];

export function leerResultadoMeta(v: string | null | undefined): ResultadoConexionMeta | null {
  return RESULTADOS.includes(v as ResultadoConexionMeta) ? (v as ResultadoConexionMeta) : null;
}
