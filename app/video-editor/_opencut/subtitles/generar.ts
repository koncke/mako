// =============================================================================
// «Generar» de Subtítulos automáticos: de la línea de tiempo a subtítulos
// =============================================================================
//   audio de la línea de tiempo → 16 kHz mono → Whisper en el navegador
//   (palabras con tiempo) → sin marcas de no-voz → sin muletillas (si se pidió)
//   → subtítulos cortados por pausas y largo → pista «Subtítulos» con la
//   plantilla elegida (o el preset de la marca) y, si se pidió, las palabras
//   clave de cada uno (./claves.ts).
//
// Todo local y gratis: el audio no sale de la máquina del cliente (decisión 6 de
// docs/diseno-editor-video.md). Lo único que baja de internet es el modelo, una
// vez.

import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { extractTimelineAudio } from "@/app/video-editor/_opencut/media/mediabunny";
import { decodificarMono16k } from "@/app/video-editor/_opencut/transcription/audio";
import { armarSubtitulos, conMuletillas, quitarNoVoz } from "@/app/video-editor/_opencut/transcription/caption";
import { maxCaracteresPara } from "@/app/video-editor/_opencut/transcription/caption-defaults";
import { quitarMuletillas } from "@/app/video-editor/_opencut/transcription/muletillas";
import {
	TranscripcionCancelada,
	transcriptionService,
} from "@/app/video-editor/_opencut/services/transcription/service";
import { paramsDePlantilla, plantillaPorId } from "./estilos";
import { usePreferenciasSubtitulos, useTrabajoSubtitulos } from "./estado";
import { insertarSubtitulos, lienzoDe, type ModoClaves } from "./insert";
import { estiloDePreset, modoClavesDePreset, presetDeId, usePresetsSubtitulos } from "./presets";
import { ponerEmojisEnSubtitulos } from "./emojis-poner";
import { faltaAlgunArchivo, motivoDeLaFalla, textoDeSubtitulos, type MotivoSubtitulos, type ResultadoSubtitulos } from "./resultado";

// Cada «Generar» lleva un número; cancelar lo cambia. Un trabajo que vuelve de
// una espera y ya no es el actual (lo cancelaron, quizás arrancó otro) no escribe
// nada. Con un booleano, cancelar y volver a generar enseguida dejaba al viejo
// seguir como si nada.
let trabajoActual = 0;

export function cancelarGeneracion(): void {
	trabajoActual++;
	transcriptionService.cancel();
	useTrabajoSubtitulos.getState().fijar({ fase: "inactivo", progreso: 0, error: null });
}

const CANCELADO: ResultadoSubtitulos = { ok: false, motivo: "cancelado" };

/**
 * No lanza: cada salida es un resultado (./resultado.ts). Lo que no sale queda además
 * abajo del botón, con el mismo texto que dice el chat. «Ocupado» y «cancelado» no tocan
 * el store: es de otro trabajo.
 */
export async function generarSubtitulos(editor: EditorCore): Promise<ResultadoSubtitulos> {
	const trabajo = useTrabajoSubtitulos.getState();
	if (trabajo.fase !== "inactivo") return { ok: false, motivo: "ocupado" };
	const { fijar } = trabajo;
	const falla = (motivo: MotivoSubtitulos): ResultadoSubtitulos => {
		fijar({ fase: "inactivo", progreso: 0, error: textoDeSubtitulos(motivo) });
		return { ok: false, motivo };
	};
	const prefs = usePreferenciasSubtitulos.getState();
	const proyecto = editor.project.getActiveOrNull()?.metadata.id;
	if (!proyecto || !editor.scenes.getActiveSceneOrNull()) return falla("sin-proyecto");
	if (faltaAlgunArchivo(editor.scenes.getActiveScene().tracks, new Set(editor.media.getAssets().map((a) => a.id)))) {
		return falla("falta-medio");
	}

	const mio = ++trabajoActual;
	const cancelado = () => mio !== trabajoActual;
	fijar({ fase: "audio", progreso: 0, error: null });
	try {
		const blob = await extractTimelineAudio({
			tracks: editor.scenes.getActiveScene().tracks,
			mediaAssets: editor.media.getAssets(),
			totalDuration: editor.timeline.getTotalDuration(),
			onProgress: (p) => {
				if (!cancelado()) fijar({ progreso: Math.round(p) });
			},
		});
		if (cancelado()) return CANCELADO;
		const muestras = await decodificarMono16k(blob);
		if (cancelado()) return CANCELADO;

		const resultado = await transcriptionService.transcribe({
			audioData: muestras,
			language: prefs.idioma,
			onProgress: (p) => {
				if (!cancelado()) {
					fijar({
						fase: p.status === "loading-model" ? "modelo" : "transcribiendo",
						progreso: Math.round(p.progress),
					});
				}
			},
		});
		if (cancelado()) return CANCELADO;

		fijar({ fase: "armando", progreso: 100 });
		if (resultado.precision === "segmento") {
			// No es un error (los subtítulos salen igual), pero sus tiempos son
			// repartidos dentro de cada frase: que quede a la vista en la consola.
			console.warn("[subtítulos] sin marcas por palabra: tiempos repartidos por frase");
		}
		let palabras = quitarNoVoz(resultado.palabras);
		let muletillas: typeof palabras = [];
		if (prefs.muletillas) {
			const sin = quitarMuletillas({ palabras, idioma: resultado.language });
			palabras = sin.palabras;
			muletillas = sin.sacadas;
		}

		// El cliente pudo abrir otro proyecto mientras tanto: no se escribe en él.
		if (editor.project.getActiveOrNull()?.metadata.id !== proyecto) return falla("otro-proyecto");
		const lienzo = lienzoDe(editor);
		// Cada subtítulo se queda con sus palabras y su precisión (subtitles/palabras.ts), y
		// con las muletillas de su tramo marcadas: se sacaron del texto, pero sus tiempos
		// son los que hacen falta para sacarlas del video.
		const captions = conMuletillas(
			armarSubtitulos({ palabras, maxCaracteres: maxCaracteresPara(lienzo) }),
			muletillas,
		).map((c) => ({ ...c, precision: resultado.precision }));
		// `pc_fail_to_recognize_voice`.
		if (captions.length === 0) return falla("sin-voz");
		// La plantilla elegida puede ser un preset de la marca: trae su color de las claves y
		// sus palabras de siempre. Sin preset, las claves salen solas si el interruptor está.
		const preset = presetDeId(prefs.plantilla, usePresetsSubtitulos.getState().presets);
		const conClavesSolas: ModoClaves | null = prefs.claves
			? { tipo: "auto", siempre: preset?.claves.siempre }
			: preset
				? modoClavesDePreset(preset)
				: null;
		const puestos = await insertarSubtitulos({
			editor,
			captions,
			estilo: preset ? estiloDePreset(preset, lienzo) : paramsDePlantilla(plantillaPorId(prefs.plantilla), lienzo),
			reemplazar: prefs.eliminarActuales,
			claves: conClavesSolas,
		});
		// Con subtítulos para poner, 0 es que la escena ya no estaba.
		if (puestos === 0) return falla("sin-proyecto");
		// «Emojis automáticos»: después de poner los subtítulos (los lee para elegir), en su propio paso de deshacer.
		if (prefs.emojis) ponerEmojisEnSubtitulos({ editor, activar: true });
		fijar({ fase: "inactivo", progreso: 0 });
		// `pc_copywriting_split`.
		toast.success("Subtítulos generados");
		return { ok: true, subtitulos: puestos };
	} catch (error) {
		// Cancelado: el estado ya lo dejó `cancelarGeneracion` (y puede ser de otro
		// trabajo que arrancó después): no se toca.
		if (cancelado()) return CANCELADO;
		if (error instanceof TranscripcionCancelada) {
			fijar({ fase: "inactivo", progreso: 0 });
			return CANCELADO;
		}
		console.error("[subtítulos] no se pudieron generar", error);
		// `pc_tts_download_failed` / `pc_fail_to_recognize`.
		return falla(motivoDeLaFalla(useTrabajoSubtitulos.getState().fase));
	}
}
