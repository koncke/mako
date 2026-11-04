// Qué funnel usa un competidor, con la evidencia citada de sus piezas (lib/spy-funnel-tipo.ts), y la pestaña Funnel en su orden
// (4/11/2026).
//
// Martín, con Den Borg: «Quiero que se analice qué funnel utiliza... denborg es obvio que hace funnel de eventos presenciales». El
// Cerebro: «la clasificación sale del catálogo; debe reconocer el evento presencial de Den Borg con evidencia de sus piezas». Y el
// orden: «la oferta y el funnel que usa arriba de todo; las webs con su preview y un desplegable de páginas al final, sin nada debajo».
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · lib/spy-catalogo-datos.ts sin un funnel (a mano, sin regenerar)              → 1
//   · `compuestas` sin la del evento presencial (fecha + entradas)                  → 2
//   · una frase que DESCARTA que no baja las fuertes de su pieza                    → 3
//   · sin pedir 2 piezas para las débiles (`piezasDebiles.size < 2`)                 → 5
//   · una pieza descartada que igual aporta sus palabras sueltas                     → 3
//   · `hostCoincide` con `includes` en vez de mirar el host                         → 6
//   · `fuentesDeEvidencia` que no saltea la landing ya leída como página            → 8
//   · `leerSuOferta` que lee la página de enlaces en vez de las que enlaza          → 9
//   · `hayQueLeer` sin la vuelta para las lecturas sin texto guardado               → 9
//   · la pestaña con algo debajo de «Sus páginas»                                    → 11
//
// Correr: node --import tsx --test tests/spy-funnel-tipo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { leerCatalogo } from '../lib/spy-catalogo-leer';
import { FORMATOS_DEL_CATALOGO, FUNNELS_DEL_CATALOGO } from '../lib/spy-catalogo-datos';
import {
  clasificarFunnel, fuentesDeEvidencia, hostCoincide, partesDeCita, type FuenteDeEvidencia, type PiezaParaEvidencia,
} from '../lib/spy-funnel-tipo';
import { hayQueLeer, leerOferta, leerSuOferta, reclamarLectura, type DepsOferta, type PaginaLeida } from '../lib/spy-oferta';
import { paginasQueEnlaza } from '../lib/spy-otras-redes-reglas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Datos inventados con la forma de los de un competidor que vende eventos presenciales (nada de un competidor real).
const PIEZAS: PiezaParaEvidencia[] = [
  { id: 11, canal: 'instagram', tipo: 'reel', texto: 'Nos vemos el 15 de noviembre en Guadalajara. Preventa de boletos abierta, cupo limitado.', publicada_en: '2026-10-03T10:00:00Z' },
  { id: 12, canal: 'instagram', tipo: 'publicacion', texto: 'Así se vivió la primera edición del evento. ¡Gracias Monterrey!', publicada_en: '2026-09-03T10:00:00Z' },
  { id: 13, canal: 'anuncios', tipo: 'anuncio', texto: 'Compra tu entrada para el seminario de marca personal.', dominio_destino: 'eventbrite.com.mx' },
  { id: 14, canal: 'youtube', tipo: 'video', titulo: 'Cómo vender más con tu marca personal', texto: 'Un tutorial paso a paso.' },
];
const PAGINAS = [{ url: 'https://evento.example.com/gdl', titulo: 'Evento Guadalajara', texto: 'Sede del evento: centro de convenciones. 15 de noviembre. Entradas VIP y general.' }];

test('1. el catálogo del documento y el del código dicen lo mismo, y cada funnel dice qué es', () => {
  const doc = leerCatalogo(leer('docs/catalogo-funnels-y-formatos.md'));
  assert.deepEqual(doc.funnels, FUNNELS_DEL_CATALOGO, 'regenerar: node --import tsx scripts/spy-catalogo-a-codigo.mts');
  assert.deepEqual(doc.formatos, FORMATOS_DEL_CATALOGO, 'regenerar: node --import tsx scripts/spy-catalogo-a-codigo.mts');
  assert.ok(FUNNELS_DEL_CATALOGO.length >= 20, 'la investigación trae los tipos que se usan');
  assert.equal(new Set(FUNNELS_DEL_CATALOGO.map((f) => f.id)).size, FUNNELS_DEL_CATALOGO.length, 'sin ids repetidos');
  for (const f of FUNNELS_DEL_CATALOGO) {
    assert.ok(f.que && f.que.length <= 80, `${f.id}: su línea de «qué es», corta`);
    assert.ok((f.fuertes?.length ?? 0) + (f.hosts?.length ?? 0) > 0, `${f.id}: algo que lo delate solo`);
  }
  for (const id of ['evento-presencial', 'webinar-en-vivo', 'vsl-llamada', 'aplicacion-llamada', 'reto']) {
    assert.ok(FUNNELS_DEL_CATALOGO.some((f) => f.id === id), `el catálogo tiene ${id}`);
  }
});

test('2. el evento presencial se reconoce con lo que dicen sus piezas, y cada cita dice de dónde sale', () => {
  const r = clasificarFunnel(fuentesDeEvidencia(PIEZAS, PAGINAS));
  assert.equal(r.principal?.id, 'evento-presencial');
  assert.equal(r.principal?.label, 'Evento presencial');
  const ev = r.principal?.evidencias ?? [];
  assert.equal(ev.length, 3, 'tres citas');
  assert.equal(new Set(ev.map((e) => e.etiqueta)).size, 3, 'de tres lugares distintos');
  assert.ok(ev.some((e) => e.donde === 'web' && e.url === PAGINAS[0].url), 'la página, con su dirección (se elige en «Sus páginas»)');
  assert.ok(ev.some((e) => e.piezaId === 11 && e.frase === 'fecha + entradas'), 'la fecha con la preventa del reel');
  for (const e of ev) assert.ok(e.cita.length > 10, 'una cita de verdad, no la frase pelada');
  // Sólo el reel: la compuesta (fecha + boletos) alcanza.
  assert.equal(clasificarFunnel(fuentesDeEvidencia([PIEZAS[0]])).principal?.id, 'evento-presencial');
});

test('3. lo que dice «por Zoom» no es presencial: la frase fuerte de esa pieza baja a débil', () => {
  const online: FuenteDeEvidencia = { donde: 'publicacion', etiqueta: 'Reel', texto: 'Evento presencial no: es 100% online, por Zoom. Comprar entradas en el link.' };
  assert.notEqual(clasificarFunnel([online]).principal?.id, 'evento-presencial');
  const otroOnline: FuenteDeEvidencia = { donde: 'publicacion', etiqueta: 'Post', texto: 'Seminario por Zoom: comprar entradas acá.' };
  assert.notEqual(clasificarFunnel([online, otroOnline]).principal?.id, 'evento-presencial', 'ni sumando dos piezas online');
  const hibrido: FuenteDeEvidencia = { donde: 'web', etiqueta: 'Su web', texto: 'Evento presencial y online, modalidad híbrida: comprar entradas.' };
  assert.equal(clasificarFunnel([hibrido]).principal?.id, 'evento-presencial', 'un híbrido sigue siendo presencial');
});

test('4. sin nada que lo nombre, «no sé»: nunca se adivina', () => {
  const r = clasificarFunnel(fuentesDeEvidencia([PIEZAS[3], { id: 20, canal: 'instagram', tipo: 'reel', texto: 'Tres errores al grabar tus videos.' }]));
  assert.equal(r.principal, null);
  assert.deepEqual(r.otros, []);
  assert.equal(clasificarFunnel([]).principal, null);
});

test('5. sin una fuerte, hacen falta dos débiles distintas de dos piezas distintas', () => {
  const una: FuenteDeEvidencia = { donde: 'publicacion', etiqueta: 'Post', texto: 'Qué gran conferencia.' };
  assert.equal(clasificarFunnel([una]).principal, null);
  const dosEnUna: FuenteDeEvidencia = { donde: 'publicacion', etiqueta: 'Post', texto: 'Qué gran conferencia, gracias a los speakers.' };
  assert.equal(clasificarFunnel([dosEnUna]).principal, null, 'puede ser la conferencia de otro');
  const otra: FuenteDeEvidencia = { donde: 'publicacion', etiqueta: 'Otro post', texto: 'Ya casi: la sede está lista.' };
  const r = clasificarFunnel([una, otra]);
  assert.equal(r.principal?.id, 'evento-presencial');
  assert.equal(r.principal?.fuertes, 0);
  assert.deepEqual(r.otros, [], '«También usa» pide una frase fuerte');
});

test('6. un host del catálogo se mira en el host, no en cualquier parte', () => {
  assert.equal(hostCoincide('https://www.eventbrite.com.mx/e/123', 'eventbrite.'), true);
  assert.equal(hostCoincide('eventbrite.com/e/1', 'eventbrite.'), true);
  assert.equal(hostCoincide('https://noeventbrite.com/x', 'eventbrite.'), false);
  assert.equal(hostCoincide('https://ejemplo.com/?ir=eventbrite.com', 'eventbrite.'), false, 'en la query no cuenta');
  assert.equal(hostCoincide('https://zoom.us/webinar/register/abc', 'zoom.us/webinar/register'), true);
  assert.equal(hostCoincide('https://zoom.us/j/1', 'zoom.us/webinar/register'), false);
  const anuncio = fuentesDeEvidencia([{ id: 9, canal: 'anuncios', tipo: 'anuncio', texto: '', dominio_destino: 'eventbrite.com.mx' }]);
  assert.equal(clasificarFunnel(anuncio).principal?.id, 'evento-presencial', 'adonde manda un anuncio también delata');
});

test('7. la cita se resalta sin tildes ni mayúsculas, y sin la frase va entera', () => {
  const p = partesDeCita('Ya está la PREVENTA de Entradas para Monterrey', 'preventa de entradas');
  assert.deepEqual(p, { antes: 'Ya está la ', frase: 'PREVENTA de Entradas', despues: ' para Monterrey' });
  const t = partesDeCita('Último día: sede del Evento', 'sede del evento');
  assert.equal(t.frase, 'sede del Evento');
  assert.deepEqual(partesDeCita('nada que ver', 'fecha + entradas'), { antes: 'nada que ver', frase: '', despues: '' });
});

test('8. las fuentes: sus páginas primero, la landing ya leída no se repite, y cada una con su nombre', () => {
  const landing: PiezaParaEvidencia = { id: 30, canal: 'landing', tipo: 'landing', titulo: 'Evento', texto: 'x', url: PAGINAS[0].url };
  const f = fuentesDeEvidencia([...PIEZAS, landing], PAGINAS);
  assert.equal(f[0].donde, 'web');
  assert.equal(f[0].etiqueta, 'Evento Guadalajara');
  assert.equal(f.filter((x) => x.urls?.includes(PAGINAS[0].url)).length, 1, 'la landing leída como página no vuelve como pieza');
  assert.deepEqual(f.map((x) => x.etiqueta).slice(1), ['Reel del 3 oct', 'Publicación del 3 sept', 'Anuncio', 'Video']);
  assert.equal(f.find((x) => x.piezaId === 13)?.donde, 'anuncio');
  assert.deepEqual(f.find((x) => x.piezaId === 13)?.urls, ['eventbrite.com.mx']);
});

// ── Las páginas de una página de enlaces (la de Den Borg es de Beacons) ─────────────────────────────────────────────────

const ENLACES = 'https://beacons.page/marca';
const EVENTO = 'https://evento.example.com/gdl';
const TIENDA = 'https://tienda.example.com/';
const TEXTO = 'Evento presencial de marca personal. Compra tu entrada. '.repeat(10);

function doble(paginas: Map<string, PaginaLeida>, enlaces: string[]): DepsOferta & { store: { crudo: string | null }; bajadas: string[] } {
  let n = 0;
  const d = {
    store: { crudo: null as string | null },
    bajadas: [] as string[],
    leer: async () => ({ crudo: d.store.crudo, version: d.store.crudo }),
    cambiarSi: async (v: string | null, nuevo: string) => { if (d.store.crudo !== v) return false; d.store.crudo = nuevo; return true; },
    bajar: async (url: string) => { d.bajadas.push(url); const p = paginas.get(url); if (!p) throw new Error('404'); return p; },
    diagnosticar: async () => ({ ok: false as const, error: 'sin IA en el test' }),
    enlacesDe: async () => enlaces,
    nuevoIntento: () => `t${++n}`,
  };
  return d;
}

test('9. de una página de enlaces se leen las páginas que enlaza, y quedan para «Sus páginas»', async () => {
  const paginas = new Map<string, PaginaLeida>([
    [ENLACES, { url: ENLACES, titulo: 'Marca', texto: 'links' }],
    [EVENTO, { url: EVENTO, titulo: 'Evento GDL', texto: TEXTO }],
    [TIENDA, { url: TIENDA, titulo: 'Tienda', texto: TEXTO }],
  ]);
  const d = doble(paginas, [EVENTO, TIENDA]);
  const T0 = Date.parse('2026-11-04T12:00:00Z');
  const r = await reclamarLectura(d, [ENLACES], T0);
  assert.equal(r.corre, true);
  const fin = await leerSuOferta(d, { nombre: 'Marca' }, r as Extract<typeof r, { corre: true }>, () => T0 + 1000);
  assert.deepEqual(d.bajadas, [EVENTO, TIENDA], 'la página de enlaces no se lee como su web: se leen las suyas');
  assert.deepEqual(fin.enlaces, [ENLACES, EVENTO, TIENDA], 'todas quedan para el desplegable');
  // Sin IA no hay diagnóstico, pero el texto de lo que se leyó NO se guarda sin diagnóstico: el estado es el del fallo.
  assert.equal(fin.estado, 'no-pudo');
  // Una lectura «lista» de antes, sin el texto de sus páginas, se vuelve a leer una vez.
  const vieja = { ...leerOferta(d.store.crudo)!, estado: 'lista' as const, leidaEn: new Date(T0).toISOString(), paginas: [] };
  assert.equal(hayQueLeer(vieja, [ENLACES], T0 + 60_000), true);
  assert.equal(hayQueLeer({ ...vieja, paginas: [{ url: EVENTO, titulo: 'Evento', texto: TEXTO }] }, [ENLACES], T0 + 60_000), false);
});

test('10. de una página de enlaces se ofrecen sus páginas, no sus redes, ni la misma, ni archivos', () => {
  const urls = [
    'https://instagram.com/marca', 'https://beacons.page/marca/otra', 'https://evento.example.com/gdl?utm=1',
    'https://evento.example.com/gdl/', 'https://linktr.ee/otra', 'https://tienda.example.com/', 'https://x.example.com/guia.pdf',
  ];
  assert.deepEqual(paginasQueEnlaza(urls, ENLACES, 8), ['https://evento.example.com/gdl', 'https://tienda.example.com']);
  assert.deepEqual(paginasQueEnlaza(urls, ENLACES, 1), ['https://evento.example.com/gdl'], 'con su tope');
});

test('11. la pestaña Funnel: su funnel y su oferta arriba, las notas, y AL FINAL sus páginas, sin nada debajo', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const i = app.indexOf("{activa === 'funnel' && (");
  assert.ok(i > 0);
  const tab = app.slice(i, app.indexOf('</div>\n            )}', i) + 30);
  const pos = (re: RegExp) => { const m = re.exec(tab); assert.ok(m, `está ${re}`); return m!.index; };
  const tipo = pos(/<SuFunnelTipo/);
  const cabeza = pos(/parte="cabeza"/);
  const detalle = pos(/parte="detalle"/);
  const paginas = pos(/<SusPaginas/);
  assert.ok(tipo < detalle && cabeza < detalle && detalle < paginas, 'el orden del pedido');
  assert.match(tab.slice(paginas), /^<SusPaginas[\s\S]*?\/>\s*\)\}\s*<\/div>/, 'nada debajo de sus páginas');
  assert.equal((app.match(/activa === 'funnel'/g) ?? []).length, 1, 'una sola pestaña Funnel: lo de antes (la ficha del sitio abajo) se fue');
  // La vista previa es la que ya existe, con su aislamiento y su puerta.
  const sp = sinComentarios(leer('app/competitor-spy/SusPaginas.tsx'));
  assert.match(sp, /src=\{conWs\(srcPaginaDiagnostico\(url\), ws\)\}/);
  assert.match(sp, /sandbox="allow-scripts"/);
  const page = sinComentarios(leer('app/competitor-spy/page.tsx'));
  assert.match(page, /conVistaPrevia=\{esAdmin && tabEnCapa\('landing-writer', capa\)\}/, 'la misma puerta que la ruta de la vista previa');
});
