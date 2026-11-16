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
import { readFileSync } from 'node:fs';

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

test('8c. LA MIGRACIÓN QUE FALTA no apaga el producto (ticket #103, 16/11/2026)', () => {
  // ⚠️ ESTE ES EL ROJO QUE PASÓ EN PRODUCCIÓN. El código salió a main y la 0416 no se había aplicado: la RPC no
  // existía, `gastarMt` falló cerrado —como está escrito que haga— y el grupo de WhatsApp del ws 23 se quedó mudo
  // frente a un lead nuevo. El diagnóstico obvio («fallar cerrado es lo seguro») era el equivocado: una caja que no
  // existe no tiene nada que proteger, y fallar cerrado sólo apaga el producto.
  for (const caso of ['sinCaja', 'sinCajaClaude', 'sinCajaAudio'] as const) {
    const c = R[caso];
    // Que NO TIRE es la prueba: el medidor dejó correr el cuerpo y la cascada llegó hasta el final por sus propios
    // medios. (Hasta dónde llega después no lo decide el medidor: hoy un negocio sin claves no alcanza a ningún
    // proveedor por la puerta soldada del 22/10 — eso lo mide el caso 2c, y pasa igual CON saldo.)
    // (Lo que sí puede tirar es otra cosa suya: el ws14 tiene el veto de Claude vencido. Lo que no puede volver a
    // aparecer es el freno del medidor.)
    assert.doesNotMatch(String(c.tiro ?? ''), /SinSaldo|Salteado|MaKo Tokens/, `${caso}: la migración que falta frenó la llamada — ${c.tiro}`);
    // Y se intentó cobrar: la tolerancia no es «no medir», es «no frenar». El aviso queda en el log.
    assert.ok(c.pedidos.some((p) => p.fn.endsWith('-sin-caja')), `${caso}: no intentó cobrar`);
    assert.equal(c.pedidos.some((p) => p.fn === 'gastar'), false, `${caso}: cobró con una caja que no existe`);
  }
  // Sin la 0416, la llamada se comporta EXACTAMENTE como si tuviera saldo: mismo alcance, sin frenos.
  assert.deepEqual(R.sinCaja.red, R.conSaldo.red, 'sin la 0416 la llamada no llegó tan lejos como con saldo');
  // Pero la tolerancia es a que falte la MIGRACIÓN, no a que falte la PLATA: con la caja puesta, sin saldo se frena.
  assert.deepEqual(R.conCajaDeVuelta.red, [], 'con la caja instalada y sin saldo, la llamada salió igual');
  assert.match(String(R.conCajaDeVuelta.tiro), /SinSaldoDeMakoTokens/);
});

test('8d. el «sin saldo» NO se disfraza de falla de proveedor (ticket #103)', () => {
  // ⚠️ Lo que leyó el dueño del negocio: «tu negocio todavía no conectó su IA… conecta tu GPT (una clave de OpenAI)».
  // Falso dos veces: desde el 15/11/2026 su IA la paga MaKo Tokens, y lo que falló fue la caja. La cascada tomaba la
  // excepción del medidor como «este candidato falló», la ponía en la lista de fallas DEL CLIENTE y la app traducía esa
  // lista a ese cartel. Ningún otro proveedor arregla una falta de saldo: la caja es del NEGOCIO, no de la clave.
  const lista = (R as unknown as { listaDeErrores: string[] }).listaDeErrores;
  assert.deepEqual(lista, [], `el medidor dejó su error en la lista del cliente: ${lista.join(' | ')}`);
  assert.match(String(R.sinSaldoConLista.tiro), /SinSaldoDeMakoTokens/, 'el «sin saldo» tiene que SALIR como excepción, no quedar en una lista');
  const r = (R as unknown as { reconoceElError: Record<string, boolean> }).reconoceElError;
  assert.equal(r.propio, true, 'esSinSaldoDeMt no reconoce su propio error');
  assert.equal(r.salteado, true, 'esSinSaldoDeMt no reconoce el salteo de un camino automático');
  assert.equal(r.ajeno, false, 'esSinSaldoDeMt confunde un 429 de un proveedor con falta de saldo');
});

test('8e. NINGÚN `catch` de la capa de IA puede quedarse con el «sin saldo» (estático)', () => {
  // ⚠️ ESTO ES ESTÁTICO A PROPÓSITO, y la razón es una limitación honesta del caso 8d: con el enganche donde está, el
  // medidor tira ANTES de que el cuerpo de la cascada corra, así que desde un test no se puede forzar la excepción
  // ADENTRO de un `catch` por candidato. Pero en producción llegó ahí (ticket #103), y el día que alguien agregue un
  // `catch` nuevo volvería a llegar. Lo que se puede afirmar sin ambigüedad es la forma del código: un `catch` que
  // convierte una excepción en un renglón de error TIENE que re-tirar el error del medidor antes.
  //
  // Si este test se pone rojo, no hay que aflojarlo: hay que agregarle el guarda al `catch` nuevo.
  const GUARDA = 'esSinSaldoDeMt(e)';
  for (const rel of ['lib/ai-cheap.ts', 'lib/anthropic.ts']) {
    const fuente = readFileSync(join(RAIZ, rel), 'utf8');
    // Los dos sabores: `} catch (e) {` y `.catch((e) => {`.
    const trozos = fuente.split(/\}\s*catch \(e\) \{|\.catch\(\(e\) => \{/);
    trozos.shift(); // lo de antes del primer catch
    trozos.forEach((t, i) => {
      // ⚠️ SÓLO EL BLOQUE DEL `catch`, contando llaves. Mirar «los próximos N caracteres» daba un falso rojo: el
      // `catch` del fetch crudo a Gemini (que no puede recibir esta excepción, no hay nada enganchado adentro) quedaba
      // marcado por un `.push(` que estaba DESPUÉS de su cierre.
      let d = 1, fin = t.length;
      for (let j = 0; j < t.length; j++) {
        if (t[j] === '{') d++;
        else if (t[j] === '}' && --d === 0) { fin = j; break; }
      }
      const cuerpo = t.slice(0, fin);
      // Sólo los que ARMAN un renglón de error: los demás (un `return null`, un log) no mienten a nadie.
      if (!/\.push\(|\{ error/.test(cuerpo)) return;
      assert.ok(
        cuerpo.includes(GUARDA),
        `${rel}: el catch nº ${i + 1} convierte una excepción en un error de proveedor sin re-tirar el «sin saldo».\n` +
        `Agregale «if (${GUARDA}) throw e;» como primera línea. Empieza así:\n${cuerpo.slice(0, 220)}`,
      );
    });
  }
});

test('9. SIN WORKSPACE el medidor no se cuelga (el enganche es una RE-ENTRADA)', () => {
  // ⚠️ El bug que este repo ya pagó con la puerta de D6b y que volvió el 15/11/2026: un wrapper que decide «acá no hago
  // nada» y devuelve `fn()` sin abrir su AsyncLocalStorage se llama a sí mismo para siempre, porque el enganche es
  // `if (!medidorAbierto()) return conMedidorDeMt(…, () => estaMismaFuncion(opts))`. No da error: no termina.
  for (const [nombre, r] of Object.entries((R as unknown as { sinWorkspace: Record<string, unknown> }).sinWorkspace)) {
    assert.equal(r, 'volvió', `${nombre} sin workspace quedó colgado: el medidor no abrió su almacén antes de re-entrar`);
  }
});
