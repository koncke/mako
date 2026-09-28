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
import { getSetting, cambiarSettingSi } from './settings';
import { avisoWaActivo, resumenAvisosActivo } from './perfil';
import { puedeEsperar } from './avisos-agrupables';
import { encolarAviso } from './avisos-cola';
import { runWithWorkspace, getWorkspaceActual, wsSuperAdmin, OWNER_WS } from './workspace';
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
  /** no salió ahora: espera en `avisos_cola` al resumen de la mañana (mig 0161). */
  agrupado?: boolean;
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

/**
 * RECLAMA el aviso antes de mandarlo. Devuelve false si otro ya se lo llevó.
 *
 * ⚠️ POR QUÉ NO ALCANZABA CON `avisadoReciente` + `marcarAvisado`. Eso es leer, hacer y
 * marcar — y un dedup así sólo funciona contra reintentos MÁS LENTOS que la operación
 * del medio. Acá la operación del medio es el envío por WhatsApp, y no es instantáneo:
 * `lib/mako-grupo.ts` le manda a Evolution un delay de tipeo anti-ban de
 * `min(1500 + largo*45, 9000)` con jitter, y Evolution retiene el HTTP abierto mientras
 * lo simula. Para un aviso de «Nuevo agendado» (169-173 caracteres) eso es **7,2 a 10,8
 * segundos** entre la lectura y la marca.
 *
 * Medido en producción el 27/09/2026 sobre `mako_doer_conv`: el cliente que reserva por
 * Cal.com tuvo **51 avisos con 21 pares duplicados**, con huecos de 0,4 a 12,4 segundos —
 * quince de los veintiuno justo encima del bloqueo del envío. El que reserva por Calendly
 * tuvo 5 avisos y CERO duplicados, porque Calendly reentrega a los 22-41 s y eso cae
 * después de la marca. El mismo código, dos resultados opuestos según la cadencia de
 * reintento del proveedor.
 *
 * ⚠️ Y LA CADENCIA DE UN PROVEEDOR NO SE MIDE CON EL DEDUP PUESTO: sólo se ven los
 * reintentos más rápidos que la ventana, porque los lentos ya no dejan fila. El techo de
 * 12,4 s es el techo de LA VENTANA, no el de Cal.com. Por eso esto no se arregla
 * ensanchando el TTL ni acortando el delay: se arregla haciendo la reclamación ATÓMICA.
 *
 * `cambiarSettingSi` ya existía para exactamente esto (dos clics en «Conectar por QR»
 * abrían dos líneas de WhatsApp): de dos requests que compiten, gana UNA.
 */
async function reclamarAviso(ws: number, tipo: string, ttlMin: number, dedupKey?: string): Promise<boolean> {
  return runWithWorkspace(ws, async () => {
    const key = keyLast(tipo, dedupKey);
    const previo = await getSetting(key);
    if (previo) {
      const t = Date.parse(previo);
      // Vigente: alguien lo dijo hace poco y esta copia no tiene nada que agregar.
      if (!Number.isNaN(t) && Date.now() - t < ttlMin * 60_000) return false;
    }
    // El compare-and-set va contra el valor EXACTO que se acaba de leer: si entre la
    // lectura y acá otro lo cambió, pierde y no manda. `previo === null` usa la rama de
    // insertar-si-no-existe, que también es atómica.
    return cambiarSettingSi(key, previo, new Date().toISOString());
  });
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

    // ⚠️ SE RECLAMA ACÁ, Y ESTE LUGAR ES PARTE DEL ARREGLO. Va DESPUÉS del interruptor,
    // por lo que explica el comentario de arriba: un aviso apagado nunca se dijo y
    // marcarlo envenena el interruptor. Y va ANTES de los dos caminos que sí lo dicen —
    // la cola y el envío— para que un solo reclamo cubra a los dos: puesto en cada uno
    // serían dos lugares con la misma regla, y el segundo se queda viejo.
    //
    // Reemplaza a los dos `marcarAvisado` que había después de cada camino. La marca
    // seguía escribiéndose aunque el envío fallara, y eso no cambia: un aviso que no
    // salió por una línea caída no se reintenta a los segundos.
    if (a.dedupTtlMin && !(await reclamarAviso(ws, a.tipo, a.dedupTtlMin, a.dedupKey))) {
      return { ok: true, feedId, wa: false, deduped: true };
    }

    // ⚠️ ¿ESTO NECESITABA INTERRUMPIRLO? Si el aviso es de los que aguantan hasta mañana
    // (lib/avisos-agrupables.ts, lista en POSITIVO) y el workspace pidió juntarlos, se
    // GUARDA y sale en el resumen de la mañana. Va acá, después del interruptor y antes
    // del envío, por dos razones: un aviso apagado no tiene que ocupar lugar en la cola, y
    // lo que se pospone tiene que quedar ESCRITO antes de decidir el canal — la salida
    // barata («subo el dedupTtlMin y listo») descarta los avisos 2..N sin dejar rastro.
    //
    // Si el insert falla, NO se pospone: sigue de largo y sale como siempre. Perder un
    // aviso por un error de la base sería peor que el problema que esto viene a resolver.
    // ⚠️ LA COLA ES DE QUIEN LO VA A LEER, NO DE QUIEN LO GENERÓ. Un aviso `alDueno` sale
    // por el grupo del super-admin aunque se haya emitido adentro del workspace de un
    // cliente (así lo hacen los crons que iteran inquilinos). Si la cola fuera del cliente,
    // pasarían dos cosas malas: la preferencia que decide sería la de ÉL y no la del dueño,
    // y el resumen saldría partido en un mensaje por cliente — que es exactamente lo que
    // este resumen viene a evitar.
    const wsCola = a.alDueno === true ? await wsSuperAdmin().catch(() => ws) : ws;
    if (puedeEsperar(a.tipo, a.categoria) && (await resumenAvisosActivo(wsCola))) {
      const guardado = await encolarAviso(wsCola, {
        tipo: a.tipo, titulo: a.titulo, texto: a.texto,
        categoria: a.categoria, semaforo: a.semaforo, link: a.link, alDueno: a.alDueno === true,
      });
      if (guardado) {
        return { ok: true, feedId, wa: false, deduped: false, agrupado: true };
      }
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

      // ¿ESTE AVISO INSISTE? Si el cliente lo configuró en Configuraciones ›
      // Notificaciones, además de salir queda una insistencia abierta: vuelve cada N
      // minutos hasta que alguien conteste «ok» en el grupo, o hasta el techo.
      //
      // Va acá y no en el motor de flujos porque los avisos en vivo NO pasan por ahí:
      // salen por este choke point. Sin esto, configurar la insistencia no haría nada
      // — la pantalla prometería algo que nadie ejecuta.
      //
      // Sólo con env.ok: insistir sobre un mensaje que no salió es empezar a contar
      // repeticiones de algo que nadie vio. Y sólo para el grupo del CLIENTE: los
      // avisos `alDueno` van al grupo de la agencia, que no es de quien configuró esto.
      if (a.alDueno !== true) {
        try {
          const { getFlujo } = await import('./plantillas');
          const flujo = await runWithWorkspace(ws, () => getFlujo(a.tipo));
          const paso = flujo?.pasos.find((x) => x.tipo === 'insistir');
          if (paso?.tipo === 'insistir') {
            const { abrirInsistencia } = await import('./insistencias');
            await abrirInsistencia(ws, { flujoId: a.tipo, texto, cadaMin: paso.cadaMin, veces: paso.veces });
          }
        } catch (e) {
          // Que falle la insistencia no puede tumbar el aviso, que YA salió.
          console.error(`[avisos] insistencia de ${a.tipo}:`, e instanceof Error ? e.message : String(e));
        }
      }
    }
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
  // ⚠️ EL MODELO SE PAGA DESPUÉS DE SABER SI EL MENSAJE VA A SALIR. `generarMensajeAviso`
  // es una llamada a la IA, y hasta hoy corría SIEMPRE — también para un aviso que el
  // interruptor tenía apagado o que el dedup iba a descartar. Con el resumen diario eso se
  // vuelve caro de verdad: se pagaría una redacción por cada aviso que después se resume
  // en una línea. En la cola entra el título, que es lo que el resumen muestra.
  const ws = opts.ws ?? (await getWorkspaceActual()) ?? OWNER_WS;
  const wsPref = opts.alDueno === true ? await wsSuperAdmin().catch(() => ws) : ws;
  const alResumen = puedeEsperar(cat.id, cat.categoria) && (await resumenAvisosActivo(wsPref));
  // ⚠️ AL RESUMEN VA EL CONTEXTO CRUDO, NO LA PLANTILLA DE REFERENCIA. La referencia es la
  // MISMA frase para todos los avisos de ese tipo, así que el renglón del resumen no diría
  // de qué reunión, de qué retro ni de qué objetivo habla — que es la única parte
  // accionable. El contexto es feo (son notas para el modelo) pero es el dato.
  const texto = opts.texto
    ?? (opts.contexto ? (alResumen ? opts.contexto : await generarMensajeAviso(id, opts.contexto)) : await referenciaPlantilla(id));
  return emitirAviso({
    tipo: cat.id, titulo: cat.titulo, texto,
    categoria: cat.categoria, semaforo: cat.semaforo,
    ws: opts.ws, dedupTtlMin: opts.dedupTtlMin, dedupKey: opts.dedupKey, alDueno: opts.alDueno,
  });
}
