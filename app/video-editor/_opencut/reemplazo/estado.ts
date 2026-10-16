// El clip que se está por reemplazar, mientras el diálogo «Reemplazar el clip» está
// abierto (./dialogo-reemplazar.tsx, montado una vez en editor-page.tsx). Lo abren el
// menú del clip y el botón «Sustituir» de una muestra (timeline-element.tsx).

import { create } from "zustand";
import type { ElementRef } from "@/app/video-editor/_opencut/timeline";

export const useReemplazo = create<{
	objetivo: ElementRef | null;
	abrir: (ref: ElementRef) => void;
	cerrar: () => void;
}>()((set) => ({
	objetivo: null,
	abrir: (objetivo) => set({ objetivo }),
	cerrar: () => set({ objetivo: null }),
}));

/** Para abrirlo desde afuera de React (el menú lo abre en un `setTimeout`). */
export const abrirReemplazo = (ref: ElementRef) => useReemplazo.getState().abrir(ref);
