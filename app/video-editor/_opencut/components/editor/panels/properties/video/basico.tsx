"use client";

// =============================================================================
// Video › Básico (clip de video, imagen, sticker o forma)
// =============================================================================
// Las tres secciones de CapCut que el motor puede hacer:
//
//   Transformación ▴   Escala (+ «Escala uniforme»), Posición X/Y, Girar (caja
//                      y rueda) y los 6 botones de alineación. ↺ y ◇ por fila y
//                      para toda la sección.
//   ☑ Mezcla ▾         Opacidad y Modo (los 11 de CapCut; «Profundidad lineal»
//                      va apagada porque el compositor de WASM no la trae).
//   Lienzo             Color / Desenfocar / Diseño del fondo.
//
// Unidades: el motor guarda la escala como factor (1 = el clip entra justo en el
// lienzo) y la posición en píxeles del lienzo desde el centro, con Y hacia ABAJO
// (coordenadas de canvas). CapCut muestra la escala en % y la posición con Y
// hacia ARRIBA (su borrador guarda `transform.y` positivo = arriba), así que la
// caja Y muestra el valor con el signo invertido. Lo guardado no cambia.
//
// ⚠️ El LIENZO del motor es UNO por proyecto (`settings.background`), no por
// clip como en CapCut: cambiarlo acá lo cambia para todos los clips, que es lo
// que en CapCut hace «Aplicar a todo». Por eso no hay botón «Aplicar a todo».
//
// `SeccionTransformacion` y `SeccionMezcla` se exportan: el Básico de TEXTO de
// CapCut tiene las mismas dos secciones y el paquete de texto las reusa.

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as EventoPuntero } from "react";
import {
	AlignCenterHorizontal,
	AlignCenterVertical,
	AlignEndHorizontal,
	AlignEndVertical,
	AlignStartHorizontal,
	AlignStartVertical,
} from "lucide-react";
import { Switch } from "@/app/video-editor/_opencut/components/ui/switch";
import { Popover, PopoverTrigger } from "@/app/video-editor/_opencut/components/ui/popover";
import { ColorPickerContent } from "@/app/video-editor/_opencut/components/ui/color-picker";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { getVisibleElementsWithBounds } from "@/app/video-editor/_opencut/preview/element-bounds";
import {
	getElementParam,
	type ElementParamDefinition,
} from "@/app/video-editor/_opencut/params/registry";
import type { SelectParamDefinition } from "@/app/video-editor/_opencut/params";
import { MIN_TRANSFORM_SCALE } from "@/app/video-editor/_opencut/animation/transform";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import type { TBackground } from "@/app/video-editor/_opencut/project/types";
import { DEFAULT_BACKGROUND_COLOR } from "@/app/video-editor/_opencut/background/color";
import { colors } from "@/app/video-editor/_opencut/data/colors/solid";
import { patternCraftGradients } from "@/app/video-editor/_opencut/data/colors/pattern-craft";
import { syntaxUIGradients } from "@/app/video-editor/_opencut/data/colors/syntax-ui";
import { effectPreviewService } from "@/app/video-editor/_opencut/services/renderer/effect-preview";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { usePropertiesStore } from "../stores/properties-store";
import {
	AccionesGrupo,
	CajaNumero,
	DeslizadorValor,
	FilaCe,
	SeccionCe,
	SelectCe,
	useParamsConFotogramas,
	type ParamsConFotogramas,
} from "../components/kit";

export function VideoBasico({ element, track }: ContextoInspector) {
	return (
		<div className="flex flex-col pt-1">
			<SeccionTransformacion element={element} trackId={track.id} />
			<SeccionMezcla element={element} trackId={track.id} />
			<SeccionLienzo />
		</div>
	);
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function useGrupo(element: TimelineElement, trackId: string, claves: readonly string[]) {
	const params = claves
		.map((key) => getElementParam({ element, key }))
		.filter((p): p is ElementParamDefinition => p !== null);
	return useParamsConFotogramas({ element, trackId, params });
}

const num = (grupo: ParamsConFotogramas, clave: string, fallback = 0) => {
	const v = grupo.valores[clave];
	return typeof v === "number" ? v : fallback;
};

// ── Transformación ───────────────────────────────────────────────────────────

const ESCALA_MIN = Math.max(1, MIN_TRANSFORM_SCALE * 100);
const ESCALA_MAX = 500;

export function SeccionTransformacion({
	element,
	trackId,
}: {
	element: TimelineElement;
	trackId: string;
}) {
	const uniforme = usePropertiesStore((s) => s.escalaUniforme[element.id] ?? true);
	const setEscalaUniforme = usePropertiesStore((s) => s.setEscalaUniforme);
	// ↺ y ◇ de la cabecera: toda la transformación de una vez.
	const todo = useGrupo(element, trackId, [
		"transform.scaleX",
		"transform.scaleY",
		"transform.positionX",
		"transform.positionY",
		"transform.rotate",
	]);

	// Cada fila es su propio componente: los grupos (y sus suscripciones al
	// cabezal) existen sólo para las filas que se ven.
	return (
		<SeccionCe
			titulo="Transformación"
			clave="ce:basico:transformacion"
			acciones={<AccionesGrupo grupo={todo} />}
		>
			{uniforme ? (
				<FilaEscala element={element} trackId={trackId} claves={["transform.scaleX", "transform.scaleY"]} rotulo="Escala" />
			) : (
				<>
					<FilaEscala element={element} trackId={trackId} claves={["transform.scaleX"]} rotulo="Escala X" />
					<FilaEscala element={element} trackId={trackId} claves={["transform.scaleY"]} rotulo="Escala Y" />
				</>
			)}
			<FilaCe rotulo="Escala uniforme">
				<Switch
					className="ml-auto"
					checked={uniforme}
					aria-label="Escala uniforme"
					onCheckedChange={(v) => setEscalaUniforme({ elementId: element.id, uniforme: v })}
				/>
			</FilaCe>
			<FilaPosicion element={element} trackId={trackId} />
			<FilaGiro element={element} trackId={trackId} />
			<Alineacion element={element} trackId={trackId} />
		</SeccionCe>
	);
}

function FilaEscala({
	element,
	trackId,
	claves,
	rotulo,
}: {
	element: TimelineElement;
	trackId: string;
	/** Las dos (uniforme) o una sola. */
	claves: readonly ("transform.scaleX" | "transform.scaleY")[];
	rotulo: string;
}) {
	const grupo = useGrupo(element, trackId, claves);
	const principal = claves[0] ?? "transform.scaleX";
	const v = num(grupo, principal, 1);
	return (
		<FilaCe rotulo={rotulo} acciones={<AccionesGrupo grupo={grupo} />}>
			<DeslizadorValor
				valor={v * 100}
				min={ESCALA_MIN}
				max={ESCALA_MAX}
				paso={1}
				sufijo="%"
				ariaLabel={rotulo}
				onPrevisualizar={(pct) => {
					if (claves.length === 1) {
						grupo.previsualizar({ [principal]: pct / 100 });
						return;
					}
					// Uniforme conserva la proporción que tenga (si se estiró con
					// el interruptor apagado, sigue estirada).
					const sx = num(grupo, "transform.scaleX", 1);
					const sy = num(grupo, "transform.scaleY", 1);
					const k = sx !== 0 ? sy / sx : 1;
					grupo.previsualizar({
						"transform.scaleX": pct / 100,
						"transform.scaleY": (pct / 100) * k,
					});
				}}
				onConfirmar={grupo.confirmar}
			/>
		</FilaCe>
	);
}

function FilaPosicion({ element, trackId }: { element: TimelineElement; trackId: string }) {
	const posicion = useGrupo(element, trackId, ["transform.positionX", "transform.positionY"]);
	const x = num(posicion, "transform.positionX");
	const y = num(posicion, "transform.positionY");
	return (
		<FilaCe rotulo="Posición" acciones={<AccionesGrupo grupo={posicion} />}>
			<CajaNumero
				className="min-w-0 flex-1"
				etiqueta="X"
				ariaLabel="Posición X"
				valor={x}
				paso={1}
				onPrevisualizar={(v) => posicion.previsualizar({ "transform.positionX": v })}
				onConfirmar={posicion.confirmar}
			/>
			<CajaNumero
				className="min-w-0 flex-1"
				etiqueta="Y"
				ariaLabel="Posición Y"
				valor={-y}
				paso={1}
				onPrevisualizar={(v) => posicion.previsualizar({ "transform.positionY": -v })}
				onConfirmar={posicion.confirmar}
			/>
		</FilaCe>
	);
}

function FilaGiro({ element, trackId }: { element: TimelineElement; trackId: string }) {
	const giro = useGrupo(element, trackId, ["transform.rotate"]);
	const grados = num(giro, "transform.rotate");
	return (
		<FilaCe rotulo="Girar" acciones={<AccionesGrupo grupo={giro} />}>
			<CajaNumero
				className="min-w-0 flex-1"
				ariaLabel="Girar"
				valor={grados}
				min={-360}
				max={360}
				paso={1}
				sufijo="°"
				onPrevisualizar={(v) => giro.previsualizar({ "transform.rotate": v })}
				onConfirmar={giro.confirmar}
			/>
			<RuedaGiro
				grados={grados}
				onPrevisualizar={(v) => giro.previsualizar({ "transform.rotate": v })}
				onConfirmar={giro.confirmar}
			/>
		</FilaCe>
	);
}

/** La rueda de «Girar»: se arrastra alrededor del centro; Mayús salta de a 15°. */
function RuedaGiro({
	grados,
	onPrevisualizar,
	onConfirmar,
}: {
	grados: number;
	onPrevisualizar: (grados: number) => void;
	onConfirmar: () => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const arrastrando = useRef(false);

	const angulo = (e: EventoPuntero) => {
		const r = ref.current?.getBoundingClientRect();
		if (!r) return null;
		// 0° arriba y sentido horario, como el motor (canvas con Y hacia abajo).
		const a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
		let n = ((a + 540) % 360) - 180;
		n = e.shiftKey ? Math.round(n / 15) * 15 : Math.round(n);
		return n;
	};

	return (
		<div
			ref={ref}
			role="slider"
			aria-label="Girar"
			aria-valuenow={grados}
			aria-valuemin={-360}
			aria-valuemax={360}
			tabIndex={-1}
			className="relative size-[22px] shrink-0 cursor-grab rounded-full border border-(--cc-btn-2) bg-(--cc-sunken) active:cursor-grabbing"
			onPointerDown={(e) => {
				e.currentTarget.setPointerCapture(e.pointerId);
				arrastrando.current = true;
				const n = angulo(e);
				if (n !== null) onPrevisualizar(n);
			}}
			onPointerMove={(e) => {
				if (!arrastrando.current) return;
				const n = angulo(e);
				if (n !== null) onPrevisualizar(n);
			}}
			onPointerUp={() => {
				if (!arrastrando.current) return;
				arrastrando.current = false;
				onConfirmar();
			}}
		>
			<span
				className="absolute top-1/2 left-1/2 h-[9px] w-[2px] origin-bottom rounded-full bg-(--cc-text)"
				style={{ transform: `translate(-50%, -100%) rotate(${grados}deg)` }}
			/>
		</div>
	);
}

type Lado = "izquierda" | "centro" | "derecha" | "arriba" | "medio" | "abajo";

const ALINEACIONES: ReadonlyArray<{ lado: Lado; titulo: string; Icono: typeof AlignStartVertical }> = [
	{ lado: "izquierda", titulo: "Alinear a la izquierda", Icono: AlignStartVertical },
	// CapCut dice «Alinar al centro» y «Alinar arriba» (errata del es-LA.po): se corrige.
	{ lado: "centro", titulo: "Alinear al centro", Icono: AlignCenterVertical },
	{ lado: "derecha", titulo: "Alinear a la derecha", Icono: AlignEndVertical },
	{ lado: "arriba", titulo: "Alinear arriba", Icono: AlignStartHorizontal },
	{ lado: "medio", titulo: "Alinear al medio", Icono: AlignCenterHorizontal },
	{ lado: "abajo", titulo: "Alinear abajo", Icono: AlignEndHorizontal },
];

function Alineacion({ element, trackId }: { element: TimelineElement; trackId: string }) {
	const posicion = useGrupo(element, trackId, ["transform.positionX", "transform.positionY"]);
	const tracks = useEditor((e) => e.timeline.getPreviewTracks() ?? e.scenes.getActiveScene().tracks);
	const currentTime = useEditor((e) => e.playback.getCurrentTime());
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const lienzo = useEditor((e) => e.project.getActive().settings.canvasSize);

	const caja = useMemo(() => {
		// Fuera del clip se mide en su borde más cercano, como hace la máscara.
		const t = Math.min(Math.max(currentTime, element.startTime), element.startTime + element.duration - 1);
		return (
			getVisibleElementsWithBounds({ tracks, currentTime: t, canvasSize: lienzo, mediaAssets }).find(
				(it) => it.trackId === trackId && it.elementId === element.id,
			)?.bounds ?? null
		);
	}, [tracks, currentTime, lienzo, mediaAssets, element.startTime, element.duration, element.id, trackId]);

	const alinear = (lado: Lado) => {
		if (!caja) return;
		// La caja que ocupa en pantalla, girada incluida.
		const rad = (caja.rotation * Math.PI) / 180;
		const ancho = Math.abs(caja.width * Math.cos(rad)) + Math.abs(caja.height * Math.sin(rad));
		const alto = Math.abs(caja.width * Math.sin(rad)) + Math.abs(caja.height * Math.cos(rad));
		const x = num(posicion, "transform.positionX");
		const y = num(posicion, "transform.positionY");
		const destinoX: Partial<Record<Lado, number>> = {
			izquierda: ancho / 2,
			centro: lienzo.width / 2,
			derecha: lienzo.width - ancho / 2,
		};
		const destinoY: Partial<Record<Lado, number>> = {
			arriba: alto / 2,
			medio: lienzo.height / 2,
			abajo: lienzo.height - alto / 2,
		};
		const dx = destinoX[lado];
		const dy = destinoY[lado];
		posicion.aplicar({
			...(dx !== undefined ? { "transform.positionX": Math.round(x + dx - caja.cx) } : {}),
			...(dy !== undefined ? { "transform.positionY": Math.round(y + dy - caja.cy) } : {}),
		});
	};

	return (
		<div className="flex min-h-[38px] items-center justify-between gap-1 pr-[66px]">
			{ALINEACIONES.map(({ lado, titulo, Icono }) => (
				<Tooltip key={lado}>
					<TooltipTrigger asChild>
						<button
							type="button"
							aria-label={titulo}
							disabled={!caja}
							onClick={() => alinear(lado)}
							className="flex h-[26px] flex-1 cursor-pointer items-center justify-center rounded-[4px] bg-(--cc-sunken) text-(--cc-icon) hover:text-foreground disabled:cursor-default disabled:text-(--cc-icon-off)"
						>
							<Icono className="size-3.5" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="top">{titulo}</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}

// ── Mezcla ───────────────────────────────────────────────────────────────────

/** Los 11 modos de CapCut, en su orden. `null` = el motor no lo tiene. */
const MODOS_CAPCUT: ReadonlyArray<{ valor: string | null; etiqueta: string }> = [
	{ valor: "normal", etiqueta: "Normal" },
	{ valor: "screen", etiqueta: "Pantalla" },
	{ valor: "darken", etiqueta: "Oscurecer" },
	{ valor: "lighten", etiqueta: "Iluminar" },
	{ valor: "overlay", etiqueta: "Superposición" },
	{ valor: "hard-light", etiqueta: "Luz intensa" },
	{ valor: "soft-light", etiqueta: "Luz tenue" },
	{ valor: null, etiqueta: "Profundidad lineal" },
	{ valor: "color-burn", etiqueta: "Profundidad del color" },
	{ valor: "color-dodge", etiqueta: "Desvanecimiento del color" },
	{ valor: "multiply", etiqueta: "Multiplicar" },
];

export function SeccionMezcla({
	element,
	trackId,
}: {
	element: TimelineElement;
	trackId: string;
}) {
	const opacidad = useGrupo(element, trackId, ["opacity"]);
	const modo = useGrupo(element, trackId, ["blendMode"]);
	const ambos = useGrupo(element, trackId, ["opacity", "blendMode"]);
	const [casilla, setCasilla] = useState<boolean | null>(null);

	const alfa = num(opacidad, "opacity", 1);
	const valorModo = String(modo.valores.blendMode ?? "normal");
	const marcada = casilla ?? !ambos.esPorDefecto;

	const paramModo = getElementParam({ element, key: "blendMode" }) as SelectParamDefinition | null;
	const opciones = MODOS_CAPCUT.map((m, i) => ({
		id: m.valor ?? `sin-motor-${i}`,
		etiqueta: m.etiqueta,
		desactivada: m.valor === null,
	}));
	// Un proyecto viejo puede traer un modo que CapCut no tiene: se muestra igual.
	if (!MODOS_CAPCUT.some((m) => m.valor === valorModo)) {
		const extra = paramModo?.options.find((o) => o.value === valorModo);
		opciones.push({ id: valorModo, etiqueta: extra?.label ?? valorModo, desactivada: false });
	}

	return (
		<SeccionCe
			titulo="Mezcla"
			plegable={false}
			casilla={{
				marcada,
				onCambio: (v) => {
					setCasilla(v);
					// Apagar la mezcla la deja como estaba: opaca y en Normal.
					if (!v && !ambos.esPorDefecto) ambos.restablecer();
				},
			}}
		>
			{marcada && (
				<>
					<FilaCe rotulo="Opacidad" acciones={<AccionesGrupo grupo={opacidad} />}>
						<DeslizadorValor
							valor={Math.round(alfa * 100)}
							min={0}
							max={100}
							paso={1}
							sufijo="%"
							ariaLabel="Opacidad"
							onPrevisualizar={(v) => opacidad.previsualizar({ opacity: v / 100 })}
							onConfirmar={opacidad.confirmar}
						/>
					</FilaCe>
					<FilaCe rotulo="Modo" acciones={<AccionesGrupo grupo={modo} animable={false} />}>
						<SelectCe
							valor={valorModo}
							opciones={opciones}
							ariaLabel="Modo"
							onCambio={(v) => modo.aplicar({ blendMode: v })}
						/>
					</FilaCe>
				</>
			)}
		</SeccionCe>
	);
}

// ── Lienzo ───────────────────────────────────────────────────────────────────

type TipoLienzo = "color" | "desenfocar" | "diseno";

// Los cuatro niveles de CapCut (0,0625 · 0,375 · 0,75 · 1 del máximo), sobre el
// «Heavy» (500) del motor.
const NIVELES_DESENFOQUE = [30, 190, 375, 500] as const;
const DISENOS = [...patternCraftGradients, ...syntaxUIGradients];

function tipoDe(fondo: TBackground): TipoLienzo {
	if (fondo.type === "blur") return "desenfocar";
	return fondo.color.includes("gradient(") ? "diseno" : "color";
}

export function SeccionLienzo() {
	const editor = useEditor();
	const fondo = useEditor((e) => e.project.getActive().settings.background);
	const tipo = tipoDe(fondo);

	const poner = (background: TBackground, pushHistory = true) =>
		void editor.project.updateSettings({ settings: { background }, pushHistory });

	const cambiarTipo = (t: string) => {
		if (t === tipo) return;
		if (t === "desenfocar") poner({ type: "blur", blurIntensity: NIVELES_DESENFOQUE[1] });
		else if (t === "diseno") poner({ type: "color", color: DISENOS[0] ?? DEFAULT_BACKGROUND_COLOR });
		else poner({ type: "color", color: DEFAULT_BACKGROUND_COLOR });
	};

	return (
		<SeccionCe titulo="Lienzo" clave="ce:basico:lienzo">
			<FilaCe rotulo="Lienzo">
				<SelectCe
					valor={tipo}
					ariaLabel="Lienzo"
					opciones={[
						{ id: "color", etiqueta: "Color" },
						{ id: "desenfocar", etiqueta: "Desenfocar" },
						{ id: "diseno", etiqueta: "Diseño" },
					]}
					onCambio={cambiarTipo}
				/>
			</FilaCe>
			{/* La paleta del motor tiene 242 colores: va en una caja con scroll de ~4
			    filas para que el panel no se vuelva una pared de muestras. */}
			<div className="scrollbar-thin grid max-h-[148px] grid-cols-[repeat(auto-fill,minmax(30px,1fr))] gap-1.5 overflow-y-auto p-1">
				{tipo === "color" && fondo.type === "color" && (
					<>
						<ColorPropio
							actual={fondo.color}
							onPrevisualizar={(c) => poner({ type: "color", color: c }, false)}
							onConfirmar={(c) => poner({ type: "color", color: c })}
						/>
						{colors.map((c) => (
							<Muestra
								key={c}
								titulo={c}
								elegida={c.toLowerCase() === fondo.color.toLowerCase()}
								estilo={{ backgroundColor: c }}
								onClick={() => poner({ type: "color", color: c })}
							/>
						))}
					</>
				)}
				{tipo === "desenfocar" &&
					NIVELES_DESENFOQUE.map((nivel, i) => (
						<MuestraDesenfoque
							key={nivel}
							nivel={nivel}
							indice={i + 1}
							elegida={fondo.type === "blur" && fondo.blurIntensity === nivel}
							onClick={() => poner({ type: "blur", blurIntensity: nivel })}
						/>
					))}
				{tipo === "diseno" &&
					fondo.type === "color" &&
					DISENOS.map((g, i) => (
						<Muestra
							key={g}
							titulo={`Diseño ${i + 1}`}
							elegida={g === fondo.color}
							estilo={{ background: g, backgroundSize: "cover" }}
							onClick={() => poner({ type: "color", color: g })}
						/>
					))}
			</div>
		</SeccionCe>
	);
}

function Muestra({
	titulo,
	elegida,
	estilo,
	onClick,
}: {
	titulo: string;
	elegida: boolean;
	estilo: CSSProperties;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={titulo}
			aria-pressed={elegida}
			title={titulo}
			onClick={onClick}
			style={estilo}
			className={cn(
				"aspect-square w-full cursor-pointer rounded-[4px] border border-white/10",
				elegida && "outline-2 outline-offset-1 outline-primary",
			)}
		/>
	);
}

function ColorPropio({
	actual,
	onPrevisualizar,
	onConfirmar,
}: {
	actual: string;
	onPrevisualizar: (color: string) => void;
	onConfirmar: (color: string) => void;
}) {
	const propio = !colors.some((c) => c.toLowerCase() === actual.toLowerCase());
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="Color"
					title="Color"
					className={cn(
						"relative aspect-square w-full cursor-pointer overflow-hidden rounded-[4px] border border-white/10",
						propio && "outline-2 outline-offset-1 outline-primary",
					)}
					style={{
						background:
							"conic-gradient(from 180deg, #ff5e5e, #ffb35e, #fff26b, #6bff8f, #5ee7ff, #6f7cff, #d76bff, #ff5e9b)",
					}}
				>
					<span
						className="absolute right-0.5 bottom-0.5 size-2.5 rounded-[2px] border border-white/70"
						style={{ backgroundColor: actual }}
					/>
				</button>
			</PopoverTrigger>
			<ColorPickerContent
				value={actual.replace(/^#/, "").toUpperCase()}
				onChange={(c) => onPrevisualizar(`#${c}`)}
				onChangeEnd={(c) => onConfirmar(`#${c}`)}
			/>
		</Popover>
	);
}

const MuestraDesenfoque = memo(function MuestraDesenfoque({
	nivel,
	indice,
	elegida,
	onClick,
}: {
	nivel: number;
	indice: number;
	elegida: boolean;
	onClick: () => void;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const dibujar = () => {
			if (!canvas.current) return;
			effectPreviewService.renderPreview({
				effectType: "blur",
				params: { intensity: nivel },
				targetCanvas: canvas.current,
				uniformDimensions: { width: 1920, height: 1080 },
			});
		};
		dibujar();
		return effectPreviewService.onPreviewImageReady({ callback: dibujar });
	}, [nivel]);
	return (
		<button
			type="button"
			aria-label={`Desenfocar ${indice}`}
			aria-pressed={elegida}
			onClick={onClick}
			className={cn(
				"relative aspect-square w-full cursor-pointer overflow-hidden rounded-[4px] border border-white/10",
				elegida && "outline-2 outline-offset-1 outline-primary",
			)}
		>
			<canvas ref={canvas} className="absolute inset-0 size-full object-cover" />
			<span className="absolute right-0.5 bottom-0.5 rounded-[2px] bg-black/55 px-1 text-[10px] leading-tight text-white">
				{indice}
			</span>
		</button>
	);
});
