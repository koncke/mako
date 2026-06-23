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

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { pausarPorRespuesta } from '@/lib/nutricion';
import { notificarTelegram } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

function digits(p: string): string {
  return (p || '').replace(/\D/g, '');
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
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET;
  if (secret && new URL(req.url).searchParams.get('secret') !== secret) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
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

  // 2) Avisar a Mauricio por Telegram.
  const base = (process.env.CHATWOOT_BASE_URL || '').replace(/\/$/, '');
  const acc = process.env.CHATWOOT_ACCOUNT_ID || '3';
  const link = convId && base ? `${base}/app/accounts/${acc}/conversations/${convId}` : '';
  await notificarTelegram(
    `💬 <b>Nuevo mensaje de WhatsApp</b>\n${nombre}${phone ? ` (${phone})` : ''}\n<i>${content.slice(0, 300)}</i>${link ? `\n${link}` : ''}`,
  );

  return Response.json({ ok: true, leadId });
}
