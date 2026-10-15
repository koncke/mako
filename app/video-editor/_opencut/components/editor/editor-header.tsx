"use client";

// =============================================================================
// La barra superior del editor, como la de CapCut 9.3 (relevamiento §2)
// =============================================================================
// De izquierda a derecha: «Menú ▾», «✓ Guardado automático: hh:mm:ss», el nombre
// del proyecto CENTRADO (clic para renombrar), y a la derecha «Diseño ▾», el
// teclado de «Atajos» y el botón cian «Exportar». Alto 54 px en la captura
// (≈43 al 100 %), fondo `--cc-app`.
//
// No se copian: el logo de CapCut, «Pro» y «Compartir» (decisión 2 y fuera de
// alcance de docs/diseno-editor-video.md), ni los botones de ventana.
//
// El menú es el de la app reducido a lo que tiene sentido en el navegador:
// Nuevo proyecto, Volver a la página de inicio (Ctrl+Alt+Q), Renombrar,
// Eliminar el proyecto, Atajos y Exportar el marco fijo (el PNG del cuadro
// actual). Ctrl+N no tiene atajo: Chrome no deja tomarlo (§13, decisión 4).

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiMagicIcon, ArrowDown01Icon, KeyboardIcon, Layout01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useChatAbierto } from "@/app/video-editor/_opencut/chat/estado";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import { useRouter } from "@/app/_ui/Link";
import { rutaEditor } from "@/app/video-editor/ruta";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DeleteProjectDialog } from "@/app/video-editor/_opencut/project/components/delete-project-dialog";
import { ShortcutsDialog } from "@/app/video-editor/_opencut/actions/components/shortcuts-dialog";
import { useKeybindingsStore } from "@/app/video-editor/_opencut/actions/keybindings-store";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { isTypableDOMElement } from "@/app/video-editor/_opencut/utils/browser";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { nombreProyectoNuevo } from "@/app/video-editor/_opencut/inicio/nombre";
import { DISENOS, useDisenoStore } from "./diseno-paneles";
import { ExportButton } from "./export-button";

export function EditorHeader() {
	const [renombrando, setRenombrando] = useState(false);
	const [atajos, setAtajos] = useState(false);

	return (
		<header className="grid h-[43px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 bg-(--cc-app) px-[10px]">
			<div className="flex min-w-0 items-center gap-3">
				<MenuApp onRenombrar={() => setRenombrando(true)} onAtajos={() => setAtajos(true)} />
				<GuardadoAutomatico />
			</div>
			<NombreProyecto editando={renombrando} onEditando={setRenombrando} />
			<div className="flex min-w-0 items-center justify-end gap-1.5">
				<MenuDiseno />
				<button
					type="button"
					onClick={() => setAtajos(true)}
					title="Atajos"
					aria-label="Atajos"
					className="flex size-[27px] cursor-pointer items-center justify-center rounded-[4px] text-(--cc-icon) hover:bg-(--cc-raised)"
				>
					<HugeiconsIcon icon={KeyboardIcon} className="size-[18px]" />
				</button>
				<BotonChat />
				<div className="ml-1.5">
					<ExportButton />
				</div>
			</div>
			<ShortcutsDialog isOpen={atajos} onOpenChange={setAtajos} />
		</header>
	);
}

// ── Editar con IA ───────────────────────────────────────────────────────────
// No es de CapCut: es el chat del Landing Generator traído al editor (pedido de Martín del
// 15/10/2026). Abre y cierra la columna del chat (chat/PanelChat.tsx).

function BotonChat() {
	const abierto = useChatAbierto((s) => s.abierto);
	const setAbierto = useChatAbierto((s) => s.setAbierto);
	return (
		<button
			type="button"
			onClick={() => setAbierto(!abierto)}
			aria-pressed={abierto}
			title="Editar con IA"
			className="flex h-[27px] cursor-pointer items-center gap-1.5 rounded-[4px] px-2 text-[12px] text-(--cc-icon) hover:bg-(--cc-raised) aria-pressed:bg-(--cc-raised) aria-pressed:text-(--cc-accent)"
		>
			<HugeiconsIcon icon={AiMagicIcon} className="size-[16px]" />
			Editar con IA
		</button>
	);
}

// ── Menú ▾ ──────────────────────────────────────────────────────────────────

function MenuApp({ onRenombrar, onAtajos }: { onRenombrar: () => void; onAtajos: () => void }) {
	const editor = useEditor();
	const router = useRouter();
	const proyecto = useEditor((e) => e.project.getActiveOrNull());
	const [borrar, setBorrar] = useState(false);
	const saliendo = useRef(false);

	/** Guarda la miniatura y el último cambio antes de soltar el proyecto (lo que hacía «Exit project»). */
	const salir = async (destino: string) => {
		if (saliendo.current) return;
		saliendo.current = true;
		try {
			await editor.project.prepareExit();
		} catch (error) {
			console.error("[editor] no se pudo preparar la salida", error);
		} finally {
			editor.project.closeProject();
			router.push(rutaEditor(destino));
			saliendo.current = false;
		}
	};

	const volverAlInicio = () => void salir("/video-editor");

	const nuevoProyecto = async () => {
		if (saliendo.current) return;
		saliendo.current = true;
		try {
			await editor.project.prepareExit();
			const id = await editor.project.createNewProject({ name: await nombreProyectoNuevo() });
			router.push(rutaEditor(`/video-editor/${id}`));
		} catch (error) {
			console.error("[editor] no se pudo crear el proyecto", error);
			toast.error("Algo salió mal. Intenta de nuevo.");
		} finally {
			saliendo.current = false;
		}
	};

	const exportarMarcoFijo = async () => {
		const r = await editor.renderer.saveSnapshot();
		if (r.success) toast.success("Marco fijo exportado");
		else toast.error("No se pudo exportar");
	};

	const eliminar = async () => {
		if (!proyecto) return;
		setBorrar(false);
		await editor.project.deleteProjects({ ids: [proyecto.metadata.id] });
		router.push(rutaEditor("/video-editor"));
	};

	// Ctrl+Alt+Q: «Volver a la página de inicio» del preset CapCut. Mismas reglas
	// que el registro de atajos: nada con un diálogo abierto ni escribiendo.
	useEffect(() => {
		const alTeclear = (ev: KeyboardEvent) => {
			if (!ev.ctrlKey || !ev.altKey || ev.shiftKey || ev.code !== "KeyQ") return;
			if (useKeybindingsStore.getState().overlayDepth > 0) return;
			const activo = document.activeElement;
			if (activo instanceof HTMLElement && isTypableDOMElement({ element: activo })) return;
			ev.preventDefault();
			volverAlInicio();
		};
		document.addEventListener("keydown", alTeclear, { capture: true });
		return () => document.removeEventListener("keydown", alTeclear, { capture: true });
	});

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex h-[26px] shrink-0 cursor-pointer items-center gap-1 rounded-[4px] bg-(--cc-input) pr-1.5 pl-2.5 text-[12px] text-(--cc-text) hover:brightness-125 data-[state=open]:brightness-125"
					>
						Menú
						<HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-(--cc-text-2)" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-64 text-[12px]">
					<DropdownMenuItem onSelect={() => void nuevoProyecto()}>Nuevo proyecto</DropdownMenuItem>
					<DropdownMenuItem onSelect={volverAlInicio}>
						Volver a la página de inicio
						<DropdownMenuShortcut>Ctrl+Alt+Q</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{/* Los diálogos y el campo se abren DESPUÉS de que el menú se cierre: abrir
					    un Dialog de radix desde el onSelect de un menú deja `pointer-events: none`
					    pegado en <body>, y el campo de nombre perdería el foco en el mismo clic. */}
					<DropdownMenuItem onSelect={() => setTimeout(onRenombrar, 0)}>Renombrar</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => setTimeout(() => setBorrar(true), 0)} className="gap-2">
						<IconoBorrar size={14} />
						Eliminar el proyecto
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => setTimeout(onAtajos, 0)}>Atajos</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => void exportarMarcoFijo()}>Exportar el marco fijo</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<DeleteProjectDialog
				isOpen={borrar}
				onOpenChange={setBorrar}
				onConfirm={() => void eliminar()}
				projectNames={[proyecto?.metadata.name ?? ""]}
			/>
		</>
	);
}

// ── ✓ Guardado automático: hh:mm:ss ─────────────────────────────────────────

function GuardadoAutomatico() {
	// `updatedAt` lo mueve cada guardado (save-manager → saveCurrentProject), y
	// el ProjectManager avisa: no hace falta un evento propio del guardado.
	const actualizado = useEditor((e) => e.project.getActiveOrNull()?.metadata.updatedAt ?? null);
	if (!actualizado) return null;
	const fecha = new Date(actualizado);
	if (Number.isNaN(fecha.getTime())) return null;
	const dos = (n: number) => String(n).padStart(2, "0");
	const hora = `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
	return (
		<span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-(--cc-text-3)">
			<HugeiconsIcon icon={Tick02Icon} className="size-3.5 shrink-0 text-primary" />
			<span className="truncate">{`Guardado automático: ${hora}`}</span>
		</span>
	);
}

// ── El nombre del proyecto, centrado ────────────────────────────────────────

function NombreProyecto({ editando, onEditando }: { editando: boolean; onEditando: (v: boolean) => void }) {
	const editor = useEditor();
	const proyecto = useEditor((e) => e.project.getActiveOrNull());
	const nombre = proyecto?.metadata.name ?? "";

	if (editando && proyecto) {
		return (
			<CampoNombre
				inicial={nombre}
				onFin={async (nuevo) => {
					onEditando(false);
					if (nuevo && nuevo !== nombre) {
						await editor.project.renameProject({ id: proyecto.metadata.id, name: nuevo });
					}
				}}
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={() => onEditando(true)}
			title="Renombrar"
			className="h-[26px] max-w-[40vw] cursor-text truncate rounded-[4px] px-2 text-[13px] text-(--cc-text) hover:bg-(--cc-raised)"
		>
			{nombre}
		</button>
	);
}

/**
 * El campo nace al entrar en edición con el nombre de ESE momento: un guardado
 * automático que cambia el proyecto a mitad de la escritura no pisa lo tecleado.
 * Esc descarta (el ref, y no el estado, porque el blur llega antes del re-render).
 */
function CampoNombre({ inicial, onFin }: { inicial: string; onFin: (nuevo: string | null) => void }) {
	const [borrador, setBorrador] = useState(inicial);
	const descartar = useRef(false);

	return (
		<input
			ref={(el) => {
				if (el && document.activeElement !== el) {
					el.focus();
					el.select();
				}
			}}
			value={borrador}
			maxLength={100}
			onChange={(e) => setBorrador(e.target.value)}
			onBlur={() => onFin(descartar.current ? null : borrador.trim() || null)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					e.currentTarget.blur();
				} else if (e.key === "Escape") {
					e.preventDefault();
					descartar.current = true;
					e.currentTarget.blur();
				}
			}}
			style={{ fieldSizing: "content" }}
			className="h-[26px] max-w-[40vw] min-w-[80px] rounded-[4px] bg-(--cc-input) px-2 text-center text-[13px] text-(--cc-text) outline-none ring-1 ring-primary"
		/>
	);
}

// ── Diseño ▾ ────────────────────────────────────────────────────────────────

function MenuDiseno() {
	const { diseno, elegir, restablecer } = useDisenoStore();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					title="Diseño"
					aria-label="Diseño"
					className="flex h-[27px] cursor-pointer items-center gap-0.5 rounded-[4px] px-1.5 text-(--cc-icon) hover:bg-(--cc-raised) data-[state=open]:bg-(--cc-raised)"
				>
					<HugeiconsIcon icon={Layout01Icon} className="size-[18px]" />
					<HugeiconsIcon icon={ArrowDown01Icon} className="size-3 text-(--cc-text-2)" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				{DISENOS.map((d) => (
					<DropdownMenuItem
						key={d.id}
						onSelect={() => elegir(d.id)}
						className={cn("flex-col items-start gap-0.5 py-2", diseno === d.id && "bg-(--cc-raised)")}
					>
						<span className={cn("text-[12px]", diseno === d.id ? "text-primary" : "text-(--cc-text)")}>{d.etiqueta}</span>
						<span className="text-[11px] text-(--cc-text-3)">{d.descripcion}</span>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={restablecer} className="text-[12px]">
					Restablecer diseño actual
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
