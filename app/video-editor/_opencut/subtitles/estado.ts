// =============================================================================
// El estado de «Subtítulos»: preferencias y el trabajo en curso
// =============================================================================
// Dos stores:
//   · Preferencias (se recuerdan en el navegador, por comodidad): el idioma, las
//     muletillas, «Eliminar los subtítulos actuales», las palabras clave y la plantilla
//     elegida (una de fábrica o un preset de la marca, «preset:<id>»: ./presets.ts).
//   · El trabajo de «Generar» en curso. Vive FUERA del componente: el cliente
//     puede ir a otra pestaña de la biblioteca mientras Whisper transcribe, y al
//     volver tiene que ver el progreso — y los subtítulos tienen que llegar a la
//     línea de tiempo aunque el panel ya no esté dibujado.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TranscriptionLanguage } from "@/app/video-editor/_opencut/transcription/types";
import { PLANTILLA_POR_DEFECTO } from "./estilos";

type Preferencias = {
	idioma: TranscriptionLanguage;
	muletillas: boolean;
	eliminarActuales: boolean;
	plantilla: string;
	/** «Resaltar palabras clave automáticamente» (./claves.ts) al generar. */
	claves: boolean;
	/** «Emojis automáticos» (./emojis.ts) al generar. */
	emojis: boolean;
	/** La última voz elegida en «Texto a voz» (id de ElevenLabs de la cuenta del cliente). */
	voz: string | null;
	fijar: (cambio: Partial<Omit<Preferencias, "fijar">>) => void;
};

export const usePreferenciasSubtitulos = create<Preferencias>()(
	persist(
		(set) => ({
			// Español y no «Detectar»: el público de MaKo habla español y la
			// detección sobre un audio corto se equivoca más que el default.
			idioma: "es",
			muletillas: false,
			eliminarActuales: true,
			plantilla: PLANTILLA_POR_DEFECTO.id,
			claves: false,
			emojis: false,
			voz: null,
			fijar: (cambio) => set(cambio),
		}),
		{
			name: "ve-subtitulos",
			version: 1,
			partialize: ({ idioma, muletillas, eliminarActuales, plantilla, claves, emojis, voz }) => ({
				idioma,
				muletillas,
				eliminarActuales,
				plantilla,
				claves,
				emojis,
				voz,
			}),
		},
	),
);

export type FaseGenerar =
	| "inactivo"
	| "audio"
	| "modelo"
	| "transcribiendo"
	| "armando";

type Trabajo = {
	fase: FaseGenerar;
	/** 0–100 dentro de la fase. */
	progreso: number;
	error: string | null;
	fijar: (cambio: Partial<Omit<Trabajo, "fijar">>) => void;
};

export const useTrabajoSubtitulos = create<Trabajo>()((set) => ({
	fase: "inactivo",
	progreso: 0,
	error: null,
	fijar: (cambio) => set(cambio),
}));
