// El ÁMBITO DE EMBUDO de una secuencia de nutrición (#627)
// =============================================================================
// `nutricion_secuencias.funnel_id` existe desde la mig 0170 («NULL = sirve a
// TODOS los funnels. Con valor, solo a ese») y hasta hoy no lo leía nadie: con
// dos embudos vivos, la cohorte juntaba los leads de los dos y el mismo lead
// recibía los dos WhatsApp y los dos emails. Sin error y sin log.
//
// Lo que este archivo fija son las TRES respuestas, y la primera es la que más
// duele si se rompe:
//
//   1. Secuencia SIN embudo declarado (hoy, las 62 filas de la base) → junta lo
//      MISMO que antes de este cambio. Si el filtro se aplicara igual con NULL,
//      ninguna secuencia enrolaría a nadie nunca más y se cortaría la nutrición
//      de todos los clientes, en silencio.
//   2. Secuencia que declara un embudo SECUNDARIO → sólo los suyos.
//   3. Secuencia que declara el embudo POR DEFECTO → también los leads con
//      `funnel_id` NULL, porque en este repo NULL **es** el embudo del negocio
//      (`listLeadsDeFunnel(null)` los pide con `.is('funnel_id', null)` y los
//      1.530 leads de los 6 workspaces lo tienen así). Sin esto, declarar el
//      embudo del negocio dejaría la cohorte vacía para todo el mundo.
//
// ⚠️ PROBADO ROMPIÉNDOLO, seis veces, con el conteo de cada rotura — los
// números están al pie de este archivo.
//
// ⚠️ Y LA DECISIÓN SE EJECUTA, NO SE LEE. `lib/nutricion.ts` arrastra
// `lib/workspace` y con eso el runtime de Next, que bajo tsx no carga, así que
// la condición vive en `lib/nutricion-ambito.ts` (sin `server-only`) y lo que se
// lee del fuente es sólo el CABLEADO — que es la otra mitad: una decisión
// perfecta que no se encadena a la consulta no acota ninguna cohorte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ambitoDeSecuencia, filtroDeAmbito, type FiltroAmbito } from '../lib/nutricion-ambito';

const raiz = join(__dirname, '..');
const motor = () => readFileSync(join(raiz, 'lib/nutricion.ts'), 'utf8');

/** El id del embudo del negocio y el de un producto nuevo. */
const NEGOCIO = 7;
const SECUNDARIO = 9;

/**
 * Los leads de un workspace con dos embudos: dos sin asignar (= los del negocio,
 * el caso de todos los clientes de hoy), uno con el id del default escrito a mano
 * (`moverLeadDeFunnel` escribe el id crudo) y uno del producto nuevo.
 */
const LEADS: Array<{ id: number; funnel_id: number | null }> = [
  { id: 1, funnel_id: null },
  { id: 2, funnel_id: null },
  { id: 3, funnel_id: NEGOCIO },
  { id: 4, funnel_id: SECUNDARIO },
];

/**
 * Qué leads deja pasar un filtro. La expresión del `or` se PARSEA en vez de
 * compararse como texto: así el test sigue a lo que la cadena significa, y
 * cambiarla por una que no incluya los NULL falla acá y no en producción.
 */
function junta(filtro: FiltroAmbito): number[] {
  if (filtro === null) return LEADS.map((l) => l.id);
  if ('eq' in filtro) return LEADS.filter((l) => l.funnel_id === filtro.eq).map((l) => l.id);
  const condiciones = filtro.or.split(',').map((cruda) => {
    const m = /^funnel_id\.(is|eq)\.(.+)$/.exec(cruda.trim());
    assert.ok(m, `condición que este test no sabe evaluar: «${cruda}»`);
    return { op: m[1], valor: m[2] };
  });
  for (const c of condiciones) {
    assert.ok(c.op === 'eq' || c.valor === 'null', `un \`is\` contra «${c.valor}» no es lo que este test evalúa`);
  }
  return LEADS
    .filter((l) => condiciones.some((c) => (c.op === 'is' ? l.funnel_id === null : l.funnel_id === Number(c.valor))))
    .map((l) => l.id);
}

const deSecuencia = (funnelId: number | null | undefined, esDefault: boolean) =>
  junta(filtroDeAmbito(ambitoDeSecuencia(funnelId, esDefault)));

// ── Las tres respuestas ─────────────────────────────────────────────────────
test('una secuencia SIN embudo declarado junta lo mismo que hoy', () => {
  assert.deepEqual(ambitoDeSecuencia(null, false), { modo: 'todos' });
  assert.equal(filtroDeAmbito({ modo: 'todos' }), null, 'con NULL no se filtra: si se filtrara, nadie se enrola nunca más');
  assert.deepEqual(deSecuencia(null, false), [1, 2, 3, 4]);
  // Y `undefined` es el mismo caso: así llega desde un call-site que todavía no
  // pasa el embudo.
  assert.deepEqual(ambitoDeSecuencia(undefined, false), { modo: 'todos' });
});

test('una secuencia con embudo SECUNDARIO junta sólo los suyos', () => {
  assert.deepEqual(ambitoDeSecuencia(SECUNDARIO, false), { modo: 'propio', id: SECUNDARIO });
  assert.deepEqual(deSecuencia(SECUNDARIO, false), [4]);
});

test('una secuencia que declara el embudo del NEGOCIO incluye a los de funnel_id NULL', () => {
  assert.deepEqual(ambitoDeSecuencia(NEGOCIO, true), { modo: 'negocio', id: NEGOCIO });
  assert.deepEqual(deSecuencia(NEGOCIO, true), [1, 2, 3]);
  // El lead del producto nuevo NO entra: es lo que separa este ámbito de «todos».
  assert.ok(!deSecuencia(NEGOCIO, true).includes(4));
});

test('un bigint que llega como texto decide igual', () => {
  // La columna es `bigint`: el día que un driver la devuelva como «9», un `===`
  // contra un número sería false SIEMPRE y el filtro no encontraría nada.
  assert.deepEqual(ambitoDeSecuencia('9', false), { modo: 'propio', id: 9 });
  assert.deepEqual(ambitoDeSecuencia('7', true), { modo: 'negocio', id: 7 });
  // Lo que no se puede leer como id cae en «todos», que es lo de hoy.
  assert.deepEqual(ambitoDeSecuencia('abc', false), { modo: 'todos' });
});

// ── El cableado (lib/nutricion.ts) ──────────────────────────────────────────
// Un ámbito que se resuelve bien y no se encadena a la consulta no acota nada, y
// el typecheck no ve ninguno de estos cuatro.
function bloque(desde: string, hasta: string): string {
  const src = motor();
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no se encontró «${desde}» en lib/nutricion.ts`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no se encontró el cierre «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

test('la lectura de las cohortes aplica el ámbito', () => {
  // `filasCohorte` es por donde pasan los 13 cohortes legacy (`idsCohorte`
  // delega en ella): es el choke point, y el que se agregue mañana lo hereda.
  const cuerpo = bloque('async function filasCohorte<T>(', '\nasync function idsCohorte');
  assert.ok(cuerpo.length < 900, `el recorte de filasCohorte mide ${cuerpo.length}: está mirando otra cosa`);
  assert.match(cuerpo, /conAmbito\(/, 'filasCohorte dejó de acotar al embudo: la cohorte junta los leads de todos los productos');
  assert.match(cuerpo, /ambito: AmbitoFunnel/, 'filasCohorte dejó de recibir el ámbito');
});

test('el cohorte de etapa_actual también lo aplica', () => {
  // Es el único que no pasa por `filasCohorte` —lee `leads` y filtra la etapa en
  // memoria— y es el que la mig 0170 nombra como el riesgo que sale a una persona.
  const cuerpo = bloque("if (triggerTipo === 'etapa_actual')", '\n  if (triggerTipo ===');
  assert.match(cuerpo, /conAmbito\(q, ambito\)/, 'etapa_actual volvió a juntar los leads abiertos de TODOS los embudos');
});

test('la rama de la post-agenda no pierde el ámbito al llamarse a sí misma', () => {
  const rama = bloque('if (triggerTipo === TRIGGER_AGENDA_CONOCIDO', '\n  }');
  assert.match(rama, /cohorteDeTrigger\('agendado_sin_confirmar', etapa, ambito\)/,
    'el trigger hermano se resuelve sin ámbito: juntaría los leads de todos los embudos');
});

test('el motor le pasa a la cohorte el embudo DE LA SECUENCIA', () => {
  const src = motor();
  const sitios = [...src.matchAll(/leadsDeCohorte\(sec\.trigger_tipo, sec\.etapa([^)]*)\)/g)];
  assert.equal(sitios.length, 2, `los call-sites de leadsDeCohorte son ${sitios.length}: el plan y el commit`);
  for (const s of sitios) {
    // Desde el 05/10 viaja también `sec.producto_id`: el ámbito de una secuencia de
    // ENTREGA es el producto y no el embudo (mig 0189). Lo que el guard cuida sigue
    // siendo lo mismo — que el call-site no resuelva la cohorte SIN el ámbito.
    assert.equal(s[1], ', sec.funnel_id, sec.producto_id', 'un call-site resuelve la cohorte sin el ámbito de la secuencia: el filtro queda muerto');
  }
  // Y el dato tiene que llegar desde la base, o `sec.funnel_id` es `undefined`
  // para siempre y el ámbito es «todos» aunque el dueño declare el embudo.
  // ⚠️ NO SE FIJA LA LISTA EXACTA DE COLUMNAS. La primera versión de este guard pedía
  // el `select(...)` completo y se puso ROJO el 05/10 cuando la sesión vecina le sumó
  // `cron, cron_proxima_at` — dos columnas legítimas que no tienen nada que ver con lo
  // que acá se cuida. Un guard que fija el texto entero convierte cualquier agregado de
  // al lado en una falla, y lo que se aprende de eso es a ignorarlo. Lo que importa es
  // que el ÁMBITO viaje: que los dos campos estén adentro del select de las secuencias.
  // Probado rompiéndolo: sacando `funnel_id` de los dos selects → 1 fallo, 7 pases.
  // ⚠️ Y la rotura se hace con un script, no con `sed -i`: en este entorno `sed -i` no
  // aplicó y NO avisó — el test dio 8/0 sobre un archivo que yo creía roto, que es un
  // verde sobre una medición que nunca ocurrió.
  for (const campo of ['funnel_id', 'producto_id']) {
    const selects = [...src.matchAll(/\.select\('([^']*trigger_tipo[^']*)'\)/g)];
    assert.ok(selects.length > 0, 'no encontré el select de las secuencias');
    for (const sel of selects) {
      assert.ok(sel[1].includes(campo),
        `el select de las secuencias no trae ${campo}: la declaración del dueño no llega al motor`);
    }
  }
});

// ── Las SEIS roturas, con su conteo ─────────────────────────────────────────
// Medido una por una (8 tests en total; sin romper nada: 8 pases, 0 fallos):
//
// 1. `filtroDeAmbito` del negocio devolviendo `{ eq: id }`, sin el `is.null`:
//    1 fallo / 7 pases. La cohorte del embudo del negocio junta [3] en vez de
//    [1, 2, 3], o sea que deja afuera a TODOS los leads de hoy.
// 2. `ambitoDeSecuencia` sin su salida temprana de `funnelId == null`:
//    1 fallo / 7 pases (`Number(null)` es 0, así que una secuencia sin embudo
//    pasa a filtrar por el embudo 0 y no enrola a nadie).
// 3. `conAmbito` fuera de `filasCohorte` (lib/nutricion.ts): 1 fallo / 7 pases.
// 4. Los dos call-sites sin `sec.funnel_id`: 1 fallo / 7 pases.
// 5. El cohorte de `etapa_actual` sin su `filtros`: 1 fallo / 7 pases.
// 6. La recursión de la post-agenda con `{ modo: 'todos' }` en vez del ámbito:
//    1 fallo / 7 pases.
