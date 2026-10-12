// =============================================================================
// El segundo feedback del CRM del 12/10/2026: el botón de reuniones, el borrador del alta, la
// banda de la barra, las etapas que faltaban en el editor y las opciones de cada etiqueta
// =============================================================================
// Verificado ROMPIÉNDOLO, una rotura por vez (base: 9 pass / 0 fail):
//   · `hayBorrador` contando la lada sola como algo guardable → 7 / 2 (cae también el saneo:
//     un borrador vacío con su lada por defecto se restauraba)
//   · el efecto de guardar SIN el salto de la primera corrida → 8 / 1
//   · la sección «Tus reuniones» de vuelta arriba de la barra → 8 / 1
//   · `filaQuieta` sin las fijas (Ganado y descartados) → 8 / 1
//   · el selector de la ficha sin `editable` → 8 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claveBorradorAlta, hayBorrador, leerBorradorAlta } from '../app/crm/new/borrador-alta';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const VACIO = { nombre: '', email: '', lada: '52', numero: '', ig: '', perfil: null };

test('el borrador del alta: la clave lleva el workspace de la pestaña', () => {
  assert.equal(claveBorradorAlta(13), 'mako.crm.alta.13');
  assert.equal(claveBorradorAlta(null), 'mako.crm.alta.propio');
  assert.notEqual(claveBorradorAlta(13), claveBorradorAlta(14));
});

test('el borrador del alta: la lada sola no es un borrador; cualquier campo escrito sí', () => {
  assert.equal(hayBorrador(VACIO), false);
  assert.equal(hayBorrador({ ...VACIO, lada: '54' }), false);
  assert.equal(hayBorrador({ ...VACIO, numero: ' - ' }), false);
  assert.equal(hayBorrador({ ...VACIO, nombre: 'Ana' }), true);
  assert.equal(hayBorrador({ ...VACIO, numero: '686 399' }), true);
  assert.equal(hayBorrador({ ...VACIO, ig: '@ana' }), true);
  assert.equal(hayBorrador({ ...VACIO, perfil: { usuario: 'ana', nombre: null, foto: null } }), true);
});

test('el borrador del alta: lo guardado se sanea, y lo roto o vacío no restaura nada', () => {
  assert.equal(leerBorradorAlta(null), null);
  assert.equal(leerBorradorAlta('{no es json'), null);
  assert.equal(leerBorradorAlta('[]'), null);
  assert.equal(leerBorradorAlta(JSON.stringify(VACIO)), null);
  const b = leerBorradorAlta(JSON.stringify({ nombre: 'Ana', email: 3, lada: '+54', numero: '11 2345', ig: '', perfil: { usuario: '' } }));
  assert.deepEqual(b, { nombre: 'Ana', email: '', lada: '54', numero: '11 2345', ig: '', perfil: null });
});

test('el alta guarda el borrador en el modal, y el guardado se saltea la primera corrida', () => {
  const src = sinComentarios(leer('app/crm/new/NewLeadForm.tsx'));
  // Restaurar y guardar corren en el mismo commit: sin el salto, el guardado borraba lo que el
  // efecto de restaurar acababa de leer.
  assert.match(src, /if \(primeraVez\.current\) \{ primeraVez\.current = false; return; \}/);
  assert.match(src, /window\.localStorage\.setItem\(clave, JSON\.stringify\(borrador\)\)/);
  // Se olvida al terminar el alta, en los TRES finales (crear, crear igual, agregar al que ya
  // estaba), y en «Vaciar»: cuatro llamadas.
  assert.equal((src.match(/olvidarBorrador\(\);/g) ?? []).length, 4);
});

test('las reuniones cercanas son un botón de la barra, no una sección arriba', () => {
  const src = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.doesNotMatch(src, />Tus reuniones</);
  const iFiltro = src.indexOf('<CrmFilterMenu');
  const iBoton = src.indexOf('<BotonReuniones');
  const iElastico = src.indexOf('crm-tb-elastico');
  assert.ok(iFiltro > 0 && iBoton > iFiltro && iElastico > iBoton, 'el botón va después de «Filtrar» y antes del elástico');
  const comp = sinComentarios(leer('app/crm/ReunionesProximas.tsx'));
  // Sólo aparece si hay alguna, y late.
  assert.match(comp, /if \(juntas\.length === 0\) return null;/);
  assert.match(comp, /className="crm-reunion-latido"/);
});

test('la barra es una banda de borde a borde y va antes de los avisos', () => {
  const src = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  const iBarra = src.indexOf('className="crm-tb"');
  const iAviso = src.indexOf('{errorMsg && !errorCerrado && (');
  assert.ok(iBarra > 0 && iAviso > iBarra, 'la barra va antes del aviso de error');
  assert.match(src, /className="crm-tb" style=\{\{[^}]*margin: '-16px -44px 18px', padding: '14px 44px', background: 'var\(--surface\)'/);
  // El padding del <main> es el que la banda se come: si cambia uno, cambia el otro.
  assert.match(src, /padding: '16px 44px 60px'/);
});

test('el editor de etapas lista también las de nutrición y las fijas (Ganado y descartados)', () => {
  const src = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  assert.match(src, /nutricionEtapas\.map\(\(e\) => filaQuieta\(e, 'Nutrición'/);
  assert.match(src, /fijas\.map\(\(e\) => filaQuieta\(e, e\.key === 'ganado' \? 'Ganado' : 'Descartado'\)\)/);
  // Quitar una nutrición es apagarla con TODOS sus ids, y el deshacer la prende.
  assert.match(src, /op: 'nutricion', id, activa: false, tambien/);
  assert.match(src, /op: 'nutricion', id, activa: true, tambien/);
  // Y el server las manda.
  const act = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(act, /nutricionEtapas: nutricion,/);
  const pipe = sinComentarios(leer('lib/pipeline.ts'));
  assert.match(pipe, /nutricion: stages\.filter\(\(st\) => st\.band === 'nutricion' && !esTerminal\(st\.key\)\)\.map\(uno\)/);
});

test('el desplegable de etiquetas de la ficha lleva los tres puntos de cada etiqueta', () => {
  const ficha = sinComentarios(leer('app/crm/lead-view/EtiquetasDelLead.tsx'));
  assert.match(ficha, /<SelectorEtiqueta value=\{null\} accion editable /);
  const sel = sinComentarios(leer('app/_components/etiquetas-cliente.tsx'));
  assert.match(sel, /\.\.\.\(editable \? \{ acciones: \[\{ icono: <TresPuntos \/>/);
  assert.match(sel, /\{editando && <EditarEtiqueta etiqueta=\{editando\} onCerrar=\{cerrarEditor\} onCambio=\{avisarCambioEtiquetas\} \/>\}/);
});

test('editar una etiqueta va por el POST del CRUD y archivar pregunta sólo si algo la usa', () => {
  const src = sinComentarios(leer('app/_components/EditarEtiqueta.tsx'));
  assert.match(src, /post\(\{ action: 'editar', id: etiqueta\.id, nombre: limpio, color \}\)/);
  assert.match(src, /post\(\{ action: 'archivar', id: etiqueta\.id \}\)/);
  assert.match(src, /consecuenciaDeArchivar\(j\.uso\)/);
});
