// =============================================================================
// Agency Dashboard: quién se suma, quién entra, quién paga cada cliente y cuándo salta su pago (25/10/2026)
// =============================================================================
// Martín (docs/feedback-25-10-tarde.md punto 9): «crees otra tab abajo de "Partners" que sea "Agency Dashboard"... que te
// puedas sumar como "Agency", solo para los que tengan su plan de 97 activo... tu agregas a 1 cliente nuevo y puedes
// elegir si el cobro se realiza ahí mismo con tu tarjeta, o si quieres que lo pague tu cliente, y en dicho caso, al
// finalizar el onboarding de ese cliente debe saltar el cartel de pago». Era tests/partners.test.ts (17/10/2026), de
// cuando la cartera de la agencia vivía en /partners; se mudó con ella. Lo que fija:
//   1. sumarse: sólo con el plan Pro ACTIVO, y ser Agency es el plan Y la fila (no el plan solo);
//   2. la tab: el super admin ve todas las agencias; el admin que no se sumó, la landing; la Agency, su dashboard; el
//      cliente de una agencia no la ve; las puertas a una cuenta (CRM, Clients, «Salir») llevan a /agency. Que /partners
//      ya no dibuje la cartera lo cuida Planes, que reescribió esas páginas (tests de Partners);
//   3. abrir una cuenta: UNA implementación, con el orden que no deja cuentas sueltas, y quién paga;
//   4. el cartel de pago del cliente: sólo si paga él, al terminar su onboarding, y el primer mes no se cierra;
//   5. lo que cruza de inquilino, sólo de las aprobadas;
//   6. la API: ver, sumarse y abrir, sin HTTP, sólo el admin, y el link lo escribe el código;
//   7. el teléfono: /m/agency, la misma puerta y la misma alta (con quién paga) que la computadora.
//
// Probado rompiéndolo (con todo puesto: 0 fallos). Cada rotura, sola:
//   · `puedeSumarseComoAgency` acepta un negocio pausado (sin el chequeo de `estado`)          → 1 fallo (1)
//   · `esAgencia` vuelve a mirar sólo la capa (sin la fila de `agencias`)                      → 1 fallo (1)
//   · la página de /agency deja entrar al cliente de una agencia (sin `esClienteDeAgencia`)    → 3 fallos (2)
//   · la puerta vuelve a `agenciaDeCliente` (P15: con dos dueños, null)                        → 3 fallos (2) + 3 (7)
//   · el CRM vuelve a llevar a /partners?cuenta=                                              → 1 fallo (2)
//   · `buscarUsuarioPorEmail` va DESPUÉS de `crearWorkspace`                                  → 1 fallo (3)
//   · el acceso sale aunque pague la agencia (sin el `if (paga === 'cliente')`)                → 2 fallos (3)
//   · el acceso sale aunque pague el cliente SIN link del primer mes (sin `&& cobro.ok`)      → 1 fallo (3)
//   · la guarda del acceso invertida (`&& !cobro.ok`; `|| cobro.ok`)                          → 1 fallo; 2 fallos (3)
//   · el modal vuelve a decir «Le llegó su acceso» sin link (sin `&& hecho.link`, o `!hecho.link`) → 1 fallo (3)
//   · el teléfono, lo mismo (sin `&& hecho.link`, o `&& !hecho.link`)                         → 1 fallo (3)
//   · la API, lo mismo (sin `&& r.link`, o `&& !r.link`), o vuelve «reenvíaselo»              → 1 fallo (3)
//   · «Mi cliente» vuelve a prometer «Le llega su acceso ya» (computadora, teléfono o API)    → 1 fallo (3)
//   · `cartelDePago` deja cerrar el primer mes (`cerrable: true`)                             → 1 fallo (4)
//   · /api/agencia/mi-pago contesta al super admin (sin `s.rol === 'admin'`)                  → 1 fallo (4)
//   · el resumen de `abrirYContar` lleva el link                                              → 1 fallo (6)
//   · `abrir_cuenta_cliente_agency` sale por HTTP                                             → 1 fallo (6)
//   · /m/agency deja pasar a quien no es admin                                                → 1 fallo (7)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFS } from '../lib/api-mako/areas/cs.def';
import {
  cartelDePago, puedeSumarseComoAgency, quienPagaDe, quienPagaSugerido, sanearPerfilAgency, CAPA_PRO,
} from '../lib/agency-reglas';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));
/** El cuerpo de una función exportada, de su firma a la siguiente `export`. */
const cuerpo = (src: string, nombre: string) => {
  const i = src.search(new RegExp(`export (async function|const) ${nombre}\\b`));
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const j = src.indexOf('\nexport ', i + 10);
  return src.slice(i, j < 0 ? undefined : j);
};
/** El `if (...)` que encierra el envío del acceso en `abrirCuentaDePartner`: de quién depende que salga. */
const guardaDelAcceso = (abrir: string) => {
  const i = abrir.indexOf('acceso = await invitarPorEmail(');
  assert.ok(i >= 0, 'no encontré el envío del acceso');
  return abrir.slice(abrir.lastIndexOf('if (', i), i);
};

// ── 1. Sumarse ─────────────────────────────────────────────────────────────────────

test('sumarse: sólo con el plan Pro ACTIVO; la plataforma nunca', () => {
  assert.equal(CAPA_PRO, 'agencia', 'el plan Pro de US$97 es la capa agencia (lib/planes-mako.ts)');
  assert.deepEqual(puedeSumarseComoAgency({ capa: 'agencia', estado: 'activo', esPlataforma: false }), { ok: true });
  assert.deepEqual(puedeSumarseComoAgency({ capa: 'completo', estado: 'activo', esPlataforma: false }), { ok: false, motivo: 'plan' });
  assert.deepEqual(puedeSumarseComoAgency({ capa: 'agencia', estado: 'pausado', esPlataforma: false }), { ok: false, motivo: 'pausado' });
  assert.deepEqual(puedeSumarseComoAgency({ capa: 'superadmin', estado: 'activo', esPlataforma: true }), { ok: false, motivo: 'plataforma' });
  assert.deepEqual(puedeSumarseComoAgency({ capa: null, estado: null, esPlataforma: false }), { ok: false, motivo: 'plan' });
  // El plan de verdad: el que da la capa agencia vale 97.
  const planes = readFileSync(join(RAIZ, 'lib/planes-mako.ts'), 'utf8');
  assert.match(planes, /id: 'pro',\s*nombre: 'MaKo Pro',\s*capa: 'agencia',\s*precioUsd: 97,/);
});

test('ser Agency es el plan Y la fila: con el plan solo, todo el que compraba Pro quedaba agencia sin pedirlo', () => {
  const lib = leer('lib/agencia.ts');
  const es = cuerpo(lib, 'esAgencia');
  assert.match(es, /from\('workspaces'\)\.select\('capa'\)/);
  assert.match(es, /from\('agencias'\)\.select\('ws'\)/);
  assert.match(es, /=== 'agencia' && a\.data != null;/);
  assert.match(es, /catch \{\s*return false;/, 'fail-closed');
  // Las agencias de la plataforma, con la misma regla.
  assert.match(cuerpo(lib, 'agenciasHabilitadas'), /filter\(\(x\) => sumadas\.has\(Number\(x\.id\)\)\)/);
  // Sumarse repregunta el plan ANTES de escribir, y escribe la fila idempotente.
  const agency = leer('lib/agency.ts');
  const sumar = cuerpo(agency, 'sumarseComoAgency');
  assert.ok(sumar.indexOf('if (!estado.puede.ok)') < sumar.indexOf('anotarAgency('), 'el plan, antes de anotar');
  assert.match(cuerpo(lib, 'anotarAgency'), /\{ onConflict: 'ws', ignoreDuplicates: true \}/);
});

test('lo que contó al sumarse: saneado, y «¿quién paga hoy?» propone la opción del alta', () => {
  assert.deepEqual(sanearPerfilAgency({ clientes: '6-20', rubro: '  inmobiliarias   y  coaches ', pagaHoy: 'clientes', basura: 1 }),
    { clientes: '6-20', rubro: 'inmobiliarias y coaches', pagaHoy: 'clientes', desde: null });
  assert.deepEqual(sanearPerfilAgency('no es json'), { clientes: null, rubro: '', pagaHoy: null, desde: null });
  assert.equal(sanearPerfilAgency({ clientes: '1000' }).clientes, null);
  assert.equal(quienPagaSugerido({ pagaHoy: 'clientes' }), 'cliente');
  assert.equal(quienPagaSugerido({ pagaHoy: 'yo' }), 'agencia');
  assert.equal(quienPagaSugerido(null), 'agencia');
});

// ── 2. Quién entra ─────────────────────────────────────────────────────────────────

test('la tab: el super admin ve las agencias; el admin, la landing hasta sumarse; el cliente de una agencia, nada', () => {
  const page = leer('app/agency/page.tsx');
  assert.match(page, /await requireSesion\(\);/);
  assert.match(page, /if \(esSuper && !\(await estaImpersonando\(\)\)\) \{[\s\S]*?<AgencyPlataforma/);
  assert.match(page, /if \(!admin && !esSuper\) redirect\(await rutaConWs\('\/inicio'\)\);\s*[\s\S]*?await guardOnboarding\(\);/);
  // «MaKo no les va a enviar promociones»: el cliente de una agencia no ve el programa.
  // ⚠️ Con `esClienteDeAgencia` y comparando contra `false` (P15, 30/10/2026): `agenciaDeCliente` devuelve null con DOS
  //    dueños y con la base caída, y las dos cosas se leían como «no es cliente de ninguna». Lo fija
  //    tests/agency-dos-duenos.test.ts, que además lo corre contra una base de mentira.
  assert.match(page, /const deAgencia = await esClienteDeAgencia\(ws\);/);
  assert.match(page, /if \(!esSuper && deAgencia !== false\) redirect\(await rutaConWs\('\/inicio'\)\);/);
  assert.doesNotMatch(page, /agenciaDeCliente/, 'la pregunta de permiso no se hace con la que contesta QUIÉN');
  // La landing hasta sumarse (y con «Ver la landing»); el dashboard después, armado entero en el server.
  assert.match(page, /if \(!estado\.esAgency \|\| verLanding\) \{\s*return <LandingAgency/);
  assert.ok(page.indexOf('<LandingAgency estado={estado}') < page.indexOf('const cartera = await cuentasDePartner(ws);'));
  // El botón de la landing depende del plan: sólo `puede.ok` ofrece sumarse.
  const landing = leer('app/agency/LandingAgency.tsx');
  assert.match(landing, /if \(estado\.puede\.ok\) return <button type="button" className="ag-btn" onClick=\{onSumarme\}>Sumarme como Agency<\/button>;/);
  assert.match(landing, /href=\{RUTA_CAMBIAR_PLAN\}>Pásate a MaKo Pro</);
  // Y la barra: debajo de MaKo Partners.
  const nav = readFileSync(join(RAIZ, 'app/_components/nav.ts'), 'utf8');
  const i = nav.indexOf("{ key: 'partners'");
  const j = nav.indexOf("{ key: 'agency', label: 'Agency Dashboard', href: '/agency'");
  assert.ok(i > 0 && j > i && !nav.slice(i + 10, j).includes("{ key: '"), 'Agency Dashboard va justo debajo de MaKo Partners');
});

test('las puertas a la cuenta de un cliente de agencia llevan a /agency: el CRM, la ficha de Clients y el «Salir»', () => {
  assert.match(leer('app/crm/CrmBoard.tsx'), /router\.push\(`\/agency\?cuenta=\$\{l\.cuentaPartners\}`\)/);
  assert.match(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'), /router\.push\(`\/agency\?cuenta=\$\{lead\.cliente_ws\}`\)/);
  assert.match(leer('app/customer-success/FichaCliente.tsx'), /<Link className="fc-partners" href=\{`\/agency\?cuenta=\$\{c\.clienteWs\}`\}/);
  assert.match(leer('lib/agencia-cartera.ts'), /return esSuperAdmin \? '\/admin' : '\/agency';/);
});

// ── 3. Abrir una cuenta ───────────────────────────────────────────────────────────

test('abrir: el email, la agencia, el lead, el email libre ANTES de crear, nace pendiente, y quién paga', () => {
  const lib = leer('lib/partners.ts');
  const abrir = cuerpo(lib, 'abrirCuentaDePartner');
  const orden = [
    'if (!emailUtilizable(correo))',
    'if (!(await esAgencia(p.agenciaWs)))',
    'lead = await leadParaPartners(',
    'if (lead.clienteWs) return',
    'if (await buscarUsuarioPorEmail(correo))',
    // Desde el 29/10/2026 con la capa de su plan (Esencial o Pro).
    'const ws = await crearWorkspace(nombre, CAPA_DE_PLAN[plan]);',
    ".insert({ agencia_ws: p.agenciaWs, cliente_ws: ws.id, estado: 'pendiente' })",
    'update({ cliente_ws: ws.id })',
    'await crearUsuario({',
    "await guardarQuienPaga(ws.id, 'cliente')",
    'const cobro = await linkPrimerMes(',
    'acceso = await invitarPorEmail(',
  ];
  let desde = 0;
  for (const paso of orden) {
    const i = abrir.indexOf(paso, desde);
    assert.ok(i >= 0, `falta, o está fuera de orden: ${paso}`);
    desde = i;
  }
  // El acceso sale YA sólo si paga el cliente (tiene que hacer su onboarding); si paga la agencia, al habilitarse. El
  // `paga === 'cliente'` es un Y (o va solo): con un `||` saldría también si paga la agencia (25/10/2026).
  assert.match(guardaDelAcceso(abrir), /^if \(paga === 'cliente'(?: && |\) \{)/);
  // Si paga el cliente, el link del primer mes va a SU email (y la renovación se la pide a él).
  assert.match(abrir, /email: paga === 'cliente' \? correo : p\.pagador/);
  assert.doesNotMatch(cuerpo(lib, 'leadParaPartners'), /estado_lead/, 'un lead de cualquier etapa, no sólo un ganado');
  // Una sola implementación: Clients no abre cuentas; la tab, el CRM y la API van por el núcleo.
  assert.doesNotMatch(leer('app/customer-success/actions.ts'), /crearWorkspace|crearUsuario\(|linkPrimerMes/);
  const acc = leer('app/agency/actions.ts');
  assert.match(acc, /const r = await abrirCuentaDePartner\(\{/);
  assert.match(acc, /paga: quienPagaDe\(datos\?\.paga\),/);
  assert.match(leer('app/agency/NuevoCliente.tsx'), /await abrirCuentaClienteAction\(\{ leadId, nombre, email, paga, plan \}\)/);
});

test('«paga tu cliente» sin link del primer mes: su acceso NO sale, y el modal no pide reenviárselo (25/10/2026)', () => {
  // Sin link (MaKo sin Mercado Pago, sin precio en pesos, la pasarela que falló) no hay cobro: `cartelDePago` recibe
  // `pendiente: null` y no salta, y nada lo crea después. Con el acceso afuera, el cliente usaba MaKo completo gratis
  // para siempre. Sin link queda esperando la firma, y lib/agencia-habilitar.ts le manda el acceso al habilitarla.
  const abrir = cuerpo(leer('lib/partners.ts'), 'abrirCuentaDePartner');
  assert.equal(abrir.split('invitarPorEmail(').length - 1, 1, 'un solo lugar manda el acceso');
  // La condición EXACTA (25/10/2026): un `/cobro\.ok/` suelto aceptaba `&& !cobro.ok` y `|| cobro.ok`.
  assert.equal(guardaDelAcceso(abrir).trim(), "if (paga === 'cliente' && cobro.ok) {", 'el acceso del cliente, sólo con el link del primer mes');
  assert.match(cuerpo(leer('lib/agencia-habilitar.ts'), 'avisarClienteAprobado'), /if \(admin\.invitacion_enviada_at\) return/,
    'la habilitación manda el acceso a quien todavía no lo recibió');
  // El modal: «le llegó su acceso» sólo con link; sin él, «Cuenta pedida», como si pagara la agencia.
  const modal = leer('app/agency/NuevoCliente.tsx');
  const rama = modal.match(/\} else if \((hecho && hecho\.paga === 'cliente'[^)]*)\) \{/);
  assert.ok(rama, 'la rama de «paga tu cliente»');
  assert.equal(rama[1], "hecho && hecho.paga === 'cliente' && hecho.link", 'sin link no es «le llegó su acceso»: cae en «Cuenta pedida»');
  const pedida = modal.slice(modal.indexOf('} else if (hecho) {'));
  assert.match(pedida, /'Cuenta pedida'/);
  assert.match(pedida, /Le llega su acceso cuando MaKo la habilite\./);
  assert.doesNotMatch(modal, /Todavía no hay link de pago/);
});

test('«paga tu cliente» sin link: la API tampoco dice «le llegó su acceso» ni «reenvíaselo», y la opción dice los dos caminos (25/10/2026)', () => {
  // La API decía «su acceso no salió: reenvíaselo desde Agency Dashboard»: el acceso no salió, no hay cobro, y con la cuenta
  // pendiente no hay «Reenviar el acceso» (sólo con `estado === 'aprobado'`). Sin link es «Le llega su acceso cuando MaKo la
  // habilite». El teléfono ya no abre cuentas (T5, tests/tiendas-telefono-no-vende.test.ts).
  const run = leer('lib/api-mako/areas/cs.run.ts');
  const ini = run.indexOf('async function abrirYContar(');
  const contar = run.slice(ini, run.indexOf('\n}\n', ini));
  const cond = contar.match(/const resumen = ([^?]*?)\s*\?\s*\(r\.acceso\?\.enviado \?/);
  assert.ok(cond, 'el resumen de abrirYContar');
  assert.equal(cond[1], "r.paga === 'cliente' && r.link", 'la API: «le llegó su acceso» sólo con link');
  assert.match(contar, /: \(r\.link \? '[^']*' : 'Quedó su cuenta abierta, esperando que MaKo la habilite: ahí le llega su acceso\.'\);/);
  assert.doesNotMatch(contar, /reenv/i, 'con la cuenta pendiente no hay cómo reenviar el acceso');

  // Antes del alta no se sabe si habrá link: la promesa dice los dos caminos, en la computadora y la API.
  const modal = leer('app/agency/NuevoCliente.tsx');
  assert.match(modal, /<b>Mi cliente<\/b><small>Si MaKo ya puede cobrarle, le llega su acceso y paga al terminar su configuración\. Si no, su cuenta espera a que MaKo la habilite\.<\/small>/);
  const quienPaga = run.slice(run.indexOf('const textoQuienPaga'), run.indexOf(';\n', run.indexOf('const textoQuienPaga')));
  assert.match(quienPaga, /si MaKo ya puede cobrarle, le llega su acceso y, al terminar su onboarding, le aparece el pago; si no, su cuenta espera a que MaKo la habilite\./);
  for (const id of ['llevar_a_partners', 'abrir_cuenta_cliente_agency']) {
    const d = DEFS.find((x) => x.id === id)!;
    assert.match(d.descripcion, /o el cliente \(si MaKo ya puede cobrarle, le llega su acceso[^)]*; si no, su cuenta espera a que MaKo la habilite y ahí le llega su acceso\)/, id);
    assert.match((d as { escribe?: string }).escribe ?? '', /; si paga el cliente y el link salió, le manda su acceso$/, id);
  }
  const textos: Array<[string, string]> = [['computadora', modal], ['API', quienPaga],
    ...['llevar_a_partners', 'abrir_cuenta_cliente_agency'].map((id): [string, string] => [id, DEFS.find((x) => x.id === id)!.descripcion])];
  for (const [donde, src] of textos) assert.doesNotMatch(src, /acceso ya/i, `${donde}: «le llega su acceso ya» no es cierto sin link`);
});

test('quién paga: sólo «cliente» es el cliente; lo demás es la agencia (lo que pasaba antes de poder elegir)', () => {
  assert.equal(quienPagaDe('cliente'), 'cliente');
  assert.equal(quienPagaDe(' Cliente '), 'cliente');
  for (const v of ['agencia', '', null, undefined, 'otro', 1]) assert.equal(quienPagaDe(v), 'agencia', String(v));
});

test('las acciones las usa sólo el admin, y en un archivo use server sólo se exportan funciones async', () => {
  const acc = leer('app/agency/actions.ts');
  assert.match(acc, /^'use server';/);
  for (const m of acc.matchAll(/^export\s+(\S+\s+\S+)/gm)) assert.equal(m[1], 'async function', m[0]);
  // ⚠️ Cuatro desde el 27/10/2026: «Aplicar plantilla» (MAU-01) pregunta lo mismo, salvo el super admin. Seis desde el 29/10:
  // «Dar de baja» y «Cambiar el plan» de la cuenta de un cliente.
  // ⚠️ Desde el 5/11/2026 (la mensualidad, lib/agencia-mes.ts) no se cuentan: se mira CADA acción exportada. Contar dejaba
  // pasar una acción nueva sin puerta si otra sumaba una llamada de más. Las de la agencia preguntan el admin; las de la
  // mensualidad, `superAdminEnLaAgencia`, que exige el super admin Y que esté parado en una agencia. Probado rompiéndolo: sin la
  // puerta en `corregirRelojAction` → 1 fallo; la puerta sin `getSesionAdmin` → 1 fallo.
  const cuerpos = acc.split(/^export async function /m).slice(1);
  assert.ok(cuerpos.length >= 10, `se leyeron ${cuerpos.length} acciones`);
  for (const c of cuerpos) {
    const nombre = c.slice(0, c.indexOf('('));
    const cuerpo = c.slice(0, c.search(/^}\s*$/m) + 1);
    assert.match(cuerpo, /await (adminDeWorkspaceActual|superAdminEnLaAgencia)\(\)/, `${nombre}: sin puerta`);
  }
  const puerta = acc.slice(acc.indexOf('async function superAdminEnLaAgencia'), acc.indexOf('export async function marcarMesPagadoAction'));
  assert.ok(puerta.length > 0 && puerta.indexOf('await getSesionAdmin()') >= 0 && puerta.indexOf('await getSesionAdmin()') < puerta.indexOf('await adminDeWorkspaceActual()'),
    'la mensualidad la anota sólo el super admin, y parado en una agencia');
});

test('el CRM y la tab abren el MISMO modal, por portal, y un lead con cuenta no pide nada', () => {
  const modal = leer('app/agency/NuevoCliente.tsx');
  assert.match(modal, /export function ModalNuevoCliente\(/);
  assert.match(modal, /return createPortal\(\s*<Modal/);
  assert.match(modal, /if \(r\.clienteWs\) setYa\(r\.clienteWs\);/);
  assert.match(leer('app/agency/AgencyApp.tsx'), /<ModalNuevoCliente leadId=\{alta\.leadId\}/);
  for (const f of ['app/crm/CrmBoard.tsx', 'app/crm/lead-view/ficha/FichaPorBloques.tsx']) {
    assert.match(leer(f), /import \{ ModalNuevoCliente as ModalLlevarAPartners \} from '@\/app\/agency\/NuevoCliente';/, f);
  }
});

// ── 4. El cartel de pago del cliente ──────────────────────────────────────────────

test('el cartel: sólo si paga él y terminó su onboarding; el primer mes no se cierra, la renovación sí', () => {
  const pend = { pagar: 'https://pago/1', renovacion: null };
  assert.equal(cartelDePago({ quienPaga: 'agencia', onboardingTerminado: true, pendiente: pend }), null, 'paga la agencia: nada');
  assert.equal(cartelDePago({ quienPaga: 'cliente', onboardingTerminado: false, pendiente: pend }), null, 'antes de terminar el onboarding: nada');
  assert.equal(cartelDePago({ quienPaga: 'cliente', onboardingTerminado: true, pendiente: null }), null, 'nada que pagar: nada');
  assert.deepEqual(cartelDePago({ quienPaga: 'cliente', onboardingTerminado: true, pendiente: pend }),
    { tipo: 'primer-mes', link: 'https://pago/1', cerrable: false });
  const renov = { pagar: null, renovacion: { link: 'https://pago/2', desde: '2026-11-25T10:00:00.000Z', activada: false } };
  assert.deepEqual(cartelDePago({ quienPaga: 'cliente', onboardingTerminado: true, pendiente: renov }),
    { tipo: 'renovacion', link: 'https://pago/2', desde: '2026-11-25T10:00:00.000Z', cerrable: true });
  assert.equal(cartelDePago({ quienPaga: 'cliente', onboardingTerminado: true, pendiente: { pagar: null, renovacion: { ...renov.renovacion, activada: true } } }), null);
});

test('el cartel lo pide sólo el admin de SU cuenta, no el super admin; y está montado para todos con sesión', () => {
  const ruta = leer('app/api/agencia/mi-pago/route.ts');
  assert.match(ruta, /if \(!s \|\| s\.legacy \|\| s\.rol === 'admin' \|\| s\.ws == null \|\| \(s\.rolWs \?\? 'admin'\) !== 'admin'\) return Response\.json\(\{ cartel: null \}\);/);
  assert.match(ruta, /cartelDelCliente\(Number\(s\.ws\)\)/);
  const cartel = leer('app/_components/CartelPagoCliente.tsx');
  assert.match(cartel, /fetch\('\/api\/agencia\/mi-pago'\)/);
  // El primer mes no tiene «Ahora no»: su salida honesta es cerrar sesión.
  assert.match(cartel, /\{primer \? \(\s*<button[\s\S]*?Cerrar sesión[\s\S]*?\) : \(\s*<button type="button" className="cpc-salir" onClick=\{\(\) => setCerrado\(true\)\}>Ahora no<\/button>/);
  assert.match(leer('app/layout.tsx'), /\{sesion && <CartelPagoCliente \/>\}/);
  // Y no sale EN el onboarding: sale al terminarlo (lo decide el server con `onboardingTerminado`).
  assert.match(cartel, /\^\\\/\(login\|onboarding\|/);
  assert.match(cuerpo(leer('lib/agency.ts'), 'cartelDelCliente'), /onboardingTerminado\(ws\)/);
});

// ── 5. Lo que cruza de inquilino ──────────────────────────────────────────────────

test('el plan y el equipo, SÓLO de las cuentas aprobadas; y «no pude leer» no es «nadie»', () => {
  const lib = cuerpo(leer('lib/partners.ts'), 'cuentasDePartner');
  assert.match(lib, /const aprobados = new Set\(clientesAprobados\(agenciaWs, cartera\)\);/);
  assert.match(lib, /aprobados\.size \? listarUsuarios\(\)\.catch\(\(\) => null\) : Promise\.resolve\(\[\]\)/);
  assert.match(lib, /if \(ws == null \|\| !aprobados\.has\(ws\)\) continue;/);
  assert.match(lib, /return \{ ok: false, error: e instanceof Error \? e\.message : 'No pude leer tus clientes\.' \};/);
  // Quién paga cruza como UNA palabra por cuenta, en una consulta.
  assert.match(lib, /quienPagaDeClientes\(\[\.\.\.todos\]\),/);
});

// ── 6. La API de MaKo ─────────────────────────────────────────────────────────────

test('la API: ver, sumarse y abrir, sin HTTP, sólo el admin, confirmado por una persona; el link lo escribe el código', () => {
  const ids = ['ver_clientes_partners', 'llevar_a_partners', 'ver_agency', 'sumarse_como_agency', 'abrir_cuenta_cliente_agency'];
  for (const id of ids) {
    const d = DEFS.find((x) => x.id === id);
    assert.ok(d, `falta ${id} en la API de MaKo`);
    assert.ok(!d.canales.includes('http' as never), `${id}: son negocios de terceros, no salen por HTTP`);
  }
  for (const id of ['llevar_a_partners', 'sumarse_como_agency', 'abrir_cuenta_cliente_agency']) {
    const d = DEFS.find((x) => x.id === id)!;
    assert.equal(d.tipo, 'accion', id);
    assert.equal(d.confirmacion, 'chat', id);
    assert.equal(d.reversible, false, id);
    assert.equal(d.gating?.rolMinimo, 'admin', id);
  }
  for (const id of ['llevar_a_partners', 'abrir_cuenta_cliente_agency']) {
    const paga = DEFS.find((x) => x.id === id)!.parametros.find((p) => p.nombre === 'paga');
    assert.deepEqual(paga?.enum, ['agencia', 'cliente'], `${id}: quién paga`);
  }
  const run = leer('lib/api-mako/areas/cs.run.ts');
  const contar = run.slice(run.indexOf('async function abrirYContar('), run.indexOf('\n}\n', run.indexOf('async function abrirYContar(')));
  assert.match(contar, /if \(r\.link && r\.paga === 'agencia'\) ctx\.aPersona\?\.\(`Link de su primer mes: \$\{r\.link\}`\);/);
  const resumen = contar.slice(contar.indexOf('const resumen ='), contar.indexOf('return { ok: true, resumen'));
  assert.ok(resumen.length > 0, 'no encontré el resumen');
  assert.doesNotMatch(resumen, /r\.link\}/, 'el link no viaja en el resumen: lo leería el modelo');
  // La lectura no manda los emails de otro negocio al modelo: cuántas personas, no quiénes.
  const lect = run.slice(run.indexOf('ver_clientes_partners: {'), run.indexOf('llevar_a_partners: {'));
  assert.match(lect, /personas: c\.equipo \? c\.equipo\.length : null,/);
  assert.doesNotMatch(lect, /email/);
});

// ── 7. El teléfono ───────────────────────────────────────────────────────────────

test('el teléfono: /m/agency, la misma puerta y los mismos datos, sin abrir cuentas (T5, el teléfono no vende)', () => {
  const pagina = leer('app/m/agency/page.tsx');
  assert.match(pagina, /await requireMovil\(\{ navKey: 'agency' \}\);/);
  const puerta = pagina.indexOf('if (!admin && !esSuper) redirect(');
  assert.ok(puerta > 0, 'sólo el admin (o el super admin)');
  assert.ok(puerta < pagina.indexOf('cuentasDePartner(ws)'), 'la puerta, antes de leer la cartera');
  assert.match(pagina, /const deAgencia = await esClienteDeAgencia\(ws\);/, 'el cliente de una agencia no la ve');
  assert.match(pagina, /if \(!esSuper && deAgencia !== false\) redirect\(/, 'y el «no pude leer» tampoco entra (P15)');
  assert.doesNotMatch(pagina, /agenciaDeCliente/, 'la misma función que en escritorio');
  assert.match(pagina, /!cartera\.ok/, '«no pude leer» se dice: no es «todavía no tienes clientes»');
  const app = leer('app/m/agency/AgencyM.tsx');
  assert.doesNotMatch(app, /abrirCuentaClienteAction/, 'abrir una cuenta se paga: queda en la computadora');
  assert.doesNotMatch(app, /^import (?!type )[^;]*from ['"]@\/lib\/(partners|agency)['"]/m, 'lib/partners.ts y lib/agency.ts son server-only: el teléfono importa sólo sus tipos');
});

test('el teléfono: Clients, Community y Classroom llevan arriba el MISMO trío que la cabecera de escritorio', async () => {
  const { SECCIONES_CLIENTS } = await import('../lib/clients-rutas');
  const trio = leer('app/m/cs/SeccionesClientsM.tsx');
  const labels = [...trio.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, SECCIONES_CLIENTS.slice(0, 3).map((s) => s.label), 'mismos nombres y orden');
  for (const [rel, activa] of [['app/m/cs/page.tsx', 'clients'], ['app/m/comunidad/page.tsx', 'community'], ['app/m/curso/page.tsx', 'classroom']]) {
    const src = leer(rel);
    assert.match(src, new RegExp(`<SeccionesClientsM activa="${activa}"`), `${rel} sin el trío`);
  }
});
