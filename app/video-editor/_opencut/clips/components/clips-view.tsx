"use client";

// =============================================================================
// Biblioteca › Multimedia › «Clips mágicos»
// =============================================================================
// Pedido de Leila (30/10/2026): de un video largo a varios cortos. «Buscar los mejores momentos» (../buscar.ts) lista los
// clips con su título, su puntaje de 0 a 99 (como OpusClip) y lo primero que se dice; «Ver» lleva el cabezal a su
// arranque, y «Abrir» lo arma en un proyecto NUEVO, vertical y con subtítulos (../abrir.ts). El original no se toca.
// SÓLO MaKo Pro (14/11/2026, lib/editores-ia-pro.ts): es editar con IA. A un Esencial, el candado en lugar de «Buscar…», ANTES
// de transcribir el video (la ruta le diría que no recién después de escucharlo entero).

import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { useSoloPro } from "@/app/_components/solo-pro";
import { CandadoSoloPro } from "@/app/_components/CandadoSoloPro";
import { Spinner } from "@/app/video-editor/_opencut/components/ui/spinner";
import { SelectCe } from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { mediaTimeFromSeconds } from "@/app/video-editor/_opencut/wasm";
import { useRouter } from "@/app/_ui/Link";
import { rutaEditor } from "@/app/video-editor/ruta";
import { ReportarASoporte } from "@/app/_ui/ReportarASoporte";
import type { ClipElegido } from "@/lib/editor-video/clips";
import { abrirClip } from "../abrir";
import { buscarClips, vigenciaDe } from "../buscar";
import { TEXTO_FASE_CLIPS, usePreferenciasClips, useTrabajoClips } from "../estado";
import { TEXTO_MOTIVO_ABRIR, mensajeVigente } from "../resultado";

const OPCIONES_CUANTOS = [3, 5, 8].map((n) => ({ id: String(n), etiqueta: `${n} clips` }));

const reloj = (s: number) => {
	const t = Math.max(0, Math.round(s));
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function FilaClip({ clip, ocupado, onAbrir }: { clip: ClipElegido; ocupado: boolean; onAbrir: () => void }) {
	const editor = useEditor();
	return (
		<li className="flex flex-col gap-1.5 rounded-md border border-(--cc-line-2) p-2.5">
			<div className="flex items-start justify-between gap-2">
				<span className="min-w-0 text-[12px] leading-snug text-(--cc-text)">{clip.titulo}</span>
				<span className="shrink-0 rounded bg-(--cc-raised) px-1.5 py-0.5 text-[11px] text-(--cc-text)" title="Qué tan bien funcionaría solo, de 0 a 99">
					{clip.puntaje}
				</span>
			</div>
			<span className="line-clamp-2 text-[11px] text-(--cc-text-3)">«{clip.primera}»</span>
			<div className="flex items-center justify-between gap-2">
				<span className="text-[11px] text-(--cc-text-3)">
					{reloj(clip.inicio)}–{reloj(clip.fin)} · {Math.round(clip.fin - clip.inicio)} s
				</span>
				<span className="flex gap-1">
					<button
						type="button"
						className="cursor-pointer rounded px-2 py-1 text-[11px] text-(--cc-text-2) hover:bg-(--cc-raised) hover:text-(--cc-text)"
						onClick={() => editor.playback.seek({ time: mediaTimeFromSeconds({ seconds: clip.inicio }) })}
					>
						Ver
					</button>
					<button
						type="button"
						disabled={ocupado}
						className="cursor-pointer rounded bg-(--cc-raised) px-2 py-1 text-[11px] text-(--cc-text) hover:opacity-90 disabled:cursor-default disabled:opacity-50"
						onClick={onAbrir}
					>
						Abrir
					</button>
				</span>
			</div>
		</li>
	);
}

export function ClipsView() {
	const editor = useEditor();
	const router = useRouter();
	const prefs = usePreferenciasClips();
	const { fase, progreso, proyectoId, clips, conIA, mensaje, error, vigencia } = useTrabajoClips();
	const actual = useEditor((e) => e.project.getActiveOrNull()?.metadata.id ?? null);
	const duracion = useEditor((e) => e.timeline.getTotalDuration());
	const hayLinea = duracion > 0;
	const soloPro = useSoloPro("ia-editores");
	const deEste = proyectoId && proyectoId === actual ? clips : [];
	const trabajando = fase !== "inactivo";
	// Lo dicho sobre OTRA línea (más corta, de otro proyecto) ya no vale: «ya dura como un clip» se va al sumar video.
	const aviso = !trabajando && mensaje && mensajeVigente(vigencia, { proyectoId: actual, duracion }) ? mensaje : null;

	const abrir = async (clip: ClipElegido) => {
		const r = await abrirClip(editor, clip);
		if (!r.ok) {
			useTrabajoClips.getState().fijar({ mensaje: TEXTO_MOTIVO_ABRIR[r.motivo], error: true, vigencia: vigenciaDe(editor) });
			return;
		}
		// El aviso de «Abrir» se lee en el proyecto NUEVO: sin vigencia.
		useTrabajoClips.getState().fijar({ mensaje: r.aviso, error: false, vigencia: null });
		router.push(rutaEditor(`/video-editor/${r.id}`));
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-3">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<span className="text-[12px] text-(--cc-text-2)">Cuántos</span>
						<SelectCe
							valor={String(prefs.cuantos)}
							opciones={OPCIONES_CUANTOS}
							onCambio={(id) => prefs.fijar({ cuantos: Number(id) })}
							ariaLabel="Cuántos clips"
						/>
					</div>
					{deEste.length > 0 && (
						<div className="flex flex-col gap-2">
							<span className="text-[12px] text-(--cc-text-2)">
								{deEste.length === 1 ? "1 clip" : `${deEste.length} clips`}
								{conIA ? "" : " (por las reglas, sin IA)"}
							</span>
							<ul className="flex flex-col gap-1.5">
								{deEste.map((c) => (
									<FilaClip key={`${c.desde}-${c.hasta}`} clip={c} ocupado={trabajando} onAbrir={() => void abrir(c)} />
								))}
							</ul>
						</div>
					)}
				</div>
			</div>
			<div className="shrink-0 border-t border-(--cc-line-2) px-3 pt-2.5 pb-3">
				<div className="flex flex-col gap-2.5">
					{/* El mensaje va ARRIBA del botón: el pie está pegado abajo y crece hacia arriba, así el botón no se corre. */}
					{aviso && !error && (
						<p className="text-[12px] leading-snug text-(--cc-text)" role="status">
							{aviso}
						</p>
					)}
					{aviso && error && (
						<p className="text-[12px] leading-snug text-(--cc-text)" role="alert">
							{aviso}
							<ReportarASoporte />
						</p>
					)}
					{trabajando ? (
						<div className="flex flex-col gap-1.5">
							<span className="flex min-w-0 items-center gap-1.5 text-[12px] text-(--cc-text-2)">
								<Spinner className="size-3.5 shrink-0" />
								<span className="truncate">{TEXTO_FASE_CLIPS[fase]}</span>
							</span>
							<span className="block h-1 w-full overflow-hidden rounded-full bg-(--cc-raised)">
								<span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${progreso || 100}%` }} />
							</span>
						</div>
					) : soloPro ? (
						<CandadoSoloPro funcion="ia-editores" />
					) : (
						<Button type="button" className="w-full" disabled={!hayLinea} onClick={() => void buscarClips(editor, { cuantos: prefs.cuantos })}>
							{deEste.length ? "Buscar de nuevo" : "Buscar los mejores momentos"}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
