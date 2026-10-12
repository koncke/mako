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

import 'server-only';
import { getTenantDb } from './workspace';
import { enviarDm, responderComentario, esLimiteDeMeta, estadosDeSeguimiento, ZernioError } from './zernio';
import {
  decidirSalida, plataformaDe, problemaDeAdjunto, tipoAdjuntoZernio, NOMBRE_CANAL, COLS_CONVERSACION_SOCIAL,
  conversacionQueCuenta, conversacionDeFila, conversacionesPorLead, pedidoDeSeguimiento,
  type CanalSocial, type ConversacionesPorLead, type FilaConversacionSocial,
} from './canal-social';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { enTandas } from './ids-con-filas';
import { aplicarVariables } from './template-vars';
import { PAUSA_ENTRE_PARTES_MS, type ParteMensaje } from './mensaje-partes';
import { getAdjunto, urlsDeAdjuntos } from './setting-adjuntos';

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
async function conversacionDe(leadId: number, canal: CanalSocial): Promise<FilaConversacionSocial | null | undefined> {
  const db = await getTenantDb();
  const { data, error } = await db.from('ig_conversaciones').select(COLS_CONVERSACION_SOCIAL)
    .eq('lead_id', leadId).eq('plataforma', plataformaDe(canal));
  if (error) {
    console.error(`[canal-zernio] conversación del lead ${leadId} (${canal}): ${error.message}`);
    return undefined;
  }
  return conversacionQueCuenta((data ?? []) as FilaConversacionSocial[]);
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
}): Promise<ResultadoSocial> {
  const { ws, leadId, canal, partes, vars, idempotencia } = input;
  const desde = Math.max(0, Math.min(partes.length, input.desde ?? 0));
  const nombre = NOMBRE_CANAL[canal];
  const fila = await conversacionDe(leadId, canal);
  if (fila === undefined) return { ok: false, salieron: desde, textos: [], destino: null, error: `no pude leer la conversación de ${nombre}`, backoffHoras: 4 };
  const destino = fila ? (fila.username ? `@${fila.username}` : fila.igsid) : null;
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
