"use client";

// Los atajos para el panel «Atajos», agrupados como en CapCut (Línea de
// tiempo · Reproductor · Básico) y en el orden de las acciones en
// definitions.ts, que es el del panel de CapCut (no alfabético).

import { useMemo } from "react";
import { useKeybindingsStore } from "@/app/video-editor/_opencut/actions/keybindings-store";
import {
	ACTIONS,
	CATEGORIAS_ACCION,
	formatearTecla,
	type TActionWithOptionalArgs,
} from "@/app/video-editor/_opencut/actions";
import { isAppleDevice } from "@/app/video-editor/_opencut/utils/platform";

export interface KeyboardShortcut {
	id: string;
	keys: string[];
	description: string;
	category: string;
	action: TActionWithOptionalArgs;
	icon?: React.ReactNode;
}

const ORDEN_CATEGORIAS = ["linea", "reproductor", "basico"] as const;
const ORDEN_ACCIONES = Object.keys(ACTIONS);

/** «ctrl+shift+z» → «Ctrl+Shift+Z» (en Mac, ⌘ y ⌥). */
function formatKey({ key }: { key: string }): string {
	const mac = isAppleDevice();
	return key
		.split("+")
		.map((parte) => {
			if (mac && parte === "ctrl") return "⌘";
			if (mac && parte === "alt") return "⌥";
			return formatearTecla(parte);
		})
		.join("+");
}

export function useKeyboardShortcutsHelp() {
	const { keybindings } = useKeybindingsStore();

	const shortcuts = useMemo(() => {
		const actionToKeys = new Map<TActionWithOptionalArgs, string[]>();

		for (const [key, action] of keybindings) {
			const existing = actionToKeys.get(action);
			if (existing) {
				existing.push(formatKey({ key }));
			} else {
				actionToKeys.set(action, [formatKey({ key })]);
			}
		}

		const result: KeyboardShortcut[] = [];
		for (const [action, keys] of actionToKeys) {
			const actionDef = ACTIONS[action];
			if (!actionDef || actionDef.category === "interno") continue;
			result.push({
				id: action,
				keys,
				description: actionDef.description,
				category: CATEGORIAS_ACCION[actionDef.category],
				action,
			});
		}

		const posCategoria = (rotulo: string) =>
			ORDEN_CATEGORIAS.findIndex((c) => CATEGORIAS_ACCION[c] === rotulo);
		return result.sort(
			(a, b) =>
				posCategoria(a.category) - posCategoria(b.category) ||
				ORDEN_ACCIONES.indexOf(a.action) - ORDEN_ACCIONES.indexOf(b.action),
		);
	}, [keybindings]);

	return {
		shortcuts,
	};
}
