// =============================================================================
// WA2 (22/10/2026): MaKo en WhatsApp tapa las claves pegadas en el grupo
// =============================================================================
// La pieza 1.6 tapaba las claves en el chat de la app; en el grupo no (docs/ia-del-cliente.md §13), y desde el 22/10 se
// les pide a los clientes su clave de API. Lo que fija este test:
//   1. Las reglas (lib/doer-claves.ts): se tapa todo lo que escribe una persona —texto, caption, la cita— y lo binario
//      (base64, miniaturas) no se toca; una copia, el original queda igual.
//   2. La entrada REAL del grupo (`manejarEntranteDoer`, tests/_doer-claves-hijo.ts): un mensaje que es sólo la clave avisa
//      con el link a su conexión y no se encola; uno con texto se encola tapado (el texto y el payload crudo), y nada sale a
//      una IA. La memoria (`mako_doer_conv`) y el turno salen de esa cola.
//   3. Un .txt con una clave adentro también se tapa antes del modelo.
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · `manejarEntranteDoer` pasando el mensaje crudo → «la entrada real» en rojo;
//   · sin tapar adentro de los objetos (sólo el texto de arriba) → «se tapa todo lo que escribe» en rojo;
//   · tapando también el base64 → «lo binario no se toca» en rojo;
//   · sin el aviso al grupo → «la entrada real» en rojo;
//   · `soloLaClave` siempre falso (se encola «[clave tapada]») → «la entrada real» en rojo;
//   · el archivo leído sin tapar → «un .txt con una clave» en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoClaveTapadaEnElGrupo, soloLaClave, taparClavesDelMensaje } from '../lib/doer-claves';
import { CLAVE_TAPADA } from '../lib/claves-en-el-chat';

const RAIZ = join(__dirname, '..');
const CLAUDE = `sk-ant-api03-${'A1b2C3d4'.repeat(11)}AA`;
const OPENAI = `sk-proj-${'T3BlbkFJ'.repeat(4)}${'x9Y8z7W6'.repeat(5)}`;
/** Líneas `//` primero y bloques después (AGENTS.md). */
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('se tapa todo lo que escribe una persona: el texto, el caption y el mensaje citado', () => {
  const m = {
    key: { remoteJid: 'x@g.us', id: '1' },
    message: {
      extendedTextMessage: { text: `mi clave ${OPENAI}`, contextInfo: { quotedMessage: { conversation: `la otra: ${CLAUDE}` } } },
      documentMessage: { caption: `claves.txt ${CLAUDE}`, fileName: 'claves.txt' },
    },
  };
  const r = taparClavesDelMensaje(m);
  assert.equal(r.tapadas, 3);
  assert.equal(r.servicio, 'openai', 'el servicio de la primera que reconoció, para el link');
  const json = JSON.stringify(r.mensaje);
  assert.ok(!json.includes(OPENAI) && !json.includes(CLAUDE), 'ninguna clave en ningún campo');
  assert.equal((r.mensaje.message.extendedTextMessage as { text: string }).text, `mi clave ${CLAVE_TAPADA}`);
  assert.ok(JSON.stringify(m).includes(CLAUDE), 'una copia: el original no se toca');
  // Sin claves, el mismo objeto y 0.
  const limpio = { message: { conversation: 'Hola MaKo, ¿cuántos leads entraron hoy? sk-proj-lanzamiento-verano-2026' } };
  assert.deepEqual(taparClavesDelMensaje(limpio), { mensaje: limpio, tapadas: 0, servicio: null });
});

test('lo binario no se toca: tapar un pedazo de base64 rompe la imagen', () => {
  // Con un `/` antes, como en un base64 de verdad: sin un borde de palabra, ninguna regla mordería y la prueba no vería nada.
  const b64 = `iVBORw0KGgo/${CLAUDE}+AAAA`;
  const r = taparClavesDelMensaje({ message: { imageMessage: { base64: b64, jpegThumbnail: b64, caption: `foto ${CLAUDE}` } } });
  const img = r.mensaje.message.imageMessage as { base64: string; jpegThumbnail: string; caption: string };
  assert.equal(img.base64, b64);
  assert.equal(img.jpegThumbnail, b64);
  assert.equal(img.caption, `foto ${CLAVE_TAPADA}`);
});

test('el aviso: no promete que no quedó (sigue en el grupo), pide borrarla y trae el link', () => {
  const a = avisoClaveTapadaEnElGrupo('https://hola-mako.com/integraciones?abrir=anthropic&ws=3');
  assert.match(a, /Bórrala del grupo/);
  assert.match(a, /https:\/\/hola-mako\.com\/integraciones\?abrir=anthropic/);
  assert.doesNotMatch(a, /no quedó en el chat/);
  assert.equal(soloLaClave(`  ${CLAVE_TAPADA} `), true);
  assert.equal(soloLaClave(`mi clave ${CLAVE_TAPADA}`), false);
});

test('la entrada real del grupo: sólo la clave avisa y no se encola; con texto se encola tapada, y nada va a una IA', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_doer-claves-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const r = JSON.parse(salida.split('@@RESULTADO@@').pop() ?? '{}');
  assert.equal(r.error, undefined, r.error);
  const { CLAUDE: c, OPENAI: o } = r.claves as { CLAUDE: string; OPENAI: string };
  // 1) Sólo la clave.
  assert.equal(r.colaTrasSoloClave, 0, 'el mensaje que era sólo la clave no se encola');
  const enviados = (r.redSoloClave as Array<{ camino: string; cuerpo: string }>).filter((x) => x.camino.includes('/message/sendText/'));
  assert.equal(enviados.length, 1, 'el aviso sale al grupo');
  assert.match(enviados[0].cuerpo, /Tapé tu clave/);
  assert.match(enviados[0].cuerpo, /\/integraciones\?abrir=anthropic/);
  // 2) Texto con claves (y una en la cita): se encola tapado, el texto y el payload.
  const cola = r.cola as Array<{ texto: string; payload: string }>;
  assert.equal(cola.length, 1);
  assert.equal(cola[0].texto, `Hola MaKo, esta es mi clave de OpenAI ${CLAVE_TAPADA} ¿la cargás?`);
  assert.ok(!cola[0].payload.includes(c) && !cola[0].payload.includes(o), 'el payload crudo de la cola, tapado (también la cita)');
  assert.match((r.redMixto as Array<{ cuerpo: string }>).map((x) => x.cuerpo).join('\n'), /\/integraciones\?abrir=openai/);
  // 3) Nada salió a una IA, y ninguna clave salió a ningún lado.
  const todo = [...(r.redSoloClave as Array<{ host: string; cuerpo: string }>), ...(r.redMixto as Array<{ host: string; cuerpo: string }>)];
  assert.deepEqual([...new Set(todo.map((x) => x.host))], ['evolution.test']);
  for (const x of todo) assert.ok(!x.cuerpo.includes(c) && !x.cuerpo.includes(o), `ninguna clave en lo que sale: ${x.cuerpo.slice(0, 80)}`);
});

test('un .txt con una clave adentro también se tapa antes del modelo', () => {
  const doer = sinComentarios(readFileSync(join(RAIZ, 'lib/mako-doer-in.ts'), 'utf8'));
  assert.match(doer, /const contenido = taparClaves\(\(lect\.texto \|\| ''\)\.trim\(\)\)\.texto;/);
  // Y la entrada tapa ANTES de todo: el crudo no llega a `bufferearYResponder`.
  assert.match(doer, /const tapado = taparClavesDelMensaje\(data\);\s*return runWithWorkspace\(wsData, \(\) => bufferearYResponder\(wsData, instance, tapado\.mensaje, tapado\)\);/);
});
