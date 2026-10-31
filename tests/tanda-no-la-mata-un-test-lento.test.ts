// =============================================================================
// Un test lento no puede matar la tanda de los otros 99 (31/10/2026, run 41207922805)
// =============================================================================
// EL SÍNTOMA, y por qué el diagnóstico obvio era el equivocado: el paso «Tests afectados» salió con **99** («no se pudo
// chequear», no rojo) y el log decía, de dos tandas de 100:
//   `tanda 13/14 · 100 archivos · 426 casos juzgados (sin el pie del runner) · ROJA (? archivos) · 5 min 20 s`
//   `⚠ NO CORRIÓ: … estuvo 5 min 0 s sin terminar un solo caso: un test se colgó.`
// No se había colgado NADA: los 100 archivos pasaban. Lo que pasó son dos cosas juntas:
//
//   1. **Node imprime la salida de un archivo de test cuando el archivo TERMINA.** Medido: con tres archivos y
//      `--test-concurrency=3`, los dos rápidos (1 ms) imprimen sus casos recién cuando el lento (6 s) terminó — las tres
//      líneas salen juntas, a los 6 s. Así que mientras corre el archivo más lento, su tanda **no imprime nada**, aunque los
//      otros 99 ya hayan pasado. Por eso el log mostraba 426 casos de 880: los otros 454 estaban en la cola del reporte.
//   2. **El vigía de `tests-afectados` mide «¿imprimió un caso nuevo?»** y mata al proceso que no imprime en
//      `TOPE_SIN_AVANCE_MS` (5 min). Con lo de arriba, eso no mide «está colgado»: mide el archivo más LENTO de la tanda.
//
// Y los dos archivos que la mataron se DECLARABAN más lentos que el vigía: `spawnSync(…, { timeout: 400_000 })`, 400 s de
// permiso contra 300 s de paciencia. Tardaban 234 s y 236 s en una PC libre (casi todo durmiendo la ventana de silencio del
// doer, 8-20 s por escena) y en el runner de Actions pasaron los 300 s.
//
// LO QUE SE FIJA ACÁ es la relación entre los dos números, que es lo único que no se puede medir mirando un archivo solo:
// ningún test puede darle a un hijo más tiempo del que el vigía le da a la tanda ENTERA. Un test que necesite más tiempo
// declara su excepción acá, con el motivo, y entonces se sabe que esa tanda se puede morir por él.
//
// ⚠️ PROBADO ROMPIÉNDOLO (31/10/2026, base 4/0): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { elQueNoDejoAvanzar, LENTOS_FUERA_DE_LA_FASE_RAPIDA, planear, porQueSeMato, sinAvanceDe, sinComentarios, titulosDe, topeDeclarado, TOPE_SIN_AVANCE_MS } from '../scripts/tests-afectados.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const leer = (f: string) => readFileSync(join(REPO, f), 'utf8');
/** `-co`: también los que todavía no están commiteados. Un test nuevo con un tope de más tiene que doler ANTES del commit. */
const porGit = (patron: string) => execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard', '--', patron], { cwd: REPO, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  .split('\0').filter(Boolean);

const TESTS = porGit('tests/*.test.ts');

/**
 * LO QUE UN TEST SE PERMITE: cada `timeout: N` que le pasa a un hijo. Es la declaración de «este archivo puede tardar N»,
 * y es el número que hay que comparar con la paciencia del vigía.
 * ⚠️ SIN LOS COMENTARIOS, y no es un detalle: este archivo mismo CITA el `timeout: 400_000` que causó el 99 para explicarlo,
 * y un guard que lee el fuente crudo se pondría rojo por su propia explicación — el día que alguien lo commitee, no hoy.
 */
const topesDe = (src: string) => [...sinComentarios(src).matchAll(/timeout:\s*([\d_]+)/g)].map((m) => Number(m[1].replace(/_/g, '')));

/**
 * LAS EXCEPCIONES, con su motivo. Un archivo acá adentro PUEDE matar su tanda: queda escrito para que el 99 no vuelva a
 * leerse como un cuelgue. No se agrega uno sin medirlo.
 */
const PERMITIDOS: Record<string, string> = {
  // Corre el `tsc` de verdad varias veces: 754 s medidos el 22/10/2026 (32 de 32 en verde) y la tanda lo mató con «un test se
  // colgó» (docs/hallazgos-infra.md). Acortarle el tope lo pondría ROJO en una máquina lenta, que es peor que un 99. Lo que
  // falta es que `tests-afectados` le dé su propio presupuesto, o que ese test no nombre archivos ajenos.
  'tests/tipos-por-tandas.test.ts': 'corre el tsc de verdad (754 s medidos): necesita su propio presupuesto, no un tope más corto',
};

test('ningún test le da a un hijo más tiempo del que el vigía de tandas le da a los 100 archivos juntos', () => {
  assert.ok(TESTS.length > 500, `¿sólo ${TESTS.length} tests? la lista no se armó`);
  const pasados: string[] = [];
  for (const f of TESTS) {
    const mayor = Math.max(0, ...topesDe(leer(f)));
    if (mayor > TOPE_SIN_AVANCE_MS && !(f in PERMITIDOS)) pasados.push(`${f} (${Math.round(mayor / 1000)} s)`);
  }
  assert.deepEqual(pasados, [],
    `estos tests le dan a un hijo más de los ${TOPE_SIN_AVANCE_MS / 1000} s que el vigía le da a la tanda ENTERA: cuando el hijo `
    + 'se pase, el vigía mata los 100 archivos con 99 en vez de poner rojo a este archivo. Bajale el tope, o declaralo en '
    + 'PERMITIDOS con el motivo medido.');
});

test('las excepciones declaradas siguen existiendo y siguen siendo excepciones', () => {
  for (const [f, motivo] of Object.entries(PERMITIDOS)) {
    assert.ok(TESTS.includes(f), `${f} ya no existe: sacalo de PERMITIDOS (una excepción a un archivo que no está esconde el próximo caso)`);
    assert.ok(motivo.length > 40, `${f}: el motivo tiene que decir POR QUÉ y cuánto se midió, no ser una etiqueta`);
    assert.ok(Math.max(0, ...topesDe(leer(f))) > TOPE_SIN_AVANCE_MS,
      `${f} ya entra en la paciencia del vigía: sacalo de PERMITIDOS, no necesita excepción`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Y que el mensaje del vigía nombre al ARCHIVO, con los dos casos REALES del run
// ─────────────────────────────────────────────────────────────────────────────

/** Las dos tandas del run 41207922805, recortadas al tramo que importa y en el orden en que se las pasó a node. */
const TANDA_13 = ['tests/graficos-datos-corte.test.ts', 'tests/graficos-ia-red.test.ts', 'tests/grupo-leandro-2910.test.ts', 'tests/guardian-metodologia.test.ts'].map((f) => join(REPO, f));
const TANDA_12 = ['tests/chat-mako-nota-de-voz.test.ts', 'tests/chat-mako-orden-del-flujo.test.ts', 'tests/clase-del-grupo.test.ts', 'tests/claude-pausado-aviso.test.ts'].map((f) => join(REPO, f));
/**
 * Los títulos se SACAN del archivo, no se copian acá. Dos razones, las dos medidas el 31/10/2026:
 *  · copiados, el guard se rompe el día que alguien renombra un test de otro archivo, por un motivo que no tiene nada que ver;
 *  · y `elQueNoDejoAvanzar` buscaba el título en el FUENTE: el primer archivo que lo MENCIONA se llevaba la culpa, así que este
 *    mismo archivo —que lo citaba como dato de prueba— se acusó a sí mismo en una tanda de verdad. Hoy busca entre los
 *    TÍTULOS de cada archivo, pero no copiarlos saca el pie de la trampa igual.
 */
const TICKETS = 'tests/tickets-al-cerebro.test.ts';
const casos = (f: string) => titulosDe(leer(f));
const ultimoCasoDe = (f: string) => casos(f)[casos(f).length - 1];

test('el que no dejó avanzar es el archivo que SIGUE: los dos casos del run nombran a los dos archivos lentos', () => {
  // Los títulos son los que imprimió Actions, tal cual. Los dos son el ÚLTIMO test de su archivo: por eso «el caso que sigue»
  // no existía y el mensaje viejo mandaba a buscar un fantasma.
  const q13 = elQueNoDejoAvanzar(ultimoCasoDe('tests/graficos-ia-red.test.ts'), TANDA_13);
  assert.equal(q13?.ultimo, join(REPO, 'tests/graficos-ia-red.test.ts'));
  assert.equal(q13?.caso, 'el-que-sigue', 'el caso impreso era el último de su archivo: el archivo terminó');
  assert.equal(q13?.culpable, join(REPO, 'tests/grupo-leandro-2910.test.ts'), 'la tanda 13 la trabó grupo-leandro-2910, no un caso de graficos-ia-red');

  const q12 = elQueNoDejoAvanzar(ultimoCasoDe('tests/chat-mako-orden-del-flujo.test.ts'), TANDA_12);
  assert.equal(q12?.culpable, join(REPO, 'tests/clase-del-grupo.test.ts'), 'la tanda 12 la trabó clase-del-grupo');

  // Y lo dice en el mensaje, que es lo único que lee quien pushea.
  const msg = porQueSeMato({ colgada: true, porque: 'sin-avance', sinAvanceMs: TOPE_SIN_AVANCE_MS, ultimoCaso: ultimoCasoDe('tests/chat-mako-orden-del-flujo.test.ts') }, TANDA_12);
  assert.match(msg, /clase-del-grupo\.test\.ts/, 'el mensaje del vigía no nombra el archivo: vuelve el «un test se colgó» sin decir cuál');
  assert.match(msg, /node --import tsx --test /, 'y tiene que traer el comando para correrlo solo');
});

test('los otros dos cuelgues posibles, que son los que distinguen «está adentro» de «no salió»', () => {
  // Los títulos son de tests/tickets-al-cerebro.test.ts, que el 31/10/2026 apareció con esta forma exacta en una tanda muerta:
  // último caso impreso = último test de su archivo, y su archivo = el ÚLTIMO de la tanda, sin pie. Eso NO es «un test tarda»:
  // es un proceso que juzgó todo y no salió, y hay que ir a buscar un handle. (Esa tanda tenía otra sesión escribiendo archivos
  // encima, así que no cuenta como medición de ese archivo —solo corre en 36 s—: lo que se fija acá es el discriminante.)
  const soloEl = [join(REPO, 'tests/graficos-datos-corte.test.ts'), join(REPO, TICKETS)];
  const q = elQueNoDejoAvanzar(ultimoCasoDe(TICKETS), soloEl);
  assert.equal(q?.caso, 'no-salio', 'último caso de su archivo Y último archivo de la tanda: juzgó todo y no salió');
  assert.equal(q?.culpable, join(REPO, 'tests/tickets-al-cerebro.test.ts'));
  assert.match(porQueSeMato({ colgada: true, porque: 'sin-avance', sinAvanceMs: TOPE_SIN_AVANCE_MS, ultimoCaso: ultimoCasoDe(TICKETS) }, soloEl),
    /juzgó todo y NO SALIÓ — un handle abierto/, 'el mensaje tiene que mandar a buscar un handle, no un test lento');

  // Y un caso del MEDIO de su archivo: el proceso sigue adentro de ese archivo, no en el siguiente.
  const medio = elQueNoDejoAvanzar(casos(TICKETS)[0], TANDA_13.concat(join(REPO, TICKETS)));
  assert.equal(medio?.caso, 'adentro');
  assert.equal(medio?.culpable, join(REPO, 'tests/tickets-al-cerebro.test.ts'), 'con un caso del medio se acusa al archivo que lo imprimió, no al siguiente');
});

test('el orden que manda es el ALFABÉTICO, no el de los argumentos', () => {
  // ⚠️ Medido el 31/10/2026 sobre una tanda de 68 que mezclaba los tres grupos de `agrupar` (cambio → nombra → importa): los
  // 68 últimos casos salieron en orden alfabético PERFECTO. Node ordena los archivos, así que leer el orden de los argumentos
  // acusa a uno que ya terminó. En esa tanda el último caso impreso fue de tickets-al-cerebro (el archivo 68 de los
  // argumentos) y el proceso que estaba VIVO —mirado con Win32_Process— era tipos-por-tandas, el 56.
  const comoLlegaron = ['tests/tipos-por-tandas.test.ts', 'tests/voz-mako.test.ts', TICKETS].map((f) => join(REPO, f));
  const q = elQueNoDejoAvanzar(ultimoCasoDe(TICKETS), comoLlegaron);
  assert.equal(q?.culpable, join(REPO, 'tests/tipos-por-tandas.test.ts'),
    'con el orden de los argumentos, tickets-al-cerebro era el último y se acusaba a sí mismo: el que estaba vivo era el que le sigue ALFABÉTICAMENTE');
  assert.equal(q?.caso, 'el-que-sigue');
});

test('sin con qué nombrarlo, el mensaje lo DICE en vez de acusar al azar', () => {
  assert.equal(elQueNoDejoAvanzar('un caso que no está en ningún archivo', TANDA_13), null);
  assert.equal(elQueNoDejoAvanzar('', TANDA_13), null, 'sin caso impreso no hay archivo anterior: no se acusa a nadie');
  // El último archivo de la tanda no tiene «siguiente»: no se inventa uno, se acusa a él mismo por no SALIR.
  const ultimo = elQueNoDejoAvanzar(ultimoCasoDe('tests/graficos-ia-red.test.ts'), TANDA_13.slice(0, 2));
  assert.equal(ultimo?.siguiente, null);
  assert.equal(ultimo?.caso, 'no-salio');
  const msg = porQueSeMato({ colgada: true, porque: 'sin-avance', sinAvanceMs: TOPE_SIN_AVANCE_MS, ultimoCaso: 'un caso que no está en ningún archivo' }, TANDA_13);
  assert.match(msg, /no pude decir de qué archivo es: la salida va en orden ALF/, 'sin la lista de archivos el mensaje tiene que DECIR que no puede nombrar al culpable, no acusar al caso siguiente');
});

// ─────────────────────────────────────────────────────────────────────────────
// La otra mitad: los tests que replican la entrada REAL del grupo no esperan el reloj
// ─────────────────────────────────────────────────────────────────────────────
// `esperarSilencio` (lib/mako-doer-buffer.ts) duerme 8 s —20 con audio— mirando si entró otro mensaje, que es exactamente lo
// que tiene que hacer en producción. Un hijo que replica el doer paga eso ESCENA POR ESCENA: doce escenas son 234 s de los
// cuales 130 son dormir. Por eso los hijos acortan la ventana con `MAKO_DOER_VENTANA_MS`, y el lote que el test mide se junta
// igual: sus mensajes ya están en la cola cuando el turno llama a esperar.

/** Los hijos que pasan por la entrada de verdad del grupo: los que pagan la ventana de silencio. */
const HIJOS_DEL_DOER = porGit('tests/_*.ts').filter((f) => sinComentarios(leer(f)).includes('manejarEntranteDoer'));

test('todo hijo que corre la entrada real del grupo ACORTA la ventana de silencio', () => {
  assert.ok(HIJOS_DEL_DOER.length >= 6, `esperaba al menos 6 hijos del doer y encontré ${HIJOS_DEL_DOER.length}: ¿cambió el nombre de manejarEntranteDoer?`);
  const sinAcortar = HIJOS_DEL_DOER.filter((f) => !/process\.env\.MAKO_DOER_VENTANA_MS\s*=/.test(leer(f)));
  assert.deepEqual(sinAcortar, [],
    'estos hijos corren el doer de verdad y esperan la ventana de silencio del reloj (8-20 s por escena): con unas pocas '
    + "escenas el archivo pasa los 5 min y el vigía mata su tanda entera. Poneles `process.env.MAKO_DOER_VENTANA_MS = '0';` "
    + 'antes de importar lib/, como los demás.');
});

test('la ventana se puede ACORTAR por entorno, nunca alargar: producción sigue en 8 y 20 s', () => {
  const pedir = (env: Record<string, string>) => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', '-e',
      "const m = await import('./lib/mako-doer-buffer.ts'); process.stdout.write(JSON.stringify([m.VENTANA_MS, m.VENTANA_AUDIO_MS, m.TOPE_MS]));"],
      { cwd: REPO, encoding: 'utf8', timeout: 120_000, env: { ...process.env, ...env } });
    assert.ok(r.stdout?.includes('['), `no pude leer la ventana: ${(r.stderr ?? '').slice(-800)}`);
    return JSON.parse(r.stdout.slice(r.stdout.indexOf('['))) as [number, number, number];
  };
  const { MAKO_DOER_VENTANA_MS: _fuera, ...limpio } = process.env as Record<string, string>;
  assert.deepEqual(pedir(limpio as Record<string, string>), [8000, 20000, 90000], 'la ventana de PRODUCCIÓN cambió');
  assert.deepEqual(pedir({ ...limpio, MAKO_DOER_VENTANA_MS: '0' }), [0, 0, 90000], 'el entorno no acortó la ventana: los hijos del doer van a tardar minutos');
  // Lo que cuida el `Math.min`: un entorno mal puesto puede hacer que MaKo conteste ANTES, jamás que se quede esperando más.
  assert.deepEqual(pedir({ ...limpio, MAKO_DOER_VENTANA_MS: '600000' }), [8000, 20000, 90000], 'el entorno ALARGÓ la ventana: con esto un test puede volver a matar su tanda');
  assert.deepEqual(pedir({ ...limpio, MAKO_DOER_VENTANA_MS: 'ocho' }), [8000, 20000, 90000], 'un valor que no es número tiene que caer en el de producción');
  // ⚠️ `Number('')` es 0: una clave agregada SIN VALOR en el panel de Vercel dejaría a MaKo contestando al instante, sin
  // esperar el lote y sin que nada lo diga. Tiene que haber un número escrito.
  assert.deepEqual(pedir({ ...limpio, MAKO_DOER_VENTANA_MS: '' }), [8000, 20000, 90000], 'la variable VACÍA valió 0: MaKo deja de esperar el lote y nada lo dice');
  assert.deepEqual(pedir({ ...limpio, MAKO_DOER_VENTANA_MS: '   ' }), [8000, 20000, 90000], 'y en blanco, lo mismo');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (31/10/2026) — base 8 de 8 en verde, cada rotura restaurada. Cada una pone roja UNA y la nombra:
// ─────────────────────────────────────────────────────────────────────────────
//   · devolverle el `timeout: 400_000` a tests/grupo-leandro-2910.test.ts         -> 7 / 1 (lo nombra, con los 400 s)
//   · sacar `MAKO_DOER_VENTANA_MS` de tests/_clase-del-grupo-hijo.ts              -> 7 / 1 (lo nombra)
//   · `reloj()` sin el `Math.min` (el entorno ALARGA la ventana)                  -> 7 / 1
//   · `Number(process.env…)` directo (la variable VACÍA vuelve a valer 0)         -> 7 / 1
//   · bajarle el tope a tests/tipos-por-tandas.test.ts sin sacarlo de PERMITIDOS  -> 7 / 1
//   · `elQueNoDejoAvanzar` sin el discriminante (siempre «el que sigue»)          -> 7 / 1
//   · `elQueNoDejoAvanzar` sin ORDENAR (lee el orden de los argumentos)           -> 7 / 1
//   · `elQueNoDejoAvanzar` buscando en el FUENTE y no entre los títulos           -> 7 / 1
// Y en el vigía (tests/tope-grupo-compartido.test.ts, base 15/0), donde vive la otra mitad:
//   · `porQueSeMato(r)` sin los archivos de la tanda (vuelve el mensaje que no nombra) -> 14 / 1

// ── LA PACIENCIA DE LA TANDA SALE DE LO QUE DECLARAN SUS ARCHIVOS (31/10/2026) ──────────────────────────
// Lo de arriba cuida que nadie declare MÁS de lo que el vigía aguanta. Esto cuida el otro lado: que el vigía
// aguante lo que un archivo declara. Hizo falta porque el run 41207922805 de Actions mató la tanda de
// `grupo-leandro-2910` DOS VECES — la segunda ya con el reloj acortado— por 5 minutos sin imprimir un caso.
// La causa es que node imprime la salida de un archivo cuando el ARCHIVO termina: la tanda queda muda todo lo
// que tarde el más lento. Un `timeout: N` es la declaración de «puedo tardar N», y la tanda tiene que esperarlo.
test('la paciencia de una tanda sube SÓLO si alguno de sus archivos declara un tope mayor', () => {
  const soloLento = sinAvanceDe(['tests/grupo-leandro-2910.test.ts']);
  assert.ok(soloLento > TOPE_SIN_AVANCE_MS, `una tanda con un archivo que declara ${topeDeclarado(['tests/grupo-leandro-2910.test.ts']) / 1000} s tiene que esperar MÁS que los ${TOPE_SIN_AVANCE_MS / 1000} s de siempre: si no, el vigía la mata y acusa a los otros 99`);
  assert.equal(sinAvanceDe(['tests/compra-plan-lead.test.ts']), TOPE_SIN_AVANCE_MS, 'una tanda sin declaraciones NO paga el minuto extra: regalarle paciencia a todas es regalarle minutos de Actions a un cuelgue de verdad');
  assert.equal(sinAvanceDe([]), TOPE_SIN_AVANCE_MS, 'una tanda vacía');
  assert.equal(sinAvanceDe(['tests/no-existe-este-archivo.test.ts']), TOPE_SIN_AVANCE_MS, 'un archivo que no se puede leer no rompe el cálculo');
  // Y la gracia tiene que cubrir el ARCHIVO entero, no sólo su hijo: 240 declarados + el arranque de tsx + los
  // otros tests. Con una gracia de 60 s esto daba exactamente TOPE_SIN_AVANCE_MS y el arreglo no arreglaba nada.
  assert.ok(soloLento >= 240_000 + 90_000, `la gracia sobre lo declarado quedó corta: ${soloLento / 1000} s para un archivo que declara 240`);
});

test('el tope declarado se lee del fuente, y los comentarios no cuentan', () => {
  assert.equal(topeDeclarado(['tests/grupo-leandro-2910.test.ts']), 240_000, 'el `timeout:` del spawnSync');
  // ⚠️ Este mismo archivo cita en sus comentarios el tope viejo de 400 s que causó el 99, Y declara uno de verdad de
  // 120 s para su propio hijo. Tiene que leer el de verdad y NO el citado.
  // Y OJO con cómo se escribe acá: un comentario que contenga el literal «tope dos puntos número» se cuenta igual, porque
  // el limpiador de comentarios no lo saca. Por eso arriba el número está escrito en palabras. Lo aprendí fallando: al
  // citarlo textual, este archivo se declaró a sí mismo más lento que el vigía y rompió su propio primer test.
  const propio = topeDeclarado(['tests/tanda-no-la-mata-un-test-lento.test.ts']);
  assert.equal(propio, 120_000, 'tiene que leer el tope real de su hijo, no uno citado en un comentario');
});

// ── LA LISTA DE LENTOS NO ES UNA ALFOMBRA (31/10/2026) ────────────────────────────────────
// Sacar un test de la fase que frena el tren es legítimo cuando es un end-to-end largo, y es una forma barata de
// esconder un test molesto. Lo que lo separa es que SIGA CORRIENDO: `--resto` es «todos menos los afectados», así que
// lo que sale de afectados cae ahí solo. Esto cuida las dos mitades.
test('los lentos salen de la fase rápida, siguen existiendo, y cada uno dice por qué', () => {
  for (const [f, motivo] of LENTOS_FUERA_DE_LA_FASE_RAPIDA) {
    assert.ok(existsSync(join(REPO, f)), `${f} está en la lista de lentos pero NO EXISTE: se renombró o se borró y la lista quedó apuntando a la nada`);
    assert.ok(/\d/.test(motivo), `${f} no dice CUÁNTO tarda: el motivo tiene que traer el número medido, o nadie puede saber si ya se puede sacar de acá`);
    assert.ok(/runner|Actions/i.test(motivo), `${f}: el motivo tiene que estar medido en el RUNNER, no en la PC de quien lo escribió — esa fue la trampa que costó cuatro corridas`);
  }
});

test('un lento NO queda en los afectados', () => {
  const plan = planear('origin/main');
  if (!plan) return;  // sin git o sin base: no hay nada que afirmar
  for (const f of LENTOS_FUERA_DE_LA_FASE_RAPIDA.keys()) {
    assert.ok(!plan.sel.tests.has(f), `${f} volvió a los afectados: va a frenar el tren otra vez`);
  }
});
