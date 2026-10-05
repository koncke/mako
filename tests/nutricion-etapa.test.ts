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
import { secuenciasDeEtapa, TRIGGER_ETAPA } from '../lib/nutricion-etapa';
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
