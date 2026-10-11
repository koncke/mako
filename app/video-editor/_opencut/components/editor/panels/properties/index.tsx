"use client";

// =============================================================================
// El panel derecho (Propiedades) — la CÁSCARA
// =============================================================================
// Como en CapCut Desktop: arriba la fila de pestañas (~50 px, #303030, la activa
// en cian, ‹ › si no entran); debajo, si la pestaña tiene sub-pestañas, el
// control segmentado (#1c1c1c); y el contenido con scroll.
//
// La cáscara NO sabe qué pestañas hay: dibuja las que estén registradas en
// ce/ranuras.ts (`pestanasInspector` / `subpestanasInspector`) y apliquen al
// elemento elegido. Cada paquete registra las suyas desde su archivo (ver
// docs/diseno-editor-video.md §4.1); las de este paquete están en ./registry.tsx.
//
// Sin nada elegido muestra «Detalles» (./detalles.tsx); con varios, la frase de
// CapCut.
//
// Una pestaña ajena que tira una excepción no puede voltear el panel entero (y
// con él la edición): cada contenido va dentro de una barrera que lo reemplaza
// por un aviso corto y deja el error en la consola con el id de la pestaña.

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TooltipProvider } from "@/app/video-editor/_opencut/components/ui/tooltip";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { useElementSelection } from "@/app/video-editor/_opencut/timeline/hooks/element/use-element-selection";
import {
	pestanasInspector,
	subpestanasInspector,
	type ContextoInspector,
	type PestanaInspector,
	type SubpestanaInspector,
} from "@/app/video-editor/ce/ranuras";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { usePropertiesStore } from "./stores/properties-store";
import { SegmentadoCe } from "./components/kit";
import { sinRespaldosCubiertos } from "./respaldo";
import { Detalles } from "./detalles";
// Los registros de este paquete. También los importa ce/extensiones.ts; acá va
// por las dudas: el panel sin sus pestañas propias no tiene sentido.
import "./registry";

export function PropertiesPanel() {
	const editor = useEditor();
	useEditor((e) => e.scenes.getActiveSceneOrNull());
	useEditor((e) => e.media.getAssets());
	const { selectedElements } = useElementSelection();

	let cuerpo: ReactNode;
	if (selectedElements.length === 0) {
		cuerpo = <Detalles />;
	} else if (selectedElements.length > 1) {
		cuerpo = (
			<div className="flex h-full items-center justify-center p-4">
				<p className="text-[13px] text-(--cc-text-2)">
					{selectedElements.length} elementos seleccionados
				</p>
			</div>
		);
	} else {
		const [conPista] = editor.timeline.getElementsWithTracks({
			elements: selectedElements,
		});
		cuerpo = conPista ? (
			<Inspector
				ctx={{
					element: conPista.element,
					track: conPista.track,
					mediaAssets: editor.media.getAssets(),
				}}
			/>
		) : (
			<Detalles />
		);
	}

	return (
		<TooltipProvider delayDuration={400}>
			<div className="panel bg-background flex h-full flex-col overflow-hidden rounded-[7px]">
				{cuerpo}
			</div>
		</TooltipProvider>
	);
}

// ── Las pestañas del elemento elegido ────────────────────────────────────────

type PestanaVisible = { pestana: PestanaInspector; subs: SubpestanaInspector[] };

function aplicaSeguro(
	item: { id: string; aplica: (ctx: ContextoInspector) => boolean },
	ctx: ContextoInspector,
): boolean {
	try {
		return item.aplica(ctx);
	} catch (error) {
		console.error(`[panel derecho] «${item.id}».aplica falló`, error);
		return false;
	}
}

function pestanasVisibles(ctx: ContextoInspector): PestanaVisible[] {
	const aplicables = sinRespaldosCubiertos(
		pestanasInspector.filtrar((p) => aplicaSeguro(p, ctx)),
	);
	return aplicables
		.map((pestana) => ({
			pestana,
			subs: subpestanasInspector.filtrar(
				(s) => s.pestana === pestana.id && aplicaSeguro(s, ctx),
			),
		}))
		.filter(({ pestana, subs }) => subs.length > 0 || pestana.Contenido);
}

function Inspector({ ctx }: { ctx: ContextoInspector }) {
	const tipo = ctx.element.type;
	const vista = usePropertiesStore((s) => s.activeTabPerType[tipo]);
	const memoria = usePropertiesStore((s) => s.subpestanaPorPestana);
	const setActiveTab = usePropertiesStore((s) => s.setActiveTab);
	const recordarSubpestana = usePropertiesStore((s) => s.recordarSubpestana);

	const lista = pestanasVisibles(ctx);
	if (lista.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-4 text-[13px] text-(--cc-text-3)">
				Sin ajustes para este elemento
			</div>
		);
	}

	const activa =
		lista.find((x) => x.subs.some((s) => s.id === vista)) ??
		lista.find((x) => x.pestana.id === vista) ??
		lista[0];
	const sub =
		activa.subs.find((s) => s.id === vista) ??
		activa.subs.find((s) => s.id === memoria[`${tipo}:${activa.pestana.id}`]) ??
		activa.subs[0];

	const elegirPestana = (x: PestanaVisible) => {
		const recordada = x.subs.find((s) => s.id === memoria[`${tipo}:${x.pestana.id}`]);
		const destino = recordada ?? x.subs[0];
		setActiveTab({ elementType: tipo, tabId: destino?.id ?? x.pestana.id });
	};
	const elegirSub = (id: string) => {
		setActiveTab({ elementType: tipo, tabId: id });
		recordarSubpestana({ elementType: tipo, pestana: activa.pestana.id, subpestana: id });
	};

	const Contenido = sub?.Contenido ?? activa.pestana.Contenido;
	const idContenido = sub ? `${activa.pestana.id}/${sub.id}` : activa.pestana.id;

	return (
		<>
			<FilaPestanas
				pestanas={lista.map((x) => ({ id: x.pestana.id, etiqueta: x.pestana.etiqueta }))}
				activa={activa.pestana.id}
				onElegir={(id) => {
					const x = lista.find((p) => p.pestana.id === id);
					if (x) elegirPestana(x);
				}}
			/>
			{activa.subs.length > 1 && sub && (
				<div className="shrink-0 px-4 pt-3 pb-1">
					<SegmentadoCe
						opciones={activa.subs.map((s) => ({ id: s.id, etiqueta: s.etiqueta }))}
						valor={sub.id}
						onCambio={elegirSub}
					/>
				</div>
			)}
			<div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
				{Contenido ? (
					<Barrera key={`${ctx.element.id}:${idContenido}`} id={idContenido}>
						<Contenido {...ctx} />
					</Barrera>
				) : null}
			</div>
		</>
	);
}

// ── La fila de pestañas, con ‹ › cuando no entran ────────────────────────────

function FilaPestanas({
	pestanas,
	activa,
	onElegir,
}: {
	pestanas: { id: string; etiqueta: string }[];
	activa: string;
	onElegir: (id: string) => void;
}) {
	const fila = useRef<HTMLDivElement>(null);
	const [desborde, setDesborde] = useState({ izquierda: false, derecha: false });

	useEffect(() => {
		const el = fila.current;
		if (!el) return;
		const medir = () =>
			setDesborde({
				izquierda: el.scrollLeft > 1,
				derecha: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
			});
		medir();
		const ro = new ResizeObserver(medir);
		ro.observe(el);
		el.addEventListener("scroll", medir, { passive: true });
		return () => {
			ro.disconnect();
			el.removeEventListener("scroll", medir);
		};
	}, [pestanas.length]);

	// La activa siempre a la vista (al elegir un clip de otro tipo, por ejemplo).
	useEffect(() => {
		fila.current
			?.querySelector<HTMLElement>(`[data-pestana="${CSS.escape(activa)}"]`)
			?.scrollIntoView({ block: "nearest", inline: "nearest" });
	}, [activa]);

	const correr = (dx: number) => fila.current?.scrollBy({ left: dx, behavior: "smooth" });

	return (
		<div className="relative flex h-[50px] shrink-0 items-stretch bg-(--cc-panel-head)">
			{desborde.izquierda && (
				<button
					type="button"
					aria-label="Anterior"
					onClick={() => correr(-120)}
					className="absolute inset-y-0 left-0 z-10 flex w-6 cursor-pointer items-center justify-center bg-(--cc-panel-head) text-(--cc-icon)"
				>
					<ChevronLeft className="size-4" />
				</button>
			)}
			<div
				ref={fila}
				role="tablist"
				className="flex min-w-0 flex-1 items-stretch overflow-x-hidden px-1.5"
			>
				{pestanas.map((p) => (
					<button
						key={p.id}
						type="button"
						role="tab"
						data-pestana={p.id}
						aria-selected={p.id === activa}
						onClick={() => onElegir(p.id)}
						className={cn(
							"shrink-0 cursor-pointer px-2.5 text-[13.5px] whitespace-nowrap transition-colors",
							p.id === activa
								? "text-primary"
								: "text-(--cc-text-2) hover:text-foreground",
						)}
					>
						{p.etiqueta}
					</button>
				))}
			</div>
			{desborde.derecha && (
				<button
					type="button"
					aria-label="Siguiente"
					onClick={() => correr(120)}
					className="absolute inset-y-0 right-0 z-10 flex w-6 cursor-pointer items-center justify-center bg-(--cc-panel-head) text-(--cc-icon)"
				>
					<ChevronRight className="size-4" />
				</button>
			)}
		</div>
	);
}

// ── Barrera: una pestaña rota no voltea el panel ─────────────────────────────

class Barrera extends Component<{ id: string; children: ReactNode }, { error: boolean }> {
	state = { error: false };
	static getDerivedStateFromError() {
		return { error: true };
	}
	componentDidCatch(error: unknown) {
		console.error(`[panel derecho] la pestaña «${this.props.id}» falló al dibujarse`, error);
	}
	render() {
		if (this.state.error) {
			return (
				<p className="p-4 text-[12px] text-(--cc-text-3)">No se pudo mostrar este panel</p>
			);
		}
		return this.props.children;
	}
}
