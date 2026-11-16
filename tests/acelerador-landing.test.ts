// =============================================================================
// /accelerator: la landing de Martín traída de Lovable, con el programa de HOY (15/11/2026)
// =============================================================================
// Martín, 15/11/2026: «revisa esa nueva landing, los copies que tiene, porque hay cosas que cambiar. Por ejemplo, el
// testimonio de Mauricio, que hoy en día ya vamos más de $100.000 facturados… hay varias partes donde menciona el
// acompañamiento 1 a 1 conmigo, y eso ya no es así… Entonces revisa bien todos los copies de ahí».
//
// Lo que se fija acá, sobre la página DIBUJADA (renderToStaticMarkup), no sobre el fuente:
//   · lo que incluye y la promesa son los del programa (`LISTA_DEL_ACELERADOR`, con el detalle de cada renglón, y
//     `PROGRAMA_ACELERADOR.promesa`, lib/planes-mako.ts), importados: la misma lista que la columna de /planes; si la oferta
//     cambia allá, cambia acá; y lo que está escrito a mano al lado (la tarjeta del acompañamiento) dice lo mismo que esa
//     lista y que el contrato (`PROGRAMA_ACELERADOR.incluye`), o se pone rojo;
//   · ninguna garantía: Martín la sacó «de todos lados» el 15/11 a la noche (el sello «Garantía por contrato» que tuvo esta
//     página la siguió afirmando después de que la fuente la sacó: ver la cosecha en docs/hallazgos-landing.md);
//   · los textos que Martín corrigió no vuelven: los $50.000 de Mauricio, la sesión 1:1 por semana, el «1 a 1» del
//     acompañamiento, «No es una mentoría grupal», los testimonios de relleno («Nombre Apellido»), «Marketing Koncept», el
//     encuentro en Buenos Aires y un equipo que Martín no tiene; «Conmigo, no con un equipo» SÍ queda;
//   · el texto está en «tú» (el de Lovable estaba en «vos»);
//   · todo «Aplica ahora» baja a #aplicar, y ahí el único botón de verdad abre la agenda de Martín en otra pestaña;
//   · la barra de abajo del teléfono aparece con el caso de Mauricio y la tapa la sección de aplicar;
//   · la página vive donde lleva el «Más información» de /planes (`RUTA_ACCELERATOR`), es pública, y sólo se lee.
//
// Correr: node --import tsx --test tests/acelerador-landing.test.ts
//
// Probado rompiéndolo (15/11/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROGRAMA_ACELERADOR } from '../lib/planes-mako';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';

const RAIZ = join(import.meta.dirname, '..');

/** El HTML de la página, como lo dibuja el servidor. */
async function pagina(): Promise<string> {
  const React = await import('react');
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Pagina } = await import('../app/accelerator/page');
  return renderToStaticMarkup(React.createElement(Pagina));
}

/** Lo que se LEE: sin estilos, los bloques separados por un espacio, las marcas de adentro de una frase sin espacio. */
const BLOQUES = /<\/?(div|p|li|ul|ol|h[1-6]|section|header|footer|main|nav|br|iframe|video|img|small)\b[^>]*>/g;
const texto = (html: string) => html
  .replace(/<style[\s\S]*?<\/style>/g, ' ').replace(BLOQUES, ' ').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

test('lo que incluye y la promesa son los del programa (lib/planes-mako.ts), importados', async () => {
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
  assert.ok(promesa, 'el Accelerator no tiene promesa en lib/planes-mako.ts');
  assert.ok(t.includes(promesa!), 'la promesa no es la del programa');
  // Va después de «Y en las tres fases, siempre» (donde la tarea pidió sumarla) y antes del filtro.
  assert.ok(t.indexOf('Y en las tres fases, siempre:') < t.indexOf(promesa!), 'la promesa no está en el bloque del programa');
  assert.ok(t.indexOf(promesa!) < t.indexOf('¿Esto es realmente para ti?'), 'la promesa quedó después del filtro');
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
  // La marca: arriba, en lo que incluye y en el pie.
  assert.ok((t.match(new RegExp(escapar(PROGRAMA_ACELERADOR.nombre), 'g')) ?? []).length >= 3, `${PROGRAMA_ACELERADOR.nombre}, arriba, en la oferta y en el pie`);
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

test('todo «Aplica ahora» baja a #aplicar, y ahí el único botón de verdad abre la agenda de Martín en otra pestaña', async () => {
  // La agenda ES el formulario del paso 1 («Aplicas en el formulario»): pide siete respuestas obligatorias antes de confirmar
  // (app/accelerator/contenido.ts, `APLICAR`; leído en la consulta pública de Calendly el 15/11/2026).
  const { AGENDA_ACELERADOR, TEXTO_AGENDA_ACELERADOR } = await import('../app/planes/Tarjetas');
  const html = await pagina();
  const aplica = [...html.matchAll(/<a\b([^>]*)>Aplica ahora<\/a>/g)];
  assert.ok(aplica.length >= 3, `los «Aplica ahora» (arriba, en el héroe y abajo en el teléfono): ${aplica.length}`);
  for (const [, attrs] of aplica) assert.match(attrs, /href="#aplicar"/, `un «Aplica ahora» no baja a #aplicar: ${attrs}`);
  assert.equal((html.match(/id="aplicar"/g) ?? []).length, 1, 'la sección de aplicar tiene que existir, una sola vez');
  const seccion = html.slice(html.indexOf('id="aplicar"'), html.indexOf('</section>', html.indexOf('id="aplicar"')));
  assert.match(seccion, new RegExp(`<a [^>]*href="${escapar(AGENDA_ACELERADOR)}" target="_blank" rel="noopener noreferrer">${escapar(TEXTO_AGENDA_ACELERADOR)}</a>`),
    'el botón final no abre la agenda de Martín en otra pestaña');
  assert.equal((html.match(/calendly\.com/g) ?? []).length, 1, 'la agenda aparece en otro lugar de la página');
  // Sin botones muertos ni JavaScript propio: todo es un link.
  assert.doesNotMatch(html, /<button\b/, 'un <button> en una página sin JavaScript no hace nada');
  assert.doesNotMatch(html, /<script\b/, 'la página no lleva JavaScript propio');
  for (const f of ['app/accelerator/page.tsx', 'app/accelerator/LandingAcelerador.tsx', 'app/accelerator/contenido.ts', 'app/accelerator/estilo.ts']) {
    assert.doesNotMatch(readFileSync(join(RAIZ, f), 'utf8'), /^\s*['"]use client['"]/m, `${f} es del servidor`);
  }
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
});

test('el VSL es el de Lovable, y cada foto y video existe en public/', async () => {
  const html = await pagina();
  assert.match(html, /<iframe [^>]*src="https:\/\/player-vz-dd4ad08b-375\.tv\.pandavideo\.com\.br\/embed\/\?v=d0b3e8db-29b7-4e73-a350-b9ce7bd9f81f"/, 'el VSL de Panda');
  const medios = [...html.matchAll(/<(?:img|video)\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(medios.length >= 7, `fotos y videos: ${medios.length}`);
  for (const src of medios) {
    assert.ok(src.startsWith('/vsl-assets/'), `${src} no es de public/vsl-assets`);
    assert.ok(existsSync(join(RAIZ, 'public', src)), `${src} no existe en public/`);
  }
  // Los 11 entregables, numerados del 1 al 11.
  const t = texto(html);
  for (let i = 1; i <= 11; i++) assert.ok(t.includes(`Entregable #${i}:`), `falta el entregable #${i}`);
  assert.ok(!t.includes('Entregable #12:'));
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
//   · la promesa no se dibuja                                              -> 8 / 1
//   · vuelve el sello «Garantía por contrato»                              -> 8 / 1
//   · se va «Conmigo, no con un equipo.»                                   -> 8 / 1
//   · vuelve «conmigo y con mi equipo»                                     -> 8 / 1
//   · vuelve «todo lo que haga falta»                                      -> 8 / 1
//   · vuelve el Blueprint «Sesión 1:1 donde armamos juntos…»               -> 8 / 1
//   · el botón final lleva a #aplicar en vez de a la agenda                -> 8 / 1
//   · un «Aplica ahora» lleva a /planes                                    -> 8 / 1
//   · el tramo de la barra arranca antes del caso de Mauricio              -> 8 / 1
//   · la barra vuelve a tener margin-top: -86px                            -> 8 / 1
//   · la sección de aplicar queda debajo de la barra (z-index 89)          -> 8 / 1
//   · la barra pasa a 96 px y el margen de la sección sigue en -86         -> 8 / 1
//   · '/accelerator' fuera de PUBLICOS (lib/rutas-publicas.ts)             -> 8 / 1
//   · vuelve un «Nombre Apellido»                                          -> 8 / 1
