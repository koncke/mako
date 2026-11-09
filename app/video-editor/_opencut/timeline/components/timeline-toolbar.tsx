"use client";

// La barra de herramientas de la línea de tiempo de CapCut (38 px, `#262626`).
// Es una CÁSCARA: dibuja lo registrado en la ranura `herramientasLinea`
// (ce/ranuras.ts), a la izquierda y a la derecha, con un separador cada vez
// que cambia la centena de `orden`. Lo de esta barra que es del paquete de la
// línea de tiempo se registra en ./herramientas-ce.tsx; Congelar, Revertir,
// Reflejar, Grabar, Generar subtítulos… los registra cada paquete.
//
// Un `grupo` se dibuja como UN botón (el último usado del grupo) con el ◢ de
// CapCut en la esquina, que abre el menú con todos. Un `Control` se dibuja tal
// cual (deslizador del zoom, «Vinculación ▾»).
//
// ⚠️ Nada queda fuera de la vista (Martín, 30/10/2026): iba en un ScrollArea con
// la barra de scroll oculta y a 1366 con el chat abierto «Acercar» no se veía.
// Sin lugar, se esconde lo `prescindible` (../barra-ancho.ts) y, si aun así no
// entra, la barra se parte en dos filas. Sin ScrollArea: su contenido es una
// tabla que crece con lo que tiene adentro y nunca dejaba partir la fila.

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/dropdown-menu";
import { useAncho } from "@/app/video-editor/_opencut/hooks/use-ancho";
import { conPrescindibles } from "@/app/video-editor/_opencut/timeline/barra-ancho";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { useTimelineStore } from "@/app/video-editor/_opencut/timeline/timeline-store";
import {
	herramientasLinea,
	type ContextoHerramienta,
	type HerramientaLinea,
} from "@/app/video-editor/ce/ranuras";
import { TIMELINE_TOOLBAR_HEIGHT_PX } from "./layout";
import { useModoSimple } from "@/app/video-editor/guia/modo-simple";
import { herramientaEnSimple } from "@/app/video-editor/guia/modo-simple-reglas";

type Estado = { visible: boolean; habilitada: boolean; activa: boolean };

function estadoDe(h: HerramientaLinea, ctx: ContextoHerramienta): Estado {
	try {
		return {
			visible: h.visible ? h.visible(ctx) : true,
			habilitada: h.habilitada(ctx),
			activa: h.activa ? h.activa(ctx) : false,
		};
	} catch (error) {
		// Una herramienta rota no puede tumbar la barra entera.
		console.error(`[barra] la herramienta «${h.id}» falló`, error);
		return { visible: false, habilitada: false, activa: false };
	}
}

/** Un bloque de la barra: una herramienta suelta o un grupo ◢. */
type Bloque =
	| { tipo: "suelta"; herramienta: HerramientaLinea }
	| { tipo: "grupo"; id: string; herramientas: HerramientaLinea[] };

function armarBloques(herramientas: HerramientaLinea[]): Bloque[][] {
	const porCentena = new Map<number, Bloque[]>();
	const grupos = new Map<string, Extract<Bloque, { tipo: "grupo" }>>();
	for (const h of herramientas) {
		const centena = Math.floor(h.orden / 100);
		let fila = porCentena.get(centena);
		if (!fila) {
			fila = [];
			porCentena.set(centena, fila);
		}
		if (h.grupo) {
			const ya = grupos.get(h.grupo);
			if (ya) {
				ya.herramientas.push(h);
				continue;
			}
			const nuevo = { tipo: "grupo" as const, id: h.grupo, herramientas: [h] };
			grupos.set(h.grupo, nuevo);
			fila.push(nuevo);
			continue;
		}
		fila.push({ tipo: "suelta", herramienta: h });
	}
	return [...porCentena.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([, fila]) => fila);
}

export function TimelineToolbar() {
	const ref = useRef<HTMLDivElement>(null);
	const prescindibles = conPrescindibles(useAncho(ref));
	const editor = useEditor();
	const seleccion = useEditor((e) => e.selection.getSelectedElements());
	// Los interruptores leen el store de la línea de tiempo: re-dibujar si cambia.
	useTimelineStore();
	const ctx = useMemo<ContextoHerramienta>(
		() => ({ editor, seleccion }),
		[editor, seleccion],
	);
	const simple = useModoSimple();
	const todas = herramientasLinea.todos();
	// Re-evaluar habilitada/activa con cada cambio del editor (deshacer
	// disponible, cabezal sobre un clip…): el selector devuelve los estados y
	// `useEditor` re-dibuja cuando cambia alguno.
	const estados = useEditor((e) =>
		todas.flatMap((h) => {
			const s = estadoDe(h, { editor: e, seleccion: e.selection.getSelectedElements() });
			return [s.visible, s.habilitada, s.activa];
		}),
	);
	const estadoPorId = new Map<string, Estado>(
		todas.map((h, i) => [
			h.id,
			{
				visible: estados[i * 3] ?? true,
				habilitada: estados[i * 3 + 1] ?? false,
				activa: estados[i * 3 + 2] ?? false,
			},
		]),
	);
	// El modo simple de una plantilla guiada (app/video-editor/guia/modo-simple.ts): sólo las de su lista, en positivo.
	const visibles = todas.filter((h) => estadoPorId.get(h.id)?.visible && (prescindibles || !h.prescindible) && (!simple || herramientaEnSimple(h.id)));
	const izquierda = armarBloques(visibles.filter((h) => h.lado === "izquierda"));
	const derecha = armarBloques(visibles.filter((h) => h.lado === "derecha"));

	return (
		<TooltipProvider delayDuration={400}>
			{/* Una fila de 38 px; sin lugar, la derecha baja a una segunda fila y queda a la derecha (`ml-auto`). */}
			<div
				ref={ref}
				data-barra-linea=""
				className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-(--cc-line) px-3 py-[3px]"
				style={{ minHeight: TIMELINE_TOOLBAR_HEIGHT_PX }}
			>
				<Lado filas={izquierda} ctx={ctx} estados={estadoPorId} />
				<Lado filas={derecha} ctx={ctx} estados={estadoPorId} className="ml-auto" />
			</div>
		</TooltipProvider>
	);
}

function Lado({
	filas,
	ctx,
	estados,
	className,
}: {
	filas: Bloque[][];
	ctx: ContextoHerramienta;
	estados: Map<string, Estado>;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-wrap items-center gap-1", className)}>
			{filas.map((fila, i) => (
				// El separador va con SU bloque: si el lado se parte, no queda un separador suelto al final de una línea.
				<div key={i} className="flex items-center gap-1">
					{i > 0 && <span className="mx-1.5 h-4 w-px shrink-0 bg-(--cc-line-2)" />}
					<div className="flex items-center gap-1">
						{fila.map((bloque) =>
							bloque.tipo === "suelta" ? (
								<Herramienta
									key={bloque.herramienta.id}
									herramienta={bloque.herramienta}
									ctx={ctx}
									estado={estados.get(bloque.herramienta.id)}
								/>
							) : (
								<Grupo
									key={bloque.id}
									herramientas={bloque.herramientas}
									ctx={ctx}
									estados={estados}
								/>
							),
						)}
					</div>
				</div>
			))}
		</div>
	);
}

function Herramienta({
	herramienta,
	ctx,
	estado,
}: {
	herramienta: HerramientaLinea;
	ctx: ContextoHerramienta;
	estado?: Estado;
}) {
	if (herramienta.Control) {
		const Control = herramienta.Control;
		return <Control {...ctx} herramienta={herramienta} />;
	}
	return (
		<BotonBarra
			etiqueta={herramienta.etiqueta}
			atajo={herramienta.atajo}
			habilitada={estado?.habilitada ?? false}
			activa={estado?.activa ?? false}
			onClick={() => herramienta.ejecutar(ctx)}
		>
			<herramienta.Icono className="size-4" />
		</BotonBarra>
	);
}

/** Botón de ícono de la barra, con el tooltip «Rótulo  Atajo» de CapCut. */
export function BotonBarra({
	etiqueta,
	atajo,
	habilitada = true,
	activa = false,
	onClick,
	children,
	className,
	esquina,
}: {
	etiqueta: string;
	atajo?: string;
	habilitada?: boolean;
	activa?: boolean;
	onClick?: () => void;
	children: ReactNode;
	className?: string;
	/** El ◢ de los grupos o el ▾ de los menús, dibujado aparte. */
	esquina?: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="relative inline-flex">
					<button
						type="button"
						aria-label={etiqueta}
						aria-pressed={activa || undefined}
						disabled={!habilitada}
						onClick={(event) => {
							event.stopPropagation();
							onClick?.();
						}}
						className={cn(
							"flex size-7 cursor-pointer items-center justify-center rounded-[4px] text-(--cc-icon) hover:bg-(--velo-hover) disabled:cursor-default disabled:text-(--cc-icon-off) disabled:hover:bg-transparent",
							activa && "text-(--cc-accent)",
							className,
						)}
					>
						{children}
					</button>
					{esquina}
				</span>
			</TooltipTrigger>
			<TooltipContent side="top" className="flex items-center gap-2 px-2 py-1 text-xs">
				<span>{etiqueta}</span>
				{atajo && <span className="text-(--cc-text-3)">{atajo}</span>}
			</TooltipContent>
		</Tooltip>
	);
}

function Grupo({
	herramientas,
	ctx,
	estados,
}: {
	herramientas: HerramientaLinea[];
	ctx: ContextoHerramienta;
	estados: Map<string, Estado>;
}) {
	const [ultima, setUltima] = useState<string | null>(null);
	// Se muestra la activa (p. ej. el modo del cursor), si no la última usada.
	const activa = herramientas.find((h) => estados.get(h.id)?.activa);
	const mostrada =
		activa ?? herramientas.find((h) => h.id === ultima) ?? herramientas[0];
	if (!mostrada) return null;
	const estado = estados.get(mostrada.id);
	const algunaHabilitada = herramientas.some((h) => estados.get(h.id)?.habilitada);

	return (
		<DropdownMenu>
			<BotonBarra
				etiqueta={mostrada.etiqueta}
				atajo={mostrada.atajo}
				habilitada={estado?.habilitada ?? false}
				onClick={() => {
					setUltima(mostrada.id);
					mostrada.ejecutar(ctx);
				}}
				esquina={
					<DropdownMenuTrigger asChild disabled={!algunaHabilitada}>
						<button
							type="button"
							aria-label={`Más: ${mostrada.etiqueta}`}
							className="absolute right-0 bottom-0 size-2.5 cursor-pointer disabled:cursor-default"
						>
							<svg
								viewBox="0 0 4 4"
								aria-hidden
								className={cn(
									"absolute right-[2px] bottom-[2px] size-[5px]",
									algunaHabilitada ? "text-(--cc-icon)" : "text-(--cc-icon-off)",
								)}
							>
								<path d="M4 0V4H0Z" fill="currentColor" />
							</svg>
						</button>
					</DropdownMenuTrigger>
				}
			>
				<mostrada.Icono className="size-4" />
			</BotonBarra>
			<DropdownMenuContent align="start" className="min-w-44">
				{herramientas.map((h) => {
					const e = estados.get(h.id);
					return (
						<DropdownMenuItem
							key={h.id}
							disabled={!e?.habilitada}
							onClick={() => {
								setUltima(h.id);
								h.ejecutar(ctx);
							}}
							className={cn("gap-2 text-xs", e?.activa && "text-(--cc-accent)")}
						>
							<h.Icono className="size-3.5" />
							<span className="flex-1">{h.etiqueta}</span>
							{h.atajo && <span className="text-(--cc-text-3)">{h.atajo}</span>}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
