// =============================================================================
// tickets-api — lo que la API de MaKo dice de un ticket, y quién lo pide por cada canal
// =============================================================================
// Martín, 9/11/2026: «hoy en día en la API ni siquiera se pueden levantar tickets, y sí se debería». Desde el 10/11/2026 la
// Ticketera sale por /api/v1 (lib/api-mako/areas/tickets.def.ts): levantar, listar, ver uno con su conversación y contestarlo.
//
// ⚠️ QUIÉN PIDE NO ES UN PARÁMETRO. En la app es el email de la sesión y por WhatsApp `whatsapp:<teléfono>` (`ctx.actor`). Por
// HTTP, `ctx.actor` es el NOMBRE DEL TOKEN («API · token «x»»), que lo escribió una persona y puede traer una «@»: leído como
// email, firmaba el ticket con lo que dijera el nombre. Por HTTP firma la PERSONA que creó el token detallado (`ctx.persona`, que
// `autenticar` sólo pone si sigue administrando el negocio). Un token CLÁSICO no trae persona: lo que propone lo firma quien lo
// confirma en la bandeja (/mako/pendientes), y su lista es la del negocio entero (los dos tokens son del admin).
//
// ⚠️ LO DEL TRIAGE NO SALE: ni el porqué, ni la confianza, ni la nota de Martín (`paraElCliente`). Sale una sola cosa del triage,
// que es del negocio y no del equipo: si entró por la VÍA LIBRE de su negocio («Aprobado por regla: Leandro», lib/tickets-reglas.ts
// → APROBADOS_POR_REGLA). Es lo que le dice a su Claude que no hay que esperar a Martín.
//
// SIN `server-only`: puro, con test (tests/tickets-api.test.ts).
// =============================================================================

import { esRefDelSistema, paraElCliente, type EstadoTicket, type TicketCliente, type TipoTicket, type Triage } from './tickets-reglas';

/** Lo que el canal sabe de quien pide (un `Ctx` de la API de MaKo, sin importarla: esto es puro). */
export type QuienPideCtx = { canal: string; actor?: string; persona?: string };

/**
 * Con qué identidad se busca a quien pide (`identidadDelActor`, lib/tickets-db.ts): un email o `whatsapp:<…>`. null = el canal
 * no sabe quién es (un token clásico por HTTP), y entonces no se inventa: firma quien lo confirme.
 */
export function quienPideElTicket(ctx: QuienPideCtx): string | null {
  if (ctx.canal === 'http') {
    const p = (ctx.persona ?? '').trim().toLowerCase();
    return p.includes('@') ? p : null;
  }
  const a = (ctx.actor ?? '').trim();
  return a || null;
}

/** Cuáles se listan. «abiertos» son los que todavía no se cerraron (aunque estén esperando la respuesta de la persona). */
export const FILTROS_TICKETS = ['abiertos', 'cerrados', 'todos'] as const;
export type FiltroTickets = (typeof FILTROS_TICKETS)[number];
const CERRADOS: readonly EstadoTicket[] = ['resuelto', 'rechazado', 'duplicado'];
export const esCerrado = (e: EstadoTicket): boolean => CERRADOS.includes(e);
export function pasaElFiltro(e: EstadoTicket, f: FiltroTickets): boolean {
  if (f === 'todos') return true;
  return f === 'cerrados' ? esCerrado(e) : !esCerrado(e);
}

/** La fila que necesita la API: la del cliente (`paraElCliente`) más quién lo levantó y la marca de la vía libre. */
export type FilaParaLaApi = Parameters<typeof paraElCliente>[0] & {
  usuario_nombre?: string | null; usuario_email?: string | null; ref?: string | null; triage?: Triage | null; tipo: TipoTicket;
};
export type EventoParaLaApi = Parameters<typeof paraElCliente>[1] extends readonly (infer X)[] | undefined ? X : never;

export type TicketDeLaApi = {
  numero: string;
  id: number;
  titulo: string;
  tipo: TipoTicket;
  /** El estado como lo ve la persona: recibido, en_curso, tu_respuesta, resuelto o cerrado. */
  estado: TicketCliente['estado'];
  rotulo: string;
  /** Quién lo levantó, por su nombre (o «MaKo» si lo abrió solo, al fallar algo). */
  levantadoPor: string;
  /** true si lo levantó la persona del token (sólo se sabe con un token detallado). */
  tuyo?: true;
  /** Por dónde se levantó, en palabras («Desde la API de MaKo»). */
  canal: string | null;
  /** El nombre de la vía libre de su negocio si entró por ella: no espera la decisión de Martín. null = lo decide el equipo. */
  aprobadoPorRegla: string | null;
  respuesta: string | null;
  puedeResponder: boolean;
  creado: string;
  actualizado: string;
  /** Sólo en el detalle (`ver_ticket`): la conversación y cada cambio de estado con su fecha. */
  conversacion?: TicketCliente['lineas'];
  historial?: TicketCliente['historial'];
};

function levantadoPor(f: FilaParaLaApi): string {
  if (esRefDelSistema(f.ref ?? null)) return 'MaKo (lo abrió solo, al fallar algo)';
  const nombre = (f.usuario_nombre ?? '').trim();
  if (nombre) return nombre;
  const email = (f.usuario_email ?? '').trim();
  // `whatsapp:<teléfono>` o `whatsapp:<nombre>`: es alguien que escribió por el grupo y no tiene cuenta.
  if (email.startsWith('whatsapp:')) return 'Alguien por WhatsApp';
  return email || 'Alguien del negocio';
}

/** Un ticket como sale por la API. `conDetalle` agrega la conversación y el historial (el de `ver_ticket`). */
export function ticketParaLaApi(
  f: FilaParaLaApi,
  opts: { eventos?: readonly EventoParaLaApi[]; conDetalle?: boolean; emailDeQuienPide?: string | null } = {},
): TicketDeLaApi {
  const c = paraElCliente(f, opts.eventos ?? []);
  const regla = typeof f.triage?.regla === 'string' && f.triage.regla.trim() && f.triage.autoArreglo ? f.triage.regla.trim() : null;
  const tuyo = !!opts.emailDeQuienPide && (f.usuario_email ?? '').trim().toLowerCase() === opts.emailDeQuienPide.trim().toLowerCase();
  return {
    numero: `#${c.id}`, id: c.id, titulo: c.titulo, tipo: c.tipo, estado: c.estado, rotulo: c.rotulo,
    levantadoPor: levantadoPor(f), ...(tuyo ? { tuyo: true as const } : {}), canal: c.canal,
    aprobadoPorRegla: regla, respuesta: c.respuesta, puedeResponder: c.puedeResponder,
    creado: c.creado, actualizado: c.actualizado,
    ...(opts.conDetalle ? { conversacion: c.lineas, historial: c.historial } : {}),
  };
}

/** Lo que se le dice a quien lo levantó, según cómo nació: la vía libre, el arreglo automático o la decisión del equipo. */
export function queSigue(t: { autoArreglo: boolean; regla?: string | null }): string {
  if (t.autoArreglo && t.regla?.trim()) return `Entró por la vía libre de tu negocio (${t.regla.trim()}): ya está yendo a arreglarse sin esperar al equipo.`;
  if (t.autoArreglo) return 'Es algo que debería andar: ya está yendo a arreglarse.';
  return 'Le llegó al equipo: lo deciden y te contestan en el ticket.';
}
