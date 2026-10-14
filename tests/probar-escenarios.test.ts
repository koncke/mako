// =============================================================================
// «Probar» con un CONTACTO POR ESCENARIO (14/10/2026)
// =============================================================================
// Martín: «En "Probar" para las automatizaciones que tengas varios casos, varias condiciones, ese chat de "probar"
// debería al lado tener la sidebar de diferentes contactos de WhatsApp o de IG o lo que sea, con el mismo diseño de
// esas apps, y justamente que ahí caigan los diferentes escenarios para la prueba. Y si puedo por WhatsApp, debo
// elegir un escenario para probarlo en caso de que tenga más de 1 escenario.»
//   · `escenariosDePrueba` (lib/simulador-grafo.ts) recorre el MISMO simulador de la prueba y abre un escenario por
//     cada camino distinto por las condiciones; el primero es el que elegiría el motor con el lead recién llegado.
//   · El panel (app/automations/PanelProbar.tsx) dibuja la barra con un contacto por escenario sólo si hay más de uno,
//     y cada condición sale por lo que dice el escenario elegido (`elegir`), también en la prueba de verdad.
//   · El menú de «Probar en WhatsApp» pide el escenario cuando hay más de uno (`MenuDestinos`, `escenario`).
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 `escenariosDePrueba` sin abrir las otras opciones (sólo la primera)                   → 2 / 3
//   R2 sin ordenar por lo que elegiría el motor (el primero no es el de siempre)             → 4 / 1
//   R3 el panel sin forzar la condición del escenario (`if (false && forzado …`)              → 4 / 1
// Como está: 5 / 0.
//
// Correr: node --import tsx --test tests/probar-escenarios.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizar, RESULTADO_SI_NO, type PasoGrafo } from '../lib/flujo-grafo';
import { escenariosDePrueba, hechosDeLeadNuevo, TOPE_ESCENARIOS } from '../lib/simulador-grafo';
import { PLANTILLAS } from '../lib/plantillas-automatizaciones';
import { MenuDestinos } from '../app/automations/PanelProbar';

const msg = (id: string, siguiente: string | null = null, canal = 'whatsapp'): PasoGrafo => ({ id, canal, cuerpo: id, siguiente, delay_horas: 0 });

// m1 → «Agendó» (sí → m_si · si no → m_no).
const F = normalizar([
  msg('m1', 'c'),
  { id: 'c', nodo: 'condicion', ramas: [{ id: 'c_si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'm_si' }], si_no: 'm_no' },
  msg('m_si'), msg('m_no'),
] as PasoGrafo[]);

test('un escenario por camino, y el primero es el que elegiría el motor con el lead recién llegado', () => {
  const { escenarios, faltan } = escenariosDePrueba(F, { hechos: hechosDeLeadNuevo({}) });
  assert.equal(escenarios.length, 2);
  assert.equal(faltan, 0);
  // Recién llegado = no agendó: el «Si no» primero.
  assert.equal(escenarios[0].elecciones.c, RESULTADO_SI_NO);
  assert.equal(escenarios[1].elecciones.c, 'c_si');
  assert.ok(escenarios[0].pasos[0].startsWith('No: '), escenarios[0].pasos[0]);
  assert.equal(escenarios[0].mensajes, 2);
  // Sin condiciones, uno solo y sin nada elegido: la barra no se dibuja.
  const solo = escenariosDePrueba(normalizar([msg('a', 'b'), msg('b')]));
  assert.equal(solo.escenarios.length, 1);
  assert.deepEqual(solo.escenarios[0].elecciones, {});
});

test('cuenta sólo los mensajes del canal que se prueba', () => {
  const G = normalizar([
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'c_w', modo: 'todas', filas: [{ campo: 'tiene_telefono' }], siguiente: 'w' }], si_no: 'e' },
    msg('w'), msg('e', null, 'email'),
  ] as PasoGrafo[]);
  const { escenarios } = escenariosDePrueba(G, { cuenta: (p) => p.canal === 'whatsapp' });
  assert.deepEqual(escenarios.map((e) => e.mensajes).sort(), [0, 1]);
});

test('una plantilla de verdad: «Un Lead Entró» abre sus caminos, con tope', () => {
  const pasos = normalizar(PLANTILLAS.find((p) => p.id === 'lead-entro')!.pasos as PasoGrafo[]);
  const { escenarios } = escenariosDePrueba(pasos, { hechos: hechosDeLeadNuevo({}), cuenta: (p) => p.canal === 'whatsapp' });
  assert.ok(escenarios.length > 2 && escenarios.length <= TOPE_ESCENARIOS, `salieron ${escenarios.length}`);
  assert.ok(escenarios.some((e) => e.pasos.some((t) => /contestó/i.test(t))), 'el «No contestó desde que entró» es un camino');
  assert.equal(new Set(escenarios.map((e) => e.id)).size, escenarios.length, 'sin repetidos');
});

const PANEL = readFileSync(new URL('../app/automations/PanelProbar.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
test('el panel: la barra sólo con más de un escenario, y la condición sale por lo que dice el escenario', () => {
  assert.match(PANEL, /const conBarra = canal !== 'email' && escenarios\.length > 1;/);
  const caso = PANEL.slice(PANEL.indexOf("case 'condicion': {"), PANEL.indexOf("case 'fin':"));
  const forzar = caso.search(/const forzado = escRef\.current\?\.elecciones\[evento\.nodo\];\n\s+if \(forzado && simRef\.current\.rama === 'salida' && evento\.opciones\.some\(\(o\) => o\.puerto === forzado\)\) \{\n\s+simRef\.current = elegir\(simRef\.current, forzado\);/);
  assert.ok(forzar >= 0, 'la condición no sale por lo que dice el escenario');
  assert.ok(forzar < caso.indexOf('elegirComoLead('), 'el escenario va ANTES de decidir como el lead recién llegado');
});

test('«Probar en WhatsApp» pide el escenario cuando hay más de uno', () => {
  const base = {
    esEmail: false, guardados: { telefonos: ['5491100000000'], emails: [] }, onElegir: () => {}, nuevo: false, onNuevo: () => {},
    onProbarNuevo: () => {}, error: null, formTelefono: null, formEmail: null, puedeProbarNuevo: false,
  };
  const dos = renderToStaticMarkup(createElement(MenuDestinos, {
    ...base, escenario: { opciones: [{ id: 'a', rotulo: 'Escenario 1', detalle: 'No: Agendó' }, { id: 'b', rotulo: 'Escenario 2', detalle: 'Agendó' }], elegido: 'b', onElegir: () => {} },
  }));
  assert.match(dos, /aria-label="Escenario"/);
  assert.match(dos, /Escenario 2/);
  const uno = renderToStaticMarkup(createElement(MenuDestinos, { ...base, escenario: { opciones: [{ id: 'a', rotulo: 'Escenario 1', detalle: '' }], elegido: 'a', onElegir: () => {} } }));
  assert.doesNotMatch(uno, /aria-label="Escenario"/);
});
