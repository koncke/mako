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
//
// TANDA v5 (12/10/2026): los bloques se fueron, así que lo de arriba que nombraba un bloque cambió:
//   · Son SIETE plantillas: las cuatro de antes y VSL, CS y Chat Analyst (punto 22). Que ninguna traiga un bloque
//     y que cada gráfico pase el saneo sin cambiar lo cuida tests/graficos-plantillas-v5.test.ts, sobre TODAS.
//   · `?hoja=` pregunta PRIMERO de qué plantilla nació la hoja (`Hoja.plantilla`); la FIRMA por bloque murió con
//     los bloques y queda la de ids fijos (Marketing y Comercial) de respaldo.
//   · El desplegable «Analysts» salió entero de la sidebar, y el SETTER ve SÓLO la hoja Chat Analyst, como el
//     closer con Closing: los tests del modo closer son ahora de los dos roles (`HOJA_DE_ROL`).
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
//   Y la tanda de la TOPBAR (11/10/2026, corrido junto con tests/dashboard-topbar.test.ts, base 35 / 0):
//   · `guardable` sin `!compartido`                                         -> 33 / 2 «…enchufado» y el del link
//   · el detalle de un número con `soloLectura` en vez de `soloMirar`         -> 33 / 2 los mismos dos
// ⚠️ La primera pasada del arnés NO pudo restaurar la segunda rotura (el fragmento roto
// `icon: 'graphics', match:` ya estaba en otros ítems del nav) y las trece siguientes corrieron sobre una
// base rota, con un fallo de más cada una. Se restauró a mano y se volvieron a correr: los números de
// arriba son los de la segunda pasada. Un arnés que restaura deshaciendo tiene que exigir que el
// fragmento ROTO no exista ya en el archivo.
//
// PROBADO ROMPIÉNDOLO EN v5 (12/10/2026; base en verde: 22 pasan, 0 fallan). Arnés que rompe un fragmento y
// restaura DE MEMORIA, con el hash comparado (nunca con git), y que se niega si el fragmento roto ya existe
// afuera; pasan / fallan:
//   · hojaDestino sin el paso de `Hoja.plantilla`                            -> 21 / 1 «…la hoja que NACIÓ de la plantilla…»
//   · HOJA_DE_ROL sin el setter                                              -> 20 / 2 (los dos del rol con hoja única)
//   · SETTER_CONJUNTOS sin `conversaciones`                                  -> 20 / 2 (su hoja pediría un 403)
//   · SETTER_CONJUNTOS con `mako_chat`                                       -> 21 / 1 «lo que el server le contesta…»
//   · el ítem del Dashboard sin el setter (`rolesWs: ['closer']`)            -> 21 / 1 «las tabs de Analysts salieron…»
//   · page.tsx sin el setter en `requireRolWs`                               -> 21 / 1 «el modo de un rol está enchufado»
//   · la ruta sin `if (unica && !puedePedir(rol, body))`                     -> 21 / 1 «…enchufado»
//   · el pop-up del rol buscado en el informe guardado (no en el de memoria) -> 21 / 1 «…enchufado»
//   · PLANTILLAS_REEMPLAZADAS sin `whatsapp`                                 -> 21 / 1 «las plantillas que se fueron…»
//   · Chat Analyst con un gráfico de `mako_chat` (al setter le daría 403)    -> 21 / 1 «cada rol con hoja única ve SÓLO su hoja…»
//   · vuelve el ítem «pronto» de VSL Analyst a la sidebar                     -> 21 / 1 «las tabs de Analysts salieron…»
//   · /vsl-analyst redirige sin `rutaConWs`                                  -> 21 / 1 «las tabs de Analysts salieron…»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_HOJAS, campoDe, esElemento, esGrafico, fuenteDe, hojaVacia, minimoDeElemento, sanearHoja,
  type Componente, type Hoja, type Tablero,
} from '../lib/graficos-catalogo';
import { FUENTES_EXTRA } from '../lib/graficos-fuentes-extra';
import { PLANTILLAS_ANALYSTS } from '../lib/graficos-plantillas-analysts';
import {
  CLOSER_CONJUNTOS, HOJA_DE_ROL, PLANTILLAS_HOJA, SETTER_CONJUNTOS, closerPuedePedir, componentesDe, conHojaAgregada, destinoDeClosing,
  firmaDe, fuentesDeCampoCloser, fuentesDeCampoDeRol, hojaDeRol, hojaDestino, informeCloser, informeDeRol, instanciarPlantilla,
  llamadaDeUrl, plantillaHojaDe, puedePedir, tableroInicial,
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

type Crudo = Record<string, unknown> & { id: string; clase?: string; tipo?: string; controles?: Array<Record<string, unknown>> };

/** Las siete, en el orden del CAMINO del negocio que tenía el desplegable (el anuncio, la página, el video, el chat, la llamada, el cliente, el tablero). */
const IDS_ANALYSTS = ['ads-analyst', 'landing', 'vsl-analyst', 'chat-analyst', 'closing', 'cs-analyst', 'productividad'];

test('cada plantilla de Analysts sobrevive al saneo SIN PERDER NADA (componentes, métricas, dimensiones, controles)', () => {
  assert.deepEqual(PLANTILLAS_ANALYSTS.map((p) => p.id), IDS_ANALYSTS);
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
      // v5: sin bloques. Un elemento (la caja de IA, el botón de Closing) sigue siendo ESE elemento.
      assert.notEqual(c.clase, 'bloque', `${p.id}/${c.id}: un bloque (se fueron en v5)`);
      if (c.clase === 'elemento') {
        assert.ok(esElemento(s!) && s.tipo === c.tipo, `${p.id}/${c.id}: el elemento ${String(c.tipo)} no sobrevivió`);
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
        assert.equal(!!sk?.fijo, k.fijo === true, `${p.id}/${c.id}: el control ${String(k.id)} perdió el «fijo»`);
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

// (El test «cada bloque nuevo se lee en datosDeBloquesExtra y se dibuja en CuerpoBloqueExtra» se fue en v5: los
// bloques salieron del catálogo y nada los ofrece, así que fijaba código sin call site. Los archivos de los
// bloques quedan hasta que el último que los nombra los suelte: ver «NO HICE» del paquete P8.)

// v5 (P2): el filtro del video vive en el SQL del resumen y en su gemelo en memoria (`resumirEventos`), y
// `videosDelPeriodo` lee el RESUMEN, no los eventos crudos.
test('la retención del video sólo lee eventos DEL VIDEO: un clic o un scroll no son un play', () => {
  const vr = sinComentarios(leer('lib/vsl-retencion.ts'));
  const i = vr.indexOf('export function resumirEventos'); const res = vr.slice(i, vr.indexOf('\n}\n', i));
  const k = res.indexOf('if (!esEventoDeVideo(e.tipo_evento)) continue;');
  assert.ok(k >= 0 && k < res.indexOf('grupos.get('), 'resumirEventos agrupa cualquier evento (un clic armaría un video «Sin identificar»)');
  const src = sinComentarios(leer('lib/graficos-datos-extra.ts')); const ini = src.indexOf('export async function videosDelPeriodo');
  assert.match(src.slice(ini, src.indexOf('async function filasRetencionVsl', ini)), /leerResumenVsl\(rg, visitantes\)/);
});

test('la retención y el scroll se dividen por los MEDIDOS; impacto y esfuerzo no se suman', () => {
  for (const id of ['scroll', 'retencion_vsl']) {
    const f = FUENTES_EXTRA.find((x) => x.id === id)!;
    // `siguen` (la curva por corte) se divide por los medidos de ESE corte: fuera de la dimensión `corte`,
    // dividir por `medidos` daría un 0% inventado (P2, v5).
    for (const mm of f.metricas.filter((x) => x.razon)) {
      const den = id === 'retencion_vsl' && mm.id === 'siguen' ? 'medidos_corte' : 'medidos';
      assert.equal(mm.razon!.den, den, `${id}.${mm.id}: se divide por ${mm.razon!.den}, no por ${den}`);
    }
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
// v5: las plantillas (con las tres hojas nuevas y los pop-ups) y los lectores; los bloques se fueron del catálogo,
// y sus archivos ya están en el índice (el guard del repo los ve).
const CON_TEXTO = [
  'lib/graficos-plantillas-analysts.ts', 'lib/graficos-plantillas.ts', 'lib/graficos-plantillas-generales.ts',
  'lib/graficos-fuentes-extra.ts', 'lib/graficos-datos-extra.ts', 'lib/ads-analyst-patrones.ts', 'lib/landing-mapa-rotulo.ts',
  'lib/productividad-metricas.ts', 'app/vsl-analyst/page.tsx', 'app/cs-analyst/page.tsx', 'app/chat-analyst/page.tsx',
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

test('las tabs de Analysts salieron de la sidebar (el desplegable entero), y el closer y el setter ven el Dashboard', () => {
  const nav = sinComentarios(leer('app/_components/nav.ts'));
  // Ads, Landing y Closing salieron el 11/10 a la tarde, con sus tareas YA mudadas (Ads Writer, Landing
  // Generator y la ficha de la llamada en la hoja Closing). Antes de eso este test exigía lo contrario:
  // sacarlas sin mudarlas dejaba al cliente sin la única pantalla para hacerlas. VSL, CS y Chat, el 12/10 (v5).
  for (const r of ['/productivity-analyst', '/ads-analyst', '/landing-analyst', '/closing', '/vsl-analyst', '/cs-analyst', '/chat-analyst']) {
    assert.doesNotMatch(nav, new RegExp(`href: '${r}'`), `${r} volvió a la sidebar`);
    assert.ok(!TODOS_LOS_ITEMS.some((i) => i.href === r || i.href.startsWith(`${r}?`) || i.href.startsWith(`${r}/`)), `un ítem de la barra apunta a ${r}`);
  }
  // El desplegable «Analysts» ya no existe (Martín, punto 22: «elimina por completo el desplegable»).
  assert.doesNotMatch(nav, /key: 'analysts'/, 'volvió el desplegable «Analysts»');
  assert.ok(!TODOS_LOS_ITEMS.some((i) => ['vsl-an', 'chat-analyst', 'cs-analyst'].includes(i.key)), 'volvió un ítem «pronto» de los Analysts');
  // Las KEYS de antes están escritas en la base (capas, onboarding, gating de la API): no se van con el ítem.
  assert.equal(tabEnCapa('closing', 'superadmin'), true, 'la key `closing` salió de la capa: el closer perdería su hoja');
  // El closer y el setter ven el Dashboard (cada uno SÓLO su hoja: lo cuida el test del modo de un rol, abajo).
  const dash = TODOS_LOS_ITEMS.find((i) => i.key === 'graphics');
  assert.ok(dash?.rolesWs?.includes('closer'), 'el closer no ve el Dashboard: se quedó sin el análisis de sus llamadas');
  assert.ok(dash?.rolesWs?.includes('setter'), 'el setter no ve el Dashboard: se quedó sin su Chat Analyst');
  const redirige: Array<[string, string]> = [
    ['app/productivity-analyst/page.tsx', 'productividad'], ['app/vsl-analyst/page.tsx', 'vsl-analyst'],
    ['app/cs-analyst/page.tsx', 'cs-analyst'], ['app/chat-analyst/page.tsx', 'chat-analyst'],
  ];
  for (const [f, hoja] of redirige) {
    const pagina = sinComentarios(leer(f));
    assert.match(pagina, new RegExp(`redirect\\(await rutaConWs\\('/dashboard\\?hoja=${hoja}'\\)\\)`), `${f}: no redirige con rutaConWs`);
    const p = PLANTILLAS_ANALYSTS.find((x) => x.id === hoja)!;
    assert.equal(sanearHoja(p.armar((l) => l), 0)!.id, hoja, `${f}: el redirect apunta a una hoja que no existe`);
  }
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

test('hojaDestino: el id exacto, después la hoja que NACIÓ de la plantilla, y si no está la AGREGA con ids fijos', () => {
  const ini = tableroInicial();
  // 1 · El id exacto.
  assert.deepEqual(hojaDestino(ini, 'comercial'), { hojaId: 'comercial', agregar: null });
  // Sin pedido, o un pedido que no es ni hoja ni plantilla: la primera hoja (null).
  for (const p of [null, undefined, '', '  ', 'no-existe']) assert.deepEqual(hojaDestino(ini, p), { hojaId: null, agregar: null }, String(p));
  // 4 · La plantilla no está: se agrega con SUS ids fijos (el próximo link la encuentra por el id), y dice de
  //     qué plantilla nació.
  for (const id of IDS_ANALYSTS) {
    const d = hojaDestino(ini, id);
    assert.ok(d.agregar, `${id}: no se agrega (el link caería en Marketing sin avisar)`);
    assert.equal(d.hojaId, id);
    assert.equal(d.agregar!.id, id, `${id}: la hoja agregada no tiene el id que nombra el link`);
    assert.equal(d.agregar!.plantilla, id, `${id}: la hoja agregada no dice de qué plantilla nació`);
    assert.deepEqual(d.agregar!.componentes.map((c) => c.id), componentesDe(plantillaHojaDe(id)!).map((c) => c.id), `${id}: no son los ids fijos`);
    // Agregada, el mismo link ya la encuentra por el id (no se agrega dos veces).
    assert.deepEqual(hojaDestino(conHojaAgregada(ini, d.agregar), id), { hojaId: id, agregar: null }, `${id}: se agregaría en cada visita`);
  }
  // 2 · La que se agregó desde «Nueva hoja» (ids NUEVOS) se reconoce por la plantilla de la que nació.
  for (const id of IDS_ANALYSTS) {
    const nueva = instanciarPlantilla(plantillaHojaDe(id)!);
    assert.notEqual(nueva.id, id);
    const t: Tablero = { ...ini, hojas: [...ini.hojas, nueva] };
    assert.deepEqual(hojaDestino(t, id), { hojaId: nueva.id, agregar: null }, `${id}: la hoja de «Nueva hoja» no se reconoce y se agregaría otra`);
  }
  // Y la de un informe guardado ANTES de v5: sus bloques se migran en el saneo, que le pone la plantilla que
  // delataban (lib/graficos-migrar-v5.ts). Sin eso, cada visita a /closing le agregaba otra hoja Closing.
  const vieja = sanearHoja({ id: 'gviejacl', nombre: 'Closing', componentes: [{ id: 'gx1', clase: 'bloque', bloque: 'embudo_cierre', x: 0, y: 0, w: 6, h: 10 }] }, 0)!;
  assert.equal(vieja.plantilla, 'closing', 'la migración no le puso la plantilla a la hoja vieja');
  assert.deepEqual(hojaDestino({ ...ini, hojas: [...ini.hojas, vieja] }, 'closing'), { hojaId: 'gviejacl', agregar: null });
});

test('hojaDestino: la plantilla de una hoja no la toma OTRA, y la FIRMA de respaldo reconoce Marketing y Comercial de antes', () => {
  const ini = tableroInicial();
  // La hoja de cada plantilla de la galería, instanciada sola en un informe: ninguna OTRA plantilla la toma.
  const pedidos = PLANTILLAS_HOJA.map((p) => p.id);
  for (const p of PLANTILLAS_HOJA) {
    const t: Tablero = { v: 3, nombre: 'x', hojas: [hojaVacia('Vacía'), instanciarPlantilla(p)] };
    for (const otra of pedidos) {
      if (otra === p.id) continue;
      assert.ok(hojaDestino(t, otra).agregar, `la hoja de «${p.nombre}» se toma por la de ${otra}`);
    }
  }
  // La firma de respaldo: los ids fijos del informe inicial, que una hoja guardada antes de v5 (sin
  // `plantilla`) todavía tiene. Cada uno existe en su plantilla (uno mal escrito no reconoce nada, sin error).
  for (const a of ['marketing', 'comercial']) {
    const f = firmaDe(a);
    assert.ok(f && f.ids.length > 1, `${a}: sin firma`);
    const fijos = new Set([a, ...componentesDe(plantillaHojaDe(a)!).map((c) => c.id)]);
    for (const id of f!.ids) assert.ok(fijos.has(id), `${a}: la firma nombra «${id}», que su plantilla no trae`);
    const sinPlantilla: Hoja = { ...ini.hojas.find((h) => h.id === a)!, id: 'renombrada', plantilla: undefined };
    const t: Tablero = { ...ini, hojas: [ini.hojas.find((h) => h.id !== a)!, sinPlantilla] };
    assert.equal(hojaDestino(t, a).hojaId, 'renombrada', `${a}: una hoja de antes, renombrada, no se reconoce por sus ids fijos`);
  }
  // Las de Analysts ya no tienen firma: las reconoce su `plantilla` (la firma por bloque murió con los bloques).
  for (const a of IDS_ANALYSTS) assert.equal(firmaDe(a), undefined, `${a}: volvió una firma`);
});

test('hojaDestino: lo agregado no repite ids de otra hoja (ni adentro de un pop-up), y con el informe lleno se avisa', () => {
  // Las generales repiten nombres locales (`por-dia` está en tres): con ids fijos, dos hojas
  // compartirían lo elegido mirando y los datos guardados por id.
  let t = tableroInicial();
  for (const id of ['crm', 'automatizaciones', 'ia-contenido', 'cobranza', 'cs-analyst', 'chat-analyst', 'vsl-analyst', 'closing', 'ads-analyst']) {
    const d = hojaDestino(t, id);
    assert.ok(d.agregar, id);
    assert.equal(d.agregar!.id, id, `${id}: la hoja perdió el id que nombra el link`);
    t = conHojaAgregada(t, d.agregar);
  }
  assert.deepEqual(idsRepetidos(t), [], 'dos hojas comparten el id de un componente o un control');
  // Una hoja con los MISMOS ids fijos ya en el informe (una copia con otro id): se acuñan de nuevo, y la caja
  // de IA sigue leyendo SU gráfico renombrado (no el de la otra hoja).
  const copia: Hoja = { ...informeCloser().hojas[0], id: 'otra-hoja', plantilla: undefined };
  const t2: Tablero = { ...tableroInicial(), hojas: [...tableroInicial().hojas, copia] };
  const d2 = hojaDestino(t2, 'closing');
  assert.ok(d2.agregar, 'la plantilla no se agrega');
  const conDos = conHojaAgregada(t2, d2.agregar);
  assert.deepEqual(idsRepetidos(conDos), [], 'la plantilla agregada repite los ids de la copia');
  const caja = d2.agregar!.componentes.find((c) => c.clase === 'elemento' && c.tipo === 'ia' && c.ia?.fuentes?.length);
  const leida = caja && caja.clase === 'elemento' ? caja.ia!.fuentes![0] : null;
  assert.ok(leida && d2.agregar!.componentes.some((c) => c.id === leida), 'la caja de IA quedó leyendo un gráfico de OTRA hoja');
  const popup = d2.agregar!.componentes.find((c) => c.clase === 'grafico' && c.popup);
  const ajenos = new Set(copia.componentes.flatMap((c) => (c.clase === 'grafico' && c.popup ? c.popup.componentes.map((x) => x.id) : [])));
  assert.ok(popup && popup.clase === 'grafico' && popup.popup!.componentes.every((x) => !ajenos.has(x.id)), 'el pop-up agregado repite los ids del de la copia');
  // Lleno: no hay lugar, y se dice (no cae en la primera sin avisar).
  const lleno: Tablero = { v: 3, nombre: 'x', hojas: Array.from({ length: MAX_HOJAS }, (_, i) => hojaVacia(`H${i}`)) };
  assert.deepEqual(hojaDestino(lleno, 'closing'), { hojaId: null, agregar: null, lleno: true });
  assert.equal(conHojaAgregada(lleno, informeCloser().hojas[0]).hojas.length, MAX_HOJAS);
});

test('las plantillas que se fueron llevan a las que las reemplazan (WhatsApp → Chat Analyst, Customer Success → CS Analyst)', () => {
  // AGENTS.md, «Sacar algo de un catálogo no es borrarlo»: un link o un agente de la API que nombre la vieja.
  assert.equal(plantillaHojaDe('whatsapp')?.id, 'chat-analyst');
  assert.equal(plantillaHojaDe('customer-success')?.id, 'cs-analyst');
  assert.ok(!PLANTILLAS_HOJA.some((p) => p.id === 'whatsapp' || p.id === 'customer-success'), 'volvió una general reemplazada');
  const ini = tableroInicial();
  const d = hojaDestino(ini, 'whatsapp');
  assert.equal(d.agregar?.id, 'chat-analyst');
  // Agregada, el link viejo la encuentra (no agrega otra).
  assert.deepEqual(hojaDestino(conHojaAgregada(ini, d.agregar), 'whatsapp'), { hojaId: 'chat-analyst', agregar: null });
  assert.deepEqual(hojaDestino(conHojaAgregada(ini, d.agregar), 'customer-success').agregar?.id, 'cs-analyst');
});

test('cada link a una hoja que manda el producto abre ESA hoja en el informe inicial (ninguno cae en la primera)', () => {
  const ini = tableroInicial();
  for (const href of ['/dashboard?hoja=marketing', '/dashboard?hoja=comercial', '/dashboard?hoja=productividad', '/dashboard?hoja=closing', '/dashboard?hoja=ads-analyst', '/dashboard?hoja=landing',
    '/dashboard?hoja=vsl-analyst', '/dashboard?hoja=cs-analyst', '/dashboard?hoja=chat-analyst']) {
    const pedido = new URL(href, 'https://x').searchParams.get('hoja');
    const d = hojaDestino(ini, pedido);
    assert.equal(d.hojaId, pedido, `${href}: abre otra hoja`);
  }
});

// ── La hoja ÚNICA de un rol: el closer ve Closing, el setter ve Chat Analyst (C3 y v5) ──────────

test('cada rol con hoja única ve SÓLO su hoja, y esa hoja (con sus pop-ups) no le pide al server nada que el server le niegue', () => {
  assert.deepEqual(Object.keys(HOJA_DE_ROL).sort(), ['closer', 'setter'], 'un rol nuevo con hoja única: ¿qué ve?');
  assert.equal(hojaDeRol('admin'), null, 'el admin no tiene hoja única');
  assert.equal(informeDeRol('admin'), null);
  for (const [rol, plantilla, conjuntos] of [['closer', 'closing', CLOSER_CONJUNTOS], ['setter', 'chat-analyst', SETTER_CONJUNTOS]] as const) {
    const t = informeDeRol(rol)!;
    assert.deepEqual(t.hojas.map((h) => h.id), [plantilla], `${rol}: ve otra cosa que su hoja`);
    assert.equal(hojaDeRol(rol)!.plantilla, plantilla);
    const h = t.hojas[0];
    assert.ok(h.componentes.length >= 8, `${rol}: su hoja vino vacía`);
    const todos = h.componentes.flatMap((c) => (esGrafico(c) && c.popup ? [c, ...c.popup.componentes] : [c]));
    for (const c of todos) {
      if (esGrafico(c)) {
        assert.ok(conjuntos.includes(c.fuente), `${rol}/${c.id}: pide «${c.fuente}», que le da 403`);
        assert.ok(puedePedir(rol, { accion: 'datos', pedidos: [{ grafico: c, desde: '2026-01-01', hasta: '2026-10-11' }] }), `${rol}/${c.id}: el server se lo niega`);
      }
      assert.notEqual(c.clase, 'bloque', `${rol}/${c.id}: un bloque`);
      if (!esElemento(c)) for (const k of c.controles) if (k.campo) assert.ok(fuentesDeCampoDeRol(rol, k.campo).length, `${rol}/${c.id}: el filtro ${k.campo} le da 403`);
    }
    for (const k of h.controles) if (k.campo) assert.ok(fuentesDeCampoDeRol(rol, k.campo).length, `${rol}: la barra filtra por ${k.campo}, que le da 403`);
  }
  // Los nombres de antes siguen siendo los del closer.
  assert.deepEqual(informeCloser(), informeDeRol('closer'));
});

test('lo que el server le contesta a un rol con hoja única: datos de sus conjuntos, valores de sus campos, y nada más', () => {
  const g = (fuente: string) => ({ grafico: { id: 'x', clase: 'grafico', tipo: 'numero', fuente, metricas: [] }, desde: '2026-10-01', hasta: '2026-10-11' });
  // El closer: las llamadas.
  assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [g('llamadas_venta'), g('llamadas_dimensiones')] }), true);
  assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [] }), true, 'una lista vacía no pide nada');
  // La plata, los leads y la pauta, no. Y uno de afuera cierra la lista entera.
  for (const f of ['negocio', 'leads', 'pagos', 'meta', 'whatsapp']) assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [g(f)] }), false, f);
  assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [g('llamadas_venta'), g('pagos')] }), false, 'uno de afuera se cuela en una lista');
  assert.equal(closerPuedePedir({ accion: 'datos', pedidos: [{ grafico: null }] }), false, 'un pedido que no se entiende pasa');
  // Los bloques se fueron (v5): ninguno pasa.
  for (const b of ['embudo_cierre', 'revenue', 'cobranza', '']) assert.equal(closerPuedePedir({ accion: 'bloques', pedidos: [{ id: 'a', bloque: b }] }), false, b);
  // Valores: «Closer» es un campo de los leads TAMBIÉN; al closer se le recorta a las llamadas.
  assert.equal(closerPuedePedir({ accion: 'valores', campo: 'closer' }), true);
  assert.ok(!fuentesDeCampoCloser('closer').includes('leads'), 'los valores de «Closer» se leerían de los leads');
  assert.deepEqual(fuentesDeCampoCloser('closer', ['leads']), [], 'pidiendo sólo los leads, algo pasa');
  assert.deepEqual(fuentesDeCampoCloser('closer', ['llamadas_venta', 'leads']), ['llamadas_venta']);
  assert.ok(campoDe('leads.etapa'), 'el caso de prueba ya no existe en el catálogo');
  assert.equal(closerPuedePedir({ accion: 'valores', campo: 'leads.etapa' }), false);
  // El setter: los mensajes, las conversaciones y las automatizaciones. Ni las llamadas, ni la plata, ni MaKo.
  assert.equal(puedePedir('setter', { accion: 'datos', pedidos: [g('whatsapp'), g('conversaciones'), g('envios'), g('inscripciones')] }), true);
  for (const f of ['llamadas_venta', 'pagos', 'leads', 'mako_chat', 'negocio']) assert.equal(puedePedir('setter', { accion: 'datos', pedidos: [g(f)] }), false, `setter: ${f}`);
  // «Setter» es un campo de los leads TAMBIÉN: al setter se le recorta a las conversaciones.
  assert.equal(puedePedir('setter', { accion: 'valores', campo: 'setter' }), true);
  assert.ok(!fuentesDeCampoDeRol('setter', 'setter').includes('leads'), 'los valores de «Setter» se leerían de los leads');
  assert.equal(puedePedir('setter', { accion: 'valores', campo: 'closer' }), false, 'el setter lee los closers');
  // Guardar, el detalle de un número, lo desconocido: no, para ninguno. El admin, todo; un rol sin hoja, nada.
  for (const rol of ['closer', 'setter']) {
    for (const accion of ['guardar', 'detalle', 'otra', undefined]) assert.equal(puedePedir(rol, { accion, tablero: {}, pedidos: [] }), false, `${rol}: ${String(accion)}`);
    assert.equal(puedePedir(rol, null), false);
  }
  assert.equal(puedePedir('admin', { accion: 'guardar' }), true);
  assert.equal(puedePedir('otro', { accion: 'datos', pedidos: [] }), false, 'un rol desconocido pasa');
});

test('el modo de un rol está enchufado: la página, la ruta y la pantalla (leyendo el fuente)', () => {
  const pagina = sinComentarios(leer('app/dashboard/page.tsx'));
  assert.match(pagina, /requireRolWs\(\['closer', 'setter'\], \{ nav: 'graphics' \}\)/, 'el closer o el setter no entran al Dashboard');
  assert.match(pagina, /const unica = hojaDeRol\(rol\);/);
  assert.match(pagina, /if \(!tabEnCapa\(unica\.capa, capa\)\) redirect\(/, 'un rol sin la capa de su hoja la vería');
  assert.match(pagina, /const enMemoria = informeDeRol\(rol\);/, 'el rol no recibe el informe en memoria');
  assert.match(pagina, /soloLectura=\{!!unica\}/);
  assert.match(pagina, /hojaDestino\(tablero, pedida\)/, '?hoja= dejó de pasar por hojaDestino');
  const ruta = sinComentarios(leer('app/api/graficos/route.ts'));
  assert.match(ruta, /const unica = hojaDeRol\(rol\);\s*if \(rol !== 'admin' && !unica\) return err\(403/);
  assert.match(ruta, /if \(unica && !tabEnCapa\(unica\.capa, capa\)\) return err\(403/, 'la ruta no mira la capa de la hoja del rol');
  assert.match(ruta, /if \(unica && !puedePedir\(rol, body\)\) return err\(403, unica\.error\)/, 'la ruta no frena al rol');
  assert.match(ruta, /\? fuentesDeCampoDeRol\(rol, body\.campo, body\.fuentes\)/, 'los valores del rol no se recortan a su hoja');
  assert.match(ruta, /const dueno = informeDeRol\(rol\) \?\? \(await leerTablero\(\)\)\.tablero;/, 'el pop-up del rol se busca en otro informe');
  // El rol sólo llega a lo de su hoja ANTES de cualquier acción: el chequeo va antes del primer `accion ===`.
  assert.ok(ruta.indexOf('puedePedir(rol, body)') < ruta.indexOf("body.accion === 'guardar'"), 'el chequeo del rol va después de guardar');
  const ed = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  // Desde la tanda de la topbar (11/10/2026) el closer y el link compartido comparten `soloMirar`, y el AI
  // Analyst es una opción del ⋮ (no un botón suelto). El setter entra por el mismo `soloLectura`.
  assert.match(ed, /const guardable = !lecturaFallo && !soloLectura && !compartido;/, 'el rol podría guardar');
  assert.match(ed, /const soloMirar = soloLectura \|\| !!compartido;/, 'el rol dejó de ser «sólo mirar»');
  assert.match(ed, /\{!soloMirar && \(\s*<>\s*<button type="button" role="menuitem" className="lk-opcion lk-opcion--mako"/, 'el rol ve el AI Analyst');
  // «Editar» en azul desde v5 (P4: `lk-pill lk-pill--azul`).
  assert.match(ed, /\{!soloMirar && \(\s*<button type="button" className="lk-pill lk-pill--azul" data-recorrido=\{editando \? 'dash-ver' : 'dash-editar'\}/, 'el rol ve Editar');
  assert.match(ed, /onDetalle=\{editando \|\| soloMirar \? undefined :/, 'el rol abre el detalle de un número (403)');
  assert.match(ed, /\{est\.resultado && !soloMirar && /, 'el rol ve el chat de MaKo de cada gráfico');
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
  assert.match(ed, /\{llamada != null && !compartido && <FichaLlamada recordingId=\{llamada\} onCerrar=\{cerrarLlamada\}/);
  assert.match(ed, /qs\.delete\('llamada'\);[\s\S]{0,120}window\.history\.replaceState\(null, '', conWs\(/, 'al cerrar, la llamada no se va de la URL');
});

test('un video o una página insertada no se achican por debajo de 3 × 4 en la grilla (C4)', () => {
  const ed = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  // El mínimo de un elemento sale del catálogo (TIPOS_ELEMENTO), no de una tabla propia del editor.
  assert.match(ed, /const minimoDe = \(c: Componente\): \{ w: number; h: number \} => \(esElemento\(c\) \? minimoDeElemento\(c\.tipo\) : \{ w: 2, h: 2 \}\);/);
  for (const t of ['video', 'insertado']) assert.deepEqual(minimoDeElemento(t), { w: 3, h: 4 }, t);
  assert.match(ed, /const m = minimoDe\(c\); return \{ i: c\.id, x: c\.x, y: c\.y, w: c\.w, h: c\.h, minW: m\.w, minH: m\.h \};/);
});
