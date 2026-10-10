// =============================================================================
// El filtro del CRM por CAMPAÑA y por CREATIVO (06/10/2026)
// =============================================================================
// Pedido de Martín: «en el CRM pon un filtro por creativo o por campaña, para ver de qué
// ads vinieron los leads». La atribución es pura (lib/campana-atribucion.ts) y se EJECUTA;
// el cableado del tablero se fija leyendo el fuente sin comentarios.
//
// PROBADO ROMPIÉNDOLO — el resultado de cada rotura está al lado de su test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapaDeAnuncios, origenAds, opcionesDeFiltro, arbolDeAnuncios, pasaFiltroAnuncio, SIN_ORIGEN_ADS } from '../lib/campana-atribucion';
import { alternarGrupo, alternarHijo, conGrupoAbierto } from '../app/crm/arbol-seleccion';
import { lugarDelPanel, ANCHO_PANEL, MARGEN_VENTANA } from '../app/crm/filtro-panel';
import { claveFiltros, escribirFiltros, leerFiltros, SIN_FILTROS } from '../app/crm/filtros-guardados';
import { canalDeLead } from '../app/crm/origen-lead';

const CAMP = '120000000000000001';
const AD = '340000000000000001';
const AD2 = '340000000000000002';
const anuncios = mapaDeAnuncios([{ ad_id: AD, campaign_id: CAMP, adset_id: '230000000000000001' }]);
const campMap = { [CAMP]: 'Verano · nombre de hoy' };
const adMap = { [AD]: 'Video 1', [AD2]: 'Carrusel' };

// PROBADO ROMPIÉNDOLO: con la campaña sacada de `l.meta_campaign_id` solo (sin
// `campanaDeLead`), el lead del formulario queda en «Sin campaña» y cae este test.
test('un lead del formulario trae el ANUNCIO, y de ahí sale su campaña con el nombre de hoy', () => {
  const r = origenAds({ id: 1, meta_ad_id: AD, meta_campaign_name: 'Verano · nombre viejo' }, anuncios, campMap, adMap);
  assert.equal(r.campanaKey, CAMP, 'la clave es el id, no el nombre');
  assert.equal(r.campanaNombre, 'Verano · nombre de hoy', 'una campaña renombrada se ve con su nombre de hoy');
  assert.equal(r.anuncioKey, AD);
  assert.equal(r.anuncioNombre, 'Video 1');
});

test('la landing: el id de la campaña viene en utm_campaign y el anuncio en utm_content', () => {
  const r = origenAds({ id: 2, utm_campaign: CAMP, utm_content: AD2 + '000' }, anuncios, campMap, adMap);
  assert.equal(r.campanaKey, CAMP);
  // utm_content con un número de 21 dígitos no es un id de anuncio (los de Meta tienen
  // 15-18): no se inventa un creativo.
  assert.equal(r.anuncioKey, null);
});

test('sin id pero con NOMBRE guardado, la clave es el nombre — no se tira a «Sin campaña»', () => {
  const r = origenAds({ id: 3, meta_campaign_name: 'Campaña vieja', meta_ad_name: 'Anuncio viejo' }, anuncios, campMap, adMap);
  assert.equal(r.campanaKey, 'n:Campaña vieja');
  assert.equal(r.anuncioKey, 'n:Anuncio viejo');
  // Y un utm_campaign con NOMBRE también sirve para mostrar, pero nunca decide un id.
  assert.equal(origenAds({ id: 4, utm_campaign: 'promo-octubre' }, anuncios, campMap, adMap).campanaKey, 'n:promo-octubre');
});

test('sin nada, null en los dos: el lead va a «Sin campaña» / «Sin creativo»', () => {
  const r = origenAds({ id: 5 }, anuncios, campMap, adMap);
  assert.deepEqual(r, { campanaKey: null, campanaNombre: null, anuncioKey: null, anuncioNombre: null });
});

// PROBADO ROMPIÉNDOLO: con el `sort` quitado, el orden sale por aparición y cae.
test('las opciones van de la que más leads tiene a la que menos, y «Sin …» al final', () => {
  const op = opcionesDeFiltro([
    { key: 'a', nombre: 'A' }, { key: null, nombre: null }, { key: 'b', nombre: 'B' }, { key: 'b', nombre: 'B' },
  ], 'Sin campaña');
  assert.deepEqual(op, [
    { value: 'b', label: 'B', n: 2 },
    { value: 'a', label: 'A', n: 1 },
    { value: SIN_ORIGEN_ADS, label: 'Sin campaña', n: 1 },
  ]);
  assert.deepEqual(opcionesDeFiltro([{ key: 'a', nombre: 'A' }], 'Sin campaña').map((o) => o.value), ['a'], '«Sin …» sólo si hay');
});

const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// PROBADO ROMPIÉNDOLO: con la línea del filtro borrada de `matches`, cae.
test('el tablero filtra por campaña Y anuncio con UNA regla, y las ofrece en el menú', () => {
  const b = sinComentarios(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  // Las dos selecciones del árbol pasan por la misma función (que es «O»: ver su test).
  assert.match(b, /salvo !== 'ads' && !pasaFiltroAnuncio\(l, campanaFilter, creativoFilter\)\) return false/);
  assert.match(b, /listas=\{listasFiltro\}/, 'el menú recibe las listas');
  // Y limpiar todo también las limpia: un filtro que «Limpiar» no saca es invisible.
  assert.match(b, /const limpiarTodo = \(\) => \{[^}]*setCampanaFilter\(new Set\(\)\);[^}]*setCreativoFilter\(new Set\(\)\);/);
  // La página le pasa la atribución al mapper: sin esto los cuatro campos van en null y el
  // filtro existe sin opciones.
  const page = sinComentarios(readFileSync('app/crm/page.tsx', 'utf8'));
  assert.match(page, /mapToCrmLead\(l, campMap, validStageKeys, atrib\)/);
});

// =============================================================================
// 10/10/2026 — «Acá al filtrar, en campaña, y en Origen, aparece lo mismo. Y falta el
// filtro de ANUNCIO, para filtrar por un ad específico.» (Martín)
// =============================================================================
// Los dos síntomas tenían causas distintas, y ninguna estaba en la atribución, que ya
// tenía su test (el de la landing, arriba, pasaba):
//   · el ANUNCIO no aparecía porque el tablero no PEDÍA `utm_content`: la función
//     entendía el id y nunca le llegaba. Función verde, cableado sin datos.
//   · el ORIGEN repetía las campañas porque el filtro listaba `origenLegible`, que dice
//     lo más específico que se sabe (anuncio › campaña › canal) — bien para la tarjeta,
//     mal para un filtro que tiene a «Campaña» y «Anuncio» al lado.

/** Las columnas que baja el tablero. Los comentarios se sacan ANTES de buscar el `;`: el
 *  de las cuatro columnas nuevas tiene uno, y cortar ahí dejaría la lista a la mitad. */
function columnasDelTablero(): Set<string> {
  const src = sinComentarios(readFileSync('lib/leads.ts', 'utf8'));
  const i = src.indexOf('const LISTA_COLS =');
  const bloque = src.slice(i, src.indexOf(';', i));
  assert.ok(i > 0 && bloque.length > 200, `LISTA_COLS mide ${bloque.length}`);
  return new Set([...bloque.matchAll(/'([^']*)'/g)].flatMap((m) => m[1].split(',')).map((c) => c.trim()).filter(Boolean));
}

/** Los campos `lead.X` que lee una función, leídos de su cuerpo real. */
function camposQueLee(archivo: string, firma: string): string[] {
  const src = sinComentarios(readFileSync(archivo, 'utf8')).replace(/\r/g, '');
  const i = src.indexOf(firma);
  assert.ok(i > 0, `no encontré ${firma} en ${archivo}`);
  const cuerpo = src.slice(i, src.indexOf('\n}\n', i));
  return [...new Set([...cuerpo.matchAll(/\blead\.(\w+)/g)].map((m) => m[1]))];
}

test('el tablero baja TODAS las columnas que leen sus mappers (si no, el filtro existe sin datos)', () => {
  const cols = columnasDelTablero();
  // Lo que lee la atribución (el filtro por campaña y por anuncio), sacado del TIPO que
  // recibe — no de una lista copiada acá, que se quedaría vieja con el próximo campo.
  // `funnel_id` queda afuera a propósito: el tablero filtra por ella en el server y su
  // comentario en `Lead` lo dice.
  const atrib = sinComentarios(readFileSync('lib/campana-atribucion.ts', 'utf8'));
  const t0 = atrib.indexOf('export type LeadAtribuible = {');
  const camposAtrib = [...atrib.slice(t0, atrib.indexOf('};', t0)).matchAll(/^\s*(\w+)\??:/gm)]
    .map((m) => m[1]).filter((c) => c !== 'funnel_id');
  const requeridas = [
    ...camposAtrib,
    ...camposQueLee('app/crm/crm-map.ts', 'export function origenLegible('),
    ...camposQueLee('app/crm/origen-lead.ts', 'export function canalDeLead('),
  ];
  assert.ok(requeridas.includes('utm_content') && requeridas.includes('origen_lead'), 'la derivación tiene que ver las dos que faltaban');
  const faltan = [...new Set(requeridas)].filter((c) => !cols.has(c));
  assert.deepEqual(faltan, [], `el tablero no pide estas columnas y los mappers las leen: ${faltan.join(', ')}`);
  //   ROTO A PROPÓSITO (2026-10-10): devolviendo el bug —`utm_content` afuera del select—,
  //   pass 9 / fail 1; y sacando `origen_lead`, pass 9 / fail 1.
});

test('el filtro «Origen» lista el CANAL, no la campaña ni el anuncio', () => {
  const b = sinComentarios(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  assert.match(b, /originFilter\.size > 0 && !originFilter\.has\(l\.canal\)/);
  assert.match(b, /const originOptions = useMemo\(\(\) => \[\.\.\.new Set\(leads\.map\(\(l\) => l\.canal\)\)\]/);
  assert.doesNotMatch(b, /originFilter\.has\(l\.origin\)/, 'volvió el origen de la tarjeta al filtro');
  assert.match(sinComentarios(readFileSync('app/crm/crm-map.ts', 'utf8')), /canal: canalDeLead\(l\)/);
  //   ROTO A PROPÓSITO (2026-10-10): con el filtro otra vez sobre `l.origin`, pass 9 / fail 1.
});

test('canalDeLead: por dónde entró, con el formulario de Meta aunque falte la columna', () => {
  assert.equal(canalDeLead({ origen_lead: 'landing' }), 'Landing');
  assert.equal(canalDeLead({ origen_lead: 'calcom' }), 'Cal.com');
  assert.equal(canalDeLead({ origen_lead: null, meta_lead_id: '1234567890' }), 'Meta · Instant Form');
  assert.equal(canalDeLead({}), 'Sin origen');
  //   ROTO A PROPÓSITO (2026-10-10): con el lead de Meta sin columna cayendo a «Sin
  //   origen», pass 9 / fail 1.
});

test('el filtro por anuncio se llama «Anuncio», la palabra de Martín y del Ads Manager', () => {
  const b = sinComentarios(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  assert.match(b, /cat: 'creativo', label: 'Anuncio'/);
  assert.doesNotMatch(b, /label: 'Creativo'/);
  //   ROTO A PROPÓSITO (2026-10-10): con el rótulo otra vez «Creativo», pass 9 / fail 1.
});

// =============================================================================
// 10/10/2026, más tarde — «No separes el filtro de Campaña y Anuncio... Que dentro del
// filtro de "Anuncio" estén las campañas primero como arbol y dentro se pueda seleccionar
// anuncios de esas camapañas» (Martín)
// =============================================================================
// Eran dos categorías del menú, y qué anuncio era de qué campaña había que adivinarlo por
// el nombre. Ahora es UNA: la lista «Anuncio» trae las campañas (lo que elige
// `campanaFilter`) y, colgados de cada una, sus anuncios (lo que elige `creativoFilter`).

const ANA = { campKey: 'A', campNombre: 'Campaña A', adKey: 'a1', adNombre: 'Video 1' };
const PARES = [
  ANA, ANA,
  { campKey: 'A', campNombre: 'Campaña A', adKey: 'a2', adNombre: 'Carrusel' },
  { campKey: 'A', campNombre: 'Campaña A', adKey: null, adNombre: null },
  { campKey: 'B', campNombre: 'Campaña B', adKey: 'b1', adNombre: 'Foto' },
  { campKey: null, campNombre: null, adKey: null, adNombre: null },
];

test('arbolDeAnuncios: cada campaña con SUS anuncios, contando leads (no la suma de los hijos)', () => {
  const r = arbolDeAnuncios(PARES);
  assert.deepEqual(r.map((x) => [x.value, x.n]), [['A', 4], ['B', 1], [SIN_ORIGEN_ADS, 1]]);
  // La campaña A cuenta 4: también el lead sin anuncio conocido es de ella.
  assert.deepEqual(r[0].hijos, [{ value: 'a1', label: 'Video 1', n: 2 }, { value: 'a2', label: 'Carrusel', n: 1 }]);
  assert.deepEqual(r[1].hijos.map((h) => h.value), ['b1'], 'el anuncio de B no aparece bajo A');
  assert.deepEqual(r[2].hijos, [], '«Sin campaña» no inventa anuncios');
  //   ROTO A PROPÓSITO (2026-10-10): sin el filtro por campaña de los hijos (todos los anuncios bajo cada
  //   campaña), pass 14 / fail 1.
});

test('arbolDeAnuncios: lo elegido que hoy cuenta cero sigue en la lista, para poder destildarlo', () => {
  const r = arbolDeAnuncios(PARES.slice(0, 2), { campanas: new Set(['Z']), anuncios: new Set(['b1']) });
  assert.ok(r.some((x) => x.value === 'Z' && x.n === 0), 'la campaña elegida que no trae a nadie');
  assert.ok(r.some((x) => x.hijos.some((h) => h.value === 'b1' && h.n === 0)), 'el anuncio elegido que no trae a nadie');
  //   ROTO A PROPÓSITO (2026-10-10): sin el bucle de los anuncios elegidos, pass 14 / fail 1.
});

test('pasaFiltroAnuncio: campaña entera O anuncio suelto — «O», no «Y»', () => {
  const lead = (campanaKey: string | null, anuncioKey: string | null) => ({ campanaKey, anuncioKey });
  const todo = [lead('A', 'a1'), lead('A', null), lead('B', 'b1'), lead('B', 'b2'), lead(null, null)];
  const pasan = (c: string[], a: string[]) => todo.filter((l) => pasaFiltroAnuncio(l, new Set(c), new Set(a))).length;
  assert.equal(pasan([], []), 5, 'sin nada elegido no filtra');
  // La campaña A entera (con su lead sin anuncio) MÁS el anuncio b1 de la campaña B.
  assert.equal(pasan(['A'], ['b1']), 3);
  assert.equal(pasan([], ['b1']), 1);
  assert.equal(pasan([SIN_ORIGEN_ADS], []), 1, '«Sin campaña» es elegible');
  //   ROTO A PROPÓSITO (2026-10-10): con «Y» (la campaña Y el anuncio a la vez), pass 14 / fail 1 — elegir A
  //   y b1 daba 0.
});

test('el árbol del menú: tildar una campaña la elige ENTERA; destildar un anuncio suyo deja los otros', () => {
  const vacio = { grupos: new Set<string>(), hijos: new Set<string>() };
  // Elegir la campaña suelta sus anuncios tildados: ya los cubre.
  const g = alternarGrupo({ grupos: new Set(), hijos: new Set(['a1', 'b1']) }, 'A', ['a1', 'a2']);
  assert.deepEqual([[...g.grupos], [...g.hijos]], [['A'], ['b1']]);
  // Con la campaña entera, destildar a1 es «todos menos a1».
  const h = alternarHijo(g, 'A', 'a1', ['a1', 'a2']);
  assert.deepEqual([[...h.grupos], [...h.hijos].sort()], [[], ['a2', 'b1']]);
  // Un anuncio suelto se tilda y se destilda.
  const t = alternarHijo(vacio, 'A', 'a1', ['a1', 'a2']);
  assert.deepEqual([...t.hijos], ['a1']);
  assert.deepEqual([...alternarHijo(t, 'A', 'a1', ['a1', 'a2']).hijos], []);
  // Y destildar la campaña la saca.
  assert.deepEqual([...alternarGrupo(g, 'A', ['a1', 'a2']).grupos], []);
  //   ROTO A PROPÓSITO (2026-10-10): con `alternarHijo` sacando el anuncio de `hijos` aunque la campaña
  //   esté entera (la casilla no se destildaba nunca), pass 14 / fail 1.
});

test('UN filtro: el menú no ofrece «Campaña» aparte, y el árbol usa las funciones de arriba', () => {
  const b = sinComentarios(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  const i = b.indexOf('const listasFiltro');
  const listas = b.slice(i, b.indexOf('const limpiarTodo', i));
  assert.ok(i > 0 && listas.length < 1500, `las listas del menú miden ${listas.length}`);
  assert.equal((listas.match(/cat: '/g) ?? []).length, 1, 'una sola lista: «Anuncio»');
  assert.match(listas, /hijos: \{ de: /, 'los anuncios cuelgan de su campaña');
  assert.doesNotMatch(listas, /label: 'Campaña'/);
  const t = sinComentarios(readFileSync('app/crm/CrmToolbar.tsx', 'utf8'));
  assert.match(t, /aplicar\(alternarGrupo\(\{ grupos: lista\.sel, hijos: arbol\.sel \}/);
  assert.match(t, /aplicar\(alternarHijo\(\{ grupos: lista\.sel, hijos: arbol\.sel \}/);
  //   ROTO A PROPÓSITO (2026-10-10): con una lista «Campaña» devuelta al lado de «Anuncio», pass 14 /
  //   fail 1.
});

// =============================================================================
// 10/10/2026, tercera vuelta — «1. El botón de desplegar debe estar a la derecha, no a la
// izquierda, siempre. Para las campañas. 2. Si clickeo una campaña […] quiero que se abra
// el desplegable cuando clickeo eso. 3. El ancho del desplegable debe ser más grande. Bajo
// ningún motivo debe tener scroll hacia la derecha.» (Martín)
// =============================================================================

test('el panel es más ancho y su borde derecho nunca pasa la ventana, en ningún ancho ni posición', () => {
  assert.ok(ANCHO_PANEL > 262, 'más ancho que el de antes');
  assert.deepEqual(lugarDelPanel(500, 1600), { ancho: ANCHO_PANEL, izq: 0 }, 'si entra, abre pegado al botón');
  // Y a la izquierda el tope es el CONTENIDO, no la ventana: la barra lateral mide 68 px y
  // queda encima (medido a 390 px: corrido hasta x=16, el panel quedaba debajo de ella).
  for (const ventana of [320, 375, 390, 414, 768, 1024, 1280, 1600, 1920]) {
    for (const izqMin of [MARGEN_VENTANA, 68 + MARGEN_VENTANA]) {
      for (let boton = izqMin; boton <= ventana; boton += 7) {
        const { ancho, izq } = lugarDelPanel(boton, ventana, izqMin);
        const borde = boton + izq + ancho;
        assert.ok(borde <= ventana - MARGEN_VENTANA, `ventana ${ventana}, botón en ${boton}: el panel termina en ${borde}`);
        assert.ok(boton + izq >= izqMin, `ventana ${ventana}, botón en ${boton}: empieza en ${boton + izq}, debajo de la barra`);
      }
    }
  }
  assert.deepEqual(lugarDelPanel(112, 390, 84), { ancho: 290, izq: -28 }, 'el celular de la medición: de 84 a 374');
  //   ROTO A PROPÓSITO (2026-10-10): sin correr el panel a la izquierda, pass 16 / fail 1; sin topear el
  //   ancho a la ventana, pass 16 / fail 1; con el ancho topeado contra la ventana y no contra
  //   el contenido (el panel debajo de la barra), pass 16 / fail 1.
});

test('el árbol: chevron a la DERECHA, tocar la campaña la despliega, y el panel no scrollea de costado', () => {
  const t = sinComentarios(readFileSync('app/crm/CrmToolbar.tsx', 'utf8'));
  // En la fila de una campaña, el botón que la elige va ANTES que el del chevron.
  const fila = t.slice(t.indexOf('gruposArbol.map((g) =>'), t.indexOf('{abierto && hijos.map'));
  assert.ok(fila.length > 300 && fila.length < 3000, `la fila de una campaña mide ${fila.length}`);
  const elige = fila.indexOf('onClick={() => toggleGrupo(g.value)}');
  const despliega = fila.indexOf('onClick={() => alternar(g.value)}');
  assert.ok(elige > 0 && despliega > elige, 'el chevron va a la derecha de la campaña');
  // Tildar la campaña la abre y destildarla la cierra: lo que se fija es lo que el toque HIZO.
  const tg = t.slice(t.indexOf('const toggleGrupo'), t.indexOf('const toggleHijo'));
  assert.ok(tg.length > 100 && tg.length < 1200, `toggleGrupo mide ${tg.length}`);
  assert.match(tg, /const elegir = !lista\.sel\.has\(g\);[\s\S]*aplicar\(alternarGrupo\(/, 'se lee ANTES de aplicar');
  assert.match(tg, /conGrupoAbierto\(prev, g, elegir, abiertoPorDefecto\)/);
  // Sin scroll de costado adentro del panel, y el ancho sale de la cuenta de arriba.
  assert.match(t, /data-filtro-panel style=\{\{[^}]*left: lugar\.izq[^}]*width: lugar\.ancho[^}]*overflowX: 'hidden'/);
  assert.match(t, /const rowBtn: CSSProperties = \{[^}]*boxSizing: 'border-box'/, 'una fila con sangría no puede medir más que el panel');
  assert.match(t, /closest\('main'\)[\s\S]{0,200}lugarDelPanel\(r\.left, document\.documentElement\.clientWidth, Math\.max\(0, contenido\) \+ MARGEN_VENTANA\)/,
    'el tope izquierdo sale del borde del contenido');
  //   ROTO A PROPÓSITO (2026-10-10): con el chevron otra vez a la izquierda, sin la línea que despliega,
  //   sin el overflowX, sin el box-sizing de las filas y sin medir el contenido:
  //   pass 16 / fail 1 cada una.
});

// «Si aprieto seleccionar una campaña se despliega, pero si deselecciono se debe volver a
// plegar» (Martín, 10/10/2026).
test('conGrupoAbierto FIJA abierta o cerrada, con cualquier default', () => {
  const vista = (alt: Set<string>, g: string, porDefecto: boolean) => porDefecto !== alt.has(g);
  for (const porDefecto of [true, false]) {
    for (const antes of [new Set<string>(), new Set(['A'])]) {
      assert.equal(vista(conGrupoAbierto(antes, 'A', true, porDefecto), 'A', porDefecto), true, `abrir (default ${porDefecto})`);
      assert.equal(vista(conGrupoAbierto(antes, 'A', false, porDefecto), 'A', porDefecto), false, `cerrar (default ${porDefecto})`);
    }
  }
  assert.deepEqual([...conGrupoAbierto(new Set(['B']), 'A', true, true)], ['B'], 'no toca las otras campañas');
  //   ROTO A PROPÓSITO (2026-10-10): alternando a ciegas en vez de fijar, pass 17 / fail 1; y en el
  //   menú, con destildar abriendo igual (siempre `true`), pass 17 / fail 1.
});

// «No debe salir los chips de abajo del filtro y el botón de "limpiar" si para eso ya está la
// notificacion en filtros. Dentro de filtros, de la misma manera que está en el PLAN, sebe
// aparecer un sutil texto abajo que diga "Limpiar filtros".» (Martín, 10/10/2026)
test('sin fila de chips debajo del filtro: el número sobre «Filtrar» y «Limpiar filtros» adentro del menú', () => {
  const b = sinComentarios(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  const t = sinComentarios(readFileSync('app/crm/CrmToolbar.tsx', 'utf8'));
  assert.doesNotMatch(b + t, /FiltroChips/, 'volvió la fila de chips');
  // El número sobre el botón, y abajo del menú el mismo «Limpiar filtros» que el Plan.
  assert.match(t, /\{n > 0 && \(\s*<span onClick=\{\(e\) => \{ e\.stopPropagation\(\); limpiar\(\); \}\}/);
  const plan = sinComentarios(readFileSync('app/plan/board/BoardShell.tsx', 'utf8'));
  const estilo = /\{n > 0 && \(\s*<button[^>]*\s+style=\{\{ \.\.\.rowBtn, justifyContent: 'center', marginTop: 4, borderTop: '1px solid var\(--border\)', paddingTop: 10, color: 'var\(--primary\)', fontWeight: 600 \}\}>\s*Limpiar filtros \(\{n\}\)/;
  assert.match(plan, estilo, 'el del Plan, que es el molde');
  assert.match(t, estilo, 'el del CRM, igual al del Plan');
  //   ROTO A PROPÓSITO (2026-10-10): con `FiltroChips` de vuelta en el tablero, pass 18 / fail 1; con el
  //   «Limpiar filtros» del menú en otro peso que el del Plan, pass 18 / fail 1.
});

// «Si refresco o me voy de pestaña y vuelvo, se deben mantener siempre los filtros» (Martín,
// 10/10/2026).
test('los filtros guardados: ida y vuelta, por cliente y embudo, y lo ajeno no entra', () => {
  const f = { etapas: ['nuevo', 'ganado'], origenes: ['Landing'], campanas: ['A'], anuncios: ['a1'], orden: 'llegada' as const };
  assert.deepEqual(leerFiltros(escribirFiltros(f), new Set(['nuevo', 'ganado'])), f);
  // Una etapa que ya no existe en el embudo no vuelve: dejaría el tablero vacío sin casilla.
  assert.deepEqual(leerFiltros(escribirFiltros(f), new Set(['nuevo'])).etapas, ['nuevo']);
  // Lo roto o con otra forma se descarta entero o campo por campo.
  assert.deepEqual(leerFiltros('{no es json', new Set()), SIN_FILTROS);
  assert.deepEqual(leerFiltros(null, new Set()), SIN_FILTROS);
  assert.deepEqual(leerFiltros(JSON.stringify({ origenes: [1, null, 'Cal.com', 'Cal.com'], orden: 'otro' }), new Set()),
    { ...SIN_FILTROS, origenes: ['Cal.com'] });
  // Una clave por cliente y por embudo.
  assert.equal(new Set([claveFiltros(null, null), claveFiltros(13, null), claveFiltros(13, 7), claveFiltros(14, 7)]).size, 4);
  //   ROTO A PROPÓSITO (2026-10-10): con las etapas que ya no existen volviendo, pass 20 / fail 1.
});

test('el tablero restaura al entrar y guarda después, sin pisar lo guardado con los filtros vacíos', () => {
  const b = sinComentarios(readFileSync('app/crm/CrmBoard.tsx', 'utf8'));
  const i = b.indexOf('const claveGuardado = claveFiltros(wsTab, funnelActivo);');
  const bloque = b.slice(i, b.indexOf('const ordenFiltro = vista', i));
  assert.ok(i > 0 && bloque.length > 600 && bloque.length < 2600, `el bloque mide ${bloque.length}`);
  assert.match(bloque, /useLayoutEffect\(\(\) => \{[\s\S]*localStorage\.getItem\(claveGuardado\)[\s\S]*recienRestaurado\.current = true;[\s\S]*\}, \[claveGuardado\]\);/);
  assert.match(bloque, /useEffect\(\(\) => \{\s*if \(recienRestaurado\.current\) \{ recienRestaurado\.current = false; return; \}/, 'el guardado se saltea el commit de la restauración');
  assert.match(bloque, /localStorage\.setItem\(claveGuardado, escribirFiltros\(/);
  //   ROTO A PROPÓSITO (2026-10-10): sin el salteo (el guardado del commit de la restauración pisaba lo
  //   guardado con los filtros vacíos), pass 20 / fail 1.
});
