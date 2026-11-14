// =============================================================================
// Clips mágicos: los resultados de «Buscar» y de «Abrir», y lo que se le dice a la persona (puro)
// =============================================================================
// Como el B-roll (../broll/resultado.ts): nada lanza, cada salida es un resultado, y el botón y el chat leen el MISMO
// texto por motivo.

import { textoSoloPro } from "@/lib/topes-plan";

export type MotivoClips = "sin-proyecto" | "ocupado" | "sin-voz" | "corto" | "sin-clips" | "otro-proyecto" | "red" | "solo-pro";

export type ResultadoClips = { ok: true; clips: number; aviso: string | null } | { ok: false; motivo: MotivoClips; detalle?: string };

export const TEXTO_MOTIVO_CLIPS: Readonly<Record<MotivoClips, string>> = {
	"sin-proyecto": "Abre el proyecto del video largo para buscar sus clips.",
	ocupado: "MaKo ya está trabajando en este video. Espera a que termine.",
	"sin-voz": "No encontré voz en el video: los clips salen de lo que se dice.",
	corto: "Este video ya dura como un clip: los clips mágicos son para videos de más de un minuto.",
	"sin-clips": "No encontré momentos de 15 a 60 segundos que se entiendan solos.",
	"otro-proyecto": "Cambiaste de proyecto mientras se buscaban los clips: vuelve a buscarlos en ése.",
	red: "No pude hablar con MaKo. Revisa tu conexión y vuelve a intentar.",
	// Editar con IA es SÓLO de MaKo Pro (14/11/2026, lib/editores-ia-pro.ts). No es una falla: el panel muestra el candado.
	"solo-pro": textoSoloPro("ia-editores"),
};

/**
 * ¿Es una FALLA (va con «Reportar a Soporte»)? Sólo no poder hablar con MaKo. Lo demás dice qué hacer —el video ya es corto,
 * no tiene voz, no hay momentos que se entiendan solos—: con «Reportar a Soporte» parecía que algo se había roto (13/11/2026).
 */
export function esFallaDeClips(r: ResultadoClips): boolean {
	return !r.ok && r.motivo === "red";
}

export function textoDeClips(r: Extract<ResultadoClips, { ok: false }>): string {
	return r.detalle?.trim() || TEXTO_MOTIVO_CLIPS[r.motivo];
}

/** La línea de tiempo sobre la que se dijo un mensaje: el proyecto y su duración (en ticks) de ESE momento. */
export type VigenciaMensaje = { proyectoId: string; duracion: number };

/**
 * ¿El mensaje sigue valiendo? Uno dicho sobre una línea de tiempo deja de valer cuando la línea cambia: pasó (12/11/2026,
 * producción) que con un video corto quedó «Este video ya dura como un clip…», y después de sumarle video (ya duraba 2:28)
 * seguía ahí. Sin vigencia (el aviso de «Abrir», que se lee en el proyecto NUEVO), vale siempre.
 */
export function mensajeVigente(
	vigencia: VigenciaMensaje | null,
	ahora: { proyectoId: string | null; duracion: number },
): boolean {
	if (!vigencia) return true;
	return vigencia.proyectoId === ahora.proyectoId && vigencia.duracion === ahora.duracion;
}

export type MotivoAbrir = "sin-proyecto" | "ocupado" | "no-se-copio" | "no-se-armo";

export type ResultadoAbrir = { ok: true; id: string; aviso: string | null } | { ok: false; motivo: MotivoAbrir };

/** Lo que se dice si al pasar a vertical se sacaron fotogramas clave de posición o escala (./cubrir.ts). */
export function avisoDeAnimaciones(clips: number): string | null {
	if (!(clips > 0)) return null;
	const cuales = clips === 1 ? "del video" : `de ${clips} clips del video`;
	return `Saqué las animaciones de posición y escala ${cuales}: eran del cuadro horizontal. Si las quieres, anímalas de nuevo en el vertical.`;
}

export const TEXTO_MOTIVO_ABRIR: Readonly<Record<MotivoAbrir, string>> = {
	"sin-proyecto": "Abre el proyecto del video largo primero.",
	ocupado: "Ya se está abriendo un clip. Espera a que termine.",
	"no-se-copio": "No se pudo copiar el proyecto (puede faltar espacio en el navegador). El original quedó igual.",
	"no-se-armo": "No se pudo armar el clip. El original quedó igual.",
};
