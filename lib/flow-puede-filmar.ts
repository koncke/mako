// =============================================================================
// ¿Puede el puente filmar AHORA? — un ensayo en seco, no una credencial
// =============================================================================
// ⚠️ ESTE MÓDULO EXISTE PORQUE HABÍA NUEVE DEFINICIONES DE «EL PUENTE ANDA» Y
// NINGUNA ERA ALCANZABLE EN EL FLOW NUEVO.
//
// El dueño mandó dos capturas del mismo segundo: el popup decía «MaKo ya puede
// hacer tus anuncios» y el aviso de al lado, dentro de MaKo, decía «MaKo todavía no
// puede filmar tus anuncios». Las dos pantallas hablaban del mismo hecho y no
// compartían NI UN insumo.
//
// La causa: `estado === 'listo'` significaba «hay un bearer guardado». En
// flow.google.com Google NUNCA emite un bearer —la app habla sólo por BOQ, con
// cookies— y el propio latido lo BORRA a propósito cuando ve el dominio nuevo. O
// sea que `listo` era inalcanzable por construcción, para siempre, para todos.
//
// Y no era un cartel: cuatro compuertas duras cuelgan de ese mismo booleano —
//
//   · `VideoGeneratorApp.tsx` → `disabled={!puedeCrear || !puenteAnda}`
//   · `extension/background.js` → `if (out.pausado || estado !== 'listo') return;`
//   · `app/api/flow/puente/route.ts` → `estado === 'sin_sesion' ? [] : tomarTrabajos()`
//   · `app/video-generator/video-action.ts` → el guard de filmar, server-side
//
// — así que nadie podía apretar el botón, y si lo apretaba nadie repartía el
// trabajo, y si lo repartía la extensión no lo corría. Cuatro caminos, un candado.
//
// LA CURA NO ES UN CAMPO MÁS. Con nueve definiciones, agregar la décima es el
// problema, no el arreglo. Lo que cambia es qué SIGNIFICA `listo`:
//
//   antes:  «tengo una credencial del protocolo viejo»
//   ahora:  «si me dieran un anuncio ahora mismo, el pedido saldría»
//
// Y eso se MIDE, no se recuerda: es literalmente el camino de `repetirEnBoq`
// recorrido hasta un paso antes de mandarlo. Un verde no puede mentir porque es el
// mismo predicado que la ejecución real exige.
//
// ⚠️ NO GASTA UN CRÉDITO NI TOCA LA RED. Los tres chequeos son locales: que la
// plantilla exista, que esté completa, y que la frase-ancla todavía se encuentre
// adentro del cuerpo. El tercero es el que atrapa el caso silencioso —una
// generación posterior de la misma clase PISA el `cuerpo` conservando el `op`, así
// que la plantilla queda registrada y ya no se puede parchear—.
//
// SIN `server-only`: lo corre el service worker de la extensión, copiado por
// `scripts/sync-puede-filmar.mjs`.

import { comoViajo } from './flow-boq-patch';

/**
 * Una plantilla guardada, como la deja el espejo.
 *
 * Se tipa flojo a propósito: viene de `chrome.storage.local`, o sea de un JSON que
 * escribió otra versión de la extensión. Exigirle una forma acá haría que un campo
 * ausente explote en vez de contestar «no puedo».
 */
export type PlantillaGuardada = {
  op?: string | null;
  cuerpo?: string | null;
  url?: string | null;
  /** Cuándo se guardó. Desempata cuando hay más de una para la misma operación. */
  cuando?: number | null;
};

/** Lo mínimo del catálogo que este ensayo necesita. */
export type OperacionMinima = {
  op: string;
  frase: string | null;
  nombre: string;
  /** Sólo para desempatar entre candidatas usables. Ver el catálogo. */
  rpcidsPreferidos?: readonly string[];
};

export type Ensayo = {
  /** ¿Saldría el pedido si llegara un trabajo ahora mismo? */
  puede: boolean;
  /** El `op` de la primera operación que falla, para que el popup sepa qué enseñar. */
  falta: string | null;
  /**
   * POR QUÉ falla, en una línea.
   *
   * ⚠️ ES DIAGNÓSTICO, NO COPY. Viaja en `detalle` del latido y termina en la base,
   * para quien lea buscando por qué algo no filma. La pantalla del cliente deriva
   * su frase de un estado cerrado — este repo ya pagó dos veces por pintar un campo
   * libre en la cara de alguien.
   */
  porQue: string;
};

/**
 * El ensayo de UNA operación.
 *
 * Los tres pasos son, en orden, los mismos que `repetirEnBoq` recorre antes de
 * mandar nada — y en el mismo orden, que importa: sin plantilla no tiene sentido
 * preguntar por el cuerpo, y sin cuerpo no tiene sentido buscar el ancla.
 */
/**
 * ¿Le puedo poner el `at` vivo a este cuerpo?
 *
 * Es el ÚLTIMO chequeo que hace el espejo antes de mandar (`PLANTILLA_SIN_AT`), y
 * por lo tanto el último que el ensayo tiene que replicar para no dar un verde que
 * la ejecución va a rechazar. Dos formas válidas: el hueco que dejó el espejo, o un
 * `at=` ya presente en el cuerpo capturado.
 */
function tieneAt(cuerpo: string): boolean {
  return cuerpo.includes('__MAKO_AT__') || /(^|&)at=/.test(cuerpo);
}

/**
 * LA plantilla que se va a usar para esta operación — o `null` y por qué.
 *
 * ⚠️ EXISTE PORQUE EL ENSAYO Y LA EJECUCIÓN ELEGÍAN POR SEPARADO, Y CON LA MISMA
 * REGLA MALA. Los dos hacían `find(p => p.op === cat.op)`, que devuelve la PRIMERA
 * por orden de inserción. Las plantillas se guardan por CLASE, así que un navegador
 * que aprendió en labs.google y después migró a flow.google.com tiene DOS para
 * `generar_clip`: la vieja REST y la nueva de BOQ. La REST tiene `cuerpo`, tiene
 * `url`, y su JSON lleva la frase en texto plano —o sea que `comoViajo` la
 * encuentra con la codificación `crudo`—: pasaba los tres chequeos, abría las cuatro
 * compuertas, y después el espejo la rechazaba por no tener dónde poner el `at`. El
 * trabajo moría cinco veces con la plantilla buena sentada a una clave de distancia.
 *
 * Ahora se miran TODAS las candidatas y gana la más nueva de las usables. Y lo
 * elige UNA función, que es lo que hace que el ensayo no pueda opinar distinto que
 * la ejecución.
 */
export function elegirPlantilla(
  plantillas: Record<string, PlantillaGuardada | null | undefined>,
  cat: OperacionMinima,
): { clase: string; pl: PlantillaGuardada; porQue: string } {
  const candidatas = Object.entries(plantillas || {}).filter(([, p]) => p && p.op === cat.op);
  if (!candidatas.length) return { clase: '', pl: {}, porQue: `SIN_PLANTILLA(${cat.op})` };

  // De la más nueva a la más vieja. `cuando` lo escribe `guardarPlantillas`; una sin
  // fecha es de una versión anterior y va al fondo, que es donde corresponde.
  const orden = [...candidatas].sort((a, b) => Number(b[1]!.cuando || 0) - Number(a[1]!.cuando || 0));

  // El motivo que se reporta es el de la MEJOR candidata, no el de la última
  // mirada: decir «sin ancla» cuando la que importa estaba incompleta manda a
  // enseñar de nuevo algo que no era el problema.
  let peor = `SIN_PLANTILLA(${cat.op})`;
  // ⚠️ ENTRE LAS USABLES, GANA LA QUE SE VIO GENERAR. `boq:WuwhI` —un pedido
  // intermedio del ciclo— también lleva la frase, queda etiquetado como la
  // generación, y siendo más nuevo le ganaba a `YhhmEf`, que es el que genera:
  // se habría repetido el RPC equivocado con la plantilla buena al lado. Si el id
  // rotó y ninguna coincide, se cae a la más nueva, como antes.
  const preferidos = cat.rpcidsPreferidos || [];
  const rpcidDe = (clase: string) => (/^boq:([^,]+)/.exec(clase) || [])[1] || '';
  const ordenPreferido = [...orden].sort((a, b) =>
    Number(preferidos.includes(rpcidDe(b[0]))) - Number(preferidos.includes(rpcidDe(a[0]))));
  for (const [clase, p] of ordenPreferido) {
    const pl = p as PlantillaGuardada;
    // ⚠️ `url` TAMBIÉN. `repetirEnBoq` la exige (`!pl.cuerpo || !pl.url` →
    // PLANTILLA_INCOMPLETA) y el gate del popup no la miraba: una plantilla a medias
    // se contaba como aprendida y el trabajo moría después, con el botón apretado.
    if (!pl.cuerpo || !pl.url) { peor = `PLANTILLA_INCOMPLETA(${cat.op})`; continue; }
    // ⚠️ EL PASO QUE ATRAPA EL CASO SILENCIOSO. Al guardar, una generación nueva de
    // la misma clase conserva el `op` y REEMPLAZA el `cuerpo`. Si ese cuerpo no
    // lleva la frase —porque la persona generó otra cosa— la plantilla sigue
    // figurando como aprendida y `reemplazarEnCuerpo` daría SIN_ANCLA cuando ya sea
    // tarde. `comoViajo` es pura: se puede correr mil veces sin tocar Google.
    if (cat.frase && !comoViajo(pl.cuerpo, cat.frase)) { peor = `SIN_ANCLA(${cat.op})`; continue; }
    if (!tieneAt(pl.cuerpo)) { peor = `PLANTILLA_SIN_AT(${cat.op})`; continue; }
    return { clase, pl, porQue: '' };
  }
  return { clase: '', pl: {}, porQue: peor };
}

export function ensayarOperacion(
  plantillas: Record<string, PlantillaGuardada | null | undefined>,
  cat: OperacionMinima,
): Ensayo {
  const elegida = elegirPlantilla(plantillas, cat);
  if (!elegida.clase) return { puede: false, falta: cat.op, porQue: elegida.porQue };
  return { puede: true, falta: null, porQue: '' };
}

/**
 * ¿Puede filmar? — el juicio ÚNICO del que cuelgan las cuatro compuertas.
 *
 * Recorre las operaciones que hacen falta para producir un anuncio y se queda con
 * la PRIMERA que falla, en el orden del catálogo. Ese `falta` es lo que el popup
 * ofrece enseñar: un paso por pantalla, la regla de la casa.
 *
 * ⚠️ CON LA LISTA VACÍA CONTESTA QUE NO. Un catálogo que llega vacío —por un import
 * roto, por un `catch`, por una copia desincronizada— significa «no sé», y «no sé»
 * no puede resolver a un verde: sería exactamente el éxito falso que este módulo
 * viene a cerrar, con la ventaja de que además no dejaría nada que investigar.
 */
export function puedeFilmar(
  plantillas: Record<string, PlantillaGuardada | null | undefined>,
  necesarias: readonly OperacionMinima[],
): Ensayo {
  if (!necesarias || !necesarias.length) {
    return { puede: false, falta: null, porQue: 'SIN_CATALOGO' };
  }
  for (const cat of necesarias) {
    const r = ensayarOperacion(plantillas || {}, cat);
    if (!r.puede) return r;
  }
  return { puede: true, falta: null, porQue: '' };
}
