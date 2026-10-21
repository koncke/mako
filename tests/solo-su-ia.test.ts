// =============================================================================
// D6b: un negocio con su Claude o su GPT corre su Ops Center sin Gemini ni ninguna IA o red gratis (21/10/2026)
// =============================================================================
// Martín (D6b): «un negocio con su Claude o su GPT corre su Ops Center con su cuenta, y Gemini no participa». La revisión
// del Cerebro del 21/10 encontró la primera versión cortándolo sólo en la respuesta del modelo, por PERSONA y fallando
// abierta: El Archivero, la foto, la nota de voz, los pedidos del Second Brain y el turno de un closer seguían yendo a la
// cascada barata. Lo que fija este archivo:
//   1. EL CORTE ES ABAJO DE TODO: cada entrada de la cascada barata (texto, herramientas, documentos, visión, audio y las
//      preguntas de «¿hay IA?»), corrida DE VERDAD dentro de `conSoloSuIA`, no sale a ningún proveedor gratis ni lee
//      sus keys; fuera, sí (el control: si no, la prueba no vería nada) — tests/_solo-su-ia-hijo.ts;
//   2. LA DECISIÓN ES POR NEGOCIO Y FALLA CERRADA: la PC de otra persona del negocio cuenta, su Claude y su OpenAI
//      cuentan, Gemini no; una base que no contesta es «sí»; la plataforma misma, no;
//   3. LO PRENDEN LOS CAMINOS DEL OPS CENTER: el turno (con El Archivero y la lectura de los archivos adentro), los
//      pedidos del Second Brain y la nota de voz.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, arnés del scratchpad `romper-revision.mjs`, una rotura por vez, restaurada y comprobada
// con sha256; base 5 / 0). Diez roturas, todas con su rojo: sacar el corte de `provDe`, de la red de la plataforma o del
// orden por cuota → cada una 3 / 2; fallar abierta · decidir por persona · el turno fuera del contexto · los pedidos sin
// el contexto · la voz sin `pii` · El Archivero sin preguntar · los pedidos con la clave cruda → cada una 4 / 1. Y
// después del merge de main, cuando el turno pasó a `entrarSoloSuIA` (sin re-indentarlo): el turno sin prenderlo, y el
// contexto como un indicador global que se escapa → cada una 4 / 1. Restaurado: 5 / 0. Y antes del corte en `ordenarPorCuota`, el hijo mostró la fuga que el corte obvio dejaba (§2 de la
// entrada de docs/hallazgos-ia.md del 21/10).
//
// Correr: npx tsx --test tests/solo-su-ia.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conSoloSuIA, entrarSoloSuIA, proveedorPermitido, soloSuIA } from '../lib/solo-su-ia';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

type Corrida = Record<string, { red: string[]; keys: string[]; valor?: unknown }>;
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_solo-su-ia-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  control: Corrida; conSuIA: Corrida; negocio: Record<string, { suIA: boolean; conPc: boolean }>; error?: string;
};

const GRATIS = /generativelanguage\.googleapis\.com|api\.groq\.com|api\.mistral\.ai|openrouter\.ai|api\.cerebras\.ai/;
const KEY_GRATIS = /(GEMINI|GROQ|MISTRAL|OPENROUTER|CEREBRAS)_API_KEY/;

test('el control: fuera de «sólo su IA», la cascada sí sale a Gemini y a Groq (si no, la prueba no ve nada)', () => {
  assert.equal(R.error, undefined, R.error);
  const todo = Object.values(R.control).flatMap((c) => c.red);
  assert.ok(todo.includes('generativelanguage.googleapis.com'), 'el control no llegó a Gemini');
  assert.ok(todo.includes('api.groq.com'), 'el control no llegó a Groq');
  assert.ok(Object.values(R.control).some((c) => c.keys.some((k) => /eq\.9 /.test(k))), 'el control no miró la red de la plataforma');
});

test('con su IA, NINGUNA entrada de la cascada barata sale a un proveedor gratis ni lee sus keys', () => {
  assert.ok(Object.keys(R.conSuIA).length >= 12, 'se recorren todas las entradas');
  for (const [entrada, c] of Object.entries(R.conSuIA)) {
    // Rota: sacar el corte de `provDe` o de `ordenarPorCuota` → este test falla.
    assert.deepEqual(c.red.filter((h) => GRATIS.test(h)), [], `${entrada} salió a un proveedor gratis`);
    assert.deepEqual(c.keys.filter((k) => KEY_GRATIS.test(k)), [], `${entrada} leyó una key gratis`);
    // Rota: sacar el corte de `provsGratisDePlataforma` → este test falla (las de la plataforma son del ws9).
    assert.deepEqual(c.keys.filter((k) => /eq\.9 /.test(k)), [], `${entrada} miró la red de la plataforma`);
    assert.deepEqual(c.red.filter((h) => h !== 'api.openai.com' && h !== 'api.anthropic.com'), [], `${entrada}: sólo su OpenAI o su Claude`);
  }
  // Su GPT sí: con su OpenAI cargada, la cascada la usa.
  assert.ok(R.conSuIA.chatCheapCascade.red.includes('api.openai.com'), 'su OpenAI sí');
  assert.equal(R.conSuIA.provsDe.valor, 0);
  assert.equal(R.conSuIA.provsGratisDePlataforma.valor, 0);
});

test('la decisión es por NEGOCIO, falla CERRADA, y la plataforma queda afuera', () => {
  const n = R.negocio;
  assert.deepEqual(n.soloGratis, { suIA: false, conPc: false }, 'una key de Gemini no es «su IA»');
  // Rota: decidir por persona (sin `negocioConPc`) → este test falla.
  assert.deepEqual(n.conPcDeOtra, { suIA: true, conPc: true }, 'la PC de otra persona del negocio cuenta');
  assert.deepEqual(n.pcDesconectada, { suIA: false, conPc: false }, 'una PC desconectada no');
  assert.equal(n.conSuOpenAI.suIA, true);
  assert.equal(n.conSuClaude.suIA, true);
  // Rota: devolver «no» cuando no pudo leer → este test falla.
  assert.equal(n.fallaLaPc.suIA, true, 'no pude leer las PC: como si tuviera su IA');
  assert.equal(n.fallanLasClaves.suIA, true, 'no pude leer las claves: como si tuviera su IA');
  assert.deepEqual(n.plataforma, { suIA: false, conPc: false }, 'la plataforma no es un cliente con su IA');
});

test('el contexto: prendido sólo adentro, y con su OpenAI y nada más', async () => {
  assert.equal(soloSuIA(), false);
  assert.equal(proveedorPermitido('gemini', false), true, 'fuera, como siempre');
  await conSoloSuIA(true, async () => {
    assert.equal(soloSuIA(), true);
    assert.equal(proveedorPermitido('gemini', false), false);
    assert.equal(proveedorPermitido('groq', false), false);
    assert.equal(proveedorPermitido('openai', false), true);
    assert.equal(proveedorPermitido('openai', true), false, 'nunca con la key de la plataforma');
    // Lo que corre después (como `after()`): sigue adentro.
    await new Promise((ok) => setTimeout(ok, 1));
    assert.equal(soloSuIA(), true);
  });
  assert.equal(soloSuIA(), false, 'no se escapa a lo que sigue');
  await conSoloSuIA(false, async () => assert.equal(soloSuIA(), false));
  // `entrarSoloSuIA` (el turno, sin re-indentarlo): prende el resto de ESA función async y lo que lance, y no se escapa
  // a quien la llamó ni al pedido siguiente. Rota: que se escape → este test falla (el próximo negocio quedaría sin Gemini).
  const turno = async () => {
    await new Promise((ok) => setTimeout(ok, 1));
    entrarSoloSuIA(true);
    const adentro = soloSuIA();
    const enUnTimer = await new Promise<boolean>((ok) => setTimeout(() => ok(soloSuIA()), 1));
    return { adentro, enUnTimer };
  };
  assert.deepEqual(await turno(), { adentro: true, enUnTimer: true });
  assert.equal(soloSuIA(), false, 'quien llamó sigue sin el contexto');
  assert.equal(await (async () => { await new Promise((ok) => setTimeout(ok, 1)); return soloSuIA(); })(), false, 'el pedido siguiente, tampoco');
});

test('lo prenden los caminos del Ops Center: el turno (con El Archivero y los archivos adentro), los pedidos y la voz', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  // Rota: decidir por persona otra vez (`soloSuIA: !!pc || …`), o no prender el contexto → este test falla.
  assert.match(t, /const negocio = await negocioConSuIA\(ws\);\s*entrarSoloSuIA\(negocio\.suIA\);/);
  const dentro = t.slice(t.indexOf('entrarSoloSuIA(negocio.suIA)'));
  for (const paso of ['archivoATexto(', 'archivarPdfsDelChat(', 'archivarPegadosDelChat(', 'chatClaudeTools(']) {
    assert.ok(dentro.includes(paso), `${paso} corre adentro de «sólo su IA»`);
  }
  assert.match(dentro, /soloSuIA: negocio\.suIA/);
  assert.match(dentro, /if \(negocio\.suIA && !\(await puedeArchivarConSuIA\(\)\)\) avisos\.push\(AVISO_SIN_ARCHIVERO\);/, 'sin con qué, El Archivero no corre y se dice');
  const pedidos = sinComentarios(leer('app/api/mako/pedidos/route.ts'));
  assert.match(pedidos, /conSoloSuIA\(negocio\.suIA, \(\) => interpretarMensaje\(texto, ctx\)\)/);
  assert.match(pedidos, /taparClaves\(body\.texto\)\.texto/, 'una clave pegada se tapa también acá (pieza 1.6)');
  const voz = sinComentarios(leer('app/api/plan-dictado/route.ts'));
  assert.match(voz, /conSoloSuIA\(negocio\.suIA,/);
  assert.match(voz, /pii: true/, 'una nota de voz no va a la red gratis');
  // Y el corte vive abajo: en `provDe`, en la red de la plataforma, y en el orden por cuota.
  const ai = sinComentarios(leer('lib/ai-cheap.ts'));
  assert.match(ai, /async function provDe\([^)]*\): Promise<Prov \| null> \{\s*if \(!proveedorPermitido\(nombre, wsKey != null\)\) return null;/);
  const red = ai.slice(ai.indexOf('export async function provsGratisDePlataforma('));
  assert.ok(red.indexOf('if (soloSuIA()) return [];') > 0 && red.indexOf('if (soloSuIA()) return [];') < red.indexOf('wsSuperAdmin'), 'la red de la plataforma corta antes de leer nada');
  assert.match(sinComentarios(leer('lib/ia-cuotas.ts')), /export async function ordenarPorCuota\(orden: string\[\]\): Promise<string\[\]> \{\s*if \(soloSuIA\(\)\) return orden\.filter/);
});
