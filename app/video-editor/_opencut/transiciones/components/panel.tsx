"use client";

// =============================================================================
// Panel derecho › «Transición» (del clip que tiene una a su derecha)
// =============================================================================
// Como el panel de transición de CapCut: el nombre, «Duración» (0,1 s hasta la
// mitad del clip más corto del corte) y, abajo, «Eliminar» y «Aplicar a todo».
// La duración se edita con el kit del panel (vista previa mientras se arrastra,
// un paso de deshacer al soltar); lo que se muestra es la que se DIBUJA, ya
// topeada, aunque la guardada sea mayor (un clip que se acortó después).

import { useMemo } from "react";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import {
	BotonRestablecer,
	DeslizadorValor,
	FilaCe,
	SeccionCe,
	useParamsConFotogramas,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";
import { DEF_DURACION_TRANSICION } from "@/app/video-editor/_opencut/params/extra/transiciones";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { DURACION_MINIMA, DURACION_POR_DEFECTO, PARAM_TRANSICION_DURACION } from "../claves";
import { clipsDe, duracionMaxima, duracionPedida, idTransicion, siguientePegado } from "../reglas";
import { transicionPorId } from "../catalogo";
import { aplicarATodo, quitarTransicion } from "../acciones";

export function PanelTransicion({ element, track }: ContextoInspector) {
	const editor = useEditor();
	const siguiente = siguientePegado(clipsDe(track), element);
	// El tope en décimas hacia abajo: el deslizador va de a 0,1 s.
	const tope = siguiente
		? Math.floor(duracionMaxima(element, siguiente, TICKS_PER_SECOND) * 10 + 1e-6) / 10
		: DURACION_MINIMA;
	const param = useMemo<ElementParamDefinition>(
		() => ({
			...DEF_DURACION_TRANSICION,
			max: Math.max(DURACION_MINIMA, tope),
			read: ({ element: el }) => Math.min(duracionPedida(el), Math.max(DURACION_MINIMA, tope)),
		}),
		[tope],
	);
	const params = useMemo(() => [param], [param]);
	const grupo = useParamsConFotogramas({ element, trackId: track.id, params });

	const id = idTransicion(element);
	if (!id || !siguiente) return null;
	const definicion = transicionPorId(id);
	const valor = Number(grupo.valores[PARAM_TRANSICION_DURACION] ?? DEF_DURACION_TRANSICION.default);
	const ref = { trackId: track.id, elementId: element.id };
	const sinMargen = tope <= DURACION_MINIMA;

	return (
		<div className="flex flex-col pt-1">
			<SeccionCe titulo={definicion?.nombre ?? "Transición"} plegable={false}>
				<FilaCe
					rotulo="Duración"
					acciones={
						<BotonRestablecer
							onClick={grupo.restablecer}
							// Lo GUARDADO, no lo que se ve: con un tope menor a 0,5 s se ve otro número.
							desactivado={duracionPedida(element) === DURACION_POR_DEFECTO || sinMargen}
						/>
					}
				>
					<DeslizadorValor
						valor={valor}
						min={DURACION_MINIMA}
						max={Math.max(DURACION_MINIMA, tope)}
						paso={0.1}
						sufijo="s"
						ariaLabel="Duración"
						desactivado={sinMargen}
						onPrevisualizar={(v) => grupo.previsualizar({ [PARAM_TRANSICION_DURACION]: v })}
						onConfirmar={grupo.confirmar}
					/>
				</FilaCe>
			</SeccionCe>
			<div className="flex gap-2 px-4 pt-3 pb-4">
				<Button variant="secondary" size="sm" className="flex-1" onClick={() => quitarTransicion(editor, ref)}>
					<IconoBorrar size={14} />
					Eliminar
				</Button>
				<Button size="sm" className="flex-1" onClick={() => aplicarATodo(editor, ref)}>
					Aplicar a todo
				</Button>
			</div>
		</div>
	);
}
