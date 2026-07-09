// =============================================================================
// Webhook de Evolution API — eventos del WhatsApp NO oficial
// =============================================================================
// Evolution pega acá con { event, instance, data, ... }. Llega SIN sesión, así
// que mapeamos instance→workspace por evolution_instancias (getSupabaseServer,
// sin scope, igual que el webhook de Resend). Auth por ?secret= (como Chatwoot).
//
// F2.1 maneja conexión/QR. F2.2 sumará 'messages.upsert' (espejo en DB + media).
// Siempre respondemos 200 salvo firma inválida — Evolution reintenta si no.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { jidToNumero } from '@/lib/evolution';
import { guardarMensajeUpsert } from '@/lib/evolution-mensajes';

export const dynamic = 'force-dynamic';

// Resuelve el workspace dueño de una instancia (sin sesión → sin scope).
async function wsDeInstancia(instance: string): Promise<number | null> {
  const { data } = await getSupabaseServer()
    .from('evolution_instancias').select('workspace_id').eq('instance_name', instance).maybeSingle();
  return (data as { workspace_id?: number } | null)?.workspace_id ?? null;
}

type EvEvent = {
  event?: string;
  instance?: string;
  data?: Record<string, unknown>;
  sender?: string;
};

function mapEstado(state: string | undefined): string {
  switch ((state ?? '').toLowerCase()) {
    case 'open': return 'conectado';
    case 'connecting': return 'conectando';
    case 'close': case 'closed': return 'desconectado';
    default: return 'conectando';
  }
}

export async function POST(req: NextRequest) {
  // Fail-CLOSED: sin secret configurado (o sin match) → 401. El endpoint es
  // público, sin sesión y con service_role; un fail-open dejaría a cualquiera
  // pisar el estado de conexión de cualquier workspace (instance_name adivinable).
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!secret || new URL(req.url).searchParams.get('secret') !== secret) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: EvEvent;
  try { body = (await req.json()) as EvEvent; } catch { return Response.json({ ok: true, ignored: 'bad_json' }); }

  const instance = body.instance;
  const evento = (body.event ?? '').toLowerCase();
  if (!instance) return Response.json({ ok: true, ignored: 'sin instance' });

  const supabase = getSupabaseServer();
  const nowISO = new Date().toISOString();

  try {
    if (evento === 'connection.update') {
      const state = (body.data?.state as string | undefined);
      const estado = mapEstado(state);
      const patch: Record<string, unknown> = { estado, ultimo_evento_at: nowISO, updated_at: nowISO };
      if (estado === 'conectado') {
        patch.ultima_conexion_at = nowISO;
        // El número/perfil suele venir en data.wuid / data.profileName según versión.
        const jid = (body.data?.wuid as string) || (body.data?.ownerJid as string) || null;
        const num = jidToNumero(jid);
        if (num) patch.numero = num;
        const perfil = (body.data?.profileName as string) || null;
        if (perfil) patch.perfil_nombre = perfil;
      }
      if (estado === 'desconectado') { patch.numero = null; }
      await supabase.from('evolution_instancias').update(patch).eq('instance_name', instance);
      return Response.json({ ok: true });
    }

    if (evento === 'qrcode.updated') {
      // El QR lo pollea la UI en vivo; acá solo marcamos actividad.
      await supabase.from('evolution_instancias')
        .update({ estado: 'conectando', ultimo_evento_at: nowISO, updated_at: nowISO })
        .eq('instance_name', instance);
      return Response.json({ ok: true });
    }

    if (evento === 'messages.upsert') {
      // Espejo total: resolvemos el workspace y guardamos cada mensaje dentro de
      // su scope (getTenantDb estampa workspace_id). data puede ser un mensaje o
      // { messages: [...] } según versión — normalizamos ambos.
      const ws = await wsDeInstancia(instance);
      if (ws == null) return Response.json({ ok: true, ignored: 'instancia sin workspace' });
      const d = body.data as Record<string, unknown> | undefined;
      const mensajes = Array.isArray((d as { messages?: unknown[] })?.messages)
        ? (d as { messages: Record<string, unknown>[] }).messages
        : (d ? [d] : []);
      await runWithWorkspace(ws, async () => {
        for (const m of mensajes) {
          try { await guardarMensajeUpsert(instance, m); } catch (e) { console.error(`[webhook:evolution] guardar msg: ${e instanceof Error ? e.message : String(e)}`); }
        }
        await supabase.from('evolution_instancias').update({ ultimo_evento_at: nowISO }).eq('instance_name', instance);
      });
      return Response.json({ ok: true, guardados: mensajes.length });
    }

    return Response.json({ ok: true, ignored: evento || 'sin evento' });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`[webhook:evolution] ${m}`);
    return Response.json({ ok: false, error: m }); // 200 igual: no queremos reintentos por error nuestro
  }
}
