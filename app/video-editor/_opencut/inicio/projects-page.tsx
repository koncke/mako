"use client";

// =============================================================================
// /video-editor: el inicio de CapCut, adentro de MaKo
// =============================================================================
// Copia de la pantalla de inicio de CapCut Desktop 9.3 (relevamiento §8,
// `pc_home.png`) sin su barra lateral (acá está la de MaKo) ni lo que MaKo no
// tiene (Pro, plantillas, herramientas de IA, Papelera, Sincronización):
//
//   · el banner grande «⊞ Crear proyecto», degradado cian #60d5e1→#13bddc con
//     texto oscuro (1150×215 en la captura ≈ 920×172);
//   · «Proyectos», con «Buscar» y la vista «Cuadrícula»/«Lista» a la derecha;
//   · tarjetas de ~118 px (147 en la captura) con la miniatura, el nombre y
//     «tamaño | duración» («9.1K | 00:00»), y el menú Abrir · Renombrar ·
//     Duplicar · Eliminar.
//
// El nombre de un proyecto nuevo es la fecha MMDD, como CapCut (./nombre.ts).
// La vista elegida se recuerda en este navegador (./store.ts).

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowDown01Icon,
	GridViewIcon,
	LeftToRightListDashIcon,
	MoreHorizontalIcon,
	PlusSignSquareIcon,
	Search01Icon,
	Video01Icon,
} from "@hugeicons/core-free-icons";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import Link, { useRouter } from "@/app/_ui/Link";
import { rutaEditor } from "@/app/video-editor/ruta";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { TProjectMetadata } from "@/app/video-editor/_opencut/project/types";
import { MigrationDialog } from "@/app/video-editor/_opencut/project/components/migration-dialog";
import { DeleteProjectDialog } from "@/app/video-editor/_opencut/project/components/delete-project-dialog";
import { RenameProjectDialog } from "@/app/video-editor/_opencut/project/components/rename-project-dialog";
import { StoragePersistenceDialog } from "@/app/video-editor/_opencut/services/storage/components/storage-persistence-dialog";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/app/video-editor/_opencut/components/ui/dropdown-menu";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { useProjectsStore, type ProjectsViewMode } from "./store";
import { nombreLibre, nombreProyectoNuevo } from "./nombre";
import { formatoDuracionTarjeta, formatoPeso, useTamanoProyecto } from "./tamano";

const VISTAS: { modo: ProjectsViewMode; etiqueta: string; icono: typeof GridViewIcon }[] = [
	{ modo: "grid", etiqueta: "Cuadrícula", icono: GridViewIcon },
	{ modo: "list", etiqueta: "Lista", icono: LeftToRightListDashIcon },
];

export function ProjectsPage() {
	const editor = useEditor();
	const { searchQuery } = useProjectsStore();
	const isLoading = useEditor((e) => e.project.getIsLoading());
	const isInitialized = useEditor((e) => e.project.getIsInitialized());
	const proyectos = useEditor((e) =>
		e.project.getFilteredAndSortedProjects({ searchQuery, sortOption: "updatedAt-desc" }),
	);
	const total = useEditor((e) => e.project.getSavedProjects().length);

	useEffect(() => {
		if (!editor.project.getIsInitialized()) {
			void editor.project.loadAllProjects();
		}
	}, [editor.project]);

	return (
		<div
			className="min-h-full bg-(--cc-home)"
			// El resplandor verde azulado de arriba del inicio de CapCut, que se apaga a los ~260 px.
			style={{ backgroundImage: "linear-gradient(to bottom, var(--cc-home-glow), var(--cc-home) 260px)" }}
		>
			<MigrationDialog />
			<StoragePersistenceDialog />
			<main className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-8 pt-7 pb-10">
				<CrearProyecto />
				<section className="flex flex-col gap-4">
					<BarraProyectos />
					{isLoading || !isInitialized ? (
						<Esqueleto />
					) : proyectos.length === 0 ? (
						<Vacio hayProyectos={total > 0} />
					) : (
						<Lista proyectos={proyectos} />
					)}
				</section>
			</main>
		</div>
	);
}

// ── «⊞ Crear proyecto» ──────────────────────────────────────────────────────

function CrearProyecto() {
	const editor = useEditor();
	const router = useRouter();
	const [creando, setCreando] = useState(false);

	const crear = async () => {
		if (creando) return;
		setCreando(true);
		try {
			const id = await editor.project.createNewProject({ name: await nombreProyectoNuevo() });
			router.push(rutaEditor(`/video-editor/${id}`));
		} catch (error) {
			console.error("[inicio] no se pudo crear el proyecto", error);
			toast.error("Algo salió mal. Intenta de nuevo.");
			setCreando(false);
		}
	};

	return (
		<button
			type="button"
			onClick={() => void crear()}
			disabled={creando}
			className="flex h-[172px] w-full max-w-[920px] cursor-pointer items-center justify-center gap-3 rounded-[10px] bg-linear-to-r from-(--cc-create-from) to-(--cc-create-to) text-(--cc-on-create) transition-[filter] hover:brightness-105 disabled:cursor-wait disabled:opacity-80"
		>
			<HugeiconsIcon icon={PlusSignSquareIcon} className="size-7" strokeWidth={2} />
			<span className="text-[20px] font-semibold">Crear proyecto</span>
		</button>
	);
}

// ── «Proyectos» con Buscar y la vista ───────────────────────────────────────

function BarraProyectos() {
	return (
		<div className="flex h-8 items-center justify-between gap-4">
			<h2 className="text-[16px] font-semibold text-(--cc-text)">Proyectos</h2>
			<div className="flex items-center gap-2">
				<Buscar />
				<MenuVista />
			</div>
		</div>
	);
}

function Buscar() {
	const { searchQuery, setSearchQuery } = useProjectsStore();
	const [abierto, setAbierto] = useState(searchQuery.length > 0);
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (abierto) input.current?.focus();
	}, [abierto]);

	if (!abierto) {
		return (
			<button
				type="button"
				onClick={() => setAbierto(true)}
				title="Buscar"
				aria-label="Buscar"
				className="flex size-8 cursor-pointer items-center justify-center rounded-[6px] bg-(--cc-home-btn) text-(--cc-icon) hover:brightness-125"
			>
				<HugeiconsIcon icon={Search01Icon} className="size-4" />
			</button>
		);
	}

	return (
		<label className="flex h-8 w-[220px] items-center gap-2 rounded-[6px] bg-(--cc-home-btn) px-2.5 ring-1 ring-transparent focus-within:ring-primary">
			<HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0 text-(--cc-text-3)" />
			<input
				ref={input}
				value={searchQuery}
				placeholder="Buscar"
				onChange={(e) => setSearchQuery({ query: e.target.value })}
				onBlur={() => {
					if (!searchQuery) setAbierto(false);
				}}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						setSearchQuery({ query: "" });
						setAbierto(false);
					}
				}}
				className="min-w-0 flex-1 bg-transparent text-[13px] text-(--cc-text) outline-none placeholder:text-(--cc-text-3)"
			/>
		</label>
	);
}

function MenuVista() {
	const { viewMode, isHydrated, setViewMode } = useProjectsStore();
	const actual = VISTAS.find((v) => v.modo === (isHydrated ? viewMode : "grid")) ?? VISTAS[0];
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					title={actual.etiqueta}
					aria-label={actual.etiqueta}
					className="flex h-8 cursor-pointer items-center gap-0.5 rounded-[6px] bg-(--cc-home-btn) px-2 text-(--cc-icon) hover:brightness-125"
				>
					<HugeiconsIcon icon={actual.icono} className="size-4" />
					<HugeiconsIcon icon={ArrowDown01Icon} className="size-3 text-(--cc-text-3)" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-40">
				{VISTAS.map((v) => (
					<DropdownMenuItem
						key={v.modo}
						onSelect={() => setViewMode({ viewMode: v.modo })}
						className={cn("text-[12px]", v.modo === actual.modo && "text-primary")}
					>
						<HugeiconsIcon icon={v.icono} className="size-4" />
						{v.etiqueta}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── Las tarjetas ────────────────────────────────────────────────────────────

function Lista({ proyectos }: { proyectos: TProjectMetadata[] }) {
	const { viewMode, isHydrated } = useProjectsStore();
	const enLista = isHydrated && viewMode === "list";
	if (enLista) {
		return (
			<div className="flex flex-col">
				<div className="grid h-8 grid-cols-[minmax(0,1fr)_90px_90px_150px_36px] items-center gap-3 border-b border-(--cc-line-2) px-2 text-[11px] text-(--cc-text-3)">
					<span>Nombre</span>
					<span>Tamaño</span>
					<span>Duración</span>
					<span>Última modificación</span>
					<span />
				</div>
				{proyectos.map((p) => (
					<Proyecto key={p.id} proyecto={p} vista="list" />
				))}
			</div>
		);
	}
	return (
		<div className="grid grid-cols-[repeat(auto-fill,118px)] gap-x-5 gap-y-5">
			{proyectos.map((p) => (
				<Proyecto key={p.id} proyecto={p} vista="grid" />
			))}
		</div>
	);
}

async function duplicar(editor: EditorCore, proyecto: TProjectMetadata) {
	const [nuevo] = await editor.project.duplicateProjects({ ids: [proyecto.id] });
	if (!nuevo) return;
	// El motor nombra la copia «(1) 1011»; CapCut deja «1011 (1)», como un proyecto
	// nuevo del mismo día. Se renombra con la misma regla que los nuevos.
	const base = proyecto.name.replace(/\s\(\d+\)$/, "");
	const existentes = editor.project.getSavedProjects().map((p) => p.name);
	await editor.project.renameProject({ id: nuevo, name: nombreLibre(base, existentes) });
}

function Proyecto({ proyecto, vista }: { proyecto: TProjectMetadata; vista: ProjectsViewMode }) {
	const editor = useEditor();
	const router = useRouter();
	const bytes = useTamanoProyecto(proyecto);
	const [menu, setMenu] = useState(false);
	const [renombrar, setRenombrar] = useState(false);
	const [borrar, setBorrar] = useState(false);
	const href = rutaEditor(`/video-editor/${proyecto.id}`);
	const peso = bytes === null ? "—" : formatoPeso(bytes);
	const duracion = formatoDuracionTarjeta(proyecto.duration);

	// Los diálogos se abren una vuelta después del onSelect del menú: abrir un
	// Dialog de radix mientras el menú se cierra deja `pointer-events: none` en <body>.
	const acciones = {
		abrir: () => router.push(href),
		renombrar: () => setTimeout(() => setRenombrar(true), 0),
		duplicar: () =>
			void duplicar(editor, proyecto).catch(() => toast.error("Algo salió mal. Intenta de nuevo.")),
		eliminar: () => setTimeout(() => setBorrar(true), 0),
	};

	const miniatura = (clase: string, icono: string) => (
		<div className={cn("relative flex items-center justify-center overflow-hidden bg-(--cc-panel)", clase)}>
			{proyecto.thumbnail ? (
				// eslint-disable-next-line @next/next/no-img-element -- dataURL local de la miniatura
				<img src={proyecto.thumbnail} alt="" className="size-full object-cover" />
			) : (
				<HugeiconsIcon icon={Video01Icon} className={cn("text-(--cc-text-3)", icono)} />
			)}
		</div>
	);

	const botonMenu = (
		<MenuProyecto abierto={menu} onAbierto={setMenu} acciones={acciones}>
			<button
				type="button"
				aria-label="Más"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
				className={cn(
					"flex size-6 cursor-pointer items-center justify-center rounded-[4px] text-(--cc-text) hover:bg-(--cc-raised)",
					vista === "grid" && "absolute top-1.5 right-1.5 bg-black/55",
					vista === "grid" && !menu && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
				)}
			>
				<HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
			</button>
		</MenuProyecto>
	);

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					{vista === "grid" ? (
						<div className="group relative flex min-w-0 flex-col gap-1.5">
							<Link
								href={href}
								className="block rounded-[8px] ring-primary ring-offset-2 ring-offset-(--cc-home) outline-none group-hover:ring-2 focus-visible:ring-2"
							>
								{miniatura("aspect-square w-full rounded-[8px]", "size-8")}
							</Link>
							{botonMenu}
							<Link href={href} className="truncate text-[12px] text-(--cc-text)" title={proyecto.name}>
								{proyecto.name}
							</Link>
							<span className="text-[11px] text-(--cc-text-3) tabular-nums">{`${peso} | ${duracion}`}</span>
						</div>
					) : (
						<div className="group grid h-12 grid-cols-[minmax(0,1fr)_90px_90px_150px_36px] items-center gap-3 border-b border-(--cc-line-2)/60 px-2 text-[12px] hover:bg-(--cc-home-btn)">
							<Link href={href} className="flex min-w-0 items-center gap-3">
								{miniatura("size-9 shrink-0 rounded-[4px]", "size-4")}
								<span className="truncate text-(--cc-text)">{proyecto.name}</span>
							</Link>
							<span className="text-(--cc-text-3) tabular-nums">{peso}</span>
							<span className="text-(--cc-text-3) tabular-nums">{duracion}</span>
							<span className="text-(--cc-text-3) tabular-nums">{fechaCorta(proyecto.updatedAt)}</span>
							{botonMenu}
						</div>
					)}
				</ContextMenuTrigger>
				<ContextMenuContent className="w-44 text-[12px]">
					<ContextMenuItem onSelect={acciones.abrir}>Abrir</ContextMenuItem>
					<ContextMenuItem onSelect={acciones.renombrar}>Renombrar</ContextMenuItem>
					<ContextMenuItem onSelect={acciones.duplicar}>Duplicar</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem onSelect={acciones.eliminar} className="gap-2">
						<IconoBorrar size={14} />
						Eliminar
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>

			<RenameProjectDialog
				isOpen={renombrar}
				onOpenChange={setRenombrar}
				projectName={proyecto.name}
				onConfirm={async (nombre) => {
					setRenombrar(false);
					await editor.project.renameProject({ id: proyecto.id, name: nombre });
				}}
			/>
			<DeleteProjectDialog
				isOpen={borrar}
				onOpenChange={setBorrar}
				projectNames={[proyecto.name]}
				onConfirm={async () => {
					setBorrar(false);
					await editor.project.deleteProjects({ ids: [proyecto.id] });
				}}
			/>
		</>
	);
}

function MenuProyecto({
	abierto,
	onAbierto,
	acciones,
	children,
}: {
	abierto: boolean;
	onAbierto: (v: boolean) => void;
	acciones: Record<"abrir" | "renombrar" | "duplicar" | "eliminar", () => void>;
	children: React.ReactNode;
}) {
	return (
		<DropdownMenu open={abierto} onOpenChange={onAbierto}>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44 text-[12px]">
				<DropdownMenuItem onSelect={acciones.abrir}>Abrir</DropdownMenuItem>
				<DropdownMenuItem onSelect={acciones.renombrar}>Renombrar</DropdownMenuItem>
				<DropdownMenuItem onSelect={acciones.duplicar}>Duplicar</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={acciones.eliminar} className="gap-2">
					<IconoBorrar size={14} />
					Eliminar
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function fechaCorta(fecha: Date): string {
	const f = new Date(fecha);
	if (Number.isNaN(f.getTime())) return "—";
	const dos = (n: number) => String(n).padStart(2, "0");
	return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} ${dos(f.getHours())}:${dos(f.getMinutes())}`;
}

// ── Estados ─────────────────────────────────────────────────────────────────

function Esqueleto() {
	const ids = useMemo(() => Array.from({ length: 12 }, (_, i) => `esqueleto-${i}`), []);
	return (
		<div className="grid grid-cols-[repeat(auto-fill,118px)] gap-x-5 gap-y-5">
			{ids.map((id) => (
				<div key={id} className="flex flex-col gap-1.5">
					<div className="aspect-square w-full animate-pulse rounded-[8px] bg-(--cc-panel)" />
					<div className="h-3 w-3/4 animate-pulse rounded bg-(--cc-panel)" />
					<div className="h-3 w-1/2 animate-pulse rounded bg-(--cc-panel)" />
				</div>
			))}
		</div>
	);
}

function Vacio({ hayProyectos }: { hayProyectos: boolean }) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
			<HugeiconsIcon icon={hayProyectos ? Search01Icon : Video01Icon} className="size-8 text-(--cc-text-3)" />
			<p className="max-w-[360px] text-[13px] text-(--cc-text-3)">
				{hayProyectos
					? "No se encontraron resultados"
					: "El proyecto editado se guardará automáticamente. ¡Comienza a crear tus propios videos!"}
			</p>
		</div>
	);
}
