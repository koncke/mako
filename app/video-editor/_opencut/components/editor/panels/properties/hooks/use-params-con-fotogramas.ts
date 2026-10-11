"use client";

// =============================================================================
// Un grupo de parámetros del elemento con su ◇ «Fotograma clave»
// =============================================================================
// En CapCut el rombo va por PROPIEDAD, no por número: «Posición» es X e Y con
// un solo ◇, y «Escala» con «Escala uniforme» es X e Y a la vez. El gancho de
// OpenCut (use-keyframed-param-property) maneja un parámetro solo; este maneja
// un grupo y hace lo mismo que él para cada uno:
//
//   · si el grupo ya tiene fotogramas clave y el cabezal está sobre el clip, un
//     cambio escribe (o crea) el fotograma en ese instante, como CapCut;
//   · si no, cambia el valor base del parámetro.
//
// `rutas` cambia la ruta de animación de una clave cuando no es la clave misma:
// los parámetros de una FORMA (graphic) se animan en `params.<clave>`, los de un
// efecto del clip en `effects.<id>.params.<clave>`. Para esos, el parámetro trae
// su `read`/`write` (ElementParamDefinition) y acá se pasa la ruta.
//
// La vista previa se arma en UN solo `previewElements` con todos los cambios:
// el overlay de vista previa del motor se mezcla por campo del elemento, y dos
// llamadas seguidas con `params` distintos se pisarían (la segunda borra la X
// que puso la primera).
//
// Las escrituras parten SIEMPRE del elemento confirmado (`element`), no del de
// la vista previa: así arrastrar un deslizador recalcula desde el mismo punto y
// no acumula. Lo que se MUESTRA sale del elemento vivo (useElementPreview), para
// que el número se mueva mientras arrastrás.

import { useMemo } from "react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	getElementKeyframes,
	getKeyframeAtTime,
	hasKeyframesForPath,
	resolveAnimationPathValueAtTime,
	upsertPathKeyframe,
} from "@/app/video-editor/_opencut/animation";
import type { ElementAnimations } from "@/app/video-editor/_opencut/animation/types";
import {
	coerceParamValue,
	getParamChannelLayout,
	type ParamValue,
} from "@/app/video-editor/_opencut/params";
import {
	readElementParamValue,
	writeElementParamValue,
	type ElementParamDefinition,
} from "@/app/video-editor/_opencut/params/registry";
import type { TimelineElement, VisualElement } from "@/app/video-editor/_opencut/timeline";
import { useElementPreview } from "@/app/video-editor/_opencut/timeline/hooks/use-element-preview";
import { addMediaTime, mediaTime, type MediaTime } from "@/app/video-editor/_opencut/wasm";
import { useElementPlayhead } from "./use-element-playhead";

export type ParamsConFotogramas = {
	/** Valores en el cabezal (keyframes incluidos), del elemento vivo. */
	valores: Record<string, ParamValue>;
	/** El cabezal está sobre el clip (si no, el ◇ va apagado, como en CapCut). */
	dentro: boolean;
	tieneFotogramas: boolean;
	enFotograma: boolean;
	/** Tiempo de la línea de tiempo del fotograma anterior / siguiente del grupo. */
	anterior: MediaTime | null;
	siguiente: MediaTime | null;
	previsualizar: (cambios: Record<string, ParamValue>) => void;
	confirmar: () => void;
	/** previsualizar + confirmar: un clic, un paso de deshacer. */
	aplicar: (cambios: Record<string, ParamValue>) => void;
	alternarFotograma: () => void;
	/** Vuelve todo el grupo al valor por defecto y le saca los fotogramas clave. */
	restablecer: () => void;
	esPorDefecto: boolean;
	irA: (tiempo: MediaTime) => void;
};

export function useParamsConFotogramas({
	element,
	trackId,
	params,
	rutas,
}: {
	element: TimelineElement;
	trackId: string;
	params: readonly ElementParamDefinition[];
	/** Clave → ruta de animación, si no es la clave misma. */
	rutas?: Readonly<Record<string, string>>;
}): ParamsConFotogramas {
	const editor = useEditor();
	const { renderElement: vivo } = useElementPreview({
		trackId,
		elementId: element.id,
		fallback: element,
	});
	const { localTime, isPlayheadWithinElementRange: dentro } = useElementPlayhead({
		startTime: element.startTime,
		duration: element.duration,
	});

	const porClave = useMemo(
		() => new Map(params.map((param) => [param.key, param])),
		[params],
	);
	const animables = params.filter((param) => param.keyframable !== false);
	const ruta = (key: string) => rutas?.[key] ?? key;

	const valores: Record<string, ParamValue> = {};
	for (const param of params) {
		const base = readElementParamValue({ element: vivo, param }) ?? param.default;
		valores[param.key] =
			param.keyframable === false
				? base
				: resolveAnimationPathValueAtTime({
						animations: vivo.animations,
						propertyPath: ruta(param.key),
						localTime,
						fallbackValue: base,
					});
	}

	const tieneFotogramas = animables.some((param) =>
		hasKeyframesForPath({ animations: vivo.animations, propertyPath: ruta(param.key) }),
	);
	const fotogramasEnCabezal = dentro
		? animables.flatMap((param) => {
				const kf = getKeyframeAtTime({
					animations: element.animations,
					propertyPath: ruta(param.key),
					time: localTime,
				});
				return kf ? [{ propertyPath: ruta(param.key), keyframeId: kf.id }] : [];
			})
		: [];
	const enFotograma = fotogramasEnCabezal.length > 0;

	const claves = new Set(animables.map((param) => ruta(param.key)));
	const tiempos = getElementKeyframes({ animations: vivo.animations })
		.filter((kf) => claves.has(kf.propertyPath))
		.map((kf) => kf.time);
	const previo = tiempos.filter((t) => t < localTime);
	const proximo = tiempos.filter((t) => t > localTime);
	const aLinea = (t: number) =>
		addMediaTime({ a: element.startTime, b: mediaTime({ ticks: t }) });
	const anterior = previo.length > 0 ? aLinea(Math.max(...previo)) : null;
	const siguiente = proximo.length > 0 ? aLinea(Math.min(...proximo)) : null;

	const usaCanal = tieneFotogramas && dentro;

	const construir = (cambios: Record<string, ParamValue>): Partial<TimelineElement> => {
		let base: TimelineElement = element;
		let animations: ElementAnimations | undefined = element.animations;
		let tocoBase = false;
		for (const [key, value] of Object.entries(cambios)) {
			const param = porClave.get(key);
			if (!param) continue;
			if (usaCanal && param.keyframable !== false) {
				animations = upsertPathKeyframe({
					animations,
					propertyPath: ruta(key),
					time: localTime,
					value,
					channelLayout: getParamChannelLayout({ param }),
					coerceValue: ({ value: v }) => coerceParamValue({ param, value: v }),
				});
				continue;
			}
			base = writeElementParamValue({ element: base, param, value });
			tocoBase = true;
		}
		if (!usaCanal) return base;
		return tocoBase ? { ...base, animations } : { animations };
	};

	const previsualizar = (cambios: Record<string, ParamValue>) => {
		editor.timeline.previewElements({
			updates: [{ trackId, elementId: element.id, updates: construir(cambios) }],
		});
	};
	const confirmar = () => editor.timeline.commitPreview();

	const alternarFotograma = () => {
		if (!dentro) return;
		if (enFotograma) {
			editor.timeline.removeKeyframes({
				keyframes: fotogramasEnCabezal.map((kf) => ({
					trackId,
					elementId: element.id,
					...kf,
				})),
			});
			return;
		}
		editor.timeline.upsertKeyframes({
			keyframes: animables.map((param) => ({
				trackId,
				elementId: element.id,
				propertyPath: ruta(param.key),
				time: localTime,
				value: valores[param.key] ?? param.default,
			})),
		});
	};

	const esPorDefecto = params.every((param) => valores[param.key] === param.default);

	const restablecer = () => {
		let base: TimelineElement = element;
		for (const param of params) {
			base = writeElementParamValue({ element: base, param, value: param.default });
		}
		const patch: Partial<TimelineElement> = { params: base.params };
		// Un param de un efecto del clip (su `write` escribe en `effects[i].params`)
		// cambia `effects`, no `params`: sin esto el ↺ no restablecía nada.
		if ("effects" in base && base.effects !== (element as VisualElement).effects) {
			(patch as Partial<VisualElement>).effects = base.effects;
		}
		if (element.animations && animables.length > 0) {
			const resto = { ...element.animations };
			for (const param of animables) delete resto[ruta(param.key)];
			patch.animations = Object.keys(resto).length > 0 ? resto : undefined;
		}
		editor.timeline.updateElements({
			updates: [{ trackId, elementId: element.id, patch }],
		});
	};

	return {
		valores,
		dentro,
		tieneFotogramas,
		enFotograma,
		anterior,
		siguiente,
		previsualizar,
		confirmar,
		aplicar: (cambios) => {
			previsualizar(cambios);
			confirmar();
		},
		alternarFotograma,
		restablecer,
		esPorDefecto,
		irA: (tiempo) => editor.playback.seek({ time: tiempo }),
	};
}
