// =============================================================================
// comunidad-moderacion — quién modera, que cada escritura lo pregunte antes, y que un alumno SACADO
// no entre a ninguna acción de su ruta (ni a leer) sin perder su curso
// =============================================================================
// Las reglas (lib/comunidad-reglas.ts) se EJECUTAN acá. Que la capa de datos las pregunte antes de
// escribir, y que la ruta del alumno no tenga una puerta al costado del portón, se lee del fuente SIN
// comentarios y por FUNCIÓN (un archivo entero encuentra cualquier palabra en algún lado).
//
// Verificado ROMPIÉNDOLO: ver el bloque «ROTURAS» al final (números medidos). Y el 08/10/2026 (los
// módulos salen de `modulosDelCurso`): `modulosDelProducto` estricta devolviendo [] en vez de null
// al no poder leer → 15 / 1 «el calendario…», sobre 16.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  puedeSacar, puedeModerar, puedeComentar, puedeEditarAbout, puedeGestionarEventos, puedeConfigurar, sanearAbout,
  patronDeBusqueda, textoCoincide, TOPE_DESCRIPCION_CORTA, type ActorRegla,
} from '../lib/comunidad-reglas';

const ALUMNO: ActorRegla = { clave: 'l:7', equipo: false, adminWs: false };
const EQUIPO: ActorRegla = { clave: 'u:3', equipo: true, adminWs: false };
const ADMIN: ActorRegla = { clave: 'u:4', equipo: true, adminWs: true };

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...p: string[]) => sinComentarios(readFileSync(join(RAIZ, ...p), 'utf8'));
const DATOS = leer('lib', 'comunidad-datos.ts');
const MODERACION = leer('lib', 'comunidad-moderacion.ts');
const CALENDARIO = leer('lib', 'comunidad-calendario.ts');
const RUTA = leer('app', 'api', 'compartido', 'comunidad', 'route.ts');
const ACTIONS = leer('app', 'customer-success', 'comunidad', 'actions.ts');

function cuerpo(src: string, nombre: string): string {
  const ini = src.search(new RegExp(`\\n(export )?(async )?function ${nombre}\\b`));
  assert.ok(ini >= 0, `no encontré la función ${nombre}`);
  const resto = src.slice(ini + 1);
  const fin = resto.search(/\n(export )?(async )?function \w+|\nconst [A-Za-z_]+ = /);
  const c = fin > 0 ? resto.slice(0, fin) : resto;
  assert.ok(c.length < 9000, `el recorte de ${nombre} mide ${c.length}: está mirando otra cosa`);
  return c;
}
const antesQue = (c: string, antes: string | RegExp, despues: string | RegExp) => {
  const i = typeof antes === 'string' ? c.indexOf(antes) : c.search(antes);
  const j = typeof despues === 'string' ? c.indexOf(despues) : c.search(despues);
  return i >= 0 && j >= 0 && i < j;
};

// ── Las reglas ───────────────────────────────────────────────────────────────────

test('sacar: el equipo, a un ALUMNO; nunca un alumno, nunca a alguien del equipo, nunca a uno mismo', () => {
  assert.equal(puedeSacar(EQUIPO, 'l:8'), true);
  assert.equal(puedeSacar(ALUMNO, 'l:8'), false);
  assert.equal(puedeSacar(EQUIPO, 'u:9'), false, 'al equipo no se lo saca de la comunidad');
  assert.equal(puedeSacar({ ...ALUMNO, adminWs: true }, 'l:8'), false, 'un alumno no es equipo aunque venga marcado');
  assert.equal(puedeSacar(EQUIPO, 'email@x.com'), false);
  assert.equal(puedeSacar({ clave: 'l:7', equipo: true, adminWs: false }, 'l:7'), false, 'a uno mismo no');
});

test('moderar, editar el About y armar el calendario: el equipo; nunca un alumno', () => {
  for (const f of [puedeModerar, puedeEditarAbout, puedeGestionarEventos]) {
    assert.equal(f(ALUMNO), false, f.name);
    assert.equal(f(EQUIPO), true, f.name);
  }
  assert.equal(puedeConfigurar(EQUIPO), false, 'el nivel para postear y la zona son de un admin');
  assert.equal(puedeConfigurar(ADMIN), true);
});

test('con los comentarios cerrados no comenta NADIE (tampoco el equipo: para eso los abre)', () => {
  assert.equal(puedeComentar({ cerrado: true }), false);
  assert.equal(puedeComentar({ cerrado: false }), true);
});

test('el About: topes y texto (nunca HTML interpretado)', () => {
  assert.equal(sanearAbout({ descripcion: 'x'.repeat(TOPE_DESCRIPCION_CORTA + 1) }).ok, false);
  const r = sanearAbout({ nombre: '  ', descripcion: 'Una\nlínea', texto: '<b>hola</b>', reglas: '1. Respeto' });
  assert.ok(r.ok);
  assert.deepEqual(r.about, { nombre: null, descripcion: 'Una línea', texto: '<b>hola</b>', reglas: '1. Respeto' });
});

test('buscar: el patrón escapa los comodines y vuelve comodín a las vocales; la comparación de verdad no tiene acentos', () => {
  assert.equal(patronDeBusqueda('50%_x\\'), '%50\\%\\_x\\\\%');
  assert.equal(patronDeBusqueda('José'), '%j_s_%');
  assert.equal(textoCoincide('Hola José, ¿cómo va?', 'jose'), true);
  assert.equal(textoCoincide('Hola Josa', 'jose'), false, 'lo que el patrón trae de más, se descarta');
  assert.equal(textoCoincide('algo', ''), false);
});

// ── Cada escritura pregunta ANTES ────────────────────────────────────────────────

test('sacar y admitir preguntan `puedeSacar` antes de escribir; el lead tiene que ser de ESTE negocio', () => {
  const s = cuerpo(MODERACION, 'sacarAlumno');
  assert.ok(antesQue(s, 'puedeSacar(a, c.clave)', '.upsert('), 'sacar sin preguntar quién');
  assert.ok(antesQue(s, ".from('leads').select('id').eq('workspace_id', a.ws)", '.upsert('), 'sacar a un lead de otro negocio');
  assert.ok(antesQue(cuerpo(MODERACION, 'admitirAlumno'), 'puedeSacar(a, c.clave)', '.update('));
});

test('cerrar comentarios y ver a los sacados: `puedeModerar` antes', () => {
  assert.ok(antesQue(cuerpo(MODERACION, 'cerrarComentarios'), 'if (!puedeModerar(a))', '.update('));
  assert.ok(antesQue(cuerpo(MODERACION, 'sacadosDeLaComunidad'), 'if (!puedeModerar(a))', '.select('));
});

test('comentar pregunta `puedeComentar` (cerrado) antes de insertar', () => {
  assert.ok(antesQue(cuerpo(DATOS, 'comentar'), 'puedeComentar({ cerrado: post.comentarios_cerrados_at != null })', '.insert('));
});

test('el About: el equipo antes de escribir; el nivel para postear y la zona, un admin', () => {
  assert.ok(antesQue(cuerpo(DATOS, 'guardarAbout'), 'if (!puedeEditarAbout(a))', '.upsert('));
  assert.ok(antesQue(cuerpo(DATOS, 'guardarAjustesComunidad'), 'if (!puedeConfigurar(a))', '.upsert('));
});

test('el calendario: crear, editar, borrar y las opciones del editor preguntan `puedeGestionarEventos` primero', () => {
  for (const f of ['guardarEvento', 'borrarEvento', 'opcionesDeEvento']) {
    assert.ok(antesQue(cuerpo(CALENDARIO, f), 'if (!puedeGestionarEventos(a))', /\.(insert|update|delete|select)\(|modulosDelProducto\(/), f);
  }
});

test('lo cerrado no viaja: sin acceso, ni el lugar ni la descripción; y su .ics se rechaza', () => {
  const v = cuerpo(CALENDARIO, 'vistaDeEvento');
  assert.match(v, /descripcion: entra \? f\.descripcion : ''/);
  assert.match(v, /lugar: entra \? f\.lugar : ''/);
  assert.match(v, /acceso: editor \?/, 'la regla de acceso viaja sólo a quien edita');
  assert.ok(antesQue(cuerpo(CALENDARIO, 'icsComunidad'), 'if (!accesoPermite(accesoGuardado(fila.acceso), quien))', 'icsDe'));
});

test('el calendario: el rango del navegador pasa por `rangoDeCalendario`; un módulo se valida con la lectura ESTRICTA; una ocurrencia movida no se vuelve serie', () => {
  const cal = cuerpo(CALENDARIO, 'calendarioComunidad');
  assert.match(cal, /const \{ desde, hasta \} = rangoDeCalendario\(q\.desde, q\.hasta, Date\.now\(\)\);/, 'el rango del alumno sin acotar');
  assert.doesNotMatch(cal, /Number\(q\.(desde|hasta)\)/, 'quedó un rango armado a mano al lado');
  const g = cuerpo(CALENDARIO, 'guardarEvento');
  assert.match(g, /const mods = await modulosDelProducto\(a, \{ estricta: true \}\);\s*if \(!mods\) return /, 'validar un módulo con las etapas de fábrica');
  assert.match(g, /sanearEvento\(fila\.ocurrencia_fecha != null \? \{ \.\.\.b, recurrencia: null \} : b\)/, 'una ocurrencia movida guardada como serie');
  // Desde el 08/10/2026 los módulos salen de `modulosDelCurso` (lib/curso-modulos-datos.ts), la misma
  // derivación que el curso y el portal: estricta = sin poder leer, `null` (nunca las etapas de fábrica).
  const mp = cuerpo(CALENDARIO, 'modulosDelProducto');
  assert.match(mp, /if \(opts\.estricta\) \{\s*const cur = await modulosDelCurso\(a\.productoId, \{ estricta: true \}\);\s*return cur \? /);
  assert.match(mp, /catch \(e\) \{\s*if \(opts\.estricta\) return null;/);
  assert.doesNotMatch(mp, /entregaDeProducto\(/, 'la lectura que cae al default no valida un módulo');
});

// ── Un alumno SACADO no entra (ni a leer) y no pierde el curso ───────────────────

test('el portón: un baneo VIGENTE (levantado_at null) devuelve null antes de armar el actor', () => {
  const c = cuerpo(DATOS, 'actorDelAlumno');
  assert.match(c, /de\(acceso\.ws, 'comunidad_baneos'\)\.select\('id'\)\.eq\('producto_id', productoId\)\.eq\('miembro', clave\)\.is\('levantado_at', null\)/);
  assert.ok(antesQue(c, 'if (ban) return null;', 'return {'), 'arma el actor antes de mirar el baneo');
});

test('la ruta del alumno: TODA acción pasa por el portón (no hay `case` antes de él) y la lista de acciones es la del `switch`', () => {
  const gate = RUTA.indexOf('const actor = await actorDelAlumno(token, productoId);\n      if (!actor) return NO();');
  assert.ok(gate > 0, 'falta el portón');
  // Entre el workspace de la firma y el portón no se contesta nada (un atajo ahí se salta el baneo).
  const dentro = RUTA.indexOf('return runWithWorkspace(firma.ws, async () => {');
  assert.ok(dentro > 0 && dentro < gate);
  assert.doesNotMatch(RUTA.slice(dentro, gate), /OK\(|Response\.json\(\{ ok: true/, 'una respuesta antes del portón');
  const sw = RUTA.indexOf('switch (accion)');
  assert.ok(sw > gate, 'el switch corre antes del portón');
  assert.ok(RUTA.indexOf('case ') > gate, 'hay una acción antes del portón');
  const casos = [...RUTA.matchAll(/case '(\w+)'/g)].map((m) => m[1]).sort();
  const declaradas = [...RUTA.matchAll(/new Set\(\[([\s\S]*?)\]\)/g)].flatMap((m) => [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1])).sort();
  assert.deepEqual(casos, declaradas, 'una acción del switch que no está en LECTURAS/ESCRITURAS (o al revés)');
  for (const lectura of ['calendario', 'campana', 'about', 'buscar', 'feed', 'post']) assert.ok(casos.includes(lectura), lectura);
});

test('la ruta del alumno no expone NADA del equipo de la segunda mitad', () => {
  for (const f of ['guardarEvento', 'borrarEvento', 'opcionesDeEvento', 'sacarAlumno', 'admitirAlumno', 'sacadosDeLaComunidad', 'cerrarComentarios', 'guardarAbout', 'guardarAjustesComunidad']) {
    assert.ok(!RUTA.includes(f), `la ruta del alumno expone ${f}`);
    assert.ok(ACTIONS.includes(`(a) => ${f}(a`), `el equipo no tiene ${f}`);
  }
});

test('los sacados no cuentan como miembros (ni para el ranking, ni para mencionarlos); el baneo NO toca el curso', () => {
  const m = cuerpo(DATOS, 'miembrosDeLaComunidad');
  assert.match(m, /de\(ws, 'comunidad_baneos'\)\.select\('miembro'\)\.eq\('producto_id', productoId\)\.is\('levantado_at', null\)/);
  assert.match(m, /if \(baneados\.has\(k\)\) continue;/);
  assert.doesNotMatch(MODERACION, /curso_accesos|revocarAcceso/, 'sacar de la comunidad no puede cortar el curso');
});

test('el leaderboard («qué abre cada nivel»): los módulos del curso DERIVADOS, y al alumno sólo lo suyo (revisión 08/10)', () => {
  // Leía `curso_modulos` a mano: el nivel de un módulo VINCULADO (su fila no tiene nombre, es el de su
  // etapa) no salía nunca, y a un alumno le nombraba módulos y clases que sus permisos no le dan.
  const ap = cuerpo(DATOS, 'aperturasDelCurso');
  assert.match(ap, /const \{ modulosDelCurso \} = await import\('\.\/curso-modulos-datos'\);/);
  assert.doesNotMatch(ap, /from\('curso_modulos'\)/, 'la lista de módulos se DERIVA, no se lee de la tabla');
  assert.match(ap, /const ve = \(clave: string\) => a\.equipo \|\| moduloPermitido\(a\.alcance \?\? null, a\.productoId, clave\);/);
  assert.match(ap, /if \(ve\(m\.clave\)\) items\.push/);
  assert.match(ap, /if \(existen\.has\(f\.etapa\) && ve\(f\.etapa\)\) items\.push/);
  assert.match(ap, /\.eq\('workspace_id', a\.ws\)\.eq\('producto_id', a\.productoId\)/);
  assert.match(cuerpo(DATOS, 'rankingComunidad'), /aperturasDelCurso\(a\),/);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (scratchpad/comunidad-2/romper.mjs, restaura de memoria), contra este archivo de
// 15 tests. Cada rotura, sola, da 1 fallo y 14 pases (salvo la que se indica):
//   En las reglas: se saca a alguien del equipo · un alumno saca · «cerrado» no frena a nadie.
//   En la capa de datos: sacar sin `puedeSacar` · sacar a un lead de otro negocio · cerrar comentarios
//     sin `puedeModerar` · comentar un post cerrado · el About sin el equipo · crear eventos sin el
//     equipo · el link de la llamada viaja en un evento cerrado · el .ics de un evento cerrado.
//   El alumno SACADO: el portón no mira el baneo · un baneo levantado sigue cerrando · los sacados
//     siguen contando como miembros · sacar le corta el curso.
//   En la ruta: un atajo que contesta antes del portón · una acción del `switch` fuera de la lista ·
//     la ruta expone «sacar» (2 fallos, 13 pases).
// La REVISIÓN (08/10/2026, scratchpad/revision-comunidad/romper.mjs), contra este archivo de 16 tests:
// el rango del calendario armado a mano otra vez · validar el módulo de un evento con la lectura
// tolerante · una ocurrencia movida guardada como serie: 1 fallo y 15 pases cada una. Las dieciocho
// de arriba, re-medidas: 1 / 15 (la de «sacar», 2 / 14).
// La revisión del NÚCLEO (08/10/2026, scratchpad/rev-nucleo/romper-final.mjs), contra 17 tests: el
// leaderboard nombrando módulos fuera de los permisos del alumno · leyendo `curso_modulos` a mano (lo
// de antes: el nivel de un vinculado no salía) → 16 / 1 cada una, en «el leaderboard…».
