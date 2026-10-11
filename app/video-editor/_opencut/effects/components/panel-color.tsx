"use client";

// =============================================================================
// El panel derecho de color: «Ajustar» (Básico · HSL), la capa de filtro o de
// efecto, y los efectos aplicados a un clip
// =============================================================================
// Todo con el kit del panel (panels/properties/components/kit.tsx), así se ve y
// se comporta como el resto: filas de 38 px, ↺ «Restablecer» y ‹ ◇ › «Fotograma
// clave» por fila. Los params se leen y escriben a través de un ORIGEN
// (../capas.ts): el efecto `ajuste` de un clip o los params de una capa, con su
// ruta de animación, así la misma pestaña sirve para los dos.
//
// Un clip sin «Ajustar» todavía no tiene el efecto: el primer cambio lo crea
// (el `write` del origen lo agrega), y el ◇ lo crea antes de poner el
// fotograma clave (sin el efecto, la ruta no resuelve y el rombo no haría nada).

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import type { NumberParamDefinition, ParamValues } from "@/app/video-editor/_opencut/params";
import { Switch } from "@/app/video-editor/_opencut/components/ui/switch";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import {
	BotonFotograma,
	BotonRestablecer,
	DeslizadorValor,
	FilaCe,
	SeccionCe,
	SelectCe,
	useParamsConFotogramas,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import { IconoBorrar } from "@/app/_ui/BotonBorrar";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { effectsRegistry, registerDefaultEffects } from "@/app/video-editor/_opencut/effects";
import type { Effect } from "../types";
import { origenCapa, origenEfecto, type OrigenParams } from "../capas";
import {
	COLORES_HSL,
	COMPONENTES_HSL,
	PARAM_LUT_INTENSIDAD,
	PARAMS_BASICO,
	PARAMS_HSL,
	TIPO_AJUSTE,
	claveHsl,
} from "../definitions/ajuste";
import { asegurarLuts, importarLuts, useBibliotecaLuts } from "../lut/biblioteca-luts";
import { LUT_NO_COMPATIBLE } from "../lut/leer-lut";
import { guardarPredefinido } from "../predefinidos";

// ── Origen del «Ajustar» ─────────────────────────────────────────────────────

function origenAjustar({ element, track }: ContextoInspector): OrigenParams {
	registerDefaultEffects();
	return element.type === "effect"
		? origenCapa({ element, trackId: track.id })
		: origenEfecto({
				element,
				trackId: track.id,
				buscar: (e) => e.type === TIPO_AJUSTE,
				tipoNuevo: TIPO_AJUSTE,
			});
}

// ── Una fila numérica con ↺ y ◇ ──────────────────────────────────────────────

export function FilaParam({
	origen,
	def,
	rotulo,
}: {
	origen: OrigenParams;
	def: NumberParamDefinition;
	rotulo?: string;
}) {
	const editor = useEditor();
	const grupo = useParamsConFotogramas({
		element: origen.element,
		trackId: origen.trackId,
		params: [origen.param(def)],
		rutas: { [def.key]: origen.ruta(def.key) },
	});
	const etiqueta = rotulo ?? def.label;
	const n = Number(grupo.valores[def.key]);
	const valor = Number.isFinite(n) ? n : def.default;
	const acciones = (
		<>
			<BotonRestablecer
				// No `grupo.restablecer`: ése parcha sólo `element.params`, y el valor
				// de un efecto del clip vive en `element.effects` (se perdería).
				onClick={() =>
					origen.escribir(editor, { [def.key]: def.default }, { quitarFotogramas: [def.key] })
				}
				desactivado={grupo.esPorDefecto && !grupo.tieneFotogramas}
			/>
			<BotonFotograma
				grupo={{
					...grupo,
					alternarFotograma: () => {
						origen.asegurar(editor);
						grupo.alternarFotograma();
					},
				}}
			/>
		</>
	);
	const deslizador = (
		<DeslizadorValor
			valor={valor}
			min={def.min ?? 0}
			max={def.max ?? 100}
			paso={def.step}
			ariaLabel={etiqueta}
			onPrevisualizar={(v) => grupo.previsualizar({ [def.key]: v })}
			onConfirmar={grupo.confirmar}
		/>
	);
	// Los rótulos largos de CapCut («Diferencia cromática horizontal») van arriba.
	if (etiqueta.length > 12) {
		return (
			<div className="flex flex-col">
				<div className="truncate pt-1.5 text-[12px] text-(--cc-text-2)">{etiqueta}</div>
				<FilaCe acciones={acciones}>{deslizador}</FilaCe>
			</div>
		);
	}
	return (
		<FilaCe rotulo={etiqueta} acciones={acciones}>
			{deslizador}
		</FilaCe>
	);
}

/** El ↺ de una sección: todo a su valor por defecto y sin fotogramas clave. */
function RestablecerSeccion({ origen, defs }: { origen: OrigenParams; defs: NumberParamDefinition[] }) {
	const editor = useEditor();
	const animaciones = origen.element.animations ?? {};
	const tocada =
		defs.some((d) => Number(origen.valores[d.key] ?? d.default) !== d.default) ||
		defs.some((d) => Boolean(animaciones[origen.ruta(d.key)]));
	return (
		<BotonRestablecer
			desactivado={!origen.existe || !tocada}
			onClick={() =>
				origen.escribir(
					editor,
					Object.fromEntries(defs.map((d) => [d.key, d.default])),
					{ quitarFotogramas: defs.map((d) => d.key) },
				)
			}
		/>
	);
}

// ── Ajustar › Básico ─────────────────────────────────────────────────────────

export function AjustarBasico(ctx: ContextoInspector) {
	const origen = origenAjustar(ctx);
	return (
		<div className="flex flex-col pt-1">
			{/* El de CapCut es de IA (analiza el cuadro): queda a la vista y apagado. */}
			<SeccionCe
				titulo="Ajuste automático"
				plegable={false}
				acciones={
					<span title="Próximamente" className="flex">
						<Switch disabled aria-label="Ajuste automático" />
					</span>
				}
			/>
			<SeccionLut origen={origen} />
			<SeccionCe
				titulo="Ajustar"
				clave="ce:ajustar:basico"
				acciones={<RestablecerSeccion origen={origen} defs={PARAMS_BASICO} />}
			>
				{PARAMS_BASICO.map((def) => (
					<FilaParam key={def.key} origen={origen} def={def} />
				))}
			</SeccionCe>
			<PieAjustar origen={origen} ctx={ctx} />
		</div>
	);
}

const SIN_LUT = "ninguno";
const IMPORTAR_LUT = "importar";

function SeccionLut({ origen }: { origen: OrigenParams }) {
	const editor = useEditor();
	const { luts, cargada } = useBibliotecaLuts();
	const entrada = useRef<HTMLInputElement>(null);
	useEffect(() => {
		void asegurarLuts();
	}, []);
	const id = typeof origen.valores.lut === "string" ? origen.valores.lut : "";
	const perdida = Boolean(id) && cargada && !luts.some((l) => l.id === id);

	const elegir = (valor: string) => {
		if (valor === IMPORTAR_LUT) {
			entrada.current?.click();
			return;
		}
		origen.escribir(editor, { lut: valor === SIN_LUT ? "" : valor });
	};

	return (
		<SeccionCe titulo="LUT" clave="ce:ajustar:lut">
			<input
				ref={entrada}
				type="file"
				accept=".cube,.3dl"
				hidden
				onChange={async (e) => {
					const archivos = [...(e.target.files ?? [])];
					e.target.value = "";
					if (archivos.length === 0) return;
					const { nuevas, fallidos } = await importarLuts(archivos);
					if (fallidos.length > 0) toast.error(LUT_NO_COMPATIBLE);
					if (nuevas[0]) origen.escribir(editor, { lut: nuevas[0].id });
				}}
			/>
			<FilaCe rotulo="Nombre">
				<SelectCe
					valor={id || SIN_LUT}
					ariaLabel="LUT"
					onCambio={elegir}
					opciones={[
						{ id: SIN_LUT, etiqueta: "Ninguno" },
						...(perdida ? [{ id, etiqueta: "Pérdida de LUT", desactivada: true }] : []),
						...luts.map((l) => ({ id: l.id, etiqueta: l.nombre })),
						{ id: IMPORTAR_LUT, etiqueta: "Importar LUT" },
					]}
				/>
			</FilaCe>
			{id && !perdida && <FilaParam origen={origen} def={PARAM_LUT_INTENSIDAD} />}
		</SeccionCe>
	);
}

/** «Guardar como parámetro predefinido» y, en un clip, «Aplicar a todo». */
function PieAjustar({ origen, ctx }: { origen: OrigenParams; ctx: ContextoInspector }) {
	const editor = useEditor();
	const enClip = ctx.element.type !== "effect";
	const guardar = async () => {
		const claves = [...PARAMS_BASICO, ...PARAMS_HSL].map((d) => d.key);
		const params: ParamValues = Object.fromEntries(
			claves.map((k) => [k, origen.valores[k] ?? 0]),
		);
		if (origen.valores.lut) {
			params.lut = origen.valores.lut;
			params.lutIntensidad = origen.valores.lutIntensidad ?? 100;
		}
		await guardarPredefinido(params);
		toast.success("Se guardó como parámetro predefinido");
	};
	const aplicarATodo = () => {
		const propio = "effects" in ctx.element ? ctx.element.effects?.find((e) => e.type === TIPO_AJUSTE) : undefined;
		if (!propio) return;
		const pistas = editor.scenes.getActiveScene().tracks;
		const updates = [pistas.main, ...pistas.overlay]
			.filter((t) => t.type === "video")
			.flatMap((t) =>
				t.elements
					.filter((el) => el.id !== ctx.element.id && (el.type === "video" || el.type === "image"))
					.map((el) => {
						const efectos: Effect[] = ("effects" in el ? el.effects : undefined) ?? [];
						const copia: Effect = {
							...propio,
							id: efectos.find((e) => e.type === TIPO_AJUSTE)?.id ?? `${TIPO_AJUSTE}-${el.id}`,
							params: { ...propio.params },
						};
						const i = efectos.findIndex((e) => e.type === TIPO_AJUSTE);
						const nuevos = i >= 0 ? efectos.map((e, j) => (j === i ? copia : e)) : [copia, ...efectos];
						return { trackId: t.id, elementId: el.id, patch: { effects: nuevos } };
					}),
			);
		if (updates.length > 0) editor.timeline.updateElements({ updates });
	};
	return (
		<div className="flex flex-col gap-2 px-4 pt-3 pb-4">
			<Button variant="secondary" size="sm" disabled={!origen.existe} onClick={() => void guardar()}>
				Guardar como parámetro predefinido
			</Button>
			{enClip && (
				<Button size="sm" disabled={!origen.existe} onClick={aplicarATodo}>
					Aplicar a todo
				</Button>
			)}
		</div>
	);
}

// ── Ajustar › HSL ────────────────────────────────────────────────────────────

export function AjustarHsl(ctx: ContextoInspector) {
	const origen = origenAjustar(ctx);
	const [color, setColor] = useState<string>(COLORES_HSL[0].id);
	const defs = (c: string) =>
		COMPONENTES_HSL.map((comp) => PARAMS_HSL.find((p) => p.key === claveHsl(c, comp.id))!);
	const tocado = (c: string) => defs(c).some((d) => Number(origen.valores[d.key] ?? 0) !== 0);
	return (
		<div className="flex flex-col pt-1">
			<SeccionCe
				titulo="HSL"
				plegable={false}
				acciones={<RestablecerSeccion origen={origen} defs={PARAMS_HSL} />}
			>
				<div role="radiogroup" aria-label="Color" className="flex items-center justify-between py-2 pr-[66px]">
					{COLORES_HSL.map((c) => (
						<button
							key={c.id}
							type="button"
							role="radio"
							aria-checked={c.id === color}
							aria-label={c.etiqueta}
							title={c.etiqueta}
							onClick={() => setColor(c.id)}
							className={cn(
								"relative size-[18px] shrink-0 cursor-pointer rounded-full ring-offset-2 ring-offset-(--cc-panel) transition-shadow",
								c.id === color ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-(--cc-text-3)",
							)}
							style={{ background: c.muestra }}
						>
							{tocado(c.id) && c.id !== color && (
								<span className="absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full bg-primary" />
							)}
						</button>
					))}
				</div>
				{defs(color).map((def) => (
					<FilaParam key={def.key} origen={origen} def={def} />
				))}
			</SeccionCe>
		</div>
	);
}

// ── Capa de filtro o de efecto ───────────────────────────────────────────────

export function PanelCapa({ element, track }: ContextoInspector) {
	registerDefaultEffects();
	if (element.type !== "effect" || !effectsRegistry.has(element.effectType)) return null;
	const definicion = effectsRegistry.get(element.effectType);
	const origen = origenCapa({ element, trackId: track.id });
	const numeros = definicion.params.filter((p): p is NumberParamDefinition => p.type === "number");
	return (
		<div className="flex flex-col pt-1">
			<SeccionCe titulo={definicion.name} plegable={false}>
				{numeros.length === 0 ? (
					<p className="py-2 text-[12px] text-(--cc-text-3)">Sin parámetros</p>
				) : (
					numeros.map((def) => <FilaParam key={def.key} origen={origen} def={def} />)
				)}
			</SeccionCe>
		</div>
	);
}

// ── Los efectos aplicados a un clip ──────────────────────────────────────────

/** Los efectos de un clip que van en la pestaña «Efectos» (no el Ajustar ni el croma). */
export function efectosListables(effects: Effect[] | undefined): Effect[] {
	registerDefaultEffects();
	return (effects ?? []).filter((e) => {
		if (!effectsRegistry.has(e.type)) return false;
		const clase = effectsRegistry.get(e.type).clase ?? "efecto";
		return clase === "efecto" || clase === "filtro";
	});
}

export function EfectosDelClip({ element, track }: ContextoInspector) {
	const editor = useEditor();
	const efectos = efectosListables("effects" in element ? element.effects : undefined);
	if (efectos.length === 0) {
		return (
			<p className="px-4 py-6 text-center text-[12px] text-(--cc-text-3)">
				Arrastra este efecto al clip al que quieras aplicarlo
			</p>
		);
	}
	return (
		<div className="flex flex-col pt-1">
			{efectos.map((efecto) => {
				const definicion = effectsRegistry.get(efecto.type);
				const origen = origenEfecto({
					element,
					trackId: track.id,
					buscar: (e) => e.id === efecto.id,
					tipoNuevo: efecto.type,
				});
				const numeros = definicion.params.filter((p): p is NumberParamDefinition => p.type === "number");
				return (
					<SeccionCe
						key={efecto.id}
						titulo={<span className={cn(!efecto.enabled && "text-(--cc-text-3)")}>{definicion.name}</span>}
						clave={`ce:efecto:${efecto.id}`}
						acciones={
							<div className="flex items-center gap-0.5">
								<button
									type="button"
									aria-label={efecto.enabled ? "Ocultar" : "Mostrar"}
									title={efecto.enabled ? "Ocultar" : "Mostrar"}
									onClick={() =>
										editor.timeline.toggleClipEffect({ trackId: track.id, elementId: element.id, effectId: efecto.id })
									}
									className="flex size-5 cursor-pointer items-center justify-center rounded-[3px] text-(--cc-icon) hover:bg-(--cc-raised)"
								>
									{efecto.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
								</button>
								<button
									type="button"
									aria-label={`Eliminar ${definicion.name}`}
									title={`Eliminar ${definicion.name}`}
									onClick={() =>
										editor.timeline.removeClipEffect({ trackId: track.id, elementId: element.id, effectId: efecto.id })
									}
									className="flex size-5 cursor-pointer items-center justify-center rounded-[3px] hover:bg-(--cc-raised)"
								>
									<IconoBorrar size={13} />
								</button>
							</div>
						}
					>
						<div className={cn(!efecto.enabled && "pointer-events-none opacity-50")}>
							{numeros.map((def) => (
								<FilaParam key={def.key} origen={origen} def={def} />
							))}
						</div>
					</SeccionCe>
				);
			})}
		</div>
	);
}
