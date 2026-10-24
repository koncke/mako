// =============================================================================
// zernio-conectar — «Conectar con Facebook / Instagram / anuncios de Meta», vía Zernio y con la key DEL NEGOCIO
// =============================================================================
// Martín (23/10/2026): «Esta bueno que todo eso salga directo en la app... Que ellos conecten su API de Zernio y luego cuando
// quieran hacer X cosa que requiera un login, que en MaKo esté el botón de logearse con Facebook, Instagram o lo que haga falta».
// Hasta hoy se pegaba la key de Zernio y el login de cada red se hacía AFUERA: con el ws1 (22:43) la conexión de anuncios nunca
// se creó, y Ads Manager sacó el link a mano. Esta es la parte del SERVIDOR de la pieza (lo puro, en lib/zernio-redes.ts; la
// pantalla, en app/_components/ConectarViaZernio.tsx).
//
// QUIÉN LA USA: el bloque «Redes» del modal de Zernio, Instagram y Messenger de Automations (`ConectarSocial`) y Chats. Ads Manager la consumirá cuando publicar
// necesite la conexión de ANUNCIOS (`<ConectarViaZernio red="metaads">` y `conexionesViaZernio`, con el `accountId` de cada conexión): lo cablea SU chat (pendiente al 23/10).
//
// ⚠️ LA KEY ES SIEMPRE LA DEL NEGOCIO (`cfg`, lib/zernio.ts): sin respaldo de la plataforma. Sin key, `ZernioConectarError` con
// `sin-clave`, y la pantalla abre el modal de Zernio de /integraciones para pegarla ahí mismo.
//
// ⚠️ ESCRIBE POCO Y LEE LO JUSTO. `conexionesViaZernio` es SOLO LECTURA: la pantalla la llama cada 4 s mientras la persona termina
// el login, y `GET /v1/accounts` cuenta contra los 60 pedidos por minuto de un equipo con 0 a 2 cuentas. `profileIdEfectivo` (que
// reclama el ruteo del profile con una ESCRITURA y, con key propia, le pregunta a Zernio qué perfiles tiene) se cachea por negocio y
// por huella de la key: si la persona pega otra key, el profile se vuelve a preguntar. Lo que sí escribe, UNA vez al quedar
// conectada una cuenta de Facebook o de Instagram, es `recibirConexion`: reclamar el ruteo de las cuentas y asegurar el webhook;
// sin eso no llega ningún mensaje y no da error.

import 'server-only';
import { createHash } from 'node:crypto';
import { linkApp } from './app-url';
import { estaImpersonando, OWNER_WS } from './workspace';
import { wsPorIdentificadorEstricto } from './webhook-routing';
import { asegurarWebhook, cfg, cuentasConectadas, profileIdEfectivo, RUTEO_CUENTA, RUTEO_PERFIL, zFetch, ZernioError, type ZernioCfg } from './zernio';
import {
  REDES, clavesDe, esFlujoValido, esRedZernio, leerCuentasDeZernio, MENSAJES_DE_MOTIVO, motivoDeRespuesta, tieneListaDeCuentas, urlDeLoginDeZernio,
  validarVolver, volverConMarca,
  type ConexionZernio, type MotivoZernio, type RedZernio, type RespuestaConectar,
} from './zernio-redes';

/** El error de esta pieza, con el motivo que la pantalla sabe leer (`MotivoZernio`). */
export class ZernioConectarError extends Error {
  readonly motivo: MotivoZernio;
  readonly pagoUrl: string | null;
  constructor(motivo: MotivoZernio, mensaje?: string, pagoUrl: string | null = null) {
    super(mensaje ?? MENSAJES_DE_MOTIVO[motivo]);
    this.name = 'ZernioConectarError';
    this.motivo = motivo;
    this.pagoUrl = pagoUrl;
  }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** `cfg` tira esto cuando el negocio no pegó su key (lib/zernio.ts). Con la base caída tira OTRA cosa, y eso no es «sin key». */
const NO_CONFIGURADO = 'Zernio no está configurado';

// ── El profile, cacheado ─────────────────────────────────────────────────────

const TTL_PERFIL_MS = 120_000;
const perfiles = new Map<string, { profileId: string; vence: number }>();
const huella = (apiKey: string) => createHash('sha256').update(apiKey).digest('hex').slice(0, 16);

/**
 * La key del negocio y el profile con el que se habla. Cacheado por (negocio, huella de la key) 2 minutos: sin eso cada medición de
 * la pantalla (cada 4 s) hacía un `GET /profiles` y una escritura de ruteo. Si la persona pega OTRA key, la huella cambia y se vuelve
 * a preguntar. Nunca se guarda la key.
 */
async function contexto(ws: number): Promise<{ c: ZernioCfg; profileId: string }> {
  let c: ZernioCfg;
  try {
    c = await cfg(ws);
  } catch (e) {
    if (e instanceof ZernioError && e.status === 0 && e.message === NO_CONFIGURADO) throw new ZernioConectarError('sin-clave');
    throw e;
  }
  const clave = `${ws}:${huella(c.apiKey)}`;
  const hit = perfiles.get(clave);
  if (hit && hit.vence > Date.now()) return { c, profileId: hit.profileId };
  const profileId = await profileIdEfectivo(ws, c);
  if (!profileId) throw new ZernioConectarError('sin-perfil');
  // ⚠️ DOS NEGOCIOS CON LA MISMA KEY comparten el profile Default de esa cuenta de Zernio (con key propia no hay un profile por negocio), y
  // `profileIdEfectivo` no mira quién lo reclamó primero: el segundo vería las cuentas del primero como suyas, y el ruteo de sus mensajes
  // sigue siendo del primero («el primero que reclama gana»). Si el profile ya es de OTRO negocio, no se sigue. Se mira UNA vez cada 2 minutos.
  const dueno = await wsPorIdentificadorEstricto(RUTEO_PERFIL, profileId);
  if (dueno != null && Number(dueno) !== ws) throw new ZernioConectarError('clave-en-uso');
  perfiles.set(clave, { profileId, vence: Date.now() + TTL_PERFIL_MS });
  return { c, profileId };
}

// ── Los errores de Zernio, dichos como lo que son ────────────────────────────

/**
 * De lo que tira Zernio (o la red, o la base) al motivo que lee la pantalla. La decisión por status y cuerpo es pura y se ejecuta en
 * los tests (`motivoDeRespuesta`, lib/zernio-redes.ts); acá sólo se la alimenta con lo que tiró.
 */
export function motivoDeError(e: unknown, deLaCasa = false): ZernioConectarError {
  if (e instanceof ZernioConectarError) return e;
  if (e instanceof ZernioError) {
    if (e.status === 0 && e.message === NO_CONFIGURADO) return new ZernioConectarError('sin-clave');
    const r = motivoDeRespuesta(e.status, e.body, e.code);
    // ⚠️ El ws1 (OWNER_WS) sigue con la key de la PLATAFORMA hasta que se le saque: un 401 o un 402 ahí es de la CUENTA DE MaKo, no de él, y
    // su link de pago no es suyo (lo mismo que hace «estado» con `usaCuentaPropia`). Se dice un error genérico y sin link.
    if (deLaCasa && (r.motivo === 'clave-mala' || r.motivo === 'pausada' || r.motivo === 'pago' || r.motivo === 'limite')) return new ZernioConectarError('error');
    return new ZernioConectarError(r.motivo, r.texto ?? undefined, r.pagoUrl);
  }
  const n = e instanceof Error ? e.name : '';
  if (n === 'TimeoutError' || n === 'AbortError' || /timed? ?out|aborted|fetch failed/i.test(msg(e))) return new ZernioConectarError('sin-red');
  return new ZernioConectarError('error');
}

function fallo(e: unknown, donde: string, ws: number): Extract<RespuestaConectar, { ok: false }> {
  const m = motivoDeError(e, ws === OWNER_WS);
  // La key y el `authUrl` nunca van al log: sólo el motivo y el mensaje de Zernio.
  if (m.motivo === 'error' || m.motivo === 'sin-red' || m.motivo === 'respuesta') console.error(`[zernio-conectar] ${donde} ws${ws}: ${m.motivo} — ${msg(e).slice(0, 300)}`);
  return { ok: false, motivo: m.motivo, error: m.message, ...(m.pagoUrl ? { pagoUrl: m.pagoUrl } : {}) };
}

// ── Leer: las conexiones ─────────────────────────────────────────────────────

/**
 * Las cuentas conectadas del negocio en Zernio (las de UNA red, o todas). SOLO LECTURA, y TIRA `ZernioConectarError`: quien llama
 * decide qué decir. `accountId` es el `_id` de Zernio: lo que pide su API de anuncios para publicar.
 */
export async function conexionesViaZernio(ws: number, red?: RedZernio): Promise<ConexionZernio[]> {
  try {
    const { c, profileId } = await contexto(ws);
    const q = new URLSearchParams({ profileId, excludeHidden: 'true' });
    if (red) q.set('platform', REDES[red].plataforma);
    const r = await zFetch<unknown>(c.apiKey, `/accounts?${q.toString()}`);
    // ⚠️ Un objeto SIN lista (un campo que Zernio renombró) NO es «no hay cuentas»: la persona esperaría 4 minutos a una conexión que acá no se sabe
    // ver. Se dice `respuesta` y se loguean las CLAVES del cuerpo (nunca los valores), que es lo que hace falta para corregir el lector.
    if (!tieneListaDeCuentas(r)) {
      console.error(`[zernio-conectar] /accounts ws${ws}: la respuesta no trae lista (claves: ${clavesDe(r)})`);
      throw new ZernioConectarError('respuesta');
    }
    return leerCuentasDeZernio(r, profileId);
  } catch (e) {
    throw motivoDeError(e, ws === OWNER_WS);
  }
}

// ── Conectar: el link del login ──────────────────────────────────────────────

const ID_ANUNCIOS = /^act_\d{5,20}$/;
const ID_CUENTA = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * El link del login de `red`, para abrirlo EN EL CLIC de la persona. Nunca tira: todo fallo vuelve como `{ ok: false, motivo }`.
 *   · `volver`: una RUTA de la app (`validarVolver`); sin ella no hay vuelta.
 *   · `modo: 'ventana'`: el login corre en un popup, que termina en la landing de la ventana (`/integraciones/zernio-vuelta`) y le
 *     avisa a la pantalla. `modo: 'pagina'` (teléfono, navegador interno, popup bloqueado): la pestaña navega y vuelve a `volver`
 *     con la marca de la red.
 *   · `?ws=` SÓLO si hace falta (`wsDeVuelta`): pegarlo siempre pone a un admin de plataforma en «vista de cliente» de sí mismo
 *     (21/10/2026).
 *   · `reconectarId`: reconectar una cuenta que Zernio dice vencida (`reconnectAccountId`; en anuncios, `force`).
 *   · `adAccountId`: acota los anuncios a UNA cuenta publicitaria (`act_<dígitos>`).
 * Un 200 de Zernio sin link ni `alreadyConnected` NO es un éxito: es `respuesta`.
 */
export async function urlConectarViaZernio(
  ws: number,
  red: RedZernio,
  volver: string,
  opc: { modo?: 'ventana' | 'pagina'; reconectarId?: string | null; adAccountId?: string | null; flujo?: string | null } = {},
): Promise<RespuestaConectar> {
  try {
    if (!esRedZernio(red)) throw new ZernioConectarError('error', 'Esa red no se puede conectar.');
    const def = REDES[red];
    const v = validarVolver(volver);
    if (!v) throw new ZernioConectarError('error', 'La dirección de vuelta no vale.');
    const { c, profileId } = await contexto(ws);

    // ⚠️ El `?ws=` de la vuelta sólo si un admin de la plataforma está ADENTRO de un cliente (`estaImpersonando`): pegarlo siempre lo pone en
    // «vista de cliente» de sí mismo (21/10), y no pegarlo cuando está adentro lo hace volver a SU negocio (`wsDeVuelta` no sirve acá: esta
    // petición ya trae el `?ws=` de la pestaña, así que `adminDeWorkspaceActual` da el mismo negocio y la comparación siempre lo saca).
    const w = (await estaImpersonando().catch(() => false)) ? ws : null;
    const flujo = esFlujoValido(opc.flujo) ? opc.flujo : null;
    const redirect = (opc.modo ?? 'ventana') === 'ventana'
      ? linkApp(`/integraciones/zernio-vuelta?red=${red}${flujo ? `&f=${flujo}` : ''}`, w)
      : linkApp(volverConMarca(v, red), w);

    const q = new URLSearchParams({ profileId, redirect_url: redirect });
    for (const [k, val] of Object.entries((def as { params?: Record<string, string> }).params ?? {})) q.set(k, val);
    if (opc.reconectarId && ID_CUENTA.test(opc.reconectarId)) {
      if (def.anuncios) q.set('force', 'true'); else q.set('reconnectAccountId', opc.reconectarId);
    }
    if (def.anuncios && opc.adAccountId && ID_ANUNCIOS.test(opc.adAccountId)) q.set('adAccountId', opc.adAccountId);

    const r = await zFetch<Record<string, unknown>>(c.apiKey, `/connect/${def.ruta}?${q.toString()}`);
    const url = urlDeLoginDeZernio(r);
    if (url) return { ok: true, tipo: 'url', url };
    // Zernio no necesitó un login: ya tenía el permiso (anuncios en modo classic) o rehabilitó la cuenta al instante.
    if (r.alreadyConnected === true || r.reconnected === true) {
      return { ok: true, tipo: 'ya-conectada', conexiones: await conexionesViaZernio(ws, red) };
    }
    throw new ZernioConectarError('respuesta', undefined);
  } catch (e) {
    return fallo(e, `conectar ${String(red)}`, ws);
  }
}

// ── Quedó conectada: armar la recepción ──────────────────────────────────────

/**
 * UNA VEZ, al quedar conectada una cuenta de Facebook o de Instagram: reclama el ruteo de las cuentas del negocio
 * (`cuentasConectadas`: un `comment.received` trae SÓLO el id de la cuenta, y sin esa fila no tiene de quién ser) y asegura el
 * webhook en SU cuenta de Zernio (`asegurarWebhook`). Las dos cosas son idempotentes. Nunca tira: cada una dice cómo salió.
 * ⚠️ Es lo que antes hacía el «estado» de /api/zernio al abrir la tarjeta; sin esto, conectar anda y NO llega ningún mensaje.
 */
export async function recibirConexion(ws: number): Promise<{ ruteo: 'ok' | 'ocupado' | 'error'; webhook: 'creado' | 'actualizado' | 'sin_secreto' | 'error' }> {
  let ruteo: 'ok' | 'ocupado' | 'error' = 'ok';
  let webhook: 'creado' | 'actualizado' | 'sin_secreto' | 'error' = 'error';
  try {
    const cuentas = await cuentasConectadas(ws);
    // ⚠️ `cuentasConectadas` reclama cada cuenta (`upsertRouting`) y NO dice si lo logró: «el primero que reclama gana», y una cuenta que ya es de OTRO
    // negocio (la misma key en dos negocios, una key que pasó de un negocio dado de baja a uno nuevo) queda sin ruteo. Se mira de quién quedó.
    for (const a of cuentas) {
      const dueno = await wsPorIdentificadorEstricto(RUTEO_CUENTA, a._id);
      if (dueno == null) ruteo = ruteo === 'ocupado' ? 'ocupado' : 'error';
      else if (Number(dueno) !== ws) ruteo = 'ocupado';
    }
  } catch (e) { ruteo = 'error'; console.error(`[zernio-conectar] ruteo ws${ws}: ${msg(e).slice(0, 300)}`); }
  try { webhook = await asegurarWebhook(ws); } catch (e) { console.error(`[zernio-conectar] webhook ws${ws}: ${msg(e).slice(0, 300)}`); }
  return { ruteo, webhook };
}
