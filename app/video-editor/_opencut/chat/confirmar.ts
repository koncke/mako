// =============================================================================
// chat/confirmar — «sí, hazlo» escrito acepta la propuesta que está esperando (9/11/2026)
// =============================================================================
// Pasó en producción el 28/10/2026 (Leandro, ws10, el proyecto «1028»): MaKo propuso los subtítulos con su tarjeta
// «Aceptar», él escribió «si hazlo» y la respuesta fue «No entiendo qué querés hacer. "Si hazlo" es muy vago». La IA del
// chat recibe SÓLO el pedido nuevo y la línea de tiempo, nunca la charla (lib/editor-video/ia.ts), así que un «sí» suelto
// no le dice nada. Y no tiene por qué ir a la IA: la propuesta ya está en la pantalla, y aceptarla es lo mismo que el botón.
//
// LA REGLA: si el ÚLTIMO mensaje del hilo es una propuesta de MaKo que espera («pendiente») y lo que se escribe es SÓLO
// una confirmación («sí», «dale», «hazlo», «aplícalo», «ok, va»…), se acepta esa propuesta. Cualquier otra palabra
// («sí, pero más corto», «sí y ponele música») ya es un pedido nuevo y va a la IA, como siempre. Con otra cosa debajo de
// la propuesta (la persona ya escribió algo después), tampoco: el «sí» ya no es la respuesta a esa tarjeta.
//
// PURO: lo usa PanelChat.tsx (`enviar`) y lo prueba tests/video-editor-confirmar-chat.test.ts.
// =============================================================================

/** Las palabras que, SOLAS (en cualquier orden y combinación), dicen «sí, aplicalo». */
const DE_CONFIRMAR = new Set([
	"si", "sii", "siii", "sip", "dale", "ok", "okay", "okey", "oki", "va", "vale", "listo", "perfecto", "genial", "bueno", "buenisimo",
	"claro", "obvio", "adelante", "acepto", "aceptar", "aceptalo", "acepta", "aplica", "aplicalo", "aplicar", "hazlo", "hacelo",
	"hagalo", "haz", "hace", "eso", "exacto", "correcto", "porfa", "por", "favor", "de", "una", "mandale", "metele", "procede",
	"proceder", "confirmo", "confirmado", "yes", "y", "lo", "ya", "ahora", "entonces", "asi", "esta", "bien", "todo",
]);
/**
 * Sin una de éstas no es una confirmación: «ya», «lo», «entonces» o «todo» solas no dicen que sí. «Por favor», «de una» y
 * «así está bien» sí (llevan «favor», «una» y «bien»).
 */
const NUCLEO = new Set([
	"si", "sii", "siii", "sip", "dale", "ok", "okay", "okey", "oki", "va", "vale", "listo", "perfecto", "genial", "claro", "obvio",
	"adelante", "acepto", "aceptar", "aceptalo", "acepta", "aplica", "aplicalo", "aplicar", "hazlo", "hacelo", "hagalo", "exacto",
	"correcto", "mandale", "metele", "procede", "proceder", "confirmo", "confirmado", "yes", "bien", "una", "favor", "porfa",
]);
const MAX_PALABRAS = 6;

/** Minúsculas, sin tildes ni signos: «¡Sí, hacelo!» → «si hacelo». */
function normalizar(texto: string): string {
	return texto
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-zñ0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** ¿Lo escrito es SÓLO una confirmación? «si hazlo» sí; «sí, pero en amarillo» no. */
export function esConfirmacion(texto: string): boolean {
	const t = normalizar(String(texto ?? ""));
	if (!t) return false;
	const palabras = t.split(" ");
	if (palabras.length > MAX_PALABRAS) return false;
	// «no», «pero», «después», un número o un nombre: ya es otra cosa.
	if (!palabras.every((p) => DE_CONFIRMAR.has(p))) return false;
	return palabras.some((p) => NUCLEO.has(p));
}

/** Lo mínimo de un mensaje del hilo que hace falta para decidir (el tipo entero vive en ./hilo.ts). */
export type MensajeParaConfirmar = { id: string; de: "yo" | "mako"; estado?: string; propuesta?: unknown };

/**
 * La propuesta que un «sí» acepta: la del ÚLTIMO mensaje del hilo, si es de MaKo, tiene propuesta y espera. Si después
 * de la tarjeta hay otro mensaje (de la persona o de MaKo), o si ya se aplicó, se descartó o se está aplicando, ninguna.
 */
export function propuestaQueConfirma<M extends MensajeParaConfirmar>(mensajes: readonly M[]): M | null {
	const ultimo = mensajes[mensajes.length - 1];
	if (!ultimo || ultimo.de !== "mako" || !ultimo.propuesta) return null;
	return ultimo.estado === "pendiente" ? ultimo : null;
}
