"use client";

// =============================================================================
// El contenido de las pestañas de RESPALDO (ver ./respaldo.ts)
// =============================================================================
// Mientras el paquete dueño no registre la pestaña de verdad, el elemento sigue
// mostrando los parámetros que el motor ya sabe editar, con el kit de CapCut:
//
//   Texto (elemento de texto)   los del texto + Transformación + Mezcla.
//   Básico (audio) / Audio (video con sonido)   los del audio, incluidos los que
//                               sume params/extra (fundidos, por ejemplo).
//   Efectos (efecto en su pista)   los parámetros de la definición del efecto.

import { effectsRegistry, registerDefaultEffects } from "@/app/video-editor/_opencut/effects";
import type { ParamDefinition } from "@/app/video-editor/_opencut/params";
import {
	getElementParams,
	readElementParamValue,
	type ElementParamDefinition,
} from "@/app/video-editor/_opencut/params/registry";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { PARAM_SUBTITULO } from "@/app/video-editor/_opencut/params/extra/subtitulos";
import { CampoParam, SeccionCe, paramsVisibles } from "./components/kit";
import { SeccionMezcla, SeccionTransformacion } from "./video/basico";

const CLAVES_VISUALES = new Set([
	"transform.scaleX",
	"transform.scaleY",
	"transform.positionX",
	"transform.positionY",
	"transform.rotate",
	"opacity",
	"blendMode",
]);

function ListaParams({
	element,
	trackId,
	params,
}: {
	element: TimelineElement;
	trackId: string;
	params: readonly ElementParamDefinition[];
}) {
	const valores = Object.fromEntries(
		params.map((p) => [p.key, readElementParamValue({ element, param: p }) ?? p.default]),
	);
	return (
		<>
			{paramsVisibles(params, valores).map((param) => (
				<CampoParam key={param.key} element={element} trackId={trackId} param={param} />
			))}
		</>
	);
}

export function RespaldoTexto({ element, track }: ContextoInspector) {
	// `subtitulo` es una MARCA (params/extra/subtitulos.ts), no un control: como
	// interruptor dejaría convertir cualquier texto en subtítulo a mano.
	const params = getElementParams({ element }).filter(
		(p) => !CLAVES_VISUALES.has(p.key) && p.key !== PARAM_SUBTITULO,
	);
	return (
		<div className="flex flex-col pt-1">
			<SeccionCe titulo="Básico" clave="ce:respaldo:texto">
				<ListaParams element={element} trackId={track.id} params={params} />
			</SeccionCe>
			<SeccionTransformacion element={element} trackId={track.id} />
			<SeccionMezcla element={element} trackId={track.id} />
		</div>
	);
}

/** Lo que es de AUDIO: volumen, silencio y lo que sume params/extra con `audio.`.
 *  El clip de video trae además reflejo, recorte, animaciones…, que no van acá. */
const esParamDeAudio = (key: string) =>
	key === "volume" || key === "muted" || key.startsWith("audio.");

export function RespaldoAudio({ element, track }: ContextoInspector) {
	const params = getElementParams({ element }).filter(
		(p) => !CLAVES_VISUALES.has(p.key) && esParamDeAudio(p.key),
	);
	return (
		<div className="flex flex-col pt-1">
			<SeccionCe titulo="Audio" plegable={false}>
				<ListaParams element={element} trackId={track.id} params={params} />
			</SeccionCe>
		</div>
	);
}

export function RespaldoEfecto({ element, track }: ContextoInspector) {
	if (element.type !== "effect") return null;
	registerDefaultEffects();
	if (!effectsRegistry.has(element.effectType)) return null;
	const definicion = effectsRegistry.get(element.effectType);
	// Los parámetros del efecto viven en `element.params` del elemento efecto.
	// Sin ◇: la ruta de animación de un efecto-capa la define su paquete.
	const params: ElementParamDefinition[] = definicion.params.map((p: ParamDefinition) => ({
		...p,
		keyframable: false,
		read: ({ element: el }) => el.params[p.key] ?? p.default,
		write: ({ element: el, value }) =>
			({ ...el, params: { ...el.params, [p.key]: value } }) as TimelineElement,
	}));
	return (
		<div className="flex flex-col pt-1">
			<SeccionCe titulo={definicion.name} plegable={false}>
				<ListaParams element={element} trackId={track.id} params={params} />
			</SeccionCe>
		</div>
	);
}
