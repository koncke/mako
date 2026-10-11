"use client";

// =============================================================================
// Las piezas comunes del contenido de la biblioteca (a la derecha de la columna)
// =============================================================================
// Cada pestaña de la biblioteca la arma un paquete distinto (Multimedia, Audio,
// Texto y Stickers acá; Efectos, Filtros y Ajuste en effects/; Transiciones en
// transiciones/; Subtítulos en subtitles/). Para que se vean como UNA biblioteca
// —la de CapCut— el buscador, la grilla, el estado vacío y la zona de importar
// salen de este archivo. Medidas: las del relevamiento a 125 % ÷ 1,25.

import { useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AddCircleIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { X } from "lucide-react";
import { cn } from "@/app/video-editor/_opencut/utils/ui";

/** El marco del contenido: arriba el buscador (si hay), abajo lo que se desplaza. */
export function ContenidoBiblioteca({
	arriba,
	children,
	className,
	cuerpoClassName,
	...resto
}: {
	arriba?: ReactNode;
	children: ReactNode;
	className?: string;
	cuerpoClassName?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("relative flex h-full min-h-0 flex-col", className)} {...resto}>
			{arriba && <div className="shrink-0 px-3 pt-3 pb-2">{arriba}</div>}
			<div
				className={cn(
					"scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3",
					!arriba && "pt-3",
					cuerpoClassName,
				)}
			>
				{children}
			</div>
		</div>
	);
}

/** El buscador de arriba del contenido («Buscar», ⌕ a la izquierda, ✕ para borrar). */
export function BuscadorBiblioteca({
	valor,
	onCambio,
	placeholder = "Buscar",
	className,
}: {
	valor: string;
	onCambio: (valor: string) => void;
	placeholder?: string;
	className?: string;
}) {
	return (
		<label
			className={cn(
				"flex h-7 w-full items-center gap-1.5 rounded-[4px] bg-[var(--cc-input)] px-2",
				"focus-within:ring-1 focus-within:ring-primary/60",
				className,
			)}
		>
			<HugeiconsIcon
				icon={Search01Icon}
				className="size-3.5 shrink-0 text-[var(--cc-text-3)]"
			/>
			<input
				type="search"
				value={valor}
				onChange={(event) => onCambio(event.target.value)}
				placeholder={placeholder}
				className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-[var(--cc-text)] outline-none placeholder:text-[var(--cc-text-3)] [&::-webkit-search-cancel-button]:hidden"
			/>
			{valor && (
				<button
					type="button"
					aria-label="Borrar"
					onClick={() => onCambio("")}
					className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--cc-text-3)] hover:text-[var(--cc-text)]"
				>
					<X className="size-3" />
				</button>
			)}
		</label>
	);
}

/** El estado vacío: UNA frase, centrada (AGENTS.md: el texto que se dibuja es corto). */
export function VacioBiblioteca({
	texto,
	children,
	className,
}: {
	texto: string;
	children?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex h-full min-h-32 flex-col items-center justify-center gap-3 px-6 text-center",
				className,
			)}
		>
			<p className="text-[12px] text-balance text-[var(--cc-text-3)]">{texto}</p>
			{children}
		</div>
	);
}

/** Grilla de tarjetas de la biblioteca: 3 por fila en el ancho de siempre (~128 px a 125 %). */
export function GrillaBiblioteca({
	children,
	minimo = 92,
	className,
}: {
	children: ReactNode;
	/** Ancho mínimo de cada tarjeta, en px. */
	minimo?: number;
	className?: string;
}) {
	return (
		<div
			className={cn("grid gap-x-2 gap-y-3", className)}
			style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minimo}px, 1fr))` }}
		>
			{children}
		</div>
	);
}

/** Título de un grupo dentro del contenido («Utilizado recientemente», «Formas»…). */
export function TituloGrupo({
	children,
	accion,
}: {
	children: ReactNode;
	accion?: ReactNode;
}) {
	return (
		<div className="mb-2 flex h-5 items-center justify-between gap-2">
			<span className="truncate text-[12px] text-[var(--cc-text-2)]">{children}</span>
			{accion}
		</div>
	);
}

/**
 * La zona punteada «⊕ Importar — Arrastra y suelta… aquí» de CapCut. Es un botón
 * (abre el selector de archivos) y a la vez la superficie donde se sueltan.
 */
export function ZonaImportar({
	texto,
	onClick,
	procesando = false,
	progreso = 0,
	resaltada = false,
	compacta = false,
	rotuloProcesando = "Importando…",
	className,
}: {
	texto: string;
	onClick: () => void;
	procesando?: boolean;
	progreso?: number;
	/** Lo que dice mientras procesa («Importando…», «Extrayendo audio…»). */
	rotuloProcesando?: string;
	/** Algo se está arrastrando encima. */
	resaltada?: boolean;
	/** Una franja baja (cuando ya hay archivos debajo). */
	compacta?: boolean;
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={procesando}
			className={cn(
				"flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[6px] border border-dashed px-4 text-center transition-colors",
				compacta ? "min-h-[72px] py-3" : "min-h-[150px] py-6",
				resaltada
					? "border-primary bg-primary/10"
					: "border-[var(--cc-btn-2)] bg-[var(--cc-panel)] hover:border-[var(--cc-text-3)] hover:bg-[var(--cc-raised)]/40",
				"disabled:cursor-default",
				className,
			)}
		>
			<span className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--cc-text)]">
				<HugeiconsIcon icon={AddCircleIcon} className="size-4" />
				{procesando ? `${rotuloProcesando} ${progreso} %` : "Importar"}
			</span>
			<span className="max-w-64 text-[11px] text-balance text-[var(--cc-text-3)]">
				{texto}
			</span>
			{procesando && (
				<span className="mt-1 block h-1 w-40 overflow-hidden rounded-full bg-[var(--cc-raised)]">
					<span
						className="block h-full rounded-full bg-primary transition-[width]"
						style={{ width: `${progreso}%` }}
					/>
				</span>
			)}
		</button>
	);
}

/** «00:05», «01:12», «1:02:03»: el formato de duración de las miniaturas de CapCut. */
export function formatearDuracion(segundos: number | undefined): string {
	if (segundos == null || !Number.isFinite(segundos)) return "";
	const total = Math.max(0, Math.round(segundos));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const dos = (n: number) => n.toString().padStart(2, "0");
	return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

/** Un estado local de búsqueda con el texto normalizado (sin tildes, minúsculas). */
export function useBusqueda(): {
	valor: string;
	setValor: (valor: string) => void;
	normalizado: string;
} {
	const [valor, setValor] = useState("");
	return { valor, setValor, normalizado: normalizarBusqueda(valor) };
}

export function normalizarBusqueda(texto: string): string {
	return texto
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}
