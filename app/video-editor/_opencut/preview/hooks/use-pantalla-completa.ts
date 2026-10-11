import { useCallback, useEffect } from "react";
import { create } from "zustand";

// =============================================================================
// «Pantalla completa» del reproductor (Ctrl+Shift+F; Esc sale)
// =============================================================================
// OpenCut ponía en pantalla completa el PANEL del reproductor con la API del
// navegador. Eso deja afuera a `#ce-portal`, donde se montan TODOS los menús y
// diálogos del editor (portal.ts): en pantalla completa sólo se dibuja el
// elemento elegido y sus hijos, así que los menús de «Relación», resolución y
// zoom se abrirían invisibles.
//
// Por eso va en dos capas: el panel se agranda con CSS a toda la raíz `.ce`
// (fixed, encima del resto del editor) y la raíz `.ce` —que contiene el portal—
// es la que pasa a pantalla completa del navegador. Si el navegador la niega
// (un iframe sin permiso), queda la capa CSS y Esc la cierra igual.
//
// El estado vive en un store chico para que los atajos lo lean sin React. El
// hook se llama UNA vez (PreviewPanel) y el resultado se pasa para abajo: al
// desmontarse sale de la pantalla completa, y dos llamadas saldrían dos veces.

const usePantallaStore = create<{ activa: boolean; set: (activa: boolean) => void }>(
	(set) => ({ activa: false, set: (activa) => set({ activa }) }),
);

function raizEditor(desde: Element | null): HTMLElement {
	return (desde?.closest(".ce") as HTMLElement | null) ?? document.documentElement;
}

export function usePantallaCompleta({
	panelRef,
}: {
	panelRef: React.RefObject<HTMLElement | null>;
}) {
	const activa = usePantallaStore((s) => s.activa);
	const fijar = usePantallaStore((s) => s.set);

	useEffect(() => {
		// Salir con Esc (o con el botón del navegador) apaga también la capa CSS.
		const alCambiar = () => {
			if (!document.fullscreenElement) fijar(false);
		};
		document.addEventListener("fullscreenchange", alCambiar);
		return () => document.removeEventListener("fullscreenchange", alCambiar);
	}, [fijar]);

	// Al desmontar el editor no puede quedar la ventana en pantalla completa.
	useEffect(
		() => () => {
			fijar(false);
			if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		},
		[fijar],
	);

	const entrar = useCallback(() => {
		fijar(true);
		if (document.fullscreenElement) return;
		const raiz = raizEditor(panelRef.current);
		void raiz.requestFullscreen?.().catch(() => {
			// Sin permiso del navegador: queda la capa CSS, que alcanza.
		});
	}, [fijar, panelRef]);

	const salir = useCallback(() => {
		fijar(false);
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
	}, [fijar]);

	const alternar = useCallback(() => {
		if (usePantallaStore.getState().activa) salir();
		else entrar();
	}, [entrar, salir]);

	return { activa, entrar, salir, alternar };
}

export type PantallaCompleta = ReturnType<typeof usePantallaCompleta>;

/** Para leer el estado sin suscribirse (atajos). */
export function pantallaCompletaActiva(): boolean {
	return usePantallaStore.getState().activa;
}
