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
// La revisión del 21/10 (sobre 7eb2bbaae) sumó tres: una serie de más de 60 puntos dibujaba los 60 MÁS VIEJOS (y la
// nota decía el período entero), el gráfico del chat no tenía red de error (un pedazo que no carga tumbaba la pantalla)
// y «ya lo ve» se le decía al modelo aunque el bloque no se dibujara (el tope de bloques del turno).
//
// Correr: node --import tsx --test tests/dashboard-bloque-grafico.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026, base 5/0): el saneo sin validar el gráfico contra el catálogo → 4 / 1; sin el tope
// de filas → 4 / 1; el bloque metido en el texto (`J({ bloque, texto })`, lo leería el modelo) → 4 / 1; sin mirar
// `ctx.aDibujar` → 4 / 1; `graficoParaElChat` sin la serie de tiempo → 4 / 1; BloqueHilo sin el caso `grafico` → 4 / 1.
// Lo de la revisión (21/10/2026, base de los dos archivos 14/0, scratchpad romper-revision.mjs): la serie con los 60 más
// viejos → 13 / 1; la nota con el período entero → 13 / 1; «Y N más» también en una tabla → 13 / 1; BloqueHilo sin red →
// 13 / 1; CuerpoGrafico sin red → 13 / 1; ejecutar que dice «ya lo ve» siempre → 13 / 1; el turno que no avisa el tope
// → 13 / 1; el aviso pegado al texto → 13 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanearBloque } from '../lib/chat-bloques';
import { MAX_FILAS_GRAFICO, desdeDibujado, graficoParaElChat, sanearResultado } from '../lib/chat-bloques-dashboard';
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

/** 90 días seguidos desde el 23/07/2026, como los arma `agregar` para «leads por día de los últimos 90 días». */
const noventaDias = (alReves = false): Resultado => {
  const dia = (i: number) => new Date(Date.UTC(2026, 6, 23 + i)).toISOString().slice(0, 10);
  const filas = Array.from({ length: 90 }, (_, i) => ({ clave: dia(i), etiqueta: dia(i).slice(5), valores: [i] }));
  const orden = alReves ? [...filas].reverse() : filas;
  return {
    columnas: [{ id: 'leads', nombre: 'Leads', formato: 'numero' }], filas: orden, totales: [90], fuera: 0, clase: 'tiempo',
    cruce: { claves: ['meta'], celdas: orden.map((f) => [f.valores[0]]) },
  };
};

test('una serie de tiempo que no entra dibuja los 60 puntos MÁS NUEVOS, y la nota dice ese tramo', () => {
  const r = sanearResultado(noventaDias());
  assert.ok(r);
  assert.equal(r.filas.length, MAX_FILAS_GRAFICO);
  assert.equal(r.filas[0].clave, '2026-08-22', 'arranca 60 días antes del último');
  assert.equal(r.filas.at(-1)?.clave, '2026-10-20', 'y llega al último día: el tramo más reciente no se esconde');
  assert.equal(r.fuera, 30);
  assert.deepEqual(r.cruce?.celdas.map((c) => c[0]), r.filas.map((f) => f.valores[0]), 'el desglose, cortado igual que las filas');
  // Con la tabla al revés (la más nueva arriba), las más nuevas son las primeras.
  const desc = sanearResultado(noventaDias(true));
  assert.equal(desc?.filas[0].clave, '2026-10-20');
  assert.equal(desc?.filas.at(-1)?.clave, '2026-08-22');
  // La nota: desde la fecha más vieja que se dibuja; lo que entra entero no se toca.
  assert.equal(desdeDibujado(noventaDias()), '2026-08-22');
  assert.equal(desdeDibujado(noventaDias(true)), '2026-08-22');
  assert.equal(desdeDibujado(resultado(75)), null, 'por categoría, la nota es la del período');
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  assert.match(run, /const desdeDib = desdeDibujado\(r\);/);
  assert.match(run, /rangoTexto\(desdeDib \?\? per\.desde, hasta\)/, 'la nota dice el tramo dibujado');
  // Y abajo, una serie cuenta lo que quedó afuera como «antes»; una tabla ya dice «+N más» adentro (no dos veces).
  const pieza = leer('app/_chat/bloques/GraficoHilo.tsx');
  assert.match(pieza, /\{!tabla && b\.resultado\.fuera > 0 && <p className="ch-grafico__nota">\{b\.resultado\.clase === 'tiempo' \? `Y \$\{b\.resultado\.fuera\} puntos antes` : `Y \$\{b\.resultado\.fuera\} más`\}<\/p>\}/);
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
  // «Ya lo ve» NO va en `content`: va aparte (`siSeDibuja`) y lo suma ejecutarOperacion sólo si se dibujó.
  assert.match(c, /return \{ content: texto, bloque, siSeDibuja: `\(La persona YA VE \$\{ve\} dibujado en el chat: [^`]*` \};/);
  assert.doesNotMatch(c, /content: `\$\{texto\}[^`]*YA VE/, 'el aviso pegado al texto se dice aunque no se dibuje');
  assert.doesNotMatch(c, /J\(\{ bloque/, 'el bloque metido en el texto lo leería el modelo');
  // El marco (Ops Center 3, 061c1b74d) lo sanea y lo dibuja sólo si hay por dónde, y el modelo recibe `content`.
  const ej = leer('lib/api-mako/ejecutar.ts');
  assert.match(ej, /const bloque = cruda\.bloque && ctx\.aDibujar \? sanearBloque\(cruda\.bloque\) : null;/);
  // Y el saneo del marco conoce el tipo `grafico`.
  assert.ok(sanearBloque({ t: 'grafico', titulo: 'Leads', grafico: grafico(), resultado: resultado(2) }));
});

test('«ya lo ve» llega al modelo SÓLO si el bloque se dibujó: no con el tope lleno, ni descartado, ni sin canal', () => {
  const r = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_dashboard-dibujado-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  })) as { acepta: string; callado: string; rechaza: string; sinCanal: string; descartado: string; dibujados: number; aviso: string; red: string[] };
  assert.deepEqual(r.red, [], 'nada sale a la red');
  assert.equal(r.acepta, `la tabla\n\n${r.aviso}`, 'dibujado: el modelo sabe que la persona lo ve');
  assert.equal(r.callado, `la tabla\n\n${r.aviso}`, 'un canal que no contesta (`void`) dibujó');
  assert.equal(r.rechaza, 'la tabla', 'con el tope de bloques del turno lleno, no');
  assert.equal(r.sinCanal, 'la tabla', 'en WhatsApp o por HTTP, no');
  assert.equal(r.descartado, 'la tabla', 'un bloque que el saneo tira, no');
  assert.equal(r.dibujados, 1, 'el descartado no llegó al canal');
  // El turno de la app dice `false` cuando el tope está lleno (el repetido ya está en pantalla: `true`).
  const turno = leer('lib/mako-turno-app.ts');
  assert.match(turno, /const dibujar = \(b: Bloque\): boolean => \{\s*if \(bloquesDelTurno\.some\(\(x\) => JSON\.stringify\(x\.b\) === JSON\.stringify\(b\)\)\) return true;\s*if \(bloquesDelTurno\.length >= MAX_BLOQUES_MENSAJE\) return false;/);
});

test('el hilo lo dibuja con la pieza del Dashboard, cargada aparte', () => {
  const hilo = leer('app/_chat/BloqueHilo.tsx');
  assert.match(hilo, /const GraficoHilo = dynamic\(\(\) => import\('\.\/bloques\/GraficoHilo'\), \{\s*ssr: false,/);
  // Con su red: el pedazo que no carga tira al dibujar el Lazy, y sin red subía a app/error.tsx (la pantalla entera).
  assert.match(hilo, /if \(b\.t === 'grafico'\) return <RedDeBloque nombre=\{b\.titulo\} reiniciarCon=\{\[b\]\}><GraficoHilo b=\{b\} \/><\/RedDeBloque>;/);
  assert.match(hilo, /import \{ RedDeBloque \} from '@\/app\/dashboard\/RedDeBloque';/);
  const pieza = leer('app/_chat/bloques/GraficoHilo.tsx');
  assert.match(pieza, /import \{ CuerpoGrafico, esTarjetaNumero \} from '@\/app\/dashboard\/Grafico';/);
  // Y el dibujo adentro de otra, que deja el título y el link en pie (un bloque guardado que tira, tiraría cada vez).
  assert.match(pieza, /<RedDeBloque nombre=\{b\.titulo\} reiniciarCon=\{\[b\]\}>\s*<CuerpoGrafico g=\{b\.grafico\} estado=\{\{ cargando: false, resultado: b\.resultado \}\} tema=\{TEMA\} \/>\s*<\/RedDeBloque>/);
  assert.match(pieza, /<Link className="ch-abrir" href=\{b\.abrir\.href\}>/, 'el link va por Link (le suma el ?ws=)');
});
