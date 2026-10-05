// =============================================================================
// ig-chatbot — el puente entre los DMs de Instagram (Zernio) y el Chatbot
// =============================================================================
// Replica el camino asistido de WhatsApp (asistirRespuesta, lib/nutricion.ts):
// al mensaje entrante, PRIMERO clasificarEscenario (hand-off fail-closed: si el
// lead planteó algo no previsto, MaKo no contesta ni en borrador), DESPUÉS
// responderSimulador redacta con el MISMO cerebro del setter (persona + voz +
// perfil + funnel + estrategia de la secuencia), y la respuesta queda como fila
// de ig_mensajes estado='borrador' que un humano envía con 1 clic.
//
// POLÍTICA DE ENVÍO (regla de la casa: un canal PROPONE, una persona confirma):
//   · Default: el borrador ESPERA aprobación humana.
//   · Flag por workspace `ig_auto_respuesta` (app_settings) prendido → se envía
//     directo. Nace APAGADO y sin herencia de env: un canal que contesta solo a
//     leads reales no se prende por omisión, ni para el dueño.
//   · Guard DETERMINISTA de la ventana de 24h de Meta: vencida ⇒ jamás envío
//     automático, ni con el flag prendido. El envío MANUAL fuera de ventana sale
//     con messageTag HUMAN_AGENT (el único que Instagram soporta, contrato de
//     Zernio verificado).
//
// TENANT-SAFETY: generarBorradorIg recibe `ws` explícito porque la llama el
// webhook (sin sesión) y todo corre dentro de runWithWorkspace(ws); ahí
// getTenantDb y getSetting resuelven ese workspace. enviarBorradorIg lee el
// workspace del contexto (route con sesión, o el runWithWorkspace del webhook).

import 'server-only';
import { getTenantDb, getWorkspaceActual, runWithWorkspace } from './workspace';
import { getSetting } from './settings';
import { sendDm, ZernioError } from './zernio';
import type { TurnoSim } from './setting-simulador';

/**
 * Flag por workspace del envío automático. A diferencia de lib/envio-flags.ts,
 * acá NO hay herencia del env de deploy ni para el dueño: solo un 'true'
 * explícito en app_settings lo prende (fail-closed para todos). Escribirlo:
 * setSetting(KEY_IG_AUTO_RESPUESTA, 'true' | 'false') desde la UI del canal.
 */
export const KEY_IG_AUTO_RESPUESTA = 'ig_auto_respuesta';

export async function igAutoRespuestaHabilitada(): Promise<boolean> {
  return (await getSetting(KEY_IG_AUTO_RESPUESTA)) === 'true';
}

/**
 * ¿La ventana de 24h de Meta sigue abierta? Guard EN POSITIVO: solo un
 * timestamp parseable y FUTURO habilita — sin dato, o con basura, la ventana se
 * trata como vencida (el modo de falla seguro es no enviar automático).
 */
export function ventanaVigente(ventanaExpiraAt: string | null | undefined): boolean {
  if (!ventanaExpiraAt) return false;
  const t = Date.parse(ventanaExpiraAt);
  return Number.isFinite(t) && t > Date.now();
}

type ConvRow = {
  id: number;
  zernio_conversation_id: string | null;
  zernio_account_id: string | null;
  ventana_expira_at: string | null;
  lead_id: number | null;
  username: string | null;
};

export type ResultadoBorradorIg =
  | { ok: true; borradorId: number; enviado: boolean }
  | { ok: false; motivo: string };

/**
 * Genera (o actualiza) el borrador de respuesta de una conversación de
 * Instagram. Idempotente por diseño: UN borrador pendiente por conversación —
 * si ya hay uno, se REEMPLAZA su texto (la redacción nueva vio el historial más
 * completo) en vez de apilar otro.
 */
export async function generarBorradorIg(ws: number, conversacionId: number): Promise<ResultadoBorradorIg> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();

    const { data: convRaw } = await db
      .from('ig_conversaciones')
      .select('id, zernio_conversation_id, zernio_account_id, ventana_expira_at, lead_id, username')
      .eq('id', conversacionId)
      .maybeSingle();
    const conv = convRaw as ConvRow | null;
    if (!conv) return { ok: false, motivo: 'la conversación no existe en este workspace' };

    // Historial real de la charla (últimos 20, en orden cronológico). Los
    // borradores y los envíos fallidos NO son parte de la conversación: el lead
    // nunca los vio.
    const { data: msjs } = await db
      .from('ig_mensajes')
      .select('direccion, estado, texto')
      .eq('conversacion_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const filas = ((msjs ?? []) as Array<{ direccion: string; estado: string; texto: string | null }>).reverse();
    const historial: TurnoSim[] = [];
    for (const f of filas) {
      if (f.direccion === 'entrante') {
        historial.push({ de: 'lead', texto: f.texto?.trim() || '(mandó un adjunto sin texto)' });
      } else if (f.estado === 'enviado' && f.texto?.trim()) {
        historial.push({ de: 'negocio', texto: f.texto });
      }
    }
    if (!historial.length || historial[historial.length - 1].de !== 'lead') {
      return { ok: false, motivo: 'el último mensaje no es del lead: no hay nada que responder' };
    }
    const ultimoDelLead = historial[historial.length - 1].texto;

    // La secuencia con estrategia en modo 'asistido' — mismo criterio que el
    // camino de WhatsApp (asistirRespuesta). Sin guion, MaKo no improvisa.
    // Imports dinámicos como en nutricion.ts: setting-simulador importa
    // nutricion, y este módulo lo llama el webhook — no cerrar ciclos ni cargar
    // el motor entero en el cold start si el evento no lo necesita.
    const [{ getSecuenciasConStats }, { parseEstrategia }] = await Promise.all([
      import('./nutricion'),
      import('./setting-estrategia'),
    ]);
    const secs = await getSecuenciasConStats();
    const secuencia = secs.find((s) => s.activa && parseEstrategia(s.estrategia)?.modo === 'asistido');
    if (!secuencia) {
      return { ok: false, motivo: 'sin secuencia activa en modo asistido: MaKo no tiene guion para responder' };
    }
    const estrategia = parseEstrategia(secuencia.estrategia);

    // HAND-OFF PRIMERO (fail-closed, igual que asistirRespuesta): antes de
    // redactar hay que saber si esto es un caso previsto. Un borrador plausible
    // para un caso imprevisto es justo lo que alguien aprueba sin leer.
    const { clasificarEscenario, registrarHandoff } = await import('./chat-agent-handoff');
    const clas = await clasificarEscenario(ultimoDelLead, estrategia?.escenarios ?? []);
    if (!clas.encaja) {
      if (conv.lead_id != null) {
        await registrarHandoff({
          leadId: conv.lead_id,
          secuenciaId: secuencia.id,
          mensaje: ultimoDelLead,
          motivo: clas.motivo,
          leadNombre: conv.username,
          secuenciaNombre: secuencia.nombre,
        });
      } else {
        // Sin lead vinculado no hay fila de hand-off que registrar, pero el
        // dueño se tiene que enterar igual (best-effort, como todos los avisos).
        try {
          const { emitirDelCatalogo } = await import('./avisos');
          await emitirDelCatalogo('wa-mensaje-entrante', {
            ws,
            texto: `🖐 *@${conv.username ?? 'alguien'} escribió por Instagram algo que no tengo previsto.*\n\n_"${ultimoDelLead.slice(0, 220)}"_\n\nNo le contesté nada: prefiero no improvisar con alguien real. Contéstale desde el inbox de Instagram y, si es un caso que se va a repetir, agrégalo a la secuencia.\n\n— MaKo`,
          });
        } catch { /* la clasificación ya decidió: el aviso no bloquea */ }
      }
      return { ok: false, motivo: `hand-off: ${clas.motivo}` };
    }

    // MaKo redacta con el MISMO motor del asistido de WhatsApp. responderSimulador
    // acepta el historial completo (lead=user, negocio=assistant): se le pasa la
    // conversación real, no un turno suelto.
    const { responderSimulador } = await import('./setting-simulador');
    const r = await responderSimulador(secuencia.id, historial);
    if (!r.ok) return { ok: false, motivo: r.error };

    const vigente = ventanaVigente(conv.ventana_expira_at);
    // La nota viaja en la columna `error` del borrador (no hay columna aparte):
    // es lo que la bandeja muestra al lado del botón de enviar.
    const nota = vigente
      ? null
      : 'Ventana de 24h de Meta vencida: no se envía automático. El envío manual sale con tag HUMAN_AGENT.';

    const { data: exis } = await db
      .from('ig_mensajes')
      .select('id')
      .eq('conversacion_id', conv.id)
      .eq('estado', 'borrador')
      .order('created_at', { ascending: false })
      .limit(1);
    const previo = ((exis ?? []) as Array<{ id: number }>)[0];
    let borradorId: number;
    if (previo) {
      const { error } = await db
        .from('ig_mensajes')
        .update({ texto: r.respuesta, error: nota })
        .eq('id', previo.id)
        .eq('estado', 'borrador');
      if (error) return { ok: false, motivo: `no pude actualizar el borrador: ${error.message}` };
      borradorId = previo.id;
    } else {
      const { data: ins, error } = await db
        .from('ig_mensajes')
        .insert({
          conversacion_id: conv.id,
          direccion: 'saliente',
          estado: 'borrador',
          texto: r.respuesta,
          error: nota,
        })
        .select('id')
        .single();
      if (error || !ins) return { ok: false, motivo: `no pude guardar el borrador: ${error?.message ?? 'sin fila'}` };
      borradorId = (ins as { id: number }).id;
    }

    // Envío automático: SOLO con la ventana vigente (guard determinista de
    // arriba: vencida ⇒ nunca, ni con flag) y el flag del workspace prendido.
    let enviado = false;
    if (vigente && (await igAutoRespuestaHabilitada())) {
      const env = await enviarBorradorIg(borradorId, 'mako-auto');
      enviado = env.ok;
      if (!env.ok) console.error(`[ig-chatbot] auto-envío del borrador ${borradorId} falló: ${env.error}`);
    }

    // Aviso al dueño (best-effort): el mismo "avisame si responden" del asistido.
    try {
      const { emitirDelCatalogo } = await import('./avisos');
      const quien = conv.username ? `@${conv.username}` : 'un lead';
      await emitirDelCatalogo('wa-mensaje-entrante', {
        ws,
        texto: enviado
          ? `💬 *${quien} respondió por Instagram* y le contesté automático (tienes el envío automático prendido):\n\n${r.respuesta.slice(0, 300)}\n\n— MaKo`
          : `💬 *${quien} respondió por Instagram.*${ultimoDelLead ? `\n\n_"${ultimoDelLead.slice(0, 180)}"_` : ''}\n\nTe dejé un borrador listo para aprobar en la bandeja de Instagram:\n${r.respuesta.slice(0, 300)}${nota ? `\n\n⚠️ ${nota}` : ''}\n\n— MaKo`,
      });
    } catch { /* el borrador ya quedó: el aviso nunca lo rompe */ }

    return { ok: true, borradorId, enviado };
  });
}

export type ResultadoEnvioIg =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string };

/**
 * Envía un borrador de ig_mensajes por Zernio y lo marca 'enviado' / 'error'.
 *
 * Idempotente: el CLAIM es `update … eq('estado','borrador')` — un doble clic
 * (o el auto-envío pisándose con un humano) no manda dos veces; además el
 * Idempotency-Key `ig_borrador_<id>` hace que un retry de red replay-ee el
 * envío original en Zernio en vez de duplicarlo (retención 24h del contrato).
 *
 * `permitirFueraDeVentana` lo pasa SOLO el camino manual (una persona ya
 * confirmó): fuera de la ventana de 24h el DM sale con messageTag HUMAN_AGENT.
 * El camino automático no lo pasa nunca y muere acá si la ventana venció.
 */
export async function enviarBorradorIg(
  borradorId: number,
  porQuien: string,
  opts?: { permitirFueraDeVentana?: boolean },
): Promise<ResultadoEnvioIg> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'sin workspace en el contexto' };
  const db = await getTenantDb();

  const { data: bRaw } = await db
    .from('ig_mensajes')
    .select('id, conversacion_id, texto, estado')
    .eq('id', borradorId)
    .maybeSingle();
  const b = bRaw as { id: number; conversacion_id: number; texto: string | null; estado: string } | null;
  if (!b) return { ok: false, error: 'ese borrador no existe en este workspace' };
  if (b.estado !== 'borrador') return { ok: false, error: 'el borrador ya no está pendiente' };
  if (!b.texto?.trim()) return { ok: false, error: 'el borrador no tiene texto' };

  const { data: cRaw } = await db
    .from('ig_conversaciones')
    .select('id, zernio_conversation_id, zernio_account_id, ventana_expira_at')
    .eq('id', b.conversacion_id)
    .maybeSingle();
  const conv = cRaw as Pick<ConvRow, 'id' | 'zernio_conversation_id' | 'zernio_account_id' | 'ventana_expira_at'> | null;
  if (!conv?.zernio_conversation_id) return { ok: false, error: 'la conversación no tiene id de Zernio para enviar' };
  if (!conv.zernio_account_id) return { ok: false, error: 'la conversación no tiene cuenta de Instagram asociada' };

  const vigente = ventanaVigente(conv.ventana_expira_at);
  if (!vigente && !opts?.permitirFueraDeVentana) {
    return { ok: false, error: 'la ventana de 24h de Meta venció: este envío lo tiene que confirmar una persona' };
  }

  // CLAIM atómico (patrón enviarBorrador de lib/evolution-envio.ts). Se marca
  // 'enviado' ANTES de llamar a Zernio a propósito: si el proceso muere en el
  // medio, el modo de falla es un borrador que parece enviado y no salió —
  // recuperable por un humano — y nunca un DM duplicado a un lead real.
  const { data: claimed } = await db
    .from('ig_mensajes')
    .update({ estado: 'enviado', error: null })
    .eq('id', b.id)
    .eq('estado', 'borrador')
    .select('id');
  if (!((claimed ?? []) as unknown[]).length) {
    return { ok: false, error: 'el borrador ya no está pendiente (otro clic llegó primero)' };
  }

  try {
    const r = await sendDm(ws, conv.zernio_conversation_id, {
      accountId: conv.zernio_account_id,
      texto: b.texto,
      // Instagram solo soporta HUMAN_AGENT fuera de la ventana (contrato Zernio).
      ...(vigente ? {} : { tag: 'HUMAN_AGENT' as const }),
      idempotencyKey: `ig_borrador_${b.id}`,
    });
    if (r.messageId) {
      // Best-effort: si el eco del webhook (message.sent) ya insertó una fila
      // con este id, el UNIQUE (workspace_id, zernio_message_id) rechaza el
      // update — no es un error del envío, que ya salió.
      const { error: eId } = await db.from('ig_mensajes').update({ zernio_message_id: r.messageId }).eq('id', b.id);
      if (eId) console.warn(`[ig-chatbot] no pude estampar zernio_message_id en el borrador ${b.id}: ${eId.message}`);
    }
    await db.from('ig_conversaciones').update({ ultimo_mensaje_at: new Date().toISOString() }).eq('id', conv.id);
    console.log(`[ig-chatbot] borrador ${b.id} enviado por ${porQuien} (ws ${ws}${vigente ? '' : ', HUMAN_AGENT'})`);
    return { ok: true, messageId: r.messageId };
  } catch (e) {
    // El error de Zernio queda VISIBLE en la fila (estado='error' + columna
    // error), nunca tragado: la bandeja lo muestra y el humano decide.
    const msg =
      e instanceof ZernioError
        ? `${e.message}${e.code ? ` [${e.code}]` : ''}`
        : e instanceof Error
          ? e.message
          : String(e);
    await db.from('ig_mensajes').update({ estado: 'error', error: msg.slice(0, 500) }).eq('id', b.id);
    console.error(`[ig-chatbot] envío del borrador ${b.id} falló (ws ${ws}): ${msg}`);
    return { ok: false, error: msg };
  }
}
