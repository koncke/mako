// =============================================================================
// La PC por IA: su Claude o su ChatGPT (la ola 3, parte a: el servidor, 23/10/2026)
// =============================================================================
// Martín, mirando «Tus cuentas de IA» → ChatGPT: «Y el tema de GPT sigue diciendo "Pronto" en mi computadora...». Antes de
// que el programa de la PC corra Codex, el servidor tiene que poder elegir la PC POR IA: una PC con sólo su ChatGPT no
// puede recibir un turno de Claude (ni al revés). Todo con 'claude' por defecto: lo de hoy no cambia.
//
// Correr: node --import tsx --test tests/ia-pc-proveedor.test.ts
// PROBADO ROMPIÉNDOLO, ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AVISO_PC_ERROR, AVISO_PC_SIN_CLAUDE, AVISO_PC_TARDE, CONSENTIMIENTO_DE, TEXTO_CONSENTIMIENTO, VERSION_CONSENTIMIENTO, avisoDeLaPc, cuentasDeLaIA,
  elegirPc, iaDelConsentimiento, modeloDelTurno, pcUsable,
} from '../lib/ia-pc-reglas';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const ahora = new Date().toISOString();
const pc = (id: number, cuentas: unknown[], enLinea = true) => ({ id, enLinea, cuentas, ultimoLatido: ahora, conectadaAt: ahora });

test('1. una PC sirve para la IA de la que tiene una cuenta con sesión; sin proveedor, es Claude (como hoy)', () => {
  const claude = pc(1, [{ proveedor: 'claude' }]);
  const chatgpt = pc(2, [{ proveedor: 'chatgpt' }]);
  assert.equal(pcUsable(claude), true, 'lo de hoy: una PC con su Claude');
  assert.equal(pcUsable(claude, 'chatgpt'), false, 'una PC con sólo su Claude recibiría un turno de ChatGPT');
  assert.equal(pcUsable(chatgpt), false, 'una PC con sólo su ChatGPT recibiría un turno de Claude');
  assert.equal(pcUsable(chatgpt, 'chatgpt'), true);
  assert.equal(pcUsable(pc(3, [{}])), true, 'una cuenta sin proveedor (de antes) es de Claude');
  assert.equal(pcUsable(pc(4, [{ proveedor: 'chatgpt' }], false), 'chatgpt'), false, 'apagada no sirve');
  assert.deepEqual(cuentasDeLaIA([{ proveedor: 'claude', n: 1 }, { proveedor: 'chatgpt', n: 2 }, { n: 3 }], 'claude').map((c) => c.n), [1, 3]);
});

test('2. a qué PC va el turno: por IA; y sin `proveedor`, la de Claude (pasar pcUsable suelto a .filter lo rompía)', () => {
  const claude = pc(10, [{ proveedor: 'claude' }]);
  const chatgpt = pc(11, [{ proveedor: 'chatgpt' }]);
  const sinTurnos = new Map<number, { at: string; ok: boolean }>();
  assert.equal(elegirPc([chatgpt, claude], sinTurnos)?.id, 10);
  assert.equal(elegirPc([claude, chatgpt], sinTurnos, 'chatgpt')?.id, 11);
  // Una PC con las DOS IA y su Claude agotado: su ChatGPT con lugar no la deja «sana» para un turno de Claude (aunque sea la
  // del último turno), y su Claude agotado no la saca de los de ChatGPT.
  const ambas = pc(12, [{ proveedor: 'claude', usado5h: 100 }, { proveedor: 'chatgpt', usado5h: 10 }]);
  const otra = pc(13, [{ proveedor: 'claude', usado5h: 10 }, { proveedor: 'chatgpt', usado5h: 10 }]);
  const ultimo = new Map([[12, { at: ahora, ok: true }]]);
  assert.equal(elegirPc([otra, ambas], ultimo)?.id, 13, 'el ChatGPT con lugar tapó al Claude agotado');
  assert.equal(elegirPc([otra, ambas], ultimo, 'chatgpt')?.id, 12, 'el Claude agotado sacó a la PC de los turnos de ChatGPT');
});

test('3. el modelo del turno: con Claude, el de su lista; con ChatGPT, ninguno (Codex usa el suyo)', () => {
  assert.equal(modeloDelTurno('claude', 'opus'), 'opus');
  assert.equal(modeloDelTurno(undefined, 'gpt-5'), 'sonnet', 'sin proveedor es Claude, y un modelo ajeno cae al de siempre');
  assert.equal(modeloDelTurno('chatgpt', 'opus'), undefined);
});

test('4. los avisos dicen la IA de la PC; los de Claude, idénticos', () => {
  assert.equal(avisoDeLaPc('tarde', false), AVISO_PC_TARDE);
  assert.equal(avisoDeLaPc('tarde', false, { ia: 'claude' }), AVISO_PC_TARDE);
  assert.equal(avisoDeLaPc('tarde', false, { ia: 'chatgpt' }), 'Tu ChatGPT tardó demasiado: mándamelo de nuevo.');
  assert.equal(avisoDeLaPc('error', false, { ia: 'chatgpt' }), AVISO_PC_ERROR.replace('Tu Claude', 'Tu ChatGPT'));
  assert.match(avisoDeLaPc('sin-claude', false, { ia: 'chatgpt' })!, /no tiene Codex instalado/);
  assert.equal(avisoDeLaPc('sin-claude', false), AVISO_PC_SIN_CLAUDE);
  assert.match(avisoDeLaPc('tope', false, { ia: 'chatgpt', tz: 'UTC' })!, /^Tu ChatGPT llegó a su límite/);
  assert.doesNotMatch(avisoDeLaPc('sesion', false, { ia: 'chatgpt' })!, /Claude/);
});

test('5. el servidor: el turno lleva la IA, la ruta no le cambia nada a un turno de Claude, y el turno de la app elige por IA', () => {
  const ruta = sinComentarios(leer('app/api/ia-pc/turno/route.ts'));
  assert.match(ruta, /const proveedor = t\.pedido\.proveedor === 'chatgpt' \? 'chatgpt' : 'claude';/);
  assert.match(ruta, /\.\.\.\(proveedor !== 'claude' \? \{ proveedor \} : \{\}\)/, 'un turno de Claude saldría con `proveedor`');
  const pcTs = sinComentarios(leer('lib/ia-pc.ts'));
  assert.match(pcTs, /export async function pcDe\(ws: number, persona: string, proveedor: ProveedorPc = 'claude'\)/);
  assert.match(pcTs, /const elegida = elegirPc\(pcs, ultimoTurno, proveedor\);/);
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(turno, /let iaDeLaPc: ProveedorPc = \(ia && IA_DE_LA_PC\[ia\.cuenta\]\) \?\? 'claude';/);
  assert.match(turno, /pcDe\(ws, persona\.actor, cual\)/);
  // Con la persona adentro (la guarda del 23/10, tests/ia-pc-nunca-a-leads.test.ts → 4).
  assert.match(turno, /let leidaPc = adentro \? await leerPc\(iaDeLaPc\) : \{ d: null, error: null \};/);
  // En Automático, la PC que no puede con su Claude y sí con su ChatGPT contesta con su ChatGPT; sin PC, ni la busca.
  assert.match(turno, /if \(!ia && leidaPc\.d && !pcUsable\(leidaPc\.d, 'claude'\)\) \{\s*const conChatGpt = await leerPc\('chatgpt'\);\s*if \(pcUsable\(conChatGpt\.d, 'chatgpt'\)\) \{ leidaPc = conChatGpt; iaDeLaPc = 'chatgpt'; \}/,
    'a quien conectó sólo su ChatGPT, Automático le decía «tu Claude no tiene la sesión iniciada»');
  assert.match(turno, /const pcPuede = pcUsable\(pc, iaDeLaPc\);/);
  assert.match(turno, /\.\.\.\(iaDeLaPc === 'chatgpt' \? \{ proveedor: 'chatgpt' as const \} : \{\}\)/);
  assert.match(turno, /falloDeLaPc !== 'muchos' && !eligioLaPc\) \{/, 'con su computadora elegida, cae a las claves');
  assert.match(turno, /avisoDeLaPc\(falloDeLaPc, false, \{ repone: reponeDeLaPc, tz: tzAviso, ia: iaDeLaPc \}\)/);
});

test('6. lo que se acepta: el de ChatGPT dice ChatGPT y su versión dice la IA; su ChatGPT no saca código hasta que lo prendan', () => {
  assert.deepEqual(CONSENTIMIENTO_DE.claude, { texto: TEXTO_CONSENTIMIENTO, version: VERSION_CONSENTIMIENTO }, 'cambió lo que acepta quien conecta su Claude');
  const gpt = CONSENTIMIENTO_DE.chatgpt.texto;
  assert.match(gpt, /^Tu ChatGPT corre en tu computadora, con tu cuenta/);
  assert.match(gpt, /nunca ve tu clave/);
  assert.doesNotMatch(gpt, /Claude/);
  assert.doesNotMatch(gpt, /\b(vos|pedís|tenés)\b/, 'de tú');
  assert.notEqual(CONSENTIMIENTO_DE.chatgpt.version, VERSION_CONSENTIMIENTO);
  for (const c of Object.values(CONSENTIMIENTO_DE)) assert.ok(c.version.length <= 40, 'la columna `consentimiento` (mig 0321) corta en 40');
  assert.equal(iaDelConsentimiento(VERSION_CONSENTIMIENTO), 'claude');
  assert.equal(iaDelConsentimiento(CONSENTIMIENTO_DE.chatgpt.version), 'chatgpt');
  assert.equal(iaDelConsentimiento('2026-10-20'), null, 'una versión vieja');
  assert.equal(iaDelConsentimiento(undefined), null);
  const ruta = sinComentarios(leer('app/api/ia-pc/codigo/route.ts'));
  const crear = ruta.indexOf('await crearCodigo(');
  assert.ok(ruta.indexOf('const ia = iaDelConsentimiento(body?.acepto);') > 0);
  const frena = ruta.indexOf("if (ia === 'chatgpt' && !CHATGPT_EN_LA_PC) return");
  assert.ok(frena > 0 && frena < crear, 'con la opción apagada, su ChatGPT sacaba un código para un programa que no lo corre');
  assert.match(sinComentarios(leer('lib/ia-pc.ts')), /if \(!iaDelConsentimiento\(consentimiento\)\) throw/);
});

test('7. el tutorial de su ChatGPT: su nombre, su programa y lo que se acepta; los respaldos con la terminal, sólo de Claude', () => {
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  const tut = ui.slice(ui.indexOf('function Tutorial('), ui.indexOf('const LogoIA'));
  assert.ok(tut.length > 1000);
  assert.match(tut, /const nombre = NOMBRE_IA\[ia\];\s*const programa = PROGRAMA_IA_PC\[ia\];\s*const conClaude = ia === 'claude';/);
  assert.match(tut, /body: JSON\.stringify\(\{ acepto: CONSENTIMIENTO_DE\[ia\]\.version \}\)/);
  assert.match(tut, /\{CONSENTIMIENTO_DE\[ia\]\.texto\}/);
  // Lista sólo con una cuenta de ESA IA; «falta el programa» sólo se sabe de Claude Code.
  assert.match(tut, /if \(nueva && cuentasDeLaIA\(nueva\.cuentas, ia\)\.length\) \{ setLista\(true\);/);
  assert.match(tut, /setSinSesion\(conClaude && nueva\.sinClaude \? 'claude' : 'sesion'\)/);
  // Ningún texto con «Claude» fijo fuera de lo que es sólo de Claude.
  const sinLoDeClaude = tut.replace(/\{conClaude && \([\s\S]*?\n\s*\)\}/g, '').replace(/conClaude \? '[^']*' : /g, '');
  for (const viejo of ['contestar con tu Claude', 'si no lo tienes, Claude Code', 'instala Claude Code si no', 'no tiene Claude Code:', 'tu Claude no tiene la sesión', 'contesta con tu Claude', 'iniciar la sesión de Claude', 'cuenta de Claude']) {
    assert.ok(!sinLoDeClaude.includes(viejo), `el tutorial de ChatGPT dice «${viejo}»`);
  }
  assert.doesNotMatch(sinLoDeClaude, /LOGIN_CLAUDE|COMANDO_CLAUDE/, 'un respaldo de Claude en el tutorial de ChatGPT');
  // Se abre con la IA que eligió, y «Nuevo dispositivo» con la de esa cuenta.
  assert.match(ui, /pasoInicial=\{pasoInicial\} ia=\{iaTutorial\} \/>/);
  assert.match(ui, /setIaTutorial\(ia\);/);
});

// PROBADO ROMPIÉNDOLO (23/10/2026) con este archivo, tests/ia-pc-varias.test.ts y tests/chat-ia.test.ts (base 14/0):
//   · pcUsable sin mirar el proveedor                          → 10/4 (1, 2; varias 2; chat-ia 2b)
//   · elegirPc con `.filter(pcUsable)` suelto                   → 11/3 (2; varias 2; chat-ia 2b)
//   · el ChatGPT con lugar tapa al Claude agotado               → 13/1 (2)
//   · modeloDelTurno le pasa un modelo a ChatGPT                → 13/1 (3)
//   · los avisos de ChatGPT dicen «Claude»                      → 13/1 (4)
//   · Automático no prueba su ChatGPT                           → 13/1 (5)
//   · se ofrece «Tu computadora · ChatGPT» sin su ChatGPT       → 12/2 (chat-ia 1, 2b)
//   · pcDe no elige por IA                                      → 11/3 (5; varias 2; chat-ia 2b)
//   · la ruta le manda `proveedor` a un turno de Claude         → 13/1 (5)
// La parte c (6 y 7), con tests/ia-pc-ola2, conectar-ia, ia-pc-instalador-040 e ia-pc-varias (base 23/0):
//   · la ruta no frena su ChatGPT con la opción apagada         → 22/1 (6)
//   · la puerta acepta sólo la versión de Claude                → 21/2 (6; ola2)
//   · lo que acepta quien conecta su ChatGPT dice Claude        → 22/1 (6)
//   · cualquier versión es de Claude                            → 22/1 (6)
//   · el tutorial pide el código con la versión de Claude       → 21/2 (7; ola2)
//   · «¡Listo!» con una cuenta de cualquier IA                  → 22/1 (7)
//   · el paso 1 dice «tu Claude» fijo                           → 22/1 (7)
//   · el respaldo del login de Claude, también con ChatGPT      → 22/1 (7)
//   · el tutorial siempre de Claude                             → 22/1 (7)
//   · «Mi computadora» de ChatGPT abre el de Claude             → 22/1 (conectar-ia)
