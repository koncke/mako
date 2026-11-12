// =============================================================================
// El Copywriter (app/copywriter, lib/copywriter) — lo que se rompe sin un error (docs/diseno-copywriter.md)
// =============================================================================
// Fija:
//   · el SANEO del documento: lo que no se conoce se vuelve párrafo con su texto (no se tira lo escrito); cada bloque de
//     primer nivel con un id ÚNICO (el repetido y el que falta reciben uno nuevo: la IA apunta por id); un enlace sólo
//     http(s)/mailto; los topes fallan con su motivo (nunca recortan en silencio); un documento vacío es un renglón;
//   · las SECCIONES: una estructura arma un Título 2 por etiqueta con su `seccion`, y el texto exportado escribe la
//     etiqueta en MAYÚSCULA en su renglón, que es lo que entiende `parsearSecciones` (lib/guion-secciones.ts);
//   · el ÁRBOL: agregar y mover renumeran 0,1,2…; mover no arma un ciclo; la Papelera esconde a las de abajo y
//     restaurar a una página cuyo padre sigue en la Papelera la vuelve a la raíz; el índice saneado tira ids malos y
//     el padre de sí mismo;
//   · el CATÁLOGO del «/»: encuentra por nombre, atajo, sinónimo y sin tildes; y el motor del Web Generator con OTRO
//     catálogo (`consultaValida` con `buscar`) sin cambiar lo de Gamma;
//   · las PUERTAS: la página, la del teléfono y las dos rutas preguntan `veCopywriter` (desde el 29/10/2026, toda persona
//     con sesión: Copywriting ES el Copywriter), y la tab Copywriting de nav.ts lleva a /copywriter SIN tabs internas.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BID_RE, bloquesDelDoc, docDeEstructura, docVacio, nombreDeSeccion, sanearContenido, sinTexto, textoDelDoc } from '../lib/copywriter/doc';
import { agregar, aPapelera, dePapelera, enOrdenDeArbol, escondida, hijasDe, masReciente, mover, restaurar, sanearIndice } from '../lib/copywriter/arbol';
import { estructurasDelTipo, tiposDe, catalogosLite } from '../lib/copywriter/catalogos';
import { propsNuevas, sanearProps, TOPES, type JsonNodo, type PaginaCopy } from '../lib/copywriter/tipos';
import { parsearSecciones } from '../lib/guion-secciones';
import { buscarBloquesCopy, catalogoCopy } from '../app/copywriter/editor/bloques';
import { consultaValida } from '../app/web-generator/editor/extensiones/barra';
import { ESTRUCTURAS_GUION_DEFAULT } from '../lib/guion-estructuras';
import { ANGULOS_GUION_DEFAULT } from '../lib/guion-angulos';
import { claveDeGuion, claveDeTab } from '../lib/hilo-de-tab-reglas';
import { guionParaIA, charlaParaIA, bloqueIdiomaCopy, cifrasSinFuente, avisosDeCifras } from '../lib/copywriter/ia-reglas';
import { etiquetaDeSeccion, sanearOperaciones } from '../lib/copywriter/operaciones';
import { PROMPTS_EXPERTO as PROMPTS_EXPERTO_COPY } from '../lib/copywriter/experto';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

const p = (id: string, padre: string | null, orden: number, extra: Partial<PaginaCopy> = {}): PaginaCopy => ({
  id, titulo: id, emoji: null, tipo: 'ad', padre, orden, actualizado: '2026-10-28T00:00:00.000Z', ...extra,
});

// ── El documento ───────────────────────────────────────────────────────────────

test('sanear: un nodo desconocido se vuelve un párrafo con su texto, nunca se tira', () => {
  const r = sanearContenido({ type: 'doc', content: [{ type: 'imagenRara', content: [{ type: 'text', text: 'lo que escribí' }] }] });
  assert.ok(r.ok);
  assert.equal(r.doc.content?.[0].type, 'paragraph');
  assert.equal(bloquesDelDoc(r.doc)[0].texto, 'lo que escribí');
});

test('sanear: cada bloque de primer nivel con un id único (el repetido y el que falta reciben uno nuevo)', () => {
  const r = sanearContenido({
    type: 'doc',
    content: [
      { type: 'paragraph', attrs: { bid: 'baaaaaaaa1' }, content: [{ type: 'text', text: 'uno' }] },
      { type: 'paragraph', attrs: { bid: 'baaaaaaaa1' }, content: [{ type: 'text', text: 'dos' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'tres' }] },
    ],
  });
  assert.ok(r.ok);
  const ids = (r.doc.content ?? []).map((b) => b.attrs?.bid as string);
  assert.equal(ids[0], 'baaaaaaaa1', 'el primero conserva el suyo');
  assert.equal(new Set(ids).size, 3);
  for (const id of ids) assert.match(id, BID_RE);
});

test('sanear: un enlace sólo con http(s) o mailto; el resto pierde el enlace y conserva el texto', () => {
  const r = sanearContenido({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'malo', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
    { type: 'text', text: 'bueno', marks: [{ type: 'link', attrs: { href: 'https://ejemplo.com' } }, { type: 'bold' }] },
  ] }] });
  assert.ok(r.ok);
  const [malo, bueno] = r.doc.content![0].content!;
  assert.equal(malo.marks, undefined);
  assert.deepEqual(bueno.marks, [{ type: 'link', attrs: { href: 'https://ejemplo.com' } }, { type: 'bold' }]);
});

test('sanear: pasar el tope de bloques FALLA con su motivo (no recorta en silencio)', () => {
  const content = Array.from({ length: TOPES.bloques + 1 }, () => ({ type: 'paragraph' }));
  const r = sanearContenido({ type: 'doc', content });
  assert.equal(r.ok, false);
});

test('sanear: un documento vacío es un renglón (si no, TipTap no tiene dónde poner el cursor)', () => {
  const r = sanearContenido({ type: 'doc', content: [] });
  assert.ok(r.ok);
  assert.equal(r.doc.content?.length, 1);
  assert.equal(r.doc.content?.[0].type, 'paragraph');
});

test('sanear: un título fuera de 1-3 baja a 2, y una lista sin ítems se cae', () => {
  const r = sanearContenido({ type: 'doc', content: [{ type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: 'x' }] }, { type: 'bulletList', content: [] }] });
  assert.ok(r.ok);
  assert.equal(r.doc.content?.length, 1);
  assert.equal(r.doc.content?.[0].attrs?.level, 2);
});

test('una estructura arma un Título 2 por etiqueta con su sección, y el texto exportado lo entiende parsearSecciones', () => {
  const pas = ESTRUCTURAS_GUION_DEFAULT.find((e) => e.id === 'pas')!;
  const doc = docDeEstructura(pas.etiquetas);
  const titulos = (doc.content ?? []).filter((b) => b.type === 'heading');
  assert.deepEqual(titulos.map((t) => t.attrs?.seccion), pas.etiquetas);
  assert.equal(titulos[2].content?.[0].text, 'Agitación');
  assert.ok(sinTexto(doc), 'las secciones vacías no cuentan como escrito');
  // Se escribe en cada sección y se exporta.
  const conTexto: JsonNodo = { ...doc, content: (doc.content ?? []).map((b) => (b.type === 'paragraph' ? { ...b, content: [{ type: 'text', text: 'algo' }] } : b)) };
  assert.equal(sinTexto(conTexto), false);
  const secciones = parsearSecciones(textoDelDoc(conTexto));
  assert.deepEqual(secciones.map((s) => s.titulo), pas.etiquetas);
  assert.ok(secciones.every((s) => s.texto === 'algo'));
});

test('el nombre de una sección: con su tilde, y las siglas quedan siglas', () => {
  assert.equal(nombreDeSeccion('AGITACION'), 'Agitación');
  assert.equal(nombreDeSeccion('SOLUCION'), 'Solución');
  assert.equal(nombreDeSeccion('CTA'), 'CTA');
  assert.equal(nombreDeSeccion('GANCHO'), 'Gancho');
});

test('las propiedades se leen a la defensiva', () => {
  assert.deepEqual(sanearProps({ tipo: 'reel', angulo: 'dolor', estructura: '<script>', duracion: -3 }), { tipo: 'reel', angulo: 'dolor', estructura: null, duracion: null, plantilla: null });
  assert.equal(sanearProps({ tipo: 'nada' }).tipo, 'ad');
  // La plantilla de la que nació la página (29/10/2026): un id como el de la estructura; lo demás, null.
  assert.equal(sanearProps({ tipo: 'ad', plantilla: 'guion-anuncio' }).plantilla, 'guion-anuncio');
  assert.equal(sanearProps({ tipo: 'ad', plantilla: '../x' }).plantilla, null);
  assert.deepEqual(propsNuevas('reel', 'reel-viral', { plantilla: 'reel', duracion: 52 }), { tipo: 'reel', angulo: null, estructura: 'reel-viral', duracion: 52, plantilla: 'reel' });
});

test('lo que lee la IA: cada bloque con su id, y la sección con su etiqueta', () => {
  const doc = docDeEstructura(['GANCHO', 'CTA']);
  const t = guionParaIA(doc);
  const bids = (doc.content ?? []).map((b) => b.attrs?.bid as string);
  for (const b of bids) assert.ok(t.includes(`[${b}]`));
  assert.match(t, /SECCIÓN GANCHO/);
  assert.equal(charlaParaIA([{ de: 'yo', texto: 'hola' }, { de: 'mako', texto: 'qué tal' }]), 'Persona: hola\nMaKo: qué tal');
  // Lo que dice el guion lo dice el NEGOCIO: nunca con la voz rioplatense de MaKo.
  assert.match(bloqueIdiomaCopy(null), /sin modismos rioplatenses/);
  assert.match(bloqueIdiomaCopy(null), /sin voseo/);
  // UNA forma en todo el guion (12/11/2026, en producción: un negocio rioplatense salía con «Mandás un anuncio… esperas»).
  assert.match(bloqueIdiomaCopy('Argentino (rioplatense)', true), /con el voseo de esa variedad en TODO el guion, nunca mezclado con el tuteo/);
  assert.match(bloqueIdiomaCopy('Mexicano', false), /de «tú» en TODO el guion, sin voseo/);
  assert.doesNotMatch(bloqueIdiomaCopy('Argentino (rioplatense)', true), /salvo que esa variedad/);
});

test('las cifras y la garantía sin fuente se avisan (12/11/2026, en producción: la réplica de YouTube las inventó)', () => {
  const escrito = 'Cada uno vio sus conversaciones subir 3 veces. El 73 % llegaba a la propuesta. Costo 60 % más bajo. En 30 días. 3 a 5 clientes garantizados o devolvemos lo que pagaste.';
  const c = cifrasSinFuente(escrito, 'EL NEGOCIO: WhatsApp Ads Funnel, 497 dólares, 30 días de ajustes. Subió 3 veces sus mensajes.');
  assert.deepEqual(c.cifras, ['73 %', '60 %'], 'las «3 veces» con fuente; los «30 días» no son una prueba');
  assert.equal(c.garantia, true);
  assert.equal(cifrasSinFuente('Una garantía de 30 días.', 'Garantía de devolución de 30 días.').garantia, false, 'la garantía del negocio sí');
  assert.deepEqual(cifrasSinFuente('El 41 % de los que escriben compra.', 'testimonio: 41 % compró').cifras, []);
  const avisos = avisosDeCifras(c);
  assert.match(avisos[0], /Tiene cifras que no salen de tu negocio \(73 %, 60 %\)/);
  assert.match(avisos[1], /Promete una garantía o una devolución/);
  const ia = leer('lib/copywriter/ia.ts');
  assert.ok(ia.includes("avisos.push(...avisosDeCifras(cifrasSinFuente(`${r.titulo ?? ''}\\n${escrito}`, fuentes)));"), 'Editar avisa las cifras');
  // Y los avisos se ven también cuando la página quedó escrita sola (la réplica): antes, sólo con «Aceptar».
  assert.ok(leer('app/copywriter/PanelMaKo.tsx').includes(`{m.estado === 'aceptada' && p.avisos.map((a) => <div key={a} className="nt-propuesta-aviso">{a}</div>)}`));
});

test('la plantilla sin tocar queda escrita sin «Aceptar», y la caja y la nota de voz entran en la columna (12/11/2026, en producción)', () => {
  const panel = leer('app/copywriter/PanelMaKo.tsx');
  assert.ok(panel.includes('const nacida = adaptar && !!pl && textoDelDoc(antes as JsonNodo).trim() === textoDelDoc(pl.esqueleto()).trim();'));
  assert.ok(panel.includes("if (nacida && !propuesta.descartadas.length) aceptar({ ...mako, estado: 'pendiente' });"), 'sola sólo si entró todo');
  // El método: una acción que crea escribe la pieza entera y pregunta DESPUÉS (antes pedía 3 datos y no escribía nada).
  assert.doesNotMatch(PROMPTS_EXPERTO_COPY.adaptarUser.tpl, /todavía no escribes/);
  assert.match(PROMPTS_EXPERTO_COPY.adaptarUser.tpl, /no le preguntas nada antes de escribir/);
  assert.match(PROMPTS_EXPERTO_COPY.experto.tpl, /Nunca contestas con preguntas en lugar de la pieza\./);
  // Grabando, «Terminar» quedaba cortado y, al escuchar, «Enviar audio» no se veía: la caja tomaba el ancho de su contenido.
  assert.ok(leer('app/copywriter/notion.css').includes('.nt-mako-pie > .co-caja { margin-inline: 0; min-width: 0; }'));
  // La nota de voz del hilo, 240 px fijos en un globo de ~160: se metía bajo el avatar.
  assert.ok(leer('app/_chat/HiloMako.tsx').includes("style={{ width: 240, maxWidth: '100%' }}"));
  assert.ok(leer('app/_chat/chat.css').includes('.ch-voz [data-reproductor] input[type="range"] { min-width: 0 !important; }'));
});

test('un documento vacío nuevo es válido para el saneo', () => {
  const r = sanearContenido(docVacio());
  assert.ok(r.ok);
});

// ── El árbol ───────────────────────────────────────────────────────────────────

test('agregar al final y en un lugar renumera 0,1,2', () => {
  const base = [p('ga111111', null, 0), p('gb111111', null, 1)];
  const r = agregar(base, { id: 'gc111111', titulo: 'c', emoji: null, tipo: 'reel', padre: null, actualizado: 'x' }, 1);
  assert.ok(r.ok);
  assert.deepEqual(hijasDe(r.paginas, null).map((x) => [x.id, x.orden]), [['ga111111', 0], ['gc111111', 1], ['gb111111', 2]]);
});

test('mover: no se puede meter una página adentro de su descendiente (ciclo)', () => {
  const base = [p('ga111111', null, 0), p('gb111111', 'ga111111', 0), p('gc111111', 'gb111111', 0)];
  assert.equal(mover(base, 'ga111111', 'gc111111', 0).ok, false);
  assert.equal(mover(base, 'ga111111', 'ga111111', 0).ok, false);
});

test('mover a otro padre renumera los dos lugares', () => {
  const base = [p('ga111111', null, 0), p('gb111111', null, 1), p('gc111111', null, 2), p('gd111111', 'ga111111', 0)];
  const r = mover(base, 'gb111111', 'ga111111', 0);
  assert.ok(r.ok);
  assert.deepEqual(hijasDe(r.paginas, null).map((x) => [x.id, x.orden]), [['ga111111', 0], ['gc111111', 1]]);
  assert.deepEqual(hijasDe(r.paginas, 'ga111111').map((x) => [x.id, x.orden]), [['gb111111', 0], ['gd111111', 1]]);
});

test('Papelera: esconde a las de abajo; restaurar con el padre en la Papelera la vuelve a la raíz', () => {
  const base = [p('ga111111', null, 0), p('gb111111', 'ga111111', 0)];
  const r1 = aPapelera(base, 'ga111111', '2026-10-28T10:00:00.000Z');
  assert.ok(r1.ok);
  assert.ok(escondida(r1.paginas, 'gb111111'), 'la subpágina de una de la Papelera no se dibuja');
  assert.deepEqual(dePapelera(r1.paginas).map((x) => x.id), ['ga111111'], 'la Papelera lista la de arriba, no sus hijas');
  assert.equal(masReciente(r1.paginas), null);
  // La hija se manda sola a la Papelera y después se restaura: su padre sigue allá → a la raíz.
  const r2 = aPapelera(r1.paginas, 'gb111111', '2026-10-28T10:01:00.000Z');
  assert.ok(r2.ok);
  const r3 = restaurar(r2.paginas, 'gb111111');
  assert.ok(r3.ok);
  const b = r3.paginas.find((x) => x.id === 'gb111111')!;
  assert.equal(b.padre, null);
  assert.equal(b.papelera, undefined);
  assert.equal(escondida(r3.paginas, 'gb111111'), false);
});

test('el índice saneado tira ids malos, repetidos y el padre de sí mismo', () => {
  const s = sanearIndice([
    { id: 'ga111111', titulo: ' Hola  ', tipo: 'reel', padre: null, orden: 0, actualizado: 'x' },
    { id: 'ga111111', titulo: 'repetido' },
    { id: '../x', titulo: 'malo' },
    { id: 'gb111111', titulo: '', padre: 'gb111111', orden: 1 },
    { id: 'gc111111', titulo: 'huérfana', padre: 'gzzzzzzz' },
  ]);
  assert.deepEqual(s.map((x) => x.id), ['ga111111', 'gb111111', 'gc111111']);
  assert.equal(s[0].titulo, 'Hola');
  assert.equal(s[1].titulo, 'Sin título');
  assert.equal(s[1].padre, null);
  assert.equal(s[2].padre, null, 'un padre que no existe pasa a la raíz');
});

test('el orden del árbol del teléfono: cada página seguida de las suyas', () => {
  const base = [p('ga111111', null, 1), p('gb111111', null, 0), p('gc111111', 'ga111111', 0)];
  assert.deepEqual(enOrdenDeArbol(base).map((x) => x.p.id), ['gb111111', 'ga111111', 'gc111111']);
});

// ── Los catálogos ──────────────────────────────────────────────────────────────

test('las estructuras de la biblioteca sin `tipos` son de Ad; un tipo sin las suyas recibe todas, avisado', () => {
  assert.deepEqual(tiposDe({ id: 'x' }), ['ad']);
  assert.deepEqual(tiposDe({ id: 'x', tipos: ['reel', 'nada', 'reel'] }), ['reel']);
  const c = catalogosLite(ANGULOS_GUION_DEFAULT, ESTRUCTURAS_GUION_DEFAULT);
  assert.equal(estructurasDelTipo(c, 'ad').propias, true);
  const yt = estructurasDelTipo({ ...c, estructuras: c.estructuras.filter((e) => !e.tipos.includes('youtube')) }, 'youtube');
  assert.equal(yt.propias, false);
  assert.ok(yt.estructuras.length > 0, 'un selector vacío no deja armar el guion');
});

test('el «/»: encuentra por nombre, atajo, sinónimo y sin tildes; y las secciones del guion', () => {
  const cat = catalogoCopy(['GANCHO', 'AGITACION']);
  assert.equal(buscarBloquesCopy('h1', cat)[0].id, 'h1');
  assert.ok(buscarBloquesCopy('desplegable', cat).some((b) => b.id === 'desplegable'));
  assert.ok(buscarBloquesCopy('toggle', cat).some((b) => b.id === 'desplegable'));
  assert.ok(buscarBloquesCopy('agitacion', cat).some((b) => b.id === 'seccion:AGITACION'));
  assert.ok(buscarBloquesCopy('Agitación', cat).some((b) => b.id === 'seccion:AGITACION'));
  assert.equal(buscarBloquesCopy('', cat).length, cat.length);
  // Sin tildes de verdad: un bloque cuyo nombre es lo ÚNICO que la tiene (sin sinónimo que la tape).
  const conTilde = [{ id: 'texto' as const, categoria: 'Bloques básicos' as const, nombre: 'Solución', descripcion: '', icono: '', sinonimos: [] }];
  assert.equal(buscarBloquesCopy('solucion', conTilde).length, 1);
});

test('el motor del «/» del Web Generator con OTRO catálogo, y sin opciones como antes', () => {
  // «pedirle a» lo encuentra el catálogo del Copywriter y no el de Gamma: con `buscar`, es un comando; sin, una frase.
  assert.equal(consultaValida('pedirle a', (q) => buscarBloquesCopy(q)), true);
  assert.equal(consultaValida('pedirle a'), false);
  assert.equal(consultaValida('lista con', (q) => buscarBloquesCopy(q)), true);
  // El plugin pasa SU opción al recalcular (en node no hay vista donde probarlo: se lee el fuente).
  const barra = leer('app/web-generator/editor/extensiones/barra.ts');
  assert.match(barra, /const buscar = this\.options\.buscar;/);
  assert.equal((barra.match(/calcular\(nuevo, [^)]*, buscar\)/g) ?? []).length, 2);
  // El «/» del Copywriter es el de BlockNote desde el 29/10/2026, filtrado con el MISMO catálogo (CuerpoNotion.tsx).
  assert.match(leer('app/copywriter/editor/CuerpoNotion.tsx'), /buscarBloquesCopy\(consulta, catalogo\)/);
  assert.equal(consultaValida('esto es una frase', (q) => buscarBloquesCopy(q)), false);
  assert.equal(consultaValida('a b c d e', () => []), false);
  assert.equal(consultaValida(''), true);
});

// ── La charla guardada ────────────────────────────────────────────────────────

test('la charla de un guion se guarda con su clave (y la ruta la acepta)', () => {
  assert.equal(claveDeTab(claveDeGuion('ga111111')), 'copywriter:ga111111');
});

// ── Las puertas ───────────────────────────────────────────────────────────────

test('las puertas: Copywriting lleva al Copywriter sin tabs internas y TODA entrada pregunta veCopywriter', () => {
  // Martín, 29/10/2026: «NO quiero otras tabs internas que hoy aparecen en la topbar». La fila de Copywriting ES el
  // Copywriter: key 'copywriter' (la que piden la página y la API), sin `secciones` y sin `adminOnly`.
  const nav = leer('app/_components/nav.ts');
  const fila = /\{\s*key: 'copywriter', label: 'Copywriting', href: '\/copywriter',[^\n]*/.exec(nav)?.[0] ?? '';
  assert.ok(fila, 'la fila de Copywriting lleva a /copywriter');
  assert.ok(!/adminOnly|secciones/.test(fila), 'sin adminOnly ni secciones');
  assert.match(leer('lib/copywriter/puerta.ts'), /getUsuarioActual\(\)/, 'la regla vive en lib y acceso.ts la re-exporta');
  for (const f of ['app/copywriter/page.tsx', 'app/copywriter/[id]/page.tsx']) {
    const s = leer(f);
    assert.match(s, /requireRolWs\(\[\], \{ nav: 'copywriter' \}\)/, f);
    assert.match(s, /await requireCopywriter\(\)/, f);
  }
  for (const f of ['app/m/copywriter/page.tsx', 'app/m/copywriter/[id]/page.tsx']) {
    assert.match(leer(f), /await requireCopywriterM\(\)/, f);
  }
  for (const f of ['app/api/copywriter/route.ts', 'app/api/copywriter/ia/route.ts']) {
    const s = leer(f);
    assert.match(s, /soloAdminDeTab\('copywriter'\)/, f);
    assert.match(s, /if \(!\(await veCopywriter\(\)\)\) return falla\(404/, f);
  }
});

test('la IA del Copywriter: su feature registrada y la regla de lo que no existe', () => {
  assert.match(leer('lib/model-catalogo.ts'), /feature: 'copywriter-ia'/);
  const ia = leer('lib/copywriter/ia.ts');
  assert.match(ia, /REGLA_NO_EXISTE/);
  assert.match(ia, /conPedidoDeNoExisteDeLaSesion/);
  assert.match(ia, /feature: FEATURE_COPY/);
});

test('el contexto del negocio sale del grafo de los chats (grafoParaChat) con recuperar, en el lib común de Create', () => {
  // 29/10/2026: se mudó a lib/negocio-para-crear.ts (lo leen las cinco tabs) y dejó de rearmar el mapa con su física.
  const c = leer('lib/negocio-para-crear.ts');
  // 31/10/2026: `sinKnowledge` alrededor. El paquete es del NEGOCIO y su pregunta nombra «oferta», «producto»,
  // «precio»: con la capa de Knowledge puesta, los módulos del método matchean esas mismas palabras y le comen
  // presupuesto a la oferta y al avatar reales del cliente (lib/cerebro-knowledge.ts).
  assert.match(c, /const grafo = sinKnowledge\(await grafoParaChat\(\)\);/, 'el contexto del negocio dejó de leer el grafo de los chats, o volvió a leerlo CON la capa de Knowledge');
  assert.match(c, /recuperar\(grafo,/);
  assert.doesNotMatch(c.replace(/^[ \t]*\/\/.*$/gm, ''), /construirCerebro\(/, 'rearma el mapa entero con su física');
  assert.match(leer('lib/copywriter/contexto.ts'), /export \{ contextoDelNegocio,[^}]*\} from '\.\.\/negocio-para-crear';/);
});

test('teléfono: el nombre de la barra sigue al título que se escribe (11/11/2026, decía «Sin título»)', () => {
  // Lo pone GuionM con la página EN VIVO (`onPaginaEnVivo`); si lo pusiera la página del servidor, quedaría el de al abrir.
  assert.match(leer('app/m/copywriter/GuionM.tsx'), /<CabeceraM titulo=\{pagina\.titulo\}/);
  assert.doesNotMatch(leer('app/m/copywriter/[id]/page.tsx'), /<CabeceraM titulo=/);
});

test('«Ver ejemplo»: el documento se achica al modal y la tabla corre en su caja (11/11/2026, a 375 se cortaba el texto)', () => {
  assert.match(leer('app/copywriter/notion.css'), /\.nt\.nt-ejemplo > \.nt-bn \{ min-width: 0;/);
});

test('teléfono: las preguntas de MaKo con la letra de las burbujas del chat (16 px), no 13,5 (11/11/2026)', () => {
  assert.match(leer('app/copywriter/notion.css'), /\.nt\[data-movil\] \.nt-mako-bienvenida, \.nt\[data-movil\] \.nt-mako-respuesta \{ font-size: 16px; \}/);
});

test('después de «Aceptar», la tecla de deshacer sólo donde hay teclado, y la de su sistema (11/11/2026: el teléfono decía Ctrl+Z)', () => {
  const panel = leer('app/copywriter/PanelMaKo.tsx');
  assert.match(panel, /'Aceptado\.'\}<span className="nt-solo-teclado"> \{teclaDeshacer\(\)\} en la página lo deshace\.<\/span>/);
  assert.match(panel, /\? '⌘Z' : 'Ctrl\+Z'/);
  assert.match(leer('app/copywriter/notion.css'), /\.nt\[data-movil\] \.nt-solo-teclado \{ display: none; \}/);
  // Y el número concuerda: «1 bloque nuevo, marcado», no «1 bloque nuevos, marcados» (visto en la misma prueba).
  assert.match(panel, /p\.nuevos\.length === 1 \? 'nuevo, marcado' : 'nuevos, marcados'/);
});

test('la caja trabada se vuelve a medir cuando llega su frase y cada vez que cambia su ancho (11/11/2026: cortada a 1440)', () => {
  // La caja es la compartida (app/_chat/CajaChat.tsx); el panel de Copywriting es angosto y la frase ocupa dos renglones.
  // ⚠️ Medir sólo al llegar la frase NO alcanzó (desplegado y medido en producción: 40 px de alto con 61 de frase): el botón
  // «Instalar MaKo» es dinámico y angosta el campo DESPUÉS. Por eso mide con un observador del ancho.
  // ⚠️⚠️ Y el del ancho TAMPOCO alcanzó (desplegado otra vez, con la página en segundo plano): `ResizeObserver` avisa con los cuadros
  // de dibujo, y una pestaña de fondo no tiene. El de mutaciones de la fila sí avisa, y es el que ve llegar el botón.
  const caja = leer('app/_chat/CajaChat.tsx');
  const efecto = caja.slice(caja.indexOf('if (!el || altoMax == null || !p.bloqueo) return;'), caja.indexOf('}, [p.bloqueo?.frase, altoMax]);'));
  assert.ok(efecto.length > 0, 'hay un efecto de la caja trabada');
  assert.match(efecto, /el\.style\.height = altoDelCampo\(el\.scrollHeight, altoMax\);/);
  assert.match(efecto, /if \(el\.value \|\| w === ancho\) return;/, 'mide sólo si cambió el ancho (el alto que pone también avisa)');
  assert.match(efecto, /new ResizeObserver\(medir\)/);
  assert.match(efecto, /const fila = el\.parentElement\?\.parentElement \?\? null;/);
  assert.match(efecto, /mo\?\.observe\(fila, \{ childList: true, subtree: true \}\);/);
  assert.match(efecto, /return \(\) => \{ ro\?\.disconnect\(\); mo\?\.disconnect\(\); \};/);
});

test('la sección que nombra MaKo se lee con tolerancia (12/11/2026, en producción: el Carrusel perdió sus 3 secciones)', () => {
  const doc = docDeEstructura(['SLIDES', 'CTA', 'CAPTION', 'SOLUCIÓN']);
  const titulo = (doc.content ?? []).find((b) => b.attrs?.seccion === 'CTA');
  const casos: Array<[Record<string, unknown>, string]> = [
    [{ seccion: 'SLIDES' }, 'SLIDES'],
    [{ seccion: 'Slides' }, 'SLIDES'],
    [{ seccion: 'SECCIÓN SLIDES: Slides' }, 'SLIDES'],
    [{ seccion: `[${String(titulo?.attrs?.bid)}] ## SECCIÓN CTA: CTA` }, 'CTA'],
    [{ section: 'caption' }, 'CAPTION'],
    [{ etiqueta: 'Solucion' }, 'SOLUCIÓN'],
    [{ seccion: 'La sección CAPTION (el pie)' }, 'CAPTION'],
    [{ bid: String(titulo?.attrs?.bid) }, 'CTA'],
    // Una sección nueva sigue siendo válida (escribir_seccion la agrega al final).
    [{ seccion: 'PIE' }, 'PIE'],
    [{ seccion: '¿¿??' }, ''],
  ];
  for (const [o, esperado] of casos) assert.equal(etiquetaDeSeccion(o, doc), esperado, JSON.stringify(o));
  const cat = { angulos: new Set<string>(), estructuras: new Set<string>() };
  const s = sanearOperaciones([{ op: 'escribir_seccion', seccion: 'SECCIÓN SLIDES: Slides', bloques: [{ tipo: 'tabla', filas: [['Lámina', 'Texto'], ['1', 'Hola']] }] }], doc, cat);
  assert.equal(s.descartadas.length, 0);
  assert.equal(s.ops[0]?.op === 'escribir_seccion' && s.ops[0].seccion, 'SLIDES');
});
