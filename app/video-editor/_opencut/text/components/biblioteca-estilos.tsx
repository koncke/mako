"use client";

// =============================================================================
// Biblioteca › Texto › «Efectos de texto» y «Plantilla de texto»
// =============================================================================
// Como «Agregar texto» (text/components/assets-view.tsx, paquete de la
// biblioteca): un clic o el ⊕ agrega un texto de 3 s en el cabezal, y la
// tarjeta se arrastra a la línea de tiempo. La diferencia es que el texto nace
// con el estilo de la tarjeta:
//
//   Efectos de texto    «Texto predeterminado» con el efecto (color, trazo,
//                       sombra, fondo), y arriba «Mis elementos predefinidos»
//                       (lo que se guardó con «Guardar como parámetro
//                       predefinido» en el panel derecho).
//   Plantilla de texto  el texto entero: lo que dice, la fuente, el tamaño, el
//                       efecto y la animación.
//
// Las miniaturas piden SÓLO las letras de su muestra al entrar en pantalla
// (fonts/muestras.ts, en MiniaturaEstilo): cargar las familias enteras al abrir la
// sección colgaba la pestaña (hallazgos, 15/10/2026). La fuente ENTERA se pide al
// pasar el mouse por la tarjeta y al agregarla: soltar una tarjeta antes de que llegue
// dibujaría la primera textura con la de respaldo (el compositor no la vuelve a pedir
// si nada cambió).

import { DraggableItem } from "@/app/video-editor/_opencut/components/editor/panels/assets/draggable-item";
import {
	ContenidoBiblioteca,
	GrillaBiblioteca,
	TituloGrupo,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { loadFonts } from "@/app/video-editor/_opencut/fonts/google-fonts";
import { buildTextElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import { mediaTimeFromSeconds, type MediaTime } from "@/app/video-editor/_opencut/wasm";
import { TEXTO_PREDETERMINADO } from "./assets-view";
import { MiniaturaEstilo } from "./miniatura-estilo";
import {
	EFECTOS_TEXTO,
	PLANTILLAS_TEXTO,
	paramsParaLienzo,
	type ParamsTexto,
} from "../estilos-predefinidos";
import { useEstilosGuardados } from "../predefinidos";

const SEGUNDOS_TEXTO_NUEVO = 3;

function lienzoDe(editor: EditorCore) {
	return editor.project.getActiveOrNull()?.settings.canvasSize ?? null;
}

async function agregarTexto({
	editor,
	nombre,
	contenido,
	params,
	startTime,
}: {
	editor: EditorCore;
	nombre: string;
	contenido: string;
	params: ParamsTexto;
	startTime: MediaTime;
}) {
	if (!editor.scenes.getActiveSceneOrNull()) return;
	const familia = params.fontFamily;
	if (typeof familia === "string") await loadFonts({ families: [familia] }).catch(() => {});
	editor.timeline.insertElement({
		element: buildTextElement({
			raw: {
				name: nombre,
				duration: mediaTimeFromSeconds({ seconds: SEGUNDOS_TEXTO_NUEVO }),
				params: { ...params, content: contenido },
			},
			startTime,
		}),
		placement: { mode: "auto" },
	});
}

function TarjetaTexto({
	id,
	nombre,
	contenido,
	params,
	muestra,
	tamanoMuestra,
}: {
	id: string;
	nombre: string;
	contenido: string;
	params: ParamsTexto;
	/** Lo que se lee en la miniatura (si no, el contenido). */
	muestra?: string;
	tamanoMuestra?: number;
}) {
	const editor = useEditor();
	const duracion = mediaTimeFromSeconds({ seconds: SEGUNDOS_TEXTO_NUEVO });
	// Se calcula al soltar/agregar: el lienzo puede cambiar con la sección abierta.
	const conLienzo = () => paramsParaLienzo(params, lienzoDe(editor));
	// La fuente entera, con el mouse encima: antes de arrastrar (ver la cabecera).
	const precargar = () => {
		if (typeof params.fontFamily === "string") void loadFonts({ families: [params.fontFamily] }).catch(() => {});
	};
	return (
		<div className="contents" onPointerEnter={precargar}>
		<DraggableItem
			name={nombre}
			preview={<MiniaturaEstilo params={params} texto={muestra ?? contenido} tamanoPx={tamanoMuestra} />}
			dragData={{
				id,
				type: "text",
				name: contenido.split("\n")[0] ?? nombre,
				content: contenido,
				duration: duracion,
				params: conLienzo(),
			}}
			aspectRatio={1}
			shouldShowLabel={false}
			onClick={() =>
				void agregarTexto({
					editor,
					nombre: contenido.split("\n")[0] ?? nombre,
					contenido,
					params: conLienzo(),
					startTime: editor.playback.getCurrentTime(),
				})
			}
			onAddToTimeline={({ currentTime }) =>
				void agregarTexto({
					editor,
					nombre: contenido.split("\n")[0] ?? nombre,
					contenido,
					params: conLienzo(),
					startTime: currentTime,
				})
			}
			containerClassName="w-full"
		/>
		</div>
	);
}

export function EfectosDeTextoView() {
	const guardados = useEstilosGuardados();

	return (
		<ContenidoBiblioteca>
			{guardados.length > 0 && (
				<div className="mb-4">
					{/* `my_default`. */}
					<TituloGrupo>Mis elementos predefinidos</TituloGrupo>
					<GrillaBiblioteca>
						{guardados.map((g) => (
							<TarjetaTexto
								key={g.id}
								id={`texto-guardado-${g.id}`}
								nombre={g.nombre}
								contenido={TEXTO_PREDETERMINADO}
								// El tamaño guardado es el del texto original: no se adapta.
								params={g.params}
								muestra="Aa"
								tamanoMuestra={26}
							/>
						))}
					</GrillaBiblioteca>
				</div>
			)}
			{guardados.length > 0 && <TituloGrupo>Efectos de texto</TituloGrupo>}
			<GrillaBiblioteca>
				{EFECTOS_TEXTO.map((ef) => (
					<TarjetaTexto
						key={ef.id}
						id={`efecto-texto-${ef.id}`}
						nombre={ef.nombre}
						contenido={TEXTO_PREDETERMINADO}
						params={ef.params}
						muestra="Aa"
						tamanoMuestra={26}
					/>
				))}
			</GrillaBiblioteca>
		</ContenidoBiblioteca>
	);
}

export function PlantillasDeTextoView() {
	return (
		<ContenidoBiblioteca>
			<GrillaBiblioteca>
				{PLANTILLAS_TEXTO.map((p) => (
					<TarjetaTexto
						key={p.id}
						id={`plantilla-texto-${p.id}`}
						nombre={p.nombre}
						contenido={p.contenido}
						params={p.params}
						tamanoMuestra={Math.max(10, Math.min(20, 90 / Math.max(4, lineaMasLarga(p.contenido))))}
					/>
				))}
			</GrillaBiblioteca>
		</ContenidoBiblioteca>
	);
}

/** Letras de la línea más larga (para que la muestra entre en la tarjeta). */
function lineaMasLarga(texto: string): number {
	return Math.max(...texto.split("\n").map((l) => l.length));
}
