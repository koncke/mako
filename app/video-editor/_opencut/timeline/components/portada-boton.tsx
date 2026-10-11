"use client";

// El botón «Portada» a la izquierda de la pista principal y su diálogo
// «Seleccionar portada»: «Fotograma del video» (un cuadro de la línea de
// tiempo) o «Local» (una imagen propia). Lo elegido se guarda en el proyecto
// (./portada.ts). «Editar portada» (plantillas y texto sobre la portada) queda
// apagado: las plantillas están fuera de la v1.

import { useEffect, useRef, useState } from "react";
import { PencilLine } from "lucide-react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/app/video-editor/_opencut/components/ui/dialog";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Slider } from "@/app/video-editor/_opencut/components/ui/slider";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { mediaTime, TICKS_PER_SECOND, type MediaTime } from "@/app/video-editor/_opencut/wasm";
import {
	cuadroPrincipalEn,
	fijarPortada,
	imagenLocalAPortada,
	leerPortada,
	medidas,
	type TPortada,
} from "./portada";

function formatoTiempo(ticks: number, fps: number): string {
	const total = ticks / TICKS_PER_SECOND;
	const m = Math.floor(total / 60);
	const s = Math.floor(total % 60);
	const f = Math.floor((total % 1) * fps);
	const dos = (n: number) => String(n).padStart(2, "0");
	return `${dos(m)}:${dos(s)}:${dos(f)}`;
}

/** Dibuja una fuente en un canvas, entera sobre negro («contain») o llenándolo («cover»). */
function dibujarContenido(
	canvas: HTMLCanvasElement,
	fuente: CanvasImageSource | null,
	ajuste: "contain" | "cover" = "contain",
) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	if (!fuente) return;
	const { width, height } = medidas(fuente);
	if (!width || !height) return;
	const escala =
		ajuste === "cover"
			? Math.max(canvas.width / width, canvas.height / height)
			: Math.min(canvas.width / width, canvas.height / height);
	const w = width * escala;
	const h = height * escala;
	ctx.drawImage(fuente, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

export function BotonPortada({ alto }: { alto: number }) {
	const editor = useEditor();
	const portada = useEditor((e) => e.project.getActiveOrNull()?.settings.portada ?? null);
	const hayClips = useEditor(
		(e) => (e.scenes.getActiveSceneOrNull()?.tracks.main.elements.length ?? 0) > 0,
	);
	const [abierto, setAbierto] = useState(false);
	const [cuadro, setCuadro] = useState<{ clave: string; url: string } | null>(null);
	const tiempoCuadro = portada?.tipo === "cuadro" ? portada.tiempo : 0;
	const claveCuadro = `${tiempoCuadro}`;

	// La miniatura del botón: la imagen elegida, o el cuadro elegido (o el primero).
	// El cuadro se decodifica aparte y se guarda con su clave: así una portada que
	// cambió no muestra el cuadro viejo mientras llega el nuevo.
	useEffect(() => {
		if (!hayClips || portada?.tipo === "imagen") return;
		let vivo = true;
		void cuadroPrincipalEn({
			editor,
			tiempo: tiempoCuadro as MediaTime,
			alto: 96,
		}).then((fuente) => {
			if (!vivo || !fuente) return;
			const lienzo = document.createElement("canvas");
			lienzo.width = 96;
			lienzo.height = 96;
			dibujarContenido(lienzo, fuente, "cover");
			setCuadro({ clave: claveCuadro, url: lienzo.toDataURL("image/jpeg", 0.8) });
		});
		return () => {
			vivo = false;
		};
	}, [editor, portada?.tipo, tiempoCuadro, claveCuadro, hayClips]);

	const miniatura =
		portada?.tipo === "imagen"
			? portada.imagen
			: hayClips && cuadro?.clave === claveCuadro
				? cuadro.url
				: null;

	return (
		<>
			<button
				type="button"
				onClick={() => setAbierto(true)}
				disabled={!hayClips}
				className={cn(
					"relative flex w-[43px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[4px] bg-(--cc-raised) text-[10px] leading-none text-(--cc-text) hover:brightness-110 disabled:cursor-default disabled:opacity-50",
				)}
				style={{ height: Math.min(alto, 46) }}
			>
				{miniatura && (
					<span
						aria-hidden
						className="absolute inset-0 bg-cover bg-center opacity-45"
						style={{ backgroundImage: `url(${miniatura})` }}
					/>
				)}
				<PencilLine className="relative size-3.5" />
				<span className="relative">Portada</span>
			</button>
			{abierto && (
				<DialogoPortada
					abierto={abierto}
					onCerrar={() => setAbierto(false)}
					inicial={leerPortada(editor)}
				/>
			)}
		</>
	);
}

function DialogoPortada({
	abierto,
	onCerrar,
	inicial,
}: {
	abierto: boolean;
	onCerrar: () => void;
	inicial: TPortada | null;
}) {
	const editor = useEditor();
	const duracion = useEditor((e) => e.timeline.getTotalDuration());
	const fps = useEditor((e) => e.project.getActiveOrNull()?.settings.fps);
	// Primitivos, no el objeto: un selector que arma un objeto nuevo en cada
	// lectura hace que `useEditor` re-dibuje sin fin.
	const anchoLienzo = useEditor((e) => e.project.getActiveOrNull()?.settings.canvasSize.width ?? 1920);
	const altoLienzo = useEditor((e) => e.project.getActiveOrNull()?.settings.canvasSize.height ?? 1080);
	const fpsNum = fps ? fps.numerator / fps.denominator : 30;
	const [pestana, setPestana] = useState<"cuadro" | "local">(
		inicial?.tipo === "imagen" ? "local" : "cuadro",
	);
	const [tiempo, setTiempo] = useState<number>(
		inicial?.tipo === "cuadro" ? inicial.tiempo : 0,
	);
	const [imagen, setImagen] = useState<string | null>(
		inicial?.tipo === "imagen" ? inicial.imagen : null,
	);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const archivoRef = useRef<HTMLInputElement>(null);

	const aspecto = anchoLienzo / Math.max(1, altoLienzo);
	const anchoVista = aspecto >= 1 ? 480 : Math.round(300 * aspecto);
	const altoVista = aspecto >= 1 ? Math.round(480 / aspecto) : 300;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		let vivo = true;
		if (pestana === "local") {
			if (!imagen) {
				dibujarContenido(canvas, null);
				return;
			}
			const img = new Image();
			img.onload = () => vivo && dibujarContenido(canvas, img);
			img.src = imagen;
			return () => {
				vivo = false;
			};
		}
		const t = mediaTime({ ticks: Math.round(tiempo) });
		void cuadroPrincipalEn({ editor, tiempo: t, alto: 360 }).then((fuente) => {
			if (vivo) dibujarContenido(canvas, fuente);
		});
		return () => {
			vivo = false;
		};
	}, [editor, pestana, tiempo, imagen]);

	const cargar = async (file: File | undefined) => {
		if (!file || !file.type.startsWith("image/")) return;
		const dataUrl = await imagenLocalAPortada(file);
		if (dataUrl) {
			setImagen(dataUrl);
			setPestana("local");
		}
	};

	const guardar = async () => {
		const portada: TPortada | undefined =
			pestana === "local"
				? imagen
					? { tipo: "imagen", imagen }
					: undefined
				: { tipo: "cuadro", tiempo: mediaTime({ ticks: Math.round(tiempo) }) };
		await fijarPortada({ editor, portada });
		onCerrar();
	};

	const restablecer = async () => {
		await fijarPortada({ editor, portada: undefined });
		onCerrar();
	};

	return (
		<Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
			<DialogContent className="max-w-[560px] p-0">
				<DialogHeader>
					<DialogTitle>Seleccionar portada</DialogTitle>
				</DialogHeader>
				<DialogBody className="gap-3">
					<div className="flex gap-1 rounded-[5px] bg-(--cc-sunken) p-0.5 self-start">
						{(
							[
								["cuadro", "Fotograma del video"],
								["local", "Local"],
							] as const
						).map(([id, rotulo]) => (
							<button
								key={id}
								type="button"
								onClick={() => setPestana(id)}
								className={cn(
									"cursor-pointer rounded-[4px] px-3 py-1 text-xs",
									pestana === id
										? "bg-(--cc-raised) text-(--cc-text)"
										: "text-(--cc-text-2) hover:text-(--cc-text)",
								)}
							>
								{rotulo}
							</button>
						))}
					</div>

					<div
						className="flex justify-center rounded-[4px] bg-black"
						onDragOver={(e) => {
							if (pestana === "local") e.preventDefault();
						}}
						onDrop={(e) => {
							e.preventDefault();
							void cargar(e.dataTransfer.files[0]);
						}}
					>
						<canvas
							ref={canvasRef}
							width={anchoVista * 2}
							height={altoVista * 2}
							style={{ width: anchoVista, height: altoVista }}
						/>
					</div>

					{pestana === "cuadro" ? (
						<div className="flex items-center gap-3">
							<Slider
								value={[tiempo]}
								min={0}
								max={Math.max(1, duracion)}
								step={Math.max(1, Math.round(TICKS_PER_SECOND / fpsNum))}
								onValueChange={([v]) => setTiempo(v ?? 0)}
							/>
							<span className="w-[72px] shrink-0 text-right font-mono text-xs text-(--cc-text-2)">
								{formatoTiempo(tiempo, fpsNum)}
							</span>
						</div>
					) : (
						<div className="flex items-center gap-3">
							<Button
								variant="secondary"
								size="sm"
								onClick={() => archivoRef.current?.click()}
							>
								Cargar
							</Button>
							<span className="text-xs text-(--cc-text-3)">
								Arrastra y suelta una foto en la portada para remplazar
							</span>
							<input
								ref={archivoRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={(e) => {
									void cargar(e.target.files?.[0]);
									e.target.value = "";
								}}
							/>
						</div>
					)}
				</DialogBody>
				<DialogFooter className="justify-between sm:justify-between">
					<div className="flex gap-2">
						<Button variant="outline" size="sm" onClick={restablecer}>
							Restablecer
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled
							title="Próximamente"
						>
							Editar portada
						</Button>
					</div>
					<div className="flex gap-2">
						<Button variant="secondary" size="sm" onClick={onCerrar}>
							Cancelar
						</Button>
						<Button
							size="sm"
							onClick={guardar}
							disabled={pestana === "local" && !imagen}
						>
							Guardar
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
