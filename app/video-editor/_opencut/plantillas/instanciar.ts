// =============================================================================
// «Utilizar plantilla» (`use_template_pc`): la plantilla, armada en el proyecto abierto
// =============================================================================
// La ÚNICA entrada para armar una plantilla: la usan la pestaña «Plantillas»
// (proyecto vacío), «Armar la plantilla» de un proyecto nuevo
// (app/video-editor/plantilla/ArmarPlantilla.tsx) y, en la tanda 4, el chat
// (`usar_plantilla`). En orden (plan §1.4):
//   1. las fuentes de ESTA plantilla, enteras (cargarFuentes): un texto medido con
//      la de respaldo queda partido así para siempre;
//   2. las imágenes de muestra (./muestras.ts), una por rótulo, guardadas ocultas;
//   3. el armado (./armar.ts) en el lienzo 9:16 que va a quedar, con la principal
//      de la escena (sin cambiarle el id: la vinculación la nombra) y partirYUbicar
//      como medida;
//   4. UN paso de deshacer: la relación 9:16 y las pistas, en un BatchCommand.
//      Fijar `relacion` evita que el primer clip que se agregue después pise el
//      lienzo (commands/timeline/element/insert-element.ts). El imán no mueve nada:
//      la principal ya va pegada desde 0;
//   5. si la plantilla trae subtítulos, quedan elegidos para «Generar»;
//   6. «Sustituye los clips de muestra» si quedó alguno.
//
// Sólo sobre una línea de tiempo VACÍA: con algo adentro, la pestaña abre un
// proyecto nuevo (como CapCut, que abre un borrador) y el chat lo descarta.

import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { BatchCommand } from "@/app/video-editor/_opencut/commands/batch-command";
import { UpdateProjectSettingsCommand } from "@/app/video-editor/_opencut/commands/project";
import { TracksSnapshotCommand } from "@/app/video-editor/_opencut/commands/timeline/tracks-snapshot";
import { tamanoDeRelacion } from "@/app/video-editor/_opencut/canvas/sizes";
import { buildDefaultParamValues, getBuiltInElementParams } from "@/app/video-editor/_opencut/params/registry";
import { buildDefaultGraphicInstance } from "@/app/video-editor/_opencut/graphics";
import { partirYUbicar } from "@/app/video-editor/_opencut/subtitles/build-subtitle-text-element";
import { cargarFuentes } from "@/app/video-editor/_opencut/subtitles/insert";
import { usePreferenciasSubtitulos } from "@/app/video-editor/_opencut/subtitles/estado";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { generateUUID } from "@/app/video-editor/_opencut/utils/id";
import type { Plantilla } from "@/lib/editor-video/plantillas";
import { armarLinea, type TipoBase } from "./armar";
import { quedanMuestras } from "./huecos";
import { prepararMuestras } from "./muestras";
import { familiasDe, lineaVacia, mediosDeHuecos, rotulosDe } from "./uso";

/** `pc_template_editor_replace_example_material`, en corto. */
export const AVISO_MUESTRAS = "Sustituye los clips de muestra";
/** `pc_loading_fail_comma`. */
export const AVISO_FALLO_PLANTILLA = "No se pudo cargar la plantilla.";

export type ResultadoUsar =
	| { ok: true; descartes: string[] }
	| { ok: false; motivo: "sin-proyecto" | "no-vacia" | "ocupado" | "error" };

/** Los params por defecto de cada tipo, como los crea el motor (la forma, con los de su definición). */
const base = (tipo: TipoBase, definicion?: string) => ({
	...buildDefaultParamValues(getBuiltInElementParams({ type: tipo })),
	...(definicion ? buildDefaultGraphicInstance({ definitionId: definicion }).params : {}),
});

let usando = false;

/**
 * Arma `plantilla` en el proyecto abierto. `textos` y `medios` llenan huecos por
 * nombre (`medios`: hueco → id de un medio de Multimedia); lo que no sirve vuelve
 * en `descartes`, con su motivo.
 */
export async function usarPlantilla(
	editor: EditorCore,
	plantilla: Plantilla,
	{
		textos,
		medios: pedidos,
		avisar = true,
	}: { textos?: Record<string, string>; medios?: Record<string, string>; avisar?: boolean } = {},
): Promise<ResultadoUsar> {
	if (usando) return { ok: false, motivo: "ocupado" };
	const escenaAlPedir = editor.scenes.getActiveSceneOrNull();
	if (!editor.project.getActiveOrNull() || !escenaAlPedir) return { ok: false, motivo: "sin-proyecto" };
	if (!lineaVacia(escenaAlPedir.tracks)) return { ok: false, motivo: "no-vacia" };

	usando = true;
	try {
		await cargarFuentes(familiasDe(plantilla));
		const muestras = await prepararMuestras(editor, rotulosDe(plantilla));

		// Mientras cargaba pudo cambiar de proyecto o llenarse la línea de tiempo: se
		// mira la de AHORA, y después no hay otro `await` hasta el comando.
		const proyecto = editor.project.getActiveOrNull();
		const escena = editor.scenes.getActiveSceneOrNull();
		if (!proyecto || !escena) return { ok: false, motivo: "sin-proyecto" };
		if (escena.id !== escenaAlPedir.id || !lineaVacia(escena.tracks)) return { ok: false, motivo: "no-vacia" };

		const { settings } = proyecto;
		const canvasSize = tamanoDeRelacion({ id: "9:16", settings });
		const { medios, descartes } = mediosDeHuecos(plantilla, editor.media.getAssets(), pedidos ?? {});
		const armada = armarLinea({
			plantilla,
			lienzo: canvasSize,
			fps: settings.fps.numerator / settings.fps.denominator,
			tps: TICKS_PER_SECOND,
			principal: escena.tracks.main,
			muestras,
			medios,
			textos,
			base,
			medir: partirYUbicar,
			nuevoId: generateUUID,
		});
		editor.command.execute({
			command: new BatchCommand([
				new UpdateProjectSettingsCommand({ relacion: "9:16", canvasSize, canvasSizeMode: "preset" }),
				new TracksSnapshotCommand({ before: escena.tracks, after: armada.tracks }),
			]),
		});
		if (plantilla.subtitulos) usePreferenciasSubtitulos.getState().fijar({ plantilla: plantilla.subtitulos });
		if (avisar && quedanMuestras(armada.tracks)) toast(AVISO_MUESTRAS);
		return { ok: true, descartes: [...descartes, ...armada.descartes] };
	} catch (error) {
		console.error("[plantillas] no se pudo usar la plantilla", plantilla.id, error);
		return { ok: false, motivo: "error" };
	} finally {
		usando = false;
	}
}
