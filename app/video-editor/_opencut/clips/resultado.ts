// =============================================================================
// Clips mágicos: los resultados de «Buscar» y de «Abrir», y lo que se le dice a la persona (puro)
// =============================================================================
// Como el B-roll (../broll/resultado.ts): nada lanza, cada salida es un resultado, y el botón y el chat leen el MISMO
// texto por motivo.

export type MotivoClips = "sin-proyecto" | "ocupado" | "sin-voz" | "corto" | "sin-clips" | "otro-proyecto" | "red";

export type ResultadoClips = { ok: true; clips: number; aviso: string | null } | { ok: false; motivo: MotivoClips; detalle?: string };

export const TEXTO_MOTIVO_CLIPS: Readonly<Record<MotivoClips, string>> = {
	"sin-proyecto": "Abre el proyecto del video largo para buscar sus clips.",
	ocupado: "MaKo ya está trabajando en este video. Espera a que termine.",
	"sin-voz": "No encontré voz en el video: los clips salen de lo que se dice.",
	corto: "Este video ya dura como un clip: los clips mágicos son para videos de más de un minuto.",
	"sin-clips": "No encontré momentos de 15 a 60 segundos que se entiendan solos.",
	"otro-proyecto": "Cambiaste de proyecto mientras se buscaban los clips: vuelve a buscarlos en ése.",
	red: "No pude hablar con MaKo. Revisa tu conexión y vuelve a intentar.",
};

export function textoDeClips(r: Extract<ResultadoClips, { ok: false }>): string {
	return r.detalle?.trim() || TEXTO_MOTIVO_CLIPS[r.motivo];
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
