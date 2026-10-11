// =============================================================================
// Las tabs de Analysts como plantillas del Dashboard (puntos 22 y 24 del feedback del 11/10/2026)
// =============================================================================
// Lo que fija:
//   · Cada plantilla (Ads Analyst, Landing, Closing, Productividad) pasa por `sanearHoja` SIN PERDER NADA:
//     ni un componente, ni una métrica, ni una dimensión, ni un control. El saneo corrige en vez de
//     rechazar, así que una métrica mal escrita no da error: se cambia en silencio por la primera que
//     haya, y la hoja muestra OTRO número con el título de éste.
//   · Cada conjunto nuevo tiene su lector, y cada bloque nuevo su lectura y su dibujo (una salida sin
//     call site compila y no hace nada).
//   · Las reglas que no se ven en la firma: la retención y el scroll se dividen por los MEDIDOS, la
//     retención sólo lee eventos del video, impacto y esfuerzo no se suman.
//   · Sin voseo en el texto de los archivos nuevos (el guard del repo no ve lo que no tiene `git add`).
//   · La lógica mudada de los `'use client'` (veredicto y patrones, el rótulo de lo tocado, las métricas
//     de Productividad) cuenta lo mismo que contaba la tab.
//   · Productivity Analyst salió de la sidebar y su ruta redirige a su hoja; Ads, Landing y Closing
//     SIGUEN, porque tienen tareas que todavía no se mudaron.
// Correr: npx tsx --test tests/graficos-analysts.test.ts
//
// PROBADO ROMPIÉNDOLO (11/10/2026, al retomar la corrida): una rotura por vez sobre la base en verde
// (13/13) y restaurando a mano; cada una dio 1 fallo y 12 pases:
//   · `hook_rat` en vez de `hook_rate` en el KPI de Ads Analyst          → «…SIN PERDER NADA»
//   · sacar `ejecucion` de LECTORES_EXTRA                                → «cada conjunto nuevo tiene su lector»
//   · sacar `case 'curva_vsl'` de datosDeBloquesExtra                    → «cada bloque nuevo se lee… y se dibuja»
//   · el denominador de `tasa_50` en `arrancaron` en vez de `medidos`    → «se dividen por los MEDIDOS»
//   · `metricasProductividad` sin `sinRecurrentes`                       → «Productividad cuenta como la tab»
//   · la entrada de Productivity Analyst de vuelta en nav.ts             → «Productivity Analyst salió de la sidebar»
//   · el mapa de calor de Landing un renglón arriba (y: 25 → 24)         → «nadie se pisa en la grilla»
//   · `videosDelPeriodo` sin el filtro `esEventoDeVideo`                 → «sólo lee eventos DEL VIDEO»
//   · «Pasá el cursor…» en el cuadrante de BloquesAds.tsx                → «sin voseo» (lo caza la lista de
//     palabras con forma de voseo: `marcasDeVoseo` sola no marca «pasá»)
// ⚠️ La corrida anterior se cortó con la rotura de `tasa_50` puesta (el conjunto dividía por los que
// arrancaron): al retomar, este mismo test la encontró en rojo. Una rotura sin restaurar es un bug.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOQUES, esBloque, esGrafico, fuenteDe, sanearHoja, type Componente } from '../lib/graficos-catalogo';
import { FUENTES_EXTRA } from '../lib/graficos-fuentes-extra';
import { BLOQUES_EXTRA } from '../lib/graficos-bloques-extra-catalogo';
import { PLANTILLAS_ANALYSTS } from '../lib/graficos-plantillas-analysts';
import { PLANTILLAS_HOJA } from '../lib/graficos-plantillas';
import { buildPatterns, esMuestraChica, verdictFromVals } from '../lib/ads-analyst-patrones';
import { rotuloDe } from '../lib/landing-mapa-rotulo';
import { cuadranteDe, metricasProductividad } from '../lib/productividad-metricas';
import { marcasDeVoseo } from '../lib/puestas-data';
import type { ScriptView } from '../lib/ads-analyst';
import type { BoardTask, Label } from '../app/plan/board/types';

const RAIZ = join(__dirname, '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después: un `/*` dentro de un comentario de línea se comería el código.
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

type Crudo = Record<string, unknown> & { id: string; clase?: string; controles?: Array<Record<string, unknown>> };

test('cada plantilla de Analysts sobrevive al saneo SIN PERDER NADA (componentes, métricas, dimensiones, controles)', () => {
  assert.deepEqual(PLANTILLAS_ANALYSTS.map((p) => p.id), ['ads-analyst', 'landing', 'closing', 'productividad']);
  for (const p of PLANTILLAS_ANALYSTS) {
    const crudo = p.armar((l) => l) as { id: string; controles: Crudo[]; componentes: Crudo[] };
    const h = sanearHoja(crudo, 0)!;
    assert.ok(h, `${p.id}: no es una hoja`);
    assert.equal(h.id, crudo.id, `${p.id}: el id fijo no pasó el saneo (lo usa el redirect ?hoja=)`);
    assert.equal(h.controles.length, crudo.controles.length, `${p.id}: se perdió un control de la barra`);
    assert.equal(h.componentes.length, crudo.componentes.length, `${p.id}: se perdió un componente`);
    for (const c of crudo.componentes) {
      const s = h.componentes.find((x) => x.id === c.id) as Componente | undefined;
      assert.ok(s, `${p.id}/${c.id}: el id local no pasa idValido o el componente no existe`);
      assert.equal(s!.x, c.x, `${p.id}/${c.id}: x`); assert.equal(s!.y, c.y, `${p.id}/${c.id}: y`);
      assert.equal(s!.w, c.w, `${p.id}/${c.id}: w`); assert.equal(s!.h, c.h, `${p.id}/${c.id}: h`);
      if (c.clase === 'bloque') {
        assert.ok(esBloque(s!) && s.bloque === c.bloque, `${p.id}/${c.id}: el bloque ${String(c.bloque)} no existe`);
        continue;
      }
      assert.ok(esGrafico(s!), `${p.id}/${c.id}: no es un gráfico`);
      const g = s as Extract<Componente, { clase: 'grafico' }>;
      assert.ok(fuenteDe(String(c.fuente)), `${p.id}/${c.id}: el conjunto ${String(c.fuente)} no existe`);
      assert.equal(g.fuente, c.fuente, `${p.id}/${c.id}: cambió el conjunto`);
      assert.equal(g.tipo, c.tipo, `${p.id}/${c.id}: cambió el tipo`);
      assert.deepEqual(g.metricas, c.metricas, `${p.id}/${c.id}: se pierde una métrica (el saneo la cambia por otra en silencio)`);
      if (c.dimension) assert.equal(g.dimension, c.dimension, `${p.id}/${c.id}: cambió la dimensión`);
      if (c.desglose) assert.equal(g.desglose, c.desglose, `${p.id}/${c.id}: cambió el desglose`);
      if (c.fecha) assert.equal(g.fecha, c.fecha, `${p.id}/${c.id}: cambió la fecha`);
      if (c.ordenMetrica) assert.equal(g.ordenMetrica, c.ordenMetrica, `${p.id}/${c.id}: cambió el orden`);
      assert.equal(g.controles.length, c.controles?.length ?? 0, `${p.id}/${c.id}: se perdió un control del gráfico (¿el campo existe?)`);
      for (const k of c.controles ?? []) {
        const sk = g.controles.find((x) => x.id === k.id);
        assert.deepEqual(sk?.valores ?? null, k.valores ?? null, `${p.id}/${c.id}: el control ${String(k.id)} perdió sus valores`);
      }
    }
  }
});

test('nadie se pisa en la grilla de una plantilla (la compactación correría lo de abajo)', () => {
  for (const p of PLANTILLAS_ANALYSTS) {
    const cs = sanearHoja(p.armar((l) => l), 0)!.componentes;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      const pisa = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!pisa, `${p.id}: se pisan ${a.id} y ${b.id}`);
      assert.ok(a.x + a.w <= 12, `${p.id}: ${a.id} se pasa de las 12 columnas`);
    }
  }
});

test('las plantillas no repiten id con el resto de la galería y no nombran a ningún cliente', () => {
  const ids = PLANTILLAS_HOJA.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, `ids repetidos en la galería: ${ids.join(', ')}`);
  const texto = JSON.stringify(PLANTILLAS_ANALYSTS.map((p) => p.armar((l) => l)));
  for (const nombre of ['Mauricio', 'Leila', 'Brigitte', 'Código Inmobiliario', 'Martín']) assert.ok(!texto.includes(nombre), `una plantilla nombra a ${nombre}`);
  for (const p of PLANTILLAS_ANALYSTS) assert.ok(p.linea.length <= 110, `${p.id}: la línea pasa los 110 caracteres`);
});

test('cada conjunto nuevo tiene su lector en LECTORES_EXTRA, y cada lector su conjunto', () => {
  const src = leer('lib/graficos-datos-extra.ts');
  const i = src.indexOf('export const LECTORES_EXTRA:');
  assert.ok(i >= 0, 'no encuentro LECTORES_EXTRA');
  const mapa = src.slice(i, src.indexOf('\n};', i));
  const claves = [...mapa.matchAll(/^\s+(\w+): \(/gm)].map((m) => m[1]).sort();
  assert.deepEqual(claves, FUENTES_EXTRA.map((f) => f.id).sort());
});

test('cada bloque nuevo se lee en datosDeBloquesExtra y se dibuja en CuerpoBloqueExtra', () => {
  const datos = sinComentarios(leer('lib/graficos-bloques-extra.ts'));
  const dibujo = sinComentarios(leer('app/dashboard/bloques/extra/CuerpoBloqueExtra.tsx'));
  const ids = BLOQUES_EXTRA.map((b) => b.id);
  assert.equal(new Set(BLOQUES.map((b) => b.id)).size, BLOQUES.length, 'un bloque de Analysts repite el id de uno de Comercial');
  for (const id of ids) {
    assert.ok(datos.includes(`case '${id}':`), `${id}: datosDeBloquesExtra no lo lee`);
    assert.ok(dibujo.includes(`b.bloque === '${id}'`), `${id}: CuerpoBloqueExtra no lo dibuja`);
  }
});

test('la retención del video sólo lee eventos DEL VIDEO: un clic o un scroll no son un play', () => {
  const src = sinComentarios(leer('lib/graficos-datos-extra.ts'));
  const ini = src.indexOf('export async function videosDelPeriodo');
  const fin = src.indexOf('async function filasRetencionVsl', ini);
  assert.ok(ini >= 0 && fin > ini, 'no encuentro videosDelPeriodo');
  const cuerpo = src.slice(ini, fin);
  const filtro = cuerpo.indexOf('if (!esEventoDeVideo(x.tipo_evento)) continue;');
  assert.ok(filtro >= 0, 'videosDelPeriodo agrupa cualquier evento (un clic armaría un video «Sin identificar»)');
  assert.ok(filtro < cuerpo.indexOf('porVideo.get('), 'el filtro va ANTES de agrupar por video');
});

test('la retención y el scroll se dividen por los MEDIDOS; impacto y esfuerzo no se suman', () => {
  for (const id of ['scroll', 'retencion_vsl']) {
    const f = FUENTES_EXTRA.find((x) => x.id === id)!;
    for (const mm of f.metricas.filter((x) => x.razon)) assert.equal(mm.razon!.den, 'medidos', `${id}.${mm.id}: se divide por ${mm.razon!.den}, no por los medidos`);
  }
  const proy = FUENTES_EXTRA.find((x) => x.id === 'proyectos')!;
  for (const id of ['impacto', 'esfuerzo']) assert.equal(proy.metricas.find((x) => x.id === id)?.sinTotal, true, `proyectos.${id} se sumaría entre proyectos`);
});

// ── Lo mudado de los 'use client' ────────────────────────────────────────────────────────

const sv = (o: Partial<ScriptView>): ScriptView => ({
  id: 'x', adId: 'x', name: 'x', short: 'x', angle: 'dolor', avatar: '', hookType: 'promesa', format: 'Video', tags: [],
  dur: 40, hookRate: 20, ctr: 1, agendas: 0, cierres: 0, spend: 0, impressions: 30000, reach: 0, freq: 1, days: 10, lastFecha: null,
  plays3s: 0, thru: 0, finalRet: 8, beats: [], note: null, suggestion: null, thumbnail: null, permalink: null, creativeSinEnlace: false,
  campana: null, adset: null, esImagen: false, ...o,
});

test('el veredicto de un guion es el de la tab: poca muestra se valida, y si no manda el cuadrante', () => {
  assert.equal(verdictFromVals(40, 20, 5000), 'validar');
  assert.equal(verdictFromVals(30, 12, 30000), 'escalar');
  assert.equal(verdictFromVals(30, 5, 30000), 'reescribir');
  assert.equal(verdictFromVals(20, 12, 30000), 'mejorar');
  assert.equal(verdictFromVals(20, 5, 30000), 'repensar');
  assert.equal(esMuestraChica(sv({ impressions: 5000 })), true);
  assert.equal(esMuestraChica(sv({ hookRate: 30, agendas: 0, spend: 100 })), true);
  assert.equal(esMuestraChica(sv({ hookRate: 30, agendas: 2, spend: 100 })), false);
});

test('los patrones salen igual que en la tab, con el nombre del ángulo que le pasa cada pantalla', () => {
  const ads = [
    sv({ id: 'a', angle: 'dolor', spend: 40, agendas: 0 }),
    sv({ id: 'b', angle: 'dolor', spend: 30, agendas: 0 }),
    sv({ id: 'c', angle: 'oferta', spend: 100, agendas: 3 }),
  ];
  const P = buildPatterns(ads, ads, (k) => (k === 'dolor' ? 'Dolor puro' : k));
  assert.deepEqual(P.map((p) => p.key), ['concentracion', 'quemado', 'eff']);
  assert.equal(P[0].tlabel, 'son del ángulo Dolor puro');
  assert.deepEqual(P[1].ads.map((a) => a.id), ['a', 'b'], 'la plata quemada, de mayor a menor gasto');
  assert.equal(P[2].big, '30.0');
});

test('lo tocado se dice en palabras, como en «Lo más tocado»', () => {
  assert.equal(rotuloDe({ tipo: 'clic_vacio', etiqueta: 'vacio: IMG' }), 'Fuera de un botón · una imagen');
  assert.equal(rotuloDe({ tipo: 'clic_vacio', etiqueta: 'vacio: CANVAS' }), 'Fuera de un botón · una zona');
  assert.equal(rotuloDe({ tipo: 'click', etiqueta: 'boton: Agendar' }), 'Agendar');
  assert.equal(rotuloDe({ tipo: 'click', etiqueta: 'boton:' }), 'Un botón sin texto');
  assert.equal(rotuloDe({ tipo: 'click', etiqueta: 'https://negocio.com/precios — Ver precios' }), 'negocio.com/precios');
});

const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-11T12:00:00Z');
const tarea = (o: Partial<BoardTask> & { id: string }): BoardTask => ({
  num: 1, emoji: '📌', title: o.id, detalle: '', priority: 'media', score: 50, progress: 0, deadline: '', labels: [], checklist: [], historial: [], ...o,
} as unknown as BoardTask);
const hist = (dias: number, text: string) => ({ id: `${dias}${text}`, ts: AHORA - dias * DIA, actor: 'user', text }) as BoardTask['historial'][number];
const proyecto = (o: Partial<Label> & { id: string }): Label => ({ emoji: '🎯', name: o.id, color: '#000000', score: 50, detalle: '', historial: [], ...o } as Label);

test('Productividad cuenta como la tab: sin las recurrentes, y cada tarea en TODOS sus proyectos', () => {
  const labels = [proyecto({ id: 'p1', impacto: 80, esfuerzo: 20 }), proyecto({ id: 'p2', deadline: '2026-12-31' })];
  const tasks = [
    // Hecha y tarde: el deadline era el 1/10 y se completó hace 3 días.
    tarea({ id: 't1', labels: ['p1', 'p2'], progress: 100, deadline: '2026-10-01', historial: [hist(3, 'Marcó como completada'), hist(20, 'Creó la tarea')] }),
    // Alta, sin deadline y quieta hace 10 días.
    tarea({ id: 't2', labels: ['p1'], score: 80, historial: [hist(10, 'Creó la tarea')] }),
    // Se repite: no cuenta para nada.
    tarea({ id: 't3', labels: ['p1'], progress: 50, recurrente: true } as Partial<BoardTask> & { id: string }),
    // En curso, baja, y con el deadline movido dos veces.
    tarea({ id: 't4', labels: ['p2'], score: 30, progress: 50, deadline: '2026-12-01', historial: [hist(1, 'Deadline 2026-12-01'), hist(2, 'Deadline 2026-11-01')] }),
  ];
  const m = metricasProductividad(tasks, labels, AHORA);
  const p1 = m.projMeta.find((p) => p.l.id === 'p1')!;
  const p2 = m.projMeta.find((p) => p.l.id === 'p2')!;
  assert.deepEqual([p1.total, p1.done, p1.pct], [2, 1, 50], 'p1: t1 y t2, sin la recurrente');
  assert.deepEqual([p2.total, p2.done, p2.pct], [2, 1, 75], 'p2: t1 también cuenta acá');
  assert.equal(m.avanceGlobal, 63);
  assert.deepEqual(m.piramide, { alta: 1, media: 0, baja: 1, futuro: 0 });
  assert.equal(m.wip, 1);
  assert.deepEqual(m.sinDeadlineAlta.map((t) => t.id), ['t2']);
  assert.deepEqual(m.estancadas.map((x) => [x.t.id, x.dias]), [['t2', 10]]);
  assert.deepEqual(m.corridos.map((x) => [x.t.id, x.n]), [['t4', 2]]);
  assert.deepEqual(m.conDeadline.map((x) => [x.t.id, x.aTiempo]), [['t1', false]]);
  assert.deepEqual(m.projSinDeadline.map((l) => l.id), ['p1']);
  assert.deepEqual([cuadranteDe(80, 20), cuadranteDe(80, 80), cuadranteDe(20, 20), cuadranteDe(20, 80)], ['quick', 'apuesta', 'relleno', 'trampa']);
});

// ── El texto de pantalla ─────────────────────────────────────────────────────────────────
// El guard de voseo del repo enumera con `git ls-files`, que NO ve un archivo sin `git add` (AGENTS.md):
// estos archivos son nuevos, así que el guard propio los barre a mano.

/** Las palabras terminadas en á/é/í (o en ás/és/ís) que SÍ son de tú o neutras. Todo lo demás es sospechoso. */
const NEUTRAS = new Set(['más', 'está', 'aquí', 'así', 'ahí', 'allí', 'sí', 'qué', 'días', 'después', 'además', 'través', 'país', 'acá', 'estás', 'detrás']);
const CON_TEXTO = [
  'lib/graficos-plantillas-analysts.ts', 'lib/graficos-fuentes-extra.ts', 'lib/graficos-bloques-extra-catalogo.ts',
  'lib/graficos-datos-extra.ts', 'lib/graficos-bloques-extra.ts', 'lib/ads-analyst-patrones.ts', 'lib/landing-mapa-rotulo.ts',
  'lib/productividad-metricas.ts', 'app/dashboard/bloques/extra/CuerpoBloqueExtra.tsx', 'app/dashboard/bloques/extra/piezas-extra.tsx',
  'app/dashboard/bloques/extra/BloquesAds.tsx', 'app/dashboard/bloques/extra/BloquesLanding.tsx',
  'app/dashboard/bloques/extra/BloquesClosing.tsx', 'app/dashboard/bloques/extra/BloquesProductividad.tsx',
];

test('sin voseo en lo que se dibuja (el guard del repo no ve un archivo sin git add)', () => {
  // Se juntan las de TODOS los archivos antes de afirmar: con un assert por archivo, cada corrida
  // muestra sólo la primera y arreglar la lista son N vueltas.
  const malas: Record<string, string[]> = {};
  for (const ruta of CON_TEXTO) {
    const codigo = sinComentarios(leer(ruta));
    const raras = [...new Set((codigo.match(/(?<!\p{L})\p{L}+(?:á|é|í|ás|és|ís)(?!\p{L})/gu) ?? []).map((w) => w.toLowerCase()))].filter((w) => !NEUTRAS.has(w));
    const todas = [...marcasDeVoseo(codigo).map(String), ...raras];
    if (todas.length) malas[ruta] = todas;
  }
  assert.deepEqual(malas, {}, 'voseo, o palabras con su forma («pasá», «tenés»…)');
});

// ── La sidebar ───────────────────────────────────────────────────────────────────────────

test('Productivity Analyst salió de la sidebar y su ruta redirige a SU hoja; Ads, Landing y Closing siguen', () => {
  const nav = sinComentarios(leer('app/_components/nav.ts'));
  assert.doesNotMatch(nav, /href: '\/productivity-analyst'/, 'Productivity Analyst volvió a la sidebar');
  // Siguen porque tienen TAREAS que todavía no se mudaron (analizar un guion, analizar una página,
  // revisar una llamada…). Sacarlas antes deja al cliente sin la única pantalla para hacerlas.
  for (const r of ['/ads-analyst', '/landing-analyst', '/closing']) assert.match(nav, new RegExp(`href: '${r}'`), `${r} salió de la sidebar antes de mudar sus tareas`);
  const pagina = sinComentarios(leer('app/productivity-analyst/page.tsx'));
  assert.match(pagina, /redirect\(await rutaConWs\('\/dashboard\?hoja=productividad'\)\)/, 'la ruta vieja no redirige con rutaConWs');
  const prod = PLANTILLAS_ANALYSTS.find((p) => p.id === 'productividad')!;
  assert.equal(sanearHoja(prod.armar((l) => l), 0)!.id, 'productividad', 'el redirect apunta a una hoja que no existe');
});
