"use client";

// =============================================================================
// Biblioteca › Multimedia › «B-roll de MaKo»
// =============================================================================
// Pedido de Leila (30/10/2026), «al estilo de Submagic»: MaKo propone imágenes encima del video donde se dice algo que
// se puede mostrar, y cambios de plano al ritmo de las frases; la persona deja o saca CADA UNO.
//
//   · arriba, el ritmo y si van también los cambios de plano; abajo, «Proponer» (../proponer.ts);
//   · la lista sale de la LÍNEA DE TIEMPO (lo que lleva la marca de propuesta, ../pistas.ts → `pendientesDe`): se
//     calcula, no se recuerda, así que sobrevive a recargar y a un Ctrl+Z;
//   · tocar una fila lleva el cabezal a su tramo; «Dejar» y «Sacar» son un paso de deshacer (../acciones.ts);
//   · sin Pexels conectado, el modal de Pexels se abre ACÁ (la regla de las integraciones: nunca se sale de la tab).
// Las fotos son de Pexels con su licencia, y cada una dice quién la sacó (lo pide su API).

import { useMemo } from "react";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Spinner } from "@/app/video-editor/_opencut/components/ui/spinner";
import { Switch } from "@/app/video-editor/_opencut/components/ui/switch";
import { SelectCe } from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { mediaTimeFromSeconds, TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { BotonIntegracion } from "@/app/_components/ConectarIntegracion";
import { ReportarASoporte } from "@/app/_ui/ReportarASoporte";
import type { Ritmo } from "@/lib/editor-video/broll";
import { dejar, sacar } from "../acciones";
import { TEXTO_FASE, usePreferenciasBroll, useTrabajoBroll } from "../estado";
import { pendientesDe, PARAM_AUTOR, PARAM_BUSQUEDA, PARAM_MOTIVO, type Pendiente } from "../pistas";
import { proponerBroll } from "../proponer";

const OPCIONES_RITMO: Array<{ id: Ritmo; etiqueta: string }> = [
	{ id: "poco", etiqueta: "Pocas imágenes" },
	{ id: "normal", etiqueta: "Normal" },
	{ id: "mucho", etiqueta: "Muchas imágenes" },
];

const reloj = (s: number) => {
	const t = Math.max(0, Math.round(s));
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function FilaPropuesta({ p, url }: { p: Pendiente; url: string | null }) {
	const editor = useEditor();
	const inicio = p.element.startTime / TICKS_PER_SECOND;
	const fin = (p.element.startTime + p.element.duration) / TICKS_PER_SECOND;
	const esFoto = p.tipo === "broll";
	const busqueda = String(p.element.params[PARAM_BUSQUEDA] ?? "");
	const autor = String(p.element.params[PARAM_AUTOR] ?? "");
	const motivo = String(p.element.params[PARAM_MOTIVO] ?? "");
	return (
		<li className="flex items-center gap-2.5 rounded-md border border-dashed border-(--cc-line-2) p-2">
			<button
				type="button"
				className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
				onClick={() => editor.playback.seek({ time: mediaTimeFromSeconds({ seconds: inicio }) })}
				title={motivo || undefined}
				aria-label={`Ir a ${reloj(inicio)}`}
			>
				{esFoto && url ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={url} alt="" className="size-10 shrink-0 rounded object-cover" />
				) : (
					<span className="flex size-10 shrink-0 items-center justify-center rounded bg-(--cc-raised) text-[11px] text-(--cc-text-2)">
						{esFoto ? "Foto" : "Zoom"}
					</span>
				)}
				<span className="flex min-w-0 flex-col">
					<span className="truncate text-[12px] text-(--cc-text)">
						{esFoto ? busqueda || "Imagen" : p.element.name || "Cambio de plano"}
					</span>
					<span className="truncate text-[11px] text-(--cc-text-3)">
						{reloj(inicio)}–{reloj(fin)}
						{esFoto && autor ? ` · Foto: ${autor} (Pexels)` : ""}
					</span>
				</span>
			</button>
			<button
				type="button"
				className="shrink-0 cursor-pointer rounded px-2 py-1 text-[11px] text-(--cc-text-2) hover:bg-(--cc-raised) hover:text-(--cc-text)"
				onClick={() => sacar(editor, [p.element.id])}
			>
				Sacar
			</button>
			<button
				type="button"
				className="shrink-0 cursor-pointer rounded bg-(--cc-raised) px-2 py-1 text-[11px] text-(--cc-text) hover:opacity-90"
				onClick={() => dejar(editor, [p.element.id])}
			>
				Dejar
			</button>
		</li>
	);
}

export function BrollView() {
	const editor = useEditor();
	const prefs = usePreferenciasBroll();
	const { fase, progreso, mensaje, error, faltaPexels } = useTrabajoBroll();
	const tracks = useEditor((e) => e.scenes.getActiveSceneOrNull()?.tracks ?? null);
	const assets = useEditor((e) => e.media.getAssets());
	const hayLinea = useEditor((e) => e.timeline.getTotalDuration() > 0);
	const pendientes = useMemo(() => pendientesDe(tracks), [tracks]);
	const urlDe = useMemo(() => {
		const m = new Map(assets.map((a) => [a.id, a.url ?? null] as const));
		return (p: Pendiente) => ("mediaId" in p.element ? (m.get(p.element.mediaId) ?? null) : null);
	}, [assets]);
	const trabajando = fase !== "inactivo";
	const proponer = () => void proponerBroll(editor, { ritmo: prefs.ritmo, planos: prefs.planos });

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<span className="text-[12px] text-(--cc-text-2)">Imágenes</span>
						<SelectCe
							valor={prefs.ritmo}
							opciones={OPCIONES_RITMO}
							onCambio={(id) => prefs.fijar({ ritmo: id as Ritmo })}
							ariaLabel="Cuántas imágenes"
						/>
					</div>
					<label className="flex min-h-7 cursor-pointer items-center justify-between gap-3 text-[12px] text-(--cc-text-2)">
						<span className="min-w-0">Cambios de plano</span>
						<Switch
							checked={prefs.planos}
							onCheckedChange={(v) => prefs.fijar({ planos: v === true })}
							aria-label="Cambios de plano"
						/>
					</label>
					{pendientes.length > 0 && (
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between gap-2">
								<span className="text-[12px] text-(--cc-text-2)">Propuesto ({pendientes.length})</span>
								<span className="flex gap-1">
									<button
										type="button"
										className="cursor-pointer rounded px-2 py-1 text-[11px] text-(--cc-text-2) hover:text-(--cc-text)"
										onClick={() => sacar(editor)}
									>
										Sacar todo
									</button>
									<button
										type="button"
										className="cursor-pointer rounded px-2 py-1 text-[11px] text-(--cc-text) hover:opacity-90"
										onClick={() => dejar(editor)}
									>
										Dejar todo
									</button>
								</span>
							</div>
							<ul className="flex flex-col gap-1.5">
								{pendientes.map((p) => (
									<FilaPropuesta key={p.element.id} p={p} url={urlDe(p)} />
								))}
							</ul>
						</div>
					)}
					<a
						href="https://www.pexels.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-[11px] text-(--cc-text-3) hover:text-(--cc-text-2)"
					>
						Fotos de Pexels
					</a>
				</div>
			</div>
			<div className="shrink-0 border-t border-(--cc-line-2) px-3 pt-2.5 pb-3">
				<div className="flex flex-col gap-2.5">
					{trabajando ? (
						<div className="flex flex-col gap-1.5">
							<span className="flex min-w-0 items-center gap-1.5 text-[12px] text-(--cc-text-2)">
								<Spinner className="size-3.5 shrink-0" />
								<span className="truncate">{TEXTO_FASE[fase]}</span>
							</span>
							<span className="block h-1 w-full overflow-hidden rounded-full bg-(--cc-raised)">
								<span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${progreso || 100}%` }} />
							</span>
						</div>
					) : (
						<Button type="button" className="w-full" disabled={!hayLinea} onClick={proponer}>
							{pendientes.length ? "Proponer de nuevo" : "Proponer"}
						</Button>
					)}
					{!trabajando && faltaPexels && (
						<BotonIntegracion
							servicio="pexels"
							className="w-full cursor-pointer rounded-md border border-(--cc-line-2) px-3 py-1.5 text-[12px] text-(--cc-text)"
							onConectado={proponer}
						>
							Conectar Pexels para las imágenes
						</BotonIntegracion>
					)}
					{!trabajando && mensaje && !error && (
						<p className="text-[11px] text-(--cc-text-3)" role="status">
							{mensaje}
						</p>
					)}
					{!trabajando && mensaje && error && (
						<p className="text-[11px] text-(--cc-text-2)" role="alert">
							{mensaje}
							<ReportarASoporte />
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
