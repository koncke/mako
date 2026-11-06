// =============================================================================
// Migrar los contactos de otro CRM: sin repetir a nadie y QUIETOS (6/11/2026, la agencia de Thiago)
// =============================================================================
// Lo que Martín le prometió a Thiago (docs/promesas/2910-llamada-thiago.md): se guardan el id del CRM viejo, la fecha
// original y las UTM; volver a migrar no repite a nadie; y un migrado no recibe ningún mensaje ni entra a ninguna
// automatización por haber llegado. Lo último es lo que evita escribirle de golpe a miles de contactos.
//
// Los tres casos corren sobre el código REAL contra una base de mentira (tests/_migrar-contactos-hijo.ts): `createLead`,
// la operación `migrar_contactos` por el camino de un token detallado y la cohorte de una automatización. Las reglas puras
// (lib/migracion-leads.ts) se ejecutan acá.
//
// Probado rompiéndolo (6/11/2026), con la base en 12/0 (13/0 con el alta en lote, que se sumó después):
//   · sin `sinMigrados` en `leadsDeCohorte` (lib/nutricion.ts) → 10/2: «la cohorte de "Un Lead Entró"…» y «…ni al activar».
//   · sin el `'migracion'` en `quedaDondeLoPusieron` (app/crm/origen-lead.ts) → 11/1: «el CRM automático no lo mueve».
//   · sin el chequeo por id en `createLead` Y sin el índice de la 0405 en el doble → 10/2: «el mismo id dos veces» y el
//     segundo envío del lote.
//   · sin `etapaAbierta` en `ubicarEnEtapas` → 9/3: el «ganado» entraba (las que miran las etapas finales).
//   · sin las UTM en `crearLeadsDePropuesta` (lib/api-mako/flujo.ts) → 12/1: «el alta en lote… ya no tira las UTM».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fechaOriginalDe, leerLoteMigracion, quitarMigrados, ubicarEnEtapas, etapaAbierta, porEtapa, TOPE_LOTE_MIGRACION } from '../lib/migracion-leads';
import { quedaDondeLoPusieron, origenLista } from '../app/crm/origen-lead';
import { canalDeEntrada } from '../app/crm/lead-view/ficha/resumen/logica';

const RAIZ = join(import.meta.dirname, '..');
let R: Record<string, any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
function resultado() {
  if (R) return R;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_migrar-contactos-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000,
  });
  R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  return R!;
}

test('createLead: guarda el id del CRM viejo, el CRM, la fecha original y las UTM', () => {
  const a = resultado().alta;
  assert.equal(a.idExterno, 'x-1');
  assert.equal(a.migradoDe, 'HubSpot');
  assert.equal(a.fechaOriginal, '2025-03-14T00:00:00.000Z');
  assert.equal(a.utm, 'fb');
  assert.equal(a.origen, 'migracion');
});

test('createLead: el mismo id dos veces NO crea a otra persona, ni con «permitirDuplicado»', () => {
  const a = resultado().alta;
  assert.equal(a.segunda, `ya migrado #${a.creado}`, 'la sospecha de duplicado se apaga; el id del CRM viejo no');
  assert.equal(a.otroCrm, true, 'el mismo id de OTRO CRM viejo es otra persona');
});

test('la operación: crea en su etapa, adopta al que ya estaba por email y deja afuera lo que no entra, diciendo por qué', () => {
  const o = resultado().operacion;
  assert.equal(o.r1.ok, true);
  assert.equal(o.r1.datos.creados, 2);
  assert.equal(o.r1.datos.adoptados, 1, 'Rosa ya estaba por email: se le anota el id, no se la duplica');
  const nuevos = o.migrados.filter((m: { origen: string }) => m.origen === 'migracion');
  assert.deepEqual(nuevos.map((m: { idExterno: string }) => m.idExterno).sort(), ['ghl-1', 'ghl-2']);
  for (const m of nuevos) assert.equal(m.etapa, 'lead', 'nace en su etapa (por key o por nombre), sin moverse después');
  assert.equal(nuevos.find((m: { idExterno: string }) => m.idExterno === 'ghl-1').fechaOriginal, '2025-01-02T00:00:00.000Z');
  assert.equal(nuevos.find((m: { idExterno: string }) => m.idExterno === 'ghl-1').utm, 'verano');
  assert.deepEqual(o.rosa, { idExterno: 'ghl-3', origen: 'landing' }, 'la que ya estaba sigue siendo lo que era (no se aquieta ni se mueve)');
  const afuera = o.r1.datos.descartados.join(' | ');
  assert.match(afuera, /Cerrado Ya.*cierra el trato/, 'un ganado del CRM viejo no entra por acá');
  assert.match(afuera, /Sin Contacto.*no tiene email, teléfono ni Instagram/);
  assert.match(afuera, /ghl-1 viene dos veces/, 'un id repetido adentro del lote entra una vez');
  assert.match(o.r1.resumen, /Quedaron afuera 3/, 'la respuesta que lee quien migra dice cuántos quedaron afuera');
  assert.equal(o.ajenoIntacto, true, 'el mismo id en OTRO negocio no cuenta ni se toca');
});

test('la operación: volver a mandar el mismo lote no crea a nadie (repetirlo es seguro)', () => {
  const o = resultado().operacion;
  assert.equal(o.r2.ok, true, 'para un token que escribe en el acto, «ya está así» es un éxito');
  assert.match(o.r2.resumen, /ya entraron antes/);
  assert.equal(o.totalEnWs, 6, '2 de siempre + 2 del alta suelta + 2 migrados: ni uno más después del segundo envío');
});

test('la cohorte de «Un Lead Entró» (los parados en la entrada) NO trae a ningún migrado: el de siempre, sí', () => {
  const r = resultado();
  const { etapa } = r.cohorte;
  assert.ok(etapa.includes(r.ids.vivo), 'un lead de la landing sigue entrando: el corte es sólo para los migrados');
  for (const id of [r.alta.creado, ...r.operacion.r1.datos.leadIds]) assert.ok(!etapa.includes(id), `el migrado #${id} no entra por el barrido`);
});

test('…ni al activar una automatización y pedir «los que ya están» (sin ventana)', () => {
  const r = resultado();
  for (const id of r.operacion.r1.datos.leadIds) assert.ok(!r.cohorte.sinVentana.includes(id));
});

test('el alta en lote de siempre (proponer_leads), aplicada en el acto por un token, ya no tira las UTM', () => {
  assert.deepEqual(resultado().lote, { ok: true, utm_source: 'ig', utm_campaign: 'otoño' });
});

test('nada salió a la red', () => {
  assert.deepEqual(resultado().red, []);
});

test('el CRM automático, los barridos sin disparador y las fotos de WhatsApp no lo tocan (`quedaDondeLoPusieron`)', () => {
  assert.equal(quedaDondeLoPusieron('migracion'), true, 'el CRM automático no lo mueve');
  assert.equal(quedaDondeLoPusieron('landing'), false);
  assert.equal(origenLista('migracion'), 'Migrado de otro CRM');
  assert.equal(canalDeEntrada('migracion').texto, 'Migrado de otro CRM');
});

test('quitarMigrados saca de la cohorte justo a los migrados, y a nadie más', () => {
  assert.deepEqual(quitarMigrados([1, 2, 3, 4], new Set([2, 4])), [1, 3]);
  assert.deepEqual(quitarMigrados([1, 2], new Set()), [1, 2]);
});

test('el lote: id, nombre y un contacto obligatorios; un id repetido entra una vez; de a 200', () => {
  const r = leerLoteMigracion([
    { idExterno: 'a', nombre: 'Uno', email: 'UNO@x.test' },
    { nombre: 'Sin id', email: 'b@x.test' },
    { idExterno: 'c', email: 'c@x.test' },
    { idExterno: 'd', nombre: 'Sin contacto' },
    { idExterno: 'a', nombre: 'Otra vez', telefono: '+34 600' },
    { idExterno: 77, nombre: 'Número', instagram: '@numero' },
  ]);
  assert.deepEqual(r.contactos.map((c) => c.idExterno), ['a', '77']);
  assert.equal(r.contactos[0].email, 'uno@x.test');
  assert.equal(r.contactos[1].instagram, 'numero');
  assert.equal(r.descartados.length, 4);
  const muchos = leerLoteMigracion(Array.from({ length: TOPE_LOTE_MIGRACION + 5 }, (_, i) => ({ idExterno: `i${i}`, nombre: `N${i}`, email: `n${i}@x.test` })));
  assert.equal(muchos.contactos.length, TOPE_LOTE_MIGRACION);
  assert.match(muchos.descartados.join(' '), /entran de a 200/);
});

test('la fecha original: ISO, con hora o timestamp; una del futuro o rara no es una fecha de creación', () => {
  const ahora = Date.parse('2026-11-06T12:00:00Z');
  assert.equal(fechaOriginalDe('2025-03-14', ahora), '2025-03-14T00:00:00.000Z');
  assert.equal(fechaOriginalDe(1710374400, ahora), '2024-03-14T00:00:00.000Z', 'en segundos (HubSpot)');
  assert.equal(fechaOriginalDe('1710374400000', ahora), '2024-03-14T00:00:00.000Z', 'en milisegundos, como texto');
  assert.equal(fechaOriginalDe('2027-01-01', ahora), null);
  assert.equal(fechaOriginalDe('1980-01-01', ahora), null);
  assert.equal(fechaOriginalDe('ayer', ahora), null);
});

test('las etapas: por key o por nombre (sin tildes); una final o una que no existe lo deja afuera, nunca en la entrada', () => {
  const etapas = [
    { key: 'lead', label: 'Lead entrante', band: 'pipeline' },
    { key: 'agenda', label: 'Agendó', band: 'pipeline' },
    { key: 'ganado', label: 'Ganado', band: 'pipeline' },
    { key: 'perdido', label: 'Perdido', band: 'salidas' },
  ];
  const { contactos } = leerLoteMigracion([
    { idExterno: '1', nombre: 'A', email: 'a@x.test', etapa: 'agendo' },
    { idExterno: '2', nombre: 'B', email: 'b@x.test' },
    { idExterno: '3', nombre: 'C', email: 'c@x.test', etapa: 'ganado' },
    { idExterno: '4', nombre: 'D', email: 'd@x.test', etapa: 'Perdido' },
    { idExterno: '5', nombre: 'E', email: 'e@x.test', etapa: 'Calificado' },
  ]);
  const { ubicados, afuera } = ubicarEnEtapas(contactos, etapas, 'lead');
  assert.deepEqual(ubicados.map((u) => [u.idExterno, u.etapaKey]), [['1', 'agenda'], ['2', 'lead']]);
  assert.equal(afuera.length, 3);
  assert.equal(etapaAbierta(etapas[2]), false);
  assert.equal(etapaAbierta(etapas[3]), false);
  assert.equal(porEtapa(ubicados), 'Agendó: 1 · Lead entrante: 1');
});
