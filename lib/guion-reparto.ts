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
  const piezas = unidades(texto).flatMap((u) => subdividir(u, topeMin));

  const total = piezas.reduce((s, p) => s + contarPalabrasReparto(p), 0);

  const tomas: TomaRepartida[] = [];
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
  }

  // Si sobraron piezas —el guion desborda—, van todas a la última toma. Se
  // prefiere una toma larga a un guion mutilado.
  if (i < piezas.length) {
    const resto = piezas.slice(i);
    const ultima = tomas[n - 1];
    ultima.voz = [ultima.voz, ...resto].filter(Boolean).join(' ');
    ultima.palabras = contarPalabrasReparto(ultima.voz);
  }

  // Chequeo barato de la garantía 1. Si alguna vez falla, es un bug de reparto y
  // hay que verlo en el log, no descubrirlo en un anuncio publicado.
  const salieron = tomas.reduce((s, t) => s + t.palabras, 0);
  if (salieron !== total) {
    console.warn(`[guion-reparto] entraron ${total} palabras y salieron ${salieron}`);
  }

  return tomas;
}
