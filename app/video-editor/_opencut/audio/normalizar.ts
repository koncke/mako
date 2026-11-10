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
import { INTENSIDAD_MEDIDA, medidaDePedazos, NORMALIZAR, NORMALIZAR_OBJETIVO, OBJETIVO_PREDETERMINADO } from "./claves";
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

/**
 * «Normalizar» varios pedazos del MISMO video como uno solo (la «Edición automática», enjambre/correr.ts): se mide la
 * sonoridad de todos juntos, en el orden en que suenan, y a todos se les escribe la MISMA medida, así les toca la misma
 * ganancia. Medidos de a uno, después de «Borrar silencios» cada pedazo quedaba con su propio nivel (uno casi todo
 * respiración subía más que uno con la voz entera) y el volumen saltaba de corte en corte (revisión del 9/11/2026).
 * Cada pedazo se mide también solo: el que se aparta más de `TOLERANCIA_PEDAZO_LU` del conjunto es otra toma y va con
 * la suya (claves.ts → medidaDePedazos), así una toma lejos del micrófono no queda casi muda. UN paso de deshacer. Devuelve cuántos pedazos quedaron normalizados (0 si no había sonido que medir).
 */
export async function normalizarJuntos({
	editor,
	clips,
	mediaAssets,
	objetivo,
	onProgreso,
}: {
	editor: EditorCore;
	clips: ReadonlyArray<{ trackId: string; element: ClipConAudio }>;
	mediaAssets: readonly MediaAsset[];
	/** El valor del motor (`OBJETIVOS_NORMALIZAR[...]`, en LUFS como texto). */
	objetivo: string;
	onProgreso?: (fraccion: number) => void;
}): Promise<number> {
	if (!clips.length) return 0;
	const ordenados = [...clips].sort((a, b) => a.element.startTime - b.element.startTime);
	const estado = { medidor: null as MedidorIntensidad | null, sampleRate: 0, mezcla: false };
	// Cada pedazo también se mide solo: el que se aparta mucho del conjunto (otra toma) va con su medida (claves.ts).
	const propias: Array<number | null> = [];
	let leidos = 0;
	for (const { element } of ordenados) {
		const propio = { medidor: null as MedidorIntensidad | null };
		const duracion = element.duration / TICKS_PER_SECOND;
		const desde = element.trimStart / TICKS_PER_SECOND;
		const tramo = getSourceTimeAtClipTime({ clipTime: duracion, retime: element.retime, clipDuration: duracion });
		const ok = await recorrerFuente({
			element,
			mediaAssets,
			desde,
			hasta: desde + tramo,
			alTrozo: ({ canales, sampleRate }) => {
				if (estado.sampleRate && sampleRate !== estado.sampleRate) {
					estado.mezcla = true;
					return;
				}
				estado.sampleRate = sampleRate;
				estado.medidor ??= new MedidorIntensidad(sampleRate);
				estado.medidor.agregar(canales);
				propio.medidor ??= new MedidorIntensidad(sampleRate);
				propio.medidor.agregar(canales);
			},
		});
		const suyo = ok && propio.medidor ? propio.medidor.resultado() : Number.NaN;
		propias.push(Number.isFinite(suyo) ? suyo : null);
		if (ok) leidos++;
		onProgreso?.(leidos / ordenados.length);
	}
	// Dos frecuencias de muestreo no se miden en el mismo medidor (los filtros dependen de ella): no pasa con los
	// pedazos de un mismo archivo; si pasara, cada pedazo se mide solo, como el botón.
	if (estado.mezcla) {
		let hechos = 0;
		for (const { trackId, element } of ordenados) {
			const clip = { ...element, params: { ...element.params, [NORMALIZAR_OBJETIVO]: objetivo } } as ClipConAudio;
			if (await alternarNormalizacion({ editor, trackId, element: clip, mediaAssets, activar: true }).catch(() => null)) hechos++;
		}
		return hechos;
	}
	const lufs = estado.medidor?.resultado();
	const conjunta = lufs !== undefined && Number.isFinite(lufs) ? lufs : null;
	const medidas = medidaDePedazos(propias, conjunta);
	const porId = new Map(ordenados.map(({ element }, i) => [element.id, medidas[i]] as const));
	// Se escribe sobre los clips ACTUALES: medir tarda y la persona pudo cambiar algo. Un pedazo sin sonido que medir
	// (ni él ni el conjunto) queda como estaba.
	const actuales = editor.timeline.getElementsWithTracks({ elements: ordenados.map(({ trackId, element }) => ({ trackId, elementId: element.id })) });
	const updates = actuales.flatMap(({ track, element }) => {
		const medida = porId.get(element.id);
		if (medida === null || medida === undefined) return [];
		return [
			{
				trackId: track.id,
				elementId: element.id,
				patch: { params: { ...element.params, [NORMALIZAR]: true, [INTENSIDAD_MEDIDA]: Math.round(medida * 100) / 100, [NORMALIZAR_OBJETIVO]: objetivo } },
			},
		];
	});
	if (!updates.length) return 0;
	editor.timeline.updateElements({ updates });
	return updates.length;
}
