// =============================================================================
// Conectar su IA es OPCIONAL: ninguna caja ni apertura dice que hace falta para escribir (20/11/2026)
// =============================================================================
// Desde la llamada con Leila, MaKo contesta con los MaKo Tokens (tests/app-de-escritorio-primero.test.ts). El Cerebro, el mismo
// día: «Conectar tu IA» se queda, pero como opción —usa la suscripción de la persona y gasta menos MaKo Tokens
// (ia-del-cliente-suscripcion)—, y se va todo texto que diga o insinúe que HACE FALTA para que MaKo conteste. Lo que fija:
//   1. la escalera del Cerebro la ofrece como opción: el texto habla de la suscripción y de los MaKo Tokens, y con «Ninguna
//      todavía» MaKo no insiste;
//   2. un pedido de una apertura sale aunque falte su IA (no queda «pendiente» detrás de «Conecta tu IA»);
//   3. la línea del teléfono y la del Uso la dicen opcional;
//   4. ningún texto de las piezas de los chats dice que hace falta su IA para que MaKo conteste o escriba.
//
// Correr: node --import tsx --test tests/chat-su-ia-opcional.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGO, EJEMPLOS, ID_IA, IA_CLAUDE, IA_NINGUNA, aperturaOps } from '../lib/aperturas/ops';
import { pasoSinIA } from '../lib/aperturas/comunes';
import { problemasDeApertura } from '../lib/aperturas/reglas';
import { resumenDeCuentas } from '../lib/ia-pc-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
/** Lo que dice que su IA HACE FALTA para que MaKo conteste o escriba. */
const HACE_FALTA = /para que MaKo conteste|uso tu propia IA|(ya )?escribo por ti|y lo escribo|con eso contesta|Ya tengo tu IA/i;

test('1. la escalera del Cerebro ofrece su IA como opción, y con «Ninguna todavía» no insiste', () => {
  const pregunta = aperturaOps({ app: 'tiene', iaConectada: false }, {})!;
  assert.equal(pregunta.id, ID_IA);
  assert.match(pregunta.texto, /MaKo Tokens/, 'dice para qué sirve: gastar menos MaKo Tokens');
  assert.doesNotMatch(pregunta.texto, HACE_FALTA);
  assert.deepEqual(problemasDeApertura(pregunta, { primerPaso: true }), []);
  const conectar = aperturaOps({ app: 'tiene', iaConectada: false }, { [ID_IA]: IA_CLAUDE })!;
  assert.match(conectar.texto, /MaKo Tokens/);
  assert.doesNotMatch(conectar.texto, HACE_FALTA);
  assert.equal(aperturaOps({ app: 'tiene', iaConectada: false }, { [ID_IA]: IA_NINGUNA }), null, 'sin cuenta, MaKo no insiste');
  assert.ok(!CATALOGO.some((c) => c.id === 'ops:ia-cuenta'), '«Crea tu cuenta y vuelve» se fue');
  for (const e of EJEMPLOS) {
    const a = aperturaOps(e.h, e.r);
    assert.equal(a?.id ?? null, e.espera, e.nombre);
    if (a) assert.deepEqual(problemasDeApertura(a, { primerPaso: !!e.primerPaso }), [], e.nombre);
  }
});

test('2. un pedido de una apertura sale aunque falte su IA', () => {
  assert.equal(pasoSinIA({ superficie: 'copywriter' }), null, 'nada que conectar antes de pedir');
  const pendiente = pasoSinIA({ superficie: 'copywriter', pendiente: { texto: 'Adapta esta página', para: 'Mentoría' } })!;
  assert.equal(pendiente.botones[0].tipo, 'pedir', 'un pendiente de antes se ofrece para escribirlo');
  assert.doesNotMatch(pendiente.texto, HACE_FALTA);
  const pieza = sinComentarios(leer('app/_chat/AperturaMako.tsx'));
  assert.match(pieza, /const puede = !!p\.onPedir;/, 'el pedido no espera a que conecte su IA');
});

test('3. la línea del teléfono y la del Uso la dicen opcional', () => {
  const aviso = leer('app/m/_chat/AvisoDeIA.tsx');
  assert.match(aviso, /export const FALTA_IA = 'Opcional: [^']*MaKo Tokens[^']*';/);
  const sinNada = resumenDeCuentas({ pcs: [], grupos: { cuentas: [], sinCuenta: [] } }, true);
  assert.match(sinNada.linea, /^Opcional: .*MaKo Tokens/);
  assert.equal(sinNada.tono, 'apagado', 'no es una alerta');
});

test('4. ningún texto de los chats dice que hace falta su IA para que MaKo conteste', () => {
  const dirs = ['app/_chat', 'app/second-brain', 'app/m/_chat', 'app/m/second-brain', 'lib/aperturas'];
  const con: string[] = [];
  for (const d of dirs) {
    for (const n of readdirSync(join(RAIZ, d))) {
      if (!/\.(ts|tsx)$/.test(n)) continue;
      if (HACE_FALTA.test(sinComentarios(leer(`${d}/${n}`)))) con.push(`${d}/${n}`);
    }
  }
  if (HACE_FALTA.test(sinComentarios(leer('lib/ia-pc-reglas.ts')))) con.push('lib/ia-pc-reglas.ts');
  assert.deepEqual(con, []);
});

// PROBADO ROMPIÉNDOLO (20/11/2026, base 4/0; contra el código de antes 0/4), de a una y restaurando:
//   · la escalera otra vez con «Para escribir por ti uso tu propia IA»        → 2/2 (1, 4)
//   · «Ninguna todavía» otra vez con «Crea tu cuenta y vuelve»                → 3/1 (1)
//   · el pedido de una apertura esperando a su IA                            → 3/1 (2)
//   · el paso «Conecta tu Claude o tu ChatGPT y lo escribo» antes de pedir   → 2/2 (2, 4)
//   · la línea del teléfono otra vez «Conecta tu IA para que MaKo conteste»  → 2/2 (3, 4)
//   · el Uso otra vez en color de alerta                                     → 3/1 (3)
//   · la caja común con «… para que MaKo conteste»                           → 3/1 (4)
