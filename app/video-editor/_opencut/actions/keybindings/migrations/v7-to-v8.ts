import { getPersistedKeybindingsState } from "../persisted-state";

// 10/11/2026: los atajos del rango y de velocidad del preset «CapCut» (I, O,
// Shift+X, Alt+X, Ctrl+R, Shift+B, Ctrl+J). Sin personalizar, el preset del
// código manda solo (keybindings-store.ts → merge); esto es para quien SÍ
// personalizó, que si no se quedaba sin las teclas nuevas para siempre:
//   · cada tecla nueva entra sólo si esa tecla está LIBRE (lo que la persona
//     puso en ella se respeta);
//   · Alt+X pasa a «Anular selección» del rango sólo si seguía con lo que traía el
//     preset viejo («deselect-all»): si la cambió, es suya.
// La lista va escrita acá, congelada: una migración no lee el preset vivo, que
// sigue cambiando después.
const NUEVAS: ReadonlyArray<readonly [string, string]> = [
	["i", "punto-entrada"],
	["o", "punto-salida"],
	["shift+x", "seleccionar-por-clip"],
	["ctrl+r", "panel-velocidad"],
	["shift+b", "velocidad-curva"],
	["ctrl+j", "agregar-ritmo"],
];

export function v7ToV8({ state }: { state: unknown }): unknown {
	const v7 = getPersistedKeybindingsState({ state });
	if (!v7) return state;
	const keybindings = { ...v7.keybindings };

	if (keybindings["alt+x"] === "deselect-all") keybindings["alt+x"] = "quitar-rango";
	for (const [tecla, accion] of NUEVAS) {
		if (keybindings[tecla] === undefined) keybindings[tecla] = accion;
	}

	return { ...v7, keybindings };
}
