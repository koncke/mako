"use client";

// =============================================================================
// La barra de arriba mientras trabaja la «Edición automática»: «editando en vivo» y los agentes
// =============================================================================
// Copiado del reel (9/11/2026): debajo del nombre del proyecto, «editing live · autosaved», y a la derecha una fila
// de puntos de colores (uno por agente) con la pastilla «16 agents live». Acá: los puntos de los agentes de esta
// corrida (el que trabaja, encendido), y cuántos son. Sólo se dibuja mientras corre: no ocupa la barra el resto del
// tiempo. Tocarla lleva al panel con el registro.

import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import { AGENTES, LIMA, PASOS, cuantos } from "../plan";
import { SECCION_ENJAMBRE, useEnjambre } from "../estado";

export function EnVivo() {
	const fase = useEnjambre((s) => s.fase);
	const agentes = useEnjambre((s) => s.agentes);
	const paso = useEnjambre((s) => s.paso);
	if (fase !== "corriendo") return null;
	// Trabajan de a uno (dos comandos a la vez sobre la misma línea de tiempo se pisan): se dice cuál va.
	const n = paso ? PASOS.findIndex((p) => p.id === paso) + 1 : 0;
	return (
		<button
			type="button"
			onClick={() => useAssetsPanelStore.getState().irA({ categoria: "multimedia", seccion: SECCION_ENJAMBRE })}
			title="Editando en vivo · guardado automático"
			className="flex h-[26px] shrink-0 cursor-pointer items-center gap-2 rounded-[4px] px-1.5 hover:bg-(--cc-raised)"
		>
			<span className="flex items-center -space-x-1" aria-hidden>
				{AGENTES.map((a) => (
					<span
						key={a.id}
						className={`size-2.5 rounded-full ring-2 ring-(--cc-app) ${agentes[a.id] === "trabajando" ? "animate-pulse" : ""}`}
						style={{ backgroundColor: a.color, opacity: agentes[a.id] === "esperando" ? 0.45 : 1 }}
					/>
				))}
			</span>
			<span
				className="flex items-center gap-1 rounded-full px-2 py-[2px] font-mono text-[11px]"
				style={{ color: LIMA, backgroundColor: `${LIMA}1f` }}
			>
				<span className="size-1.5 animate-pulse rounded-full" style={{ backgroundColor: LIMA }} aria-hidden />
				{cuantos(AGENTES.length, "agente", "agentes")} en vivo{n ? ` · paso ${n} de ${PASOS.length}` : ""}
			</span>
		</button>
	);
}
