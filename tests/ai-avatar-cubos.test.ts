// AI Avatar › Personaje en cubos (19/11/2026, docs/editor-video/ai-avatar-por-codigo.md): lo puro del video animado por código
// (los tiempos de la voz, la voz lista, el personaje, los formatos y sus datos, el interruptor) y el contrato de las plantillas
// de public/avatar-cubos. La réplica cuadro por cuadro contra la galería NO corre acá (necesita Chromium y la galería):
// scripts/avatar-cubos/replica.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { palabrasDeLetras, tiemposDeEscenas, apretar, textoParaVoz, palabrasDelGuion, COLA_S, type Tiempos } from '../lib/ai-avatar/cubos-tiempos';
import { cortar, lufs, nivelar, LUFS_OBJETIVO } from '../lib/ai-avatar/cubos-audio';
import { FORMATOS_CUBOS, normalizarGuion, normalizarDatos, datosAutomaticos, frasesDeTexto, leerMarcas, datosDeMarcas, textoConMarcas, MAX_PALABRAS } from '../lib/ai-avatar/cubos-formatos';
import { normalizarPersonaje, resolverPersonaje, PERSONAJE_MARTIN } from '../lib/ai-avatar/cubos-personaje';
import { veAvatarCubos, PARA_TODOS } from '../lib/ai-avatar/cubos-interruptor';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

test('las letras de /with-timestamps pasan a palabras con el inicio de la primera y el fin de la última', () => {
  const texto = 'Hola Máko, ¿sí?';
  const characters = [...texto];
  const ini = characters.map((_, i) => i * 0.1), fin = characters.map((_, i) => i * 0.1 + 0.08);
  const w = palabrasDeLetras({ characters, character_start_times_seconds: ini, character_end_times_seconds: fin });
  assert.deepEqual(w.map((x) => x.text), ['Hola', 'Máko,', '¿sí?']);
  assert.equal(w[1].start, 0.5);
  assert.equal(Math.round(w[1].end * 100) / 100, 0.98);
});

test('las palabras se reparten en las escenas por cantidad, con 1,4 s de cola; si no calzan, null', () => {
  const escenas = [{ id: 's1', texto: 'Hay una sola cosa.' }, { id: 's2', texto: 'Es la oferta.' }];
  const pal = ['Hay', 'una', 'sola', 'cosa.', 'Es', 'la', 'oferta.'].map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.3 }));
  const t = tiemposDeEscenas(escenas, pal)!;
  assert.equal(t.anchors.s1, 0);
  assert.equal(t.anchors.s2, 1.6);
  assert.equal(t.anchors.end, Math.round((2.4 + 0.3 + COLA_S) * 1000) / 1000);
  assert.deepEqual(t.words[4], ['Es', 1.6, 1.9, 's2']);
  assert.equal(tiemposDeEscenas(escenas, pal.slice(0, 6)), null, 'una palabra de menos no se dibuja corrida');
});

test('apretar deja las pausas en 0,3 s y corre todo lo que viene después (tools/apretar.py de la galería)', () => {
  const t: Tiempos = { anchors: { s1: 0, s2: 1.5, end: 3.4 }, words: [['Uno', 0, 0.4, 's1'], ['dos.', 0.5, 0.9, 's1'], ['Tres', 1.5, 2, 's2']] };
  const r = apretar(t);
  assert.deepEqual(r.cortes, [[1.05, 1.35]]);
  assert.equal(r.tiempos.words[2][1], 1.2);
  assert.equal(r.tiempos.anchors.s2, 1.2);
  assert.equal(r.tiempos.anchors.end, Math.round((1.7 + 1.4) * 1000) / 1000, 'la cola se mantiene');
  assert.equal(r.tiempos.words[1][1], 0.5, 'antes del corte nada se mueve');
});

test('la voz: el corte saca esas muestras y el nivel lleva un tono a -14 LUFS sin pasar -1 dB de pico', () => {
  const sr = 48_000;
  const tono = new Float32Array(sr * 3).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 997 * i) / sr));
  // un seno de 997 Hz a pico 1 da -3,01 LUFS (BS.1770): a pico 0,5, -9,03
  assert.ok(Math.abs(lufs([tono], sr) - -9.03) < 0.15, `dio ${lufs([tono], sr)}`);
  const [cortado] = cortar([tono], sr, [[1, 2]]);
  assert.equal(cortado.length, sr * 2);
  const [nivel] = nivelar([new Float32Array(sr * 3).map((_, i) => 0.05 * Math.sin((2 * Math.PI * 997 * i) / sr))], sr);
  assert.ok(Math.abs(lufs([nivel], sr) - LUFS_OBJETIVO) < 0.15, `quedó en ${lufs([nivel], sr)}`);
  const [fuerte] = nivelar([tono], sr);
  let pico = 0; for (const v of fuerte) pico = Math.max(pico, Math.abs(v));   // sin «...»: 144.000 argumentos tiran RangeError
  assert.ok(pico <= Math.pow(10, -1 / 20) + 1e-6, 'el pico no pasa de -1 dB');
});

test('el texto de la voz dice «Máko» con tilde (así se pronuncia) y cuenta las palabras del guion', () => {
  const e = [{ id: 's1', texto: 'Prueba MaKo hoy.' }, { id: 's2', texto: 'Siete días.' }];
  assert.equal(textoParaVoz(e), 'Prueba Máko hoy. Siete días.');
  assert.equal(palabrasDelGuion(e), 5);
});

test('el guion: frases a escenas s1…sN, con tope de palabras y de frases', () => {
  const g = normalizarGuion(frasesDeTexto('  Uno dos.\n\nTres cuatro.  '));
  assert.ok(g.ok);
  if (g.ok) assert.deepEqual(g.escenas, [{ id: 's1', texto: 'Uno dos.' }, { id: 's2', texto: 'Tres cuatro.' }]);
  assert.equal(normalizarGuion([]).ok, false);
  const largo = normalizarGuion(Array.from({ length: 6 }, () => Array.from({ length: Math.ceil((MAX_PALABRAS + 1) / 6) }, () => 'voz').join(' ')));
  assert.equal(largo.ok, false, 'más palabras que el tope');
  const frase = normalizarGuion([Array.from({ length: 30 }, () => 'palabra').join(' ')]);
  assert.equal(frase.ok, false, 'una frase de más de 160 letras se avisa, no se corta en silencio');
  assert.equal(normalizarGuion(Array.from({ length: 9 }, () => 'Hola.')).ok, false);
});

test('los datos de un formato se validan contra SU guion: nada que el guion no diga', () => {
  const esc = [{ id: 's1', texto: 'Vender es terrible.' }, { id: 's2', texto: 'Prueba Máko gratis.' }];
  const p = normalizarDatos('punch-captions', { claves: ['terrible', 'inventada', 'Máko'], marca: 'Mi Negocio' }, esc, 'X');
  assert.deepEqual(p.claves, ['terrible', 'mako']);
  assert.equal(p.marca, 'Mi Negocio');
  const k = normalizarDatos('karaoke-subs', { golpes: [{ escena: 's1', palabra: 'terrible' }, { escena: 's1', palabra: 'gratis' }], trozos: [[[0, 1]], [[2]]] }, esc, 'Mi Negocio');
  assert.deepEqual(k.golpes, [{ escena: 's1', palabra: 'terrible' }]);
  assert.equal(k.trozos, undefined, 'unos trozos que no cubren todas las palabras se descartan');
  assert.equal(k.marca, 'Mi Negocio');
});

test('las *marcas* del guion: la persona elige qué resaltar, y lo que eligió la IA vuelve marcado (ida y vuelta)', () => {
  const txt = 'Hay una sola *cosa* que separa\n\nY no es el *precio.*\nEs la *high ticket*.';
  assert.deepEqual(frasesDeTexto(txt), ['Hay una sola cosa que separa', 'Y no es el precio.', 'Es la high ticket.']);
  assert.deepEqual(leerMarcas(txt), [{ escena: 's1', palabra: 'cosa' }, { escena: 's2', palabra: 'precio' }, { escena: 's3', palabra: 'high' }, { escena: 's3', palabra: 'ticket' }]);
  assert.deepEqual(datosDeMarcas('punch-captions', txt, 'X')?.claves, ['cosa', 'precio', 'high', 'ticket']);
  assert.deepEqual(datosDeMarcas('karaoke-subs', txt, 'X')?.golpes, [{ escena: 's1', palabra: 'cosa' }, { escena: 's2', palabra: 'precio' }]);
  assert.equal(datosDeMarcas('punch-captions', 'sin marcas', 'X'), null);
  // el ejemplo de la galería, marcado y leído de vuelta, da sus mismas palabras
  for (const f of FORMATOS_CUBOS) {
    const marcado = textoConMarcas(f.id, f.ejemplo.escenas.map((e) => e.texto), f.ejemplo.datos);
    assert.deepEqual(frasesDeTexto(marcado), f.ejemplo.escenas.map((e) => e.texto), `${f.id}: las marcas cambian el guion`);
    const d = datosDeMarcas(f.id, marcado, 'MaKo')!;
    if (f.id === 'punch-captions') assert.deepEqual([...d.claves!].sort(), [...f.ejemplo.datos.claves!].sort());
    else assert.deepEqual(d.golpes, f.ejemplo.datos.golpes);
  }
  assert.match(textoConMarcas('punch-captions', ['Es la oferta.'], { marca: 'X', claves: ['oferta'] }), /\*oferta\*\.$/, 'la puntuación queda afuera');
});

test('los datos sin IA (cero MaKo Tokens): la palabra fuerte de cada frase', () => {
  const esc = [{ id: 's1', texto: 'La primera semana es terrible.' }, { id: 's2', texto: 'Nadie contesta tus mensajes.' }, { id: 's3', texto: 'Prueba Acme hoy.' }];
  assert.deepEqual(datosAutomaticos('punch-captions', esc, 'Acme').claves, ['terrible', 'mensajes', 'acme']);
  assert.deepEqual(datosAutomaticos('karaoke-subs', esc, 'Acme').golpes, [{ escena: 's1', palabra: 'terrible' }, { escena: 's3', palabra: 'acme' }]);
});

test('el ejemplo de cada formato es el video de la galería y sus datos son válidos contra su guion', () => {
  for (const f of FORMATOS_CUBOS) {
    const d = normalizarDatos(f.id, f.ejemplo.datos, f.ejemplo.escenas, 'MaKo');
    assert.deepEqual(d, f.ejemplo.datos, `${f.id}: el ejemplo no pasa su propia validación`);
    assert.ok(existsSync(join(RAIZ, 'public', f.pagina)), `${f.id}: falta la plantilla`);
    assert.ok(existsSync(join(RAIZ, 'public', f.poster)), `${f.id}: falta el póster`);
    assert.ok(existsSync(join(RAIZ, 'public/avatar-cubos/ejemplos', `${f.id}.js`)), `${f.id}: faltan los tiempos del ejemplo`);
  }
});

test('el personaje: sin datos es el Martín de la galería, color por color; lo que no está en la lista no entra', () => {
  const r = resolverPersonaje(PERSONAJE_MARTIN);
  assert.deepEqual([r.skin, r.hair, r.tee, r.iris, r.brow, r.peinado], ['#e8a682', '#b4471a', '#1c1c23', '#4a2a14', '#3a1d10', 'rulos']);
  const n = normalizarPersonaje({ piel: 'morena', pelo: '#ff00ff', peinado: 'mohicano', anteojos: 'sí', barba: true });
  assert.deepEqual(n, { ...PERSONAJE_MARTIN, piel: 'morena', barba: true });
  // la plantilla trae esos MISMOS colores por defecto (public/avatar-cubos/kit/toma.js)
  const toma = leer('public/avatar-cubos/kit/toma.js');
  for (const [k, v] of [['skin', '0xe8a682'], ['hair', '0xb4471a'], ['tee', '0x1c1c23'], ['iris', '0x4a2a14']]) assert.ok(toma.includes(`hx(P.${k}, ${v})`), `toma.js: ${k}`);
});

test('el interruptor: sólo la revisión de Martín (sus cuentas y el ws 3), hasta que se prenda para todos', () => {
  assert.equal(PARA_TODOS, false);
  assert.equal(veAvatarCubos({ email: 'MartinKoncke@gmail.com', ws: 1 }), true);
  assert.equal(veAvatarCubos({ email: 'cliente@x.com', ws: 3 }), true);
  assert.equal(veAvatarCubos({ email: 'cliente@x.com', ws: 1 }), false);
  assert.equal(veAvatarCubos({ email: null, ws: null }), false);
});

test('las plantillas: los datos se leen ANTES del kit, el texto de la persona entra escapado y el iframe se puede enmarcar', () => {
  for (const f of FORMATOS_CUBOS) {
    const h = leer(join('public', f.pagina));
    const orden = ['ejemplos/', 'kit/datos.js', 'kit/kit.js', 'kit/toma.js', 'kit/rasterizar.js'].map((s) => h.indexOf('<script src="' + s));
    assert.ok(orden.every((x, i) => x > 0 && (i === 0 || x > orden[i - 1])), `${f.id}: el orden de los scripts es ${orden}`);
    assert.ok(/KIT\.esc\(MARCA\)/.test(h), `${f.id}: la marca entra sin escapar`);
  }
  const kit = leer('public/avatar-cubos/kit/kit.js');
  assert.ok(kit.includes("'>' + esc(t) + '</span>'") && kit.includes('esc(ver(W[i][0]))'), 'kit.js: los subtítulos escapan las palabras');
  const cfg = leer('next.config.ts');
  assert.match(cfg, /source: '\/avatar-cubos\/:path\*',\s*headers: \[\s*\{ key: 'X-Frame-Options', value: 'SAMEORIGIN' \}/);
  assert.ok(cfg.indexOf("'/avatar-cubos/:path*'") > cfg.indexOf("{ key: 'X-Frame-Options', value: 'DENY' }"), 'el bloque de avatar-cubos tiene que ir DESPUÉS del DENY global');
});

test('AI Avatar abre el personaje en cubos sólo con el permiso que decide el server', () => {
  const est = leer('app/ai-avatar/Estudio.tsx');
  assert.ok(est.includes("...(veCubos ? [{ id: ID_CUBOS"), 'la tarjeta de «Nuevo avatar» va sólo con veCubos');
  assert.ok(est.includes('onCubos={veCubos ?'), '«Crear influencer» se activa sólo con veCubos');
  assert.ok(est.includes('veCubos && cubosInicial'), '?cubos=1 no abre nada sin veCubos');
  const page = leer('app/ai-avatar/page.tsx');
  assert.ok(page.includes('veAvatarCubos({ email: sesion.email'), 'la página decide con la sesión');
  const acciones = leer('app/ai-avatar/cubos/actions.ts');
  const exportadas = acciones.match(/export async function \w+/g) ?? [];
  const conPuerta = acciones.split('export async function').slice(1).filter((cuerpo) => /const g = await puerta\(/.test(cuerpo.slice(0, 400)));
  assert.equal(conPuerta.length, exportadas.length, 'cada action pasa por la puerta (interruptor y candado)');
});
