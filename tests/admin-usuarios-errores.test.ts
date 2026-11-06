// =============================================================================
// Admin › Users y Admin › Errors (5/11/2026)
// =============================================================================
// Martín: «gestión de usuarios, estado de alta» y «cuándo la app se crashea o los bugs que tienen, el reporte». Lo que fija,
// EJECUTANDO las reglas (lib/admin-usuarios-reglas.ts, lib/admin-errores-reglas.ts) y DIBUJANDO las dos pantallas:
//   1. los cuatro estados de alta de shadcn-admin: suspendido gana, sin entrar es invitado, 30 días separan activo de inactivo;
//   2. «nunca se le mandó el acceso» se dice (no es lo mismo que «no entró»);
//   3. el orden (los que entran primero, los suspendidos al final) y la búsqueda sin tildes;
//   4. el menú: reenviar sólo a un invitado, reactivar sólo a un suspendido, entrar sólo con un negocio;
//   5. la página: la puerta del super admin antes de leer, y el perfil de la persona no viaja al navegador;
//   6. los estados de Sentry: nuevo, sin resolver, resuelto y «volvió» con la MISMA regla que abre el ticket nuevo;
//   7. lo que guardó el reportador (jsonb) se lee con cuidado, y los negocios no se repiten;
//   8. las dos pantallas dibujan lo que dicen.
//
// Probado rompiéndolo el 5/11/2026 (con todo puesto: 0 fallos; el arnés restaura de memoria). Cada rotura, sola, va arriba del
// test que la caza y da 1 fallo, salvo dos: sacar el `suspendido` primero da 3 (1, 3 y 4) y «Se le mandó» sin mirar
// `invitacionEnviada` da 2 (2 y 8).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  accionesDe, conteosDeAlta, detalleDeAlta, estadoDeAlta, rolTxt, usuariosVisibles, type FilaUsuario,
} from '../lib/admin-usuarios-reglas';
import { conteosDeErrores, erroresVisibles, estadoDeError, filaDeError, type FilaError } from '../lib/admin-errores-reglas';
import { MARGEN_REGRESION_MS } from '../lib/errores-app-reglas';
import { Users } from '../app/admin/usuarios/users';
import type { UserRow } from '../app/admin/usuarios/data';
import { ErroresAdmin } from '../app/admin/errores/ErroresAdmin';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const AHORA = Date.parse('2026-11-05T15:00:00Z');
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString();
const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
const texto = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, el))
  .replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

// Personas de mentira (AGENTS.md: nada de datos reales en tests/).
const u = (p: Partial<FilaUsuario>): FilaUsuario => ({
  id: 1, email: 'ana@ejemplo.com', nombre: 'Ana Ruiz', rol: 'usuario', rolWs: 'admin', estado: 'activo', ultimoLogin: hace(2),
  creado: hace(60), invitacionEnviada: hace(60), workspaceId: 3, negocio: 'Estudio Ejemplo', mfa: false, foto: null, ...p,
});

// Roturas que fija cada test:
//   1 · `estadoDeAlta` sin el `suspendido` primero (un suspendido que entró ayer sale «Activo»)
//   1 · `DIAS_ACTIVO = 60`
test('1 · los cuatro estados de alta: suspendido gana, sin entrar es invitado, 30 días separan activo de inactivo', () => {
  assert.equal(estadoDeAlta(u({ estado: 'suspendido', ultimoLogin: hace(1) }), AHORA), 'suspendido');
  assert.equal(estadoDeAlta(u({ ultimoLogin: null, estado: 'invitado' }), AHORA), 'invitado');
  assert.equal(estadoDeAlta(u({ ultimoLogin: hace(29) }), AHORA), 'activo');
  assert.equal(estadoDeAlta(u({ ultimoLogin: hace(31) }), AHORA), 'inactivo');
  assert.equal(rolTxt(u({ rol: 'admin', rolWs: null, workspaceId: null })), 'Super admin');
  assert.equal(rolTxt(u({ rolWs: 'closer' })), 'Closer');
});

//   2 · `detalleDeAlta` dice «Se le mandó el acceso» también sin `invitacionEnviada`
test('2 · «nunca se le mandó el acceso» no es lo mismo que «no entró»', () => {
  assert.equal(detalleDeAlta(u({ ultimoLogin: null, invitacionEnviada: null }), AHORA), 'Nunca se le mandó el acceso');
  assert.equal(detalleDeAlta(u({ ultimoLogin: null, invitacionEnviada: hace(3) }), AHORA), 'Se le mandó el acceso hace 3 días');
  assert.equal(detalleDeAlta(u({ ultimoLogin: hace(0) }), AHORA), 'Entró hoy');
});

//   3 · la búsqueda sin quitar las tildes · los suspendidos no van al final
test('3 · el orden de PostHog (última vez primero, suspendidos al final) y la búsqueda sin tildes', () => {
  const filas = [
    u({ id: 1, email: 'a@ejemplo.com', estado: 'suspendido', ultimoLogin: hace(0) }),
    u({ id: 2, email: 'b@ejemplo.com', ultimoLogin: hace(10) }),
    u({ id: 3, email: 'c@ejemplo.com', ultimoLogin: null, estado: 'invitado' }),
    u({ id: 4, email: 'd@ejemplo.com', ultimoLogin: hace(1), nombre: 'José García' }),
  ];
  assert.deepEqual(usuariosVisibles(filas, { estado: 'todos', q: '' }, AHORA).map((f) => f.id), [4, 2, 3, 1]);
  assert.deepEqual(usuariosVisibles(filas, { estado: 'todos', q: 'garcia' }, AHORA).map((f) => f.id), [4]);
  assert.deepEqual(conteosDeAlta(filas, AHORA), { todos: 4, activo: 2, inactivo: 0, invitado: 1, suspendido: 1 });
});

//   4 · `accionesDe` ofrece «Reenviar» a quien ya entró · ofrece «Entrar a su negocio» a un super admin
test('4 · el menú de la fila: reenviar sólo a un invitado, reactivar sólo a un suspendido, entrar sólo con un negocio', () => {
  assert.deepEqual(accionesDe(u({ ultimoLogin: null, estado: 'invitado' }), AHORA), ['inspeccionar', 'reenviar', 'suspender']);
  assert.deepEqual(accionesDe(u({}), AHORA), ['inspeccionar', 'suspender']);
  assert.deepEqual(accionesDe(u({ estado: 'suspendido' }), AHORA), ['inspeccionar', 'reactivar']);
  assert.deepEqual(accionesDe(u({ rol: 'admin', workspaceId: null }), AHORA), ['suspender']);
  // Las acciones van por la ruta de siempre, con los nombres que esa ruta conoce.
  const pantalla = sinComentarios(leer('app/admin/usuarios/users.tsx'));
  const ruta = sinComentarios(leer('app/api/admin/usuarios/route.ts'));
  assert.match(pantalla, /fetch\('\/api\/admin\/usuarios'/);
  for (const a of ['reinvitar', 'estado']) {
    assert.match(pantalla, new RegExp(`action: '${a}'`), `la pantalla manda «${a}»`);
    assert.match(ruta, new RegExp(`case '${a}':`), `la ruta no conoce «${a}»`);
  }
});

//   5 · la página lee las personas antes de `getSesionAdmin` · el perfil viaja al navegador (`perfil: u.perfil`)
test('5 · la puerta del super admin antes de leer, y el perfil de la persona no viaja al navegador', () => {
  const page = sinComentarios(leer('app/admin/page.tsx'));
  const puerta = page.indexOf('await getSesionAdmin()');
  assert.ok(puerta > 0);
  for (const lectura of ['listarUsuarios()', 'vistaDeErrores(']) assert.ok(page.indexOf(lectura) > puerta, `${lectura} antes de la puerta`);
  const armado = page.slice(page.indexOf('async function PestanaUsuarios'), page.indexOf('async function PestanaErrores'));
  assert.ok(armado.length > 200 && armado.length < 2000, 'el recorte es la función');
  assert.doesNotMatch(armado, /perfil/, 'el perfil (teléfono, bio) no va a la tabla');
});

const er = (p: Partial<FilaError>): FilaError => ({
  id: 1, titulo: 'TypeError en /crm', origen: 'navegador', veces: 3, primeraVez: hace(30), ultimaVez: hace(1), ruta: '/crm', mensaje: 'x is undefined',
  stack: 'at f (a.js:1:1)', navegador: 'Chrome', negocios: [3], personas: 1, ticketId: 12, ticketEstado: 'en_curso', ticketResueltoAt: null, ...p,
});

//   6 · «volvió» sin el margen (`> 0` en vez de `> MARGEN_REGRESION_MS`) · «arreglado» cuenta como resuelto · `DIAS_NUEVO = 30`
test('6 · los estados de Sentry, con «volvió» igual a la regla que abre el ticket nuevo', () => {
  assert.equal(estadoDeError(er({ primeraVez: hace(2) }), AHORA), 'nuevo');
  assert.equal(estadoDeError(er({}), AHORA), 'sin-resolver');
  assert.equal(estadoDeError(er({ ticketEstado: 'arreglado' }), AHORA), 'sin-resolver', 'arreglado sin desplegar todavía no está resuelto');
  const res = hace(5);
  assert.equal(estadoDeError(er({ ticketEstado: 'resuelto', ticketResueltoAt: res, ultimaVez: new Date(Date.parse(res) + MARGEN_REGRESION_MS - 60_000).toISOString() }), AHORA), 'resuelto', 'adentro del margen no volvió');
  assert.equal(estadoDeError(er({ ticketEstado: 'resuelto', ticketResueltoAt: res, ultimaVez: hace(1) }), AHORA), 'volvio');
  // La regla del que registra: estado 'resuelto', su resuelto_at y el margen.
  const registrador = sinComentarios(leer('lib/errores-app.ts'));
  assert.match(registrador, /tk\?\.estado === 'resuelto' && tk\.resuelto_at && ahora - Date\.parse\(tk\.resuelto_at\) > MARGEN_REGRESION_MS/);
  const filas = [er({ id: 1, primeraVez: hace(2) }), er({ id: 2, ultimaVez: hace(3) }), er({ id: 3, ticketEstado: 'resuelto', ticketResueltoAt: hace(10), ultimaVez: hace(12) }), er({ id: 4, ticketEstado: 'resuelto', ticketResueltoAt: hace(10), ultimaVez: hace(0.5) })];
  assert.deepEqual(conteosDeErrores(filas, AHORA), { abiertos: 3, nuevo: 1, volvio: 1, resuelto: 1 });
  assert.deepEqual(erroresVisibles(filas, 'abiertos', AHORA).map((f) => f.id), [4, 1, 2], 'el visto más reciente primero, sin los resueltos');
});

//   7 · `filaDeError` sin el `new Set` de los negocios
test('7 · lo que guardó el reportador se lee con cuidado, y los negocios no se repiten', () => {
  const f = filaDeError({
    id: 9, titulo: 't', origen: 'servidor', veces: 4, primera_vez: hace(3), ultima_vez: hace(1),
    ejemplo: { mensaje: 'falló', ruta: '/crm', stack: 42 }, afectados: [{ ws: 3, email: 'A@x.com' }, { ws: 3, email: 'a@x.com' }, { ws: 'mal' }], ticket_id: null,
  }, null);
  assert.deepEqual(f.negocios, [3]);
  assert.equal(f.personas, 1);
  assert.equal(f.stack, null, 'un stack que no es texto no se dibuja');
  assert.equal(filaDeError({ id: 1, titulo: 't', origen: 'mako', veces: 1, primera_vez: hace(1), ultima_vez: hace(1), ejemplo: null, afectados: 'x', ticket_id: 5 }, { estado: 'nuevo', resuelto_at: null }).ticketEstado, 'nuevo');
});

//   8 · Users dibuja el estado de la base en vez del de alta · Errors sin errores dibuja la tabla vacía
test('8 · las dos pantallas dibujan lo que dicen', () => {
  // Users es la tabla de Studio Admin (app/admin/usuarios/users.tsx): el estado de ALTA va en la insignia, y su detalle (cuándo
  // entró, si se le mandó el acceso) en el `title` de la insignia.
  const filas: UserRow[] = [u({}), u({ id: 2, email: 'b@ejemplo.com', nombre: 'Beto', ultimoLogin: null, estado: 'activo', invitacionEnviada: null })].map((f) => ({ ...f, tipo: 'Cliente' as const }));
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router as never }, createElement(Users, { users: filas, ahoraMs: AHORA, tz: 'UTC' })));
  const tu = texto(createElement(Users, { users: filas, ahoraMs: AHORA, tz: 'UTC' }));
  assert.match(tu, /0 elegidas/);
  assert.match(tu, /Beto .* Invitado/, 'el estado de ALTA, no el de la base');
  assert.match(html, /title="Nunca se le mandó el acceso"/, 'el detalle del alta, en la insignia');
  assert.match(tu, /Ana Ruiz .* Activo/);
  assert.match(html, /title="Entró hace 2 días"/);
  const te = texto(createElement(ErroresAdmin, { vista: { errores: [er({ ticketEstado: 'resuelto', ticketResueltoAt: hace(10), ultimaVez: hace(1) })], hayMas: false, reportes: [], nombres: { 3: 'Estudio Ejemplo' }, avisos: [] }, ahoraMs: AHORA }));
  assert.match(te, /Volvió TypeError en \/crm/);
  assert.match(te, /#12 · Resuelto/);
  const vacio = texto(createElement(ErroresAdmin, { vista: { errores: [], hayMas: false, reportes: [], nombres: {}, avisos: [] }, ahoraMs: AHORA }));
  assert.match(vacio, /La app no registró ningún error/);
});
