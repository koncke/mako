// =============================================================================
// /mako/revisar: lo que dice SOBRE QUÉ se hace no se edita al revisar (`fijoAlRevisar`, 15/10/2026)
// =============================================================================
// La pantalla de revisión es editable a propósito, pero el TÍTULO que la persona confirma es el resumen que MaKo armó al
// proponer. En un reembolso, cambiar el `cobroId` devolvía OTRO pago (a otro cliente) bajo el título del primero: el
// servidor re-preparaba con el valor nuevo y nadie veía el cambio. Lo que se fija:
//   1. el servidor lo hace cumplir (`aplicarPropuestaGenerica`): un valor distinto se rechaza y uno vacío vuelve al
//      guardado — la pantalla sola no alcanza, el formulario llega del navegador;
//   2. la pantalla lo pinta de sólo lectura, y la marca viaja al cliente (`plano`);
//   3. las acciones de cobros que mueven plata o cortan una suscripción lo tienen en su `cobroId`.
// Las de Ads y Email que mueven plata tienen el mismo agujero y no son de este chat: la lista, en
// docs/hallazgos-api-mako.md («Lo que se edita al revisar…»).
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 4 pases, 0 fallos. Rota (pases / fallos):
//   · aplicarPropuestaGenerica sin rechazar un valor distinto                          → 3 / 1
//   · plano() sin pasar la marca (la pantalla deja editarlo)                           → 3 / 1
//   · el `cobroId` de cobros sin `fijoAlRevisar` (cae también la de la pantalla)        → 2 / 2
//   · RevisarAccion sin deshabilitar el campo fijo                                      → 3 / 1
// Correr: node --import tsx --test tests/revisar-fijo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';

// lib/bandeja-filas.ts es `server-only`: se neutraliza el marcador (el parche de tests/stripe-api.test.ts).
type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el servidor: un valor distinto del guardado se rechaza, y uno vacío vuelve al guardado, ANTES de preparar', () => {
  const a = fuente('lib/api-mako/acciones.ts');
  const ini = a.indexOf('export async function aplicarPropuestaGenerica(');
  const f = a.slice(ini, a.indexOf('\n}\n', ini));
  const guarda = f.indexOf('if (!p.fijoAlRevisar || !editado || !(p.nombre in editado)) continue;');
  assert.ok(guarda > 0, 'sin la guarda, el formulario cambia sobre qué se ejecuta');
  assert.ok(guarda < f.indexOf('validarInput(def.parametros'), 'la guarda va antes de validar y preparar');
  assert.match(f, /if \(nuevo == null \|\| nuevo === ''\) \{ editado = \{ \.\.\.editado, \[p\.nombre\]: base\[p\.nombre\] \}; continue; \}/, 'un campo vaciado no lo deja sin valor');
  assert.match(f, /if \(String\(nuevo\) !== String\(base\[p\.nombre\]\)\) \{\s*return \{ ok: false,/);
  assert.match(f, /const v = validarInput\(def\.parametros, editado \? \{ \.\.\.base, \.\.\.editado \} : base, 'json'\);/);
});

test('la marca viaja a la pantalla y la pantalla no deja editar el campo', async () => {
  const { plano } = await import('../lib/bandeja-filas');
  const r = porId('reembolsar_cobro');
  assert.ok(r && esAccion(r));
  const cobro = r.parametros.find((p) => p.nombre === 'cobroId');
  assert.ok(cobro);
  assert.equal(plano(cobro).fijoAlRevisar, true, 'sin la marca en el cliente, el campo se ve editable');
  assert.match(fuente('app/mako/revisar/[id]/RevisarAccion.tsx'), /disabled=\{enCurso \|\| !puedeDecidir \|\| !!p\.fijoAlRevisar\}/);
});

test('las acciones de cobros que se confirman en pantalla tienen el cobroId fijo', () => {
  for (const id of ['reembolsar_cobro', 'cancelar_suscripcion']) {
    const d = porId(id);
    assert.ok(d && esAccion(d), `${id} no existe`);
    assert.equal(d.confirmacion, 'pantalla', `${id} ya no se confirma en pantalla: revisar este test`);
    assert.equal(d.parametros.find((p) => p.nombre === 'cobroId')?.fijoAlRevisar, true, `${id}: el cobroId se puede cambiar al revisar`);
  }
});

test('el motivo de un reembolso SÍ se puede corregir al revisar (no todo es fijo)', () => {
  const r = porId('reembolsar_cobro');
  assert.ok(r && esAccion(r));
  assert.equal(r.parametros.find((p) => p.nombre === 'motivo')?.fijoAlRevisar, undefined);
});
