// =============================================================================
// Webhook: Zernio → Instagram y Messenger como canales de las automatizaciones
// =============================================================================
// Historia: hasta el 06/10/2026 era el receptor de la tab Instagram (DMs, posts, cuentas); ese día
// Instagram salió del producto y esta ruta pasó a contestar 200 sin procesar nada. El 09/10/2026
// Martín decidió que vuelve como CANAL de /chatbot, con Messenger (sexta tanda, CRON 4-7): esta ruta
// vuelve a procesar, ahora para disparar automatizaciones.
//
// El orden, y cada paso tiene su porqué:
//   1. LA FIRMA, sobre el body CRUDO y antes de parsear: `X-Zernio-Signature` = HMAC-SHA256 hex del
//      body con `ZERNIO_WEBHOOK_SECRET` (el que MaKo le da a Zernio al registrar el webhook:
//      `asegurarWebhook`, lib/zernio.ts). Fail-CLOSED: sin secreto o sin firma, 401.
//   2. DE QUIÉN ES, con la lectura ESTRICTA (AGENTS.md): por el profile (`account.profileId`, lo acuña
//      el server) y, si el evento no lo trae —un `comment.received` trae SÓLO `account.accountId`—, por
//      la cuenta conectada (`zernio_cuenta`, la reclama `cuentasConectadas`). «No pude leer» va por
//      `responderFalloDeRuteo` (503 si reintentar lo arregla); «no es de nadie», 200 y un aviso en el
//      log: reintentar no lo va a atribuir mejor.
//   3. UNA VEZ POR EVENTO: el id del evento (`payload.id`, igual a `X-Zernio-Event-Id` y el mismo en
//      cada reintento) se reclama en `zernio_eventos` (mig 0242). Zernio entrega «at-least-once» y
//      reintenta hasta 7 veces: sin esto, una reentrega le manda otro DM al lead.
//   4. LO RÁPIDO adentro del pedido (la persona, el mensaje, el lead) y LO LENTO después (`after`):
//      Zernio corta a los 5 s, y disparar una automatización manda el primer mensaje en el acto. Si lo
//      rápido falla, se SUELTA el reclamo y se contesta 500: el reintento lo vuelve a intentar entero.
//
// Lo que NO hace, a propósito: pausar la salida cuando la persona contesta (ver lib/zernio-entrante.ts)
// ni guardar lo que manda el negocio (`message.sent`): lo que le llegó a cada lead ya está en
// `nutricion_envios.texto_enviado`.

import { after, type NextRequest } from 'next/server';
import { verificarFirmaZernio } from '@/lib/zernio-firma';
import { envCred } from '@/lib/credenciales';
import { wsPorIdentificadorEstricto, upsertRouting } from '@/lib/webhook-routing';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { eventoSocialDe } from '@/lib/canal-social';
import { procesarEventoSocial, dispararEventoSocial } from '@/lib/zernio-entrante';
import { RUTEO_CUENTA, RUTEO_PERFIL, EVENTOS_WEBHOOK } from '@/lib/zernio';

export const dynamic = 'force-dynamic';
// El primer mensaje de la automatización sale en `after`, después de contestar.
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lo que este webhook procesa: lo MISMO que se suscribe (`EVENTOS_WEBHOOK`). El resto, 200 y al log. */
const EVENTOS: ReadonlySet<string> = new Set(EVENTOS_WEBHOOK);

type Cuerpo = { id?: unknown; event?: unknown; account?: { profileId?: unknown; accountId?: unknown; id?: unknown } | null };
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);

export async function GET() {
  return Response.json({ ok: true, endpoint: 'zernio webhook', usage: 'POST con X-Zernio-Signature' });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const raw = await req.text();
  const secret = await envCred('ZERNIO_WEBHOOK_SECRET');
  const firma = req.headers.get('x-zernio-signature') ?? req.headers.get('x-late-signature');
  if (!verificarFirmaZernio(raw, firma, secret)) {
    console.warn(`[webhook:zernio] firma rechazada (secreto ${secret ? 'configurado' : 'AUSENTE'})`);
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }

  let body: Cuerpo;
  try {
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== 'object') throw new Error('no es un objeto');
    body = p as Cuerpo;
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  const evento = texto(body.event) ?? '—';
  const eventoId = texto(body.id) ?? texto(req.headers.get('x-zernio-event-id'));
  if (!EVENTOS.has(evento)) {
    console.info(`[webhook:zernio] ${evento}: no lo procesa el canal`);
    return Response.json({ ok: true, event: evento, ignored: 'evento' });
  }
  if (!eventoId) return Response.json({ ok: true, event: evento, ignored: 'sin id de evento' });

  // ── 2. De quién es: ESTRICTO ──
  const perfil = texto(body.account?.profileId);
  const cuenta = texto(body.account?.accountId) ?? texto(body.account?.id);
  let ws: number | null = null;
  try {
    if (perfil) ws = await wsPorIdentificadorEstricto(RUTEO_PERFIL, perfil);
    if (ws == null && cuenta) ws = await wsPorIdentificadorEstricto(RUTEO_CUENTA, cuenta);
  } catch (err) {
    return responderFalloDeRuteo('zernio', err, perfil ?? cuenta);
  }
  if (ws == null) {
    console.warn(`[webhook:zernio] ${evento} sin workspace (profile ${perfil ?? '—'}, cuenta ${cuenta ?? '—'}): ignorado`);
    return Response.json({ ok: true, event: evento, ignored: 'sin workspace' });
  }
  const wsFinal = ws;

  // ── 3. Una vez por evento ──
  const db = getSupabaseServer();
  const { data: reclamo, error: errReclamo } = await db.from('zernio_eventos')
    .upsert({ evento_id: eventoId, evento }, { onConflict: 'evento_id', ignoreDuplicates: true })
    .select('evento_id');
  if (errReclamo) {
    console.error(`[webhook:zernio] no pude reclamar el evento ${eventoId}: ${errReclamo.message}`);
    return Response.json({ ok: false, error: 'dedup', message: errReclamo.message }, { status: 500 });
  }
  if (!(reclamo ?? []).length) return Response.json({ ok: true, event: evento, dedup: true });
  const soltar = async () => { await db.from('zernio_eventos').delete().eq('evento_id', eventoId).then(() => undefined, () => undefined); };

  // Llegó un evento ruteado: el webhook de este workspace anda (lo lee /integraciones).
  await db.from('zernio_workspace').update({ webhook_ok: true }).eq('workspace_id', wsFinal).then(() => undefined, () => undefined);

  try {
    return await runWithWorkspace(wsFinal, async () => {
      if (evento === 'account.connected') {
        // Una cuenta nueva: se reclama su ruteo, para que sus comentarios tengan de quién ser.
        if (cuenta) await upsertRouting(RUTEO_CUENTA, cuenta, wsFinal);
        return Response.json({ ok: true, event: evento, accion: 'cuenta_conectada' });
      }
      const ev = eventoSocialDe(body);
      if ('ignorar' in ev) return Response.json({ ok: true, event: evento, ignored: ev.ignorar });
      const r = await procesarEventoSocial(ev.evento, body);
      if (r.disparar && r.leadId != null) {
        const leadId = r.leadId;
        const { canal, subtipo, texto: t, ref, anuncioId, postId, comentarioId } = ev.evento;
        // `after` corre FUERA del contexto del pedido: el workspace se vuelve a fijar adentro.
        after(async () => {
          try {
            const n = await runWithWorkspace(wsFinal, () => dispararEventoSocial(leadId, canal, { subtipo, texto: t, ref, anuncioId, postId, comentarioId }));
            console.log(`[webhook:zernio] ${canal}/${subtipo} lead ${leadId} ws=${wsFinal}: ${n} automatización(es)`);
          } catch (e) {
            console.error(`[webhook:zernio] disparar ${canal}/${subtipo} lead ${leadId}: ${msg(e)}`);
          }
        });
      }
      console.log(`[webhook:zernio] ${evento} ws=${wsFinal} accion=${r.accion} ms=${Date.now() - t0}`);
      return Response.json({ ok: true, event: evento, accion: r.accion });
    });
  } catch (e) {
    // Lo rápido falló (la base): se suelta el reclamo y Zernio reintenta el evento entero.
    await soltar();
    console.error(`[webhook:zernio] procesando ${evento} (${eventoId}): ${msg(e)}`);
    return Response.json({ ok: false, error: 'processing', message: msg(e), event: evento }, { status: 500 });
  }
}
