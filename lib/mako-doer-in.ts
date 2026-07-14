// =============================================================================
// mako-doer-in — "Hola MaKo": MaKo ESCUCHA en el grupo y actúa (punto 12)
// =============================================================================
// El webhook de Evolution nos entrega los mensajes de los grupos de MaKo. Acá
// decidimos si MaKo tiene que responder: solo en grupos habilitados (allowlist
// mako.doer.grupos), solo si el mensaje lo nombra ("mako") o si hay una acción
// pendiente de confirmar (para atrapar el "sí"). Corre el mismo loop de tool-use
// del doer (lectura + acciones), pero las escrituras van SIEMPRE por confirmación
// (mako-doer-acciones): MaKo propone, el dueño confirma, recién ahí se ejecuta.
//
// Arranca gateado a "MaKo · Pruebas": el grupo del cliente (Mauricio) y el de
// SuperAdmin se suman a mano a mako.doer.grupos cuando el dueño quiera.

import 'server-only';
import { chatClaudeTools, type RichMsg } from '@/lib/anthropic';
import { MAKO_TOOLS, runMakoTool } from '@/lib/mako-tools';
import { MAKO_ACCION_TOOLS, NOMBRES_ACCION, crearRunnerAcciones } from '@/lib/mako-doer-acciones';
import { pendientesVigentes } from '@/lib/mako-pendientes';
import { buildSystemPrompt } from '@/lib/mako-context';
import { enviarAGrupoJid } from '@/lib/mako-grupo';
import { getSetting, setSetting } from '@/lib/settings';
import { runWithWorkspace } from '@/lib/workspace';

// ── settings del doer ─────────────────────────────────────────────────────────
const KEY_ACTIVO = 'mako.doer.activo';        // interruptor general (default: ON)
const KEY_GRUPOS = 'mako.doer.grupos';        // allowlist de JIDs donde MaKo escucha
const KEY_LAST = (jid: string) => `mako.doer.last.${jid}`; // dedup del último msg

/** JIDs de grupo donde el doer está habilitado (allowlist). */
export async function gruposDoer(ws: number): Promise<string[]> {
  return runWithWorkspace(ws, async () => {
    const raw = await getSetting(KEY_GRUPOS);
    if (!raw) return [];
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch { return []; }
  });
}
export async function setGruposDoer(ws: number, jids: string[]): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(KEY_GRUPOS, JSON.stringify([...new Set(jids)])));
}
async function doerActivo(ws: number): Promise<boolean> {
  return runWithWorkspace(ws, async () => (await getSetting(KEY_ACTIVO)) !== 'false');
}

// ── parseo del mensaje entrante ───────────────────────────────────────────────
type MsgIn = { key?: { remoteJid?: string; fromMe?: boolean; id?: string; participant?: string }; message?: Record<string, unknown>; pushName?: string };

function textoDe(m: MsgIn): string {
  const msg = m.message ?? {};
  if (typeof msg.conversation === 'string') return msg.conversation;
  const ext = msg.extendedTextMessage as { text?: string } | undefined;
  if (ext && typeof ext.text === 'string') return ext.text;
  const img = msg.imageMessage as { caption?: string } | undefined;
  if (img?.caption) return img.caption;
  return '';
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
/** ¿El mensaje interpela a MaKo? (lo nombra al principio o lo menciona). */
function nombraAMaKo(texto: string): boolean {
  const t = norm(texto).trim();
  if (/\bmako\b/.test(t.slice(0, 60))) return true;   // "hola mako", "che mako, ..."
  return false;
}

// ── preámbulo del doer en el grupo de WhatsApp ────────────────────────────────
const DOER_WA_PREAMBLE = `CONTEXTO: estás en un grupo de WhatsApp con el dueño del negocio. Te escribió a vos. Respondé como MaKo: breve, humano, estilo WhatsApp (2-5 líneas, sin volcar JSON ni tecnicismos).

HERRAMIENTAS DE LECTURA: buscar_leads, ficha_lead, historial_whatsapp, reuniones_lead, buscar_conocimiento, estado_experimentos, ver_funnel, listar_secuencias_nutricion, listar_campanas_meta. Usalas para responder con datos reales; nunca inventes nombres, números ni fechas.

CUANDO TE PIDEN ACCIONES (cambiar la etapa de un lead, activar/pausar una nutrición, renombrar/pausar/ajustar el presupuesto de una campaña de Meta): NO ejecutás directo. Usás la tool 'proponer_*' correspondiente —que deja la acción PENDIENTE— y en tu respuesta explicás en una línea qué vas a hacer y pedís que confirmen con un "sí". Conseguí primero los ids con las tools de lectura (buscar_leads / listar_secuencias_nutricion / listar_campanas_meta).

CUANDO EL DUEÑO CONFIRMA ("sí", "dale", "hacelo", "confirmo") y hay una acción pendiente: llamá 'confirmar_accion' para ejecutarla. Si dice que no, 'cancelar_accion'. Si no estás seguro de a cuál se refiere, usá 'listar_pendientes' y preguntá.`;

export type ResultadoDoer = { engaged: boolean; reply?: string; skip?: string };

/**
 * Procesa un mensaje entrante de grupo. Best-effort: nunca lanza (el webhook no
 * debe romperse por el doer). Debe llamarse DENTRO de runWithWorkspace(ws).
 * Devuelve si enganchó y la respuesta (para tests/telemetría); el envío al grupo
 * ya lo hace acá adentro.
 */
export async function manejarEntranteDoer(ws: number, data: MsgIn): Promise<ResultadoDoer> {
  // Fijamos el workspace para TODA la corrida (incl. el loop de tool-use, que lee
  // datos con getTenantDb según el contexto). El webhook ya lo envuelve, pero lo
  // reforzamos acá para que cualquier caller (p.ej. la ruta de prueba) sea seguro.
  return runWithWorkspace(ws, () => procesarDoer(ws, data));
}

async function procesarDoer(ws: number, data: MsgIn): Promise<ResultadoDoer> {
  try {
    const key = data.key;
    const jid = key?.remoteJid;
    if (!jid || !jid.endsWith('@g.us')) return { engaged: false, skip: 'no es grupo' };
    if (key?.fromMe) return { engaged: false, skip: 'fromMe' };
    const texto = textoDe(data).trim();
    if (!texto) return { engaged: false, skip: 'sin texto' };

    if (!(await doerActivo(ws))) return { engaged: false, skip: 'doer desactivado' };
    const grupos = await gruposDoer(ws);
    if (!grupos.includes(jid)) return { engaged: false, skip: 'grupo no habilitado' };

    // Dedup: Evolution re-entrega el mismo msg (reintentos). Si ya lo tratamos, salir.
    const msgId = key?.id ?? '';
    if (msgId) {
      const last = await runWithWorkspace(ws, () => getSetting(KEY_LAST(jid)));
      if (last === msgId) return { engaged: false, skip: 'ya tratado' };
    }

    // ¿Enganchamos? Solo si lo nombran o hay una acción esperando confirmación.
    const vigentes = await pendientesVigentes(ws, jid);
    if (!nombraAMaKo(texto) && vigentes.length === 0) return { engaged: false, skip: 'no lo nombran / sin pendientes' };

    // Marcar como tratado ANTES de responder (evita doble respuesta si re-entrega
    // mientras generamos).
    if (msgId) await runWithWorkspace(ws, () => setSetting(KEY_LAST(jid), msgId));

    // System: persona de MaKo + contexto de negocio + preámbulo + pendientes.
    const base = await runWithWorkspace(ws, () => buildSystemPrompt({ chartKey: 'mako-doer', titulo: 'Hola MaKo', contexto: '', query: texto }));
    const ctxPend = vigentes.length
      ? `\n\nACCIONES PENDIENTES DE CONFIRMACIÓN EN ESTE GRUPO (la más reciente primero):\n${vigentes.map((p) => `- #${p.id}: ${p.resumen}`).join('\n')}\nSi el dueño está confirmando, usá confirmar_accion con el id que corresponda.`
      : '';
    const system = `${base}\n\n${DOER_WA_PREAMBLE}${ctxPend}`;

    const tools = [...MAKO_TOOLS, ...MAKO_ACCION_TOOLS];
    const runnerAcciones = crearRunnerAcciones(ws, jid);
    const runTool = async (name: string, input: Record<string, unknown>) =>
      NOMBRES_ACCION.has(name) ? runnerAcciones(name, input) : runMakoTool(name, input);

    const msgs: RichMsg[] = [{ role: 'user', content: texto }];
    const { text } = await chatClaudeTools(system, msgs, tools, runTool, { feature: 'mako-doer-in', maxSteps: 8 });
    const respuesta = (text ?? '').trim();
    if (respuesta) await enviarAGrupoJid(jid, respuesta);
    return { engaged: true, reply: respuesta };
  } catch (e) {
    console.error('[mako-doer-in]', e instanceof Error ? e.message : String(e));
    return { engaged: false, skip: e instanceof Error ? e.message : String(e) };
  }
}
