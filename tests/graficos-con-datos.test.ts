// =============================================================================
// Feedback de las reuniones del 12 y 13/10/2026 sobre el Dashboard (fuente: mako-feedback-y-tareas.md)
//   1. El botón de MaKo de cada gráfico NO sale editando (reunión del 12/10, 101:53).
//   2. Una plantilla se arma con lo que el negocio TIENE: sin los gráficos vacíos y con los que MaKo suma sobre los
//      conjuntos con datos (103:41). Lo puro: lib/graficos-con-datos.ts; medir y la IA: lib/graficos-con-datos-server.ts.
// =============================================================================
// Probado ROMPIÉNDOLO (13/10/2026), con la base en verde (8 de 8) y restaurando de memoria después de cada una. Las
// once roturas dieron 1 fallo cada una: la tarjeta con su propia regla de «vacío»; la caja de MaKo que leía sólo lo
// quitado, la sección vacía y la fila sin rellenar (las tres, en el test de la poda); «no pude leer» contado como vacío
// (la PRIMERA vez pasó en verde: el test sólo tenía todo-'nose', que cae en «ninguno tiene datos»; se sumó el caso
// mezclado); sin la guarda de «ninguno tiene datos»; rellenar una fila que no es limpia; sumar lo que ya estaba; el
// catálogo sin recortar; el pedido a MaKo sin podar; y el botón de MaKo editando.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FUENTES, nuevoGrafico, sanearHoja, type Componente, type Elemento, type Grafico, type Hoja } from '../lib/graficos-catalogo';
import { sinDatos, type Resultado } from '../lib/graficos-agregar';
import { agregarAlFinal, avisoConDatos, firmaDeGrafico, podarSinDatos, rellenarFilas, TOPE_AGREGADOS, type Medida } from '../lib/graficos-con-datos';
import { catalogoParaIA } from '../lib/graficos-ia';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const g = (id: string, fuente: string, x: number, y: number, w: number, h: number, tipo = 'numero'): Grafico =>
  ({ ...nuevoGrafico(tipo, [], fuente), id, x, y, w, h }) as Grafico;
const caja = (id: string, ia: Partial<NonNullable<Elemento['ia']>> | null, x: number, y: number, w = 6, h = 3): Record<string, unknown> => ({
  id, clase: 'elemento', tipo: 'ia', texto: 'Conclusiones', x, y, w, h,
  ia: { pedido: 'Qué pasó', fuentes: null, vista: 'resumen', largo: 'corto', formato: 'parrafo', lee: 'hoja', cron: null, ...(ia ?? {}) },
});
const seccion = (id: string, texto: string, y: number): Record<string, unknown> =>
  ({ id, clase: 'elemento', tipo: 'seccion', texto, x: 0, y, w: 12, h: 1, seccion: { fondo: null, plegable: false, abierto: true } });

/**
 * Una plantilla de prueba: una fila de cuatro KPI (y 0), una sección «Detalle» con dos tablas debajo (y 3), una caja de
 * MaKo que lee las dos tablas, otra que lee sólo una, una sección «Vacía» con un gráfico, y un conector.
 */
function hoja(): Hoja {
  const h = sanearHoja({
    id: 'h1', nombre: 'Comercial',
    componentes: [
      g('k1', 'leads', 0, 0, 3, 2), g('k2', 'leads', 3, 0, 3, 2), g('k3', 'pagos', 6, 0, 3, 2), g('k4', 'pagos', 9, 0, 3, 2),
      seccion('s1', 'Detalle', 2),
      g('t1', 'leads', 0, 3, 6, 4, 'tabla'), g('t2', 'pagos', 6, 3, 6, 4, 'tabla'),
      caja('ia-dos', { fuentes: ['t1', 't2'] }, 0, 7), caja('ia-una', { fuentes: ['t2'] }, 6, 7),
      seccion('s2', 'Vacía', 10),
      g('v1', 'meta', 0, 11, 12, 4, 'tabla'),
    ],
    conectores: [{ id: 'kk', desde: 't1', hasta: 't2', punta: 'fin', trazo: 'curva', color: null }],
  }, 0);
  assert.ok(h && h.componentes.length === 11, 'el fixture no sanea entero');
  return h;
}
const medidas = (o: Record<string, Medida>) => new Map(Object.entries(o));

// ── «Vacío» es la regla de la tarjeta ────────────────────────────────────────────────────────

const r = (o: Partial<Resultado>): Resultado => ({ columnas: [], filas: [], totales: [], fuera: 0, clase: null, ...o });
test('«vacío» es la regla de la tarjeta, y la tarjeta usa la MISMA función', () => {
  assert.equal(sinDatos(r({ totales: [0, null] })), true);
  assert.equal(sinDatos(r({ totales: [0, 3] })), false);
  assert.equal(sinDatos(r({ filas: [{ clave: 'a', etiqueta: 'A', valores: [0] }, { clave: 'b', etiqueta: 'B', valores: [null] }] as Resultado['filas'] })), true);
  assert.equal(sinDatos(r({ filas: [{ clave: 'a', etiqueta: 'A', valores: [0, 2] }] as Resultado['filas'] })), false);
  const grafico = sinComentarios(leer('app/dashboard/Grafico.tsx'));
  assert.match(grafico, /const vacio = sinDatos;/, 'la tarjeta volvió a tener su propia regla de «Sin datos»');
  assert.doesNotMatch(grafico, /function vacio\(/);
});

// ── Podar ──────────────────────────────────────────────────────────────────────────────────

test('sin los vacíos: la fila de KPI se vuelve a llenar, la caja que leía sólo lo quitado y la sección vacía se van', () => {
  const { hoja: p, quitados, sinNada } = podarSinDatos(hoja(), medidas({ k1: 'con', k2: 'sin', k3: 'con', k4: 'sin', t1: 'con', t2: 'sin', v1: 'sin' }));
  assert.equal(sinNada, false);
  assert.equal(quitados, 4);
  const ids = p.componentes.map((c) => c.id);
  assert.deepEqual(ids.sort(), ['ia-dos', 'k1', 'k3', 's1', 't1'].sort(), `quedó: ${ids.join(', ')}`);
  // La fila de cuatro KPI que perdió dos: las dos que quedan, a media fila cada una.
  const k1 = p.componentes.find((c) => c.id === 'k1')!, k3 = p.componentes.find((c) => c.id === 'k3')!;
  assert.deepEqual([k1.x, k1.w, k3.x, k3.w], [0, 6, 6, 6]);
  // La caja que leía las dos tablas sigue con la que quedó.
  assert.deepEqual((p.componentes.find((c) => c.id === 'ia-dos') as Elemento).ia?.fuentes, ['t1']);
  // El conector a una tabla quitada se va.
  assert.equal(p.conectores, undefined);
  // Y el saneo de siempre no le saca nada más.
  assert.equal(sanearHoja(p, 0)!.componentes.length, 5);
});

test('«no pude leer» no es «vacío»; y si NINGUNO tiene datos, la plantilla queda entera', () => {
  const nose = podarSinDatos(hoja(), medidas({ k1: 'nose', k2: 'nose', k3: 'nose', k4: 'nose', t1: 'nose', t2: 'nose', v1: 'nose' }));
  assert.equal(nose.quitados, 0);
  assert.equal(nose.hoja.componentes.length, 11);
  // Con uno que SÍ tiene datos al lado: lo que no se pudo leer se queda igual (sin esto, la rotura r5 pasaba).
  const mezcla = podarSinDatos(hoja(), medidas({ k1: 'con', k2: 'nose', k3: 'nose', k4: 'nose', t1: 'nose', t2: 'nose', v1: 'nose' }));
  assert.equal(mezcla.quitados, 0, 'quitó un gráfico que no se pudo leer');
  assert.equal(mezcla.hoja.componentes.length, 11);
  const nada = podarSinDatos(hoja(), medidas({ k1: 'sin', k2: 'sin', k3: 'sin', k4: 'sin', t1: 'sin', t2: 'sin', v1: 'nose' }));
  assert.equal(nada.sinNada, true);
  assert.equal(nada.hoja.componentes.length, 11, 'una hoja sin un solo gráfico no le sirve a nadie');
  assert.equal(avisoConDatos({ quitados: 0, agregados: 0, sinNada: true }), 'Todavía sin datos');
});

test('una fila que no es limpia (alturas distintas, o algo alto que la cruza) no se reacomoda', () => {
  const antes = [{ id: 'a', x: 0, y: 0, w: 4, h: 2 }, { id: 'b', x: 4, y: 0, w: 4, h: 4 }, { id: 'c', x: 8, y: 0, w: 4, h: 2 }];
  assert.deepEqual(rellenarFilas([antes[0]], antes), [antes[0]]);
  const conAlto = [{ id: 'alto', x: 0, y: 0, w: 4, h: 6 }, { id: 'd', x: 4, y: 2, w: 4, h: 2 }, { id: 'e', x: 8, y: 2, w: 4, h: 2 }];
  assert.deepEqual(rellenarFilas([conAlto[0], conAlto[1]], conAlto).find((c) => c.id === 'd'), conAlto[1]);
});

// ── Sumar lo de MaKo ───────────────────────────────────────────────────────────────────────

test('lo que suma MaKo va abajo, con ids nuevos, sin repetir lo que ya está y hasta el tope', () => {
  const base = sanearHoja({ id: 'h', nombre: 'H', componentes: [g('a', 'leads', 0, 0, 6, 4, 'tabla')] }, 0)!;
  const repetido = { ...base.componentes[0], id: 'x1', y: 0 } as Grafico;
  const extra: Componente[] = [repetido, ...Array.from({ length: TOPE_AGREGADOS + 2 }, (_, i) => g(`n${i}`, 'pagos', 0, i * 2, 6, 2, i % 2 ? 'numero' : 'tabla'))]
    .map((c, i) => (i > 0 ? { ...c, metricas: [FUENTES.find((f) => f.id === 'pagos')!.metricas[i % 3].id] } as Grafico : c));
  const { hoja: h2, agregados } = agregarAlFinal(base, extra);
  assert.ok(agregados <= TOPE_AGREGADOS && agregados > 0);
  const nuevos = h2.componentes.slice(1);
  assert.ok(nuevos.every((c) => c.y >= 4), 'lo sumado tapa la hoja');
  assert.ok(!nuevos.some((c) => ['x1', 'n0', 'n1', 'n2'].includes(c.id)), 'conservó un id de la IA');
  const firmas = h2.componentes.map((c) => firmaDeGrafico(c as Grafico));
  assert.equal(new Set(firmas).size, firmas.length, 'sumó un gráfico que ya estaba');
  assert.equal(avisoConDatos({ quitados: 3, agregados: 2, sinNada: false }), '3 vacíos quitados · 2 con tus datos');
  assert.equal(avisoConDatos({ quitados: 1, agregados: 0, sinNada: false }), '1 vacío quitado');
  assert.equal(avisoConDatos({ quitados: 0, agregados: 0, sinNada: false }), null);
});

test('el catálogo que ve MaKo al sumar tiene SÓLO los conjuntos con datos', () => {
  const pagos = FUENTES.find((f) => f.id === 'pagos')!;
  const leads = FUENTES.find((f) => f.id === 'leads')!;
  const cat = catalogoParaIA([pagos]);
  assert.match(cat, /^- pagos «/m);
  assert.doesNotMatch(cat, /^- leads «/m, 'el catálogo recortado trae un conjunto sin datos');
  assert.match(catalogoParaIA(), new RegExp(`^- ${leads.id} «`, 'm'), 'sin recortar, todos');
  assert.match(sinComentarios(leer('lib/graficos-ia-generar.ts')), /opts\.soloFuentes \? userDeHoja\(pedido, FUENTES\.filter\(\(f\) => opts\.soloFuentes!\.includes\(f\.id\)\)\) : userDeHoja\(pedido\)/);
});

// ── Las puertas: la plantilla, «¿Qué vas a crear hoy?», la API y el botón de MaKo ──────────────

test('las tres puertas que crean una hoja pasan por hojaConDatos (la plantilla suma; el pedido sólo poda)', () => {
  const plantilla = sinComentarios(leer('app/api/graficos/plantilla/route.ts'));
  assert.match(plantilla, /if \(rol !== 'admin'\) return err\(403/);
  assert.match(plantilla, /tabEnCapa\('graphics', await getCapaActual\(\)\)/);
  assert.match(plantilla, /hojaConDatos\(instanciarPlantilla\(p\), \{ hoy: hoyEnTijuana\(\), hastaMs: inicio \+ PLAZO_MS, sumar: \{ nombre: p\.nombre, linea: p\.linea \} \}\)/);
  const ia = sinComentarios(leer('app/api/graficos/ia/route.ts'));
  assert.match(ia, /await hojaConDatos\(r\.hoja, \{ hoy: hoyEnTijuana\(\), hastaMs: inicio \+ 115_000 \}\)/);
  assert.doesNotMatch(ia, /sumar:/, 'lo que armó MaKo con el pedido no se completa con otra cosa');
  const api = sinComentarios(leer('lib/api-mako/areas/dashboard.run.ts'));
  const crear = api.slice(api.indexOf('crear_hoja_dashboard: {'), api.indexOf('editar_hoja_dashboard: {'));
  assert.match(crear, /hojaConDatos\(instanciarPlantilla\(p\), \{ hoy: hoyEnTijuana\(\), hastaMs, sumar: \{ nombre: p\.nombre, linea: p\.linea \} \}\)/);
  assert.match(crear, /hojaConDatos\(g\.hoja, \{ hoy: hoyEnTijuana\(\), hastaMs \}\)/);
  assert.doesNotMatch(crear, /hoja = instanciarPlantilla\(p\);/, 'la API volvió a crear la plantilla con sus vacíos');
  // «Nueva hoja»: una plantilla se ARMA (y si no contesta, entra tal cual con su aviso).
  const nueva = sinComentarios(leer('app/dashboard/NuevaHoja.tsx'));
  assert.match(nueva, /onClick=\{\(\) => \{ void armarPlantilla\(p\); \}\}/);
  assert.match(nueva, /fetch\('\/api\/graficos\/plantilla', \{[\s\S]*?signal: c\.signal/);
  assert.match(nueva, /if \(!h\) \{ crear\(instanciarPlantilla\(p\), SIN_MEDIR\); return; \}/);
  // Medir es con el lector y el período de la PANTALLA.
  const server = sinComentarios(leer('lib/graficos-con-datos-server.ts'));
  assert.match(server, /const ef = efectivoDe\(g, h, \{\}, hoy\);/);
  assert.match(server, /!d \|\| !d\.ok \? 'nose' : sinDatos\(d\.resultado\) \? 'sin' : 'con'/);
});

// 13/10/2026 a la noche, Martín: «que el botón de la IA de MaKo NO se abra al estar en modo edición, sino que se pueda
// editar allí justamente». Reemplaza al «no sale editando» de la reunión (101:53): editando SALE, y abre su configuración
// en vez del chat (tests/dashboard-mako-contextual.test.ts tiene el resto).
test('editando, el botón de MaKo de cada gráfico no abre el chat: abre su configuración en el lugar', () => {
  const editor = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  assert.match(editor, /\{\(editando \|\| est\.resultado\) && !soloMirar && conMako\(c\) && \(/);
  assert.match(editor, /onClick=\{editando \? \(e\) => \{ e\.stopPropagation\(\); setMenu\(\{ ancla: e\.currentTarget, tipo: 'mako', id: c\.id \}\); \} : undefined\}/);
  assert.match(editor, /\{editando\s*\? <BotonMako [^>]*onClick=\{\(\) => \{\}\} \/>\s*: <ChatMakoGrafico /);
});
