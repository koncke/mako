// =============================================================================
// enjambre/estado — la «Edición automática» en curso: qué agente trabaja y lo que va haciendo
// =============================================================================
// Vive FUERA de los componentes, como el trabajo del B-roll (../broll/estado.ts): la persona puede ir a otra
// pestaña de la biblioteca mientras el enjambre trabaja, y la barra de arriba, el panel y los cursores leen lo mismo.
// No se guarda en la base: es cómo se vio el trabajo. Lo que se hizo queda en la línea de tiempo.
// =============================================================================

import { create } from "zustand";
import type { SceneTracks } from "@/app/video-editor/_opencut/timeline/types";
import { AGENTES, type AgenteId, type LineaActividad, type PasoId, type TipoLinea } from "./plan";

/** Biblioteca › Multimedia › «Edición automática» (./registro.ts): ahí está el panel con el registro. */
export const SECCION_ENJAMBRE = "multimedia.enjambre";

export type EstadoAgente = "esperando" | "trabajando" | "listo" | "salteado" | "fallo";

export type FaseEnjambre = "inactivo" | "corriendo" | "terminado";

/** Lo que hace falta para «Deshacer todo»: los pasos del historial que dejó la corrida, si nadie tocó nada después. */
export type DeshacerEnjambre = { escenaId: string; antes: SceneTracks; despues: SceneTracks; pasos: number };

type Enjambre = {
	fase: FaseEnjambre;
	paso: PasoId | null;
	agentes: Record<AgenteId, EstadoAgente>;
	lineas: LineaActividad[];
	/** «Detener»: se termina el paso que corre y no se empieza otro. */
	detener: boolean;
	deshacer: DeshacerEnjambre | null;
	/** El resumen del final, o por qué no arrancó. */
	resumen: string | null;
	error: boolean;
};

const agentesEn = (e: EstadoAgente) => Object.fromEntries(AGENTES.map((a) => [a.id, e])) as Record<AgenteId, EstadoAgente>;

export const useEnjambre = create<Enjambre>()(() => ({
	fase: "inactivo",
	paso: null,
	agentes: agentesEn("esperando"),
	lineas: [],
	detener: false,
	deshacer: null,
	resumen: null,
	error: false,
}));

let siguienteId = 1;

/** Un renglón del registro, con la hora de ahora. */
export function anotar(agente: AgenteId, tipo: TipoLinea, texto: string, en: number | null = null): void {
	const linea: LineaActividad = { id: siguienteId++, agente, en, texto, tipo, ms: Date.now() };
	useEnjambre.setState((s) => ({ lineas: [...s.lineas, linea] }));
}

export function fijarAgente(agente: AgenteId, estado: EstadoAgente): void {
	useEnjambre.setState((s) => ({ agentes: { ...s.agentes, [agente]: estado } }));
}

/** Una corrida nueva arranca de cero: registro vacío, todos esperando. */
export function empezarCorrida(): void {
	useEnjambre.setState({
		fase: "corriendo",
		paso: null,
		agentes: agentesEn("esperando"),
		lineas: [],
		detener: false,
		deshacer: null,
		resumen: null,
		error: false,
	});
}

export function pedirDetener(): void {
	if (useEnjambre.getState().fase === "corriendo") useEnjambre.setState({ detener: true });
}
