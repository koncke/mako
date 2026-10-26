// =============================================================================
// /api/zernio — conectar redes vía Zernio y la cuenta de Instagram o Messenger de un negocio
// =============================================================================
// Lo usan: el bloque «Redes» del modal de Zernio de /integraciones, `ConectarViaZernio` (Ads Manager, Chats, Automations) y el
// editor de las tarjetas INSTAGRAM y MESSENGER (app/automations/EditorMensajeSocial.tsx) para decir desde qué cuenta sale el
// mensaje. Sólo el admin del workspace. SIEMPRE con la key de Zernio DEL NEGOCIO (23/10/2026: sin respaldo de la plataforma).
//
//   POST { action: 'conectar', plataforma, volver, modo?, reconectarId?, adAccountId?, pageId? } → RespuestaConectar (lib/zernio-redes.ts)
//        { ok: true, tipo: 'url', url } | { ok: true, tipo: 'ya-conectada', conexiones } | { ok: false, motivo, error, pagoUrl? }
//   POST { action: 'conexiones', plataforma? } → { ok: true, conexiones, total } | { ok: false, motivo, error, pagoUrl? }   (SOLO lectura)
//   POST { action: 'conectada' }               → { ok: true, ruteo, webhook }   (arma la recepción: ruteo de las cuentas y webhook)
//   POST { action: 'conectada-meta', accountId } → { ok: true, guardada }   (Meta por Zernio: guarda la conexión de anuncios en el negocio)
//   POST { action: 'estado', plataforma }      → { ok, cuentas: [{ id, usuario, nombre }], webhook }   (la cabecera de Automations)
//   Sin Zernio (no hay key propia)             → 'estado': { ok: true, configurado: false }; las demás: { ok: false, motivo: 'sin-clave' }
//   La key PROPIA no sirve (401 de Zernio)     → 'estado': { ok: false, motivo: 'key', error } (200)
//   La cuenta PROPIA está pausada (402)        → 'estado': { ok: false, motivo: 'pausada', error, billingUrl } (402)
//
// Un 4xx de Zernio NO es un 4xx de esta ruta: las acciones nuevas contestan 200 con `{ ok: false, motivo }` y la pantalla dice qué
// hacer con cada motivo (`MENSAJES_DE_MOTIVO`). `plataforma` es una red del catálogo (`REDES`): facebook, instagram, metaads…
//
// ⚠️ EL 401 Y EL 402 SE DICEN COMO LO QUE SON. Hasta el 12/10/2026 todo 4xx llegaba como «Zernio no contestó»: ws11 (cuenta pausada
// por falta de pago, medido el 10/10) veía un error que no decía de quién era ni cómo se arreglaba (AGENTS.md: el error de un
// tercero dice las dos cosas). Y desde el 23/10/2026 no hay key de la plataforma para un negocio, así que el 401/402 es siempre
// de SU cuenta (el ws1, que sigue en el modo de la cuenta de la casa hasta que se le saque la key, no entra en esto).
// ⚠️ El link de pago de Zernio es `dashboard_url` (el 402 `free_tier_exceeded`); hasta el 23/10 acá se leía `billingUrl`, que NO existe
// en su doc, y el negocio veía «pausada» sin link (`urlDePagoDeZernio`).
//
// ⚠️ «ESTADO» TAMBIÉN DEJA ANDANDO LA RECEPCIÓN, a propósito: reclama el ruteo de cada cuenta (un comentario trae sólo la cuenta,
// no el profile) y registra el webhook en la cuenta de Zernio del negocio (`asegurarWebhook`). Las dos cosas son idempotentes.
// Medido el 09/10/2026: los dos negocios con Zernio tenían key propia y NUNCA habían recibido un evento — sin un webhook en SU
// cuenta, no llega nada y no da error. Es un POST, no un GET: escribe afuera. `conectada` hace lo mismo, UNA vez, al quedar
// conectada una cuenta (lib/zernio-conectar.ts, `recibirConexion`); `conexiones` NO escribe nada.

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { cuentasConectadas, asegurarWebhook, usaCuentaPropia, zernioConfigurado, ZernioError } from '@/lib/zernio';
import { conexionesViaZernio, motivoDeError, recibirConexion, urlConectarViaZernio } from '@/lib/zernio-conectar';
import { esRedZernio, urlDePagoDeZernio } from '@/lib/zernio-redes';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Los textos de la pantalla (los mismos de app/automations/ConectarMedio.tsx: el test los compara). */
const ZERNIO_KEY_MALA = 'Tu key de Zernio no sirve';
const ZERNIO_PAUSADA = 'Tu cuenta de Zernio está pausada';

type Cuerpo = { action?: unknown; plataforma?: unknown; volver?: unknown; modo?: unknown; reconectarId?: unknown; adAccountId?: unknown; pageId?: unknown; flujo?: unknown; accountId?: unknown };

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace' }, { status: 403 });
  let body: Cuerpo;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  // `null`, un número o un texto son JSON válidos: sin esto `body.action` tira un TypeError (500) en vez de un 400.
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });

  // ── Meta por Zernio (25/10/2026): quedó conectada una cuenta de ANUNCIOS desde cualquier botón (el modal de Meta, la tarjeta de
  // Zernio, el Media Buyer). Se guarda en el negocio (lib/meta-conexion-zernio.ts) para que MaKo lea, publique y mande CAPI por
  // ahí; sin esto sólo la guardaba el modal de Meta, y conectar desde la tarjeta de Zernio no cambiaba nada. Con Zernio todavía
  // cerrado para el negocio no guarda nada (`guardada: false`), y eso no es un error.
  if (body.action === 'conectada-meta') {
    if (typeof body.accountId !== 'string') return Response.json({ ok: false, error: 'falta la conexión' }, { status: 400 });
    const { MetaZernioError, guardarConexionMetaPorZernio } = await import('@/lib/meta-conexion-zernio');
    const { zernioMetaActivo } = await import('@/lib/meta-via');
    if (!(await zernioMetaActivo(ws))) return Response.json({ ok: true, guardada: false });
    try {
      const sesion = await getUsuarioActual();
      const autor = sesion ? (sesion.legacy ? sesion.sub : (sesion.email || sesion.sub)) : null;
      const r = await guardarConexionMetaPorZernio(ws, body.accountId, autor);
      return Response.json({ ok: true, guardada: true, conflictos: r.conflictos });
    } catch (e) {
      if (e instanceof MetaZernioError) return Response.json({ ok: false, error: e.message });
      console.error(`[api:zernio] conectada-meta ws${ws}: ${msg(e).slice(0, 300)}`);
      return Response.json({ ok: false, error: 'No pude guardar tu conexión de Facebook.' }, { status: 500 });
    }
  }

  // ── Las acciones de la pieza «Conectar vía Zernio» (lib/zernio-conectar.ts) ──
  if (body.action === 'conectar' || body.action === 'conexiones' || body.action === 'conectada') {
    const red = esRedZernio(body.plataforma) ? body.plataforma : null;
    if (body.action === 'conectar' && !red) return Response.json({ ok: false, error: 'plataforma inválida' }, { status: 400 });
    if (body.action === 'conexiones' && body.plataforma != null && !red) return Response.json({ ok: false, error: 'plataforma inválida' }, { status: 400 });
    try {
      if (body.action === 'conectar') {
        const r = await urlConectarViaZernio(ws, red!, String(body.volver ?? ''), {
          modo: body.modo === 'pagina' ? 'pagina' : 'ventana',
          reconectarId: typeof body.reconectarId === 'string' ? body.reconectarId : null,
          adAccountId: typeof body.adAccountId === 'string' ? body.adAccountId : null,
          pageId: typeof body.pageId === 'string' ? body.pageId : null,
          flujo: typeof body.flujo === 'string' ? body.flujo : null,
        });
        return Response.json(r);
      }
      if (body.action === 'conexiones') {
        const conexiones = await conexionesViaZernio(ws, red ?? undefined);
        return Response.json({ ok: true, conexiones, total: conexiones.length });
      }
      return Response.json({ ok: true, ...(await recibirConexion(ws)) });
    } catch (e) {
      const m = motivoDeError(e);
      if (m.motivo === 'error' || m.motivo === 'sin-red' || m.motivo === 'respuesta') console.error(`[api:zernio] ${String(body.action)} ws${ws}: ${msg(e).slice(0, 300)}`);
      return Response.json({ ok: false, motivo: m.motivo, error: m.message, ...(m.pagoUrl ? { pagoUrl: m.pagoUrl } : {}) });
    }
  }

  // ── «Estado»: las cuentas de Instagram o Messenger, para la cabecera de la tarjeta de Automations ──
  const plataforma = body.plataforma === 'facebook' ? 'facebook' : body.plataforma === 'instagram' ? 'instagram' : null;
  if (!plataforma) return Response.json({ ok: false, error: 'plataforma inválida' }, { status: 400 });
  if (body.action !== 'estado') return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  // «No pude leer tus credenciales» NO es «no tienes Zernio»: con eso la pantalla abre «pega tu key» y puede pisar una key buena.
  let configurado: boolean;
  try { configurado = await zernioConfigurado(ws); } catch (e) {
    console.error(`[api:zernio] credenciales ws${ws}: ${msg(e).slice(0, 200)}`);
    return Response.json({ ok: false, error: 'Zernio no contestó' }, { status: 502 });
  }
  if (!configurado) return Response.json({ ok: true, configurado: false, cuentas: [], webhook: null });

  try {
    const cuentas = await cuentasConectadas(ws, plataforma);
    // El webhook, sólo si hay algo que escuchar: sin cuenta no hay eventos.
    let webhook: string | null = null;
    if (cuentas.length) {
      try { webhook = await asegurarWebhook(ws); }
      catch (e) { console.error(`[api:zernio] webhook ws${ws}: ${msg(e)}`); webhook = 'error'; }
    }
    return Response.json({
      ok: true, configurado: true, webhook,
      cuentas: cuentas.map((a) => ({ id: a._id, usuario: a.username, nombre: a.displayName ?? a.username })),
    });
  } catch (e) {
    console.error(`[api:zernio] estado ws${ws}: ${msg(e)}`);
    // La key y la cuenta del NEGOCIO (ver la cabecera). «No pude saber si es propia» cae en el genérico.
    if (e instanceof ZernioError && (e.status === 401 || e.status === 402) && (await usaCuentaPropia(ws).catch(() => false))) {
      if (e.status === 401) return Response.json({ ok: false, motivo: 'key', error: ZERNIO_KEY_MALA });
      return Response.json({ ok: false, motivo: 'pausada', error: ZERNIO_PAUSADA, billingUrl: urlDePagoDeZernio(e.body) }, { status: 402 });
    }
    const status = e instanceof ZernioError && e.status >= 400 && e.status < 500 ? 200 : 502;
    return Response.json({ ok: false, error: 'Zernio no contestó' }, { status });
  }
}
