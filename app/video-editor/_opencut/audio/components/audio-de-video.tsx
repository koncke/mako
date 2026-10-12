"use client";

// =============================================================================
// La pestaña «Audio» de un clip de VIDEO: Básico y Modificador de voz
// =============================================================================
// Son los mismos controles que los de un clip de audio. Si el audio del video
// ya se extrajo a su propia pista («Extraer audio»), lo que se toque acá no
// sonaría: en lugar de los controles va «Sin audio» y el botón para
// recuperarlo (el mismo comando que el menú del clip y Ctrl+Shift+S).

import type { ComponentType } from "react";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { invokeAction } from "@/app/video-editor/_opencut/actions";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { AudioBasico } from "./basico";
import { ModificadorVoz } from "./modificador-voz";

function AudioDeVideo({ Contenido, ...ctx }: ContextoInspector & { Contenido: ComponentType<ContextoInspector> }) {
	const { element } = ctx;
	if (element.type === "video" && element.isSourceAudioEnabled === false) {
		return (
			<div className="flex flex-col items-center gap-3 px-4 py-8">
				{/* `pc_no_audio` */}
				<p className="text-[13px] text-(--cc-text-3)">Sin audio</p>
				<Button variant="secondary" size="sm" onClick={() => invokeAction("toggle-source-audio", undefined, "mouseclick")}>
					Recuperar audio
				</Button>
			</div>
		);
	}
	return <Contenido {...ctx} />;
}

export function AudioVideoBasico(ctx: ContextoInspector) {
	return <AudioDeVideo {...ctx} Contenido={AudioBasico} />;
}

export function AudioVideoVoz(ctx: ContextoInspector) {
	return <AudioDeVideo {...ctx} Contenido={ModificadorVoz} />;
}
