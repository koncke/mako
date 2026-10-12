// =============================================================================
// flujos — runtime del FLUJO (dispara por evento y ejecuta los pasos)
// =============================================================================
// dispararEvento(evento, ctx) lo llaman los choke points ya cableados (calendly/
// fathom/meta-leads), al lado del emitirDelCatalogo existente. Lee los
// flujos ACTIVOS, matchea el evento + filtro, y ejecuta los pasos EN ORDEN hasta
// el primer 'esperar'; lo que sigue lo retoma el cron drenador (app/api/cron/flujo-corridas, cada 5 min).
//
// Pasos:
//   · mensaje/aviso_dueno  → manda SU texto al grupo de MaKo del dueño, con los datos puestos por
//     código (desde el 09/10/2026; antes la IA reescribía la plantilla principal y el texto del
//     paso no salía). Sin texto propio, lo redacta MaKo como antes.
//   · mensaje/wa_lead      → NO SE MANDA (decisión de Martín, 06/10/2026: «C: nada al
//     cliente»). Hasta ese día este comentario decía que iba por la cola de confirmación
//     y que el dueño lo confirmaba con un «sí»: la pendiente se creaba, y al confirmarla
//     `confirmarPendiente` la cerraba como «operación desconocida», porque ninguna
//     operación del registro ejecuta `flujo_wa_lead`. Ver la rama, abajo.
//   · accion               → CORRE cualquier acción de MaKo (`ejecutarDesdeFlujo`), sin pedir
//     un «sí» (decisión de Martín, 08/10/2026). Si falla, una línea al grupo del dueño.
//     Hasta ese día dejaba una pendiente `flujo_<acción>` que ningún área declaraba: moría
//     al confirmarla. Un paso viejo, sin `operacion`, ya no corre ni crea nada.
// Best-effort: nunca lanza (no debe romper el webhook).

import 'server-only';
import { listarFlujosActivos } from './plantillas';
import { generarMensajeAviso } from './plantillas';
import { conVariables } from './variables-resolver';
import { enviarAlGrupoMaKo } from './mako-grupo';
import { abrirInsistencia } from './insistencias';
import { runWithWorkspace, getTenantDb } from './workspace';
import { CATALOGO_AVISOS } from './avisos-catalogo';
import { operacionDelPaso, rotuloOperacion, type EventoFlujo, type Paso } from './flujos-tipos';
import { decidir, lineaDeFalloAccion, reintentoDeHechos, TOPE_REINTENTOS_HECHOS } from './flujo-pasos';
import { abrirCorrida, avanzar, cerrarCorrida } from './flujo-corridas';
import { reclamarEspaciado } from './espaciado';
import { AVISOS_POR_EVENTO, ESTADO_EVENTO, filaDeIdCorrida, pasosParaRetomar, type FilaParaRetomar } from './aviso-evento';
import { CLAVE_MENSAJE_MAKO } from './variables-aviso';
import { textoDePreparadas, type PartePreparada } from './mako-tarjeta';
import type { ParteMensaje } from './mensaje-partes';
import type { HechosLead } from './flujo-grafo';

export type CtxFlujo = {
  ws?: number; leadId?: number; leadNombre?: string; reunion?: 'R1' | 'R2'; texto?: string;
  /** La cuota de la que habla la corrida. Es lo que permite CORTARLA al cobrar. */
  cuotaId?: number;
  /**
   * Valores EXACTOS que el disparador tenía en la mano, por clave del catálogo de
   * variables. Viajan con la corrida porque los pasos siguientes salen DÍAS después:
   * volver a leerlos sería otra lectura, y peor, podría dar otro número que el del
   * mensaje que ya salió.
   */
  datos?: Record<string, string>;
  /**
   * La identidad del EVENTO (la reserva de Cal.com o de Calendly), la misma con la que el
   * webhook ya deduplica su aviso. Con ella, una reentrega no vuelve a correr los pasos del
   * flujo. Hasta el 08/10/2026 se duplicaba una línea al grupo; desde que un paso «⚡ Acción»
   * corre solo, se duplica una escritura o un WhatsApp al lead (medido en el webhook de
   * Cal.com: «salía 2 y 3 veces… 9 s, 25 s, 38 s y 41 s»).
   */
  dedupKey?: string;
  /**
   * SÓLO EN LA CORRIDA DE UN EVENTO DE MAKO (11/10/2026, lib/aviso-evento.ts): el aviso que emite cada tarjeta
   * «MaKo en WhatsApp» (su `tipo`, del que cuelgan el rótulo y el feed) y el nombre de la automatización. Con
   * esto, la tarjeta sale por `emitirAviso` como el aviso de siempre, no como una línea suelta al grupo.
   */
  aviso?: { id: string; titulo: string };
  /**
   * SÓLO EN LA CORRIDA DE UN EVENTO DE MAKO: qué tarjeta es cada paso (`TraduccionEvento.firma`). Una corrida guarda
   * una POSICIÓN; con esto, al despertar se sabe si esa posición sigue siendo la misma tarjeta (`pasosParaRetomar`).
   */
  firma?: string;
  /** Cuántas veces se volvió a preguntar por el lead en una CONDITION que no lo pudo leer (`reintentoDeHechos`). */
  reintentos?: number;
};

/**
 * Dispara los flujos ACTIVOS que matchean un evento. Best-effort.
 *
 * ⚠️⚠️ EL `ws` ES OBLIGATORIO, EN EL TIPO Y EN EL CUERPO (06/10/2026). Hasta ese día esto
 * decía `ctx.ws ?? OWNER_WS`, y OCHO de las ocho llamadas del repo —los webhooks de Calendly
 * (×3), Cal.com (×2), Chatwoot, Meta y Fathom— lo llamaban SIN `ws`, cada una adentro de un
 * `runWithWorkspace(ws)` que daba la sensación de estar cubierta. No lo estaba: esta función
 * no lee el workspace del contexto, resuelve el suyo. Así que el lead de CUALQUIER cliente
 * que agendaba, cancelaba, escribía o dejaba un formulario corría los flujos del ws1 —que es
 * Mauricio, OTRO cliente— en el grupo de MaKo de Mauricio, con el nombre de un lead que no es
 * suyo. Y no era teórico: ws11, ws13 y ws15 tienen ruteados esos webhooks.
 *
 * Lo encontró a medias un arreglo que tapó UNA de las ocho (Fathom): la tarjeta «el bug del
 * chatbot que cruza workspaces» se iba a cerrar con la prueba «la revisión no encontró ningún
 * camino que caiga en el de Mauricio», y quedaban siete. Es la regla de la casa de «arreglar un
 * bug de CONTEXTO: contá cuántas veces esa función pregunta».
 *
 * Por eso son DOS capas y no una:
 *  · la FIRMA: `ctx` lleva `ws` obligatorio y sin default, así que una llamada nueva que lo
 *    olvide no compila. Es la única guarda que cubre la llamada que todavía no existe;
 *  · el CUERPO: si igual llega sin `ws` (un `as any`, un ctx armado de un jsonb), no corre
 *    NADA y lo dice. Un flujo que no corre se nota y se arregla; uno que corre en la cuenta
 *    de otro cliente no se nota nunca. `OWNER_WS` NO es la plataforma: es un cliente.
 *
 * Lo fija tests/flujos-ws-explicito.test.ts, que barre TODAS las llamadas del repo.
 */
export async function dispararEvento(evento: EventoFlujo, ctx: CtxFlujo & { ws: number }): Promise<void> {
  try {
    const ws = ctx?.ws;
    if (typeof ws !== 'number' || !Number.isFinite(ws)) {
      console.error(`[flujos] el evento «${evento}» llegó SIN workspace: no corre ningún flujo. Fail-closed a propósito — antes caía al ws1, que es un cliente.`);
      return;
    }
    // ⚠️ Los flujos se leen DENTRO del workspace del evento, no del request.
    // Antes se leían sueltos y el store estaba clavado al dueño: los flujos de la
    // agencia se ejecutaban dentro del grupo de cada cliente. Hoy el store es por
    // workspace con herencia (lib/plantillas.ts), y esto es lo que la hace valer —
    // sin el runWithWorkspace, un webhook resolvería el ws del request (o ninguno).
    const flujos = await runWithWorkspace(ws, () => listarFlujosActivos());
    for (const { id, flujo } of flujos) {
      const d = flujo.disparador;
      if (d.tipo !== 'evento' || d.evento !== evento) continue;
      if (d.filtro?.reunion && ctx.reunion && d.filtro.reunion !== ctx.reunion) continue;
      // Una reentrega del MISMO evento no corre el flujo otra vez: se reclama antes, con el
      // compare-and-set de lib/espaciado.ts (dos entregas en paralelo, gana una).
      if (ctx.dedupKey && !(await reclamarEspaciado(ws, `flujo:${id}`, 180, ctx.dedupKey))) continue;
      await runWithWorkspace(ws, () => ejecutarPasos(id, flujo.pasos, ws, ctx));
    }
  } catch (e) {
    console.error('[flujos] dispararEvento:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * CORRE EL FLUJO DE UN AVISO, sin pasar por un evento.
 *
 * ⚠️ EXISTE PORQUE UN CRON NO ES UN EVENTO. `dispararEvento` matchea los flujos cuyo
 * `disparador.tipo === 'evento'`, y la cadencia de la cobranza cuelga de un aviso que
 * dispara un CRON: sin esto, el flujo que el dueño edita en el lienzo no lo corría
 * NADIE — el mensaje de entrada salía y los pasos siguientes quedaban dibujados y
 * quietos, que es exactamente el control que se dibuja y no hace nada.
 *
 * No mira el `disparador` del flujo a propósito: quien llama ya sabe que a este aviso
 * le toca. Lo que sí respeta es `activo`, que es el interruptor del flujo.
 */
export async function correrFlujoDe(avisoId: string, ws: number, ctx: CtxFlujo = {}): Promise<boolean> {
  // ⛔ UN EVENTO DE MAKO NO CORRE EL FLUJO DEL STORE (11/10/2026): su cadencia es la de la automatización del
  // negocio, y ya corrió adentro de `emitirDelCatalogo` (lib/aviso-evento.ts). Corriendo también ésta, la
  // cadencia de fábrica de la cobranza saldría ADEMÁS de la fila. Queda para `cuota-por-vencer` (agencia).
  if (AVISOS_POR_EVENTO.has(avisoId)) return false;
  try {
    const flujos = await runWithWorkspace(ws, () => listarFlujosActivos());
    const vivo = flujos.find((f) => f.id === avisoId);
    if (!vivo || !vivo.flujo.pasos.length) return false;
    await runWithWorkspace(ws, () => ejecutarPasos(avisoId, vivo.flujo.pasos, ws, ctx));
    return true;
  } catch (e) {
    console.error(`[flujos] correrFlujoDe ${avisoId}:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * Corre los pasos desde `desde`. Si se topa con una espera que todavia no vencio,
 * DEJA O ACTUALIZA una corrida y vuelve; el drenador la retoma.
 *
 * ⚠️ LA CORRIDA SE ABRE RECIEN AL DORMIRSE, no al arrancar. Un flujo sin `esperar` ni
 * `condicional` corre entero en el webhook y no deja fila: escribir una por cada
 * evento llenaria la tabla de corridas que nacen y mueren en el mismo milisegundo.
 *
 * ⚠️ Y TIENE TOPE DE VUELTAS. Un `condicional` que salta y un `esperar` ya vencido
 * avanzan sin ejecutar nada, asi que un flujo mal armado podria girar: el tope lo
 * corta y lo DICE, en vez de colgar el webhook en silencio.
 */
export async function ejecutarPasos(
  flujoId: string, pasos: Paso[], ws: number, ctx: CtxFlujo,
  corrida?: { id: number; paso: number; desdeAt: Date; respondioAt: Date | null },
): Promise<void> {
  let i = corrida?.paso ?? 0;
  let desde = corrida?.desdeAt ?? new Date();
  const respondioAt = corrida?.respondioAt ?? null;
  let corridaId = corrida?.id ?? null;
  // Los hechos del lead, para la CONDITION de un evento de MaKo: se leen UNA vez, al llegar a la primera (y
  // en cada despertar, que es otra corrida del drenador: la de hoy, no la de hace 48 h).
  let hechos: HechosLead | null | undefined;

  for (let vuelta = 0; vuelta < pasos.length + 2; vuelta++) {
    if (pasos[i]?.tipo === 'condicion' && hechos === undefined) {
      const leidos = await hechosDeLaCorrida(pasos, ws, ctx);
      if (leidos === 'ilegible') {
        // ⚠️ «NO PUDE LEER» NO TERMINA LA CORRIDA (revisión del 11/10/2026): el dedup del evento ya se reclamó, y
        // terminar acá es perder el aviso por toda la ventana (120 días en la cobranza). Se duerme en ESTA misma
        // CONDITION y se vuelve a preguntar, con tope (`reintentoDeHechos`). Sin corrida (la primera vuelta, adentro
        // del emisor) se abre una con el contexto ENTERO (`reintento`: la entrada puede venir después).
        const r = reintentoDeHechos(ctx.reintentos, new Date());
        if (r.que === 'rendirse') {
          console.error(`[flujos] ${flujoId}: no pude leer al lead #${ctx.leadId} en ${TOPE_REINTENTOS_HECHOS} intentos — la corrida se corta sin decidir la condición`);
          if (corridaId) await cerrarCorrida(ws, corridaId, 'cortada');
          return;
        }
        const ctxR: CtxFlujo = { ...ctx, reintentos: r.reintentos };
        if (corridaId) await avanzar(ws, corridaId, i, i, r.hasta, ctxR);
        else await abrirCorrida(ws, flujoId, i, r.hasta, ctxR, { reintento: true });
        return;
      }
      hechos = leidos;
    }
    const d = decidir(pasos, { paso: i, desde, respondioAt, ahora: new Date(), hechos: hechos ?? null });

    if (d.que === 'terminar') {
      if (corridaId) await cerrarCorrida(ws, corridaId, 'hecha');
      return;
    }

    if (d.que === 'esperar') {
      if (corridaId) {
        // No avanza el paso: sigue siendo el `esperar`. Lo que cambia es cuando
        // despertar y el `desde_at`, que es contra lo que se mide la espera.
        await avanzar(ws, corridaId, i, i, d.hasta);
      } else {
        corridaId = await abrirCorrida(ws, flujoId, i, d.hasta, ctx);
      }
      return;
    }

    if (d.que === 'saltar') {
      if (corridaId) {
        // ⚠️ Si otro se llevo la corrida (compare-and-set), NO se sigue: ejecutar
        // igual es mandar el mismo paso dos veces.
        const mio = await avanzar(ws, corridaId, i, d.siguiente, null);
        if (!mio) return;
      }
      i = d.siguiente;
      desde = new Date();
      continue;
    }

    // ⚠️ CON CORRIDA, EL PASO SE RECLAMA ANTES DE EJECUTARLO. Al revés, una función cortada entre
    // ejecutar y avanzar (o dos ticks del drenador que se pisan) dejaba la fila en el mismo paso
    // y el tick siguiente lo volvía a correr: dos tareas, o dos WhatsApps al lead. El costo es el
    // opuesto y es el correcto: si el paso falla, no se reintenta.
    if (corridaId) {
      const mio = await avanzar(ws, corridaId, i, d.siguiente, null);
      if (!mio) return;
    }
    try { await ejecutarPaso(flujoId, d.paso, ws, ctx); }
    catch (e) { console.error(`[flujos] paso de ${flujoId}:`, e instanceof Error ? e.message : String(e)); }
    i = d.siguiente;
    desde = new Date();
  }
  console.error(`[flujos] ${flujoId}: el flujo dio mas vueltas que pasos y se corto`);
  if (corridaId) await cerrarCorrida(ws, corridaId, 'cortada');
}

/**
 * LOS HECHOS DEL LEAD DE LA CORRIDA (11/10/2026), con las fuentes que piden sus condiciones: la MISMA lectura
 * que el motor de las automatizaciones (`hechosDeUnLead`, lib/nutricion.ts). Sin lead (o un lead que ya no está),
 * null: lo que no se sabe NUNCA se cumple, y la corrida termina en esa CONDITION.
 *
 * ⚠️ UN ERROR NO ES null: es `'ilegible'` (revisión del 11/10/2026). Hasta ese día el `catch` devolvía null, y un bache
 * de la base terminaba la corrida como «hecha» con el dedup del evento ya reclamado. «No pude leer» es un tercer
 * estado (AGENTS.md), y quien llama lo reintenta (`reintentoDeHechos`).
 */
async function hechosDeLaCorrida(pasos: Paso[], ws: number, ctx: CtxFlujo): Promise<HechosLead | null | 'ilegible'> {
  if (!ctx.leadId) return null;
  try {
    const filas = pasos.flatMap((p) => (p.tipo === 'condicion' ? p.rama.filas ?? [] : []));
    const { hechosDeUnLead } = await import('./nutricion');
    return await hechosDeUnLead(ws, ctx.leadId, filas);
  } catch (e) {
    console.error(`[flujos] los hechos del lead #${ctx.leadId}:`, e instanceof Error ? e.message : String(e));
    return 'ilegible';
  }
}

/**
 * Retoma una corrida dormida. La llama el cron drenador.
 *
 * ⚠️ RELEE EL FLUJO. Entre que se durmio y ahora, el dueno pudo editarlo o apagar el
 * mensaje: seguir con los pasos que habia al arrancar manda lo que ya no esta escrito.
 * Si el flujo desaparecio o se apago, la corrida se CORTA — y se distingue de `hecha`
 * a proposito, porque «termino» y «la cortamos» son dos hechos.
 */
export async function retomarCorrida(
  ws: number, c: { id: number; avisoId: string; paso: number; desdeAt: Date; respondioAt: Date | null; ctx: CtxFlujo },
): Promise<void> {
  try {
    // UNA FILA DE EVENTO (`sec:<id>`, 11/10/2026): se relee la AUTOMATIZACIÓN, no el store. Archivada, pausada
    // o sin una forma que el emisor sepa correr → se corta, como hoy un flujo apagado. Si no, sigue con sus
    // pasos de AHORA (lo publicado después de dormirse es lo que el negocio quiere que salga)…
    // ⚠️ …SÓLO SI SIGUE SIENDO LA MISMA FORMA (revisión del 11/10/2026): `c.paso` es una POSICIÓN, y con una tarjeta
    // sumada, sacada o movida apunta a otra (la entrada de la cobranza salía de nuevo). Lo decide `pasosParaRetomar`.
    const filaId = filaDeIdCorrida(c.avisoId);
    if (filaId != null) {
      const r = pasosParaRetomar(await runWithWorkspace(ws, () => filaParaRetomar(filaId)), c.ctx.firma);
      if ('corta' in r) {
        if (r.corta !== 'apagada') console.warn(`[flujos] corrida ${c.id} (${c.avisoId}): se corta — ${r.corta === 'cambio' ? 'la automatización cambió de forma mientras dormía' : 'la automatización ya no se puede correr'}`);
        await cerrarCorrida(ws, c.id, 'cortada');
        return;
      }
      await runWithWorkspace(ws, () => ejecutarPasos(c.avisoId, r.pasos, ws, c.ctx, c));
      return;
    }
    const flujos = await runWithWorkspace(ws, () => listarFlujosActivos());
    const vivo = flujos.find((f) => f.id === c.avisoId);
    if (!vivo) { await cerrarCorrida(ws, c.id, 'cortada'); return; }
    await runWithWorkspace(ws, () => ejecutarPasos(c.avisoId, vivo.flujo.pasos, ws, c.ctx, c));
  } catch (e) {
    console.error('[flujos] retomar:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * La fila de evento de una corrida dormida, como la mira `pasosParaRetomar` (lib/aviso-evento.ts, pura: ahí se decide
 * si sigue); null = ya no está. Corre adentro del workspace de la corrida. Un error de lectura TIRA: el drenador la
 * vuelve a mirar en el próximo tick, en vez de cortar una cadencia por un bache de la base.
 */
async function filaParaRetomar(filaId: number): Promise<FilaParaRetomar | null> {
  const { data, error } = await (await getTenantDb()).from('nutricion_secuencias')
    .select('id, activa, archivada_at, pasos, trigger_tipo, disparadores').eq('id', filaId).maybeSingle();
  if (error) throw new Error(`la automatización #${filaId}: ${error.message}`);
  return (data as FilaParaRetomar | null) ?? null;
}

async function ejecutarPaso(flujoId: string, paso: Paso, ws: number, ctx: CtxFlujo): Promise<void> {
  // INSISTIR: el mensaje sale AHORA y además queda una insistencia abierta. Vuelve
  // cada `cadaMin` hasta `veces`, o hasta que alguien escriba «ok» en el grupo.
  // El techo (5 veces, 30 min) lo recorta `sanearInsistir` adentro de abrirInsistencia:
  // acá no se valida nada a mano, para que haya UN solo lugar donde vive el tope.
  if (paso.tipo === 'insistir') {
    const contexto = [ctx.leadNombre && `Lead: ${ctx.leadNombre}`, ctx.reunion && `Reunión: ${ctx.reunion}`, ctx.texto].filter(Boolean).join(' · ');
    // El lead viaja al generador: es lo que resuelve los datos del CRM del catálogo.
    const texto = await generarMensajeAviso(flujoId, contexto, { leadId: ctx.leadId, leadNombre: ctx.leadNombre }).catch(() => paso.texto) || paso.texto;
    await enviarAlGrupoMaKo(ws, texto);
    // El texto que vuelve es el MISMO que salió, no uno nuevo generado cada vez: si
    // cada repetición se redactara distinta, el dueño leería cuatro avisos que parecen
    // cuatro hechos. Es el mismo hecho insistiendo.
    await abrirInsistencia(ws, { flujoId, leadId: ctx.leadId ?? null, texto, cadaMin: paso.cadaMin, veces: paso.veces });
    return;
  }
  if (paso.tipo === 'mensaje') {
    if (paso.canal === 'aviso_dueno') {
      // ⚠️ SALE EL TEXTO DEL PASO, con los datos puestos por CÓDIGO (sexta tanda, General 15: «hay
      // plantillas que quedaron viejas… que no tienen sentido»). Hasta el 09/10/2026 esta rama le
      // pedía a la IA que reescribiera la plantilla PRINCIPAL del aviso (`generarMensajeAviso` lee
      // `referenciaPlantilla(flujoId)`, no el paso), así que el texto del paso salía sólo si la IA
      // tiraba —y no tira: se traga su error—. En la cadencia de fábrica de la cobranza eso era
      // mandar dos veces más el MISMO aviso, con `{{cuota_dias}}` crudo (la corrida lleva sólo los
      // datos estables), en vez de «Sigue sin cobrarse…» y «Último recordatorio…», que es lo que se
      // dibuja en el lienzo. Y sin IA, a propósito: es el mismo camino que el mensaje de entrada de
      // ese aviso (`referenciaResuelta`), y un monto que pasa por un modelo deja de ser exacto.
      // Medido en producción ese día: cero corridas (`flujo_corridas` vacía), así que no le cambia un
      // mensaje a nadie. Un paso SIN texto sigue como antes (lo redacta MaKo con el contexto).
      const propio = (paso.texto ?? '').trim();
      // La tarjeta «MaKo en WhatsApp» de un EVENTO DE MAKO sale como el aviso de siempre (ver la función), y con su
      // lista (undécima tanda), por partes y tal cual.
      if (ctx.aviso) { await emitirTarjetaDelEvento(flujoId, { texto: propio, partes: paso.partes }, ws, ctx, ctx.aviso); return; }
      const contexto = [ctx.leadNombre && `Lead: ${ctx.leadNombre}`, ctx.reunion && `Reunión: ${ctx.reunion}`, ctx.texto].filter(Boolean).join(' · ');
      // `conVariables` pone los datos con LA regla de todo envío (`textoConDatos`, undécima tanda): el renglón que nombra
      // un dato sin valor se va entero; lo que no es del catálogo queda crudo (y Publicar ya no lo deja pasar).
      const texto = propio
        ? await conVariables(propio, { ws, leadId: ctx.leadId ?? null, leadNombre: ctx.leadNombre ?? null }, ctx.datos).catch(() => propio)
        : await generarMensajeAviso(flujoId, contexto, { leadId: ctx.leadId, leadNombre: ctx.leadNombre }, ctx.datos).catch(() => '');
      if (!texto.trim()) return;
      await enviarAlGrupoMaKo(ws, texto);
      return;
    }
    // ⛔ wa_lead NO SE MANDA, Y LO DICE EN VEZ DE PROMETERLO. Decisión de Martín,
    // 06/10/2026: «C: nada al cliente» — este paso no le escribe al lead. (Desde el 08/10 un
    // paso «⚡ Acción» SÍ puede, si el dueño eligió una acción que manda: «que pueda hacer todo,
    // sin limitaciones». Este paso viejo sigue sin mandar.) Hasta el 06/10 esta rama dejaba en el grupo una
    // pendiente «Mandarle un WhatsApp a …» que ninguna operación del registro sabía
    // ejecutar: el dueño contestaba «sí» y `confirmarPendiente` la cerraba como
    // «operación desconocida». Una pendiente que pide permiso para algo que no va a
    // pasar es peor que ninguna.
    //
    // Medido el 06/10/2026: ningún store de plantillas tiene un paso así y el lienzo no
    // ofrece crearlo (app/agencia/FlujoAviso.tsx). Sólo puede llegar en un flujo armado a
    // mano por la API, y para ése queda la línea del log.
    console.warn(`[flujos] ${flujoId}: el paso «mensaje al lead» no se manda (decisión del 06/10/2026: nada al cliente)${ctx.leadId ? ` · lead #${ctx.leadId}` : ''}`);
    return;
  }
  if (paso.tipo === 'accion') {
    // ⚡ LA ACCIÓN CORRE, SIN PEDIR UN «SÍ». Decisión de Martín (08/10/2026), textual: un
    // paso de un flujo «que pueda hacer todo, sin limitaciones». El dueño la confirmó al
    // CONFIGURAR el paso; acá se ejecuta. Hasta ese día esta rama dejaba una pendiente
    // `flujo_<acción>` con tres valores fijos que ningún área del registro declaraba: al
    // confirmarla, `confirmarPendiente` la cerraba como «operación desconocida». Medido el
    // 08/10: 1 paso así en toda la base (ws1, `crear_tarea`) y 0 corridas.
    //
    // ⚠️ NO HAY UN SEGUNDO CAMINO DE ESCRITURA: `ejecutarDesdeFlujo` propone por el choke
    // point del registro (validador, gating de la capa, `preparar()`) y confirma en el acto,
    // dejando la fila con este aviso como origen. Nunca lanza.
    const operacion = operacionDelPaso(paso);
    if (!operacion) {
      // Un paso VIEJO (sólo `accion`) o uno al que nunca se le eligió acción. No corre: sus
      // tres valores no son ids del registro, y adivinarles uno haría correr algo que nadie
      // eligió. Queda en el log para que se vea que el paso existe y no hizo nada.
      console.warn(`[flujos] ${flujoId}: paso «⚡ Acción» sin acción elegida${paso.accion ? ` (viejo: «${paso.accion}»)` : ''} — no corre`);
      return;
    }
    // Import dinámico a propósito: este módulo lo cargan los cinco webhooks, y el registro
    // de la API (≈500 operaciones) sólo hace falta cuando un flujo llega a este paso.
    const [{ ejecutarDesdeFlujo }, { porId }] = await Promise.all([import('./api-mako/flujo'), import('./api-mako/registro')]);
    const nombre = nombreDelAviso(flujoId);
    const def = porId(operacion);
    const { faltanEnPaso } = await import('./api-mako/flujo-params');
    const faltan = def ? faltanEnPaso(def.parametros, paso.params, { leadId: ctx.leadId ?? null }) : [];
    if (faltan.length) {
      // Un paso a medio configurar ya está vivo (elegir la acción se guarda en el acto): sin esto,
      // cada evento le mandaba al dueño «no se pudo» mientras todavía llenaba el formulario.
      console.warn(`[flujos] ${flujoId}: «${operacion}» sin ${faltan.join(', ')} — no corre`);
      return;
    }
    const r = await ejecutarDesdeFlujo(operacion, paso.params, { ws, origen: `aviso:${flujoId}`, nombre, leadId: ctx.leadId ?? null });
    if (r.ok) {
      console.log(`[flujos] ${flujoId}: «${operacion}» → ${r.resumen}`);
      return;
    }
    // Falló: el dueño se entera en SU grupo, en una línea. Un paso que corre solo y falla
    // callado se lee como una automatización que hizo su trabajo.
    console.warn(`[flujos] ${flujoId}: «${operacion}» no se pudo — ${r.resumen}`);
    // Espaciada: con «cuando un lead escribe», 40 mensajes eran 40 líneas iguales en el grupo.
    if (await reclamarEspaciado(ws, `flujo-fallo:${flujoId}`, 60, operacion)) {
      await enviarAlGrupoMaKo(ws, lineaDeFalloAccion(def?.titulo ?? rotuloOperacion(operacion), nombre, r.resumen));
    }
  }
}

/**
 * El nombre humano de un aviso, sin ir a la base: el del catálogo, o el id. Es lo que
 * firma la fila que deja la acción («MaKo · automatización «nombre»») y lo que dice la
 * línea de fallo. Un aviso propio del negocio (o renombrado) cae al id: leer su título
 * sería otra ida al store por cada paso, y el id ya identifica cuál fue.
 * (Va pegado a `ejecutarPaso`, antes de la tarjeta de un evento: tests/flujo-aviso-accion.test.ts mide la rama de la
 * acción hasta acá.)
 */
function nombreDelAviso(flujoId: string): string {
  return CATALOGO_AVISOS.find((c) => c.id === flujoId)?.titulo ?? flujoId;
}

/**
 * ⚠️ LA TARJETA «MaKo en WhatsApp» DE UN EVENTO DE MAKO (11/10/2026, lib/aviso-evento.ts) SALE POR
 * `emitirAviso`, como el aviso de siempre: su `tipo` es el id del aviso (el rótulo, el feed y el turno del doer,
 * igual que hoy), sin dedup propio (lo reclamó el emisor UNA vez por evento, y la segunda fila del mismo evento
 * no la frena la primera) y con `ESTADO_EVENTO` (no lee el store ni abre una insistencia). `{{mensaje_mako}}` es
 * el texto que armó el código del aviso: con él, sale EXACTAMENTE lo de siempre. Por `enviarAlGrupoMaKo` sería
 * una línea suelta, sin rótulo y sin que el doer sepa a qué le contestan.
 *
 * ⚠️ CON SU LISTA (undécima tanda, decisión 2 de la décima: `partes`, lib/aviso-evento.ts `pasosDelEvento`) la
 * tarjeta sale TAL CUAL y POR PARTES, como desde un flujo (`armarAvisoDeTarjeta`, lib/mako-tarjeta.ts): sin el
 * rótulo de barras (`rotulo: false`), con los textos resueltos con los MISMOS datos de arriba y TODOS los binarios
 * bajados antes de mandar nada (`prepararPartesGrupo`): si falta la nota de voz o el archivo no sale una tarjeta a
 * medias. Y como en el registro (`problemaDePartesGrupo`), un audio que no es la Voz de MaKo no sale: sería la voz
 * del dueño en el grupo, suplantándolo. Sin lista, el texto de siempre.
 */
async function emitirTarjetaDelEvento(
  flujoId: string, tarjeta: { texto: string; partes?: ParteMensaje[] }, ws: number, ctx: CtxFlujo, aviso: { id: string; titulo: string },
): Promise<void> {
  // ⚠️ `{{mensaje_mako}}` SE SIGUE INYECTANDO hasta la limpieza (docs/diseno-undecima-tanda.md §8.7): #239 y #240 lo usan
  // hasta que el script de flujos las archive. Ya no se ofrece ni se publica (`problemasDeTokens`, lib/tokens-del-flujo.ts).
  // Los datos van con el renglón opcional (`conVariables` → `textoConDatos`): «📱 {{lead_telefono}}» sin teléfono no sale.
  const datos = { ...(ctx.datos ?? {}), ...(ctx.texto ? { [CLAVE_MENSAJE_MAKO]: ctx.texto } : {}) };
  const resolver = (t: string) => conVariables(t, { ws, leadId: ctx.leadId ?? null, leadNombre: ctx.leadNombre ?? null }, datos).catch(() => t);
  let partes: PartePreparada[] | null = null;
  let texto: string;
  if (tarjeta.partes?.length) {
    const { prepararPartesGrupo, problemaDePartesGrupo } = await import('./mako-tarjeta-envio');
    const ajena = await problemaDePartesGrupo(tarjeta.partes);
    if (ajena) { console.error(`[flujos] ${flujoId}: el aviso «${aviso.id}» no salió — ${ajena}`); return; }
    const p = await prepararPartesGrupo(tarjeta.partes, resolver);
    if (!p.ok) { console.error(`[flujos] ${flujoId}: el aviso «${aviso.id}» no salió — ${p.error}`); return; }
    partes = p.partes;
    texto = textoDePreparadas(partes);
  } else {
    if (!tarjeta.texto) return;
    texto = await resolver(tarjeta.texto);
    if (!texto.trim()) return;
  }
  const cat = CATALOGO_AVISOS.find((c) => c.id === aviso.id);
  const { emitirAviso } = await import('./avisos');
  const r = await emitirAviso({
    tipo: aviso.id, titulo: aviso.titulo, texto,
    categoria: cat?.categoria, semaforo: cat?.semaforo, ws,
    ...(ctx.leadId ? { lead: { id: ctx.leadId, nombre: ctx.leadNombre ?? null } } : {}),
    estado: ESTADO_EVENTO,
    ...(partes ? { partes, rotulo: false as const } : {}),
  });
  if (!r.ok) console.error(`[flujos] ${flujoId}: el aviso «${aviso.id}» no salió`);
  else if (partes && !r.wa && r.waError) console.error(`[flujos] ${flujoId}: el aviso «${aviso.id}» no salió al grupo — ${r.waError}`);
}
