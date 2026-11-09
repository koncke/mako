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
// propósito: ver la frontera en tests/api-mako-tokens.test.ts. En la llamada del 8/11 se le dijo además que era «el
// mismo» token. Con el 401 diciendo «inválido», regenerar en API → Tokens era el paso natural, y nunca lo iba a arreglar.
//
// Lo que se prueba: que el 401 de /api/agente DIGA cuál token va cuando llega uno de la pantalla de API, que mande a
// Integraciones → Claude (no a API → Tokens) cuando el que llegó no existe, que separe los casos de la cabecera como
// /api/v1, que nunca repita el token, y que las siete rutas usen esa respuesta y no un texto suelto.
//
// Correr: node --import tsx --test tests/agente-token-equivocado.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { casoDeAutorizacion, mensajeDeAutorizacion, mensajeDeAutorizacionAgente } from '../lib/api-mako/autorizacion-reglas';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// Valores de mentira con la forma de cada token: el prefijo es lo único que importa acá.
const DETALLADO = 'mako_pat_0123456789abcdef0123456789abcdef0123456789abcdef0123';
const AGENCIA = 'mako_agt_0123456789abcdef0123456789abcdef0123456789abcdef0123';
const CLASICO = 'mkoag_e_0123456789abcdef0123456789abcdef01234567';

const agente = (cabecera: string | null) => mensajeDeAutorizacionAgente(casoDeAutorizacion(cabecera));

test('un token de API → Tokens contra la skill dice CUÁL token va, y dónde está', () => {
  for (const t of [DETALLADO, AGENCIA]) {
    const m = agente(`Bearer ${t}`);
    assert.match(m, /Integraciones → Claude/, `no dice dónde está el token de la skill: «${m}»`);
    assert.match(m, /mkoag_/, 'sin el prefijo, la persona no puede saber cuál de sus tokens es el bueno');
    assert.match(m, /API → Tokens/, 'no dice de dónde salió el que mandó, que es lo que la confundió');
    assert.match(m, /no lo arregla/i, 'tiene que decir que regenerar en API → Tokens no sirve: es lo que hizo dos veces');
    assert.doesNotMatch(m, /inválido o revocado/i, 'volvió el mensaje del ticket #60: el token no está revocado, es OTRO token');
  }
});

test('un token que no existe manda a Integraciones → Claude, no a API → Tokens', () => {
  const m = agente(`Bearer ${CLASICO}`);
  assert.match(m, /no existe o fue revocado/i);
  assert.match(m, /Integraciones → Claude/, `mandaría a generar un token que la skill no acepta: «${m}»`);
  assert.doesNotMatch(m, /API → Tokens/);
});

test('la cabecera mal armada se dice como en /api/v1, y no manda a regenerar', () => {
  for (const [cab, caso] of [[null, 'sin-cabecera'], [CLASICO, 'sin-esquema'], [`Basic ${CLASICO}`, 'otro-esquema']] as const) {
    const m = agente(cab);
    assert.match(m, /Authorization/, `«${caso}» no nombra la cabecera, que es lo que hay que arreglar: «${m}»`);
    assert.doesNotMatch(m, /no existe|revocad|genera uno nuevo/i, `«${caso}» manda a regenerar un token que puede estar bien`);
  }
  const dichos = [agente(null), agente(CLASICO), agente(`Basic ${CLASICO}`), agente(`Bearer ${CLASICO}`), agente(`Bearer ${DETALLADO}`)];
  assert.equal(new Set(dichos).size, dichos.length, 'dos casos distintos dicen lo mismo: volvimos al ticket #60');
});

test('el mensaje NUNCA devuelve el token que llegó', () => {
  for (const t of [DETALLADO, AGENCIA, CLASICO]) {
    for (const cab of [`Bearer ${t}`, t, `Basic ${t}`]) {
      const m = agente(cab);
      assert.ok(!m.includes(t.slice(9, 30)), `el error devolvió un pedazo del token: «${m}»`);
    }
  }
});

test('/api/v1 manda al lugar correcto según el token que no encontró', () => {
  assert.match(mensajeDeAutorizacion(casoDeAutorizacion(`Bearer ${CLASICO}`), true), /Integraciones → Claude/,
    'un token clásico revocado se regenera en Integraciones → Claude, no en API → Tokens');
  assert.match(mensajeDeAutorizacion(casoDeAutorizacion(`Bearer ${DETALLADO}`), true), /API → Tokens/);
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
  const sinRegla = conBearerSolo.filter((p) => !/rechazoAgente\(req\)/.test(sinComentarios(leer(p))));
  assert.deepEqual(sinRegla, [], `estas rutas no usan rechazoAgente(req) para su 401:\n${sinRegla.join('\n')}`);
});

test('bearerDe lee la cabecera con la MISMA regla que el mensaje', () => {
  // Si los dos patrones se separan, una cabecera que uno acepta el otro la llama «otro esquema» y el 401 miente.
  // Se mira el CUERPO de bearerDe: el archivo entero nombra casoDeAutorizacion igual (rechazoAgente lo usa), y un chequeo
  // sobre todo el fuente pasaba con bearerDe de vuelta en su regex (probado rompiéndolo, 9/11).
  const src = sinComentarios(leer('lib/agente-token.ts'));
  const cuerpo = /export function bearerDe\(req: Request\): string \{([\s\S]*?)\r?\n\}/.exec(src)?.[1];
  assert.ok(cuerpo, 'no encontré bearerDe en lib/agente-token.ts');
  assert.match(cuerpo, /casoDeAutorizacion\(/, 'bearerDe volvió a tener su propio patrón');
});
