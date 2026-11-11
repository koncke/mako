// Banco de memoria: corre el código REAL del editor (VideoCache, WaveformCache) en un Chrome sin ventana.
import { VideoCache } from "@/app/video-editor/_opencut/services/video-cache/service";
import { WaveformCache } from "@/app/video-editor/_opencut/services/waveform-cache/service";
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
		for (let i = 0; i < segundos * 30; i++) {
			const t = i / 30;
			for (const [k, nombre] of nombres.entries()) {
				const f = await vc.getFrameAt({ mediaId: `m${k}-${nombre}`, file: archivos.get(nombre), time: t });
				if (!f) continue;
				cuadros++;
				if (subir) {
					const c = ensureOffscreenCanvas({ source: f.canvas, width: f.canvas.width, height: f.canvas.height, label: "x" });
					pixeles += c.width * c.height;
				}
			}
		}
		return { cuadros, ms: Math.round(performance.now() - t0), pixeles, stats: vc.getStats() };
	},
	soltar() {
		for (const v of vivos) if (v instanceof VideoCache) v.clearAll();
		vivos.length = 0;
		archivos.clear();
		return true;
	},
};
window.listo = true;
