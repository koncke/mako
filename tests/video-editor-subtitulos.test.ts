// =============================================================================
// Subtítulos automáticos y Texto a voz del Video Editor (paquete K, 11/10/2026)
// =============================================================================
// Lo que se puede romper sin que se vea hasta que un cliente lo usa:
//
//   1. CÓMO SE CORTAN los subtítulos. Antes (OpenCut) iban en tandas fijas de 3
//      palabras con el tiempo de la frase repartido en partes iguales: cambiaban
//      a destiempo de la voz. Ahora cortan en la pausa, al terminar la oración y
//      por largo, sin dejar un artículo colgando.
//   2. LAS MULETILLAS: «eh» se va siempre; «este» sólo cuando SUENA a muletilla
//      («este,» o con pausa a los dos lados). «Este producto» no se toca.
//   3. LA NO-VOZ de Whisper («[Música]», «♪», «Subtítulos realizados por la
//      comunidad de Amara.org») no llega a la pantalla.
//   4. LOS TROZOS del audio se cortan en el silencio y los de silencio se saltan
//      (es sobre silencio que Whisper inventa texto).
//   5. LRC, el tercer formato de «Importar subtítulos».
//   6. TEXTO A VOZ con la key DEL CLIENTE y sin reintento: la ruta no puede leer
//      la key de la plataforma ni volver a llamar a ElevenLabs.
//
// Correr: node --import tsx --test tests/video-editor-subtitulos.test.ts
// PROBADO ROMPIÉNDOLO (11/10/2026, de a una y restaurando):
//   R1 `armarSubtitulos` sin el corte por pausa                       → 8/1 (de 9)
//   R2 `NO_CIERRAN` vacío (el artículo queda colgando)                → 8/1 (de 9)
//   R3 «este» en SONIDOS (se saca siempre, también «este producto»)   → 8/1 (de 9)
//   R4 `quitarNoVoz` sin las marcas entre corchetes                   → 8/1 (de 9)
//   R5 `RMS_SILENCIO` = 0 (los trozos en silencio van a Whisper)      → 8/1 (de 9)
//   R6 la ruta leyendo la key con `credWs`                            → 8/1 (de 9)
// ⚠️ R5 dio VERDE con la primera versión del test («ningún trozo EMPIEZA después
// de los 50,5 s»): el corte caía a los 50,02 s, justo al entrar al silencio, y el
// trozo mudo empezaba ANTES del límite. Ahora se mide lo que importa: que ningún
// trozo sea puro silencio.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	armarSubtitulos,
	dividirTextoEnSubtitulos,
	quitarNoVoz,
	repartirPorLargo,
} from '../app/video-editor/_opencut/transcription/caption';
import { quitarMuletillas } from '../app/video-editor/_opencut/transcription/muletillas';
import { trocearAudio } from '../app/video-editor/_opencut/transcription/audio';
import { parseLrc } from '../app/video-editor/_opencut/subtitles/lrc';
import type { PalabraTranscrita } from '../app/video-editor/_opencut/transcription/types';

const RAIZ = join(import.meta.dirname, '..');

/** Palabras seguidas, de 0,3 s cada una; `|` mete una pausa de 0,8 s. */
function hablar(frase: string, desde = 0): PalabraTranscrita[] {
	const salida: PalabraTranscrita[] = [];
	let t = desde;
	for (const w of frase.split(' ')) {
		if (w === '|') {
			t += 0.8;
			continue;
		}
		salida.push({ texto: w, inicio: t, fin: t + 0.3 });
		t += 0.3;
	}
	return salida;
}

const textos = (ps: { text: string }[]) => ps.map((p) => p.text);

test('los subtítulos cortan en la pausa y al terminar la oración, con el tiempo de sus palabras', () => {
	const subs = armarSubtitulos({
		palabras: hablar('Hola a todos. Hoy les muestro | el producto nuevo'),
		maxCaracteres: 42,
	});
	assert.deepEqual(textos(subs), ['Hola a todos.', 'Hoy les muestro', 'el producto nuevo']);
	// Cada uno arranca con su primera palabra (no repartido en partes iguales).
	assert.equal(subs[0].startTime, 0);
	assert.ok(Math.abs(subs[1].startTime - 0.9) < 1e-9);
	assert.ok(Math.abs(subs[2].startTime - (0.9 + 0.9 + 0.8)) < 1e-9);
	// Ninguno se pisa con el siguiente.
	for (let i = 1; i < subs.length; i++) {
		assert.ok(subs[i].startTime >= subs[i - 1].startTime + subs[i - 1].duration - 1e-9);
	}
});

test('por largo, sin dejar un artículo o una preposición colgando al final de la línea', () => {
	const subs = armarSubtitulos({
		palabras: hablar('Compramos todos los materiales de la mejor calidad para tu casa'),
		maxCaracteres: 28,
	});
	for (const s of subs) {
		assert.ok(s.text.length <= 28, `«${s.text}» se pasa del largo`);
		const ultima = s.text.split(' ').at(-1);
		assert.ok(!['de', 'la', 'los', 'para', 'tu'].includes(ultima ?? ''), `«${s.text}» termina colgando`);
	}
	assert.equal(textos(subs).join(' '), 'Compramos todos los materiales de la mejor calidad para tu casa');
});

test('«eh» se va siempre; «este» sólo cuando suena a muletilla', () => {
	const conMuletillas = hablar('Eh, este, compramos este producto nuevo');
	const { palabras, quitadas } = quitarMuletillas({ palabras: conMuletillas, idioma: 'es' });
	assert.equal(quitadas, 2);
	// La que empezaba la oración le pasa la mayúscula a la siguiente.
	assert.deepEqual(palabras.map((p) => p.texto), ['Compramos', 'este', 'producto', 'nuevo']);

	const oSea = quitarMuletillas({ palabras: hablar('lo hicimos, o sea, rápido'), idioma: 'es' });
	assert.deepEqual(oSea.palabras.map((p) => p.texto), ['lo', 'hicimos,', 'rápido']);
});

test('la no-voz de Whisper no llega a la pantalla', () => {
	const ps = [
		...hablar('[Música]'),
		...hablar('♪', 1),
		...hablar('Hola a todos', 2),
		...hablar('(risas)', 4),
	];
	assert.deepEqual(quitarNoVoz(ps).map((p) => p.texto), ['Hola', 'a', 'todos']);
	// Un paréntesis que no cierra era texto de verdad: vuelve.
	const abierto = hablar('(ver la descripción del video de hoy completo');
	assert.equal(quitarNoVoz(abierto).length, abierto.length);
	// La alucinación más conocida de Whisper en español, sobre silencio.
	const amara = armarSubtitulos({
		palabras: hablar('Subtítulos realizados por la comunidad de Amara.org'),
		maxCaracteres: 80,
	});
	assert.deepEqual(amara, []);
});

test('repartir una frase por largo: la palabra larga dura más que «a»', () => {
	const [a, larga] = repartirPorLargo({ texto: 'a extraordinariamente', inicio: 0, fin: 2 });
	assert.ok(larga.fin - larga.inicio > (a.fin - a.inicio) * 5);
	assert.equal(larga.fin, 2);
});

test('el audio se corta en el silencio y los trozos en silencio no van a Whisper', () => {
	const sr = 16000;
	// 70 s: voz (ruido) hasta 25 s, silencio 25–27 s, voz hasta 50 s, silencio al final.
	const muestras = new Float32Array(70 * sr);
	const voz = (desde: number, hasta: number) => {
		for (let i = desde * sr; i < hasta * sr; i++) muestras[i] = Math.sin(i * 0.3) * 0.2;
	};
	voz(0, 25);
	voz(27, 50);
	const trozos = trocearAudio({ muestras, sampleRate: sr });
	assert.ok(trozos.length >= 2, `${trozos.length} trozos`);
	for (const t of trozos) assert.ok((t.hasta - t.desde) / sr <= 30, 'un trozo de más de 30 s');
	// El primer corte cae en el silencio de 25–27 s, no a los 29,5 s en medio de la voz.
	const corte = trozos[0].hasta / sr;
	assert.ok(corte >= 25 && corte <= 27.2, `cortó a los ${corte} s`);
	// Los últimos 20 s son silencio: ningún trozo es puro silencio.
	const pico = (t: { desde: number; hasta: number }) =>
		muestras.subarray(t.desde, t.hasta).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
	assert.ok(trozos.every((t) => pico(t) > 0.05), 'mandó silencio a Whisper');
});

test('«Ingresar manualmente» divide el texto en subtítulos pegados desde el cabezal', () => {
	const subs = dividirTextoEnSubtitulos({
		texto: 'Primera oración del guion. Segunda oración un poco más larga que la primera.\nTercera.',
		inicio: 10,
		maxCaracteres: 32,
	});
	assert.equal(subs[0].startTime, 10);
	for (let i = 1; i < subs.length; i++) {
		assert.ok(Math.abs(subs[i].startTime - (subs[i - 1].startTime + subs[i - 1].duration)) < 1e-9);
		assert.ok(subs[i].duration >= 1);
	}
	assert.equal(subs.at(-1)?.text, 'Tercera.');
});

test('LRC: cada línea dura hasta la siguiente, con tope, y la cabecera no es subtítulo', () => {
	const r = parseLrc({
		input: ['[ar:Alguien]', '[00:01.50]Primera', '[00:03.00]Segunda', '[00:30.00]Tercera'].join('\n'),
	});
	assert.deepEqual(textos(r.captions), ['Primera', 'Segunda', 'Tercera']);
	assert.equal(r.captions[0].startTime, 1.5);
	assert.equal(r.captions[0].duration, 1.5);
	// Antes de un instrumental largo no queda 27 s en pantalla.
	assert.ok(r.captions[1].duration <= 8);
});

test('Texto a voz: la key es la DEL CLIENTE y la ruta no reintenta', () => {
	const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
	const ruta = sinComentarios(readFileSync(join(RAIZ, 'app/api/video-editor/tts/route.ts'), 'utf8'));
	// Ni la key de la plataforma ni una lectura de credenciales por su cuenta: la
	// key sale de `elevenKey()` (credDelCliente) adentro de lib/elevenlabs.ts.
	assert.doesNotMatch(ruta, /credWs\(|process\.env\.ELEVENLABS|credDelCliente\(/);
	assert.match(ruta, /decirConVoz\(/);
	// UN pedido por click: ni bucles ni un segundo decirConVoz.
	assert.equal((ruta.match(/decirConVoz\(/g) ?? []).length, 1);
	assert.doesNotMatch(ruta, /\b(for|while)\s*\(|reintent|retry/i);
	// Y va detrás de la sesión.
	const publicas = readFileSync(join(RAIZ, 'lib/rutas-publicas.ts'), 'utf8');
	assert.doesNotMatch(publicas, /video-editor/);
});
