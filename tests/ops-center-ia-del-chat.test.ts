// =============================================================================
// El «+» de la caja del cliente elige con qué IA corre ESE chat (23/10/2026, feedback 8b, la parte de la caja)
// =============================================================================
// Martín: «En el Ops Center, el "+" de la caja deja elegir con qué corre ese chat: el modelo y la cuenta (Claude o GPT, y
// cuál). Por defecto decide el chat jefe, salvo que se elija otro». Acordado con el chat IA del cliente: la caja manda `ia`
// y el servidor lo valida y lo respeta (su parte: la ruta, `turnoApp`). Acá:
//   1. el selector va adentro del «+», copiado del super admin, con «Automático · lo decide el chat jefe» primero, y sólo
//      con las cuentas que arma el servidor (`?suIA=1` → `cuentas`): sin ellas, nada (así no sale antes que el servidor);
//   2. lo elegido es por chat, vale mientras se pueda elegir, y un chat nuevo se lo lleva al crearse;
//   3. viaja en cada mensaje (también con archivos y en una nota de voz), y sólo si se eligió algo;
//   4. abajo de la caja se dice con qué va.
//
// Correr: node --import tsx --test tests/ops-center-ia-del-chat.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import * as modulo from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CuentaDeIA, EleccionIA } from '../lib/chat-ia-reglas';

// PiezasCliente importa su CSS: Node no lo carga (como tests/offer-hilo-unico.test.ts). Se importa después, dinámico.
type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const CUENTAS: CuentaDeIA[] = [
  { cuenta: 'pc', nombre: 'Tu computadora (Oficina)', modelos: ['sonnet', 'opus', 'haiku'], modeloDefault: 'sonnet' },
  { cuenta: 'openai', nombre: 'Tu ChatGPT', modelos: [], modeloDefault: null },
];
const kDe = (iaDelChat: EleccionIA, cuentasIA: CuentaDeIA[] | null = CUENTAS) => ({ cuentasIA, iaDelChat, enCurso: false, elegirIA: () => {} }) as never;

test('1. el selector va adentro del «+», con «Automático» primero y sólo con las cuentas del servidor', async () => {
  const { SelectoresDelCliente } = await import('../app/second-brain/PiezasCliente');
  const html = renderToStaticMarkup(createElement(SelectoresDelCliente, { k: kDe(null) }));
  const ops = [...html.matchAll(/<option value="([^"]*)"[^>]*>([^<]+)<\/option>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(ops, [['', 'Automático · lo decide el chat jefe'], ['pc', 'Tu computadora (Oficina)'], ['openai', 'Tu ChatGPT']]);
  assert.doesNotMatch(html, />Modelo</, 'en Automático no se elige modelo');
  // Con la computadora elegida, sus modelos, con el de siempre primero.
  const conPc = renderToStaticMarkup(createElement(SelectoresDelCliente, { k: kDe({ cuenta: 'pc' }) }));
  assert.match(conPc, />Modelo<[\s\S]*<option value="" selected="">Automático · Sonnet<\/option><option value="sonnet">Sonnet<\/option><option value="opus">Opus<\/option>/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(SelectoresDelCliente, { k: kDe({ cuenta: 'openai' }) })), />Modelo</, 'sin modelos que elegir, no hay renglón');
  // Sin las cuentas del servidor, nada: el selector no sale antes que el servidor que lo respeta.
  assert.equal(renderToStaticMarkup(createElement(SelectoresDelCliente, { k: kDe(null, null) })), '');
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.match(piezas, /mas=\{k\.cuentasIA\?\.length \? <SelectoresDelCliente k=\{k\} \/> : undefined\}/, 'adentro del «+»');
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /setCuentasIA\(l\.ok && Array\.isArray\(l\.datos\.cuentas\) && l\.datos\.cuentas\.length \? l\.datos\.cuentas : null\);/);
  assert.match(motor, /cuentasIA: idOffer != null \? null : cuentasIA,/, 'en Offer no: su motor es otro');
});

test('2. lo elegido es por chat, vale mientras se pueda elegir, y un chat nuevo se lo lleva', () => {
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /const iaDelChat = idOffer != null \? null : eleccionVigente\(iaDe\[chatAbierto\] \?\? null, cuentasIA\);/);
  assert.match(motor, /const elegirIA = \(e: EleccionIA\) => setIaDe\(\(m\) => \(\{ \.\.\.m, \[chatAbierto\]: e \}\)\);/);
  assert.match(motor, /chatAbierto === 'nuevo' && m\.nuevo !== undefined \? \{ \.\.\.m, \[`s\$\{sid\}`\]: m\.nuevo, nuevo: null \} : m/, 'el nuevo pasa a su fila');
  assert.equal((motor.match(/setElegido\(\{ id: sid \}\);\n\s*pasarIaAlCreado\(sid\);/g) ?? []).length, 2, 'al crearse con un mensaje y con una nota de voz');
});

test('3. viaja en cada mensaje, con archivos y en una nota de voz, y sólo si se eligió algo', () => {
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /\.\.\.\(desdeTab \? \{ desde: desdeTab \} : \{\}\), \.\.\.\(ia \? \{ ia \} : \{\}\) \}\)/, 'el JSON, sólo con algo elegido');
  assert.match(motor, /if \(ia\) fd\.append\('ia', JSON\.stringify\(ia\)\);/, 'el multipart');
  assert.match(motor, /await postArchivos<RespuestaTurno>\(sid, mensaje, archivos, deAntes, desdeTab, null, ia\)/, 'con archivos');
  assert.match(motor, /await postArchivos<RespuestaTurno>\(sid, '', \[\], deAntes, desdeTab, \{ mp3, secs: Math\.max\(1, Math\.round\(a\.secs\)\) \}, ia\)/, 'la nota de voz');
  assert.equal((motor.match(/const ia = iaDelChat;/g) ?? []).length, 2, 'lo del chat abierto al mandar');
});

test('4. abajo de la caja se dice con qué va (en Automático, nada)', async () => {
  const { estadoDelCliente } = await import('../app/second-brain/PiezasCliente');
  assert.equal(estadoDelCliente({ faltaMic: null, armandoOffer: false, resumenIA: 'Con tu computadora (Oficina) · Opus' } as never), 'Con tu computadora (Oficina) · Opus');
  assert.equal(estadoDelCliente({ faltaMic: null, armandoOffer: false, resumenIA: null } as never), '');
  assert.equal(estadoDelCliente({ faltaMic: 'Sin micrófono', armandoOffer: false, resumenIA: 'Con tu Claude' } as never), 'Sin micrófono', 'lo del micrófono primero');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 4/0):
//   · el selector sin «Automático»                     → 3/1 (1)
//   · el selector aparece sin cuentas del servidor     → 3/1 (1)
//   · lo elegido no es por chat                        → 3/1 (2)
//   · el nuevo no se lo lleva                          → 3/1 (2)
//   · la nota de voz sin la elección                   → 3/1 (3)
//   · abajo no dice con qué va                         → 3/1 (4)
