// =============================================================================
// MaKo Partners: quién entra, qué se abre, y qué NO se promete (17/10/2026)
// =============================================================================
// Martín: «diseña la tab de "MaKo Partners" con todo lo que habíamos dicho y planeado... Y ahí deberían vivir los
// clientes de agencia, que no son los mismos que "client": podrían serlo como no... Eso se debe poder configurar en el
// CRM». El diseño, en docs/diseno-clients.md (D7-D10). Lo que fija este archivo:
//   1. la tab: sólo una agencia del programa (o el super admin); cualquier otro va a /clients;
//   2. abrir una cuenta: UNA implementación (lib/partners.ts), desde un lead de cualquier etapa o desde cero, con el
//      orden que no deja cuentas sueltas (el email ya usado se mira ANTES de crear el workspace);
//   3. el plan y el equipo, sólo de las cuentas aprobadas (lecturas que cruzan de inquilino);
//   4. la API: ver y llevar, sin HTTP, llevar sólo el admin y confirmado por una persona; el link de pago lo escribe
//      el código, nunca el modelo;
//   5. la pantalla no promete lo que no existe (los premios por referir).
//
// Probado rompiéndolo (con todo puesto: 0 fallos). Cada rotura, sola:
//   · la página deja pasar a un workspace que no es agencia (sin el redirect)        → 1 fallo (1)
//   · `buscarUsuarioPorEmail` va DESPUÉS de `crearWorkspace`                          → 1 fallo (2)
//   · `leadParaPartners` filtra por `estado_lead` (sólo ganados)                      → 1 fallo (2)
//   · el resumen de `llevar_a_partners` lleva el link                                 → 1 fallo (4)
//   · Program dice «primer mes gratis»                                                → 1 fallo (5)
//   · /m/partners deja pasar a quien no es agencia (sin `esAgencia`)                  → 1 fallo (6)
//   · /partners deja pasar a quien no es admin (sin el redirect)                      → 1 fallo (1)
//   · /m/partners deja pasar a quien no es admin                                      → 1 fallo (6)
//   · el alta del teléfono vuelve al formulario si no hay link (`link === null`)      → 1 fallo (6)
//   · PartnersM importa un VALOR de lib/partners.ts (server-only)                     → 1 fallo (6)
//   · /m/curso dice que está en «clients»                                             → 1 fallo (6, el trío)
//   · el trío dice «Comunidad» en vez de «Community»                                  → 1 fallo (6, el trío)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS } from '../lib/api-mako/areas/cs.def';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
/** El cuerpo de una función exportada, de su firma a la siguiente `export`. */
const cuerpo = (src: string, nombre: string) => {
  const i = src.indexOf(`export async function ${nombre}(`);
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const j = src.indexOf('\nexport ', i + 10);
  return src.slice(i, j < 0 ? undefined : j);
};

// ── 1. Quién entra ─────────────────────────────────────────────────────────────────

test('la tab: el super admin sin cliente ve las agencias; el ADMIN de una agencia, su cartera; cualquier otro va a /clients', () => {
  const page = leer('app/partners/page.tsx');
  assert.match(page, /await requireSesion\(\);/);
  assert.match(page, /if \(esSuper && !\(await estaImpersonando\(\)\)\) \{[\s\S]*?<PartnersPlataforma/);
  assert.match(page, /if \(ws == null \|\| !\(await esAgencia\(ws\)\)\) redirect\(await rutaConWs\('\/clients'\)\);/);
  // Los links de pago y la puerta a las cuentas: sólo el admin de la agencia (o el super admin), ANTES de leer nada.
  assert.match(page, /const admin = \(await adminDeWorkspaceActual\(\)\) != null;\s*if \(!admin && !esSuper\) redirect\(await rutaConWs\('\/clients'\)\);\s*[\s\S]*?await guardOnboarding\(\);[\s\S]*?cuentasDePartner/);
  // La pantalla la arma el server entera (la ficha es un modal sin estado de carga).
  assert.match(page, /const cartera = await cuentasDePartner\(ws\);/);
});

// ── 2. Abrir una cuenta ───────────────────────────────────────────────────────────

test('abrir: el email, la agencia, el lead (de CUALQUIER etapa), el email libre ANTES de crear, y nace pendiente', () => {
  const lib = leer('lib/partners.ts');
  const abrir = cuerpo(lib, 'abrirCuentaDePartner');
  const orden = [
    'if (!emailUtilizable(correo))',
    'if (!(await esAgencia(p.agenciaWs)))',
    'lead = await leadParaPartners(',
    'if (lead.clienteWs) return',
    'if (await buscarUsuarioPorEmail(correo))',
    'const ws = await crearWorkspace(nombre);',
    ".insert({ agencia_ws: p.agenciaWs, cliente_ws: ws.id, estado: 'pendiente' })",
    'update({ cliente_ws: ws.id })',
    'await crearUsuario({',
    'const cobro = await linkPrimerMes(',
  ];
  let desde = 0;
  for (const paso of orden) {
    const i = abrir.indexOf(paso, desde);
    assert.ok(i >= 0, `falta, o está fuera de orden: ${paso}`);
    desde = i;
  }
  // «Podrían serlo como no»: un lead de cualquier etapa, no sólo un ganado.
  assert.doesNotMatch(cuerpo(lib, 'leadParaPartners'), /estado_lead/, 'llevar a Partners no exige que sea un cliente ganado');
  // Una sola implementación: la de Clients es un envoltorio y la pantalla y el CRM van por la acción.
  const cs = leer('app/customer-success/actions.ts');
  assert.doesNotMatch(cs, /crearWorkspace|crearUsuario\(|linkPrimerMes/, 'Clients volvió a abrir cuentas por su cuenta');
  assert.match(leer('app/partners/actions.ts'), /const r = await abrirCuentaDePartner\(\{/);
  assert.match(leer('app/partners/LlevarAPartners.tsx'), /await llevarAPartnersAction\(\{ leadId, nombre, email \}\)/);
});

test('la acción la puede usar sólo el admin de la cuenta, y un lead que ya tiene cuenta no abre otra', () => {
  const acc = leer('app/partners/actions.ts');
  assert.match(acc, /const agenciaWs = await adminDeWorkspaceActual\(\);\s*if \(!agenciaWs\) return \{ ok: false/);
  assert.match(acc, /^'use server';/);
  // En un archivo 'use server' sólo se exportan funciones async (AGENTS.md).
  for (const m of acc.matchAll(/^export\s+(\S+\s+\S+)/gm)) assert.equal(m[1], 'async function', m[0]);
  assert.match(leer('lib/partners.ts'), /if \(lead\.clienteWs\) return \{ ok: false, error: 'Ya tiene cuenta en MaKo Partners\.', yaTiene: lead\.clienteWs \};/);
});

// ── 3. Lo que cruza de inquilino ──────────────────────────────────────────────────

test('el plan y el equipo, SÓLO de las cuentas aprobadas; y «no pude leer» no es «nadie»', () => {
  const lib = cuerpo(leer('lib/partners.ts'), 'cuentasDePartner');
  assert.match(lib, /const aprobados = new Set\(clientesAprobados\(agenciaWs, cartera\)\);/);
  assert.match(lib, /aprobados\.size \? listarUsuarios\(\)\.catch\(\(\) => null\) : Promise\.resolve\(\[\]\)/);
  assert.match(lib, /if \(ws == null \|\| !aprobados\.has\(ws\)\) continue;/);
  // Si la cartera no se puede leer, falla visible: una lista vacía diría «no tienes clientes».
  assert.match(lib, /return \{ ok: false, error: e instanceof Error \? e\.message : 'No pude leer tus clientes\.' \};/);
});

// ── 4. La API de MaKo ─────────────────────────────────────────────────────────────

test('la API: ver y llevar, sin HTTP; llevar sólo el admin, confirmado por una persona, y el link lo escribe el código', () => {
  const ver = DEFS.find((d) => d.id === 'ver_clientes_partners');
  const llevar = DEFS.find((d) => d.id === 'llevar_a_partners');
  assert.ok(ver && llevar, 'faltan las operaciones de Partners en la API de MaKo');
  assert.equal(ver.tipo, 'lectura');
  assert.ok(!ver.canales.includes('http' as never), 'son negocios de terceros: no salen por HTTP');
  assert.equal(llevar.tipo, 'accion');
  assert.equal(llevar.confirmacion, 'chat');
  assert.equal(llevar.reversible, false);
  assert.equal(llevar.gating?.rolMinimo, 'admin');
  assert.ok(!llevar.canales.includes('http' as never));
  const run = leer('lib/api-mako/areas/cs.run.ts');
  const bloque = run.slice(run.indexOf('llevar_a_partners: {'), run.indexOf('\n  },\n', run.indexOf('llevar_a_partners: {')));
  assert.match(bloque, /if \(r\.link\) ctx\.aPersona\?\.\(`Link de su primer mes: \$\{r\.link\}`\);/);
  assert.doesNotMatch(bloque, /resumen:[^\n]*r\.link\}/, 'el link no viaja en el resumen: lo leería el modelo');
  // La lectura no manda los emails de otro negocio al modelo: cuántas personas, no quiénes.
  const lect = run.slice(run.indexOf('ver_clientes_partners: {'), run.indexOf('llevar_a_partners: {'));
  assert.match(lect, /personas: c\.equipo \? c\.equipo\.length : null,/);
  assert.doesNotMatch(lect, /email/);
});

// ── 5. Lo que la pantalla no promete ──────────────────────────────────────────────

test('Program dice sólo lo que existe: el precio de la plataforma, el primer mes y la renovación; nada de premios', () => {
  const app = readFileSync(join(RAIZ, 'app/partners/PartnersApp.tsx'), 'utf8');
  const programa = app.slice(app.indexOf('function Programa('), app.indexOf('export function PartnersPlataforma('));
  assert.match(programa, /const usd = precio\?\.usd \?\? 47;/, 'el precio sale de la plataforma (/admin/cobros), no del texto');
  // Los premios por referir (docs/referidos.md) están decididos y NO construidos: dibujarlos sería prometerlos (D7).
  assert.doesNotMatch(programa, /refer|gratis|saldo|comisi|descuento|ganas|premio/i);
});

test('el CRM y la tab abren el MISMO modal, por portal, y un lead con cuenta no pide nada', () => {
  const modal = leer('app/partners/LlevarAPartners.tsx');
  assert.match(modal, /export function ModalLlevarAPartners\(/);
  assert.match(modal, /return createPortal\(\s*<Modal/);
  assert.match(modal, /if \(r\.clienteWs\) setYa\(r\.clienteWs\);/);
  assert.match(leer('app/partners/PartnersApp.tsx'), /<ModalLlevarAPartners leadId=\{alta\.leadId\}/);
  // Y la ficha de Clients lleva a Partners cuando el cliente también tiene cuenta.
  assert.match(leer('app/customer-success/FichaCliente.tsx'), /\{c\.clienteWs != null && \(\s*<Link className="fc-partners" href=\{`\/partners\?cuenta=\$\{c\.clienteWs\}`\}/);
});

// ── 6. El teléfono ───────────────────────────────────────────────────────────────
test('el teléfono: la MISMA puerta, los MISMOS datos y la MISMA alta que la computadora', () => {
  const pagina = leer('app/m/partners/page.tsx');
  // Desde el 24/10/2026 la fila la ve el admin de cualquier negocio: quien no es agencia ve SU tablero de referidos
  // (ReferidosM, los datos de `tableroDe` como /partners/referidos), no la cartera. Desde la noche del 24/10, recién
  // después de unirse: antes, la landing (tests/partners-para-clientes.test.ts).
  assert.match(pagina, /if \(!\(await esAgencia\(ws\)\)\) \{\s*const \[codigo, cobraEnLinea, plataforma\] = await Promise\.all\(\[\s*codigoSiExiste\(ws\)/, 'quien no es agencia: primero si se unió');
  assert.match(pagina, /const tablero = await tableroDe\(ws\)\.catch\(\(\) => null\);\s*return \(\s*<PantallaM>\s*\{tablero \? <ReferidosM/, 'y después sus referidos');
  assert.ok(pagina.indexOf('tableroDe(ws)') < pagina.indexOf('cuentasDePartner(ws)'), 'la cartera es sólo de la agencia');
  assert.match(pagina, /if \(\(await adminDeWorkspaceActual\(\)\) == null && \(await getSesionAdmin\(\)\) == null\) redirect\([\s\S]*?tableroDe/,
    'sólo el admin, antes de leer los referidos o la cartera');
  assert.match(pagina, /cuentasDePartner\(ws\)/, 'la lista sale de lib/partners.ts, como en la computadora');
  assert.match(pagina, /!cartera\.ok/, '«no pude leer» se dice: no es «todavía no tienes clientes»');
  const app = leer('app/m/partners/PartnersM.tsx');
  assert.match(app, /llevarAPartnersAction\(/, 'abrir una cuenta es UNA implementación');
  // Sin link de pago la cuenta YA se abrió (`sinLink`): el formulario no vuelve, o un segundo envío choca con el email.
  assert.doesNotMatch(app, /link === null/, 'lo que muestra la hoja del alta no se decide por el link');
  assert.doesNotMatch(app, /^import (?!type )[^;]*from ['"]@\/lib\/partners['"]/m, 'lib/partners.ts es server-only: el teléfono importa sólo su tipo');
});

test('el teléfono: Classroom, Community y Clients llevan arriba el MISMO trío que la cabecera de escritorio', async () => {
  const { SECCIONES_CLIENTS } = await import('../lib/clients-rutas');
  const trio = leer('app/m/cs/SeccionesClientsM.tsx');
  const labels = [...trio.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, SECCIONES_CLIENTS.slice(0, 3).map((s) => s.label), 'mismos nombres y orden');
  for (const [rel, activa] of [['app/m/cs/page.tsx', 'clients'], ['app/m/comunidad/page.tsx', 'community'], ['app/m/curso/page.tsx', 'classroom']]) {
    const src = leer(rel);
    assert.match(src, new RegExp(`<SeccionesClientsM activa="${activa}"`), `${rel} sin el trío`);
  }
});
