// =============================================================================
// El mismo agendado saliendo 2 y 3 veces
// =============================================================================
// El dueño (25/8/2026): «repite los mensajes… el de nueva reunión lo manda varias
// veces con algunos leads, con otros lo manda 1 sola vez».
//
// Medido sobre 10 días de conversación: los duplicados son SIEMPRE «Nuevo
// agendado» —nunca los recordatorios ni los «Terminó la R1»— y siempre dentro del
// mismo minuto: 9 s, 25 s, 38 s y 41 s de diferencia. Eso es un webhook
// reentregado, en los DOS proveedores (Calendly en ws1, Cal.com en ws13).
//
// La causa de fondo: `keyLast(tipo)` deduplicaba SOLO por tipo, así que poner
// `dedupTtlMin` en un aviso por-entidad se tragaba el evento de otro lead. Por eso
// los avisos de reunión se cablearon SIN dedup, con el comentario puesto — y sin
// dedup, un webhook reentregado sale dos veces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('El dedup distingue TIPO de ENTIDAD', () => {
  const src = leer('../lib/avisos.ts');
  assert.match(src, /const keyLast = \(tipo: string, dedupKey\?: string\)/,
    'la clave del dedup volvió a ser solo el tipo: o traga eventos de otros leads, o no dedupea nada');
  // Sin dedupKey se comporta como siempre — correcto para un aviso global
  // («tu cuenta de Meta está frenada» no es por-entidad).
  assert.match(src, /if \(!dedupKey\) return `mako\.aviso\.last\.\$\{tipo\}`;/,
    'se perdió el comportamiento de siempre para los avisos globales');
  // El id ajeno se hashea: un URI de Calendly son ~80 chars.
  assert.match(src, /createHash\('sha1'\)/, 'el id de la entidad entra crudo en la clave de app_settings');
});

test('Los CUATRO emisores de «nuevo agendado» dedupean por reserva', () => {
  // Son cuatro (2 en Cal.com, 2 en Calendly). Arreglar tres deja el cuarto
  // duplicando, que es el patrón que AGENTS.md ya tiene escrito.
  for (const ruta of ['../app/api/webhooks/calcom/route.ts', '../app/api/webhooks/calendly/route.ts']) {
    const src = leer(ruta);
    const emisores = (src.match(/emitirDelCatalogo\('reunion-nuevo-agendado'/g) ?? []).length;
    const conDedup = (src.match(/dedupKey: `(calcom|calendly):/g) ?? []).length;
    assert.equal(conDedup, emisores, `${ruta}: ${emisores} emisores y ${conDedup} con dedup`);
  }
});

test('La clave lleva el HORARIO: un reagendado sí avisa', () => {
  // Si la clave fuera solo el id de la reserva, mover la reunión quedaría tapado
  // por el dedup — y eso es justo lo que hay que avisar. Con el horario adentro,
  // un reintento trae los dos iguales y un reagendado cambia uno.
  for (const ruta of ['../app/api/webhooks/calcom/route.ts', '../app/api/webhooks/calendly/route.ts']) {
    const src = leer(ruta);
    for (const m of src.matchAll(/dedupKey: `[^`]+`/g)) {
      assert.match(m[0], /\|\$\{(reserva\.inicio|startTimeIso)\}/,
        `${ruta}: una clave de dedup sin el horario — un reagendado quedaría tapado: ${m[0]}`);
    }
  }
});
