"use client";

// =============================================================================
// Panel derecho › Animación (Entrada · Salida · Combinado / Bucle)
// =============================================================================
// Como CapCut: la grilla de presets con «Ninguno» primero, la vista previa al
// pasar el mouse por la tarjeta, y debajo «Duración» con su deslizador cuando
// hay una elegida. Elegir una la muestra en el reproductor (./reproducir.ts).
//
// Las reglas que CapCut aplica al elegir (Combinado excluye Entrada y Salida,
// Entrada + Salida no pasan el clip, otro preset vuelve a su duración) se
// escriben en UN paso de deshacer junto con la elección. Viven en ../elegir.ts:
// el chat «Editar con IA» las usa también, y así se porta igual que este panel.

import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	getElementParam,
	type ElementParamDefinition,
} from "@/app/video-editor/_opencut/params/registry";
import { ANIM } from "@/app/video-editor/_opencut/params/extra/animaciones";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import {
	DeslizadorValor,
	FilaCe,
	useParamsConFotogramas,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import {
	ID_NINGUNO,
	presetAnimacion,
	presetsPara,
	type CategoriaAnimacion,
} from "../catalogo";
import { reproducirAnimacion } from "../reproducir";
import {
	DURACION_MINIMA_ANIMACION as DURACION_MINIMA,
	cambiosAlElegir,
	cambiosDeDuracion,
	duracionMaximaAnimacion,
} from "../elegir";
import { TarjetaAnimacion } from "./miniatura-animacion";

const redondear = (s: number) => Math.round(s * 10) / 10;

function useGrupoAnimacion(element: TimelineElement, trackId: string) {
	const params = (Object.keys(ANIM) as CategoriaAnimacion[])
		.flatMap((c) => [ANIM[c].id, ANIM[c].duracion])
		.map((key) => getElementParam({ element, key }))
		.filter((p): p is ElementParamDefinition => p !== null);
	return useParamsConFotogramas({ element, trackId, params });
}

function PanelCategoria({ ctx, categoria }: { ctx: ContextoInspector; categoria: CategoriaAnimacion }) {
	const editor = useEditor();
	const { element, track } = ctx;
	const grupo = useGrupoAnimacion(element, track.id);
	const esTexto = element.type === "text";
	const D = Math.max(DURACION_MINIMA, element.duration / TICKS_PER_SECOND);
	const clip = { valores: grupo.valores, tipo: element.type, D };
	const idDe = (c: CategoriaAnimacion) => String(grupo.valores[ANIM[c].id] ?? ID_NINGUNO);
	const duracionDe = (c: CategoriaAnimacion) => {
		const v = grupo.valores[ANIM[c].duracion];
		return typeof v === "number" ? v : (presetAnimacion(c, idDe(c))?.duracion ?? 0.5);
	};

	const actual = idDe(categoria);
	const presetActual = presetAnimacion(categoria, actual);
	const presets = presetsPara(categoria, esTexto);

	const elegir = (id: string) => {
		const cambios = cambiosAlElegir(clip, categoria, id);
		grupo.aplicar(cambios);
		if (presetAnimacion(categoria, id)) {
			reproducirAnimacion(editor, element, categoria, Number(cambios[ANIM[categoria].duracion]));
		}
	};

	// El Bucle no tiene «Duración» sino el largo de cada vuelta («Velocidad»,
	// `animation_speed`): más segundos, más lento. Una vuelta puede durar más que
	// el clip (se ve sólo el principio), así que no se acota a D.
	const rotuloDuracion = categoria === "bucle" ? "Velocidad" : "Duración";
	const maximo = duracionMaximaAnimacion(clip, categoria);

	const previsualizarDuracion = (v: number) => {
		grupo.previsualizar(cambiosDeDuracion(clip, categoria, v));
	};

	return (
		<div className="flex flex-col pt-1">
			<div className="grid grid-cols-4 gap-x-2 gap-y-2.5 px-4 pt-2 pb-3">
				<TarjetaAnimacion
					preset={null}
					categoria={categoria}
					esTexto={esTexto}
					activa={!presetActual}
					onElegir={() => elegir(ID_NINGUNO)}
				/>
				{presets.map((p) => (
					<TarjetaAnimacion
						key={p.id}
						preset={p}
						categoria={categoria}
						esTexto={esTexto}
						activa={p.id === actual}
						onElegir={() => elegir(p.id)}
					/>
				))}
			</div>
			{presetActual && (
				<div className="border-t border-(--cc-line-2) px-4 py-2">
					<FilaCe rotulo={rotuloDuracion}>
						<DeslizadorValor
							valor={Math.min(maximo, duracionDe(categoria))}
							min={DURACION_MINIMA}
							max={Math.max(DURACION_MINIMA + 0.1, redondear(maximo))}
							paso={0.1}
							sufijo="s"
							ariaLabel={rotuloDuracion}
							onPrevisualizar={previsualizarDuracion}
							onConfirmar={() => {
								// Una confirmación sin vista previa pendiente no escribe nada
								// (hallazgos → «La vista previa del motor…», `onCommit` en cada blur).
								if (!editor.timeline.isPreviewActive()) return;
								grupo.confirmar();
							}}
						/>
					</FilaCe>
				</div>
			)}
		</div>
	);
}

export function AnimacionEntrada(ctx: ContextoInspector) {
	return <PanelCategoria ctx={ctx} categoria="entrada" />;
}
export function AnimacionSalida(ctx: ContextoInspector) {
	return <PanelCategoria ctx={ctx} categoria="salida" />;
}
export function AnimacionCombinado(ctx: ContextoInspector) {
	return <PanelCategoria ctx={ctx} categoria="combo" />;
}
export function AnimacionBucle(ctx: ContextoInspector) {
	return <PanelCategoria ctx={ctx} categoria="bucle" />;
}
