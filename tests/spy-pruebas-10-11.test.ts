// =============================================================================
// Competitor Spy — lo que se rompió en la prueba de punta a punta en producción (10/11/2026)
// =============================================================================
// El informe, caso por caso y con capturas: docs/pruebas/competitor-spy-10-11.md. Un test por arreglo; los de código de pantalla
// (React, server actions) se miran sobre el archivo, sin comentarios, porque no se pueden montar sin el navegador.
//
// Probado rompiéndolo (10/11/2026): cada arreglo se deshizo de a uno y su test se puso rojo:
//   R1. `<section className="spy-riel"` → `<aside …`                                        → falla el 1
//   R2. `resumenDePiezas` con `.limit(5000)` de nuevo                                         → falla el 2
//   R3. `fechaCorta` con `getUTCDate()`                                                       → falla el 3
//   R4. `SOLO_EN_CONTEXTO` sin la entrada de `live`                                            → falla el 4
//   R5. `tituloDeCopia` = `cortarSinPartir(…, 120)` a secas                                    → falla el 5
//   R6. `textoParaCopiar` con `${p.megusta} me gusta`                                          → falla el 5
//   R7. `listarSugeridos` sin `.filter(tieneDondeLeerlo)`                                      → falla el 6
//   R8. `caraDeTarjeta(…, null)` en los sugeridos                                              → falla el 6
//   R9. `quitar` sin `sacarDeLaLista(id)`                                                      → falla el 7
//   R10. `precargarTodas` sin llamar a `alTerminar`                                            → falla el 8
// Y la segunda vuelta (11/11/2026, mirado con capturas), también rota de a una:
//   R11. `<MejoresPiezas>` de vuelta en el riel                                               → falla el 9
//   R12. `miniaturaChica` = la grande · R13. `MejoresPiezas` con `miniaturaDePieza`            → falla el 10
//   R14. el nombre de la tarjeta en un renglón                                                 → falla el 11
//   R15. la cuarta cifra del detalle sin su número                                             → falla el 12
//   R16. `esPaginaDeError` sin «couldn’t load»                                                 → falla el 13
//   R17. «0% de 637»                                                                           → falla el 14
//   R18. `piezasACopiar` sin `medio` ni `laminas`                                              → falla el 15
//   R19. `.m-cabecera__lado` sin tope                                                          → falla el 16
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fechaCorta, miniaturaChica } from '../lib/spy-vista';
import { esPaginaDeError, marcoVerificado } from '../lib/pagina-real';
import { clasificarFunnel, fuentesDeEvidencia, type PiezaParaEvidencia } from '../lib/spy-funnel-tipo';
import { textoParaCopiar, tituloDeCopia } from '../lib/spy-detalle';
import { listarSugeridos, piezasACopiar, tieneDondeLeerlo, type DepsSugeridos, type FilaCompetidor } from '../lib/spy-sugeridos';
import { precargarTodas, TOPE_PRECARGA_MS } from '../app/competitor-spy/precarga';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el riel de la ficha NO es un <aside>: con la barra de la agencia, la regla global le forzaba el alto de la ventana', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /<section className="spy-riel"/, 'el riel es un <section>');
  assert.doesNotMatch(app, /<aside[\s>]/, 'ningún <aside> en la tab: `[data-barra-agencia] aside` (app/globals.css) lo estira');
});

test('2. el resumen de la lista se lee de a páginas: PostgREST corta en 1000 sin avisar', () => {
  const spy = sinComentarios(leer('lib/spy.ts'));
  const cuerpo = spy.slice(spy.indexOf('export async function resumenDePiezas'), spy.indexOf('export const PIEZAS_POR_COMPETIDOR'));
  assert.ok(cuerpo.length > 100, 'encontré resumenDePiezas');
  assert.match(cuerpo, /leerPorPaginas</, 'paginado');
  assert.doesNotMatch(cuerpo, /\.limit\(/, 'sin un .limit que el servidor recorta a 1000');
});

test('3. la fecha se dice en la zona del producto, igual en el servidor y en el navegador (era UTC)', () => {
  const ahora = new Date('2026-11-11T01:03:00Z'); // las 22:03 del 10/11 en Argentina, las 17:03 en Tijuana
  assert.equal(fechaCorta('2026-11-11T01:03:00Z', ahora), '10 nov', 'recién agregado a la noche: sigue siendo el 10');
  assert.equal(fechaCorta('2026-10-12T12:00:00Z', ahora), '12 oct');
  assert.equal(fechaCorta('2025-12-31T12:00:00Z', ahora), '31 dic 2025', 'de otro año, con el año');
  assert.equal(fechaCorta('2026-01-01T03:00:00Z', ahora), '31 dic 2025', 'el año también es el de la zona');
  assert.equal(fechaCorta('no es una fecha', ahora), '');
});

test('4. «live» suelto no es un webinar: «is live», «answers, live» y el verbo no cuentan; «live training» y «join me live» sí', () => {
  const pieza = (id: number, texto: string): PiezaParaEvidencia => ({ id, canal: 'instagram', tipo: 'reel', texto, publicada_en: '2026-10-02T15:00:00Z' });
  // Los reels de Leila Hormozi que la volvían «Webinar en vivo» (ws 3, 10/11/2026), más su única «masterclass».
  const leila = [
    pieza(1, 'The Scale or Fail season finale is now LIVE Comment “FINALE” to watch the full episode'),
    pieza(2, 'Balance is a myth Episode 1 of Dear Leila is live, exclusively on YouTube'),
    pieza(3, 'No scripts, no prep ahead of time… just unfiltered answers, live. Exclusively on YouTube'),
    pieza(4, 'What It Actually Costs to Live Like the 1%'),
    pieza(5, 'Clip is from our recent live masterclass that has just been published'),
  ];
  const sinWebinar = clasificarFunnel(fuentesDeEvidencia(leila));
  assert.notEqual(sinWebinar.principal?.id, 'webinar-en-vivo', 'un episodio publicado no es una clase en vivo');
  // Y el webinar de verdad sigue saliendo.
  const webinar = clasificarFunnel(fuentesDeEvidencia([
    pieza(6, 'Join me live this Thursday, 7pm'),
    pieza(7, 'Save your seat for the live training'),
  ]));
  assert.equal(webinar.principal?.id, 'webinar-en-vivo', 'con «join me live» y «live training» de dos piezas, es webinar');
  assert.ok(webinar.principal?.evidencias.some((e) => e.frase === 'live'), '«live» cuenta en su contexto');
});

test('5. «Hacer uno así»: el título se corta en una palabra entera con «…», y los números van como en la ficha', () => {
  const t = tituloDeCopia('Leila Hormozi', 'Comment “PARTNER” to watch the full episode. A good partner multiples your strengths. A bad one multiplies your weaknesses.');
  assert.ok(t.length <= 120, `entra en 120 (${t.length})`);
  assert.ok(t.endsWith('…'), 'dice que sigue');
  assert.doesNotMatch(t, /\bmult…$/, 'no corta «multiplies» por la mitad');
  assert.match(t, /^Como Leila Hormozi: Comment/);
  assert.equal(tituloDeCopia('X', 'corto'), 'Como X: corto', 'lo que entra, entero y sin «…»');
  const texto = textoParaCopiar({ nombre: 'Leila Hormozi' }, {
    canal: 'instagram', tipo: 'reel', url: 'https://www.instagram.com/p/DfYfvMeo430/', titulo: null, texto: 'Hola', vistas: 1_200_000, megusta: 13_588, analisis: null,
  });
  assert.match(texto, /Instagram · 1\.2 M vistas · 14 mil me gusta · https:/, 'como dice la ficha');
  assert.doesNotMatch(texto, /13588/);
});

test('6. «Sugeridos»: sólo los que tienen de dónde leerlos, y con la cara dibujada del referente', async () => {
  const fila = (id: number, nombre: string, extra: Partial<FilaCompetidor> = {}): FilaCompetidor => ({
    id, workspace_id: 9, nombre, instagram: null, youtube_id: null, tiktok: null, landing_url: null, avatar: null,
    instagram_seguidores: null, youtube_suscriptores: null, ...extra,
  });
  const deps: DepsSugeridos = {
    plataforma: async () => 9,
    actual: async () => 3,
    competidoresDe: async () => [fila(5, '@AlexHormozi', { youtube_id: '@AlexHormozi' }), fila(24, 'Shelby Sapp'), fila(25, 'Jeremy Miner')],
    caricaturasDe: async () => new Map(),
    propios: async () => [],
  };
  const s = await listarSugeridos(deps);
  assert.deepEqual(s.map((x) => x.id), [5], 'los que son sólo un nombre no se ofrecen: «Sumar» dejaba una ficha vacía');
  assert.equal(s[0].cara, '/asesores/grandes/hormozi.png', 'la misma cara que en «Competidores» y en el teléfono, no una «A»');
  assert.equal(tieneDondeLeerlo({ instagram: ' ', youtube_id: null, tiktok: null, landing_url: null }), false, 'un espacio no es un canal');
  assert.equal(tieneDondeLeerlo({ instagram: null, youtube_id: null, tiktok: null, landing_url: 'https://x.com' }), true);
});

test('7. «Dejar de mirarlo» desde la ficha lo saca de la lista en el acto, sin depender de la recarga', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const quitar = app.slice(app.indexOf('const quitar = async'), app.indexOf('const quitarDeLaLista'));
  assert.ok(quitar.length > 50, 'encontré quitar');
  assert.match(quitar, /sacarDeLaLista\(id\);\s*irA\(null\);/, 'primero se saca, después se navega');
  assert.match(app, /const sacarDeLaLista = \(id: number\) => \{\s*setCompetidores\(\(v\) => v\.filter\(\(x\) => x\.id !== id\)\);/);
});

test('8. las portadas que llegan después del tope no se tiran: se avisan al terminar', async () => {
  const g = globalThis as unknown as { Image?: unknown; window?: unknown };
  const antes = { Image: g.Image, window: g.window };
  // Una «imagen» que tarda: la primera llega en el acto, la segunda después del tope.
  class ImagenFalsa {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    referrerPolicy = '';
    decode() { return Promise.resolve(); }
    set src(u: string) { setTimeout(() => this.onload?.(), u.includes('lenta') ? TOPE_PRECARGA_MS + 50 : 0); }
  }
  g.Image = ImagenFalsa;
  g.window = { setTimeout };
  try {
    let tarde: Set<number> | null = null;
    const llegoTarde = new Promise<void>((r) => {
      void precargarTodas([{ id: 1, url: 'https://x/rapida.jpg' }, { id: 2, url: 'https://x/lenta.jpg' }], (ok) => { tarde = ok; r(); })
        .then((aTiempo) => assert.deepEqual([...aTiempo], [1], 'al tope, sólo la rápida'));
    });
    await llegoTarde;
    assert.deepEqual([...(tarde ?? [])].sort(), [1, 2], 'al terminar, las dos');
  } finally {
    g.Image = antes.Image;
    g.window = antes.window;
  }
});

// ── Segunda vuelta (11/11/2026): MIRADO con capturas, contra fitlo y merrin ───────────────────────────────────────────────

test('9. «A dónde manda» y «Lo que mejor le fue» van en la fila de abajo, no en el riel (la caja de formatos medía 739 px con 82 de contenido)', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const riel = app.slice(app.indexOf('const riel = c ?'), app.indexOf('const filaBaja ='));
  assert.ok(riel.length > 100, 'encontré el riel');
  assert.doesNotMatch(riel, /<MejoresPiezas|<CajaDestinos|A dónde manda/, 'el riel no los lleva');
  const fila = app.slice(app.indexOf('const filaBaja ='), app.indexOf('const filaBaja =') + 600);
  assert.match(fila, /<div className="spy-fila-baja">\s*<CajaDestinos piezas=\{flujo\} \/>\s*<MejoresPiezas /);
  assert.match(app, /\{riel\}\s*<\/div>\s*\{filaBaja\}/, 'la fila va justo debajo de las dos columnas');
  assert.match(app, /\.spy-fila-baja\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,320px\),1fr\)\)/);
  assert.match(app, /\.spy-fila-baja \.spy-mejores\{--mejores-fluye:1;/, 'ahí muestra 5 y fluye, no llena un alto');
});

test('10. lo chico de YouTube va con la miniatura chica de YouTube (4,7 KB contra 85 KB de la guardada)', () => {
  const yt = { canal: 'youtube', ref: 'W2AGsoz0sk0', miniatura: 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/spy/youtube/W2AGsoz0sk0.jpg' };
  assert.equal(miniaturaChica(yt), 'https://i.ytimg.com/vi/W2AGsoz0sk0/mqdefault.jpg');
  const ig = { canal: 'instagram', ref: 'abc', miniatura: 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/spy/instagram/abc.jpg' };
  assert.equal(miniaturaChica(ig), ig.miniatura, 'Instagram no tiene una chica pública: la guardada');
  for (const f of ['app/competitor-spy/GraficoSpy.tsx', 'app/competitor-spy/MejoresPiezas.tsx', 'app/competitor-spy/OrdenSpy.tsx']) {
    const s = sinComentarios(leer(f));
    assert.match(s, /miniaturaChica\(/, `${f} usa la chica`);
    assert.doesNotMatch(s, /miniaturaDePieza\(/, `${f} no pide la grande`);
  }
});

test('11. el nombre de una tarjeta va en dos renglones, como fitlo («clamp 2»)', () => {
  const app = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(app, /\.spy-pcard__texto b\{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;/);
  assert.doesNotMatch(app, /\.spy-pcard__texto b\{[^}]*white-space:nowrap/, 'en un renglón, «52 Minutes of…»');
});

test('12. el detalle no muestra una cifra sin número («Falta un trámite con YouTube» cortado en 96 px)', () => {
  const d = sinComentarios(leer('app/competitor-spy/DetallePieza.tsx'));
  assert.match(d, /x && x\.veces != null \? \{\s*k: 'Frente a su cuenta',/);
});

test('13. «This page couldn’t load» de una página ajena es una página de error, y la vista previa no la muestra', () => {
  assert.equal(esPaginaDeError('This page couldn’t load Reload to try again, or go back.'), true);
  assert.equal(esPaginaDeError("This page couldn't load Reload to try again, or go back."), true);
  assert.equal(marcoVerificado({ tipo: 'pinto', texto: 60, muestra: 'This page couldn’t load Reload to try again, or go back.', titulo: 'Acquisition.com' }), 'no');
  assert.equal(esPaginaDeError('Scale your business. We help founders… Reload your pipeline'), false, 'una página que habla de recargar sigue siendo una página');
});

test('14. «menos del 1%» y no «0% de 637» cuando hay alguna', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /const porcentajeDe = \(f: \{ n: number; pct: number \}\): string => \(f\.n > 0 && f\.pct < 1 \? 'menos del 1%'/);
  assert.doesNotMatch(app, /\{f\.pct\}% de \{total\}/);
});

test('15. «Sumar» copia si es carrusel, imagen o video, y sus láminas', () => {
  const [p] = piezasACopiar([{
    canal: 'instagram', tipo: 'publicacion', ref: 'x', fuente: 'api', url: null, titulo: null, texto: null, etiquetas: null, vistas: null,
    megusta: 3, comentarios: null, duracion: null, publicada_en: null, miniatura: null, dejo_de_verse_en: null, medio: 'carrusel', laminas: 7,
  }]);
  assert.equal(p.medio, 'carrusel');
  assert.equal(p.laminas, 7);
  assert.match(leer('lib/spy-sugeridos-server.ts'), /const COLS_PIEZA = '[^']*, medio, laminas'/, 'y se piden a la base');
});

test('16. el teléfono: la pastilla del cliente no tapa el título (cada lado con tope en su columna)', () => {
  assert.match(leer('app/m/m.css'), /\n\.m-cabecera__lado \{ max-width: 100%; \}/);
});
