import type { ShortcutKey } from "@/app/video-editor/_opencut/actions/keybinding";
import type { TActionWithOptionalArgs } from "./types";

// Las acciones del editor y el preset de atajos «CapCut» de Windows
// (relevamiento-capcut-armazon §10). La `description` es el rótulo del panel
// «Atajos» de CapCut en español (es-LA.po), en tú; las categorías son las
// tres del panel. Las acciones que dibuja otro paquete (Exportar → A;
// Importar → B) se DECLARAN acá con su atajo y las ata ese paquete con
// `useActionHandler`: si nadie la ata, la tecla no hace nada.
//
// Las del reproductor (Espacio, flechas, Inicio/Fin, ↑/↓, J/K/L) llaman a
// preview/navegacion.ts (paquete E), que tiene la búsqueda rápida a varias
// velocidades. Pantalla completa (Ctrl+Shift+F), el zoom del reproductor
// (Alt+Shift+= / - / Z) y guías/reglas (Ctrl+; / Ctrl+Alt+R) NO están acá: los
// atiende el propio reproductor (preview/atajos-reproductor.ts), que escucha
// después que este sistema y sólo toma las teclas que nadie usó.
//
// Fuera del preset a propósito: Ctrl+N (Nuevo proyecto) y Ctrl+W (Cerrar), que
// Chrome no deja tomar desde una página; Agrupar/Clip combinado (Ctrl+G /
// Alt+G), que el motor no tiene.

export type TActionCategory = "linea" | "reproductor" | "basico" | "interno";

export const CATEGORIAS_ACCION: Record<TActionCategory, string> = {
	linea: "Línea de tiempo",
	reproductor: "Reproductor",
	basico: "Básico",
	interno: "",
};

export interface TActionBaseDefinition {
	description: string;
	category: TActionCategory;
	args?: Record<string, unknown>;
}

export interface TActionDefinition extends TActionBaseDefinition {
	defaultShortcuts?: readonly ShortcutKey[];
}

export const ACTIONS = {
	// ── Reproductor ──────────────────────────────────────────────────────────
	"toggle-play": {
		description: "Reproducir/Pausar",
		category: "reproductor",
	},
	"stop-playback": {
		description: "Detener",
		category: "interno",
	},
	"seek-forward": {
		description: "Avanzar 1 segundo",
		category: "interno",
		args: { seconds: "number" },
	},
	"seek-backward": {
		description: "Retroceder 1 segundo",
		category: "interno",
		args: { seconds: "number" },
	},
	"frame-step-forward": {
		description: "Siguiente cuadro",
		category: "reproductor",
	},
	"frame-step-backward": {
		description: "Cuadro anterior",
		category: "reproductor",
	},
	"jump-forward": {
		description: "Avanzar muchos fotogramas",
		category: "reproductor",
		args: { seconds: "number" },
	},
	"jump-backward": {
		description: "Retroceder muchos fotogramas",
		category: "reproductor",
		args: { seconds: "number" },
	},
	"goto-start": {
		description: "Localizar hasta el primer fotograma",
		category: "reproductor",
	},
	"goto-end": {
		description: "Localizar hasta el último fotograma",
		category: "reproductor",
	},
	"punto-corte-anterior": {
		description: "Último punto de corte",
		category: "reproductor",
	},
	"punto-corte-siguiente": {
		description: "Siguiente punto de corte",
		category: "reproductor",
	},
	"busqueda-izquierda": {
		description: "Rebobinar a varias velocidades",
		category: "reproductor",
	},
	"busqueda-detener": {
		description: "Detener búsqueda rápida",
		category: "reproductor",
	},
	"busqueda-derecha": {
		description: "Búsqueda rápida a la derecha",
		category: "reproductor",
	},

	// ── Línea de tiempo ──────────────────────────────────────────────────────
	split: {
		description: "Dividir",
		category: "linea",
	},
	"dividir-todo": {
		description: "Dividir todo",
		category: "linea",
	},
	"modo-seleccion": {
		// CapCut dice «Selecciona el modo» (traducción literal de «Select mode»);
		// se corrige con su propio «Cambiar al modo de selección o división».
		description: "Modo de selección",
		category: "linea",
	},
	"modo-division": {
		description: "Modo de división",
		category: "linea",
	},
	"seleccionar-izquierda": {
		description: "Seleccionar hacia la izquierda",
		category: "linea",
	},
	"seleccionar-derecha": {
		description: "Seleccionar hacia la derecha",
		category: "linea",
	},
	"split-left": {
		description: "Borrar a la izquierda",
		category: "linea",
	},
	"split-right": {
		description: "Borrar a la derecha",
		category: "linea",
	},
	"borrar-silencios": {
		description: "Borrar silencios",
		category: "linea",
	},
	"delete-selected": {
		description: "Eliminar",
		category: "linea",
	},
	"copy-selected": {
		description: "Copiar",
		category: "linea",
	},
	cortar: {
		description: "Cortar",
		category: "linea",
	},
	"paste-copied": {
		description: "Pegar",
		category: "linea",
	},
	"copiar-atributos": {
		description: "Copiar atributos",
		category: "linea",
	},
	"pegar-atributos": {
		description: "Pegar atributos",
		category: "linea",
	},
	"toggle-snapping": {
		description: "Ajuste automático",
		category: "linea",
	},
	"toggle-ripple-editing": {
		description: "Imán de la pista principal",
		category: "linea",
	},
	"alternar-vinculacion": {
		description: "Vinculación",
		category: "linea",
	},
	"alternar-eje-vista-previa": {
		description: "Eje de vista previa",
		category: "linea",
	},
	"acercar-linea": {
		description: "Aumentar la línea de tiempo",
		category: "linea",
	},
	"alejar-linea": {
		description: "Reducir la línea de tiempo",
		category: "linea",
	},
	"ajustar-linea": {
		description: "Hacer zoom para ajustar la línea de tiempo",
		category: "linea",
	},
	"alternar-clip": {
		description: "Activar/Desactivar el clip",
		category: "linea",
	},
	"toggle-source-audio": {
		description: "Extraer/Restaurar el audio",
		category: "linea",
	},
	"toggle-bookmark": {
		description: "Agregar marcador",
		category: "linea",
	},
	"marcador-nuevo-color": {
		description: "Agregar marcador con nuevo color",
		category: "linea",
	},
	"marcador-siguiente": {
		description: "Ir al siguiente marcador",
		category: "linea",
	},
	"marcador-anterior": {
		description: "Ir al marcador anterior",
		category: "linea",
	},
	"volumen-subir": {
		description: "Volumen +0.1 dB",
		category: "linea",
	},
	"volumen-bajar": {
		description: "Volumen -0.1 dB",
		category: "linea",
	},
	"panel-fotogramas-clave": {
		description: "Mostrar/ocultar el panel de fotogramas clave",
		category: "linea",
	},
	"select-all": {
		description: "Seleccionar todo",
		category: "linea",
	},
	"deselect-all": {
		description: "Anular selección",
		category: "linea",
	},
	"cancel-interaction": {
		description: "Cancelar",
		category: "interno",
	},
	"duplicate-selected": {
		description: "Duplicar",
		category: "interno",
	},
	"toggle-elements-muted-selected": {
		description: "Silenciar",
		category: "interno",
	},
	"toggle-elements-visibility-selected": {
		description: "Ocultar",
		category: "interno",
	},

	// ── Básico ───────────────────────────────────────────────────────────────
	undo: {
		description: "Deshacer",
		category: "basico",
	},
	redo: {
		description: "Rehacer",
		category: "basico",
	},
	"importar-multimedia": {
		description: "Importar archivos multimedia",
		category: "basico",
	},
	exportar: {
		description: "Exportar",
		category: "basico",
	},
	"volver-inicio": {
		description: "Volver a la página de inicio",
		category: "basico",
	},
	"remove-media-asset": {
		description: "Eliminar archivo multimedia",
		category: "interno",
		args: { projectId: "string", assetId: "string" },
	},
	"remove-media-assets": {
		description: "Eliminar archivos multimedia",
		category: "interno",
		args: { projectId: "string", assetIds: "string[]" },
	},
} as const satisfies Record<string, TActionBaseDefinition>;

export type TAction = keyof typeof ACTIONS;

/** El preset «CapCut» de Windows (§10 del relevamiento). */
const ACTION_DEFAULT_SHORTCUTS = [
	// Reproductor
	["toggle-play", ["space"]],
	["frame-step-backward", ["left"]],
	["frame-step-forward", ["right"]],
	["jump-backward", ["shift+left"]],
	["jump-forward", ["shift+right"]],
	["goto-start", ["home"]],
	["goto-end", ["end"]],
	["punto-corte-anterior", ["up"]],
	["punto-corte-siguiente", ["down"]],
	["busqueda-izquierda", ["j"]],
	["busqueda-detener", ["k"]],
	["busqueda-derecha", ["l"]],
	// Línea de tiempo
	["split", ["ctrl+b"]],
	["dividir-todo", ["ctrl+shift+b"]],
	["modo-seleccion", ["a"]],
	["modo-division", ["b"]],
	["seleccionar-izquierda", ["["]],
	["seleccionar-derecha", ["]"]],
	["split-left", ["q"]],
	["split-right", ["w"]],
	["delete-selected", ["delete", "backspace"]],
	["toggle-ripple-editing", ["p"]],
	["toggle-snapping", ["n"]],
	["alternar-vinculacion", ["`"]],
	["alternar-eje-vista-previa", ["s"]],
	["acercar-linea", ["ctrl+="]],
	["alejar-linea", ["ctrl+-"]],
	["ajustar-linea", ["shift+z"]],
	["alternar-clip", ["v"]],
	["toggle-source-audio", ["ctrl+shift+s"]],
	["toggle-bookmark", ["m"]],
	["marcador-nuevo-color", ["alt+m"]],
	["marcador-siguiente", ["shift+m"]],
	["marcador-anterior", ["alt+shift+m"]],
	["volumen-subir", ["ctrl+."]],
	["volumen-bajar", ["ctrl+,"]],
	["panel-fotogramas-clave", ["alt+k"]],
	["copy-selected", ["ctrl+c"]],
	["cortar", ["ctrl+x"]],
	["paste-copied", ["ctrl+v"]],
	["copiar-atributos", ["ctrl+shift+c"]],
	["pegar-atributos", ["ctrl+shift+v"]],
	["select-all", ["ctrl+a"]],
	["deselect-all", ["alt+x"]],
	["cancel-interaction", ["escape"]],
	// Básico
	["undo", ["ctrl+z"]],
	["redo", ["ctrl+shift+z"]],
	["importar-multimedia", ["ctrl+i"]],
	["exportar", ["ctrl+e"]],
	["volver-inicio", ["ctrl+alt+q"]],
] as const satisfies ReadonlyArray<
	readonly [TActionWithOptionalArgs, readonly ShortcutKey[]]
>;

const ACTION_DEFAULT_SHORTCUTS_BY_ACTION = new Map<
	TAction,
	readonly ShortcutKey[]
>(ACTION_DEFAULT_SHORTCUTS);

export function getActionDefinition({
	action,
}: {
	action: TAction;
}): TActionDefinition {
	return {
		...ACTIONS[action],
		defaultShortcuts: ACTION_DEFAULT_SHORTCUTS_BY_ACTION.get(action),
	};
}

export function getDefaultShortcuts(): Map<
	ShortcutKey,
	TActionWithOptionalArgs
> {
	const shortcuts = new Map<ShortcutKey, TActionWithOptionalArgs>();

	for (const [action, defaultShortcuts] of ACTION_DEFAULT_SHORTCUTS) {
		for (const shortcut of defaultShortcuts) {
			shortcuts.set(shortcut, action);
		}
	}

	return shortcuts;
}

const ACTIONS_WITH_REQUIRED_ARGS: ReadonlySet<string> = new Set([
	"remove-media-asset",
	"remove-media-assets",
]);

/** Una acción que se puede atar a una tecla: existe y no exige argumentos. */
export function isActionWithOptionalArgs(
	value: string,
): value is TActionWithOptionalArgs {
	return value in ACTIONS && !ACTIONS_WITH_REQUIRED_ARGS.has(value);
}

/**
 * Cómo se lee un atajo en pantalla, como en los tooltips de CapCut: «Ctrl+B»,
 * «Q», «Supr», «Shift+Z». Sirve para el tooltip de la barra y el menú
 * contextual; el panel «Atajos» arma sus teclas con `formatearTecla`.
 */
export function formatearAtajo(atajo: ShortcutKey): string {
	return atajo
		.split("+")
		.map((parte) => formatearTecla(parte))
		.join("+");
}

const NOMBRES_TECLA: Record<string, string> = {
	ctrl: "Ctrl",
	alt: "Alt",
	shift: "Shift",
	space: "Espacio",
	left: "←",
	right: "→",
	up: "↑",
	down: "↓",
	home: "Inicio",
	end: "Fin",
	delete: "Supr",
	backspace: "Retroceso",
	enter: "Enter",
	escape: "Esc",
	esc: "Esc",
	tab: "Tab",
	"=": "+",
};

export function formatearTecla(tecla: string): string {
	return NOMBRES_TECLA[tecla] ?? tecla.toUpperCase();
}

/** El primer atajo por defecto de una acción, ya formateado («» si no tiene). */
export function atajoDe(action: TAction): string {
	const atajo = ACTION_DEFAULT_SHORTCUTS_BY_ACTION.get(action)?.[0];
	return atajo ? formatearAtajo(atajo) : "";
}
