"use client";

// =============================================================================
// Panel derecho › Texto (Básico · Efectos) — el texto elegido, como en CapCut
// =============================================================================
// Básico, en el orden de CapCut 9.3 (relevamiento §4.1 y armazón §5):
//   la caja de texto · Fuente · Tamaño de la fuente · Diseño (negrita, cursiva,
//   subrayado) · May./min. (TT tt Tt) · Color · Espaciado (Carácter / Línea) ·
//   Alinear · ☐ Trazo · ☐ Fondo · ☐ Sombra · ☐ Brillo · ☐ Curva ·
//   Transformación · Mezcla y abajo «Guardar como parámetro predefinido».
// Efectos: «Mis elementos predefinidos» (si hay) y la grilla de efectos de
//   texto (../estilos-predefinidos.ts), con «Ninguno» primero.
//
// Los rótulos salen del es-LA.po de CapCut 9.3 (la clave al lado, en los
// comentarios); «Cursiva» y «Subrayado» no están en el .po (CapCut muestra sólo
// el ícono) y son nuestros. Transformación y Mezcla son las de Video › Básico
// (paquete del panel), que CapCut repite igual en el texto.
//
// El ◇ va sólo donde el render anima de verdad: color, color del fondo, sus
// esquinas, alto, ancho y desplazamiento (text/measure-element.ts los resuelve
// en el tiempo). Tamaño, espaciado, trazo y sombra se dibujan con el valor
// base: un ◇ ahí crearía fotogramas que no hacen nada.

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from "lucide-react";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { ColorPicker } from "@/app/video-editor/_opencut/components/ui/color-picker";
import { FontPicker } from "@/app/video-editor/_opencut/components/ui/font-picker";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import { loadFonts } from "@/app/video-editor/_opencut/fonts/google-fonts";
import type { ParamValue } from "@/app/video-editor/_opencut/params";
import {
	getElementParam,
	type ElementParamDefinition,
} from "@/app/video-editor/_opencut/params/registry";
import { TEXTO, type Mayusculas, type PosicionTrazo } from "@/app/video-editor/_opencut/params/extra/texto";
import { curvaBloqueada } from "@/app/video-editor/_opencut/text/estilo";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { MAX_FONT_SIZE } from "@/app/video-editor/_opencut/text/typography";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import {
	AccionesGrupo,
	CajaNumero,
	CampoParam,
	DeslizadorValor,
	SeccionCe,
	SegmentadoCe,
	useParamsConFotogramas,
	type ParamsConFotogramas,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import {
	SeccionMezcla,
	SeccionTransformacion,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/video/basico";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import {
	CLAVES_ESTILO,
	EFECTOS_TEXTO,
	SIN_EFECTO,
	estiloDeParams,
	type ParamsTexto,
} from "../estilos-predefinidos";
import {
	MAXIMO_ESTILOS,
	borrarEstilo,
	guardarEstilo,
	useEstilosGuardados,
	type EstiloGuardado,
} from "../predefinidos";
import { MiniaturaEstilo } from "./miniatura-estilo";
import { useRepartirSubtitulo } from "@/app/video-editor/_opencut/subtitles/repartir";

// ── Piezas ───────────────────────────────────────────────────────────────────

function useGrupo(element: TimelineElement, trackId: string, claves: readonly string[]) {
	const params = claves
		.map((key) => getElementParam({ element, key }))
		.filter((p): p is ElementParamDefinition => p !== null);
	return useParamsConFotogramas({ element, trackId, params });
}

/**
 * Una fila con la columna de rótulo un poco más ancha que la del kit, y que
 * parte en dos renglones en vez de cortar: los rótulos de CapCut del texto son
 * largos («Esquinas redondeadas», «Tamaño de la fuente») y en 76 px de un
 * renglón quedaban «Esquinas red…».
 */
function Fila({
	rotulo,
	children,
	acciones,
}: {
	rotulo: string;
	children: ReactNode;
	acciones?: ReactNode;
}) {
	return (
		<div className="flex min-h-[38px] items-center gap-2">
			<div className="line-clamp-2 w-[88px] shrink-0 text-[12px] leading-[1.25] text-(--cc-text-2)" title={rotulo}>
				{rotulo}
			</div>
			<div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
			<div className="flex w-[66px] shrink-0 items-center justify-end gap-0.5">{acciones}</div>
		</div>
	);
}

const ANIMADOS = new Set([
	"color",
	"background.color",
	"background.cornerRadius",
	"background.paddingX",
	"background.paddingY",
	"background.offsetX",
	"background.offsetY",
]);

function FilaNumero({
	element,
	trackId,
	clave,
	rotulo,
	min,
	max,
	paso = 1,
	sufijo,
}: {
	element: TimelineElement;
	trackId: string;
	clave: string;
	rotulo: string;
	min: number;
	max: number;
	paso?: number;
	sufijo?: string;
}) {
	const grupo = useGrupo(element, trackId, [clave]);
	const v = grupo.valores[clave];
	return (
		<Fila rotulo={rotulo} acciones={<AccionesGrupo grupo={grupo} animable={ANIMADOS.has(clave)} />}>
			<DeslizadorValor
				valor={typeof v === "number" ? v : Number(v ?? 0)}
				min={min}
				max={max}
				paso={paso}
				sufijo={sufijo}
				ariaLabel={rotulo}
				onPrevisualizar={(n) => grupo.previsualizar({ [clave]: n })}
				onConfirmar={grupo.confirmar}
			/>
		</Fila>
	);
}

function FilaColor({
	element,
	trackId,
	clave,
	rotulo = "Color",
}: {
	element: TimelineElement;
	trackId: string;
	clave: string;
	rotulo?: string;
}) {
	const grupo = useGrupo(element, trackId, [clave]);
	const valor = String(grupo.valores[clave] ?? "#ffffff");
	return (
		<Fila rotulo={rotulo} acciones={<AccionesGrupo grupo={grupo} animable={ANIMADOS.has(clave)} />}>
			<ColorPicker
				className="w-full"
				value={valor.replace(/^#/, "").toUpperCase()}
				onChange={(c) => grupo.previsualizar({ [clave]: `#${c}` })}
				onChangeEnd={(c) => grupo.aplicar({ [clave]: `#${c}` })}
			/>
		</Fila>
	);
}

function BotonAlternar({
	titulo,
	activo,
	onClick,
	children,
}: {
	titulo: string;
	activo: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={titulo}
					aria-pressed={activo}
					onClick={onClick}
					className={cn(
						"flex h-[26px] min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[4px] text-[12px] transition-colors",
						activo
							? "bg-(--cc-raised) text-primary"
							: "bg-(--cc-sunken) text-(--cc-icon) hover:text-foreground",
					)}
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent side="top">{titulo}</TooltipContent>
		</Tooltip>
	);
}

// ── Básico ───────────────────────────────────────────────────────────────────

const OPCIONES_MAYUSCULAS: { id: Exclude<Mayusculas, "ninguno">; glifo: string; titulo: string }[] = [
	// `pc_capitalization_all_uppercase` / `_all_lowercase` / `_capitalize_first_letter`.
	{ id: "mayusculas", glifo: "TT", titulo: "Mayúscula" },
	{ id: "minusculas", glifo: "tt", titulo: "Minúscula" },
	{ id: "titulo", glifo: "Tt", titulo: "Tipo título" },
];

const OPCIONES_ALINEAR = [
	// `pc_align_left` / `pc_align_title_center` (el .po dice «Alinar»: errata
	// corregida, hallazgos → «Los textos de CapCut») / `pc_align_right`.
	{ id: "left", titulo: "Alinear a la izquierda", Icono: AlignLeft },
	{ id: "center", titulo: "Alinear al centro", Icono: AlignCenter },
	{ id: "right", titulo: "Alinear a la derecha", Icono: AlignRight },
] as const;

const POSICIONES_TRAZO: { id: PosicionTrazo; etiqueta: string }[] = [
	// `CC_PC_material_text_effect_stroke_position_{in,middle,out}`.
	{ id: "dentro", etiqueta: "Dentro" },
	{ id: "centro", etiqueta: "Centro" },
	{ id: "fuera", etiqueta: "Fuera" },
];

function SeccionCasilla({
	element,
	trackId,
	clave,
	titulo,
	children,
}: {
	element: TimelineElement;
	trackId: string;
	clave: string;
	titulo: string;
	children: ReactNode;
}) {
	const grupo = useGrupo(element, trackId, [clave]);
	const marcada = grupo.valores[clave] === true;
	return (
		<SeccionCe
			titulo={titulo}
			clave={`ce:texto:${clave}`}
			casilla={{ marcada, onCambio: (v) => grupo.aplicar({ [clave]: v }) }}
		>
			{marcada ? children : null}
		</SeccionCe>
	);
}

export function TextoBasico({ element, track }: ContextoInspector) {
	const trackId = track.id;
	// Un subtítulo se vuelve a partir si cambia la fuente o el tamaño (subtitles/repartir.ts).
	useRepartirSubtitulo({ element, trackId });
	const tipo = useGrupo(element, trackId, [
		"fontFamily",
		"fontWeight",
		"fontStyle",
		"textDecoration",
		"textAlign",
		TEXTO.mayusculas,
	]);
	const espaciado = useGrupo(element, trackId, ["letterSpacing", "lineHeight"]);
	const tamano = useGrupo(element, trackId, ["fontSize"]);
	const posicionTrazo = useGrupo(element, trackId, [TEXTO.trazoPosicion]);
	const v = tipo.valores;

	const fuente = String(v.fontFamily ?? "Arial");
	const negrita = v.fontWeight === "bold";
	const cursiva = v.fontStyle === "italic";
	const subrayado = v.textDecoration === "underline";
	const mayusculas = String(v[TEXTO.mayusculas] ?? "ninguno");
	const alineacion = String(v.textAlign ?? "center");
	const tamanoValor = typeof tamano.valores.fontSize === "number" ? tamano.valores.fontSize : 15;
	const numero = (g: ParamsConFotogramas, clave: string, fallback: number) => {
		const n = g.valores[clave];
		return typeof n === "number" ? n : fallback;
	};

	return (
		<div className="flex flex-col pt-1">
			<SeccionCe titulo="Básico" clave="ce:texto:basico">
				{/* La caja de texto (sin rótulo, como CapCut). */}
				<CampoParam element={element} trackId={trackId} clave="content" />

				{/* `font`: el selector de fuentes del motor (Google Fonts). */}
				<Fila rotulo="Fuente">
					<div className="min-w-0 flex-1">
						<FontPicker
							defaultValue={fuente}
							onValueChange={(familia) => tipo.aplicar({ fontFamily: familia })}
						/>
					</div>
				</Fila>

				{/* `font_size`: 1–300, como CapCut. */}
				<Fila rotulo="Tamaño de la fuente" acciones={<AccionesGrupo grupo={tamano} animable={false} />}>
					<DeslizadorValor
						valor={tamanoValor}
						min={1}
						max={MAX_FONT_SIZE}
						paso={1}
						ariaLabel="Tamaño de la fuente"
						onPrevisualizar={(n) => tamano.previsualizar({ fontSize: n })}
						onConfirmar={tamano.confirmar}
					/>
				</Fila>

				{/* `pc_new_basic_pattern`: «Diseño» (negrita, cursiva, subrayado). */}
				<Fila rotulo="Diseño">
					<div className="flex flex-1 gap-1">
						<BotonAlternar
							titulo="Negrita"
							activo={negrita}
							onClick={() => tipo.aplicar({ fontWeight: negrita ? "normal" : "bold" })}
						>
							<Bold className="size-3.5" />
						</BotonAlternar>
						<BotonAlternar
							titulo="Cursiva"
							activo={cursiva}
							onClick={() => tipo.aplicar({ fontStyle: cursiva ? "normal" : "italic" })}
						>
							<Italic className="size-3.5" />
						</BotonAlternar>
						<BotonAlternar
							titulo="Subrayado"
							activo={subrayado}
							onClick={() => tipo.aplicar({ textDecoration: subrayado ? "none" : "underline" })}
						>
							<Underline className="size-3.5" />
						</BotonAlternar>
					</div>
				</Fila>

				{/* `pc_capitalization_capitalize`: «May./min.». Tocar la elegida la saca. */}
				<Fila rotulo="May./min.">
					<div className="flex flex-1 gap-1">
						{OPCIONES_MAYUSCULAS.map((op) => (
							<BotonAlternar
								key={op.id}
								titulo={op.titulo}
								activo={mayusculas === op.id}
								onClick={() =>
									tipo.aplicar({ [TEXTO.mayusculas]: mayusculas === op.id ? "ninguno" : op.id })
								}
							>
								<span className="font-semibold">{op.glifo}</span>
							</BotonAlternar>
						))}
					</div>
				</Fila>

				<FilaColor element={element} trackId={trackId} clave="color" />

				{/* «Espaciado» (`arrangement`) con «Carácter» y «Línea» (`pc_word_soacing`, `pc_line_spacing`). */}
				<Fila rotulo="Espaciado" acciones={<AccionesGrupo grupo={espaciado} animable={false} />}>
					<div className="flex min-w-0 flex-1 items-center gap-1.5">
						<span className="shrink-0 text-[11px] text-(--cc-text-3)">Carácter</span>
						<CajaNumero
							className="w-[58px]"
							valor={numero(espaciado, "letterSpacing", 0)}
							min={-20}
							max={100}
							paso={1}
							ariaLabel="Espaciado entre caracteres"
							onPrevisualizar={(n) => espaciado.previsualizar({ letterSpacing: n })}
							onConfirmar={espaciado.confirmar}
						/>
						<span className="shrink-0 text-[11px] text-(--cc-text-3)">Línea</span>
						<CajaNumero
							className="w-[58px]"
							valor={numero(espaciado, "lineHeight", 1.2)}
							min={0.5}
							max={4}
							paso={0.1}
							ariaLabel="Interlineado"
							onPrevisualizar={(n) => espaciado.previsualizar({ lineHeight: n })}
							onConfirmar={espaciado.confirmar}
						/>
					</div>
				</Fila>

				{/* `pc_text_align`: «Alinear». */}
				<Fila rotulo="Alinear">
					<div className="flex flex-1 gap-1">
						{OPCIONES_ALINEAR.map(({ id, titulo, Icono }) => (
							<BotonAlternar
								key={id}
								titulo={titulo}
								activo={alineacion === id}
								onClick={() => tipo.aplicar({ textAlign: id })}
							>
								<Icono className="size-3.5" />
							</BotonAlternar>
						))}
					</div>
				</Fila>
			</SeccionCe>

			{/* `pc_charts_stroke`: «Trazo» (Color, Grosor `thickness`, Posición). */}
			<SeccionCasilla element={element} trackId={trackId} clave={TEXTO.trazoActivo} titulo="Trazo">
				<FilaColor element={element} trackId={trackId} clave={TEXTO.trazoColor} />
				<FilaNumero element={element} trackId={trackId} clave={TEXTO.trazoGrosor} rotulo="Grosor" min={0} max={100} />
				<Fila rotulo="Posición" acciones={<AccionesGrupo grupo={posicionTrazo} animable={false} />}>
					<SegmentadoCe
						className="flex-1"
						opciones={POSICIONES_TRAZO}
						valor={String(posicionTrazo.valores[TEXTO.trazoPosicion] ?? "fuera")}
						onCambio={(id) => posicionTrazo.aplicar({ [TEXTO.trazoPosicion]: id })}
					/>
				</Fila>
			</SeccionCasilla>

			{/* «Fondo»: Color, Opacidad, Esquinas redondeadas (`circle_angle`), Alto
			    (`vertical_pc`), Ancho (`level_pc`), Horizontal y Vertical. */}
			<SeccionCasilla element={element} trackId={trackId} clave="background.enabled" titulo="Fondo">
				<FilaColor element={element} trackId={trackId} clave="background.color" />
				<FilaNumero element={element} trackId={trackId} clave={TEXTO.fondoOpacidad} rotulo="Opacidad" min={0} max={100} sufijo="%" />
				<FilaNumero element={element} trackId={trackId} clave="background.cornerRadius" rotulo="Esquinas redondeadas" min={0} max={100} />
				<FilaNumero element={element} trackId={trackId} clave="background.paddingY" rotulo="Alto" min={0} max={200} />
				<FilaNumero element={element} trackId={trackId} clave="background.paddingX" rotulo="Ancho" min={0} max={200} />
				<FilaNumero element={element} trackId={trackId} clave="background.offsetX" rotulo="Horizontal" min={-300} max={300} />
				<FilaNumero element={element} trackId={trackId} clave="background.offsetY" rotulo="Vertical" min={-300} max={300} />
			</SeccionCasilla>

			{/* `pc_shadow`: «Sombra» (Color, Opacidad, Desenfocar, Distancia, Ángulo). */}
			<SeccionCasilla element={element} trackId={trackId} clave={TEXTO.sombraActiva} titulo="Sombra">
				<FilaColor element={element} trackId={trackId} clave={TEXTO.sombraColor} />
				<FilaNumero element={element} trackId={trackId} clave={TEXTO.sombraOpacidad} rotulo="Opacidad" min={0} max={100} sufijo="%" />
				<FilaNumero element={element} trackId={trackId} clave={TEXTO.sombraDesenfoque} rotulo="Desenfocar" min={0} max={100} />
				<FilaNumero element={element} trackId={trackId} clave={TEXTO.sombraDistancia} rotulo="Distancia" min={0} max={100} />
				<FilaNumero element={element} trackId={trackId} clave={TEXTO.sombraAngulo} rotulo="Ángulo" min={-180} max={180} sufijo="°" />
			</SeccionCasilla>

			{/* `pc_glow_effect`: «Brillo» (Color, Intensidad, Intervalo). */}
			<SeccionCasilla element={element} trackId={trackId} clave={TEXTO.brilloActivo} titulo="Brillo">
				<FilaColor element={element} trackId={trackId} clave={TEXTO.brilloColor} />
				<FilaNumero element={element} trackId={trackId} clave={TEXTO.brilloIntensidad} rotulo="Intensidad" min={0} max={100} />
				<FilaNumero element={element} trackId={trackId} clave={TEXTO.brilloIntervalo} rotulo="Intervalo" min={0} max={100} />
			</SeccionCasilla>

			<SeccionCurva element={element} trackId={trackId} />

			<SeccionTransformacion element={element} trackId={trackId} />
			<SeccionMezcla element={element} trackId={trackId} />

			<div className="px-4 pt-2 pb-4">
				<BotonGuardarPredefinido element={element} />
			</div>
		</div>
	);
}

/**
 * `pc_text_bend`: «Curva» › «Fuerza». CapCut no curva un texto con fondo ni
 * subrayado: marcarla así avisa por qué y no la prende; si ya estaba y después
 * se prendió el fondo, el texto se dibuja recto (text/estilo.ts) y la sección
 * dice por qué en vez de mostrar una Fuerza que no hace nada.
 */
function SeccionCurva({ element, trackId }: { element: TimelineElement; trackId: string }) {
	const grupo = useGrupo(element, trackId, [TEXTO.curvaActiva, "background.enabled", "textDecoration"]);
	const marcada = grupo.valores[TEXTO.curvaActiva] === true;
	const motivo = curvaBloqueada(grupo.valores);
	return (
		<SeccionCe
			titulo="Curva"
			clave="ce:texto:curva"
			casilla={{
				marcada,
				onCambio: (v) => {
					if (v && motivo) {
						toast.error(motivo);
						return;
					}
					grupo.aplicar({ [TEXTO.curvaActiva]: v });
				},
			}}
		>
			{marcada ? (
				motivo ? (
					<p className="py-1.5 text-[12px] text-(--cc-text-3)">{motivo}</p>
				) : (
					<FilaNumero element={element} trackId={trackId} clave={TEXTO.curvaFuerza} rotulo="Fuerza" min={-100} max={100} />
				)
			) : null}
		</SeccionCe>
	);
}

/** El nombre de un predefinido: lo que dice el texto, corto (CapCut no pregunta). */
function nombreDe(element: TimelineElement): string {
	const contenido = "params" in element ? String(element.params.content ?? "") : "";
	const linea = contenido.split("\n")[0]?.trim() ?? "";
	return linea.length > 24 ? `${linea.slice(0, 24)}…` : linea || "Texto";
}

function BotonGuardarPredefinido({ element }: { element: TimelineElement }) {
	const guardar = () => {
		if (!("params" in element)) return;
		const resultado = guardarEstilo({ nombre: nombreDe(element), params: estiloDeParams(element.params) });
		// `pc_ai_media_saved_toast` / `pc_brand_text_preset_twohundred`.
		if (resultado === "guardado") toast.success("Se guardó");
		else if (resultado === "lleno") toast.error(`Puedes agregar hasta ${MAXIMO_ESTILOS} textos predefinidos`);
		else toast.error("No se pudo guardar");
	};
	return (
		<button
			type="button"
			onClick={guardar}
			className="h-8 w-full cursor-pointer rounded-[5px] bg-primary px-3 text-[12px] font-medium text-white transition hover:brightness-110"
		>
			Guardar como parámetro predefinido
		</button>
	);
}

// ── Efectos ──────────────────────────────────────────────────────────────────

const igual = (a: ParamValue | undefined, b: ParamValue) =>
	typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b;

/** ¿El texto tiene puesto este estilo? (todas sus claves, iguales). */
function coincide(valores: Record<string, ParamValue>, params: ParamsTexto): boolean {
	return Object.entries(params).every(([k, val]) => igual(valores[k], val));
}

function TarjetaEstilo({
	nombre,
	params,
	activa,
	onElegir,
	accion,
	texto,
}: {
	nombre: string;
	params: ParamsTexto;
	activa: boolean;
	onElegir: () => void;
	accion?: ReactNode;
	texto?: string;
}) {
	return (
		<div className="group relative">
			<button
				type="button"
				aria-pressed={activa}
				aria-label={nombre}
				title={nombre}
				onClick={onElegir}
				className={cn(
					"block aspect-square w-full cursor-pointer overflow-hidden rounded-[5px] border transition-colors",
					activa ? "border-primary" : "border-transparent hover:border-(--cc-line-2)",
				)}
			>
				<MiniaturaEstilo params={params} texto={texto} />
			</button>
			{accion}
		</div>
	);
}

export function TextoEfectos({ element, track }: ContextoInspector) {
	const grupo = useGrupo(element, track.id, CLAVES_ESTILO);
	useRepartirSubtitulo({ element, trackId: track.id });
	const guardados = useEstilosGuardados();
	const [cargando, setCargando] = useState(false);

	/**
	 * Un efecto con fondo sobre un texto curvado: CapCut no lo aplica y avisa
	 * (`pc_text_bend_edit_unavailable`). Aplicarlo enderezaría el texto sin que
	 * nadie lo pidiera.
	 */
	const aplicarEfecto = (params: ParamsTexto) => {
		const curvado = grupo.valores[TEXTO.curvaActiva] === true && !curvaBloqueada(grupo.valores);
		// Un predefinido guardado trae su curva: si la apaga, el fondo sí entra.
		const sigueCurvado = (params[TEXTO.curvaActiva] ?? grupo.valores[TEXTO.curvaActiva]) === true;
		if (curvado && sigueCurvado && params["background.enabled"] === true) {
			toast.error("No se puede aplicar este efecto al texto curvado");
			return;
		}
		grupo.aplicar(params);
	};

	const aplicarGuardado = async (estilo: EstiloGuardado) => {
		if (cargando) return;
		setCargando(true);
		try {
			const familia = estilo.params.fontFamily;
			if (typeof familia === "string") {
				// Antes de dibujar: con la de respaldo, la primera textura saldría con otra letra.
				await loadFonts({ families: [familia] }).catch(() => {});
			}
			aplicarEfecto(estilo.params);
		} finally {
			setCargando(false);
		}
	};

	const ninguno = coincide(grupo.valores, SIN_EFECTO);

	return (
		<div className="flex flex-col gap-3 px-4 pt-3 pb-4">
			{guardados.length > 0 && (
				<section className="flex flex-col gap-2">
					{/* `my_default`. */}
					<h3 className="text-[12px] text-(--cc-text-2)">Mis elementos predefinidos</h3>
					<div className="grid grid-cols-4 gap-2">
						{guardados.map((e) => (
							<TarjetaEstilo
								key={e.id}
								nombre={e.nombre}
								params={e.params}
								activa={coincide(grupo.valores, e.params)}
								onElegir={() => void aplicarGuardado(e)}
								accion={
									<button
										type="button"
										// `brand_delete`.
										aria-label={`Eliminar «${e.nombre}»`}
										title="Eliminar"
										onClick={() => borrarEstilo(e.id)}
										className="absolute top-1 right-1 flex size-5 cursor-pointer items-center justify-center rounded-[4px] bg-(--cc-panel) opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
									>
										<IconoBorrar size={12} />
									</button>
								}
							/>
						))}
					</div>
				</section>
			)}
			<section className="flex flex-col gap-2">
				{guardados.length > 0 && <h3 className="text-[12px] text-(--cc-text-2)">Efectos de texto</h3>}
				<div className="grid grid-cols-4 gap-2">
					<TarjetaEstilo
						nombre="Ninguno"
						params={SIN_EFECTO}
						activa={ninguno}
						onElegir={() => grupo.aplicar(SIN_EFECTO)}
					/>
					{EFECTOS_TEXTO.map((ef) => (
						<TarjetaEstilo
							key={ef.id}
							nombre={ef.nombre}
							params={ef.params}
							activa={!ninguno && coincide(grupo.valores, ef.params)}
							onElegir={() => aplicarEfecto(ef.params)}
						/>
					))}
				</div>
			</section>
		</div>
	);
}
