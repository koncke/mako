import 'server-only';
// =============================================================================
// LO QUE LA PERSONA LE MANDA A MaKo POR WHATSAPP SOBRE EL RETO (20/11/2026)
// =============================================================================
// La auditoría del 20/11 (wa-02, D1-12): «siempre escribe ella primero y MaKo le CONTESTA», y ningún código leía su mensaje. Dos
// mensajes son del reto y los contesta el código, como el pedido del código (lib/mako-grupo.ts, `responderPedidoV2`):
//   · la hora del día 2 («Hola MaKo, prefiero que me escribas a las 18:00 sobre el reto.»): se guarda en su reto (desde ahí MaKo le
//     escribe a esa hora, lib/reto/avisos-salida.ts) y MaKo le contesta «¡Hecho, {n}! Cada día te escribo a las 18:00…»;
//   · BAJA (lo ofrece el mensaje de Martín a quien deja el reto): ningún WhatsApp más del reto, y MaKo se lo confirma;
//   · el audio del día 7 («cómo te fue con el reto… Lo escucha Martín»): va al grupo de SuperAdmin con el audio, la prueba queda
//     respondida (lib/reto/pruebas.ts, la tarjeta del chat del reto) y MaKo le contesta «¡Gracias! Ya se lo pasé a Martín.».
// Sólo en una línea de MaKo, y sólo de quien verificó su número por el onboarding V2 y tiene reto. Si no, null: el mensaje sigue
// al bot como cualquier otro. Lo que habla con WhatsApp va en `responder`, para correr después de contestarle al webhook.
// =============================================================================
import { getSupabaseServer } from '../supabase';
import { cambiarSettingSi } from '../settings';
import { runWithWorkspace } from '../workspace';
import { esNombreDeCanal } from '../mako-canal';
import { chatDelMensaje, esSuTelefono } from '../mako-bot-reglas';
import { enviarAPersonaMaKo, enviarAlGrupoSuperAdmin } from '../mako-grupo';
import { fetchMediaBase64EnInstancia } from '../evolution';
import { CLAVE_RETO, HORAS_WA, leerEstado, type EstadoReto } from './dias';
import { CLAVE_AVISOS, GRACIAS_DIA_7, LEIDO_DIA_7, RESPUESTA_BAJA, audioParaMartin, esBaja, esElAudioDelCierre, horaDelMensaje, leerAvisos, respuestaDeLaHora } from './avisos';
import { pruebaRespondida } from './pruebas';

const KEY_VERIFICACION = 'mako.contacto.verificacion';

type Verificada = { ws: number; nombre: string; linea: string | null };

/** El negocio de quien escribe: una verificación del V2 ya confirmada, con su número. */
async function negocioDe(telefono: string): Promise<Verificada | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value')
    .eq('key', KEY_VERIFICACION).ilike('value', '%"v2":true%').ilike('value', '%"verificado":true%').limit(500);
  if (error) { console.error(`[reto] no pude buscar de quién es ${telefono}: ${error.message}`); return null; }
  for (const f of (data ?? []) as Array<{ workspace_id: number; value: string }>) {
    try {
      const v = JSON.parse(f.value) as { telefono?: string; destino?: string; nombre?: string; linea?: string };
      if ([v.destino, v.telefono].some((t) => t && esSuTelefono(t, telefono))) return { ws: Number(f.workspace_id), nombre: v.nombre ?? '', linea: v.linea ?? null };
    } catch { /* una fila rota no es de nadie */ }
  }
  return null;
}

async function leerClave(ws: number, key: string): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return ((data as { value?: string | null } | null)?.value) ?? null;
}

/** Los bytes del audio: los trae el webhook (`base64`) o se piden a la misma línea que lo recibió. null: no se pudo. */
async function audioDelMensaje(instancia: string, key: { id?: string; remoteJid?: string }, msg: Record<string, unknown>): Promise<{ base64: string; mime: string } | null> {
  const a = (msg.audioMessage ?? msg.pttMessage) as { mimetype?: string } | undefined;
  const mime = a?.mimetype?.startsWith('audio/') ? a.mimetype : 'audio/ogg; codecs=opus';
  if (typeof msg.base64 === 'string' && msg.base64) return { base64: msg.base64.includes(',') ? msg.base64.split(',').pop()! : msg.base64, mime };
  if (!key.id || !key.remoteJid) return null;
  const r = await fetchMediaBase64EnInstancia(instancia, key.remoteJid, key.id, false).catch(() => null);
  return r ? { base64: r.base64, mime: r.mimetype.startsWith('audio/') ? r.mimetype : mime } : null;
}

export async function responderAlReto(instancia: string, m: Record<string, unknown>): Promise<{ resultado: string; responder?: () => Promise<void> } | null> {
  const key = (m?.key ?? {}) as { id?: string; remoteJid?: string; fromMe?: boolean; remoteJidAlt?: string; senderPn?: string };
  if (key.fromMe) return null;
  const msg = (m?.message ?? {}) as Record<string, unknown>;
  const texto = typeof msg.conversation === 'string' ? msg.conversation : String((msg.extendedTextMessage as { text?: string } | undefined)?.text ?? '');
  const baja = esBaja(texto);
  const hora = baja ? null : horaDelMensaje(texto, HORAS_WA);
  const esAudio = !!msg.audioMessage || !!msg.pttMessage;
  // Sin uno de estos mensajes no se toca la base: por este webhook pasa todo el tráfico.
  if (!baja && !hora && !esAudio) return null;
  const chat = chatDelMensaje(key);
  if (!chat?.telefono) return null;
  const quien = await negocioDe(chat.telefono);
  if (!quien || !(esNombreDeCanal(instancia) || instancia === quien.linea)) return null;
  const { ws } = quien;
  const crudoReto = await leerClave(ws, CLAVE_RETO);
  const e = leerEstado(crudoReto);
  if (!e) return null;
  const destino = chat.telefono;

  if (!baja && !hora) {
    // EL AUDIO DEL DÍA 7. Se reclama ANTES (`cierre`, compare-and-set): con dos líneas de la misma cuenta el audio llega dos veces, y a
    // Martín le llega uno. Recién cuando salió, la prueba respondida y el «¡Gracias!». Si no salió, se suelta el reclamo y no se le
    // dice nada (que lo mande otra vez). Otro audio cualquiera sigue al bot, como antes.
    const crudo = await leerClave(ws, CLAVE_AVISOS);
    const a = leerAvisos(crudo, e);
    if (!esElAudioDelCierre({ e, a, ahora: Date.now(), esAudio })) return null;
    const reclamo = JSON.stringify({ ...a, cierre: new Date().toISOString() });
    const gane = await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_AVISOS, crudo, reclamo));
    if (!gane) return { resultado: `ws${ws}: el audio del día 7 ya lo pasa otra llegada` };
    return {
      resultado: `ws${ws}: el audio del día 7, a Martín`,
      responder: async () => {
        const audio = await audioDelMensaje(instancia, key, msg);
        let r: { ok: boolean; error?: string };
        try {
          r = await enviarAlGrupoSuperAdmin(audioParaMartin(quien.nombre, ws, !!audio), audio ? { archivo: { ...audio, nombre: 'reto-dia-7.ogg' } } : {});
        } catch (x) {
          r = { ok: false, error: x instanceof Error ? x.message : String(x) };
        }
        if (!r.ok) {
          console.error(`[reto] ws${ws}: no le pude pasar a Martín el audio del día 7: ${r.error ?? 'sin detalle'}`);
          await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_AVISOS, reclamo, crudo ?? JSON.stringify(a))).catch(() => false);
          return;
        }
        if (!(await pruebaRespondida(ws, 7, LEIDO_DIA_7))) console.error(`[reto] ws${ws}: el audio del día 7 le llegó a Martín y no pude marcar la prueba`);
        const g = await enviarAPersonaMaKo(destino, GRACIAS_DIA_7);
        if (!g.ok) console.error(`[reto] ws${ws}: no salió el «¡Gracias!» del día 7: ${g.error}`);
      },
    };
  }

  if (baja) {
    const crudo = await leerClave(ws, CLAVE_AVISOS);
    const a = leerAvisos(crudo, e);
    if (!a.baja) {
      const gane = await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_AVISOS, crudo, JSON.stringify({ ...a, baja: new Date().toISOString() })));
      if (!gane) return { resultado: `ws${ws}: BAJA ya anotada por otra llegada` };
    }
    return { resultado: `ws${ws}: BAJA del reto`, responder: async () => { await enviarAPersonaMaKo(destino, RESPUESTA_BAJA); } };
  }

  // La hora: se guarda en su reto (compare-and-set sobre lo leído: una tarea marcada en el medio no se pisa; se relee y se reintenta).
  let crudo = crudoReto;
  let actual: EstadoReto | null = e;
  let gane = false;
  for (let i = 0; i < 3 && !gane; i++) {
    if (i > 0) { crudo = await leerClave(ws, CLAVE_RETO); actual = leerEstado(crudo); }
    if (!actual) break;
    const base: EstadoReto = actual, esperado = crudo;
    gane = base.horaWa === hora || (await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_RETO, esperado, JSON.stringify({ ...base, horaWa: hora }))));
  }
  if (!gane) console.error(`[reto] ws${ws}: no pude guardar la hora ${hora} (cambió en el medio); igual le contesto`);
  return {
    resultado: `ws${ws}: la hora del reto, ${hora}`,
    responder: async () => {
      const r = await enviarAPersonaMaKo(destino, respuestaDeLaHora(quien.nombre, hora!));
      if (!r.ok) console.error(`[reto] ws${ws}: no salió la respuesta a la hora: ${r.error}`);
    },
  };
}
