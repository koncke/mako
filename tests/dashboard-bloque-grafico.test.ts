// =============================================================================
// Una pregunta del Dashboard se dibuja en el hilo del Ops Center: el bloque `grafico` (G16, y la tabla)
// =============================================================================
// Ops Center = lo principal (20/10/2026, docs/ops-center-principal.md, 2.7). «¿Cuánto vendí este mes?» en el chat de la
// app: `consultar_datos_dashboard` devuelve `{ content, bloque }`, `ejecutarOperacion` sanea el bloque y lo pasa por
// `ctx.aDibujar` (el canal de Ops Center 3, 061c1b74d), y el modelo lee sólo `content`. El hilo lo dibuja con la MISMA
// pieza del Dashboard (`CuerpoGrafico`, por app/_chat/bloques/GraficoHilo.tsx).
// Lo que se puede romper sin que se vea: que el saneo deje pasar un gráfico que el catálogo no conoce o un resultado que
// no calza (la pieza dibujaría basura), que no acote las filas, que el modelo reciba también el bloque, que sin el canal
// de dibujo (WhatsApp, HTTP) se le diga al modelo que la persona ya lo ve, y que el chat dibuje con una copia.
//
// Correr: node --import tsx --test tests/dashboard-bloque-grafico.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026, base 5/0): el saneo sin validar el gráfico contra el catálogo → 4 / 1; sin el tope
// de filas → 4 / 1; el bloque metido en el texto (`J({ bloque, texto })`, lo leería el modelo) → 4 / 1; sin mirar
// `ctx.aDibujar` → 4 / 1; `graficoParaElChat` sin la serie de tiempo → 4 / 1; BloqueHilo sin el caso `grafico` → 4 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanearBloque } from '../lib/chat-bloques';
import { MAX_FILAS_GRAFICO, graficoParaElChat, sanearResultado } from '../lib/chat-bloques-dashboard';
import { sanearComponente, type Grafico } from '../lib/graficos-catalogo';
import type { Resultado } from '../lib/graficos-agregar';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

const grafico = (extra: Partial<Grafico> = {}): Grafico => sanearComponente({
  clase: 'grafico', id: 'q0', x: 0, y: 0, w: 6, h: 4, tipo: 'tabla', fuente: 'leads', metricas: ['leads'], dimension: null, desglose: null,
  controles: [], periodo: 'ult30', desde: '', hasta: '', titulo: 'Leads', ...extra,
}) as Grafico;
const resultado = (filas: number, clase: Resultado['clase'] = 'categoria'): Resultado => ({
  columnas: [{ id: 'leads', nombre: 'Leads', formato: 'numero' }],
  filas: Array.from({ length: filas }, (_, i) => ({ clave: `k${i}`, etiqueta: `Grupo ${i}`, valores: [i] })),
  totales: [filas], fuera: 0, clase,
});

test('el saneo: un gráfico del catálogo con su resultado pasa; lo que no calza se descarta entero', () => {
  const g = grafico();
  const b = { t: 'grafico', titulo: 'Leads del mes', nota: '1 – 20 oct', grafico: g, resultado: resultado(3) };
  assert.deepEqual(sanearBloque(b), b);
  assert.equal(sanearBloque({ ...b, grafico: { ...g, fuente: 'inventada' } }), null, 'un conjunto que no existe');
  assert.equal(sanearBloque({ ...b, resultado: { ...resultado(3), filas: [{ clave: 'a', etiqueta: 'A', valores: [1, 2] }] } }), null, 'valores de otro largo');
  assert.equal(sanearBloque({ ...b, abrir: { titulo: 'Abrir', href: 'https://otro.com' } }), null, 'un link de afuera');
  assert.equal(sanearBloque({ ...b, titulo: '' }), null);
});

test('acotado: hasta 60 filas, y lo que no entra se cuenta', () => {
  const r = sanearResultado(resultado(75));
  assert.ok(r);
  assert.equal(r.filas.length, MAX_FILAS_GRAFICO);
  assert.equal(r.fuera, 75 - MAX_FILAS_GRAFICO);
  // Lo que el hilo no usa (ids de leads, fotos de afuera) no se guarda.
  const conRef = sanearResultado({ ...resultado(1), filas: [{ clave: 'a', etiqueta: 'Ana', valores: [1], ref: 'lead:12', imagen: 'https://fb.com/x.jpg' }] });
  assert.deepEqual(conRef?.filas[0], { clave: 'a', etiqueta: 'Ana', valores: [1] });
});

test('qué se dibuja: un número; con el tiempo, una serie; por categoría, barras o tabla; con desglose, columnas', () => {
  assert.equal(graficoParaElChat(grafico({ tipo: 'numero' }), resultado(0, null)).tipo, 'numero');
  assert.equal(graficoParaElChat(grafico({ dimension: 'mes' }), resultado(6, 'tiempo')).tipo, 'serie');
  assert.equal(graficoParaElChat(grafico({ dimension: 'origen' }), resultado(5)).tipo, 'barras');
  assert.equal(graficoParaElChat(grafico({ dimension: 'origen' }), resultado(20)).tipo, 'tabla');
  assert.equal(graficoParaElChat(grafico({ tipo: 'columnas', dimension: 'mes', desglose: 'origen' }), resultado(6, 'tiempo')).tipo, 'columnas');
});

test('la lectura devuelve { content, bloque }: el bloque va por ctx.aDibujar y el modelo lee sólo el texto', () => {
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  const c = run.slice(run.indexOf('consultar_datos_dashboard: {'), run.indexOf('listar_informes_dashboard: {'));
  assert.match(c, /if \(http\) return md;/);
  // Sin el canal de dibujo (WhatsApp, HTTP) va el texto, sin el aviso de que la persona ya lo ve.
  assert.match(c, /if \(!ctx\.aDibujar \|\| al\.graficos\.length !== 1\) return texto;/);
  assert.match(c, /return \{ content: `\$\{texto\}\\n\\n\(La persona YA VE este resultado dibujado en el chat: [^`]*`, bloque \};/);
  assert.doesNotMatch(c, /J\(\{ bloque/, 'el bloque metido en el texto lo leería el modelo');
  // El marco (Ops Center 3, 061c1b74d) lo sanea y lo dibuja sólo si hay por dónde, y el modelo recibe `content`.
  const ej = leer('lib/api-mako/ejecutar.ts');
  assert.match(ej, /const bloque = cruda\.bloque && ctx\.aDibujar \? sanearBloque\(cruda\.bloque\) : null;/);
  // Y el saneo del marco conoce el tipo `grafico`.
  assert.ok(sanearBloque({ t: 'grafico', titulo: 'Leads', grafico: grafico(), resultado: resultado(2) }));
});

test('el hilo lo dibuja con la pieza del Dashboard, cargada aparte', () => {
  const hilo = leer('app/_chat/BloqueHilo.tsx');
  assert.match(hilo, /const GraficoHilo = dynamic\(\(\) => import\('\.\/bloques\/GraficoHilo'\), \{\s*ssr: false,/);
  assert.match(hilo, /if \(b\.t === 'grafico'\) return <GraficoHilo b=\{b\} \/>;/);
  const pieza = leer('app/_chat/bloques/GraficoHilo.tsx');
  assert.match(pieza, /import \{ CuerpoGrafico, esTarjetaNumero \} from '@\/app\/dashboard\/Grafico';/);
  assert.match(pieza, /<CuerpoGrafico g=\{b\.grafico\} estado=\{\{ cargando: false, resultado: b\.resultado \}\} tema=\{TEMA\} \/>/);
  assert.match(pieza, /<Link className="ch-abrir" href=\{b\.abrir\.href\}>/, 'el link va por Link (le suma el ?ws=)');
});
