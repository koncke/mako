// =============================================================================
// El ORDEN de las tres escrituras del choke point de la entrega
// =============================================================================
// `moverClienteDeEtapa` (lib/cs-mover-etapa.ts) toca Supabase, así que lo que se
// puede fijar sin una base es la SECUENCIA — y es justo lo que se rompe solo cuando
// alguien agrega un paso en el medio:
//
//  1. la salida temprana por idempotencia va ANTES del upsert. Sin eso, un segundo
//     click (o un reintento, o dos pestañas) pisa `etapa_desde` y convierte un
//     cliente trabado hace tres semanas en uno que acaba de llegar — con una línea
//     de historial de un movimiento que no ocurrió;
//  2. la COLUMNA se fija antes que la LÍNEA del historial, igual que en
//     lib/etapa-historial.ts: si algo falla en el medio, el peor caso es perder una
//     línea, nunca mover al cliente dos veces;
//  3. el enrolamiento de secuencias no puede entrar con el evento de etapa de VENTA
//     (`'etapa'`), porque `secuenciasDeEtapa` matchea la etapa por igualdad de string
//     y las dos listas de etapas las edita el cliente.
//
// ⚠️ EL GUARD LEE EL BLOQUE DE LA FUNCIÓN, NO EL ARCHIVO. Sobre el archivo entero
// estas afirmaciones se cumplirían con el `upsert` de otra función o con el texto de
// un comentario de la cabecera — que es exactamente lo que la cabecera dice. Se
// afirma además el LARGO del recorte: si mañana mide el doble, está mirando otra cosa.
//
// PROBADO ROMPIÉNDOLO (05/10/2026), con el bug real y no un typo:
//   · moviendo `if (desde === hacia) return base;` a DESPUÉS del upsert → 1 fail
//     («la idempotencia corta antes de escribir»).
//   · poniendo el insert de `lead_audit` ANTES del upsert de `cliente_entrega`
//     → 1 fail («la columna se fija antes que la línea»).
//   · agregando `await enrolarPorEvento(pedido.leadId, 'etapa', { etapa: hacia });`
//     → 1 fail («el enrolamiento no entra con el evento de venta»).
//   Restaurado: 5 pass / 0 fail.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../lib/cs-mover-etapa.ts', import.meta.url), 'utf8');

// El bloque es su CIERRE REAL: desde la firma hasta el comentario de la función
// siguiente. Nunca un `slice(i, i + N)` elegido a ojo — ese universo se come la
// función de al lado y el guard pasa en verde con el bug puesto.
const INI = SRC.indexOf('export async function moverClienteDeEtapa');
const FIN = SRC.indexOf('\n/**\n * Saca a un cliente de la entrega', INI);
const CUERPO = SRC.slice(INI, FIN);

test('el recorte es la función y no media biblioteca', () => {
  assert.ok(INI > 0, 'no encontré moverClienteDeEtapa');
  assert.ok(FIN > INI, 'no encontré dónde termina: ¿se renombró sacarClienteDeEntrega?');
  // El techo subió de 6000 a 8000 el 05/10 porque la función creció a propósito: el
  // enrolamiento de las secuencias de entrega se enganchó acá, con su porqué. Lo que
  // el número cuida sigue siendo lo mismo —que el recorte no se coma la función de al
  // lado— y por eso sigue habiendo un techo y no `> 0`.
  assert.ok(CUERPO.length > 1500 && CUERPO.length < 8000, `el recorte mide ${CUERPO.length}: está mirando otra cosa`);
  assert.ok(!CUERPO.includes('sacarClienteDeEntrega'), 'el recorte se comió la función siguiente');
});

const posIdempotencia = CUERPO.indexOf('if (desde === hacia)');
const posUpsert = CUERPO.indexOf("from('cliente_entrega').upsert");
const posAudit = CUERPO.indexOf("from('lead_audit').insert");

test('la idempotencia corta antes de escribir', () => {
  assert.ok(posIdempotencia > 0, 'desapareció la salida temprana por «ya estaba en esa etapa»');
  assert.ok(posUpsert > 0, 'desapareció el upsert de cliente_entrega');
  assert.ok(
    posIdempotencia < posUpsert,
    'la salida por idempotencia quedó DESPUÉS del upsert: un movimiento que no mueve nada pisa etapa_desde',
  );
});

test('la columna se fija antes que la línea del historial', () => {
  assert.ok(posAudit > 0, 'desapareció la línea de lead_audit: un movimiento sin rastro');
  assert.ok(
    posUpsert < posAudit,
    'el historial se escribe antes que la columna: si falla el upsert queda una línea de un movimiento que no ocurrió',
  );
});

test('el historial no puede romper un movimiento ya guardado', () => {
  // El error del insert se LOGUEA y la función sigue. Si se hiciera `return fallo(...)`
  // ahí, la pantalla diría «no se pudo mover» sobre un cliente que YA se movió, y la
  // persona lo volvería a arrastrar.
  // `[\s\S]` y no el flag `/s`: dotAll es ES2018 y el tsconfig de la casa apunta a
  // ES2017, así que el flag no compila y el typecheck del pre-push bloquea el push de
  // TODAS las sesiones (lo arregló la sesión del Chatbot el 05/10; misma intención).
  assert.ok(/errAudit\)[\s\S]*console\.error/.test(CUERPO), 'el fallo del historial tiene que quedar logueado');
  assert.ok(!/if \(errAudit\) return fallo/.test(CUERPO), 'un historial que falla no puede deshacer el movimiento');
});

test('el enrolamiento no entra con el evento de etapa de VENTA', () => {
  // En positivo sobre lo que importa: si algún día se llama a enrolarPorEvento desde
  // acá, no puede ser con `'etapa'`. La clave de una etapa de entrega y la de una de
  // venta son dos strings que el cliente edita por separado, y `secuenciasDeEtapa`
  // las compara con `===`: un choque dispara una secuencia de venta desde el kanban.
  const llamadas = CUERPO.match(/enrolarPorEvento\([^)]*\)/g) ?? [];
  for (const c of llamadas) {
    assert.ok(!/['"]etapa['"]/.test(c), `${c} usa el evento de venta: hace falta uno propio de entrega`);
  }
});
