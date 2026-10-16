"use client";

// =============================================================================
// El diálogo «Exportar» de CapCut (relevamiento-capcut-armazon.md §9)
// =============================================================================
// Dos columnas: la portada (el primer cuadro) a la izquierda y el formulario a
// la derecha: Nombre, Exportar a, y tres secciones con casilla —Video, Audio,
// Subtítulos— más «Exportar GIF». Abajo, «Duración: 11s | Tamaño: alrededor de
// 82 MB» estimado en vivo y Exportar / Cancelar. Las medidas son las de la
// captura oficial ÷1,25 (1078×845 → 862×676).
//
// Los textos son los del es-LA.po de CapCut 9.3 (claves al lado). El pie usa
// `pc_new_size` («alrededor de»), no el «aprox.» del relevamiento: es lo que la
// app dice de verdad.
//
// El formulario recuerda lo último elegido (localStorage, por navegador): CapCut
// también abre el diálogo con la configuración de la vez anterior.

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowDown01Icon,
	CheckmarkCircle02Icon,
	Film01Icon,
	FolderOpenIcon,
	InformationCircleIcon,
	PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { portalCe } from "@/app/video-editor/portal";
import { Dialog } from "@/app/video-editor/_opencut/components/ui/dialog";
import { Checkbox } from "@/app/video-editor/_opencut/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/app/video-editor/_opencut/components/ui/select";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	CODECS,
	CUADROS,
	FORMATOS,
	FORMATOS_AUDIO,
	FORMATOS_SUBTITULO,
	GIF_MAX_SEGUNDOS,
	RESOLUCIONES,
	RESOLUCIONES_GIF,
	TASAS,
	codecsDelFormato,
	cuadrosPorDefecto,
	estimarBytes,
	formatoDuracion,
	formatoTamano,
	resolucionPorDefecto,
	soporteAudio,
	soporteCodecs,
	tamanoSalida,
	tasaDeBits,
	valorCuadros,
	type CodecId,
	type OpcionesExportar,
	type ResolucionId,
	type SoporteCodec,
} from "./opciones";
import { Exportacion, datosDelProyecto, portada } from "./exportar";
import { carpetaElegida, elegirCarpeta, puedeElegirCarpeta } from "./destino";
import { frameRateToFloat } from "@/app/video-editor/_opencut/fps/utils";
import { quedanMuestras } from "@/app/video-editor/_opencut/plantillas/huecos";

const CLAVE_RECUERDO = "ce-exportar-v1";

type Fase =
	| { tipo: "formulario" }
	| { tipo: "exportando"; progreso: number }
	| { tipo: "listo"; archivos: string[] }
	| { tipo: "error"; mensaje: string };

function leerRecuerdo(): Partial<OpcionesExportar> | null {
	try {
		const crudo = localStorage.getItem(CLAVE_RECUERDO);
		return crudo ? (JSON.parse(crudo) as Partial<OpcionesExportar>) : null;
	} catch {
		return null;
	}
}

function guardarRecuerdo(opciones: OpcionesExportar): void {
	try {
		// El nombre NO se recuerda: es el del proyecto de cada vez.
		const { nombre: _nombre, ...resto } = opciones;
		localStorage.setItem(CLAVE_RECUERDO, JSON.stringify(resto));
	} catch {
		// Sin almacenamiento (ventana privada): el diálogo abre con los valores por defecto.
	}
}

function opcionesIniciales({
	nombre,
	lienzo,
	fps,
}: {
	nombre: string;
	lienzo: { width: number; height: number };
	fps: number;
}): OpcionesExportar {
	const base: OpcionesExportar = {
		nombre,
		video: {
			activo: true,
			resolucion: resolucionPorDefecto(lienzo),
			tasa: "recomendada",
			personalizadaMbps: 10,
			modoTasa: "variable",
			codec: "avc",
			formato: "mp4",
			cuadros: cuadrosPorDefecto(fps),
		},
		audio: { activo: false, formato: "mp3" },
		subtitulos: { activo: false, formato: "srt" },
		gif: { activo: false, resolucion: "320" },
	};
	const previo = leerRecuerdo();
	if (!previo) return base;
	// Lo guardado se acepta campo por campo y sólo si sigue siendo una opción
	// válida: un localStorage de otra versión no puede dejar un desplegable en blanco.
	const vale = <T,>(valor: unknown, lista: readonly { id: T; imposible?: boolean }[], defecto: T): T => {
		const item = lista.find((x) => x.id === valor);
		return item && !item.imposible ? item.id : defecto;
	};
	const pv = previo.video;
	return {
		...base,
		video: {
			...base.video,
			activo: typeof pv?.activo === "boolean" ? pv.activo : base.video.activo,
			resolucion: vale(pv?.resolucion, RESOLUCIONES as readonly { id: ResolucionId; imposible?: boolean }[], base.video.resolucion),
			tasa: vale(pv?.tasa, TASAS, base.video.tasa),
			personalizadaMbps:
				typeof pv?.personalizadaMbps === "number" && pv.personalizadaMbps >= 1 && pv.personalizadaMbps <= 200
					? pv.personalizadaMbps
					: base.video.personalizadaMbps,
			modoTasa: pv?.modoTasa === "constant" ? "constant" : "variable",
			codec: vale(pv?.codec, CODECS, base.video.codec),
			formato: vale(pv?.formato, FORMATOS, base.video.formato),
			cuadros: vale(pv?.cuadros, CUADROS, base.video.cuadros),
		},
		audio: {
			activo: previo.audio?.activo === true,
			formato: vale(previo.audio?.formato, FORMATOS_AUDIO, base.audio.formato),
		},
		subtitulos: {
			activo: previo.subtitulos?.activo === true,
			formato: vale(previo.subtitulos?.formato, FORMATOS_SUBTITULO, base.subtitulos.formato),
		},
		gif: {
			activo: previo.gif?.activo === true,
			resolucion: vale(previo.gif?.resolucion, RESOLUCIONES_GIF, base.gif.resolucion),
		},
	};
}

export function DialogoExportar({
	abierto,
	onAbiertoChange,
}: {
	abierto: boolean;
	onAbiertoChange: (abierto: boolean) => void;
}) {
	// El Portal de radix monta su contenido SÓLO con el diálogo abierto: el
	// cuerpo nace con cada apertura y lee el proyecto en sus `useState`, sin un
	// efecto que lo copie (y muere al cerrar, cancelando lo que estuviera exportando).
	return (
		<Dialog open={abierto} onOpenChange={onAbiertoChange}>
			<DialogPrimitive.Portal container={portalCe()}>
				<CuerpoExportar onCerrar={() => onAbiertoChange(false)} />
			</DialogPrimitive.Portal>
		</Dialog>
	);
}

/** El codec que de verdad se usa: el elegido si este navegador puede; si no, el primero que sí. */
function codecEfectivo(
	elegido: CodecId,
	formato: OpcionesExportar["video"]["formato"],
	soporte: Partial<Record<CodecId, SoporteCodec>>,
): CodecId {
	if (Object.keys(soporte).length === 0) return elegido;
	// Preferencia: H.264 (lo abre todo) y VP9 en webm; AV1 por software es lentísimo.
	const preferencia: CodecId[] = ["avc", "vp9", "hevc", "av1"];
	const posibles = codecsDelFormato(formato)
		.filter((c) => !c.imposible && soporte[c.id]?.soportado)
		.sort((a, b) => preferencia.indexOf(a.id) - preferencia.indexOf(b.id));
	if (posibles.length === 0 || posibles.some((c) => c.id === elegido)) return elegido;
	return posibles[0].id;
}

function CuerpoExportar({ onCerrar }: { onCerrar: () => void }) {
	const editor = useEditor();
	const exportacion = useRef<Exportacion | null>(null);
	const [datos] = useState(() => datosDelProyecto(editor));
	// Una plantilla con clips sin sustituir se exporta igual (no bloquea), pero se avisa.
	const [conMuestras] = useState(() => quedanMuestras(editor.scenes.getActiveScene().tracks));
	const [elegidas, setOpciones] = useState<OpcionesExportar>(() =>
		opcionesIniciales({
			nombre: datos.proyecto.metadata.name,
			lienzo: datos.lienzo,
			fps: frameRateToFloat(datos.proyecto.settings.fps),
		}),
	);
	const [fase, setFase] = useState<Fase>({ tipo: "formulario" });
	const [imagen, setImagen] = useState<string | null>(null);
	const [carpeta, setCarpeta] = useState<string | null>(() => carpetaElegida());
	const [soporte, setSoporte] = useState<Partial<Record<CodecId, SoporteCodec>>>({});
	const [audioAac, setAudioAac] = useState(true);

	// Lo elegido, corregido por lo que este navegador puede: un codec que no
	// codifica (o que no va en el formato) cae al primero que sí, y AAC sin
	// codificador cae a MP3. Derivado, no copiado: si el soporte cambia, vuelve.
	const opciones = useMemo<OpcionesExportar>(() => {
		const codec = codecEfectivo(elegidas.video.codec, elegidas.video.formato, soporte);
		const formatoAudio = !audioAac && elegidas.audio.formato === "aac" ? "mp3" : elegidas.audio.formato;
		return {
			...elegidas,
			video: { ...elegidas.video, codec },
			audio: { ...elegidas.audio, formato: formatoAudio },
		};
	}, [elegidas, soporte, audioAac]);

	const v = opciones.video;
	const fps = valorCuadros(v.cuadros);
	const { width: ancho, height: alto } = tamanoSalida({ lienzo: datos.lienzo, resolucion: v.resolucion });
	const bitrate = tasaDeBits({ resolucion: v.resolucion, fps, codec: v.codec, tasa: v.tasa, personalizadaMbps: v.personalizadaMbps });

	// La portada y el soporte de audio, una vez por apertura.
	useEffect(() => {
		let vigente = true;
		void portada(editor).then((url) => {
			if (vigente) setImagen(url);
		});
		void soporteAudio().then((s) => {
			if (vigente) setAudioAac(s.aac);
		});
		return () => {
			vigente = false;
		};
	}, [editor]);

	// El soporte de video depende del tamaño, los fps y la tasa: se vuelve a
	// preguntar cuando cambian (isConfigSupported es por configuración).
	useEffect(() => {
		let vigente = true;
		void soporteCodecs({ width: ancho, height: alto, fps, bitrate }).then((s) => {
			if (vigente) setSoporte(s);
		});
		return () => {
			vigente = false;
		};
	}, [ancho, alto, fps, bitrate]);

	// Cerrar el diálogo a mitad de una exportación la cancela.
	useEffect(() => () => exportacion.current?.cancelar(), []);

	const bytes = useMemo(
		() => estimarBytes({ opciones, segundos: datos.segundos, lienzo: datos.lienzo, hayAudio: datos.hayAudio }),
		[opciones, datos],
	);

	const cambiar = (parche: (o: OpcionesExportar) => OpcionesExportar) => setOpciones((o) => parche(o));

	const gifLargo = datos.segundos > GIF_MAX_SEGUNDOS;
	const codecListo = soporte[v.codec]?.soportado ?? false;
	const algoMarcado =
		(opciones.video.activo && codecListo) ||
		(opciones.audio.activo && datos.hayAudio) ||
		(opciones.subtitulos.activo && datos.subtitulos.length > 0) ||
		(opciones.gif.activo && !gifLargo);
	const puedeExportar = datos.segundos > 0 && algoMarcado && fase.tipo === "formulario";

	const exportar = async () => {
		if (!puedeExportar) return;
		guardarRecuerdo(opciones);
		const tarea = new Exportacion(editor, opciones, soporte);
		exportacion.current = tarea;
		setFase({ tipo: "exportando", progreso: 0 });
		const resultado = await tarea.ejecutar((progreso) =>
			setFase((f) => (f.tipo === "exportando" ? { tipo: "exportando", progreso } : f)),
		);
		exportacion.current = null;
		if (resultado.estado === "listo") setFase({ tipo: "listo", archivos: resultado.archivos });
		else if (resultado.estado === "error") setFase({ tipo: "error", mensaje: resultado.mensaje });
		else setFase({ tipo: "formulario" });
	};

	return (
		<>
			<DialogPrimitive.Overlay className="fixed inset-0 z-250 bg-black/55" />
			<DialogPrimitive.Content
				aria-describedby={undefined}
				onCloseAutoFocus={(e) => e.preventDefault()}
				// Mientras exporta, ni Esc ni un clic afuera lo cierran: cancelar es un botón.
				onEscapeKeyDown={(e) => {
					if (fase.tipo === "exportando") e.preventDefault();
				}}
				onPointerDownOutside={(e) => e.preventDefault()}
				className="fixed top-1/2 left-1/2 z-250 flex max-h-[calc(100vh-32px)] w-[862px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[8px] bg-(--cc-panel) text-(--cc-text) shadow-2xl outline-none"
			>
				<DialogPrimitive.Title className="flex h-[38px] shrink-0 items-center px-5 text-[14px] font-medium">
					Exportar
				</DialogPrimitive.Title>

				<div className="flex min-h-0 flex-1 gap-6 overflow-y-auto px-5 pt-2 pb-4">
					<Portada imagen={imagen} fase={fase} conMuestras={conMuestras && fase.tipo === "formulario"} />
					<div className="min-w-0 flex-1">
						{fase.tipo === "formulario" ? (
							<Formulario
								opciones={opciones}
								cambiar={cambiar}
								soporte={soporte}
								audioAac={audioAac}
								carpeta={carpeta}
								onElegirCarpeta={async () => setCarpeta(await elegirCarpeta())}
								hayAudio={datos.hayAudio}
								haySubtitulos={datos.subtitulos.length > 0}
								gifLargo={gifLargo}
							/>
						) : (
							<Estado fase={fase} />
						)}
					</div>
				</div>

				<footer className="flex h-[56px] shrink-0 items-center justify-between gap-4 border-t border-(--cc-line-2) px-5">
					<div className="flex min-w-0 items-center gap-2 text-[12px] text-(--cc-text-3)">
						<HugeiconsIcon icon={Film01Icon} className="size-4 shrink-0" />
						<span className="truncate">
							{`Duración: ${formatoDuracion(datos.segundos)} | Tamaño: alrededor de ${formatoTamano(bytes)}`}
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-3">
						{fase.tipo === "formulario" && (
							<button
								type="button"
								onClick={() => void exportar()}
								disabled={!puedeExportar}
								className="h-8 w-[86px] cursor-pointer rounded-[4px] bg-primary text-[13px] font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
							>
								Exportar
							</button>
						)}
						{fase.tipo === "error" && (
							<button
								type="button"
								onClick={() => setFase({ tipo: "formulario" })}
								className="h-8 min-w-[86px] cursor-pointer rounded-[4px] bg-primary px-3 text-[13px] font-medium text-white hover:brightness-110"
							>
								Reintentar
							</button>
						)}
						<button
							type="button"
							onClick={() => (fase.tipo === "exportando" ? exportacion.current?.cancelar() : onCerrar())}
							className="h-8 w-[86px] cursor-pointer rounded-[4px] bg-(--cc-btn-2) text-[13px] text-(--cc-text) hover:brightness-110"
						>
							{fase.tipo === "listo" ? "Cerrar" : "Cancelar"}
						</button>
					</div>
				</footer>
			</DialogPrimitive.Content>
		</>
	);
}

function Portada({ imagen, fase, conMuestras }: { imagen: string | null; fase: Fase; conMuestras: boolean }) {
	return (
		<div className="flex w-[384px] shrink-0 flex-col gap-2">
			<div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[4px] bg-black">
				{imagen ? (
					// eslint-disable-next-line @next/next/no-img-element -- dataURL local, sin optimizar
					<img src={imagen} alt="" className="size-full object-contain" />
				) : null}
				{/* `pc_edit_cover_btn`: la portada se elige en CapCut con su editor; acá todavía no. */}
				<span
					aria-disabled
					className="absolute top-2 left-2 flex h-6 items-center gap-1 rounded-[4px] bg-black/55 px-2 text-[11px] text-white/45"
				>
					<HugeiconsIcon icon={PencilEdit02Icon} className="size-3" />
					Editar portada
				</span>
				{fase.tipo === "exportando" && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[22px] font-medium text-white tabular-nums">
						{`${Math.floor(fase.progreso * 100)}%`}
					</div>
				)}
			</div>
			{/* Una plantilla con un hueco sin sustituir (plantillas/huecos.ts): avisa, no bloquea. */}
			{conMuestras && (
				<p className="flex items-center gap-1.5 text-[12px] text-(--cc-text-2)">
					<HugeiconsIcon icon={InformationCircleIcon} className="size-3.5 shrink-0" />
					Quedan clips de muestra
				</p>
			)}
		</div>
	);
}

function Estado({ fase }: { fase: Fase }) {
	if (fase.tipo === "exportando") {
		return (
			<div className="flex h-full flex-col justify-center gap-3 py-6">
				<p className="text-[13px]">Exportando…</p>
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-(--cc-raised)">
					<div
						className="h-full rounded-full bg-primary transition-[width] duration-200"
						style={{ width: `${Math.round(fase.progreso * 100)}%` }}
					/>
				</div>
			</div>
		);
	}
	if (fase.tipo === "listo") {
		return (
			<div className="flex flex-col gap-3 py-6">
				<p className="flex items-center gap-2 text-[14px] font-medium">
					<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 text-primary" />
					Exportado
				</p>
				<ul className="flex flex-col gap-1 text-[12px] text-(--cc-text-2)">
					{fase.archivos.map((a) => (
						<li key={a} className="truncate">{a}</li>
					))}
				</ul>
			</div>
		);
	}
	if (fase.tipo === "error") {
		return (
			<div className="flex flex-col gap-2 py-6">
				<p className="text-[14px] font-medium text-destructive">No se pudo exportar</p>
				<p className="text-[12px] break-words text-(--cc-text-3)">{fase.mensaje}</p>
			</div>
		);
	}
	return null;
}

// ── El formulario ───────────────────────────────────────────────────────────

const ANCHO_CONTROL = "w-[270px]";

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
	return (
		<div className="flex min-h-[40px] items-center justify-between gap-3">
			<span className="text-[12px] text-(--cc-text-2)">{etiqueta}</span>
			<div className={cn(ANCHO_CONTROL, "shrink-0")}>{children}</div>
		</div>
	);
}

function Desplegable<T extends string>({
	valor,
	onCambiar,
	opciones,
}: {
	valor: T;
	onCambiar: (v: T) => void;
	opciones: { id: T; etiqueta: string; apagada?: boolean }[];
}) {
	return (
		<Select value={valor} onValueChange={(v) => onCambiar(v as T)}>
			<SelectTrigger className="h-7 w-full rounded-[4px] border-none bg-(--cc-raised) px-2.5 text-[12px] text-(--cc-text)">
				<SelectValue />
			</SelectTrigger>
			{/* z-300: el contenido de un Select va al mismo portal que el diálogo (z-250);
			    con su z-50 de fábrica se abriría DEBAJO del diálogo. */}
			<SelectContent className="z-300 border-(--cc-line-2)">
				{opciones.map((o) => (
					<SelectItem key={o.id} value={o.id} disabled={o.apagada} className="text-[12px]">
						{o.etiqueta}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function Seccion({
	titulo,
	activa,
	onActiva,
	deshabilitada,
	children,
}: {
	titulo: string;
	activa: boolean;
	onActiva: (v: boolean) => void;
	deshabilitada?: boolean;
	children?: React.ReactNode;
}) {
	const [plegada, setPlegada] = useState(false);
	return (
		<section className="border-t border-(--cc-line-2) first:border-t-0">
			<div className="flex h-[40px] items-center justify-between">
				<label className={cn("flex items-center gap-2 text-[13px] font-medium", deshabilitada ? "opacity-40" : "cursor-pointer")}>
					<Checkbox
						checked={activa && !deshabilitada}
						disabled={deshabilitada}
						onCheckedChange={(c) => onActiva(c === true)}
						className="size-[14px] rounded-[3px] border-(--cc-text-3)"
					/>
					{titulo}
				</label>
				{children ? (
					<button
						type="button"
						onClick={() => setPlegada((p) => !p)}
						aria-label={titulo}
						aria-expanded={!plegada}
						className="flex size-6 cursor-pointer items-center justify-center rounded-[4px] text-(--cc-text-3) hover:bg-(--cc-raised)"
					>
						<HugeiconsIcon icon={ArrowDown01Icon} className={cn("size-4 transition-transform", !plegada && "rotate-180")} />
					</button>
				) : null}
			</div>
			{children && !plegada ? <div className={cn("pb-2", !activa && "pointer-events-none opacity-40")}>{children}</div> : null}
		</section>
	);
}

function Formulario({
	opciones,
	cambiar,
	soporte,
	audioAac,
	carpeta,
	onElegirCarpeta,
	hayAudio,
	haySubtitulos,
	gifLargo,
}: {
	opciones: OpcionesExportar;
	cambiar: (parche: (o: OpcionesExportar) => OpcionesExportar) => void;
	soporte: Partial<Record<CodecId, SoporteCodec>>;
	audioAac: boolean;
	carpeta: string | null;
	onElegirCarpeta: () => void;
	hayAudio: boolean;
	haySubtitulos: boolean;
	gifLargo: boolean;
}) {
	const v = opciones.video;
	const conCarpeta = puedeElegirCarpeta();
	const conVideo = <K extends keyof OpcionesExportar["video"]>(k: K, valor: OpcionesExportar["video"][K]) =>
		cambiar((o) => ({ ...o, video: { ...o.video, [k]: valor } }));
	const probado = Object.keys(soporte).length > 0;

	return (
		<div className="flex flex-col">
			<Fila etiqueta="Nombre">
				<input
					value={opciones.nombre}
					onChange={(e) => cambiar((o) => ({ ...o, nombre: e.target.value }))}
					className="h-7 w-full rounded-[4px] bg-(--cc-input) px-2.5 text-[12px] text-(--cc-text) outline-none focus:ring-1 focus:ring-primary"
				/>
			</Fila>
			<Fila etiqueta="Exportar a">
				<div className="flex h-7 items-center gap-1 rounded-[4px] bg-(--cc-input) pr-1 pl-2.5">
					<span className="min-w-0 flex-1 truncate text-[12px] text-(--cc-text-2)">{carpeta ?? "Descargas"}</span>
					{conCarpeta ? (
						<button
							type="button"
							onClick={onElegirCarpeta}
							aria-label="Exportar a"
							className="flex size-6 cursor-pointer items-center justify-center rounded-[3px] text-(--cc-text-2) hover:bg-(--cc-raised)"
						>
							<HugeiconsIcon icon={FolderOpenIcon} className="size-4" />
						</button>
					) : null}
				</div>
			</Fila>

			<div className="mt-2">
				<Seccion titulo="Video" activa={v.activo} onActiva={(a) => conVideo("activo", a)}>
					<Fila etiqueta="Resolución">
						<Desplegable
							valor={v.resolucion}
							onCambiar={(r) => conVideo("resolucion", r)}
							opciones={RESOLUCIONES.map((r) => ({ id: r.id, etiqueta: r.etiqueta, apagada: "imposible" in r }))}
						/>
					</Fila>
					<Fila etiqueta="Tasa de bits">
						<Desplegable valor={v.tasa} onCambiar={(t) => conVideo("tasa", t)} opciones={TASAS} />
					</Fila>
					{v.tasa === "personalizada" ? (
						<div className="flex justify-end">
							<div className={cn(ANCHO_CONTROL, "flex gap-2 pb-1")}>
								<div className="min-w-0 flex-1">
									<Desplegable
										valor={v.modoTasa}
										onCambiar={(m) => conVideo("modoTasa", m)}
										opciones={[
											{ id: "constant", etiqueta: "CBR (tasa de bits estática)" },
											{ id: "variable", etiqueta: "VBR (tasa de bits variable)" },
										]}
									/>
								</div>
								<label className="flex h-7 w-[92px] shrink-0 items-center gap-1 rounded-[4px] bg-(--cc-sunken) px-2">
									<input
										type="number"
										min={1}
										max={200}
										step={1}
										value={v.personalizadaMbps}
										onChange={(e) => {
											const n = Number(e.target.value);
											if (Number.isFinite(n)) conVideo("personalizadaMbps", Math.min(200, Math.max(1, n)));
										}}
										className="w-full min-w-0 bg-transparent text-right text-[12px] text-(--cc-text) tabular-nums outline-none"
									/>
									<span className="text-[11px] text-(--cc-text-3)">Mbps</span>
								</label>
							</div>
						</div>
					) : null}
					<Fila etiqueta="Codec">
						<Desplegable
							valor={v.codec}
							onCambiar={(c) => conVideo("codec", c)}
							opciones={codecsDelFormato(v.formato).map((c) => ({
								id: c.id,
								etiqueta: c.etiqueta,
								// Mientras se pregunta al navegador, todo habilitado: un parpadeo
								// de «apagado» en H.264 al abrir confunde más de lo que ayuda.
								apagada: c.imposible || (probado && !soporte[c.id]?.soportado),
							}))}
						/>
					</Fila>
					{probado && !soporte[v.codec]?.soportado ? (
						// Ningún codec del formato anda con esta resolución y cuadros: sin
						// esto, Exportar queda gris sin decir por qué.
						<p className="pb-1 text-right text-[11px] text-destructive">No disponible en este navegador</p>
					) : null}
					<Fila etiqueta="Formato">
						<Desplegable
							valor={v.formato}
							onCambiar={(f) => conVideo("formato", f)}
							opciones={FORMATOS.map((f) => ({ id: f.id, etiqueta: f.etiqueta }))}
						/>
					</Fila>
					<Fila etiqueta="Cuadros por segundo">
						<Desplegable
							valor={v.cuadros}
							onCambiar={(c) => conVideo("cuadros", c)}
							opciones={CUADROS.map((c) => ({ id: c.id, etiqueta: c.etiqueta }))}
						/>
					</Fila>
					{/* `color_space_pc`: informativo, como en CapCut (el compositor dibuja en sRGB/709). */}
					<div className="flex min-h-[28px] items-center justify-between text-[11px] text-(--cc-text-3)">
						<span>Espacio cromático:</span>
						<span className={ANCHO_CONTROL}>Rec. 709 SDR</span>
					</div>
				</Seccion>

				<Seccion
					titulo="Audio"
					activa={opciones.audio.activo}
					deshabilitada={!hayAudio}
					onActiva={(a) => cambiar((o) => ({ ...o, audio: { ...o.audio, activo: a } }))}
				>
					<Fila etiqueta="Formato">
						<Desplegable
							valor={opciones.audio.formato}
							onCambiar={(f) => cambiar((o) => ({ ...o, audio: { ...o.audio, formato: f } }))}
							opciones={FORMATOS_AUDIO.map((f) => ({ id: f.id, etiqueta: f.etiqueta, apagada: f.id === "aac" && !audioAac }))}
						/>
					</Fila>
				</Seccion>

				<Seccion
					titulo="Subtítulos"
					activa={opciones.subtitulos.activo}
					deshabilitada={!haySubtitulos}
					onActiva={(a) => cambiar((o) => ({ ...o, subtitulos: { ...o.subtitulos, activo: a } }))}
				>
					<Fila etiqueta="Formato del subtítulo">
						<Desplegable
							valor={opciones.subtitulos.formato}
							onCambiar={(f) => cambiar((o) => ({ ...o, subtitulos: { ...o.subtitulos, formato: f } }))}
							opciones={FORMATOS_SUBTITULO.map((f) => ({ id: f.id, etiqueta: f.etiqueta }))}
						/>
					</Fila>
				</Seccion>

				<Seccion
					titulo="Exportar GIF"
					activa={opciones.gif.activo}
					onActiva={(a) => cambiar((o) => ({ ...o, gif: { ...o.gif, activo: a } }))}
				>
					<Fila etiqueta="Resolución">
						<Desplegable
							valor={opciones.gif.resolucion}
							onCambiar={(r) => cambiar((o) => ({ ...o, gif: { ...o.gif, resolucion: r } }))}
							opciones={RESOLUCIONES_GIF.map((r) => ({ id: r.id, etiqueta: r.etiqueta }))}
						/>
					</Fila>
					{opciones.gif.activo && gifLargo ? (
						<p className="pb-1 text-[11px] text-destructive">No se puede exportar. El video es demasiado largo.</p>
					) : null}
				</Seccion>
			</div>
		</div>
	);
}

