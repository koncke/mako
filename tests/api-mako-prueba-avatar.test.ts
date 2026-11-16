// =============================================================================
// La API de MaKo deja de prometer el video con avatar de IA en la prueba de Essential (14/11/2026)
// =============================================================================
// El 14/11 el avatar de IA volvió a ser de MaKo Pro ('ai-avatar' en `FUNCIONES_SOLO_PRO`, lib/topes-plan.ts) y ese mismo día
// se sacó del FAQ del sitio (app/vsl/_sitio/preguntas.ts). Una verificación encontró la promesa VIVA por la puerta de la API:
// un dueño de MaKo Essential en sus 7 días que le pregunta a MaKo por WhatsApp «¿qué incluye mi prueba?» la seguía recibiendo,
// por dos caminos que se suman:
//   · la DESCRIPCIÓN de `ver_mi_prueba` (negocio.def.ts) listaba los cinco topes, el avatar entre ellos: eso es el texto que
//     lee el modelo, y es lo que repetía;
//   · el RESUMEN (lib/prueba-uso.ts, `resumenDePrueba`) metía la fila del avatar en `usos` también para un Essential, así que
//     el dato confirmaba la promesa — y lo mismo dibujaban el cartel de la barra, la franja y «Tu plan» del teléfono.
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: no hay nada roto en el tope. `topeEnPrueba('completo', 'prueba.avatares')` da 1
//    para un Essential porque la tabla del PLAN no tiene esa clave y `topeEnPrueba` cae al de la prueba — y eso está bien: un
//    tope de la prueba es el TECHO de quien YA tiene la función por su plan, no la llave. La prueba tampoco es una capa
//    aparte: vale el plan elegido desde el primer día y los dos planes arrancan con los 7 días. Lo que faltaba era cruzar los
//    dos ejes (el tope y el candado del plan) en el único lugar que arma la lista. Este test FIJA el 1, para que el próximo
//    no lo «arregle».
//
// ── SEGUNDA VUELTA (15/11/2026): LA PROMESA SALÍA POR TRES PUERTAS MÁS, Y ESTE TEST ESTABA VERDE ──────────────────────────
// Un verificador adversarial midió lo de arriba y encontró que el barrido del tercer test (`includes('video con avatar de IA')
// || /avatar de IA/`) devolvía CERO con tres operaciones nombrándolo, porque el repo escribe la función «AI Avatar» (la tab):
// `ver_avatares` y `ver_plantillas_avatar` (video.def.ts) y `hooks_al_video_media_buyer` (ads.def.ts). Y buscando con el nombre
// de verdad aparecieron DOS que ni la descripción mostraba, escondidas en el input_schema: `proponer_crear_campana` y
// `editar_ejemplo_carrusel`. Lo que cambió acá:
//   · el barrido se arma con los nombres que el repo YA usa (la tab de lib/movil-rutas.ts, la etiqueta del tope, el texto del
//     candado) y corre sobre el conjunto VISIBLE de un Essential por sus tres canales, mirando el ToolDef ENTERO;
//   · cada operación que lo nombra tiene su decisión escrita (`DECIDIDAS`), y una cuarta puerta no tiene y da rojo;
//   · el candado se mide CORRIÉNDOLO (el hijo llama a los runners reales), no leyendo el fuente.
//
// ⚠️ Y EL SEGUNDO DIAGNÓSTICO OBVIO TAMBIÉN ERA EL EQUIVOCADO: «cerrá las tres» apaga datos del cliente. `ver_avatares` LEE
//    los looks que ya tiene —entre el 29/10 y el 14/11 la función estuvo abierta en los tres planes— y cerrarla le contesta
//    «es de Pro» sobre algo suyo. Se cierra `ver_plantillas_avatar`, que es el catálogo y nada más; a `ver_avatares` se le
//    saca la OFERTA (la galería) y se le agrega `cerrado_por_su_plan`; y a las de ads se les saca la frase.
//
// ── TERCERA VUELTA (15/11/2026): EL ARREGLO ESTABA BIEN Y LAS ASERCIONES ESTABAN VACÍAS ───────────────────────────────────
// Tres lentes midieron la vuelta de arriba, CORRIENDO, y encontraron cuatro agujeros. El del cliente: la promesa no se había
// ido, SE HABÍA MUDADO al `resumen` del `ejecutar` de `hooks_al_video_media_buyer` (ads.run.ts), que la nombraba igual para los
// dos planes — y justo en el único turno donde esa operación es la que contesta. Los otros tres eran de este archivo, y son la
// LECCIÓN, que vale para cualquier test de acá en adelante:
//   · UNA ASERCIÓN SOBRE EL NOMBRE DE UNA CLAVE no mide que el dato no viaje: mide cómo se llama. Renombrando
//     `temas_de_la_galeria` a `temas_sugeridos`, este archivo quedaba 7/0 verde con los 33 temas viajando a un Essential. Se
//     asertan las CLAVES DE LA RESPUESTA ENTERA, ordenadas, contra el conjunto exacto.
//   · UNA ASERCIÓN SOBRE EL PRIMER ELEMENTO de una lista de textos deja pasar los que se agreguen después: `notas[0]` dejaba
//     entrar una nota nueva que listara los temas. Se asertan las notas enteras.
//   · UNA ASERCIÓN QUE NO PUEDE FALLAR es peor que ninguna, porque ocupa el lugar de la que sí mediría: había un
//     `assert.notEqual(m.primera, 'hooks…')` dos líneas después de asertar que `m.primera` era 'ver_avatares'.
//   · Y UNA FORMA DEL REGEX QUE EL REPO NO EJERCITA se puede borrar con todo en verde: de las cinco de
//     `COMO_LA_NOMBRA_EL_REPO`, cuatro no cambiaban ningún resultado. Ahora cada una tiene su frase en `FRASES`.
// LA REGLA: cada aserción tiene que ponerse roja cuando el PROGRAMA hace otra cosa, no cuando cambia una letra del fuente. Y se
// comprueba rompiendo el COMPORTAMIENTO con el texto que el test clava INTACTO: si no se pone roja, está vacía.
//
// Probado rompiéndolo (14/11 y 15/11/2026, las tres vueltas): al pie del archivo.
// Correr: node --import tsx --test tests/api-mako-prueba-avatar.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FUNCIONES_SOLO_PRO, NOMBRE_COSA_PRUEBA, TOPES_PRUEBA, textoSoloPro, topeDe, topeEnPrueba } from '../lib/topes-plan';
import { PRESUPUESTO_REGISTRO_CHARS } from '../lib/doer-herramientas';
import { SECCIONES_MAS } from '../lib/movil-rutas';
import { REGISTRO, aToolDef, ordenarPorRelevancia, tabsDeCapa, toolsDelRegistro, visible, type Vista } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El cuerpo de una operación de un `.run.ts` (de su clave a la siguiente). */
function operacion(rel: string, nombre: string, siguiente: string): string {
  const src = fuente(rel);
  const i = src.indexOf(`  ${nombre}: {`);
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const j = src.indexOf(`  ${siguiente}: {`, i);
  return src.slice(i, j > 0 ? j : undefined);
}

const DEF = REGISTRO.find((d) => d.id === 'ver_mi_prueba');
assert.ok(DEF, 'ver_mi_prueba sigue en el registro');
/** Lo que el MODELO recibe de verdad: la `description` del ToolDef, no el fuente. */
const DESCRIPCION = aToolDef(DEF).description;
/** Cómo se nombra el avatar donde SÍ corresponde: la etiqueta de la fila que vuelve en `usos`. */
const COMO_SE_LLAMA = NOMBRE_COSA_PRUEBA['prueba.avatares'][0];

// ── CÓMO ESCRIBE EL REPO EL NOMBRE DE LA FUNCIÓN (15/11/2026) ───────────────────────────────────────────────────────────
// El barrido de la ronda uno buscaba `includes('video con avatar de IA') || /avatar de IA/` y devolvía CERO con tres puertas
// abiertas: el repo escribe la función «AI Avatar» (la tab) casi siempre. Así que los nombres se SACAN del repo, no se tipean:
// si mañana se renombra la tab o la etiqueta del tope, estas aserciones se caen en vez de quedar ciegas.
const LABEL_TAB = SECCIONES_MAS.find((s) => s.id === 'ai-avatar')?.label;
assert.equal(LABEL_TAB, 'AI Avatar', 'la tab de la función (lib/movil-rutas.ts): el barrido se arma con su nombre');
for (const s of [...NOMBRE_COSA_PRUEBA['prueba.avatares'], textoSoloPro('ai-avatar')]) {
  assert.match(s, /avatar de IA/, 'la otra forma de nombrarla sale de la etiqueta del tope y del texto del candado');
}
/**
 * ⚠️ POR QUÉ NO ALCANZA CON /avatar/i, Y ES LA TRAMPA DE ESTE BARRIDO: en este repo «avatar» nombra DOS cosas distintas. La
 * del video es ésta; la otra es el avatar de MARKETING (el cliente ideal: `mako.avatares`, Ads Writer, `generar_avatares`,
 * `editar_avatar_negocio`, `listar_avatares_guion`). Un /avatar/i da más de veinte operaciones y ninguna tiene nada que ver
 * con el plan, así que el barrido se vuelve ruido y nadie lo mira. Se nombra la FUNCIÓN: su tab, «avatar de IA», o el avatar
 * haciendo lo que sólo hace el de video (hablar, animarse, filmarse, estar listo).
 */
const COMO_LA_NOMBRA_EL_REPO = new RegExp(
  [
    'avatar(?:es)?\\s+de\\s+IA',
    LABEL_TAB!.replace(/\s+/g, '\\s+'),
    '\\b(?:tu|su)\\s+avatar\\b',
    'avatar[^.]{0,40}\\b(?:habla|hablar|anima|animar|filmar|listo)\\b',
    '\\b(?:filmar|animar)[^.]{0,40}avatar',
  ].join('|'),
  'i',
);
/**
 * ⚠️ CADA FORMA CON SU ROJO PROPIO, PORQUE EL REPO NO LAS EJERCITA (15/11/2026, tercera vuelta). Una lente midió que de las
 * cinco alternativas de arriba sólo la de «AI Avatar» cambia el resultado del barrido: tres no matchean NINGUNA de las 936
 * operaciones visibles de un Essential, y «tu/su avatar» encuentra sólo lo que el label de la tab ya encuentra. O sea que se
 * podían BORRAR las cuatro con este archivo entero en verde: el regex se habría ido angostando de vuelta al de la ronda uno,
 * que daba cero con tres puertas abiertas. Esta tabla es lo que las sostiene — una frase por forma, cada una escrita para
 * matchear por SU alternativa y por ninguna otra (comprobado: borrar cualquiera de las cinco pone esta tabla en rojo).
 * Y las negativas son el avatar de MARKETING, que es la trampa del comentario de arriba: un /avatar/i las levanta todas.
 * ⚠️ LO QUE ESTA TABLA NO PIDE: que no haya falsos positivos. «el avatar de compra habla de precio» matchea la cuarta forma y
 *    es marketing. Se aceptó: un falso positivo sólo obliga a escribir una entrada en `DECIDIDAS`, y un falso negativo es una
 *    promesa viva. Por eso las negativas son frases del repo, no casos de borde buscados.
 */
const FRASES: ReadonlyArray<{ frase: string; nombra: boolean }> = [
  { frase: 'un video con avatares de IA para el anuncio', nombra: true },
  { frase: 'los guiones quedan en la celda de AI Avatar', nombra: true },
  { frase: 'elegí la ropa de tu avatar', nombra: true },
  { frase: 'el avatar del negocio ya quedó listo', nombra: true },
  { frase: 'para filmar el gancho con el avatar del negocio', nombra: true },
  { frase: 'el avatar de compra del cliente ideal (mako.avatares)', nombra: false },
  { frase: 'listar_avatares_guion: los avatares del guion analizado', nombra: false },
  { frase: 'cambia el avatar del negocio en Ads Writer', nombra: false },
  { frase: 'generar_avatares: propone tres avatares nuevos de compra', nombra: false },
  { frase: 'sus avatares de compra ya están definidos', nombra: false },
];

/** La vista de un MaKo Essential que pide por un canal: la capa de Essential es `completo` (lib/plan-esencial-reglas.ts). */
const vistaEsencial = (canal: Vista['canal']): Vista => ({ canal, alcance: 'ejecutar', ws: 40, rol: 'admin', tabs: tabsDeCapa('completo') });
const VISIBLES_WA = REGISTRO.filter((d) => visible(d, vistaEsencial('whatsapp')));
/**
 * Todo lo que un Essential puede ver nombrado, por CUALQUIERA de sus tres canales, y medido sobre lo que el modelo recibe de
 * verdad: el ToolDef entero (`JSON.stringify(aToolDef(d))`), no la `descripcion` sola. El esquema también viaja, y ahí estaban
 * escondidas dos de las puertas que la ronda uno no vio (`proponer_crear_campana`, `editar_ejemplo_carrusel`).
 */
function nombranLaFuncion(): string[] {
  const ids = new Set<string>();
  for (const canal of ['whatsapp', 'app', 'http'] as const) {
    const v = vistaEsencial(canal);
    for (const d of REGISTRO) if (visible(d, v) && COMO_LA_NOMBRA_EL_REPO.test(JSON.stringify(aToolDef(d)))) ids.add(d.id);
  }
  return [...ids].sort();
}

/**
 * CADA OPERACIÓN QUE NOMBRA LA FUNCIÓN, CON SU DECISIÓN. El barrido NO es una lista a mano (sale del registro visible de
 * verdad); esto sí, y es el punto: una cuarta puerta no tiene decisión y el test la nombra. Si una se arregla y deja de
 * nombrarla, su entrada SOBRA y el test también lo dice (una entrada muerta es un barrido que ya no cubre nada).
 */
const DECIDIDAS: Readonly<Record<string, { estado: 'cerrada' | 'abierta' | 'abierta-sin-arreglar'; porque: string }>> = {
  ver_avatares: {
    estado: 'abierta',
    porque: 'LEE lo que el cliente ya tiene. Entre el 29/10 y el 14/11 la función estuvo abierta en los tres planes: hay Esenciales con looks, y contestarles «es de Pro» les apaga un dato suyo (AGENTS.md, «¿GENERA o LEE?»). Lo que no le viaja es la OFERTA (la galería), y la respuesta trae `cerrado_por_su_plan`.',
  },
  ver_plantillas_avatar: {
    estado: 'cerrada',
    porque: 'Es el catálogo de la función y nada del cliente, y «usar una» es elegirla en «Nuevo avatar», la pantalla del cartel de Pro. Cerrarla no le apaga nada propio.',
  },
  editar_ejemplo_carrusel: {
    estado: 'abierta-sin-arreglar',
    porque: '⛔ PENDIENTE, Y SÓLO EL TEXTO (medido el 15/11/2026): la OPERACIÓN ya está cerrada para un Essential en su `preparar`, por `candadoIaDeEditoresDe(ctx.ws)` (lib/api-mako/areas/imagen.run.ts, que llega a lib/editores-ia-pro.ts), porque editar con IA es otra función de Pro (`textoSoloPro(\'ia-editores\')`): no hay fuga de EJECUCIÓN. Lo que sigue abierto es que su `input_schema` le NOMBRA la función —el param `avatar` ofrece «look (su último look de AI Avatar)», lib/api-mako/areas/imagen.def.ts— y el esquema viaja al modelo, así que la promesa llega aunque la acción se niegue. Arreglarlo es una línea en imagen.def.ts; ese archivo quedó fuera del alcance de esta corrida.',
  },
};

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_api-mako-prueba-avatar-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

const CUATRO_ABIERTOS = ['prueba.videos 1/3', 'prueba.tomas 2/30', 'prueba.imagenes 3/20', 'web.landings_publicadas 0/1'];
const CON_AVATAR = [...CUATRO_ABIERTOS.slice(0, 2), `prueba.avatares 0/${TOPES_PRUEBA['prueba.avatares']}`, ...CUATRO_ABIERTOS.slice(2)];

test('EL TOPE NO ES EL PROBLEMA Y NO SE TOCA: 1 para los dos planes, porque es el techo, no el permiso', () => {
  assert.ok((FUNCIONES_SOLO_PRO as readonly string[]).includes('ai-avatar'), 'el avatar es de Pro: si sale de acá, este archivo sobra');
  assert.equal(TOPES_PRUEBA['prueba.avatares'], 1);
  assert.equal(topeDe('completo', 'prueba.avatares'), null, 'la tabla del PLAN no topa el avatar: no es uno de sus ejes');
  assert.equal(topeEnPrueba('completo', 'prueba.avatares'), 1, 'y por eso `topeEnPrueba` cae al de la prueba — está bien así');
  assert.equal(topeEnPrueba('agencia', 'prueba.avatares'), 1, 'lo mismo para Pro: el techo de lo que se lleva sin pagar');
  // Y el techo sigue frenando a quien SÍ la tiene: el segundo video no entra, en los dos planes (medido en el hijo).
  for (const ws of [40, 41]) {
    assert.equal(R.frenoAvatar[ws].primero, true, `ws${ws}: el primero entra`);
    assert.equal(R.frenoAvatar[ws].segundo, false, `ws${ws}: el segundo, no`);
  }
});

test('LA DESCRIPCIÓN que lee el modelo ya no promete el avatar, y lo manda a leer `usos`', () => {
  assert.doesNotMatch(DESCRIPCION, /avatar/i, 'la descripción es UN string para todos los negocios: nombrarlo es prometérselo al Essential');
  assert.match(DESCRIPCION, /`usos`/, 'los topes que el negocio tiene de verdad vienen en la respuesta');
  assert.match(DESCRIPCION, /LOS QUE VENGAN EN `usos` y sólo ésos/, 'y se le prohíbe nombrar lo que no esté ahí');
  // Lo que NO se fue: los cuatro topes que los dos planes tienen siguen nombrados (el modelo los usa para elegir la operación).
  for (const que of ['videos armados', 'tomas', 'imágenes', 'páginas publicadas']) assert.match(DESCRIPCION, new RegExp(que));
  // La palabra sigue donde corresponde: en la ETIQUETA de la fila, que es lo que el negocio ve sólo si la fila le llega.
  assert.equal(COMO_SE_LLAMA, 'video con avatar de IA');
});

test('TODA operación que le nombre el avatar a un Essential tiene su decisión, y una cuarta puerta cae acá', () => {
  // La ronda uno medía con `includes('video con avatar de IA') || /avatar de IA/` y daba [] con TRES puertas abiertas: el repo
  // escribe «AI Avatar». Lo que mide esto: el conjunto VISIBLE de verdad de un Essential, por sus tres canales, con el ToolDef
  // entero (descripción + esquema). ⚠️ LO QUE NO MIDE: el `titulo` (no se le manda al modelo, pero sí sale en el catálogo HTTP
  // y en docs/api-mako.md). Los textos que los runners devuelven al EJECUTAR tampoco los ve este barrido, y ahí estaba el
  // agujero más concreto: se miden corriéndolos, en el test del `resumen` de `hooks_al_video_media_buyer`.
  // ⚠️ Y PRIMERO, LAS FORMAS DEL REGEX, UNA POR UNA: el repo no las ejercita (ver `FRASES`), así que sin esto cuatro de las
  //    cinco se podían borrar con el archivo en verde y el barrido volvía a ser el de la ronda uno, que daba cero.
  for (const { frase, nombra } of FRASES) {
    assert.equal(COMO_LA_NOMBRA_EL_REPO.test(frase), nombra,
      nombra ? `esta forma de nombrar la función se dejó de barrer: «${frase}»` : `el barrido se abrió al avatar de MARKETING y se vuelve ruido: «${frase}»`);
  }
  const encontradas = nombranLaFuncion();
  const decididas = Object.keys(DECIDIDAS).sort();
  assert.deepEqual(encontradas.filter((id) => !DECIDIDAS[id]), [],
    'una operación nueva nombra la función: decidí si va `cerrada` (molde: `avatarCerradoEn`, video.run.ts) o `abierta` con la respuesta condicionada, y anotala en DECIDIDAS');
  assert.deepEqual(decididas.filter((id) => !encontradas.includes(id)), [],
    'esta entrada de DECIDIDAS ya no nombra la función: sacala, o el barrido queda con decisiones de operaciones que no existen');
  // Las tres que el verificador midió abiertas el 14/11: dos arregladas acá, y la de ads que se fue del barrido entero.
  for (const id of ['hooks_al_video_media_buyer', 'preparar_subida_media_buyer', 'proponer_crear_campana']) {
    assert.ok(!encontradas.includes(id), `${id} volvió a nombrar la función: era la promesa por el Media Buyer`);
  }
  // Y la referencia pública que se genera del registro quedó regenerada con el texto nuevo.
  const doc = fuente('docs/api-mako.md');
  assert.ok(doc.includes(DESCRIPCION), 'docs/api-mako.md quedó viejo: node --import tsx scripts/generar-api-doc.mjs');
  // Sólo las que salen por HTTP: la referencia es la del catálogo HTTP, y una operación sin ese canal no tiene página ahí.
  for (const id of Object.keys(DECIDIDAS)) {
    const d = REGISTRO.find((x) => x.id === id);
    if (d?.canales.includes('http')) assert.ok(doc.includes(aToolDef(d).description), `docs/api-mako.md quedó viejo en ${id}: node --import tsx scripts/generar-api-doc.mjs`);
  }
});

test('EL CANDADO DEL AVATAR, CORRIDO: al Essential le queda lo suyo y se le va la oferta; a Pro no le cambia nada', () => {
  const PRO = textoSoloPro('ai-avatar');
  /**
   * ⚠️ EL CONJUNTO EXACTO DE CLAVES, NO «¿VIENE `temas_de_la_galeria`?» (15/11/2026, tercera vuelta, y es la lección del
   * archivo). La versión de antes preguntaba por esa clave y asertaba que era null con el mensaje «la galería es la OFERTA y no
   * viaja». Una lente lo midió: RENOMBRANDO la clave a `temas_sugeridos` el archivo quedaba 7/0 VERDE mientras ws40 y ws43
   * recibían el catálogo entero de 33 temas (corrido con estos mismos runners). Una aserción sobre el nombre de una clave no
   * mide que un dato no viaje: mide cómo se llama. Con el conjunto exacto, CUALQUIER clave nueva en la respuesta de un negocio
   * con la función cerrada da rojo y hay que decidir si es un dato suyo o una oferta.
   */
  const CLAVES_CERRADO = ['cerrado_por_su_plan', 'looks', 'notas'];
  const CLAVES_ABIERTO = ['looks', 'notas', 'temas_de_la_galeria'];
  /**
   * ⚠️ Y LAS NOTAS ENTERAS, por lo mismo: estaba clavada SÓLO la primera (`notas[0]`), así que una nota NUEVA que le listara
   * los temas —o que le dijera «abrí AI Avatar y dale Generar video»— pasaba verde. Las notas son texto para que el modelo lo
   * repita: son la respuesta tanto como los datos.
   */
  const NOTA_PROPIOS = 'Los avatares que salen de anuncios del Video Generator no están aquí: los cuenta contar_escenarios_reusables.';
  const NOTAS_CERRADO = [
    'Estos looks son los que este negocio YA tenía: su plan tiene la función cerrada, así que no se puede crear ni animar ninguno nuevo. Repite `cerrado_por_su_plan` tal cual si pregunta por eso.',
    NOTA_PROPIOS,
  ];
  const NOTAS_ABIERTO = [
    'Cada look es un PROYECTO de AI Avatar: «listo» se anima abriendo su proyecto y «Generar video»; «generando» lo está haciendo el navegador del cliente por el puente a Flow.',
    NOTA_PROPIOS,
  ];
  // Los dos Esenciales: el de la prueba de 7 días (ws40) y el que ya paga (ws43). LA PRUEBA NO ES UNA CAPA APARTE: vale el plan
  // elegido desde el primer día, así que los dos chocan con el mismo candado. Sin candado: el ws1 (acuerdo a mano) y Pro (ws41).
  for (const ws of [40, 43]) {
    assert.deepEqual(R.verAvatares[ws].claves, CLAVES_CERRADO, `ws${ws}: la respuesta ENTERA es ésta — la galería es la OFERTA y no viaja con NINGÚN nombre`);
    assert.equal(R.verAvatares[ws].looks, 2, `ws${ws}: los looks que YA tenía se le devuelven igual (si esto da 0, el candado le apagó un dato suyo)`);
    assert.equal(R.verAvatares[ws].cerradoPorSuPlan, PRO, `ws${ws}: la respuesta trae el texto del candado, que es lo que la descripción manda a repetir`);
    assert.deepEqual(R.verAvatares[ws].notas, NOTAS_CERRADO, `ws${ws}: las notas, enteras: ninguna le ofrece animar ni nombra los temas`);
    assert.deepEqual(R.verPlantillasAvatar[ws], { error: PRO, esError: true }, `ws${ws}: el catálogo de la función se cierra entero`);
  }
  for (const ws of [1, 41]) {
    assert.deepEqual(R.verAvatares[ws].claves, CLAVES_ABIERTO, `ws${ws}: la respuesta entera, igual que antes del candado`);
    assert.equal(R.verAvatares[ws].looks, 2, `ws${ws}: igual que antes`);
    assert.equal(R.verAvatares[ws].galeria, 33, `ws${ws}: la galería entera`);
    assert.equal(R.verAvatares[ws].cerradoPorSuPlan, null, `ws${ws}: sin candado`);
    assert.deepEqual(R.verAvatares[ws].notas, NOTAS_ABIERTO, `ws${ws}: y las notas de siempre`);
    assert.deepEqual(R.verPlantillasAvatar[ws], { claves: ['nota', 'plantillas'], plantillas: 10 }, `ws${ws}: las 10 plantillas`);
  }
});

test('LA PROMESA NO SE MUDÓ AL `resumen`: lo que el negocio LEE al terminar la acción, corrido para los dos planes', () => {
  // ⛔ EL AGUJERO QUE LA RONDA DOS DEJÓ VIVO, y es el único de los cuatro que le llegaba a un cliente: la descripción de
  // `hooks_al_video_media_buyer` dejó de nombrar AI Avatar, y el `resumen` del `ejecutar` (lib/api-mako/areas/ads.run.ts) lo
  // seguía nombrando SIN CONDICIÓN, para los dos planes. Esto corre el `ejecutar` de verdad (los dos bordes que escriben van
  // de mentira en el hijo; el candado `esEsencialDe` corre con el ws del pedido) y mide EL TEXTO QUE VUELVE.
  // ⚠️ POR QUÉ ACÁ Y NO EN `ver_avatares`: medido, para «pasame los hooks ganadores para filmarlos con mi avatar» esta
  //    operación sale PRIMERA y `ver_avatares` queda en el puesto 14, que es el último esquema que entra en el presupuesto
  //    del turno (y entra por un slot que apareció al acortar esta descripción: antes quedaba afuera). En ese turno el
  //    resumen de esta acción es lo único que el negocio lee sobre el avatar.
  for (const ws of [40, 43]) {
    assert.equal(R.hooksAlVideo[ws].ok, true, `ws${ws}: la acción NO se cierra — llevar hooks al Video Generator es de los dos planes`);
    assert.doesNotMatch(R.hooksAlVideo[ws].resumen, COMO_LA_NOMBRA_EL_REPO,
      `ws${ws}: el resumen le nombra una función que su plan tiene cerrada (es el mismo barrido que la descripción, sobre el texto que vuelve)`);
    assert.match(R.hooksAlVideo[ws].resumen, /^En el Video Generator: 2 guiones nuevos\.$/, `ws${ws}: y lo que SÍ hizo se lo dice entero`);
  }
  for (const ws of [1, 41]) {
    assert.match(R.hooksAlVideo[ws].resumen, COMO_LA_NOMBRA_EL_REPO, `ws${ws}: a quien la tiene, el dato útil no se le saca`);
    assert.match(R.hooksAlVideo[ws].resumen, /En AI Avatar están en «Hooks ganadores», para filmarlos con tu avatar\.$/, `ws${ws}: igual que antes`);
  }
  // Y los dos textos son DISTINTOS: si alguien saca la condición, los cuatro negocios reciben lo mismo y esto cae solo.
  assert.notEqual(R.hooksAlVideo[40].resumen, R.hooksAlVideo[41].resumen, 'el resumen dejó de depender del plan');
});

test('LA PREGUNTA POR EL AVATAR LA CONTESTA LA OPERACIÓN HONESTA, y le llega al modelo (presupuesto del turno)', () => {
  // ⚠️ EL PRECIO QUE PAGÓ LA RONDA UNO: sacar «avatar» de `ver_mi_prueba` la bajó del puesto 26 al 161 y puso PRIMERA a
  // `hooks_al_video_media_buyer`, una de las tres que prometían. No se arregla volviendo a nombrarlo ahí (sería la promesa de
  // vuelta): la que tiene que ganar es `ver_avatares`, que trae `cerrado_por_su_plan`. Y el puesto no alcanza: lo que decide
  // es si el esquema ENTRA en el presupuesto del turno, así que se mide con `toolsDelRegistro` como lo arma el doer.
  const v = vistaEsencial('whatsapp');
  const medir = (pregunta: string) => {
    const orden = ordenarPorRelevancia(VISIBLES_WA, pregunta);
    const viajan = new Set(toolsDelRegistro({ vista: v, incluirAcciones: true, maxChars: PRESUPUESTO_REGISTRO_CHARS, relevanteA: pregunta, sinAviso: true }).map((t) => t.name));
    return { primera: orden[0].id, puesto: (id: string) => orden.findIndex((d) => d.id === id) + 1, viaja: (id: string) => viajan.has(id) };
  };

  const avatar = medir('¿puedo hacer un video con mi avatar de IA?');
  assert.equal(avatar.primera, 'ver_avatares', 'la que lee sus looks y trae el texto de Pro gana la pregunta por el avatar');
  assert.ok(avatar.viaja('ver_avatares'), 'y le llega al modelo en el turno');

  const listo = medir('¿tengo un avatar listo para hablar?');
  assert.equal(listo.primera, 'ver_avatares');
  assert.ok(listo.viaja('ver_avatares'));

  // Lo que la ronda uno arregló y no se rompió: la pregunta por la prueba sigue cayendo en `ver_mi_prueba`.
  const prueba = medir('¿qué incluye mi prueba gratis?');
  assert.equal(prueba.primera, 'ver_mi_prueba');
  assert.ok(prueba.viaja('ver_mi_prueba'));
  // Y el caso del tope, que es el único donde el número del avatar importa (un Pro en sus 7 días): engancha por «prueba».
  const tope = medir('¿cuántos videos con avatar de IA me quedan en la prueba?');
  assert.ok(tope.puesto('ver_mi_prueba') <= 5 && tope.viaja('ver_mi_prueba'), `ver_mi_prueba quedó en el puesto ${tope.puesto('ver_mi_prueba')} y ${tope.viaja('ver_mi_prueba') ? 'viaja' : 'NO viaja'}`);

  // ⚠️ ACÁ HABÍA UNA ASERCIÓN QUE NO PODÍA FALLAR NUNCA (sacada el 15/11/2026, tercera vuelta): un `assert.notEqual(m.primera,
  //    'hooks_al_video_media_buyer')` para `avatar` y `listo`, dos líneas después de haber asertado que `m.primera` es
  //    'ver_avatares'. Un notEqual contra un valor que ya se asertó igual a otra cosa es decoración: no hay un cambio del
  //    programa que la ponga roja sola. Lo que SÍ hay que medir es el turno donde la honesta NO gana, y es éste:
  // LA PREGUNTA QUE `ver_avatares` NO GANA, Y POR ESO EL RESUMEN TIENE QUE SER HONESTO. Medido el 15/11/2026: con esta frase
  // gana `hooks_al_video_media_buyer` y `ver_avatares` queda en el puesto 14 — el ÚLTIMO esquema que entra en el presupuesto,
  // y entra por un slot que apareció al acortar la descripción de hooks. Si el día que se mueva otra descripción se cae de la
  // lista, el único texto sobre el avatar en ese turno es el `resumen` de la acción: el test de arriba es el que lo cubre.
  const hooks = medir('pasame los hooks ganadores para filmarlos con mi avatar');
  assert.equal(hooks.primera, 'hooks_al_video_media_buyer', 'si esto cambia, revisá el test del `resumen`: puede que ya no sea la única que contesta');
  assert.ok(hooks.puesto('ver_avatares') >= hooks.puesto('hooks_al_video_media_buyer'),
    `la honesta le ganó a la acción en su propia pregunta (ver_avatares puesto ${hooks.puesto('ver_avatares')}): el candado del resumen sigue siendo el que cuenta`);
  // Y la que gana ese turno NO le promete el avatar a un Essential: el resumen corrido, del test de arriba.
  assert.doesNotMatch(R.hooksAlVideo[40].resumen, COMO_LA_NOMBRA_EL_REPO, 'el turno de los hooks se queda sin ninguna operación honesta');
});

test('EL RESUMEN: a un Essential en prueba no le cuenta el avatar; a todos los demás no les cambia nada (corrido de verdad)', () => {
  assert.deepEqual(R.ws40.usos, CUATRO_ABIERTOS, 'Essential por la pasarela, en prueba: sin la fila del avatar');
  assert.equal(R.ws40.plan, 'MaKo Essential', 'y sigue viendo SU prueba: la operación no se cerró, se fue una fila');
  assert.deepEqual(R.ws41.usos, CON_AVATAR, 'MaKo Pro en prueba: igual que antes');
  assert.deepEqual(R.ws1.usos, CON_AVATAR, 'el ws1 (acuerdo a mano) no lleva candado: igual que antes');
  // ⚠️ EL CASO QUE ATA EL «ws» Y NO LA CAPA VENDIDA: el que subió a Pro durante su prueba tiene capa `agencia` hoy y
  //    `alta_capa` todavía `completo`. Preguntar por la capa VENDIDA (la que trae `estadoDePrueba`) le escondería su tope.
  assert.deepEqual(R.ws42.usos, CON_AVATAR, 'subió a Pro en la prueba: tiene el avatar y su fila');
  assert.deepEqual(R.esEsencial, { 1: false, 40: true, 41: false, 42: false, 43: true }, 'quién lleva candado, medido');
  assert.deepEqual(R.ws43, { enPrueba: false }, 'el control: quien ya paga no está en prueba y no tiene ninguna fila');
});

test('LA API SIRVE `usos` TAL CUAL: ni una segunda lista de topes, ni la operación cerrada', () => {
  const op = operacion('lib/api-mako/areas/negocio.run.ts', 'ver_mi_prueba', 'empezar_mi_plan_ya');
  assert.match(op, /usos: r\.usos\.map\(\(u\) => \(\{ que: NOMBRE_COSA_PRUEBA\[u\.tope\]\[1\], usado: u\.usado, de: u\.de \}\)\)/,
    'la lista sale del resumen, que ya viene filtrado por plan');
  const sinComentarios = op.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(sinComentarios, /avatar/i, 'el runner no nombra ningún tope: una segunda lista se desfasa cuando cambie el plan');
  assert.doesNotMatch(sinComentarios, /esEsencialDe|SOLO_PRO|candado/i, 'un Essential en prueba tiene derecho a ver su prueba: la operación NO se cierra');
  // El candado vive en el resumen (una sola vez), y con el ws del pedido: por la API no hay sesión.
  const uso = fuente('lib/prueba-uso.ts');
  assert.match(uso, /const cerradoPorSuPlan = await esEsencialDe\(ws\);/);
  assert.match(uso, /if \(cerradoPorSuPlan && FUNCION_PRO_DE_CADA_TOPE\[tope\]\) continue;/);
  assert.match(uso, /'prueba\.avatares': 'ai-avatar',/, 'qué tope cuenta qué función de Pro, en un solo lugar');
});

// Probado rompiéndolo (14/11/2026), una rotura por vez sobre la base en verde (5 / 0), restaurada a mano (nunca con git) y
// comprobada con sha256 de los tres archivos y con `git diff`. Rota (pases / fallos):
//   · `resumenDePrueba` sin el filtro (como estaba)                              → 3 / 2  (el resumen MEDIDO y el pin del fuente)
//   · el filtro preguntando por `e.capa` (la capa VENDIDA) en vez del ws         → 3 / 2  (cae el ws42, el que subió a Pro)
//   · la descripción con la lista de cinco topes (como estaba)                   → 3 / 2  (la descripción y la referencia)
//     y, aparte, tests/api-mako-registro.test.ts                                 → 21 / 1 (docs/api-mako.md queda viejo)
//   · el runner sumando la fila del avatar a mano sobre `r.usos`                 → 4 / 1
//     ⚠️ con esa rotura tests/prueba-cartel.test.ts queda VERDE (6 / 0): su regex sólo ata la primera línea del `leer`, así que
//        una segunda lista en el runner no la veía nadie hasta este archivo.
// ⚠️ LO QUE NO SE PUDO ROMPER: el tope en 0 para `completo` (la «corrección» que el primer test previene) vive en
//    lib/topes-plan.ts, fuera de los archivos que esta corrida podía tocar. La aserción es una lectura pura de esa tabla:
//    cambiar el 1 o el null la pone en rojo por construcción, pero no está medido acá.
//
// Y probado rompiéndolo otra vez (15/11/2026), una rotura por vez sobre la base en verde (7 / 0), restaurada a mano (nunca con
// git) y comprobada con `sha256sum -c` de los siete archivos. Rota (pases / fallos):
//   · `hooks_al_video_media_buyer` nombrando AI Avatar otra vez (como estaba)      → 6 / 1  («una operación nueva nombra la función», con su id)
//   · AI Avatar de vuelta en el ESQUEMA de `proponer_crear_campana` (no en la
//     descripción: el param `creativoRef`)                                        → 6 / 1  (el mismo rojo: el esquema SÍ se barre)
//   · el barrido sin la forma «AI Avatar» (el regex exacto de la ronda uno)        → 6 / 1  («esta entrada de DECIDIDAS ya no nombra
//     la función», nombrando `ver_plantillas_avatar` y `editar_ejemplo_carrusel`: una entrada muerta es un barrido ciego)
//   · `ver_plantillas_avatar` sin su candado                                      → 6 / 1  (el catálogo se cierra entero, CORRIDO)
//   · `ver_avatares` cerrada ENTERA (el arreglo obvio y equivocado)               → 6 / 1  («los looks que YA tenía se le devuelven igual»)
//   · la galería viajando igual a un Essential                                     → 6 / 1  («la galería es la OFERTA y no viaja»)
//   · la lista de cinco topes de vuelta en `ver_mi_prueba` (la regresión)          → 5 / 2  (la descripción y el barrido)
//   · `ver_avatares` con su descripción de antes                                   → 5 / 2  (la relevancia: deja de ganar la pregunta
//     por el avatar; y la referencia queda vieja)
// ⚠️ LO QUE UNA ROTURA SOLA NO REPRODUCE: la regresión medida el 14/11 (puesto 1 para `hooks_al_video_media_buyer` en «¿puedo
//    hacer un video con mi avatar de IA?»). Con `ver_avatares` arreglada, hooks ya no gana aunque le devuelvan la frase: queda
//    en el puesto 13. Hace falta romper las DOS descripciones a la vez, y eso no está medido acá como una rotura sola.
//
// Y probado rompiéndolo la TERCERA vez (15/11/2026), base en verde 8 / 0, una rotura por vez, restaurada a mano (nunca con
// git) y comprobada con `sha256sum -c` de los seis archivos después de cada una. ⚠️ ACÁ CADA ROTURA ES DE COMPORTAMIENTO, CON
// EL TEXTO QUE EL TEST CLAVA INTACTO: es la única forma de saber que la aserción no está vacía. Rota (pases / fallos):
//   · el `resumen` de `hooks_al_video_media_buyer` nombrando AI Avatar SIN condición
//     (el agujero medido: `cerradoPorSuPlan || true`, con el candado ahí arriba)     → 6 / 2  (el resumen CORRIDO para ws40 y ws43, y
//     el turno de los hooks que se queda sin ninguna operación honesta)
//   · la galería RENOMBRADA a `temas_sugeridos` y viajando a los dos planes —la
//     refutación exacta de la lente: el texto «la galería es la OFERTA y no viaja»
//     sigue ahí y `temas_de_la_galeria` da null, así que la aserción de antes pasaba  → 7 / 1  («la respuesta ENTERA es ésta», con el
//     conjunto de claves al lado)
//   · una nota NUEVA que le lista los temas al plan cerrado, dejando `notas[0]` tal
//     cual (lo que la aserción de antes clavaba)                                      → 7 / 1  («las notas, enteras»)
//   · el barrido sin la forma «tu/su avatar» (una de las cuatro que la lente midió
//     que se podían borrar con todo en verde)                                         → 7 / 1  («esta forma de nombrar la función se dejó
//     de barrer: “elegí la ropa de tu avatar”»)
//   · el barrido sin la forma «filmar/animar … avatar»                                → 7 / 1  (el mismo rojo, con su frase)
// ⚠️ LO QUE SIGUE SIN MEDIRSE, y queda escrito para no gastar la vuelta: que la descripción de
//    `preparar_subida_media_buyer` no prometa un campo que `generados` no trae. La corrige el comentario de ads.def.ts (hoy
//    dice lo que la respuesta trae de verdad: título, fecha y si es un anuncio montado o una toma), pero no hay test que lo
//    ate, porque correr ese runner pide una cuenta publicitaria conectada. El barrido sí atrapa que vuelva a NOMBRAR la tab.
