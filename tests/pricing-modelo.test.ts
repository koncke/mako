// =============================================================================
// El CAC se mide en DOS monedas que nunca se suman
// =============================================================================
// El modelo viejo tenía un solo campo `cacUsd` que sumaba los medios, el costo de
// los Free que no pagan y las horas del dueño valuadas a US$100. Sumar horas con
// dólares dio «el único canal que entra es referidos», que es absurdo para alguien
// que tiene tiempo y no tiene capital: las dos monedas no son intercambiables.
//
// Estas guardas son la segunda capa (AGENTS.md → «Una regla en un prompt no es una
// regla»): el tipo puede volver a mezclarlas y el compilador no diría nada.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { CAC_CANALES } from '../app/admin/dev/pricing/modelo';

test('ningún canal mezcla horas con dólares', () => {
  for (const c of CAC_CANALES) {
    assert.equal(typeof c.plataPorCliente, 'number', `${c.id}: falta plataPorCliente`);
    assert.equal(typeof c.horas.aMano, 'number', `${c.id}: falta horas.aMano`);
    // La guarda que importa: no puede sobrevivir ningún campo que sume las dos.
    assert.ok(!('cacUsd' in c), `${c.id}: cacUsd todavía existe y suma horas con plata`);
    assert.ok(!('horasDueno' in c), `${c.id}: horasDueno en dólares todavía existe`);
  }
});

test('las horas con MaKo nunca son más que a mano', () => {
  for (const c of CAC_CANALES) {
    assert.ok(c.horas.conMaKo <= c.horas.aMano,
      `${c.id}: conMaKo (${c.horas.conMaKo}) > aMano (${c.horas.aMano})`);
  }
});

test('si conMaKo es menor que aMano, dice qué feature lo habilita', () => {
  for (const c of CAC_CANALES) {
    if (c.horas.conMaKo < c.horas.aMano) {
      assert.ok(c.horas.loHabilita, `${c.id}: baja las horas y no dice con qué feature`);
    }
  }
});

// =============================================================================
// El modelo de tiempo por fase
// =============================================================================
// Las fases NO cambian las horas del mes: las REPARTEN. Lo que hay que impedir es
// que el reparto prometa más horas de las que existen, y que el tope de clientes
// de high ticket se FIJE a mano en vez de salir del residual — que es justo lo que
// el dueño pidió: «la cantidad de clientes lo puedes sacar de la promesa de horas
// que les doy».
// =============================================================================

import { FASES_TIEMPO, HORAS_MES, horasLibres, topeClientes1a1 } from '../app/admin/dev/pricing/modelo';

test('ninguna fase reparte más horas de las que hay', () => {
  for (const f of FASES_TIEMPO) {
    const usadas = f.pisoAdquisicion + f.topeDebug + f.topeAgencia;
    assert.ok(usadas <= HORAS_MES, `${f.id}: reparte ${usadas} de ${HORAS_MES}`);
  }
});

test('el tope de clientes 1a1 sale del residual, no se fija', () => {
  const regimen = FASES_TIEMPO.find((f) => f.id === 'regimen')!;
  // 19 h en 12 semanas ≈ 6,33 h/mes por cliente (HIGH_TICKET.entrega)
  const tope = topeClientes1a1(regimen, 6.33);
  assert.equal(tope, Math.floor(horasLibres(regimen) / 6.33));
  assert.ok(tope > 0, 'en régimen tiene que entrar al menos un cliente de high ticket');
});

test('en la fase de adquisición no entra ningún cliente de high ticket', () => {
  const adq = FASES_TIEMPO.find((f) => f.id === 'adquisicion')!;
  assert.equal(topeClientes1a1(adq, 6.33), 0,
    'septiembre es 100% adquisición: no puede haber horas de entrega');
});

// =============================================================================
// Los 1.000 contactos: la cadena tiene que cerrar contra las altas
// =============================================================================
// BASE_PROPIA no es un canal, es un EVENTO de arranque que se agota en dos meses.
// Y como sus tasas se editan a mano, lo único que impide que las altas y las tasas
// se vayan cada una por su lado es esta cuenta. Ya pasó: nacieron declarando 8,5
// altas con tasas que dan 5,95 — el 3,5% de cierre y el 5% de otra corrida
// conviviendo en la misma línea.
// =============================================================================

import { BASE_PROPIA } from '../app/admin/dev/pricing/modelo';

test('las altas de los 1.000 contactos salen de sus propias tasas', () => {
  const cadena = BASE_PROPIA.contactos * BASE_PROPIA.responden * BASE_PROPIA.cierran * BASE_PROPIA.aprobacionCobro;
  const declaradas = BASE_PROPIA.altasMes1 + BASE_PROPIA.altasMes2;
  assert.ok(Math.abs(cadena - declaradas) <= 0.1,
    `la cadena da ${cadena.toFixed(2)} altas y la tabla declara ${declaradas.toFixed(2)} (mes 1 ${BASE_PROPIA.altasMes1} + mes 2 ${BASE_PROPIA.altasMes2})`);
});

// =============================================================================
// La matriz: qué canal entra en qué fase
// =============================================================================
// Acá es donde las dos monedas se podrían volver a mezclar sin que el compilador
// diga nada, porque `entraEn` recibe las dos y devuelve un solo booleano. El test
// que importa es el último: un canal que no cuesta plata tiene que entrar aunque
// el límite de plata sea de un centavo.
// =============================================================================

import { entraEn, horasDe } from '../app/admin/dev/pricing/modelo';

const canal = (id: string) => CAC_CANALES.find((c) => c.id === id)!;
const fase = (id: string) => FASES_TIEMPO.find((f) => f.id === id)!;

test('sin la feature construida rige el costo a mano', () => {
  const p = canal('prospeccion');
  assert.equal(horasDe(p, []), p.horas.aMano);
  assert.equal(horasDe(p, ['Agente: Chatbot']), p.horas.conMaKo);
});

test('el orgánico NO entra en desarrollo y SÍ en adquisición', () => {
  const o = canal('organico');
  assert.equal(entraEn(o, fase('desarrollo'), [], 105.84).entra, false);
  assert.equal(entraEn(o, fase('adquisicion'), [], 105.84).entra, true);
});

test('un canal caro en plata no entra aunque sobren horas', () => {
  const c = canal('carrito'); // 136,22 contra un límite de 105,84
  const v = entraEn(c, fase('adquisicion'), [], 105.84);
  assert.equal(v.entra, false);
  assert.match(v.porQueNo!, /plata/);
});

test('el veredicto nunca compara horas contra el límite de plata', () => {
  const o = canal('organico'); // plata 0, horas 26
  const v = entraEn(o, fase('adquisicion'), [], 0.01);
  // Con plata 0 entra aunque el límite sea de un centavo: las horas no cuentan acá.
  assert.equal(v.entra, true);
});

// =============================================================================
// La conclusión con la que abre cada parte
// =============================================================================
// El título dice de qué habla; la conclusión dice qué concluye. La tercera guarda
// es la que ataca la causa raíz de todo este plan: la conclusión de la parte 3
// afirmaba «solo entra un canal» mientras CAC_CANALES decía tres, porque la prosa
// se escribió cuando las dos monedas todavía se sumaban. Una frase en un archivo
// no se entera de que el dato de al lado cambió: el test sí.
// =============================================================================

import { INDICE, UNIT } from '../app/admin/dev/pricing/modelo';

test('cada parte tiene una conclusión, y dice un número', () => {
  for (const q of INDICE) {
    assert.ok(q.conclusion, `parte ${q.n}: no tiene conclusión`);
    assert.match(q.conclusion, /\d/, `parte ${q.n}: la conclusión no dice ningún número`);
  }
});

test('ninguna conclusión usa la palabra «techo»', () => {
  for (const q of INDICE) {
    assert.ok(!/techo/i.test(q.conclusion), `parte ${q.n}: dice «techo»`);
    assert.ok(!/techo/i.test(q.bajada), `parte ${q.n}: la bajada dice «techo»`);
  }
});

/** Los conteos chicos van en letras: «tres de los cinco canales» se lee. */
const EN_LETRAS = ['ningún', 'un', 'dos', 'tres', 'cuatro', 'cinco'];

test('la conclusión de la parte 3 no puede contradecir a CAC_CANALES', () => {
  // La MISMA fuente que usa la pantalla para `limitePlata` (Pricing.tsx): lo
  // máximo que se puede pagar por un cliente Pro bajo la regla que gobierna.
  const limitePlata = UNIT.find((u) => u.plan === 'pro')!.gobierna;
  const entran = CAC_CANALES.filter((c) => c.plataPorCliente <= limitePlata).length;
  const parte3 = INDICE.find((q) => q.n === '3')!;

  const frase = `${EN_LETRAS[entran]} de los ${EN_LETRAS[CAC_CANALES.length]} canales`;
  assert.ok(parte3.conclusion.includes(frase),
    `entran ${entran} de ${CAC_CANALES.length} canales por plata y la conclusión no dice «${frase}»: «${parte3.conclusion}»`);

  // Y el número contra el que se los mide, en el formato de la pantalla.
  const limiteEscrito = limitePlata.toFixed(2).replace('.', ',');
  assert.ok(parte3.conclusion.includes(limiteEscrito),
    `la conclusión mide los canales contra otro número: hoy el límite es ${limiteEscrito}`);
});

// =============================================================================
// La palabra «techo» no llega a la pantalla
// =============================================================================
// Es jerga: para el que lee, lo que significa es «lo máximo que podés pagar por
// un cliente». Una vez sacada vuelve sola, en cuanto alguien copia un párrafo de
// otra sección — por eso la guarda.
//
// ⚠️ LA GUARDA MIRA LO QUE SE PINTA, NO EL FUENTE. Grepear /techo/i sobre
// Pricing.tsx sin comentarios engancha IDENTIFICADORES de otro módulo: `techoIa`
// (una función de modelo.ts) y `a.techo` (un campo de AUTOMATICOS). Esos son
// nombres de código, no palabras en pantalla, y renombrarlos es otro alcance.
// Por eso se aíslan las dos únicas cosas que un lector ve: lo que va entre
// comillas y el texto suelto de JSX — en los dos casos SIN las llaves, porque
// adentro de `{}` hay expresiones: `{usd(techoIa(PRO))}` es una llamada, no texto.
// =============================================================================

import { readFileSync } from 'node:fs';
import * as modelo from '../app/admin/dev/pricing/modelo';

const SRC_PRICING = readFileSync(new URL('../app/admin/dev/pricing/Pricing.tsx', import.meta.url), 'utf8');

/** Lo que un lector VE de un archivo .tsx. Todo lo demás es código. */
function textoEnPantalla(src: string): string[] {
  const sinCodigoMudo = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')                 // /* … */ y también {/* … */}
    .replace(/^[ \t]*\/\/.*$/gm, ' ')                  // // …
    .replace(/^import[\s\S]*?from '[^']+';/gm, ' ');   // nombres traídos de otro módulo
  const literales = (sinCodigoMudo.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? [])
    .map((s) => s.replace(/\$\{[^{}]*\}/g, ' '));
  const textoJsx = (sinCodigoMudo.match(/>[^<>]*</g) ?? [])
    .map((s) => s.slice(1, -1).replace(/\{[^{}]*\}/g, ' '));
  return [...literales, ...textoJsx].map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

test('la pantalla no dice «techo»', () => {
  const conJerga = textoEnPantalla(SRC_PRICING).filter((t) => /techo/i.test(t));
  assert.deepEqual(conJerga, [], `quedó «techo» en el texto de la pantalla: ${conJerga.join(' | ')}`);
});

// La otra mitad del texto de esta pantalla NO vive en Pricing.tsx: son strings de
// modelo.ts que el .tsx pinta con `{X.que}`, y la guarda de arriba no los ve. Esta
// recorre los valores de los MISMOS exports que Pricing.tsx importa —la lista sale
// del import, así que no se queda vieja— y baja hasta cada string.

/** Lo que se importa pero NO se pinta. Un `id` es una clave de React; el resto son
 *  campos de respaldo que hoy ningún componente lee. Si alguno empieza a pintarse,
 *  sale de esta lista y se le saca la palabra. */
const NO_SE_PINTAN = new Set([
  'ECONOMIA[].id', 'CUARTO_PLAN[].id',
  'HIGH_TICKET.economia.enEstePlan',
  'TOPE_PAUTA.bajo3a1.nota', 'TOPE_PAUTA.bajoPayback.nota',
  'ASCENSO_NETO.nota', 'PROYECCION[].resumen',
]);

function stringsDe(v: unknown, camino: string, out: Array<[string, string]>): void {
  if (typeof v === 'string') { out.push([camino, v]); return; }
  if (v === null || typeof v !== 'object') return;
  if (Array.isArray(v)) { for (const x of v) stringsDe(x, `${camino}[]`, out); return; }
  for (const [k, x] of Object.entries(v)) stringsDe(x, `${camino}.${k}`, out);
}

test('los textos que la pantalla trae de modelo.ts tampoco dicen «techo»', () => {
  const importados = SRC_PRICING.match(/import \{([\s\S]*?)\} from '\.\/modelo';/)![1]
    .split(/[,\n]/).map((s) => s.trim().replace(/^type\s+/, ''))
    .filter((s) => /^[A-Za-z_$][\w$]*$/.test(s));
  assert.ok(importados.length > 20, 'no se pudo leer qué importa Pricing.tsx de modelo.ts');

  const todos: Array<[string, string]> = [];
  for (const n of importados) {
    const v = (modelo as Record<string, unknown>)[n];
    if (v !== undefined) stringsDe(v, n, todos);
  }
  const conJerga = todos.filter(([c, s]) => /techo/i.test(s) && !NO_SE_PINTAN.has(c)).map(([c]) => c);
  assert.deepEqual(conJerga, [], `modelo.ts le pasa «techo» a la pantalla en: ${conJerga.join(', ')}`);
});

// =============================================================================
// La conclusión general, que se escribe ÚLTIMA
// =============================================================================
// Va arriba de todo y sale de las conclusiones de las cinco partes. Las dos
// formas de arruinarla son las dos que se testean acá:
//
//  · Que diga un número que su parte no dice. Es la falla de siempre —dos
//    versiones del mismo dato en la misma pantalla— pero en el peor lugar,
//    porque este bloque es lo primero que se lee.
//  · Que COPIE la conclusión de su parte en vez de resumirla. Pasó adentro de
//    la parte 3, donde el `frase` del Titular repetía la conclusión palabra por
//    palabra sesenta píxeles más abajo. Acá la distancia es un scroll, así que
//    el mismo error se lee como un bug de armado.
// =============================================================================

import { CONCLUSION_GENERAL } from '../app/admin/dev/pricing/modelo';

/** Todo lo que un punto pone en pantalla. El titular también dice números. */
const textoDe = (p: (typeof CONCLUSION_GENERAL)[number]) => `${p.titular} ${p.que}`;

test('cada punto de la conclusión general apunta a una parte que existe', () => {
  for (const p of CONCLUSION_GENERAL) {
    assert.ok(INDICE.some((q) => q.n === p.parte),
      `«${p.titular}» apunta a la parte ${p.parte}, que no existe`);
  }
});

test('la conclusión general no dice ningún número que su parte no diga', () => {
  for (const p of CONCLUSION_GENERAL) {
    // Arranca en dígito para no capturar puntuación suelta, y se le sacan el
    // punto o la coma finales: «62.» es el mismo número que «62,» — lo que
    // cambia ahí es dónde termina la oración, no el dato.
    const numeros = (textoDe(p).match(/\d[\d.,]*/g) ?? [])
      .map((n) => n.replace(/[.,]+$/, ''))
      .filter((n) => n.length > 2);
    const parte = INDICE.find((q) => q.n === p.parte)!;
    for (const n of numeros) {
      assert.ok(parte.conclusion.includes(n),
        `el número ${n} está en la conclusión general («${p.titular}») y no en la parte ${p.parte}`);
    }
  }
});

/** El tramo textual más largo que comparten dos frases. */
function tramoCompartido(a: string, b: string): string {
  let mejor = '';
  for (let i = 0; i < a.length; i++) {
    for (let j = i + mejor.length + 1; j <= a.length; j++) {
      if (!b.includes(a.slice(i, j))) break;
      mejor = a.slice(i, j);
    }
  }
  return mejor;
}

test('la conclusión general resume su parte, no la copia', () => {
  const TOPE = 40; // caracteres. Una frase compartida; no un párrafo compartido.
  for (const p of CONCLUSION_GENERAL) {
    const parte = INDICE.find((q) => q.n === p.parte)!;
    const tramo = tramoCompartido(textoDe(p), parte.conclusion);
    assert.ok(tramo.length < TOPE,
      `«${p.titular}» copia ${tramo.length} caracteres de la parte ${p.parte}: «${tramo}»`);
  }
});
