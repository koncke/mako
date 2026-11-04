// =============================================================================
// La puerta de la computadora para el grupo de WhatsApp del DUEÑO (25/10/2026)
// =============================================================================
// docs/conexiones-y-ayuda.md, decisión 2 (Martín: «todo eso se hace con la app de escritorio de MaKo»): el grupo de MaKo del
// dueño contesta con su computadora, como el chat de la app, sólo si el que escribe es quien conectó esa PC. El doer corre sin
// cookie, así que la prueba la hace la PUERTA (`encolarTurno`) con el teléfono. Lo que fija este test:
//   1. qué es un teléfono de verdad: nunca un @lid, un jid ni un «whatsapp:…»;
//   2. la persona: UNA sola persona ACTIVA del negocio con ese teléfono, y es la que conectó la PC (dos con el mismo número,
//      una suspendida o una invitada, u otra persona del equipo: no);
//   3. la puerta: con `delGrupo` mira el teléfono adentro (no le cree a quien llama) y falla cerrada; sin `delGrupo`, la cookie
//      de siempre (D6a no se afloja para nadie más).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { elTelefonoEsDeLaPersona, telefonoDeVerdad, type UsuarioDelNegocio } from '../lib/ia-pc-grupo-reglas';

const RAIZ = path.join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(path.join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('1. un teléfono de verdad, nunca un @lid, un jid ni un «whatsapp:…»', () => {
  assert.equal(telefonoDeVerdad('5491123456789'), '5491123456789');
  assert.equal(telefonoDeVerdad('+54 9 11 2345-6789'), '5491123456789');
  assert.equal(telefonoDeVerdad('(011) 2345 6789'), '01123456789');
  for (const malo of ['123456789012345@lid', '5491123456789@s.whatsapp.net', 'whatsapp:5491123456789', '1234567', '1234567890123456', '', null, undefined, 'abc']) {
    assert.equal(telefonoDeVerdad(malo), null, String(malo));
  }
});

test('2. UNA sola persona activa del negocio con ese teléfono, y es la que conectó la PC', () => {
  const ana: UsuarioDelNegocio = { id: 7, email: 'ana@negocio.com', nombre: 'Ana', estado: 'activo', telefono: '+54 9 11 2345-6789' };
  const beto: UsuarioDelNegocio = { id: 8, email: 'beto@negocio.com', nombre: 'Beto', estado: 'activo', telefono: '+52 1 55 1111 2222' };
  // El mismo número con otra forma (sin el 9 de Argentina, como lo manda WhatsApp a veces): es Ana.
  assert.equal(elTelefonoEsDeLaPersona('541123456789', [ana, beto], 'ana@negocio.com'), true);
  assert.equal(elTelefonoEsDeLaPersona('5491123456789', [ana, beto], 'ANA@negocio.com'), true, 'el email, sin mirar mayúsculas');
  // Rota: aceptar a otra persona del equipo con la PC de Ana → este test falla.
  assert.equal(elTelefonoEsDeLaPersona('5215511112222', [ana, beto], 'ana@negocio.com'), false, 'Beto escribe y la PC es de Ana');
  assert.equal(elTelefonoEsDeLaPersona('5491199998888', [ana, beto], 'ana@negocio.com'), false, 'un teléfono que no es de nadie del equipo (un lead)');
  assert.equal(elTelefonoEsDeLaPersona('5491123456789', [ana, { ...beto, telefono: ana.telefono }], 'ana@negocio.com'), false, 'dos con el mismo número: no es de nadie');
  assert.equal(elTelefonoEsDeLaPersona('5491123456789', [{ ...ana, estado: 'suspendido' }], 'ana@negocio.com'), false, 'suspendida');
  assert.equal(elTelefonoEsDeLaPersona('5491123456789', [{ ...ana, estado: 'invitado' }], 'ana@negocio.com'), false, 'invitada (nunca entró)');
  assert.equal(elTelefonoEsDeLaPersona('123456789012345@lid', [ana], 'ana@negocio.com'), false, 'un @lid');
  assert.equal(elTelefonoEsDeLaPersona('5491123456789', [ana], ''), false, 'sin la persona de la PC');
  assert.equal(elTelefonoEsDeLaPersona('5491123456789', [], 'ana@negocio.com'), false);
});

test('3. la puerta: con delGrupo mira el teléfono ADENTRO y falla cerrada; sin delGrupo, la cookie de siempre', () => {
  const src = sinComentarios(leer('lib/ia-pc.ts'));
  const puerta = src.slice(src.indexOf('export async function encolarTurno('), src.indexOf('export async function tomarTurno('));
  assert.match(puerta, /o: \{ pruebaSinSesion\?: boolean; delGrupo\?: \{ telefono: string \} \| \{ email: string \} \} = \{\}/);
  assert.match(puerta, /else if \(o\.delGrupo\) \{\s*if \(!\(await esLaPersonaDelGrupo\(d, o\.delGrupo\.telefono\)\)\) \{\s*throw new SinLaPersona\(/);
  // Rota: sin delGrupo, dejar de mirar la cookie → D6a se cae para todos.
  assert.match(puerta, /\} else \{[\s\S]*?const sesion = await getUsuarioActual\(\)\.catch\(\(\) => null\);\s*if \(!laPersonaEstaAdentro\(sesion, \{ ws: d\.ws, actor: d\.persona \}, o\.pruebaSinSesion === true\)\) \{\s*throw new SinLaPersona\(/);
  // Y antes de contar o insertar: la prueba va primero.
  assert.ok(puerta.indexOf('SinLaPersona') < puerta.indexOf("from('ia_pc_turnos')"), 'encola antes de probar quién es');
  const quien = src.slice(src.indexOf('async function esLaPersonaDelGrupo('), src.indexOf('export async function encolarTurno('));
  assert.match(quien, /if \(!telefonoDeVerdad\(telefono\)\) return false;\s*const usuarios = await usuariosConTelefono\(d\.ws\);/, 'las personas de OTRO negocio');
  assert.match(quien, /return !!usuarios && elTelefonoEsDeLaPersona\(telefono, usuarios, d\.persona\);/, 'con la base caída, encola');
  assert.match(quien, /\.from\('usuarios'\)\.select\('id, email, nombre, estado, perfil'\)\.eq\('workspace_id', ws\)/);
  assert.match(quien, /if \(error \|\| !data\) return null;/);
});

test('4. «Tus cuentas de IA» sabe si la puerta reconocería a la persona: la MISMA regla, con su teléfono del perfil', () => {
  const src = sinComentarios(leer('lib/ia-pc.ts'));
  const listo = src.slice(src.indexOf('export async function telefonoListoParaElGrupo('));
  assert.match(listo, /return !!yo && elTelefonoEsDeLaPersona\(yo\.telefono, usuarios, persona\);/, 'otra regla que la de la puerta');
  const ruta = sinComentarios(leer('app/api/ia-pc/estado/route.ts'));
  assert.match(ruta, /const grupo = pcs\.some\(\(d\) => d\.esMia\) \? await telefonoListoParaElGrupo\(persona\.ws, persona\.actor\)\.catch\(\(\) => null\) : null;/);
  assert.match(ruta, /\.\.\.\(grupo === false \? \{ grupoSinTelefono: true \} : \{\}\)/, 'dice «sin teléfono» cuando no se pudo leer');
});
