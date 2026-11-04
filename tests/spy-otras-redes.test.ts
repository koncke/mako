// =============================================================================
// Sus OTRAS redes, por búsqueda, y VALIDADAS (ítems 10/11 de Competitors Spy, 3/11/2026)
// =============================================================================
// Martín: «con un dato, traer todas sus redes» y «súper importante que lo valides… ¿este es el
// YouTube de esta persona?». Lo que se cuida acá:
//   1. que de la página de Google salgan PERFILES, no videos sueltos ni alias que no se resuelven;
//   2. que de una red que el competidor YA tiene no se ofrezca nada (los otros con su nombre son
//      otras personas: con «Sofia Contreras» vinieron cinco Instagram distintos);
//   3. que la búsqueda NO ESCRIBA en la base: lo único que guarda es el «sí» de la persona.
//
// Las respuestas de abajo son la forma REAL del actor, medida el 3/11/2026 con
// `scripts/probar-otras-redes-apify.mjs` («Leila Hormozi» y «Sofia Contreras», ws 9).
//
// PROBADO ROMPIÉNDOLO (3/11/2026), con el archivo en 9 / 0, una rotura por vez y restaurada:
//   · `candidatosDeLaRespuesta` sin el descarte de la red que ya tiene  → 8 / 1
//   · `redDeUrl` que acepta `/watch` como canal                          → 6 / 3
//   · `redDeUrl` que convierte `/c/<alias>` en `@alias`                  → 7 / 2
//   · sin el tope de 3 por red                                           → 8 / 1
//   · `lib/spy-otras-redes.ts` que importa `getTenantDb`                 → 8 / 1
// Correr: node --import tsx --test tests/spy-otras-redes.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  candidatosDeLaRespuesta, consultaDeRedes, consultaPorUsuario, distanciaHash, nombraA, nombresParecidos, porqueDe, redDeUrl,
  sitioDelTexto, USD_POR_BUSQUEDA_REDES, veredictoDe, MISMA_FOTO_HASTA,
} from '../lib/spy-otras-redes-reglas';
import sharp from 'sharp';
import { hashDeImagen } from '../lib/spy-foto-hash';
import { debeBuscarRedes, marcarRedesBuscadas, DIAS_SIN_REPETIR_REDES } from '../app/competitor-spy/redes-recordar';
import { canalDeLaBio } from '../lib/spy-reglas';
import { canalDeUrl } from '../lib/spy-youtube';

const pagina = (...urls: string[]) => [{ organicResults: urls.map((url, i) => ({ url, title: `r${i}` })) }];
const NADA = { instagram: null, youtube_id: null, tiktok: null };

// La página de «Leila Hormozi», tal cual vino (sin los títulos).
const LEILA = pagina(
  'https://www.youtube.com/@leilahormozi',
  'https://www.instagram.com/leilahormozi/',
  'https://www.youtube.com/watch?v=w_yU1xEqXwk',
  'https://www.tiktok.com/@leilahormozi',
  'https://www.youtube.com/playlist?list=PLWgEgLt4u2muCpSQuR2vf-Vhjeif2-AYy',
  'https://www.youtube.com/watch?v=cgsWQd5EM1k',
);

test('de la página de Leila salen sus tres redes y ningún video suelto', () => {
  const c = candidatosDeLaRespuesta(LEILA, NADA);
  assert.deepEqual(c.map((k) => `${k.red}:${k.ref}`), ['youtube:@leilahormozi', 'instagram:leilahormozi', 'tiktok:leilahormozi']);
});

test('de la red que YA tiene no se ofrece nada', () => {
  // Se agregó por su @: su Instagram ya está, y los demás Instagram con su nombre son otra gente.
  const c = candidatosDeLaRespuesta(LEILA, { ...NADA, instagram: 'leilahormozi' });
  assert.deepEqual(c.map((k) => k.red), ['youtube', 'tiktok']);
  assert.deepEqual(candidatosDeLaRespuesta(LEILA, { instagram: 'x', youtube_id: 'UCx', tiktok: 'x' }), []);
});

test('los cinco «Sofia Contreras»: tope de 3 por red, sin repetir, y el /c/ afuera', () => {
  const c = candidatosDeLaRespuesta(pagina(
    'https://www.instagram.com/ssoficontreras/',
    'https://www.instagram.com/soysofiacontreras/',
    'https://www.youtube.com/c/SofiaContreras',
    'https://www.instagram.com/soysofiacontreras/reels/',
    'https://www.instagram.com/sofiacontreras_6/',
    'https://www.instagram.com/sofiacontreras0404/',
  ), NADA);
  assert.deepEqual(c.map((k) => k.ref), ['ssoficontreras', 'soysofiacontreras', 'sofiacontreras_6']);
});

test('redDeUrl: perfiles sí, publicaciones y alias no', () => {
  assert.equal(redDeUrl('https://www.youtube.com/watch?v=abc'), null);
  assert.equal(redDeUrl('https://www.youtube.com/shorts/abc'), null);
  assert.equal(redDeUrl('https://www.youtube.com/c/SofiaContreras'), null);
  assert.equal(redDeUrl('https://www.instagram.com/p/ABC123/'), null);
  assert.equal(redDeUrl('https://example.com/@x'), null);
  assert.equal(redDeUrl('no es un link'), null);
  assert.equal(redDeUrl('https://www.youtube.com/@AlexHormozi/videos')?.ref, '@AlexHormozi');
  assert.equal(redDeUrl('https://m.tiktok.com/@Leila.H/video/123')?.ref, 'leila.h');
  assert.equal(redDeUrl('https://www.youtube.com/channel/UCUyDOdBWhC1MCxEjC46d-zw')?.ref, 'UCUyDOdBWhC1MCxEjC46d-zw');
});

test('todo YouTube que se ofrece lo sabe leer Spy (si no, el «sí» guardaría algo inservible)', () => {
  for (const u of ['https://www.youtube.com/@leilahormozi', 'https://www.youtube.com/channel/UCUyDOdBWhC1MCxEjC46d-zw', 'https://www.youtube.com/user/viejo']) {
    const k = redDeUrl(u);
    assert.ok(k && canalDeUrl(k.url), u);
  }
});

test('la consulta va por el nombre de verdad; con un id de canal por nombre, por su @', () => {
  assert.equal(consultaDeRedes({ nombre: 'Leila Hormozi', instagram: null }), '"Leila Hormozi" (site:youtube.com OR site:tiktok.com OR site:instagram.com)');
  assert.match(consultaDeRedes({ nombre: 'UCUyDOdBWhC1MCxEjC46d-zw', instagram: '@leila' }), /^"leila"/);
  assert.equal(consultaDeRedes({ nombre: '', instagram: null }), '');
});

test('un TikTok en la bio entra como TikTok, no como su landing', () => {
  assert.deepEqual(canalDeLaBio({ campo: 'tiktok', valor: 'leilahormozi' }, 'instagram'), { campo: 'tiktok', valor: 'leilahormozi' });
});

test('la búsqueda NO escribe en la base: sólo el «sí» de la persona guarda', () => {
  const fuente = readFileSync(new URL('../lib/spy-otras-redes.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const prohibido of ['getTenantDb', 'getServiceDb', '.insert(', '.update(', '.upsert(', 'agregarCompetidor']) {
    assert.ok(!fuente.includes(prohibido), `lib/spy-otras-redes.ts usa ${prohibido}`);
  }
});

test('el costo medido sigue escrito: US$0,00455 por búsqueda', () => {
  assert.ok(Math.abs(USD_POR_BUSQUEDA_REDES - 0.00455) < 1e-9);
});

// ─────────────────────────────────────────────────────────────────────────────
// Automático y con criterio (4/11/2026). Martín: «debe ser automático, no un botón, de última que te muestre opciones y te
// pregunte si es ese o no... Por la foto, o que razone».
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada:
//   · `veredictoDe` que suma sólo con el mismo nombre                    → «el mismo nombre solo pregunta»
//   · `nombraA` sin el borde (que «@hera» valga por «@herasmedia»)       → «nombraA busca el @ entero»
//   · `sitioDelTexto` sin saltar los correos                             → «el sitio de su descripción»
//   · `debeBuscarRedes` sin el negocio en la clave                       → «una vez por semana… por negocio»
// ─────────────────────────────────────────────────────────────────────────────

test('enlazarse entre ellos alcanza; misma foto y mismo nombre, también: se suma solo', () => {
  assert.equal(veredictoDe({ enlaza: true, mismoNombre: false, distanciaFoto: null }), 'es');
  assert.equal(veredictoDe({ enlaza: false, mismoNombre: true, distanciaFoto: MISMA_FOTO_HASTA }), 'es');
  assert.equal(porqueDe({ enlaza: false, mismoNombre: true, distanciaFoto: 3 }), 'Misma foto y mismo nombre');
});

test('el mismo nombre solo pregunta, y sin nada en común el candidato no se muestra', () => {
  // Con «Sofia Contreras» Google trajo cinco Instagram distintos: el nombre solo nunca suma.
  assert.equal(veredictoDe({ enlaza: false, mismoNombre: true, distanciaFoto: 40 }), 'quizas');
  assert.equal(veredictoDe({ enlaza: false, mismoNombre: true, distanciaFoto: null }), 'quizas');
  assert.equal(veredictoDe({ enlaza: false, mismoNombre: false, distanciaFoto: 2 }), 'quizas');
  assert.equal(veredictoDe({ enlaza: false, mismoNombre: false, distanciaFoto: 30 }), 'no');
});

test('nombraA busca el @ entero, el canal y el sitio, nunca un pedazo', () => {
  assert.equal(nombraA('Mi canal: youtube.com/@VictorHerasMedia', { youtube: '@victorherasmedia' }), true);
  assert.equal(nombraA('Sígueme en @herasmedia y en viralidad.com', { instagram: 'herasmedia' }), true);
  assert.equal(nombraA('Escribe a @herasmedia2', { instagram: 'herasmedia' }), false);
  assert.equal(nombraA('Hola @hera', { instagram: 'herasmedia' }), false);
  assert.equal(nombraA('Más en https://viralidad.com/curso', { sitio: 'https://www.viralidad.com' }), true);
  // Un Linktree lo tiene medio mundo: no es SU sitio.
  assert.equal(nombraA('linktr.ee/otro', { sitio: 'https://linktr.ee/victor' }), false);
});

test('nombresParecidos: sin tildes, y un nombre de canal que CONTIENE el suyo', () => {
  assert.equal(nombresParecidos('Víctor Heras', 'Victor Heras'), true);
  assert.equal(nombresParecidos('Víctor Heras Media', 'Victor Heras'), true);
  assert.equal(nombresParecidos('Victoria Herasymchuk', 'Victor Heras'), false);
  assert.equal(nombresParecidos('Ana', 'Ana'), false, 'un nombre muy corto no alcanza');
});

test('la segunda vuelta va por su @, y no se repite si el @ es su nombre', () => {
  assert.match(consultaPorUsuario({ nombre: 'Víctor Heras', instagram: 'herasmedia', youtube_id: null }), /^"herasmedia" \(site:youtube\.com/);
  assert.equal(consultaPorUsuario({ nombre: 'Den Borg', instagram: 'denborg', youtube_id: null }), '');
  assert.equal(consultaPorUsuario({ nombre: 'X', instagram: null, youtube_id: 'UCabc' }), '');
});

test('el sitio de su descripción o su bio: el primero que no es una red, ni un acortador, ni un correo', () => {
  assert.equal(sitioDelTexto('Contacto: hola@viralidad.com · Instagram: instagram.com/herasmedia · Curso: https://viralidad.com/curso.'), 'https://viralidad.com/curso');
  assert.equal(sitioDelTexto('linktr.ee/victor bit.ly/xyz'), null);
  assert.equal(sitioDelTexto(null), null);
});

/** Una imagen de prueba que no es plana (un degradado con un círculo), en RGBA si se pide. */
async function imagen(invertir: boolean, alfa = false): Promise<Buffer> {
  const w = 120, h = 120, canales = alfa ? 4 : 3;
  const px = Buffer.alloc(w * h * canales);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const dentro = (x - 50) ** 2 + (y - 60) ** 2 < 900;
    let v = Math.round((x / w) * 200) + (dentro ? 55 : 0);
    // Otra cara: el degradado al revés y el círculo en otro lado (dHash compara cada píxel con el de su derecha).
    if (invertir) v = 255 - Math.round((x / w) * 200) - ((x - 85) ** 2 + (y - 30) ** 2 < 400 ? 55 : 0);
    const i = (y * w + x) * canales;
    px[i] = v; px[i + 1] = v; px[i + 2] = v;
    if (alfa) px[i + 3] = dentro ? 255 : 120;
  }
  return sharp(px, { raw: { width: w, height: h, channels: canales as 3 | 4 } }).png().toBuffer();
}

test('la misma foto a otro tamaño y comprimida da casi el mismo hash; otra cara, no', async () => {
  const original = await imagen(false);
  const chica = await sharp(original).resize(48, 48).jpeg({ quality: 55 }).toBuffer();
  const otra = await imagen(true);
  const [a, b, c] = await Promise.all([hashDeImagen(original), hashDeImagen(chica), hashDeImagen(otra)]);
  assert.ok(a && b && c, 'las tres tienen hash');
  assert.ok((distanciaHash(a, b) ?? 99) <= MISMA_FOTO_HASTA, `misma foto: ${distanciaHash(a, b)}`);
  assert.ok((distanciaHash(a, c) ?? 0) > MISMA_FOTO_HASTA, `otra foto: ${distanciaHash(a, c)}`);
});

test('la misma foto con transparencia (un avatar PNG) también da su hash', async () => {
  const [a, b] = await Promise.all([hashDeImagen(await imagen(false, true)), hashDeImagen(Buffer.from('no es una imagen'))]);
  assert.match(a ?? '', /^[0-9a-f]{16}$/);
  assert.equal(b, null);
});

test('una vez por semana por competidor y POR NEGOCIO, y sin almacenamiento se busca igual', () => {
  const datos = new Map<string, string>();
  const almacen = { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => { datos.set(k, v); } };
  const c = { id: 16, instagram: 'x', youtube_id: null, tiktok: null };
  const hoy = Date.parse('2026-11-04T12:00:00Z');
  assert.equal(debeBuscarRedes(c, 3, hoy, almacen), true);
  marcarRedesBuscadas(3, 16, hoy, almacen);
  assert.equal(debeBuscarRedes(c, 3, hoy + 86_400_000, almacen), false, 'al otro día no se repite');
  assert.equal(debeBuscarRedes(c, 9, hoy + 86_400_000, almacen), true, 'el 16 de otro negocio es otro competidor');
  assert.equal(debeBuscarRedes(c, 3, hoy + (DIAS_SIN_REPETIR_REDES + 1) * 86_400_000, almacen), true, 'a la semana, sí');
  assert.equal(debeBuscarRedes({ ...c, youtube_id: 'UC1', tiktok: 't' }, 3, hoy, almacen), false, 'con todas sus redes no hay nada que buscar');
  assert.equal(debeBuscarRedes(c, 3, hoy, null), true);
});
