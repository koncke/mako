// =============================================================================
// TODA FLECHA SE PUEDE DESCONECTAR (16/10/2026, feedback de Martín por Cerebro, punto 1)
// =============================================================================
// «Muchas flechas NO se pueden "desconectar"... en "Un Lead Agendó Llamada" solo puedo desconectar la flecha del
// CONDITION "Su reunión sigue en pie"».
//
// Medido en producción (#252 del ws 9, la copia de esa plantilla): la papelera de cada flecha y el «Desconectar» del
// click derecho funcionaban. Lo que no andaba era AGARRAR LA PUNTA: `Lienzo.tsx` no le daba punta a una flecha con
// esperas encima (`a.esperas?.length`), y en esa automatización son casi todas las de la cadena de recordatorios
// («1 día antes», «1 hora antes»…). La de la condición no lleva espera: era la única que se agarraba. Y soltar una punta
// en el vacío sólo ofrecía una tarjeta nueva (cerrar el menú la dejaba igual): no había cómo «desconectarla» así.
//
// Lo que fija este archivo:
//   · toda flecha con esperas tiene su punta, y moverla sale de la ÚLTIMA espera (las pastillas se quedan);
//   · soltada en el vacío, la primera opción del menú es «Desconectar»;
//   · y en los datos, las 17 flechas de «Un Lead Agendó Llamada» se desconectan como lo hace la pantalla.
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-flechas.mjs; base 4 pass / 0 fail). El resultado MEDIDO de cada
// rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import { grafoDeSecuencia } from '../lib/flujo-conversacion';
import { desconectar, conectar, crearSuelta } from '../lib/flujo-edicion';
import { normalizar, indicePorId, type PasoGrafo } from '../lib/flujo-grafo';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const LIENZO = leer('app/_components/Lienzo.tsx');
const pasosAgendo = () => normalizar(pasosDePlantilla(plantillaPorId('lead-agendo')!) as unknown as PasoGrafo[]);

// rotura 1 (volver a esconder la punta de una flecha con esperas): 3 pass / 1 fail, cae éste.
test('toda flecha con esperas encima tiene su punta para agarrarla', () => {
  const i = LIENZO.indexOf('{onReconectar && !revelando && grafo.aristas.map((a, i) => {');
  assert.ok(i > 0);
  const puntas = LIENZO.slice(i, LIENZO.indexOf('LAS ESPERAS QUE VAN EN UNA FLECHA', i));
  assert.match(puntas, /if \(a\.sinMas\) return null;/);
  assert.doesNotMatch(puntas, /a\.esperas\?\.length/, 'la flecha con una pastilla se quedaba sin punta');
  // Y quien la recibe sale de la ÚLTIMA espera: moverla no se lleva las pastillas.
  assert.match(leer('app/automations/FlujoLienzo.tsx'), /const desdeDe = \(a: AristaFlujo\) => \(a\.esperas\?\.length \? \{ desde: a\.esperas\[a\.esperas\.length - 1\]\.id, puerto: 'sig' \}/);
});

// rotura 2 (el menú del vacío sin «Desconectar»): 3 pass / 1 fail, cae éste.
test('una punta soltada en el vacío ofrece «Desconectar» primero', () => {
  const soltar = LIENZO.slice(LIENZO.indexOf('function soltarCirculo('), LIENZO.indexOf('function soltarCirculo(') + 3000);
  assert.match(LIENZO, /const itemDesconectar = \(a: AristaFlujo\): ItemMenuLienzo\[\] => \(onQuitarFlecha\n\s*\? \[\{ id: '__desconectar', label: 'Desconectar', icono: <Icon name="tijera" size=\{16\} \/>, grupo: -1, onElegir: \(\) => \{ setFantasma\(null\); onQuitarFlecha\(a\); \} \}\]/);
  assert.match(soltar, /items: \[\.\.\.itemDesconectar\(a\), \.\.\.comoItems\(opciones, elegir\)\]/, 'primero, antes de las tarjetas nuevas');
});

// rotura 3 (la papelera apunta a la tarjeta y no a la primera espera): 3 pass / 1 fail, cae éste.
test('en «Un Lead Agendó Llamada» las 17 flechas se desconectan como lo hace la pantalla', () => {
  const pasos = pasosAgendo();
  const g = grafoDeSecuencia(pasos as never, { disparador: 'Agendó' });
  assert.equal(g.aristas.length, 17);
  const conEsperas = g.aristas.filter((a) => a.esperas?.length);
  assert.ok(conEsperas.length >= 5, 'la cadena de recordatorios lleva sus pastillas');
  for (const a of g.aristas) {
    // La papelera y «Desconectar» del vacío (`quitarFlecha`, FlujoLienzo.tsx): con esperas, la flecha llega a la primera.
    const r = desconectar(pasos, a.desde, a.puerto ?? 'sig', a.esperas?.[0]?.id ?? a.hasta);
    assert.ok(r.ok, `${a.desde} → ${a.hasta}: ${'motivo' in r ? r.motivo : ''}`);
  }
  // En el dato, una flecha con esperas NO llega a la tarjeta que se ve: llega a su primera espera. Por eso la pantalla
  // tiene que pasar ésa.
  for (const a of conEsperas) assert.equal(desconectar(pasos, a.desde, a.puerto ?? 'sig', a.hasta).ok, false);
  assert.match(leer('app/automations/FlujoLienzo.tsx'), /const r = desconectar\(pasos, a\.desde, a\.puerto \?\? 'sig', a\.esperas\?\.\[0\]\?\.id \?\? a\.hasta\);/);
});

// (Sin rotura propia: el lado de la pantalla, salir de la ÚLTIMA espera, lo fija el primer test con `desdeDe`.)
test('mover la punta de una flecha con esperas: las pastillas se quedan, apuntando a la tarjeta nueva', () => {
  const pasos = pasosAgendo();
  const g = grafoDeSecuencia(pasos as never, { disparador: 'Agendó' });
  for (const a of g.aristas.filter((x) => x.esperas?.length)) {
    // Lo que hace `reconectar` (FlujoLienzo.tsx): desde la ÚLTIMA espera, a otra tarjeta.
    const ultima = a.esperas![a.esperas!.length - 1].id;
    const suelta = crearSuelta(pasos, 'whatsapp' as never);
    const r1 = desconectar(suelta.pasos, ultima, 'sig', a.hasta);
    assert.ok(r1.ok, `${a.desde} → ${a.hasta}`);
    const r2 = conectar(r1.pasos, ultima, 'sig', suelta.id);
    assert.ok(r2.ok, `${ultima} → ${suelta.id}: ${'motivo' in r2 ? r2.motivo : ''}`);
    for (const e of a.esperas!) assert.ok(indicePorId(r2.pasos, e.id) >= 0, 'la pastilla se fue con el cambio');
  }
});
