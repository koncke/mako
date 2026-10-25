// =============================================================================
// Las computadoras con MaKo Desktop por la API de MaKo: leer y desconectar; conectar NO (25/10/2026)
// =============================================================================
// Martín: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API» (leer Y cambiar). El resumen
// (cuántas, en línea, qué contesta cada cosa) es `ver_ia_del_negocio`; esto es la lista y la acción. Lo que fija este test:
//   1. `ver_computadoras` (lectura) y `desconectar_computadora` (acción, con un «sí», no se deshace por la API), sin HTTP: son las
//      máquinas y los correos del equipo; y que CONECTAR no está, a propósito (pide a la persona frente a su computadora);
//   2. lo mismo que /perfil/ia: el admin ve y desconecta todas; un miembro sólo las suyas; y al confirmar se vuelve a mirar
//      con la base antes de desconectar (entre la propuesta y el «sí» la pudieron reconectar);
//   3. ni la ubicación ni el email de su cuenta de Claude salen por acá.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFS } from '../lib/api-mako/areas/integraciones.def';

const RAIZ = path.join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(path.join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const def = (id: string) => DEFS.find((d) => d.id === id);

test('1. leer y desconectar, sin HTTP; conectar no está', () => {
  const ver = def('ver_computadoras');
  assert.ok(ver && ver.tipo === 'lectura', 'falta ver_computadoras');
  assert.deepEqual([...ver.canales], ['whatsapp', 'app'], 'las computadoras del equipo salen por HTTP');
  const des = def('desconectar_computadora');
  assert.ok(des && des.tipo === 'accion', 'falta desconectar_computadora');
  assert.equal(des.confirmacion, 'chat', 'desconectar sin un «sí»');
  assert.equal(des.reversible, false, 'volver a conectarla pide la computadora: no se deshace por la API');
  assert.deepEqual([...des.canales], ['whatsapp', 'app']);
  assert.deepEqual(des.parametros.map((p) => [p.nombre, p.tipo, p.obligatorio, p.entero]), [['id', 'number', true, true]]);
  // Conectar pide a la persona frente a su computadora, el texto que acepta y su «sí» en la ventana del programa.
  assert.equal(DEFS.some((d) => /conectar_computadora|emparejar|codigo_de_computadora/.test(d.id) && d.id !== 'desconectar_computadora'), false, 'conectar una computadora por la API');
});

test('2. como /perfil/ia: el admin todas, un miembro las suyas, y al confirmar se vuelve a mirar', () => {
  const r = sinComentarios(leer('lib/api-mako/areas/integraciones.run.ts'));
  assert.match(r, /const puedeVerLaPc = \(persona: string, yo: string \| null, ctx: Ctx\): boolean => ctx\.rol === 'admin' \|\| \(yo != null && persona === yo\);/);
  assert.match(r, /const personaDelCtx = \(ctx: Ctx\): string \| null => actorDeSesion\(quienChatea\(ctx\)\);/, 'la persona no sale como la guarda la computadora');
  const ver = r.slice(r.indexOf('ver_computadoras: {'), r.indexOf('desconectar_computadora: {'));
  assert.match(ver, /const visibles = pcs\.filter\(\(p\) => puedeVerLaPc\(p\.persona, yo, ctx\)\);/);
  const des = r.slice(r.indexOf('desconectar_computadora: {'), r.indexOf('como_conectar: {'));
  assert.match(des, /const suyas = pcs\.filter\(\(p\) => puedeVerLaPc\(p\.persona, yo, ctx\)\);\s*const pc = suyas\.find\(\(p\) => p\.id === id\);/);
  // Rota: desconectar sin volver a preguntar → una computadora reconectada entre la propuesta y el «sí» se cae.
  const ej = des.slice(des.indexOf('ejecutar:'));
  assert.ok(ej.indexOf('puedeDesconectar(') > 0 && ej.indexOf('puedeDesconectar(') < ej.indexOf('await desconectar('), 'desconecta sin volver a mirar');
});

test('3. ni la ubicación ni el email de su cuenta de Claude', () => {
  const r = sinComentarios(leer('lib/api-mako/areas/integraciones.run.ts'));
  const ver = r.slice(r.indexOf('ver_computadoras: {'), r.indexOf('desconectar_computadora: {'));
  assert.doesNotMatch(ver, /ubicacion|\.cuentas\b|email/, 'sale la ubicación o el email de su Claude');
});
