// =============================================================================
// flujos — runtime del FLUJO (dispara por evento y ejecuta los pasos)
// =============================================================================
// dispararEvento(evento, ctx) lo llaman los choke points ya cableados (calendly/
// fathom/meta-leads/chatwoot), al lado del emitirDelCatalogo existente. Lee los
// flujos ACTIVOS, matchea el evento + filtro, y ejecuta los pasos EN ORDEN hasta
// el primer 'esperar' (los pasos con espera necesitan el cron drenador — pendiente).
//
// Pasos:
//   · mensaje/aviso_dueno  → lo manda al grupo de MaKo del dueño (IA adapta el texto).
//   · mensaje/wa_lead      → NO SE MANDA (decisión de Martín, 06/10/2026: «C: nada al
//     cliente»). Hasta ese día este comentario decía que iba por la cola de confirmación
//     y que el dueño lo confirmaba con un «sí»: la pendiente se creaba, y al confirmarla
//     `confirmarPendiente` la cerraba como «operación desconocida», porque ninguna
//     operación del registro ejecuta `flujo_wa_lead`. Ver la rama, abajo.
//   · accion               → deja una pendiente `flujo_<acción>` en el grupo. ⚠️ Tiene el
//     mismo problema que tenía wa_lead —ningún área del registro declara esos tipos— y
//     es otra tarjeta: no se tocó acá.
// Best-effort: nunca lanza (no debe romper el webhook).

import 'server-only';
import { listarFlujosActivos } from './plantillas';
import { generarMensajeAviso } from './plantillas';
import { enviarAlGrupoMaKo, getGrupoJidMaKo } from './mako-grupo';
import { crearPendiente } from './mako-pendientes';
import { abrirInsistencia } from './insistencias';
import { OWNER_WS, runWithWorkspace } from './workspace';
import type { EventoFlujo, Paso } from './flujos-tipos';
import { decidir } from './flujo-pasos';
import { abrirCorrida, avanzar, cerrarCorrida } from './flujo-corridas';

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
};

/** Dispara los flujos ACTIVOS que matchean un evento. Best-effort. */
export async function dispararEvento(evento: EventoFlujo, ctx: CtxFlujo = {}): Promise<void> {
  try {
    const ws = ctx.ws ?? OWNER_WS;
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
async function ejecutarPasos(
  flujoId: string, pasos: Paso[], ws: number, ctx: CtxFlujo,
  corrida?: { id: number; paso: number; desdeAt: Date; respondioAt: Date | null },
): Promise<void> {
  let i = corrida?.paso ?? 0;
  let desde = corrida?.desdeAt ?? new Date();
  const respondioAt = corrida?.respondioAt ?? null;
  let corridaId = corrida?.id ?? null;

  for (let vuelta = 0; vuelta < pasos.length + 2; vuelta++) {
    const d = decidir(pasos, { paso: i, desde, respondioAt, ahora: new Date() });

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

    try { await ejecutarPaso(flujoId, d.paso, ws, ctx); }
    catch (e) { console.error(`[flujos] paso de ${flujoId}:`, e instanceof Error ? e.message : String(e)); }

    if (corridaId) {
      const mio = await avanzar(ws, corridaId, i, d.siguiente, null);
      if (!mio) return;
    }
    i = d.siguiente;
    desde = new Date();
  }
  console.error(`[flujos] ${flujoId}: el flujo dio mas vueltas que pasos y se corto`);
  if (corridaId) await cerrarCorrida(ws, corridaId, 'cortada');
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
    const flujos = await runWithWorkspace(ws, () => listarFlujosActivos());
    const vivo = flujos.find((f) => f.id === c.avisoId);
    if (!vivo) { await cerrarCorrida(ws, c.id, 'cortada'); return; }
    await runWithWorkspace(ws, () => ejecutarPasos(c.avisoId, vivo.flujo.pasos, ws, c.ctx, c));
  } catch (e) {
    console.error('[flujos] retomar:', e instanceof Error ? e.message : String(e));
  }
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
      // MaKo adapta el texto (referencia) con el contexto y lo manda al grupo del dueño.
      const contexto = [ctx.leadNombre && `Lead: ${ctx.leadNombre}`, ctx.reunion && `Reunión: ${ctx.reunion}`, ctx.texto].filter(Boolean).join(' · ');
      const texto = await generarMensajeAviso(flujoId, contexto, { leadId: ctx.leadId, leadNombre: ctx.leadNombre }, ctx.datos).catch(() => paso.texto) || paso.texto;
      await enviarAlGrupoMaKo(ws, texto);
      return;
    }
    // ⛔ wa_lead NO SE MANDA, Y LO DICE EN VEZ DE PROMETERLO. Decisión de Martín,
    // 06/10/2026: «C: nada al cliente» — la cobranza (y cualquier flujo de un aviso) le
    // avisa sólo al grupo del dueño. Hasta ese día esta rama dejaba en el grupo una
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
    // Toda acción del flujo va por la cola de confirmación (nunca auto).
    const jid = await getGrupoJidMaKo(ws);
    if (jid) {
      await crearPendiente(ws, {
        grupoJid: jid, tipo: `flujo_${paso.accion}`,
        payload: { flujoId, leadId: ctx.leadId ?? null, ...(paso.params ?? {}) },
        resumen: `Flujo "${flujoId}": ${paso.accion}${ctx.leadNombre ? ` para ${ctx.leadNombre}` : ''}`,
        origen: `flujo:${flujoId}`, ttlMin: 240,
      });
    }
  }
}
