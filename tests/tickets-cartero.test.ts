// =============================================================================
// La Ticketera de los usuarios — el bug del triage le llega SOLO al Cerebro por el Runner (cartero 1.15.0)
// =============================================================================
// Un bug del triage no tiene quién lo firme, y a la PC no llega texto sin firma: el Runner le escribe al chat «Cerebro» un
// texto FIJO con el número del ticket (docs/hallazgos-ticketera.md). Lo que fija este archivo:
//   1. el texto del cartero (JS) y el del servidor (lib/tickets-aviso.ts) son EL MISMO, y los dos rechazan un número malo;
//   2. el cartero es de una versión que entiende los tickets: si no, MaKo los dejaría «tomados» y se quemarían los intentos;
//   3. la vuelta los reclama, los acusa y los devuelve; y `hayParaElCartero` los cuenta SÓLO para un Runner que los
//      entiende (con uno de antes, `vigilar` saldría en cada vuelta por algo que nunca le llega);
//   4. el cartero valida lo que viene de MaKo (id, número, destino) y no muestra el aviso como una conversación;
//   5. por WhatsApp, quién lo pidió es su teléfono, y se le atribuye a la persona del negocio con ese teléfono.
//
// Probado rompiéndolo (17/10/2026, arnés del scratchpad `romper-cartero.mjs`: una rotura por vez, restaurada de memoria
// y comprobada con sha256; base 5 / 0). Cada una dio 4 / 1 con el rojo en su test: el texto del cartero distinto del
// del servidor · el servidor pidiendo una versión que el cartero no tiene · `hay` contando tickets para un Runner viejo ·
// el cartero sin validar el número · el aviso mostrado como conversación · el runner exigiendo un email otra vez (esta
// última pasó la primera vez: el patrón aparecía en las dos operaciones y la rotura tocaba una; ahora se cuentan las dos).
// Y después (base 6 / 0, `romper-cerebro.mjs`): la PC sin mirar que el destino sea el Cerebro → 5 / 1; un teléfono tomado
// como nombre de WhatsApp → 5 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION_CARTERO_TICKETS, esElCerebro, mensajeTicket, versionAlMenos } from '../lib/tickets-aviso';
import { mismoTelefono, nombreDelActor, propuestaPorFallo, telefonoDelActor } from '../lib/tickets-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el texto fijo al Cerebro es el MISMO en el cartero y en el servidor', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  for (const [n, repo] of [[1, '/repo'], [12, '/otro/clon'], [987654, '/r']] as const) {
    assert.equal(cartero.mensajeTicket(n, repo), mensajeTicket(n, repo), `el texto del ticket #${n} difiere entre los dos lados`);
    // El de un aprobado por regla (1.20.0, 27/10/2026), y un nombre que no conoce: el de siempre, en los dos lados.
    for (const regla of ['Leila', 'Mauricio', 'Juan', null]) assert.equal(cartero.mensajeTicket(n, repo, regla), mensajeTicket(n, repo, regla), `${regla}: difiere`);
  }
  for (const malo of [0, -3, 2.5, Number.NaN, 2e9, '12']) {
    assert.throws(() => cartero.mensajeTicket(malo, '/r'), `el cartero acepta ${String(malo)}`);
  }
});

test('la PC vuelve a mirar que el destino SEA el Cerebro, igual que el servidor', async () => {
  // Rota: sacar `if (!esElCerebro(chat.titulo))` del loop del cartero → este test falla (con MaKo comprometida, el
  // aviso de un bug podría ir a cualquier chat vivo y mandarlo a «arreglar» algo).
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  for (const t of ['Cerebro', ' cerébro ', 'CEREBRO', 'Cerebro › Pagos', 'CRM', 'El Cerebro', '']) {
    assert.equal(cartero.esElCerebro(t), esElCerebro(t), `«${t}» se lee distinto en la PC y en el servidor`);
  }
  const c = sinComentarios(leer('scripts/operaciones/cartero.mjs'));
  const loop = c.slice(c.indexOf('for (const t of salida.tickets ?? [])'));
  assert.match(loop.slice(0, loop.indexOf('escribirJson')), /if \(!esElCerebro\(chat\.titulo\)\) \{ rechazarId\(id,/);
});

test('el cartero entiende los tickets: su versión llega a la que pide el servidor', async () => {
  // Rota: VERSION_CARTERO_TICKETS en '1.16.0' (más nuevo que el cartero) → este test falla.
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  assert.ok(versionAlMenos(cartero.VERSION, VERSION_CARTERO_TICKETS), `el cartero ${cartero.VERSION} no llega a ${VERSION_CARTERO_TICKETS}`);
});

test('la vuelta reclama, acusa y devuelve los tickets; `hay` los cuenta sólo para un Runner que los entiende', () => {
  // Rota: sacar `versionAlMenos(f.version …)` de `conCerebro` → este test falla (`vigilar` saldría en cada vuelta).
  const op = sinComentarios(leer('lib/operaciones.ts'));
  assert.match(op, /tickets = await ticketsParaElCartero\(version, chats, new Set\(vivos\), ahoraIso\)/);
  assert.match(op, /acuses \+= await acusarTicket\(a, ahoraIso\)/);
  assert.match(op, /return \{ pedidos, avisos, avisosError, tickets, ticketsError, /);
  assert.match(op, /const conCerebro = \(filas \?\? \[\]\)\.some\(\(f\) => versionAlMenos\(f\.version as string \| null, VERSION_CARTERO_TICKETS\)/);
  assert.match(op, /if \(conCerebro\) n \+= await ticketsSinEntregar\(\);/);
  // Y lo que reclama la vuelta también mira la versión (lib/tickets-runner.ts).
  assert.match(sinComentarios(leer('lib/tickets-runner.ts')), /if \(!versionAlMenos\(version, VERSION_CARTERO_TICKETS\)\) return \[\];/);
});

test('el cartero valida lo que viene de MaKo y arma el texto él; el aviso no es una conversación', () => {
  const c = sinComentarios(leer('scripts/operaciones/cartero.mjs'));
  const loop = c.slice(c.indexOf('for (const t of salida.tickets ?? [])'));
  assert.ok(loop.length > 100, 'no está el loop de los tickets');
  const cuerpo = loop.slice(0, loop.indexOf('ticketsError'));
  assert.match(cuerpo, /UUID_RE\.test\(id\)/);
  assert.match(cuerpo, /Number\.isInteger\(t\.numero\)/);
  assert.match(cuerpo, /DESTINO_RE\.test\(t\.destino\)/);
  assert.match(cuerpo, /yaSalio\(id\)/);
  // Desde la 1.24.0 (29/10/2026), un pedido delegado desde el grupo lleva su propio texto fijo (tests/tickets-al-cerebro.test.ts).
  assert.match(cuerpo, /mensaje: t\.delegado === true \? mensajePedidoDelegado\(t\.numero, repo\) : mensajeTicket\(t\.numero, repo, typeof t\.regla === 'string' \? t\.regla : null\)/);
  assert.doesNotMatch(cuerpo, /\bt\.(texto|titulo|descripcion|mensaje)\b/, 'el cartero no usa ningún texto que venga de MaKo');
  assert.match(c, /\/\^Un cliente levantó el ticket #\/\.test\(cuerpo\)/, 'el aviso al Cerebro no se muestra como lo que dijo un chat');
});

test('por WhatsApp: quién lo pidió es su teléfono, y se le atribuye a la persona con ese teléfono', () => {
  assert.equal(telefonoDelActor('whatsapp:5491123456789'), '5491123456789');
  assert.equal(telefonoDelActor('whatsapp:+5491123456789'), '5491123456789');
  assert.equal(telefonoDelActor('ana@negocio.com'), null);
  assert.equal(telefonoDelActor('whatsapp:123'), null);
  // El 9 de Argentina que agrega WhatsApp, y el formato que carga la persona.
  assert.ok(mismoTelefono('5491123456789', '+54 11 2345-6789'));
  assert.ok(!mismoTelefono('5491123456789', '+54 11 2345-6780'));
  assert.ok(!mismoTelefono('1234567', '1234567'), 'con menos de 8 dígitos no se compara');
  // Sin teléfono (un `@lid` de un grupo), el doer manda el nombre de WhatsApp: queda con ése.
  assert.deepEqual(nombreDelActor('whatsapp:Ana Pérez'), { clave: 'whatsapp:ana-perez', nombre: 'Ana Pérez' });
  assert.equal(nombreDelActor('whatsapp:+5491123456789'), null, 'un teléfono no es un nombre');
  assert.equal(nombreDelActor('ana@negocio.com'), null);
  assert.equal(nombreDelActor('whatsapp:!!!'), null);
  // `propuestaPorFallo` la usa el doer de WhatsApp (lib/mako-doer-in.ts): sacarla rompe su rama al integrar.
  const p = propuestaPorFallo({ herramienta: 'mover_lead', error: 'boom' }, 'mové a Juan a agendado', 'Mover un lead de etapa');
  assert.deepEqual([p.tipo, p.titulo], ['bug', 'No se pudo: Mover un lead de etapa']);
  const run = sinComentarios(leer('lib/api-mako/areas/tickets.run.ts'));
  // Quién pide lo resuelve UNA función (`quienPide`, con `quienPideElTicket` por canal: lib/tickets-api.ts) que termina en
  // `identidadDelActor`, y la usan las operaciones que necesitan a alguien (10/11/2026: también por HTTP).
  assert.match(run, /async function quienPide\(ctx: Ctx\) \{\s*const actor = quienPideElTicket\(ctx\);\s*return actor \? identidadDelActor\(ctx\.ws, actor\) : null;/);
  assert.ok(run.split('await quienPide(ctx)').length - 1 >= 3, 'levantar, mis_tickets y responder pasan por quienPide');
  assert.doesNotMatch(run, /identidadDelActor\(ctx\.ws, ctx\.actor\)/, 'nadie lee ctx.actor directo: por HTTP es el nombre del token');
  assert.doesNotMatch(run, /includes\('@'\)/, 'el runner ya no exige un email');
  assert.match(sinComentarios(leer('lib/tickets-cierre.ts')), /enviarAlGrupoMaKo\(ws, sanearSalida\(texto, \{ corrioHerramientas: true \}\)\.texto, \{ de: 'equipo', ticket: Number\(f\.id\) \}\)/);
});
