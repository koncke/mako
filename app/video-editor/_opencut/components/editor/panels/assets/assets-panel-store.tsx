// =============================================================================
// El estado de la biblioteca (panel izquierdo): pestaña, sección y preferencias
// =============================================================================
// La biblioteca de CapCut es una fila de pestañas (Multimedia, Audio, Texto…) y,
// abajo, una columna de subcategorías por pestaña. Lo que se dibuja en cada una
// sale de la ranura `seccionesBiblioteca` (ce/ranuras.ts); acá vive sólo QUÉ está
// elegido: la pestaña activa, la sección elegida de cada pestaña y qué padres
// (▾) están desplegados.
//
// Las pestañas se nombran como las categorías de la ranura (`multimedia`,
// `audio`…). El motor de OpenCut las llamaba en inglés (`media`, `effects`…) y
// todavía hay módulos que piden `setActiveTab("effects")`: se aceptan los dos
// nombres y se traduce acá, así nadie tiene que editar esos módulos para seguir
// andando.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CategoriaBiblioteca } from "@/app/video-editor/ce/ranuras";

/** El orden de la fila de pestañas de CapCut 9.3 (Plantillas y Avatar de IA quedan fuera de v1). */
export const CATEGORIAS_BIBLIOTECA: readonly CategoriaBiblioteca[] = [
	"multimedia",
	"audio",
	"texto",
	"stickers",
	"efectos",
	"transiciones",
	"subtitulos",
	"filtros",
	"ajuste",
	// «Avatar de IA» (pedido de Martín del 14/10): lo genera el Video Generator.
	"avatar",
];

/** Los nombres de pestaña de OpenCut, que otros módulos del motor siguen usando. */
const ALIAS_OPENCUT = {
	media: "multimedia",
	sounds: "audio",
	text: "texto",
	stickers: "stickers",
	effects: "efectos",
	transitions: "transiciones",
	captions: "subtitulos",
	filters: "filtros",
	adjustment: "ajuste",
} as const satisfies Record<string, CategoriaBiblioteca>;

type TabOpenCut = keyof typeof ALIAS_OPENCUT;

export type Tab = CategoriaBiblioteca;

/** La sección de Multimedia donde aparece lo importado (la usa «Mostrar en la biblioteca»). */
export const SECCION_IMPORTAR_MEDIOS = "multimedia.importar";

function aCategoria(tab: CategoriaBiblioteca | TabOpenCut): CategoriaBiblioteca {
	if ((CATEGORIAS_BIBLIOTECA as readonly string[]).includes(tab)) {
		return tab as CategoriaBiblioteca;
	}
	return ALIAS_OPENCUT[tab as TabOpenCut] ?? "multimedia";
}

export type MediaViewMode = "grid" | "list";
export type MediaSortKey = "name" | "type" | "duration" | "size";
export type MediaSortOrder = "asc" | "desc";
export type FiltroMedios = "todos" | "video" | "image" | "audio";

interface AssetsPanelStore {
	activeTab: CategoriaBiblioteca;
	setActiveTab: (tab: CategoriaBiblioteca | TabOpenCut) => void;

	/** La sección elegida de cada pestaña (id de la ranura). Sin entrada = la primera. */
	seccionElegida: Partial<Record<CategoriaBiblioteca, string>>;
	elegirSeccion: (args: { categoria: CategoriaBiblioteca; id: string }) => void;
	/** Abre una pestaña en una sección puntual (desde otro panel: «Agregar efecto» → Efectos). */
	irA: (args: { categoria: CategoriaBiblioteca | TabOpenCut; seccion?: string }) => void;

	/** Padres de la columna desplegados (▾/▴), por id de sección. */
	desplegadas: Record<string, boolean>;
	alternarDesplegada: (args: { id: string; abierta?: boolean }) => void;

	highlightMediaId: string | null;
	requestRevealMedia: (mediaId: string) => void;
	clearHighlight: () => void;

	/* Multimedia */
	mediaViewMode: MediaViewMode;
	setMediaViewMode: (mode: MediaViewMode) => void;
	mediaSortBy: MediaSortKey;
	mediaSortOrder: MediaSortOrder;
	setMediaSort: (args: { key: MediaSortKey; order: MediaSortOrder }) => void;
	filtroMedios: FiltroMedios;
	setFiltroMedios: (filtro: FiltroMedios) => void;
}

export const useAssetsPanelStore = create<AssetsPanelStore>()(
	persist(
		(set) => ({
			activeTab: "multimedia",
			setActiveTab: (tab) => set({ activeTab: aCategoria(tab) }),

			seccionElegida: {},
			elegirSeccion: ({ categoria, id }) =>
				set((state) => ({
					seccionElegida: { ...state.seccionElegida, [categoria]: id },
				})),
			irA: ({ categoria, seccion }) => {
				const destino = aCategoria(categoria);
				set((state) => ({
					activeTab: destino,
					seccionElegida: seccion
						? { ...state.seccionElegida, [destino]: seccion }
						: state.seccionElegida,
				}));
			},

			desplegadas: {},
			alternarDesplegada: ({ id, abierta }) =>
				set((state) => ({
					desplegadas: {
						...state.desplegadas,
						[id]: abierta ?? !(state.desplegadas[id] ?? true),
					},
				})),

			highlightMediaId: null,
			requestRevealMedia: (mediaId) =>
				set((state) => ({
					activeTab: "multimedia",
					seccionElegida: {
						...state.seccionElegida,
						multimedia: SECCION_IMPORTAR_MEDIOS,
					},
					filtroMedios: "todos",
					highlightMediaId: mediaId,
				})),
			clearHighlight: () => set({ highlightMediaId: null }),

			mediaViewMode: "grid",
			setMediaViewMode: (mode) => set({ mediaViewMode: mode }),
			mediaSortBy: "name",
			mediaSortOrder: "asc",
			setMediaSort: ({ key, order }) =>
				set({ mediaSortBy: key, mediaSortOrder: order }),
			filtroMedios: "todos",
			setFiltroMedios: (filtro) => set({ filtroMedios: filtro }),
		}),
		{
			name: "assets-panel",
			version: 2,
			// v1 (OpenCut) guardaba sólo las preferencias de la grilla: se conservan.
			migrate: (persisted) => persisted as AssetsPanelStore,
			partialize: (state) => ({
				seccionElegida: state.seccionElegida,
				desplegadas: state.desplegadas,
				mediaViewMode: state.mediaViewMode,
				mediaSortBy: state.mediaSortBy,
				mediaSortOrder: state.mediaSortOrder,
			}),
		},
	),
);
