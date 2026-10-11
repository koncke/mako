// =============================================================================
// «Cortar», «Copiar atributos» y «Pegar atributos» (Ctrl+X, Ctrl+Shift+C/V)
// =============================================================================
// Contrato con la línea de tiempo (docs/diseno-editor-video.md §4.1): D llama a
// estas tres desde los atajos y el menú contextual del clip.
//
//   · Cortar = copiar al portapapeles del editor + la acción «Eliminar» de la
//     línea de tiempo (invocada, no reescrita: así cortar respeta las pistas
//     bloqueadas y borra lo vinculado igual que Supr).
//   · Copiar atributos guarda, del ÚNICO clip elegido, lo que define cómo se ve
//     y suena: los parámetros (transformación, opacidad, mezcla, volumen,
//     reflejo, recorte, animaciones de entrada/salida, fundidos… todo lo que
//     esté en params/registry o params/extra), los efectos, la máscara, los
//     fotogramas clave y la velocidad.
//   · Pegar atributos lo aplica a TODOS los elegidos del mismo tipo, en un paso
//     de deshacer. Lo que el destino no admite se saltea (una imagen no tiene
//     velocidad ni volumen) y se avisa con el texto de CapCut.
//
// Lo que NO viaja aunque esté en params: el texto de un texto (`content`), si es
// subtítulo, la transición (es del corte, no del clip) y el origen de un clip
// revertido (es del medio).
//
// Lo copiado vive en memoria (como el portapapeles del editor): no sobrevive a
// recargar la página.

import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { invokeAction } from "@/app/video-editor/_opencut/actions/registry";
import type { ElementAnimations } from "@/app/video-editor/_opencut/animation/types";
import { clampAnimationsToDuration } from "@/app/video-editor/_opencut/animation";
import type { Effect } from "@/app/video-editor/_opencut/effects/types";
import type { Mask } from "@/app/video-editor/_opencut/masks/types";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { getBuiltInElementParams } from "@/app/video-editor/_opencut/params/registry";
import type {
	ElementType,
	RetimeConfig,
	TimelineElement,
} from "@/app/video-editor/_opencut/timeline";

type Atributos = {
	tipo: ElementType;
	effectType?: string;
	params: ParamValues;
	effects?: Effect[];
	masks?: Mask[];
	animations?: ElementAnimations;
	/** `null`: el clip estaba a 1× (no hay velocidad que pegar). */
	retime?: RetimeConfig | null;
};

let copiados: Atributos | null = null;

const CLAVES_QUE_NO_VIAJAN = new Set(["content", "subtitulo", "tts"]);
const PREFIJOS_QUE_NO_VIAJAN = ["transicion.", "revertir."];

function viaja(clave: string): boolean {
	return (
		!CLAVES_QUE_NO_VIAJAN.has(clave) &&
		!PREFIJOS_QUE_NO_VIAJAN.some((p) => clave.startsWith(p))
	);
}

/** Familias entre las que se puede pegar (CapCut: «clips de otro tipo» no). */
function familia(tipo: ElementType): string {
	return tipo === "video" || tipo === "image" ? "visual" : tipo;
}

const esRetimable = (tipo: ElementType) => tipo === "video" || tipo === "audio";

/** «Cortar» (Ctrl+X): copia la selección al portapapeles y la borra. */
export function cortarSeleccion(editor: EditorCore): void {
	const hayElementos = editor.selection.getSelectedElements().length > 0;
	const hayFotogramas = editor.selection.getSelectedKeyframes().length > 0;
	if (!hayElementos && !hayFotogramas) return;
	if (!editor.clipboard.copy()) return;
	invokeAction("delete-selected", undefined, "keypress");
}

/** «Copiar atributos» (Ctrl+Shift+C): guarda los atributos del clip elegido. */
export function copiarAtributos(editor: EditorCore): void {
	const refs = editor.selection.getSelectedElements();
	if (refs.length === 0) return;
	if (refs.length > 1) {
		toast.error("No se pueden copiar los atributos de varios clips");
		return;
	}
	const [par] = editor.timeline.getElementsWithTracks({ elements: refs });
	if (!par) return;
	const { element } = par;

	const params: ParamValues = {};
	for (const [clave, valor] of Object.entries(element.params ?? {})) {
		if (viaja(clave)) params[clave] = valor;
	}
	copiados = {
		tipo: element.type,
		effectType: element.type === "effect" ? element.effectType : undefined,
		params,
		effects: "effects" in element && element.effects ? structuredClone(element.effects) : undefined,
		masks: "masks" in element && element.masks ? structuredClone(element.masks) : undefined,
		animations: element.animations ? structuredClone(element.animations) : undefined,
		retime: esRetimable(element.type)
			? "retime" in element && element.retime
				? structuredClone(element.retime)
				: null
			: undefined,
	};
	toast.success("Copiado", { duration: 1500 });
}

/** «Pegar atributos» (Ctrl+Shift+V): aplica los atributos guardados a la selección. */
export function pegarAtributos(editor: EditorCore): void {
	const origen = copiados;
	if (!origen) return;
	const refs = editor.selection.getSelectedElements();
	if (refs.length === 0) return;
	const pares = editor.timeline
		.getElementsWithTracks({ elements: refs })
		.filter(({ track }) => !track.locked);

	let deOtroTipo = 0;
	let deOtroEfecto = 0;
	let sinVelocidad = false;
	const updates: Array<{ trackId: string; elementId: string; patch: Partial<TimelineElement> }> = [];

	for (const { track, element } of pares) {
		if (familia(element.type) !== familia(origen.tipo)) {
			deOtroTipo++;
			continue;
		}
		if (element.type === "effect" && element.effectType !== origen.effectType) {
			deOtroEfecto++;
			continue;
		}
		const patch = armarParche(element, origen);
		if (esRetimable(origen.tipo) && !esRetimable(element.type) && origen.retime) {
			sinVelocidad = true;
		}
		updates.push({ trackId: track.id, elementId: element.id, patch });
	}

	if (updates.length > 0) editor.timeline.updateElements({ updates });

	if (deOtroEfecto > 0 && updates.length === 0) {
		toast.error("No se pueden pegar atributos a diferentes efectos");
	} else if (deOtroTipo > 0 && updates.length === 0) {
		toast.error("No se pueden pegar atributos a clips de otro tipo");
	} else if (sinVelocidad) {
		toast("No se pueden pegar atributos de audio y velocidad a imágenes");
	} else if (deOtroTipo > 0 || deOtroEfecto > 0) {
		toast("No se pudieron pegar algunos atributos");
	}
}

function armarParche(element: TimelineElement, origen: Atributos): Partial<TimelineElement> {
	// Sólo las claves que el destino declara: un video no le pasa el volumen a
	// una imagen, ni un texto su fuente a otro texto que no la tuviera.
	const declaradas = new Set(getBuiltInElementParams({ type: element.type }).map((p) => p.key));
	const params: ParamValues = {};
	for (const [clave, valor] of Object.entries(origen.params)) {
		if (declaradas.has(clave) || (element.type === "effect" && viaja(clave))) {
			params[clave] = valor;
		}
	}
	const patch: Record<string, unknown> = { params };

	// Lo que el clip copiado NO tenía no se pega: el diálogo de CapCut sólo
	// ofrece las categorías que el original trae, así que pegar no le borra al
	// destino sus efectos, su máscara ni sus fotogramas clave.
	const admiteEfectos = element.type !== "audio" && element.type !== "effect";
	const conEfectos = admiteEfectos && (origen.effects?.length ?? 0) > 0;
	if (conEfectos) patch.effects = structuredClone(origen.effects);
	const admiteMascara =
		element.type === "video" || element.type === "image" || element.type === "graphic";
	if (admiteMascara && (origen.masks?.length ?? 0) > 0) {
		patch.masks = structuredClone(origen.masks);
	}

	// Fotogramas clave: los de propiedades que el destino tiene, recortados a
	// su duración (CapCut «Mantener»: los tiempos no se estiran). Pisan los del
	// destino en esas mismas propiedades; los demás quedan.
	const animaciones: ElementAnimations = {};
	for (const [ruta, canal] of Object.entries(origen.animations ?? {})) {
		if (!canal) continue;
		const sirve =
			declaradas.has(ruta) ||
			(conEfectos && ruta.startsWith("effects.")) ||
			(element.type === "graphic" && ruta.startsWith("params."));
		if (sirve) animaciones[ruta] = structuredClone(canal);
	}
	if (Object.keys(animaciones).length > 0) {
		patch.animations = clampAnimationsToDuration({
			animations: { ...(element.animations ?? {}), ...animaciones },
			duration: element.duration,
		});
	}

	// Velocidad: entre video y audio sí (si el original la tenía cambiada); el
	// pipeline recalcula la duración.
	if (esRetimable(element.type) && origen.retime) {
		patch.retime = structuredClone(origen.retime);
	}
	return patch as Partial<TimelineElement>;
}
