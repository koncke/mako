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
//   2. LA DECISIÓN ES POR NEGOCIO Y FALLA CERRADA: la PC de otra persona del negocio cuenta, su Claude, su OpenAI y su
//      Gemini cuentan (IA16, 22/10/2026: «Cada usuario debe poder pagar su token, su propia IA de gemini»), una copia de
//      la de la plataforma y Groq no; una base que no contesta es «sí»; la plataforma misma, no;
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

// Lo que no es su IA (IA16: su Gemini sí lo es).
const GRATIS = /api\.groq\.com|api\.mistral\.ai|openrouter\.ai|api\.cerebras\.ai/;
const KEY_GRATIS = /(GROQ|MISTRAL|OPENROUTER|CEREBRAS)_API_KEY/;

test('el control: fuera de «sólo su IA», la cascada sí sale a Gemini y a Groq (si no, la prueba no ve nada)', () => {
  assert.equal(R.error, undefined, R.error);
  const todo = Object.values(R.control).flatMap((c) => c.red);
  assert.ok(todo.includes('generativelanguage.googleapis.com'), 'el control no llegó a Gemini');
  assert.ok(todo.includes('api.groq.com'), 'el control no llegó a Groq');
  // IA16: la red de la plataforma no corre para ningún negocio, ni fuera de «sólo su IA».
  assert.equal(R.control.provsGratisDePlataforma.valor, 0, 'la red de la plataforma corrió para un negocio');
});

test('con su IA, NINGUNA entrada sale a lo que no es su IA (Groq, Mistral, OpenRouter, Cerebras, la plataforma) ni lee sus keys', () => {
  assert.ok(Object.keys(R.conSuIA).length >= 12, 'se recorren todas las entradas');
  for (const [entrada, c] of Object.entries(R.conSuIA)) {
    // Rota: sacar el corte de `provDe` o de `ordenarPorCuota` → este test falla.
    assert.deepEqual(c.red.filter((h) => GRATIS.test(h)), [], `${entrada} salió a un proveedor gratis`);
    assert.deepEqual(c.keys.filter((k) => KEY_GRATIS.test(k)), [], `${entrada} leyó una key gratis`);
    // Rota: sacar el corte de `provsGratisDePlataforma` → este test falla (las de la plataforma son del ws9).
    assert.deepEqual(c.keys.filter((k) => /eq\.9 /.test(k)), [], `${entrada} miró la red de la plataforma`);
    assert.deepEqual(c.red.filter((h) => h !== 'api.openai.com' && h !== 'api.anthropic.com' && h !== 'generativelanguage.googleapis.com'), [], `${entrada}: sólo su OpenAI, su Gemini o su Claude`);
  }
  // Su GPT y su Gemini sí: con sus claves cargadas, la cascada las usa.
  assert.ok(R.conSuIA.chatCheapCascade.red.includes('api.openai.com'), 'su OpenAI sí');
  assert.ok(R.conSuIA.chatCheapCascade.red.includes('generativelanguage.googleapis.com'), 'su Gemini sí (IA16)');
  // De [gemini, groq, mistral, openrouter, cerebras], sólo su Gemini.
  assert.equal(R.conSuIA.provsDe.valor, 1);
  assert.equal(R.conSuIA.provsGratisDePlataforma.valor, 0);
});

test('la decisión es por NEGOCIO, falla CERRADA, y la plataforma queda afuera', () => {
  const n = R.negocio;
  assert.deepEqual(n.soloGroq, { suIA: false, conPc: false }, 'una key de Groq no es «su IA» (sólo escucha)');
  // IA16: su Gemini sí; una copia de la de la plataforma, no.
  assert.deepEqual(n.conSuGemini, { suIA: true, conPc: false }, 'su Gemini es su IA');
  assert.deepEqual(n.conCopiaDeGemini, { suIA: false, conPc: false }, 'una copia de la Gemini de la plataforma no es su IA');
  // Rota: decidir por persona (sin `negocioConPc`) → este test falla.
  // Rota: contar una PC sin `activa_at` → este test falla (una instalación abandonada en «¿es tu negocio?» pasaba todo el
  // negocio a «sólo su IA», y nadie tenía con qué contestar: segunda revisión del Cerebro, 21/10/2026).
  assert.deepEqual(n.conPcPendiente, { suIA: false, conPc: false }, 'una PC pendiente (sin el «sí») no cuenta');
  assert.deepEqual(n.conPcSinLatido, { suIA: false, conPc: false }, 'confirmada sin un latido con sesión, tampoco');
  assert.deepEqual(n.conPcDeOtra, { suIA: true, conPc: true }, 'la PC activa de otra persona del negocio cuenta');
  assert.deepEqual(n.pcDesconectada, { suIA: false, conPc: false }, 'una PC desconectada no');
  assert.equal(n.conSuOpenAI.suIA, true);
  assert.equal(n.conSuClaude.suIA, true);
  // Rota: devolver «no» cuando no pudo leer → este test falla.
  assert.equal(n.fallaLaPc.suIA, true, 'no pude leer las PC: como si tuviera su IA');
  assert.equal(n.fallanLasClaves.suIA, true, 'no pude leer las claves: como si tuviera su IA');
  assert.deepEqual(n.plataforma, { suIA: false, conPc: false }, 'la plataforma no es un cliente con su IA');
});

test('el contexto: prendido sólo adentro, y con su OpenAI y su Gemini y nada más', async () => {
  assert.equal(soloSuIA(), false);
  assert.equal(proveedorPermitido('gemini', false), true, 'fuera, como siempre');
  await conSoloSuIA(true, async () => {
    assert.equal(soloSuIA(), true);
    assert.equal(proveedorPermitido('gemini', false), true, 'su Gemini (IA16)');
    assert.equal(proveedorPermitido('gemini', true), false, 'nunca la Gemini de la plataforma');
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
  // Se decide ANTES del corte (el aviso del corte dice si quedó en El Archivero, 22/10/2026), y los PDF solos, después.
  assert.match(dentro, /const archiva = !paraArchivar\.length \? 'no' : negocio\.suIA \? await puedeArchivarConSuIA\(\) : 'si';/);
  assert.match(dentro, /const puede = paraArchivar\.length \? archiva : negocio\.suIA \? await puedeArchivarConSuIA\(\) : 'si';\s*if \(puede !== 'si'\) avisos\.push\(/, 'sin con qué, El Archivero no corre y se dice');
  const pedidos = sinComentarios(leer('app/api/mako/pedidos/route.ts'));
  assert.match(pedidos, /conSoloSuIA\(negocio\.suIA, \(\) => interpretarMensaje\(texto, ctx\)\)/);
  assert.match(pedidos, /taparClaves\(body\.texto\)\.texto/, 'una clave pegada se tapa también acá (pieza 1.6)');
  const voz = sinComentarios(leer('app/api/plan-dictado/route.ts'));
  assert.match(voz, /conSoloSuIA\(negocio\.suIA,/);
  assert.match(voz, /pii: true/, 'una nota de voz no va a la red gratis');
  // Y el corte vive abajo: en `provDe`, en la red de la plataforma, y en el orden por cuota.
  const ai = sinComentarios(leer('lib/ai-cheap.ts'));
  // IA8: antes del corte de D6b va el de los proveedores sacados; los dos devuelven null antes de leer ninguna key.
  assert.match(ai, /async function provDe\([^)]*\): Promise<Prov \| null> \{\s*if \(PROVS_SACADOS\.includes\(nombre\)\) return null;\s*if \(!proveedorPermitido\(nombre, wsKey != null\)\) return null;/);
  const red = ai.slice(ai.indexOf('export async function provsGratisDePlataforma('));
  assert.ok(red.indexOf('if (soloSuIA()) return [];') > 0 && red.indexOf('if (soloSuIA()) return [];') < red.indexOf('wsSuperAdmin'), 'la red de la plataforma corta antes de leer nada');
  // IA16: en el orden de su IA (su GPT antes que su Gemini), no en el de la lista.
  assert.match(sinComentarios(leer('lib/ia-cuotas.ts')), /export async function ordenarPorCuota\(orden: string\[\]\): Promise<string\[\]> \{\s*if \(soloSuIA\(\)\) return PROVS_SU_IA\.filter\(\(p\) => orden\.includes\(p\)\);/);
});

test('Image «sin Gemini» (`deSuIA`): ni con «sólo su IA» ni sin ella sale a Gemini; su GPT sí', () => {
  // 5/11/2026 (Martín, 22/10: Image «sin Gemini»). Corre la cascada con `sinGemini` y el chat de Image ENTERO (chatClaude con
  // `image-editor-ia`: la marca la pone el catálogo). Probado rompiéndolo (base 6/0): sin el filtro de `sinGemini` en
  // lib/ai-cheap.ts, 5/1; con image-editor-ia otra vez en GEMINI() sin `deSuIA`, 5/1 («chatClaudeImagen (control) salió a Gemini»).
  for (const modo of ['control', 'conSuIA'] as const) {
    for (const entrada of ['chatCheapCascadeSinGemini', 'chatClaudeImagen']) {
      const c = R[modo][entrada];
      assert.ok(c, `${entrada} no corrió (${modo})`);
      assert.ok(!c.red.includes('generativelanguage.googleapis.com'), `${entrada} (${modo}) salió a Gemini: ${c.red.join(', ')}`);
      assert.ok(c.red.includes('api.openai.com'), `${entrada} (${modo}) no probó su GPT: ${c.red.join(', ') || 'ningún pedido'}`);
    }
  }
});
