// Las marcas del rango (I / O), por proyecto. Viven en la SESIÓN, como la
// selección: no entran al proyecto guardado ni a Deshacer (el motor no tiene
// dónde, y tocar el esquema del proyecto por esto no vale la pena). Las reglas
// están en ./reglas.ts; quien las aplica sobre el editor, en ./acciones.ts.

import { create } from "zustand";
import { SIN_MARCAS, hayMarcas, type MarcasRango } from "./reglas";

interface RangoStore {
	porProyecto: Record<string, MarcasRango>;
	fijar: (proyecto: string, marcas: MarcasRango) => void;
}

export const useRangoStore = create<RangoStore>()((set) => ({
	porProyecto: {},
	fijar: (proyecto, marcas) =>
		set((s) => {
			const porProyecto = { ...s.porProyecto };
			if (hayMarcas(marcas)) porProyecto[proyecto] = marcas;
			else delete porProyecto[proyecto];
			return { porProyecto };
		}),
}));

export function marcasDe(proyecto: string | null | undefined): MarcasRango {
	if (!proyecto) return SIN_MARCAS;
	return useRangoStore.getState().porProyecto[proyecto] ?? SIN_MARCAS;
}
