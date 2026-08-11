// =============================================================================
// preguntas-contrato — QUÉ tipos de pregunta existen y CÓMO se contesta cada uno
// =============================================================================
// Fuente única del contrato de las preguntas del Perro Guardián: el catálogo de
// tipos, el saneo que garantiza que el TIPO y el CAMPO se correspondan, y el
// texto que se le pasa a los modelos que las escriben.
//
// SIN `server-only` A PROPÓSITO (como lib/formatos-archivo.ts): el catálogo lo
// necesitan los generadores del servidor Y los renderizadores del cliente. Si
// cada lado tuviera el suyo volveríamos al problema que este módulo existe para
// cerrar.
//
// POR QUÉ EXISTE
// -------------
// El síntoma que lo motivó: «¿Cuál es el deadline para tener los ángulos
// listos?» dibujada con botones 1 2 3 4 5. El dueño toca un 3 y al Perro le
// llega «¿Cuál es el deadline…? → 3», que no dice nada. Estaba documentado
// desde el 2026-08-05 en docs/hallazgos-ui.md y volvió porque no había una sola
// línea de CÓDIGO que lo impidiera: las reglas de coherencia vivían en la prosa
// de cinco prompts distintos, y la prosa no valida nada.
//
// Las tres causas, las tres cerradas acá:
//   1. `escala` era el único tipo EXENTO del saneo de coherencia, así que se
//      volvió el imán de toda pregunta que el modelo no sabía tipear.
//   2. Cuando el modelo mandaba `escala` CON opciones, el saneo resolvía el
//      conflicto a favor del token suelto (`tipo`) y TIRABA las opciones — que
//      son el dato fuerte, porque solo se escriben sabiendo qué contesta la
//      pregunta. Las fechas concretas que había propuesto se perdían para
//      siempre: no quedaban ni en la base ni en la pantalla ni en el log.
//   3. No existía ningún tipo capaz de contestar «¿para cuándo?», y los prompts
//      ordenaban preguntar exactamente eso mientras prohibían las preguntas
//      abiertas. El modelo quedaba acorralado y elegía el tipo menos malo.

/**
 * Los formatos en los que se puede contestar una pregunta. Cada uno tiene UN
 * campo en pantalla (ver `PreguntaCampo` en app/plan/board/guardian-form.tsx).
 */
export type TipoPregunta = 'opcion' | 'multi' | 'escala' | 'fecha' | 'texto' | 'comparacion';

export const TIPOS_PREGUNTA: TipoPregunta[] = ['opcion', 'multi', 'escala', 'fecha', 'texto', 'comparacion'];

export type Pregunta = {
  pregunta: string;
  opciones: string[];
  tipo: TipoPregunta;
  /** títulos de las tareas de las que habla (para no hacerla si ya no son tuyas). */
  sobre?: string[];
};

const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * ¿La pregunta pide una FECHA? Se usa para mandarla al campo que la puede
 * contestar en vez de dejarla en un formato que no la contesta.
 *
 * Amplio a propósito: alcanza con que el enunciado nombre una fecha, un día o un
 * plazo. La primera versión era estrecha (solo «¿cuándo?», «deadline», «qué
 * fecha») y se le escapó «¿Cuál es la **fecha de inicio y fin** de cada Quarter?»,
 * que salió como un textarea vacío — exactamente lo que no puede pasar.
 *
 * El costo de equivocarse es asimétrico y por eso conviene pasarse de amplio: un
 * calendario donde hacía falta un textarea es incómodo; un textarea donde hacía
 * falta un calendario es una pregunta que el dueño saltea. Y el chequeo corre
 * DESPUÉS de mirar si hay opciones usables, así que «¿El deadline lo pone el
 * cliente o nosotros?» con sus dos opciones sigue siendo una `opcion`.
 */
export function pideFecha(pregunta: string): boolean {
  return /(\bfechas?\b|\bcu[áa]ndo\b|\bdeadline\b|\bplazo\b|\bvencimiento\b|\bqu[ée] d[íi]a\b|\bpara qu[ée] d[íi]a\b)/i.test(pregunta);
}

/**
 * ¿La escala explica qué significan sus extremos? Una escala sin eso es un
 * campo sin unidad: el 3 no significa nada, ni para quien contesta ni para el
 * Perro que después lo lee. Los prompts lo exigen desde siempre («Una escala
 * sin extremos explicados es una pregunta muerta»), pero era prosa: nada lo
 * miraba. Ahora si no los explica, no es una escala.
 */
export function explicaLaEscala(pregunta: string): boolean {
  return /(^|[^\d])1\s*[=:–—-]/.test(pregunta) && /(^|[^\d])5\s*[=:–—-]/.test(pregunta);
}

/**
 * EL SANEO. Devuelve una pregunta cuyo `tipo` SIEMPRE se puede contestar con el
 * campo que le corresponde, o null si no hay pregunta.
 *
 * La regla que ordena todo: **cuando el tipo y las opciones se contradicen,
 * ganan las opciones**. `tipo` es un token suelto que el modelo puede errar sin
 * darse cuenta; una lista de respuestas concretas solo se escribe sabiendo qué
 * contesta la pregunta. Antes era al revés y por eso se perdían las respuestas
 * buenas.
 *
 * Acepta `{pregunta, tipo, opciones, sobre}` o (compat) una nota-string suelta.
 */
export function sanearPregunta(p: unknown, avisar?: (motivo: string) => void): Pregunta | null {
  if (typeof p === 'string') {
    const t = p.trim();
    return t ? { pregunta: t.slice(0, 300), opciones: [], tipo: pideFecha(t) ? 'fecha' : 'texto' } : null;
  }
  if (!p || typeof p !== 'object') return null;
  const o = p as Record<string, unknown>;
  const pregunta = str(o.pregunta).trim().slice(0, 300);
  if (!pregunta) return null;

  let opciones = asArr<unknown>(o.opciones).map((x) => str(x).trim()).filter(Boolean).slice(0, 6);
  // `texto` SOLO vale si el modelo lo pidió explícitamente. La regla del dueño es «nunca
  // campos abiertos», con la excepción rara de que de verdad no haya otro campo posible
  // — y esa excepción la elige el modelo a conciencia, no la produce un degradado.
  const textoPedido = o.tipo === 'texto';
  let tipo: TipoPregunta = TIPOS_PREGUNTA.includes(o.tipo as TipoPregunta)
    ? (o.tipo as TipoPregunta)
    : (opciones.length ? 'opcion' : (pideFecha(pregunta) ? 'fecha' : 'texto'));
  const queda = (t: TipoPregunta, motivo: string) => { if (t !== tipo) avisar?.(`«${pregunta.slice(0, 70)}»: ${motivo} → ${t}`); tipo = t; };

  // ── ESCALA ─────────────────────────────────────────────────────────────────
  // Deja de ser la excepción de la casa y pasa a tener DOS requisitos propios.
  if (tipo === 'escala') {
    // (a) Con opciones concretas, el modelo quiso una elección, no una
    //     intensidad. Es el caso exacto de la captura: mandó fechas como
    //     opciones, el saneo viejo las tiraba y quedaban cinco números pelados.
    if (opciones.length >= 2) queda('opcion', 'vino como escala pero trae opciones concretas');
    // (b) Sin extremos explicados no se puede contestar: el 3 no tiene unidad.
    else if (!explicaLaEscala(pregunta)) queda(pideFecha(pregunta) ? 'fecha' : 'texto', 'escala sin explicar qué significan el 1 y el 5');
    else opciones = [];   // escala legítima: la pantalla muestra 1..5, las etiquetas sobran
  }

  // ── COMPARACIÓN ────────────────────────────────────────────────────────────
  // Enfrentar DOS: con una sola no hay comparación, y con tres la pantalla
  // dibuja tres columnas para una pregunta que dice «¿cuál de los dos?».
  if (tipo === 'comparacion' && opciones.length !== 2) {
    queda(opciones.length ? 'opcion' : (pideFecha(pregunta) ? 'fecha' : 'texto'), `comparación con ${opciones.length} opciones`);
  }

  // ── TIPOS QUE NECESITAN OPCIONES Y NO LAS TIENEN ───────────────────────────
  // El modelo manda "tipo": "opcion" y se olvida las opciones: la pantalla
  // dibujaba el enunciado con CERO botones, una pregunta que no se puede
  // contestar ni saltear bien. Se degrada a lo que SÍ se puede responder — y si
  // lo que pide es una fecha, al campo de fecha, no a un textarea.
  if ((tipo === 'opcion' || tipo === 'multi') && !opciones.length) {
    queda(pideFecha(pregunta) ? 'fecha' : 'texto', 'pide opciones y vino sin ninguna');
  }

  // ── FECHA ──────────────────────────────────────────────────────────────────
  // Una pregunta que pregunta CUÁNDO se contesta con un calendario, no con un
  // párrafo — ni siquiera cuando el modelo pidió `texto` a propósito. Las opciones
  // que haya mandado sobreviven como ATAJOS al lado del calendario («Esta semana»,
  // «Todavía no hay fecha»): son la respuesta rápida, y el calendario está para la
  // fecha exacta.
  if (tipo === 'texto' && pideFecha(pregunta)) queda('fecha', 'pide una fecha: va al calendario, no a un campo abierto');
  if (tipo === 'fecha') {
    // ⚠️ FUERA el atajo que el renderer YA agrega, y fuera los repetidos.
    //
    // El bug, visto en pantalla el 11/8: «Todavía no hay fecha» aparecía DOS veces y
    // las dos marcadas. `PreguntaCampo` pinta `[...opciones, SIN_FECHA]` —el atajo
    // siempre va— así que cuando el modelo lo manda entre sus opciones (y lo manda,
    // porque el contrato se lo ofrece como ejemplo) sale duplicado. Y las dos quedan
    // en azul porque la marca compara por TEXTO: el mismo string matchea las dos filas.
    //
    // Se saca acá y no en el renderer porque el saneo es la fuente única: la misma
    // pregunta la pinta el board, el wizard del borrador y el de la reunión.
    opciones = dedupOpciones(opciones.filter((o) => norm(o) !== norm(SIN_FECHA))).slice(0, 4);
  }

  // ── NUNCA UN CAMPO ABIERTO POR DESCARTE ────────────────────────────────────
  // Si llegamos a `texto` DEGRADANDO —el modelo dijo "opcion" y se olvidó las
  // opciones, o mandó una comparación de uno— la pregunta se descarta. Antes se
  // dibujaba un textarea, y eso rompe la regla del dueño: «ya teníamos como REGLA
  // NUNCA campos abiertos». El modelo quiso dar opciones y no pudo; inventarle un
  // formato que nadie eligió no arregla la pregunta, solo la disfraza. Mejor una
  // pregunta menos que una que el dueño va a saltear igual.
  if (tipo === 'texto' && !textoPedido) {
    avisar?.(`«${pregunta.slice(0, 70)}»: quedó sin campo posible (el tipo pedía opciones y no vinieron) → descartada`);
    return null;
  }

  const sobre = asArr<unknown>(o.sobre).map((x) => str(x).trim().slice(0, 200)).filter(Boolean).slice(0, 8);
  return { pregunta, opciones, tipo, sobre: sobre.length ? sobre : undefined };
}

/** Log uniforme de las degradaciones, para poder ver en prod qué tipea mal cada modelo. */
export const avisoSaneo = (donde: string) => (motivo: string): void => {
  console.warn(`[preguntas] ${donde}: ${motivo}`);
};

// ── El contrato que se le explica a los modelos ───────────────────────────────
// UN texto, importado por TODOS los prompts que escriben preguntas. Antes cada
// uno tenía su propia versión —cinco copias, cada una con reglas distintas— y la
// de reuniones ni siquiera definía qué era una `escala`, pero la ofrecía en el
// enum. Un modelo al que le ofrecen un valor sin explicárselo lo usa de comodín.

/** Catálogo de tipos + reglas de coherencia. Va en el system de cada generador. */
/**
 * El atajo «sin fecha» que TODA pregunta de fecha ofrece. Vive acá y no en el
 * componente porque lo necesitan los dos: el renderer para pintarlo una vez, y el
 * saneo para sacarlo de lo que mandó el modelo. Copiado en los dos lados, el día que
 * cambie el texto vuelven a salir dos filas distintas que significan lo mismo.
 */
/** Comparable: sin acentos, sin mayúsculas, sin puntuación ni espacios de más. */
const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim();

export const SIN_FECHA = 'Todavía no hay fecha';

/** Sin repetidos, ignorando acentos, mayúsculas y espacios de más. Dos opciones que
 *  se leen igual son una sola: el usuario no puede elegir «la segunda». */
export function dedupOpciones(ops: string[]): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const o of ops) {
    const k = norm(o);
    if (!k || vistas.has(k)) continue;
    vistas.add(k);
    out.push(o);
  }
  return out;
}

export const CONTRATO_TIPOS_PREGUNTA = `TIPO Y OPCIONES — TIENEN QUE SER COHERENTES ENTRE SÍ. Es donde más se falla, y una pregunta incoherente es una pregunta que el dueño no puede contestar:
· "opcion" → una sola respuesta, excluyente. OBLIGATORIO: 2 a 6 opciones cortas y concretas.
· "multi" → pueden valer VARIAS a la vez. OBLIGATORIO: 2 a 6 opciones. NO agregues "Todas" ni "Ambas": para eso tilda varias.
· "comparacion" → enfrentar DOS ítems para ver cuál pesa más. OBLIGATORIO: EXACTAMENTE 2 opciones, y cada una es uno de los ítems.
· "fecha" → **para todo "¿para cuándo?", "¿qué fecha?", "¿hay deadline?"**. El dueño ve un CALENDARIO. Podés sumar 2-4 "opciones" como atajos ("Esta semana", "Este mes", "Todavía no hay fecha"), pero no hacen falta.
· "escala" → intensidad de 1 a 5, y NADA MÁS. NO lleva opciones: el dueño ve los números pelados. Por eso la pregunta TIENE que decir qué significan los dos extremos, dentro del enunciado mismo: "¿Qué tan firme es esa fecha? (1 = es una idea, 5 = ya está comprometida con el cliente)".
· "texto" → un campo abierto. ⛔⛔ **CASI NUNCA.** La regla del dueño es NUNCA campos abiertos: un textarea vacío es la pregunta que más se saltea. Usalo solo si de verdad no existe ningún otro campo que la conteste, y antes de usarlo intentá dos veces convertirla en "opcion" o en "fecha". Si mandás cualquier otro tipo sin las opciones que ese tipo exige, la pregunta **se descarta entera** — no se convierte en un campo abierto.

⛔ NUNCA uses "escala" para preguntar CUÁNDO ni CUÁNTO. "¿Cuál es el deadline?" con botones del 1 al 5 no se puede contestar: el 3 no es una fecha. Si preguntás cuándo, el tipo es "fecha"; si preguntás cuánto, dale opciones con rangos concretos.
⛔ Una "escala" sin los extremos explicados en el enunciado es una pregunta muerta.
⛔ Una "opcion", "multi" o "comparacion" SIN opciones no se puede contestar: el dueño ve el texto y ningún botón. Si no se te ocurren opciones concretas, cambiá la pregunta hasta que se te ocurran, o no la hagas.

⛔⛔ CADA OPCIÓN TIENE QUE SER UNA RESPUESTA POSIBLE A LA PREGUNTA. Leé tu enunciado y leé tus opciones: si al elegir una la frase no queda contestada, está mal.
  MAL (pasó de verdad): "¿los cinco grupos son fijos o hay que validar si algún módulo no encaja?" con opciones ["CRM", "Chats", "Plan", "Dashboard"]. El enunciado es "¿A o B?" y abajo hay una lista de sustantivos: ninguna opción lo contesta.
  BIEN: o las opciones son las dos alternativas ("Son fijos" / "Hay que revisarlos"), o cambiás el enunciado para que la lista SÍ lo conteste ("¿Qué módulos no encajan?", tipo multi).
  Nunca dejes un enunciado binario con una lista de nombres abajo.`;

/** La forma exacta del JSON. Incluye el enum COMPLETO, sin valores sin explicar. */
export const JSON_PREGUNTAS = `Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown) con esta forma EXACTA:
{ "preguntas": [ { "pregunta": "<corta y concreta, sobre un HECHO>", "tipo": "opcion|multi|fecha|escala|comparacion|texto", "opciones": ["...", "..."], "sobre": ["<título exacto de cada tarea de la que habla>"] } ] }
Si no hace falta ninguna, { "preguntas": [] }.`;

// ── `sobre`: de qué tarea habla la pregunta ───────────────────────────────────

/** Palabras significativas, sin acentos y en minúscula, recortadas a la raíz. El
 *  recorte a 6 letras es lo que hace que «capacitación» y «Capacitar» sean la misma
 *  palabra, que es exactamente el caso que hacía falta reconocer. */
const raices = (s: string): Set<string> => new Set(
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9ñ ]/gi, ' ').split(/\s+/)
    .filter((w) => w.length >= 4 && !VACIAS.has(w))
    .map((w) => w.slice(0, 6)),
);
const VACIAS = new Set(['para', 'como', 'cual', 'cuales', 'esta', 'este', 'esto', 'esos', 'esas', 'todo', 'toda', 'todos', 'todas', 'hacer', 'tiene', 'tener', 'sobre', 'entre', 'desde', 'hasta', 'pero', 'porque', 'cuando', 'donde', 'quien', 'nueva', 'nuevo', 'otro', 'otra', 'algun', 'alguna', 'mismo', 'misma', 'mako', 'maco']);

const cuantoComparten = (pregunta: string, titulo: string): number => {
  const t = raices(titulo);
  let n = 0;
  for (const w of raices(pregunta)) if (t.has(w)) n++;
  return n;
};

/**
 * Corrige el `sobre` que mandó el modelo: lo mapea al título REAL del lote y, si
 * apuntó a una tarea que no tiene NADA que ver con lo que pregunta, lo re-apunta a
 * la que sí.
 *
 * El caso que lo motivó, verificado en prod (borrador propmskgpno0rxldp): la
 * pregunta «¿Cuál es el presupuesto asignado para la capacitación del equipo?»
 * salió con el chip «Rediseñar estructura de funnels en Maco…», cuando la tercera
 * tarea del mismo lote era «Capacitar al equipo en la nueva estructura de funnels y
 * productos». La pregunta era pertinente; el chip la hacía leer como una pregunta
 * al azar, que es la mitad de por qué «las preguntas no tienen sentido».
 *
 * Conservador a propósito: solo re-apunta cuando el título citado no comparte NI UNA
 * palabra con la pregunta y hay otro que comparte al menos dos. Un chip equivocado
 * es malo, pero uno corregido con criterio flojo es peor.
 */
export function apuntarSobre(pregunta: string, sobre: string[] | undefined, titulos: string[]): string[] | undefined {
  if (!titulos.length) return sobre?.length ? sobre : undefined;
  // El modelo suele devolver la línea entera que le pasamos ("3. Título — detalle"),
  // así que la cita se mapea al título real por igualdad o por contención.
  const alTitulo = (cita: string): string | null => {
    const c = norm(cita);
    if (!c) return null;
    const exacto = titulos.find((t) => norm(t) === c);
    if (exacto) return exacto;
    return titulos.find((t) => { const n = norm(t); return n.length > 10 && (c.includes(n) || n.includes(c)); }) ?? null;
  };
  const citados = [...new Set((sobre ?? []).map(alTitulo).filter((x): x is string => !!x))];

  // ¿Alguno de los citados habla de lo que pregunta? Si sí, se respeta tal cual.
  if (citados.some((t) => cuantoComparten(pregunta, t) > 0)) return citados;

  // Ninguno comparte una sola palabra: buscamos la tarea del lote que SÍ.
  let mejor: string | null = null, mejorN = 1;   // 1 = hay que superarlo: exigimos 2+
  for (const t of titulos) {
    const n = cuantoComparten(pregunta, t);
    if (n > mejorN) { mejor = t; mejorN = n; }
  }
  if (mejor) {
    if (citados.length) console.warn(`[preguntas] «${pregunta.slice(0, 60)}» citaba «${citados[0].slice(0, 50)}» y habla de «${mejor.slice(0, 50)}» → re-apuntada`);
    return [mejor];
  }
  // No se pudo atribuir a ninguna: mejor SIN chip que con uno que miente.
  if (citados.length) console.warn(`[preguntas] «${pregunta.slice(0, 60)}»: el «sobre» no coincide con ninguna tarea del lote → sin chip`);
  return undefined;
}

// ── Lo que la pantalla le dice al dueño ───────────────────────────────────────

/**
 * El renglón de ayuda debajo del enunciado. Vive acá y no en cada pantalla
 * porque es parte del contrato: si el tipo cambia, la instrucción cambia con
 * él. La copia hardcodeada «Elegí una opción o escribí la tuya» se mostraba
 * incluso sobre una escala de 1 a 5, donde no hay opciones NI dónde escribir.
 */
export function ayudaDePregunta(tipo: TipoPregunta, conAtajos = false): string {
  switch (tipo) {
    case 'multi': return 'Podés elegir varias.';
    case 'escala': return 'Elegí del 1 al 5.';
    case 'fecha': return conAtajos ? 'Elegí una fecha, un atajo, o dejalo sin fecha.' : 'Elegí la fecha, o dejalo sin fecha si todavía no hay.';
    case 'texto': return 'Escribí tu respuesta.';
    case 'comparacion': return '¿Cuál de los dos pesa más?';
    default: return 'Elegí una opción o escribí la tuya.';
  }
}
