// =============================================================================
// La pastilla de la barra de arriba, en corto (12/11/2026)
// =============================================================================
// Probando la tab entera en producción, mientras trabajaba la Edición automática la pastilla «en vivo · Palabras clave ·
// paso 5 de 10» tapaba el nombre del proyecto. La cabecera (components/editor/editor-header.tsx) son tres columnas con el
// nombre al centro; la de la derecha tenía `min-w-0` y su contenido no se achica (la pastilla, Diseño, Atajos, Publicar,
// Exportar), así que con el chat de MaKo al lado (el editor mide ~1000 px en una pantalla de 1440) se DESBORDABA hacia la
// izquierda, encima del nombre. Ahora esa columna no baja de lo que mide su contenido (el nombre se achica con elipsis) y la
// pastilla dice lo justo: «Palabras clave · 5/10». El texto largo (`textoPastilla`, ./plan.ts) queda en el `title`.

import { agentePorId, PASOS, type PasoId } from "./plan";

export function textoPastillaCorta(paso: PasoId | null): string {
	const i = paso ? PASOS.findIndex((p) => p.id === paso) : -1;
	if (i < 0) return "en vivo";
	return `${agentePorId(PASOS[i].agente).rol} · ${i + 1}/${PASOS.length}`;
}
