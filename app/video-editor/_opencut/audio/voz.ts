// =============================================================================
// «Modificador de voz»: los filtros y personajes, y cómo suenan
// =============================================================================
// CapCut (relevamiento-capcut-funciones §3.2) tiene «Filtros de voz»,
// «Personajes de voz» y «Voz a canción». Los nombres de los filtros vienen de su
// servidor y no están en el es-LA.po (como los de los filtros de color): son
// nuestros. Los de los personajes («Adam, joven», «Tío Tom», «Eve, voz dulce»,
// «Monstruo») y las perillas («Tono», «Timbre», «Fuerza»…) sí son del .po.
// «Voz a canción» es IA en la nube: queda apagada.
//
// TODO se procesa sin conexión y sobre el clip ENTERO, con la misma función para
// la reproducción (búfer preparado del audio-manager) y para el export
// (media/audio.ts): así suena igual en los dos. El tono va por SoundTouch en JS
// (./dsp/tono.ts) y el resto por un grafo de WebAudio en un
// OfflineAudioContext. Los ruidos y la reverberación salen de un generador con
// semilla fija: dos renders del mismo clip dan las mismas muestras.
//
// «Timbre» en CapCut mueve los formantes; acá es una inclinación del espectro
// (más oscuro ↔ más brillante), que es lo que se oye de un cambio de timbre sin
// un vocoder. Las perillas van de 0 a 100 y 50 es neutro en Tono y Timbre.

import type { AjustesVoz, PerillaVoz } from "./claves";
import { cambiarTono } from "./dsp/tono";

export type GrupoVoz = "filtros" | "personajes";

export type FiltroVoz = {
	id: string;
	nombre: string;
	grupo: GrupoVoz;
	/** Las perillas que muestra el panel, con su valor inicial. */
	perillas: Partial<Record<PerillaVoz, number>>;
};

export const FILTROS_VOZ: readonly FiltroVoz[] = [
	{ id: "original", nombre: "Original", grupo: "filtros", perillas: {} },
	{ id: "eco-microfono", nombre: "Eco de micrófono", grupo: "filtros", perillas: { fuerza: 50 } },
	{ id: "megafono", nombre: "Megáfono", grupo: "filtros", perillas: { fuerza: 60 } },
	{ id: "ardilla", nombre: "Ardilla", grupo: "filtros", perillas: { tono: 79, timbre: 60 } },
	{ id: "agudo", nombre: "Agudo", grupo: "filtros", perillas: { tono: 67, timbre: 55 } },
	{ id: "grave", nombre: "Grave", grupo: "filtros", perillas: { tono: 29, timbre: 40 } },
	{ id: "robot", nombre: "Robot", grupo: "filtros", perillas: { frecuencia: 50, fuerza: 70 } },
	{ id: "bateria-baja", nombre: "Batería baja", grupo: "filtros", perillas: { fuerza: 60 } },
	{ id: "temblor", nombre: "Temblor", grupo: "filtros", perillas: { frecuencia: 50, profundidad: 50 } },
	{ id: "vinilo", nombre: "Vinilo", grupo: "filtros", perillas: { ruido: 50 } },
	{ id: "lofi", nombre: "Lo-Fi", grupo: "filtros", perillas: { fuerza: 50 } },
	{ id: "telefono", nombre: "Teléfono", grupo: "filtros", perillas: { fuerza: 50 } },
	{ id: "eco", nombre: "Eco", grupo: "filtros", perillas: { cantidad: 50, fuerza: 50 } },
	{ id: "sala-grande", nombre: "Sala grande", grupo: "filtros", perillas: { habitacion: 60, fuerza: 50 } },
	{ id: "distorsionado", nombre: "Distorsionado", grupo: "filtros", perillas: { fuerza: 50 } },
	// `pc_voice_effect_big_uncle` / `_boy` / `_girl` / `_monster`.
	{ id: "adam-joven", nombre: "Adam, joven", grupo: "personajes", perillas: { tono: 42, timbre: 45 } },
	{ id: "tio-tom", nombre: "Tío Tom", grupo: "personajes", perillas: { tono: 35, timbre: 38 } },
	{ id: "eve-dulce", nombre: "Eve, voz dulce", grupo: "personajes", perillas: { tono: 67, timbre: 62 } },
	{ id: "monstruo", nombre: "Monstruo", grupo: "personajes", perillas: { tono: 13, fuerza: 40 } },
];

export function filtroVoz(id: string | undefined): FiltroVoz | undefined {
	return FILTROS_VOZ.find((f) => f.id === id);
}

/** 0–100 → semitonos: 50 = sin cambio, cada extremo una octava. */
export const semitonosDeTono = (tono: number) => (tono - 50) * 0.24;

/** Corrimientos de tono FIJOS de algunos filtros (no muestran la perilla). */
const TONO_FIJO: Record<string, number> = { "bateria-baja": -2 };

// ── El grafo ─────────────────────────────────────────────────────────────────

type Ctx = OfflineAudioContext;

/** Un generador con semilla (mulberry32): mismo clip, mismas muestras. */
function azar(semilla: number) {
	let a = semilla >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function biquad(ctx: Ctx, type: BiquadFilterType, frequency: number, extra?: { Q?: number; gain?: number }) {
	const f = ctx.createBiquadFilter();
	f.type = type;
	f.frequency.value = frequency;
	if (extra?.Q !== undefined) f.Q.value = extra.Q;
	if (extra?.gain !== undefined) f.gain.value = extra.gain;
	return f;
}

function ganancia(ctx: Ctx, valor: number) {
	const g = ctx.createGain();
	g.gain.value = valor;
	return g;
}

/** Encadena nodos y devuelve [primero, último]. */
function cadena(...nodos: AudioNode[]): [AudioNode, AudioNode] {
	for (let i = 0; i < nodos.length - 1; i++) nodos[i].connect(nodos[i + 1]);
	return [nodos[0], nodos[nodos.length - 1]];
}

/**
 * La saturación lleva la voz cerca de ±1 casi todo el tiempo (con k = 30 la
 * ganancia de señal chica es ×31, casi una onda cuadrada): sin bajarla, el clip
 * con megáfono tapa todo lo demás y lo aplasta el limitador del master. El
 * valor es una estimación, sin medir contra CapCut.
 */
const COMPENSAR_SATURACION = 0.35;

function distorsion(ctx: Ctx, k: number) {
	const n = 2048;
	const curva = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const x = (i / (n - 1)) * 2 - 1;
		curva[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
	}
	const w = ctx.createWaveShaper();
	w.curve = curva;
	w.oversample = "4x";
	return w;
}

function escalones(ctx: Ctx, bits: number) {
	const n = 4096;
	const pasos = 2 ** bits;
	const curva = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const x = (i / (n - 1)) * 2 - 1;
		curva[i] = Math.round(x * pasos) / pasos;
	}
	const w = ctx.createWaveShaper();
	w.curve = curva;
	return w;
}

/** Inclinación del espectro (ver «Timbre» en la cabecera). */
function timbre(ctx: Ctx, valor: number): [AudioNode, AudioNode] {
	const d = (valor - 50) / 50;
	return cadena(biquad(ctx, "lowshelf", 250, { gain: -6 * d }), biquad(ctx, "highshelf", 3500, { gain: 9 * d }));
}

/** Seco + húmedo: devuelve [entrada, salida] con el efecto `[a, b]` mezclado. */
function mezcla(ctx: Ctx, efecto: [AudioNode, AudioNode], humedo: number, seco = 1): [AudioNode, AudioNode] {
	const entrada = ganancia(ctx, 1);
	const salida = ganancia(ctx, 1);
	entrada.connect(ganancia(ctx, seco)).connect(salida);
	entrada.connect(efecto[0]);
	efecto[1].connect(ganancia(ctx, humedo)).connect(salida);
	return [entrada, salida];
}

function eco(ctx: Ctx, segundos: number, realimentacion: number): [AudioNode, AudioNode] {
	const entrada = ganancia(ctx, 1);
	const retardo = ctx.createDelay(2);
	retardo.delayTime.value = segundos;
	const vuelta = ganancia(ctx, realimentacion);
	entrada.connect(retardo);
	retardo.connect(vuelta).connect(retardo);
	return [entrada, retardo];
}

function reverberacion(ctx: Ctx, segundos: number): [AudioNode, AudioNode] {
	const largo = Math.max(1, Math.round(segundos * ctx.sampleRate));
	const ir = ctx.createBuffer(2, largo, ctx.sampleRate);
	for (let c = 0; c < 2; c++) {
		const r = azar(1234 + c);
		const d = ir.getChannelData(c);
		// −60 dB al final de `segundos`.
		const caida = 6.91 / largo;
		for (let i = 0; i < largo; i++) d[i] = (r() * 2 - 1) * Math.exp(-caida * i);
	}
	const conv = ctx.createConvolver();
	conv.buffer = ir;
	return [conv, conv];
}

/** Multiplica la señal por un seno (modulación en anillo). */
function anillo(ctx: Ctx, frecuencia: number): [AudioNode, AudioNode] {
	const g = ganancia(ctx, 0);
	const osc = ctx.createOscillator();
	osc.frequency.value = frecuencia;
	osc.connect(g.gain);
	osc.start(0);
	return [g, g];
}

function tremolo(ctx: Ctx, frecuencia: number, profundidad: number): [AudioNode, AudioNode] {
	const g = ganancia(ctx, 1 - profundidad / 2);
	const osc = ctx.createOscillator();
	osc.frequency.value = frecuencia;
	osc.connect(ganancia(ctx, profundidad / 2)).connect(g.gain);
	osc.start(0);
	return [g, g];
}

function vibrato(ctx: Ctx, frecuencia: number, profundidad: number): [AudioNode, AudioNode] {
	const retardo = ctx.createDelay(0.05);
	retardo.delayTime.value = 0.008;
	const osc = ctx.createOscillator();
	osc.frequency.value = frecuencia;
	osc.connect(ganancia(ctx, 0.0065 * profundidad)).connect(retardo.delayTime);
	osc.start(0);
	return [retardo, retardo];
}

/** El «crujido» del vinilo: chasquidos sueltos y un soplido bajo. */
function crujido(ctx: Ctx, largo: number, cantidad: number) {
	const b = ctx.createBuffer(1, largo, ctx.sampleRate);
	const d = b.getChannelData(0);
	const r = azar(99);
	const porSegundo = 4 + 30 * cantidad;
	const p = porSegundo / ctx.sampleRate;
	for (let i = 0; i < largo; i++) {
		d[i] = (r() * 2 - 1) * 0.02;
		if (r() < p) {
			const alto = (r() * 2 - 1) * 0.6;
			for (let k = 0; k < 24 && i + k < largo; k++) d[i + k] += alto * Math.exp(-k / 4);
		}
	}
	const s = ctx.createBufferSource();
	s.buffer = b;
	s.start(0);
	return s;
}

/** Un nodo solo como tramo de la cadena. */
const uno = (n: AudioNode): [AudioNode, AudioNode] => [n, n];

/** Arma el grafo del filtro entre `entrada` y `salida` del contexto. */
function armarGrafo(ctx: Ctx, entrada: AudioNode, salida: AudioNode, ajustes: AjustesVoz, largo: number): void {
	const filtro = filtroVoz(ajustes.id);
	const v = (p: PerillaVoz) => (ajustes.perillas[p] ?? filtro?.perillas[p] ?? 50) / 100;
	const conectar = (...tramos: Array<[AudioNode, AudioNode]>) => {
		let actual: AudioNode = entrada;
		for (const [a, b] of tramos) {
			actual.connect(a);
			actual = b;
		}
		actual.connect(salida);
	};
	// El timbre va en todos los filtros que muestran la perilla.
	const tramoTimbre: Array<[AudioNode, AudioNode]> =
		filtro?.perillas.timbre !== undefined ? [timbre(ctx, v("timbre") * 100)] : [];

	switch (ajustes.id) {
		case "eco-microfono": {
			const f = v("fuerza");
			return conectar(
				mezcla(ctx, eco(ctx, 0.09, 0.35), 0.8 * f),
				mezcla(ctx, reverberacion(ctx, 0.6), 0.15 * f),
			);
		}
		case "megafono": {
			const f = v("fuerza");
			return conectar(
				cadena(biquad(ctx, "highpass", 500, { Q: 0.9 }), biquad(ctx, "lowpass", 3200, { Q: 0.9 })),
				uno(distorsion(ctx, 2 + 30 * f)),
				uno(ganancia(ctx, COMPENSAR_SATURACION)),
			);
		}
		case "robot": {
			const f = v("fuerza");
			const hz = 30 + 200 * v("frecuencia");
			return conectar(
				mezcla(ctx, anillo(ctx, hz), 1.4 * f, 1 - 0.85 * f),
				mezcla(ctx, eco(ctx, 1 / hz, 0.5), 0.5 * f),
			);
		}
		case "bateria-baja":
			return conectar(tremolo(ctx, 5, 0.9 * v("fuerza")), uno(biquad(ctx, "lowpass", 2500)));
		case "temblor":
			return conectar(vibrato(ctx, 2 + 8 * v("frecuencia"), v("profundidad")));
		case "vinilo": {
			const r = v("ruido");
			crujido(ctx, largo, r).connect(ganancia(ctx, 0.15 + 0.6 * r)).connect(salida);
			return conectar(cadena(biquad(ctx, "highpass", 150), biquad(ctx, "lowpass", 6000)));
		}
		case "lofi": {
			const f = v("fuerza");
			return conectar(uno(escalones(ctx, Math.round(12 - 8 * f))), uno(biquad(ctx, "lowpass", 4500 - 2000 * f)));
		}
		case "telefono":
			return conectar(
				cadena(biquad(ctx, "highpass", 300, { Q: 1 }), biquad(ctx, "lowpass", 3400, { Q: 1 })),
				uno(distorsion(ctx, 0.5 + 6 * v("fuerza"))),
				uno(ganancia(ctx, 0.6)),
			);
		case "eco":
			return conectar(mezcla(ctx, eco(ctx, 0.3, 0.2 + 0.6 * v("cantidad")), 0.9 * v("fuerza")));
		case "sala-grande": {
			const f = v("fuerza");
			return conectar(mezcla(ctx, reverberacion(ctx, 0.8 + 3.2 * v("habitacion")), 0.8 * f, 1 - 0.3 * f));
		}
		case "distorsionado":
			return conectar(uno(distorsion(ctx, 3 + 60 * v("fuerza"))), uno(ganancia(ctx, COMPENSAR_SATURACION)));
		case "monstruo":
			return conectar(
				uno(distorsion(ctx, 1 + 20 * v("fuerza"))),
				uno(biquad(ctx, "lowpass", 3000)),
				uno(ganancia(ctx, COMPENSAR_SATURACION)),
			);
		default:
			// Los de sólo tono y timbre (Ardilla, Agudo, Grave y los personajes).
			return conectar(...tramoTimbre);
	}
}

/**
 * Aplica el filtro de voz a las muestras de un clip (en el tiempo del clip) y
 * devuelve el mismo largo. Lo usan la reproducción y el export.
 */
export async function aplicarVoz({
	canales,
	sampleRate,
	ajustes,
}: {
	canales: readonly Float32Array[];
	sampleRate: number;
	ajustes: AjustesVoz;
}): Promise<Float32Array[]> {
	const filtro = filtroVoz(ajustes.id);
	if (!filtro || filtro.id === "original" || canales.length === 0) return canales.map((c) => c.slice());
	const largo = canales[0].length;
	if (largo === 0) return canales.map((c) => c.slice());

	let semitonos = TONO_FIJO[filtro.id] ?? 0;
	if (filtro.perillas.tono !== undefined) {
		semitonos += semitonosDeTono(ajustes.perillas.tono ?? filtro.perillas.tono);
	}
	const entonados = await cambiarTono({ canales, sampleRate, semitonos });

	const salidaCanales = Math.min(2, Math.max(1, entonados.length));
	const ctx = new OfflineAudioContext(salidaCanales, largo, sampleRate);
	const fuente = ctx.createBufferSource();
	const b = ctx.createBuffer(salidaCanales, largo, sampleRate);
	for (let c = 0; c < salidaCanales; c++) b.copyToChannel(entonados[Math.min(c, entonados.length - 1)] as Float32Array<ArrayBuffer>, c);
	fuente.buffer = b;
	armarGrafo(ctx, fuente, ctx.destination, ajustes, largo);
	fuente.start(0);
	const r = await ctx.startRendering();
	return Array.from({ length: r.numberOfChannels }, (_, c) => r.getChannelData(c).slice());
}
