// =============================================================================
// «Normalizar la intensidad»: medir el clip y guardar lo medido
// =============================================================================
// Como CapCut: al prender la casilla se mide la sonoridad del TRAMO que suena
// (del recorte, a la velocidad que tenga) y se guarda en el clip
// (`audio.intensidad`, el `avg_loudness` del borrador). La ganancia la calcula
// después `gananciaNormalizacion` (audio/claves.ts) contra el objetivo elegido,
// así cambiar de «Predeterminado» a «TikTok» no vuelve a medir.

import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import { getSourceTimeAtClipTime } from "@/app/video-editor/_opencut/retime";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { INTENSIDAD_MEDIDA, NORMALIZAR, NORMALIZAR_OBJETIVO, OBJETIVO_PREDETERMINADO } from "./claves";
import { recorrerFuente, type ClipConAudio } from "./decodificar";
import { MedidorIntensidad } from "./dsp/intensidad";

/** La sonoridad integrada del tramo del clip, en LUFS; null si es silencio o no se pudo leer. */
export async function medirIntensidadClip({
	element,
	mediaAssets,
	onProgreso,
}: {
	element: ClipConAudio;
	mediaAssets: readonly MediaAsset[];
	onProgreso?: (fraccion: number) => void;
}): Promise<number | null> {
	const duracion = element.duration / TICKS_PER_SECOND;
	const desde = element.trimStart / TICKS_PER_SECOND;
	const tramo = getSourceTimeAtClipTime({ clipTime: duracion, retime: element.retime, clipDuration: duracion });
	const hasta = desde + tramo;
	const estado = { medidor: null as MedidorIntensidad | null };
	const ok = await recorrerFuente({
		element,
		mediaAssets,
		desde,
		hasta,
		alTrozo: ({ canales, sampleRate, inicio }) => {
			estado.medidor ??= new MedidorIntensidad(sampleRate);
			estado.medidor.agregar(canales);
			if (tramo > 0) onProgreso?.(Math.min(1, Math.max(0, (inicio - desde) / tramo)));
		},
	});
	if (!ok || !estado.medidor) return null;
	const lufs = estado.medidor.resultado();
	return Number.isFinite(lufs) ? lufs : null;
}

/**
 * Prende o apaga la normalización del clip (UN paso de deshacer). Al prender
 * mide; devuelve el objetivo aplicado, o null si el clip no tiene sonido que
 * medir.
 */
export async function alternarNormalizacion({
	editor,
	trackId,
	element,
	mediaAssets,
	activar,
	onProgreso,
}: {
	editor: EditorCore;
	trackId: string;
	element: ClipConAudio;
	mediaAssets: readonly MediaAsset[];
	activar: boolean;
	onProgreso?: (fraccion: number) => void;
}): Promise<string | null> {
	if (!activar) {
		editor.timeline.updateElements({
			updates: [{ trackId, elementId: element.id, patch: { params: { ...element.params, [NORMALIZAR]: false } } }],
		});
		return null;
	}
	const medida = await medirIntensidadClip({ element, mediaAssets, onProgreso });
	if (medida === null) return null;
	const objetivo =
		typeof element.params[NORMALIZAR_OBJETIVO] === "string"
			? String(element.params[NORMALIZAR_OBJETIVO])
			: OBJETIVO_PREDETERMINADO;
	// Se escribe sobre el clip ACTUAL: medir un video largo tarda y pudo cambiar.
	const [actual] = editor.timeline.getElementsWithTracks({ elements: [{ trackId, elementId: element.id }] });
	const base = actual?.element ?? element;
	editor.timeline.updateElements({
		updates: [
			{
				trackId,
				elementId: element.id,
				patch: {
					params: {
						...base.params,
						[NORMALIZAR]: true,
						[INTENSIDAD_MEDIDA]: Math.round(medida * 100) / 100,
						[NORMALIZAR_OBJETIVO]: objetivo,
					},
				},
			},
		],
	});
	return objetivo;
}
