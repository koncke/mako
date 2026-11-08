// =============================================================================
// Un video MUDO se contesta una vez, no se paga N veces (8/11/2026)
// =============================================================================
// Lo encontró la revisión de `punta/nada-por-detras`, que entró a main sin que nadie la mirara.
// Dos hallazgos confirmados que eran el MISMO origen:
//   · «El costo se multiplica por modelos × cuentas y el tope del día ya no lo frena: el negocio
//      paga su propio Gemini» (rompe-cliente, 0 de 3 refutadores lo tumbó)
//   · «"No tiene voz: es sólo música o imagen." quedó inalcanzable para YouTube: el piso es siempre
//      > 0, así que todo video mudo vuelve marcado `corto` y pagando cada modelo y cada cuenta»
//
// La instrucción le pide a Gemini la palabra exacta «(vacío)» cuando el video no tiene voz. El
// código la traducía a '' y la metía en la comparación con el piso: como `pisoDeGuionYt` da > 0
// para cualquier duración conocida, `0 >= piso` era siempre falso y el bucle seguía con el modelo
// siguiente y después con la cuenta siguiente, pagando todas, para devolver lo mismo con `corto`.
//
// Correr: node --import tsx --test tests/guion-yt-vacio-corta.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 4 / 0): sacar el corte de «(vacío)» → 3 / 1;
// ponerlo DESPUÉS de la comparación con el piso → 3 / 1; devolverlo con `corto: true` → 3 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// ⚠️ `lib/ai-cheap.ts` lleva `server-only`: importarlo desde un test de node tira
// «This module cannot be imported from a Client Component module». Por eso acá se LEE el fuente,
// que es el patrón del repo para este archivo.

const src = readFileSync(join(process.cwd(), 'lib/ai-cheap.ts'), 'utf8');
const fn = (() => {
  const i = src.indexOf('export async function guionDeYoutubeConGemini(');
  assert.ok(i > 0, 'no existe guionDeYoutubeConGemini');
  const j = src.indexOf('\n}', src.indexOf('return { ok: false, motivo: \'fallo\'', i));
  return src.slice(i, j);
})();

test('⚠️ la razón del bug: el piso es > 0 para cualquier duración conocida', () => {
  // Por eso un texto vacío NUNCA lo alcanzaba, y por eso el bucle no paraba.
  assert.match(src, /export const PISO_GUION_YT_CPM = (\d+);/, 'existe el piso por minuto');
  const cpm = Number(src.match(/export const PISO_GUION_YT_CPM = (\d+);/)![1]);
  assert.ok(cpm > 0, 'el piso por minuto es mayor que cero, que es lo que hace inalcanzable el vacío');
  // Sin duración no hay piso: ése es el único caso donde '' pasaba, y es el que escondía el bug.
  assert.match(src, /if \(segundos == null \|\| !Number\.isFinite\(segundos\) \|\| segundos <= 0\) return 0;/,
    'sin duración el piso es 0: ahí el vacío pasaba, y por eso el bug no se veía siempre');
});

test('«(vacío)» corta y devuelve, sin probar el modelo siguiente ni la cuenta siguiente', () => {
  assert.match(fn, /if \(texto === '\(vacío\)'\) return \{ ok: true, texto: '',/,
    'un video mudo tiene que devolver en el acto: si no, se paga cada modelo y cada cuenta');
});

test('y corta ANTES de compararse con el piso', () => {
  const iVacio = fn.indexOf("if (texto === '(vacío)') return");
  const iPiso = fn.indexOf('if (limpio.length >= piso) return');
  assert.ok(iVacio > 0 && iPiso > 0, 'faltan las dos comprobaciones');
  assert.ok(iVacio < iPiso,
    'el corte de «(vacío)» va antes del piso: después, el piso ya lo descartó y el bucle sigue');
});

test('y NO vuelve marcado `corto`: no hay nada que transcribir, no es un guion incompleto', () => {
  const linea = fn.slice(fn.indexOf("if (texto === '(vacío)')"), fn.indexOf("if (texto === '(vacío)')") + 140);
  assert.ok(!/corto/.test(linea),
    'marcarlo `corto` le dice al cliente «puede faltar parte» sobre un video donde no se dice nada');
});
