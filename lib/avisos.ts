// =============================================================================
// avisos — el choke point ÚNICO "evento → aviso al dueño"
// =============================================================================
// Todo aviso al dueño pasa por acá: escribe el feed in-app (crearNotificacion) y
// lo manda al grupo de WhatsApp (SuperAdmin si es del dueño, "MaKo <> cliente" si
// es de un cliente), con DEDUP temporal para que el cron horario no repita la
// misma alerta cada hora mientras la condición persiste. La DETECCIÓN vive en el
// código que llama (barata/determinística); acá solo se despacha la voz.
//
// FASE 1 del plan de avisos (workflow mako-avisos-discovery): reusa piezas que ya
// existen (crearNotificacion, grupos de mako-grupo) y agrega estado+dedup.

import 'server-only';
import { createHash } from 'node:crypto';
import { crearNotificacion, type NotifSeveridad } from './notificaciones';
import { enviarAlGrupoSuperAdmin, enviarAlGrupoMaKo, getGrupoJidMaKo, getGrupoSuperAdminJid } from './mako-grupo';
import { getSetting, setSetting } from './settings';
import { avisoWaActivo } from './perfil';
import { runWithWorkspace, getWorkspaceActual, OWNER_WS } from './workspace';
import type { CategoriaAviso, SemaforoAviso, AvisoCatalogo } from './avisos-catalogo';
import { CATALOGO_AVISOS, encabezadoAviso } from './avisos-catalogo';

const SEV_POR_SEMAFORO: Record<SemaforoAviso, NotifSeveridad> = {
  rojo: 'urgente', amarillo: 'warn', verde: 'ok', na: 'info',
};

export type EmitirAvisoInput = {
  /** slug del catálogo; sirve de `tipo` en el feed y de key de dedup. */
  tipo: string;
  titulo: string;
  /** el mensaje completo, ya en la voz de MaKo, que va al WhatsApp. */
  texto: string;
  categoria?: CategoriaAviso;
  semaforo?: SemaforoAviso;
  link?: string;
  /** no repetir el mismo `tipo` dentro de esta ventana (minutos). */
  dedupTtlMin?: number;
  /**
   * QUÉ entidad es esta (el id de la reserva, del lead, de la campaña).
   *
   * ⚠️ ES LO QUE HACE USABLE AL DEDUP. Sin esto la clave es solo el `tipo`, así que
   * poner `dedupTtlMin` en un aviso por-entidad se tragaba el evento de OTRO lead
   * — y por eso los avisos de reunión se cablearon SIN dedup, con el comentario
   * puesto. Resultado: el mismo agendado salió 2 y 3 veces (medido: 25 s, 41 s,
   * 38 s y 9 s de diferencia), porque los webhooks se reentregan.
   *
   * Con `dedupKey`, dos leads distintos agendando en la misma hora salen los dos, y
   * la misma reserva entregada tres veces sale UNA. Son dos preguntas distintas y
   * la clave tenía una sola.
   */
  dedupKey?: string;
  /**
   * Workspace del aviso. Si no se pasa, se toma el del contexto en el que ya se
   * está corriendo, y recién si no hay ninguno se cae al dueño.
   */
  ws?: number;
  /** forzar el canal del dueño (grupo SuperAdmin) aunque ws no sea OWNER_WS. */
  alDueno?: boolean;
};

// `wa:false` con `waError` = el aviso NO llegó a WhatsApp (línea desconectada, grupo
// sin JID, Evolution caído). Antes solo existía el booleano y nadie lo miraba: la voz
// de MaKo podía estar muerta días sin que nada lo dijera. Los callers (crons) lo logean.
export type EmitirAvisoResult = {
  ok: boolean; feedId: number | null; wa: boolean; deduped: boolean; waError?: string;
  /** el dueño apagó este aviso en Configuraciones › Notificaciones. */
  apagado?: boolean;
};

/**
 * La clave del dedup. Con `dedupKey` se acota a ESA entidad; sin él se comporta
 * igual que siempre (por tipo), que es lo correcto para un aviso global como
 * «tu cuenta de Meta está frenada».
 *
 * El id se HASHEA: un URI de Calendly son ~80 caracteres y la clave de
 * `app_settings` no es lugar para meter un identificador ajeno entero.
 */
const keyLast = (tipo: string, dedupKey?: string) => {
  if (!dedupKey) return `mako.aviso.last.${tipo}`;
  const h = createHash('sha1').update(dedupKey).digest('base64url').slice(0, 12);
  return `mako.aviso.last.${tipo}:${h}`;
};

async function avisadoReciente(ws: number, tipo: string, ttlMin: number, dedupKey?: string): Promise<boolean> {
  const raw = await runWithWorkspace(ws, () => getSetting(keyLast(tipo, dedupKey)));
  if (!raw) return false;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ttlMin * 60_000;
}
async function marcarAvisado(ws: number, tipo: string, dedupKey?: string): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(keyLast(tipo, dedupKey), new Date().toISOString()));
}

/**
 * Emite un aviso al dueño: feed in-app + WhatsApp (grupo del dueño o del cliente),
 * con dedup opcional. Best-effort: nunca lanza (un fallo del feed o del envío no
 * debe tumbar el cron/webhook que lo dispara).
 */
export async function emitirAviso(a: EmitirAvisoInput): Promise<EmitirAvisoResult> {
  // El default era OWNER_WS a secas, y eso ignoraba el workspace en el que la
  // llamada YA estaba corriendo. Ocho avisos (Calendly, Fathom, Chatwoot, Meta
  // Leads, la retro, las tareas autocompletadas) se emiten sin `ws` desde adentro
  // de un `runWithWorkspace(cliente)`, así que caían al 1 y arrastraban con ellos
  // las TRES cosas que dependen de este valor: a qué grupo se manda, contra qué
  // workspace se dedupea y de quién se lee el interruptor. El resultado era que el
  // evento de un cliente sonaba en el grupo del dueño, que dos clientes con el
  // mismo aviso se pisaban el dedup entre sí, y que apagar el aviso en la
  // configuración del cliente no hacía nada.
  //
  // Cae al dueño solo cuando de verdad no hay contexto (crons, sistema).
  const ws = a.ws ?? (await getWorkspaceActual()) ?? OWNER_WS;
  try {
    if (a.dedupTtlMin && (await avisadoReciente(ws, a.tipo, a.dedupTtlMin, a.dedupKey))) {
      return { ok: true, feedId: null, wa: false, deduped: true };
    }
    const feedId = await crearNotificacion({
      tipo: a.tipo,
      severidad: SEV_POR_SEMAFORO[a.semaforo ?? 'na'],
      titulo: a.titulo,
      descripcion: a.texto,
      link: a.link ?? '/configuraciones?tab=notif',
      entityType: 'aviso',
      payload: { texto: a.texto, categoria: a.categoria ?? null, semaforo: a.semaforo ?? 'na' },
      origen: `aviso:${a.tipo}`,
    });
    // El dueño puede apagar este aviso desde Configuraciones › Notificaciones. Se
    // apaga el WHATSAPP, no el registro: la fila del feed queda igual, así que
    // silenciar un aviso no borra la bitácora de que el evento pasó.
    //
    // NO se marca el dedup acá. La marca existe para "ya lo dije hace poco, no lo
    // repito", y un aviso apagado nunca se dijo. Marcarlo envenenaba el interruptor:
    // apagar y volver a prender dejaba el aviso mudo hasta que venciera el TTL —
    // días, en los que tienen ventana larga— sin nada que lo explicara.
    if (!(await avisoWaActivo(ws, a.tipo))) {
      return { ok: true, feedId, wa: false, deduped: false, apagado: true };
    }

    // Ruteo: al grupo del CLIENTE (su "MaKo <> cliente") por default. El grupo de
    // SuperAdmin es SOLO para avisos de agencia (cross-cliente) marcados alDueno.
    // Así los eventos de un cliente (aunque corran en OWNER_WS) NO caen en el grupo
    // de SuperAdmin — el cliente los recibe en SU grupo (creado en Config>Notif).
    // El RÓTULO se pega acá y en ningún otro lado. Es el choke point: así lo
    // llevan los ~48 avisos del catálogo y también los que se creen mañana, sin
    // que nadie tenga que acordarse. Va solo al WhatsApp — en el feed in-app el
    // mensaje ya está dentro de una tarjeta con su título, y ahí las barras son
    // ruido (por eso `crearNotificacion` arriba recibe el texto pelado).
    //
    // Idempotente a propósito: si un call-site ya lo trae (una plantilla que el
    // dueño editó a mano copiando el formato), no se duplica.
    const encabezado = encabezadoAviso(a.tipo);
    const texto = a.texto.trimStart().startsWith('━━') ? a.texto : `${encabezado}\n${a.texto}`;
    const env = a.alDueno === true ? await enviarAlGrupoSuperAdmin(texto) : await enviarAlGrupoMaKo(ws, texto);
    if (!env.ok) console.error(`[avisos] ${a.tipo}: NO salió por WhatsApp (ws ${ws}) — ${env.error}`);
    // El aviso queda EN LA CONVERSACIÓN del grupo. Sin esto, MaKo manda una pregunta
    // ("saqué 97 compromisos, ¿los cargo?") y no le queda ningún registro: cuando el
    // dueño contesta "sí, cargalo", el doer no sabe a qué le dijo que sí y se agarra
    // del mensaje anterior que encuentre. Pasó: confirmó una charla de cuatro días
    // antes y duplicó dos tareas.
    if (env.ok) {
      const { guardarTurno } = await import('./mako-doer-conv');
      const jid = a.alDueno === true ? await getGrupoSuperAdminJid() : await getGrupoJidMaKo(ws);
      // Se guarda el texto QUE SE MANDÓ (con rótulo), no el pelado: el historial
      // del doer tiene que ser lo que el dueño ve en el chat, o el modelo razona
      // sobre un mensaje que nadie leyó.
      if (jid) await guardarTurno(ws, jid, 'assistant', texto, env.id).catch(() => {});
    }
    if (a.dedupTtlMin) await marcarAvisado(ws, a.tipo, a.dedupKey);
    return { ok: true, feedId, wa: env.ok, deduped: false, waError: env.ok ? undefined : env.error };
  } catch (e) {
    console.error(`[avisos] emitirAviso(${a.tipo}) falló:`, e);
    return { ok: false, feedId: null, wa: false, deduped: false };
  }
}

/** Busca una entrada del catálogo por id. */
export function avisoDelCatalogo(id: string): AvisoCatalogo | undefined {
  return CATALOGO_AVISOS.find((a) => a.id === id);
}

/**
 * Emite un aviso a partir de una entrada del catálogo (usa su `ejemplo` como
 * texto por defecto, o el `texto` provisto cuando hay datos reales).
 */
/**
 * Emite un aviso del catálogo. La plantilla es una REFERENCIA (editable): si se
 * pasa `contexto` (datos reales del evento), MaKo GENERA el mensaje con IA usando
 * la referencia + esos datos (libre de adaptarla). Si se pasa `texto`, se usa tal
 * cual. Si no, cae a la referencia literal. Respeta activar/desactivar la plantilla.
 */
export async function emitirDelCatalogo(
  id: string, opts: { texto?: string; contexto?: string; ws?: number; dedupTtlMin?: number; dedupKey?: string; alDueno?: boolean } = {},
): Promise<EmitirAvisoResult> {
  const cat = avisoDelCatalogo(id);
  if (!cat) return { ok: false, feedId: null, wa: false, deduped: false };
  const { plantillaActiva, referenciaPlantilla, generarMensajeAviso } = await import('./plantillas');
  if (!(await plantillaActiva(id))) return { ok: true, feedId: null, wa: false, deduped: true }; // desactivada → no manda
  const texto = opts.texto
    ?? (opts.contexto ? await generarMensajeAviso(id, opts.contexto) : await referenciaPlantilla(id));
  return emitirAviso({
    tipo: cat.id, titulo: cat.titulo, texto,
    categoria: cat.categoria, semaforo: cat.semaforo,
    ws: opts.ws, dedupTtlMin: opts.dedupTtlMin, dedupKey: opts.dedupKey, alDueno: opts.alDueno,
  });
}
