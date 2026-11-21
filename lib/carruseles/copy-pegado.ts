// =============================================================================
// El COPY PEGADO de un carrusel: una parte por lámina, palabra por palabra (PURO; 20/11/2026)
// =============================================================================
// La llamada con Leila (20/11/2026, Fathom 205366178, 00:51:51–00:52:17): «le pegué el copy que quería… y después las que salen
// de, digamos, el máximo que tenía el template, ya directamente hizo lo que…». Martín: «¿Se lo inventó también?». Sí.
//
// Lo que pasó, medido en producción (ws 11, diseño 14331b1a): Leila pegó en «Editar» un copy de 10 láminas («Slide 1, portada /
// Tu negocio te está consumiendo… / (abajo: Sígueme para más)», «Slide 2 / LA REVELACIÓN / …»). En la caja del guiado lo escrito
// se APLANABA (`\s+` → un espacio) y se cortaba en 300 letras (`TOPE_LIBRE`), y después en 600 como «tema» (`TOPE_TEMA`). A la IA
// le llegaban la portada y media lámina 2 como un tema para reescribir: salió «1. Simplifica la operación», «2. Pon a prueba más
// ideas cada semana»… que Leila no escribió. Y como la referencia tenía 7 láminas, la versión tuvo 7 (`total` topado al largo
// de la referencia, replica-servidor.ts).
//
// LA REGLA: un copy pegado NO es un tema. Va TAL CUAL, una parte por lámina, y la cantidad de láminas la decide el copy:
//   · `partesDelCopy` lo parte por sus marcas («Slide 3», «Lámina 3», «Diapositiva 3», «3/10», una línea «---»), sin tocar una
//     letra de lo que va adentro. El pie que el dueño marca como «(abajo: Sígueme para más)» va aparte: es el texto chico de abajo;
//   · `laminaParaCadaParte` dice con el diseño de QUÉ lámina del original va cada parte: la portada con la portada, el cierre con
//     el cierre, y las del medio con las del medio, en orden (si el copy tiene más, se repiten las del medio: nunca una página en
//     blanco ni la portada en el medio);
//   · `repartirEnLosTextos` pone los renglones de cada parte en los textos de su lámina, en orden de lectura. Lo pone el CÓDIGO: la
//     IA lo intenta (el prompt le da cada parte) y si lo que escribió no es, renglón por renglón, lo del copy, no se usa. Un dato
//     exacto que pasa por un LLM deja de ser exacto (la palabra del CTA, 19/11/2026: ./replica.ts → `palabraDelTema`).
// =============================================================================

/** Lo más largo de un copy que viaja (un carrusel de 12 láminas con párrafos entra holgado). */
export const TOPE_COPY = 8_000;

/** Una parte del copy: sus renglones, tal cual, y el pie que el dueño marcó «(abajo: …)», si marcó uno. */
export type ParteDelCopy = { lineas: string[]; abajo: string | null };

/** «Slide 3», «Lámina 3:», «Diapositiva 3 –», «Página 3.», con lo que siga en el mismo renglón. */
const MARCA = /^\s*[#*>•\-–—]*\s*(?:slide|l[áa]mina|diapositiva|p[áa]gina)\s*(\d{1,2})\b\s*[:.,)\-–—]*\s*(.*)$/i;
/** «3/10» o «3 / 10» solo en su renglón. */
const MARCA_FRACCION = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/;
/** Un separador: «---», «***», «___» o «===» solos en su renglón. */
const SEPARADOR = /^\s*(?:-{3,}|\*{3,}|_{3,}|={3,})\s*$/;
/** El pie de la lámina, marcado por el dueño: «(abajo: Sígueme para más)», «(pie: …)». */
const PIE = /^\s*\(\s*(?:abajo|debajo|pie|al pie|footer)\s*:\s*(.+?)\s*\)\s*$/i;
/** Lo que sigue a «Slide 1,» cuando es sólo el NOMBRE de la lámina, no su texto («Slide 1, portada»; «Slide 10, cierre»). */
const NOMBRE_DE_LAMINA = /^(?:la\s+)?(?:portada|cierre|cover|gancho|hook|final|cta|intro|introducci[óo]n|contexto|desarrollo)\s*[:.]?$/i;

/** Un renglón limpio: sin espacios de más en las puntas (adentro, tal cual). */
const renglon = (s: string): string => s.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, '');

/**
 * Las partes de un copy pegado, una por lámina, o `null` si no es un copy de láminas (un tema, una frase, un pedido): hacen falta
 * dos partes o más, separadas por sus marcas o por «---». Lo de antes de la primera marca (un «Este es mi copy:») no es de ninguna
 * lámina. Los renglones de cada parte van TAL CUAL (sólo se sacan los vacíos y los espacios de las puntas).
 */
export function partesDelCopy(texto: string | null | undefined): ParteDelCopy[] | null {
  const lineas = String(texto ?? '').replace(/\r\n?/g, '\n').split('\n');
  const conMarcas = lineas.some((l) => MARCA.test(l) || MARCA_FRACCION.test(l));
  const conSeparador = lineas.some((l) => SEPARADOR.test(l));
  if (!conMarcas && !conSeparador) return null;
  const partes: Array<{ lineas: string[]; abajo: string | null }> = [];
  let actual: { lineas: string[]; abajo: string | null } | null = conMarcas ? null : { lineas: [], abajo: null };
  const cerrar = () => { if (actual && (actual.lineas.length || actual.abajo)) partes.push(actual); };
  for (const cruda of lineas) {
    const m = MARCA.exec(cruda);
    if (m || MARCA_FRACCION.test(cruda) || SEPARADOR.test(cruda)) {
      // Con marcas, un «---» entre dos láminas no abre otra (ya la abre la marca siguiente).
      if (!m && !MARCA_FRACCION.test(cruda) && conMarcas) continue;
      cerrar();
      actual = { lineas: [], abajo: null };
      const resto = m ? renglon(m[2] ?? '') : '';
      if (resto && !NOMBRE_DE_LAMINA.test(resto)) actual.lineas.push(resto);
      continue;
    }
    if (!actual) continue; // antes de la primera marca
    const l = renglon(cruda);
    if (!l) continue;
    const pie = PIE.exec(l);
    if (pie) { actual.abajo = pie[1]; continue; }
    actual.lineas.push(l);
  }
  cerrar();
  return partes.length >= 2 ? partes : null;
}

/** ¿Lo escrito es un copy de láminas? (lo que decide si va como copy o como tema). */
export const esCopyDeLaminas = (texto: string | null | undefined): boolean => partesDelCopy(texto) != null;

/**
 * Con el diseño de qué lámina del original (0 a n-1) va cada parte del copy (p partes). La primera con la portada; la última con
 * el cierre; las del medio con las del medio, en orden, y si el copy tiene más, se vuelve a empezar por la segunda. Con un original
 * de dos láminas, lo del medio va con el diseño del cierre (el de la portada es para un gancho, no para un párrafo).
 */
export function laminaParaCadaParte(p: number, n: number): number[] {
  if (p <= 0 || n <= 0) return [];
  if (n === 1) return Array.from({ length: p }, () => 0);
  return Array.from({ length: p }, (_, k) => {
    if (k === 0) return 0;
    if (k === p - 1) return n - 1;
    if (n === 2) return 1;
    return 1 + ((k - 1) % (n - 2));
  });
}

/** Un texto de la lámina donde puede ir un renglón del copy: su papel y dónde está (fracciones de la lámina). */
export type LugarDeTexto = { rol: string; x: number; y: number; tamano?: number };

/** Los papeles que nunca reciben el copy: la firma (el @, el nombre del negocio) es del marco. */
const NO_RECIBE = new Set(['firma']);

/** Lo del marco que es igual en cualquier lámina: «02 / 06», «© 2026», un @. */
export const esDelMarco = (texto: string): boolean => /^\s*(©\s*\d{4}|\d{1,2}\s*\/\s*\d{1,2}|@[\w.]+)\s*$/.test(texto ?? '');

/** El orden de lectura: de arriba abajo y, en la misma franja (un 3 % del alto), de izquierda a derecha. */
export function ordenDeLectura(lugares: readonly LugarDeTexto[]): number[] {
  return lugares.map((_, i) => i).sort((a, b) => {
    const dy = lugares[a].y - lugares[b].y;
    return Math.abs(dy) > 0.03 ? dy : lugares[a].x - lugares[b].x;
  });
}

/**
 * Los renglones de una parte en los lugares de su lámina (`lugares`, los textos de la IA: el diseño), uno por lugar, en orden de
 * lectura. Devuelve un texto por lugar, en el MISMO orden de `lugares` (`''` = ese lugar queda sin texto; `null` = ese lugar no
 * recibe el copy y queda como está: la firma, el «02 / 06»).
 *   · El pie «(abajo: …)» va al último lugar de abajo (más abajo del 75 % del alto) si hay otro arriba; si no, es un renglón más.
 *   · Con más renglones que lugares, los que sobran van juntos (con «\n») en el último.
 *   · Con menos, los lugares de más quedan vacíos.
 * Lo que la IA escribió en cada lugar (`escrito`) se respeta SÓLO si cada uno es, tal cual, renglones seguidos del copy y entre
 * todos están todos: así el titular cae en el titular cuando la IA lo ubicó bien, sin creerle una palabra.
 */
export function repartirEnLosTextos(parte: ParteDelCopy, lugares: readonly LugarDeTexto[], o: { escrito?: ReadonlyArray<string | null | undefined>; noRecibe?: ReadonlyArray<boolean> } = {}): Array<string | null> {
  const out: Array<string | null> = lugares.map(() => null);
  const reciben = ordenDeLectura(lugares).filter((i) => !NO_RECIBE.has(lugares[i].rol) && !o.noRecibe?.[i]);
  if (!reciben.length) return out;
  let lineas = [...parte.lineas];
  let libres = [...reciben];
  if (parte.abajo) {
    const abajo = libres.length > 1 ? libres[libres.length - 1] : null;
    if (abajo != null && lugares[abajo].y >= 0.75) { out[abajo] = parte.abajo; libres = libres.slice(0, -1); }
    else lineas = [...lineas, parte.abajo];
  }
  // Lo que escribió la IA, si es el copy tal cual y en orden.
  const escrito = o.escrito ? deLaIASiEsElCopy(lineas, libres.map((i) => o.escrito?.[i] ?? '')) : null;
  if (escrito) { libres.forEach((i, k) => { out[i] = escrito[k]; }); return out; }
  libres.forEach((i, k) => {
    if (k < libres.length - 1) out[i] = lineas[k] ?? '';
    else out[i] = lineas.slice(k).join('\n');
  });
  return out;
}

/** Para comparar: sin espacios de más, sin los asteriscos del acento y sin mayúsculas (el editor puede ponerlas). */
const igualable = (s: string): string => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');

/**
 * Lo que escribió la IA en cada lugar, devuelto con los renglones EXACTOS del copy, o `null` si no es el copy: cada lugar con
 * texto tiene que ser renglones seguidos del copy (en orden) y entre todos, todos. Un lugar vacío queda vacío.
 */
function deLaIASiEsElCopy(lineas: readonly string[], escrito: readonly string[]): string[] | null {
  if (!lineas.length) return null;
  const out: string[] = [];
  let i = 0;
  for (const e of escrito) {
    const objetivo = igualable(e ?? '');
    if (!objetivo) { out.push(''); continue; }
    let j = i;
    let junto = '';
    while (j < lineas.length && igualable(junto ? `${junto} ${lineas[j]}` : lineas[j]).length <= objetivo.length) {
      junto = junto ? `${junto} ${lineas[j]}` : lineas[j];
      j++;
      if (igualable(junto) === objetivo) break;
    }
    if (j === i || igualable(junto) !== objetivo) return null;
    out.push(lineas.slice(i, j).join('\n'));
    i = j;
  }
  return i === lineas.length ? out : null;
}

/** Lo que hace falta de una plancha (./replica.ts → `PlanchaDeLamina`): dónde quedó medido cada texto. */
type BloqueMedido = { caja: { x: number; y: number; ancho: number; alto: number } } | null;
type ConBloques = { textos: ReadonlyArray<BloqueMedido> };

/**
 * La réplica con el copy del dueño: UNA lámina por parte, cada una con el diseño de su lámina del original
 * (`laminaParaCadaParte`) y los renglones de su parte en sus textos (`repartirEnLosTextos`). Con `planchas` (la réplica fiel), cada
 * lámina lleva la plancha de su original (una del medio repetida usa la misma imagen), y un texto puede crecer hacia abajo hasta
 * el texto siguiente (`altoMax`): el copy manda, no el largo del original. Lo que no recibe el copy (la firma, el «02 / 06») queda
 * como lo dejó la réplica.
 */
export function conElCopy<R extends { laminas: L[] }, L extends { textos: T[]; n?: number }, T extends { rol: string; texto: string; x: number; y: number; tamano: number; original?: string; mayus: boolean; acentos?: unknown; acento?: unknown; copy?: boolean; altoMax?: number }, P extends ConBloques>(
  r: R, partes: readonly ParteDelCopy[], o: { planchas?: ReadonlyArray<P | null> | null; alto: number; ancho: number; max?: number },
): { replica: R; planchas: Array<P | null> | null } {
  const usadas = partes.slice(0, Math.max(1, o.max ?? partes.length));
  const base = laminaParaCadaParte(usadas.length, r.laminas.length);
  const conPlanchas = !!o.planchas && o.planchas.length === r.laminas.length && o.planchas.every(Boolean);
  const laminas: L[] = [];
  const planchas: Array<P | null> = [];
  usadas.forEach((parte, k) => {
    const i = base[k];
    const original = r.laminas[i];
    const plancha = conPlanchas ? (o.planchas![i] as P) : null;
    const lugares = original.textos.map((t, j) => {
      const b = plancha?.textos[j] ?? null;
      return b ? { rol: t.rol, x: b.caja.x / o.ancho, y: b.caja.y / o.alto } : { rol: t.rol, x: t.x, y: t.y };
    });
    // En la réplica fiel, un texto sin lugar medido no se dibuja: no puede recibir el copy.
    const noRecibe = original.textos.map((t, j) => (conPlanchas && !plancha!.textos[j]) || esDelMarco(t.texto) || (!!t.original && esDelMarco(t.original) && !t.texto));
    // Lo que escribió la IA vale para la PRIMERA parte que va con esa lámina (el prompt le dio ésa); las repetidas, por código.
    const textos = repartirEnLosTextos(parte, lugares, { escrito: base.indexOf(i) === k ? original.textos.map((t) => t.texto) : undefined, noRecibe });
    const nueva = { ...original, textos: original.textos.map((t, j) => {
      const va = textos[j];
      if (va == null) return { ...t };
      const sinAcento = { ...t } as T;
      delete sinAcento.acentos;
      delete sinAcento.acento;
      // El copy va como lo escribió el dueño: sin pasarlo a mayúsculas (salvo que ya lo esté) y con sus cortes de renglón.
      const alto = conPlanchas ? altoHastaElSiguiente(plancha!, j, o.alto) : undefined;
      return { ...sinAcento, texto: va, mayus: false, copy: true, ...(alto ? { altoMax: alto } : {}) };
    }) } as L;
    delete nueva.n;
    laminas.push(nueva);
    planchas.push(plancha);
  });
  return { replica: { ...r, laminas }, planchas: conPlanchas ? planchas : null };
}

/** Cuánto puede crecer hacia abajo el texto `j` de una plancha: hasta el bloque de abajo que se le cruza, o hasta el 94 % del alto. */
function altoHastaElSiguiente(p: ConBloques, j: number, H: number): number | undefined {
  const b = p.textos[j];
  if (!b) return undefined;
  const fin = b.caja.y + b.caja.alto;
  const abajo = p.textos
    .filter((c, k): c is NonNullable<BloqueMedido> => !!c && k !== j && c.caja.y >= fin - 2 && c.caja.x < b.caja.x + b.caja.ancho && b.caja.x < c.caja.x + c.caja.ancho)
    .map((c) => c.caja.y);
  const hasta = Math.min(0.94 * H, ...abajo) - Math.round(0.015 * H);
  return hasta > b.caja.y ? Math.round(hasta - b.caja.y) : undefined;
}

/** Un resumen corto para el chat: el primer renglón y cuántas láminas. */
export function resumenDelCopy(partes: readonly ParteDelCopy[]): string {
  const primero = partes[0]?.lineas[0] ?? '';
  const corto = Array.from(primero).length > 60 ? `${Array.from(primero).slice(0, 57).join('')}…` : primero;
  return `Tu copy de ${partes.length} láminas${corto ? ` («${corto}»)` : ''}`;
}
