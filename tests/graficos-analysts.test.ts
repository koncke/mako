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
//   · Las CUATRO tabs salieron de la sidebar (Productivity el 11/10 a la mañana; Ads, Landing y Closing
//     a la tarde, con sus tareas ya mudadas: decisiones 4, 5 y 6 de Martín) y el closer ve el Dashboard.
//   · `?hoja=` lleva a la hoja de la plantilla pedida aunque tenga ids nuevos, o la AGREGA (C2,
//     `hojaDestino`): antes caía en Marketing sin avisar.
//   · El modo closer (C3): sólo la hoja Closing, y el server sólo le da lo de Closing — y la hoja no le
//     pide nada que el server le niegue.
// Que nadie vuelva a ENLAZAR las tres rutas retiradas lo cuida tests/tabs-retiradas.test.ts.
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
//
// PROBADO ROMPIÉNDOLO OTRA VEZ (11/10/2026 a la tarde, retiro de Ads, Landing y Closing; base en verde:
// 22/22). Arnés que rompe un fragmento y restaura DESHACIENDO el reemplazo (nunca con git); pasan / fallan:
//   · vuelve `{ key: 'closing', href: '/closing' }` a los Analysts            -> 21 / 1 «las cuatro tabs…»
//   · el ítem del Dashboard sin `rolesWs: ['closer']`                        -> 21 / 1 «las cuatro tabs…»
//   · hojaDestino sin el paso de la firma                                    -> 20 / 2 (los dos de la firma)
//   · paraAgregar sin acuñar los ids repetidos                               -> 21 / 1 «lo agregado no repite ids…»
//   · la firma de Comercial con el bloque `cobranza`                         -> 21 / 1 «una firma no reconoce…»
//   · closerPuedePedir deja pasar `detalle`                                  -> 21 / 1 «lo que el server le contesta…»
//   · CLOSER_CONJUNTOS sin `llamadas_dimensiones`                            -> 20 / 2 (la hoja pediría un 403)
//   · CLOSER_CONJUNTOS con `leads`                                           -> 21 / 1
//   · la ruta sin `if (closer && !closerPuedePedir(body))`                   -> 21 / 1 «el modo closer está enchufado»
//   · `guardable` sin `!soloLectura`                                         -> 21 / 1 «…enchufado»
//   · page.tsx sin la capa `closing` para el closer                          -> 21 / 1 «…enchufado»
//   · llamadaDeUrl acepta el 0                                               -> 21 / 1 «?llamada= abre la ficha…»
//   · destinoDeClosing pierde el ?ws=                                        -> 21 / 1 «?llamada= abre la ficha…»
//   · hojaDestino sin el tope de hojas                                       -> 21 / 1 «…con el informe lleno se avisa»
//   · el video con mínimo 1 × 1                                              -> 21 / 1 (C4)
// ⚠️ La primera pasada del arnés NO pudo restaurar la segunda rotura (el fragmento roto
// `icon: 'graphics', match:` ya estaba en otros ítems del nav) y las trece siguientes corrieron sobre una
// base rota, con un fallo de más cada una. Se restauró a mano y se volvieron a correr: los números de
// arriba son los de la segunda pasada. Un arnés que restaura deshaciendo tiene que exigir que el
// fragmento ROTO no exista ya en el archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLOQUES, MAX_HOJAS, campoDe, esBloque, esElemento, esGrafico, fuenteDe, hojaVacia, minimoDeElemento, sanearHoja,
  type Componente, type Tablero,
} from '../lib/graficos-catalogo';
import { FUENTES_EXTRA } from '../lib/graficos-fuentes-extra';
import { BLOQUES_EXTRA } from '../lib/graficos-bloques-extra-catalogo';
import { PLANTILLAS_ANALYSTS } from '../lib/graficos-plantillas-analysts';
import {
  CLOSER_BLOQUES, CLOSER_CONJUNTOS, PLANTILLAS_HOJA, closerPuedePedir, componentesDe, conHojaAgregada, destinoDeClosing,
  firmaDe, fuentesDeCampoCloser, hojaDestino, informeCloser, instanciarPlantilla, llamadaDeUrl, plantillaHojaDe, tableroInicial,
} from '../lib/graficos-plantillas';
import { TODOS_LOS_ITEMS } from '../app/_components/nav';
import { tabEnCapa } from '../lib/capas';
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

test('las cuatro tabs de Analysts salieron de la sidebar (sus KEYS no), y el closer ve el Dashboard', () => {
  const nav = sinComentarios(leer('app/_components/nav.ts'));
  // Ads, Landing y Closing salieron el 11/10 a la tarde, con sus tareas YA mudadas (Ads Writer, Landing
  // Generator y la ficha de la llamada en la hoja Closing). Antes de eso este test exigía lo contrario:
  // sacarlas sin mudarlas dejaba al cliente sin la única pantalla para hacerlas.
  for (const r of ['/productivity-analyst', '/ads-analyst', '/landing-analyst', '/closing']) {
    assert.doesNotMatch(nav, new RegExp(`href: '${r}'`), `${r} volvió a la sidebar`);
    assert.ok(!TODOS_LOS_ITEMS.some((i) => i.href === r || i.href.startsWith(`${r}?`) || i.href.startsWith(`${r}/`)), `un ítem de la barra apunta a ${r}`);
  }
  // Las KEYS están escritas en la base (capas, onboarding, gating de la API): no se van con el ítem.
  assert.equal(tabEnCapa('closing', 'superadmin'), true, 'la key `closing` salió de la capa: el closer perdería su hoja');
  // El closer ve el Dashboard (ve SÓLO la hoja Closing: lo cuida el test del modo closer, abajo).
  const dash = TODOS_LOS_ITEMS.find((i) => i.key === 'graphics');
  assert.ok(dash?.rolesWs?.includes('closer'), 'el closer no ve el Dashboard: se quedó sin el análisis de sus llamadas');
  const pagina = sinComentarios(leer('app/productivity-analyst/page.tsx'));
  assert.match(pagina, /redirect\(await rutaConWs\('\/dashboard\?hoja=productividad'\)\)/, 'la ruta vieja no redirige con rutaConWs');
  const prod = PLANTILLAS_ANALYSTS.find((p) => p.id === 'productividad')!;
  assert.equal(sanearHoja(prod.armar((l) => l), 0)!.id, 'productividad', 'el redirect apunta a una hoja que no existe');
});

// ── A dónde lleva `?hoja=` (C2) ────────────────────────────────────────────────────────────

/** Todos los ids de un informe que tienen que ser únicos entre hojas (componentes y controles). */
const idsRepetidos = (t: Tablero): string[] => {
  const vistos = new Set<string>();
  const rep: string[] = [];
  const ver = (id: string) => { if (vistos.has(id)) rep.push(id); vistos.add(id); };
  for (const h of t.hojas) {
    h.controles.forEach((k) => ver(k.id));
    for (const c of h.componentes) { ver(c.id); if (!esElemento(c)) c.controles.forEach((k) => ver(k.id)); }
  }
  return rep;
};

test('hojaDestino: el id exacto, después la FIRMA de la plantilla, y si no está la AGREGA con ids fijos', () => {
  const ini = tableroInicial();
  // 1 · El id exacto.
  assert.deepEqual(hojaDestino(ini, 'comercial'), { hojaId: 'comercial', agregar: null });
  // Sin pedido, o un pedido que no es ni hoja ni plantilla: la primera hoja (null).
  for (const p of [null, undefined, '', '  ', 'no-existe']) assert.deepEqual(hojaDestino(ini, p), { hojaId: null, agregar: null }, String(p));
  // 3 · La plantilla no está: se agrega con SUS ids fijos (el próximo link la encuentra por el id).
  for (const id of ['closing', 'ads-analyst', 'landing', 'productividad']) {
    const d = hojaDestino(ini, id);
    assert.ok(d.agregar, `${id}: no se agrega (el link caería en Marketing sin avisar)`);
    assert.equal(d.hojaId, id);
    assert.equal(d.agregar!.id, id, `${id}: la hoja agregada no tiene el id que nombra el link`);
    assert.deepEqual(d.agregar!.componentes.map((c) => c.id), componentesDe(plantillaHojaDe(id)!).map((c) => c.id), `${id}: no son los ids fijos`);
    // Agregada, el mismo link ya la encuentra por el id (no se agrega dos veces).
    assert.deepEqual(hojaDestino(conHojaAgregada(ini, d.agregar), id), { hojaId: id, agregar: null }, `${id}: se agregaría en cada visita`);
  }
  // 2 · La que se agregó desde «Nueva hoja» (ids NUEVOS) se reconoce por su firma.
  for (const id of ['closing', 'ads-analyst', 'landing', 'productividad']) {
    const nueva = instanciarPlantilla(plantillaHojaDe(id)!);
    assert.notEqual(nueva.id, id);
    const t: Tablero = { ...ini, hojas: [...ini.hojas, nueva] };
    assert.deepEqual(hojaDestino(t, id), { hojaId: nueva.id, agregar: null }, `${id}: la hoja de «Nueva hoja» no se reconoce y se agregaría otra`);
  }
});

test('hojaDestino: una firma no reconoce la hoja de OTRA plantilla, ni el informe inicial', () => {
  const ini = tableroInicial();
  const conFirma = ['closing', 'ads-analyst', 'landing', 'productividad', 'marketing', 'comercial'];
  for (const a of conFirma) {
    const f = firmaDe(a);
    assert.ok(f && ((f.bloques?.length ?? 0) + (f.ids?.length ?? 0)) > 0, `${a}: sin firma`);
    // Cada bloque de una firma existe en el catálogo: uno mal escrito no reconoce nada, y no da error.
    for (const b of f!.bloques ?? []) assert.ok(BLOQUES.some((x) => x.id === b), `${a}: la firma nombra el bloque ${b}, que no existe`);
    // Y la plantilla trae ALGO de su firma (si no, la hoja que arma no se reconoce a sí misma).
    const h = instanciarPlantilla(plantillaHojaDe(a)!);
    const propia = (f!.bloques ?? []).some((b) => h.componentes.some((c) => esBloque(c) && c.bloque === b));
    if (a !== 'marketing' && a !== 'comercial') assert.ok(propia, `${a}: su plantilla no trae ningún bloque de su firma`);
  }
  // La hoja de cada plantilla de la galería, instanciada sola en un informe: ninguna OTRA firma la toma
  // (la de «Cobranza» trae el bloque `cobranza`, igual que Comercial: por eso Comercial no lo usa).
  for (const p of PLANTILLAS_HOJA) {
    const t: Tablero = { v: 3, nombre: 'x', hojas: [hojaVacia('Vacía'), instanciarPlantilla(p)] };
    for (const otra of conFirma) {
      if (otra === p.id) continue;
      assert.ok(hojaDestino(t, otra).agregar, `la hoja de «${p.nombre}» se toma por la de ${otra}`);
    }
  }
  // Marketing y Comercial se reconocen por sus ids fijos, no por un bloque que comparten con otras.
  assert.equal(hojaDestino({ ...ini, hojas: [ini.hojas[1], { ...ini.hojas[0], id: 'renombrada' }] }, 'marketing').hojaId, 'renombrada');
});

test('hojaDestino: lo agregado no repite ids de otra hoja, y con el informe lleno se avisa', () => {
  // Las generales repiten nombres locales (`por-dia` está en cuatro): con ids fijos, dos hojas
  // compartirían lo elegido mirando y los datos guardados por id.
  let t = tableroInicial();
  for (const id of ['crm', 'automatizaciones', 'whatsapp', 'ia-contenido', 'cobranza', 'customer-success', 'closing']) {
    const d = hojaDestino(t, id);
    assert.ok(d.agregar, id);
    assert.equal(d.agregar!.id, id, `${id}: la hoja perdió el id que nombra el link`);
    t = conHojaAgregada(t, d.agregar);
  }
  assert.deepEqual(idsRepetidos(t), [], 'dos hojas comparten el id de un componente o un control');
  // Lleno: no hay lugar, y se dice (no cae en la primera sin avisar).
  const lleno: Tablero = { v: 3, nombre: 'x', hojas: Array.from({ length: MAX_HOJAS }, (_, i) => hojaVacia(`H${i}`)) };
  assert.deepEqual(hojaDestino(lleno, 'closing'), { hojaId: null, agregar: null, lleno: true });
  assert.equal(conHojaAgregada(lleno, informeCloser().hojas[0]).hojas.length, MAX_HOJAS);
});

test('cada link a una hoja que manda el producto abre ESA hoja en el informe inicial (ninguno cae en la primera)', () => {
  const ini = tableroInicial();
  for (const href of ['/dashboard?hoja=marketing', '/dashboard?hoja=comercial', '/dashboard?hoja=productividad', '/dashboard?hoja=closing', '/dashboard?hoja=ads-analyst', '/dashboard?hoja=landing']) {
    const pedido = new URL(href, 'https://x').searchParams.get('hoja');
    const d = hojaDestino(ini, pedido);
    assert.equal(d.hojaId, pedido, `${href}: abre otra hoja`);
  }
});

// ── El closer: la hoja Closing y nada más (C3) ─────────────────────────────────────────────

test('el closer ve SÓLO la hoja Closing, y esa hoja no le pide al server nada que el server le niegue', () => {
  const t = informeCloser();
  assert.deepEqual(t.hojas.map((h) => h.id), ['closing']);
  const h = t.hojas[0];
  assert.ok(h.componentes.length >= 8, 'la hoja del closer vino vacía');
  for (const c of h.componentes) {
    if (esGrafico(c)) {
      assert.ok(CLOSER_CONJUNTOS.includes(c.fuente), `${c.id}: pide «${c.fuente}», que al closer le da 403`);
      assert.ok(closerPuedePedir({ accion: 'datos', pedidos: [{ grafico: c, desde: '2026-01-01', hasta: '2026-10-11' }] }), `${c.id}: el server se lo niega`);
    } else if (esBloque(c)) {
      assert.ok(CLOSER_BLOQUES.includes(c.bloque), `${c.id}: el bloque ${c.bloque} al closer le da 403`);
    }
    if (!esElemento(c)) for (const k of c.controles) if (k.campo) assert.ok(fuentesDeCampoCloser(k.campo).length, `${c.id}: el filtro ${k.campo} al closer le da 403`);
  }
  for (const k of h.controles) if (k.campo) assert.ok(fuentesDeCampoCloser(k.campo).length, `la barra filtra por ${k.campo}, que al closer le da 403`);
});

test('lo que el server le contesta a un closer: datos y bloques de Closing, valores de sus campos, y nada más', () => {
  const g = (fuente: string) => ({ grafico: { id: 'x', clase: 'grafico', tipo: 'numero', fuente, metricas: [] }, desde: '2026-10-01', hasta: '2026-10-11' });
  assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [g('llamadas_venta'), g('llamadas_dimensiones')] }), true);
  assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [] }), true, 'una lista vacía no pide nada');
  // La plata, los leads y la pauta, no. Y uno de afuera cierra la lista entera.
  for (const f of ['negocio', 'leads', 'pagos', 'meta']) assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [g(f)] }), false, f);
  assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [g('llamadas_venta'), g('pagos')] }), false, 'uno de afuera se cuela en una lista');
  assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [{ grafico: null }] }), false, 'un pedido que no se entiende pasa');
  assert.equal(closerPuedePedir({ accion: 'bloques', pedidos: [{ id: 'a', bloque: 'embudo_cierre' }, { id: 'b', bloque: 'closers_cierre' }] }), true);
  for (const b of ['revenue', 'cobranza', 'mapa_calor', 'patrones_guiones', '']) assert.equal(closerPuedePedir({ accion: 'bloques', pedidos: [{ id: 'a', bloque: b }] }), false, b);
  // Valores: «Closer» es un campo de los leads TAMBIÉN; al closer se le recorta a las llamadas.
  assert.equal(closerPuedePedir({ accion: 'valores', campo: 'closer' }), true);
  assert.ok(!fuentesDeCampoCloser('closer').includes('leads'), 'los valores de «Closer» se leerían de los leads');
  assert.deepEqual(fuentesDeCampoCloser('closer', ['leads']), [], 'pidiendo sólo los leads, algo pasa');
  assert.deepEqual(fuentesDeCampoCloser('closer', ['llamadas_venta', 'leads']), ['llamadas_venta']);
  assert.ok(campoDe('leads.etapa'), 'el caso de prueba ya no existe en el catálogo');
  assert.equal(closerPuedePedir({ accion: 'valores', campo: 'leads.etapa' }), false);
  // Guardar, el detalle de un número, lo desconocido: no.
  for (const accion of ['guardar', 'detalle', 'otra', undefined]) assert.equal(closerPuedePedir({ accion, tablero: {}, pedidos: [] }), false, String(accion));
  assert.equal(closerPuedePedir(null), false);
});

test('el modo closer está enchufado: la página, la ruta y la pantalla (leyendo el fuente)', () => {
  const pagina = sinComentarios(leer('app/dashboard/page.tsx'));
  assert.match(pagina, /requireRolWs\(\['closer'\], \{ nav: 'graphics' \}\)/, 'el closer no entra al Dashboard');
  assert.match(pagina, /tabEnCapa\('closing', capa\)/, 'un closer sin Closing en su capa vería la hoja');
  assert.match(pagina, /tablero = informeCloser\(\)/, 'el closer no recibe el informe en memoria');
  assert.match(pagina, /soloLectura=\{closer\}/);
  assert.match(pagina, /hojaDestino\(tablero, pedida\)/, '?hoja= dejó de pasar por hojaDestino');
  const ruta = sinComentarios(leer('app/api/graficos/route.ts'));
  assert.match(ruta, /if \(rol !== 'admin' && rol !== 'closer'\) return err\(403/);
  assert.match(ruta, /if \(closer && !closerPuedePedir\(body\)\) return err\(403/, 'la ruta no frena al closer');
  assert.match(ruta, /\? fuentesDeCampoCloser\(body\.campo, body\.fuentes\)/, 'los valores del closer no se recortan a las llamadas');
  // El closer sólo llega a lo de Closing ANTES de cualquier acción: el chequeo va antes del primer `accion ===`.
  assert.ok(ruta.indexOf('closerPuedePedir(body)') < ruta.indexOf("body.accion === 'guardar'"), 'el chequeo del closer va después de guardar');
  const ed = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  assert.match(ed, /const guardable = !lecturaFallo && !soloLectura;/, 'el closer podría guardar');
  assert.match(ed, /\{!soloLectura && \(\s*<span className="lk-analista"/, 'el closer ve el AI Analyst');
  assert.match(ed, /\{!soloLectura && \(\s*<button type="button" className="lk-pill lk-pill--azul" data-recorrido=\{editando \? 'dash-ver' : 'dash-editar'\}/, 'el closer ve Editar');
  assert.match(ed, /onDetalle=\{editando \|\| soloLectura \? undefined :/, 'el closer abre el detalle de un número (403)');
  assert.match(ed, /\{est\.resultado && !soloLectura && \(/, 'el closer ve el chat de MaKo de cada gráfico');
});

test('?llamada= abre la ficha: un entero positivo o nada, y /closing?call= se traduce', () => {
  assert.equal(llamadaDeUrl('123'), 123);
  assert.equal(llamadaDeUrl([' 77 ']), 77);
  for (const v of ['', 'abc', '-5', '0', '1.5', '1e3', '99999999999999999', undefined, null, 12]) assert.equal(llamadaDeUrl(v), null, String(v));
  const u = (sp: Record<string, string | string[] | undefined>) => new URL(destinoDeClosing(sp), 'https://x');
  const a = u({ call: '987', ws: '3', utm_source: 'wa' });
  assert.equal(a.pathname, '/dashboard');
  assert.equal(a.searchParams.get('hoja'), 'closing');
  assert.equal(a.searchParams.get('llamada'), '987');
  assert.equal(a.searchParams.get('ws'), '3', 'se pierde el ?ws= del link');
  assert.equal(a.searchParams.get('utm_source'), 'wa');
  assert.equal(a.searchParams.has('call'), false);
  const b = u({ call: 'basura', hoja: 'marketing' });
  assert.equal(b.searchParams.get('hoja'), 'closing', 'un ?hoja= viejo pisa el destino');
  assert.equal(b.searchParams.has('llamada'), false, 'un call que no es un id abre una ficha vacía');
  assert.equal(destinoDeClosing({}), '/dashboard?hoja=closing');
  // Y la pantalla la monta: page.tsx la valida con la misma función y EditorInforme abre FichaLlamada.
  assert.match(sinComentarios(leer('app/dashboard/page.tsx')), /const llamada = llamadaDeUrl\(p\.llamada\);/);
  const ed = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  assert.match(ed, /\{llamada != null && <FichaLlamada recordingId=\{llamada\} onCerrar=\{cerrarLlamada\}/);
  assert.match(ed, /qs\.delete\('llamada'\);[\s\S]{0,120}window\.history\.replaceState\(null, '', conWs\(/, 'al cerrar, la llamada no se va de la URL');
});

test('un video o una página insertada no se achican por debajo de 3 × 4 en la grilla (C4)', () => {
  const ed = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  // El mínimo de un elemento sale del catálogo (TIPOS_ELEMENTO), no de una tabla propia del editor.
  assert.match(ed, /const minimoDe = \(c: Componente\): \{ w: number; h: number \} => \(esElemento\(c\) \? minimoDeElemento\(c\.tipo\) : \{ w: 2, h: 2 \}\);/);
  for (const t of ['video', 'insertado']) assert.deepEqual(minimoDeElemento(t), { w: 3, h: 4 }, t);
  assert.match(ed, /const m = minimoDe\(c\); return \{ i: c\.id, x: c\.x, y: c\.y, w: c\.w, h: c\.h, minW: m\.w, minH: m\.h \};/);
});
