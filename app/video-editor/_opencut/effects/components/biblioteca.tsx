"use client";

// =============================================================================
// La biblioteca de color de CapCut: Efectos, Filtros y Ajuste (panel izquierdo)
// =============================================================================
// Lo que se dibuja a la derecha de la columna de subcategorías (las secciones
// las registra ../registro-ce.ts). Las piezas comunes (buscador, grilla, título
// de grupo, vacío, zona de importar) son las de la biblioteca
// (panels/assets/views/biblioteca-ui.tsx), para que se vea como UNA biblioteca.
//
// Cada tarjeta, como en CapCut: ⊕ agrega una CAPA de 3 s en el cabezal (que
// afecta a todo lo de abajo); arrastrada sobre un clip de video o imagen se
// aplica sólo a ese clip; arrastrada a un hueco, capa ahí.

import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { effectsRegistry, registerDefaultEffects } from "@/app/video-editor/_opencut/effects";
import type { EffectDefinition } from "@/app/video-editor/_opencut/effects/types";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { DraggableItem } from "@/app/video-editor/_opencut/components/editor/panels/assets/draggable-item";
import {
	BuscadorBiblioteca,
	ContenidoBiblioteca,
	GrillaBiblioteca,
	TituloGrupo,
	VacioBiblioteca,
	ZonaImportar,
	normalizarBusqueda,
	useBusqueda,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import { agregarCapaEfecto, DESTINOS_CLIP } from "../capas";
import { CATEGORIAS_EFECTO, TENDENCIAS_EFECTO } from "../definitions/efectos";
import { CATEGORIAS_FILTRO } from "../definitions/filtros";
import { TIPO_AJUSTE } from "../definitions/ajuste";
import { eliminarLut, importarLuts, useBibliotecaLuts, asegurarLuts } from "../lut/biblioteca-luts";
import { LUT_NO_COMPATIBLE } from "../lut/leer-lut";
import { asegurarPredefinidos, eliminarPredefinido, usePredefinidos } from "../predefinidos";
import { MiniaturaEfecto, type FuenteMiniatura } from "./miniatura";

function definiciones(clase: "efecto" | "filtro"): EffectDefinition[] {
	registerDefaultEffects();
	return effectsRegistry.getAll().filter((d) => (d.clase ?? "efecto") === clase);
}

function coincide(def: EffectDefinition, consulta: string): boolean {
	if (!consulta) return true;
	return normalizarBusqueda([def.name, ...def.keywords].join(" ")).includes(consulta);
}

// ── Tarjeta ──────────────────────────────────────────────────────────────────

function TarjetaEfecto({
	definicion,
	fuente,
	params,
	nombre,
	aCapa = false,
	quitar,
}: {
	definicion: EffectDefinition;
	fuente: FuenteMiniatura;
	params?: ParamValues;
	nombre?: string;
	/** Sólo como capa (un ajuste: soltarlo sobre un clip no tiene sentido en CapCut). */
	aCapa?: boolean;
	/** El ✕ rojo de las cosas propias (LUT, predefinidos). */
	quitar?: { titulo: string; onClick: () => void };
}) {
	const editor = useEditor();
	const rotulo = nombre ?? definicion.name;
	return (
		<div className="group/tarjeta relative">
			<DraggableItem
				name={rotulo}
				preview={<MiniaturaEfecto effectType={definicion.type} params={params} fuente={fuente} />}
				dragData={{
					id: definicion.type,
					name: rotulo,
					type: "effect",
					effectType: definicion.type,
					targetElementTypes: aCapa ? [] : DESTINOS_CLIP,
					// Lo que lleva params propios (una LUT, un predefinido) los viaja en
					// el arrastre: el drop de la línea de tiempo los aplica.
					...(params ? { params } : {}),
				}}
				onAddToTimeline={() => agregarCapaEfecto(editor, { effectType: definicion.type, params })}
				onClick={params ? () => agregarCapaEfecto(editor, { effectType: definicion.type, params }) : undefined}
				aspectRatio={1}
				containerClassName="w-full"
			/>
			{quitar && (
				<button
					type="button"
					aria-label={quitar.titulo}
					title={quitar.titulo}
					onClick={quitar.onClick}
					className="absolute top-1 right-1 flex size-5 cursor-pointer items-center justify-center rounded-[4px] bg-[var(--cc-panel)]/90 opacity-0 transition-opacity group-hover/tarjeta:opacity-100 focus-visible:opacity-100"
				>
					<IconoBorrar size={12} />
				</button>
			)}
		</div>
	);
}

function Grilla({ defs, fuente }: { defs: EffectDefinition[]; fuente: FuenteMiniatura }) {
	return (
		<GrillaBiblioteca>
			{defs.map((d) => (
				<TarjetaEfecto key={d.type} definicion={d} fuente={fuente} />
			))}
		</GrillaBiblioteca>
	);
}

// ── Efectos de video / Filtros: catálogo por categorías ──────────────────────

function Catalogo({
	clase,
	categoria,
	placeholder,
}: {
	clase: "efecto" | "filtro";
	/** `undefined` = todas, agrupadas («Efectos de video ▾» / «Filtros ▾» elegido). */
	categoria?: string;
	placeholder: string;
}) {
	const busqueda = useBusqueda();
	const todas = useMemo(() => definiciones(clase), [clase]);
	const fuente: FuenteMiniatura = clase === "filtro" ? "paisaje" : "retrato";
	const categorias: readonly string[] = clase === "filtro" ? CATEGORIAS_FILTRO : CATEGORIAS_EFECTO;

	const deCategoria = (cat: string) =>
		cat === "Tendencias"
			? TENDENCIAS_EFECTO.map((t) => todas.find((d) => d.type === t)).filter((d): d is EffectDefinition => !!d)
			: todas.filter((d) => d.categoria === cat);

	let cuerpo: React.ReactNode;
	if (busqueda.normalizado) {
		const resultado = todas.filter((d) => coincide(d, busqueda.normalizado));
		cuerpo =
			resultado.length > 0 ? (
				<Grilla defs={resultado} fuente={fuente} />
			) : (
				<VacioBiblioteca texto="No se encontraron resultados" />
			);
	} else if (categoria) {
		const defs = deCategoria(categoria);
		cuerpo = defs.length > 0 ? <Grilla defs={defs} fuente={fuente} /> : <VacioBiblioteca texto="No hay contenido" />;
	} else {
		cuerpo = (
			<div className="flex flex-col gap-4">
				{categorias.map((cat) => {
					const defs = deCategoria(cat);
					if (defs.length === 0) return null;
					return (
						<section key={cat}>
							<TituloGrupo>{cat}</TituloGrupo>
							<Grilla defs={defs} fuente={fuente} />
						</section>
					);
				})}
			</div>
		);
	}

	return (
		<ContenidoBiblioteca
			arriba={
				<BuscadorBiblioteca valor={busqueda.valor} onCambio={busqueda.setValor} placeholder={placeholder} />
			}
		>
			{cuerpo}
		</ContenidoBiblioteca>
	);
}

export function vistaEfectos(categoria?: string) {
	return function EfectosDeVideo() {
		return <Catalogo clase="efecto" categoria={categoria} placeholder="Buscar efectos" />;
	};
}

export function vistaFiltros(categoria?: string) {
	return function Filtros() {
		return <Catalogo clase="filtro" categoria={categoria} placeholder="Buscar filtros" />;
	};
}

export function EfectosCorporales() {
	return <VacioBiblioteca texto="Próximamente" />;
}

// ── Ajuste ───────────────────────────────────────────────────────────────────

/** «Agregar ajuste»: la tarjeta «Ajuste personalizado» (una capa de ajuste en blanco). */
export function AgregarAjuste() {
	const editor = useEditor();
	registerDefaultEffects();
	const definicion = effectsRegistry.get(TIPO_AJUSTE);
	return (
		<ContenidoBiblioteca>
			<GrillaBiblioteca>
				<DraggableItem
					name={definicion.name}
					preview={
						<div className="flex size-full items-center justify-center bg-[var(--cc-raised)]">
							<SlidersHorizontal className="size-7 text-[var(--cc-text-2)]" strokeWidth={1.5} />
						</div>
					}
					dragData={{
						id: TIPO_AJUSTE,
						name: definicion.name,
						type: "effect",
						effectType: TIPO_AJUSTE,
						targetElementTypes: [],
					}}
					onAddToTimeline={() => agregarCapaEfecto(editor, { effectType: TIPO_AJUSTE })}
					aspectRatio={1}
					containerClassName="w-full"
				/>
			</GrillaBiblioteca>
		</ContenidoBiblioteca>
	);
}

/** «LUT»: importar .cube/.3dl y las LUT de la biblioteca, cada una como capa de ajuste. */
export function SeccionLut() {
	const { luts } = useBibliotecaLuts();
	const [importando, setImportando] = useState(false);
	const [encima, setEncima] = useState(false);
	const entrada = useRef<HTMLInputElement>(null);
	useEffect(() => {
		void asegurarLuts();
	}, []);
	registerDefaultEffects();
	const definicion = effectsRegistry.get(TIPO_AJUSTE);

	const importar = async (archivos: File[]) => {
		if (archivos.length === 0) return;
		setImportando(true);
		try {
			const { fallidos } = await importarLuts(archivos);
			if (fallidos.length > 0) toast.error(LUT_NO_COMPATIBLE);
		} finally {
			setImportando(false);
		}
	};

	return (
		<ContenidoBiblioteca
			onDragOver={(e) => {
				if (e.dataTransfer.types.includes("Files")) {
					e.preventDefault();
					setEncima(true);
				}
			}}
			onDragLeave={() => setEncima(false)}
			onDrop={(e) => {
				if (!e.dataTransfer.files.length) return;
				e.preventDefault();
				setEncima(false);
				void importar([...e.dataTransfer.files]);
			}}
		>
			<input
				ref={entrada}
				type="file"
				accept=".cube,.3dl"
				multiple
				hidden
				onChange={(e) => {
					void importar([...(e.target.files ?? [])]);
					e.target.value = "";
				}}
			/>
			<ZonaImportar
				texto="Compatible con .cube/.3dl"
				onClick={() => entrada.current?.click()}
				procesando={importando}
				rotuloProcesando="Importando…"
				resaltada={encima}
				compacta={luts.length > 0}
			/>
			{luts.length > 0 && (
				<div className="mt-4">
					<GrillaBiblioteca>
						{luts.map((lut) => (
							<TarjetaEfecto
								key={lut.id}
								definicion={definicion}
								fuente="retrato"
								nombre={lut.nombre}
								params={{ lut: lut.id, lutIntensidad: 100 }}
								aCapa
								quitar={{ titulo: `Eliminar ${lut.nombre}`, onClick: () => void eliminarLut(lut.id) }}
							/>
						))}
					</GrillaBiblioteca>
				</div>
			)}
		</ContenidoBiblioteca>
	);
}

/** «Mis elementos predefinidos»: los ajustes guardados desde Ajustar. */
export function MisPredefinidos() {
	const lista = usePredefinidos();
	useEffect(() => {
		void asegurarPredefinidos();
	}, []);
	registerDefaultEffects();
	const definicion = effectsRegistry.get(TIPO_AJUSTE);
	if (lista.length === 0) return <VacioBiblioteca texto="Aún no hay elementos predefinidos" />;
	return (
		<ContenidoBiblioteca>
			<GrillaBiblioteca>
				{lista.map((p) => (
					<TarjetaEfecto
						key={p.id}
						definicion={definicion}
						fuente="retrato"
						nombre={p.nombre}
						params={p.params}
						aCapa
						quitar={{ titulo: `Eliminar ${p.nombre}`, onClick: () => void eliminarPredefinido(p.id) }}
					/>
				))}
			</GrillaBiblioteca>
		</ContenidoBiblioteca>
	);
}
