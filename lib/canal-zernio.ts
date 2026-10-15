// =============================================================================
// canal-zernio — un paso de INSTAGRAM o MESSENGER sale por Zernio
// =============================================================================
// Lo llama UNA rama del motor (`procesarEnvios`, lib/nutricion.ts: «canal social»). Copia la lógica
// del WhatsApp no oficial (CRON 5, textual: «Copia la logica, que se envie un mensaje y se pueda
// editar luego»): un paso son VARIAS partes (`partes`, lib/mensaje-partes.ts) que salen en orden, y si
// una falla, el próximo intento arranca desde la que no salió (la marca de `nutricion_envios.asunto`).
//
// LO QUE NO ES COMO WHATSAPP, y es todo lo de Meta (lib/canal-social.ts, `decidirSalida`):
//   · no se le escribe primero a nadie: un DM sale dentro de las 24 h del último mensaje de la
//     persona, y fuera de eso NO SALE (sin HUMAN_AGENT: es para personas, no para automatizaciones);
//   · a quien COMENTÓ se le contesta UNA vez, por privado, dentro de los 7 días, y sólo con texto;
//   · lo que manda es la respuesta de Zernio, no el reloj de acá (`esLimiteDeMeta`): si Meta dice que
//     no, es terminal y el hilo se cierra con su motivo, sin reintentar.
//
// DUODÉCIMA TANDA (12/10/2026): las condiciones de Instagram y Messenger leen de acá, por lote
// (`conversacionesDeLeads` y `siguenEnInstagram`, que llama `hechosDelCatalogo` de lib/nutricion.ts). La
// fila que cuenta la elige la MISMA regla que usa el envío (`conversacionQueCuenta`, lib/canal-social.ts).
//
// LA TAB CHATS (14/10/2026, docs/diseno-chats.md): la bandeja unificada copiada de respond.io lee y contesta
// Instagram y Messenger POR ACÁ, y no desde un archivo nuevo, a propósito: este archivo ya es del CANAL
// (tests/sin-instagram.test.ts) y la regla de ese guard es que las tablas y el cliente de Zernio se tocan sólo
// desde el canal. La pantalla y sus rutas llaman a estas funciones exportadas (sección «La bandeja de Chats», al
// final): `listarConversacionesSociales`, `conversacionesSocialesDe`, `buscarConversacionesSociales`,
// `mensajesSociales`, `enviarManualSocial` y `crearLeadDeConversacionSocial`. Es una PERSONA la que contesta a
// mano, no una automatización: igual va SIN `HUMAN_AGENT` (no está verificado por Zernio; decisión 4 del plano),
// sólo texto y sólo dentro de la ventana de 24 h o como la respuesta privada a un comentario.

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { enviarDm, responderComentario, esLimiteDeMeta, estadosDeSeguimiento, ZernioError } from './zernio';
import {
  decidirSalida, plataformaDe, problemaDeAdjunto, tipoAdjuntoZernio, NOMBRE_CANAL, COLS_CONVERSACION_SOCIAL,
  conversacionDelPaso, conversacionDeFila, conversacionesPorLead, pedidoDeSeguimiento, canalDePlataforma, TOPE_TEXTO_SOCIAL,
  filasDeCharlaSocial, TOPE_CHARLA_SOCIAL,
  type CanalSocial, type ConversacionesPorLead, type FilaConversacionSocial, type EntranteSocial, type SalienteSocial,
} from './canal-social';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { enTandas } from './ids-con-filas';
import { aplicarVariables } from './template-vars';
import { PAUSA_ENTRE_PARTES_MS, type ParteMensaje } from './mensaje-partes';
import { getAdjunto, urlsDeAdjuntos } from './setting-adjuntos';
import { leerFunnels } from './funnels';
import { destinoDelAlta, type ProductoParaAlta } from './lead-funnel-reglas';
import { formatoDeAdjunto } from './chats-reglas';
import type { FormatoMsg, MensajeChat } from './chats-tipos';

export type ResultadoSocial = {
  ok: boolean;
  /** Cuántas partes le llegaron al lead en total (las de intentos anteriores incluidas). */
  salieron: number;
  /** Lo que salió en ESTE intento, para `texto_enviado`. */
  textos: string[];
  /** A quién: `@usuario` o el id de la persona en esa plataforma. */
  destino: string | null;
  error?: string;
  /** Reintentar no lo arregla (Meta dijo que no, o no hay conversación). */
  terminal?: boolean;
  backoffHoras?: number;
  /** Algo salió distinto de lo escrito (una respuesta privada lleva sólo texto). */
  nota?: string;
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * LA CONVERSACIÓN DEL LEAD EN ESE CANAL. Con varias (dos cuentas de Instagram), la que elige
 * `conversacionQueCuenta`: la misma regla que miran las condiciones. `undefined` = no se pudo leer, que
 * NO es «no tiene» (AGENTS.md: «No pude leer» es un tercer estado): con la base caída se reintenta,
 * nunca se cierra el hilo.
 */
async function conversacionDe(leadId: number, canal: CanalSocial, cuenta: string | null): Promise<FilaConversacionSocial | null | undefined> {
  const db = await getTenantDb();
  const { data, error } = await db.from('ig_conversaciones').select(COLS_CONVERSACION_SOCIAL)
    .eq('lead_id', leadId).eq('plataforma', plataformaDe(canal));
  if (error) {
    console.error(`[canal-zernio] conversación del lead ${leadId} (${canal}): ${error.message}`);
    return undefined;
  }
  return conversacionDelPaso((data ?? []) as FilaConversacionSocial[], cuenta);
}

/**
 * LAS CONVERSACIONES DE UN LOTE DE LEADS, por lead y canal (las condiciones de Instagram y Messenger).
 * UNA lectura por tanda de leads, nunca una por lead. Un error TIRA: decidir «no tiene Instagram» con
 * la base caída es mandarle al lead la rama que no le toca.
 */
export async function conversacionesDeLeads(leadIds: readonly number[]): Promise<ConversacionesPorLead> {
  const db = await getTenantDb();
  const filas: FilaConversacionSocial[] = [];
  for (const tanda of enTandas([...new Set(leadIds)], 200)) {
    filas.push(...await leerTodo<FilaConversacionSocial>(db, 'ig_conversaciones', COLS_CONVERSACION_SOCIAL, {
      orden: 'id', filtros: (q) => q.in('lead_id', tanda) as ConsultaPaginada,
    }));
  }
  return conversacionesPorLead(filas);
}

/**
 * «¿TE SIGUE EN INSTAGRAM?» por lead, para los que ESCRIBIERON por DM (`pedidoDeSeguimiento`). El que
 * no escribió no se consulta y no está en el mapa: su condición dice «no sé». Una falla pasajera de
 * Zernio TIRA (`estadosDeSeguimiento`).
 */
export async function siguenEnInstagram(ws: number, conversaciones: ConversacionesPorLead): Promise<Map<number, boolean | null>> {
  const pedidos = [...conversaciones].flatMap(([leadId, c]) => {
    const p = pedidoDeSeguimiento(c.instagram);
    return p ? [{ leadId, ...p }] : [];
  });
  return estadosDeSeguimiento(ws, pedidos);
}

/**
 * LA CHARLA DEL LEAD POR ESE CANAL, para que el AI Step conteste (TikTok fase 0, 14/10/2026): lo que
 * escribió (`ig_mensajes`, de TODAS sus conversaciones en esa plataforma) y lo que le salió
 * (`nutricion_envios`), juntos por `filasDeCharlaSocial`. `null` = no se pudo leer: el redactor sigue con el
 * mensaje de hoy solo, como en WhatsApp.
 */
export async function charlaSocialDelLead(leadId: number, canal: CanalSocial, tope: number = TOPE_CHARLA_SOCIAL): Promise<ReturnType<typeof filasDeCharlaSocial> | null> {
  try {
    const db = await getTenantDb();
    const { data: convs, error } = await db.from('ig_conversaciones').select('id')
      .eq('lead_id', leadId).eq('plataforma', plataformaDe(canal));
    if (error) throw new Error(error.message);
    const ids = ((convs ?? []) as Array<{ id: number }>).map((c) => c.id);
    const [ent, sal] = await Promise.all([
      ids.length
        ? db.from('ig_mensajes').select('texto, adjuntos, created_at').in('conversacion_id', ids).eq('direccion', 'entrante')
          .order('created_at', { ascending: false }).limit(tope)
        : Promise.resolve({ data: [], error: null }),
      db.from('nutricion_envios').select('texto_enviado, created_at').eq('lead_id', leadId).eq('canal', canal)
        .eq('estado', 'enviado').not('texto_enviado', 'is', null).order('created_at', { ascending: false }).limit(tope),
    ]);
    if (ent.error) throw new Error(ent.error.message);
    if (sal.error) throw new Error(sal.error.message);
    return filasDeCharlaSocial((ent.data ?? []) as EntranteSocial[], (sal.data ?? []) as SalienteSocial[], tope);
  } catch (e) {
    console.error(`[canal-zernio] la charla del lead ${leadId} (${canal}): ${msg(e)}`);
    return null;
  }
}

/**
 * MANDA UN PASO de Instagram o Messenger. Nunca tira: todo fallo vuelve en el resultado, con
 * `terminal` cuando reintentar no lo arregla.
 *
 * `idempotencia`: una clave estable por inscripción y nodo (`nutri:<inscripción>:<nodo>`). Cada parte
 * le suma su índice: si una respuesta se pierde, Zernio contesta la original en vez de mandar dos veces.
 */
export async function enviarPasoSocial(input: {
  ws: number;
  leadId: number;
  canal: CanalSocial;
  partes: readonly ParteMensaje[];
  vars: Record<string, string>;
  idempotencia: string;
  /** Cuántas partes ya salieron en un intento anterior. */
  desde?: number;
  /**
   * La cuenta de Zernio que eligió la tarjeta (`cuentaDelPaso`, decimocuarta tanda). Con ella sale SÓLO por esa cuenta: si
   * el lead no le escribió, falla con su motivo y no cae a otra. Sin ella, la conversación que cuenta.
   */
  cuenta?: string | null;
}): Promise<ResultadoSocial> {
  const { ws, leadId, canal, partes, vars, idempotencia } = input;
  const desde = Math.max(0, Math.min(partes.length, input.desde ?? 0));
  const nombre = NOMBRE_CANAL[canal];
  const cuenta = input.cuenta?.trim() || null;
  const fila = await conversacionDe(leadId, canal, cuenta);
  if (fila === undefined) return { ok: false, salieron: desde, textos: [], destino: null, error: `no pude leer la conversación de ${nombre}`, backoffHoras: 4 };
  const destino = fila ? (fila.username ? `@${fila.username}` : fila.igsid) : null;
  // Con la cuenta de la tarjeta y sin conversación con ESA cuenta: el motivo nombra la cuenta elegida (no cae a otra).
  if (fila === null && cuenta) return { ok: false, salieron: desde, textos: [], destino: null, error: `el lead no le escribió a la cuenta de ${nombre} elegida en la tarjeta`, terminal: true, backoffHoras: 24 };
  const salida = decidirSalida(fila ? conversacionDeFila(fila) : null, Date.now(), canal);
  if (salida.via === null) return { ok: false, salieron: desde, textos: [], destino, error: salida.motivo, terminal: salida.terminal, backoffHoras: 24 };
  if (!partes.length) return { ok: false, salieron: 0, textos: [], destino, error: 'el mensaje está vacío', backoffHoras: 24 };

  // ── La respuesta privada a un comentario: UNA, sólo texto ──
  if (salida.via === 'respuesta_privada') {
    const textos = partes.flatMap((p) => (p.tipo === 'texto' ? [p.cuerpo] : p.tipo === 'media' && p.cuerpo?.trim() ? [p.cuerpo] : []))
      .map((t) => aplicarVariables(t, vars).trim()).filter(Boolean);
    const texto = textos.join('\n\n');
    if (!texto) return { ok: false, salieron: 0, textos: [], destino, error: 'a un comentario se le contesta con texto, y este mensaje no tiene', backoffHoras: 24 };
    const dejaAfuera = partes.some((p) => p.tipo !== 'texto');
    try {
      await responderComentario(ws, { accountId: salida.cuentaId, postId: salida.postId, commentId: salida.comentarioId, texto, idempotencyKey: `${idempotencia}#privada` });
      await marcarComentarioRespondido(fila!.id);
      return { ok: true, salieron: partes.length, textos: [texto], destino, ...(dejaAfuera ? { nota: 'respuesta privada: sólo el texto' } : {}) };
    } catch (e) {
      // Gastada o rechazada por Meta: la respuesta privada de ESE comentario ya no existe.
      if (esLimiteDeMeta(e)) { await marcarComentarioRespondido(fila!.id); return { ok: false, salieron: 0, textos: [], destino, error: `${nombre}: ${msg(e)}`, terminal: true }; }
      return { ok: false, salieron: 0, textos: [], destino, error: msg(e), backoffHoras: 4 };
    }
  }

  // ── Un DM, parte por parte ──
  const textos: string[] = [];
  let salieron = desde;
  for (let k = desde; k < partes.length; k++) {
    const p = partes[k];
    try {
      if (k > desde) await dormir(PAUSA_ENTRE_PARTES_MS);
      if (p.tipo === 'texto') {
        const t = aplicarVariables(p.cuerpo, vars).trim();
        if (t) { await enviarDm(ws, salida.conversacionId, { accountId: salida.cuentaId, texto: t, idempotencyKey: `${idempotencia}#${k}` }); textos.push(t); }
      } else if (p.tipo === 'media') {
        const adj = await getAdjunto(p.media_id);
        if (!adj) return { ok: false, salieron, textos, destino, error: 'el archivo del paso ya no existe', backoffHoras: 24 };
        const problema = problemaDeAdjunto(canal, adj.media_mime);
        if (problema) return { ok: false, salieron, textos, destino, error: problema, backoffHoras: 24 };
        const url = (await urlsDeAdjuntos([adj]))[adj.id];
        if (!url) return { ok: false, salieron, textos, destino, error: 'no pude preparar el archivo del paso', backoffHoras: 4 };
        await enviarDm(ws, salida.conversacionId, { accountId: salida.cuentaId, adjuntoUrl: url, adjuntoTipo: tipoAdjuntoZernio(adj.media_mime), idempotencyKey: `${idempotencia}#${k}` });
        // El pie va DESPUÉS, como su propio mensaje: Meta no le pone texto a un adjunto.
        const pie = aplicarVariables(p.cuerpo ?? '', vars).trim();
        if (pie) { await enviarDm(ws, salida.conversacionId, { accountId: salida.cuentaId, texto: pie, idempotencyKey: `${idempotencia}#${k}#pie` }); textos.push(pie); }
      } else {
        // Una nota de voz de la biblioteca es OGG/Opus o MP3: Instagram rechaza los dos (doc de Zernio).
        return { ok: false, salieron, textos, destino, error: `${nombre} no recibe las notas de voz de la biblioteca`, backoffHoras: 24 };
      }
      salieron = k + 1;
    } catch (e) {
      if (esLimiteDeMeta(e)) return { ok: false, salieron, textos, destino, error: `${nombre}: ${msg(e)}`, terminal: true };
      const reintento = e instanceof ZernioError && e.status >= 400 && e.status < 500 && e.status !== 409 && e.status !== 429 ? 24 : 4;
      return { ok: false, salieron, textos, destino, error: msg(e), backoffHoras: reintento };
    }
  }
  return { ok: true, salieron, textos, destino };
}

/** La respuesta privada se usó (o Meta la dio por gastada): no se vuelve a intentar con ese comentario. */
async function marcarComentarioRespondido(id: number): Promise<void> {
  try {
    const db = await getTenantDb();
    const { error } = await db.from('ig_conversaciones').update({ comentario_respondido_at: new Date().toISOString() }).eq('id', id);
    if (error) console.error(`[canal-zernio] marcar la respuesta privada (conv ${id}): ${error.message}`);
  } catch (e) {
    console.error(`[canal-zernio] marcar la respuesta privada (conv ${id}): ${msg(e)}`);
  }
}

// =============================================================================
// La bandeja de Chats (14/10/2026): leer y contestar a mano Instagram y Messenger
// =============================================================================
// Lo que la tab Chats necesita de las tablas del canal, dicho en sus palabras (lib/chats.ts lo une con
// WhatsApp). Todo con `getTenantDb` (las dos tablas están en TENANT_TABLES) y con el `.error` mirado: «no pude
// leer» TIRA, y quien llama lo cuenta como una falla de la fuente — nunca como «no hay conversaciones».
//
// ⚠️ LO QUE EL ESPEJO NO TIENE, y por eso la bandeja tampoco (relevado el 14/10/2026):
//   · los salientes del MOTOR no se guardan en `ig_mensajes` (viven en `nutricion_envios`): el hilo muestra lo
//     que entró y lo que se contestó desde Chats (`enviarManualSocial` sí inserta la fila);
//   · el texto de un comentario no se guarda (sólo su id): la fila dice «Comentó una publicación»;
//   · los adjuntos se guardan sólo por TIPO (la URL de Meta vence): el hilo sabe que hubo una imagen, no cuál;
//   · `ultimo_mensaje_at` NO se mueve con los salientes: la última actividad es la más tardía entre esa
//     columna, el último mensaje leído y el último comentario.

/** Cuántas personas lee la bandeja (las más recientes). El mismo techo que la de WhatsApp. */
export const TOPE_CONVERSACIONES_SOCIALES = 600;
/** Cuántos mensajes trae un hilo social (los más recientes). El mismo que el de WhatsApp. */
export const TOPE_MENSAJES_SOCIALES = 300;
/**
 * Cuántas filas de `ig_mensajes` se leen para encontrar el último mensaje de cada persona, por tanda de 200.
 * ⚠️ ES UN CORTE: si pocas personas muy activas llenan las 1000 filas, las demás de la tanda quedan sin su último
 * mensaje. No desaparecen: conservan la fecha de `ultimo_mensaje_at` / `comentario_at`, sin la vista previa. Es la
 * pérdida menos mala sin un `distinct on` (PostgREST no lo tiene); con volumen, una vista o un RPC lo arreglan.
 */
const TOPE_ULTIMOS_POR_TANDA = 1000;

/** Una persona de Instagram o Messenger, como la necesita la bandeja de Chats. */
export type ConversacionSocialChat = {
  /** `ig_conversaciones.id`. */
  id: number;
  canal: CanalSocial;
  /** `zernio_account_id`: la cuenta conectada del negocio con la que habló. */
  cuenta: string | null;
  leadId: number | null;
  username: string | null;
  /** `@usuario`, o null (en Messenger casi nunca hay usuario). */
  destino: string | null;
  /** El nombre que se puede mostrar sin lead: `@usuario` o «Contacto de Instagram». */
  nombre: string;
  ultimaFecha: string | null;
  /** Lo último que hizo LA PERSONA (un mensaje, un clic en un anuncio, un comentario). */
  ultimaEntrante: string | null;
  ultimoTexto: string | null;
  ultimoTipo: FormatoMsg | null;
  ultimoEntrante: boolean;
  /** Cuántos mensajes se leyeron de esta persona (0 = sólo comentó o tocó un link). */
  total: number;
  puedeEscribir: boolean;
  motivoNoEscribir: string | null;
};

type FilaMensajeSocial = {
  id: number; conversacion_id: number; direccion: string; estado: string | null; texto: string | null;
  adjuntos: unknown; error: string | null; created_at: string;
};

const COLS_MENSAJE_SOCIAL = 'id, conversacion_id, direccion, estado, texto, adjuntos, error, created_at';

const msDe = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : NaN;
};
/** La más tardía de varias fechas ISO (null si ninguna es fecha). */
const laMasTarde = (...isos: Array<string | null | undefined>): string | null => {
  let mejor: string | null = null;
  for (const i of isos) if (i && Number.isFinite(msDe(i)) && (mejor == null || msDe(i) > msDe(mejor))) mejor = i;
  return mejor;
};

/** El tipo del primer adjunto de una fila (`[{type}]`, lo único que guarda el webhook). */
function tipoDelAdjunto(adjuntos: unknown): FormatoMsg | null {
  const a = Array.isArray(adjuntos) ? (adjuntos[0] as { type?: unknown } | undefined) : undefined;
  return a ? formatoDeAdjunto(typeof a.type === 'string' ? a.type : null) : null;
}

/**
 * ¿Se le puede escribir AHORA, y si no por qué? La misma pregunta que el motor (`decidirSalida`), con el
 * motivo en las 3-4 palabras que entran en el selector de canal del composer.
 */
function escrituraDe(f: FilaConversacionSocial, canal: CanalSocial, ahoraMs: number): { puede: boolean; motivo: string | null } {
  const s = decidirSalida(conversacionDeFila(f), ahoraMs, canal);
  if (s.via) return { puede: true, motivo: null };
  if (!(f.zernio_account_id ?? '').trim()) return { puede: false, motivo: 'Cuenta sin conectar' };
  if ((f.zernio_conversation_id ?? '').trim()) return { puede: false, motivo: 'Ventana de 24 h cerrada' };
  return { puede: false, motivo: 'Sin mensajes directos' };
}

/** Las filas de las personas + el último mensaje de cada una (una lectura por tanda de 200). */
async function conUltimoMensaje(filas: readonly FilaConversacionSocial[]): Promise<ConversacionSocialChat[]> {
  const ids = [...new Set(filas.map((f) => Number(f.id)))];
  const ultimo = new Map<number, FilaMensajeSocial>();
  const ultimoEntrante = new Map<number, string>();
  const total = new Map<number, number>();
  if (ids.length) {
    const db = await getTenantDb();
    for (const tanda of enTandas(ids, 200)) {
      const { data, error } = await db.from('ig_mensajes').select(COLS_MENSAJE_SOCIAL)
        .in('conversacion_id', tanda)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .limit(TOPE_ULTIMOS_POR_TANDA);
      if (error) throw new Error(`ig_mensajes (últimos): ${error.message}`);
      // Vienen del más nuevo al más viejo: el primero de cada persona ES su último mensaje.
      for (const m of (data ?? []) as FilaMensajeSocial[]) {
        const c = Number(m.conversacion_id);
        if (!ultimo.has(c)) ultimo.set(c, m);
        if (m.direccion === 'entrante' && !ultimoEntrante.has(c)) ultimoEntrante.set(c, m.created_at);
        total.set(c, (total.get(c) ?? 0) + 1);
      }
    }
  }
  const ahora = Date.now();
  const out: ConversacionSocialChat[] = [];
  for (const f of filas) {
    const canal = canalDePlataforma(f.plataforma ?? 'instagram');
    if (!canal) continue;
    const id = Number(f.id);
    const m = ultimo.get(id) ?? null;
    const username = (f.username ?? '').trim().replace(/^@/, '') || null;
    const ultimaFecha = laMasTarde(m?.created_at, f.ultimo_mensaje_at, f.comentario_at);
    const ultimaEntrante = laMasTarde(ultimoEntrante.get(id), f.ultimo_mensaje_at, f.comentario_at);
    // Lo último que pasó: un comentario (su texto no se guarda), un mensaje leído, o un evento sin mensaje
    // (un clic en un anuncio o en un link de referencia abre la ventana sin escribir nada).
    const fueComentario = !!f.comentario_at && ultimaFecha === f.comentario_at && (!m || msDe(f.comentario_at) > msDe(m.created_at));
    const fueMensaje = !fueComentario && m != null && ultimaFecha === m.created_at;
    const { puede, motivo } = escrituraDe(f, canal, ahora);
    out.push({
      id, canal,
      cuenta: (f.zernio_account_id ?? '').trim() || null,
      leadId: f.lead_id == null ? null : Number(f.lead_id),
      username,
      destino: username ? `@${username}` : null,
      nombre: username ? `@${username}` : `Contacto de ${NOMBRE_CANAL[canal]}`,
      ultimaFecha,
      ultimaEntrante,
      ultimoTexto: fueComentario ? 'Comentó una publicación' : fueMensaje && m ? (m.texto ?? null) : null,
      ultimoTipo: fueComentario ? 'otro' : fueMensaje && m ? (m.texto?.trim() ? 'text' : (tipoDelAdjunto(m.adjuntos) ?? 'text')) : null,
      ultimoEntrante: fueMensaje && m ? m.direccion === 'entrante' : true,
      total: total.get(id) ?? 0,
      puedeEscribir: puede,
      motivoNoEscribir: motivo,
    });
  }
  return out;
}

/** Las personas de Instagram y Messenger del negocio, las más recientes primero, con su último mensaje. Tira si no pudo leer. */
export async function listarConversacionesSociales(): Promise<ConversacionSocialChat[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('ig_conversaciones').select(COLS_CONVERSACION_SOCIAL)
    .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
    .limit(TOPE_CONVERSACIONES_SOCIALES);
  if (error) throw new Error(`ig_conversaciones: ${error.message}`);
  return conUltimoMensaje((data ?? []) as FilaConversacionSocial[]);
}

/** Las personas de UN contacto: las filas de ese lead, o las pedidas por id. Tira si no pudo leer. */
export async function conversacionesSocialesDe(q: { leadId?: number | null; ids?: readonly number[] }): Promise<ConversacionSocialChat[]> {
  const ids = [...new Set((q.ids ?? []).filter((n) => Number.isSafeInteger(n) && n > 0))];
  const leadId = q.leadId != null && Number.isSafeInteger(Number(q.leadId)) ? Number(q.leadId) : null;
  if (leadId == null && !ids.length) return [];
  const db = await getTenantDb();
  const base = db.from('ig_conversaciones').select(COLS_CONVERSACION_SOCIAL);
  const sel = leadId != null
    ? (ids.length ? base.or(`lead_id.eq.${leadId},id.in.(${ids.join(',')})`) : base.eq('lead_id', leadId))
    : base.in('id', ids);
  const { data, error } = await sel.limit(50);
  if (error) throw new Error(`ig_conversaciones: ${error.message}`);
  return conUltimoMensaje((data ?? []) as FilaConversacionSocial[]);
}

/**
 * El buscador de Chats: las personas cuyo @usuario contiene `q`, más las de los leads que matchearon por nombre
 * (`leadIds`, los busca quien llama en el CRM). Hasta 25. Tira si no pudo leer.
 */
export async function buscarConversacionesSociales(q: string, leadIds: readonly number[] = []): Promise<ConversacionSocialChat[]> {
  // Saneado para el `.or` de PostgREST: las comas y los paréntesis separan condiciones.
  const limpio = q.trim().replace(/^@/, '').replace(/[(),%*]/g, ' ').trim();
  const ids = [...new Set(leadIds.filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, 100);
  if (limpio.length < 2 && !ids.length) return [];
  const conds = [
    ...(limpio.length >= 2 ? [`username.ilike.%${limpio}%`] : []),
    ...(ids.length ? [`lead_id.in.(${ids.join(',')})`] : []),
  ];
  const db = await getTenantDb();
  const { data, error } = await db.from('ig_conversaciones').select(COLS_CONVERSACION_SOCIAL)
    .or(conds.join(','))
    .order('ultimo_mensaje_at', { ascending: false, nullsFirst: false })
    .limit(25);
  if (error) throw new Error(`ig_conversaciones (buscar): ${error.message}`);
  return conUltimoMensaje((data ?? []) as FilaConversacionSocial[]);
}

/** Una fila de `ig_mensajes` en el formato del hilo de Chats. */
function mensajeDeFila(m: FilaMensajeSocial, canal: CanalSocial, cuenta: string | null): MensajeChat {
  const texto = m.texto?.trim() ? m.texto : null;
  return {
    id: `ig:${m.id}`,
    tipo: 'mensaje',
    canal,
    cuenta,
    saliente: m.direccion === 'saliente',
    autor: null,
    texto,
    formato: texto ? 'text' : (tipoDelAdjunto(m.adjuntos) ?? 'text'),
    // La URL del adjunto de Meta vence y el webhook guarda sólo el tipo: no hay qué mostrar.
    mediaUrl: null,
    mediaMime: null,
    fecha: m.created_at,
    status: m.estado === 'enviado' ? 'sent' : m.estado === 'error' ? 'failed' : null,
    error: m.error ?? null,
  };
}

/**
 * Los mensajes de unas personas (las identidades sociales de UN contacto), del más viejo al más nuevo: los
 * últimos `TOPE_MENSAJES_SOCIALES`, leídos en orden descendente y dados vuelta (el patrón «ascendente + límite»
 * escondía lo nuevo en la bandeja de WhatsApp). Tira si no pudo leer.
 */
export async function mensajesSociales(convIds: readonly number[]): Promise<MensajeChat[]> {
  const ids = [...new Set(convIds.filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, 50);
  if (!ids.length) return [];
  const db = await getTenantDb();
  const { data: convs, error: eConv } = await db.from('ig_conversaciones').select('id, plataforma, zernio_account_id').in('id', ids);
  if (eConv) throw new Error(`ig_conversaciones: ${eConv.message}`);
  const deConv = new Map<number, { canal: CanalSocial; cuenta: string | null }>();
  for (const c of (convs ?? []) as Array<{ id: number; plataforma: string | null; zernio_account_id: string | null }>) {
    const canal = canalDePlataforma(c.plataforma ?? 'instagram');
    if (canal) deConv.set(Number(c.id), { canal, cuenta: (c.zernio_account_id ?? '').trim() || null });
  }
  if (!deConv.size) return [];
  const { data, error } = await db.from('ig_mensajes').select(COLS_MENSAJE_SOCIAL)
    .in('conversacion_id', [...deConv.keys()])
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(TOPE_MENSAJES_SOCIALES);
  if (error) throw new Error(`ig_mensajes: ${error.message}`);
  return ((data ?? []) as FilaMensajeSocial[])
    .flatMap((m) => { const c = deConv.get(Number(m.conversacion_id)); return c ? [mensajeDeFila(m, c.canal, c.cuenta)] : []; })
    .reverse();
}

export type ResultadoEnvioSocial =
  | { ok: true; mensaje: MensajeChat }
  | { ok: false; error: string; terminal?: boolean };

/** La fila de una persona, por id. `undefined` = no se pudo leer; `null` = no existe en este negocio. */
async function filaSocial(convId: number): Promise<FilaConversacionSocial | null | undefined> {
  const db = await getTenantDb();
  const { data, error } = await db.from('ig_conversaciones').select(COLS_CONVERSACION_SOCIAL).eq('id', convId).maybeSingle();
  if (error) { console.error(`[canal-zernio] conversación ${convId}: ${error.message}`); return undefined; }
  return (data as FilaConversacionSocial | null) ?? null;
}

/**
 * UN MENSAJE A MANO desde la bandeja de Chats, por Instagram o Messenger. Nunca tira: todo fallo vuelve en el
 * resultado, con `terminal` cuando reintentar no lo arregla (Meta dijo que no, o la ventana se cerró).
 *
 *   · Por dónde sale lo decide `decidirSalida`, la MISMA regla que el motor: un DM dentro de las 24 h, o la
 *     respuesta privada a un comentario (una sola, dentro de los 7 días). Fuera de eso no sale.
 *   · SIN `HUMAN_AGENT`: la etiqueta sería legítima para una persona que contesta, pero no se verificó que
 *     Zernio la acepte en Instagram (decisión 4 de docs/diseno-chats.md).
 *   · `Idempotency-Key` por envío (`chat:<conv>:<uuid>`): si la respuesta de Zernio se pierde a mitad de camino,
 *     un reintento del mismo pedido no manda dos veces.
 *   · Lo que salió (o el error) queda en `ig_mensajes` como `saliente`: el webhook no guarda los salientes, y
 *     sin esta fila la respuesta no aparecería en el hilo.
 */
export async function enviarManualSocial(input: { convId: number; texto: string }): Promise<ResultadoEnvioSocial> {
  const convId = Number(input.convId);
  const texto = String(input.texto ?? '').trim();
  if (!Number.isSafeInteger(convId) || convId <= 0) return { ok: false, error: 'Falta la conversación.' };
  if (!texto) return { ok: false, error: 'El mensaje está vacío.' };
  if (texto.length > TOPE_TEXTO_SOCIAL) return { ok: false, error: `Máximo ${TOPE_TEXTO_SOCIAL} caracteres.` };
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Elige una cuenta primero.' };
  const fila = await filaSocial(convId);
  if (fila === undefined) return { ok: false, error: 'No pude leer la conversación.' };
  if (fila === null) return { ok: false, error: 'Esa conversación no está.' };
  const canal = canalDePlataforma(fila.plataforma ?? 'instagram');
  if (!canal) return { ok: false, error: 'Esa conversación no es de Instagram ni de Messenger.' };
  const cuenta = (fila.zernio_account_id ?? '').trim() || null;
  const salida = decidirSalida(conversacionDeFila(fila), Date.now(), canal);
  if (salida.via === null) return { ok: false, error: salida.motivo, terminal: salida.terminal };

  const clave = `chat:${convId}:${randomUUID()}`;
  let messageId: string | null = null;
  let falla: { error: string; terminal: boolean } | null = null;
  try {
    if (salida.via === 'dm') {
      messageId = (await enviarDm(ws, salida.conversacionId, { accountId: salida.cuentaId, texto, idempotencyKey: clave })).messageId;
    } else {
      messageId = (await responderComentario(ws, { accountId: salida.cuentaId, postId: salida.postId, commentId: salida.comentarioId, texto, idempotencyKey: clave })).messageId;
      await marcarComentarioRespondido(fila.id);
    }
  } catch (e) {
    const limite = esLimiteDeMeta(e);
    // Gastada o rechazada por Meta: la respuesta privada de ESE comentario ya no existe (igual que el motor).
    if (limite && salida.via === 'respuesta_privada') await marcarComentarioRespondido(fila.id);
    falla = { error: limite ? `${NOMBRE_CANAL[canal]}: ${msg(e)}` : msg(e), terminal: limite };
  }

  // La fila del saliente: con el id de Zernio si salió, o con el error si no.
  const db = await getTenantDb();
  const { data, error } = await db.from('ig_mensajes').insert({
    conversacion_id: fila.id, direccion: 'saliente', estado: falla ? 'error' : 'enviado',
    texto, adjuntos: [], zernio_message_id: falla ? null : messageId, error: falla ? falla.error.slice(0, 500) : null,
  }).select(COLS_MENSAJE_SOCIAL).single();
  if (error) console.error(`[canal-zernio] guardar el saliente de la conversación ${convId}: ${error.message}`);
  if (falla) return { ok: false, error: falla.error, ...(falla.terminal ? { terminal: true } : {}) };
  // ⚠️ Salió aunque la fila no se haya guardado: se contesta ok (el mensaje le llegó a la persona) con el
  // mensaje armado acá, y el error queda en el log. Decir «no salió» invitaría a mandarlo dos veces.
  const guardada = (data as FilaMensajeSocial | null) ?? null;
  if (guardada) return { ok: true, mensaje: mensajeDeFila(guardada, canal, cuenta) };
  const armada: FilaMensajeSocial = {
    id: 0, conversacion_id: fila.id, direccion: 'saliente', estado: 'enviado', texto, adjuntos: [], error: null, created_at: new Date().toISOString(),
  };
  return { ok: true, mensaje: { ...mensajeDeFila(armada, canal, cuenta), id: `ig:${clave}` } };
}

export type ResultadoLeadSocial =
  | { ok: true; leadId: number }
  | { ok: false; error: string; elegir?: ProductoParaAlta[] };

/**
 * «Agregar al CRM» de una persona de Instagram o Messenger: crea su lead y lo une a SU fila por `lead_id`.
 *
 * ⚠️ NUNCA POR TELÉFONO NI POR NOMBRE (la regla de oro de lib/zernio-entrante.ts): un IGSID de ~17 dígitos el
 * matcheo telefónico lo confunde con un teléfono real. Por eso `permitirDuplicado`: un «@juan» chocaría con el
 * «Juan» de WhatsApp, que puede ser otra persona.
 *
 * Nace en el producto elegido (`destinoDelAlta`, la misma regla que el alta desde WhatsApp) y se une con
 * COMPARE-AND-SET (`.is('lead_id', null)`, como `crearLeadDe`): si otro evento la unió primero, gana ése.
 */
export async function crearLeadDeConversacionSocial(convId: number, funnelId: number | null): Promise<ResultadoLeadSocial> {
  const id = Number(convId);
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'Falta la conversación.' };
  const fila = await filaSocial(id);
  if (fila === undefined) return { ok: false, error: 'No pude leer la conversación.' };
  if (fila === null) return { ok: false, error: 'Esa conversación no está.' };
  if (fila.lead_id != null) return { ok: true, leadId: Number(fila.lead_id) };
  const canal = canalDePlataforma(fila.plataforma ?? 'instagram');
  if (!canal) return { ok: false, error: 'Esa conversación no es de Instagram ni de Messenger.' };

  const destino = destinoDelAlta(await leerFunnels(), funnelId);
  if ('error' in destino) return { ok: false, error: destino.error, ...(destino.elegir ? { elegir: destino.elegir } : {}) };

  const username = (fila.username ?? '').trim().replace(/^@/, '') || null;
  try {
    // Dinámico: este módulo lo importa el motor (lib/nutricion.ts), y lib/leads.ts arrastra media app.
    const { createLead } = await import('./leads');
    const lead = await createLead({
      nombre: username ? `@${username}` : `Contacto de ${NOMBRE_CANAL[canal]}`,
      origen_lead: canal,
      utm_source: plataformaDe(canal),
      // ⚠️ `destino.casa` ya pasó por `casaParaEscribir`: el default va NULL (con su id escrito, el lead no
      // sale en ningún tablero).
      funnel_id: destino.casa,
      ...(canal === 'instagram' && username ? { instagram: username } : {}),
      permitirDuplicado: true,
    });
    const db = await getTenantDb();
    const { data, error } = await db.from('ig_conversaciones').update({ lead_id: lead.id }).eq('id', id).is('lead_id', null).select('lead_id');
    if (error) return { ok: false, error: `No pude unir el lead: ${error.message}` };
    if (!(data ?? []).length) {
      const { data: actual, error: eAct } = await db.from('ig_conversaciones').select('lead_id').eq('id', id).maybeSingle();
      const ganador = (actual as { lead_id?: number | null } | null)?.lead_id ?? null;
      console.warn(`[canal-zernio] la conversación ${id} ya tenía lead (${ganador ?? 'no pude leerlo'}): el ${lead.id} quedó sin unir`);
      if (eAct || ganador == null) return { ok: false, error: 'No pude unir el lead.' };
      return { ok: true, leadId: Number(ganador) };
    }
    return { ok: true, leadId: lead.id };
  } catch (e) {
    console.error(`[canal-zernio] crear el lead de la conversación ${id}: ${msg(e)}`);
    return { ok: false, error: 'No pude crear el lead.' };
  }
}
