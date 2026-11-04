// =============================================================================
// La búsqueda de Spy por red (4/11/2026): qué se busca con lo escrito, cómo se lee Google y cómo se ordena
// =============================================================================
// Martín, 4/11: «La barra principal de búsqueda debería funcionar igual que cuando le doy al "+"… diferenciado las
// redes», «si busco solo el nombre TAMBIÉN debería buscar en YouTube», «no me trajo ni 1 solo de las cuentas grandes
// de victor heras», «cuando busco por link de instagram… como si lo hubiese puesto el @ exacto», «si me olvidé de
// poner el @, debería buscarlo también».
//
// Todo lo de acá EJECUTA `lib/spy-buscar-reglas.ts`: nada copia líneas del fuente.
//
// ⚠️ LA RESPUESTA DE GOOGLE DE ESTOS TESTS ESTÁ ARMADA A MANO con la forma del actor (`organicResults` con `title`,
// `url` y `description`) y las descripciones que Google escribe para un perfil y un canal. NO es una captura: la
// nube no llega a Apify. Una corrida de verdad la confirma (docs/relevo/nube-spy.md).
//
// PROBADO ROMPIÉNDOLO: base 23/0. Fijar el @ adivinado de un nombre (`fijar: usuariosCandidatos(t)[0]`) → 2 rojos
// (la cuenta chica primero). Ordenar por orden de llegada (sin seguidores) → 4 rojos. «den.borgg» como dominio (sin la
// lista de TLD) → 2 rojos. `contadorDeTexto` sin distinguir sufijo («1,2 M» como 12) → 1 rojo. Sacar `site:youtube.com`
// de la consulta → 1 rojo. Ofrecer «Usar @x» cuando la lectura dijo que no existe → 1 rojo. Pedir el @ de quien ya se
// mira → 1 rojo. «No hay» con la clave faltando → 1 rojo.
// La búsqueda en YouTube (4/11, «pongo un espacio… solamente me trae Instagram»), rota de a una y restaurada: un nombre sin
// su @ en YouTube → 3 rojos; `videosDeGoogle` vacío (tirar los videos, lo de antes) → 1 rojo; `canalesDeVideos` sin
// sacar repetidos → 1 rojo; el estado de YouTube que calla un fallo → 1 rojo.
// Correr: node --import tsx --test tests/spy-buscar.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canalesDeVideos, leerCanalesDeVideos } from '../lib/spy-youtube';
import {
  videoDeUrl, videosDeGoogle,
  canalesDeGoogle, consultasDeNombre, contadorDeTexto, cualesCompletar, esDominio, esperaDe, filasDeLaBusqueda,
  ordenarCanales, ordenarPerfiles, pedidosDelPlan, perfilesDeGoogle, planDeBusqueda,
  type PerfilHallado, type RespuestasBusqueda,
} from '../lib/spy-buscar-reglas';

const nadie = { instagram: new Set<string>(), youtube: new Set<string>() };

// Lo que el buscador de Instagram muestra con sesión, y lo que traía el scraper (las capturas de Martín, 4/11).
const GOOGLE_VICTOR = [
  {
    searchQuery: { term: '"Víctor Heras" site:instagram.com' },
    organicResults: [
      { title: 'Víctor Heras (@herasmedia) • Instagram photos and videos', url: 'https://www.instagram.com/herasmedia/', description: '248K Followers, 1,069 Following, 2,158 Posts - See Instagram photos and videos from Víctor Heras (@herasmedia)' },
      { title: 'Víctor Heras (@victorherasemprendedor) • Instagram photos and videos', url: 'https://www.instagram.com/victorherasemprendedor/', description: '492K Followers, 503 Following, 1,543 Posts - See Instagram photos and videos from Víctor Heras (@victorherasemprendedor)' },
      { title: 'Una publicación de Víctor Heras', url: 'https://www.instagram.com/p/DfGb43czd-I/', description: 'Le gusta a 3.400 personas' },
      { title: 'Víctor Heras (@victorherasreal) • Fotos y videos de Instagram', url: 'https://www.instagram.com/victorherasreal/reels/', description: '148 mil seguidores, 12 seguidos, 300 publicaciones' },
    ],
  },
  {
    searchQuery: { term: '"Víctor Heras" site:youtube.com' },
    organicResults: [
      { title: 'Víctor Heras Media - YouTube', url: 'https://www.youtube.com/@Victorherasmedia', description: 'Víctor Heras Media. 120K subscribers•195 videos. viralidad.com' },
      { title: 'Cómo hacerse viral', url: 'https://www.youtube.com/watch?v=abc123', description: 'Un video' },
      { title: 'Víctor Heras Shorts - YouTube', url: 'https://www.youtube.com/@victorherasshorts/shorts', description: '9,5 mil suscriptores' },
    ],
  },
];

// ── Qué se busca con lo escrito ──────────────────────────────────────────────

test('un nombre se busca por nombre, y su nombre pegado como @ se prueba SIN ir primero', () => {
  const p = planDeBusqueda('Víctor Heras');
  assert.equal(p.nombre, 'Víctor Heras');
  assert.equal(p.instagramExacto, 'victorheras');
  assert.equal(p.fijar, null, 'el @ adivinado compite por seguidores: con Víctor Heras era la cuenta chica de 5,2 mil');
});

test('el @ exacto, con o sin @: se lee ese, y ése va primero', () => {
  const con = planDeBusqueda('@den.borgg');
  assert.equal(con.instagramExacto, 'den.borgg');
  assert.equal(con.fijar, 'den.borgg');
  assert.equal(con.nombre, null, 'con la arroba no se espera la búsqueda por nombre');
  const sin = planDeBusqueda('den.borgg');
  assert.equal(sin.instagramExacto, 'den.borgg', 'sin la arroba también se lee: era la página https://den.borgg');
  assert.equal(sin.sitio, null);
  assert.equal(sin.fijar, 'den.borgg');
  assert.equal(sin.nombre, 'den.borgg', 'y además se busca como nombre');
});

test('el enlace de su perfil es su @ exacto: con o sin https, con ?igsh=', () => {
  for (const t of ['https://www.instagram.com/herasmedia/?igsh=MXg', 'instagram.com/herasmedia', 'www.instagram.com/HerasMedia/']) {
    const p = planDeBusqueda(t);
    assert.equal(p.instagramExacto, 'herasmedia', t);
    assert.equal(p.fijar, 'herasmedia', t);
    assert.equal(p.nombre, null, `${t}: un enlace no se busca como nombre`);
  }
  assert.equal(planDeBusqueda('https://www.instagram.com/reel/DfGb43czd-I/').noReconocido, 'instagram-post');
});

test('un enlace de YouTube lee ESE canal; un /c/ se dice, no se adivina', () => {
  assert.equal(planDeBusqueda('https://www.youtube.com/@Victorherasmedia').youtubeExacto, '@Victorherasmedia');
  assert.equal(planDeBusqueda('youtube.com/@Victorherasmedia').youtubeExacto, '@Victorherasmedia');
  assert.equal(planDeBusqueda('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv').youtubeExacto, 'UCabcdefghijklmnopqrstuv');
  assert.equal(planDeBusqueda('https://www.youtube.com/c/alguien').noReconocido, 'youtube-c');
});

test('un dominio de verdad es su sitio, y su @ se ofrece SIN leerlo', () => {
  const p = planDeBusqueda('acme.com');
  assert.equal(p.sitio, 'https://acme.com');
  assert.equal(p.instagramExacto, null, 'leer cada dominio pegado gastaría una lectura en algo que casi siempre es un sitio');
  assert.equal(p.tambienUsuario, 'acme.com');
  assert.ok(esDominio('acme.com.mx'));
  assert.ok(!esDominio('den.borgg'));
  assert.ok(!esDominio('victor.heras'));
});

test('con menos de 3 letras no se pide nada', () => {
  assert.deepEqual(pedidosDelPlan(planDeBusqueda('le'), nadie), []);
  assert.deepEqual(pedidosDelPlan(planDeBusqueda(''), nadie), []);
});

test('un nombre pide Google (Instagram y YouTube juntos), el buscador de Instagram y su @ en YouTube', () => {
  const fuentes = pedidosDelPlan(planDeBusqueda('Víctor Heras'), nadie).map((p) => new URL(p.url, 'https://x').searchParams.get('fuente'));
  assert.deepEqual(fuentes.sort(), ['google', 'ig', 'ig-nombre', 'yt']);
  assert.match(consultasDeNombre('Víctor Heras'), /"Víctor Heras" site:instagram\.com\n"Víctor Heras" site:youtube\.com/);
});

test('a quien ya se mira no se lo vuelve a pedir: sale en «Ya los miras»', () => {
  const ya = { instagram: new Set(['herasmedia']), youtube: new Set(['@herasmedia']) };
  assert.deepEqual(pedidosDelPlan(planDeBusqueda('@herasmedia'), ya), []);
});

// ── Lo que trae Google ───────────────────────────────────────────────────────

test('los contadores se leen como los escribe Google: «492K», «1,543», «248 mil», «1,2 M»', () => {
  assert.equal(contadorDeTexto('492K'), 492_000);
  assert.equal(contadorDeTexto('1.2M'), 1_200_000);
  assert.equal(contadorDeTexto('1,543'), 1_543);
  assert.equal(contadorDeTexto('248 mil'), 248_000);
  assert.equal(contadorDeTexto('1,2 M'), 1_200_000);
  assert.equal(contadorDeTexto('9,5 mil'), 9_500);
  assert.equal(contadorDeTexto('sin número'), null);
});

test('de Google salen los PERFILES con sus seguidores, sin posts', () => {
  const ig = perfilesDeGoogle(GOOGLE_VICTOR);
  assert.deepEqual(ig.map((p) => p.usuario), ['herasmedia', 'victorherasemprendedor', 'victorherasreal']);
  assert.deepEqual(ig.map((p) => p.seguidores), [248_000, 492_000, 148_000]);
  assert.equal(ig[0].nombre, 'Víctor Heras');
});

test('de Google salen los CANALES, sin videos sueltos', () => {
  const yt = canalesDeGoogle(GOOGLE_VICTOR);
  assert.deepEqual(yt.map((c) => c.ref), ['@Victorherasmedia', '@victorherasshorts']);
  assert.equal(yt[0].nombre, 'Víctor Heras Media');
  assert.equal(yt[0].suscriptores, 120_000);
});

// ── El orden ─────────────────────────────────────────────────────────────────

const p = (usuario: string, seguidores: number | null): PerfilHallado => ({ usuario, nombre: null, foto: null, seguidores });

test('por seguidores, de mayor a menor: las cuentas grandes arriba', () => {
  const lista = ordenarPerfiles([p('victorheras', 5_200), p('victor.heras.167', 14), p('victorherasemprendedor', 492_000), p('herasmedia', 248_000)], null);
  assert.deepEqual(lista.map((x) => x.usuario), ['victorherasemprendedor', 'herasmedia', 'victorheras', 'victor.heras.167']);
});

test('el @ que se escribió va primero aunque tenga menos', () => {
  const lista = ordenarPerfiles([p('herasmedia', 248_000), p('den.borgg', 900)], 'den.borgg');
  assert.equal(lista[0].usuario, 'den.borgg');
});

test('«sin dato» no es «cero»: va después de los que se saben, en el orden en que llegó', () => {
  const lista = ordenarPerfiles([p('a', null), p('b', 10), p('c', null)], null);
  assert.deepEqual(lista.map((x) => x.usuario), ['b', 'a', 'c']);
});

test('los canales: el pegado primero, después por suscriptores', () => {
  const c = (ref: string, s: number | null) => ({ ref, nombre: null, foto: null, suscriptores: s, url: '' });
  assert.deepEqual(ordenarCanales([c('@b', 10), c('@a', 900), c('@x', 1)], '@x').map((x) => x.ref), ['@x', '@a', '@b']);
});

test('se completan las primeras 5 que no tienen foto o seguidores, y no dos veces', () => {
  const siete = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((u) => p(u, null));
  assert.deepEqual(cualesCompletar(siete, new Set()), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(cualesCompletar(siete, new Set(['a', 'b'])), ['c', 'd', 'e']);
  assert.deepEqual(cualesCompletar([{ ...p('a', 5), foto: 'https://x/a.jpg' }], new Set()), [], 'con foto y seguidores no hay nada que completar');
});

// ── Las filas ────────────────────────────────────────────────────────────────

test('con un nombre: Instagram ordenado por seguidores, YouTube con sus canales, cada uno en su grupo', () => {
  const plan = planDeBusqueda('Víctor Heras');
  const resp: RespuestasBusqueda = {
    'ig:victorheras': { perfil: p('victorheras', 5_200), vacio: null },
    'g:victor heras': { instagram: perfilesDeGoogle(GOOGLE_VICTOR), youtube: canalesDeGoogle(GOOGLE_VICTOR), vacio: null },
    'ign:victor heras': { perfiles: [p('victoria.herasymchukk', null), p('victor.heras.167', null)], vacio: null },
  };
  const b = filasDeLaBusqueda(plan, resp, {}, nadie);
  const ig = b.filas.filter((f) => f.grupo === 'instagram').map((f) => (f.tipo === 'perfil' ? f.perfil.usuario : f.tipo));
  assert.deepEqual(ig.slice(0, 4), ['victorherasemprendedor', 'herasmedia', 'victorherasreal', 'victorheras']);
  assert.deepEqual(b.filas.filter((f) => f.grupo === 'youtube').map((f) => (f.tipo === 'canal' ? f.canal.ref : f.tipo)), ['@Victorherasmedia', '@victorherasshorts']);
  assert.equal(b.instagramCargando, false);
  assert.ok(b.filas.some((f) => f.tipo === 'nombre'), 'y «Agregar con su nombre», cuando ya contestó');
});

test('lo que llega primero se ve mientras lo demás sigue en camino', () => {
  const plan = planDeBusqueda('Víctor Heras');
  const b = filasDeLaBusqueda(plan, { 'ig:victorheras': { perfil: p('victorheras', 5_200), vacio: null } }, {}, nadie);
  assert.equal(b.filas[0].tipo, 'perfil');
  assert.equal(b.instagramCargando, true);
  assert.equal(b.youtubeCargando, true);
  assert.ok(!b.filas.some((f) => f.tipo === 'nombre'), '«Agregar con su nombre» espera a que la búsqueda conteste');
});

test('un @ que no existe no se ofrece; uno que no se pudo leer sí («Usar @x»)', () => {
  const plan = planDeBusqueda('@den.borgg');
  const noExiste = filasDeLaBusqueda(plan, { 'ig:den.borgg': { perfil: null, vacio: null }, 'yt:@den.borgg': { canal: null } }, {}, nadie);
  assert.ok(!noExiste.filas.some((f) => f.tipo === 'usar'));
  const sinLeer = filasDeLaBusqueda(plan, { 'ig:den.borgg': { fallo: true }, 'yt:@den.borgg': { canal: null } }, {}, nadie);
  assert.ok(sinLeer.filas.some((f) => f.tipo === 'usar' && f.usuario === 'den.borgg'));
});

test('sin la clave de Spy se dice eso, no «no encontré a nadie»', () => {
  const plan = planDeBusqueda('Víctor Heras');
  const b = filasDeLaBusqueda(plan, {
    'ig:victorheras': { perfil: null, vacio: 'sin-clave' },
    'g:victor heras': { instagram: [], youtube: [], vacio: 'sin-clave' },
    'ign:victor heras': { perfiles: [], vacio: 'sin-clave' },
    'yt:@victorheras': { canal: null, vacioYoutube: null },
  }, {}, nadie);
  assert.equal(b.sinClave, true);
  assert.equal(b.algoPedido, true);
});

test('completar suma foto y seguidores, y reordena', () => {
  const plan = planDeBusqueda('Víctor Heras');
  const resp: RespuestasBusqueda = {
    'ig:victorheras': { perfil: null, vacio: null },
    'g:victor heras': { instagram: [], youtube: [], vacio: null },
    'ign:victor heras': { perfiles: [p('chico', null), p('grande', null)], vacio: null },
  };
  const antes = filasDeLaBusqueda(plan, resp, {}, nadie).instagram.map((x) => x.usuario);
  assert.deepEqual(antes, ['chico', 'grande']);
  const despues = filasDeLaBusqueda(plan, resp, { chico: p('chico', 14), grande: { ...p('grande', 492_000), foto: 'https://x/g.jpg' } }, nadie).instagram;
  assert.deepEqual(despues.map((x) => x.usuario), ['grande', 'chico']);
  assert.equal(despues[0].foto, 'https://x/g.jpg');
});

test('un enlace de YouTube que no se pudo leer se ofrece igual, con lo que se pegó', () => {
  const plan = planDeBusqueda('https://www.youtube.com/@Victorherasmedia');
  const b = filasDeLaBusqueda(plan, { 'yt:@victorherasmedia': { canal: null } }, {}, nadie);
  const f = b.filas.find((x) => x.tipo === 'directo');
  assert.ok(f && f.tipo === 'directo' && f.pegar === 'https://www.youtube.com/@Victorherasmedia');
});

// ── Lo que se dice mientras se espera ────────────────────────────────────────

test('la espera dice cuánto tarda y que con el @ es más rápido; nunca «inmediato»', () => {
  assert.equal(esperaDe(500, true), 'Buscando…');
  assert.match(esperaDe(4000, true), /20 segundos/);
  assert.match(esperaDe(12_000, true), /@ exacto/);
  for (const ms of [0, 4000, 12_000, 30_000]) for (const n of [true, false]) assert.doesNotMatch(esperaDe(ms, n), /inmediat/i);
});

// ── YouTube se busca SIEMPRE (Martín, 4/11: «pongo un espacio… solamente me trae Instagram») ─────────────────────

/** ¿Lo escrito consulta YouTube? Con su @ o su canal (`yt:`), o por Google con `site:youtube.com` (`g:`). */
const consultaYoutube = (texto: string) => {
  const pedidos = pedidosDelPlan(planDeBusqueda(texto), nadie);
  return {
    exacto: pedidos.some((p) => p.k.startsWith('yt:')),
    google: pedidos.some((p) => p.k.startsWith('g:')) && consultasDeNombre(planDeBusqueda(texto).nombre ?? '').includes('site:youtube.com'),
  };
};

test('YouTube se consulta con un nombre, sin @, con @ y con el enlace del canal', () => {
  const nombre = consultaYoutube('Victor Heras');
  assert.ok(nombre.google, 'un nombre de dos palabras busca canales en Google');
  assert.ok(nombre.exacto, 'y su nombre pegado se prueba como @ en YouTube, como en Instagram');
  assert.equal(planDeBusqueda('Victor Heras').youtubeExacto, '@victorheras');
  const pegado = consultaYoutube('victorheras');
  assert.ok(pegado.exacto && pegado.google, 'una palabra: su @ en YouTube y la búsqueda por nombre');
  assert.ok(consultaYoutube('@Victorherasmedia').exacto, 'el @ exacto también es su canal');
  assert.ok(consultaYoutube('https://www.youtube.com/@Victorherasmedia').exacto, 'el enlace del canal');
  assert.ok(consultaYoutube('youtube.com/channel/UCabcdefghijklmnopqrstuv').exacto, 'el enlace por id');
});

test('los VIDEOS que trae Google de YouTube son la puerta a su canal (antes se tiraban)', () => {
  assert.deepEqual(videosDeGoogle(GOOGLE_VICTOR), [], 'el armado de arriba no trae un id de video válido (abc123 no tiene 11)');
  const conVideos = [{ searchQuery: { term: '"Victor Heras" site:youtube.com' }, organicResults: [
    { title: 'Cómo hacerse viral - YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', description: '' },
    { title: 'Un short', url: 'https://www.youtube.com/shorts/aBcDeFgHiJk', description: '' },
    { title: 'Otro', url: 'https://youtu.be/dQw4w9WgXcQ', description: '' },
    { title: 'Una lista', url: 'https://www.youtube.com/playlist?list=PL123', description: '' },
  ] }];
  assert.deepEqual(videosDeGoogle(conVideos), ['dQw4w9WgXcQ', 'aBcDeFgHiJk'], 'sin repetir, y una lista no es un video');
  assert.equal(videoDeUrl('https://m.youtube.com/live/aBcDeFgHiJk'), 'aBcDeFgHiJk');
  assert.equal(videoDeUrl('https://www.youtube.com/@Victorherasmedia'), null, 'un canal no es un video');
  const resp = { items: [
    { id: 'dQw4w9WgXcQ', snippet: { channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa', channelTitle: 'Víctor Heras Media' } },
    { id: 'aBcDeFgHiJk', snippet: { channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa', channelTitle: 'Víctor Heras Media' } },
    { id: 'zzzzzzzzzzz', snippet: { channelId: 'no-es-un-canal' } },
  ] };
  assert.deepEqual(canalesDeVideos(resp), [{ id: 'UCaaaaaaaaaaaaaaaaaaaaaa', nombre: 'Víctor Heras Media' }]);
});

test('los canales de los videos: UNA llamada a videos.list, y sin clave se dice', async () => {
  const pedidas: string[] = [];
  const falso = async (url: string) => { pedidas.push(url); return { status: 200, json: async () => ({ items: [{ snippet: { channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa', channelTitle: 'X' } }] }) } as Response; };
  const r = await leerCanalesDeVideos(['dQw4w9WgXcQ', 'aBcDeFgHiJk', 'malo'], 'k', falso);
  assert.ok(r.ok);
  assert.equal(pedidas.length, 1);
  assert.match(pedidas[0], /\/videos\?part=snippet&id=dQw4w9WgXcQ%2CaBcDeFgHiJk&key=k/);
  assert.deepEqual(await leerCanalesDeVideos(['dQw4w9WgXcQ'], '', falso), { ok: false, canales: [] }, 'sin clave no es «ninguno»');
});

test('el grupo de YouTube dice qué pasó: ninguno, no pude o sin clave; nunca calla', () => {
  const plan = planDeBusqueda('Victor Heras');
  const base: RespuestasBusqueda = { 'ig:victorheras': { perfil: p('victorheras', 5_200), vacio: null }, 'ign:victor heras': { perfiles: [], vacio: null } };
  const estado = (extra: RespuestasBusqueda) => filasDeLaBusqueda(plan, { ...base, ...extra }, {}, nadie).youtubeEstado;
  assert.equal(estado({}), 'cargando');
  assert.equal(estado({ 'g:victor heras': { instagram: [], youtube: [], vacio: null }, 'yt:@victorheras': { canal: null, vacioYoutube: null } }), 'ninguno');
  assert.equal(estado({ 'g:victor heras': { instagram: [], youtube: [], vacio: null, vacioYoutube: 'fallo' }, 'yt:@victorheras': { canal: null, vacioYoutube: null } }), 'no-pude', 'un fallo leyendo los videos no es «ninguno»');
  assert.equal(estado({ 'g:victor heras': { instagram: [], youtube: [], vacio: null }, 'yt:@victorheras': { canal: null, vacioYoutube: 'sin-clave' } }), 'no-pude', 'sin la clave de YouTube: es nuestro, «no pude»');
  assert.equal(estado({ 'g:victor heras': { instagram: [], youtube: [], vacio: 'sin-clave' }, 'yt:@victorheras': { canal: null, vacioYoutube: null } }), 'sin-clave', 'sin la clave de Apify: Google no buscó');
  const canal = { ref: '@Victorherasmedia', nombre: 'Víctor Heras Media', foto: null, suscriptores: 120_000, url: 'https://www.youtube.com/@Victorherasmedia' };
  assert.equal(estado({ 'g:victor heras': { instagram: [], youtube: [canal], vacio: null }, 'yt:@victorheras': { canal: null, vacioYoutube: null } }), 'hay');
});
