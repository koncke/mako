// =============================================================================
// Webhook: Zernio → Instagram y Messenger como canales de las automatizaciones
// =============================================================================
// Historia: hasta el 06/10/2026 era el receptor de la tab Instagram (DMs, posts, cuentas); ese día
// Instagram salió del producto y esta ruta pasó a contestar 200 sin procesar nada. El 09/10/2026
// Martín decidió que vuelve como CANAL de /automations, con Messenger (sexta tanda, CRON 4-7): esta ruta
// vuelve a procesar, ahora para disparar automatizaciones.
//
// El orden, y cada paso tiene su porqué:
//   1. LA FIRMA, sobre el body CRUDO y antes de parsear: `X-Zernio-Signature` = HMAC-SHA256 hex del
//      body con el secreto que MaKo le dio a Zernio al registrar el webhook (`asegurarWebhook`,
//      lib/zernio.ts): el MAESTRO (`ZERNIO_WEBHOOK_SECRET`) en la cuenta de la plataforma, y el de
//      cada negocio en su cuenta propia, que llega con `?w=<ws>` (lib/zernio-firma.ts). Fail-CLOSED:
//      sin secreto, sin firma o con un `?w=` roto, 401.
//   2. DE QUIÉN ES, con la lectura ESTRICTA (AGENTS.md): por el profile (`account.profileId`, lo acuña
//      el server) y, si el evento no lo trae —un `comment.received` trae SÓLO `account.accountId`—, por
//      la cuenta conectada (`zernio_cuenta`, la reclama `cuentasConectadas`). «No pude leer» va por
//      `responderFalloDeRuteo` (503 si reintentar lo arregla); «no es de nadie», 200 y un aviso en el
//      log: reintentar no lo va a atribuir mejor.
//      ⚠️ Y LA FIRMA TIENE QUE SER DE ESE NEGOCIO (`aceptaElWorkspace`), ANTES de reclamar el evento:
//      el secreto de una cuenta propia lo puede leer su dueño, así que sólo vale para eventos suyos, y
//      el maestro no vale para un negocio con cuenta propia. Si no, 200 y al log.
//   3. UNA VEZ POR EVENTO: el id del evento (`payload.id`, igual a `X-Zernio-Event-Id` y el mismo en
//      cada reintento) se reclama en `zernio_eventos` (mig 0242). Zernio entrega «at-least-once» y
//      reintenta hasta 7 veces: sin esto, una reentrega le manda otro DM al lead.
//   4. LO RÁPIDO adentro del pedido (la persona, el mensaje, el lead) y LO LENTO después (`after`):
//      Zernio corta a los 5 s, y disparar una automatización manda el primer mensaje en el acto. Si lo
//      rápido falla, se SUELTA el reclamo y se contesta 500: el reintento lo vuelve a intentar entero.
//
//   5. UNA RESPUESTA PAUSA (segunda pasada, 09/10/2026): un mensaje o una respuesta a una historia de
//      alguien que ya era un lead pausa lo que le estaban escribiendo, sin contestarle por WhatsApp
//      (lib/zernio-entrante.ts, `pausarRespuestaSocial`). Va en el mismo `after`, ANTES del disparo.
//
// Lo que NO hace, a propósito: guardar lo que manda el negocio (`message.sent`): lo que le llegó a
// cada lead ya está en `nutricion_envios.texto_enviado`.

import { after, type NextRequest } from 'next/server';
import { verificarFirmaZernio, wsDelWebhook, secretoParaVerificar, aceptaElWorkspace } from '@/lib/zernio-firma';
import { envCred } from '@/lib/credenciales';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { eventoSocialDe } from '@/lib/canal-social';
import { procesarEventoSocial, dispararEventoSocial, pausarRespuestaSocial } from '@/lib/zernio-entrante';
import { RUTEO_CUENTA, RUTEO_PERFIL, EVENTOS_WEBHOOK, usaCuentaPropia, cuentasConectadas } from '@/lib/zernio';

export const dynamic = 'force-dynamic';
// El primer mensaje de la automatización sale en `after`, después de contestar.
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lo que este webhook procesa: lo MISMO que se suscribe (`EVENTOS_WEBHOOK`). El resto, 200 y al log. */
const EVENTOS: ReadonlySet<string> = new Set(EVENTOS_WEBHOOK);

type Cuerpo = { id?: unknown; event?: unknown; account?: { profileId?: unknown; accountId?: unknown; id?: unknown } | null };
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);

/**
 * Después de un `account.connected`: el ruteo de las cuentas que lista la cuenta de Zernio de ESE
 * negocio (con su key, filtradas por su profile). Nunca tira: corre en `after`, con el evento ya
 * contestado, y lo que no se reclame acá lo reclama la próxima vez que el editor pida la cuenta.
 */
async function reclamarCuentasConectadas(ws: number): Promise<void> {
  try {
    const n = (await cuentasConectadas(ws)).length;
    console.log(`[webhook:zernio] account.connected ws=${ws}: ${n} cuenta(s) reclamada(s)`);
  } catch (e) {
    console.error(`[webhook:zernio] account.connected ws=${ws}: no pude listar las cuentas: ${msg(e)}`);
  }
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'zernio webhook', usage: 'POST con X-Zernio-Signature' });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const raw = await req.text();
  // `?w=` nombra al negocio cuya cuenta PROPIA de Zernio mandó el evento; sin él, la de la plataforma.
  const w = wsDelWebhook(req.nextUrl.searchParams.get('w'));
  const maestro = await envCred('ZERNIO_WEBHOOK_SECRET');
  const secret = secretoParaVerificar(maestro, w);
  const firma = req.headers.get('x-zernio-signature') ?? req.headers.get('x-late-signature');
  if (w === 'invalido' || !verificarFirmaZernio(raw, firma, secret)) {
    console.warn(`[webhook:zernio] firma rechazada (secreto ${maestro ? 'configurado' : 'AUSENTE'}, ?w=${w ?? '—'})`);
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
  let cuentaPropia = false;
  try {
    if (perfil) ws = await wsPorIdentificadorEstricto(RUTEO_PERFIL, perfil);
    if (ws == null && cuenta) ws = await wsPorIdentificadorEstricto(RUTEO_CUENTA, cuenta);
    // Sólo con el MAESTRO hace falta saberlo; con el secreto de un negocio alcanza con comparar.
    if (ws != null && w == null) cuentaPropia = await usaCuentaPropia(ws);
  } catch (err) {
    return responderFalloDeRuteo('zernio', err, perfil ?? cuenta);
  }
  if (ws == null) {
    console.warn(`[webhook:zernio] ${evento} sin workspace (profile ${perfil ?? '—'}, cuenta ${cuenta ?? '—'}): ignorado`);
    return Response.json({ ok: true, event: evento, ignored: 'sin workspace' });
  }
  if (!aceptaElWorkspace(w, ws, cuentaPropia)) {
    // Reintentar no lo arregla: 200, sin reclamar el evento ni marcar el webhook como andando.
    console.warn(`[webhook:zernio] ${evento} es del ws ${ws} y llegó firmado ${w == null ? 'con el maestro (ese negocio tiene cuenta propia)' : `para el ws ${w}`}: ignorado`);
    return Response.json({ ok: true, event: evento, ignored: 'workspace distinto' });
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
        // ⚠️ NO LA QUE DICE EL CUERPO: con su propio secreto, el dueño de una cuenta propia firma un
        // `account.connected` con el `accountId` de OTRO negocio, y el primero que reclama gana — los
        // comentarios de esa cuenta dejaban de tener dueño. Se reclaman las que la cuenta de Zernio de
        // ESTE negocio lista (`cuentasConectadas`), después de contestar: Zernio corta a los 5 s.
        after(() => reclamarCuentasConectadas(wsFinal));
        return Response.json({ ok: true, event: evento, accion: 'cuenta_conectada' });
      }
      const ev = eventoSocialDe(body);
      if ('ignorar' in ev) return Response.json({ ok: true, event: evento, ignored: ev.ignorar });
      const r = await procesarEventoSocial(ev.evento, body);
      if (r.leadId != null && (r.pausar || r.disparar)) {
        const leadId = r.leadId;
        const { canal, subtipo } = ev.evento;
        // `after` corre FUERA del contexto del pedido: el workspace se vuelve a fijar adentro.
        // ⚠️ LA PAUSA PRIMERO, Y DESPUÉS EL DISPARO: el mismo DM puede arrancar una automatización de
        // «Te envía un mensaje», y pausar después pausaría la que este mensaje acaba de arrancar.
        after(async () => {
          if (r.pausar) {
            try {
              const n = await runWithWorkspace(wsFinal, () => pausarRespuestaSocial(leadId, canal));
              console.log(`[webhook:zernio] ${canal}/${subtipo} lead ${leadId} ws=${wsFinal}: respondió, ${n} pausada(s)`);
            } catch (e) {
              console.error(`[webhook:zernio] pausar ${canal}/${subtipo} lead ${leadId}: ${msg(e)}`);
            }
          }
          if (!r.disparar) return;
          try {
            const n = await runWithWorkspace(wsFinal, () => dispararEventoSocial(leadId, canal, subtipo));
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
