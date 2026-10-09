// =============================================================================
// Webhook de Evolution API — eventos del WhatsApp NO oficial
// =============================================================================
// Evolution pega acá con { event, instance, data, ... }. Llega SIN sesión, así
// que mapeamos instance→workspace por evolution_instancias (getSupabaseServer,
// sin scope, igual que el webhook de Resend). Auth por ?secret=.
//
// F2.1 maneja conexión/QR. F2.2 sumará 'messages.upsert' (espejo en DB + media).
// Siempre respondemos 200 salvo firma inválida — Evolution reintenta si no.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace, getTenantDb, OWNER_WS } from '@/lib/workspace';
import { jidToNumero } from '@/lib/evolution';
import { guardarMensajeUpsert } from '@/lib/evolution-mensajes';
import { manejarEntranteDoer, wsDeGrupoJid } from '@/lib/mako-doer-in';
import { INSTANCIA_SUPERADMIN, esNombreDeCanal, instanciaCanal, usarCanalComoVoz } from '@/lib/mako-canal';
import { instanciaVoz } from '@/lib/mako-grupo';
import { upsertContacto } from '@/lib/evolution-contactos';
import { upsertLabelCatalogo, borrarLabelCatalogo } from '@/lib/evolution-labels';
import { cerrarPorAcuse, acusesDe } from '@/lib/insistencias';
import { marcarRespondieron } from '@/lib/flujo-corridas';
import { esAcuse } from '@/lib/flujos-tipos';

/**
 * El texto plano de un mensaje entrante, para mirar si es un «ok».
 *
 * Deliberadamente mínimo: sólo las dos formas de TEXTO que manda WhatsApp. Un audio o
 * una imagen no acusan recibo — que alguien mande una foto al grupo no significa que
 * haya leído el aviso.
 */
function textoDeMensaje(m: Record<string, unknown>): string {
  const msg = (m?.message ?? {}) as Record<string, unknown>;
  if (typeof msg.conversation === 'string') return msg.conversation;
  const ext = msg.extendedTextMessage as { text?: string } | undefined;
  return typeof ext?.text === 'string' ? ext.text : '';
}

export const dynamic = 'force-dynamic';
// El doer (loop de tools con Claude) puede tardar en turnos pesados. Le damos aire para
// que complete en background (after) sin que la función muera a mitad. Feedback jul-19.
export const maxDuration = 300;

// Resuelve el workspace dueño de una instancia (sin sesión → sin scope).
async function wsDeInstancia(instance: string): Promise<number | null> {
  const { data } = await getSupabaseServer()
    .from('evolution_instancias').select('workspace_id').eq('instance_name', instance).maybeSingle();
  const ws = (data as { workspace_id?: number } | null)?.workspace_id ?? null;
  // La línea de voz de MaKo (canal SuperAdmin) NO vive en evolution_instancias
  // (no es de ningún cliente) → cae al workspace dueño para que el doer "Hola
  // MaKo" pueda correr en sus grupos.
  //
  // ⚠️ SE RECONOCEN LAS LÍNEAS VIGENTES, NO UN NOMBRE FIJO. Cuando Evolution deja la
  // línea trabada, `conectarCanalMaKo` rota a una nueva (`mako_superadmin_<sufijo>`); con
  // el nombre fijo la nueva quedaba SORDA («instancia sin workspace»).
  // Vigentes son DOS: la del canal y la de la voz. Casi siempre son la misma, pero entre
  // una rotación y el escaneo el canal ya es la nueva y la voz todavía la vieja, y
  // reconociendo solo el canal la voz VIVA quedaba sorda en ese rato (revisión del 11/09).
  // Que dos líneas de la misma cuenta reciban el mismo mensaje no contesta dos veces:
  // `ux_doer_buffer_msg` (mig 0113) deduplica por wa_message_id. Una línea rotada que ya
  // no es ninguna de las dos se ignora.
  // Y si no se pudo LEER cuáles son, se acepta cualquier línea del canal por el mismo
  // motivo: descartar un «Hola MaKo» por un 5xx de la base es perderlo, y Evolution no
  // reintenta.
  if (ws == null && esNombreDeCanal(instance)) {
    const vigentes = await Promise.all([instanciaCanal(), instanciaVoz({ estricto: true })]).catch(() => null);
    if (!vigentes || vigentes.includes(instance)) return OWNER_WS;
  }
  return ws;
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
      // La línea de MaKo no tiene fila en evolution_instancias: el update de abajo no la
      // toca. Al abrir la línea VIGENTE del canal se la fija como voz ACÁ, en el servidor.
      // Hasta ahora lo hacía solo el panel de /agencia, o sea solo si alguien lo tenía
      // abierto en el momento justo: tras rotar una línea trabada, cerrar la pestaña
      // después de escanear dejaba la voz apuntando a la muerta.
      if (estado === 'conectado' && esNombreDeCanal(instance)) {
        after(async () => {
          try {
            if (instance !== (await instanciaCanal())) return;
            if ((await instanciaVoz()) === instance) return;
            await usarCanalComoVoz(instance);
          } catch (e) { console.error(`[webhook:evolution] voz del canal: ${e instanceof Error ? e.message : String(e)}`); }
        });
      }
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
      const esGrupo = (m: Record<string, unknown>) => (((m?.key as { remoteJid?: string } | undefined)?.remoteJid) ?? '').endsWith('@g.us');
      const grupos = mensajes.filter(esGrupo);
      const unoAuno = mensajes.filter((m) => !esGrupo(m));

      // Mensajes de GRUPO (…@g.us) → doer "Hola MaKo". El loop de tools con Claude es
      // LENTO: corriéndolo sincrónico, un turno pesado (ej. "tengo 10 ideas" → Opus)
      // excedía el timeout, la función moría, la RESPUESTA SE PERDÍA, y Evolution
      // reintentaba raro (el "me contestó lo de ayer" del feedback jul-19). Ahora corre en
      // BACKGROUND con after(): devolvemos 200 YA (Evolution no reintenta) y el doer tiene
      // hasta maxDuration para completar y mandar. Resuelve su propio workspace por el grupo.
      if (grupos.length) {
        // EL ACUSE DE RECIBO corta las insistencias vivas. Va ANTES del doer y sin
        // await sobre su resultado: el que escribió «ok» está mirando el grupo, así que
        // lo peor que puede pasar es seguir insistiendo mientras la IA piensa.
        //
        // Se mira SOLO lo que escribió una persona (fromMe false): los mensajes que manda
        // MaKo al grupo también llegan por acá, y con un «listo» suyo se acusaría a sí misma.
        after(async () => {
          try {
            // ⚠️ EL WORKSPACE DEL ACUSE SALE DEL GRUPO, NUNCA DE LA INSTANCIA. Y no es un
            // caso de borde: `groupsIgnore: true` es el default de toda instancia de
            // cliente (lib/evolution.ts), así que los grupos se habilitan SÓLO en la línea
            // de voz de MaKo — y esa línea está mapeada al dueño. O sea que, con el `ws` de
            // `wsDeInstancia`, TODO «ok» de TODO grupo de TODOS los workspaces cerraba las
            // insistencias del ws1 y marcaba SUS corridas. El trabajo de un cliente apagaba
            // el seguimiento de otro, sin un solo error. Lo encontró el relevo del
            // 06/10/2026 de la capa de notificaciones.
            //
            // `wsDeGrupoJid` es la función de aislamiento que el doer ya usaba dos bloques
            // más abajo para lo mismo: acá faltaba. Si devuelve null —un grupo que no es de
            // nadie reconocido— NO se acusa nada: fail-closed, igual que el doer.
            const porJid = new Map<string, typeof grupos>();
            for (const m of grupos) {
              if ((m?.key as { fromMe?: boolean } | undefined)?.fromMe) continue;
              const jid = (m?.key as { remoteJid?: string } | undefined)?.remoteJid ?? '';
              if (!jid) continue;
              const previos = porJid.get(jid) ?? [];
              previos.push(m);
              porJid.set(jid, previos);
            }
            for (const [jid, delGrupo] of porJid) {
              const wsGrupo = await wsDeGrupoJid(jid);
              if (wsGrupo == null) continue;
              // Las palabras las elige el negocio; sin nada guardado son las de fábrica.
              const palabras = await acusesDe(wsGrupo);
              const texto = delGrupo
                .map((m) => textoDeMensaje(m))
                .find((t) => t && esAcuse(t, palabras));
              if (!texto) continue;
              const n = await cerrarPorAcuse(wsGrupo);
              // ⚠️ EL MISMO ACUSE ES LA SEÑAL DEL CONDICIONAL. Un paso `condicional`
              // con `contestaron` pregunta por esto y por nada más: es la única
              // respuesta que el motor de flujos puede OBSERVAR, porque sus mensajes
              // salen al grupo del dueño y lo que va al lead sale por la cola de
              // confirmación. Por eso la tarjeta dice «si alguien contestó en el
              // grupo» y no «si responde el lead» — un rótulo que promete una señal
              // que no existe es el diagrama que miente, con otra cara.
              //
              // Marca y NO despierta: adelantar un delay porque alguien escribió «ok»
              // manda el mensaje antes de tiempo. La condición se evalúa cuando a la
              // corrida le toca, con la marca ya puesta.
              const m = await marcarRespondieron(wsGrupo);
              if (n || m) console.log(`[webhook:evolution] acuse «${texto}» en ${jid} → ${n} insistencia(s) cerrada(s) y ${m} corrida(s) marcada(s) en ws${wsGrupo}`);
            }
          } catch (e) { console.error('[webhook:evolution] acuse:', e instanceof Error ? e.message : String(e)); }
        });
        after(async () => {
          for (const m of grupos) {
            try { await manejarEntranteDoer(instance, m); } catch (e) { console.error(`[webhook:evolution] doer: ${e instanceof Error ? e.message : String(e)}`); }
          }
        });
      }

      // 1-a-1 (espejo del inbox del cliente): rápido, sincrónico. La línea SuperAdmin no
      // espeja (sus DMs no se mezclan con los del cliente).
      let errores = 0;
      if (unoAuno.length && !esNombreDeCanal(instance)) {
        await runWithWorkspace(ws, async () => {
          for (const m of unoAuno) {
            try { await guardarMensajeUpsert(instance, m); } catch (e) { errores += 1; console.error(`[webhook:evolution] guardar msg: ${e instanceof Error ? e.message : String(e)}`); }
          }
        });
      }
      await supabase.from('evolution_instancias').update({ ultimo_evento_at: nowISO }).eq('instance_name', instance);
      return Response.json({ ok: true, guardados: unoAuno.length - errores });
    }

    // ⚠️ DE ACÁ PARA ABAJO NADA ES DEL DOER. Las líneas de MaKo (canal y voz) existen para
    // los mensajes de grupo; sus ticks, contactos, etiquetas, borrados y ediciones no son de
    // ningún cliente, y `wsDeInstancia` las mapea a OWNER_WS, que es el ws1: Mauricio, un
    // CLIENTE. Al escanear una línea rotada, la agenda del teléfono de MaKo se sincronizaba en
    // los contactos de Mauricio (segunda revisión adversarial del 11/09/2026).
    if (esNombreDeCanal(instance)) {
      return Response.json({ ok: true, ignored: 'línea de MaKo: solo mensajes de grupo' });
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
