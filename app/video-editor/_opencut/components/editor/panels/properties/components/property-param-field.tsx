"use client";

// El campo de parámetro de OpenCut, con la fila de CapCut (./kit.tsx): rótulo a
// la izquierda, el control, y ↺ / ◇ a la derecha. Conserva la API de siempre
// (`param`, `value`, `onPreview`, `onCommit`, `keyframe`) porque lo siguen usando
// pestañas del motor (los efectos del clip); para una pestaña nueva, `CampoParam`
// del kit ya trae el ◇ con ‹ › y el valor vivo.

import type {
	NumberParamDefinition,
	ParamDefinition,
	ParamValue,
} from "@/app/video-editor/_opencut/params";
import { Switch } from "@/app/video-editor/_opencut/components/ui/switch";
import { ColorPicker } from "@/app/video-editor/_opencut/components/ui/color-picker";
import { FontPicker } from "@/app/video-editor/_opencut/components/ui/font-picker";
import { Textarea } from "@/app/video-editor/_opencut/components/ui/textarea";
import { usePropertyDraft } from "../hooks/use-property-draft";
import { KeyframeToggle } from "./keyframe-toggle";
import {
	BotonRestablecer,
	CajaNumero,
	DeslizadorValor,
	FilaCe,
	SelectCe,
	escalaDeNumero,
} from "./kit";

export function PropertyParamField({
	param,
	value,
	onPreview,
	onCommit,
	keyframe,
}: {
	param: ParamDefinition;
	value: ParamValue;
	onPreview: (value: ParamValue) => void;
	onCommit: () => void;
	keyframe?: {
		isActive: boolean;
		isDisabled: boolean;
		onToggle: () => void;
	};
}) {
	const restablecer = () => {
		onPreview(param.default);
		onCommit();
	};
	const acciones = (
		<>
			<BotonRestablecer onClick={restablecer} desactivado={value === param.default} />
			{keyframe && param.keyframable !== false ? (
				<span className="flex w-[44px] justify-center">
					<KeyframeToggle
						isActive={keyframe.isActive}
						isDisabled={keyframe.isDisabled}
						title="Fotograma clave"
						onToggle={keyframe.onToggle}
					/>
				</span>
			) : (
				<span className="w-[44px]" />
			)}
		</>
	);

	if (param.type === "text") {
		return <CampoTexto value={String(value)} onPreview={onPreview} onCommit={onCommit} label={param.label} />;
	}

	return (
		<FilaCe rotulo={param.label} acciones={acciones}>
			<ParamInput param={param} value={value} onPreview={onPreview} onCommit={onCommit} />
		</FilaCe>
	);
}

function ParamInput({
	param,
	value,
	onPreview,
	onCommit,
}: {
	param: ParamDefinition;
	value: ParamValue;
	onPreview: (value: ParamValue) => void;
	onCommit: () => void;
}) {
	if (param.type === "number") {
		return (
			<NumberParamField
				param={param}
				value={typeof value === "number" ? value : Number(value)}
				onPreview={onPreview}
				onCommit={onCommit}
			/>
		);
	}

	if (param.type === "boolean") {
		return (
			<Switch
				className="ml-auto"
				checked={Boolean(value)}
				aria-label={param.label}
				onCheckedChange={(checked) => {
					onPreview(checked);
					onCommit();
				}}
			/>
		);
	}

	if (param.type === "select") {
		return (
			<SelectCe
				valor={String(value)}
				ariaLabel={param.label}
				opciones={param.options.map((o) => ({ id: o.value, etiqueta: o.label }))}
				onCambio={(selected) => {
					onPreview(selected);
					onCommit();
				}}
			/>
		);
	}

	if (param.type === "color") {
		return (
			<ColorPicker
				className="w-full"
				value={String(value).replace(/^#/, "").toUpperCase()}
				onChange={(color) => onPreview(`#${color}`)}
				onChangeEnd={(color) => {
					onPreview(`#${color}`);
					onCommit();
				}}
			/>
		);
	}

	if (param.type === "font") {
		return (
			<div className="min-w-0 flex-1">
				<FontPicker
					defaultValue={String(value)}
					onValueChange={(font) => {
						onPreview(font);
						onCommit();
					}}
				/>
			</div>
		);
	}

	return null;
}

function NumberParamField({
	param,
	value,
	onPreview,
	onCommit,
}: {
	param: NumberParamDefinition;
	value: number;
	onPreview: (value: number) => void;
	onCommit: () => void;
}) {
	const { factor, min, max, paso, sufijo } = escalaDeNumero(param);
	const previsualizar = (v: number) => onPreview(v / factor);
	if (max !== undefined && Number.isFinite(min)) {
		return (
			<DeslizadorValor
				valor={value * factor}
				min={min}
				max={max}
				paso={paso}
				sufijo={sufijo}
				ariaLabel={param.label}
				onPrevisualizar={previsualizar}
				onConfirmar={onCommit}
			/>
		);
	}
	return (
		<CajaNumero
			className="ml-auto w-[96px]"
			valor={value * factor}
			min={min}
			max={max}
			paso={paso}
			sufijo={sufijo}
			ariaLabel={param.label}
			onPrevisualizar={previsualizar}
			onConfirmar={onCommit}
		/>
	);
}

function CampoTexto({
	value,
	label,
	onPreview,
	onCommit,
}: {
	value: string;
	label: string;
	onPreview: (value: ParamValue) => void;
	onCommit: () => void;
}) {
	const draft = usePropertyDraft({
		displayValue: value,
		parse: (input) => input,
		onPreview: (v: string) => onPreview(v),
		onCommit,
		supportsExpressions: false,
	});
	return (
		<div className="py-1.5">
			<Textarea
				aria-label={label}
				className="min-h-[72px] bg-(--cc-sunken)"
				value={draft.displayValue}
				onFocus={draft.onFocus}
				onChange={draft.onChange}
				onBlur={draft.onBlur}
			/>
		</div>
	);
}
