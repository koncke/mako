// =============================================================================
// Ticket #89 (12/11/2026): «Llegaste al tope de tu plan (1). Pasa a MaKo «…» para tener más. Pídele a tu agencia que te pase a «…»»
// =============================================================================
// Código Inmobiliario (la agencia, ws13), operando dentro de «Sellers» (ws24), quiso invitar a alguien al equipo. Medido en la
// base ese día: Sellers es cliente aprobado de ws13, con el plan Esencial ELEGIDO por la agencia el 11/11 (`agency.plan_cambiado`)
// y capa `completo`; Esencial es 1 usuario y ya lo ocupa su dueño. El tope (1) es el de la tabla: no era el bug.
// Las dos fallas de verdad:
//   1. El «…» no lo vio el cliente: es `sinNombres` (lib/soporte-reporte.ts) tapando «Pro» como si fuera el nombre de un lead.
//   2. El cartel le decía A LA AGENCIA «Pídele a tu agencia que te pase a Pro». Ahora le da la puerta que le toca: salir de la
//      vista e ir a la ficha de esa cuenta en el Agency Dashboard (`ctaDeTope`).
// Correr: node --import tsx --test tests/tope-agencia-adentro-89.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ctaDeTope, ROTULO_PLAN_EN_AGENCY, ROTULO_PRO_DESDE_AGENCY, TEXTO_PEDIR_PRO_A_LA_AGENCIA } from '../lib/plan-esencial-reglas';
import { WS_PARAM } from '../lib/ws-tab';
import { limpio, sinNombres, TOPE_ERROR } from '../lib/soporte-reporte';
import { textoTope } from '../lib/topes-plan';

const fuente = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('1. la agencia adentro de su cliente: el botón a la ficha de ESA cuenta, no «Pídele a tu agencia»', () => {
  assert.deepEqual(ctaDeTope({ clienteDeAgencia: true, agenciaAdentroDe: 24 }), { tipo: 'agencia', href: '/agency?cuenta=24', rotulo: ROTULO_PRO_DESDE_AGENCY, puerta: 'agencia' });
  assert.doesNotMatch(ROTULO_PRO_DESDE_AGENCY, /Pídele|tu agencia/, 'quien lo lee ES la agencia');
  // El cliente de la agencia, en su cuenta: el texto, como desde el 6/11 (#494).
  assert.deepEqual(ctaDeTope({ clienteDeAgencia: true, agenciaAdentroDe: null }), { tipo: 'pedir', texto: TEXTO_PEDIR_PRO_A_LA_AGENCIA });
  // Los demás, y el `null` del primer dibujo: el link de cada cartel.
  assert.deepEqual(ctaDeTope({ clienteDeAgencia: false, agenciaAdentroDe: null }), { tipo: 'link' });
  assert.deepEqual(ctaDeTope({ clienteDeAgencia: null, agenciaAdentroDe: null }), { tipo: 'link' });
  // Un ws que no es un id no arma un link.
  assert.deepEqual(ctaDeTope({ clienteDeAgencia: true, agenciaAdentroDe: 0 }), { tipo: 'pedir', texto: TEXTO_PEDIR_PRO_A_LA_AGENCIA });
});

test('2. el cartel lee `modoAgencia` de /api/auth/me y sale de la vista antes de ir a la ficha', () => {
  const hook = fuente('app/_components/useClienteDeAgencia.ts');
  assert.match(hook, /agenciaAdentroDe: j\.modoAgencia === true && Number\(j\.clienteWs\) > 0 \? Number\(j\.clienteWs\) : null/);
  const cta = fuente('app/_components/CtaPasarAPro.tsx');
  assert.match(cta, /await fetch\('\/api\/agencia\/entrar', \{ method: 'DELETE' \}\)/, 'con la cookie de la agencia puesta, /agency la manda a /inicio');
  assert.match(cta, /if \(cta\.tipo === 'agencia'\)/);
  // /agency abre la ficha con `?cuenta=` (cuentaInicial), y ahí está «Pasar a Pro».
  assert.match(fuente('app/agency/page.tsx'), /const cuenta = ID\.test\(sp\.cuenta \?\? ''\) \? Number\(sp\.cuenta\) : null;/);
});

// El pedido del Cerebro del 12/11 después del #89: el super admin mirando a un cliente de agencia tampoco es «el cliente».
test('2b. el super admin adentro de un cliente de agencia: la ficha de esa cuenta en el Agency Dashboard DE SU AGENCIA', () => {
  const sa = { agenciaWs: 13, clienteWs: 24 };
  assert.deepEqual(ctaDeTope({ clienteDeAgencia: true, agenciaAdentroDe: null, superAdminMira: sa }),
    { tipo: 'agencia', href: '/agency?ws=13&cuenta=24', rotulo: ROTULO_PLAN_EN_AGENCY, puerta: 'admin' });
  assert.doesNotMatch(ROTULO_PLAN_EN_AGENCY, /Pídele|tu agencia|Pasar a Pro/, 'el botón de cambiar el plan es de la agencia: él lo ve');
  // Un id que no es un id no arma un link: vuelve al texto.
  assert.deepEqual(ctaDeTope({ clienteDeAgencia: true, agenciaAdentroDe: null, superAdminMira: { agenciaWs: 0, clienteWs: 24 } }),
    { tipo: 'pedir', texto: TEXTO_PEDIR_PRO_A_LA_AGENCIA });
  // El `?ws=` de la ficha es el parámetro de la pestaña (lib/ws-tab.ts): con él, /agency abre esa agencia y no la lista.
  assert.equal(WS_PARAM, 'ws');
  assert.match(fuente('app/agency/page.tsx'), /if \(esSuper && !\(await estaImpersonando\(\)\)\)/);
  // La lectura: sólo con `rol: 'admin'` y la `agencia` que /api/auth/me le manda a él.
  const hook = fuente('app/_components/useClienteDeAgencia.ts');
  assert.match(hook, /superAdminMira: j\.rol === 'admin' && Number\(j\.agencia\?\.ws\) > 0 && Number\(j\.clienteWs\) > 0/);
  // Sale por la puerta del super admin: la cookie sólo si no entró por la URL.
  const cta = fuente('app/_components/CtaPasarAPro.tsx');
  assert.match(cta, /else if \(!porUrl\) await fetch\('\/api\/admin\/impersonate', \{ method: 'DELETE' \}\);/);
  assert.match(cta, /void irALaFicha\(cta\.href, cta\.puerta\)/);
});

test('3. «Reportar a Soporte» no tapa el nombre del plan: el ticket dice lo que vio el cliente', () => {
  const visto = `${textoTope(1)} ${TEXTO_PEDIR_PRO_A_LA_AGENCIA}`;
  assert.equal(sinNombres(visto), visto);
  assert.equal(limpio(visto, TOPE_ERROR), visto);
  assert.equal(sinNombres('Pasa a Esencial para seguir'), 'Pasa a Esencial para seguir');
  // Lo que sí es un nombre se sigue tapando.
  assert.equal(sinNombres('No pude invitar a Roberto Pérez a Pro'), 'No pude invitar a «…» a Pro');
});
