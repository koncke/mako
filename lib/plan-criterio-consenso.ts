// =============================================================================
// plan-criterio-consenso — juntar TRES corridas del juez en un veredicto
// =============================================================================
// Sin `server-only` a propósito: acá vive la parte que decide, y una decisión sin
// test es una afirmación (misma razón que `plan-criterio-reglas.ts`).
//
// ── POR QUÉ TRES CORRIDAS ────────────────────────────────────────────────────
// Lo pide el documento de Mauricio del 8/9/2026, con el número medido y con todas
// las letras: «Tres corridas del mismo transcript y unión de las tres. NO ES
// OPCIONAL: una corrida suelta pierde entre 5 y 8 puntos de recall contra la
// unión.» El juez hacía UNA (más un reintento ante fallo, que es otra cosa).
//
// Y es lo único de su configuración que se puede cumplir tal cual. Lo otro que
// pide —Claude Sonnet 5— está prohibido por una decisión posterior del dueño de
// este repo, textual: «NO, JAMÁS algo pago para el plan» (30/09/2026). Así que el
// juez corre en la cascada gratis y lo que se compra con las tres corridas es
// justamente lo que se resigna al no pagar el modelo. Tres corridas gratis son
// tres veces la CUOTA, que no es plata.
//
// ── UNIÓN, NO MAYORÍA ────────────────────────────────────────────────────────
// El documento dice «unión» y el número que mide es de RECALL. Así que:
//   · un índice que CUALQUIER corrida llamó compromiso, es compromiso;
//   · los faltantes se suman, no se votan.
// Eso baja la precisión a propósito —Mauricio midió 75% de recall contra 45% de
// precisión y eligió ese canje— y acá cuesta todavía menos que en su pipeline: lo
// que sale del juez entra a un BORRADOR que una persona revisa en /plan/revisar
// antes de que exista. Una tarea de más se destilda; una que no salió no aparece
// en ninguna pantalla.
// La única excepción es `recurrente`, que se vota por mayoría: es un flag
// ortogonal a la cubeta y su propia regla dice «ante la duda, false» — unirlo
// haría que una sola corrida dudosa le sacara el deadline a un compromiso real.
//
// ── CÓMO SE AGRUPAN LOS FALTANTES, QUE ES LO CARO ────────────────────────────
// ⚠️ El documento avisa, y es su advertencia más fuerte: «Emparejar compromisos
// por parecido de palabras no funciona y produce métricas falsas. "Análisis de la
// marca de empleador comparando ofertas de la competencia" y "benchmark de
// condiciones laborales frente a la competencia" son el mismo compromiso y casi
// no comparten vocabulario. Ningún umbral léxico separa eso de un falso positivo.»
// Su salida es que el agrupamiento lo haga un modelo.
//
// Acá NO hace falta un modelo, y es por una propiedad que su pipeline no tiene:
// **cada faltante llega con su CITA, y la cita está verificada contra la
// transcripción** (regla 5 + `sanearFaltantes`, que descarta el que no se
// verifica). O sea que cada faltante tiene un ANCLA: el lugar de la conversación
// donde se dijo. Dos corridas que encontraron el mismo compromiso citan el mismo
// momento, por más distinto que lo redacten — el ancla no es una paráfrasis del
// modelo, es una posición en el texto. Eso es exactamente lo que el parecido de
// palabras no puede dar, gratis y determinista.
//
// Y el caso que el ancla sola no cubre: dos personas distintas con una entrega
// propia cada una en la MISMA frase. Es la regla 1 del criterio y el documento lo
// pone de ejemplo (sus compromisos 4 y 5 comparten cita). Por eso el dueño entra
// en la clave: mismo momento Y mismo dueño.
//
// El parecido de palabras queda como red SECUNDARIA, para el caso inverso: dos
// corridas que citan frases distintas del mismo compromiso. Se suma al ancla, no
// lo reemplaza — que es lo que el documento prohíbe.

import { normCita } from './plan-criterio-reglas';
import { mismaTarea } from './tareas-dedup';
import type { Veredicto, Faltante, Cubeta } from './plan-criterio-reglas';

/** De más a menos inclusiva. La unión se queda con la primera que aparezca. */
const ORDEN_UNION: readonly Cubeta[] = ['compromiso', 'acuerdo_interno', 'descartado', 'fuera'];

/**
 * Dos citas del mismo momento: cuántos caracteres normalizados se toleran entre
 * sus anclas. 200 son ~35 palabras, media docena de renglones de habla real: lo
 * que se mueve una corrida a otra al elegir dónde empieza la frase. Más ancho
 * empezaría a fundir dos compromisos seguidos del mismo dueño.
 */
export const VENTANA_ANCLA = 200;

/** El primer pedazo citable de una cita (el modelo pega frases con «…»). */
const primerPedazo = (cita: string): string => {
  for (const p of cita.split(/\.{3,}|…/)) {
    const n = normCita(p);
    if (n.length >= 12) return n;
  }
  return normCita(cita);
};

/**
 * DÓNDE, en la transcripción normalizada, arranca lo que cita este faltante.
 * -1 = no se pudo ubicar (la cita se verificó por el camino tolerante a errores
 * de transcripción). Ahí el agrupamiento cae a la red secundaria.
 */
export function anclaDeCita(cita: string, transcriptNorm: string): number {
  const p = primerPedazo(cita);
  if (!p) return -1;
  const exacto = transcriptNorm.indexOf(p);
  if (exacto >= 0) return exacto;
  // Las primeras palabras alcanzan: si la corrida citó el mismo momento, arranca igual.
  const pal = p.split(' ');
  if (pal.length >= 3) {
    const tres = pal.slice(0, 3).join(' ');
    const i = transcriptNorm.indexOf(tres);
    if (i >= 0) return i;
  }
  return -1;
}

/** ¿Estos dos faltantes son el mismo compromiso visto por dos corridas? */
function elMismo(a: Faltante, b: Faltante, anclaA: number, anclaB: number): boolean {
  // Dueños distintos: NUNCA el mismo, aunque compartan la cita entera. Es la regla 1.
  if (normCita(a.quien) !== normCita(b.quien)) return false;
  if (anclaA >= 0 && anclaB >= 0 && Math.abs(anclaA - anclaB) <= VENTANA_ANCLA) return true;
  // Red secundaria (ver la cabecera): sólo SUMA casos, nunca decide sola.
  return mismaTarea(a.titulo, b.titulo);
}

/**
 * Un veredicto por índice, uniendo las corridas que contestaron.
 *
 * `corridas` trae una lista por corrida, todas de largo `n` (las que fallaron no
 * entran: eso lo decide quien llama). Un índice que ninguna corrida juzgó queda
 * null, que río abajo significa «entra como siempre».
 */
export function unirVeredictos(corridas: Array<Array<Veredicto | null>>, n: number): Array<Veredicto | null> {
  const out: Array<Veredicto | null> = Array.from({ length: n }, () => null);
  for (let i = 0; i < n; i++) {
    const vs = corridas.map((c) => c[i]).filter((v): v is Veredicto => !!v);
    if (!vs.length) continue;
    // La cubeta más inclusiva que dijo ALGUNA, y el veredicto entero de la primera
    // corrida que la dijo: la razón y la cita tienen que ser las de ESA lectura, o
    // sale un veredicto Frankenstein que no explica su propia cubeta.
    const cubeta = ORDEN_UNION.find((c) => vs.some((v) => v.cubeta === c)) ?? vs[0].cubeta;
    const gana = vs.find((v) => v.cubeta === cubeta) ?? vs[0];
    // `recurrente` por MAYORÍA ESTRICTA de las que se pronunciaron, y ante el empate
    // false: es la regla que el propio criterio le da al juez.
    const siRec = vs.filter((v) => v.recurrente).length;
    out[i] = { ...gana, recurrente: siRec * 2 > vs.length };
  }
  return out;
}

/**
 * La UNIÓN de los faltantes de todas las corridas, sin repetir.
 *
 * Gana el primero de cada grupo: las corridas se pasan en orden, así que es el de
 * la primera que lo encontró. No se funden campos entre corridas por lo mismo que
 * arriba — un faltante con la cita de una y la razón de otra no lo escribió nadie.
 */
export function unirFaltantes(corridas: Faltante[][], transcriptNorm: string): Faltante[] {
  const out: Faltante[] = [];
  const anclas: number[] = [];
  for (const corrida of corridas) {
    for (const f of corrida) {
      const a = anclaDeCita(f.cita, transcriptNorm);
      if (out.some((y, k) => elMismo(f, y, a, anclas[k]))) continue;
      out.push(f);
      anclas.push(a);
    }
  }
  return out;
}

/** Para el log: cuánto sumó cada corrida sobre la anterior. */
export function aporteDeCadaCorrida(corridas: Faltante[][], transcriptNorm: string): number[] {
  const acum: Faltante[][] = [];
  const out: number[] = [];
  let previo = 0;
  for (const c of corridas) {
    acum.push(c);
    const n = unirFaltantes(acum, transcriptNorm).length;
    out.push(n - previo);
    previo = n;
  }
  return out;
}
