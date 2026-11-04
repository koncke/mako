// =============================================================================
// email-dominio — conectar el dominio de envío de un negocio y fijar su remitente (una puerta, dos entradas)
// =============================================================================
// 4/11/2026: Martín le explicó a Mauricio (ws 1, un cliente) cómo armar desde su Claude, con la API de MaKo, una campaña
// de 14 emails a sus leads. Lo primero que pide esa receta es su dominio, y hasta ese día eso vivía SÓLO adentro de
// app/api/email/dominio/route.ts: la API no tenía cómo conectarlo ni cómo fijar el «De». Ahora la lógica vive acá y la
// usan las dos entradas: la pantalla de /email (la ruta) y la API (`conectar_dominio_email`, `fijar_remitente_email`).
//
// Opción A: la cuenta de Resend es la de MaKo; cada negocio da de alta y verifica SU dominio adentro. El estado vive en
// `app_settings` del negocio del CONTEXTO (quien llama corre adentro de `runWithWorkspace`):
//   resend_domain     → el nombre del dominio
//   resend_domain_id  → el id del dominio en Resend
//   resend_from       → el remitente («Nombre <hola@dominio.com>»)
//   resend_reply_to   → adónde van las RESPUESTAS de los leads (4/11/2026, «que te envíe a tu email personal»)
//
// ⚠️ NUNCA la key de Resend del negocio: la fila del ws 1 es la de la PLATAFORMA (lib/credenciales.ts), y una key de
// Mauricio ahí desviaría los avisos de MaKo a su cuenta. Su email sale de SU dominio, verificado en la cuenta de MaKo.
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

export type Falla = { ok: false; error: string; status: number };
const falla = (error: string, status: number): Falla => ({ ok: false, error, status });

/**
 * TITULARIDAD (anti-spoofing entre negocios): con la cuenta única de Resend, un dominio de un negocio B no lo puede
 * adoptar el A. Lo reclama el `resend_domain` de cada negocio: consulta entre workspaces a propósito (`getSupabaseServer`),
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
  const previo = (await getSettingEstricto('resend_domain'))?.trim() || null;
  return { ok: true, dominio, reemplaza: previo && previo !== dominio ? previo : null };
}

export type Conexion = { ok: true; dominio: string; estado: string; registros: RegistroDns[]; seguimiento: true | string };

/**
 * DA DE ALTA EL DOMINIO del negocio en la cuenta de Resend de MaKo y lo guarda. Devuelve los registros DNS que hay que
 * cargar en el proveedor del dominio. Si ya estaba en la cuenta (volver a conectarlo), lo adopta: es idempotente.
 * `seguimiento`: `true` si quedaron prendidas las aperturas y los clics, o el motivo por el que no.
 */
export async function conectarDominio(ws: number, raw: unknown): Promise<Conexion | Falla> {
  const p = await prepararConexion(ws, raw);
  if (!p.ok) return p;
  const r = await createResendDomain(p.dominio, 'sa-east-1');
  if (!r.ok) return falla(r.error, 502);
  await setSetting('resend_domain', r.domain.name);
  await setSetting('resend_domain_id', r.domain.id);
  return { ok: true, dominio: r.domain.name, estado: r.domain.status, registros: registrosParaCargar(r.domain.records), seguimiento: r.seguimiento };
}

/**
 * Le pide a Resend que revise los DNS del dominio cargado. De paso, si el dominio tiene apagado el seguimiento de
 * aperturas o de clics (uno dado de alta antes del 4/11/2026), lo prende.
 */
export async function verificarDominio(): Promise<{ ok: true; dominio: string | null; estado: string | null; registros: RegistroDns[]; seguimiento: true | string | null } | Falla> {
  const id = (await getSettingEstricto('resend_domain_id'))?.trim();
  if (!id) return falla('Primero agrega tu dominio.', 400);
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

/** Limpia SÓLO la config del negocio; el dominio sigue en la cuenta de Resend (borrarlo allá es a mano). */
export async function desconectarDominio(): Promise<void> {
  await setSetting('resend_domain', '');
  await setSetting('resend_domain_id', '');
  await setSetting('resend_from', '');
  await setSetting(KEY_RESPONDER_A, '');
  await setEnvioEmail(false);
}
