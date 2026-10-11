// =============================================================================
// «Revertir»: el tramo de un video, al revés, como un archivo nuevo
// =============================================================================
// El motor no sabe reproducir para atrás (decodificar hacia atrás es carísimo:
// cada cuadro depende del cuadro clave anterior). CapCut tampoco lo hace en vivo:
// genera un archivo invertido y reemplaza el medio del clip. Acá igual, todo en
// el navegador con mediabunny:
//
//   · AUDIO: se decodifica el tramo entero (unos 46 MB por cada 2 min estéreo),
//     se invierte muestra a muestra y se codifica de una.
//   · VIDEO: por VENTANAS desde el final. Cada ventana se decodifica hacia
//     adelante (es lo único que sabe hacer un decodificador), se guardan sus
//     cuadros y se codifican al revés. La ventana se calcula para que los cuadros
//     guardados no pasen de ~200 MB: guardar el clip entero (1080p, 30 cps) son
//     8 MB por cuadro, 15 GB por minuto.
//
// Trampa conocida: cada ventana vuelve a decodificar desde el cuadro clave
// anterior a su inicio, así que con cuadros clave cada 2 s se decodifica ~3
// veces el tramo. Decodificar es lo barato (por hardware); se acepta.
//
// La salida es H.264 en MP4 si el navegador lo codifica; si no, VP9/AV1/VP8 en
// WebM. El lado largo se limita a 1920 px (lo que ya muestra el reproductor) y
// los lados son pares (H.264 lo exige).

import {
	ALL_FORMATS,
	AudioBufferSink,
	AudioBufferSource,
	BlobSource,
	BufferTarget,
	CanvasSink,
	Input,
	Mp4OutputFormat,
	Output,
	QUALITY_HIGH,
	VideoSample,
	VideoSampleSource,
	WebMOutputFormat,
	getFirstEncodableAudioCodec,
	getFirstEncodableVideoCodec,
	type AudioCodec,
	type VideoCodec,
} from "mediabunny";

/** Lo más largo que se revierte (segundos de fuente). */
export const TOPE_REVERTIR_S = 180;

const LADO_MAXIMO = 1920;
const MEMORIA_VENTANA = 200 * 1024 * 1024;

export class RevertirCancelado extends Error {
	constructor() {
		super("Reversión cancelada");
		this.name = "RevertirCancelado";
	}
}

const par = (v: number) => Math.max(2, Math.round(v / 2) * 2);

export type VideoRevertido = {
	file: File;
	tieneAudio: boolean;
};

export async function revertirVideo({
	file,
	desde,
	hasta,
	nombre,
	onProgreso,
	signal,
}: {
	file: File;
	/** Tramo de la fuente a invertir, en segundos. */
	desde: number;
	hasta: number;
	nombre: string;
	onProgreso?: (fraccion: number) => void;
	signal?: AbortSignal;
}): Promise<VideoRevertido> {
	const cancelado = () => {
		if (signal?.aborted) throw new RevertirCancelado();
	};
	const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
	let output: Output | null = null;
	try {
		const pistaVideo = await input.getPrimaryVideoTrack();
		if (!pistaVideo || !(await pistaVideo.canDecode())) {
			throw new Error("El video no se puede decodificar en este navegador");
		}
		const pistaAudio = await input.getPrimaryAudioTrack();
		const audioDecodificable = pistaAudio ? await pistaAudio.canDecode() : false;

		const escala = Math.min(
			1,
			LADO_MAXIMO / Math.max(pistaVideo.displayWidth, pistaVideo.displayHeight),
		);
		const ancho = par(pistaVideo.displayWidth * escala);
		const alto = par(pistaVideo.displayHeight * escala);
		const stats = await pistaVideo.computePacketStats(120).catch(() => null);
		const cps = Math.min(120, Math.max(1, stats?.averagePacketRate || 30));

		const codecVideo: VideoCodec | null = await getFirstEncodableVideoCodec(
			["avc", "vp9", "av1", "vp8"],
			{ width: ancho, height: alto },
		);
		if (!codecVideo) throw new Error("El navegador no puede codificar video");
		const enMp4 = codecVideo === "avc";

		const destino = new BufferTarget();
		output = new Output({
			format: enMp4 ? new Mp4OutputFormat() : new WebMOutputFormat(),
			target: destino,
		});
		const fuenteVideo = new VideoSampleSource({
			codec: codecVideo,
			quality: QUALITY_HIGH,
			// Cuadros clave seguidos: el clip revertido se recorre a saltos en la
			// línea de tiempo y cada salto decodifica desde el clave anterior.
			keyFrameInterval: 1,
		});
		output.addVideoTrack(fuenteVideo);

		let fuenteAudio: AudioBufferSource | null = null;
		if (pistaAudio && audioDecodificable) {
			const codecAudio: AudioCodec | null = await getFirstEncodableAudioCodec(
				enMp4 ? ["aac", "opus"] : ["opus", "vorbis"],
				{
					numberOfChannels: Math.min(2, pistaAudio.numberOfChannels),
					sampleRate: pistaAudio.sampleRate,
				},
			);
			if (codecAudio) {
				fuenteAudio = new AudioBufferSource({ codec: codecAudio, quality: QUALITY_HIGH });
				output.addAudioTrack(fuenteAudio);
			}
		}

		await output.start();
		const tramo = Math.max(1e-3, hasta - desde);

		// ── Audio ──────────────────────────────────────────────────────────────
		if (fuenteAudio && pistaAudio) {
			await escribirAudioInvertido({
				pista: pistaAudio,
				desde,
				hasta,
				fuente: fuenteAudio,
				cancelado,
			});
			onProgreso?.(0.1);
		}

		// ── Video, por ventanas desde el final ───────────────────────────────
		const sink = new CanvasSink(pistaVideo, {
			width: ancho,
			height: alto,
			fit: "fill",
			// Sin pool: cada cuadro guardado tiene que ser un lienzo propio (el
			// pool los recicla y la ventana guardaría el mismo lienzo N veces).
			poolSize: 0,
		});
		const ventana = Math.min(
			1,
			Math.max(0.25, MEMORIA_VENTANA / (ancho * alto * 4 * cps)),
		);
		const base = fuenteAudio ? 0.1 : 0;
		let fin = hasta;
		while (fin > desde + 1e-6) {
			cancelado();
			const inicio = Math.max(desde, fin - ventana);
			const cuadros: { canvas: HTMLCanvasElement | OffscreenCanvas; ts: number; dur: number }[] = [];
			for await (const c of sink.canvases(inicio, fin)) {
				cancelado();
				// El cuadro que ya se veía al empezar la ventana (empezó antes) es de
				// la ventana anterior; salvo en la primera del tramo, donde es el que
				// se ve en `desde`.
				if (inicio > desde + 1e-6 && c.timestamp < inicio - 1e-6) continue;
				if (c.timestamp >= fin - 1e-6) break;
				cuadros.push({ canvas: c.canvas, ts: c.timestamp, dur: c.duration });
			}
			for (let i = cuadros.length - 1; i >= 0; i--) {
				cancelado();
				const c = cuadros[i];
				const finCuadro = Math.min(hasta, c.ts + c.dur);
				const comienzo = Math.max(desde, c.ts);
				const muestra = new VideoSample(c.canvas, {
					timestamp: Math.max(0, hasta - finCuadro),
					duration: Math.max(1 / (cps * 4), finCuadro - comienzo),
				});
				try {
					await fuenteVideo.add(muestra);
				} finally {
					muestra.close();
				}
			}
			cuadros.length = 0;
			fin = inicio;
			onProgreso?.(base + (1 - base) * ((hasta - fin) / tramo));
		}

		cancelado();
		fuenteVideo.close();
		await output.finalize();
		const buffer = destino.buffer;
		if (!buffer) throw new Error("No se generó el archivo");
		const extension = enMp4 ? "mp4" : "webm";
		return {
			file: new File([buffer], `${nombre}.${extension}`, {
				type: enMp4 ? "video/mp4" : "video/webm",
			}),
			tieneAudio: Boolean(fuenteAudio),
		};
	} catch (error) {
		if (output && output.state !== "finalized" && output.state !== "canceled") {
			await output.cancel().catch(() => {});
		}
		throw error;
	} finally {
		input.dispose();
	}
}

async function escribirAudioInvertido({
	pista,
	desde,
	hasta,
	fuente,
	cancelado,
}: {
	pista: NonNullable<Awaited<ReturnType<Input["getPrimaryAudioTrack"]>>>;
	desde: number;
	hasta: number;
	fuente: AudioBufferSource;
	cancelado: () => void;
}): Promise<void> {
	const sampleRate = pista.sampleRate;
	const canales = Math.max(1, Math.min(2, pista.numberOfChannels));
	const total = Math.max(1, Math.round((hasta - desde) * sampleRate));
	const datos = Array.from({ length: canales }, () => new Float32Array(total));

	const sink = new AudioBufferSink(pista);
	for await (const { buffer, timestamp } of sink.buffers(desde, hasta)) {
		cancelado();
		// Cada búfer va en su lugar por su sello de tiempo (no se encadenan:
		// un hueco en el archivo quedaría corrido).
		const destino = Math.round((timestamp - desde) * sampleRate);
		const desdeMuestra = Math.max(0, -destino);
		for (let ch = 0; ch < canales; ch++) {
			const origen = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));
			for (let i = desdeMuestra; i < origen.length; i++) {
				const j = destino + i;
				if (j >= total) break;
				datos[ch][j] = origen[i];
			}
		}
	}
	for (const canal of datos) canal.reverse();

	// De a un segundo: el codificador no necesita el tramo entero de una.
	for (let inicio = 0; inicio < total; inicio += sampleRate) {
		cancelado();
		const largo = Math.min(sampleRate, total - inicio);
		const trozo = new AudioBuffer({ length: largo, numberOfChannels: canales, sampleRate });
		for (let ch = 0; ch < canales; ch++) {
			trozo.copyToChannel(datos[ch].subarray(inicio, inicio + largo), ch);
		}
		await fuente.add(trozo);
	}
	fuente.close();
}
