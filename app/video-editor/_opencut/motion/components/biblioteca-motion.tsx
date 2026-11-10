"use client";

// =============================================================================
// Biblioteca › Plantillas › Motion: los motion graphics de lib/motion, listos para sumar a la línea de tiempo
// =============================================================================
// La tarjeta es la de «Anuncios» (./../plantillas/components/biblioteca-plantillas.tsx): la miniatura quieta en su
// cuadro final y, con el mouse encima, la animación de verdad (el mismo `dibujarEscena` que el reproductor). Un clic
// agrega el motion graphic en el cabezal, en su pista, del tamaño del cuadro y con la duración de la plantilla; después
// se edita en el panel de la derecha (los campos de la plantilla) o pidiéndoselo a MaKo en el chat.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	ContenidoBiblioteca,
	GrillaBiblioteca,
	formatearDuracion,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { buildGraphicElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import { mediaTimeFromSeconds } from "@/app/video-editor/_opencut/wasm/media-time";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { armarEscena } from "@/lib/motion/escena";
import { dibujarEscena } from "@/lib/motion/canvas";
import { cargarFuentesMotion, familiasDe } from "@/lib/motion/fuentes";
import { PLANTILLAS, valoresPorDefecto } from "@/lib/motion/plantillas";
import { PLANTILLAS_MOTION, type IdPlantilla } from "@/lib/motion/tipos";
import { idDefinicionMotion } from "@/app/video-editor/_opencut/graphics/definitions/motion";

/** La miniatura: el cuadro final quieto; con `animar`, la coreografía entera en bucle (con un respiro al final). */
function MiniaturaMotion({ plantilla, aspecto, animar }: { plantilla: IdPlantilla; aspecto: number; animar: boolean }) {
	const ref = useRef<HTMLCanvasElement>(null);
	const escena = useMemo(
		() => armarEscena({ plantilla, valores: valoresPorDefecto(plantilla) }, { aspecto, video: true, durMs: PLANTILLAS[plantilla].duracionMs }),
		[plantilla, aspecto],
	);
	const [fuentes, setFuentes] = useState(0);
	useEffect(() => {
		let vivo = true;
		void cargarFuentesMotion(familiasDe(escena)).then(() => vivo && setFuentes((n) => n + 1));
		return () => { vivo = false; };
	}, [escena]);
	useEffect(() => {
		const canvas = ref.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const W = Math.round(canvas.clientWidth * dpr) || 160;
		const H = Math.round(W / aspecto);
		canvas.width = W;
		canvas.height = H;
		// Quieta: el momento en que todo entró (antes de la salida del clip). Con «menos movimiento» del sistema, siempre
		// quieta (como las miniaturas de las plantillas y de las transiciones).
		const quieto = Math.max(0, escena.durMs - 900);
		const menosMovimiento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		if (!animar || menosMovimiento) {
			dibujarEscena(ctx, escena, quieto, W, H);
			return;
		}
		const inicio = performance.now();
		let raf = 0;
		const cuadro = (ahora: number) => {
			const t = (ahora - inicio) % (escena.durMs + 400);
			dibujarEscena(ctx, escena, Math.min(t, escena.durMs), W, H);
			raf = requestAnimationFrame(cuadro);
		};
		raf = requestAnimationFrame(cuadro);
		return () => cancelAnimationFrame(raf);
	}, [escena, animar, aspecto, fuentes]);
	return <canvas ref={ref} className="block size-full" aria-hidden="true" />;
}

function TarjetaMotion({ plantilla, aspecto, ocupada, onUsar }: { plantilla: IdPlantilla; aspecto: number; ocupada: boolean; onUsar: () => void }) {
	const [encima, setEncima] = useState(false);
	const def = PLANTILLAS[plantilla];
	return (
		<div
			className="group flex min-w-0 flex-col gap-1"
			onPointerEnter={() => setEncima(true)}
			onPointerLeave={() => setEncima(false)}
		>
			<button
				type="button"
				title={def.para}
				disabled={ocupada}
				onClick={onUsar}
				onFocus={() => setEncima(true)}
				onBlur={() => setEncima(false)}
				aria-label={`Agregar ${def.nombre}`}
				className={cn(
					"relative w-full cursor-pointer overflow-hidden rounded-[6px] bg-[#0e1116] ring-1 ring-transparent transition-shadow",
					"hover:ring-(--cc-text-3)/60 focus-visible:ring-primary disabled:cursor-default",
				)}
				style={{ aspectRatio: String(aspecto) }}
			>
				<MiniaturaMotion plantilla={plantilla} aspecto={aspecto} animar={encima} />
				<span className="pointer-events-none absolute top-1 right-1 rounded-[3px] bg-black/60 px-1 text-[10px] leading-4 text-white tabular-nums">
					{formatearDuracion(def.duracionMs / 1000)}
				</span>
			</button>
			<span className="w-full truncate text-[11px] leading-4 text-(--cc-text-2)" title={def.nombre}>
				{def.nombre}
			</span>
		</div>
	);
}

export function BibliotecaMotion() {
	const editor = useEditor();
	const proyecto = useEditor((e) => e.project.getActive());
	const tamano = proyecto?.settings.canvasSize;
	const aspecto = tamano && tamano.width > 0 && tamano.height > 0 ? tamano.width / tamano.height : 16 / 9;
	const [ocupada, setOcupada] = useState(false);

	const usar = (plantilla: IdPlantilla) => {
		if (ocupada) return;
		setOcupada(true);
		try {
			const def = PLANTILLAS[plantilla];
			const element = buildGraphicElement({
				definitionId: idDefinicionMotion(plantilla),
				name: `Motion · ${def.nombre}`,
				startTime: editor.playback.getCurrentTime(),
				params: valoresPorDefecto(plantilla),
			});
			element.duration = mediaTimeFromSeconds({ seconds: def.duracionMs / 1000 });
			editor.timeline.insertElement({ placement: { mode: "auto" }, element });
		} catch (error) {
			console.error("[motion] no se pudo agregar", error);
			toast.error("No se pudo agregar el motion graphic. Vuelve a intentarlo.");
		} finally {
			setOcupada(false);
		}
	};

	return (
		<ContenidoBiblioteca>
			<GrillaBiblioteca minimo={aspecto < 0.8 ? 92 : 128}>
				{PLANTILLAS_MOTION.map((p) => (
					<TarjetaMotion key={p} plantilla={p} aspecto={aspecto} ocupada={ocupada} onUsar={() => usar(p)} />
				))}
			</GrillaBiblioteca>
		</ContenidoBiblioteca>
	);
}
