// =============================================================================
// B-roll y planos: el resultado de «Proponer» y lo que se le dice a la persona (puro)
// =============================================================================
// `proponerBroll` (./proponer.ts) no lanza: cada salida es un resultado, y el botón y el chat leen el MISMO texto por
// motivo (la regla del Video Editor desde el ticket 23: lo que corre el chat devuelve su motivo, no lo deja en un store).

export type MotivoBroll =
	| "sin-proyecto"
	| "ocupado"
	| "sin-voz"
	| "sin-huecos"
	| "otro-proyecto"
	| "red"
	| "pexels";

export type ResultadoBroll =
	| {
			ok: true;
			/** Cuántas fotos y cuántos acercamientos quedaron propuestos. */
			broll: number;
			planos: number;
			/** Lo que conviene saber (sin IA, una búsqueda sin fotos…), en una línea. */
			aviso: string | null;
			/** El B-roll no se pudo buscar porque falta conectar Pexels (los planos sí se propusieron). */
			faltaPexels: boolean;
	  }
	| { ok: false; motivo: MotivoBroll; detalle?: string };

export const TEXTO_MOTIVO_BROLL: Readonly<Record<MotivoBroll, string>> = {
	"sin-proyecto": "Abre un proyecto con video para proponer B-roll.",
	ocupado: "MaKo ya está armando una propuesta. Espera a que termine.",
	"sin-voz": "No encontré voz en el video: el B-roll sale de lo que se dice.",
	"sin-huecos": "No hay dónde proponer: el video es muy corto o ya tiene algo encima en cada tramo.",
	"otro-proyecto": "Cambiaste de proyecto mientras se armaba la propuesta: no se tocó nada.",
	red: "No pude hablar con MaKo. Revisa tu conexión y vuelve a intentar.",
	pexels: "Pexels no contestó. Vuelve a intentar en un rato.",
};

/** El texto de un resultado que no salió: el detalle (lo que dijo Pexels o el servidor), o el del motivo. */
export function textoDeBroll(r: Extract<ResultadoBroll, { ok: false }>): string {
	return r.detalle?.trim() || TEXTO_MOTIVO_BROLL[r.motivo];
}

/** Lo que se dice cuando salió: cuántas de cada cosa, en una línea. */
export function resumenDeBroll(r: Extract<ResultadoBroll, { ok: true }>): string {
	const partes: string[] = [];
	if (r.broll) partes.push(r.broll === 1 ? "1 imagen" : `${r.broll} imágenes`);
	if (r.planos) partes.push(r.planos === 1 ? "1 cambio de plano" : `${r.planos} cambios de plano`);
	return partes.length ? `Propuestas: ${partes.join(" y ")}. Deja o saca cada una.` : "No hubo nada que proponer.";
}
