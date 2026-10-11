"use client";

// =============================================================================
// La biblioteca de CapCut (panel izquierdo): pestañas · subcategorías · contenido
// =============================================================================
// Arriba la fila de pestañas (./tabbar.tsx); abajo, a la izquierda, la columna de
// subcategorías de la pestaña (~143 px: los 179 px medidos a 125 %) y a la derecha
// el contenido de la subcategoría elegida. TODO lo que se dibuja sale de la ranura
// `seccionesBiblioteca` (ce/ranuras.ts): esta cáscara no conoce ninguna sección.
// Una pestaña sin nada registrado muestra un estado vacío de una frase.
//
// Una sección con hijos (`padre`) lleva ▾/▴: el clic la elige Y la despliega o
// pliega; los hijos cuelgan debajo, con sangría. Si la sección elegida deja de
// existir (otro paquete la sacó), se elige la primera.

import { Component, type ErrorInfo, type ReactNode, useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import {
	seccionesBiblioteca,
	type CategoriaBiblioteca,
	type SeccionBiblioteca,
} from "@/app/video-editor/ce/ranuras";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { useAssetsPanelStore } from "./assets-panel-store";
import { TabBar } from "./tabbar";
import { VacioBiblioteca } from "./views/biblioteca-ui";

export function AssetsPanel() {
	const activeTab = useAssetsPanelStore((s) => s.activeTab);
	const elegidaGuardada = useAssetsPanelStore((s) => s.seccionElegida[activeTab]);

	// La ranura se llena al importar los módulos (ce/extensiones.ts, antes del
	// primer dibujo): leerla al dibujar alcanza.
	const secciones = useMemo(
		() => seccionesBiblioteca.filtrar((s) => s.categoria === activeTab),
		[activeTab],
	);
	const elegida =
		secciones.find((s) => s.id === elegidaGuardada) ?? primeraSeccion(secciones);

	return (
		<div className="panel bg-background flex h-full flex-col overflow-hidden rounded-[7px]">
			<TabBar />
			<div className="flex min-h-0 flex-1">
				{secciones.length > 0 && (
					<ColumnaSecciones
						categoria={activeTab}
						secciones={secciones}
						elegida={elegida?.id ?? null}
					/>
				)}
				<div className="min-w-0 flex-1 overflow-hidden" role="tabpanel">
					{elegida ? (
						<AislarFallas key={elegida.id}>
							<elegida.Contenido />
						</AislarFallas>
					) : (
						<VacioBiblioteca texto="No hay contenido" />
					)}
				</div>
			</div>
		</div>
	);
}

function primeraSeccion(secciones: SeccionBiblioteca[]): SeccionBiblioteca | undefined {
	return secciones.find((s) => !s.padre) ?? secciones[0];
}

function ColumnaSecciones({
	categoria,
	secciones,
	elegida,
}: {
	categoria: CategoriaBiblioteca;
	secciones: SeccionBiblioteca[];
	elegida: string | null;
}) {
	const elegirSeccion = useAssetsPanelStore((s) => s.elegirSeccion);
	const desplegadas = useAssetsPanelStore((s) => s.desplegadas);
	const alternarDesplegada = useAssetsPanelStore((s) => s.alternarDesplegada);

	const ids = new Set(secciones.map((s) => s.id));
	// Un hijo cuyo padre no está registrado se dibuja como raíz: mejor visible que perdido.
	const raices = secciones.filter((s) => !s.padre || !ids.has(s.padre));
	const hijosDe = (id: string) => secciones.filter((s) => s.padre === id);

	return (
		<nav
			aria-label="Subcategorías"
			className="scrollbar-thin flex w-[143px] shrink-0 flex-col gap-2.5 overflow-y-auto p-2"
		>
			{raices.map((raiz) => {
				const hijos = hijosDe(raiz.id);
				const abierta = hijos.length > 0 && (desplegadas[raiz.id] ?? true);
				const hijoElegido = hijos.some((h) => h.id === elegida);
				return (
					<div key={raiz.id} className="flex flex-col gap-0.5">
						<button
							type="button"
							aria-current={raiz.id === elegida ? "page" : undefined}
							aria-expanded={hijos.length > 0 ? abierta : undefined}
							onClick={() => {
								if (hijos.length > 0) {
									// Plegar el padre del hijo elegido no cambia lo que se ve.
									alternarDesplegada({ id: raiz.id });
									if (hijoElegido && abierta) return;
								}
								elegirSeccion({ categoria, id: raiz.id });
							}}
							className={cn(
								"flex h-[29px] w-full shrink-0 cursor-pointer items-center justify-between gap-1 rounded-[4px] bg-[var(--cc-raised)] px-2.5 text-left text-[12px] outline-none",
								"hover:brightness-110 focus-visible:ring-1 focus-visible:ring-primary",
								raiz.id === elegida ? "text-primary" : "text-[var(--cc-text)]",
							)}
						>
							<span className="truncate">{raiz.etiqueta}</span>
							{hijos.length > 0 && (
								<HugeiconsIcon
									icon={ArrowDown01Icon}
									className={cn(
										"size-3 shrink-0 text-[var(--cc-text-2)] transition-transform",
										abierta && "rotate-180",
									)}
								/>
							)}
						</button>
						{abierta &&
							hijos.map((hijo) => (
								<button
									key={hijo.id}
									type="button"
									aria-current={hijo.id === elegida ? "page" : undefined}
									onClick={() => elegirSeccion({ categoria, id: hijo.id })}
									className={cn(
										"flex h-[26px] w-full shrink-0 cursor-pointer items-center rounded-[4px] pr-2 pl-5 text-left text-[12px] outline-none",
										"hover:bg-[var(--cc-raised)]/60 focus-visible:ring-1 focus-visible:ring-primary",
										hijo.id === elegida
											? "text-primary"
											: "text-[var(--cc-text-2)] hover:text-[var(--cc-text)]",
									)}
								>
									<span className="truncate">{hijo.etiqueta}</span>
								</button>
							))}
					</div>
				);
			})}
		</nav>
	);
}

/**
 * Las secciones las escriben paquetes distintos: una que se rompe no puede tirar
 * el editor entero (con el proyecto abierto y sin guardar). Se reemplaza por el
 * aviso de CapCut y se deja el error en la consola.
 */
class AislarFallas extends Component<{ children: ReactNode }, { fallo: boolean }> {
	state = { fallo: false };

	static getDerivedStateFromError() {
		return { fallo: true };
	}

	componentDidCatch(error: unknown, info: ErrorInfo) {
		console.error("[biblioteca] una sección falló al dibujarse", error, info.componentStack);
	}

	render() {
		return this.state.fallo ? <VacioBiblioteca texto="Error al cargar" /> : this.props.children;
	}
}
