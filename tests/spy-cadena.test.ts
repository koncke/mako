// =============================================================================
// Sus otras redes y su web, solas y en cadena (4/11/2026)
// =============================================================================
// Martín, 4/11: «tampoco está haciendo el ejercicio de buscar en YouTube y también buscar su web… Yo busqué literalmente el
// usuario exacto y ya me apareció el primer resultado… y en correlación mirar las biografías para traer sus webs». Medido
// en producción por el Cerebro: @den.borgg quedó sin YouTube y con su «web» = beacons.page/denborg (su página de ENLACES).
//
// Lo que cuida este archivo, con un doble de cada servicio y CONTANDO las llamadas a Apify (Google y los perfiles):
//   1. agregar sólo @den.borgg termina con su YouTube y su web, abriendo su página de enlaces y sin ninguna llamada a Apify;
//   2. sin enlaces, su mismo usuario en YouTube (@den.borgg o @denborgg) con su nombre entra solo, y tampoco hay Google;
//   3. el mismo usuario con otro nombre se pregunta, y ahí sí se busca en Google (y el video que trae lleva a su canal);
//   4. sin la clave de Spy, lo que se encontró gratis sale igual; sin nada, se dice;
//   5. con todo puesto, no se pide nada;
//   6. las reglas: los enlaces de una página (también los escritos en sus datos), su web sin archivos ni servicios, una
//      página de enlaces nunca es su web al agregarlo, y la traída larga dice por qué no trajo todo;
//   7. una traída larga que termina sin nada no cuenta como la de la semana;
//   8. el tope de 6 corridas largas por día vive en la base: con el cron de cada hora, uno en memoria no topea nada.
//
// PROBADO ROMPIÉNDOLO (4/11/2026, un script que rompe de a una y restaura; base en verde), qué tests caen:
//   · la cadena sin abrir su página de enlaces                       → 1, 4
//   · sin probar su mismo usuario                                    → 2, 3
//   · Google aunque ya tenga Instagram y YouTube seguros             → 1, 2
//   · `veredictoDe` que da por seguro el mismo usuario solo          → 3, 6
//   · `enlacesDeHtml` sin leer los enlaces escritos en sus datos     → 1, 6
//   · `loQueEnlaza` que toma un archivo del CDN como su web          → 6
//   · `canalDeLaBio` que guarda la página de enlaces como su web     → 6
//   · la traída larga vacía que cuenta como la de la semana          → 7
//   · empezar una corrida sin reservarla en la base                  → 8
//   · reservar sin compare-and-set                                   → 8
//   · `usadasHoy` que no mira el día                                 → 8
// Correr: node --import tsx --test tests/spy-cadena.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cadenaDeRedes, type DepsCadena, type LeidoRed } from '../lib/spy-cadena';
import { enlacesDeHtml, esAgregador, loQueEnlaza, usuariosParaProbar, veredictoDe } from '../lib/spy-otras-redes-reglas';
import { canalDeLaBio } from '../lib/spy-reglas';
import { avisoDeTraida, usadasHoy } from '../lib/spy-todo-reglas';

const DEN = { nombre: 'Den Borg', instagram: 'den.borgg', youtube_id: null, tiktok: null, landing_url: 'https://beacons.page/denborg', avatar: 'https://x/den.jpg' };

// Una página de beacons: unos enlaces como <a href> y otros sólo en sus datos (se dibujan con JavaScript).
const BEACONS = `<html><body>
  <a href="https://www.youtube.com/@denborg" class="link">Mi canal</a>
  <a href="https://denborg.com/curso?utm_source=beacons">Mi curso</a>
  <img src="https://cdn.beacons.ai/images/foto.png">
  <script id="__NEXT_DATA__">{"links":[{"url":"https:\\/\\/www.tiktok.com\\/@denborg"},{"url":"https:\\u002F\\u002Fwww.instagram.com\\u002Fden.borgg"}]}</script>
</body></html>`;

type Cuenta = { google: number; perfiles: number; paginas: number; canales: string[]; videos: number };

function dobles(o: Partial<DepsCadena> & { canales?: Record<string, LeidoRed> } = {}): { deps: DepsCadena; cuenta: Cuenta } {
  const cuenta: Cuenta = { google: 0, perfiles: 0, paginas: 0, canales: [], videos: 0 };
  const deps: DepsCadena = {
    textoPropio: async () => 'Te enseño a crecer en redes ✨ beacons.page/denborg',
    abrirPagina: async () => { cuenta.paginas += 1; return BEACONS; },
    leerCanales: async (refs) => {
      cuenta.canales.push(...refs);
      const m = new Map<string, LeidoRed>();
      for (const r of refs) if (o.canales?.[r]) m.set(r, o.canales[r]);
      return m;
    },
    leerPerfiles: async () => { cuenta.perfiles += 1; return new Map(); },
    googlear: async () => { cuenta.google += 1; return []; },
    gastarBusqueda: () => true,
    canalesDeVideos: async () => { cuenta.videos += 1; return []; },
    hashDeFoto: async (u) => (u ? 'ffffffffffffffff' : null),
    ...o,
  };
  return { deps, cuenta };
}

test('1. agregar sólo @den.borgg termina con su YouTube y su web, sin una llamada a Apify', async () => {
  const { deps, cuenta } = dobles({ canales: { '@denborg': { nombre: 'Den Borg', texto: 'Mis cursos', foto: 'https://y/den.jpg' } } });
  const r = await cadenaDeRedes(DEN, deps);
  assert.ok(r.ok);
  const yt = r.seguros.find((k) => k.red === 'youtube');
  assert.equal(yt?.ref, '@denborg', 'su canal, sacado de su página de enlaces');
  assert.equal(yt?.porque, 'Su página de enlaces lleva a este canal de YouTube');
  assert.equal(r.seguros.find((k) => k.red === 'tiktok')?.ref, 'denborg', 'el que estaba escrito en los datos de la página');
  assert.equal(r.web, 'https://denborg.com/curso', 'su web de verdad, no beacons ni el CDN');
  assert.equal(cuenta.paginas, 1);
  assert.equal(cuenta.google, 0, 'nada de Google: todo salió de lo que él enlaza');
  assert.equal(cuenta.perfiles, 0, 'nada de leer perfiles de Instagram: ya lo tiene');
});

test('2. sin enlaces, su MISMO usuario en YouTube con su nombre entra solo, y tampoco hay Google', async () => {
  const { deps, cuenta } = dobles({
    textoPropio: async () => 'Creador de contenido',
    canales: { '@denborgg': { nombre: 'Den Borg', texto: '', foto: null } },
  });
  const r = await cadenaDeRedes({ ...DEN, landing_url: null }, deps);
  assert.ok(r.ok);
  assert.equal(r.seguros.find((k) => k.red === 'youtube')?.ref, '@denborgg');
  assert.equal(r.seguros[0]?.porque, 'Mismo usuario y mismo nombre');
  assert.deepEqual(cuenta.canales.sort(), ['@den.borgg', '@denborgg'], 'se prueban las dos formas de su @');
  assert.equal(cuenta.paginas, 0);
  assert.equal(cuenta.google, 0, 'con Instagram y YouTube seguros no se busca más (TikTok sale si aparece, no se busca solo)');
  assert.equal(r.web, null);
});

test('3. el mismo usuario con otro nombre se pregunta, y ahí sí se busca en Google', async () => {
  const videos: string[][] = [];
  const { deps, cuenta } = dobles({
    textoPropio: async () => 'Creador',
    canales: { '@denborgg': { nombre: 'Dennis Borgström Gaming', texto: '', foto: null } },
    hashDeFoto: async () => null,
    googlear: async () => [{ organicResults: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Un video de Den Borg' }] }],
    canalesDeVideos: async (ids) => { videos.push(ids); return [{ id: 'UCbbbbbbbbbbbbbbbbbbbbbb', nombre: 'Den Borg' }]; },
  });
  const r = await cadenaDeRedes({ ...DEN, landing_url: null }, deps);
  assert.ok(r.ok);
  assert.ok(r.candidatos.some((k) => k.ref === '@denborgg' && k.porque === 'Mismo usuario'), 'el @ solo se pregunta');
  assert.deepEqual(videos[0], ['dQw4w9WgXcQ'], 'el video que trae Google lleva a su canal');
  assert.ok([...r.candidatos, ...r.seguros].some((k) => k.ref === 'UCbbbbbbbbbbbbbbbbbbbbbb'));
  assert.equal(cuenta.perfiles, 0);
});

test('4. sin la clave de Spy, lo encontrado gratis sale igual; sin nada, se dice', async () => {
  const conAlgo = await cadenaDeRedes(DEN, dobles({ googlear: null, canales: { '@denborg': { nombre: 'Den Borg', texto: '', foto: null } } }).deps);
  assert.ok(conAlgo.ok && conAlgo.web === 'https://denborg.com/curso');
  const sinNada = await cadenaDeRedes({ ...DEN, landing_url: null }, dobles({ googlear: null, textoPropio: async () => '' }).deps);
  assert.equal(sinNada.ok, false);
  assert.match(sinNada.ok ? '' : sinNada.error, /clave de Apify/);
});

test('5. con sus tres redes y su web puestas, no se pide nada', async () => {
  const { deps, cuenta } = dobles();
  const r = await cadenaDeRedes({ ...DEN, youtube_id: '@denborg', tiktok: 'denborg', landing_url: 'https://denborg.com' }, deps);
  assert.deepEqual(r, { ok: true, seguros: [], candidatos: [], web: null });
  assert.deepEqual(cuenta, { google: 0, perfiles: 0, paginas: 0, canales: [], videos: 0 });
});

test('6. las reglas: enlaces de una página, su web, la página de enlaces y el aviso de la traída', () => {
  const enlaces = enlacesDeHtml(BEACONS, 'https://beacons.page/denborg');
  assert.ok(enlaces.includes('https://www.tiktok.com/@denborg'), 'el enlace escrito en sus datos');
  assert.ok(enlaces.includes('https://www.instagram.com/den.borgg'));
  const l = loQueEnlaza(enlaces);
  assert.equal(l.web, 'https://denborg.com/curso', 'ni el CDN de beacons ni una imagen son su web');
  assert.deepEqual(l.redes.map((r) => r.red).sort(), ['instagram', 'tiktok', 'youtube']);
  assert.equal(loQueEnlaza(['https://cdn.acme.com/a.js', 'https://linktr.ee/x', 'https://acme.com/logo.png']).web, null);
  assert.ok(esAgregador('https://beacons.page/denborg') && esAgregador('linktr.ee/den') && !esAgregador('https://denborg.com'));
  assert.equal(canalDeLaBio({ campo: 'landing_url', valor: 'https://beacons.page/denborg' }, 'instagram'), null, 'su página de enlaces no es su web');
  assert.deepEqual(canalDeLaBio({ campo: 'landing_url', valor: 'https://denborg.com' }, 'instagram'), { campo: 'landing_url', valor: 'https://denborg.com' });
  assert.deepEqual(usuariosParaProbar({ instagram: 'den.borgg', youtube_id: null }), { youtube: ['@den.borgg', '@denborgg'], instagram: [] });
  assert.deepEqual(usuariosParaProbar({ instagram: null, youtube_id: '@Victor-Heras' }).instagram, ['victor-heras'.replace(/-/g, '')]);
  assert.equal(veredictoDe({ enlaza: false, mismoUsuario: true, mismoNombre: false, distanciaFoto: null }), 'quizas', 'el mismo @ solo se pregunta');
  assert.equal(veredictoDe({ enlaza: false, mismoUsuario: true, mismoNombre: true, distanciaFoto: null }), 'es');
  assert.equal(avisoDeTraida(undefined), null);
  assert.equal(avisoDeTraida('sin-clave'), 'Conecta Apify para traer todo lo que publica.');
  assert.match(avisoDeTraida('Apify no trajo sus publicaciones: vuelvo a intentar mañana') ?? '', /^No traje todo lo que publicó\./);
});

test('7. una corrida larga que termina sin nada no cuenta como la de la semana', () => {
  const fuente = readFileSync(fileURLToPath(new URL('../lib/spy-todo.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  const vacia = fuente.indexOf('if (!trajo) {');
  const hecha = fuente.indexOf("await anotar(c.id, canal, { ultima: new Date().toISOString() });");
  assert.ok(vacia > 0, 'la rama de la corrida vacía');
  assert.ok(hecha > vacia, 'se anota como hecha DESPUÉS de mirar si trajo algo');
  assert.match(fuente.slice(vacia, hecha), /6 \* 86_400_000/, 'y se vuelve a pedir mañana, no en una semana');
});

test('8. el tope de corridas largas del día vive en la base, no en la memoria del proceso (el cron cae en instancias nuevas)', () => {
  assert.equal(usadasHoy(null, '2026-11-04'), 0);
  assert.equal(usadasHoy(JSON.stringify({ fecha: '2026-11-04', usadas: 4 }), '2026-11-04'), 4);
  assert.equal(usadasHoy(JSON.stringify({ fecha: '2026-11-03', usadas: 6 }), '2026-11-04'), 0, 'otro día empieza de cero');
  assert.equal(usadasHoy('no es json', '2026-11-04'), 0);
  const src = readFileSync(fileURLToPath(new URL('../lib/spy-todo.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  const codigo = src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(codigo, /new Map<string, number>\(\)/, 'un contador en memoria arranca en cero en cada instancia');
  const paso = codigo.slice(codigo.indexOf('async function pasoDeCanal'), codigo.indexOf('export async function avanzarTodo'));
  assert.ok(paso.length > 200);
  assert.match(paso, /if \(!\(await reservarCorrida\(\)\)\) return \{[^}]*porque: 'limite' \}/, 'antes de empezar una corrida se reserva en la base');
  // 5/11/2026 (varias claves de Apify): la corrida se empieza con `conLaPrimeraConCredito` (la primera clave con crédito).
  const gasta = paso.indexOf('await conLaPrimeraConCredito(');
  assert.ok(gasta > 0 && paso.indexOf('reservarCorrida()') < gasta, 'se reserva ANTES de gastar');
  const reservar = codigo.slice(codigo.indexOf('async function reservarCorrida'), codigo.indexOf('async function creditoDelMes'));
  // Desde el 4/11 la misma reserva cuenta también los guiones de los reels (otra clave, otro tope): lo que cuida es que el
  // tope de las corridas largas siga siendo `CLAVE_DIA` por defecto y que la cuenta sea compare-and-set en la base.
  assert.match(reservar, /async function reservarCorrida\(clave = CLAVE_DIA, tope = CORRIDAS_LARGAS_POR_DIA\)/, 'por defecto, las corridas largas');
  assert.match(reservar, /getSettingEstricto\(clave\)/, 'lee la cuenta de la base');
  assert.match(reservar, /cambiarSettingSi\(clave, crudo,/, 'compare-and-set: de dos que compiten por la última, gana una');
});
