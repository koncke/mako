// =============================================================================
// La tab Pagos de la ficha: UNA regla para las dos puertas, y con la pasarela
// =============================================================================
// Hasta el 11/10/2026 la ruta /crm/[id] dibujaba Pagos con «es venta o tiene plan» y el modal del
// tablero (app/crm/LeadSheet.tsx) con «tiene cuotas»: un Ganado sin cuotas tenía Pagos por el link del
// WhatsApp y no la tenía desde el tablero. Y con la pasarela de pagos, el botón «Cobrar con link» vive
// adentro de Pagos: sin cambiar la regla, justo el lead al que hay que cobrarle (el que todavía no
// compró) no tenía dónde apretarlo. Ahora la regla es una función pura (lib/muestra-pagos.ts) que leen
// las dos puertas, con las señales de la pasarela leídas por la MISMA action (`senalesDeCobroAction`).
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez y restaurando de memoria. Con el código como
// está: 5 pases, 0 fallos. Rota (pases / fallos):
//   · `muestraPagos` sin `|| s.pasarelaConectada`                                     → 4 / 1
//   · LeadSheet vuelto a `...(pagos.length ? [{ key: 'cobranza'`                       → 4 / 1
//   · getLeadFullAction sin `senalesDeCobroAction(id)` (cobro armado a mano)            → 4 / 1
//   · DealDetailsCard dibujando el deal entero siempre (`const conDeal = true`)        → 4 / 1
// Correr: node --import tsx --test tests/muestra-pagos.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { muestraPagos, planEnLead, tieneDeal, type SenalesPagos } from '../lib/muestra-pagos';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const codigo = (r: string) => leer(r).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const NADA: SenalesPagos = { estado: 'abierto', etapa: 'lead', cuotas: 0, planEnLead: false, hayCobros: false, pasarelaConectada: false };

test('cuándo se dibuja la tab: cualquiera de las seis señales alcanza; ninguna, no', () => {
  assert.equal(muestraPagos(NADA), false, 'un lead abierto, sin plata y sin pasarela: no hay nada que mostrar');
  assert.equal(muestraPagos({ ...NADA, estado: 'ganado' }), true, 'es venta');
  assert.equal(muestraPagos({ ...NADA, etapa: 'facturando' }), true, 'está facturando');
  assert.equal(muestraPagos({ ...NADA, cuotas: 1 }), true, 'tiene cuotas');
  assert.equal(muestraPagos({ ...NADA, planEnLead: true }), true, 'tiene plan en el lead');
  assert.equal(muestraPagos({ ...NADA, hayCobros: true }), true, 'tiene links de pago');
  assert.equal(muestraPagos({ ...NADA, pasarelaConectada: true }), true, 'se le puede cobrar con un link');
});

test('el DEAL es otra pregunta: la pasarela sola abre la tab, no el deal vacío', () => {
  assert.equal(tieneDeal({ ...NADA, ...{ hayCobros: true, pasarelaConectada: true } }), false);
  assert.equal(tieneDeal({ ...NADA, estado: 'ganado' }), true);
  assert.equal(tieneDeal({ ...NADA, cuotas: 2 }), true);
  assert.equal(planEnLead({ cobro_inicial_usd: 500, total_cuotas: null }), true);
  assert.equal(planEnLead({ cobro_inicial_usd: null, total_cuotas: 3 }), true);
  assert.equal(planEnLead({ cobro_inicial_usd: 0, total_cuotas: 0 }), false);
  assert.equal(planEnLead({}), false);
});

test('las DOS puertas de la ficha usan la misma regla, con las mismas señales', () => {
  // ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026 (la ficha por bloques): las dos puertas montan la MISMA ficha
  // (`FichaPorBloques`) con la MISMA lectura (`getLeadFullAction`, también la ruta). La regla se aplica
  // una vez, ahí, y las señales de la pasarela llegan por la action a las dos.
  const ruta = codigo('app/crm/[id]/page.tsx');
  const ficha = codigo('app/crm/lead-view/ficha/FichaPorBloques.tsx');
  for (const puerta of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(codigo(puerta), /<FichaPorBloques\b/, `${puerta}: no monta la ficha compartida`);
  }
  assert.match(ficha, /const verPagos = muestraPagos\(/, 'la tab no sale de muestraPagos');
  assert.match(ficha, /\.\.\.\(verPagos \? \['pagos' as const\] : \[\]\)/, 'la tab Pagos no mira verPagos');
  // Desde el 22/10/2026, mig 0324: con el trato del CRM que se mira (./pagos/trato.ts): en la casa es el lead de siempre.
  assert.match(ficha, /planEnLead: planEnLead\(delTrato\.lead\)/, 'el plan no sale de planEnLead');
  // Desde el 16/10/2026 la lectura arranca temprano (getLeadFullAction, «tarda un montón en cargar») y entra al mismo Promise.all.
  assert.match(codigo('app/crm/actions.ts'), /const cobroP = temprano\(senalesDeCobroAction\(id\)\);[\s\S]*funnelsP, cobroP\]\);/);
  assert.match(ficha, /const delTrato = ctxDelTrato\(\{ data, lead, etapa, crm \} as CtxFicha\);/);
  assert.match(ficha, /muestraPagos\(\{ estado: delTrato\.lead\.estado_lead, etapa: delTrato\.etapa, cuotas: delTrato\.data\.pagos\.length, planEnLead: planEnLead\(delTrato\.lead\), \.\.\.data\.cobro \}\)/);
  assert.match(ruta, /await getLeadFullAction\(idNum\)/, 'la ruta lee las señales con la action del pop-up');
});

// ⚠️ CAMBIADO A PROPÓSITO el 17/10/2026: la tarjeta vieja (DealDetailsCard) se borró. En los bloques, «sin deal sólo los
// links» es que el bloque `links-de-pago` no tiene `estaVacio` (se dibuja siempre) y los del deal sí. Verificado
// rompiéndolo: con `estaVacio` puesto en `links-de-pago` → cae éste.
test('los bloques: sin deal se dibujan SÓLO los links; los del deal se callan', () => {
  const reglas = codigo('app/crm/lead-view/ficha/reglas-pagos.ts');
  assert.match(reglas, /'links-de-pago': \{ disenos: \['lista', 'pendiente'\] \},/, 'los links dejaron de dibujarse siempre');
  // Lo que cuida: la venta se calla sin deal (5/11/2026: también al lado del bloque de suscripción).
  assert.match(reglas, /venta: \{ estaVacio: [^\n]*sinDealSalvo\('monto'\)/);
  const bloques = codigo('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx');
  assert.match(bloques, /<CobrarConLink lead=\{/);
  assert.match(bloques, /<CobrosDelLead cobros=\{lista\}/);
});

test('el módulo es puro: lo importan la ruta (server) y el modal (cliente)', () => {
  assert.doesNotMatch(codigo('lib/muestra-pagos.ts'), /server-only|'use client'|'use server'|from '/);
});
