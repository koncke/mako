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
import { runWithWorkspace, getTenantDb } from '@/lib/workspace';
import { jidToNumero } from '@/lib/evolution';
import { guardarMensajeUpsert } from '@/lib/evolution-mensajes';
import { manejarEntranteDoer } from '@/lib/mako-doer-in';
import { upsertContacto } from '@/lib/evolution-contactos';
import { upsertLabelCatalogo, borrarLabelCatalogo } from '@/lib/evolution-labels';

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

// Estado de entrega de un mensaje (Baileys/Evolution) → nuestros ticks.
// Baileys: 0=ERROR 1=PENDING 2=SERVER_ACK 3=DELIVERY_ACK 4=READ 5=PLAYED; Evolution
// puede mandarlo como número o como el enum en texto.
function mapMsgStatus(s: unknown): string | null {
  const v = String(s ?? '').toUpperCase();
  if (v === 'READ' || v === 'PLAYED' || v === '4' || v === '5') return 'read';
  if (v === 'DELIVERY_ACK' || v === 'DELIVERED' || v === '3') return 'delivered';
  if (v === 'SERVER_ACK' || v === 'SENT' || v === '2') return 'sent';
  if (v === 'ERROR' || v === 'FAILED' || v === '0') return 'failed';
  return null; // PENDING/1 u otros → no tocamos
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
      let errores = 0;
      await runWithWorkspace(ws, async () => {
        for (const m of mensajes) {
          // Mensajes de GRUPO (…@g.us) → doer "Hola MaKo" (guardarMensajeUpsert
          // los descarta; el espejo 1-a-1 no aplica a grupos). El doer decide
          // solo si engancha (grupo habilitado + lo nombran / hay pendiente).
          const rjid = ((m?.key as { remoteJid?: string } | undefined)?.remoteJid) ?? '';
          if (rjid.endsWith('@g.us')) {
            try { await manejarEntranteDoer(ws, m); } catch (e) { console.error(`[webhook:evolution] doer: ${e instanceof Error ? e.message : String(e)}`); }
            continue;
          }
          try { await guardarMensajeUpsert(instance, m); } catch (e) { errores += 1; console.error(`[webhook:evolution] guardar msg: ${e instanceof Error ? e.message : String(e)}`); }
        }
        await supabase.from('evolution_instancias').update({ ultimo_evento_at: nowISO }).eq('instance_name', instance);
      });
      return Response.json({ ok: true, guardados: mensajes.length - errores });
    }

    if (evento === 'messages.update') {
      // Estado de entrega de nuestros salientes (ticks). data puede ser un update
      // o un array de updates según versión — normalizamos.
      const ws = await wsDeInstancia(instance);
      if (ws == null) return Response.json({ ok: true, ignored: 'instancia sin workspace' });
      const d = body.data as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const updates = Array.isArray(d) ? d : (d ? [d] : []);
      let n = 0;
      for (const u of updates) {
        const msgId = (u.keyId as string) || ((u.key as { id?: string } | undefined)?.id) || (u.messageId as string) || null;
        const st = mapMsgStatus((u.status as unknown) ?? (u.update as { status?: unknown } | undefined)?.status);
        if (!msgId || !st) continue;
        await runWithWorkspace(ws, async () => {
          await (await getTenantDb()).from('wa_mensajes').update({ status: st }).eq('wa_message_id', msgId).eq('from_me', true);
        });
        n += 1;
      }
      return Response.json({ ok: true, actualizados: n });
    }

    if (evento === 'contacts.upsert' || evento === 'contacts.update') {
      // Nombre + foto del contacto → evolution_contactos (para la lista/avatares).
      const ws = await wsDeInstancia(instance);
      if (ws == null) return Response.json({ ok: true, ignored: 'sin workspace' });
      const d = body.data as Record<string, unknown> | undefined;
      const arr = Array.isArray((d as { contacts?: unknown[] })?.contacts)
        ? (d as { contacts: Record<string, unknown>[] }).contacts
        : (Array.isArray(d) ? (d as unknown as Record<string, unknown>[]) : (d ? [d] : []));
      await runWithWorkspace(ws, async () => {
        for (const cc of arr) {
          const jid = (cc.remoteJid as string) || (cc.id as string) || '';
          const nombre = (cc.pushName as string) || (cc.name as string) || (cc.verifiedName as string) || null;
          const foto = (cc.profilePicUrl as string) || (cc.profilePictureUrl as string) || null;
          try { await upsertContacto(jid, nombre, foto); } catch { /* no fatal */ }
        }
      });
      return Response.json({ ok: true, contactos: arr.length });
    }

    if (evento === 'messages.delete') {
      // Reflejar el borrado en el espejo (el humano borró en WhatsApp).
      const ws = await wsDeInstancia(instance);
      if (ws == null) return Response.json({ ok: true, ignored: 'sin workspace' });
      const d = body.data as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const items = Array.isArray(d) ? d : (d ? [d] : []);
      await runWithWorkspace(ws, async () => {
        for (const it of items) {
          const id = ((it.key as { id?: string } | undefined)?.id) || (it.id as string) || (it.keyId as string) || null;
          if (!id) continue;
          await (await getTenantDb()).from('wa_mensajes').update({ texto: 'Mensaje eliminado', tipo: 'text', media_path: null, media_mime: null }).eq('wa_message_id', id);
        }
      });
      return Response.json({ ok: true });
    }

    if (evento === 'messages.edited') {
      // Reflejar la edición: nuevo texto del mensaje.
      const ws = await wsDeInstancia(instance);
      if (ws == null) return Response.json({ ok: true, ignored: 'sin workspace' });
      const d = body.data as Record<string, unknown> | undefined;
      const key = (d?.key as { id?: string } | undefined);
      const id = key?.id || (d?.keyId as string) || null;
      const msg = (d?.editedMessage as Record<string, unknown> | undefined) || (d?.message as Record<string, unknown> | undefined) || {};
      const nuevo = (msg.conversation as string) || ((msg.extendedTextMessage as { text?: string } | undefined)?.text) || null;
      if (id && nuevo) {
        await runWithWorkspace(ws, async () => {
          await (await getTenantDb()).from('wa_mensajes').update({ texto: nuevo }).eq('wa_message_id', id);
        });
      }
      return Response.json({ ok: true });
    }

    if (evento === 'labels.edit') {
      // Catálogo de etiquetas del número (creada/renombrada/borrada en el celular).
      const ws = await wsDeInstancia(instance);
      if (ws == null) return Response.json({ ok: true, ignored: 'sin workspace' });
      const d = body.data as { id?: string; name?: string; color?: number; deleted?: boolean } | undefined;
      const labelId = String(d?.id ?? '');
      if (labelId) {
        await runWithWorkspace(ws, async () => {
          if (d?.deleted) await borrarLabelCatalogo(labelId);
          else await upsertLabelCatalogo(labelId, d?.name ?? null, d?.color ?? null);
        });
      }
      return Response.json({ ok: true });
    }

    return Response.json({ ok: true, ignored: evento || 'sin evento' });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`[webhook:evolution] ${m}`);
    return Response.json({ ok: false, error: m }); // 200 igual: no queremos reintentos por error nuestro
  }
}
