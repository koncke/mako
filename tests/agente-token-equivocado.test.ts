// =============================================================================
// Ticket #60, la causa: el token EQUIVOCADO contra la skill de Claude (9/11/2026)
// =============================================================================
// Mauricio no pudo conectar su Claude con dos tokens recién generados. El arreglo del 6/11 (fa029686e) separó los casos
// del 401 de /api/v1, pero el cliente no le pegaba a /api/v1: le pegaba a /api/agente/*, las rutas de la skill, que
// seguían contestando «token inválido o revocado» para TODO. Reproducido el 9/11 en el ws3 contra producción, con un
// `mako_pat_` real recién acuñado (y revocado al terminar):
//   /api/v1?compacto=1      Bearer mako_pat_  → 200
//   /api/agente/contexto    Bearer mako_pat_  → 401 «token inválido o revocado»   (y /plan y /skill igual)
//   /api/agente/contexto    sin cabecera      → 401 «token inválido o revocado»   (el caso del 6/11, sin arreglar acá)
//   /api/agente/contexto    token sin Bearer  → 401 «token inválido o revocado»
// Sus tokens eran DETALLADOS (MaKo → API → Tokens), y la skill sólo acepta el CLÁSICO (Integraciones → Claude), a
// propósito: ver la frontera en tests/api-mako-tokens.test.ts.
//
// ⚠️ LA PRIMERA VERSIÓN DE ESTE TEST NO VEÍA EL BUG (revisión de b5f621c6f): probaba la regla pura y buscaba texto en
// los fuentes. Seis mutaciones reales quedaban en verde (rechazoAgente con el texto del #60, con status 200 o sin mirar
// la cabecera; bearerDe devolviendo siempre ''; una ruta que rechaza siempre). Y fijaba una AMPLIACIÓN que nadie pidió:
// bearerDe aceptando el esquema «token». Ahora el grueso pasa por tests/_agente-token-equivocado-hijo.ts, que le pega a
// las siete rutas REALES con pedidos de verdad (un `mkoag_` vigente, un `mako_pat_` vigente y cuatro cabeceras malas),
// contra un PostgREST de mentira. Probado rompiéndolo: la tabla está en el commit que trajo esta versión.
//
// Correr: node --import tsx --test tests/agente-token-equivocado.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bearerDeCabecera, casoDeAutorizacion, casoDeAutorizacionAgente, mensajeDeAutorizacion, mensajeDeAutorizacionAgente,
} from '../lib/api-mako/autorizacion-reglas';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// Valores de mentira con la forma de cada token: el prefijo es lo único que importa en la regla pura.
const DETALLADO = 'mako_pat_0123456789abcdef0123456789abcdef0123456789abcdef0123';
const AGENCIA = 'mako_agt_0123456789abcdef0123456789abcdef0123456789abcdef0123';
const CLASICO = 'mkoag_e_0123456789abcdef0123456789abcdef01234567';

const agente = (cabecera: string | null) => mensajeDeAutorizacionAgente(casoDeAutorizacionAgente(cabecera));

/** La regla de `bearerDe` en origin/main ANTES del #60, copiada tal cual: la skill no amplía a quién autoriza. */
const bearerDeMain = (h: string | null) => { const m = /^bearer\s+(.+)$/i.exec((h ?? '').trim()); return m ? m[1].trim() : ''; };

/** ¿El mensaje repite algún pedazo de 8 caracteres seguidos del token? (cualquier pedazo, no una ventana fija) */
const repite = (m: string, token: string) => {
  for (let i = 0; i + 8 <= token.length; i++) if (m.includes(token.slice(i, i + 8))) return token.slice(i, i + 8);
  return null;
};

// ── La regla, pura ───────────────────────────────────────────────────────────

test('un token de API → Tokens contra la skill dice CUÁL token va, y dónde está, sin afirmar que sirve', () => {
  for (const t of [DETALLADO, AGENCIA]) {
    const m = agente(`Bearer ${t}`);
    assert.match(m, /Integraciones → Claude/, `no dice dónde está el token de la skill: «${m}»`);
    assert.match(m, /mkoag_/, 'sin el prefijo, la persona no puede saber cuál de sus tokens es el bueno');
    assert.match(m, /API → Tokens/, 'no dice de dónde salió el que mandó, que es lo que la confundió');
    assert.match(m, /no lo arregla/i, 'tiene que decir que regenerar en API → Tokens no sirve: es lo que hizo dos veces');
    assert.doesNotMatch(m, /inválido o revocado/i, 'volvió el mensaje del ticket #60: el token no está revocado, es OTRO token');
    // Sale sólo por el prefijo, sin mirar la base: uno revocado o inventado oye lo mismo. No se le afirma que «sirve».
    assert.match(m, /parece/, 'afirma qué token es sin haberlo buscado');
    assert.doesNotMatch(m, /sirve para/, 'a un mako_pat_ revocado le diría que sirve para /api/v1');
  }
});

test('un token que no existe manda a Integraciones → Claude, no a API → Tokens', () => {
  const m = agente(`Bearer ${CLASICO}`);
  assert.match(m, /no existe o fue revocado/i);
  assert.match(m, /Integraciones → Claude/, `mandaría a generar un token que la skill no acepta: «${m}»`);
  assert.doesNotMatch(m, /API → Tokens/);
});

test('la cabecera mal armada (y «token …») se dice como esquema equivocado, y no manda a regenerar', () => {
  const casos = [[null, 'sin cabecera'], [CLASICO, 'sin esquema'], [`Basic ${CLASICO}`, 'Basic'], [`token ${CLASICO}`, 'token']] as const;
  for (const [cab, caso] of casos) {
    const m = agente(cab);
    assert.match(m, /Authorization/, `«${caso}» no nombra la cabecera, que es lo que hay que arreglar: «${m}»`);
    assert.match(m, /Integraciones → Claude/, `«${caso}» no dice cuál token va`);
    assert.doesNotMatch(m, /no existe|revocad|genera uno nuevo/i, `«${caso}» manda a regenerar un token que puede estar bien`);
  }
  assert.match(agente(`token ${CLASICO}`), /esquema «token».*«Bearer»/, '«token …» no se lee: el 401 tiene que decir que va «Bearer»');
  const dichos = [agente(null), agente(CLASICO), agente(`Basic ${CLASICO}`), agente(`Bearer ${CLASICO}`), agente(`Bearer ${DETALLADO}`)];
  assert.equal(new Set(dichos).size, dichos.length, 'dos casos distintos dicen lo mismo: volvimos al ticket #60');
});

test('el mensaje NUNCA repite un pedazo del token que llegó', () => {
  for (const t of [DETALLADO, AGENCIA, CLASICO]) {
    for (const cab of [`Bearer ${t}`, t, `Basic ${t}`, `token ${t}`]) {
      const m = agente(cab);
      const pedazo = repite(m, t);
      assert.equal(pedazo, null, `el error devolvió «${pedazo}» del token: «${m}»`);
    }
  }
});

test('la skill lee la cabecera con la regla de SIEMPRE: «token …» no autoriza', () => {
  const matriz = [null, '', 'Bearer abc', 'bearer abc', 'BEARER   abc  ', 'Bearer\tabc', 'Bearer', 'token abc', 'Token abc', 'token Bearer abc', 'Basic abc', 'abc'];
  for (const h of matriz) assert.equal(bearerDeCabecera(h), bearerDeMain(h), `la skill cambió a quién autoriza con «${h}»`);
  assert.equal(casoDeAutorizacionAgente(`token ${CLASICO}`).caso, 'otro-esquema', '«token …» para la skill es un esquema equivocado');
  assert.equal(casoDeAutorizacion(`token ${CLASICO}`).caso, 'bearer', '/api/v1 sí acepta «token»: eso no se tocó');
});

test('/api/v1 manda al lugar correcto según el token que no encontró', () => {
  assert.match(mensajeDeAutorizacion(casoDeAutorizacion(`Bearer ${CLASICO}`), true), /Integraciones → Claude/,
    'un token clásico revocado se regenera en Integraciones → Claude, no en API → Tokens');
  assert.match(mensajeDeAutorizacion(casoDeAutorizacion(`Bearer ${DETALLADO}`), true), /API → Tokens/);
});

// ── De punta a punta: las siete rutas REALES, con pedidos de verdad ─────────

type Salida = { status: number; error: string | null } | { tiro: string };
type Resultado = {
  porRuta: Record<string, Record<string, Salida>>;
  directo: Record<string, { status: number; error: string | null }>;
  matriz: Array<string | null>; bearer: string[];
  tokens: { clasico: string; detallado: string }; red: string[];
};
let R: Resultado | null = null;
function resultado(): Resultado {
  if (R) return R;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_agente-token-equivocado-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 240_000,
  });
  R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Resultado;
  return R;
}

const RUTAS = ['consultar', 'contexto', 'lead', 'metricas', 'planGET', 'planPOST', 'skill', 'telemetria'];

test('con el token de la skill vigente, las siete rutas autorizan (no hay una que rechace a todos)', () => {
  const { porRuta, red } = resultado();
  assert.deepEqual(Object.keys(porRuta).sort(), [...RUTAS].sort(), 'el hijo no pasó por todas las rutas');
  for (const r of RUTAS) {
    const v = porRuta[r].vigente;
    assert.ok('tiro' in v || v.status !== 401, `${r} rechaza un mkoag_ vigente: ${JSON.stringify(v)}`);
  }
  assert.deepEqual(red, [], 'el hijo salió a la red');
});

test('cada caso malo es un 401 con SU mensaje, en las siete rutas, y es el de rechazoAgente', () => {
  const { porRuta, directo } = resultado();
  const espera: Record<string, RegExp> = {
    detallado: /parece un token de MaKo → API → Tokens/,
    sinCabecera: /Falta el header Authorization/,
    esquemaToken: /esquema «token».*«Bearer»/,
    inventado: /no existe o fue revocado.*Integraciones → Claude/,
    pelado: /sin esquema/,
  };
  for (const [caso, re] of Object.entries(espera)) {
    assert.equal(directo[caso].status, 401, `rechazoAgente contesta ${directo[caso].status} a «${caso}»`);
    assert.match(directo[caso].error ?? '', re, `rechazoAgente, «${caso}»: «${directo[caso].error}»`);
    for (const r of RUTAS) {
      const v = porRuta[r][caso];
      assert.ok(!('tiro' in v), `${r} tiró con «${caso}»: ${JSON.stringify(v)}`);
      assert.equal(v.status, 401, `${r} contesta ${v.status} a «${caso}»`);
      assert.equal(v.error, directo[caso].error, `${r} no contesta con rechazoAgente en «${caso}»: «${v.error}»`);
      assert.doesNotMatch(v.error ?? '', /^token inválido o revocado$/i, `${r} volvió al texto del ticket #60`);
    }
  }
  const textos = Object.keys(espera).map((c) => directo[c].error);
  assert.equal(new Set(textos).size, textos.length, 'rechazoAgente dice lo mismo a dos casos distintos: no está mirando la cabecera');
});

test('«Authorization: token <mkoag_ vigente>» sigue siendo 401 en la skill, como en main', () => {
  const { porRuta } = resultado();
  for (const r of RUTAS) assert.equal((porRuta[r].esquemaToken as { status: number }).status, 401, `${r} autoriza con el esquema «token»`);
});

test('bearerDe REAL (lib/agente-token.ts) lee como en main, cabecera por cabecera', () => {
  const { matriz, bearer } = resultado();
  assert.ok(matriz.length >= 10, 'el hijo no mandó la matriz');
  matriz.forEach((h, i) => assert.equal(bearer[i], bearerDeMain(h), `bearerDe cambió con «${h}»: «${bearer[i]}»`));
});

test('ningún 401 de las rutas repite un pedazo de un token que llegó', () => {
  const { porRuta, directo, tokens } = resultado();
  const errores = [...Object.values(directo).map((d) => d.error ?? ''), ...Object.values(porRuta).flatMap((cs) => Object.values(cs).map((v) => ('error' in v ? v.error ?? '' : '')))];
  for (const e of errores) for (const t of Object.values(tokens)) assert.equal(repite(e, t), null, `un 401 repite un pedazo de un token: «${e}»`);
});

test('las rutas de /api/agente contestan el 401 con esa regla, no con un texto suelto', () => {
  const dir = join(RAIZ, 'app', 'api', 'agente');
  const rutas = readdirSync(dir).map((d) => `app/api/agente/${d}/route.ts`).filter((p) => {
    try { return /wsDelBearer\(/.test(leer(p)); } catch { return false; }
  });
  assert.ok(rutas.length >= 7, `esperaba las siete rutas que resuelven el bearer y encontré ${rutas.length}: el test no mira nada`);
  // /hook acepta también la sesión del navegador y su 401 dice eso: queda afuera a propósito.
  const conBearerSolo = rutas.filter((p) => !p.includes('/hook/'));
  const sueltas = conBearerSolo.filter((p) => /inválido o revocado/.test(sinComentarios(leer(p))));
  assert.deepEqual(sueltas, [], `estas rutas siguen contestando «inválido o revocado» a cualquier cosa:\n${sueltas.join('\n')}`);
});
