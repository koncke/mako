// =============================================================================
// Las preguntas que quedaban abiertas para siempre o se perdían sin aviso (25/10/2026)
// =============================================================================
// 1. LA CADENA. «Ventas de MaKo» preguntó con AskUserQuestion en la cuenta 2 (23/10, 19:20) y la conversación siguió en la
//    cuenta 1, que escribió mucho después. `superarPreguntas` sólo miraba turnos de la MISMA sesión: la pregunta quedó «Espera
//    tu respuesta» hasta que el Cerebro la retiró a mano. Ahora cuenta un turno de cualquier sesión del chat (la que el Ops
//    Center junta por el nombre: `cadenasDeSesiones`).
// 2. `preguntar` LE GANA A LA 'ask' IGUAL. Con el hook que convierte cada AskUserQuestion en `cartero preguntar`, la copia 'ask'
//    sube primero y el archivo de `preguntar` llega 0,4-1 s después. En vueltas distintas, `unirPreguntas` descartaba la de
//    `preguntar` por igual y el primer turno del chat superaba la 'ask': nada contestable (2-5 % de las veces).
// 3. EL CARTERO. `preguntasParaSubir` dejaba UNA pregunta de cierre por chat mezclando wrap_up y 'ask': una 'ask' más nueva
//    tapaba a la de wrap_up.
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 6/0): `superarPreguntas` sin la cadena → 1 rojo (1); el Runner adentro de la cadena →
// 1 rojo (2); `unirPreguntas` sin la regla de la 'ask' → 1 rojo (3); el cartero con «la última» para todas → 1 rojo (4); el
// ciclo sin pasarle la cadena a los turnos → 1 rojo (6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { superarPreguntas, unirPreguntas, estaAbierta, type PreguntaChat, type TurnoQueSupera } from '../lib/centro-preguntas-chat';
import { cadenasDeSesiones } from '../lib/centro-chats';

const S = (n: number) => `local_${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const CUENTA2 = S(2);
const CUENTA1 = S(1);
const OTRO = S(9);
let n = 0;
const preg = (local: string, at: string, origen?: 'ask' | 'wrap_up', texto = '¿Qué precio le ponemos a MaKo?'): PreguntaChat => ({
  id: `${String(++n).padStart(8, '0')}-1111-4222-8333-444444444444`, local, pregunta: texto, contexto: null,
  opciones: [{ titulo: 'A', detalle: null }, { titulo: 'B', detalle: null }], recomendada: 0, varias: false, at, respuesta: null,
  ...(origen ? { origen } : {}),
});
const turno = (local: string, rol: string, at: string): TurnoQueSupera => ({ local, rol, at });

test('1. una pregunta se supera con el turno de OTRA sesión del mismo chat (la conversación siguió en otra cuenta)', () => {
  const cadena = new Map([[CUENTA2, [CUENTA2, CUENTA1]], [CUENTA1, [CUENTA2, CUENTA1]]]);
  const ask = preg(CUENTA2, '2026-10-23T22:20:00.000Z', 'ask');
  const wrap = preg(CUENTA2, '2026-10-23T22:25:00.000Z', 'wrap_up', '¿Seguimos con el tren?');
  const sigue = [turno(CUENTA1, 'el', '2026-10-24T02:00:00.000Z'), turno(CUENTA1, 'yo', '2026-10-24T02:05:00.000Z')];
  // Sin la cadena, lo de antes: nada la supera.
  assert.equal(superarPreguntas([ask, wrap], sigue).filter(estaAbierta).length, 2);
  const [a, w] = superarPreguntas([ask, wrap], sigue, cadena);
  assert.equal(a.superada, '2026-10-24T02:00:00.000Z', 'la ask: el primer turno de la cuenta 1');
  // Desde el 27/10 también lo que el chat escribe después (pasado el margen de su cierre): tests/preguntas-superadas-hueco.test.ts.
  assert.equal(w.superada, '2026-10-24T02:00:00.000Z', 'la de wrap_up: lo primero de la cuenta 1 que vino después');
  // Un turno de OTRO chat no la toca, y uno de la cadena ANTERIOR a la pregunta tampoco.
  assert.equal(superarPreguntas([ask], [turno(OTRO, 'el', '2026-10-24T02:00:00.000Z'), turno(CUENTA1, 'el', '2026-10-23T20:00:00.000Z')], cadena)[0].superada, undefined);
});

test('2. la cadena es la del Ops Center: el mismo nombre en todas las cuentas; el Cerebro con su nombre de antes; sin Runners ni la nube', () => {
  const ch = (local: string, titulo: string, extra: object = {}) => ({ local, titulo, cuenta: null, vivo: true, estado: 'idle' as const, actividad: null, ...extra });
  const cadena = cadenasDeSesiones([
    { chats: [ch(CUENTA2, 'Ventas de MaKo'), ch(S(3), 'Cerebro'), ch(S(5), 'Runner', { esRunner: true as const })] },
    { chats: [ch(CUENTA1, 'ventas de MAKO'), ch(S(4), 'Estrategia 3 cuentas'), ch(S(6), 'Runner', { esRunner: true as const })] },
    { chats: [ch('cse_0123456789abcdef0123456789abcdef', 'Ventas de MaKo', { nube: true as const })] },
  ]);
  assert.deepEqual(cadena.get(CUENTA2), [CUENTA2, CUENTA1]);
  assert.deepEqual(cadena.get(CUENTA1), [CUENTA2, CUENTA1]);
  assert.deepEqual(cadena.get(S(3)), [S(3), S(4)], 'el Cerebro, con su nombre de antes');
  assert.equal(cadena.get(S(5)), undefined, 'un Runner no es un chat');
  assert.deepEqual(cadena.get('cse_0123456789abcdef0123456789abcdef'), ['cse_0123456789abcdef0123456789abcdef'], 'la nube, aparte');
});

test('3. la de `preguntar` le gana a la MISMA de AskUserQuestion, en los cuatro órdenes', () => {
  const T = '2026-10-25T03:00:00.000Z';
  const despues = [turno(CUENTA1, 'el', '2026-10-25T03:05:00.000Z')];
  // Lo que hace guardarPreguntas con cada vuelta (lib/centro-preguntas-chat-db.ts).
  const vuelta = (antes: PreguntaChat[], nuevas: PreguntaChat[], turnos: TurnoQueSupera[] = []) =>
    superarPreguntas(unirPreguntas(superarPreguntas(antes, turnos), nuevas), turnos);
  const contestable = (ps: readonly PreguntaChat[]) => ps.filter(estaAbierta).filter((p) => !p.origen);
  const casos: Array<[string, () => PreguntaChat[]]> = [
    ['la ask antes (vueltas distintas)', () => { const ask = preg(CUENTA1, T, 'ask'); const pr = preg(CUENTA1, '2026-10-25T03:00:01.000Z'); return vuelta(vuelta([], [ask]), [pr], despues); }],
    ['la ask después', () => { const pr = preg(CUENTA1, '2026-10-25T03:00:01.000Z'); const ask = preg(CUENTA1, T, 'ask'); return vuelta(vuelta([], [pr]), [ask], despues); }],
    ['en la misma tanda', () => vuelta([], [preg(CUENTA1, T, 'ask'), preg(CUENTA1, '2026-10-25T03:00:01.000Z')], despues)],
    ['desde el ciclo de otra cuenta (la ask ya guardada, abierta, por el Runner de otra cuenta)', () => {
      // La ask la subió el Runner de otra cuenta; todavía sin turnos del chat: queda abierta. Después llega la de preguntar.
      const guardada = vuelta([], [preg(CUENTA1, T, 'ask')]);
      return vuelta(guardada, [preg(CUENTA1, '2026-10-25T03:00:01.000Z')], despues);
    }],
  ];
  for (const [nombre, armar] of casos) {
    const r = armar();
    assert.equal(contestable(r).length, 1, `${nombre}: no quedó la de preguntar para contestar`);
    assert.equal(r.filter(estaAbierta).length, 1, `${nombre}: quedaron dos abiertas`);
  }
  // La ask que pierde queda superada a la hora de la nueva.
  const ask = preg(CUENTA1, T, 'ask');
  const pr = preg(CUENTA1, '2026-10-25T03:00:01.000Z');
  assert.equal(unirPreguntas([ask], [pr]).find((p) => p.id === ask.id)?.superada, '2026-10-25T03:00:01.000Z');
});

test('4. el cartero: «la última de cada chat» es sólo de wrap_up; una ask más nueva no la tapa', async () => {
  const { preguntasParaSubir, VERSION } = await import('../scripts/operaciones/cartero.mjs');
  const wrapViejo = preg(CUENTA1, '2026-10-25T01:00:00.000Z', 'wrap_up', '¿Subo el tren?');
  const wrap = preg(CUENTA1, '2026-10-25T02:00:00.000Z', 'wrap_up', '¿Subo el tren ahora?');
  const ask1 = preg(CUENTA1, '2026-10-25T03:00:00.000Z', 'ask', '¿Qué precio?');
  const ask2 = preg(CUENTA1, '2026-10-25T04:00:00.000Z', 'ask', '¿Qué moneda?');
  const { preguntas } = preguntasParaSubir([], [wrapViejo, wrap, ask1, ask2]);
  assert.deepEqual(new Set(preguntas.map((q: PreguntaChat) => q.id)), new Set([wrap.id, ask1.id, ask2.id]));
  assert.ok(['1.18.1', '1.19.0', '1.20.0', '1.21.0', '1.22.0', '1.22.1', '1.23.0', '1.24.0', '1.25.0', '1.26.0', '1.26.1'].includes(VERSION), 'la regla de «la última» llegó en la 1.18.1');
});

test('5. sin la cadena (no se pudo leer), cada pregunta se supera como antes, por su sesión', () => {
  const ask = preg(CUENTA2, '2026-10-23T22:20:00.000Z', 'ask');
  assert.equal(superarPreguntas([ask], [turno(CUENTA2, 'el', '2026-10-23T23:00:00.000Z')])[0].superada, '2026-10-23T23:00:00.000Z');
});

test('6. el ciclo del cartero arma la cadena y se la pasa a los turnos y a las preguntas', () => {
  const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
  const ops = leer('lib/operaciones.ts');
  assert.match(ops, /const cadena = turnos\.length \|\| preguntas\.length \? await cadenaDeLasCuentas\(\) : undefined;/);
  assert.match(ops, /await guardarTurnos\(turnos, cadena\)/);
  assert.match(ops, /await guardarPreguntas\(preguntas, cadena\)/);
  assert.match(leer('lib/centro-turnos-db.ts'), /await superarConTurnos\(turnos, cadena\)/);
  const db = leer('lib/centro-preguntas-chat-db.ts');
  assert.match(db, /const locales = \[\.\.\.new Set\(quienes\.flatMap\(\(l\) => deLaCadena\(l, cadena\)\)\)\];/, 'las preguntas de las OTRAS sesiones');
  assert.match(db, /const superadas = superarPreguntas\(actuales, turnos, cadena\);/);
});
