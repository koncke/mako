import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isGuideId, type GuideId } from "@/app/video-editor/_opencut/guides";
import { DEFAULT_GRID_CONFIG } from "@/app/video-editor/_opencut/guides/grid";
import type { GridConfig } from "@/app/video-editor/_opencut/guides/types";
import {
	ESCALAS_SALIDA,
	type EscalaSalida,
} from "@/app/video-editor/_opencut/canvas/escala-salida";

type PreviewOverlaysState = Record<string, boolean>;

/**
 * Una guía de «Guías y reglas» de CapCut: una línea que el usuario pone sobre el
 * lienzo para alinear. La posición va como FRACCIÓN del lienzo (0 = borde de
 * arriba/izquierda, 1 = el de abajo/derecha) y no en píxeles: así una guía al
 * centro sigue al centro si se cambia la «Relación».
 */
export type GuiaUsuario = {
	id: string;
	eje: "horizontal" | "vertical";
	fraccion: number;
};

/** Tope de guías por proyecto («Número máximo de guías alcanzado»). */
export const MAX_GUIAS = 20;

/** «Calidad de la reproducción» del menú ≡ del reproductor. */
export type PrioridadReproduccion = "calidad" | "rendimiento";

interface PersistedPreviewState {
	activeGuide?: string | null;
	layoutGuide?: {
		platform?: string | null;
	};
	overlays?: PreviewOverlaysState;
	gridConfig?: GridConfig;
}

interface PreviewState {
	activeGuide: GuideId | null;
	overlays: PreviewOverlaysState;
	gridConfig: GridConfig;
	/** Resolución de reproducción: 1 «Completa», 0.5 «1/2», 0.25 «1/4». */
	resolucion: EscalaSalida;
	prioridad: PrioridadReproduccion;
	mostrarGuias: boolean;
	mostrarReglas: boolean;
	guiasBloqueadas: boolean;
	/** Las guías de cada proyecto, por id de proyecto. */
	guias: Record<string, GuiaUsuario[]>;
	toggleGuide: (guideId: GuideId) => void;
	setGridConfig: (config: Partial<GridConfig>) => void;
	setOverlayVisibility: ({
		overlayId,
		isVisible,
	}: {
		overlayId: string;
		isVisible: boolean;
	}) => void;
	toggleOverlayVisibility: ({ overlayId }: { overlayId: string }) => void;
	setResolucion: (resolucion: EscalaSalida) => void;
	setPrioridad: (prioridad: PrioridadReproduccion) => void;
	alternarGuias: () => void;
	alternarReglas: () => void;
	alternarBloqueoGuias: () => void;
	/** Devuelve el id de la guía nueva, o `null` si se llegó al tope. */
	agregarGuia: (args: {
		proyecto: string;
		eje: GuiaUsuario["eje"];
		fraccion: number;
	}) => string | null;
	moverGuia: (args: { proyecto: string; id: string; fraccion: number }) => void;
	borrarGuia: (args: { proyecto: string; id: string }) => void;
	eliminarGuias: (args: { proyecto: string }) => void;
}

const DEFAULT_PREVIEW_OVERLAYS: PreviewOverlaysState = {};

function getPersistedActiveGuide(
	state: PersistedPreviewState | undefined,
): GuideId | null {
	const persistedGuide =
		state?.activeGuide ?? state?.layoutGuide?.platform ?? null;

	if (typeof persistedGuide !== "string") {
		return null;
	}

	return isGuideId(persistedGuide) ? persistedGuide : null;
}

function nuevoId(): string {
	return typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `guia-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const usePreviewStore = create<PreviewState>()(
	persist(
		(set, get) => ({
			activeGuide: null,
			overlays: DEFAULT_PREVIEW_OVERLAYS,
			gridConfig: DEFAULT_GRID_CONFIG,
			resolucion: 1,
			prioridad: "calidad",
			mostrarGuias: true,
			mostrarReglas: false,
			guiasBloqueadas: false,
			guias: {},
			toggleGuide: (guideId) => {
				set((state) => ({
					activeGuide: state.activeGuide === guideId ? null : guideId,
				}));
			},
			setGridConfig: (config) => {
				set((state) => ({
					gridConfig: { ...state.gridConfig, ...config },
				}));
			},
			setOverlayVisibility: ({ overlayId, isVisible }) => {
				set((state) => ({
					overlays: {
						...state.overlays,
						[overlayId]: isVisible,
					},
				}));
			},
			toggleOverlayVisibility: ({ overlayId }) => {
				set((state) => ({
					overlays: {
						...state.overlays,
						[overlayId]: !state.overlays[overlayId],
					},
				}));
			},
			setResolucion: (resolucion) => {
				// Lo guardado en localStorage puede venir de otra versión: sólo
				// entran las tres escalas que existen.
				if (!ESCALAS_SALIDA.includes(resolucion)) return;
				set({ resolucion });
			},
			setPrioridad: (prioridad) => set({ prioridad }),
			alternarGuias: () => set((s) => ({ mostrarGuias: !s.mostrarGuias })),
			alternarReglas: () => set((s) => ({ mostrarReglas: !s.mostrarReglas })),
			alternarBloqueoGuias: () =>
				set((s) => ({ guiasBloqueadas: !s.guiasBloqueadas })),
			agregarGuia: ({ proyecto, eje, fraccion }) => {
				const actuales = get().guias[proyecto] ?? [];
				if (actuales.length >= MAX_GUIAS) return null;
				const id = nuevoId();
				set((s) => ({
					// Agregar una guía la vuelve visible: una guía nueva que no se ve
					// parece un botón roto.
					mostrarGuias: true,
					guias: {
						...s.guias,
						[proyecto]: [...(s.guias[proyecto] ?? []), { id, eje, fraccion }],
					},
				}));
				return id;
			},
			moverGuia: ({ proyecto, id, fraccion }) => {
				set((s) => ({
					guias: {
						...s.guias,
						[proyecto]: (s.guias[proyecto] ?? []).map((g) =>
							g.id === id ? { ...g, fraccion } : g,
						),
					},
				}));
			},
			borrarGuia: ({ proyecto, id }) => {
				set((s) => ({
					guias: {
						...s.guias,
						[proyecto]: (s.guias[proyecto] ?? []).filter((g) => g.id !== id),
					},
				}));
			},
			eliminarGuias: ({ proyecto }) => {
				set((s) => {
					const { [proyecto]: _borradas, ...resto } = s.guias;
					return { guias: resto };
				});
			},
		}),
		{
			name: "preview-settings",
			// Los campos nuevos (resolución, guías…) NO suben la versión: el merge
			// por defecto de zustand completa con los valores iniciales lo que no
			// estaba guardado, y subirla pasaría por `migrate`, que descarta todo
			// lo que no conoce.
			version: 6,
			migrate: (persistedState) => {
				const state = persistedState as PersistedPreviewState | undefined;

				return {
					activeGuide: getPersistedActiveGuide(state),
					overlays: DEFAULT_PREVIEW_OVERLAYS,
					gridConfig: {
						rows: state?.gridConfig?.rows ?? DEFAULT_GRID_CONFIG.rows,
						cols: state?.gridConfig?.cols ?? DEFAULT_GRID_CONFIG.cols,
					},
				};
			},
			partialize: (state) => ({
				activeGuide: state.activeGuide,
				overlays: state.overlays,
				gridConfig: state.gridConfig,
				resolucion: state.resolucion,
				prioridad: state.prioridad,
				mostrarGuias: state.mostrarGuias,
				mostrarReglas: state.mostrarReglas,
				guiasBloqueadas: state.guiasBloqueadas,
				guias: state.guias,
			}),
		},
	),
);

/** Las guías del proyecto, o una lista vacía estable (no una nueva en cada render). */
const SIN_GUIAS: GuiaUsuario[] = [];
export function guiasDe(
	state: Pick<PreviewState, "guias">,
	proyecto: string | undefined,
): GuiaUsuario[] {
	return (proyecto && state.guias[proyecto]) || SIN_GUIAS;
}
