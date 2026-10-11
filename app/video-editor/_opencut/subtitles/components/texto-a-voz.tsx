"use client";

// =============================================================================
// Panel derecho › «Texto a voz» (texto o subtítulo elegido)
// =============================================================================
// Como CapCut: la grilla de voces (Todos · Femenino · Masculino) y abajo el
// botón cian «Generar contenido de voz», que pone el audio en la línea de tiempo
// al inicio del texto. Las voces son las de la cuenta de ElevenLabs DEL CLIENTE
// (sus clones incluidos); sin cuenta conectada, la pestaña dice cómo conectarla y
// nada más.
//
// Escuchar una voz usa la muestra que aloja ElevenLabs: no consume cuota. Lo
// único que cobra es el botón cian, y sólo cuando se aprieta (nada se genera al
// elegir una voz ni al abrir la pestaña).

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Spinner } from "@/app/video-editor/_opencut/components/ui/spinner";
import { SegmentadoCe } from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { TextElement } from "@/app/video-editor/_opencut/timeline";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { usePreferenciasSubtitulos } from "../estado";
import {
	generandoVozPara,
	generarVoz,
	textoParaVoz,
	vocesTts,
	type EstadoVoces,
	type VozTts,
} from "../texto-a-voz";

type Filtro = "todos" | "femenino" | "masculino";

const FILTROS = [
	{ id: "todos", etiqueta: "Todos" },
	{ id: "femenino", etiqueta: "Femenino" },
	{ id: "masculino", etiqueta: "Masculino" },
] as const;

/** Un solo reproductor para las muestras: tocar otra corta la anterior. */
let reproductor: HTMLAudioElement | null = null;

function TarjetaVoz({
	voz,
	elegida,
	sonando,
	onElegir,
	onEscuchar,
}: {
	voz: VozTts;
	elegida: boolean;
	sonando: boolean;
	onElegir: () => void;
	onEscuchar: () => void;
}) {
	return (
		<div className="group relative flex min-w-0 flex-col items-center gap-1">
			<button
				type="button"
				onClick={onElegir}
				aria-pressed={elegida}
				title={[voz.nombre, voz.acento].filter(Boolean).join(" · ")}
				className={cn(
					"flex aspect-square w-full cursor-pointer items-center justify-center rounded-[6px] bg-(--cc-sunken) text-[18px] font-semibold text-(--cc-text-2) outline-none",
					"ring-1 focus-visible:ring-2 focus-visible:ring-primary",
					elegida ? "ring-2 ring-primary text-(--cc-text)" : "ring-transparent hover:ring-(--cc-text-3)",
				)}
			>
				{voz.nombre.trim().charAt(0).toUpperCase()}
			</button>
			{voz.muestra && (
				<button
					type="button"
					aria-label={sonando ? "Detener" : "Reproducir"}
					onClick={onEscuchar}
					className={cn(
						"absolute top-1 right-1 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white",
						sonando ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
					)}
				>
					{sonando ? <Square className="size-2.5" fill="currentColor" /> : <Play className="size-2.5" fill="currentColor" />}
				</button>
			)}
			<span
				className={cn(
					"w-full truncate text-center text-[11px]",
					elegida ? "text-primary" : "text-(--cc-text-2)",
				)}
			>
				{voz.nombre}
			</span>
		</div>
	);
}

export function PestanaTextoAVoz({ element }: ContextoInspector) {
	const editor = useEditor();
	const texto = element as TextElement;
	const [estado, setEstado] = useState<EstadoVoces | null>(null);
	const [filtro, setFiltro] = useState<Filtro>("todos");
	const [sonando, setSonando] = useState<string | null>(null);
	const [generando, setGenerando] = useState(() => generandoVozPara(element.id) != null);
	const [error, setError] = useState<string | null>(null);
	const vozElegida = usePreferenciasSubtitulos((s) => s.voz);
	const fijar = usePreferenciasSubtitulos((s) => s.fijar);
	const vivo = useRef(true);

	useEffect(() => {
		vivo.current = true;
		void vocesTts().then((r) => {
			if (vivo.current) setEstado(r);
		});
		// Un pedido que arrancó antes de que esta pestaña se dibujara (se eligió otro
		// clip y se volvió): el botón sigue apagado hasta que termine.
		void generandoVozPara(element.id)?.then((e) => {
			if (!vivo.current) return;
			setGenerando(false);
			setError(e);
		});
		return () => {
			vivo.current = false;
			reproductor?.pause();
		};
	}, [element.id]);

	const voces = useMemo(() => {
		if (estado?.estado !== "ok") return [];
		// Los clones del cliente primero: son SU voz.
		const orden = [...estado.voces].sort(
			(a, b) => Number(b.categoria === "cloned") - Number(a.categoria === "cloned"),
		);
		if (filtro === "todos") return orden;
		const buscado = filtro === "femenino" ? "female" : "male";
		return orden.filter((v) => (v.genero ?? "").toLowerCase() === buscado);
	}, [estado, filtro]);

	if (!estado) {
		return (
			<div className="flex h-40 items-center justify-center">
				<Spinner className="text-(--cc-text-3)" />
			</div>
		);
	}
	if (estado.estado === "sin-key") {
		return (
			<p className="px-6 py-10 text-center text-[12px] text-(--cc-text-2)">
				Conecta ElevenLabs en Integraciones
			</p>
		);
	}
	if (estado.estado === "error") {
		return (
			<div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
				<p className="text-[12px] text-(--cc-text-2)">{estado.error}</p>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					onClick={() => {
						setEstado(null);
						void vocesTts({ otraVez: true }).then((r) => vivo.current && setEstado(r));
					}}
				>
					Reintentar
				</Button>
			</div>
		);
	}

	const voz = estado.voces.find((v) => v.id === vozElegida) ?? null;
	const contenido = textoParaVoz(texto);
	const largo = contenido.length > estado.tope;

	const escuchar = (v: VozTts) => {
		if (!v.muestra) return;
		if (sonando === v.id) {
			reproductor?.pause();
			setSonando(null);
			return;
		}
		reproductor?.pause();
		reproductor = new Audio(v.muestra);
		reproductor.onended = () => vivo.current && setSonando(null);
		void reproductor.play().catch(() => vivo.current && setSonando(null));
		setSonando(v.id);
	};

	const generar = async () => {
		if (!voz || generando) return;
		setGenerando(true);
		setError(null);
		try {
			const e = await generarVoz({ editor, element: texto, voz });
			if (vivo.current) setError(e);
		} finally {
			if (vivo.current) setGenerando(false);
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="shrink-0 px-3 pt-3 pb-2">
				<SegmentadoCe opciones={FILTROS} valor={filtro} onCambio={(id) => setFiltro(id as Filtro)} />
			</div>
			<div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
				{voces.length === 0 ? (
					<p className="py-8 text-center text-[12px] text-(--cc-text-3)">No se encontraron resultados</p>
				) : (
					<div className="grid grid-cols-3 gap-x-2 gap-y-3">
						{voces.map((v) => (
							<TarjetaVoz
								key={v.id}
								voz={v}
								elegida={v.id === vozElegida}
								sonando={sonando === v.id}
								onElegir={() => fijar({ voz: v.id })}
								onEscuchar={() => escuchar(v)}
							/>
						))}
					</div>
				)}
			</div>
			<div className="flex shrink-0 flex-col gap-2 border-t border-(--cc-line-2) p-3">
				{(error || largo) && (
					<p className="text-[11px] text-(--cc-text-3)" role="status">
						{largo ? "Se alcanzó el límite de caracteres" : error}
					</p>
				)}
				<Button
					type="button"
					className="w-full"
					disabled={!voz || !contenido || largo || generando}
					onClick={() => void generar()}
				>
					{generando && <Spinner className="size-3.5" />}
					{generando ? "Generando la voz…" : "Generar contenido de voz"}
				</Button>
			</div>
		</div>
	);
}
