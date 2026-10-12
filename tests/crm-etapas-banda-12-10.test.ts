// =============================================================================
// El sexto feedback del 12/10/2026 sobre el editor del funnel: el TIPO decide la BANDA
// =============================================================================
// «Revisa que Facturando y las etapas de nutrición no tienen el desplegable... Todos deberían ser lo
// mismo, sin excepciones», y del quinto: «si se coloca "Etapa" se desplaza automáticamente hacia arriba,
// y viceversa. Es decir, también si arrastro debería cambiar ese desplegable». Más el «+» entre dos
// etapas, la caja gris con «Editar etapas», «Asignar campañas» con el logo de Meta, el tipo de funnel en
// lista y la tabla de campañas sin «N asignadas» y con el fondo gris.
//
// Verificado ROMPIÉNDOLO, una rotura por vez y restaurando de memoria (base: 8 pass / 0 fail):
//   · `generateFunnel` encadena el pipeline entero (sin `recorridoDe`)                → 7 / 1
//   · una nutrición de catálogo que sube no apaga sus transiciones                     → 6 / 2
//   · `conTipo` no conserva el `pago` al pasar por Nutrición                          → 7 / 1
//   · el destino del arrastre no puede ser la otra lista (el `onDrop` sin `elegirTipo`) → 7 / 1
//   · el «+ Agregar» con su alto viejo (`padding: '10px 12px'`)                       → 7 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateFunnel, problemasDePipeline, etapasVisibles, idNutricionFija, type Stage } from '../lib/pipeline';
import { cambiarTipo, type EstadoBanda } from '../lib/etapa-banda';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const st = (key: string, label: string, kind: string): Stage => ({ key, label, kind, dot: '#2F6DDB', tone: 'info' } as Stage);
const BASE: Stage[] = [
  st('lead', 'Lead entrante', 'entrada'),
  st('agenda', 'Agenda R1', 'reunion'),
  st('st0', 'Propuesta', 'paso'),
  st('facturando', 'Facturando', 'pago'),
  st('ganado', 'Ganado', 'cierre'),
];
const estado = (pipeline: Stage[] = BASE, suppressed: string[] = [], labels: Record<string, string> = {}): EstadoBanda =>
  ({ pipeline, suppressed, labels, ordenNutricion: [] });
const ok = (r: ReturnType<typeof cambiarTipo>) => { if (!r.ok) throw new Error(r.error); return r.estado; };
const nutricionDe = (e: EstadoBanda) => generateFunnel(e.pipeline, e.suppressed, e.labels).stages.filter((s) => s.band === 'nutricion').map((s) => s.key);
const recorridoDe = (e: EstadoBanda) => generateFunnel(e.pipeline, e.suppressed, e.labels).stages.filter((s) => s.band === 'pipeline').map((s) => s.key);

test('una etapa propia que pasa a Nutrición sale del recorrido, va primera en la banda y vuelve a su lugar', () => {
  const abajo = ok(cambiarTipo(estado(), 'st0', 'nutricion'));
  assert.deepEqual(recorridoDe(abajo), ['lead', 'agenda', 'facturando', 'ganado'], 'siguió en el recorrido');
  assert.ok(nutricionDe(abajo).includes('st0'), 'no se dibuja en la banda Nutrición');
  assert.equal(abajo.ordenNutricion[0], 'st0', 'sin lugar elegido, cae primera (justo debajo de Ganado)');
  // Ningún «Avanza» pasa por ella, y guardada no rompe «el cierre va último».
  const avances = generateFunnel(abajo.pipeline, abajo.suppressed).transitions.filter((t) => t.category === 'avanza');
  assert.ok(!avances.some((t) => t.from === 'st0' || t.to === 'st0'), 'el recorrido sigue pasando por ella');
  assert.equal(abajo.pipeline[abajo.pipeline.length - 1].key, 'ganado', 'el cierre dejó de ir último en lo guardado');
  assert.deepEqual(problemasDePipeline(abajo.pipeline), problemasDePipeline(BASE), 'una nutrición guardada se lee como un problema del recorrido');
  // De vuelta, en el lugar que se soltó (2 = entre la R1 y Facturando).
  const arriba = ok(cambiarTipo(abajo, 'st0', 'etapa', 2));
  assert.deepEqual(recorridoDe(arriba), ['lead', 'agenda', 'st0', 'facturando', 'ganado']);
  assert.ok(!nutricionDe(arriba).includes('st0'));
});

test('Facturando lleva el desplegable y conserva su tipo de pago al ir y volver de Nutrición', () => {
  const abajo = ok(cambiarTipo(estado(), 'facturando', 'nutricion'));
  assert.equal(abajo.pipeline.find((s) => s.key === 'facturando')?.kind, 'pago', 'guardada perdió el pago');
  const col = generateFunnel(abajo.pipeline, abajo.suppressed).stages.find((s) => s.key === 'facturando');
  assert.deepEqual([col?.band, col?.kind], ['nutricion', 'paso'], 'en la banda pide los datos de un pago');
  const arriba = ok(cambiarTipo(abajo, 'facturando', 'etapa'));
  assert.equal(arriba.pipeline.find((s) => s.key === 'facturando')?.kind, 'pago', 'volvió como un paso cualquiera');
  assert.deepEqual(recorridoDe(arriba), recorridoDe(estado()), 'no volvió a su lugar (antes del cierre)');
});

test('una nutrición DE CATÁLOGO sube al recorrido con su clave y apaga sus transiciones; al bajar, vuelve a derivarse', () => {
  const base = estado();
  assert.ok(nutricionDe(base).includes('nutri'), 'el ejemplo dejó de traer «No agendó»');
  const arriba = ok(cambiarTipo(base, 'nutri', 'etapa', 1));
  assert.deepEqual(recorridoDe(arriba).slice(0, 2), ['lead', 'nutri'], 'no entró al recorrido donde se soltó');
  assert.ok(!nutricionDe(arriba).includes('nutri'), 'quedó también en la banda: dos columnas con la misma clave');
  assert.ok(arriba.suppressed.includes('lead>nutri'), 'no apagó la transición que la derivaba');
  // Renombrada arriba, al bajar conserva el nombre y vuelve a ser la derivada.
  const renombrada = { ...arriba, pipeline: arriba.pipeline.map((s) => (s.key === 'nutri' ? { ...s, label: 'Frío' } : s)) };
  const abajo = ok(cambiarTipo(renombrada, 'nutri', 'nutricion'));
  assert.ok(!abajo.pipeline.some((s) => s.key === 'nutri'), 'quedó en el pipeline');
  assert.ok(!abajo.suppressed.includes('lead>nutri'), 'no volvió a prender su transición');
  assert.equal(abajo.labels.nutri, 'Frío', 'perdió el nombre que le pusieron');
  assert.ok(nutricionDe(abajo).includes('nutri'));
});

test('«Nutrición - Manual» también sube y baja (su marca fija)', () => {
  const arriba = ok(cambiarTipo(estado(), 'manual', 'etapa'));
  assert.ok(arriba.suppressed.includes(idNutricionFija('manual')));
  assert.ok(recorridoDe(arriba).includes('manual') && !nutricionDe(arriba).includes('manual'));
  const abajo = ok(cambiarTipo(arriba, 'manual', 'nutricion'));
  assert.ok(!abajo.suppressed.includes(idNutricionFija('manual')) && nutricionDe(abajo).includes('manual'));
});

test('la entrada, el cierre y lo que no es de este funnel no llevan tipo', () => {
  assert.equal(cambiarTipo(estado(), 'lead', 'nutricion').ok, false, 'la entrada se fue a la banda');
  assert.equal(cambiarTipo(estado(), 'ganado', 'nutricion').ok, false, 'el cierre se fue a la banda');
  assert.equal(cambiarTipo(estado(), 'perdido', 'etapa').ok, false, 'una terminal entró al recorrido');
  assert.equal(cambiarTipo(estado(), 'st99', 'etapa').ok, false, 'una clave inventada se guardó');
});

test('el pop-up recibe las propias marcadas entre las nutriciones (no entre las etapas)', () => {
  const abajo = ok(cambiarTipo(estado(), 'st0', 'nutricion'));
  const vis = etapasVisibles(generateFunnel(abajo.pipeline, abajo.suppressed).stages);
  assert.ok(vis.nutricion.some((s) => s.key === 'st0' && s.marcadaComo === 'nutricion'));
  assert.ok(!vis.propias.some((s) => s.key === 'st0'));
});

test('la pantalla: el arrastre cambia de lista y de tipo, el «+» entre etapas, y las nutriciones con su desplegable', () => {
  const md = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  // Soltar en la otra lista cambia el tipo, en el lugar donde se soltó.
  assert.match(md, /if \(fila\) elegirTipo\(fila, hacia === 'nutricion' \? 'nutricion' : 'etapa', g, destino\);/);
  assert.match(md, /else if \(m\.limite != null && e\.clientY >= m\.limite\) \{\s*g = 'nutricion';/, 'el destino no puede ser la banda');
  assert.match(md, /data-limite=\{e\.key === 'ganado' \? '' : undefined\}/, 'Ganado dejó de marcar la frontera');
  // El «+» entre dos etapas, antes de Ganado y entre las nutriciones.
  assert.match(md, /onCrear=\{\(label\) => aplicar\(\{ op: 'agregar', label, despuesDe: etapas\[i - 1\]\.key \}\)\}/);
  assert.match(md, /onCrear=\{\(label\) => aplicar\(\{ op: 'agregar', label, nutricionEn: i \}\)\}/);
  // La nutrición propia se quita como una etapa; la derivada, apagando lo que llega a ella.
  assert.match(md, /tacho\(e, \(\) => \(e\.marcadaComo === 'nutricion' \? quitarEtapa\(e\) : quitarNutricion\(e\)\)\)/);
  // El «+ Agregar» del alto de las tarjetas.
  assert.match(md, /display: 'flex', alignItems: 'center', minHeight: ALTO_TARJETA, padding: '0 12px', borderRadius: 12,/);
  assert.doesNotMatch(md, /padding: '10px 12px', borderRadius: 10/);
  // La caja gris con su cabecera, «Asignar campañas» con Meta y el tipo de funnel en lista.
  assert.match(md, /<CabeceraSeccion icono=\{<IconoMenu nombre="etapa" size=\{15\} \/>\} titulo="Editar etapas" \/>/);
  assert.match(md, /<CabeceraSeccion icono=\{<LogoMeta size=\{16\} \/>\} titulo="Asignar campañas"/);
  assert.match(md, /<div role="radiogroup" aria-label="Tipo de funnel" style=\{\{ display: 'flex', flexDirection: 'column', gap: 8 \}\}>/);
  // El server: el alta de una nutrición en un lugar de la banda.
  const ac = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(ac, /if \(typeof op\.nutricionEn === 'number' && Number\.isFinite\(op\.nutricionEn\)\) \{/);
  assert.match(ac, /const orden = ordenConClave\(\{ pipeline: plN, suppressed: actual\.suppressed, labels, ordenNutricion: ordenAhoraN \}, key, op\.nutricionEn\);/);
});

test('la tabla de campañas en línea: sin «N asignadas» y con el fondo gris arriba', () => {
  const cm = sinComentarios(leer('app/crm/CampanasModal.tsx'));
  assert.doesNotMatch(cm, /asignadas a \$\{nombreProducto\}|Ninguna asignada a/);
  assert.match(cm, /const fondo = enLinea \? 'var\(--surface-2\)' : 'var\(--surface\)';/);
  assert.match(cm, /position: 'sticky', top: 0, zIndex: 2, background: fondo/);
});
