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
  FORMATOS_COPY, TEXTO_EN_TARJETA, TOPE_POR_FORMATO, claveDeLink, esCopy, esIdOutlierCopy, filtrarOutliersCopy, formatoDePiezaSpy, frasesDelOriginal, juntarOutliersCopy, outliersCopyDeBiblioteca, restoDelTexto,
  outliersCopyDeSpy, palabrasDe, reglasDeLaReplica, textoParaMaKo, tipoDeOutlier, tituloDeReplica, avisoDeLargo, capitulosDe, siguenLosCapitulos,
  largoPedido, largoFuera, pedidoDeCorreccion, conElLargoReal,
  type CuentaSpyCopy, type FuenteOutliersCopy, type OutlierCopy, type PiezaSpyCopy,
} from '../lib/copywriter/outliers';
import { sanearProps } from '../lib/copywriter/tipos';
import { sanearReferencias } from '../lib/copywriter/referencias-reglas';
import { AL_NEGOCIO, NO_ADAPTAR, ofertaDeReplica, otrasOfertasDeReplica, pedidoDeReplica } from '../lib/copywriter/iniciativa';
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

const COPY = 'Si cada lunes arrancas la semana sin saber de dónde va a salir tu próximo cliente, esto es para ti: te cuento cómo lo resolví.';
const outlier = (x: Partial<OutlierCopy>): OutlierCopy => ({
  id: 'spy:1', fuente: 'spy', formato: 'reel', creador: { nombre: 'Ana', usuario: 'anacoach', foto: null, competidorId: 7 }, url: 'https://www.instagram.com/reel/1/',
  miniatura: null, gancho: 'Si cada lunes…', texto: COPY, deDonde: 'pie', multiplo: null, vistas: 10, megusta: 1, comentarios: 1, publicada: dia(3), ...x,
});
const fuente = (id: string): FuenteOutliersCopy => ({ id, nombre: id, leer: async () => ({ ok: true, outliers: [] }) });

test('la portada: sin repetidos ni inválidos, del que más superó a su cuenta al que menos, y lo que no se leyó se dice', () => {
  const p = juntarOutliersCopy([
    { fuente: fuente('spy'), lectura: { ok: true, outliers: [
      outlier({ id: 'spy:1', multiplo: { veces: 1.2, metrica: 'vistas', valor: 1, mediana: 1, formato: 'corto', canal: 'instagram', comparadas: 8 } }),
      outlier({ id: 'spy:2', url: 'https://www.instagram.com/reel/2/', multiplo: { veces: 4.5, metrica: 'vistas', valor: 1, mediana: 1, formato: 'corto', canal: 'instagram', comparadas: 8 }, texto: 'palabra '.repeat(TEXTO_EN_TARJETA / 4) }),
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

test('no se repite por link, pero dos videos de YouTube (o dos anuncios) son distintos', () => {
  // Medido en el ws 3: cortar todo el «?…» dejaba UN video de YouTube de 369 (todos son youtube.com/watch?v=…).
  assert.notEqual(claveDeLink('https://www.youtube.com/watch?v=abc'), claveDeLink('https://www.youtube.com/watch?v=xyz'));
  assert.notEqual(claveDeLink('https://www.facebook.com/ads/library/?id=1'), claveDeLink('https://www.facebook.com/ads/library/?id=2'));
  assert.equal(claveDeLink('https://www.instagram.com/reel/1/?igsh=abc'), claveDeLink('https://instagram.com/reel/1'));
  assert.equal(claveDeLink('https://www.youtube.com/watch?v=abc&t=30s'), claveDeLink('https://youtube.com/watch?v=abc'));
  const p = juntarOutliersCopy([{ fuente: fuente('spy'), lectura: { ok: true, outliers: [
    outlier({ id: 'spy:1', formato: 'youtube', deDonde: 'descripcion', gancho: 'Cómo cerrar más', texto: 'Cómo cerrar más', url: 'https://www.youtube.com/watch?v=abc' }),
    outlier({ id: 'spy:2', formato: 'youtube', deDonde: 'descripcion', gancho: 'El precio no es', texto: 'El precio no es', url: 'https://www.youtube.com/watch?v=xyz' }),
  ] } }]);
  assert.equal(p.outliers.length, 2);
});

test('un pie de pocas palabras no es copy; el guion y el título de un video o de un anuncio, sí', () => {
  // Medido en el ws 3: «🤣🤣🤣», «We have fun 😂🫶», «Smoothie King we love you».
  for (const t of ['🤣🤣🤣', 'We have fun 😂🫶', 'Smoothie King we love you']) assert.equal(esCopy({ formato: 'reel', deDonde: 'pie', texto: t, gancho: t }), false, t);
  assert.equal(esCopy({ formato: 'reel', deDonde: 'pie', texto: COPY, gancho: 'x' }), true);
  assert.equal(esCopy({ formato: 'reel', deDonde: 'guion', texto: 'Hola', gancho: 'Hola' }), true);
  assert.equal(esCopy({ formato: 'youtube', deDonde: 'descripcion', texto: 'The Phil Jackson Paradox', gancho: 'The Phil Jackson Paradox' }), true);
  const p = juntarOutliersCopy([{ fuente: fuente('spy'), lectura: { ok: true, outliers: [outlier({ id: 'spy:9', texto: '🤣🤣🤣' })] } }]);
  assert.deepEqual(p.outliers, []);
  // Simulado con los datos del ws 9 (11/11): anuncios de catálogo cuyo «copy» es la variable «{{product.name}}» quedaban entre los
  // diez primeros (llevan meses al aire). Una variable de plantilla no es una palabra; el copy que la rodea, sí.
  assert.equal(esCopy({ formato: 'anuncio', deDonde: 'copy', texto: '{{product.name}}', gancho: '{{product.name}}' }), false);
  assert.equal(esCopy({ formato: 'anuncio', deDonde: 'copy', texto: '{{product.name}} {{product.price}}', gancho: '{{product.name}}' }), false);
  assert.equal(esCopy({ formato: 'anuncio', deDonde: 'copy', texto: 'Hola {{first_name}}, llévate el tuyo hoy', gancho: 'Hola' }), true);
});

test('el mismo copy del mismo creador sale una vez (el más fuerte); el de otro creador, también (11/11, ws 9)', () => {
  const anuncio = (id: string, dias: number, url: string, competidorId: number) => outlier({
    id, formato: 'anuncio', deDonde: 'copy', gancho: 'Learn How to Scale Your Business', texto: 'Learn how to scale your business without burning out.',
    url, multiplo: null, diasAlAire: dias, creador: { nombre: `C${competidorId}`, usuario: null, foto: null, competidorId },
  });
  const p = juntarOutliersCopy([{ fuente: fuente('spy'), lectura: { ok: true, outliers: [
    anuncio('spy:1', 30, 'https://www.facebook.com/ads/library/?id=1', 7),
    anuncio('spy:2', 90, 'https://www.facebook.com/ads/library/?id=2', 7),
    anuncio('spy:3', 60, 'https://www.facebook.com/ads/library/?id=3', 8),
  ] } }]);
  assert.deepEqual(p.outliers.map((o) => o.id), ['spy:2', 'spy:3']);
});

test('«Todos» intercala los formatos: la primera vuelta trae el mejor de cada uno (11/11, ws 3: 24 carruseles seguidos)', () => {
  const m = (veces: number) => ({ veces, metrica: 'vistas', valor: 1, mediana: 1, formato: 'corto', canal: 'instagram', comparadas: 8 }) as OutlierCopy['multiplo'];
  const carrusel = (n: number, veces: number) => outlier({ id: `biblioteca:-${n}`, fuente: 'biblioteca', formato: 'carrusel', url: `https://www.instagram.com/p/c${n}/`, multiplo: m(veces), creador: { nombre: `C${n}`, usuario: `c${n}`, foto: null, competidorId: null } });
  const reel = (n: number, veces: number) => outlier({ id: `spy:${n}`, url: `https://www.instagram.com/reel/r${n}/`, multiplo: m(veces), creador: { nombre: `R${n}`, usuario: `r${n}`, foto: null, competidorId: n } });
  const video = outlier({ id: 'spy:50', formato: 'youtube', deDonde: 'descripcion', gancho: 'Cómo cerrar más ventas', texto: 'Cómo cerrar más ventas', url: 'https://www.youtube.com/watch?v=abc', creador: { nombre: 'Y', usuario: 'y', foto: null, competidorId: 50 } });
  const p = juntarOutliersCopy([
    { fuente: fuente('biblioteca'), lectura: { ok: true, outliers: [carrusel(1, 1200), carrusel(2, 500), carrusel(3, 300)] } },
    { fuente: fuente('spy'), lectura: { ok: true, outliers: [reel(10, 8), reel(11, 6), video] } },
  ]);
  assert.deepEqual(p.outliers.map((o) => o.id), ['biblioteca:-1', 'spy:10', 'spy:50', 'biblioteca:-2', 'spy:11', 'biblioteca:-3']);
  // Filtrar por un formato da su orden de siempre.
  assert.deepEqual(filtrarOutliersCopy(p.outliers, { formato: 'carrusel', q: '' }).map((o) => o.id), ['biblioteca:-1', 'biblioteca:-2', 'biblioteca:-3']);

  // ⚠️ Desplegado y medido en producción: con la variedad de creadores aplicada DESPUÉS de intercalar, a la primera vuelta le
  // seguían nueve carruseles. Los reels eran casi todos de UNA cuenta y «2 del mismo creador cada 12» los empujaba abajo.
  const deLeila = (n: number) => outlier({ id: `spy:${n}`, url: `https://www.instagram.com/reel/l${n}/`, multiplo: m(10 - n / 100), gancho: `Gancho ${n}`, texto: `${COPY} (${n})`, creador: { nombre: 'Leila', usuario: 'leila', foto: null, competidorId: 7 } });
  const q = juntarOutliersCopy([
    { fuente: fuente('biblioteca'), lectura: { ok: true, outliers: Array.from({ length: 20 }, (_, i) => carrusel(i + 1, 900 - i)) } },
    { fuente: fuente('spy'), lectura: { ok: true, outliers: [deLeila(101), deLeila(102), deLeila(103), deLeila(104)] } },
  ]);
  assert.deepEqual(q.outliers.slice(0, 8).map((o) => o.formato), ['carrusel', 'reel', 'carrusel', 'reel', 'carrusel', 'reel', 'carrusel', 'reel']);
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
  assert.match(ia, /return props\.outlier \? \[\{ tipo: 'outlier', id: props\.outlier, nombre: NOMBRE_DEL_ORIGINAL \}, \.\.\.refs\] : refs;/);
  assert.match(leer('lib/copywriter/referencias.ts'), /if \(r\.tipo === 'outlier'\) \{\n\s+\/\/[^\n]*\n\s+const t = await originalParaMaKo\(r\.id\);/);
});

test('Replicar: MaKo escribe el guion ENTERO solo, con la oferta principal, y deja cambiarla (11/11, Martín: «sólo replica el título»)', () => {
  const ofertas = [{ id: 3, nombre: 'Mentoría 90 días' }, { id: 5, nombre: 'Taller' }];
  // Sin preguntar: la principal (la primera), o el negocio.
  assert.equal(ofertaDeReplica(ofertas), 'oferta:3');
  assert.equal(ofertaDeReplica([]), AL_NEGOCIO);
  const pedido = pedidoDeReplica({ oferta: 'oferta:3' }, ofertas).texto;
  // Lo que se ve en la charla al reabrir es lo que la persona pidió con un toque (12/11/2026, en producción: el pedido técnico
  // entero aparecía como un mensaje de Martín). Lo técnico va en el ORIGINAL que suma el server (`reglasDeLaReplica`).
  assert.equal(pedido, 'Replícalo entero con mi oferta «Mentoría 90 días»: su estructura, su tipo de gancho y su ritmo.');
  const reglas = textoParaMaKo(outlier({ deDonde: 'guion' }), null, new Date('2026-11-12T12:00:00Z'));
  assert.match(reglas, /el guion ENTERO, todas sus partes en su orden/);
  assert.match(reglas, /en propiedades, el ángulo y la estructura de la biblioteca/, 'Ángulo y Estructura no quedan «Vacío»');
  assert.equal(pedidoDeReplica({ oferta: NO_ADAPTAR }, ofertas).adaptar, false);
  assert.deepEqual(otrasOfertasDeReplica('oferta:3', ofertas).map((o) => o.texto), ['Taller']);
  const panel = leer('app/copywriter/PanelMaKo.tsx');
  // Se escribe sola al abrir la réplica vacía (charla leída y vacía, editor listo, página sin texto), con la oferta principal.
  assert.match(panel, /if \(!replica \|\| !id \|\| !editor \|\| !hiloLeido \|\| corriendo \|\| replicaHecha \|\| appEscritorio\.bloqueada\) return;/);
  assert.match(panel, /if \(mensajes\.length \|\| textoDelDoc\(editor\.leer\(\) as JsonNodo\)\.trim\(\)\) return;\n\s+escribirReplica\(ofertaDeReplica\(ofertas\), true\);/);
  // Sobre la página vacía queda escrita SIN «Aceptar»; al rehacerla para otra oferta, es una propuesta.
  assert.match(panel, /if \(aceptarAlTerminar\.current && ultimo\.estado === 'pendiente'\) aceptar\(ultimo\);/);
  assert.match(panel, /onClick=\{\(\) => escribirReplica\(o\.valor, false\)\}/);
  assert.match(panel, /void pedirEdicion\(pedidoDeReplica\(\{ oferta \}, ofertas\)\.texto, \[\], \[\], false, false\);/, 'una réplica es «Editar», no «adaptar»');
});

test('la réplica respeta el LARGO, escribe el carrusel por láminas, no inventa pruebas y lleva título propio (12/11, en producción)', () => {
  // El anuncio de ~40 palabras salió de ~200: el largo del original, ±25 %, y ninguna sección que no tenga.
  const anuncio = reglasDeLaReplica({ formato: 'anuncio', deDonde: 'copy', texto: Array.from({ length: 40 }, (_, i) => `p${i}`).join(' '), laminas: null });
  assert.match(anuncio[0], /el original tiene unas 40 palabras; el tuyo, entre 30 y 50 palabras, con la misma cantidad de partes\. Ni una sección que el original no tenga\./);
  assert.equal(palabrasDe('Learn How to Scale Your Business. We’re hosting a workshop.'), 10);
  // El carrusel de 7 láminas salió en prosa: lámina por lámina, en tabla, y el pie aparte.
  const carrusel = reglasDeLaReplica({ formato: 'carrusel', deDonde: 'pie', texto: 'Un pie corto de ejemplo para medir.', laminas: 7 });
  assert.match(carrusel[0], /un carrusel de 7 láminas\. Escríbelo lámina por lámina, en una tabla \(Lámina \| Texto en la imagen \| Visual\) con 7 filas/);
  assert.match(carrusel[0], /una sección «Pie»/);
  // El pie de un reel y la descripción de YouTube no son lo que se dice: su largo no es el de la pieza.
  assert.match(reglasDeLaReplica({ formato: 'reel', deDonde: 'pie', texto: 'x', laminas: null })[0], /es el PIE de la publicación, no lo que se dice en el reel/);
  assert.match(reglasDeLaReplica({ formato: 'youtube', deDonde: 'descripcion', texto: 'x', laminas: null })[0], /Si trae capítulos \(0:00 …\), ésos son sus partes y su orden/);
  // YouTube inventó cifras, casos y una garantía; el reel quedó con el título del competidor y el video, con «2025».
  const todas = reglasDeLaReplica({ formato: 'youtube', deDonde: 'descripcion', texto: 'x', laminas: null }, new Date('2026-11-12T12:00:00Z')).join('\n');
  assert.match(todas, /salen SÓLO de EL NEGOCIO\. Si el original muestra una prueba y el negocio no tiene una, escribe \[DATO: la prueba que falta\]\. Nunca inventes un número ni una garantía\./);
  assert.match(todas, /un título PROPIO con \{"op": "titulo"\}/);
  assert.match(todas, /Si el original nombra un año, el tuyo es 2026\./);
  // Y viaja en el original (lo suma el server en cada pedido), después de la regla de las frases.
  assert.match(textoParaMaKo(outlier({ deDonde: 'guion' }), null), /CÓMO SE REPLICA: [^\n]+\nEL LARGO: /);
});

test('/copywriter es la portada de outliers; «Mis guiones» y «Crear desde cero» siguen', () => {
  assert.equal(vistaDeCopy({}), 'outliers');
  assert.equal(vistaDeCopy({ ver: 'guiones' }), 'guiones');
  assert.equal(vistaDeCopy({ nueva: '' }), 'crear');
  assert.equal(vistaDeCopy({ nuevo: 'reel' }), 'crear', 'las rutas viejas (/reels, /stories, /youtube-writer) siguen yendo a crear');
  const page = leer('app/copywriter/page.tsx');
  assert.match(page, /if \(vista === 'outliers'\) \{/);
  // Dentro de la pantalla de Create, con el chat de MaKo a la izquierda (11/11/2026, Martín: «no está el chat de MaKo» y «no hay
  // cómo volver a los outliers»): la portada va en `nueva`, y «Nueva página» desde un guion o las plantillas vuelve a ella.
  assert.match(page, /portada=\{portada\} \/>/);
  const cw = leer('app/copywriter/Copywriter.tsx');
  assert.match(cw, /nueva=\{portada \? <OutliersCopy portada=\{portada\} plantillas=\{conPropias\} onPlantilla=\{usarPlantilla\} \/> : undefined\}/);
  // Y las plantillas AL LADO de los outliers (11/11/2026, Martín: «también deberían estar los templates»), con la tarjeta común.
  const portadaTsx = leer('app/copywriter/OutliersCopy.tsx');
  assert.match(portadaTsx, /\{plantillas\?\.length && onPlantilla \? \(/);
  assert.match(portadaTsx, /<TarjetaPlantilla key=\{pl\.id\} pl=\{pl\}/);
  assert.match(portadaTsx, /<Link href=\{rutaCrear\} className=\{s\.texto\}>Ver todas<\/Link>/);
  // De a tandas, no las 2.291 de una (medido: 46.030 elementos y de 1 a 7 s por cambio de filtro).
  assert.match(portadaTsx, /const enGrilla = useMemo\(\(\) => vistos\.slice\(0, mostrar\), \[vistos, mostrar\]\);/);
  assert.match(portadaTsx, /useEffect\(\(\) => \{ setMostrar\(TANDA\); \}, \[formato, q, orden\]\);/);
  // Y el original abierto pide el texto ENTERO (la tarjeta trae 280 letras).
  assert.match(leer('app/copywriter/OutlierAbierto.tsx'), /void pedirOriginal\(o\.id\)\.then\(\(r\) => \{ if \(vivo && r\.ok\) setCompleto\(r\.outlier\.texto\); \}\);/);
  assert.match(cw, /alNuevo=\{portada \? undefined : \(\) => router\.push\(base\)\}/);
  const ruta = leer('app/api/copywriter/route.ts');
  assert.match(ruta, /case 'replicar':\n\s+return responder\(await replicarOutlier\(texto\(b\.outlier\)\)\);/);
  const m = leer('app/m/copywriter/page.tsx');
  assert.match(m, /<OutliersCopy portada=\{await leerOutliersCopy\(\)\} telefono rutaGuion="\/m\/copywriter\/\{id\}\?mako=1"/);
});

test('el original abierto: con imagen, la pieza arriba y su texto abajo (11/11, a 1440 era una caja blanca casi vacía)', () => {
  const modal = leer('app/copywriter/OutlierAbierto.tsx');
  assert.match(modal, /\{o\.miniatura \? \(\n\s+<div className=\{t\.conImagen\}>\n\s+\{\/\* eslint-disable-next-line @next\/next\/no-img-element \*\/\}\n\s+<img className=\{t\.imagenOriginal\} src=\{o\.miniatura\}/);
  assert.match(leer('app/copywriter/outliers.module.css'), /\.conImagen > img\.imagenOriginal \{ flex: 0 0 56%;/);
});

test('las frases del original que repite la réplica: 5 palabras seguidas o más, sin mirar tildes ni signos (11/11, en producción)', () => {
  // El caso real: «Cobrar mejor no es suerte, es sistema.» replicado como «Cobrar más caro no es suerte, es sistema.».
  const original = textoParaMaKo(outlier({
    gancho: 'Cobrar mejor no es suerte, es sistema.', deDonde: 'guion',
    texto: 'Que paja la gente que paga poco, vieron? Que te paga un servicio de cien dólares te está pagando dos mil.',
  }), '70,9×');
  const escrito = 'Gancho\nCobrar más caro no es suerte, es sistema.\nHistoria\nQué rabia cuando entra un cliente que paga poco y te exige el triple.';
  assert.deepEqual(frasesDelOriginal(original, escrito), ['no es suerte, es sistema']);
  // Cuatro palabras no alcanzan, y la regla de cómo se replica no cuenta como original.
  assert.deepEqual(frasesDelOriginal(original, 'que te paga un cliente nuevo'), []);
  assert.deepEqual(frasesDelOriginal(original, 'Copia su estructura (las partes y su orden), su tipo de gancho'), []);
  assert.deepEqual(frasesDelOriginal(original, 'QUE TE PAGA UN SERVICIO de diseño'), ['QUE TE PAGA UN SERVICIO de'], 'el tramo entero, como lo escribió');
  // Lo usa «Editar» en una página replicada, y avisa en la propuesta.
  const ia = leer('lib/copywriter/ia.ts');
  // El cuerpo Y el título que propone (en producción: el cuerpo ya era propio y el título copiaba el gancho del original).
  assert.match(ia, /frasesDelOriginal\(original, r\.titulo \?\? ''\), \.\.\.frasesDelOriginal\(original, escrito\)/);
  assert.deepEqual(frasesDelOriginal(original, 'Cobrar más no es suerte, es sistema'), ['no es suerte, es sistema']);
  assert.match(ia, /Repite frases del original/);
});

test('teléfono: «Crear desde cero» y «Mis guiones» llegan a su vista, no a la portada (11/11, en producción siempre la portada)', async () => {
  const { rutaMovil, rutaEscritorio } = await import('../lib/movil-rutas');
  // El paso al teléfono conservaba sólo `nuevo`, y descarta los vacíos: `?nueva` y `?ver=guiones` se perdían.
  assert.equal(rutaMovil('/copywriter?nueva=1&ws=3'), '/m/copywriter?nueva=1');
  assert.equal(rutaMovil('/copywriter?ver=guiones&ws=3'), '/m/copywriter?ver=guiones');
  assert.equal(rutaEscritorio('/m/copywriter?nueva=1'), '/copywriter?nueva=1');
  assert.equal(vistaDeCopy({ nueva: '1' }), 'crear');
  assert.match(leer('app/copywriter/vista.ts'), /export const RUTA_CREAR_COPY = '\/copywriter\?nueva=1';/);
  assert.match(leer('app/m/copywriter/page.tsx'), /rutaCrear="\/m\/copywriter\?nueva=1"/);
});

test('la portada no trae todo: hasta TOPE_POR_FORMATO por formato y TEXTO_EN_TARJETA letras (11/11: 7,5 MB y 2.291 tarjetas)', () => {
  const reel = (n: number) => outlier({ id: `spy:${n}`, url: `https://www.instagram.com/reel/t${n}/`, gancho: `Gancho ${n}`, texto: `${COPY} ${'palabra '.repeat(60)}(${n})`,
    multiplo: { veces: 1000 - n, metrica: 'vistas', valor: 1, mediana: 1, formato: 'corto', canal: 'instagram', comparadas: 8 }, creador: { nombre: `C${n}`, usuario: `c${n}`, foto: null, competidorId: n } });
  const carrusel = (n: number) => outlier({ id: `biblioteca:-${n}`, fuente: 'biblioteca', formato: 'carrusel', url: `https://www.instagram.com/p/t${n}/`, gancho: `Carrusel ${n}`, texto: `${COPY} (${n})`, creador: { nombre: `K${n}`, usuario: `k${n}`, foto: null, competidorId: null } });
  const p = juntarOutliersCopy([{ fuente: fuente('spy'), lectura: { ok: true, outliers: [...Array.from({ length: TOPE_POR_FORMATO + 10 }, (_, i) => reel(i + 1)), ...Array.from({ length: 5 }, (_, i) => carrusel(i + 1))] } }]);
  assert.equal(p.outliers.filter((o) => o.formato === 'reel').length, TOPE_POR_FORMATO);
  assert.equal(p.outliers.filter((o) => o.formato === 'carrusel').length, 5, 'y el intercalado termina aunque una fila quede más corta');
  assert.ok(p.outliers.every((o) => o.texto.length <= TEXTO_EN_TARJETA));
  assert.ok(TEXTO_EN_TARJETA <= 300 && TOPE_POR_FORMATO <= 300);
});

test('la tarjeta es de COPY: el texto primero y YouTube en 16:9, no la foto vertical de un carrusel (11/11, Martín)', () => {
  assert.equal(restoDelTexto({ gancho: 'Cobrar mejor no es suerte.', texto: 'Cobrar mejor no es suerte. Es sistema, y te cuento por qué.' }), 'Es sistema, y te cuento por qué.');
  assert.equal(restoDelTexto({ gancho: 'Change My Mind', texto: 'Change My Mind' }), '', 'un video sin descripción: sólo su título');
  assert.equal(restoDelTexto({ gancho: 'Otro gancho', texto: 'El texto entero.' }), 'El texto entero.');
  const portada = leer('app/copywriter/OutliersCopy.tsx');
  // El marco con la forma de su red (12/11/2026: YouTube 16:9, reel 9:16, carrusel 4:5) y el TEXTO legible encima de la portada
  // (13/11/2026: nunca blanco vacío); al pasar el cursor, el original limpio (tests/create-outliers-tarjeta.test.ts).
  assert.match(portada, /style=\{\{ aspectRatio: ASPECTO_FORMATO\[o\.formato\] \}\}/);
  assert.match(portada, /<button type="button" className=\{oc\.ganchoGrande\} onClick=\{onAbrir\}>\{o\.gancho\}<\/button>/);
  assert.doesNotMatch(portada, /className=\{s\.miniImagen\}/, 'sin la foto vertical de Image');
  const css = leer('app/copywriter/outliers.module.css');
  assert.match(css, /\.portada \{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;/);
});

test('teléfono: «Mis guiones» y «Crear desde cero» debajo del título, no al final de la fila de formatos (11/11, a 375 no se veían)', () => {
  const portada = leer('app/copywriter/OutliersCopy.tsx');
  assert.match(portada, /<\/h1>\s*\{\/\*[\s\S]*?\*\/\}\s*\{botones\}/, 'debajo del título');
  assert.doesNotMatch(portada, /\{segmento\}\n\s+\{telefono \? botones : null\}/);
  // 12/11/2026: en dos renglones si no entran (en la fila que se deslizaba, «+ Crear desde cero» quedaba cortado a 375).
  assert.doesNotMatch(portada, /oc\.filaTelefono/);
  const css = leer('app/copywriter/outliers.module.css');
  assert.match(css, /\.botonesTelefono\.botonesTelefono\.botonesTelefono\.botonesTelefono \{ flex-wrap: wrap; justify-content: center;/);
});

test('la réplica de YouTube sigue sus capítulos, y el largo se mide (13/11/2026, en producción después del despliegue)', () => {
  // La descripción REAL del video de @herasmedia: 8 capítulos (más la intro y un «#9» vacío).
  const desc = 'El método viral para ganar 100.000 Seguidores y +20.000€ / mes (en menos de 90 días) https://bit.ly/4f6BZ7w He generado + de 600 Millones de visualizaciones. 0:00 Intro 0:45 #1 Reel viral paso a paso en el nuevo instagram 2024 1:56 #2 La idea que elijas para crear ese vídeo 3:05 #3 Idea Ganadora 11:53 #4 El contenido debe gustar a cualquier persona 17:18 #5 Lo que mas importa es que la gente se quede 50 segundos 23:37 #6 El formato de contenido 38:13 #7 ¿Cómo publicar el contenido? 41:52 #8 ¿A que hora debo publicar los contenidos? 19:55 #9 ____________ Y literalmente lo he hecho en todos los nichos.';
  const caps = capitulosDe(desc);
  assert.deepEqual(caps, ['Intro', 'Reel viral paso a paso en el nuevo instagram 2024', 'La idea que elijas para crear ese vídeo', 'Idea Ganadora',
    'El contenido debe gustar a cualquier persona', 'Lo que mas importa es que la gente se quede 50 segundos', 'El formato de contenido',
    '¿Cómo publicar el contenido?', '¿A que hora debo publicar los contenidos?']);
  assert.deepEqual(capitulosDe('Mira el minuto 0:45 del video.'), [], 'un tiempo suelto no son capítulos');
  // Van uno por uno en lo que lee MaKo (con «si trae capítulos…» salieron las 9 secciones de la biblioteca).
  const regla = reglasDeLaReplica({ formato: 'youtube', deDonde: 'descripcion', texto: desc, laminas: null })[0];
  assert.match(regla, /UNA sección por capítulo, en este orden[^:]*: 1\) Intro · 2\) Reel viral paso a paso/);
  // El aviso: las secciones de la biblioteca no siguen los capítulos; las que los nombran, sí.
  assert.equal(siguenLosCapitulos(['GANCHO', 'INTRO', 'BLOQUE UNO', 'CTA MEDIO', 'BLOQUE DOS', 'BLOQUE TRES', 'REGANCHO', 'BLOQUE FINAL', 'CIERRE'], caps), false);
  assert.equal(siguenLosCapitulos(['INTRO', 'PASO A PASO', 'LA IDEA', 'IDEA GANADORA', 'GUSTAR A TODOS', 'QUE SE QUEDEN', 'EL FORMATO', 'CÓMO PUBLICAR', 'A QUÉ HORA'], caps), true);
  assert.equal(siguenLosCapitulos(['CAPITULO 1', 'CAPITULO 2', 'CAPITULO 3', 'CAPITULO 4', 'CAPITULO 5'], caps), true);
  // El largo: el anuncio de 35 palabras salió de 83 («unas 38», decía MaKo).
  const original = textoParaMaKo(outlier({ texto: Array.from({ length: 35 }, (_, i) => `p${i}`).join(' '), deDonde: 'copy' }), null);
  assert.match(avisoDeLargo(original, 83) ?? '', /Quedó de 83 palabras y el original tiene 35: pídele a MaKo que lo deje de ese largo \(sin secciones de más\)\./);
  assert.equal(avisoDeLargo(original, 40), null);
  assert.equal(avisoDeLargo(textoParaMaKo(outlier({ deDonde: 'pie' }), null), 500), null, 'el pie de un reel no pide largo');
  const ia = leer('lib/copywriter/ia.ts');
  // El aviso queda como ÚLTIMO RECURSO, después de la segunda pasada (13/11/2026).
  assert.ok(ia.includes('const largoMal = avisoDeLargo(original, m.escritas);'));
  assert.ok(ia.includes('if (!siguenLosCapitulos(m.secciones, capitulos)) avisos.push('));
});

test('la réplica se CORRIGE sola: segunda pasada con los números y el largo real en la respuesta (13/11/2026, el Cerebro)', () => {
  const original = textoParaMaKo(outlier({ texto: Array.from({ length: 35 }, (_, i) => `p${i}`).join(' '), deDonde: 'copy' }), null);
  assert.equal(largoPedido(original), 35);
  assert.equal(largoPedido(textoParaMaKo(outlier({ deDonde: 'pie' }), null)), null);
  // Fuera del ±25 %: 83 sobre 35 sí; 40 no.
  assert.equal(largoFuera(35, 83), true);
  assert.equal(largoFuera(35, 40), false);
  assert.equal(largoFuera(35, 25), true);
  const pedido = pedidoDeCorreccion({ largo: { n: 35, escritas: 83 }, capitulos: ['Intro', 'Idea Ganadora', 'Cómo publicar'] });
  assert.match(pedido, /tiene 83 palabras y el original 35\. Reescríbelo ENTERO entre 28 y 42 palabras/);
  assert.match(pedido, /el original tiene 3 y tu guion no los sigue\. Una sección por capítulo[\s\S]*1\. Intro\n {2}2\. Idea Ganadora\n {2}3\. Cómo publicar/);
  assert.match(pedido, /TODAS las operaciones de nuevo/);
  assert.doesNotMatch(pedidoDeCorreccion({ largo: null, capitulos: ['a', 'b', 'c'] }), /EL LARGO/);
  // «unas 38 palabras» con 83 escritas: el número real; el del original, si lo nombra bien, queda.
  assert.equal(conElLargoReal('Repliqué el anuncio: unas 38 palabras, mismo tempo.', 83, 35), 'Repliqué el anuncio: 83 palabras, mismo tempo.');
  assert.equal(conElLargoReal('El original tiene 35 palabras y el mío 40 palabras.', 37, 35), 'El original tiene 35 palabras y el mío 37 palabras.');
  assert.equal(conElLargoReal('Repliqué el anuncio.', 37, 35), 'Repliqué el anuncio. Quedó de 37 palabras; el original tiene 35.');
  // La segunda pasada va en `editar`, con el pedido de corrección después de su primera respuesta, y gana la que mejor cumple.
  const ia = leer('lib/copywriter/ia.ts');
  assert.ok(ia.includes('if (m.entera && (f1.largo || f1.capitulos || f1.corta) && Date.now() < t0 + 170_000) {'));
  assert.ok(ia.includes("{ role: 'assistant', content: JSON.stringify(raw) }, { role: 'user', content: correccion }"));
  assert.ok(ia.includes('if (m2.entera && puntos(m2) < puntos(m)) { raw = raw2; m = m2; }'));
  assert.ok(ia.includes('if (largo != null && entera) respuesta = conElLargoReal(respuesta, m.escritas, largo);'));
});
