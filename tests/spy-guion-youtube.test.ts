// =============================================================================
// El guion de un video de YouTube: lo transcribe el Gemini del negocio desde su enlace (4/11/2026)
// =============================================================================
// Martín (por el Cerebro): «Con Gemini le pides y te lo da entero». La API de Gemini acepta el enlace de un video PÚBLICO de
// YouTube como `fileData.fileUri`: no se baja nada ni se pasa por Apify. Lo que se fija:
//   1. un video de YouTube tiene guion y su enlace es el `watch?v=` de su id; los tramos salen de su duración;
//   2. la primera vez: una del tope del día, sus tramos DE A UNO (una sola clave), el guion entero y hasta dónde llegó;
//   3. un «high demand» lo deja PENDIENTE: sin motivo, sin sumar un fallo, sin pedir el tramo siguiente, y desde su hora;
//   4. el tope del día también lo deja pendiente, sin llamar a Gemini; un error de verdad es un fallo con su espera;
//   5. un «transcribiendo» de YouTube no se da por cortado a los 6 minutos; la pantalla: pendiente y sin Gemini;
//   6. `guionDeYoutubeConGemini` REAL contra un Gemini de mentira (tests/_spy-guion-yt-hijo.ts): la clave del negocio, el video
//      en `fileData`, el tramo, la resolución baja, el 503 al otro modelo y el uso registrado;
//   7. el servidor, la ruta y la pantalla pasan por acá (y la pantalla no ofrece conectar Gemini).
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada, base en verde (qué tests caen):
//   · `transcribirGuionYoutube` con los tramos en paralelo (Promise.all)       → 2, 3
//   · un saturado que cuenta como fallo (`fallo(t.error)` siempre)            → 3
//   · sin `reservarDia` antes de llamar                                         → 2, 3, 4
//   · `hayQueTranscribir` sin `venceMs`                                         → 5
//   · `guionDeYoutubeConGemini` sin `videoMetadata`                             → 6
//   · `guionDeYoutubeConGemini` que con un 400 prueba el otro modelo           → 6
//   · la ruta sin `conSuIADelNegocio` alrededor de `provsDe('gemini')`         → 7
// Y el piso de caracteres por minuto (6/11/2026), base 8/0:
//   · `guionDeYoutubeConGemini` sin el piso (toma cualquier texto)              → 6
//   · el video entero pedido sin su duración                                    → 6b
//   · el `corto` de un tramo que no llega a la nota                             → 6b
// Correr: node --import tsx --test tests/spy-guion-youtube.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ESPERA_SATURADO_MS, ESPERA_TOPE_MS, ESPERA_TRAS_FALLO_MS, NOTA_GUION_CORTO, NOTA_PENDIENTE, TOPE_GUION_YT, TRANSCRIBIENDO_VENCE_MS, TRANSCRIBIENDO_YT_VENCE_MS,
  enlaceDeLaPublicacion, esDeYoutube, hayQueTranscribir, leerGuion, reclamarGuion, segundosDeDuracion, tieneGuion, tramosDeYoutube,
  transcribirGuionYoutube, vistaDeGuion, type DepsGuionYoutube, type ResultadoTramoYt,
} from '../lib/spy-transcripcion';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const URL_YT = 'https://www.youtube.com/watch?v=AbCdEfGhIj0';
const T0 = Date.parse('2026-11-04T12:00:00Z');

type Doble = DepsGuionYoutube & {
  store: { crudo: string | null };
  pedidos: Array<{ desdeS: number; hastaS: number } | null>;
  /** La duración que se le pasó a cada pedido (sólo con el video entero). */
  duraciones: Array<number | null | undefined>;
  /** Cuántos pedidos hubo a la vez como máximo. */
  maxAlaVez: number;
  reservas: number;
  hayDia: boolean;
  respuestas: ResultadoTramoYt[];
};

function doble(): Doble {
  let n = 0;
  let enCurso = 0;
  const d: Doble = {
    store: { crudo: null }, pedidos: [], duraciones: [], maxAlaVez: 0, reservas: 0, hayDia: true, respuestas: [],
    leer: async () => ({ crudo: d.store.crudo, version: d.store.crudo }),
    cambiarSi: async (version, nuevo) => {
      if (d.store.crudo !== version) return false;
      d.store.crudo = nuevo;
      return true;
    },
    youtube: async (_url, tramo, duracionS) => {
      d.pedidos.push(tramo);
      d.duraciones.push(duracionS);
      enCurso += 1;
      d.maxAlaVez = Math.max(d.maxAlaVez, enCurso);
      await new Promise((ok) => setTimeout(ok, 5));
      enCurso -= 1;
      return d.respuestas.shift() ?? { ok: true, texto: `Lo que se dice del ${tramo ? tramo.desdeS : 0} en adelante.`, tokens: 1000 };
    },
    reservarDia: async () => { d.reservas += 1; return d.hayDia; },
    nuevoIntento: () => `t${++n}`,
  };
  return d;
}

async function unaVez(d: Doble, ahora: number, duracion: string | null) {
  const r = await reclamarGuion(d, ahora, TRANSCRIBIENDO_YT_VENCE_MS);
  if (!r.corre) return { corrio: false as const, actual: r.actual };
  return { corrio: true as const, fin: await transcribirGuionYoutube(d, URL_YT, duracion, r, () => ahora + 1000) };
}

test('1. un video de YouTube tiene guion, con su enlace; los tramos salen de su duración', () => {
  assert.equal(tieneGuion({ canal: 'youtube', tipo: 'video', ref: 'AbCdEfGhIj0' }), true);
  assert.equal(tieneGuion({ canal: 'youtube', tipo: 'video', ref: 'corto' }), false, 'sin un id de 11 no hay enlace');
  assert.equal(enlaceDeLaPublicacion({ canal: 'youtube', url: 'https://youtu.be/AbCdEfGhIj0', ref: 'AbCdEfGhIj0' }), URL_YT);
  assert.equal(esDeYoutube(URL_YT), true);
  assert.equal(esDeYoutube('https://www.instagram.com/reel/DAbc123xyz/'), false);
  assert.equal(segundosDeDuracion('PT1H2M3S'), 3723);
  assert.equal(segundosDeDuracion('PT45S'), 45);
  assert.equal(segundosDeDuracion(''), null);
  assert.deepEqual(tramosDeYoutube('PT9M'), { tramos: [null], cortado: false }, 'uno corto, entero');
  assert.deepEqual(tramosDeYoutube('PT25M'), {
    tramos: [{ desdeS: 0, hastaS: 600 }, { desdeS: 600, hastaS: 1200 }, { desdeS: 1200, hastaS: 1500 }], cortado: false,
  });
  assert.deepEqual(tramosDeYoutube('PT2H'), {
    tramos: [{ desdeS: 0, hastaS: 600 }, { desdeS: 600, hastaS: 1200 }, { desdeS: 1200, hastaS: 1800 }], cortado: true,
  }, 'uno de dos horas: los primeros 30 minutos');
  assert.deepEqual(tramosDeYoutube(null), { tramos: [{ desdeS: 0, hastaS: 600 }], cortado: null }, 'sin duración: un tramo, sin afirmar que sigue');
});

test('2. la primera vez: una del tope, los tramos de a uno, el guion entero y hasta dónde llegó', async () => {
  const d = doble();
  const v = await unaVez(d, T0, 'PT2H');
  assert.equal(v.corrio, true);
  assert.equal(d.reservas, 1, 'una del tope por video, no por tramo');
  assert.deepEqual(d.pedidos, [{ desdeS: 0, hastaS: 600 }, { desdeS: 600, hastaS: 1200 }, { desdeS: 1200, hastaS: 1800 }]);
  assert.equal(d.maxAlaVez, 1, 'de a uno: con una sola clave, en paralelo es un «high demand» seguro');
  const g = leerGuion(d.store.crudo)!;
  assert.equal(g.estado, 'listo');
  assert.match(g.texto ?? '', /del 0 en adelante[\s\S]*del 600 en adelante[\s\S]*del 1200 en adelante/);
  assert.equal(g.motivo, 'Hasta el minuto 30.');
  // Abrirlo otra vez no vuelve a pagar.
  const otra = await unaVez(d, T0 + 60_000, 'PT2H');
  assert.equal(otra.corrio, false);
  assert.equal(d.reservas, 1);
  // Uno corto, sin nota; y el techo del guion de YouTube.
  const corto = doble();
  corto.respuestas = [{ ok: true, texto: 'Palabra. '.repeat(10_000), tokens: 1 }];
  await unaVez(corto, T0, 'PT4M');
  const gc = leerGuion(corto.store.crudo)!;
  assert.deepEqual(corto.pedidos, [null]);
  assert.equal(gc.motivo, null);
  assert.ok((gc.texto ?? '').length <= TOPE_GUION_YT);
  // Sin voz: se dice y no se vuelve a pagar.
  const mudo = doble();
  mudo.respuestas = [{ ok: true, texto: '', tokens: 1 }];
  await unaVez(mudo, T0, 'PT4M');
  assert.equal(leerGuion(mudo.store.crudo)?.motivo, 'No tiene voz: es sólo música o imagen.');
});

test('3. un «high demand» lo deja pendiente: sin motivo, sin fallo, sin el tramo siguiente, y desde su hora', async () => {
  const d = doble();
  d.respuestas = [{ ok: true, texto: 'Primer tramo.', tokens: 1 }, { ok: false, motivo: 'saturado', error: 'HTTP 503 high demand' }];
  await unaVez(d, T0, 'PT2H');
  assert.equal(d.pedidos.length, 2, 'no pide el tercer tramo: no se gasta en cadena');
  const g = leerGuion(d.store.crudo)!;
  assert.equal(g.estado, 'no-pudo');
  assert.equal(g.motivo, null, 'sin cartel');
  assert.equal(g.fallos, 0, 'no es un fallo');
  assert.equal(g.reintentarEn, new Date(T0 + 1000 + ESPERA_SATURADO_MS).toISOString());
  assert.equal(hayQueTranscribir(g, T0 + 10 * 60_000), false, 'no se reintenta en cadena');
  assert.equal(hayQueTranscribir(g, T0 + 1000 + ESPERA_SATURADO_MS), true, 'desde su hora, sí');
  assert.deepEqual(vistaDeGuion(g, { aplica: true, ahora: T0 + 60_000 }), { estado: 'no-pudo', texto: null, motivo: NOTA_PENDIENTE });
  // A su hora vuelve a correr entero, y con los fallos como estaban.
  const otra = await unaVez(d, T0 + 1000 + ESPERA_SATURADO_MS, 'PT2H');
  assert.equal(otra.corrio, true);
  assert.equal(leerGuion(d.store.crudo)?.estado, 'listo');
  assert.equal(d.reservas, 2);
});

test('4. el tope del día también lo deja pendiente sin llamar a Gemini; un error de verdad es un fallo con su espera', async () => {
  const d = doble();
  d.hayDia = false;
  await unaVez(d, T0, 'PT5M');
  assert.equal(d.pedidos.length, 0, 'sin una del tope no se llama');
  const g = leerGuion(d.store.crudo)!;
  assert.equal(g.motivo, null);
  assert.equal(g.fallos, 0);
  assert.equal(g.reintentarEn, new Date(T0 + 1000 + ESPERA_TOPE_MS).toISOString());

  const f = doble();
  f.respuestas = [{ ok: false, motivo: 'fallo', error: 'No pude abrir ese video: es privado.' }];
  await unaVez(f, T0, 'PT5M');
  const gf = leerGuion(f.store.crudo)!;
  assert.equal(gf.motivo, 'No pude abrir ese video: es privado.');
  assert.equal(gf.fallos, 1);
  assert.equal(gf.reintentarEn ?? null, null);
  assert.equal(hayQueTranscribir(gf, T0 + ESPERA_TRAS_FALLO_MS - 1), false);

  // Si el pedido TIRA (un permiso, la red), es un fallo y no un «transcribiendo» colgado.
  const t = doble();
  t.youtube = async () => { throw new Error('se cayó'); };
  await unaVez(t, T0, 'PT5M');
  assert.equal(leerGuion(t.store.crudo)?.estado, 'no-pudo');
});

test('5. un «transcribiendo» de YouTube no se corta a los 6 minutos; la pantalla sin Gemini no lo reclama', async () => {
  const g = leerGuion(JSON.stringify({ estado: 'transcribiendo', intento: 'x', desde: new Date(T0).toISOString(), fallos: 0 }));
  const siete = T0 + TRANSCRIBIENDO_VENCE_MS + 60_000;
  assert.equal(hayQueTranscribir(g, siete), true, 'el de un reel, sí');
  assert.equal(hayQueTranscribir(g, siete, TRANSCRIBIENDO_YT_VENCE_MS), false, 'el de YouTube sigue trabajando');
  assert.equal(hayQueTranscribir(g, T0 + TRANSCRIBIENDO_YT_VENCE_MS + 1, TRANSCRIBIENDO_YT_VENCE_MS), true);
  const d = doble();
  d.store.crudo = JSON.stringify({ estado: 'transcribiendo', intento: 'viejo', desde: new Date(T0).toISOString(), fallos: 0 });
  const r = await reclamarGuion(d, siete, TRANSCRIBIENDO_YT_VENCE_MS);
  assert.equal(r.corre, false, 'el reclamo usa el mismo reloj');
  assert.deepEqual(vistaDeGuion(null, { aplica: true, sinGemini: true }), { estado: 'sin-gemini' });
});

type Pedido = { modelo: string; clave: string; video: string | null; tramo: unknown; resolucion: string | null };
type Vuelta = { r: { ok: boolean; motivo?: string; texto?: string; error?: string; tiro?: string; corto?: true }; pedidos: Pedido[]; otros: string[]; uso: Array<Record<string, unknown>>; saturadoLatest: boolean };
let R: Record<string, Vuelta> & { error?: string };
const hijo = () => {
  if (R) return R;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_spy-guion-yt-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  return R;
};

test('6. Gemini de mentira: la clave del negocio, el video en fileData, el tramo, el 503 al otro modelo y el uso', () => {
  const R = hijo();
  assert.equal(R.error, undefined, String(R.error));
  const a = R.A;
  assert.equal(a.r.ok, true);
  assert.equal(a.pedidos.length, 1);
  assert.equal(a.pedidos[0].video, URL_YT, 'el enlace va como fileData.fileUri: no se baja nada');
  assert.match(a.pedidos[0].clave, /^gemini-13-/, 'la clave del negocio');
  assert.deepEqual(a.pedidos[0].tramo, { startOffset: '600s', endOffset: '1200s' });
  assert.equal(a.pedidos[0].resolucion, 'MEDIA_RESOLUTION_LOW');
  assert.equal(a.otros.length, 0, 'nada fuera de Google y la base');
  assert.equal(a.uso.length, 1, 'el uso queda registrado');
  assert.equal(a.uso[0].feature, 'spy');
  assert.equal(a.uso[0].workspace_id, 13);
  assert.equal(a.uso[0].input_tokens, 18_600);
  assert.equal(R.B.pedidos[0].tramo, null, 'un video corto va entero');
  // Un «high demand»: el otro modelo, y el saturado queda anotado.
  assert.deepEqual(R.C.pedidos.map((p) => p.modelo), ['gemini-flash-latest', 'gemini-flash-lite-latest']);
  assert.equal(R.C.r.ok, true);
  assert.equal(R.C.saturadoLatest, true);
  assert.equal(R.D.r.ok, false);
  assert.equal(R.D.r.motivo, 'saturado', 'todos saturados: pendiente, no fallo');
  // Un 400 no cambia con otro modelo.
  assert.equal(R.E.r.motivo, 'fallo');
  assert.equal(R.E.pedidos.length, 1);
  // Sin Gemini, o un enlace que no es el de un video: nada sale.
  assert.equal(R.F.r.motivo, 'sin-gemini');
  assert.equal(R.F.pedidos.length, 0);
  assert.equal(R.G.r.motivo, 'fallo');
  assert.equal(R.G.pedidos.length, 0);
  // Un guion cortado no se toma como entero; «(vacío)» es sin voz.
  assert.equal(R.H.r.motivo, 'fallo');
  assert.equal(R.I.r.ok, true);
  assert.equal(R.I.r.texto, '');
  // El piso: dos frases en 10 minutos con STOP van al otro modelo, que lo trae entero. Las dos vueltas se pagaron y se ven.
  assert.deepEqual(R.J.pedidos.map((p) => p.modelo), ['gemini-flash-latest', 'gemini-flash-lite-latest']);
  assert.equal(R.J.r.ok, true);
  assert.equal(R.J.r.corto, undefined, 'el del otro modelo pasó el piso');
  assert.match(R.J.r.texto ?? '', /gemini-flash-lite-latest/);
  assert.equal(R.J.uso.length, 2, 'cada respuesta de Google se registra: el pedido corto también costó');
  // Los dos cortos: el más largo, marcado, nunca un fallo (un video de poca voz existe).
  assert.equal(R.K.r.ok, true);
  assert.equal(R.K.r.corto, true);
  assert.equal(R.K.pedidos.length, 2);
  // El video entero con su duración también tiene piso; sin duración (vuelta B), no.
  assert.deepEqual(R.L.pedidos.map((p) => p.modelo), ['gemini-flash-latest', 'gemini-flash-lite-latest']);
  assert.equal(R.L.r.corto, undefined);
  // «(vacío)» en 10 minutos con piso: se pregunta al otro, que sí lo transcribe.
  assert.equal(R.M.pedidos.length, 2);
  assert.equal(R.M.r.corto, undefined);
});

test('6b. un tramo corto en todos los modelos se guarda y se dice; el video entero lleva su duración', async () => {
  const d = doble();
  d.respuestas = [{ ok: true, texto: 'Lo poco que se dijo.', tokens: 1, corto: true }];
  await unaVez(d, T0, 'PT4M');
  assert.deepEqual(d.duraciones, [240], 'el video entero se pide con su duración, para que tenga piso');
  const g = leerGuion(d.store.crudo)!;
  assert.equal(g.estado, 'listo');
  assert.equal(g.texto, 'Lo poco que se dijo.');
  assert.equal(g.motivo, NOTA_GUION_CORTO);
  // Uno largo: la nota de hasta dónde y la de corto, juntas.
  const largo = doble();
  largo.respuestas = [{ ok: true, texto: 'Primer tramo.', tokens: 1 }, { ok: true, texto: 'Segundo corto.', tokens: 1, corto: true }];
  await unaVez(largo, T0, 'PT2H');
  assert.equal(leerGuion(largo.store.crudo)?.motivo, `Hasta el minuto 30. ${NOTA_GUION_CORTO}`);
  assert.deepEqual(largo.duraciones, [null, null, null], 'un tramo ya dice cuánto dura');
  // Vacío y corto: no se afirma «no tiene voz».
  const mudo = doble();
  mudo.respuestas = [{ ok: true, texto: '', tokens: 1, corto: true }];
  await unaVez(mudo, T0, 'PT4M');
  assert.doesNotMatch(leerGuion(mudo.store.crudo)?.motivo ?? '', /No tiene voz/);
});

test('7. el servidor, la ruta y la pantalla pasan por acá', () => {
  const srv = sinComentarios(leer('lib/spy-transcripcion-servidor.ts'));
  assert.match(srv, /guionDeYoutubeConGemini\(url, tramo, \{ feature: 'spy'/);
  assert.match(srv, /reservarDelDia\(CLAVE_DIA_GUIONES_YT, GUIONES_YT_POR_DIA\)/, 'el tope del día, contado en la base');
  assert.match(srv, /reclamarGuion\(deps, Date\.now\(\), TRANSCRIBIENDO_YT_VENCE_MS\)/);
  assert.match(srv, /select\('id, competidor_id, canal, tipo, ref, url, duracion'\)/);
  assert.doesNotMatch(srv, /GEMINI_API_KEY|provsGratisDePlataforma/, 'nunca la clave de Gemini de la plataforma');
  const ruta = sinComentarios(leer('app/api/competitor-spy/transcribir/route.ts'));
  assert.match(ruta, /conSuIADelNegocio\(ws, async \(\) => \(await provsDe\('gemini'\)\)\.length > 0\)/, 'D6b también para la pregunta');
  const ai = sinComentarios(leer('lib/ai-cheap.ts'));
  const fn = ai.slice(ai.indexOf('export async function guionDeYoutubeConGemini'), ai.indexOf('async function', ai.indexOf('export async function guionDeYoutubeConGemini') + 10));
  assert.ok(fn.length > 500 && fn.length < 6000, `recorte de ${fn.length}`);
  assert.match(fn, /await exigirPermisoIa\(\);/);
  assert.match(fn, /provsDe\('gemini'\)/);
  assert.match(fn, /modelosSttGemini\(\)/, 'los modelos en un solo lugar');
  assert.doesNotMatch(fn, /'gemini-[\w.-]+'/, 'ningún modelo escrito a mano');
  const detalle = sinComentarios(leer('app/competitor-spy/DetallePieza.tsx'));
  assert.doesNotMatch(detalle, /servicio="gemini"|Conecta tu Gemini/, 'no se ofrece conectar Gemini (Martín, 25/10/2026)');
  assert.match(detalle, /guion\.estado === 'sin-gemini'\) \{\s*return null;/);
  assert.match(detalle, /\{guion\.motivo \? <p className="spyd-nota">\{guion\.motivo\}<\/p> : null\}/, 'hasta dónde llegó, debajo del guion');
});
