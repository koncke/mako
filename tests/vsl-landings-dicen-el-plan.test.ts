// =============================================================================
// Las landings de funcionalidad dicen de qué plan es cada cosa (15/11/2026)
// =============================================================================
// EL SÍNTOMA: /vsl/copywriting vendía como TITULAR el chat con los referentes del marketing (metaTitle, <h1> y la primera
// cifra del hero), /vsl/video vendía la Edición automática y /vsl/image el chat del editor y «Editar» — y las tres cosas se
// cerraron en Esencial el 14/11/2026 (Martín, sobre /planes: «el de 47 debería estar bien limitado y restrictivo. En cambio
// el de 97 ya podés generar avatares de IA, podés editar videos, podés replicar landing… La idea es que compren el de 97, no
// el de 47»). Estas páginas no llevan las columnas de planes (`PlanesSitio` / `TarjetasPlanes` no están en
// LandingCompetencia.tsx), así que el titular era la ÚNICA señal de plan: alguien que paga US$47 elegía su plan leyendo una
// promesa que no se le iba a cumplir. La regla ya estaba escrita: docs/relevo/brief-landings.md:40.
//
// QUÉ MIDE ESTO, Y QUÉ NO: mide COMPORTAMIENTO, no la fuente. Dibuja cada landing de verdad (el mismo `renderToStaticMarkup`
// de tests/vsl-landings-competencia.test.ts) y para el metaTitle llama a `metadataDeLanding`, que es lo que sirve la ruta.
// No hay ninguna aserción sobre el texto de un .ts: cambiar una coma no pone esto rojo.
//
// ── POR QUÉ NO HAY UNA LISTA DE LUGARES, Y ESTO ES LO IMPORTANTE ─────────────────────────────────────────────────────────
// La primera versión de este test traía una lista escrita a mano de las 15 promesas marcadas, y por eso NO ENCONTRABA LO QUE
// FALTABA: se le escaparon el hero de /vsl/copywriting («Te llevas el método de N referentes…» y «Los N referentes… Ahora tu
// IA puede trabajar con su método»), el pie de la galería de /vsl/image («Con «Editar», tu versión…») y el título que juntaba
// los subtítulos —que son de los dos planes— con el B-roll, que no. Los tres vivían en el archivo de DISEÑO, no en el de
// datos, y una lista de lugares sólo mira los lugares que alguien ya miró. Y encima daba 5 de 5 verde con una décima función
// cerrada en memoria: el barrido no barría.
// Ahora se recorre el TEXTO DIBUJADO: `HUELLAS` dice, POR FUNCIÓN, con qué PALABRAS estas páginas la nombran, y el
// barrido exige el aviso en CADA lugar donde esas palabras aparecen. Lo que hay a mano es una fila por función —no por
// lugar—, `Record<FuncionSoloPro, …>`, así que:
//   · el TYPECHECK no compila sin la fila de una función nueva (`node scripts/tsc-acotado.mjs --heap=4096` sobre este archivo);
//   · `node --test` tampoco pasa: el primer test recorre `FUNCIONES_SOLO_PRO` y exige su fila, su nombre de venta y su `porque`;
//   · y si las palabras de esa fila aparecen en la página, el barrido reclama el aviso en cada una.
//
// ⚠️ LO QUE SE BARRE ES LA PÁGINA, NO SU MARCO (todo medido, 15/11/2026):
//   · la BARRA y el PIE del sitio son el MENÚ de MaKo, y dos de sus renglones chocán con palabras declaradas. Se corta de
//     `<h1` hasta el `<footer class="…-pie">`: el cuerpo.
//     ⚠️ LA RAZÓN QUE DECÍA ACÁ ERA FALSA: decía «nombran TODAS las funciones de MaKo, cualquier palabra pega ahí», y
//     contado de las 31 palabras declaradas en `HUELLAS` (3+3+13+2+1+1+2+4+2, parseando la tabla) la barra pega CERO y el pie
//     pega UNA: `setter`, por su renglón «Automations · tu setter con IA». Esa sola alcanza para romper el test —la fila de
//     'setter-ia' dice `laNombran: false`, así que una aparición en el pie la pone roja— y con el barrido comparando SIN
//     distinguir mayúsculas se suma `avatar`, que pega 2 veces en la barra y 2 en el pie por el renglón «AI Avatar». El
//     menú es una lista de links, no una promesa de plan, y pedirle un «Con MaKo Pro» no tiene sentido.
//     ⚠️ Y EL «CERO» NO VALE PARA TODAS: medido por una lente el 15/11/2026, en /vsl/competitor-spy —la página que entró
//        al barrido en esta misma pasada— la BARRA sí pega `setter`, dos veces. O sea que el «cero» era de las tres
//        primeras, no una propiedad del marco: lo que sostiene el recorte es que el marco NO es una promesa, no un conteo.
//     ⚠️ Y DE PASO, EL RECORTE SACA LOS `<script>` DEL SITIO. Es estructural y se lee en `cuerpoDe`: los scripts del
//     sitio viven en el MARCO, antes del `<h1>`, y el corte arranca EN el `<h1>`, así que quedan afuera por posición.
//     Por eso el `.replace(/<script…/)` de `cuerpoDe` es un cinturón redundante hoy — sirve para el día que un diseño
//     meta uno DENTRO del cuerpo. ⚠️ NO LE PONGO NÚMEROS: tres longitudes que decían acá («10.813 / 5.473 / 10.144»)
//        eran de OTRA cadena —el aplanado entero, no lo que `cuerpoDe` devuelve— y una lente las midió distintas. Un
//        número que no se midió acá es peor que no decirlo: la próxima sesión decide con él. Si hace falta el dato,
//        se mide dibujando y se escribe con la fecha.
//   · las PREGUNTAS no son de estas páginas: ../app/vsl/_competencia/registro.ts les pone las de la portada a todo bloque
//     `preguntas` (son código muerto acá: editar una respuesta en copywriting.ts no cambia la página). Se sacan con
//     `PREGUNTAS_SITIO`, que es de donde salen.
//   · los recuadros de «Aquí falta la animación» (FaltaAnimacion.tsx) dicen QUÉ ANIMACIÓN FALTA, no qué trae el plan: el de
//     /vsl/image decía «El chat de MaKo al lado del lienzo: le pides un cambio…» y pedía un aviso que no corresponde. Se
//     saca el <div class="mk-falta">. Martín pidió que esos recuadros queden exactamente como están.
//
// Y MIDE LAS DOS DIRECCIONES, porque MARCAR DE MÁS TAMBIÉN ES MENTIR (y encima espanta al de US$47). Lo esperado sale de
// `FUNCIONES_SOLO_PRO` y `FUNCIONES_TODAVIA_NO_VENDIDAS`, nunca de una lista escrita acá:
//   · cerrada en Esencial y vendida  → la landing TIENE que decir «Con MaKo Pro» junto a la promesa;
//   · cerrada pero todavía no vendida (hoy el avatar, `AI_AVATAR_SE_VENDE`) → NO la puede decir: sería empezar a venderla;
//   · abierta en los dos planes → NO la puede decir, y `ABIERTAS` es la lista de lo que el candado NO cierra.
// ⚠️ DE ESE LADO HAY UNA TAUTOLOGÍA, Y ESTÁ ACOTADA A PROPÓSITO: el aviso de la página sale de `soloPro`, que evalúa la MISMA
//    cuenta que `seVendeEnPro` de acá, así que comparar una contra la otra no puede fallar mientras la derivación se use. Lo
//    que este test mide de verdad —y lo que falló— es DÓNDE y A CUÁNTA DISTANCIA está el aviso, que la derivación no decide.
//    Y lo que sí es independiente son estas tres, cada una por un camino distinto: `laNombran` (las palabras aparecen o no en
//    el dibujo), el aviso suelto (cada «Con MaKo Pro» dibujado tiene que estar reclamado) y la tabla de /planes
//    (`noIncluyeDe('completo')`, que arma `filasDeComparacion` por su cuenta y tiene que decir lo mismo que la landing).
//
// PROBADO ROMPIÉNDOLO (15/11/2026; base 8 pass / 0 fail, ya con /vsl/competitor-spy adentro). Las tres primeras mueven la
// TABLA DE PLANES sin tocar ningún archivo, con el precargador ./_mutar-funciones-de-pro.ts (un `--import` que muta el array
// exportado en memoria: NO hace falta `mock.module` ni `--experimental-test-module-mocks`):
//   1. `PRO_SUMA=funcion-nueva`, una DÉCIMA función cerrada en Esencial                 → 7 / 1: «se cerró en Esencial y
//      este test no sabe con qué palabras la nombran». ESTE es el que antes daba verde con los avisos intactos, y es la
//      razón de que la cobertura ya no sea una lista de lugares;
//   2. `PRO_SACA=chat-referentes`, la función se ABRE en Esencial                        → 7 / 1, y es la otra mitad: los 5
//      avisos de los referentes DESAPARECEN SOLOS del dibujo (/vsl/copywriting pasa de 7 «Con MaKo Pro» a 2) y el único rojo
//      es la fila de `HUELLAS` que quedó colgada, con qué hacer. Con la fila sacada también, 8 / 0;
//   3. `PRO_VENDE=1`, o sea `AI_AVATAR_SE_VENDE` en true                                 → 6 / 2. De las CUATRO apariciones
//      del avatar que el barrido ve en /vsl/video, DOS quedan sin aviso (el chip del hero, a tres frases, y el metaDesc, que
//      no tiene ninguno adelante); el título y el cuerpo de la tarjeta los cubre el aviso derivado del cuerpo, a una frase.
//      El test corta en la primera, así que la corrida muestra una sola: las dos se cuentan dibujando la página.
//      ⚠️ La segunda falla es DEL PRECARGADOR, no de la página: `noIncluyeDe` lee `AI_AVATAR_SE_VENDE` directo y el
//      precargador sólo puede mover el array, así que la tabla y la landing se separan.
// Las demás, tocando el archivo y volviéndolo atrás (todas vueltas a medir el 15/11/2026 con las cuatro páginas):
//   4. el aviso borrado del metaTitle de copywriting.ts                                  → 7 / 1 («el título de Google dice
//      «referentes» y no dice que «chat-referentes» es de MaKo Pro»);
//   5. el aviso borrado de la bajada del hero de video.ts, la Edición automática         → 7 / 1;
//   6. «Con MaKo Pro» escrito a mano en «Tu personaje con IA» (cerrado pero sin vender)  → 6 / 2 (el barrido y el aviso
//      suelto: los dos lo agarran);
//   7. «Con MaKo Pro» escrito a mano en los subtítulos, que son de los dos planes        → 6 / 2 (`ABIERTAS` y el suelto);
//   8. el título «Pone los subtítulos y el B-roll» de vuelta como estaba                 → 7 / 1: el «B-roll» del título
//      queda a dos frases del aviso del final del cuerpo. Es exactamente el defecto que se arregló, y ahora tiene guarda;
//   9. los dos avisos del hero borrados de ./disenos/copywriting.tsx                     → 7 / 1. ESTE es el que una lista de
//      lugares no veía: el texto vive en el archivo de DISEÑO, no en el de datos;
//  10. el aviso borrado del pie de la galería de ./disenos/image.tsx                     → 7 / 1 (lo mismo, en /vsl/image);
//  11. el aviso borrado del metaDesc de video.ts                                         → 7 / 1 (el texto de Google no se
//      dibuja: si no se mirara con `metadataDeLanding`, esto pasaba verde).
// Y LAS DE LA RONDA DEL 15/11/2026 A LA TARDE, que son las que guardan los arreglos nuevos:
//  12. el aviso borrado de la tarjeta 1 de «MaKo lo diseña contigo» (image.ts, «con «Editar»») → 7 / 1, con el mensaje
//      «/vsl/image: dice «Con «Editar»» y no dice que «ia-editores» es de MaKo Pro». ⚠️ Y LA MISMA ROTURA CON EL BARRIDO
//      VIEJO (la 'i' sacada del RegExp de `posiciones`, o sea distinguiendo mayúsculas) da 8 / 0 VERDE: esa es la medida de
//      que la sensibilidad a mayúsculas no era un detalle, era el agujero por donde pasó esta promesa de Pro;
//  13. el aviso del comparador de /vsl/video colgado otra vez del FINAL de la lista (lo abierto y lo cerrado juntos, con la
//      frase abierta intacta)                                                               → 5 / 3: el barrido (el B-roll
//      queda a dos frases), `ABIERTAS` (los subtítulos y el volumen quedan a una del aviso) y el aviso suelto;
//  14. el aviso borrado de «Su guion, con tu oferta» (competitor-spy.ts)                   → 7 / 1 ('replicar-guion', por la
//      palabra `Replicas su` que entró con esa página);
//  15. el aviso borrado de «Tu versión, en Image» (competitor-spy.ts)                      → 7 / 1. ⚠️ El rojo que SALE
//      nombra 'replicar-landing' y el renglón de títulos, no 'ia-editores': el test corta en el primero y hay otra
//      aparición antes. Da rojo igual, pero si se lee el mensaje esperando 'ia-editores' se busca en el lugar equivocado;
//  16. el aviso borrado del cuerpo de «Copia su sitio» (competitor-spy.ts)                  → 7 / 1 ('replicar-landing');
//  17. una palabra VACÍA agregada a una fila de `HUELLAS`                                   → 7 / 1: `posiciones` devuelve
//      CERO posiciones para una aguja vacía, así que sin esa guarda la fila declaraba cobertura y el barrido no buscaba nada.
// ⚠️ LO QUE NO QUEDÓ GUARDADO, MEDIDO: ponerle también aviso al TÍTULO «Copia su sitio» y después sacárselo da 8 / 0, así
//    que ese aviso no era una guarda de nada. El diseño de /vsl/competitor-spy dibuja los TRES títulos en fila y después los
//    tres cuerpos, y el aviso del cuerpo de la tarjeta de al lado cae a UNA frase del título siguiente: con la ventana de 1
//    frase, en una fila de promesas todas cerradas, cada aviso tapa al vecino. Por eso el título quedó sin aviso y el cuerpo
//    de cada tarjeta lleva el suyo (los tres cuerpos sí están medidos: roturas 14, 15 y 16).
// Correr: node --import tsx --test tests/vsl-landings-dicen-el-plan.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingCompetencia, { metadataDeLanding } from '../app/vsl/_competencia/LandingCompetencia';
import { LANDINGS_COMPETENCIA } from '../app/vsl/_competencia/registro';
import { PREGUNTAS_SITIO } from '../app/vsl/_sitio/preguntas';
import type { Bloque, LandingCompetencia as Landing } from '../app/vsl/_competencia/tipos';
import { FUNCIONES_SOLO_PRO, type FuncionSoloPro } from '../lib/topes-plan';
import { FUNCIONES_TODAVIA_NO_VENDIDAS, NOMBRE_FUNCION_PRO, noIncluyeDe } from '../lib/planes-comparacion';

/** El aviso, tal cual lo dibujan las hermanas ya hechas (app/vsl/_competencia/crm.ts, competitor-spy.ts, disenos/crm.tsx). */
const MARCA = 'Con MaKo Pro';

/**
 * LAS PÁGINAS QUE SE MIRAN. Una landing nueva que venda algo cerrado se suma acá —y /vsl/competitor-spy entró el 15/11/2026,
 * porque tenía un «Con MaKo Pro.» TIPEADO A MANO (su :164) y dos promesas de Pro sin ningún aviso. ⚠️ No era el único a
 * mano de /vsl: contados el 15/11/2026 quedan CINCO, todos en landings que esto NO barre (../app/vsl/_competencia/crm.ts:93
 * y :95, disenos/crm.tsx:254 y disenos/web-generator.tsx:206 y :391).
 * ⚠️ QUE UNA LANDING ENTRE NO ES UNA LÍNEA: el recorte tiene que servirle (medido: dibuja su `<h1>` y su `<footer …-pie>`,
 *    y no tiene ningún recuadro `mk-falta`) y el barrido reclama TODO lo que la página prometa, que es el punto.
 */
const PAGINAS = ['copywriting', 'video', 'image', 'competitor-spy'] as const;

/** LA FUENTE DE VERDAD, la misma que leen las landings: cerrada en Esencial Y ya vendida. */
const seVendeEnPro = (f: FuncionSoloPro): boolean =>
  (FUNCIONES_SOLO_PRO as readonly string[]).includes(f) && !FUNCIONES_TODAVIA_NO_VENDIDAS.includes(f);

const de = (slug: string): Landing => {
  const l = LANDINGS_COMPETENCIA.find((x) => x.slug === slug);
  assert.ok(l, `falta la landing /vsl/${slug} en el registro`);
  return l;
};

/** Lo que se lee: sin etiquetas y con las entidades de vuelta, como en tests/vsl-landings-competencia.test.ts. */
const plano = (s: string): string => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
  .replace(/\s+/g, ' ').trim();

/**
 * EL CUERPO DE LA PÁGINA: lo que esta landing promete, sin el marco del sitio ni los placeholders (ver la cabecera). Se
 * recorta sobre el HTML, que es donde están los límites: del `<h1>` al `<footer class="…-pie">`.
 * ⚠️ Los `<footer>` sueltos de /vsl/copywriting (los van las piezas de Hormozi replicadas, dentro del cuerpo) no sirven de
 *    límite: por eso se busca el que tiene clase `-pie`, que es el de la landing.
 */
function cuerpoDe(l: Landing): string {
  const crudo = renderToStaticMarkup(createElement(LandingCompetencia, { landing: l }))
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    // Los recuadros de «Aquí falta la animación»: un <div class="mk-falta"> sin <div> adentro (FaltaAnimacion.tsx).
    .replace(/<div[^>]*class="mk-falta"[\s\S]*?<\/div>/g, ' ');
  const arranca = crudo.indexOf('<h1');
  assert.notEqual(arranca, -1, `/vsl/${l.slug}: la página no dibuja ningún <h1>`);
  const pie = /<footer[^>]*class="[^"]*-pie\b/.exec(crudo);
  assert.ok(pie, `/vsl/${l.slug}: no se encontró el pie de la landing (<footer class="…-pie">) para cortar el marco del sitio`);
  const texto = plano(crudo.slice(arranca, pie.index));
  // Las preguntas de la portada, que el registro le pone a todo bloque `preguntas`: no son de esta página.
  return PREGUNTAS_SITIO
    .reduce((t, q) => t.split(plano(q.p)).join(' ').split(plano(q.r)).join(' '), texto)
    .replace(/\s+/g, ' ');
}

/**
 * ¿El aviso CALIFICA a esta promesa? No alcanza que esté en la página: tiene que estar pegado, porque una tarjeta mezcla lo
 * cerrado con lo abierto («Pone los subtítulos» + el B-roll: los subtítulos son de los dos planes, el B-roll es de Pro) y un
 * aviso al final de la tarjeta se leería como si fuera de las dos cosas.
 * ⚠️ POR DISTANCIA EN CARACTERES NO SE PUEDE: las dos frases de esa tarjeta están a 90 caracteres. Se mide en FRASES: el aviso
 *    vale si está en la misma frase que la promesa o en la que sigue (el molde de ./competitor-spy.ts cuelga el «Con MaKo Pro»
 *    como frase aparte, y el de ./crm.ts lo pone entre paréntesis en la misma). Dos frases después ya es de otra cosa.
 * ⚠️ Y SE MIRA SÓLO HACIA ADELANTE, a propósito: un aviso ANTERIOR es del párrafo de arriba. Si se mirara hacia atrás, el
 *    «Con MaKo Pro» con el que cierra la tarjeta 1 de /vsl/video taparía los subtítulos de la tarjeta 2, que son abiertos.
 */
const FRASES = 1;
const frasesEntre = (texto: string, desde: number, hasta: number): number =>
  (texto.slice(desde, hasta).match(/\.\s/g) ?? []).length;

/**
 * TODO SE BUSCA SIN DISTINGUIR MAYÚSCULAS, Y ESTO NO ES UN DETALLE (15/11/2026). Con `indexOf` a secas el barrido era
 * SENSIBLE A LAS MAYÚSCULAS, y así se le escapó una promesa de Pro entera: `HUELLAS['ia-editores']` declara `Con «Editar»`
 * y la tarjeta 1 de «MaKo lo diseña contigo» (app/vsl/_competencia/image.ts) escribe `con «Editar»`, con minúscula porque
 * va a mitad de frase. Una letra, y el test daba verde con un cliente de US$47 leyendo que puede «Editar» un ejemplo.
 * MEDIDO ANTES DE CONFIAR EN EL CAMBIO: comparando sin distinguir mayúsculas TODAS las palabras de `HUELLAS` sobre las tres
 * páginas de entonces y sus dos textos de Google, las apariciones pasan de 31 a 32 — hay EXACTAMENTE UNA que se ve sólo
 * así, y es esa. O sea: el arreglo no afloja nada en otro lado, descubre justo la que faltaba.
 * ⚠️ Se hace con un RegExp y no con `toLowerCase()` porque los índices tienen que ser los del texto ORIGINAL: `frasesEntre`
 *    y los recortes de los mensajes miden sobre él, y `toLowerCase()` puede cambiar el largo de una cadena.
 * ⚠️ Y el aviso se busca igual, sin distinguir: un «con MaKo Pro» tipeado a mano en minúscula tiene que contar como aviso
 *    puesto, para que la guarda del aviso suelto lo vea.
 */
const posiciones = (texto: string, aguja: string): number[] => {
  if (aguja.length === 0) return [];
  const re = new RegExp(aguja.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const out: number[] = [];
  for (let m = re.exec(texto); m !== null; m = re.exec(texto)) out.push(m.index);
  return out;
};

const avisoDesde = (texto: string, i: number): boolean => {
  const j = posiciones(texto, MARCA).find((p) => p >= i);
  return j !== undefined && frasesEntre(texto, i, j) <= FRASES;
};
function avisoJuntoA(texto: string, ancla: string): boolean {
  const donde = posiciones(texto, ancla);
  assert.notEqual(donde.length, 0, `la página ya no dice «${ancla}»: el ancla de este test quedó vieja`);
  return donde.some((i) => avisoDesde(texto, i));
}

/**
 * EL TITULAR DE UN BLOQUE NO LLEVA EL AVISO ADENTRO: es el titular de la referencia, con su escala y sus <em> medidos
 * (docs/diseno/landings-competencia/), y se lee con la BAJADA que va debajo, en el mismo bloque. Así que una promesa que cae
 * dentro de un `titulo` se mide contra la `bajada` de ESE bloque, no por frases. Son dos lugares hoy: el <h1> de
 * /vsl/copywriting («N referentes del marketing, instalados en tu IA», la bajada lo aclara a 4 frases) y el título «Dos
 * piezas reales de Alex Hormozi, replicadas».
 * ⚠️ Esto NO afloja la tarjeta de los subtítulos: ahí la promesa está en el `titulo` de un ITEM, no del bloque.
 * Un titular que el diseño no dibuja tal cual (el «Lo que trae Image hoy» de /vsl/image, que su diseño reescribe) no se
 * encuentra y entonces no afloja nada: su promesa se mide por frases, que es lo más estricto.
 * ⚠️ Y POR ESO ESTE `indexOf` SÍ DISTINGUE MAYÚSCULAS, al revés del barrido: encontrar un titular AFLOJA la medida (pasa de
 *    «el aviso a una frase» a «lo aclara la bajada del bloque»), así que buscarlo sin distinguir puede volver blanda una
 *    promesa que hoy se mide estricta. No encontrarlo nunca afloja; encontrarlo de más, sí.
 */
type ConTitulo = Extract<Bloque, { titulo: string }>;
type Titular = { texto: string; desde: number; aclarado: boolean };
const titularesDe = (l: Landing, cuerpo: string): Titular[] => l.bloques
  .filter((b): b is ConTitulo => 'titulo' in b && typeof b.titulo === 'string' && b.titulo.length > 0)
  .map((b) => ({
    texto: plano(b.titulo),
    desde: cuerpo.indexOf(plano(b.titulo)),
    aclarado: 'bajada' in b && typeof b.bajada === 'string' ? plano(b.bajada).includes(MARCA) : false,
  }))
  .filter((t) => t.desde !== -1);

/**
 * CON QUÉ PALABRAS NOMBRAN ESTAS TRES PÁGINAS CADA FUNCIÓN CERRADA. Una fila por función, no por lugar: el barrido recorre el
 * texto dibujado buscando estas palabras y exige el aviso en cada lugar donde aparecen. Esto es el único juicio humano del
 * test, y es `Record<FuncionSoloPro, …>`: una función nueva en `FUNCIONES_SOLO_PRO` no compila sin su fila, y sin ella
 * `node --test` tampoco pasa.
 * ⚠️ Las palabras son LAS DE LA FUNCIÓN, no las del lugar: «referentes» (y no «eliges a qué referente seguir») es lo que
 *    encontró las dos promesas del hero que vivían en el archivo de diseño.
 * ⚠️ Y son las del CANDADO, que es angosto (lib/editores-ia-pro.ts dice la lista exacta). «subtítulos», «quitar el ruido»,
 *    «la línea de tiempo», el lienzo, el kit de marca y mirar la biblioteca de carruseles NO están acá: son de los dos planes
 *    y marcarlos sería mentir al revés. El diagnóstico obvio —«la landing del editor vende IA, marcala toda»— es el equivocado.
 */
type Huella = {
  /** Las palabras con las que se la nombra, tal como se LEEN en la página (no como están en el .ts). */
  palabras: readonly string[];
  /** ¿Alguna de las páginas de `PAGINAS` la nombra? Se comprueba en los dos sentidos: si dice que no y aparece, rojo. */
  laNombran: boolean;
  /** Por qué: qué cierra el candado, o de qué landing es si acá no va. */
  porque: string;
};
const HUELLAS: Readonly<Record<FuncionSoloPro, Huella>> = {
  'scraper-whatsapp': {
    palabras: ['grupo de WhatsApp', 'grupos de WhatsApp', 'contactos de un grupo'],
    laNombran: false, porque: 'el scraper se vende en /vsl/crm y /vsl/whatsapp, que lo dicen con su aviso',
  },
  'replicar-landing': {
    palabras: ['su sitio', 'su landing', 'su página de venta'],
    laNombran: true, porque: 'la vende /vsl/competitor-spy, en el título y en el cuerpo de «Copia su sitio» (y /vsl/web-generator, que no se barre)',
  },
  'ia-editores': {
    palabras: ['Edición automática', 'B-roll', 'Clips mágicos', 'equipo de agentes', 'Le escribes el cambio',
      'chat del editor', 'chat de MaKo al lado', 'con MaKo al lado', 'carruseles con IA', 'diseñados con IA',
      'agente de IA', 'Pídelo por chat', 'Con «Editar»'],
    laNombran: true, porque: 'lo que LLAMA A LA IA de un editor: el enjambre, los clips, el B-roll en `elegir` y los dos chats',
  },
  'comunidad': {
    palabras: ['comunidad', 'tus alumnos'],
    laNombran: false, porque: 'el Classroom se vende en /vsl/mako y en la tabla de /planes',
  },
  'setter-ia': {
    palabras: ['setter'],
    laNombran: false, porque: 'el setter se vende en /vsl/whatsapp y /vsl/seguimiento',
  },
  'piloto-redes': {
    palabras: ['piloto automático'],
    laNombran: false, porque: 'los pilotos de Instagram y YouTube se venden en /vsl/ads y /vsl/mako',
  },
  'ai-avatar': {
    palabras: ['avatar', 'personaje con IA'],
    laNombran: true, porque: 'cerrado en Esencial y TODAVÍA sin vender (`AI_AVATAR_SE_VENDE`): hoy estas palabras NO pueden llevar aviso',
  },
  'replicar-guion': {
    // `Replicas su` entró el 15/11/2026 con /vsl/competitor-spy: su tarjeta «Su guion, con tu oferta» dice «Replicas su reel»,
    // que ninguna de las otras tres palabras agarraba, y por eso esa promesa no tenía guarda. Es angosta a propósito
    // (replicar algo DE OTRO): «Replica lo que funciona» y «replicarlos con tu mensaje», de /vsl/video, son el outlier del
    // editor, que NO tiene candado (`rutaReplicar`), y no pegan con ella.
    palabras: ['«Replicar»', 'Al replicar', 'replicadas', 'Replicas su'],
    laNombran: true, porque: 'replicar el guion de otro (lib/copywriter/replica-candado.ts); escribir desde cero sigue abierto',
  },
  'chat-referentes': {
    palabras: ['referentes', 'referente seguir'],
    laNombran: true, porque: 'el chat con un referente del marketing (lib/asesores/candado.ts)',
  },
};

/** El cuerpo dibujado y los dos textos de Google de una página, que es TODO lo que alguien lee antes de pagar. */
type Lugar = { donde: string; texto: string; titulares: Titular[] };
function lugaresDe(slug: string): Lugar[] {
  const l = de(slug);
  const cuerpo = cuerpoDe(l);
  const meta = metadataDeLanding(l);
  return [
    { donde: `/vsl/${slug}`, texto: cuerpo, titulares: titularesDe(l, cuerpo) },
    // El metaTitle y el metaDesc no se dibujan: los sirve la ruta, y son lo primero que lee alguien que todavía no entró.
    { donde: `/vsl/${slug}, el título de Google`, texto: String(meta.title), titulares: [] },
    { donde: `/vsl/${slug}, la descripción de Google`, texto: String(meta.description), titulares: [] },
  ];
}
const TODOS: Lugar[] = PAGINAS.flatMap((slug) => lugaresDe(slug));

/** Cada aparición de una palabra de `f`, con si el aviso la califica. */
type Aparicion = { donde: string; palabra: string; desde: number; avisada: boolean; enTitular: boolean };
function aparicionesDe(f: FuncionSoloPro): Aparicion[] {
  const out: Aparicion[] = [];
  // Sin fila no hay barrido, y el que lo dice es el primer test: los demás no vuelven a gritar lo mismo (una función nueva
  // tiene que dar UN rojo con su diagnóstico, no siete rojos encima).
  if (!HUELLAS[f]) return out;
  for (const lugar of TODOS) {
    for (const palabra of HUELLAS[f].palabras) {
      for (const i of posiciones(lugar.texto, palabra)) {
        const t = lugar.titulares.find((x) => i >= x.desde && i < x.desde + x.texto.length);
        out.push({ donde: lugar.donde, palabra, desde: i, avisada: t ? t.aclarado : avisoDesde(lugar.texto, i), enTitular: !!t });
      }
    }
  }
  return out;
}

// ── LA GUARDA DE COBERTURA: lo que antes era «PROMESAS.length >= 14» y no medía nada ────────────────────────────────────
// Esto es lo que se pone rojo EL DÍA QUE SE CIERRE LA FUNCIÓN SIGUIENTE, sin que nadie toque este archivo: se recorre
// `FUNCIONES_SOLO_PRO` (la tabla, no una lista de acá) y cada clave tiene que traer su fila. El typecheck lo pide también
// (`Record<FuncionSoloPro, Huella>`), y hace falta: node --test no ve la exhaustividad de un Record.
test('toda función cerrada en Esencial tiene declarado cómo la nombran estas páginas', () => {
  for (const f of FUNCIONES_SOLO_PRO) {
    assert.ok(
      HUELLAS[f],
      `«${f}» se cerró en Esencial (lib/topes-plan.ts, FUNCIONES_SOLO_PRO) y este test no sabe con qué palabras la nombran ` +
      `las páginas de PAGINAS (hoy copywriting, video, image y competitor-spy). Agregá su fila en HUELLAS: las palabras, ` +
      `si alguna de ellas la nombra ` +
      `(se comprueba) y por qué. Si estas páginas no la venden, va con laNombran: false y sus palabras no pueden aparecer.`,
    );
    assert.ok(HUELLAS[f].palabras.length > 0, `«${f}»: la fila de HUELLAS no tiene ni una palabra, así que no barre nada`);
    // Y ninguna vacía, pero NO por lo que decía acá (15/11/2026): `posiciones` arranca con `if (aguja.length === 0)
    // return []`, así que una palabra vacía no pega en NINGUNA posición. Es peor que pegar en todas: la fila declara que
    // esta página nombra la función y el barrido no busca nada, o sea cobertura de mentira y ni un rojo.
    for (const w of HUELLAS[f].palabras) assert.ok(w.length > 0, `«${f}»: HUELLAS tiene una palabra vacía, que pega en todas partes`);
    assert.ok(HUELLAS[f].porque.length > 0, `«${f}»: la fila de HUELLAS no dice por qué`);
    // Su nombre de venta, que es lo que la tabla de /planes pone en la fila: sin él no se puede cruzar con la vitrina.
    assert.ok(NOMBRE_FUNCION_PRO[f], `«${f}» no tiene nombre de venta en lib/planes-comparacion.ts (NOMBRE_FUNCION_PRO)`);
  }
  // Y al revés: una fila que sobra es una función que se ABRIÓ y quedó la fila colgada, prometiendo un barrido que ya no va.
  for (const f of Object.keys(HUELLAS) as FuncionSoloPro[]) {
    assert.ok(
      (FUNCIONES_SOLO_PRO as readonly string[]).includes(f),
      `HUELLAS tiene la fila de «${f}», que ya NO está cerrada en Esencial: sacala (y revisá que la landing dejó de avisar)`,
    );
  }
});

// ── EL BARRIDO ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('cada lugar donde estas páginas nombran una función cerrada dice de qué plan es', () => {
  for (const f of FUNCIONES_SOLO_PRO) {
    const esperado = seVendeEnPro(f);
    for (const a of aparicionesDe(f)) {
      assert.equal(
        a.avisada,
        esperado,
        esperado
          ? `${a.donde}: dice «${a.palabra}» y no dice que «${f}» es de MaKo Pro` +
            (a.enTitular
              ? ` (está en un titular, así que lo tiene que aclarar la bajada de ese bloque)`
              : ` — «…${a.desde}: ${TODOS.find((l) => l.donde === a.donde)!.texto.slice(a.desde, a.desde + 90)}…»`)
          : `${a.donde}: le cuelga «${MARCA}» a «${a.palabra}», y «${f}» todavía NO se vende (lib/planes-comparacion.ts, ` +
            `FUNCIONES_TODAVIA_NO_VENDIDAS): decirlo sería empezar a venderla`,
      );
    }
  }
});

// Y que las palabras aparezcan (o no) donde se declaró: así una promesa que se BORRA o se reescribe no apaga el barrido en
// silencio. Es independiente de la tabla de planes: mide el dibujo contra lo declarado.
test('las palabras declaradas aparecen donde se dijo que aparecen, y no donde se dijo que no', () => {
  for (const f of FUNCIONES_SOLO_PRO) {
    if (!HUELLAS[f]) continue; // lo dice el primer test
    const n = aparicionesDe(f).length;
    assert.equal(
      n > 0,
      HUELLAS[f].laNombran,
      HUELLAS[f].laNombran
        ? `«${f}»: HUELLAS dice que estas páginas la nombran (${HUELLAS[f].porque}) y no apareció ninguna de sus palabras ` +
          `[${HUELLAS[f].palabras.join(' · ')}]: o la promesa se reescribió, o se cayó, o las palabras quedaron viejas`
        : `«${f}»: HUELLAS dice que acá no va (${HUELLAS[f].porque}) y aparece ${n} ${n === 1 ? 'vez' : 'veces'}: ` +
          `si estas páginas empezaron a venderla, su fila va con laNombran: true y le toca aviso`,
    );
  }
});

/**
 * LO QUE EL CANDADO NO CIERRA, y por eso NO puede llevar el aviso (lib/editores-ia-pro.ts dice la lista exacta). Cada ancla es
 * una promesa que un Esencial SÍ puede cumplir: si alguien le cuelga un «Con MaKo Pro», esto se pone rojo. El ancla también
 * tiene que seguir existiendo, así que una promesa abierta que se reescribe no pasa en silencio.
 */
const ABIERTAS: ReadonlyArray<{ slug: string; ancla: string; porque: string }> = [
  // La frase ABIERTA del comparador, la que el 15/11/2026 quedó DESPUÉS del aviso: antes el aviso colgaba del final de una
  // lista que mezclaba estas tres con el B-roll, y así las pintaba de Pro. Si vuelve a colgar del final, esto se pone rojo.
  { slug: 'video', ancla: 'Los subtítulos, el volumen y los cortes', porque: 'cortar, subtitular y nivelar el audio a mano corren en el navegador, sin candado' },
  { slug: 'video', ancla: 'lo haces a mano en la línea de tiempo', porque: 'la línea de tiempo no llama a la IA' },
  { slug: 'video', ancla: 'Los subtítulos caen justo cuando dices cada palabra', porque: 'los subtítulos corren en el navegador' },
  { slug: 'video', ancla: 'Quita el ruido de fondo', porque: 'quitar el ruido corre en el navegador' },
  { slug: 'video', ancla: 'videos que funcionan, para', porque: '«Replicar» un outlier del editor arma el proyecto sin candado' },
  { slug: 'image', ancla: 'Convierte tu mejor diseño en una plantilla', porque: 'el lienzo y las plantillas son de los dos planes' },
  { slug: 'image', ancla: 'Subes tu manual de marca una sola vez', porque: 'el kit de marca es de los dos planes' },
  { slug: 'image', ancla: 'Cada texto pasa a ser el nuevo', porque: '`cambiar_textos_diseno_imagen` no pasa por la IA' },
  { slug: 'image', ancla: 'Ordenas por «Mayor outlier»', porque: 'mirar la biblioteca de carruseles no tiene candado' },
];

test('lo que sigue abierto en Esencial no lleva el aviso', () => {
  const cuerpos = new Map(PAGINAS.map((s) => [s as string, cuerpoDe(de(s))]));
  const barrido = FUNCIONES_SOLO_PRO.flatMap((f) => aparicionesDe(f).map((a) => ({ f, ...a })));
  for (const a of ABIERTAS) {
    const texto = cuerpos.get(a.slug)!;
    assert.equal(avisoJuntoA(texto, a.ancla), false, `/vsl/${a.slug}: «${a.ancla}» lleva «${MARCA}» y no debería: ${a.porque}`);
    // Y que las dos listas no se contradigan: si una palabra de una función cerrada cae DENTRO de esta promesa abierta, el
    // barrido le va a pedir el aviso que acá se prohíbe. Pasa el día que alguien declare una palabra demasiado ancha.
    const desde = texto.indexOf(a.ancla);
    const choca = barrido.find((x) => x.donde === `/vsl/${a.slug}` && x.desde >= desde && x.desde < desde + a.ancla.length);
    assert.equal(choca, undefined, `/vsl/${a.slug}: «${a.ancla}» es de los dos planes y la palabra «${choca?.palabra}» de ` +
      `«${choca?.f}» cae adentro: las dos listas se contradicen (angostá la palabra en HUELLAS)`);
  }
});

// La guarda contra el aviso suelto: cada «Con MaKo Pro» DIBUJADO tiene que estar reclamado por una palabra de una función que
// se vende. Si aparece uno de más —escrito a mano en otra sección, o pegado a algo abierto— no lo reclama nadie. Es la
// dirección contraria al barrido, y no pasa por `seVendeEnPro` de este lado: cuenta lo que hay en el dibujo.
test('no hay ningún «Con MaKo Pro» de más en estas páginas', () => {
  const reclamados = new Map<string, Set<number>>();
  for (const f of FUNCIONES_SOLO_PRO) {
    if (!seVendeEnPro(f)) continue;
    for (const a of aparicionesDe(f)) {
      const texto = TODOS.find((l) => l.donde === a.donde)!.texto;
      for (const j of posiciones(texto, MARCA)) {
        const cerca = a.enTitular ? false : j >= a.desde && frasesEntre(texto, a.desde, j) <= FRASES;
        if (cerca) {
          if (!reclamados.has(a.donde)) reclamados.set(a.donde, new Set());
          reclamados.get(a.donde)!.add(j);
        }
      }
    }
  }
  for (const lugar of TODOS) {
    // Un aviso dentro de un titular lo pone el propio titular (el molde entre paréntesis): también cuenta como reclamado.
    const enTitular = new Set<number>();
    for (const t of lugar.titulares) {
      for (const j of posiciones(lugar.texto, MARCA)) if (j >= t.desde && j < t.desde + t.texto.length) enTitular.add(j);
    }
    for (const j of posiciones(lugar.texto, MARCA)) {
      assert.ok(
        reclamados.get(lugar.donde)?.has(j) || enTitular.has(j),
        `${lugar.donde}: hay un «${MARCA}» suelto en «…${lugar.texto.slice(Math.max(0, j - 130), j + 15)}…» — no hay ninguna ` +
        `promesa cerrada a menos de ${FRASES + 1} frase(s) antes, así que califica a algo que SÍ está en los dos planes`,
      );
    }
  }
});

test('el texto que se lee en Google promete lo mismo que la página', () => {
  for (const slug of PAGINAS) {
    const meta = metadataDeLanding(de(slug));
    // El de Open Graph es el mismo texto: si se separan, uno de los dos queda sin el aviso.
    assert.equal(meta.openGraph?.title, meta.title, `/vsl/${slug}: el título de Open Graph no es el de la pestaña`);
    assert.equal(meta.openGraph?.description, meta.description, `/vsl/${slug}: la descripción de Open Graph no es la de la pestaña`);
  }
  // Y LO QUE EL HERO PROMETE, EL TEXTO DE GOOGLE LO TIENE QUE PROMETER TAMBIÉN: es el mismo pitch, y si uno nombra una
  // función cerrada que el otro no, el que la nombra queda sin su mitad del aviso. Acá se escapó la primera vez, porque el
  // metaTitle y el metaDesc NO SE DIBUJAN: un barrido que sólo mire el HTML los deja pasar.
  // ⚠️ Es en un solo sentido (hero → Google) y sobre title + metaDesc juntos: el metaTitle de /vsl/video («de la idea al
  //    video listo») y el de /vsl/image («en tu versión editable») no nombran nada cerrado a propósito, y el aviso de los dos
  //    va en el metaDesc. El de /vsl/image es el más flojo de los tres: queda anotado para Martín.
  for (const slug of PAGINAS) {
    const l = de(slug);
    const h = l.bloques.find((b) => b.tipo === 'hero');
    assert.ok(h && h.tipo === 'hero', `/vsl/${slug}: la landing no abre con un hero`);
    const pitch = plano([h.titulo, h.bajada, ...(h.puntos ?? [])].join(' '));
    const google = `${l.metaTitle} ### ${l.metaDesc}`;
    for (const f of FUNCIONES_SOLO_PRO) {
      if (!HUELLAS[f]) continue; // lo dice el primer test
      const enElHero = HUELLAS[f].palabras.some((w) => posiciones(pitch, w).length > 0);
      if (!enElHero) continue;
      assert.ok(
        HUELLAS[f].palabras.some((w) => posiciones(google, w).length > 0),
        `/vsl/${slug}: el hero promete «${f}» y el texto de Google (metaTitle + metaDesc) no lo nombra, así que ese texto ` +
        `no lleva su «${MARCA}»: las palabras que busca son [${HUELLAS[f].palabras.join(' · ')}]`,
      );
    }
  }
});

// EL CRUCE CON LA TABLA DE /planes, que es el único oráculo INDEPENDIENTE que hay: `noIncluyeDe('completo')` lo arma
// `filasDeComparacion()` por su propio camino (grupo por grupo, con `soloPro` y `celdaDeCapa`), y tiene que decir exactamente
// lo mismo que la landing. Si la vitrina deja de nombrar una función que la landing marca —o al revés—, uno de los dos miente.
test('la landing y la tabla de /planes dicen lo mismo de cada función', () => {
  const noIncluyeEsencial = noIncluyeDe('completo');
  for (const f of FUNCIONES_SOLO_PRO) {
    if (!NOMBRE_FUNCION_PRO[f]) continue; // lo dice el primer test
    assert.equal(
      noIncluyeEsencial.includes(NOMBRE_FUNCION_PRO[f]),
      seVendeEnPro(f),
      seVendeEnPro(f)
        ? `la landing marca «${f}» como de Pro y la tabla de /planes no la nombra en lo que Esencial no incluye («${NOMBRE_FUNCION_PRO[f]}»)`
        : `la tabla de /planes vende «${NOMBRE_FUNCION_PRO[f]}» y la landing no la marca: o ya se vende y falta el aviso, o la fila sobra`,
    );
  }
});

// POR QUÉ EL AVISO VA EN EL TEXTO Y NO EN UNA COLUMNA: estas páginas no dibujan las tarjetas de planes (`TarjetasPlanes`,
// app/planes/Tarjetas.tsx, que es lo que usan la portada y /planes con sus clases `mkpl-`). Sin ellas, el texto es la ÚNICA
// señal de plan, y por eso tenía que decirlo. Si algún día las llevan, el aviso del titular se puede repensar: esto avisa.
// ⚠️ No se mide buscando «US$»: las preguntas de la portada nombran el precio de GoHighLevel y de CapCut, y la barra del
//    sitio lleva el link «Precios». Lo que se mide es la tarjeta de planes misma.
test('estas páginas siguen sin tarjetas de planes, así que el aviso del texto es la única señal', () => {
  for (const slug of PAGINAS) {
    const html = renderToStaticMarkup(createElement(LandingCompetencia, { landing: de(slug) }));
    assert.doesNotMatch(html, /class="[^"]*\bmkpl-(?:bloques|card|periodo)\b/, `/vsl/${slug}: apareció una tarjeta de planes`);
  }
});
