// =============================================================================
// Zernio con la cuenta PROPIA de un negocio: con qué profile se le habla
// =============================================================================
// Hallazgo #3 de la revisión adversarial de la sexta tanda (10/10/2026), medido en producción en sólo
// lectura: ws11 NUNCA podía usar Instagram ni Messenger. Su `zernio_workspace.profile_id` (6a8059dc…,
// `mako_ws_11`) lo acuñó la rama SIN key propia de `ensureProfile` el 15/08, en la cuenta de la
// AGENCIA; la key propia del negocio llegó el 28/08. `profileIdEfectivo` devolvía el guardado sin
// mirar de qué cuenta era, así que las cuentas conectadas y el OAuth se le pedían a la cuenta del
// negocio con un profile ajeno: la tarjeta decía «Conectar», conectar fallaba, y el webhook nunca se
// registraba (sólo se registra con alguna cuenta conectada). Ahora, con key propia, se le pregunta a SU
// cuenta y un guardado ajeno se suelta (lib/zernio-profile.ts). Y la misma pregunta dada vuelta: con la
// key de la plataforma, un `null` guardado (de una key propia que ya no está) se acuña en vez de dejar
// al negocio sin profile para siempre.
//
// `profileDeLaCuenta` se EJECUTA; lib/zernio.ts importa `server-only`, así que su cableado se fija
// sobre el FUENTE, por función (nunca el archivo entero).
//
// PROBADO ROMPIÉNDOLO (10/10/2026), una rotura por vez contra una base en verde (3 pass / 0 fail), con un
// arnés que restaura DE MEMORIA:
//   · `profileIdEfectivo` devolviendo el guardado ANTES de mirar la key (el bug de ws11) → 2 / 1, «profileIdEfectivo…».
//   · `profileIdEfectivo` sin soltar el guardado ajeno (escribe el mismo valor)     → 2 / 1, «profileIdEfectivo…».
//   · `profileDeLaCuenta` confiando en el guardado sin buscarlo en la lista         → 2 / 1, «un profile guardado de OTRA cuenta…».
//   · `ensureProfile` con la key de la plataforma devolviendo el null guardado      → 2 / 1, «ensureProfile…».
//   · `ensureProfile` devolviendo lo guardado antes de `cfg` (la forma de antes)   → 2 / 1, «ensureProfile…».
// Restaurado: 3 / 0.
//
// Correr: node --import tsx --test tests/zernio-profile-propio.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { profileDeLaCuenta } from '../lib/zernio-profile';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques (AGENTS.md).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función de primer nivel: desde su firma hasta el `}` en la columna 0. */
const funcion = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no está «${firma}»`);
  const j = src.indexOf('\n}\n', i);
  assert.ok(j > i, `«${firma}» no cierra`);
  return src.slice(i, j + 2);
};

// ── El profile con key propia (hallazgo #3) ─────────────────────────────────

test('un profile guardado de OTRA cuenta se suelta y se habla con el Default de la cuenta de la key', () => {
  const deLaClienta = [{ _id: 'default-de-ella', isDefault: true }, { _id: 'otro-de-ella' }];
  // El caso de ws11: el guardado es el mako_ws_11 de la agencia, y la cuenta de ella no lo tiene.
  assert.deepEqual(profileDeLaCuenta('6a8059dc7d8d9eb34447c4a2', deLaClienta), { profileId: 'default-de-ella', soltarGuardado: true });
  // Un guardado que SÍ es de la cuenta gana sobre el Default.
  assert.deepEqual(profileDeLaCuenta('otro-de-ella', deLaClienta), { profileId: 'otro-de-ella', soltarGuardado: false });
  // Sin guardado (ws13): el Default, y no hay nada que soltar.
  assert.deepEqual(profileDeLaCuenta(null, deLaClienta), { profileId: 'default-de-ella', soltarGuardado: false });
  // Sin Default marcado, el primero; sin profiles, ninguno — y el ajeno igual se suelta.
  assert.deepEqual(profileDeLaCuenta(null, [{ _id: 'a' }, { _id: 'b' }]), { profileId: 'a', soltarGuardado: false });
  assert.deepEqual(profileDeLaCuenta('ajeno', []), { profileId: null, soltarGuardado: true });
  assert.deepEqual(profileDeLaCuenta(null, []), { profileId: null, soltarGuardado: false });
});

test('profileIdEfectivo: con key propia le pregunta a SU cuenta aunque haya un guardado, y suelta el ajeno', () => {
  const f = funcion(sinComentarios(leer('../lib/zernio.ts')), 'async function profileIdEfectivo(');
  const iByok = f.indexOf('if (!c.byok) return guardado;');
  assert.ok(iByok > 0, 'con la key de la plataforma el guardado es el mako_ws_<ws>: se devuelve tal cual');
  assert.doesNotMatch(f.slice(0, iByok), /\breturn\b/, 'el guardado vuelve antes de mirar con qué key se habla: es el bug de ws11');
  const iProfiles = f.indexOf("zFetch<{ profiles?: ZernioProfile[] }>(c.apiKey, '/profiles')");
  assert.ok(iProfiles > iByok, 'con key propia hay que listar los profiles de SU cuenta');
  assert.match(f.slice(iProfiles), /profileDeLaCuenta\(guardado, r\.profiles \?\? \[\]\)/);
  assert.match(f, /if \(soltarGuardado\) \{[\s\S]*?\.from\('zernio_workspace'\)\.update\(\{ profile_id: null \}\)\.eq\('workspace_id', ws\)/,
    'sin soltarlo, el profile ajeno vuelve en cada pedido');
  assert.match(f, /await upsertRouting\(RUTEO_PERFIL, profileId, ws\);\s*return profileId;/, 'el webhook rutea por el profile que se usa');
});

test('ensureProfile: con la key de la plataforma, un null guardado (de una key propia que ya no está) se acuña', () => {
  const f = funcion(sinComentarios(leer('../lib/zernio.ts')), 'export async function ensureProfile(');
  const iCfg = f.indexOf('const c = await cfg(ws);');
  assert.ok(iCfg > 0);
  assert.doesNotMatch(f.slice(0, iCfg), /\breturn\b/, 'antes de saber con qué key se habla no se puede devolver lo guardado');
  const iByok = f.indexOf('if (c.byok) {');
  const finByok = f.indexOf('return null;\n  }', iByok);
  assert.ok(iByok > iCfg && finByok > iByok);
  assert.match(f.slice(iByok, finByok), /if \(data\) return guardado;/, 'con key propia, lo guardado lo juzga profileIdEfectivo');
  const iAcunar = f.indexOf("zFetch<{ profile: ZernioProfile }>(c.apiKey, '/profiles', {");
  const plataforma = f.slice(finByok, iAcunar);
  assert.ok(iAcunar > finByok);
  assert.match(plataforma, /if \(guardado\) return guardado;/);
  assert.doesNotMatch(plataforma, /if \(data\)/, 'con la key de la plataforma, una fila con null deja al negocio sin profile para siempre');
});
