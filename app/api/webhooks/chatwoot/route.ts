// =============================================================================
// Webhook: Chatwoot → app (lead responde por WhatsApp)
// =============================================================================
// Cuando un lead manda un mensaje ENTRANTE:
//   1) pausa su nutrición (pausarPorRespuesta) — no le seguimos mandando secuencia.
//   2) avisa a Mauricio por Telegram con un link para atender.
//
// Chatwoot no firma sus webhooks. Opcional: CHATWOOT_WEBHOOK_SECRET → exige
// ?secret=… en la URL del webhook. Configurá la URL en Chatwoot:
//   https://dashboard-marketing-six.vercel.app/api/webhooks/chatwoot
// =============================================================================

import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { pausarPorRespuesta } from '@/lib/nutricion';
import { notificarTelegram } from '@/lib/telegram';

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
  conversation?: { id?: number; meta?: { sender?: { name?: string; phone_number?: string } } };
  conversation_id?: number;
  sender?: { name?: string; phone_number?: string };
};

async function buscarLeadPorTelefono(d: string): Promise<number | null> {
  if (!d) return null;
  const supabase = getSupabaseServer();
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
  // reescribe pipeline_stage, dispara Telegram), así que exigimos el secret.
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

  // 1) Pausar nutrición del lead que respondió.
  let leadId: number | null = null;
  try {
    leadId = await buscarLeadPorTelefono(digits(phone));
    if (leadId) await pausarPorRespuesta(leadId);
  } catch (err) {
    console.error(`[webhook:chatwoot] pausa: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 1.5) Si el lead respondió y todavía está EN FRÍO (abierto, sin agenda ni
  //      reuniones ni override de etapa), pasa a "Nutrición - Manual" para que un
  //      humano lo atienda. NO tocamos leads ganados/perdidos/descalificados ni
  //      los que ya avanzaron (agendaron / R1 / R2): degradarlos los sacaría del
  //      tablero.
  try {
    if (leadId) {
      const supabase = getSupabaseServer();
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

  // 2) Avisar a Mauricio por Telegram.
  const base = (process.env.CHATWOOT_BASE_URL || '').replace(/\/$/, '');
  const acc = process.env.CHATWOOT_ACCOUNT_ID || '3';
  const link = convId && base ? `${base}/app/accounts/${acc}/conversations/${convId}` : '';
  await notificarTelegram(
    `💬 <b>Nuevo mensaje de WhatsApp</b>\n${nombre}${phone ? ` (${phone})` : ''}\n<i>${content.slice(0, 300)}</i>${link ? `\n${link}` : ''}`,
  );

  return Response.json({ ok: true, leadId });
}
