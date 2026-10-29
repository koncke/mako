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
import { GRUPOS_PLANTILLA, gruposDePlantillas, plantillaPorId, plantillasDe } from '../lib/copywriter/plantillas';
import { catalogosLite, conVsl } from '../lib/copywriter/catalogos';
import { esIdPagina, TIPOS_GUION } from '../lib/copywriter/tipos';
import { ANGULOS_GUION_DEFAULT } from '../lib/guion-angulos';
import { ESTRUCTURAS_GUION_DEFAULT } from '../lib/guion-estructuras';
import { ESTRUCTURAS_VSL_DEFAULT } from '../lib/vsl-estructuras';
import { idDeMudanza, loQueSeMuda, paginasDeAdsWriter, paginasDeReels, TOPE_MUDANZA } from '../lib/copywriter/mudanza-reglas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const catalogos = catalogosLite(ANGULOS_GUION_DEFAULT, conVsl(ESTRUCTURAS_GUION_DEFAULT));
const plantillas = plantillasDe(catalogos);
const secciones = (doc: Parameters<typeof bloquesDelDoc>[0]) => bloquesDelDoc(doc).filter((b) => b.tipo === 'seccion').map((b) => b.seccion);

test('los templates: ids únicos, tipos que existen y los grupos en su orden', () => {
  const ids = plantillas.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of plantillas) assert.ok((TIPOS_GUION as readonly string[]).includes(p.tipo), `${p.id}: ${p.tipo}`);
  assert.deepEqual(gruposDePlantillas(plantillas).map((g) => g.grupo), GRUPOS_PLANTILLA.filter((g) => plantillas.some((p) => p.grupo === g)));
  // Lo que pidió Martín: Reels, copys de anuncios, emails, posts y VSL; y lo que ya tenía (el guion de anuncio, stories, YouTube).
  for (const id of ['reel', 'copy-anuncio', 'email', 'carrusel', 'guion-anuncio', 'stories', 'youtube', 'blanco']) assert.ok(plantillaPorId(catalogos, id), id);
  assert.ok(plantillas.some((p) => p.tipo === 'vsl'));
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
