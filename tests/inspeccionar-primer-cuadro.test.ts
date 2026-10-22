// =============================================================================
// #881: al entrar a inspeccionar, el PRIMER cuadro ya es del cliente inspeccionado
// =============================================================================
// Martín, revisión del 16/10/2026 (47:15): «al inspeccionar, muchas veces al entrar se bugea y sale primero el usuario
// de perfil de Mauricio y luego sale el usuario que se está inspeccionando, eso hay que arreglarlo».
//
// La causa no estaba en el perfil: el Sidebar nacía con `useState('Mauricio Ejemplo')` y `impersonando = false`, y la
// barra de inspección nacía vacía. Los dos se corregían cuando contestaba `/api/auth/me`. Se entra a inspeccionar con
// una carga del server (`<a href="/general?ws=N">`), así que el primer cuadro salía mal en CADA entrada. Ahora el layout
// le pasa a los dos lo que sabe el server (lib/vista-de-otro.ts), y `/api/auth/me` lee lo MISMO.
//
// ROTURAS (17/10/2026, arnés `romper-881.js` del scratchpad, junto con barra-inspeccion-alto y lead-cabecera; base 20 / 0,
// restaurado de memoria): el Sidebar con `useState('Mauricio Ejemplo')` → 18 / 2 · el Sidebar con `impersonando` en false
// → 19 / 1 · la barra naciendo vacía → 19 / 1 · el layout sin el atributo en <html> → 19 / 1 · /api/auth/me volviendo
// a leer el workspace por su cuenta → 19 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('el Sidebar nace con lo que dijo el server, no con el nombre de Mauricio', () => {
  const sb = sinComentarios(leer('app/_components/Sidebar.tsx'));
  assert.match(sb, /export function Sidebar\(\{ inicial \}: \{ inicial\?: SidebarInicial \}\)/);
  assert.match(sb, /useState\(inicial\?\.nombre \?\? ''\)/, 'el nombre de abajo no nace del server');
  assert.match(sb, /useState\(inicial\?\.clienteNombre != null\)/, 'no nace sabiendo que se inspecciona');
  assert.match(sb, /useState\(inicial\?\.clienteNombre \?\? ''\)/, 'no nace con el nombre del cliente');
  assert.match(sb, /useState<string>\(inicial\?\.rol \?\? ''\)/);
  // Las iniciales tampoco caen a las de Mauricio.
  assert.doesNotMatch(sb, /\|\| 'MB'/);
});

test('ningún componente de la app nace con el nombre de un cliente escrito a mano', () => {
  const archivos = execFileSync('git', ['ls-files', 'app'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.tsx$/.test(f) && !f.startsWith('app/admin/dev/'));
  assert.ok(archivos.length > 300, `git ls-files devolvió ${archivos.length}`);
  const malos = archivos.filter((f) => /useState(?:<[^>]*>)?\(\s*['"`]Mauricio/.test(sinComentarios(leer(f))));
  assert.deepEqual(malos, [], 'un estado que nace con «Mauricio…» se ve en el primer cuadro de TODOS los clientes');
});

test('la barra de inspección nace con el cliente que dijo el server', () => {
  const b = sinComentarios(leer('app/_components/ImpersonationBanner.tsx'));
  assert.match(b, /export function ImpersonationBanner\(\{ inicial = null \}: \{ inicial\?: VistaDeOtro \| null \}\)/);
  assert.match(b, /useState<string \| null>\(inicial\?\.clienteNombre \?\? null\)/, 'la barra nace vacía y aparece tarde');
  assert.match(b, /useState\(inicial\?\.salida \?\? '\/customer-success'\)/, '«Salir» del primer cuadro iría a otro lado');
  assert.match(b, /useState\(inicial\?\.modoAgencia \?\? false\)/);
  assert.match(b, /useState<\{ ws: number; nombre: string \} \| null>\(inicial\?\.agencia \?\? null\)/);
  assert.match(b, /^import type \{ VistaDeOtro \} from '@\/lib\/vista-de-otro';$/m, 'un valor de un módulo server-only en un use client rompe el build');
});

test('el layout se lo pasa a los dos, y abre el hueco de la barra desde el HTML del server', () => {
  const l = sinComentarios(leer('app/layout.tsx'));
  assert.match(l, /const vista = sesion \? await vistaDeOtro\(\) : null;/);
  assert.match(l, /<html lang="es" className="h-full antialiased" \{\.\.\.\(vista \? \{ 'data-barra-agencia': '1' \} : \{\}\)\}>/, 'sin el atributo, la pantalla salta 50 px cuando hidrata');
  assert.match(l, /<Sidebar inicial=\{\{ nombre: sesion\?\.nombre \?\? '', rol: sesion\?\.rol \?\? '', clienteNombre: vista\?\.clienteNombre \?\? null \}\} \/>/);
  assert.match(l, /<ImpersonationBanner inicial=\{vista\} \/>/);
});

test('/api/auth/me y el layout leen al cliente de UN solo lugar', () => {
  const me = sinComentarios(leer('app/api/auth/me/route.ts'));
  assert.match(me, /const vista = await vistaDeOtro\(\);/);
  assert.doesNotMatch(me, /getWorkspace\(|agenciaDeCliente\(/, 'una segunda cuenta de «a quién se mira» puede nombrar a otro cliente');
  for (const campo of ['clienteNombre: vista?.clienteNombre ?? null', 'clienteWs: vista?.clienteWs ?? null', 'salida: vista?.salida ?? rutaDeSalida(esSuperAdmin)', 'const agencia = vista?.agencia ?? null;']) {
    assert.ok(me.includes(campo), `falta «${campo}»`);
  }
  const lib = sinComentarios(leer('lib/vista-de-otro.ts'));
  assert.match(lib, /^import 'server-only';$/m);
  assert.match(lib, /if \(!sesion \|\| !\(await estaImpersonando\(\)\)\) return null;/);
  assert.match(lib, /const agencia = esSuperAdmin \? await agenciaDeCliente\(clienteWs\) : null;/);
  assert.match(lib, /salida: agencia \? `\/partners?\?\$\{WS_PARAM\}=\$\{agencia\.ws\}` : rutaDeSalida\(esSuperAdmin\)/);
});
