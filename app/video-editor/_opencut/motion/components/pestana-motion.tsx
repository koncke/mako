"use client";

// =============================================================================
// La pestaña «Motion» del panel derecho: los campos de un motion graphic (lib/motion), VALIDADOS al confirmar
// =============================================================================
// «Textos» con el rótulo de cada campo arriba de su caja y «Estilo» con el tono, la fuente, los colores y el fondo. Lo
// largo no se corta: el motor achica la letra, y la fila avisa cuando un texto pasa el largo pensado para la plantilla.
//
// ⚠️ Lo que se escribe se VALIDA al confirmar (al salir del campo), con la misma `normalizarMotion` del chat y la API
// y midiendo que la escena siga entrando en el cuadro del proyecto (`validarCampoDelPanel`, lib/motion/panel.ts), y si no
// vale NO se guarda: se descarta la vista previa y el motivo queda debajo del campo. Hasta el 10/11/2026 el panel escribía cualquier cosa y el render lo «arreglaba» en silencio:
// un obligatorio vacío salía con el texto de EJEMPLO (un nombre, una cita o unos datos que nadie dio), un texto más largo
// que el tope duro volvía al ejemplo, «1.250» se guardaba como 1,25 y un color con transparencia volvía al de fábrica.
//
// Los números se muestran como los dibuja el video («1.250», «4,5») y se leen con el MISMO lector (lib/motion/numeros.ts):
// lo que muestra el cuadro vuelve a leerse a sí mismo. Un rango chico (los decimales, las estrellas) lleva además su
// deslizador; el número de una cifra (de -999.999.999 a 999.999.999) va sólo con el cuadro.
// =============================================================================

import { useState } from "react";
import type { ParamDefinition } from "@/app/video-editor/_opencut/params";
import type { ElementParamDefinition } from "@/app/video-editor/_opencut/params/registry";
import { buildGraphicParamPath } from "@/app/video-editor/_opencut/animation";
import type { GraphicElement, TimelineElement } from "@/app/video-editor/_opencut/timeline";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import {
	AccionesGrupo,
	CampoParam,
	FilaCe,
	SeccionCe,
	useParamsConFotogramas,
} from "@/app/video-editor/_opencut/components/editor/panels/properties/components/kit";
import { Textarea } from "@/app/video-editor/_opencut/components/ui/textarea";
import { NumberField } from "@/app/video-editor/_opencut/components/ui/number-field";
import { Slider } from "@/app/video-editor/_opencut/components/ui/slider";
import { ColorPicker } from "@/app/video-editor/_opencut/components/ui/color-picker";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { plantillaDeDefinicion, valoresDeParams } from "@/app/video-editor/_opencut/graphics/definitions/motion";
import { camposDe, validarCampoMotion } from "@/lib/motion/plantillas";
import { validarCampoDelPanel } from "@/lib/motion/panel";
import { numeroParaMostrar } from "@/lib/motion/numeros";
import type { CampoMotion, IdPlantilla } from "@/lib/motion/tipos";
import { CAMPOS_DE_ESTILO, conDeslizador, motivoParaElCampo } from "./pestana-motion-reglas";

/** El parámetro de la definición con su lectura/escritura en `params` (los de un `graphic` no son del registro). */
function paramDeElemento(param: ParamDefinition): ElementParamDefinition {
	return {
		...param,
		read: ({ element }) => element.params[param.key] ?? param.default,
		write: ({ element, value }) =>
			({ ...element, params: { ...element.params, [param.key]: value } }) as TimelineElement,
	};
}

type PropsCampo = {
	element: GraphicElement;
	trackId: string;
	param: ParamDefinition;
	plantilla: IdPlantilla;
	/** Ancho / alto del proyecto: con él se mide si un texto largo entra en el cuadro. */
	aspecto?: number;
};

/** Lo que se confirma pasa por la validación del panel: el valor, y si con él la escena sigue entrando en el cuadro. */
function validar({ plantilla, param, element, aspecto }: PropsCampo, valor: unknown) {
	return validarCampoDelPanel(plantilla, param.key, valor, { valores: valoresDeParams(plantilla, element.params), aspecto });
}

function useCampoMotion({ element, trackId, param }: PropsCampo) {
	const grupo = useParamsConFotogramas({
		element,
		trackId,
		params: [paramDeElemento(param)],
		rutas: { [param.key]: buildGraphicParamPath({ paramKey: param.key }) },
	});
	// `valor` es el del elemento VIVO (con la vista previa: lo que se está escribiendo); `confirmado`, el guardado. Lo que
	// decide si hubo un cambio compara contra el confirmado: contra el vivo, lo recién escrito era «igual» y se descartaba.
	return { grupo, valor: grupo.valores[param.key] ?? param.default, confirmado: element.params[param.key] ?? param.default };
}

/** El motivo debajo del campo. Sin `role="alert"`: no es un error de la app, es lo que falta para guardarlo. */
function Motivo({ texto, noSeGuardo }: { texto: string; noSeGuardo: boolean }) {
	return (
		<span aria-live="polite" className="pb-1 text-[11px] leading-snug text-destructive">
			{noSeGuardo ? `No se guardó: ${texto}` : texto}
		</span>
	);
}

function Ayuda({ texto }: { texto?: string }) {
	return texto ? <span className="pb-1 text-[10px] leading-snug text-(--cc-text-3)">{texto}</span> : null;
}

/** Una caja de texto: vista previa mientras se escribe; al salir se valida y, si no vale, no se guarda. */
function CampoTextoMotion(props: PropsCampo & { campo: Extract<CampoMotion, { tipo: "texto" }> }) {
	const { param, plantilla, campo } = props;
	const editor = useEditor();
	const { grupo, confirmado } = useCampoMotion(props);
	const [borrador, setBorrador] = useState<string | null>(null);
	const [rechazo, setRechazo] = useState<string | null>(null);
	const guardado = String(confirmado);
	const mostrado = borrador ?? guardado;
	// Un valor que ya quedó guardado y no vale (de antes de esta validación) también lo dice.
	const deLoGuardado = validarCampoMotion(plantilla, param.key, guardado);
	const motivo = rechazo ?? (deLoGuardado.ok ? null : motivoParaElCampo(deLoGuardado.motivo));
	return (
		<div className="flex flex-col">
			<span className="flex items-baseline justify-between pt-1.5 text-[11px] text-(--cc-text-3)">
				{param.label}
				{mostrado.length > campo.max && <span className="text-[10px] text-(--cc-text-2)">Largo: se achica la letra</span>}
			</span>
			<div className="py-1.5">
				<Textarea
					aria-label={param.label}
					aria-invalid={motivo ? true : undefined}
					className="min-h-[72px] bg-(--cc-sunken)"
					value={mostrado}
					onFocus={() => setBorrador((b) => b ?? guardado)}
					onChange={(e) => {
						setBorrador(e.target.value);
						setRechazo(null);
						grupo.previsualizar({ [param.key]: e.target.value });
					}}
					onBlur={() => {
						if (borrador === null) return;
						if (borrador === guardado) {
							editor.timeline.discardPreview();
							setBorrador(null);
							return;
						}
						const r = validar(props, borrador);
						if (r.ok) {
							grupo.previsualizar({ [param.key]: r.valor });
							grupo.confirmar();
							setBorrador(null);
						} else {
							// No se guarda: el elemento vuelve a lo de antes y el texto queda en la caja para corregirlo.
							editor.timeline.discardPreview();
							setRechazo(motivoParaElCampo(r.motivo));
						}
					}}
				/>
			</div>
			{motivo && <Motivo texto={motivo} noSeGuardo={rechazo !== null} />}
			<Ayuda texto={campo.ayuda} />
		</div>
	);
}

/** Un número: el cuadro con el número como lo dibuja el video («1.250», «4,5») y, con un rango chico, su deslizador. */
function CampoNumeroMotion(props: PropsCampo & { campo: Extract<CampoMotion, { tipo: "numero" }> }) {
	const { param, plantilla, campo } = props;
	const editor = useEditor();
	const { grupo, valor, confirmado } = useCampoMotion(props);
	const [borrador, setBorrador] = useState<string | null>(null);
	const [rechazo, setRechazo] = useState<string | null>(null);
	const comoNumero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : campo.porDefecto);
	const n = comoNumero(valor);
	const mostrado = numeroParaMostrar(n);
	const deslizador = conDeslizador(campo);
	const confirmarTexto = (texto: string) => {
		setBorrador(null);
		if (texto.trim() === numeroParaMostrar(comoNumero(confirmado))) {
			editor.timeline.discardPreview();
			return;
		}
		const r = validar(props, texto);
		if (r.ok) {
			grupo.previsualizar({ [param.key]: r.valor });
			grupo.confirmar();
			setRechazo(null);
		} else {
			editor.timeline.discardPreview();
			setRechazo(`«${texto.trim().slice(0, 20)}»: ${motivoParaElCampo(r.motivo)}`);
		}
	};
	return (
		<div className="flex flex-col">
			<FilaCe rotulo={param.label} acciones={<AccionesGrupo grupo={grupo} animable={false} />}>
				{deslizador && (
					<Slider
						className="min-w-0 flex-1"
						value={[Math.min(campo.max, Math.max(campo.min, n))]}
						min={campo.min}
						max={campo.max}
						step={campo.paso}
						aria-label={param.label}
						onValueChange={([v]) => {
							if (v === undefined) return;
							setRechazo(null);
							grupo.previsualizar({ [param.key]: v });
						}}
						onValueCommit={grupo.confirmar}
					/>
				)}
				<NumberField
					className={cn("h-[26px] shrink-0", deslizador ? "w-[68px]" : "ml-auto w-[128px]")}
					value={borrador ?? mostrado}
					aria-label={param.label}
					aria-invalid={rechazo ? true : undefined}
					onFocus={() => setBorrador(mostrado)}
					onChange={(e) => {
						setBorrador(e.target.value);
						setRechazo(null);
						const r = validarCampoMotion(plantilla, param.key, e.target.value);
						if (r.ok) grupo.previsualizar({ [param.key]: r.valor });
					}}
					onBlur={(e) => confirmarTexto(e.target.value)}
				/>
			</FilaCe>
			{rechazo && <Motivo texto={rechazo} noSeGuardo />}
			<Ayuda texto={campo.ayuda} />
		</div>
	);
}

/** Un color, sin transparencia: el motor no la dibuja. */
function CampoColorMotion(props: PropsCampo) {
	const { param } = props;
	const editor = useEditor();
	const { grupo, valor } = useCampoMotion(props);
	const [rechazo, setRechazo] = useState<string | null>(null);
	return (
		<div className="flex flex-col">
			<FilaCe rotulo={param.label} acciones={<AccionesGrupo grupo={grupo} animable={false} />}>
				<ColorPicker
					className="w-full"
					sinTransparencia
					value={String(valor).replace(/^#/, "").slice(0, 6).toUpperCase()}
					onChange={(c) => grupo.previsualizar({ [param.key]: `#${c}` })}
					onChangeEnd={(c) => {
						const r = validar(props, `#${c}`);
						if (r.ok) {
							grupo.aplicar({ [param.key]: r.valor });
							setRechazo(null);
						} else {
							editor.timeline.discardPreview();
							setRechazo(motivoParaElCampo(r.motivo));
						}
					}}
				/>
			</FilaCe>
			{rechazo && <Motivo texto={rechazo} noSeGuardo />}
		</div>
	);
}

function CampoMotionDe(props: PropsCampo & { campo: CampoMotion | undefined }) {
	const { campo, element, trackId, param } = props;
	if (campo?.tipo === "texto") return <CampoTextoMotion {...props} campo={campo} />;
	if (campo?.tipo === "numero") return <CampoNumeroMotion {...props} campo={campo} />;
	if (campo?.tipo === "color") return <CampoColorMotion {...props} />;
	// Una opción o un sí/no no se pueden escribir mal: el control de siempre.
	return (
		<CampoParam
			element={element}
			trackId={trackId}
			param={paramDeElemento(param)}
			ruta={buildGraphicParamPath({ paramKey: param.key })}
		/>
	);
}

export function MotionTab({ element, trackId, params }: { element: GraphicElement; trackId: string; params: ParamDefinition[] }) {
	const plantilla = plantillaDeDefinicion(element.definitionId);
	const tamano = useEditor((e) => e.project.getActive())?.settings.canvasSize;
	const aspecto = tamano && tamano.width > 0 && tamano.height > 0 ? tamano.width / tamano.height : undefined;
	if (!plantilla) return null;
	const campos = new Map(camposDe(plantilla).map((c) => [c.clave, c] as const));
	const textos = params.filter((p) => !CAMPOS_DE_ESTILO.has(p.key));
	const estilo = params.filter((p) => CAMPOS_DE_ESTILO.has(p.key));
	const campo = (p: ParamDefinition) => (
		// La clave lleva el elemento: al elegir otro motion, lo escrito a medias en uno no se queda en el otro.
		<CampoMotionDe key={`${element.id}:${p.key}`} element={element} trackId={trackId} param={p} plantilla={plantilla} aspecto={aspecto} campo={campos.get(p.key)} />
	);
	return (
		<div className="flex flex-col pt-1" data-motion={plantilla}>
			<SeccionCe titulo="Textos" clave="ce:motion:textos">
				{textos.map(campo)}
			</SeccionCe>
			<SeccionCe titulo="Estilo" clave="ce:motion:estilo">
				{estilo.map(campo)}
			</SeccionCe>
		</div>
	);
}
