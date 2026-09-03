import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACENTOS_ES, MULETILLAS, resolverAcento, muletillasQueSobreviven, type AcentoId,
} from '../lib/acento-workspace';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * El fuente SIN comentarios.
 *
 * ⚠️ Hace falta porque los comentarios de este repo CITAN el código que vienen a
 * explicar —«acá decía `useState<Paso>(PASOS[0])`»— así que una guarda que busca
 * ese texto se encuentra a sí misma explicada y da verde sobre el bug puesto.
 */
function sinComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// =============================================================================
// Cómo habla el avatar del cliente — el acento DECLARADO y sus muletillas
// =============================================================================
// Todo esto falla en silencio. El guion sale en un español correcto igual, y que
// la variedad no sea la suya se descubre cuando alguien lo dice en voz alta, con
// el clip pagado. Por eso el módulo no tiene `server-only`: es lo único que se
// puede probar sin gastar una llamada.

const IDS = Object.keys(ACENTOS_ES) as AcentoId[];

test('toda variedad tiene sus muletillas', () => {
  // Sin entrada, el paso del onboarding muestra una grilla vacía y no hay forma
  // de contestarlo — y `armar` haría `MULETILLAS[id].includes` sobre undefined.
  for (const id of IDS) {
    assert.ok(Array.isArray(MULETILLAS[id]) && MULETILLAS[id].length >= 4, `${id} sin muletillas`);
  }
});

test('el acento DECLARADO le gana a la zona horaria', () => {
  // Es el punto entero del onboarding: hasta que existió, los dos llamadores
  // pasaban `declarado = null` y no había forma de corregir la inferencia.
  const r = resolverAcento('mx-cdmx', 'America/Tijuana');
  assert.equal(r.id, 'mx-cdmx');
  assert.equal(r.origen, 'declarado');
  assert.equal(r.seguro, true);
});

test('sin declarar, sale de la zona horaria y se marca como inseguro', () => {
  const r = resolverAcento(null, 'America/Tijuana');
  assert.equal(r.id, 'mx-norte');
  assert.equal(r.origen, 'zona-horaria');
  assert.equal(r.seguro, false, 'una inferencia presentada como declarada es cómo se cuela un error que nadie audita');
});

test('un acento declarado que ya no existe no gana: cae a la inferencia', () => {
  const r = resolverAcento('mx-yucatan-inventado', 'America/Bogota');
  assert.equal(r.id, 'co');
  assert.equal(r.seguro, false);
});

test('las muletillas viajan PEGADAS al acento, no por un slot nuevo', () => {
  // ⚠️ Va así a propósito: `renderTemplate` deja literales los slots que no
  // conoce, así que un `{{muletillas}}` nuevo llegaría CRUDO a todo workspace
  // con el prompt editado a mano — el mismo modo de falla que dejó «{{acento}}»
  // sin llenar durante meses.
  const r = resolverAcento('mx-norte', null, ['pues', 'la neta']);
  assert.match(r.prompt, /Northern Mexican Spanish/);
  assert.match(r.prompt, /"pues"/);
  assert.match(r.prompt, /"la neta"/);
});

test('el prompt NO dice cuántas veces usarlas', () => {
  // El repo ya se equivocó repartiendo muletillas por densidad y el cliente lo
  // marcó al instante: «exageraste el uso del pues, lo pusiste en lugares que no
  // tienen sentido». Un número acá reproduce ese error.
  const r = resolverAcento('mx-cdmx', null, ['neta']);
  assert.doesNotMatch(r.prompt, /\d/, 'el prompt de muletillas trae un número');
  assert.match(r.prompt, /naturally/);
});

test('sin muletillas marcadas, el prompt es el acento pelado', () => {
  // Hay gente que habla limpio, y el paso se puede cerrar vacío. La cadena no
  // puede quedar hablando de una lista que no existe.
  const r = resolverAcento('latam', null, []);
  assert.equal(r.prompt, ACENTOS_ES.latam);
  assert.deepEqual(r.muletillas, []);
});

test('una muletilla de OTRA variedad no viaja', () => {
  // Pasa al cambiar de acento con muletillas ya guardadas. «Órale» en un guion
  // colombiano no se ve al leer: se oye, y suena a que el avatar cambió de
  // nacionalidad a mitad del anuncio.
  const r = resolverAcento('co', null, ['pues', 'órale', 'vale']);
  assert.deepEqual(r.muletillas, ['pues']);
  assert.doesNotMatch(r.prompt, /órale/);
  assert.doesNotMatch(r.prompt, /vale/);
});

test('las muletillas se filtran también cuando el acento es INFERIDO', () => {
  // El filtro vive en `armar`, así que cubre los tres orígenes. Si viviera solo
  // en la rama de «declarado», un cliente sin acento elegido mandaría al modelo
  // la lista entera sin filtrar.
  const r = resolverAcento(null, 'America/Bogota', ['órale']);
  assert.equal(r.id, 'co');
  assert.deepEqual(r.muletillas, []);
});

// ── El onboarding de la tab ────────────────────────────────────────────────

test('la tab del generador de video tiene su onboarding', () => {
  const def = TAB_ONBOARDINGS['video-generator'];
  assert.ok(def, 'toda tab tiene onboarding: es la regla del producto');
  assert.equal(def.key, 'video-generator', 'la key tiene que ser la del nav o el gate no encuentra la tab');
});

test('todos sus pasos van con prefijo `vg_`', () => {
  // ⚠️ `contexto`/`ensayo` pelados COLISIONAN vía el registro compartido de pasos
  // con el Chat Agent y con Instagram: terminar el ensayo acá marcaría «Ensayo de
  // conversación» del Chat Agent como hecho. Es un gotcha ya documentado en el
  // catálogo y ya cometido dos veces.
  for (const p of TAB_ONBOARDINGS['video-generator'].pasos) {
    assert.match(p.key, /^vg_/, `el paso «${p.key}» puede colisionar con otra tab`);
  }
});

test('la extensión va PRIMERO, y el catálogo dice lo mismo que la pantalla', () => {
  // ⚠️ ESTO INVIERTE LA REGLA DE LA SKILL, A PROPÓSITO.
  //
  // `tab-onboarding` dice «lo aburrido al final, excepto lo que bloquea», y este
  // test fijaba eso: el puente anteúltimo. El dueño lo movió al primer lugar el
  // 02/09/2026 —«el primer paso del onboarding debe ser instalar la extensión»— y
  // el porqué entra por la propia excepción de la skill: bajar e instalar una
  // extensión es lo ÚNICO con tiempo de espera propio, así que pedirla al arranque
  // deja que se instale mientras la persona contesta lo demás.
  const keys = TAB_ONBOARDINGS['video-generator'].pasos.map((p) => p.key);
  assert.equal(keys[0], 'vg_puente');
  assert.equal(keys[keys.length - 1], 'vg_ensayo');

  // ⚠️ Y LA PARTE QUE DE VERDAD PROTEGE: el orden de este catálogo es una GUARDA.
  // `marcarPasoTab` no deja marcar un paso si falta uno anterior de la lista, así
  // que si la pantalla y el catálogo se desordenan entre sí, el wizard queda
  // pidiendo completar un paso que viene DESPUÉS. Pasó el 02/09/2026 con un
  // cliente delante: el paso 1 decía «antes falta completar Tu cara», que era el 2.
  assert.deepEqual(keys, ['vg_puente', 'vg_cara', 'vg_acento', 'vg_muletillas', 'vg_voz', 'vg_ensayo']);
});

// ── Retomar donde quedó ────────────────────────────────────────────────────

test('el wizard sabe DÓNDE retomar, y el mapa que usa cubre los seis pasos', () => {
  // ⚠️ EL BUG QUE ESTE TEST FIJA ES EL DEL MAPA INCOMPLETO, no el de retomar.
  //
  // Al escribir «arrancá en el primer paso pendiente» lo natural es usar
  // `CLAVE_DE_PASO`, que ya existe y parece el mapa de paso→fila. Pero es un
  // SUBCONJUNTO a propósito: sólo las tres que este wizard marca con
  // `marcarPasoVideoAction`. Las otras tres las cierran otras actions.
  //
  // Con el subconjunto, un paso sin clave nunca cuenta como pendiente: a alguien
  // que dejó el acento sin contestar el wizard lo manda MÁS ADELANTE, saltándole
  // justo lo que falta. Y no falla — abre en una pantalla perfectamente válida.
  const src = readFileSync(join(RAIZ, 'app/video-generator/OnboardingVideoGen.tsx'), 'utf8');

  const mapa = /const FILA_DE_PASO: Record<Paso, string> = \{([^}]*)\}/.exec(src)?.[1] ?? '';
  assert.ok(mapa, 'desapareció FILA_DE_PASO: ¿se volvió a usar el mapa incompleto?');

  // Los seis pasos del recorrido tienen que estar. Si se agrega uno y no se suma
  // acá, ese paso deja de poder ser «el pendiente» y el wizard lo saltea.
  for (const paso of ['puente', 'cara', 'acento', 'muletillas', 'voz', 'ensayo']) {
    assert.match(mapa, new RegExp(`\\b${paso}:`), `FILA_DE_PASO no cubre «${paso}»`);
  }

  // Y las filas que nombra tienen que existir en el catálogo de la tab, o el
  // pendiente se calcula contra una clave que nadie escribe nunca.
  const delCatalogo = new Set(TAB_ONBOARDINGS['video-generator'].pasos.map((x) => x.key));
  for (const fila of mapa.match(/'vg_[a-z]+'/g) ?? []) {
    assert.ok(delCatalogo.has(fila.replaceAll("'", '')), `${fila} no existe en el catálogo`);
  }
});

test('y el wizard NO abre siempre en el primer paso', () => {
  // Estuvo clavado en `PASOS[0]` y el dueño lo reportó tres veces en una sola
  // sesión con un cliente: «otra vez te hace repetir todo el onboarding cuando ya
  // lo dejaste listo. Eso funciona muy mal».
  //
  // Lo que engaña del reporte: el progreso SÍ se guardaba. Lo que faltaba era
  // LEERLO al abrir — y desde afuera «no se guardó» y «no se leyó» se ven igual.
  const src = sinComentarios(readFileSync(join(RAIZ, 'app/video-generator/OnboardingVideoGen.tsx'), 'utf8'));
  assert.doesNotMatch(src, /useState<Paso>\(PASOS\[0\]\)/, 'volvió a abrir siempre en el primer paso');
  assert.match(src, /hechos/, 'el wizard ya no recibe qué pasos están hechos');

  // Y la página tiene que pasárselo: escribir el prop y no cablearlo deja el
  // wizard abriendo en el primero igual, que es el mismo síntoma sin el bug.
  const page = sinComentarios(readFileSync(join(RAIZ, 'app/video-generator/page.tsx'), 'utf8'));
  assert.match(page, /hechos=\{hechos\}/, 'la page no le pasa los pasos hechos a la puerta');
  const puerta = sinComentarios(readFileSync(join(RAIZ, 'app/video-generator/PuertaVideoGen.tsx'), 'utf8'));
  assert.match(puerta, /hechos=\{hechos\}/, 'la puerta no se los pasa al wizard');
});

// ── La muletilla que la persona ESCRIBE ────────────────────────────────────

test('una muletilla propia SOBREVIVE, y la de otra variedad no', () => {
  // ⚠️ EL CASO QUE NINGÚN TEST TENÍA, y por eso el bug vivió.
  //
  // Los dos tests de arriba pasan con lista blanca Y con lista negra, porque
  // TODAS sus entradas son sugerencias de alguna variedad. El caso que las
  // distingue es una palabra que no sugiere NADIE — o sea, justamente la que la
  // persona se tomó el trabajo de tipear.
  //
  // Con la lista blanca esa palabra se tiraba en CUATRO lugares distintos, y la
  // action devolvía { ok: true }. Medido con un cliente delante: «las muletillas
  // no se guardaron».

  // «chamullo» no es sugerencia de ninguna variedad: es de la persona.
  for (const id of IDS) {
    assert.ok(!MULETILLAS[id].includes('chamullo'), `'chamullo' se volvió sugerencia de ${id}: elegí otra palabra para este test`);
  }
  assert.deepEqual(muletillasQueSobreviven('ar', ['obvio', 'chamullo']), ['obvio', 'chamullo']);

  // «cachai» SÍ es de otra variedad (cl): con acento mexicano se tira, porque un
  // avatar norteño diciéndola suena a que cambió de nacionalidad a mitad del
  // anuncio — y eso no se ve al leer, se oye.
  assert.ok(MULETILLAS.cl.includes('cachai'));
  assert.deepEqual(muletillasQueSobreviven('mx-norte', ['pues', 'cachai', 'chamullo']), ['pues', 'chamullo']);

  // ⚠️ Sin acento NO se filtra nada. `[]` como lista de válidas descartaba TODO,
  // que es confundir «no puedo decidir» con «no vale ninguna» — y ante la duda,
  // tirar es la opción destructiva.
  assert.deepEqual(muletillasQueSobreviven('', ['lo que sea']), ['lo que sea']);
  assert.deepEqual(muletillasQueSobreviven(null, ['lo que sea']), ['lo que sea']);
});

test('y la regla vive en UN solo lugar: nadie la reescribe a mano', () => {
  // Estuvo copiada en cuatro archivos y las copias DIVERGIERON: la pantalla tenía
  // la correcta (lista negra) y el server la equivocada (lista blanca), o sea que
  // se veía bien y no se guardaba — la peor combinación posible.
  for (const f of ['app/video-generator/voz-cliente.ts', 'app/video-generator/OnboardingVideoGen.tsx']) {
    const src = sinComentarios(readFileSync(join(RAIZ, f), 'utf8'));
    assert.doesNotMatch(src, /MULETILLAS\[[a-zA-Z.]+\]\.includes/, `${f} volvió a filtrar muletillas a mano`);
  }
});
