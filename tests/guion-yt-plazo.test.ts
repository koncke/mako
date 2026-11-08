// =============================================================================
// El guion de YouTube no se come el plazo de su propia ruta (8/11/2026)
// =============================================================================
// Lo encontró la revisión de `punta/nada-por-detras`: «El Spy se come el plazo de su propia ruta:
// el cliente queda con "Transcribiendo" 15 minutos y el reintento vuelve a gastar».
//
// La cuenta que lo prueba: un video de 20-40 min con poca voz da 2-3 tramos. Un tramo que no llega
// al piso recorría `modelosSttGemini()` (2) × `provsDe('gemini')` (las cuentas del negocio), con
// `AbortSignal.timeout(170_000)` por pedido. Con UNA cuenta son 3 × 2 × 170 = 1020 s; con dos,
// 2040. La ruta tiene `maxDuration = 800`. La función se moría a mitad, nadie escribía el final y
// el guion quedaba en `transcribiendo` los 15 min de `TRANSCRIBIENDO_YT_VENCE_MS`; al vencer, el
// siguiente que abría el detalle lo reclamaba otra vez, gastaba OTRA de las 20 del día y volvía a
// quemar el plazo. El guion no aparecía nunca.
//
// Correr: node --import tsx --test tests/guion-yt-plazo.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 4 / 0): sacar el corte por plazo → 3 / 1;
// sacar el `break` que impide saltar de cuenta por «corto» → 3 / 1; subir el presupuesto a 400 s
// (3 × 400 > 800) → 3 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const src = leer('lib/ai-cheap.ts');
const ruta = leer('app/api/competitor-spy/transcribir/route.ts');

test('⚠️ el presupuesto por tramo entra en el maxDuration de la ruta, con los tramos que pide', () => {
  const pres = Number(src.match(/export const PRESUPUESTO_GUION_YT_MS = ([\d_]+);/)?.[1].replace(/_/g, ''));
  const max = Number(ruta.match(/export const maxDuration = (\d+);/)?.[1]);
  assert.ok(Number.isFinite(pres) && Number.isFinite(max), 'faltan el presupuesto o el maxDuration');
  const TRAMOS = 3; // lo que la propia ruta dice que pide, en su comentario
  assert.ok((pres / 1000) * TRAMOS <= max,
    `${TRAMOS} tramos a ${pres / 1000} s dan ${(pres / 1000) * TRAMOS} s y la ruta sólo tiene ${max}: la función se muere a mitad`);
});

test('antes de cada pedido se mira si queda plazo', () => {
  assert.match(src, /if \(Date\.now\(\) \+ PLAZO_PEDIDO_YT_MS > finDelPlazo\)/,
    'sin esta guarda, el bucle arranca un pedido de 170 s que la ruta ya no puede esperar');
});

test('«vino corto» NO salta a otra cuenta: eso duplica el gasto del negocio', () => {
  const i = src.indexOf('el guion vino corto');
  assert.ok(i > 0, 'no encontré la rama de «vino corto»');
  const bloque = src.slice(i, i + 1400);
  assert.match(bloque, /cortoEnEstaCuenta = true;/, '«corto» tiene que marcar la cuenta');
  assert.match(bloque, /if \(cortoEnEstaCuenta\) break;/,
    'y cortar el bucle de cuentas: la cuenta siguiente es la misma pregunta al mismo modelo con otra clave');
});

test('⚠️ pero el salto de cuenta SIGUE para lo que sí lo necesita: saturación y errores duros', () => {
  // Si alguien "simplifica" sacando esos caminos, un modelo saturado deja al negocio sin guion
  // teniendo otra cuenta sana a mano. Son baratos: fallan rápido, no gastan los 170 s.
  assert.match(src, /if \(dijoSaturado\(detalle\)\) \{ anotarSaturado\('gemini', model\); saturados \+= 1; continue; \}/,
    'saturado sigue probando el modelo siguiente');
  const iErr = src.indexOf('no cambia con otro modelo: otra cuenta');
  assert.ok(iErr > 0, 'desapareció el camino del error duro');
  assert.match(src.slice(iErr, iErr + 140), /break;/,
    'un error duro sigue saltando a la cuenta siguiente');
  // ⚠️ Y la guarda del plazo también tiene que cortar el bucle de CUENTAS, no sólo el de modelos:
  // si no, al quedarse sin plazo saltaría a la cuenta siguiente y volvería a intentar, que es
  // exactamente lo que se viene a evitar.
  const iPlazo = src.indexOf('se acabó el plazo del tramo');
  assert.ok(iPlazo > 0, 'desapareció la guarda del plazo');
  assert.match(src.slice(iPlazo, iPlazo + 160), /cortoEnEstaCuenta = true;/,
    'quedarse sin plazo tiene que cortar también el bucle de cuentas');
});
