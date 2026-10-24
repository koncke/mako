// =============================================================================
// La pestaña «Métricas» de una automatización (23/10/2026)
// =============================================================================
// Martín: «en cada Automatización ver una pestaña de métricas... un botón al lado del botón de configuraciones. Cuando se
// apreta, todo el lienzo se reemplaza por el dashboard de esas métricas... Por defecto MaKo lo debe armar solo... se debe
// poder personalizar al igual que en Dashboard y un botón para llevar esas métricas como nueva hoja a la tab de dashboard».
// Lo que se fija acá (lib/automatizacion-metricas.ts y lo que lo monta):
//   1. El informe de una automatización tiene su propia clave, que no es la del Dashboard ni la de General.
//   2. Lo que cuentan las fuentes: la tarjeta en el orden del flujo, qué fue un envío, las horas hasta responder.
//   3. La plantilla de MaKo mira el flujo (sin email no hay apertura; sin aviso, no hay «Avisos al equipo»), y cada pieza
//      es válida para el catálogo (ninguna se cae en el saneo).
//   4. Cada hoja mira SÓLO esta automatización, con el nombre de HOY.
//   5. Las costuras: el editor guarda con su `?informe=`, la ruta valida que la automatización sea del negocio, el botón
//      vive al lado de la tuerca y reemplaza al lienzo, el editor entra sin server, y «Llevar al Dashboard» usa la receta de
//      `pegar_dashboard`.
//
// ⚠️ PROBADOS ROMPIÉNDOLOS (23/10/2026, base en verde: 9 de 9), una rotura por vez:
//   · la clave del informe con el prefijo del Dashboard (`graficos.tablero.`) → 1 fallo (test 1);
//   · `rotuloDeTarjeta` sin el número con dos cifras → 1 fallo (test 2);
//   · `rasgosDelFlujo` que no mira el email → 1 fallo (test 4);
//   · `hojaConLaAutomatizacion` sin sacar el filtro viejo → 1 fallo (test 5);
//   · el guardado del editor con `=== 'general'` de vuelta → 1 fallo (test 6);
//   · la ruta sin `automatizacionDelNegocio` → 1 fallo (test 6);
//   · el FlujoLienzo sin el `verMetricas ?` → 1 fallo (test 7).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  claveInformeAutomatizacion, conLaAutomatizacion, definicionDeMetricas, hojaConLaAutomatizacion, hojaInicialDeMetricas,
  horasHastaResponder, idDeInformeAutomatizacion, informeDeAutomatizacion, informeInicialDeMetricas, rasgosDelFlujo,
  rotuloDeTarjeta, tipoDeEnvio,
} from '../lib/automatizacion-metricas';
import { esGrafico, fuenteDe } from '../lib/graficos-catalogo';
import type { PasoGrafo } from '../lib/flujo-grafo';

const RAIZ = resolve(import.meta.dirname, '..');
// Sin `\r`: en un checkout con CRLF (core.autocrlf) las regex que cruzan renglones dejan de calzar (tren del 23/10).
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

const P = (x: Record<string, unknown>) => x as unknown as PasoGrafo;
const FLUJO: PasoGrafo[] = [
  P({ id: 'm1', canal: 'whatsapp', cuerpo: 'Hola {{nombre}}, ¿cómo vas?', siguiente: 'm2' }),
  P({ id: 'm2', canal: 'whatsapp', accion: { operacion: 'avisar_al_equipo', params: {} }, siguiente: null }),
];

test('1 · el informe de una automatización: su nombre, su id y su clave propia', () => {
  assert.equal(informeDeAutomatizacion(289), 'automatizacion:289');
  assert.equal(idDeInformeAutomatizacion('automatizacion:289'), 289);
  for (const x of ['general', 'dashboard', 'automatizacion:', 'automatizacion:0', 'automatizacion:12a', 289, null]) assert.equal(idDeInformeAutomatizacion(x), null, String(x));
  const k = claveInformeAutomatizacion(289, '7');
  assert.equal(k, 'automatizacion.informe.289.7');
  assert.ok(!k.startsWith('graficos.tablero.') && !k.startsWith('general.informe.'), 'la API del Dashboard no la lista como otro Dashboard');
});

test('2 · la tarjeta en el orden del flujo, y null si el envío no dice de cuál salió', () => {
  assert.match(rotuloDeTarjeta(FLUJO, 'm1') ?? '', /^01 · /);
  assert.match(rotuloDeTarjeta(FLUJO, 'm2') ?? '', /^02 · /);
  assert.equal(rotuloDeTarjeta(FLUJO, 'x'), null);
  assert.equal(rotuloDeTarjeta(FLUJO, null), null);
  const largo = rotuloDeTarjeta([P({ id: 'a', canal: 'whatsapp', cuerpo: 'x'.repeat(300) })], 'a') ?? '';
  assert.ok(largo.length <= 76, `se corta: ${largo.length}`);
});

test('3 · qué fue un envío, y las horas hasta responder (sólo si respondió)', () => {
  assert.equal(tipoDeEnvio('accion', 'avisar_al_equipo'), 'Aviso al equipo');
  assert.equal(tipoDeEnvio('fallo', 'avisar_al_equipo'), 'Aviso al equipo', 'un aviso que falló sigue siendo un aviso');
  assert.equal(tipoDeEnvio('accion', 'proponer_cambio_etapa'), 'Acción');
  assert.equal(tipoDeEnvio('enviado', 'Tu acceso al curso'), 'Mensaje', 'el asunto de un email no es una operación');
  assert.equal(tipoDeEnvio('enviado', null), 'Mensaje');
  assert.equal(horasHastaResponder({ estado: 'respondio', inscripto_at: '2026-10-23T04:51:00Z', desenlace_at: null, updated_at: '2026-10-23T16:09:00Z' }), 11.3);
  assert.equal(horasHastaResponder({ estado: 'activa', inscripto_at: '2026-10-23T04:51:00Z', desenlace_at: null, updated_at: '2026-10-23T16:09:00Z' }), null);
  assert.equal(horasHastaResponder({ estado: 'respondio', inscripto_at: null, desenlace_at: null, updated_at: null }), null);
});

test('4 · la plantilla de MaKo mira el flujo, y ninguna pieza se cae en el saneo', () => {
  assert.deepEqual(rasgosDelFlujo(FLUJO), { email: false, aviso: true, respuesta: false });
  const titulos = (pasos: PasoGrafo[]) => definicionDeMetricas(pasos).piezas.map((p) => String(p.titulo));
  assert.ok(titulos(FLUJO).includes('Avisos al equipo'));
  assert.ok(!titulos(FLUJO).includes('Tasa de apertura'), 'sin email no hay apertura');
  assert.ok(!titulos(FLUJO).includes('Horas hasta responder'), 'sin AI Step ni «Contestó» no hay tiempo de respuesta');
  const conEmail = [...FLUJO, P({ id: 'e1', canal: 'email', asunto: 'Hola', cuerpo: 'x' })];
  assert.ok(titulos(conEmail).includes('Tasa de apertura'));
  const conIA = [...FLUJO, P({ id: 'r1', nodo: 'respuesta', canal: 'whatsapp', paso_ia: true, objetivo: 'agendar', casos: [] })];
  assert.ok(titulos(conIA).includes('Horas hasta responder'));
  for (const pasos of [FLUJO, conEmail, conIA]) {
    const def = definicionDeMetricas(pasos);
    const h = hojaInicialDeMetricas(pasos, 'Prueba');
    assert.equal(h.componentes.length, def.piezas.length, 'una pieza con una métrica o una dimensión que su conjunto no tiene se cae en el saneo');
    for (const c of h.componentes) if (esGrafico(c)) assert.ok(fuenteDe(c.fuente), c.fuente);
  }
});

test('5 · cada hoja mira SÓLO esta automatización, con el nombre de HOY', () => {
  const t = informeInicialDeMetricas(FLUJO, 'Sprint · apertura');
  const fijo = (h: ReturnType<typeof hojaInicialDeMetricas>) => h.controles.filter((c) => c.fijo && c.campo === 'automatizacion');
  assert.deepEqual(fijo(t.hojas[0]).map((c) => c.valores), [['Sprint · apertura']]);
  const renombrada = conLaAutomatizacion(t, 'Sprint · apertura v2');
  assert.deepEqual(fijo(renombrada.hojas[0]).map((c) => c.valores), [['Sprint · apertura v2']], 'renombrarla no deja la hoja en cero');
  const sinFiltro = { ...t.hojas[0], id: 'otra', controles: t.hojas[0].controles.filter((c) => !c.fijo) };
  assert.equal(fijo(hojaConLaAutomatizacion(sinFiltro, 'X')).length, 1, 'una hoja nueva de la galería, adentro de Métricas, también la recibe');
});

test('6 · el editor guarda en SU informe, y la ruta valida que la automatización sea del negocio', () => {
  const ed = leer('app/dashboard/EditorInforme.tsx');
  assert.match(ed, /informeRef\.current !== 'dashboard' \? `\?informe=\$\{encodeURIComponent\(informeRef\.current\)\}`/);
  assert.match(ed, /from '@\/lib\/informe-automatizacion'/, 'el editor importa el módulo chico, no el que trae el flujo');
  const ruta = leer('app/api/graficos/route.ts');
  assert.match(ruta, /idDeInformeAutomatizacion\(new URL\(req\.url\)\.searchParams\.get\('informe'\)\)/);
  assert.match(ruta, /if \(!\(await automatizacionDelNegocio\(idAutomatizacion\)\)\) return err\(404/);
  assert.match(leer('lib/graficos-tablero.ts'), /claveInformeAutomatizacion\(id, sub\)/);
});

test('7 · «Métricas» va al lado de la tuerca y reemplaza al lienzo; el editor entra sin server', () => {
  const sp = leer('app/automations/SecuenciaPerfil.tsx');
  const tuerca = sp.indexOf('<BotonTuerca lado={ALTO_ACCION}');
  const metricas = sp.indexOf('<BotonMetricas lado={ALTO_ACCION}');
  assert.ok(tuerca > 0 && metricas > tuerca && metricas - tuerca < 1200, 'el botón va pegado a la tuerca');
  assert.match(sp, /\{verMetricas \? \([\s\S]{0,900}<MetricasAutomatizacion secuenciaId=\{secuencia\.id\} \/>[\s\S]{0,200}\) : \(\s*<FlujoLienzo/);
  assert.match(sp, /chrome=\{cabecera\}/, 'la misma cabecera en el lienzo y en las métricas: se vuelve con el mismo botón');
  const m = leer('app/automations/MetricasAutomatizacion.tsx');
  assert.match(m, /dynamic\(\(\) => import\('@\/app\/dashboard\/EditorInforme'\)[\s\S]{0,120}ssr: false/);
  assert.match(m, /informe=\{informeDeAutomatizacion\(secuenciaId\)\}/);
  // Las reglas de Rendimiento (23/10/2026): el loader de la casa importado DIRECTO (nunca del índice '@/app/_ui'), nada
  // de app/automations importa el editor (ni recharts) de forma estática, y sin la segunda estrella de MaKo adentro.
  assert.match(m, /import \{ CargandoMako \} from '@\/app\/_ui\/CargandoMako';/);
  assert.doesNotMatch(m, /from '@\/app\/_ui';/);
  for (const f of ['app/automations/SecuenciaPerfil.tsx', 'app/automations/MetricasAutomatizacion.tsx']) {
    assert.doesNotMatch(leer(f), /^import (?!type )[^\n]*from '@\/app\/dashboard\/EditorInforme'/m, `${f} importa el editor estático`);
  }
  assert.match(leer('app/dashboard/EditorInforme.tsx'), /\{!compartido && !esAutomatizacion && <MakoEnLaTab /);
});

test('8 · «Llevar al Dashboard» es la receta de `pegar_dashboard`: lo visible, una hoja nueva y compare-and-set', () => {
  const s = leer('lib/automatizacion-metricas-server.ts');
  assert.match(s, /leerTableroVisible\(s\.sub\)/, 'con el informe como lo ve la persona: quien nunca guardó no se queda con las hojas iniciales escritas');
  assert.match(s, /aplicarCambio\(actual\.tablero, \{ op: 'crear_hoja', hoja \}\)/);
  assert.match(s, /guardarTableroSi\(s\.sub, ap\.tablero, actual\.version\)/);
  assert.match(s, /hojaConLaAutomatizacion\(hojaConIdsNuevos\(origen, nombre\)/, 'la hoja llevada sigue filtrada a la automatización');
});

test('9 · el teléfono destila la misma hoja, y la API lee con el mismo agregador', () => {
  assert.match(leer('app/api/automations/metricas/route.ts'), /hojaPropia\(hoja, periodoDe\('ult30'\), hoy\)/);
  assert.match(leer('app/m/automations/AutomationsM.tsx'), /<MetricasM key=\{a\.id\} id=\{a\.id\}/);
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  assert.match(run, /metricas_automatizacion: \{[\s\S]{0,400}metricasEnNumeros\(id, periodo\)/);
});
