// =============================================================================
// clonar-disparadores — los CRON de una automatización del dueño, listos para OTRO workspace (puro)
// =============================================================================
// Lo usa lib/clonar-config.ts (`secuenciaParaElDestino`). Hermano de lib/clonar-pasos.ts y por lo
// mismo: PURO y sin `server-only` a propósito, para que la regla se EJECUTE en un test
// (tests/clonar-disparadores.test.ts) y no sólo se lea en el fuente.
//
// EL PENDIENTE DECÍA «SUMAR `disparadores` A `cols`», Y ESA LÍNEA SOLA ERA UN BUG NUEVO, del mismo
// tipo que el que `traducirEtiquetasEnSecuencia` vino a arreglar: cada `Disparador`
// (lib/disparadores.ts) lleva ids del workspace del DUEÑO, que en el destino son OTRA cosa o nada.
//
//   · `etiqueta_id` (la etiqueta del CRON) y `ignorar` (las que NO disparan, CRON punto 3) se
//     traducen con el MISMO mapa por nombre que los pasos y que la columna (`ctx.etiquetas`,
//     `mapaDeEtiquetas`). Lo que no se traduce se SACA, nunca se deja con el id del dueño: un
//     `ignorar` con el id de él hace que el CRON del destino ignore a una etiqueta CUALQUIERA, que es
//     peor que no ignorar ninguna.
//   · `funnel_id` y `producto_id` (el ámbito) no viajan, y con ellos se va la ETAPA. Es el criterio de
//     la fila de `crm_etiquetas` (`funnel_id: null`, y la etapa sólo si venía sin embudo): los
//     `productos` se clonan por NOMBRE y no hay ningún mapa de ids, y de los embudos se clona sólo la
//     FORMA del default — una etapa de OTRO embudo o del kanban de ESE producto no significa nada acá.
//     ⚠️ NULEAR EL ÁMBITO Y DEJAR LA ETAPA HABRÍA SIDO PEOR QUE COPIAR EL ID: en `leadsDeCohorte` un
//     `producto_id` NULL es «la entrega de CUALQUIER producto», o sea MÁS gente que la del dueño. Sin
//     etapas la cohorte es vacía (`if (!keys.length) return []`), que es lo que corresponde: el CRON
//     llega visible y sin elegir, no apuntando a otra cosa.
//   · `cron_proxima_at` (la próxima ocurrencia) no viaja: es un instante de la grilla y del huso del
//     DUEÑO, y copiado el destino dispararía en el horario de él. En null el motor no dispara:
//     SIEMBRA (`decidirAgenda`, lib/nutricion-agenda.ts — «sembrar no es disparar»), así que la
//     primera corrida del destino no manda nada y la grilla arranca ahí.
//   · `disparadores_rev` no es configuración: es el compare-and-set de la lista (mig 0241). No se
//     copia —no está en `cols`— y su default 0 es el correcto.
//   · `cron`, `subtipo`, `palabras`, `publicacion` y `grupo` SÍ viajan: no llevan ningún id del dueño.
//     `grupo` es «el grupo de MaKo DEL NEGOCIO», que `mandarRecurrenteAlGrupo` resuelve con el
//     workspace del contexto (sin contexto no manda nada), nunca con el del dueño. Y `cron.tz` viaja
//     con su horario, al revés que el setting de zona horaria que la cabecera de clonar-config no
//     copia: ausente —el caso normal— el horario resuelve a la zona del DESTINO solo, y cuando está
//     es una zona que alguien eligió A MANO para esos mensajes (`sanearCron`), no la del workspace.
//
// ⚠️ Y LA COLUMNA `cron` TIENE QUE VIAJAR CON LA LISTA. La verdad del PRIMER CRON son las COLUMNAS
// (mig 0241, `disparadoresDe`): con la lista copiada y `cron` no, el d1 de un Recurrente llegaba sin
// su horario mientras el d2 llegaba con el suyo, y sin `cron` `decidirAgenda` devuelve `toca: true`
// en CADA corrida — un «todos los lunes a las 9» al grupo de MaKo pasaba a salir cada hora. Con
// `activa: false` no sale hasta que alguien lo prende, pero prenderlo no puede significar eso.
// =============================================================================

import { disparadoresDe, sanearDisparadores, type Disparador, type FilaDisparadores } from './disparadores';
import { etapasDe } from './nutricion-etapa';

export type DisparadoresParaElDestino = {
  /** La lista entera, saneada y sin nada del dueño (array NUEVO; la fila de entrada no se toca). */
  disparadores: Disparador[];
  /** Cuántas etiquetas (la del CRON y las de «Ignorar») no tienen una igual en el destino. */
  etiquetas: number;
  /** Cuántos CRON quedaron sin su embudo o su producto (y por eso sin etapa). */
  ambitos: number;
  /** Cuántos horarios vuelven a arrancar su grilla en el destino. */
  horarios: number;
};

/**
 * LOS CRON DE UNA AUTOMATIZACIÓN DEL DUEÑO, LISTOS PARA OTRO WORKSPACE. `traducir` es el mapa por
 * nombre de las etiquetas ya copiadas (`mapaDeEtiquetas`); devuelve null cuando el destino no tiene
 * una igual. Ver la cabecera: cada campo, y por qué.
 */
export function disparadoresParaElDestino(row: FilaDisparadores, traducir: (id: number) => number | null): DisparadoresParaElDestino {
  let etiquetas = 0;
  let ambitos = 0;
  let horarios = 0;
  const lista = disparadoresDe(row).map((d) => {
    const o: Disparador = { ...d };
    if (o.etiqueta_id != null) {
      const nuevo = traducir(o.etiqueta_id);
      if (nuevo == null) etiquetas += 1;
      o.etiqueta_id = nuevo;
    }
    if (o.ignorar?.length) {
      const traducidas = o.ignorar.map((id) => traducir(id));
      etiquetas += traducidas.filter((n) => n == null).length;
      o.ignorar = traducidas.filter((n): n is number => n != null);
    }
    // `higiene` ya dejó sólo el ámbito del tipo del CRON, así que esto no pisa el de otro.
    if (o.funnel_id != null || o.producto_id != null) {
      ambitos += 1;
      o.funnel_id = null;
      o.producto_id = null;
      o.etapa = null;
      o.etapas = null;
    }
    if (o.cron) horarios += 1;
    o.cron_proxima_at = null;
    return o;
  });
  return { disparadores: sanearDisparadores(lista), etiquetas, ambitos, horarios };
}

/**
 * LAS COLUMNAS DEL PRIMER CRON, que son su VERDAD y no la lista (mig 0241, `disparadoresDe`): lo que
 * acá no se escriba, el destino lo lee de la columna copiada tal cual, con el ámbito o la ocurrencia
 * del dueño adentro.
 *
 * ⚠️ `etapa` es NOT NULL con default 'nutri' (mig 0034): un CRON que quedó sin etapa va con la cadena
 * VACÍA, no omitida — omitirla le inventaría la etapa 'nutri', que es un dato que nadie eligió.
 * `etapasDe` con '' devuelve [] y la cohorte queda vacía, que es lo correcto.
 */
export function columnasParaElDestino(d: Disparador): Record<string, unknown> {
  const etapas = etapasDe({ etapa: d.etapa ?? null, etapas: d.etapas ?? null });
  return {
    trigger_tipo: d.trigger_tipo,
    etapa: etapas[0] ?? '',
    etapas: etapas.length > 1 ? etapas : null,
    funnel_id: null,
    producto_id: null,
    cron: d.cron ?? null,
    cron_proxima_at: null,
  };
}
