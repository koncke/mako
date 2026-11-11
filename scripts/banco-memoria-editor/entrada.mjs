// Banco de memoria: corre el código REAL del editor (VideoCache, WaveformCache) en un Chrome sin ventana.
import { VideoCache } from "@/app/video-editor/_opencut/services/video-cache/service";
import { WaveformCache } from "@/app/video-editor/_opencut/services/waveform-cache/service";
import { crearCopiaLiviana } from "@/app/video-editor/_opencut/media/copia-liviana";
import { ondaPorTramos } from "@/app/video-editor/_opencut/media/onda-por-tramos";
import { buildSourceWaveformSummary } from "@/app/video-editor/_opencut/media/waveform-summary";
import { lienzoDeSubida } from "@/app/video-editor/_opencut/services/renderer/compositor/lienzo-de-subida";
import { Input, ALL_FORMATS, BlobSource, CanvasSink } from "mediabunny";

// Copia literal de ensureOffscreenCanvas (services/renderer/compositor/wasm-compositor.ts), que no se exporta.
function ensureOffscreenCanvas({ source, width, height, label }) {
	if (source instanceof OffscreenCanvas) return source;
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) throw new Error(`Failed to get 2d context for ${label}`);
	context.clearRect(0, 0, width, height);
	context.drawImage(source, 0, 0, width, height);
	return canvas;
}

// Lo mismo que VideoCache, pero con el CanvasSink a un tamaño chico (lo que sería una copia liviana).
class VideoCacheLiviano extends VideoCache {
	constructor(ancho, alto) {
		super();
		this.ancho = ancho;
		this.alto = alto;
	}
	async initializeSink({ mediaId, file }) {
		const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
		const videoTrack = await input.getPrimaryVideoTrack();
		const sink = new CanvasSink(videoTrack, { poolSize: 3, fit: "contain", width: this.ancho, height: this.alto });
		this.sinks.set(mediaId, {
			input, sink, iterator: null, currentFrame: null, nextFrame: null,
			lastTime: -1, prefetching: false, prefetchPromise: null,
		});
	}
}

const archivos = new Map();
const vivos = []; // lo que el editor mantiene abierto mientras el proyecto está abierto

window.prueba = {
	async cargar(nombre) {
		const r = await fetch(`/${nombre}`);
		const b = await r.blob();
		archivos.set(nombre, new File([b], nombre, { type: "video/mp4" }));
		return b.size;
	},
	async onda(nombre) {
		const wc = new WaveformCache();
		const t = performance.now();
		const s = await wc.getSourceSummary({ sourceKey: nombre, sourceFile: archivos.get(nombre) });
		vivos.push(s);
		return { ms: Math.round(performance.now() - t), resumen: Object.keys(s) };
	},
	// Reproduce `segundos` a 30 cuadros por segundo, pidiendo cada cuadro como lo pide la vista previa.
	async reproducir({ nombres, segundos, liviano = null, subir = false }) {
		const vc = liviano ? new VideoCacheLiviano(liviano[0], liviano[1]) : new VideoCache();
		vivos.push(vc);
		const t0 = performance.now();
		let cuadros = 0;
		let pixeles = 0;
		const lienzos = new Map(); // subir: "reusado" → el lienzo de cada capa, como el compositor desde el 11/11
		for (let i = 0; i < segundos * 30; i++) {
			const t = i / 30;
			for (const [k, nombre] of nombres.entries()) {
				const f = await vc.getFrameAt({ mediaId: `m${k}-${nombre}`, file: archivos.get(nombre), time: t });
				if (!f) continue;
				cuadros++;
				if (subir === "reusado") {
					const c = lienzoDeSubida({ source: f.canvas, width: f.canvas.width, height: f.canvas.height, previo: lienzos.get(k), label: "x" });
					lienzos.set(k, c);
					pixeles += c.width * c.height;
				} else if (subir) {
					const c = ensureOffscreenCanvas({ source: f.canvas, width: f.canvas.width, height: f.canvas.height, label: "x" });
					pixeles += c.width * c.height;
				}
			}
		}
		return { cuadros, ms: Math.round(performance.now() - t0), pixeles, stats: vc.getStats() };
	},
	// La copia liviana REAL del editor (media/copia-liviana.ts), guardada como `<nombre>.liviana`.
	async copia(nombre) {
		const t = performance.now();
		const f = await crearCopiaLiviana({ file: archivos.get(nombre) });
		if (!f) return { ok: false };
		archivos.set(`${nombre}.liviana`, f);
		const pista = await new Input({ source: new BlobSource(f), formats: ALL_FORMATS }).getPrimaryVideoTrack();
		return { ok: true, ms: Math.round(performance.now() - t), mb: Math.round(f.size / 1048576 * 10) / 10, ancho: pista.displayWidth, alto: pista.displayHeight };
	},
	// ¿La copia trae cada cuadro en el MISMO instante que el original? Compara los primeros `n` y los de un salto al medio.
	// ⚠️ PESADA: el 11/11 llevó la GPU a +1,3 GB y la PC a 437 MB libres (los cuadros en cola no se sueltan al cortar el
	// iterador). No va en ningún escenario: se llama a mano y con más de 3 GB libres. Dio 0 distintos en 120 cuadros.
	async mismosTiempos(a, b, n = 60, salto = 10) {
		const tiempos = async (nombre, desde) => {
			const pista = await new Input({ source: new BlobSource(archivos.get(nombre)), formats: ALL_FORMATS }).getPrimaryVideoTrack();
			const sink = new CanvasSink(pista, { poolSize: 2, width: 64, height: 64, fit: "fill" });
			const out = [];
			for await (const c of sink.canvases(desde)) { out.push(Math.round(c.timestamp * 1e6)); if (out.length >= n) break; }
			return out;
		};
		const difs = [];
		for (const desde of [0, salto]) {
			const [x, y] = await Promise.all([tiempos(a, desde), tiempos(b, desde)]);
			difs.push({ desde, cuadros: Math.min(x.length, y.length), distintos: x.filter((v, i) => v !== y[i]).length, primeroA: x[0], primeroB: y[0] });
		}
		return difs;
	},
	// ¿La onda de a trozos da lo mismo que la de antes (el archivo entero con decodeAudioData)? Pesada como la de antes.
	async ondaComparar(nombre) {
		const file = archivos.get(nombre);
		const nueva = await ondaPorTramos({ sourceKey: nombre, file });
		if (nueva.estado !== "listo") return { estado: nueva.estado };
		const ctx = new AudioContext({ sampleRate: nueva.resumen.sampleRate });
		const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
		void ctx.close();
		const vieja = buildSourceWaveformSummary({ sourceKey: nombre, buffer });
		const a = vieja.amplitudes, b = nueva.resumen.amplitudes;
		let maxDif = 0, sumaDif = 0;
		const n = Math.min(a.length, b.length);
		for (let i = 0; i < n; i++) { const d = Math.abs(a[i] - b[i]); sumaDif += d; if (d > maxDif) maxDif = d; }
		return { tasa: [vieja.sampleRate, nueva.resumen.sampleRate], muestras: [vieja.totalSamples, nueva.resumen.totalSamples], baldes: [a.length, b.length], maxDif: Math.round(maxDif * 1e4) / 1e4, difMedia: Math.round((sumaDif / n) * 1e5) / 1e5, picoMax: Math.round(Math.max(...a) * 1e3) / 1e3 };
	},
	soltar() {
		for (const v of vivos) if (v instanceof VideoCache) v.clearAll();
		vivos.length = 0;
		archivos.clear();
		return true;
	},
};
window.listo = true;
