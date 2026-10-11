"use client";

// =============================================================================
// El kit del panel derecho: las piezas con las que se arma cada pestaña
// =============================================================================
// CapCut dibuja todas las propiedades con la misma gramática, y por eso el kit
// es chico y lo usan TODAS las pestañas (las de este paquete y las que registran
// los demás: Velocidad, Animación, Ajustar, Audio…):
//
//   SeccionCe     «Transformación ▴» / «☑ Mezcla ▾»: título, flecha para plegar,
//                 casilla opcional y acciones a la derecha (↺ ◇).
//   FilaCe        una fila de ~38 px: columna de rótulo, el control y, a la
//                 derecha, ↺ restablecer y ◇ fotograma clave con ‹ ›.
//   DeslizadorValor  deslizador + caja de valor («100%»), lo más común.
//   CajaNumero    la caja de valor sola (Posición X/Y, Girar).
//   SegmentadoCe  el control segmentado (#1c1c1c) de «Básico · Máscara».
//   CampoParam    una fila completa para UN parámetro del elemento, eligiendo
//                 el control por su tipo (número, sí/no, lista, color, texto,
//                 fuente). Es lo que usan las pestañas de respaldo y lo más
//                 rápido para una pestaña nueva.
//
// Medidas: las de la captura de CapCut ÷1,25 (la captura está a 125 %): filas
// de 48 px → 38, pestañas de 62 → 50. Colores: los `--cc-*` de capcut-theme.css.

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Diamond, RotateCcw } from "lucide-react";
import { Slider } from "@/app/video-editor/_opencut/components/ui/slider";
import { NumberField } from "@/app/video-editor/_opencut/components/ui/number-field";
import { Switch } from "@/app/video-editor/_opencut/components/ui/switch";
import { Checkbox } from "@/app/video-editor/_opencut/components/ui/checkbox";
import { ColorPicker } from "@/app/video-editor/_opencut/components/ui/color-picker";
import { FontPicker } from "@/app/video-editor/_opencut/components/ui/font-picker";
import { Textarea } from "@/app/video-editor/_opencut/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/app/video-editor/_opencut/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import type { NumberParamDefinition, ParamValue } from "@/app/video-editor/_opencut/params";
import {
	getElementParam,
	type ElementParamDefinition,
} from "@/app/video-editor/_opencut/params/registry";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import {
	clamp,
	formatNumberForDisplay,
	getFractionDigitsForStep,
	snapToStep,
} from "@/app/video-editor/_opencut/utils/math";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { usePropertyDraft } from "../hooks/use-property-draft";
import {
	useParamsConFotogramas,
	type ParamsConFotogramas,
} from "../hooks/use-params-con-fotogramas";

export { useParamsConFotogramas, type ParamsConFotogramas };

// ── Sección ──────────────────────────────────────────────────────────────────

// Plegada o no, por clave: sobrevive a cambiar de clip (CapCut recuerda qué
// secciones cerraste) pero no a recargar la página.
const seccionesAbiertas = new Map<string, boolean>();

export function SeccionCe({
	titulo,
	clave,
	children,
	plegable = true,
	abiertaInicial = true,
	casilla,
	acciones,
	className,
}: {
	titulo: ReactNode;
	/** Para recordar si quedó plegada. Sin clave, arranca como `abiertaInicial`. */
	clave?: string;
	children?: ReactNode;
	plegable?: boolean;
	abiertaInicial?: boolean;
	/** «☑ Mezcla»: la casilla cian a la izquierda del título. */
	casilla?: { marcada: boolean; onCambio: (marcada: boolean) => void };
	acciones?: ReactNode;
	className?: string;
}) {
	const [abierta, setAbierta] = useState(
		() => (clave ? seccionesAbiertas.get(clave) : undefined) ?? abiertaInicial,
	);
	const alternar = () => {
		const siguiente = !abierta;
		setAbierta(siguiente);
		if (clave) seccionesAbiertas.set(clave, siguiente);
	};
	const visible = !plegable || abierta;

	return (
		<section className={cn("flex flex-col border-b border-(--cc-line-2) last:border-b-0", className)}>
			<div className="flex h-[38px] shrink-0 items-center gap-2 px-4">
				{casilla && (
					<Checkbox
						checked={casilla.marcada}
						onCheckedChange={(v) => casilla.onCambio(v === true)}
						aria-label={typeof titulo === "string" ? titulo : undefined}
					/>
				)}
				<button
					type="button"
					disabled={!plegable}
					onClick={alternar}
					className="flex min-w-0 cursor-pointer items-center gap-1 text-left text-[13px] font-medium text-foreground disabled:cursor-default"
				>
					<span className="truncate">{titulo}</span>
					{plegable &&
						(abierta ? (
							<ChevronUp className="size-3.5 shrink-0 text-(--cc-text-3)" />
						) : (
							<ChevronDown className="size-3.5 shrink-0 text-(--cc-text-3)" />
						))}
				</button>
				<div className="ml-auto flex items-center">{acciones}</div>
			</div>
			{visible && children ? (
				<div className="flex flex-col px-4 pb-3">{children}</div>
			) : null}
		</section>
	);
}

// ── Fila ─────────────────────────────────────────────────────────────────────

export function FilaCe({
	rotulo,
	children,
	acciones,
	className,
	alto = "fijo",
}: {
	rotulo?: ReactNode;
	children?: ReactNode;
	/** ↺ y ◇ (o nada). La columna se reserva igual para que las filas alineen. */
	acciones?: ReactNode;
	className?: string;
	/** «libre» para controles altos (una caja de texto, una grilla). */
	alto?: "fijo" | "libre";
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-2",
				alto === "fijo" ? "min-h-[38px]" : "py-1.5",
				className,
			)}
		>
			{rotulo !== undefined && (
				<div className="w-[76px] shrink-0 truncate text-[12px] text-(--cc-text-2)">
					{rotulo}
				</div>
			)}
			<div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
			<div className="flex w-[66px] shrink-0 items-center justify-end gap-0.5">
				{acciones}
			</div>
		</div>
	);
}

function BotonIcono({
	titulo,
	onClick,
	desactivado,
	activo,
	children,
	className,
}: {
	titulo: string;
	onClick: () => void;
	desactivado?: boolean;
	activo?: boolean;
	children: ReactNode;
	className?: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={titulo}
					aria-pressed={activo}
					disabled={desactivado}
					onClick={onClick}
					className={cn(
						"flex size-5 cursor-pointer items-center justify-center rounded-[3px] text-(--cc-icon) hover:bg-(--cc-raised) disabled:cursor-default disabled:text-(--cc-icon-off) disabled:hover:bg-transparent",
						className,
					)}
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent side="top">{titulo}</TooltipContent>
		</Tooltip>
	);
}

/** ↺ «Restablecer». Apagado cuando ya está en el valor por defecto. */
export function BotonRestablecer({
	onClick,
	desactivado,
}: {
	onClick: () => void;
	desactivado?: boolean;
}) {
	return (
		<BotonIcono titulo="Restablecer" onClick={onClick} desactivado={desactivado}>
			<RotateCcw className="size-3.5" />
		</BotonIcono>
	);
}

/** ‹ ◇ › del «Fotograma clave» de un grupo de parámetros. */
export function BotonFotograma({ grupo }: { grupo: ParamsConFotogramas }) {
	const { tieneFotogramas, enFotograma, dentro, anterior, siguiente } = grupo;
	return (
		<div className="flex items-center">
			<button
				type="button"
				aria-label="Fotograma clave anterior"
				disabled={!anterior}
				onClick={() => anterior !== null && grupo.irA(anterior)}
				className={cn(
					"flex h-5 w-3 cursor-pointer items-center justify-center text-(--cc-icon) disabled:cursor-default disabled:text-(--cc-icon-off)",
					!tieneFotogramas && "invisible",
				)}
			>
				<ChevronLeft className="size-3" />
			</button>
			<BotonIcono
				titulo="Fotograma clave"
				onClick={grupo.alternarFotograma}
				desactivado={!dentro}
				activo={enFotograma}
			>
				<Diamond
					className={cn(
						"size-3.5",
						enFotograma && "fill-primary text-primary",
						!enFotograma && tieneFotogramas && "text-primary",
					)}
				/>
			</BotonIcono>
			<button
				type="button"
				aria-label="Fotograma clave siguiente"
				disabled={!siguiente}
				onClick={() => siguiente !== null && grupo.irA(siguiente)}
				className={cn(
					"flex h-5 w-3 cursor-pointer items-center justify-center text-(--cc-icon) disabled:cursor-default disabled:text-(--cc-icon-off)",
					!tieneFotogramas && "invisible",
				)}
			>
				<ChevronRight className="size-3" />
			</button>
		</div>
	);
}

/** Las dos acciones de la derecha para un grupo: ↺ y ‹ ◇ › (si se anima). */
export function AccionesGrupo({
	grupo,
	animable = true,
}: {
	grupo: ParamsConFotogramas;
	animable?: boolean;
}) {
	return (
		<>
			<BotonRestablecer
				onClick={grupo.restablecer}
				desactivado={grupo.esPorDefecto && !grupo.tieneFotogramas}
			/>
			{animable ? <BotonFotograma grupo={grupo} /> : <span className="w-[44px]" />}
		</>
	);
}

// ── Números ──────────────────────────────────────────────────────────────────

export function CajaNumero({
	valor,
	min,
	max,
	paso,
	sufijo,
	etiqueta,
	onPrevisualizar,
	onConfirmar,
	className,
	ariaLabel,
	desactivado,
}: {
	/** En unidades de PANTALLA (100 para 100 %). */
	valor: number;
	min?: number;
	max?: number;
	paso: number;
	sufijo?: string;
	/** Asa para arrastrar el valor («X», «Y»). */
	etiqueta?: ReactNode;
	onPrevisualizar: (valor: number) => void;
	onConfirmar: () => void;
	className?: string;
	ariaLabel?: string;
	desactivado?: boolean;
}) {
	const acotar = (v: number) =>
		clamp({
			value: snapToStep({ value: v, step: paso }),
			min: min ?? Number.NEGATIVE_INFINITY,
			max: max ?? Number.POSITIVE_INFINITY,
		});
	const draft = usePropertyDraft({
		displayValue: formatNumberForDisplay({
			value: valor,
			maxFractionDigits: getFractionDigitsForStep({ step: paso }),
		}),
		parse: (input) => {
			const n = parseFloat(input.replace(",", "."));
			return Number.isNaN(n) ? null : acotar(n);
		},
		onPreview: onPrevisualizar,
		onCommit: onConfirmar,
	});
	return (
		<NumberField
			className={cn("h-[26px] w-[68px] shrink-0", className)}
			icon={etiqueta}
			suffix={sufijo}
			value={draft.displayValue}
			disabled={desactivado}
			aria-label={ariaLabel}
			dragSensitivity="slow"
			onFocus={draft.onFocus}
			onChange={draft.onChange}
			onBlur={draft.onBlur}
			onScrub={(v) => onPrevisualizar(acotar(v))}
			onScrubEnd={onConfirmar}
		/>
	);
}

export function DeslizadorValor({
	valor,
	min,
	max,
	paso,
	sufijo,
	onPrevisualizar,
	onConfirmar,
	ariaLabel,
	desactivado,
}: {
	valor: number;
	min: number;
	max: number;
	paso: number;
	sufijo?: string;
	onPrevisualizar: (valor: number) => void;
	onConfirmar: () => void;
	ariaLabel?: string;
	desactivado?: boolean;
}) {
	return (
		<>
			<Slider
				className="min-w-0 flex-1"
				value={[clamp({ value: valor, min, max })]}
				min={min}
				max={max}
				step={paso}
				disabled={desactivado}
				aria-label={ariaLabel}
				onValueChange={([v]) => v !== undefined && onPrevisualizar(v)}
				onValueCommit={onConfirmar}
			/>
			<CajaNumero
				valor={valor}
				min={min}
				max={max}
				paso={paso}
				sufijo={sufijo}
				ariaLabel={ariaLabel}
				desactivado={desactivado}
				onPrevisualizar={onPrevisualizar}
				onConfirmar={onConfirmar}
			/>
		</>
	);
}

// ── Control segmentado ───────────────────────────────────────────────────────

export function SegmentadoCe({
	opciones,
	valor,
	onCambio,
	className,
}: {
	opciones: ReadonlyArray<{ id: string; etiqueta: string; desactivada?: boolean }>;
	valor: string;
	onCambio: (id: string) => void;
	className?: string;
}) {
	return (
		<div
			role="tablist"
			className={cn("flex h-[28px] items-stretch gap-0.5 rounded-[5px] bg-(--cc-sunken) p-0.5", className)}
		>
			{opciones.map((op) => (
				<button
					key={op.id}
					type="button"
					role="tab"
					aria-selected={op.id === valor}
					disabled={op.desactivada}
					onClick={() => onCambio(op.id)}
					className={cn(
						"min-w-0 flex-1 cursor-pointer truncate rounded-[4px] px-2 text-[12px] disabled:cursor-default disabled:opacity-40",
						op.id === valor
							? "bg-(--cc-raised) text-foreground"
							: "text-(--cc-text-2) hover:text-foreground",
					)}
				>
					{op.etiqueta}
				</button>
			))}
		</div>
	);
}

// ── Un parámetro del elemento, completo ──────────────────────────────────────

/** Cómo se muestra un número: factor, rango y paso en unidades de pantalla. */
export function escalaDeNumero(param: NumberParamDefinition): {
	factor: number;
	min: number;
	max: number | undefined;
	paso: number;
	sufijo?: string;
} {
	if (param.unit === "percent") {
		const tope = param.max ?? 100;
		return { factor: 100 / tope, min: 0, max: 100, paso: 1, sufijo: "%" };
	}
	return {
		factor: param.displayMultiplier ?? 1,
		min: param.min,
		max: param.max,
		paso: param.step,
	};
}

/**
 * Una fila para UN parámetro del elemento (de params/registry o de params/extra),
 * con su ↺ y su ◇. `rotulo` pisa el `label` del parámetro si hace falta.
 *
 * Para un parámetro que no es del registro (el de una forma, el de un efecto del
 * clip) se pasa `param` con su `read`/`write` y `ruta`, la ruta de animación
 * (`params.<clave>`, `effects.<id>.params.<clave>`).
 */
export function CampoParam({
	element,
	trackId,
	clave,
	rotulo,
	param: paramDado,
	ruta,
}: {
	element: TimelineElement;
	trackId: string;
	clave?: string;
	rotulo?: string;
	param?: ElementParamDefinition;
	ruta?: string;
}) {
	const param = paramDado ?? (clave ? getElementParam({ element, key: clave }) : null);
	if (!param) return null;
	return (
		<CampoParamDef element={element} trackId={trackId} param={param} rotulo={rotulo} ruta={ruta} />
	);
}

function CampoParamDef({
	element,
	trackId,
	param,
	rotulo,
	ruta,
}: {
	element: TimelineElement;
	trackId: string;
	param: ElementParamDefinition;
	rotulo?: string;
	ruta?: string;
}) {
	const grupo = useParamsConFotogramas({
		element,
		trackId,
		params: [param],
		rutas: ruta ? { [param.key]: ruta } : undefined,
	});
	const valor = grupo.valores[param.key] ?? param.default;
	const animable = param.keyframable !== false;
	const acciones = <AccionesGrupo grupo={grupo} animable={animable} />;
	const etiqueta = rotulo ?? param.label;

	if (param.type === "number") {
		const { factor, min, max, paso, sufijo } = escalaDeNumero(param);
		const numero = (typeof valor === "number" ? valor : Number(valor)) * factor;
		const previsualizar = (v: number) => grupo.previsualizar({ [param.key]: v / factor });
		return (
			<FilaCe rotulo={etiqueta} acciones={acciones}>
				{max !== undefined && Number.isFinite(min) ? (
					<DeslizadorValor
						valor={numero}
						min={min}
						max={max}
						paso={paso}
						sufijo={sufijo}
						ariaLabel={etiqueta}
						onPrevisualizar={previsualizar}
						onConfirmar={grupo.confirmar}
					/>
				) : (
					<CajaNumero
						className="ml-auto w-[96px]"
						valor={numero}
						min={min}
						max={max}
						paso={paso}
						sufijo={sufijo}
						ariaLabel={etiqueta}
						onPrevisualizar={previsualizar}
						onConfirmar={grupo.confirmar}
					/>
				)}
			</FilaCe>
		);
	}

	if (param.type === "boolean") {
		return (
			<FilaCe rotulo={etiqueta} acciones={acciones}>
				<Switch
					className="ml-auto"
					checked={Boolean(valor)}
					aria-label={etiqueta}
					onCheckedChange={(v) => grupo.aplicar({ [param.key]: v })}
				/>
			</FilaCe>
		);
	}

	if (param.type === "select") {
		return (
			<FilaCe rotulo={etiqueta} acciones={acciones}>
				<SelectCe
					valor={String(valor)}
					opciones={param.options.map((o) => ({ id: o.value, etiqueta: o.label }))}
					onCambio={(v) => grupo.aplicar({ [param.key]: v })}
					ariaLabel={etiqueta}
				/>
			</FilaCe>
		);
	}

	if (param.type === "color") {
		return (
			<FilaCe rotulo={etiqueta} acciones={acciones}>
				<ColorPicker
					className="w-full"
					value={String(valor).replace(/^#/, "").toUpperCase()}
					onChange={(c) => grupo.previsualizar({ [param.key]: `#${c}` })}
					onChangeEnd={(c) => grupo.aplicar({ [param.key]: `#${c}` })}
				/>
			</FilaCe>
		);
	}

	if (param.type === "text") {
		return <CampoTexto grupo={grupo} param={param} valor={String(valor)} />;
	}

	if (param.type === "font") {
		return (
			<FilaCe rotulo={etiqueta} acciones={acciones}>
				<div className="min-w-0 flex-1">
					<FontPicker
						defaultValue={String(valor)}
						onValueChange={(v) => grupo.aplicar({ [param.key]: v })}
					/>
				</div>
			</FilaCe>
		);
	}

	return null;
}

function CampoTexto({
	grupo,
	param,
	valor,
}: {
	grupo: ParamsConFotogramas;
	param: ElementParamDefinition;
	valor: string;
}) {
	const draft = usePropertyDraft({
		displayValue: valor,
		parse: (input) => input,
		onPreview: (v: string) => grupo.previsualizar({ [param.key]: v }),
		onCommit: grupo.confirmar,
		supportsExpressions: false,
	});
	return (
		<div className="py-1.5">
			<Textarea
				aria-label={param.label}
				className="min-h-[72px] bg-(--cc-sunken)"
				value={draft.displayValue}
				onFocus={draft.onFocus}
				onChange={draft.onChange}
				onBlur={draft.onBlur}
			/>
		</div>
	);
}

/** El desplegable de CapCut (#3b3b3b, sin borde). */
export function SelectCe({
	valor,
	opciones,
	onCambio,
	ariaLabel,
	className,
}: {
	valor: string;
	opciones: ReadonlyArray<{ id: string; etiqueta: string; desactivada?: boolean; ayuda?: string }>;
	onCambio: (id: string) => void;
	ariaLabel?: string;
	className?: string;
}) {
	return (
		<Select value={valor} onValueChange={onCambio}>
			<SelectTrigger className={cn("h-[26px] w-full min-w-0", className)} aria-label={ariaLabel}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{opciones.map((op) => (
					<SelectItem key={op.id} value={op.id} disabled={op.desactivada} title={op.ayuda}>
						{op.etiqueta}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** Los parámetros visibles de una lista (respeta `dependencies`, como el motor). */
export function paramsVisibles(
	params: readonly ElementParamDefinition[],
	valores: Record<string, ParamValue>,
): ElementParamDefinition[] {
	return params.filter((param) =>
		(param.dependencies ?? []).every((dep) => valores[dep.param] === dep.equals),
	);
}
