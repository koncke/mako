// =============================================================================
// Publicar desde el Calendario, de punta a punta (28/10/2026)
// =============================================================================
// Martín a Teo (28/10): «publicás reels e historias desde el Calendar los días y a la hora que elijas». Lo de abajo NO lee
// el fuente: corre lib/calendario-publicar.ts, lib/calendario.ts y la operación `programar_publicacion` REALES en un node
// aparte (tests/_calendario-publicar-hijo.ts) sobre la base, Storage y Zernio de mentira, en el ws 3. Lo que tiene que pasar:
//
//   1. PROGRAMAR ES UN POST EN ZERNIO con la hora en UTC (su Z), la cuenta, el tipo de contenido y la media firmada hasta 7
//      días DESPUÉS de la hora (Zernio la lee al publicar). Una vez: otra vez, o dos pedidos a la vez, no programan otro.
//   2. UN FALLO NO SE PIERDE: queda `fallo` con su motivo y se vuelve a programar. Pero si Zernio NO CONTESTÓ (la conexión se
//      cortó, un 5xx) puede haberla creado: queda `dudosa`, no se reprograma a ciegas (se reintenta el MISMO pedido al momento,
//      o alguien revisa y la marca «No quedó programada»), y una que quedó `programando` pasa a `dudosa` a los 10 minutos.
//   3. LO PROGRAMADO NO SE MUEVE NI SE BORRA sin cancelar antes (saldría igual a la hora vieja); cancelar lo saca de Zernio.
//   4. EL ESTADO SE RELEE: lo publicado pasa a `publicada` (y el evento a «hecho») con su link; lo que falló, con su motivo.
//   5. SIN LA MIGRACIÓN 0342 EL CALENDARIO SIGUE: mover y borrar andan, y programar dice que falta.
//   6. EL ARCHIVO ES DEL NEGOCIO Y DEL EVENTO (por segmentos), y la ruta de la subida la arma el server.
//   7. EN SERIE, POR MaKo: el resumen que se confirma dice cuáles salen (y en qué cuenta) y cuáles no (y por qué), nada sale
//      antes de confirmar, y una que cambió entre el resumen y el «sí» no se programa.
//   8. LA CUENTA ES DEL NEGOCIO (la verificación del 28/10, lo primero): la de otro negocio no se guarda ni se programa.
//   9. LA CLAVE DE ZERNIO CAMBIÓ: un 404 con otra clave no es «cancelado» ni «ya no está».
//  10. LA CARRERA: mover, borrar y tildar llevan la condición EN la escritura.
//
// Probado ROMPIÉNDOLO (28/10/2026), una rotura por vez y restaurando, con este test y tests/calendario-publicar-reglas.test.ts
// (16 pases y 0 fallos con el código como está). Rota:
//   · programa un evento de todo el día                                                → 14 / 2
//   · la hora sin normalizar a UTC con Z                                               → 15 / 1
//   · la ruta del archivo por prefijo                                                  → 14 / 2
//   · la firma muere a la hora de publicar                                             → 14 / 2
//   · un «partial» de Zernio no es un fallo                                            → 15 / 1
//   · el reclamo sin compare-and-set (dos pedidos, dos posts)                          → 15 / 1
//   · «publicada» no tilda el evento                                                   → 15 / 1
//   · leer las publicaciones sin tolerar la falta de la 0342                           → 15 / 1
//   · el 409 de Zernio como error                                                      → 15 / 1
//   · mover uno programado                                                             → 15 / 1
//   · borrar uno programado                                                            → 15 / 1
//   · relee también lo que todavía no tenía que salir                                  → 15 / 1
//
// Y los arreglos de la verificación del 28/10 (2810-verificacion-zernio-bef5bfcd3.md), rotos de a uno: ver «ROTO 28/10 noche»
// al final de la cabecera.
//
// ROTO 28/10 noche (los arreglos de la verificación, con este test y el de reglas: 25 pases y 0 fallos como está):
//   · la cuenta no se valida contra las del negocio                                    → 24 / 1
//   · sin respuesta de Zernio queda «fallo» (no «dudosa»)                              → 23 / 2
//   · el reintento manda un x-request-id nuevo                                         → 24 / 1
//   · un «programando» trabado no pasa a la duda                                       → 24 / 1
//   · cancelar no mira si la clave cambió                                              → 24 / 1
//   · la relectura da por perdida una de otra clave                                    → 24 / 1
//   · el «sí» de la API sin mirar la huella                                            → 24 / 1
//   · mover, borrar y tildar sin la condición en la escritura                          → 22 / 3
//   · tildar uno programado no lo dice                                                 → 23 / 2
//   · el «Deshacer» devuelve la cuenta                                                 → 24 / 1
//   · YouTube sin el tope del título                                                   → 24 / 1
//   · el resumen sin la cuenta                                                         → 24 / 1
//
// Correr: node --import tsx --test tests/calendario-publicar.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_calendario-publicar-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.tiro, undefined, String(R.tiro));
  assert.deepEqual(R.red, []);
});

test('programar es UN post en Zernio: la hora en UTC, la cuenta, el reel, la media firmada y su x-request-id', () => {
  const a = R.a;
  assert.deepEqual(a.r, { programadas: ['eva'], fallidas: [] });
  assert.deepEqual(a.fila, { publicacion: 'programada', post_id: 'post_1', estado: 'planeado', motivo: null, url: null });
  const c = a.post.cuerpo;
  assert.equal(c.scheduledFor, '2026-11-03T13:00:00.000Z');
  assert.deepEqual(c.platforms, [{ platform: 'instagram', accountId: 'acc_ig_1', platformSpecificData: { contentType: 'reel' } }]);
  assert.equal(c.mediaItems.length, 1);
  assert.equal(c.mediaItems[0].type, 'video');
  assert.match(c.mediaItems[0].url, /^http:\/\/supa\.test\/storage\/v1\/object\/sign\/ig-media\/3\/calendario\/eva\/abcdef123456\.mp4\?token=/);
  assert.equal(c.content, 'Mira esto');
  assert.deepEqual(c.metadata, { calendarioEventoId: 'eva' });
  assert.match(a.post.requestId ?? '', /^[0-9a-f-]{36}$/, 'x-request-id: la idempotencia de Zernio');
  assert.equal(a.firmas.length, 1);
  assert.equal(a.firmas[0].ruta, '3/calendario/eva/abcdef123456.mp4');
  assert.ok(a.firmas[0].expiresIn > 8 * 86_400, 'la firma vive hasta 7 días después de la hora (mañana + 7)');
});

test('una vez: otra vez no programa, y dos pedidos a la vez dejan un solo post', () => {
  assert.deepEqual(R.b.r.programadas, []);
  assert.match(R.b.r.fallidas[0].motivo, /Ya está programada/);
  assert.equal(R.b.posts, 1);
  assert.equal(R.c.posts, 1, 'dos pedidos a la vez: un solo post (el reclamo del evento)');
  assert.equal(R.c.fila.publicacion, 'programada');
});

test('un rechazo de Zernio queda dicho y se vuelve a programar', () => {
  assert.equal(R.d.falla.programadas.length, 0);
  assert.equal(R.d.trasFalla.publicacion, 'fallo');
  assert.match(R.d.trasFalla.motivo, /Zernio no la programó: Invalid media/);
  assert.deepEqual(R.d.otra, { programadas: ['evd'], fallidas: [] });
  assert.equal(R.d.fila.publicacion, 'programada');
  assert.equal(R.d.fila.motivo, null);
});

test('lo programado no se mueve ni se borra; se cancela en Zernio y después sí', () => {
  const e = R.e;
  assert.equal(e.mover.ok, false);
  assert.match(e.mover.error, /cancela la programación/);
  assert.match(e.borrar.tira ?? '', /cancela la programación/);
  assert.equal(e.marcar, 'programada', 'uno programado no se tilda a mano: se tilda solo cuando sale');
  assert.deepEqual(e.cancelar, { ok: true });
  assert.equal(e.deletes.length, 1, 'un DELETE en Zernio, el del post programado');
  assert.match(e.deletes[0], /^\/posts\/post_\d+$/);
  assert.deepEqual(e.trasCancelar, { publicacion: null, post_id: null, estado: 'planeado', motivo: null, url: null });
  assert.deepEqual(e.moverDespues, { ok: true });
});

test('se relee lo que ya tenía que salir: publicada con su link (y el evento hecho), fallo con su motivo, lo demás igual', () => {
  const f = R.f;
  assert.equal(f.cambiados, 2);
  assert.deepEqual(f.f, { publicacion: 'publicada', post_id: 'post_pub', estado: 'hecho', motivo: null, url: 'https://www.instagram.com/reel/abc/' });
  assert.deepEqual(f.g, { publicacion: 'fallo', post_id: 'post_fallo', estado: 'planeado', motivo: 'Video too long for Reels', url: null });
  assert.equal(f.h.publicacion, 'programada', 'publicándose: sigue esperando');
  assert.equal(f.i.publicacion, 'programada', 'la de mañana no se relee');
  assert.ok(!f.leidos.includes('/posts/post_futuro'));
});

test('sin la migración 0342 el Calendario sigue: mover y borrar andan, y programar dice que falta', () => {
  const g = R.g;
  assert.equal(g.leer, 0);
  assert.deepEqual(g.mover, { ok: true });
  assert.deepEqual(g.programar, { error: 'Falta la migración 0342 para publicar desde el Calendario.' });
  assert.equal(g.borrar, true);
});

test('el archivo es del negocio y del evento, y la ruta de la subida la arma el server', () => {
  const h = R.h;
  assert.equal(h.ajeno.ok, false, 'el ws 30 no es el 3');
  assert.equal(h.otroEvento.ok, false);
  assert.deepEqual(h.propio, { ok: true });
  assert.equal(h.subida.ok, true);
  assert.match(h.subida.ruta, /^3\/calendario\/evk\/[a-f0-9]{24}\.mp4$/);
  assert.equal(h.subida.tipo, 'video');
  assert.equal(h.subida.apikey, 'anon-de-prueba');
  assert.equal(h.subidaPdf.ok, false);
});

test('en serie, por MaKo: el resumen dice cuáles salen y cuáles no, y nada sale antes de confirmar', () => {
  const i = R.i;
  assert.ok(i.prep.payload, JSON.stringify(i.prep));
  assert.deepEqual([...i.prep.payload.eventos].sort(), ['ev1', 'ev2']);
  assert.match(i.prep.resumen, /2 publicaciones/);
  assert.match(i.prep.resumen, /Reel «Reel ev1» en Instagram \(@fiesta\.music\)/, 'con la cuenta: con dos Instagram, la red sola confunde');
  assert.match(i.prep.resumen, /Story «Reel ev2» en Instagram \(@fiesta\.music\)/);
  assert.match(i.prep.resumen, /No van: «Reel ev5» \(Ponle una hora/);
  assert.ok(!/ev3|ev4/.test(i.prep.resumen), 'la que no tiene archivo y la de otra semana no se nombran');
  assert.equal(i.antesDeConfirmar, 0, 'preparar no programa nada');
  assert.equal(i.ejec.ok, true);
  assert.deepEqual([...i.posts].sort(), ['ev1', 'ev2']);
  assert.deepEqual(i.filas.map((f: { publicacion: string | null }) => f.publicacion), ['programada', 'programada', null, null, null]);
});

test('el 409 de Zernio (el mismo contenido) es el post que ya estaba, no un error', () => {
  assert.deepEqual(R.j.r, { programadas: ['evl'], fallidas: [] });
  assert.equal(R.j.fila.post_id, 'post_ya');
});

test('el «sí» que llega después: una que cambió desde el resumen no se programa; un «sí» sin huellas no programa nada', () => {
  const i = R.i2;
  assert.deepEqual(Object.keys(i.huellas).sort(), ['ev1', 'ev2']);
  assert.deepEqual(i.posts, ['ev2']);
  assert.equal(i.filas[0].publicacion, null, 'ev1 cambió de hora: no se programa con el resumen viejo');
  assert.match(i.ejec2.resumen, /«Reel ev1» \(Cambió desde que lo confirmaste/);
  assert.equal(i.sinHuellas.ok, false);
  assert.equal(i.ev6.publicacion, null);
  assert.equal(i.postsFinal, 1);
});

test('LA CUENTA ES DEL NEGOCIO: la de otro negocio no se guarda ni se programa, la red sale de la cuenta, y sin leerlas no se programa', () => {
  const k = R.k;
  assert.equal(k.guardarAjena.ok, false);
  assert.match(k.guardarAjena.error, /no está conectada en este negocio/);
  assert.equal(k.guardarRedMentida.ok, false, 'una cuenta de Instagram no se guarda como TikTok');
  assert.deepEqual(k.trasAjena, { red: null, cuenta: null });
  assert.deepEqual(k.guardarPropia, { ok: true });
  assert.deepEqual(k.trasPropia, { red: 'instagram', cuenta: 'acc_ig_1' }, 'la red sale de la cuenta');
  assert.deepEqual(k.programarAjena.programadas, []);
  assert.match(k.programarAjena.fallidas[0].motivo, /no está conectada en este negocio/);
  assert.equal(k.postsAjena, 0, 'a Zernio no sale nada con la cuenta de otro');
  assert.equal(k.filaAjena.publicacion, null);
  assert.match(k.programarSinCuentas.fallidas[0].motivo, /No pude leer tus cuentas/);
  assert.equal(k.postsSinCuentas, 0);
  assert.equal(k.filaSinCuentas.publicacion, null);
});

test('Zernio no contestó: queda en duda (no fallo), no se mueve ni se cancela, y el reintento repite el MISMO pedido', () => {
  const l = R.l;
  assert.match(l.l1.fallidas[0].motivo, /Zernio no contestó/);
  assert.equal(l.filaDudosa.publicacion, 'dudosa');
  assert.equal(l.moverDudosa.ok, false);
  assert.equal(l.cancelarDudosa.ok, false);
  assert.deepEqual(l.l2, { programadas: ['evo'], fallidas: [] });
  assert.equal(l.pedidos.length, 2);
  assert.equal(l.pedidos[0], l.pedidos[1], 'el mismo x-request-id: Zernio devuelve la que había creado');
  assert.equal(l.creados, 1, 'un solo post en Zernio');
  assert.equal(l.fila.publicacion, 'programada');
});

test('un 5xx también deja la duda; pasados unos minutos no se pide otro, y «No quedó programada» la libera', () => {
  const l = R.l2;
  assert.equal(l.fila1.publicacion, 'dudosa');
  assert.match(l.p2.fallidas[0].motivo, /revisa en Zernio/);
  assert.equal(l.postsTrasP2, 1, 'a los 10 minutos no se reprograma a ciegas');
  assert.deepEqual(l.noQuedo, { ok: true });
  assert.equal(l.trasNoQuedo.publicacion, 'fallo');
  assert.deepEqual(l.p3, { programadas: ['evp'], fallidas: [] });
  assert.equal(l.pedidos.length, 2);
  assert.notEqual(l.pedidos[0], l.pedidos[1], 'después de revisarla, un pedido NUEVO');
  assert.equal(l.noQuedoOtra.ok, false, 'sólo una en duda se marca «No quedó programada»');
});

test('una que quedó programándose (la función murió) pasa a la duda a los 10 minutos', () => {
  assert.equal(R.m.cambiados, 1);
  assert.equal(R.m.q.publicacion, 'dudosa');
  assert.equal(R.m.r.publicacion, 'programando', 'la de hace 2 minutos todavía se está programando');
});

test('LA CLAVE CAMBIÓ: cancelar no dice «cancelado» y la relectura no la da por perdida; con la misma clave, sí', () => {
  const n = R.n;
  assert.match(n.claveVieja ?? '', /^[0-9a-f]{16}$/, 'se guarda la huella de la clave, nunca la clave');
  assert.equal(n.cancelarOtraClave.ok, false);
  assert.match(n.cancelarOtraClave.error, /La clave de Zernio cambió/);
  assert.equal(n.deletesOtraClave, 0, 'con otra clave ni se intenta: el 404 no diría nada');
  assert.equal(n.evsOtraClave.publicacion, 'programada');
  assert.deepEqual(n.sigueEnZernio, [n.evsOtraClave.post_id]);
  assert.equal(n.releerOtraClave, 0);
  assert.equal(n.evtOtraClave.publicacion, 'programada', 'con otra clave, un 404 no es «ya no está»');
  assert.equal(n.releerMisma, 1);
  assert.deepEqual([n.evtMisma.publicacion, n.evtMisma.motivo], ['fallo', 'Zernio ya no la tiene: no va a salir.']);
  assert.deepEqual(n.cancelarMisma, { ok: true });
  assert.equal(n.evsMisma.publicacion, null);
});

test('LA CARRERA: si otro pedido la programa entre que se decide y se escribe, mover, borrar y tildar no la pisan', () => {
  const o = R.o;
  assert.equal(o.moverCarrera.ok, false);
  assert.match(o.moverCarrera.error, /cancela la programación/);
  assert.equal(o.inicioU, '2026-11-03T13:00:00.000Z');
  assert.match(o.borrarCarrera.tira ?? '', /cancela la programación para borrarla/);
  assert.equal(o.existeV, true);
  assert.equal(o.marcarCarrera, 'programada');
  assert.equal(o.estadoW, 'planeado');
});

test('el «Deshacer» de un borrado devuelve el archivo y el texto, nunca la cuenta', () => {
  assert.deepEqual(R.p.publicacion, { red: null, cuenta_red: null, archivo: '3/calendario/evx/abcdef123456.mp4', archivo_tipo: 'video', texto: 'Mira esto' });
});

test('YouTube: el título del evento es el del video, hasta 100 caracteres', () => {
  assert.deepEqual(R.q.r.programadas, ['evz']);
  assert.match(R.q.r.fallidas[0].motivo, /hasta 100 caracteres/);
  assert.deepEqual(R.q.posts, ['evz']);
});
