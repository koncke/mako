// =============================================================================
// Cambiar el tono sin cambiar la duración (SoundTouch, en JS puro)
// =============================================================================
// El «Tono» del Modificador de voz. retime/audio-stretch.ts usa el
// `PitchShifter` de soundtouchjs, que corre en un ScriptProcessorNode: acá no
// hace falta un contexto de audio, se usa el núcleo (`SoundTouch` +
// `SimpleFilter`) directo sobre las muestras. Así la reproducción y
// el export pasan EXACTAMENTE por la misma cuenta.
//
// Medido en node (11/10, 44,1 kHz): SoundTouch no entrega la cola (faltan
// ~0,27 s) y adelanta la salida unos 10–20 ms. Se rellena con silencio al
// final para que salga todo y se corta al largo original.
//
// Es async y cede el hilo cada 16 trozos: SoundTouch en JS tarda 0,33 s por
// minuto de audio estéreo a 48 kHz (medido en node el 11/10), así que un clip
// de diez minutos congelaba la pantalla —y cortaba el sonido de los otros
// clips— más de 3 s de corrido mientras se preparaba.

import { SimpleFilter, SoundTouch } from "soundtouchjs";
import { ceder } from "./fft";

const RELLENO_S = 0.5;
const TROZO = 8192;

export async function cambiarTono({
	canales,
	sampleRate,
	semitonos,
}: {
	canales: readonly Float32Array[];
	sampleRate: number;
	semitonos: number;
}): Promise<Float32Array[]> {
	if (Math.abs(semitonos) < 0.01 || canales.length === 0) return canales.map((c) => c.slice());
	const largo = canales[0].length;
	const izquierdo = canales[0];
	const derecho = canales[1] ?? canales[0];
	const total = largo + Math.round(RELLENO_S * sampleRate);
	const fuente = {
		extract(destino: Float32Array, cuantos: number, desde: number): number {
			let i = 0;
			for (; i < cuantos && desde + i < total; i++) {
				const j = desde + i;
				destino[2 * i] = j < largo ? izquierdo[j] : 0;
				destino[2 * i + 1] = j < largo ? derecho[j] : 0;
			}
			return i;
		},
	};
	const st = new SoundTouch();
	st.pitchSemitones = semitonos;
	const filtro = new SimpleFilter(fuente, st);
	const salida = canales.slice(0, 2).map(() => new Float32Array(largo));
	const trozo = new Float32Array(TROZO * 2);
	let pos = 0;
	let vueltas = 0;
	while (pos < largo) {
		if (++vueltas % 16 === 0) await ceder();
		const n = filtro.extract(trozo, TROZO);
		if (n === 0) break;
		for (let i = 0; i < n && pos + i < largo; i++) {
			salida[0][pos + i] = trozo[2 * i];
			if (salida[1]) salida[1][pos + i] = trozo[2 * i + 1];
		}
		pos += n;
	}
	return salida;
}
