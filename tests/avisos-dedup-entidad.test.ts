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

test('⚠️ el aviso se RECLAMA antes de mandarlo: leer-hacer-marcar perdía la carrera', () => {
  // EL CAPÍTULO DOS DE ESTE MISMO BUG, medido el 27/09/2026 — un mes después del fix de
  // arriba, que era correcto y no alcanzaba.
  //
  // Con las dedupKey ya bien puestas, el aviso de «Nuevo agendado» seguía saliendo dos
  // veces. La causa es la VENTANA: `emitirAviso` leía el dedup, mandaba, y recién después
  // marcaba — y el envío no es instantáneo. `lib/mako-grupo.ts` le manda a Evolution un
  // delay de tipeo anti-ban de `min(1500 + largo*45, 9000)` con jitter, y Evolution
  // retiene el HTTP abierto mientras lo simula: para un mensaje de 169-173 caracteres son
  // **7,2 a 10,8 segundos** con el dedup sin marcar.
  //
  // Medido en `mako_doer_conv`: el cliente que reserva por Cal.com tuvo 51 avisos con 21
  // pares duplicados (huecos de 0,4 a 12,4 s, quince de los veintiuno justo encima del
  // bloqueo); el que reserva por Calendly, 5 avisos y CERO — porque Calendly reentrega a
  // los 22-41 s, después de la marca. El mismo código, dos resultados opuestos según la
  // cadencia de reintrega del proveedor.
  //
  // ⚠️ Y POR QUÉ NO SE ARREGLA ENSANCHANDO EL TTL NI ACORTANDO EL DELAY: con el dedup
  // puesto sólo se ven los reintentos MÁS RÁPIDOS que la ventana — los lentos ya no dejan
  // fila. O sea que el techo de 12,4 s es el techo de la VENTANA, no el del proveedor, y
  // cualquier número que se elija está medido sobre una muestra censurada por el propio
  // arreglo que se quiere calibrar. Lo único que cierra esto es que la reclamación sea
  // ATÓMICA.
  //
  // Probado rompiéndolo (con el arreglo puesto, 4 pasan y 0 fallan):
  //   · vuelve `marcarAvisado` después del envío     -> 3 / 1
  //   · el reclamo usa `setSetting` en vez del CAS   -> 3 / 1
  //   · el reclamo se mueve ANTES del interruptor    -> 3 / 1
  //
  // Re-medido el 29/09/2026, con el reclamo ya mudado a lib/espaciado.ts: volver el CAS
  // a un `setSetting` da 3 / 1 en este archivo (y 14 / 2 corriéndolo junto con
  // tests/disparador-frecuencia.test.ts, que mira lo mismo desde el otro lado).
  // ⚠️ AHORA SON DOS ARCHIVOS, y esto es parte del arreglo: el reclamo se mudó a
  // `lib/espaciado.ts` porque lo necesitan los DOS despachadores (avisos y reportes).
  // Un test que sigue leyendo sólo el archivo viejo queda VERDE sobre el archivo
  // equivocado — el modo de falla que esta casa ya pagó al reemplazar una pieza y
  // dejarle los tests apuntando al fuente que murió.
  const limpiar = (t: string): string => t.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const src = limpiar(leer('../lib/avisos.ts'));
  const esp = limpiar(leer('../lib/espaciado.ts'));

  // 1) La reclamación existe y es ATÓMICA. Un `setSetting` a secas no sirve: dos requests
  //    que escriben lo mismo ganan los dos.
  assert.ok(/export async function reclamarEspaciado\(/.test(esp), 'falta reclamarEspaciado');
  const cuerpo = esp.slice(esp.indexOf('export async function reclamarEspaciado('));
  assert.ok(
    /cambiarSettingSi\(/.test(cuerpo),
    'reclamarEspaciado tiene que usar el compare-and-set atómico: un setSetting deja pasar a los dos',
  );

  // 2) Y NO queda el patrón viejo de marcar DESPUÉS de hacer. Ésa es la carrera.
  assert.ok(
    !/marcarAvisado\(/.test(src + esp),
    'volvió el leer-hacer-marcar: entre la lectura y la marca hay hasta 11 s de envío',
  );

  // 3) El ORDEN, que es la otra mitad del arreglo. El reclamo va DESPUÉS del interruptor
  //    —un aviso apagado nunca se dijo, y marcarlo lo deja mudo hasta que venza el TTL— y
  //    ANTES de los dos caminos que sí lo dicen (la cola y el envío), para que un solo
  //    reclamo cubra a los dos.
  // El interruptor pasó a ser `estadoAviso`, que contesta las DOS preguntas de una
  // lectura: si el aviso está activo y por qué canales sale. El orden no cambió.
  const iInterruptor = src.indexOf('estadoAviso(ws, a.tipo)');
  const iReclamo = src.indexOf('reclamarEspaciado(ws, a.tipo');
  const iCola = src.indexOf('encolarAviso(wsCola');
  const iEnvio = src.indexOf('enviarAlGrupoSuperAdmin(texto)');
  assert.ok(iInterruptor > 0 && iReclamo > 0 && iCola > 0 && iEnvio > 0, 'no se ubicaron las cuatro marcas');
  assert.ok(iInterruptor < iReclamo, 'el reclamo va DESPUÉS del interruptor, o apagar y prender deja el aviso mudo');
  assert.ok(iReclamo < iCola, 'el reclamo va antes de encolar');
  assert.ok(iReclamo < iEnvio, 'el reclamo va antes de enviar: reclamar después ES la carrera');

  // 4) Y sigue el corte barato de la entrada: no se hace el trabajo para nada.
  assert.ok(/salioReciente\(ws, a\.tipo/.test(src), 'se perdió el corte temprano');
});

test('El dedup distingue TIPO de ENTIDAD', () => {
  // La clave vive en lib/espaciado.ts desde el 29/09/2026, con el reclamo.
  const src = leer('../lib/espaciado.ts');
  assert.match(src, /export function keyEspaciado\(tipo: string, clave\?: string\)/,
    'la clave del dedup volvió a ser solo el tipo: o traga eventos de otros leads, o no dedupea nada');
  // Sin dedupKey se comporta como siempre — correcto para un aviso global
  // («tu cuenta de Meta está frenada» no es por-entidad).
  assert.match(src, /if \(!clave\) return `mako\.aviso\.last\.\$\{tipo\}`;/,
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
    // Los del AVISO llevan su ttl al lado; los de dispararEvento (la misma clave, para que una
    // reentrega no repita los pasos de un flujo) no cuentan como emisores de este aviso.
    const conDedup = (src.match(/dedupTtlMin: \d+, dedupKey: `(calcom|calendly):/g) ?? []).length;
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
