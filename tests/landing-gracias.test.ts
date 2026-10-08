// =============================================================================
// La página de GRACIAS: quien llega pasa a Ganado, por los mismos caminos que el tablero
// =============================================================================
// Pedido de Martín (07/10/2026, por la sesión de Customer Success): «automatice mediante el
// pixel de MaKo que si alguien cae en una TKY Page, se pueda automatizar pasar al lead a Ganado
// directamente».
//
// Correr: npx tsx --test tests/landing-gracias.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (07/10/2026), una por vez y restaurando de memoria. Con todo
// puesto: 7 pases / 0 fallos. Cada rotura, 6 / 1:
//   · un "true" de texto prende la página de gracias
//   · guardar los productos le saca la marca
//   · con dos leads en el mismo navegador se elige el primero
//   · un lead ya ganado se vuelve a mover
//   · una recarga suma otra visita sin ficha
//   · la vista previa del editor también gana leads
//   · valida los requisitos (y sin monto no lo mueve nunca)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conLanding, parsearConfig } from '../lib/landing-config';
import { conRechazo, parsearRechazos, pasosDeGracias, quienLlegoALaGracias, rechazosDe } from '../lib/landing-gracias-reglas';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('la marca se guarda sólo cuando es true, y las configs de hoy no cambian', () => {
  // Una fila de hoy (sin el campo) se lee igual que antes.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com/gracias","funnelIds":[3]}]'), [{ url: 'https://a.com/gracias', funnelIds: [3] }]);
  assert.deepEqual(parsearConfig('[{"url":"https://a.com/gracias","gracias":true}]'), [{ url: 'https://a.com/gracias', gracias: true }]);
  // Un "true" o un 1 de un setting editado a mano NO prende algo que mueve leads a Ganado.
  assert.deepEqual(parsearConfig('[{"url":"https://a.com/g","gracias":"true"},{"url":"https://b.com/g","gracias":1}]'),
    [{ url: 'https://a.com/g' }, { url: 'https://b.com/g' }]);
});

test('guardar los productos no le saca la marca, y guardar la marca no le saca los productos', () => {
  const hoy = parsearConfig('[{"url":"https://a.com/gracias","funnelIds":[3],"gracias":true}]');
  assert.deepEqual(conLanding(hoy, 'https://a.com/gracias', { funnelIds: [3, 7] }), [{ url: 'https://a.com/gracias', funnelIds: [3, 7], gracias: true }]);
  assert.deepEqual(conLanding(hoy, 'https://a.com/gracias', { gracias: false }), [{ url: 'https://a.com/gracias', funnelIds: [3] }]);
  // Corregirle la URL tampoco.
  assert.deepEqual(conLanding(hoy, 'https://a.com/gracias-2', {}, 'https://a.com/gracias'), [{ url: 'https://a.com/gracias-2', funnelIds: [3], gracias: true }]);
});

test('a quién es la visita: uno solo, o nadie — nunca se adivina ni se crea', () => {
  assert.deepEqual(quienLlegoALaGracias([]), { motivo: 'sin_lead' });
  assert.deepEqual(quienLlegoALaGracias([{ id: 41 }]), { leadId: 41 });
  assert.deepEqual(quienLlegoALaGracias([{ id: '41' }, { id: 41 }]), { leadId: 41 });
  // Dos opt-ins desde el mismo navegador: no se elige al más nuevo.
  assert.deepEqual(quienLlegoALaGracias([{ id: 41 }, { id: 52 }]), { motivo: 'varios_leads' });
});

test('los pasos: la casa por estado_lead, las filas por su etapa, y lo que no está se agrega', () => {
  const productos = [
    { funnelId: 1, esCasa: true, etapa: null, desde: null },
    { funnelId: 2, esCasa: false, etapa: 'agenda', desde: null },
    { funnelId: 3, esCasa: false, etapa: 'ganado', desde: null },
  ];
  assert.deepEqual(pasosDeGracias({ destinos: [1, 2, 3, 4], productos, casaGanada: false, ganado: 'ganado' }), [
    { tipo: 'casa', funnelId: 1 },
    { tipo: 'fila', funnelId: 2 },
    { tipo: 'agregar', funnelId: 4 },
  ]);
  // Ya ganado en su casa: no se lo vuelve a mover (eso re-dispararía todo lo que cuelga de ganar).
  assert.deepEqual(pasosDeGracias({ destinos: [1], productos, casaGanada: true, ganado: 'ganado' }), []);
  // Un destino repetido es un paso.
  assert.deepEqual(pasosDeGracias({ destinos: [4, 4], productos, casaGanada: false, ganado: 'ganado' }), [{ tipo: 'agregar', funnelId: 4 }]);
});

test('las visitas sin ficha: una recarga no suma, y se guardan sin datos de la persona', () => {
  const r = { at: '2026-10-07T12:00:00.000Z', url: 'https://a.com/gracias', motivo: 'sin_lead' as const };
  const una = conRechazo([], r);
  assert.equal(una.length, 1);
  // La misma visita recargada a los 20 s: no suma.
  assert.equal(conRechazo(una, { ...r, at: '2026-10-07T12:00:20.000Z' }).length, 1);
  // Otra visita a los dos minutos: sí.
  assert.equal(conRechazo(una, { ...r, at: '2026-10-07T12:02:00.000Z' }).length, 2);
  // Con tope.
  let lista = una;
  for (let i = 1; i <= 40; i++) lista = conRechazo(lista, { ...r, at: new Date(Date.parse(r.at) + i * 120_000).toISOString() });
  assert.equal(lista.length, 20);
  // El saneo descarta lo que no tiene la forma, y no guarda nada más que hora, página y motivo.
  assert.deepEqual(parsearRechazos('[{"at":"x","url":"u","motivo":"sin_lead","email":"a@b.c"},{"at":1}]'), [{ at: 'x', url: 'u', motivo: 'sin_lead' }]);
  assert.equal(rechazosDe(lista, 'https://otra.com').length, 0);
});

test('el beacon pregunta DESPUÉS de guardar la visita, y no gana a nadie desde el editor', () => {
  const src = sinComentarios(leer('app/api/track/vsl/route.ts'));
  const iInsert = src.indexOf("from('landing_visits').insert(");
  const iGracias = src.indexOf('await alVisitarPagina(');
  assert.ok(iInsert > 0 && iGracias > iInsert, 'la visita se guarda antes');
  assert.match(src, /if \(pagina && wsVisita != null && !esVistaDePrueba\(pagina\)\) \{\n\s*await alVisitarPagina\(/);
});

test('gana por los MISMOS caminos que el tablero, y sin crear leads', () => {
  const src = sinComentarios(leer('lib/landing-gracias.ts'));
  assert.match(src, /setPipelineStage\(leadId, GANADO, \{ autor: MAKO, requisitos: \{ omitir: MOTIVO \} \}\)/);
  assert.match(src, /moverEtapaEnProducto\(leadId, paso\.funnelId, GANADO/);
  assert.doesNotMatch(src, /createLead|from\('leads'\)\.(insert|update|upsert)/);
  // La primera pregunta del beacon es la marca: una página que no es de gracias sale ahí.
  assert.match(src, /if \(!cfg\?\.gracias\) return;/);
});
