// EL DELTA SIGUE AL FILTRO, O NO SE DIBUJA — la regla A3 de docs/diseno-dashboards-codeandchill.md
//
// El defecto que esto bloquea es de Corbel, el template más caro del catálogo que se miró: al cambiar
// de canal (`Overview / Online / In store`) los números grandes cambian y el eje se re-etiqueta, pero
// el chip `+7,1% vs mes pasado` queda IDÉNTICO en las tres vistas. O el delta está mal en dos de las
// tres, o no está atado al filtro. Es, exactamente, un número que parece medido y no lo está.
//
// La regla: un filtro que cambia una cifra cambia su comparación, o la comparación se va. No hay
// tercera opción. Si el período anterior del mismo largo no se puede leer para ese recorte, el chip
// no se dibuja (que es nuestra regla del `null`: nunca un cero, nunca un «falta»).
//
// ⚠️ MEDIDO EL 31/10/2026: en este árbol la regla YA se cumple en el camino de escritorio
// (`datosDeGraficos` filtra las DOS lecturas, y `firmaDe` lleva los filtros, así que un cambio de
// filtro vuelve a pedir los datos). Este test no arregla un bug: lo BLOQUEA, porque la línea que lo
// cumple es una sola y sacarla no rompe ninguna otra cosa — el chip simplemente empieza a mentir, en
// silencio y en la cara visible de la pantalla.
//
// `lib/graficos-datos.ts` lleva `import 'server-only'` y no se puede importar desde un test de node,
// así que el camino de producción se blinda leyendo el fuente (el idioma de la casa). Lo que SÍ se
// ejecuta de verdad es la regla: `filtrarFilas` + `agregar` + `periodoAnterior` + `chipComparar`.
//
// Correr: node --import tsx --test tests/graficos-delta-sigue-al-filtro.test.ts
//
// Probados rompiéndolos (31/10/2026), con la base en 0 fallos (5 tests):
//   · quitarle `filtrarFilas(…, filtros)` al período anterior en `datosDeGraficos` (lib/graficos-datos.ts)
//       → 4 pass / 1 fail («el call-site: `datosDeGraficos` aplica los MISMOS filtros…»)
//   · `chipComparar` sin su guarda del cero (`!(antes > 0)`), que pasa a dar un factor infinito
//       → 4 pass / 1 fail («sin período anterior comparable no hay chip»)
//   · sacarle `JSON.stringify(ef.filtros)` a `firmaDe` (app/dashboard/exportar.ts)
//       → 4 pass / 1 fail («la firma lleva los filtros»)
//   · `filtrarFilas` que no filtra (`activos` siempre vacío)
//       → 3 pass / 2 fail («el período anterior se lee CON los filtros…» y «sin período anterior comparable…»)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanearGrafico, type Grafico } from '../lib/graficos-catalogo';
import { agregar, chipComparar, filtrarFilas, periodoAnterior, type Fila } from '../lib/graficos-agregar';
import { firmaDe } from '../app/dashboard/exportar';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

const g = (base: Record<string, unknown>): Grafico => sanearGrafico({ id: 'g1', ...base })! as Grafico;

/**
 * Dos períodos de 10 días y dos orígenes que se mueven AL REVÉS: «anuncios» crece (2 → 6 leads por
 * día) y «referidos» cae (6 → 2). El total de los dos juntos no se mueve, así que el delta sin filtro
 * es exactamente 1,0× — y el delta de cada origen por separado NO puede ser 1,0×. Es la forma de que
 * un chip que ignora el filtro se delate: se queda en «↑ 1,0×» para los tres recortes.
 */
function filas(): Fila[] {
  const out: Fila[] = [];
  const dia = (n: number) => `2026-10-${String(n).padStart(2, '0')}`;
  // El período ANTERIOR: del 01 al 10.
  for (let d = 1; d <= 10; d++) {
    out.push({ f: dia(d), d: { origen: 'anuncios' }, v: { leads: 2 } });
    out.push({ f: dia(d), d: { origen: 'referidos' }, v: { leads: 6 } });
  }
  // El período ACTUAL: del 11 al 20.
  for (let d = 11; d <= 20; d++) {
    out.push({ f: dia(d), d: { origen: 'anuncios' }, v: { leads: 6 } });
    out.push({ f: dia(d), d: { origen: 'referidos' }, v: { leads: 2 } });
  }
  return out;
}

/**
 * El RECORTE POR PERÍODO lo hace el lector (el SQL), no `agregar`: a `agregar` le llegan las filas ya
 * leídas para ese rango, y el `desde`/`hasta` le sirven para armar los casilleros del tiempo. Por eso
 * `datosDeGraficos` hace DOS lecturas con dos claves de caché distintas. Esto imita al lector.
 */
const enRango = (fs: Fila[], desde: string, hasta: string) => fs.filter((x) => !!x.f && x.f >= desde && x.f <= hasta);

/** Lo que hace `datosDeGraficos`: agrega el período pedido y el anterior del mismo largo, con los MISMOS filtros. */
function conYSinAnterior(filtros: Array<{ dimension: string; valores: string[] }>, conFiltroEnElAnterior = true) {
  const grafico = g({ fuente: 'leads', tipo: 'numero', fecha: 'alta', metricas: ['leads'], comparar: true });
  const desde = '2026-10-11';
  const hasta = '2026-10-20';
  const ant = periodoAnterior(desde, hasta);
  const deAhora = enRango(filas(), desde, hasta);
  const deAntes = enRango(filas(), ant.desde, ant.hasta);
  const ahora = agregar(grafico, filtrarFilas(deAhora, filtros), desde, hasta);
  // `conFiltroEnElAnterior = false` es el defecto que este test persigue: el anterior leído SIN el filtro.
  const antes = agregar(grafico, conFiltroEnElAnterior ? filtrarFilas(deAntes, filtros) : deAntes, ant.desde, ant.hasta);
  return { ahora: ahora.totales[0], antes: antes.totales[0], chip: chipComparar(ahora.totales[0], antes.totales[0]), ant };
}

test('el período anterior del mismo largo: el día antes de que empiece éste, y del mismo tamaño', () => {
  assert.deepEqual(periodoAnterior('2026-10-11', '2026-10-20'), { desde: '2026-10-01', hasta: '2026-10-10' });
  // Un solo día compara contra el día anterior, no contra nada.
  assert.deepEqual(periodoAnterior('2026-10-11', '2026-10-11'), { desde: '2026-10-10', hasta: '2026-10-10' });
});

test('el período anterior se lee CON los filtros aplicados: el delta de cada recorte es el suyo', () => {
  // Sin filtro los dos orígenes se compensan: 80 leads antes y 80 ahora. El delta es 1,0×.
  const todo = conYSinAnterior([]);
  assert.equal(todo.antes, 80);
  assert.equal(todo.ahora, 80);
  assert.equal(todo.chip, '↑ 1,0×');

  // Filtrando por «anuncios»: 20 antes y 60 ahora. El delta TIENE que moverse a 3,0×.
  const anuncios = conYSinAnterior([{ dimension: 'origen', valores: ['anuncios'] }]);
  assert.equal(anuncios.antes, 20, 'el anterior tiene que estar filtrado también');
  assert.equal(anuncios.ahora, 60);
  assert.equal(anuncios.chip, '↑ 3,0×');

  // Y por «referidos», al revés: 60 antes y 20 ahora.
  const referidos = conYSinAnterior([{ dimension: 'origen', valores: ['referidos'] }]);
  assert.equal(referidos.antes, 60);
  assert.equal(referidos.ahora, 20);
  assert.equal(referidos.chip, '↓ 0,3×');

  // El corazón de la regla: los tres chips son DISTINTOS. Si el anterior se leyera sin el filtro, los
  // tres recortes mostrarían el mismo «↑ 1,0×» del total — el defecto de Corbel, clavado.
  assert.equal(new Set([todo.chip, anuncios.chip, referidos.chip]).size, 3, 'un filtro que cambia la cifra cambia su comparación');

  // Y así se vería el defecto: con el anterior SIN filtrar, los dos recortes mienten con el mismo número.
  const roto = conYSinAnterior([{ dimension: 'origen', valores: ['anuncios'] }], false);
  assert.equal(roto.antes, 80, 'el anterior sin filtrar es el total de los dos orígenes');
  assert.notEqual(roto.chip, anuncios.chip, 'el chip sin filtro en el anterior no es el chip del recorte');
});

test('sin período anterior comparable no hay chip: no se dibuja un delta contra cero ni contra la nada', () => {
  // Dividir por cero no es un dato: el chip no se dibuja (la regla del `null`).
  assert.equal(chipComparar(60, 0), null, 'contra un anterior en cero no hay factor que decir');
  assert.equal(chipComparar(60, null), null, 'sin anterior leído no hay chip');
  assert.equal(chipComparar(null, 20), null, 'sin cifra de ahora no hay chip');
  // Un recorte que no existe: el filtro deja las dos lecturas vacías y el chip se va.
  // ⚠️ Una métrica de SUMA sobre cero filas da 0, no null (el null es de las razones y los atributos),
  // así que lo que salva al chip acá es `chipComparar`, que no divide por cero. Vale anotarlo: quien
  // mire sólo el total podría creer que un recorte vacío devuelve null.
  const nuevo = conYSinAnterior([{ dimension: 'origen', valores: ['un-origen-que-no-existe'] }]);
  assert.equal(nuevo.antes, 0);
  assert.equal(nuevo.ahora, 0);
  assert.equal(nuevo.chip, null, 'antes que un delta inventado, ningún delta');
});

test('la firma lleva los filtros: cambiar un filtro vuelve a pedir los datos (el chip no queda viejo)', () => {
  const grafico = g({ fuente: 'leads', tipo: 'numero', fecha: 'alta', metricas: ['leads'], comparar: true });
  const base = { desde: '2026-10-11', hasta: '2026-10-20', agrupar: null, noAplica: [], propio: { periodo: false, campos: [] } };
  const sin = firmaDe(grafico, { ...base, filtros: [] }, 0);
  const con = firmaDe(grafico, { ...base, filtros: [{ dimension: 'origen', valores: ['anuncios'] }] }, 0);
  const otro = firmaDe(grafico, { ...base, filtros: [{ dimension: 'origen', valores: ['referidos'] }] }, 0);
  assert.notEqual(sin, con, 'sin esto, poner un filtro no vuelve a pedir los datos y el delta queda el de antes');
  assert.notEqual(con, otro, 'dos recortes distintos son dos lecturas distintas');
});

test('el call-site: `datosDeGraficos` aplica los MISMOS filtros a las dos lecturas', () => {
  const src = leer('lib/graficos-datos.ts');
  // La línea que calcula el anterior tiene que pasar por `filtrarFilas` con `filtros`, igual que la
  // del período actual. Sacarle el filtro es una edición de una línea que ningún otro test ve.
  const linea = src.split('\n').find((l) => l.includes('resultado.anterior'));
  assert.ok(linea, 'no encontré dónde se calcula el período anterior');
  assert.match(linea!, /filtrarFilas\(.*,\s*filtros\)/, 'el período anterior se agrega SIN los filtros: el chip miente');
  // Y el actual, lo mismo (si alguien quitara el filtro de los dos, los chips volverían a coincidir).
  assert.match(src, /const resultado = agregar\(g, filtrarFilas\(.*,\s*filtros\)/, 'el período actual tiene que ir filtrado');
});
