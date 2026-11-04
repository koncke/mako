// =============================================================================
// Sin el permiso de la persona, la app de iPhone no le manda nada a una IA (Apple 5.1.2(i)), y lo de la IA se denuncia desde el mensaje (Play)
// =============================================================================
// Plan: docs/tiendas-play-appstore.md, paso 6. Lo que corre de verdad, en un pedido de mentira con el user agent de la app, está en
// tests/_ia-permiso-hijo.ts: cuenta los pedidos que le llegan a un proveedor.
//
// Correr: node --import tsx --test tests/ia-permiso.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAVE_PERMISO_IA, SinPermisoIa, TEXTO_PERMISO_IA, TEXTO_SIN_PERMISO_IA, VERSION_PERMISO_IA, esSinPermisoIa, faltaPreguntarIa, leerPermisoIa, tienePermisoIa,
} from '../lib/ia-permiso-reglas';

const RAIZ = join(__dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\s*\}/g, '');

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_ia-permiso-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const PUERTAS = ['chatCheap', 'chatCheapCascade', 'chatCheapTools', 'leerDocumentoIA', 'transcribirAudio', 'chatClaude', 'chatClaudeTools', 'clonarVoz'];

test('1. el pedido de mentira es un pedido: si no, «sin marca» y «sin pedido» medirían lo mismo', () => {
  assert.equal(R.controlDelPedido, 'Agente-de-control');
});

test('2. con la marca de la app y sin permiso, NINGUNA puerta deja salir nada', () => {
  for (const p of PUERTAS) assert.equal(R.frenadas[p], 'SinPermisoIa/0', `${p}: ${R.frenadas[p]}`);
  // `embed` también frena, y lo dice como «sin con qué»: se busca por palabras, y la fila no queda en error.
  assert.equal(R.frenadas.embed, 'SinEmbebedor/0');
  assert.equal(R.claveSinPermiso, 'se lee', 'quien retiró el permiso tiene que poder borrar su voz clonada');
});

test('3. sin la marca nada cambia: Safari en iPhone, Android y lo automático siguen', () => {
  for (const p of [...PUERTAS, 'embed']) for (const c of ['safari', 'android']) {
    assert.notEqual(R.libres[`${p}:${c}`], 'SinPermisoIa', `${p} en ${c} se frenó por el permiso`);
  }
  assert.equal(R.sinPedido, 'sigue', 'un cron no tiene a quién preguntarle');
  assert.ok(R.alProveedorSinMarca > 0, 'el control: sin la marca, algo le llegó a un proveedor');
});

test('4. el permiso: sólo un «sí» de esta versión; un dato roto no es un permiso', () => {
  const con = (v: unknown) => ({ [CLAVE_PERMISO_IA]: v, otra: 1 });
  const si = { decision: 'si', at: '2026-11-03T00:00:00Z', version: VERSION_PERMISO_IA };
  assert.equal(tienePermisoIa(con(si)), true);
  assert.equal(tienePermisoIa(con({ ...si, decision: 'no' })), false);
  assert.equal(tienePermisoIa(con({ ...si, version: VERSION_PERMISO_IA - 1 })), false, 'una versión vieja del texto');
  for (const roto of [null, undefined, 'si', true, 1, {}, { decision: 'si' }, { decision: 'tal vez', at: 'x', version: 1 }]) {
    assert.equal(tienePermisoIa(con(roto)), false, JSON.stringify(roto));
  }
  for (const nada of [null, undefined, 'x', {}]) assert.equal(tienePermisoIa(nada), false);
  assert.equal(faltaPreguntarIa({}), true);
  assert.equal(faltaPreguntarIa(con({ ...si, decision: 'no' })), false, '«Ahora no» no se vuelve a preguntar solo');
  assert.equal(faltaPreguntarIa(con({ ...si, version: VERSION_PERMISO_IA - 1 })), true, 'con otro texto, se vuelve a preguntar');
  assert.deepEqual(leerPermisoIa(con(si)), si);
  const e = new SinPermisoIa();
  assert.equal(e.message, TEXTO_SIN_PERMISO_IA);
  assert.equal(esSinPermisoIa(e), true);
  assert.equal(esSinPermisoIa(new Error('otra cosa')), false);
});

test('5. la hoja dice con quién: Apple pide nombrar a los terceros, y los mismos que /privacidad', () => {
  const quienes = TEXTO_PERMISO_IA.quienes;
  for (const n of ['Anthropic', 'OpenAI', 'Google', 'Groq', 'ElevenLabs']) assert.match(quienes, new RegExp(n), n);
  assert.match(TEXTO_PERMISO_IA.que, /datos de tus contactos/);
  const privacidad = leer('app/privacidad/page.tsx');
  for (const n of ['Anthropic', 'OpenAI', 'Groq', 'Mistral', 'Cerebras', 'ElevenLabs']) assert.match(privacidad, new RegExp(n), `/privacidad sin ${n}`);
  assert.match(privacidad, /En la app de iPhone te lo\s+preguntamos antes/);
});

test('6. el turno se frena antes de salir por la PC del cliente, y la pantalla dice por qué', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(t, /export async function turnoApp\([^\n]*\n\s*await exigirPermisoIa\(\);/);
  assert.match(t, /export async function escucharNotaDelChat\([\s\S]{0,200}?\{\n\s*await exigirPermisoIa\(\);/);
  for (const r of ['app/api/mako/chat/route.ts', 'app/api/m/mako/route.ts']) {
    assert.match(sinComentarios(leer(r)), /if \(esSinPermisoIa\(e\)\) return json\(\{ ok: false, error: TEXTO_SIN_PERMISO_IA, necesitaPermisoIa: true \}, 403\);/, r);
  }
});

test('7. la app pregunta una vez y se cambia en Tu cuenta; fuera de la app de iPhone no se dibuja', () => {
  const hoja = sinComentarios(leer('app/m/_ui/PermisoIaM.tsx'));
  assert.equal((hoja.match(/if \(!appIos\) return null;/g) ?? []).length, 2, 'las dos piezas');
  assert.match(sinComentarios(leer('app/m/_ui/ShellM.tsx')), /\{usuario && <PermisoIaM \/>\}/);
  assert.match(sinComentarios(leer('app/m/cuenta/CuentaM.tsx')), /<FilaPermisoIaM \/>/);
});

test('8. Play: una respuesta de MaKo se denuncia desde el mismo mensaje, con lo que ya existe', () => {
  // En el MENÚ del mensaje (clic derecho o mantener apretado), no con un botón debajo de cada respuesta (4/11/2026, ticket #57;
  // Martín: «eso no tiene sentido»). Lo que hace y dónde se pide: tests/reportar-en-el-menu.test.ts, que lo corre.
  const hilo = sinComentarios(leer('app/_chat/HiloMako.tsx'));
  assert.doesNotMatch(hilo, /<ReportarRespuesta\b/, 'debajo de la respuesta, no');
  assert.match(hilo, /else if \(id === 'reportar'\) void rep\.reportar\(m\.texto\);/, 'en el menú del mensaje, sí');
  const r = sinComentarios(leer('app/_chat/ReportarRespuesta.tsx'));
  assert.match(r, /await reportarASoporte\(\{ error: /, 'el mismo camino que «Reportar a Soporte»: saneado en el servidor');
  assert.match(r, /\.slice\(0, TOPE_ERROR\)/, 'un pedazo, no la conversación');
});

// ⚠️ PROBADO ROMPIÉNDOLO (3/11/2026, base 8 / 0; una rotura por vez, restaurada de memoria y comprobada con sha256):
//   · chatClaude, chatCheap, embed o ElevenLabs sin la puerta → 7 / 1 (2), cada una
//   · un «no sé» es un sí (la base caída o sin sesión)        → 7 / 1 (2)
//   · el corte también en Safari                              → 7 / 1 (3): rompería la IA de los clientes de hoy
//   · un «no» también permite                                 → 7 / 1 (4)
//   · el turno sin la puerta (la PC del cliente)              → 7 / 1 (6)
//   · Reportar fuera del hilo                                 → 7 / 1 (8)
//   (4/11/2026, ticket #57: el 8 mira el menú del mensaje; sacar `reportar` del menú mínimo del hilo → 7 / 1 (8))
