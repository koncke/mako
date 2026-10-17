// =============================================================================
// MaKo Analyst de un lead — quién pregunta, qué lead, y el turno con sus datos atados
// =============================================================================
// El chat de la pestaña «MaKo Analyst» de la ficha del lead (app/crm/lead-view/MakoAnalystLead.tsx,
// por app/api/crm/analyst/route.ts). Pedido de Martín (12/10/2026): «replica el chat que tenemos
// en la tab de "Offer", basicamente que sea un chat con la IA que por defecto tenga atado los
// datos de ese lead, para eso tenemos una API de todo».
//
// NO HAY MOTOR NUEVO. El turno es el del chat de la app (lib/mako-turno-app.ts): las mismas
// herramientas por intención, las acciones que PROPONEN y se confirman en la tarjeta (con
// `gatingOk` mirado otra vez al confirmar), el mismo veto de Claude y la misma red gratis. Acá se
// decide sólo lo propio:
//
//   · QUIÉN: la sesión, el workspace de la sesión (`getWorkspaceActual`, nunca un `?ws=` crudo) y
//     el permiso de VER EL CRM (`puedeVerKey('crm', …)`, la regla del Sidebar). No el de la tab
//     MaKo: un closer que ve la ficha ve su chat. Y el lead tiene que ser de ese workspace:
//     `getLead` va por `getTenantDb`, así que el de otra cuenta contesta «no existe».
//   · DE QUIÉN ES LA CONVERSACIÓN: de esa persona sobre ese lead (`chartKeyDelLead`). Las
//     funciones del turno comparan la clave en cada lectura (`sesionDe`), así que un id ajeno
//     contesta «no encuentro ese chat».
//   · QUÉ SABE MaKo: las lecturas de la API de MaKo sobre el lead (`LECTURAS_DEL_LEAD`), corridas
//     por el choke point (`ejecutarOperacion`) con el ROL de quien pregunta, en CADA turno. Van al
//     system por `EntradaTurnoApp.contexto` y no se guardan en el hilo.
// =============================================================================

import 'server-only';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getRolWsEfectivo, getCapaActual, runWithWorkspace } from '@/lib/workspace';
import { puedeVerKey } from '@/lib/movil-rutas';
import { getLead } from '@/lib/leads';
import { ejecutarOperacion, vistaDe } from '@/lib/api-mako/ejecutar';
import type { Ctx } from '@/lib/api-mako/tipos';
import type { AdjuntoListo } from '@/lib/mako-adjuntos';
import {
  listarSesiones, abrirSesion, nuevaSesion, turnoApp, confirmarDesdeTarjeta, cancelarDesdeTarjeta, type PersonaChat,
} from '@/lib/mako-turno-app';
import {
  chartKeyDePersona, canalKeyDeSesion,
  type MensajeChat, type RespuestaTurno, type ResultadoTarjeta, type SesionChat, type TarjetaPendiente,
} from '@/lib/mako-turno-app-reglas';
import { chartKeyDelLead, contextoDelLead, contextoDeEdicion, leadIdDe, LECTURAS_DEL_LEAD, PISTA_EDICION_FICHA, type LecturaHecha } from '@/lib/mako-analyst-lead-reglas';

export type AnalystDelLead = { persona: PersonaChat; lead: { id: number; nombre: string; funnelId: number | null } };
export type FalloAnalyst = { error: string; status: 400 | 401 | 403 | 404 };

/**
 * La persona del request sobre ESTE lead, o por qué no. Exige sesión ADENTRO (el proxy no alcanza
 * como red), el CRM visible para su rol y su capa, y el lead en su workspace. A quien no le
 * corresponde el lead, no existe (404, el mismo para «de otra cuenta» y «no existe»).
 */
export async function analystDelRequest(leadIdCrudo: unknown): Promise<AnalystDelLead | FalloAnalyst> {
  const leadId = leadIdDe(leadIdCrudo);
  if (leadId == null) return { error: 'Falta el lead.', status: 400 };
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'Tu sesión venció.', status: 401 };
  const rolWs = await getRolWsEfectivo();
  if (!rolWs) return { error: 'Tu sesión venció.', status: 401 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Elige una cuenta primero.', status: 400 };
  const capa = await getCapaActual().catch(() => null);
  if (!puedeVerKey('crm', rolWs, capa)) return { error: 'El CRM no está en tu cuenta.', status: 403 };
  const chartKey = chartKeyDelLead(chartKeyDePersona(sesion), leadId);
  if (!chartKey) return { error: 'Tu sesión venció.', status: 401 };
  // Si la lectura FALLA, tira (la ruta contesta 500): «no pude leer» no es «no existe».
  const lead = await runWithWorkspace(ws, () => getLead(leadId));
  if (!lead) return { error: 'No encuentro ese lead.', status: 404 };
  return {
    persona: { ws, rol: rolWs === 'admin' ? 'admin' : 'miembro', actor: sesion.email || sesion.nombre || sesion.sub, chartKey },
    lead: { id: lead.id, nombre: (lead.nombre ?? '').trim(), funnelId: lead.funnel_id ?? null },
  };
}

export type ConversacionDelLead = { sesion: SesionChat | null; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[] };

/**
 * La conversación de esta persona sobre este lead: la más reciente (UNA por lead y persona; la
 * pantalla no ofrece «nuevo chat»), o ninguna todavía. Sin sesión no se crea nada: se crea con el
 * primer mensaje, o abrir una ficha dejaría una sesión vacía por cada lead mirado.
 */
export async function abrirDelLead(a: AnalystDelLead): Promise<ConversacionDelLead> {
  const [ultima] = await listarSesiones(a.persona);
  if (!ultima) return { sesion: null, mensajes: [], propuestas: [] };
  return (await abrirSesion(a.persona, ultima.id)) ?? { sesion: null, mensajes: [], propuestas: [] };
}

/**
 * Lo que MaKo sabe del lead en ESTE turno: las lecturas de la API de MaKo, en paralelo, por el
 * choke point del registro (`ejecutarOperacion`, que corre adentro del workspace del contexto y
 * decide con la vista de esta persona). Una lectura que falla no tumba el turno: el bloque dice
 * cuál no se pudo leer.
 */
export async function contextoDelLeadAhora(a: AnalystDelLead, sessionId: number): Promise<string> {
  const ctx: Ctx = {
    ws: a.persona.ws, canal: 'app', canalKey: canalKeyDeSesion(sessionId),
    alcance: 'lectura', rol: a.persona.rol, actor: a.persona.actor,
  };
  const vista = await vistaDe(ctx);
  const lecturas = await Promise.all(LECTURAS_DEL_LEAD.map(async (l): Promise<LecturaHecha> => {
    try {
      const r = await ejecutarOperacion(l.id, { leadId: a.lead.id }, ctx, 'json', vista);
      if (r.ok && r.tipo === 'lectura') return { id: l.id, ok: true, salida: r.resultado };
      if (!r.ok) console.error(`[mako-analyst] ws=${a.persona.ws} lead=${a.lead.id} ${l.id}: ${r.status} ${r.error.slice(0, 200)}`);
      return { id: l.id, ok: false };
    } catch (e) {
      console.error(`[mako-analyst] ws=${a.persona.ws} lead=${a.lead.id} ${l.id}:`, e instanceof Error ? e.message : String(e));
      return { id: l.id, ok: false };
    }
  }));
  return contextoDelLead({ leadId: a.lead.id, nombre: a.lead.nombre, lecturas });
}

/**
 * Un turno del chat del lead. `sessionId` null = la conversación de siempre de esta persona sobre
 * este lead, y si no hay ninguna, una nueva. Devuelve null si el id pedido no es de esta persona
 * sobre este lead (se mira ANTES de leer nada del lead para el modelo).
 */
export async function turnoDelLead(
  a: AnalystDelLead,
  sessionId: number | null,
  entrada: { mensaje: string; adjuntos?: AdjuntoListo[]; edicion?: { tab: string; nombre: string } | null },
): Promise<RespuestaTurno | null> {
  const suyas = await listarSesiones(a.persona);
  let sid: number;
  if (sessionId != null) {
    if (!suyas.some((s) => s.id === sessionId)) return null;
    sid = sessionId;
  } else {
    sid = suyas[0]?.id ?? (await nuevaSesion(a.persona)).id;
  }
  const contexto = await contextoDelLeadAhora(a, sid);
  // EDITANDO LA VISTA (17/10/2026): el mismo chat, pero lo que se pide es cambiar la ficha del CRM del lead. El CRM sale
  // del lead (server), nunca de la pantalla; de la pantalla sólo la hoja abierta, saneada en la ruta (`edicionDe`).
  const { edicion, ...resto } = entrada;
  if (!edicion) return turnoApp(a.persona, sid, { ...resto, contexto });
  return turnoApp(a.persona, sid, {
    ...resto,
    contexto: `${contexto}\n\n${contextoDeEdicion({ ...edicion, embudoId: a.lead.funnelId })}`,
    pista: PISTA_EDICION_FICHA,
  });
}

/** Confirmar o cancelar desde la tarjeta: el ciclo de siempre (reclamar → ejecutar, con el gating
 *  mirado otra vez), con la clave de ESTA conversación. */
export async function tarjetaDelLead(a: AnalystDelLead, accion: 'confirmar' | 'cancelar', sessionId: number, pendienteId: number): Promise<ResultadoTarjeta> {
  return accion === 'confirmar'
    ? confirmarDesdeTarjeta(a.persona, sessionId, pendienteId)
    : cancelarDesdeTarjeta(a.persona, sessionId, pendienteId);
}
