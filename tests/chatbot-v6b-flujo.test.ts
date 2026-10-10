// =============================================================================
// Sexta tanda, SEGUNDA PASADA, parte «flujo»: el borrador, el aviso de las 24 h, el TAG con varias,
// el CRON con varios disparadores y los enchufes del lienzo
// =============================================================================
// Pedido literal de Martín (09/10/2026, sexta tanda; el entero en app/admin/dev/chatbot/bitacora.ts,
// hito «9 oct 18:37»). Lo que fija este archivo, cada cosa con su porqué en el fuente:
//   · El BORRADOR (punto 7): una automatización a medio armar se guarda sola, sin publicar
//     (`crearBorrador`, app/automations/useBorradorSecuencia.ts; se EJECUTA con relojes falsos).
//   · DELAY > 24 h justo antes de Instagram o Messenger: la tarjeta lo avisa (`esperaAntesDe`).
//   · TAG 2 («Se debería poder seleccionar multiple»): la tarjeta nombra TODAS las etiquetas.
//   · CRON 10: una fila por disparador con SU ícono, cada una abre ESE CRON, y «＋ Nuevo CRON».
//   · El cableado que otra parte pidió en los archivos del lienzo (el GET trae el borrador, la ruta lo
//     guarda, la condición vacía pasa a escuchar, el disparador llega al editor del mensaje, el DTO
//     sabe de Instagram/Messenger y de la línea) y el barrido de general 9 (la papelera roja).
//
// PROBADO ROMPIÉNDOLO (09/10/2026; base en verde: 14 pasan, 0 fallan). Cada rotura de a una, aplicada
// y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   B1. `cambio` no suelta el respiro anterior (dos guardados por frase)             -> 13 / 1
//   B2. `cambio` manda aunque sea lo último guardado                                  -> 11 / 3
//   B3. guarda sin haber leído el borrador (`puedeGuardar` ignorado)                  -> 13 / 1
//   B4. `sinColumna` no apaga el guardado                                             -> 13 / 1
//   B5. un rechazo del server no avisa                                                -> 13 / 1
//   B6. `despachar` deja vivo el respiro (sale dos veces)                             -> 13 / 1
//   B7. `descartar` no le avisa al server                                             -> 13 / 1
//   B8. `yaGuardado` no anota lo publicado (vuelve como borrador)                     -> 13 / 1
//   B9. SecuenciaPerfil guarda sin mirar si el GET lo leyó                            -> 13 / 1
//  B10. publicar sin descartar el borrador                                            -> 13 / 1
//  B11. getSettingData dice «ninguno» cuando no lo pudo leer                          -> 13 / 1
//  B12. la ruta guarda el borrador con `setSecuenciaPasos` (lo que lee el motor)      -> 13 / 1
//   V1. dos esperas seguidas no se suman                                              -> 13 / 1
//   V2. la espera «antes de la reunión» cuenta                                        -> 13 / 1
//   V3. el aviso sale también para WhatsApp                                          -> 13 / 1
//   V4. avisa con justo 24 h (`>=`)                                                   -> 13 / 1
//   V5. el aviso le gana a «Sin escribir»                                             -> 13 / 1
//   T1. la tarjeta nombra sólo la primera etiqueta                                    -> 13 / 1
//   C1. la fila del CRON sin el ícono de su clase                                     -> 13 / 1
//   C2. «＋ Nuevo CRON» aunque nadie sepa agregar                                     -> 13 / 1
//   C3. tocar una fila abre un CRON nuevo y no ESE                                    -> 13 / 1
//   C4. la condición vacía ofrece escuchar aunque ya haya otra                        -> 13 / 1
//   C5. el editor del mensaje sin el disparador                                       -> 13 / 1
//   C6. el DTO sin Instagram ni Messenger                                             -> 13 / 1
//   P1. Lienzo vuelve a definir su propia papelera (🗑)                               -> 13 / 1
//   P2. quitar una fila de la condición vuelve a ser la ✕                             -> 13 / 1
//   R1. la que escucha va en el orden del array (después de las sueltas)              -> 13 / 1
//
// REVISIÓN DEL 10/10/2026 (hallazgos #5 y #6: la base del borrador la pone la pestaña; «Descartar
// cambios» y «Volver a lo publicado» borran el borrador). Base en verde: 22 pasan, 0 fallan. Mismo arnés:
//  M1. el guardado no lleva la base                                                  -> 17 / 5
//  M2. `desactualizado` se trata como un rechazo cualquiera                          -> 21 / 1
//  M3. `antesDePublicar` no cierra la compuerta (sale con la base vieja)             -> 20 / 2
//  M4. `publicado` no toma la base nueva                                             -> 20 / 2
//  M5. `antesDePublicar` escucha lo que estaba en vuelo (cartel falso)               -> 21 / 1
//  M6. `noPublicado` no abre la compuerta (el guardado espera para siempre)          -> 21 / 1
//  M7. el borrado no espera lo que ya salió (un guardado lento lo resucita)          -> 21 / 1
//  M8. `descartar` adopta la base del server                                         -> 21 / 1
//  M9. `descartar` no suelta lo pendiente («Descartar cambios» lo guarda)            -> 21 / 1
// M10. un guardado no espera el borrado en vuelo (Ctrl+Z quedaría borrado)            -> 21 / 1
// M11. el respiro no vuelve a mirar lo ya guardado (lo publicado vuelve como borrador) -> 21 / 1
// M12. `cerrar` no espera lo que salió                                                -> 21 / 1
//  H1. el desmonte sólo despacha (no relee la lista)                                 -> 21 / 1
//  S1. Publicar sin cerrar la compuerta                                              -> 21 / 1
//  S2. Publicar con el descarte de antes (sin la base nueva)                         -> 21 / 1
//  S3. el lienzo no le pasa la base al motor                                         -> 21 / 1
//  S4. «Volver a lo publicado» sin borrar el borrador                                -> 21 / 1
//  S5. la ref de «Descartar cambios» no descarta                                     -> 21 / 1
//  S6. «Crear con IA» sin tomar la base nueva                                        -> 21 / 1
//  S7. el lienzo no relee la lista al irse                                           -> 21 / 1
//  X1. la ruta no pasa la base                                                       -> 21 / 1
//  X2. `desactualizado` sale 200                                                     -> 21 / 1
//  G1. el GET no trae la base                                                        -> 21 / 1
// (La primera versión del test de descartar dejaba pasar M8 y M9 en 22 / 0: llamaba a `yaGuardado`
// antes del desmonte —que suelta lo pendiente igual— y miraba la base del guardado que sale ANTES de
// que `descartar` termine. Se partió en los dos momentos.)
//
// Correr: node --import tsx --test tests/chatbot-v6b-flujo.test.ts
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { crearBorrador, ERROR_BORRADOR, ERROR_DESACTUALIZADO, RESPIRO_BORRADOR_MS } from '../app/automations/useBorradorSecuencia';
import { grafoDeSecuencia, esperaAntesDe, AVISO_VENTANA_META, etiquetaDeAccion, type PasoParaGrafo, type NodoFlujo } from '../lib/flujo-conversacion';
import { VENTANA_META_MS } from '../lib/canal-social';
import { CuerpoCron } from '../app/automations/FlujoLienzo';
import { IconoDisparador } from '../app/automations/IconosDisparador';
import type { PasoSecuenciaDto } from '../app/automations/ChatAgentApp';
import { condicionARespuesta, type PasoGrafo } from '../lib/flujo-grafo';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (r: string) => sinComentarios(fuente(r));
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  return src.slice(i, j);
};

// ── El borrador ─────────────────────────────────────────────────────────────────────────────

const flujo = (cuerpo: string): PasoSecuenciaDto[] => [{ id: 'm1', canal: 'whatsapp', delay_horas: 0, cuerpo } as unknown as PasoSecuenciaDto];
/** Deja correr las promesas del `post` (el reloj falso sólo maneja `setTimeout`). */
const drenar = () => new Promise<void>((r) => setImmediate(r));

function armar(opts: { puedeGuardar?: boolean; respuesta?: unknown; tira?: boolean } = {}) {
  const posts: Record<string, unknown>[] = [];
  const guardados: string[] = [];
  const errores: string[] = [];
  const motor = crearBorrador({
    post: async (body) => {
      posts.push(body);
      if (opts.tira) throw new Error('sin red');
      return { json: async () => opts.respuesta ?? (body.action === 'descartar-borrador' ? { ok: true, base: 'B1' } : { ok: true }) };
    },
    inicial: flujo('hola'),
    puedeGuardar: opts.puedeGuardar ?? true,
    base: 'B0',
    avisos: () => ({ onGuardado: (j) => guardados.push(j), onError: (m) => errores.push(m) }),
  });
  return { motor, posts, guardados, errores };
}

/**
 * Como `armar`, pero cada pedido queda EN VUELO hasta que el test lo contesta (`contestar(n, json)`, n en
 * el orden en que salieron): así se prueba el orden entre un guardado lento, Publicar y un borrado.
 */
function armarEnVuelo() {
  const posts: Record<string, unknown>[] = [];
  const respuestas: Array<(j: unknown) => void> = [];
  const guardados: string[] = [];
  const errores: string[] = [];
  const motor = crearBorrador({
    post: (body) => {
      posts.push(body);
      return new Promise((res) => { respuestas.push((j) => res({ json: async () => j })); });
    },
    inicial: flujo('hola'),
    puedeGuardar: true,
    base: 'B0',
    avisos: () => ({ onGuardado: (j) => guardados.push(j), onError: (m) => errores.push(m) }),
  });
  const contestar = async (n: number, j: unknown) => { respuestas[n](j); await drenar(); };
  return { motor, posts, guardados, errores, contestar };
}

test('el borrador se guarda UNA vez por respiro, con el flujo FINAL, y avisa qué quedó guardado', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts, guardados } = armar();
  motor.cambio(flujo('hola'));                 // lo de siempre: no se manda
  motor.cambio(flujo('hola L'));
  mock.timers.tick(RESPIRO_BORRADOR_MS - 1);
  motor.cambio(flujo('hola Lu'));              // tipea antes del respiro: reinicia
  mock.timers.tick(RESPIRO_BORRADOR_MS - 1);
  assert.equal(posts.length, 0, 'se guardó antes del respiro');
  mock.timers.tick(1);
  await drenar();
  assert.equal(posts.length, 1, 'tipear una frase tiene que ser UN guardado');
  assert.equal(posts[0].action, 'borrador');
  assert.deepEqual(posts[0].pasos, flujo('hola Lu'));
  assert.equal(posts[0].base, 'B0', 'el guardado tiene que llevar la base de lo que abrió la pestaña');
  assert.deepEqual(guardados, [JSON.stringify(flujo('hola Lu'))]);
  motor.cambio(flujo('hola Lu'));              // lo mismo que lo guardado: nada
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts.length, 1);
});

test('volver a lo guardado ANTES del respiro no manda nada (deshacer hasta ahí)', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts } = armar();
  motor.cambio(flujo('otra cosa'));
  motor.cambio(flujo('hola'));
  mock.timers.tick(RESPIRO_BORRADOR_MS * 2);
  await drenar();
  assert.equal(posts.length, 0);
});

test('⚠️ sin haber LEÍDO el borrador no se guarda ni se descarta: pisaría uno que la pantalla no vio', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts } = armar({ puedeGuardar: false });
  motor.cambio(flujo('nuevo'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  motor.despachar();
  motor.descartar();
  await drenar();
  assert.equal(posts.length, 0);
});

test('`sinColumna` apaga el guardado sin cartel; un rechazo o la red caída sí avisan', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const sin = armar({ respuesta: { ok: false, sinColumna: true } });
  sin.motor.cambio(flujo('a'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  sin.motor.cambio(flujo('b'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(sin.posts.length, 1, 'siguió intentando con la columna que falta');
  assert.deepEqual(sin.errores, [], 'la columna que falta no es nada que la persona pueda arreglar');

  const no = armar({ respuesta: { ok: false } });
  no.motor.cambio(flujo('a'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.deepEqual(no.errores, [ERROR_BORRADOR]);
  assert.deepEqual(no.guardados, [], 'un rechazo no es «guardado»: salir perdería lo que no se guardó');

  const red = armar({ tira: true });
  red.motor.cambio(flujo('a'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.deepEqual(red.errores, [ERROR_BORRADOR]);
});

test('al irse sale YA lo que esperaba; publicar lo DESCARTA en el server y lo publicado no se manda', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const ida = armar();
  ida.motor.cambio(flujo('a medio armar'));
  ida.motor.despachar();
  await drenar();
  assert.equal(ida.posts.length, 1, 'cerrar la pestaña antes del respiro perdía el cambio');
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(ida.posts.length, 1, 'el respiro volvió a mandar lo ya despachado');

  const pub = armar();
  pub.motor.cambio(flujo('listo'));
  pub.motor.antesDePublicar();
  await pub.motor.publicado(flujo('listo'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.deepEqual(pub.posts.map((p) => p.action), ['descartar-borrador'], 'publicar dejó un borrador vivo, o lo volvió a guardar');
  pub.motor.cambio(flujo('listo'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(pub.posts.length, 1, 'lo recién publicado volvió a guardarse como borrador');
});

// ── La base (revisión de la sexta tanda, 10/10/2026, hallazgos #5 y #6) ─────────────────────────

test('⚠️ `desactualizado`: lo publicado cambió desde que se abrió; no se guarda más y se dice', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts, guardados, errores } = armar({ respuesta: { ok: false, desactualizado: true } });
  motor.cambio(flujo('sobre lo viejo'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.deepEqual(errores, [ERROR_DESACTUALIZADO]);
  assert.deepEqual(guardados, [], 'un rechazo no es «guardado»: salir no preguntaría y se perdería');
  motor.cambio(flujo('otra cosa'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  motor.despachar();
  await drenar();
  assert.equal(posts.length, 1, 'siguió guardando sobre un publicado que ya no es el que abrió');
});

test('⚠️ publicar: lo que sale de su respiro mientras el PATCH viaja ESPERA, y sale con la base NUEVA detrás del borrado', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts, errores, contestar } = armarEnVuelo();
  motor.antesDePublicar();
  motor.cambio(flujo('tocado mientras publicaba'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts.length, 0, 'salió con la base vieja mientras se publicaba: el server diría que otro publicó');
  const listo = motor.publicado(flujo('publicado'));
  await drenar();
  assert.deepEqual(posts.map((p) => p.action), ['descartar-borrador']);
  await contestar(0, { ok: true, base: 'B1' });
  await listo;
  await drenar();
  assert.deepEqual(posts.map((p) => p.action), ['descartar-borrador', 'borrador']);
  assert.equal(posts[1].base, 'B1', 'después de publicar, la base es la de lo publicado');
  assert.deepEqual(posts[1].pasos, flujo('tocado mientras publicaba'));
  assert.deepEqual(errores, []);
});

test('⚠️ lo que estaba en vuelo ANTES de publicar ya no se escucha: su rechazo no dice «Cambió lo publicado»', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts, errores, contestar } = armarEnVuelo();
  motor.cambio(flujo('a'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts.length, 1);
  motor.antesDePublicar();
  // El PATCH ya entró: el guardado lento llega después y el server lo rechaza con la base de antes.
  await contestar(0, { ok: false, desactualizado: true });
  const listo = motor.publicado(flujo('a'));
  await drenar();
  await contestar(1, { ok: true, base: 'B1' });
  await listo;
  assert.deepEqual(errores, [], 'la propia pestaña publicó: el cartel acusaría a otro');
  motor.cambio(flujo('b'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts.length, 3, 'el rechazo viejo apagó el guardado');
  assert.equal(posts[2].base, 'B1');
});

test('si el PATCH falla, lo que esperaba sale con la base de siempre', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts } = armar();
  motor.antesDePublicar();
  motor.cambio(flujo('a'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts.length, 0);
  motor.noPublicado();
  await drenar();
  assert.equal(posts.length, 1, 'el guardado quedó esperando para siempre');
  assert.equal(posts[0].base, 'B0');
});

test('⚠️ descartar («Volver a lo publicado», «Descartar cambios»): lo pendiente NO sale, el borrado va DETRÁS de lo que está en vuelo, y la base no cambia', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { motor, posts, contestar } = armarEnVuelo();
  motor.cambio(flujo('D1'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts.length, 1, 'D1 en vuelo');
  motor.cambio(flujo('D2'));                   // lo que «Descartar cambios» tiene que tirar
  const fin = motor.descartar();               // lo que llama la ref de «Descartar cambios», sin más
  motor.despachar();                           // el desmonte de SecuenciaPerfil
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts.length, 1, 'el borrado salió antes de que volviera D1 (o se mandó D2): un D1 lento lo resucitaba');
  await contestar(0, { ok: true });
  assert.deepEqual(posts.map((p) => p.action), ['borrador', 'descartar-borrador']);
  // Ctrl+Z después de «Volver a lo publicado» (que anota lo publicado como guardado): el guardado sale
  // DETRÁS del borrado, con la base de siempre.
  motor.yaGuardado(flujo('hola'));
  motor.cambio(flujo('D1'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts.length, 2, 'el guardado llegó antes que el borrado: quedaría borrado');
  await contestar(1, { ok: true, base: 'OTRA' });
  await fin;
  await drenar();
  assert.deepEqual(posts.map((p) => p.action), ['borrador', 'descartar-borrador', 'borrador']);
  assert.equal(posts[2].base, 'B0');
  // Y después del borrado tampoco: descartar no publicó nada, y adoptar la base del server es volver al bug.
  motor.cambio(flujo('D3'));
  mock.timers.tick(RESPIRO_BORRADOR_MS);
  await drenar();
  assert.equal(posts[3]?.base, 'B0', 'descartar adoptó la base que contestó el server');
  assert.ok(!posts.some((p) => JSON.stringify(p.pasos) === JSON.stringify(flujo('D2'))), '«Descartar cambios» guardó lo descartado');
});

test('al irse (`cerrar`): espera lo que salió y dice si el server quedó distinto del GET', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  assert.equal(await armar().motor.cerrar(), false, 'sin escribir nada no hay por qué releer la lista');
  const { motor, posts } = armar();
  motor.cambio(flujo('a medio armar'));
  assert.equal(await motor.cerrar(), true);
  assert.equal(posts.length, 1, 'cerrar no despachó lo que esperaba');
  const d = armar();
  void d.motor.descartar();
  assert.equal(await d.motor.cerrar(), true, 'un borrado también deja la lista vieja');
});

test('el lienzo guarda el borrador SÓLO si lo leyó, lo abre si hay, y lo descarta al publicar', () => {
  const sp = codigo('app/automations/SecuenciaPerfil.tsx');
  assert.match(sp, /useBorradorSecuencia\(secuencia\.id, \{\s*puedeGuardar: rolAdmin && secuencia\.borrador !== undefined,/);
  assert.match(sp, /useEffect\(\(\) => \{ borrador\.cambio\(pasos\); \}, \[pasos\]\);/);
  assert.match(sp, /secuencia\.borrador\?\.pasos\?\.length \? renumerar\(normalizar\(secuencia\.borrador\.pasos\)\) : null/);
  // Publicar: la compuerta ANTES del PATCH, abierta en las dos salidas que fallan, y la base nueva después.
  const publicar = tramo(sp, 'const publicar = async () => {', 'if (convertida && limpiar)');
  const iPatch = publicar.indexOf("fetch('/api/whatsapp/secuencias'");
  assert.ok(iPatch > 0);
  assert.ok(publicar.indexOf('borrador.antesDePublicar();') > 0 && publicar.indexOf('borrador.antesDePublicar();') < iPatch, 'la compuerta tiene que cerrarse ANTES del PATCH');
  assert.match(tramo(publicar, 'if (!rp.ok) {', 'setBusy(null); return;'), /borrador\.noPublicado\(\);/);
  assert.match(tramo(publicar, '} catch {', 'return; }'), /borrador\.noPublicado\(\);/);
  assert.ok(publicar.indexOf('void borrador.publicado(pasos);') > iPatch, 'publicar no descarta el borrador ni toma la base nueva');
  // La ruta lo guarda por SU acción (nunca por `setSecuenciaPasos`, que es lo que lee el motor).
  const ruta = codigo('app/api/chat-agent/secuencias/route.ts');
  const rama = tramo(ruta, "if (body.action === 'borrador' || body.action === 'descartar-borrador')", 'status: 404');
  assert.match(rama, /guardarBorradorSecuencia/);
  assert.match(rama, /descartarBorradorSecuencia/);
  assert.doesNotMatch(rama, /setSecuenciaPasos/);
  // El GET lo trae, tolerante: AUSENTE cuando no se pudo leer (no «ninguno»).
  const gsd = codigo('lib/setting-secuencias.ts');
  assert.match(gsd, /leerBorradoresSecuencias\(supabase as unknown as DbBorrador\)/);
  assert.match(gsd, /\.\.\.\(borradores \? \{ borrador: borradores\.get\(s\.id\) \?\? null, base: firmaPublicado\(s\.pasos\) \} : \{\}\)/);
});

test('⚠️ la base viaja de punta a punta: el GET la calcula, el lienzo la manda, la ruta la exige', () => {
  // El GET la calcula sobre la columna CRUDA (la misma que lee `guardarBorradorSecuencia`), dentro del
  // mismo `if` que el borrador (ver el test de arriba).
  const sp = codigo('app/automations/SecuenciaPerfil.tsx');
  const llamada = tramo(sp, 'useBorradorSecuencia(secuencia.id, {', '});');
  assert.match(llamada, /base: \(secuencia as SecuenciaConBase\)\.base,/);
  assert.match(llamada, /onSalir: \(\) => onCambio\(\),/, 'sin releer la lista al irse, volver acá abre lo de la entrada');
  // La ruta pasa la base y contesta 409 cuando ya no es lo publicado.
  const rama = tramo(codigo('app/api/chat-agent/secuencias/route.ts'), "if (body.action === 'borrador' || body.action === 'descartar-borrador')", 'status: 404');
  assert.match(rama, /guardarBorradorSecuencia\(db, id, body\.pasos, body\.base\)/);
  assert.match(rama, /r\.motivo === 'desactualizado'\) return Response\.json\(\{ ok: false, desactualizado: true \}, \{ status: 409 \}\)/);
  assert.match(rama, /'base' in r \? \{ base: r\.base \} : \{\}/, 'descartar no devuelve la base nueva');
  // El hook: el motor nace con la base y al irse relee la lista si el server quedó distinto.
  const hook = codigo('app/automations/useBorradorSecuencia.ts');
  assert.match(hook, /puedeGuardar: opts\.puedeGuardar, base: opts\.base,/);
  assert.match(tramo(hook, 'return () => {', '}, [m]);'), /m\.cerrar\(\)\.then\(\(cambio\) => \{ if \(cambio\) avisos\.current\.onSalir\?\.\(\); \}\)/);
  // «Crear con IA» (crear) también cambia lo publicado: toma la base nueva, como Publicar.
  assert.match(tramo(sp, "if (r.modo === 'crear') {", '} else {'), /void borrador\.publicado\(nuevos\);/);
});

test('⚠️ «Volver a lo publicado» y «Descartar cambios»: los dos BORRAN el borrador, y lo pendiente no sale', () => {
  const sp = codigo('app/automations/SecuenciaPerfil.tsx');
  // El botón: sólo con un borrador abierto, para quien edita, y cuando el lienzo no es lo publicado.
  assert.match(sp, /const ofrecerVolver = rolAdmin && deBorrador && JSON\.stringify\(pasos\) !== JSON\.stringify\(inicial\.abierto\);/);
  assert.match(sp, /\{ofrecerVolver && \(\s*<button type="button" onClick=\{volverAPublicado\}/);
  assert.match(sp, />\s*Volver a lo publicado\s*</);
  const volver = tramo(sp, 'const volverAPublicado = () => {', '};');
  assert.match(volver, /fotoAntes\(\);/, 'sin foto, Ctrl+Z no devuelve el borrador');
  assert.match(volver, /setPasos\(inicial\.abierto\);/);
  assert.match(volver, /void borrador\.descartar\(\)\.then\(\(\) => onCambio\(\)\);/, 'sin releer la lista DESPUÉS del borrado, volver acá reabre el borrador');
  assert.match(volver, /borrador\.yaGuardado\(inicial\.abierto\);/);
  // Publicar lo apaga (ya no hay borrador).
  assert.match(tramo(sp, 'const publicar = async () => {', 'if (convertida && limpiar)'), /setDeBorrador\(false\);/);
  // «Descartar cambios» (la pregunta vive en SimuladorWhatsApp): el lienzo deja en la ref su descarte.
  const reg = tramo(sp, 'if (!descartarBorrador) return;', '}, [descartarBorrador]);');
  assert.match(reg, /descartarBorrador\.current = \(\) => \{ void borrador\.descartar\(\); \};/);
  assert.match(reg, /return \(\) => \{ descartarBorrador\.current = null; \};/);
});
// ⚠️ EL ENCHUFE DE «DESCARTAR CAMBIOS» VIVE EN UN ARCHIVO DE OTRA PARTE (app/automations/SimuladorWhatsApp.tsx,
// revisión del 10/10/2026): hasta que se enchufe, la ref de arriba tiene CERO call sites y «Descartar cambios»
// sigue guardando lo descartado. Quien lo enchufe suma acá el guard de su lado (la ref creada con `useRef`,
// `descartarBorrador.current?.()` en `descartar()` ANTES de `cambiarA` / `onNueva` / `abrirAvisoYa`, y la
// prop pasada a `<SecuenciaPerfil key={sel.id} …>`), probado rompiéndolo.

// ── El aviso de las 24 h ────────────────────────────────────────────────────────────────────

const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const esp = (id: string, siguiente: string | null, minutos: number, modo = 'tiempo'): PasoParaGrafo =>
  ({ id, nodo: 'esperar', espera: { modo, minutos }, siguiente, canal: 'whatsapp', delay_horas: 0, cuerpo: '' } as PasoParaGrafo);
const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => { const n = g.nodos.find((x) => x.id === id); assert.ok(n, `no está el nodo ${id}`); return n!; };
const DIA = VENTANA_META_MS / 60_000;

test('⚠️ un DELAY de más de 24 h justo antes de Instagram o Messenger lo avisa la tarjeta (corto)', () => {
  assert.equal(DIA, 1440, 'la ventana de Meta son 24 h');
  assert.ok(AVISO_VENTANA_META.length <= 22, 'el ⚠ de una tarjeta es corto: el porqué va al comentario');
  for (const canal of ['instagram', 'messenger']) {
    const g = grafoDeSecuencia([esp('e', 'dm', DIA + 60), msg('dm', { canal })], { disparador: 'X' });
    assert.equal(nodo(g, 'dm').advertencia, AVISO_VENTANA_META, `${canal} después de 25 h no avisa`);
  }
  // Justo 24 h todavía sale; WhatsApp no tiene ventana (el no oficial, AGENTS.md).
  assert.equal(nodo(grafoDeSecuencia([esp('e', 'dm', DIA), msg('dm', { canal: 'instagram' })], { disparador: 'X' }), 'dm').advertencia, undefined);
  assert.equal(nodo(grafoDeSecuencia([esp('e', 'w', DIA * 3), msg('w')], { disparador: 'X' }), 'w').advertencia, undefined);
  // «Sin escribir» gana: primero lo que falta.
  assert.equal(nodo(grafoDeSecuencia([esp('e', 'dm', DIA * 2), msg('dm', { canal: 'instagram', cuerpo: '' })], { disparador: 'X' }), 'dm').advertencia, 'Sin escribir');
});

test('dos esperas seguidas son UNA más larga; «antes de la reunión» no cuenta (depende de la fecha)', () => {
  const seguidas = [esp('a', 'b', 720), esp('b', 'dm', 780), msg('dm', { canal: 'messenger' })] as PasoGrafo[];
  assert.equal(esperaAntesDe(seguidas, 'dm'), 1500);
  assert.equal(nodo(grafoDeSecuencia(seguidas as PasoParaGrafo[], { disparador: 'X' }), 'dm').advertencia, AVISO_VENTANA_META);
  // Un mensaje en el medio corta la cuenta: lo que importa es la espera JUSTO antes.
  const cortada = [esp('a', 'm', DIA * 2), msg('m', { siguiente: 'b' }), esp('b', 'dm', 60), msg('dm', { canal: 'instagram' })] as PasoGrafo[];
  assert.equal(esperaAntesDe(cortada, 'dm'), 60);
  const reunion = [esp('a', 'dm', DIA * 2, 'antes_reunion'), msg('dm', { canal: 'instagram' })] as PasoGrafo[];
  assert.equal(esperaAntesDe(reunion, 'dm'), 0);
});

// ── «Si responde» como la CONDITION que escucha ─────────────────────────────────────────────

test('la que escucha va PRIMERO debajo del árbol del CRON, antes que una tarjeta suelta', () => {
  // Punto 12: sin flecha de entrada, va en la columna del CRON. Y aunque en el array venga DESPUÉS de una
  // suelta (lo normal: se crea al final), se dibuja antes, pegada al CRON: es parte de la automatización.
  const vacia = { id: 'escucha', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'condicion', si_no: null, ramas: [{ id: 'escucha_r', modo: 'todas', filas: [], siguiente: null }] } as unknown as PasoGrafo;
  const r = condicionARespuesta([msg('a'), msg('suelta'), vacia] as PasoGrafo[], 'escucha');
  assert.ok(!('error' in r), 'no se pudo pasar la condición a escuchar');
  const g = grafoDeSecuencia((r as { pasos: PasoParaGrafo[] }).pasos, { disparador: 'X' });
  const escucha = nodo(g, 'escucha');
  const suelta = nodo(g, 'suelta');
  assert.equal(suelta.suelta, true);
  assert.equal(escucha.suelta, undefined, 'la que escucha no es una suelta');
  assert.ok(escucha.y < suelta.y, 'la suelta quedó entre el CRON y la que escucha');
});

// ── El TAG con varias etiquetas ─────────────────────────────────────────────────────────────

test('TAG 2: la tarjeta nombra TODAS las etiquetas elegidas, no sólo la primera', () => {
  const nombres = { etiqueta: (id: number) => ({ 1: 'Cualificado', 2: 'Seguimiento', 3: 'VIP', 4: 'Frío' } as Record<number, string>)[id] ?? 'una etiqueta' };
  const tag = (ids: number[]) => msg('t', { cuerpo: '', accion: { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaIds: ids } } } as Partial<PasoParaGrafo>);
  const detalle = (ids: number[]) => nodo(grafoDeSecuencia([tag(ids)], { disparador: 'X', nombres }), 't').detalle;
  assert.equal(detalle([1]), 'Agregar Cualificado');
  assert.equal(detalle([1, 2]), 'Agregar Cualificado y Seguimiento');
  assert.equal(detalle([1, 2, 3, 4]), 'Agregar Cualificado, Seguimiento y 2 más');
  const e = etiquetaDeAccion(tag([2, 3]) as PasoGrafo);
  assert.deepEqual(e && { id: e.etiquetaId, ids: e.etiquetaIds }, { id: 2, ids: [2, 3] }, 'la primera sigue en `etiquetaId` (lo que leen los de antes)');
});

// ── El CRON con varios disparadores ─────────────────────────────────────────────────────────

test('CRON 10: una fila por disparador con SU ícono, cada una abre ESE CRON, y «＋ Nuevo CRON»', () => {
  const ds = [{ id: 'd1', texto: 'Entra a Ventas', icono: 'producto' }, { id: 'd2', texto: 'Todos los lunes', icono: 'recurrente' }];
  const html = renderToStaticMarkup(createElement(CuerpoCron, { disparadores: ds, onAbrir: () => {}, onNuevo: () => {} }));
  assert.match(html, /data-disparador="d1"/);
  assert.match(html, /data-disparador="d2"/);
  assert.ok(html.indexOf('Entra a Ventas') < html.indexOf('Todos los lunes'), 'las filas no van en el orden de la lista');
  for (const tipo of ['producto', 'recurrente'] as const) {
    assert.ok(html.includes(renderToStaticMarkup(createElement(IconoDisparador, { tipo, tam: 16 }))), `la fila de ${tipo} no lleva el ícono de su clase`);
  }
  assert.match(html, /＋ Nuevo CRON/);
  // Sin quien sepa agregar, no se ofrece; sin quien sepa abrir, las filas no son botones.
  const soloVer = renderToStaticMarkup(createElement(CuerpoCron, { disparadores: ds }));
  assert.doesNotMatch(soloVer, /Nuevo CRON|data-disparador|<button/);
  // Y cada fila abre la suya: el id viaja hasta `setCronAbierto` (no «el CRON», uno).
  const fl = codigo('app/automations/FlujoLienzo.tsx');
  assert.match(fl, /onAbrir=\{disparadores\?\.length && onAbrirDisparador \? \(did\) => \{ setSel\(ID_ENTRADA\); onAbrirDisparador\(did\); \} : undefined\}/);
  assert.match(fl, /onClick=\{\(\) => onAbrir\(d\.id\)\}/);
  const sp = codigo('app/automations/SecuenciaPerfil.tsx');
  assert.match(sp, /onAbrirDisparador=\{\(id\) => setCronAbierto\(id\)\}/);
  assert.match(sp, /const filasCron = crons\.lista\.map\(\(d\) => \(\{ id: d\.id, texto: textosCron\.texto\(d\), icono: iconoDeDisparador\(d\) \}\)\);/);
});

// ── Los enchufes que otra parte pidió en los archivos del lienzo ────────────────────────────

test('la condición VACÍA pasa a escuchar desde su editor, y sólo si no hay otra que escuche', () => {
  const fl = codigo('app/automations/FlujoLienzo.tsx');
  const caso = tramo(fl, "case 'condicion': {", "case 'respuesta':");
  assert.match(caso, /\(paso\.ramas \?\? \[\]\)\.every\(\(r\) => !r\.filas\?\.length\) && !raizRespuesta\(pr\.pasos\)/);
  assert.match(caso, /condicionARespuesta\(prev, id\)/);
  assert.match(caso, /onPasarARespuesta=\{pasarARespuesta\}/);
});

test('el editor del mensaje recibe el disparador; el DTO sabe de Instagram, Messenger y la línea', () => {
  const fl = codigo('app/automations/FlujoLienzo.tsx');
  const editorMsg = tramo(fl, '<EditorMensajeWhatsApp', '/>');
  assert.match(editorMsg, /disparador=\{disparador\}/);
  const app = codigo('app/automations/ChatAgentApp.tsx');
  const dto = tramo(app, 'export type PasoSecuenciaDto', '};');
  assert.match(dto, /canal: 'email' \| 'whatsapp' \| CanalSocial;/);
  assert.match(dto, /linea\?: string \| null;/);
  assert.doesNotMatch(fl, /as PasoConLinea|PasoConLinea\b/, 'el cast de la línea ya no hace falta');
});

// ── El barrido: la papelera roja de la casa ─────────────────────────────────────────────────

test('general 9: «borrar» es UNA definición (app/_ui/BotonBorrar.tsx) en los archivos del lienzo', () => {
  for (const r of ['app/_components/Lienzo.tsx', 'app/automations/FlujoLienzo.tsx', 'app/automations/EditorDisparadores.tsx', 'app/automations/OnboardingChatAgent.tsx', 'app/automations/EditorCondicion.tsx']) {
    const c = codigo(r);
    assert.match(c, /from '@\/app\/_ui\/BotonBorrar'/, `${r} no usa la papelera de la casa`);
    assert.doesNotMatch(c, /function IconoBorrar\b/, `${r} define su propia papelera`);
    assert.doesNotMatch(c, /🗑|name="trash"/, `${r} dibuja la papelera vieja`);
  }
  const quitar = tramo(codigo('app/automations/EditorCondicion.tsx'), 'function BotonQuitar(', '\n}');
  assert.match(quitar, /<BotonBorrar talla="sm"/);
  assert.doesNotMatch(quitar, /✕/, 'quitar una fila vuelve a ser la ✕ gris, que se lee como «cerrar»');
});
