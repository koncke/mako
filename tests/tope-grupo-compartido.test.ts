// =============================================================================
// El tope de un proceso de tests: un detector de que NO AVANZA, no un reloj de pared
// =============================================================================
// EL MISMO SÍNTOMA SE CULPÓ A LA RAM DOS VECES, Y ERA UN NÚMERO FIJO NUESTRO:
//   · 25/10/2026: «grupo compartido 1/1 · 796 archivos · 0 tests · ROJO · 25 min» → se escribió que la PC paginaba.
//   · 30/10/2026: «1/2 · 495 archivos · 0 tests · ROJO · 25 min 2 s» y «2/2 · 514 · 0 tests · ROJO · 25 min 0 s», **en el runner de
//     Actions**, que tiene memoria dedicada y nadie más adentro. Ahí se cayó el diagnóstico de la RAM: `25 min 0 s` es el TOPE.
// `TOPE_COMPARTIDO_MS` valía 25 min fijos, calibrados con 12 archivos (40 s) y 148 en dos procesos (267 s) el 17/10; hoy son 1.028
// compartibles. Siete veces más, con el mismo número — y los dos grupos corren EN PARALELO (`Promise.all`), no en serie.
//
// LO QUE SE FIJA ACÁ: que el tope distinga «es GRANDE» de «está COLGADO». Un proceso que imprime casos avanza y no se mata nunca
// por ser grande; uno que no imprime un caso nuevo en el tope de «no avanza» está colgado, tenga 12 archivos o 1.028. Y queda un
// techo de pared proporcional como última red, para que un arrastre patológico no se coma el job de 90 min de Actions.
// Todo con un proceso de MENTIRA que se cuelga en dos segundos: no hace falta la suite, ni RAM, ni esperar 25 minutos.
//
// ⚠️ PROBADO ROMPIÉNDOLO (31/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agrupar, arranqueDe, CASO_REPORTADO, costoCompartidoGb, lanzarVigilado, pisoCompartido, porQueSeMato, ROJO_SEGUIDAS,
  topeDePared, TOPE_SIN_AVANCE_MS, ZONA_ROJA_VIGIA_GB,
} from '../scripts/tests-afectados.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const VIEJO_FIJO_MS = 25 * 60 * 1000;      // el tope de antes, el que mató los dos grupos del 30/10

/** Un proceso de mentira: imprime las líneas que le pasás (con su pausa) y después se queda colgado para siempre. */
const colgandose = (lineas: string[], pausaMs = 150) =>
  ['-e', `const l=${JSON.stringify(lineas)};let i=0;const t=setInterval(()=>{if(i<l.length)console.log(l[i++]);},${pausaMs});setTimeout(()=>{},3e5);`];

const correr = (args: string[], o: Record<string, unknown> = {}) =>
  lanzarVigilado(args, { archivos: 500, env: process.env, cada: 100, sinAvanceMs: 1200, techoMs: 60_000, ...o }) as Promise<{
    colgada: boolean; porque: string; ultimoCaso: string; casos: number; libreMin: number; codigo: number; ms: number; techo: number; sinAvanceMs: number; salida: string;
  }>;

// ---------------------------------------------------------------------------
// 1. El tope de pared, que ahora escala
// ---------------------------------------------------------------------------

test('REGRESIÓN del 30/10: un grupo de 514 archivos ya no se mata a los 25 minutos, y uno de 12 no espera 25 para cazar un colgado', () => {
  assert.ok(topeDePared(514) > VIEJO_FIJO_MS, `514 archivos tienen que tener más techo que los 25 min fijos de antes; tienen ${Math.round(topeDePared(514) / 60000)} min`);
  assert.ok(topeDePared(1028) > topeDePared(514), 'y el techo crece con los archivos');
  assert.ok(topeDePared(12) < VIEJO_FIJO_MS, 'un grupo chico no tiene por qué heredar el techo de uno grande');
  assert.ok(topeDePared(1) >= 60_000, 'pero ni el más chico arranca con un techo de segundos: node y tsx tardan en levantar');
  // El techo es la ÚLTIMA red, no un presupuesto: tiene que ser varias veces lo medido (3,7 s por archivo el 17/10).
  assert.ok(topeDePared(514) > 2 * 514 * 3700, 'el techo deja pasar una PC el doble de lenta que la medición');
});

// ---------------------------------------------------------------------------
// 2. «No avanza» es lo que caza un colgado, y el tamaño no entra en la cuenta
// ---------------------------------------------------------------------------

test('un proceso que IMPRIME CASOS no se mata, aunque tarde más que el tope de «no avanza»', async () => {
  // 12 casos de a 200 ms = 2,4 s de vida, con un tope de «no avanza» de 1,2 s: si el tope fuera de pared, moriría.
  const lineas = Array.from({ length: 12 }, (_, i) => `✔ caso ${i + 1} (1.0ms)`);
  const r = await correr(['-e', `const l=${JSON.stringify(lineas)};let i=0;const t=setInterval(()=>{if(i<l.length)console.log(l[i++]);else{clearInterval(t);}},200);`]);
  assert.equal(r.colgada, false, 'avanzaba: no se lo mata');
  assert.equal(r.codigo, 0);
  assert.ok(r.ms > 1200, `vivió ${r.ms} ms, más que el tope de «no avanza» (1200): es justo lo que tiene que poder hacer`);
});

test('un proceso que DEJA de imprimir se mata, y el mensaje nombra el último caso que TERMINÓ (el que se colgó es el siguiente)', async () => {
  const r = await correr(colgandose(['✔ uno (1.0ms)', '✔ dos (2.0ms)', '✖ tres (3.0ms)']));
  assert.equal(r.colgada, true);
  assert.equal(r.porque, 'sin-avance');
  assert.equal(r.ultimoCaso, 'tres', 'node imprime el caso cuando TERMINA: el último impreso es el último caso de SU archivo');
  assert.equal(r.codigo, 1, 'un proceso que hubo que matar sale con código != 0');
  assert.match(porQueSeMato(r), /sin terminar un solo caso: un test se colgó\. El último caso que TERMINÓ fue «tres»/);
  // Sin la lista de archivos no hay con qué nombrar al culpable, y el mensaje lo DICE en vez de acusar al caso siguiente (que
  // el 31/10/2026 no existía: era el último de su archivo). Con la lista lo nombra: tests/tanda-no-la-mata-un-test-lento.test.ts.
  assert.match(porQueSeMato(r), /no pude decir de qué archivo es: la salida va en orden ALF/, 'sin la lista de archivos el mensaje tiene que DECIR que no puede nombrar al culpable, no acusar al caso siguiente');
});

test('un proceso que se cuelga SIN imprimir nada se mata igual, con el arranque de gracia, y lo dice', async () => {
  const r = await correr(['-e', 'setTimeout(()=>{},3e5);'], { sinAvanceMs: 300, arranqueMs: 600, techoMs: 60_000 });
  assert.equal(r.colgada, true);
  assert.equal(r.porque, 'sin-avance');
  assert.equal(r.ultimoCaso, '');
  assert.match(porQueSeMato(r), /no llegó a terminar NI UN caso: no alcanzó a arrancar/);
  // El arranque de gracia es real: con el tope de «no avanza» en 300 ms, igual lo esperó bastante más antes de matarlo.
  assert.ok(r.ms > 600, `lo mató a los ${r.ms} ms: antes del primer caso se le suma el arranque (node + tsx + el cache de lecturas)`);
  // Y el INVARIANTE que lo hace coherente en producción: el techo nunca llega antes que la gracia, así que un proceso callado
  // muere por «no avanzó» (que es lo que le pasó) y no por el techo (que hablaría de avanzar de a poco).
  for (const n of [0, 1, 12, 100, 514, 1028]) {
    assert.ok(topeDePared(n) > arranqueDe(n) + TOPE_SIN_AVANCE_MS, `con ${n} archivos el techo (${topeDePared(n)}) tiene que pasar la gracia (${arranqueDe(n) + TOPE_SIN_AVANCE_MS})`);
  }
});

test('el TECHO de pared es la última red: un proceso que avanza de a poquito igual se mata, y el mensaje lo distingue del colgado', async () => {
  // Imprime un caso cada 200 ms para siempre (nunca «no avanza»), con el techo en 1,2 s.
  const r = await correr(['-e', 'let i=0;setInterval(()=>{console.log(`✔ lento ${++i} (1.0ms)`)},200);'], { sinAvanceMs: 60_000, techoMs: 1200 });
  assert.equal(r.colgada, true);
  assert.equal(r.porque, 'techo', 'avanzaba, así que no es «se colgó»: es que no termina nunca');
  assert.match(porQueSeMato(r), /pasó el techo de .* \(proporcional a sus archivos\) avanzando de a poco: o la PC está paginando/);
});

test('MEDIDO el 31/10: la CARGA no imprime nada y es lo que más tarda, así que la gracia del primer caso va por archivo', async () => {
  // La curva de 100 compartibles en un proceso fue `0′:0 1′:0 … 5′:0 6′:56 7′:56 8′:742`: SEIS MINUTOS sin juzgar un caso, y
  // después los 889 en dos. Con `--test-isolation=none` node importa todo antes de correr nada, y tsx transpila de a uno.
  // Una gracia fija (90 s) mataba grupos SANOS — lo cazó la medición, no un test: por eso ahora la gracia crece con los archivos.
  assert.ok(arranqueDe(100) > 6 * 60 * 1000, `100 archivos tardaron 6 min en cargar; la gracia da ${Math.round(arranqueDe(100) / 60000)} min`);
  assert.ok(arranqueDe(514) > arranqueDe(100), 'y crece con los archivos');
  assert.ok(arranqueDe(0) > 0 && arranqueDe(0) < 2 * 60 * 1000, 'una tanda sin archivos no necesita minutos de gracia');
  // Y el vigilante la respeta: un proceso callado durante la carga no se mata, aunque pase el tope de «no avanza».
  const r = await correr(['-e', 'setTimeout(()=>{console.log("✔ primero (1.0ms)");process.exit(0)},900);'], { sinAvanceMs: 200, arranqueMs: 3000, techoMs: 30_000 });
  assert.equal(r.colgada, false, 'estuvo 900 ms callado con un tope de 200: era la CARGA, no un colgado');
  assert.equal(r.codigo, 0);
});

test('CASO_REPORTADO reconoce las líneas del runner de node y no cualquier cosa (de eso depende saber si avanza)', () => {
  assert.equal(CASO_REPORTADO.exec('✔ el segundo pasa (0.5225ms)')?.[1], 'el segundo pasa');
  assert.equal(CASO_REPORTADO.exec('  ✖ falla adentro de un describe (12.5ms)')?.[1], 'falla adentro de un describe', 'indentado también');
  assert.equal(CASO_REPORTADO.exec('✔ tests/vacio.test.ts (120.109ms)')?.[1], 'tests/vacio.test.ts', 'un archivo sin casos se reporta como un caso: también es avance');
  assert.equal(CASO_REPORTADO.test('ℹ tests 2'), false, 'el pie no es un caso');
  assert.equal(CASO_REPORTADO.test('✖ failing tests:'), false, 'el encabezado del pie de rojos tampoco');
  assert.equal(CASO_REPORTADO.test('  AssertionError: 1 !== 2'), false);
});

// ---------------------------------------------------------------------------
// 3. El turno del candado es una FOTO: el proceso se baja solo si la RAM entra en la zona roja
// ---------------------------------------------------------------------------

test('con la RAM en la zona roja el proceso se BAJA SOLO, aunque esté avanzando: un turno concedido no vuelve a mirar la memoria', async () => {
  // El 31/10/2026 tres chats llegaron a menos de 0,3 GB libres y uno a CERO corriendo el barrido, con el turno del candado en la
  // mano. Con la RAM en cero se cuelga la app de Claude y se caen todos los chats con lo que tengan sin commitear (11/10).
  const r = await correr(['-e', 'let i=0;setInterval(()=>{console.log(`✔ avanza ${++i} (1.0ms)`)},100);'], { libre: () => 0.2, techoMs: 60_000, sinAvanceMs: 60_000 });
  assert.equal(r.colgada, true, 'avanzaba, pero la máquina se estaba yendo a cero');
  assert.equal(r.porque, 'sin-ram');
  assert.match(porQueSeMato(r), /LO BAJÉ YO: la RAM libre cayó a 0\.2 GB/);
  assert.match(porQueSeMato(r), /NO es un rojo del código: cerrá chats, o dejale el chequeo a Actions/);
  assert.ok(r.casos > 0, 'y se sabe cuántos casos alcanzó a juzgar antes de bajarse');
});

test('un pico de RAM no lo baja: hacen falta varias muestras seguidas en rojo (si no, cualquier parpadeo mata la corrida)', async () => {
  let n = 0;
  // Un solo rojo en medio de verdes: no alcanza.
  const r = await correr(['-e', 'let i=0;const t=setInterval(()=>{if(++i>6){clearInterval(t);return}console.log(`✔ v ${i} (1.0ms)`)},100);'], {
    libre: () => (++n === 2 ? 0.1 : 3.5), techoMs: 60_000, sinAvanceMs: 60_000,
  });
  assert.equal(r.colgada, false, 'un parpadeo no es que la máquina se esté yendo');
  assert.ok(ROJO_SEGUIDAS >= 2, 'y la constante dice cuántas seguidas hacen falta');
});

test('el barrido COMPLETO se niega en esta máquina, con el motivo escrito y sale 99 (no es un rojo): la decisión vive en la herramienta', () => {
  const { status, stdout, stderr } = spawnSync(process.execPath, ['scripts/tests-afectados.mjs', '--resto', '--base', 'origin/main'], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, CI: '', NODE_TEST_CONTEXT: '' },
  });
  const salida = `${stdout}${stderr}`;
  assert.equal(status, 99, `tiene que salir 99 («no pude chequear»), no 1 («hay tests rotos»); salió ${status}: ${salida.slice(0, 300)}`);
  assert.match(salida, /NO CORRO EL BARRIDO COMPLETO EN ESTA MÁQUINA/);
  assert.match(salida, /Esto lo corre Actions/i, 'y dice dónde SÍ se corre');
  assert.match(salida, /se caen TODOS los chats/, 'y por qué, que es lo que hace que la regla se respete');
  // En Actions (CI) no se niega: es justo donde tiene que correr. Y hay una salida explícita para el que sabe lo que cuesta.
  const src = readFileSync(join(REPO, 'scripts', 'tests-afectados.mjs'), 'utf8');
  assert.match(src, /if \(o\.resto && !process\.env\.CI && process\.env\.MAKO_BARRIDO_AQUI !== '1'\)/);
});

// ---------------------------------------------------------------------------
// 4. El piso de RAM, que también escala
// ---------------------------------------------------------------------------

test('el piso de RAM crece con los archivos de cada proceso: 0,8 GB fijos se midieron con 24 barredoras y se aplicaban a 514', () => {
  assert.ok(costoCompartidoGb(514) > costoCompartidoGb(24), 'un grupo de 514 pide más que uno de 24');
  assert.ok(pisoCompartido(1, 514) > ZONA_ROJA_VIGIA_GB + 0.8 + 0.05, `el piso de antes para un grupo (1,75 GB) era menos de lo que pide: ahora pide ${pisoCompartido(1, 514).toFixed(2)}`);
  // La base por proceso es lo que domina (node + tsx + el cache de lecturas del repo entero), así que MENOS grupos piden MENOS en total.
  assert.ok(pisoCompartido(1, 1028) < pisoCompartido(2, 1028), 'un proceso de 1.028 pide menos en total que dos de 514');
  assert.ok(pisoCompartido(2, 1028) < pisoCompartido(4, 1028), 'y cuatro piden más que dos: por eso bajar grupos es la salida cuando no entra');
  // Y sigue siendo una cuenta derivada de la zona roja del vigía, no un número a ojo.
  assert.ok(pisoCompartido(1, 24) > ZONA_ROJA_VIGIA_GB, 'nunca por debajo de la zona roja del vigía');
});

// ---------------------------------------------------------------------------
// 5. Lo SEGURO no es lo que CONVIENE: comparten las que BARREN
// ---------------------------------------------------------------------------

test('comparten proceso las que BARREN, no todo lo que es seguro compartir (31/10: de 1.850 compartibles, 227 barren y 1.623 sólo son seguros)', () => {
  const tests = new Map<string, { tipo: string; detalle: string }[]>([
    ['tests/barre.test.ts', [{ tipo: 'barre', detalle: 'git ls-files' }]],
    ['tests/chico-seguro.test.ts', [{ tipo: 'nombra', detalle: 'lib/x.ts' }]],
    ['tests/chico-seguro-2.test.ts', [{ tipo: 'importa', detalle: 'a → b' }]],
  ]);
  const compartibles = new Set(['tests/barre.test.ts', 'tests/chico-seguro.test.ts', 'tests/chico-seguro-2.test.ts']);
  // El default de `--compartir`: sólo las barredoras. Un test chico no relee el repo, así que no ahorra nada y paga la carga del grupo.
  assert.deepEqual(agrupar(tests, compartibles, { compartir: true }).compartidos, ['tests/barre.test.ts']);
  assert.deepEqual(agrupar(tests, compartibles, { compartir: 'barredoras' }).compartidos, ['tests/barre.test.ts']);
  // El de antes queda, con nombre explícito, para volver a medirlo.
  assert.equal(agrupar(tests, compartibles, { compartir: 'todo-lo-seguro' }).compartidos.length, 3);
  assert.deepEqual(agrupar(tests, compartibles, { compartir: false }).compartidos, []);
});

test('`--compartir` sin valor significa «las barredoras» (es lo que pasa el workflow de Actions en sus dos fases)', () => {
  const src = readFileSync(join(REPO, 'scripts', 'tests-afectados.mjs'), 'utf8');
  assert.match(src, /k === '--compartir'\) o\.compartir = v === 'todo-lo-seguro' \? 'todo-lo-seguro' : 'barredoras'/);
  // 4/11/2026: integracion.yml se retiró; las dos fases quedaron en punta.yml (los afectados) y sobre-main.yml (las barredoras).
  const wf = readFileSync(join(REPO, '.github', 'workflows', 'punta.yml'), 'utf8');
  assert.match(wf, /--compartir(?!=)/, 'el workflow lo pasa sin valor: el default es lo que corre en el tren');
  assert.doesNotMatch(wf, /--compartir=todo\b/, 'y nadie pide el de antes');
  // El --resto (la fase de «los demás», la que tenía los 1.028) filtra igual.
  assert.match(src, /const vale = \(t\) => sel\.compartibles\.has\(t\) && \(o\.compartir === 'todo-lo-seguro' \|\| sel\.barredoras\.has\(t\)\)/);
});

// ---------------------------------------------------------------------------
// 6. Que esté cableado en el código de verdad, no sólo en las funciones
// ---------------------------------------------------------------------------

test('los DOS caminos (la tanda y el grupo compartido) pasan por el mismo vigilante, y no queda ningún tope fijo', () => {
  const src = readFileSync(join(REPO, 'scripts', 'tests-afectados.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const sinComentarios = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.match(sinComentarios, /function correrTanda\([\s\S]*?return lanzarVigilado\(/, 'la tanda');
  assert.match(sinComentarios, /function correrGrupoCompartido\([\s\S]*?return lanzarVigilado\(/, 'el grupo compartido');
  assert.doesNotMatch(sinComentarios, /TOPE_TANDA_MS|TOPE_COMPARTIDO_MS/, 'los dos topes fijos ya no existen');
  assert.doesNotMatch(sinComentarios, /setTimeout\(\(\) => \{ colgada = true/, 'ni el reloj de pared que los aplicaba');
  assert.match(sinComentarios, /pisoGb: \(n\) => pisoCompartido\(n, compartidos\.length\)/, 'el piso recibe cuántos archivos hay que repartir');
  // El motivo de la muerte se dice donde se lee, Y con los archivos de la tanda: es lo único con lo que el mensaje puede
  // nombrar al que no dejó avanzar. Un `porQueSeMato(r)` pelado vuelve al mensaje que no nombra a nadie.
  const llamadas = [...sinComentarios.matchAll(/porQueSeMato\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(llamadas.length >= 3, `esperaba la declaración y los dos caminos, y encontré ${llamadas.length} usos de porQueSeMato`);
  for (const a of llamadas) assert.match(a, /^r, .+/, `«porQueSeMato(${a})» sin los archivos de la tanda: el mensaje no va a poder nombrar al culpable`);
  // El «0 tests» que engañó dos veces: sale del PIE, que un proceso muerto no imprime. Sin pie se reporta lo CONTADO del stream.
  assert.match(sinComentarios, /\$\{res\.tests \? `\$\{res\.tests\} tests` : `\$\{r\.casos \?\? 0\} casos juzgados \(sin el pie del runner\)`\}/, 'la tanda y el grupo dicen lo que contaron');
  assert.equal((sinComentarios.match(/casos juzgados \(sin el pie del runner\)/g) ?? []).length, 2, 'los dos caminos');
  assert.match(sinComentarios, /total\.tests \+= res\.tests \? 0 : \(r\.casos \?\? 0\);/, 'y el total no se come lo que corrió un proceso que murió');
});

test('TOPE_SIN_AVANCE_MS es generoso y se puede mover sin tocar el código: un test lento de verdad no es un colgado', () => {
  assert.ok(TOPE_SIN_AVANCE_MS >= 3 * 60 * 1000, `son ${TOPE_SIN_AVANCE_MS / 60000} min: menos que eso mata tests lentos de verdad`);
  const src = readFileSync(join(REPO, 'scripts', 'tests-afectados.mjs'), 'utf8');
  assert.match(src, /MAKO_TESTS_SIN_AVANCE_MIN/, 'y se mueve por entorno, para no tener que tocar el script cuando aparezca un test lento');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (31/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura):
//   1. el tope de vuelta fijo en 25 min (`techoMs = 25*60*1000`) → la REGRESIÓN del 514 y el del grupo de 12.
//   2. `topeDePared` sin el término por archivo (sólo el arranque) → la REGRESIÓN.
//   3. el vigilante mirando el reloj total en vez de la quietud (`total > sinAvanceMs`) → «un proceso que IMPRIME CASOS no se mata»,
//      que es el corazón del cambio: ahí se ve la diferencia entre «es grande» y «está colgado».
//   4. la quietud medida desde el arranque y no desde el último caso → el mismo test.
//   5. `visto` que no se actualiza al ver un caso → el mismo test.
//   6. sin el arranque de gracia antes del primer caso → «se cuelga SIN imprimir nada» (lo mataba antes de que node levantara).
//   7. `porque` siempre 'sin-avance' → el test del TECHO (un arrastre se leía como un test colgado).
//   8. `ultimoCaso` sin guardar el nombre → el test del mensaje (volvía el «un test se colgó» a secas, con 514 sospechosos).
//   9. `CASO_REPORTADO` aflojado para que matchee el pie (`ℹ tests 2`) → su test: el pie llega una sola vez y el proceso parecía avanzar.
//  10. `costoCompartidoGb` sin el término por archivo → el test del piso (volvía el 0,8 fijo de 24 barredoras).
//  11. `pisoCompartido` que multiplica la base sin dividir los archivos → «un proceso de 1.028 pide menos que dos de 514» (al revés).
//  12. `correrTanda` de vuelta con su propio `spawn` y su reloj → el test del cableado.
// Lo que NO se puede probar acá: cuánto tarda y cuánto pide de verdad un grupo de 514 en una PC o en el runner. Eso se MIDE, con
// `node scripts/medir-grupo-compartido.mjs --n 514`, y los números están en docs/hallazgos-infra.md con su fecha.
// =============================================================================
