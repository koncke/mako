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
/**
 * El mejor reparto posible de `piezas` (en orden) entre `topes`, exacto.
 *
 * ⚠️ ESTO REEMPLAZA A UN RELLENO GOLOSO MÁS TRES RONDAS DE COMPACTACIÓN, y la
 * razón es que las heurísticas no podían resolver el caso real.
 *
 * Medido en el anuncio del dueño (01/09/2026), 190 palabras contra 192 de
 * capacidad —o sea que ENTRA— y aun así:
 *
 *     toma  tope  palabras
 *       1     30      20        41 palabras de lugar libre arriba…
 *       4     30      26
 *       6     24      20
 *       7     24      63        …y el triple del tope en la última
 *
 * La compactación movía la primera pieza de una toma a la anterior sólo si
 * entraba en el hueco. Con piezas de 24 palabras —una oración sin comas no se
 * puede afinar más— y huecos de 4, no había ni un movimiento legal. El goloso
 * dejaba los huecos y la compactación no podía cerrarlos: dos mecanismos
 * correctos que juntos no llegaban a la respuesta.
 *
 * Y no hace falta una heurística mejor, porque el problema es CHICO y tiene
 * solución exacta: partir una secuencia en K grupos CONTIGUOS es programación
 * dinámica de toda la vida. Con ~15 piezas y 7 tomas son microsegundos.
 *
 * Se minimiza, en este orden:
 *  1. el DESBORDE MÁXIMO de una toma — porque lo que arruina un anuncio es una
 *     toma con el triple de texto, no que el total esté 5 palabras arriba;
 *  2. a igual desborde máximo, el desborde TOTAL;
 *  3. a igual desborde, el desbalance — para que no queden tomas casi vacías al
 *     lado de tomas al tope.
 *
 * Lo que NO hace, a propósito: partir una pieza. El orden del guion y la
 * integridad de cada frase son intocables — partir por palabras ya se probó y
 * dejaba «enlace.» solo en la última toma.
 */
function repartoExacto(pesos: number[], topes: number[]): number[][] {
  const m = pesos.length;
  const n = topes.length;
  if (n === 0) return [];
  if (m === 0) return topes.map(() => []);

  const suma: number[] = [0];
  for (let k = 0; k < m; k++) suma.push(suma[k] + pesos[k]);

  // costo[j][i] = mejor coste usando las tomas 0..j para las piezas 0..i-1
  const INF = Number.POSITIVE_INFINITY;
  const peor: number[][] = Array.from({ length: n }, () => new Array(m + 1).fill(INF));
  const tot: number[][] = Array.from({ length: n }, () => new Array(m + 1).fill(INF));
  const desb: number[][] = Array.from({ length: n }, () => new Array(m + 1).fill(INF));
  const corte: number[][] = Array.from({ length: n }, () => new Array(m + 1).fill(-1));

  // ⚠️ Se PERMITE una toma vacía en el DP (desde `i` a `i`) y se penaliza fuerte
  // con el desbalance, en vez de prohibirla. Prohibirla haría el problema
  // infactible cuando hay menos piezas que tomas, y ahí no hay respuesta buena:
  // hay que elegir la menos mala. La red de más abajo se ocupa de que ninguna
  // quede muda si hay con qué llenarla.
  for (let j = 0; j < n; j++) {
    for (let i = 0; i <= m; i++) {
      const desde = j === 0 ? 0 : -1;
      if (j === 0) {
        const w = suma[i] - suma[desde];
        const over = Math.max(0, w - topes[0]);
        peor[0][i] = over;
        tot[0][i] = over;
        desb[0][i] = Math.abs(topes[0] - w);
        corte[0][i] = 0;
        continue;
      }
      for (let k = 0; k <= i; k++) {
        if (peor[j - 1][k] === INF) continue;
        const w = suma[i] - suma[k];
        const over = Math.max(0, w - topes[j]);
        const p = Math.max(peor[j - 1][k], over);
        const t = tot[j - 1][k] + over;
        const d = desb[j - 1][k] + Math.abs(topes[j] - w);
        // ⚠️ EL EMPATE SE ROMPE HACIA ADELANTE, con `<=` en el último criterio.
        //
        // Con un guion de una sola frase y tres tomas, las dos opciones —ponerla
        // en la primera o en la última— dan exactamente el mismo desborde (0) y
        // el mismo desbalance (67). El DP tenía que elegir una, y con `<` elegía
        // el primer `k` que empataba, que es el que deja el grupo final MÁS
        // GRANDE: o sea la frase al final y dos tomas mudas adelante.
        //
        // Un anuncio se lee de arriba abajo: si hay texto de sobra para una sola
        // toma, va en la primera. `k` es donde ARRANCA el último grupo, así que
        // un `k` más grande deja menos texto al final y lo empuja hacia adelante
        // — y con `<=` gana el último que empata, que es el más grande.
        //
        // Lo cazó un test que ya existía. Vale como recordatorio de que un
        // criterio de desempate no es un detalle: decide el 100% de los casos
        // donde el óptimo no es único.
        if (p < peor[j][i]
          || (p === peor[j][i] && t < tot[j][i])
          || (p === peor[j][i] && t === tot[j][i] && d <= desb[j][i])) {
          peor[j][i] = p; tot[j][i] = t; desb[j][i] = d; corte[j][i] = k;
        }
      }
    }
  }

  const grupos: number[][] = Array.from({ length: n }, () => []);
  let fin = m;
  for (let j = n - 1; j >= 0; j--) {
    const ini = corte[j][fin];
    if (ini < 0) break;
    for (let k = ini; k < fin; k++) grupos[j].push(k);
    fin = ini;
  }
  return grupos;
}

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

  // ── EL REPARTO, EXACTO ────────────────────────────────────────────────
  //
  // Antes acá vivían un relleno goloso y tres rondas de compactación. Los dos
  // eran correctos y juntos no llegaban: ver `repartoExacto` para el caso real
  // que no podían resolver —41 palabras de lugar libre arriba y el triple del
  // tope en la última, sobre un guion que ENTRABA—.
  const pesos = piezas.map((p) => contarPalabrasReparto(p));
  const grupos = repartoExacto(pesos, topes);
  const porToma: string[][] = grupos.map((g) => g.map((k) => piezas[k]));

  // ⚠️ LA RED CONTRA LA TOMA MUDA. El DP puede dejar una vacía cuando hay menos
  // piezas que tomas —ahí no hay respuesta buena, hay que elegir la menos mala—
  // y una toma sin texto es un corte a negro con la persona callada, que es peor
  // que un clip apretado. Se prefiere una toma corta a una muda.
  for (let ronda = 0; ronda < n; ronda++) {
    let arreglo = false;
    for (let c = 0; c < n; c++) {
      if (porToma[c].length > 0) continue;
      const donante = c > 0 && porToma[c - 1].length > 1 ? c - 1
        : c + 1 < n && porToma[c + 1].length > 1 ? c + 1 : -1;
      if (donante < 0) continue;
      // Del anterior se toma su ULTIMA pieza; del siguiente, su PRIMERA. Las dos
      // conservan el orden del guion, que es lo unico intocable.
      porToma[c].push(donante === c - 1 ? porToma[donante].pop() as string : porToma[donante].shift() as string);
      arreglo = true;
    }
    if (!arreglo) break;
  }

  const tomas: TomaRepartida[] = topes.map(() => ({ voz: '', palabras: 0 }));
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
