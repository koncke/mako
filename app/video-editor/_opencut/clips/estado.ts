// =============================================================================
// Clips mágicos: las preferencias y el trabajo en curso
// =============================================================================
// Como el B-roll (../broll/estado.ts): cuántos clips se piden se recuerda en el navegador; los clips encontrados viven
// fuera del componente, atados al proyecto donde se buscaron (`proyectoId`): en otro proyecto no se muestran.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TOPES_CLIPS, type ClipElegido } from "@/lib/editor-video/clips";
import type { VigenciaMensaje } from "./resultado";

type Preferencias = { cuantos: number; fijar: (cambio: Partial<Omit<Preferencias, "fijar">>) => void };

export const usePreferenciasClips = create<Preferencias>()(
	persist((set) => ({ cuantos: TOPES_CLIPS.porDefecto, fijar: (cambio) => set(cambio) }), {
		name: "ve-clips",
		version: 1,
		partialize: ({ cuantos }) => ({ cuantos }),
	}),
);

export type FaseClips = "inactivo" | "escuchando" | "eligiendo" | "encuadrando" | "abriendo";

export const TEXTO_FASE_CLIPS: Readonly<Record<Exclude<FaseClips, "inactivo">, string>> = {
	escuchando: "Escuchando el video…",
	eligiendo: "Buscando los mejores momentos…",
	encuadrando: "Buscando a la persona para encuadrar el vertical…",
	abriendo: "Armando el clip en un proyecto nuevo…",
};

type Trabajo = {
	fase: FaseClips;
	progreso: number;
	/** El proyecto donde se buscaron (los clips son de ése). */
	proyectoId: string | null;
	clips: ClipElegido[];
	conIA: boolean;
	mensaje: string | null;
	error: boolean;
	/** La línea sobre la que se dijo `mensaje` (./resultado.ts › mensajeVigente): si cambia, el mensaje no se muestra. */
	vigencia: VigenciaMensaje | null;
	fijar: (cambio: Partial<Omit<Trabajo, "fijar">>) => void;
};

export const useTrabajoClips = create<Trabajo>()((set) => ({
	fase: "inactivo",
	progreso: 0,
	proyectoId: null,
	clips: [],
	conIA: false,
	mensaje: null,
	error: false,
	vigencia: null,
	fijar: (cambio) => set(cambio),
}));
