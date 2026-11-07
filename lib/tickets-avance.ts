// =============================================================================
// tickets-avance — cuándo se le manda un email de avance a quien levantó el ticket (2/11/2026)
// =============================================================================
// Joan, por WhatsApp: «¿cómo van esos tickets?». No tenía forma de saberlo.
//
// Martín: «crea diferentes estados como para ir avisándole al usuario de cómo está avanzando su
// ticket… y también sería bueno de que se le envíe por email los avances. Y solamente cuando ya
// esté 100 % finalizado, ahí sí el mensaje de WhatsApp que ya tenemos».
//
// ⚠️ LO QUE YA EXISTÍA Y NO HUBO QUE CONSTRUIR: los estados de cara al cliente (`EstadoCliente`,
// lib/tickets-reglas.ts) y la línea de tiempo con fechas (`pasosDelTicket`). Y el WhatsApp YA sale
// sólo al final. Lo único que faltaba era avisar del avance en el medio.
//
// ⚠️ ESTE ARCHIVO ES PURO y no manda nada: decide. Lo que toca la base y Resend va aparte, para que
// la regla —que es lo que se puede equivocar— se pueda EJECUTAR en un test.
// =============================================================================

import { esRefDelSistema, estadoParaElCliente, type EstadoCliente, type EstadoTicket } from './tickets-reglas';
import { conWs } from './ws-tab';

/** El orden en que un ticket avanza de cara a quien lo levantó. Un email sólo sale hacia ADELANTE. */
export const ORDEN_AVANCE: readonly EstadoCliente[] = ['recibido', 'en_curso', 'tu_respuesta', 'resuelto', 'cerrado'];

/**
 * Qué hitos merecen un correo.
 *
 * ⚠️ 'cerrado' NO manda correo: el cierre ya se avisa por push, por el chat y por WhatsApp
 * (`avisarPendientes`, lib/tickets-cierre.ts). Un correo más sería el cuarto aviso de lo mismo, y
 * Martín pidió explícitamente que el final siga siendo el WhatsApp que ya existe.
 */
export const HITOS_QUE_AVISAN: ReadonlySet<EstadoCliente> = new Set(['recibido', 'en_curso', 'tu_respuesta', 'resuelto']);

/** Lo que dice el asunto de cada hito. Son las palabras del pedido de Martín. */
export const ASUNTO_DEL_HITO: Record<EstadoCliente, string> = {
  recibido: 'Recibimos tu ticket',
  en_curso: 'Ya lo estamos desarrollando',
  tu_respuesta: 'Necesitamos un dato tuyo',
  resuelto: 'Tu ticket está resuelto',
  cerrado: 'Tu ticket se cerró',
};

/**
 * ¿Le toca un email de avance a este ticket?
 *
 * `ahora` es el hito de hoy; `avisado` es el último que YA se le mandó (la columna `avance_email`,
 * migración 0364).
 *
 * ⚠️ SÓLO HACIA ADELANTE, y es la regla que evita el correo por rebote. Un ticket que vuelve de
 * «esperando cliente» a «en curso» NO manda otro «ya lo estamos desarrollando»: ese hito ya se
 * avisó. Sin esto, un ticket que rebota tres veces manda tres correos iguales y el próximo lo
 * manda a spam.
 */
export function tocaAvisarAvance(ahora: EstadoCliente, avisado: EstadoCliente | null | undefined): boolean {
  if (!HITOS_QUE_AVISAN.has(ahora)) return false;
  if (!avisado) return true;
  const i = ORDEN_AVANCE.indexOf(ahora);
  const j = ORDEN_AVANCE.indexOf(avisado);
  // Un hito desconocido en la base (un valor viejo, o escrito a mano) no habilita nada: se prefiere
  // no mandar a mandar de más.
  if (i < 0 || j < 0) return false;
  return i > j;
}

/** La línea que dice en qué anda. También es el texto de vista previa del correo. */
export const LINEA_DEL_HITO: Record<EstadoCliente, string> = {
  recibido: 'Lo recibimos y ya está en la lista del equipo.',
  en_curso: 'El equipo lo revisó y ya lo está desarrollando.',
  tu_respuesta: 'Necesitamos que nos contestes algo para poder seguir.',
  resuelto: 'Ya está resuelto.',
  cerrado: 'Se cerró.',
};

/**
 * El cuerpo del correo, en palabras y sin jerga. Lleva el link, que es lo que Joan no tenía.
 *
 * ⚠️ NADA DE ESTO LO ESCRIBE UN MODELO: es texto fijo con el número que pone el código, igual que
 * la respuesta del grupo (lib/despacho-grupo.ts). Un ticket es la relación con un cliente y no se
 * la deja improvisar.
 */
export function cuerpoDelAvance(
  hito: EstadoCliente, t: { id: number; titulo: string }, base: string,
  opts: { ws?: number | null; baja?: string | null } = {},
): string {
  const link = linkDelTicket(t.id, base, opts.ws ?? null);
  return [
    `Tu ticket #${t.id}: ${t.titulo}`,
    '',
    LINEA_DEL_HITO[hito],
    '',
    `Puedes ver cómo va aquí: ${link}`,
    ...(opts.baja ? ['', `Si no quieres recibir estos correos: ${opts.baja}`] : []),
  ].join('\n');
}

/**
 * El link a su ticket: la base + `conWs`, que es lo mismo que `linkApp` (lib/app-url.ts) con la base por parámetro para que
 * se pueda probar. Con el negocio pegado, como todo link que sale de MaKo (AGENTS.md, «la quinta forma de navegar»).
 */
export function linkDelTicket(id: number, base: string, ws: number | null): string {
  return `${base.replace(/\/+$/u, '')}${conWs(`/tickets?t=${id}`, ws)}`;
}

// ── A quién le sale, y cuándo (4/11/2026) ─────────────────────────────────────────────────────────────────────────
// Joan pidió el 2/11 que «se le envíe por email los avances». Lo de arriba decidía QUÉ hito avisa; esto decide A QUIÉN, y
// es lo que hace que no sea spam.

/**
 * La clave de `usuarios.perfil` donde la persona apagó estos correos (con el link del pie del correo,
 * app/api/email/unsubscribe/tickets). Ausente = prendidos; sólo `false` apaga.
 */
export const CLAVE_PERFIL_CORREOS = 'ticketsPorEmail';
export const apagoLosCorreos = (perfil: unknown): boolean =>
  !!perfil && typeof perfil === 'object' && (perfil as Record<string, unknown>)[CLAVE_PERFIL_CORREOS] === false;

/**
 * La familia de correos que apaga una fila de `correo_bajas` (mig 0410). Hoy una sola: la baja de los correos de los
 * tickets no apaga, por ejemplo, un aviso de cambio de plan.
 */
export const TIPO_BAJA_TICKETS = 'ticket-avance';

/**
 * ⚠️ LA BAJA SE PREGUNTA DOS VECES, Y NO ES REDUNDANCIA (6/11/2026).
 *
 * `apagoLosCorreos` mira la FILA de `usuarios`, y una fila de `usuarios` no es una persona: es una persona EN UN NEGOCIO
 * (`usuarios(email)` no es único). Quien trabaja en su cuenta y en la de un cliente de su agencia tiene dos filas con la
 * misma dirección: apretar «Dejar de recibirlos» en el correo de una no frenaba los de la otra, y para la persona —que ve
 * una sola casilla de correo— eso es «pedí la baja y me siguen llegando».
 *
 * `correo_bajas` lo guarda por DIRECCIÓN, que es lo que la persona reconoce como «a mí». Por eso la pregunta por email va
 * DESPUÉS de la del perfil y no la reemplaza: la del perfil sigue siendo la que la persona ve en su cuenta.
 */
export const pidioLaBaja = (email: string, bajas: ReadonlySet<string> | null | undefined): boolean =>
  !!bajas && bajas.has(email.trim().toLowerCase());

/**
 * Cuántas horas atrás se mira. Un ticket que no cambió en dos días no manda nada: así, el día que esto se prende no le
 * llega a nadie un correo por tickets viejos que ya se avisaron por el chat o por WhatsApp. Lo que cambia de verdad pone
 * `updated_at` (decidir, cerrar, marcar arreglado) y entra solo en la vuelta siguiente del cron, que es cada 15 minutos.
 */
export const HORAS_DEL_AVANCE = 48;
/** Cuántos correos salen como mucho en una vuelta del cron (cada 15 minutos). Lo que no entra, sale en la siguiente. */
export const TOPE_POR_VUELTA = 30;

export type TicketDelAvance = {
  id: number; titulo: string; estado: EstadoTicket | string; workspace_id: number;
  usuario_id: number | null; canal: string | null; ref: string | null; avance_email: EstadoCliente | string | null;
};
export type PersonaDelAvance = { id: number; email: string | null; workspace_id: number | null; estado: string | null; perfil: unknown };

/** Por qué NO le sale el correo, en una palabra (va al log de la vuelta, nunca a la persona). */
export type MotivoSinCorreo =
  | 'sin_hito' | 'automatico' | 'plataforma' | 'sin_persona' | 'otro_negocio' | 'suspendida' | 'sin_email' | 'apagado'
  /** Pidió la baja por su DIRECCIÓN (`correo_bajas`, mig 0410): vale para todas sus cuentas, no sólo para esta fila. */
  | 'baja_email';
export type DecisionAvance = { manda: true; hito: EstadoCliente; a: string } | { manda: false; motivo: MotivoSinCorreo };

const ESTADOS_DEL_CLIENTE: readonly string[] = ORDEN_AVANCE;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

/** El hito de HOY que todavía no se le avisó, o null. */
export function hitoPendiente(t: Pick<TicketDelAvance, 'estado' | 'avance_email'>): EstadoCliente | null {
  const ahora = estadoParaElCliente(t.estado as EstadoTicket);
  const avisado = t.avance_email && ESTADOS_DEL_CLIENTE.includes(t.avance_email) ? (t.avance_email as EstadoCliente) : t.avance_email ? ('?' as EstadoCliente) : null;
  return tocaAvisarAvance(ahora, avisado) ? ahora : null;
}

/**
 * ¿Le sale el correo, y a qué dirección? Todas las preguntas, en positivo:
 *  · hay un hito nuevo hacia adelante (`hitoPendiente`);
 *  · lo levantó una PERSONA, no el sistema: un automático (`esRefDelSistema`, el canal `sistema`) lo abrió MaKo por ella,
 *    y ya se lo dijo en el chat («Quedó el ticket #N»). Con un correo por cada uno, seis fallas en un día son seis
 *    «Recibimos tu ticket» de algo que nadie mandó;
 *  · no es el negocio de la PLATAFORMA (los tickets de Martín: se escribiría a sí mismo);
 *  · la persona tiene cuenta (`usuario_id`), es de ESTE negocio (no el super admin ni una agencia mirando un cliente) y no
 *    está suspendida;
 *  · su email es un email (un ticket por WhatsApp sin cuenta trae `whatsapp:<teléfono>`);
 *  · no los apagó en ESTA cuenta (`apagoLosCorreos`, su `usuarios.perfil`);
 *  · y no pidió la baja de su DIRECCIÓN (`correo_bajas`, mig 0410), que vale para todas sus cuentas.
 * La dirección sale de la FILA de la persona (la de hoy), no de la que quedó escrita en el ticket.
 */
export function decidirAvance(t: TicketDelAvance, persona: PersonaDelAvance | null, wsPlataforma: number | null, bajas?: ReadonlySet<string> | null): DecisionAvance {
  const hito = hitoPendiente(t);
  if (!hito) return { manda: false, motivo: 'sin_hito' };
  if (t.canal === 'sistema' || esRefDelSistema(t.ref)) return { manda: false, motivo: 'automatico' };
  if (wsPlataforma != null && Number(t.workspace_id) === wsPlataforma) return { manda: false, motivo: 'plataforma' };
  if (!t.usuario_id || !persona || Number(persona.id) !== Number(t.usuario_id)) return { manda: false, motivo: 'sin_persona' };
  if (persona.workspace_id == null || Number(persona.workspace_id) !== Number(t.workspace_id)) return { manda: false, motivo: 'otro_negocio' };
  if (persona.estado === 'suspendido') return { manda: false, motivo: 'suspendida' };
  const a = String(persona.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(a)) return { manda: false, motivo: 'sin_email' };
  if (apagoLosCorreos(persona.perfil)) return { manda: false, motivo: 'apagado' };
  if (pidioLaBaja(a, bajas)) return { manda: false, motivo: 'baja_email' };
  return { manda: true, hito, a };
}

/** `texto` es la parte de texto del correo (con la línea de la baja); `cuerpo`, el del HTML, que pone la baja en el pie. */
export type CorreoDelAvance = { ticket: number; ws: number; a: string; asunto: string; texto: string; cuerpo: string; previa: string; link: string; baja: string };

/** El correo entero de un hito: asunto con el número, el cuerpo fijo, el link a su ticket y el de la baja. */
export function armarCorreoDelAvance(hito: EstadoCliente, t: Pick<TicketDelAvance, 'id' | 'titulo' | 'workspace_id'>, a: string, base: string, baja: string): CorreoDelAvance {
  const ws = Number(t.workspace_id);
  return {
    ticket: t.id, ws, a,
    asunto: `${ASUNTO_DEL_HITO[hito]} · Ticket #${t.id}`,
    texto: cuerpoDelAvance(hito, t, base, { ws, baja }),
    cuerpo: cuerpoDelAvance(hito, t, base, { ws }),
    previa: LINEA_DEL_HITO[hito],
    link: linkDelTicket(t.id, base, ws),
    baja,
  };
}

/** Lo que la vuelta necesita de afuera. Se inyecta para que el orden (reclamar ANTES de mandar) se pruebe ejecutándolo. */
export type DepsAvance = {
  /** Los tickets que cambiaron en las últimas `HORAS_DEL_AVANCE` y todavía no avisaron «resuelto». */
  candidatos: () => Promise<TicketDelAvance[]>;
  personas: (ids: number[]) => Promise<PersonaDelAvance[]>;
  /**
   * Las direcciones (en minúsculas) que pidieron la baja, de entre las que se les iba a escribir (`correo_bajas`, mig
   * 0410). Se pregunta por las direcciones de la vuelta y no por toda la tabla: la tabla sólo crece.
   *
   * ⚠️ SI NO SE PUEDE LEER, TIRA, y la vuelta entera no manda nada: un correo a quien pidió la baja es peor que un correo
   * de menos (es la regla de la cabecera de lib/tickets-avance-email.ts). Sin esta función no se pregunta nada, que es
   * para los tests de la regla pura.
   */
  bajas?: (emails: string[]) => Promise<string[]>;
  /** Marca el hito ANTES de mandar, compare-and-set contra el que había. false = otro cron llegó antes. */
  reclamar: (id: number, antes: string | null, hito: EstadoCliente) => Promise<boolean>;
  mandar: (c: CorreoDelAvance) => Promise<{ ok: true } | { ok: false; error: string }>;
  anotar: (id: number, texto: string) => Promise<void>;
  wsPlataforma: number | null;
  base: string;
  bajaDe: (usuarioId: number) => string;
  tope?: number;
};
export type VueltaAvance = { enviados: number; fallidos: number; salteados: Partial<Record<MotivoSinCorreo | 'ganado', number>> };

/**
 * Una vuelta: un correo por hito nuevo, como mucho `tope`.
 *
 * ⚠️ SE MARCA ANTES DE MANDAR (AGENTS.md, «Marcar va ANTES de mandar, con compare-and-set»). Al revés, dos vueltas del
 * cron a la vez mandarían dos correos iguales. El costo es el opuesto y es el correcto: si Resend falla, ese hito no se
 * reintenta (queda anotado en el ticket) y el próximo hito avisa igual. Un correo de menos se nota menos que dos iguales.
 */
export async function avisarAvances(d: DepsAvance): Promise<VueltaAvance> {
  const out: VueltaAvance = { enviados: 0, fallidos: 0, salteados: {} };
  const saltear = (m: MotivoSinCorreo | 'ganado') => { out.salteados[m] = (out.salteados[m] ?? 0) + 1; };
  const tickets = (await d.candidatos()).filter((t) => hitoPendiente(t));
  if (!tickets.length) return out;
  const ids = [...new Set(tickets.map((t) => Number(t.usuario_id)).filter((n) => Number.isInteger(n) && n > 0))];
  const personas = new Map((ids.length ? await d.personas(ids) : []).map((p) => [Number(p.id), p]));
  // Las bajas por dirección, sólo de las direcciones de esta vuelta. Se pregunta UNA vez, antes del lazo: adentro serían
  // tantas lecturas como tickets. Si falla, `avisarAvances` tira y no se manda nada (ver `DepsAvance.bajas`).
  const correos = [...new Set([...personas.values()].map((p) => String(p.email ?? '').trim().toLowerCase()).filter(Boolean))];
  const bajas = d.bajas && correos.length ? new Set(await d.bajas(correos)) : null;
  const tope = d.tope ?? TOPE_POR_VUELTA;
  for (const t of tickets) {
    if (out.enviados + out.fallidos >= tope) break;
    const dec = decidirAvance(t, t.usuario_id ? personas.get(Number(t.usuario_id)) ?? null : null, d.wsPlataforma, bajas);
    if (!dec.manda) { saltear(dec.motivo); continue; }
    if (!(await d.reclamar(t.id, t.avance_email ?? null, dec.hito))) { saltear('ganado'); continue; }
    const correo = armarCorreoDelAvance(dec.hito, t, dec.a, d.base, d.bajaDe(Number(t.usuario_id)));
    const r = await d.mandar(correo).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    if (r.ok) {
      out.enviados++;
      await d.anotar(t.id, `Correo de avance: «${ASUNTO_DEL_HITO[dec.hito]}»`);
    } else {
      out.fallidos++;
      await d.anotar(t.id, `El correo de avance «${ASUNTO_DEL_HITO[dec.hito]}» no salió: ${r.error.slice(0, 160)}`);
    }
  }
  return out;
}
