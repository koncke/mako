// =============================================================================
// Un aviso sobre un LEAD dice quién es, cuánto, y lleva a su ficha (20/10/2026)
// =============================================================================
// Martín, en la llamada con Leila del 19/10 (24:15): en el teléfono sale «Cuota vencida → cobrar» sin decir de quién,
// sin el monto y sin llevar a la ficha. Medido en producción (sólo leyendo): el ws1 escribe una fila por día a las
// 14:00 con título y texto iguales y el link a Configuraciones. Es la bitácora de un evento de MaKo sin automatización
// (lib/aviso-evento.ts), y el lead viajaba hasta `emitirAviso` sin que nadie lo usara para el link.
//
// Lo que se fija:
//   1. `linkDelLeadDelAviso` (EJECUTADA): con lead, su ficha; un aviso `alDueno` (lo lee el super admin, el lead es
//      de un cliente) no;
//   2. `textoSinAutomatizacion` (EJECUTADA): quién, qué cuota, cuánto y cuándo venció;
//   3. `emitirPorEvento` sin automatizaciones (EJECUTADO con dependencias de prueba): emite ese texto y el lead;
//   4. `emitirAviso` usa el link del lead en la fila, en el push y en el correo (leído del fuente: es server-only);
//   5. el TÍTULO nombra al cliente adelante («Francisco · Cuota vencida → cobrar»), en la fila y en el push: en el detalle
//      quedaba escondido (lo agregó el Cerebro el 20/10, docs/investigacion-ops-center-19-10.md).
//
// PROBADO ROMPIÉNDOLO (20/10/2026), una rotura por vez con un script que reemplaza, corre y restaura byte a byte. Con
// el código como está: 8 pases, 0 fallos. Rota (pases / fallos):
//   · la bitácora con el título repetido como texto (lo de antes)                          → 6 / 2
//   · la bitácora sin pasar el lead (sin link a la ficha)                                   → 7 / 1
//   · la fila del aviso con el link de siempre (Configuraciones)                            → 7 / 1
//   · un aviso `alDueno` con link a la ficha de un lead ajeno                               → 7 / 1
//   · el push sin el cliente en el título                                                   → 7 / 1
//   · el título sin el nombre                                                               → 7 / 1
// Correr: npx tsx --test tests/aviso-lead.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { linkDelLeadDelAviso, textoSinAutomatizacion, tituloConLead } from '../lib/aviso-lead';
import { emitirPorEvento, type DepsEvento } from '../lib/aviso-evento';
import type { EmitirAvisoInput } from '../lib/avisos';

const fuente = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('el link: con lead, su ficha; sin lead o para el super admin, ninguno', () => {
  assert.equal(linkDelLeadDelAviso({ lead: { id: 2739 } }), '/crm/2739');
  assert.equal(linkDelLeadDelAviso({}), null);
  assert.equal(linkDelLeadDelAviso({ lead: { id: 0 } }), null);
  assert.equal(linkDelLeadDelAviso({ lead: { id: 2739 }, alDueno: true }), null, 'el lead es de un cliente: su ficha no es del super admin');
});

test('⚠️ la bitácora de la cuota dice quién, qué cuota, cuánto y cuándo', () => {
  const datos = { cuota_numero: '2', cuota_monto: 'US$1,000', cuota_vence: '29/07/2026', cuota_dias: '80 días' };
  assert.equal(textoSinAutomatizacion('cuota-vencida', 'Cuota vencida → cobrar', { lead: { nombre: 'Francisco' }, datos }),
    'Francisco: Cuota 2 de US$1,000 sin cobrar · venció el 29/07/2026');
  assert.equal(textoSinAutomatizacion('cuota-por-vencer', 'Cuota por vencer', { lead: { nombre: 'Ana' }, datos: { ...datos, cuota_numero: '0' } }),
    'Ana: Cobro inicial de US$1,000 · vence el 29/07/2026');
  assert.equal(textoSinAutomatizacion('cuota-vencida', 'Cuota vencida → cobrar', { lead: null, datos }), 'Un cliente: Cuota 2 de US$1,000 sin cobrar · venció el 29/07/2026');
  assert.equal(textoSinAutomatizacion('lead-nuevo', 'Lead nuevo', { lead: { nombre: 'Ana' } }), 'Lead nuevo · Ana');
  assert.equal(textoSinAutomatizacion('lead-nuevo', 'Lead nuevo', {}), 'Lead nuevo');
});

test('⚠️ un evento sin automatización deja la fila con ese texto y el lead (para el link a la ficha)', async () => {
  const emitidos: EmitirAvisoInput[] = [];
  const d: DepsEvento = {
    leerFilas: async () => [],
    emitirAviso: async (a) => { emitidos.push(a); return { ok: true, feedId: 7, wa: false, deduped: false, apagado: true }; },
    reclamar: async () => true,
    correr: async () => {},
    log: () => {},
  };
  const cat = { id: 'cuota-vencida', titulo: 'Cuota vencida → cobrar', categoria: 'accion' as const, semaforo: 'rojo' as const };
  await emitirPorEvento(cat, 3, { lead: { id: 2739, nombre: 'Francisco' }, datos: { cuota_numero: '2', cuota_monto: 'US$1,000', cuota_vence: '29/07/2026' } }, d);
  assert.equal(emitidos.length, 1);
  assert.equal(emitidos[0].texto, 'Francisco: Cuota 2 de US$1,000 sin cobrar · venció el 29/07/2026');
  assert.deepEqual(emitidos[0].lead, { id: 2739, nombre: 'Francisco' });
});

test('⚠️ `emitirAviso` lleva a la ficha del lead en la fila, en el push y en el correo', () => {
  const a = fuente('lib/avisos.ts');
  assert.match(a, /link: a\.link \?\? linkDelLeadDelAviso\(a\) \?\? '\/configuraciones\?tab=notif',/);
  assert.match(a, /ruta: a\.link \?\? linkDelLeadDelAviso\(a\) \?\? '\/m\/inbox\?vista=avisos',/);
  assert.match(a, /const destino = a\.link \?\? linkDelLeadDelAviso\(a\);/);
  assert.match(a, /cta: destino \? \{ texto: 'Verlo en MaKo'/);
});

test('el teléfono abre la ficha: /crm/<id> se traduce a /m/crm/<id>', () => {
  assert.match(fuente('lib/movil-rutas.ts'), /const lead = p\.match\(\/\^\\\/crm\\\/\(\\d\+\)\(\?:\\\/resumen\)\?\$\/\);\s*if \(lead\) return `\/m\/crm\/\$\{lead\[1\]\}`;/);
});

test('la fila de un evento sin automatización ya no repite el título como texto', () => {
  assert.doesNotMatch(fuente('lib/aviso-evento.ts'), /texto: opts\.texto \?\? cat\.titulo,/);
});

test('⚠️ el título nombra al cliente, adelante; sin nombre o si ya lo dice, tal cual', () => {
  assert.equal(tituloConLead('Cuota vencida → cobrar', { nombre: 'Francisco' }), 'Francisco · Cuota vencida → cobrar');
  assert.equal(tituloConLead('Cuota vencida → cobrar', null), 'Cuota vencida → cobrar');
  assert.equal(tituloConLead('Cuota vencida → cobrar', { nombre: '  ' }), 'Cuota vencida → cobrar');
  assert.equal(tituloConLead('Francisco pagó', { nombre: 'francisco' }), 'Francisco pagó');
});

test('⚠️ el título con el cliente va en la fila de avisos y en el push', () => {
  const a = fuente('lib/avisos.ts');
  assert.equal((a.match(/titulo: tituloConLead\(a\.titulo, a\.lead\),/g) ?? []).length, 2);
});
