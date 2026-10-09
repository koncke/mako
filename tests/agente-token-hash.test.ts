// =============================================================================
// El token CLÁSICO de la API de MaKo (`agente_token`) deja de guardarse en claro (09/10/2026)
// =============================================================================
// Decisión de Martín: guardar sólo el hash y mostrarlo UNA vez, como los tokens con nombre de
// /api/v1. Se prueba el núcleo (lib/agente-token-nucleo.ts) contra una base FALSA que anota
// cada escritura, así que «nunca se escribe el texto plano» se mide sobre lo que de verdad se
// mandó a escribir, no sobre lo que el código dice que hace. Y el script de una sola vez
// (lib/agente-token-conversion.ts) en las dos formas: contando y aplicando.
//
// Probado rompiéndolo (09/10/2026), una rotura por vez y restaurando de memoria, sobre los
// 12 tests de este archivo:
//   · acunarCon guardando el token en vez de `guardadoDeToken(token)`:  1 fallo, 11 pases
//   · indexando el token en vez de su hash:                             3 fallos, 9 pases
//   · sin la búsqueda en claro (el formato viejo):                      1 fallo, 11 pases
//   · `coincide` dando true a cualquier token no vacío:                 2 fallos, 10 pases
//   · sin `borrarIndicesEnClaro` al rotar:                              1 fallo, 11 pases
//   · el script escribiendo en el dry-run (sin el `return`):            1 fallo, 11 pases
//   · el script logueando el token de cada fila en claro:               2 fallos, 10 pases
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENTE_TOKEN_KEY, acunarCon, coincide, guardadoDeToken, leerGuardado, revocarCon, visibleDe, wsDeTokenCon,
  type AlmacenAgente,
} from '../lib/agente-token-nucleo';
import { convertirAgenteTokens, type IoConversion } from '../lib/agente-token-conversion';
import { hashDeToken, pistaDe } from '../lib/api-mako/tokens-lista';
import { alcanceDePista, alcanceDeToken, prefijoDeAlcance } from '../lib/api-mako/alcance';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Una base falsa: los settings por ws, el índice (identificador → ws) y TODO lo escrito. */
function baseFalsa(inicial: { settings?: Record<number, string>; indice?: Record<string, number> } = {}) {
  const settings = new Map<number, string>(Object.entries(inicial.settings ?? {}).map(([k, v]) => [Number(k), v]));
  const indice = new Map<string, number>(Object.entries(inicial.indice ?? {}));
  const escrito: string[] = [];
  const alm: AlmacenAgente = {
    leerSetting: async (ws) => settings.get(ws) ?? null,
    escribirSetting: async (ws, v) => { escrito.push(v); settings.set(ws, v); },
    wsPorIndice: async (id) => indice.get(id) ?? null,
    indexar: async (id, ws) => {
      escrito.push(id);
      if (!indice.has(id)) indice.set(id, ws);
      return indice.get(id) === ws ? 'ok' : 'ocupado';
    },
    borrarIndicesEnClaro: async (ws) => {
      for (const [id, w] of [...indice]) if (w === ws && id.startsWith('mkoag_')) indice.delete(id);
    },
  };
  /** Todo lo que hay guardado ahora, en una cadena: para buscar el texto plano adentro. */
  const todo = () => [...settings.values(), ...indice.keys()].join('\n');
  return { alm, settings, indice, escrito, todo };
}

let n = 0;
/** Un azar distinto y reconocible por llamada (48 hex, como randomBytes(24)). */
const azar = () => (++n).toString(16).padStart(4, '0').repeat(12);

test('rotar NUNCA escribe el texto plano: ni en el setting ni en el índice', async () => {
  // Arranca con un token del formato VIEJO, en claro en las dos filas, para ver que rotar
  // además lo limpia.
  const viejo = `mkoag_${'cd'.repeat(24)}`;
  const b = baseFalsa({ settings: { 7: viejo }, indice: { [viejo]: 7 } });
  const { token, pista } = await acunarCon(b.alm, 7, 'ejecutar', azar);
  const cuerpo = token.slice(prefijoDeAlcance('ejecutar').length);

  assert.ok(b.escrito.length >= 2, `esperaba al menos el índice y el setting; se escribieron ${b.escrito.length} cosas`);
  for (const v of b.escrito) {
    assert.ok(!v.includes(cuerpo), 'una escritura lleva el token (o su cuerpo) en claro');
  }
  assert.ok(!b.todo().includes(cuerpo), 'quedó el token nuevo en claro en alguna fila');
  assert.ok(!b.todo().includes(viejo), 'rotar dejó el token VIEJO en claro (en el setting o en el índice)');

  const g = leerGuardado(b.settings.get(7));
  assert.equal(g?.forma, 'hash');
  assert.equal(g?.forma === 'hash' && g.hash, hashDeToken(token));
  assert.equal(pista, pistaDe(token));
  assert.match(pista, /^mkoag_e_…[0-9a-f]{4}$/);
  assert.equal(b.indice.get(hashDeToken(token)), 7, 'el índice no quedó por hash');
});

test('el formato NUEVO (hash) autentica, y uno cualquiera no', async () => {
  const b = baseFalsa();
  const { token } = await acunarCon(b.alm, 3, 'proponer', azar);
  assert.equal(await wsDeTokenCon(b.alm, token), 3);
  assert.equal(await wsDeTokenCon(b.alm, `  ${token}\n`), 3, 'un bearer con espacios es el mismo token');
  assert.equal(await wsDeTokenCon(b.alm, `${token.slice(0, -1)}0`), null);
  assert.equal(await wsDeTokenCon(b.alm, ''), null);
  // Un HASH copiado del índice no es un token: no autentica.
  assert.equal(await wsDeTokenCon(b.alm, hashDeToken(token)), null);
});

test('COMPATIBILIDAD: el formato VIEJO (en claro) sigue autenticando hasta que se convierta', async () => {
  const viejo = `mkoag_p_${'ab'.repeat(24)}`;
  const otro = `mkoag_p_${'ef'.repeat(24)}`;
  const b = baseFalsa({ settings: { 1: viejo }, indice: { [viejo]: 1, [otro]: 1 } });
  assert.equal(await wsDeTokenCon(b.alm, viejo), 1, 'una skill instalada antes del deploy recibiría 401');
  assert.equal(await wsDeTokenCon(b.alm, otro), null, 'un token viejo rotado (su fila sigue en el índice) volvió a autenticar');
});

test('un token ROTADO no autentica, aunque su fila siga en el índice', async () => {
  const b = baseFalsa();
  const primero = (await acunarCon(b.alm, 5, 'proponer', azar)).token;
  const segundo = (await acunarCon(b.alm, 5, 'lectura', azar)).token;
  assert.equal(b.indice.get(hashDeToken(primero)), 5, 'el índice es append-only: la fila del rotado sigue');
  assert.equal(await wsDeTokenCon(b.alm, primero), null, 'rotar no revocó el anterior');
  assert.equal(await wsDeTokenCon(b.alm, segundo), 5);

  // Y el del formato viejo, aunque falle la limpieza de su fila en claro (es best-effort).
  const viejo = `mkoag_${'12'.repeat(24)}`;
  const c = baseFalsa({ settings: { 9: viejo }, indice: { [viejo]: 9 } });
  c.alm.borrarIndicesEnClaro = async () => {};
  await acunarCon(c.alm, 9, 'proponer', azar);
  assert.equal(c.indice.get(viejo), 9, 'la fila en claro sobrevivió (limpieza fallida)');
  assert.equal(await wsDeTokenCon(c.alm, viejo), null, 'con el setting en hash, la fila en claro no puede autenticar');
});

test('revocar: nada autentica y la pantalla vuelve a «Genera tu token»', async () => {
  const b = baseFalsa();
  const { token } = await acunarCon(b.alm, 2, 'proponer', azar);
  await revocarCon(b.alm, 2);
  assert.equal(await wsDeTokenCon(b.alm, token), null);
  assert.equal(visibleDe(leerGuardado(b.settings.get(2))), null);
});

test('si el índice no queda del workspace, no se guarda un token que no resolvería', async () => {
  const b = baseFalsa();
  b.alm.indexar = async () => 'error';
  await assert.rejects(acunarCon(b.alm, 4, 'proponer', azar));
  assert.equal(b.settings.has(4), false, 'quedó un setting vigente sin fila en el índice: la skill recibiría 401');
});

test('el ALCANCE se lee de la pista, igual que del token', () => {
  const tokens = [
    `${prefijoDeAlcance('lectura')}${'ab'.repeat(24)}`,
    `${prefijoDeAlcance('proponer')}${'ab'.repeat(24)}`,
    `${prefijoDeAlcance('ejecutar')}${'ab'.repeat(24)}`,
    `mkoag_${'ab'.repeat(24)}`, // el formato de antes del alcance: proponer
  ];
  for (const t of tokens) assert.equal(alcanceDePista(pistaDe(t)), alcanceDeToken(t), pistaDe(t));
  assert.equal(alcanceDePista('basura'), 'lectura', 'fail-closed');
  assert.equal(alcanceDePista('mkoag_x_…abcd'), 'lectura', 'una letra desconocida no gana poder');
  // Y lo que se muestra de cada forma guardada.
  assert.deepEqual(visibleDe(leerGuardado(guardadoDeToken(tokens[2]))), { pista: pistaDe(tokens[2]), alcance: 'ejecutar' });
  assert.deepEqual(visibleDe(leerGuardado(tokens[3])), { pista: pistaDe(tokens[3]), alcance: 'proponer' });
});

test('el setting se lee FAIL-CLOSED: lo que no se reconoce no autentica', () => {
  assert.equal(leerGuardado(''), null);
  assert.equal(leerGuardado(null), null);
  assert.equal(leerGuardado('{roto'), null);
  assert.equal(leerGuardado(JSON.stringify({ hash: 'zz', pista: 'mkoag_…abcd' })), null);
  assert.equal(leerGuardado(JSON.stringify({ hash: 'a'.repeat(64), pista: 'otra cosa' })), null);
  assert.equal(leerGuardado('cualquier-cosa'), null);
  assert.equal(coincide(null, 'mkoag_p_' + 'ab'.repeat(24)), false);
});

// ── El script de una sola vez ────────────────────────────────────────────────

/** Filas falsas como las de producción: uno en claro (con una fila vieja rotada además), uno ya
 *  en hash, uno revocado y uno ilegible. */
function ioFalso() {
  const enClaro = `mkoag_p_${'5a'.repeat(24)}`;
  const rotadoHaceTiempo = `mkoag_${'6b'.repeat(24)}`;
  const enHash = `mkoag_e_${'7c'.repeat(24)}`;
  const settings = new Map<number, string | null>([[1, enClaro], [9, guardadoDeToken(enHash)], [11, ''], [13, 'basura']]);
  const indice = new Map<string, number>([[enClaro, 1], [rotadoHaceTiempo, 1], [hashDeToken(enHash), 9]]);
  const escrituras: string[] = [];
  const io: IoConversion = {
    leerSettings: async () => [...settings].map(([ws, value]) => ({ ws, value })),
    leerIndice: async () => [...indice].map(([identificador, ws]) => ({ ws, identificador })),
    indexar: async (id, ws) => { escrituras.push(`indexar ${id}`); if (!indice.has(id)) indice.set(id, ws); return indice.get(id) === ws; },
    cambiarSettingSi: async (ws, esperado, nuevo) => {
      escrituras.push(`setting ${nuevo}`);
      if (settings.get(ws) !== esperado) return false;
      settings.set(ws, nuevo);
      return true;
    },
    borrarIndice: async (ws, id) => { escrituras.push(`borrar ${id}`); if (indice.get(id) === ws) indice.delete(id); },
  };
  const secretos = [enClaro, rotadoHaceTiempo, enHash].flatMap((t) => [t, t.slice(-48), hashDeToken(t), pistaDe(t)]);
  return { io, settings, indice, escrituras, secretos, enClaro };
}

test('el script por defecto SÓLO CUENTA: no escribe nada y no imprime ningún valor', async () => {
  const f = ioFalso();
  const lineas: string[] = [];
  const r = await convertirAgenteTokens(f.io, { aplicar: false, log: (l) => lineas.push(l) });
  assert.deepEqual(f.escrituras, [], 'el dry-run escribió en la base');
  assert.deepEqual(r.settings, { enClaro: [1], enHash: [9], vacios: [11], ilegibles: [13] });
  assert.deepEqual(r.indice, { enClaro: 2, enClaroVigentes: 1, porHash: 1 });
  const salida = lineas.join('\n');
  assert.ok(lineas.length >= 5, 'no contó nada');
  for (const s of f.secretos) assert.ok(!salida.includes(s), `la salida imprime un valor del token: …${s.slice(-6)}`);
  assert.match(salida, /no se escribió nada/);
});

test('el script con --aplicar: hash + pista, índice por hash, y sin una fila en claro', async () => {
  const f = ioFalso();
  const lineas: string[] = [];
  const r = await convertirAgenteTokens(f.io, { aplicar: true, log: (l) => lineas.push(l) });
  assert.deepEqual(r.convertidos, [1]);
  assert.deepEqual(r.fallidos, []);
  assert.equal(r.indicesEnClaroBorrados, 2, 'la vigente convertida y la rotada hace tiempo');
  const g = leerGuardado(f.settings.get(1));
  assert.ok(g?.forma === 'hash' && g.hash === hashDeToken(f.enClaro) && g.pista === pistaDe(f.enClaro));
  assert.equal(f.indice.get(hashDeToken(f.enClaro)), 1);
  assert.ok(![...f.indice.keys()].some((k) => k.startsWith('mkoag_')), 'quedó una fila en claro en el índice');
  assert.ok(![...f.settings.values()].some((v) => (v ?? '').includes(f.enClaro.slice(-48))), 'quedó el token en claro en un setting');
  // Y el token de esa skill sigue autenticando con el código nuevo después de convertir.
  const alm: AlmacenAgente = {
    leerSetting: async (ws) => f.settings.get(ws) ?? null, escribirSetting: async () => {},
    wsPorIndice: async (id) => f.indice.get(id) ?? null, indexar: async () => 'ok', borrarIndicesEnClaro: async () => {},
  };
  assert.equal(await wsDeTokenCon(alm, f.enClaro), 1);
  for (const s of f.secretos) assert.ok(!lineas.join('\n').includes(s));
});

test('el script no pisa un setting que cambió mientras corría, y no le borra su fila', async () => {
  const f = ioFalso();
  const cambiar = f.io.cambiarSettingSi;
  f.io.cambiarSettingSi = async (ws, esperado, nuevo) => { f.settings.set(ws, `${f.enClaro}`); return cambiar(ws, `${esperado}x`, nuevo); };
  const r = await convertirAgenteTokens(f.io, { aplicar: true, log: () => {} });
  assert.deepEqual(r.convertidos, []);
  assert.equal(r.fallidos.length, 1);
  assert.equal(f.indice.get(f.enClaro), 1, 'borró la fila en claro de un setting que sigue en claro: esa skill quedaría sin autenticar');
});

// ── El cableado: nadie vuelve a leer el texto plano ─────────────────────────

test('ninguna función devuelve el texto plano: el setting sólo lo tocan el núcleo y su cableado', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).filter((f) => /\.tsx?$/.test(f));
  const permitidos = new Set(['lib/agente-token.ts', 'lib/agente-token-nucleo.ts', 'lib/agente-token-conversion.ts']);
  const culpables = archivos
    .filter((f) => !permitidos.has(f))
    // Las bitácoras de /admin/dev son REGISTRO: cuentan en un string lo que el código hacía
    // antes (`getAgenteToken(ws) ?? token`), y eso no lee nada.
    .filter((f) => !f.startsWith('app/admin/dev/'))
    .filter((f) => new RegExp(`AGENTE_TOKEN_KEY|['"\`]${AGENTE_TOKEN_KEY}['"\`]|getAgenteToken`).test(sinComentarios(leer(f))));
  assert.deepEqual(culpables, [], 'estos archivos leen el setting del token por su cuenta (o el getAgenteToken de antes)');
  // La skill arma el archivo con el bearer PRESENTADO: ya no hay de dónde releerlo.
  const skill = sinComentarios(leer('app/api/agente/skill/route.ts'));
  assert.match(skill, /const vigente = token;/);
  // Y la pantalla sólo recibe la pista: el token existe en ella únicamente recién acuñado.
  const tut = sinComentarios(leer('app/_components/TutorialAgente.tsx'));
  assert.match(tut, /setRecien\(j\.token as string\)/);
  assert.ok(!/tokenInicial/.test(tut), 'el tutorial volvió a recibir el token del server');
});
