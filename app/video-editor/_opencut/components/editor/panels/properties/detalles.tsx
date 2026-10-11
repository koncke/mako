"use client";

// =============================================================================
// «Detalles»: el panel derecho sin nada elegido, y «Configuración del proyecto»
// =============================================================================
// CapCut muestra acá los datos del borrador (Nombre, Relación de aspecto,
// Resolución, Cuadros por segundo) y abajo a la derecha «Modificar», que abre la
// configuración del proyecto. Las filas de CapCut que no aplican en el navegador
// no se dibujan: «Ruta» (el proyecto vive en IndexedDB/OPFS, no en una carpeta),
// «Medios importados», «Proxy» y «Disposición de capas».
//
// Las relaciones son las del botón «Relación» del reproductor (canvas/sizes.ts,
// la lista de CapCut): el diálogo y el reproductor muestran y guardan lo mismo,
// incluido `settings.relacion`, que evita que el primer clip pise el lienzo.
// «Original» / «Adaptado» es el lienzo que tomó el tamaño del primer clip.

import { useState, type ReactNode } from "react";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/app/video-editor/_opencut/components/ui/dialog";
import { Input } from "@/app/video-editor/_opencut/components/ui/input";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { floatToFrameRate, frameRateToFloat } from "@/app/video-editor/_opencut/fps/utils";
import type {
	TCanvasSize,
	TProject,
	TProjectSettings,
} from "@/app/video-editor/_opencut/project/types";
import {
	RELACIONES,
	relacionActual,
	tamanoConProporcion,
	tamanoOriginal,
} from "@/app/video-editor/_opencut/canvas/sizes";
import { SelectCe } from "./components/kit";

/** Por el lado CORTO del lienzo, como las resoluciones de exportar. */
const RESOLUCIONES: ReadonlyArray<{ id: string; etiqueta: string; corto: number }> = [
	{ id: "480", etiqueta: "480p", corto: 480 },
	{ id: "720", etiqueta: "720p", corto: 720 },
	{ id: "1080", etiqueta: "1080p", corto: 1080 },
	{ id: "1440", etiqueta: "2K", corto: 1440 },
	{ id: "2160", etiqueta: "4K", corto: 2160 },
];

const CUADROS: ReadonlyArray<{ id: string; etiqueta: string; valor: number }> = [
	{ id: "23.976", etiqueta: "23,976 fps", valor: 24_000 / 1_001 },
	{ id: "24", etiqueta: "24 fps", valor: 24 },
	{ id: "25", etiqueta: "25 fps", valor: 25 },
	{ id: "29.97", etiqueta: "29,97 fps", valor: 30_000 / 1_001 },
	{ id: "30", etiqueta: "30 fps", valor: 30 },
	{ id: "50", etiqueta: "50 fps", valor: 50 },
	{ id: "59.94", etiqueta: "59,94 fps", valor: 60_000 / 1_001 },
	{ id: "60", etiqueta: "60 fps", valor: 60 },
];

const ORIGINAL = "original";
const PERSONALIZADO = "personalizado";

const par = (n: number) => Math.max(2, Math.round(n / 2) * 2);
const iguales = (a: TCanvasSize, b: TCanvasSize) => a.width === b.width && a.height === b.height;

function relacionDe(settings: TProjectSettings): string {
	return relacionActual(settings) ?? PERSONALIZADO;
}

function etiquetaRelacion(id: string): string {
	if (id === PERSONALIZADO) return "Personalizado";
	return RELACIONES.find((r) => r.id === id)?.etiqueta ?? id;
}

function resolucionDe(lienzo: TCanvasSize): string | null {
	const corto = Math.min(lienzo.width, lienzo.height);
	return RESOLUCIONES.find((x) => x.corto === corto)?.id ?? null;
}

function tamanoPara({ relacion, corto }: { relacion: string; corto: number }): TCanvasSize | null {
	const r = RELACIONES.find((x) => x.id === relacion);
	if (!r?.proporcion) return null;
	return tamanoConProporcion({ proporcion: r.proporcion, ladoCorto: corto });
}

function cuadrosDe(fps: number): string {
	return CUADROS.reduce((a, b) => (Math.abs(b.valor - fps) < Math.abs(a.valor - fps) ? b : a)).id;
}

// ── Detalles ─────────────────────────────────────────────────────────────────

export function Detalles() {
	const proyecto = useEditor((e) => e.project.getActiveOrNull());
	const [abierto, setAbierto] = useState(false);
	if (!proyecto) return null;

	const { canvasSize, fps } = proyecto.settings;
	const relacion = relacionDe(proyecto.settings);
	const res = resolucionDe(canvasSize);
	const filas: Array<[string, string]> = [
		["Nombre:", proyecto.metadata.name],
		["Relación de aspecto:", etiquetaRelacion(relacion)],
		[
			"Resolución:",
			relacion === ORIGINAL
				? "Adaptado"
				: (RESOLUCIONES.find((x) => x.id === res)?.etiqueta ??
					`${canvasSize.width}×${canvasSize.height}`),
		],
		["Cuadros por segundo:", `${frameRateToFloat(fps).toFixed(2)} fps`],
	];

	return (
		<div className="flex h-full flex-col">
			<div className="flex h-[50px] shrink-0 items-center bg-(--cc-panel-head) px-4">
				<span className="text-[13.5px] text-primary">Detalles</span>
			</div>
			<div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-2">
				{filas.map(([rotulo, valor]) => (
					<div key={rotulo} className="flex min-h-[38px] items-center gap-3">
						<span className="w-[168px] max-w-[45%] shrink-0 truncate text-[12.5px] text-(--cc-text-3)">
							{rotulo}
						</span>
						<span className="min-w-0 truncate text-[12.5px] text-foreground" title={valor}>
							{valor}
						</span>
					</div>
				))}
			</div>
			<div className="flex shrink-0 justify-end px-4 pb-4">
				<Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
					Modificar
				</Button>
			</div>
			{abierto && (
				<ConfiguracionProyecto proyecto={proyecto} onCerrar={() => setAbierto(false)} />
			)}
		</div>
	);
}

// ── Configuración del proyecto ───────────────────────────────────────────────

function ConfiguracionProyecto({
	proyecto,
	onCerrar,
}: {
	proyecto: TProject;
	onCerrar: () => void;
}) {
	const editor = useEditor();
	const { canvasSize, fps } = proyecto.settings;
	const original = tamanoOriginal(proyecto.settings);
	const [nombre, setNombre] = useState(proyecto.metadata.name);
	const [relacion, setRelacion] = useState(() => relacionDe(proyecto.settings));
	const [resolucion, setResolucion] = useState(() => resolucionDe(canvasSize) ?? "1080");
	const [cuadros, setCuadros] = useState(() => cuadrosDe(frameRateToFloat(fps)));
	const [ancho, setAncho] = useState(String(canvasSize.width));
	const [alto, setAlto] = useState(String(canvasSize.height));

	const opcionesRelacion = [
		...RELACIONES.map((r) => ({ id: r.id, etiqueta: r.etiqueta })),
		{ id: PERSONALIZADO, etiqueta: "Personalizado" },
	];

	const destino = (): TCanvasSize | null => {
		if (relacion === ORIGINAL) return original;
		if (relacion === PERSONALIZADO) {
			const w = Number.parseInt(ancho, 10);
			const h = Number.parseInt(alto, 10);
			if (!(w >= 16 && h >= 16 && w <= 8192 && h <= 8192)) return null;
			return { width: par(w), height: par(h) };
		}
		const corto = RESOLUCIONES.find((x) => x.id === resolucion)?.corto ?? 1080;
		return tamanoPara({ relacion, corto });
	};
	const tamano = destino();
	const nombreLimpio = nombre.trim();

	const guardar = () => {
		if (!tamano || !nombreLimpio) return;
		const cuadro = CUADROS.find((c) => c.id === cuadros);
		const nuevoFps = cuadro ? floatToFrameRate(cuadro.valor) : fps;
		const cambiaFps =
			nuevoFps.numerator !== fps.numerator || nuevoFps.denominator !== fps.denominator;
		const cambiaLienzo = !iguales(canvasSize, tamano);
		const cambiaRelacion = (proyecto.settings.relacion ?? ORIGINAL) !== relacion;
		if (cambiaLienzo || cambiaFps || cambiaRelacion) {
			// Un solo paso de deshacer para todo lo que cambió.
			void editor.project.updateSettings({
				settings: {
					...(cambiaLienzo || cambiaRelacion
						? {
								canvasSize: tamano,
								relacion,
								canvasSizeMode:
									relacion === PERSONALIZADO ? ("custom" as const) : ("preset" as const),
								...(relacion === PERSONALIZADO ? { lastCustomCanvasSize: tamano } : {}),
							}
						: {}),
					...(cambiaFps ? { fps: nuevoFps } : {}),
				},
			});
		}
		if (nombreLimpio !== proyecto.metadata.name) {
			void editor.project.renameProject({ id: proyecto.metadata.id, name: nombreLimpio });
		}
		onCerrar();
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onCerrar()}>
			<DialogContent className="max-w-[440px]" onOpenAutoFocus={(e) => e.preventDefault()}>
				<DialogHeader>
					<DialogTitle className="text-[15px] font-medium">Configuración del proyecto</DialogTitle>
				</DialogHeader>
				<DialogBody className="gap-3">
					<Campo rotulo="Nombre:">
						<Input
							size="sm"
							value={nombre}
							maxLength={100}
							onChange={(e) => setNombre(e.currentTarget.value)}
						/>
					</Campo>
					<Campo rotulo="Relación de aspecto:">
						<SelectCe valor={relacion} opciones={opcionesRelacion} onCambio={setRelacion} />
					</Campo>
					<Campo rotulo="Resolución:">
						{relacion === PERSONALIZADO ? (
							<div className="flex items-center gap-2">
								<Input
									size="sm"
									inputMode="numeric"
									aria-label="Ancho"
									value={ancho}
									onChange={(e) => setAncho(e.currentTarget.value.replace(/\D/g, ""))}
								/>
								<span className="text-(--cc-text-3)">×</span>
								<Input
									size="sm"
									inputMode="numeric"
									aria-label="Alto"
									value={alto}
									onChange={(e) => setAlto(e.currentTarget.value.replace(/\D/g, ""))}
								/>
							</div>
						) : relacion === ORIGINAL ? (
							<span className="text-[13px] text-foreground">
								Adaptado ({original.width}×{original.height})
							</span>
						) : (
							<SelectCe
								valor={resolucion}
								opciones={RESOLUCIONES.map((r) => {
									const t = tamanoPara({ relacion, corto: r.corto });
									return {
										id: r.id,
										etiqueta: t ? `${r.etiqueta} · ${t.width}×${t.height}` : r.etiqueta,
									};
								})}
								onCambio={setResolucion}
							/>
						)}
					</Campo>
					<Campo rotulo="Cuadros por segundo:">
						<SelectCe
							valor={cuadros}
							opciones={CUADROS.map((c) => ({ id: c.id, etiqueta: c.etiqueta }))}
							onCambio={setCuadros}
						/>
					</Campo>
				</DialogBody>
				<DialogFooter>
					<Button variant="secondary" onClick={onCerrar}>
						Cancelar
					</Button>
					<Button onClick={guardar} disabled={!tamano || !nombreLimpio}>
						Guardar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
	return (
		<div className="flex items-center gap-3">
			<span className="w-[140px] shrink-0 text-[12.5px] text-(--cc-text-3)">{rotulo}</span>
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}
