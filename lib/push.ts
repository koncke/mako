// =============================================================================
// push — Web Push de MaKo Mobile: las claves VAPID y el envío (server-only)
// =============================================================================
// El diseño, en docs/diseno-mako-mobile.md («Push: a quién», «Push: qué», «Claves VAPID»).
// Lo que gobierna este módulo:
//
// 1. EL PAR VAPID VIVE EN UNA SOLA FILA de `credenciales` del workspace de PLATAFORMA
//    (`wsSuperAdmin()`), como JSON `{publicKey, privateKey}`. NUNCA `envCred` (resuelve contra
//    el ws1, que es un CLIENTE) ni variables de Vercel. Lo genera UNA vez
//    scripts/push-vapid-generar.mts. Este módulo NO lo genera NUNCA: dos instancias frías
//    generando a la vez partirían el par, y una fila ilegible (CREDENCIALES_SECRET distinto)
//    regenerada dejaría todas las suscripciones firmadas con una clave que ya no existe. Si
//    falta o no se lee: push APAGADO y un log fuerte.
//
// 2. LOS DESTINATARIOS SALEN DE `usuarios` DEL WORKSPACE DESTINO, al ENVIAR. Las
//    suscripciones están atadas a la PERSONA (`push_suscripciones.usuario_id`), nunca al
//    workspace de una pestaña, así que el workspace de una persona es siempre el vigente.
//
// 3. NUNCA LANZA. Un push es best-effort: un aviso que no llegó al teléfono no puede tumbar
//    el cron o el webhook que lo emitió. Devuelve un rastro ({enviados, fallidos,
//    sinSuscripciones, destinatarios, motivo}) para quien lo quiera loguear.
//
// ⚠️ NINGÚN `'use client'` IMPORTA ESTE MÓDULO (tests/frontera-use-client.test.ts): el lado
// del navegador es lib/push-cliente.ts.
//
// ── TTL y urgencia (RFC 8030) ───────────────────────────────────────────────
// TTL = cuántos SEGUNDOS guarda el servicio de push (FCM, Mozilla, Apple) un mensaje para un
// teléfono apagado o sin red. Pasado eso, lo descarta: un aviso viejo no tiene que aparecer
// horas después. Los valores de quien llama:
//   · avisos del catálogo  → 6 h  (21.600 s): un aviso del día sigue sirviendo a la tarde.
//   · «MaKo te pide confirmar» → lo que le queda a la pendiente, con techo de 2 h (vence ahí).
//   · «MaKo dejó algo para revisar» → 24 h: un borrador espera a que alguien lo mire.
//   · la prueba de /m/cuenta → 2 min: si no llegó ya, no sirve.
// Urgencia = cuánto puede apurarse el teléfono para entregarlo (en Android, despertarlo del
// modo de ahorro): 'high' sólo para lo que bloquea o arde (una pendiente, un semáforo rojo);
// 'normal' para el resto. Nunca 'very-low'/'low': un aviso que llega mañana no es un aviso.
// =============================================================================

import 'server-only';
import { after } from 'next/server';
import webpush from 'web-push';
import { getSupabaseServer } from './supabase';
import { credWsEstricta } from './credenciales';
import { wsSuperAdmin } from './workspace';
import { EMAIL_MAKO } from './app-url';
import { normalizarPush, quierePush, rolPushDeFila, PUSH_SOLO_ADMINS } from './notif-catalogo';
import { accionTrasError, armarPayloadPush, wsDelLink, type PayloadPush } from './push-payload';

export const CLAVE_VAPID = 'WEB_PUSH_VAPID';

export type Urgencia = 'very-low' | 'low' | 'normal' | 'high';

export type EntradaPush = {
  /** El tipo (`reunion-nuevo-agendado`, `mako-pendiente`…): decide la preferencia de cada persona. */
  tipo: string;
  titulo: string;
  /** El texto entero: lib/push-payload.ts lo reduce a una frase sin marcas. */
  cuerpo: string;
  /** Ruta de escritorio o móvil que abre al tocar; se traduce con `rutaMovilOHome`. */
  ruta?: string | null;
  tag?: string | null;
  /** Segundos que el servicio de push guarda el mensaje (ver la cabecera). Default 6 h. */
  ttl?: number;
  urgencia?: Urgencia;
  /** Sólo a los admin del workspace (además de lo que diga PUSH_SOLO_ADMINS). */
  soloAdmins?: boolean;
  badge?: number | null;
};

export type ResultadoPush = {
  /** Envíos que el servicio de push aceptó (uno por suscripción). */
  enviados: number;
  /** Envíos que fallaron (incluidas las suscripciones muertas que se borraron). */
  fallidos: number;
  /** Personas que lo querían y no tienen NINGÚN teléfono suscripto. */
  sinSuscripciones: number;
  /** Personas que lo querían (activas, con el rol y la preferencia). */
  destinatarios: number;
  /** Por qué no se intentó nada: sin claves, sin la tabla, o la lectura falló. */
  motivo?: 'sin-claves' | 'sin-tabla' | 'error';
};

const VACIO = (motivo?: ResultadoPush['motivo']): ResultadoPush => ({ enviados: 0, fallidos: 0, sinSuscripciones: 0, destinatarios: 0, ...(motivo ? { motivo } : {}) });

const TTL_DEFAULT = 6 * 3600;
/** Techo de un envío: el socket de web-push y, por las dudas, una carrera propia. */
const TIMEOUT_MS = 10_000;

// ── Las claves ──────────────────────────────────────────────────────────────

type Claves = { publicKey: string; privateKey: string };
type CacheVapid = { claves: Claves | null; hasta: number };
const g = globalThis as typeof globalThis & { __makoVapid?: CacheVapid };

/** Sin claves se re-pregunta al minuto: alguien puede estar corriendo el script de generación. */
const REINTENTO_SIN_CLAVES_MS = 60_000;

/**
 * El par VAPID, o `null` si no está o no se puede leer (push APAGADO). Se cachea en el
 * proceso: las claves no cambian, y un aviso por minuto no tiene que descifrar en cada uno.
 */
export async function clavesVapid(): Promise<Claves | null> {
  const ahora = Date.now();
  if (g.__makoVapid && g.__makoVapid.hasta > ahora) return g.__makoVapid.claves;
  let claves: Claves | null = null;
  try {
    const ws = await wsSuperAdmin();
    const crudo = await credWsEstricta(CLAVE_VAPID, ws);
    if (!crudo) {
      // `credWsEstricta` devuelve null tanto si la fila no está como si no se puede descifrar
      // (otro CREDENCIALES_SECRET). Las dos se arreglan igual: NO regenerando acá.
      console.error(`[push] ⛔ PUSH APAGADO: no hay ${CLAVE_VAPID} legible en el workspace de plataforma (ws ${ws}). Si falta, correr UNA vez scripts/push-vapid-generar.mts; si existe y no se lee, el CREDENCIALES_SECRET de este entorno no es el que la cifró. NO regenerarla: invalida todas las suscripciones.`);
    } else {
      const o = JSON.parse(crudo) as Partial<Claves>;
      if (typeof o.publicKey === 'string' && o.publicKey.length > 40 && typeof o.privateKey === 'string' && o.privateKey.length > 20) {
        claves = { publicKey: o.publicKey, privateKey: o.privateKey };
      } else {
        console.error(`[push] ⛔ PUSH APAGADO: ${CLAVE_VAPID} se descifró pero no trae {publicKey, privateKey}. NO regenerarla sin revisar la fila.`);
      }
    }
  } catch (e) {
    // La base no contestó: no se cachea largo, el próximo aviso vuelve a preguntar.
    console.error(`[push] no pude leer ${CLAVE_VAPID}:`, e instanceof Error ? e.message : String(e));
    g.__makoVapid = { claves: null, hasta: ahora + 10_000 };
    return null;
  }
  g.__makoVapid = { claves, hasta: claves ? Number.POSITIVE_INFINITY : ahora + REINTENTO_SIN_CLAVES_MS };
  return claves;
}

/** La clave PÚBLICA, para que el navegador se suscriba (GET /api/push/clave). */
export async function clavePublicaPush(): Promise<string | null> {
  return (await clavesVapid())?.publicKey ?? null;
}

// ── El envío ─────────────────────────────────────────────────────────────────

type FilaSuscripcion = { id: number; usuario_id: number; endpoint: string; p256dh: string; auth: string; fallos: number | null };

// La TABLA que falta (PGRST205 de PostgREST, 42P01 de Postgres), no una COLUMNA (42703 /
// PGRST204): una columna que falta es un bug nuestro y no se tolera como «sin tabla».
const esTablaAusente = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === 'PGRST205' || e.code === '42P01'
    || (/could not find the table|relation .* does not exist/i.test(String(e.message ?? '')) && /push_suscripciones/i.test(String(e.message ?? ''))));

/** Una promesa con techo: si no resuelve en `ms`, rechaza como un fallo de red. El timer se limpia. */
function conTope<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(Object.assign(new Error(`sin respuesta en ${ms} ms`), { statusCode: null })), ms);
    (t as { unref?: () => void }).unref?.();
  });
  return Promise.race([p, tope]).finally(() => { if (t) clearTimeout(t); });
}

/** Manda `payload` a cada suscripción y deja el rastro en la fila. Nunca lanza. */
async function despachar(subs: FilaSuscripcion[], payload: PayloadPush, e: EntradaPush, claves: Claves): Promise<{ enviados: number; fallidos: number }> {
  const db = getSupabaseServer();
  const cuerpo = JSON.stringify(payload);
  const opciones = {
    TTL: Math.max(0, Math.floor(e.ttl ?? TTL_DEFAULT)),
    urgency: e.urgencia ?? 'normal',
    timeout: TIMEOUT_MS,
    vapidDetails: { subject: `mailto:${EMAIL_MAKO}`, publicKey: claves.publicKey, privateKey: claves.privateKey },
  } as const;
  const resultados = await Promise.allSettled(subs.map((s) => conTope(
    webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, opciones),
    TIMEOUT_MS + 2_000,
  )));
  let enviados = 0; let fallidos = 0;
  await Promise.allSettled(resultados.map(async (r, i) => {
    const s = subs[i];
    if (r.status === 'fulfilled') {
      enviados += 1;
      await db.from('push_suscripciones').update({ last_ok_at: new Date().toISOString(), fallos: 0, ultimo_error: null }).eq('id', s.id);
      return;
    }
    fallidos += 1;
    const err = r.reason as { statusCode?: number | null; body?: string; message?: string };
    const status = typeof err?.statusCode === 'number' ? err.statusCode : null;
    if (accionTrasError(status) === 'borrar') {
      await db.from('push_suscripciones').delete().eq('id', s.id);
      return;
    }
    const motivo = `${status ?? 'red'}: ${String(err?.body || err?.message || 'sin detalle').replace(/\s+/g, ' ')}`.slice(0, 300);
    console.warn(`[push] ${e.tipo}: falló el envío a la suscripción #${s.id} (${motivo})`);
    await db.from('push_suscripciones').update({ fallos: (s.fallos ?? 0) + 1, ultimo_error: motivo }).eq('id', s.id);
  }));
  return { enviados, fallidos };
}

/**
 * Manda un push a las PERSONAS del workspace `ws` que lo quieren: usuarios no suspendidos
 * de ese workspace, con el rol que corresponde y la preferencia `notifPush` prendida para
 * este tipo. `ws` es el workspace DESTINO —el de los datos del aviso, o `wsSuperAdmin()` si
 * el aviso es para el dueño—, nunca el de la pestaña de nadie.
 */
export async function enviarPush(ws: number, e: EntradaPush): Promise<ResultadoPush> {
  try {
    const claves = await clavesVapid();
    if (!claves) return VACIO('sin-claves');
    const db = getSupabaseServer();

    const { data: filas, error: errU } = await db.from('usuarios')
      .select('id, rol, rol_ws, perfil, estado').eq('workspace_id', ws).neq('estado', 'suspendido');
    if (errU) { console.error(`[push] ${e.tipo}: no pude leer las personas del ws ${ws}:`, errU.message); return VACIO('error'); }

    const soloAdmins = e.soloAdmins === true || PUSH_SOLO_ADMINS.has(e.tipo);
    const quienes = ((filas ?? []) as Array<{ id: number; rol: string | null; rol_ws: string | null; perfil: unknown }>).filter((u) => {
      const rol = rolPushDeFila(u);
      if (soloAdmins && rol !== 'admin') return false;
      const perfil = (u.perfil && typeof u.perfil === 'object' ? u.perfil : {}) as Record<string, unknown>;
      return quierePush(normalizarPush(perfil.notifPush, rol), e.tipo);
    });
    if (!quienes.length) return VACIO();

    const ids = quienes.map((u) => Number(u.id));
    const { data: subsRaw, error: errS } = await db.from('push_suscripciones')
      .select('id, usuario_id, endpoint, p256dh, auth, fallos').in('usuario_id', ids);
    if (errS) {
      if (esTablaAusente(errS)) { console.error('[push] ⛔ falta la tabla push_suscripciones (mig 0249): no se manda nada.'); return { ...VACIO('sin-tabla'), destinatarios: ids.length }; }
      console.error(`[push] ${e.tipo}: no pude leer las suscripciones:`, errS.message);
      return { ...VACIO('error'), destinatarios: ids.length };
    }
    const subs = (subsRaw ?? []) as FilaSuscripcion[];
    const conTelefono = new Set(subs.map((s) => Number(s.usuario_id)));
    const sinSuscripciones = ids.filter((id) => !conTelefono.has(id)).length;
    if (!subs.length) return { enviados: 0, fallidos: 0, sinSuscripciones, destinatarios: ids.length };

    // El link va SIN `?ws=` cuando el destino es el workspace de plataforma (`wsDelLink`).
    const payload = armarPayloadPush({ tipo: e.tipo, titulo: e.titulo, cuerpo: e.cuerpo, ruta: e.ruta, tag: e.tag, badge: e.badge }, wsDelLink(ws, await wsSuperAdmin().catch(() => null)));
    const r = await despachar(subs, payload, e, claves);
    return { ...r, sinSuscripciones, destinatarios: ids.length };
  } catch (err) {
    console.error(`[push] ${e.tipo}: enviarPush(ws ${ws}) falló:`, err instanceof Error ? err.message : String(err));
    return VACIO('error');
  }
}

/**
 * Un push a UNA persona, a todos sus teléfonos, SIN mirar su preferencia: es lo que ella
 * misma pidió (el «Probar» de /m/cuenta). El link abre en SU workspace.
 */
export async function enviarPushAUsuario(usuarioId: number, ws: number | null, e: EntradaPush): Promise<ResultadoPush> {
  try {
    const claves = await clavesVapid();
    if (!claves) return { ...VACIO('sin-claves'), destinatarios: 1 };
    const { data, error } = await getSupabaseServer().from('push_suscripciones')
      .select('id, usuario_id, endpoint, p256dh, auth, fallos').eq('usuario_id', usuarioId);
    if (error) return { ...VACIO(esTablaAusente(error) ? 'sin-tabla' : 'error'), destinatarios: 1 };
    const subs = (data ?? []) as FilaSuscripcion[];
    if (!subs.length) return { enviados: 0, fallidos: 0, sinSuscripciones: 1, destinatarios: 1 };
    const payload = armarPayloadPush({ tipo: e.tipo, titulo: e.titulo, cuerpo: e.cuerpo, ruta: e.ruta, tag: e.tag, badge: e.badge }, wsDelLink(ws, await wsSuperAdmin().catch(() => null)));
    const r = await despachar(subs, payload, e, claves);
    return { ...r, sinSuscripciones: 0, destinatarios: 1 };
  } catch (err) {
    console.error(`[push] enviarPushAUsuario(${usuarioId}) falló:`, err instanceof Error ? err.message : String(err));
    return { ...VACIO('error'), destinatarios: 1 };
  }
}

/**
 * El push DESPUÉS de la respuesta (`after`), para los que crean algo en medio de un pedido
 * que no tiene por qué esperar al servicio de push (una pendiente, una propuesta). Sin
 * pedido en curso —un script— `after` tira y se manda en línea.
 *
 * `sigueVigente` se pregunta JUSTO ANTES de mandar: una pendiente o una propuesta que se
 * confirmó en el mismo pedido (un token con escritura directa por /api/v1) ya no espera a
 * nadie, y un «MaKo te pide confirmar» sobre algo hecho es una alarma falsa.
 */
export async function pushPorDetras(ws: number, e: EntradaPush, sigueVigente?: () => Promise<boolean>): Promise<void> {
  const trabajo = async () => {
    try {
      if (sigueVigente && !(await sigueVigente())) return;
      const r = await enviarPush(ws, e);
      if (r.fallidos || r.motivo) console.warn(`[push] ${e.tipo} (ws ${ws}): ${JSON.stringify(r)}`);
    } catch (err) {
      console.error(`[push] ${e.tipo} por detrás falló:`, err instanceof Error ? err.message : String(err));
    }
  };
  try {
    after(trabajo);
    return;
  } catch { /* sin pedido en curso (un script): en línea */ }
  await trabajo();
}
