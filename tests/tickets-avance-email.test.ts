// =============================================================================
// El correo de avance de un ticket, de punta a punta: la vuelta del cron, Resend y la baja (4/11/2026)
// =============================================================================
// Joan, el 2/11: «¿cómo van esos tickets?». Martín: «que se le envíe por email los avances». La regla pura está en
// tests/tickets-avance.test.ts; acá corren REALES `avisarAvancesPorEmail`, la ruta de baja y el cron de tickets, sobre un
// PostgREST y un Resend de mentira (tests/_tickets-avance-email-hijo.ts, en un node aparte con `--conditions=react-server`).
//
// Lo que cuida, y las cuatro cosas se rompen en silencio:
//   1. un correo por hito, y sólo a quien levantó el ticket, es de ese negocio y no los apagó;
//   2. se MARCA antes de mandar: dos vueltas a la vez no mandan dos, y un Resend caído no se repite cada 15 minutos;
//   3. abrir el link de baja (GET) NO apaga nada: lo abren solos los antivirus de los correos;
//   4. la firma de la baja es de ESA persona: no sirve la de otra, ni la de la baja de un lead.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), con el archivo en 8 / 0, una rotura por vez y restaurada:
//   · `reclamar` que no compara contra el hito que había (sin `.is`/`.eq`)          → 7 / 1 (el 3: dos correos a la vez)
//   · el GET de la baja que apaga como el POST                                       → 7 / 1 (el 5)
//   · `decidirAvance` sin la pregunta de `apagoLosCorreos`                           → 4 / 4 (el 1, el 2, el 5 y el 7)
//   · `verificarBajaTickets` con el prefijo de la baja de un lead (`unsub:`)          → 7 / 1 (el 6)
//   · el cron sin el paso 4                                                          → 7 / 1 (el 7)
// Correr: node --import tsx --test tests/tickets-avance-email.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
/** Lo que el hijo importa y corre, por su ruta: así un cambio en cualquiera de los tres vuelve a correr este test. */
const CORRE = {
  vuelta: 'lib/tickets-avance-email.ts',
  baja: 'app/api/email/unsubscribe/tickets/route.ts',
  cron: 'app/api/cron/tickets/route.ts',
};
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_tickets-avance-email-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 240_000,
  env: { ...process.env, NODE_TEST_CONTEXT: undefined, CORRE: JSON.stringify(CORRE) },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('0. el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.deepEqual(R.red, [], 'nada sale a la red fuera de la base y Resend');
});

test('1. un correo por hito, sólo a quien le toca', () => {
  assert.deepEqual(R.correos1.map((c: { asunto: string }) => c.asunto), [
    'Recibimos tu ticket · Ticket #101',
    'Ya lo estamos desarrollando · Ticket #102',
    'Tu ticket está resuelto · Ticket #113',
  ]);
  for (const c of R.correos1) {
    assert.equal(c.to, 'p2@test.com', 'a la dirección de la persona que lo levantó');
    assert.equal(c.from, 'MaKo <equipo@hola-mako.com>', 'lo firma MaKo, no el negocio');
  }
  // Ninguno de los que no tocan quedó marcado: el día que les toque, sale.
  for (const id of [104, 105, 106, 107, 108, 109, 111, 112, 115]) assert.equal(R.marcas1[id], null, `#${id} no se marca`);
  assert.equal(R.marcas1[103], 'tu_respuesta', 'el rebote no se pisa');
  assert.equal(R.marcas1[110], 'en_curso', 'un ticket que no cambió en dos días no manda nada');
  assert.deepEqual(R.vuelta1.salteados, { apagado: 1, automatico: 1, plataforma: 1, suspendida: 1, otro_negocio: 1, sin_email: 1 });
  assert.ok(R.updatedSinTocar, 'marcar el correo no mueve `updated_at` (lo leen la Ticketera y el aviso final)');
});

test('2. el correo dice en qué anda, lleva su link con el negocio y la baja de un toque', () => {
  const c = R.correo101;
  assert.match(c.texto, /Lo recibimos y ya está en la lista del equipo\./);
  assert.match(c.texto, /https:\/\/mako\.test\/tickets\?t=101&ws=30/);
  assert.ok(c.texto.includes(`Si no quieres recibir estos correos: ${R.bajaDe2}`));
  assert.equal(c.headers['List-Unsubscribe'], `<${R.bajaDe2}>`);
  assert.equal(c.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(c.html, /Ver mi ticket/);
  assert.match(c.html, /darme de baja/);
  assert.deepEqual(R.notas1.map((n: { id: number }) => n.id), [101, 102, 113], 'cada correo queda anotado en su ticket');
});

test('3. otra vuelta, o dos a la vez, no repiten', () => {
  assert.equal(R.correos2, 0, 'la vuelta siguiente no manda nada');
  assert.deepEqual(R.correos3, ['Recibimos tu ticket · Ticket #120'], 'dos vueltas a la vez: un solo correo');
});

test('4. si Resend falla, queda anotado y no se repite cada 15 minutos', () => {
  assert.equal(R.vuelta4.fallidos, 1);
  assert.deepEqual(R.nota121, ['El correo de avance «Recibimos tu ticket» no salió: Resend caído']);
  assert.equal(R.marca121, 'recibido');
  assert.equal(R.correos4b, 0);
});

test('5. la baja: abrir el link no apaga; el botón sí, y no toca el resto del perfil', () => {
  assert.equal(R.getStatus, 200);
  assert.match(R.getHtml, /Dejar de recibirlos/);
  assert.deepEqual(R.perfilTrasGet, { timezone: 'America/Mexico_City' }, 'el GET no apaga nada');
  assert.equal(R.postStatus, 200);
  assert.match(R.postHtml, /Listo: ya no te llegan/);
  assert.match(R.postHtml, /Volver a recibirlos/);
  assert.deepEqual(R.perfilTrasPost, { timezone: 'America/Mexico_City', ticketsPorEmail: false });
  assert.equal(R.correos5, 0, 'apagado, un ticket nuevo suyo no manda nada');
  assert.deepEqual(R.perfilTrasPrender, { timezone: 'America/Mexico_City' }, 'volver a recibirlos borra la marca');
  assert.deepEqual(R.unToque, { status: 200, body: { ok: true } });
  assert.deepEqual(R.perfilTrasUnToque, { timezone: 'America/Mexico_City', ticketsPorEmail: false }, 'el «Cancelar suscripción» de Gmail apaga');
});

test('6. la firma es de esa persona', () => {
  assert.equal(R.firmaAjena, 400, 'la firma de otra persona no prende ni apaga a nadie');
  assert.deepEqual(R.perfil3, { ticketsPorEmail: false });
  assert.equal(R.firmaDeLead, 400, 'la baja de un lead con el mismo número no sirve');
  assert.equal(R.firmaInventada, 400);
});

test('7. el cron de tickets corre la vuelta', () => {
  assert.equal(R.cron.status, 200);
  assert.equal(R.cron.body.correos.enviados, 2);
  // El #122 se levantó con los correos apagados: al volverlos a prender, le llega el hito de hoy (uno, no los perdidos).
  assert.deepEqual(R.correosCron, ['Recibimos tu ticket · Ticket #122', 'Recibimos tu ticket · Ticket #130']);
});
