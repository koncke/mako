"use client";

// =============================================================================
// «Marcar ritmos»: la herramienta de la barra de la línea de tiempo
// =============================================================================
// La herramienta aparece con UN clip de audio elegido (como en CapCut). El botón
// marca los ritmos automáticamente con el último nivel usado (Ritmo 1 por
// defecto); el ◢ de la esquina abre «Agregar ritmo» (en el cabezal; si ya hay uno ahí, lo
// saca), «Marcar ritmos automáticamente › Ritmo 1 / Ritmo 2» y «Borrar los
// ritmos». La lógica está en ../ritmos.ts.
//
// Los puntos sobre el clip están en ./ritmos-clip.tsx; el imán los usa
// (timeline/element-snap-source.ts).

import { useState } from "react";
import { toast } from "sonner";
import { Drum } from "lucide-react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/dropdown-menu";
import type { ContextoHerramienta, HerramientaLinea } from "@/app/video-editor/ce/ranuras";
import type { AudioElement } from "@/app/video-editor/_opencut/timeline";
import { TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";
import { BotonBarra } from "@/app/video-editor/_opencut/timeline/components/timeline-toolbar";
import { RITMOS_MODO } from "../claves";
import {
	alternarRitmoEnCabezal,
	borrarRitmos,
	cabezalSobreClip,
	hayRitmoEnCabezal,
	marcarRitmosAutomaticos,
	ritmosEnClip,
	type ModoRitmo,
} from "../ritmos";

/** El clip de audio elegido (uno solo), con su pista. */
export function audioElegido({ editor, seleccion }: ContextoHerramienta): {
	element: AudioElement;
	trackId: string;
} | null {
	if (seleccion.length !== 1) return null;
	const [con] = editor.timeline.getElementsWithTracks({ elements: seleccion });
	if (!con || con.element.type !== "audio" || con.track.locked) return null;
	return { element: con.element, trackId: con.track.id };
}

/** Las detecciones en curso, por clip (el botón queda apagado mientras tanto). */
const enCurso = new Set<string>();

export async function marcarAutomaticos(ctx: ContextoHerramienta, modo: ModoRitmo): Promise<void> {
	const elegido = audioElegido(ctx);
	if (!elegido || enCurso.has(elegido.element.id)) return;
	enCurso.add(elegido.element.id);
	try {
		const cuantos = await marcarRitmosAutomaticos({
			editor: ctx.editor,
			trackId: elegido.trackId,
			element: elegido.element,
			mediaAssets: ctx.editor.media.getAssets(),
			modo,
		});
		// `audio_has_no_taps_generate`
		if (cuantos === 0) toast("No se agregaron ritmos a este sonido");
	} catch (error) {
		console.error("[ritmos]", error);
		// `tap_failed_please_try_again`
		toast.error("No se pudieron agregar los ritmos. Intenta de nuevo.");
	} finally {
		enCurso.delete(elegido.element.id);
	}
}

export function ControlRitmos(props: ContextoHerramienta & { herramienta: HerramientaLinea }) {
	const { herramienta } = props;
	const editor = useEditor();
	const [, refrescar] = useState(0);
	// Re-dibujar cuando cambian los clips (los ritmos viven en sus params).
	useEditor((e) => e.scenes.getActiveSceneOrNull());
	const elegido = audioElegido(props);
	if (!elegido) return null;
	const modo: ModoRitmo = elegido.element.params[RITMOS_MODO] === "2" ? "2" : "1";
	const ocupado = enCurso.has(elegido.element.id);
	const tieneRitmos = ritmosEnClip(elegido.element).length > 0;
	const correr = (m: ModoRitmo) => {
		const promesa = marcarAutomaticos({ editor, seleccion: props.seleccion }, m);
		refrescar((n) => n + 1);
		void promesa.finally(() => refrescar((n) => n + 1));
	};

	return (
		<DropdownMenu>
			<BotonBarra
				etiqueta={herramienta.etiqueta}
				habilitada={!ocupado}
				activa={tieneRitmos}
				onClick={() => correr(modo)}
				// El ◢ de la esquina, como los grupos de la barra (CapCut dibuja
				// «Marcar ritmos automáticamente ◢», no un ▾ aparte).
				esquina={
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							// `pc_timeline_mark_beat_add`
							aria-label="Marcar ritmos"
							className="absolute right-0 bottom-0 size-2.5 cursor-pointer"
						>
							<svg
								viewBox="0 0 4 4"
								aria-hidden
								className="absolute right-[2px] bottom-[2px] size-[5px] text-(--cc-icon)"
							>
								<path d="M4 0V4H0Z" fill="currentColor" />
							</svg>
						</button>
					</DropdownMenuTrigger>
				}
			>
				<Drum className="size-4" />
			</BotonBarra>
			<DropdownMenuContent align="start" className="min-w-56">
				<MenuRitmos
					element={elegido.element}
					trackId={elegido.trackId}
					modo={modo}
					ocupado={ocupado}
					tieneRitmos={tieneRitmos}
					correr={correr}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** El contenido del ◢: se monta al abrir, y ahí lee el cabezal. */
function MenuRitmos({
	element,
	trackId,
	modo,
	ocupado,
	tieneRitmos,
	correr,
}: {
	element: AudioElement;
	trackId: string;
	modo: ModoRitmo;
	ocupado: boolean;
	tieneRitmos: boolean;
	correr: (m: ModoRitmo) => void;
}) {
	const editor = useEditor();
	const cabezal = editor.playback.getCurrentTime() / TICKS_PER_SECOND;
	const sobreClip = cabezalSobreClip(element, cabezal);
	const hayEnCabezal = hayRitmoEnCabezal(element, cabezal);
	return (
		<>
			<DropdownMenuItem
				className="text-xs"
				disabled={!sobreClip}
				onClick={() => alternarRitmoEnCabezal({ editor, trackId, element, cabezalSegundos: cabezal })}
			>
				{hayEnCabezal ? "Eliminar los ritmos" : "Agregar ritmo"}
			</DropdownMenuItem>
			<DropdownMenuSub>
				<DropdownMenuSubTrigger className="text-xs" disabled={ocupado}>
					Marcar ritmos automáticamente
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent>
					<DropdownMenuRadioGroup value={tieneRitmos ? modo : ""}>
						<DropdownMenuRadioItem value="1" className="text-xs" onClick={() => correr("1")}>
							Ritmo 1
						</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="2" className="text-xs" onClick={() => correr("2")}>
							Ritmo 2
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuSubContent>
			</DropdownMenuSub>
			<DropdownMenuSeparator />
			<DropdownMenuItem
				className="text-xs"
				disabled={!tieneRitmos}
				onClick={() => borrarRitmos({ editor, trackId, element })}
			>
				Borrar los ritmos
			</DropdownMenuItem>
		</>
	);
}
