"use client";

// =============================================================================
// La fila de pestañas de la biblioteca (arriba del panel izquierdo)
// =============================================================================
// Como CapCut Desktop 9.3: ícono arriba, rótulo abajo, franja de 62 px a 125 %
// (≈50 px al 100 %) en `--cc-panel-head`, la activa en cian. Cuando no entran,
// aparecen flechas ‹ › en los extremos que corren la fila (CapCut no muestra barra
// de desplazamiento ahí: las flechas son la pista de que hay más pestañas, que es
// lo que pide la regla de AGENTS.md «Una barra de navegación NO lleva scroll
// horizontal»: que ningún destino quede escondido sin aviso).
// ⚠️ El rótulo ENTERO, nunca con «…» (29/10/2026, Martín: «Transicio…», «Multimed…»). Cada
// pestaña medía 58 px fijos y a 11 px «Transiciones» pide ~66: se cortaba a CUALQUIER ancho
// de pantalla. Ahora mide 58 como mínimo y crece con su rótulo; lo que no entra lo corren ‹ ›.

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
	ArrowLeft01Icon,
	ArrowRight01Icon,
	BlendIcon,
	BowTieIcon,
	ClosedCaptionIcon,
	DashboardSquare01Icon,
	MusicNote03Icon,
	SlidersHorizontalIcon,
	SmileIcon,
	SparklesIcon,
	TextIcon,
	UserSquareIcon,
	Video01Icon,
} from "@hugeicons/core-free-icons";
import type { CategoriaBiblioteca } from "@/app/video-editor/ce/ranuras";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import {
	CATEGORIAS_BIBLIOTECA,
	useAssetsPanelStore,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import { useModoSimple } from "@/app/video-editor/guia/modo-simple";
import { pestanasVisibles } from "@/app/video-editor/guia/modo-simple-reglas";

const icono =
	(svg: IconSvgElement): ComponentType<{ className?: string }> =>
	({ className }) => <HugeiconsIcon icon={svg} className={className} strokeWidth={1.6} />;

/** Rótulos del es-LA.po de CapCut 9.3 (`pc_media`, `audio`, `pc_materiallib_*`…). */
export const PESTANAS_BIBLIOTECA: Record<
	CategoriaBiblioteca,
	{ etiqueta: string; Icono: ComponentType<{ className?: string }> }
> = {
	multimedia: { etiqueta: "Multimedia", Icono: icono(Video01Icon) },
	audio: { etiqueta: "Audio", Icono: icono(MusicNote03Icon) },
	texto: { etiqueta: "Texto", Icono: icono(TextIcon) },
	stickers: { etiqueta: "Stickers", Icono: icono(SmileIcon) },
	efectos: { etiqueta: "Efectos", Icono: icono(SparklesIcon) },
	transiciones: { etiqueta: "Transiciones", Icono: icono(BowTieIcon) },
	subtitulos: { etiqueta: "Subtítulos", Icono: icono(ClosedCaptionIcon) },
	filtros: { etiqueta: "Filtros", Icono: icono(BlendIcon) },
	ajuste: { etiqueta: "Ajuste", Icono: icono(SlidersHorizontalIcon) },
	// `template_pc`: las plantillas de anuncio propias (plantillas/registro.ts).
	plantillas: { etiqueta: "Plantillas", Icono: icono(DashboardSquare01Icon) },
	// `pc_avatar_image` (CapCut 9.6): la pestaña que genera con el Video Generator.
	avatar: { etiqueta: "Avatar de IA", Icono: icono(UserSquareIcon) },
};

/** Cuánto corre la fila cada clic en ‹ ›: dos pestañas. */
const PASO_FLECHA = 116;

/**
 * El borde donde hay más pestañas se FUNDE (29/10/2026): la que queda a medias contra la flecha se leía como una palabra
 * cortada («Efec», «Trans»). Fundida, se lee como «hay más», igual que la flecha.
 */
export function fundidoDeLaFila(izquierda: boolean, derecha: boolean): string | undefined {
	if (!izquierda && !derecha) return undefined;
	const desde = izquierda ? "transparent 0, #000 28px" : "#000 0";
	const hasta = derecha ? "#000 calc(100% - 28px), transparent 100%" : "#000 100%";
	return `linear-gradient(to right, ${desde}, ${hasta})`;
}

export function TabBar() {
	const activeTab = useAssetsPanelStore((s) => s.activeTab);
	const setActiveTab = useAssetsPanelStore((s) => s.setActiveTab);
	const simple = useModoSimple();
	const filaRef = useRef<HTMLDivElement>(null);
	const [hayIzquierda, setHayIzquierda] = useState(false);
	const [hayDerecha, setHayDerecha] = useState(false);

	const medir = useCallback(() => {
		const fila = filaRef.current;
		if (!fila) return;
		setHayIzquierda(fila.scrollLeft > 0);
		setHayDerecha(fila.scrollLeft < fila.scrollWidth - fila.clientWidth - 1);
	}, []);

	useEffect(() => {
		const fila = filaRef.current;
		if (!fila) return;
		medir();
		fila.addEventListener("scroll", medir, { passive: true });
		const observador = new ResizeObserver(medir);
		observador.observe(fila);
		return () => {
			fila.removeEventListener("scroll", medir);
			observador.disconnect();
		};
	}, [medir]);

	// La pestaña elegida desde otro panel (p. ej. «Agregar efecto») tiene que verse.
	// A mano y no con scrollIntoView: ése también corre los ancestros con
	// overflow oculto, y movería el armado del editor.
	useEffect(() => {
		const fila = filaRef.current;
		const boton = fila?.querySelector<HTMLElement>(`[data-pestana="${activeTab}"]`);
		if (!fila || !boton) return;
		const izquierda = boton.offsetLeft;
		const derecha = izquierda + boton.offsetWidth;
		if (izquierda < fila.scrollLeft) fila.scrollLeft = izquierda;
		else if (derecha > fila.scrollLeft + fila.clientWidth) {
			fila.scrollLeft = derecha - fila.clientWidth;
		}
	}, [activeTab]);

	const correr = (sentido: -1 | 1) => {
		filaRef.current?.scrollBy({ left: sentido * PASO_FLECHA, behavior: "smooth" });
	};

	return (
		<div className="relative flex h-[50px] shrink-0 items-stretch bg-[var(--cc-panel-head)]">
			{hayIzquierda && <Flecha lado="izquierda" onClick={() => correr(-1)} />}
			<div
				ref={filaRef}
				role="tablist"
				aria-label="Biblioteca"
				// `relative`: el offsetLeft de cada pestaña se mide contra la fila.
				className="relative flex min-w-0 flex-1 items-stretch overflow-hidden px-1"
				style={{
					maskImage: fundidoDeLaFila(hayIzquierda, hayDerecha),
					WebkitMaskImage: fundidoDeLaFila(hayIzquierda, hayDerecha),
				}}
				onWheel={(event) => {
					// La rueda vertical corre la fila, como en CapCut.
					if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
						filaRef.current?.scrollBy({ left: event.deltaY });
					}
				}}
			>
				{/* El modo simple de una plantilla guiada (app/video-editor/guia/modo-simple.ts): las pestañas de su lista y la abierta. */}
				{pestanasVisibles(CATEGORIAS_BIBLIOTECA, simple, activeTab).map((categoria) => {
					const { etiqueta, Icono } = PESTANAS_BIBLIOTECA[categoria];
					const activa = categoria === activeTab;
					return (
						<button
							key={categoria}
							type="button"
							role="tab"
							aria-selected={activa}
							data-pestana={categoria}
							onClick={() => setActiveTab(categoria)}
							className={cn(
								"flex min-w-[58px] shrink-0 cursor-pointer flex-col items-center justify-center gap-[3px] px-1.5 outline-none",
								"focus-visible:ring-1 focus-visible:ring-primary rounded-[4px]",
								activa
									? "text-primary"
									: "text-[var(--cc-text-2)] hover:text-[var(--cc-text)]",
							)}
						>
							<Icono className="size-[18px]" />
							<span className="whitespace-nowrap text-[11px] leading-none">
								{etiqueta}
							</span>
						</button>
					);
				})}
			</div>
			{hayDerecha && <Flecha lado="derecha" onClick={() => correr(1)} />}
		</div>
	);
}

function Flecha({
	lado,
	onClick,
}: {
	lado: "izquierda" | "derecha";
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			// Sin rótulo en CapCut: el lector de pantalla necesita uno.
			aria-label={lado === "izquierda" ? "Anterior" : "Siguiente"}
			onClick={onClick}
			className={cn(
				"z-10 flex w-5 shrink-0 cursor-pointer items-center justify-center text-[var(--cc-text-2)] hover:text-[var(--cc-text)]",
				"bg-[var(--cc-panel-head)]",
			)}
		>
			<HugeiconsIcon
				icon={lado === "izquierda" ? ArrowLeft01Icon : ArrowRight01Icon}
				className="size-3.5"
			/>
		</button>
	);
}
