// =============================================================================
// Lecturas acotadas que NO se dejan cortar por el tope de 1000 de PostgREST
// =============================================================================
// PostgREST devuelve 1000 filas y un 200 cuando hay más: no hay error. Las
// guardas de la nutrición («¿a cuáles de estos leads ya les escribimos?») y el
// catálogo de videos detectados leían un `.in()` / `.limit(1000)` suelto y el
// corte se comía justo lo que había que ver. Estos tests simulan el corte con un
// servidor falso que respeta el tope, que es el único lugar donde el bug existe.
//
// Probado rompiéndolo (17/09/2026), 4 fallos y 5 pases con las tres roturas
// juntas: `idsConAlMenosUnaFila` cortando tras UNA consulta (el comportamiento
// viejo) → «un lead con miles de mensajes» encuentra 1 de 3 leads y la guarda
// anti-bucle no dispara; `distintosPorExclusion` sin mandar los excluidos → tira
// «filas llenas sin valores nuevos» en vez de devolver los 3 videos; y
// `patronesDeNombre` sin comodines para los acentos → «Sofía Contreras» queda
// afuera de `%sofia%`. Restaurado: 9 de 9.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idsConAlMenosUnaFila, distintosPorExclusion, enTandas, listaPostgrest } from '../lib/ids-con-filas';
import { nombreComparable, patronesDeNombre } from '../lib/leads-duplicados';

/** Un «servidor» que devuelve las filas cuyo id está en `pendientes`, en el orden
 *  físico de la tabla, cortadas en `tope` — como PostgREST. */
function servidor(tabla: number[], tope: number) {
  let llamadas = 0;
  const consultar = async (pendientes: number[]) => {
    llamadas++;
    const set = new Set(pendientes);
    return tabla.filter((id) => set.has(id)).slice(0, tope);
  };
  return { consultar, llamadas: () => llamadas };
}

test('un lead con miles de mensajes no tapa a los demás', async () => {
  // El caso medido en ws1: un solo lead con 1194 mensajes nuestros. Las filas de
  // ese lead llegan primero y llenan la respuesta entera.
  const tabla = [...Array(1194).fill(7), 8, 9, ...Array(50).fill(7)];
  const s = servidor(tabla, 1000);
  const r = await idsConAlMenosUnaFila([7, 8, 9, 10], s.consultar, 1000);
  assert.deepEqual([...r].sort(), [7, 8, 9]);
  // 1ª vuelta: 1000 filas del 7 (llena → no concluye). 2ª: sin el 7, trae 8 y 9.
  assert.equal(s.llamadas(), 2);
});

test('respuesta incompleta = respuesta completa: una sola vuelta', async () => {
  const s = servidor([1, 2, 2, 3], 1000);
  const r = await idsConAlMenosUnaFila([1, 2, 3, 4], s.consultar, 1000);
  assert.deepEqual([...r].sort(), [1, 2, 3]);
  assert.equal(s.llamadas(), 1);
});

test('sin ids no consulta nada', async () => {
  const s = servidor([1], 1000);
  assert.equal((await idsConAlMenosUnaFila([], s.consultar)).size, 0);
  assert.equal(s.llamadas(), 0);
});

test('una consulta que ignora los pendientes falla en vez de girar para siempre', async () => {
  // Devuelve siempre las mismas 3 filas llenas (tope 3) sin filtrar: sin la guarda
  // sería un bucle infinito.
  const malo = async () => [1, 1, 1];
  await assert.rejects(() => idsConAlMenosUnaFila([1, 2], malo, 3), /sin ids nuevos/);
});

test('los valores distintos salen aunque uno solo llene la respuesta', async () => {
  // vsl_events de ws1: las 1000 más nuevas son de UN video (25 horas).
  type F = { v: string };
  const tabla: F[] = [...Array(1500).fill({ v: 'vsl' }), { v: 'iframe0' }, ...Array(10).fill({ v: 'vsl' }), { v: 'viejo' }];
  const tope = 1000;
  const consultar = async (excluidos: string[]) => tabla.filter((f) => !excluidos.includes(f.v)).slice(0, tope);
  const primeras = new Map<string, number>();
  const r = await distintosPorExclusion<F, string>(consultar, (f) => f.v, (f) => primeras.set(f.v, (primeras.get(f.v) ?? 0) + 1), { tope });
  assert.deepEqual([...r].sort(), ['iframe0', 'viejo', 'vsl']);
  // `onFila` ve solo las filas de la vuelta en que cada valor apareció.
  assert.equal(primeras.get('vsl'), 1000);
  assert.equal(primeras.get('viejo'), 1);
});

test('distintosPorExclusion no trunca callado pasado el cinturón', async () => {
  let n = 0;
  const siempreNuevo = async () => Array.from({ length: 2 }, () => ({ v: n++ }));
  await assert.rejects(
    () => distintosPorExclusion(siempreNuevo, (f) => f.v, () => {}, { tope: 2, maxVueltas: 5 }),
    /más de 5 vueltas/,
  );
});

test('la lista para `not in` va con comillas, y escapa las propias', () => {
  assert.equal(listaPostgrest(['a', 'b,c', 'd"e']), '("a","b,c","d\\"e")');
});

test('enTandas parte sin perder ni repetir', () => {
  const xs = Array.from({ length: 450 }, (_, i) => i);
  const t = enTandas(xs, 200);
  assert.deepEqual(t.map((x) => x.length), [200, 200, 50]);
  assert.deepEqual(t.flat(), xs);
});

/** Traducción a mano de `ilike` (solo `%` y `_`), sin distinguir mayúsculas. */
function ilike(valor: string, patron: string): boolean {
  const re = new RegExp(`^${patron.split('').map((c) => (c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('')}$`, 'isu');
  return re.test(valor);
}

test('el prefiltro de nombre del server no deja afuera a ningún duplicado real', () => {
  // Antes era `.limit(500)` sin filtro: con 1066 leads el duplicado existía y no
  // se encontraba. El prefiltro tiene que ser SUPERCONJUNTO de lo que
  // `buscarDuplicados` acepta — incluidos los acentos que el candidato no trae.
  const casos: Array<[string, string]> = [
    ['Sofia Contreras', 'Sofía Contreras'],
    ['Gabriela Hurtado', 'Hurtado, Gabriela'],
    ['Maria de la Luz Nunez', 'MARÍA DE LA LUZ NÚÑEZ'],
    ['Francois Perez', 'François Pérez'],
  ];
  for (const [cand, guardado] of casos) {
    const n = nombreComparable(cand)!;
    assert.equal(nombreComparable(guardado), n, `${guardado} tendría que ser el mismo nombre que ${cand}`);
    for (const pat of patronesDeNombre(n)) {
      assert.ok(ilike(guardado, pat), `«${guardado}» quedó afuera del patrón ${pat}`);
    }
  }
  // Y filtra de verdad: otro nombre no pasa.
  assert.ok(!patronesDeNombre(nombreComparable('Sofia Contreras')!).every((p) => ilike('Juan Perez', p)));
});
test('una palabra que es todo comodín no se manda como filtro', () => {
  // Las vocales, la `n` y la `c` van como `_` para tolerar acentos. En una
  // palabra corta eso la vuelve TODO comodín: «ana» → `%___%`, que coincide con
  // 1.107 de 1.108 leads de ws1. Mandarla no filtra nada, y con el `.limit(100)`
  // que tenía la consulta volvía a comparar contra 100 leads al azar — el mismo
  // bug del `.limit(500)` original, por otra puerta.
  // Probado rompiéndolo: sin el `.filter` de patronesDeNombre este archivo da
  // 9 pases y 1 fallo (este test); restaurado, 10 de 10.
  assert.deepEqual(patronesDeNombre(nombreComparable('Ana')!), [], '«Ana» no tiene ninguna palabra que filtre');
  // Una palabra con letras fijas sí queda, y una corta se descarta sin tirar la otra.
  const pats = patronesDeNombre(nombreComparable('Ana Gonzalez')!);
  assert.equal(pats.length, 1, 'se descarta «ana» y queda «gonzalez»');
  assert.ok(ilike('Ana González', pats[0]), 'el duplicado real pasa el filtro');
  assert.ok(!ilike('Ana Pérez', pats[0]), 'y otra Ana con otro apellido no pasa');
  // Cada patrón que sale tiene al menos dos letras fijas: si no, no descarta a nadie.
  for (const n of ['Sofia Contreras', 'Maria de la Luz Nunez', 'Jo Li']) {
    for (const p of patronesDeNombre(nombreComparable(n)!)) {
      assert.ok(p.replace(/[%_]/g, '').length >= 2, `«${p}» (de ${n}) no filtra nada`);
    }
  }
});
