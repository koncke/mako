// =============================================================================
// TODA server action de app/crm corta sin sesión ADENTRO, no sólo en el proxy (17/10/2026)
// =============================================================================
// Una server action es un POST con un id que viaja en el bundle. Hasta este día, 85 de las 145
// acciones de los archivos 'use server' de app/crm —43 de las 53 de app/crm/actions.ts— no miraban
// la sesión: las cubría sólo `proxy.ts`, que valida la FIRMA de la cookie sin tocar la base (la de
// un usuario suspendido vale hasta 30 días). Y sin sesión resuelta, `getWorkspaceActual()` cae al
// ws1, que es Mauricio, un cliente. El relevo de seguridad lo dejó como decisión (§6.3): «un guard de
// fuente que exija que toda acción empiece verificando sesión», que es el molde que ya funcionó
// en deal-actions, pagos-campo y la ficha por bloques (tests/acciones-sin-sesion.test.ts).
//
// EL BARRIDO, no una lista: todo 'use server' de app/crm, toda `export async function`. Una acción
// nueva que se olvide falla acá con su nombre. Lo que cuenta como corte (en las primeras líneas del
// cuerpo) está escrito en positivo abajo: `getUsuarioActual()` suelto NO cuenta — leerla no es
// cortar (así estaba `getLeadFullAction`, que la leía para otra cosa).
//
// Probado rompiéndolo (17/10/2026), sobre los 2 de este archivo (base 2 / 0): sacando el
// `await exigirSesion();` de `deleteLeadAction` → 1 / 1 («app/crm/actions.ts · deleteLeadAction»);
// con `exigirSesion` que no tira (`if (rol == null) return;`) → 1 / 1 (el de la regla).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** Lo que CORTA sin sesión, en positivo. Cada uno tira o devuelve antes de tocar datos. */
const CORTES: RegExp[] = [
  /await exigirSesion\(\);/,
  /if \(!\(await haySesion\(\)\)\) (return|throw)/,
  /if \(!\(await getUsuarioActual\(\)\)\) (return|throw)/,
  /if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) (return|throw)/,
  /if \(\(await getRolWsEfectivo\(\)\) == null\) (return|throw)/,
  /const sesion = await getUsuarioActual\(\)(\.catch\(\(\) => null\))?;\n\s*if \(!sesion\) (return|throw)/,
  /if \(!\(await getSesionAdmin\(\)\)\) (return|throw)/,
  /await exigirAccesoAMarcarPago\(/,
  /await requireSesion\(\);/,
];

test('cada export async function de los use server de app/crm corta sin sesión en su arranque', () => {
  const archivos = execFileSync('git', ['ls-files', 'app/crm'], { encoding: 'utf8' }).split('\n').filter((f) => /\.tsx?$/.test(f));
  const faltan: string[] = [];
  let vistas = 0;
  for (const f of archivos) {
    const crudo = leer(f);
    if (!/^['"]use server['"]/m.test(crudo.slice(0, 400))) continue;
    const src = sinComentarios(crudo);
    for (const m of src.matchAll(/^export async function (\w+)\(/gm)) {
      vistas++;
      let i = (m.index ?? 0) + m[0].length;
      let d = 1;
      while (i < src.length && d > 0) { if (src[i] === '(') d++; else if (src[i] === ')') d--; i++; }
      const llave = src.indexOf('{\n', i);
      // Las primeras 6 líneas del cuerpo: el corte va AL PRINCIPIO, antes de leer o escribir nada.
      const cabeza = src.slice(llave + 2).split('\n').slice(0, 6).join('\n');
      if (!CORTES.some((c) => c.test(cabeza))) faltan.push(`${f} · ${m[1]}`);
    }
  }
  assert.ok(vistas >= 140, `el barrido dejó de ver las acciones (vio ${vistas})`);
  assert.deepEqual(faltan, [], `estas acciones no cortan sin sesión al arrancar (agregá \`await exigirSesion();\` de lib/sesion-accion.ts como primera línea):\n${faltan.join('\n')}`);
});

test('exigirSesion TIRA cuando no hay sesión resuelta contra la base', () => {
  const src = sinComentarios(leer('lib/sesion-accion.ts'));
  const cuerpo = src.slice(src.indexOf('export async function exigirSesion'));
  assert.match(cuerpo, /getRolWsEfectivo\(\)/, 'tiene que resolver la sesión contra la base (getRolWsEfectivo), no sólo la firma');
  assert.match(cuerpo, /if \(rol == null\) throw new Error\(SIN_SESION\)/);
  // Un error de la base tampoco deja pasar: se toma como «sin sesión».
  assert.match(cuerpo, /catch \{ rol = null; \}/);
});
