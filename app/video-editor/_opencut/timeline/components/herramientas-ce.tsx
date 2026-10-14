"use client";

// Las herramientas de la barra de la línea de tiempo que son de la línea de
// tiempo misma (relevamiento-capcut-armazon §6), registradas en la ranura
// `herramientasLinea`. Cada una ejecuta la MISMA acción que su atajo
// (actions/definitions.ts), así barra, teclado y menú contextual no se
// desincronizan. El rótulo es el de CapCut; el atajo, el del preset «CapCut».
//
// Las de los otros paquetes (Recortar, Reflejar/Girar/Congelar/Revertir,
// Grabar, Generar subtítulos, Eliminar fondo…) se registran desde sus archivos
// con `orden` en la centena que les toca (ver ce/ranuras.ts).

import { useState } from "react";
import {
	AlignHorizontalJustifyStart,
	AudioLines,
	Bookmark,
	ChevronDown,
	Link,
	Magnet,
	MousePointer2,
	PanelLeftDashed,
	PanelRightDashed,
	Redo2,
	ScanSearch,
	Scissors,
	SeparatorVertical,
	SquareSplitHorizontal,
	Undo2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import {
	herramientasLinea,
	type ContextoHerramienta,
	type HerramientaLinea,
} from "@/app/video-editor/ce/ranuras";
import { atajoDe, invokeAction, type TActionWithOptionalArgs } from "@/app/video-editor/_opencut/actions";
import { objetivosDeSilencios } from "@/app/video-editor/_opencut/audio/borrar-silencios";
import {
	TIPOS_VINCULO,
	useTimelineStore,
	type TipoVinculo,
} from "@/app/video-editor/_opencut/timeline/timeline-store";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/app/video-editor/_opencut/components/ui/popover";
import { Checkbox } from "@/app/video-editor/_opencut/components/ui/checkbox";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Slider } from "@/app/video-editor/_opencut/components/ui/slider";
import { sliderToZoom, zoomToSlider } from "@/app/video-editor/_opencut/timeline/zoom-utils";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import { BotonBarra } from "./timeline-toolbar";
import { objetivosEnCabezal } from "./pistas-ce";
import { useZoomLinea } from "./zoom-linea";

const ejecutar = (accion: TActionWithOptionalArgs) => () =>
	invokeAction(accion, undefined, "mouseclick");

const siempre = () => true;

// ── Izquierda ────────────────────────────────────────────────────────────────

/** «Seleccionar ▾»: el modo del cursor y la selección hacia un lado. */
function ControlSeleccionar(_: ContextoHerramienta & { herramienta: HerramientaLinea }) {
	const modo = useTimelineStore((s) => s.modoCursor);
	const Icono = modo === "dividir" ? Scissors : MousePointer2;
	return (
		<DropdownMenu>
			<div className="flex items-center">
				<BotonBarra
					etiqueta={modo === "dividir" ? "Modo de división" : "Modo de selección"}
					atajo={modo === "dividir" ? atajoDe("modo-division") : atajoDe("modo-seleccion")}
					onClick={ejecutar(modo === "dividir" ? "modo-seleccion" : "modo-division")}
				>
					<Icono className="size-4" />
				</BotonBarra>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label="Cambiar al modo de selección o división"
						className="flex h-7 w-3.5 cursor-pointer items-center justify-center text-(--cc-icon) hover:text-(--cc-text)"
					>
						<ChevronDown className="size-3" />
					</button>
				</DropdownMenuTrigger>
			</div>
			<DropdownMenuContent align="start" className="min-w-56">
				<DropdownMenuRadioGroup value={modo}>
					<DropdownMenuRadioItem
						value="seleccionar"
						className="text-xs"
						onClick={ejecutar("modo-seleccion")}
					>
						<span className="flex-1">Modo de selección</span>
						<span className="text-(--cc-text-3)">{atajoDe("modo-seleccion")}</span>
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem
						value="dividir"
						className="text-xs"
						onClick={ejecutar("modo-division")}
					>
						<span className="flex-1">Modo de división</span>
						<span className="text-(--cc-text-3)">{atajoDe("modo-division")}</span>
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem className="text-xs" onClick={ejecutar("seleccionar-izquierda")}>
					<span className="flex-1">Seleccionar hacia la izquierda</span>
					<span className="text-(--cc-text-3)">{atajoDe("seleccionar-izquierda")}</span>
				</DropdownMenuItem>
				<DropdownMenuItem className="text-xs" onClick={ejecutar("seleccionar-derecha")}>
					<span className="flex-1">Seleccionar hacia la derecha</span>
					<span className="text-(--cc-text-3)">{atajoDe("seleccionar-derecha")}</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function IconoEliminar(_: { className?: string }) {
	return <IconoBorrar size={16} />;
}

const hayEnCabezal = ({ editor }: ContextoHerramienta) =>
	objetivosEnCabezal({ editor }).length > 0;

/** «Borrar silencios»: un clip con audio elegido, o el de la principal bajo el cabezal. */
const hayClipConAudio = ({ editor, seleccion }: ContextoHerramienta) =>
	objetivosDeSilencios({ editor, seleccion }).length > 0;

const IZQUIERDA: HerramientaLinea[] = [
	{
		id: "linea-seleccionar",
		etiqueta: "Seleccionar",
		orden: 10,
		lado: "izquierda",
		Icono: MousePointer2,
		habilitada: siempre,
		ejecutar: ejecutar("modo-seleccion"),
		Control: ControlSeleccionar,
	},
	{
		id: "linea-deshacer",
		etiqueta: "Deshacer",
		atajo: atajoDe("undo"),
		orden: 110,
		lado: "izquierda",
		Icono: Undo2,
		habilitada: ({ editor }) => editor.command.canUndo(),
		ejecutar: ejecutar("undo"),
	},
	{
		id: "linea-rehacer",
		etiqueta: "Rehacer",
		atajo: atajoDe("redo"),
		orden: 120,
		lado: "izquierda",
		Icono: Redo2,
		habilitada: ({ editor }) => editor.command.canRedo(),
		ejecutar: ejecutar("redo"),
	},
	{
		id: "linea-dividir",
		etiqueta: "Dividir",
		atajo: atajoDe("split"),
		orden: 210,
		lado: "izquierda",
		Icono: SquareSplitHorizontal,
		habilitada: hayEnCabezal,
		ejecutar: ejecutar("split"),
	},
	{
		id: "linea-borrar-izquierda",
		etiqueta: "Borrar a la izquierda",
		atajo: atajoDe("split-left"),
		orden: 220,
		lado: "izquierda",
		Icono: PanelLeftDashed,
		habilitada: hayEnCabezal,
		ejecutar: ejecutar("split-left"),
	},
	{
		id: "linea-borrar-derecha",
		etiqueta: "Borrar a la derecha",
		atajo: atajoDe("split-right"),
		orden: 230,
		lado: "izquierda",
		Icono: PanelRightDashed,
		habilitada: hayEnCabezal,
		ejecutar: ejecutar("split-right"),
	},
	{
		id: "linea-borrar-silencios",
		etiqueta: "Borrar silencios",
		orden: 235,
		lado: "izquierda",
		Icono: AudioLines,
		habilitada: hayClipConAudio,
		ejecutar: ejecutar("borrar-silencios"),
	},
	{
		id: "linea-eliminar",
		etiqueta: "Eliminar",
		atajo: atajoDe("delete-selected"),
		orden: 240,
		lado: "izquierda",
		// Borrar es el tacho de la casa, rojo siempre (tests/borrar-tacho-casa.test.ts),
		// aunque en CapCut sea gris como los demás.
		Icono: IconoEliminar,
		habilitada: ({ seleccion }) => seleccion.length > 0,
		ejecutar: ejecutar("delete-selected"),
	},
	{
		id: "linea-marcador",
		etiqueta: "Agregar marcador",
		atajo: atajoDe("toggle-bookmark"),
		orden: 250,
		lado: "izquierda",
		Icono: Bookmark,
		habilitada: ({ editor }) => editor.timeline.getTotalDuration() > 0,
		ejecutar: ejecutar("toggle-bookmark"),
	},
];

// ── Derecha ──────────────────────────────────────────────────────────────────

const ROTULOS_VINCULO: Record<TipoVinculo, string> = {
	texto: "Texto",
	stickers: "Stickers",
	efectos: "Efectos",
	filtros: "Filtros",
	ajuste: "Ajustar",
	audio: "Audio",
	efectosSonido: "Efectos de sonido",
	textoAVoz: "Texto a voz",
	superposicion: "Superposición",
};

/** «Vinculación ▾»: el interruptor y «Configuración de vinculación». */
function ControlVinculacion({ herramienta }: ContextoHerramienta & { herramienta: HerramientaLinea }) {
	const activa = useTimelineStore((s) => s.vinculacion);
	const guardados = useTimelineStore((s) => s.tiposVinculados);
	const fijar = useTimelineStore((s) => s.fijarTiposVinculados);
	const [abierto, setAbierto] = useState(false);
	const [borrador, setBorrador] = useState(guardados);
	const todos = TIPOS_VINCULO.every((t) => borrador[t]);

	return (
		<Popover
			open={abierto}
			onOpenChange={(o) => {
				setAbierto(o);
				if (o) setBorrador(guardados);
			}}
		>
			<div className="flex items-center">
				<BotonBarra
					etiqueta={herramienta.etiqueta}
					atajo={herramienta.atajo}
					activa={activa}
					onClick={ejecutar("alternar-vinculacion")}
				>
					<Link className="size-4" />
				</BotonBarra>
				<PopoverTrigger asChild>
					<button
						type="button"
						aria-label="Configuración de vinculación"
						className="flex h-7 w-3.5 cursor-pointer items-center justify-center text-(--cc-icon) hover:text-(--cc-text)"
					>
						<ChevronDown className="size-3" />
					</button>
				</PopoverTrigger>
			</div>
			<PopoverContent align="end" className="w-[300px] p-4">
				<p className="text-sm font-medium text-(--cc-text)">Configuración de vinculación</p>
				<p className="mt-1 text-xs leading-snug text-(--cc-text-3)">
					Cuando se activa la vinculación, los elementos seleccionados se mueven o eliminan con los clips de la pista principal.
				</p>
				<div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
					{TIPOS_VINCULO.map((tipo) => (
						<label key={tipo} className="flex cursor-pointer items-center gap-2 text-xs text-(--cc-text)">
							<Checkbox
								checked={borrador[tipo]}
								onCheckedChange={(v) => setBorrador({ ...borrador, [tipo]: v === true })}
							/>
							{ROTULOS_VINCULO[tipo]}
						</label>
					))}
				</div>
				<div className="mt-4 flex items-center justify-between">
					<label className="flex cursor-pointer items-center gap-2 text-xs text-(--cc-text)">
						<Checkbox
							checked={todos}
							onCheckedChange={(v) =>
								setBorrador(
									Object.fromEntries(TIPOS_VINCULO.map((t) => [t, v === true])) as Record<
										TipoVinculo,
										boolean
									>,
								)
							}
						/>
						Seleccionar todo
					</label>
					<div className="flex gap-2">
						<Button variant="secondary" size="sm" onClick={() => setAbierto(false)}>
							Cancelar
						</Button>
						<Button
							size="sm"
							onClick={() => {
								fijar(borrador);
								setAbierto(false);
							}}
						>
							Hecho
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** «Eje de vista previa ▾». */
function ControlEjeVistaPrevia({ herramienta }: ContextoHerramienta & { herramienta: HerramientaLinea }) {
	const activo = useTimelineStore((s) => s.ejeVistaPrevia);
	const fijarActivo = useTimelineStore((s) => s.fijarEjeVistaPrevia);
	return (
		<DropdownMenu>
			<div className="flex items-center">
				<BotonBarra
					etiqueta={herramienta.etiqueta}
					atajo={herramienta.atajo}
					activa={activo}
					onClick={ejecutar("alternar-eje-vista-previa")}
				>
					<SeparatorVertical className="size-4" />
				</BotonBarra>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label="Cambiar el eje de vista previa"
						className="flex h-7 w-3.5 cursor-pointer items-center justify-center text-(--cc-icon) hover:text-(--cc-text)"
					>
						<ChevronDown className="size-3" />
					</button>
				</DropdownMenuTrigger>
			</div>
			<DropdownMenuContent align="end" className="min-w-60">
				<DropdownMenuRadioGroup
					value={activo ? "video" : "apagado"}
					onValueChange={(v) => fijarActivo(v !== "apagado")}
				>
					{/* Con sonido al pasar el mouse no está hecho: queda apagado. */}
					<DropdownMenuRadioItem value="video-audio" disabled className="text-xs">
						Vista previa de video y audio
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="video" className="text-xs">
						Vista previa solo de video
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="apagado" className="text-xs">
						Desactivar el eje de vista previa
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem checked={false} disabled className="text-xs">
					Reproducir el audio mientras se navega
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** El deslizador del zoom (~140 px en la captura → 112). */
function ControlDeslizadorZoom(_: ContextoHerramienta & { herramienta: HerramientaLinea }) {
	const { zoom, min, max, fijarZoom } = useZoomLinea();
	return (
		<Slider
			aria-label="Zoom de la línea de tiempo"
			className="mx-1 w-28"
			value={[zoomToSlider({ zoomLevel: zoom, minZoom: min, maxZoom: max })]}
			onValueChange={([v]) =>
				fijarZoom(sliderToZoom({ sliderPosition: v ?? 0, minZoom: min, maxZoom: max }))
			}
			min={0}
			max={1}
			step={0.005}
		/>
	);
}

const DERECHA: HerramientaLinea[] = [
	{
		id: "linea-iman",
		etiqueta: "Imán de la pista principal",
		atajo: atajoDe("toggle-ripple-editing"),
		orden: 110,
		lado: "derecha",
		Icono: Magnet,
		habilitada: siempre,
		activa: () => useTimelineStore.getState().rippleEditingEnabled,
		ejecutar: ejecutar("toggle-ripple-editing"),
	},
	{
		id: "linea-ajuste-automatico",
		etiqueta: "Ajuste automático",
		atajo: atajoDe("toggle-snapping"),
		orden: 120,
		lado: "derecha",
		Icono: AlignHorizontalJustifyStart,
		habilitada: siempre,
		activa: () => useTimelineStore.getState().snappingEnabled,
		ejecutar: ejecutar("toggle-snapping"),
	},
	{
		id: "linea-vinculacion",
		etiqueta: "Vinculación",
		atajo: atajoDe("alternar-vinculacion"),
		orden: 130,
		lado: "derecha",
		Icono: Link,
		habilitada: siempre,
		activa: () => useTimelineStore.getState().vinculacion,
		ejecutar: ejecutar("alternar-vinculacion"),
		Control: ControlVinculacion,
	},
	{
		id: "linea-eje-vista-previa",
		etiqueta: "Eje de vista previa",
		atajo: atajoDe("alternar-eje-vista-previa"),
		orden: 140,
		lado: "derecha",
		Icono: SeparatorVertical,
		habilitada: siempre,
		activa: () => useTimelineStore.getState().ejeVistaPrevia,
		ejecutar: ejecutar("alternar-eje-vista-previa"),
		Control: ControlEjeVistaPrevia,
	},
	{
		id: "linea-zoom-ajustar",
		etiqueta: "Hacer zoom para ajustar la línea de tiempo",
		atajo: atajoDe("ajustar-linea"),
		orden: 210,
		lado: "derecha",
		Icono: ScanSearch,
		habilitada: ({ editor }) => editor.timeline.getTotalDuration() > 0,
		ejecutar: ejecutar("ajustar-linea"),
	},
	{
		id: "linea-alejar",
		etiqueta: "Alejar",
		atajo: atajoDe("alejar-linea"),
		orden: 220,
		lado: "derecha",
		Icono: ZoomOut,
		habilitada: siempre,
		ejecutar: ejecutar("alejar-linea"),
	},
	{
		id: "linea-zoom",
		etiqueta: "Zoom",
		orden: 225,
		lado: "derecha",
		Icono: ZoomIn,
		habilitada: siempre,
		ejecutar: () => {},
		Control: ControlDeslizadorZoom,
	},
	{
		id: "linea-acercar",
		etiqueta: "Acercar",
		atajo: atajoDe("acercar-linea"),
		orden: 230,
		lado: "derecha",
		Icono: ZoomIn,
		habilitada: siempre,
		ejecutar: ejecutar("acercar-linea"),
	},
];

for (const herramienta of [...IZQUIERDA, ...DERECHA]) {
	herramientasLinea.registrar(herramienta);
}

