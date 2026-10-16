// =============================================================================
// Lo que toca un cliente NUEVO en su primera semana corre con la red de la plataforma
// =============================================================================
// Desde el 15/10/2026 un cliente nuevo no trae una API (decisión de Martín, Ticketera
// `clientes-usan-su-claude`): el wizard del primer ingreso ya no la pide
// (tests/onboarding-sin-api.test.ts). Lo que sigue es lo primero que toca después, y sin la
// red de la plataforma le contestaba «conecta tu IA». El orden lo fijó el coordinador sobre
// docs/mapa-ia-24h.md: Ads Writer, Offer, crear landing, crear automatización, Second Brain
// y el análisis del lead. Un test por herramienta, y se suma de a una.
//
// La capacidad se midió antes de extenderla (16/10/2026, docs/hallazgos-ia.md): la key de
// Gemini de la plataforma con más pedidos en un día hizo 29, contra 250 de tope; lo que
// muerde es el tope POR MINUTO.
//
// Correr: npx tsx --test tests/red-primera-semana.test.ts
//
// PROBADO ROMPIÉNDOLO, cada rotura restaurada DE MEMORIA (`redDePlataforma: true` → `false` en UNA llamada):
//   Ads Writer (16/10/2026, base 1/0): generarRazones, sugerirGuion, generarGuion y valorarGuion → 0/1 cada una.
//   Offer (16/10/2026, base 2/0): vuelve el corte «sin IA propia» antes de la red, la ruta lee documentos
//     sin red, y una de las dos lecturas por visión no pasa la red → 1/1 cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
// Líneas `//` primero y bloques después, y nada más (un paso que borre las líneas que empiezan
// con `*` se lleva los cierres de JSDoc: docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo de una función de nivel cero, hasta la próxima declaración de nivel cero. */
function cuerpo(archivo: string, nombre: string): string {
  const src = sinComentarios(leer(archivo));
  const ini = src.search(new RegExp(`\\nexport async function ${nombre}\\(`));
  assert.ok(ini >= 0, `${archivo}: no existe ${nombre}`);
  const resto = src.slice(ini + 1);
  const fin = resto.search(/\n(export |async function |function |const |type )/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

/** Cada llamada a la IA del cuerpo, con su objeto de opciones. */
function llamadas(b: string): string[] {
  const out: string[] = [];
  for (const m of b.matchAll(/\b(chatCheapCascade\(\{|chatClaude\(|leerDocumentoIA\(\{)/g)) {
    const fin = b.indexOf('});', m.index);
    out.push(b.slice(m.index, fin > 0 ? fin : m.index + 1500));
  }
  return out;
}

/** Afirma que la función llama a la IA al menos una vez, y siempre con la red. */
function conRed(archivo: string, nombre: string): void {
  const ls = llamadas(cuerpo(archivo, nombre));
  assert.ok(ls.length >= 1, `${archivo} → ${nombre}: no encuentro ninguna llamada a la IA (el test quedó mirando nada)`);
  ls.forEach((l, i) => assert.match(l, /redDePlataforma: true/,
    `${archivo} → ${nombre}, llamada ${i + 1}: sin redDePlataforma, un cliente nuevo sin API ve «conecta tu IA»`));
}

test('Offer: sin IA propia no corta antes de la red, y lee los documentos con red', () => {
  // Offer tiene su propia red (un bucle sobre provsGratisDePlataforma en `pedir`). Lo que la dejaba
  // sin probar era un corte ANTES: «sin ninguna IA conectada → "conecta una"».
  const src = sinComentarios(leer('lib/offer-ia.ts'));
  const ini = src.indexOf('async function pedir<T>(');
  assert.ok(ini > 0, 'no encuentro pedir en lib/offer-ia.ts');
  const b = src.slice(ini, src.indexOf('\n}\n', ini));
  const red = b.indexOf('provsGratisDePlataforma()');
  const primerFallo = b.indexOf('return { ok: false');
  assert.ok(red > 0, 'pedir ya no prueba la red de la plataforma');
  assert.ok(primerFallo > red, 'pedir devuelve un error ANTES de probar la red: un cliente sin API ve «conecta tu IA»');
  assert.doesNotMatch(b, /docsIADisponible\(/, 'volvió el corte por «no tiene IA propia» antes de la red');
  // Los documentos que se suben a Offer: la lectura por visión con la red.
  assert.match(sinComentarios(leer('app/api/offer/route.ts')), /archivoATexto\(file, \{ feature: 'offer'[^\n]*redDePlataforma: true \}\)/);
  const lector = sinComentarios(leer('lib/archivo-a-texto.ts'));
  assert.equal((lector.match(/leerDocumentoIA\(\{[^\n]*redDePlataforma: opts\.redDePlataforma/g) || []).length, 2,
    'las dos lecturas por visión (PDF escaneado e imagen) tienen que pasar la red que pide el que llama');
});

test('Ads Writer: motivaciones, sugerir y generar guiones, y valorarlos', () => {
  conRed('lib/razones.ts', 'generarRazones');
  conRed('lib/razones.ts', 'sugerirGuion');
  conRed('lib/razones.ts', 'generarGuion');
  conRed('lib/ads-analyst.ts', 'valorarGuion');
});
