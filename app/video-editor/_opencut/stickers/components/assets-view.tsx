"use client";

// =============================================================================
// La pestaña Stickers de la biblioteca: Stickers ▾ (Tendencias · Emojis · Formas · Banderas)
// =============================================================================
// Como CapCut: un buscador arriba que busca en TODOS los stickers (sea cual sea la
// subcategoría elegida) y la grilla de la subcategoría. Un clic, el ⊕ o arrastrar
// agrega el sticker (en el cabezal si es por clic). Los dibujos de CapCut son de
// ByteDance y no se copian: los stickers salen de los proveedores de ../providers
// (emojis Unicode dibujados con la fuente del sistema, las formas del motor y las
// banderas de public/ve/flags).

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DraggableItem } from "@/app/video-editor/_opencut/components/editor/panels/assets/draggable-item";
import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import {
	BuscadorBiblioteca,
	ContenidoBiblioteca,
	GrillaBiblioteca,
	TituloGrupo,
	VacioBiblioteca,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { Spinner } from "@/app/video-editor/_opencut/components/ui/spinner";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	resolveStickerId,
	resolveStickerIntrinsicSize,
	type StickerItem,
} from "@/app/video-editor/_opencut/stickers";
import { STICKER_CATEGORIES } from "@/app/video-editor/_opencut/stickers/categories";
import { registerDefaultStickerProviders } from "@/app/video-editor/_opencut/stickers/providers";
import {
	EMOJIS_PROVIDER_ID,
	GRUPOS_EMOJI,
	TENDENCIAS_EMOJI,
	aStickerEmoji,
	emojiDeSticker,
	separarEmojis,
} from "@/app/video-editor/_opencut/stickers/providers/emojis";
import { parseShapeStickerId } from "@/app/video-editor/_opencut/stickers/providers/shapes";
import { stickersRegistry } from "@/app/video-editor/_opencut/stickers/registry";
import { parseStickerId } from "@/app/video-editor/_opencut/stickers/sticker-id";
import { useStickersStore } from "@/app/video-editor/_opencut/stickers/stickers-store";
import type { TimelineDragData } from "@/app/video-editor/_opencut/timeline/drag";
import {
	buildGraphicElement,
	buildStickerElement,
} from "@/app/video-editor/_opencut/timeline/element-utils";
import type { MediaTime } from "@/app/video-editor/_opencut/wasm";

/** Ids de las secciones (ranura `seccionesBiblioteca`, ver ../../components/editor/panels/assets/registro.ts). */
export const SECCIONES_STICKERS = {
	todos: "stickers.stickers",
	tendencias: "stickers.tendencias",
	emojis: "stickers.emojis",
	formas: "stickers.formas",
	banderas: "stickers.banderas",
} as const;

/** Cuántos de cada grupo se ven en «Stickers» antes de «Ver todo». */
const VISTA_PREVIA = 18;

// ── Carga de un proveedor (browse) y búsqueda en todos ───────────────────────

function useProveedor(id: string): { items: StickerItem[]; cargando: boolean } {
	const [items, setItems] = useState<StickerItem[]>([]);
	const [cargando, setCargando] = useState(true);
	useEffect(() => {
		let vigente = true;
		registerDefaultStickerProviders();
		if (!stickersRegistry.has(id)) {
			setCargando(false);
			return;
		}
		setCargando(true);
		stickersRegistry
			.get(id)
			.browse({ options: {} })
			.then((resultado) => {
				if (vigente) setItems(resultado.sections.flatMap((seccion) => seccion.items));
			})
			.catch((error) => console.error(`[stickers] no cargó «${id}»`, error))
			.finally(() => vigente && setCargando(false));
		return () => {
			vigente = false;
		};
	}, [id]);
	return { items, cargando };
}

type GrupoResultado = { id: string; titulo: string; items: StickerItem[] };

function useBusquedaStickers(consulta: string): { grupos: GrupoResultado[]; buscando: boolean } {
	const [grupos, setGrupos] = useState<GrupoResultado[]>([]);
	const [buscando, setBuscando] = useState(false);
	useEffect(() => {
		const q = consulta.trim();
		if (!q) {
			setGrupos([]);
			setBuscando(false);
			return;
		}
		let vigente = true;
		setBuscando(true);
		// Un respiro entre teclas: las banderas filtran 250 países por cada letra.
		const espera = window.setTimeout(() => {
			registerDefaultStickerProviders();
			const orden = ["emojis", "shapes", "flags"].filter((id) => stickersRegistry.has(id));
			void Promise.allSettled(
				orden.map(async (id) => {
					const r = await stickersRegistry.get(id).search({ query: q, options: { limit: 120 } });
					return {
						id,
						titulo: STICKER_CATEGORIES[id as keyof typeof STICKER_CATEGORIES] ?? id,
						items: r.items,
					};
				}),
			).then((resultados) => {
				if (!vigente) return;
				setGrupos(
					resultados
						.filter(
							(r): r is PromiseFulfilledResult<GrupoResultado> =>
								r.status === "fulfilled" && r.value.items.length > 0,
						)
						.map((r) => r.value),
				);
				setBuscando(false);
			});
		}, 150);
		return () => {
			vigente = false;
			window.clearTimeout(espera);
		};
	}, [consulta]);
	return { grupos, buscando };
}

/** Un sticker de «Utilizado recientemente» a partir de su id guardado. */
function itemDeId(stickerId: string): StickerItem | null {
	const emoji = emojiDeSticker(stickerId);
	if (emoji) return aStickerEmoji(emoji);
	try {
		const { providerId, providerValue } = parseStickerId({ stickerId });
		const forma = providerId === "shapes" ? parseShapeStickerId({ stickerId }) : null;
		let pais = "";
		if (providerId === "flags") {
			try {
				pais = new Intl.DisplayNames(["es"], { type: "region" }).of(providerValue) ?? "";
			} catch {
				pais = "";
			}
		}
		return {
			id: stickerId,
			provider: providerId,
			name: forma?.name ?? pais,
			previewUrl: resolveStickerId({ stickerId, options: { width: 96, height: 96 } }),
			metadata: {},
		};
	} catch {
		return null;
	}
}

// ── La vista ─────────────────────────────────────────────────────────────────

type Modo = keyof typeof SECCIONES_STICKERS;

function VistaStickers({ modo }: { modo: Modo }) {
	const searchQuery = useStickersStore((s) => s.searchQuery);
	const setSearchQuery = useStickersStore((s) => s.setSearchQuery);

	return (
		<ContenidoBiblioteca
			arriba={
				<BuscadorBiblioteca
					valor={searchQuery}
					onCambio={(valor) => setSearchQuery({ query: valor })}
				/>
			}
		>
			{searchQuery.trim() ? <Resultados consulta={searchQuery} /> : <Catalogo modo={modo} />}
		</ContenidoBiblioteca>
	);
}

function Resultados({ consulta }: { consulta: string }) {
	const { grupos, buscando } = useBusquedaStickers(consulta);
	if (buscando && grupos.length === 0) return <Cargando />;
	if (grupos.length === 0) return <VacioBiblioteca texto="No se encontraron resultados" />;
	return (
		<div className="flex flex-col gap-4">
			{grupos.map((grupo) => (
				<section key={grupo.id}>
					<TituloGrupo>{grupo.titulo}</TituloGrupo>
					<GrillaStickers items={grupo.items} emojis={grupo.id === EMOJIS_PROVIDER_ID} />
				</section>
			))}
		</div>
	);
}

function Catalogo({ modo }: { modo: Modo }) {
	switch (modo) {
		case "todos":
			return <Todos />;
		case "tendencias":
			return (
				<GrillaStickers items={separarEmojis(TENDENCIAS_EMOJI).map(aStickerEmoji)} emojis />
			);
		case "emojis":
			return (
				<div className="flex flex-col gap-4">
					{GRUPOS_EMOJI.map((grupo) => (
						<section key={grupo.id}>
							<TituloGrupo>{grupo.titulo}</TituloGrupo>
							<GrillaStickers items={separarEmojis(grupo.emojis).map(aStickerEmoji)} emojis />
						</section>
					))}
				</div>
			);
		case "formas":
			return <DeProveedor id="shapes" />;
		case "banderas":
			return <DeProveedor id="flags" />;
	}
}

function DeProveedor({ id, limite }: { id: string; limite?: number }) {
	const { items, cargando } = useProveedor(id);
	if (cargando) return <Cargando />;
	if (items.length === 0) return <VacioBiblioteca texto="No hay contenido" />;
	return <GrillaStickers items={limite ? items.slice(0, limite) : items} />;
}

/** «Stickers»: lo reciente y un vistazo de cada grupo, con «Ver todo». */
function Todos() {
	const recientes = useStickersStore((s) => s.recentStickers);
	const clearRecentStickers = useStickersStore((s) => s.clearRecentStickers);
	const itemsRecientes = useMemo(
		() =>
			recientes
				.slice(0, VISTA_PREVIA)
				.map(itemDeId)
				.filter((item): item is StickerItem => item !== null),
		[recientes],
	);
	const tendencias = useMemo(
		() => separarEmojis(TENDENCIAS_EMOJI).slice(0, VISTA_PREVIA).map(aStickerEmoji),
		[],
	);

	return (
		<div className="flex flex-col gap-4">
			{itemsRecientes.length > 0 && (
				<section>
					<TituloGrupo
						accion={
							<button
								type="button"
								onClick={clearRecentStickers}
								className="cursor-pointer text-[11px] text-[var(--cc-text-3)] hover:text-[var(--cc-text)]"
							>
								Borrar
							</button>
						}
					>
						Utilizado recientemente
					</TituloGrupo>
					<GrillaStickers items={itemsRecientes} />
				</section>
			)}
			<section>
				<TituloGrupo accion={<VerTodo modo="tendencias" />}>Tendencias</TituloGrupo>
				<GrillaStickers items={tendencias} emojis />
			</section>
			<section>
				<TituloGrupo accion={<VerTodo modo="formas" />}>Formas</TituloGrupo>
				<DeProveedor id="shapes" />
			</section>
			<section>
				<TituloGrupo accion={<VerTodo modo="emojis" />}>Emojis</TituloGrupo>
				<GrillaStickers
					items={separarEmojis(GRUPOS_EMOJI[0]?.emojis ?? "")
						.slice(0, VISTA_PREVIA)
						.map(aStickerEmoji)}
					emojis
				/>
			</section>
			<section>
				<TituloGrupo accion={<VerTodo modo="banderas" />}>Banderas</TituloGrupo>
				<DeProveedor id="flags" limite={VISTA_PREVIA} />
			</section>
		</div>
	);
}

function VerTodo({ modo }: { modo: Modo }) {
	const elegirSeccion = useAssetsPanelStore((s) => s.elegirSeccion);
	return (
		<button
			type="button"
			onClick={() => elegirSeccion({ categoria: "stickers", id: SECCIONES_STICKERS[modo] })}
			className="cursor-pointer text-[11px] text-[var(--cc-text-3)] hover:text-primary"
		>
			Ver todo
		</button>
	);
}

function Cargando() {
	return (
		<div className="flex items-center justify-center py-8">
			<Spinner className="size-5 text-[var(--cc-text-3)]" />
		</div>
	);
}

// ── Grilla y tarjeta ─────────────────────────────────────────────────────────

function GrillaStickers({ items, emojis = false }: { items: StickerItem[]; emojis?: boolean }) {
	return (
		<GrillaBiblioteca minimo={emojis ? 44 : 64} className={emojis ? "gap-1" : "gap-2"}>
			{items.map((item) => (
				<TarjetaSticker key={item.id} item={item} />
			))}
		</GrillaBiblioteca>
	);
}

function TarjetaSticker({ item }: { item: StickerItem }) {
	const editor = useEditor();
	const addToRecentStickers = useStickersStore((s) => s.addToRecentStickers);
	const [agregando, setAgregando] = useState(false);
	const [sinImagen, setSinImagen] = useState(false);

	const emoji = item.provider === EMOJIS_PROVIDER_ID ? emojiDeSticker(item.id) : null;
	const forma = item.provider === "shapes" ? parseShapeStickerId({ stickerId: item.id }) : null;
	const nombre = item.name || forma?.name || "Sticker";

	const agregar = async (startTime: MediaTime) => {
		if (agregando) return;
		setAgregando(true);
		try {
			let element: ReturnType<typeof buildGraphicElement> | ReturnType<typeof buildStickerElement>;
			if (forma) {
				element = buildGraphicElement({
					definitionId: forma.definitionId,
					name: forma.name,
					startTime,
					params: forma.params,
				});
			} else {
				const { width, height } = await resolveStickerIntrinsicSize({ stickerId: item.id });
				element = buildStickerElement({
					stickerId: item.id,
					name: nombre,
					startTime,
					intrinsicWidth: width,
					intrinsicHeight: height,
				});
			}
			editor.timeline.insertElement({ placement: { mode: "auto" }, element });
			addToRecentStickers({ stickerId: item.id });
		} catch (error) {
			console.error("[stickers] no se pudo agregar", error);
			toast.error("Error al agregar");
		} finally {
			setAgregando(false);
		}
	};

	const preview = emoji ? (
		<span className="flex size-full items-center justify-center text-[30px] leading-none select-none">
			{emoji}
		</span>
	) : (
		<span className="relative flex size-full items-center justify-center p-2">
			{sinImagen ? (
				<span className="text-center text-[10px] break-all text-[var(--cc-text-3)]">{nombre}</span>
			) : (
				<Image
					src={item.previewUrl}
					alt={nombre}
					width={64}
					height={64}
					className="size-full object-contain"
					onError={() => setSinImagen(true)}
					loading="lazy"
					draggable={false}
					unoptimized
				/>
			)}
		</span>
	);

	const dragData: TimelineDragData = forma
		? {
				id: item.id,
				type: "graphic",
				name: forma.name,
				definitionId: forma.definitionId,
				params: forma.params ?? {},
			}
		: { id: item.id, type: "sticker", name: nombre, stickerId: item.id };

	return (
		<div className="relative" title={nombre}>
			<DraggableItem
				name={nombre}
				preview={preview}
				dragData={dragData}
				onClick={() => void agregar(editor.playback.getCurrentTime())}
				onAddToTimeline={({ currentTime }) => void agregar(currentTime)}
				aspectRatio={1}
				shouldShowLabel={false}
				containerClassName="w-full"
			/>
			{agregando && (
				<div className="absolute inset-0 z-10 flex items-center justify-center rounded-[4px] bg-black/50">
					<Spinner className="size-4 text-white" />
				</div>
			)}
		</div>
	);
}

// ── Las secciones que registra ../../components/editor/panels/assets/registro.ts ──

export function StickersView() {
	return <VistaStickers modo="todos" />;
}
export function StickersTendenciasView() {
	return <VistaStickers modo="tendencias" />;
}
export function StickersEmojisView() {
	return <VistaStickers modo="emojis" />;
}
export function StickersFormasView() {
	return <VistaStickers modo="formas" />;
}
export function StickersBanderasView() {
	return <VistaStickers modo="banderas" />;
}
