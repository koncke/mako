// El zoom de la línea de tiempo, visible para la barra de herramientas.
//
// El estado del zoom vive en el controlador de la línea de tiempo
// (hooks/use-timeline-zoom). La barra se dibuja desde las ranuras, que sólo
// reciben `{ editor, seleccion }`: el deslizador y los botones Acercar/Alejar
// leen y escriben acá, y la línea de tiempo publica su zoom y sus funciones al
// montarse (components/index.tsx).

import { create } from "zustand";

type ZoomLinea = {
	zoom: number;
	min: number;
	max: number;
	fijarZoom: (zoom: number) => void;
	/** «Hacer zoom para ajustar la línea de tiempo». */
	ajustar: () => void;
	publicar: (estado: Omit<ZoomLinea, "publicar">) => void;
};

export const useZoomLinea = create<ZoomLinea>((set) => ({
	zoom: 1,
	min: 0.1,
	max: 100,
	fijarZoom: () => {},
	ajustar: () => {},
	publicar: (estado) => set(estado),
}));
