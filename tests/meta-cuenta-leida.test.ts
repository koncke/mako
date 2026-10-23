// =============================================================================
// /ads-manager y el selector del CRM dicen QUÉ cuenta de Meta leen (23/10/2026)
// =============================================================================
// Mauricio creó campañas para tres clientes en el Administrador de anuncios de
// Meta y «no aparecían» en MaKo. MaKo no filtraba: Meta no las tenía en la cuenta
// conectada (borrador sin publicar, u otra cuenta). Nada en pantalla decía qué
// cuenta se leía, y la única lectura posible era un error de MaKo.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  etiquetaCuentaMeta, numeroDeCuenta, ultimaCreada, avisoSinCampanasNuevas, DIAS_SIN_CAMPANAS_NUEVAS,
} from '../lib/meta-cuenta-leida';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('La cuenta va como la muestra Meta: el nombre y el número sin act_', () => {
  assert.equal(etiquetaCuentaMeta({ id: 'act_1551449682972756', nombre: 'Patricia Contreras' }), 'Cuenta Patricia Contreras · 1551449682972756');
  // La cuenta que nadie bautizó se llama como su número (ws20): no se repite.
  assert.equal(etiquetaCuentaMeta({ id: 'act_4171287933095795', nombre: '4171287933095795' }), 'Cuenta 4171287933095795');
  assert.equal(etiquetaCuentaMeta({ id: 'act_4171287933095795', nombre: null }), 'Cuenta 4171287933095795');
  // La del ws1 se llama «Cuenta 2»: en producción salía «Cuenta Cuenta 2 · …» (23/10).
  assert.equal(etiquetaCuentaMeta({ id: 'act_564003520636790', nombre: 'Cuenta 2' }), 'Cuenta 2 · 564003520636790');
  assert.equal(etiquetaCuentaMeta({ id: null, nombre: 'Cuenta 2' }), null);
  assert.equal(etiquetaCuentaMeta(null), null);
  assert.equal(numeroDeCuenta('act_564003520636790'), '564003520636790');
});

test('La última campaña creada se elige por FECHA, con el offset de Meta', () => {
  // Meta manda el created_time con el offset de la cuenta: comparar el texto ordenaría mal.
  assert.equal(ultimaCreada(['2026-10-01T23:00:00-0700', '2026-10-02T05:00:00+0000', null, 'basura']), '2026-10-01T23:00:00-0700');
  assert.equal(ultimaCreada([]), null);
});

test('Sin campañas nuevas lo dice como algo de Meta, no como un error de MaKo', () => {
  const hoy = new Date('2026-10-23T12:00:00Z');
  const sergio = avisoSinCampanasNuevas({ hayCampanas: true, ultima: '2023-09-05T12:12:23-0300' }, hoy);
  assert.ok(sergio && /publícala|revisa que sea esta cuenta/.test(sergio), String(sergio));
  assert.ok(sergio && !/error|MaKo/i.test(sergio), 'no dice que falló algo');
  assert.ok(avisoSinCampanasNuevas({ hayCampanas: false, ultima: null }, hoy));
  // Una creada hace menos de un mes: no se avisa nada.
  assert.equal(avisoSinCampanasNuevas({ hayCampanas: true, ultima: '2026-10-20T10:00:00+0000' }, hoy), null);
  const borde = new Date(hoy.getTime() - (DIAS_SIN_CAMPANAS_NUEVAS - 1) * 86_400_000).toISOString();
  assert.equal(avisoSinCampanasNuevas({ hayCampanas: true, ultima: borde }, hoy), null);
  // Campañas sin fecha: no es una cuenta vacía, no se afirma nada.
  assert.equal(avisoSinCampanasNuevas({ hayCampanas: true, ultima: null }, hoy), null);
});

test('Las dos pantallas lo dibujan, y sólo con Meta contestando', () => {
  const browser = leer('../app/ads-manager/CampanasBrowser.tsx');
  assert.match(browser, /etiquetaCuentaMeta\(\{ id: health\.account\.accountId, nombre: health\.account\.nombre/);
  assert.match(browser, /const cuentaLeida = health && !error \?/);
  // Sin cuenta (el health «Sin conexión») no hay aviso de cuenta vacía.
  assert.match(browser, /const avisoCuenta = health && cuentaLeida && !loading/);

  // El «Cuenta» lo pone la función: una pantalla que lo sume afuera vuelve a duplicarlo.
  assert.doesNotMatch(browser, />Cuenta \{/);
  const modal = leer('../app/crm/CampanasModal.tsx');
  assert.doesNotMatch(modal, />Cuenta \{/);
  assert.match(modal, /estado\?\.cuentaMeta && etiquetaCuentaMeta\(estado\.cuentaMeta\.cuenta\)/);
  assert.match(modal, /avisoSinCampanasNuevas\(estado\.cuentaMeta\)/);

  const acc = leer('../app/crm/campanas-actions.ts');
  // Con Meta fallando no hay cuenta: el modal no afirma «no tiene campañas».
  assert.match(acc, /campanas: \[\], conjuntos: \[\], cuenta: null,/);
  assert.match(acc, /hayCampanas: meta\.campanas\.length > 0/);
});

test('Meta trae el nombre de la cuenta y la fecha de cada campaña', () => {
  const src = leer('../lib/meta-health.ts');
  assert.match(src, /nombre: typeof raw\.name === 'string'/);
  assert.match(src, /edgeUrl\('campaigns', 'id,name,effective_status,created_time'\)/);
  assert.match(src, /creada: txt\(r\.created_time\) \|\| null/);
  assert.match(src, /cuenta: \{ id: acct, nombre: /);
  // El pedido de la cuenta sólo da el nombre: si falla, no se lleva puestas las campañas.
  assert.match(src, /fetchAccountRaw\(\)\.catch\(\(\) => null\)/);
  // El campo `name` ya se pedía para la cuenta: si alguien lo saca, el nombre queda vacío.
  assert.match(src, /'name,account_status,disable_reason,/);
});
