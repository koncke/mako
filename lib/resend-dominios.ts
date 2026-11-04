// =============================================================================
// resend-dominios — dar de alta, leer y verificar el dominio de envío de un negocio, con la clave que ADMINISTRA (4/11/2026)
// =============================================================================
// El Cerebro midió ese día desde la PC: la key de Resend con que MaKo MANDA en producción es de SÓLO ENVÍO (la fila del ws1,
// que el arranque pone en el entorno) y el plan de la cuenta tiene un dominio. Con esa key, `conectar_dominio_email` le
// contestaba a Mauricio «La key de correo de MaKo sólo puede enviar» (#875). El encargo fue no subirle el permiso a la que
// manda, y separarlas:
//   · MANDAR (lib/resend.ts, `sendEmail`) sigue con su key de sólo envío, como siempre.
//   · ADMINISTRAR DOMINIOS (este módulo) usa `RESEND_ADMIN_API_KEY`, una variable de entorno de Vercel. La carga Martín.
//
// ⚠️ LA CLAVE DE ADMINISTRACIÓN NO SALE DE ACÁ. Se lee de `process.env` en `claveDeDominios` (privada) y sólo arma el
// `Authorization` de un pedido a /domains. No está en el catálogo de credenciales (lib/metodo-catalogo.ts), a propósito: lo
// que está ahí lo hidrata el arranque desde la fila del ws1, que es un CLIENTE, y lo puede pegar quien edita esa fila. Sin
// la variable, nada se crea: `puedeAdministrarDominios()` frena el alta en `preparar` (lib/email-dominio.ts).
//
// ⚠️ Y LA EXCEPCIÓN ES LA DE SIEMPRE (Opción B): un negocio con SU PROPIA key de Resend (distinta de la de la plataforma)
// tiene el dominio en SU cuenta, y lo administra con la suya; es la que manda sus emails. La del ws1 no es propia: es la de
// la plataforma (`esDeLaPlataforma`), así que Mauricio va por la de administración. «No pude leer» la key del negocio NO
// cae a la de MaKo: daría de alta su dominio en otra cuenta. Lo fija tests/resend-clave-admin.test.ts.
//
// POST /domains crea el dominio y devuelve los registros DNS (DKIM/SPF) que el cliente carga en su proveedor. GET
// /domains/{id} da el estado; POST /domains/{id}/verify dispara la verificación; PATCH /domains/{id} prende el seguimiento.
// =============================================================================

import 'server-only';
import { credDelClienteEstricta, esDeLaPlataforma } from './credenciales';
import { getWorkspaceActual } from './workspace';
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

export type DomainResult = { ok: true; domain: ResendDomain } | { ok: false; error: string };

type Clave = { key: string; deMako: boolean } | { sinClave: true } | { noPudeLeer: string };

/**
 * CON QUÉ CLAVE se administra el dominio del negocio del contexto. La suya si tiene una PROPIA (Opción B); si no, la de
 * administración de MaKo. Privada: la clave no sale de este módulo.
 */
async function claveDeDominios(): Promise<Clave> {
  let ws: number | null = null;
  try { ws = await getWorkspaceActual(); } catch { ws = null; }
  if (ws != null) {
    try {
      const propia = await credDelClienteEstricta('RESEND_API_KEY', ws, { ilegibleTira: true });
      if (propia && !(await esDeLaPlataforma('RESEND_API_KEY', propia))) return { key: propia, deMako: false };
    } catch (e) {
      return { noPudeLeer: e instanceof Error ? e.message : String(e) };
    }
  }
  const admin = process.env[VARIABLE_ADMIN]?.trim();
  return admin ? { key: admin, deMako: true } : { sinClave: true };
}

/** ¿Hay con qué dar de alta y verificar un dominio? Lo pregunta `preparar` antes de proponer nada. No dice cuál. */
export async function puedeAdministrarDominios(): Promise<boolean> {
  return 'key' in (await claveDeDominios());
}

type Respuesta = { ok: boolean; status: number; body: unknown; deMako?: boolean };

async function resendFetch(path: string, init?: RequestInit): Promise<Respuesta> {
  const c = await claveDeDominios();
  if ('sinClave' in c) return { ok: false, status: 0, body: { name: 'sin_clave_de_dominios', message: SIN_CLAVE_DE_DOMINIOS } };
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
  if (!r.ok) return { ok: false, error: errorDeResend(r, `Resend ${r.status}`) };
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
