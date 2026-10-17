import 'server-only';

// =============================================================================
// La Ticketera de los usuarios — la base (mig 0311)
// =============================================================================
// Las reglas puras viven en lib/tickets-reglas.ts; acá se lee y se escribe. Las tablas tienen RLS sin políticas y se
// leen con el cliente de servicio, así que EL CORTE POR INQUILINO LO HACE ESTE ARCHIVO, en cada función:
//   · lo del CLIENTE (`misTickets`, `miTicket`, `comentarComoCliente`) filtra SIEMPRE por workspace Y email: una
//     persona ve sus tickets, no los de su compañero ni los de otro negocio;
//   · lo de MARTÍN (`bandeja`, `ticketEntero`, `decidir`…) no filtra, y quien lo llama tiene que haber pasado por
//     `puedeOperar` (la bandeja de Ops Center) o ser el script de la PC (scripts/tickets.ts, con la base de .env.local).
// Lo fija tests/tickets.test.ts leyendo el fuente.
//
// ⚠️ EL TEXTO DEL CLIENTE ES DATO. Nada de acá lo interpreta: lo guarda, lo muestra y, para el Cerebro, lo imprime
// entre marcas (scripts/tickets.ts). El triage lo lee con reglas (lib/tickets-reglas.ts), sin mandarlo a ninguna IA.

import { getSupabaseServer } from './supabase';
import { getWorkspace, runWithWorkspace, wsSuperAdmin } from './workspace';
import { buscarUsuarioPorEmail } from './usuarios';
import { capaDef } from './capas';
import {
  TOPE_POR_DIA, clasificar, estadoDeDecision, estadoInicial, leerTriage, motivoDecisionInvalida, sePuedeDecidir,
  type Canal, type ContextoTicket, type DecisionTicket, type EstadoTicket, type Prioridad, type TipoTicket, type Triage,
  ESTADOS, PRIORIDADES, esTipo, mismoTelefono, sanearContexto, telefonoDelActor, TOPES,
} from './tickets-reglas';

const T = 'tickets';
const T_EV = 'ticket_eventos';
const FALTA_TABLA = new Set(['42P01', 'PGRST205']);
export const faltaTabla = (e: { code?: string | null } | null | undefined): boolean => !!e && FALTA_TABLA.has(e.code ?? '');

/** El mensaje cuando la mig 0311 todavía no está aplicada: la pantalla lo dice, no se cae. */
export const SIN_TABLA = 'La sección de tickets todavía no está disponible.';

// ── Las filas ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type FilaTicket = {
  id: number;
  created_at: string;
  updated_at: string;
  workspace_id: number;
  usuario_id: number | null;
  usuario_email: string;
  usuario_nombre: string;
  rol: string | null;
  plan: string | null;
  tipo: TipoTicket;
  tipo_manual: boolean;
  titulo: string;
  descripcion: string;
  canal: Canal;
  contexto: ContextoTicket;
  estado: EstadoTicket;
  prioridad: Prioridad;
  triage: Triage | null;
  decision: DecisionTicket | null;
  decision_nota: string | null;
  decidido_at: string | null;
  duplicado_de: number | null;
  respuesta: string | null;
  despacho: 'firmado' | 'runner' | null;
  pedido_id: string | null;
  despachado_at: string | null;
  aviso_estado: string | null;
  aviso_intentos: number;
  aviso_motivo: string | null;
  arreglado_at: string | null;
  arreglo_nota: string | null;
  resuelto_at: string | null;
  avisado_at: string | null;
  /** El nombre del negocio (join con workspaces), sólo en lo que lee Martín. */
  negocio?: string | null;
};

export type Evento = { id: number; at: string; actor: string; tipo: string; texto: string | null; datos: Record<string, unknown> | null };

const COLS = 'id, created_at, updated_at, workspace_id, usuario_id, usuario_email, usuario_nombre, rol, plan, tipo, tipo_manual, titulo, descripcion, canal, contexto, estado, prioridad, triage, decision, decision_nota, decidido_at, duplicado_de, respuesta, despacho, pedido_id, despachado_at, aviso_estado, aviso_intentos, aviso_motivo, arreglado_at, arreglo_nota, resuelto_at, avisado_at';

function aFila(f: Record<string, unknown>): FilaTicket {
  const ws = f.workspaces as { nombre?: unknown } | null | undefined;
  return {
    ...(f as unknown as FilaTicket),
    contexto: sanearContexto(f.contexto),
    triage: leerTriage(f.triage),
    estado: (ESTADOS as readonly unknown[]).includes(f.estado) ? f.estado as EstadoTicket : 'nuevo',
    prioridad: (PRIORIDADES as readonly unknown[]).includes(f.prioridad) ? f.prioridad as Prioridad : 'media',
    tipo: esTipo(f.tipo) ? f.tipo : 'bug',
    aviso_intentos: Number(f.aviso_intentos) || 0,
    ...(ws !== undefined ? { negocio: typeof ws?.nombre === 'string' ? ws.nombre : null } : {}),
  };
}

/** Anota en el historial. Si falla, el cambio ya quedó hecho: no se revierte por no poder anotarlo, pero se loguea. */
async function anotar(ticketId: number, actor: string, tipo: string, texto: string | null, datos?: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabaseServer().from(T_EV).insert({
    ticket_id: ticketId, actor, tipo, texto: texto ? texto.slice(0, TOPES.nota) : null, datos: datos ?? null,
  });
  if (error) console.error(`[tickets] no pude anotar «${tipo}» en #${ticketId}: ${error.message}`);
}

// ── Quién lo levanta ──────────────────────────────────────────────────────────────────────────────────────────────
export type Identidad = { ws: number; email: string; nombre: string; usuarioId: number | null; rol: string | null; plan: string | null };

/**
 * La foto de quién lo levanta, leída de la BASE con el email de la sesión (nunca de lo que diga el navegador): su
 * nombre, su rol en el negocio y el plan del negocio ESE día.
 */
export async function identidadDe(ws: number, email: string, nombreSesion = ''): Promise<Identidad> {
  const limpio = email.trim().toLowerCase();
  const [u, w] = await Promise.all([
    buscarUsuarioPorEmail(limpio).catch(() => null),
    getWorkspace(ws).catch(() => null),
  ]);
  const rol = !u ? null : u.rol === 'admin' ? 'admin de MaKo' : (u.rol_ws ?? 'admin');
  return {
    ws, email: limpio, nombre: (u?.nombre || nombreSesion || '').slice(0, 120), usuarioId: u ? Number(u.id) : null,
    rol, plan: w ? capaDef((w as { capa?: string | null }).capa ?? null).nombre : null,
  };
}

/**
 * Quién es el que pide por un canal: un email (la app) o `whatsapp:<teléfono>` (el doer de WhatsApp, que no sabe el
 * email). Por WhatsApp se busca en el negocio UNA persona con ese teléfono en su perfil: si la hay, el ticket es suyo y lo
 * ve también en /tickets; si no (o hay dos), queda con el teléfono como identidad. null = el actor no se entiende.
 */
export async function identidadDelActor(ws: number, actor: string | null | undefined): Promise<Identidad | null> {
  const a = String(actor ?? '').trim().toLowerCase();
  if (a.includes('@')) return identidadDe(ws, a);
  const tel = telefonoDelActor(a);
  if (!tel) return null;
  const { data } = await getSupabaseServer().from('usuarios').select('email, perfil')
    .eq('workspace_id', ws).neq('estado', 'suspendido').limit(200);
  const iguales = (data ?? []).filter((u) => mismoTelefono((u.perfil as { telefono?: string } | null)?.telefono, tel));
  if (iguales.length === 1) return identidadDe(ws, String(iguales[0].email));
  const w = await getWorkspace(ws).catch(() => null);
  return { ws, email: `whatsapp:${tel}`, nombre: '', usuarioId: null, rol: 'por WhatsApp', plan: w ? capaDef((w as { capa?: string | null }).capa ?? null).nombre : null };
}

// ── El interruptor y el tope del día ──────────────────────────────────────────────────────────────────────────────
/** La clave del interruptor del arreglo automático, en app_settings del workspace de la PLATAFORMA. */
export const CLAVE_AUTOARREGLO = 'tickets.autoarreglo';

/** ¿Martín apagó el arreglo automático? Si no se puede leer, se toma APAGADO: en la duda decide Martín. */
export async function autoArregloApagado(): Promise<boolean> {
  try {
    const ws = await wsSuperAdmin();
    const { data, error } = await getSupabaseServer().from('app_settings').select('value')
      .eq('workspace_id', ws).eq('key', CLAVE_AUTOARREGLO).maybeSingle();
    if (error) return true;
    return (data?.value as string | undefined) === 'apagado';
  } catch {
    return true;
  }
}

export async function ponerAutoArreglo(prendido: boolean): Promise<void> {
  const ws = await wsSuperAdmin();
  const { error } = await getSupabaseServer().from('app_settings')
    .upsert({ workspace_id: ws, key: CLAVE_AUTOARREGLO, value: prendido ? 'prendido' : 'apagado' }, { onConflict: 'workspace_id,key' });
  if (error) throw new Error(`No pude guardar el interruptor: ${error.message}`);
}

/** Cuántos arreglos automáticos salieron desde la medianoche UTC. Si no se puede contar, el tope (frena). */
async function arreglosDeHoy(): Promise<number> {
  const desde = new Date(); desde.setUTCHours(0, 0, 0, 0);
  const { count, error } = await getSupabaseServer().from(T).select('id', { count: 'exact', head: true })
    .eq('despacho', 'runner').gte('created_at', desde.toISOString());
  return error ? Number.POSITIVE_INFINITY : (count ?? 0);
}

// ── Crear ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export type NuevoTicket = {
  identidad: Identidad;
  tipo: TipoTicket | null;
  declaradoPor: 'mako' | 'persona' | null;
  titulo: string;
  descripcion: string;
  canal: Canal;
  contexto: unknown;
  /** Clave de idempotencia: el mismo `ref` devuelve el ticket que ya existe. */
  ref?: string | null;
};
export type Creado = { ok: true; id: number; estado: EstadoTicket; triage: Triage; yaExistia: boolean } | { ok: false; error: string };

export async function crearTicket(n: NuevoTicket): Promise<Creado> {
  const db = getSupabaseServer();
  const titulo = n.titulo.trim().slice(0, TOPES.titulo);
  const descripcion = n.descripcion.trim().slice(0, TOPES.descripcion);
  if (!titulo) return { ok: false, error: 'Escribe qué pasó' };
  if (n.ref) {
    const { data: ya } = await db.from(T).select('id, estado, triage').eq('ref', n.ref).maybeSingle();
    if (ya) return { ok: true, id: Number(ya.id), estado: ya.estado as EstadoTicket, triage: leerTriage(ya.triage)!, yaExistia: true };
  }
  // El tope del día: más que esto es un bucle o un abuso, no soporte.
  const hace24 = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: eCount } = await db.from(T).select('id', { count: 'exact', head: true })
    .eq('workspace_id', n.identidad.ws).eq('usuario_email', n.identidad.email).gte('created_at', hace24);
  if (eCount) return { ok: false, error: faltaTabla(eCount) ? SIN_TABLA : 'No pude guardarlo: vuelve a intentarlo' };
  if ((count ?? 0) >= TOPE_POR_DIA) return { ok: false, error: `Ya mandaste ${TOPE_POR_DIA} tickets hoy: el equipo los está viendo` };

  const contexto = sanearContexto(n.contexto);
  const [apagado, arreglosHoy] = await Promise.all([autoArregloApagado(), arreglosDeHoy()]);
  const triage = clasificar({ tipoDeclarado: n.tipo, declaradoPor: n.declaradoPor, titulo, descripcion, contexto }, { apagado, arreglosHoy });
  const estado = estadoInicial(triage);
  const { data, error } = await db.from(T).insert({
    ref: n.ref ?? null,
    workspace_id: n.identidad.ws, usuario_id: n.identidad.usuarioId, usuario_email: n.identidad.email,
    usuario_nombre: n.identidad.nombre, rol: n.identidad.rol, plan: n.identidad.plan,
    tipo: triage.tipo, titulo, descripcion, canal: n.canal, contexto,
    estado, prioridad: triage.prioridad, triage,
    despacho: triage.autoArreglo ? 'runner' : null,
  }).select('id').single();
  if (error) {
    if (error.code === '23505' && n.ref) return crearTicket({ ...n }); // otro pedido con el mismo ref ganó: devuelve ése
    return { ok: false, error: faltaTabla(error) ? SIN_TABLA : 'No pude guardarlo: vuelve a intentarlo' };
  }
  const id = Number(data.id);
  await anotar(id, n.declaradoPor === 'mako' ? 'mako' : 'cliente', 'creado', null, { canal: n.canal });
  await anotar(id, 'triage', 'clasificado', triage.porque.join(' '), { tipo: triage.tipo, autoArreglo: triage.autoArreglo, confianza: triage.confianza });
  return { ok: true, id, estado, triage, yaExistia: false };
}

// ── Lo del CLIENTE: siempre su workspace y su email ───────────────────────────────────────────────────────────────
export type Lectura<X> = { ok: true; datos: X } | { ok: false; faltaTabla: boolean; error: string };

export async function misTickets(ws: number, email: string): Promise<Lectura<FilaTicket[]>> {
  const { data, error } = await getSupabaseServer().from(T).select(COLS)
    .eq('workspace_id', ws).eq('usuario_email', email.trim().toLowerCase())
    .order('updated_at', { ascending: false }).limit(100);
  if (error) return { ok: false, faltaTabla: faltaTabla(error), error: error.message };
  return { ok: true, datos: (data ?? []).map((f) => aFila(f as Record<string, unknown>)) };
}

export async function miTicket(ws: number, email: string, id: number): Promise<{ ticket: FilaTicket; eventos: Evento[] } | null> {
  const db = getSupabaseServer();
  const { data, error } = await db.from(T).select(COLS)
    .eq('id', id).eq('workspace_id', ws).eq('usuario_email', email.trim().toLowerCase()).maybeSingle();
  if (error || !data) return null;
  const { data: ev } = await db.from(T_EV).select('id, at, actor, tipo, texto, datos').eq('ticket_id', id).order('at');
  return { ticket: aFila(data as Record<string, unknown>), eventos: (ev ?? []) as Evento[] };
}

/** La persona contesta su ticket (cuando Martín le preguntó algo, o para sumar un dato). Vuelve a la bandeja. */
export async function comentarComoCliente(ws: number, email: string, id: number, texto: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = texto.trim();
  if (!t) return { ok: false, error: 'Escribe tu respuesta' };
  if (t.length > TOPES.nota) return { ok: false, error: `Acórtala a ${TOPES.nota} caracteres` };
  const db = getSupabaseServer();
  const { data: tk } = await db.from(T).select('id, estado').eq('id', id).eq('workspace_id', ws).eq('usuario_email', email.trim().toLowerCase()).maybeSingle();
  if (!tk) return { ok: false, error: 'No encuentro ese ticket' };
  if (tk.estado === 'resuelto' || tk.estado === 'rechazado' || tk.estado === 'duplicado') return { ok: false, error: 'Ese ticket ya está cerrado: levanta uno nuevo' };
  await anotar(id, 'cliente', 'comentario', t);
  // Si Martín le había preguntado, la respuesta lo devuelve a la bandeja (Intercom: «Waiting on customer» → «In progress»).
  await db.from(T).update({ estado: tk.estado === 'esperando_cliente' ? 'esperando_decision' : tk.estado, updated_at: new Date().toISOString() }).eq('id', id);
  return { ok: true };
}

// ── Lo de MARTÍN: quien llama ya pasó por `puedeOperar` ───────────────────────────────────────────────────────────
export async function bandeja(limite = 200): Promise<Lectura<FilaTicket[]>> {
  const { data, error } = await getSupabaseServer().from(T).select(`${COLS}, workspaces(nombre)`)
    .order('created_at', { ascending: false }).limit(limite);
  if (error) return { ok: false, faltaTabla: faltaTabla(error), error: error.message };
  return { ok: true, datos: (data ?? []).map((f) => aFila(f as Record<string, unknown>)) };
}

export async function ticketEntero(id: number): Promise<{ ticket: FilaTicket; eventos: Evento[] } | null> {
  const db = getSupabaseServer();
  const { data, error } = await db.from(T).select(`${COLS}, workspaces(nombre)`).eq('id', id).maybeSingle();
  if (error || !data) return null;
  const { data: ev } = await db.from(T_EV).select('id, at, actor, tipo, texto, datos').eq('ticket_id', id).order('at');
  return { ticket: aFila(data as Record<string, unknown>), eventos: (ev ?? []) as Evento[] };
}

/** Cuántos esperan a Martín: el número del botón «Ticketera». */
export async function cuantosEsperan(): Promise<number | null> {
  const { count, error } = await getSupabaseServer().from(T).select('id', { count: 'exact', head: true }).eq('estado', 'esperando_decision');
  return error ? null : (count ?? 0);
}

export type EntradaDecision = { decision: DecisionTicket; respuesta?: string | null; nota?: string | null; duplicadoDe?: number | null; pedidoId?: string | null };

/**
 * Martín decide. Compare-and-set sobre el estado: dos pestañas no deciden dos veces, y un ticket ya cerrado no se
 * vuelve a decidir (se reabre aparte). Lo que va al Cerebro sale firmado DESDE EL NAVEGADOR antes de llamar a esto: acá
 * sólo se guarda el id de ese trabajo (`pedidoId`).
 */
export async function decidir(id: number, d: EntradaDecision, actor = 'martin'): Promise<{ ok: true; estado: EstadoTicket } | { ok: false; error: string }> {
  const motivo = motivoDecisionInvalida(d);
  if (motivo) return { ok: false, error: motivo };
  const db = getSupabaseServer();
  const { data: tk } = await db.from(T).select('id, estado').eq('id', id).maybeSingle();
  if (!tk) return { ok: false, error: 'No encuentro ese ticket' };
  if (!sePuedeDecidir(tk.estado as EstadoTicket)) return { ok: false, error: 'Ese ticket ya está cerrado' };
  if (!sePuedeDecidir(tk.estado as EstadoTicket, d.decision)) return { ok: false, error: 'Ya está en curso: el Cerebro ya lo tiene' };
  if (d.decision === 'duplicado') {
    if (d.duplicadoDe === id) return { ok: false, error: 'Un ticket no es duplicado de sí mismo' };
    const { data: orig } = await db.from(T).select('id').eq('id', d.duplicadoDe!).maybeSingle();
    if (!orig) return { ok: false, error: `No existe el ticket #${d.duplicadoDe}` };
  }
  const estado = estadoDeDecision(d.decision);
  const ahora = new Date().toISOString();
  const cierra = estado === 'resuelto' || estado === 'rechazado' || estado === 'duplicado';
  const { data, error } = await db.from(T).update({
    estado, decision: d.decision, decidido_at: ahora, updated_at: ahora,
    respuesta: (d.respuesta ?? '').trim() || null,
    decision_nota: (d.nota ?? '').trim().slice(0, TOPES.nota) || null,
    duplicado_de: d.decision === 'duplicado' ? d.duplicadoDe : null,
    ...(d.pedidoId ? { despacho: 'firmado', pedido_id: d.pedidoId, despachado_at: ahora } : {}),
    ...(cierra ? { resuelto_at: ahora, avisado_at: null } : {}),
    // Preguntarle al cliente también se le avisa: el aviso se marca al mandarlo.
    ...(estado === 'esperando_cliente' ? { avisado_at: null } : {}),
  }).eq('id', id).eq('estado', tk.estado).select('id');
  if (error) return { ok: false, error: 'No pude guardarlo: vuelve a intentarlo' };
  if (!data?.length) return { ok: false, error: 'Alguien lo cambió recién: recarga' };
  await anotar(id, actor, 'decidido', (d.respuesta ?? '').trim() || null, { decision: d.decision, ...(d.pedidoId ? { pedido: d.pedidoId } : {}), ...(d.duplicadoDe ? { duplicadoDe: d.duplicadoDe } : {}) });
  return { ok: true, estado };
}

/** Martín corrige el tipo que puso el triage. Queda `tipo_manual`: ninguna máquina lo vuelve a tocar. */
export async function corregirTipo(id: number, tipo: TipoTicket, actor = 'martin'): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!esTipo(tipo)) return { ok: false, error: 'Tipo inválido' };
  const { data, error } = await getSupabaseServer().from(T)
    .update({ tipo, tipo_manual: true, updated_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error || !data?.length) return { ok: false, error: 'No pude corregirlo' };
  await anotar(id, actor, 'corregido', null, { tipo });
  return { ok: true };
}

export async function cambiarPrioridad(id: number, prioridad: Prioridad, actor = 'martin'): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(PRIORIDADES as readonly string[]).includes(prioridad)) return { ok: false, error: 'Prioridad inválida' };
  const { data, error } = await getSupabaseServer().from(T)
    .update({ prioridad, updated_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error || !data?.length) return { ok: false, error: 'No pude cambiarla' };
  await anotar(id, actor, 'prioridad', null, { prioridad });
  return { ok: true };
}

// ── Lo del CEREBRO (scripts/tickets.ts, desde la PC) ──────────────────────────────────────────────────────────────
/** El Cerebro (o el chat que lo toma) concluye que no es un bug: vuelve a Martín con el porqué. */
export async function reclasificar(id: number, tipo: TipoTicket, porque: string, actor = 'cerebro'): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!esTipo(tipo)) return { ok: false, error: 'Tipo inválido' };
  const { data, error } = await getSupabaseServer().from(T).update({
    tipo, estado: 'esperando_decision', updated_at: new Date().toISOString(),
  }).eq('id', id).in('estado', ['en_curso', 'nuevo']).select('id');
  if (error || !data?.length) return { ok: false, error: 'No está en curso: no se puede devolver' };
  await anotar(id, actor, 'reclasificado', porque, { tipo });
  return { ok: true };
}

/** El arreglo está commiteado e integrándose. Se cierra solo cuando el DEPLOY trae su hito (lib/tickets-cierre.ts). */
export async function marcarArreglado(id: number, nota: string, actor = 'cerebro'): Promise<{ ok: true } | { ok: false; error: string }> {
  const ahora = new Date().toISOString();
  const { data, error } = await getSupabaseServer().from(T).update({
    estado: 'arreglado', arreglado_at: ahora, arreglo_nota: nota.trim().slice(0, TOPES.nota) || null, updated_at: ahora,
  }).eq('id', id).in('estado', ['en_curso', 'esperando_decision']).select('id');
  if (error || !data?.length) return { ok: false, error: 'No está en curso' };
  await anotar(id, actor, 'arreglado', nota);
  return { ok: true };
}

export async function anotarDelCerebro(id: number, texto: string, actor = 'cerebro'): Promise<void> {
  await anotar(id, actor, 'nota', texto);
}

/** Para los avisos y el cierre: corre algo con el workspace del ticket fijado (lo que escribe en el hilo lo pide). */
export const conWorkspace = <X>(ws: number, fn: () => Promise<X>) => runWithWorkspace(ws, fn);
