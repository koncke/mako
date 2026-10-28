"use client";

// =============================================================================
// El marco del Video Editor con MaKo: la tarjeta del chat a la izquierda y el editor a su derecha (27/10/2026)
// =============================================================================
// Pedido de Martín (27/10/2026), textual: «veas de adaptar las tabs de video e imagen con el chat que tenemos de MaKo,
// para que se pueda editar con prompting, algo similar a lo que hicimos con Web Generator, que este al costado, que los
// "proyectos" se vean en la barra del costado, y que no cambie de ruta... Tambien ponle los colores de MaKo a esas tabs».
//
// COPIADO DEL WEB GENERATOR (app/web-generator/editor/EditorLanding.tsx, `.gma-cuerpo`/`.gma-izq`), como ya lo hizo el
// Image Editor en esta rama (app/image-editor/_doory/editor/EditorApp.tsx → `ChatFijo`):
//   · a la izquierda, de punta a punta, la tarjeta FLOTANTE de 340 px (8 de aire, radio 12): el chat de MaKo
//     (chat/PanelChat.tsx, el panel único) o, con su «←», la lista de proyectos (inicio/PanelProyectos.tsx), sin navegar;
//   · a la derecha el editor de CapCut entero (la barra de arriba incluida), o el inicio («Crear proyecto» y todos los
//     proyectos) EN SU LUGAR, como «¿Qué vas a crear hoy?» del Web Generator (`creando`): «Nuevo proyecto» de la lista,
//     «Volver a la página de inicio» del Menú, o no hay ningún proyecto.
//
// NO CAMBIA DE RUTA. El proyecto abierto es estado de ESTE componente (`idAbierto`), no la URL: abrir otro guarda lo
// pendiente del abierto (`guardarAhora`, lo mismo que hacía la salida: la miniatura y el guardado que falta), cambia el
// proyecto y el EditorProvider lo carga en el lugar. La URL lo acompaña con `history.replaceState` (../proyectos.ts →
// `urlDelProyecto`, con el `?ws=`), así que recargar vuelve a abrir el mismo. `/video-editor` (la ruta sin proyecto)
// abre el último que se tocó.
//
// ⚠️ LA LISTA SE CARGA ANTES DE ABRIR UN PROYECTO (`loadAllProjects`). Cargada con un proyecto ya abierto, el
//    ProjectManager pasa a «cargando» mientras lee, y el guardado automático que caiga en ese rato se pierde
//    (docs/hallazgos-video-editor.md, «El almacenamiento es por ORIGEN»). Por eso el editor espera a la lista.
// ⚠️ EL EDITOR NO SE DESMONTA AL CAMBIAR DE PROYECTO (sin `key`): su desmontaje guarda «al salir» una microtarea después,
//    y con el proyecto nuevo cargándose le pondría la miniatura del viejo al nuevo. El EditorProvider ya recarga cuando
//    cambia `projectId`. Sí se desmonta para mostrar el inicio: ahí no se carga otro hasta que la persona elige.
// ⚠️ EN UN TELÉFONO (< 768 px) no entran los dos: va la tarjeta a todo el ancho (el chat se usa igual: el proyecto se
//    carga detrás, sin dibujar el editor, `soloCarga`), y «Ver el editor» la cambia por el editor (con su aviso «Solo
//    para computadora»); la estrella de abajo vuelve. Es el mismo reparto que el Image Editor en pantalla chica.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Muneco } from "@/app/admin/operaciones/Muneco";
import { ASPECTO_MAKO } from "@/lib/centro-munecos";
import { rutaProyecto, ultimoProyecto, urlDelProyecto } from "@/app/video-editor/proyectos";
import { EditorPage } from "./editor-page";
import { ProjectsPage } from "./inicio/projects-page";
import { PanelProyectos } from "./inicio/PanelProyectos";
import { ProveedorProyectoAbierto, type ProyectoAbierto } from "./inicio/proyecto-abierto";
import { nombreProyectoNuevo } from "./inicio/nombre";
import { PanelChat } from "./chat/PanelChat";
import { useChatAbierto } from "./chat/estado";
import { useEditor } from "./editor/use-editor";
import { StoragePersistenceDialog } from "./services/storage/components/storage-persistence-dialog";

/** El teléfono: la tarjeta y el editor no entran juntos (capcut-theme.css, `.ce-marco`, usa el mismo corte). */
const ANGOSTA = "(max-width: 767px)";

const suscribirAngosta = (alCambiar: () => void) => {
	const mq = window.matchMedia(ANGOSTA);
	mq.addEventListener("change", alCambiar);
	return () => mq.removeEventListener("change", alCambiar);
};
const esAngosta = () => window.matchMedia(ANGOSTA).matches;

function useAngosta(): boolean {
	return useSyncExternalStore(suscribirAngosta, esAngosta, () => false);
}

export function MarcoEditor({ proyectoId, propuesta }: { proyectoId: string | null; propuesta: string | null }) {
	const editor = useEditor();
	const listos = useEditor((e) => e.project.getIsInitialized());
	const enChat = useChatAbierto((s) => s.abierto);
	const angosta = useAngosta();
	// `undefined`: todavía no se sabe cuál (la ruta sin proyecto espera la lista para abrir el último).
	const [idAbierto, setIdAbierto] = useState<string | null | undefined>(proyectoId ?? undefined);
	// El inicio en lugar del editor (`creando` del Web Generator): se ve mientras la tarjeta muestra la lista.
	const [nueva, setNueva] = useState(false);
	// El `?propuesta=` del link es del proyecto con que se entró: al cambiar de proyecto se suelta.
	const [propuestaViva, setPropuestaViva] = useState(propuesta);
	// En el teléfono, qué se ve: la tarjeta o el editor.
	const [movil, setMovil] = useState<"chat" | "editor">("chat");
	const ocupado = useRef(false);

	// Una navegación DE VERDAD a otro proyecto (la vuelta de «Editar en el editor» o de una plantilla) trae otra ruta.
	const [deLaRuta, setDeLaRuta] = useState(proyectoId);
	if (deLaRuta !== proyectoId) {
		setDeLaRuta(proyectoId);
		setIdAbierto(proyectoId ?? undefined);
		setNueva(false);
		setPropuestaViva(propuesta);
	}

	// Volver al chat (la estrella de la lista, una propuesta nueva) cierra el inicio, como en el Web Generator.
	const [chatAntes, setChatAntes] = useState(enChat);
	if (chatAntes !== enChat) {
		setChatAntes(enChat);
		if (enChat) setNueva(false);
	}

	// La lista de proyectos, ANTES de abrir ninguno (ver la cabecera).
	useEffect(() => {
		if (!editor.project.getIsInitialized()) void editor.project.loadAllProjects();
	}, [editor]);

	// La ruta sin proyecto abre el último que se tocó (sin ninguno, el inicio). Se decide UNA vez, con la lista.
	if (idAbierto === undefined && listos) {
		setIdAbierto(ultimoProyecto(editor.project.getSavedProjects())?.id ?? null);
	}

	// La URL acompaña al proyecto abierto SIN navegar: recargar vuelve a abrir el mismo. Sólo si cambió el proyecto: la
	// URL de entrada conserva su `?propuesta=`.
	useEffect(() => {
		if (idAbierto === undefined) return;
		if (window.location.pathname === rutaProyecto(idAbierto)) return;
		window.history.replaceState(null, "", urlDelProyecto(idAbierto, window.location.search));
	}, [idAbierto]);

	/** Lo pendiente del proyecto abierto, antes de soltarlo: la miniatura (y su guardado) y lo que quede por guardar. */
	const guardarAhora = useCallback(async () => {
		if (!editor.project.getActiveOrNull()) return;
		try {
			await editor.project.prepareExit();
		} catch (error) {
			console.error("[editor] no se pudo preparar el cambio de proyecto", error);
		}
		if (editor.save.getIsDirty()) await editor.save.flush().catch(() => {});
	}, [editor]);

	const abrir = useCallback(
		async (id: string) => {
			useChatAbierto.getState().setAbierto(true);
			setMovil("chat");
			if (ocupado.current) return;
			if (id === idAbierto) {
				setNueva(false);
				return;
			}
			ocupado.current = true;
			try {
				await guardarAhora();
				setPropuestaViva(null);
				setIdAbierto(id);
				setNueva(false);
			} finally {
				ocupado.current = false;
			}
		},
		[idAbierto, guardarAhora],
	);

	const crear = useCallback(async () => {
		if (ocupado.current) return;
		ocupado.current = true;
		try {
			await guardarAhora();
			const id = await editor.project.createNewProject({ name: await nombreProyectoNuevo() });
			setPropuestaViva(null);
			setIdAbierto(id);
			setNueva(false);
			setMovil("chat");
			useChatAbierto.getState().setAbierto(true);
		} catch (error) {
			console.error("[editor] no se pudo crear el proyecto", error);
			toast.error("Algo salió mal. Intenta de nuevo.");
		} finally {
			ocupado.current = false;
		}
	}, [editor, guardarAhora]);

	const verInicio = useCallback(() => {
		setNueva(true);
		setMovil("editor");
		useChatAbierto.getState().setAbierto(false);
	}, []);

	const alBorrar = useCallback(
		(ids: readonly string[]) => {
			if (!idAbierto || !ids.includes(idAbierto)) return;
			setPropuestaViva(null);
			setIdAbierto(null);
			setNueva(true);
			useChatAbierto.getState().setAbierto(false);
		},
		[idAbierto],
	);

	const abierto = typeof idAbierto === "string" ? idAbierto : null;
	const inicio = idAbierto === null || (nueva && !enChat);
	const valor = useMemo<ProyectoAbierto>(
		() => ({ id: abierto, inicio, abrir, crear, verInicio, alBorrar }),
		[abierto, inicio, abrir, crear, verInicio, alBorrar],
	);

	return (
		<ProveedorProyectoAbierto value={valor}>
			<div className="ce-marco" data-movil={movil}>
				{/* Un <section> y no un <aside>: con la barra de la agencia, `[data-barra-agencia] aside` (app/globals.css) le
				    fuerza a todo <aside> el alto de la ventana (lo mismo que `.gma-izq` del Web Generator). */}
				<section role="complementary" className="ce-izq" aria-label={enChat ? "Edición con IA" : "Tus proyectos"}>
					{enChat ? (
						<PanelChat
							onProyectos={() => useChatAbierto.getState().setAbierto(false)}
							onVerEditor={() => setMovil("editor")}
						/>
					) : (
						<PanelProyectos />
					)}
				</section>
				<div className="ce-der">
					{!listos || idAbierto === undefined ? (
						<div className="flex min-h-0 flex-1 items-center justify-center">
							<Loader2 className="size-8 animate-spin text-(--cc-text-3)" aria-label="Cargando" />
						</div>
					) : inicio || !abierto ? (
						<ProjectsPage />
					) : (
						<EditorPage
							projectId={abierto}
							propuesta={propuestaViva}
							soloCarga={angosta && movil === "chat"}
							onAtras={angosta ? () => setMovil("chat") : verInicio}
						/>
					)}
					{/* En el teléfono, la vuelta a la tarjeta (sólo se ve ahí: capcut-theme.css, `.ce-volver-mako`). */}
					<button
						type="button"
						className="ce-volver-mako"
						onClick={() => setMovil("chat")}
						title="Volver al chat con MaKo"
						aria-label="Volver al chat con MaKo"
					>
						<Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={30} />
					</button>
				</div>
				<StoragePersistenceDialog />
			</div>
		</ProveedorProyectoAbierto>
	);
}
