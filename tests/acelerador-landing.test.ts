// =============================================================================
// /accelerator: la landing de Martín traída de Lovable, con el programa de HOY (15/11/2026; al día el 16/11/2026)
// =============================================================================
// Martín, 15/11/2026: «revisa esa nueva landing, los copies que tiene, porque hay cosas que cambiar. Por ejemplo, el
// testimonio de Mauricio, que hoy en día ya vamos más de $100.000 facturados… hay varias partes donde menciona el
// acompañamiento 1 a 1 conmigo, y eso ya no es así… Entonces revisa bien todos los copies de ahí».
// Y el 16/11/2026, con el formulario de Mastery Haus: «no pondría el botón de agendar llamada, sino justamente el botón de
// aplicar ahora»; el precio («es mi política de que ya tenga todo el precio… la columna que hicimos»); la barra de arriba con la
// vuelta a MaKo y a los planes; los entregables 4, 4 y 4 en 2 y 2; el filtro «más de 5.000… con clientes y oferta validada»; y
// Axel, «una agencia y una academia».
//
// Lo que se fija acá, sobre la página DIBUJADA (renderToStaticMarkup), no sobre el fuente:
//   · lo que incluye es el del programa (`LISTA_DEL_ACELERADOR`, con el detalle de cada renglón, lib/planes-mako.ts),
//     importado: la misma lista que la columna de /planes; si la oferta cambia allá, cambia acá; y lo que está escrito a mano al
//     lado (la tarjeta del acompañamiento) dice lo mismo que esa lista y que el contrato (`PROGRAMA_ACELERADOR.incluye`), o se
//     pone rojo. «Nuestra promesa» ya no va (16/11): la tarjeta del precio dice lo mismo en su check 2;
//   · «La inversión» (16/11/2026, a la tarde): UN bloque con el precio arriba (sin cuotas: cuánto dura) y TODO lo que incluye
//     debajo, con el dorado de la columna de /planes y los ✓ verdes; la columna de /planes ya no se dibuja acá;
//   · el pie del sitio, del color de la página y más bajo;
//   · TODO «Aplica ahora» (la barra, el héroe, «La inversión», la barra de abajo del teléfono y el botón final) lleva al formulario
//     (`RUTA_APLICAR`), y en la página no hay ninguna agenda;
//   · la barra de arriba es la de MaKo (vuelve a «/» y lleva a /planes) y el pie es el del sitio, una vez;
//   · los 12 entregables: 4, 4 y 4, en dos columnas, con Appointment Setting en la fase 02 y la fase 03 contada con MaKo;
//   · el filtro dice el corte de la aplicación (más de US$ 5.000, con clientes y oferta validada) y Axel es agencia y academia;
//   · ninguna garantía: Martín la sacó «de todos lados» el 15/11 a la noche (el sello «Garantía por contrato» que tuvo esta
//     página la siguió afirmando después de que la fuente la sacó: ver la cosecha en docs/hallazgos-landing.md);
//   · los textos que Martín corrigió no vuelven: los $50.000 de Mauricio, la sesión 1:1 por semana, el «1 a 1» del
//     acompañamiento, «No es una mentoría grupal», los testimonios de relleno («Nombre Apellido»), «Marketing Koncept», el
//     encuentro en Buenos Aires, los clientes «recurrentes» y un equipo que Martín no tiene; «Conmigo, no con un equipo» SÍ
//     queda;
//   · el texto está en «tú» (el de Lovable estaba en «vos»);
//   · la barra de abajo del teléfono aparece con el caso de Mauricio y la tapa la sección de aplicar;
//   · la página vive donde lleva el «Más información» de /planes (`RUTA_ACCELERATOR`), es pública, y sólo se lee.
//
// Correr: node --import tsx --test tests/acelerador-landing.test.ts
//
// Probado rompiéndolo (15/11/2026 y 16/11/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PROGRAMA_ACELERADOR } from '../lib/planes-mako';
import { RUTA_APLICAR, califica, campo } from '../lib/aplicacion-accelerator';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';

const RAIZ = join(import.meta.dirname, '..');
// Los componentes compilados con el JSX clásico buscan `React` global.
(globalThis as unknown as { React: unknown }).React = React;
const { createElement } = React;

/** El HTML de la página, como lo dibuja el servidor (es async: lee la campaña de la URL, `searchParams`). */
async function pagina(sp: Record<string, string> = {}): Promise<string> {
  const { default: Pagina } = await import('../app/accelerator/page');
  return renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(sp) }));
}

/** Lo que se LEE: sin estilos, los bloques separados por un espacio, las marcas de adentro de una frase sin espacio. */
const BLOQUES = /<\/?(div|p|li|ul|ol|h[1-6]|section|header|footer|main|nav|br|iframe|video|img|small)\b[^>]*>/g;
const texto = (html: string) => html
  .replace(/<style[\s\S]*?<\/style>/g, ' ').replace(BLOQUES, ' ').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** El CSS que viaja en la página (los <style> de la landing, en orden). */
const estilos = (html: string) => [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

/** Los links de la página que dicen «Aplica ahora» (en cualquier caja), con su href. */
const botonesAplica = (html: string) => [...html.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)]
  .filter((m) => /^\s*aplica ahora\s*$/i.test(m[2]))
  .map((m) => ({ attrs: m[1], href: m[1].match(/\shref="([^"]*)"/)?.[1] ?? null, texto: m[2] }));

test('lo que incluye es el del programa (lib/planes-mako.ts), importado, y «Nuestra promesa» ya no se dibuja', async () => {
  const { LISTA_PROGRAMA } = await import('../app/planes/Tarjetas');
  const { LISTA_DEL_ACELERADOR } = await import('../lib/planes-mako');
  const t = texto(await pagina());
  const { promesa } = PROGRAMA_ACELERADOR;
  // La columna de /planes muestra MENOS cosas y con el texto largo (Martín, 15/11, ~23:20: «volver a… el texto un poco más largo…
  // pero tal vez que sean menos ítems»); la landing, TODAS, con su nombre y su detalle. Las dos salen de `LISTA_DEL_ACELERADOR`:
  // la columna es un pedazo de esa lista, en el mismo orden, así que quien toca «Más información» reconoce lo que acaba de leer.
  assert.deepEqual(LISTA_PROGRAMA.map((x) => x.fuerte), LISTA_DEL_ACELERADOR.filter((x) => x.enTarjeta).map((x) => x.fuerte), 'la columna de /planes ya no sale de la lista del programa');
  assert.ok(LISTA_DEL_ACELERADOR.length >= 5, `lo que incluye vino corto: ${LISTA_DEL_ACELERADOR.length}`);
  // Cada renglón con su nombre Y su detalle (la columna dice sólo el nombre: el detalle se cuenta acá).
  for (const x of LISTA_DEL_ACELERADOR) {
    assert.ok(t.includes(x.corto), `falta «${x.corto}» en lo que incluye`);
    assert.ok(x.detalle && t.includes(x.detalle), `falta el detalle de «${x.corto}»`);
  }
  assert.ok(LISTA_DEL_ACELERADOR.some((x) => /^MaKo Pro/.test(x.fuerte)), 'MaKo Pro salió de lo que incluye');
  // Las horas de la primera semana no se aclaran (Martín, 15/11: «no hace falta que aclares lo de las 10 horas»): son contrato,
  // y las dicen el pedido y /reembolsos.
  assert.doesNotMatch(t, /horas de trabajo/i, 'la landing aclara las horas de la primera semana');
  // Va en «La inversión», después de «Y en las tres fases, siempre» y antes del filtro.
  const incluye = t.indexOf(`La inversión ${PROGRAMA_ACELERADOR.nombre}`);
  assert.ok(incluye > t.indexOf('Y en las tres fases, siempre:'), 'lo que incluye no va después del programa');
  assert.ok(incluye < t.indexOf('¿Esto es realmente para ti?'), 'lo que incluye quedó después del filtro');
  // SIN «NUESTRA PROMESA» (16/11/2026): la misma razón por la que Martín la sacó de la columna de /planes el 15/11 («el sistema
  // de adquisición de clientes ya está en el check número 2»), y esa columna está ahora en esta página, debajo.
  assert.ok(promesa, 'el Accelerator no tiene promesa en lib/planes-mako.ts: revisar este test');
  assert.ok(!t.includes(promesa!), 'volvió la promesa: «La inversión» dice lo mismo en su renglón 2');
  assert.doesNotMatch(t, /Nuestra promesa/i, 'volvió la ceja «Nuestra promesa»');
  assert.ok(LISTA_PROGRAMA.some((x) => /sistema de adquisici[oó]n de clientes/i.test(`${x.fuerte}${x.texto}`)), 'la tarjeta ya no dice el sistema: la promesa tendría que volver');
});

test('la tarjeta «Acompañamiento continuo», escrita a mano, dice lo mismo que el programa', async () => {
  // La lección del sello de la garantía: un texto escrito a mano al lado de una lista importada sigue afirmando lo que la
  // fuente ya cambió. Si el programa cambia las sesiones, sus horas, la asesoría o el WhatsApp, esto se pone rojo. Se lee de
  // la lista que la página muestra (nombre y detalle) y del contrato (`incluye`): las dos tienen que decir lo de la tarjeta.
  const { PROGRAMA } = await import('../app/accelerator/contenido');
  const { LISTA_DEL_ACELERADOR } = await import('../lib/planes-mako');
  const cifras: string[] = [];
  for (const [cual, renglones] of [
    ['la lista de la página', LISTA_DEL_ACELERADOR.map((x) => `${x.fuerte}${x.texto} ${x.detalle}`)],
    ['el contrato', PROGRAMA_ACELERADOR.incluye],
  ] as const) {
    const sesiones = renglones.map((x) => x.match(/(\d+) sesiones 1 a 1\b.*?de (\d+) horas/)).find((m) => m);
    assert.ok(sesiones, `${cual} ya no dice «N sesiones 1 a 1… de N horas»: revisar la tarjeta`);
    cifras.push(`${sesiones[1]}|${sesiones[2]}`);
    const asesoria = renglones.find((x) => /asesor[ií]a/i.test(x));
    assert.ok(asesoria && /grupal/i.test(asesoria) && /por semana/i.test(asesoria), `en ${cual} la asesoría dejó de ser grupal y semanal: revisar la tarjeta`);
    assert.ok(renglones.some((x) => /WhatsApp personal/i.test(x)), `el WhatsApp personal salió de ${cual}: revisar la tarjeta`);
  }
  assert.equal(cifras[0], cifras[1], 'la lista de la página y el contrato no dicen las mismas sesiones (cuántas | de cuántas horas)');
  const tarjeta = PROGRAMA.siempre[0].texto;
  const NUMERO: Record<string, string> = { 1: 'Una', 2: 'Dos', 3: 'Tres', 4: 'Cuatro', 5: 'Cinco', 6: 'Seis' };
  const [n, horas] = cifras[0].split('|');
  assert.match(tarjeta, new RegExp(`^(${NUMERO[n] ?? n}|${n}) sesiones 1 a 1 `), `la tarjeta no dice las ${n} sesiones 1 a 1`);
  assert.ok(tarjeta.includes(`de ${horas} horas`), `la tarjeta no dice que son de ${horas} horas`);
  assert.match(tarjeta, /asesor[ií]a grupal en vivo cada semana/, 'la tarjeta no dice que la asesoría es grupal y semanal');
  assert.match(tarjeta, /WhatsApp personal/, 'la tarjeta no dice el WhatsApp personal');
  assert.ok(texto(await pagina()).includes(tarjeta), 'la tarjeta no se dibuja');
});

test('el caso de Mauricio dice los números de hoy', async () => {
  const t = texto(await pagina());
  assert.ok(t.includes('hoy llevamos juntos más de $100.000 dólares facturados'), 'Mauricio: más de $100.000');
  assert.ok(t.includes('ese número de los $100k'), 'Mauricio: los $100k');
  assert.doesNotMatch(t, /\$50\.000|\$50k/, 'volvió el número viejo de Mauricio');
});

test('lo que Martín corrigió no vuelve', async () => {
  const html = await pagina();
  const t = texto(html);
  const VIEJOS: Array<[RegExp, string]> = [
    [/sesi[oó]n 1:1 por semana/i, 'la sesión semanal: hoy son 3 sesiones 1 a 1'],
    [/1:1/, 'el «1:1» suelto (el Blueprint de Lovable) se leía como una cuarta sesión: son 3, y se escriben «1 a 1»'],
    [/acompañamiento 1 a 1|mentor[ií]a 1 a 1/i, 'el «1 a 1» del acompañamiento'],
    [/no es una mentor[ií]a grupal/i, 'la asesoría de cada semana ES grupal'],
    [/consultor[ií]as las veces que las necesites/i, 'las consultorías ilimitadas'],
    [/todo lo que haga falta/i, 'una promesa sin borde: lo que se arma es lo que dice el programa (`PROGRAMA_ACELERADOR.incluye`)'],
    [/garant/i, 'Martín, 15/11 ~21:30: «la parte de garantía por contrato directamente la quitaría de todos lados»'],
    [/recuper\w* (la|tu) inversi[oó]n/i, 'recuperar la inversión era la garantía, y se fue con ella'],
    [/\b(nuestro|mi) equipo\b/i, 'Martín, 15/11: «todavía no tengo equipo»: el sistema lo arma él'],
    [/Nombre Apellido/, 'los testimonios de relleno'],
    [/Video · (Consultor B2B|Coach de negocios)/i, 'las cajas de video vacías'],
    [/Marketing Koncept/i, `la marca vieja: el programa se llama ${PROGRAMA_ACELERADOR.nombre}`],
    [/Buenos Aires/i, 'el encuentro presencial salió del programa el 15/11'],
    [/sin tope/i, 'Martín, 15/11: «ilimitado», nunca «sin tope»'],
    [/recurrentes/i, 'Martín, 16/11: «no pondría con clientes recurrentes. Pondría con oferta validada»'],
  ];
  for (const [re, porque] of VIEJOS) {
    assert.doesNotMatch(t, re, porque);
    assert.doesNotMatch(html, re, `${porque} (en el HTML)`);
  }
  // La llamada de venta del paso 3 SÍ es 1 a 1: no es el acompañamiento.
  assert.ok(t.includes('Tenemos una llamada 1 a 1'));
  // «Conmigo, no con un equipo» QUEDA. Martín, 15/11 ~21:00: «yo todavía no tengo equipo, así que está bien que lo digas
  // conmigo y no con un equipo».
  assert.ok(t.includes('Conmigo, no con un equipo.'), 'se fue «Conmigo, no con un equipo.»');
  // La marca: en la barra y en «La inversión».
  assert.ok((t.match(new RegExp(escapar(PROGRAMA_ACELERADOR.nombre), 'g')) ?? []).length >= 2, `${PROGRAMA_ACELERADOR.nombre}, en la barra y en la inversión`);
});

test('el texto está en «tú», no en «vos»', async () => {
  const t = texto(await pagina());
  // El detector de la casa (el mismo del guard de todo el repo, tests/puente-panel-copy.test.ts) sobre lo que se LEE…
  const { voseoEn } = await import('../lib/voseo');
  assert.deepEqual(voseoEn(t).map((h) => `${h.forma} → ${h.neutro}`), [], 'quedó voseo');
  // …y las tres de la de Lovable que ese detector no marca: «Construí» es igual al pretérito («yo construí») y las otras dos no
  // las conjuga. Las tres estaban en la página original.
  const VOS = /(?<!\p{L})(construí|operás|responsabilizás)(?!\p{L})/giu;
  assert.deepEqual([...t.matchAll(VOS)].map((m) => m[0]), [], 'quedó voseo');
  for (const frase of ['¿Esto es realmente para ti?', 'Para trabajar conmigo tienes que pasar por un proceso de aplicación.', 'Construye un sistema de adquisición de clientes predecible.']) {
    assert.ok(t.includes(frase), `falta «${frase}»`);
  }
});

test('todo «Aplica ahora» lleva al formulario (RUTA_APLICAR), y en la página no hay ninguna agenda', async () => {
  // Martín, 16/11/2026: «yo no pondría el botón de agendar llamada, sino justamente el botón de aplicar ahora. Y ahí pondría
  // justamente un formulario». Hasta el 15/11 los «Aplica ahora» bajaban a #aplicar y ahí «Agenda tu llamada» abría su Calendly;
  // ahora la agenda se abre DESPUÉS de aplicar, a quien califica (lib/aplicacion-accelerator.ts, `linkDeLaAgenda`).
  const { TEXTO_AGENDA_ACELERADOR } = await import('../app/planes/Tarjetas');
  const html = await pagina();
  const aplica = botonesAplica(html);
  // La barra, el héroe, «La inversión», la barra de abajo del teléfono y el botón grande del final.
  assert.equal(aplica.length, 5, `los «Aplica ahora» (barra, héroe, la inversión, barra del teléfono y final): ${aplica.length}`);
  for (const a of aplica) assert.equal(a.href, RUTA_APLICAR, `un «${a.texto}» no lleva al formulario: ${a.attrs}`);
  for (const [donde, re] of [
    ['la barra de arriba', /<header class="acl-hdr">[\s\S]*?<\/header>/],
    ['el héroe', /<div class="acl-hero-cta">[\s\S]*?<\/div>/],
    ['la inversión', /<section class="acl-sec acl-inversion-s"[\s\S]*?<\/section>/],
    ['la barra de abajo del teléfono', /<div class="acl-pegado">[\s\S]*?<\/div>/],
    ['la sección del final', /<section class="acl-sec acl-final" id="aplicar">[\s\S]*?<\/section>/],
  ] as const) {
    const pedazo = html.match(re)?.[0] ?? '';
    assert.ok(botonesAplica(pedazo).some((a) => a.href === RUTA_APLICAR), `${donde} no tiene su «Aplica ahora» al formulario`);
  }
  // El de la sección del final, el grande.
  assert.match(html, new RegExp(`<a class="acl-btn acl-btn-grande" href="${escapar(RUTA_APLICAR)}">Aplica ahora</a>`), 'el botón final no es el grande al formulario');
  // Ningún link baja a la sección ni sale a una agenda; en toda la página (también su CSS) no hay un Calendly.
  assert.doesNotMatch(html, /href="#/, 'un botón volvió a bajar a una sección');
  assert.doesNotMatch(html, /calendly/i, 'la agenda volvió a la página: se abre después de aplicar');
  assert.ok(!html.includes(TEXTO_AGENDA_ACELERADOR), `volvió «${TEXTO_AGENDA_ACELERADOR}»`);
  // El formulario: una página pública que sólo se lee (lo que manda va a /api/accelerator/aplicar, que valida todo).
  assert.equal(RUTA_APLICAR, '/accelerator/aplicar');
  assert.ok(existsSync(join(RAIZ, 'app', RUTA_APLICAR, 'page.tsx')), `los botones llevan a ${RUTA_APLICAR} y ahí no hay una página`);
  assert.equal(esPublica(RUTA_APLICAR), true, 'quien no tiene cuenta tiene que poder aplicar');
  assert.equal(esPublicaSoloLeer(RUTA_APLICAR), true, 'la página del formulario no acepta POST: lo recibe la API');
  // Sin botones muertos ni JavaScript propio: todo es un link.
  assert.doesNotMatch(html, /<button\b/, 'un <button> en una página sin JavaScript no hace nada');
  assert.doesNotMatch(html, /<script\b/, 'la página no lleva JavaScript propio');
  for (const f of ['app/accelerator/page.tsx', 'app/accelerator/LandingAcelerador.tsx', 'app/accelerator/contenido.ts', 'app/accelerator/estilo.ts', 'app/accelerator/Barra.tsx']) {
    assert.doesNotMatch(readFileSync(join(RAIZ, f), 'utf8'), /^\s*['"]use client['"]/m, `${f} es del servidor`);
  }
});

test('la campaña de la URL viaja en los cinco «Aplica ahora» (revisión del 16/11/2026: sin el referrer, se perdía)', async () => {
  const html = await pagina({ utm_source: 'fb', utm_campaign: 'acc-nov', fbclid: 'IwAR1', otra: 'x' });
  const aplica = botonesAplica(html);
  assert.equal(aplica.length, 5);
  const conCampaña = `${RUTA_APLICAR}?utm_source=fb&amp;utm_campaign=acc-nov&amp;fbclid=IwAR1`;
  for (const a of aplica) assert.equal(a.href, conCampaña, `un «${a.texto}» no lleva la campaña: ${a.attrs}`);
  assert.doesNotMatch(html, /otra=x/, 'una clave que no es de la campaña viajó');
});

test('«Ver planes» en el teléfono: debajo del «Aplica ahora» del héroe (en la barra no entra), y en la barra desde 600 px', async () => {
  // Medido el 16/11/2026 con Sora de verdad: en la barra del teléfono (320 a 430) sobran 10 a 30 px y la marca ya va en dos
  // renglones; a 768 sobraban 320 px y el link estaba escondido (se escondía hasta 880).
  const { CSS_BARRA_ACCELERATOR, RUTA_VER_PLANES, TEXTO_VER_PLANES } = await import('../app/accelerator/Barra');
  const heroe = (await pagina()).match(/<div class="acl-hero-cta">[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.match(heroe, new RegExp(`<a class="acl-hero-planes" href="${escapar(RUTA_VER_PLANES)}">${TEXTO_VER_PLANES}</a>`), 'el héroe no tiene «Ver planes» para el teléfono');
  assert.match(CSS_BARRA_ACCELERATOR, /\.acl-hero-planes \{ display: none; \}/, 'el «Ver planes» del héroe se ve también en la computadora');
  const telefono = CSS_BARRA_ACCELERATOR.slice(CSS_BARRA_ACCELERATOR.indexOf('@media (max-width: 599px)'));
  assert.match(telefono, /\.acl-root \.acl-hdr-link \{ display: none; \}/, 'en el teléfono la barra no esconde «Ver planes» (no entra)');
  assert.match(telefono, /\.acl-root \.acl-hero-planes \{ display: flex;[^}]*min-height: 44px/, 'el del héroe, del alto de un dedo');
  assert.doesNotMatch(CSS_BARRA_ACCELERATOR, /@media \(max-width: 880px\) \{\s*\.acl-hdr-link/, 'volvió a esconderse hasta 880 px');
});

test('«La inversión»: el precio arriba, sin cuotas, y TODO lo que incluye debajo, en UN bloque dorado con los ✓ verdes', async () => {
  // Martín, 16/11/2026, a la tarde: «me gustaría que la inversión como tal no exista, sino que esté todo dentro de lo que incluye
  // MaKo Accelerator. Y me gustaría que esa parte de lo que incluye se llame la inversión… no me gusta de que esté una columna
  // vertical sola y suelta… Y me gusta de que tenga como ese colorcito dorado, excepto los checks que sigan siendo verdes».
  const { LISTA_DEL_ACELERADOR } = await import('../lib/planes-mako');
  const { PRECIO, PROGRAMA } = await import('../app/accelerator/contenido');
  const { CSS_ACELERADOR, CSS_INVERSION } = await import('../app/accelerator/estilo');
  const html = await pagina();
  const bloques = html.match(/<section class="acl-sec acl-inversion-s"[\s\S]*?<\/section>/g) ?? [];
  assert.equal(bloques.length, 1, '«La inversión» tiene que estar, una vez');
  const b = texto(bloques[0]);
  const pr = PROGRAMA_ACELERADOR;
  // Arriba: la ceja, el nombre, el precio, cuánto dura y el botón al formulario. Debajo, «Incluye» y la lista entera.
  const arriba = `${PRECIO.ceja} ${pr.nombre} US$ ${pr.precioUsd.toLocaleString('es-AR')} ${pr.periodo} Aplica ahora ${PROGRAMA.incluyeCeja}`;
  assert.ok(b.trim().startsWith(arriba), `«La inversión» no arranca con el precio y el botón: ${b.slice(0, 160)}`);
  assert.equal(PRECIO.ceja, 'La inversión');
  for (const x of LISTA_DEL_ACELERADOR) assert.ok(b.includes(`${x.corto} ${x.detalle}`), `«La inversión» no trae «${x.corto}» con su detalle`);
  // UNO: ni la columna de /planes sola debajo, ni otro bloque de lo que incluye.
  assert.doesNotMatch(html, /mkpl-|acl-precio|acl-oferta/, 'volvió la columna de /planes (o el bloque aparte) a la landing');
  assert.doesNotMatch(texto(html), /Lo que incluye/, 'volvió el bloque «Lo que incluye» aparte');
  // SIN CUOTAS en ningún lado de la página (Martín: «en todos lados eliminemos lo de las 3 cuotas de 500»).
  assert.doesNotMatch(texto(html), /cuota/i, 'la landing vuelve a hablar de cuotas');
  // El dorado de la columna del Accelerator de /planes (el brillo en la esquina y el botón), y los ✓ verdes de la página.
  assert.match(CSS_INVERSION, /\.acl-inversion \{[^}]*radial-gradient\([^)]*rgba\(245,196,81,/, 'sin el brillo dorado');
  assert.match(CSS_INVERSION, /\.acl-root \.acl-btn-oro \{[^}]*background: #F5C451;[^}]*color: #2A1E00 !important;/, 'sin el botón dorado');
  assert.match(bloques[0], /<a href="\/accelerator\/aplicar" class="acl-btn acl-btn-oro">Aplica ahora<\/a>/, 'el botón de «La inversión» no es el dorado al formulario');
  assert.equal((bloques[0].match(/class="acl-mk acl-mk-c"/g) ?? []).length, LISTA_DEL_ACELERADOR.length, 'los ✓ de la lista no son los verdes de la página');
  assert.match(CSS_ACELERADOR, /\.acl-mk-c \{ background: [^}]*var\(--acl-verde\)/);
  assert.doesNotMatch(CSS_INVERSION, /\.acl-mk/, '«La inversión» le cambia el color a los ✓');
  // Y la columna de /planes (que sigue en /planes) dice lo mismo: el precio y cuánto dura, sin cuotas.
  const { TarjetaAccelerator } = await import('../app/planes/Tarjetas');
  const columna = texto(renderToStaticMarkup(createElement(TarjetaAccelerator, { boton: { href: '/accelerator', texto: 'MÁS INFORMACIÓN' } })));
  assert.ok(columna.includes(`US$ ${pr.precioUsd.toLocaleString('es-AR')} ${pr.periodo}`), `la columna de /planes no dice el precio con cuánto dura: ${columna.slice(0, 120)}`);
  assert.doesNotMatch(columna, /cuota/i, 'la columna de /planes vuelve a decir las cuotas');
});

test('el CSS: el de la landing, la barra y «La inversión», en ese orden; y el pie del sitio, del color de la página', async () => {
  const { CSS_ACELERADOR, CSS_INVERSION } = await import('../app/accelerator/estilo');
  const { CSS_BARRA_ACCELERATOR } = await import('../app/accelerator/Barra');
  const { CSS_TARJETAS } = await import('../app/planes/Tarjetas');
  const css = estilos(await pagina());
  const donde = [CSS_ACELERADOR, CSS_BARRA_ACCELERATOR, CSS_INVERSION].map((c) => css.indexOf(c));
  assert.ok(donde.every((i) => i >= 0), `falta un CSS en la página: ${donde.join(', ')}`);
  assert.deepEqual([...donde].sort((a, b) => a - b), donde, 'el CSS va en este orden: la landing, la barra y la inversión');
  assert.equal(css.includes(CSS_TARJETAS), false, 'la página carga el CSS de las tarjetas de /planes y ya no las dibuja');
  assert.ok(!CSS_INVERSION.includes('`'));
  // EL PIE DEL SITIO, DEL COLOR DE LA PÁGINA (Martín, 16/11: «la button bar no debería ser de otro color en MaKo Accelerator»):
  // el del sitio es azul noche; aquí, el fondo de la página. Con más peso que las reglas del pie, que van después.
  const fondo = CSS_ACELERADOR.match(/--acl-bg: (#[0-9a-f]{6});/i)?.[1];
  assert.ok(fondo, 'no encontré el fondo de la página');
  assert.match(CSS_ACELERADOR, new RegExp(`body:has\\(\\.acl-root\\) \\.s-sitio \\.s-pie \\{ background: ${fondo};`), 'el pie del sitio no va del color de la página');
  // MÁS BAJO («está exageradamente alta»): sin las columnas 2 a 6, que tienen que ser las cuatro familias de la app y las Industrias
  // (si el pie cambia el orden, se escondería otra cosa: por ejemplo Legal, con Reembolsos, que Meta pide en la página de destino).
  const { columnasDelPie } = await import('../app/vsl/_sitio/datos');
  const titulos = columnasDelPie().map((c) => c.titulo);
  assert.deepEqual(titulos.slice(1, 6), ['Today', 'Sales', 'Marketing', 'Create', 'Industrias'], `el pie cambió sus columnas: ${titulos.join(', ')}`);
  assert.deepEqual([titulos[0], ...titulos.slice(6)], ['Empezar', 'Recursos', 'Legal'], 'las que quedan a la vista en esta página ya no son Empezar, Recursos y Legal');
  for (const sel of ['.s-pie-cols > .s-pie-col', '.s-pie-pliegues > .s-pie-pliegue']) {
    assert.ok(CSS_ACELERADOR.includes(`body:has(.acl-root) .s-sitio ${sel}:nth-child(n+2):nth-child(-n+6)`), `${sel}: no se esconden la 2 a la 6`);
  }
  const html = await pagina();
  assert.match(html, /<div class="s-pie-cols">/, 'el pie cambió su estructura: revisar qué esconde esta página');
});

test('arriba, la barra de MaKo (vuelve a «/» y lleva a /planes); abajo, el pie del sitio, una vez', async () => {
  // Martín, 16/11/2026: «la top bar… me gusta… la que está ahora, pero no hay un botón… para volver a la landing principal o el
  // coso de MaKo para volver a la landing principal o ver los otros planes».
  const { BarraAccelerator, CSS_BARRA_ACCELERATOR, RUTA_VER_PLANES } = await import('../app/accelerator/Barra');
  const { TEXTO_APLICAR } = await import('../app/accelerator/contenido');
  const html = await pagina();
  const barra = renderToStaticMarkup(createElement(BarraAccelerator, { boton: { href: RUTA_APLICAR, texto: TEXTO_APLICAR } }));
  assert.equal(html.split(barra).length - 1, 1, 'la barra de arriba no es `BarraAccelerator` con «Aplica ahora», una vez');
  assert.equal((html.match(/<header\b/g) ?? []).length, 1, 'otra barra arriba');
  assert.match(barra, /<a class="acl-hdr-marca" href="\/"/, 'la marca no vuelve a la portada');
  assert.equal(RUTA_VER_PLANES, '/planes');
  assert.match(barra, new RegExp(`href="${escapar(RUTA_VER_PLANES)}">Ver planes</a>`), 'la barra no lleva a los planes');
  // La barra arranca la página (antes del héroe) y su CSS va después del de la landing (lo completa).
  assert.ok(html.indexOf(barra) < html.indexOf('class="acl-hero"'), 'la barra no está arriba');
  const css = estilos(html);
  const { CSS_ACELERADOR } = await import('../app/accelerator/estilo');
  assert.ok(css.indexOf(CSS_ACELERADOR) < css.indexOf(CSS_BARRA_ACCELERATOR), 'el CSS de la barra va antes que el de la landing');
  // EL PIE: el del sitio (`PieGlobal`, ./page.tsx), una vez; el propio de la landing (`.acl-pie`) se fue con su CSS.
  assert.equal(html.split('<footer class="s-pie">').length - 1, 1, 'el pie del sitio no está una vez');
  assert.equal((html.match(/<footer\b/g) ?? []).length, 1, 'quedó otro pie además del del sitio');
  assert.doesNotMatch(html, /acl-pie|acl-legales/, 'quedó el pie propio de la landing (o su CSS)');
});

test('los entregables: 4, 4 y 4 en dos columnas, del 1 al 12, con Appointment Setting y la fase 03 contada con MaKo', async () => {
  // Martín, 16/11/2026: «no me gusta de que las tarjetas queden 3 y 1, pondría 2 y 2. Y pondría también tal vez una más en
  // sistema de adquisición de clientes predecibles… que quede 4, 4 y 4»; y de Hiring Process y Delegation Framework, «que se
  // tenga mucho más en cuenta el software de MaKo… en esas partes».
  const { PROGRAMA } = await import('../app/accelerator/contenido');
  const { CSS_ACELERADOR } = await import('../app/accelerator/estilo');
  const { filasDeComparacion, nombreCorto } = await import('../lib/planes-comparacion');
  const { LISTA_DEL_ACELERADOR } = await import('../lib/planes-mako');
  assert.deepEqual(PROGRAMA.fases.map((f) => f.entregables.length), [4, 4, 4], 'cada fase tiene que tener cuatro');
  const html = await pagina();
  const t = texto(html);
  for (let i = 1; i <= 12; i++) assert.ok(t.includes(`Entregable #${i}:`), `falta el entregable #${i}`);
  assert.ok(!t.includes('Entregable #13:'));
  // Cada grilla dibujada, hasta donde empieza lo que sigue (la nota de la fase 02, la fase siguiente o «Y en las tres fases»).
  const grillas = html.split('<div class="acl-entregables">').slice(1)
    .map((g) => g.split(/<div class="acl-creativos">|<div class="acl-fase">|<p class="acl-siempre-lbl">/)[0]);
  assert.deepEqual(grillas.map((g) => (g.match(/class="acl-deliv"/g) ?? []).length), [4, 4, 4], 'las grillas dibujadas no son de 4');
  // DOS COLUMNAS en la computadora (2 y 2), una en el teléfono.
  assert.match(CSS_ACELERADOR, /\.acl-entregables \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/, 'los entregables no van en dos columnas');
  const telefono = CSS_ACELERADOR.slice(CSS_ACELERADOR.indexOf('@media (max-width: 880px)'));
  assert.match(telefono, /\.acl-entregables, [^{]*\{ grid-template-columns: 1fr;/, 'en el teléfono los entregables no van en una columna');
  // La fase 02, en el orden de la venta: marketing → leads → agenda → cierre. Appointment Setting con su calendario.
  const f2 = PROGRAMA.fases[1].entregables;
  assert.deepEqual(f2.map((e) => e.nombre), ['Marketing Ecosystem', 'Lead Generation', 'Appointment Setting', 'Closing Method']);
  const antesDelSetting = html.slice(0, html.indexOf('<h4>Appointment Setting</h4>'));
  const icono = antesDelSetting.slice(antesDelSetting.lastIndexOf('<svg')).match(/^<svg[^>]*>/)?.[0] ?? '';
  assert.match(icono, /lucide-calendar-check/, 'Appointment Setting sin el ícono del calendario');
  // El setter NO agenda: no ve la agenda, manda el link para que la persona elija (lib/flujo-ia.ts, regla 4; revisión del 16/11/2026).
  const setter = f2.find((e) => e.nombre === 'Appointment Setting')!.texto;
  assert.doesNotMatch(setter, /le agenda|agenda la llamada/, 'el #7 promete que MaKo agenda la llamada');
  assert.match(setter, /le manda tu agenda para que elija el horario/);
  // CON MaKo, y sólo con lo que MaKo tiene: cada función que nombran es una que /planes vende con ese nombre.
  const que = (nombre: string) => PROGRAMA.fases.flatMap((f) => f.entregables).find((e) => e.nombre === nombre)!.texto;
  const vende = new Set([...filasDeComparacion().map((f) => nombreCorto(f.que).toLowerCase()), ...LISTA_DEL_ACELERADOR.map((x) => x.corto.toLowerCase())]);
  for (const [nombre, funcion] of [
    ['Appointment Setting', 'setter con IA'], ['Operations & Metrics', 'tablero de resultados'],
    ['Hiring Process', 'análisis de llamadas'], ['Delegation Framework', null],
  ] as const) {
    assert.match(que(nombre), /\bMaKo\b/, `${nombre} no cuenta lo que hace MaKo`);
    if (funcion) {
      assert.ok(que(nombre).toLowerCase().includes(funcion.toLowerCase()), `${nombre} ya no nombra «${funcion}»`);
      assert.ok(vende.has(funcion.toLowerCase()), `${nombre} nombra «${funcion}» y /planes no lo vende con ese nombre: revisar el texto`);
    }
  }
  // Del largo de los otros (los de siempre van de 89 a 134 caracteres): una tarjeta no puede ser un párrafo.
  for (const e of PROGRAMA.fases.flatMap((f) => f.entregables)) assert.ok(e.texto.length >= 80 && e.texto.length <= 150, `${e.nombre}: ${e.texto.length} caracteres`);
});

test('el filtro dice el corte de la aplicación (más de US$ 5.000, con clientes y oferta validada), y Axel es agencia y academia', async () => {
  // Martín, 16/11/2026: «pon facturas más de 5.000 está bien. Y no pondría con clientes recurrentes. Pondría con oferta
  // validada. Con clientes y oferta validada pondría».
  const { FILTRO, HERO } = await import('../app/accelerator/contenido');
  const t = texto(await pagina());
  const corte = FILTRO.si[0].d;
  assert.match(corte, /\bmás de \$5\.000 USD al mes\b/, `el filtro no dice «más de $5.000»: ${corte}`);
  assert.match(corte, /\bcon clientes y oferta validada\b/, `el filtro no dice «con clientes y oferta validada»: ${corte}`);
  assert.doesNotMatch(corte, /\bentre\b/i, 'volvió el «entre $5K-$10K»: quien factura más también es para el programa');
  // El mismo corte que la calificación del héroe y que la aplicación (`califica`, lib/aplicacion-accelerator.ts): la primera
  // opción de facturación es «Menos de US$ 5.000» y es la única que no califica.
  const monto = (s: string) => s.match(/\$\s?([\d.]+)/)?.[1];
  assert.equal(monto(HERO.calificacion[1]), monto(corte), 'el héroe y el filtro dicen cortes distintos');
  const facturacion = campo('facturacion').opciones!;
  assert.equal(monto(facturacion[0]), monto(corte), `la aplicación corta en «${facturacion[0]}» y la landing en ${monto(corte)}`);
  const resto = { clientes: 1, situacion: 0, inversion: 0 };
  assert.equal(califica({ ...resto, facturacion: 0 }), false, `«${facturacion[0]}» califica y la landing dice «más de»`);
  assert.equal(califica({ ...resto, facturacion: 1 }), true, `«${facturacion[1]}» no califica y la landing dice que es para ti`);
  assert.ok(t.includes(corte), 'el filtro no se dibuja');
  assert.ok(FILTRO.no.some((x) => /^No tienes clientes\b/.test(x.d)), 'el «no es para ti» de la oferta sin validar ya no dice los clientes');
  // Axel: «Axel es ambos, es una agencia y es una academia».
  assert.ok(t.includes('Axel — Agencia y academia de IA'), 'el caso de Axel no dice agencia y academia');
  assert.ok(t.includes('en la agencia y academia de IA de Axel'), 'la metodología no dice agencia y academia');
  assert.doesNotMatch(t, /agencia de IA de Axel|Axel — Agencia de IA/, 'quedó Axel como sólo agencia');
});

test('la barra de abajo del teléfono aparece con el caso de Mauricio y la sección de aplicar le pasa por encima', async () => {
  const html = await pagina();
  // El tramo donde se pega (`position: sticky`) arranca en Mauricio. Arrancaba en los pasos, pegado al héroe, y con su margen
  // negativo la barra subía hasta la primera pantalla, encima del «Aplica ahora» del héroe.
  assert.match(html, /<div class="acl-tramo"><section class="acl-sec acl-mau-s">/, 'el tramo de la barra no arranca en el caso de Mauricio');
  // Termina con la barra, y la sección de aplicar va JUSTO después: es la que la tapa al llegar (sin eso, la barra sube con la
  // página y queda suelta a mitad de pantalla).
  assert.match(html, /<div class="acl-pegado"><a [^>]*>Aplica ahora<\/a><\/div><\/div><section class="acl-sec acl-final" id="aplicar">/,
    'la sección de aplicar no va justo después del tramo de la barra');
  const { CSS_ACELERADOR } = await import('../app/accelerator/estilo');
  const regla = (sel: string) => CSS_ACELERADOR.match(new RegExp(`${escapar(sel)} \\{([^}]*z-index: \\d+[^}]*)\\}`))?.[1] ?? '';
  const z = (sel: string) => Number(regla(sel).match(/z-index: (\d+)/)?.[1]);
  assert.ok(z('.acl-tramo + .acl-final') > z('.acl-pegado'), 'la sección de aplicar no le pasa por encima a la barra');
  assert.doesNotMatch(regla('.acl-pegado'), /margin-top: -/, 'la barra volvió a tener margen negativo: sube por encima de su tramo');
  const alto = regla('.acl-pegado').match(/height: (\d+)px/)?.[1];
  assert.ok(alto, 'la barra no tiene alto fijo');
  assert.match(regla('.acl-tramo + .acl-final'), new RegExp(`margin-top: -${alto}px`), 'la sección de aplicar no se monta sobre el alto exacto de la barra');
  // Y mientras se ve «La inversión», también le pasa por encima: tiene su botón, y con la barra de arriba eran tres «Aplica ahora»
  // en la misma pantalla del teléfono. Opaca, o la barra se ve a través.
  const { CSS_INVERSION } = await import('../app/accelerator/estilo');
  const inversion = CSS_INVERSION.match(/@media \(max-width: 880px\) \{\s*\.acl-inversion-s \{([^}]*)\}/)?.[1] ?? '';
  assert.ok(Number(inversion.match(/z-index: (\d+)/)?.[1]) > z('.acl-pegado'), 'en el teléfono la barra de abajo tapa «La inversión»');
  assert.match(inversion, /position: relative;/);
  assert.match(inversion, /background: var\(--acl-bg\);/, '«La inversión» no es opaca: la barra se ve a través');
});

test('el VSL es el de Lovable (Martín, 16/11: «pone el VSL que ya estaba ahí»), y cada foto y video existe en public/', async () => {
  const html = await pagina();
  assert.match(html, /<iframe [^>]*src="https:\/\/player-vz-dd4ad08b-375\.tv\.pandavideo\.com\.br\/embed\/\?v=d0b3e8db-29b7-4e73-a350-b9ce7bd9f81f"/, 'el VSL de Panda');
  const medios = [...html.matchAll(/<(?:img|video)\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(medios.length >= 7, `fotos y videos: ${medios.length}`);
  for (const src of medios) {
    assert.ok(src.startsWith('/vsl-assets/'), `${src} no es de public/vsl-assets`);
    assert.ok(existsSync(join(RAIZ, 'public', src)), `${src} no existe en public/`);
  }
});

test('la página vive donde lleva el «Más información» de /planes, es pública y sólo se lee', async () => {
  const { RUTA_ACCELERATOR } = await import('../app/planes/Tarjetas');
  assert.ok(existsSync(join(RAIZ, 'app', RUTA_ACCELERATOR, 'page.tsx')), `el botón de /planes lleva a ${RUTA_ACCELERATOR} y la landing no está ahí`);
  assert.equal(esPublica(RUTA_ACCELERATOR), true, 'quien no tiene cuenta tiene que poder abrirla');
  assert.equal(esPublicaSoloLeer(RUTA_ACCELERATOR), true, 'una página pública no acepta POST (ejecutaría server actions sin sesión)');
  assert.equal(esPublica(`${RUTA_ACCELERATOR}es`), false, 'el prefijo no se hereda a otra ruta');
  const { metadata } = await import('../app/accelerator/page');
  assert.equal(metadata.title, PROGRAMA_ACELERADOR.nombre);
});

// Roturas (15/11/2026, segunda vuelta; base 9 / 0), cada una restaurada (pasan / fallan):
//   · Mauricio vuelve a «más de $50.000»                                   -> 8 / 1
//   · vuelve «Una sesión 1:1 por semana» a la tarjeta                      -> 7 / 2 (la tarjeta contra el programa, y lo viejo)
//   · la tarjeta dice «Cuatro sesiones» (el programa dice 3)               -> 8 / 1
//   · el filtro vuelve a «¿Esto es realmente para vos?»                    -> 7 / 2 (el voseo, y el orden de la promesa)
//   · lo que incluye se dibuja sin su primer renglón                       -> 8 / 1
//   · lo que incluye pierde el detalle (queda igual que la columna)        -> 8 / 1
//   · lo que incluye vuelve a aclarar las 10 horas                         -> 8 / 1
//   · se va «MaKo Pro completo»                                            -> 8 / 1
//   · vuelve el sello «Garantía por contrato»                              -> 8 / 1
//   · se va «Conmigo, no con un equipo.»                                   -> 8 / 1
//   · vuelve «conmigo y con mi equipo»                                     -> 8 / 1
//   · vuelve «todo lo que haga falta»                                      -> 8 / 1
//   · vuelve el Blueprint «Sesión 1:1 donde armamos juntos…»               -> 8 / 1
//   · el tramo de la barra arranca antes del caso de Mauricio              -> 8 / 1
//   · la barra vuelve a tener margin-top: -86px                            -> 8 / 1
//   · la sección de aplicar queda debajo de la barra (z-index 89)          -> 8 / 1
//   · la barra pasa a 96 px y el margen de la sección sigue en -86         -> 8 / 1
//   · '/accelerator' fuera de PUBLICOS (lib/rutas-publicas.ts)             -> 8 / 1
//   · vuelve un «Nombre Apellido»                                          -> 8 / 1
//
// Roturas (16/11/2026; base 14 / 0), cada una restaurada (pasan / fallan):
//   · el «Aplica ahora» del héroe vuelve a bajar a #aplicar                -> 13 / 1
//   · el de la barra de abajo del teléfono vuelve a bajar a #aplicar       -> 13 / 1
//   · el botón final vuelve a «Agenda tu llamada» (Calendly)               -> 13 / 1
//   · la tarjeta dice «Aplica ahora» en minúscula                          -> 13 / 1
//   · la tarjeta del precio, copiada a mano (sin su lista)                 -> 13 / 1
//   · /planes vuelve a abrir la agenda desde la columna                    -> 13 / 1
//   · la columna ignora el botón que le pasan (siempre a /accelerator)     -> 12 / 2
//   · CSS_TARJETAS va antes que el de la landing                           -> 13 / 1
//   · el título de la tarjeta queda en Sora (sin el font-family: inherit)  -> 13 / 1
//   · la letra de la tarjeta deja de ser la de /planes (17 px)             -> 13 / 1
//   · una regla de CSS_TARJETAS sin mkpl- (pisaría los h3 de la landing)   -> 13 / 1
//   · vuelve la barra de arriba vieja (sin «/» ni «Ver planes»)            -> 13 / 1
//   · vuelve el pie propio (.acl-pie)                                      -> 13 / 1
//   · la fase 02 vuelve a 3 (sin Appointment Setting)                      -> 13 / 1
//   · los entregables vuelven a 3 columnas                                 -> 13 / 1
//   · Hiring Process vuelve al texto de Lovable (sin MaKo)                 -> 13 / 1
//   · Appointment Setting deja de nombrar el setter con IA                 -> 13 / 1
//   · el filtro vuelve a «entre $5K-$10K… clientes recurrentes»            -> 12 / 2 (el filtro, y lo viejo)
//   · el filtro corta en $3.000 (la aplicación, en 5.000)                  -> 13 / 1
//   · vuelve «recurrentes» al «no es para ti»                              -> 13 / 1
//   · Axel vuelve a «Agencia de IA»                                        -> 13 / 1
//   · vuelve la promesa al lado de lo que incluye                          -> 13 / 1
//   · en el teléfono la barra de abajo vuelve a tapar el precio            -> 13 / 1
//   · la sección del precio, transparente (la barra se ve a través)        -> 13 / 1
// Revisión del 16/11/2026 (base 16 / 0), cada rotura sola y restaurada:
//   · los «Aplica ahora» sin la campaña de la URL                          -> 15 / 1
//   · sin «Ver planes» en el héroe del teléfono                            -> 15 / 1
//   · «Ver planes» se esconde otra vez de la barra hasta 880 px            -> 15 / 1
//   · el #7 vuelve a prometer que MaKo «le agenda la llamada»              -> 15 / 1
// Tercera tanda (16/11/2026, a la tarde; base 16 / 0; scratchpad/ronda-3/accelerator/romper.cjs), cada rotura sola y restaurada:
//   · vuelven las cuotas a la columna de /planes                           -> 15 / 1
//   · los ✓ de «La inversión», de otro color                               -> 15 / 1
//   · «La inversión» sin el brillo dorado                                  -> 15 / 1
//   · el pie del sitio vuelve al azul noche                                -> 15 / 1
//   · debajo del precio, las cuotas                                        -> 15 / 1
//   · en el teléfono la barra de abajo tapa «La inversión»                 -> 15 / 1
//   · el Blueprint pasa de 150 caracteres                                  -> 15 / 1
//   · el pie de esta página esconde también Recursos y Legal               -> 15 / 1
//   Y en tests/planes-tres-bloques.test.ts: vuelve `cuotas: 3` al Accelerator -> 26 / 1.
