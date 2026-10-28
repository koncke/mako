// =============================================================================
// chat/armado — lo que MaKo va haciendo al ACEPTAR una propuesta que tarda, a la vista
// =============================================================================
// AGENTS.md, «Lo que MaKo construye se ve CONSTRUYÉNDOSE» (Martín, 28/10/2026). Al aceptar «Borrar los
// silencios», MaKo escucha cada clip y corta: la tarjeta de la propuesta muestra la fase y cada silencio
// que encontró, en el orden en que lo encontró (la pieza es app/_ui/ArmadoEnVivo.tsx, que revela de a
// uno con su cadencia). Lo que se cuenta es lo que pasó: nada de progreso inventado.
//
// Un store de módulo por mensaje, como el hilo (./hilo.ts), y NO se guarda en la base: es cómo se vio el
// trabajo, no lo que se hizo (eso queda en la línea de tiempo y en «Aplicado»).
// =============================================================================

import { useSyncExternalStore } from "react";

/** Lo que va pasando al aplicar (chat/aplicar.ts → `alProgreso`). Los segundos son de la LÍNEA de tiempo. */
export type ProgresoChat =
	| { tipo: "escuchando"; titulo: string }
	| { tipo: "silencio"; titulo: string; desde: number; hasta: number }
	| { tipo: "cortando" }
	| { tipo: "listo"; segundos: number }
	| { tipo: "fallo" };

export type ArmadoChat = {
	fase: "escuchando" | "cortando" | "listo" | "fallo";
	/** El clip que se está escuchando (el último que empezó). */
	escuchando: string | null;
	silencios: Array<{ titulo: string; desde: number; hasta: number }>;
	/** Lo que se quitó, al terminar. */
	segundos?: number;
};

/** Suma un paso a lo que se ve. Puro: lo prueba tests/video-editor-chat.test.ts. */
export function sumarProgreso(a: ArmadoChat | null, p: ProgresoChat): ArmadoChat {
	const base: ArmadoChat = a ?? { fase: "escuchando", escuchando: null, silencios: [] };
	switch (p.tipo) {
		case "escuchando":
			return { ...base, fase: "escuchando", escuchando: p.titulo };
		case "silencio":
			return { ...base, silencios: [...base.silencios, { titulo: p.titulo, desde: p.desde, hasta: p.hasta }] };
		case "cortando":
			return { ...base, fase: "cortando" };
		case "listo":
			return { ...base, fase: "listo", segundos: p.segundos };
		case "fallo":
			return { ...base, fase: "fallo" };
	}
}

const armados = new Map<string, ArmadoChat>();
const oyentes = new Set<() => void>();

export function anotarProgreso(mensajeId: string, p: ProgresoChat): void {
	armados.set(mensajeId, sumarProgreso(armados.get(mensajeId) ?? null, p));
	for (const o of oyentes) o();
}

/** Un «Aceptar» nuevo del mismo mensaje (después de «Aplicar igual», por ejemplo) arranca de cero. */
export function empezarArmado(mensajeId: string): void {
	armados.delete(mensajeId);
	for (const o of oyentes) o();
}

function suscribir(f: () => void) {
	oyentes.add(f);
	return () => {
		oyentes.delete(f);
	};
}

export function useArmado(mensajeId: string): ArmadoChat | null {
	return useSyncExternalStore(suscribir, () => armados.get(mensajeId) ?? null, () => null);
}
