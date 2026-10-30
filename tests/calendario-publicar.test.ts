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
//  11. (la segunda verificación, 29/10) LA VENTANA DEL MISMO PEDIDO SE CUENTA DESDE EL PRIMER ENVÍO; en el reintento sólo el
//      post resuelve la duda (un 429 o un 422 no); la anotación de «programada» se reintenta; el reclamo exige que el evento no
//      haya cambiado desde que se leyó; «Ya lo resolví en Zernio» saca de la duda y de la clave cambiada; el «Deshacer» doble no
//      pisa una programada; y lo que no se mueve, borra ni tilda dice el porqué de su estado.
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
// ROTO 29/10 madrugada (los arreglos de la segunda verificación, 2910-verificacion-zernio-254856316-planes-ddfa645d4.md; con
// este test y el de reglas: 37 pases y 0 fallos como está):
//   · N1: la ventana se cuenta desde la última anotación (updated_at)                  → 36 / 1
//   · N1: la relectura de un trabado deja el intento                                   → 35 / 2
//   · N1: la anotación de «programada» no se reintenta                                 → 35 / 2
//   · N2: en el reintento un 4xx borra la duda                                         → 35 / 2
//   · N6: el reclamo no mira si el evento cambió                                       → 36 / 1
//   · N3: «Ya lo resolví» deja la cuenta (vuelve a las listas)                         → 36 / 1
//
// ROTO 29/10 noche (M6 de la revisión de privacidad, 2910-revision-privacidad-zernio-leads-ce56bd693.md; este test solo: 29 / 0):
//   · M6: el 409 le pone el post de otra publicación                                   → 28 / 1
//   · M6: crearPostZernio no dice que ya estaba                                        → 28 / 1
//   · N7: «Ya lo resolví» suelta una programada con la MISMA clave                     → 36 / 1
//   · N3: tildar o mover una dudosa dice «se tilda sola» / «cancela»                   → 35 / 2
//   · N7: tildar con otra clave dice «se tilda sola»                                   → 35 / 2
//   · N5: el «Deshacer» doble escribe la publicación sin condición                     → 36 / 1
//   · la pantalla sin «Ya lo resolví» en la duda                                       → 36 / 1
//
// Correr: node --import tsx --test tests/calendario-publicar.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
  assert.deepEqual(e.marcar, { bloqueo: 'Está programada en la red: se tilda sola cuando sale.' }, 'uno programado no se tilda a mano: se tilda solo cuando sale');
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

test('el 409 de Zernio (el mismo contenido) es el post que ya estaba, no un error; pero no el de OTRA publicación', () => {
  assert.deepEqual(R.j.r, { programadas: ['evl'], fallidas: [] });
  assert.equal(R.j.fila.post_id, 'post_ya');
  // M6 (revisión de privacidad, 29/10): las veces iguales de una serie no comparten un post.
  assert.deepEqual(R.j2.r.programadas, []);
  assert.match(R.j2.r.fallidas[0].motivo, /^Zernio dice que es igual a otra publicación ya programada/);
  assert.equal(R.j2.fila.publicacion, 'fallo');
  assert.equal(R.j2.fila.post_id ?? null, null);
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
  assert.equal(R.m.intentoQ, null, 'la que pasa a la duda pierde el intento: su x-request-id ya salió de la ventana de Zernio');
  assert.equal(R.m.intentoR, 'req-r');
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
  assert.deepEqual(o.marcarCarrera, { bloqueo: 'Está programada en la red: se tilda sola cuando sale.' });
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

// ── La segunda verificación (29/10, C:/dev/revisiones/2910-verificacion-zernio-254856316-planes-ddfa645d4.md) ──────────────────

test('N1: la ventana del MISMO pedido se cuenta desde el PRIMER envío; un trabado que pasa a la duda no se reintenta a ciegas', () => {
  const r = R.r;
  assert.match(r.n1.fallidas[0].motivo, /Quedó programada en Zernio \(post_\d+\) y no pude anotarlo/);
  assert.equal(r.n1Fila.publicacion, 'programando');
  assert.match(r.n1Fila.intento ?? '', /^[0-9a-f-]{36}@\d+$/, 'el intento lleva la hora del primer envío');
  assert.equal(r.n1bFila.publicacion, 'programando', 'N1b: la base no anotó la duda');
  assert.equal(r.n1Releer, 2);
  for (const f of r.n1Duda) {
    assert.equal(f.publicacion, 'dudosa');
    assert.equal(f.intento, null, 'a los 11 minutos el x-request-id ya no lo deduplica Zernio: se borra');
  }
  assert.deepEqual(r.n1Reintento.programadas, []);
  for (const f of r.n1Reintento.fallidas) assert.match(f.motivo, /revisa en Zernio/);
  assert.equal(r.pedidos, 2, 'el reintento a los 12 minutos no sale a Zernio');
  assert.equal(r.creados, 2, 'un post por evento: ninguno duplicado');
});

test('Zernio la creó y la base falló UNA vez al anotarla: se reintenta la anotación con el post que ya se conoce', () => {
  assert.deepEqual(R.r1.r, { programadas: ['evR1'], fallidas: [] });
  assert.equal(R.r1.fila.publicacion, 'programada');
  assert.equal(R.r1.creados, 1);
});

test('N1c: dos respuestas perdidas seguidas: a los 3:54 se repite el pedido, a los 7:48 del PRIMER envío ya no', () => {
  const r = R.r2;
  assert.equal(r.c2Fila.publicacion, 'dudosa');
  assert.equal(r.c2Fila.intento, r.fila.intento, 'el reintento conserva el intento y su hora');
  assert.deepEqual(r.c3.programadas, []);
  assert.match(r.c3.fallidas[0].motivo, /revisa en Zernio/);
  assert.equal(r.pedidos.length, 2, 'el tercero no sale');
  assert.equal(r.pedidos[0], r.pedidos[1]);
  assert.equal(r.creados, 1, 'un solo post');
});

for (const status of ['429', '422']) {
  test(`N2: en el reintento, un ${status} de Zernio no borra la duda; el siguiente recupera el post original`, () => {
    const r = R[`r3_${status}`];
    assert.equal(r.aFila.publicacion, 'dudosa', `un ${status} al reintento no dice que el primero no exista`);
    assert.equal(r.aFila.intento, r.intento0, 'conserva el intento (y su hora)');
    assert.match(r.a.fallidas[0].motivo, /no confirmó el reintento/);
    assert.deepEqual(r.b, { programadas: ['evN2'], fallidas: [] });
    assert.equal(r.fila.publicacion, 'programada');
    assert.equal(new Set(r.pedidos).size, 1, 'siempre el mismo x-request-id');
    assert.equal(r.creados, 1, 'un solo post');
  });
}

test('N3: una en duda que SÍ quedó: tildar, mover y borrar dicen la verdad, y «Ya lo resolví en Zernio» la suelta sin la cuenta', () => {
  const s = R.s;
  assert.match(s.marcar.bloqueo ?? '', /No se sabe si quedó/);
  assert.doesNotMatch(s.marcar.bloqueo ?? '', /se tilda sola/);
  assert.equal(s.mover.ok, false);
  assert.match(s.mover.error, /No se sabe si quedó/);
  assert.match(s.borrar.tira ?? '', /No se sabe si quedó/);
  assert.deepEqual(s.resolver, { ok: true });
  assert.equal(s.tras.publicacion, null);
  assert.deepEqual([s.tras.red, s.tras.cuenta, s.tras.intento, s.tras.post_id], [null, null, null, null], 'sin la cuenta: no vuelve a las listas');
  assert.equal(s.tras.archivo, '3/calendario/evN3/abcdef123456.mp4', 'el archivo y el texto quedan');
  assert.equal(s.tras.texto, 'Mira esto');
  assert.match(s.tras.motivo ?? '', /MaKo ya no la sigue/);
  assert.deepEqual(s.listas, [], '«Programar las listas» no la ofrece otra vez (duplicaría lo que quedó en Zernio)');
  assert.equal(s.marcarDespues, true, 'ahora se tilda a mano');
  assert.equal(s.resolverOtra.ok, false);
  assert.equal(s.creados, 1);
});

test('N7: programada con OTRA clave: tildar lo dice y «Ya lo resolví en Zernio» la suelta; con la MISMA clave, no', () => {
  const s = R.s2;
  assert.equal(s.misma.otra, false);
  assert.match(s.misma.marcar.bloqueo ?? '', /se tilda sola cuando sale/);
  assert.equal(s.misma.resolver.ok, false, 'con la misma clave MaKo la sigue y la cancela: no se suelta');
  assert.match(s.misma.resolver.error, /cancélala desde aquí/);
  assert.equal(s.otra, true);
  assert.match(s.marcar.bloqueo ?? '', /otra clave de Zernio/);
  assert.deepEqual(s.resolver, { ok: true });
  assert.equal(s.fila.publicacion, null);
  assert.equal(s.sigueEnZernio, 1, 'soltarla no toca Zernio (la otra cuenta es de la persona)');
});

test('N6: si otro pedido mueve el evento entre la lectura y el reclamo, el reclamo no gana y no sale nada a la hora vieja', () => {
  const t = R.t;
  assert.deepEqual(t.t1.programadas, []);
  assert.match(t.t1.fallidas[0].motivo, /Cambió mientras la programaba/);
  assert.equal(t.tPosts, 0, 'nada a Zernio');
  assert.equal(t.tFila.publicacion, null);
  assert.equal(t.tFila.inicio, '2026-11-07T23:00:00.000Z');
  assert.deepEqual(t.t2, { programadas: ['evN6'], fallidas: [] }, 'el siguiente pedido lee lo nuevo y la programa');
  assert.deepEqual(t.scheduledFor, ['2026-11-07T23:00:00.000Z'], 'sale a la hora NUEVA');
});

test('N5: el «Deshacer» de un evento que ya volvió no pisa el archivo ni el texto de uno programado', () => {
  const u = R.u;
  assert.equal(u.rest5, 'ok');
  assert.equal(u.publicacion, 'programada');
  assert.equal(u.texto, 'texto que va a salir');
  assert.equal(u.archivo, '3/calendario/evN5/abcdef123456.mp4');
});

test('la pantalla: «Ya lo resolví en Zernio» en la duda y en la programada con otra clave (la action dice cuál es)', () => {
  const src = readFileSync(join(RAIZ, 'app', 'calendario', 'PublicarEnRed.tsx'), 'utf8');
  const actions = readFileSync(join(RAIZ, 'app', 'calendario', 'actions.ts'), 'utf8');
  const duda = src.slice(src.indexOf("{d.publicacion === 'dudosa' && ("), src.indexOf("{!bloqueada && d.publicacion !== 'publicada'"));
  assert.ok(duda.length > 0);
  assert.match(duda, /onClick=\{\(\) => void resolver\(\)\}>Ya lo resolví en Zernio</);
  assert.match(src, /otraClave && d\.publicacion === 'programada' \? \([\s\S]{0,400}void resolver\(\)\}>Ya lo resolví en Zernio</);
  assert.match(src, /setOtraClave\(r\.otraClave === true\)/);
  assert.match(actions, /otraClave: await programadaConOtraClave\(datos\)/);
  assert.match(actions, /await resolverEnZernio\(idDe\(id\)\)/);
});
