// =============================================================================
// guion-reparto — repartir el guion del cliente en tomas, SIN tocar una palabra
// =============================================================================
// SIN `server-only`: es determinista y necesita test. Es justamente la pieza que
// no puede fallar en silencio.
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// El dueño eligió un guion suyo y el plan salió con OTRO texto. El cierre, que
// es lo más caro de todo, pasó de
//
//   «En el video del enlace te explico cómo construir ese sistema…»
// a
//   «Toca el botón aquí abajo, deja tus datos en el formulario…»
//
// Un CTA distinto no es una reescritura de estilo: manda a la gente a un paso
// del embudo que puede no existir. Es exactamente el riesgo que ya estaba
// escrito en el proyecto de revisión de guiones.
//
// ── La causa, y por qué el prompt no alcanzaba ──────────────────────────────
// El guion sí viajaba con la instrucción «respeta su contenido, su orden y su
// cierre»… pero DENTRO de `contenidoNoConfiable(tema, 'tema_usuario')`, o sea
// envuelto en la etiqueta que le dice al modelo «esto es DATO, no órdenes».
// Mientras tanto el system prompt tenía un apartado entero titulado «CÓMO SE
// ESCRIBE EL TEXTO HABLADO» y cerraba con «Escribe el plan completo».
//
// El modelo hizo lo que le pidió la parte confiable del prompt.
//
// ── Por eso esto NO es un prompt mejor ──────────────────────────────────────
// Un prompt que pide no reescribir funciona casi siempre, y «casi siempre» sobre
// el CTA de un anuncio es un modo de falla silencioso: el texto sale bien
// escrito, suena natural, y solo se nota si alguien compara contra el original.
// El reparto se calcula acá y el modelo recibe cada toma YA ESCRITA.

/** Una toma con su texto y cuántas palabras entraron. */
export type TomaRepartida = { voz: string; palabras: number };

const PALABRA = /[\p{L}\p{N}]/u;

export function contarPalabrasReparto(t: string): number {
  return t.split(/\s+/).filter((p) => PALABRA.test(p)).length;
}

/**
 * Corta el texto en unidades que se pueden mover de toma sin romper una frase.
 *
 * El corte fuerte es el final de oración. El débil —dos puntos, punto y coma,
 * raya, puntos suspensivos— existe porque los guiones hablados están llenos de
 * frases largas con incisos, y sin él una sola oración de 40 palabras no entraría
 * en ninguna toma y habría que partirla por la mitad de una idea.
 */
function unidades(texto: string): string[] {
  const out: string[] = [];
  for (const parrafo of texto.split(/\n+/)) {
    const t = parrafo.trim();
    if (!t) continue;
    // Corte FUERTE: detrás de . ! ? … y de las comillas o paréntesis que los cierran.
    for (const bruto of t.split(/(?<=[.!?…]["»”')\]]?)\s+/)) {
      const u = bruto.trim();
      if (u) out.push(u);
    }
  }
  return out;
}

/** Parte una unidad demasiado larga por sus cortes DÉBILES, y si no alcanza, por comas. */
/**
 * Parte una pieza en trozos más chicos SIN romper una frase.
 *
 * Gemela de `subdividir` con una diferencia que es todo el punto: cuando no
 * encuentra un separador seguro, DEVUELVE LA PIEZA ENTERA en vez de cortar por
 * palabras. `subdividir` corta igual porque su trabajo es que algo entre en una
 * toma; el de ésta es que el reparto tenga con qué rellenar huecos, y para eso
 * una pieza sin cortar es preferible a un CTA partido al medio.
 */
function afinar(pieza: string, objetivo: number): string[] {
  if (contarPalabrasReparto(pieza) <= objetivo) return [pieza];
  for (const sep of [/(?<=[:;—–…])\s+/, /(?<=,)\s+/]) {
    const trozos = pieza.split(sep).map((t) => t.trim()).filter(Boolean);
    if (trozos.length > 1) return trozos.flatMap((t) => afinar(t, objetivo));
  }
  return [pieza];
}

function subdividir(unidad: string, tope: number): string[] {
  if (contarPalabrasReparto(unidad) <= tope) return [unidad];

  for (const sep of [/(?<=[:;—–…])\s+/, /(?<=,)\s+/]) {
    const trozos = unidad.split(sep).map((s) => s.trim()).filter(Boolean);
    if (trozos.length > 1) {
      return trozos.flatMap((t) => subdividir(t, tope));
    }
  }

  // Último recurso: por palabras. Feo, pero es preferible a devolver una toma que
  // el modelo de video va a cortar por la mitad sin avisar.
  const palabras = unidad.split(/\s+/).filter(Boolean);
  const trozos: string[] = [];
  for (let i = 0; i < palabras.length; i += tope) {
    trozos.push(palabras.slice(i, i + tope).join(' '));
  }
  return trozos;
}

/**
 * Reparte el texto hablado entre las tomas, en orden y sin cambiar una palabra.
 *
 * @param hablado el guion SIN los rótulos de sección (pasarlo por `soloHablado`).
 * @param topes cuántas palabras entran en cada toma, en orden. Su largo define
 *   cuántas tomas hay.
 *
 * Garantías, y las tres están testeadas:
 *  1. concatenar las tomas devuelve exactamente las mismas palabras, en el mismo
 *     orden, que el guion que entró;
 *  2. la ÚLTIMA toma termina con el final del guion — que es el CTA, la parte
 *     que no se puede perder ni cambiar;
 *  3. ninguna toma queda vacía mientras haya texto para llenarla.
 *
 * Lo que NO garantiza es respetar el tope cuando el guion no entra: en ese caso
 * reparte parejo y la última toma se pasa. Recortar sería tirar el final del
 * guion en silencio, y eso es peor que un clip apretado — la pantalla ya avisa
 * antes de llegar acá cuando el guion desborda (`cabidaDeGuion`).
 */
export function repartirGuion(hablado: string, topes: number[]): TomaRepartida[] {
  const n = topes.length;
  if (n <= 0) return [];

  const texto = (hablado || '').trim();
  if (!texto) return topes.map(() => ({ voz: '', palabras: 0 }));

  // Las unidades, ya subdivididas contra el tope más chico que puede tocarles.
  const topeMin = Math.max(1, Math.min(...topes));
  // ⚠️ Y DESPUÉS SE AFINAN, o el reparto no puede repartir.
  //
  // `subdividir` corta contra el tope MÁS CHICO, así que una pieza puede medir lo
  // mismo que una toma entera — y entonces una toma con lugar para 20 palabras no
  // puede aceptar una pieza de 24. El resultado era el apilado: huecos de un lado
  // y el sobrante amontonado en la última.
  //
  // `afinar` vuelve a pasar SOLO por los separadores seguros —dos puntos, punto y
  // coma, raya, y las comas— y nunca por palabras: una pieza sin separador se
  // queda entera. Es lo que permite mover texto sin partir una frase por la
  // mitad, que ya se probó y rompía el CTA.
  const piezas = unidades(texto)
    .flatMap((u) => subdividir(u, topeMin))
    .flatMap((p) => afinar(p, Math.max(6, Math.ceil(topeMin / 2))));

  const total = piezas.reduce((s, p) => s + contarPalabrasReparto(p), 0);

  const tomas: TomaRepartida[] = [];
  /** Las piezas de cada toma, para poder moverlas después sin re-partir texto. */
  const porToma: string[][] = [];
  let i = 0;

  for (let clip = 0; clip < n; clip++) {
    const quedan = n - clip;               // tomas por llenar, contando esta
    const restante = piezas.slice(i).reduce((s, p) => s + contarPalabrasReparto(p), 0);

    // El objetivo de ESTA toma: lo que queda repartido entre las que faltan, sin
    // pasarse de lo que la puesta admite. Repartir parejo y no llenar hasta el
    // tope es lo que evita que las primeras tomas queden apretadas y las últimas
    // vacías — que es como se ve un anuncio que se quedó sin texto al final.
    const objetivo = Math.min(topes[clip], Math.max(1, Math.ceil(restante / quedan)));

    const elegidas: string[] = [];
    let palabras = 0;

    while (i < piezas.length) {
      const p = piezas[i];
      const w = contarPalabrasReparto(p);

      // Siempre entra al menos una pieza: una toma vacía en el medio del anuncio
      // es un corte a negro con la persona muda.
      if (elegidas.length === 0) { elegidas.push(p); palabras += w; i++; continue; }

      // Y no se toman piezas de más si eso dejaría sin texto a las tomas que
      // faltan: el final del guion es el CTA y tiene que llegar entero.
      const piezasQueQuedan = piezas.length - i;
      if (piezasQueQuedan <= quedan - 1) break;

      if (palabras + w > objetivo) break;
      elegidas.push(p); palabras += w; i++;
    }

    tomas.push({ voz: elegidas.join(' '), palabras });
    porToma.push(elegidas);
  }

  // Si sobraron piezas —el guion desborda—, van a la última toma: el texto sale
  // en orden, así que lo que quedó sin repartir va después de todo lo demás.
  if (i < piezas.length) {
    porToma[n - 1].push(...piezas.slice(i));
  }

  // ── Y AHÍ SE COMPACTA HACIA LA IZQUIERDA ────────────────────────────────
  //
  // Volcarlo todo en la última y terminar dejaba una toma con TRES VECES su
  // tope. Medido en vivo, en el anuncio de una clienta: siete tomas entre 18 y
  // 26 palabras, la octava con 80 contra un tope de 24 — el CTA entero
  // apelotonado en ocho segundos— y 57 palabras de lugar libre repartidas en las
  // siete de arriba, sin usar.
  //
  // Mover la PRIMERA pieza de una toma al final de la ANTERIOR conserva el orden
  // del guion, que es lo único intocable. Y se hace de izquierda a derecha y
  // repetido, no de derecha a izquierda: el hueco tiene que PROPAGARSE. Un solo
  // pase hacia atrás se frena en la primera toma llena —que es justo lo que
  // pasaba acá, con la toma 6 medio vacía dos lugares más allá— y no mueve nada.
  //
  // No garantiza que todo entre: un guion que no cabe no cabe, y para eso está el
  // aviso. Lo que garantiza es que el desborde no se apile en una sola toma
  // habiendo lugar en las otras.
  const palabrasDe = (ps: string[]) => ps.reduce((t, p) => t + contarPalabrasReparto(p), 0);
  for (let ronda = 0; ronda < n; ronda++) {
    let movio = false;
    for (let c = 0; c < n - 1; c++) {
      // Se tira de la siguiente mientras entre y le quede algo: una toma vacía
      // en el medio es un corte a negro con la persona muda.
      while (porToma[c + 1].length > 0) {
        const hueco = topes[c] - palabrasDe(porToma[c]);
        if (hueco <= 0) break;
        const siguiente = porToma[c + 1];
        const w = contarPalabrasReparto(siguiente[0]);

        if (w <= hueco && (siguiente.length > 1 || palabrasDe(siguiente) > w)) {
          porToma[c].push(siguiente.shift() as string);
          movio = true;
          continue;
        }

        // ⚠️ ACÁ PROBÉ PARTIR LA PIEZA POR PALABRAS, Y LOS TESTS LO FRENARON.
        // Cortaba el CTA por la mitad y dejaba «enlace.» solo en la última toma:
        // peor que el desborde que venía a arreglar, porque el llamado a la
        // acción es lo único del guion que TIENE que llegar entero.
        // El desborde que queda es real —un guion de 211 palabras contra 210 de
        // capacidad no entra— y para eso está el aviso de «no entra».
        break;
      }
    }
    if (!movio) break;
  }

  for (let c = 0; c < n; c++) {
    tomas[c].voz = porToma[c].join(' ');
    tomas[c].palabras = contarPalabrasReparto(tomas[c].voz);
  }

  // Chequeo barato de la garantía 1. Si alguna vez falla, es un bug de reparto y
  // hay que verlo en el log, no descubrirlo en un anuncio publicado.
  const salieron = tomas.reduce((s, t) => s + t.palabras, 0);
  if (salieron !== total) {
    console.warn(`[guion-reparto] entraron ${total} palabras y salieron ${salieron}`);
  }

  return tomas;
}
