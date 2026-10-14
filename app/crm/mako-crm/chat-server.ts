// =============================================================================
// El chat de MaKo del CRM — quién pregunta, qué CRM, y el turno con sus datos atados
// =============================================================================
// Lo usa app/api/crm/mako/route.ts. Es lib/mako-analyst-lead.ts (el MaKo Analyst de la ficha) al nivel
// del CRM, y por lo mismo NO HAY MOTOR NUEVO: el turno es el del chat de la app (lib/mako-turno-app.ts),
// con sus herramientas por intención, las acciones que PROPONEN y se confirman en la tarjeta (con el
// gating mirado otra vez al confirmar), el modelo del doer (Gemini, `sinFallbackClaude`: nada pago) y
// la misma red. Acá se decide sólo lo propio:
//
//   · QUIÉN: la sesión ADENTRO (el proxy no alcanza), el workspace de la sesión (`getWorkspaceActual`,
//     nunca un `?ws=` crudo) y el permiso de VER EL CRM (`puedeVerKey('crm', …)`, la regla del Sidebar).
//   · QUÉ CRM: el pedido, validado contra los del workspace con la regla de /crm (`crmDeLaPantalla`):
//     un id ajeno es el del negocio, nunca el de otro inquilino.
//   · DE QUIÉN ES LA CONVERSACIÓN: de esa persona sobre ese CRM (`chartKeyDelCrm`). Las funciones del
//     turno comparan la clave en cada lectura (`sesionDe`), así que un id ajeno contesta «no encuentro».
//   · QUÉ SABE MaKo: las lecturas de `LECTURAS_DEL_CRM`, por el choke point (`ejecutarOperacion`) con el
//     ROL de quien pregunta, en CADA turno, al FINAL del system y sin guardarse en el hilo.
// =============================================================================

import 'server-only';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getRolWsEfectivo, getCapaActual, runWithWorkspace } from '@/lib/workspace';
import { puedeVerKey } from '@/lib/movil-rutas';
import { ejecutarOperacion, vistaDe } from '@/lib/api-mako/ejecutar';
import type { Ctx } from '@/lib/api-mako/tipos';
import {
  listarSesiones, abrirSesion, nuevaSesion, turnoApp, confirmarDesdeTarjeta, cancelarDesdeTarjeta, type PersonaChat,
} from '@/lib/mako-turno-app';
import {
  chartKeyDePersona, canalKeyDeSesion,
  type MensajeChat, type RespuestaTurno, type ResultadoTarjeta, type SesionChat, type TarjetaPendiente,
} from '@/lib/mako-turno-app-reglas';
import type { LecturaHecha } from '@/lib/mako-analyst-lead-reglas';
import { crmDeLaPantalla, type CrmDeLaPantalla } from '@/lib/sugerencias-crm-server';
import { chartKeyDelCrm, crmIdDe, contextoDelCrm, lecturasDe } from './chat-reglas';

export type ChatDelCrm = { persona: PersonaChat; crm: CrmDeLaPantalla };
export type FalloChatCrm = { error: string; status: 400 | 401 | 403 | 404 };

/**
 * La persona del request sobre ESTE CRM, o por qué no. Sin `crm` (o con uno que no es del workspace),
 * el del negocio: es lo que dibuja /crm sin `?funnel=`.
 */
export async function chatDelRequest(crmCrudo: unknown): Promise<ChatDelCrm | FalloChatCrm> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'Tu sesión venció.', status: 401 };
  const rolWs = await getRolWsEfectivo();
  if (!rolWs) return { error: 'Tu sesión venció.', status: 401 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Elige una cuenta primero.', status: 400 };
  const capa = await getCapaActual().catch(() => null);
  if (!puedeVerKey('crm', rolWs, capa)) return { error: 'El CRM no está en tu cuenta.', status: 403 };
  // Si la lectura FALLA, tira (la ruta contesta 500): «no pude leer» no es «no hay CRM».
  const crm = await runWithWorkspace(ws, () => crmDeLaPantalla(crmIdDe(crmCrudo)));
  if (!crm) return { error: 'Este negocio todavía no tiene un CRM.', status: 404 };
  const chartKey = chartKeyDelCrm(chartKeyDePersona(sesion), crm.id);
  if (!chartKey) return { error: 'Tu sesión venció.', status: 401 };
  return {
    persona: { ws, rol: rolWs === 'admin' ? 'admin' : 'miembro', actor: sesion.email || sesion.nombre || sesion.sub, chartKey },
    crm,
  };
}

export type ConversacionDelCrm = { sesion: SesionChat | null; mensajes: MensajeChat[]; propuestas: TarjetaPendiente[] };

/**
 * La conversación de esta persona sobre este CRM: la más reciente (UNA por CRM y persona), o ninguna.
 * Sin sesión no se crea nada: se crea con el primer mensaje. ⚠️ ESCRIBE (`pendientesVigentes` vence lo
 * vencido antes de leer): se llama al ABRIR el panel, nunca al montar el botón plegado.
 */
export async function abrirDelCrm(c: ChatDelCrm): Promise<ConversacionDelCrm> {
  const [ultima] = await listarSesiones(c.persona);
  if (!ultima) return { sesion: null, mensajes: [], propuestas: [] };
  return (await abrirSesion(c.persona, ultima.id)) ?? { sesion: null, mensajes: [], propuestas: [] };
}

/** Lo que MaKo sabe del CRM en ESTE turno: las lecturas, en paralelo, por el choke point. Una que falla no tumba el turno. */
export async function contextoDelCrmAhora(c: ChatDelCrm, sessionId: number): Promise<string> {
  const ctx: Ctx = {
    ws: c.persona.ws, canal: 'app', canalKey: canalKeyDeSesion(sessionId),
    alcance: 'lectura', rol: c.persona.rol, actor: c.persona.actor,
  };
  const vista = await vistaDe(ctx);
  const lecturas = await Promise.all(lecturasDe(c.crm.esDefault).map(async (l): Promise<LecturaHecha> => {
    try {
      const r = await ejecutarOperacion(l.id, l.input(c.crm.id), ctx, 'json', vista);
      if (r.ok && r.tipo === 'lectura') return { id: l.id, ok: true, salida: r.resultado };
      if (!r.ok) console.error(`[mako-crm] ws=${c.persona.ws} crm=${c.crm.id} ${l.id}: ${r.status} ${r.error.slice(0, 200)}`);
      return { id: l.id, ok: false };
    } catch (e) {
      console.error(`[mako-crm] ws=${c.persona.ws} crm=${c.crm.id} ${l.id}:`, e instanceof Error ? e.message : String(e));
      return { id: l.id, ok: false };
    }
  }));
  return contextoDelCrm({ crm: { id: c.crm.id, nombre: c.crm.nombre, principal: c.crm.esDefault }, lecturas });
}

/**
 * Un turno del chat del CRM. `sessionId` null = la conversación de siempre de esta persona sobre este
 * CRM, y si no hay ninguna, una nueva. null si el id pedido no es de esta persona sobre este CRM (se
 * mira ANTES de leer nada para el modelo).
 */
export async function turnoDelCrm(c: ChatDelCrm, sessionId: number | null, entrada: { mensaje: string }): Promise<RespuestaTurno | null> {
  const suyas = await listarSesiones(c.persona);
  let sid: number;
  if (sessionId != null) {
    if (!suyas.some((s) => s.id === sessionId)) return null;
    sid = sessionId;
  } else {
    sid = suyas[0]?.id ?? (await nuevaSesion(c.persona)).id;
  }
  const contexto = await contextoDelCrmAhora(c, sid);
  return turnoApp(c.persona, sid, { mensaje: entrada.mensaje, contexto });
}

/** Confirmar o cancelar desde la tarjeta: el ciclo de siempre (reclamar → ejecutar, con el gating otra vez). */
export async function tarjetaDelCrm(c: ChatDelCrm, accion: 'confirmar' | 'cancelar', sessionId: number, pendienteId: number): Promise<ResultadoTarjeta> {
  return accion === 'confirmar'
    ? confirmarDesdeTarjeta(c.persona, sessionId, pendienteId)
    : cancelarDesdeTarjeta(c.persona, sessionId, pendienteId);
}
