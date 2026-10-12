"use client";

// =============================================================================
// Audio › «Modificador de voz»: la grilla de filtros y personajes, y sus perillas
// =============================================================================
// Como CapCut 9.3 (relevamiento-capcut-funciones §3.2 y armazón §5): arriba el
// segmentado «Filtros de voz · Personajes de voz · Voz a canción», la grilla con
// «Original» primero, el elegido con borde cian, y debajo las perillas del
// filtro elegido (Tono, Timbre, Fuerza…) con su ↺. «Voz a canción» es IA en la
// nube de CapCut: apagada.
//
// Elegir un filtro es UN paso de deshacer y le pone sus valores iniciales; el
// sonido lo arma audio/voz.ts al reproducir y al exportar.

import { useState, type ComponentType } from "react";
import {
	ArrowDown,
	ArrowUp,
	BatteryLow,
	Ban,
	Bot,
	Church,
	Disc3,
	Ghost,
	Megaphone,
	Mic,
	Phone,
	Radio,
	Repeat,
	Smile,
	Squirrel,
	User,
	UserRound,
	Vibrate,
	Zap,
} from "lucide-react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	AccionesGrupo,
	DeslizadorValor,
	SegmentadoCe,
	useParamsConFotogramas,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import { getElementParam, type ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import type { TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { PERILLAS_VOZ, VOZ, clavePerilla, type PerillaVoz } from "../claves";
import { FILTROS_VOZ, filtroVoz, type FiltroVoz, type GrupoVoz } from "../voz";
import { FilaAudio } from "./basico";

const ICONOS: Record<string, ComponentType<{ className?: string }>> = {
	original: Ban,
	"eco-microfono": Mic,
	megafono: Megaphone,
	ardilla: Squirrel,
	agudo: ArrowUp,
	grave: ArrowDown,
	robot: Bot,
	"bateria-baja": BatteryLow,
	temblor: Vibrate,
	vinilo: Disc3,
	lofi: Radio,
	telefono: Phone,
	eco: Repeat,
	"sala-grande": Church,
	distorsionado: Zap,
	"adam-joven": User,
	"tio-tom": UserRound,
	"eve-dulce": Smile,
	monstruo: Ghost,
};

type Segmento = GrupoVoz | "cancion";

const SEGMENTOS: ReadonlyArray<{ id: Segmento; etiqueta: string; desactivada?: boolean }> = [
	{ id: "filtros", etiqueta: "Filtros de voz" },
	{ id: "personajes", etiqueta: "Personajes de voz" },
	{ id: "cancion", etiqueta: "Voz a canción", desactivada: true },
];

export function ModificadorVoz({ element, track }: ContextoInspector) {
	const editor = useEditor();
	const elegido = filtroVoz(String(element.params[VOZ] ?? "original")) ?? FILTROS_VOZ[0];
	const [segmento, setSegmento] = useState<Segmento>(() =>
		elegido.grupo === "personajes" ? "personajes" : "filtros",
	);
	if (element.type !== "audio" && element.type !== "video") return null;

	const original = FILTROS_VOZ[0];
	const lista = [original, ...FILTROS_VOZ.filter((f) => f.id !== "original" && f.grupo === segmento)];

	const elegir = (filtro: FiltroVoz) => {
		if (filtro.id === elegido.id) return;
		const valores: Record<string, number | string> = { [VOZ]: filtro.id };
		for (const [perilla, valor] of Object.entries(filtro.perillas)) {
			valores[clavePerilla(perilla as PerillaVoz)] = valor as number;
		}
		editor.timeline.updateElements({
			updates: [{ trackId: track.id, elementId: element.id, patch: { params: { ...element.params, ...valores } } }],
		});
	};

	const perillas = PERILLAS_VOZ.filter((p) => elegido.perillas[p.id] !== undefined);

	return (
		<div className="flex flex-col gap-3 px-4 pt-3 pb-4">
			<SegmentadoCe
				opciones={SEGMENTOS}
				valor={segmento}
				onCambio={(id) => setSegmento(id as Segmento)}
			/>
			<div className="grid grid-cols-4 gap-2">
				{lista.map((filtro) => {
					const Icono = ICONOS[filtro.id] ?? Mic;
					const activo = filtro.id === elegido.id;
					return (
						<button
							key={filtro.id}
							type="button"
							aria-pressed={activo}
							onClick={() => elegir(filtro)}
							className="group flex min-w-0 cursor-pointer flex-col items-center gap-1"
						>
							<span
								className={cn(
									"flex aspect-square w-full items-center justify-center rounded-[6px] border-2 bg-(--cc-raised) text-(--cc-icon) group-hover:text-foreground",
									activo ? "border-(--cc-accent)" : "border-transparent",
								)}
							>
								<Icono className="size-5" />
							</span>
							<span className={cn("w-full truncate text-center text-[11px]", activo ? "text-foreground" : "text-(--cc-text-2)")}>
								{filtro.nombre}
							</span>
						</button>
					);
				})}
			</div>
			{perillas.length > 0 && (
				<div className="flex flex-col border-t border-(--cc-line-2) pt-2">
					{perillas.map((p) => (
						<FilaPerilla
							key={`${elegido.id}:${p.id}`}
							element={element}
							trackId={track.id}
							filtro={elegido}
							perilla={p.id}
							etiqueta={p.etiqueta}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function FilaPerilla({
	element,
	trackId,
	filtro,
	perilla,
	etiqueta,
}: {
	element: TimelineElement;
	trackId: string;
	filtro: FiltroVoz;
	perilla: PerillaVoz;
	etiqueta: string;
}) {
	const clave = clavePerilla(perilla);
	const declarado = getElementParam({ element, key: clave });
	// El ↺ vuelve al valor inicial DEL FILTRO, no al 50 genérico de la declaración.
	const param = declarado
		? ({ ...declarado, default: filtro.perillas[perilla] ?? 50 } as ElementParamDefinition)
		: null;
	const grupo = useParamsConFotogramas({ element, trackId, params: param ? [param] : [] });
	if (!param) return null;
	const valor = Number(grupo.valores[clave] ?? param.default);
	return (
		<FilaAudio rotulo={etiqueta} acciones={<AccionesGrupo grupo={grupo} animable={false} />}>
			<DeslizadorValor
				valor={valor}
				min={0}
				max={100}
				paso={1}
				ariaLabel={etiqueta}
				onPrevisualizar={(v) => grupo.previsualizar({ [clave]: v })}
				onConfirmar={grupo.confirmar}
			/>
		</FilaAudio>
	);
}
