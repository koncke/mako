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
import {
  asegurarWebhook, cfg, cfgDeCuenta, clavesZernio, cuentasConectadas, perfilDeClaveExtra, profileIdEfectivo, RUTEO_CUENTA, RUTEO_PERFIL, usaCuentaPropia, zFetch,
  ZernioError, type ClaveZernio, type ZernioCfg,
} from './zernio';
import {
  REDES, claveConLugar, clavesDe, esFlujoValido, esRedZernio, leerCuentasDeZernio, MAX_CLAVES_ZERNIO, MENSAJES_DE_MOTIVO, motivoDeRespuesta, textoAvisoCobro,
  tieneListaDeCuentas, urlDeLoginDeZernio, validarVolver, volverConMarca,
  type ConexionZernio, type MotivoZernio, type RedZernio, type RespuestaConectar,
} from './zernio-redes';

/** El error de esta pieza, con el motivo que la pantalla sabe leer (`MotivoZernio`). */
export class ZernioConectarError extends Error {
  readonly motivo: MotivoZernio;
  readonly pagoUrl: string | null;
  /** Con `pausa` (un 429): cuánto pidió esperar Zernio (`Retry-After`), o null. */
  readonly esperaMs: number | null;
  constructor(motivo: MotivoZernio, mensaje?: string, pagoUrl: string | null = null, esperaMs: number | null = null) {
    super(mensaje ?? MENSAJES_DE_MOTIVO[motivo]);
    this.name = 'ZernioConectarError';
    this.motivo = motivo;
    this.pagoUrl = pagoUrl;
    this.esperaMs = esperaMs;
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
async function contexto(ws: number, k?: ClaveZernio): Promise<{ c: ZernioCfg; profileId: string }> {
  let c: ZernioCfg;
  try {
    c = k ?? await cfg(ws);
  } catch (e) {
    if (e instanceof ZernioError && e.status === 0 && e.message === NO_CONFIGURADO) throw new ZernioConectarError('sin-clave');
    throw e;
  }
  const clave = `${ws}:${huella(c.apiKey)}`;
  const hit = perfiles.get(clave);
  if (hit && hit.vence > Date.now()) return { c, profileId: hit.profileId };
  // Una clave EXTRA (29/10/2026) tiene su perfil aparte: el de la 1 vive en `zernio_workspace` y no se toca (`perfilDeClaveExtra`).
  const profileId = k && k.slot > 1 ? await perfilDeClaveExtra(ws, k) : await profileIdEfectivo(ws, c);
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
    return new ZernioConectarError(r.motivo, r.texto ?? undefined, r.pagoUrl, r.motivo === 'pausa' ? e.esperaMs : null);
  }
  const n = e instanceof Error ? e.name : '';
  if (n === 'TimeoutError' || n === 'AbortError' || /timed? ?out|aborted|fetch failed/i.test(msg(e))) return new ZernioConectarError('sin-red');
  return new ZernioConectarError('error');
}

/**
 * ¿Se habló con la clave de la CUENTA DE MaKo? El ws1 (OWNER_WS) y, con el interruptor prendido, un negocio sin clave propia que usa
 * la cuenta prestada de la plataforma (`byok` false). La verificación del 28/10: sólo se miraba el ws1, y a un negocio prestado un
 * 402 le decía «Tu cuenta de Zernio está pausada» con el link de pago de MaKo. `usada`: la config con la que se habló, si se llegó.
 */
async function esDeLaCasa(ws: number, usada: ZernioCfg | null): Promise<boolean> {
  if (ws === OWNER_WS) return true;
  if (usada) return !usada.byok;
  return cfg(ws).then((c) => !c.byok, () => false);
}

function fallo(e: unknown, donde: string, ws: number, deLaCasa: boolean): Extract<RespuestaConectar, { ok: false }> {
  const m = motivoDeError(e, deLaCasa);
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
  let usada: ZernioCfg | null = null;
  try {
    const { c, profileId } = await contexto(ws);
    usada = c;
    const todas = (await cuentasDeUnaClave(ws, c, profileId, red)).map((x) => ({ ...x, clave: 1 }));
    // Las de las claves EXTRA (29/10/2026), cada una con su número: la red queda atada a la clave con que se conectó. Una extra que
    // no se puede leer no tumba la lista: se dice en el log y sus redes no se ven hasta que vuelva.
    for (const k of (await clavesDelNegocio(ws)).slice(1)) {
      try {
        const ctx = await contexto(ws, k);
        todas.push(...(await cuentasDeUnaClave(ws, ctx.c, ctx.profileId, red)).map((x) => ({ ...x, clave: k.slot })));
      } catch (e) {
        console.warn(`[zernio-conectar] ws${ws}: la clave ${k.slot} no se pudo leer: ${msg(e).slice(0, 200)}`);
      }
    }
    return todas;
  } catch (e) {
    throw motivoDeError(e, await esDeLaCasa(ws, usada));
  }
}

/** Las claves del negocio, sin caché (conectar y la lista de redes ven la clave recién pegada); sin ninguna, `sin-clave`. */
async function clavesDelNegocio(ws: number): Promise<ClaveZernio[]> {
  try {
    return await clavesZernio(ws, { fresca: true });
  } catch (e) {
    if (e instanceof ZernioError && e.status === 0 && e.message === NO_CONFIGURADO) throw new ZernioConectarError('sin-clave');
    throw e;
  }
}

/** Las cuentas (de una red, o todas) de UNA clave, filtradas por su perfil. */
async function cuentasDeUnaClave(ws: number, c: ZernioCfg, profileId: string, red?: RedZernio): Promise<ConexionZernio[]> {
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
}

// ── Conectar: el link del login ──────────────────────────────────────────────

const ID_ANUNCIOS = /^act_\d{5,20}$/;
const ID_PAGINA = /^\d{5,20}$/;
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
 *   · `pageId`: la página de los anuncios. ⚠️ Con VARIAS concedidas y sin ella, Zernio NO crea la conexión (medido el 25/10/2026
 *     con la cuenta de MaKo; la elige `paginaParaConectar`, lib/zernio-meta-cuerpo.ts).
 * Un 200 de Zernio sin link ni `alreadyConnected` NO es un éxito: es `respuesta`.
 */
export async function urlConectarViaZernio(
  ws: number,
  red: RedZernio,
  volver: string,
  opc: { modo?: 'ventana' | 'pagina'; reconectarId?: string | null; adAccountId?: string | null; pageId?: string | null; flujo?: string | null; aceptaCobro?: boolean; clave?: number | null } = {},
): Promise<RespuestaConectar> {
  let usada: ZernioCfg | null = null;
  try {
    if (!esRedZernio(red)) throw new ZernioConectarError('error', 'Esa red no se puede conectar.');
    const def = REDES[red];
    const v = validarVolver(volver);
    if (!v) throw new ZernioConectarError('error', 'La dirección de vuelta no vale.');
    const elegida = await claveParaConectar(ws, red, opc);
    if ('cobro' in elegida) return { ok: false, motivo: 'cobro', error: elegida.cobro, puedeAgregarClave: elegida.puedeAgregar };
    const { c, profileId } = await contexto(ws, elegida.clave);
    usada = c;

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
    if (def.anuncios && opc.pageId && ID_PAGINA.test(opc.pageId)) q.set('pageId', opc.pageId);
    // Sin página elegida, la que MaKo ya sabe si es UNA sola (con varias, la elige la persona en el modal de Meta).
    if (def.anuncios && !q.has('pageId')) {
      const { paginaDeducida } = await import('./meta-conexion-zernio');
      const pagina = await paginaDeducida(ws, c.apiKey);
      if (pagina) q.set('pageId', pagina);
    }

    const r = await zFetch<Record<string, unknown>>(c.apiKey, `/connect/${def.ruta}?${q.toString()}`);
    const url = urlDeLoginDeZernio(r);
    if (url) return { ok: true, tipo: 'url', url };
    // Zernio no necesitó un login: ya tenía el permiso (anuncios en modo classic) o rehabilitó la cuenta al instante.
    if (r.alreadyConnected === true || r.reconnected === true) {
      return { ok: true, tipo: 'ya-conectada', conexiones: await conexionesViaZernio(ws, red) };
    }
    throw new ZernioConectarError('respuesta', undefined);
  } catch (e) {
    return fallo(e, `conectar ${String(red)}`, ws, await esDeLaCasa(ws, usada));
  }
}

/**
 * EN QUÉ CLAVE SE CONECTA (29/10/2026, varias claves). Reconectar: la dueña de esa cuenta. La pedida (`clave`, «Conectar igual» en
 * esa). Si no, la PRIMERA con lugar (`claveConLugar`: menos de 2 cuentas activas; una red que ya tiene también suma). Si todas están llenas, el
 * aviso de la 3.ª red ANTES del login (27/10, feedback de Leila; 29/10, Martín: «te advierte... si conectás esta cuenta sin otra API
 * te va a empezar a cobrar Zernio»), salvo `aceptaCobro`. Se cuenta TODA la cuenta de Zernio de cada clave (sin `profileId`): Zernio
 * cobra por equipo. Con la clave de MaKo (el ws1) no se avisa: paga MaKo. Si no se puede contar, no se frena (el 402 de Zernio avisa).
 */
async function claveParaConectar(
  ws: number, red: RedZernio, opc: { reconectarId?: string | null; aceptaCobro?: boolean; clave?: number | null },
): Promise<{ clave: ClaveZernio } | { cobro: string; puedeAgregar: boolean }> {
  const claves = await clavesDelNegocio(ws);
  if (opc.reconectarId) return { clave: await cfgDeCuenta(ws, opc.reconectarId) };
  const pedida = opc.clave ? claves.find((k) => k.slot === opc.clave) : undefined;
  if (pedida && opc.aceptaCobro) return { clave: pedida };
  if (!(await usaCuentaPropia(ws).catch(() => false))) return { clave: claves[0] };
  const conteos: Array<{ slot: number; conectadas: ConexionZernio[] }> = [];
  for (const k of pedida ? [pedida] : claves) {
    const todas = await zFetch<unknown>(k.apiKey, '/accounts?excludeHidden=true').catch(() => null);
    if (!todas || !tieneListaDeCuentas(todas)) return { clave: k };
    conteos.push({ slot: k.slot, conectadas: leerCuentasDeZernio(todas) });
  }
  // ⚠️ Sin `reconectarId` (eso ya volvió arriba), conectar una red que la clave YA tiene es «Conectar otra»: OTRA cuenta para Zernio
  // (29/10/2026, la llamada con Thiago: un 2.º Instagram se cobraba sin aviso). Se cuenta como una red nueva.
  const slot = claveConLugar(conteos, red, { otra: true });
  if (slot != null) return { clave: claves.find((k) => k.slot === slot) ?? claves[0] };
  if (opc.aceptaCobro) return { clave: pedida ?? claves[0] };
  const llena = conteos[0];
  const puedeAgregar = claves.length < MAX_CLAVES_ZERNIO;
  const mismaRed = conteos.some((k) => k.conectadas.some((x) => x.activa && x.plataforma === REDES[red].plataforma));
  return { cobro: textoAvisoCobro(llena.conectadas.filter((x) => x.activa).length, { puedeAgregar, otraDe: mismaRed ? REDES[red].etiqueta : null }), puedeAgregar };
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
