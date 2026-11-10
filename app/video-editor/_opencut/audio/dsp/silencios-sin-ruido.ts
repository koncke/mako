// =============================================================================
// Silencios: se buscan en el audio SIN RUIDO, y se cortan en el original
// =============================================================================
// Medido el 28/10/2026: con el ruido de fondo a 20 dB o menos de la voz, «Borrar silencios» no
// encontraba NINGUNA pausa (con 25 dB, todas): el umbral de dsp/silencios.ts queda en −40 dBFS y
// las pausas con ruido, arriba. Decisión del Cerebro (28/10): las pausas se buscan sobre el audio
// con el ruido YA REDUCIDO —la misma cadena RNNoise de «Reducir el ruido» (./ruido.ts)— y con el
// MISMO umbral de siempre. Bajar el umbral hasta el piso del ruido era la otra salida, y se come
// las sílabas suaves de un habla sin pausas: un corte equivocado es peor que «no hay silencios».
//
// Vale aunque el clip no tenga «Reducir el ruido» prendido: acá sólo se ESCUCHA para decidir dónde
// cortar; lo que se corta y lo que suena es el original. Para decidir alcanza la mezcla que mide el
// medidor (el promedio de los canales): la mitad del trabajo de la red.
//
// Una voz limpia da lo mismo que antes: donde el canal no tiene ruido (su piso bajo −75 dBFS), la
// cadena no toca nada (./ruido.ts, la guarda). Lo prueba tests/video-editor-silencios.test.ts.
//
// Quién reduce el ruido lo dice el que llama (`reducir`): «Borrar silencios» lo manda al worker
// (../ruido-hilo/cliente.ts, `reducirRuidoEnSegundoPlano`); los tests, a la cuenta en su hilo.

import type { Trozo } from "../decodificar";
import type { ReductorRuido } from "../ruido-hilo/cliente";
import { MedidorVentanas, rangosDeSilencio, type OpcionesSilencio } from "./silencios";

/** La intensidad de «Reducir el ruido» (audio/cadena.ts: la de CapCut). */
const INTENSIDAD = 0.85;

/**
 * Junta los trozos del decodificador en UN bloque continuo, en su lugar en la fuente: un hueco queda
 * en silencio digital y un solape lo pisa el trozo que llega después. Los canales son los del trozo que
 * más tiene (hasta dos, como `recorrerFuente`).
 */
export class JuntadorDeTrozos {
	private readonly trozos: Trozo[] = [];

	agregar(trozo: Trozo): void {
		if (trozo.canales.length && trozo.canales[0].length && trozo.sampleRate > 0) this.trozos.push(trozo);
	}

	resultado(): Trozo | null {
		if (!this.trozos.length) return null;
		const { sampleRate } = this.trozos[0];
		const inicio = Math.min(...this.trozos.map((t) => t.inicio));
		const fin = Math.max(...this.trozos.map((t) => t.inicio + t.canales[0].length / t.sampleRate));
		const largo = Math.max(1, Math.round((fin - inicio) * sampleRate));
		const cuantos = Math.max(...this.trozos.map((t) => t.canales.length));
		const canales = Array.from({ length: cuantos }, () => new Float32Array(largo));
		for (const t of this.trozos) {
			const desde = Math.round((t.inicio - inicio) * sampleRate);
			canales.forEach((c, i) => {
				const origen = t.canales[Math.min(i, t.canales.length - 1)];
				c.set(origen.subarray(0, Math.max(0, Math.min(origen.length, largo - desde))), Math.max(0, desde));
			});
		}
		return { canales, sampleRate, inicio };
	}
}

/** El promedio de los canales: lo que mide el medidor de ventanas. */
function mezcla(canales: readonly Float32Array[]): Float32Array {
	if (canales.length === 1) return canales[0];
	const m = new Float32Array(canales[0].length);
	for (const c of canales) for (let i = 0; i < m.length; i++) m[i] += (c[i] ?? 0) / canales.length;
	return m;
}

/** Los silencios del bloque, en segundos de la FUENTE, buscados en el audio sin ruido. */
export async function silenciosSinRuido({
	audio,
	reducir,
	opciones,
}: {
	audio: Trozo;
	reducir: ReductorRuido;
	opciones?: OpcionesSilencio;
}): Promise<[number, number][]> {
	const [limpio] = await reducir({ canales: [mezcla(audio.canales)], sampleRate: audio.sampleRate, intensidad: INTENSIDAD });
	const medidor = new MedidorVentanas();
	medidor.agregar({ canales: [limpio], sampleRate: audio.sampleRate, inicio: audio.inicio });
	return rangosDeSilencio(medidor.resultado(), opciones);
}
