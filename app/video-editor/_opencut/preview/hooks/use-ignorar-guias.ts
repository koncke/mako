import { useEffect, useRef, type RefObject } from "react";

// =============================================================================
// «Mantener Ctrl» ignora las guías de alineación, como en CapCut
// =============================================================================
// OpenCut apagaba el imán del reproductor con Shift; en CapCut es Ctrl (en el
// panel de atajos: «Cancelar la alineación del reproductor», mantener Ctrl). En
// Mac va Cmd, que es el Ctrl del resto del motor (actions/keybinding.ts).
//
// Se lee de cada movimiento del puntero además del teclado: si la ventana
// pierde el foco con Ctrl apretado, el keyup no llega nunca y el imán quedaría
// apagado para siempre; el `ctrlKey` del pointermove dice la verdad en cada
// cuadro del arrastre.

export function useIgnorarGuias(): RefObject<boolean> {
	const ignorarRef = useRef(false);

	useEffect(() => {
		const actualizar = (event: KeyboardEvent | PointerEvent) => {
			ignorarRef.current = event.ctrlKey || event.metaKey;
		};
		const soltar = () => {
			ignorarRef.current = false;
		};

		document.addEventListener("keydown", actualizar);
		document.addEventListener("keyup", actualizar);
		// En captura: los tiradores frenan la propagación del puntero.
		document.addEventListener("pointermove", actualizar, { capture: true });
		window.addEventListener("blur", soltar);

		return () => {
			document.removeEventListener("keydown", actualizar);
			document.removeEventListener("keyup", actualizar);
			document.removeEventListener("pointermove", actualizar, { capture: true });
			window.removeEventListener("blur", soltar);
		};
	}, []);

	return ignorarRef;
}
