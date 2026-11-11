// =============================================================================
// Los outliers de copy: la portada del Copywriter y «Replicar» (11/11/2026, docs/diseno-copywriter.md D18)
// =============================================================================
// Fija:
//   · de Spy sale el copy que hay: el guion si ya se transcribió (manda sobre el pie), si no el pie, la descripción de YouTube
//     o el copy del anuncio; lo orgánico que ya no se ve no entra, un anuncio que terminó sí; sin texto no hay outlier;
//   · el «×» es el de toda la app (multiplosDe sobre las piezas de su cuenta); un anuncio va por sus días al aire;
//   · la portada: sin repetidos ni inválidos, del que más superó a su cuenta al que menos, el texto cortado, las caídas dichas;
//   · los filtros (formato, búsqueda sin tildes y por @) y el tipo de página de cada formato;
//   · lo que le llega a MaKo: el original con la regla de copiar la estructura y nunca las frases, en CADA pedido de la página
//     (lo suma el server; la pantalla no puede mandarlo);
//   · MaKo pregunta para qué oferta y pide un «Editar» común (no «adaptar» una plantilla);
//   · `/copywriter` es la portada; «Mis guiones» y «Crear desde cero» siguen.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FORMATOS_COPY, TEXTO_EN_TARJETA, esIdOutlierCopy, filtrarOutliersCopy, formatoDePiezaSpy, juntarOutliersCopy, outliersCopyDeBiblioteca,
  outliersCopyDeSpy, textoParaMaKo, tipoDeOutlier, tituloDeReplica,
  type CuentaSpyCopy, type FuenteOutliersCopy, type OutlierCopy, type PiezaSpyCopy,
} from '../lib/copywriter/outliers';
import { sanearProps } from '../lib/copywriter/tipos';
import { sanearReferencias } from '../lib/copywriter/referencias-reglas';
import { AL_NEGOCIO, NO_ADAPTAR, pasosDeReplica, pedidoDeReplica } from '../lib/copywriter/iniciativa';
import { vistaDeCopy } from '../app/copywriter/vista';
import type { Carrusel } from '../lib/carruseles/explorar';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

const AHORA = Date.parse('2026-11-11T12:00:00Z');
const dia = (n: number) => new Date(AHORA - n * 86_400_000).toISOString();
const CUENTA: CuentaSpyCopy = { id: 7, nombre: 'Ana Coach', instagram: 'anacoach', avatar: 'https://spy.test/ana.jpg' };

let sig = 100;
const pieza = (x: Partial<PiezaSpyCopy>): PiezaSpyCopy => ({
  id: sig++, competidor_id: 7, canal: 'instagram', tipo: 'reel', publicada_en: dia(20), vistas: 1000, megusta: 50, comentarios: 5,
  titulo: null, texto: 'Pie del reel.\nSegunda línea.', url: `https://www.instagram.com/reel/${sig}/`, miniatura: null, ...x,
});

test('de Spy: el formato de cada pieza, y sin texto (o una landing) no hay outlier', () => {
  assert.equal(formatoDePiezaSpy({ canal: 'instagram', tipo: 'reel' }), 'reel');
  assert.equal(formatoDePiezaSpy({ canal: 'instagram', tipo: 'publicacion', medio: 'video' }), 'reel');
  assert.equal(formatoDePiezaSpy({ canal: 'instagram', tipo: 'publicacion' }), 'carrusel');
  assert.equal(formatoDePiezaSpy({ canal: 'youtube', tipo: 'video' }), 'youtube');
  assert.equal(formatoDePiezaSpy({ canal: 'anuncios', tipo: 'anuncio' }), 'anuncio');
  assert.equal(formatoDePiezaSpy({ canal: 'landing', tipo: 'landing' }), null);
  const xs = outliersCopyDeSpy([
    pieza({ texto: null, titulo: null }),
    pieza({ canal: 'landing', tipo: 'landing', texto: 'Una web' }),
    pieza({ url: null }),
  ], [CUENTA], new Map(), AHORA);
  assert.deepEqual(xs, []);
});

test('de Spy: el guion transcripto manda sobre el pie; YouTube y los anuncios dicen qué texto es', () => {
  const r = pieza({ texto: 'El pie' });
  const yt = pieza({ canal: 'youtube', tipo: 'video', titulo: 'Cómo cerrar 10 clientes', texto: 'La descripción', url: 'https://www.youtube.com/watch?v=abc' });
  const ad = pieza({ canal: 'anuncios', tipo: 'anuncio', titulo: 'Agenda tu llamada', texto: 'El copy del anuncio', publicada_en: dia(40), dejo_de_verse_en: dia(10), url: 'https://www.facebook.com/ads/library/?id=9' });
  const xs = outliersCopyDeSpy([r, yt, ad], [CUENTA], new Map([[r.id, 'EL GUION DICHO EN CÁMARA']]), AHORA);
  const de = (id: number) => xs.find((o) => o.id === `spy:${id}`)!;
  assert.equal(de(r.id).texto, 'EL GUION DICHO EN CÁMARA');
  assert.equal(de(r.id).deDonde, 'guion');
  assert.equal(de(yt.id).deDonde, 'descripcion');
  assert.equal(de(yt.id).gancho, 'Cómo cerrar 10 clientes', 'YouTube abre con su título');
  assert.equal(de(ad.id).deDonde, 'copy');
  assert.equal(de(ad.id).diasAlAire, 30, 'un anuncio que terminó cuenta sus días al aire hasta que dejó de verse');
  assert.equal(de(ad.id).multiplo, null, 'un anuncio va por sus días, no por el «×»');
  assert.equal(de(r.id).creador.competidorId, 7);
});

test('de Spy: lo orgánico que ya no se ve no entra; un anuncio terminado sí', () => {
  const xs = outliersCopyDeSpy([
    pieza({ dejo_de_verse_en: dia(2) }),
    pieza({ canal: 'anuncios', tipo: 'anuncio', titulo: 'Ad', texto: 'Copy', dejo_de_verse_en: dia(2), url: 'https://www.facebook.com/ads/library/?id=1' }),
  ], [CUENTA], new Map(), AHORA);
  assert.deepEqual(xs.map((o) => o.formato), ['anuncio']);
});

test('el «×» es el de toda la app: el de su cuenta, con 8 reels y uno que se despega', () => {
  const reels = Array.from({ length: 8 }, (_, i) => pieza({ publicada_en: dia(10 + i * 3), vistas: i === 3 ? 9000 : 1000 }));
  const xs = outliersCopyDeSpy(reels, [CUENTA], new Map(), AHORA);
  const alto = xs.find((o) => o.id === `spy:${reels[3].id}`)!;
  assert.ok(alto.multiplo && alto.multiplo.veces != null && alto.multiplo.veces >= 5, JSON.stringify(alto.multiplo));
});

test('la biblioteca de carruseles: sólo con texto, link y su id negativo', () => {
  const c = (x: Partial<Carrusel>): Carrusel => ({
    id: -5, competidorId: -2, origen: 'biblioteca', creador: { nombre: 'DenBorg', usuario: 'denborg', foto: null }, url: 'https://www.instagram.com/p/x/',
    miniatura: '/bucket/x.jpg', texto: 'Guarda esto:\n1. …', gancho: null, tipoGancho: null, cierre: null, formato: '', medio: 'carrusel', laminas: 7,
    megusta: 900, comentarios: 40, publicada: dia(5), traida: dia(5), outlier: 3.2, ...x,
  } as Carrusel);
  const xs = outliersCopyDeBiblioteca([c({}), c({ id: -6, texto: null }), c({ id: 9 }), c({ id: -7, url: null })]);
  assert.deepEqual(xs.map((o) => o.id), ['biblioteca:-5']);
  assert.equal(xs[0].gancho, 'Guarda esto:', 'sin el gancho de Spy, la primera línea');
  assert.equal(xs[0].laminas, 7);
});

const outlier = (x: Partial<OutlierCopy>): OutlierCopy => ({
  id: 'spy:1', fuente: 'spy', formato: 'reel', creador: { nombre: 'Ana', usuario: 'anacoach', foto: null, competidorId: 7 }, url: 'https://www.instagram.com/reel/1/',
  miniatura: null, gancho: 'Si cada lunes…', texto: 'Texto', deDonde: 'pie', multiplo: null, vistas: 10, megusta: 1, comentarios: 1, publicada: dia(3), ...x,
});
const fuente = (id: string): FuenteOutliersCopy => ({ id, nombre: id, leer: async () => ({ ok: true, outliers: [] }) });

test('la portada: sin repetidos ni inválidos, del que más superó a su cuenta al que menos, y lo que no se leyó se dice', () => {
  const p = juntarOutliersCopy([
    { fuente: fuente('spy'), lectura: { ok: true, outliers: [
      outlier({ id: 'spy:1', multiplo: { veces: 1.2, metrica: 'vistas', valor: 1, mediana: 1, formato: 'corto', canal: 'instagram', comparadas: 8 } }),
      outlier({ id: 'spy:2', url: 'https://www.instagram.com/reel/2/', multiplo: { veces: 4.5, metrica: 'vistas', valor: 1, mediana: 1, formato: 'corto', canal: 'instagram', comparadas: 8 }, texto: 'x'.repeat(TEXTO_EN_TARJETA + 50) }),
      outlier({ id: 'spy:3', url: 'https://www.instagram.com/reel/1/?igsh=abc' }),
      outlier({ id: 'spy:4', url: 'http://inseguro', }),
      outlier({ id: 'spy:5', url: 'https://www.instagram.com/reel/5/', texto: '   ' }),
    ] } },
    { fuente: { ...fuente('biblioteca'), nombre: 'la biblioteca' }, lectura: { ok: false, motivo: 'timeout' } },
  ]);
  assert.deepEqual(p.outliers.map((o) => o.id), ['spy:2', 'spy:1'], 'el repetido por link, el http y el vacío afuera; el de 4,5× primero');
  assert.ok(p.outliers[0].texto.length <= TEXTO_EN_TARJETA);
  assert.deepEqual(p.caidas, [{ fuente: 'biblioteca', nombre: 'la biblioteca', motivo: 'timeout' }]);
});

test('los filtros: el formato, lo buscado sin tildes y por @, y el orden por fecha', () => {
  const xs = [
    outlier({ id: 'spy:1', formato: 'reel', gancho: 'Cómo vender', publicada: dia(9) }),
    outlier({ id: 'spy:2', formato: 'anuncio', gancho: 'Agenda', creador: { nombre: 'Leo', usuario: 'leoventas', foto: null, competidorId: 8 }, publicada: dia(1) }),
  ];
  assert.deepEqual(filtrarOutliersCopy(xs, { formato: 'anuncio', q: '' }).map((o) => o.id), ['spy:2']);
  assert.deepEqual(filtrarOutliersCopy(xs, { formato: null, q: 'CÓMO vender' }).map((o) => o.id), ['spy:1']);
  assert.deepEqual(filtrarOutliersCopy(xs, { formato: null, q: '@leoventas' }).map((o) => o.id), ['spy:2']);
  assert.deepEqual(filtrarOutliersCopy(xs, { formato: null, q: '' }, 'recientes').map((o) => o.id), ['spy:2', 'spy:1']);
});

test('cada formato se replica en su tipo de página, y la página guarda el outlier (sólo con su forma)', () => {
  assert.deepEqual(FORMATOS_COPY.map((f) => tipoDeOutlier({ formato: f })), ['ad', 'reel', 'post', 'youtube']);
  assert.ok(esIdOutlierCopy('spy:123') && esIdOutlierCopy('biblioteca:-45'));
  assert.ok(!esIdOutlierCopy('spy:abc') && !esIdOutlierCopy('mako:1') && !esIdOutlierCopy(7));
  assert.equal(sanearProps({ tipo: 'reel', outlier: 'spy:9' }).outlier, 'spy:9');
  assert.equal('outlier' in sanearProps({ tipo: 'reel', outlier: '<script>' }), false);
  assert.equal('outlier' in sanearProps({ tipo: 'reel' }), false, 'una página sin outlier no guarda la clave');
  assert.match(tituloDeReplica(outlier({})), /^Como @anacoach: Si cada lunes…/);
});

test('lo que le llega a MaKo: el original con la regla de copiar la estructura y nunca las frases', () => {
  const t = textoParaMaKo(outlier({ texto: 'EL TEXTO ORIGINAL', deDonde: 'guion' }), '3,7×');
  assert.match(t, /reel de @anacoach en Instagram; le fue 3,7× lo que suele rendir su cuenta/);
  assert.match(t, /SU GUION:\nEL TEXTO ORIGINAL/);
  assert.match(t, /Nunca copies sus frases, sus datos, sus nombres ni sus resultados/);
  // La pantalla no puede mandar un original: sólo lo suma el server.
  assert.deepEqual(sanearReferencias([{ tipo: 'outlier', id: 'spy:1', nombre: 'x' }]), []);
  const ia = leer('lib/copywriter/ia.ts');
  assert.equal((ia.match(/leerReferencias\(conElOriginal\(p\.referencias, g\.props\)\)/g) ?? []).length, 2, 'Discutir y Editar');
  assert.match(ia, /return props\.outlier \? \[\{ tipo: 'outlier', id: props\.outlier, nombre: 'El original que replicas' \}, \.\.\.refs\] : refs;/);
  assert.match(leer('lib/copywriter/referencias.ts'), /if \(r\.tipo === 'outlier'\) \{\n\s+\/\/[^\n]*\n\s+const t = await originalParaMaKo\(r\.id\);/);
});

test('MaKo pregunta para qué oferta y pide un «Editar» común (no adaptar una plantilla)', () => {
  const ofertas = [{ id: 3, nombre: 'Mentoría 90 días' }];
  const [p] = pasosDeReplica(ofertas);
  assert.equal(p.pregunta, '¿Lo replico para tu oferta? ¿Para cuál?');
  assert.deepEqual(p.opciones.map((o) => o.valor), ['oferta:3', NO_ADAPTAR]);
  assert.equal(pasosDeReplica([])[0].opciones[0].valor, AL_NEGOCIO);
  assert.match(pedidoDeReplica({ oferta: 'oferta:3' }, ofertas).texto, /su misma estructura, su tipo de gancho y su ritmo, con mi oferta «Mentoría 90 días»/);
  assert.equal(pedidoDeReplica({ oferta: NO_ADAPTAR }, ofertas).adaptar, false);
  const panel = leer('app/copywriter/PanelMaKo.tsx');
  assert.match(panel, /replica \? pasosDeReplica\(ofertas\)/);
  assert.match(panel, /void pedirEdicion\(pedido\.texto, \[\], \[\], !replica\)/, 'una réplica es «Editar», no «adaptar»');
});

test('/copywriter es la portada de outliers; «Mis guiones» y «Crear desde cero» siguen', () => {
  assert.equal(vistaDeCopy({}), 'outliers');
  assert.equal(vistaDeCopy({ ver: 'guiones' }), 'guiones');
  assert.equal(vistaDeCopy({ nueva: '' }), 'crear');
  assert.equal(vistaDeCopy({ nuevo: 'reel' }), 'crear', 'las rutas viejas (/reels, /stories, /youtube-writer) siguen yendo a crear');
  const page = leer('app/copywriter/page.tsx');
  assert.match(page, /if \(vista === 'outliers'\) \{/);
  assert.match(page, /<OutliersCopy portada=\{await leerOutliersCopy\(\)\} \/>/);
  const ruta = leer('app/api/copywriter/route.ts');
  assert.match(ruta, /case 'replicar':\n\s+return responder\(await replicarOutlier\(texto\(b\.outlier\)\)\);/);
  const m = leer('app/m/copywriter/page.tsx');
  assert.match(m, /<OutliersCopy portada=\{await leerOutliersCopy\(\)\} telefono rutaGuion="\/m\/copywriter\/\{id\}\?mako=1"/);
});
