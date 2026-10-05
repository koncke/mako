// =============================================================================
// Qué secuencias dispara un lead que CAE en una etapa (y el producto manda)
// =============================================================================
// Lo que decide a quién le llega un WhatsApp real cuando alguien mueve una tarjeta en
// el CRM. Son tres preguntas en una y las tres tienen que valer: ¿la secuencia se cuelga
// de una etapa?, ¿de ESA?, ¿y este lead es del producto que la secuencia declara?
//
// El caso que más importa es el VACÍO: un evento sin la etapa adentro no puede caer en
// «entonces todas». `enrolarPorEvento` enrola en TODAS las secuencias del trigger —es lo
// correcto para `lead_nuevo`— y acá sería mandarle a un lead que cayó en «Agenda» también
// el mensaje de «Facturando» y el del producto de al lado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secuenciasDeEtapa, secuenciasDeEntrega, TRIGGER_ETAPA, TRIGGER_ENTREGA } from '../lib/nutricion-etapa';
import { ambitoDeSecuencia, leadEnAmbito } from '../lib/nutricion-ambito';
import { readFileSync } from 'node:fs';

const TODOS = ambitoDeSecuencia(null, null);          // la secuencia no declara embudo
const NEGOCIO = ambitoDeSecuencia(7, true);           // el embudo del negocio (es_default)
const OTRO = ambitoDeSecuencia(13, false);            // el embudo de otro producto

// ── El ámbito, en memoria: el espejo de lo que el cron le pide a PostgREST ───
test('el embudo del negocio incluye al lead que nunca se movió (funnel_id NULL)', () => {
  // Es la mitad que se olvida: `filtroDeAmbito` pide `funnel_id.is.null,eq.N` para el
  // default, y las ~1000 filas de producción tienen NULL. Sin esto, declarar el producto
  // en una secuencia la apagaría para todos.
  assert.equal(leadEnAmbito(NEGOCIO, null), true);
  assert.equal(leadEnAmbito(NEGOCIO, 7), true);
  assert.equal(leadEnAmbito(NEGOCIO, 13), false);
});

test('el embudo de OTRO producto no se come al lead sin embudo', () => {
  assert.equal(leadEnAmbito(OTRO, null), false, 'un NULL no puede entrar al producto de al lado');
  assert.equal(leadEnAmbito(OTRO, 13), true);
  assert.equal(leadEnAmbito(OTRO, '13'), true, 'la columna es bigint: un driver la puede devolver como texto');
  assert.equal(leadEnAmbito(OTRO, 7), false);
});

test('sin ámbito declarado entran todos', () => {
  assert.equal(leadEnAmbito(TODOS, null), true);
  assert.equal(leadEnAmbito(TODOS, 99), true);
});

// ── Las secuencias que dispara la etapa ──────────────────────────────────────
const SECS = [
  { id: 1, trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda', ambito: TODOS },
  { id: 2, trigger_tipo: TRIGGER_ETAPA, etapa: 'facturando', ambito: TODOS },
  { id: 3, trigger_tipo: TRIGGER_ETAPA, etapa: 'agenda', ambito: OTRO },
  { id: 4, trigger_tipo: 'instant_form_sin_agenda', etapa: 'agenda', ambito: TODOS },
  { id: 5, trigger_tipo: TRIGGER_ETAPA, etapa: null, ambito: TODOS },
];
const ids = (r: { id: number }[]) => r.map((x) => x.id).sort((a, b) => a - b);

test('dispara SOLO la secuencia de esa etapa', () => {
  // El lead no declara embudo → entra a la de «todos» y no a la del otro producto.
  assert.deepEqual(ids(secuenciasDeEtapa(SECS, 'agenda', null)), [1]);
  assert.deepEqual(ids(secuenciasDeEtapa(SECS, 'facturando', null)), [2]);
});

test('el PRODUCTO acota, y una secuencia SIN producto le sigue aplicando a todos', () => {
  // Dos secuencias colgadas de «agenda»: la #1 sin embudo declarado y la #3 del 13.
  //
  // ⚠️ EL LEAD DEL PRODUCTO 13 RECIBE LAS DOS, y es a propósito: `funnel_id` NULL
  // significa «de todos los productos», que es como están las 62 filas de producción.
  // Si una secuencia sin embudo dejara de aplicarle al lead que SÍ tiene embudo, declarar
  // el producto en UNA secuencia apagaría en silencio todas las demás. Es la misma
  // semántica que el barrido del cron (`filtroDeAmbito` no filtra en modo 'todos'), y las
  // dos tienen que decir lo mismo o el disparo por evento y el del cron eligen leads
  // distintos. Lo que la pantalla tiene que hacer con esto es DECIRLO: el desplegable
  // ofrece «Todos los productos» como opción explícita, no como ausencia.
  assert.deepEqual(ids(secuenciasDeEtapa(SECS, 'agenda', 13)), [1, 3]);
  // Y la del producto 13 NO le llega al lead del embudo del negocio.
  assert.deepEqual(ids(secuenciasDeEtapa(SECS, 'agenda', 7)), [1]);
});

test('una etapa sin secuencia no enrola a nadie, y no es un error', () => {
  assert.deepEqual(secuenciasDeEtapa(SECS, 'contactado', null), []);
});

test('SIN ETAPA no enrola a NADIE: es la guarda que hace seguro este camino', () => {
  for (const vacio of [undefined, null, '', '   ']) {
    assert.deepEqual(secuenciasDeEtapa(SECS, vacio, null), [], `con ${JSON.stringify(vacio)} tiene que devolver []`);
  }
});

test('un trigger que no es de etapa no entra aunque tenga la etapa puesta', () => {
  // La #4 dice 'agenda' en su columna `etapa` y la dispara un formulario, no la etapa.
  assert.equal(secuenciasDeEtapa(SECS, 'agenda', null).some((s) => s.id === 4), false);
});

// Probado rompiéndolo (05/10/2026), tres veces, con los números medidos:
//   · sacando la guarda del vacío (`if (!key) return []`): **1 fallo de 8**, el de «SIN
//     ETAPA…» — y es el caro: un evento sin etapa enrolaría al lead en TODAS las
//     secuencias de etapa a la vez.
//   · sacando el filtro de ámbito (`leadEnAmbito`): **2 fallos**, «dispara SOLO la
//     secuencia de esa etapa» y el del producto: el lead sin embudo recibía además el
//     mensaje del producto de al lado.
//   · sacando el filtro de trigger: **3 fallos**, porque la #4 (un formulario) y la #5
//     (sin etapa) se cuelan en los tres casos que cuentan ids.
//
// ⚠️ Y UNA ASERCIÓN DE ESTE ARCHIVO ESTABA MAL ESCRITA Y EL CÓDIGO TENÍA RAZÓN: decía que
// el lead del producto 13 «no entra a la global». Entra, y tiene que entrar. Lo delató
// correrlo, no leerlo — es la razón por la que un test se prueba rompiéndolo: el sano
// daba 7/8 y el que fallaba era el test.

// ── Y que el CHOKE POINT esté enchufado ──────────────────────────────────────
// Un test de la función no dice si alguien la llama. Lo que convierte esto en una feature
// es que `setBoardStageOverride` —por donde pasan TODOS los caminos que escriben la
// columna del tablero: la ficha, el arrastre del kanban, la confirmación de MaKo— dispare
// el evento. Sin esto, mover un lead seguiría esperando al barrido horario del cron.

const bloqueDe = (archivo: string, abre: string, cierraCon: string): string => {
  const src = readFileSync(new URL(`../${archivo}`, import.meta.url), 'utf8');
  const ini = src.indexOf(abre);
  assert.ok(ini > 0, `no encontré «${abre}» en ${archivo}`);
  // El cierre REAL del bloque, no un número de caracteres a ojo: un `slice(ini, ini+800)`
  // mira la función de al lado y da verde sobre lo que no leyó (AGENTS.md).
  const fin = src.indexOf(cierraCon, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierraCon}» en ${archivo}`);
  return src.slice(ini, fin);
};

test('setBoardStageOverride dispara el evento de etapa, con la etapa y el producto', () => {
  const bloque = bloqueDe(
    'lib/leads.ts',
    'export async function setBoardStageOverride(',
    '\nexport async function saveLeadMeta(',
  );
  assert.ok(bloque.length < 4000, `el recorte mide ${bloque.length}: está mirando otra cosa`);
  assert.match(bloque, /enrolarPorEvento\(/, 'nadie enrola: mover un lead no dispararía nada');
  assert.match(bloque, /'etapa'/, 'el evento tiene que ser el de etapa');
  // Los dos datos que el evento no puede deducir del id del lead.
  assert.match(bloque, /etapa:\s*stageKey/, 'la etapa que se guarda es la que viaja en el evento');
  assert.match(bloque, /funnelId:/, 'sin el producto, la secuencia del producto de al lado también dispararía');
  // La guarda del cambio: sin ella, guardar la ficha con la misma etapa manda un mensaje.
  assert.match(bloque, /antes\.pipeline_stage !== stageKey/, 'tiene que disparar sólo si la etapa CAMBIÓ');
});

// Probado rompiéndolo (05/10/2026) de tres formas sobre `lib/leads.ts`, una por vez:
//   · borrando la llamada a `enrolarPorEvento`: 1 fallo, y el mensaje dice que mover un
//     lead no dispararía nada.
//   · cambiando `'etapa'` por `'lead_nuevo'`: 1 fallo.
//   · sacando la comparación `antes.pipeline_stage !== stageKey`: 1 fallo.
// Los tres sobre 9 tests, con los 8 de arriba intactos: el guard mide el cableado y los
// otros miden la decisión, que son dos preguntas distintas.

// ── Y la ENTREGA de un servicio, que es otra pregunta ────────────────────────
// El kanban de Customer Success mueve CLIENTES por las etapas de la entrega
// (onboarding, hito 1, hito 2…). Lo midió la sesión de Customer Success antes de que
// existiera este código: reusar el evento de venta sería un bug esperando, porque las
// dos listas de etapas las edita el cliente y `secuenciasDeEtapa` compara con `===` —
// el día que alguien llame `facturando` a una etapa de entrega, mover un cliente en el
// kanban dispararía una secuencia de VENTA.

const ENTREGAS = [
  { id: 10, trigger_tipo: TRIGGER_ENTREGA, etapa: 'onboarding', producto_id: null },
  { id: 11, trigger_tipo: TRIGGER_ENTREGA, etapa: 'onboarding', producto_id: 5 },
  { id: 12, trigger_tipo: TRIGGER_ENTREGA, etapa: 'hito2', producto_id: 5 },
  // Una de VENTA con la MISMA clave de etapa: el choque que el trigger propio cierra.
  { id: 13, trigger_tipo: TRIGGER_ETAPA, etapa: 'onboarding', producto_id: null },
];

test('la entrega dispara por su propio trigger: una de venta con la misma clave no entra', () => {
  assert.deepEqual(ids(secuenciasDeEntrega(ENTREGAS, 'onboarding', 5)), [10, 11]);
  assert.equal(secuenciasDeEntrega(ENTREGAS, 'onboarding', 5).some((x) => x.id === 13), false);
});

test('el PRODUCTO acota, y sin producto declarado la secuencia es de todas las entregas', () => {
  // El cliente del producto 9 recibe la global (10) y no la del 5.
  assert.deepEqual(ids(secuenciasDeEntrega(ENTREGAS, 'onboarding', 9)), [10]);
  assert.deepEqual(ids(secuenciasDeEntrega(ENTREGAS, 'hito2', 9)), []);
  assert.deepEqual(ids(secuenciasDeEntrega(ENTREGAS, 'hito2', 5)), [12]);
  // bigint que llega como texto: un `===` contra un número daría false SIEMPRE.
  assert.deepEqual(ids(secuenciasDeEntrega(ENTREGAS, 'hito2', '5')), [12]);
});

test('sin etapa o SIN PRODUCTO no enrola a nadie', () => {
  for (const vacio of [undefined, null, '', '  ']) {
    assert.deepEqual(secuenciasDeEntrega(ENTREGAS, vacio, 5), [], `etapa ${JSON.stringify(vacio)}`);
  }
  // ⚠️ Acá es MÁS estricto que en la venta, y a propósito: un lead sin embudo es normal
  // (NULL = el del negocio), pero `cliente_entrega.producto_id` es NOT NULL, así que un
  // evento de entrega sin producto es un llamador roto — y «entonces todos los
  // productos» sería mandarle los mensajes de otro servicio.
  for (const vacio of [undefined, null, '', 'ocho']) {
    assert.deepEqual(secuenciasDeEntrega(ENTREGAS, 'onboarding', vacio), [], `producto ${JSON.stringify(vacio)}`);
  }
});

test('el choke point de Customer Success enrola con el evento de ENTREGA y con el producto', () => {
  // La contracara del guard de tests/cs-mover-etapa.test.ts, que fija que NO sea el de
  // venta: acá se fija que la llamada EXISTA y lleve los dos datos. Un test que sólo
  // prohíbe pasa también cuando no hay ninguna llamada.
  const bloque = bloqueDe(
    'lib/cs-mover-etapa.ts',
    'export async function moverClienteDeEtapa(',
    '\nexport async function sacarClienteDeEntrega(',
  );
  assert.match(bloque, /enrolarPorEvento\(pedido\.leadId, 'entrega'/, 'el choke point tiene que enrolar con el evento de entrega');
  assert.match(bloque, /productoId:\s*pedido\.productoId/, 'sin el producto, la secuencia de otro servicio también dispararía');
  assert.match(bloque, /etapa:\s*hacia/, 'la etapa que viaja es la de DESTINO');
  // Y después del upsert: enrolar antes de que la fila exista le manda un mensaje a
  // alguien que todavía no se movió.
  assert.ok(bloque.indexOf('enrolarPorEvento') > bloque.indexOf('lead_audit'), 'el enrolamiento va al final, con el movimiento ya guardado');
});

// Probado rompiéndolo (05/10/2026):
//   · sacando la guarda del producto (`if (prod == null …) return []`): **1 fallo**, el
//     de «sin etapa o SIN PRODUCTO», que es el que separa «no enrola» de «le manda los
//     mensajes de otro servicio».
//   · sacando el filtro de trigger: **1 fallo**, el primero — entra la de VENTA.
//   · sacando el filtro de producto (`suyo === prod`): **1 fallo**, el segundo.
//   · borrando la llamada en lib/cs-mover-etapa.ts: **1 fallo**, el guard de cableado
//     (y el de la sesión de Customer Success sigue en verde, que es justo su punto
//     ciego: prohíbe el evento de venta y no exige que haya alguno).

// ── Salir de una etapa CIERRA lo que esa etapa tenía agendado ───────────────
// Lo avisó la sesión de Customer Success: el «Deshacer» del toast del kanban vuelve a
// llamar al choke point con la etapa anterior, así que un arrepentimiento a los tres
// segundos llega al motor como un movimiento de vuelta. Y la regla que lo cubre no es
// «detectar el deshacer» —eso sería meter un dato de UI en el modelo— sino la que ya
// está escrita en AGENTS.md: un mensaje que habla de un MOMENTO se re-pregunta al salir.

test('el motor cierra lo pendiente de la etapa que se DEJA, antes de enrolar la nueva', () => {
  const bloque = bloqueDe('lib/nutricion.ts', "    if (evento === 'entrega') {", '\n    const secuencias:');
  assert.ok(bloque.length < 1200, `el recorte mide ${bloque.length}: está mirando otra cosa`);
  assert.match(bloque, /cerrarEntregaDeEtapa\(leadId, ctx\?\.desde/, 'el evento de entrega tiene que cerrar lo de la etapa anterior');
  // El ORDEN importa: al revés, un movimiento de ida y vuelta deja viva la inscripción
  // de la etapa que el cliente ya no tiene.
  assert.ok(
    bloque.indexOf('cerrarEntregaDeEtapa') < bloque.indexOf('secuenciasDeEntrega'),
    'primero se cierra lo viejo y después se enrola lo nuevo',
  );
});

test('cerrar usa EL MISMO criterio que enrolar, no una copia', () => {
  // Dos formas de preguntar «qué secuencias son de esta etapa de este producto» es
  // cómo se desincronizan: la que cierra tiene que ser la misma que la que enrola.
  const bloque = bloqueDe('lib/nutricion.ts', 'export async function cerrarEntregaDeEtapa(', '\nexport async function enrolarPorEvento(');
  assert.match(bloque, /secuenciasDeEntrega\(/, 'el cierre tiene que resolver las secuencias con la misma función');
  assert.match(bloque, /estado: 'completada'/, 'se cierra con el mismo estado que usa el motor');
  assert.match(bloque, /\.eq\('estado', 'activa'\)/, 'sólo se cierran las ACTIVAS: una ya cerrada no se vuelve a tocar');
  assert.ok(!/throw/.test(bloque), 'no puede tirar: romper el movimiento del kanban es peor que cerrar de menos');
});

test('salir de la entrega también cierra, y no enrola nada', () => {
  // El cierre es el `}` a COLUMNA CERO: `sacarClienteDeEntrega` es la última función del
  // archivo, así que anclarse en «lo que viene después» la ata a que no venga nada.
  const bloque = bloqueDe('lib/cs-mover-etapa.ts', 'export async function sacarClienteDeEntrega(', '\n}\n');
  assert.match(bloque, /cerrarEntregaDeEtapa\(leadId, etapa, productoId\)/, 'salir de la entrega deja mensajes agendados sobre una etapa que ya no existe');
  assert.ok(!/enrolarPorEvento/.test(bloque), 'salir no es llegar a ninguna etapa: no se enrola nada');
});

// Probado rompiéndolo (05/10/2026):
//   · borrando la llamada a `cerrarEntregaDeEtapa` del evento: 1 fallo.
//   · invirtiendo el orden (enrolar antes de cerrar): 1 fallo, el del orden.
//   · reemplazando `secuenciasDeEntrega` por un filtro a mano adentro del cierre:
//     1 fallo, el de «el mismo criterio».
//   · borrando el cierre de `sacarClienteDeEntrega`: 1 fallo.
