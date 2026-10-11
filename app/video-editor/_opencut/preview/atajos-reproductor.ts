"use client";

// =============================================================================
// Los atajos del REPRODUCTOR (preset «CapCut» de Windows)
// =============================================================================
// relevamiento-capcut-armazon.md §10, tabla «Reproductor»:
//
//   Espacio            Reproducir/Pausar
//   ← / →              Cuadro anterior / Siguiente cuadro
//   Shift+← / Shift+→  Retroceder / Avanzar muchos fotogramas (10)
//   Inicio / Fin       Localizar hasta el primer / último fotograma
//   ↑ / ↓              Último / Siguiente punto de corte
//   J / K / L          Rebobinar a varias velocidades / Detener búsqueda rápida /
//                      Búsqueda rápida a la derecha
//   Ctrl+Shift+F / Esc Pantalla completa / Salir de pantalla completa
//   Alt+Shift+= / - / Z  Acercar / Alejar / Hacer zoom para ajustar el reproductor
//   Ctrl+; / Ctrl+Alt+R  Mostrar/ocultar guías / reglas
//   mantener Ctrl      ignorar las guías de alineación (hooks/use-ignorar-guias.ts)
//
// Convivencia con actions/ (paquete D, el sistema de atajos configurable del
// motor): ese escucha en `document` en fase de CAPTURA y hace `preventDefault`
// cuando la tecla tiene una acción atada. Este escucha en `window` en fase de
// BURBUJA, o sea DESPUÉS, y no toca una tecla que ya se usó
// (`event.defaultPrevented`). Resultado: si actions/ ata una tecla, gana
// actions/ (y el usuario la puede reasignar en «Atajos»); si no la ata, la
// atiende el reproductor. Así no hay doble disparo aunque los dos cubran lo
// mismo, y el reproductor funciona entero aunque actions/ no tenga todavía
// las acciones de CapCut.
//
// Teclas por `event.code` (posición física), como CapCut: en un teclado latino
// el `;` está en la Ñ y el `=` en el ¿¡, y escuchando `event.key` el atajo no
// existiría (docs/diseno-editor-video.md §3.5).

import { useEffect } from "react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useCommittedRef } from "@/app/video-editor/_opencut/hooks/use-committed-ref";
import { useKeybindingsStore } from "@/app/video-editor/_opencut/actions/keybindings-store";
import { isTypableDOMElement } from "@/app/video-editor/_opencut/utils/browser";
import { isAppleDevice } from "@/app/video-editor/_opencut/utils/platform";
import { usePreviewStore } from "@/app/video-editor/_opencut/preview/preview-store";
import {
	alternarReproduccion,
	busquedaRapida,
	detenerBusqueda,
	irAlBorde,
	irAPuntoDeCorte,
	moverCuadros,
} from "@/app/video-editor/_opencut/preview/navegacion";
import {
	pantallaCompletaActiva,
	type PantallaCompleta,
} from "@/app/video-editor/_opencut/preview/hooks/use-pantalla-completa";

/** Cómo se muestran los atajos en los menús y tooltips (como CapCut los escribe). */
export const ATAJOS_REPRODUCTOR = {
	pantallaCompleta: "Ctrl+Shift+F",
	acercar: "Alt+Shift+=",
	alejar: "Alt+Shift+-",
	ajustar: "Alt+Shift+Z",
	guias: "Ctrl+;",
	reglas: "Ctrl+Alt+R",
} as const;

type Zoom = { zoomIn: () => void; zoomOut: () => void; fitToScreen: () => void };

export function useAtajosReproductor({
	zoom,
	pantalla,
}: {
	zoom: Zoom;
	pantalla: PantallaCompleta;
}) {
	const editor = useEditor();
	// Por ref: el viewport cambia en cada zoom y re-suscribir el listener en
	// cada cuadro de un pellizco no tiene sentido.
	const zoomRef = useCommittedRef(zoom);
	const pantallaRef = useCommittedRef(pantalla);

	useEffect(() => {
		const zoom = {
			zoomIn: () => zoomRef.current.zoomIn(),
			zoomOut: () => zoomRef.current.zoomOut(),
			fitToScreen: () => zoomRef.current.fitToScreen(),
		};
		const pantalla = {
			alternar: () => pantallaRef.current.alternar(),
			salir: () => pantallaRef.current.salir(),
		};
		const alPresionar = (ev: KeyboardEvent) => {
			// Con un menú o diálogo abierto, las teclas son de él (Esc lo cierra).
			const atajos = useKeybindingsStore.getState();
			if (atajos.overlayDepth > 0 || atajos.isRecording || atajos.isLoadingProject) {
				return;
			}
			// Esc sale de la pantalla completa aunque otra cosa haya usado la tecla
			// (actions/ la ata a «cancelar interacción»): salir es lo esperable.
			if (ev.code === "Escape" && pantallaCompletaActiva()) {
				pantalla.salir();
				return;
			}
			if (ev.defaultPrevented) return;

			const activo = document.activeElement;
			if (activo instanceof HTMLElement && isTypableDOMElement({ element: activo })) {
				return;
			}
			// Un control que se maneja con flechas (deslizador, pestañas, lista)
			// se queda con ellas: si no, mover un deslizador movería el cabezal.
			const usaFlechas =
				activo instanceof HTMLElement &&
				activo.closest(
					'[role="slider"],[role="spinbutton"],[role="listbox"],[role="tablist"],[role="radiogroup"],[role="menu"],[role="tree"],select',
				) !== null;

			const ctrl = isAppleDevice() ? ev.metaKey : ev.ctrlKey;
			const { altKey: alt, shiftKey: shift, code } = ev;
			const sinModificadores = !ctrl && !alt && !shift;

			const hecho = (accion: () => void, { repetible = false } = {}) => {
				ev.preventDefault();
				if (ev.repeat && !repetible) return;
				accion();
			};

			// ── Con modificadores ──────────────────────────────────────────────
			if (ctrl && shift && !alt && code === "KeyF") {
				return hecho(pantalla.alternar);
			}
			if (alt && shift && !ctrl) {
				if (code === "Equal" || code === "NumpadAdd") {
					return hecho(zoom.zoomIn, { repetible: true });
				}
				if (code === "Minus" || code === "NumpadSubtract") {
					return hecho(zoom.zoomOut, { repetible: true });
				}
				if (code === "KeyZ") return hecho(zoom.fitToScreen);
			}
			if (ctrl && !alt && !shift && code === "Semicolon") {
				return hecho(() => usePreviewStore.getState().alternarGuias());
			}
			if (ctrl && alt && !shift && code === "KeyR") {
				return hecho(() => usePreviewStore.getState().alternarReglas());
			}
			if (shift && !ctrl && !alt && !usaFlechas) {
				if (code === "ArrowLeft") {
					return hecho(() => moverCuadros(editor, -10), { repetible: true });
				}
				if (code === "ArrowRight") {
					return hecho(() => moverCuadros(editor, 10), { repetible: true });
				}
			}
			if (!sinModificadores) return;
			if (usaFlechas && /^(Arrow|Home$|End$)/.test(code)) return;

			// ── Sin modificadores ─────────────────────────────────────────────
			switch (code) {
				case "Space":
					return hecho(() => alternarReproduccion(editor));
				case "ArrowLeft":
					return hecho(() => moverCuadros(editor, -1), { repetible: true });
				case "ArrowRight":
					return hecho(() => moverCuadros(editor, 1), { repetible: true });
				case "ArrowUp":
					return hecho(() => irAPuntoDeCorte(editor, -1), { repetible: true });
				case "ArrowDown":
					return hecho(() => irAPuntoDeCorte(editor, 1), { repetible: true });
				case "Home":
					return hecho(() => irAlBorde(editor, "inicio"));
				case "End":
					return hecho(() => irAlBorde(editor, "fin"));
				case "KeyJ":
					return hecho(() => busquedaRapida(editor, -1));
				case "KeyK":
					return hecho(() => detenerBusqueda(editor));
				case "KeyL":
					return hecho(() => busquedaRapida(editor, 1));
			}
		};

		window.addEventListener("keydown", alPresionar);
		return () => window.removeEventListener("keydown", alPresionar);
	}, [editor, zoomRef, pantallaRef]);
}
