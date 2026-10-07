import 'server-only';

// =============================================================================
// curso-avance — el paso AUTOMÁTICO de etapa cuando el cliente termina sus tareas
// =============================================================================
// Pedido de Martín (06/10/2026), textual: «la automatización de pasar de etapas a los clientes
// de Mauricio según las tareas que vayan completando… Si se completa X cosa y ahí ya termina la
// etapa, debería ir a la próxima etapa. Y si esa próxima etapa tiene un tutorial con sus
// tareas, se debería enviarle un mensaje».
//
// La regla (pura, con test) vive en lib/curso.ts: `etapaCompleta` = el cliente ENVIÓ todas las
// tareas obligatorias de la etapa. Acá se aplica, y el movimiento pasa por el choke point de
// la entrega (`moverClienteDeEtapa`, lib/cs-mover-etapa.ts) con `por: POR_MAKO`: el historial,
// las secuencias de entrega y lo que venga mañana lo heredan sin que nadie se acuerde.
//
// ⚠️ SÓLO MUEVE SI LA TAREA ES DE LA ETAPA EN LA QUE ESTÁ. Un cliente que completa una tarea de
// una etapa ya pasada (o adelanta una futura) no se mueve: «terminó la etapa» habla de la etapa
// en la que está, y moverlo desde otra lo haría saltar columnas.
//
// ⚠️ NUNCA TIRA. Lo llama la ruta que guarda la tarea, DESPUÉS de guardarla: si el paso de etapa
// falla, la tarea del cliente ya está guardada y eso es lo que importa. El motivo vuelve en
// el resultado y queda en el log.
//
// La DECISIÓN (en qué orden se pregunta qué) es pura y vive en lib/curso-avance-regla.ts, con
// test que la ejecuta. Acá sólo se lee lo que la decisión necesita y se aplica lo que contesta.
//
// ⚠️ DOS ENVÍOS A LA VEZ AVISAN UNA SOLA VEZ, y lo garantiza el choke point, no este archivo.
// Si el cliente manda las dos últimas tareas de la etapa en el mismo segundo (dos pestañas),
// las dos lecturas ven la etapa completa y las dos llaman a `moverClienteDeEtapa`. Hasta el
// 06/10/2026 las dos podían contestar `cambio: true` (dos mensajes de la etapa nueva y dos
// líneas de historial); desde ese día el choke point escribe con compare-and-set sobre la
// etapa que leyó, y la que pierde vuelve con `cambio: false` — que acá abajo corta antes del
// WhatsApp. Lo fija tests/cs-mover-etapa.test.ts.

import { claseDeId, clasesDelProducto, progresoDelCliente, etapaActualDe } from './curso-datos';
import { entregaDeProducto } from './entrega-servicio';
import { moverClienteDeEtapa, POR_MAKO } from './cs-mover-etapa';
import { decidirAvance } from './curso-avance-regla';
import { avisarEntradaAEtapa } from './curso-mensajes';
import { getWorkspaceActual, runWithWorkspace } from './workspace';
import { after } from 'next/server';

export type ResultadoAvance = {
  /** De verdad cambió de etapa. */
  movido: boolean;
  desde?: string | null;
  hacia?: string | null;
  /** Se le mandó el mensaje de la etapa nueva. */
  avisado?: boolean;
  /** Por qué no se movió (o no se avisó). Para el log y para la respuesta de la ruta. */
  motivo?: string;
};

/**
 * Después de que el cliente ENVIÓ una tarea: si con eso completó la etapa en la que está, lo
 * pasa a la siguiente y, si la siguiente tiene clases, le manda el mensaje con su link.
 *
 * ⚠️ Corre adentro del workspace del cliente (`runWithWorkspace(acceso.ws, …)` en la ruta).
 */
export async function alEnviarTarea(p: { leadId: number; claseId: number }): Promise<ResultadoAvance> {
  try {
    const clase = await claseDeId(p.claseId);
    if (!clase) return { movido: false, motivo: 'la clase no existe' };

    // Las cuatro lecturas son independientes. `progresoDelCliente` ya trae la tarea que la ruta
    // acaba de guardar: quien llama lo hace DESPUÉS de `guardarTarea`.
    const [etapaActual, clases, progreso, entrega] = await Promise.all([
      etapaActualDe(p.leadId, clase.productoId),
      clasesDelProducto(clase.productoId),
      progresoDelCliente(p.leadId),
      entregaDeProducto(clase.productoId),
    ]);

    const d = decidirAvance({
      etapaDeLaClase: clase.etapa,
      etapaActual,
      etapas: entrega.etapas.map((e) => e.key),
      clases,
      estadoDe: (id) => progreso.get(id)?.estado,
    });
    if (!d.mover) return { movido: false, desde: d.desde, motivo: d.motivo };

    // El choke point de la entrega: deja el historial con autor «MaKo», dispara las secuencias de
    // entrega de la etapa nueva y cierra las de la anterior. Es idempotente: si ya estaba ahí,
    // `cambio: false` y no se escribe nada.
    const mov = await moverClienteDeEtapa({ leadId: p.leadId, productoId: clase.productoId, etapa: d.hacia, por: POR_MAKO });
    if (!mov.ok) {
      console.error(`[curso-avance] el lead ${p.leadId} completó «${d.desde}» y no pude moverlo a «${d.hacia}»: ${mov.motivo}`);
      return { movido: false, desde: d.desde, hacia: d.hacia, motivo: mov.motivo ?? 'no pude moverlo de etapa' };
    }
    // Ya estaba en la siguiente (otro envío lo movió un instante antes): no se avisa dos veces.
    if (!mov.cambio) return { movido: false, desde: d.desde, hacia: d.hacia, motivo: 'ya estaba en esa etapa' };

    // «Si esa próxima etapa tiene un tutorial con sus tareas, se debería enviarle un mensaje»: una
    // etapa sin clases cargadas no tiene nada que mostrarle, y un «ya tienes abierta X: 0 clases»
    // es un mensaje que sobra.
    //
    // ⚠️ ESTE MENSAJE NO MIRA LAS SECUENCIAS, Y UNA SECUENCIA EN ESA ETAPA SE LE SUMA. El
    // `moverClienteDeEtapa` de arriba dispara el evento de entrega (`enrolarPorEvento`), así que
    // una secuencia `entrega_actual` colgada de una etapa CON clases le manda su paso además de
    // éste: al cliente le llegan dos. Una secuencia de entrega va en las etapas sin clases, o
    // reemplaza a este mensaje — eso es una decisión, no se resuelve acá
    // (docs/hallazgos-customer-success.md).
    if (!d.clasesEnHacia) return { movido: true, desde: d.desde, hacia: d.hacia, avisado: false, motivo: 'la etapa nueva no tiene clases' };

    // ⚠️ EL WHATSAPP VA POR DETRÁS (`after`): Evolution retiene el HTTP 7-10 s, y esto corre
    // adentro del POST de la tarea — el alumno se quedaba con el «Enviar» girando antes de ver
    // «¡Etapa completada!». `after` corre FUERA del contexto del workspace, así que se captura
    // `ws` y se vuelve a entrar (el molde es lib/landing-analyst-auto.ts). Fuera de un request
    // —un script— `after` tira, y se manda en línea.
    const leadId = p.leadId, productoId = clase.productoId, hacia = d.hacia;
    const avisar = async (): Promise<boolean> => {
      const env = await avisarEntradaAEtapa({ leadId, productoId, etapa: hacia });
      if (!env.ok) console.warn(`[curso-avance] el lead ${leadId} pasó a «${hacia}» y el mensaje no salió: ${env.motivo}`);
      return env.ok;
    };
    const ws = await getWorkspaceActual();
    if (ws != null) {
      try {
        after(() => runWithWorkspace(ws, avisar));
        return { movido: true, desde: d.desde, hacia, motivo: 'aviso en camino' };
      } catch { /* sin request: se manda en línea */ }
    }
    const ok = await avisar();
    return { movido: true, desde: d.desde, hacia, avisado: ok, motivo: ok ? undefined : 'el mensaje no salió' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[curso-avance] lead ${p.leadId}, clase ${p.claseId}: el paso de etapa falló (la tarea ya estaba guardada):`, msg);
    return { movido: false, motivo: `error: ${msg}` };
  }
}
