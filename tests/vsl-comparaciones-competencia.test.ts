// =============================================================================
// /vsl/comparaciones contra la competencia, app por app (14/11/2026)
// =============================================================================
// Martín (14/11/2026): «no es como la referencia» (beehiiv.com/comparisons): scrolleable, una tabla de lo que la competencia tiene
// o no tiene, comentarios y las tarjetas «MaKo vs X» abajo. Lo que se fija acá:
//   · cada app tiene su logo en disco, su página, su comentario y sus tres «Elige X si»;
//   · cada celda es «si», «no», «?» (sin dato: nunca se muestra como un «no») o un valor corto;
//   · la columna de MaKo sale del CÓDIGO: lo que es sólo de Pro (lib/topes-plan.ts) dice «En Pro» y el precio es el de Esencial;
//   · la página tiene la tabla que se desliza (con sus flechas), las tarjetas y, en cada «MaKo vs X», la tabla de las dos.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComparacionVs } from '../app/vsl/_sitio/Comparaciones';
import { CANDADO_DE_LA_FILA, COMPETIDORES, ELIGE_MAKO_SI, EN_PRO, GRUPOS_MATRIZ, celdaDeMaKo, rutaVs, type ClaveFila } from '../app/vsl/_sitio/competencia';
import { FUNCIONES_SOLO_PRO, TABS_SOLO_PRO, TOPES, type FuncionSoloPro } from '../lib/topes-plan';
import { NOMBRE_FUNCION_PRO, NOMBRE_TAB_PRO, celdaDeCapa, filasDeComparacion } from '../lib/planes-comparacion';

type FilaDeLaTabla = Exclude<ClaveFila, 'precio'>;

const RAIZ = join(import.meta.dirname, '..');

/** Una fila de la tabla, como queda DIBUJADA: «nombre | la celda de MaKo | la celda de la app» (la primera tabla del HTML). */
const filaDibujada = (html: string, nombre: string): string[] => {
  const tabla = html.slice(html.indexOf('<table'), html.indexOf('</table>'));
  const tr = tabla.split(/<tr\b/).find((t) => t.includes(`>${nombre}</th>`)) ?? '';
  return tr.split(/<(?:td|th)\b/).slice(1)
    .map((c) => c.replace(/^[^>]*>/, '').split(/<\/(?:td|th)>/)[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
};

test('cada app: logo en disco, slug de URL, comentario corto y tres «Elige X si»', () => {
  const slugs = new Set<string>();
  for (const c of COMPETIDORES) {
    assert.ok(existsSync(join(RAIZ, 'public', c.logo)), `${c.nombre}: falta ${c.logo}`);
    assert.match(c.slug, /^[a-z0-9-]+$/, `${c.nombre}: slug «${c.slug}»`);
    assert.ok(!slugs.has(c.slug), `${c.slug} repetido`); slugs.add(c.slug);
    assert.equal(rutaVs(c), `/vsl/comparaciones/${c.slug}`);
    assert.ok(c.comentario.length > 20 && c.comentario.split(/\s+/).length <= 22, `${c.nombre}: comentario «${c.comentario}»`);
    assert.equal(c.eligeSi.length, 3, `${c.nombre}: «Elige X si» no tiene tres`);
  }
});

test('cada celda es sí, no, sin dato o un valor corto; los «sí» y «no» de las apps grandes llevan su fuente', () => {
  const claves = GRUPOS_MATRIZ.flatMap((g) => g.filas.map((f) => f.clave));
  for (const c of COMPETIDORES) {
    for (const k of claves) {
      const v = c.celdas[k]?.v;
      if (v == null) continue;
      assert.ok(v === 'si' || v === 'no' || v === '?' || (v.length > 0 && v.length <= 24), `${c.nombre} / ${k}: «${v}»`);
    }
    // Una app de todo en uno (CRM, landings y automatizaciones a la vez) tiene la fuente de lo que se le afirma.
    const todoEnUno = ['crm', 'landings', 'automatizaciones'].every((k) => c.celdas[k as 'crm']?.v === 'si');
    if (todoEnUno) {
      const conFuente = claves.filter((k) => c.celdas[k]?.fuente).length;
      assert.ok(conFuente >= 3, `${c.nombre}: casi sin fuentes (${conFuente})`);
    }
  }
});

// ── LAS DOS PÁGINAS PÚBLICAS NO PUEDEN CONTRADECIRSE (15/11/2026) ─────────────────────────────────────────────────────
// Esta aserción miraba TRES filas (copiar_landing, comunidad, crm) y pasaba 5/5 mientras la tabla le ponía ✓ al lado del
// precio de Esencial en el setter con IA y en el dominio propio, cerrados en Esencial el 14/11. Nadie vigilaba las otras 23.
// Ahora se cruzan las DOS páginas públicas, fila por fila: /planes (lib/planes-comparacion.ts) contra la tabla «MaKo vs» de
// /vsl/comparaciones, y se leen las DOS columnas de /planes (`celdaDeCapa`), no sólo lo que Esencial no trae: con la fila en
// los dos planes la tabla dice «si», con la fila sólo en Pro «En Pro», y si no está en ninguno la celda va VACÍA, que es otra
// cosa que «En Pro» (hoy no pasa; el día que un tope quede en 0 en los dos planes, pasa).
//
// ⚠️ QUÉ MIDE ESTE CRUCE Y QUÉ NO, medido el 15/11 (y es lo que hay que entender antes de tocarlo):
//   · Las 5 filas de FUNCIÓN o de TAB sí cruzan dos fuentes: `celdaDeMaKo` lee `FUNCIONES_SOLO_PRO`/`TABS_SOLO_PRO` y /planes
//     las escribe A MANO con `soloPro(...)`. Medido sacando 'setter-ia' de `FUNCIONES_SOLO_PRO` en memoria: rojo, 4/5.
//   · Las 10 filas de TOPE aplicaban la MISMA regla al MISMO `TOPES` en los dos lados: no podían discrepar NUNCA. Medido con
//     los 10 topes de Esencial en 0: la columna cambiaba 9 celdas de ✓ a «En Pro» y el test seguía 5/5. Lo que sí puede
//     discrepar es CUÁL tope gobierna la fila, y por eso /planes lo DECLARA (`FilaComparacion.tope`, 15/11/2026) y se cruza
//     la clave, no el número: medido el 15/11, SEIS de los topes que esta tabla declara valen 1 en Esencial
//     (`crm.funnels`, `cobros.cuentas`, `chats.lineas_whatsapp`, `web.landings_publicadas`, `spy.competidores` y
//     `classroom.cursos`), así que cruzar dos de esas filas entre sí pasaba la comparación de dígitos sin rojo: medido
//     cruzando `crm` con `cuotas`, el test de entonces quedaba 7/7 verde. Con la clave declarada en los dos lados, es rojo
//     y el mensaje dice los dos topes.
//   · Y el camino del TOPE EN 0 no lo cierra ningún cruce: los dos lados se mueven juntos. Medido con los 9 topes que esta
//     tabla declara en 0, el test de entonces quedaba 7/7 verde mientras la columna pasaba de si=19/«En Pro»=6 a
//     si=11/«En Pro»=14. Lo que lo cierra es `COLUMNA_DE_MAKO_HOY`, más abajo: el valor OBSERVABLE de cada celda, a mano.
//   · Y las 10 filas de `enLosDos` no leen NADA del código: un «si» a mano contra un `enTodos` también a mano. Medido
//     agregando una décima clave a `FUNCIONES_SOLO_PRO` que esta tabla NOMBRA ('tracking-leads'): 5/5 verde, la celda de
//     `tracking` seguía en ✓. Los dientes de esas filas están en `FILA_QUE_NOMBRA`, más abajo: no en el cruce.

/** La fila de /planes que promete lo mismo que cada fila de la tabla «MaKo vs» (`que`, de `filasDeComparacion`). */
// Exhaustivo a propósito: una fila nueva en `ClaveFila` no compila hasta decir con qué fila de /planes se cruza. «precio» y
// «espanol» no se cruzan: una es el precio y la otra no es una función con candado ni con tope.
const EN_PLANES: Readonly<Record<Exclude<ClaveFila, 'precio' | 'espanol'>, string>> = {
  landings: 'Landings y presentaciones armadas con IA, publicadas',
  landings_ia: 'Landings y presentaciones armadas con IA, publicadas',
  copiar_landing: NOMBRE_FUNCION_PRO['replicar-landing'],
  spy: 'Competidores que MaKo scrapea: web, redes y anuncios',
  dominio: 'Dominio propio para tus landings (tunegocio.com)',
  crm: 'Pipelines de venta en tu CRM, con sus etapas',
  tracking: 'Tracking de cada lead: de qué anuncio vino y qué hizo',
  agenda: 'Agenda de llamadas sincronizada con Google, Calendly o Cal',
  // Cobrar en cuotas sin una cuenta de cobro conectada no es nada: la fila que la habilita es la que manda.
  cuotas: 'Cuentas de cobro conectadas: Mercado Pago o Stripe',
  llamadas_ia: NOMBRE_TAB_PRO['closing-analyst'],
  whatsapp: 'Números de WhatsApp conectados',
  instagram_dm: 'Bandeja única: WhatsApp, Instagram, Messenger y email',
  setter_ia: NOMBRE_FUNCION_PRO['setter-ia'],
  automatizaciones: 'Automatizaciones activas a la vez',
  email: 'Email marketing: secuencias y envíos con tu dominio',
  copy_ia: 'Copywriting con IA: guiones de reels, anuncios, VSL y emails',
  editor_imagen: 'Editor de imágenes y carruseles, como Canva',
  editor_video: 'Editor de video, como CapCut',
  video_ia: NOMBRE_FUNCION_PRO['ia-editores'],
  // ⚠️ Esencial SÍ trae el media buyer, con 2 recomendaciones por día: un tope mayor que 0 es «lo trae», no «En Pro».
  ads_ia: 'Recomendaciones por día para tus campañas de Meta',
  calendario: 'Calendario de contenido y publicación en tus redes',
  cursos: 'Cursos con módulos y clases para tus alumnos',
  comunidad: NOMBRE_FUNCION_PRO['comunidad'],
  asistente_ia: 'MaKo, un asistente con IA que conoce tu negocio',
};

// ── LOS DIENTES: EL DÍA QUE SE CIERRE LA FUNCIÓN SIGUIENTE, ROJO (15/11/2026) ─────────────────────────────────────────
// El cruce de arriba no alcanza, y está medido: una función nueva en `FUNCIONES_SOLO_PRO` no toca ninguna de las dos páginas
// sola (en /planes la fila se escribe a mano con `soloPro(...)`; acá la fila declara su candado a mano en
// `CANDADO_DE_LA_FILA`), así que las dos pueden quedar al día con el código y seguir vendiendo lo mismo con ✓. Eso fue el
// 14/11: 'setter-ia' entró a la lista y nadie volvió a esta tabla.
// Lo que falla hacia el rojo es ir AL REVÉS: por cada función de Pro, decir qué fila de ESTA tabla la nombra — o que no la
// nombra ninguna, y por qué. El mapa es exhaustivo (`Record`, no `Partial`), así que una función nueva no COMPILA hasta
// declararla; y además se compara en RUNTIME contra `FUNCIONES_SOLO_PRO`, porque `node --test` no ve el typecheck y el
// typecheck no corre en el build (AGENTS.md).
//
// ⚠️ EL LÍMITE DE `sinFila`, dicho para que nadie lo lea como cerrado (15/11/2026): la justificación NO se cruza contra nada
// —no hay fuente mecánica de «qué nombra el texto de una fila»—, así que lo único que se comprueba es que esté escrita. Una
// justificación FALSA pasa: medido el 15/11 cerrando `'tracking-leads'` en memoria y declarándola
// `{ sinFila: 'el tracking no tiene fila propia: va dentro del CRM' }` —falso, la fila «Tracking de cada lead» existe—,
// este archivo queda 8/8 verde con la celda de `tracking` en ✓ al lado del precio de Esencial. Lo que sí tiene dientes es la otra mitad: la
// función nueva no COMPILA sin entrada y la lista de claves se compara en runtime, así que alguien TIENE que escribir la
// frase. Quien la escribe la mira contra `GRUPOS_MATRIZ`; quien la lee después, también.
/** Qué fila de la tabla «MaKo vs» nombra cada función de Pro (`sinFila`: ninguna la nombra, y por qué). */
const FILA_QUE_NOMBRA: Readonly<Record<FuncionSoloPro, FilaDeLaTabla | { sinFila: string }>> = {
  'replicar-landing': 'copiar_landing',
  'ia-editores': 'video_ia',
  'comunidad': 'comunidad',
  'setter-ia': 'setter_ia',
  'scraper-whatsapp': { sinFila: 'traer los contactos de un grupo de WhatsApp no tiene fila: ninguna app de la tabla lo hace' },
  'piloto-redes': { sinFila: 'los pilotos automáticos no tienen fila; «DMs de Instagram» es la bandeja, que está en los dos planes' },
  'ai-avatar': { sinFila: 'no se vende todavía (`AI_AVATAR_SE_VENDE` = false), así que tampoco se compara' },
  // El número NO se escribe a mano: sale de `COMPETIDORES` (21 el 15/11/2026). Escrito a mano decía 20 y la tabla ya dibujaba
  // 21 columnas, así que el día que entre una app la frase vuelve a mentir sola.
  'replicar-guion': { sinFila: `PENDIENTE DE MARTÍN: su hermana «Copiar landings de otros» sí tiene fila; sumarla pide rellenar las ${COMPETIDORES.length} celdas de los competidores con su fuente` },
  'chat-referentes': { sinFila: 'hablar con los referentes no tiene fila: ninguna app de la tabla tiene algo parecido' },
};
/** Lo mismo para las tabs de Pro (`TABS_SOLO_PRO`). */
const FILA_QUE_NOMBRA_TAB: Readonly<Record<(typeof TABS_SOLO_PRO)[number], FilaDeLaTabla | { sinFila: string }>> = {
  'closing-analyst': 'llamadas_ia',
};

// ── EL COMENTARIO LE PEGA AL COMPETIDOR POR UNA FILA DE ESTA MISMA TABLA (15/11/2026) ─────────────────────────────────
// Lo descubrió este cambio y es su efecto: la columna de MaKo ya no se tipea, se DERIVA, así que una celda puede pasar a
// «En Pro» sola. El comentario de cada app, en cambio, es prosa (la genera scripts/visor-landings/matriz-competencia.py
// desde la investigación) y le pega al competidor por algo CONCRETO. Si esa fila se cierra en Esencial, la página le pega
// al otro por lo mismo que MaKo no le da a Esencial, en la MISMA página y a pocas líneas.
// Medido el 15/11 dibujando /vsl/comparaciones/gohighlevel: el comentario «GoHighLevel cobra la IA aparte: el setter
// encarece cada conversación con tus leads.» y, 47 líneas de texto visible más abajo, la fila «Setter con IA | En Pro |
// Sí, con cargo extra», debajo de una fila de precio que dice el de Esencial contra el plan de entrada de GoHighLevel.
// No hay fuente mecánica de «de qué habla una frase», así que cada app lo DECLARA: `dice` es el trozo literal del comentario
// (si se regenera con otra frase, esto se pone rojo y hay que volver a declararlo) y `filas` son las filas en las que se
// apoya, que tienen que estar en Esencial. `seContradice` es para declarar la que YA está, no para tapar una nueva: con ella
// la fila tiene que NO estar en Esencial, así que el día que se arregle, la entrada sale de acá o la prueba se pone roja.
type ApoyoDelComentario = { dice: string; filas: readonly FilaDeLaTabla[]; seContradice?: string };
const COMENTARIO_SE_APOYA_EN: Readonly<Record<string, ApoyoDelComentario>> = {
  'gohighlevel': { dice: 'cobra la IA aparte: el setter', filas: ['setter_ia'],
    seContradice: 'PENDIENTE DE MARTÍN: el setter con IA es de Pro desde el 14/11, así que la página le pega a GoHighLevel por cobrar la IA aparte y su propia celda dice «En Pro». Arreglarlo es decidir cómo se vende MaKo (abrir el setter en Esencial, o dejar de pegarle por eso): lo decide Martín, no un agente' },
  'clickfunnels': { dice: 'no admite cuotas', filas: ['cuotas'] },
  'kajabi': { dice: 'no tiene pipeline de ventas', filas: ['crm'] },
  'systeme-io': { dice: 'no integra WhatsApp', filas: ['whatsapp'] },
  'hubspot': { dice: 'reserva WhatsApp a Marketing Hub Pro', filas: ['whatsapp'] },
  'hotmart': { dice: 'no trae pipeline de ventas', filas: ['crm'] },
  'activecampaign': { dice: 'no trae agenda propia', filas: ['agenda'] },
  'manychat': { dice: 'no tiene pipeline de ventas', filas: ['crm'] },
  'skool': { dice: 'no tiene CRM ni agenda', filas: ['crm', 'agenda'] },
  'circle': { dice: 'cobra el email marketing como add-on', filas: ['email'] },
  'mailchimp': { dice: 'no tiene pipeline de ventas', filas: ['crm'] },
  'metricool': { dice: 'quedan sin CRM ni seguimiento', filas: ['crm', 'tracking'] },
  'canva': { dice: 'pero sin CRM', filas: ['crm'] },
  'capcut': { dice: 'edita video sin CRM', filas: ['crm'] },
  'opusclip': { dice: 'recorta clips sin CRM', filas: ['crm'] },
  'heygen': { dice: 'no capta leads', filas: ['landings', 'crm'] },
  'higgsfield': { dice: 'sin CRM ni reportes', filas: ['crm', 'tracking'] },
  'gamma': { dice: 'sin checkout ni CRM', filas: ['cuotas', 'crm'] },
  'notion': { dice: 'sin WhatsApp ni email marketing', filas: ['whatsapp', 'email'] },
  'zap': { dice: 'CRM, chats y landings se pagan aparte', filas: ['crm', 'whatsapp', 'landings'] },
  'make': { dice: 'sin CRM ni bandeja', filas: ['crm', 'whatsapp'] },
};

// ── «ELIGE MaKo SI»: COPY A MANO, CON EL MISMO ✓, AL LADO DE LA COLUMNA QUE SÍ SE DERIVA (15/11/2026) ─────────────────
// `ELIGE_MAKO_SI` no es una lista de plan: es el POSICIONAMIENTO de MaKo contra el competidor, y se dibuja con el MISMO tilde
// que una celda «si» (`s-mx-si`, app/vsl/_sitio/Comparaciones.tsx:156 y :250), dentro del panel donde la fila de precio dice
// el de Esencial. Dos de los cinco ítems nombran cosas que Esencial NO tiene. Cambiar el copy o escribirle «(en Pro)» cambia
// cómo se vende MaKo: es decisión de Martín, no de un agente. Lo que NO se deja pasar es que se desincronice en silencio, así
// que cada ítem declara DOS cosas y las dos se cruzan contra el código:
//   · qué funciones de Pro nombra (contra `FUNCIONES_SOLO_PRO`): si una se abre en Esencial, el aviso de ese ítem sobra;
//   · qué FILAS de esta tabla promete con el tilde pelado y Esencial hoy SÍ trae: si una se cierra, el ítem queda prometiendo
//     con ✓ algo que la tabla dice «En Pro» tres bloques más abajo, en la misma página. Medido el 15/11 con los 9 topes de la
//     tabla en 0: el ítem 2 seguía prometiendo «tu CRM, tu WhatsApp y tus landings» con el mismo tilde mientras la tabla decía
//     «En Pro» en `crm`, `whatsapp` y `landings`, y el test seguía 7/7 verde. Eso es lo que cierra `prometeDeEsencial`.
const ELIGE_NOMBRA: ReadonlyArray<readonly [string, readonly FuncionSoloPro[], readonly FilaDeLaTabla[]]> = [
  ['Vendes servicios, mentorías o programas de ticket alto.', [], []],
  // CRM, WhatsApp y landings están en Esencial, cada una con su tope: el ítem las promete y las tres filas tienen que decir ✓.
  ['Quieres tu CRM, tu WhatsApp y tus landings en una sola app.', [], ['crm', 'whatsapp', 'landings']],
  ['Quieres que la IA conteste, haga el seguimiento y agende por ti.', ['setter-ia'], []],
  // «Ver» lo que le funciona es la fila de espiar (Esencial, con tope); «replicarlo» son las dos funciones de Pro.
  ['Quieres ver lo que le funciona a tu competencia y replicarlo.', ['replicar-landing', 'replicar-guion'], ['spy']],
  ['Trabajas en español, con personas reales del otro lado.', [], []],
];

// ── LO QUE LA COLUMNA DE MaKo MUESTRA HOY, CELDA POR CELDA, CLAVADO A MANO (15/11/2026) ───────────────────────────────
// Esto es la mitad que ningún cruce puede dar: el VALOR OBSERVABLE. `celdaDeMaKo` lo deriva de `FUNCIONES_SOLO_PRO`, de
// `TABS_SOLO_PRO` y de `TOPES`; acá está escrito a mano lo que la página dibuja, dibujada y contada el 15/11 (si=19,
// «En Pro»=6, y el precio). Dos fuentes, no una cuenta hecha dos veces: cualquier cambio del producto que mueva una celda
// pone esta prueba roja y la decisión («¿se vende así?») vuelve a Martín antes de salir a la web.
// Por qué hace falta, medido: el cruce con /planes aplica la MISMA regla al MISMO `TOPES` en los dos lados, así que con los
// 9 topes de la tabla en 0 la columna pasaba de si=19/«En Pro»=6 a si=11/«En Pro»=14 y el test de entonces seguía 7/7 verde.
// Y el precio: la aserción que lo vigilaba lo comparaba contra la MISMA expresión que `celdaDeMaKo` evalúa adentro
// (`PLANES_MAKO_DEFAULT.find(…).precioUsd`), así que no podía fallar: medido con el precio de Esencial en 999 en memoria, el
// test de entonces quedaba 7/7 verde y la celda mostraba «US$ 999». Acá va el número que la página dice HOY, y es el ÚNICO
// lugar del archivo que lo escribe: mover el precio tiene que pasar por esta línea, y los mensajes de abajo lo interpolan
// (`celdaDeMaKo('precio').v`) para no quedar viejos. Lo mismo del otro lado: ningún comentario nombra el dígito.
const COLUMNA_DE_MAKO_HOY: Readonly<Record<ClaveFila, string>> = {
  precio: 'US$ 47',
  landings: 'si', landings_ia: 'si', copiar_landing: EN_PRO, spy: 'si',
  // 14/11/2026, noche: `web.dominios` pasó a 0 en Esencial. Es el dominio de una LANDING, no el de envío de los emails.
  dominio: EN_PRO,
  crm: 'si', tracking: 'si', agenda: 'si', cuotas: 'si', llamadas_ia: EN_PRO,
  // 14/11/2026, noche: el setter con IA es de Pro ('setter-ia'). Esta celda decía «si» hasta el 15/11.
  whatsapp: 'si', instagram_dm: 'si', setter_ia: EN_PRO, automatizaciones: 'si', email: 'si',
  copy_ia: 'si', editor_imagen: 'si', editor_video: 'si', video_ia: EN_PRO,
  // El error simétrico, el que miente en contra: un tope mayor que 0 es «lo trae». Esencial SÍ trae el media buyer, en modo
  // «propone», con `ads.recomendaciones_dia` = 2 (25/10/2026).
  ads_ia: 'si', calendario: 'si',
  cursos: 'si', comunidad: EN_PRO, asistente_ia: 'si', espanol: 'si',
};

test('la columna de MaKo sale del código, TODAS las filas: lo que /planes no le da a Esencial, la tabla lo dice «En Pro»', () => {
  assert.equal(EN_PRO, 'En Pro', 'cambió lo que dice la celda de lo que es de Pro (lo lee quien compara, no el código)');
  assert.equal(ELIGE_MAKO_SI.length, 5);

  const filas = GRUPOS_MATRIZ.flatMap((g) => g.filas.map((f) => f.clave));
  // El `Record` de `COLUMNA_DE_MAKO_HOY` es exhaustivo sobre `ClaveFila` y no compila sin la fila nueva; esto es la otra
  // mitad, en runtime: que las claves declaradas sean EXACTAMENTE las filas que la tabla dibuja. Una clave de `ClaveFila` que
  // ningún grupo dibuja no se ve en la página y no se puede clavar.
  assert.deepEqual([...Object.keys(COLUMNA_DE_MAKO_HOY)].sort(), [...filas].sort(),
    'las celdas clavadas no son las filas que dibuja `GRUPOS_MATRIZ`');
  const todasDePlanes = filasDeComparacion();
  const dePlanes = new Map(todasDePlanes.map((f) => [f.que, f] as const));
  assert.equal(dePlanes.size, todasDePlanes.length, '/planes tiene dos filas con el mismo texto: el cruce se queda con una sola');
  const mapa = EN_PLANES as Partial<Record<ClaveFila, string>>;
  const cruzadaPor = new Map<string, ClaveFila[]>();
  let cruzadas = 0;
  for (const k of filas) {
    const v = celdaDeMaKo(k).v;
    // Lo que el dibujo de la tabla sabe mostrar (`ValorCelda`): el ✓, la celda vacía o un valor corto. Nunca «sin dato»:
    // de MaKo se sabe, está en el código.
    assert.ok(v.length > 0 && v.length <= 24, `${k}: «${v}» no entra en la celda`);
    assert.notEqual(v, '?', `${k}: la columna de MaKo quedó «sin dato»`);
    // EL VALOR OBSERVABLE, contra lo declarado a mano: el cruce de abajo no puede ver un tope que se va a 0 (los dos lados
    // lo leen del mismo `TOPES`), y esto sí. Si cambió a propósito, se cambia `COLUMNA_DE_MAKO_HOY` y se mira la página.
    assert.equal(v, COLUMNA_DE_MAKO_HOY[k],
      `${k}: la página dice «${v}» y lo clavado el 15/11 es «${COLUMNA_DE_MAKO_HOY[k]}». Cambió lo que esta tabla PROMETE al lado del precio de ${celdaDeMaKo('precio').v}: es decisión de Martín, no un detalle del test`);
    if (k === 'precio' || k === 'espanol') continue;
    const que = mapa[k];
    assert.ok(que, `«${k}» no dice con qué fila de /planes se cruza`);
    // LA GUARDA CONTRA LA ASERCIÓN VACÍA: si el texto de /planes cambió, la fila no aparece como «no incluida» por no
    // existir y todo diría «si» sin que nada falle. Así que primero: esa fila existe.
    const planes = dePlanes.get(que!);
    assert.ok(planes, `«${k}»: /planes ya no tiene la fila «${que}» (cambió su texto: hay que volver a cruzarla)`);
    // LAS DOS COLUMNAS de /planes, no sólo la de Esencial: en los dos planes es ✓, sólo en Pro es «En Pro», y en ninguno
    // la celda va VACÍA («no»), que es lo que `celdaDeMaKo` devuelve con el tope en 0 en los dos.
    const enEsencial = celdaDeCapa(planes!, 'completo');
    const enPro = celdaDeCapa(planes!, 'agencia');
    const esperado = enEsencial !== false ? 'si' : enPro !== false ? EN_PRO : 'no';
    assert.equal(v, esperado, `${k}: /planes dice «${esperado}» (Esencial «${String(enEsencial)}», Pro «${String(enPro)}») y la tabla «MaKo vs» dice «${v}»`);
    // CUÁL TOPE GOBIERNA LA FILA, que es lo que de verdad puede discrepar: los dos lados aplican la misma regla al mismo
    // `TOPES`, así que el VALOR no puede diferir nunca; lo que está escrito a mano de cada lado es la CLAVE del tope. Desde
    // el 15/11 /planes la declara (`FilaComparacion.tope`), así que se comparan las claves y no los dígitos: medido el
    // 15/11, SEIS de los topes que esta tabla declara valen 1 en Esencial (`crm.funnels`, `cobros.cuentas`,
    // `chats.lineas_whatsapp`, `web.landings_publicadas`, `spy.competidores` y `classroom.cursos`), así que comparar los
    // dígitos no distinguía una fila cruzada con la equivocada: cruzando `crm` con `cuotas` el test quedaba 7/7 verde.
    // Se compara en los DOS sentidos (una fila sin tope cruzada con una fila de tope de /planes, también es un cruce).
    const candado = CANDADO_DE_LA_FILA[k];
    const topeDeLaTabla = 'tope' in candado ? candado.tope : undefined;
    assert.equal(planes!.tope, topeDeLaTabla,
      `${k}: la tabla declara el tope «${String(topeDeLaTabla)}» y la fila «${que}» de /planes gobierna «${String(planes!.tope)}»: o el tope declarado no es el de esa fila, o la fila está cruzada con la equivocada`);
    // Y los DÍGITOS que /planes imprime, que es otra cosa: que el número del tope llegue a la página (lo formatea
    // `toLocaleString('es-AR')`, que separa los miles, y a `crm.leads` le pone «Hasta »). Un formateo que se coma el número
    // deja la fila de /planes sin su tope y la tabla «MaKo vs» con el ✓ igual.
    if (topeDeLaTabla !== undefined) {
      const n = TOPES.completo[topeDeLaTabla];
      if (typeof n === 'number' && n > 0) {
        assert.equal(typeof enEsencial, 'string', `${k}: declara el tope «${topeDeLaTabla}» (${n} en Esencial) y /planes no muestra ningún número en «${que}»`);
        assert.equal(String(enEsencial).replace(/\D/g, ''), String(n),
          `${k}: declara el tope «${topeDeLaTabla}» (${n} en Esencial) y /planes muestra «${String(enEsencial)}» en «${que}»`);
      }
    }
    cruzadaPor.set(que!, [...(cruzadaPor.get(que!) ?? []), k]);
    cruzadas++;
  }
  assert.equal(cruzadas, filas.length - 2, 'quedaron filas de la tabla sin cruzar con /planes');
  // Dos filas de la tabla sobre la MISMA fila de /planes: pasa a propósito en una sola pareja (el Web Generator es uno y lo
  // que se cuenta son las landings publicadas). Cualquier otra es un cruce copiado, y un cruce copiado no mide esa fila.
  assert.deepEqual(
    [...cruzadaPor].filter(([, ks]) => ks.length > 1).map(([que, ks]) => `${que} ← ${ks.join(' + ')}`),
    [`${EN_PLANES.landings} ← landings + landings_ia`],
    'hay filas de la tabla cruzadas con la misma fila de /planes',
  );

  // Las tres celdas del 14/11 (el setter y el dominio en «En Pro», el media buyer en ✓) ya no llevan su aserción aparte: están
  // clavadas en `COLUMNA_DE_MAKO_HOY`, con su porqué al lado del valor, y el bucle de arriba las compara una por una. Antes se
  // comparaban contra la MISMA expresión que `celdaDeMaKo` evalúa adentro, así que no podían fallar nunca.

  // PROBADO ROMPIÉNDOLO: la columna tiene que fallar hacia «En Pro», que es el lado que no promete lo que no hay. Una fila
  // sin candado declarado (`CANDADO_DE_LA_FILA`) no puede salir con el ✓ al lado del precio de Esencial.
  assert.equal(celdaDeMaKo('fila_que_nadie_declaro' as ClaveFila).v, EN_PRO, 'una fila sin declarar dice «si»: la tabla falla hacia la promesa');
});

test('el día que se cierre la función siguiente, esto se pone rojo solo: cada función de Pro dice qué fila de la tabla la nombra', () => {
  // EN RUNTIME, clave por clave, porque `node --test` no ve el typecheck y el typecheck no corre en el build (AGENTS.md).
  // El `Record` exhaustivo de `FILA_QUE_NOMBRA` ya no deja COMPILAR una función nueva sin declararla; esto es lo que la
  // pone roja en la corrida de tests. Medido empujando 'tracking-leads' a `FUNCIONES_SOLO_PRO` con un preload (`--import`)
  // que muta el array en memoria: antes 5/5 verde con la celda de `tracking` en ✓, ahora rojo acá.
  assert.deepEqual([...Object.keys(FILA_QUE_NOMBRA)].sort(), [...FUNCIONES_SOLO_PRO].sort(),
    'cambió `FUNCIONES_SOLO_PRO` y nadie dijo si esta tabla nombra esa función (si la nombra, su fila tiene que declararla)');
  assert.deepEqual([...Object.keys(FILA_QUE_NOMBRA_TAB)].sort(), [...TABS_SOLO_PRO].sort(),
    'cambió `TABS_SOLO_PRO` y nadie dijo si esta tabla nombra esa tab');

  // Y LOS DIENTES DE LAS FILAS `enLosDos`, que no leen nada del código: la fila que nombra algo de Pro tiene que DECLARARLO
  // como su candado. Una fila que nombra algo ya cerrado y sigue diciendo «está en los dos planes» es el ✓ del 14/11.
  for (const f of Object.keys(FILA_QUE_NOMBRA) as FuncionSoloPro[]) {
    const donde = FILA_QUE_NOMBRA[f];
    if (typeof donde !== 'string') {
      assert.ok(donde.sinFila.length > 20, `«${f}»: dice que ninguna fila la nombra y no dice por qué`);
      continue;
    }
    assert.deepEqual(CANDADO_DE_LA_FILA[donde], { funcion: f },
      `la fila «${donde}» nombra «${f}», que es de Pro, y no declara ese candado: su celda sale con ✓ al lado del precio de ${celdaDeMaKo('precio').v}`);
  }
  for (const t of Object.keys(FILA_QUE_NOMBRA_TAB) as (typeof TABS_SOLO_PRO)[number][]) {
    const donde = FILA_QUE_NOMBRA_TAB[t];
    if (typeof donde === 'string') assert.deepEqual(CANDADO_DE_LA_FILA[donde], { tab: t }, `la fila «${donde}» nombra la tab «${t}» y no declara ese candado`);
  }

  // Y al revés, para que no quede una fila apuntando a un candado que el mapa no reconoce: todo `{ funcion }` y todo
  // `{ tab }` de `CANDADO_DE_LA_FILA` tiene que estar en el mapa, apuntando a esa misma fila.
  for (const fila of Object.keys(CANDADO_DE_LA_FILA) as FilaDeLaTabla[]) {
    const c = CANDADO_DE_LA_FILA[fila] as unknown as { funcion?: string; tab?: string };
    if (c.funcion) assert.equal((FILA_QUE_NOMBRA as Record<string, unknown>)[c.funcion], fila, `la fila «${fila}» declara «${c.funcion}» y el mapa no la apunta a ella`);
    if (c.tab) assert.equal((FILA_QUE_NOMBRA_TAB as Record<string, unknown>)[c.tab], fila, `la fila «${fila}» declara la tab «${c.tab}» y el mapa no la apunta a ella`);
  }
});

test('el comentario de cada app no le pega por algo que MaKo tampoco le da a Esencial', () => {
  // En runtime y no con el tipo: los slugs salen de los datos generados, no de una unión.
  assert.deepEqual([...Object.keys(COMENTARIO_SE_APOYA_EN)].sort(), COMPETIDORES.map((c) => c.slug).sort(),
    'entró o salió una app y nadie dijo en qué fila de la tabla se apoya su comentario');
  const nombreDe = new Map(GRUPOS_MATRIZ.flatMap((g) => g.filas).map((f) => [f.clave, f.nombre] as const));
  for (const c of COMPETIDORES) {
    const a = COMENTARIO_SE_APOYA_EN[c.slug]!;
    // Atado a la PROSA: el comentario se regenera desde la investigación y una frase nueva puede apoyarse en otra fila.
    assert.ok(c.comentario.includes(a.dice),
      `${c.nombre}: el comentario ya no dice «${a.dice}» («${c.comentario}»): hay que volver a declarar en qué fila se apoya`);
    assert.ok(a.filas.length > 0, `${c.nombre}: su comentario no se apoya en ninguna fila de la tabla`);
    for (const f of a.filas) {
      const celda = celdaDeMaKo(f).v;
      if (a.seContradice) {
        assert.ok(a.seContradice.length > 60, `${c.nombre}: declara una contradicción y no dice qué hay que decidir`);
        assert.equal(celda, EN_PRO,
          `${c.nombre}: la contradicción declarada en «${nombreDe.get(f)}» ya no está (la celda dice «${celda}»): saquen la entrada «seContradice»`);
        continue;
      }
      assert.equal(celda, 'si',
        `${c.nombre}: el comentario le pega con «${a.dice}» y la columna de MaKo dice «${celda}» en «${nombreDe.get(f)}»: la página le pega al competidor por algo que MaKo tampoco le da a Esencial, al lado del precio de ${celdaDeMaKo('precio').v}. Es decisión de Martín (abrirlo en Esencial, o dejar de pegarle por eso)`);
    }
  }
  // Y LA QUE YA ESTÁ, DIBUJADA: que las dos cosas salen en la MISMA página no es un recuerdo. Se dibuja sólo la de las
  // contradicciones declaradas, así que esto cuesta un render mientras quede una y ninguno cuando no quede ninguna.
  for (const [slug, a] of Object.entries(COMENTARIO_SE_APOYA_EN)) {
    if (!a.seContradice) continue;
    const c = COMPETIDORES.find((x) => x.slug === slug)!;
    const html = renderToStaticMarkup(createElement(ComparacionVs, { c }));
    assert.ok(html.includes(c.comentario), `${c.nombre}: su página ya no dibuja el comentario (cambió el molde: hay que volver a medir la contradicción)`);
    for (const f of a.filas) {
      const dibujada = filaDibujada(html, nombreDe.get(f)!);
      assert.equal(dibujada[1], EN_PRO, `${c.nombre}: la fila «${nombreDe.get(f)}» quedó dibujada «${dibujada.join(' | ')}»`);
      // Y que la tabla leída es la DE ESA APP (`filaDibujada` toma la primera del HTML, y la página lleva varias): si su
      // celda es un valor corto, tiene que estar al lado del «En Pro» de MaKo, en la misma fila.
      const suyo = c.celdas[f]?.v;
      if (suyo && suyo !== 'si' && suyo !== 'no' && suyo !== '?') {
        assert.equal(dibujada[2], suyo, `${c.nombre}: la fila dibujada no es la suya («${dibujada.join(' | ')}»)`);
      }
    }
  }
});

test('«Elige MaKo si»: el copy a mano no se desincroniza en silencio de lo que es de Pro', () => {
  // Dos fuentes, no una cuenta hecha dos veces: el copy vive en app/vsl/_sitio/competencia.ts y lo que es de Pro en
  // lib/topes-plan.ts. Editar un ítem (o agregar uno) pone esto rojo, y hay que volver a decir qué nombra.
  assert.deepEqual([...ELIGE_MAKO_SI], ELIGE_NOMBRA.map(([dice]) => dice),
    'cambió el copy de «Elige MaKo si»: hay que volver a decir qué nombra cada ítem de lo que es de Pro');
  for (const [dice, nombra, prometeDeEsencial] of ELIGE_NOMBRA) {
    for (const f of nombra) {
      assert.ok((FUNCIONES_SOLO_PRO as readonly string[]).includes(f),
        `«${dice}» está anotado como que nombra «${f}», de Pro, y «${f}» ya no es de Pro: el aviso de este ítem sobra`);
    }
    // Y AL REVÉS, que es el camino que quedaba abierto: lo que el ítem promete con el tilde pelado tiene que seguir en
    // Esencial. Un tope en 0 mueve la celda a «En Pro» sola y el copy no se entera: queda el ✓ del ítem contra el «En Pro»
    // de la tabla, en la misma página.
    for (const f of prometeDeEsencial) {
      assert.equal(celdaDeMaKo(f).v, 'si',
        `«${dice}» promete con ✓ lo de la fila «${f}», y la tabla de la misma página dice «${celdaDeMaKo(f).v}» al lado del precio de ${celdaDeMaKo('precio').v}: el copy es decisión de Martín, pero esto hay que mirarlo`);
    }
  }
});

test('la página: la tabla que se desliza con sus flechas, las tarjetas «MaKo vs X» y la página de cada una', () => {
  const src = readFileSync(join(RAIZ, 'app/vsl/_sitio/Comparaciones.tsx'), 'utf8');
  assert.match(src, /<TablaCompetencia competidores=\{COMPETIDORES\} \/>/, 'el índice muestra todas las apps');
  assert.match(src, /data-mx-ir="1"/, 'sin las flechas');
  assert.match(src, /<script data-visor="" dangerouslySetInnerHTML=\{\{ __html: SCRIPT_FLECHAS \}\} \/>/, 'las flechas sin su script');
  assert.match(src, /<TarjetasVs \/>/, 'sin las tarjetas «MaKo vs X»');
  assert.match(src, /<TablaCompetencia competidores=\{\[c\]\} \/>/, 'la página de cada app sin su tabla');
  const css = readFileSync(join(RAIZ, 'app/vsl/_sitio/estilos.ts'), 'utf8');
  assert.match(css, /\.s-mx-caja\{overflow:clip;/, 'la tabla, entera y sin caja con scroll (14/11, noche: sin barras ni scroll de costado)');
  // Martín, 14/11: las flechas ya no esconden y muestran columnas (`display`): las DESLIZAN («tiene que verse una animación de
  // desplazamiento… si no, no se entiende»). El script corre --mx-x una página entera; el CSS lo anima en 300 ms, y con «menos
  // movimiento» no anima.
  assert.match(src, /c\.style\.setProperty\('--mx-x',\(-i\*w\)\+'px'\)/, 'las flechas no corren las columnas una página');
  assert.match(css, /\.s-mx:not\(\[data-una\]\) \[data-c\]\{transform:translateX\(var\(--mx-x,0px\)\);transition:transform \.3s /, 'las columnas no se deslizan en 300 ms');
  const quieto = css.split('@media (prefers-reduced-motion:reduce){').slice(1).some((b) => b.slice(0, b.search(/\r?\n\}/)).includes('.s-mx:not([data-una]) [data-c]{transition:none}'));
  assert.ok(quieto, 'con «menos movimiento» las columnas se deslizan igual');
  assert.match(css, /\.s-mx-t thead th\{position:sticky;top:var\(--s-barra-alto,76px\)/, 'la cabecera no queda fija');
  assert.ok(existsSync(join(RAIZ, 'app/vsl/comparaciones/[slug]/page.tsx')), 'sin la página «MaKo vs X»');
});

test('Martín, 14/11: lo que pagas hoy al principio, la tarjeta abre su panel ahí mismo, sin la nota de las fuentes y el ícono según el modo', () => {
  const src = readFileSync(join(RAIZ, 'app/vsl/_sitio/Comparaciones.tsx'), 'utf8');
  const css = readFileSync(join(RAIZ, 'app/vsl/_sitio/estilos.ts'), 'utf8');
  const indice = src.slice(src.indexOf('export function ComparacionesSitio'));
  // Martín, 14/11 (más tarde): sin el hero de arriba; la página EMPIEZA con el ticket (su titular es el h1).
  const seccion = indice.indexOf('<SeccionReemplaza claro principal />');
  assert.ok(seccion > 0 && seccion < indice.indexOf('id="comparar"'), 'lo que pagas hoy no va al principio, antes de la tabla');
  assert.doesNotMatch(indice.slice(0, indice.indexOf('<Pie />')), /className="s-ch"/, 'volvió el hero «MaKo contra las apps que ya pagas»');
  // La tarjeta: un label con su casilla adentro y su panel como hermano (anda sin JavaScript y en el visor). Nunca un link a otra página.
  const tarjetas = src.slice(src.indexOf('export function TarjetasVs'), src.indexOf('const CSS = '));
  assert.match(tarjetas, /<label className="s-vs">\s*<input type="checkbox" id=\{idCasilla\(c\)\}/, 'la tarjeta no tiene su casilla adentro');
  assert.match(tarjetas, /<\/label>\s*<PanelVs c=\{c\} \/>/, 'el panel no sigue a su tarjeta');
  assert.doesNotMatch(tarjetas, /href=/, 'la tarjeta vuelve a llevar a otra página');
  assert.match(css, /\.s-vs:has\(> \.s-vs-ck:checked\) \+ \.s-vs-panel/, 'el panel no se abre con la casilla');
  assert.match(css, /\.s-cv-grilla\{[^}]*grid-auto-flow:row dense/, 'el panel no cae debajo de la fila de su tarjeta');
  assert.doesNotMatch(src, /<p className="s-mx-nota">/, 'volvió la nota de las fuentes («Lo de cada app sale de su web oficial…»)');
  // El ícono de MaKo: fijo para el sol y la luna, negro de base y blanco en el modo oscuro.
  assert.ok((src.match(/s-mk-ico" data-tema-fijo=""/g) ?? []).length >= 3, 'un ícono de MaKo sin `.s-mk-ico` y `data-tema-fijo`');
  assert.match(css, /\.s-mk-ico\{background:#1A1712\}\r?\nhtml\[data-sitio-modo="oscuro"\] \.s-mk-ico\{background:#fff\}/, 'el ícono no cambia con el modo');
});
