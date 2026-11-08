// =============================================================================
// Un guion corto NO le gana a un 503 ni a un error duro (8/11/2026)
// =============================================================================
// Hallazgo de la revisión de `punta/nada-por-detras`: «El `corto` gana al "high demand" y al error
// duro: un tramo corto + un 503 se guarda como FINAL y no se reintenta nunca».
//
// Camino concreto: en un tramo de 10 minutos el primer modelo devuelve dos frases (debajo del
// piso) y el segundo contesta 503 «high demand». `if (mejorCorto) return` estaba ANTES del
// `saturado`, así que volvía el guion de dos frases marcado `corto`; `transcribirYoutube` lo
// escribe `listo` con `fallos: 0` y **ese tramo no se vuelve a pedir jamás**. Sin el corto
// adelante, el mismo 503 devuelve `saturado` y el guion queda pendiente — que es lo correcto,
// porque el modelo que podía traerlo entero no llegó a contestar.
//
// Correr: node --import tsx --test tests/guion-corto-no-gana-al-503.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): devolver el corto antes del saturado
// → 2 / 1; no contar los errores duros en `noContestaron` → 2 / 1; sacar el corto de último (que
// deja sin guion a un video de poca voz cuando además hubo un error) → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ⚠️ `lib/ai-cheap.ts` lleva `server-only`: desde un test de node se LEE, no se importa.
const src = readFileSync(join(process.cwd(), 'lib/ai-cheap.ts'), 'utf8');

test('un corto sólo vale si TODOS los intentos contestaron', () => {
  assert.match(src, /const contestaronTodos = saturados === 0 && noContestaron === 0;/,
    'hace falta saber si alguien no contestó, no sólo si hubo texto corto');
  assert.match(src, /if \(mejorCorto && contestaronTodos\) return \{ ok: true,[^\n]*corto: true \};/,
    'el corto se devuelve con la condición puesta');
});

test('y el saturado va ANTES del corto de último: así el tramo se reintenta', () => {
  const iCond = src.indexOf('if (mejorCorto && contestaronTodos) return');
  const iSat = src.indexOf("if (saturados > 0) return { ok: false, motivo: 'saturado'");
  const iCorto = src.lastIndexOf('if (mejorCorto) return { ok: true,');
  assert.ok(iCond > 0 && iSat > iCond, 'el saturado va después del corto condicionado');
  assert.ok(iCorto > iSat, 'y el corto incondicional, al final: si no, nunca se reintenta');
});

test('⚠️ lo que NO contestó se cuenta: error duro, corte de red y guion cortado', () => {
  // Si alguno deja de contarse, vuelve el bug por ese camino.
  const n = (src.match(/noContestaron \+= 1;/g) ?? []).length;
  assert.ok(n >= 3, `tienen que contarse los tres caminos que no son respuesta, hay ${n}`);
  // ⚠️ `finishReason=` aparece en DOS funciones de este archivo: hay que anclar en la del guion,
  // no en la primera que aparezca. Mi primera versión de este test cayó en la otra y dio rojo.
  const iFin = src.indexOf('el guion se cortó (finishReason=');
  assert.ok(iFin > 0, 'desapareció el corte por finishReason del guion');
  assert.match(src.slice(iFin, iFin + 120), /noContestaron \+= 1;/,
    'un guion con finishReason != STOP no es una respuesta: es un corte');
});
