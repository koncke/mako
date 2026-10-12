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
import { crearNotificacion, type NotifSeveridad } from './notificaciones';
import { enviarAlGrupoSuperAdmin, enviarAlGrupoMaKo, enviarPartesAlGrupoMaKo, getGrupoJidMaKo, getGrupoSuperAdminJid } from './mako-grupo';
import { partesConRotulo, textoDePreparadas, type PartePreparada } from './mako-tarjeta';
import { reclamarEspaciado, salioReciente } from './espaciado';
import { frecuenciaEfectiva } from './disparador-mensaje';
import { estadoAviso, resumenAvisosActivo, type EstadoAviso } from './perfil';
import { puedeEsperar } from './avisos-agrupables';
import { encolarAviso } from './avisos-cola';
import { runWithWorkspace, getWorkspaceActual, wsSuperAdmin, OWNER_WS } from './workspace';
import type { CategoriaAviso, SemaforoAviso, AvisoCatalogo } from './avisos-catalogo';
import { CATALOGO_AVISOS, encabezadoAviso } from './avisos-catalogo';
import { AVISOS_POR_EVENTO, emitirPorEvento, type DepsEvento, type FilaEvento } from './aviso-evento';
import { TRIGGER_AVISO_MAKO } from './disparadores';

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
  /**
   * El asunto del EMAIL, cuando el mensaje tiene uno propio. Vacío = el título.
   *
   * Son dos campos porque son dos cosas: el título es el nombre interno del mensaje
   * —lo que se lee en el feed y en la lista de /mensajes— y el asunto es lo que ve
   * alguien en su bandeja. «Lead sin confirmar» está bien como título y se lee como un
   * log adentro de un correo.
   */
  asuntoEmail?: string;
  /**
   * De QUÉ LEAD habla este aviso, cuando habla de uno.
   *
   * ⚠️ ES LO QUE HACE RESOLVIBLES LOS DATOS DEL CRM. Hasta el 04/10/2026 el emisor no
   * tenía por dónde recibir un lead, así que los tokens del catálogo (`{{lead_saldo}}`,
   * `{{lead_estado}}`, …) no se resolvían en NINGÚN camino aunque el evento que dispara
   * el aviso traiga el id en la mano — y lo que salía al WhatsApp era el token crudo.
   * El `nombre` viaja aparte porque el evento lo tiene y es más nuevo que la fila.
   */
  lead?: { id: number; nombre?: string | null };
  /**
   * EL ESTADO YA DECIDIDO (11/10/2026): lo pasa la tarjeta «MaKo en WhatsApp» de un evento de MaKo
   * (`ESTADO_EVENTO`, lib/aviso-evento.ts) y su apagado (`APAGADO`). Presente, NO se lee el store
   * (`estadoAviso`) ni se abre una insistencia: el interruptor de esos avisos es la automatización.
   */
  estado?: EstadoAviso;
  /**
   * LA TARJETA «MaKo en WhatsApp» POR PARTES (undécima tanda, lib/mako-tarjeta.ts): al grupo del negocio
   * salen ESTAS partes (texto, nota de voz, archivo), en orden, en vez de `texto`. Ya vienen preparadas:
   * los datos resueltos y los binarios bajados. `texto` sigue siendo lo que leen el feed, el push y el email.
   * Sólo al grupo del CLIENTE: un aviso `alDueno` sale como texto.
   */
  partes?: readonly PartePreparada[];
  /** `false`: sin el rótulo de barras del grupo (`encabezadoAviso`). La tarjeta tal cual sale como se ve. */
  rotulo?: false;
};

// `wa:false` con `waError` = el aviso NO llegó a WhatsApp (línea desconectada, grupo
// sin JID, Evolution caído). Antes solo existía el booleano y nadie lo miraba: la voz
// de MaKo podía estar muerta días sin que nada lo dijera. Los callers (crons) lo logean.
export type EmitirAvisoResult = {
  /** ¿Salió también por email? Ausente en los caminos que ni lo intentan. */
  email?: boolean;
  /**
   * El Web Push a los teléfonos (MaKo Mobile, lib/push.ts): a cuántas suscripciones salió y
   * a cuántas personas que lo querían les falta un teléfono. Ausente en los caminos que no
   * llegan al envío (dedup, apagado, espaciado, agrupado).
   */
  push?: { enviados: number; fallidos: number; sinSuscripciones: number; motivo?: string };
  ok: boolean; feedId: number | null; wa: boolean; deduped: boolean; waError?: string;
  /** no salió porque el negocio lo espació en la pantalla, no porque se repitiera. */
  espaciado?: boolean;
  /** el dueño apagó este aviso en Configuraciones › Notificaciones. */
  apagado?: boolean;
  /** no salió ahora: espera en `avisos_cola` al resumen de la mañana (mig 0161). */
  agrupado?: boolean;
  /** Un evento de MaKo: cuántas automatizaciones del negocio corrieron (lib/aviso-evento.ts). */
  filas?: number;
};

// El reclamo ATÓMICO de «¿ya salió hace poco?» vive en lib/espaciado.ts: lo usan los
// DOS despachadores (avisos y reportes) y una copia en cada uno habría dejado a la de
// reportes sin el compare-and-set. El porqué, con las mediciones, está allá.

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
    if (a.dedupTtlMin && (await salioReciente(ws, a.tipo, a.dedupTtlMin, a.dedupKey))) {
      return { ok: true, feedId: null, wa: false, deduped: true };
    }
    // ⚠️ EL WORKSPACE DE QUIEN LO VA A LEER, no el de quien lo generó (la misma regla que la
    // cola, más abajo): un aviso `alDueno` sale por el grupo del super admin aunque se emita
    // adentro del workspace de un cliente, así que su fila del feed y su push son del
    // workspace de PLATAFORMA. Con el `ws` del cliente, el cliente vería en su Inbox los
    // avisos de agencia sobre él, y el super admin no los vería en el suyo.
    const wsLector = a.alDueno === true ? await wsSuperAdmin().catch(() => ws) : ws;
    const feedId = await crearNotificacion({
      ws: wsLector,
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
    //
    // ⚠️ SON DOS PREGUNTAS. `activo` es «este mensaje existe para este negocio» y
    // `wa`/`email` es «por dónde me llega». Estaban fundidas en un booleano, y por eso
    // «éste sí, pero sólo por mail» no existía: el único camino era apagarlo entero.
    // Apagar los DOS canales equivale a apagarlo — y conserva su texto y su flujo.
    // Un evento de MaKo trae el estado decidido (`a.estado`): de esos avisos el store ya no se lee.
    const canal = a.estado ?? await estadoAviso(ws, a.tipo);
    if (!canal.activo || (!canal.wa && !canal.email)) {
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
    //
    // ⚠️ Y EL NÚMERO YA NO ES SÓLO EL DEL CALL SITE. `canal.frecuenciaMin` es el «cada
    // cuánto, como máximo» que el negocio eligió en el detalle del mensaje, y gana el
    // MAYOR de los dos: lo que pide quien emite es el TECHO de frecuencia y la pantalla
    // sólo puede espaciar por debajo. Con un `??` en vez del `Math.max`, elegir «cada
    // vez» borraría la protección del call site y esta pantalla pasaría a poder producir
    // MÁS mensajes que antes — lo único que no puede hacer.
    //
    // ⚠️ Y VA ACÁ, DESPUÉS DEL FEED, NO ARRIBA CON EL OTRO CHEQUEO. El de arriba corta
    // antes de escribir la fila del feed, y para el dedup del call site eso es correcto:
    // es la MISMA condición contándose de nuevo, no un hecho nuevo. Un mensaje que el
    // negocio espació es otra cosa: el hecho pasó y tiene que quedar en la bitácora
    // igual, como con el interruptor — se espacia el WhatsApp, no el registro.
    const minutos = frecuenciaEfectiva(a.dedupTtlMin, canal.frecuenciaMin);
    if (minutos && !(await reclamarEspaciado(ws, a.tipo, minutos, a.dedupKey))) {
      return { ok: true, feedId, wa: false, deduped: true, espaciado: minutos > (a.dedupTtlMin ?? 0) };
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
    const wsCola = wsLector;
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
    // `rotulo: false` (la tarjeta «MaKo en WhatsApp» tal cual): lo que se ve en la tarjeta es lo que llega.
    const texto = a.rotulo === false || a.texto.trimStart().startsWith('━━') ? a.texto : `${encabezado}\n${a.texto}`;
    // Por PARTES (la tarjeta por partes): el rótulo, si va, pegado a la primera. Al grupo del dueño, texto.
    const salida = a.partes?.length && a.alDueno !== true ? partesConRotulo(a.partes, a.rotulo === false ? null : encabezado) : null;
    // ⚠️ EL PUSH AL TELÉFONO (MaKo Mobile) VA ACÁ, y el lugar es parte del contrato: DESPUÉS
    // del interruptor (un aviso apagado no suena), del espaciado (el «cada cuánto» del negocio
    // vale también para el teléfono) y de la cola del resumen (lo que el negocio pidió juntar
    // a la mañana no interrumpe ahora). Antes de cualquiera de los tres, pushearía lo que el
    // negocio decidió no mandar. Arranca acá y se espera al final: en PARALELO con el correo
    // y el WhatsApp, que pueden tardar segundos. Best-effort: nunca tumba el aviso.
    const pushP = enviarPushAviso(wsLector, a);
    // Y EL EMAIL, si el cliente lo prendió para este aviso. Va acá, en el choke point,
    // por lo mismo que el resto: los ~48 avisos del catálogo y los que se creen mañana
    // lo heredan sin que nadie se acuerde. Primero el correo y después WhatsApp no es
    // capricho: el de WhatsApp puede tardar (abre sesión, resuelve el grupo) y el correo
    // no depende de él — si la línea está caída, el aviso igual sale por mail.
    const email = canal.email ? await enviarAvisoPorEmail(a, texto) : false;
    // ⚠️ Por partes, una parte salió sólo con su `key.id` y corta en la primera que falla: `salieron` dice
    // cuántas le llegaron al grupo, y el historial guarda ésas (no las que no salieron).
    const porPartes = canal.wa && salida ? await enviarPartesAlGrupoMaKo(ws, salida) : null;
    const env = canal.wa
      ? (a.alDueno === true ? await enviarAlGrupoSuperAdmin(texto)
        : porPartes ? (porPartes.ok ? { ok: true as const, id: porPartes.ids[porPartes.ids.length - 1] ?? '' } : { ok: false as const, error: porPartes.error ?? 'no salió' })
          : await enviarAlGrupoMaKo(ws, texto))
      : { ok: false as const, id: undefined, error: undefined };
    if (canal.wa && !env.ok) console.error(`[avisos] ${a.tipo}: NO salió por WhatsApp (ws ${ws}) — ${env.error}`);
    // Lo que el grupo VIO: el texto, o las partes que salieron (sin las que no).
    const textoTurno = porPartes && salida ? textoDePreparadas(salida.slice(0, porPartes.salieron)) : texto;
    if (porPartes && !porPartes.ok && porPartes.salieron > 0) {
      const jidParcial = await getGrupoJidMaKo(ws);
      if (jidParcial) {
        const { guardarTurno } = await import('./mako-doer-conv');
        await guardarTurno(ws, jidParcial, 'assistant', textoTurno, porPartes.ids[porPartes.ids.length - 1]).catch(() => {});
      }
    }
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
      // sobre un mensaje que nadie leyó. Por partes, los textos de las partes.
      if (jid) await guardarTurno(ws, jid, 'assistant', textoTurno, env.id).catch(() => {});

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
      // Ni para un evento de MaKo (`a.estado`): su «insistir» sería una tarjeta, y no la hay (diseño §8).
      if (a.alDueno !== true && !a.estado) {
        try {
          const { getFlujo } = await import('./plantillas');
          const flujo = await runWithWorkspace(ws, () => getFlujo(a.tipo));
          // ⚠️ Y SE MIRA `activo`. `getFlujo` no filtra —el que filtra es
          // `listarFlujosActivos`, que alimenta al otro camino—, así que un flujo
          // pausado abría insistencias igual: un interruptor que miente, y lo que
          // sigue saliendo es lo que quema la línea de WhatsApp del cliente.
          const paso = flujo?.activo === false ? undefined : flujo?.pasos.find((x) => x.tipo === 'insistir');
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
    const push = await pushP;
    return { ok: true, feedId, wa: env.ok, email, push, deduped: false, waError: env.ok ? undefined : env.error };
  } catch (e) {
    console.error(`[avisos] emitirAviso(${a.tipo}) falló:`, e);
    return { ok: false, feedId: null, wa: false, deduped: false };
  }
}

/**
 * El aviso por EMAIL. Devuelve si salió a alguien.
 *
 * ⚠️ LO MANDA MAKO, NO EL NEGOCIO DEL CLIENTE. Sin `from` explícito, `sendEmail`
 * resuelve el `resend_from` DEL WORKSPACE, y un cliente que todavía no conectó su
 * dominio —casi todos— cae en el remitente sandbox de Resend, que entrega sólo al
 * dueño de la cuenta: el aviso no llegaría y nada lo diría. El molde es
 * lib/canal-vigilante.ts, que manda con `REMITENTE_MAKO` por esta misma razón.
 *
 * ⚠️ Y NO PASA POR `envioEmailHabilitado()`. Ese flag gobierna la nutrición y los
 * broadcasts —lo que el cliente le manda a SUS leads— y es fail-closed para todo
 * workspace sin la setting. Usarlo acá sería un SEGUNDO interruptor para un hecho que
 * ya tiene el suyo (`canales.email` de esta plantilla): el cliente lo prende, no pasa
 * nada, y no hay forma de saber por qué.
 *
 * El texto que viaja es el PELADO, sin el rótulo de barras del grupo: el correo tiene
 * su propio título y su banda de marca, y el rótulo ahí es ruido — la misma razón por
 * la que `crearNotificacion` recibe el texto sin él.
 */
async function enviarAvisoPorEmail(a: EmitirAvisoInput, textoConRotulo: string): Promise<boolean> {
  try {
    const wsCorreo = a.alDueno === true ? await wsSuperAdmin().catch(() => a.ws ?? OWNER_WS) : (a.ws ?? (await getWorkspaceActual()) ?? OWNER_WS);
    const [{ getDestinatariosDe }, { sendEmail }, { renderEmailHtml }, { REMITENTE_MAKO, EMAIL_MAKO, linkApp }] = await Promise.all([
      import('./notif-destinatarios'), import('./resend'), import('./email-html'), import('./app-url'),
    ]);
    const dest = await getDestinatariosDe(wsCorreo);
    const para = [...new Set(dest.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (!para.length) return false;   // nadie a quien escribirle no es un error

    const cuerpo = a.texto;
    // El asunto propio del mensaje si lo tiene; si no, el título. El `titulo` de la
    // banda del correo NO cambia: es el nombre del aviso, y el asunto es el renglón de
    // la bandeja — mezclarlos deja el correo repitiendo lo mismo dos veces.
    const asunto = a.asuntoEmail?.trim() || a.titulo;
    const html = renderEmailHtml({
      subject: asunto, titulo: a.titulo, bodyText: cuerpo, marca: 'mako',
      // El botón del correo es el link de TODOS los avisos del catálogo: acá se pegaba
      // la base a mano y salía sin `?ws=`, así que quien tiene acceso a más de un
      // workspace —el super admin, una agencia con cartera— aterrizaba en la pantalla
      // del cliente que tuviera la cookie puesta, no en el del aviso que acaba de leer.
      cta: a.link ? { texto: 'Verlo en MaKo', url: a.link.startsWith('http') ? a.link : linkApp(a.link, wsCorreo) } : undefined,
    });
    // Uno por destinatario, no en copia: son personas distintas del mismo negocio y
    // no tienen por qué verse los mails entre ellas (igual que los reportes).
    let salio = false;
    for (const to of para) {
      const r = await sendEmail({ to, from: REMITENTE_MAKO, replyTo: EMAIL_MAKO, subject: asunto, html, text: textoConRotulo });
      if (r.ok) salio = true;
    }
    return salio;
  } catch (e) {
    // Que falle el mail no puede tumbar el aviso: WhatsApp sigue.
    console.error(`[avisos] ${a.tipo}: fallo mandando por email:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * El aviso como Web Push a los teléfonos de las personas de `wsLector` que lo quieren
 * (lib/push.ts decide quiénes). Va con el texto PELADO —sin el rótulo de barras, que es del
 * grupo— y lib/push-payload.ts lo reduce a una frase. El link es el del aviso traducido a su
 * pantalla móvil; sin link, el Inbox, que es donde vive el feed de avisos.
 *
 * TTL de 6 h (lib/push.ts, cabecera): un aviso del día sigue sirviendo a la tarde, y uno de
 * ayer que llega hoy confunde. Urgencia alta sólo para el semáforo en rojo.
 *
 * El tag junta los avisos IGUALES (mismo tipo y misma entidad, `dedupKey`): el segundo
 * reemplaza al primero en el teléfono; dos leads distintos son dos notificaciones.
 *
 * El módulo se importa dinámico: lib/push.ts trae `web-push`, y la mitad del repo importa
 * este archivo sin mandar nunca un aviso.
 */
async function enviarPushAviso(wsLector: number, a: EmitirAvisoInput): Promise<NonNullable<EmitirAvisoResult['push']>> {
  try {
    const { enviarPush } = await import('./push');
    const r = await enviarPush(wsLector, {
      tipo: a.tipo,
      titulo: a.titulo,
      cuerpo: a.texto,
      ruta: a.link ?? '/m/inbox',
      // La tarjeta por partes no tiene `dedupKey` (sale tal cual, una por tarjeta y por lead): sin algo propio
      // en el tag, cada aviso suyo reemplazaría al anterior en el teléfono.
      tag: `aviso:${a.tipo}${a.dedupKey ? `:${a.dedupKey}` : a.partes?.length ? `:${a.lead?.id ?? ''}:${Date.now().toString(36)}` : ''}`,
      ttl: 6 * 3600,
      urgencia: a.semaforo === 'rojo' ? 'high' : 'normal',
      // Un aviso habla del negocio entero (adeudo de Meta, cuotas con montos, reportes): en
      // escritorio eso es de admin, y un closer o setter no lo recibe en el teléfono.
      soloAdmins: true,
    });
    if (r.fallidos || r.motivo === 'error') console.warn(`[avisos] ${a.tipo}: push (ws ${wsLector}) ${JSON.stringify(r)}`);
    return { enviados: r.enviados, fallidos: r.fallidos, sinSuscripciones: r.sinSuscripciones, ...(r.motivo ? { motivo: r.motivo } : {}) };
  } catch (e) {
    // Que falle el push no puede tumbar el aviso: el grupo y el correo siguen.
    console.error(`[avisos] ${a.tipo}: fallo mandando el push:`, e instanceof Error ? e.message : String(e));
    return { enviados: 0, fallidos: 0, sinSuscripciones: 0, motivo: 'error' };
  }
}

/** Busca una entrada del catálogo por id. */
export function avisoDelCatalogo(id: string): AvisoCatalogo | undefined {
  return CATALOGO_AVISOS.find((a) => a.id === id);
}

/**
 * LAS PIEZAS DE VERDAD DEL EMISOR DE UN EVENTO DE MAKO (lib/aviso-evento.ts es puro y las recibe). El runner
 * se importa dinámico: lib/flujos.ts importa este módulo, y estático sería un ciclo.
 *
 * Las filas se leen con el `workspace_id` EXPLÍCITO (el molde es `toquesDelNegocio`,
 * lib/reunion-recordatorio.ts): un cron que itera inquilinos no está adentro del contexto de cada uno, y un
 * error TIRA — «no pude leer las automatizaciones» no es «no tiene».
 */
async function depsDelEvento(): Promise<DepsEvento> {
  const [{ ejecutarPasos }, { getSupabaseServer }] = await Promise.all([import('./flujos'), import('./supabase')]);
  return {
    leerFilas: async (ws) => {
      const { data, error } = await getSupabaseServer()
        .from('nutricion_secuencias').select('id, nombre, activa, pasos, trigger_tipo, disparadores')
        .eq('workspace_id', ws).eq('trigger_tipo', TRIGGER_AVISO_MAKO).is('archivada_at', null)
        .order('id', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as FilaEvento[];
    },
    emitirAviso,
    reclamar: reclamarEspaciado,
    correr: (flujoId, pasos, ws, ctx) => runWithWorkspace(ws, () => ejecutarPasos(flujoId, pasos, ws, ctx)),
    log: (m) => console.error(m),
  };
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
  id: string, opts: {
    texto?: string; contexto?: string; ws?: number; dedupTtlMin?: number; dedupKey?: string;
    alDueno?: boolean; lead?: { id: number; nombre?: string | null };
    /**
     * Valores EXACTOS que este disparador ya tiene en la mano, por clave del catálogo
     * de variables (`cuota_monto`, `cuota_numero`, …). Ganan sobre lo que el resolvedor
     * saque de la base, y van por CÓDIGO: un monto que pasa por un modelo deja de ser
     * exacto, y acá el dato exacto es plata que alguien debe.
     */
    datos?: Record<string, string>;
    /**
     * La cuota de la que habla (la pasa la cobranza, 11/10/2026). Viaja en el contexto de la corrida de un
     * evento de MaKo, y es lo que la CORTA al marcar el pago (`cerrarCorridasDeCuota`).
     */
    cuotaId?: number;
  } = {},
): Promise<EmitirAvisoResult> {
  const cat = avisoDelCatalogo(id);
  if (!cat) return { ok: false, feedId: null, wa: false, deduped: false };
  // ⚠️ EL WORKSPACE SE RESUELVE ANTES DE LEER LA PLANTILLA. Esta línea leía el store
  // del contexto AMBIENTE, no el de `opts.ws`: un cron que pasa el workspace explícito
  // sin estar adentro de un `runWithWorkspace` —así llaman los que iteran inquilinos—
  // consultaba el interruptor del DUEÑO acá y el del CLIENTE ocho líneas más abajo, en
  // `estadoAviso(ws, …)`. O sea: un aviso que el dueño tenía apagado moría acá para
  // todos sus clientes, sin importar lo que cada uno hubiera configurado.
  const ws = opts.ws ?? (await getWorkspaceActual()) ?? OWNER_WS;
  // ⚠️ UN EVENTO DE MAKO NO LEE EL STORE (11/10/2026, docs/diseno-mako-en-whatsapp-unificado.md): estos tres
  // salen SÓLO por las automatizaciones del negocio («Todos arrancan vacíos», decisión de Martín). El desvío
  // va ANTES de `getPlantilla`: leído el store, su interruptor y su texto volverían a decidir algo.
  if (AVISOS_POR_EVENTO.has(id)) return emitirPorEvento(cat, ws, opts, await depsDelEvento());
  const { getPlantilla, referenciaResuelta, generarMensajeAviso } = await import('./plantillas');
  // UNA lectura de la plantilla, y trae las cuatro respuestas que hacen falta: si está
  // prendida, cómo la llamó ESTE negocio, qué asunto le puso al correo y —vía
  // `referenciaResuelta`— qué texto manda. Eran tres lecturas del mismo store.
  const pl = await runWithWorkspace(ws, () => getPlantilla(id));
  if (!(pl?.enabled ?? true)) return { ok: true, feedId: null, wa: false, deduped: true }; // desactivada → no manda
  // ⚠️ EL MODELO SE PAGA DESPUÉS DE SABER SI EL MENSAJE VA A SALIR. `generarMensajeAviso`
  // es una llamada a la IA, y hasta hoy corría SIEMPRE — también para un aviso que el
  // interruptor tenía apagado o que el dedup iba a descartar. Con el resumen diario eso se
  // vuelve caro de verdad: se pagaría una redacción por cada aviso que después se resume
  // en una línea. En la cola entra el título, que es lo que el resumen muestra.
  const wsPref = opts.alDueno === true ? await wsSuperAdmin().catch(() => ws) : ws;
  const alResumen = puedeEsperar(cat.id, cat.categoria) && (await resumenAvisosActivo(wsPref));
  // ⚠️ AL RESUMEN VA EL CONTEXTO CRUDO, NO LA PLANTILLA DE REFERENCIA. La referencia es la
  // MISMA frase para todos los avisos de ese tipo, así que el renglón del resumen no diría
  // de qué reunión, de qué retro ni de qué objetivo habla — que es la única parte
  // accionable. El contexto es feo (son notas para el modelo) pero es el dato.
  // ⚠️ EL TEXTO SE RESUELVE DENTRO DEL WORKSPACE DEL AVISO, igual que el interruptor.
  // Esta línea corría FUERA de `runWithWorkspace(ws, …)`, así que `referenciaPlantilla`
  // leía el store del contexto AMBIENTE: un cron que itera inquilinos pasando `ws`
  // explícito —así llaman todos— mandaba a cada cliente el texto del DUEÑO, con el
  // interruptor del cliente respetado dos líneas más arriba. Es exactamente el bug que
  // el comentario de arriba documenta para el interruptor, en la otra mitad de la misma
  // función y sin arreglar. Y es también donde se resuelven los datos del CRM, así que
  // el lead tiene que viajar hasta acá.
  const ctxLead = { leadId: opts.lead?.id ?? null, leadNombre: opts.lead?.nombre ?? null };
  const texto = opts.texto ?? await runWithWorkspace(ws, async () => (
    opts.contexto
      ? (alResumen ? opts.contexto! : await generarMensajeAviso(id, opts.contexto!, ctxLead, opts.datos))
      : await referenciaResuelta(id, { ws, ...ctxLead }, opts.datos)
  ));
  return emitirAviso({
    // Cómo lo llamó ESTE negocio. `cat.titulo` es el de fábrica: con él, renombrar un
    // mensaje cambiaba la lista de /mensajes y NO el feed ni el asunto del correo, o sea
    // que el renombre se veía en la pantalla donde se hizo y en ninguna otra.
    tipo: cat.id, titulo: pl?.titulo?.trim() || cat.titulo, asuntoEmail: pl?.asunto, texto,
    categoria: cat.categoria, semaforo: cat.semaforo,
    ws: opts.ws, dedupTtlMin: opts.dedupTtlMin, dedupKey: opts.dedupKey, alDueno: opts.alDueno,
    lead: opts.lead,
  });
}
