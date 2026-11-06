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
import { taparClaves } from './claves-en-el-chat';
import { lineaDeAdjuntos, type AdjuntoTicket } from './tickets-adjuntos';
import { getWorkspace, runWithWorkspace, wsSuperAdmin } from './workspace';
import { buscarUsuarioPorEmail } from './usuarios';
import { capaDef } from './capas';
import { WS_REVISION, esCorreoDeRevision } from './cuenta-revision-reglas';
import { ENTREGA_MAX_INTENTOS } from './tickets-aviso';
import { fotoDePersonaSegura } from './foto-perfil';
import {
  TOPE_AUTOMATICOS_POR_DIA, TOPE_POR_DIA, TOPE_POR_DIA_TERCERO, reglaDelNegocio, clasificar, delegadoQueDecideMartin, estadoDeDecision, estadoInicial, leerTriage, motivoDecisionInvalida, sePuedeDecidir,
  type Canal, type ContextoTicket, type DecisionTicket, type EstadoTicket, type Prioridad, type TipoTicket, type Triage,
  ESTADOS, PRIORIDADES, esRefDelSistema, esTipo, mismoTelefono, nombreDelActor, sanearContexto, telefonoDelActor, TOPES,
} from './tickets-reglas';

const T = 'tickets';

/** El porqué de un ticket de la cuenta de revisión de las tiendas: va en el triage (lo ve Martín) y en `cerebro_motivo`. */
export const PORQUE_SIN_DESPACHO_REVISION = 'Es de la cuenta de revisión de las tiendas: se guarda sin despacho y no lo toma ningún chat.';
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
  /** Cuándo se tomó (o resolvió) el último intento de entrega al Cerebro. */
  aviso_at?: string | null;
  /** La entrega al Cerebro de un ticket que espera la decisión de Martín (mig 0343). Es OTRA marca que `aviso_*`, que es la de
   *  los bugs del triage: `entregaAlCerebro` dibuja las dos. Opcionales porque una base sin la 0343 no las tiene. */
  cerebro_estado?: string | null;
  cerebro_intentos?: number;
  cerebro_motivo?: string | null;
  cerebro_at?: string | null;
  arreglado_at: string | null;
  arreglo_nota: string | null;
  resuelto_at: string | null;
  avisado_at: string | null;
  /** El nombre del negocio (join con workspaces), sólo en lo que lee Martín. */
  negocio?: string | null;
  /** El chat donde MaKo falló (`contexto.chat.hilo`, de chart_sessions): su título y su clave, para decir DÓNDE. Sólo en la
   *  bandeja (`conChatDeLosTickets`, 23/10/2026). */
  chatDelTicket?: { titulo: string | null; clave: string | null } | null;
  /** La foto de perfil de quien lo levantó (`usuarios.foto_url`, la misma de /api/perfil), sólo en lo que lee Martín.
   *  null = no tiene, o no es https (un ticket por WhatsApp sin usuario no tiene fila). */
  foto?: string | null;
  /** Lo último que se dijo del ticket después de abrirlo (el Cerebro que lo devolvió, el cliente que contestó). Sólo en
   *  la bandeja: es lo que explica por qué está ahí (22/10/2026, los tickets #5 y #6). */
  nota?: NotaTicket | null;
};

/** Una línea del historial que explica el ticket: quién, qué tipo de evento y su texto. */
export type NotaTicket = { actor: string; tipo: string; texto: string; at: string };
/** Los eventos que cuentan como «lo último que se dijo»: el Cerebro que lo devuelve o anota, el cliente que contesta. */
export const TIPOS_NOTA = ['reclasificado', 'nota', 'comentario'] as const;

export type Evento = { id: number; at: string; actor: string; tipo: string; texto: string | null; datos: Record<string, unknown> | null };

// ⚠️ `cerebro_*` (mig 0343) ESTÁ ACÁ DESDE EL 6/11/2026, y antes no: la bandeja no podía decir «Entregado al Cerebro» de un
// ticket que espera a Martín porque esas columnas no se leían. La 0343 está en producción desde el 29/10 (los 22 tickets de
// entonces quedaron en 'pendiente'), así que pedirlas ya no tumba la bandeja. En una base SIN la 0343 —un entorno viejo— este
// select falla entero: ahí la columna no existe y Supabase devuelve error, no null. Si eso vuelve a pasar, el arreglo es
// aplicar la 0343 (sólo agrega, es idempotente), no sacarlas de acá.
const COLS = 'id, created_at, updated_at, workspace_id, usuario_id, usuario_email, usuario_nombre, rol, plan, tipo, tipo_manual, titulo, descripcion, canal, contexto, estado, prioridad, triage, decision, decision_nota, decidido_at, duplicado_de, respuesta, despacho, pedido_id, despachado_at, aviso_estado, aviso_intentos, aviso_motivo, aviso_at, cerebro_estado, cerebro_intentos, cerebro_motivo, cerebro_at, arreglado_at, arreglo_nota, resuelto_at, avisado_at';

function aFila(f: Record<string, unknown>): FilaTicket {
  const { workspaces: ws, usuarios: us, ...resto } = f as { workspaces?: { nombre?: unknown } | null; usuarios?: { foto_url?: unknown } | null };
  // ⚠️ NO alcanza con que sea https: la foto la elige quien levanta el ticket y la dibuja la
  // bandeja de Martín, así que una URL de un servidor del cliente le diría cuándo la abre y
  // desde qué IP. Sólo los orígenes nuestros (lib/foto-perfil.ts); el resto, sin foto.
  const foto = us && typeof us.foto_url === 'string' ? fotoDePersonaSegura(us.foto_url) : null;
  return {
    ...(resto as unknown as FilaTicket),
    contexto: sanearContexto(f.contexto),
    triage: leerTriage(f.triage),
    estado: (ESTADOS as readonly unknown[]).includes(f.estado) ? f.estado as EstadoTicket : 'nuevo',
    prioridad: (PRIORIDADES as readonly unknown[]).includes(f.prioridad) ? f.prioridad as Prioridad : 'media',
    tipo: esTipo(f.tipo) ? f.tipo : 'bug',
    aviso_intentos: Number(f.aviso_intentos) || 0,
    // Igual que aviso_intentos, y sólo si la columna vino: en una base sin la 0343 no se inventa un 0, que se leería como
    // «nunca se intentó» en vez de «no se sabe».
    ...(f.cerebro_intentos !== undefined ? { cerebro_intentos: Number(f.cerebro_intentos) || 0 } : {}),
    ...(ws !== undefined ? { negocio: typeof ws?.nombre === 'string' ? ws.nombre : null } : {}),
    ...(us !== undefined ? { foto } : {}),
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
/** `agencia` (5/11/2026): administra una agencia (`administraUnaAgencia`). Sube un escalón la prioridad de su ticket. */
export type Identidad = { ws: number; email: string; nombre: string; usuarioId: number | null; rol: string | null; plan: string | null; agencia?: boolean };

/**
 * ¿Quien levanta el ticket ADMINISTRA UNA AGENCIA? (5/11/2026; Martín a Código Inmobiliario, 30/10: sus tickets tienen prioridad.)
 * Su negocio (el de SU usuario, no el que está mirando: una agencia levanta tickets también desde la cuenta de un cliente) es una
 * agencia (`esAgencia`, lib/agencia.ts: el plan y la fila) y él es su admin. Un admin global de MaKo no: es Martín. «No pude
 * leer» es «no»: lo peor que pasa es que el ticket quede con la prioridad que le da el texto.
 */
async function administraUnaAgencia(u: { rol: string; rol_ws: string | null; workspace_id: number | null } | null): Promise<boolean> {
  if (!u || u.rol === 'admin' || u.workspace_id == null) return false;
  if ((u.rol_ws ?? 'admin') !== 'admin') return false;
  const { esAgencia } = await import('./agencia');
  return esAgencia(Number(u.workspace_id)).catch(() => false);
}

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
  const agencia = await administraUnaAgencia(u);
  return {
    ws, email: limpio, nombre: (u?.nombre || nombreSesion || '').slice(0, 120), usuarioId: u ? Number(u.id) : null,
    rol, plan: w ? capaDef((w as { capa?: string | null }).capa ?? null).nombre : null, ...(agencia ? { agencia: true } : {}),
  };
}

/**
 * Quién es el que pide por un canal: un email (la app) o `whatsapp:<teléfono>` (el doer de WhatsApp, que no sabe el
 * email). Por WhatsApp se busca en el negocio UNA persona con ese teléfono en su perfil: si la hay, el ticket es suyo y lo
 * ve también en /tickets; si no (o hay dos), queda con el teléfono como identidad. Sin teléfono (un `@lid` de un grupo),
 * el doer manda `whatsapp:<pushName>` y queda con ese nombre (`nombreDelActor`). null = el actor no se entiende.
 */
export async function identidadDelActor(ws: number, actor: string | null | undefined): Promise<Identidad | null> {
  const crudo = String(actor ?? '').trim();
  const a = crudo.toLowerCase();
  if (!a.startsWith('whatsapp:')) return a.includes('@') ? identidadDe(ws, a) : null;
  const plan = async () => { const w = await getWorkspace(ws).catch(() => null); return w ? capaDef((w as { capa?: string | null }).capa ?? null).nombre : null; };
  const tel = telefonoDelActor(a);
  if (tel) {
    const { data } = await getSupabaseServer().from('usuarios').select('email, perfil')
      .eq('workspace_id', ws).neq('estado', 'suspendido').limit(200);
    const iguales = (data ?? []).filter((u) => mismoTelefono((u.perfil as { telefono?: string } | null)?.telefono, tel));
    if (iguales.length === 1) return identidadDe(ws, String(iguales[0].email));
    return { ws, email: `whatsapp:${tel}`, nombre: '', usuarioId: null, rol: 'por WhatsApp', plan: await plan() };
  }
  const n = nombreDelActor(crudo);
  if (!n) return null;
  return { ws, email: n.clave, nombre: n.nombre, usuarioId: null, rol: 'por WhatsApp', plan: await plan() };
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
  /** Lo que adjuntó en el chat de Soporte (lib/tickets-adjuntos.ts), ya validado contra su negocio: va en el evento «creado». */
  adjuntos?: readonly AdjuntoTicket[];
  tipo: TipoTicket | null;
  declaradoPor: 'mako' | 'persona' | 'sistema' | null;
  /** Un ticket que abre la app sola (un error, lib/errores-app.ts): no gasta el tope por día de la persona que lo vio. */
  sistema?: boolean;
  titulo: string;
  descripcion: string;
  canal: Canal;
  contexto: unknown;
  /** Clave de idempotencia: el mismo `ref` devuelve el ticket que ya existe. */
  ref?: string | null;
  /**
   * Lo manda alguien de AFUERA del negocio (el alumno de un curso, desde su portal: 27/10/2026). El ticket es del dueño
   * (`identidad`), pero el tope del día se le cuenta al TERCERO (`clave`, que es el comienzo de su `ref`) y el triage no lo
   * manda solo al arreglo (`deTercero`). Sin esto, un alumno gastaba el tope del dueño y entraba por la regla de su negocio.
   */
  tercero?: { clave: string };
  /**
   * Lo abrió MaKo SOLO (lib/no-pude.ts, 27/10/2026): `clave` es el comienzo de su `ref` (`np:<ws>`). Tiene su propio tope del día
   * (`TOPE_AUTOMATICOS_POR_DIA`, por negocio), no gasta el de la persona, no entra por la regla de aprobación del negocio, y si
   * ya hay uno ABIERTO con esa `ref` se anota ahí (`volvioAPasar`); si el que había está cerrado, abre uno nuevo.
   */
  automatico?: { clave: string };
  /** Lo que se anota en el ticket automático que ya existía. */
  volvioAPasar?: string;
  /** Lo escribió un invitado al grupo de la app, que no es de este negocio (lib/tickets-del-grupo.ts): como un tercero, lo decide Martín, siempre. */
  invitado?: boolean;
};
export type Creado = { ok: true; id: number; estado: EstadoTicket; triage: Triage; yaExistia: boolean } | { ok: false; error: string };

export async function crearTicket(n: NuevoTicket): Promise<Creado> {
  const db = getSupabaseServer();
  // Las claves tapadas ANTES de guardar (la revisión de Integración, 23/10/2026): el chat de Soporte se ve como los del Ops
  // Center, que las tapan, y lo de un ticket viaja en el push, en la bandeja y al Cerebro (scripts/tickets.ts ver).
  const titulo = taparClaves(n.titulo.trim()).texto.slice(0, TOPES.titulo);
  const descripcion = taparClaves(n.descripcion.trim()).texto.slice(0, TOPES.descripcion);
  if (!titulo) return { ok: false, error: 'Escribe qué pasó' };
  // AUTOMÁTICO: el último con esa `ref` (o con su sufijo, si el primero ya se cerró). Abierto → se anota ahí; cerrado → uno nuevo.
  let ref = n.ref ?? null;
  if (n.automatico && ref) {
    if (!ref.startsWith(`${n.automatico.clave}:`)) return { ok: false, error: 'No pude guardarlo: vuelve a intentarlo' };
    const { data: ultimo } = await db.from(T).select('id, estado, triage, ref').like('ref', `${ref}%`).order('id', { ascending: false }).limit(1).maybeSingle();
    if (ultimo && !CERRADOS.includes(ultimo.estado as EstadoTicket)) {
      await anotar(Number(ultimo.id), 'sistema', 'nota', `Volvió a pasar: ${n.volvioAPasar ?? 'lo mismo, en la misma conversación'}`);
      return { ok: true, id: Number(ultimo.id), estado: ultimo.estado as EstadoTicket, triage: leerTriage(ultimo.triage)!, yaExistia: true };
    }
    if (ultimo) ref = `${ref}:${Date.now().toString(36)}`;
  } else if (n.ref) {
    const { data: ya } = await db.from(T).select('id, estado, triage').eq('ref', n.ref).maybeSingle();
    if (ya) return { ok: true, id: Number(ya.id), estado: ya.estado as EstadoTicket, triage: leerTriage(ya.triage)!, yaExistia: true };
  }
  // El tope del día: más que esto es un bucle o un abuso, no soporte. El de un tercero se cuenta por el comienzo de su `ref`, y
  // el de los AUTOMÁTICOS también (por negocio). El de la PERSONA no cuenta lo que abrió el sistema por ella (27/10/2026: con 10
  // tickets automáticos, ya no podía levantar uno a mano): las `ref` de los automáticos, de los errores y de lo que no existe.
  const hace24 = new Date(Date.now() - 86_400_000).toISOString();
  const tercero = n.tercero ? `${n.tercero.clave}:` : null;
  const automatico = n.automatico ? `${n.automatico.clave}:` : null;
  if (tercero && !n.ref?.startsWith(tercero)) return { ok: false, error: 'No pude guardarlo: vuelve a intentarlo' };
  let count: number;
  if (tercero || automatico) {
    const r = await db.from(T).select('id', { count: 'exact', head: true }).eq('workspace_id', n.identidad.ws).gte('created_at', hace24).like('ref', `${tercero ?? automatico}%`);
    if (r.error) return { ok: false, error: faltaTabla(r.error) ? SIN_TABLA : 'No pude guardarlo: vuelve a intentarlo' };
    count = r.count ?? 0;
  } else {
    // Filas y no un `count`: la condición «ref nula o que no es del sistema» no entra en un filtro simple, y son pocas (el tope).
    const r = await db.from(T).select('ref').eq('workspace_id', n.identidad.ws).eq('usuario_email', n.identidad.email).gte('created_at', hace24).limit(200);
    if (r.error) return { ok: false, error: faltaTabla(r.error) ? SIN_TABLA : 'No pude guardarlo: vuelve a intentarlo' };
    count = (r.data ?? []).filter((f) => !esRefDelSistema(f.ref as string | null)).length;
  }
  const tope = tercero ? TOPE_POR_DIA_TERCERO : automatico ? TOPE_AUTOMATICOS_POR_DIA : TOPE_POR_DIA;
  if (automatico && count >= tope) {
    // Con el tope del día lleno no se pierde callado (la revisión del 27/10/2026): se anota en el último automático del negocio.
    const { data: ultimo } = await db.from(T).select('id, estado, triage').like('ref', `${automatico}%`).order('id', { ascending: false }).limit(1).maybeSingle();
    if (!ultimo) return { ok: false, error: `ya hay ${tope} tickets automáticos hoy en este negocio` };
    await anotar(Number(ultimo.id), 'sistema', 'nota', `Otro más, con el tope del día lleno: ${titulo}. ${n.volvioAPasar ?? ''}`.trim());
    return { ok: true, id: Number(ultimo.id), estado: ultimo.estado as EstadoTicket, triage: leerTriage(ultimo.triage)!, yaExistia: true };
  }
  if (!n.sistema && count >= tope) return { ok: false, error: `Ya mandaste ${tope} ${tercero ? 'reportes' : 'tickets'} hoy: el equipo los está viendo` };

  const contexto = sanearContexto(n.contexto);
  const [apagado, arreglosHoy] = await Promise.all([autoArregloApagado(), arreglosDeHoy()]);
  // Un PEDIDO DELEGADO desde el grupo con plata, envíos o borrados, o de alguien sin permiso en el negocio, lo decide Martín (A2 de
  // la revisión de privacidad): por lo que pidió (el título y lo que escribió), no por la descripción, que trae lo de antes.
  const decideMartin = contexto.delegado ? delegadoQueDecideMartin(`${titulo}\n${contexto.pedido ?? ''}`, n.identidad) : null;
  // Un negocio con la regla de Martín (Leandro, 26/10/2026: lib/tickets-reglas.ts → APROBADOS_POR_REGLA) no espera su aprobación.
  let triage = clasificar({ tipoDeclarado: n.tipo, declaradoPor: n.declaradoPor, titulo, descripcion, contexto, adjuntos: n.adjuntos?.length ?? 0 }, { automatico: !!automatico || n.declaradoPor === 'sistema', apagado, arreglosHoy, deTercero: !!tercero, aprobadoPorRegla: reglaDelNegocio(n.identidad.ws)?.nombre ?? null, hastaUnDia: reglaDelNegocio(n.identidad.ws)?.hastaUnDia, decideMartin, deAgencia: n.identidad.agencia === true }); // Leila (27/10)
  // ⛔ LA CUENTA DE REVISIÓN DE LAS TIENDAS (4/11/2026): su contraseña la tienen terceros, y lo que escribe en un ticket lo leen chats que
  // suben a main (la regla de Martín del 27/10: «siempre lee todos los tickets e implementalos»). Se guarda SIN DESPACHO: ni al arreglo
  // automático, ni al Cerebro (queda «no entregado» con los intentos agotados, y el Runner además la saltea por su negocio:
  // lib/tickets-runner.ts). Lo lee Martín en la Ticketera, con el porqué a la vista.
  const deRevision = n.identidad.ws === WS_REVISION || esCorreoDeRevision(n.identidad.email);
  if (deRevision) triage = { ...triage, autoArreglo: false, porque: [...triage.porque, PORQUE_SIN_DESPACHO_REVISION] };
  // ⛔ UN INVITADO AL GRUPO DE LA APP NO ENTRA POR LA VÍA LIBRE DEL NEGOCIO, aunque administre el suyo: como lo de un tercero, lo decide Martín. Sin esto, su ticket salía `en_curso` con el «hazlo» para el Runner.
  if (n.invitado && triage.autoArreglo) {
    triage.autoArreglo = false;
    delete triage.regla;
    triage.porque.push('Lo pidió un invitado al grupo de ese negocio, que no lo administra: lo decide Martín.');
  }
  const estado = estadoInicial(triage);
  const { data, error } = await db.from(T).insert({
    ref,
    workspace_id: n.identidad.ws, usuario_id: n.identidad.usuarioId, usuario_email: n.identidad.email,
    usuario_nombre: n.identidad.nombre, rol: n.identidad.rol, plan: n.identidad.plan,
    tipo: triage.tipo, titulo, descripcion, canal: n.canal, contexto,
    estado, prioridad: triage.prioridad, triage,
    despacho: triage.autoArreglo ? 'runner' : null,
    ...(deRevision ? { cerebro_estado: 'no_entregado', cerebro_intentos: ENTREGA_MAX_INTENTOS, cerebro_motivo: PORQUE_SIN_DESPACHO_REVISION } : {}),
  }).select('id').single();
  if (error) {
    if (error.code === '23505' && n.ref) return crearTicket({ ...n }); // otro pedido con el mismo ref ganó: devuelve ése
    return { ok: false, error: faltaTabla(error) ? SIN_TABLA : 'No pude guardarlo: vuelve a intentarlo' };
  }
  const id = Number(data.id);
  await anotar(id, n.declaradoPor === 'sistema' ? 'sistema' : n.declaradoPor === 'mako' ? 'mako' : 'cliente', 'creado', null, { canal: n.canal, ...(n.adjuntos?.length ? { adjuntos: n.adjuntos } : {}) });
  await anotar(id, 'triage', 'clasificado', triage.porque.join(' '), { tipo: triage.tipo, autoArreglo: triage.autoArreglo, confianza: triage.confianza });
  return { ok: true, id, estado, triage, yaExistia: false };
}

/** Los estados de un ticket cerrado (un automático cerrado abre uno nuevo si vuelve a pasar). */
const CERRADOS: readonly EstadoTicket[] = ['resuelto', 'rechazado', 'duplicado'];

/** ¿Esta `ref` es de un ticket que abrió el SISTEMA por la persona? Vive en lib/tickets-reglas.ts (también la usa el correo de avance). */
export { esRefDelSistema };

/**
 * Cierra el ticket automático ABIERTO con esa `ref` (o su sufijo): lo del proveedor o la configuración, cuando vuelve a andar
 * (lib/no-pude-server.ts, `cerrarSiVolvio`). Queda «resuelto» con el motivo, y el aviso al cliente sale como el de siempre.
 * Devuelve su número, o null si no había ninguno abierto.
 */
export async function cerrarAutomatico(ref: string, motivo: string, soloSi?: (herramienta: string | null) => boolean): Promise<number | null> {
  const db = getSupabaseServer();
  const { data: ultimo } = await db.from(T).select('id, estado, contexto').like('ref', `${ref}%`).order('id', { ascending: false }).limit(1).maybeSingle();
  if (!ultimo || CERRADOS.includes(ultimo.estado as EstadoTicket)) return null;
  if (soloSi && !soloSi((ultimo.contexto as { herramienta?: string } | null)?.herramienta ?? null)) return null;
  const ahora = new Date().toISOString();
  const { error } = await db.from(T).update({ estado: 'resuelto', respuesta: motivo, resuelto_at: ahora, avisado_at: null, updated_at: ahora }).eq('id', ultimo.id);
  if (error) { console.error(`[tickets] no pude cerrar el automático #${ultimo.id}: ${error.message}`); return null; }
  await anotar(Number(ultimo.id), 'sistema', 'resuelto', motivo);
  return Number(ultimo.id);
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

/**
 * Lo que el NEGOCIO ya le pidió o reportó al equipo, para el turno del grupo de WhatsApp (28/10/2026, el diagnóstico del
 * Cerebro, F2b; lib/pedidos-del-negocio.ts): los abiertos y los resueltos de los últimos días, de cualquier persona del
 * negocio (`misTickets` es de UNA persona, por su email). Lo lee el código: el modelo los ve como un bloque del system.
 */
export async function ticketsDelNegocio(ws: number, diasResueltos = 3, tope = 8): Promise<Lectura<FilaTicket[]>> {
  const desde = new Date(Date.now() - diasResueltos * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseServer().from(T).select(COLS)
    .eq('workspace_id', ws).or(`estado.not.in.(${CERRADOS.join(',')}),and(estado.eq.resuelto,updated_at.gte."${desde}")`)
    .order('updated_at', { ascending: false }).limit(tope);
  if (error) return { ok: false, faltaTabla: faltaTabla(error), error: error.message };
  return { ok: true, datos: (data ?? []).map((f) => aFila(f as Record<string, unknown>)) };
}

/**
 * De los tickets `ids`, los que son del negocio `ws` (A1 de la revisión de privacidad: un hito va al turno de un negocio sólo si
 * TODOS los tickets que nombra son suyos, `hitosDelNegocio`). Si no se pudo leer, tira: quien llama no muestra ningún hito.
 */
export async function ticketsDelNegocioEntre(ws: number, ids: readonly number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const { data, error } = await getSupabaseServer().from(T).select('id').eq('workspace_id', ws).in('id', [...ids]);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((f) => Number(f.id)));
}

/**
 * ¿Ese teléfono es de un ADMIN DE MaKo (`usuarios.rol = 'admin'`, no suspendido)? El DEBUG del grupo de la plataforma lo habilita
 * QUIEN escribe, no el grupo (M3 de la revisión de privacidad): en los grupos de prueba de la allowlist escribe más gente. Sin
 * teléfono (un `@lid`) o sin leer la base, no.
 */
export async function esAdminDeMaKoPorTelefono(telefono: string | null | undefined): Promise<boolean> {
  if (!telefono) return false;
  const { data, error } = await getSupabaseServer().from('usuarios').select('perfil').eq('rol', 'admin').neq('estado', 'suspendido').limit(50);
  if (error) return false;
  return (data ?? []).some((u) => mismoTelefono((u.perfil as { telefono?: string } | null)?.telefono, telefono));
}

/**
 * Lo que se dijo en el GRUPO sobre un pedido que ya está abierto (la marca `[[ya-pedido: #N]]`): se suma al ticket como un
 * comentario del cliente, en vez de abrir otro. Sólo un ticket abierto de ESE negocio; si no, nada.
 */
export async function sumarAlPedidoDelNegocio(ws: number, id: number, texto: string): Promise<boolean> {
  const t = taparClaves(texto.trim()).texto;
  if (!t) return false;
  const db = getSupabaseServer();
  const { data: tk } = await db.from(T).select('id, estado').eq('id', id).eq('workspace_id', ws).maybeSingle();
  if (!tk || CERRADOS.includes(tk.estado as EstadoTicket)) return false;
  await anotar(id, 'cliente', 'comentario', `Por el grupo de WhatsApp: ${t}`);
  // Si el equipo le había preguntado, la respuesta lo devuelve a la bandeja (como `comentarComoCliente`).
  await db.from(T).update({ estado: tk.estado === 'esperando_cliente' ? 'esperando_decision' : tk.estado, updated_at: new Date().toISOString() }).eq('id', id);
  return true;
}

/** La persona contesta su ticket (cuando Martín le preguntó algo, o para sumar un dato). Vuelve a la bandeja. */
export async function comentarComoCliente(ws: number, email: string, id: number, texto: string, adjuntos: readonly AdjuntoTicket[] = []): Promise<{ ok: true } | { ok: false; error: string }> {
  // Con archivos (28/10/2026, lib/tickets-adjuntos.ts) puede ir sin texto: el historial dice cuáles.
  const t = taparClaves(texto.trim()).texto || lineaDeAdjuntos(adjuntos.map((a) => a.nombre));
  if (!t) return { ok: false, error: 'Escribe tu respuesta' };
  if (t.length > TOPES.nota) return { ok: false, error: `Acórtala a ${TOPES.nota} caracteres` };
  const db = getSupabaseServer();
  const { data: tk } = await db.from(T).select('id, estado').eq('id', id).eq('workspace_id', ws).eq('usuario_email', email.trim().toLowerCase()).maybeSingle();
  if (!tk) return { ok: false, error: 'No encuentro ese ticket' };
  if (tk.estado === 'resuelto' || tk.estado === 'rechazado' || tk.estado === 'duplicado') return { ok: false, error: 'Ese ticket ya está cerrado: levanta uno nuevo' };
  await anotar(id, 'cliente', 'comentario', t, adjuntos.length ? { adjuntos } : undefined);
  // Si Martín le había preguntado, la respuesta lo devuelve a la bandeja (Intercom: «Waiting on customer» → «In progress»).
  await db.from(T).update({ estado: tk.estado === 'esperando_cliente' ? 'esperando_decision' : tk.estado, updated_at: new Date().toISOString() }).eq('id', id);
  return { ok: true };
}

// ── Lo de MARTÍN: quien llama ya pasó por `puedeOperar` ───────────────────────────────────────────────────────────
/** Lo que lee Martín: la fila, el negocio y la FOTO de quien lo levantó (el `usuario_id` apunta a `usuarios`). */
const COLS_MARTIN = `${COLS}, workspaces(nombre), usuarios(foto_url)`;

/**
 * El chat de cada ticket que MaKo levantó al fallar en un chat (`contexto.chat.hilo`): su título y su clave (23/10/2026, Martín:
 * la tarjeta tiene que decir DÓNDE). Una lectura para todos; si falla, la bandeja sale igual, sin el dónde.
 */
export async function conChatDeLosTickets(filas: FilaTicket[]): Promise<FilaTicket[]> {
  const ids = [...new Set(filas.map((f) => f.contexto?.chat?.hilo).filter((h): h is string => !!h && /^\d{1,12}$/.test(h)))];
  if (!ids.length) return filas;
  try {
    const { data, error } = await getSupabaseServer().from('chart_sessions').select('id, chart_key, titulo').in('id', ids.map(Number));
    if (error || !data) return filas;
    const porId = new Map(data.map((s) => [String(s.id), { titulo: (s.titulo as string | null) ?? null, clave: (s.chart_key as string | null) ?? null }]));
    return filas.map((f) => { const c = f.contexto?.chat?.hilo ? porId.get(f.contexto.chat.hilo) : undefined; return c ? { ...f, chatDelTicket: c } : f; });
  } catch {
    return filas;
  }
}

export async function bandeja(limite = 200): Promise<Lectura<FilaTicket[]>> {
  const db = getSupabaseServer();
  const { data, error } = await db.from(T).select(COLS_MARTIN)
    .order('created_at', { ascending: false }).limit(limite);
  if (error) return { ok: false, faltaTabla: faltaTabla(error), error: error.message };
  const filas = (data ?? []).map((f) => aFila(f as Record<string, unknown>));
  // La última nota de los que todavía se deciden: una lectura más, de pocos tickets. Si falla, la bandeja sale igual.
  const abiertos = filas.filter((t) => t.estado === 'nuevo' || t.estado === 'esperando_decision' || t.estado === 'esperando_cliente').map((t) => t.id);
  if (abiertos.length) {
    const { data: ev } = await db.from(T_EV).select('ticket_id, at, actor, tipo, texto')
      .in('ticket_id', abiertos).in('tipo', [...TIPOS_NOTA]).not('texto', 'is', null).order('at', { ascending: false }).limit(500);
    const ultima = new Map<number, NotaTicket>();
    for (const e of (ev ?? []) as Array<{ ticket_id: number; at: string; actor: string; tipo: string; texto: string | null }>) {
      const id = Number(e.ticket_id);
      if (!ultima.has(id) && e.texto) ultima.set(id, { actor: e.actor, tipo: e.tipo, texto: e.texto, at: e.at });
    }
    for (const t of filas) t.nota = ultima.get(t.id) ?? null;
  }
  return { ok: true, datos: filas };
}

export async function ticketEntero(id: number): Promise<{ ticket: FilaTicket; eventos: Evento[] } | null> {
  const db = getSupabaseServer();
  const { data, error } = await db.from(T).select(COLS_MARTIN).eq('id', id).maybeSingle();
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
