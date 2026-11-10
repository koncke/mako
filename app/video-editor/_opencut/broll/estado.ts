// =============================================================================
// B-roll y planos: las preferencias y el trabajo en curso
// =============================================================================
// Como «Subtítulos automáticos» (../subtitles/estado.ts): las preferencias se recuerdan en el navegador (por comodidad),
// y el trabajo vive FUERA del componente: la persona puede ir a otra pestaña mientras se transcribe o se bajan las fotos,
// y la propuesta tiene que llegar a la línea de tiempo aunque el panel ya no esté dibujado.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Ritmo } from "@/lib/editor-video/broll";
import type { MedioBroll } from "./pistas";

type Preferencias = {
	ritmo: Ritmo;
	/** Proponer también los cambios de plano (el efecto «Acercar»). */
	planos: boolean;
	/** Qué trae de Pexels: fotos (lo de siempre) o videos cortos. */
	medio: MedioBroll;
	fijar: (cambio: Partial<Omit<Preferencias, "fijar">>) => void;
};

export const usePreferenciasBroll = create<Preferencias>()(
	persist(
		(set) => ({ ritmo: "normal", planos: true, medio: "fotos", fijar: (cambio) => set(cambio) }),
		// Lo guardado antes de los videos no trae `medio`: se queda con el de arriba («fotos»).
		{ name: "ve-broll", version: 1, partialize: ({ ritmo, planos, medio }) => ({ ritmo, planos, medio }) },
	),
);

export type FaseBroll = "inactivo" | "escuchando" | "eligiendo" | "buscando" | "bajando" | "armando";

export const TEXTO_FASE: Readonly<Record<Exclude<FaseBroll, "inactivo">, string>> = {
	escuchando: "Escuchando el video…",
	eligiendo: "Eligiendo dónde…",
	buscando: "Buscando las imágenes…",
	bajando: "Bajando las imágenes…",
	armando: "Armando la propuesta…",
};

type Trabajo = {
	fase: FaseBroll;
	/** 0–100 dentro de la fase. */
	progreso: number;
	/** Lo último que pasó: el resumen o el porqué de lo que no salió. */
	mensaje: string | null;
	error: boolean;
	faltaPexels: boolean;
	/** El B-roll al que «Cambiar por otra» le está trayendo otro archivo (su id), o null. */
	cambiando: string | null;
	fijar: (cambio: Partial<Omit<Trabajo, "fijar">>) => void;
};

export const useTrabajoBroll = create<Trabajo>()((set) => ({
	fase: "inactivo",
	progreso: 0,
	mensaje: null,
	error: false,
	faltaPexels: false,
	cambiando: null,
	fijar: (cambio) => set(cambio),
}));
