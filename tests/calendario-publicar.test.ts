// =============================================================================
// Publicar desde el Calendario, de punta a punta (28/10/2026)
// =============================================================================
// Martín a Teo (28/10): «publicás reels e historias desde el Calendar los días y a la hora que elijas». Lo de abajo NO lee
// el fuente: corre lib/calendario-publicar.ts, lib/calendario.ts y la operación `programar_publicacion` REALES en un node
// aparte (tests/_calendario-publicar-hijo.ts) sobre la base, Storage y Zernio de mentira, en el ws 3. Lo que tiene que pasar:
//
//   1. PROGRAMAR ES UN POST EN ZERNIO con la hora en UTC (su Z), la cuenta, el tipo de contenido y la media firmada hasta 7
//      días DESPUÉS de la hora (Zernio la lee al publicar). Una vez: otra vez, o dos pedidos a la vez, no programan otro.
//   2. UN FALLO NO SE PIERDE: queda `fallo` con su motivo y se vuelve a programar.
//   3. LO PROGRAMADO NO SE MUEVE NI SE BORRA sin cancelar antes (saldría igual a la hora vieja); cancelar lo saca de Zernio.
//   4. EL ESTADO SE RELEE: lo publicado pasa a `publicada` (y el evento a «hecho») con su link; lo que falló, con su motivo.
//   5. SIN LA MIGRACIÓN 0342 EL CALENDARIO SIGUE: mover y borrar andan, y programar dice que falta.
//   6. EL ARCHIVO ES DEL NEGOCIO Y DEL EVENTO (por segmentos), y la ruta de la subida la arma el server.
//   7. EN SERIE, POR MaKo: el resumen que se confirma dice cuáles salen y cuáles no (y por qué), y nada sale antes de confirmar.
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

test('un fallo de Zernio queda dicho y se vuelve a programar', () => {
  assert.equal(R.d.falla.programadas.length, 0);
  assert.equal(R.d.trasFalla.publicacion, 'fallo');
  assert.match(R.d.trasFalla.motivo, /Zernio no la programó/);
  assert.deepEqual(R.d.otra, { programadas: ['evd'], fallidas: [] });
  assert.equal(R.d.fila.publicacion, 'programada');
  assert.equal(R.d.fila.motivo, null);
});

test('lo programado no se mueve ni se borra; se cancela en Zernio y después sí', () => {
  const e = R.e;
  assert.equal(e.mover.ok, false);
  assert.match(e.mover.error, /cancela la programación/);
  assert.match(e.borrar.tira ?? '', /cancela la programación/);
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
  assert.match(i.prep.resumen, /Reel «Reel ev1» en Instagram/);
  assert.match(i.prep.resumen, /Story «Reel ev2» en Instagram/);
  assert.match(i.prep.resumen, /No van: «Reel ev5» \(Ponle una hora/);
  assert.ok(!/ev3|ev4/.test(i.prep.resumen), 'la que no tiene archivo y la de otra semana no se nombran');
  assert.equal(i.antesDeConfirmar, 0, 'preparar no programa nada');
  assert.equal(i.ejec.ok, true);
  assert.deepEqual([...i.posts].sort(), ['ev1', 'ev2']);
  assert.deepEqual(i.filas.map((f: { publicacion: string | null }) => f.publicacion), ['programada', 'programada', null, null, null]);
});

test('el 409 de Zernio (el mismo contenido en 24 h) es el post que ya estaba, no un error', () => {
  assert.deepEqual(R.j.r, { programadas: ['evl'], fallidas: [] });
  assert.equal(R.j.fila.post_id, 'post_ya');
});
