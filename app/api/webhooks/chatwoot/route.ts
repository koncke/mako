// =============================================================================
// Webhook: Chatwoot → app (lead responde por WhatsApp)
// =============================================================================
// Cuando un lead manda un mensaje ENTRANTE:
//   1) pausa su nutrición (pausarPorRespuesta) — no le seguimos mandando secuencia.
//   2) avisa a Mauricio por el grupo de WhatsApp del dueño (+ feed in-app) con un link para atender.
//
// Chatwoot no firma sus webhooks. Opcional: CHATWOOT_WEBHOOK_SECRET → exige
// ?secret=… en la URL del webhook. Configurá la URL en Chatwoot:
//   https://makodigital.app/api/webhooks/chatwoot
// =============================================================================

import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { pausarPorRespuesta } from '@/lib/nutricion';
import { emitirDelCatalogo } from '@/lib/avisos';
import { dispararEvento } from '@/lib/flujos';
import { credWs } from '@/lib/credenciales';
import { wsPorIdentificador } from '@/lib/webhook-routing';

export const dynamic = 'force-dynamic';

function digits(p: string): string {
  return (p || '').replace(/\D/g, '');
}

/** Compara el secret en tiempo constante (evita fuga por timing y tolera longitudes distintas). */
function secretoValido(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type ChatwootHook = {
  event?: string;
  message_type?: string | number;
  content?: string;
  conversation?: { id?: number; inbox_id?: number; meta?: { sender?: { name?: string; phone_number?: string } } };
  conversation_id?: number;
  sender?: { name?: string; phone_number?: string };
  // Identificadores de ruteo: el account_id de Chatwoot mapea al workspace
  // (webhook_routing, servicio 'chatwoot'). inbox opcional (por si más adelante
  // se rutea a nivel de inbox).
  account?: { id?: number };
  inbox?: { id?: number };
};

// El matcheo va por getTenantDb → scopeado al workspace del contexto. Este webhook
// se corre dentro de runWithWorkspace(ws) con el workspace RESUELTO por el
// account_id del payload, así que solo matchea/escribe leads de ESE cliente (no
// cruza al lead de otro cliente con el mismo teléfono).
async function buscarLeadPorTelefono(d: string): Promise<number | null> {
  if (!d) return null;
  const supabase = await getTenantDb();
  const exact = await supabase.from('leads').select('id').eq('telefono_normalizado', d).limit(1).maybeSingle();
  if (exact.data?.id) return exact.data.id as number;
  if (d.length >= 10) {
    const like = await supabase
      .from('leads')
      .select('id, telefono_normalizado')
      .ilike('telefono_normalizado', `%${d.slice(-10)}`)
      .limit(5);
    const m = (like.data ?? []).find(
      (l) => digits((l as { telefono_normalizado: string }).telefono_normalizado).slice(-10) === d.slice(-10),
    );
    return (m as { id: number } | undefined)?.id ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  // Auth FAIL-CLOSED: este webhook es público y MUTA datos (pausa nutrición,
  // reescribe pipeline_stage, dispara avisos), así que exigimos el secret.
  // Sin CHATWOOT_WEBHOOK_SECRET: en prod se rechaza (cerrado antes que abierto);
  // en local/dev se permite para poder testear. Mismo criterio que el gate global.
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET;
  if (!secret) {
    const esProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    if (esProd) {
      console.error('[webhook:chatwoot] CHATWOOT_WEBHOOK_SECRET sin configurar en producción → rechazando');
      return Response.json({ ok: false, error: 'webhook no configurado' }, { status: 401 });
    }
  } else {
    // Aceptamos el secret por header (preferido, no queda en access logs) o por
    // query ?secret= (compat con la config actual de Chatwoot).
    const recibido =
      req.headers.get('x-chatwoot-webhook-secret') ?? new URL(req.url).searchParams.get('secret');
    if (!secretoValido(recibido, secret)) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  let body: ChatwootHook;
  try {
    body = (await req.json()) as ChatwootHook;
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }

  const esEntrante = body.message_type === 'incoming' || body.message_type === 0;
  if (body.event !== 'message_created' || !esEntrante) {
    return Response.json({ ok: true, ignored: true });
  }

  const sender = body.sender ?? body.conversation?.meta?.sender ?? {};
  const phone = sender.phone_number ?? '';
  const nombre = sender.name ?? 'Lead';
  const content = body.content ?? '';
  const convId = body.conversation?.id ?? body.conversation_id ?? null;

  // Resolver el workspace por el account_id de Chatwoot (webhook_routing). Fail-
  // CLOSED: sin mapeo, NO tocamos datos (nunca cae al dueño) — un WhatsApp entrante
  // no debe poder tocar el lead de OTRO cliente con el mismo teléfono.
  const accountId = body.account?.id != null ? String(body.account.id) : null;
  const ws = await wsPorIdentificador('chatwoot', accountId);
  if (ws == null) {
    // Diagnóstico: si el account_id NO vino donde lo esperamos, logueamos las
    // claves del payload para ubicarlo sin adivinar (Chatwoot varía por evento).
    const pistas = accountId == null ? ` payload_keys=[${Object.keys(body).join(',')}]` : '';
    console.warn(`[webhook:chatwoot] sin workspace para account_id=${accountId ?? '—'} — ignorado${pistas}`);
    return Response.json({ ok: true, ignored: 'sin workspace' });
  }

  // Todo el matcheo/escritura de leads + avisos corre confinado al workspace resuelto.
  return runWithWorkspace(ws, async () => {
    // 1) Pausar nutrición del lead que respondió.
    let leadId: number | null = null;
    try {
      leadId = await buscarLeadPorTelefono(digits(phone));
      // El texto va para el modo asistido: MaKo redacta el borrador de respuesta.
      if (leadId) await pausarPorRespuesta(leadId, { texto: content });
    } catch (err) {
      console.error(`[webhook:chatwoot] pausa: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Flujos configurados por el dueño: disparar 'lead.wa_entrante' (best-effort).
    if (leadId) await dispararEvento('lead.wa_entrante', { leadId, leadNombre: nombre });

    // 1.5) Si el lead respondió y todavía está EN FRÍO (abierto, sin agenda ni
    //      reuniones ni override de etapa), pasa a "Nutrición - Manual" para que un
    //      humano lo atienda. NO tocamos leads ganados/perdidos/descalificados ni
    //      los que ya avanzaron (agendaron / R1 / R2): degradarlos los sacaría del
    //      tablero.
    try {
      if (leadId) {
        const supabase = await getTenantDb();
        const { data } = await supabase
          .from('leads')
          .select('estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2')
          .eq('id', leadId)
          .maybeSingle();
        const l = (data ?? {}) as {
          estado_lead?: string; pipeline_stage?: string | null;
          fecha_agenda?: string | null; fecha_junta_1?: string | null; fecha_junta_2?: string | null;
          asistio_j1?: boolean | null; asistio_j2?: boolean | null;
        };
        const enFrio =
          l.estado_lead === 'abierto' &&
          (l.pipeline_stage == null || l.pipeline_stage === 'nutri') &&
          !l.fecha_agenda && !l.fecha_junta_1 && !l.fecha_junta_2 &&
          l.asistio_j1 == null && l.asistio_j2 == null;
        if (enFrio) {
          await supabase.from('leads').update({ pipeline_stage: 'manual', nutricion_realizada: true }).eq('id', leadId);
        }
      }
    } catch (err) {
      console.error(`[webhook:chatwoot] stage manual: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2) Avisar al dueño del workspace por WhatsApp + feed in-app. Best-effort. El
    //    link se arma con las credenciales de Chatwoot DE ESTE workspace (credWs).
    const base = ((await credWs('CHATWOOT_BASE_URL', ws)) || '').replace(/\/$/, '');
    const acc = (await credWs('CHATWOOT_ACCOUNT_ID', ws)) || accountId || '3';
    const link = convId && base ? `${base}/app/accounts/${acc}/conversations/${convId}` : '';
    await emitirDelCatalogo('wa-mensaje-entrante', {
      texto: `💬 *Mensaje nuevo* de ${nombre}${phone ? ` (${phone})` : ''}: "${content.slice(0, 200)}".${link ? `\n${link}` : ''}\n— MaKo`,
    });

    return Response.json({ ok: true, leadId });
  });
}
