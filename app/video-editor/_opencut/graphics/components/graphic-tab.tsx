"use client";

// =============================================================================
// «Formas»: el panel de una forma (elemento graphic del motor)
// =============================================================================
// CapCut tiene formas desde la 9.x (pestaña de propiedades «Formas»): Rellenar
// (Color), Trazo (Color, Peso) y Radio de las esquinas. Los parámetros son los de
// la definición del motor (graphics/definitions/*), con el rótulo de CapCut:
// las definiciones traen el suyo en inglés y no se tocan desde acá (también los
// lee la biblioteca), se traducen por clave.
//
// Los parámetros de una forma viven en `element.params` pero NO están en el
// registro de params/registry (son de la definición): se animan en la ruta
// `params.<clave>` y se leen/escriben a mano. Por eso cada uno pasa con su
// `read`/`write` y su ruta al kit del panel.

import { useState } from "react";
import type { ParamDefinition } from "@/app/video-editor/_opencut/params";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";
import { buildGraphicParamPath } from "@/app/video-editor/_opencut/animation";
import type { GraphicElement, TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { graphicsRegistry, registerDefaultGraphics } from "@/app/video-editor/_opencut/graphics";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	CampoParam,
	SeccionCe,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { plantillaDeDefinicion } from "@/app/video-editor/_opencut/graphics/definitions/motion";
import { camposDe } from "@/lib/motion/plantillas";

registerDefaultGraphics();

const DEFAULT_STROKE_WIDTH = 2;

const ROTULOS: Record<string, string> = {
	fill: "Color",
	stroke: "Color",
	strokeWidth: "Peso",
	strokeAlign: "Posición",
	cornerRadius: "Radio de las esquinas",
	sides: "Lados",
	points: "Puntas",
	depth: "Profundidad",
};
const OPCIONES: Record<string, string> = {
	inside: "Dentro",
	center: "Centro",
	outside: "Fuera",
};

/** El parámetro de la definición, en castellano y con su lectura/escritura en `params`. */
function comoParamDeElemento(param: ParamDefinition): ElementParamDefinition {
	const traducido = {
		...param,
		label: ROTULOS[param.key] ?? param.label,
		...(param.type === "select"
			? { options: param.options.map((o) => ({ ...o, label: OPCIONES[o.value] ?? o.label })) }
			: {}),
	} as ParamDefinition;
	return {
		...traducido,
		read: ({ element }) => element.params[param.key] ?? param.default,
		write: ({ element, value }) =>
			({ ...element, params: { ...element.params, [param.key]: value } }) as TimelineElement,
	};
}

/** La pestaña registrada en la ranura del panel derecho. */
export function FormaCe({ element, track }: ContextoInspector) {
	if (element.type !== "graphic") return null;
	return <GraphicTab element={element} trackId={track.id} />;
}

export function GraphicTab({
	element,
	trackId,
}: {
	element: GraphicElement;
	trackId: string;
}) {
	const definition = graphicsRegistry.get(element.definitionId);
	if (definition.animado) return <MotionTab element={element} trackId={trackId} params={definition.params} />;
	const forma = definition.params.filter((p) => p.group !== "stroke");
	const trazo = definition.params.filter((p) => p.group === "stroke");
	const relleno = forma.filter((p) => p.key === "fill");
	const resto = forma.filter((p) => p.key !== "fill");

	return (
		<div className="flex flex-col pt-1">
			{relleno.length > 0 && (
				<SeccionCe titulo="Rellenar" clave="ce:forma:rellenar">
					{relleno.map((p) => (
						<Campo key={p.key} element={element} trackId={trackId} param={p} />
					))}
				</SeccionCe>
			)}
			{trazo.length > 0 && <SeccionTrazo element={element} trackId={trackId} params={trazo} />}
			{resto.length > 0 && (
				<SeccionCe titulo="Formas" clave="ce:forma:forma">
					{resto.map((p) => (
						<Campo key={p.key} element={element} trackId={trackId} param={p} />
					))}
				</SeccionCe>
			)}
		</div>
	);
}

/**
 * Un motion graphic (lib/motion): «Textos» con el rótulo de cada campo arriba de su caja (son varios y el kit no lo
 * dibuja) y «Estilo» con el tono, la fuente, los colores y el fondo. Lo largo no se corta: el motor achica la letra, y
 * la fila avisa cuando un texto pasa el largo pensado para la plantilla.
 */
const ESTILO_MOTION = new Set(["tono", "fuente", "colorFondo", "colorTexto", "colorAcento", "colorPanel", "conFondo"]);
function MotionTab({ element, trackId, params }: { element: GraphicElement; trackId: string; params: ParamDefinition[] }) {
	const plantilla = plantillaDeDefinicion(element.definitionId);
	const topes = new Map(
		plantilla ? camposDe(plantilla).flatMap((c) => (c.tipo === "texto" ? [[c.clave, c.max] as const] : [])) : [],
	);
	const textos = params.filter((p) => !ESTILO_MOTION.has(p.key));
	const estilo = params.filter((p) => ESTILO_MOTION.has(p.key));
	return (
		<div className="flex flex-col pt-1" data-motion={plantilla ?? undefined}>
			<SeccionCe titulo="Textos" clave="ce:motion:textos">
				{textos.map((p) => {
					const tope = topes.get(p.key);
					const largo = String(element.params[p.key] ?? "").length;
					return (
						<div key={p.key} className="flex flex-col">
							{p.type === "text" && (
								<span className="flex items-baseline justify-between pt-1.5 text-[11px] text-(--cc-text-3)">
									{p.label}
									{tope !== undefined && largo > tope && (
										<span className="text-[10px] text-(--cc-text-2)">Largo: se achica la letra</span>
									)}
								</span>
							)}
							<Campo element={element} trackId={trackId} param={p} />
						</div>
					);
				})}
			</SeccionCe>
			<SeccionCe titulo="Estilo" clave="ce:motion:estilo">
				{estilo.map((p) => (
					<Campo key={p.key} element={element} trackId={trackId} param={p} />
				))}
			</SeccionCe>
		</div>
	);
}

function Campo({
	element,
	trackId,
	param,
}: {
	element: GraphicElement;
	trackId: string;
	param: ParamDefinition;
}) {
	return (
		<CampoParam
			element={element}
			trackId={trackId}
			param={comoParamDeElemento(param)}
			ruta={buildGraphicParamPath({ paramKey: param.key })}
		/>
	);
}

/** «☑ Trazo»: la casilla prende el trazo (peso 2) o lo apaga (peso 0). */
function SeccionTrazo({
	element,
	trackId,
	params,
}: {
	element: GraphicElement;
	trackId: string;
	params: ParamDefinition[];
}) {
	const editor = useEditor();
	const peso = Number(element.params.strokeWidth ?? 0);
	const [ultimoPeso, setUltimoPeso] = useState(peso > 0 ? peso : DEFAULT_STROKE_WIDTH);
	const prendido = peso > 0;

	const poner = (strokeWidth: number) =>
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					patch: { params: { ...element.params, strokeWidth } },
				},
			],
		});

	return (
		<SeccionCe
			titulo="Trazo"
			plegable={false}
			casilla={{
				marcada: prendido,
				onCambio: (v) => {
					if (v) poner(ultimoPeso);
					else {
						setUltimoPeso(peso);
						poner(0);
					}
				},
			}}
		>
			{prendido &&
				params.map((p) => <Campo key={p.key} element={element} trackId={trackId} param={p} />)}
		</SeccionCe>
	);
}
