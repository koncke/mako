// =============================================================================
// B-roll y planos: las preferencias y el trabajo en curso
// =============================================================================
// Como «Subtítulos automáticos» (../subtitles/estado.ts): las preferencias se recuerdan en el navegador (por comodidad),
// y el trabajo vive FUERA del componente: la persona puede ir a otra pestaña mientras se transcribe o se bajan las fotos,
// y la propuesta tiene que llegar a la línea de tiempo aunque el panel ya no esté dibujado.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Ritmo } from "@/lib/editor-video/broll";

type Preferencias = {
	ritmo: Ritmo;
	/** Proponer también los cambios de plano (el efecto «Acercar»). */
	planos: boolean;
	fijar: (cambio: Partial<Omit<Preferencias, "fijar">>) => void;
};

export const usePreferenciasBroll = create<Preferencias>()(
	persist(
		(set) => ({ ritmo: "normal", planos: true, fijar: (cambio) => set(cambio) }),
		{ name: "ve-broll", version: 1, partialize: ({ ritmo, planos }) => ({ ritmo, planos }) },
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
	fijar: (cambio: Partial<Omit<Trabajo, "fijar">>) => void;
};

export const useTrabajoBroll = create<Trabajo>()((set) => ({
	fase: "inactivo",
	progreso: 0,
	mensaje: null,
	error: false,
	faltaPexels: false,
	fijar: (cambio) => set(cambio),
}));
