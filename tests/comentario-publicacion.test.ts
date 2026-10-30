// =============================================================================
// Elegir la publicación o el Reel del CRON de comentario (ticket #25 de Leandro, Fiesta Music, 29/10/2026)
// =============================================================================
// Leandro: «que el flujo arranque solo cuando el comentario contiene una palabra… y, si se puede, elegir en qué publicación
// o Reel». Las palabras clave ya estaban (#17); esto es la publicación (lib/publicacion-cron.ts). Fija:
//   1. por la ENTRADA REAL (el webhook de Zernio y el motor de verdad, tests/_boton-vuelve-hijo.ts 'publicacion'): con la
//      palabra en OTRA publicación no nace el lead ni sale nada; en la elegida, entra y le llega el DM. La publicación vive
//      en el PRIMER CRON, que se rearma de las columnas (`disparadoresDe`: la trampa del #17);
//   2. el selector lee las últimas de la cuenta (GET /v1/accounts/{id}/posts), la más nueva primero;
//   3. MaKo con el LINK de un Reel lo encuentra (también con «?igsh=», sin «www.» y como «/p/») y lo guarda con su id y su
//      nombre; un link que no es de la cuenta lo dice;
//   4. la regla, la firma, la higiene (sólo «comenta tu publicación»), la tarjeta, el editor, la API corta y /docs.
//
// Correr: node --import tsx --test tests/comentario-publicacion.test.ts
// ROTURAS: al final.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sanearPublicacion, publicacionDispara, publicacionesDeZernio, juntarPublicaciones, buscarPublicacion, textoDePublicacion, rotuloDePublicacion,
  type PublicacionDeLaCuenta,
} from '../lib/publicacion-cron';
import { disparadoresDe, sanearDisparador, firmaDisparador, disparaPorEvento, textoDeDisparador, type Disparador } from '../lib/disparadores';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

type Paso = { llego: string[]; zernio: string[]; insc: string[]; leads?: number; lista?: PublicacionDeLaCuenta[]; conLink?: Record<string, unknown>; linkAjeno?: Record<string, unknown>; consultasPublicaciones?: string[] };
let salida: { pasos: Record<string, Paso>; otros: string[] } | null = null;
const correr = () => {
  if (!salida) {
    const out = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx',
      join(RAIZ, 'tests/_boton-vuelve-hijo.ts'), 'publicacion'], { cwd: RAIZ, encoding: 'utf8', timeout: 150_000, maxBuffer: 32 * 1024 * 1024 });
    const i = out.lastIndexOf('@@R@@');
    assert.ok(i >= 0, `el hijo no terminó: ${out.slice(-1500)}`);
    salida = JSON.parse(out.slice(i + 5).trim());
  }
  return salida!;
};

test('1. por el webhook de verdad: la palabra en OTRA publicación no hace nada; en la elegida, entra y le llega el DM', () => {
  const { pasos: p, otros } = correr();
  assert.deepEqual(otros, [], 'nada sale a la red real');
  assert.equal(p['1_otra_publicacion'].leads, 0, 'no nace el lead de quien comentó otra publicación');
  assert.deepEqual(p['1_otra_publicacion'].insc, []);
  assert.deepEqual(p['1_otra_publicacion'].zernio, [], 'no sale nada');
  assert.equal(p['2_la_elegida'].leads, 1);
  assert.deepEqual(p['2_la_elegida'].insc, ['activa nodo=m1']);
  assert.ok(p['2_la_elegida'].zernio.some((z) => z.startsWith('entregado POST /inbox/comments/p_reel_guia/k2/private-reply')), 'la respuesta privada, a ESE comentario');
});

test('2. el selector: las últimas publicaciones de la cuenta, la más nueva primero, con su texto en una línea', () => {
  const p = correr().pasos['3_lista_y_api'];
  assert.deepEqual(p.lista!.map((x) => x.id), ['p_reel_2', 'p_reel_guia', 'p_foto_vieja']);
  assert.equal(p.lista![1].texto, 'Te dejo la guía de la fiesta 🎉 Comenta GUIA y te la mando');
  assert.ok(p.consultasPublicaciones!.every((c) => c === 'acc_10'), 'con la cuenta del negocio');
  assert.equal(rotuloDePublicacion(p.lista![0]), '29/10 · Reel · Segundo reel');
  assert.equal(rotuloDePublicacion(p.lista![2]), '01/09 · Publicación · Sin texto');
});

test('3. MaKo con el LINK de un Reel: lo encuentra y lo guarda con su id y su nombre; uno ajeno, lo dice', () => {
  const p = correr().pasos['3_lista_y_api'];
  const payload = p.conLink!.payload as { crons: Disparador[] };
  assert.deepEqual(payload.crons[0].publicacion, { id: 'p_reel_2', texto: 'Segundo reel' });
  assert.match(String(p.conLink!.resumen), /El usuario comenta tu publicación o Reel «Segundo reel» con «pruebafm»/, 'el resumen que se confirma dice cuál');
  assert.match(String(p.linkAjeno!.error), /No encontré esa publicación/);
  // Las formas del mismo link: con «www.» o sin, con «?igsh=», y la misma publicación como «/p/» en vez de «/reel/».
  const lista: PublicacionDeLaCuenta[] = [{ id: '1789', texto: '', fecha: null, link: 'https://www.instagram.com/reel/AbC_1-2/', imagen: null, tipo: 'reels' }];
  for (const v of ['https://instagram.com/reel/AbC_1-2', 'https://www.instagram.com/p/AbC_1-2/?igsh=x', 'https://www.instagram.com/fiestamusic/reel/AbC_1-2/', '1789']) {
    assert.equal(buscarPublicacion(v, lista)?.id, '1789', v);
  }
  assert.equal(buscarPublicacion('https://www.instagram.com/reel/OTRO/', lista), null);
});

test('4. la regla: sin elegir, cualquiera; con una, sólo ésa, y un comentario que no dice de cuál, ninguno', () => {
  assert.equal(publicacionDispara(null, 'p1'), true);
  assert.equal(publicacionDispara({ id: 'p1' }, 'p1'), true);
  assert.equal(publicacionDispara({ id: 'p1' }, 'p2'), false);
  assert.equal(publicacionDispara({ id: 'p1' }, null), false, 'sin saber de qué publicación es, no cae en «entonces todos»');
  const d: Disparador = { id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario', publicacion: { id: 'p1' } };
  assert.equal(disparaPorEvento(d, 'instagram', { subtipo: 'comentario', texto: 'hola', publicacion: 'p1' }), true);
  assert.equal(disparaPorEvento(d, 'instagram', { subtipo: 'comentario', texto: 'hola', publicacion: 'p2' }), false);
  // Con las palabras clave también: las dos tienen que darse.
  const conPalabra: Disparador = { ...d, palabras: ['guia'] };
  assert.equal(disparaPorEvento(conPalabra, 'instagram', { subtipo: 'comentario', texto: 'la guía!', publicacion: 'p1' }), true);
  assert.equal(disparaPorEvento(conPalabra, 'instagram', { subtipo: 'comentario', texto: 'hola', publicacion: 'p1' }), false);
});

test('5. el dato: sólo en «comenta tu publicación», sobrevive al primer CRON rearmado, cambia la firma y la tarjeta dice cuál', () => {
  assert.deepEqual(sanearPublicacion(' 17841 '), { id: '17841' });
  assert.deepEqual(sanearPublicacion({ id: '1_2', texto: '  Te dejo\nla guía ' }), { id: '1_2', texto: 'Te dejo la guía' });
  assert.equal(sanearPublicacion('https://instagram.com/reel/x/'), null, 'un link sin resolver no es un id');
  assert.equal(sanearPublicacion(''), null);
  // La higiene: en un DM o en un En vivo no hay publicación que elegir.
  assert.equal(sanearDisparador({ trigger_tipo: 'instagram', subtipo: 'dm', publicacion: { id: 'p1' } })?.publicacion, undefined);
  assert.equal(sanearDisparador({ trigger_tipo: 'instagram', subtipo: 'en_vivo', publicacion: { id: 'p1' } })?.publicacion, undefined);
  assert.deepEqual(sanearDisparador({ trigger_tipo: 'messenger', subtipo: 'comentario', publicacion: { id: '12_34' } })?.publicacion, { id: '12_34' });
  // ⚠️ LA TRAMPA DEL #17: el primer CRON se rearma de las COLUMNAS, que no tienen la publicación.
  const fila = { trigger_tipo: 'instagram', etapa: 'x', disparadores: [{ id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario', publicacion: { id: 'p1', texto: 'La guía' } }] };
  assert.deepEqual(disparadoresDe(fila)[0].publicacion, { id: 'p1', texto: 'La guía' });
  // La firma: la de la guía no es el mismo CRON que cualquier publicación; el nombre no cuenta.
  const base: Disparador = { id: 'd1', trigger_tipo: 'instagram', subtipo: 'comentario' };
  assert.notEqual(firmaDisparador({ ...base, publicacion: { id: 'p1' } }), firmaDisparador(base));
  assert.equal(firmaDisparador({ ...base, publicacion: { id: 'p1', texto: 'a' } }), firmaDisparador({ ...base, publicacion: { id: 'p1', texto: 'b' } }));
  // La tarjeta del lienzo.
  const nombres = { deSiempre: () => '' } as unknown as Parameters<typeof textoDeDisparador>[1];
  assert.equal(textoDeDisparador({ ...base, publicacion: { id: 'p1', texto: 'Te dejo la guía' }, palabras: ['guia'] }, nombres),
    'El usuario comenta tu publicación o Reel «Te dejo la guía» con «guia»');
  assert.equal(textoDePublicacion({ id: 'p1' }), 'una publicación elegida');
  assert.deepEqual(publicacionesDeZernio({ posts: [{ id: 'bad id!' }, { id: '9', message: 'x', mediaType: 'VIDEO' }] }).map((x) => x.id), ['9']);
  assert.deepEqual(juntarPublicaciones([[{ id: 'a', texto: '', fecha: '2026-01-01', link: null, imagen: null, tipo: null }], [{ id: 'a', texto: '', fecha: '2026-01-01', link: null, imagen: null, tipo: null }]]).length, 1);
});

test('6. el editor, el webhook, la API (corta: el presupuesto del turno) y /docs', () => {
  const ed = leer('app/automations/EditorDisparadores.tsx');
  assert.match(ed, /\{conPublicacion\(d\.trigger_tipo, d\.subtipo\) && \(\s*<PublicacionDelCron /);
  assert.match(ed, /fetch\(`\/api\/chat-agent\/secuencias\?publicaciones=\$\{red\}`/);
  assert.match(ed, /\{ value: '', label: 'Cualquier publicación' \}/);
  assert.ok(ed.indexOf('<PublicacionDelCron ') < ed.indexOf('<PalabrasClave '), 'primero la publicación, después las palabras (como ManyChat)');
  assert.match(leer('app/api/chat-agent/secuencias/route.ts'), /const publicaciones = await publicacionesParaElCron\(red\);/);
  // El webhook le pasa al motor DE QUÉ publicación es el comentario, en los dos lugares que deciden.
  const ruta = leer('app/api/webhooks/zernio/route.ts');
  assert.match(ruta, /dispararEventoSocial\(leadId, canal, subtipo, ev\.evento\.texto, ev\.evento\.postId\)/);
  assert.match(leer('lib/zernio-entrante.ts'), /if \(!\(await hayQuienEscuche\(e\.canal, e\.subtipo, e\.texto, e\.postId\)\)\)/);
  // La API de MaKo: el campo, CORTO (una descripción larga saca herramientas del presupuesto del turno, #29).
  const def = leer('lib/api-mako/areas/chatbot.def.ts');
  const campo = /\{ nombre: 'publicacion', tipo: 'string', max: 300, descripcion: '([^']+)' \}/.exec(def);
  assert.ok(campo && campo[1].length <= 90, `la descripción de «publicacion» es corta (${campo?.[1].length})`);
  assert.match(leer('lib/api-mako/areas/chatbot.run.ts'), /const resueltos = await resolverPublicaciones\(input\.crons\);/);
  // /docs: la guía lo explica.
  const art = leer('app/api-mako/Articulos.tsx');
  assert.match(art, /<h3 id="publicacion">En qué publicación<\/h3>/);
  assert.match(art, /Un comentario en otra publicación no arranca nada, aunque tenga la palabra clave\./);
});

// ROTURAS (29/10/2026, una por vez, restaurando byte a byte; base 6 / 0):
//   el motor no mira la publicación → 4 / 2 · el primer CRON rearmado la pierde (la trampa del #17) → 4 / 2 ·
//   la higiene la tira → 3 / 3 · la firma no la mira → 4 / 2 · el webhook no la pasa al motor → 4 / 2 ·
//   el lead nace sin mirarla → 4 / 2 · sin saber la publicación, dispara igual → 5 / 1 ·
//   el link comparado entero, sin el código → 5 / 1 · la API sin resolver el link → 5 / 1.
