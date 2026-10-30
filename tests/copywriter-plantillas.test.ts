// =============================================================================
// Copywriter = Notion: los templates de «Nueva» y la mudanza de lo de antes (lib/copywriter/plantillas.ts, mudanza-reglas.ts)
// =============================================================================
// Fija lo que se rompe sin un error (docs/diseno-copywriter.md, D12 y D14):
//   · CADA TEMPLATE NACE GUARDABLE: su cuerpo pasa el saneo del server y la ida y vuelta por BlockNote sin cambiar (una
//     página que no se puede guardar se pierde al primer cambio);
//   · las SECCIONES de cada template son Títulos 2 con su etiqueta (MaKo escribe «el asunto» o «el gancho» por su nombre),
//     y las de un template con estructura son las de esa estructura (las del VSL, las de lib/vsl-estructuras.ts);
//   · la estructura que deja elegida existe en el catálogo del Copywriter (si no, la página abre con un selector vacío);
//   · la MUDANZA copia los guiones del Ads Writer y las piezas de Reels como páginas debajo de su padre, con el ángulo y
//     la estructura sólo si siguen en la biblioteca, parte el texto en secciones por sus etiquetas, y respeta el tope.
// Verificado rompiéndolo (29/10/2026): ver el pie del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { bloquesDelDoc, sanearContenido, textoDelDoc } from '../lib/copywriter/doc';
import { aBloques, deBloques } from '../lib/copywriter/notion-bloques';
import { GRUPOS_PLANTILLA, chipsDe, extractoDe, gruposDePlantillas, plantillaPorId, plantillasDe, plantillasVisibles, restosDelEjemplo } from '../lib/copywriter/plantillas';
import { bloquesDeTexto, docDeEjemplo } from '../lib/copywriter/texto';
import { marcasDeVoseo } from '../lib/puestas-data';
import { catalogosLite, conVsl } from '../lib/copywriter/catalogos';
import { esIdPagina, TIPOS_GUION } from '../lib/copywriter/tipos';
import { ANGULOS_GUION_DEFAULT } from '../lib/guion-angulos';
import { ESTRUCTURAS_GUION_DEFAULT } from '../lib/guion-estructuras';
import { ESTRUCTURAS_VSL_DEFAULT } from '../lib/vsl-estructuras';
import { idDeMudanza, loQueSeMuda, paginasDeAdsWriter, paginasDeReels, TOPE_MUDANZA } from '../lib/copywriter/mudanza-reglas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REALES, sinAcentos } from './_reales';

const catalogos = catalogosLite(ANGULOS_GUION_DEFAULT, conVsl(ESTRUCTURAS_GUION_DEFAULT));
const plantillas = plantillasDe(catalogos);
const secciones = (doc: Parameters<typeof bloquesDelDoc>[0]) => bloquesDelDoc(doc).filter((b) => b.tipo === 'seccion').map((b) => b.seccion);
const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('los templates: ids únicos, tipos que existen y los grupos en su orden', () => {
  const ids = plantillas.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of plantillas) assert.ok((TIPOS_GUION as readonly string[]).includes(p.tipo), `${p.id}: ${p.tipo}`);
  assert.deepEqual(gruposDePlantillas(plantillas).map((g) => g.grupo), GRUPOS_PLANTILLA.filter((g) => plantillas.some((p) => p.grupo === g)));
  // Lo que pidió Martín: Reels, copys de anuncios, emails, posts y VSL; y lo que ya tenía (el guion de anuncio, stories, YouTube).
  for (const id of ['reel', 'copy-anuncio', 'email', 'carrusel', 'guion-anuncio', 'stories', 'youtube', 'blanco']) assert.ok(plantillaPorId(catalogos, id), id);
  assert.ok(plantillas.some((p) => p.tipo === 'vsl'));
  // Las 12 de las plantillas reales (docs/plantillas-reales/copywriter.md, 2), en la galería y en su orden, más la página
  // en blanco. Las tres VSL sin ejemplo salen de la galería pero siguen resolviendo por id (la API).
  assert.deepEqual(plantillasVisibles(plantillas).map((p) => p.id), [
    'guion-anuncio', 'testimonio', 'copy-anuncio', 'banco-ganchos', 'reel', 'stories', 'carrusel', 'email', 'secuencia-nutricion',
    'vsl-respuesta-directa', 'vsl-clase-educativa', 'youtube', 'blanco',
  ]);
  for (const id of ['vsl-anti-solucion', 'vsl-diagnostico', 'vsl-historia-fundador']) assert.equal(plantillaPorId(catalogos, id)?.visible, false, id);
});

test('cada template nace guardable y vuelve igual de BlockNote', () => {
  for (const p of plantillas) {
    const s = sanearContenido(p.contenido());
    assert.ok(s.ok, `${p.id} pasa el saneo`);
    const { bloques, secciones: sec } = aBloques(s.doc);
    const vuelta = sanearContenido(deBloques(JSON.parse(JSON.stringify(bloques)), sec));
    assert.ok(vuelta.ok);
    assert.deepEqual(bloquesDelDoc(vuelta.doc), bloquesDelDoc(s.doc), `${p.id} vuelve igual`);
  }
});

test('la estructura que deja elegida existe, y sus secciones son las de esa estructura', () => {
  for (const p of plantillas) {
    if (!p.estructura) continue;
    const e = catalogos.estructuras.find((x) => x.id === p.estructura);
    assert.ok(e, `${p.id}: «${p.estructura}» está en el catálogo`);
    assert.ok(e!.tipos.includes(p.tipo), `${p.id}: la estructura calza con su tipo`);
    const s = secciones(p.contenido());
    for (const etiqueta of e!.etiquetas) assert.ok(s.includes(etiqueta), `${p.id}: falta la sección ${etiqueta}`);
  }
  // Un VSL por estructura activa, con sus etiquetas en orden.
  for (const v of ESTRUCTURAS_VSL_DEFAULT.filter((x) => x.activo)) {
    const p = plantillaPorId(catalogos, v.id);
    assert.ok(p, v.id);
    assert.deepEqual(secciones(p!.contenido()), v.etiquetas);
  }
});

test('las secciones del Reel, del copy de anuncio y del email (lo que copian de la casa)', () => {
  assert.deepEqual(secciones(plantillaPorId(catalogos, 'reel')!.contenido()), ['GANCHO', 'HISTORIA', 'MORALEJA', 'CTA', 'CAPTION']);
  assert.deepEqual(secciones(plantillaPorId(catalogos, 'copy-anuncio')!.contenido()), ['TEXTO PRINCIPAL', 'TITULO', 'BOTON', 'LINK']);
  assert.deepEqual(secciones(plantillaPorId(catalogos, 'email')!.contenido()), ['ASUNTO', 'VISTA PREVIA', 'CUERPO', 'BOTON']);
  // El título se lee con su tilde (doc.ts, CON_TILDE): «Título», «Botón».
  assert.match(JSON.stringify(plantillaPorId(catalogos, 'copy-anuncio')!.contenido()), /"Título".*"Botón"/);
});

// ── La mudanza ──────────────────────────────────────────────────────────────

const RAZONES = [
  { id: 'c1', nombre: 'Un mejor salario', guiones: [
    { id: 'g1', anguloId: 'dolor', anguloNombre: 'Dolor', estructuraId: 'pas', texto: 'PROBLEMA\nNo llegas a fin de mes.\nAGITACION\nY cada mes es peor.\nSOLUCION\nEsto.' },
    { id: 'g2', anguloId: 'no-existe', anguloNombre: 'Otro', estructuraId: 'tampoco', texto: 'Un guion sin etiquetas.' },
    { id: 'g3', texto: '   ' },
  ] },
  { id: 'c2', nombre: 'Viajar', guiones: [] },
];
const CATALOGO = { angulos: new Set(catalogos.angulos.map((a) => a.id)), estructuras: new Set(catalogos.estructuras.map((e) => e.id)) };

test('la mudanza del Ads Writer: un padre y una página de Ad por guion con texto, en secciones', () => {
  const ps = paginasDeAdsWriter(RAZONES, CATALOGO);
  assert.equal(ps.length, 3, 'el padre y los dos guiones con texto');
  assert.equal(ps[0].padreClave, null);
  assert.ok(ps.slice(1).every((p) => p.padreClave === ps[0].clave && p.tipo === 'ad'));
  assert.equal(ps[1].titulo, 'Un mejor salario · Dolor');
  assert.deepEqual(secciones(ps[1].contenido), ['PROBLEMA', 'AGITACION', 'SOLUCION']);
  assert.equal(ps[1].props.estructura, CATALOGO.estructuras.has('pas') ? 'pas' : null);
  assert.equal(ps[2].props.angulo, null, 'un ángulo que no está en la biblioteca no se inventa');
  assert.equal(ps[2].props.estructura, null);
  assert.ok(ps.every((p) => sanearContenido(p.contenido).ok));
  assert.deepEqual(paginasDeAdsWriter(null, CATALOGO), []);
  assert.deepEqual(paginasDeAdsWriter([{ nombre: 'x', guiones: [] }], CATALOGO), [], 'sin guiones no hay padre vacío');
});

test('la mudanza de Reels: la pieza llena el template del Reel', () => {
  const ps = paginasDeReels([{ id: 'r1', pedido: 'Cómo cobrar más', at: '2026-10-20', pieza: {
    formato: 'reel', objetivo: 'seguir', hook: { frase: 'Cobras poco', tituloEnPantalla: 'COBRA MÁS', visual: 'cara' },
    escenas: [{ texto: 'Primero esto', indicacionVisual: 'plano medio' }, { texto: 'Después aquello', indicacionVisual: 'detalle' }],
    moraleja: 'Vale lo que vale', cta: 'Comenta CURSO', palabraClave: 'CURSO', caption: 'El caption', duracionEstimadaSeg: 32,
  } }, { id: 'roto' }]);
  assert.equal(ps.length, 2);
  assert.equal(ps[1].tipo, 'reel');
  assert.equal(ps[1].props.duracion, 32);
  const t = textoDelDoc(ps[1].contenido);
  for (const x of ['Cobras poco', 'COBRA MÁS', 'Primero esto | plano medio', 'Después aquello | detalle', 'Vale lo que vale', 'Comenta CURSO', 'CURSO', 'El caption']) assert.ok(t.includes(x), x);
  assert.deepEqual(secciones(ps[1].contenido), ['GANCHO', 'HISTORIA', 'MORALEJA', 'CTA', 'CAPTION']);
});

test('la mudanza respeta el tope: el padre va sólo si va alguna hija', () => {
  const muchas = paginasDeAdsWriter([{ nombre: 'x', guiones: Array.from({ length: 50 }, (_, i) => ({ id: `g${i}`, texto: `Guion ${i}` })) }], CATALOGO);
  const reels = paginasDeReels([{ id: 'r', pedido: 'p', pieza: { hook: {}, escenas: [] } }]);
  assert.equal(loQueSeMuda([muchas, reels], 10).length, 10, 'el tope del lugar');
  assert.equal(loQueSeMuda([muchas, reels], 1).length, 0, 'sin lugar para una hija, ni el padre');
  // El padre también ocupa lugar: con 5, tres guiones y su padre (4) y ya no entra el Reel con el suyo (serían 6).
  const tres = paginasDeAdsWriter([{ nombre: 'y', guiones: [1, 2, 3].map((i) => ({ id: `t${i}`, texto: `Guion ${i}` })) }], CATALOGO);
  assert.equal(loQueSeMuda([tres, reels], 5).length, 4);
  assert.equal(loQueSeMuda([muchas, reels], 10_000).length, 51 + 2);
  assert.ok(loQueSeMuda([muchas], 10_000).length <= TOPE_MUDANZA + 1);
});

// ── Los ejemplos reales (29/10/2026: docs/plantillas-reales/copywriter.md) ──────────────────────────────────

// Gente y negocios REALES: la lista vive en tests/_reales.ts desde el 29/10/2026 (la miran las cinco tabs de Create).
/** Un contraste del tipo «no es X, es Y» / «no son X: son Y» / «no… sino»: el experto lo permite una vez, en el gancho. */
const CONTRASTE = /\bno (?:es|son|fue)\b[^.?!»]{1,80}?[,:;]\s*(?:es|son|fue)\b|\bno\b[^.?!»]{1,80}?\bsino\b|\bnunca fue\b[^.?!»]{1,80}?\bsino\b/gi;
/** Las muletillas que el método prohíbe (lib/copywriter/experto.ts): los ejemplos tampoco las usan. */
const MULETILLAS = /en el mundo de hoy|\bdescubre\b|\bpotencia\b|transforma tu vida|sin más preámbulos/i;

test('cada ejemplo es completo y de un negocio ficticio: 🧪 arriba, sin [DATO:, sin {{, sin voseo, sin muletillas ni nombres reales', () => {
  assert.ok(REALES.length >= 10, 'no se pudo leer la lista REALES');
  const conEjemplo = plantillas.filter((p) => p.ejemplo);
  assert.equal(conEjemplo.length, 12);
  for (const p of conEjemplo) {
    const doc = p.contenido();
    const texto = textoDelDoc(doc);
    assert.ok((doc.content ?? []).some((b) => b.type === 'callout' && b.attrs?.emoji === '🧪'), `${p.id}: sin el destacado 🧪 que dice que es ficticio`);
    assert.ok(texto.includes(p.ejemplo!.negocio), `${p.id}: el ejemplo no nombra a su negocio`);
    assert.ok(!texto.includes('[DATO:'), `${p.id}: el ejemplo está completo, sin [DATO:`);
    assert.ok(!texto.includes('{{'), `${p.id}: {{ pasaría por renderPrompt como un slot`);
    assert.deepEqual(marcasDeVoseo(texto), [], `${p.id}: voseo`);
    assert.ok(!MULETILLAS.test(texto), `${p.id}: una muletilla que el experto prohíbe`);
    for (const r of REALES) assert.ok(!sinAcentos(texto).includes(sinAcentos(r)), `${p.id} nombra a ${r}, que es real`);
    for (const b of bloquesDelDoc(doc)) {
      const n = (b.texto.match(CONTRASTE) ?? []).length;
      assert.ok(n === 0 || (n === 1 && ['GANCHO', 'TEXTO PRINCIPAL'].includes(b.seccion ?? '')), `${p.id}: un contraste fuera del gancho (${b.seccion}): «${b.texto.slice(0, 80)}»`);
    }
    assert.ok(extractoDe(p).length > 10 && extractoDe(p).length <= 141, `${p.id}: el extracto de la tarjeta`);
    assert.ok(texto.includes(extractoDe(p).replace(/…$/, '')), `${p.id}: el extracto sale del ejemplo`);
    assert.ok(chipsDe(p).length >= 3, `${p.id}: los chips`);
    assert.ok(p.pide?.length && p.insignia, `${p.id}: lo que pide y su insignia`);
  }
});

test('el esqueleto: las mismas secciones que el ejemplo y nada del negocio ficticio', () => {
  for (const p of plantillas.filter((x) => x.ejemplo)) {
    const sEj = secciones(p.contenido());
    const sEsq = secciones(p.esqueleto());
    assert.deepEqual(sEsq, sEj, `${p.id}: el esqueleto tiene otras secciones`);
    assert.ok(sanearContenido(p.esqueleto()).ok, p.id);
    assert.ok(!textoDelDoc(p.esqueleto()).includes(p.ejemplo!.negocio), `${p.id}: el esqueleto nombra al negocio ficticio`);
    const r = restosDelEjemplo(p.contenido(), p);
    assert.ok(r.bloques > 0, `${p.id}: el ejemplo entero no cuenta como restos`);
    assert.deepEqual(restosDelEjemplo(p.esqueleto(), p), { bloques: 0, datos: 0 }, `${p.id}: el esqueleto cuenta restos`);
  }
  // Un [DATO: …] que dejó la adaptación se cuenta.
  const reel = plantillaPorId(catalogos, 'reel')!;
  const adaptado = docDeEjemplo('GANCHO\n- **Frase hablada:** [DATO: el tema que enseñas]\nCTA\n[DATO: la palabra clave]');
  assert.deepEqual(restosDelEjemplo(adaptado, reel), { bloques: 0, datos: 2 });
});

test('la página nace con la estructura: debajo de cada sección, una guía corta en itálica (y ninguna guía de más)', () => {
  // Martín (29/10/2026): «Poné la estructura, la misma». Una sección sin guía es un título suelto que no dice qué va ahí.
  for (const p of plantillas.filter((x) => x.ejemplo)) {
    const bloques = p.esqueleto().content ?? [];
    const conGuia = new Set<string>();
    bloques.forEach((b, i) => {
      if (b.type !== 'heading' || typeof b.attrs?.seccion !== 'string') return;
      const guia = bloques[i + 1];
      const texto = guia?.content?.[0];
      assert.equal(guia?.type, 'paragraph', `${p.id}: «${b.attrs.seccion}» sin su guía`);
      assert.ok(texto?.marks?.some((m) => m.type === 'italic'), `${p.id}: la guía de «${b.attrs.seccion}» no va en itálica`);
      assert.ok((texto?.text ?? '').length > 10 && (texto?.text ?? '').length <= 130, `${p.id}: la guía de «${b.attrs.seccion}» es de una línea`);
      conGuia.add(b.attrs.seccion);
    });
    assert.ok(conGuia.size > 0, `${p.id}: el esqueleto no tiene secciones con guía`);
    assert.deepEqual(marcasDeVoseo(textoDelDoc(p.esqueleto())), [], `${p.id}: voseo en las guías`);
    assert.ok(!/[A-ZÁÉÍÓÚÑ]{4,} [A-ZÁÉÍÓÚÑ]{4,}/.test(bloques.filter((b) => b.type === 'paragraph').map((b) => textoDelDoc({ type: 'doc', content: [b] })).join(' ')), `${p.id}: una guía en MAYÚSCULAS`);
  }
  // Una etiqueta de GUIAS que no es una sección del esqueleto es un error de tipeo: esa guía no se ve nunca.
  const fuente = leer('lib/copywriter/plantillas-guias.ts');
  for (const p of plantillas.filter((x) => x.ejemplo)) {
    const ini = fuente.indexOf(`${/^[a-z]+$/.test(p.id) ? p.id : `'${p.id}'`}: {`);
    assert.ok(ini >= 0, `${p.id}: sin guías`);
    const bloque = fuente.slice(ini, fuente.indexOf('\n  },', ini));
    const claves = [...bloque.matchAll(/^\s+(?:'([^']+)'|([A-ZÁÉÍÓÚÑ0-9]+)):/gm)].map((m) => m[1] ?? m[2]);
    const reales = new Set(secciones(p.esqueleto()));
    for (const k of claves) assert.ok(reales.has(k), `${p.id}: la guía «${k}» no es una sección`);
  }
});

test('las tarjetas: ninguna miniatura en blanco (Martín, 29/10/2026)', () => {
  // «las miniaturas de todos los templates reflejen de manera visual y fácilmente lo que estoy a punto de crear».
  for (const p of plantillasVisibles(plantillas)) {
    assert.ok(p.insignia, `${p.id}: sin insignia`);
    assert.ok([...p.insignia!].length <= 18, `${p.id}: la insignia «${p.insignia}» no entra arriba de la miniatura`);
    assert.ok((extractoDe(p) || p.descripcion).length > 10, `${p.id}: la hoja de la tarjeta quedaría en blanco`);
  }
  const copy = leer('app/copywriter/Copywriter.tsx');
  assert.match(copy, /extracto: extractoDe\(x\) \|\| x\.descripcion, chips: chipsDe\(x\)/, 'la tarjeta lleva el gancho y las secciones');
  assert.match(copy, /\.\.\.\(x\.ejemplo \? \{ ejemplo: x\.ejemplo\.negocio \} : \{\}\)/, 'y la cinta «Ejemplo»');
  assert.match(copy, /grupo: x\.grupo, ayuda: x\.descripcion/);
});

test('docDeEjemplo lee destacados, tablas y negritas; bloquesDeTexto (la API) sigue sin leerlos', () => {
  const d = docDeEjemplo('!🧪 Ejemplo\nGANCHO\n| A | B |\n| 1 | **dos** |\nTexto con **negrita**');
  assert.deepEqual(d.content?.map((b) => b.type), ['callout', 'heading', 'table', 'paragraph']);
  assert.deepEqual(d.content?.[2].content?.map((f) => f.content?.map((c) => c.type)), [['tableHeader', 'tableHeader'], ['tableCell', 'tableCell']]);
  assert.deepEqual(d.content?.[3].content?.map((n) => n.marks?.[0]?.type ?? null), [null, 'bold']);
  // Lo que crea la API de MaKo no cambia: lo mismo, leído como texto, son párrafos.
  const api = bloquesDeTexto('!🧪 Ejemplo\n| A | B |\nTexto con **negrita**');
  assert.deepEqual(api.map((b) => b.type), ['paragraph', 'paragraph', 'paragraph']);
  assert.equal(api[2].content?.[0]?.text, 'Texto con **negrita**');
});

test('«Guion de anuncio» y las demás FIJAN su estructura: si el super admin la cambió, la página nace sin estructura', () => {
  assert.equal(plantillaPorId(catalogos, 'guion-anuncio')?.estructura, 'pas');
  assert.equal(plantillaPorId(catalogos, 'youtube')?.estructura, 'youtube-retencion');
  const cambiada = catalogosLite(ANGULOS_GUION_DEFAULT, conVsl(ESTRUCTURAS_GUION_DEFAULT.map((e) => (e.id === 'pas' ? { ...e, etiquetas: ['GANCHO', 'CTA'] } : e))));
  assert.equal(plantillaPorId(cambiada, 'guion-anuncio')?.estructura, null, 'el ejemplo está escrito con las etiquetas de fábrica de PAS');
  // Y la API crea con el ESQUELETO, nunca con el ejemplo (un agente externo le dejaría el anuncio de Cierre Consultivo).
  const run = readFileSync(join(__dirname, '..', 'lib/api-mako/areas/copywriter.run.ts'), 'utf8');
  assert.match(run, /contenido: texto \? docDeTexto\(texto\) : pl \? pl\.esqueleto\(\) :/);
  assert.match(run, /plantilla: pl\?\.id \?\? null/);
});

test('el id de una página mudada sale de su origen: el mismo cada vez, distinto por negocio y por guion', () => {
  const ps = paginasDeAdsWriter(RAZONES, CATALOGO);
  const ids = ps.map((p) => idDeMudanza(7, p.clave));
  assert.ok(ids.every((id) => esIdPagina(id)), 'un id que la pantalla no acepta abre «No existe»');
  assert.deepEqual(paginasDeAdsWriter(RAZONES, CATALOGO).map((p) => idDeMudanza(7, p.clave)), ids, 'repetir la mudanza duplicaba');
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id, i) => id !== idDeMudanza(8, ps[i].clave)), 'dos negocios no comparten un id (ni su charla)');
  // El mismo id de guion en dos celdas son dos páginas; repetido en la misma celda, una.
  const dos = paginasDeAdsWriter([{ id: 'a', nombre: 'A', guiones: [{ id: 'x', texto: 'Uno' }, { id: 'x', texto: 'Otra vez' }] }, { id: 'b', nombre: 'B', guiones: [{ id: 'x', texto: 'Dos' }] }], CATALOGO);
  assert.equal(dos.length, 3, 'el padre, una de A y una de B');
});

test('la celda de antes del multi-guion (sólo `guion`) se muda como «General», como la muestra la matriz', () => {
  const ps = paginasDeAdsWriter([{ id: 'v', nombre: 'Celda vieja', guion: 'GANCHO\nLo de antes' }], CATALOGO);
  assert.deepEqual(ps.map((p) => p.titulo), ['Guiones del Ads Writer', 'Celda vieja · General']);
  assert.deepEqual(secciones(ps[1].contenido), ['GANCHO']);
});

test('la mudanza pone los Reels PRIMERO: con el tope lleno de guiones, los Reels entran igual', () => {
  const muchas = paginasDeAdsWriter([{ nombre: 'x', guiones: Array.from({ length: 50 }, (_, i) => ({ id: `g${i}`, texto: `Guion ${i}` })) }], CATALOGO);
  const reels = paginasDeReels([{ id: 'r', pedido: 'p', pieza: { hook: {}, escenas: [] } }]);
  assert.ok(loQueSeMuda([reels, muchas], 10).some((p) => p.tipo === 'reel'));
  const mudanza = readFileSync(join(__dirname, '..', 'lib/copywriter/mudanza.ts'), 'utf8');
  assert.match(mudanza, /const grupos = \[paginasDeReels\(parse\(reels\)\), paginasDeAdsWriter\(parse\(razones\), catalogo\)\];/);
});

// Verificado rompiéndolo (29/10/2026, 7 tests): con `TITULO` fuera de CON_TILDE (doc.ts), 1 falla (el «Título»); con el
// template del Reel sin la sección CAPTION, 1; con la mudanza sin mirar el catálogo (el ángulo tal cual), 1; con
// `loQueSeMuda` sin contar al padre, ninguno hasta que se sumó el caso de 5 lugares: ahora 1. Restaurado: 7 de 7.
