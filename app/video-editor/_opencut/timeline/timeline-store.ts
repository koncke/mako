/**
 * UI state for the timeline
 * For core logic, use EditorCore instead.
 *
 * Los interruptores de la barra de CapCut viven acá (se recuerdan por
 * navegador, como en CapCut se recuerdan por instalación):
 *   · `snappingEnabled`      = «Ajuste automático» (N)
 *   · `rippleEditingEnabled` = «Imán de la pista principal» (P). El nombre es el
 *     de OpenCut y se conserva porque editor-provider lo copia a
 *     `editor.command.isRippleEnabled`; lo que hace ahora es el imán de CapCut
 *     (ripple/iman.ts), no el ripple de todas las pistas de OpenCut.
 *   · `vinculacion` + `tiposVinculados` = «Vinculación» (`) y su menú
 *   · `ejeVistaPrevia`       = «Eje de vista previa» (S)
 *   · `modoCursor`           = «Modo de selección» (A) / «Modo de división» (B)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Las casillas de «Configuración de vinculación», en el orden de CapCut. */
export const TIPOS_VINCULO = [
	"texto",
	"stickers",
	"efectos",
	"filtros",
	"ajuste",
	"audio",
	"efectosSonido",
	"textoAVoz",
	"superposicion",
] as const;
export type TipoVinculo = (typeof TIPOS_VINCULO)[number];

/** El default de CapCut (`linkageEnableTypes` de su configuración local). */
const TIPOS_VINCULADOS_DEFAULT: Record<TipoVinculo, boolean> = {
	texto: true,
	stickers: true,
	efectos: true,
	filtros: true,
	ajuste: true,
	audio: false,
	efectosSonido: true,
	textoAVoz: true,
	superposicion: false,
};

export type ModoCursor = "seleccionar" | "dividir";

interface TimelineStore {
	snappingEnabled: boolean;
	toggleSnapping: () => void;
	rippleEditingEnabled: boolean;
	toggleRippleEditing: () => void;
	expandedElementIds: Set<string>;
	toggleElementExpanded: (elementId: string) => void;

	vinculacion: boolean;
	alternarVinculacion: () => void;
	tiposVinculados: Record<TipoVinculo, boolean>;
	fijarTiposVinculados: (tipos: Record<TipoVinculo, boolean>) => void;

	ejeVistaPrevia: boolean;
	alternarEjeVistaPrevia: () => void;
	fijarEjeVistaPrevia: (activo: boolean) => void;

	modoCursor: ModoCursor;
	fijarModoCursor: (modo: ModoCursor) => void;
}

export const useTimelineStore = create<TimelineStore>()(
	persist(
		(set) => ({
			snappingEnabled: true,

			toggleSnapping: () => {
				set((state) => ({ snappingEnabled: !state.snappingEnabled }));
			},

			// CapCut arranca con el imán prendido: la pista principal sin huecos.
			rippleEditingEnabled: true,

			toggleRippleEditing: () => {
				set((state) => ({
					rippleEditingEnabled: !state.rippleEditingEnabled,
				}));
			},

			expandedElementIds: new Set<string>(),

			toggleElementExpanded: (elementId) => {
				set((state) => {
					const next = new Set(state.expandedElementIds);
					if (next.has(elementId)) {
						next.delete(elementId);
					} else {
						next.add(elementId);
					}
					return { expandedElementIds: next };
				});
			},

			vinculacion: true,
			alternarVinculacion: () =>
				set((state) => ({ vinculacion: !state.vinculacion })),
			tiposVinculados: TIPOS_VINCULADOS_DEFAULT,
			fijarTiposVinculados: (tipos) => set({ tiposVinculados: tipos }),

			ejeVistaPrevia: true,
			alternarEjeVistaPrevia: () =>
				set((state) => ({ ejeVistaPrevia: !state.ejeVistaPrevia })),
			fijarEjeVistaPrevia: (activo) => set({ ejeVistaPrevia: activo }),

			modoCursor: "seleccionar",
			fijarModoCursor: (modo) => set({ modoCursor: modo }),
		}),
		{
			// Nombre nuevo a propósito: el de OpenCut («timeline-store») guardaba el
			// ripple APAGADO, y heredarlo dejaría el imán de CapCut apagado de entrada.
			name: "ce-linea-tiempo",
			partialize: (state) => ({
				snappingEnabled: state.snappingEnabled,
				rippleEditingEnabled: state.rippleEditingEnabled,
				vinculacion: state.vinculacion,
				tiposVinculados: state.tiposVinculados,
				ejeVistaPrevia: state.ejeVistaPrevia,
			}),
			merge: (persisted, current) => {
				const p = (persisted ?? {}) as Partial<TimelineStore>;
				return {
					...current,
					...p,
					// Un tipo de vínculo agregado después de guardar arranca con su default.
					tiposVinculados: {
						...TIPOS_VINCULADOS_DEFAULT,
						...(p.tiposVinculados ?? {}),
					},
				};
			},
		},
	),
);
