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
//     y las dos listas de etapas las edita el cliente;
//  4. (06/10/2026) la columna se escribe con COMPARE-AND-SET sobre la etapa leída, y el
//     movimiento que pierde la carrera vuelve con `cambio: false` ANTES del historial y del
//     enrolamiento. Sin eso, dos envíos de la última tarea en el mismo segundo
//     (lib/curso-avance.ts) contestaban `cambio: true` los dos: dos líneas de historial y
//     dos WhatsApp de la etapa nueva, con el envío del ws1 prendido;
//  5. (06/10/2026) la etapa destino se valida contra el catálogo LEÍDO, nunca contra el
//     default que `entregaDeProducto` devuelve cuando la lectura falla: así nació la clienta
//     huérfana del ws1, en «onboarding» sobre un producto con nueve etapas declaradas.
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
//
// PROBADO ROMPIÉNDOLO OTRA VEZ (06/10/2026), con el CAS y el catálogo estricto puestos.
// Se corrieron juntos los cinco archivos que miran estas piezas (este, cs-acciones-puerta,
// cs-deshacer-reloj, curso-ficha y nutricion-etapa): baseline 61 pass / 0 fail. Cada rotura de
// a una, restaurada de memoria (nunca con git), y cada una cayó en el test que le toca:
//   · sin `.eq('etapa', previa.etapa)` en el update → 60/1 «…CONDICIONAL sobre la etapa…».
//   · el insert sin `ignoreDuplicates: true` → 60/1 «si ENTRA, el insert no pisa…».
//   · la salida por perder movida DESPUÉS del enrolamiento → 60/1 «el que PIERDE la carrera…».
//   · `entregaDeProducto` (la que cae al default) en vez de la estricta → 60/1 «…catálogo LEÍDO…».
//   · la estricta devolviendo el default ante el error → 60/1 «la lectura estricta…».
//   · `.update({ ...columna, etapa_desde: ahora })` → 60/1 «las dos escrituras llevan el MISMO reloj».
//   Restaurado: 61 pass / 0 fail.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../lib/cs-mover-etapa.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

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
  // enrolamiento de las secuencias de entrega se enganchó acá, con su porqué. Y de 8000
  // a 11000 el 06/10, por el compare-and-set y el catálogo estricto (medía 8889). Lo que
  // el número cuida sigue siendo lo mismo —que el recorte no se coma la función de al
  // lado— y por eso sigue habiendo un techo y no `> 0`.
  // El tope subió de 11000 a 11500 con la cuarta tanda (punto 14): el cierre silencioso pasa la etapa nueva y
  // dice por qué en dos renglones; medido 11066.
  assert.ok(CUERPO.length > 1500 && CUERPO.length < 11500, `el recorte mide ${CUERPO.length}: está mirando otra cosa`);
  assert.ok(!CUERPO.includes('sacarClienteDeEntrega'), 'el recorte se comió la función siguiente');
});

// Las posiciones se miden SIN comentarios: la cabecera de la función cita `lead_audit`,
// `enrolarPorEvento` y el upsert al explicarlos, y un orden medido sobre prosa da verde
// sobre el código al revés. Las líneas primero y los bloques después (AGENTS.md).
const CODIGO = CUERPO
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const posIdempotencia = CODIGO.indexOf('if (desde === hacia)');
// «La escritura de la columna» es la PRIMERA de las dos formas (update del CAS o el insert
// de quien entra): las dos van antes del historial.
const posUpsert = CODIGO.search(/from\('cliente_entrega'\)\.(update|upsert)\(/);
const posAudit = CODIGO.indexOf("from('lead_audit').insert");

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

// ── 4. El compare-and-set ─────────────────────────────────────────────────────

test('si ya tenía fila, la escritura es CONDICIONAL sobre la etapa que se leyó', () => {
  // `update … where id = <la leída> and etapa = <la leída>`: si otro movimiento escribió en el
  // medio, la condición no matchea y no se toca nada. Sin el `.eq('etapa', …)` es el upsert a
  // ciegas de antes con otra forma: los dos movimientos ganan.
  const ini = CODIGO.indexOf("from('cliente_entrega').update(");
  assert.ok(ini > 0, 'desapareció el update condicional de cliente_entrega');
  // Hasta la otra rama del ternario (`: await`), NO hasta el `;`: ése cierra también el
  // insert, y un `.select('id')` del insert haría pasar un update que no devuelve nada.
  const upd = CODIGO.slice(ini, CODIGO.indexOf(': await', ini));
  assert.ok(upd.length > 40 && upd.length < 300, `el recorte mide ${upd.length}: está mirando otra cosa`);
  assert.match(upd, /\.eq\('id', previa\.id\)/, 'el update tiene que apuntar a LA fila leída');
  assert.match(upd, /\.eq\('etapa', previa\.etapa\)/, 'sin la condición sobre la etapa leída no hay compare-and-set');
  assert.match(upd, /\.select\('id'\)/, 'sin devolver las filas tocadas no se sabe quién ganó');
});

test('si ENTRA, el insert no pisa: on conflict do nothing, y devuelve lo que insertó', () => {
  const ini = CODIGO.indexOf("from('cliente_entrega').upsert(");
  assert.ok(ini > 0, 'desapareció la escritura de quien entra a la entrega');
  const ins = CODIGO.slice(ini, CODIGO.indexOf(';', ini));
  assert.ok(ins.length < 400, `el recorte mide ${ins.length}: está mirando otra cosa`);
  assert.match(ins, /ignoreDuplicates: true/, 'un upsert que pisa convierte la carrera de dos altas en dos movimientos');
  assert.match(ins, /\.select\('id'\)/, 'sin devolver las filas insertadas no se sabe quién ganó');
  // Y no queda ningún OTRO upsert a ciegas sobre la tabla en la función.
  const upserts = CODIGO.match(/from\('cliente_entrega'\)\.upsert\(/g) ?? [];
  assert.equal(upserts.length, 1, 'apareció un segundo upsert de cliente_entrega: ¿lleva el CAS?');
});

test('el que PIERDE la carrera sale con cambio:false antes del historial y del enrolamiento', () => {
  // La salida por «no toqué ninguna fila». Va DESPUÉS de las escrituras (sin ellas no hay
  // filas que contar) y ANTES de la línea de lead_audit y de enrolarPorEvento: un movimiento
  // que no movió nada no deja rastro ni manda mensajes. Y no es un `fallo`: el cliente quedó
  // bien (lo movió el otro), sólo que no lo movió ESTE pedido.
  const m = CODIGO.match(/if \(!\(\(tocadas \?\? \[\]\) as unknown\[\]\)\.length\) return \{ \.\.\.base[^}]*\};/);
  assert.ok(m, 'desapareció la salida por «perdió la carrera»');
  if (!m || m.index == null) return;
  const posPerdio = m.index;
  const posEscrituras = Math.max(
    CODIGO.indexOf("from('cliente_entrega').update("),
    CODIGO.indexOf("from('cliente_entrega').upsert("),
  );
  const posEnrolar = CODIGO.indexOf('enrolarPorEvento(');
  assert.ok(posEscrituras > 0 && posPerdio > posEscrituras, 'la salida tiene que ir después de escribir: antes no hay filas tocadas que contar');
  assert.ok(posPerdio < posAudit, 'la salida quedó DESPUÉS del historial: el que pierde deja una línea de un movimiento que no hizo');
  assert.ok(posEnrolar > 0 && posPerdio < posEnrolar, 'la salida quedó DESPUÉS del enrolamiento: el que pierde manda el WhatsApp de la etapa nueva otra vez');
  assert.doesNotMatch(m[0], /cambio: true/, 'el que pierde no puede contestar cambio:true');
  assert.doesNotMatch(m[0], /fallo\(/, 'perder la carrera no es un fallo: el cliente quedó donde lo dejó el otro');
});

test('las dos escrituras llevan el MISMO reloj, el validado del deshacer o «ahora»', () => {
  // El CAS partió una escritura en dos; el reloj del deshacer (`relojDeVuelta`) tiene que
  // viajar en las dos o el deshacer de un cliente que ya tenía fila arranca el reloj hoy.
  assert.match(CODIGO, /const columna = \{[^}]*etapa_desde: relojDeVuelta\(pedido\.relojPrevio\) \?\? ahora[^}]*\};/);
  assert.match(CODIGO, /\.update\(columna\)/, 'el update no escribe la columna con su reloj');
  assert.match(CODIGO, /\.\.\.columna \}/, 'el insert no escribe la columna con su reloj');
});

// ── 5. El catálogo LEÍDO, nunca el default por una lectura caída ─────────────

test('la etapa destino se valida contra el catálogo LEÍDO; sin catálogo, no se mueve', () => {
  assert.match(CODIGO, /const entrega = await entregaDeProductoEstricta\(pedido\.productoId\);\s*if \(!entrega\) return fallo\(/,
    'sin catálogo leído el choke point tiene que contestar un fallo, no validar contra las etapas de fábrica');
  assert.doesNotMatch(CODIGO, /\bentregaDeProducto\(/, 'volvió la lectura que cae al default: valida «onboarding» sobre un producto con otras etapas');
  // El fallo va ANTES de validar: con el catálogo en null no hay contra qué validar.
  assert.ok(CODIGO.indexOf('if (!entrega) return fallo(') < CODIGO.indexOf('etapaValida('), 'el corte por catálogo sin leer tiene que ir antes de validar');
});

test('la lectura estricta devuelve null ante el error, y sin fila el default (que SÍ es legítimo)', () => {
  const SERV = readFileSync(new URL('../lib/entrega-servicio.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const ini = SERV.indexOf('export async function entregaDeProductoEstricta(');
  assert.ok(ini > 0, 'desapareció entregaDeProductoEstricta');
  const est = SERV.slice(ini, SERV.indexOf('\n}\n', ini));
  assert.ok(est.length < 500, `el recorte mide ${est.length}: está mirando otra cosa`);
  assert.match(est, /if \(!filas\) return null;/, 'un error de lectura tiene que volver como null, nunca como el default');
  assert.match(est, /: entregaPorDefecto\(productoId\)/, 'un producto SIN fila sí se dibuja con el default: validar contra eso es lo correcto');
  // Y `leerCatalogo` es lo que separa «no hay filas» de «no pude leerlas».
  const lc = SERV.slice(SERV.indexOf('async function leerCatalogo('), SERV.indexOf('export async function entregaDeProducto('));
  assert.match(lc, /if \(error\) \{[\s\S]{0,200}return null;/, 'leerCatalogo se come el error: vuelve [] y «no pude leer» parece «no configuró»');
});
