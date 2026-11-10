// =============================================================================
// chat/fondo-proyecto — lo que el chat cambia de los ajustes del proyecto (puro)
// =============================================================================
// De los ajustes del proyecto, el chat cambia UNA cosa: el fondo del lienzo (`fondo_lienzo`, el panel Proyecto › Fondo).
// Lo demás lo puede mover el motor por su cuenta mientras se aplica: un archivo de Pexels con más cuadros por segundo
// subía los fps del proyecto (`ratchetFpsForImportedMedia`, FUERA del historial). Comparar los ajustes ENTEROS hacía dos
// cosas mal (revisión adversarial del 10/11/2026):
//   · contaba un paso que el deshacer no tiene, y
//   · apagaba «Restaurar»: el deshacer volvía el fondo, pero los ajustes ya no eran «los de antes».
// Por eso aplicar.ts mira sólo el fondo, por su VALOR (el comando arma un objeto nuevo aunque el fondo sea el mismo).

import type { TBackground } from "@/app/video-editor/_opencut/project/types";

type ConFondo = { background?: TBackground | null } | null | undefined;

/** El fondo como texto comparable (color o desenfoque, con su valor); null si no hay ajustes. */
const huella = (s: ConFondo): string | null => {
	const f = s?.background;
	if (!f) return null;
	return f.type === "color" ? `color:${f.color.toLowerCase()}` : `blur:${f.blurIntensity}`;
};

/** ¿Los dos ajustes tienen el mismo fondo del lienzo? Lo demás (fps, tamaño) no cuenta. */
export function mismoFondo(a: ConFondo, b: ConFondo): boolean {
	return huella(a) === huella(b);
}
