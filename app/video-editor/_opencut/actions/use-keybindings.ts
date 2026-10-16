import { useEffect } from "react";
import { invokeAction } from "@/app/video-editor/_opencut/actions";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useKeybindingsStore } from "@/app/video-editor/_opencut/actions/keybindings-store";
import { isTypableDOMElement } from "@/app/video-editor/_opencut/utils/browser";

/**
 * a composable that hooks to the caller component's
 * lifecycle and hooks to the keyboard events to fire
 * the appropriate actions based on keybindings
 */
export function useKeybindingsListener() {
	const editor = useEditor();
	const {
		keybindings,
		getKeybindingString,
		overlayDepth,
		isLoadingProject,
		isRecording,
	} = useKeybindingsStore();

	useEffect(() => {
		const eventOptions: AddEventListenerOptions = { capture: true };
		const handleKeyDown = (ev: KeyboardEvent) => {
			const normalizedKey = (ev.key ?? "").toLowerCase();

			if (overlayDepth > 0 || isLoadingProject || isRecording) {
				return;
			}

			const binding = getKeybindingString(ev);
			const activeElement = document.activeElement;
			const isTextInput =
				activeElement instanceof HTMLElement &&
				isTypableDOMElement({ element: activeElement });
			const boundAction = binding ? keybindings.get(binding) : undefined;

			if (normalizedKey === "escape" && isTextInput) {
				activeElement.blur();
				return;
			}

			if (!binding) return;
			if (!boundAction) return;

			if (isTextInput) return;
			// Un panel que se adueña de una tecla lo declara con `data-teclas-propias` («delete
			// backspace»): con el foco adentro, esa tecla es del panel. La «Transcripción» lo
			// necesita: su Supr borra las palabras elegidas, y sin esto el Supr global borraba
			// además el CLIP elegido de la línea de tiempo (medido en producción el 15/10).
			const propias = activeElement instanceof Element ? activeElement.closest("[data-teclas-propias]") : null;
			if (propias && (propias.getAttribute("data-teclas-propias") ?? "").split(/\s+/).includes(normalizedKey)) return;
			if (boundAction === "paste-copied") {
				if (!editor.clipboard.hasEntry()) return;
				ev.preventDefault();
				invokeAction("paste-copied", undefined, "keypress");
				return;
			}

			ev.preventDefault();

			switch (boundAction) {
				case "seek-forward":
					invokeAction("seek-forward", { seconds: 1 }, "keypress");
					break;
				case "seek-backward":
					invokeAction("seek-backward", { seconds: 1 }, "keypress");
					break;
				// Shift+←/→ = «Avanzar/Retroceder muchos fotogramas»: 10 cuadros
				// (timelineLargeAdjustRange de CapCut), lo resuelve el handler.
				default:
					invokeAction(boundAction, undefined, "keypress");
			}
		};

		document.addEventListener("keydown", handleKeyDown, eventOptions);

		return () => {
			document.removeEventListener("keydown", handleKeyDown, eventOptions);
		};
	}, [
		keybindings,
		getKeybindingString,
		overlayDepth,
		isLoadingProject,
		isRecording,
		editor,
	]);
}
