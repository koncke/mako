"use client";

// =============================================================================
// PanelProyectos — los proyectos en la tarjeta de MaKo, la otra cara del chat (27/10/2026)
// =============================================================================
// Martín, 27/10/2026: «algo similar a lo que hicimos con Web Generator, que este al costado, que los "proyectos" se vean
// en la barra del costado, y que no cambie de ruta». Copiado de la lista de landings del Web Generator
// (app/web-generator/editor/paneles/PanelLandings.tsx, que a su vez copia la tarjeta de Automations): buscar arriba con la
// estrella de MaKo para volver al chat, «Nuevo proyecto» como primer renglón, los proyectos (el último que se tocó
// primero) y al pie «Ver todos los proyectos».
//
// Nada navega: un renglón abre ese proyecto EN EL LUGAR (../marco.tsx guarda lo pendiente del abierto y acompaña la URL
// con `history.replaceState`), y «Nuevo proyecto» pone el inicio («Crear proyecto» y todos los proyectos, con renombrar,
// duplicar y eliminar) en lugar del editor, como «¿Qué vas a crear hoy?» del Web Generator.
//
// La lista es la del ProjectManager (`getSavedProjects`), que el marco carga ANTES de abrir un proyecto: cargarla con el
// proyecto ya abierto lo pone en «cargando» y frena el guardado automático (docs/hallazgos-video-editor.md, «El
// almacenamiento es por ORIGEN»). Crear, renombrar, duplicar y borrar la mantienen al día solos.
// =============================================================================

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { Muneco } from "@/app/admin/operaciones/Muneco";
import { ASPECTO_MAKO } from "@/lib/centro-munecos";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { proyectosDeLaLista } from "@/app/video-editor/proyectos";
import { useChatAbierto } from "../chat/estado";
import { useProyectoAbierto } from "./proyecto-abierto";

export function PanelProyectos() {
	const { id, inicio, abrir, verInicio } = useProyectoAbierto();
	const listos = useEditor((e) => e.project.getIsInitialized());
	const proyectos = useEditor((e) => e.project.getSavedProjects());
	const [busca, setBusca] = useState("");
	const visibles = useMemo(() => proyectosDeLaLista(proyectos, busca), [proyectos, busca]);

	return (
		<div className="ce-ls">
			<div className="ce-ls-cab">
				<input
					className="ce-ls-busca"
					value={busca}
					onChange={(e) => setBusca(e.target.value)}
					placeholder="Buscar"
					aria-label="Buscar un proyecto"
				/>
				<button
					type="button"
					className="ce-ls-mako"
					onClick={() => useChatAbierto.getState().setAbierto(true)}
					title="Volver al chat con MaKo"
					aria-label="Volver al chat con MaKo"
				>
					<Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={26} />
				</button>
			</div>
			<nav className="ce-ls-lista" aria-label="Tus proyectos">
				<button
					type="button"
					className="ce-ls-item ce-ls-nueva"
					aria-current={inicio ? "true" : undefined}
					onClick={verInicio}
				>
					<HugeiconsIcon icon={PlusSignIcon} className="size-3.5 shrink-0" />
					<span>Nuevo proyecto</span>
				</button>
				{!listos ? (
					<p className="ce-ls-aviso">Cargando…</p>
				) : visibles.length === 0 ? (
					<p className="ce-ls-aviso">{busca.trim() ? "Ninguno se llama así." : "Todavía no hay proyectos."}</p>
				) : (
					visibles.map((p) => (
						<button
							key={p.id}
							type="button"
							className="ce-ls-item"
							aria-current={!inicio && p.id === id ? "true" : undefined}
							onClick={() => void abrir(p.id)}
							title={p.name || "Sin nombre"}
						>
							{p.thumbnail ? (
								// eslint-disable-next-line @next/next/no-img-element -- dataURL local de la miniatura
								<img className="ce-ls-mini" src={p.thumbnail} alt="" />
							) : (
								<span className="ce-ls-mini" aria-hidden>
									<HugeiconsIcon icon={Video01Icon} className="size-3.5" />
								</span>
							)}
							<span>{p.name || "Sin nombre"}</span>
						</button>
					))
				)}
			</nav>
			<div className="ce-ls-pie">
				<button type="button" onClick={verInicio}>
					Ver todos los proyectos
				</button>
			</div>
		</div>
	);
}
