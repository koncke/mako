// Tests del sistema «gordo» de los gráficos del Dashboard (lib/graficos-gordo.ts) y de que el dibujo lo use
// (app/dashboard/Grafico.tsx, app/dashboard/graficos/*, app/dashboard/MapaGeo.tsx).
// Correr: npx tsx --test tests/graficos-gordo.test.ts
//
// Probados rompiéndolos (12/10/2026), con la base en 11 pases y 0 fallos:
//   · `etiquetasQueEntran` sin mirar si dos cajas se cruzan          -> 9 / 2 («al azar», «el último punto…»)
//   · sin mirar si la caja cabe en el área                          -> 10 / 1 («al azar»)
//   · sin el tope por serie                                         -> 10 / 1 («al azar»)
//   · ordenando sólo por valor (sin la prioridad)                   -> 10 / 1 («el último punto… gana la prioridad»)
//   · `trazoDe` sin el piso de 3,5                                  -> 10 / 1 («los pisos»)
//   · la plantilla Minimal con trazo 2 (el dibujo igual sale con 3,5, pero la muestra del panel mentiría) -> 10 / 1
//   · un `fontSize: 11.5` en Grafico.tsx, y aparte un `font-size: 12px` en la hoja -> 10 / 1 cada uno («ninguna letra…»)
//   · el eje 'b' del combinado a la vista (`orientation="right"`)    -> 10 / 1 («nunca dos ejes Y»)
//   · `usaPaneles` sin la regla de las tres métricas                -> 10 / 1 («paneles…»)
//   · `columnaConBarra` sin mirar «menos es mejor»                  -> 10 / 1 («la tabla con barras…»)
//   · `partesDeProporcion` dividiendo por un total en cero          -> 10 / 1 («la barra de proporción…»)
//   · el hueco de DIBUJOS_PROPIOS desenchufado en CuerpoGrafico     -> 10 / 1 («el dibujo usa el sistema…»)
//   · `textoConMuestra` con «X de Y» también para una razón de días -> 10 / 1 («… la muestra chica»)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  anchoEjeY, candidatosDeColumnas, candidatosDeSeries, columnaConBarra, columnasQueEntran, etiquetasQueEntran,
  intervaloX, LETRA, LETRA_MINIMA, modoPorAlto, ocultoPorCero, ordenarPorValores, partesDeProporcion, radioDe, seCruzan,
  textoConMuestra, tramoMasLargo, trazoDe, usaPaneles, type Candidato,
} from '../lib/graficos-gordo';
import { estiloEfectivo, PLANTILLAS_TEMA } from '../lib/graficos-temas';

const RAIZ = join(__dirname, '..');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario primero y los bloques después (AGENTS.md: un `/*` adentro de un `//` se come el código).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Un generador de números al azar con semilla: la prueba al azar se repite igual. */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

// ── Los pisos ─────────────────────────────────────────────────────────────────────────────

test('los pisos: ninguna plantilla de estilo baja el trazo de 3,5 ni el radio de 6, y la muestra del panel dice lo que se dibuja', () => {
  for (const p of PLANTILLAS_TEMA) {
    const e = estiloEfectivo({ plantilla: p.id, acento: null, fuente: null });
    assert.ok(e.trazo >= 3.5 && e.trazo <= 5, `${p.id}: trazo ${e.trazo}`);
    assert.ok(e.radioBarra >= 6, `${p.id}: radio ${e.radioBarra}`);
    // PanelEstilo dibuja la muestra con el número de la PLANTILLA: si está debajo del piso, la muestra miente.
    assert.equal(p.graficos.trazo, e.trazo, `${p.id}: la plantilla dice ${p.graficos.trazo} y se dibuja ${e.trazo}`);
    assert.equal(p.graficos.radioBarra, e.radioBarra, `${p.id}: la plantilla dice radio ${p.graficos.radioBarra} y se dibuja ${e.radioBarra}`);
  }
  assert.equal(trazoDe(2), 3.5);
  assert.equal(trazoDe(9), 5);
  assert.equal(trazoDe(Number.NaN), 4);
  assert.equal(radioDe(0), 6);
  assert.equal(radioDe(10), 10);
  for (const [k, v] of Object.entries(LETRA)) assert.ok(v >= LETRA_MINIMA, `LETRA.${k} = ${v}`);
});

// El guard de la letra lee el FUENTE de lo que dibuja, sin comentarios: cualquier tamaño literal por debajo de
// 13 (en JSX, en un objeto de estilo o en la hoja de estilos) es un gráfico que no se lee.
const DIBUJO = [
  ['app', 'dashboard', 'Grafico.tsx'],
  ['app', 'dashboard', 'MapaGeo.tsx'],
  ...readdirSync(join(RAIZ, 'app', 'dashboard', 'graficos')).filter((f) => /\.tsx?$/.test(f)).map((f) => ['app', 'dashboard', 'graficos', f]),
];
test('ninguna letra por debajo de 13 px en lo que dibuja un gráfico (y ningún token de 12)', () => {
  assert.ok(DIBUJO.length >= 10, `sólo ${DIBUJO.length} archivos`);
  for (const ruta of DIBUJO) {
    const src = sinComentarios(leer(...ruta));
    const chicos: string[] = [];
    for (const m of src.matchAll(/fontSize\s*[=:]\s*\{?\s*(\d+(?:\.\d+)?)/g)) if (Number(m[1]) < LETRA_MINIMA) chicos.push(m[0]);
    for (const m of src.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) if (Number(m[1]) < LETRA_MINIMA) chicos.push(m[0]);
    assert.deepEqual(chicos, [], `${ruta.join('/')}: ${chicos.join(' · ')}`);
    assert.doesNotMatch(src, /var\(--fs-meta\)/, `${ruta.join('/')} usa el token de 12 px`);
  }
});

test('nunca dos ejes Y a la vista, y ninguna etiqueta por punto: la capa que no pisa', () => {
  const src = sinComentarios(leer('app', 'dashboard', 'Grafico.tsx'));
  assert.doesNotMatch(src, /orientation=/, 'un eje con `orientation` es el segundo eje Y de antes');
  // El único eje 'b' es el escondido del combinado.
  const ejesB = [...src.matchAll(/<YAxis yAxisId="b"[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(ejesB, ['<YAxis yAxisId="b" hide />']);
  // LabelList sólo queda en el embudo de recharts (sus escalones, no puntos): la capa propia hace el resto.
  const funnel = src.indexOf('<FunnelChart');
  const fin = src.indexOf('</FunnelChart>');
  for (const m of src.matchAll(/<LabelList/g)) assert.ok(m.index! > funnel && m.index! < fin, 'hay un LabelList fuera del embudo');
  assert.match(src, /<CapaEtiquetas /);
});

// ── La regla de no pisar ──────────────────────────────────────────────────────────────────

test('etiquetasQueEntran: con entradas al azar, ninguna caja toca a otra ni se sale del área, y se respetan los topes', () => {
  const rnd = azar(20261012);
  let puestasTotal = 0;
  for (let corrida = 0; corrida < 400; corrida++) {
    const area = { x: rnd() * 40, y: rnd() * 30, width: 120 + rnd() * 700, height: 60 + rnd() * 300 };
    const n = 1 + Math.floor(rnd() * 40);
    const series = 1 + Math.floor(rnd() * 4);
    const cands: Candidato[] = Array.from({ length: n }, (_, i) => ({
      id: `c${i}`, x: area.x - 20 + rnd() * (area.width + 40), y: area.y - 20 + rnd() * (area.height + 40),
      texto: 'US$'.slice(0, Math.floor(rnd() * 4)) + String(Math.floor(rnd() * 10 ** (1 + Math.floor(rnd() * 6)))),
      prioridad: 1 + Math.floor(rnd() * 2), valor: rnd() * 1000, serie: `s${Math.floor(rnd() * series)}`,
      lado: (['arriba', 'derecha', 'centro'] as const)[Math.floor(rnd() * 3)],
    }));
    const tope = 1 + Math.floor(rnd() * 8);
    const porSerie = 1 + Math.floor(rnd() * 3);
    const p = etiquetasQueEntran(cands, area, { tope, porSerie });
    puestasTotal += p.length;
    assert.ok(p.length <= tope, `corrida ${corrida}: ${p.length} > tope ${tope}`);
    const porS = new Map<string, number>();
    for (const x of p) porS.set(x.serie ?? '', (porS.get(x.serie ?? '') ?? 0) + 1);
    for (const [s, k] of porS) assert.ok(k <= porSerie, `corrida ${corrida}: la serie ${s} tiene ${k}`);
    for (let i = 0; i < p.length; i++) {
      const c = p[i].caja;
      assert.ok(c.x >= area.x - 0.5 && c.y >= area.y - 0.5 && c.x + c.w <= area.x + area.width + 0.5 && c.y + c.h <= area.y + area.height + 0.5, `corrida ${corrida}: ${p[i].id} se sale del área`);
      for (let j = i + 1; j < p.length; j++) assert.ok(!seCruzan(c, p[j].caja), `corrida ${corrida}: ${p[i].id} pisa a ${p[j].id}`);
    }
  }
  assert.ok(puestasTotal > 400, `la prueba no puso casi nada (${puestasTotal}): no prueba la regla`);
});

test('con una sola serie, el último punto sale siempre; y entre dos que se pisan gana la prioridad', () => {
  const area = { x: 0, y: 0, width: 600, height: 200 };
  const puntos = Array.from({ length: 30 }, (_, i) => ({ x: 10 + i * 19, y: 180 - (i % 7) * 20 - (i === 12 ? 100 : 0), valor: (i % 7) * 10 + (i === 12 ? 90 : 0), texto: String(i) }));
  const cands = candidatosDeSeries([{ id: 'gasto', puntos }]);
  assert.deepEqual(cands.map((c) => c.id), ['gasto:29', 'gasto:12'], 'el último (prioridad 1) y el máximo, que está a más de 3 puntos');
  const p = etiquetasQueEntran(cands, area, { tope: 2 });
  assert.ok(p.some((x) => x.id === 'gasto:29'), 'el último punto no salió');
  // Dos candidatos en el mismo lugar: entra el de prioridad 1 aunque valga menos.
  const pisan = etiquetasQueEntran([
    { id: 'max', x: 300, y: 100, texto: '999', prioridad: 2, valor: 999 },
    { id: 'ult', x: 302, y: 101, texto: '5', prioridad: 1, valor: 5 },
  ], area);
  assert.deepEqual(pisan.map((x) => x.id), ['ult']);
  // El máximo pegado al último (a menos de 3 puntos) no se repite.
  const cerca = candidatosDeSeries([{ id: 's', puntos: [{ x: 0, y: 0, valor: 1, texto: '1' }, { x: 1, y: 0, valor: 9, texto: '9' }, null, { x: 3, y: 0, valor: 2, texto: '2' }] }]);
  assert.deepEqual(cerca.map((c) => c.id), ['s:3']);
});

test('columnas: cada una si son 12 o menos y el texto entra; si no, la más alta y la última', () => {
  const barras = (n: number, ancho: number) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, x: i * 30, y: 100, ancho, valor: i === 3 ? 50 : i, texto: String(i === 3 ? 50 : i) }));
  assert.equal(candidatosDeColumnas(barras(10, 40)).length, 10);
  assert.deepEqual(candidatosDeColumnas(barras(20, 40)).map((c) => c.id), ['b3', 'b19']);
  assert.deepEqual(candidatosDeColumnas(barras(10, 6)).map((c) => c.id), ['b3', 'b9'], 'en una columna angosta el número no entra');
});

// ── Paneles, ejes y alturas ───────────────────────────────────────────────────────────────

test('paneles: dos formatos o tres métricas en una serie (Tendencias), nunca con desglose ni apilado', () => {
  assert.equal(usaPaneles('serie', ['usd', 'numero', 'numero', 'numero'], false), true, 'Tendencias');
  assert.equal(usaPaneles('serie', ['numero', 'numero', 'numero'], false), true, 'tres métricas del mismo formato');
  assert.equal(usaPaneles('serie', ['numero', 'numero'], false), false, 'dos del mismo formato: un gráfico, un eje');
  assert.equal(usaPaneles('serie', ['usd', 'numero'], true), false, 'con desglose las series son categorías de UNA métrica');
  assert.equal(usaPaneles('columnas', ['usd', 'numero'], false), true);
  assert.equal(usaPaneles('columnas', ['numero', 'numero', 'numero'], false), false, 'columnas del mismo formato se agrupan');
  assert.equal(usaPaneles('area_apilada', ['usd', 'numero'], false), false);
  assert.equal(usaPaneles('serie', ['usd'], false), false);
  assert.equal(intervaloX(30), 5, '30 días: una marca cada 6, cinco marcas');
  assert.equal(intervaloX(5), 0);
  assert.ok(anchoEjeY(['US$12 k', '0']) < 72 && anchoEjeY(['5']) >= 28, 'el eje mide su texto, no 72 fijos');
  assert.ok(anchoEjeY(['US$1.234.567']) <= 96, 'y tiene techo');
  assert.equal(modoPorAlto(70), 'soloNumero');
  assert.equal(modoPorAlto(100), 'sinEjes');
  assert.equal(modoPorAlto(300), 'completo');
});

// ── Tablas, proporción, tramos ────────────────────────────────────────────────────────────

test('la tabla con barras: UNA columna con barra, la elegida o la que ordena, nunca una de «menos es mejor»', () => {
  const menos = (id: string) => ['cpa', 'cpl'].includes(id);
  assert.equal(columnaConBarra({ barra: 'agendas', ordenMetrica: 'gasto', metricas: ['gasto', 'agendas', 'cpa'] }, menos), 'agendas');
  assert.equal(columnaConBarra({ barra: null, ordenMetrica: 'gasto', metricas: ['cpa', 'gasto'] }, menos), 'gasto');
  assert.equal(columnaConBarra({ ordenMetrica: null, metricas: ['cpa', 'leads'] }, menos), 'leads', 'ordena el CPA: la barra pasa a la primera de «más es mejor»');
  assert.equal(columnaConBarra({ barra: 'cpl', ordenMetrica: null, metricas: ['cpl', 'clics'] }, menos), 'clics');
  assert.equal(columnaConBarra({ ordenMetrica: null, metricas: ['cpa', 'cpl'] }, menos), null, 'todas de costo: sin barra');
  assert.equal(columnaConBarra({ barra: 'otra', ordenMetrica: null, metricas: ['leads'] }, menos), 'leads', 'una barra que no es del gráfico no cuenta');
  // Sin scroll de costado: se esconden de derecha a izquierda.
  const m = { nombre: 160, barra: 200, numero: 100 };
  assert.equal(columnasQueEntran(900, 6, m), 5);
  assert.equal(columnasQueEntran(300, 6, m), 0);
  assert.equal(columnasQueEntran(2000, 3, m), 3);
});

test('la barra de proporción sin datos no pinta nada (la vieja pintaba 100 % rojo con 0 y 0); el tramo más largo', () => {
  assert.deepEqual(partesDeProporcion([0, 0]), [0, 0]);
  assert.deepEqual(partesDeProporcion([null, 0]), [0, 0]);
  assert.deepEqual(partesDeProporcion([30, 10]), [75, 25]);
  assert.deepEqual(partesDeProporcion([30, -5]), [100, 0], 'lo negativo no ocupa barra');
  assert.equal(tramoMasLargo([2, null, 9, 9, 3]), 2);
  assert.equal(tramoMasLargo([null, 0]), -1);
});

test('ocultar si es cero, el orden fijo de una dimensión y la muestra chica', () => {
  assert.equal(ocultoPorCero({ ocultarSiCero: true }, 0), true);
  assert.equal(ocultoPorCero({ ocultarSiCero: true }, null), true);
  assert.equal(ocultoPorCero({ ocultarSiCero: true }, 120), false);
  assert.equal(ocultoPorCero({}, 0), false, 'sin pedirlo no se esconde nada');
  const filas = [{ clave: 'Baja', etiqueta: 'Baja', valores: [3] }, { clave: 'Otra', etiqueta: 'Otra', valores: [1] }, { clave: 'Alta', etiqueta: 'Alta', valores: [5] }];
  assert.deepEqual(ordenarPorValores(filas, ['Alta', 'Media', 'Baja', 'A futuro'], 1).map((f) => [f.clave, f.valores[0]]),
    [['Alta', 5], ['Media', 0], ['Baja', 3], ['A futuro', 0], ['Otra', 1]]);
  assert.equal(ordenarPorValores(filas, undefined, 1).length, 3);
  // Muestra chica: un porcentaje con menos casos que su mínimo se dice «2 de 3»; una razón de días, «—».
  const f = (v: number | null) => (v == null ? '—' : String(v));
  assert.equal(textoConMuestra(null, { num: 2, den: 3 }, 'pct', f), '2 de 3');
  assert.equal(textoConMuestra(null, { num: 24, den: 2 }, 'numero', f), '—');
  assert.equal(textoConMuestra(40, null, 'pct', f), '40');
});

// ── El dibujo usa el sistema ──────────────────────────────────────────────────────────────

test('el dibujo usa el sistema: el trazo y el radio del tema, el hueco del mapa de calor, el mapa de cualquier país', () => {
  const src = sinComentarios(leer('app', 'dashboard', 'Grafico.tsx'));
  assert.doesNotMatch(src, /strokeWidth=\{2\.5\}/, 'un trazo fijo de 2,5 (el minigráfico de antes)');
  assert.doesNotMatch(src, /radius=\{\[4, 4, 0, 0\]\}|radius=\{\[0, 4, 4, 0\]\}/, 'un radio fijo de 4');
  assert.match(src, /e\.radioBarra/);
  assert.match(src, /DIBUJOS_PROPIOS\[g\.tipo\]/, 'el hueco del mapa de calor (ola 2)');
  assert.match(src, /import\('\.\/MapaGeo'\)/);
  assert.doesNotMatch(src, /MapaMexico/);
  const mapa = sinComentarios(leer('app', 'dashboard', 'MapaGeo.tsx'));
  assert.doesNotMatch(mapa, /raw\.githubusercontent|https?:\/\//, 'la geometría se sirve desde NUESTRO dominio');
  assert.match(mapa, /'\/geo\/v1'/);
});
