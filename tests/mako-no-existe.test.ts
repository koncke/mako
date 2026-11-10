// =============================================================================
// Lo que no existe en MaKo se dice, no se inventa, y el pedido sale solo a la Ticketera (ticket 874749710-14, 27/10/2026)
// =============================================================================
// Leandro: MaKo le inventó «un bloque de Instagram con tope de comentarios», y el pedido no le llegó a nadie. Lo que fija:
//   1. lo puro de lib/no-existe.ts: la marca `[[no-existe: …]]` sale del texto (nunca le llega a la persona), y lo que pidió
//      queda para el ticket. Desde el 27/10/2026 la idempotencia es la de todo ticket automático (lib/no-pude.ts, `refDeNoPude`:
//      negocio + conversación + causa; tests/no-pude.test.ts);
//   2. `conPedidoDeNoExiste` REAL contra una base de mentira (tests/_no-existe-hijo.ts): levanta UN pedido automático (con el
//      título del código y la superficie), repetirlo no levanta otro ni repite la línea, y una respuesta sin marca no escribe;
//   3. CADA chat de MaKo en la app lleva la regla en su system y procesa la marca: el Ops Center (también el teléfono, el CRM
//      y el MaKo Analyst del lead, que usan el mismo turno), Offer (y el onboarding), «Discutir» del Web Generator, los chats
//      del Image Editor y del Video Editor, y Automations (su `falta` sale sola, el botón queda de respaldo).
// Con el modelo real: scripts/probar-no-existe.mts (la cosecha, docs/hallazgos-ia.md, dice qué contestó).
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGLA_NO_EXISTE, lineaDelPedido, reglaNoExisteEn, sacarNoExiste } from '../lib/no-existe';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la marca sale del texto y queda lo que pidió (la primera), con o sin guion; sin marca, nada', () => {
  assert.deepEqual(sacarNoExiste('Listo, te lo cambié.'), { texto: 'Listo, te lo cambié.', falta: null });
  const r = sacarNoExiste('Eso todavía no existe en MaKo.\n\n[[no-existe: tope de comentarios en Instagram]]');
  assert.deepEqual(r, { texto: 'Eso todavía no existe en MaKo.', falta: 'tope de comentarios en Instagram' });
  assert.equal(sacarNoExiste('Todavía no.\n[[ No existe :  exportar a Excel ]]').falta, 'exportar a Excel');
  const dos = sacarNoExiste('No existe.\n[[no-existe: uno]]\n[[no-existe: otro pedido]]');
  assert.equal(dos.texto, 'No existe.', 'ninguna marca le llega a la persona');
  assert.equal(dos.falta, 'uno');
  assert.equal(sacarNoExiste('Nada.\n[[no-existe: ok]]').falta, null, 'una marca de dos letras no es un pedido');
  // La línea es la de todo ticket automático (27/10/2026): «Quedó el ticket #n».
  assert.equal(lineaDelPedido(42), 'Quedó el ticket #42 para el equipo de MaKo.');
});

test('1. la regla: dice que no se inventa, pide la marca, y la variante JSON la pone en el campo que lee la persona', () => {
  assert.match(REGLA_NO_EXISTE, /Nunca armes un camino con nombres que no viste/);
  assert.match(REGLA_NO_EXISTE, /\[\[no-existe: /);
  assert.match(REGLA_NO_EXISTE, /no le pidas que lo reporte ni le propongas un ticket/);
  assert.match(reglaNoExisteEn('resumen'), /termina el texto de "resumen" con una línea aparte/);
});

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_no-existe-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'],
});
type Res = { texto: string; falta: string | null; linea: string | null };
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  error?: string; r1: Res; r2: Res; r3: Res; tickets1: Array<{ tipo: string; titulo: string; canal: string; ref: string; ws: number; email: string }>; tickets2: number; tickets3: number;
};

test('2. una respuesta con la marca levanta UN pedido en la Ticketera, sin preguntar, y repetirla no levanta otro', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.equal(R.r1.texto, 'Eso todavía no existe en MaKo: el goteo es uno solo para todos los canales.');
  assert.match(String(R.r1.linea), /^Quedó el ticket #\d+ para el equipo de MaKo\.$/);
  assert.equal(R.tickets1.length, 1);
  // El título lo arma el CÓDIGO (lo del modelo va en la descripción), y la `ref` es la de un automático (lib/no-pude.ts).
  assert.deepEqual({ ...R.tickets1[0], ref: undefined }, { tipo: 'pedido', titulo: 'Pedido de algo que MaKo todavía no tiene, en el Ops Center', canal: 'chat_app', ref: undefined, ws: 13, email: 'dueno@negocio-de-prueba.com' });
  assert.match(R.tickets1[0].ref, /^np:13:ops-center:/);
  assert.equal(R.tickets2, 1, 'el mismo pedido levantó un segundo ticket');
  assert.equal(R.r2.linea, null, 'repetido en la misma conversación: la línea sale una vez');
});

test('2. sin marca, nada se escribe y el texto sigue igual', () => {
  assert.deepEqual(R.r3, { texto: 'Listo: te cambié el horario.', falta: null, linea: null });
  assert.equal(R.tickets3, 1);
});

test('3. CADA chat de MaKo en la app lleva la regla y procesa la marca (la persona nunca la ve)', () => {
  const app = fuente('lib/mako-turno-app.ts');
  assert.match(app, /const system = `\$\{base\}\\n\\n\$\{VOZ_APP\}\\n\\n\$\{REGLA_NO_EXISTE\}/, 'el Ops Center sin la regla');
  // Desde el 27/10/2026 el Ops Center procesa las DOS marcas (lib/no-pude-server.ts → `conTicketsDeMaKo`).
  assert.match(app, /const np = await conTicketsDeMaKo\(respuesta, \{/, 'el Ops Center no procesa la marca');
  assert.ok(app.indexOf('conTicketsDeMaKo(respuesta') < app.indexOf("await appendMessage(s.id, 'assistant', respuesta"), 'la marca se saca DESPUÉS de guardar');

  // El arranque no: no trae el catálogo de MaKo (la revisión del 27/10/2026, tests/no-existe-revision.test.ts).
  assert.match(fuente('lib/offer-ia.ts'), /\$\{p\.arranque \? '' : `\\n\\n\$\{reglaNoExisteEn\('respuesta'\)\}`\}`;/, 'Offer sin la regla');
  const offer = fuente('app/api/offer/route.ts');
  assert.match(offer, /await conPedidoDeNoExiste\(turnoIA\.respuesta, \{/);
  const iOffer = offer.indexOf('conPedidoDeNoExiste(turnoIA.respuesta');
  assert.ok(offer.indexOf('const final = await actualizarSesion(', iOffer) > iOffer, 'Offer guarda la respuesta con la marca');

  const web = fuente('lib/editor-landing/ia.ts');
  assert.match(web, /discutirSystem, \{ idioma: bloqueIdiomaDelTexto\(\) \}\)\}\\n\\n\$\{REGLA_NO_EXISTE\}`/, '«Discutir» sin la regla');
  assert.match(web, /conPedidoDeNoExisteDeLaSesion\(limpiarTextoDelModelo\(salida\)/);

  // El del video limpia antes el «no pude» de una propuesta armada (lib/editor-video/marcas-chat.ts, 9/11/2026: ese chat no
  // ejecuta nada); lo que hace `resumenParaTickets` lo prueba ejecutándolo tests/video-editor-respuesta-chat.test.ts.
  for (const [p, chat, resumen] of [
    ['lib/image-editor/chat/ia.ts', 'image-editor', 'raw\\.resumen'],
    ['lib/editor-video/ia.ts', 'video-editor', 'resumenParaTickets\\(raw\\.resumen, operaciones\\.length\\)'],
  ] as const) {
    const src = fuente(p);
    assert.match(src, /\\n\\n\$\{reglaNoExisteEn\('resumen'\)\}`;/, `${chat} sin la regla`);
    // La marca sale ANTES de quedarse con la primera línea: si no, una marca en la primera línea le llegaba a la persona.
    assert.match(src, new RegExp(`conPedidoDeNoExisteDeLaSesion\\(${resumen}, \\{ chat: '${chat}'`));
    assert.match(src, /const resumenModelo = ne \? \[ne\.texto\.trim\(\)\.split\('\\n'\)\[0\]/);
  }

  const aut = fuente('app/api/chat-agent/secuencias/ia/route.ts');
  assert.match(aut, /const id = sesion\?\.email \? await ticketDeNoExiste\(falta, \{/, 'Automations sigue esperando el botón');
  assert.match(aut, /if \(id\) \{ respuesta = `\$\{respuesta\.trim\(\)\}\\n\\n\$\{lineaDelPedido\(id\)\}`; falta = undefined; \}/);
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado de memoria:
//   1. `sacarNoExiste` dejando la marca en el texto                 → rojo «1. la marca sale…» y «2. una respuesta…».
//   3. el ticket sin `ref` (cada vez uno nuevo)                    → rojo «2.» (los dos).
//   4. el Ops Center sin la regla en el system                     → rojo «3.».
//   5. el Image Editor cortando la primera línea ANTES de sacar la marca → rojo «3.».
//   6. Automations esperando el botón (sin `ticketDeNoExiste`)    → rojo «3.».
// La primera corrida dio rojo SIN romper nada en dos: una marca de dos letras pasaba con el espacio del principio (`pedido.length
// >= 3` después de recortar), y el ancla de Offer encontraba el `actualizarSesion` de OTRA función, antes.
