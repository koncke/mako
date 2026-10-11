import { create } from "zustand";

// La memoria del panel derecho (sesión, no se guarda con el proyecto).
//
// `activeTabPerType[tipo]` guarda la VISTA activa para ese tipo de elemento: el
// id de la sub-pestaña si la pestaña tiene control segmentado (Video › Básico ·
// Máscara), o el de la pestaña si no lo tiene. Los ids de las sub-pestañas son
// únicos en toda la ranura (ce/ranuras.ts guarda por id), así que la vista sola
// alcanza para saber pestaña y sub-pestaña. Se guarda así, y no como «pestaña»,
// porque el overlay del reproductor (preview-interaction-overlay.tsx) entra en
// modo máscara leyendo `activeTabPerType[tipo] === "masks"`: la sub-pestaña
// «Máscara» se registra con ese id y el contrato sigue andando sin tocarlo.
//
// `subpestanaPorPestana[`${tipo}:${pestaña}`]` recuerda la última sub-pestaña de
// cada pestaña: al volver a «Video» se vuelve a «Máscara» si ahí estabas.
//
// `escalaUniforme[elementId]` es el interruptor «Escala uniforme» de CapCut
// (encendido por defecto). CapCut lo guarda en el clip; acá vive en la sesión
// porque el motor no tiene dónde, y apagado sólo muestra X/Y por separado: no
// cambia ningún valor.

interface PropertiesState {
	activeTabPerType: Record<string, string>;
	setActiveTab: (args: { elementType: string; tabId: string }) => void;
	subpestanaPorPestana: Record<string, string>;
	recordarSubpestana: (args: {
		elementType: string;
		pestana: string;
		subpestana: string;
	}) => void;
	escalaUniforme: Record<string, boolean>;
	setEscalaUniforme: (args: { elementId: string; uniforme: boolean }) => void;
	isTransformScaleLocked: boolean;
	setTransformScaleLocked: (args: { locked: boolean }) => void;
}

export const usePropertiesStore = create<PropertiesState>()((set) => ({
	activeTabPerType: {},
	setActiveTab: ({ elementType, tabId }) =>
		set((state) => ({
			activeTabPerType: { ...state.activeTabPerType, [elementType]: tabId },
		})),
	subpestanaPorPestana: {},
	recordarSubpestana: ({ elementType, pestana, subpestana }) =>
		set((state) => ({
			subpestanaPorPestana: {
				...state.subpestanaPorPestana,
				[`${elementType}:${pestana}`]: subpestana,
			},
		})),
	escalaUniforme: {},
	setEscalaUniforme: ({ elementId, uniforme }) =>
		set((state) => ({
			escalaUniforme: { ...state.escalaUniforme, [elementId]: uniforme },
		})),
	isTransformScaleLocked: false,
	setTransformScaleLocked: ({ locked }) =>
		set({ isTransformScaleLocked: locked }),
}));
