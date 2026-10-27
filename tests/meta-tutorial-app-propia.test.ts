// =============================================================================
// El tutorial del modal de Meta: el token SE VA (27/10/2026)
// =============================================================================
// Hasta el 26/10 este tutorial enseñaba a sacar el token de Meta con la app propia del negocio (23/10/2026: crear la
// app, el usuario del sistema, el token con 8 permisos). Joan se perdió ahí dando de alta sus negocios («tenía 45
// pasos pero estaba muy resumido»), y el token se retira el 03/11 (`CORTE_TOKEN_META`): ahora avisa el corte y lleva a
// «Conectar con Facebook» (Meta por la Zernio del negocio).
//
// ⚠️ Y SIGUE SIN PEDIR PUBLICAR LA APP: Martín lo prohibió el 16/09 («no me menciones más que el cliente tenga que
// publicar su app, esa no es opción»).
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CORTE_TOKEN_META } from '../lib/zernio-meta-cuerpo';

// Se lee como TEXTO: lib/metodo-catalogo.ts es server-only (mismo criterio que tests/tutoriales-legibles.test.ts).
const FUENTE = readFileSync(new URL('../lib/metodo-catalogo.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const meta = FUENTE.slice(FUENTE.indexOf("key: 'meta',"), FUENTE.indexOf("key: 'zernio',"));
const pasos = (): string[] => {
  const bloque = /\btutorial: \{[\s\S]*?\bpasos: \[\n([\s\S]*?)\n\s*\],/.exec(meta)?.[1] ?? '';
  return [...bloque.matchAll(/^\s*'((?:[^'\\]|\\.)*)',?$/gm)].map((m) => m[1]);
};

test('el tutorial avisa el corte del token con la MISMA fecha que el código, y lleva a «Conectar con Facebook»', () => {
  const p = pasos();
  assert.ok(p.length >= 3 && p.length <= 5, `${p.length} pasos`);
  assert.ok(CORTE_TOKEN_META, 'sin fecha de corte no hay nada que avisar');
  const [, mes, dia] = CORTE_TOKEN_META!.split('-');
  assert.match(p[0], new RegExp(`se retira el .*${dia}/${mes}`), 'la fecha del tutorial no es la de CORTE_TOKEN_META');
  assert.match(p[0], /Zernio/);
  assert.ok(p.some((x) => /"Conectar con Facebook"/.test(x)), 'no lleva al botón de la conexión por Zernio');
  // La nota del campo dice lo mismo, con la misma fecha.
  assert.match(meta, new RegExp(`env: 'META_ACCESS_TOKEN'[^\n]*nota: 'Se retira el [a-z]+ ${dia}/${mes}`));
});

test('ya no enseña a sacar el token (el usuario del sistema, los permisos): ése era el laberinto', () => {
  const malos = pasos().filter((x) => /Generar nuevo token|usuario del sistema|Usuarios del sistema|ads_management|developers\.facebook\.com/i.test(x));
  assert.deepEqual(malos, []);
});

test('ningún paso le pide al cliente publicar ni activar su app (regla de Martín, 16/09)', () => {
  const malos = pasos().filter((x) => /"Publicar"|\bpublica(r|la)?\b.*\bapp\b|\bactiva\b|modo (público|activo|en vivo)|\bLive\b/i.test(x));
  assert.deepEqual(malos, []);
});
