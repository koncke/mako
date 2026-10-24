// =============================================================================
// etapas-crm-server — editar las etapas de un CRM (renombrar, agregar, quitar, ordenar, plazo, nutrición…)
// =============================================================================
// Era el cuerpo de `editarEtapaAction` (app/crm/actions.ts) y se mudó acá el 23/10/2026 para que lo use también la
// API de MaKo (P0-6 de la auditoría: `renombrar_etapa`, `agregar_etapa`, `eliminar_etapa`, `ordenar_etapas`,
// `plazo_etapa` y `columna_nutricion_crm`, lib/api-mako/areas/crm.run.ts). Antes la API sólo sabía cambiar el tipo de
// una etapa y crear un CRM entero: dos copias de cómo se guarda una etapa serían dos reglas sobre qué se puede borrar.
// Mismo molde que lib/etapa-tipo-server.ts (21/10/2026).
//
// Quien llama ya pasó su puerta (la action exige admin; la API, `rolMinimo: 'admin'`) y limpia los cachés a su manera
// (`bust`/`revalidatePath` en la action, `invalidar` en la API).
//
// También vive acá cómo se cuentan los leads de cada etapa (`conteosDelEmbudo`, con `etapaComoTablero`): el pop-up
// pregunta antes de quitar una etapa con gente, y la API lo dice en el resumen antes del «sí». Contado con dos reglas,
// uno de los dos diría «vacía» sobre una columna con leads.
// =============================================================================

import 'server-only';
import { getFunnelDe, getFunnelDefault, saveFunnelDe, saveFunnelDefault, umbralesDe } from './funnels';
import { listLeadsDeFunnel, type Lead } from './leads';
import {
  generateFunnel, conTerminales, MAX_LABEL_ETAPA, deriveStageKey, colorParaNueva, CHIP, DOT_SIN_COLOR,
  idsParaQuitarNutricion, esNutricionPropia, recorridoDe, type Stage, type StageDerivable, type StageTone,
} from './pipeline';
import { puedeSerReunion, conTipo, reunionPorNombre, type TipoEtapa } from './etapa-reunion';
import { armarPipeline, ordenConClave } from './etapa-banda';
import { cambiarTipoDeEtapa } from './etapa-tipo-server';
import { puedeTenerPlazo, sanearPlazo, PLAZO_MAX_DIAS } from './lead-quieto';
import { porQueNoSeElimina, pipelineReordenado } from './etapas-crm-reglas';

/**
 * La etapa donde el TABLERO dibuja a un lead: el override (`pipeline_stage`) si ese embudo
 * lo tiene, si no la derivada. Es la regla de `mapToCrmLead` (app/crm/crm-map.ts), y la
 * comparten el «traer» y el conteo del pop-up para no contar distinto de lo que se ve.
 *
 * ⚠️ PARA UN AGREGADO (mig 0207) `pipeline_stage` YA ES LA ETAPA DE SU FILA: la pone
 * `listLeadsDeFunnel`. O sea que esta misma regla lo cuenta en la columna de ESTE tablero
 * y no en la que su casa derivaría.
 */
export function etapaComoTablero(l: Lead, validas: ReadonlySet<string>): string {
  return l.pipeline_stage && validas.has(l.pipeline_stage)
    ? l.pipeline_stage
    : deriveStageKey(l as unknown as StageDerivable);
}

/**
 * Cuántos leads hay en cada etapa del embudo `funnelId` (null = el del negocio), con la regla que dibuja la tarjeta.
 * Tira si no puede leer: quien llama decide (el pop-up lo lee como «no sé» y pregunta; la API no propone).
 *
 * ⚠️ TODAS LAS ETAPAS ARRANCAN EN 0, y esto no es cosmética. Contando sólo lo que aparece, una etapa VACÍA no entra al
 * mapa y el lector recibe `undefined` — que la pantalla interpreta, con razón, como «no pude contar» y pregunta. O sea
 * que la fricción que se pidió sacar («si no tiene ningún lead, nada de fricción») volvía justo en el único caso donde
 * no tiene que estar. Clave ausente y valor cero no son lo mismo, y acá la diferencia es toda la feature.
 *
 * ⚠️ SE CUENTA CON LA REGLA QUE DIBUJA LA TARJETA (`etapaComoTablero`: el override si este embudo lo tiene, si no la
 * derivada), no con `deriveStageKey` solo. Hasta el 06/10/2026 se contaba con la derivada, y eso dejaba en CERO a dos
 * clases de columna con gente adentro — o sea que se quitaban sin preguntar:
 *   · las etapas PROPIAS del cliente: `deriveStageKey` es un switch cerrado sobre las columnas del lead y nunca devuelve
 *     una clave que el cliente inventó; a esas se llega SÓLO por `pipeline_stage`. Medido ese día: 1.067 de 1.161 leads
 *     del ws1 tienen un override distinto de su derivada.
 *   · los AGREGADOS (mig 0207): `listLeadsDeFunnel` los trae con la etapa de su FILA en `pipeline_stage`, y la derivada
 *     saldría de las columnas de su CASA.
 * Una clave que el embudo ya no tiene cae a la derivada (como en el tablero) y suma igual: lo que se pregunta es si
 * quitar la etapa deja gente afuera.
 */
export async function conteosDelEmbudo(funnelId: number | null): Promise<{
  conteos: Record<string, number>; leads: number; cfg: Awaited<ReturnType<typeof getFunnelDefault>>;
}> {
  const [leads, cfg] = await Promise.all([
    listLeadsDeFunnel(funnelId),
    funnelId != null ? getFunnelDe(funnelId) : getFunnelDefault(),
  ]);
  const out: Record<string, number> = {};
  for (const st of cfg.stages) out[st.key] = 0;
  const validas = new Set(cfg.stages.map((st) => st.key));
  for (const l of leads) {
    const k = etapaComoTablero(l, validas);
    out[k] = (out[k] ?? 0) + 1;
  }
  return { conteos: out, leads: leads.length, cfg };
}

/** Lo que contesta `editarEtapa` (y la action que la envuelve). */
export type ResultadoEtapa = Awaited<ReturnType<typeof editarEtapa>>;

/**
 * Editar UNA etapa del funnel desde la cabecera de su columna en el Kanban.
 *
 * Pedido de Martín (28/09/2026): «que estén 3 puntitos para opciones de editar esa
 * columna/etapa del funnel. Y que los cambios se guarden. Que se pueda renombrar o
 * eliminar, y otra opción de agregar nueva etapa».
 *
 * ⚠️ POR QUÉ ES UNA ACCIÓN ANGOSTA Y NO `saveFunnelAction`. Ésa recibe el pipeline ENTERO
 * desde el navegador, y el tablero no lo tiene: a `/crm` le llegan las etapas YA
 * GENERADAS (`filaAFunnel` corre en el server), no el pipeline crudo. Mandar el pipeline
 * reconstruido desde las etapas dibujadas le haría perder todo lo que la derivación agrega
 * y quita. Acá se lee, se parcha y se guarda del lado del server, que es el único que
 * tiene el original.
 *
 * ⚠️ Y EL RENOMBRE VA A DOS LUGARES DISTINTOS, según qué etapa sea. Las del pipeline
 * guardan su label ahí; las tres terminales derivadas (`perdido`, `descal`, `noresp`) no
 * existen en el pipeline —las pone la derivación en cada lectura— así que su nombre vive
 * en `data.labels`. El llamador no tiene que saber cuál es cuál: lo decide esto.
 */
export type OpEtapa =
  | { op: 'renombrar'; key: string; label: string }
  | { op: 'eliminar'; key: string }
  /**
   * Devolver una etapa que se acaba de quitar, TAL CUAL ESTABA.
   *
   * ⚠️ NO ES `agregar` OTRA VEZ. `agregar` acuña una clave nueva, y la clave es lo que ata
   * a los leads a su etapa: deshacer con ella devolvería una columna con el mismo nombre y
   * los leads afuera, que es peor que no deshacer. Acá vuelve la MISMA clave, en la MISMA
   * posición.
   */
  | { op: 'insertar'; etapa: EtapaQuitada; at: number }
  | { op: 'agregar'; despuesDe?: string; label?: string;
      /**
       * Crearla como NUTRICIÓN, en esa posición de la banda (el «+» entre dos nutriciones, sexto
       * feedback del 12/10/2026). Queda guardada en el pipeline con la marca (`esNutricionPropia`).
       */
      nutricionEn?: number }
  /**
   * Marcar (o desmarcar) una etapa como REUNIÓN: `kind: 'reunion'`, lo único que la marca
   * (lib/etapa-reunion.ts). Apagada vuelve a `'paso'`, como una etapa nueva.
   *
   * ⚠️ DESDE EL 12/10/2026 EL POP-UP MANDA `tipo` (abajo), no ésta. Queda por una pestaña abierta
   * con el bundle de antes: sin la rama, su `reunion` caería al final del `if` y se rechazaría.
   */
  | { op: 'reunion'; key: string; es: boolean }
  /**
   * El TIPO de una etapa: Etapa / Reunión / Nutrición (punto 3 del feedback del 12/10/2026: el
   * botón «Reunión» pasó a ser un desplegable y la subtab «Nutrición» se fue). Lo aplica `conTipo`
   * (lib/etapa-reunion.ts): Reunión es `kind: 'reunion'`; Nutrición y Etapa son `kind: 'paso'` con
   * `marcadaComo`, así que marcar Nutrición no cambia transiciones, reuniones ni automatizaciones.
   */
  | { op: 'tipo'; key: string; tipo: TipoEtapa;
      /**
       * Dónde cae en su lista de DESTINO cuando el tipo la cambia de banda: el índice en la lista de
       * etapas para Etapa/Reunión, en la banda Nutrición para Nutrición. Lo manda el arrastre de una
       * banda a la otra; sin él (el desplegable), cae lo más cerca de la otra banda. Ver
       * lib/etapa-banda.ts.
       */
      at?: number }
  /**
   * El PLAZO de una etapa, en días (#800): si un lead pasa más que eso sin moverse, MaKo le
   * avisa al dueño (lib/lead-quieto.ts). `dias: null` lo saca. Vive en
   * `data.umbrales.porEtapa`, que es lo que ya leía el CRM automático para T2 y T6.
   */
  | { op: 'plazo'; key: string; dias: number | null }
  /**
   * Apagar o encender una nutrición. `id` es `"desde>hacia"`, la misma clave que vive en
   * `data.suppressed`.
   *
   * ⚠️ UNA NUTRICIÓN NO ES UNA ETAPA: es una TRANSICIÓN que deriva `generateFunnel` de la
   * forma del pipeline. No se crea ni se borra — se suprime, que es agregar su id a la
   * lista. Por eso no hay «agregar nutrición»: las que puede haber las decide el
   * recorrido, y lo único que elige el negocio es cuáles NO usa.
   */
  | { op: 'nutricion'; id: string; activa: boolean;
      /**
       * Los OTROS ids de la misma nutrición, si sale de más de una etapa.
       *
       * ⚠️ «Reactivación» sale de «No responde» Y de «Perdido»: son dos transiciones con
       * dos ids, y la pantalla las dibuja como UNA fila (que es lo que son). Apagar sólo
       * uno dejaba la nutrición corriendo desde el otro lado, con la casilla desmarcada —
       * o sea, un interruptor que dice que está apagado sobre algo que sigue mandando.
       */
      tambien?: string[] }
  /**
   * Subir o bajar una etapa un lugar. `delta` es -1 (antes) o 1 (después).
   *
   * ⚠️ NO ES UN ARRASTRE, y es a propósito: «que sea simple la edición, nada compleja».
   * El orden de las etapas se toca una vez cada varios meses; un arrastre acá costaría
   * la copia que sigue al cursor, el auto-scroll y el hueco de destino —las tres reglas
   * de esta casa sobre el drag— para un gesto que casi nadie va a hacer dos veces.
   */
  | { op: 'mover'; key: string; delta: -1 | 1 }
  /**
   * El orden COMPLETO de las etapas propias, tal como quedó después de arrastrar.
   *
   * ⚠️ NO ES «mandar el pipeline». Viajan sólo las CLAVES, y el server reordena el
   * pipeline que ya tiene: nada de lo que la derivación agrega o quita depende de lo que
   * mande el navegador, y una clave que no exista se ignora. Un arrastre puede mover una
   * etapa varios lugares de una, y hacerlo con N `mover` sería N escrituras.
   */
  | { op: 'reordenar'; keys: string[] }
  /**
   * Quitar (o devolver) una COLUMNA de nutrición, cualquiera: «Todas las etapas de nutrición se
   * deben poder editar, incluso si las quiero eliminar todas» (Martín, 12/10/2026). Se apagan TODAS
   * las transiciones que llegan a ella y, si se coloca sola («Nutrición - Manual»), su marca fija
   * (`idsParaQuitarNutricion`, lib/pipeline.ts). Por CLAVE y no por id de transición: el navegador
   * no sabe de qué etapas sale cada una, y no tiene por qué saberlo.
   */
  | { op: 'quitarNutricion'; key: string }
  | { op: 'ponerNutricion'; key: string }
  /** El orden de la banda Nutrición, tal como quedó después de arrastrar (`data.ordenNutricion`). */
  | { op: 'ordenNutricion'; keys: string[] };

/**
 * Una etapa quitada, como vuelve con «Deshacer».
 *
 * ⚠️ `tone` y `marcadaComo` VIAJAN desde el 12/10/2026: sin ellos, deshacer devolvía la etapa con
 * el punto de su color y el chip gris (`tone: 'neutral'`), y una «Nutrición» volvía como «Etapa».
 */
export type EtapaQuitada = { key: string; label: string; dot?: string; tone?: string; kind?: string; marcadaComo?: string };

/** Lo que hace falta para DESHACER un quitado: la etapa entera y dónde estaba. */
export type DeshacerEtapa = { etapa: EtapaQuitada; at: number };

export async function editarEtapa(op: OpEtapa, funnelId: number | null): Promise<{ ok: true; deshacer?: DeshacerEtapa;
  /**
   * La etapa que se acaba de crear o renombrar quedó marcada como Reunión SOLA, por su nombre
   * (`reunionPorNombre`, punto 13 del feedback del 12/10/2026). La pantalla lo dice en un toast
   * con «Deshacer»: un cambio de tipo que nadie pidió no puede pasar callado. Es la CLAVE de la
   * etapa (la de una recién creada la acuña el server), para que el deshacer sepa a cuál volver.
   */
  reunionSola?: string;
  /** La clave de la etapa que `agregar` acaba de crear (la acuña el server): la API la devuelve para seguir trabajando. */
  creada?: string } | { ok: false; error: string }> {
  // ⚠️ FUERA DEL `try`, a propósito: declarado adentro, el `return` de abajo no lo puede
  // nombrar. Es la misma trampa de scope que ya costó cobrarle dos veces a un cliente en el
  // puente a Flow, y acá lo que se perdería es el deshacer de una etapa borrada.
  let deshacer: DeshacerEtapa | undefined;
  // Fuera del `try` por la misma razón que `deshacer`.
  let reunionSola: string | undefined;
  let creada: string | undefined;
  /**
   * La marca de Reunión por el NOMBRE, al crear o renombrar (punto 13 del feedback del 12/10/2026).
   * Decide `reunionPorNombre` (lib/etapa-reunion.ts) sobre el pipeline YA con el nombre nuevo, y en
   * el server: así vale igual para el pop-up y para los tres puntos de la columna del tablero.
   */
  const marcarSiPareceReunion = (pl: Stage[], key: string, labelAnterior?: string): Stage[] => {
    if (!reunionPorNombre(pl, key, labelAnterior)) return pl;
    reunionSola = key;
    return pl.map((x) => (x.key === key ? conTipo(x, 'reunion') : x));
  };
  try {
    const actual = funnelId != null ? await getFunnelDe(funnelId) : await getFunnelDefault();
    // ⚠️ El mismo guard que `declararEntradasAction`: con la lectura en ERROR lo que se lee
    // es el pipeline GENÉRICO, y guardarlo le pisa al cliente su funnel real. Una caída de
    // Supabase no puede reescribir un dato declarado.
    if (actual.origen === 'error') return { ok: false, error: 'No se pudo leer el funnel; no se guardó nada para no pisarlo. Vuelve a intentarlo.' };

    let pipeline = actual.pipeline;
    let labels = actual.labels;

    if (op.op === 'renombrar') {
      const label = op.label.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_ETAPA);
      if (!label) return { ok: false, error: 'El nombre no puede quedar vacío.' };
      const enPipeline = pipeline.some((st) => st.key === op.key);
      // Con el nombre de ANTES: renombrar marca sola sólo si el nombre PASA a decir reunión.
      if (enPipeline) pipeline = marcarSiPareceReunion(pipeline.map((st) => (st.key === op.key ? { ...st, label } : st)), op.key, pipeline.find((st) => st.key === op.key)?.label);
      else labels = { ...labels, [op.key]: label };
    } else if (op.op === 'eliminar') {
      // Lo que no se borra (las terminales, lo que no es del pipeline, la última, la de entrada) lo decide UNA función,
      // que la API de MaKo pregunta también antes del «sí».
      const no = porQueNoSeElimina(pipeline, op.key);
      if (no) return { ok: false, error: no };
      // Lo que se saca viaja de vuelta para poder DESHACERLO sin fricción: es la decisión de
      // Martín (29/09), «si no tiene ningún lead no debería haber nada de fricción, sólo que
      // me salte el pop-up de deshacer». Sin esto, deshacer tendría que acuñar una clave nueva.
      const iQuita = pipeline.findIndex((st) => st.key === op.key);
      const quitada = pipeline[iQuita];
      deshacer = { etapa: { key: quitada.key, label: quitada.label, dot: quitada.dot, tone: quitada.tone, kind: quitada.kind,
        ...(quitada.marcadaComo ? { marcadaComo: quitada.marcadaComo } : null) }, at: iQuita };
      pipeline = pipeline.filter((st) => st.key !== op.key);
    } else if (op.op === 'reordenar') {
      pipeline = pipelineReordenado(pipeline, op.keys);
    } else if (op.op === 'insertar') {
      // El deshacer de un quitado. Si la clave ya volvió por otro lado, no se duplica.
      if (pipeline.some((st) => st.key === op.etapa.key)) return { ok: true };
      const vuelveLabel = op.etapa.label.trim().slice(0, MAX_LABEL_ETAPA) || 'Etapa';
      // `tone` y `marcadaComo` vienen del navegador: se aceptan sólo los que existen. Sin `dot`
      // vuelve sin color y la lectura le deriva uno (`conColores`), como a cualquier etapa vieja.
      const tono = op.etapa.tone && Object.prototype.hasOwnProperty.call(CHIP, op.etapa.tone) ? (op.etapa.tone as StageTone) : 'neutral';
      const marca = op.etapa.marcadaComo === 'etapa' || op.etapa.marcadaComo === 'nutricion' ? op.etapa.marcadaComo : undefined;
      const vuelve = { key: op.etapa.key, label: vuelveLabel, dot: op.etapa.dot ?? DOT_SIN_COLOR, tone: tono, kind: op.etapa.kind ?? 'paso',
        ...(marca ? { marcadaComo: marca } : null) } as Stage;
      // Nunca por delante de la entrada: si la etapa se quitó de ahí, volvió de otro lado.
      const piso = pipeline.findIndex((st) => st.kind === 'entrada') + 1;
      const at = Math.max(piso, Math.min(op.at, pipeline.length));
      pipeline = [...pipeline.slice(0, at), vuelve, ...pipeline.slice(at)];
    } else if (op.op === 'quitarNutricion' || op.op === 'ponerNutricion') {
      // Los ids salen del PIPELINE, nunca del navegador: `suppressed` es texto libre en un jsonb.
      const ids = idsParaQuitarNutricion(actual.pipeline, labels, op.key);
      if (!ids.length) return { ok: false, error: 'Esa etapa no es una nutrición de este funnel.' };
      const sup = new Set(actual.suppressed);
      for (const k of ids) { if (op.op === 'ponerNutricion') sup.delete(k); else sup.add(k); }
      // Con el pipeline INTACTO, como `nutricion`: esta operación sólo toca `suppressed`.
      const conGanadoQ = conTerminales(actual.pipeline);
      if (funnelId != null) await saveFunnelDe(funnelId, conGanadoQ, [...sup], { labels });
      else await saveFunnelDefault(conGanadoQ, [...sup], { labels });
      return { ok: true };
    } else if (op.op === 'ordenNutricion') {
      // Sólo las columnas de nutrición que ESTE funnel tiene, sin repetir; las que no vinieron
      // van al final, en el orden que ya tenían (un arrastre no puede perder una columna).
      const validas = actual.stages.filter((st) => st.band === 'nutricion').map((st) => st.key);
      const vistas = new Set<string>();
      const orden: string[] = [];
      for (const k of Array.isArray(op.keys) ? op.keys : []) if (validas.includes(k) && !vistas.has(k)) { vistas.add(k); orden.push(k); }
      for (const k of validas) if (!vistas.has(k)) orden.push(k);
      const conGanadoO = conTerminales(actual.pipeline);
      const extraO = { labels, ordenNutricion: orden };
      if (funnelId != null) await saveFunnelDe(funnelId, conGanadoO, actual.suppressed, extraO);
      else await saveFunnelDefault(conGanadoO, actual.suppressed, extraO);
      return { ok: true };
    } else if (op.op === 'nutricion') {
      // El id se valida contra las nutriciones que ESTE pipeline puede tener, y no se
      // acepta crudo: `suppressed` es texto libre en un jsonb, así que sin esto se puede
      // llenar de ids que no significan nada y que nadie va a limpiar nunca.
      const posibles = new Set(
        generateFunnel(actual.pipeline, [], labels).transitions
          .filter((t) => t.category === 'nutricion')
          .map((t) => `${t.from}>${t.to}`),
      );
      if (!posibles.has(op.id)) return { ok: false, error: 'Esa nutrición no es de este funnel.' };
      const sup = new Set(actual.suppressed);
      // Todos los ids de la MISMA nutrición se escriben juntos: con uno solo, apagarla la
      // deja corriendo desde la otra etapa de la que sale.
      const ids = [...new Set([op.id, ...(op.tambien ?? [])])].filter((k) => posibles.has(k));
      for (const k of ids) { if (op.activa) sup.delete(k); else sup.add(k); }
      // ⚠️ Se guarda con el pipeline INTACTO: esta operación sólo toca `suppressed`.
      const conGanadoNut = conTerminales(actual.pipeline);
      if (funnelId != null) await saveFunnelDe(funnelId, conGanadoNut, [...sup], { labels });
      else await saveFunnelDefault(conGanadoNut, [...sup], { labels });
      return { ok: true };
    } else if (op.op === 'plazo') {
      // ⚠️ SE DECIDE ACÁ: `op` es el argumento de una server action. Una etapa terminal o el
      // cierre no tienen plazo (un lead en Ganado no está «quieto», ya terminó), y la etapa
      // tiene que existir en ESTE embudo.
      const st = actual.stages.find((x) => x.key === op.key);
      if (!st) return { ok: false, error: 'Esa etapa no es de este funnel.' };
      if (!puedeTenerPlazo(st)) return { ok: false, error: 'Esa etapa no lleva plazo.' };
      const dias = op.dias == null ? null : sanearPlazo(op.dias);
      if (op.dias != null && dias == null) return { ok: false, error: `El plazo va de 1 a ${PLAZO_MAX_DIAS} días.` };
      // Las OTRAS claves de `umbrales` se conservan: las cuatro perillas del CRM automático
      // viven en el mismo objeto, y `saveFunnelDe` reemplaza `umbrales` entero.
      const u = await umbralesDe(funnelId ?? null);
      if (u == null) return { ok: false, error: 'No se pudo leer el funnel; no se guardó nada para no pisarlo.' };
      const previos = u.porEtapa && typeof u.porEtapa === 'object' && !Array.isArray(u.porEtapa)
        ? { ...(u.porEtapa as Record<string, unknown>) } : {};
      if (dias == null) delete previos[op.key];
      else previos[op.key] = dias;
      // ⚠️ Con el pipeline INTACTO, como la nutrición: esta operación sólo toca `umbrales`.
      const conGanadoPlazo = conTerminales(actual.pipeline);
      const extra = { labels, umbrales: { ...u, porEtapa: previos } };
      if (funnelId != null) await saveFunnelDe(funnelId, conGanadoPlazo, actual.suppressed, extra);
      else await saveFunnelDefault(conGanadoPlazo, actual.suppressed, extra);
      return { ok: true };
    } else if (op.op === 'mover') {
      // ⚠️ SOLO SE MUEVE LO QUE VIVE EN EL PIPELINE. Las tres terminales derivadas
      // (`perdido`, `descal`, `noresp`) no están ahí: las agrega `generateFunnel` al final
      // en cada lectura, así que su lugar no es un dato que se pueda guardar. Moverlas
      // «funcionaría» —el guardado no fallaría— y la pantalla volvería a mostrarlas donde
      // estaban, que es la peor forma de no hacer nada.
      const i = pipeline.findIndex((st) => st.key === op.key);
      if (i < 0) return { ok: false, error: 'Esa etapa la pone MaKo al final del funnel y no se puede mover. Sí puedes cambiarle el nombre.' };
      const j = i + op.delta;
      if (j < 0 || j >= pipeline.length) return { ok: false, error: 'Esa etapa ya está en la punta.' };
      // El cierre va último: es de donde salen los datos de la venta, y `problemasDePipeline`
      // ya avisa cuando no lo está. Acá se impide de entrada en vez de dejar hacerlo y quejarse.
      if (pipeline[i].kind === 'cierre' || pipeline[j].kind === 'cierre') {
        return { ok: false, error: 'La etapa donde se cierra la venta va última.' };
      }
      // Y la de entrada va PRIMERA, por lo mismo: ni se mueve ni se la pasa por encima.
      if (pipeline[i].kind === 'entrada' || pipeline[j].kind === 'entrada') {
        return { ok: false, error: 'Por esa etapa entra tu gente: va primera.' };
      }
      const orden = [...pipeline];
      [orden[i], orden[j]] = [orden[j], orden[i]];
      pipeline = orden;
    } else if (op.op === 'reunion') {
      // ⚠️ SE DECIDE ACÁ, NO EN LA PANTALLA: `op` es el argumento de una server action. La
      // entrada, el pago, el cierre y las terminales no pueden ser una reunión (perderían su
      // tipo, y al desmarcarlas volverían como un paso cualquiera). Ver `puedeSerReunion`.
      const st = pipeline.find((x) => x.key === op.key);
      if (!st) return { ok: false, error: 'Esa etapa la pone MaKo al final del funnel: no puede ser una reunión.' };
      if (!puedeSerReunion(st)) return { ok: false, error: 'Esa etapa no puede ser una reunión.' };
      // Con `conTipo` y no con un `kind` suelto: marcarla Reunión le saca la marca de Nutrición,
      // y desmarcarla la deja como «Etapa» elegida a mano (el nombre deja de contar).
      pipeline = pipeline.map((x) => (x.key === op.key ? conTipo(x, op.es ? 'reunion' : 'etapa') : x));
    } else if (op.op === 'tipo') {
      // ⚠️ DESDE EL 12/10/2026 EL TIPO DECIDE LA BANDA (sexto feedback: «si se coloca "Etapa" se
      // desplaza automáticamente hacia arriba, y viceversa»). Lo decide `cambiarTipo` (lib/etapa-banda.ts,
      // puro y con test), que además valida la etapa: la entrada, el cierre y las terminales no llevan
      // tipo (`puedeTenerTipo`), y una clave que no es de este funnel se rechaza. Desde el 21/10/2026 el
      // cuerpo vive en lib/etapa-tipo-server.ts (`cambiarTipoDeEtapa`), que usa también la API de MaKo
      // (`cambiar_tipo_etapa`): «Tipo de etapa» del «⋯» de cada columna pasa por acá, como el pop-up.
      const r = await cambiarTipoDeEtapa(funnelId ?? null, op.key, op.tipo, op.at);
      if (!r.ok) return r;
      return { ok: true };
    } else if (op.op === 'agregar') {
      // La clave se acuña acá, en el server, y se comprueba contra el pipeline real: si se
      // eligiera en el navegador, dos pestañas abiertas acuñan la misma y la segunda pisa a
      // la primera sin que nada falle.
      let n = 0;
      let key = 'st0';
      while (pipeline.some((st) => st.key === key)) { n += 1; key = 'st' + n; }
      const label = (op.label ?? 'Nueva etapa').trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_ETAPA) || 'Nueva etapa';
      // Una NUTRICIÓN nueva (el «+» entre dos nutriciones): nace con la marca, se guarda antes del
      // cierre (`armarPipeline`) y cae en esa posición de la banda.
      if (typeof op.nutricionEn === 'number' && Number.isFinite(op.nutricionEn)) {
        const nueva = conTipo({ key, label, ...colorParaNueva(pipeline, pipeline.length), kind: 'paso' } as Stage, 'nutricion');
        const plN = armarPipeline(recorridoDe(pipeline), [...pipeline.filter(esNutricionPropia), nueva]);
        const ordenAhoraN = actual.stages.filter((x) => x.band === 'nutricion').map((x) => x.key);
        const orden = ordenConClave({ pipeline: plN, suppressed: actual.suppressed, labels, ordenNutricion: ordenAhoraN }, key, op.nutricionEn);
        const conGanadoN = conTerminales(plN);
        if (funnelId != null) await saveFunnelDe(funnelId, conGanadoN, actual.suppressed, { labels, ordenNutricion: orden });
        else await saveFunnelDefault(conGanadoN, actual.suppressed, { labels, ordenNutricion: orden });
        return { ok: true, creada: key };
      }
      // Se mete DESPUÉS de la etapa desde cuyo menú se pidió; sin referencia, antes del
      // cierre, que es donde una etapa nueva tiene sentido (el cierre va último).
      const iRef = op.despuesDe ? pipeline.findIndex((st) => st.key === op.despuesDe) : -1;
      const iCierre = pipeline.findIndex((st) => st.kind === 'cierre');
      const iEntrada = pipeline.findIndex((st) => st.kind === 'entrada');
      const at = Math.max(iEntrada + 1, iRef >= 0 ? iRef + 1 : (iCierre >= 0 ? iCierre : pipeline.length));
      // ⚠️ NACE CON COLOR (punto 8 del feedback del 12/10/2026): «todas las nuevas etapas que creo…
      // el circulito al lado de la etapa aparece en gris». Nacía con el gris de relleno y el tono
      // `neutral`; ahora con uno de la paleta que no use otra etapa, y si están todos, distinto de
      // sus dos vecinas (`colorParaNueva`, lib/pipeline.ts).
      const nueva = { key, label, ...colorParaNueva(pipeline, at), kind: 'paso' } as Stage;
      pipeline = marcarSiPareceReunion([...pipeline.slice(0, at), nueva, ...pipeline.slice(at)], key);
      creada = key;
    } else {
      // ⚠️ UNA OPERACIÓN QUE NO SE CONOCE SE RECHAZA. Hasta el 12/10/2026 este `else` era el
      // `agregar`, así que cualquier op nueva que llegara de una pestaña vieja —o de un pedido
      // armado a mano— agregaba una «Nueva etapa» al embudo sin que nadie la pidiera.
      return { ok: false, error: 'Esa operación no existe.' };
    }

    const conGanado = conTerminales(pipeline);
    if (funnelId != null) await saveFunnelDe(funnelId, conGanado, actual.suppressed, { labels });
    else await saveFunnelDefault(conGanado, actual.suppressed, { labels });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  return { ok: true, deshacer, ...(reunionSola ? { reunionSola } : null), ...(creada ? { creada } : null) };
}
