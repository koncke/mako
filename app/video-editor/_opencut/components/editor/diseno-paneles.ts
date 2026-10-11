// =============================================================================
// «Diseño ▾»: las distribuciones de paneles de CapCut
// =============================================================================
// El botón Diseño de la barra superior de CapCut (relevamiento §1) cambia los
// tamaños de los cuatro paneles con plantillas: Predeterminado (`pc_layout_default`
// «Diseño de panel equilibrado»), Archivos multimedia (`pc_layout_media`),
// Atributos (`pc_layout_attributes`), Vertical (`pc_layout_vertical`) y
// «Restablecer diseño actual» (`pc_layout_reset`).
//
// Los porcentajes son de cada grupo de react-resizable-panels, no de la ventana:
// arriba, biblioteca · reproductor · propiedades suman 100; en vertical, la zona
// de arriba y la línea de tiempo suman 100. Predeterminado sale de la captura
// medida (654/663/555 px y 675/324 px, sin las separaciones). Los otros tres son
// estimados: CapCut no los documenta y no hay captura de cada uno.
//
// ⚠️ CapCut escribe «Amplia» sin tilde en las dos descripciones: es un error de
// su traducción y acá va corregido (diseño §3, regla 1).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PanelSizes } from "@/app/video-editor/_opencut/editor/panel-store";

export type DisenoId = "predeterminado" | "multimedia" | "atributos" | "vertical";

export const DISENOS: { id: DisenoId; etiqueta: string; descripcion: string; tamanos: PanelSizes }[] = [
	{
		id: "predeterminado",
		etiqueta: "Predeterminado",
		descripcion: "Diseño de panel equilibrado.",
		tamanos: { tools: 35, preview: 35.4, properties: 29.6, mainContent: 67.6, timeline: 32.4 },
	},
	{
		id: "multimedia",
		etiqueta: "Archivos multimedia",
		descripcion: "Amplía el panel de archivos multimedia.",
		tamanos: { tools: 48, preview: 28, properties: 24, mainContent: 67.6, timeline: 32.4 },
	},
	{
		id: "atributos",
		etiqueta: "Atributos",
		descripcion: "Amplía el panel de atributos.",
		tamanos: { tools: 26, preview: 30, properties: 44, mainContent: 67.6, timeline: 32.4 },
	},
	{
		id: "vertical",
		etiqueta: "Vertical",
		descripcion: "Perfecto para videos verticales de las redes sociales.",
		// Un 9:16 necesita alto, no ancho: el reproductor se angosta y la zona de arriba crece.
		tamanos: { tools: 38, preview: 24, properties: 38, mainContent: 74, timeline: 26 },
	},
];

export function tamanosDe(id: DisenoId): PanelSizes {
	return (DISENOS.find((d) => d.id === id) ?? DISENOS[0]).tamanos;
}

type EstadoDiseno = {
	diseno: DisenoId;
	/** Sube cada vez que se pide aplicar un diseño: la distribución lo escucha y mueve los paneles. */
	pedido: number;
	elegir: (id: DisenoId) => void;
	restablecer: () => void;
};

export const useDisenoStore = create<EstadoDiseno>()(
	persist(
		(set) => ({
			diseno: "predeterminado",
			pedido: 0,
			elegir: (id) => set((s) => ({ diseno: id, pedido: s.pedido + 1 })),
			restablecer: () => set((s) => ({ pedido: s.pedido + 1 })),
		}),
		{ name: "ce-diseno", partialize: (s) => ({ diseno: s.diseno }) },
	),
);
