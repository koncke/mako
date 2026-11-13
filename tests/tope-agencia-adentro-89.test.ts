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
import { ctaDeTope, ROTULO_PRO_DESDE_AGENCY, TEXTO_PEDIR_PRO_A_LA_AGENCIA } from '../lib/plan-esencial-reglas';
import { limpio, sinNombres, TOPE_ERROR } from '../lib/soporte-reporte';
import { textoTope } from '../lib/topes-plan';

const fuente = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('1. la agencia adentro de su cliente: el botón a la ficha de ESA cuenta, no «Pídele a tu agencia»', () => {
  assert.deepEqual(ctaDeTope({ clienteDeAgencia: true, agenciaAdentroDe: 24 }), { tipo: 'agencia', href: '/agency?cuenta=24', rotulo: ROTULO_PRO_DESDE_AGENCY });
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

test('3. «Reportar a Soporte» no tapa el nombre del plan: el ticket dice lo que vio el cliente', () => {
  const visto = `${textoTope(1)} ${TEXTO_PEDIR_PRO_A_LA_AGENCIA}`;
  assert.equal(sinNombres(visto), visto);
  assert.equal(limpio(visto, TOPE_ERROR), visto);
  assert.equal(sinNombres('Pasa a Esencial para seguir'), 'Pasa a Esencial para seguir');
  // Lo que sí es un nombre se sigue tapando.
  assert.equal(sinNombres('No pude invitar a Roberto Pérez a Pro'), 'No pude invitar a «…» a Pro');
});
