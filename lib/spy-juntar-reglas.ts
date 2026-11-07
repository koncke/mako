// =============================================================================
// Juntar dos competidores que son la MISMA persona cargada dos veces (6/11/2026)
// =============================================================================
// El pedido: «Competidores cargados dos veces con nombres distintos siguen duplicados. El cliente los ve repetidos y hay
// que borrarlos de a uno: borrar se lleva todas sus piezas y no se puede deshacer».
//
// ⚠️ EL ALTA YA NO LOS CREA (lib/spy.ts → `agregarCompetidor`, con `tests/spy-alta-duplicados.test.ts`): compara el @, el
// canal, el dominio, el nombre normalizado y el referente. Esto es para los que YA ESTÁN en la base —cargados antes de esa
// guarda— y para los pares que esa comparación no puede ver, que son los de nombre distinto: «hormozi» y «@AlexHormozi»
// normalizan a `hormozi` y `alexhormozi`, que no son iguales.
//
// ⚠️ Y HAY UN CASO QUE NO SE JUNTA NUNCA, A PROPÓSITO (lo dice el pedido): un DOMINIO no se empareja con una persona.
// «acquisition.com» y «@AlexHormozi» pueden ser lo mismo o pueden ser su empresa y él; acá no se adivina. Se junta sólo
// con una señal que sólo puede venir de la misma cuenta.
//
// Todo acá es PURO y se puede probar: lo que toca la base está en lib/spy-juntar.ts.
// =============================================================================

import { dominioComparable, nombreComparable } from './spy-reglas';

/** Lo que hace falta saber de un competidor para decidir si dos son el mismo y cuál queda. */
export type CompetidorJuntable = {
  id: number;
  nombre: string;
  instagram: string | null;
  youtube_id: string | null;
  tiktok: string | null;
  landing_url: string | null;
  pagina_anuncios: string | null;
  pais: string | null;
  avatar: string | null;
  mirado_en: string | null;
};

/** Por qué se parecen. El orden es el de la certeza: una cuenta compartida es un hecho; un nombre, un parecido. */
export type MotivoParecido = 'instagram' | 'youtube' | 'tiktok' | 'anuncios' | 'web' | 'nombre';

/** El par, ya ordenado: `queda` es el que sobrevive. */
export type Parecidos = { queda: number; seVa: number; motivo: MotivoParecido };

/**
 * Cuántas letras tiene que tener un nombre de UNA palabra para que estar adentro de otro cuente. Cinco: con cuatro,
 * «borg» empareja con «cyborg»; con tres, «ana» con «Juliana». «hormozi» tiene siete.
 */
const LETRAS_PARA_CONTENER = 5;

/** Las palabras de un nombre que sirven para comparar: sin acentos, en minúsculas, sin las de una o dos letras. */
export function palabrasDeNombre(nombre: string): string[] {
  return (nombre ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((p) => p.length > 2);
}

/**
 * ¿Los nombres son de la misma persona? Dos formas, las dos medidas contra los ejemplos del pedido:
 *  · el nombre normalizado es el mismo («sofiacontreras» y «Sofia Contreras»): es lo que ya mira el alta;
 *  · uno está ADENTRO del otro («hormozi» ⊂ «@AlexHormozi» → `alexhormozi` contiene `hormozi`), con dos cortes medidos
 *    contra los casos reales: al menos `LETRAS_PARA_CONTENER` letras y pegado a una PUNTA del otro. Sin el primero,
 *    «Ana» emparejaba con «Juliana»; sin el segundo, cualquier nombre metido en el medio de otro.
 * Lo que NO alcanza: compartir UNA palabra de un nombre de varias («Marcos Pérez» y «Ana Pérez» no son el mismo).
 */
export function mismoNombre(a: string, b: string): boolean {
  const na = nombreComparable(a);
  const nb = nombreComparable(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // ⚠️ LAS PALABRAS SE CUENTAN SOBRE EL NOMBRE CRUDO, NO SOBRE EL NORMALIZADO. `nombreComparable` saca los espacios, así
  // que `palabrasDeNombre(nombreComparable('Ana Pérez'))` devuelve UNA palabra («anaperez») y la rama de varias quedaba
  // MUERTA: lo encontré rompiendo el test a propósito (cambiar su `every` por `some` no ponía nada en rojo).
  const pa = palabrasDeNombre(a);
  const pb = palabrasDeNombre(b);
  if (pa.length > 1 && pb.length > 1) {
    // De los dos lados varias palabras: TODAS las del que tiene menos están en el otro («Sofia Contreras» ⊂ «Sofia
    // Contreras Coach»). Compartir UNA no alcanza: «Marcos Pérez» y «Ana Pérez» no son la misma persona.
    const [pocas, muchas] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
    const otras = new Set(muchas);
    return pocas.every((p) => otras.has(p));
  }
  // Uno de los dos es UNA sola palabra: tiene que estar pegada a una PUNTA del otro, y ser larga. `hormozi` al final de
  // `alexhormozi`, sí. ⚠️ `borg` dentro de `cyborg` también es un sufijo: por eso el largo mínimo. Y esto PROPONE, no
  // junta: lo confirma una persona, y juntar no pierde ninguna pieza.
  const [corto, largo] = na.length <= nb.length ? [na, nb] : [nb, na];
  return corto.length >= LETRAS_PARA_CONTENER && (largo.startsWith(corto) || largo.endsWith(corto));
}

/** La señal más fuerte que comparten dos competidores, o `null` si no comparten ninguna. */
export function porQueSeParecen(a: CompetidorJuntable, b: CompetidorJuntable): MotivoParecido | null {
  const igual = (x: string | null, y: string | null) => !!x?.trim() && x.trim().toLowerCase() === (y ?? '').trim().toLowerCase();
  if (igual(a.instagram, b.instagram)) return 'instagram';
  if (igual(a.youtube_id, b.youtube_id)) return 'youtube';
  if (igual(a.tiktok, b.tiktok)) return 'tiktok';
  if (igual(a.pagina_anuncios, b.pagina_anuncios)) return 'anuncios';
  if (a.landing_url?.trim() && b.landing_url?.trim() && dominioComparable(a.landing_url) === dominioComparable(b.landing_url)) return 'web';
  if (mismoNombre(a.nombre, b.nombre)) return 'nombre';
  return null;
}

/** Cuántas cuentas suyas conocemos: con más, la ficha tiene más para mostrar. */
const cuantasCuentas = (c: CompetidorJuntable): number =>
  [c.instagram, c.youtube_id, c.tiktok, c.landing_url, c.pagina_anuncios].filter((x) => !!x?.trim()).length;

/**
 * Cuál de los dos QUEDA. Gana el que tiene más piezas leídas: son las que se perderían. Si empatan, el que tiene más
 * cuentas suyas; si siguen empatando, el que se miró más recientemente; y al final el id más chico, que es el que se
 * cargó primero (y el que el cliente tiene enlazado).
 *
 * ⚠️ Nunca decide el NOMBRE. «sofiacontreras» puede ser el que tiene las 200 piezas, y el nombre se arregla editando;
 * las piezas, no.
 */
export function cualQueda(
  a: CompetidorJuntable, b: CompetidorJuntable, piezas: Readonly<Record<number, number>>,
): { queda: CompetidorJuntable; seVa: CompetidorJuntable } {
  const pa = piezas[a.id] ?? 0;
  const pb = piezas[b.id] ?? 0;
  if (pa !== pb) return pa > pb ? { queda: a, seVa: b } : { queda: b, seVa: a };
  const ca = cuantasCuentas(a);
  const cb = cuantasCuentas(b);
  if (ca !== cb) return ca > cb ? { queda: a, seVa: b } : { queda: b, seVa: a };
  const ma = Date.parse(a.mirado_en ?? '') || 0;
  const mb = Date.parse(b.mirado_en ?? '') || 0;
  if (ma !== mb) return ma > mb ? { queda: a, seVa: b } : { queda: b, seVa: a };
  return a.id <= b.id ? { queda: a, seVa: b } : { queda: b, seVa: a };
}

/**
 * Los pares de la lista que son la misma persona, ya ordenados por cuál queda. Cada competidor entra en UN par como
 * mucho: juntar de a dos, y si quedan tres cargas de la misma persona, el siguiente par aparece después de juntar el
 * primero. Es a propósito: una cadena de tres se arma sola con un emparejamiento flojo y arrastra a alguien que no es.
 */
export function paresParecidos(
  competidores: readonly CompetidorJuntable[], piezas: Readonly<Record<number, number>> = {},
): Parecidos[] {
  const usados = new Set<number>();
  const out: Parecidos[] = [];
  for (let i = 0; i < competidores.length; i += 1) {
    if (usados.has(competidores[i].id)) continue;
    for (let j = i + 1; j < competidores.length; j += 1) {
      if (usados.has(competidores[j].id)) continue;
      const motivo = porQueSeParecen(competidores[i], competidores[j]);
      if (!motivo) continue;
      const { queda, seVa } = cualQueda(competidores[i], competidores[j], piezas);
      out.push({ queda: queda.id, seVa: seVa.id, motivo });
      usados.add(competidores[i].id);
      usados.add(competidores[j].id);
      break;
    }
  }
  return out;
}

/** Lo que la pantalla dice de por qué se parecen, en palabras de la persona. */
export const EN_PALABRAS: Readonly<Record<MotivoParecido, string>> = {
  instagram: 'tienen el mismo Instagram',
  youtube: 'tienen el mismo canal de YouTube',
  tiktok: 'tienen el mismo TikTok',
  anuncios: 'tienen la misma Página en la Biblioteca de Anuncios',
  web: 'tienen la misma web',
  nombre: 'se llaman casi igual',
};

/**
 * Los campos del que se va que COMPLETAN al que queda: sólo donde el que queda no tiene nada. Nunca se pisa un dato del
 * que queda — si los dos tienen Instagram y son distintos, el del que se va se pierde, y es lo correcto: uno de los dos
 * estaba mal cargado y el que queda es el que el cliente vio.
 */
export function camposQueSeCompletan(queda: CompetidorJuntable, seVa: CompetidorJuntable): Record<string, string> {
  const campos: Array<keyof CompetidorJuntable> = ['instagram', 'youtube_id', 'tiktok', 'landing_url', 'pagina_anuncios', 'pais', 'avatar'];
  const out: Record<string, string> = {};
  for (const k of campos) {
    const mio = queda[k];
    const suyo = seVa[k];
    if (typeof mio === 'string' && mio.trim()) continue;
    if (mio != null && typeof mio !== 'string') continue;
    if (typeof suyo === 'string' && suyo.trim()) out[k] = suyo;
  }
  return out;
}

/** Una pieza, como la mira el juntado: su id y de qué fila es. */
export type PiezaParaMudar = { id: number; canal: string; ref: string };

/**
 * Qué piezas del que se va se MUDAN al que queda, y cuáles no. No se mudan las que el que queda ya tiene: la tabla es
 * única por (negocio, competidor, canal, ref), así que mudarlas chocaría y la mudanza entera se caería. Las que no se
 * mudan se van con él, que es lo mismo que pasa hoy al borrarlo: son la MISMA pieza, leída dos veces.
 */
export function piezasQueSeMudan(
  delQueSeVa: readonly PiezaParaMudar[], delQueQueda: readonly Pick<PiezaParaMudar, 'canal' | 'ref'>[],
): number[] {
  const ya = new Set(delQueQueda.map((p) => `${p.canal}\u0000${p.ref}`));
  return delQueSeVa.filter((p) => !ya.has(`${p.canal}\u0000${p.ref}`)).map((p) => p.id);
}
