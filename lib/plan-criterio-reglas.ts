// =============================================================================
// plan-criterio-reglas — el JUEZ del criterio de compromisos, la parte que no es modelo
// =============================================================================
// Mauricio escribió un criterio de qué cuenta como compromiso de una sesión (8/9, «Criterio
// de extracción de compromisos»), con tres cubetas: compromisos, acuerdos internos y
// candidatos descartados. En MaKo ese criterio NO reemplaza al extractor: lo JUZGA después
// (lo decidió el plan del 9/9). El extractor sigue sacando ancho —un compromiso que no se
// extrae es invisible— y el juez pone cada tarea en su cubeta. La razón concreta: el texto
// del extractor lo comparte el importador de archivos de todos los clientes.
//
// Acá vive lo que el modelo NO decide:
//  · La CITA se verifica contra la transcripción. Su regla 5 dice que sin cita el
//    compromiso no existe; «una regla en un prompt no es una regla», así que la cita que
//    no aparece palabra por palabra baja la tarea a descartado, con la razón escrita. NO
//    se borra: Martín pidió explícitamente que el criterio no sea una forma de tirar tareas.
//  · Un veredicto incompleto no se completa adivinando: queda en null = «no se juzgó», y
//    esa tarea sigue el camino de siempre (entra como nueva).
//  · La CUARTA pregunta del criterio —«¿se repite para siempre?», de Mauricio, 16/07/2026—
//    tiene su desempate determinista acá (`decidirRecurrente`): una fecha y un «esto se
//    repite» se contradicen, y gana la fecha. No es una cubeta ni una regla nueva; el
//    porqué está escrito arriba de `ReglaCriterio` y de `Veredicto.recurrente`.
//
// SIN `server-only`: el test la importa, y prompt-registry lee las plantillas.
// =============================================================================

/** Las cubetas del criterio de Mauricio, más `fuera`: lo que ni siquiera tiene forma de
 *  compromiso. `fuera` NO va al tablero (su documento: «si entrara a No clasificadas, esa
 *  columna se convertiría en un basurero»), pero queda en el borrador de la reunión. */
export type Cubeta = 'compromiso' | 'acuerdo_interno' | 'descartado' | 'fuera';
export const CUBETAS: readonly Cubeta[] = ['compromiso', 'acuerdo_interno', 'descartado', 'fuera'];

/** Qué regla sacó a un descartado: las 5 numeradas del criterio, la definición, o que no
 *  alcanzó el contexto para decidir (el pedido «no hay suficiente contexto» del 8/9).
 *
 *  ⚠️ EL '4' YA ESTÁ TOMADO: es la regla 4 DE MAURICIO (el dueño sugirió y el otro aceptó
 *  más adelante — ver lib/plan-criterio-juez.ts). Los ids de acá son los suyos y se
 *  numeran como él los numeró; no hay uno libre para una regla nuestra. La cuarta
 *  pregunta del criterio («¿se repite para siempre?») NO entra por este enum — ver
 *  `decidirRecurrente` acá abajo. */
export type ReglaCriterio = '1' | '2' | '3' | '4' | '5' | 'definicion' | 'contexto';
const REGLAS: readonly ReglaCriterio[] = ['1', '2', '3', '4', '5', 'definicion', 'contexto'];

export type EstadoCompromiso = 'acordado' | 'solicitado_sin_respuesta';

export type Veredicto = {
  cubeta: Cubeta;
  regla: ReglaCriterio | null;
  /** regla 1: esta tarea es un paso del compromiso con ese índice. */
  parteDe: number | null;
  razon: string;
  /** verificada contra la transcripción. null = no hay cita que se sostenga. */
  cita: string | null;
  tema: string | null;
  estado: EstadoCompromiso | null;
  /**
   * ¿Se repite para siempre? La CUARTA pregunta del criterio, y NO es una cubeta.
   *
   * Una reunión de los miércoles es un compromiso de verdad —alguien con nombre dijo que
   * la iba a sostener— así que no es «descartado» ni es «fuera»: lo que cambia no es a qué
   * cubeta va, es que no compite en el ranking, no lleva deadline y no cuenta para el
   * avance de su proyecto (lib/plan-recurrentes.ts). Meterla como cubeta la sacaría del
   * tablero, que es justo lo contrario de lo que se decidió; meterla como `regla` pediría
   * un id nuevo en un enum que es de Mauricio y donde el '4' ya es suyo. Por eso es un
   * flag ortogonal, al lado de `estado`.
   */
  recurrente: boolean;
  /**
   * El código tuvo que corregir al juez, y en qué:
   *  · `'cita'`  — dijo compromiso o acuerdo interno con una cita que no está en la
   *    transcripción, y bajó a descartado por la regla 5.
   *  · `'regla'` — descartó nombrando una regla que este criterio no tiene. El
   *    descarte se respeta igual; lo que falta es el número que lo hace auditable.
   *
   * Los dos se CUENTAN (`resumenVeredictos`) porque una corrección que no se cuenta no
   * se puede vigilar: si `regla` sube reunión tras reunión, el criterio de ese
   * workspace y lo que el juez cree que son sus reglas dejaron de coincidir.
   */
  degradado?: 'cita' | 'regla';
};

/**
 * ¿NACE recurrente? La segunda capa de la cuarta pregunta del criterio.
 *
 * Vive acá y no en el prompt porque «una regla en un prompt no es una regla»: el modelo
 * acierta casi siempre, y este módulo es el «casi». Vive acá y no en `lib/plan-propuesta.ts`
 * —que es `server-only`— para que un test la pueda importar y correr, que es el mismo
 * motivo por el que este archivo no lleva `server-only`.
 *
 * Dos decisiones, y las dos tienen su porqué escrito:
 *
 * 1. **`=== true`, no truthy.** Idéntico a `esRecurrente` (lib/plan-recurrentes.ts): el
 *    valor llega del JSON de un modelo, o sea cualquier cosa (`"true"`, `1`, `"sí"`). Ante
 *    la duda la respuesta es NO — una tarea mal marcada desaparece del ranking sin que
 *    nadie lo haya pedido, y eso es peor que una recurrente que todavía compite.
 *
 * 2. **SI HAY FECHA, GANA LA FECHA.** Son dos señales que se contradicen: lo que se repite
 *    para siempre no vence. AGENTS.md ya decidió el desempate: «cuando el saneo tenga que
 *    elegir entre dos señales que se contradicen, gana la más cara de producir». Un
 *    booleano es un token que el modelo tira sin pensar; una fecha concreta sólo se escribe
 *    habiendo oído a alguien decirla en la reunión, y se puede verificar contra la
 *    transcripción. Así que la fecha se conserva y el flag se cae. El error que queda en
 *    ese caso es el barato y visible (una recurrente compitiendo, que se arregla con el
 *    interruptor del detalle), nunca el caro y mudo (la tarea con fecha real que sale del
 *    ranking sola y pierde su deadline en `taskToRow`).
 *
 * `conflicto` existe para que quien llama lo pueda DEJAR ESCRITO: un descarte sin rastro
 * hace indistinguibles «el modelo no la marcó» de «la marcamos y se la tiramos nosotros».
 */
export type DecisionRecurrente = { recurrente: boolean; conflicto: boolean };

export function decidirRecurrente(crudo: unknown, deadline?: string | null): DecisionRecurrente {
  const marcado = crudo === true;
  if (marcado && typeof deadline === 'string' && deadline.trim()) return { recurrente: false, conflicto: true };
  return { recurrente: marcado, conflicto: false };
}

// ── La cita ───────────────────────────────────────────────────────────────────

/** Minúsculas, sin acentos ni puntuación. Gemela de la de lib/chat-agent-voz.ts. */
export const normCita = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * La transcripción SIN las marcas de cada renglón (`[00:12:34] Nombre: `), normalizada.
 * Fathom parte un mismo turno en varios renglones: con las marcas adentro, una cita que
 * cruza de un renglón al siguiente no aparecería nunca, y sería un descarte falso.
 */
export function transcriptParaCitas(texto: string): string {
  return normCita(texto.split('\n').map((l) => l.replace(/^\s*\[\d{1,2}:\d{2}(?::\d{2})?\]\s*[^:\n]{0,80}:\s*/, '')).join(' '));
}

/** Cuántas palabras distintas se toleran: 1 cada 10, mínimo 1. */
const erroresTolerados = (palabras: number): number => Math.max(1, Math.floor(palabras / 10));

/** Distancia de edición EN PALABRAS entre `a` y el tramo de `t` que arranca en `desde`
 *  y termina donde convenga (anclado al principio, libre al final). */
function distanciaAnclada(a: string[], t: string[], desde: number, tope: number): number {
  const b = t.slice(desde, desde + a.length + tope);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return Math.min(...prev);
}

/** Dónde aparece una secuencia de palabras (índices de palabra, no de caracteres). */
function posiciones(seq: string[], t: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + seq.length <= t.length; i++) {
    if (t[i] === seq[0] && seq.every((w, k) => t[i + k] === w)) out.push(i);
  }
  return out;
}

// Una reunión se juzga entera contra la misma transcripción: partirla en palabras (y darla
// vuelta) una vez por reunión, no una vez por cita.
let cacheNorm = '';
let cachePalabras: string[] = [];
let cacheAlReves: string[] = [];
const palabrasDe = (norm: string): { t: string[]; tr: string[] } => {
  if (norm !== cacheNorm) { cacheNorm = norm; cachePalabras = norm.split(' '); cacheAlReves = [...cachePalabras].reverse(); }
  return { t: cachePalabras, tr: cacheAlReves };
};

/**
 * Un pedazo, con la regla del Chat Agent: menos de 12 caracteres no prueba nada
 * («dale», «sí, claro»), y si el modelo le estiró el final, un prefijo largo alcanza.
 *
 * Y una tolerancia, medida el 17/9 en la sesión del anexo de Mauricio. Su compromiso nº 3
 * se caía a descartado por dos palabras en 34: el modelo escribió «¿sabes qué? A ver, haz»
 * donde Fathom transcribió «sabes que ver haz», y Fathom escribió «chandear» donde se dijo
 * «chambear». Su propio documento lo avisa: la única cita que le falló «delató un error de
 * transcripción, no del modelo». Pasa si calza en UN tramo seguido de la transcripción
 * con a lo sumo 1 palabra distinta cada 10. Seguido es la mitad de la regla: coser la
 * mitad de una frase con la de otra, de otro momento de la reunión, no pasa nunca.
 */
function pedazoVerificado(c: string, transcriptNorm: string): boolean {
  if (c.length < 12) return false;
  if (transcriptNorm.includes(c)) return true;
  if (c.length > 60 && transcriptNorm.includes(c.slice(0, 60))) return true;
  const a = c.split(' ');
  if (a.length < 6) return false;
  const { t, tr } = palabrasDe(transcriptNorm);
  const tope = erroresTolerados(a.length);
  // Anclas: donde aparecen sus 3 primeras palabras, o sus 3 últimas (por si el error de
  // transcripción cae justo al principio). Del ancla final se prueba hacia atrás.
  for (const p of posiciones(a.slice(0, 3), t)) {
    if (distanciaAnclada(a, t, p, tope) <= tope) return true;
  }
  const ar = [...a].reverse();
  for (const p of posiciones(ar.slice(0, 3), tr)) {
    if (distanciaAnclada(ar, tr, p, tope) <= tope) return true;
  }
  return false;
}

/**
 * ¿La cita está en la transcripción, palabra por palabra?
 *
 * Una diferencia con la del Chat Agent, medida: el modelo pega dos frases de la misma
 * intervención con «...» aunque el prompt le diga que no, y así se cayó a descartado un
 * compromiso REAL de la sesión del anexo de Mauricio (3/9). Se acepta si CADA pedazo entre
 * «...» aparece literal: sigue sin haber una sola palabra inventada. Uno que no aparece
 * tumba la cita entera.
 */
export function citaVerificada(cita: string, transcriptNorm: string): boolean {
  const partes = cita.split(/\.{3,}|…/).map(normCita).filter((x) => x.length >= 12);
  if (!partes.length) return false;
  return partes.every((x) => pedazoVerificado(x, transcriptNorm));
}

// ── El saneo de lo que devolvió el modelo ─────────────────────────────────────

const txt = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Un veredicto por índice, en el orden de las candidatas. null = no se juzgó.
 *
 * Lo que NO se acepta y por qué:
 *  · cubeta desconocida, o descartado SIN regla → null. Un descarte sin la regla que lo
 *    sacó es justo lo que Mauricio pidió que no exista («para que la decisión sea
 *    auditable»), y completarla acá sería inventar la regla.
 *  · el mismo índice dos veces → gana el primero.
 *  · compromiso o acuerdo interno con una cita que no está en la transcripción → baja a
 *    descartado por la regla 5, con la cita rechazada en la razón para poder revisarla.
 */
export function sanearVeredictos(obj: unknown, n: number, transcriptNorm: string): Array<Veredicto | null> {
  const out: Array<Veredicto | null> = Array.from({ length: n }, () => null);
  const lista = obj && typeof obj === 'object' ? (obj as Record<string, unknown>).veredictos : null;
  if (!Array.isArray(lista)) return out;
  for (const crudo of lista) {
    if (!crudo || typeof crudo !== 'object') continue;
    const o = crudo as Record<string, unknown>;
    const i = Number(o.i);
    if (!Number.isInteger(i) || i < 0 || i >= n || out[i]) continue;
    const cubeta = o.cubeta as Cubeta;
    if (!CUBETAS.includes(cubeta)) continue;
    const reglaCruda = o.regla == null ? null : String(o.regla).trim().toLowerCase().replace(/^regla\s*/, '');
    const regla = REGLAS.includes(reglaCruda as ReglaCriterio) ? (reglaCruda as ReglaCriterio) : null;
    // ⚠️ UN DESCARTE SIN REGLA SE CONSERVA, MARCADO. Esto era un `continue`, con un
    // razonamiento correcto —«completar la regla acá sería inventarla»— y la
    // consecuencia contraria: `out[i]` quedaba `null`, río abajo eso significa «no se
    // juzgó», y la tarea entraba TILDADA. Un descarte que no se puede auditar se
    // convertía en una tarea en el tablero, que es peor que un descarte sin número.
    //
    // Y no es un caso raro: `REGLAS` es el enum de las reglas DE MAURICIO. El día que
    // otro workspace cargue un criterio con tres reglas, o con reglas con nombre, TODOS
    // sus descartes se caen por acá y el juez no filtra nada — con el log diciendo que
    // juzgó. Es el bloqueante real de replicar el criterio, y no está en el texto.
    const reglaFaltante = cubeta === 'descartado' && !regla;
    const pd = Number(o.parte_de);
    const parteDe = regla === '1' && o.parte_de != null && Number.isInteger(pd) && pd >= 0 && pd < n && pd !== i ? pd : null;
    const razon = (() => {
      const base = txt(o.razon, 600);
      if (!reglaFaltante) return base;
      // Lo que falta se ESCRIBE donde alguien lo lea, con lo que el juez sí dijo: sin
      // esto, «el criterio no tiene esa regla» y «el juez se olvidó de ponerla» se ven
      // igual, y son dos arreglos distintos.
      const dijo = reglaCruda ? `dijo la regla «${reglaCruda.slice(0, 40)}», que este criterio no tiene` : 'no dijo qué regla lo saca';
      return `${base}${base ? ' · ' : ''}(el juez ${dijo})`.slice(0, 600);
    })();
    const tema = txt(o.tema, 80) || null;
    const citaCruda = txt(o.cita, 600);
    // El juez no propone fechas, así que acá la cuarta pregunta no tiene con qué
    // contradecirse: el desempate contra el deadline vive donde sí conviven los dos
    // campos (`limpiarTarea` en lib/plan-propuesta.ts).
    const { recurrente } = decidirRecurrente(o.recurrente);

    if (cubeta === 'fuera') {
      out[i] = { cubeta, regla: null, parteDe: null, razon, cita: null, tema, estado: null, recurrente: false };
      continue;
    }
    const ok = !!citaCruda && citaVerificada(citaCruda, transcriptNorm);
    if (!ok && cubeta !== 'descartado') {
      out[i] = {
        cubeta: 'descartado', regla: '5', parteDe: null,
        razon: citaCruda
          ? `El juez la puso en «${cubeta === 'compromiso' ? 'compromiso' : 'acuerdo interno'}», pero su cita no aparece en la transcripción: «${citaCruda.slice(0, 200)}».`
          : `El juez la puso en «${cubeta === 'compromiso' ? 'compromiso' : 'acuerdo interno'}» sin ninguna cita.`,
        cita: null, tema, estado: null, recurrente, degradado: 'cita',
      };
      continue;
    }
    const estado = cubeta === 'compromiso'
      ? (o.estado === 'solicitado_sin_respuesta' ? 'solicitado_sin_respuesta' : 'acordado')
      : null;
    out[i] = { cubeta, regla: cubeta === 'descartado' ? regla : null, parteDe, razon, cita: ok ? citaCruda : null, tema, estado, recurrente,
      // La marca viaja con el veredicto: el descarte vale, y queda dicho que el
      // numero que lo hace auditable no vino.
      ...(reglaFaltante ? { degradado: 'regla' as const } : {}) };
  }
  return out;
}

/**
 * Lo que la lista NO tenía y el criterio sí encuentra en la reunión.
 *
 * Existe porque la prueba en seco lo mostró: en la sesión del anexo, 4 de los 8
 * compromisos de Mauricio nunca llegaron a ser tareas de MaKo —los que él promete mandar—,
 * y un juez que solo clasifica no puede recuperar lo que no se extrajo. Acá la regla 5 sí
 * se aplica tal cual: un faltante sin cita literal NO se registra. No se le tira nada a
 * nadie: nunca fue una tarea.
 */
export type Faltante = {
  quien: string; titulo: string; producto: string | null;
  cubeta: 'compromiso' | 'acuerdo_interno';
  cita: string; tema: string | null; estado: EstadoCompromiso | null; razon: string;
  /** ¿se repite para siempre? Mismo flag que en `Veredicto`, y por el mismo motivo: un
   *  faltante que resulta ser la reunión de los miércoles nace recurrente o nace mal. */
  recurrente: boolean;
};

export function sanearFaltantes(obj: unknown, transcriptNorm: string): Faltante[] {
  const lista = obj && typeof obj === 'object' ? (obj as Record<string, unknown>).faltantes : null;
  if (!Array.isArray(lista)) return [];
  const out: Faltante[] = [];
  const vistos = new Set<string>();
  for (const crudo of lista.slice(0, 40)) {
    if (!crudo || typeof crudo !== 'object') continue;
    const o = crudo as Record<string, unknown>;
    const cubeta = o.cubeta === 'acuerdo_interno' ? 'acuerdo_interno' : o.cubeta === 'compromiso' ? 'compromiso' : null;
    const titulo = txt(o.que, 200);
    const quien = txt(o.quien, 80);
    const cita = txt(o.cita, 600);
    if (!cubeta || !titulo || !quien || !cita || !citaVerificada(cita, transcriptNorm)) continue;
    const k = normCita(titulo);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({
      quien, titulo, producto: txt(o.producto, 200) || null, cubeta, cita,
      tema: txt(o.tema, 80) || null, razon: txt(o.razon, 600),
      estado: cubeta === 'compromiso' ? (o.estado === 'solicitado_sin_respuesta' ? 'solicitado_sin_respuesta' : 'acordado') : null,
      recurrente: decidirRecurrente(o.recurrente).recurrente,
    });
  }
  return out;
}

/** Cuántas cayeron en cada lado — para el log y la prueba en seco. */
export function resumenVeredictos(vs: Array<Veredicto | null>): Record<Cubeta | 'sin_juzgar' | 'degradadas' | 'sin_regla', number> {
  const r = { compromiso: 0, acuerdo_interno: 0, descartado: 0, fuera: 0, sin_juzgar: 0, degradadas: 0, sin_regla: 0 };
  for (const v of vs) {
    if (!v) { r.sin_juzgar++; continue; }
    r[v.cubeta]++;
    if (v.degradado) r.degradadas++;
    // Aparte, y no sumado a `degradadas`: una cita que no aparece es el juez
    // inventando, y una regla que este criterio no tiene es el CRITERIO y el juez
    // hablando de cosas distintas. Se arreglan en lugares distintos.
    if (v.degradado === 'regla') r.sin_regla++;
  }
  return r;
}

// ── Las plantillas (editables por workspace en /configuraciones) ──────────────

export const CRITERIO_JUEZ_JSON_SHAPE = `Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin markdown), con UN veredicto por cada índice de la lista:
{"veredictos":[
  {"i":0,"cubeta":"compromiso","regla":null,"parte_de":null,"razon":"<qué pasó en esta reunión>","cita":"<frase copiada tal cual de la transcripción>","tema":"<el asunto>","estado":"acordado","recurrente":false},
  {"i":1,"cubeta":"descartado","regla":"2","parte_de":null,"razon":"<qué regla lo saca y por qué, en concreto>","cita":"<frase copiada tal cual>","tema":"<el asunto>","estado":null,"recurrente":false},
  {"i":2,"cubeta":"fuera","regla":null,"parte_de":null,"razon":"<por qué no tiene forma de compromiso>","cita":null,"tema":"<el asunto>","estado":null,"recurrente":false},
  {"i":3,"cubeta":"compromiso","regla":null,"parte_de":null,"razon":"<sostener la junta semanal de los miércoles>","cita":"<frase copiada tal cual>","tema":"<el asunto>","estado":"acordado","recurrente":true}
],
"faltantes":[
  {"quien":"<nombre, como aparece en la transcripción>","que":"<la acción, en una frase>","producto":"<lo concreto que queda>","cubeta":"compromiso","estado":"acordado","tema":"<el asunto>","razon":"<por qué cumple el criterio>","cita":"<frase copiada tal cual>","recurrente":false}
]}`;

export const CRITERIO_JUEZ_SYSTEM_TEMPLATE = `Eres MaKo. Te paso una lista de tareas que YA se sacaron de una reunión, y el CRITERIO DE COMPROMISOS de {{dueno}}, el dueño del tablero. No sacas tareas nuevas: decides en qué cubeta va CADA una de las que te paso.

EL CRITERIO (lo escribió {{dueno}}; es la regla que manda):
{{criterio}}

LAS CUBETAS — cada tarea va a UNA sola:
- "compromiso": cumple la definición y TODAS las reglas del criterio. {{dueno}} es parte.
- "acuerdo_interno": un acuerdo real entre asistentes en el que {{dueno}} no es parte: no lo hace, no lo manda, no lo asigna y no lo sugirió. Que {{dueno}} esté en la reunión NO lo hace parte: si dos asistentes se reparten algo entre ellos («tú y yo lo vemos», «entre los dos definimos», «luego se lo pasamos a {{dueno}}», «tengo que hablar con X») y {{dueno}} solo escucha, es acuerdo_interno.
- "descartado": tenía forma de compromiso —alguien con nombre dijo que iba a hacer o entregar algo— pero una regla del criterio lo saca.
- "fuera": ni siquiera tiene forma de compromiso: una idea, un diagnóstico, una sugerencia sin dueño, algo que ya está hecho, un tema "a ver después" sin acción.

CÓMO SE LLENA CADA VEREDICTO:
1. "cita" es OBLIGATORIA en compromiso, acuerdo_interno y descartado: una frase de la transcripción copiada TAL CUAL, palabra por palabra, con la fluidez rota del habla real. No la corrijas, no la resumas, no juntes dos pedazos. Se verifica contra la transcripción: si no aparece, la tarea pasa sola a descartado por la regla 5. En "fuera" va null.
2. En "descartado", "regla" es la regla que lo sacó: "1" a "5", o "definicion" si lo saca la definición y no una regla numerada. Si no alcanza el contexto de la reunión para decidir, "regla" es "contexto" y la razón dice qué faltó. No adivines.
3. "razon" dice qué pasó en ESTA reunión, en una o dos frases concretas. No repitas el texto de la regla.
4. Si varias tareas de la lista son pasos hacia UN mismo producto final del MISMO dueño (regla 1), la principal va a "compromiso" y las otras a "descartado" con regla "1" y "parte_de" = el índice de la principal. Si son de dueños distintos, son compromisos distintos.
5. "estado", solo en compromiso: "acordado", o "solicitado_sin_respuesta" si {{dueno}} lo pidió y el otro no lo aceptó explícitamente.
5 bis. "recurrente": true SOLO si esto SE REPITE PARA SIEMPRE. Es la CUARTA pregunta del criterio, y las otras no la contestan: la reunión de los miércoles se puede completar esta semana, no es una decisión y no está hecha —pasa las tres— y aun así no tiene fin. Lo que la delata: al cerrarla hay que volver a crearla. {{dueno}} lo dijo así: «lo que entran son tareas que tienen un inicio y tienen un fin».
   · SÍ se repite: asistir a la junta semanal con los clientes, el seguimiento diario a los leads, revisar el tablero todos los lunes, la llamada mensual de cada cuenta.
   · NO se repite, aunque hable de algo que sí: «diseñar la estructura de la junta semanal», «implementar la cadencia de juntas», «armar por primera vez el reporte semanal». Montar un ritual es una tarea CON FIN: termina el día que el ritual existe. Lo que se repite es ASISTIR a la junta cada semana, no inventarla.
   · Un compromiso recurrente SIGUE siendo "compromiso". No lo mandes a "descartado" ni a "fuera" por repetirse: sólo marca el flag.
   · Ante la duda, false.
6. "tema": el asunto, en pocas palabras.
7. Un veredicto por CADA índice de la lista, sin saltearte ninguno.
8. "faltantes": los compromisos y acuerdos internos que cumplen el criterio y NO están en la lista, cada uno con su cita. Revisa en especial lo que {{dueno}} promete hacer o mandar («te mando», «les voy a mandar», «yo te ayudo»): es lo que más se pierde. Solo lo que falta: no repitas con otras palabras una tarea que ya está en la lista. Si no falta nada, [].

{{jsonShape}}`;

export const CRITERIO_JUEZ_USER_TEMPLATE = `DUEÑO DEL TABLERO: {{dueno}}

QUIÉNES HABLARON EN LA REUNIÓN:
{{participantes}}

TAREAS QUE SE SACARON (índice · de quién · título — detalle):
{{tareas}}

LA REUNIÓN:
{{reunion}}`;
