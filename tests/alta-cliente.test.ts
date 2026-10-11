// =============================================================================
// Dar de alta un cliente de MaKo (lib/alta-cliente.ts): el ORDEN ya pagado y sólo planes vendibles
// =============================================================================
// El alta se extrajo de app/api/admin/workspaces/route.ts el 11/10/2026 para que la llamen DOS
// puertas: el panel del super admin y el pago de un plan de MaKo (lib/cobros.ts, «alta automática»,
// decisión de Martín). Por un pago corre SIN nadie mirando, así que cada paso tiene que estar donde
// estaba, y cada uno ya falló alguna vez:
//   1. el email único ANTES de la primera escritura (fallar después deja un workspace huérfano);
//   2. crearWorkspace;
//   3. el seed del onboarding ADENTRO de runWithWorkspace (si no, setSetting escribe en el ws de la
//      cookie o en el ws1, Mauricio) — y no fatal;
//   4. crearUsuario con ROLLBACK (si falla, se borra el workspace);
//   5. el mail de acceso, DESPUÉS y sin poder deshacer el alta, con el nombre del negocio.
// Y sólo CAPAS_VENDIBLES: `superadmin` no es un plan, es cómo se identifica la plataforma.
//
// Lo del orden se lee del FUENTE (sin comentarios); lo de la capa se EJECUTA (el módulo es
// server-only: se neutraliza el marcador con el parche de Module._load, y `fetch` está prohibido —
// una capa no vendible se rechaza sin tocar la base). tests/invitaciones.test.ts ya fija que la
// ruta llame a darDeAltaCliente; acá se fija que no tenga OTRA alta propia al lado.
//
// ⚠️ El guard «a nadie se le manda un mail sin decirle de qué negocio» de tests/invitaciones.test.ts
// mira las invitaciones de la RUTA, que desde la extracción ya no invita: sobre el alta pasaba en
// vacío. El `workspace:` de la invitación del alta se fija acá.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez sobre la base en verde y restaurando de
// memoria (un script que guarda el texto y lo repone, nunca git). Con el código como está:
// 6 pases, 0 fallos. Rota (pases / fallos):
//   · el email único movido DESPUÉS de crearWorkspace                              → 5 / 1
//   · el seed fuera de runWithWorkspace (`(async () => { … })()`)                   → 4 / 2
//   · sin el rollback del workspace cuando falla crearUsuario                      → 4 / 2
//   · esCapaVendible con CAPAS_LISTA (la superadmin pasa)                           → 5 / 1
//   · darDeAltaCliente sin `if (!esCapaVendible(capa)) return` (la corrida llega a la red) → 4 / 2
//   · la invitación del alta sin `workspace:`                                      → 5 / 1
//   · la ruta con un `crearWorkspace(` propio además de darDeAltaCliente           → 5 / 1
// Correr: node --import tsx --test tests/alta-cliente.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { join } from 'node:path';
import { CAPAS_LISTA, CAPAS_VENDIBLES } from '../lib/capas';

const RAIZ = join(__dirname, '..');
/** Sin comentarios: las líneas PRIMERO y los bloques después (AGENTS.md). */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const SRC = fuente('lib/alta-cliente.ts');
const ALTA = (() => {
  const i = SRC.indexOf('export async function darDeAltaCliente(');
  assert.ok(i >= 0, 'no encontré darDeAltaCliente');
  return SRC.slice(i, SRC.indexOf('\n}\n', i) + 2);
})();

/** Las posiciones de cada paso, en el orden en que tienen que estar. */
const PASOS: Array<[string, string]> = [
  ['la capa vendible', 'if (!esCapaVendible(capa)) return'],
  ['el email único', '(await listarUsuarios()).some((u) => u.email === adminEmail)'],
  ['el corte si ya existe', 'yaExiste: true'],
  ['crearWorkspace', 'await crearWorkspace(nombre, capa)'],
  ['el seed en runWithWorkspace', 'await runWithWorkspace(ws.id, async () => {'],
  ['crearUsuario', 'await crearUsuario({'],
  ['el rollback', ".from('workspaces').delete().eq('id', ws.id)"],
  ['el mail', 'await invitarPorEmail({'],
];

test('el ORDEN: capa → email único → crearWorkspace → seed → crearUsuario (con rollback) → mail', () => {
  let anterior = -1;
  let nombreAnterior = '(inicio)';
  for (const [nombre, texto] of PASOS) {
    const i = ALTA.indexOf(texto);
    assert.ok(i >= 0, `falta ${nombre}: «${texto}»`);
    assert.ok(i > anterior, `${nombre} quedó ANTES de ${nombreAnterior}`);
    anterior = i;
    nombreAnterior = nombre;
  }
});

test('el seed del onboarding corre ADENTRO de runWithWorkspace(ws.id), y no es fatal', () => {
  const i = ALTA.indexOf('await runWithWorkspace(ws.id, async () => {');
  const fin = ALTA.indexOf('\n    });', i);
  const seed = ALTA.slice(i, fin);
  assert.match(seed, /setEstadoOnboarding\(/);
  assert.match(seed, /setSetting\(/);
  const resto = ALTA.slice(0, i) + ALTA.slice(fin);
  assert.doesNotMatch(resto, /setSetting\(|setEstadoOnboarding\(/, 'un setting escrito fuera del contexto cae en el ws de la cookie o en el ws1');
  // El catch del seed no corta el alta (ni return ni borrado).
  const despues = ALTA.slice(fin, ALTA.indexOf('await crearUsuario({'));
  assert.match(despues, /\} catch \(e\) \{/);
  assert.doesNotMatch(despues, /return|\.delete\(/);
});

test('si crearUsuario falla se BORRA el workspace y se devuelve el error (no queda un alta a medias)', () => {
  const tramo = ALTA.slice(ALTA.indexOf('await crearUsuario({'), ALTA.indexOf('await invitarPorEmail({'));
  assert.match(tramo, /\} catch \(e\) \{\s*await getSupabaseServer\(\)\.from\('workspaces'\)\.delete\(\)\.eq\('id', ws\.id\);\s*return \{ ok: false/);
});

test('el mail va DESPUÉS, no deshace el alta, y dice de qué negocio le hablan', () => {
  const i = ALTA.indexOf('await invitarPorEmail({');
  const mail = ALTA.slice(i);
  assert.doesNotMatch(mail, /\.delete\(|\bthrow\b/, 'un mail que no salió no puede revertir un alta buena');
  assert.match(mail.slice(0, mail.indexOf('});')), /workspace: ws\.nombre/, 'una invitación sin el nombre del negocio se lee como spam');
  assert.match(mail, /return \{ ok: true, workspace: ws, invitacion \}/);
});

test('sólo CAPAS_VENDIBLES: la superadmin no se da de alta, y se rechaza sin tocar la base', async () => {
  assert.match(SRC, /export const esCapaVendible = \(capa: string\): capa is CapaId => CAPAS_VENDIBLES\.some\(\(c\) => c\.id === capa\);/);
  assert.doesNotMatch(SRC, /\besCapaValida\b|\bCAPAS_LISTA\b/, 'esCapaValida deja pasar `superadmin`');

  // Ejecutado: el módulo es server-only (se neutraliza el marcador) y la red está prohibida.
  type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
  const M = Module as unknown as { _load: Cargador };
  const cargarOriginal = M._load;
  M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
    pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;
  const salidas: string[] = [];
  globalThis.fetch = (async (u: RequestInfo | URL) => {
    salidas.push(String(u));
    throw new Error('sin red en este test');
  }) as typeof fetch;

  const { esCapaVendible, darDeAltaCliente } = await import('../lib/alta-cliente');
  assert.equal(esCapaVendible('superadmin'), false);
  for (const c of CAPAS_LISTA) assert.equal(esCapaVendible(c.id), CAPAS_VENDIBLES.some((v) => v.id === c.id), c.id);
  const r = await darDeAltaCliente({ nombre: 'Cliente Nuevo', capa: 'superadmin', adminEmail: 'dueno@cliente.test', invitadoPor: 'pago:stripe' });
  assert.deepEqual(r, { ok: false, error: 'Elige un tipo de cliente válido.', status: 400 });
  assert.deepEqual(salidas, [], 'se tocó la base antes de rechazar la capa');
});

test('la ruta del panel da de alta SÓLO por darDeAltaCliente (sin otra alta propia al lado)', () => {
  const ruta = fuente('app/api/admin/workspaces/route.ts');
  const crear = ruta.slice(ruta.indexOf("case 'crear':"), ruta.indexOf("case 'nombre':"));
  assert.match(crear, /const r = await darDeAltaCliente\(\{/);
  assert.doesNotMatch(ruta, /\bcrearWorkspace\(|\bcrearUsuario\(|\binvitarPorEmail\(/,
    'un alta escrita en la ruta se saltea el orden (email único, rollback, mail) de lib/alta-cliente.ts');
});
