// =============================================================================
// La fila de abajo del reproductor según el ANCHO del panel: nunca se encima nada
// =============================================================================
// Martín, 30/10/2026, con una captura del reproductor de un 9:16 a ~500 px: «Se siguen rompiendo cosas, como esta…
// revisa bien todo». La barra era una grilla de tres columnas iguales con los botones de texto («Completa ▾», «Relación ▾»)
// fijos: por debajo de ~500 px la derecha se desbordaba y pisaba el ▶ y el tiempo, y el tiempo total se cortaba. Medido
// en el banco (la barra real, el motor reemplazado): pisaba de 460 px para abajo; y el reproductor puede llegar al 18 %
// del editor (editor-page.tsx), unos 155 px a 1280 con el chat abierto.
//
// Los niveles los decide el ancho de la BARRA (un ResizeObserver en toolbar.tsx), no el de la ventana:
//   · ancha   — como CapCut: HH:MM:SS:FF / HH:MM:SS:FF, ▶, «Completa ▾» 🔍▾ «Relación ▾» ⤢.
//   · media   — una fila: el tiempo compacto (MM:SS, o HH:MM:SS si el video pasa la hora) y la derecha en íconos.
//   · angosta — dos filas: el tiempo arriba; abajo, calidad y zoom ‹ ▶ › relación y pantalla completa.
//   · minima  — tres filas: el tiempo, el ▶ y los íconos (que se parten si tampoco entran).
// Los umbrales salen de medir cada nivel en el banco con Consolas (la mono de Windows) y Geist, con aire para otra fuente.
//
// Sin imports pesados: lo carga el test en node.

import type { TimeCodeFormat } from "@/app/video-editor/_opencut/wasm/opencut";

export type NivelBarra = "ancha" | "media" | "angosta" | "minima";

/** Desde qué ancho de barra (px) entra cada nivel. */
export const UMBRALES_BARRA = { ancha: 520, media: 340, angosta: 165 } as const;

/** El nivel para una barra de `ancho` px. Sin medir todavía (0), el de siempre. */
export function nivelDeBarra(ancho: number): NivelBarra {
	if (ancho <= 0 || ancho >= UMBRALES_BARRA.ancha) return "ancha";
	if (ancho >= UMBRALES_BARRA.media) return "media";
	if (ancho >= UMBRALES_BARRA.angosta) return "angosta";
	return "minima";
}

/** Cómo se escribe el tiempo en cada nivel. Sin cuadros fuera de la ancha; con horas sólo si el video pasa la hora. */
export function formatoDelTiempo(nivel: NivelBarra, segundosTotales: number): TimeCodeFormat {
	if (nivel === "ancha") return "HH:MM:SS:FF";
	return segundosTotales >= 3600 ? "HH:MM:SS" : "MM:SS";
}
