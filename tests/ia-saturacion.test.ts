// =============================================================================
// Un modelo saturado no deja a MaKo sin IA, y un pedido sano y lento no se trata como saturado (26/10/2026)
// =============================================================================
// El caso (Landings, logs de Vercel, 26/10/2026 05:52 UTC, ws9): la réplica de una página de 20 secciones dejó 17 SIN IA en
// 135 s con un plazo de 240. «gemini · cuenta 3: The operation was aborted due to timeout» y «gemini · cuenta 4: This model
// is currently experiencing high demand». El respaldo sano (`gemini-flash-lite-latest`) existía y la tanda siguiente volvía a
// empezar por el saturado. La revisión del tren-l (hallazgos 17 y 18) corrigió la primera versión: la reserva de 15 s cortaba
// tandas sanas y las marcaba «saturadas» para todos, y un proveedor SIN clave contaba como «otra opción». Lo que se fija acá:
//   1. lo puro de lib/ia-saturacion.ts: qué es saturación (un 429 no), y que un timeout cuenta sólo con el plazo COMPLETO que
//      el tamaño del pedido necesitaba;
//   2. la cascada REAL (tests/_ia-saturacion-hijo.ts): el intento pide todo su plazo; un TIMEOUT nunca marca al modelo para el
//      proceso (sólo un 503 lo hace), y un cuelgue con el plazo completo pasa al respaldo en el mismo pedido; adentro de una
//      réplica (`conMemoriaDelPedido`) la tanda siguiente empieza por el respaldo; la ÚLTIMA opción real (sin proveedores sin
//      clave, y sin una red que no corre por `pii` o por ser el super admin) sí insiste;
//   3. el turno con herramientas (MaKo en WhatsApp) anota el 503, nunca el timeout;
//   4. la réplica del Web Generator da una segunda vuelta a lo que quedó sin IA, con su memoria de cuelgues.
// La verificación del tren-m reabrió el 17 y el 18: el timeout del que llama (10 s en la red de MaKo en WhatsApp) marcaba al
// modelo para todos, y una red pedida que no corría (`pii`, super admin) contaba como «otra opción».
//
// Probado rompiéndolo (26/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  VENTANA_SATURADO_MS, anotarSaturado, esSaturacion, estaSaturado, fallaDeSaturacion, olvidarSaturados, plazoEsperadoMs, primeroLosSanos,
} from '../lib/ia-saturacion';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. qué es saturación: «high demand» y 503 sí; la cuota de una cuenta no', () => {
  assert.equal(esSaturacion('HTTP 503 This model is currently experiencing high demand.'), true);
  assert.equal(esSaturacion('The model is overloaded. Please try again later.'), true);
  assert.equal(esSaturacion('HTTP 429 RESOURCE_EXHAUSTED: quota exceeded'), false, 'la cuota es de UNA cuenta: la arregla otra cuenta');
  // El ambiguo: un 429 que además dice «overloaded». Sigue siendo la cuota de una cuenta, no el modelo.
  assert.equal(esSaturacion('HTTP 429: the service is overloaded for this key, retry later'), false, 'un 429 nunca marca al modelo');
  assert.equal(esSaturacion('HTTP 400 invalid argument'), false);
});

test('1. un timeout cuenta sólo si el intento tuvo TODO el plazo que su tamaño necesitaba', () => {
  assert.equal(plazoEsperadoMs(7_400), 88_800, 'la fórmula de chatClaude: 12 ms por token');
  assert.equal(plazoEsperadoMs(), 30_000, 'un pedido chico necesita 30 s');
  assert.equal(plazoEsperadoMs(50_000), 120_000, 'con techo');
  const corte = 'The operation was aborted due to timeout';
  assert.equal(fallaDeSaturacion(corte, 42_000, plazoEsperadoMs(7_400)), false, 'una tanda grande cortada por el plazo del que llama no está colgada');
  assert.equal(fallaDeSaturacion(corte, 30_000, plazoEsperadoMs()), true, 'un pedido chico que no contestó en sus 30 s, sí');
});

test('1. saturado vence solo, y el saturado va AL FINAL de la lista sin que se saque a nadie', () => {
  olvidarSaturados();
  const t = 1_000_000;
  anotarSaturado('gemini', 'gemini-flash-latest', t);
  assert.equal(estaSaturado('gemini', 'gemini-flash-latest', t + 1), true);
  assert.equal(estaSaturado('openai', 'gemini-flash-latest', t + 1), false, 'es por proveedor y modelo');
  assert.deepEqual(primeroLosSanos('gemini', ['gemini-flash-latest', 'gemini-flash-lite-latest'], 'gemini-flash-latest', t + 1), ['gemini-flash-lite-latest', 'gemini-flash-latest']);
  assert.deepEqual(primeroLosSanos('gemini', [undefined, 'gemini-flash-lite-latest'], 'gemini-flash-latest', t + 1), ['gemini-flash-lite-latest', undefined], '`undefined` es el modelo por default');
  assert.equal(estaSaturado('gemini', 'gemini-flash-latest', t + VENTANA_SATURADO_MS + 1), false, 'pasado el bache, vuelve a ser el primero');
});

type Pedido = { modelo: string; plazo: number | null };
type Vuelta = { respuesta?: string; pedidos: Pedido[]; saturadoDespues?: boolean };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_ia-saturacion-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 180_000, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<'A' | 'A2' | 'B' | 'C' | 'D' | 'E' | 'F' | 'F2' | 'G' | 'G2' | 'G3', Vuelta>
  & { H: { tanda1: Pedido[]; tanda2: Pedido[]; afuera: Pedido[]; saturadoDespues: boolean }; error?: string }
  & Record<'P' | 'P_gratisContesta' | 'P_negocio' | 'P_otraTarea' | 'P_plan' | 'P_sinCredito' | 'P_noEntra' | 'P_corte' | 'P_sinSaldo', { respuesta: string; pedidos: Pedido[]; credito: Array<{ model: string; max_tokens: number; clave: string }>; filasDeUso: number }>
  & { P_sinSaldoFila: number };
const LATEST = 'gemini-flash-latest', LITE = 'gemini-flash-lite-latest';
const modelos = (v: Vuelta) => v.pedidos.map((p) => p.modelo);

test('2. una tanda GRANDE pide todo su plazo (sin reservar) y su corte NO marca al modelo para los demás', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.ok((R.A.pedidos[0]?.plazo ?? 0) > 40_000, `el primer intento pidió ${R.A.pedidos[0]?.plazo} ms: se le recortó el plazo`);
  assert.equal(R.A.saturadoDespues, false, 'una tanda sana y lenta quedó marcada saturada para todos los negocios del proceso');
});

test('2. un TIMEOUT nunca marca al modelo para el proceso; en su pedido, colgado con el plazo entero, pasa al respaldo', () => {
  assert.equal(R.A2.saturadoDespues, false, 'un timeout marcó al modelo para todos los negocios del proceso');
  assert.deepEqual(modelos(R.A2), [LATEST, LITE], 'colgado con su plazo entero: no se reintenta, se pasa al respaldo');
});

test('2. adentro de una réplica, el cuelgue de una tanda hace empezar a la siguiente por el respaldo; afuera, nada', () => {
  assert.equal(R.H.tanda1[0]?.modelo, LATEST);
  assert.equal(R.H.tanda2[0]?.modelo, LITE, `la tanda 2 de la misma réplica empezó por ${R.H.tanda2[0]?.modelo}`);
  assert.equal(R.H.afuera[0]?.modelo, LATEST, 'el cuelgue de una réplica se le pegó a otro pedido');
  assert.equal(R.H.saturadoDespues, false);
});

test('2. un 503 SÍ marca, no se reintenta, y el pedido siguiente empieza por el respaldo', () => {
  assert.equal(R.B.pedidos[0]?.modelo, LITE, `empezó por ${R.B.pedidos[0]?.modelo}`);
  assert.equal(R.B.respuesta, `respuesta de ${LITE}`);
  assert.deepEqual(modelos(R.C), [LATEST, LITE], 'el 503 «high demand» no se reintenta en el mismo modelo');
  assert.equal(R.C.saturadoDespues, true);
});

test('2. sin plazo del que llama, el intento pide su timeout de siempre', () => {
  assert.equal(R.D.pedidos[0]?.plazo, 88_800);
});

test('2. la ÚLTIMA opción real insiste: un proveedor de la lista sin clave no cuenta como «otra opción»', () => {
  for (const [nombre, v] of [['lista por default', R.F], ['su Gemini sola, con «sólo su IA»', R.F2]] as const) {
    assert.deepEqual(modelos(v), [LATEST, LITE, LITE], `${nombre}: flash-lite es la última opción real y su 503 no se reintentó (${modelos(v).join(', ')})`);
  }
});

test('2. una red de la plataforma PEDIDA que no corre no es «otra opción»: con datos de clientes, sin ellos, y en el super admin', () => {
  for (const [nombre, v] of [['el AI Step de un lead (pii)', R.G], ['el super admin', R.G2], ['un negocio sin datos de clientes', R.G3]] as const) {
    assert.deepEqual(modelos(v), [LATEST, LITE, LITE], `${nombre}: la red no corre y el 503 de su última opción no se reintentó (${modelos(v).join(', ')})`);
  }
  // `hayRed` se le pregunta a la MISMA función que arma la red, más los cortes del bloque.
  const casc = fuente('lib/ai-cheap.ts');
  assert.match(casc, /if \(opts\.redDePlataforma && !llevaPII\) \{/);
  assert.match(casc, /hayRed = sa != null && \(await getWorkspaceActual\(\)\.catch\(\(\) => null\)\) !== sa\s*&& \(await provsGratisDePlataforma\(\)\.catch\(\(\) => \[\]\)\)\.length > 0;/);
});

test('3. el turno con herramientas (MaKo en WhatsApp) anota el 503, y NINGÚN camino anota un timeout para el proceso', () => {
  assert.equal(R.E.saturadoDespues, true);
  assert.deepEqual(modelos(R.E), [LATEST, LITE], 'rota al respaldo en el mismo turno');
  // Todo `anotarSaturado(` de la cascada va detrás de lo que el proveedor DICE (`dijoSaturado`), nunca de un timeout.
  const lineas = fuente('lib/ai-cheap.ts').split('\n').filter((l) => /anotarSaturado\(/.test(l) && !/^import /.test(l));
  assert.equal(lineas.length, 3, 'chatCheap, chatCheapTools y el guion de YouTube (guionDeYoutubeConGemini, 4/11/2026)');
  for (const l of lineas) assert.match(l, /if \(dijoSaturado\(/, `anota sin que el proveedor lo diga: ${l.trim()}`);
});

test('4. la réplica del Web Generator da UNA segunda vuelta a las secciones que quedaron sin IA', () => {
  const src = fuente('lib/editor-landing/replicar.ts');
  assert.match(src, /await correr\(tandas, '1ª vuelta'\);/);
  assert.match(src, /const faltan = tandas\.map\(\(t\) => t\.filter\(\(i\) => !porIndice\.has\(i\)\)\)\.filter\(\(t\) => t\.length > 0\);/);
  assert.match(src, /if \(faltan\.length\) await correr\(faltan, '2ª vuelta'\);/);
  assert.match(src, /return conMemoriaDelPedido\(\(\) => replicarComoBloques\(/, 'la réplica no tiene su memoria de cuelgues');
  // Las dos vueltas respetan el mismo plazo total (una tanda entera tiene que entrar).
  assert.match(src, /if \(Date\.now\(\) - t0 \+ TANDA_MS > PLAZO_BLOQUES_MS\) continue;/);
});

// Martín, 11/11/2026: «gastemos eso para todo esto en lugar de Gemini, porque es mucho más estable». Reemplaza al «último recurso»
// del 26/10 (el crédito DESPUÉS de las gratis, sólo para el editor de landings).
test('5. el espacio de MaKo: el crédito de Claude va PRIMERO y Gemini de respaldo; nunca un negocio, el Plan, `fallback: []` ni lo que no entra', () => {
  const P = R.P;
  assert.equal(P.respuesta, 'respuesta del crédito');
  assert.deepEqual(modelos(P), [], `con el crédito contestando se le pidió a Gemini: ${modelos(P).join(', ')}`);
  assert.deepEqual(P.credito, [{ model: 'claude-haiku-4-5', max_tokens: 7_400, clave: 'sk-ant-credito-de-prueba-cuenta-1' }],
    'una sola llamada, con el mismo tope de tokens de la tarea y la clave del crédito');
  assert.equal(P.filasDeUso, 1, 'el gasto del crédito no quedó anotado con su marca');
  assert.equal(R.P_gratisContesta.credito.length, 1, 'con una gratis sana, el crédito igual va primero');
  assert.equal(R.P_gratisContesta.respuesta, 'respuesta del crédito');
  assert.equal(R.P_otraTarea.credito.length, 1, 'otra tarea del espacio de MaKo (que no es del Plan) no usó el crédito');
  // Lo que NO cambia:
  assert.equal(R.P_negocio.credito.length, 0, 'un negocio paga su IA: el crédito de la plataforma no es para él');
  assert.equal(R.P_plan.credito.length, 0, 'el Plan usó el crédito («JAMÁS algo pago para el plan»)');
  assert.equal(R.P_sinCredito.credito.length, 0, 'una función con `fallback: []` mezcló el crédito con su proveedor');
  assert.equal(R.P_noEntra.credito.length, 0, 'un pedido que no entra en Haiku se mandó igual al crédito');
  // Sin el crédito, Gemini es la última opción real y recupera sus reintentos.
  assert.deepEqual(modelos(R.P_plan), [LATEST, LITE, LITE], `sin crédito, flash-lite no reintentó: ${modelos(R.P_plan).join(', ')}`);
  // Cortado por plazo después de mandar: queda la fila con la marca, y pasa a Gemini SIN probar la otra cuenta (el mismo Anthropic).
  assert.equal(R.P_corte.credito.length, 1, 'un plazo vencido del crédito probó la otra cuenta');
  assert.equal(R.P_corte.filasDeUso, 1, 'un corte del crédito no dejó rastro de lo que pudo gastar');
  assert.deepEqual(modelos(R.P_corte), [LATEST, LITE, LITE], 'después del corte del crédito, Gemini no quedó de respaldo con sus reintentos');
  // Sin saldo: la fila «sin crédito» (la ve el Uso) y contesta Gemini.
  assert.equal(R.P_sinSaldo.respuesta, `respuesta de ${LITE}`);
  assert.equal(R.P_sinSaldo.filasDeUso, 1);
  assert.equal(R.P_sinSaldoFila, 1, 'la cuenta sin saldo no dejó la fila «sin crédito hasta el próximo ciclo»');
  // El último recurso del 26/10 no vuelve: el crédito ya no cuenta como «otra opción» detrás de Gemini.
  const casc = fuente('lib/ai-cheap.ts');
  assert.doesNotMatch(casc, /ultimoRecursoDeMaKo|wsCredito/, 'volvió el crédito como último recurso, detrás de las gratis');
});

// ── Probado rompiéndolo (26/10/2026, segunda versión, después de la revisión del tren-l) ────────────────────────────────
// Cada cambio a mano en lib/ai-cheap.ts (o en lib/ia-saturacion.ts / replicar.ts), corrido y restaurado de memoria:
//   1. `modelosAProbar` sin `primeroLosSanos`                         → rojo «2. un cuelgue… el pedido siguiente…».
//   2. sin el `break` de la saturación en la cascada                  → rojo «2. un cuelgue…» (reintenta el mismo modelo).
//   3. `chatCheap` sin anotar el 503                                  → rojo «2. un cuelgue…» (C: saturadoDespues).
//   4. el turno con herramientas sin anotar                           → rojo «3. el turno con herramientas…».
//   5. `esSaturacion` contando el 429                                 → rojo «1. qué es saturación…».
//   6. la réplica sin la segunda vuelta                               → rojo «4. la réplica…».
//   7. `fallaDeSaturacion` sin mirar el plazo necesario (cualquier timeout cuenta) → rojo «1. un timeout…» y «2. una tanda GRANDE…».
//   8. `hayOtraOpcion` contando el último de `orden` y no el último CON clave     → rojo «2. la ÚLTIMA opción real…».
//   9. la reserva de vuelta (`quedan() - MIN_INTENTO_MS` en `plazoDeIntento`)     → rojo «2. una tanda GRANDE…».
// Tercera versión, después de la verificación del tren-m (26/10/2026), siete más con el mismo arnés:
//  10. `chatCheap` anotando el timeout para el PROCESO                → rojo «2. una tanda GRANDE…», «2. un TIMEOUT…», «2. adentro de una réplica…», «3.».
//  11. `chatCheapTools` anotando el timeout para el PROCESO           → rojo «3. el turno con herramientas…».
//  12. `primeroLosSanos` sin mirar los cuelgues del pedido            → rojo «2. adentro de una réplica…».
//  13. la réplica sin `conMemoriaDelPedido`                           → rojo «4. la réplica…».
//  14. `hayRed` sin mirar `pii`                                       → rojo «2. una red de la plataforma PEDIDA…».
//  15. `hayRed` sin mirar el super admin                              → rojo «2. una red de la plataforma PEDIDA…».
//  16. la memoria del pedido escrita en la del proceso                → rojo «2. una tanda GRANDE…», «2. un TIMEOUT…», «2. adentro…».
// El último recurso de lo interno de MaKo (26/10/2026), roto con el mismo arnés:
//  17. el bloque del crédito sin mirar que sea el espacio de MaKo     → rojo «5.» (un negocio lo usó).
//  18. el crédito sin el `maxTokens` de la tarea                     → rojo «5.» (pidió 1.024).
//  19. una llamada al crédito ANTES del lazo de las gratis            → rojo «5.» (contestó el crédito con una gratis sana).
// ⚠️ Las roturas 17 a 23 (el último recurso del 26/10) ya no aplican: el 11/11/2026 el crédito pasó a ir PRIMERO (test 5, nuevo).
// El crédito primero en el espacio de MaKo (11/11/2026), con el mismo arnés:
//  25. «es la plataforma» siempre true                                  → rojo «5.» (un negocio usó el crédito).
//  26. «es la plataforma» comparado con el ws1 (OWNER_WS)                → rojo «5.» (el ws9 no lo usó).
//  27. la regla sin mirar el Plan                                       → VERDE: el Plan lo frenan dos capas más (`planPuedePagarConSuClave`
//      y `evaluarClaveDelNegocio`); la regla sola la caza tests/credito-plataforma.test.ts (R2).
//  28. sin mirar `sinCredito` (`fallback: []`)                          → rojo «5.».
//  29. sin el techo de entrada de Haiku                                 → rojo «5.».
//  30. un plazo vencido prueba la otra cuenta                           → rojo «5.» (P_corte).
//  31. un corte del crédito sin su fila «cortada»                       → rojo «5.» (P_corte).
// Y en tests/veto-claude-credito-plataforma.test.ts: la puerta leyendo las claves para un negocio, y el veto con
// `esLaPlataforma === false` (sin saber, dejaba pasar) → rojo «lo interno de MaKo usa el crédito SÓLO…».
// Segunda verificación del tren-m (26/10/2026):
//  20. `hayRed` = la red PEDIDA, sin preguntarle a `provsGratisDePlataforma` → rojo «2. una red … PEDIDA…» (G3: un negocio sin PII).
//  21. el crédito sin contar como otra opción                           → rojo «5.» (flash-lite reintentaba antes del crédito).
//  22. el crédito contado aunque no haya claves                         → rojo «2. la ÚLTIMA opción real…» y «2. una red…» (G2).
//  23. un corte del crédito sin su fila de uso                          → rojo «5.» (P_corte).
