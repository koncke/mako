"use client";

// =============================================================================
// Arrastrar una guía: sacarla de la regla, moverla, o devolverla para borrarla
// =============================================================================
// Como en cualquier programa con reglas (y en CapCut): se arrastra desde la
// regla de arriba para una guía HORIZONTAL y desde la de la izquierda para una
// VERTICAL; una guía se mueve agarrándola, y soltarla fuera del reproductor (de
// vuelta sobre la regla) la borra. Al soltar una nueva fuera, no se crea.
//
// El arrastre escucha en `window` y no en el elemento: la regla y la guía son
// tiras de pocos píxeles y el puntero sale de ellas en el primer movimiento.
// Cerca del centro y de los bordes del lienzo la guía se pega (6 px de
// pantalla); con Ctrl apretado, no (como el resto de las guías de alineación).

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useCommittedRef } from "@/app/video-editor/_opencut/hooks/use-committed-ref";
import { isAppleDevice } from "@/app/video-editor/_opencut/utils/platform";
import { usePreviewStore, type GuiaUsuario } from "@/app/video-editor/_opencut/preview/preview-store";
import type { TCanvasSize } from "@/app/video-editor/_opencut/project/types";
import { largoDelEje } from "./guias-usuario";

export type ArrastreGuia = {
	eje: GuiaUsuario["eje"];
	/** `null` = una guía nueva que todavía no existe en el store. */
	id: string | null;
	fraccion: number;
	/** El puntero está fuera del reproductor: al soltar, se borra (o no se crea). */
	fuera: boolean;
};

const IMAN_PX = 6;

type Geometria = {
	screenToCanvas: (p: { clientX: number; clientY: number }) => { x: number; y: number } | null;
	getDisplayScale: () => { x: number; y: number };
};

export function useArrastreGuia({
	geometria,
	viewportRef,
	proyecto,
	lienzo,
}: {
	geometria: Geometria;
	viewportRef: React.RefObject<HTMLElement | null>;
	proyecto: string;
	lienzo: TCanvasSize;
}) {
	const [arrastre, setArrastre] = useState<ArrastreGuia | null>(null);
	const ctx = useCommittedRef({ geometria, proyecto, lienzo });

	const empezar = useCallback(
		({
			eje,
			id,
			event,
		}: {
			eje: GuiaUsuario["eje"];
			id: string | null;
			event: React.PointerEvent;
		}) => {
			if (event.button !== 0) return;
			event.preventDefault();
			event.stopPropagation();

			type Puntero = { clientX: number; clientY: number; ctrlKey: boolean; metaKey: boolean };
			const calcular = (ev: Puntero) => {
				const { geometria, lienzo } = ctx.current;
				const rect = viewportRef.current?.getBoundingClientRect();
				const punto = geometria.screenToCanvas({ clientX: ev.clientX, clientY: ev.clientY });
				const fuera =
					!rect ||
					ev.clientX < rect.left ||
					ev.clientX > rect.right ||
					ev.clientY < rect.top ||
					ev.clientY > rect.bottom;
				const largo = largoDelEje(eje, lienzo);
				let fraccion = punto ? (eje === "horizontal" ? punto.y : punto.x) / largo : 0;
				const ignorarIman = isAppleDevice() ? ev.metaKey : ev.ctrlKey;
				if (!ignorarIman) {
					const escala = geometria.getDisplayScale().x;
					const pegada = [0, 0.5, 1].find(
						(f) => Math.abs(f - fraccion) * largo * escala <= IMAN_PX,
					);
					if (pegada !== undefined) fraccion = pegada;
				}
				return { fraccion, fuera };
			};

			const mover = (ev: PointerEvent) => {
				const { fraccion, fuera } = calcular(ev);
				setArrastre({ eje, id, fraccion, fuera });
				if (id && !fuera) {
					usePreviewStore.getState().moverGuia({ proyecto: ctx.current.proyecto, id, fraccion });
				}
			};

			const terminar = (ev: PointerEvent) => {
				window.removeEventListener("pointermove", mover);
				window.removeEventListener("pointerup", terminar);
				window.removeEventListener("pointercancel", cancelar);
				const { fraccion, fuera } = calcular(ev);
				const store = usePreviewStore.getState();
				const { proyecto } = ctx.current;
				if (id) {
					if (fuera) store.borrarGuia({ proyecto, id });
					else store.moverGuia({ proyecto, id, fraccion });
				} else if (!fuera) {
					if (store.agregarGuia({ proyecto, eje, fraccion }) === null) {
						toast("Número máximo de guías alcanzado");
					}
				}
				setArrastre(null);
			};

			const cancelar = () => {
				window.removeEventListener("pointermove", mover);
				window.removeEventListener("pointerup", terminar);
				window.removeEventListener("pointercancel", cancelar);
				setArrastre(null);
			};

			window.addEventListener("pointermove", mover);
			window.addEventListener("pointerup", terminar);
			window.addEventListener("pointercancel", cancelar);
			const inicial = calcular(event);
			setArrastre({ eje, id, ...inicial });
		},
		[ctx, viewportRef],
	);

	return { arrastre, empezar };
}
