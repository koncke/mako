// =============================================================================
// Competitors Spy — las reglas que convierten «no sé» en un dato inventado
// =============================================================================
// Casi todas las trampas de esta tab tienen la misma forma: **una fuente que devuelve otra cosa en
// vez de un error**, y un `?? 0` o un `parseInt` que la convierte en un número que nos inventamos
// nosotros. Este archivo mira que no pase, y mira la MIGRACIÓN además del código, porque la columna
// con `default 0` es la que vuelve a meter el bug después de que el código esté bien.
//
// Lo que cada bloque cuida, en orden de cuánto cuesta equivocarse:
//   1. un contador ausente no es cero;
//   2. un tramo de la Ad Library no es un número;
//   3. una métrica derivada no se calcula sin la enmienda III.L de YouTube;
//   4. las dos retenciones son dos, y van en columnas separadas;
//   5. la Ad Library no cubre América Latina, y se pregunta ANTES de llamar;
//   6. la pantalla no pelea con nadie, y `search.list` no se nombra en ningún lado.
//
// ⚠️ TODO LO QUE LEE UN FUENTE NORMALIZA EL CRLF ANTES DE BUSCAR. En este clon los archivos están en
// LF y en un worktree o en GitHub Actions llegan en CRLF: un test que corta por `'\n}\n'` o que
// busca un bloque multilínea pasa en un lado y falla en el otro sobre el MISMO archivo. Ya le pasó
// a cuatro tests de este repo el 06/10/2026 (AGENTS.md).
//
// ⚠️ Y LOS GUARDS QUE LEEN FUENTE AFIRMAN LO QUE CUIDAN, cada cosa en su propio assert y con un
// mensaje que dice QUÉ SE PERDIÓ — nunca una línea literal copiada del archivo. Una línea literal
// se pone roja cuando alguien le cambia un espacio, con el código perfecto.
//
// Verificado ROMPIÉNDOLO (31/10/2026, de a UNA rotura por vez, restaurando de una copia del
// scratchpad —nunca con `git checkout --`— y comprobando por hash que el archivo volvió igual).
// Base 17 pasan / 0 fallan, y cada rotura cayó en el assert que le corresponde:
//   · `contadorPublicado` devolviendo `0` en vez de `null` cuando el campo no vino  → 16 / 1
//   · `dibujarTramo` devolviendo el promedio de los extremos en vez del texto       → 16 / 1
//   · `etapaDeTendencia(null)` devolviendo `'test-nuevo'` en vez de `null`          → 16 / 1
//   · `RETENCION_TEXTO_DIAS` puesto en 36 * 30 (las dos retenciones iguales)        → 16 / 1
//   · `adLibraryCubreComercial` devolviendo `true` para todos                       → 16 / 1
//   · una columna `foto text` agregada a `spy_competidores` en la migración 0359    → 16 / 1
//   · `vistas bigint default 0` en `spy_piezas`                                     → 16 / 1
//   · `'spy_piezas'` sacado de TENANT_TABLES                                        → 16 / 1
//   · una llamada a `search` agregada al lector de canal                            → 16 / 1
//
// ⚠️ Y DOS DE ESTOS GUARDS SE PUSIERON ROJOS CONTRA CÓDIGO CORRECTO al escribirlos, las dos veces
// por la misma razón: **buscaban una palabra y encontraban su propia explicación.** Uno leía la
// migración con el stripper de comentarios de TypeScript, que no saca los `--` de un `.sql`, y
// encontraba la frase «sin `no_megusta`» de la cabecera; el otro buscaba el texto `search.list` y
// encontraba la constante que lo documentaba. Los dos se arreglaron mirando lo que el código HACE
// (las columnas declaradas, las rutas que se llaman) en vez de lo que dice.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AVISO_CORTE_VIEWCOUNT, CORTE_VIEWCOUNT, ENMIENDA_III_L, ETAPAS_TENDENCIA, FALTA_LA_ENMIENDA,
  LEYENDA_DERIVADA, PALABRAS_DE_DUELO, PAISES_CON_ANUNCIOS_COMERCIALES, RETENCION_METRICAS_MESES,
  RETENCION_TEXTO_DIAS, SIN_ANUNCIOS_EN_ESTE_PAIS, adLibraryCubreComercial, contadorPublicado,
  cruzaElCorte, diasCorriendo, dibujarContador, dibujarTramo, etapaDeTendencia, leerTramo,
  metricasVencidas, multiploDelCanal, promedioDeLoPublicado, textoVencido, vistasPorHora,
} from '../lib/spy-reglas';
import { RUTAS_PERMITIDAS } from '../lib/spy-youtube';

// `fileURLToPath` y no `.pathname`: en Windows deja `C:/…` y en Linux una ruta RELATIVA, y los
// tests también corren en GitHub Actions (AGENTS.md).
const RAIZ = fileURLToPath(new URL('..', import.meta.url));
/** El fuente con los fines de línea normalizados: lo único que se compara es el contenido. */
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string =>
  src.replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1').replace(/(^|[^A-Za-z0-9_])\/\*[\s\S]*?\*\//g, '$1');
/**
 * Un `.sql` comenta con `--`, no con `//`.
 *
 * ⚠️ Sin esto el guard encuentra SU PROPIA EXPLICACIÓN en la cabecera de la migración y se pone rojo
 * contra un esquema correcto: pasó al escribir este archivo, con el comentario que dice «sin
 * `no_megusta`, que YouTube no devuelve». Un chequeo que marca de más manda a rehacer trabajo que
 * estaba bien.
 */
const sinComentariosSql = (src: string): string => src.replace(/--[^\n]*/g, '');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Un contador ausente no es cero
// ─────────────────────────────────────────────────────────────────────────────

test('un contador que la fuente no publicó vuelve null, nunca 0', () => {
  // Las dos formas en que la ausencia llega: el campo que Meta OMITE cuando el dueño oculta los
  // likes, y el `dislikeCount` que YouTube dejó de devolver el 13/12/2021.
  assert.equal(contadorPublicado(undefined), null, 'un campo que no vino se leyó como un número');
  assert.equal(contadorPublicado(null), null, 'un null de la fuente se leyó como un número');
  assert.equal(contadorPublicado({}), null, 'un objeto se leyó como un número');
  assert.equal(contadorPublicado(''), null, 'un texto vacío se leyó como un número');
  // Y el cero que la fuente SÍ publicó se conserva: es un dato, no una ausencia.
  assert.equal(contadorPublicado(0), 0, 'un cero publicado se perdió');
  assert.equal(contadorPublicado('0'), 0, 'un cero publicado como texto se perdió');
  // Las dos APIs devuelven los contadores de `videos.list` como texto.
  assert.equal(contadorPublicado('1234'), 1234, 'un contador que vino como texto no se leyó');
  assert.equal(contadorPublicado(1234), 1234, 'un contador numérico no se leyó');
  // Un TRAMO no es un contador: va por `leerTramo`. Si pasara por acá, `parseInt` daría 1.
  assert.equal(contadorPublicado('1K-5K'), null, 'un tramo de la Ad Library se leyó como un contador');
  assert.equal(contadorPublicado('<100'), null, 'un tramo abierto se leyó como un contador');
  assert.equal(contadorPublicado(-5), null, 'un negativo pasó como contador');
});

test('la pantalla distingue «no lo publica» de «cero»', () => {
  const ausente = dibujarContador(null);
  const cero = dibujarContador(0);
  assert.notEqual(ausente, cero, 'un contador ausente y un cero se dibujan igual: la pantalla miente sobre uno de los dos');
  assert.equal(cero, '0', 'un cero medido dejó de decirse como cero');
  assert.match(ausente, /no lo publica/i, 'lo que la fuente no publica dejó de decirlo con palabras');
});

test('un promedio con un valor ausente no se calcula', () => {
  assert.equal(promedioDeLoPublicado([10, 20, 30]), 20, 'un promedio de valores completos no se calculó');
  assert.equal(promedioDeLoPublicado([10, null, 30]), null, 'se promedió una columna con un valor ausente: el promedio miente hacia arriba');
  assert.equal(promedioDeLoPublicado([]), null, 'se promedió una lista vacía');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Un tramo se dice tramo
// ─────────────────────────────────────────────────────────────────────────────

test('un tramo de la Ad Library conserva su texto y nunca se vuelve un número', () => {
  const r = leerTramo('1K-5K');
  assert.ok(r, 'un tramo con la forma documentada no se reconoció');
  assert.equal(r!.texto, '1K-5K', 'el tramo perdió el texto con el que lo dijo la fuente');
  assert.equal(r!.desde, 1_000, 'el extremo de abajo del tramo no se leyó');
  assert.equal(r!.hasta, 5_000, 'el extremo de arriba del tramo no se leyó');
  // Lo que se MUESTRA es el texto, nunca el promedio de los extremos: un eje con «3.000» donde la
  // fuente dijo «1K-5K» es un número que nos inventamos nosotros.
  assert.equal(dibujarTramo(r), '1K-5K', 'un tramo se dibujó como un punto en vez de como un rango');
  assert.match(dibujarTramo(null), /no lo publica/i, 'un tramo ausente se dibujó como un cero o un vacío');
});

test('los tramos abiertos y el que la doc de Meta se saltea también se leen', () => {
  const menor = leerTramo('<100');
  assert.equal(menor?.hasta, 100, 'el tramo «menor que» no se leyó');
  assert.equal(menor?.texto, '<100', 'el tramo «menor que» perdió su texto');
  const mayor = leerTramo('>1M');
  assert.equal(mayor?.desde, 1_000_000, 'el tramo «mayor que» no se leyó');
  assert.equal(mayor?.hasta, null, 'un tramo abierto hacia arriba se cerró con un número');
  // ⚠️ `500K-1M` NO FIGURA en la lista de tramos de la doc de Meta y la API lo devuelve igual. Por
  // eso el lector parsea la FORMA y no compara contra una lista cerrada, que lo dejaría afuera.
  const salteado = leerTramo('500K-1M');
  assert.ok(salteado, 'el tramo 500K-1M, que la doc de Meta se saltea, dejó de leerse');
  assert.equal(salteado!.desde, 500_000, 'el tramo que la doc se saltea perdió su extremo de abajo');
  assert.equal(salteado!.hasta, 1_000_000, 'el tramo que la doc se saltea perdió su extremo de arriba');
});

test('lo que no es un tramo no se adivina', () => {
  for (const basura of ['', 'muchísimo', 'K-M', '-', null, undefined, 42]) {
    assert.equal(leerTramo(basura), null, `se inventó un tramo a partir de ${JSON.stringify(basura)}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Las métricas derivadas y la enmienda III.L
// ─────────────────────────────────────────────────────────────────────────────

test('sin la enmienda III.L no se calcula ninguna métrica derivada', () => {
  // III.E.4.h de los Developer Policies de YouTube prohíbe «create new or derived data or metrics» y
  // nombra el caso: «a score that factors in likes, total views». El VPH y el outlier son eso.
  assert.equal(ENMIENDA_III_L, false, 'la enmienda quedó marcada como aceptada: si de verdad se aceptó, va con su fecha en docs/hallazgos-competitors-spy.md');
  const haceDosDias = new Date(Date.now() - 2 * 86_400_000).toISOString();
  assert.equal(vistasPorHora(10_000, haceDosDias), null, 'se calcularon vistas por hora sin el permiso que las habilita');
  assert.equal(multiploDelCanal(10_000, [1_000, 1_200, 900]), null, 'se calculó el outlier de un canal sin el permiso que lo habilita');
  // Y lo que la pantalla pone en su lugar dice que falta un trámite, no «0» ni «—».
  assert.ok(FALTA_LA_ENMIENDA.length > 40, 'el aviso de que falta el trámite se quedó sin explicación');
  assert.match(LEYENDA_DERIVADA, /MaKo/, 'la leyenda dejó de declarar que el cálculo es nuestro, que es la condición del permiso');
  assert.doesNotMatch(LEYENDA_DERIVADA, /dato de YouTube\b(?!.)/i, 'la leyenda presenta el cálculo como un dato del proveedor');
});

test('el corte del viewCount del 24/8/2026 se marca en toda serie que lo cruce', () => {
  assert.equal(CORTE_VIEWCOUNT, '2026-08-24', 'cambió la fecha del corte sin que cambie lo que YouTube hizo');
  assert.equal(cruzaElCorte('2026-07-01', '2026-10-01'), true, 'una serie que cruza el corte dejó de marcarse: el salto se lee como un despegue del canal');
  assert.equal(cruzaElCorte('2026-09-01', '2026-10-01'), false, 'una serie entera posterior al corte se marcó de más');
  assert.equal(cruzaElCorte('2026-01-01', '2026-06-01'), false, 'una serie entera anterior al corte se marcó de más');
  assert.equal(cruzaElCorte('no es una fecha', '2026-10-01'), false, 'una fecha ilegible se tomó por un cruce');
  assert.match(AVISO_CORTE_VIEWCOUNT, /vistas/i, 'el aviso del corte dejó de decir de qué habla');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Dos retenciones, no una
// ─────────────────────────────────────────────────────────────────────────────

test('el texto y las métricas de un tercero tienen plazos DISTINTOS', () => {
  // III.E.4.b: los datos de un tercero son «Non-Authorized Data» y no se guardan más de 30 días. La
  // enmienda III.L sube las MÉTRICAS a 36 meses y deja el texto donde estaba, textual: «Other data
  // (such as video titles, creator names, descriptions, and comment text) must still follow the
  // 30-day refresh and deletion policy».
  assert.equal(RETENCION_TEXTO_DIAS, 30, 'cambió el plazo del texto de un tercero, que la política fija en 30 días');
  assert.equal(RETENCION_METRICAS_MESES, 36, 'cambió el plazo de las métricas, que la enmienda III.L fija en 36 meses');
  assert.notEqual(RETENCION_TEXTO_DIAS, RETENCION_METRICAS_MESES * 30, 'los dos plazos quedaron iguales: o se borra una métrica que se podía guardar tres años, o se guarda tres años un título que había que borrar en 30 días');
  const hace29 = new Date(Date.now() - 29 * 86_400_000).toISOString();
  const hace31 = new Date(Date.now() - 31 * 86_400_000).toISOString();
  assert.equal(textoVencido(hace29), false, 'se borró texto que todavía se podía guardar');
  assert.equal(textoVencido(hace31), true, 'se guardó texto de un tercero más de 30 días');
  assert.equal(textoVencido('cualquier cosa'), true, 'una fecha ilegible dejó el texto guardado para siempre');
  // Sin la enmienda, las métricas duran lo mismo que el texto: no se guardan tres años por adelantado.
  assert.equal(metricasVencidas(hace31), true, 'se guardaron métricas más de 30 días sin tener aceptada la enmienda que lo permite');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. La etapa de tendencia: lo único que agregamos sobre mirar a mano
// ─────────────────────────────────────────────────────────────────────────────

test('«no se sabe desde cuándo» no es «es nuevo»', () => {
  // Es el error que esta tab existe para no cometer: una pieza que vimos hoy por primera vez puede
  // llevar un año corriendo, y llamarla «test nuevo» invierte la conclusión que el negocio va a
  // sacar — dejaría de copiar justo lo que al competidor le funciona.
  assert.equal(etapaDeTendencia(null), null, 'una pieza sin fecha declarada se clasificó como un test nuevo');
  assert.equal(diasCorriendo(null), null, 'se contaron días desde una fecha que la fuente no declaró');
  assert.equal(diasCorriendo('no es una fecha'), null, 'una fecha ilegible se tomó por una fecha');
  assert.equal(etapaDeTendencia(0), 'test-nuevo', 'una pieza de hoy dejó de ser un test nuevo');
  assert.equal(etapaDeTendencia(13), 'test-nuevo', 'el corte de los 14 días se movió');
  assert.equal(etapaDeTendencia(14), 'ganando-traccion', 'una pieza de dos semanas dejó de contar como que gana tracción');
  assert.equal(etapaDeTendencia(29), 'ganando-traccion', 'el corte de los 30 días se movió');
  assert.equal(etapaDeTendencia(30), 'probado', 'una pieza de un mes dejó de contar como probada');
  assert.equal(etapaDeTendencia(-1), null, 'una fecha futura produjo una etapa');
  assert.deepEqual([...ETAPAS_TENDENCIA], ['test-nuevo', 'ganando-traccion', 'probado'], 'cambió el juego de etapas sin cambiar lo que significan');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. La Ad Library no cubre América Latina, y se pregunta antes de llamar
// ─────────────────────────────────────────────────────────────────────────────

test('la Ad Library sólo entrega anuncios comerciales de la Unión Europea y el Reino Unido', () => {
  // `ad_type=ALL` NO significa «todos los anuncios»: el enum es temático y la cobertura geográfica
  // es un filtro aparte y fijo. Fuera de la UE y el Reino Unido devuelve sólo política, con HTTP
  // 200 y lista vacía — un vacío que se lee como «este competidor no pauta».
  for (const pais of ['AR', 'MX', 'US', 'BR', 'CO', 'CL', 'UY', 'PY']) {
    assert.equal(adLibraryCubreComercial(pais), false, `se prometieron anuncios comerciales de ${pais}, que la API no entrega`);
  }
  for (const pais of ['ES', 'GB', 'DE', 'FR', 'IT', 'PT', 'IE']) {
    assert.equal(adLibraryCubreComercial(pais), true, `se dejó de pedir anuncios de ${pais}, donde la API sí los entrega`);
  }
  assert.equal(adLibraryCubreComercial('es'), true, 'el país dejó de compararse sin importar la caja');
  assert.equal(adLibraryCubreComercial(''), false, 'un país vacío pasó como cubierto');
  assert.equal(PAISES_CON_ANUNCIOS_COMERCIALES.length, 28, 'cambió la cantidad de países cubiertos: son los 27 de la Unión Europea más el Reino Unido');
  // Y lo que se le dice a quien pide anuncios de un país no cubierto ofrece la salida que SÍ existe.
  assert.match(SIN_ANUNCIOS_EN_ESTE_PAIS, /pega/i, 'el aviso dejó de ofrecer la única vía que existe: que la persona pegue el enlace del anuncio');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. La migración: la columna es lo que vuelve a meter el bug
// ─────────────────────────────────────────────────────────────────────────────

/** Todas las migraciones que tocan las tablas del spy: el guard de la foto las mira a todas. */
function migracionesDelSpy(): string[] {
  const dir = join(RAIZ, 'supabase/migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .filter((sql) => /spy_(competidores|piezas)/.test(sql));
}

test('ninguna migración del spy guarda la FOTO DE PERFIL, que es la que se vería rota', () => {
  // `profile_picture_url` de Instagram es una URL del CDN de Meta que VENCE. No tener la columna es
  // más fuerte que acordarse: un avatar roto semanas después es un defecto que Martín ya marcó dos
  // veces.
  //
  // ⚠️ EL GUARD MIRABA UNA SOLA MIGRACIÓN, y eso lo volvía esquivable sin querer: la columna
  // prohibida podía entrar por la migración siguiente y el test seguía verde. Ahora mira TODAS las
  // del spy.
  const sql = sinComentariosSql(migracionesDelSpy().join('\n'));
  const columnas = [...sql.matchAll(/^\s{2}([a-z_]+)\s+(?:text|bigint|integer|timestamptz|jsonb|text\[\])/gm)].map((m) => m[1]);
  assert.ok(columnas.length > 20, `el lector de columnas de las migraciones dejó de encontrarlas (vio ${columnas.length}): el guard no está mirando nada`);
  const deFoto = columnas.filter((c) => /foto|avatar|picture/.test(c));
  assert.deepEqual(deFoto, [], `apareció una columna donde guardar la foto de perfil, que vence: ${deFoto.join(', ')}`);
});

test('la miniatura de una PIEZA sí se guarda, y se reescribe en cada lectura para que no se pudra', () => {
  // La distinción con la foto de perfil, que es la que justifica la diferencia:
  //   · el avatar se dibuja SIEMPRE, también sobre un competidor que nadie volvió a leer en semanas;
  //   · la miniatura vive en una grilla que se RELEE (`debeLeerAlAbrir` relee la ficha de más de un
  //     día), y `TarjetaPieza` ya esconde la imagen rota con su `onError`.
  // Lo que sostiene esa diferencia es que se REESCRIBA en cada lectura. Si alguien la moviera a los
  // campos que sólo se escriben al insertar, la miniatura quedaría congelada y empezaría a romperse
  // — y el síntoma sería una grilla sin fotos, igual que antes de este cambio pero sin aviso.
  const spy = leer('lib/spy.ts');
  const comun = spy.slice(spy.indexOf('const comun = (v: PiezaVista)'), spy.indexOf('const soloAlInsertar') + 1 || spy.length);
  assert.match(comun, /miniatura: v\.miniatura \?\? null,/, 'la miniatura dejó de escribirse en cada lectura');

  // Y que el mapeo de Instagram la siga copiando: ahí se perdía antes (un reel llegaba sin imagen).
  assert.match(spy, /miniatura: p\.miniatura,/, 'el mapeo de Instagram volvió a tirar la miniatura');

  // La pantalla prefiere la que guardó la fuente y recién después deriva la de YouTube.
  const vista = leer('lib/spy-vista.ts');
  const fn = vista.slice(vista.indexOf('export const miniaturaDePieza'));
  const iPropia = fn.indexOf('p.miniatura');
  const iYoutube = fn.indexOf('i.ytimg.com');
  assert.ok(iPropia > -1 && iYoutube > -1 && iPropia < iYoutube, 'la miniatura propia tiene que ganarle a la derivada de YouTube');
});

test('ningún contador de la migración 0359 lleva «default 0»', () => {
  // Un `default 0` muestra «0 me gusta» sobre una publicación con miles, y nada da error.
  const sql = sinComentariosSql(leer('supabase/migrations/0359_competitors_spy.sql'));
  const conDefaultCero = [...sql.matchAll(/^\s{2}([a-z_]+)\s+(?:bigint|integer)[^,\n]*default\s+0/gim)].map((m) => m[1]);
  assert.deepEqual(conDefaultCero, [], `un contador nació con «default 0»: ausente dejaría de distinguirse de cero en ${conDefaultCero.join(', ')}`);
  // Y los contadores que sí existen están, para que el guard no dé verde sobre una tabla sin columnas.
  for (const col of ['vistas', 'megusta', 'comentarios']) {
    assert.match(sql, new RegExp(`^\\s{2}${col}\\s`, 'm'), `desapareció la columna ${col} de spy_piezas`);
  }
  // `no_megusta` nunca existió a propósito: YouTube no devuelve el campo desde el 13/12/2021 y una
  // columna vacía invita a un `?? 0` que inventa el dato.
  assert.doesNotMatch(sql, /no_megusta|dislike/i, 'apareció una columna para los «no me gusta», que YouTube no devuelve: quedaría vacía e invitaría a un cero inventado');
});

test('la migración 0359 guarda los dos relojes de retención por separado, y los tramos como texto', () => {
  const sql = sinComentariosSql(leer('supabase/migrations/0359_competitors_spy.sql'));
  assert.match(sql, /^\s{2}texto_leido_en\s+timestamptz/m, 'se perdió el reloj del TEXTO: sin él no se sabe qué borrar a los 30 días');
  assert.match(sql, /^\s{2}metricas_leidas_en\s+timestamptz/m, 'se perdió el reloj de las MÉTRICAS: sin él se borra a los 30 días lo que se podía guardar 36 meses');
  // Los tramos son TEXTO. Una columna numérica obligaría a coaccionar, y `parseInt('1K-5K')` es 1.
  for (const col of ['gasto_tramo', 'impresiones_tramo']) {
    assert.match(sql, new RegExp(`^\\s{2}${col}\\s+text`, 'm'), `${col} dejó de ser texto: un tramo guardado como número es un número que nos inventamos`);
  }
  // Y lo que hace que la tab valga: la fecha en que se vio la pieza por PRIMERA vez.
  assert.match(sql, /^\s{2}visto_primera_vez\s+timestamptz\s+not null/m, 'se perdió visto_primera_vez, que es el único dato de esta tab que no se puede conseguir mirando a mano');
});

test('las dos tablas del spy pasan por el proxy de inquilino', () => {
  // Sin esto `getTenantDb()` es PASSTHROUGH —no da error— y la lista de competidores de un negocio
  // muestra la de TODOS. A quién mira un negocio es exactamente lo que no puede salir de su workspace.
  const ws = leer('lib/workspace.ts');
  const set = ws.match(/const TENANT_TABLES = new Set<string>\(\[([\s\S]*?)\]\)/);
  assert.ok(set, 'no se encontró el Set TENANT_TABLES en lib/workspace.ts: el guard no está mirando nada');
  const nombres = [...set![1].replace(/\/\/[^\n]*/g, '').matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
  for (const tabla of ['spy_competidores', 'spy_piezas']) {
    assert.ok(nombres.includes(tabla), `${tabla} salió de TENANT_TABLES: sus consultas dejan de scopearse por workspace y no da ningún error`);
  }
  const inquilino = leer('lib/tablas-de-inquilino.ts');
  for (const tabla of ['spy_competidores', 'spy_piezas']) {
    assert.ok(new RegExp(`'${tabla}'`).test(inquilino), `${tabla} salió de TABLAS_DE_INQUILINO: vaciar o borrar un negocio le dejaría los datos`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. La pantalla no pelea con nadie, y el endpoint prohibido no se nombra
// ─────────────────────────────────────────────────────────────────────────────

test('la pantalla mira el mercado, no ataca a una persona', () => {
  // La política III.L de YouTube prohíbe enmarcar una comparación como «war» o «battle», o como una
  // rivalidad que incite hostigamiento. Se mira el copy, sin los comentarios: los comentarios citan
  // esas palabras para explicar la regla y nadie los lee desde la app.
  for (const archivo of ['app/competitor-spy/SpyApp.tsx', 'app/competitor-spy/TarjetaPieza.tsx', 'app/competitor-spy/GraficoSpy.tsx', 'app/competitor-spy/DetallePieza.tsx']) {
    const copy = sinComentarios(leer(archivo)).toLowerCase();
    assert.ok(copy.length > 500, `${archivo}: después de sacar los comentarios no quedó copy que revisar, así que el guard no miró nada`);
    for (const palabra of PALABRAS_DE_DUELO) {
      assert.ok(!copy.includes(palabra), `${archivo}: la pantalla enmarca el análisis como una pelea («${palabra.trim()}»), que la política III.L de YouTube prohíbe`);
    }
  }
});

test('`search.list` no se usa en ningún lado del spy', () => {
  // Desde el 1/6/2026 tiene su propio balde de 100 LLAMADAS POR DÍA para TODA la app: no es un
  // endpoint caro, es un endpoint que una sola feature con forma de buscador consume entero. El
  // camino es channels.list → playlist de subidas → playlistItems → videos.list en lotes de 50.
  // ⚠️ EL GUARD ENUMERA LAS RUTAS QUE EL CÓDIGO USA; NO BUSCA LA PALABRA «search». La primera
  // versión de este chequeo buscaba el nombre del endpoint y se puso ROJA contra código perfecto:
  // lo que encontraba era la constante que lo documentaba, en el mismo archivo. Un guard que busca
  // una palabra encuentra la documentación; uno que enumera las llamadas encuentra la llamada.
  const lector = sinComentarios(leer('lib/spy-youtube.ts'));
  const rutas = [...lector.matchAll(/traer\(\s*buscar\s*,\s*'([a-zA-Z]+)'/g)].map((m) => m[1]);
  assert.ok(rutas.length >= 3, `el guard no encontró las llamadas a la API (vio ${rutas.length}): no está mirando nada`);
  const deMas = [...new Set(rutas)].filter((r) => !(RUTAS_PERMITIDAS as readonly string[]).includes(r));
  assert.deepEqual(deMas, [], `el lector llama a una ruta que no es del camino que escala: ${deMas.join(', ')}. Con search.list son 100 llamadas por día para TODA la app, no por usuario`);
  for (const paso of RUTAS_PERMITIDAS) {
    assert.ok(rutas.includes(paso), `el lector de canal perdió el paso ${paso}: sin los tres, o no trae nada o vuelve a search.list`);
  }
  // Y que nadie arme la URL a mano, salteándose `traer()`: eso no lo vería la enumeración de arriba.
  for (const archivo of ['lib/spy-youtube.ts', 'lib/spy.ts', 'lib/api-mako/areas/spy.run.ts']) {
    assert.doesNotMatch(sinComentarios(leer(archivo)), /youtube\/v3\/search/,
      `${archivo} arma a mano una URL contra search.list, salteándose el lector`);
  }
  // El playlist de subidas se LEE de la API. Derivarlo cambiando `UC`→`UU` funciona en la mayoría de
  // los canales, y el que falla devuelve una lista vacía que se lee como «no subió nada».
  assert.ok(lector.includes('relatedPlaylists'), 'el playlist de subidas dejó de leerse de la API: derivarlo de UC→UU falla en silencio con una lista vacía');
  assert.doesNotMatch(lector, /replace\(\s*\/\^UC\/|replace\('UC'|slice\(2\)/, 'apareció un atajo que deriva el playlist de subidas del id del canal en vez de leerlo');
});
