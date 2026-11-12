// =============================================================================
// La portada del Video con criterio: el reel se ve AHÍ MISMO y llegan sólo los que enseñan edición (11/11/2026)
// =============================================================================
// Martín, con la captura de hola-mako.com/video-editor: «el único video que sí tenemos bien construido ni siquiera se ve la
// miniatura. Y los videos ni siquiera se pueden reproducir ahí mismo… siempre te redirige. No debería tener una cantidad de reels
// random al azar… lo que queremos es poder replicar ciertos patrones de edición… Revisá uno por uno todos los reels».
// Lo que se fija:
//   1. el reproductor oficial de cada red (`embedDeReel`), nunca una copia nuestra, y sin reproductor se abre el original;
//   2. el criterio (`conCriterio`): sólo los «patron» con una familia de la lista; los demás se cuentan, y lo que nadie miró
//      no se inventa;
//   3. el archivo de la clasificación se valida fila por fila (`leerCriterio`) y cubre los 854 reels medidos;
//   4. la vidriera: los curados por su múltiplo, sin ventana de 90 días ni variedad; lo propio, como antes;
//   5. la plantilla con su portada real servida por nosotros, y el filtro `?patron=` validado;
//   6. el cableado: la tarjeta abre ./VerReel.tsx, la fuente de Spy aplica el criterio y la portada dice cuántos quedaron.
//
// Correr: node --import tsx --test tests/video-outliers-criterio.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  FAMILIAS_EDICION, OUTLIERS_CON_PLANTILLA, codigoDeReel, conCriterio, embedDeReel, esFamiliaEdicion, idDeYoutube, juntarOutliers,
  type CriterioReel, type FuenteOutliersVideo, type OutlierVideo,
} from '../lib/video-outliers';
import { leerCriterio } from '../lib/video-outliers-criterio';
import { familiaDe } from '../app/video-editor/vista';

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const conVeces = (veces: number) => ({ veces, formato: 'corto', metrica: 'vistas', canal: 'instagram', valor: veces * 1000, mediana: 1000, comparadas: 20 }) as unknown as OutlierVideo['multiplo'];
const reel = (n: number, extra: Partial<OutlierVideo> = {}): OutlierVideo => ({
  id: `spy:${n}`, fuente: 'spy', red: 'instagram', formato: 'reel',
  creador: { nombre: 'Cuenta', usuario: 'cuenta' }, url: `https://www.instagram.com/reel/COD${n}xyz/`, miniatura: null,
  titulo: `Reel ${n}`, porque: '', duracionS: null, multiplo: conVeces(2), plantilla: null, ...extra,
});
const crit = (c: Partial<CriterioReel>): CriterioReel => ({
  veredicto: 'patron', familia: 'titulo-en-caja', patron: 'título en caja blanca', motivo: 'se ve la caja', formato: 'a-camara-texto',
  senales: ['caja-texto'], base: 'portada', ...c,
});

test('1. el reproductor oficial de cada red, adentro de MaKo; sin reproductor, el original', () => {
  assert.equal(codigoDeReel('https://www.instagram.com/reel/DdTdIIPDzHU/'), 'DdTdIIPDzHU');
  assert.equal(codigoDeReel('https://www.instagram.com/p/De-oMGDkdrC/?img_index=1'), 'De-oMGDkdrC');
  assert.equal(codigoDeReel('https://instagram.com/leilahormozi/reel/DcJo1A0Faki'), 'DcJo1A0Faki');
  assert.equal(codigoDeReel('https://www.instagram.com/leilahormozi/'), null, 'un perfil no es un reel');
  assert.equal(codigoDeReel('https://evil.com/reel/DdTdIIPDzHU/'), null);
  assert.equal(embedDeReel({ red: 'instagram', url: 'https://www.instagram.com/p/De-oMGDkdrC/' }), 'https://www.instagram.com/reel/De-oMGDkdrC/embed/');
  assert.equal(idDeYoutube('https://www.youtube.com/shorts/abcDEF12345'), 'abcDEF12345');
  assert.equal(idDeYoutube('https://youtu.be/abcDEF12345'), 'abcDEF12345');
  assert.match(embedDeReel({ red: 'youtube', url: 'https://www.youtube.com/watch?v=abcDEF12345' }) ?? '', /^https:\/\/www\.youtube-nocookie\.com\/embed\/abcDEF12345\?/);
  assert.equal(embedDeReel({ red: 'tiktok', url: 'https://www.tiktok.com/@x/video/1' }), null, 'sin reproductor: se abre el original');
});

test('2. el criterio: sólo los «patron» con familia de la lista y que superaron a su cuenta; lo demás se cuenta', () => {
  const tabla: Record<string, CriterioReel> = {
    COD1xyz: crit({}),
    COD2xyz: crit({ veredicto: 'descartar', familia: null, patron: null }),
    COD3xyz: crit({ veredicto: 'dudoso', familia: null, patron: null }),
    COD4xyz: crit({ familia: 'una-que-no-existe' }),
    COD5xyz: crit({ familia: 'pantalla-dividida', patron: 'orador y público', receta: 'r1', base: 'video' }),
    COD8xyz: crit({}),
    COD9xyz: crit({}),
    COD10xyz: crit({ familia: 'cita-sobre-podcast' }),
  };
  const xs = [1, 2, 3, 4, 5, 6].map((n) => reel(n));
  // Con patrón, pero le fue PEOR que a su cuenta, o no se pudo medir: no prueba que el patrón funcione.
  xs.push(reel(8, { multiplo: conVeces(0.6) }), reel(9, { multiplo: null }), reel(10, { multiplo: conVeces(1) }));
  xs.push(reel(7, { red: 'youtube', url: 'https://www.youtube.com/shorts/abcDEF12345' }));
  const { outliers, resumen } = conCriterio(xs, (c) => tabla[c] ?? null);
  assert.deepEqual(outliers.map((o) => o.id), ['spy:1', 'spy:5', 'spy:10']);
  assert.deepEqual(resumen, { medidos: 10, conPatron: 3, debajo: 2, descartados: 1, dudosos: 2, sinMirar: 2 });
  assert.deepEqual(outliers[1].edicion, { familia: 'pantalla-dividida', patron: 'orador y público', motivo: 'se ve la caja', senales: ['caja-texto'], base: 'video' });
  assert.equal(outliers[1].receta, 'r1');
  assert.equal(outliers[0].receta, null, 'una familia sin receta');
  assert.equal(outliers[2].receta, 'pregunta-sobre-podcast', 'la receta de su familia');
  for (const f of Object.keys(FAMILIAS_EDICION)) assert.ok(esFamiliaEdicion(f));
  assert.equal(esFamiliaEdicion('toString'), false, 'una propiedad heredada no es una familia');
});

test('3. el archivo de la clasificación: cada fila validada, y cubre los 854 reels medidos', () => {
  const m = leerCriterio({
    A: { v: 'patron', fa: 'titulo-en-caja', p: 'caja', m: 'se ve', fo: 'a-camara-texto', s: ['caja-texto', 3] },
    B: { v: 'cualquiera', m: 'x' },
    C: { v: 'dudoso', m: 'no alcanza', fo: 'a-camara', s: [] },
    D: null,
  });
  assert.deepEqual([...m.keys()], ['A', 'C']);
  assert.deepEqual(m.get('A')?.senales, ['caja-texto'], 'lo que no es texto no entra');
  assert.equal(m.get('C')?.base, 'portada');
  const datos = JSON.parse(leer('lib/video-outliers-criterio.json')) as { medidos: number; reels: Record<string, { v: string; fa: string | null }> };
  const filas = Object.values(datos.reels);
  assert.equal(filas.length, datos.medidos);
  assert.equal(datos.medidos, 854, 'los 854 reels distintos que Spy había leído el 11/11/2026');
  assert.equal(leerCriterio(datos.reels).size, filas.length, 'una fila del archivo que no cumple la forma');
  for (const f of filas) if (f.v === 'patron') assert.ok(esFamiliaEdicion(f.fa), `un patrón sin familia de la lista: ${f.fa}`);
});

test('4. la vidriera: los curados por su múltiplo, sin ventana ni variedad; lo replicable primero', () => {
  const edicion = { familia: 'titulo-en-caja' as const, patron: 'caja', motivo: 'm', senales: [], base: 'portada' as const };
  const curado = (n: number, veces: number, usuario: string, publicada: string) => reel(n, {
    publicada, edicion, multiplo: conVeces(veces), creador: { nombre: usuario, usuario },
  });
  // Uno de hace años con el mejor múltiplo (la ventana de 90 días lo escondía: hay 12 recientes), y una cuenta con los tres
  // siguientes (la variedad, «2 por cuenta cada 12», mandaba el tercero al final).
  const reciente = '2026-11-01T00:00:00Z';
  const xs = [
    curado(1, 50, 'vieja', '2023-01-01T00:00:00Z'),
    curado(2, 40, 'fuerte', reciente), curado(3, 30, 'fuerte', reciente), curado(4, 20, 'fuerte', reciente),
    ...Array.from({ length: 9 }, (_, i) => curado(10 + i, 9 - i * 0.5, `otra${i}`, reciente)),
  ];
  const fuente: FuenteOutliersVideo = { id: 'spy', nombre: 'Spy', leer: async () => ({ ok: true, outliers: xs }) };
  const mako: FuenteOutliersVideo = { id: 'mako', nombre: 'MaKo', leer: async () => ({ ok: true, outliers: OUTLIERS_CON_PLANTILLA }) };
  const p = juntarOutliers([
    { fuente: mako, lectura: { ok: true, outliers: OUTLIERS_CON_PLANTILLA } },
    { fuente, lectura: { ok: true, outliers: xs, resumen: { medidos: 9, conPatron: 5, debajo: 0, descartados: 3, dudosos: 1, sinMirar: 0 } } },
  ], Date.parse('2026-11-11T00:00:00Z'));
  assert.deepEqual(p.outliers.slice(0, 6).map((o) => o.id), ['mako:mensaje-para', 'spy:1', 'spy:2', 'spy:3', 'spy:4', 'spy:10']);
  assert.equal(p.outliers.length, 14);
  assert.deepEqual(p.resumen, { medidos: 9, conPatron: 5, debajo: 0, descartados: 3, dudosos: 1, sinMirar: 0 });
});

test('5. la plantilla con su portada real (servida por nosotros) y el filtro por familia validado', () => {
  const pl = OUTLIERS_CON_PLANTILLA.find((o) => o.plantilla === 'mensaje-para');
  assert.equal(pl?.miniatura, '/ve/plantillas/mensaje-para.jpg', 'la plantilla sin miniatura (lo que vio Martín)');
  assert.ok(existsSync(new URL('../public/ve/plantillas/mensaje-para.jpg', import.meta.url)), 'la portada no está en /public');
  assert.equal(familiaDe({ patron: 'titulo-en-caja' }), 'titulo-en-caja');
  assert.equal(familiaDe({ patron: '<script>' }), null);
  assert.equal(familiaDe({}), null);
});

test('6. el cableado: la tarjeta abre el reproductor, Spy aplica el criterio y la portada dice cuántos quedaron', () => {
  const portada = leer('app/video-editor/OutliersVideo.tsx');
  // Las dos tarjetas abren la caja con el reproductor (no un <a target="_blank"> en la miniatura).
  assert.equal((portada.match(/<VerReel\n\s+embed=\{embedDeReel\(x\)\}/g) ?? []).length, 2);
  assert.doesNotMatch(portada, /<a href=\{x\.url\} target="_blank"[^>]*className=\{`\$\{s\.mini\}/, 'la miniatura vuelve a sacar de MaKo');
  assert.match(portada, /<Miniatura src=\{x\.miniatura\} marca="MaKo te guía" \/>/, 'la plantilla sin su miniatura');
  assert.match(portada, /\{r\.medidos\} reels medidos de las cuentas que sigues · \{r\.conPatron\} enseñan un patrón de edición/);
  const ver = leer('app/video-editor/VerReel.tsx');
  assert.match(ver, /<iframe\s+src=\{embed\}/);
  assert.match(ver, /if \(!embed\) \{\s*return <a href=\{url\} target="_blank"/);
  const servidor = leer('lib/video-outliers-servidor.ts');
  assert.match(servidor, /const \{ outliers, resumen \} = conCriterio\(outliersDeSpy\(piezas, cuentas\), criterioDeReel\);/);
  assert.match(leer('app/video-editor/page.tsx'), /<OutliersVideo portada=\{await leerOutliersVideo\(\)\} familia=\{familiaDe\(q\)\} \/>/);
  assert.match(leer('app/m/video-editor/page.tsx'), /rutaPortada="\/m\/video-editor\?ver=outliers" familia=\{familiaDe\(q\)\}/);
  assert.match(portada, /href=\{`\$\{rutaPortada\}&patron=\$\{f\}`\}/, 'el filtro sin `ver=outliers` abre el editor, no la portada');
});

test('8. el editor primero, y los outliers ADENTRO, junto a «Importar» (11/11/2026)', () => {
  // Martín: «ya no depender de "Encuentra tu siguiente outlier", sino que sea directamente todo el sistema de edición primero, y
  // que en alguna parte, por ejemplo del lado de Importar, estén estos outliers».
  const registro = leer('app/video-editor/_opencut/outliers/registro.ts');
  assert.match(registro, /categoria: "multimedia",\s*id: SECCION_OUTLIERS,\s*etiqueta: "Outliers",\s*orden: 12,/, 'la sección no está al lado de Importar (10)');
  assert.match(leer('app/video-editor/ce/extensiones.ts'), /import '\.\.\/_opencut\/outliers\/registro';/, 'un registro que nadie importa no existe');
  const vista = leer('app/video-editor/_opencut/outliers/components/outliers-view.tsx');
  assert.match(vista, /fetch\("\/api\/video-editor\/outliers"/);
  assert.match(vista, /<TarjetaPlantilla key=\{x\.id\} x=\{x\} telefono=\{false\} \/> : <TarjetaReel key=\{x\.id\} x=\{x\} ahora=\{ahora\} \/>/, 'las mismas tarjetas que la portada');
  const ruta = leer('app/api/video-editor/outliers/route.ts');
  assert.match(ruta, /if \(rol !== 'admin'\) return/);
  assert.match(ruta, /if \(!\(await veEditorVideo\(\)\)\) return/);
  assert.match(ruta, /NextResponse\.json\(await leerOutliersVideo\(\)/);
});

test('7. las recetas: cada una de una familia, con su referencia clasificada, su estructura en orden y las dos grabaciones', async () => {
  const { RECETAS, recetaDe, recetaDeFamilia } = await import('../lib/video-recetas');
  const datos = JSON.parse(leer('lib/video-outliers-criterio.json')) as { reels: Record<string, { v: string; fa: string | null; b?: string }> };
  assert.ok(RECETAS.length >= 3, 'tres recetas de ejemplo');
  assert.equal(new Set(RECETAS.map((r) => r.id)).size, RECETAS.length, 'ids repetidos');
  for (const r of RECETAS) {
    assert.ok(esFamiliaEdicion(r.familia), `${r.id}: familia`);
    const ref = datos.reels[r.referencia.codigo];
    assert.ok(ref && ref.v === 'patron' && ref.fa === r.familia, `${r.id}: su referencia no es un «patron» de su familia`);
    assert.equal(ref.b, 'video', `${r.id}: la referencia se miró en video`);
    let antes = 0;
    for (const b of r.estructura) {
      assert.ok(b.desde >= antes && b.hasta > b.desde && b.hasta <= r.duracionS, `${r.id}: «${b.nombre}» fuera de orden`);
      antes = b.hasta;
    }
    assert.ok(r.edicion.length >= 3 && r.grabacion.avatar.length >= 3 && r.grabacion.persona.length >= 3, `${r.id}: le falta una parte`);
    // El tuteo de MaKo (nunca el voseo): «Graba», no «Grabá».
    for (const t of [...r.edicion, ...r.grabacion.avatar, ...r.grabacion.persona]) assert.doesNotMatch(t, /\b(Grabá|Mirá|Sacá|Cortá|podés|elegí|Cambiate)\b/, t);
    assert.equal(recetaDe(r.id), r);
    assert.equal(recetaDeFamilia(r.familia)?.id, r.id);
  }
  assert.equal(recetaDe('no-existe'), null);
});

// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · `conCriterio` sin la regla de superar a su cuenta                       → rojo el 2
//   · los curados por la ventana de 90 días y la variedad (lo de antes)        → rojo el 4 (con 5 reels de una cuenta seguía
//     verde: hicieron falta 12 recientes y uno viejo con el mejor múltiplo)
//   · la plantilla sin su portada (`miniatura: null`)                         → rojo el 5
//   · ./VerReel.tsx con un link en vez del <iframe>                           → rojo el 6
//   · la tarjeta del reel sin reproductor (`embed={null}`)                    → rojo el 6
//   · un «patron» con una familia que no está en la lista, a la portada       → rojo el 2
