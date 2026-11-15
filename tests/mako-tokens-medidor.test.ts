// =============================================================================
// El medidor de MaKo Tokens: una generación sólo corre si hay saldo (15/11/2026)
// =============================================================================
// Martín, 15/11/2026: «vinculemos todas las cosas que utilicen inteligencia artificial y que todo utilice MaKo Tokens…
// Le damos la opción de conectar su flow, sí, pero en general al principio generan con MaKo Tokens».
//
// Esto NO prueba la aritmética de la caja (eso es scripts/probar-0416-pglite.mjs, contra un Postgres de verdad). Prueba
// el ENGANCHE, que es lo que no se puede ver leyendo: que las entradas REALES de la capa de IA pasan por el medidor, que
// sin saldo **no salen a ningún proveedor**, y que con su propia IA conectada no descuentan nada.
//
// La propiedad que fija, en una línea: **si no hay saldo, la lista de hosts a los que salió la llamada está VACÍA.** No
// «devolvió un error»: no gastó. Es la diferencia entre medir y frenar, y es la única versión que protege la caja.
//
// Correr: node --import tsx --test tests/mako-tokens-medidor.test.ts
//
// Probado rompiéndolo (15/11/2026, una rotura por vez, restaurada): las roturas y qué casos dan rojo están al final de
// docs/hallazgos-mako-tokens.md.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');

type Pedido = { fn: string; ws: number; cuesta?: number; feature?: string | null; dioOk?: boolean; deltaCupo?: number; deltaComprado?: number; motivo?: string };
type Corrida = { red: string[]; pedidos: Pedido[]; saldoFinal: number; tiro?: string };

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_mako-tokens-medidor-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240_000, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Corrida> & {
  error?: string;
  reservas: Record<string, number>;
};

const gastos = (c: Corrida) => c.pedidos.filter((p) => p.fn === 'gastar');
const ajustes = (c: Corrida) => c.pedidos.filter((p) => p.fn === 'ajustar');

test('0. el hijo corrió', () => {
  assert.equal(R.error, undefined, String(R.error));
});

test('1. SIN SALDO la llamada no sale a NINGÚN proveedor — texto, Claude y audio', () => {
  for (const caso of ['sinSaldo', 'sinSaldoClaude', 'sinSaldoAudio', 'saldoInsuficiente'] as const) {
    const c = R[caso];
    assert.deepEqual(c.red, [], `${caso}: salió a ${c.red.join(', ')} sin saldo para pagarlo`);
    assert.ok(c.tiro, `${caso}: tenía que avisar que no hay saldo`);
    assert.match(c.tiro!, /SinSaldoDeMakoTokens/, `${caso}: tiró otra cosa: ${c.tiro}`);
    // Y el texto que lee la persona dice qué hacer, no «falló la IA».
    assert.match(c.tiro!, /MaKo Tokens/, `${caso}: el mensaje no nombra los MaKo Tokens: ${c.tiro}`);
  }
});

test('1b. y una feature que la tabla de costos NO mapea también cobra (falla cerrada)', () => {
  const c = R.sinSaldoSinMapear;
  assert.ok(R.reservas.sinMapear > 0, 'una feature sin fila propia tiene que costar algo, no cero');
  assert.deepEqual(c.red, [], `una feature nueva salió gratis a ${c.red.join(', ')}`);
  assert.match(String(c.tiro), /SinSaldoDeMakoTokens/);
});

test('2. CON SALDO se reserva lo que dice la tabla de costos, al negocio que pidió', () => {
  const c = R.conSaldo;
  const g = gastos(c);
  assert.equal(g.length, 1, `se reservó ${g.length} veces y tenía que ser UNA`);
  assert.equal(g[0].cuesta, R.reservas.closing, 'se reservó algo distinto de lo que dice la tabla');
  assert.equal(g[0].feature, 'closing');
  assert.equal(g[0].ws, 14, 'se le cobró a otro negocio');
});

test('2c. ⚠️ MEDICIÓN: hoy un negocio SIN CLAVES no llega a ningún proveedor, ni con saldo', () => {
  // Esto NO es un fallo del medidor: es la decisión del 22/10/2026 que sigue en el código.
  // `provsGratisDePlataforma` (lib/ai-cheap.ts) hace `if (ws !== plataforma) return []` con esta nota: «LA RED NO CORRE
  // PARA NINGÚN NEGOCIO… MaKo no paga ni presta IA a los clientes: sin su IA, "Conecta tu IA"». O sea que hoy MaKo no
  // paga la IA de texto de ningún cliente, salvo el crédito de Claude del onboarding (`CREDITO_HABILITADO_PARA`: tres
  // features, y sólo durante el onboarding).
  //
  // **Por eso el medidor es el candado de una puerta que hoy está soldada**: para que «todo gasta MaKo Tokens» (Martín,
  // 15/11/2026) sea cierto, hay que volver a prestarle la IA de MaKo al negocio que no conectó la suya — y ÉSA es una
  // decisión de plata y de privacidad (D6b), no un cambio del medidor.
  //
  // Queda como test para que el día que esa puerta se abra, esto se ponga en rojo y alguien lo lea.
  assert.deepEqual(R.conSaldo.red, [], `un negocio sin claves llegó a ${R.conSaldo.red.join(', ')}: la red de la plataforma volvió a prestarse — revisá docs/hallazgos-mako-tokens.md`);
  // Y el control de que el arnés sí puede ver la red: con SU clave, la llamada sale (caso 4).
  assert.ok(R.conSuIA.red.length > 0, 'si esto falla, el arnés no ve la red y el vacío de arriba no prueba nada');
});

test('2b. y lo más caro reserva más que lo más barato (el estimado sale de lo MEDIDO)', () => {
  assert.ok(
    R.reservas.experimentos > R.reservas.closing,
    `la Retro (US$0,0989 medido) tiene que reservar más que analizar una llamada (US$0,00712): ${R.reservas.experimentos} vs ${R.reservas.closing}`,
  );
  assert.equal(gastos(R.conSaldoCaro)[0].cuesta, R.reservas.experimentos);
});

test('3. UNA LLAMADA QUE FALLA NO SE COBRA: la reserva vuelve entera', () => {
  // En el hijo ningún proveedor contesta (la red de mentira devuelve 500), así que nadie reportó costo real.
  const c = R.conSaldo;
  const a = ajustes(c);
  assert.equal(a.length, 1, `tenía que haber UNA liquidación y hubo ${a.length}`);
  assert.equal(a[0].motivo, 'devolucion', `la liquidación de una llamada que no costó nada es una devolución, no un ${a[0].motivo}`);
  assert.equal(
    (a[0].deltaCupo ?? 0) + (a[0].deltaComprado ?? 0), R.reservas.closing,
    'la devolución no fue por la reserva entera: una llamada que falló le quedó cobrada al cliente',
  );
  assert.equal(c.saldoFinal, 50_000, `el saldo tenía que volver a 50.000 y quedó en ${c.saldoFinal}`);
});

test('4. con SU IA conectada no descuenta NADA (la opción que Martín dejó abierta el 15/11)', () => {
  const c = R.conSuIA;
  assert.deepEqual(gastos(c), [], 'le descontó MaKo Tokens a un negocio que paga su propia IA');
  assert.deepEqual(ajustes(c), [], 'le tocó la caja a un negocio que paga su propia IA');
  // Y la llamada corrió igual, con saldo CERO: es la prueba de que la exención no es sólo «no cobró».
  assert.ok(c.red.length > 0, 'con su IA, la llamada tenía que salir igual (a la suya)');
});

test('5. la PLATAFORMA no se cobra a sí misma (y el ws1 sí, que es un cliente)', () => {
  assert.deepEqual(gastos(R.plataforma), [], 'lo interno de MaKo descontó MaKo Tokens de algún negocio');
});

test('6. lo AUTOMÁTICO se saltea en silencio; lo que la persona dispara le avisa', () => {
  // ⚠️ La misma falta de saldo, dos salidas distintas, y es a propósito: cobrarle cuota por un cron es que la persona
  // abra la app y la encuentre vaciada por algo que no hizo (regla de la tarifa, 09/08/2026).
  assert.match(String(R.automaticaSinSaldo.tiro), /SalteadoSinSaldo/, `una reunión de Fathom sin saldo tenía que saltearse: ${R.automaticaSinSaldo.tiro}`);
  assert.match(String(R.disparadaSinSaldo.tiro), /SinSaldoDeMakoTokens/, `espiar un competidor lo dispara la persona: tiene que avisarle: ${R.disparadaSinSaldo.tiro}`);
  // Las dos frenan igual: ninguna sale a un proveedor.
  assert.deepEqual(R.automaticaSinSaldo.red, [], 'el cron automático gastó sin saldo');
  assert.deepEqual(R.disparadaSinSaldo.red, [], 'la acción de la persona gastó sin saldo');
});

test('7. lo que hoy cuesta CERO no le pide nada a la caja ni se frena', () => {
  assert.equal(R.reservas.guardian, 0, 'el Perro Guardián está medido en cero (hoy rutea a un free tier)');
  assert.deepEqual(gastos(R.gratisSinSaldo), [], 'una feature de costo cero no tiene por qué pedirle nada a la caja');
  // Lo que importa: con saldo cero NO tira. Que llegue o no a un proveedor es otra cosa (caso 2c).
  assert.equal(R.gratisSinSaldo.tiro, undefined, `una feature de costo cero se frenó por falta de saldo: ${R.gratisSinSaldo.tiro}`);
});

test('8. UNA reserva por operación, aunque adentro se llame a OTRA función pública de la capa de IA', () => {
  // `chatClaude` cae a `chatCheapCascade` cuando su catálogo lo manda: dos funciones públicas, las dos con el enganche.
  // Si cada una abriera su cuenta, la operación se cobraría dos veces — y el cliente no tendría forma de notarlo.
  const c = R.anidada;
  assert.equal(gastos(c).length, 1, `una operación anidada reservó ${gastos(c).length} veces en vez de UNA`);
  assert.equal(ajustes(c).length, 1, `y liquidó ${ajustes(c).length} veces en vez de UNA`);
});

test('8b. el REGALO DEL ONBOARDING no se cobra dos veces, y la excepción se cierra sola al pagar un plan', () => {
  // ⚠️ El rojo que esto evita es el peor del producto: el primer ingreso de un cliente nuevo, que todavía no paga un
  // plan y por lo tanto no tiene cupo, se quedaba sin leer sus documentos ni armar su oferta con un «te quedaste sin
  // MaKo Tokens» antes de haber usado nada. MaKo le paga esas tres cosas a propósito (`CREDITO_HABILITADO_PARA`), con un
  // techo más angosto que un cupo: tres features, sólo durante el onboarding, con clave propia y fecha de vencimiento.
  assert.deepEqual(gastos(R.onboardingSinCupo), [], 'le cobró al negocio nuevo el crédito del onboarding');
  assert.equal(R.onboardingSinCupo.tiro, undefined, `el alta de un cliente nuevo se frenó: ${R.onboardingSinCupo.tiro}`);
  // Pero sólo esas tres: cualquier otra cosa, sin cupo, se frena igual.
  assert.match(String(R.onboardingOtraFeature.tiro), /SinSaldoDeMakoTokens/, 'un negocio sin plan corrió algo que no es del crédito del onboarding');
  // Y el que YA paga un plan sí las paga: el corte es «no tiene cupo», no la feature.
  assert.equal(gastos(R.archiveroConPlan).length, 1, 'un negocio con plan tiene que pagar también El Archivero');
});

test('9. SIN WORKSPACE el medidor no se cuelga (el enganche es una RE-ENTRADA)', () => {
  // ⚠️ El bug que este repo ya pagó con la puerta de D6b y que volvió el 15/11/2026: un wrapper que decide «acá no hago
  // nada» y devuelve `fn()` sin abrir su AsyncLocalStorage se llama a sí mismo para siempre, porque el enganche es
  // `if (!medidorAbierto()) return conMedidorDeMt(…, () => estaMismaFuncion(opts))`. No da error: no termina.
  for (const [nombre, r] of Object.entries((R as unknown as { sinWorkspace: Record<string, unknown> }).sinWorkspace)) {
    assert.equal(r, 'volvió', `${nombre} sin workspace quedó colgado: el medidor no abrió su almacén antes de re-entrar`);
  }
});
