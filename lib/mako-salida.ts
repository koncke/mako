// =============================================================================
// mako-salida — LA PUERTA: todo lo que MaKo le manda a una PERSONA por WhatsApp pasa por acá
// =============================================================================
// Martín, 3/11/2026: «no va a crear ni grupos de WhatsApp y no va a mandar ni mensajes a nadie». Acá se hace cumplir, en el único lugar por el que se sale:
//   · con el bot apagado o sin su línea, no sale nada;
//   · sólo a quien escribió hace menos de 24 horas (`mako_bot_contactos`). Sin su fila, o sin poder leerla, no sale nada: ante la duda, se calla;
//   · nunca por la línea de un negocio (`lineaPuedeSerDelBot`): `mako_ws9` es el WhatsApp personal de Martín;
//   · nunca por una línea frenada (lib/linea-freno.ts), y con el ritmo y las reglas de lib/mako-salida-reglas.ts, que son las de
//     TODAS las líneas (4/11/2026: «implementa medidas para que no nos baneen»).
//
// La cañería (Evolution o la API oficial) es una pieza aparte (lib/mako-salida-drivers.ts) y se elige con `mako.bot.salida`.
// El turno del doer llega acá sin saberlo: sus `enviarAGrupoJid` y `reaccionarMensaje` (lib/mako-doer-in.ts) desvían todo jid que no sea de un grupo.
// =============================================================================

import 'server-only';
import { credWsEstricta } from './credenciales';
import { getSettingEstricto } from './settings';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { KEY_BOT_ACTIVO, KEY_BOT_INSTANCIA, KEY_BOT_SALIDA, KEY_BOT_SOLO, dentroDeLaVentana, lineaPuedeSerDelBot } from './mako-bot-reglas';
import { salidaCloud, salidaEvolution, type EnvioChat, type SalidaWhatsApp } from './mako-salida-drivers';
import { frenoDeLinea, trasEscribir } from './linea-freno';
import { textoDelFreno } from './mako-salida-reglas';
import { bloqueoDeEnvioEnRevision } from './revision-guarda';

export type { EnvioChat } from './mako-salida-drivers';

/** La credencial de la API oficial, en el workspace de la plataforma: JSON `{ phoneNumberId, token }`. */
export const CLAVE_CLOUD_API = 'WHATSAPP_CLOUD';

export type ConfigBot = { activo: boolean; instancia: string | null; solo: string | null; salida: 'evolution' | 'cloud' };

const APAGADO: ConfigBot = { activo: false, instancia: null, solo: null, salida: 'evolution' };

/** Cómo está el bot. Sin poder leerlo, apagado: el bot es lo único de WhatsApp que puede quedar callado sin romper nada. */
export async function configDelBot(): Promise<ConfigBot> {
  try {
    const ws = await wsSuperAdmin();
    return await runWithWorkspace(ws, async () => {
      const [activo, instancia, solo, salida] = await Promise.all([
        getSettingEstricto(KEY_BOT_ACTIVO), getSettingEstricto(KEY_BOT_INSTANCIA), getSettingEstricto(KEY_BOT_SOLO), getSettingEstricto(KEY_BOT_SALIDA),
      ]);
      const linea = instancia?.trim() || null;
      if (linea && !lineaPuedeSerDelBot(linea)) console.error(`[mako-salida] ⛔ ${KEY_BOT_INSTANCIA} = ${linea} es la línea de un negocio: el bot queda apagado.`);
      const valida = linea && lineaPuedeSerDelBot(linea) ? linea : null;
      const conSalida = salida === 'cloud' ? 'cloud' as const : 'evolution' as const;
      // Por la API oficial no hay una línea de Evolution que nombrar.
      return { activo: activo === 'si' && (!!valida || conSalida === 'cloud'), instancia: valida, solo, salida: conSalida };
    });
  } catch (e) {
    console.error(`[mako-salida] no pude leer cómo está el bot, queda apagado: ${e instanceof Error ? e.message : String(e)}`);
    return APAGADO;
  }
}

/** Cuánto hace que escribió este chat, con la ventana de 24 horas. Sin fila, o sin poder leerla: no se puede escribir. */
export async function ventanaAbierta(jid: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('mako_bot_contactos').select('ultimo_entrante_at').eq('jid', jid).maybeSingle();
  if (error) { console.error(`[mako-salida] no pude leer la ventana de ${jid}: ${error.message}`); return false; }
  return dentroDeLaVentana((data as { ultimo_entrante_at?: string | null } | null)?.ultimo_entrante_at);
}

async function canalDeSalida(c: ConfigBot): Promise<SalidaWhatsApp | null> {
  if (c.salida === 'cloud') {
    const crudo = await credWsEstricta(CLAVE_CLOUD_API, await wsSuperAdmin()).catch(() => null);
    if (!crudo) return null;
    try {
      const o = JSON.parse(crudo) as { phoneNumberId?: string; token?: string };
      return o.phoneNumberId && o.token ? salidaCloud({ phoneNumberId: o.phoneNumberId, token: o.token }) : null;
    } catch { return null; }
  }
  const base = process.env.EVOLUTION_BASE_URL, clave = process.env.EVOLUTION_API_KEY;
  if (!base || !clave || !c.instancia) return null;
  return salidaEvolution({ base, clave, instancia: c.instancia, observar: trasEscribir });
}

/** La puerta para los tres: bot prendido, cañería lista y ventana abierta. */
async function salidaPara(jid: string): Promise<{ s: SalidaWhatsApp } | { error: string; fueraDeVentana?: true }> {
  if (jid.endsWith('@g.us')) return { error: 'la salida del bot no escribe en grupos' };
  // La cuenta de revisión de las tiendas no le escribe a nadie (lib/revision-guarda.ts): el bot de MaKo tampoco.
  const enRevision = await bloqueoDeEnvioEnRevision('whatsapp', jid);
  if (enRevision) return { error: enRevision };
  const c = await configDelBot();
  if (!c.activo) return { error: 'el bot está apagado' };
  if (!(await ventanaAbierta(jid))) return { error: `no le escribió en las últimas 24 horas: ${jid}`, fueraDeVentana: true };
  // La línea frenada no escribe (lib/linea-freno.ts): WhatsApp avisó que estaba en riesgo.
  const freno = c.salida === 'evolution' && c.instancia ? await frenoDeLinea(c.instancia) : null;
  if (freno) return { error: textoDelFreno(freno) };
  const s = await canalDeSalida(c);
  return s ? { s } : { error: 'la salida del bot no tiene con qué mandar' };
}

/** Manda un texto a un chat 1 a 1. Es la ÚNICA función que le escribe a una persona: no lanza, y dice por qué no salió. */
export async function enviarAlChat(jid: string, texto: string, delayMs?: number): Promise<EnvioChat> {
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const p = await salidaPara(jid);
  if ('error' in p) {
    console.warn(`[mako-salida] no salió: ${p.error}`);
    return { ok: false, error: p.error, ...(p.fueraDeVentana ? { fueraDeVentana: true as const } : {}) };
  }
  return p.s.enviarTexto(jid, texto, delayMs);
}

export async function reaccionarEnElChat(jid: string, key: { id?: string } | undefined, emoji: string): Promise<boolean> {
  if (!key?.id) return false;
  const p = await salidaPara(jid);
  return 'error' in p ? false : p.s.reaccionar(jid, key.id, emoji);
}

export async function escribiendoEnElChat(jid: string, ms: number): Promise<void> {
  const p = await salidaPara(jid);
  if (!('error' in p)) await p.s.escribiendo(jid, ms);
}
