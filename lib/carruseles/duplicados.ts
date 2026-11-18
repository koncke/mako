// =============================================================================
// carruseles/duplicados — dos partes del MISMO contenido no ocupan dos lugares de la grilla (6/11/2026)
// =============================================================================
// Pedido: «El cliente ve el mismo contenido repetido y pierde lugares de la grilla que podrían traer ejemplos nuevos». El
// reparto por variedad (./variedad.ts: como mucho 2 de la misma cuenta por tramo de 12) NO resuelve esto: reparte por CUENTA,
// y las dos partes de un mismo carrusel son de la misma cuenta pero también del mismo contenido, así que entran las dos.
//
// LA SEÑAL, MEDIBLE Y EXPLICABLE (como ./clasificar.ts: qué cubre y qué no). Dos carruseles son el mismo contenido si son del
// MISMO creador y pasa una de dos:
//   · LA SERIE NUMERADA: los dos pies traen una marca de parte («parte 2», «part 3», «pt2», «Teil 2»). Es lo que delata una
//     serie, porque los pies de las partes NO se parecen entre sí: «Part 1 broke the internet… so here's Part 2» y «You
//     thought you understood the coffee menu. Then part 3 happened» son la misma serie y no comparten ni una frase. Por eso la
//     clave es el CREADOR, no el texto. ⚠️ Con UNA excepción medida: dos partes con el MISMO número son de series DISTINTAS
//     (una serie tiene una sola parte 2), y entonces las dos se quedan. @heygurlceo tiene dos «pt 2» al mismo tiempo —apps y
//     carreras— y sin esto se comían una; es 1 de los 6 duplicados de serie de la biblioteca entera.
//   · EL MISMO PIE, LAS MISMAS LÁMINAS Y EL MISMO DÍA: la misma publicación cargada dos veces. Las tres condiciones juntas, a
//     propósito: ver abajo por qué el pie solo no alcanza.
//
// ⚠️ LO OBVIO ERA COMPARAR EL PIE, Y ESTÁ MAL (medido el 6/11/2026 sobre las 990 piezas visibles de la biblioteca). Agrupar
// por «las primeras 8 palabras de contenido del pie, del mismo creador» daba 7 grupos, y 5 eran FALSOS: lo que se repite no es
// el contenido, es el pie de fábrica del creador — su pitch fijo (@thesenuka lo pega igual en 4 carruseles distintos), su CTA
// de siempre («Comment "WIN" to get a free scaling roadmap», @hormozi, en dos carruseles de 13 y 9 láminas), su firma de
// entrada (@vilmanunez abre todos los pies con «Sígueme y haz clic en el link de la bio»), o un «Save this!» con hashtags.
// Sacarle el pedido (la oración del CTA) antes de comparar tampoco alcanza: quedan los pitch y las firmas. Lo único que
// sobrevivió a la medición es el pie ENTERO, palabra por palabra, CON la misma cantidad de láminas y el mismo día de
// publicación: eso ya no es «dos pies parecidos», es la misma publicación dos veces.
//
// QUÉ NO CUBRE:
//   · El mismo TEMA de un creador (las de meal prep de una misma cuenta): son carruseles distintos del mismo rubro. Eso lo
//     acota ./variedad.ts (2 de la misma cuenta por tramo de 12), no esto.
//   · «Día 3», «Week 1», «Episodio 2»: se probaron como marca de serie y se descartaron. En los pies reales casi nunca marcan
//     una serie: marcan un plan adentro del texto («Days 1-3: no running», «Week 2: …») o un repaso («week 1: greet people,
//     week 2: …»). De las 990, el 6/11 aportaron 3 falsos y CERO duplicados. Sólo cuenta `parte/part/pt/teil` + número.
//   · Dos series numeradas distintas de un mismo creador que NADA las contradice: se las toma como una. Ver «DOS SERIES DEL
//     MISMO CREADOR», abajo: lo que sí las separa son tres hechos (el mismo número, el total declarado y el orden en el tiempo);
//     sin ninguno de los tres no hay forma de saber de qué serie es cada parte, y la parte que se toma por repetida SE ESCONDE
//     de la grilla (no «baja unos lugares», como decía este comentario hasta el 18/11/2026: `sinRepetidos` la saca).
//   · Lo que no tiene pie (Spy lo borra a los 30 días): sin texto no se afirma nada y los dos quedan.
//
// DOS SERIES DEL MISMO CREADOR (18/11/2026, pendiente F130). Hasta ese día la clave de una serie era SÓLO el creador, con la
// excepción del mismo número: así, si un creador tenía «part 3» de una serie en octubre y «part 2» de OTRA en noviembre, la de
// noviembre se escondía como si fuera la misma. El texto no sirve para separarlas (ver arriba: los pies de las partes no se
// parecen, y meter el texto en la clave rompía las series de verdad). Lo que sí sirve son HECHOS de una serie, sin umbrales:
//   1. UNA SERIE NO TIENE DOS VECES EL MISMO NÚMERO (la regla de @heygurlceo, que ya estaba).
//   2. UN TOTAL DECLARADO NO CAMBIA: «part 2/5» y «part 3/10» son series distintas; «part 5» no entra en una de «2/3».
//   3. LAS PARTES SALEN EN ORDEN: la parte 3 de una serie no se publica ANTES que su parte 2. Si la «part 2» de un creador es de
//      un día posterior a su «part 3», son dos series. Se compara por DÍA (no por hora): dos partes del mismo día no se
//      contradicen, y una diferencia de zona horaria no inventa una serie nueva.
// Por eso, para cada creador, la pasada lleva una lista de SERIES (cada una con las partes que se le asignaron, con su número,
// su día y su total) y una parte nueva va a la primera serie con la que no se contradice; si se contradice con todas, es una
// serie nueva y se QUEDA. Lo que se esconde también se anota en su serie: ya se juzgó como de ella, y su número y su día ayudan a
// separar la siguiente («pt 2» de la serie A escondida → una «pt 2» que llega después es de otra serie). Sin día o sin total, ese
// hecho no se puede mirar y no separa nada (queda lo de antes: el mismo creador).
// Lo que sigue sin separarse: dos series que corren a la vez y en orden compatible, sin totales distintos. Eso pediría saber el
// TEMA de cada parte, y no hay un clasificador de tema (docs/hallazgos-carruseles.md).
//
// NO ES UN SANEO: no esconde nada de la base (eso es `dejo_de_verse_en`, y lo decide una pasada a ojo). Es de la PRESENTACIÓN,
// como la variedad: se aplica a la grilla ya ordenada, y NO se aplica cuando se pidió ver una cuenta (por la lista o por @) ni
// en «Guardados» — ahí lo que el negocio pidió o guardó se ve entero.
//
// Puro y sin dependencias más que ./texto.ts. Lo prueba tests/carruseles-duplicados.test.ts.
// =============================================================================

import { plano } from './texto';

/**
 * La marca de una parte de una serie: «parte 2», «part 3», «pt2», «parts 1», «Teil 2», «part 7/10». NO con un rango atrás
 * (`part 1-3`, `partes 1–3`): eso enumera las partes que hay, no dice de qué parte es ésta. Y el número es de uno o dos
 * dígitos: «part 2026» es un año.
 * ⚠️ Se mide sobre el texto CON su puntuación: sacándola, «el futuro… la parte. 2 cosas» pasa a ser «la parte 2».
 */
const MARCA_DE_PARTE = /\b(?:parte|part|pt|teil)s?\s*#?\s*\d{1,2}(?![-–—\d])/i;
/**
 * El total que declara la marca, justo después del número: «part 7/10», «parte 2 de 5», «part 2 of 5», «Teil 2 von 3». Sólo un
 * número pegado (con espacios): «la parte 2 del ebook» o «parte 2 de las 5 claves» no declaran un total.
 */
const TOTAL_DE_LA_SERIE = /^\s*(?:\/|de|of|von)\s*(\d{1,2})(?!\d)/i;

/** Lo que no identifica al contenido: links, @cuentas y hashtags. La puntuación QUEDA (la marca de parte la necesita). */
const sinRuido = (texto: string | null): string =>
  plano(texto ?? '').replace(/https?:\/\/\S+/g, ' ').replace(/[@#][\p{L}\p{N}_.]+/gu, ' ').replace(/\s+/g, ' ').trim();

/** El pie como clave: sin ruido, sin puntuación y sin emojis, para compararlo palabra por palabra. */
const pieComparable = (texto: string | null): string =>
  sinRuido(texto).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Cuántas palabras hacen falta en el pie para que se pueda afirmar que dos son el mismo: menos es un «Guárdalo». */
const PALABRAS_MINIMAS = 4;

/** De qué se dedujo que es el mismo contenido (para el test y para poder explicarlo). */
export type PorQueRepetido = 'serie' | 'pie';
export type FirmaContenido = {
  clave: string;
  por: PorQueRepetido;
  /** Qué parte dice ser (la primera que se lee del pie). Dos del mismo creador con el MISMO número son series distintas. */
  parte?: number;
  /** Cuántas partes declara la serie («part 2/5» → 5), si lo dice. Dos totales distintos son dos series. */
  total?: number;
};

/**
 * La identidad del CONTENIDO de un carrusel, o null si no se puede afirmar (y entonces no se toca). Ver la cabecera: qué
 * cubre y qué no. Dos carruseles con la misma `clave` son, para la grilla, el mismo contenido.
 */
export function firmaDeContenido(c: {
  competidorId: number; texto: string | null; laminas: number | null; publicada: string | null;
}): FirmaContenido | null {
  const t = sinRuido(c.texto);
  if (!t) return null;
  // Una parte numerada: la serie es del creador, porque los pies de las partes no se parecen entre sí.
  const parte = MARCA_DE_PARTE.exec(t);
  if (parte) {
    const n = Number(/\d{1,2}/.exec(parte[0])?.[0]);
    const tot = Number(TOTAL_DE_LA_SERIE.exec(t.slice(parte.index + parte[0].length))?.[1]);
    // Un total menor que la parte («part 7/3») no es un total: es otra cosa (una fecha, un marcador); no se usa.
    return { clave: `serie:${c.competidorId}`, por: 'serie', parte: n, ...(tot >= n && tot > 0 ? { total: tot } : {}) };
  }
  // El mismo pie entero, las mismas láminas y el mismo día: la misma publicación dos veces.
  const pie = pieComparable(c.texto);
  const dia = (c.publicada ?? '').slice(0, 10);
  if (c.laminas == null || !dia || pie.split(' ').length < PALABRAS_MINIMAS) return null;
  return { clave: `pie:${c.competidorId}:${c.laminas}:${dia}:${pie}`, por: 'pie' };
}

type Comparable = { competidorId: number; texto: string | null; laminas: number | null; publicada: string | null };

/** Una parte ya asignada a una serie: su número, su día (`AAAA-MM-DD`, o null si no se sabe) y el total que declara. */
type ParteDeSerie = { n: number; dia: string | null; total: number | null };

/**
 * ¿Puede `p` ser de la misma serie que estas partes? No, si algún HECHO lo contradice (ver «DOS SERIES DEL MISMO CREADOR»):
 * el mismo número, dos totales distintos, un número por encima del total, o un orden en el tiempo al revés. Lo que no se sabe
 * (sin día, sin total) no contradice nada.
 */
export function cabeEnLaSerie(serie: readonly ParteDeSerie[], p: ParteDeSerie): boolean {
  return serie.every((q) => {
    if (q.n === p.n) return false;
    if (q.total != null && p.total != null && q.total !== p.total) return false;
    if ((q.total != null && p.n > q.total) || (p.total != null && q.n > p.total)) return false;
    if (q.dia && p.dia) {
      if (q.n < p.n && q.dia > p.dia) return false;
      if (q.n > p.n && q.dia < p.dia) return false;
    }
    return true;
  });
}

/**
 * Una pasada por la lista ya ordenada: de cada contenido queda el PRIMERO (el que mejor rindió) y los que siguen se van.
 * Una parte numerada va a la primera serie de su creador con la que no se contradice (`cabeEnLaSerie`); si se contradice con
 * todas, es una serie nueva y se queda.
 */
function unaVezCadaContenido<T extends Comparable>(xs: readonly T[]): { fuera: Set<number>; porQue: Array<{ x: T; por: PorQueRepetido; clave: string }> } {
  /** El mismo pie: qué publicaciones ya quedaron. */
  const pies = new Set<string>();
  /** Por creador: sus series, cada una con las partes que se le asignaron (las que quedaron Y las que se escondieron). */
  const series = new Map<string, ParteDeSerie[][]>();
  const fuera = new Set<number>();
  const porQue: Array<{ x: T; por: PorQueRepetido; clave: string }> = [];
  xs.forEach((x, i) => {
    const f = firmaDeContenido(x);
    if (!f) return;
    if (f.por === 'pie' || f.parte == null) {
      if (!pies.has(f.clave)) { pies.add(f.clave); return; }
      fuera.add(i);
      porQue.push({ x, por: f.por, clave: f.clave });
      return;
    }
    const dia = /^\d{4}-\d{2}-\d{2}/.exec(x.publicada ?? '')?.[0] ?? null;
    const p: ParteDeSerie = { n: f.parte, dia, total: f.total ?? null };
    const delCreador = series.get(f.clave) ?? [];
    series.set(f.clave, delCreador);
    const suya = delCreador.find((s) => cabeEnLaSerie(s, p));
    // Ninguna serie suya la admite: es OTRA serie del mismo creador, y se queda.
    if (!suya) { delCreador.push([p]); return; }
    suya.push(p);
    fuera.add(i);
    porQue.push({ x, por: f.por, clave: f.clave });
  });
  return { fuera, porQue };
}

/**
 * La lista sin las repeticiones de contenido, en el MISMO orden: de cada contenido queda el primero, que en una lista ya
 * ordenada es el que mejor rindió. No reordena nada y lo que no tiene firma no se toca.
 */
export function sinRepetidos<T extends Comparable>(xs: readonly T[]): T[] {
  const { fuera } = unaVezCadaContenido(xs);
  return fuera.size ? xs.filter((_, i) => !fuera.has(i)) : [...xs];
}

/**
 * Los que `sinRepetidos` saca, y por qué: para medirlo contra los datos de verdad sin restar listas, y para que el test
 * pueda decir POR QUÉ se fue cada uno.
 */
export function repetidosDe<T extends Comparable>(xs: readonly T[]): Array<{ x: T; por: PorQueRepetido; clave: string }> {
  return unaVezCadaContenido(xs).porQue;
}
