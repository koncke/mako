// =============================================================================
// «Llevar a MaKo Partners» en el CRM: el menú del tablero y el «⋯» de la ficha (17/10/2026)
// =============================================================================
// Martín, 17/10/2026: «si un usuario se unió al programa de "MaKo Partners", que le aparezca la opción en el CRM para
// llevarlos allí». La ventana y el alta son de Clients (app/partners/LlevarAPartners.tsx); el CRM decide si la OFRECE.
// Lo que se fija:
//   1. el menú de un lead, EJECUTADO: «Llevar a…» sin cuenta, «Ver en…» con cuenta, nada si no se ofrece; nunca en un
//      lote, una columna ni el fondo;
//   2. el server decide (app/crm/partners-crm.ts) con la MISMA regla que /partners: agencia Y su admin; el tablero y
//      la ficha la leen de ahí;
//   3. las dos puertas abren la MISMA ventana, y «Ver en…» lleva a /partners?cuenta=<ws>; el tablero trae
//      `cliente_ws` de cada lead.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 3 / 0, una rotura por vez y restaurada:
//   · el menú sin mirar si ya tiene cuenta (siempre «Llevar a…»)                → 2 / 1
//   · `ofrecePartners` sin pedir que sea agencia                               → 2 / 1
//   · la ficha sin la ventana de Clients (otra implementación)                 → 2 / 1
// Correr: node --import tsx --test tests/crm-partners.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPCION_CRM, opcionesCrm, type ContextoCrm } from '../app/crm/menu-contextual-crm';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const tarjeta = (partners?: 'llevar' | 'ver' | null): ContextoCrm => ({
  sobre: 'tarjeta', conWhatsapp: true, conTelefono: true, conEmail: true, seleccionado: false, seleccionados: 0,
  hayEquipo: true, hayOtroFunnel: true, partners,
});

test('el menú de un lead: «Llevar a…» sin cuenta, «Ver en…» con cuenta, y nada si no se ofrece', () => {
  const llevar = opcionesCrm(tarjeta('llevar'));
  assert.ok(llevar.includes('partners_llevar') && !llevar.includes('partners_ver'));
  const ver = opcionesCrm(tarjeta('ver'));
  assert.ok(ver.includes('partners_ver') && !ver.includes('partners_llevar'), 'con cuenta, no se ofrece abrir otra');
  for (const no of [opcionesCrm(tarjeta(null)), opcionesCrm(tarjeta())]) {
    assert.ok(!no.some((x) => x === 'partners_llevar' || x === 'partners_ver'), 'sin agencia o sin admin, no aparece');
  }
  // Un lote (más de un tildado), una columna o el fondo no la ofrecen.
  const lote = opcionesCrm({ ...tarjeta('llevar'), seleccionado: true, seleccionados: 3 } as ContextoCrm);
  assert.ok(!lote.includes('partners_llevar'));
  // Desde el 25/10/2026 la cartera de la agencia vive en Agency Dashboard (/agency), no en MaKo Partners.
  assert.equal(OPCION_CRM.partners_llevar.texto, 'Abrirle su cuenta de MaKo');
  assert.equal(OPCION_CRM.partners_ver.texto, 'Ver en Agency Dashboard');
});

test('el server decide con la regla de /partners: agencia y su admin, para las dos puertas', () => {
  const regla = leer('app/crm/partners-crm.ts');
  assert.match(regla, /const ws = await adminDeWorkspaceActual\(\);\n\s*return ws != null && \(await esAgencia\(ws\)\);/);
  assert.match(regla, /\} catch \{\n\s*return false;/, 'sin poder leer, no se ofrece');
  const pagina = leer('app/crm/page.tsx');
  assert.match(pagina, /const pPartners = ofrecePartners\(\);/);
  assert.match(pagina, /partners=\{partners\}/);
  const acciones = leer('app/crm/actions.ts');
  assert.match(acciones, /const \[ficha, rolWs, partners\] = await Promise\.all\(\[fichaP, rolP, ofrecePartners\(\)\]\);/);
  // Lo que cuida es que el pop-up reciba `partners` junto al permiso de editar; la cola del return crece (5/11/2026: suscripcion).
  assert.match(acciones, /puedeEditarFicha: rol === 'admin', partners,/);
});

test('las dos puertas abren la MISMA ventana, «Ver en…» lleva a su cuenta, y el tablero trae la cuenta', () => {
  const tablero = leer('app/crm/CrmBoard.tsx');
  assert.match(tablero, /partners: partners \? \(l\.cuentaPartners != null \? 'ver' : 'llevar'\) : null,/);
  assert.match(tablero, /<ModalLlevarAPartners leadId=\{aPartners\.id\}/);
  assert.match(tablero, /case 'partners_ver': if \(l\?\.cuentaPartners != null\) router\.push\(`\/agency\?cuenta=\$\{l\.cuentaPartners\}`\); return;/);
  const ficha = leer('app/crm/lead-view/ficha/FichaPorBloques.tsx');
  assert.match(ficha, /import \{ ModalNuevoCliente as ModalLlevarAPartners \} from '@\/app\/agency\/NuevoCliente';/);
  assert.match(ficha, /<ModalLlevarAPartners leadId=\{lead\.id\}/);
  // El «⋯» de la ficha abre su menú desde el 24/10/2026 (./menu-contextual-ficha.ts): «Llevar» o «Ver», según la cuenta.
  assert.match(ficha, /partners: data\.partners \? \(lead\.cliente_ws != null \? 'ver' : 'llevar'\) : null,/);
  assert.match(ficha, /router\.push\(`\/agency\?cuenta=\$\{lead\.cliente_ws\}`\)/);
  assert.match(leer('app/crm/crm-map.ts'), /cuentaPartners: l\.cliente_ws == null \? null : Number\(l\.cliente_ws\),/);
  assert.match(leer('lib/leads.ts'), /'cliente_ws, ' \+/, 'el tablero no trae la cuenta: «Ver en…» no saldría nunca');
});
