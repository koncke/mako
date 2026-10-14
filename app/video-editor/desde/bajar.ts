// =============================================================================
// Bajar un .mp4 entero a un Blob, con progreso, y sin aceptar la página de /login
// =============================================================================
// Salió de ./ImportarDesde.tsx («Editar en el editor») para que lo use también la
// pestaña «Avatar de IA» (../_opencut/avatar/generar.ts): las dos bajan un clip
// del bucket público `video-clips` y lo meten en el proyecto. Una sola bajada,
// con sus dos trampas resueltas una vez.
//
// ⚠️ CORS: medido el 11/10/2026 con curl contra el bucket público (`206` con
// `Access-Control-Allow-Origin: *`, y el preflight con `Range` también pasa). Si
// el bucket dejara de ser público, esto falla y hace falta una ruta autenticada.

/** Baja el video. Tira si la red falla o si lo que llega no es un video. */
export async function bajarVideo(url: string, alAvanzar: (pct: number) => void): Promise<Blob> {
	const r = await fetch(url).catch(() => null);
	if (!r?.ok) throw new Error("red");
	// ⚠️ Un .mp4 que llega como HTML es la página de /login: el proxy rebota sin
	// sesión con un 307 que el fetch sigue y termina en 200 (relevamiento de
	// integración, §0.3). El status no lo delata; el tipo sí.
	const tipo = r.headers.get("content-type") ?? "";
	if (!tipo.startsWith("video/")) throw new Error("red");
	// `Content-Length` es una cabecera que CORS deja leer sin exponerla.
	const total = Number(r.headers.get("content-length")) || 0;
	if (!r.body || total <= 0) return r.blob();
	const lector = r.body.getReader();
	const partes: BlobPart[] = [];
	let leidos = 0;
	for (;;) {
		const { done, value } = await lector.read();
		if (done) break;
		partes.push(value as BlobPart);
		leidos += value.byteLength;
		alAvanzar(Math.min(99, Math.round((leidos * 100) / total)));
	}
	return new Blob(partes, { type: tipo });
}
