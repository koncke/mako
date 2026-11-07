// =============================================================================
// El correo de avance de un ticket, de punta a punta: la vuelta del cron, Resend y la baja (4/11/2026)
// =============================================================================
// Joan, el 2/11: «¿cómo van esos tickets?». Martín: «que se le envíe por email los avances». La regla pura está en
// tests/tickets-avance.test.ts; acá corren REALES `avisarAvancesPorEmail`, la ruta de baja y el cron de tickets, sobre un
// PostgREST y un Resend de mentira (tests/_tickets-avance-email-hijo.ts, en un node aparte con `--conditions=react-server`).
//
// Lo que cuida, y las cinco cosas se rompen en silencio:
//   1. un correo por hito, y sólo a quien levantó el ticket, es de ese negocio y no los apagó;
//   2. se MARCA antes de mandar: dos vueltas a la vez no mandan dos, y un Resend caído no se repite cada 15 minutos;
//   3. abrir el link de baja (GET) NO apaga nada: lo abren solos los antivirus de los correos;
//   4. la firma de la baja es de ESA persona: no sirve la de otra, ni la de la baja de un lead;
//   5. la baja vale para la DIRECCIÓN y no para la cuenta (mig 0410, `correo_bajas`), y sin esa tabla no sale ninguno.
//
// PROBADO ROMPIÉNDOLO lo de la 0410 (6/11/2026), con el archivo en 10 / 0:
//   · `decidirAvance` sin la pregunta por dirección (`pidioLaBaja`)                 → 9 / 1 (el 5b)
//   · la ruta guardando sólo el perfil, como antes de la 0410                        → 8 / 2 (el 5 y el 5b)
//   · sin la tabla, seguir sin bajas en vez de no mandar (fallar ABIERTO)            → 9 / 1 (el 5c)
//   · «Volver a recibirlos» sin borrar la fila de `correo_bajas`                     → 9 / 1 (el 5b)
//
// Y lo de la CASILLA de Notificaciones (6/11/2026), con el archivo en 12 / 0:
//   · la ruta resolviendo la persona con `filaPropia` en vez de la sesión          → 11 / 1 (el 5e)
//   · la ruta escribiendo `correo_bajas` por su cuenta, sin el módulo compartido   → 11 / 1 (el 5e)
//   · `cambiarBajaPorEmail` sin tocar el perfil (una sola capa)                    → 10 / 2 (el 5b y el 5d)
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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
/** El código de un archivo, sin sus comentarios: lo que se afirma es lo que CORRE, no lo que explica. */
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** Lo que el hijo importa y corre, por su ruta: así un cambio en cualquiera de los tres vuelve a correr este test. */
const CORRE = {
  vuelta: 'lib/tickets-avance-email.ts',
  baja: 'app/api/email/unsubscribe/tickets/route.ts',
  cron: 'app/api/cron/tickets/route.ts',
  // La ruta de la casilla no la corre el hijo (ver el 5e), pero va acá para que un cambio suyo vuelva a correr esto.
  casilla: 'app/api/perfil/correos-tickets/route.ts',
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
  // Y el mismo botón deja la baja por DIRECCIÓN (mig 0410): sin ella, la otra cuenta con su mismo email seguía recibiendo.
  assert.deepEqual(R.bajasDeP2, [{ tipo: 'ticket-avance', por: 'link-del-correo' }]);
});

test('5b. la baja es de la DIRECCIÓN y no de la cuenta: vale para los dos negocios (mig 0410)', () => {
  // El agujero que arregla: la 8 es la misma dirección (p2@test.com) en OTRO negocio. `usuarios(email)` no es único, así
  // que una baja guardada sólo en el perfil de la 2 dejaba salir los correos de la 8 a la misma persona.
  assert.deepEqual(R.correos5bAntes, ['Recibimos tu ticket · Ticket #140'], 'sin baja, el de la otra cuenta sale');
  assert.deepEqual(R.bajasTrasApagar, [{ email: 'dos@test.com', tipo: 'ticket-avance', por: 'link-del-correo' }]);
  assert.deepEqual(R.correos5b, [], 'con la baja, el ticket de la OTRA cuenta no manda');
  // La baja propaga la marca a TODAS las filas con esa dirección, así que la otra cuenta ya sale por `apagado`: su
  // casilla dice lo mismo que lo que pasa de verdad.
  // `apagado` cuenta TODOS los salteados de la vuelta, y arriba quedó la 2 apagada a propósito: se mide que haya, no
  // cuántos. El número exacto lo mide el caso de abajo, que tiene su propio motivo.
  assert.ok((R.vuelta5b.salteados.apagado ?? 0) >= 1, 'y se anota por qué');
  // ⚠️ Y el caso que SÓLO `correo_bajas` puede frenar: una cuenta NUEVA con esa dirección, creada DESPUÉS de la baja. Su
  // perfil nace limpio, así que una decisión que mirara sólo el perfil le escribiría.
  assert.deepEqual(R.perfil11, { timezone: 'America/Mexico_City' }, 'su perfil no tiene la marca');
  assert.deepEqual(R.correos5bNueva, [], 'y no le llega igual');
  assert.equal(R.vuelta5bNueva.salteados.baja_email, 1, 'frenado por la dirección, no por el perfil');
  assert.equal(R.bajasDosVeces, 1, 'apretarlo dos veces no apila filas (unique + upsert)');
  assert.equal(R.bajasTrasPrender, 0, '«Volver a recibirlos» la levanta para todas sus cuentas');
  // Y vuelve a salir. El #141 también: la baja lo SALTEÓ sin reclamar su hito, así que al levantarla sale el que
  // esperaba. Es lo mismo que cuida el 5c: saltear nunca se come un correo.
  assert.deepEqual(R.correos5d, ['Recibimos tu ticket · Ticket #141', 'Recibimos tu ticket · Ticket #144', 'Recibimos tu ticket · Ticket #142']);
});

test('5c. sin la migración 0410 no sale NINGÚN correo, y lo dice', () => {
  // No se sabe quién pidió la baja: escribirle a quien la pidió es peor que un correo de menos.
  assert.equal(R.correos5sinTabla, 0);
  assert.match(String(R.vuelta5sinTabla.motivo ?? ''), /bajas de correo|0410/);
  assert.equal(R.vuelta5sinTabla.enviados, 0);
  // Y el hito NO queda reclamado: cuando la tabla esté, ese correo sale.
  assert.equal(R.marca143sinTabla, null, 'un hito reclamado sin mandar sería un correo perdido');
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

test('5d. la casilla de Notificaciones apaga lo mismo que el link, sin pasar por el correo', () => {
  // Se ejecuta el módulo que la ruta usa (lib/tickets-baja-correo.ts), con su base y su escritura de verdad.
  assert.equal(R.casillaAntes, false, 'arranca recibiendo');
  assert.equal(R.casillaApaga, true, 'el apagado se guarda');
  // La MISMA baja que el link, con su camino anotado: un solo módulo las escribe, así no se escribe una sola mitad.
  assert.deepEqual(R.bajasTrasCasilla, [{ tipo: 'ticket-avance', por: 'notificaciones' }]);
  assert.equal(R.casillaDespues, true, 'y se vuelve a leer apagada');
  assert.deepEqual(R.correos5g, [], 'y frena el correo de verdad, no sólo la casilla');
  assert.equal(R.casillaPrende, true);
  assert.equal(R.bajasTrasPrenderCasilla, 0, 'prenderla borra la fila, igual que el link');
  assert.equal(R.casillaFinal, false);
  assert.deepEqual(R.correos5h, ['Recibimos tu ticket · Ticket #145'], 'y el que esperaba sale al prenderla');
  assert.equal(R.casillaSinEmail, false, 'sin dirección no se escribe nada');
});

test('5e. la ruta de la casilla saca la persona de la SESIÓN, no de `filaPropia`', () => {
  // ⚠️ Esto es lo único de la ruta que el hijo no puede ejecutar (necesita un pedido de Next), y es el error que la
  // rompería justo para quien la necesita: `filaPropia` (lib/perfil.ts) hace `.maybeSingle()` sobre `eq('email', …)` y
  // tira PGRST116 con DOS filas de la misma dirección — la persona con cuenta en su negocio y en el de su cliente.
  // Escrito como la FALLA y no como la forma: si alguien resuelve la sesión de otra manera correcta, esto sigue verde.
  const src = leer('app/api/perfil/correos-tickets/route.ts');
  assert.doesNotMatch(src, /filaPropia|notif-inapp/, 'no puede resolver la persona con filaPropia');
  assert.match(src, /getUsuarioActual\(\)/, 'la persona sale de la sesión');
  // Y pasa por el módulo compartido, no por una copia de la escritura en dos capas.
  assert.match(src, /cambiarBajaPorEmail\(/);
  assert.match(src, /apagadosPorEmail\(/);
  assert.doesNotMatch(src, /from\('correo_bajas'\)|ticketsPorEmail/, 'la escritura vive en lib/tickets-baja-correo.ts');
});
