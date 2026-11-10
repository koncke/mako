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

/** El aviso cuando falta Pexels, con lo que se pidió (fotos o videos). */
export function avisoFaltaPexels(medio: "fotos" | "videos"): string {
	return `para ${medio === "videos" ? "los videos" : "las fotos"}, conecta Pexels en «B-roll de MaKo»`;
}

/** Lo que se dice cuando salió: cuántas de cada cosa, en una línea. */
export function resumenDeBroll(r: Extract<ResultadoBroll, { ok: true }>): string {
	const partes: string[] = [];
	if (r.broll) partes.push(r.broll === 1 ? "1 imagen" : `${r.broll} imágenes`);
	if (r.planos) partes.push(r.planos === 1 ? "1 cambio de plano" : `${r.planos} cambios de plano`);
	return partes.length ? `Propuestas: ${partes.join(" y ")}. Deja o saca cada una.` : "No hubo nada que proponer.";
}

// ── «Cambiar por otra» (./cambiar.ts) ─────────────────────────────────────────

export type MotivoCambioBroll =
	| "ocupado"
	| "sin-broll"
	| "bloqueada"
	| "sacado"
	| "sin-otra"
	| "falta-pexels"
	| "corto"
	| "otro-proyecto"
	| "red"
	| "pexels";

export type ResultadoCambioBroll =
	| { ok: true; medio: "fotos" | "videos"; autor: string }
	| { ok: false; motivo: MotivoCambioBroll; detalle?: string };

export const TEXTO_MOTIVO_CAMBIO_BROLL: Readonly<Record<MotivoCambioBroll, string>> = {
	ocupado: "MaKo ya está trayendo el reemplazo. Espera a que termine.",
	"sin-broll": "Ese elemento no es un B-roll de MaKo: se cambia con «Reemplazar».",
	bloqueada: "Ese B-roll está en una pista bloqueada: desbloquéala para cambiarlo.",
	sacado: "Lo sacaste mientras se traía: no se tocó nada.",
	"sin-otra": "No hay otra imagen de esa búsqueda que no hayas visto. Saca esta o vuelve a proponer.",
	"falta-pexels": "Conecta Pexels para traer otra foto o video.",
	corto: "Ningún video de esa búsqueda dura lo que este lugar: acorta el B-roll en la línea de tiempo y vuelve a pedir otro, o elige fotos.",
	"otro-proyecto": "Cambiaste de proyecto mientras se traía la imagen: no se tocó nada.",
	red: "No pude hablar con MaKo. Revisa tu conexión y vuelve a intentar.",
	pexels: "Pexels no contestó. Vuelve a intentar en un rato.",
};

/**
 * Lo que «Otra» le dice a la persona si el B-roll no se puede cambiar (../pistas.ts → `puedeCambiarBroll`), ANTES de
 * bajar el archivo o al VOLVER. Al volver, que ya no esté (o que ya no sea un B-roll) es que la persona lo sacó o lo
 * reemplazó mientras se traía: no es «no es un B-roll». null = se puede.
 */
export function motivoSiNoSePuede(puede: "si" | "falta" | "no-broll" | "bloqueada", momento: "antes" | "despues"): MotivoCambioBroll | null {
	if (puede === "si") return null;
	if (puede === "bloqueada") return "bloqueada";
	return momento === "despues" ? "sacado" : "sin-broll";
}

/** El texto de un cambio que no salió: el detalle (lo que dijo Pexels o el servidor), o el del motivo. */
export function textoDeCambioBroll(r: Extract<ResultadoCambioBroll, { ok: false }>): string {
	return r.detalle?.trim() || TEXTO_MOTIVO_CAMBIO_BROLL[r.motivo];
}

/** Lo que se dice cuando salió, en una línea. */
export function resumenDeCambioBroll(r: Extract<ResultadoCambioBroll, { ok: true }>): string {
	const que = r.medio === "videos" ? "Otro video" : "Otra imagen";
	return r.autor ? `${que} en su lugar (de ${r.autor}, en Pexels).` : `${que} en su lugar.`;
}
