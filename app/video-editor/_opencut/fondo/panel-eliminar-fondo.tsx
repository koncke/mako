"use client";

// =============================================================================
// Video › «Eliminar fondo» (clip de video o imagen)
// =============================================================================
// Las tres secciones de CapCut 9.3, cada una con su interruptor:
//
//   Eliminación automática     recorta a la persona (`fondo.automatico`, el
//                              gancho de ./recorte-persona.ts). Debajo, el
//                              estado: «Cargando…» mientras baja el modelo, el
//                              aviso de CapCut si no cargó, o su nota
//                              «Solo se pueden recortar figuras humanas.».
//   Eliminación personalizada  el pincel: a la vista y apagado (Próximamente).
//   Chroma key                 escribe el efecto `croma` del clip (paquete de
//                              color, effects/definitions/croma.ts): Selector de
//                              colores, Intensidad, Sombra, Borde de plumas y
//                              Limpiar borde, con las filas de «Ajustar».
//
// Apagar el Chroma key no borra el efecto: lo deshabilita (como el ojo de
// «Efectos»), así volver a prenderlo devuelve el color y los valores que había.

import { useSyncExternalStore } from "react";
import { LoaderCircle, Pipette } from "lucide-react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { ContextoInspector } from "@/app/video-editor/ce/ranuras";
import type { NumberParamDefinition } from "@/app/video-editor/_opencut/params";
import { Switch } from "@/app/video-editor/_opencut/components/ui/switch";
import { ColorPicker } from "@/app/video-editor/_opencut/components/ui/color-picker";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/app/video-editor/_opencut/components/ui/tooltip";
import {
	FilaCe,
	SeccionCe,
	useParamsConFotogramas,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import { FilaParam } from "@/app/video-editor/_opencut/effects/components/panel-color";
import { origenEfecto, type OrigenParams } from "@/app/video-editor/_opencut/effects/capas";
import { registerDefaultEffects } from "@/app/video-editor/_opencut/effects";
import { PARAMS_CROMA, TIPO_CROMA } from "@/app/video-editor/_opencut/effects/definitions/croma";
import { FONDO_AUTOMATICO, PARAM_FONDO_AUTOMATICO } from "@/app/video-editor/_opencut/params/extra/fondo";
import {
	TEXTO_FALLO,
	cargarSegmentador,
	estadoSegmentador,
	reintentarSegmentador,
	suscribirSegmentador,
	type EstadoSegmentador,
} from "./segmentador";

export function EliminarFondo(ctx: ContextoInspector) {
	return (
		<div className="flex flex-col pt-1">
			<SeccionAutomatica {...ctx} />
			<SeccionPersonalizada />
			<SeccionChroma {...ctx} />
		</div>
	);
}

// ── Eliminación automática ───────────────────────────────────────────────────

const servidor = (): EstadoSegmentador => "inactivo";

function SeccionAutomatica({ element, track }: ContextoInspector) {
	const grupo = useParamsConFotogramas({
		element,
		trackId: track.id,
		params: [PARAM_FONDO_AUTOMATICO],
	});
	const estado = useSyncExternalStore(suscribirSegmentador, estadoSegmentador, servidor);
	const prendido = grupo.valores[FONDO_AUTOMATICO] === true;

	const alternar = (valor: boolean) => {
		if (valor) {
			// Prenderlo de nuevo es la forma de reintentar una carga que falló.
			reintentarSegmentador();
			void cargarSegmentador();
		}
		grupo.aplicar({ [FONDO_AUTOMATICO]: valor });
	};

	return (
		<SeccionCe
			titulo="Eliminación automática"
			plegable={false}
			acciones={
				<Switch checked={prendido} aria-label="Eliminación automática" onCheckedChange={alternar} />
			}
		>
			{prendido ? <EstadoAutomatica estado={estado} /> : null}
		</SeccionCe>
	);
}

function EstadoAutomatica({ estado }: { estado: EstadoSegmentador }) {
	if (estado === "cargando") {
		return (
			<p className="flex items-center gap-1.5 pb-1 text-[12px] text-(--cc-text-2)" role="status">
				<LoaderCircle className="size-3.5 animate-spin text-primary" />
				Cargando…
			</p>
		);
	}
	if (estado === "fallo") {
		return (
			<p className="pb-1 text-[12px] text-destructive" role="alert">
				{TEXTO_FALLO}
			</p>
		);
	}
	// es-LA.po de CapCut: `pc_smart_keying_notes`.
	return <p className="pb-1 text-[12px] text-(--cc-text-3)">Solo se pueden recortar figuras humanas.</p>;
}

// ── Eliminación personalizada (el pincel) ────────────────────────────────────

function SeccionPersonalizada() {
	return (
		<SeccionCe
			titulo="Eliminación personalizada"
			plegable={false}
			acciones={
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="flex">
							<Switch disabled aria-label="Eliminación personalizada" />
						</span>
					</TooltipTrigger>
					<TooltipContent side="top">Próximamente</TooltipContent>
				</Tooltip>
			}
		/>
	);
}

// ── Chroma key ───────────────────────────────────────────────────────────────

const NUMEROS_CROMA = PARAMS_CROMA.filter((p): p is NumberParamDefinition => p.type === "number");
const DEF_COLOR = PARAMS_CROMA.find((p) => p.key === "color");

function SeccionChroma({ element, track }: ContextoInspector) {
	const editor = useEditor();
	registerDefaultEffects();
	const efecto = ("effects" in element ? element.effects : undefined)?.find((e) => e.type === TIPO_CROMA);
	const origen = origenEfecto({
		element,
		trackId: track.id,
		buscar: (e) => e.type === TIPO_CROMA,
		tipoNuevo: TIPO_CROMA,
	});
	const activo = Boolean(efecto?.enabled);

	const alternar = (valor: boolean) => {
		if (!efecto) {
			// El primero lo crea, con intensidad 0 como CapCut: se elige el color
			// y después se sube hasta que el fondo desaparece.
			if (valor) origen.asegurar(editor);
			return;
		}
		if (efecto.enabled !== valor) {
			editor.timeline.toggleClipEffect({ trackId: track.id, elementId: element.id, effectId: efecto.id });
		}
	};

	return (
		<SeccionCe
			titulo="Chroma key"
			plegable={false}
			acciones={<Switch checked={activo} aria-label="Chroma key" onCheckedChange={alternar} />}
		>
			{activo ? (
				<>
					{/* es-LA.po de CapCut: `pc_new_remove_background_color`. */}
					<p className="pb-1 text-[12px] text-(--cc-text-3)">Elige el color y, luego, ajusta la intensidad.</p>
					{DEF_COLOR ? <FilaSelectorColor origen={origen} /> : null}
					{NUMEROS_CROMA.map((def) => (
						<FilaParam key={def.key} origen={origen} def={def} />
					))}
				</>
			) : null}
		</SeccionCe>
	);
}

/** «#00FF00», «00ff00», «#00ff00ff» → «#00ff00»; lo ilegible, null. */
function hex6(valor: unknown): string | null {
	if (typeof valor !== "string") return null;
	const m = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(valor.trim());
	return m ? `#${m[1].toLowerCase()}` : null;
}

/**
 * El cuentagotas lee la PANTALLA, no el clip: con el croma andando, lo que ya
 * se recortó se ve negro y volver a elegir el color tomaba ese negro (y pasaba
 * a recortar las sombras). Mientras está abierto, el reproductor muestra el
 * clip SIN el croma, como CapCut, que toma el color del original. Es una vista
 * previa del motor: no deja paso de deshacer, y elegir la reemplaza entera
 * (`aplicar` escribe el elemento confirmado con el color nuevo y el croma
 * prendido). Devuelve si hubo que apagarlo.
 */
function verSinCroma(editor: EditorCore, origen: OrigenParams): boolean {
	const efectos = "effects" in origen.element ? origen.element.effects : undefined;
	if (!efectos?.some((e) => e.type === TIPO_CROMA && e.enabled)) return false;
	editor.timeline.previewElements({
		updates: [
			{
				trackId: origen.trackId,
				elementId: origen.element.id,
				updates: { effects: efectos.map((e) => (e.type === TIPO_CROMA ? { ...e, enabled: false } : e)) },
			},
		],
	});
	return true;
}

/**
 * Lo que tarda el reproductor en redibujar sin el croma. El EyeDropper de
 * Chrome captura la pantalla al abrirse: si abre antes, el cuadro que se ve es
 * el recortado. Pide activación del usuario, que dura ~5 s: 150 ms no la gasta.
 */
const ESPERA_REDIBUJO_MS = 150;

/**
 * «Selector de colores»: el cuentagotas (EyeDropper de Chrome/Edge: se toca
 * el color en el reproductor, como en CapCut) y la muestra con su paleta. Sin
 * EyeDropper (Firefox, Safari) queda sólo la paleta, que también trae el hex.
 */
function FilaSelectorColor({ origen }: { origen: OrigenParams }) {
	const editor = useEditor();
	const def = DEF_COLOR!;
	const grupo = useParamsConFotogramas({
		element: origen.element,
		trackId: origen.trackId,
		params: [origen.param(def)],
		rutas: { [def.key]: origen.ruta(def.key) },
	});
	const color = hex6(grupo.valores[def.key]) ?? hex6(def.default) ?? "#00ff00";
	const hayGotero = typeof window !== "undefined" && "EyeDropper" in window && typeof EyeDropper !== "undefined";

	const gotero = async () => {
		if (typeof EyeDropper === "undefined" || !EyeDropper) return;
		const apagado = verSinCroma(editor, origen);
		if (apagado) await new Promise((r) => setTimeout(r, ESPERA_REDIBUJO_MS));
		try {
			const { sRGBHex } = await new EyeDropper().open();
			const elegido = hex6(sRGBHex);
			if (elegido) {
				grupo.aplicar({ [def.key]: elegido });
				return;
			}
		} catch {
			// Esc: la persona canceló el cuentagotas.
		}
		if (apagado) editor.timeline.discardPreview();
	};

	return (
		<div className="flex flex-col">
			<div className="truncate pt-1.5 text-[12px] text-(--cc-text-2)">Selector de colores</div>
			<FilaCe acciones={null}>
				{hayGotero && (
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								aria-label="Selector de colores"
								onClick={() => void gotero()}
								className="flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded-[4px] bg-(--cc-raised) text-(--cc-icon) hover:text-foreground"
							>
								<Pipette className="size-3.5" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="top">Selector de colores</TooltipContent>
					</Tooltip>
				)}
				<ColorPicker
					className="min-w-0 flex-1"
					value={color.slice(1).toUpperCase()}
					onChange={(c) => {
						const v = hex6(c);
						if (v) grupo.previsualizar({ [def.key]: v });
					}}
					onChangeEnd={(c) => {
						const v = hex6(c);
						if (v) grupo.aplicar({ [def.key]: v });
					}}
				/>
			</FilaCe>
		</div>
	);
}
