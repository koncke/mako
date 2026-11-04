// =============================================================================
// resend-dominios — dar de alta, leer y verificar el dominio de envío, y conectar el webhook, EN LA CUENTA DEL NEGOCIO
// =============================================================================
// Desde el 4/11/2026 (Martín: «Resend free permite hasta 3 dominios, pero eso lo trae cada user de mako») cada negocio
// tiene SU cuenta de Resend, y su dominio y su webhook viven ahí. Este módulo le habla a Resend con la clave de ESA cuenta
// (lib/email-cuenta.ts → `cuentaDeCorreo`):
//   · un NEGOCIO: su clave. Tiene que ser «Full access»: con una de sólo envío no se administran dominios, y se le dice
//     cuál crear (`KEY_SOLO_ENVIO_TUYA`). Sin cuenta propia, nada: la guía de `estado_email` le dice cómo conectarla.
//   · la PLATAFORMA: `RESEND_ADMIN_API_KEY`, la de administración de MaKo, que queda SÓLO para el dominio de MaKo (la que
//     MANDA en producción es de sólo envío: el Cerebro lo midió el 4/11). Es una variable de entorno de Vercel, fuera del
//     catálogo de credenciales a propósito: lo del catálogo lo hidrata el arranque y lo puede pegar quien edita una fila.
//
// ⚠️ LAS CLAVES NO SALEN DE ACÁ. Se leen en `claveDeCuenta` (privada) y sólo arman el `Authorization` de un pedido. Y «no
// pude leer» la del negocio NO cae a ninguna otra: daría de alta su dominio en otra cuenta. Lo fija
// tests/email-cuenta-propia.test.ts (y tests/resend-clave-admin.test.ts, que la de administración la nombre sólo acá).
//
// POST /domains crea el dominio y devuelve los registros DNS (DKIM/SPF) que el cliente carga en su proveedor. GET
// /domains/{id} da el estado; POST /domains/{id}/verify dispara la verificación; PATCH /domains/{id} prende el seguimiento.
// GET/POST /webhooks y GET/PATCH /webhooks/{id} (el contrato del SDK oficial resend@6.37.0, `Webhooks`: la documentación no
// se podía abrir desde la nube) conectan los eventos de su cuenta con MaKo.
// =============================================================================

import 'server-only';
import { cuentaDeCorreo } from './email-cuenta';
import { EVENTOS_DEL_WEBHOOK, sinCuentaParaOperar, type EstadoCuenta } from './email-cuenta-reglas';
import {
  esKeySoloEnvio, esTopeDeDominios, KEY_SOLO_ENVIO_DE_MAKO, KEY_SOLO_ENVIO_TUYA,
  SIN_CLAVE_DE_DOMINIOS, TOPE_DOMINIOS_DE_MAKO, TOPE_DOMINIOS_TUYO,
} from './resend-errores';

const API_BASE = 'https://api.resend.com';
const VARIABLE_ADMIN = 'RESEND_ADMIN_API_KEY';

export type ResendDnsRecord = {
  record: string;            // 'DKIM' | 'SPF' | ...
  name: string;              // host del registro
  type: string;              // 'TXT' | 'MX' | 'CNAME'
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;           // 'not_started' | 'pending' | 'verified' | 'failure'
};

export type ResendDomain = {
  id: string;
  name: string;
  status: string;            // 'not_started' | 'pending' | 'verified' | 'failure' | 'temporary_failure'
  region?: string;
  records: ResendDnsRecord[];
  /** El seguimiento de aperturas y de clics del dominio (`open_tracking` / `click_tracking`). Ausente = Resend no lo dijo. */
  openTracking?: boolean;
  clickTracking?: boolean;
};

/** `status`: lo que contestó Resend (404 = esa cuenta no tiene ese dominio: se dio de alta en otra). */
export type DomainResult = { ok: true; domain: ResendDomain } | { ok: false; error: string; status?: number };

type Clave =
  | { key: string; deMako: boolean }
  | { sinClave: true }                                       // la plataforma, sin la de administración de MaKo
  | { sinCuenta: Extract<EstadoCuenta, 'sin_cuenta' | 'la_de_mako'> }
  | { noPudeLeer: string };

/**
 * CON QUÉ CLAVE se administra la cuenta de correo del negocio del contexto: la suya, o la de administración de MaKo si es
 * la plataforma. Privada: la clave no sale de este módulo.
 */
async function claveDeCuenta(): Promise<Clave> {
  const c = await cuentaDeCorreo();
  if (c.tipo === 'propia') return { key: c.key, deMako: false };
  if (c.tipo === 'plataforma') {
    const admin = process.env[VARIABLE_ADMIN]?.trim();
    return admin ? { key: admin, deMako: true } : { sinClave: true };
  }
  if (c.tipo === 'no_pude_leer') return { noPudeLeer: c.error };
  return { sinCuenta: c.tipo };
}

/** Si se puede administrar la cuenta (dar de alta un dominio, verificarlo, conectar el webhook), o por qué no, en palabras. */
export type Administracion = { ok: true } | { ok: false; error: string; cuenta: EstadoCuenta | 'sin_clave_de_mako' };

/** Lo pregunta `preparar` antes de proponer nada (lib/email-dominio.ts). No dice cuál clave. */
export async function administracionDeLaCuenta(): Promise<Administracion> {
  const c = await claveDeCuenta();
  if ('key' in c) return { ok: true };
  if ('sinClave' in c) return { ok: false, error: SIN_CLAVE_DE_DOMINIOS, cuenta: 'sin_clave_de_mako' };
  if ('noPudeLeer' in c) return { ok: false, error: sinCuentaParaOperar('no_pude_leer'), cuenta: 'no_pude_leer' };
  return { ok: false, error: sinCuentaParaOperar(c.sinCuenta), cuenta: c.sinCuenta };
}

/** ¿Hay con qué administrar la cuenta del negocio? */
export async function puedeAdministrarDominios(): Promise<boolean> {
  return (await administracionDeLaCuenta()).ok;
}

type Respuesta = { ok: boolean; status: number; body: unknown; deMako?: boolean };

async function resendFetch(path: string, init?: RequestInit): Promise<Respuesta> {
  const c = await claveDeCuenta();
  if ('sinClave' in c) return { ok: false, status: 0, body: { name: 'sin_clave_de_dominios', message: SIN_CLAVE_DE_DOMINIOS } };
  if ('sinCuenta' in c) return { ok: false, status: 0, body: { name: 'sin_cuenta_propia', message: sinCuentaParaOperar(c.sinCuenta) } };
  if ('noPudeLeer' in c) return { ok: false, status: 0, body: { message: `No pude leer la clave de correo del negocio: ${c.noPudeLeer.slice(0, 120)}` } };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : {}; } catch { /* deja texto */ }
    return { ok: res.ok, status: res.status, body, deMako: c.deMako };
  } catch (err) {
    return { ok: false, status: 0, body: { message: err instanceof Error ? err.message : String(err) }, deMako: c.deMako };
  }
}

/**
 * EL ERROR DE UNA LLAMADA A /domains, EN PALABRAS (#875). Una key de sólo envío no es «Resend 401»: si es la de MaKo, el
 * problema es nuestro (y queda en el log, fuerte); si es la del negocio, se le dice cuál crear (lib/resend-errores.ts).
 */
function errorDeResend(r: Respuesta, fallback: string): string {
  if (esKeySoloEnvio(r.body)) {
    if (r.deMako) console.error(`[resend] la ${VARIABLE_ADMIN} es de sólo envío: no da de alta ni verifica dominios (#875, docs/hallazgos-comunicacion.md)`);
    return r.deMako ? KEY_SOLO_ENVIO_DE_MAKO : KEY_SOLO_ENVIO_TUYA;
  }
  return errMsg(r.body, fallback);
}

function errMsg(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body && 'message' in body) return String((body as { message?: unknown }).message);
  return typeof body === 'string' && body ? body.slice(0, 200) : fallback;
}

function parseDomain(body: unknown): ResendDomain | null {
  if (typeof body !== 'object' || !body || !('id' in body)) return null;
  const d = body as { id?: unknown; name?: unknown; status?: unknown; region?: unknown; records?: unknown; open_tracking?: unknown; click_tracking?: unknown };
  return {
    id: String(d.id ?? ''),
    name: String(d.name ?? ''),
    status: String(d.status ?? 'pending'),
    region: d.region ? String(d.region) : undefined,
    records: Array.isArray(d.records) ? (d.records as ResendDnsRecord[]) : [],
    ...(typeof d.open_tracking === 'boolean' ? { openTracking: d.open_tracking } : {}),
    ...(typeof d.click_tracking === 'boolean' ? { clickTracking: d.click_tracking } : {}),
  };
}

const REGIONES_VALIDAS = new Set(['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1']);

/**
 * PRENDE EL SEGUIMIENTO DE APERTURAS Y DE CLICS del dominio (4/11/2026, la campaña de Mauricio: «si ya lo abrió me lo pones
 * aquí»). Sin esto Resend no manda `email.opened` ni `email.clicked`, y el webhook no tiene nada que marcar: la columna
 * «Abrió» quedaría vacía para siempre, sin un error. Medido ese día: en hola-mako.com los dos estaban apagados.
 *
 * El contrato es el de la API de Resend (`PATCH /domains/{id}` con `open_tracking` y `click_tracking`, booleanos; contesta
 * `{ id, object: 'domain' }`), leído del SDK oficial (resend@6.37.0, `Domains.update`): la página de la documentación no se
 * podía abrir desde la nube. Se pide aunque ya estén prendidos: es idempotente. `{ ok: false }` lleva el motivo en palabras.
 */
export async function prenderSeguimiento(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await resendFetch(`/domains/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ open_tracking: true, click_tracking: true }),
  });
  return r.ok ? { ok: true } : { ok: false, error: errorDeResend(r, `Resend ${r.status}`) };
}

/** Lo que devuelve `createResendDomain`: el dominio y si se pudo prender el seguimiento (`true`, o el motivo). */
export type CreacionDominio = { ok: true; domain: ResendDomain; seguimiento: true | string } | { ok: false; error: string };

// Crea el dominio. Si ya existe en la cuenta (ej: re-conectar en la prueba E2E),
// lo busca en la lista y lo devuelve — idempotente para el onboarding. El caller
// (lib/email-dominio.ts) valida la TITULARIDAD por workspace antes de adoptarlo.
// El fallback por lista corre ante cualquier 4xx (no dependemos del wording del
// mensaje de error de Resend).
// ⚠️ Y SIEMPRE PRENDE EL SEGUIMIENTO (`prenderSeguimiento`), también al adoptar uno que ya estaba: un dominio dado de alta
// antes del 4/11 nace con los dos apagados. Si el seguimiento falla, el dominio queda igual y el motivo vuelve en `seguimiento`.
// ⚠️ Y SI EL RECHAZO ES EL TOPE DE DOMINIOS DEL PLAN (y el dominio no estaba ya en la cuenta), el error lo dice, sin culpar al
// dominio: el texto crudo de Resend se leía como «tu dominio no sirve».
export async function createResendDomain(name: string, region = 'sa-east-1'): Promise<CreacionDominio> {
  const reg = REGIONES_VALIDAS.has(region) ? region : 'sa-east-1';
  const r = await resendFetch('/domains', { method: 'POST', body: JSON.stringify({ name, region: reg, open_tracking: true, click_tracking: true }) });
  let creado: DomainResult;
  if (r.ok) {
    const d = parseDomain(r.body);
    creado = d ? { ok: true, domain: d } : { ok: false, error: 'Resend no devolvió el dominio' };
  } else {
    const tope = esTopeDeDominios(r.status, r.body);
    // El tope de la cuenta del NEGOCIO es suyo (su plan de Resend, gratis o no) y se le dice en palabras; el de MaKo, nuestro.
    if (tope) console.error(`[resend] el alta de ${name} chocó con el tope de dominios del plan (${r.deMako ? 'cuenta de MaKo' : 'cuenta del negocio'})`);
    creado = { ok: false, error: tope ? (r.deMako ? TOPE_DOMINIOS_DE_MAKO : TOPE_DOMINIOS_TUYO) : errorDeResend(r, `Resend ${r.status}`) };
    // 4xx → puede ser "ya existe": buscarlo por nombre en la cuenta.
    if (r.status >= 400 && r.status < 500) {
      const lista = await listResendDomains();
      if (lista.ok) {
        const existente = lista.domains.find((d) => d.name.toLowerCase() === name.toLowerCase());
        if (existente) creado = await getResendDomain(existente.id);
      }
    }
  }
  if (!creado.ok) return creado;
  const s = await prenderSeguimiento(creado.domain.id);
  return s.ok
    ? { ok: true, domain: { ...creado.domain, openTracking: true, clickTracking: true }, seguimiento: true }
    : { ok: true, domain: creado.domain, seguimiento: s.error };
}

export async function getResendDomain(id: string): Promise<DomainResult> {
  const r = await resendFetch(`/domains/${encodeURIComponent(id)}`);
  if (!r.ok) return { ok: false, error: errorDeResend(r, `Resend ${r.status}`), status: r.status };
  const d = parseDomain(r.body);
  return d ? { ok: true, domain: d } : { ok: false, error: 'respuesta inválida de Resend' };
}

// Dispara la verificación (Resend revisa los DNS). El estado nuevo se lee con
// getResendDomain — la verificación puede tardar minutos.
export async function verifyResendDomain(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await resendFetch(`/domains/${encodeURIComponent(id)}/verify`, { method: 'POST' });
  return r.ok ? { ok: true } : { ok: false, error: errorDeResend(r, `Resend ${r.status}`) };
}

export async function listResendDomains(): Promise<{ ok: true; domains: Array<{ id: string; name: string; status: string }> } | { ok: false; error: string }> {
  const r = await resendFetch('/domains');
  if (!r.ok) return { ok: false, error: errorDeResend(r, `Resend ${r.status}`) };
  const data = typeof r.body === 'object' && r.body && 'data' in r.body ? (r.body as { data?: unknown }).data : null;
  const arr = Array.isArray(data) ? data : [];
  return {
    ok: true,
    domains: arr.map((d) => ({
      id: String((d as { id?: unknown }).id ?? ''),
      name: String((d as { name?: unknown }).name ?? ''),
      status: String((d as { status?: unknown }).status ?? ''),
    })),
  };
}

/**
 * ¿Qué contesta Resend a la clave de la cuenta? 'ok' (administra), 'solo_envio' (#875: manda pero no administra),
 * 'invalida' (401 sin más), o null si no hay clave o no se pudo saber. Es el pedido más barato que la distingue
 * (GET /domains): lo usa la guía de `estado_email`.
 */
export async function probarClaveDeCuenta(): Promise<'ok' | 'solo_envio' | 'invalida' | null> {
  const r = await resendFetch('/domains');
  if (r.ok) return 'ok';
  if (esKeySoloEnvio(r.body)) return 'solo_envio';
  if (r.status === 401 || r.status === 403) return 'invalida';
  return null;
}

/** Lo que devuelve `asegurarWebhookDeCuenta`. El secreto NO sale de lib/email-dominio.ts: lo guarda y no lo devuelve nunca. */
export type WebhookDeCuenta =
  | { ok: true; plataforma: true }
  | { ok: true; plataforma?: false; id: string; secreto: string; creado: boolean }
  | { ok: false; error: string };

const leerTexto = (o: unknown, k: string): string => (typeof o === 'object' && o && typeof (o as Record<string, unknown>)[k] === 'string' ? String((o as Record<string, unknown>)[k]) : '');

/**
 * CONECTA LOS EVENTOS DE LA CUENTA DEL NEGOCIO CON MaKo (4/11/2026): un webhook en SU cuenta de Resend que apunta a `url`
 * (`urlWebhookDeCuenta`, con `?cuenta=<ws>`) y escucha lo que el webhook de MaKo maneja. Idempotente: si ya hay uno con esa
 * URL, lo reusa (lo prende y le pone los eventos si hace falta) y lee su secreto; si no, lo crea. La plataforma no lleva:
 * su cuenta es la de MaKo, que ya tiene el webhook de siempre.
 */
export async function asegurarWebhookDeCuenta(url: string): Promise<WebhookDeCuenta> {
  const c = await claveDeCuenta();
  if ('key' in c && c.deMako) return { ok: true, plataforma: true };
  const lista = await resendFetch('/webhooks');
  if (!lista.ok) return { ok: false, error: errorDeResend(lista, `Resend ${lista.status}`) };
  const data = typeof lista.body === 'object' && lista.body && 'data' in lista.body ? (lista.body as { data?: unknown }).data : null;
  const existente = (Array.isArray(data) ? data : []).find((w) => leerTexto(w, 'endpoint') === url);
  const eventos = [...EVENTOS_DEL_WEBHOOK];
  if (existente) {
    const id = leerTexto(existente, 'id');
    const uno = await resendFetch(`/webhooks/${encodeURIComponent(id)}`);
    if (!uno.ok) return { ok: false, error: errorDeResend(uno, `Resend ${uno.status}`) };
    const secreto = leerTexto(uno.body, 'signing_secret');
    if (!secreto) return { ok: false, error: 'Resend no devolvió el secreto del webhook.' };
    const ev = (uno.body as { events?: unknown }).events;
    const faltan = !Array.isArray(ev) || eventos.some((e) => !(ev as unknown[]).includes(e));
    if (leerTexto(uno.body, 'status') !== 'enabled' || faltan) {
      const p = await resendFetch(`/webhooks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'enabled', events: eventos }) });
      if (!p.ok) return { ok: false, error: errorDeResend(p, `Resend ${p.status}`) };
    }
    return { ok: true, id, secreto, creado: false };
  }
  const r = await resendFetch('/webhooks', { method: 'POST', body: JSON.stringify({ endpoint: url, events: eventos }) });
  if (!r.ok) return { ok: false, error: errorDeResend(r, `Resend ${r.status}`) };
  const id = leerTexto(r.body, 'id');
  const secreto = leerTexto(r.body, 'signing_secret');
  return id && secreto ? { ok: true, id, secreto, creado: true } : { ok: false, error: 'Resend no devolvió el webhook creado.' };
}
