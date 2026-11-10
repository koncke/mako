// =============================================================================
// La exportación de CapCut de punta a punta: video, audio, subtítulos y GIF
// =============================================================================
// El diálogo arma las `OpcionesExportar`; esto las ejecuta en orden y deja los
// archivos en «Exportar a» (./destino.ts). Va por fuera de
// `editor.project.export` (project-manager → renderer-manager) a propósito: ese
// camino sabe de UN archivo con la calidad de OpenCut, y CapCut saca hasta
// cuatro (video, audio, subtítulos, GIF) con resolución, tasa y codec propios.
// El progreso lo lleva el diálogo, no el ProjectManager.
//
// ⚠️ El compositor (WebGPU) es UNO y su canvas es el que se ve en el
// reproductor: mientras se exporta, el reproductor muestra los cuadros que se
// van dibujando (igual que en OpenCut). Al terminar se le pide un cuadro nuevo
// (`refrescarReproductor`), si no se queda mostrando el último cuadro exportado.
//
// Con un rango marcado (I / O, rango/reglas.ts) «solo se exporta ese rango», como
// en CapCut: el video, el audio aparte, los subtítulos y el GIF salen de la
// entrada a la salida y arrancan en 0. El diálogo lo pone en `opciones.tramo`.

import { mensajeDeExport } from "./mensaje-error";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { buildScene } from "@/app/video-editor/_opencut/services/renderer/scene-builder";
import { SceneExporter } from "@/app/video-editor/_opencut/services/renderer/scene-exporter";
import { CanvasRenderer } from "@/app/video-editor/_opencut/services/renderer/canvas-renderer";
import { createTimelineAudioBuffer, timelineHasAudio } from "@/app/video-editor/_opencut/media/audio";
import { floatToFrameRate } from "@/app/video-editor/_opencut/fps/utils";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import {
	AUDIO_BITRATE,
	GIF_MAX_SEGUNDOS,
	tamanoSalida,
	tasaDeBits,
	valorCuadros,
	type CodecId,
	type OpcionesExportar,
	type SoporteCodec,
} from "./opciones";
import { codificarAudio, EXTENSION_AUDIO } from "./audio-aparte";
import { archivoSubtitulos, subtitulosDe } from "./subtitulos";
import { exportarGif } from "./gif";
import { guardarArchivo, nombreArchivo } from "./destino";
import { EXPORT_MIME_TYPES } from "./mime-types";
import { tramoVigente } from "@/app/video-editor/_opencut/rango/acciones";
import {
	muestrasDelTramo,
	segundosAExportar,
	subtitulosDelTramo,
	tramoEfectivo,
	tramoEnSegundos,
	type Tramo,
} from "@/app/video-editor/_opencut/rango/reglas";

export type ResultadoExportar =
	// `video`: el archivo de video que salió (para «Publicar», app/calendario/publicar-desde-crear.ts), o null si no hubo.
	| { estado: "listo"; archivos: string[]; video: { blob: Blob; nombre: string } | null }
	| { estado: "cancelado" }
	| { estado: "error"; mensaje: string };

/** Lo que el diálogo necesita saber del proyecto para dibujarse. */
export function datosDelProyecto(editor: EditorCore) {
	const proyecto = editor.project.getActive();
	const tracks = editor.scenes.getActiveScene().tracks;
	const mediaAssets = editor.media.getAssets();
	const duracion = editor.timeline.getTotalDuration();
	// El rango I / O que vale ahora (o null): lo que se exporta y lo que dice el pie.
	const tramo = tramoVigente(editor);
	return {
		proyecto,
		tramo,
		/** Los segundos que se EXPORTAN: los del rango, o la línea entera. */
		segundos: segundosAExportar(tramo, duracion, TICKS_PER_SECOND),
		lienzo: proyecto.settings.canvasSize,
		hayAudio: timelineHasAudio({ tracks, mediaAssets }),
		// Con rango, sólo los subtítulos que caen adentro (la casilla se apaga si no hay ninguno).
		subtitulos: tramo
			? subtitulosDelTramo(subtitulosDe(tracks), tramoEnSegundos(tramo, TICKS_PER_SECOND))
			: subtitulosDe(tracks),
	};
}

export class Exportacion {
	private cancelada = false;
	private exportador: SceneExporter | null = null;
	/** Corta la mezcla del audio (y la reducción de ruido que esté corriendo) apenas se cancela. */
	private corte = new AbortController();

	constructor(
		private editor: EditorCore,
		private opciones: OpcionesExportar,
		private soporte: Partial<Record<CodecId, SoporteCodec>>,
		// `guardar: false` (para «Publicar», 29/10/2026): el video sale en memoria y va al Calendario, no a la carpeta.
		private opc: { guardar?: boolean } = {},
	) {}

	cancelar(): void {
		this.cancelada = true;
		this.corte.abort();
		this.exportador?.cancel();
	}

	async ejecutar(onProgreso: (p: number) => void): Promise<ResultadoExportar> {
		const { editor, opciones } = this;
		try {
			editor.playback.pause();
			const proyecto = editor.project.getActive();
			const tracks = editor.scenes.getActiveScene().tracks;
			const mediaAssets = editor.media.getAssets();
			const duracion = editor.timeline.getTotalDuration();
			if (!proyecto || duracion <= 0) return { estado: "error", mensaje: "El proyecto está vacío." };

			const lienzo = proyecto.settings.canvasSize;
			// El rango que puso el diálogo, vuelto a recortar a la duración de ahora.
			const tramo = opciones.tramo ? tramoEfectivo({ entrada: opciones.tramo.desde, salida: opciones.tramo.hasta }, duracion) : null;
			const segundos = segundosAExportar(tramo, duracion, TICKS_PER_SECOND);
			const base = nombreArchivo(opciones.nombre);
			const escena = buildScene({
				tracks,
				mediaAssets,
				duration: duracion,
				canvasSize: lienzo,
				background: proyecto.settings.background,
			});

			// Las etapas con su peso en la barra: el video es casi todo el trabajo.
			const conGif = opciones.gif.activo && segundos <= GIF_MAX_SEGUNDOS;
			const etapas = [
				{ id: "audio", peso: opciones.video.activo || opciones.audio.activo ? 0.05 : 0 },
				{ id: "video", peso: opciones.video.activo ? 1 : 0 },
				{ id: "gif", peso: conGif ? (opciones.video.activo ? 0.35 : 1) : 0 },
			];
			const total = etapas.reduce((s, e) => s + e.peso, 0) || 1;
			let hecho = 0;
			const avance = (id: string, p: number) => {
				const peso = etapas.find((e) => e.id === id)?.peso ?? 0;
				onProgreso(Math.min(1, (hecho + p * peso) / total));
			};
			const cerrarEtapa = (id: string) => {
				hecho += etapas.find((e) => e.id === id)?.peso ?? 0;
				onProgreso(Math.min(1, hecho / total));
			};

			const archivos: { blob: Blob; nombre: string }[] = [];

			// 1. La mezcla de audio, una sola vez: la usan el video y el audio aparte.
			let mezcla: AudioBuffer | null = null;
			if ((opciones.video.activo || opciones.audio.activo) && timelineHasAudio({ tracks, mediaAssets })) {
				avance("audio", 0);
				// Con un rango, sólo lo que suena en él: un clip de afuera no se decodifica ni se le reduce el ruido.
				mezcla = await createTimelineAudioBuffer({ tracks, mediaAssets, duration: duracion, tramo, signal: this.corte.signal });
				if (mezcla && tramo) mezcla = recortarAudio(mezcla, tramo);
			}
			cerrarEtapa("audio");
			if (this.cancelada) return { estado: "cancelado" };

			// 2. El video.
			if (opciones.video.activo) {
				const v = opciones.video;
				const fps = valorCuadros(v.cuadros);
				const salida = tamanoSalida({ lienzo, resolucion: v.resolucion });
				const bitrate = tasaDeBits({
					resolucion: v.resolucion,
					fps,
					codec: v.codec,
					tasa: v.tasa,
					personalizadaMbps: v.personalizadaMbps,
				});
				if (v.codec === "prores") return { estado: "error", mensaje: "Codec no disponible en el navegador." };
				this.exportador = new SceneExporter({
					width: lienzo.width,
					height: lienzo.height,
					fps: floatToFrameRate(fps),
					format: v.formato,
					quality: "high",
					salida,
					bitrate,
					bitrateMode: v.tasa === "personalizada" ? v.modoTasa : "variable",
					codec: v.codec,
					fullCodecString: this.soporte[v.codec]?.cadena,
					shouldIncludeAudio: !!mezcla,
					audioBuffer: mezcla ?? undefined,
					audioBitrate: AUDIO_BITRATE,
				});
				this.exportador.on("progress", (p) => avance("video", p));
				const buffer = await this.exportador.export({ rootNode: escena, tramo });
				this.exportador = null;
				if (this.cancelada || !buffer) return this.cancelada ? { estado: "cancelado" } : { estado: "error", mensaje: "No se pudo exportar." };
				archivos.push({
					blob: new Blob([buffer], { type: EXPORT_MIME_TYPES[v.formato] }),
					nombre: `${base}.${v.formato}`,
				});
				cerrarEtapa("video");
			}

			// 3. El audio aparte.
			if (opciones.audio.activo && mezcla) {
				const blob = await codificarAudio({ buffer: mezcla, formato: opciones.audio.formato });
				archivos.push({ blob, nombre: `${base}${EXTENSION_AUDIO[opciones.audio.formato]}` });
			}
			if (this.cancelada) return { estado: "cancelado" };

			// 4. Los subtítulos.
			if (opciones.subtitulos.activo) {
				const todos = subtitulosDe(tracks);
				const subtitulos = tramo ? subtitulosDelTramo(todos, tramoEnSegundos(tramo, TICKS_PER_SECOND)) : todos;
				if (subtitulos.length > 0) {
					archivos.push({
						blob: archivoSubtitulos({ subtitulos, formato: opciones.subtitulos.formato }),
						nombre: `${base}.${opciones.subtitulos.formato}`,
					});
				}
			}

			// 5. El GIF.
			if (conGif) {
				const blob = await exportarGif({
					escena,
					lienzo,
					resolucion: opciones.gif.resolucion,
					fps: proyecto.settings.fps,
					onProgreso: (p) => avance("gif", p),
					cancelado: () => this.cancelada,
					tramo,
				});
				if (!blob) return { estado: "cancelado" };
				archivos.push({ blob, nombre: `${base}.gif` });
				cerrarEtapa("gif");
			}

			if (archivos.length === 0) return { estado: "error", mensaje: "No hay nada para exportar." };
			if (this.opc.guardar !== false) for (const archivo of archivos) await guardarArchivo(archivo);
			onProgreso(1);
			const video = archivos.find((a) => a.blob.type.startsWith("video/")) ?? null;
			return { estado: "listo", archivos: archivos.map((a) => a.nombre), video };
		} catch (error) {
			// Cancelar corta la mezcla con un AbortError: no es una falla.
			if (this.cancelada) return { estado: "cancelado" };
			console.error("[exportar] falló", error);
			// El crudo ya quedó en la consola (arriba): acá va la frase para la persona.
			return { estado: "error", mensaje: mensajeDeExport(error) };
		} finally {
			refrescarReproductor(editor);
		}
	}
}

/**
 * El reproductor redibuja sólo cuando cambia el cuadro o el árbol de render
 * (preview/components/index.tsx). Después de exportar, el canvas del compositor
 * quedó con el último cuadro exportado (y quizá con otro tamaño): se le entrega
 * un árbol NUEVO con el mismo contenido, que lo obliga a dibujar el cuadro actual.
 */
export function refrescarReproductor(editor: EditorCore): void {
	const proyecto = editor.project.getActiveOrNull();
	if (!proyecto) return;
	const tracks = editor.timeline.getPreviewTracks() ?? editor.scenes.getActiveScene().tracks;
	editor.renderer.setRenderTree({
		renderTree: buildScene({
			tracks,
			mediaAssets: editor.media.getAssets(),
			duration: editor.timeline.getTotalDuration(),
			canvasSize: proyecto.settings.canvasSize,
			background: proyecto.settings.background,
			isPreview: true,
		}),
	});
}

/**
 * Las muestras del tramo, en un búfer nuevo que arranca en 0 (la mezcla cubre la
 * línea entera). Un tramo sin muestras deja el video sin audio.
 */
function recortarAudio(mezcla: AudioBuffer, tramo: Tramo): AudioBuffer | null {
	const { inicio, cantidad } = muestrasDelTramo(tramo, TICKS_PER_SECOND, mezcla.sampleRate, mezcla.length);
	if (cantidad <= 0) return null;
	const recorte = new AudioBuffer({ length: cantidad, numberOfChannels: mezcla.numberOfChannels, sampleRate: mezcla.sampleRate });
	for (let c = 0; c < mezcla.numberOfChannels; c++) {
		recorte.copyToChannel(mezcla.getChannelData(c).subarray(inicio, inicio + cantidad), c);
	}
	return recorte;
}

/**
 * La portada: el primer cuadro (el de la entrada, si hay un rango), chico, como
 * dataURL (columna izquierda del diálogo).
 */
export async function portada(editor: EditorCore, ancho = 480, tiempo = 0): Promise<string | null> {
	try {
		const proyecto = editor.project.getActive();
		const duracion = editor.timeline.getTotalDuration();
		if (!proyecto || duracion <= 0) return null;
		const lienzo = proyecto.settings.canvasSize;
		const escena = buildScene({
			tracks: editor.scenes.getActiveScene().tracks,
			mediaAssets: editor.media.getAssets(),
			duration: duracion,
			canvasSize: lienzo,
			background: proyecto.settings.background,
		});
		const renderer = new CanvasRenderer({ width: lienzo.width, height: lienzo.height, fps: proyecto.settings.fps });
		const canvas = document.createElement("canvas");
		canvas.width = ancho;
		canvas.height = Math.max(2, Math.round((ancho * lienzo.height) / lienzo.width));
		await renderer.renderToCanvas({ node: escena, time: Math.max(0, Math.min(tiempo, duracion)), targetCanvas: canvas });
		return canvas.toDataURL("image/jpeg", 0.85);
	} catch (error) {
		console.warn("[exportar] no se pudo dibujar la portada", error);
		return null;
	} finally {
		refrescarReproductor(editor);
	}
}
