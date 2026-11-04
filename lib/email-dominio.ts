// =============================================================================
// email-dominio — conectar el dominio de envío de un negocio y fijar su remitente (una puerta, dos entradas)
// =============================================================================
// 4/11/2026: Martín le explicó a Mauricio (ws 1, un cliente) cómo armar desde su Claude, con la API de MaKo, una campaña
// de 14 emails a sus leads. Lo primero que pide esa receta es su dominio, y hasta ese día eso vivía SÓLO adentro de
// app/api/email/dominio/route.ts: la API no tenía cómo conectarlo ni cómo fijar el «De». Ahora la lógica vive acá y la
// usan las dos entradas: la pantalla de /email (la ruta) y la API (`conectar_dominio_email`, `fijar_remitente_email`).
//
// DESDE EL 4/11/2026 CADA NEGOCIO CON SU CUENTA DE RESEND (Martín: «Resend free permite hasta 3 dominios, pero eso lo trae
// cada user de mako»): el dominio se da de alta y se verifica en la cuenta DEL NEGOCIO, con su clave (lib/resend-dominios.ts
// → lib/email-cuenta.ts), y ahí mismo se conecta el webhook que trae sus aperturas, clics y rebotes (`conectarSeguimiento`,
// con su secreto guardado en su fila). Hasta ese día era la «Opción A»: todos adentro de la cuenta de MaKo. El estado vive
// en `app_settings` del negocio del CONTEXTO (quien llama corre adentro de `runWithWorkspace`):
//   resend_domain     → el nombre del dominio
//   resend_domain_id  → el id del dominio en SU cuenta de Resend
//   resend_from       → el remitente («Nombre <hola@dominio.com>»)
//   resend_reply_to   → adónde van las RESPUESTAS de los leads (4/11/2026, «que te envíe a tu email personal»)
//
// ⚠️ Sin cuenta propia no se crea nada: `prepararConexion`, `prepararVerificacion` y `prepararRemitente` frenan ANTES, con el
// texto que guía (`sinCuentaParaOperar`) y `sinCuenta` (la API lo devuelve como `falta: { servicio: 'email' }`).
// ⚠️ La plataforma administra el dominio de MaKo con `RESEND_ADMIN_API_KEY` (la que manda es de sólo envío); sin ella frena
//    con un error que dice que es de MaKo (`nuestra`).
// ⚠️ Y el email de MaKo no es de ningún negocio: el dominio de MaKo sólo lo conecta la plataforma (`esDominioDeMako`).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import {
  createResendDomain, getResendDomain, verifyResendDomain, prenderSeguimiento,
  getEmailFrom, emailConectado, remitenteEsSandbox, resendConfigurado,
  type ResendDomain,
} from './resend';
import { administracionDeLaCuenta, asegurarWebhookDeCuenta, probarClaveDeCuenta, type Administracion } from './resend-dominios';
import { CLAVE_INVALIDA_TUYA, KEY_SOLO_ENVIO_TUYA } from './resend-errores';
import { guardarCredencial } from './credenciales';
import { APP_BASE_URL } from './app-url';
import { SECRETO_WEBHOOK_PROPIO, urlWebhookDeCuenta } from './email-cuenta-reglas';
import { envioEmailHabilitado, setEnvioEmail } from './envio-flags';
import { EMAIL_MAKO } from './app-url';
import { esDominioDeMako, NO_ES_TUYO } from './email-remitente';
import { wsSuperAdmin } from './workspace';
import {
  normalizarDominio, armarRemitente, sanearResponderA, registrosParaCargar,
  DOMINIO_INVALIDO, RESPONDER_A_INVALIDO, type RegistroDns,
} from './email-dominio-reglas';

/** El setting de la dirección de respuestas. */
export const KEY_RESPONDER_A = 'resend_reply_to';

/**
 * `nuestra`: la falla es de MaKo (una clave que falta, una lectura caída), no de lo que pidió la persona: la API la marca
 * `falla: true`. `sinCuenta`: al negocio le falta conectar SU cuenta de Resend: la API la devuelve como
 * `falta: { servicio: 'email' }`, y el texto ya dice cómo.
 */
export type Falla = { ok: false; error: string; status: number; nuestra?: true; sinCuenta?: true };
const falla = (error: string, status: number): Falla => ({ ok: false, error, status });
function sinAdministracion(a: Exclude<Administracion, { ok: true }>): Falla {
  if (a.cuenta === 'sin_clave_de_mako' || a.cuenta === 'no_pude_leer') return { ok: false, error: a.error, status: 503, nuestra: true };
  return { ok: false, error: a.error, status: 409, sinCuenta: true };
}

/** LO QUE SE PUEDE SABER SIN ESCRIBIR antes de verificar: que haya con qué hablarle a SU cuenta de Resend. */
export async function prepararVerificacion(): Promise<{ ok: true } | Falla> {
  const a = await administracionDeLaCuenta();
  return a.ok ? { ok: true } : sinAdministracion(a);
}

/**
 * TITULARIDAD (anti-spoofing entre negocios): un dominio que ya reclamó el negocio B no lo puede reclamar el A. Nació con la
 * cuenta única de Resend (hasta el 4/11/2026), y sigue: con una cuenta por negocio la prueba de verdad es el DNS, pero el
 * remitente de B no puede quedar a nombre de A en MaKo mientras tanto. Lo reclama el `resend_domain` de cada negocio: consulta entre workspaces a propósito (`getSupabaseServer`),
 * porque la titularidad es global. Tira si no puede leer: «no pude preguntar» no es «es tuyo».
 */
async function reclamadoPorOtroWs(dominio: string, ws: number): Promise<boolean> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings')
    .select('workspace_id')
    .eq('key', 'resend_domain')
    .eq('value', dominio)
    .neq('workspace_id', ws)
    .limit(1);
  if (error) throw new Error(`reclamadoPorOtroWs: ${error.message}`);
  return ((data ?? []) as unknown[]).length > 0;
}

/** ¿Es el negocio de la PLATAFORMA? El único que puede usar un dominio de MaKo. Si no se puede saber, no lo es. */
export async function esPlataforma(ws: number): Promise<boolean> {
  try { return ws === await wsSuperAdmin(); } catch { return false; }
}

export type EstadoDominio = {
  conectado: boolean; envioHabilitado: boolean; sandbox: boolean; resendConfigurado: boolean;
  dominio: string | null; remitente: string; responderA: string | null;
  estadoDominio: string | null; records: ResendDomain['records'];
  seguimiento: { aperturas: boolean | null; clics: boolean | null };
  plataforma: boolean;
};

/** El estado entero (lo que contesta GET /api/email/dominio): conectado, envío, dominio en vivo y sus registros. */
export async function estadoDominio(ws: number): Promise<EstadoDominio> {
  // `remitente` y `sandbox` salen del veredicto (`remitenteDelNegocio`): el que pasó, o el sandbox si ninguno pasó.
  const [dominio, dominioId, remitente, conectado, envio, sandbox, keyOk, responderA] = await Promise.all([
    getSetting('resend_domain'),
    getSetting('resend_domain_id'),
    getEmailFrom(),
    emailConectado(),
    envioEmailHabilitado(),
    remitenteEsSandbox(),
    resendConfigurado(),
    getSetting(KEY_RESPONDER_A),
  ]);
  const plataforma = await esPlataforma(ws);
  const id = dominioId?.trim() || null;
  let vivo: ResendDomain | null = null;
  if (id) {
    const r = await getResendDomain(id);
    if (r.ok) vivo = r.domain;
  }
  return {
    conectado,
    envioHabilitado: envio,
    sandbox,
    resendConfigurado: keyOk,
    dominio: dominio?.trim() || null,
    remitente,
    responderA: sanearResponderA(responderA),
    estadoDominio: vivo?.status ?? null,
    records: vivo?.records ?? [],
    seguimiento: { aperturas: vivo?.openTracking ?? null, clics: vivo?.clickTracking ?? null },
    plataforma,
  };
}

/**
 * LO QUE SE PUEDE SABER SIN ESCRIBIR antes de conectar un dominio (la API lo pregunta en `preparar`: confirmar reclama la
 * pendiente y no vuelve). Devuelve el dominio normalizado y el que reemplaza, si había otro.
 */
export async function prepararConexion(ws: number, raw: unknown): Promise<{ ok: true; dominio: string; reemplaza: string | null } | Falla> {
  const dominio = normalizarDominio(String(raw ?? ''));
  if (!dominio) return falla(DOMINIO_INVALIDO, 400);
  if (esDominioDeMako(dominio) && !(await esPlataforma(ws))) return falla(NO_ES_TUYO, 403);
  if (await reclamadoPorOtroWs(dominio, ws)) return falla(`Ese dominio ya está conectado en otro negocio. Si es tuyo, escríbenos a ${EMAIL_MAKO}.`, 403);
  // Sin SU cuenta de Resend (o, en la plataforma, sin la clave que administra el de MaKo) no se crea nada: ni el dominio en
  // Resend ni una línea en los settings.
  const a = await administracionDeLaCuenta();
  if (!a.ok) return sinAdministracion(a);
  // Una clave de SÓLO ENVÍO (o una que Resend ya no reconoce) no da de alta nada: se dice ANTES de proponer, con cuál crear.
  const clave = await probarClaveDeCuenta();
  if (clave === 'solo_envio') return { ok: false, error: KEY_SOLO_ENVIO_TUYA, status: 409, sinCuenta: true };
  if (clave === 'invalida') return { ok: false, error: CLAVE_INVALIDA_TUYA, status: 409, sinCuenta: true };
  const previo = (await getSettingEstricto('resend_domain'))?.trim() || null;
  return { ok: true, dominio, reemplaza: previo && previo !== dominio ? previo : null };
}

export type Conexion = {
  ok: true; dominio: string; estado: string; registros: RegistroDns[]; seguimiento: true | string;
  /** El webhook de SU cuenta (las aperturas, los clics y los rebotes llegan a MaKo): `true`, o el motivo por el que no. */
  webhook: true | string;
};

/**
 * DA DE ALTA EL DOMINIO del negocio en SU cuenta de Resend y lo guarda, y conecta el webhook de esa cuenta. Devuelve los
 * registros DNS que hay que cargar en el proveedor del dominio. Si ya estaba en la cuenta (volver a conectarlo), lo
 * adopta: es idempotente. `seguimiento`: `true` si quedaron prendidas las aperturas y los clics, o el motivo por el que no.
 */
export async function conectarDominio(ws: number, raw: unknown): Promise<Conexion | Falla> {
  const p = await prepararConexion(ws, raw);
  if (!p.ok) return p;
  const r = await createResendDomain(p.dominio, 'sa-east-1');
  if (!r.ok) return falla(r.error, 502);
  await setSetting('resend_domain', r.domain.name);
  await setSetting('resend_domain_id', r.domain.id);
  // El webhook no frena el alta: si falla, el dominio queda y el motivo vuelve (la guía lo pide después).
  const w = await conectarSeguimiento(ws);
  return {
    ok: true, dominio: r.domain.name, estado: r.domain.status, registros: registrosParaCargar(r.domain.records), seguimiento: r.seguimiento,
    webhook: w.ok ? true : w.error,
  };
}

/**
 * CONECTA LOS EVENTOS DE SU CUENTA DE RESEND CON MaKo (4/11/2026): crea (o reusa) el webhook en SU cuenta, que apunta a
 * `/api/webhooks/resend?cuenta=<ws>`, y guarda su secreto en la fila del negocio (`SECRETO_WEBHOOK_PROPIO`). Sin esto sus
 * emails salen igual, pero MaKo no se entera de quién abre, hace clic o rebota: las tarjetas no se mueven y el freno por
 * rebotes no corre. El secreto NUNCA vuelve: ni en el resultado, ni en un log. La plataforma usa el webhook de siempre.
 */
export async function conectarSeguimiento(ws: number, actor: string | null = null): Promise<{ ok: true; creado: boolean; plataforma?: true } | Falla> {
  const a = await administracionDeLaCuenta();
  if (!a.ok) return sinAdministracion(a);
  const w = await asegurarWebhookDeCuenta(urlWebhookDeCuenta(APP_BASE_URL, ws));
  if (!w.ok) return falla(w.error, 502);
  if (w.plataforma) return { ok: true, creado: false, plataforma: true };
  await guardarCredencial(ws, SECRETO_WEBHOOK_PROPIO, w.secreto, 'email', actor ?? 'sistema:conectar-seguimiento');
  return { ok: true, creado: w.creado };
}

/**
 * Le pide a Resend que revise los DNS del dominio cargado. De paso, si el dominio tiene apagado el seguimiento de
 * aperturas o de clics (uno dado de alta antes del 4/11/2026), lo prende.
 */
export async function verificarDominio(): Promise<{ ok: true; dominio: string | null; estado: string | null; registros: RegistroDns[]; seguimiento: true | string | null } | Falla> {
  const id = (await getSettingEstricto('resend_domain_id'))?.trim();
  if (!id) return falla('Primero agrega tu dominio.', 400);
  const listo = await prepararVerificacion();
  if (!listo.ok) return listo;
  const v = await verifyResendDomain(id);
  if (!v.ok) return falla(v.error ?? 'Resend no pudo verificar el dominio.', 502);
  const d = await getResendDomain(id);
  if (!d.ok) return { ok: true, dominio: null, estado: null, registros: [], seguimiento: null };
  let seguimiento: true | string | null = null;
  if (d.domain.openTracking !== true || d.domain.clickTracking !== true) {
    const s = await prenderSeguimiento(id);
    seguimiento = s.ok ? true : s.error;
  }
  return { ok: true, dominio: d.domain.name, estado: d.domain.status, registros: registrosParaCargar(d.domain.records), seguimiento };
}

/** Lo que pide fijar el remitente: el nombre visible, lo de antes del @ y, si viene, adónde van las respuestas. */
export type PedidoRemitente = {
  local: unknown; nombre: unknown;
  /** ausente = no se toca; `null` o '' = se saca; una dirección = esa. */
  responderA?: unknown;
};

/**
 * LO QUE SE PUEDE SABER SIN ESCRIBIR antes de fijar el remitente: que el dominio esté VERIFICADO en vivo (no alcanza con
 * tenerlo cargado), que no sea uno de MaKo y que lo pedido sea válido. Devuelve lo que se va a guardar.
 */
export async function prepararRemitente(ws: number, p: PedidoRemitente): Promise<{ ok: true; from: string; responderA: string | null | undefined } | Falla> {
  // Sin SU cuenta, el dominio no se puede mirar en vivo: decir «no está verificado» mandaría a cargar DNS de más.
  const a = await administracionDeLaCuenta();
  if (!a.ok) return sinAdministracion(a);
  const [dominio, dominioId] = await Promise.all([getSettingEstricto('resend_domain'), getSettingEstricto('resend_domain_id')]);
  if (!dominio?.trim() || !dominioId?.trim()) return falla('Primero conecta y verifica tu dominio.', 400);
  // Y si el dominio cargado es el de MaKo (el ws 1 lo tuvo de cuando era el de la plataforma), tampoco.
  if (esDominioDeMako(dominio.trim()) && !(await esPlataforma(ws))) return falla(NO_ES_TUYO, 403);
  const armado = armarRemitente(p.local, p.nombre, dominio.trim());
  if (!armado.ok) return falla(armado.error, 400);
  let responderA: string | null | undefined;
  if (p.responderA === undefined) responderA = undefined;
  else if (p.responderA === null || String(p.responderA).trim() === '') responderA = null;
  else {
    responderA = sanearResponderA(p.responderA);
    if (!responderA) return falla(RESPONDER_A_INVALIDO, 400);
  }
  const vivo = await getResendDomain(dominioId.trim());
  if (!vivo.ok || vivo.domain.status !== 'verified') {
    return falla('Tu dominio todavía no está verificado. Carga los registros DNS y vuelve a verificarlo.', 400);
  }
  return { ok: true, from: armado.from, responderA };
}

/** Fija el remitente del negocio (y la dirección de respuestas, si vino). */
export async function fijarRemitente(ws: number, p: PedidoRemitente): Promise<{ ok: true; from: string; responderA: string | null } | Falla> {
  const listo = await prepararRemitente(ws, p);
  if (!listo.ok) return listo;
  await setSetting('resend_from', listo.from);
  if (listo.responderA !== undefined) await setSetting(KEY_RESPONDER_A, listo.responderA ?? '');
  const responderA = listo.responderA !== undefined ? listo.responderA : sanearResponderA(await getSetting(KEY_RESPONDER_A));
  return { ok: true, from: listo.from, responderA };
}

/**
 * ADÓNDE VAN LAS RESPUESTAS de los emails del negocio (el `reply_to` del motor y de los broadcasts). `undefined` si no hay
 * una válida. Tolerante a propósito: no poder leerla no frena un envío, sale sin `reply_to` (las respuestas van al
 * remitente, que es lo de antes del 4/11).
 */
export async function responderADelNegocio(): Promise<string | undefined> {
  try {
    return sanearResponderA(await getSetting(KEY_RESPONDER_A)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Prende o apaga el envío real. Prenderlo exige el email conectado; apagarlo siempre se puede. */
export async function cambiarEnvio(on: boolean): Promise<{ ok: true } | Falla> {
  if (on && !(await emailConectado())) return falla('Primero verifica tu dominio y configura el remitente.', 400);
  await setEnvioEmail(on);
  return { ok: true };
}

/** Limpia SÓLO la config del negocio; el dominio y el webhook siguen en su cuenta de Resend (borrarlos allá es a mano). */
export async function desconectarDominio(): Promise<void> {
  await setSetting('resend_domain', '');
  await setSetting('resend_domain_id', '');
  await setSetting('resend_from', '');
  await setSetting(KEY_RESPONDER_A, '');
  await setEnvioEmail(false);
}
