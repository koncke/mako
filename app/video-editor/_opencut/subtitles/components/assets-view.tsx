"use client";

// =============================================================================
// Biblioteca › Subtítulos: lo que se dibuja a la derecha de cada subcategoría
// =============================================================================
//   Subtítulos automáticos  Idioma de origen, Identificar las muletillas,
//                           ☐ Eliminar los subtítulos actuales y «Generar».
//   Plantillas              el estilo de TODOS los subtítulos (estilos.ts).
//   Subtítulos locales      importar SRT, LRC o ASS.
//   Agregar subtítulos      «Ingresar manualmente»: el texto se divide solo.
//
// Lo que CapCut tiene acá y no se hace en v1 se dibuja APAGADO con su rótulo:
// «Subtítulos bilingües» y «Resaltar palabras clave automáticamente» (fuera de
// alcance, docs/diseno-editor-video.md §1) y «Emojis de IA».
//
// Rótulos del es-LA.po de CapCut 9.3 (`pc_caption_menu_*`, `pc_materiallib_*`).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Checkbox } from "@/app/video-editor/_opencut/components/ui/checkbox";
import { Switch } from "@/app/video-editor/_opencut/components/ui/switch";
import { Textarea } from "@/app/video-editor/_opencut/components/ui/textarea";
import { Spinner } from "@/app/video-editor/_opencut/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import { SelectCe } from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import {
	GrillaBiblioteca,
	VacioBiblioteca,
	ZonaImportar,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { loadFonts } from "@/app/video-editor/_opencut/fonts/google-fonts";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { TRANSCRIPTION_DIAGNOSTICS_SCOPE } from "@/app/video-editor/_opencut/transcription/diagnostics";
import { LANGUAGES, ROTULO_DETECTAR } from "@/app/video-editor/_opencut/transcription/languages";
import type { TranscriptionLanguage } from "@/app/video-editor/_opencut/transcription/types";
import { dividirTextoEnSubtitulos } from "@/app/video-editor/_opencut/transcription/caption";
import { maxCaracteresPara } from "@/app/video-editor/_opencut/transcription/caption-defaults";
import { EXTENSIONES_SUBTITULOS, parseSubtitleFile } from "../parse";
import { PLANTILLAS_SUBTITULO, paramsDePlantilla, plantillaPorId, type PlantillaSubtitulo } from "../estilos";
import { usePreferenciasSubtitulos, useTrabajoSubtitulos } from "../estado";
import { cancelarGeneracion, generarSubtitulos } from "../generar";
import { aplicarEstiloASubtitulos, insertarSubtitulos, lienzoDe, subtitulosDe } from "../insert";

/** Ids de las secciones (ranura `seccionesBiblioteca`, ver ../registro.ts). */
export const SECCIONES_SUBTITULOS = {
	automaticos: "subtitulos.automaticos",
	plantillas: "subtitulos.plantillas",
	locales: "subtitulos.locales",
	agregar: "subtitulos.agregar",
} as const;

// ── Piezas ───────────────────────────────────────────────────────────────────

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-[12px] text-(--cc-text-2)">{rotulo}</span>
			{children}
		</div>
	);
}

function FilaInterruptor({
	rotulo,
	activo,
	onCambio,
	desactivado,
}: {
	rotulo: string;
	activo: boolean;
	onCambio?: (activo: boolean) => void;
	desactivado?: boolean;
}) {
	const fila = (
		<label
			className={cn(
				"flex min-h-7 items-center justify-between gap-3 text-[12px]",
				desactivado ? "cursor-default text-(--cc-text-3)" : "cursor-pointer text-(--cc-text-2)",
			)}
		>
			<span className="min-w-0">{rotulo}</span>
			<Switch
				checked={activo}
				disabled={desactivado}
				onCheckedChange={(v) => onCambio?.(v === true)}
				aria-label={rotulo}
			/>
		</label>
	);
	if (!desactivado) return fila;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div>{fila}</div>
			</TooltipTrigger>
			<TooltipContent side="top">Próximamente</TooltipContent>
		</Tooltip>
	);
}

/** El marco de una sección con pie fijo (el botón cian queda siempre a la vista). */
function ConPie({ children, pie }: { children: ReactNode; pie: ReactNode }) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">{children}</div>
			<div className="shrink-0 border-t border-(--cc-line-2) px-3 pt-2.5 pb-3">{pie}</div>
		</div>
	);
}

// ── Subtítulos automáticos ───────────────────────────────────────────────────

const OPCIONES_IDIOMA = [
	{ id: "auto", etiqueta: ROTULO_DETECTAR },
	...LANGUAGES.map((l) => ({ id: l.code, etiqueta: l.name })),
];

function rotuloProgreso(fase: string, progreso: number): string {
	switch (fase) {
		case "modelo":
			// La primera vez baja el modelo (~250 MB); después sale de la caché.
			return `Descargando… ${progreso} %`;
		case "transcribiendo":
			return `Generando subtítulos… ${progreso} %`;
		default:
			return "Generando subtítulos…";
	}
}

export function SubtitulosAutomaticosView() {
	const editor = useEditor();
	const prefs = usePreferenciasSubtitulos();
	const { fase, progreso, error } = useTrabajoSubtitulos();
	const diagnosticos = useEditor((e) =>
		e.diagnostics.getActive({ scope: TRANSCRIPTION_DIAGNOSTICS_SCOPE }),
	);
	const hayLinea = useEditor((e) => e.timeline.getTotalDuration() > 0);
	const generando = fase !== "inactivo";
	const sinAudio = diagnosticos.length > 0;

	return (
		<ConPie
			pie={
				<div className="flex flex-col gap-2.5">
					<label className="flex cursor-pointer items-center gap-2 text-[12px] text-(--cc-text-2)">
						<Checkbox
							checked={prefs.eliminarActuales}
							onCheckedChange={(v) => prefs.fijar({ eliminarActuales: v === true })}
							disabled={generando}
						/>
						Eliminar los subtítulos actuales
					</label>
					{generando ? (
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between gap-2 text-[12px] text-(--cc-text-2)">
								<span className="flex min-w-0 items-center gap-1.5">
									<Spinner className="size-3.5 shrink-0" />
									<span className="truncate">{rotuloProgreso(fase, progreso)}</span>
								</span>
								<button
									type="button"
									onClick={cancelarGeneracion}
									className="shrink-0 cursor-pointer text-(--cc-text-3) hover:text-(--cc-text)"
								>
									Cancelar
								</button>
							</div>
							<span className="block h-1 w-full overflow-hidden rounded-full bg-(--cc-raised)">
								<span
									className="block h-full rounded-full bg-primary transition-[width]"
									style={{ width: `${fase === "audio" || fase === "armando" ? 100 : progreso}%` }}
								/>
							</span>
						</div>
					) : (
						<Button
							type="button"
							className="w-full"
							disabled={!hayLinea || sinAudio}
							onClick={() => void generarSubtitulos(editor)}
						>
							Generar
						</Button>
					)}
					{!generando && (error || sinAudio) && (
						<p className="text-[11px] text-(--cc-text-3)" role="status">
							{error ?? diagnosticos[0]?.message}
						</p>
					)}
				</div>
			}
		>
			<div className="flex flex-col gap-4">
				<Campo rotulo="Idioma de origen">
					<SelectCe
						valor={prefs.idioma}
						opciones={OPCIONES_IDIOMA}
						onCambio={(id) => prefs.fijar({ idioma: id as TranscriptionLanguage })}
						ariaLabel="Idioma de origen"
					/>
				</Campo>
				<Campo rotulo="Subtítulos bilingües">
					<Tooltip>
						<TooltipTrigger asChild>
							<div>
								<SelectCe
									valor="ninguno"
									opciones={[{ id: "ninguno", etiqueta: "Ninguno" }]}
									onCambio={() => {}}
									ariaLabel="Subtítulos bilingües"
									className="pointer-events-none opacity-50"
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent side="top">Próximamente</TooltipContent>
					</Tooltip>
				</Campo>
				<div className="flex flex-col gap-1">
					<FilaInterruptor rotulo="Resaltar palabras clave automáticamente" activo={false} desactivado />
					<FilaInterruptor rotulo="Emojis de IA" activo={false} desactivado />
					<FilaInterruptor
						rotulo="Identificar las muletillas"
						activo={prefs.muletillas}
						onCambio={(v) => prefs.fijar({ muletillas: v })}
					/>
				</div>
			</div>
		</ConPie>
	);
}

// ── Plantillas ───────────────────────────────────────────────────────────────

function MiniaturaPlantilla({
	plantilla,
	elegida,
	onElegir,
}: {
	plantilla: PlantillaSubtitulo;
	elegida: boolean;
	onElegir: () => void;
}) {
	const escala = plantilla.escala ?? 1;
	return (
		<button
			type="button"
			onClick={onElegir}
			aria-pressed={elegida}
			aria-label={plantilla.nombre}
			title={plantilla.nombre}
			className={cn(
				"flex aspect-[16/10] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[6px] bg-(--cc-sunken) outline-none",
				"ring-1 focus-visible:ring-2 focus-visible:ring-primary",
				elegida ? "ring-2 ring-primary" : "ring-transparent hover:ring-(--cc-text-3)",
			)}
		>
			{/* Los colores son los de la plantilla: es una muestra de lo que escribe. */}
			<span
				className="max-w-[90%] truncate leading-tight"
				style={{
					fontFamily: `"${plantilla.fuente}", sans-serif`,
					fontWeight: plantilla.negrita ? 700 : 400,
					fontSize: `${Math.round(13 * escala)}px`,
					letterSpacing: plantilla.espaciado ? `${plantilla.espaciado * 0.5}px` : undefined,
					color: plantilla.color,
					background: plantilla.fondo?.color,
					borderRadius: plantilla.fondo ? `${Math.round(plantilla.fondo.radio / 8)}px` : undefined,
					padding: plantilla.fondo ? "2px 6px" : undefined,
				}}
			>
				Subtítulos
			</span>
		</button>
	);
}

export function PlantillasSubtitulosView() {
	const editor = useEditor();
	const elegida = usePreferenciasSubtitulos((s) => s.plantilla);
	const fijar = usePreferenciasSubtitulos((s) => s.fijar);
	const haySubtitulos = useEditor(
		(e) => subtitulosDe(e.scenes.getActiveSceneOrNull()?.tracks).length > 0,
	);
	const [aplicando, setAplicando] = useState(false);

	// Las fuentes de las miniaturas (Google Fonts; las mismas que usa el render).
	useEffect(() => {
		void loadFonts({ families: [...new Set(PLANTILLAS_SUBTITULO.map((p) => p.fuente))] }).catch(
			() => {},
		);
	}, []);

	const elegir = async (plantilla: PlantillaSubtitulo) => {
		fijar({ plantilla: plantilla.id });
		if (!haySubtitulos || aplicando) return;
		setAplicando(true);
		try {
			const n = await aplicarEstiloASubtitulos({
				editor,
				estilo: paramsDePlantilla(plantilla, lienzoDe(editor)),
			});
			// `apply_to_all_subtitle`.
			if (n > 0) toast.success("Se aplicó a todos los subtítulos");
		} finally {
			setAplicando(false);
		}
	};

	return (
		<div className="scrollbar-thin h-full overflow-y-auto p-3">
			<GrillaBiblioteca minimo={84}>
				{PLANTILLAS_SUBTITULO.map((p) => (
					<MiniaturaPlantilla
						key={p.id}
						plantilla={p}
						elegida={p.id === elegida}
						onElegir={() => void elegir(p)}
					/>
				))}
			</GrillaBiblioteca>
		</div>
	);
}

// ── Subtítulos locales ───────────────────────────────────────────────────────

export function SubtitulosLocalesView() {
	const editor = useEditor();
	const plantilla = usePreferenciasSubtitulos((s) => s.plantilla);
	const input = useRef<HTMLInputElement>(null);
	const [procesando, setProcesando] = useState(false);
	const [encima, setEncima] = useState(false);

	const importar = async (archivo: File | undefined) => {
		if (!archivo || procesando) return;
		setProcesando(true);
		try {
			const resultado = parseSubtitleFile({ fileName: archivo.name, input: await archivo.text() });
			if (resultado.warnings.length > 0) console.info("[subtítulos] importados con avisos", resultado.warnings);
			if (resultado.captions.length === 0) {
				toast.error("No se pudo importar");
				return;
			}
			const n = await insertarSubtitulos({
				editor,
				captions: resultado.captions,
				estilo: paramsDePlantilla(plantillaPorId(plantilla), lienzoDe(editor)),
			});
			// `pc_ai_writer_has_been_add`.
			if (n > 0) toast.success("Subtítulos agregados");
		} catch (error) {
			console.error("[subtítulos] no se pudo importar", error);
			// `file_type_not_supported` / `pc_import_failed`.
			toast.error(
				error instanceof Error && error.name === "FormatoNoAdmitido"
					? "Formato no admitido"
					: "No se pudo importar",
			);
		} finally {
			setProcesando(false);
		}
	};

	return (
		<div
			className="h-full p-3"
			onDragOver={(e) => {
				if (e.dataTransfer.types.includes("Files")) {
					e.preventDefault();
					setEncima(true);
				}
			}}
			onDragLeave={() => setEncima(false)}
			onDrop={(e) => {
				if (!e.dataTransfer.files.length) return;
				e.preventDefault();
				setEncima(false);
				void importar(e.dataTransfer.files[0]);
			}}
		>
			<input
				ref={input}
				type="file"
				accept={EXTENSIONES_SUBTITULOS.join(",")}
				className="hidden"
				onChange={(e) => {
					const archivo = e.target.files?.[0];
					e.target.value = "";
					void importar(archivo);
				}}
			/>
			<ZonaImportar
				// `pc_caption_menu_drag_support_format`.
				texto="Arrastra y suelta el archivo aquí o haz clic para importar. Los tipos de archivos admitidos son SRT, LRC y ASS"
				// Sin `procesando`: leer un SRT es instantáneo y la zona mostraría «0 %».
				onClick={() => {
					if (!procesando) input.current?.click();
				}}
				resaltada={encima}
			/>
		</div>
	);
}

// ── Agregar subtítulos (Ingresar manualmente) ────────────────────────────────

export function AgregarSubtitulosView() {
	const editor = useEditor();
	const plantilla = usePreferenciasSubtitulos((s) => s.plantilla);
	const [texto, setTexto] = useState("");
	const [procesando, setProcesando] = useState(false);
	const hayProyecto = useEditor((e) => e.scenes.getActiveSceneOrNull() != null);

	const dividir = async () => {
		const limpio = texto.trim();
		if (!limpio || procesando) return;
		setProcesando(true);
		try {
			const lienzo = lienzoDe(editor);
			const inicio = editor.playback.getCurrentTime() / TICKS_PER_SECOND;
			const captions = dividirTextoEnSubtitulos({
				texto: limpio,
				inicio,
				maxCaracteres: maxCaracteresPara(lienzo),
			});
			const n = await insertarSubtitulos({
				editor,
				captions,
				estilo: paramsDePlantilla(plantillaPorId(plantilla), lienzo),
			});
			if (n > 0) {
				setTexto("");
				toast.success("Subtítulos agregados");
			}
		} finally {
			setProcesando(false);
		}
	};

	if (!hayProyecto) return <VacioBiblioteca texto="No hay contenido" />;

	return (
		<ConPie
			pie={
				<Button
					type="button"
					className="w-full"
					disabled={!texto.trim() || procesando}
					onClick={() => void dividir()}
				>
					{procesando && <Spinner className="size-3.5" />}
					Dividir en subtítulos
				</Button>
			}
		>
			<div className="flex h-full flex-col gap-2">
				<div className="flex flex-col gap-0.5">
					<span className="text-[13px] font-medium text-(--cc-text)">Ingresar manualmente</span>
					<span className="text-[11px] text-(--cc-text-3)">
						El texto se dividirá en subtítulos automáticamente.
					</span>
				</div>
				<Textarea
					value={texto}
					onChange={(e) => setTexto(e.target.value)}
					placeholder="Introduce el texto aquí, o pega el texto relacionado con el audio o el video"
					className="min-h-40 flex-1 text-[12px]"
				/>
			</div>
		</ConPie>
	);
}
